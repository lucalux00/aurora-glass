"""Timer dell'irrigazione: la valvola si chiude davvero, anche se non risponde o se Home Assistant si riavvia."""

from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed

from homeassistant.const import EVENT_HOMEASSISTANT_FINAL_WRITE
from homeassistant.core import CoreState, HomeAssistant
from homeassistant.util import dt as dt_util

from custom_components.aurora_glass import actions
from custom_components.aurora_glass.const import DOMAIN

from .conftest import VALVE, set_online, setup_valve


async def _setup(hass: HomeAssistant) -> actions.Irrigation:
    """Una plancia con la valvola nella zona 1 del giardino, e i comandi dell'irrigazione registrati."""
    MockConfigEntry(domain=DOMAIN, data={"url_path": "aurora"}, options={"devices": {"garden_z1_sw": VALVE}}).add_to_hass(hass)
    hass.data.setdefault(DOMAIN, {})
    await actions.async_setup_actions(hass)
    return hass.data[DOMAIN]["irrigation"]


async def _ws(client, n: int, **payload):
    await client.send_json({"id": n, **payload})
    return await client.receive_json()


def _later(hass: HomeAssistant, start, seconds: float) -> None:
    async_fire_time_changed(hass, start + timedelta(seconds=seconds))


async def test_si_chiude_allo_scadere(hass: HomeAssistant, hass_ws_client) -> None:
    await setup_valve(hass)
    irr = await _setup(hass)
    client = await hass_ws_client(hass)
    t0 = dt_util.utcnow()
    msg = await _ws(client, 1, type="aurora_glass/irrigation/start", entity_id=VALVE, minutes=1)
    assert msg["success"], msg
    assert hass.states.get(VALVE).state == "on"
    assert VALVE in irr.ends
    _later(hass, t0, 61)
    await hass.async_block_till_done()
    assert hass.states.get(VALVE).state == "off"
    assert not irr.ends and not irr.closing


async def test_valvola_che_non_risponde_poi_torna(hass: HomeAssistant, hass_ws_client) -> None:
    """Il caso del difetto della 3.8.2: allo scadere la valvola non è raggiungibile, HA non dà errore e non fa niente."""
    await setup_valve(hass)
    irr = await _setup(hass)
    client = await hass_ws_client(hass)
    t0 = dt_util.utcnow()
    assert (await _ws(client, 1, type="aurora_glass/irrigation/start", entity_id=VALVE, minutes=1))["success"]
    await set_online(hass, False)
    with patch.object(actions.persistent_notification, "async_create") as create, \
            patch.object(actions.persistent_notification, "async_dismiss") as dismiss:
        _later(hass, t0, 61)
        await hass.async_block_till_done()
        assert VALVE in irr.closing, "la valvola deve restare da chiudere"
        listed = await _ws(client, 2, type="aurora_glass/irrigation/list")
        assert listed["result"]["closing"] == [VALVE]
        assert listed["result"]["timers"] == {}
        for i in range(1, 5):   # un tentativo ogni 30 secondi
            _later(hass, t0, 61 + 30 * i + 1)
            await hass.async_block_till_done()
        assert irr.closing[VALVE] >= actions.NOTIFY_AFTER
        assert create.call_count == 1, "una sola notifica, non una per tentativo"
        assert "Valvola prato" in create.call_args.args[1]
        # torna raggiungibile ancora aperta: si chiude subito, senza aspettare il tentativo successivo
        await set_online(hass, True)
        await hass.async_block_till_done()
        assert hass.states.get(VALVE).state == "off"
        assert VALVE not in irr.closing
        dismiss.assert_called_once()


async def test_riavvio_con_timer_scaduto(hass: HomeAssistant, hass_storage) -> None:
    """Il timer è scaduto mentre HA era spento: Aurora parte prima della valvola e la chiude solo a HA partito."""
    hass_storage[actions.STORE_KEY] = {
        "version": 1, "minor_version": 1, "key": actions.STORE_KEY,
        "data": {"timers": {VALVE: (dt_util.utcnow() - timedelta(minutes=5)).isoformat()}},
    }
    hass.set_state(CoreState.not_running)
    irr = await _setup(hass)
    assert VALVE in irr.closing and not irr.started
    await setup_valve(hass, on=True)   # l'integrazione della valvola si carica dopo Aurora
    await hass.async_start()
    await hass.async_block_till_done()
    assert hass.states.get(VALVE).state == "off"
    assert not irr.closing


