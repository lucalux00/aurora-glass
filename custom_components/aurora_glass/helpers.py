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
# per scegliere il sensore della casa intera: parole che lo indicano (peso 3 o 1) e parole che indicano altro (canali, prese, periodi)
STRONG_HINTS = ("casa", "house", "home", "total", "generale", "main", "grid", "rete", "whole")
WEAK_HINTS = ("consumo", "contatore", "meter", "consumption")
BAD_HINTS = ("channel", "canale", "_ch1", "_ch2", "elettrodomestic", "appliance", "plug", "presa", "oggi", "today", "daily",
             "giorn", "ieri", "yesterday", "mese", "month", "anno", "year", "media", "average", "avg", "lavatric", "frigo", "forno")
# dispositivi che hanno una luce solo come spia (purificatori, sensori di presenza, TV...): quella luce non è una lampada
NOT_A_LAMP_DOMAINS = ("fan", "humidifier", "vacuum", "media_player", "climate", "water_heater", "lawn_mower")
# interruttori che non sono relè di una lampada: dispositivi che fanno altro, nomi da impostazione, integrazioni di rete
NOT_A_SWITCH_DOMAINS = NOT_A_LAMP_DOMAINS + ("camera", "alarm_control_panel", "lock", "cover", "siren", "valve", "remote")
SWITCH_SKIP_WORDS = (
    "siren", "sirena", "detection", "rilevament", "stream", "record", "registra", "privacy", "notif", "protez", "protection",
    "filter", "filtro", "adguard", "pihole", "pi_hole", "vpn", "wifi", "wi-fi", "guest", "ospit", "blocco", "child", "infrared",
    "infraross", "indicator", "indicatore", "disturb", "automation", "automazion", "update", "aggiorn", "sleep", "boost", "turbo",
    "mute", "audio", "alexa", "echo", "shuffle", "repeat", "schedule", "programm", "caldaia", "irrig", "sprinkler", "valvol",
    "router", "server", "power on behav", "relay type", "anti_flicker", "eco mode",
)
# elettrodomestici: un interruttore con questi nomi non è una lampada, un sensore di potenza con questi nomi va tra gli elettrodomestici
APPLIANCE_RE = re.compile(
    r"(?:^|[^a-z])(?:tv|pc)(?:$|[^a-z])|lavatric|washing|washer|asciugatric|dryer|lavastovigl|dishwasher|frigo|fridge|freezer|congelat"
    r"|forno|oven|microonde|microwave|bimby|thermomix|friggitric|fryer|sterilizz|caff|coffee|bollitor|kettle|tostapan|toaster"
    r"|piastra|induzion|cappa|frullat|blender|boiler|scaldabagn|stufa|heater|termosif|radiator|deumid|dehumid|condizionat"
    r"|climatizzat|clima|purific|ventil|aspirap|vacuum|televis|playstation|xbox|console|computer|monitor|stampante|printer"
    r"|acquario|aquarium|asciugacapell|phon|caricator|charger|wallbox|pompa|pump"
)
# ...ma con una di queste parole è una lampada anche se collegata a una presa (piantana, albero di Natale, striscia LED)
LAMP_RE = re.compile(r"lamp|luce|luci|light|(?:^|[^a-z])led|strip|striscia|farett|abat|piantana|lume|lantern|plafonier|applique|neon|albero|natale|insegna")
# prese e multiprese (dal modello del dispositivo) e contatori di energia (Shelly EM, 3EM, Pro EM): non sono lampade
PLUG_RE = re.compile(r"plug|presa|prese|outlet|socket|power strip|multipresa|ciabatta")
METER_RE = re.compile(r"(?:^|[^a-z0-9])(?:pro\s*)?3?em(?:$|[^a-z0-9])|shem|energy meter|contatore")
SWITCH_SKIP_PLATFORMS = ("adguard", "pi_hole", "unifi", "fritz", "synology_dsm", "plex", "spotify", "mobile_app", "browser_mod",
                         "alexa_media", "hacs", "ring", "reolink", "ezviz", "frigate", "sonos", "octoprint", "proxmoxve",
                         "wake_on_lan", "homekit", "tapo_control", "onvif", "go2rtc", "backup")


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


def _entity_area(dev_reg: dr.DeviceRegistry, entry: er.RegistryEntry) -> str | None:
    if entry.area_id:
        return entry.area_id
    device = dev_reg.async_get(entry.device_id) if entry.device_id else None
    return device.area_id if device else None


def entity_label(hass: HomeAssistant, entity_id: str) -> str:
    state = hass.states.get(entity_id)
    if state and state.attributes.get("friendly_name"):
        return str(state.attributes["friendly_name"])
    return entity_id.split(".", 1)[-1].replace("_", " ")


