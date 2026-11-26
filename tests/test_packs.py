"""Pacchetti: lo zip si installa solo se è quello del catalogo e non può scrivere fuori dalla sua cartella."""

from __future__ import annotations

import hashlib
import io
import json
from pathlib import Path
from unittest.mock import patch
import zipfile

import pytest

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component

from custom_components.aurora_glass.const import DOMAIN
from custom_components.aurora_glass.packs import PackError, PackManager, async_setup_packs


def _zip(files: dict[str, bytes | str]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for name, data in files.items():
            z.writestr(name, data)
    return buf.getvalue()


def _pack(pid: str = "regia", top: str | None = "regia", extra: dict[str, bytes | str] | None = None) -> bytes:
    pre = f"{top}/" if top else ""
    files = {f"{pre}pack.json": json.dumps({"id": pid, "nome": "Regia", "versione": "1.0.1"}), f"{pre}pack.js": "/* pacchetto */"}
    files.update(extra or {})
    return _zip(files)


@pytest.fixture
def mgr(hass: HomeAssistant, tmp_path: Path) -> PackManager:
    m = PackManager(hass)
    m.dir = tmp_path / "pacchetti"
    m.dir.mkdir()
    return m


def test_zip_valido(mgr: PackManager) -> None:
    meta = mgr._unpack(_pack(extra={"regia/img/pad.png": b"\x89PNG"}), "regia", "Regia")
    assert meta["id"] == "regia"
    assert (mgr.dir / "regia" / "pack.js").is_file()
    assert (mgr.dir / "regia" / "img" / "pad.png").is_file()
    assert not (mgr.dir / ".regia.nuovo").exists()


@pytest.mark.parametrize("bad", ["../fuori.js", "regia/../../fuori.js", "/assoluto.js", "regia/virus.exe", "regia/script.py"])
def test_zip_pericoloso_rifiutato(mgr: PackManager, bad: str) -> None:
    blob = _zip({"regia/pack.json": json.dumps({"id": "regia"}), "regia/pack.js": "x", bad: "x"})
    with pytest.raises(PackError):
        mgr._unpack(blob, "regia", "Regia")
    assert not (mgr.dir / "regia").exists()
    assert not (mgr.dir.parent / "fuori.js").exists()
    assert not (mgr.dir / ".regia.nuovo").exists()


def test_id_diverso_rifiutato(mgr: PackManager) -> None:
    with pytest.raises(PackError):
        mgr._unpack(_pack(pid="altro"), "regia", "Regia")


def test_senza_pack_js_rifiutato(mgr: PackManager) -> None:
    with pytest.raises(PackError):
        mgr._unpack(_zip({"pack.json": json.dumps({"id": "regia"})}), "regia", "Regia")


async def test_impronta_diversa_non_installa(hass: HomeAssistant, mgr: PackManager, tmp_path: Path) -> None:
    blob = _pack()
    (tmp_path / "regia.zip").write_bytes(blob)
    entry = {"id": "regia", "nome": "Regia", "url": f"file:{tmp_path / 'regia.zip'}", "sha256": "0" * 64}
    with patch("custom_components.aurora_glass.packs.frontend.add_extra_js_url") as add_js:
        with pytest.raises(PackError):
            await mgr.async_install(entry)
        assert "regia" not in mgr.installed
        add_js.assert_not_called()
        entry["sha256"] = hashlib.sha256(blob).hexdigest()
        await mgr.async_install(entry)
        assert mgr.installed["regia"]["version"] == "1.0.1"
        add_js.assert_called_once()


async def test_dati_solo_dei_pacchetti_installati(hass: HomeAssistant, hass_ws_client, tmp_path: Path) -> None:
    hass.config.config_dir = str(tmp_path)
    assert await async_setup_component(hass, "http", {})
    hass.data.setdefault(DOMAIN, {})
    m = await async_setup_packs(hass)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "aurora_glass/pack_data/save", "pack": "regia", "data": {"pad": 1}})
    msg = await client.receive_json()
    assert not msg["success"] and msg["error"]["code"] == "invalid_pack"
    m.installed["regia"] = {"version": "1.0.1", "name": "Regia"}
    await client.send_json({"id": 2, "type": "aurora_glass/pack_data/save", "pack": "regia", "data": {"pad": 1}})
    assert (await client.receive_json())["success"]
    await client.send_json({"id": 3, "type": "aurora_glass/pack_data", "pack": "regia"})
    assert (await client.receive_json())["result"] == {"data": {"pad": 1}}
    await client.send_json({"id": 4, "type": "aurora_glass/pack_data/save", "pack": "regia", "data": {"x": "a" * 300_000}})
    msg = await client.receive_json()
    assert not msg["success"] and msg["error"]["code"] == "too_large"
