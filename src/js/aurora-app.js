/* ============================================================================
   AURORA GLASS v3 — logica dell'interfaccia
   Una sola codebase per due usi:
   · anteprima (index.html): dati finti, tutto simulato
   · scheda di Home Assistant (ha/): dati veri delle entità, servizi veri
   ctx = { root, host, layer, scroll, assets, live, embedded, haIcons, config, call, moreInfo }
   ========================================================================== */
(function (g) {
  "use strict";
  g.AuroraApp = function (ctx) {
    var ROOT = ctx.root, HOST = ctx.host, LAYER = ctx.layer || HOST, SCROLL = ctx.scroll || window;
    var LIVE = !!ctx.live, HA = !!ctx.haIcons, EMB = !!ctx.embedded, CFG = ctx.config || {};
    var VERSION = ctx.version || "999.0.0";   /* l'anteprima conta come l'ultima versione */
    /* lingua: "it" o "en" (config language, poi la lingua di Home Assistant); T() traduce le frasi italiane del codice */
    var T = g.AuroraI18n.make(ctx.lang || CFG.language), LOC = T.loc;
    var CUR = CFG.currency || "€", CUR_ICON = { "€": "mdi-currency-eur", "$": "mdi-currency-usd", "£": "mdi-currency-gbp", "CHF": "mdi-currency-fra" }[CUR] || "mdi-cash";
    var $ = function (s, r) { return (r || ROOT).querySelector(s); };
    var $$ = function (s, r) { return Array.prototype.slice.call((r || ROOT).querySelectorAll(s)); };
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var timers = [], unbinds = [], running = false;
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function store(k, v) { try { if (v === undefined) return localStorage.getItem("aurora-v3-" + k); localStorage.setItem("aurora-v3-" + k, v); } catch (e) {} return null; }
    function every(fn, ms) { var id = setInterval(fn, ms); timers.push(id); return id; }
    function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
    function on(target, ev, fn, opt) { target.addEventListener(ev, fn, opt); unbinds.push(function () { target.removeEventListener(ev, fn, opt); }); }

    /* ------------------------------------------------------------------ icone (ha-icon dentro Home Assistant, webfont MDI nell'anteprima) */
    function hydrate(node) {
      if (!HA) return;
      $$("i.mdi", node || ROOT).forEach(function (i) {
        if (i.dataset.hy) return;
        var n = null; i.classList.forEach(function (c) { if (!n && /^mdi-/.test(c)) n = c.slice(4); });
        if (!n) return;
        i.dataset.hy = "1"; i.innerHTML = '<ha-icon icon="mdi:' + n + '"></ha-icon>';
      });
    }
    function setIco(node, name) {
      if (!node) return;
      name = name.replace(/^mdi-/, "");
      if (HA) { var h = $("ha-icon", node); if (!h) { node.classList.add("mdi"); node.innerHTML = "<ha-icon></ha-icon>"; node.dataset.hy = "1"; h = $("ha-icon", node); } h.setAttribute("icon", "mdi:" + name); }
      else node.className = "mdi mdi-" + name + (node.classList.contains("bolt") ? " bolt" : "");
    }
    function esc(s) { return String(s === undefined || s === null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function el(tag, cls, html, attrs) { var e = document.createElement(tag); if (cls) e.className = cls; if (html) { e.innerHTML = html; hydrate(e); } if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); }); return e; }
    var PEN = '<span class="edit-badge"><i class="mdi mdi-pencil"></i></span>';

    /* ------------------------------------------------------------------ immagini dei pulsanti */
    var BASE = ctx.assets || "assets/btn/", IMG = {};
    ["luce_salotto", "luce_ingresso", "luce_corridoio", "luce_cucina", "luce_balcone", "luce_camera", "luce_cameretta", "luce_bagno_piccolo", "luce_bagno_doccia", "luce_lavanderia", "luce_sgabuzzino",
     "scena_buongiorno", "scena_cinema", "scena_cena", "scena_notte", "scena_esco",
     "sensore_movimento", "sensore_porta", "sensore_finestra", "sensore_cancello"].forEach(function (k) { IMG[k] = { kind: "pair", off: BASE + k + "_off.png", on: BASE + k + "_on.gif" }; });
    IMG.allarme_off = { kind: "single", src: BASE + "allarme_off.png" };
    ["allarme_notte", "allarme_fuori", "allarme_scattato"].forEach(function (k) { IMG[k] = { kind: "single", src: BASE + k + ".gif" }; });
    IMG.clima_off = { kind: "single", src: BASE + "clima_off.png" };
    ["cool", "heat", "dry", "fan", "auto"].forEach(function (k) { IMG["clima_" + k] = { kind: "single", src: BASE + "clima_" + k + ".gif" }; });
    var LIBGROUPS = [[T("Luci"), "luce_"], [T("Scene"), "scena_"], [T("Sensori"), "sensore_"], [T("Allarme"), "allarme_"], [T("Clima"), "clima_"]];
    var LIBNAMES = { luce_salotto: "Salotto", luce_ingresso: "Ingresso", luce_corridoio: "Corridoio", luce_cucina: "Cucina", luce_balcone: "Balcone", luce_camera: "Camera", luce_cameretta: "Cameretta", luce_bagno_piccolo: "Bagno 1", luce_bagno_doccia: "Doccia", luce_lavanderia: "Lavanderia", luce_sgabuzzino: "Sgabuzzino",
      scena_buongiorno: "Buongiorno", scena_cinema: "Cinema", scena_cena: "Cena", scena_notte: "Notte", scena_esco: "Esco", sensore_movimento: "Movimento", sensore_porta: "Porta", sensore_finestra: "Finestra", sensore_cancello: "Cancello", allarme_off: "Off", allarme_notte: "Notte", allarme_fuori: "Fuori", allarme_scattato: "Scattato", clima_off: "Spento", clima_cool: "Freddo", clima_heat: "Caldo", clima_dry: "Deumidifica", clima_fan: "Ventola", clima_auto: "Auto" };
    Object.keys(LIBNAMES).forEach(function (k) { LIBNAMES[k] = T(LIBNAMES[k]); });
    var OV = {};
    try { OV = JSON.parse(store("img") || "{}") || {}; } catch (e) { OV = {}; }
    function saveOV() { try { localStorage.setItem("aurora-v3-img", JSON.stringify(OV)); return true; } catch (e) { toast(T("Immagine troppo grande: non riesco a salvarla"), "mdi-alert-circle", "var(--warn)"); return false; } }
    function resolve(ov, base, onState) {
      var o = OV[ov] || null, b = IMG[base];
      if (!b) return "";
      if (b.kind === "single") return (o && o.src) || b.src;
      return (o && o[onState ? "on" : "off"]) || b[onState ? "on" : "off"];
    }
    function refreshImg(node) {
      var im = $("img", node);
      if (!im) return;
      var src = resolve(node.dataset.ov || node.dataset.img, node.dataset.img, node.dataset.on === "1");
      if (im.getAttribute("src") !== src) im.setAttribute("src", src);
    }
    function refreshAll() { $$("[data-img]").forEach(refreshImg); }

    /* ------------------------------------------------------------------ dati */
    /* Disposizione predefinita: 11 luci in 5 stanze, con i nomi di esempio. Se la config ha "rooms:"
       (la scrive la procedura guidata dell'integrazione, o a mano) stanze, luci e sensori vengono da lì. */
    var LIGHTS = {
      salotto: [T("Salotto"), "luce_salotto", "mdi-sofa"], ingresso: [T("Ingresso"), "luce_ingresso", "mdi-door"], corridoio: [T("Corridoio"), "luce_corridoio", "mdi-wall-sconce-flat"],
      cucina: [T("Cucina"), "luce_cucina", "mdi-chef-hat"], balcone: [T("Balcone"), "luce_balcone", "mdi-outdoor-lamp"], camera: [T("Camera"), "luce_camera", "mdi-bed-king"], cameretta: [T("Cameretta"), "luce_cameretta", "mdi-teddy-bear"],
      bagno_piccolo: [T("Bagno piccolo"), "luce_bagno_piccolo", "mdi-toilet"], bagno_doccia: [T("Bagno doccia"), "luce_bagno_doccia", "mdi-shower-head"], lavanderia: [T("Lavanderia"), "luce_lavanderia", "mdi-washing-machine"], sgabuzzino: [T("Sgabuzzino"), "luce_sgabuzzino", "mdi-package-variant-closed"]
    };
    var ROOMS = [
      { n: T("Zona giorno"), ic: "mdi-sofa", c: "#8B5CF6", w: 3, l: ["salotto", "ingresso", "corridoio"], s: ["salotto", "ingresso", "corridoio"], o: ["ingresso", "balcone_salotto"] },
      { n: T("Cucina"), ic: "mdi-chef-hat", c: "#F59E0B", w: 3, l: ["cucina", "balcone"], s: ["cucina"], o: ["balcone_cucina"], cell: true },
      { n: T("Zona notte"), ic: "mdi-bed-king", c: "#3B82F6", w: 2, l: ["camera", "cameretta"], s: ["camera", "cameretta"], o: ["cameretta", "balcone_camera"] },
      { n: T("Bagni"), ic: "mdi-shower-head", c: "#14B8A6", w: 2, l: ["bagno_piccolo", "bagno_doccia"], s: [], o: ["bagno"] },
      { n: T("Servizi"), ic: "mdi-washing-machine", c: "#22C55E", w: 2, l: ["lavanderia", "sgabuzzino"], s: ["lavanderia", "sgabuzzino"], o: ["lavanderia"] }
    ];
    ROOMS.forEach(function (r) { r.t = r.l.slice(); });
    var MOTION = [["salotto", T("Salotto")], ["ingresso", T("Ingresso")], ["cucina", T("Cucina")], ["corridoio", T("Corridoio")], ["cameretta", T("Cameretta")], ["lavanderia", T("Lavanderia")], ["sgabuzzino", T("Sgabuzzino")], ["camera", T("Camera")]];
    var OPENS = { ingresso: [T("Porta ingresso"), "sensore_porta", T("Aperta"), T("Chiusa")], balcone_salotto: [T("Balcone salotto"), "sensore_finestra", T("Aperto"), T("Chiuso")], balcone_cucina: [T("Balcone cucina"), "sensore_finestra", T("Aperto"), T("Chiuso")],
      cameretta: [T("Finestra cameretta"), "sensore_finestra", T("Aperta"), T("Chiusa")], balcone_camera: [T("Balcone camera"), "sensore_finestra", T("Aperto"), T("Chiuso")], bagno: [T("Finestra bagno"), "sensore_finestra", T("Aperta"), T("Chiusa")], lavanderia: [T("Finestra lavanderia"), "sensore_finestra", T("Aperta"), T("Chiusa")], cancello: [T("Serratura"), "sensore_cancello", T("Sbloccata"), T("Bloccata")] };
    var TLBL = {};
    Object.keys(LIGHTS).forEach(function (k) { TLBL[k] = LIGHTS[k][0]; });
    var OP = {}, OPNA = {}, motNa = 0;
    var SCENES = [
      { id: "morning", n: T("Buongiorno"), sub: T("Cucina, corridoio, bagno"), img: "scena_buongiorno", ic: "mdi-weather-sunset-up", s1: "#F59E0B", s2: "#F43F5E", lights: ["cucina", "corridoio", "bagno_piccolo"], alarm: null, msg: T("Buongiorno! Cucina, corridoio e bagno accesi.") },
      { id: "cinema", n: T("Cinema"), sub: T("Solo il salotto"), img: "scena_cinema", ic: "mdi-movie-open", s1: "#8B5CF6", s2: "#EC4899", lights: ["salotto"], alarm: null, msg: T("Scena Cinema: solo il salotto resta acceso.") },
      { id: "dinner", n: T("Cena"), sub: T("Cucina e salotto"), img: "scena_cena", ic: "mdi-silverware-fork-knife", s1: "#F97316", s2: "#FACC15", lights: ["cucina", "salotto"], alarm: null, msg: T("Scena Cena: cucina e salotto accesi.") },
      { id: "night", n: T("Buonanotte"), sub: T("Spegne tutto · allarme notte"), img: "scena_notte", ic: "mdi-weather-night", s1: "#6366F1", s2: "#22D3EE", lights: [], alarm: "armed_night", msg: T("Buonanotte! Luci spente, allarme in modalità notte.") },
      { id: "away", n: T("Esco di casa"), sub: T("Spegne tutto · allarme fuori"), img: "scena_esco", ic: "mdi-door-open", s1: "#10B981", s2: "#06B6D4", lights: [], alarm: "armed_away", msg: T("Casa chiusa: luci spente, allarme inserito.") }
    ];
    var ALARM = {
      disarmed:    { t: T("Disattivato"),         d: T("Casa libera. Scegli una modalità per armare l'allarme."),             s: "off",   short: T("Allarme off"),        art: "allarme_off" },
      armed_night: { t: T("Armato · Notte"),      d: T("Porte e finestre sorvegliate. Il movimento interno viene ignorato."), s: "armed", short: T("Allarme notte"),      art: "allarme_notte" },
      armed_away:  { t: T("Armato · Fuori casa"), d: T("Tutta la casa è sorvegliata, compreso il movimento interno."),        s: "armed", short: T("Allarme fuori casa"), art: "allarme_fuori" },
      arming:      { t: T("Si sta armando…"),     d: T("L'allarme si inserirà tra pochi secondi."),                            s: "armed", short: T("Allarme in inserimento"), art: "allarme_fuori" },
      triggered:   { t: T("ALLARME ATTIVO"),      d: T("L'allarme è scattato. Controlla le telecamere."),                      s: "alarm", short: T("ALLARME ATTIVO"),     art: "allarme_scattato" }
    };
    var state = { lights: { salotto: true, ingresso: false, corridoio: false, cucina: true, balcone: false, camera: false, cameretta: false, bagno_piccolo: false, bagno_doccia: false, lavanderia: false, sgabuzzino: false }, alarm: "disarmed", scene: null };

    /* entità di Home Assistant (modificabili con la config della scheda: entities: { ... }) */
    var ENT = {
      /* nomi di ESEMPIO: sostituiscili nella configurazione YAML della scheda (vedi la guida) */
      lights: { salotto: "light.salotto", ingresso: "light.ingresso", corridoio: "light.corridoio", cucina: "light.cucina", balcone: "light.balcone", camera: "light.camera", cameretta: "light.cameretta", bagno_piccolo: "light.bagno_piccolo", bagno_doccia: "light.bagno_doccia", lavanderia: "light.lavanderia", sgabuzzino: "light.sgabuzzino" },
      motion: { salotto: ["binary_sensor.salotto_movimento"], ingresso: ["binary_sensor.ingresso_movimento"], cucina: ["binary_sensor.cucina_movimento"], corridoio: ["binary_sensor.corridoio_movimento"],
        cameretta: ["binary_sensor.cameretta_movimento"], lavanderia: ["binary_sensor.lavanderia_movimento"], sgabuzzino: ["binary_sensor.sgabuzzino_movimento"], camera: ["binary_sensor.camera_movimento"] },
      opens: { ingresso: "binary_sensor.porta_ingresso", balcone_salotto: "binary_sensor.balcone_salotto", balcone_cucina: "binary_sensor.balcone_cucina", cameretta: "binary_sensor.finestra_cameretta", balcone_camera: "binary_sensor.balcone_camera", bagno: "binary_sensor.finestra_bagno", lavanderia: "binary_sensor.finestra_lavanderia", cancello: "lock.serratura_ingresso" },
      temps: {},   /* temperature per stanza (chiave = luce della stanza): temps: { salotto: [sensor.a, sensor.b] } */
      alarm: "alarm_control_panel.allarme", weather: "weather.forecast_home", power: "sensor.potenza_casa",
      energy: {
        power: "sensor.potenza_casa", voltage: "sensor.tensione_casa", energyTotal: "sensor.energia_totale_casa",
        today: "sensor.energia_oggi", yesterday: "sensor.energia_ieri", month: "sensor.energia_mese", lastMonth: "sensor.energia_mese_scorso", year: "sensor.energia_anno",
        costToday: "sensor.costo_oggi", costYesterday: "sensor.costo_ieri", costMonth: "sensor.costo_mese", costLastMonth: "sensor.costo_mese_scorso", costYear: "sensor.costo_anno",
        base: "sensor.consumo_di_fondo", avg3: "sensor.potenza_media_3_ore", limit: "input_number.soglia_potenza", limitDefault: 3000,
        price: "input_number.prezzo_energia", priceDefault: 0.30,   /* tariffa €/kWh: helper di HA (creato al primo salvataggio) e valore di esempio */
        liveRefresh: 0,   /* secondi: se > 0 chiede a Home Assistant di rileggere il contatore (utile per Shelly e simili) */
        appliances: []
      },
      climate: "climate.salotto",
      cameras: []
    };
    /* finestre illuminate dei mondi: ogni finestra (salotto, cucina, camera, cameretta, ingresso) segue una luce */
    var WINMAP = { salotto: "salotto", cucina: "cucina", camera: "camera", cameretta: "cameretta", ingresso: "ingresso" };
    var CUSTOM = Array.isArray(CFG.rooms) && CFG.rooms.length > 0;

    /* ---- stanze dalla configurazione ---- */
    var ROOM_COLORS = ["#8B5CF6", "#F59E0B", "#3B82F6", "#14B8A6", "#22C55E", "#EC4899", "#06B6D4", "#F97316", "#A78BFA", "#EAB308"];
    var IMG_ICON = { luce_salotto: "mdi-sofa", luce_ingresso: "mdi-door", luce_corridoio: "mdi-wall-sconce-flat", luce_cucina: "mdi-chef-hat", luce_balcone: "mdi-outdoor-lamp", luce_camera: "mdi-bed-king", luce_cameretta: "mdi-teddy-bear", luce_bagno_piccolo: "mdi-toilet", luce_bagno_doccia: "mdi-shower-head", luce_lavanderia: "mdi-washing-machine", luce_sgabuzzino: "mdi-package-variant-closed" };
    /* immagine scelta dal nome della stanza o della luce (italiano e inglese) */
    var IMG_GUESS = [
      [/cucin|kitchen|cottur|dining|pranzo/i, "luce_cucina"], [/cameret|bimb|child|kid|nursery|bambin|ragazz/i, "luce_cameretta"],
      [/camera|letto|bed|notte|sleep|master|ospit|guest/i, "luce_camera"], [/doccia|shower|vasca|bath/i, "luce_bagno_doccia"],
      [/bagno|wc|toilet|restroom|lavabo/i, "luce_bagno_piccolo"], [/corrido|hallway|scal|stair|disimpegn|landing|passag/i, "luce_corridoio"],
      [/ingress|entr|hall|porta|door|foyer/i, "luce_ingresso"], [/balcon|terrazz|terrace|patio|giardin|garden|portic|porch|outdoor|estern|yard|cortil/i, "luce_balcone"],
      [/lavander|laundry|lavatric|utility/i, "luce_lavanderia"], [/sgabuzz|ripost|storage|closet|cantin|cellar|garage|soffitt|attic|ufficio|office|studio|study/i, "luce_sgabuzzino"],
      [/salot|soggiorn|living|lounge|salon|tv|divan|sofa/i, "luce_salotto"]
    ];
    function guessImg(txt) { for (var i = 0; i < IMG_GUESS.length; i++) if (IMG_GUESS[i][0].test(txt || "")) return IMG_GUESS[i][1]; return null; }
    function libImg(x) { if (!x) return null; x = String(x); if (IMG[x]) return x; if (IMG["luce_" + x]) return "luce_" + x; return null; }
    function mdi(x) { return x ? String(x).replace(/^mdi:/, "mdi-") : null; }
    function arrIds(x) { return Array.isArray(x) ? x.filter(Boolean) : (x ? [x] : []); }
    function hsv0(id) { var h = ctx.hass; return h && h.states && h.states[id] ? h.states[id] : null; }
    function niceName(id) { var s = hsv0(id); if (s && s.attributes && s.attributes.friendly_name) return s.attributes.friendly_name; return id ? id.split(".").pop().replace(/_/g, " ").replace(/^./, function (c) { return c.toUpperCase(); }) : ""; }
    /* tipo di apertura: door (porta), window (finestra), gate (cancello), lock (serratura) */
    function openKind(x) {
      if (x.type) return x.type;
      if (/^lock\./.test(x.entity)) return "lock";
      var s = hsv0(x.entity), dc = s && s.attributes ? s.attributes.device_class : "";
      if (dc === "window") return "window";
      if (dc === "garage_door" || /cancell|gate/i.test(x.name || x.entity)) return "gate";
      if (/finestr|window|balcon|terrazz|lucernar|skylight/i.test((x.name || "") + " " + x.entity)) return "window";
      return "door";
    }
    var OPEN_KIND = {
      door: ["sensore_porta", "Aperta", "Chiusa"], window: ["sensore_finestra", "Aperta", "Chiusa"],
      gate: ["sensore_cancello", "Aperto", "Chiuso"], lock: ["sensore_cancello", "Sbloccata", "Bloccata"]
    };
    function roomsFromCfg() {
      LIGHTS = {}; ROOMS = []; MOTION = []; OPENS = {}; TLBL = {};
      ENT.lights = {}; ENT.motion = {}; ENT.opens = {}; ENT.temps = {}; state.lights = {};
      CFG.rooms.forEach(function (r, i) {
        if (!r) return;
        var name = r.name || T("Stanza") + " " + (i + 1), rk = "r" + i;
        var rImg = libImg(r.image) || guessImg(name) || "luce_salotto";
        var room = { n: name, ic: mdi(r.icon) || IMG_ICON[rImg] || "mdi-home", c: r.color || ROOM_COLORS[i % ROOM_COLORS.length], l: [], s: [], o: [], t: [] };
        arrIds(r.lights).forEach(function (x, j) {
          x = typeof x === "string" ? { entity: x } : x;
          if (!x || !x.entity) return;
          var k = rk + "l" + j, lname = x.name || niceName(x.entity) || name;
          var img = libImg(x.image) || guessImg(x.name || "") || rImg;
          LIGHTS[k] = [lname, img, mdi(x.icon) || IMG_ICON[img] || "mdi-lightbulb", "luce_" + k];
          ENT.lights[k] = x.entity; room.l.push(k); state.lights[k] = false;
        });
        var mot = arrIds(r.motion).map(function (x) { return typeof x === "string" ? x : x && x.entity; }).filter(Boolean);
        if (mot.length) { ENT.motion[rk] = mot; MOTION.push([rk, name]); room.s.push(rk); }
        arrIds(r.openings).forEach(function (x, j) {
          x = typeof x === "string" ? { entity: x } : x;
          if (!x || !x.entity) return;
          var k = rk + "o" + j, kd = OPEN_KIND[openKind(x)] || OPEN_KIND.door;
          OPENS[k] = [x.name || niceName(x.entity), kd[0], T(kd[1]), T(kd[2])];
          ENT.opens[k] = x.entity; room.o.push(k);
        });
        var tmp = arrIds(r.temperature).map(function (x) { return typeof x === "string" ? x : x && x.entity; }).filter(Boolean);
        if (tmp.length) { ENT.temps[rk] = tmp; TLBL[rk] = name; room.t.push(rk); }
        room.w = room.l.length >= 3 ? 3 : 2;
        ROOMS.push(room);
      });
      /* finestre dei mondi: la prima luce di ogni stanza, nell'ordine salotto, cucina, camera, cameretta, ingresso */
      var firsts = ROOMS.map(function (r) { return r.l[0]; }).filter(Boolean), all = Object.keys(LIGHTS);
      ["salotto", "cucina", "camera", "cameretta", "ingresso"].forEach(function (slot, i) { WINMAP[slot] = firsts[i] || all[i] || null; });
    }
    /* scene: scenes: [{ id: morning, name, lights: [light.x, ...], alarm: armed_night, entity: scene.x, show: false }] */
    function scenesFromCfg() {
      var byEnt = {};
      Object.keys(ENT.lights).forEach(function (k) { byEnt[ENT.lights[k]] = k; });
      var list = Array.isArray(CFG.scenes) ? CFG.scenes : [];
      SCENES.forEach(function (sc) {
        var c = list.filter(function (x) { return x && x.id === sc.id; })[0];
        if (CUSTOM) { sc.lights = []; if (!c && !sc.alarm) sc.hide = true; }
        if (CUSTOM && sc.alarm && !CFG.entities.alarm) { sc.alarm = null; sc.sub = T("Spegne tutte le luci"); sc.msg = T("Luci spente."); }
        if (!c) return;
        if (c.show === false) { sc.hide = true; return; }
        sc.hide = false;
        if (c.name) sc.n = c.name;
        if (c.alarm !== undefined) sc.alarm = c.alarm || null;
        if (!sc.alarm && (sc.id === "night" || sc.id === "away")) { sc.sub = T("Spegne tutte le luci"); sc.msg = T("Luci spente."); }
        if (c.entity) { sc.entity = c.entity; sc.lights = []; }
        if (c.lights) {
          sc.lights = arrIds(c.lights).map(function (x) { return LIGHTS[x] ? x : byEnt[x]; }).filter(Boolean);
          var names = sc.lights.map(function (k) { return LIGHTS[k][0]; });
          sc.sub = names.length ? names.slice(0, 3).join(", ") + (names.length > 3 ? " +" + (names.length - 3) : "") : T("Spegne tutte le luci");
          sc.msg = T("Scena {n}: luci impostate.", { n: sc.n });
        }
        if (c.entity && !c.lights) { sc.sub = c.sub || niceName(c.entity); sc.msg = T("Scena {n} avviata.", { n: sc.n }); }
        if (c.sub) sc.sub = c.sub;
      });
      SCENES = SCENES.filter(function (sc) { return !sc.hide; });
    }
    (function mergeCfg() {
      CFG.entities = CFG.entities || {};
      var e = CFG.entities;
      if (T.lang === "en") ENT.energy.price = "input_number.energy_price";
      /* con le stanze configurate niente nomi di esempio: si usa solo ciò che è scritto nella config */
      if (CUSTOM) {
        ENT.alarm = ENT.weather = ENT.power = ENT.climate = null;
        Object.keys(ENT.energy).forEach(function (k) { var v = ENT.energy[k]; if (typeof v === "string" && k !== "price" && k !== "limit") ENT.energy[k] = null; });
        roomsFromCfg();
      }
      else ["lights", "motion", "opens", "temps"].forEach(function (g2) { if (e[g2]) Object.keys(e[g2]).forEach(function (k) { ENT[g2][k] = e[g2][k]; }); });
      ["alarm", "weather", "power", "climate", "cameras"].forEach(function (k) { if (e[k] !== undefined) ENT[k] = e[k]; });
      if (e.energy) Object.keys(e.energy).forEach(function (k) { ENT.energy[k] = e.energy[k]; });
      /* luci oltre alle 11 standard: extraLights: [{ k: "strip_led", n: "Strip LED", id: "light.strip_led", room: "Cucina", ic: "mdi-led-strip-variant" }] */
      if (!CUSTOM) (e.extraLights || []).forEach(function (x) {
        if (!x || !x.k || !x.id || LIGHTS[x.k]) return;
        var room = ROOMS.filter(function (r) { return r.n === x.room || r.n === T(x.room); })[0] || ROOMS[0];
        LIGHTS[x.k] = [x.n || x.k, x.img || LIGHTS[room.l[0]][1], x.ic || "mdi-lightbulb", "luce_" + x.k];
        ENT.lights[x.k] = x.id; room.l.push(x.k); state.lights[x.k] = false;
      });
      if (CFG.windows) Object.keys(CFG.windows).forEach(function (slot) { var v = CFG.windows[slot]; WINMAP[slot] = LIGHTS[v] ? v : Object.keys(ENT.lights).filter(function (k) { return ENT.lights[k] === v; })[0] || null; });
      scenesFromCfg();
      Object.keys(OPENS).forEach(function (k) { OP[k] = false; });
    })();
    var HASS = null;
    function sv(id) { return HASS && id && HASS.states[id] ? HASS.states[id] : null; }
    function availId(ids) { ids = Array.isArray(ids) ? ids : [ids]; for (var i = 0; i < ids.length; i++) { var s = sv(ids[i]); if (s && s.state !== "unavailable" && s.state !== "unknown") return ids[i]; } return ids[0]; }
    function isUnavail(s) { return !s || s.state === "unavailable" || s.state === "unknown"; }
    function call(domain, service, data) {
      if (!ctx.call) return Promise.resolve();
      try { return Promise.resolve(ctx.call(domain, service, data)).catch(function (e) { toast(T("Non riuscito: {e}", { e: (e && e.message) || T("errore di Home Assistant") }), "mdi-alert-circle", "var(--warn)"); }); }
      catch (e) { toast(T("Non riuscito: {e}", { e: e.message }), "mdi-alert-circle", "var(--warn)"); return Promise.resolve(); }
    }
    function moreInfo(id) { if (!id) return; if (ctx.moreInfo) ctx.moreInfo(id); }

    /* ------------------------------------------------------------------ toast + scintille */
    var toastT;
    function toast(msg, icon, color) {
      var t = $("#toast");
      $("#toast-text").textContent = msg;
      var i = $("i", t); setIco(i, icon || "mdi-check-circle"); i.style.color = color || "var(--ok)";
      t.classList.add("show"); clearTimeout(toastT);
      toastT = setTimeout(function () { t.classList.remove("show"); }, 2600);
    }
    function burst(x, y, c1, c2) {
      if (reduce) return;
      var off = EMB ? LAYER.getBoundingClientRect() : { left: 0, top: 0 };
      for (var k = 0; k < 16; k++) {
        var s = el("span", "spark"); s.style.left = (x - off.left) + "px"; s.style.top = (y - off.top) + "px"; s.style.background = k % 2 ? c1 : c2; LAYER.appendChild(s);
        var a = Math.random() * Math.PI * 2, d = 36 + Math.random() * 64;
        var an = s.animate([{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 }, { transform: "translate(calc(-50% + " + Math.cos(a) * d + "px), calc(-50% + " + Math.sin(a) * d + "px)) scale(0)", opacity: 0 }], { duration: 600 + Math.random() * 300, easing: "cubic-bezier(.16,1,.3,1)" });
        an.onfinish = (function (n) { return function () { n.remove(); }; })(s);
      }
    }

    /* ------------------------------------------------------------------ costruzione interfaccia */
    function buildScenes() {
      var box = $("#scenes");
      SCENES.forEach(function (sc) {
        var b = el("button", "scene", '<img class="s-img" alt="" draggable="false"><span class="s-ico"><i class="mdi ' + sc.ic + '"></i></span><span><b>' + esc(sc.n) + "</b><small>" + esc(sc.sub) + "</small></span>" + PEN, { type: "button", "data-scene": sc.id, "data-img": sc.img, "data-label": T("Scena {n}", { n: sc.n }), "data-on": "0" });
        b.style.setProperty("--s1", sc.s1); b.style.setProperty("--s2", sc.s2);
        b.addEventListener("mouseenter", function () { b.dataset.on = "1"; refreshImg(b); });
        b.addEventListener("mouseleave", function () { b.dataset.on = state.scene === sc.id ? "1" : "0"; refreshImg(b); });
        b.addEventListener("click", function () { runScene(sc, b); });
        box.appendChild(b);
      });
    }
    function motionLabel(k) { return MOTION.filter(function (m) { return m[0] === k; })[0][1]; }
    function hasMotion(k) { return !LIVE || (ENT.motion[k] && ENT.motion[k].length); }
    function sensChip(k) {
      var label = motionLabel(k);
      return '<span class="sens" data-sensor="' + k + '" data-img="sensore_movimento" data-ov="mov_' + k + '" data-label="' + esc(T("Movimento {n}", { n: label })) + '" data-on="0"><span class="s-ph"><img class="s-img" alt="" draggable="false"></span><i class="mdi mdi-motion-sensor"></i>' + esc(label) + PEN + "</span>";
    }
    /* movimento di una stanza: acceso se almeno un sensore disponibile vede movimento, offline solo se lo sono tutti */
    function roomMot(k) {
      var ids = arrIds(ENT.motion[k]), on = null, ok = [], last = null;
      ids.forEach(function (i) { var s = sv(i); if (isUnavail(s)) return; ok.push(i); if (s.state === "on" && !on) on = i; if (s.last_changed && (!last || new Date(s.last_changed) > last)) last = new Date(s.last_changed); });
      return { id: on || ok[0] || ids[0], on: !!on, na: ids.length > 0 && !ok.length, last: last };
    }
    function hasTemp(k) { return arrIds(ENT.temps[k]).length > 0; }
    function roomTemp(k) { var id = availId(arrIds(ENT.temps[k])), s = sv(id); if (isUnavail(s) || isNaN(parseFloat(s.state))) return { id: id, na: true }; return { id: id, v: parseFloat(s.state), na: false }; }
    function tSuffix(k) { if (!hasTemp(k)) return ""; var r = roomTemp(k); return r.na ? "" : " · " + fmt(r.v) + "°"; }
    function tempChip(k) { return '<span class="sens tsens" data-temp="' + k + '" data-lvl="ok"><span class="t-ph"><i class="mdi mdi-thermometer"></i></span>' + esc(TLBL[k] || k) + ' <b class="t-val">—</b></span>'; }
    function openChip(id) {
      if (LIVE && !ENT.opens[id]) return "";
      var o = OPENS[id];
      return '<span class="sens" data-op="' + id + '" data-img="' + o[1] + '" data-ov="op_' + id + '" data-label="' + esc(o[0]) + '" data-on="0"><span class="s-ph"><img class="s-img" alt="" draggable="false"></span><i class="mdi mdi-door-closed"></i>' + esc(o[0]) + PEN + "</span>";
    }
    function longPress(node, fn) {
      var t = 0, fired = false;
      node.addEventListener("pointerdown", function () { fired = false; clearTimeout(t); t = setTimeout(function () { fired = true; fn(); }, 550); });
      ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { node.addEventListener(ev, function () { clearTimeout(t); }); });
      node.addEventListener("click", function (e) { if (fired) { e.stopImmediatePropagation(); e.preventDefault(); fired = false; } }, true);
    }
    function buildRooms() {
      var box = $("#rooms");
      /* stanze dalla config: righe che si riempiono da sole, ogni stanza larga in proporzione alle sue luci */
      if (CUSTOM) box.classList.add("auto");
      ROOMS.forEach(function (r) {
        var card = el("article", "card room w" + r.w); card.style.setProperty("--room", r.c);
        if (CUSTOM) card.style.setProperty("--n", Math.min(3, Math.max(2, r.l.length)));
        var orbs = "";
        r.l.forEach(function (k) {
          var L = LIGHTS[k];
          orbs += '<button class="orb" type="button" data-light="' + k + '" data-img="' + L[1] + '"' + (L[3] ? ' data-ov="' + L[3] + '"' : "") + ' data-label="' + esc(T("Luce {n}", { n: L[0].toLowerCase() })) + '" data-on="0" aria-pressed="false">' +
            '<img class="o-img" alt="" draggable="false"><span class="o-shade"></span><span class="sw"></span><span class="o-ico"><i class="mdi ' + L[2] + '"></i></span>' +
            '<span class="o-txt"><span class="o-name">' + esc(L[0]) + '</span><span class="o-state">' + T("Spenta") + '</span></span>' + PEN + "</button>";
        });
        var chips = r.s.filter(hasMotion).map(sensChip).join("") + (r.t || []).filter(hasTemp).map(tempChip).join("") + r.o.map(openChip).join("");
        var body = orbs;
        if (r.cell) body += '<div class="sens-cell sensors">' + chips + "</div>"; else if (chips) body += '<div class="sensors strip">' + chips + "</div>";
        if (!r.l.length) card.classList.add("nolights");
        card.innerHTML = '<div class="room-head"><span class="r-ico"><i class="mdi ' + r.ic + '"></i></span><h3>' + esc(r.n) + '</h3><span class="count">0/' + r.l.length + '</span></div><div class="bar"><i></i></div><div class="room-body">' + body + "</div>";
        hydrate(card);
        box.appendChild(card);
      });
      $$(".orb").forEach(function (o) {
        o.addEventListener("click", function () {
          var k = o.dataset.light;
          if (LIVE) {
            var s = sv(ENT.lights[k]);
            if (isUnavail(s)) { toast(T("{n}: dispositivo non disponibile", { n: LIGHTS[k][0] }), "mdi-alert-circle", "var(--warn)"); return; }
            var want = !state.lights[k];
            call("homeassistant", "toggle", { entity_id: ENT.lights[k] });
            later(function () {
              var s2 = sv(ENT.lights[k]);
              if (isUnavail(s2)) toast(T("{n}: non risponde, non so se il comando è arrivato", { n: LIGHTS[k][0] }), "mdi-alert-circle", "var(--warn)");
              else if ((s2.state === "on") !== want) toast(T("{n}: il comando non ha avuto effetto", { n: LIGHTS[k][0] }), "mdi-alert-circle", "var(--warn)");
              syncLights(); render();
            }, 3000);
          }
          state.lights[k] = !state.lights[k]; state.scene = null;
          o.classList.remove("pop"); void o.offsetWidth; o.classList.add("pop");
          if (state.lights[k]) { var rc = o.getBoundingClientRect(); burst(rc.left + 34, rc.top + 34, getComputedStyle(o).getPropertyValue("--room") || "#fff", "#fff"); }
          render();
        });
        o.addEventListener("animationend", function (e) { if (e.animationName === "pop") o.classList.remove("pop"); });
        if (LIVE) longPress(o, function () { moreInfo(ENT.lights[o.dataset.light]); });
      });
      $$("[data-op]").forEach(function (c) { c.addEventListener("click", function () { onOpenTap(c.dataset.op); }); c.style.cursor = "pointer"; });
      $$(".sens[data-sensor]").forEach(function (c) { if (LIVE) { c.addEventListener("click", function () { moreInfo(roomMot(c.dataset.sensor).id); }); c.style.cursor = "pointer"; } });
      $$(".tsens").forEach(function (c) { if (LIVE) { c.addEventListener("click", function () { moreInfo(roomTemp(c.dataset.temp).id); }); c.style.cursor = "pointer"; } });
    }
    function buildSecurity() {
      var mt = $("#motion-tiles");
      MOTION.filter(function (m) { return hasMotion(m[0]); }).forEach(function (m) {
        var b = el("button", "stile", '<img class="st-img" alt="" draggable="false"><i class="mdi mdi-motion-sensor st-ico"></i><span class="st-txt"><span class="st-name">' + esc(m[1]) + '</span><span class="st-state">' + T("Nessun movimento") + '</span></span>' + PEN, { type: "button", "data-sensor": m[0], "data-img": "sensore_movimento", "data-ov": "mov_" + m[0], "data-label": T("Movimento {n}", { n: m[1] }), "data-on": "0" });
        b.addEventListener("click", function () { if (LIVE) moreInfo(roomMot(m[0]).id); else motion(m[0]); });
        mt.appendChild(b);
      });
      var ot = $("#open-tiles");
      Object.keys(OPENS).filter(function (id) { return !LIVE || ENT.opens[id]; }).forEach(function (id) {
        var o = OPENS[id];
        var b = el("button", "stile", '<img class="st-img" alt="" draggable="false"><i class="mdi mdi-door-closed st-ico"></i><span class="st-txt"><span class="st-name">' + esc(o[0]) + '</span><span class="st-state">' + esc(o[3]) + "</span></span>" + PEN, { type: "button", "data-op": id, "data-img": o[1], "data-ov": "op_" + id, "data-label": o[0], "data-on": "0" });
        b.addEventListener("click", function () { onOpenTap(id); });
        ot.appendChild(b);
      });
      /* senza sensori il riquadro non serve */
      if (LIVE && !mt.children.length) mt.closest(".panel").hidden = true;
      if (LIVE && !ot.children.length) ot.closest(".panel").hidden = true;
      var g2 = mt.closest(".grid2"); if (g2 && LIVE && !mt.children.length && !ot.children.length) g2.hidden = true;
    }

    /* ------------------------------------------------------------------ render */
    function render() {
      var total = 0, nUn = 0;
      $$(".orb").forEach(function (o) {
        var on = !!state.lights[o.dataset.light];
        if (on) total++;
        o.setAttribute("aria-pressed", on ? "true" : "false"); o.dataset.on = on ? "1" : "0";
        var na = LIVE && isUnavail(sv(ENT.lights[o.dataset.light]));
        if (na) nUn++;
        o.classList.toggle("na", na);
        $(".o-state", o).textContent = na ? T("Non disponibile") : (on ? T("Accesa") : T("Spenta"));
        refreshImg(o);
      });
      $$(".room").forEach(function (r) {
        var orbs = $$(".orb", r), n = orbs.filter(function (o) { return state.lights[o.dataset.light]; }).length;
        $(".count", r).textContent = n + "/" + orbs.length;
        $(".bar i", r).style.width = (orbs.length ? n / orbs.length * 100 : 0) + "%";
      });
      $$(".wglow").forEach(function (w) { w.classList.toggle("on", !!state.lights[WINMAP[w.dataset.k]]); });
      var a = ALARM[state.alarm] || ALARM.disarmed;
      var lt = total ? T(total === 1 ? "{n} luce accesa" : "{n} luci accese", { n: total }) : (LIVE ? T("Nessuna luce accesa") : T("Tutte le luci spente"));
      if (LIVE && nUn) lt += " · " + T(nUn === 1 ? "{n} non risponde" : "{n} non rispondono", { n: nUn });
      $("#status-text").textContent = lt + (!LIVE || sv(ENT.alarm) ? " · " + a.short : "");
      $$(".scene").forEach(function (b) { var act = b.dataset.scene === state.scene; b.classList.toggle("active", act); b.dataset.on = act ? "1" : "0"; refreshImg(b); });
      paintStatus();
    }

    /* ------------------------------------------------------------------ scene */
    function runScene(sc, b) {
      var onIds = [], offIds = [], skipped = 0;
      if (LIVE && sc.entity) {
        /* scena o script di Home Assistant */
        var dom = sc.entity.split(".")[0];
        call(dom === "script" ? "script" : dom === "automation" ? "automation" : "scene", dom === "automation" ? "trigger" : "turn_on", { entity_id: sc.entity });
        if (sc.alarm) armAlarm(sc.alarm, true);
        state.scene = sc.id;
        toast(T("Scena {n} avviata.", { n: sc.n }), sc.ic, sc.s1);
        var r0 = $(".s-img", b).getBoundingClientRect(); burst(r0.left + r0.width / 2, r0.top + r0.height / 2, sc.s1, sc.s2);
        render(); return;
      }
      if (LIVE) {
        Object.keys(ENT.lights).forEach(function (k) { var s = sv(ENT.lights[k]); if (isUnavail(s)) { skipped++; return; } (sc.lights.indexOf(k) > -1 ? onIds : offIds).push(ENT.lights[k]); });
        if (onIds.length) call("homeassistant", "turn_on", { entity_id: onIds });
        if (offIds.length) call("homeassistant", "turn_off", { entity_id: offIds });
        if (sc.alarm) armAlarm(sc.alarm, true);
      } else if (sc.alarm) setAlarm(sc.alarm, true);
      Object.keys(state.lights).forEach(function (k) { state.lights[k] = sc.lights.indexOf(k) > -1; });
      state.scene = sc.id;
      var r = $(".s-img", b).getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, sc.s1, sc.s2);
      if (!LIVE) toast(sc.msg, sc.ic, sc.s1);
      else { toast(T("Scena {n}: invio i comandi…", { n: sc.n }), sc.ic, sc.s1); later(function () { sceneReport(sc, onIds, offIds, skipped); }, 3200); }
      render();
    }
    /* il messaggio finale descrive lo stato letto da Home Assistant, non quello che speravamo */
    function sceneReport(sc, onIds, offIds, skipped) {
      var bad = 0, na = skipped, parts = [];
      syncLights();
      onIds.forEach(function (id) { var s = sv(id); if (isUnavail(s)) na++; else if (s.state !== "on") bad++; });
      offIds.forEach(function (id) { var s = sv(id); if (isUnavail(s)) na++; else if (s.state === "on") bad++; });
      parts.push(bad ? T(bad === 1 ? "{n} luce non ha risposto" : "{n} luci non hanno risposto", { n: bad }) : T("luci come previsto"));
      if (na) parts.push(T(na === 1 ? "{n} non raggiungibile" : "{n} non raggiungibili", { n: na }));
      if (sc.alarm) { var al = sv(ENT.alarm); parts.push($("#codebox").classList.contains("open") ? T("allarme: serve il codice") : (al ? ALARM[mapAlarm(al.state)].short.toLowerCase() : T("allarme non trovato"))); }
      if (bad && state.scene === sc.id) state.scene = null;
      render();
      toast(T("Scena {n}", { n: sc.n }) + ": " + parts.join(" · "), sc.ic, (bad || na) ? "var(--warn)" : sc.s1);
    }

    /* ------------------------------------------------------------------ allarme */
    function movePill() {
      var pill = $("#seg-pill"), btn = $('#seg button[aria-pressed="true"]');
      if (!pill) return;
      if (!btn || !btn.offsetWidth) { pill.style.opacity = btn ? 1 : 0; return; }
      pill.style.opacity = 1; pill.style.width = btn.offsetWidth + "px"; pill.style.transform = "translateX(" + (btn.offsetLeft - 5) + "px)";
    }
    function setAlarm(key, silent) {
      state.alarm = key;
      var a = ALARM[key] || ALARM.disarmed;
      HOST.dataset.alarm = a.s;
      $("#alarm").dataset.state = a.s;
      $("#alarm-title").textContent = a.t; $("#alarm-desc").textContent = a.d;
      $$("#seg button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.mode === key || (key === "arming" && b.dataset.mode === "armed_away") ? "true" : "false"); });
      $("#alert").hidden = key !== "triggered";
      $("#shield").dataset.img = a.art; refreshImg($("#shield"));
      movePill();
      if (!silent) { render(); toast(a.t, key === "disarmed" ? "mdi-shield-off" : "mdi-shield-check", key === "disarmed" ? "var(--ok)" : "var(--warn)"); }
    }
    var codeCb = null;
    function askCode(title, cb) {
      $("#code-sub").textContent = title; $("#code-in").value = ""; codeCb = cb;
      $("#codebox").classList.add("open"); $("#codebox").setAttribute("aria-hidden", "false");
      later(function () { $("#code-in").focus(); }, 200);
    }
    function closeCode() { $("#codebox").classList.remove("open"); $("#codebox").setAttribute("aria-hidden", "true"); codeCb = null; }
    function armAlarm(mode, fromScene) {
      var s = sv(ENT.alarm);
      if (!s) { toast(T("Centrale allarme non trovata"), "mdi-alert-circle", "var(--warn)"); return; }
      var feat = s.attributes.supported_features || 0, svc, needCode;
      if (mode === "disarmed") { svc = "alarm_disarm"; needCode = !!s.attributes.code_format; }
      else if (mode === "armed_away") { svc = "alarm_arm_away"; needCode = !!s.attributes.code_format && s.attributes.code_arm_required !== false; }
      else { svc = (feat & 4) ? "alarm_arm_night" : "alarm_arm_home"; needCode = !!s.attributes.code_format && s.attributes.code_arm_required !== false; }
      var run = function (code) {
        var d = { entity_id: ENT.alarm }; if (code) d.code = code; call("alarm_control_panel", svc, d);
        if (!fromScene) later(function () {
          var a2 = sv(ENT.alarm), k2 = a2 ? mapAlarm(a2.state) : null;
          if (k2 === mode || (mode !== "disarmed" && (k2 === "arming" || k2 === "triggered"))) toast(ALARM[k2].t, k2 === "disarmed" ? "mdi-shield-off" : "mdi-shield-check", k2 === "disarmed" ? "var(--ok)" : "var(--warn)");
          else toast(T("Allarme: la centrale non ha eseguito il comando (codice errato o non disponibile)"), "mdi-alert-circle", "var(--warn)");
        }, 3500);
      };
      if (needCode) askCode((s.attributes.friendly_name || T("Allarme")) + " · " + ALARM[mode].t, run); else run();
      if (!fromScene) toast(needCode ? T("Serve il codice per: {m}", { m: ALARM[mode].t }) : T("Invio: {m}…", { m: ALARM[mode].t }), "mdi-shield-sync", "var(--warn)");
    }
    function mapAlarm(st) {
      if (st === "triggered") return "triggered";
      if (st === "arming" || st === "pending") return "arming";
      if (st === "armed_away" || st === "armed_vacation") return "armed_away";
      if (st && st.indexOf("armed") === 0) return "armed_night";
      return "disarmed";
    }

    /* ------------------------------------------------------------------ sensori */
    var lastMotion = null, lastAt = 0;
    var motState = {};   /* stanza → { on, na, last }: serve alla finestra del movimento */
    function setMotionUI(key, act, na) {
      var prev = motState[key] || {};
      motState[key] = { on: !!act, na: !!na, last: act ? new Date() : prev.last };
      if (!!prev.on !== !!act || !!prev.na !== !!na) later(paintStatus, 0);
      $$('[data-sensor="' + key + '"]').forEach(function (n) {
        n.classList.toggle("active", !!act); n.classList.toggle("na", !!na); n.dataset.on = act ? "1" : "0"; refreshImg(n);
        var st = $(".st-state", n); if (st) st.textContent = (na ? T("Non disponibile") : (act ? T("Movimento!") : T("Nessun movimento"))) + tSuffix(key);
      });
    }
    function motion(key) {   // solo anteprima
      var label = motionLabel(key);
      setMotionUI(key, true, false);
      $("#hero-motion").textContent = T("Movimento: {n}", { n: label });
      lastMotion = label; lastAt = Date.now();
      later(function () { setMotionUI(key, false, false); $("#hero-motion").textContent = T("Casa tranquilla"); }, 3200);
    }
    function motionLoop() { if (!running) return; motion(MOTION[Math.floor(Math.random() * MOTION.length)][0]); later(motionLoop, 5200 + Math.random() * 3800); }
    function setOpenUI(id, open, na) {
      var o = OPENS[id]; OP[id] = open; OPNA[id] = !!na;
      $$('[data-op="' + id + '"]').forEach(function (n) {
        n.classList.toggle("open", open); n.classList.toggle("na", !!na); n.dataset.on = open ? "1" : "0"; refreshImg(n);
        var st = $(".st-state", n); if (st) st.textContent = na ? T("Non disponibile") : (open ? o[2] : o[3]);
      });
      var n = Object.keys(OP).filter(function (k) { return OP[k] && (!LIVE || ENT.opens[k]); }).length;
      var nn = Object.keys(OPNA).filter(function (k) { return OPNA[k] && (!LIVE || ENT.opens[k]); }).length, off = nn ? T(nn === 1 ? "{n} sensore offline" : "{n} sensori offline", { n: nn }) : "";
      $("#open-sub").textContent = n === 0 ? (nn ? T("Nessuna aperta") + " · " + off : T("Tutto chiuso")) : T(n === 1 ? "{n} apertura attiva" : "{n} aperture attive", { n: n }) + (nn ? " · " + off : "");
    }
    function onOpenTap(id) { if (LIVE) moreInfo(ENT.opens[id]); else setOpenUI(id, !OP[id], false); }
    function lastMotionText() {
      if (!lastMotion) return;
      var s = Math.round((Date.now() - lastAt) / 1000), t = s < 4 ? T("adesso") : s < 60 ? T("{n} s fa", { n: s }) : s < 3600 ? T("{n} min fa", { n: Math.round(s / 60) }) : T("{n} h fa", { n: Math.round(s / 3600) });
      $("#last-motion").textContent = T("Ultimo movimento: {n}", { n: lastMotion }) + " · " + t + (motNa ? " · " + T(motNa === 1 ? "{n} sensore offline" : "{n} sensori offline", { n: motNa }) : "");
    }

    /* ------------------------------------------------------------------ barra in alto: luci accese e movimento
       Un tocco su "N luci accese" apre l'elenco delle luci accese (tocca per spegnerle);
       un tocco su "Movimento" apre le stanze con i sensori, quelle con movimento in cima. */
    var stOpen = null, stBtn = null, stPop = $("#st-pop");
    function lightRoom(k) { for (var i = 0; i < ROOMS.length; i++) if (ROOMS[i].l.indexOf(k) > -1) return ROOMS[i].n; return ""; }
    function litKeys() { return Object.keys(state.lights).filter(function (k) { return state.lights[k] && LIGHTS[k] && (!LIVE || ENT.lights[k]); }); }
    function motRooms() { return MOTION.filter(function (m) { return hasMotion(m[0]); }); }
    function motInfo(k) { if (LIVE) return roomMot(k); var m = motState[k] || {}; return { on: !!m.on, na: false, last: m.last || null, id: null }; }
    function ago(d) {
      if (!d) return T("mai");
      var sec = Math.round((Date.now() - d) / 1000);
      return sec < 4 ? T("adesso") : sec < 60 ? T("{n} s fa", { n: sec }) : sec < 3600 ? T("{n} min fa", { n: Math.round(sec / 60) }) : sec < 86400 ? T("{n} h fa", { n: Math.round(sec / 3600) }) : T("{n} g fa", { n: Math.round(sec / 86400) });
    }
    function paintStatus() {
      var lit = litKeys().length, rooms = motRooms(), act = rooms.filter(function (m) { return motInfo(m[0]).on; });
      $("#st-lcount").textContent = lit;
      var mb = $("#st-motion");
      mb.hidden = !rooms.length;
      mb.classList.toggle("st-on", act.length > 0);
      $("#st-mcount").textContent = act.length;
      $("#st-motion-text").textContent = !act.length ? T("Nessun movimento") : act.length === 1 ? T("Movimento: {n}", { n: act[0][1] }) : T("Movimento in {n} stanze", { n: act.length });
      mb.setAttribute("aria-label", $("#st-motion-text").textContent);
      $("#status").setAttribute("aria-label", $("#status-text").textContent);
      if (stOpen) renderPop(false);
    }
    function stItem(i, cls, inner) { var b = el("button", "st-item" + (cls ? " " + cls : ""), inner, { type: "button" }); b.style.setProperty("--i", i); return b; }
    var stSig = "";
    /* first: entrata animata; poi si ridisegna solo se cambia qualcosa, senza animazione */
    function renderPop(first) {
      var list = $("#st-list"), foot = $("#st-foot");
      var sig = stOpen + "|" + (stOpen === "lights" ? litKeys().join(",") + "|" + state.alarm : motRooms().map(function (m) { var mi = motInfo(m[0]); return m[0] + (mi.on ? 1 : 0) + (mi.na ? 1 : 0) + ago(mi.last); }).join(","));
      if (!first && sig === stSig) return;
      stSig = sig;
      list.classList.toggle("st-still", !first);
      list.innerHTML = ""; foot.innerHTML = "";
      if (stOpen === "lights") {
        var keys = litKeys();
        $("#st-pop-title").textContent = T("Luci accese");
        $("#st-pop-sub").textContent = keys.length ? T("Tocca una luce per spegnerla") : "";
        keys.forEach(function (k, i) {
          var L = LIGHTS[k], src = resolve(L[3] || L[1], L[1], true);
          var b = stItem(i, "", '<img class="st-thumb" alt="" draggable="false" src="' + esc(src) + '"><span class="st-txt"><b>' + esc(L[0]) + "</b><small>" + esc(lightRoom(k)) + '</small></span><span class="st-act" aria-hidden="true"><i class="mdi mdi-power"></i></span>');
          b.setAttribute("aria-label", T("Spegni {n}", { n: L[0] }));
          b.addEventListener("click", function () { lightOff(k, b); });
          list.appendChild(b);
        });
        if (!keys.length) list.appendChild(el("div", "st-empty", '<i class="mdi mdi-lightbulb-off-outline"></i>' + esc(T("Tutte le luci sono spente"))));
        if (keys.length > 1) { var all = el("button", "btn", '<i class="mdi mdi-lightbulb-off-outline"></i>' + esc(T("Spegni tutte")), { type: "button" }); all.addEventListener("click", function () { $("#dock-off").click(); }); foot.appendChild(all); }
        if (!LIVE || sv(ENT.alarm)) {
          var a = ALARM[state.alarm] || ALARM.disarmed, ab = el("button", "btn ghost", '<i class="mdi mdi-shield-home"></i>' + esc(T("Allarme: {s}", { s: a.t })), { type: "button" });
          ab.addEventListener("click", function () { closePop(); show("sic"); }); foot.appendChild(ab);
        }
      } else {
        var rooms = motRooms().map(function (m) { var mi = motInfo(m[0]); return { k: m[0], n: m[1], on: mi.on, na: mi.na, last: mi.last, id: mi.id }; });
        rooms.sort(function (x, y) { return (y.on - x.on) || ((y.last ? +y.last : 0) - (x.last ? +x.last : 0)); });
        var on = rooms.filter(function (r) { return r.on; }).length;
        $("#st-pop-title").textContent = T("Sensori di movimento");
        $("#st-pop-sub").textContent = !on ? T("Nessun movimento adesso") : on === 1 ? T("Movimento in {n} stanza", { n: 1 }) : T("Movimento in {n} stanze", { n: on });
        rooms.forEach(function (r, i) {
          var txt = r.na ? T("Non disponibile") : r.on ? T("Movimento adesso") : r.last ? T("Ultimo movimento {t}", { t: ago(r.last) }) : T("Nessun movimento registrato");
          var b = stItem(i, r.on ? "on" : r.na ? "na" : "", '<span class="st-mdot" aria-hidden="true"></span><span class="st-txt"><b>' + esc(r.n) + "</b><small>" + esc(txt) + "</small></span>" + (LIVE ? '<i class="mdi mdi-chevron-right st-go" aria-hidden="true"></i>' : ""));
          b.addEventListener("click", function () { if (LIVE && r.id) moreInfo(r.id); });
          list.appendChild(b);
        });
        var sb = el("button", "btn ghost", '<i class="mdi mdi-shield-home"></i>' + esc(T("Apri Sicurezza")), { type: "button" });
        sb.addEventListener("click", function () { closePop(); show("sic"); }); foot.appendChild(sb);
      }
      hydrate(stPop);
    }
    function lightOff(k, b) {
      b.classList.add("going");
      if (LIVE && ENT.lights[k]) call("homeassistant", "turn_off", { entity_id: ENT.lights[k] });
      state.lights[k] = false; state.scene = null;
      toast(T("{n}: spenta", { n: LIGHTS[k][0] }), "mdi-lightbulb-off-outline", "var(--acc-text)");
      later(render, 300);
    }
    function placePop() {
      if (!stBtn || window.matchMedia("(max-width: 720px)").matches) { stPop.style.left = ""; return; }
      var tb = $(".topbar").getBoundingClientRect(), r = stBtn.getBoundingClientRect(), w = stPop.offsetWidth;      stPop.style.left = Math.max(12, Math.min(r.left - tb.left + r.width / 2 - w / 2, tb.width - w - 12)) + "px";
    }
    function openPop(kind, btn) {
      if (stOpen === kind) { closePop(); return; }
      stOpen = kind; stBtn = btn;
      $$(".status-row .status").forEach(function (x) { x.setAttribute("aria-expanded", x === btn ? "true" : "false"); });
      stPop.hidden = false; stPop.style.animation = "none"; void stPop.offsetWidth; stPop.style.animation = "";
      renderPop(true); placePop();
    }
    function closePop() {
      if (!stOpen) return;
      stOpen = null; stPop.hidden = true;
      $$(".status-row .status").forEach(function (x) { x.setAttribute("aria-expanded", "false"); });
      if (stBtn) stBtn.focus({ preventScroll: true });
    }
    $("#status").addEventListener("click", function () { openPop("lights", this); });
    $("#st-motion").addEventListener("click", function () { openPop("motion", this); });
    $("#st-pop-close").addEventListener("click", closePop);
    on(document, "pointerdown", function (e) {
      if (!stOpen) return;
      var path = e.composedPath ? e.composedPath() : [e.target];
      if (path.indexOf(stPop) < 0 && !path.some(function (n) { return n.classList && n.classList.contains("status"); })) closePop();
    });
    on(document, "keydown", function (e) { if (e.key === "Escape" && stOpen) closePop(); });

    /* ------------------------------------------------------------------ viste + dock */
    function scrollTop0() { var o = { top: 0, behavior: reduce ? "auto" : "smooth" }; if (SCROLL === window) window.scrollTo(o); else SCROLL.scrollTo(o); }
    var VIEWS = { home: "#view-home", sic: "#view-sic", en: "#view-en" };
    function show(which) {
      Object.keys(VIEWS).forEach(function (k) { var v = $(VIEWS[k]); if (k === which) { v.hidden = false; v.classList.remove("enter"); void v.offsetWidth; v.classList.add("enter"); } else v.hidden = true; });
      $$(".dock [data-view]").forEach(function (b) { if (b.dataset.view === which) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
      scrollTop0();
      if (LIVE) { if (which === "sic") camsEnter(); else camsStopAll(); }
      if (which === "en") enEnter();
      if (PK) PK.shown(which);
      requestAnimationFrame(function () { movePill(); if (which === "home") { fxHero.resize(); } });
    }
    $$(".dock [data-view]").forEach(function (b) { b.addEventListener("click", function () { show(b.dataset.view); }); });
    $("#dock-scenes").addEventListener("click", function () { show("home"); later(function () { $("#scenes").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" }); }, 60); });
    $("#dock-off").addEventListener("click", function (e) {
      var r = e.currentTarget.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + 10, "#A5B4FC", "#67E8F9");
      Object.keys(state.lights).forEach(function (k) { state.lights[k] = false; }); state.scene = null;
      if (!LIVE) { toast(T("Tutte le luci spente"), "mdi-lightbulb-off-outline", "var(--acc-text)"); render(); return; }
      /* il comando va a TUTTE le luci configurate, senza fidarsi dello stato letto: ogni tanto un dispositivo risulta "non disponibile" o con lo stato in ritardo */
      var ids = Object.keys(ENT.lights).map(function (k) { return ENT.lights[k]; }).filter(function (id) { return !!sv(id); });
      if (!ids.length) { toast(T("Nessuna luce trovata: controlla le entità nella configurazione"), "mdi-alert-circle", "var(--warn)"); render(); return; }
      call("homeassistant", "turn_off", { entity_id: ids });
      toast(T("Spengo {n} luci…", { n: ids.length }), "mdi-lightbulb-off-outline", "var(--acc-text)");
      later(function () {
        var rest = ids.filter(function (id) { var s = sv(id); return s && (s.state === "on" || isUnavail(s)); });
        if (!rest.length) { syncLights(); render(); toast(T("Tutte le luci spente"), "mdi-lightbulb-off-outline", "var(--ok)"); return; }
        call("homeassistant", "turn_off", { entity_id: rest });   /* secondo tentativo per chi non ha risposto */
        later(function () {
          syncLights(); render();
          var on = ids.filter(function (id) { var s = sv(id); return s && s.state === "on"; }).length, na = ids.filter(function (id) { return isUnavail(sv(id)); }).length;
          if (on) toast(T(on === 1 ? "{n} luce è ancora accesa" : "{n} luci sono ancora accese", { n: on }) + (na ? " · " + T(na === 1 ? "{n} non raggiungibile" : "{n} non raggiungibili", { n: na }) : ""), "mdi-alert-circle", "var(--warn)");
          else if (na) toast(T(na === 1 ? "{n} luce non risponde: non so se sia spenta" : "{n} luci non rispondono: non so se siano spente", { n: na }), "mdi-alert-circle", "var(--warn)");
          else toast(T("Tutte le luci spente"), "mdi-lightbulb-off-outline", "var(--ok)");
        }, 3500);
      }, 3000);
      render();
    });
    $$("#seg button").forEach(function (b) { b.addEventListener("click", function () { if (LIVE) armAlarm(b.dataset.mode); else setAlarm(b.dataset.mode); }); });
    $("#sim-alarm").addEventListener("click", function () { show("sic"); setAlarm("triggered", true); render(); toast(T("Allarme attivo!"), "mdi-alarm-light", "var(--danger)"); });
    $("#alert-off").addEventListener("click", function () { if (LIVE) armAlarm("disarmed"); else setAlarm("disarmed"); });
    $("#code-cancel").addEventListener("click", closeCode);
    $("#code-ok").addEventListener("click", function () { var c = $("#code-in").value, cb = codeCb; closeCode(); if (cb && c) cb(c); });
    $("#code-in").addEventListener("keydown", function (e) { if (e.key === "Enter") $("#code-ok").click(); });

    /* ------------------------------------------------------------------ mondo + ora del giorno */
    var S = { world: store("world") || "casetta", fx: store("fx") || "none", fxPage: store("fxpage") === "1", cycle: false, btn: store("btn") || "img" };
    if (!AMB.W[S.world]) S.world = "casetta";
    if (S.fx !== "none" && !FX.E[S.fx]) S.fx = "none";
    var drawerOpen = false;
    var clockLive = true, hour = 21, artFront = $("#art-a"), artBack = $("#art-b"), artKey = "", artTok = 0;
    var userName = "Alex";

    function snap(h) { var q = clockLive ? 4 : 2; return Math.round(h * q) / q; }
    function setArt(force) {
      var h = snap(hour), key = S.world + "|" + h;
      if (key === artKey && !force) return;
      artKey = key;
      var tok = ++artTok, back = artBack;
      back.onload = function () { if (tok !== artTok) return; back.classList.add("show"); artFront.classList.remove("show"); artBack = artFront; artFront = back; };
      back.src = AMB.dataURL(S.world, h);
      if (drawerOpen) refreshWorldThumbs();
    }
    function buildWindows() {
      var layer = $("#win-layer"); layer.innerHTML = "";
      (AMB.W[S.world].windows || []).forEach(function (w) {
        if (!WINMAP[w.k]) return;
        var d = el("div", "wglow" + (state.lights[WINMAP[w.k]] ? " on" : ""), "", { "data-k": w.k });
        d.style.left = (w.x / 640 * 100) + "%"; d.style.top = (w.y / 260 * 100) + "%"; d.style.width = (w.w / 640 * 100) + "%"; d.style.height = (w.h / 260 * 100) + "%";
        layer.appendChild(d);
      });
    }
    function applyWorld() {
      $("#hero-tag-text").textContent = T(AMB.W[S.world].name);
      buildWindows(); setArt(true); store("world", S.world);
      $$(".wcard").forEach(function (c) { c.classList.toggle("sel", c.dataset.world === S.world); });
    }
    function setWorld(id, quiet) { S.world = id; applyWorld(); if (!quiet) toast(T("Mondo: {n}", { n: T(AMB.W[id].name) }), AMB.W[id].icon, "var(--acc-text)"); }
    function applyHour(h) {
      hour = h;
      var K = AMB.palette(h);
      ["b1", "b2", "b3", "a1", "a2"].forEach(function (k) { HOST.style.setProperty("--" + k, K[k]); });
      HOST.style.setProperty("--win", K.win);
      var hh = Math.floor(h) % 24, mm = Math.round((h - Math.floor(h)) * 60);
      if (mm === 60) { mm = 0; hh = (hh + 1) % 24; }
      $("#clock").innerHTML = pad(hh) + '<span class="colon">:</span>' + pad(mm);
      $("#phase-out").textContent = pad(hh) + ":" + pad(mm);
      $("#phase-range").value = h;
      setIco($("#phase-icon"), K.dy < .12 ? "mdi-weather-night" : K.dy > .8 ? "mdi-weather-sunny" : (h < 12 ? "mdi-weather-sunset-up" : "mdi-weather-sunset-down"));
      var gr = (h >= 22 || h < 5) ? T("Buonanotte") : h < 12 ? T("Buongiorno") : h < 18 ? T("Buon pomeriggio") : T("Buonasera");
      $("#greet").textContent = gr + ", " + userName;
      setArt();
    }
    function tickClock() { if (!clockLive) return; var d = new Date(); applyHour(d.getHours() + d.getMinutes() / 60); }
    function tickDate() { var n = new Date(), t = n.toLocaleDateString(LOC, { weekday: "long", day: "numeric", month: "long" }).replace(",", ""); $("#date-text").textContent = t.charAt(0).toUpperCase() + t.slice(1); }
    $("#phase-range").addEventListener("input", function (e) { clockLive = false; applyHour(parseFloat(e.target.value)); });
    $("#phase-real").addEventListener("click", function () { clockLive = true; tickClock(); toast(T("Ora reale ripristinata"), "mdi-clock-outline", "var(--acc-text)"); });

    /* ------------------------------------------------------------------ effetti */
    var fxHero = new FX.Fx($("#fx-hero"), { k: 1, alpha: 1, onFlash: flash });
    var fxPage = new FX.Fx($("#fx-page"), { k: .55, alpha: .6, onFlash: flash });
    function flash(a) { HOST.style.setProperty("--flash", a.toFixed(3)); }
    function applyFx() {
      fxHero.set(S.fx); fxPage.set(S.fxPage ? S.fx : "none");
      store("fx", S.fx); store("fxpage", S.fxPage ? "1" : "0");
      $$(".fxchip").forEach(function (c) { c.classList.toggle("sel", c.dataset.fx === S.fx); });
      $("#fx-page-toggle").setAttribute("aria-pressed", S.fxPage ? "true" : "false");
    }

    /* ------------------------------------------------------------------ tema + stile pulsanti */
    function setTheme(t) { HOST.dataset.theme = t; setIco($("#theme-ico"), t === "dark" ? "mdi-weather-night" : "mdi-white-balance-sunny"); store("theme", t); }
    $("#theme-btn").addEventListener("click", function () { setTheme(HOST.dataset.theme === "dark" ? "light" : "dark"); });
    function setBtn(v) { S.btn = v; HOST.dataset.btn = v; store("btn", v); $$("#btn-style button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.v === v ? "true" : "false"); }); }

    /* ------------------------------------------------------------------ pannello Stile */
    function buildDrawer() {
      var w = $("#worlds");
      Object.keys(AMB.W).forEach(function (id) {
        var d = AMB.W[id], b = el("button", "wcard", '<img alt="" draggable="false"><span><i class="mdi ' + d.icon + '"></i>' + T(d.name) + "</span>", { type: "button", "data-world": id, title: T(d.desc) });
        b.addEventListener("click", function () { setWorld(id); });
        w.appendChild(b);
      });
      var fg = $("#fxgrid");
      var none = el("button", "fxchip", '<i class="mdi mdi-cancel"></i>' + T("Nessuno"), { type: "button", "data-fx": "none" });
      none.addEventListener("click", function () { S.fx = "none"; applyFx(); });
      fg.appendChild(none);
      Object.keys(FX.E).forEach(function (id) {
        var e = FX.E[id], c = el("button", "fxchip", '<i class="mdi ' + e.icon + '"></i>' + T(e.name), { type: "button", "data-fx": id });
        c.addEventListener("click", function () { S.fx = id; applyFx(); });
        fg.appendChild(c);
      });
    }
    function refreshWorldThumbs() { $$(".wcard").forEach(function (c) { $("img", c).src = AMB.dataURL(c.dataset.world, snap(hour)); }); }
    function openDrawer() { drawerOpen = true; refreshWorldThumbs(); $("#drawer").classList.add("open"); $("#drawer").setAttribute("aria-hidden", "false"); $("#scrim").classList.add("open"); later(function () { $("#dr-close").focus({ preventScroll: true }); }, 350); }
    function closeDrawer() { drawerOpen = false; $("#drawer").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true"); $("#scrim").classList.remove("open"); }
    ["style-btn", "hint-style", "dock-style", "hero-tag"].forEach(function (id) { $("#" + id).addEventListener("click", openDrawer); });
    $("#dr-close").addEventListener("click", closeDrawer); $("#scrim").addEventListener("click", closeDrawer);
    $("#fx-page-toggle").addEventListener("click", function () { S.fxPage = !S.fxPage; applyFx(); });
    var cycleT = 0;
    $("#cycle-toggle").addEventListener("click", function () {
      S.cycle = !S.cycle; this.setAttribute("aria-pressed", S.cycle ? "true" : "false"); clearInterval(cycleT);
      if (S.cycle) { cycleT = setInterval(function () { var ids = Object.keys(AMB.W), i = ids.indexOf(S.world); setWorld(ids[(i + 1) % ids.length], true); }, 30000); timers.push(cycleT); toast(T("Il mondo cambierà ogni 30 secondi"), "mdi-shuffle-variant", "var(--acc-text)"); }
    });
    $$("#btn-style button").forEach(function (b) { b.addEventListener("click", function () { setBtn(b.dataset.v); }); });
    $("#reset-all").addEventListener("click", function () { try { Object.keys(localStorage).filter(function (k) { return k.indexOf("aurora-v3-") === 0; }).forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {} location.reload(); });

    /* ------------------------------------------------------------------ modalità modifica + editor */
    function setEdit(onOff) { if (onOff) HOST.dataset.edit = "1"; else delete HOST.dataset.edit; $("#edit-banner").hidden = !onOff; }
    $("#edit-start").addEventListener("click", function () { closeDrawer(); setEdit(true); show("home"); });
    $("#hint-edit").addEventListener("click", function () { setEdit(true); });
    $("#edit-done").addEventListener("click", function () { setEdit(false); });
    on(ROOT, "click", function (e) {
      if (HOST.dataset.edit !== "1" || e.target.closest("#editor") || e.target.closest("#edit-banner") || e.target.closest("#drawer") || e.target.closest(".topbar") || e.target.closest(".dock")) return;
      var t = e.target.closest("[data-img]");
      if (!t) return;
      e.preventDefault(); e.stopPropagation(); openEditor(t);
    }, true);

    var edBase = "", edOv = "", edTab = 0;
    function openEditor(node) {
      edBase = node.dataset.img; edOv = node.dataset.ov || edBase;
      var b = IMG[edBase]; edTab = 0;
      LIBGROUPS.forEach(function (g2, i) { if (edBase.indexOf(g2[1]) === 0) edTab = i; });
      $("#ed-title").textContent = node.dataset.label || T("Modifica immagine");
      $("#ed-sub").textContent = b.kind === "pair" ? T("Un'immagine da spento (PNG) e una da acceso (meglio una GIF animata)") : T("L'immagine mostrata per questo stato");
      renderEditor();
      $("#editor").classList.add("open"); $("#editor").setAttribute("aria-hidden", "false");
    }
    function closeEditor() { $("#editor").classList.remove("open"); $("#editor").setAttribute("aria-hidden", "true"); }
    function slotHTML(label, slot) {
      return '<div class="slot"><h4>' + label + '</h4><label class="drop" data-slot="' + slot + '"><img alt="" src="' + resolve(edOv, edBase, slot === "on") + '"><span class="hintt">' + T("Clic o trascina un file") + '</span><input type="file" accept="image/*"></label></div>';
    }
    function renderEditor() {
      var b = IMG[edBase], slots = $("#ed-slots");
      if (b.kind === "pair") { slots.className = "slots"; slots.innerHTML = slotHTML(T("Spento"), "off") + slotHTML(T("Acceso"), "on"); }
      else { slots.className = "slots one"; slots.innerHTML = '<div class="slot"><h4>' + T("Immagine") + '</h4><label class="drop" data-slot="src"><img alt="" src="' + resolve(edOv, edBase, true) + '"><span class="hintt">' + T("Clic o trascina un file") + '</span><input type="file" accept="image/*"></label></div>'; }
      $$(".drop", slots).forEach(function (d) {
        var slot = d.dataset.slot;
        $("input", d).addEventListener("change", function (e) { if (e.target.files[0]) readFile(e.target.files[0], slot); });
        d.addEventListener("dragover", function (e) { e.preventDefault(); d.classList.add("over"); });
        d.addEventListener("dragleave", function () { d.classList.remove("over"); });
        d.addEventListener("drop", function (e) { e.preventDefault(); d.classList.remove("over"); if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0], slot); });
      });
      var tabs = $("#lib-tabs"); tabs.innerHTML = "";
      LIBGROUPS.forEach(function (g2, i) { var t = el("button", "", g2[0], { type: "button", "aria-pressed": i === edTab ? "true" : "false" }); t.addEventListener("click", function () { edTab = i; renderEditor(); }); tabs.appendChild(t); });
      var lib = $("#lib"); lib.innerHTML = "";
      Object.keys(IMG).filter(function (k) { return k.indexOf(LIBGROUPS[edTab][1]) === 0; }).forEach(function (k) {
        var it = IMG[k], c = el("button", "", '<img alt="" src="' + (it.kind === "pair" ? it.off : it.src) + '"><span>' + LIBNAMES[k] + "</span>", { type: "button", title: LIBNAMES[k] });
        if (it.kind === "pair") { c.addEventListener("mouseenter", function () { $("img", c).src = it.on; }); c.addEventListener("mouseleave", function () { $("img", c).src = it.off; }); }
        c.addEventListener("click", function () { applyLib(k); });
        lib.appendChild(c);
      });
    }
    function readFile(file, slot) {
      if (!/^image\//.test(file.type)) { toast(T("Scegli un file immagine (PNG, JPG, GIF, WebP)"), "mdi-alert-circle", "var(--warn)"); return; }
      if (file.size > 3 * 1024 * 1024) { toast(T("File troppo pesante (massimo 3 MB)"), "mdi-alert-circle", "var(--warn)"); return; }
      var fr = new FileReader();
      fr.onload = function () {
        var prev = OV[edOv] ? JSON.parse(JSON.stringify(OV[edOv])) : null;
        OV[edOv] = OV[edOv] || {}; OV[edOv][slot] = fr.result;
        if (!saveOV()) { if (prev) OV[edOv] = prev; else delete OV[edOv]; return; }
        refreshAll(); renderEditor(); toast(T("Immagine aggiornata"), "mdi-image-check", "var(--ok)");
      };
      fr.readAsDataURL(file);
    }
    function applyLib(k) {
      var it = IMG[k], b = IMG[edBase];
      if (b.kind === "pair") OV[edOv] = { off: it.off || it.src, on: it.on || it.src }; else OV[edOv] = { src: it.on || it.src };
      saveOV(); refreshAll(); renderEditor(); toast(T("Immagine «{n}» applicata", { n: LIBNAMES[k] }), "mdi-image-check", "var(--ok)");
    }
    $("#ed-reset").addEventListener("click", function () { delete OV[edOv]; saveOV(); refreshAll(); renderEditor(); toast(T("Immagine originale ripristinata"), "mdi-restore", "var(--acc-text)"); });

    $("#ed-done").addEventListener("click", closeEditor); $("#ed-close").addEventListener("click", closeEditor);
    $("#editor").addEventListener("click", function (e) { if (e.target === this) closeEditor(); });
    on(document, "keydown", function (e) { if (e.key === "Escape") { if ($("#codebox").classList.contains("open")) closeCode(); else if ($("#editor").classList.contains("open")) closeEditor(); else if (drawerOpen) closeDrawer(); else if (HOST.dataset.edit === "1") setEdit(false); } });

    /* ------------------------------------------------------------------ Home Assistant: sincronizzazione */
    var tracked = {};
    function trackedIds() {
      var ids = [ENT.alarm, ENT.weather, ENT.power, ENT.climate];
      Object.keys(ENT.lights).forEach(function (k) { ids.push(ENT.lights[k]); });
      Object.keys(ENT.motion).forEach(function (k) { (ENT.motion[k] || []).forEach(function (i) { ids.push(i); }); });
      Object.keys(ENT.opens).forEach(function (k) { ids.push(ENT.opens[k]); });
      Object.keys(ENT.temps).forEach(function (k) { arrIds(ENT.temps[k]).forEach(function (i) { ids.push(i); }); });
      (ENT.cameras || []).forEach(function (c) { if (c.cam) ids.push(c.cam); });
      Object.keys(ENT.energy).forEach(function (k) { var v = ENT.energy[k]; if (typeof v === 'string' && v.indexOf('.') > 0) ids.push(v); });
      ENT.energy.appliances.forEach(function (x) { ids.push(x.p); if (x.e) ids.push(x.e); });
      return ids.filter(Boolean);
    }
    function condIcon(c) { return { sunny: "mdi-weather-sunny", "clear-night": "mdi-weather-night", cloudy: "mdi-weather-cloudy", partlycloudy: "mdi-weather-partly-cloudy", rainy: "mdi-weather-rainy", pouring: "mdi-weather-pouring", snowy: "mdi-weather-snowy", "snowy-rainy": "mdi-weather-snowy-rainy", fog: "mdi-weather-fog", lightning: "mdi-weather-lightning", "lightning-rainy": "mdi-weather-lightning-rainy", windy: "mdi-weather-windy", hail: "mdi-weather-hail" }[c] || "mdi-weather-partly-cloudy"; }
    function fmt(n, d) { return Number(n).toLocaleString(LOC, { maximumFractionDigits: d === undefined ? 1 : d }); }
    function syncLights() { Object.keys(ENT.lights).forEach(function (k) { var s = sv(ENT.lights[k]); state.lights[k] = !!s && s.state === "on"; }); }
    function syncLive(first) {
      // luci
      syncLights();
      // scena evidenziata solo finché lo stato coincide
      if (state.scene) { var sc = SCENES.filter(function (x) { return x.id === state.scene; })[0]; if (sc && Object.keys(ENT.lights).some(function (k) { return !isUnavail(sv(ENT.lights[k])) && (sc.lights.indexOf(k) > -1) !== state.lights[k]; })) state.scene = null; }
      // allarme
      var a = sv(ENT.alarm);
      if (a) { var key = mapAlarm(a.state); if (key !== state.alarm || first) setAlarm(key, true); var eb = $(".alarm-txt .eyebrow"); if (eb && a.attributes.friendly_name) eb.textContent = a.attributes.friendly_name; }
      // movimento
      var act = null, newest = null, mTot = 0, mNa = 0;
      MOTION.forEach(function (m) {
        var rm = roomMot(m[0]), na = rm.na, isOn = rm.on;
        setMotionUI(m[0], isOn, na);
        if (hasMotion(m[0])) { mTot++; if (na) mNa++; }
        if (isOn && !act) act = m[1];
        if (rm.last && (!newest || rm.last > newest.t)) newest = { t: rm.last, label: m[1] };
      });
      $$(".tsens").forEach(function (c) {
        var r = roomTemp(c.dataset.temp), v = $(".t-val", c);
        c.classList.toggle("na", r.na); c.dataset.lvl = r.na ? "ok" : (r.v < 18 ? "cold" : (r.v > 26 ? "warm" : "ok"));
        if (v) v.textContent = r.na ? T("n.d.") : fmt(r.v) + "°";
        c.title = r.na ? T("Sensore di temperatura non disponibile") : "";
      });
      motNa = mNa;
      $("#hero-motion").textContent = act ? T("Movimento: {n}", { n: act }) : (mTot && mNa === mTot ? T("Sensori di movimento offline") : mNa ? T("Nessun movimento") + " · " + T(mNa === 1 ? "{n} sensore offline" : "{n} sensori offline", { n: mNa }) : T("Casa tranquilla"));
      if (newest) { lastMotion = newest.label; lastAt = newest.t.getTime(); lastMotionText(); } else $("#last-motion").textContent = mTot && mNa === mTot ? T("Nessun sensore di movimento risponde") : T("Nessun movimento recente");
      // aperture
      Object.keys(OPENS).forEach(function (id) {
        if (!ENT.opens[id]) return;
        var s = sv(ENT.opens[id]), na = isUnavail(s), open = !!s && (s.state === "on" || s.state === "open" || s.state === "unlocked" || s.state === "unlocking" || s.state === "jammed");
        setOpenUI(id, open, na);
      });
      // chip meteo e consumi
      var w = sv(ENT.weather), ct = $("#chip-temp");
      if (w && w.attributes.temperature !== undefined) { ct.hidden = false; $("#temp-val").textContent = fmt(w.attributes.temperature) + " " + (w.attributes.temperature_unit || "°C"); setIco($("#temp-ico"), condIcon(w.state)); } else ct.hidden = true;
      var p = sv(ENT.energy.power) || sv(ENT.power), cp = $("#chip-power");
      if (p && !isUnavail(p) && !isNaN(parseFloat(p.state))) { cp.hidden = false; var v = parseFloat(p.state), u = p.attributes.unit_of_measurement || "W"; if (u === "kW") v *= 1000; chipPower(v); } else cp.hidden = true;
      var nm = HASS && HASS.user && HASS.user.name ? HASS.user.name.split(" ")[0] : "";
      if (nm && nm !== userName) { userName = nm; tickClock(); if (!clockLive) applyHour(hour); }
      climaFromHass(); renderClima();
      var enBtn = $('.dock [data-view="en"]'); if (enBtn) enBtn.hidden = !(sv(ENT.energy.power) || sv(ENT.power));
      renderEnergy(); if (!$("#view-en").hidden) enLoad(false);
      camsStatus();
      render();
    }
    /* ---- telecamere: anteprima (snapshot) aggiornata + diretta a tocco ---- */
    var camTiles = [];
    function camRefresh(t) {
      var s = sv(t.c.img), ep = s && s.attributes.entity_picture;
      if (!ep) { t.im.hidden = true; t.na.hidden = false; return; }
      t.last = Date.now();
      t.im.onload = function () { t.im.hidden = false; t.na.hidden = true; camMeta(t); };
      t.im.onerror = function () { t.im.hidden = true; t.na.hidden = false; camMeta(t); };
      t.im.src = ep + (ep.indexOf("?") > -1 ? "&" : "?") + "_t=" + Date.now();
    }
    function camWhen(iso) {
      var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso || "");
      if (!m) return "";
      var now = new Date(), same = now.getFullYear() == m[1] && (now.getMonth() + 1) == +m[2] && now.getDate() == +m[3];
      return (same ? T("oggi") + " " : m[3] + "/" + m[2] + " ") + m[4] + ":" + m[5];
    }
    function camOffline(t) { return !!t.c.cam && isUnavail(sv(t.c.cam)); }
    function camMeta(t) {
      var off = camOffline(t), ok = !t.im.hidden, d = new Date(), parts = [];
      if (t.c.kind === "motion") { var s = sv(t.c.img), w = s && camWhen(s.state); if (w) parts.push(T("Ultimo movimento {t}", { t: w })); }
      else if (ok) parts.push(T("Immagine caricata alle {t}", { t: pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) }));
      t.meta.textContent = parts.join(" · ");
      if (t.off) t.off.hidden = !off;
      var msg = t.na.querySelector("span");
      if (msg) msg.innerHTML = off ? T("Telecamera offline") + "<br>" + T("HA non la raggiunge in questo momento") : T("Anteprima non disponibile") + "<br>" + T("tocca per aprire la telecamera");
    }
    function camsStatus() { camTiles.forEach(camMeta); }
    function camLive(t, onOff) {
      if (!t.c.live || !window.loadCardHelpers) return;
      clearTimeout(t.timer);
      if (onOff) {
        window.loadCardHelpers().then(function (h) {
          try { var e = h.createCardElement({ type: "picture-entity", entity: t.c.live, camera_view: "live", show_name: false, show_state: false }); e.hass = HASS; t.liveBox.innerHTML = ""; t.liveBox.appendChild(e); t.liveEl = e; }
          catch (err) { toast(T("Diretta non disponibile"), "mdi-alert-circle", "var(--warn)"); return; }
          t.liveBox.hidden = false; t.im.hidden = true; t.na.hidden = true; t.bLive.classList.add("on"); t.bLive.querySelector("span").textContent = T("Stop");
          t.timer = setTimeout(function () { camLive(t, false); }, 120000);
        });
      } else {
        if (t.liveEl) { t.liveBox.innerHTML = ""; t.liveEl = null; }
        t.liveBox.hidden = true; t.bLive.classList.remove("on"); t.bLive.querySelector("span").textContent = T("Diretta"); t.im.hidden = false; camRefresh(t);
      }
    }
    function camsStopAll() { camTiles.forEach(function (t) { if (t.liveEl) camLive(t, false); }); }
    function camsEnter() { camTiles.forEach(function (t) { if (!t.liveEl) camRefresh(t); }); }
    function camsTick() {
      if (!LIVE || !camTiles.length || $("#view-sic").hidden || document.hidden) return;
      camTiles.forEach(function (t) { if (!t.liveEl && t.c.poll && Date.now() - t.last > t.c.poll * 1000) camRefresh(t); });
    }
    function buildCams() {
      var box = $("#cams");
      if (!box) return;
      box.innerHTML = ""; camTiles = [];
      var list = (ENT.cameras || []).filter(function (c) { return sv(c.img) || sv(c.live) || sv(c.cam); });
      if (!list.length) { box.hidden = true; return; }
      list.forEach(function (c) {
        var card = el("article", "card cam",
          '<div class="cam-head"><h4>' + esc(c.n || niceName(c.cam || c.img || c.live)) + '</h4><span class="cam-off" hidden>Offline</span><span class="cam-meta"></span>' +
          '<button class="cbtn" type="button" data-a="refresh" title="' + T("Aggiorna anteprima") + '"><i class="mdi mdi-refresh"></i></button>' +
          (c.live ? '<button class="cbtn go" type="button" data-a="live"><i class="mdi mdi-play-circle"></i><span>' + T("Diretta") + '</span></button>' : "") +
          '<button class="cbtn" type="button" data-a="open" title="' + T("Apri") + '"><i class="mdi mdi-arrow-expand"></i></button></div>' +
          '<div class="feed-live"><img class="cam-img" alt="" draggable="false"><div class="live-box" hidden></div>' +
          '<div class="cam-na" hidden><i class="mdi mdi-video-off-outline"></i><span>' + T("Anteprima non disponibile") + "<br>" + T("tocca per aprire la telecamera") + '</span></div></div>');
        box.appendChild(card);
        hydrate(card);
        var t = { c: c, last: 0, im: $(".cam-img", card), na: $(".cam-na", card), liveBox: $(".live-box", card), meta: $(".cam-meta", card), off: $(".cam-off", card), bLive: $('[data-a="live"]', card), liveEl: null, timer: 0 };
        camTiles.push(t);
        $('[data-a="refresh"]', card).addEventListener("click", function () { camRefresh(t); });
        if (t.bLive) t.bLive.addEventListener("click", function () { camLive(t, !t.liveEl); });
        var target = c.live || c.cam || c.img;
        $('[data-a="open"]', card).addEventListener("click", function () { moreInfo(target); });
        t.na.addEventListener("click", function () { moreInfo(target); });
        t.im.addEventListener("click", function () { moreInfo(target); });
      });
      camsEnter();
    }
    function setHass(h) {
      var firstTime = !HASS;
      HASS = h;
      if (!LIVE) return;
      var dirty = firstTime, ids = trackedIds();
      for (var i = 0; i < ids.length; i++) { var s = h.states[ids[i]]; if (tracked[ids[i]] !== s) { tracked[ids[i]] = s; dirty = true; } }
      if (dirty) syncLive(firstTime);
      if (firstTime) buildCams();
      for (var j = 0; j < camTiles.length; j++) if (camTiles[j].liveEl) camTiles[j].liveEl.hass = h;
      if (hassWait.length && h.callWS) { var w = hassWait; hassWait = []; w.forEach(function (ok) { ok(h); }); }
      if (PK) PK.hass(h);
    }

    /* ------------------------------------------------------------------ clima (Panasonic) */
    var CL_MODES = [["off", T("Spento"), "mdi-power"], ["heat_cool", T("Auto"), "mdi-thermostat-auto"], ["cool", T("Freddo"), "mdi-snowflake"], ["dry", T("Deumidifica"), "mdi-water-percent"], ["fan_only", T("Ventola"), "mdi-fan"], ["heat", T("Caldo"), "mdi-fire"]];
    var CL_COL = { off: "#64748B", cool: "#38BDF8", heat: "#FB923C", dry: "#2DD4BF", fan_only: "#A5B4FC", heat_cool: "#C084FC" };
    var CL_STATUS = { off: T("Spento"), cool: T("Raffrescamento"), heat: T("Riscaldamento"), dry: T("Deumidificazione"), fan_only: T("Solo ventola"), heat_cool: T("Automatico") };
    var CL_IT = { Auto: "Auto", Low: "Minima", LowMid: "Bassa", Mid: "Media", HighMid: "Alta", High: "Massima", Up: "Alto", UpMid: "Medio-alto", DownMid: "Medio-basso", Down: "Basso", Left: "Sinistra", LeftMid: "Centro-sx", RightMid: "Centro-dx", Right: "Destra", none: "Normale", quiet: "Silenzioso", powerful: "Potente", eco: "Eco", boost: "Boost", comfort: "Comfort", sleep: "Notte", away: "Assente" };
    /* in inglese i nomi delle modalità restano quelli dell'integrazione, solo resi leggibili (LowMid → Low-mid) */
    var CL_IT2 = { auto: "Auto", low: "Bassa", medium: "Media", middle: "Media", mid: "Media", high: "Alta", highest: "Massima", lowest: "Minima", quiet: "Silenzioso", silent: "Silenzioso", turbo: "Turbo", on: "Acceso", off: "Spento", vertical: "Verticale", horizontal: "Orizzontale", both: "Entrambe", swing: "Oscillante", home: "In casa", activity: "Attività" };
    function it(k) { if (T.lang !== "en" && !CL_IT[k] && CL_IT2[String(k).toLowerCase()]) return CL_IT2[String(k).toLowerCase()]; if (T.lang === "en") { var s = String(k).replace(/([a-z])([A-Z])/g, "$1-$2").replace(/_/g, " ").toLowerCase(); return k === "none" ? "Normal" : s.charAt(0).toUpperCase() + s.slice(1); } return CL_IT[k] || k; }
    var clima = { avail: true, name: T("Aria salone"), mode: "off", action: "off", cur: 23, tgt: 25, min: 16, max: 30, step: .5, modes: ["off", "heat_cool", "cool", "dry", "fan_only", "heat"],
      fan: "Auto", fans: ["Auto", "Low", "LowMid", "Mid", "HighMid", "High"], swing: "Up", swings: ["Auto", "Up", "UpMid", "Mid", "DownMid", "Down"], hswing: "Auto", hswings: ["Auto", "Left", "LeftMid", "Mid", "RightMid", "Right"], preset: "none", presets: ["none", "quiet", "powerful"] };
    var clTimer = 0;
    function climaFromHass() {
      var s = sv(ENT.climate);
      if (!s) { clima.avail = false; return; }
      var a = s.attributes;
      clima.avail = s.state !== "unavailable";
      clima.name = a.friendly_name || clima.name; clima.mode = (s.state === "unavailable" || s.state === "unknown") ? "off" : s.state; clima.action = a.hvac_action || "";
      if (a.current_temperature !== undefined && a.current_temperature !== null) clima.cur = a.current_temperature;
      if (a.temperature !== undefined && a.temperature !== null && !clTimer) clima.tgt = a.temperature;
      clima.min = a.min_temp || 16; clima.max = a.max_temp || 30; clima.step = a.target_temp_step || a.target_temperature_step || .5;
      clima.modes = a.hvac_modes || clima.modes;
      clima.fan = a.fan_mode; clima.fans = a.fan_modes || []; clima.swing = a.swing_mode; clima.swings = a.swing_modes || [];
      clima.hswing = a.swing_horizontal_mode; clima.hswings = a.swing_horizontal_modes || []; clima.preset = a.preset_mode; clima.presets = a.preset_modes || [];
    }
    function climaArt() {
      var m = clima.mode;
      if (m === "off") return "clima_off";
      if (m === "cool") return "clima_cool";
      if (m === "heat") return "clima_heat";
      if (m === "dry") return "clima_dry";
      if (m === "fan_only") return "clima_fan";
      return clima.action === "heating" ? "clima_heat" : clima.action === "cooling" ? "clima_cool" : "clima_auto";
    }
    function fillSel(id, list, cur) {
      var sel = $(id), w = sel.closest("label");
      if (!list || !list.length) { w.hidden = true; return; }
      w.hidden = false; var sig = list.join("|");
      if (sel.dataset.sig !== sig) { sel.innerHTML = list.map(function (k) { return '<option value="' + k + '">' + it(k) + "</option>"; }).join(""); sel.dataset.sig = sig; }
      sel.value = cur;
    }
    function renderClima() {
      var wrap = $("#clima-wrap"), box = $("#clima");
      if (!wrap) return;
      if (LIVE && !sv(ENT.climate)) { wrap.hidden = true; return; }
      wrap.hidden = false;
      var m = clima.mode, col = CL_COL[m] || CL_COL.off;
      box.style.setProperty("--cl", col); box.dataset.mode = m; box.classList.toggle("na", !clima.avail);
      $("#cl-name").textContent = clima.name; $("#cl-sub").textContent = clima.name;
      var st = !clima.avail ? T("Non disponibile") : (CL_STATUS[m] || m);
      if (clima.avail && m !== "off" && clima.action === "idle") st += " · " + T("in pausa");
      $("#cl-status").textContent = st;
      $("#cl-cur").textContent = T("In casa {t} °C", { t: fmt(clima.cur) });
      var hint = "";
      if (!clima.avail) hint = T("Il climatizzatore non risponde: controlla la sua integrazione in Home Assistant.");
      else if (m === "cool" && clima.action !== "cooling" && clima.tgt >= clima.cur) hint = T("Acceso ma in pausa: in casa ci sono {c}° e hai impostato {t}°. Abbassa la temperatura per far partire il raffrescamento.", { c: fmt(clima.cur), t: fmt(clima.tgt) });
      else if (m === "heat" && clima.action !== "heating" && clima.tgt <= clima.cur) hint = T("Acceso ma in pausa: in casa ci sono {c}° e hai impostato {t}°. Alza la temperatura per far partire il riscaldamento.", { c: fmt(clima.cur), t: fmt(clima.tgt) });
      var hn = $("#cl-hint"); hn.textContent = hint; hn.hidden = !hint;
      $("#cl-tgt").textContent = Number(clima.tgt).toLocaleString(LOC, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      var art = $("#cl-art"); art.dataset.img = climaArt(); refreshImg(art);
      var mw = $("#cl-modes"), msig = clima.modes.join("|") + "#" + m;
      if (mw.dataset.sig !== msig) {
        mw.dataset.sig = msig; mw.innerHTML = "";
        CL_MODES.filter(function (x) { return clima.modes.indexOf(x[0]) > -1; }).forEach(function (x) {
          var b = el("button", "cchip", '<i class="mdi ' + x[2] + '"></i>' + x[1], { type: "button", "data-mode": x[0], "aria-pressed": x[0] === m ? "true" : "false" });
          b.style.setProperty("--cl", CL_COL[x[0]]); mw.appendChild(b);
        });
      }
      var fw = $("#cl-fans"), fsig = clima.fans.join("|") + "#" + clima.fan; $("#cl-fan-sec").hidden = !clima.fans.length;
      if (fw.dataset.sig !== fsig) {
        fw.dataset.sig = fsig; fw.innerHTML = "";
        clima.fans.forEach(function (k) { fw.appendChild(el("button", "cchip sm", it(k), { type: "button", "data-fan": k, "aria-pressed": k === clima.fan ? "true" : "false" })); });
      }
      fillSel("#cl-swing", clima.swings, clima.swing); fillSel("#cl-hswing", clima.hswings, clima.hswing); fillSel("#cl-preset", clima.presets, clima.preset);
      $("#cl-minus").disabled = $("#cl-plus").disabled = !clima.avail;
    }
    function climaCall(svc, data, local) {
      if (LIVE) { var d = { entity_id: ENT.climate }; Object.keys(data || {}).forEach(function (k) { d[k] = data[k]; }); call("climate", svc, d); }
      if (local) local();
      renderClima();
    }
    function climaToast(m, nt) {
      var lab = (CL_MODES.filter(function (x) { return x[0] === m; })[0] || [0, m])[1];
      if (!LIVE) { toast(T("Clima: {m}", { m: CL_STATUS[m] }) + (nt !== null ? " " + T("a {t}° (in casa {c}°)", { t: fmt(nt), c: fmt(clima.cur) }) : ""), "mdi-air-conditioner", CL_COL[m]); return; }
      toast(nt !== null ? T("Clima: comando «{m}» a {t}° inviato", { m: lab, t: fmt(nt) }) : T("Clima: comando «{m}» inviato", { m: lab }), "mdi-air-conditioner", CL_COL[m]);
    }
    function buildClima() {
      if (!$("#clima")) return;
      $("#cl-modes").addEventListener("click", function (e) {
        var b = e.target.closest("[data-mode]"); if (!b) return; var m = b.dataset.mode, wasOff = clima.mode === "off";
        if (LIVE && !clima.avail) { toast(T("Climatizzatore non raggiungibile: nessun comando inviato"), "mdi-alert-circle", "var(--warn)"); return; }
        climaCall(m === "off" ? "turn_off" : "set_hvac_mode", m === "off" ? {} : { hvac_mode: m }, function () { clima.mode = m; clima.action = m === "off" ? "off" : ""; });
        // accendendo in freddo/caldo, se la temperatura impostata non farebbe partire nulla, la porto 2° oltre quella di casa
        var nt = null, st = clima.step || .5;
        if (wasOff && m === "cool" && clima.tgt >= clima.cur) nt = Math.max(clima.min, Math.floor((clima.cur - 2) / st) * st);
        if (wasOff && m === "heat" && clima.tgt <= clima.cur) nt = Math.min(clima.max, Math.ceil((clima.cur + 2) / st) * st);
        if (nt !== null && nt !== clima.tgt) {
          clima.tgt = nt;
          if (LIVE) setTimeout(function () { call("climate", "set_temperature", { entity_id: ENT.climate, temperature: nt }); }, 1200);
          climaToast(m, nt);
        } else climaToast(m, null);
        renderClima();
      });
      $("#cl-fans").addEventListener("click", function (e) { var b = e.target.closest("[data-fan]"); if (!b) return; var k = b.dataset.fan; climaCall("set_fan_mode", { fan_mode: k }, function () { clima.fan = k; }); });
      $("#cl-swing").addEventListener("change", function (e) { var k = e.target.value; climaCall("set_swing_mode", { swing_mode: k }, function () { clima.swing = k; }); });
      $("#cl-hswing").addEventListener("change", function (e) { var k = e.target.value; climaCall("set_swing_horizontal_mode", { swing_horizontal_mode: k }, function () { clima.hswing = k; }); });
      $("#cl-preset").addEventListener("change", function (e) { var k = e.target.value; climaCall("set_preset_mode", { preset_mode: k }, function () { clima.preset = k; }); });
      function step(dir) {
        var v = Math.round((clima.tgt + dir * clima.step) / clima.step) * clima.step;
        clima.tgt = Math.min(clima.max, Math.max(clima.min, v)); renderClima();
        clearTimeout(clTimer);
        clTimer = setTimeout(function () { clTimer = 0; if (LIVE) call("climate", "set_temperature", { entity_id: ENT.climate, temperature: clima.tgt }); }, 700);
        timers.push(clTimer);
      }
      $("#cl-minus").addEventListener("click", function () { step(-1); });
      $("#cl-plus").addEventListener("click", function () { step(1); });
      renderClima();
    }

    /* ------------------------------------------------------------------ numeri che scorrono (consumo in tempo reale) */
    var TW = {}, lastP = null, deltaT = 0;
    function tweenW(node, unitNode, to) {
      if (!node) return;
      var key = node.id, st = TW[key] || (TW[key] = { v: to, raf: 0 });
      function paint(v) { var f = fmtW(v); if (unitNode) { node.textContent = f.n; unitNode.textContent = f.u; } else node.textContent = f.n + " " + f.u; }
      cancelAnimationFrame(st.raf);
      var from = st.v;
      if (reduce || from === to || document.hidden) { st.v = to; paint(to); return; }
      var t0 = performance.now(), dur = 1100;
      (function step(now) { var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3), v = from + (to - from) * e; st.v = v; paint(v); if (k < 1) st.raf = requestAnimationFrame(step); else st.v = to; })(t0);
    }
    function showDelta(v) {
      if (lastP !== null && Math.abs(v - lastP) >= 3) {
        var d = $("#power-delta"), dv = v - lastP;
        if (d) { d.textContent = (dv > 0 ? "▲ +" : "▼ −") + Math.round(Math.abs(dv)); d.className = "pdelta " + (dv > 0 ? "up" : "dn"); clearTimeout(deltaT); deltaT = setTimeout(function () { d.className = "pdelta"; }, 5000); }
      }
      lastP = v;
    }
    function chipPower(v) { showDelta(v); tweenW($("#power-val"), null, v); }
    function enAge() {
      var n = $("#en-age"); if (!n) return;
      if (!LIVE) { n.textContent = "· " + T("in tempo reale"); return; }
      var s = sv(ENT.energy.power) || sv(ENT.power);
      if (!s || !s.last_updated) { n.textContent = ""; return; }
      var sec = Math.max(0, Math.round((Date.now() - new Date(s.last_updated).getTime()) / 1000));
      n.textContent = "· " + (sec < 2 ? T("aggiornata ora") : T("aggiornata {n} s fa", { n: sec }));
    }
    /* chiede a Home Assistant di rileggere il contatore ogni pochi secondi, finché guardi la dashboard */
    var lastPoll = 0;
    function livePoll() {
      var n = ENT.energy.liveRefresh;
      if (!LIVE || !n || n <= 0 || document.hidden || !HASS) return;
      var id = ENT.energy.power; if (!sv(id) || isUnavail(sv(id))) return;
      var now = Date.now(); if (now - lastPoll < Math.max(n, 2.5) * 1000) return;
      lastPoll = now; call("homeassistant", "update_entity", { entity_id: id });
    }

    /* ------------------------------------------------------------------ energia / consumi (Shelly EM) */
    var EN = { range: "24h", series: [], busy: false, last: 0, rangeKey: "", days: [], daysAt: 0, tipIdx: -1, dayUnit: "kwh", pEff: 0.3, pDrawn: 0 };
    function enNum(id) { var s = sv(id); if (!s || isUnavail(s)) return null; var v = parseFloat(s.state); return isNaN(v) ? null : v; }
    function fmtKwh(v) { return v === null ? "—" : Number(v).toLocaleString(LOC, { minimumFractionDigits: v >= 100 ? 0 : 1, maximumFractionDigits: v >= 100 ? 0 : 2 }); }
    function fmtEur(v) { return v === null ? "—" : Number(v).toLocaleString(LOC, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + CUR; }
    function fmtW(v) { return v >= 1000 ? { n: Number(v / 1000).toLocaleString(LOC, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), u: "kW" } : { n: Math.round(v).toLocaleString(LOC), u: "W" }; }
    var demoE = { p: 180, t0: Date.now() };
    function demoPower() { var m = (Date.now() - demoE.t0) / 1000; return Math.max(60, 190 + 90 * Math.sin(m / 9) + 60 * Math.sin(m / 3.1) + (Math.sin(m / 47) > .8 ? 1400 : 0)); }
    /* tariffa €/kWh: helper di Home Assistant (vale su tutti i dispositivi) → copia locale → valore di esempio */
    var PEND = null;
    function priceInfo() {
      var v = enNum(ENT.energy.price);
      if (PEND && (Date.now() > PEND.until || (v !== null && Math.abs(v - PEND.v) < 1e-6))) PEND = null;
      if (PEND) return { v: PEND.v, src: "ha" };
      if (v !== null && v > 0) return { v: v, src: "ha" };
      var l = parseFloat(store("price"));
      if (l > 0) return { v: l, src: "local" };
      return { v: 0, src: LIVE ? "none" : "demo" };
    }
    /* kWh di oggi, ieri, mese e anno: dai sensori se ci sono, altrimenti dallo storico del contatore totale (energyTotal) */
    var KS = { at: 0, v: {} };
    function kpi(id, k) { var v = enNum(id); return v !== null ? v : (KS.v[k] !== undefined ? KS.v[k] : null); }
    function kpiStats() {
      var id = ENT.energy.energyTotal, E = ENT.energy;
      if (!LIVE || !HASS || !id || !sv(id) || Date.now() - KS.at < 300000) return;
      if ([E.today, E.yesterday, E.month, E.lastMonth, E.year].every(function (x) { return enNum(x) !== null; })) return;
      KS.at = Date.now();
      var now = new Date(), d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()), y0 = new Date(d0.getTime() - 864e5);
      var m0 = new Date(now.getFullYear(), now.getMonth(), 1), lm0 = new Date(now.getFullYear(), now.getMonth() - 1, 1), yr0 = new Date(now.getFullYear(), 0, 1);
      var q = function (from, per) { return HASS.callWS({ type: "recorder/statistics_during_period", start_time: from.toISOString(), end_time: now.toISOString(), statistic_ids: [id], period: per, types: ["change"] }).then(function (r) { return r[id] || []; }); };
      Promise.all([q(y0, "hour"), q(lm0 < yr0 ? lm0 : yr0, "month")]).then(function (r) {
        var sum = function (arr, a, b) { return arr.reduce(function (t, x) { var s = tms(x.start); return s >= a && s < b && x.change !== null && x.change !== undefined ? t + x.change : t; }, 0); };
        var far = now.getTime() + 864e5;
        KS.v = { today: sum(r[0], d0.getTime(), far), yest: sum(r[0], y0.getTime(), d0.getTime()), month: sum(r[1], m0.getTime(), far), lmonth: sum(r[1], lm0.getTime(), m0.getTime()), year: sum(r[1], yr0.getTime(), far) };
        renderEnergy();
      }).catch(function () { KS.v = {}; });
    }
    function enModel() {
      var E = ENT.energy, m, sc = {};
      if (!LIVE) {
        m = { power: demoPower(), volt: 229.8, base: 98, avg3: 204, limit: 3400, today: 3.4, yest: 10.3, month: 71.4, lmonth: 211.3, year: 2043.9, na: false,
          apps: [{ n: T("Lavatrice"), w: 460, e: .42, ic: "mdi-washing-machine", c: "#38BDF8" }, { n: T("Asciugatrice"), w: 0, e: .01, ic: "mdi-tumble-dryer", c: "#F472B6" }, { n: T("Lavastoviglie"), w: 1080, e: .55, ic: "mdi-dishwasher", c: "#22D3EE" }, { n: T("Forno"), w: 0, e: 0, ic: "mdi-stove", c: "#FB923C" }, { n: T("Multipresa"), w: 12, e: .14, ic: "mdi-power-socket-eu", c: "#A78BFA" }, { n: T("Frigorifero"), w: 74, e: .62, ic: "mdi-fridge", c: "#34D399" }] };
      } else {
        var lim = enNum(E.limit) || E.limitDefault;
        m = { power: enNum(E.power) !== null ? enNum(E.power) : enNum(ENT.power), volt: enNum(E.voltage), base: enNum(E.base), avg3: enNum(E.avg3), limit: lim,
          today: kpi(E.today, "today"), yest: kpi(E.yesterday, "yest"), month: kpi(E.month, "month"), lmonth: kpi(E.lastMonth, "lmonth"), year: kpi(E.year, "year"),
          na: isUnavail(sv(E.power)),
          apps: E.appliances.map(function (x, i) { var s = sv(x.p); return { n: x.n || niceName(x.p), w: enNum(x.p), e: x.e ? enNum(x.e) : null, ic: mdi(x.ic) || "mdi-power-plug", c: x.c || ROOM_COLORS[i % ROOM_COLORS.length], na: !s || isUnavail(s) }; }) };
        sc = { today: enNum(E.costToday), yest: enNum(E.costYesterday), month: enNum(E.costMonth), lmonth: enNum(E.costLastMonth), year: enNum(E.costYear) };
      }
      var pi = priceInfo(), implied = null;
      var hasSens = [sc.today, sc.yest, sc.month, sc.lmonth, sc.year].some(function (x) { return x !== undefined && x !== null; });
      if (pi.v <= 0) {
        if (sc.year !== undefined && sc.year !== null && m.year > 0) implied = sc.year / m.year;
        else if (sc.month !== undefined && sc.month !== null && m.month > 0) implied = sc.month / m.month;
      }
      m.price = pi; m.implied = implied;
      m.pEff = pi.v > 0 ? pi.v : (implied || E.priceDefault);
      m.src = pi.v > 0 ? pi.src : (hasSens ? "sensori" : "esempio");
      /* costo = kWh × tariffa; senza tariffa impostata si usano i sensori di costo che hai già, o un valore di esempio */
      function cost(kwh, sens) { if (pi.v > 0) return kwh === null ? null : kwh * pi.v; if (sens !== undefined && sens !== null) return sens; return kwh === null ? null : kwh * m.pEff; }
      m.cToday = cost(m.today, sc.today); m.cYest = cost(m.yest, sc.yest); m.cMonth = cost(m.month, sc.month); m.cLmonth = cost(m.lmonth, sc.lmonth); m.cYear = cost(m.year, sc.year);
      return m;
    }
    function enLevel(m) {
      var pct = m.power / m.limit;
      if (m.na) return ["low", T("Dato non disponibile"), 0];
      if (m.base && m.power <= m.base * 1.25) return ["low", T("Solo consumo di fondo"), pct];
      if (pct < .25) return ["low", T("Consumo basso"), pct];
      if (pct < .55) return ["mid", T("Consumo nella norma"), pct];
      if (pct < .8) return ["high", T("Consumo alto"), pct];
      return ["crit", T("Attenzione: vicino al limite"), pct];
    }
    function renderEnergy() {
      if (!$("#en-hero")) return;
      var m = enModel(), lv = enLevel(m), f = fmtW(m.power || 0);
      var hero = $("#en-hero"); hero.dataset.lvl = lv[0]; hero.classList.toggle("na", !!m.na);
      if (m.na) { $("#en-num").textContent = "—"; $("#en-unit").textContent = "W"; } else tweenW($("#en-num"), $("#en-unit"), m.power || 0);
      var dash = Math.max(0, Math.min(100, (m.power || 0) / m.limit * 100)).toFixed(1);
      $("#en-arc").setAttribute("stroke-dasharray", dash + " 100"); $("#en-glow").setAttribute("stroke-dasharray", dash + " 100");
      $("#en-title").textContent = lv[1];
      $("#en-sub").textContent = T("Misura generale della casa · limite di avviso {l}", { l: fmtW(m.limit).n + " " + fmtW(m.limit).u });
      var chips = "";
      EN.pEff = m.pEff;
      if (m.power !== null && !m.na) chips += '<span class="echip cost" title="' + T("Tocca per cambiare la tariffa") + '"><i class="mdi ' + CUR_ICON + '"></i>' + T("Costa adesso") + ' <b>' + fmtEur(m.power / 1000 * m.pEff) + "/h</b></span>";
      if (m.base !== null) chips += '<span class="echip"><i class="mdi mdi-sleep"></i>' + T("Fondo") + ' <b>' + Math.round(m.base) + " W</b></span>";
      if (m.avg3 !== null) chips += '<span class="echip"><i class="mdi mdi-chart-bell-curve"></i>' + T("Media 3 h") + ' <b>' + Math.round(m.avg3) + " W</b></span>";
      if (m.volt !== null) chips += '<span class="echip"><i class="mdi mdi-sine-wave"></i>' + T("Tensione") + ' <b>' + fmtKwh(m.volt).replace(/[,.]0$/, "") + " V</b></span>";
      var ch = $("#en-chips"); if (ch.dataset.sig !== chips) { ch.dataset.sig = chips; ch.innerHTML = chips; hydrate(ch); }
      // tariffa
      var pb = $("#en-price"), P = m.price;
      if (pb) {
        pb.classList.toggle("unset", P.v <= 0);
        $("#pb-main").textContent = P.v > 0 ? T("Tariffa {p}", { p: fmtP(P.v) + " " + CUR + "/kWh" }) : (m.src === "sensori" ? T("Tariffa non impostata") : T("Tariffa di esempio {p}", { p: fmtP(m.pEff) + " " + CUR + "/kWh" }));
        $("#pb-sub").textContent = P.src === "ha" ? T("Salvata in Home Assistant · ogni costo è kWh × tariffa") : P.src === "local" ? T("Salvata su questo dispositivo · ogni costo è kWh × tariffa")
          : m.src === "sensori" ? T("I costi arrivano dai tuoi sensori (≈ {p}). Imposta la tariffa della bolletta per i costi reali", { p: fmtP(m.pEff) + " " + CUR + "/kWh" }) : T("Imposta il prezzo della tua bolletta per vedere i costi reali");
        $("#pb-cta").textContent = P.v > 0 ? T("Modifica") : T("Imposta");
      }
      if (EN.pDrawn !== EN.pEff && EN.days.length) drawDays();
      // KPI
      var dom = new Date(), dim = new Date(dom.getFullYear(), dom.getMonth() + 1, 0).getDate(), est = (m.month !== null && dom.getDate() > 0) ? m.month / dom.getDate() * dim : null;
      var kp = [
        ["mdi-calendar-today", T("Oggi"), m.today, m.cToday, ""], ["mdi-calendar-arrow-left", T("Ieri"), m.yest, m.cYest, ""],
        ["mdi-calendar-month", T("Questo mese"), m.month, m.cMonth, est !== null ? T("Stima fine mese ≈ {n} kWh", { n: Math.round(est) }) + (m.cMonth !== null ? " · " + fmtEur(m.cMonth / dom.getDate() * dim) : "") : ""],
        ["mdi-calendar-month-outline", T("Mese scorso"), m.lmonth, m.cLmonth, ""], ["mdi-calendar-star", T("Quest'anno"), m.year, m.cYear, ""]];
      var kh = kp.map(function (k) { return '<article class="card kpi' + (k[2] === null ? " na" : "") + '"><span class="k-l"><i class="mdi ' + k[0] + '"></i>' + k[1] + '</span><span class="k-v">' + fmtKwh(k[2]) + "<small>kWh</small></span><span class=\"k-c\">" + fmtEur(k[3]) + '</span><span class="k-s">' + (k[4] || "&nbsp;") + "</span></article>"; }).join("");
      var kb = $("#en-kpis"); if (kb.dataset.sig !== kh) { kb.dataset.sig = kh; kb.innerHTML = kh; hydrate(kb); }
      // elettrodomestici
      var apps = m.apps, sum = 0; apps.forEach(function (x) { if (x.w) sum += x.w; });
      var other = Math.max(0, (m.power || 0) - sum), tot = Math.max(m.power || 0, sum, 1);
      var segs = apps.filter(function (x) { return x.w > 3; }).map(function (x) { return [x.n, x.c, x.w]; });
      if (other > 3) segs.push([T("Altro (luci, standby…)"), "#64748B", other]);
      var sh = $("#en-share"), shHtml = segs.map(function (g2) { return '<i style="width:' + (g2[2] / tot * 100).toFixed(1) + "%;background:" + g2[1] + '"></i>'; }).join("");
      if (sh.dataset.sig !== shHtml) { sh.dataset.sig = shHtml; sh.innerHTML = shHtml; }
      var lg = $("#en-share-legend");
      if (!lg) { lg = el("div", "share-legend"); lg.id = "en-share-legend"; sh.insertAdjacentElement("afterend", lg); }
      lg.innerHTML = segs.map(function (g2) { return '<span style="--c:' + g2[1] + '">' + g2[0] + " <b>" + Math.round(g2[2]) + " W</b></span>"; }).join("") || '<span style="--c:#34D399">' + T("Nessun elettrodomestico acceso") + '</span>';
      var ap = $("#en-apps"), ah = apps.map(function (x, i) {
        var run = x.w !== null && x.w >= 5;
        return '<button class="app' + (run ? " run" : "") + (x.na ? " na" : "") + '" type="button" data-app="' + i + '" style="--c:' + x.c + '"><span class="a-ico"><i class="mdi ' + x.ic + '"></i></span><span class="a-name">' + esc(x.n) + '</span><span class="a-w">' + (x.na || x.w === null ? "—" : (x.w >= 1000 ? fmtW(x.w).n + " kW" : Math.round(x.w) + " W")) + '</span><span class="a-e">' + (x.e !== null ? T("{n} kWh oggi", { n: fmtKwh(x.e) }) : (x.na ? T("Non disponibile") : "&nbsp;")) + "</span></button>";
      }).join("");
      if (ap.dataset.sig !== ah) { ap.dataset.sig = ah; ap.innerHTML = ah; hydrate(ap); $$(".app", ap).forEach(function (b) { b.addEventListener("click", function () { if (LIVE) moreInfo(ENT.energy.appliances[+b.dataset.app].p); }); }); }
    }
    /* ---- tariffa: finestra per impostare il costo del kWh ---- */
    function fmtP(v) { return Number(v).toLocaleString(LOC, { minimumFractionDigits: 3, maximumFractionDigits: 3 }); }
    function prNum(sel) { var v = parseFloat(String($(sel).value).replace(",", ".")); return isNaN(v) ? null : v; }
    function prSet(v) { $("#pr-in").value = (Math.round(v * 1000) / 1000).toFixed(3); prMark(); }
    function prMark() { var v = prNum("#pr-in"); $$("#pr-pre button").forEach(function (b) { b.setAttribute("aria-pressed", v !== null && Math.abs(+b.dataset.v - v) < 0.0005 ? "true" : "false"); }); }
    function prCalcOut() {
      var b = prNum("#pr-bill"), k = prNum("#pr-kwh"), o = $("#pr-calc-out");
      if (b > 0 && k > 0) { var v = b / k; o.innerHTML = T("Costo reale:") + " <b>" + fmtP(v) + " " + CUR + "/kWh</b>"; var u = el("button", "linkb", T("Usa questo"), { type: "button" }); u.addEventListener("click", function () { prSet(v); }); o.appendChild(u); } else o.textContent = "";
    }
    function openPrice() {
      var m = enModel(), cur = m.price.v > 0 ? m.price.v : m.pEff, box = $("#pricebox");
      prSet(cur);
      var pre = $("#pr-pre"); pre.innerHTML = "";
      [0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50].forEach(function (v) { var b = el("button", "", fmtP(v).slice(0, 4), { type: "button", "data-v": v }); b.addEventListener("click", function () { prSet(v); }); pre.appendChild(b); });
      prMark();
      var h = $("#pr-hint");
      if (m.implied > 0 && m.price.v <= 0) {
        h.hidden = false; h.innerHTML = T("I sensori che avevi già calcolano i costi a circa") + " <b>" + fmtP(m.implied) + " " + CUR + "/kWh</b>.";
        var u = el("button", "linkb", T("Usa questo"), { type: "button" }); u.addEventListener("click", function () { prSet(m.implied); }); h.appendChild(u);
      } else h.hidden = true;
      $("#pr-bill").value = ""; $("#pr-kwh").value = ""; $("#pr-calc-out").textContent = ""; $("#pr-calc").open = false;
      $("#pr-where").textContent = !LIVE ? T("Anteprima: la tariffa resta salvata solo in questo browser.")
        : sv(ENT.energy.price) ? T("Viene salvata in Home Assistant ({id}): vale su tutti i tuoi dispositivi.", { id: ENT.energy.price })
        : T("Al primo salvataggio creo in Home Assistant l'helper {id} (serve un utente amministratore); altrimenti resta su questo dispositivo.", { id: ENT.energy.price });
      box.classList.add("open"); box.setAttribute("aria-hidden", "false");
      later(function () { var i = $("#pr-in"); i.focus(); i.select(); }, 220);
    }
    function closePrice() { var box = $("#pricebox"); box.classList.remove("open"); box.setAttribute("aria-hidden", "true"); }
    function prDone(msg) { $("#pr-ok").disabled = false; closePrice(); toast(msg, "mdi-cash-check", "var(--ok)"); renderEnergy(); drawDays(); }
    function savePrice() {
      var v = prNum("#pr-in");
      if (v === null || v < 0.001 || v > 5) { toast(T("Inserisci un prezzo tra {a} e {b}", { a: fmtP(0.001), b: "5 " + CUR + "/kWh" }), "mdi-alert-circle", "var(--warn)"); return; }
      v = Math.round(v * 10000) / 10000;
      if (!LIVE) { store("price", String(v)); prDone(T("Tariffa salvata: {p}", { p: fmtP(v) + " " + CUR + "/kWh" })); return; }
      var id = ENT.energy.price, btn = $("#pr-ok"); btn.disabled = true;
      var local = function (why) { store("price", String(v)); prDone(T("Tariffa salvata su questo dispositivo") + (why ? " (" + why + ")" : "")); };
      var name = id.split(".")[1].replace(/_/g, " ").replace(/\bkwh\b/i, "kWh"); name = name.charAt(0).toUpperCase() + name.slice(1);
      var req = sv(id) ? Promise.resolve(ctx.call("input_number", "set_value", { entity_id: id, value: v }))
        : HASS.callWS({ type: "input_number/create", name: name, icon: "mdi:cash-multiple", min: 0, max: 5, step: 0.001, mode: "box", unit_of_measurement: CUR + "/kWh", initial: v });
      req.then(function () { PEND = { v: v, src: "ha", until: Date.now() + 8000 }; prDone(T("Tariffa salvata in Home Assistant: {p}", { p: fmtP(v) + " " + CUR + "/kWh" })); })
        .catch(function (e) { local(/unauthor|admin|permission/i.test((e && e.message) || (e && e.code) || "") ? T("serve un utente amministratore per salvarla in HA") : T("non sono riuscito a scriverla in HA")); });
    }
    function buildPrice() {
      var open = function () { openPrice(); };
      $("#en-price").addEventListener("click", open); $("#en-kpis").addEventListener("click", open);
      $("#en-chips").addEventListener("click", function (e) { if (e.target.closest && e.target.closest(".echip.cost")) openPrice(); });
      $("#pr-close").addEventListener("click", closePrice); $("#pr-cancel").addEventListener("click", closePrice);
      $("#pricebox").addEventListener("click", function (e) { if (e.target === e.currentTarget) closePrice(); });
      $("#pr-ok").addEventListener("click", savePrice);
      $("#pr-minus").addEventListener("click", function () { prSet(Math.max(0.001, (prNum("#pr-in") || 0) - 0.005)); });
      $("#pr-plus").addEventListener("click", function () { prSet(Math.min(5, (prNum("#pr-in") || 0) + 0.005)); });
      $("#pr-in").addEventListener("input", prMark);
      $("#pr-in").addEventListener("keydown", function (e) { if (e.key === "Enter") savePrice(); });
      $("#pr-bill").addEventListener("input", prCalcOut); $("#pr-kwh").addEventListener("input", prCalcOut);
      $("#pricebox").addEventListener("keydown", function (e) { if (e.key === "Escape") closePrice(); });
    }
    /* ---- storico ---- */
    function bucketSeries(raw, t0, t1, n) {
      var out = [], span = (t1 - t0) / n, i, k;
      for (i = 0; i < n; i++) out.push({ t: t0 + i * span, sum: 0, w: 0, mx: 0 });
      for (k = 0; k < raw.length; k++) {
        var a = raw[k], v = parseFloat(a.v); if (isNaN(v)) continue;
        var s = Math.max(a.t, t0), e = Math.min(raw[k + 1] ? raw[k + 1].t : t1, t1); if (e <= s) continue;
        for (i = Math.max(0, Math.floor((s - t0) / span)); i < n && out[i].t < e; i++) { var bs = Math.max(s, out[i].t), be = Math.min(e, out[i].t + span); if (be > bs) { out[i].sum += v * (be - bs); out[i].w += be - bs; if (v > out[i].mx) out[i].mx = v; } }
      }
      return out.filter(function (b) { return b.w > 0; }).map(function (b) { return { t: b.t, v: b.sum / b.w, mx: b.mx }; });
    }
    function tms(x) { if (typeof x === "number") return x < 1e12 ? x * 1000 : x; return Date.parse(x); }
    function enFetch(range) {
      var now = Date.now();
      if (!LIVE) {
        var n = range === "3h" ? 60 : range === "24h" ? 96 : 84, step = range === "3h" ? 180e3 : range === "24h" ? 900e3 : 7200e3, a = [];
        for (var i = 0; i < n; i++) { var tt = now - (n - i) * step, hh = new Date(tt).getHours() + new Date(tt).getMinutes() / 60, v = 140 + 70 * Math.sin(i / 5) + (hh > 18 && hh < 22 ? 420 : 0) + (hh > 12 && hh < 14 ? 520 : 0) + 40 * Math.sin(i * 1.7) + (i % 29 === 0 ? 900 : 0); a.push({ t: tt, v: Math.max(70, v), mx: Math.max(70, v) * 1.2 }); }
        return Promise.resolve(a);
      }
      var id = ENT.energy.power;
      if (range === "3h") {
        var t0 = now - 3 * 3600e3;
        return HASS.callWS({ type: "history/history_during_period", start_time: new Date(t0).toISOString(), end_time: new Date(now).toISOString(), entity_ids: [id], minimal_response: true, no_attributes: true, significant_changes_only: false }).then(function (r) {
          var arr = (r[id] || []).map(function (x) { return { t: tms(x.lu !== undefined ? x.lu : (x.last_updated || x.lc)), v: x.s !== undefined ? x.s : x.state }; }).filter(function (x) { return !isNaN(x.t); });
          return bucketSeries(arr, t0, now, 60);
        });
      }
      var per = range === "24h" ? "5minute" : "hour", st = now - (range === "24h" ? 24 : 168) * 3600e3;
      return HASS.callWS({ type: "recorder/statistics_during_period", start_time: new Date(st).toISOString(), end_time: new Date(now).toISOString(), statistic_ids: [id], period: per, types: ["mean", "max"] }).then(function (r) {
        var a = (r[id] || []).map(function (x) { return { t: tms(x.start), v: x.mean, mx: x.max }; }).filter(function (x) { return x.v !== null && x.v !== undefined; });
        if (range === "24h" && a.length > 120) { var g3 = Math.ceil(a.length / 96), o = []; for (var i = 0; i < a.length; i += g3) { var c = a.slice(i, i + g3), s = 0, mx = 0; c.forEach(function (z) { s += z.v; if ((z.mx || z.v) > mx) mx = z.mx || z.v; }); o.push({ t: c[0].t, v: s / c.length, mx: mx }); } a = o; }
        return a;
      });
    }
    function fmtHM(ts) { var d = new Date(ts); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
    function drawChart() {
      var svg = $("#en-svg"), data = EN.series, W = 600, H = 170, base = enNum(ENT.energy.base);
      $("#en-empty").hidden = !!data.length;
      if (!data.length) { svg.innerHTML = ""; $("#en-axis").innerHTML = ""; $("#en-stats").innerHTML = ""; return; }
      var maxV = 0, peak = data[0], sum = 0; data.forEach(function (d) { var m2 = d.mx || d.v; if (m2 > maxV) maxV = m2; if (d.v > peak.v) peak = d; sum += d.v; });
      var top = Math.max(100, Math.ceil(maxV * 1.12 / 100) * 100), t0 = data[0].t, t1 = data[data.length - 1].t, dt = Math.max(1, t1 - t0);
      var xs = function (t2) { return (t2 - t0) / dt * W; }, ys = function (v) { return H - 6 - (v / top) * (H - 14); };
      var pts = data.map(function (d) { return [xs(d.t), ys(d.v)]; });
      var line = pts.map(function (p2, i) { return (i ? "L" : "M") + p2[0].toFixed(1) + " " + p2[1].toFixed(1); }).join(" ");
      var area = line + " L" + pts[pts.length - 1][0].toFixed(1) + " " + H + " L" + pts[0][0].toFixed(1) + " " + H + " Z";
      var grid = [.25, .5, .75].map(function (g3) { return '<line class="grid" x1="0" x2="' + W + '" y1="' + ys(top * g3).toFixed(1) + '" y2="' + ys(top * g3).toFixed(1) + '"/>'; }).join("");
      var bl = base !== null && base < top ? '<line class="base" x1="0" x2="' + W + '" y1="' + ys(base).toFixed(1) + '" y2="' + ys(base).toFixed(1) + '"/>' : "";
      svg.innerHTML = '<defs><linearGradient id="enarea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--acc-text)" stop-opacity=".45"/><stop offset="1" stop-color="var(--acc-text)" stop-opacity="0"/></linearGradient></defs>' + grid + bl + '<path class="area" d="' + area + '"/><path class="line" d="' + line + '"/><line class="cursor" id="en-cur" x1="0" x2="0" y1="0" y2="' + H + '" style="display:none"/>';
      var ax = $("#en-axis"), lab = []; for (var k = 0; k < 5; k++) { var tt = t0 + dt * k / 4, d2 = new Date(tt); lab.push("<span>" + (EN.range === "7g" ? d2.toLocaleDateString(LOC, { weekday: "short" }).replace(".", "") + " " + pad(d2.getHours()) + "h" : fmtHM(tt)) + "</span>"); }
      ax.innerHTML = lab.join("");
      var pk = fmtW(peak.v), av = Math.round(sum / data.length);
      $("#en-stats").innerHTML = '<span class="echip"><i class="mdi mdi-arrow-up-bold"></i>' + T("Picco") + ' <b>' + pk.n + " " + pk.u + '</b> ' + T("alle") + ' <b>' + fmtHM(peak.t) + '</b></span><span class="echip"><i class="mdi mdi-chart-line"></i>' + T("Media") + ' <b>' + av + ' W</b></span>' + (base !== null ? '<span class="echip"><i class="mdi mdi-minus"></i>' + T("Linea tratteggiata = consumo di fondo") + '</span>' : "");
      hydrate($("#en-stats"));
      EN.geo = { xs: xs, ys: ys, t0: t0, dt: dt, W: W, data: data };
    }
    function enLoad(force) {
      var key = EN.range;
      if (!force && EN.rangeKey === key && Date.now() - EN.last < 45000) return;
      if (EN.busy) return; EN.busy = true;
      enFetch(key).then(function (a) { EN.series = a; EN.rangeKey = key; EN.last = Date.now(); EN.busy = false; drawChart(); }).catch(function () { EN.busy = false; EN.series = []; drawChart(); });
    }
    function daysLoad() {
      if (Date.now() - EN.daysAt < 600000 && EN.days.length) return;
      EN.daysAt = Date.now();
      if (!LIVE) { var d0 = new Date(), a = []; for (var i = 13; i >= 0; i--) { var dd = new Date(d0 - i * 864e5); a.push({ d: dd, v: i === 0 ? 3.4 : 6 + 5 * Math.abs(Math.sin(i * 1.3)) + (i % 5 === 0 ? 3 : 0) }); } EN.days = a; drawDays(); return; }
      var st = new Date(); st.setDate(st.getDate() - 13); st.setHours(0, 0, 0, 0);
      HASS.callWS({ type: "recorder/statistics_during_period", start_time: st.toISOString(), end_time: new Date().toISOString(), statistic_ids: [ENT.energy.energyTotal], period: "day", types: ["change"] }).then(function (r) {
        EN.days = (r[ENT.energy.energyTotal] || []).map(function (x) { return { d: new Date(tms(x.start)), v: x.change }; }).filter(function (x) { return x.v !== null && x.v !== undefined; }); drawDays();
      }).catch(function () { EN.days = []; drawDays(); });
    }
    function drawDays() {
      var box = $("#en-days"), a = EN.days, sum = $("#en-days-sum"); if (!box) return;
      EN.pDrawn = EN.pEff;
      var eur = EN.dayUnit === "eur";
      $("#en-days-t").textContent = eur ? T("Costo giornaliero") : T("Consumo giornaliero");
      if (!a.length) { box.innerHTML = '<div class="en-empty" style="position:static;height:120px;display:grid">' + T("Storico non disponibile") + '</div>'; if (sum) sum.innerHTML = ""; return; }
      var vals = a.map(function (x) { return eur ? x.v * EN.pEff : x.v; });
      var mx = Math.max.apply(null, vals) || 1, today = new Date().toDateString(), wd = T.lang === "en" ? ["S", "M", "T", "W", "T", "F", "S"] : ["D", "L", "M", "M", "G", "V", "S"], tk = 0;
      a.forEach(function (x) { tk += x.v; });
      box.innerHTML = a.map(function (x, i) {
        return '<div class="day' + (x.d.toDateString() === today ? " today" : "") + '" title="' + x.d.toLocaleDateString(LOC, { weekday: "long", day: "numeric", month: "long" }) + " · " + fmtKwh(x.v) + " kWh · " + fmtEur(x.v * EN.pEff) + '"><span class="d-v">' + (eur ? Number(vals[i]).toLocaleString(LOC, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : fmtKwh(vals[i])) + '</span><span class="bar2" style="height:' + Math.max(3, vals[i] / mx * 100) + '%"></span><span class="d-l">' + wd[x.d.getDay()] + x.d.getDate() + "</span></div>";
      }).join("");
      if (sum) { sum.innerHTML = '<span class="echip"><i class="mdi mdi-sigma"></i>' + T("Totale") + ' <b>' + fmtKwh(tk) + ' kWh</b> · <b>' + fmtEur(tk * EN.pEff) + '</b></span><span class="echip"><i class="mdi mdi-chart-line"></i>' + T("Media al giorno") + ' <b>' + fmtKwh(tk / a.length) + ' kWh</b> · <b>' + fmtEur(tk / a.length * EN.pEff) + '</b></span><span class="echip"><i class="mdi mdi-information-outline"></i>' + T("Calcolato con {p}", { p: fmtP(EN.pEff) + " " + CUR + "/kWh" }) + '</span>'; hydrate(sum); }
    }
    function enEnter() { renderEnergy(); enLoad(true); daysLoad(); kpiStats(); }
    function buildEnergy() {
      if (!$("#en-hero")) return;
      $$("#en-range button").forEach(function (b) { b.addEventListener("click", function () { EN.range = b.dataset.r; $$("#en-range button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); enLoad(true); }); });
      var plot = $("#en-plot"), tip = $("#en-tip");
      function move(e) {
        if (!EN.geo) return; var r = plot.getBoundingClientRect(), x = Math.min(Math.max(e.clientX - r.left, 0), r.width), t2 = EN.geo.t0 + x / r.width * EN.geo.dt, best = null, bd = 1e18;
        EN.geo.data.forEach(function (d) { var dd = Math.abs(d.t - t2); if (dd < bd) { bd = dd; best = d; } });
        if (!best) return; var w = fmtW(best.v), cur = $("#en-cur"), px = EN.geo.xs(best.t);
        cur.style.display = ""; cur.setAttribute("x1", px); cur.setAttribute("x2", px);
        tip.hidden = false; tip.style.left = Math.min(Math.max(px / EN.geo.W * r.width, 40), r.width - 40) + "px"; tip.textContent = fmtHM(best.t) + " · " + w.n + " " + w.u + (EN.pEff > 0 ? " · " + fmtEur(best.v / 1000 * EN.pEff) + "/h" : "");
      }
      plot.addEventListener("pointermove", move); plot.addEventListener("pointerdown", move);
      plot.addEventListener("pointerleave", function () { tip.hidden = true; var c = $("#en-cur"); if (c) c.style.display = "none"; });
      $("#chip-power").addEventListener("click", function () { show("en"); });
      EN.dayUnit = store("dayunit") === "eur" ? "eur" : "kwh";
      $$("#en-dunit button").forEach(function (b) {
        b.setAttribute("aria-pressed", b.dataset.u === EN.dayUnit ? "true" : "false");
        b.addEventListener("click", function () { EN.dayUnit = b.dataset.u; store("dayunit", EN.dayUnit); $$("#en-dunit button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); drawDays(); });
      });
      buildPrice();
      renderEnergy();
    }

    /* ------------------------------------------------------------------ ciclo di vita */
    var ro = null;
    function start() {
      if (running) return; running = true;
      every(function () { if (!LIVE) { chipPower(demoPower()); if (!$("#view-en").hidden) renderEnergy(); } else { livePoll(); if (!$("#view-en").hidden) { enLoad(false); kpiStats(); } } enAge(); tickClock(); lastMotionText(); camsTick(); var d = new Date(), ts = pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()); $$("[data-stamp]").forEach(function (n) { n.textContent = ts; }); }, 1000);
      every(tickDate, 60000);
      every(function () { if (stOpen === "motion") renderPop(false); }, 5000);
      if (!LIVE) later(motionLoop, 1800);
      applyFx();
      if (window.ResizeObserver) { var rzT; ro = new ResizeObserver(function () { clearTimeout(rzT); rzT = setTimeout(function () { fxHero.resize(); fxPage.resize(); movePill(); }, 120); }); ro.observe($("#shell")); }
    }
    function stop() {
      running = false;
      timers.forEach(function (t) { clearInterval(t); clearTimeout(t); }); timers = [];
      if (ro) { ro.disconnect(); ro = null; }
      fxHero.stop(); fxPage.stop();
    }
    function destroy() { stop(); if (PK) { PK.destroy(); PK = null; } unbinds.forEach(function (u) { u(); }); unbinds = []; }

    /* ------------------------------------------------------------------ pacchetti (vedi pacchetti.js) */
    var PK = null, hassWait = [];
    /* la scheda nasce prima di ricevere hass: i pacchetti aspettano il collegamento */
    function whenHass() {
      var h = HASS || ctx.hass;
      if (h && h.callWS) return Promise.resolve(h);
      return new Promise(function (ok) { hassWait.push(ok); });
    }
    function packApi(p) {
      var key = "aurora-v3-pack-" + p.id;
      return {
        id: p.id, glassVersion: VERSION, live: LIVE, embedded: EMB, lang: T.lang, T: T, reduceMotion: reduce,
        root: ROOT, host: HOST, layer: LAYER, scroll: SCROLL,
        $: $, $$: $$, el: el, esc: esc, hydrate: hydrate, on: on,
        /* coordinate dello strato dove vanno menu e finestre (dentro Home Assistant non è la pagina intera) */
        layerOffset: function () { return EMB ? LAYER.getBoundingClientRect() : { left: 0, top: 0 }; },
        assets: BASE,
        image: function (k, onState) { return resolve(k, k, onState !== false); },
        library: function () { return Object.keys(IMG).map(function (k) { var it = IMG[k]; return { key: k, src: it.kind === "single" ? it.src : it.on }; }); },
        rooms: function () {
          return ROOMS.map(function (r) {
            return { name: r.n, icon: r.ic, color: r.c, lights: r.l.map(function (k) { return { key: k, name: LIGHTS[k][0], entity: ENT.lights[k] || null, image: LIGHTS[k][1] }; }) };
          });
        },
        scenes: function () {
          return SCENES.map(function (sc) { return { id: sc.id, name: sc.n, sub: sc.sub, icon: sc.ic, s1: sc.s1, s2: sc.s2, image: sc.img, lights: (sc.lights || []).slice(), alarm: sc.alarm || null, entity: sc.entity || null }; });
        },
        state: state, hass: function () { return HASS; }, entity: sv, unavailable: isUnavail,
        call: call, moreInfo: moreInfo, toast: toast, burst: burst, render: render, show: show,
        runScene: function (id) { var sc = SCENES.filter(function (x) { return x.id === id; })[0]; if (sc) runScene(sc, $('[data-scene="' + id + '"]')); },
        /* accende o spegne una luce di Glass (chiave delle stanze): nell'anteprima cambia solo lo stato */
        setLight: function (k, onOff) {
          if (!(k in state.lights)) return;
          state.lights[k] = !!onOff; state.scene = null;
          if (LIVE && ENT.lights[k]) call("homeassistant", onOff ? "turn_on" : "turn_off", { entity_id: ENT.lights[k] });
          render();
        },
        /* una vista in più con il suo tasto nel dock; hideDock: id dei tasti di Glass da nascondere */
        addView: function (o) {
          var vid = "pk-" + o.id;
          if (VIEWS[vid]) return $("#view-" + vid);
          var sec = el("section", "enter", "", { id: "view-" + vid, "aria-label": o.label || o.id });
          sec.hidden = true; sec.style.cssText = "display:flex;flex-direction:column;gap:22px";
          $("#main").appendChild(sec);
          VIEWS[vid] = "#view-" + vid;
          var b = el("button", "", '<i class="mdi ' + (o.icon || "mdi-puzzle") + '"></i><span>' + esc(o.label || o.id) + "</span>", { type: "button", "data-view": vid });
          var sep = $(".dock .sep"); sep.parentNode.insertBefore(b, sep);
          hydrate(b);
          b.addEventListener("click", function () { show(vid); });
          (o.hideDock || []).forEach(function (id) { var d = $("#" + id); if (d) d.hidden = true; });
          return sec;
        },
        viewId: function (id) { return "pk-" + id; },
        /* dati del pacchetto: in Home Assistant restano nell'integrazione (uguali su tutti i dispositivi).
           get() dà null se il pacchetto non ha mai salvato niente e fallisce se non riesce a leggere:
           così un errore non diventa mai "dati vuoti" da sovrascrivere */
        storage: {
          get: function () {
            if (LIVE) return whenHass().then(function (h) { return h.callWS({ type: "aurora_glass/pack_data", pack: p.id }); }).then(function (r) { return r ? r.data : null; });
            try { return Promise.resolve(JSON.parse(localStorage.getItem(key) || "null")); } catch (e) { return Promise.resolve(null); }
          },
          set: function (data) {
            if (LIVE) return whenHass().then(function (h) { return h.callWS({ type: "aurora_glass/pack_data/save", pack: p.id, data: data }); }).catch(function (e) { toast(T("Non riuscito: {e}", { e: (e && e.message) || T("errore di Home Assistant") }), "mdi-alert-circle", "var(--warn)"); });
            try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
            return Promise.resolve();
          }
        }
      };
    }

    /* ------------------------------------------------------------------ avvio */
    T.dom(ROOT);
    if (!LIVE) { var tv = $("#temp-val"); if (tv) tv.textContent = fmt(21.4) + " °C"; }   /* anteprima: numero nel formato della lingua */
    if (CUR !== "€") {
      setIco($(".pb-ico i"), CUR_ICON);
      var cw = document.createTreeWalker($("#pricebox"), NodeFilter.SHOW_TEXT, null), cn;
      while ((cn = cw.nextNode())) if (cn.nodeValue.indexOf("€") > -1) cn.nodeValue = cn.nodeValue.replace(/€/g, CUR);
      var be = $('#en-dunit [data-u="eur"]'); if (be) be.textContent = CUR;
    }
    if (LIVE) { HOST.setAttribute("data-live", "1"); var fnote = $("footer.note"); if (fnote) fnote.textContent = T("Aurora Glass v3 · collegata a Home Assistant"); }
    if (EMB) HOST.setAttribute("data-embedded", "1");
    hydrate(ROOT);

    buildScenes(); buildRooms(); buildSecurity(); buildDrawer(); buildClima(); buildEnergy(); refreshAll();
    var th = store("theme"); setTheme(th === "light" ? "light" : "dark");
    setBtn(S.btn === "compact" ? "compact" : "img");
    tickDate(); tickClock(); applyWorld();
    render(); setAlarm("disarmed", true); render();
    start();
    later(function () { Object.keys(IMG).forEach(function (k) { var it = IMG[k]; [it.on, it.src].forEach(function (u) { if (u) { var i = new Image(); i.src = u; } }); }); }, 1200);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(movePill);
    if (g.AuroraPacks) PK = g.AuroraPacks.attach({ version: VERSION, root: ROOT, embedded: EMB, makeApi: packApi, hass: function () { return HASS; } });

    return { clima: clima, state: state, S: S, setHass: setHass, start: start, stop: stop, destroy: destroy, setWorld: setWorld, applyHour: applyHour, openDrawer: openDrawer, setEdit: setEdit, fxHero: fxHero, setAlarm: setAlarm, show: show, openPrice: openPrice, ENT: ENT, runScene: function (id) { var sc = SCENES.filter(function (x) { return x.id === id; })[0]; runScene(sc, $('[data-scene="' + id + '"]')); } };
  };
})(window);