async def test_avvio_rifiutato_se_non_disponibile(hass: HomeAssistant, hass_ws_client) -> None:
    await setup_valve(hass, online=False)
    irr = await _setup(hass)
    client = await hass_ws_client(hass)
    msg = await _ws(client, 1, type="aurora_glass/irrigation/start", entity_id=VALVE, minutes=5)
    assert not msg["success"]
    assert msg["error"]["code"] == "unavailable"
    assert not irr.ends


async def test_solo_le_zone_del_giardino(hass: HomeAssistant, hass_ws_client) -> None:
    await setup_valve(hass)
    await _setup(hass)
    client = await hass_ws_client(hass)
    msg = await _ws(client, 1, type="aurora_glass/irrigation/start", entity_id="input_boolean.valvola", minutes=5)
    assert not msg["success"]
    assert msg["error"]["code"] == "not_a_zone"


async def test_ferma_e_chiusura_da_fuori(hass: HomeAssistant, hass_ws_client) -> None:
    await setup_valve(hass)
    irr = await _setup(hass)
    client = await hass_ws_client(hass)
    assert (await _ws(client, 1, type="aurora_glass/irrigation/start", entity_id=VALVE, minutes=10))["success"]
    # chiusa da un'altra parte (pulsante, automazione): il timer non serve più
    await hass.services.async_call("switch", "turn_off", {"entity_id": VALVE}, blocking=True)
    await hass.async_block_till_done()
    assert VALVE not in irr.ends
    # riaperta e fermata dalla plancia
    assert (await _ws(client, 2, type="aurora_glass/irrigation/start", entity_id=VALVE, minutes=10))["success"]
    msg = await _ws(client, 3, type="aurora_glass/irrigation/stop", entity_id=VALVE)
    assert msg["success"], msg
    assert msg["result"] == {"stopped": True, "closed": True}
    assert hass.states.get(VALVE).state == "off"
    assert not irr.ends and not irr.closing


async def test_fermata_con_valvola_non_disponibile(hass: HomeAssistant, hass_ws_client) -> None:
    await setup_valve(hass)
    irr = await _setup(hass)
    client = await hass_ws_client(hass)
    assert (await _ws(client, 1, type="aurora_glass/irrigation/start", entity_id=VALVE, minutes=10))["success"]
    await set_online(hass, False)
    msg = await _ws(client, 2, type="aurora_glass/irrigation/stop", entity_id=VALVE)
    assert msg["result"] == {"stopped": True, "closed": False}
    assert VALVE in irr.closing
    await set_online(hass, True)
    await hass.async_block_till_done()
    assert hass.states.get(VALVE).state == "off"
    assert not irr.closing


async def test_riaperta_mentre_si_chiudeva(hass: HomeAssistant, hass_ws_client) -> None:
    await setup_valve(hass)
    irr = await _setup(hass)
    client = await hass_ws_client(hass)
    assert (await _ws(client, 1, type="aurora_glass/irrigation/start", entity_id=VALVE, minutes=10))["success"]
    await set_online(hass, False)
    await _ws(client, 2, type="aurora_glass/irrigation/stop", entity_id=VALVE)
    assert VALVE in irr.closing
    await set_online(hass, True)
    await hass.async_block_till_done()
    msg = await _ws(client, 3, type="aurora_glass/irrigation/start", entity_id=VALVE, minutes=10)
    assert msg["success"]
    assert VALVE in irr.ends and VALVE not in irr.closing
    assert hass.states.get(VALVE).state == "on"


async def test_entita_che_non_esiste_piu(hass: HomeAssistant) -> None:
    irr = await _setup(hass)
    with patch.object(actions, "SLOW_AFTER", 2), patch.object(actions, "NOTIFY_AFTER", 99):
        t0 = dt_util.utcnow()
        await irr.async_request_close("switch.non_esiste")
        for i in range(1, 4):
            _later(hass, t0, 30 * i + 1)
            await hass.async_block_till_done()
    assert "switch.non_esiste" not in irr.closing


async def test_lo_stato_resta_in_archivio(hass: HomeAssistant, hass_ws_client, hass_storage) -> None:
    await setup_valve(hass)
    await _setup(hass)
    client = await hass_ws_client(hass)
    assert (await _ws(client, 1, type="aurora_glass/irrigation/start", entity_id=VALVE, minutes=10))["success"]
    await set_online(hass, False)
    await _ws(client, 2, type="aurora_glass/irrigation/stop", entity_id=VALVE)
    hass.bus.async_fire(EVENT_HOMEASSISTANT_FINAL_WRITE)   # come allo spegnimento: si scrive il salvataggio in attesa
    await hass.async_block_till_done()
    assert hass_storage[actions.STORE_KEY]["data"]["closing"] == [VALVE]
