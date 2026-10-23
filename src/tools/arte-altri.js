/* AURORA GLASS v3 — scene, sensori, allarme.
   ART[k].out: 'pair' = k_off.png + k_on.gif · 'png' = k.png · 'gif' = k.gif */
(function () {
  var A = AR, ART = A.ART;
  var R = A.R, C = A.C, E = A.E, P = A.P, PA = A.PA, ST = A.ST, Gr = A.Gr, glow = A.glow, cone = A.cone, motes = A.motes,
      lg = A.lg, rg = A.rg, hsl = A.hsl, sn = A.sn, cs = A.cs, fr = A.fr, f = A.f, stars = A.stars, TAU = A.TAU;
  var SH = 'M128 36 L198 62 L198 118 C198 162 168 196 128 214 C88 196 58 162 58 118 L58 62 Z';

  /* ============================================================ SCENE */
  ART.scena_buongiorno = { hue: 22, dim: false, out: 'pair', draw: function (on, t) {
    var s = R(0, 0, 256, 256, lg([[0, '#FF7A6B'], [.55, '#FFB86B'], [1, '#FFE29A']]));
    var cx = 128, cy = 150, rays = '';
    for (var i = 0; i < 12; i++) { var a = (i / 12) * 360 + (30 * fr(t)); rays += '<polygon points="128,150 ' + f(128 - 7) + ',-60 ' + f(128 + 7) + ',-60" fill="rgba(255,246,200,' + (i % 2 ? .22 : .32) + ')" transform="rotate(' + f(a) + ' 128 150)"/>'; }
    s += rays + glow(cx, cy, 150, '#FFF3C0', .9) + C(cx, cy - 6 * sn(t), 40, lg([[0, '#FFFBE0'], [1, '#FFD36B']])) + glow(cx, cy, 70, '#FFFFFF', .5);
    // nuvole
    s += E(40 + 14 * sn(t), 60, 28, 8, 'rgba(255,255,255,.55)') + E(56 + 14 * sn(t), 52, 20, 9, 'rgba(255,255,255,.55)') + E(206 - 12 * sn(t), 84, 26, 7, 'rgba(255,255,255,.45)');
    // colline
    s += PA('M0 190 Q60 150 130 176 T256 168 V256 H0Z', '#8A4F7A') + PA('M0 214 Q80 186 150 206 T256 198 V256 H0Z', '#5B3768');
    // uccelli
    [[70, 98, 0], [96, 84, .3]].forEach(function (b) { var w = 5 * sn(t, 1, b[2]); s += ST('M' + (b[0] - 9) + ' ' + f(b[1] - w) + ' Q' + b[0] + ' ' + f(b[1] + 3) + ' ' + b[0] + ' ' + b[1] + ' Q' + b[0] + ' ' + f(b[1] + 3) + ' ' + (b[0] + 9) + ' ' + f(b[1] - w), '#4a2b55', 2.4); });
    // tazza
    s += R(172, 178, 40, 38, '#FFF6E6', 8) + E(192, 178, 20, 5, '#7A4A2B') + PA('M212 188 q16 2 14 14 q-2 10 -14 8', 'none', 'stroke="#FFF6E6" stroke-width="6" stroke-linecap="round"') + E(192, 218, 30, 5, 'rgba(0,0,0,.2)');
    for (var k = 0; k < 2; k++) { var q = fr(t + k / 2); s += ST('M' + f(186 + k * 12 + 3 * sn(t, 1, k * .3)) + ' ' + f(172 - q * 36) + ' q5 -7 0 -14', 'rgba(255,255,255,' + f(Math.sin(Math.PI * q) * .8) + ')', 3.2); }
    return s;
  } };

  ART.scena_cinema = { hue: 285, dim: false, out: 'pair', draw: function (on, t) {
    var h = 285 + 38 * sn(t), s = R(0, 0, 256, 256, lg([[0, '#1c0f3a'], [1, '#0b0620']]));
    s += cone(214, 0, 8, 128, 138, 150, 'rgba(255,230,255,1)', .18 + .06 * sn(t, 2));
    s += R(30, 40, 196, 100, '#0a0618', 6) + R(36, 46, 184, 88, lg([[0, hsl(h, 80, 60)], [1, hsl(h + 50, 85, 42)]]), 4);
    s += C(110 + 30 * sn(t), 82, 18, 'rgba(255,255,255,.88)') + PA('M36 134 L90 96 L130 120 L170 90 L220 130 L220 134Z', 'rgba(20,8,50,.55)');
    s += glow(128, 90, 120, hsl(h, 90, 62), .35 + .1 * sn(t, 2));
    // schienali + teste
    s += PA('M0 256 V196 Q0 176 22 176 H86 Q108 176 108 196 V256Z', '#2b1750') + PA('M148 256 V196 Q148 176 170 176 H234 Q256 176 256 196 V256Z', '#2b1750');
    s += C(60, 160, 18, '#120a28') + R(42, 170, 36, 18, '#120a28', 6) + C(190, 164, 16, '#120a28') + R(174, 174, 32, 16, '#120a28', 6);
    s += E(60, 160, 18, 18, hsl(h, 80, 55, .16)) + E(190, 164, 16, 16, hsl(h, 80, 55, .14));
    // popcorn
    s += P('212,206 244,206 240,248 216,248', '#E5484D') + R(218, 206, 4, 42, '#fff', 0, 'opacity=".85"') + R(228, 206, 4, 42, '#fff', 0, 'opacity=".85"');
    [[216, 200], [226, 196], [236, 200], [222, 192], [232, 192]].forEach(function (p, i) { s += C(p[0], p[1] + 1.5 * sn(t, 1, i * .2), 6, '#FFF3C4') + C(p[0] - 1, p[1] - 1, 3, '#fff', 'opacity=".5"'); });
    return s;
  } };

  ART.scena_cena = { hue: 24, dim: false, out: 'pair', draw: function (on, t) {
    var s = R(0, 0, 256, 256, lg([[0, '#2a1208'], [1, '#12060a']]));
    var rd = A.rnd(9);
    for (var i = 0; i < 14; i++) { var x = rd() * 256, y = rd() * 130, r = 8 + rd() * 14; s += C(x, y, r, '#FFC878', 'opacity="' + f((.1 + .12 * Math.abs(sn(t, 1, rd()))) ) + '"'); }
    s += R(0, 176, 256, 80, lg([[0, '#8E2F3A'], [1, '#4A1420']])) + P('0,176 256,176 256,186 0,186', 'rgba(255,255,255,.06)');
    // piatto
    s += E(128, 204, 74, 18, 'rgba(0,0,0,.35)') + E(128, 196, 70, 17, '#F7F2EA') + E(128, 195, 52, 12, '#FFFFFF') + E(128, 194, 36, 8, '#E8A24A');
    for (var p = 0; p < 4; p++) s += ST('M' + (104 + p * 2) + ' ' + (192 - p) + ' q24 ' + (-8 + p * 3) + ' 48 0', '#C9702A', 2.4);
    s += C(112, 189, 4, '#6BBF59') + C(142, 190, 4, '#E5484D');
    // posate
    s += R(36, 150, 5, 50, '#C9CEDB', 2) + R(32, 150, 13, 18, '#C9CEDB', 4) + R(206, 150, 5, 50, '#C9CEDB', 2) + R(204, 150, 9, 20, '#C9CEDB', 3);
    // calice
    s += PA('M168 120 Q164 156 178 160 Q192 156 188 120Z', 'rgba(255,255,255,.2)', 'stroke="rgba(255,255,255,.55)" stroke-width="2"') + PA('M169 136 Q168 156 178 158 Q188 156 187 136Z', '#B3243A') + R(177, 160, 3, 28, 'rgba(255,255,255,.6)') + E(178, 190, 14, 3, 'rgba(255,255,255,.5)');
    // candele
    [[58, 70], [198, 80]].forEach(function (c, i) {
      var fl = 1 + .12 * sn(t, 2, i * .3), sk = 3 * sn(t, 1, i * .4);
      s += glow(c[0], c[1] - 8, 56, '#FFB45C', .55 * fl) + R(c[0] - 6, c[1], 12, 52, '#F6EAD3', 3) + PA('M' + c[0] + ' ' + (c[1] - 26 * fl) + ' q' + (10 + sk) + ' 12 0 24 q' + (-10 + sk) + ' -12 0 -24Z', '#FFB02E') + PA('M' + c[0] + ' ' + (c[1] - 14) + ' q5 6 0 12 q-5 -6 0 -12Z', '#FFF3B0');
    });
    for (var k = 0; k < 3; k++) { var q = fr(t + k / 3); s += ST('M' + f(118 + k * 12 + 3 * sn(t, 1, k * .3)) + ' ' + f(180 - q * 44) + ' q5 -7 0 -14', 'rgba(255,255,255,' + f(Math.sin(Math.PI * q) * .45) + ')', 3); }
    return s;
  } };

  ART.scena_notte = { hue: 238, dim: false, out: 'pair', draw: function (on, t) {
    var s = R(0, 0, 256, 256, lg([[0, '#0b1040'], [.6, '#242a7a'], [1, '#3e3a9a']])) + stars(26, 0, 0, 256, 190, t, 7);
    s += glow(150, 100, 120, '#9DB7FF', .35) + PA('M150 48 A52 52 0 1 0 202 100 A44 44 0 1 1 150 48Z', lg([[0, '#FFFBE8'], [1, '#E9E2B8']], { x1: 0, y1: 0, x2: 1, y2: 1 }));
    var cx = -90 + 380 * fr(t);
    s += E(cx, 176, 44, 12, 'rgba(210,220,255,.28)') + E(cx + 26, 166, 30, 12, 'rgba(210,220,255,.28)') + E(cx - 24, 170, 26, 9, 'rgba(210,220,255,.28)');
    s += PA('M0 232 Q70 206 128 226 T256 218 V256 H0Z', '#171c5c');
    ['z', 'Z', 'Z'].forEach(function (z, i) { var q = fr(t + i / 3); s += '<text x="' + f(184 + q * 30) + '" y="' + f(208 - q * 70) + '" font-family="Arial" font-weight="800" font-size="' + (14 + i * 4) + '" fill="rgba(220,228,255,' + f(Math.sin(Math.PI * q) * .85) + ')">' + z + '</text>'; });
    return s;
  } };

  ART.scena_esco = { hue: 160, dim: false, out: 'pair', draw: function (on, t) {
    var s = R(0, 0, 256, 256, lg([[0, '#0d3b3a'], [1, '#07201f']]));
    s += R(0, 196, 256, 60, lg([[0, '#0f4a45'], [1, '#08302d']]));
    // porta aperta
    s += R(30, 36, 110, 164, '#2b1a10', 4) + R(36, 42, 98, 158, lg([[0, '#FFF3C4'], [1, '#9BFFD6']], { x1: 0, y1: 0, x2: 1, y2: 1 }), 2);
    s += glow(88, 120, 100, '#C9FFE8', .55 + .12 * sn(t)) + PA('M36 42 L86 56 L86 190 L36 200Z', lg([[0, '#C98A55'], [1, '#8E5A33']], { x1: 0, y1: 0, x2: 1, y2: 0 })) + C(78, 124, 3.4, '#FFE9A0');
    s += P('36,200 136,200 188,256 0,256', 'rgba(155,255,214,.18)');
    // omino che esce
    s += C(110, 120, 9, '#0a2a28') + R(103, 130, 14, 34, '#0a2a28', 6) + R(99, 132, 6, 26, '#0a2a28', 3) + Gr(R(104, 160, 6, 28, '#0a2a28', 3), 'rotate(' + f(14 * sn(t)) + ' 107 160)') + Gr(R(110, 160, 6, 28, '#0a2a28', 3), 'rotate(' + f(-14 * sn(t)) + ' 113 160)');
    // chiave
    var ang = 12 * sn(t);
    var key = R(-1, 0, 2, 40, '#cfd6e6') + '<circle cx="0" cy="46" r="9" fill="none" stroke="#E9C46A" stroke-width="4"/>' + R(-3, 55, 6, 36, '#E9C46A', 2) + R(3, 76, 10, 5, '#E9C46A', 1.5) + R(3, 66, 8, 5, '#E9C46A', 1.5) + R(-12, 96, 24, 32, '#34D399', 6) + C(0, 106, 3, '#073b2c') + R(-7, 114, 14, 3, '#073b2c', 1.5);
    s += '<g transform="translate(206 0) rotate(' + f(ang) + ' 0 0)">' + key + '</g>';
    return s;
  } };

  /* ============================================================ SENSORI */
  ART.sensore_movimento = { hue: 150, out: 'pair', draw: function (on, t) {
    var s = R(0, 190, 256, 66, lg([[0, hsl(150, 28, 16)], [1, hsl(150, 34, 8)]])) + R(0, 186, 256, 6, hsl(150, 22, 36));
    if (on) {
      for (var k = 0; k < 3; k++) { var q = fr(t + k / 3); s += '<circle cx="128" cy="110" r="' + f(30 + q * 118) + '" fill="none" stroke="#34D399" stroke-width="' + f(5 - q * 3) + '" opacity="' + f(.8 * (1 - q)) + '"/>'; }
      s += glow(128, 110, 120, '#34D399', .35 + .1 * sn(t));
      // persona
      var sw = 16 * sn(t);
      s += C(204, 128, 10, '#06251a') + R(196, 140, 16, 38, '#06251a', 7) + Gr(R(198, 172, 7, 34, '#06251a', 3), 'rotate(' + f(sw) + ' 201 172)') + Gr(R(205, 172, 7, 34, '#06251a', 3), 'rotate(' + f(-sw) + ' 208 172)') + Gr(R(192, 142, 6, 28, '#06251a', 3), 'rotate(' + f(-sw) + ' 195 142)') + Gr(R(212, 142, 6, 28, '#06251a', 3), 'rotate(' + f(sw) + ' 215 142)');
      s += E(204, 208, 22, 4, 'rgba(52,211,153,.35)');
    }
    s += R(86, 68, 84, 84, lg([[0, '#F4F7FA'], [1, '#B9C2D0']]), 22) + C(128, 110, 32, '#1d2a36') + C(128, 110, 28, lg([[0, on ? '#9BFFD6' : '#3b5a66'], [1, on ? '#18B07A' : '#1f333b']]));
    for (var r = 1; r <= 3; r++) s += '<circle cx="128" cy="110" r="' + (r * 8) + '" fill="none" stroke="rgba(255,255,255,' + (on ? .45 : .2) + ')" stroke-width="1.6"/>';
    s += C(120, 100, 5, 'rgba(255,255,255,.55)') + C(128, 142, 3, on ? '#34D399' : '#55657a') + (on ? C(128, 142, 8, '#34D399', 'opacity="' + f(.3 + .3 * sn(t)) + '"') : '');
    return s;
  } };

  ART.sensore_porta = { hue: 28, dim: false, out: 'pair', draw: function (on, t) {
    var s = R(0, 190, 256, 66, lg([[0, hsl(28, 30, 16)], [1, hsl(28, 34, 8)]])) + R(0, 186, 256, 6, hsl(28, 22, 36));
    s += R(58, 30, 140, 162, '#4a2e1a', 6);
    if (!on) {
      s += R(66, 38, 124, 154, lg([[0, '#C98A55'], [1, '#8E5A33']]), 3) + R(76, 48, 104, 54, '#A86D3F', 3) + R(76, 112, 104, 70, '#A86D3F', 3) + C(168, 124, 6, '#FFE9A0');
      s += C(128, 98, 30, '#0c2a1d', 'opacity=".0"') + glow(128, 120, 100, '#34D399', .12);
      s += C(128, 220, 22, '#0f3b2a') + ST('M117 220 l8 8 14 -16', '#34D399', 5);
    } else {
      var open = 24 + 6 * sn(t);
      s += R(66, 38, 124, 154, lg([[0, '#FFF3C4'], [1, '#FFC878']], { x1: 0, y1: 0, x2: 1, y2: 1 }), 3) + glow(140, 120, 120, '#FFD58A', .6 + .1 * sn(t));
      var w = 124 * Math.cos(open * Math.PI / 180), sk = 124 * Math.sin(open * Math.PI / 180) * .22;
      s += P('66,38 ' + f(66 + w) + ',' + f(38 + sk) + ' ' + f(66 + w) + ',' + f(192 - sk) + ' 66,192', lg([[0, '#C98A55'], [1, '#8E5A33']], { x1: 0, y1: 0, x2: 1, y2: 0 })) + C(66 + w - 12, 120, 4.4, '#FFE9A0');
      s += P('66,192 190,192 224,256 20,256', 'rgba(255,200,120,.2)');
      s += C(206, 54, 18, '#3a1d06') + C(206, 54, 18 * (1 + .1 * sn(t, 2)), 'none', 'stroke="#FBBF24" stroke-width="3"') + '<text x="200" y="62" font-family="Arial" font-weight="900" font-size="22" fill="#FBBF24">!</text>';
    }
    return s;
  } };

  ART.sensore_finestra = { hue: 205, dim: false, out: 'pair', draw: function (on, t) {
    var s = R(0, 0, 256, 256, lg([[0, '#0f1a44'], [1, '#27407a']])) + R(0, 196, 256, 60, lg([[0, hsl(205, 28, 16)], [1, hsl(205, 34, 8)]])) + R(0, 192, 256, 6, hsl(205, 22, 40));
    s += R(46, 30, 164, 148, '#E6E9F5', 6) + R(54, 38, 148, 132, lg([[0, '#0b1240'], [1, '#2c4690']]), 3) + stars(10, 54, 38, 148, 70, t, 6) + C(160, 66, 12, '#FFF3C4') + glow(160, 66, 40, '#BFD0FF', .4);
    s += PA('M54 170 L54 130 Q80 118 104 130 T154 130 L154 170Z', 'rgba(255,255,255,.04)') + R(126, 38, 4, 132, '#E6E9F5') + R(54, 100, 148, 4, '#E6E9F5') + R(40, 176, 176, 10, '#C9CEDD', 4);
    if (!on) {
      s += R(54, 38, 148, 132, 'rgba(255,255,255,.04)') + P('60,38 90,38 60,100', 'rgba(255,255,255,.08)');
      s += PA('M40 24 Q58 90 46 186 L40 186Z', 'rgba(124,92,255,.65)') + PA('M216 24 Q198 90 210 186 L216 186Z', 'rgba(124,92,255,.65)');
      s += C(128, 218, 18, '#0f2b3a') + ST('M119 218 l7 7 12 -14', '#34D399', 5);
    } else {
      var a = 26 + 3 * sn(t);
      s += P('54,38 ' + f(54 + 74 * Math.cos(a * Math.PI / 180) * .6) + ',34 ' + f(54 + 74 * Math.cos(a * Math.PI / 180) * .6) + ',178 54,170', 'rgba(230,235,250,.9)') + P('58,42 ' + f(54 + 66 * Math.cos(a * Math.PI / 180) * .6) + ',40 ' + f(54 + 66 * Math.cos(a * Math.PI / 180) * .6) + ',172 58,164', 'rgba(120,150,230,.45)');
      var wv = 14 * sn(t, 1), wv2 = 10 * sn(t, 1, .25);
      s += PA('M216 22 Q' + f(180 + wv) + ' 80 ' + f(176 + wv2) + ' 186 L216 186Z', 'rgba(124,92,255,.7)') + PA('M40 22 Q56 90 44 186 L40 186Z', 'rgba(124,92,255,.65)');
      for (var k = 0; k < 4; k++) { var q = fr(t + k / 4); s += ST('M' + f(-10 + q * 90) + ' ' + (96 + k * 22) + ' q14 -8 28 0 t28 0', 'rgba(210,235,255,' + f(Math.sin(Math.PI * q) * .7) + ')', 3); }
      s += C(206, 220, 18, '#3a2a06') + C(206, 220, 18 * (1 + .1 * sn(t, 2)), 'none', 'stroke="#FBBF24" stroke-width="3"') + '<text x="200" y="228" font-family="Arial" font-weight="900" font-size="22" fill="#FBBF24">!</text>';
    }
    return s;
  } };

  ART.sensore_cancello = { hue: 210, dim: false, out: 'pair', draw: function (on, t) {
    var s = R(0, 0, 256, 256, lg([[0, '#0e1a3a'], [1, '#2a3c70']])) + stars(8, 0, 0, 256, 60, t, 12) + R(0, 190, 256, 66, lg([[0, '#2a2f44'], [1, '#14172a']])) + P('96,190 160,190 220,256 36,256', 'rgba(255,255,255,.05)');
    s += R(14, 70, 18, 126, '#8D90A8', 3) + R(224, 70, 18, 126, '#8D90A8', 3) + R(12, 62, 22, 10, '#B9BED0', 3) + R(222, 62, 22, 10, '#B9BED0', 3);
    function leaf(x0, x1, sk) {
      var g = '';
      g += P(f(x0) + ',90 ' + f(x1) + ',' + f(90 + sk) + ' ' + f(x1) + ',' + f(176 - sk) + ' ' + f(x0) + ',176', 'rgba(0,0,0,.0)', 'stroke="#C9CEDB" stroke-width="3"');
      for (var i = 0; i <= 6; i++) { var x = x0 + (x1 - x0) * i / 6; g += R(x - 1.5, 92 + sk * i / 6, 3, 84 - sk * i / 6 * 2, '#C9CEDB', 1.2); }
      return g;
    }
    if (!on) {
      s += leaf(32, 128, 0) + leaf(128, 224, 0) + R(122, 120, 12, 26, '#E9C46A', 3) + C(128, 128, 3, '#6B5A3A');
      s += C(128, 222, 20, '#12331f') + ST('M118 222 l7 7 13 -15', '#34D399', 5);
    } else {
      var a = .78 + .06 * sn(t);
      s += leaf(32, f(32 + 96 * a * .55), -16) + leaf(f(224 - 96 * a * .55), 224, 16);
      s += P('64,190 192,190 232,256 24,256', 'rgba(251,191,36,.15)');
      var bl = .5 + .5 * Math.abs(sn(t, 1));
      s += glow(23, 56, 38, '#FBBF24', .8 * bl) + C(23, 54, 7, '#FFD36B') + glow(233, 56, 38, '#FBBF24', .8 * (1 - bl)) + C(233, 54, 7, '#FFD36B');
      for (var k = 0; k < 3; k++) s += PA('M' + (104 + k * 18) + ' 224 l16 -12 l0 24Z', '#FBBF24', 'opacity="' + f(.3 + .7 * Math.max(0, sn(t, 1, -k * .12))) + '"');
    }
    return s;
  } };

  /* ============================================================ ALLARME */
  function ring(on, t, col, k) {
    var s = '';
    for (var i = 0; i < 3; i++) { var q = fr(t + i / 3); s += '<path d="' + SH + '" fill="none" stroke="' + col + '" stroke-width="' + f(4 - q * 2.4) + '" opacity="' + f(.8 * (1 - q)) + '" transform="translate(128 126) scale(' + f(1 + q * .7) + ') translate(-128 -126)"/>'; }
    return s;
  }
  ART.allarme_off = { hue: 150, dim: false, out: 'png', draw: function (on, t) {
    var s = glow(128, 126, 130, '#34D399', .35) + PA(SH, lg([[0, '#4FE3B0'], [1, '#12906A']], { x1: 0, y1: 0, x2: 0, y2: 1 })) + PA(SH, 'none', 'stroke="rgba(255,255,255,.55)" stroke-width="3"') + PA('M128 54 L184 74 L184 120 C184 152 164 180 128 198 Z', 'rgba(255,255,255,.12)');
    s += ST('M98 126 l22 24 40 -50', '#fff', 12);
    return s;
  } };
  ART.allarme_notte = { hue: 38, dim: false, out: 'gif', draw: function (on, t) {
    var s = ring(on, t, '#FBBF24') + glow(128, 126, 130, '#FBBF24', .3 + .08 * sn(t)) + PA(SH, lg([[0, '#FFD36B'], [1, '#D9830A']])) + PA(SH, 'none', 'stroke="rgba(255,255,255,.55)" stroke-width="3"');
    s += PA('M140 92 A34 34 0 1 0 160 150 A26 26 0 1 1 140 92Z', '#fff') + stars(3, 100, 90, 70, 20, t, 2, '#fff');
    return s;
  } };
  ART.allarme_fuori = { hue: 38, dim: false, out: 'gif', draw: function (on, t) {
    var s = ring(on, t, '#FBBF24') + glow(128, 126, 130, '#FBBF24', .3 + .08 * sn(t)) + PA(SH, lg([[0, '#FFD36B'], [1, '#D9830A']])) + PA(SH, 'none', 'stroke="rgba(255,255,255,.55)" stroke-width="3"');
    var dx = 6 * sn(t);
    s += PA('M96 156 V104 L128 80 L160 104 V156Z', '#fff') + R(118, 126, 20, 30, '#D9830A', 2) + ST('M168 128 h22 m-9 -9 l9 9 -9 9', '#fff', 7, 'transform="translate(' + f(dx) + ' 0)"');
    return s;
  } };
  ART.allarme_scattato = { hue: 350, dim: false, out: 'gif', draw: function (on, t) {
    var fl = .55 + .45 * Math.abs(sn(t, 2)), s = R(0, 0, 256, 256, '#E11D48', 0, 'opacity="' + f(.18 * fl) + '"');
    s += glow(128, 120, 150, '#FF3B5C', .55 * fl);
    for (var i = 0; i < 2; i++) { var a = 360 * fr(t) + i * 180; s += '<polygon points="128,126 -20,100 -20,152" fill="rgba(255,90,110,.42)" transform="rotate(' + f(a) + ' 128 126)"/>'; }
    s += R(76, 168, 104, 22, '#2b2f3f', 8) + R(88, 156, 80, 16, '#41465c', 6) + PA('M92 158 A36 36 0 0 1 164 158Z', lg([[0, '#FF7A8F'], [1, '#E11D48']]));
    s += PA('M104 156 A24 24 0 0 1 128 124', 'none', 'stroke="rgba(255,255,255,.6)" stroke-width="5" stroke-linecap="round"') + C(128, 142, 14, '#FFE3E8', 'opacity="' + f(.5 * fl) + '"');
    for (var k = 0; k < 3; k++) { var q = fr(t * 2 + k / 3); s += ST('M' + f(44 - q * 16) + ' ' + (130 - k * 6) + ' q-14 14 0 28', 'rgba(255,255,255,' + f(.7 * (1 - q)) + ')', 4) + ST('M' + f(212 + q * 16) + ' ' + (130 - k * 6) + ' q14 14 0 28', 'rgba(255,255,255,' + f(.7 * (1 - q)) + ')', 4); }
    s += '<text x="128" y="228" text-anchor="middle" font-family="Arial" font-weight="900" font-size="22" fill="#fff" opacity="' + f(.6 + .4 * fl) + '">ALLARME</text>';
    return s;
  } };
})();
