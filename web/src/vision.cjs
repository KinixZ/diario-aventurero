/* ==================== VISIÓN: PAREDES, LÍNEA DE VISTA Y MOVIMIENTO ====================
   Lo usan el navegador (variable global Vision) y el servidor (require). Todo en casillas.
   Una pared es {id, a:[x,y], b:[x,y], t, open?, lock?, found?, side?}. Según su tipo tapa la vista, el paso o ambos:
     wall    pared        tapa vista y paso
     door    puerta       cerrada tapa las dos cosas; abierta, nada
     secret  puerta secreta: igual que una puerta; para los jugadores es pared hasta que el DM la marca encontrada
     window  ventana      deja ver, no deja pasar
     oneway  un sentido   tapa la vista solo desde un lado (side) y no deja pasar
     low     muro bajo    no tapa nada (en el combate dará cobertura)
     curtain cortina      tapa la vista, deja pasar
     barrier barrera      invisible: deja ver, no deja pasar
   La vista es un polígono: se lanzan rayos hacia cada extremo de pared (y un poco a los lados) y se queda el choque
   más cercano. Para que sea barato con cientos de paredes, los segmentos van en cubetas de 4 × 4 casillas y cada rayo
   recorre solo las cubetas que cruza (DDA) hasta el primer choque.
   El movimiento usa la cuadrícula: de cada casilla se sabe si se puede pasar al este, sur, sureste y suroeste.
   Luz (módulo 6): ambiente brillante, penumbra u oscuridad (sale de la hora o lo fija el DM), luces de fichas y de objetos
   (su polígono es el de la vista limitado a su radio, así que las paredes también tapan la luz) y los sentidos de cada ficha
   (visión en la oscuridad, vista ciega). Una ficha percibe un punto si lo tiene a la vista y el punto está iluminado o dentro
   del alcance de sus sentidos (o de su propia luz). */
