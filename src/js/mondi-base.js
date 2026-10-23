/* ============================================================================
   AURORA GLASS v3 — MONDI: base comune
   - palette continua per ogni ora del giorno (alba → giorno → tramonto → notte)
   - posizione di sole e luna lungo l'arco
   - cielo, stelle, nuvole, uccelli e piccoli helper SMIL riusati da tutti i mondi
   Ogni mondo produce un SVG autonomo e animato (CSS + SMIL): lo stesso file
   funziona come <img>, come sfondo CSS e dentro Home Assistant.
   ========================================================================== */
(function (g) {
  var A = g.AR, f = A.f;
  var poly = A.P, path = A.PA, rect = A.R, circ = A.C, ell = A.E, line = A.ST, grp = A.Gr;

  /* ------------------------------------------------------------- colori */
  function h2r(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function r2h(r) { return '#' + r.map(function (v) { return ('0' + Math.round(Math.max(0, Math.min(255, v))).toString(16)).slice(-2); }).join(''); }
  function mix(a, b, t) { var x = h2r(a), y = h2r(b); return r2h([0, 1, 2].map(function (i) { return x[i] + (y[i] - x[i]) * t; })); }

  /* fasce: s1..s3 cielo (alto→basso) · hf/hn colline lontane/vicine · win luce finestre · sun · cl nuvole · st stelle
     dy luce del giorno (0 notte → 1 giorno) · b1..b3 colori dello sfondo UI · a1,a2 colori dei pulsanti */
  var KEYS = [
    [0,    { s1: '#070B24', s2: '#141A52', s3: '#2A2A78', hf: '#121A4A', hn: '#0A0F33', win: '#FFD27A', sun: '#FFF1B0', cl: .06, st: 1,   dy: 0,   b1: '#7C5CFF', b2: '#3B82F6', b3: '#22D3EE', a1: '#7C5CFF', a2: '#D946EF' }],
    [5,    { s1: '#070B24', s2: '#141A52', s3: '#2A2A78', hf: '#121A4A', hn: '#0A0F33', win: '#FFD27A', sun: '#FFF1B0', cl: .06, st: 1,   dy: 0,   b1: '#7C5CFF', b2: '#3B82F6', b3: '#22D3EE', a1: '#7C5CFF', a2: '#D946EF' }],
    [6.5,  { s1: '#3A2A7A', s2: '#D9648C', s3: '#FFC38A', hf: '#7A4F93', hn: '#44286B', win: '#FFE3A3', sun: '#FFC27A', cl: .38, st: .3,  dy: .35, b1: '#FB7185', b2: '#F59E0B', b3: '#8B5CF6', a1: '#F43F5E', a2: '#F59E0B' }],
    [8.5,  { s1: '#4A90E6', s2: '#8ACBFB', s3: '#F6E6D2', hf: '#6AB48C', hn: '#3F8F66', win: '#FFF6D2', sun: '#FFF3B8', cl: .7,  st: 0,   dy: .9,  b1: '#38BDF8', b2: '#34D399', b3: '#818CF8', a1: '#0284C7', a2: '#6366F1' }],
    [12,   { s1: '#2F86E6', s2: '#74BFFB', s3: '#D4EEFF', hf: '#6DB98F', hn: '#3F8F66', win: '#FFF6D2', sun: '#FFF3B8', cl: .8,  st: 0,   dy: 1,   b1: '#38BDF8', b2: '#34D399', b3: '#818CF8', a1: '#0284C7', a2: '#6366F1' }],
    [16.5, { s1: '#3B86E0', s2: '#86C2F4', s3: '#F8E6C8', hf: '#6DB98F', hn: '#3F8F66', win: '#FFF6D2', sun: '#FFF3B8', cl: .75, st: 0,   dy: .95, b1: '#38BDF8', b2: '#34D399', b3: '#818CF8', a1: '#0284C7', a2: '#6366F1' }],
    [18.5, { s1: '#35205F', s2: '#C23F7A', s3: '#FF9A62', hf: '#7A3A78', hn: '#4A1F5E', win: '#FFD27A', sun: '#FFB36B', cl: .4,  st: .25, dy: .3,  b1: '#F97316', b2: '#EC4899', b3: '#8B5CF6', a1: '#EA580C', a2: '#DB2777' }],
    [20.5, { s1: '#10103A', s2: '#2B2260', s3: '#4A2D78', hf: '#2A1F58', hn: '#150F3A', win: '#FFD27A', sun: '#FFB36B', cl: .15, st: .8,  dy: .05, b1: '#8B5CF6', b2: '#6366F1', b3: '#22D3EE', a1: '#7C5CFF', a2: '#D946EF' }],
    [22,   { s1: '#070B24', s2: '#141A52', s3: '#2A2A78', hf: '#121A4A', hn: '#0A0F33', win: '#FFD27A', sun: '#FFF1B0', cl: .06, st: 1,   dy: 0,   b1: '#7C5CFF', b2: '#3B82F6', b3: '#22D3EE', a1: '#7C5CFF', a2: '#D946EF' }],
    [24,   { s1: '#070B24', s2: '#141A52', s3: '#2A2A78', hf: '#121A4A', hn: '#0A0F33', win: '#FFD27A', sun: '#FFF1B0', cl: .06, st: 1,   dy: 0,   b1: '#7C5CFF', b2: '#3B82F6', b3: '#22D3EE', a1: '#7C5CFF', a2: '#D946EF' }]
  ];
  function palette(h) {
    h = ((h % 24) + 24) % 24;
    var i = 0; while (i < KEYS.length - 2 && h > KEYS[i + 1][0]) i++;
    var a = KEYS[i], b = KEYS[i + 1], t = (h - a[0]) / (b[0] - a[0]), K = {};
    Object.keys(a[1]).forEach(function (k) {
      var x = a[1][k], y = b[1][k];
      K[k] = typeof x === 'number' ? x + (y - x) * t : mix(x, y, t);
    });
    K.nt = 1 - K.dy;                        // "notte" 0..1
    K.cloud = mix('#ffffff', K.s3, .35);    // colore delle nuvole
    return K;
  }
  function body(h) {
    var sunT = (h - 5.5) / 15, hm = (h >= 19.5) ? h - 19.5 : h + 4.5, moonT = hm / 11;
    function arc(t) { t = Math.min(1, Math.max(0, t)); return { x: 50 + 540 * t, y: 192 - Math.sin(Math.PI * t) * 140 }; }
    var s = arc(sunT), m = arc(moonT);
    return { sun: { x: s.x, y: s.y, vis: (sunT >= 0 && sunT <= 1) ? 1 : 0, t: sunT }, moon: { x: m.x, y: m.y, vis: (moonT >= 0 && moonT <= 1) ? 1 : 0, t: moonT } };
  }

  /* ------------------------------------------------------------- SMIL */
  function an(attr, values, dur, ex) { return '<animate attributeName="' + attr + '" values="' + values + '" dur="' + dur + 's" repeatCount="indefinite" ' + (ex || '') + '/>'; }
  function at(type, values, dur, ex) { return '<animateTransform attributeName="transform" type="' + type + '" values="' + values + '" dur="' + dur + 's" repeatCount="indefinite" ' + (ex || '') + '/>'; }
  function circA(cx, cy, r, fill, inner, ex) { return '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '" fill="' + fill + '" ' + (ex || '') + '>' + inner + '</circle>'; }
  function ellA(cx, cy, rx, ry, fill, inner, ex) { return '<ellipse cx="' + f(cx) + '" cy="' + f(cy) + '" rx="' + f(rx) + '" ry="' + f(ry) + '" fill="' + fill + '" ' + (ex || '') + '>' + inner + '</ellipse>'; }

  var BASECSS = '.tw{animation:tw 3.2s ease-in-out infinite}@keyframes tw{0%,100%{opacity:.95}50%{opacity:.2}}' +
    '.c1{animation:cl 80s linear infinite}.c2{animation:cl 120s linear infinite;animation-delay:-45s}.c3{animation:cl 100s linear infinite;animation-delay:-75s}' +
    '@keyframes cl{from{transform:translateX(-260px)}to{transform:translateX(900px)}}' +
    '.fl{animation:fl 2.8s steps(1) infinite}@keyframes fl{0%,100%{opacity:1}7%{opacity:.25}12%{opacity:1}55%{opacity:.7}58%{opacity:1}}' +
    '.pu{animation:pu 3s ease-in-out infinite}@keyframes pu{50%{opacity:.45}}';

  /* ------------------------------------------------------------- elementi comuni */
  function stars(K, o) {
    o = o || {};
    var rd = A.rnd(o.seed || 5), n = o.n || 38, s = '', ymax = o.ymax || 130;
    for (var i = 0; i < n; i++) {
      s += '<circle class="tw" cx="' + f(rd() * 640) + '" cy="' + f(rd() * ymax) + '" r="' + f(.5 + rd() * 1.1) + '" fill="#fff" style="animation-delay:-' + f(rd() * 4) + 's;animation-duration:' + f(2.4 + rd() * 2.8) + 's"/>';
    }
    return '<g opacity="' + f(Math.max(K.st, o.min || 0)) + '">' + s + '</g>';
  }
  function sunmoon(K, B, o) {
    o = o || {};
    var s = '';
    s += '<g transform="translate(' + f(B.sun.x) + ' ' + f(B.sun.y) + ')" opacity="' + B.sun.vis + '"><circle r="62" fill="' + A.rg([[0, '#fff', .95], [.22, K.sun, .6], [1, K.sun, 0]]) + '"/><circle r="15" fill="' + K.sun + '"/></g>';
    s += '<g transform="translate(' + f(B.moon.x) + ' ' + f(B.moon.y) + ')" opacity="' + B.moon.vis + '"><circle r="52" fill="' + A.rg([[0, '#DDE6FF', .5], [1, '#DDE6FF', 0]]) + '"/><circle r="13" fill="#EEF2FF"/><circle cx="-4" cy="-3" r="2.4" fill="#C9D3F5"/><circle cx="4" cy="4" r="3" fill="#C9D3F5"/></g>';
    return s;
  }
  function cloud(x, y, sc, cls, K) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + sc + ')" opacity="' + f(K.cl) + '"><g class="' + cls + '" fill="' + K.cloud + '"><ellipse cx="30" cy="12" rx="34" ry="9"/><ellipse cx="48" cy="5" rx="22" ry="10"/><ellipse cx="14" cy="8" rx="20" ry="8"/></g></g>';
  }
  function sky(K, B, o) {
    o = o || {};
    var s = rect(0, 0, 640, 260, A.lg([[0, K.s1], [.62, K.s2], [1, K.s3]]));
    if (o.stars !== 0) s += stars(K, { n: o.stars, seed: o.seed, min: o.minStar, ymax: o.ymax });
    if (!o.noBodies) s += sunmoon(K, B);
    var n = o.clouds === undefined ? 3 : o.clouds;
    if (n > 0) s += cloud(0, 54, 1, 'c1', K);
    if (n > 1) s += cloud(0, 28, .75, 'c2', K);
    if (n > 2) s += cloud(0, 92, .9, 'c3', K);
    return s;
  }
  function bird(y, dur, delay, sc, col) {
    sc = sc || 1;
    return '<g transform="scale(' + sc + ')"><g>' + at('translate', f(-40 / sc) + ' ' + f(y / sc) + ';' + f(700 / sc) + ' ' + f((y - 14) / sc), dur, 'begin="-' + delay + 's"') +
      '<path d="M0 0 q5 -6 10 0 q5 -6 10 0" fill="none" stroke="' + (col || '#1a1a3a') + '" stroke-width="2" stroke-linecap="round">' +
      an('d', 'M0 0 q5 -6 10 0 q5 -6 10 0;M0 0 q5 4 10 0 q5 4 10 0;M0 0 q5 -6 10 0 q5 -6 10 0', .9) + '</path></g></g>';
  }
  function smoke(x, y, col, n) {
    var s = '';
    n = n || 4;
    for (var i = 0; i < n; i++) {
      var dly = -(i * 4 / n);
      s += '<circle cx="' + x + '" cy="' + y + '" r="3" fill="' + (col || '#cfd6ee') + '" opacity="0">' +
        an('cy', y + ';' + (y - 46), 4, 'begin="' + f(dly) + 's"') + an('cx', x + ';' + (x + 10), 4, 'begin="' + f(dly) + 's"') + an('r', '3;10', 4, 'begin="' + f(dly) + 's"') + an('opacity', '0;.45;0', 4, 'begin="' + f(dly) + 's"') + '</circle>';
    }
    return s;
  }
  function snow(n, seed, col, ymax) {
    var rd = A.rnd(seed || 41), s = '';
    for (var i = 0; i < n; i++) {
      var x = rd() * 640, d = 5 + rd() * 6, r = .9 + rd() * 1.6, dx = 12 + rd() * 22;
      s += '<circle cx="' + f(x) + '" cy="-6" r="' + f(r) + '" fill="' + (col || '#fff') + '" opacity=".85">' +
        an('cy', '-6;' + (ymax || 262), d, 'begin="-' + f(rd() * d) + 's"') + an('cx', f(x) + ';' + f(x + dx) + ';' + f(x - dx * .4) + ';' + f(x), d, 'begin="-' + f(rd() * d) + 's"') + '</circle>';
    }
    return s;
  }

  /* ------------------------------------------------------------- registro */
  var W = {};
  function svg(id, h) {
    var w = W[id];
    var K = palette(h), B = body(h);
    A.begin('w' + id + '_');
    var inner = w.draw(K, h, B);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 260" width="640" height="260"><defs>' + A.filters() + A.defs() + '</defs><style>' + BASECSS + (w.css || '') + '</style>' + inner + '</svg>';
  }
  function dataURL(id, h) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(id, h)); }

  g.AMB = { W: W, palette: palette, body: body, mix: mix, svg: svg, dataURL: dataURL,
    H: { poly: poly, path: path, rect: rect, circ: circ, ell: ell, line: line, grp: grp, an: an, at: at, circA: circA, ellA: ellA, sky: sky, stars: stars, sunmoon: sunmoon, cloud: cloud, bird: bird, smoke: smoke, snow: snow, mix: mix } };
})(window);