def _device_text(device: dr.DeviceEntry | None) -> str:
    if not device:
        return ""
    return " ".join(str(x) for x in (device.model, device.name, device.name_by_user) if x).lower()


def is_appliance_switch(text: str, outlet: bool = False, device: dr.DeviceEntry | None = None) -> bool:
    """Interruttore di un elettrodomestico o di una presa (Bimby, friggitrice, presa smart...), non di una lampada.

    Una presa con un nome da lampada (piantana, albero di Natale, striscia LED) resta una lampada.
    """
    if LAMP_RE.search(text):
        return False
    return outlet or bool(APPLIANCE_RE.search(text) or PLUG_RE.search(text) or PLUG_RE.search(_device_text(device)))


def lamp_candidates(hass: HomeAssistant) -> dict[str, str | None]:
    """Tutto ciò che può essere una lampada, con la sua area (None = in nessuna area).

    Luci vere, tranne le spie di dispositivi che fanno altro (il LED di un purificatore o di un sensore
    di presenza). Interruttori dei relè (Shelly, Sonoff...), tranne quelli di telecamere, contatori di energia,
    elettrodomestici, prese e impostazioni (sirena, rilevamento, privacy, protezioni di rete...).
    """
    ent_reg = er.async_get(hass)
    dev_reg = dr.async_get(hass)
    by_device: dict[str, list[er.RegistryEntry]] = {}
    for entry in ent_reg.entities.values():
        if entry.device_id:
            by_device.setdefault(entry.device_id, []).append(entry)
    out: dict[str, str | None] = {}
    for entry in ent_reg.entities.values():
        if not _usable(entry) or entry.domain not in ("light", "switch"):
            continue
        siblings = by_device.get(entry.device_id, []) if entry.device_id else []
        domains = {e.domain for e in siblings}
        presence = any(e.domain == "binary_sensor" and _device_class(hass, e) in MOTION_CLASSES for e in siblings)
        if entry.domain == "light":
            if entry.platform == "group":   # un gruppo di luci: le singole luci ci sono già
                continue
            if "camera" not in domains and (presence or domains & set(NOT_A_LAMP_DOMAINS)):
                continue
        else:
            device = dev_reg.async_get(entry.device_id) if entry.device_id else None
            text = (entry.entity_id + " " + entity_label(hass, entry.entity_id)).lower()
            if domains & set(NOT_A_SWITCH_DOMAINS) or presence or METER_RE.search(_device_text(device)):
                continue
            if is_appliance_switch(text, _device_class(hass, entry) == "outlet", device):
                continue
            if any(w in text for w in SWITCH_SKIP_WORDS):
                continue
            if entry.platform in SWITCH_SKIP_PLATFORMS:
                continue
        out[entry.entity_id] = _entity_area(dev_reg, entry)
    # luci e interruttori scritti in YAML senza unique_id: non sono nel registro, quindi non hanno area
    for state in hass.states.async_all(("light", "switch")):
        if state.entity_id in out or ent_reg.async_get(state.entity_id) or state.attributes.get("entity_id"):
            continue   # già visto, oppure un gruppo (ha l'elenco delle sue luci)
        text = (state.entity_id + " " + str(state.attributes.get("friendly_name", ""))).lower()
        if state.domain == "switch" and (is_appliance_switch(text, state.attributes.get("device_class") == "outlet") or any(w in text for w in SWITCH_SKIP_WORDS)):
            continue
        out[state.entity_id] = None
    return out


def room_kind(text: str) -> str | None:
    """Tipo di stanza dal nome (cucina, camera...), None se il nome non lo dice."""
    low = (text or "").lower()
    for image, words in IMAGE_HINTS:
        if any(w in low for w in words):
            return image
    return None


def match_room(text: str, rooms: list[dict[str, Any]]) -> int | None:
    """Stanza adatta a una luce dal suo nome.

    Prima le parole del nome delle stanze: vince quella che compare per prima nel nome della luce
    («Balcone cucina» → balcone). Poi il tipo di stanza («Salotto» → Soggiorno), solo se una sola stanza è di quel tipo.
    """
    low = (text or "").lower()
    best, best_pos = None, len(low) + 1
    for i, room in enumerate(rooms):
        words = [w for w in re.split(r"[^a-zà-ù0-9]+", (room.get("name") or "").lower()) if len(w) >= 4 and w not in ("room", "stanza", "zona", "area")]
        for w in words:
            m = re.search(r"(^|[^a-zà-ù])" + re.escape(w), low)
            if m and m.start() < best_pos:
                best, best_pos = i, m.start()
    if best is not None:
        return best
    kind = room_kind(low)
    if kind is None:
        return None
    same = [i for i, room in enumerate(rooms) if room_kind(room.get("name", "")) == kind]
    return same[0] if len(same) == 1 else None