var Vision = (function(){
  var TYPES = {
    wall:    {n:'Pared', sight:1, move:1},
    door:    {n:'Puerta', sight:1, move:1, door:1},
    secret:  {n:'Puerta secreta', sight:1, move:1, door:1, dm:1},
    window:  {n:'Ventana', sight:0, move:1},
    oneway:  {n:'Un sentido', sight:2, move:1},
    low:     {n:'Muro bajo', sight:0, move:0},
    curtain: {n:'Cortina', sight:1, move:0},
    barrier: {n:'Barrera invisible', sight:0, move:1, dm:1}
  };
  var KINDS = Object.keys(TYPES);
  var B = 4, EPS = 1e-4, RING = 48, SAMP = [0.2, 0.5, 0.8];

  /* ¿Esta pared tapa la vista ('sight') o el paso ('move')? 0 no, 1 sí, 2 solo desde un lado */
  function blocks(w, mode){ var T = TYPES[w.t] || TYPES.wall; if (T.door && w.open) return 0; return mode === 'move' ? T.move : T.sight; }
  /* Lo que ve un jugador de una pared: las secretas sin encontrar son paredes; las encontradas, puertas */
  function forPlayer(w){
    if (w.t !== 'secret') return w;
    if (!w.found) return {id:w.id, a:w.a, b:w.b, t:'wall'};
    var o = {id:w.id, a:w.a, b:w.b, t:'door'}; if (w.open) o.open = true; if (w.lock) o.lock = true; return o;
  }

  /* ---------- Índice de segmentos por cubetas ---------- */
  function index(walls, mode, cols, rows){
    var segs = [], side = [];
    for (var i = 0; i < walls.length; i++) {
      var w = walls[i], k = blocks(w, mode); if (!k || !w.a || !w.b) continue;
      if (w.a[0] === w.b[0] && w.a[1] === w.b[1]) continue;
      segs.push(w.a[0], w.a[1], w.b[0], w.b[1]); side.push(k === 2 ? (w.side < 0 ? -1 : 1) : 0);
    }
    var n = side.length, bw = Math.max(1, Math.ceil(cols / B) + 1), bh = Math.max(1, Math.ceil(rows / B) + 1);
    var S = new Float64Array(segs), one = new Int8Array(side), start = new Int32Array(bw * bh + 1), rng = new Int32Array(n * 4);
    var cb = function(v, hi){ v = Math.floor(v / B); return v < 0 ? 0 : v >= hi ? hi - 1 : v; };
    for (var s = 0; s < n; s++) {
      var o = s * 4, x0 = cb(Math.min(S[o], S[o + 2]), bw), x1 = cb(Math.max(S[o], S[o + 2]), bw), y0 = cb(Math.min(S[o + 1], S[o + 3]), bh), y1 = cb(Math.max(S[o + 1], S[o + 3]), bh);
      rng[o] = x0; rng[o + 1] = x1; rng[o + 2] = y0; rng[o + 3] = y1;
      for (var by = y0; by <= y1; by++) for (var bx = x0; bx <= x1; bx++) start[by * bw + bx + 1]++;
    }
    for (var q = 0; q < bw * bh; q++) start[q + 1] += start[q];
    var list = new Int32Array(start[bw * bh]), fill = start.slice(0, bw * bh);
    for (s = 0; s < n; s++) { o = s * 4; for (by = rng[o + 2]; by <= rng[o + 3]; by++) for (bx = rng[o]; bx <= rng[o + 1]; bx++) list[fill[by * bw + bx]++] = s; }
    // extremos sin repetir: hacia ellos van los rayos
    var seen = {}, ends = [];
    for (s = 0; s < n; s++) for (var e = 0; e < 2; e++) { var x = S[s * 4 + e * 2], y = S[s * 4 + e * 2 + 1], key = Math.round(x * 1000) + ',' + Math.round(y * 1000); if (!seen[key]) { seen[key] = 1; ends.push(x, y); } }
    return {n:n, S:S, one:one, bw:bw, bh:bh, start:start, list:list, stamp:new Int32Array(n), ray:0, ends:new Float64Array(ends), cols:cols, rows:rows};
  }

  /* Rayo desde (ox, oy) en dirección (dx, dy): devuelve t del primer choque (o tmax si no choca).
     Las paredes de un sentido solo cuentan si el origen está del lado que tapa. */
  function cast(ix, ox, oy, dx, dy, tmax){
    if (!ix.n) return tmax;
    var S = ix.S, one = ix.one, st = ix.start, L = ix.list, stamp = ix.stamp, bw = ix.bw, bh = ix.bh, ray = ++ix.ray;
    if (ray > 2000000000) { stamp.fill(0); ix.ray = ray = 1; }
    var bx = Math.floor(ox / B), by = Math.floor(oy / B); if (bx < 0) bx = 0; else if (bx >= bw) bx = bw - 1; if (by < 0) by = 0; else if (by >= bh) by = bh - 1;
    var sx = dx > 0 ? 1 : dx < 0 ? -1 : 0, sy = dy > 0 ? 1 : dy < 0 ? -1 : 0;
    var tdx = sx ? B / Math.abs(dx) : Infinity, tdy = sy ? B / Math.abs(dy) : Infinity;
    var tmx = sx > 0 ? ((bx + 1) * B - ox) / dx : sx < 0 ? (bx * B - ox) / dx : Infinity;
    var tmy = sy > 0 ? ((by + 1) * B - oy) / dy : sy < 0 ? (by * B - oy) / dy : Infinity;
    var best = tmax;
    for (;;) {
      var b = by * bw + bx;
      for (var j = st[b], je = st[b + 1]; j < je; j++) {
        var s = L[j]; if (stamp[s] === ray) continue; stamp[s] = ray;
        var o = s * 4, ax = S[o], ay = S[o + 1], ex = S[o + 2] - ax, ey = S[o + 3] - ay;
        var den = dx * ey - dy * ex; if (den > -1e-12 && den < 1e-12) continue;
        var qx = ax - ox, qy = ay - oy, t = (qx * ey - qy * ex) / den; if (t <= 1e-9 || t >= best) continue;
        var u = (qx * dy - qy * dx) / den; if (u < -1e-9 || u > 1 + 1e-9) continue;
        if (one[s]) { var cr = ex * (oy - ay) - ey * (ox - ax); if (one[s] > 0 ? cr <= 0 : cr >= 0) continue; }
        best = t;
      }
      var tn = tmx < tmy ? tmx : tmy;
      if (best <= tn || tn >= tmax) break;
      if (tmx < tmy) { bx += sx; if (bx < 0 || bx >= bw) break; tmx += tdx; }
      else { by += sy; if (by < 0 || by >= bh) break; tmy += tdy; }
    }
    return best;
  }
  /* ¿El segmento de A a B cruza alguna pared del índice? */
  function crosses(ix, ax, ay, bx, by){ return cast(ix, ax, ay, bx - ax, by - ay, 1) < 1; }

  /* ---------- Polígono de lo que se ve desde un punto ---------- */
  function poly(ix, ox, oy, range, cols, rows){
    ox = Math.max(0.002, Math.min(cols - 0.002, ox)) + 1.3e-5; oy = Math.max(0.002, Math.min(rows - 0.002, oy)) + 1.7e-5; // fuera de las líneas exactas
    var R = range > 0 ? range : 0, R2 = (R + 1) * (R + 1), ang = [], E = ix.ends, i;
    var C = [0, 0, cols, 0, cols, rows, 0, rows];
    for (i = 0; i < 8; i += 2) ang.push(Math.atan2(C[i + 1] - oy, C[i] - ox));
    // un extremo tapado por otra pared no cambia la forma: solo cuentan los que se ven
    for (i = 0; i < E.length; i += 2) {
      var ddx = E[i] - ox, ddy = E[i + 1] - oy, d2 = ddx * ddx + ddy * ddy; if (R && d2 > R2) continue;
      var dd = Math.sqrt(d2); if (dd < 1e-9) continue;
      if (cast(ix, ox, oy, ddx / dd, ddy / dd, dd) < dd - 1e-6) continue;
      var a = Math.atan2(ddy, ddx); ang.push(a - EPS, a, a + EPS);
    }
    if (R) for (i = 0; i < RING; i++) ang.push(-Math.PI + i * 2 * Math.PI / RING);
    ang.sort(function(p, q){ return p - q; });
    var out = [], la = -10, lx = NaN, ly = NaN;
    for (i = 0; i < ang.length; i++) {
      var an = ang[i]; if (an - la < 1e-7) continue; la = an;
      var dx = Math.cos(an), dy = Math.sin(an);
      var tx = dx > 1e-12 ? (cols - ox) / dx : dx < -1e-12 ? -ox / dx : Infinity, ty = dy > 1e-12 ? (rows - oy) / dy : dy < -1e-12 ? -oy / dy : Infinity, tm = tx < ty ? tx : ty;
      if (R && R < tm) tm = R;
      var t = cast(ix, ox, oy, dx, dy, tm), px = ox + dx * t, py = oy + dy * t;
      if (Math.abs(px - lx) < 1e-3 && Math.abs(py - ly) < 1e-3) continue;
      out.push(px, py); lx = px; ly = py;
    }
    if (out.length >= 4 && Math.abs(out[0] - lx) < 1e-3 && Math.abs(out[1] - ly) < 1e-3) out.length -= 2;
    return simplify(out);
  }
  /* Quita los puntos que quedan en línea recta con sus vecinos (menos vértices que dibujar y recorrer) */
  function simplify(P){
    var n = P.length / 2; if (n < 4) return P;
    var out = [];
    for (var i = 0; i < n; i++) {
      var p = (i + n - 1) % n, q = (i + 1) % n, ax = P[i * 2] - P[p * 2], ay = P[i * 2 + 1] - P[p * 2 + 1], bx = P[q * 2] - P[i * 2], by = P[q * 2 + 1] - P[i * 2 + 1];
      var cr = ax * by - ay * bx, l = Math.abs(ax) + Math.abs(ay) + Math.abs(bx) + Math.abs(by);
      if (Math.abs(cr) > 1e-7 * (l * l + 1e-9) || ax * bx + ay * by < 0) out.push(P[i * 2], P[i * 2 + 1]);
    }
    return out.length >= 6 ? out : P;
  }
  function inPoly(P, x, y){
    var n = P.length / 2, c = false;
    for (var i = 0, j = n - 1; i < n; j = i++) { var xi = P[i * 2], yi = P[i * 2 + 1], xj = P[j * 2], yj = P[j * 2 + 1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; }
    return c;
  }
  function inAny(polys, x, y){ for (var i = 0; i < polys.length; i++) if (inPoly(polys[i], x, y)) return true; return false; }
  function bbox(P){ var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (var i = 0; i < P.length; i += 2) { if (P[i] < x0) x0 = P[i]; if (P[i] > x1) x1 = P[i]; if (P[i + 1] < y0) y0 = P[i + 1]; if (P[i + 1] > y1) y1 = P[i + 1]; } return [x0, y0, x1, y1]; }

  /* Recorre las casillas que el polígono toca (3 × 3 muestras por casilla; puede llamar más de una vez por casilla) */
  function cells(P, cols, rows, fn){
    var n = P.length / 2; if (n < 3) return;
    var bb = bbox(P), r0 = Math.max(0, Math.floor(bb[1])), r1 = Math.min(rows - 1, Math.floor(bb[3])), xs = [];
    var num = function(a, b){ return a - b; };
    for (var r = r0; r <= r1; r++) for (var q = 0; q < 3; q++) {
      var ys = r + SAMP[q]; xs.length = 0;
      for (var i = 0, j = n - 1; i < n; j = i++) { var yi = P[i * 2 + 1], yj = P[j * 2 + 1]; if ((yi > ys) !== (yj > ys)) xs.push(P[i * 2] + (ys - yi) * (P[j * 2] - P[i * 2]) / (yj - yi)); }
      if (xs.length < 2) continue; xs.sort(num);
      for (var k = 0; k + 1 < xs.length; k += 2) {
        var c0 = Math.max(0, Math.ceil(xs[k] - SAMP[2])), c1 = Math.min(cols - 1, Math.floor(xs[k + 1] - SAMP[0]));
        for (var c = c0; c <= c1; c++) fn(r * cols + c, c, r);
      }
    }
  }
  /* Marca como descubiertas las casillas que el polígono toca y que pasan el filtro `ok` (la luz). Devuelve cuántas nuevas. */
  function explore(bits, cols, rows, P, ok){
    var added = 0;
    cells(P, cols, rows, function(id, c, r){ var by = id >> 3, bit = 1 << (id & 7); if (bits[by] & bit) return; if (ok && !ok(id, c, r)) return; bits[by] |= bit; added++; });
    return added;
  }

  /* ---------- Movimiento por la cuadrícula ---------- */
  /* De cada casilla: 1 = no se pasa al este, 2 = al sur, 4 = al sureste, 8 = al suroeste. Solo se miran las casillas cerca de paredes. */
  function moveGrid(ix, cols, rows){
    var g = new Uint8Array(cols * rows); if (!ix.n) return g;
    var near = new Uint8Array(cols * rows), S = ix.S;
    for (var s = 0; s < ix.n; s++) {
      var o = s * 4, x0 = Math.max(0, Math.floor(Math.min(S[o], S[o + 2])) - 1), x1 = Math.min(cols - 1, Math.floor(Math.max(S[o], S[o + 2])) + 1), y0 = Math.max(0, Math.floor(Math.min(S[o + 1], S[o + 3])) - 1), y1 = Math.min(rows - 1, Math.floor(Math.max(S[o + 1], S[o + 3])) + 1);
      for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) near[y * cols + x] = 1;
    }
    for (var i = 0, N = cols * rows; i < N; i++) {
      if (!near[i]) continue; var cx = i % cols, cy = (i / cols) | 0, px = cx + 0.5, py = cy + 0.5, v = 0;
      if (cx + 1 < cols && cast(ix, px, py, 1, 0, 1) < 1) v |= 1;
      if (cy + 1 < rows && cast(ix, px, py, 0, 1, 1) < 1) v |= 2;
      if (cx + 1 < cols && cy + 1 < rows && cast(ix, px, py, 1, 1, 1) < 1) v |= 4;
      if (cx > 0 && cy + 1 < rows && cast(ix, px, py, -1, 1, 1) < 1) v |= 8;
      g[i] = v;
    }
    return g;
  }
  function stepOk(g, cols, rows, x, y, dx, dy){
    var nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return false;
    if (!dy) return !(g[y * cols + Math.min(x, nx)] & 1);
    if (!dx) return !(g[Math.min(y, ny) * cols + x] & 2);
    if (dx === dy) return !(g[Math.min(y, ny) * cols + Math.min(x, nx)] & 4);
    return dy > 0 ? !(g[y * cols + x] & 8) : !(g[ny * cols + nx] & 8);
  }
  /* Una ficha de s × s con la esquina en (x, y): pasa si todas las casillas que entran a terreno nuevo pueden pasar */
  function tokStep(g, cols, rows, s, x, y, dx, dy){
    if (s <= 1) return stepOk(g, cols, rows, x, y, dx, dy);
    for (var j = 0; j < s; j++) for (var i = 0; i < s; i++) { var ii = i + dx, jj = j + dy; if (ii >= 0 && ii < s && jj >= 0 && jj < s) continue; if (!stepOk(g, cols, rows, x + i, y + j, dx, dy)) return false; }
    return true;
  }
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  /* Camino más corto (en casillas, la diagonal cuenta 1) de la esquina (x0, y0) a (x1, y1). null si no hay. */
  function path(g, cols, rows, s, x0, y0, x1, y1){
    s = s || 1; var W = cols - s + 1, H = rows - s + 1; if (W < 1 || H < 1) return null;
    var cl = function(v, hi){ return v < 0 ? 0 : v >= hi ? hi - 1 : v; };
    x0 = cl(x0, W); y0 = cl(y0, H); x1 = cl(x1, W); y1 = cl(y1, H);
    var startI = y0 * W + x0, goal = y1 * W + x1; if (startI === goal) return [[x0, y0]];
    var N = W * H, prev = new Int32Array(N).fill(-1), Q = new Int32Array(N), head = 0, tail = 0; prev[startI] = startI; Q[tail++] = startI;
    while (head < tail) {
      var cur = Q[head++]; if (cur === goal) break; var cx = cur % W, cy = (cur / W) | 0;
      for (var d = 0; d < 8; d++) {
        var dx = DIRS[d][0], dy = DIRS[d][1], nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        var ni = ny * W + nx; if (prev[ni] >= 0) continue; if (!tokStep(g, cols, rows, s, cx, cy, dx, dy)) continue;
        prev[ni] = cur; Q[tail++] = ni;
      }
    }
    if (prev[goal] < 0) return null;
    var out = [], k = goal; while (k !== startI) { out.push([k % W, (k / W) | 0]); k = prev[k]; } out.push([x0, y0]);
    return out.reverse();
  }
  /* Para dibujar: del camino de casillas se quedan solo las esquinas necesarias (centros de la ficha) */
  function smooth(ix, cells, s){
    var h = (s || 1) / 2, c = cells.map(function(p){ return [p[0] + h, p[1] + h]; }); if (c.length < 3) return c;
    var out = [c[0]], i = 0;
    while (i < c.length - 1) { var j = c.length - 1; while (j > i + 1 && crosses(ix, c[i][0], c[i][1], c[j][0], c[j][1])) j--; out.push(c[j]); i = j; }
    return out;
  }

  /* ---------- Cachés por mapa (no se guardan con el mapa) ---------- */
  var CACHE = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  /* Lo que tapa la vista sin ser pared (zonas de conjuro que oscurecen: Nube de niebla, Oscuridad): lo pone tactica.cjs */
  var extra = null;
  function setExtra(fn){ extra = fn; }
  function extraOf(mp){ return extra ? extra(mp) : null; }
  function extraKey(mp){ var x = extraOf(mp); return x ? x.key : ''; }
  function entry(mp, mode){
    var c = CACHE && CACHE.get(mp); if (!c) { c = {}; if (CACHE) CACHE.set(mp, c); }
    var e = c[mode], rev = mp.wrev || 0, walls = mp.walls || [], add = mode === 'sight' ? extraOf(mp) : null, k2 = add ? add.key : '';
    if (!e || e.rev !== rev || e.walls !== walls || e.n !== walls.length || e.cols !== mp.cols || e.rows !== mp.rows || e.k2 !== k2) e = c[mode] = {rev:rev, walls:walls, n:walls.length, cols:mp.cols, rows:mp.rows, k2:k2, ix:index(add ? walls.concat(add.walls) : walls, mode, mp.cols, mp.rows), g:null};
    return e;
  }
  function sightOf(mp){ return entry(mp, 'sight').ix; }
  function moveOf(mp){ return entry(mp, 'move').ix; }
  function gridOf(mp){ var e = entry(mp, 'move'); return e.g || (e.g = moveGrid(e.ix, mp.cols, mp.rows)); }
  /* ¿Puede la ficha ir a (x1, y1)? En línea recta si nada estorba; si no, rodeando. */
  function route(mp, tok, x1, y1){
    var s = tok.s || 1, mi = moveOf(mp); if (!mi.n) return {ok:true};
    var ax = tok.x + s / 2, ay = tok.y + s / 2, bx = x1 + s / 2, by = y1 + s / 2;
    if (!crosses(mi, ax, ay, bx, by)) return {ok:true};
    var p = path(gridOf(mp), mp.cols, mp.rows, s, Math.round(tok.x), Math.round(tok.y), Math.round(x1), Math.round(y1));
    return p ? {ok:true, cells:p, steps:p.length - 1} : {ok:false};
  }
  /* Quién da la vista del grupo: las fichas de personaje (y compañeros) que no estén ocultas, caídas ni cegadas */
  function isViewer(t, ch){
    if (t.kind !== 'pc' || t.hidden) return false;
    // caído: 0 PG de verdad (una hoja vacía llega con 0 de 1 PG y no cuenta)
    if (ch) { if (typeof ch.hp === 'number' && ch.hpMax > 1 && ch.hp <= 0) return false; var cs = ch.conds || []; if (cs.indexOf('blinded') >= 0 || cs.indexOf('unconscious') >= 0) return false; }
    return true;
  }
  function center(t){ var s = t.s || 1; return [t.x + s / 2, t.y + s / 2]; }
  /* Puntos por donde pasó una ficha (para descubrir lo que vio en el camino): cada 2 casillas, hasta 8 */
  function trail(from, to, cells, s){
    var h = (s || 1) / 2, pts = [];
    if (cells && cells.length > 2) { var step = Math.max(2, Math.ceil(cells.length / 8)); for (var i = step; i < cells.length - 1; i += step) pts.push([cells[i][0] + h, cells[i][1] + h]); }
    else if (from) { var d = Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1])), n = Math.min(8, Math.floor(d / 2)); for (var k = 1; k <= n; k++) pts.push([from[0] + (to[0] - from[0]) * k / (n + 1), from[1] + (to[1] - from[1]) * k / (n + 1)]); }
    pts.push(to); return pts;
  }
  /* ---------- Luz ---------- */
  // objetos que alumbran solos (radios en casillas: b brillante, d penumbra más allá; f = parpadea)
  var LIGHTS = {antorcha:{b:4, d:4, c:'#ffb050', f:1}, brasero:{b:3, d:3, c:'#ff9a40', f:1}, fogata:{b:4, d:4, c:'#ffa040', f:1}, candelabro:{b:2, d:2, c:'#ffd27a', f:1}, vela:{b:1, d:1, c:'#ffd27a', f:1}, farol:{b:3, d:6, c:'#ffcf7a'}, cristal:{b:2, d:4, c:'#8fe0ff'}, luz:{b:4, d:4, c:'#fff1c9'}};
  // luces para fichas y objetos (reglas 2024; 1 casilla = 1,5 m): [clave, nombre, brillante, penumbra, color, parpadea]
  var PRESETS = [['vela','Vela',1,1,'#ffd27a',1],['antorcha','Antorcha',4,4,'#ffb050',1],['lampara','Lámpara',3,6,'#ffcf7a',0],['linterna','Linterna con capucha',6,6,'#ffe2a0',0],['luz','Conjuro Luz',4,4,'#fff1c9',0],['llama','Producir llama',4,4,'#ff9a40',1],['fogata','Fogata',4,4,'#ffa040',1],['diurna','Luz del día (conjuro)',12,12,'#fffbe8',0],['feerico','Fuego feérico (solo penumbra)',0,2,'#c79bff',0]];
  var TIMES = {dia:2, amanecer:1, atardecer:1, noche:0};
  function preset(k){ for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i][0] === k) { var p = PRESETS[i]; return {k:p[0], b:p[2], d:p[3], c:p[4], f:p[5] ? 1 : 0}; } return null; }
  /* 2 brillante, 1 penumbra, 0 oscuridad */
  function ambient(mp){ var L = mp.light || {}; if (L.amb === 'bright') return 2; if (L.amb === 'dim') return 1; if (L.amb === 'dark') return 0; var t = TIMES[L.time]; return t == null ? 2 : t; }
  /* Alcance de la vista: el del mapa; con niebla espesa no se ve más allá de 9 m (6 casillas) */
  function effRange(mp){ var r = mp.vis && mp.vis.range || 0, L = mp.light || {}; if (L.wx === 'niebla') r = r ? Math.min(r, 6) : 6; return r; }
  /* Luces del mapa: fichas con luz (no ocultas) y objetos que alumbran. skipLayer(l) quita las capas que no cuentan. */
  function lightList(mp, skipLayer){
    var out = [];
    (mp.tokens || []).forEach(function(t){ var L = t.lt; if (!L || t.hidden || !((+L.b || 0) + (+L.d || 0) > 0)) return; var s = t.s || 1; out.push({id:'t:' + t.id, x:t.x + s / 2, y:t.y + s / 2, b:+L.b || 0, d:+L.d || 0, c:L.c || '#ffd27a', f:!!L.f, tok:t.id}); });
    (mp.strokes || []).forEach(function(k){
      if ((k.k !== 'asset' && k.k !== 'img') || !k.pts || (skipLayer && skipLayer(k.l))) return;
      var L = k.lt; if (L && L.off) return; if (!L || !((+L.b || 0) + (+L.d || 0) > 0)) L = k.k === 'asset' ? LIGHTS[k.a] : null; if (!L) return;
      out.push({id:'k:' + k.id, x:k.pts[0], y:k.pts[1], b:+L.b || 0, d:+L.d || 0, c:L.c || '#ffd27a', f:!!L.f});
    });
    return out;
  }
  /* Iluminación: ambiente y polígonos de cada luz (B brillante, D hasta donde llega la penumbra), con caché por luz */
  function illum(mp, skipLayer){
    var amb = ambient(mp), list = lightList(mp, skipLayer), ix = sightOf(mp), c = CACHE && CACHE.get(mp) || {}, lc = c.lights || (c.lights = {}), seen = {}, out = [];
    if (CACHE && !CACHE.get(mp)) CACHE.set(mp, c);
    list.forEach(function(L){
      var key = L.x + ',' + L.y + ',' + L.b + ',' + L.d + '|' + (mp.wrev || 0) + '|' + (mp.walls || []).length + '|' + mp.cols + 'x' + mp.rows, e = lc[L.id];
      if (!e || e.key !== key) e = lc[L.id] = {key:key, B:L.b > 0 ? poly(ix, L.x, L.y, L.b, mp.cols, mp.rows) : null, D:poly(ix, L.x, L.y, L.b + L.d, mp.cols, mp.rows)};
      seen[L.id] = 1; L.B = e.B; L.D = e.D; out.push(L);
    });
    Object.keys(lc).forEach(function(k){ if (!seen[k]) delete lc[k]; });
    return {amb:amb, lights:out};
  }
  /* Luz de cada casilla (0, 1, 2) contando ambiente y luces */
  function litMap(mp, il){
    var g = new Uint8Array(mp.cols * mp.rows); if (il.amb) g.fill(il.amb);
    if (il.amb < 2) il.lights.forEach(function(L){ if (L.D) cells(L.D, mp.cols, mp.rows, function(id){ if (!g[id]) g[id] = 1; }); if (L.B) cells(L.B, mp.cols, mp.rows, function(id){ g[id] = 2; }); });
    return g;
  }
  /* Luz en un punto (para las reglas: brillante, penumbra u oscuridad) */
  function levelAt(il, x, y){
    var lv = il.amb; if (lv >= 2) return 2;
    for (var i = 0; i < il.lights.length; i++) { var L = il.lights[i]; if (L.B && inPoly(L.B, x, y)) return 2; if (lv < 1 && L.D && inPoly(L.D, x, y)) lv = 1; }
    return lv;
  }
  /* Sentidos de una ficha en casillas: visión en la oscuridad y vista ciega (en pies en la hoja o en la ficha) */
  function sensesOf(t, ch){ var sn = t.sn || {}, dv = sn.dv != null ? sn.dv : ch && ch.dv || 0, bs = sn.bs != null ? sn.bs : ch && ch.bs || 0; return {dv:Math.max(0, +dv || 0) / 5, bs:Math.max(0, +bs || 0) / 5}; }
  /* Hasta dónde ve una ficha sin luz: el mayor de sus sentidos y de su propia luz */
  function reachOf(t, ch){ var sn = sensesOf(t, ch), L = t.lt, own = L ? (+L.b || 0) + (+L.d || 0) : 0; return Math.max(sn.dv, sn.bs, own); }
  /* Descubre lo que percibe el grupo (o solo `o.toks`, con su camino desde `o.from`). o = {charOf, skipLayer, toks, from, cells} */
  function exploreParty(mp, bits, o){
    o = o || {}; if (!mp.vis || !mp.vis.on) return 0;
    var ix = sightOf(mp), range = effRange(mp), il = illum(mp, o.skipLayer), lit = il.amb >= 1 ? null : litMap(mp, il), n = 0;
    (o.toks || mp.tokens || []).forEach(function(t){
      var ch = o.charOf ? o.charOf(t) : null; if (!isViewer(t, ch)) return;
      var R = reachOf(t, ch) + 0.5, pts = o.toks && o.from ? trail(o.from, center(t), o.cells, t.s) : [center(t)];
      pts.forEach(function(p){
        var ok = lit ? function(id, c, r){ if (lit[id]) return true; var dx = c + 0.5 - p[0], dy = r + 0.5 - p[1]; return dx * dx + dy * dy <= R * R; } : null;
        n += explore(bits, mp.cols, mp.rows, poly(ix, p[0], p[1], range, mp.cols, mp.rows), ok);
      });
    });
    return n;
  }
  function segDist(px, py, a, b){ var dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l)) : 0; return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy)); }

  return {TYPES:TYPES, KINDS:KINDS, blocks:blocks, forPlayer:forPlayer, index:index, cast:cast, crosses:crosses, poly:poly, inPoly:inPoly, inAny:inAny, bbox:bbox, cells:cells, explore:explore,
    moveGrid:moveGrid, stepOk:stepOk, path:path, smooth:smooth, sightOf:sightOf, moveOf:moveOf, gridOf:gridOf, route:route, isViewer:isViewer, center:center, trail:trail, segDist:segDist,
    setExtra:setExtra, extraKey:extraKey, LIGHTS:LIGHTS, PRESETS:PRESETS, preset:preset, ambient:ambient, effRange:effRange, lightList:lightList, illum:illum, litMap:litMap, levelAt:levelAt, sensesOf:sensesOf, reachOf:reachOf, exploreParty:exploreParty};
})();
if (typeof module === 'object' && module && module.exports) module.exports = Vision;
