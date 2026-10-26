/* ============================================================================
   AURORA GLASS v3 — scheda personalizzata per Home Assistant
   <aurora-v3-card> : una scheda a tutta pagina (usala in una vista "panel").
   <aurora-glass-panel> : la stessa scheda come pagina della barra laterale
                          (la registra l'integrazione Aurora Glass).
   Config facoltativa (YAML):
     type: custom:aurora-v3-card
     language: auto                       # auto (lingua di Home Assistant), it, en
     assets: /local/aurora-v3/btn/        # cartella delle immagini
     rooms: [...]                         # stanze con nome, luci e sensori (vedi scheda-esempio.yaml)
     entities:                            # allarme, meteo, clima, energia...
       alarm: alarm_control_panel.casa
   ========================================================================== */
(function () {
  var CSS = __CSS__;
  var HTML = __HTML__;
  var PROPS = __PROPS__;
  var BUILD_ASSETS = __ASSETS__;
  /* riferimento preso subito: se nella stessa pagina c'è anche la vecchia scheda Aurora v3 (risorsa /local/ o HACS),
     il suo window.AuroraApp non deve sostituire quello di questa versione */
  var App = window.AuroraApp;
  /* nomi con la versione per la pagina della barra laterale: dopo un aggiornamento la versione nuova
     non trova mai i nomi già occupati da quella vecchia rimasta in memoria nel browser */
  var VER = __VERSION__.replace(/\./g, "-");
  var CARD_TAG = "aurora-glass-card-" + VER, PANEL_TAG = "aurora-glass-panel-" + VER;
  var OVERRIDES = [
    ":host { display: block; position: relative; --lp: absolute; --sp: absolute; --so: hidden auto; height: var(--aurora-height, calc(100vh - var(--header-height, 56px))); min-height: 520px; overflow: hidden; }",
    ".shell { height: 100%; min-height: 0; overflow: hidden; background: var(--bg); }",
    "i.mdi { display: inline-flex; align-items: center; justify-content: center; line-height: 1; vertical-align: middle; }",
    "i.mdi ha-icon { --mdc-icon-size: 1em; display: flex; width: 1em; height: 1em; }",
    ".scroll { scrollbar-width: thin; }",
    ":host([data-menu]) .topbar .wrap { padding-left: 60px; }",
    /* le finestre (immagini, tariffa, stanze e dispositivi) sotto il pulsante del menu di Home Assistant */
    ":host([data-menu]) .modal { padding-top: 64px; }",
    ":host([data-menu]) .mcard.hb { height: min(900px, calc(100dvh - 80px)); }"
  ].join("\n");

  // Le immagini stanno accanto al file: /hacsfiles/aurora-glass-v3/ (HACS), /aurora_glass/ (integrazione) o /local/aurora-v3/ (a mano).
  function defaultAssets() {
    if (BUILD_ASSETS) return BUILD_ASSETS;
    var s = document.querySelector('script[src*="aurora-v3.js"]');
    return s ? s.src.replace(/aurora-v3\.js.*$/, "btn/") : "/local/aurora-v3/btn/";
  }
  function boot() {
    if (document.getElementById("aurora-v3-global")) return;
    var st = document.createElement("style"); st.id = "aurora-v3-global"; st.textContent = PROPS; document.head.appendChild(st);
    var l = document.createElement("link"); l.id = "aurora-v3-fonts"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@500;600;700;800&display=swap";
    document.head.appendChild(l);
  }
  function haLang(h, cfg) {
    if (cfg.language && cfg.language !== "auto") return cfg.language;
    return (h && ((h.locale && h.locale.language) || h.language)) || "";
  }

  class AuroraV3Card extends HTMLElement {
    constructor() { super(); this._root = this.attachShadow({ mode: "open" }); this._app = null; this._hass = null; this._config = null; this._sig = ""; }
    setConfig(config) {
      config = config || {};
      var sig = JSON.stringify(config);
      if (sig === this._sig) return;
      this._config = config; this._sig = sig;
      if (this._app) this._unmount();
      if (this._hass) this._mount();
    }
    /* si monta quando ci sono sia la config sia hass: servono la lingua e i nomi delle entità */
    _mount() {
      boot();
      var style = document.createElement("style"); style.textContent = CSS + "\n" + OVERRIDES;
      var wrap = document.createElement("div"); wrap.innerHTML = HTML;
      this._root.appendChild(style);
      while (wrap.firstChild) this._root.appendChild(wrap.firstChild);
      var self = this, cfg = JSON.parse(this._sig || "{}");
      this._app = new App({
        root: this._root, host: this, layer: this._root.querySelector("#shell"), scroll: this._root.querySelector("#scroll"),
        assets: cfg.assets || defaultAssets(), live: true, embedded: true, haIcons: true, config: cfg, hass: this._hass, lang: haLang(this._hass, cfg), version: __VERSION__,
        call: function (domain, service, data) { return self._hass.callService(domain, service, data); },
        moreInfo: function (entityId) { self.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: entityId } })); }
      });
      this._app.setHass(this._hass);
      if (!this.isConnected) this._app.stop();
    }
    _unmount() {
      try { this._app.destroy(); } catch (e) {}
      this._app = null;
      while (this._root.firstChild) this._root.removeChild(this._root.firstChild);
    }
    set hass(h) { this._hass = h; if (this._app) this._app.setHass(h); else if (this._config) this._mount(); }
    get hass() { return this._hass; }
    getCardSize() { return 20; }
    getLayoutOptions() { return { grid_columns: 12, grid_rows: 12 }; }
    connectedCallback() { if (this._app) this._app.start(); }
    disconnectedCallback() { if (this._app) this._app.stop(); }
    static getStubConfig() { return {}; }
  }
  /* aurora-glass-card è il nome di questa versione (lo usa la pagina della barra laterale);
     aurora-v3-card resta per le plance già fatte, se la vecchia scheda non l'ha già registrato */
  if (!customElements.get(CARD_TAG)) customElements.define(CARD_TAG, AuroraV3Card);
  if (!customElements.get("aurora-glass-card")) customElements.define("aurora-glass-card", class extends AuroraV3Card {});
  if (!customElements.get("aurora-v3-card")) customElements.define("aurora-v3-card", class extends AuroraV3Card {});

  /* pagina della barra laterale: Home Assistant le passa hass, narrow e panel (panel.config.card = config della scheda) */
  class AuroraGlassPanel extends HTMLElement {
    constructor() { super(); this._card = null; this._hass = null; this._panel = null; this._narrow = false; }
    connectedCallback() {
      if (this._card) return;
      this.style.display = "block"; this.style.height = "100%";
      this._card = document.createElement(CARD_TAG);
      this._card.style.setProperty("--aurora-height", "100dvh");
      this.appendChild(this._card);
      this._menu = document.createElement("button");
      this._menu.type = "button"; this._menu.setAttribute("aria-label", "Menu");
      this._menu.innerHTML = '<ha-icon icon="mdi:menu"></ha-icon>';
      this._menu.style.cssText = "position:fixed;top:max(10px,env(safe-area-inset-top));left:10px;z-index:20;width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.18);background:rgba(15,18,40,.55);color:#fff;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:none;align-items:center;justify-content:center;cursor:pointer;padding:0";
      var self = this;
      this._menu.addEventListener("click", function () { self.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true })); });
      this.appendChild(this._menu);
      this._apply();
    }
    set hass(h) { this._hass = h; if (this._card) this._card.hass = h; }
    get hass() { return this._hass; }
    set narrow(v) { this._narrow = !!v; this._apply(); }
    get narrow() { return this._narrow; }
    set panel(p) { this._panel = p; this._apply(); }
    get panel() { return this._panel; }
    set route(r) {}
    _apply() {
      if (!this._card) return;
      var cfg = (this._panel && this._panel.config && this._panel.config.card) || {};
      this._card.setConfig(cfg);
      if (this._hass) this._card.hass = this._hass;
      this._menu.style.display = this._narrow ? "flex" : "none";
      if (this._narrow) this._card.setAttribute("data-menu", "1"); else this._card.removeAttribute("data-menu");
    }
  }
  if (!customElements.get(PANEL_TAG)) customElements.define(PANEL_TAG, AuroraGlassPanel);
  window.AuroraGlassPanelTag = PANEL_TAG;

  window.customCards = window.customCards || [];
  window.customCards.push({ type: "aurora-glass-card", name: "Aurora Glass v3", description: "Animated dashboard: worlds, weather effects and buttons made of images and GIFs." });
  console.info("%c AURORA GLASS v3 %c card loaded ", "background:#7C5CFF;color:#fff;border-radius:4px 0 0 4px;padding:2px 6px", "background:#1b1740;color:#fff;border-radius:0 4px 4px 0;padding:2px 6px");
})();
