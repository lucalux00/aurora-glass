"""Aurora Glass: la dashboard animata come pagina della barra laterale di Home Assistant.

Ogni voce dell'integrazione è una plancia: una pagina nella barra laterale con il nome
scelto nella procedura guidata, che mostra la scheda aurora-v3-card con stanze, luci e
sensori configurati. La scheda resta anche disponibile per le plance normali
(type: custom:aurora-v3-card).
"""

from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .const import CONF_URL_PATH, DOMAIN, PANEL_ELEMENT, URL_BASE, VERSION
from .editor import async_setup_editor
from .helpers import build_card_config, panel_title
from .packs import async_setup_packs

_LOGGER = logging.getLogger(__name__)
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)
FRONTEND_DIR = Path(__file__).parent / "frontend"
MODULE_URL = f"{URL_BASE}/aurora-v3.js?v={VERSION}"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    await _async_register_frontend(hass)
    # pacchetti scaricati da Configura → Pacchetti (vedi packs.py)
    if "packs" not in hass.data.get(DOMAIN, {}):
        await async_setup_packs(hass)
    # «Stanze e dispositivi» nella plancia (vedi editor.py)
    if not hass.data[DOMAIN].get("editor"):
        async_setup_editor(hass)
        hass.data[DOMAIN]["editor"] = True
    return True


async def _async_register_frontend(hass: HomeAssistant) -> None:
    """File della scheda e immagini su /aurora_glass/, e la scheda caricata in tutte le plance."""
    if hass.data.get(DOMAIN, {}).get("frontend"):
        return
    await hass.http.async_register_static_paths([StaticPathConfig(URL_BASE, str(FRONTEND_DIR), False)])
    frontend.add_extra_js_url(hass, MODULE_URL)
    hass.data.setdefault(DOMAIN, {})["frontend"] = True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    await _async_register_frontend(hass)
    await _async_register_panel(hass, entry)
    entry.async_on_unload(entry.add_update_listener(_async_updated))
    return True


async def _async_register_panel(hass: HomeAssistant, entry: ConfigEntry) -> None:
    conf = {**entry.data, **entry.options}
    title, icon = panel_title(conf)
    url_path = entry.data[CONF_URL_PATH]
    if url_path in hass.data.get(frontend.DATA_PANELS, {}):
        frontend.async_remove_panel(hass, url_path)
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=url_path,
        webcomponent_name=PANEL_ELEMENT,
        sidebar_title=title,
        sidebar_icon=icon,
        module_url=MODULE_URL,
        config={"card": build_card_config(conf, entry.entry_id)},
        require_admin=False,
    )
    _LOGGER.debug("Aurora Glass: pagina /%s registrata", url_path)


async def _async_updated(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Dopo «Configura»: la pagina viene registrata di nuovo con le scelte nuove."""
    await _async_register_panel(hass, entry)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    frontend.async_remove_panel(hass, entry.data[CONF_URL_PATH])
    return True
