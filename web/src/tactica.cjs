/* ==================== TÁCTICA: DISTANCIAS, ÁREAS, COBERTURA Y MOVIMIENTO ====================
   Lo usan el navegador (variable global Tactica) y el servidor (require), igual que vision.cjs. Todo en casillas
   (1 casilla = 1,5 m). Una ficha es {x, y, s, z}: su esquina, su tamaño en casillas y su altura (z, casillas de vuelo).
   - Distancia de D&D: las diagonales cuentan 1 y la altura también (un dragón a 9 m de altura está a 9 m aunque esté encima).
   - Áreas de efecto (esfera, cilindro, cubo, cono, línea y emanación): una casilla entra si su centro está dentro; las
     paredes que tapan la vista cortan el área desde su origen (cobertura total).
   - Cobertura (reglas de la cuadrícula del DMG): desde la mejor esquina del atacante se trazan líneas a las cuatro esquinas
     de una casilla del objetivo; 1 o 2 tapadas = media (+2), 3 o 4 = tres cuartos (+5), y si ni el centro se ve, total.
     Tapan las paredes; los muros bajos y otras criaturas dan como mucho media cobertura.
   - Flanqueo (regla opcional): un aliado al otro lado del enemigo, con la línea entre los dos cruzando lados opuestos.
   - Movimiento: camino más barato rodeando paredes; el terreno difícil cuesta el doble (volando no cuenta).
   - Ataques de oportunidad: quién te tenía a su alcance y dejas de estarlo por el camino.
   - Estados (reglas 2024): qué ventaja o desventaja dan, críticos automáticos, salvaciones que se fallan solas. */
