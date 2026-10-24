/* ============================================================================
   AURORA GLASS — presa per i pacchetti
   Un pacchetto è un file JS che si registra così (anche prima che la scheda sia caricata):

     (window.AuroraGlassPacks = window.AuroraGlassPacks || []).push({
       id: "regia", name: "Regia", version: "1.0.0", glass: "3.3.0",   // glass = versione minima di Aurora Glass
       css: "...",                                                       // facoltativo, :root diventa :host dentro HA
       mount: function (api) { ...; return { hass: fn(h), show: fn(view), destroy: fn() }; }
     });

   Ogni scheda Aurora aperta chiama mount() con la sua api (vedi aurora-app.js, packApi).
   I pacchetti li scarica e li attiva l'integrazione: Configura → Pacchetti.
   ========================================================================== */
(function (g) {
  "use strict";
  var list = g.AuroraGlassPacks = g.AuroraGlassPacks || [];
  var hosts = [];   /* schede aperte che vogliono sapere dei pacchetti arrivati dopo */
  if (!list.__aurora) {
    var push = Array.prototype.push;
    list.push = function () {
      var n = push.apply(list, arguments), added = Array.prototype.slice.call(arguments);
      hosts.slice().forEach(function (h) { added.forEach(function (p) { h(p); }); });
      return n;
    };
    Object.defineProperty(list, "__aurora", { value: true });
  }

  /* "3.10.0" >= "3.3.0" */
  function atLeast(have, need) {
    var a = String(have || "0").split("."), b = String(need || "0").split(".");
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      var x = parseInt(a[i] || "0", 10), y = parseInt(b[i] || "0", 10);
      if (x !== y) return x > y;
    }
    return true;
  }

  /* @property non funziona dentro lo shadow DOM: va nel documento, una volta sola */
  var PROP_RE = /@property\s+--[\w-]+\s*\{[^}]*\}/g;
  function addCss(root, embedded, id, css) {
    if (!css) return null;
    var props = css.match(PROP_RE) || [];
    if (props.length && !document.getElementById("aurora-pack-props-" + id)) {
      var p = document.createElement("style"); p.id = "aurora-pack-props-" + id; p.textContent = props.join("\n"); document.head.appendChild(p);
    }
    css = css.replace(PROP_RE, "");
    if (embedded) css = css.replace(/:root\[([^\]]+)\]/g, ":host([$1])").replace(/:root/g, ":host");
    var st = document.createElement("style"); st.setAttribute("data-pack", id); st.textContent = css;
    (embedded ? root : document.head).appendChild(st);
    return st;
  }

  /* collega i pacchetti a una scheda: makeApi(pack) dà l'api per quel pacchetto */
  function attach(opts) {
    var mounted = {}, handles = [];
    function mount(p) {
      if (!p || !p.id || mounted[p.id] || typeof p.mount !== "function") return;
      if (p.glass && !atLeast(opts.version, p.glass)) {
        console.warn("Aurora Glass: il pacchetto «" + (p.name || p.id) + "» richiede Aurora Glass " + p.glass + " o più recente (questa è " + opts.version + ")");
        return;
      }
      mounted[p.id] = true;
      var style = addCss(opts.root, opts.embedded, p.id, p.css), h = null;
      try { h = p.mount(opts.makeApi(p)) || {}; }
      catch (e) { console.error("Aurora Glass: errore nel pacchetto «" + (p.name || p.id) + "»", e); h = {}; }
      h.__style = style; h.__id = p.id;
      handles.push(h);
      if (opts.hass && h.hass) try { h.hass(opts.hass()); } catch (e) { console.error(e); }
    }
    list.forEach(mount);
    hosts.push(mount);
    function each(fn) { handles.forEach(function (h) { try { fn(h); } catch (e) { console.error("Aurora Glass: errore nel pacchetto «" + h.__id + "»", e); } }); }
    return {
      list: function () { return Object.keys(mounted); },
      hass: function (hs) { each(function (h) { if (h.hass) h.hass(hs); }); },
      shown: function (view) { each(function (h) { if (h.show) h.show(view); }); },
      destroy: function () {
        var i = hosts.indexOf(mount); if (i > -1) hosts.splice(i, 1);
        each(function (h) { if (h.destroy) h.destroy(); if (h.__style) h.__style.remove(); });
        handles = []; mounted = {};
      }
    };
  }

  g.AuroraPacks = { attach: attach, atLeast: atLeast };
})(window);
