"""Comandi della plancia che Home Assistant porta a termine da solo: timer dell'irrigazione e foto delle telecamere.

Irrigazione (aurora_glass/irrigation/start|stop|list): la plancia apre l'elettrovalvola di una zona del giardino
con una durata; il timer vive qui, non nella pagina, quindi la valvola si richiude anche a plancia chiusa e dopo
un riavvio (le scadenze restano in .storage). Se qualcuno chiude la valvola prima, il timer si annulla.
Si comandano solo le elettrovalvole scelte nelle zone del giardino di una plancia Aurora Glass.

Chiusura sicura (3.8.3): Home Assistant non segnala nessun errore quando un'entità non è disponibile o non è
ancora caricata (scrive solo un avviso nel log e non fa niente). Per questo una valvola da chiudere resta «da
chiudere» finché il suo stato non dice davvero chiusa: si riprova ogni 30 secondi, subito appena torna
raggiungibile, e dopo un riavvio solo quando Home Assistant ha finito di partire (prima le integrazioni delle
valvole potrebbero non esserci ancora). Se dopo circa un minuto e mezzo è ancora aperta compare una notifica,
che sparisce da sola quando la valvola si chiude. L'elenco delle valvole da chiudere resta in .storage.

Foto (aurora_glass/snapshot): salva l'immagine della telecamera nella cartella Media, sottocartella aurora_glass,
visibile da Media › Media locali.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta
from functools import partial
import logging
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components import persistent_notification, websocket_api
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import Context, Event, HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv, entity_registry as er
from homeassistant.helpers.event import async_call_later, async_track_point_in_utc_time, async_track_state_change_event
from homeassistant.helpers.start import async_at_started
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util, slugify

from .const import CONF_DEVICES, DOMAIN, GARDEN_ZONES

_LOGGER = logging.getLogger(__name__)

STORE_VERSION = 1
STORE_KEY = f"{DOMAIN}.irrigation"
MAX_MINUTES = 240
ZONE_DOMAINS = ("switch", "valve", "input_boolean")
RUNNING = ("on", "open", "opening")
CLOSED = ("off", "closed")
GONE = ("unavailable", "unknown")
RETRY_SECONDS = 30
SLOW_RETRY_SECONDS = 300
SLOW_AFTER = 120   # dopo circa un'ora di tentativi si riprova ogni 5 minuti (e si lascia perdere un'entità che non esiste più)
NOTIFY_AFTER = 4   # controlli che la trovano ancora aperta prima della notifica (circa un minuto e mezzo)
MEDIA_FOLDER = "aurora_glass"

NOTICE = {
    "it": (
        "Aurora Glass: elettrovalvola ancora aperta",
        "Non riesco a chiudere **{name}** (`{entity}`): risulta «{state}». Aurora Glass riprova da sola ogni 30 secondi "
        "e la chiude appena risponde. Se resta aperta, controlla la valvola o chiudila a mano.",
    ),
    "en": (
        "Aurora Glass: valve still open",
        "I can't close **{name}** (`{entity}`): its state is “{state}”. Aurora Glass keeps retrying every 30 seconds "
        "and closes it as soon as it answers. If it stays open, check the valve or close it by hand.",
    ),
}


class Irrigation:
    """Zone in irrigazione (entità → ora in cui va richiusa) e zone da chiudere finché non risultano chiuse."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.store: Store[dict[str, Any]] = Store(hass, STORE_VERSION, STORE_KEY)
        self.ends: dict[str, datetime] = {}
        self.closing: dict[str, int] = {}   # entità → controlli che l'hanno trovata ancora aperta
        self.started = False
        self._cancel: dict[str, Callable[[], None]] = {}
        self._retry: dict[str, Callable[[], None]] = {}
        self._notified: set[str] = set()
        self._busy: set[str] = set()
        self._unsub_state: Callable[[], None] | None = None

    async def async_load(self) -> None:
        data = await self.store.async_load() or {}
        now = dt_util.utcnow()
        for entity_id, iso in (data.get("timers") or {}).items():
            end = dt_util.parse_datetime(str(iso))
            if end is None:
                continue
            if end <= now:
                _LOGGER.info("Aurora Glass: %s doveva chiudersi mentre Home Assistant era spento: la chiudo appena è partito", entity_id)
                self.closing.setdefault(entity_id, 0)
            else:
                self.schedule(entity_id, end)
        for entity_id in data.get("closing") or []:
            if isinstance(entity_id, str) and "." in entity_id:
                self.closing.setdefault(entity_id, 0)
        self._track()
        if self.closing:
            self.save()
        # le valvole si chiudono solo a Home Assistant partito: prima la loro integrazione potrebbe non essere caricata
        async_at_started(self.hass, self._async_started)
        # allo spegnimento si fermano i timer: scadenze e valvole da chiudere sono già in .storage e ripartono al riavvio
        self.hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, self._async_stop)

    @callback
    def _async_stop(self, _event: Event) -> None:
        for cancel in list(self._cancel.values()) + list(self._retry.values()):
            cancel()
        self._cancel.clear()
        self._retry.clear()
        if self._unsub_state:
            self._unsub_state()
            self._unsub_state = None

    async def _async_started(self, _hass: HomeAssistant) -> None:
        self.started = True
        for entity_id in list(self.closing):
            await self._async_attempt(entity_id)

    def is_zone(self, entity_id: str) -> bool:
        """Solo le elettrovalvole scelte nel giardino di una plancia."""
        if entity_id.split(".")[0] not in ZONE_DOMAINS:
            return False
        for entry in self.hass.config_entries.async_entries(DOMAIN):
            devices = entry.options.get(CONF_DEVICES) or {}
            if any(devices.get(f"garden_z{i}_sw") == entity_id for i in range(1, GARDEN_ZONES + 1)):
                return True
        return False

    def state_of(self, entity_id: str) -> str | None:
        st = self.hass.states.get(entity_id)
        return st.state if st else None

    async def switch(self, entity_id: str, on: bool, context: Context | None = None) -> None:
        domain = entity_id.split(".")[0]
        service = ("open_valve" if on else "close_valve") if domain == "valve" else ("turn_on" if on else "turn_off")
        await self.hass.services.async_call(domain, service, {"entity_id": entity_id}, blocking=True, context=context)

    # ------------------------------------------------------------------ timer
    def schedule(self, entity_id: str, end: datetime) -> None:
        self.unschedule(entity_id)
        self.ends[entity_id] = end

        @callback
        def _fire(_now: datetime) -> None:
            self._cancel.pop(entity_id, None)
            _LOGGER.debug("Aurora Glass: tempo scaduto, chiudo %s", entity_id)
            self.request_close(entity_id)

        self._cancel[entity_id] = async_track_point_in_utc_time(self.hass, _fire, end)
        self._track()

    def unschedule(self, entity_id: str) -> None:
        cancel = self._cancel.pop(entity_id, None)
        if cancel:
            cancel()
        self.ends.pop(entity_id, None)

    # ------------------------------------------------------------------ chiusura sicura
    async def async_request_close(self, entity_id: str, context: Context | None = None) -> bool:
        """La valvola va chiusa: primo tentativo subito, poi si riprova finché lo stato non dice chiusa.

        Restituisce True se risulta già chiusa dopo il primo tentativo.
        """
        self.unschedule(entity_id)
        self.closing.setdefault(entity_id, 0)
        self._track()
        self.save()
        if self.started:
            await self._async_attempt(entity_id, context)
        return entity_id not in self.closing

    @callback
    def request_close(self, entity_id: str, context: Context | None = None) -> None:
        self.hass.async_create_task(self.async_request_close(entity_id, context))

    @callback
    def cancel_close(self, entity_id: str) -> None:
        """Riaperta dalla plancia mentre si stava chiudendo: niente più tentativi."""
        if self.closing.pop(entity_id, None) is None:
            return
        self._cancel_retry(entity_id)
        self._dismiss(entity_id)
        self._track()
        self.save()

    async def _async_attempt(self, entity_id: str, context: Context | None = None) -> None:
        if entity_id not in self.closing or entity_id in self._busy:
            return
        self._busy.add(entity_id)
        try:
            self._cancel_retry(entity_id)
            state = self.state_of(entity_id)
            if state in CLOSED:
                self._done(entity_id)
                return
            if state is not None and state not in GONE:
                try:
                    await self.switch(entity_id, False, context)
                except (HomeAssistantError, vol.Invalid) as err:
                    _LOGGER.warning("Aurora Glass: non riesco a chiudere %s: %s", entity_id, err)
                if entity_id not in self.closing:   # chiusa (e già tolta) mentre si aspettava la risposta
                    return
                state = self.state_of(entity_id)
                if state in CLOSED:
                    self._done(entity_id)
                    return
            tries = self.closing[entity_id] = self.closing.get(entity_id, 0) + 1
            if state is None and tries > SLOW_AFTER and er.async_get(self.hass).async_get(entity_id) is None:
                _LOGGER.warning("Aurora Glass: %s non esiste più in Home Assistant, smetto di provare a chiuderla", entity_id)
                self._done(entity_id, gone=True)
                return
            if tries == 2 or tries % SLOW_AFTER == 0:
                _LOGGER.warning("Aurora Glass: %s risulta ancora «%s», continuo a provare a chiuderla", entity_id, state)
            if tries >= NOTIFY_AFTER and entity_id not in self._notified:
                self._notify(entity_id, state)
            delay = SLOW_RETRY_SECONDS if tries > SLOW_AFTER else RETRY_SECONDS
            self._retry[entity_id] = async_call_later(self.hass, delay, partial(self._again, entity_id))
        finally:
            self._busy.discard(entity_id)

    @callback
    def _again(self, entity_id: str, _now: datetime) -> None:
        self._retry.pop(entity_id, None)
        self.hass.async_create_task(self._async_attempt(entity_id))

    def _cancel_retry(self, entity_id: str) -> None:
        cancel = self._retry.pop(entity_id, None)
        if cancel:
            cancel()

    def _done(self, entity_id: str, gone: bool = False) -> None:
        if self.closing.pop(entity_id, None) is None:
            return
        self._cancel_retry(entity_id)
        self._dismiss(entity_id)
        self._track()
        self.save()
        if not gone:
            _LOGGER.info("Aurora Glass: %s chiusa", entity_id)

    def _notice_id(self, entity_id: str) -> str:
        return f"{DOMAIN}_irrigazione_{slugify(entity_id)}"

    def _notify(self, entity_id: str, state: str | None) -> None:
        lang = "it" if str(self.hass.config.language or "").lower().startswith("it") else "en"
        title, text = NOTICE[lang]
        st = self.hass.states.get(entity_id)
        name = (st.attributes.get("friendly_name") if st else None) or entity_id
        persistent_notification.async_create(
            self.hass, text.format(name=name, entity=entity_id, state=state or "?"), title=title, notification_id=self._notice_id(entity_id)
        )
        self._notified.add(entity_id)

    def _dismiss(self, entity_id: str) -> None:
        if entity_id in self._notified:
            self._notified.discard(entity_id)
            persistent_notification.async_dismiss(self.hass, self._notice_id(entity_id))

    # ------------------------------------------------------------------ stati
    def _track(self) -> None:
        """Si ascoltano le valvole in irrigazione e quelle da chiudere."""
        if self._unsub_state:
            self._unsub_state()
            self._unsub_state = None
        watch = sorted(set(self.ends) | set(self.closing))
        if watch:
            self._unsub_state = async_track_state_change_event(self.hass, watch, self._changed)

    @callback
    def _changed(self, event: Event) -> None:
        entity_id = event.data["entity_id"]
        new = event.data.get("new_state")
        if new is None:
            return
        if entity_id in self.closing:
            if new.state in CLOSED:
                self._done(entity_id)
            elif new.state in RUNNING and self.started:
                old = event.data.get("old_state")
                if old is None or old.state in GONE:
                    # di nuovo raggiungibile e ancora aperta: si chiude adesso, senza aspettare il prossimo tentativo
                    self.hass.async_create_task(self._async_attempt(entity_id))
            return
        if entity_id not in self.ends or new.state in RUNNING or new.state in GONE:
            return
        # chiusa da un'altra parte prima della fine: il timer non serve più
        self.unschedule(entity_id)
        self._track()
        self.save()

    def save(self) -> None:
        self.store.async_delay_save(
            lambda: {"timers": {e: t.isoformat() for e, t in self.ends.items()}, "closing": sorted(self.closing)}, 1
        )


