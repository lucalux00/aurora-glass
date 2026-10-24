"""Pacchetti di Aurora Glass: catalogo, scaricamento, attivazione, rimozione e dati.

Un pacchetto è uno zip con pack.json (id, nome, versione, glass_minima) e pack.js, più
eventuali stili e immagini. Si scarica dal catalogo (catalogo.json), si controlla con lo
sha256 scritto nel catalogo e finisce in /config/aurora_glass/pacchetti/<id>/.
I pacchetti attivi vengono caricati in tutte le pagine di Home Assistant (come la scheda)
e si agganciano da soli alle plance Aurora aperte.

Catalogo: quello pubblicato su domotikpro.it (i pacchetti passano dal sito). Se esiste /config/aurora_glass/catalogo.json si usa
quello (installazione senza internet, prove dei pacchetti nuovi).
"""

from __future__ import annotations

import asyncio
import hashlib
import io
import json
import logging
import re
import shutil
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any

import voluptuous as vol

from homeassistant.components import frontend, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.storage import Store

from .const import DOMAIN, VERSION

_LOGGER = logging.getLogger(__name__)

PACKS_URL = "/aurora_glass_pacchetti"
CATALOG_URL = "https://domotikpro.it/aurora-glass/pacchetti/catalogo.json"
STORE_KEY = f"{DOMAIN}.pacchetti"
DATA_KEY = f"{DOMAIN}.pacchetti_dati"
ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,39}$")
ALLOWED = {".js", ".css", ".json", ".png", ".gif", ".webp", ".jpg", ".jpeg", ".svg", ".woff2", ".txt", ".md"}
MAX_ZIP = 25 * 1024 * 1024
MAX_FILES = 500
MAX_DATA = 256 * 1024

MSG = {
    "it": {
        "catalog": "Non riesco a leggere il catalogo dei pacchetti ({e}).",
        "catalog_bad": "Il catalogo dei pacchetti non è valido.",
        "download": "Scaricamento di «{n}» non riuscito ({e}).",
        "too_big": "Il pacchetto «{n}» è troppo grande.",
        "checksum": "Il file di «{n}» non corrisponde a quello del catalogo: non lo installo.",
        "zip": "Il pacchetto «{n}» non è valido ({e}).",
        "glass": "«{n}» richiede Aurora Glass {v} o più recente: aggiorna prima Aurora Glass da HACS.",
    },
    "en": {
        "catalog": "Can't read the pack catalog ({e}).",
        "catalog_bad": "The pack catalog is not valid.",
        "download": "Download of “{n}” failed ({e}).",
        "too_big": "The pack “{n}” is too large.",
        "checksum": "The file of “{n}” doesn't match the catalog: not installing it.",
        "zip": "The pack “{n}” is not valid ({e}).",
        "glass": "“{n}” needs Aurora Glass {v} or newer: update Aurora Glass from HACS first.",
    },
}


class PackError(Exception):
    """Errore da mostrare così com'è nella schermata Pacchetti."""


def version_tuple(v: Any) -> tuple[int, ...]:
    out = []
    for part in str(v or "0").split("."):
        m = re.match(r"\d+", part)
        out.append(int(m.group()) if m else 0)
    return tuple(out)


def lang_of(hass: HomeAssistant) -> str:
    return "it" if str(hass.config.language or "").lower().startswith("it") else "en"


