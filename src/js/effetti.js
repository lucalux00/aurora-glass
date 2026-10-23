/* ============================================================================
   AURORA GLASS v3 — EFFETTI (meteo e atmosfera) disegnati su canvas.
   Si possono sovrapporre a qualsiasi mondo: pioggia, temporale, neve, nebbia,
   foglie, petali, lucciole, stelle cadenti, fuochi d'artificio, bolle, coriandoli.
   ========================================================================== */
(function (g) {
  var TAU = Math.PI * 2, rnd = Math.random;
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }

  function Fx(canvas, o) {
    o = o || {};
    this.c = canvas; this.x = canvas.getContext('2d');
    this.kind = 'none'; this.P = []; this.w = 1; this.h = 1; this.dpr = 1; this.t = 0; this.last = 0;
    this.k = o.k || 1;                 // moltiplicatore densità
    this.alpha = o.alpha === undefined ? 1 : o.alpha;
    this.running = false; this.onFlash = o.onFlash || null;
    this.reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.S = {};                       // stato per effetto (timer, fulmini…)
    var self = this;
    this._loop = function (ts) { self.loop(ts); };
  }
  Fx.prototype.resize = function () {
    var r = this.c.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.c.width = Math.round(this.w * this.dpr); this.c.height = Math.round(this.h * this.dpr);
    this.x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.init();
  };
  Fx.prototype.set = function (kind) {
    this.kind = kind || 'none';
    this.S = {};
    this.resize();
    if (this.kind === 'none') { this.stop(); this.x.clearRect(0, 0, this.w, this.h); }
    else this.start();
  };
  Fx.prototype.start = function () { if (!this.running) { this.running = true; this.last = 0; requestAnimationFrame(this._loop); } };
  Fx.prototype.stop = function () { this.running = false; };
  Fx.prototype.init = function () { var e = E[this.kind]; this.P = []; if (e && e.init) e.init(this); };
  Fx.prototype.loop = function (ts) {
    if (!this.running) return;
    var dt = this.last ? Math.min(.05, (ts - this.last) / 1000) : .016;
    this.last = ts; this.t += dt;
    var e = E[this.kind];
    if (!e || document.hidden) { requestAnimationFrame(this._loop); return; }
    var x = this.x;
    x.clearRect(0, 0, this.w, this.h);
    x.globalAlpha = this.alpha;
    if (this.reduced) { dt = 0; }
    e.draw(this, dt);
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    requestAnimationFrame(this._loop);
  };
  function area(fx, per) { return Math.max(8, Math.round(fx.w * fx.h / per * fx.k)); }

  /* ---------------------------------------------------------------- pioggia / temporale */
  function rainInit(heavy) {
    return function (fx) {
      var n = area(fx, heavy ? 3200 : 5200);
      for (var i = 0; i < n; i++) fx.P.push({ x: rnd() * (fx.w + 120) - 40, y: rnd() * fx.h, v: 650 + rnd() * 520, l: 10 + rnd() * 14, a: .22 + rnd() * .38 });
      fx.S.sp = []; fx.S.next = 2 + rnd() * 4; fx.S.flash = 0; fx.S.bolt = null; fx.S.boltT = 0;
    };
  }
  function bolt(fx) {
    var pts = [], x = fx.w * (.2 + rnd() * .6), y = 0, ty = fx.h * (.55 + rnd() * .3);
    pts.push([x, y]);
    while (y < ty) { y += 10 + rnd() * 16; x += (rnd() - .5) * 34; pts.push([x, y]); }
    var br = [], k = 1 + Math.floor(rnd() * 2);
    for (var i = 0; i < k; i++) { var s = pts[2 + Math.floor(rnd() * (pts.length - 4))], bx = s[0], by = s[1], seg = [[bx, by]]; for (var j = 0; j < 4; j++) { bx += (rnd() - .3) * 28; by += 8 + rnd() * 12; seg.push([bx, by]); } br.push(seg); }
    return { main: pts, br: br };
  }
  function rainDraw(heavy) {
    return function (fx, dt) {
      var x = fx.x, S = fx.S, wind = -.22;
      if (heavy) { x.fillStyle = 'rgba(8,10,34,.16)'; x.fillRect(0, 0, fx.w, fx.h); }
      x.lineWidth = 1.1; x.lineCap = 'round';
      for (var i = 0; i < fx.P.length; i++) {
        var d = fx.P[i], dy = d.v * dt;
        d.y += dy; d.x += dy * wind;
        if (d.y > fx.h) { if (S.sp.length < 36 && rnd() < .5) S.sp.push({ x: d.x, y: fx.h - 2, t: 0 }); d.y = -d.l; d.x = rnd() * (fx.w + 120) - 20; }
        x.strokeStyle = 'rgba(190,222,255,' + d.a + ')';
        x.beginPath(); x.moveTo(d.x, d.y); x.lineTo(d.x + d.l * wind, d.y + d.l); x.stroke();
      }
      for (var s = S.sp.length - 1; s >= 0; s--) {
        var p = S.sp[s]; p.t += dt * 3.2;
        if (p.t >= 1) { S.sp.splice(s, 1); continue; }
        x.strokeStyle = 'rgba(210,235,255,' + (.5 * (1 - p.t)) + ')';
        x.beginPath(); x.ellipse(p.x, p.y, 2 + p.t * 9, 1 + p.t * 2.4, 0, 0, TAU); x.stroke();
      }
      if (heavy) {
        S.next -= dt;
        if (S.next <= 0) { S.next = 3 + rnd() * 6; S.flash = 1; S.bolt = bolt(fx); S.boltT = .22; }
        if (S.flash > .01) {
          x.fillStyle = 'rgba(214,228,255,' + (S.flash * .42) + ')'; x.fillRect(0, 0, fx.w, fx.h);
          S.flash *= Math.pow(.02, dt * 2.2);
          if (fx.onFlash) fx.onFlash(S.flash);
        } else if (S.flash !== 0) { S.flash = 0; if (fx.onFlash) fx.onFlash(0); }
        if (S.bolt && S.boltT > 0) {
          S.boltT -= dt;
          x.save(); x.shadowColor = '#bcd4ff'; x.shadowBlur = 18; x.strokeStyle = 'rgba(255,255,255,' + Math.min(1, S.boltT * 7) + ')'; x.lineWidth = 2.4; x.lineJoin = 'round';
          function poly(pp) { x.beginPath(); pp.forEach(function (q, i) { i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]); }); x.stroke(); }
          poly(S.bolt.main); x.lineWidth = 1.3; S.bolt.br.forEach(poly); x.restore();
        }
      }
    };
  }

  /* ---------------------------------------------------------------- neve */
  function snowInit(fx) { var n = area(fx, 4800); for (var i = 0; i < n; i++) fx.P.push({ x: rnd() * fx.w, y: rnd() * fx.h, r: 1 + rnd() * 2.6, v: 24 + rnd() * 56, ph: rnd() * TAU, sw: 8 + rnd() * 22 }); }
  function snowDraw(fx, dt) {
    var x = fx.x; x.fillStyle = '#fff';
    fx.P.forEach(function (p) {
      p.y += p.v * dt; p.x += Math.sin(fx.t * .9 + p.ph) * p.sw * dt;
      if (p.y > fx.h + 4) { p.y = -4; p.x = rnd() * fx.w; }
      x.globalAlpha = fx.alpha * (.45 + p.r / 5.2); x.beginPath(); x.arc(p.x, p.y, p.r, 0, TAU); x.fill();
    });
  }

  /* ---------------------------------------------------------------- nebbia */
  function fogInit(fx) { var n = Math.max(5, Math.round(fx.w / 150 * fx.k)); for (var i = 0; i < n; i++) fx.P.push({ x: rnd() * fx.w, y: fx.h * (.2 + rnd() * .8), r: 90 + rnd() * 170, v: (5 + rnd() * 14) * (rnd() > .5 ? 1 : -1), a: .10 + rnd() * .12 }); }
  function fogDraw(fx, dt) {
    var x = fx.x;
    fx.P.forEach(function (p) {
      p.x += p.v * dt; if (p.x > fx.w + p.r) p.x = -p.r; if (p.x < -p.r) p.x = fx.w + p.r;
      var gr = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); gr.addColorStop(0, 'rgba(236,242,255,' + p.a + ')'); gr.addColorStop(1, 'rgba(236,242,255,0)');
      x.fillStyle = gr; x.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    });
  }

  /* ---------------------------------------------------------------- foglie / petali */
  var LEAF = ['#E8742B', '#C8402A', '#F2B544', '#A8461F', '#D9A21B'];
  var PET = ['#FFC1D8', '#F9A8C9', '#FFD6E6', '#F48FB1'];
  function leafInit(petal) {
    return function (fx) {
      var n = area(fx, petal ? 6500 : 8500);
      for (var i = 0; i < n; i++) fx.P.push({ x: rnd() * fx.w, y: rnd() * fx.h, s: petal ? 3 + rnd() * 3 : 5 + rnd() * 5, v: 28 + rnd() * 48, ph: rnd() * TAU, rot: rnd() * TAU, rv: (rnd() - .5) * 4, sw: 20 + rnd() * 34, c: petal ? pick(PET) : pick(LEAF) });
    };
  }
  function leafDraw(petal) {
    return function (fx, dt) {
      var x = fx.x;
      fx.P.forEach(function (p) {
        p.y += p.v * dt; p.x += (Math.sin(fx.t * 1.2 + p.ph) * p.sw + (petal ? 26 : 8)) * dt; p.rot += p.rv * dt;
        if (p.y > fx.h + 12) { p.y = -12; p.x = rnd() * fx.w; }
        if (p.x > fx.w + 12) p.x = -12;
        x.save(); x.translate(p.x, p.y); x.rotate(p.rot); x.fillStyle = p.c; x.beginPath();
        if (petal) { x.ellipse(0, 0, p.s, p.s * .55, 0, 0, TAU); }
        else { x.moveTo(0, -p.s); x.quadraticCurveTo(p.s * .95, -p.s * .2, 0, p.s); x.quadraticCurveTo(-p.s * .95, -p.s * .2, 0, -p.s); }
        x.fill();
        if (!petal) { x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = .8; x.beginPath(); x.moveTo(0, -p.s); x.lineTo(0, p.s); x.stroke(); }
        x.restore();
      });
    };
  }

  /* ---------------------------------------------------------------- lucciole */
  function flyInit(fx) { var n = area(fx, 9000); for (var i = 0; i < n; i++) fx.P.push({ x: rnd() * fx.w, y: rnd() * fx.h, vx: (rnd() - .5) * 30, vy: (rnd() - .5) * 30, ph: rnd() * TAU, r: 4 + rnd() * 7 }); }
  function flyDraw(fx, dt) {
    var x = fx.x; x.globalCompositeOperation = 'lighter';
    fx.P.forEach(function (p) {
      p.vx += (rnd() - .5) * 90 * dt; p.vy += (rnd() - .5) * 90 * dt; p.vx *= .985; p.vy *= .985;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < -10) p.x = fx.w + 10; if (p.x > fx.w + 10) p.x = -10; if (p.y < -10) p.y = fx.h + 10; if (p.y > fx.h + 10) p.y = -10;
      var a = .2 + .8 * (.5 + .5 * Math.sin(fx.t * 1.8 + p.ph)), gr = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.6);
      gr.addColorStop(0, 'rgba(255,248,160,' + a + ')'); gr.addColorStop(.3, 'rgba(255,240,120,' + a * .45 + ')'); gr.addColorStop(1, 'rgba(255,240,120,0)');
      x.fillStyle = gr; x.beginPath(); x.arc(p.x, p.y, p.r * 2.6, 0, TAU); x.fill();
      x.fillStyle = 'rgba(255,255,230,' + a + ')'; x.beginPath(); x.arc(p.x, p.y, 1.4, 0, TAU); x.fill();
    });
  }

  /* ---------------------------------------------------------------- stelle cadenti */
  function metInit(fx) { fx.S.next = .4; fx.S.m = []; var n = area(fx, 7000); for (var i = 0; i < n; i++) fx.P.push({ x: rnd() * fx.w, y: rnd() * fx.h * .75, ph: rnd() * TAU, r: .5 + rnd() * 1.2 }); }
  function metDraw(fx, dt) {
    var x = fx.x, S = fx.S;
    fx.P.forEach(function (p) { x.globalAlpha = fx.alpha * (.25 + .6 * Math.abs(Math.sin(fx.t * 1.3 + p.ph))); x.fillStyle = '#fff'; x.beginPath(); x.arc(p.x, p.y, p.r, 0, TAU); x.fill(); });
    x.globalAlpha = fx.alpha;
    S.next -= dt;
    if (S.next <= 0) { S.next = .9 + rnd() * 2.2; S.m.push({ x: fx.w * (.35 + rnd() * .75), y: -10 + rnd() * fx.h * .3, vx: -(520 + rnd() * 320), vy: 280 + rnd() * 200, len: 90 + rnd() * 80, life: 0 }); }
    for (var i = S.m.length - 1; i >= 0; i--) {
      var m = S.m[i]; m.x += m.vx * dt; m.y += m.vy * dt; m.life += dt;
      if (m.life > 1.3 || m.y > fx.h + 20 || m.x < -120) { S.m.splice(i, 1); continue; }
      var sp = Math.hypot(m.vx, m.vy), tx = m.x - m.vx / sp * m.len, ty = m.y - m.vy / sp * m.len, a = Math.min(1, (1.3 - m.life) * 2);
      var gr = x.createLinearGradient(m.x, m.y, tx, ty); gr.addColorStop(0, 'rgba(255,255,255,' + a + ')'); gr.addColorStop(1, 'rgba(160,190,255,0)');
      x.strokeStyle = gr; x.lineWidth = 2.2; x.lineCap = 'round'; x.beginPath(); x.moveTo(m.x, m.y); x.lineTo(tx, ty); x.stroke();
      x.fillStyle = 'rgba(255,255,255,' + a + ')'; x.beginPath(); x.arc(m.x, m.y, 2, 0, TAU); x.fill();
    }
  }

  /* ---------------------------------------------------------------- fuochi d'artificio */
  function fwInit(fx) { fx.S.next = .3; fx.S.r = []; fx.S.s = []; }
  function fwDraw(fx, dt) {
    var x = fx.x, S = fx.S; x.globalCompositeOperation = 'lighter'; x.lineCap = 'round';
    S.next -= dt;
    if (S.next <= 0) { S.next = .7 + rnd() * 1.3; S.r.push({ x: fx.w * (.12 + rnd() * .76), y: fx.h + 4, ty: fx.h * (.14 + rnd() * .36), v: fx.h * (.9 + rnd() * .5), h: Math.floor(rnd() * 360) }); }
    for (var i = S.r.length - 1; i >= 0; i--) {
      var r = S.r[i]; r.y -= r.v * dt; r.v *= (1 - .6 * dt);
      x.strokeStyle = 'hsla(' + r.h + ',100%,80%,.9)'; x.lineWidth = 2; x.beginPath(); x.moveTo(r.x, r.y); x.lineTo(r.x, r.y + 12); x.stroke();
      if (r.y <= r.ty || r.v < 24) {
        var n = 46 + Math.floor(rnd() * 30), two = rnd() > .5;
        for (var k = 0; k < n; k++) { var a = TAU * k / n + rnd() * .1, sp = 50 + rnd() * 140 * (two && k % 2 ? .55 : 1); S.s.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, h: two && k % 2 ? (r.h + 160) % 360 : r.h + rnd() * 24 }); }
        S.r.splice(i, 1);
      }
    }
    for (var s = S.s.length - 1; s >= 0; s--) {
      var p = S.s[s], px = p.x, py = p.y; p.vy += 110 * dt; p.vx *= (1 - .9 * dt); p.vy *= (1 - .5 * dt); p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * .75;
      if (p.life <= 0) { S.s.splice(s, 1); continue; }
      x.strokeStyle = 'hsla(' + p.h + ',100%,' + (62 + 20 * p.life) + '%,' + p.life + ')'; x.lineWidth = 1.8 * p.life + .4; x.beginPath(); x.moveTo(px, py); x.lineTo(p.x, p.y); x.stroke();
    }
  }

  /* ---------------------------------------------------------------- bolle */
  function bubInit(fx) { var n = area(fx, 9500); for (var i = 0; i < n; i++) fx.P.push({ x: rnd() * fx.w, y: rnd() * fx.h, r: 3 + rnd() * 9, v: 20 + rnd() * 44, ph: rnd() * TAU, sw: 6 + rnd() * 14 }); }
  function bubDraw(fx, dt) {
    var x = fx.x;
    fx.P.forEach(function (p) {
      p.y -= p.v * dt; p.x += Math.sin(fx.t * 1.4 + p.ph) * p.sw * dt;
      if (p.y < -p.r * 2) { p.y = fx.h + p.r * 2; p.x = rnd() * fx.w; }
      x.fillStyle = 'rgba(255,255,255,.08)'; x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 1.2;
      x.beginPath(); x.arc(p.x, p.y, p.r, 0, TAU); x.fill(); x.stroke();
      x.strokeStyle = 'rgba(255,255,255,.8)'; x.beginPath(); x.arc(p.x, p.y, p.r * .62, Math.PI * 1.15, Math.PI * 1.5); x.stroke();
    });
  }

  /* ---------------------------------------------------------------- coriandoli */
  var CONF = ['#FF4D6D', '#FFD93D', '#4DD2FF', '#7CFF6B', '#B07CFF', '#FF9A3D'];
  function confInit(fx) { var n = area(fx, 5200); for (var i = 0; i < n; i++) fx.P.push({ x: rnd() * fx.w, y: rnd() * fx.h, w: 5 + rnd() * 6, h: 3 + rnd() * 4, v: 50 + rnd() * 90, rot: rnd() * TAU, rv: (rnd() - .5) * 6, ph: rnd() * TAU, sw: 14 + rnd() * 26, c: pick(CONF) }); }
  function confDraw(fx, dt) {
    var x = fx.x;
    fx.P.forEach(function (p) {
      p.y += p.v * dt; p.x += Math.sin(fx.t * 1.6 + p.ph) * p.sw * dt; p.rot += p.rv * dt;
      if (p.y > fx.h + 10) { p.y = -10; p.x = rnd() * fx.w; }
      x.save(); x.translate(p.x, p.y); x.rotate(p.rot); x.scale(1, Math.abs(Math.cos(fx.t * 3 + p.ph)) * .9 + .1); x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); x.restore();
    });
  }

  var E = {
    pioggia:    { name: 'Pioggia',          icon: 'mdi-weather-pouring',         init: rainInit(false), draw: rainDraw(false) },
    temporale:  { name: 'Temporale',        icon: 'mdi-weather-lightning-rainy', init: rainInit(true),  draw: rainDraw(true) },
    neve:       { name: 'Neve',             icon: 'mdi-weather-snowy',           init: snowInit,        draw: snowDraw },
    nebbia:     { name: 'Nebbia',           icon: 'mdi-weather-fog',             init: fogInit,         draw: fogDraw },
    foglie:     { name: 'Foglie d\'autunno', icon: 'mdi-leaf-maple',              init: leafInit(false), draw: leafDraw(false) },
    petali:     { name: 'Petali',           icon: 'mdi-flower-tulip',            init: leafInit(true),  draw: leafDraw(true) },
    lucciole:   { name: 'Lucciole',         icon: 'mdi-shimmer',                 init: flyInit,         draw: flyDraw },
    stelle:     { name: 'Stelle cadenti',   icon: 'mdi-star-shooting',           init: metInit,         draw: metDraw },
    fuochi:     { name: 'Fuochi d\'artificio', icon: 'mdi-firework',             init: fwInit,          draw: fwDraw },
    bolle:      { name: 'Bolle',            icon: 'mdi-chart-bubble',          init: bubInit,         draw: bubDraw },
    coriandoli: { name: 'Coriandoli',       icon: 'mdi-party-popper',            init: confInit,        draw: confDraw }
  };
  g.FX = { Fx: Fx, E: E };
})(window);