def detect_room(hass: HomeAssistant, area_id: str, lamps: dict[str, str | None] | None = None) -> dict[str, Any]:
    """Luci, movimento, aperture e temperatura che stanno in un'area."""
    lamps = lamp_candidates(hass) if lamps is None else lamps
    lights = [e for e, a in lamps.items() if a == area_id]
    motion, openings, temps = [], [], []
    for entry in area_entities(hass, area_id):
        domain = entry.domain
        dc = _device_class(hass, entry)
        if domain == "binary_sensor" and dc in MOTION_CLASSES:
            motion.append(entry.entity_id)
        elif (domain == "binary_sensor" and dc in OPEN_CLASSES) or domain == "lock":
            openings.append(entry.entity_id)
        elif domain == "sensor" and dc == "temperature":
            temps.append(entry.entity_id)
    return {"lights": sorted(lights), "motion": sorted(motion), "openings": sorted(openings), "temperature": sorted(temps)[:1]}


def suggested_areas(hass: HomeAssistant) -> list[str]:
    """Aree da proporre come stanze: hanno una lampada o un sensore, o il nome di una lampada senza area le richiama."""
    lamps = lamp_candidates(hass)
    areas = ar.async_get(hass).async_list_areas()
    loose = [entity_label(hass, e) + " " + e for e, a in lamps.items() if a is None]
    out = []
    for area in areas:
        room = detect_room(hass, area.id, lamps)
        if room["lights"] or room["motion"] or room["temperature"] or room["openings"]:
            out.append(area.id)
            continue
        probe = [{"name": area.name, "image": guess_image(area.name)}]
        if any(match_room(text, probe) == 0 for text in loose):
            out.append(area.id)
    return out


def area_name(hass: HomeAssistant, area_id: str) -> str:
    area = ar.async_get(hass).async_get_area(area_id)
    return area.name if area else area_id


def _first(hass: HomeAssistant, domain: str, prefer: tuple[str, ...] = (), test=None) -> str | None:
    found = [s for s in hass.states.async_all(domain) if not test or test(s)]
    if not found:
        return None
    for state in found:
        if any(p in state.entity_id for p in prefer):
            return state.entity_id
    return found[0].entity_id


def _best_meter(hass: HomeAssistant, test) -> str | None:
    """Il sensore che più probabilmente misura tutta la casa (nome con casa/totale, non un canale, una presa o un periodo)."""
    best, best_score = None, -99
    for state in hass.states.async_all("sensor"):
        if not test(state):
            continue
        text = (state.entity_id + " " + str(state.attributes.get("friendly_name", ""))).lower()
        score = 3 * sum(h in text for h in STRONG_HINTS) + sum(h in text for h in WEAK_HINTS) - 4 * sum(h in text for h in BAD_HINTS)
        if state.state in ("unknown", "unavailable"):
            score -= 5
        if score > best_score:
            best, best_score = state.entity_id, score
    return best


def as_list(value: Any) -> list[str]:
    """Un'entità o un elenco di entità (le versioni fino alla 3.4 salvavano un solo climatizzatore)."""
    if not value:
        return []
    return [v for v in value if v] if isinstance(value, list) else [value]


def detect_climates(hass: HomeAssistant) -> list[str]:
    """Climatizzatori e termostati che rispondono, uno per dispositivo.

    Quelli comandati a infrarossi (assumed_state: Home Assistant ricorda solo l'ultimo comando, non sa se sono
    accesi) entrano solo se non c'è nient'altro: spesso sono un secondo telecomando dello stesso climatizzatore.
    """
    ent_reg = er.async_get(hass)
    real: list[str] = []
    assumed: list[str] = []
    devices: set[str] = set()
    for state in hass.states.async_all("climate"):
        if state.state in ("unavailable", "unknown"):
            continue
        entry = ent_reg.async_get(state.entity_id)
        if entry and not _usable(entry):
            continue
        if entry and entry.device_id:
            if entry.device_id in devices:
                continue
            devices.add(entry.device_id)
        (assumed if state.attributes.get("assumed_state") else real).append(state.entity_id)
    return real or assumed[:1]


