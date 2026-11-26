"""Tapparelle e tende (3.9.0): trovate nell'area, proposte dalla procedura guidata, salvate fino alla scheda."""

from __future__ import annotations

from unittest.mock import patch

from pytest_homeassistant_custom_component.common import MockConfigEntry

from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.helpers import area_registry as ar, entity_registry as er
from homeassistant.setup import async_setup_component

from custom_components.aurora_glass.const import DOMAIN
from custom_components.aurora_glass.editor import async_setup_editor
from custom_components.aurora_glass.helpers import build_card_config, detect_room, suggested_areas

COVER = "cover.tapparella_soggiorno"


async def _cover_in_area(hass: HomeAssistant) -> str:
    """Una tapparella template con posizione, assegnata all'area Soggiorno (come la assegna l'utente in HA)."""
    area = ar.async_get(hass).async_create("Soggiorno")
    assert await async_setup_component(hass, "input_number", {"input_number": {"pos": {"min": 0, "max": 100, "initial": 40}}})
    set_pos = {"action": "input_number.set_value", "target": {"entity_id": "input_number.pos"}}
    assert await async_setup_component(hass, "template", {"template": [{"cover": [{
        "name": "Tapparella soggiorno",
        "unique_id": "tapparella_soggiorno",
        "device_class": "shutter",
        "position": "{{ states('input_number.pos') | int }}",
        "open_cover": {**set_pos, "data": {"value": 100}},
        "close_cover": {**set_pos, "data": {"value": 0}},
        "stop_cover": [],
        "set_cover_position": {**set_pos, "data": {"value": "{{ position }}"}},
    }]}]})
    await hass.async_block_till_done()
    er.async_get(hass).async_update_entity(COVER, area_id=area.id)
    return area.id


async def test_tapparella_trovata_nell_area(hass: HomeAssistant) -> None:
    area_id = await _cover_in_area(hass)
    assert hass.states.get(COVER).attributes["current_position"] == 40
    assert detect_room(hass, area_id)["covers"] == [COVER]
    assert area_id in suggested_areas(hass)   # un'area con sole tapparelle è comunque una stanza


async def test_procedura_guidata_propone_e_salva(hass: HomeAssistant) -> None:
    area_id = await _cover_in_area(hass)
    # niente pagina vera: si prova la procedura, non il frontend
    hass.config.components.update({"frontend", "http", "panel_custom", "websocket_api"})
    with patch("custom_components.aurora_glass.async_setup", return_value=True), \
            patch("custom_components.aurora_glass.async_setup_entry", return_value=True):
        r = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
        assert r["step_id"] == "user"
        r = await hass.config_entries.flow.async_configure(r["flow_id"], {"name": "Aurora", "icon": "mdi:home-heart", "language": "it"})
        assert r["step_id"] == "areas"
        r = await hass.config_entries.flow.async_configure(r["flow_id"], {"areas": [area_id], "extra_rooms": 0})
        assert r["step_id"] == "room"
        field = next(k for k in r["data_schema"].schema if str(k) == "covers")
        assert field.description == {"suggested_value": [COVER]}, "la tapparella dell'area va proposta"
        r = await hass.config_entries.flow.async_configure(r["flow_id"], {"name": "Soggiorno", "image": "salotto", "covers": [COVER]})
        while r["type"] == FlowResultType.FORM:
            r = await hass.config_entries.flow.async_configure(r["flow_id"], {"currency": "€"} if r["step_id"] == "devices" else {})
        assert r["type"] == FlowResultType.CREATE_ENTRY
        entry = r["result"]
    card = build_card_config({**entry.data, **entry.options}, entry.entry_id)
    assert card["rooms"][0]["covers"] == [COVER]


async def test_stanze_vecchie_ricevono_le_tapparelle(hass: HomeAssistant) -> None:
    """Configura su una plancia salvata prima della 3.9.0: la tapparella dell'area viene proposta."""
    area_id = await _cover_in_area(hass)
    entry = MockConfigEntry(domain=DOMAIN, data={"name": "Aurora", "url_path": "aurora"},
                            options={"rooms": [{"area_id": area_id, "name": "Soggiorno", "image": "salotto", "lights": [], "motion": [], "openings": [], "temperature": []}],
                                     "devices": {"currency": "€"}, "scenes": {}})
    entry.add_to_hass(hass)
    hass.config.components.update({"frontend", "http", "panel_custom", "websocket_api"})
    with patch("custom_components.aurora_glass.async_setup", return_value=True),             patch("custom_components.aurora_glass.async_setup_entry", return_value=True):
        r = await hass.config_entries.options.async_init(entry.entry_id)
        assert r["type"] == FlowResultType.MENU
        r = await hass.config_entries.options.async_configure(r["flow_id"], {"next_step_id": "areas"})
        r = await hass.config_entries.options.async_configure(r["flow_id"], {"areas": [area_id], "extra_rooms": 0})
    assert r["step_id"] == "room"
    field = next(k for k in r["data_schema"].schema if str(k) == "covers")
    assert field.description == {"suggested_value": [COVER]}


async def test_editor_salva_le_tapparelle(hass: HomeAssistant, hass_ws_client) -> None:
    entry = MockConfigEntry(domain=DOMAIN, data={"url_path": "aurora"}, options={"rooms": [{"name": "Soggiorno"}], "devices": {}, "scenes": {}})
    entry.add_to_hass(hass)
    async_setup_editor(hass)
    client = await hass_ws_client(hass)
    rooms = [{"name": "Soggiorno", "lights": [], "covers": [COVER, "cover.gruppo_tapparelle"]}]
    await client.send_json({"id": 1, "type": "aurora_glass/config/save", "entry_id": entry.entry_id, "rooms": rooms, "devices": {}, "scenes": {}})
    assert (await client.receive_json())["success"]
    assert build_card_config(entry.options, entry.entry_id)["rooms"][0]["covers"] == [COVER, "cover.gruppo_tapparelle"]
    await client.send_json({"id": 2, "type": "aurora_glass/config/save", "entry_id": entry.entry_id,
                            "rooms": [{"name": "Soggiorno", "covers": ["light.non_una_tapparella", "non valido"]}], "devices": {}, "scenes": {}})
    assert not (await client.receive_json())["success"]
