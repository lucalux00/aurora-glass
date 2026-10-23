"""Procedura guidata di Aurora Glass: nome e lingua, stanze, dispositivi, scene.

Le stesse schermate servono alla prima configurazione (ConfigFlow) e per cambiare
tutto in seguito da Impostazioni → Dispositivi e servizi → Aurora Glass → Configura (OptionsFlow).
"""

from __future__ import annotations

import copy
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.const import CONF_ICON, CONF_NAME
from homeassistant.core import callback
from homeassistant.helpers import instance_id, selector

from .const import (
    CONF_DEVICES,
    CONF_LANGUAGE,
    CONF_ROOMS,
    CONF_SCENES,
    CONF_URL_PATH,
    DEFAULT_ICON,
    DEFAULT_NAME,
    DOMAIN,
    LANGUAGES,
    LIGHT_IMAGES,
)
from .helpers import (
    MOTION_CLASSES,
    OPEN_CLASSES,
    area_name,
    areas_with_lights,
    currency_symbol,
    detect_devices,
    detect_room,
    guess_image,
    unique_url_path,
)

MAX_EXTRA_ROOMS = 10


def _ent(multiple: bool = False, **cfg) -> selector.EntitySelector:
    return selector.EntitySelector(selector.EntitySelectorConfig(multiple=multiple, **cfg))


def _sv(value: Any) -> dict[str, Any]:
    """Valore proposto ma cancellabile (vol.Optional con suggested_value)."""
    return {"suggested_value": value} if value not in (None, [], "") else {}


