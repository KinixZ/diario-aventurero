/* ==================== EFECTOS DEL MAPA: CONJUROS, GOLPES Y ZONAS ====================
   Un lienzo encima del mapa (#mapFx) dibuja con partículas lo que pasa en el combate: el área de un conjuro que estalla
   (fuego que sube, escarcha que cae, rayos, el trueno en anillos, humo necrótico, motas radiantes…), el proyectil de un
   ataque a distancia hasta su objetivo, el tajo de uno cuerpo a cuerpo y la curación. Las zonas que se quedan (Nube de
   dagas, Espíritus guardianes, una telaraña) se ven para todos, teñidas de su color, con partículas suaves.
   Mapas le pasa la vista (zoom y desplazamiento) y le avisa cada vez que se mueve. Con las animaciones apagadas, las zonas
   se dibujan quietas y no hay estallidos. Solo corre mientras hay algo que animar (a ~30 cuadros por segundo). */
var Efectos = (function(){
  var cv = null, api = null, parts = [], fxs = [], raf = 0, last = 0, zcache = {}, zparts = {};
  var COL = {
    'fuego':['#ff7a1a', '#ffd04a', '#d2321a'], 'frío':['#9fe3ff', '#eafcff', '#4aa8e0'], 'relámpago':['#cfe9ff', '#ffffff', '#6a9cff'], 'trueno':['#ddd6ff', '#a99cff', '#ffffff'],
    'ácido':['#b4f25a', '#6fcf2a', '#eaffb0'], 'veneno':['#93d455', '#4e8a2a', '#c6f08a'], 'necrótico':['#7b4a8c', '#2a1430', '#b07dc4'], 'radiante':['#fff3b0', '#ffd34a', '#ffffff'],
    'psíquico':['#ff8ad8', '#c45cff', '#ffd0f2'], 'fuerza':['#b48cff', '#e7dbff', '#7a52e0'], 'cortante':['#f4f0e6', '#c9c2b0', '#ffffff'], 'perforante':['#f4f0e6', '#c9c2b0', '#ffffff'],
    'contundente':['#e8dcc4', '#b8a888', '#ffffff'], heal:['#a4ffb8', '#ffe9a0', '#ffffff'], '':['#ffd66e', '#fff4cc', '#ffb84a']};
  function colOf(t, heal){ return heal ? COL.heal : COL[t] || COL['']; }
  function motion(){ return !(window.Fx && Fx.mode && Fx.mode() === 'off'); }
  function lite(){ return window.Gfx && Gfx.level && Gfx.level() === 'baja'; }

  /* Mapas lo conecta al abrir un mapa: {map(), view(), seen(x, y), visible()} */
  function attach(canvas, o){ cv = canvas; api = o; zcache = {}; size(); sync(); }
  function size(){
    if (!cv) return; var w = cv.clientWidth || 0, h = cv.clientHeight || 0, d = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
    return d;
  }
  function live(){ return cv && document.contains(cv) && api && api.visible(); }
  /* Las zonas del mapa abierto (con sus casillas, guardadas mientras no cambien) */
  function zones(){
    var mp = api && api.map(); if (!mp || !mp.fx || !mp.fx.length || !window.Tactica) return [];
    return mp.fx.map(function(z){
      var t = z.tok ? (mp.tokens || []).filter(function(x){ return x.id === z.tok; })[0] : null;
      var key = [z.id, JSON.stringify(z.sh || null), t ? t.x + ',' + t.y + ',' + (t.s || 1) : '', mp.wrev || 0, (mp.walls || []).length].join('|');
      var c = zcache[z.id]; if (!c || c.key !== key) { var cells = Tactica.zoneCells(mp, z); c = zcache[z.id] = {key:key, cells:cells, set:Tactica.cellSet(cells, mp.cols)}; }
      return {z:z, cells:c.cells, set:c.set, cols:mp.cols};
    });
  }

  /* ---------- Lo que pasa: una tarjeta de acción con mapa ---------- */
  function play(card){
    if (!live() || !card || !card.map) return; var mp = api.map(); if (!mp || mp.id !== card.map || !motion()) return;
    var col = colOf(card.dtype || (card.dmg && card.dmg[0] && card.dmg[0].type) || '', card.heal), now = performance.now(), n = lite() ? 0.4 : 1;
    if (card.area && window.Tactica) {
      var cells = Tactica.area(mp, card.area), o = card.area.t === 'cone' || card.area.t === 'line' ? [card.area.x, card.area.y] : card.area.t === 'cube' ? [card.area.x + card.area.w / 2, card.area.y + card.area.w / 2] : [card.area.x, card.area.y];
      fxs.push({k:'flash', cells:cells, col:col, t0:now, dur:900});
      if (card.dtype === 'trueno' || card.dtype === 'fuerza') fxs.push({k:'ring', x:o[0], y:o[1], r:Math.sqrt(cells.length) * 0.8 + 1, col:col, t0:now, dur:700});
      if (card.dtype === 'relámpago') fxs.push({k:'bolt', ax:card.from ? card.from[0] : o[0], ay:card.from ? card.from[1] : o[1], cells:cells, col:col, t0:now, dur:450});
      burst(cells, col, card.dtype, Math.min(220, Math.round(cells.length * 5 * n) + 20));
    } else if (card.targets && card.targets.length) {
      card.targets.forEach(function(t, i){
        if (!t.at) return; var hit = card.atk ? !!t.hit : true, at = t.at, d = card.from ? Math.hypot(at[0] - card.from[0], at[1] - card.from[1]) : 0, delay = i * 90;
        if (card.heal) { rise(at[0], at[1], col, Math.round(26 * n) + 6, now + delay); return; }
        if (card.from && d > 1.6) fxs.push({k:'shot', ax:card.from[0], ay:card.from[1], bx:at[0] + (hit ? 0 : 0.7), by:at[1] + (hit ? 0 : -0.5), col:col, t0:now + delay, dur:Math.min(650, 220 + d * 30), hit:hit, dtype:card.dtype});
        else fxs.push({k:'slash', x:at[0], y:at[1], col:col, t0:now + delay, dur:380, hit:hit, crit:card.atk && card.atk.crit});
      });
    }
    kick();
  }
  /* Partículas en un área según el tipo de daño */
  function burst(cells, col, ty, n){
    if (!cells.length) return; var now = performance.now();
    for (var i = 0; i < n; i++) {
      var c = cells[(Math.random() * cells.length) | 0], x = c[0] + Math.random(), y = c[1] + Math.random(), p = {x:x, y:y, vx:0, vy:0, g:0, life:0, max:700 + Math.random() * 700, sz:0.06 + Math.random() * 0.09, col:col[(Math.random() * col.length) | 0], t0:now + Math.random() * 180, shape:'dot'};
      if (ty === 'fuego') { p.vy = -0.9 - Math.random() * 1.4; p.vx = (Math.random() - 0.5) * 0.5; p.sz *= 1.4; }
      else if (ty === 'frío') { p.vy = 0.6 + Math.random() * 0.8; p.vx = (Math.random() - 0.5) * 0.3; p.shape = 'shard'; }
      else if (ty === 'necrótico' || ty === 'veneno') { p.vx = (Math.random() - 0.5) * 0.6; p.vy = -0.2 - Math.random() * 0.4; p.sz *= 2.6; p.shape = 'smoke'; p.max += 500; }
      else if (ty === 'radiante') { p.vy = -0.6 - Math.random() * 0.9; p.shape = 'star'; }
      else if (ty === 'ácido') { p.vy = -0.3 - Math.random() * 0.5; p.shape = 'ring'; }
      else if (ty === 'psíquico' || ty === 'fuerza' || ty === 'trueno') { var a = Math.random() * Math.PI * 2, s = 0.8 + Math.random() * 1.6; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s; p.shape = 'ring'; }
      else { var a2 = Math.random() * Math.PI * 2, s2 = 1 + Math.random() * 2.4; p.vx = Math.cos(a2) * s2; p.vy = Math.sin(a2) * s2; p.g = 2.5; p.max *= 0.6; }
      parts.push(p);
    }
  }
  function rise(x, y, col, n, t0){ for (var i = 0; i < n; i++) parts.push({x:x - 0.4 + Math.random() * 0.8, y:y + 0.2 - Math.random() * 0.4, vx:(Math.random() - 0.5) * 0.2, vy:-0.6 - Math.random() * 0.8, g:0, life:0, max:900 + Math.random() * 600, sz:0.07 + Math.random() * 0.07, col:col[(Math.random() * col.length) | 0], t0:t0 + Math.random() * 300, shape:'star'}); }
  function impact(x, y, col, ty, hit, crit){ burst([[Math.floor(x), Math.floor(y)]], col, ty || '', hit ? (crit ? 46 : 24) : 6); }

  /* ---------- Dibujar ---------- */
  function kick(){ if (!raf && live()) raf = requestAnimationFrame(step); }
  function step(t){
    raf = 0; if (!live()) { parts = []; fxs = []; return; }
    if (t - last < 30) { raf = requestAnimationFrame(step); return; }
    var dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
    draw(t, dt);
    var zs = (api.map() && api.map().fx && api.map().fx.length && motion() && !lite()) || (api.aim && api.aim() && motion());
    if (parts.length || fxs.length || zs) raf = requestAnimationFrame(step);
  }
  /* Mapas lo llama tras cada cuadro (al mover o hacer zoom): repinta las zonas y sigue si hay animación */
  function sync(){ if (!cv) return; if (!live()) { var g = cv.getContext && cv.getContext('2d'); if (g) g.clearRect(0, 0, cv.width, cv.height); return; } draw(performance.now(), 0); kick(); }
  function draw(now, dt){
    var d = size(), g = cv.getContext && cv.getContext('2d'); if (!g) return; var v = api.view();
    g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, cv.width / d, cv.height / d);
    var X = function(x){ return v.x + x * v.s; }, Y = function(y){ return v.y + y * v.s; };
    // zonas que se quedan
    zones().forEach(function(Z){
      var col = colOf(Z.z.dtype, Z.z.act && Z.z.act.heal), s = v.s, pulse = motion() ? 0.5 + 0.5 * Math.sin(now / 700 + Z.z.id.length) : 0.5;
      g.save(); g.globalAlpha = 0.16 + pulse * 0.08; g.fillStyle = col[0];
      Z.cells.forEach(function(c){ if (api.seen(c[0], c[1])) g.fillRect(X(c[0]), Y(c[1]), s + 0.5, s + 0.5); });
      if (Z.z.terrain) { g.globalAlpha = 0.35; g.strokeStyle = col[1]; g.lineWidth = Math.max(1, s * 0.04); g.beginPath(); Z.cells.forEach(function(c){ if (!api.seen(c[0], c[1])) return; var x0 = X(c[0]), y0 = Y(c[1]); g.moveTo(x0, y0 + s * 0.5); g.lineTo(x0 + s * 0.5, y0); g.moveTo(x0 + s * 0.5, y0 + s); g.lineTo(x0 + s, y0 + s * 0.5); }); g.stroke(); }
      // borde: los lados de casilla que dan afuera
      g.globalAlpha = 0.75; g.strokeStyle = col[0]; g.lineWidth = Math.max(1.5, s * 0.06); g.setLineDash(Z.z.conc ? [s * 0.25, s * 0.15] : []); g.beginPath();
      Z.cells.forEach(function(c){ var x = c[0], y = c[1], k = y * Z.cols + x; if (!api.seen(x, y)) return;
        if (!Z.set[k - Z.cols]) { g.moveTo(X(x), Y(y)); g.lineTo(X(x + 1), Y(y)); } if (!Z.set[k + Z.cols]) { g.moveTo(X(x), Y(y + 1)); g.lineTo(X(x + 1), Y(y + 1)); }
        if (x === 0 || !Z.set[k - 1]) { g.moveTo(X(x), Y(y)); g.lineTo(X(x), Y(y + 1)); } if (!Z.set[k + 1] || x === Z.cols - 1) { g.moveTo(X(x + 1), Y(y)); g.lineTo(X(x + 1), Y(y + 1)); } });
      g.stroke(); g.setLineDash([]);
      // nombre en la primera casilla
      if (s >= 14 && Z.cells.length) { var c0 = Z.cells[0]; g.globalAlpha = 0.95; g.font = '600 ' + Math.max(10, Math.min(13, s * 0.32)) + 'px Georgia, serif'; g.textBaseline = 'top'; g.lineWidth = 3; g.strokeStyle = 'rgba(18,13,11,.85)'; g.strokeText(Z.z.name, X(c0[0]) + 3, Y(c0[1]) + 2); g.fillStyle = col[2]; g.fillText(Z.z.name, X(c0[0]) + 3, Y(c0[1]) + 2); }
      g.restore();
      // partículas suaves dentro
      if (motion() && !lite() && Z.cells.length) {
        var pool = zparts[Z.z.id] || (zparts[Z.z.id] = []), want = Math.min(40, Z.cells.length * 2);
        while (pool.length < want) { var c = Z.cells[(Math.random() * Z.cells.length) | 0]; pool.push({x:c[0] + Math.random(), y:c[1] + Math.random(), ph:Math.random() * 6, sp:0.2 + Math.random() * 0.4, col:col[(Math.random() * col.length) | 0]}); }
        g.save();
        pool.forEach(function(p, i){
          p.y -= p.sp * dt; p.ph += dt * 2; var cx = Math.floor(p.x), cy = Math.floor(p.y);
          if (!Z.set[cy * Z.cols + cx]) { var c2 = Z.cells[(Math.random() * Z.cells.length) | 0]; p.x = c2[0] + Math.random(); p.y = c2[1] + 1; }
          if (!api.seen(Math.floor(p.x), Math.floor(p.y))) return;
          g.globalAlpha = 0.35 + 0.35 * Math.sin(p.ph); g.fillStyle = p.col; g.beginPath(); g.arc(X(p.x), Y(p.y), Math.max(1, s * 0.05), 0, Math.PI * 2); g.fill();
        });
        g.restore();
      }
    });
    // lo que apuntas: el área teñida, los objetivos marcados y el alcance desde tu ficha
    var A = api.aim && api.aim();
    if (A) {
      var pul = motion() ? 0.5 + 0.5 * Math.sin(now / 260) : 0.6, ac = A.far ? ['#ff5a4a', '#ff9a8a', '#ffffff'] : A.col;
      g.save(); g.globalAlpha = 0.22 + pul * 0.14; g.fillStyle = ac[0]; A.cells.forEach(function(c){ g.fillRect(X(c[0]), Y(c[1]), v.s + 0.5, v.s + 0.5); });
      g.globalAlpha = 0.9; g.strokeStyle = ac[1] || ac[0]; g.lineWidth = Math.max(1.5, v.s * 0.05); A.cells.forEach(function(c){ g.strokeRect(X(c[0]) + 1, Y(c[1]) + 1, v.s - 2, v.s - 2); });
      if (A.range) { g.globalAlpha = 0.6; g.setLineDash([8, 6]); g.strokeStyle = '#ffd66e'; g.lineWidth = 2; g.beginPath(); g.arc(X(A.range[0]), Y(A.range[1]), A.range[2] * v.s, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
      A.rings.forEach(function(q){ g.globalAlpha = 0.95; g.strokeStyle = '#ff6b4a'; g.lineWidth = Math.max(2.5, v.s * 0.08); g.beginPath(); g.arc(X(q[0]), Y(q[1]), q[2] * v.s + pul * 3, 0, Math.PI * 2); g.stroke(); });
      g.restore(); if (motion()) kick();
    }
    var mfx = (api.map() || {}).fx || []; for (var id in zparts) if (!mfx.some(function(z){ return z.id === id; })) delete zparts[id];
    // efectos de un momento
    fxs = fxs.filter(function(f){
      var k = (now - f.t0) / f.dur; if (k < 0) return true; if (k > 1) { if (f.k === 'shot') impact(f.bx, f.by, f.col, f.dtype, f.hit); return false; }
      g.save();
      if (f.k === 'flash') { g.globalAlpha = (1 - k) * 0.45; g.fillStyle = f.col[0]; f.cells.forEach(function(c){ g.fillRect(X(c[0]), Y(c[1]), v.s + 0.5, v.s + 0.5); }); }
      else if (f.k === 'ring') { g.globalAlpha = 1 - k; g.strokeStyle = f.col[0]; g.lineWidth = Math.max(2, v.s * 0.12 * (1 - k)); for (var j = 0; j < 2; j++) { g.beginPath(); g.arc(X(f.x), Y(f.y), Math.max(1, (k * f.r - j * 0.6) * v.s), 0, Math.PI * 2); g.stroke(); } }
      else if (f.k === 'bolt') { g.globalAlpha = k < 0.5 ? 1 : 2 - k * 2; g.strokeStyle = f.col[1]; g.shadowColor = f.col[2]; g.shadowBlur = 12; g.lineWidth = Math.max(2, v.s * 0.07); var far = f.cells.reduce(function(a, c){ var dd = Math.hypot(c[0] + 0.5 - f.ax, c[1] + 0.5 - f.ay); return dd > a.d ? {d:dd, c:c} : a; }, {d:0, c:null}); if (far.c) { var bx = far.c[0] + 0.5, by = far.c[1] + 0.5, n = 10; g.beginPath(); g.moveTo(X(f.ax), Y(f.ay)); for (var q = 1; q <= n; q++) { var tq = q / n; g.lineTo(X(f.ax + (bx - f.ax) * tq + (q < n ? (Math.random() - 0.5) * 0.5 : 0)), Y(f.ay + (by - f.ay) * tq + (q < n ? (Math.random() - 0.5) * 0.5 : 0))); } g.stroke(); } }
      else if (f.k === 'shot') { var e = k * k * (3 - 2 * k), hx = f.ax + (f.bx - f.ax) * e, hy = f.ay + (f.by - f.ay) * e, tx = f.ax + (f.bx - f.ax) * Math.max(0, e - 0.18), ty = f.ay + (f.by - f.ay) * Math.max(0, e - 0.18); var gr = g.createLinearGradient(X(tx), Y(ty), X(hx), Y(hy)); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, f.col[0]); g.strokeStyle = gr; g.lineWidth = Math.max(2, v.s * 0.1); g.lineCap = 'round'; g.beginPath(); g.moveTo(X(tx), Y(ty)); g.lineTo(X(hx), Y(hy)); g.stroke(); g.fillStyle = f.col[2]; g.beginPath(); g.arc(X(hx), Y(hy), Math.max(2, v.s * 0.09), 0, Math.PI * 2); g.fill(); if (Math.random() < 0.6) parts.push({x:hx, y:hy, vx:(Math.random() - 0.5) * 0.4, vy:(Math.random() - 0.5) * 0.4, g:0, life:0, max:300, sz:0.05, col:f.col[0], t0:now, shape:'dot'}); }
      else if (f.k === 'slash') { var a0 = -2.4 + k * 2.2, R = 0.55 * v.s; g.globalAlpha = 1 - k; g.strokeStyle = f.hit ? f.col[0] : 'rgba(255,255,255,.5)'; g.lineWidth = Math.max(2, v.s * (f.crit ? 0.14 : 0.09)); g.lineCap = 'round'; g.beginPath(); g.arc(X(f.x), Y(f.y), R, a0, a0 + 1.1); g.stroke(); if (k > 0.5 && !f.done && f.hit) { f.done = true; impact(f.x, f.y, f.col, '', true, f.crit); } }
      g.restore(); return true;
    });
    // partículas
    parts = parts.filter(function(p){
      if (now < p.t0) return true; p.life += dt * 1000; if (p.life > p.max) return false;
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; var k = p.life / p.max, s = Math.max(1, p.sz * v.s * (p.shape === 'smoke' ? 0.6 + k : 1 - k * 0.5));
      g.globalAlpha = p.shape === 'smoke' ? 0.35 * (1 - k) : 1 - k; g.fillStyle = p.col; g.strokeStyle = p.col;
      var px = X(p.x), py = Y(p.y);
      if (p.shape === 'shard') { g.beginPath(); g.moveTo(px, py - s * 1.6); g.lineTo(px + s * 0.6, py); g.lineTo(px, py + s * 1.6); g.lineTo(px - s * 0.6, py); g.closePath(); g.fill(); }
      else if (p.shape === 'ring') { g.lineWidth = Math.max(1, s * 0.35); g.beginPath(); g.arc(px, py, s, 0, Math.PI * 2); g.stroke(); }
      else if (p.shape === 'star') { g.beginPath(); g.moveTo(px, py - s * 1.4); g.lineTo(px + s * 0.35, py - s * 0.35); g.lineTo(px + s * 1.4, py); g.lineTo(px + s * 0.35, py + s * 0.35); g.lineTo(px, py + s * 1.4); g.lineTo(px - s * 0.35, py + s * 0.35); g.lineTo(px - s * 1.4, py); g.lineTo(px - s * 0.35, py - s * 0.35); g.closePath(); g.fill(); }
      else { g.beginPath(); g.arc(px, py, s, 0, Math.PI * 2); g.fill(); }
      return true;
    });
    g.globalAlpha = 1;
  }
  return {attach:attach, sync:sync, play:play, colOf:colOf, _state:function(){ return {parts:parts.length, fxs:fxs.length}; }};
})();
