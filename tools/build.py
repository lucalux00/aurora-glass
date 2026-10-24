"""Costruisce tutto Aurora Glass partendo da src/.

  python tools/build.py

  custom_components/aurora_glass/frontend/   scheda + immagini servite dall'integrazione (/aurora_glass/)
  dist/                                      scheda + immagini per l'installazione a mano (www/aurora-v3/)
  build/aurora-glass-v3-home-assistant.zip   pacchetto da scaricare: cartelle italiano/ e english/,
                                             www/ e custom_components/ (procedura guidata senza HACS)
"""
import json
import pathlib
import re
import shutil
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
PARTS = ["disegno.js", "mondi-base.js", "mondi-a.js", "mondi-b.js", "effetti.js", "lingua.js", "pacchetti.js", "aurora-app.js"]
VERSION = json.loads((ROOT / "custom_components" / "aurora_glass" / "manifest.json").read_text(encoding="utf-8"))["version"]


def bundle(assets: str) -> str:
    """Un solo file JS: motore di disegno, mondi, effetti, lingue, logica e la scheda con CSS e HTML dell'anteprima."""
    html = (SRC / "index.html").read_text(encoding="utf-8")
    css = html[html.index("<style>") + 7: html.index("</style>")]
    props = "\n".join(re.findall(r"@property\s+--[a-z0-9]+\s*\{[^}]*\}", css))
    css = re.sub(r"@property\s+--[a-z0-9]+\s*\{[^}]*\}", "", css)
    css = re.sub(r":root\[([^\]]+)\]", r":host([\1])", css).replace(":root", ":host")
    a = html.index('<div class="shell" id="shell">')
    b = html.index("</div><!-- /shell -->") + len("</div><!-- /shell -->")
    wrapper = (SRC / "ha" / "card-wrapper.js").read_text(encoding="utf-8")
    wrapper = (wrapper.replace("__CSS__", json.dumps(css)).replace("__HTML__", json.dumps(html[a:b]))
               .replace("__PROPS__", json.dumps(props)).replace("__ASSETS__", json.dumps(assets))
               .replace("__VERSION__", json.dumps(VERSION)))
    out = f"/* Aurora Glass v{VERSION} — scheda per Home Assistant (generata da tools/build.py) */\n"
    for p in PARTS:
        out += "\n/* ---- " + p + " ---- */\n" + (SRC / "js" / p).read_text(encoding="utf-8") + "\n"
    return out + "\n/* ---- scheda ---- */\n" + wrapper


def write_card(target: pathlib.Path, assets: str) -> None:
    if target.exists():
        shutil.rmtree(target)
    (target / "btn").mkdir(parents=True)
    (target / "aurora-v3.js").write_text(bundle(assets), encoding="utf-8", newline="\n")
    for f in sorted((SRC / "assets" / "btn").iterdir()):
        shutil.copy2(f, target / "btn" / f.name)


def add_tree(z: zipfile.ZipFile, folder: pathlib.Path, arc: str) -> None:
    for f in sorted(folder.rglob("*")):
        if f.is_file() and "__pycache__" not in f.parts:
            z.write(f, arc + "/" + f.relative_to(folder).as_posix())


def main() -> None:
    write_card(ROOT / "custom_components" / "aurora_glass" / "frontend", "/aurora_glass/btn/")
    write_card(ROOT / "dist", "")
    out = ROOT / "build"
    out.mkdir(exist_ok=True)
    zpath = out / "aurora-glass-v3-home-assistant.zip"
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        top = "aurora-glass-v3"
        z.write(ROOT / "package" / "LEGGIMI - README.txt", f"{top}/LEGGIMI - README.txt")
        add_tree(z, ROOT / "package" / "italiano", f"{top}/italiano")
        add_tree(z, ROOT / "package" / "english", f"{top}/english")
        add_tree(z, ROOT / "dist", f"{top}/www/aurora-v3")
        add_tree(z, ROOT / "custom_components" / "aurora_glass", f"{top}/custom_components/aurora_glass")
        z.write(ROOT / "LICENSE", f"{top}/LICENSE")
    size = (ROOT / "dist" / "aurora-v3.js").stat().st_size // 1024
    print(f"Aurora Glass {VERSION}: scheda {size} KB, zip {zpath.stat().st_size // 1024} KB -> {zpath}")


if __name__ == "__main__":
    main()