class AuroraFlowSteps:
    """Passi comuni alla prima configurazione e alle opzioni. self._conf contiene tutto."""

    _conf: dict[str, Any]
    _queue: list[dict[str, Any]]
    _rooms_out: list[dict[str, Any]]
    _only: str | None = None   # nelle opzioni: rifà solo una parte e poi salva

    # ---------------------------------------------------------------- generale
    def _general_schema(self) -> vol.Schema:
        c = self._conf
        return vol.Schema({
            vol.Required(CONF_NAME, default=c.get(CONF_NAME, DEFAULT_NAME)): selector.TextSelector(),
            vol.Required(CONF_ICON, default=c.get(CONF_ICON, DEFAULT_ICON)): selector.IconSelector(),
            vol.Required(CONF_LANGUAGE, default=c.get(CONF_LANGUAGE, "auto")): selector.SelectSelector(
                selector.SelectSelectorConfig(options=LANGUAGES, translation_key="language", mode=selector.SelectSelectorMode.LIST)
            ),
        })

    # ---------------------------------------------------------------- stanze: scelta delle aree
    async def async_step_areas(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        hass = self.hass
        current = self._conf.get(CONF_ROOMS)
        if user_input is not None:
            areas = user_input.get("areas") or []
            extra = int(user_input.get("extra_rooms") or 0)
            if not areas and not extra:
                return self.async_show_form(step_id="areas", data_schema=self._areas_schema(areas, extra), errors={"base": "no_rooms"}, last_step=False)
            old = {r.get("area_id"): r for r in (current or []) if r.get("area_id")}
            old_free = [r for r in (current or []) if not r.get("area_id")]
            self._queue = []
            for area_id in areas:
                if area_id in old:
                    self._queue.append(dict(old[area_id]))
                    continue
                name = area_name(hass, area_id)
                room = {"area_id": area_id, "name": name, "image": guess_image(name)}
                room.update(detect_room(hass, area_id))
                self._queue.append(room)
            for i in range(extra):
                self._queue.append(dict(old_free[i]) if i < len(old_free) else {"name": "", "lights": []})
            self._rooms_out = []
            return await self.async_step_room()

        if current is not None:
            areas = [r["area_id"] for r in current if r.get("area_id")]
            extra = len([r for r in current if not r.get("area_id")])
        else:
            areas = areas_with_lights(hass)
            extra = 0 if areas else 2
        return self.async_show_form(step_id="areas", data_schema=self._areas_schema(areas, extra), last_step=False,
                                    description_placeholders={"found": str(len(areas))})

    def _areas_schema(self, areas: list[str], extra: int) -> vol.Schema:
        return vol.Schema({
            vol.Optional("areas", default=areas): selector.AreaSelector(selector.AreaSelectorConfig(multiple=True)),
            vol.Required("extra_rooms", default=extra): selector.NumberSelector(
                selector.NumberSelectorConfig(min=0, max=MAX_EXTRA_ROOMS, step=1, mode=selector.NumberSelectorMode.BOX)
            ),
        })

    # ---------------------------------------------------------------- stanze: una alla volta
    async def async_step_room(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        index = len(self._rooms_out)
        room = self._queue[index]
        errors: dict[str, str] = {}
        if user_input is not None:
            name = (user_input.get("name") or "").strip()
            if not name:
                errors["name"] = "name_required"
            else:
                done = {
                    "area_id": room.get("area_id"),
                    "name": name,
                    "image": user_input.get("image") or guess_image(name),
                    "lights": user_input.get("lights") or [],
                    "motion": user_input.get("motion") or [],
                    "openings": user_input.get("openings") or [],
                    "temperature": user_input.get("temperature") or [],
                }
                self._rooms_out.append(done)
                if len(self._rooms_out) < len(self._queue):
                    return await self.async_step_room()
                self._conf[CONF_ROOMS] = self._rooms_out
                if self._only == "rooms":
                    return self._finish()
                return await self.async_step_devices()
            room = dict(room, **{k: v for k, v in user_input.items()})

        schema = vol.Schema({
            vol.Required("name", default=room.get("name") or ""): selector.TextSelector(),
            vol.Optional("lights", description=_sv(room.get("lights"))): _ent(True, domain=["light", "switch"]),
            vol.Optional("motion", description=_sv(room.get("motion"))): _ent(True, filter=[{"domain": "binary_sensor", "device_class": list(MOTION_CLASSES)}]),
            vol.Optional("openings", description=_sv(room.get("openings"))): _ent(True, filter=[{"domain": "binary_sensor", "device_class": list(OPEN_CLASSES)}, {"domain": "lock"}]),
            vol.Optional("temperature", description=_sv(room.get("temperature"))): _ent(True, filter=[{"domain": "sensor", "device_class": "temperature"}]),
            vol.Required("image", default=room.get("image") or guess_image(room.get("name", ""))): selector.SelectSelector(
                selector.SelectSelectorConfig(options=LIGHT_IMAGES, translation_key="image", mode=selector.SelectSelectorMode.DROPDOWN)
            ),
        })
        area = area_name(self.hass, room["area_id"]) if room.get("area_id") else "—"
        return self.async_show_form(step_id="room", data_schema=schema, errors=errors, last_step=False,
                                    description_placeholders={"current": str(index + 1), "total": str(len(self._queue)), "area": area})

    # ---------------------------------------------------------------- dispositivi della casa
    async def async_step_devices(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            self._conf[CONF_DEVICES] = {k: user_input.get(k) for k in ("alarm", "weather", "climate", "power", "energy", "cameras", "currency")}
            if not self._conf[CONF_DEVICES].get("currency"):
                self._conf[CONF_DEVICES]["currency"] = currency_symbol(self.hass)
            if self._only == "devices":
                return self._finish()
            return await self.async_step_scenes()
        d = self._conf.get(CONF_DEVICES) or detect_devices(self.hass)
        schema = vol.Schema({
            vol.Optional("alarm", description=_sv(d.get("alarm"))): _ent(domain="alarm_control_panel"),
            vol.Optional("weather", description=_sv(d.get("weather"))): _ent(domain="weather"),
            vol.Optional("climate", description=_sv(d.get("climate"))): _ent(domain="climate"),
            vol.Optional("power", description=_sv(d.get("power"))): _ent(filter=[{"domain": "sensor", "device_class": "power"}]),
            vol.Optional("energy", description=_sv(d.get("energy"))): _ent(filter=[{"domain": "sensor", "device_class": "energy"}]),
            vol.Optional("cameras", description=_sv(d.get("cameras"))): _ent(True, domain="camera"),
            vol.Required("currency", default=d.get("currency") or currency_symbol(self.hass)): selector.TextSelector(),
        })
        return self.async_show_form(step_id="devices", data_schema=schema, last_step=False)

    # ---------------------------------------------------------------- scene rapide
    async def async_step_scenes(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            self._conf[CONF_SCENES] = {
                "morning": user_input.get("morning") or [],
                "cinema": user_input.get("cinema") or [],
                "dinner": user_input.get("dinner") or [],
                "night_alarm": bool(user_input.get("night_alarm", True)),
                "away_alarm": bool(user_input.get("away_alarm", True)),
            }
            return self._finish()
        s = self._conf.get(CONF_SCENES) or self._guess_scenes()
        allowed = ["light", "switch", "scene", "script"]
        fields: dict[Any, Any] = {
            vol.Optional("morning", description=_sv(s.get("morning"))): _ent(True, domain=allowed),
            vol.Optional("cinema", description=_sv(s.get("cinema"))): _ent(True, domain=allowed),
            vol.Optional("dinner", description=_sv(s.get("dinner"))): _ent(True, domain=allowed),
        }
        if (self._conf.get(CONF_DEVICES) or {}).get("alarm"):
            fields[vol.Required("night_alarm", default=s.get("night_alarm", True))] = selector.BooleanSelector()
            fields[vol.Required("away_alarm", default=s.get("away_alarm", True))] = selector.BooleanSelector()
        return self.async_show_form(step_id="scenes", data_schema=vol.Schema(fields))

    def _guess_scenes(self) -> dict[str, Any]:
        """Proposte: buongiorno = cucina, bagno e corridoio; cena = cucina e salotto; cinema = salotto."""
        first: dict[str, list[str]] = {}
        for room in self._conf.get(CONF_ROOMS, []):
            if room.get("lights"):
                first.setdefault(room.get("image") or guess_image(room.get("name", "")), []).append(room["lights"][0])

        def pick(*images: str) -> list[str]:
            return [e for img in images for e in first.get(img, [])[:1]]

        return {"morning": pick("cucina", "bagno_piccolo", "bagno_doccia", "corridoio"), "cinema": pick("salotto"),
                "dinner": pick("cucina", "salotto"), "night_alarm": True, "away_alarm": True}

    def _finish(self) -> ConfigFlowResult:
        raise NotImplementedError


class AuroraGlassConfigFlow(AuroraFlowSteps, ConfigFlow, domain=DOMAIN):
    """Prima configurazione: crea la plancia e la voce nella barra laterale."""

    VERSION = 1

    def __init__(self) -> None:
        self._conf = {}
        self._queue = []
        self._rooms_out = []

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            self._conf.update(user_input)
            return await self.async_step_areas()
        if not self._conf.get(CONF_LANGUAGE):
            self._conf[CONF_LANGUAGE] = "auto"
        return self.async_show_form(step_id="user", data_schema=self._general_schema(), last_step=False)

    async def async_step_zeroconf(self, discovery_info: Any) -> ConfigFlowResult:
        """Dopo l'installazione da HACS e il riavvio: Home Assistant trova sé stesso in rete e propone Aurora Glass.

        Si risponde solo all'annuncio di questa istanza (stesso uuid) e solo se non c'è ancora nessuna plancia.
        """
        props = getattr(discovery_info, "properties", None) or {}
        if props.get("uuid") != await instance_id.async_get(self.hass):
            return self.async_abort(reason="not_this_instance")
        if self._async_current_entries(include_ignore=True):
            return self.async_abort(reason="already_configured")
        await self.async_set_unique_id(f"{DOMAIN}_welcome")
        self._abort_if_unique_id_configured()
        self.context["title_placeholders"] = {"name": "Aurora Glass"}
        return await self.async_step_welcome()

    async def async_step_welcome(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return await self.async_step_user()
        return self.async_show_form(step_id="welcome", last_step=False)

    def _finish(self) -> ConfigFlowResult:
        c = self._conf
        data = {
            CONF_NAME: c[CONF_NAME].strip() or DEFAULT_NAME,
            CONF_ICON: c.get(CONF_ICON) or DEFAULT_ICON,
            CONF_LANGUAGE: c.get(CONF_LANGUAGE, "auto"),
            CONF_URL_PATH: unique_url_path(self.hass, c[CONF_NAME]),
        }
        options = {CONF_ROOMS: c.get(CONF_ROOMS, []), CONF_DEVICES: c.get(CONF_DEVICES, {}), CONF_SCENES: c.get(CONF_SCENES, {})}
        return self.async_create_entry(title=data[CONF_NAME], data=data, options=options)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return AuroraGlassOptionsFlow()


class AuroraGlassOptionsFlow(AuroraFlowSteps, OptionsFlow):
    """Configura: cambia nome e lingua, stanze, dispositivi o scene."""

    def __init__(self) -> None:
        self._conf = {}
        self._queue = []
        self._rooms_out = []
        self._only = None

    def _load(self) -> None:
        if not self._conf:
            self._conf = copy.deepcopy({**self.config_entry.data, **self.config_entry.options})

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        self._load()
        return self.async_show_menu(step_id="init", menu_options=["general", "areas", "devices", "scenes"])

    async def async_step_general(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        self._load()
        if user_input is not None:
            data = dict(self.config_entry.data)
            data.update({CONF_NAME: user_input[CONF_NAME].strip() or DEFAULT_NAME, CONF_ICON: user_input[CONF_ICON], CONF_LANGUAGE: user_input[CONF_LANGUAGE]})
            self.hass.config_entries.async_update_entry(self.config_entry, data=data, title=data[CONF_NAME])
            return self.async_create_entry(data=dict(self.config_entry.options))
        return self.async_show_form(step_id="general", data_schema=self._general_schema())

    async def async_step_areas(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        self._load()
        self._only = self._only or "rooms"
        return await super().async_step_areas(user_input)

    async def async_step_devices(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        self._load()
        self._only = self._only or "devices"
        return await super().async_step_devices(user_input)

    async def async_step_scenes(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        self._load()
        self._only = self._only or "scenes"
        return await super().async_step_scenes(user_input)

    def _finish(self) -> ConfigFlowResult:
        c = self._conf
        return self.async_create_entry(data={CONF_ROOMS: c.get(CONF_ROOMS, []), CONF_DEVICES: c.get(CONF_DEVICES, {}), CONF_SCENES: c.get(CONF_SCENES, {})})
