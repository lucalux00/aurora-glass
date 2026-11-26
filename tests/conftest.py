"""Test di Aurora Glass con un Home Assistant vero in memoria (pytest-homeassistant-custom-component).

Le valvole del giardino sono interruttori template: si accendono e si spengono come quelle vere e possono
diventare «non disponibili», che è il caso in cui Home Assistant non dà errori ma non fa niente.
"""

from __future__ import annotations

import pytest

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component

VALVE = "switch.valvola_prato"


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    """Carica custom_components/aurora_glass."""
    yield


async def setup_valve(hass: HomeAssistant, on: bool = False, online: bool = True) -> None:
    """Una valvola finta: stato da input_boolean.valvola, disponibilità da input_boolean.valvola_online."""
    assert await async_setup_component(hass, "input_boolean", {"input_boolean": {"valvola": {}, "valvola_online": {}}})
    await hass.async_block_till_done()
    if on:
        await hass.services.async_call("input_boolean", "turn_on", {"entity_id": "input_boolean.valvola"}, blocking=True)
    if online:
        await hass.services.async_call("input_boolean", "turn_on", {"entity_id": "input_boolean.valvola_online"}, blocking=True)
    assert await async_setup_component(hass, "template", {
        "template": [{
            "switch": [{
                "name": "Valvola prato",
                "unique_id": "valvola_prato",
                "state": "{{ is_state('input_boolean.valvola', 'on') }}",
                "availability": "{{ is_state('input_boolean.valvola_online', 'on') }}",
                "turn_on": {"action": "input_boolean.turn_on", "target": {"entity_id": "input_boolean.valvola"}},
                "turn_off": {"action": "input_boolean.turn_off", "target": {"entity_id": "input_boolean.valvola"}},
            }],
        }],
    })
    await hass.async_block_till_done()


async def set_online(hass: HomeAssistant, online: bool) -> None:
    await hass.services.async_call("input_boolean", "turn_on" if online else "turn_off", {"entity_id": "input_boolean.valvola_online"}, blocking=True)
    await hass.async_block_till_done()
