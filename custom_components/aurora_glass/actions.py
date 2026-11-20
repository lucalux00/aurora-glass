"""Comandi della plancia che Home Assistant porta a termine da solo: timer dell'irrigazione e foto delle telecamere.

Irrigazione (aurora_glass/irrigation/start|stop|list): la plancia apre l'elettrovalvola di una zona del giardino
con una durata; il timer vive qui, non nella pagina, quindi la valvola si richiude anche a plancia chiusa e dopo
un riavvio (le scadenze restano in .storage). Se qualcuno chiude la valvola prima, il timer si annulla.
Si comandano solo le elettrovalvole scelte nelle zone del giardino di una plancia Aurora Glass.

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

from homeassistant.components import websocket_api
from homeassistant.core import Context, Event, HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.event import async_track_point_in_utc_time, async_track_state_change_event
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util, slugify

from .const import CONF_DEVICES, DOMAIN, GARDEN_ZONES

_LOGGER = logging.getLogger(__name__)

STORE_VERSION = 1
STORE_KEY = f"{DOMAIN}.irrigation"
MAX_MINUTES = 240
ZONE_DOMAINS = ("switch", "valve", "input_boolean")
RUNNING = ("on", "open", "opening")
MEDIA_FOLDER = "aurora_glass"


class Irrigation:
    """Scadenze delle zone in irrigazione: entità → ora (UTC) in cui va richiusa."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.store: Store[dict[str, Any]] = Store(hass, STORE_VERSION, STORE_KEY)
        self.ends: dict[str, datetime] = {}
        self._cancel: dict[str, Callable[[], None]] = {}
        self._unsub_state: Callable[[], None] | None = None

    async def async_load(self) -> None:
        data = await self.store.async_load() or {}
        now = dt_util.utcnow()
        expired = []
        for entity_id, iso in (data.get("timers") or {}).items():
            end = dt_util.parse_datetime(str(iso))
            if end is None:
                continue
            if end <= now:
                expired.append(entity_id)
            else:
                self.schedule(entity_id, end)
        # scadute mentre Home Assistant era spento: si chiudono adesso
        for entity_id in expired:
            _LOGGER.info("Aurora Glass: %s doveva chiudersi durante il riavvio, la chiudo ora", entity_id)
            self.hass.async_create_task(self.switch(entity_id, False, quiet=True))
        if expired:
            self.save()

    def is_zone(self, entity_id: str) -> bool:
        """Solo le elettrovalvole scelte nel giardino di una plancia."""
        if entity_id.split(".")[0] not in ZONE_DOMAINS:
            return False
        for entry in self.hass.config_entries.async_entries(DOMAIN):
            devices = entry.options.get(CONF_DEVICES) or {}
            if any(devices.get(f"garden_z{i}_sw") == entity_id for i in range(1, GARDEN_ZONES + 1)):
                return True
        return False

    async def switch(self, entity_id: str, on: bool, context: Context | None = None, quiet: bool = False) -> None:
        domain = entity_id.split(".")[0]
        service = ("open_valve" if on else "close_valve") if domain == "valve" else ("turn_on" if on else "turn_off")
        try:
            await self.hass.services.async_call(domain, service, {"entity_id": entity_id}, blocking=True, context=context)
        except (HomeAssistantError, vol.Invalid) as err:
            if not quiet:
                raise
            _LOGGER.warning("Aurora Glass: non riesco a chiudere %s: %s", entity_id, err)

    def schedule(self, entity_id: str, end: datetime) -> None:
        self.unschedule(entity_id)
        self.ends[entity_id] = end

        @callback
        def _fire(_now: datetime) -> None:
            self._cancel.pop(entity_id, None)
            self.ends.pop(entity_id, None)
            self._track()
            self.save()
            _LOGGER.debug("Aurora Glass: tempo scaduto, chiudo %s", entity_id)
            self.hass.async_create_task(self.switch(entity_id, False, quiet=True))

        self._cancel[entity_id] = async_track_point_in_utc_time(self.hass, _fire, end)
        self._track()

    def unschedule(self, entity_id: str) -> None:
        cancel = self._cancel.pop(entity_id, None)
        if cancel:
            cancel()
        self.ends.pop(entity_id, None)

    def _track(self) -> None:
        """Se la valvola viene chiusa da un'altra parte, il timer non serve più."""
        if self._unsub_state:
            self._unsub_state()
            self._unsub_state = None
        if self.ends:
            self._unsub_state = async_track_state_change_event(self.hass, list(self.ends), self._changed)

    @callback
    def _changed(self, event: Event) -> None:
        entity_id = event.data["entity_id"]
        new = event.data.get("new_state")
        if entity_id not in self.ends or new is None or new.state in RUNNING or new.state in ("unavailable", "unknown"):
            return
        self.unschedule(entity_id)
        self._track()
        self.save()

    def save(self) -> None:
        self.store.async_delay_save(lambda: {"timers": {e: t.isoformat() for e, t in self.ends.items()}}, 1)


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
    if not irr.is_zone(entity_id):
        connection.send_error(msg["id"], "not_a_zone", f"{entity_id} is not a garden zone of Aurora Glass")
        return
    irr.unschedule(entity_id)
    irr._track()
    irr.save()
    try:
        await irr.switch(entity_id, False, connection.context(msg))
    except (HomeAssistantError, vol.Invalid) as err:
        connection.send_error(msg["id"], "home_assistant_error", str(err))
        return
    connection.send_result(msg["id"], {"stopped": True})


@websocket_api.websocket_command({vol.Required("type"): "aurora_glass/irrigation/list"})
@callback
def ws_irrigation_list(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    connection.send_result(msg["id"], {"timers": {e: t.isoformat() for e, t in _irrigation(hass).ends.items()}})


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
    await irr.async_load()
    hass.data[DOMAIN]["irrigation"] = irr
    for command in (ws_irrigation_start, ws_irrigation_stop, ws_irrigation_list, ws_snapshot):
        websocket_api.async_register_command(hass, command)
