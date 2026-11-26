"""«Stanze e dispositivi»: quello che si salva dalla plancia arriva davvero alla scheda (errore della 3.8.0)."""

from __future__ import annotations

from pytest_homeassistant_custom_component.common import MockConfigEntry

from homeassistant.core import HomeAssistant

from custom_components.aurora_glass.const import DOMAIN
from custom_components.aurora_glass.editor import async_setup_editor
from custom_components.aurora_glass.helpers import build_card_config


def _entry(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(
        domain=DOMAIN,
        data={"url_path": "aurora"},
        options={"name": "Aurora", "rooms": [{"name": "Salotto", "lights": []}], "devices": {"currency": "€"}, "scenes": {}},
    )
    entry.add_to_hass(hass)
    return entry


ROOMS = [
    {"name": "Salotto", "area_id": "salotto", "lights": ["light.salotto"], "motion": ["binary_sensor.movimento"],
     "openings": ["binary_sensor.finestra"], "temperature": ["sensor.temperatura"]},
    {"name": "Camera", "lights": ["light.camera"]},
]
DEVICES = {
    "alarm": "alarm_control_panel.casa", "alarms": ["alarm_control_panel.arlo"], "weather": "weather.casa",
    "climate": ["climate.salotto"], "power": "sensor.potenza", "energy": "sensor.energia", "appliances": ["sensor.lavatrice"],
    "cameras": ["camera.ingresso"], "vacuums": ["vacuum.robot", "lawn_mower.prato"],
    "garden_z1_sw": "switch.valvola_prato", "garden_z1_moist": "sensor.umidita_prato", "garden_z2_sw": "valve.siepe",
    "weather_ai": "input_text.frase_meteo", "ws_temp_out": "sensor.esterno", "ws_gust": "sensor.raffica",
    "server_cpu": "sensor.system_monitor_processor_use", "server_temp": "sensor.system_monitor_processor_temperature",
    "ups_battery": "sensor.ups_batteria", "ups_runtime": "sensor.ups_autonomia",
}


async def test_salvataggio_arriva_alla_scheda(hass: HomeAssistant, hass_ws_client) -> None:
    entry = _entry(hass)
    async_setup_editor(hass)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "aurora_glass/config/save", "entry_id": entry.entry_id,
                            "rooms": ROOMS, "devices": DEVICES, "scenes": {"morning": ["light.salotto"]}})
    msg = await client.receive_json()
    assert msg["success"], msg

    card = build_card_config({**entry.data, **entry.options}, entry.entry_id)
    assert [r["name"] for r in card["rooms"]] == ["Salotto", "Camera"]
    assert card["rooms"][0]["motion"] == ["binary_sensor.movimento"]
    assert card["rooms"][1]["image"] == "camera"   # immagine scelta dal nome
    ent = card["entities"]
    assert ent["alarm"] == "alarm_control_panel.casa" and ent["alarms"] == ["alarm_control_panel.arlo"]
    assert ent["climates"] == ["climate.salotto"]
    assert ent["energy"]["appliances"] == [{"p": "sensor.lavatrice"}]
    assert ent["vacuums"] == ["vacuum.robot", "lawn_mower.prato"] and ent["vacuum"] == "vacuum.robot"
    assert ent["weather_ai"] == "input_text.frase_meteo"
    assert ent["weather_station"] == {"temp_out": "sensor.esterno", "gust": "sensor.raffica"}
    assert ent["server"] == {"cpu": "sensor.system_monitor_processor_use", "temp": "sensor.system_monitor_processor_temperature"}
    assert ent["ups"] == {"battery": "sensor.ups_batteria", "runtime": "sensor.ups_autonomia"}
    assert card["garden"]["zones"] == [
        {"switch": "switch.valvola_prato", "moisture": "sensor.umidita_prato"},
        {"switch": "valve.siepe", "moisture": None},
    ]
    assert card["entry_id"] == entry.entry_id

    # e la plancia rilegge le stesse scelte
    await client.send_json({"id": 2, "type": "aurora_glass/config", "entry_id": entry.entry_id})
    back = (await client.receive_json())["result"]
    assert back["devices"]["garden_z2_sw"] == "valve.siepe"
    assert back["rooms"][0]["temperature"] == ["sensor.temperatura"]


async def test_valori_non_validi_rifiutati(hass: HomeAssistant, hass_ws_client) -> None:
    entry = _entry(hass)
    async_setup_editor(hass)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "aurora_glass/config/save", "entry_id": entry.entry_id,
                            "rooms": [{"name": "Salotto", "lights": ["non è un entity_id"]}], "devices": {}, "scenes": {}})
    msg = await client.receive_json()
    assert not msg["success"]
    assert entry.options["rooms"] == [{"name": "Salotto", "lights": []}]   # niente salvato


async def test_solo_amministratori(hass: HomeAssistant, hass_ws_client, hass_read_only_access_token) -> None:
    entry = _entry(hass)
    async_setup_editor(hass)
    client = await hass_ws_client(hass, hass_read_only_access_token)
    await client.send_json({"id": 1, "type": "aurora_glass/config", "entry_id": entry.entry_id})
    msg = await client.receive_json()
    assert not msg["success"] and msg["error"]["code"] == "unauthorized"
    await client.send_json({"id": 2, "type": "aurora_glass/config/save", "entry_id": entry.entry_id, "rooms": ROOMS, "devices": {}, "scenes": {}})
    msg = await client.receive_json()
    assert not msg["success"] and msg["error"]["code"] == "unauthorized"
