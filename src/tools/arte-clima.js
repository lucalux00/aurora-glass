/* AURORA GLASS v3 — climatizzatore: una immagine per modalità (spento = PNG, le altre GIF animate) */
(function () {
  var A = AR, ART = A.ART;
  var R = A.R, C = A.C, E = A.E, P = A.P, PA = A.PA, ST = A.ST, Gr = A.Gr, glow = A.glow, lg = A.lg, rg = A.rg, hsl = A.hsl, sn = A.sn, fr = A.fr, f = A.f, roomBase = A.roomBase;

  function flake(x, y, s, a, o) { return '<g transform="translate(' + f(x) + ' ' + f(y) + ') rotate(' + f(a) + ') scale(' + s + ')" opacity="' + f(o) + '"><path d="M0 -6 V6 M-5.2 -3 L5.2 3 M-5.2 3 L5.2 -3" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none"/></g>'; }
  function drop(x, y, s, o, col) { return '<path transform="translate(' + f(x) + ' ' + f(y) + ') scale(' + s + ')" d="M0 -6 C4.4 0 4.4 5.4 0 5.4 C-4.4 5.4 -4.4 0 0 -6Z" fill="' + col + '" opacity="' + f(o) + '"/>'; }

  function make(cfg) {
    return { hue: cfg.hue, dim: false, out: cfg.out, draw: function (on, t) {
      var s = roomBase(cfg.hue, 200);
      // divano sullo sfondo
      var sofa = lg([[0, '#8B6CFF'], [1, '#4B35B0']]);
      s += E(128, 224, 104, 14, 'rgba(0,0,0,.25)') + R(48, 168, 160, 46, sofa, 16) + R(38, 178, 30, 40, sofa, 12) + R(188, 178, 30, 40, sofa, 12) + R(58, 172, 140, 28, 'rgba(255,255,255,.1)', 12);
      if (cfg.rim) s += R(48, 168, 160, 8, cfg.rim, 8, 'opacity="' + f(.35 + .15 * sn(t)) + '"');
      // aria
      if (cfg.flow) {
        for (var k = 0; k < 6; k++) {
          var x = 54 + k * 30, off = -fr(t) * 36;
          s += ST('M' + x + ' 84 q ' + (k % 2 ? 9 : -9) + ' 26 0 52 t 0 52', cfg.flow, 5.5, 'stroke-dasharray="16 20" stroke-dashoffset="' + f(off) + '" opacity="' + f(.55 + .2 * sn(t, 1, k * .13)) + '"');
        }
        s += E(128, 120, 96, 60, rg([[0, cfg.flow, .18], [1, cfg.flow, 0]]));
      }
      // particelle
      var rd = A.rnd(cfg.seed || 4), n = cfg.n || 9;
      for (var i = 0; i < n; i++) {
        var px = 46 + rd() * 164, ph = rd(), q = fr(t + ph), y = 96 + q * 112, o = Math.sin(Math.PI * q) * .9, xx = px + 8 * sn(t, 1, ph);
        if (cfg.part === 'snow') s += flake(xx, y, .8 + rd() * .7, 360 * q * (ph > .5 ? 1 : -1), o);
        else if (cfg.part === 'drop') s += drop(xx, y, .9 + rd() * .6, o, cfg.flow);
        else if (cfg.part === 'ember') s += C(xx, 200 - q * 100, 2.4 + rd() * 2.4, cfg.flow, 'opacity="' + f(o) + '"') + glow(xx, 200 - q * 100, 9, cfg.flow, o * .6);
        else if (cfg.part === 'wind') s += R(xx - 10, y, 20, 2.6, '#fff', 2, 'opacity="' + f(o * .8) + '"');
        else if (cfg.part === 'mix') { if (i % 2) s += flake(xx, y, .8 + rd() * .5, 360 * q, o); else s += C(xx, 200 - q * 100, 2.6, '#FFB36B', 'opacity="' + f(o) + '"'); }
      }
      // unità interna
      s += R(20, 30, 216, 66, 'rgba(0,0,0,.28)', 22) + R(20, 24, 216, 66, lg([[0, '#FFFFFF'], [1, '#D3D9E8']]), 22) + R(20, 24, 216, 8, 'rgba(255,255,255,.9)', 4);
      s += R(40, 40, 176, 2.4, 'rgba(0,0,0,.07)', 1) + R(40, 47, 176, 2.4, 'rgba(0,0,0,.07)', 1) + R(40, 54, 176, 2.4, 'rgba(0,0,0,.07)', 1);
      s += R(34, 68, 188, 14, '#1b2236', 7);
      var flap = cfg.on ? 16 : 3;
      s += P('36,72 220,72 ' + (220 - 6) + ',' + (72 + flap) + ' ' + (36 + 6) + ',' + (72 + flap), cfg.on ? '#EDF1FA' : '#C3C9D8');
      // display
      s += R(184, 36, 36, 14, '#0e1426', 5) + C(193, 43, 3, cfg.led, '') + (cfg.on ? C(193, 43, 8, rg([[0, cfg.led, .8 * (.7 + .3 * sn(t, 2))], [1, cfg.led, 0]])) : '');
      s += '<text x="201" y="47" font-family="Arial" font-weight="800" font-size="9" fill="' + cfg.led + '">' + cfg.txt + '</text>';
      if (cfg.glowCol) s += glow(128, 30, 120, cfg.glowCol, .18);
      return s;
    } };
  }

  ART.clima_off  = make({ hue: 222, out: 'png', on: false, led: '#FBBF24', txt: 'OFF', part: '', flow: null });
  ART.clima_cool = make({ hue: 200, out: 'gif', on: true, led: '#7CE0FF', txt: '22°', flow: '#9BE3FF', part: 'snow', n: 9, rim: '#7CE0FF', glowCol: '#38BDF8', seed: 3 });
  ART.clima_heat = make({ hue: 18,  out: 'gif', on: true, led: '#FFB36B', txt: '26°', flow: '#FF9A62', part: 'ember', n: 9, rim: '#FF9A62', glowCol: '#FB923C', seed: 6 });
  ART.clima_dry  = make({ hue: 172, out: 'gif', on: true, led: '#5EEAD4', txt: 'DRY', flow: '#5EEAD4', part: 'drop', n: 10, rim: '#2DD4BF', glowCol: '#14B8A6', seed: 8 });
  ART.clima_fan  = make({ hue: 238, out: 'gif', on: true, led: '#A5B4FC', txt: 'FAN', flow: '#D6DCFF', part: 'wind', n: 10, rim: '#A5B4FC', glowCol: '#818CF8', seed: 9 });
  ART.clima_auto = make({ hue: 275, out: 'gif', on: true, led: '#D8B4FE', txt: 'AUTO', flow: '#E9D5FF', part: 'mix', n: 10, rim: '#C084FC', glowCol: '#A855F7', seed: 11 });
  ['clima_off', 'clima_cool', 'clima_heat', 'clima_dry', 'clima_fan', 'clima_auto'].forEach(function (k) { if (ART[k].out === 'png') ART[k].dim = false; });
})();
