// Banco di prova in Chrome senza finestra: errori JavaScript, scroll orizzontale a 390 e 1280 px, italiano e inglese,
// e i pulsanti delle funzioni nuove premuti davvero (regole del wiki dopo l'errore del 20/11/2026).
// Prima: python tools/build.py (il banco usa dist/). Uso: node tools/check_harness.mjs [cartella per gli screenshot]
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SHOTS = process.argv[2] || "";
const CHROME = process.env.CHROME_PATH || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "google-chrome");
const PORT = 9300 + Math.floor(Math.random() * 500);
const fileUrl = (rel) => "file:///" + path.join(ROOT, rel).replace(/\\/g, "/").replace(/^\/+/, "");

if (!fs.existsSync(path.join(ROOT, "dist", "aurora-v3.js"))) {
  console.error("check_harness: manca dist/aurora-v3.js, lancia prima python tools/build.py");
  process.exit(2);
}
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "aurora-banco-"));
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--no-sandbox",
  "--allow-file-access-from-files", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
const events = [];
const send = (method, params = {}, sessionId) => new Promise((resolve) => {
  const msg = { id: ++id, method, params };
  if (sessionId) msg.sessionId = sessionId;
  pending.set(msg.id, resolve);
  ws.send(JSON.stringify(msg));
});
const problems = [];
const fail = (where, what) => problems.push(`${where}: ${what}`);

/* scenario nella pagina: irrigazione (avvio, valvola che non si chiude, non disponibile), Server senza dati, editor Server & UPS */
const SCENARIO = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const c = window.PANEL.firstElementChild, r = c.shadowRoot || c;
  const zone = () => r.querySelector('.garden-card[data-zone-idx="0"]');
  const status = () => zone().querySelector('.g-status-txt').textContent.trim();
  const txt = (sel) => { const e = r.querySelector(sel); return e ? e.textContent.trim() : null; };
  if (!zone()) return { missing: 'zona 1 del giardino' };
  zone().querySelector('.g-valve-btn').click(); await sleep(500);
  const avvio = status();
  window.VALVE_STUCK = true; zone().querySelector('.g-valve-btn').click(); await sleep(500);
  const ferma = status(), avviso = txt('#toast-text');
  window.S['switch.irr_zone1'] = window.st('switch.irr_zone1', 'unavailable', { friendly_name: 'Irrigazione Prato' }); window.push(); await sleep(400);
  const nonDisp = status();
  window.S['sensor.srv_cpu'] = window.st('sensor.srv_cpu', 'unavailable', { unit_of_measurement: '%' });
  window.S['sensor.srv_temp'] = window.st('sensor.srv_temp', '104', { unit_of_measurement: '°F' }); window.push(); await sleep(400);
  const cpu = txt('#srv-cpu'), temp = txt('#srv-temp');
  // 3.9.0 · tapparelle: stato, tasti secondo le funzioni, comando vero a Home Assistant
  const row = (id) => [...r.querySelectorAll('.cv-row')].find((x) => x.querySelector('.cv-txt b').textContent.trim() === id);
  const cvSt = (id) => row(id) ? row(id).querySelector('.cv-st').textContent.trim() : null;
  const cvBtns = (id) => row(id) ? [...row(id).querySelectorAll('.cv-b')].filter((b) => !b.hidden).map((b) => b.dataset.a).join(',') : null;
  const cv = { righe: r.querySelectorAll('.cv-row').length, tapparella: cvSt('Living room shutter'), tenda: cvSt('Bedroom curtain'), garage: cvSt('Garage'), gruppo: cvSt('All covers'), barraGruppo: row('All covers') ? row('All covers').querySelector('.cv-bar').hidden : null,
    tastiTapparella: cvBtns('Living room shutter'), tastiTenda: cvBtns('Bedroom curtain') };
  if (row('Living room shutter')) { row('Living room shutter').querySelector('[data-a="close"]').click(); await sleep(500); }
  cv.dopoChiudi = cvSt('Living room shutter');
  cv.chiamata = (window.CALLS || []).some((c) => c[0] === 'cover' && c[1] === 'close_cover' && c[2].entity_id === 'cover.living_shutter');
  if (row('Bedroom curtain')) { row('Bedroom curtain').querySelector('[data-a="open"]').click(); await sleep(500); }
  cv.dopoApri = cvSt('Bedroom curtain');
  const edit = r.querySelector('[data-home]'); if (edit) edit.click(); await sleep(600);
  const tab = Array.from(r.querySelectorAll('#hb-tabs button')).find((b) => /Server/.test(b.textContent)); if (tab) tab.click(); await sleep(400);
  const editor = txt('#hb-body') || '';
  return { avvio, ferma, avviso, nonDisp, cpu, temp, sysmon: /System Monitor/.test(editor), editorAperto: !!tab, cv };
})()`;

const ATTESI = {
  it: { avvio: /^In irrigazione · \d/, ferma: /^Chiusura in corso…$/, avviso: /Chiusura in corso/, nonDisp: /^Non disponibile · da chiudere$/ },
  en: { avvio: /^Watering · \d/, ferma: /^Closing…$/, avviso: /Closing/, nonDisp: /^Unavailable · to be closed$/ },
};
const ATTESI_CV = {
  it: { righe: 4, tapparella: "Aperta · 60%", tenda: "Chiusa", garage: "Chiuso", gruppo: "Aperta", barraGruppo: true, tastiTapparella: "open,stop,close", tastiTenda: "open,close", dopoChiudi: "Chiusa", chiamata: true, dopoApri: "Aperta" },
  en: { righe: 4, tapparella: "Open · 60%", tenda: "Closed", garage: "Closed", gruppo: "Open", barraGruppo: true, tastiTapparella: "open,stop,close", tastiTenda: "open,close", dopoChiudi: "Closed", chiamata: true, dopoApri: "Open" },
};
/* anteprima del sito: le due tapparelle di esempio si muovono davvero */
const DEMO_CV = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rows = [...document.querySelectorAll('.cv-row')];
  if (rows.length !== 2) return { righe: rows.length };
  const tenda = rows[1], st = () => tenda.querySelector('.cv-st').textContent.trim();
  const prima = st();
  tenda.querySelector('[data-a="open"]').click(); await sleep(3200);
  return { righe: rows.length, prima, dopo: st() };
})()`;