def appliance_key(text: str) -> str:
    """Nome dell'elettrodomestico senza «potenza», «power», numeri e simboli: serve a non proporlo due volte."""
    low = re.sub(r"potenza|power|meter|consumo|consumption|watt|_\d+$", " ", (text or "").lower())
    return re.sub(r"[^a-zà-ù]+", "", low)


def detect_appliances(hass: HomeAssistant, main_power: str | None = None) -> list[str]:
    """Sensori di potenza degli elettrodomestici: prese smart e relè con il nome di un elettrodomestico.

    Esclusi il contatore di tutta la casa (e gli altri canali dello stesso contatore), i sensori calcolati
    senza dispositivo e quelli che adesso non rispondono. Un solo sensore per nome (lavatrice con due integrazioni).
    """
    ent_reg = er.async_get(hass)
    dev_reg = dr.async_get(hass)
    main_entry = ent_reg.async_get(main_power) if main_power else None
    main_device = main_entry.device_id if main_entry else None
    out: list[str] = []
    seen: set[str] = set()
    for state in hass.states.async_all("sensor"):
        attrs = state.attributes
        if attrs.get("device_class") != "power" or attrs.get("unit_of_measurement") not in ("W", "kW"):
            continue
        if state.entity_id == main_power or state.state in ("unavailable", "unknown"):
            continue
        entry = ent_reg.async_get(state.entity_id)
        # la potenza di molte prese Zigbee è «diagnostica»: va bene lo stesso, basta che non sia disattivata o nascosta
        if not entry or not entry.device_id or entry.disabled_by or entry.hidden_by or entry.device_id == main_device:
            continue
        device = dev_reg.async_get(entry.device_id)
        if METER_RE.search(_device_text(device)):
            continue
        text = (state.entity_id + " " + str(attrs.get("friendly_name", ""))).lower()
        if LAMP_RE.search(text) or not (APPLIANCE_RE.search(text) or PLUG_RE.search(text + " " + _device_text(device))):
            continue
        key = appliance_key(state.entity_id.split(".", 1)[-1]) if re.search(r"[0-9a-f]{8}", text) else appliance_key(str(attrs.get("friendly_name") or state.entity_id))
        if key in seen:
            continue
        seen.add(key)
        out.append(state.entity_id)
    return out[:12]


def detect_devices(hass: HomeAssistant) -> dict[str, Any]:
    """Allarme, meteo, clima, energia, elettrodomestici e telecamere già presenti."""

    def is_power(s):
        return s.attributes.get("device_class") == "power" and s.attributes.get("unit_of_measurement") in ("W", "kW")

    def is_energy(s):
        return s.attributes.get("device_class") == "energy" and s.attributes.get("state_class") == "total_increasing"

    power = _best_meter(hass, is_power)
    return {
        "alarm": _first(hass, "alarm_control_panel"),
        "weather": _first(hass, "weather", ("forecast_home", "home", "casa")),
        "climate": detect_climates(hass),
        "power": power,
        "energy": _best_meter(hass, is_energy),
        "appliances": detect_appliances(hass, power),
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


def build_card_config(conf: dict[str, Any], entry_id: str | None = None) -> dict[str, Any]:
    """Dalla config salvata dall'integrazione alla config della scheda aurora-v3-card.

    entry_id: la voce dell'integrazione; con questo la plancia permette agli amministratori di cambiare
    stanze e dispositivi senza passare dalle impostazioni.
    """
    devices = conf.get(CONF_DEVICES, {})
    entities: dict[str, Any] = {}
    for key in ("alarm", "weather"):
        if devices.get(key):
            entities[key] = devices[key]
    climates = as_list(devices.get("climate"))
    if climates:
        entities["climate"] = climates[0]
        entities["climates"] = climates
    energy: dict[str, Any] = {}
    if devices.get("power"):
        energy["power"] = devices["power"]
        entities["power"] = devices["power"]
    if devices.get("energy"):
        energy["energyTotal"] = devices["energy"]
    appliances = as_list(devices.get("appliances"))
    if appliances:
        energy["appliances"] = [{"p": a} for a in appliances]
    if energy:
        entities["energy"] = energy
    cams = devices.get("cameras") or []
    if cams:
        entities["cameras"] = [{"cam": c, "img": c, "live": c, "poll": 10} for c in cams]

    rooms = []
    for room in conf.get(CONF_ROOMS, []):
        rooms.append({
            "name": room.get("name") or "",
            "area": room.get("area_id"),
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
    if entry_id:
        card["entry_id"] = entry_id
    return card


def panel_title(conf: dict[str, Any]) -> tuple[str, str]:
    return conf.get(CONF_NAME) or "Aurora", conf.get(CONF_ICON) or "mdi:home-heart"
