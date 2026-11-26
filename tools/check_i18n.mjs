// Controlla che ogni frase T("…") dei sorgenti abbia la sua voce inglese in src/js/lingua.js.
// Regola del wiki (errore del 20/11/2026: la 3.8.0 aveva più di 40 frasi senza inglese).
// Uso: node tools/check_i18n.mjs   → esce con 1 ed elenca le frasi mancanti.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const JS = path.join(ROOT, "src", "js");

/* chiavi del dizionario inglese: le stringhe "…": dentro var EN = { … } */
const lingua = fs.readFileSync(path.join(JS, "lingua.js"), "utf8");
const start = lingua.indexOf("var EN = {");
const end = lingua.indexOf("\n  };", start);
if (start < 0 || end < 0) {
  console.error("check_i18n: non trovo il dizionario EN in lingua.js");
  process.exit(2);
}
const keys = new Set();
for (const m of lingua.slice(start, end).matchAll(/"((?:[^"\\]|\\.)*)"\s*:/g)) keys.add(JSON.parse('"' + m[1] + '"'));

/* le stringhe letterali nel primo argomento di ogni T( … ), comprese quelle dei due rami di un ?: */
function phrases(src) {
  const out = [];
  const re = /(^|[^A-Za-z0-9_$.])T\(/g;
  let m;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length, depth = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === '"' || c === "'") {
        let j = i + 1, s = "";
        while (j < src.length && src[j] !== c) { if (src[j] === "\\") { s += src[j] + src[j + 1]; j += 2; continue; } s += src[j]; j++; }
        if (s) { try { out.push(JSON.parse('"' + s.replace(/"/g, '\\"').replace(/\\'/g, "'") + '"')); } catch { out.push(s); } }
        i = j + 1;
        continue;
      }
      if (c === "(" || c === "[" || c === "{") depth++;
      else if (c === ")" || c === "]" || c === "}") { if (depth === 0) break; depth--; }
      else if (c === "," && depth === 0) break;
      i++;
    }
  }
  return out;
}

const missing = new Map();
for (const f of fs.readdirSync(JS).filter((x) => x.endsWith(".js") && x !== "lingua.js")) {
  const src = fs.readFileSync(path.join(JS, f), "utf8");
  for (const p of phrases(src)) {
    if (!keys.has(p) && !missing.has(p)) missing.set(p, f);
  }
}
if (missing.size) {
  console.error(`check_i18n: ${missing.size} frasi senza inglese in lingua.js:`);
  for (const [p, f] of missing) console.error(`  [${f}] ${JSON.stringify(p)}`);
  process.exit(1);
}
console.log(`check_i18n: tutte le frasi hanno l'inglese (${keys.size} voci)`);