def _irrigation(hass: HomeAssistant) -> Irrigation:
    return hass.data[DOMAIN]["irrigation"]


@websocket_api.websocket_command(
    {
        vol.Required("type"): "aurora_glass/irrigation/start",
        vol.Required("entity_id"): cv.entity_id,
        vol.Required("minutes"): vol.All(vol.Coerce(int), vol.Range(min=1, max=MAX_MINUTES)),
    }
)
@websocket_api.async_response
async def ws_irrigation_start(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    irr, entity_id = _irrigation(hass), msg["entity_id"]
    if not irr.is_zone(entity_id):
        connection.send_error(msg["id"], "not_a_zone", f"{entity_id} is not a garden zone of Aurora Glass")
        return
    if irr.state_of(entity_id) in (None, *GONE):
        connection.send_error(msg["id"], "unavailable", f"{entity_id} is not available")
        return
    irr.cancel_close(entity_id)
    try:
        await irr.switch(entity_id, True, connection.context(msg))
    except (HomeAssistantError, vol.Invalid) as err:
        connection.send_error(msg["id"], "home_assistant_error", str(err))
        return
    end = dt_util.utcnow() + timedelta(minutes=msg["minutes"])
    irr.schedule(entity_id, end)
    irr.save()
    connection.send_result(msg["id"], {"end": end.isoformat()})


@websocket_api.websocket_command({vol.Required("type"): "aurora_glass/irrigation/stop", vol.Required("entity_id"): cv.entity_id})
@websocket_api.async_response
async def ws_irrigation_stop(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    irr, entity_id = _irrigation(hass), msg["entity_id"]
    if not irr.is_zone(entity_id) and entity_id not in irr.ends and entity_id not in irr.closing:
        connection.send_error(msg["id"], "not_a_zone", f"{entity_id} is not a garden zone of Aurora Glass")
        return
    closed = await irr.async_request_close(entity_id, connection.context(msg))
    connection.send_result(msg["id"], {"stopped": True, "closed": closed})


@websocket_api.websocket_command({vol.Required("type"): "aurora_glass/irrigation/list"})
@callback
def ws_irrigation_list(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    irr = _irrigation(hass)
    connection.send_result(msg["id"], {
        "timers": {e: t.isoformat() for e, t in irr.ends.items()},
        "closing": sorted(irr.closing),
    })


@websocket_api.websocket_command({vol.Required("type"): "aurora_glass/snapshot", vol.Required("entity_id"): cv.entity_id})
@websocket_api.async_response
async def ws_snapshot(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    entity_id = msg["entity_id"]
    if not entity_id.startswith("camera.") or hass.states.get(entity_id) is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, f"{entity_id} not found")
        return
    dirs = hass.config.media_dirs or {}
    media = dirs.get("local") or next(iter(dirs.values()), None)
    if not media:
        connection.send_error(msg["id"], "no_media_dir", "Home Assistant has no media folder")
        return
    folder = Path(media) / MEDIA_FOLDER
    name = f"{slugify(entity_id.split('.', 1)[1])}_{dt_util.now().strftime('%Y%m%d_%H%M%S')}.jpg"
    path = folder / name
    # is_allowed_path guarda il disco: fuori dal ciclo degli eventi
    if not await hass.async_add_executor_job(hass.config.is_allowed_path, str(path)):
        connection.send_error(msg["id"], "not_allowed", f"{media} is not in allowlist_external_dirs")
        return
    try:
        await hass.async_add_executor_job(partial(folder.mkdir, parents=True, exist_ok=True))
        await hass.services.async_call(
            "camera", "snapshot", {"entity_id": entity_id, "filename": str(path)}, blocking=True, context=connection.context(msg)
        )
    except (HomeAssistantError, OSError, vol.Invalid) as err:
        connection.send_error(msg["id"], "home_assistant_error", str(err))
        return
    connection.send_result(msg["id"], {"folder": MEDIA_FOLDER, "file": name})


async def async_setup_actions(hass: HomeAssistant) -> None:
    irr = Irrigation(hass)
    hass.data[DOMAIN]["irrigation"] = irr
    await irr.async_load()
    for command in (ws_irrigation_start, ws_irrigation_stop, ws_irrigation_list, ws_snapshot):
        websocket_api.async_register_command(hass, command)
