"""Riconoscimento automatico di stanze ed entità, e costruzione della config della scheda."""

from __future__ import annotations

import re
from typing import Any

from homeassistant.const import CONF_ICON, CONF_NAME
from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.util import slugify

from .const import (
    CONF_DEVICES,
    CONF_LANGUAGE,
    CONF_ROOMS,
    CONF_SCENES,
    CURRENCY_SYMBOLS,
    IMAGE_HINTS,
    URL_BASE,
)

MOTION_CLASSES = ("motion", "occupancy", "presence")
OPEN_CLASSES = ("door", "window", "garage_door", "opening")
POWER_HINTS = ("total", "casa", "house", "home", "grid", "rete", "generale", "main", "consumo", "contatore", "meter")


def guess_image(text: str) -> str:
    """Immagine della libreria adatta al nome della stanza (salotto se non si capisce)."""
    low = (text or "").lower()
    for image, words in IMAGE_HINTS:
        if any(w in low for w in words):
            return image
    return "salotto"


def _device_class(hass: HomeAssistant, entry: er.RegistryEntry) -> str | None:
    if entry.device_class or entry.original_device_class:
        return entry.device_class or entry.original_device_class
    state = hass.states.get(entry.entity_id)
    return state.attributes.get("device_class") if state else None


def _usable(entry: er.RegistryEntry) -> bool:
    return not entry.disabled_by and not entry.hidden_by and entry.entity_category is None


def area_entities(hass: HomeAssistant, area_id: str) -> list[er.RegistryEntry]:
    """Entità di un'area: assegnate direttamente o tramite il loro dispositivo."""
    ent_reg = er.async_get(hass)
    dev_reg = dr.async_get(hass)
    out = []
    for entry in ent_reg.entities.values():
        if not _usable(entry):
            continue
        area = entry.area_id
        if area is None and entry.device_id:
            device = dev_reg.async_get(entry.device_id)
            area = device.area_id if device else None
        if area == area_id:
            out.append(entry)
    return out


def detect_room(hass: HomeAssistant, area_id: str) -> dict[str, Any]:
    """Luci, movimento, aperture e temperatura che stanno in un'area."""
    lights, motion, openings, temps = [], [], [], []
    for entry in area_entities(hass, area_id):
        domain = entry.domain
        dc = _device_class(hass, entry)
        if domain == "light":
            lights.append(entry.entity_id)
        elif domain == "binary_sensor" and dc in MOTION_CLASSES:
            motion.append(entry.entity_id)
        elif (domain == "binary_sensor" and dc in OPEN_CLASSES) or domain == "lock":
            openings.append(entry.entity_id)
        elif domain == "sensor" and dc == "temperature":
            temps.append(entry.entity_id)
    return {"lights": sorted(lights), "motion": sorted(motion), "openings": sorted(openings), "temperature": sorted(temps)[:1]}


def areas_with_lights(hass: HomeAssistant) -> list[str]:
    """Aree che hanno almeno una luce, nell'ordine del registro."""
    return [a.id for a in ar.async_get(hass).async_list_areas() if detect_room(hass, a.id)["lights"]]


def area_name(hass: HomeAssistant, area_id: str) -> str:
    area = ar.async_get(hass).async_get_area(area_id)
    return area.name if area else area_id


def _first(hass: HomeAssistant, domain: str, prefer: tuple[str, ...] = (), test=None) -> str | None:
    found = []
    for state in hass.states.async_all(domain):
        if test and not test(state):
            continue
        found.append(state.entity_id)
    if not found:
        return None
    for entity_id in found:
        if any(p in entity_id for p in prefer):
            return entity_id
    return found[0]


def detect_devices(hass: HomeAssistant) -> dict[str, Any]:
    """Allarme, meteo, clima, energia e telecamere già presenti."""

    def is_power(s):
        return s.attributes.get("device_class") == "power" and s.attributes.get("unit_of_measurement") in ("W", "kW")

    def is_energy(s):
        return s.attributes.get("device_class") == "energy" and s.attributes.get("state_class") == "total_increasing"

    return {
        "alarm": _first(hass, "alarm_control_panel"),
        "weather": _first(hass, "weather", ("forecast_home", "home", "casa")),
        "climate": _first(hass, "climate"),
        "power": _first(hass, "sensor", POWER_HINTS, is_power),
        "energy": _first(hass, "sensor", POWER_HINTS, is_energy),
        "cameras": [s.entity_id for s in hass.states.async_all("camera")][:4],
    }


def currency_symbol(hass: HomeAssistant) -> str:
    return CURRENCY_SYMBOLS.get(hass.config.currency, hass.config.currency or "€")


def unique_url_path(hass: HomeAssistant, name: str, current: str | None = None) -> str:
    """Indirizzo della pagina (es. /aurora): minuscolo, con un trattino se serve, mai già usato."""
    base = slugify(name, separator="-") or "aurora-glass"
    if not re.search(r"[a-z]", base):
        base = "aurora-" + base
    panels = hass.data.get("frontend_panels", {})
    path, n = base, 2
    while path in panels and path != current:
        path = f"{base}-{n}"
        n += 1
    return path


def build_card_config(conf: dict[str, Any]) -> dict[str, Any]:
    """Dalla config salvata dall'integrazione alla config della scheda aurora-v3-card."""
    devices = conf.get(CONF_DEVICES, {})
    entities: dict[str, Any] = {}
    for key in ("alarm", "weather", "climate"):
        if devices.get(key):
            entities[key] = devices[key]
    energy: dict[str, Any] = {}
    if devices.get("power"):
        energy["power"] = devices["power"]
        entities["power"] = devices["power"]
    if devices.get("energy"):
        energy["energyTotal"] = devices["energy"]
    if energy:
        entities["energy"] = energy
    cams = devices.get("cameras") or []
    if cams:
        entities["cameras"] = [{"cam": c, "img": c, "live": c, "poll": 10} for c in cams]

    rooms = []
    for room in conf.get(CONF_ROOMS, []):
        rooms.append({
            "name": room.get("name") or "",
            "image": room.get("image") or guess_image(room.get("name", "")),
            "lights": list(room.get("lights") or []),
            "motion": list(room.get("motion") or []),
            "openings": list(room.get("openings") or []),
            "temperature": list(room.get("temperature") or []),
        })

    scenes = []
    sc = conf.get(CONF_SCENES, {})
    for sid in ("morning", "cinema", "dinner"):
        value = sc.get(sid) or []
        if isinstance(value, str):
            value = [value]
        ha_scene = [v for v in value if v.split(".")[0] in ("scene", "script")]
        lights = [v for v in value if v not in ha_scene]
        if ha_scene:
            scenes.append({"id": sid, "entity": ha_scene[0]})
        elif lights:
            scenes.append({"id": sid, "lights": lights})
    for sid, key, mode in (("night", "night_alarm", "armed_night"), ("away", "away_alarm", "armed_away")):
        scenes.append({"id": sid, "alarm": mode if sc.get(key, True) and devices.get("alarm") else None})

    card = {
        "language": conf.get(CONF_LANGUAGE, "auto"),
        "assets": f"{URL_BASE}/btn/",
        "rooms": rooms,
        "scenes": scenes,
        "entities": entities,
        "currency": devices.get("currency") or "€",
    }
    return card


def panel_title(conf: dict[str, Any]) -> tuple[str, str]:
    return conf.get(CONF_NAME) or "Aurora", conf.get(CONF_ICON) or "mdi:home-heart"
