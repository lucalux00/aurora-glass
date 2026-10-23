"""Genera le immagini dei pulsanti (assets/btn/*.png e *.gif) dal codice in arte-*.js.
   Uso:   python render_btn.py            (tutte)
          python render_btn.py luce_salotto scena_cena   (solo alcune)
   Richiede: Python + playwright + Chrome + ffmpeg."""
import os, sys, shutil, subprocess, tempfile, pathlib
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent / "assets" / "btn"
FRAMES = 30          # fotogrammi per ciclo
FPS = 20             # 30 fotogrammi a 20 fps = ciclo di 1,5 s
FFMPEG = os.environ.get("FFMPEG") or shutil.which("ffmpeg") or "ffmpeg"   # oppure imposta la variabile FFMPEG con il percorso

def make_gif(frames_dir, out_path):
    vf = "split[s0][s1];[s0]palettegen=stats_mode=full:max_colors=255[p];[s1][p]paletteuse=dither=sierra2_4a"
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", str(frames_dir / "f%02d.png"),
                    "-vf", vf, "-loop", "0", str(out_path)], check=True)

def main():
    only = set(sys.argv[1:])
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True)
        pg = b.new_page(viewport={"width": 256, "height": 256}, device_scale_factor=1)
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto((HERE / "arte.html").as_uri())
        keys = pg.evaluate("Object.keys(AR.ART)")
        meta = pg.evaluate("Object.fromEntries(Object.entries(AR.ART).map(([k,v])=>[k,v.out||'pair']))")
        el = pg.locator("#s")
        def shot(key, on, t, path):
            pg.evaluate("([k,o,t])=>{document.getElementById('s').innerHTML=AR.render(k,o,t)}", [key, on, t])
            el.screenshot(path=str(path))
        for key in keys:
            if only and key not in only: continue
            out = meta[key]
            if out in ("pair", "png"):
                png = OUT / (f"{key}_off.png" if out == "pair" else f"{key}.png")
                shot(key, out == "png", 0.25, png)
            if out in ("pair", "gif"):
                tmp = pathlib.Path(tempfile.mkdtemp(prefix="arte_"))
                for i in range(FRAMES):
                    shot(key, True, i / FRAMES, tmp / f"f{i:02d}.png")
                gif = OUT / (f"{key}_on.gif" if out == "pair" else f"{key}.gif")
                make_gif(tmp, gif)
                shutil.rmtree(tmp, ignore_errors=True)
            print("ok", key)
        b.close()
    if errs: print("ERRORI JS:", errs)

if __name__ == "__main__":
    main()