class PackManager:
    """Pacchetti installati (nell'archivio di Home Assistant) e loro file."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.dir = Path(hass.config.path("aurora_glass", "pacchetti"))
        self.local_catalog = Path(hass.config.path("aurora_glass", "catalogo.json"))
        self._store: Store = Store(hass, 1, STORE_KEY)
        self._data_store: Store = Store(hass, 1, DATA_KEY)
        self.installed: dict[str, dict[str, Any]] = {}
        self.data: dict[str, Any] = {}
        self._urls: dict[str, str] = {}
        self._lock = asyncio.Lock()

    def _msg(self, key: str, **kw: Any) -> str:
        return MSG[lang_of(self.hass)][key].format(**kw)

    async def async_load(self) -> None:
        stored = await self._store.async_load() or {}
        self.installed = dict(stored.get("installed", {}))
        self.data = dict((await self._data_store.async_load() or {}).get("packs", {}))
        await self.hass.async_add_executor_job(lambda: self.dir.mkdir(parents=True, exist_ok=True))
        await self.hass.http.async_register_static_paths([StaticPathConfig(PACKS_URL, str(self.dir), False)])
        for pid, info in list(self.installed.items()):
            if await self.hass.async_add_executor_job((self.dir / pid / "pack.js").is_file):
                self._activate(pid, info.get("version", "0"))
            else:
                _LOGGER.warning("Aurora Glass: il pacchetto %s non ha più i suoi file, lo tolgo dall'elenco", pid)
                self.installed.pop(pid)
                await self._save()

    async def _save(self) -> None:
        await self._store.async_save({"installed": self.installed})

    @callback
    def _activate(self, pid: str, version: str) -> None:
        self._deactivate(pid)
        url = f"{PACKS_URL}/{pid}/pack.js?v={version}"
        frontend.add_extra_js_url(self.hass, url)
        self._urls[pid] = url
        _LOGGER.debug("Aurora Glass: pacchetto %s %s attivo", pid, version)

    @callback
    def _deactivate(self, pid: str) -> None:
        url = self._urls.pop(pid, None)
        if url:
            frontend.remove_extra_js_url(self.hass, url)

    # ------------------------------------------------------------------ catalogo
    async def async_catalog(self) -> list[dict[str, Any]]:
        local = await self.hass.async_add_executor_job(self.local_catalog.is_file)
        try:
            if local:
                raw = await self.hass.async_add_executor_job(self.local_catalog.read_text, "utf-8")
            else:
                session = async_get_clientsession(self.hass)
                async with asyncio.timeout(20):
                    resp = await session.get(CATALOG_URL)
                    resp.raise_for_status()
                    raw = await resp.text()
            data = json.loads(raw)
        except (OSError, ValueError, TimeoutError) as err:
            raise PackError(self._msg("catalog", e=err)) from err
        except Exception as err:  # errori di rete di aiohttp
            raise PackError(self._msg("catalog", e=err)) from err
        packs = data.get("pacchetti") if isinstance(data, dict) else None
        if not isinstance(packs, list):
            raise PackError(self._msg("catalog_bad"))
        out = []
        for p in packs:
            if not isinstance(p, dict) or not ID_RE.match(str(p.get("id", ""))) or not p.get("url") or not p.get("sha256"):
                continue
            url = str(p["url"])
            # dal catalogo pubblico solo indirizzi https; quello locale può puntare anche a un server di prova
            if not local and not url.startswith("https://"):
                continue
            out.append(p)
        return out

    # ------------------------------------------------------------------ installazione
    async def async_install(self, entry: dict[str, Any]) -> None:
        pid, name = entry["id"], entry.get("nome") or entry["id"]
        need = entry.get("glass_minima")
        if need and version_tuple(VERSION) < version_tuple(need):
            raise PackError(self._msg("glass", n=name, v=need))
        async with self._lock:
            blob = await self._download(entry, name)
            if hashlib.sha256(blob).hexdigest().lower() != str(entry["sha256"]).lower():
                raise PackError(self._msg("checksum", n=name))
            info = await self.hass.async_add_executor_job(self._unpack, blob, pid, name)
            self.installed[pid] = {"version": info.get("versione") or entry.get("versione") or "0", "name": name}
            await self._save()
            self._activate(pid, self.installed[pid]["version"])
            _LOGGER.info("Aurora Glass: installato il pacchetto %s %s", pid, self.installed[pid]["version"])

    async def _download(self, entry: dict[str, Any], name: str) -> bytes:
        url = str(entry["url"])
        try:
            if url.startswith("file:"):
                path = Path(url[5:].lstrip("/") if re.match(r"^file:/*[A-Za-z]:", url) else url[5:])
                if not path.is_absolute():
                    path = self.local_catalog.parent / path
                return await self.hass.async_add_executor_job(path.read_bytes)
            session = async_get_clientsession(self.hass)
            async with asyncio.timeout(60):
                resp = await session.get(url)
                resp.raise_for_status()
                if int(resp.headers.get("Content-Length") or 0) > MAX_ZIP:
                    raise PackError(self._msg("too_big", n=name))
                blob = await resp.content.read(MAX_ZIP + 1)
        except PackError:
            raise
        except Exception as err:
            raise PackError(self._msg("download", n=name, e=err)) from err
        if len(blob) > MAX_ZIP:
            raise PackError(self._msg("too_big", n=name))
        return blob

    def _unpack(self, blob: bytes, pid: str, name: str) -> dict[str, Any]:
        """Estrae in una cartella temporanea, controlla tutto, poi sostituisce la versione vecchia."""
        try:
            zf = zipfile.ZipFile(io.BytesIO(blob))
        except zipfile.BadZipFile as err:
            raise PackError(self._msg("zip", n=name, e=err)) from err
        files = [i for i in zf.infolist() if not i.is_dir()]
        if not files or len(files) > MAX_FILES:
            raise PackError(self._msg("zip", n=name, e="file"))
        names = [PurePosixPath(i.filename) for i in files]
        # una sola cartella in cima (regia/pack.json) va bene come i file sciolti
        prefix = names[0].parts[0] if all(len(n.parts) > 1 and n.parts[0] == names[0].parts[0] for n in names) else None
        tmp = self.dir / f".{pid}.nuovo"
        shutil.rmtree(tmp, ignore_errors=True)
        total = 0
        try:
            for info, rel in zip(files, names):
                if prefix:
                    rel = PurePosixPath(*rel.parts[1:])
                if rel.is_absolute() or ".." in rel.parts or not rel.parts or rel.suffix.lower() not in ALLOWED:
                    raise PackError(self._msg("zip", n=name, e=str(rel)))
                total += info.file_size
                if total > MAX_ZIP * 3:
                    raise PackError(self._msg("too_big", n=name))
                dest = tmp.joinpath(*rel.parts)
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(zf.read(info))
            meta_path = tmp / "pack.json"
            if not meta_path.is_file() or not (tmp / "pack.js").is_file():
                raise PackError(self._msg("zip", n=name, e="pack.json / pack.js"))
            meta = json.loads(meta_path.read_text("utf-8"))
            if meta.get("id") != pid:
                raise PackError(self._msg("zip", n=name, e="id"))
            final = self.dir / pid
            shutil.rmtree(final, ignore_errors=True)
            tmp.rename(final)
            return meta
        except PackError:
            shutil.rmtree(tmp, ignore_errors=True)
            raise
        except (OSError, ValueError) as err:
            shutil.rmtree(tmp, ignore_errors=True)
            raise PackError(self._msg("zip", n=name, e=err)) from err

    async def async_remove(self, pid: str) -> None:
        """Toglie il pacchetto e i suoi file. I dati (es. i pad della Regia) restano per una reinstallazione."""
        async with self._lock:
            self._deactivate(pid)
            self.installed.pop(pid, None)
            await self._save()
            await self.hass.async_add_executor_job(shutil.rmtree, self.dir / pid, True)
            _LOGGER.info("Aurora Glass: tolto il pacchetto %s", pid)

    # ------------------------------------------------------------------ dati dei pacchetti
    @callback
    def set_data(self, pid: str, data: Any) -> None:
        self.data[pid] = data
        self._data_store.async_delay_save(lambda: {"packs": self.data}, 2)


@websocket_api.websocket_command({vol.Required("type"): "aurora_glass/pack_data", vol.Required("pack"): str})
@callback
def ws_pack_data(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    mgr: PackManager = hass.data[DOMAIN]["packs"]
    connection.send_result(msg["id"], {"data": mgr.data.get(msg["pack"])})


@websocket_api.websocket_command(
    {vol.Required("type"): "aurora_glass/pack_data/save", vol.Required("pack"): str, vol.Required("data"): vol.Any(dict, list)}
)
@callback
def ws_pack_data_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    pid = msg["pack"]
    if not ID_RE.match(pid):
        connection.send_error(msg["id"], "invalid_pack", "invalid pack id")
        return
    if len(json.dumps(msg["data"])) > MAX_DATA:
        connection.send_error(msg["id"], "too_large", "pack data too large")
        return
    hass.data[DOMAIN]["packs"].set_data(pid, msg["data"])
    connection.send_result(msg["id"], {})


async def async_setup_packs(hass: HomeAssistant) -> PackManager:
    mgr = PackManager(hass)
    hass.data.setdefault(DOMAIN, {})["packs"] = mgr
    await mgr.async_load()
    websocket_api.async_register_command(hass, ws_pack_data)
    websocket_api.async_register_command(hass, ws_pack_data_save)
    return mgr
