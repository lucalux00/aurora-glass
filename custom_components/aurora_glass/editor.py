"""Stanze e dispositivi cambiati dalla plancia (finestra «Stanze e dispositivi», solo amministratori).

La plancia legge le scelte salvate con aurora_glass/config e le riscrive con aurora_glass/config/save:
sono le stesse opzioni di Impostazioni → Aurora Glass → Configura, quindi dopo il salvataggio la pagina
viene registrata di nuovo (vedi _async_updated in __init__.py) e tutti i dispositivi vedono la versione nuova.
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import config_validation as cv

from .const import CONF_DEVICES, CONF_ROOMS, CONF_SCENES, DOMAIN, LIGHT_IMAGES
from .helpers import as_list, guess_image

MAX_ROOMS = 40
MAX_ENTITIES = 60


def _name(value: Any) -> str:
    value = str(value or "").strip()
    if not value or len(value) > 60:
        raise vol.Invalid("room name must be 1-60 characters")
    return value


def _one(value: Any) -> str | None:
    """Un'entità o niente (stringa vuota = tolta)."""
    return cv.entity_id(value) if value else None


ENTITIES = vol.All(cv.ensure_list, [cv.entity_id], vol.Length(max=MAX_ENTITIES))

ROOM_SCHEMA = vol.Schema(
    {
        vol.Optional("area_id"): vol.Any(None, str),
        vol.Required("name"): _name,
        vol.Optional("image"): vol.Any(None, vol.In(LIGHT_IMAGES)),
        vol.Optional("lights", default=list): ENTITIES,
        vol.Optional("motion", default=list): ENTITIES,
        vol.Optional("openings", default=list): ENTITIES,
        vol.Optional("temperature", default=list): ENTITIES,
    },
    extra=vol.REMOVE_EXTRA,
)

DEVICES_SCHEMA = vol.Schema(
    {
        vol.Optional("alarm"): _one,
        vol.Optional("weather"): _one,
        vol.Optional("climate", default=list): ENTITIES,
        vol.Optional("power"): _one,
        vol.Optional("energy"): _one,
        vol.Optional("appliances", default=list): ENTITIES,
        vol.Optional("cameras", default=list): ENTITIES,
        vol.Optional("currency"): vol.Any(None, vol.All(str, vol.Length(max=5))),
    },
    extra=vol.REMOVE_EXTRA,
)

SCENES_SCHEMA = vol.Schema(
    {
        vol.Optional("morning", default=list): ENTITIES,
        vol.Optional("cinema", default=list): ENTITIES,
        vol.Optional("dinner", default=list): ENTITIES,
        vol.Optional("night_alarm", default=True): cv.boolean,
        vol.Optional("away_alarm", default=True): cv.boolean,
    },
    extra=vol.REMOVE_EXTRA,
)


def _entry(hass: HomeAssistant, entry_id: str) -> ConfigEntry | None:
    entry = hass.config_entries.async_get_entry(entry_id)
    return entry if entry and entry.domain == DOMAIN else None


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "aurora_glass/config", vol.Required("entry_id"): str})
@callback
def ws_config(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    entry = _entry(hass, msg["entry_id"])
    if entry is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Aurora Glass entry not found")
        return
    devices = dict(entry.options.get(CONF_DEVICES, {}))
    devices["climate"] = as_list(devices.get("climate"))
    devices["appliances"] = as_list(devices.get("appliances"))
    devices["cameras"] = as_list(devices.get("cameras"))
    connection.send_result(msg["id"], {
        "rooms": entry.options.get(CONF_ROOMS, []),
        "devices": devices,
        "scenes": entry.options.get(CONF_SCENES, {}),
    })


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): "aurora_glass/config/save",
        vol.Required("entry_id"): str,
        vol.Required("rooms"): list,
        vol.Required("devices"): dict,
        vol.Required("scenes"): dict,
    }
)
@callback
def ws_config_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    entry = _entry(hass, msg["entry_id"])
    if entry is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Aurora Glass entry not found")
        return
    if not msg["rooms"] or len(msg["rooms"]) > MAX_ROOMS:
        connection.send_error(msg["id"], websocket_api.ERR_INVALID_FORMAT, f"between 1 and {MAX_ROOMS} rooms")
        return
    try:
        rooms = [ROOM_SCHEMA(room) for room in msg["rooms"]]
        devices = DEVICES_SCHEMA(msg["devices"])
        scenes = SCENES_SCHEMA(msg["scenes"])
    except vol.Invalid as err:
        connection.send_error(msg["id"], websocket_api.ERR_INVALID_FORMAT, str(err))
        return
    for room in rooms:
        if not room.get("image"):
            room["image"] = guess_image(room["name"])
        room.setdefault("area_id", None)
    old = entry.options.get(CONF_DEVICES, {})
    devices["currency"] = devices.get("currency") or old.get("currency") or "€"
    options = {**entry.options, CONF_ROOMS: rooms, CONF_DEVICES: devices, CONF_SCENES: scenes}
    hass.config_entries.async_update_entry(entry, options=options)
    connection.send_result(msg["id"], {"saved": True})


@callback
def async_setup_editor(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_config)
    websocket_api.async_register_command(hass, ws_config_save)
