/* ============================================================================
   AURORA GLASS v3 — motore di disegno delle immagini dei pulsanti
   Ogni immagine è una funzione draw(on, t): t va da 0 a 1 e il ciclo si chiude
   da solo (così la GIF si ripete senza scatti). Lo usa tools/render_btn.py per
   produrre i file PNG (spento) e GIF (acceso) in assets/btn/.
   ========================================================================== */
(function (g) {
  var TAU = Math.PI * 2;
  var DEFS = [], N = 0, PFX = '', RC = 0;
  var f = function (n) { return Math.round(n * 100) / 100; };
  var sn = function (t, k, p) { return Math.sin(TAU * (t * (k || 1) + (p || 0))); };
  var cs = function (t, k, p) { return Math.cos(TAU * (t * (k || 1) + (p || 0))); };
  var fr = function (x) { return x - Math.floor(x); };
  var clamp = function (x, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a === undefined ? 0 : a, x)); };
  var hsl = function (h, s, l, a) { return 'hsla(' + h + ',' + s + '%,' + l + '%,' + (a === undefined ? 1 : a) + ')'; };
  function rnd(seed) { var s = (seed * 9301 + 49297) % 2147483647; if (s <= 0) s += 2147483646; return function () { s = (s * 16807) % 2147483647; return (s % 100000) / 100000; }; }
  function uid(p) { return PFX + p + (N++); }

  /* gradienti */
  function lg(stops, o) {
    o = o || {};
    var i = uid('lg');
    DEFS.push('<linearGradient id="' + i + '" x1="' + (o.x1 || 0) + '" y1="' + (o.y1 || 0) + '" x2="' + (o.x2 === undefined ? 0 : o.x2) + '" y2="' + (o.y2 === undefined ? 1 : o.y2) + '">' +
      stops.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '" stop-opacity="' + (s[2] === undefined ? 1 : s[2]) + '"/>'; }).join('') + '</linearGradient>');
    return 'url(#' + i + ')';
  }
  function rg(stops, o) {
    o = o || {};
    var i = uid('rg');
    DEFS.push('<radialGradient id="' + i + '" cx="' + (o.cx === undefined ? .5 : o.cx) + '" cy="' + (o.cy === undefined ? .5 : o.cy) + '" r="' + (o.r === undefined ? .5 : o.r) + '">' +
      stops.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '" stop-opacity="' + (s[2] === undefined ? 1 : s[2]) + '"/>'; }).join('') + '</radialGradient>');
    return 'url(#' + i + ')';
  }

  /* primitive */
  function R(x, y, w, h, fill, rx, ex) { return '<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '"' + (rx ? ' rx="' + rx + '"' : '') + ' fill="' + fill + '" ' + (ex || '') + '/>'; }
  function C(cx, cy, r, fill, ex) { return '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '" fill="' + fill + '" ' + (ex || '') + '/>'; }
  function E(cx, cy, rx, ry, fill, ex) { return '<ellipse cx="' + f(cx) + '" cy="' + f(cy) + '" rx="' + f(rx) + '" ry="' + f(ry) + '" fill="' + fill + '" ' + (ex || '') + '/>'; }
  function P(pts, fill, ex) { return '<polygon points="' + pts + '" fill="' + fill + '" ' + (ex || '') + '/>'; }
  function PA(d, fill, ex) { return '<path d="' + d + '" fill="' + fill + '" ' + (ex || '') + '/>'; }
  function ST(d, stroke, w, ex) { return '<path d="' + d + '" fill="none" stroke="' + stroke + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round" ' + (ex || '') + '/>'; }
  function Gr(inner, tf, ex) { return '<g' + (tf ? ' transform="' + tf + '"' : '') + ' ' + (ex || '') + '>' + inner + '</g>'; }
  function glow(cx, cy, r, col, a) { return C(cx, cy, r, rg([[0, col, a === undefined ? 1 : a], [.45, col, (a === undefined ? 1 : a) * .35], [1, col, 0]])); }
  function blur(inner, sd) { return '<g filter="url(#' + PFX + 'b' + sd + ')">' + inner + '</g>'; }
  function cone(xt, yt, wt, xb, yb, wb, col, a) {
    return P(f(xt - wt / 2) + ',' + yt + ' ' + f(xt + wt / 2) + ',' + yt + ' ' + f(xb + wb / 2) + ',' + yb + ' ' + f(xb - wb / 2) + ',' + yb, lg([[0, col, a], [1, col, 0]]));
  }
  function motes(t, x, y, w, h, n, col, seed, r0) {
    var rd = rnd(seed || 3), s = '';
    for (var i = 0; i < n; i++) {
      var px = rd(), py = rd(), ph = rd(), q = fr(t + ph);
      s += C(x + w * px + 7 * sn(t, 1, ph), y + h * (1 - q), (r0 || 1.3) * (0.6 + py * .9), col, 'opacity="' + f(Math.sin(Math.PI * q) * .75) + '"');
    }
    return s;
  }
  function stars(n, x, y, w, h, t, seed, col) {
    var rd = rnd(seed || 5), s = '';
    for (var i = 0; i < n; i++) {
      var px = rd(), py = rd(), ph = rd();
      s += C(x + w * px, y + h * py, 0.7 + rd() * 1.2, col || '#fff', 'opacity="' + f(.35 + .65 * Math.abs(sn(t, 1, ph))) + '"');
    }
    return s;
  }
  function roomBase(hue, floorY) {
    floorY = floorY || 178;
    return R(0, 0, 256, floorY, lg([[0, hsl(hue, 34, 34)], [1, hsl(hue, 38, 21)]])) +
      R(0, floorY, 256, 256 - floorY, lg([[0, hsl(hue, 28, 19)], [1, hsl(hue, 34, 8)]])) +
      R(0, floorY - 5, 256, 6, hsl(hue, 22, 44)) + R(0, floorY + 1, 256, 2, 'rgba(255,255,255,.07)');
  }

  var ART = {};
  function filters() {
    return '<filter id="' + PFX + 'b2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter>' +
      '<filter id="' + PFX + 'b4" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4"/></filter>' +
      '<filter id="' + PFX + 'b8" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="8"/></filter>' +
      '<filter id="' + PFX + 'b14" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="14"/></filter>' +
      '<filter id="' + PFX + 'off" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0.32"/><feComponentTransfer><feFuncR type="linear" slope=".58"/><feFuncG type="linear" slope=".6"/><feFuncB type="linear" slope=".72" intercept=".02"/></feComponentTransfer></filter>';
  }

  function render(key, on, t) {
    var a = ART[key];
    if (!a) throw new Error('arte sconosciuta: ' + key);
    DEFS = []; N = 0; PFX = 'k' + (RC++) + '_';
    var bg = R(0, 0, 256, 256, lg([[0, hsl(a.hue, 40, 20)], [1, hsl(a.hue, 45, 9)]]));
    var inner = a.draw(!!on, t || 0);
    var dimmed = !on && a.dim !== false;
    var vign = R(0, 0, 256, 256, rg([[.55, '#000', 0], [1, '#000', .38]], { r: .75 }));
    return '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs>' + filters() + DEFS.join('') + '</defs>' +
      '<g' + (dimmed ? ' filter="url(#' + PFX + 'off)"' : '') + '>' + bg + inner + '</g>' + vign + '</svg>';
  }

  function begin(prefix) { DEFS = []; N = 0; PFX = prefix || ('k' + (RC++) + '_'); }
  function defs() { return DEFS.join(''); }

  g.AR = { begin: begin, defs: defs, filters: filters, TAU: TAU, f: f, sn: sn, cs: cs, fr: fr, clamp: clamp, hsl: hsl, rnd: rnd, lg: lg, rg: rg, R: R, C: C, E: E, P: P, PA: PA, ST: ST, Gr: Gr,
    glow: glow, blur: blur, uid: uid, cone: cone, motes: motes, stars: stars, roomBase: roomBase, ART: ART, render: render };
})(window);