var Tactica = (function(){
  var V = typeof Vision !== 'undefined' ? Vision : typeof require === 'function' ? require('./vision.cjs') : null;
  var EPS = 1e-6, M = 1.5;
  var INCAP = ['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious'];
  var SPEED0 = ['grappled', 'restrained', 'paralyzed', 'petrified', 'stunned', 'unconscious'];
  var has = function(a, k){ return !!a && a.indexOf(k) >= 0; };

  /* ---------- Distancias ---------- */
  function B(t){ var s = +t.s || 1; return {x:+t.x || 0, y:+t.y || 0, s:s, z:+t.z || 0}; }
  function axis(a0, a1, b0, b1){ if (a0 < b1 - EPS && b0 < a1 - EPS) return 0; return Math.round(Math.max(b0 - a1, a0 - b1)) + 1; }
  /* Casillas entre dos fichas (adyacentes = 1) */
  function dist(a, b){ var A = B(a), Q = B(b); return Math.max(axis(A.x, A.x + A.s, Q.x, Q.x + Q.s), axis(A.y, A.y + A.s, Q.y, Q.y + Q.s), Math.round(Math.abs(A.z - Q.z))); }
  /* De un punto (x, y, z) a una ficha */
  function distPt(p, t){ var Q = B(t), cell = {x:Math.floor(p[0] + EPS), y:Math.floor(p[1] + EPS), s:1, z:p[2] || 0}; return dist(cell, Q); }
  function meters(c){ return (Math.round(c * M * 10) / 10).toString().replace('.', ','); }
  function center(t){ var b = B(t); return [b.x + b.s / 2, b.y + b.s / 2]; }

  /* ---------- Áreas de efecto ----------
     sh = {t:'sphere'|'cylinder', x, y, r}     centro (un punto) y radio en casillas
          {t:'cube', x, y, w}                   esquina y lado
          {t:'cone', x, y, a, l}                origen, ángulo (radianes) y largo: el ancho a cada distancia es esa distancia
          {t:'line', x, y, a, l, w}             origen, ángulo, largo y ancho
          {t:'emanation', tok:{x,y,s}, r}       alrededor de una ficha (sin contarla) */
  var CONE = Math.atan(0.5);
  function origin(sh){ return sh.t === 'emanation' ? center(sh.tok) : [sh.x, sh.y]; }
  function inShape(sh, px, py){
    var dx, dy;
    switch (sh.t) {
      case 'sphere': case 'cylinder': dx = px - sh.x; dy = py - sh.y; return dx * dx + dy * dy <= sh.r * sh.r + 0.01;
      case 'cube': return px > sh.x - EPS && px < sh.x + sh.w + EPS && py > sh.y - EPS && py < sh.y + sh.w + EPS;
      case 'cone': { dx = px - sh.x; dy = py - sh.y; var d = Math.hypot(dx, dy); if (d < 0.05 || d > sh.l + 0.05) return false; var da = Math.abs(Math.atan2(dy, dx) - sh.a); if (da > Math.PI) da = Math.PI * 2 - da; return da <= CONE + 0.02; }
      case 'line': { dx = px - sh.x; dy = py - sh.y; var u = dx * Math.cos(sh.a) + dy * Math.sin(sh.a), v = -dx * Math.sin(sh.a) + dy * Math.cos(sh.a); return u > -0.05 && u <= sh.l + 0.05 && Math.abs(v) <= (sh.w || 1) / 2 + 0.05; }
      case 'emanation': { var t = B(sh.tok); if (px > t.x && px < t.x + t.s && py > t.y && py < t.y + t.s) return false; dx = Math.max(t.x - px, 0, px - (t.x + t.s)); dy = Math.max(t.y - py, 0, py - (t.y + t.s)); return Math.max(dx, dy) <= sh.r + 0.01; }
    }
    return false;
  }
  function bounds(sh){
    var R;
    switch (sh.t) {
      case 'sphere': case 'cylinder': R = sh.r; return [sh.x - R, sh.y - R, sh.x + R, sh.y + R];
      case 'cube': return [sh.x, sh.y, sh.x + sh.w, sh.y + sh.w];
      case 'cone': case 'line': R = sh.l + (sh.w || 1); return [sh.x - R, sh.y - R, sh.x + R, sh.y + R];
      case 'emanation': { var t = B(sh.tok); return [t.x - sh.r - 1, t.y - sh.r - 1, t.x + t.s + sh.r + 1, t.y + t.s + sh.r + 1]; }
    }
    return [0, 0, 0, 0];
  }
  /* Casillas del área ([[x, y], …]); las paredes que tapan la vista la cortan desde el origen */
  function area(mp, sh){
    if (!sh || !mp) return [];
    var b = bounds(sh), x0 = Math.max(0, Math.floor(b[0])), y0 = Math.max(0, Math.floor(b[1])), x1 = Math.min(mp.cols - 1, Math.ceil(b[2])), y1 = Math.min(mp.rows - 1, Math.ceil(b[3]));
    var ix = V && mp.walls && mp.walls.length ? V.sightOf(mp) : null, o = origin(sh), out = [];
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var px = x + 0.5, py = y + 0.5; if (!inShape(sh, px, py)) continue;
      if (ix && ix.n && V.crosses(ix, o[0], o[1], px, py)) continue;
      out.push([x, y]);
    }
    return out;
  }
  function cellSet(cells, cols){ var s = {}; for (var i = 0; i < cells.length; i++) s[cells[i][1] * cols + cells[i][0]] = 1; return s; }
  /* ¿La ficha está dentro (alguna de sus casillas)? */
  function touches(set, t, cols){ var b = B(t), xa = Math.floor(b.x + EPS), ya = Math.floor(b.y + EPS), n = Math.max(1, Math.round(b.s)); for (var y = ya; y < ya + n; y++) for (var x = xa; x < xa + n; x++) if (set[y * cols + x]) return true; return false; }
  /* Fichas que toca el área */
  function inArea(mp, sh, toks){ var set = cellSet(area(mp, sh), mp.cols); return (toks || mp.tokens || []).filter(function(t){ return touches(set, t, mp.cols); }); }

  /* ---------- Cobertura ---------- */
  var CACHE = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function lowIx(mp){
    var c = CACHE && CACHE.get(mp), rev = mp.wrev || 0, n = (mp.walls || []).length;
    if (c && c.rev === rev && c.n === n && c.walls === mp.walls) return c.ix;
    var low = (mp.walls || []).filter(function(w){ return w.t === 'low'; }).map(function(w){ return {a:w.a, b:w.b, t:'wall'}; });
    var ix = low.length && V ? V.index(low, 'sight', mp.cols, mp.rows) : null;
    if (CACHE) CACHE.set(mp, {rev:rev, n:n, walls:mp.walls, ix:ix});
    return ix;
  }
  /* ¿El segmento a→b cruza el interior de una caja? */
  function segBox(ax, ay, bx, by, x0, y0, x1, y1){
    var t0 = 0, t1 = 1, dx = bx - ax, dy = by - ay, p = [-dx, dx, -dy, dy], q = [ax - x0, x1 - ax, ay - y0, y1 - ay];
    for (var i = 0; i < 4; i++) { if (Math.abs(p[i]) < EPS) { if (q[i] < 0) return null; } else { var r = q[i] / p[i]; if (p[i] < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; } } }
    return t1 - t0 > 1e-3 ? [t0, t1] : null;
  }
  /* Cobertura de `tgt` frente a `att` (una ficha o un punto [x, y] de origen de un área): 0, 2, 5 o 'total' */
  function cover(mp, att, tgt, others){
    var hard = V && mp.walls && mp.walls.length ? V.sightOf(mp) : null; if (hard && !hard.n) hard = null;
    var low = lowIx(mp), T = B(tgt), K = 0.06;
    var corners = [];
    if (Array.isArray(att)) corners.push([att[0], att[1]]);
    else { var A = B(att); corners.push([A.x + K, A.y + K], [A.x + A.s - K, A.y + K], [A.x + K, A.y + A.s - K], [A.x + A.s - K, A.y + A.s - K]); }
    var crowd = (others || []).filter(function(o){ return o !== att && o !== tgt && !o.hidden; }).map(B);
    var cells = [], n = Math.max(1, Math.round(T.s));
    for (var j = 0; j < n; j++) for (var i = 0; i < n; i++) cells.push([T.x + i, T.y + j]);
    var best = 9, bestHard = 9;
    corners.forEach(function(c){
      cells.forEach(function(q){
        var tc = [[q[0] + K, q[1] + K], [q[0] + 1 - K, q[1] + K], [q[0] + K, q[1] + 1 - K], [q[0] + 1 - K, q[1] + 1 - K]], h = 0, all = 0;
        tc.forEach(function(p){
          var hb = hard && V.crosses(hard, c[0], c[1], p[0], p[1]), lb = !hb && low && V.crosses(low, c[0], c[1], p[0], p[1]);
          var cb = !hb && !lb && crowd.some(function(o){ return !!segBox(c[0], c[1], p[0], p[1], o.x + 0.02, o.y + 0.02, o.x + o.s - 0.02, o.y + o.s - 0.02); });
          if (hb) h++; if (hb || lb || cb) all++;
        });
        var lvl = Math.max(h, Math.min(2, all));
        if (lvl < best || (lvl === best && h < bestHard)) { best = lvl; bestHard = h; }
      });
    });
    if (best <= 0) return 0;
    if (best <= 2) return 2;
    if (best >= 4 && hard) { var ac = Array.isArray(att) ? att : center(att), tc2 = center(tgt); if (V.crosses(hard, ac[0], ac[1], tc2[0], tc2[1])) return 'total'; }
    return 5;
  }
  function coverName(v){ return v === 'total' ? 'cobertura total' : v === 5 ? 'cobertura de tres cuartos (+5)' : v === 2 ? 'media cobertura (+2)' : ''; }

  /* ---------- Flanqueo ---------- */
  function sides(p, b){ var s = {}; if (Math.abs(p[1] - b.y) < 1e-3) s.t = 1; if (Math.abs(p[1] - (b.y + b.s)) < 1e-3) s.b = 1; if (Math.abs(p[0] - b.x) < 1e-3) s.l = 1; if (Math.abs(p[0] - (b.x + b.s)) < 1e-3) s.r = 1; return s; }
  /* ¿`ally` y `att` flanquean a `tgt`? (los dos a su lado y en lados o esquinas opuestos) */
  function flanks(att, ally, tgt){
    if (dist(att, tgt) > 1 || dist(ally, tgt) > 1 || ally === att) return false;
    var a = center(att), b = center(ally), T = B(tgt), r = segBox(a[0], a[1], b[0], b[1], T.x, T.y, T.x + T.s, T.y + T.s); if (!r) return false;
    var P = [a[0] + (b[0] - a[0]) * r[0], a[1] + (b[1] - a[1]) * r[0]], Q = [a[0] + (b[0] - a[0]) * r[1], a[1] + (b[1] - a[1]) * r[1]], s1 = sides(P, T), s2 = sides(Q, T);
    return !!((s1.t && s2.b) || (s1.b && s2.t) || (s1.l && s2.r) || (s1.r && s2.l));
  }
  function flanked(att, tgt, allies){ return (allies || []).some(function(x){ return flanks(att, x, tgt); }); }

  /* ---------- Terreno difícil y movimiento ---------- */
  /* Casillas de terreno difícil del mapa (zonas «difícil» y conjuros que lo crean); null si no hay */
  function rough(mp){
    var zs = (mp.trig || []).filter(function(z){ return z.k === 'dificil'; }), fx = (mp.fx || []).filter(function(f){ return f.terrain; });
    if (!zs.length && !fx.length) return null;
    var g = new Uint8Array(mp.cols * mp.rows);
    zs.forEach(function(z){ for (var y = z.y; y < Math.min(mp.rows, z.y + z.h); y++) for (var x = z.x; x < Math.min(mp.cols, z.x + z.w); x++) g[y * mp.cols + x] = 1; });
    fx.forEach(function(f){ zoneCells(mp, f).forEach(function(c){ g[c[1] * mp.cols + c[0]] = 1; }); });
    return g;
  }
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  /* Camino más barato de la ficha a (x1, y1): {ok, cells:[[x,y]…], cost}. Cada paso cuesta 1; entrar a terreno difícil, 2. */
  function walk(mp, tok, x1, y1, o){
    o = o || {}; var s = Math.max(1, Math.round(tok.s || 1)), W = mp.cols - s + 1, H = mp.rows - s + 1; if (W < 1 || H < 1) return {ok:false};
    var cl = function(v, hi){ v = Math.round(v); return v < 0 ? 0 : v >= hi ? hi - 1 : v; };
    var x0 = cl(tok.x, W), y0 = cl(tok.y, H); x1 = cl(x1, W); y1 = cl(y1, H);
    var R = o.fly ? null : (o.rough !== undefined ? o.rough : rough(mp)), mi = V && mp.walls && mp.walls.length ? V.moveOf(mp) : null, g = mi && mi.n ? V.gridOf(mp) : null;
    if (!R && !g) { var d = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); return {ok:true, cells:null, cost:d}; }
    var cost = function(nx, ny, dx, dy){
      if (!R) return 1;
      for (var j = 0; j < s; j++) for (var i = 0; i < s; i++) { var ii = i - dx, jj = j - dy; if (ii >= 0 && ii < s && jj >= 0 && jj < s) continue; if (R[(ny + j) * mp.cols + nx + i]) return 2; }
      return 1;
    };
    var N = W * H, D = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), start = y0 * W + x0, goal = y1 * W + x1;
    D[start] = 0; prev[start] = start;
    // cola por cubetas (los costos son 1 o 2)
    var buckets = [[start]], bi = 0, maxB = (o.max || W + H) * 2 + 4;
    while (bi < buckets.length && bi <= maxB) {
      var bk = buckets[bi]; if (!bk || !bk.length) { bi++; continue; }
      var cur = bk.pop(); if (D[cur] < bi) continue; if (cur === goal) break;
      var cx = cur % W, cy = (cur / W) | 0;
      for (var k = 0; k < 8; k++) {
        var dx = DIRS[k][0], dy = DIRS[k][1], nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (g && !V.stepOk(g, mp.cols, mp.rows, cx, cy, dx, dy)) continue;
        if (g && s > 1) { var okS = true; for (var jj2 = 0; jj2 < s && okS; jj2++) for (var ii2 = 0; ii2 < s && okS; ii2++) { if (!V.stepOk(g, mp.cols, mp.rows, cx + ii2, cy + jj2, dx, dy)) okS = false; } if (!okS) continue; }
        var ni = ny * W + nx, nd = D[cur] + cost(nx, ny, dx, dy);
        if (nd < D[ni]) { D[ni] = nd; prev[ni] = cur; (buckets[nd] || (buckets[nd] = [])).push(ni); }
      }
    }
    if (!isFinite(D[goal])) return {ok:false};
    var out = [], q = goal; while (q !== start) { out.push([q % W, (q / W) | 0]); q = prev[q]; } out.push([x0, y0]);
    return {ok:true, cells:out.reverse(), cost:D[goal]};
  }

  /* ---------- Ataques de oportunidad ----------
     foes: [{id, t (ficha), reach (casillas)}]. Provoca quien te tenía a su alcance y por el camino dejas de estarlo. */
  function provokes(tok, cells, foes){
    var z = +tok.z || 0, s = tok.s || 1, pos = cells && cells.length ? cells : [[tok.x, tok.y]], out = [];
    (foes || []).forEach(function(f){
      var r = f.reach || 1;
      for (var i = 1; i < pos.length; i++) {
        var a = {x:pos[i - 1][0], y:pos[i - 1][1], s:s, z:z}, b = {x:pos[i][0], y:pos[i][1], s:s, z:z};
        if (dist(a, f.t) <= r && dist(b, f.t) > r) { out.push({id:f.id, at:i}); break; }
      }
    });
    return out;
  }
  /* Casillas por donde pasa una ficha en línea recta (sin paredes) */
  function line(x0, y0, x1, y1){
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)), out = [[x0, y0]];
    for (var i = 1; i <= n; i++) out.push([Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n)]);
    return out;
  }

  /* ---------- Zonas de conjuros que se quedan en el mapa ---------- */
  /* Una zona es {id, name, sh, tok?, r?, terrain, …}: si sigue a una ficha (emanación), su forma va con ella */
  function zoneShape(mp, z){
    if (z.tok) { var t = (mp.tokens || []).filter(function(x){ return x.id === z.tok; })[0]; return t ? {t:'emanation', tok:t, r:z.r || 1} : null; }
    return z.sh || null;
  }
  function zoneCells(mp, z){ var sh = zoneShape(mp, z); return sh ? area(mp, sh) : []; }

  /* ---------- Estados (reglas 2024) ----------
     o = {att:{conds, exh}, tgt:{conds}, near (a 1,5 m), ranged, flank} → {k:'adv'|'dis'|null, why:[…], crit} */
  var COND_N = {blinded:'cegado', frightened:'asustado', poisoned:'envenenado', prone:'derribado', restrained:'apresado', invisible:'invisible', paralyzed:'paralizado', petrified:'petrificado', stunned:'aturdido', unconscious:'inconsciente', grappled:'agarrado'};
  function attackMods(o){
    var a = (o.att && o.att.conds) || [], t = (o.tgt && o.tgt.conds) || [], adv = [], dis = [];
    ['blinded', 'frightened', 'poisoned', 'prone', 'restrained'].forEach(function(k){ if (has(a, k)) dis.push('estás ' + COND_N[k]); });
    if (has(a, 'invisible')) adv.push('eres invisible');
    ['blinded', 'paralyzed', 'petrified', 'restrained', 'stunned', 'unconscious'].forEach(function(k){ if (has(t, k)) adv.push('el objetivo está ' + COND_N[k]); });
    if (has(t, 'prone')) { if (o.near) adv.push('el objetivo está derribado y a tu lado'); else dis.push('el objetivo está derribado y lejos'); }
    if (has(t, 'invisible')) dis.push('el objetivo es invisible');
    if (o.flank) adv.push('flanqueo');
    if (o.ranged && o.threat) dis.push('un enemigo a tu lado (ataque a distancia)');
    var k = adv.length && dis.length ? null : adv.length ? 'adv' : dis.length ? 'dis' : null;
    return {k:k, why:adv.concat(dis), adv:adv, dis:dis, crit:!!(o.near && (has(t, 'paralyzed') || has(t, 'unconscious'))), pen:o.att && o.att.exh ? -2 * o.att.exh : 0};
  }
  /* Salvación: {fail} si se falla sola (Fuerza y Destreza paralizado, petrificado, aturdido o inconsciente), {k:'dis'} si apresado (Destreza) */
  function saveMods(conds, ab, exh){
    var c = conds || [], fail = (ab === 'str' || ab === 'dex') && ['paralyzed', 'petrified', 'stunned', 'unconscious'].some(function(k){ return has(c, k); });
    return {fail:fail, k:ab === 'dex' && has(c, 'restrained') ? 'dis' : null, pen:exh ? -2 * exh : 0};
  }
  function incapacitated(conds){ return INCAP.some(function(k){ return has(conds, k); }); }
  function speed0(conds){ return SPEED0.some(function(k){ return has(conds, k); }); }

  return {M:M, dist:dist, distPt:distPt, meters:meters, center:center, area:area, inShape:inShape, cellSet:cellSet, touches:touches, inArea:inArea, cover:cover, coverName:coverName,
    flanks:flanks, flanked:flanked, rough:rough, walk:walk, provokes:provokes, line:line, zoneShape:zoneShape, zoneCells:zoneCells, attackMods:attackMods, saveMods:saveMods,
    incapacitated:incapacitated, speed0:speed0, INCAP:INCAP, SPEED0:SPEED0, CONE:CONE};
})();
if (typeof module === 'object' && module && module.exports) module.exports = Tactica;
