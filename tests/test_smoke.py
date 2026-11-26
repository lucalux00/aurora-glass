"""La valvola finta si comporta come una vera (base per gli altri test)."""

from homeassistant.core import HomeAssistant

from .conftest import VALVE, set_online, setup_valve


async def test_valvola_finta(hass: HomeAssistant) -> None:
    await setup_valve(hass, on=True)
    assert hass.states.get(VALVE).state == "on"
    await set_online(hass, False)
    assert hass.states.get(VALVE).state == "unavailable"
    # Home Assistant con un'entità non disponibile non dà errori e non fa niente: è il caso da coprire
    await hass.services.async_call("switch", "turn_off", {"entity_id": VALVE}, blocking=True)
    await set_online(hass, True)
    assert hass.states.get(VALVE).state == "on"