try {
  let ver;
  for (let i = 0; i < 60 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(250); } }
  if (!ver) throw new Error("Chrome non risponde: " + CHROME);
  ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result || m.error); pending.delete(m.id); } else if (m.method) events.push(m);
  });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Runtime.enable", {}, sessionId);
  await send("Page.enable", {}, sessionId);
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const pages = [["src/tests/harness.html", "it"], ["src/tests/harness.html", "en"], ["src/index.html", "it"], ["src/index.html", "en"]];
  for (const [page, lang] of pages) {
    for (const [w, mobile] of [[390, true], [1280, false]]) {
      const where = `${page.split("/").pop()}?lang=${lang} @${w}px`;
      events.length = 0;
      await send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile }, sessionId);
      await send("Page.navigate", { url: fileUrl(page) + "?lang=" + lang }, sessionId);
      await sleep(3000);
      const size = await evaluate("({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })");
      if (size.sw > size.cw) fail(where, `scroll orizzontale (${size.sw} > ${size.cw} px)`);
      if (page.includes("harness") && w === 390) {
        const res = await evaluate(SCENARIO);
        if (res.missing) fail(where, "manca " + res.missing);
        else {
          for (const [k, re] of Object.entries(ATTESI[lang])) if (!re.test(res[k] || "")) fail(where, `${k} = ${JSON.stringify(res[k])}`);
          if (res.cpu !== "—") fail(where, `CPU non disponibile mostrata come ${JSON.stringify(res.cpu)}`);
          if (!/^40°C$|^40°F$|^104°F$/.test(res.temp || "")) fail(where, `temperatura in °F mostrata come ${JSON.stringify(res.temp)}`);
          if (!res.editorAperto || !res.sysmon) fail(where, "nell'editor Server & UPS manca l'aiuto per System Monitor");
          for (const [k, v] of Object.entries(ATTESI_CV[lang])) if ((res.cv || {})[k] !== v) fail(where, `tapparelle ${k} = ${JSON.stringify((res.cv || {})[k])} (atteso ${JSON.stringify(v)})`);
        }
      }
      if (page.includes("index") && w === 390) {
        const d = await evaluate(DEMO_CV);
        const want = lang === "it" ? ["Chiusa", "Aperta"] : ["Closed", "Open"];
        if (d.righe !== 2 || d.prima !== want[0] || d.dopo !== want[1]) fail(where, "tapparelle dell'anteprima: " + JSON.stringify(d));
      }
      if (SHOTS) {
        const shot = await send("Page.captureScreenshot", { format: "png" }, sessionId);
        fs.mkdirSync(SHOTS, { recursive: true });
        fs.writeFileSync(path.join(SHOTS, where.replace(/[^a-z0-9@.=-]+/gi, "_") + ".png"), Buffer.from(shot.data, "base64"));
      }
      for (const e of events) {
        if (e.method === "Runtime.exceptionThrown") fail(where, "errore JavaScript: " + (e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text).split("\n")[0]);
        if (e.method === "Runtime.consoleAPICalled" && e.params.type === "error") fail(where, "console.error: " + e.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 200));
      }
    }
  }
} catch (err) {
  fail("banco", err.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
  await sleep(500);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
}
if (problems.length) {
  console.error(`check_harness: ${problems.length} problemi`);
  problems.forEach((p) => console.error("  " + p));
  process.exit(1);
}
console.log("check_harness: banco e anteprima senza errori, IT/EN, 390 e 1280 px, irrigazione, tapparelle, Server e editor provati");
