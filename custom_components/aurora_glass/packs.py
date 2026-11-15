"""Pacchetti di Aurora Glass: catalogo, scaricamento, attivazione, rimozione e dati.

Un pacchetto è uno zip con pack.json (id, nome, versione, glass_minima) e pack.js, più
eventuali stili e immagini. Si scarica dal catalogo (catalogo.json), si controlla con lo
sha256 scritto nel catalogo e finisce in /config/aurora_glass/pacchetti/<id>/.
I pacchetti attivi vengono caricati in tutte le pagine di Home Assistant (come la scheda)
e si agganciano da soli alle plance Aurora aperte.

Catalogo: quello pubblicato su domotikpro.it (i pacchetti passano dal sito). Se esiste /config/aurora_glass/catalogo.json si usa
quello (installazione senza internet, prove dei pacchetti nuovi).

Pacchetti a pagamento (3.7.0): nel catalogo hanno "licenza": true e l'indirizzo dello zip è una rotta del sito.
La chiave comprata si inserisce in Configura → Chiavi di licenza: l'integrazione la attiva una volta sul sito
(che parla con il negozio) e conserva l'attivazione; per scaricare manda chiave + attivazione e il sito
consegna lo zip solo se la chiave è valida e copre quel pacchetto. Il controllo sha256 resta lo stesso.
Verso il sito vanno solo la chiave, l'attivazione e un'impronta dell'installazione (non l'uuid).
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
from homeassistant.helpers import instance_id
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.storage import Store

from .const import DOMAIN, VERSION

_LOGGER = logging.getLogger(__name__)

PACKS_URL = "/aurora_glass_pacchetti"
CATALOG_URL = "https://domotikpro.it/aurora-glass/pacchetti/catalogo.json"
PACKS_PAGE = "https://domotikpro.it/progetti/aurora-glass-pacchetti?utm_source=home-assistant&utm_medium=integrazione&utm_campaign=aurora-glass-pacchetti"
LICENSE_URL = "https://domotikpro.it/api/aurora-glass/licenza"
STORE_KEY = f"{DOMAIN}.pacchetti"
LICENSE_STORE_KEY = f"{DOMAIN}.licenze"
KEY_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{5,127}$")
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
        "glass": "«{n}» richiede Aurora Glass {v} o più recente: aggiorna prima Aurora Glass dal Marketplace (o da HACS).",
        "needs_key": "«{n}» è a pagamento ({p}): acquistalo su domotikpro.it, poi inserisci la chiave in Configura → Chiavi di licenza.",
        "needs_gift": "«{n}» è un regalo per chi si iscrive alla newsletter di DomotikPro: iscriviti su domotikpro.it/progetti/aurora-glass-pacchetti, poi inserisci la chiave che ti arriva per email in Configura → Chiavi di licenza.",
        "key_format": "La chiave non sembra valida: copiala intera dalla mail.",
        "key_dup": "Questa chiave è già attiva su questo Home Assistant.",
        "shop": "Il negozio non risponde ({e}). Riprova tra qualche minuto.",
        "denied": "{e}",
    },
    "en": {
        "catalog": "Can't read the pack catalog ({e}).",
        "catalog_bad": "The pack catalog is not valid.",
        "download": "Download of “{n}” failed ({e}).",
        "too_big": "The pack “{n}” is too large.",
        "checksum": "The file of “{n}” doesn't match the catalog: not installing it.",
        "zip": "The pack “{n}” is not valid ({e}).",
        "glass": "“{n}” needs Aurora Glass {v} or newer: update Aurora Glass from the Marketplace (or HACS) first.",
        "needs_key": "“{n}” is a paid pack ({p}): buy it on domotikpro.it, then enter the key in Configure → License keys.",
        "needs_gift": "“{n}” is a gift for DomotikPro newsletter subscribers: sign up at domotikpro.it/progetti/aurora-glass-pacchetti, then enter the key from the email in Configure → License keys.",
        "key_format": "This doesn't look like a valid key: copy it in full from the email.",
        "key_dup": "This key is already active on this Home Assistant.",
        "shop": "The shop is not answering ({e}). Try again in a few minutes.",
        "denied": "{e}",
    },
}


async def read_capped(resp: Any, limit: int) -> bytes:
    """Legge TUTTO il corpo della risposta, fino a limit+1 byte.

    `resp.content.read(n)` restituisce solo i byte già arrivati (di solito il primo blocco da 8 KB): con uno zip più
    grande il file risultava troncato e il controllo sha256 lo rifiutava. Qui si legge a blocchi fino alla fine.
    """
    chunks: list[bytes] = []
    total = 0
    async for chunk in resp.content.iter_chunked(65536):
        chunks.append(chunk)
        total += len(chunk)
        if total > limit:
            break
    return b"".join(chunks)


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
        self._license_store: Store = Store(hass, 1, LICENSE_STORE_KEY)
        self.licenses: list[dict[str, Any]] = []
        self.license_url = LICENSE_URL
        self._local_shop = False
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
        self.licenses = [x for x in (await self._license_store.async_load() or {}).get("licenses", []) if isinstance(x, dict) and x.get("key")]
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
        shop = str(data.get("licenze") or "")
        # indirizzo delle chiavi: dal catalogo (https), o qualsiasi dal catalogo locale di prova
        self.license_url = shop if shop and (local or shop.startswith("https://")) else LICENSE_URL
        self._local_shop = local
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

    # ------------------------------------------------------------------ licenze
    def license_for(self, pid: str) -> dict[str, Any] | None:
        for lic in self.licenses:
            if lic.get("all") or pid in (lic.get("packs") or []):
                return lic
        return None

    async def _instance_label(self) -> str:
        """Un'impronta dell'installazione per riconoscere l'attivazione, non l'uuid vero."""
        uid = await instance_id.async_get(self.hass)
        return "Home Assistant " + hashlib.sha256(f"aurora-glass:{uid}".encode()).hexdigest()[:10]

    async def _shop(self, url: str, payload: dict[str, Any]) -> tuple[int, bytes, str]:
        if not url.startswith("https://") and not self._local_shop:
            raise PackError(self._msg("shop", e="https"))
        try:
            session = async_get_clientsession(self.hass)
            async with asyncio.timeout(60):
                resp = await session.post(url, json={**payload, "lingua": lang_of(self.hass), "glass": VERSION})
                if int(resp.headers.get("Content-Length") or 0) > MAX_ZIP:
                    raise PackError(self._msg("too_big", n=payload.get("id", "")))
                body = await read_capped(resp, MAX_ZIP)
                return resp.status, body, resp.headers.get("Content-Type", "")
        except PackError:
            raise
        except Exception as err:  # rete, tempo scaduto
            raise PackError(self._msg("shop", e=err)) from err

    def _refusal(self, status: int, body: bytes) -> PackError:
        """Il sito spiega il rifiuto con {"errore": "..."} nella lingua di HA."""
        try:
            text = str(json.loads(body.decode("utf-8")).get("errore") or "")
        except (ValueError, AttributeError, UnicodeDecodeError):
            text = ""
        return PackError(self._msg("denied", e=text) if text else self._msg("shop", e=f"HTTP {status}"))

    async def async_add_license(self, key: str) -> dict[str, Any]:
        key = key.strip()
        if not KEY_RE.match(key):
            raise PackError(self._msg("key_format"))
        if any(x["key"] == key for x in self.licenses):
            raise PackError(self._msg("key_dup"))
        status, body, _ = await self._shop(self.license_url, {"azione": "attiva", "chiave": key, "istanza": await self._instance_label()})
        if status != 200:
            raise self._refusal(status, body)
        try:
            res = json.loads(body.decode("utf-8"))
        except (ValueError, UnicodeDecodeError) as err:
            raise PackError(self._msg("shop", e="json")) from err
        lic = {
            "key": key,
            "activation": str(res.get("attivazione") or ""),
            "packs": [p for p in (res.get("pacchetti") or []) if isinstance(p, str) and ID_RE.match(p)],
            "all": bool(res.get("tutti")),
            "name": str(res.get("nome") or ""),
            "display": str(res.get("chiave_visibile") or ("…" + key[-4:])),
        }
        self.licenses.append(lic)
        await self._license_store.async_save({"licenses": self.licenses})
        _LOGGER.info("Aurora Glass: chiave di licenza attivata (%s)", lic["display"])
        return lic

    async def async_remove_license(self, key: str) -> None:
        """Libera l'attivazione sul negozio (per usarla su un altro HA) e toglie la chiave da qui.
        Anche se il negozio non risponde la chiave si toglie: l'attivazione si libera dal portale del negozio."""
        lic = next((x for x in self.licenses if x["key"] == key), None)
        if not lic:
            return
        try:
            await self._shop(self.license_url, {"azione": "togli", "chiave": key, "attivazione": lic.get("activation", "")})
        except PackError as err:
            _LOGGER.warning("Aurora Glass: non riesco a liberare l'attivazione sul negozio: %s", err)
        self.licenses = [x for x in self.licenses if x["key"] != key]
        await self._license_store.async_save({"licenses": self.licenses})

    async def _download(self, entry: dict[str, Any], name: str) -> bytes:
        url = str(entry["url"])
        if entry.get("licenza"):
            lic = self.license_for(entry["id"])
            if not lic and entry.get("gratis"):
                raise PackError(self._msg("needs_gift", n=name))
            if not lic:
                price = entry.get("prezzo_en" if lang_of(self.hass) == "en" else "prezzo") or entry.get("prezzo") or ""
                raise PackError(self._msg("needs_key", n=name, p=price))
            status, blob, ctype = await self._shop(url, {"id": entry["id"], "chiave": lic["key"], "attivazione": lic.get("activation", "")})
            if status != 200 or "json" in ctype:
                raise self._refusal(status, blob)
            if len(blob) > MAX_ZIP:
                raise PackError(self._msg("too_big", n=name))
            return blob
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
                blob = await read_capped(resp, MAX_ZIP)
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
