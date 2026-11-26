/* ============================================================================
   AURORA GLASS v3 — «Stanze e dispositivi»
   Finestra dentro la plancia per cambiare stanze, luci, sensori, climatizzatori,
   energia, sicurezza e scene senza rifare la procedura guidata.
   Legge e salva le opzioni dell'integrazione (aurora_glass/config e
   aurora_glass/config/save, vedi editor.py): valgono su tutti i dispositivi.
   Solo per gli amministratori di Home Assistant.
   api = { $, $$, el, esc, hydrate, T, toast, hass(), entryId, images, imageSrc(k), imageName(k), appName(id), saved() }
   ========================================================================== */
(function (g) {
  "use strict";
  var MOTION = ["motion", "occupancy", "presence"], OPEN = ["door", "window", "garage_door", "opening"];
  function dc(s) { return s && s.attributes ? s.attributes.device_class : ""; }
  /* cosa si può scegliere in ogni campo */
  var KINDS = {
    lights: { ic: "mdi-lightbulb-outline", ok: function (id) { return /^(light|switch)\./.test(id); } },
    motion: { ic: "mdi-motion-sensor", ok: function (id, s) { return /^binary_sensor\./.test(id) && MOTION.indexOf(dc(s)) > -1; } },
    openings: { ic: "mdi-door", ok: function (id, s) { return /^lock\./.test(id) || (/^binary_sensor\./.test(id) && OPEN.indexOf(dc(s)) > -1); } },
    temperature: { ic: "mdi-thermometer", ok: function (id, s) { return /^sensor\./.test(id) && dc(s) === "temperature"; } },
    covers: { ic: "mdi-window-shutter", ok: function (id) { return /^cover\./.test(id); } },
    climate: { ic: "mdi-air-conditioner", ok: function (id) { return /^climate\./.test(id); } },
    power: { ic: "mdi-flash", ok: function (id, s) { return /^sensor\./.test(id) && dc(s) === "power"; } },
    energy: { ic: "mdi-counter", ok: function (id, s) { return /^sensor\./.test(id) && dc(s) === "energy"; } },
    alarm: { ic: "mdi-shield-home", ok: function (id) { return /^alarm_control_panel\./.test(id); } },
    weather: { ic: "mdi-weather-partly-cloudy", ok: function (id) { return /^weather\./.test(id); } },
    cameras: { ic: "mdi-cctv", ok: function (id) { return /^camera\./.test(id); } },
    vacuum: { ic: "mdi-robot-vacuum", ok: function (id) { return /^(vacuum|lawn_mower)\./.test(id); } },
    switch_any: { ic: "mdi-toggle-switch", ok: function (id) { return /^(switch|valve|input_boolean)\./.test(id); } },
    humidity: { ic: "mdi-water-percent", ok: function (id, s) { return /^sensor\./.test(id) && dc(s) === "humidity"; } },
    /* frase del meteo: un sensore (anche template), un input_text o un'entità text */
    ai_text: { ic: "mdi-creation", ok: function (id) { return /^(sensor|input_text|text)\./.test(id); },
      /* in cima input_text, text e i sensori che contengono una frase (non un numero) */
      rank: function (id, s) { if (/^(input_text|text)\./.test(id)) return 2; var v = s ? String(s.state) : ""; return isNaN(parseFloat(v)) && v.length > 20 ? 2 : 0; } },
    moisture: { ic: "mdi-water-percent", ok: function (id, s) { return /^sensor\./.test(id); } },
    sensor_any: { ic: "mdi-gauge", ok: function (id) { return /^(sensor|binary_sensor)\./.test(id); } },
    scene: { ic: "mdi-palette", ok: function (id) { return /^(light|switch|scene|script)\./.test(id); } }
  };
  /* un interruttore che sembra un elettrodomestico o una presa: tra le luci va segnalato */
  var APPLIANCE = /(^|[^a-z])(tv|pc)([^a-z]|$)|lavatric|asciugatric|lavastovigl|frigo|fridge|forno|oven|microonde|microwave|bimby|thermomix|friggitric|fryer|sterilizz|caff|coffee|bollitor|kettle|tostapan|piastra|boiler|scaldabagn|stufa|heater|deumid|condizionat|clima|purific|aspirap|presa|plug|outlet|socket|multipres|(^|[^a-z0-9])(pro\s*)?3?em([^a-z0-9]|$)/i;
  var LAMP = /lamp|luce|luci|light|(^|[^a-z])led|strip|striscia|farett|abat|piantana|lume|lantern|plafonier|applique|albero|natale/i;

  g.AuroraHomeEditor = function (api) {
    var $ = api.$, $$ = api.$$, el = api.el, esc = api.esc, T = api.T;
    var box = $("#homebox"), body = $("#hb-body"), tabsBox = $("#hb-tabs"), pickBox = $("#hb-pick");
    var D = null, orig = "", tab = "rooms", openRoom = -1, P = null, confirmT = 0;
    var TABS = [["rooms", T("Stanze"), "mdi-floor-plan"], ["climate", T("Clima"), "mdi-air-conditioner"], ["energy", T("Energia"), "mdi-lightning-bolt"],
      ["security", T("Sicurezza"), "mdi-shield-home"], ["weather", T("Meteo"), "mdi-weather-partly-cloudy"], ["robot", T("Robot"), "mdi-robot-vacuum"], ["garden", T("Giardino"), "mdi-sprinkler-variant"],
      ["infra", T("Server & UPS"), "mdi-server-network"], ["scenes", T("Scene"), "mdi-palette"]];
    var ROOM_FIELDS = [["lights", T("Luci"), T("anche i relè e le prese che accendono una lampada")], ["motion", T("Sensori di movimento"), ""],
      ["openings", T("Porte e finestre"), T("anche le serrature")], ["covers", T("Tapparelle e tende"), T("anche persiane, tende da sole e gruppi di tapparelle")],
      ["temperature", T("Temperatura"), ""]];

    /* ------------------------------------------------------------------ dati di Home Assistant */
    function H() { return api.hass(); }
    function st(id) { var h = H(); return h && h.states ? h.states[id] : null; }
    function name(id) { var s = st(id); return (s && s.attributes.friendly_name) || String(id).split(".").pop().replace(/_/g, " "); }
    function reg(id) { var h = H(); return h && h.entities ? h.entities[id] : null; }
    function areaOf(id) {
      var h = H(), e = reg(id); if (!e) return null;
      if (e.area_id) return e.area_id;
      var d = e.device_id && h.devices ? h.devices[e.device_id] : null;
      return d ? d.area_id || null : null;
    }
    function areaName(a) { var h = H(), x = a && h.areas ? h.areas[a] : null; return x ? x.name : ""; }
    function na(s) { return !s || s.state === "unavailable" || s.state === "unknown"; }
    function stateTxt(s) {
      if (!s) return T("non trovata");
      if (s.state === "unavailable") return T("non disponibile");
      var u = s.attributes.unit_of_measurement;
      if (u) return s.state + " " + u;
      return { on: T("acceso"), off: T("spento"), open: T("aperta"), closed: T("chiusa"), locked: T("bloccata"), unlocked: T("sbloccata"), disarmed: T("disattivato"), idle: T("pronta"),
        cool: T("freddo"), heat: T("caldo"), dry: T("deumidifica"), fan_only: T("ventola"), heat_cool: T("automatico"), auto: T("automatico"), unknown: "—" }[s.state] || s.state;
    }
    function looksAppliance(id) { var t = id + " " + name(id); return /^switch\./.test(id) && APPLIANCE.test(t) && !LAMP.test(t); }

    /* ------------------------------------------------------------------ percorsi dei campi: r3.lights, d.climate, s.morning */
    function getF(f) {
      var p = f.split("."), o = p[0] === "d" ? D.devices : p[0] === "s" ? D.scenes : D.rooms[+p[0].slice(1)];
      return o ? o[p[1]] : null;
    }
    function setF(f, v) {
      var p = f.split("."), o = p[0] === "d" ? D.devices : p[0] === "s" ? D.scenes : D.rooms[+p[0].slice(1)];
      if (o) o[p[1]] = v;
    }
    function list(x) { return Array.isArray(x) ? x.filter(Boolean) : (x ? [x] : []); }
    function normalize(r) {
      var d = r.devices || {}, s = r.scenes || {};
      return {
        rooms: (r.rooms || []).map(function (x) {
          return { area_id: x.area_id || null, name: x.name || "", image: x.image || "salotto", lights: list(x.lights), motion: list(x.motion), openings: list(x.openings), temperature: list(x.temperature), covers: list(x.covers) };
        }),
        devices: {
          alarm: d.alarm || null, weather: d.weather || null, climate: list(d.climate), power: d.power || null, energy: d.energy || null,
          appliances: list(d.appliances), cameras: list(d.cameras), currency: d.currency || null, alarms: list(d.alarms),
          vacuums: list(d.vacuums).length ? list(d.vacuums) : list(d.vacuum), vacuum_model: d.vacuum_model || "Roborock",
          garden_z1_sw: d.garden_z1_sw || null, garden_z1_moist: d.garden_z1_moist || null,
          garden_z2_sw: d.garden_z2_sw || null, garden_z2_moist: d.garden_z2_moist || null,
          garden_z3_sw: d.garden_z3_sw || null, garden_z3_moist: d.garden_z3_moist || null,
          garden_z4_sw: d.garden_z4_sw || null, garden_z4_moist: d.garden_z4_moist || null,
          weather_ai: d.weather_ai || null,
          ws_wind: d.ws_wind || null, ws_rain: d.ws_rain || null, ws_uv: d.ws_uv || null, ws_press: d.ws_press || null,
          ws_lightning_dist: d.ws_lightning_dist || null, ws_lightning_count: d.ws_lightning_count || null,
          ws_temp_out: d.ws_temp_out || null, ws_hum_out: d.ws_hum_out || null, ws_temp_in: d.ws_temp_in || null, ws_hum_in: d.ws_hum_in || null, ws_gust: d.ws_gust || null,
          server_cpu: d.server_cpu || null, server_ram: d.server_ram || null, server_temp: d.server_temp || null, server_disk: d.server_disk || null,
          ups_battery: d.ups_battery || null, ups_load: d.ups_load || null, ups_runtime: d.ups_runtime || null, ups_status: d.ups_status || null, ups_voltage: d.ups_voltage || null
        },
        scenes: { morning: list(s.morning), cinema: list(s.cinema), dinner: list(s.dinner), night_alarm: s.night_alarm !== false, away_alarm: s.away_alarm !== false }
      };
    }
    function dirty() { return D && JSON.stringify(D) !== orig; }

    /* ------------------------------------------------------------------ pezzi dell'interfaccia */
    function chip(f, id, warn) {
      var s = st(id), cls = "hf-chip" + (warn ? " warn" : "") + (na(s) ? " na" : "") + (s && s.state === "on" ? " on" : "");
      var n = f === "d.appliances" ? api.appName(id) : name(id);   /* come nella vista Energia: «Lavastoviglie», non «shelly1pm-E8DB… Potenza» */
      return '<span class="' + cls + '" title="' + esc(id + " · " + stateTxt(s) + (warn ? " · " + T("Sembra un elettrodomestico o una presa, non una luce") : "")) + '">' +
        (warn ? '<i class="mdi mdi-alert"></i>' : '<span class="hf-dot"></span>') + '<span class="hf-cn">' + esc(n) + "</span>" +
        '<button class="hf-x" type="button" data-a="rm" data-f="' + f + '" data-id="' + esc(id) + '" aria-label="' + esc(T("Togli {n}", { n: n })) + '"><i class="mdi mdi-close"></i></button></span>';
    }
    function multi(f, kind, label, sub, warnFn) {
      var ids = list(getF(f));
      return '<div class="hf-group"><h4><i class="mdi ' + KINDS[kind].ic + '"></i>' + esc(label) + (sub ? " <small>" + esc(sub) + "</small>" : "") + '</h4><div class="hf-chips">' +
        ids.map(function (id) { return chip(f, id, warnFn && warnFn(id)); }).join("") +
        '<button class="hf-add" type="button" data-a="add" data-f="' + f + '" data-k="' + kind + '" data-m="1" data-l="' + esc(label) + '"><i class="mdi mdi-plus"></i>' + esc(ids.length ? T("Aggiungi") : T("Scegli")) + "</button></div></div>";
    }
    function one(f, kind, label, sub) {
      var id = getF(f), s = id ? st(id) : null;
      return '<div class="hf-group"><h4><i class="mdi ' + KINDS[kind].ic + '"></i>' + esc(label) + (sub ? " <small>" + esc(sub) + "</small>" : "") + '</h4><div class="hf-one">' +
        (id ? '<span class="hf-ent' + (na(s) ? " na" : "") + '"><b>' + esc(name(id)) + "</b><small>" + esc(id + " · " + stateTxt(s)) + "</small></span>" : '<span class="hf-ent empty"><b>' + esc(T("Nessuno")) + "</b><small>" + esc(T("questa parte della plancia non compare")) + "</small></span>") +
        '<button class="hf-add" type="button" data-a="add" data-f="' + f + '" data-k="' + kind + '" data-m="0" data-l="' + esc(label) + '"><i class="mdi mdi-swap-horizontal"></i>' + esc(id ? T("Cambia") : T("Scegli")) + "</button>" +
        (id ? '<button class="hf-add ghost" type="button" data-a="clr" data-f="' + f + '"><i class="mdi mdi-close"></i>' + esc(T("Togli")) + "</button>" : "") + "</div></div>";
    }
    /* elenco in ordine (il primo climatizzatore è quello mostrato all'apertura) */
    function ordered(f, kind, addLabel) {
      var ids = list(getF(f));
      var rows = ids.map(function (id, i) {
        var s = st(id), tags = [];
        if (s && s.attributes.assumed_state) tags.push('<em class="tag">' + esc(T("infrarossi: stato presunto")) + "</em>");
        if (na(s)) tags.push('<em class="tag warn">' + esc(s ? T("non disponibile") : T("non trovata")) + "</em>");
        if (i === 0 && ids.length > 1) tags.unshift('<em class="tag acc">' + esc(T("si apre con questo")) + "</em>");
        return '<div class="hf-row"><span class="hf-ri"><i class="mdi ' + KINDS[kind].ic + '"></i></span><span class="hf-rt"><b>' + esc(name(id)) + "</b><small>" + esc(id + " · " + stateTxt(s)) + "</small>" + (tags.length ? '<span class="tags">' + tags.join("") + "</span>" : "") + "</span>" +
          '<span class="hf-ra"><button class="hb-ib" type="button" data-a="up" data-f="' + f + '" data-id="' + esc(id) + '" aria-label="' + esc(T("Sposta su")) + '"' + (i === 0 ? " disabled" : "") + '><i class="mdi mdi-arrow-up"></i></button>' +
          '<button class="hb-ib" type="button" data-a="down" data-f="' + f + '" data-id="' + esc(id) + '" aria-label="' + esc(T("Sposta giù")) + '"' + (i === ids.length - 1 ? " disabled" : "") + '><i class="mdi mdi-arrow-down"></i></button>' +
          '<button class="hb-ib" type="button" data-a="rm" data-f="' + f + '" data-id="' + esc(id) + '" aria-label="' + esc(T("Togli {n}", { n: name(id) })) + '"><i class="mdi mdi-close"></i></button></span></div>';
      }).join("");
      return '<div class="hf-list">' + (rows || '<p class="hf-empty">' + esc(T("Nessuno: questa parte della plancia non compare")) + "</p>") + "</div>" +
        '<button class="btn ghost hf-wide" type="button" data-a="add" data-f="' + f + '" data-k="' + kind + '" data-m="1" data-l="' + esc(addLabel) + '"><i class="mdi mdi-plus"></i>' + esc(addLabel) + "</button>";
    }
    function counts(r) {
      var p = [];
      p.push(T(r.lights.length === 1 ? "{n} luce" : "{n} luci", { n: r.lights.length }));
      if (r.motion.length) p.push(T(r.motion.length === 1 ? "{n} sensore di movimento" : "{n} sensori di movimento", { n: r.motion.length }));
      if (r.openings.length) p.push(T(r.openings.length === 1 ? "{n} porta o finestra" : "{n} porte e finestre", { n: r.openings.length }));
      if (r.covers.length) p.push(T(r.covers.length === 1 ? "{n} tapparella" : "{n} tapparelle", { n: r.covers.length }));
      if (r.temperature.length) p.push(T("temperatura"));
      return p.join(" · ");
    }

    /* ------------------------------------------------------------------ schede */
    function renderRooms() {
      var h = '<p class="note-sm">' + esc(T("Tocca una stanza per cambiare nome, immagine, luci e sensori. L'ordine qui è l'ordine nella plancia.")) + "</p>";
      D.rooms.forEach(function (r, i) {
        var open = i === openRoom, warn = r.lights.filter(looksAppliance);
        h += '<article class="hr' + (open ? " open" : "") + (warn.length ? " haswarn" : "") + '" data-i="' + i + '">' +
          '<div class="hr-head" role="button" tabindex="0" data-a="room" data-i="' + i + '" aria-expanded="' + open + '">' +
          '<img class="hr-img" alt="" draggable="false" src="' + esc(api.imageSrc(r.image)) + '"><span class="hr-t"><b>' + esc(r.name || T("Senza nome")) + "</b><small>" + esc(counts(r)) + (warn.length ? ' · <span class="w">' + esc(T("da controllare")) + "</span>" : "") + "</small></span>" +
          '<span class="hr-act"><button class="hb-ib" type="button" data-a="rup" data-i="' + i + '" aria-label="' + esc(T("Sposta su")) + '"' + (i === 0 ? " disabled" : "") + '><i class="mdi mdi-arrow-up"></i></button>' +
          '<button class="hb-ib" type="button" data-a="rdown" data-i="' + i + '" aria-label="' + esc(T("Sposta giù")) + '"' + (i === D.rooms.length - 1 ? " disabled" : "") + '><i class="mdi mdi-arrow-down"></i></button>' +
          '<button class="hb-ib del" type="button" data-a="rdel" data-i="' + i + '" aria-label="' + esc(T("Elimina la stanza")) + '"' + (D.rooms.length < 2 ? " disabled" : "") + '><i class="mdi mdi-delete-outline"></i></button></span>' +
          '<i class="mdi mdi-chevron-down hr-chev"></i></div>';
        if (open) {
          /* sui telefoni i comandi della stanza stanno qui, con le scritte (nell'intestazione non c'è posto) */
          h += '<div class="hr-body"><div class="hr-act2">' +
            '<button class="hf-add ghost" type="button" data-a="rup" data-i="' + i + '"' + (i === 0 ? " disabled" : "") + '><i class="mdi mdi-arrow-up"></i>' + esc(T("Sposta su")) + "</button>" +
            '<button class="hf-add ghost" type="button" data-a="rdown" data-i="' + i + '"' + (i === D.rooms.length - 1 ? " disabled" : "") + '><i class="mdi mdi-arrow-down"></i>' + esc(T("Sposta giù")) + "</button>" +
            '<button class="hf-add ghost hb-ib-del" type="button" data-a="rdel" data-i="' + i + '"' + (D.rooms.length < 2 ? " disabled" : "") + '><i class="mdi mdi-delete-outline"></i>' + esc(T("Elimina la stanza")) + "</button></div>" +
            '<label class="hf-lab">' + esc(T("Nome")) + '<input class="hf-in" type="text" maxlength="60" data-f="r' + i + '.name" value="' + esc(r.name) + '"></label>' +
            '<div class="hf-lab">' + esc(T("Immagine")) + (r.area_id ? ' <small>' + esc(T("area di Home Assistant: {n}", { n: areaName(r.area_id) || r.area_id })) + "</small>" : "") + '</div><div class="hf-imgs" role="radiogroup" aria-label="' + esc(T("Immagine")) + '">' +
            api.images.map(function (k) { return '<button type="button" role="radio" data-a="img" data-i="' + i + '" data-v="' + k + '" aria-checked="' + (r.image === k) + '"><img alt="" draggable="false" src="' + esc(api.imageSrc(k)) + '"><span>' + esc(api.imageName(k)) + "</span></button>"; }).join("") + "</div>";
          if (warn.length) h += '<p class="hf-warn"><i class="mdi mdi-alert"></i>' + esc(T(warn.length === 1
            ? "{n}: sembra un elettrodomestico o una presa, non una luce. Se è così toglilo con la ×: comparirà tra gli elettrodomestici se aggiungi il suo sensore di potenza in Energia."
            : "{n}: sembrano elettrodomestici o prese, non luci. Se è così toglili con la ×: compariranno tra gli elettrodomestici se aggiungi il loro sensore di potenza in Energia.", { n: warn.map(name).join(", ") })) + "</p>";
          ROOM_FIELDS.forEach(function (x) { h += multi("r" + i + "." + x[0], x[0], x[1], x[2], x[0] === "lights" ? looksAppliance : null); });
          h += "</div>";
        }
        h += "</article>";
      });
      return h + '<button class="btn ghost hf-wide" type="button" data-a="radd"><i class="mdi mdi-plus"></i>' + esc(T("Aggiungi una stanza")) + "</button>";
    }
    function renderClimate() {
      var assumed = list(D.devices.climate).some(function (id) { var s = st(id); return s && s.attributes.assumed_state; });
      return '<p class="note-sm">' + esc(T("Con due o più climatizzatori nella plancia compare una riga per passare dall'uno all'altro.")) + "</p>" +
        ordered("d.climate", "climate", T("Aggiungi un climatizzatore")) +
        (assumed ? '<p class="hf-warn"><i class="mdi mdi-information-outline"></i>' + esc(T("Quelli a infrarossi (SwitchBot, Broadlink…) non dicono a Home Assistant se sono accesi: la plancia mostra l’ultimo comando inviato. Se lo stesso climatizzatore ha anche un’integrazione vera (Panasonic, Daikin, LG…), scegli quella.")) + "</p>" : "");
    }
    function renderEnergy() {
      return one("d.power", "power", T("Potenza di tutta la casa"), T("in W, attiva la vista Energia")) +
        one("d.energy", "energy", T("Contatore di tutta la casa"), T("in kWh, per oggi, mese, anno e storico")) +
        multi("d.appliances", "power", T("Elettrodomestici"), T("il sensore di potenza di ognuno: presa smart o relè"));
    }
    function renderSecurity() {
      return one("d.alarm", "alarm", T("Centrale allarme"), T("i tasti seguono le modalità che la centrale sa fare: In casa, Notte, Fuori casa")) +
        multi("d.alarms", "alarm", T("Modalità telecamere e altre centrali"), T("es. Arlo, Blink: Fuori casa, In casa, Standby")) +
        multi("d.cameras", "cameras", T("Telecamere"), "") +
        '<p class="note-sm">' + esc(T("Faretto, sirena e batteria di ogni telecamera vengono trovati da soli tra le entità dello stesso dispositivo. Il tasto Foto salva l'immagine in Media › aurora_glass.")) + "</p>";
    }
    function renderWeather() {
      return one("d.weather", "weather", T("Meteo"), T("previsioni di oggi e domani e temperatura esterna in alto")) +
        one("d.weather_ai", "ai_text", T("Frase del meteo (AI)"), T("sensore, input_text o text con la frase da mostrare")) +
        '<div class="hf-group"><h4><i class="mdi mdi-weather-station"></i>' + esc(T("Stazione Meteo (es. Ecowitt, Netatmo)")) + " <small>" + esc(T("si apre toccando la temperatura in alto")) + '</small></h4></div>' +
        one("d.ws_temp_out", "temperature", T("Temperatura esterna"), T("se c'è, sostituisce quella del servizio meteo")) +
        one("d.ws_hum_out", "humidity", T("Umidità esterna"), "") +
        one("d.ws_temp_in", "temperature", T("Temperatura interna"), T("es. la console della stazione")) +
        one("d.ws_hum_in", "humidity", T("Umidità interna"), "") +
        one("d.ws_wind", "sensor_any", T("Sensore Vento"), T("velocità vento km/h")) +
        one("d.ws_gust", "sensor_any", T("Raffica"), T("raffica massima km/h")) +
        one("d.ws_rain", "sensor_any", T("Sensore Pioggia"), T("pioggia mm o mm/h")) +
        one("d.ws_uv", "sensor_any", T("Indice UV"), T("indice raggi ultravioletti")) +
        one("d.ws_press", "sensor_any", T("Pressione atmosferica"), T("pressione in hPa")) +
        one("d.ws_lightning_dist", "sensor_any", T("Distanza fulmini"), T("km dal temporale")) +
        one("d.ws_lightning_count", "sensor_any", T("Scariche fulmini"), T("numero colpi rilevati"));
    }
    function renderRobot() {
      var models = [["Roborock", "mdi-robot-vacuum"], ["Dreame", "mdi-robot-vacuum-variant"], ["Roomba", "mdi-robot-vacuum"], ["Ecovacs", "mdi-robot-vacuum"], ["Tagliaerba", "mdi-robot-mower"]];
      var curModel = D.devices.vacuum_model || "Roborock";
      var mHtml = '<div class="hf-group"><h4><i class="mdi mdi-robot-vacuum"></i>' + esc(T("Tipo / Modello di Robot")) + '</h4><div class="hf-chips">' +
        models.map(function (m) {
          var sel = m[0] === curModel;
          return '<button class="hf-chip' + (sel ? " on" : "") + '" type="button" data-a="vac-m" data-m="' + m[0] + '"><i class="mdi ' + m[1] + '"></i>' + m[0] + '</button>';
        }).join("") + '</div></div>';

      return '<p class="note-sm">' + esc(T("Aggiungi tutti i robot che hai: aspirapolvere, lavapavimenti e tagliaerba. Con più di uno nella plancia compare una riga per passare dall'uno all'altro.")) + "</p>" +
        multi("d.vacuums", "vacuum", T("Robot di casa"), T("es. vacuum.roborock_saros_10r")) + mHtml;
    }
    function renderGarden() {
      var h = '<p class="note-sm">' + esc(T("Ogni zona è un'elettrovalvola (interruttore o valvola di Home Assistant) con, se vuoi, il sensore di umidità del terreno. Le zone senza elettrovalvola né sensore non compaiono. Il nome della zona è quello dell'elettrovalvola.")) + "</p>" +
        '<p class="note-sm">' + esc(T("Nella plancia ogni zona ha un cursore con la durata: Home Assistant chiude l'elettrovalvola da solo allo scadere, anche con la plancia chiusa.")) + "</p>";
      for (var i = 1; i <= 4; i++) {
        h += one("d.garden_z" + i + "_sw", "switch_any", T("Zona {n}: elettrovalvola", { n: i }), i === 1 ? T("es. irrigazione prato") : "") +
          one("d.garden_z" + i + "_moist", "moisture", T("Zona {n}: umidità terreno", { n: i }), T("sensore in %"));
      }
      return h;
    }
    function renderInfra() {
      return '<p class="note-sm">' + esc(T("Monitoraggio hardware del server Home Assistant (Mini PC) e del gruppo di continuità (UPS tramite NUT).")) + "</p>" +
        '<div class="hf-group"><h4><i class="mdi mdi-server"></i>' + esc(T("Server Home Assistant (Mini PC)")) + '</h4></div>' +
        /* 3.8.3 · issue #2: i sensori di System Monitor nascono disattivati, quindi non compaiono in nessun elenco finché non si attivano */
        '<p class="note-sm">' + esc(T("I sensori di System Monitor (CPU, memoria, temperatura, disco) nascono disattivati: per sceglierli qui attivali prima in Impostazioni → Dispositivi e servizi → System Monitor → entità.")) + "</p>" +
        one("d.server_cpu", "sensor_any", T("Utilizzo CPU"), T("percentuale %")) +
        one("d.server_ram", "sensor_any", T("Memoria RAM"), T("percentuale %")) +
        one("d.server_temp", "sensor_any", T("Temperatura CPU"), T("gradi °C")) +
        one("d.server_disk", "sensor_any", T("Utilizzo Disco"), T("percentuale %")) +
        '<div class="hf-group"><h4><i class="mdi mdi-battery-charging"></i>' + esc(T("Gruppo di Continuità (UPS NUT)")) + '</h4></div>' +
        one("d.ups_battery", "sensor_any", T("Livello Batteria UPS"), T("percentuale %")) +
        one("d.ups_load", "sensor_any", T("Carico UPS"), T("percentuale % o W")) +
        one("d.ups_runtime", "sensor_any", T("Autonomia Residua"), T("minuti rimanenti")) +
        one("d.ups_status", "sensor_any", T("Stato Linea UPS"), T("Online / Su batteria")) +
        one("d.ups_voltage", "sensor_any", T("Tensione"), T("Volt V"));
    }
    function renderScenes() {
      var h = '<p class="note-sm">' + esc(T("Cosa accende ogni scena: tutte le altre luci della plancia si spengono. Puoi scegliere anche una scena o uno script di Home Assistant. Una scena vuota non compare.")) + "</p>";
      h += multi("s.morning", "scene", T("Buongiorno"), "") + multi("s.cinema", "scene", T("Cinema"), "") + multi("s.dinner", "scene", T("Cena"), "");
      if (D.devices.alarm) {
        h += '<div class="row"><span class="grow">' + esc(T("Buonanotte inserisce l'allarme notte")) + '</span><button class="toggle" type="button" data-a="tog" data-f="s.night_alarm" aria-pressed="' + D.scenes.night_alarm + '" aria-label="' + esc(T("Buonanotte inserisce l'allarme notte")) + '"></button></div>';
        h += '<div class="row"><span class="grow">' + esc(T("Esco di casa inserisce l'allarme fuori casa")) + '</span><button class="toggle" type="button" data-a="tog" data-f="s.away_alarm" aria-pressed="' + D.scenes.away_alarm + '" aria-label="' + esc(T("Esco di casa inserisce l'allarme fuori casa")) + '"></button></div>';
      }
      return h;
    }
    function render(keepScroll) {
      var y = body.scrollTop;
      tabsBox.innerHTML = "";
      TABS.forEach(function (t) {
        var b = el("button", "", '<i class="mdi ' + t[2] + '"></i>' + esc(t[1]), { type: "button", role: "tab", "aria-selected": t[0] === tab ? "true" : "false", "aria-pressed": t[0] === tab ? "true" : "false" });
        b.addEventListener("click", function () { tab = t[0]; render(); body.scrollTop = 0; });
        tabsBox.appendChild(b);
      });
      body.innerHTML = { rooms: renderRooms, climate: renderClimate, energy: renderEnergy, security: renderSecurity, weather: renderWeather, robot: renderRobot, garden: renderGarden, infra: renderInfra, scenes: renderScenes }[tab]();
      api.hydrate(body); api.hydrate(tabsBox);
      if (keepScroll) body.scrollTop = y;
      $("#hb-save").disabled = !dirty();
    }

    /* ------------------------------------------------------------------ azioni */
    function move(arr, i, d) { var j = i + d; if (j < 0 || j >= arr.length) return; var x = arr[i]; arr[i] = arr[j]; arr[j] = x; }
    body.addEventListener("click", function (e) {
      var b = e.target.closest("[data-a]"); if (!b || b.disabled) return;
      var a = b.dataset.a, f = b.dataset.f, i = +b.dataset.i, ids;
      if (a === "vac-m") { D.devices.vacuum_model = b.dataset.m; render(true); return; }
      if (a === "room") { openRoom = openRoom === i ? -1 : i; render(true); if (openRoom === i) later0(function () { var r = $('.hr[data-i="' + i + '"]', body); if (r) r.scrollIntoView({ block: "nearest", behavior: "smooth" }); }); return; }
      e.stopPropagation();
      if (a === "rup" || a === "rdown") { move(D.rooms, i, a === "rup" ? -1 : 1); if (openRoom === i) openRoom = i + (a === "rup" ? -1 : 1); }
      else if (a === "rdel") {
        if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.classList.add("sure"); b.title = T("Tocca ancora per eliminare"); api.toast(T("Tocca ancora il cestino per eliminare «{n}»", { n: D.rooms[i].name }), "mdi-delete-alert", "var(--warn)"); setTimeout(function () { b.dataset.sure = ""; b.classList.remove("sure"); }, 3500); return; }
        D.rooms.splice(i, 1); openRoom = -1;
      }
      else if (a === "radd") {
        D.rooms.push({ area_id: null, name: T("Nuova stanza"), image: "salotto", lights: [], motion: [], openings: [], temperature: [], covers: [] });
        openRoom = D.rooms.length - 1; render(true);
        later0(function () { var inp = $('.hr.open .hf-in', body); if (inp) { inp.scrollIntoView({ block: "center", behavior: "smooth" }); inp.focus(); inp.select(); } });
        return;
      }
      else if (a === "img") D.rooms[i].image = b.dataset.v;
      else if (a === "rm") { ids = list(getF(f)).filter(function (x) { return x !== b.dataset.id; }); setF(f, ids); }
      else if (a === "up" || a === "down") { ids = list(getF(f)); move(ids, ids.indexOf(b.dataset.id), a === "up" ? -1 : 1); setF(f, ids); }
      else if (a === "clr") setF(f, null);
      else if (a === "tog") setF(f, !getF(f));
      else if (a === "add") { openPick(f, b.dataset.k, b.dataset.m === "1", b.dataset.l); return; }
      render(true);
    });
    body.addEventListener("keydown", function (e) { if ((e.key === "Enter" || e.key === " ") && e.target.dataset && e.target.dataset.a === "room") { e.preventDefault(); e.target.click(); } });
    body.addEventListener("input", function (e) {
      var t = e.target; if (!t.dataset || !t.dataset.f) return;
      setF(t.dataset.f, t.value);
      var head = t.closest(".hr"), b = head && $(".hr-t b", head); if (b) b.textContent = t.value || T("Senza nome");
      $("#hb-save").disabled = !dirty();
    });
    function later0(fn) { setTimeout(fn, 30); }

    /* ------------------------------------------------------------------ scelta delle entità */
    function openPick(f, kind, multiple, label) {
      var m = /^r(\d+)\./.exec(f), room = m ? D.rooms[+m[1]] : null, used = {};
      if (room && kind === "lights") D.rooms.forEach(function (r) { if (r !== room) r.lights.forEach(function (id) { used[id] = r.name; }); });
      P = { f: f, kind: kind, multiple: multiple, sel: multiple ? list(getF(f)) : [], area: room ? room.area_id : null, used: used, q: "" };
      $("#hk-title").textContent = label;
      $("#hk-sub").textContent = multiple ? T("Tocca per aggiungere o togliere, poi Fatto") : T("Tocca quello giusto");
      $("#hk-done").hidden = !multiple;
      var q = $("#hk-q"); q.value = "";
      pickBox.hidden = false; renderPick();
      setTimeout(function () { q.focus(); }, 60);
    }
    function closePick() { P = null; pickBox.hidden = true; }
    function renderPick() {
      var h = H(), K = KINDS[P.kind], q = P.q.toLowerCase(), rows = [];
      Object.keys((h && h.states) || {}).forEach(function (id) {
        var s = h.states[id], e = reg(id);
        if (!K.ok(id, s)) return;
        var chosen = P.sel.indexOf(id) > -1;
        /* niente entità nascoste o di configurazione (tranne quelle già scelte) */
        if (!chosen && e && (e.hidden || (e.entity_category && /^(light|switch)\./.test(id)))) return;
        var a = areaOf(id), an = areaName(a), n = name(id);
        if (q && (n + " " + id + " " + an).toLowerCase().indexOf(q) < 0) return;
        rows.push({ id: id, n: n, an: an, near: !!(P.area && a === P.area), s: s, chosen: chosen });
      });
      rows.sort(function (x, y) { return (K.rank ? K.rank(y.id, y.s) - K.rank(x.id, x.s) : 0) || (y.near - x.near) || x.n.localeCompare(y.n); });
      var more = rows.length > 250; rows = rows.slice(0, 250);
      var cur = P.multiple ? null : getF(P.f);
      $("#hk-list").innerHTML = rows.map(function (r) {
        var on = P.multiple ? r.chosen : r.id === cur, warn = P.kind === "lights" && looksAppliance(r.id);
        return '<button class="hk-row' + (on ? " on" : "") + (na(r.s) ? " na" : "") + '" type="button" role="option" aria-selected="' + on + '" data-id="' + esc(r.id) + '">' +
          '<span class="hk-ck"><i class="mdi mdi-check"></i></span><span class="hk-t"><b>' + esc(r.n) + (warn ? ' <i class="mdi mdi-alert hk-w" title="' + esc(T("Sembra un elettrodomestico o una presa, non una luce")) + '"></i>' : "") + "</b><small>" + esc(r.id + (r.an ? " · " + r.an : "") + " · " + stateTxt(r.s)) + "</small></span>" +
          (P.used[r.id] ? '<em class="tag">' + esc(T("già in {n}", { n: P.used[r.id] })) + "</em>" : "") + "</button>";
      }).join("") + (more ? '<p class="hf-empty">' + esc(T("Ce ne sono altre: scrivi qualcosa per cercarle")) + "</p>" : "") + (!rows.length ? '<p class="hf-empty">' + esc(T("Nessuna entità trovata")) + "<br>" + esc(T("Se esiste ma non compare, potrebbe essere disattivata: attivala in Impostazioni → Dispositivi e servizi → Entità.")) + "</p>" : "");
      api.hydrate($("#hk-list"));
      $("#hk-count").textContent = P.multiple ? T(P.sel.length === 1 ? "{n} scelta" : "{n} scelte", { n: P.sel.length }) : "";
    }
    $("#hk-list").addEventListener("click", function (e) {
      var b = e.target.closest("[data-id]"); if (!b || !P) return;
      var id = b.dataset.id;
      if (!P.multiple) { setF(P.f, id); closePick(); render(true); return; }
      var i = P.sel.indexOf(id); if (i > -1) P.sel.splice(i, 1); else P.sel.push(id);
      var y = $("#hk-list").scrollTop; renderPick(); $("#hk-list").scrollTop = y;
    });
    $("#hk-q").addEventListener("input", function (e) { if (P) { P.q = e.target.value; renderPick(); } });
    $("#hk-done").addEventListener("click", function () { if (P) setF(P.f, P.sel.slice()); closePick(); render(true); });
    $("#hk-close").addEventListener("click", closePick);

    /* ------------------------------------------------------------------ apri, chiudi, salva */
    function show() { box.classList.add("open"); box.setAttribute("aria-hidden", "false"); setTimeout(function () { $("#hb-close").focus({ preventScroll: true }); }, 300); }
    function close() { closePick(); box.classList.remove("open"); box.setAttribute("aria-hidden", "true"); D = null; resetCancel(); }
    function resetCancel() { clearTimeout(confirmT); var c = $("#hb-cancel"); c.dataset.sure = ""; c.textContent = T("Annulla"); }
    function askClose() {
      if (!dirty()) { close(); return; }
      var c = $("#hb-cancel");
      if (c.dataset.sure === "1") { close(); return; }
      c.dataset.sure = "1"; c.textContent = T("Scarta le modifiche?");
      api.toast(T("Hai modifiche non salvate: tocca di nuovo per scartarle"), "mdi-alert-circle", "var(--warn)");
      clearTimeout(confirmT); confirmT = setTimeout(resetCancel, 4000);
    }
    function save() {
      var bad = D.rooms.map(function (r, i) { return r.name.trim() ? -1 : i; }).filter(function (i) { return i > -1; })[0];
      if (bad !== undefined) { tab = "rooms"; openRoom = bad; render(); api.toast(T("Dai un nome a ogni stanza"), "mdi-alert-circle", "var(--warn)"); return; }
      var btn = $("#hb-save"); btn.disabled = true;
      var payload = { type: "aurora_glass/config/save", entry_id: api.entryId, rooms: D.rooms.map(function (r) { return { area_id: r.area_id, name: r.name.trim(), image: r.image, lights: r.lights, motion: r.motion, openings: r.openings, temperature: r.temperature, covers: r.covers }; }),
        devices: D.devices, scenes: D.scenes };
      H().callWS(payload).then(function () {
        close();
        api.toast(T("Salvato: la plancia si aggiorna su tutti i dispositivi"), "mdi-content-save-check", "var(--ok)");
        api.saved();
      }).catch(function (err) {
        btn.disabled = false;
        api.toast(T("Non salvato: {e}", { e: (err && err.message) || T("errore di Home Assistant") }), "mdi-alert-circle", "var(--warn)");
      });
    }
    $("#hb-save").addEventListener("click", save);
    $("#hb-cancel").addEventListener("click", askClose);
    $("#hb-close").addEventListener("click", askClose);
    box.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (P) closePick(); else askClose();
    });

    return {
      open: function (t, room) {
        var h = H();
        if (!h || !h.callWS) return;
        h.callWS({ type: "aurora_glass/config", entry_id: api.entryId }).then(function (r) {
          D = normalize(r); orig = JSON.stringify(D);
          tab = TABS.some(function (x) { return x[0] === t; }) ? t : "rooms";
          openRoom = typeof room === "number" ? room : -1;
          resetCancel(); closePick(); render(); body.scrollTop = 0; show();
        }).catch(function (err) {
          api.toast(T("Non riesco a leggere la configurazione: {e}", { e: (err && err.message) || T("errore di Home Assistant") }), "mdi-alert-circle", "var(--warn)");
        });
      },
      isOpen: function () { return box.classList.contains("open"); },
      close: close
    };
  };
})(window);
