/* ==================== EDITOR DEL MAPA: SELECCIÓN E HISTORIAL ====================
   Herramienta de selección: tocar un elemento (trazo, texto, rectángulo, objeto, imagen) lo elige; arrastrar en vacío
   encierra varios. Con algo elegido: arrastrar lo mueve, las esquinas lo escalan, el círculo de arriba lo gira
   (de 15 en 15 grados; con Shift, libre). La barra de selección cambia color y capa, duplica, gira 90°, edita el texto
   y borra. Teclado: Supr, flechas, R, Ctrl+Z/Y/C/V/D, Esc.
   Historial por mapa de lo que hiciste tú: {add}, {rm} y {upd:{b, a}}. Los ids de los trazos los pone el cliente,
   así deshacer un borrado vuelve a crear el mismo trazo.
   Geometría en casillas. Un elemento se describe como caja girada {cx, cy, w, h, r}. */
var MapEd = (function(){
  var TEXTS = {0.06:0.7, 0.14:1.1, 0.32:1.8};
  var A = null; // API que da mapas.js
  var sel = {}, op = null, preview = null, rev = 0, hist = {}, clip = null;

  /* ---------- Geometría ---------- */
  function fsOf(k){ return k.fs || TEXTS[k.w] || (k.w || 0.14) * 6; }
  function box(k){
    var p = k.pts;
    if (k.k === 'pen' || k.k === 'line') { var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (var i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); } var pad = (k.w || 0.1) / 2; return {cx:(x0 + x1) / 2, cy:(y0 + y1) / 2, w:x1 - x0 + pad * 2, h:y1 - y0 + pad * 2, r:0}; }
    if (k.k === 'rect') return {cx:(p[0] + p[2]) / 2, cy:(p[1] + p[3]) / 2, w:Math.abs(p[2] - p[0]), h:Math.abs(p[3] - p[1]), r:k.r || 0};
    if (k.k === 'text') { var fs = fsOf(k); return {cx:p[0], cy:p[1], w:Math.max(fs, String(k.t || '').length * fs * 0.56), h:fs * 1.25, r:k.r || 0}; }
    return {cx:p[0], cy:p[1], w:k.s || 1, h:k.h || k.s || 1, r:k.r || 0};
  }
  function rot(x, y, ox, oy, deg){ var a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), dx = x - ox, dy = y - oy; return [ox + dx * c - dy * s, oy + dx * s + dy * c]; }
  function corners(b){ return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(function(q){ return rot(b.cx + q[0] * b.w / 2, b.cy + q[1] * b.h / 2, b.cx, b.cy, b.r); }); }
  function segDist(px, py, ax, ay, bx, by){ var dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0; return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)); }
  function inBox(b, x, y, tol){ var q = rot(x, y, b.cx, b.cy, -b.r); return Math.abs(q[0] - b.cx) <= b.w / 2 + tol && Math.abs(q[1] - b.cy) <= b.h / 2 + tol; }
  function hit(k, x, y, tol){
    var p = k.pts;
    if (k.k === 'pen' || k.k === 'line') { if (p.length === 2) return Math.hypot(x - p[0], y - p[1]) < tol + (k.w || 0.1); for (var i = 0; i + 3 < p.length; i += 2) if (segDist(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) < tol + (k.w || 0.1) / 2) return true; return false; }
    if (k.k === 'rect' && !k.f) { var c = corners(box(k)); for (var j = 0; j < 4; j++) { var a = c[j], b = c[(j + 1) % 4]; if (segDist(x, y, a[0], a[1], b[0], b[1]) < tol + (k.w || 0.1) / 2) return true; } return false; }
    return inBox(box(k), x, y, tol);
  }
  /* Caja que envuelve a varios (sin girar) */
  function groupBox(list){
    if (list.length === 1) return box(list[0]);
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    list.forEach(function(k){ corners(box(k)).forEach(function(c){ x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); }); });
    return {cx:(x0 + x1) / 2, cy:(y0 + y1) / 2, w:x1 - x0, h:y1 - y0, r:0};
  }
  /* Mover, escalar y girar alrededor de (ox, oy): devuelve una copia */
  function transform(k, T){
    var n = JSON.parse(JSON.stringify(k)), ox = T.ox, oy = T.oy, sc = T.sc || 1, rd = T.rot || 0, dx = T.dx || 0, dy = T.dy || 0;
    var P = function(x, y){ var q = rot(ox + (x - ox) * sc, oy + (y - oy) * sc, ox, oy, rd); return [q[0] + dx, q[1] + dy]; };
    if (k.k === 'pen' || k.k === 'line') { for (var i = 0; i < n.pts.length; i += 2) { var q = P(k.pts[i], k.pts[i + 1]); n.pts[i] = r3(q[0]); n.pts[i + 1] = r3(q[1]); } return n; }
    var b = box(k), c = P(b.cx, b.cy), w = b.w * sc, h = b.h * sc, r = norm((k.r || 0) + rd);
    if (k.k === 'rect') { n.pts = [r3(c[0] - w / 2), r3(c[1] - h / 2), r3(c[0] + w / 2), r3(c[1] + h / 2)]; if (r) n.r = r; else delete n.r; return n; }
    n.pts = [r3(c[0]), r3(c[1])]; if (r) n.r = r; else delete n.r;
    if (k.k === 'text') { if (sc !== 1) n.fs = Math.max(0.2, Math.min(10, Math.round(fsOf(k) * sc * 100) / 100)); return n; }
    n.s = Math.max(0.25, Math.min(30, Math.round(w * 100) / 100)); n.h = Math.max(0.25, Math.min(30, Math.round(h * 100) / 100)); return n;
  }
  function r3(v){ return Math.round(v * 100) / 100; }
  function norm(d){ d = Math.round(d * 10) / 10 % 360; if (d > 180) d -= 360; if (d <= -180) d += 360; return d; }

  /* ---------- Qué se puede tocar ---------- */
  function mp(){ return A && A.map(); }
  function editable(m, k){ var hid = A.hidden(m), lk = A.locked(m); return !hid[k.l] && !lk[k.l] && (!A.shared(m) || A.isDm() || k.by === A.me()); }
  function selected(m){ var ids = sel[m.id] || {}; return m.strokes.filter(function(k){ return ids[k.id]; }); }
  function setSel(m, ids){ var o = {}; ids.forEach(function(x){ o[x] = 1; }); sel[m.id] = o; A.toolbar(); A.paint(); }
  function clear(m){ m = m || mp(); if (m && sel[m.id] && Object.keys(sel[m.id]).length) { sel[m.id] = {}; A.toolbar(); A.paint(); } }
  function count(m){ return Object.keys(sel[(m || mp() || {}).id] || {}).length; }
  function topAt(m, x, y, tol){ for (var i = m.strokes.length - 1; i >= 0; i--) { var k = m.strokes[i]; if (editable(m, k) && hit(k, x, y, tol)) return k; } return null; }
  /* Si los trazos elegidos ya no existen (otro los borró), se sueltan */
  function prune(m){ var ids = sel[m.id]; if (!ids) return; var have = {}; m.strokes.forEach(function(k){ have[k.id] = 1; }); Object.keys(ids).forEach(function(x){ if (!have[x]) delete ids[x]; }); }

  /* ---------- Manijas (en pantalla) ---------- */
  function handles(m){
    var list = selected(m); if (!list.length) return null; var b = groupBox(list), v = A.V(), pad = 6 / v.s;
    var bb = {cx:b.cx, cy:b.cy, w:b.w + pad * 2, h:b.h + pad * 2, r:b.r}, c = corners(bb), top = rot(bb.cx, bb.cy - bb.h / 2 - 26 / v.s, bb.cx, bb.cy, bb.r);
    return {box:bb, corners:c, rot:top, list:list};
  }
  function handleAt(m, x, y, px){
    var H = handles(m); if (!H) return null; var v = A.V(), tol = (px || 16) / v.s;
    if (Math.hypot(x - H.rot[0], y - H.rot[1]) < tol) return {k:'rot', H:H};
    for (var i = 0; i < 4; i++) if (Math.hypot(x - H.corners[i][0], y - H.corners[i][1]) < tol) return {k:'scale', H:H, i:i};
    if (inBox(H.box, x, y, 0)) return {k:'move', H:H};
    return null;
  }

  /* ---------- Gestos (los llama mapas.js con coordenadas del mapa) ---------- */
  function down(m, x, y, ev){
    prune(m);
    var touch = ev.pointerType === 'touch', h = handleAt(m, x, y, touch ? 26 : 14);
    if (h && !(ev.shiftKey && h.k === 'move')) { op = {k:h.k, x0:x, y0:y, H:h.H, orig:h.H.list.map(function(k){ return JSON.parse(JSON.stringify(k)); }), moved:false}; return true; }
    var k = topAt(m, x, y, (touch ? 16 : 10) / A.V().s);
    if (k) {
      var ids = Object.keys(sel[m.id] || {});
      if (ev.shiftKey) { if (ids.indexOf(k.id) >= 0) ids = ids.filter(function(i){ return i !== k.id; }); else ids.push(k.id); setSel(m, ids); return true; }
      setSel(m, [k.id]); var H = handles(m); op = {k:'move', x0:x, y0:y, H:H, orig:[JSON.parse(JSON.stringify(k))], moved:false}; return true;
    }
    op = {k:'lasso', x0:x, y0:y, x1:x, y1:y, add:ev.shiftKey}; A.paint(); return true;
  }
  function move(m, x, y, ev){
    if (!op) return false;
    if (op.k === 'lasso') { op.x1 = x; op.y1 = y; A.paint(); return true; }
    var b = op.H.box, T;
    if (!op.moved && Math.hypot(x - op.x0, y - op.y0) < 4 / A.V().s) return true;
    op.moved = true;
    if (op.k === 'move') {
      var dx = x - op.x0, dy = y - op.y0;
      if (A.snap() && !ev.altKey) { var g = groupBox(op.orig), tx = g.cx - g.w / 2 + dx, ty = g.cy - g.h / 2 + dy; dx += Math.round(tx * 2) / 2 - tx; dy += Math.round(ty * 2) / 2 - ty; }
      T = {ox:b.cx, oy:b.cy, dx:dx, dy:dy};
    } else if (op.k === 'scale') {
      var d0 = Math.hypot(op.x0 - b.cx, op.y0 - b.cy) || 1, d1 = Math.hypot(x - b.cx, y - b.cy);
      T = {ox:b.cx, oy:b.cy, sc:Math.max(0.1, Math.min(20, d1 / d0))};
    } else {
      var a0 = Math.atan2(op.y0 - b.cy, op.x0 - b.cx), a1 = Math.atan2(y - b.cy, x - b.cx), deg = (a1 - a0) * 180 / Math.PI;
      if (!ev.shiftKey) deg = Math.round(deg / 15) * 15;
      T = {ox:b.cx, oy:b.cy, rot:deg};
    }
    rev++; preview = {}; op.orig.forEach(function(k){ var n = transform(k, T); n._p = rev; preview[k.id] = n; }); op.T = T; A.paint(); return true;
  }
  function up(m, x, y, ev){
    if (!op) return false; var o = op; op = null;
    if (o.k === 'lasso') {
      var x0 = Math.min(o.x0, o.x1), x1 = Math.max(o.x0, o.x1), y0 = Math.min(o.y0, o.y1), y1 = Math.max(o.y0, o.y1);
      if (x1 - x0 < 0.1 && y1 - y0 < 0.1) { if (!o.add) clear(m); A.paint(); return true; }
      var ids = o.add ? Object.keys(sel[m.id] || {}) : [];
      m.strokes.forEach(function(k){ if (!editable(m, k)) return; var c = corners(box(k)), inside = c.some(function(p){ return p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1; }) || (box(k).cx >= x0 && box(k).cx <= x1 && box(k).cy >= y0 && box(k).cy <= y1); if (inside && ids.indexOf(k.id) < 0) ids.push(k.id); });
      setSel(m, ids); return true;
    }
    var pv = preview; preview = null; rev++;
    if (!o.moved || !pv) { A.paint(); return true; }
    var after = o.orig.map(function(k){ var n = pv[k.id]; delete n._p; n.v = (k.v || 0) + 1; return n; });
    commitUpd(m, o.orig, after); return true;
  }
  /* Recuadro de selección en curso y manijas: lo dibuja el motor */
  function overlay(m){
    var out = {boxes:[], lasso:null, handles:null};
    if (op && op.k === 'lasso') out.lasso = {x0:op.x0, y0:op.y0, x1:op.x1, y1:op.y1};
    var list = selected(m); if (!list.length) return out;
    var shown = list.map(function(k){ return preview && preview[k.id] || k; });
    out.boxes = shown.length > 1 ? shown.map(box) : [];
    var b = groupBox(shown), v = A.V(), pad = 6 / v.s, bb = {cx:b.cx, cy:b.cy, w:b.w + pad * 2, h:b.h + pad * 2, r:b.r};
    out.handles = {box:bb, corners:corners(bb), rot:rot(bb.cx, bb.cy - bb.h / 2 - 26 / v.s, bb.cx, bb.cy, bb.r), top:rot(bb.cx, bb.cy - bb.h / 2, bb.cx, bb.cy, bb.r)};
    return out;
  }
  /* Los trazos como se ven ahora (con la vista previa del gesto) */
  function strokes(m){ if (!preview) return m.strokes; return m.strokes.map(function(k){ return preview[k.id] || k; }); }

  /* ---------- Historial ---------- */
  function H(m){ return hist[m.id] || (hist[m.id] = {u:[], r:[]}); }
  function record(m, e){ var h = H(m); h.u.push(e); if (h.u.length > 80) h.u.shift(); h.r = []; A.toolbar(); }
  function commitUpd(m, before, after){ A.upd(m, after); record(m, {upd:{b:before, a:after}}); }
  function apply(m, e, back){
    if (e.add) { if (back) A.rm(m, e.add.map(function(k){ return k.id; })); else A.add(m, e.add); }
    else if (e.rm) { if (back) A.add(m, e.rm); else A.rm(m, e.rm.map(function(k){ return k.id; })); }
    else if (e.upd) { var list = (back ? e.upd.b : e.upd.a).map(function(k){ var cur = m.strokes.filter(function(x){ return x.id === k.id; })[0]; var n = JSON.parse(JSON.stringify(k)); n.v = ((cur && cur.v) || 0) + 1; return n; }); A.upd(m, list); }
  }
  function undo(m){ var h = H(m), e = h.u.pop(); if (!e) return false; apply(m, e, true); h.r.push(e); prune(m); A.toolbar(); return true; }
  function redo(m){ var h = H(m), e = h.r.pop(); if (!e) return false; apply(m, e, false); h.u.push(e); A.toolbar(); return true; }
  function canUndo(m){ return !!H(m).u.length; }
  function canRedo(m){ return !!H(m).r.length; }

  /* ---------- Acciones de la barra de selección ---------- */
  function newId(){ return 'k' + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 6); }
  function del(m){ var list = selected(m); if (!list.length) return; A.rm(m, list.map(function(k){ return k.id; })); record(m, {rm:list}); clear(m); }
  function dup(m, list, dx, dy){
    list = list || selected(m); if (!list.length) return;
    var b = groupBox(list), copies = list.map(function(k){ var n = transform(k, {ox:b.cx, oy:b.cy, dx:dx == null ? 1 : dx, dy:dy == null ? 1 : dy}); n.id = newId(); delete n.v; delete n.by; return n; });
    A.add(m, copies); record(m, {add:copies}); setSel(m, copies.map(function(k){ return k.id; }));
  }
  function updSel(m, fn){ var list = selected(m); if (!list.length) return; var before = list.map(function(k){ return JSON.parse(JSON.stringify(k)); }), after = list.map(function(k){ var n = fn(JSON.parse(JSON.stringify(k))); n.v = (k.v || 0) + 1; return n; }); commitUpd(m, before, after); }
  function rotate90(m){ var list = selected(m); if (!list.length) return; var b = groupBox(list); updSel(m, function(k){ return transform(k, {ox:b.cx, oy:b.cy, rot:90}); }); }
  function nudge(m, dx, dy){ var list = selected(m); if (!list.length) return; var b = groupBox(list); updSel(m, function(k){ return transform(k, {ox:b.cx, oy:b.cy, dx:dx, dy:dy}); }); }
  function color(m, c){ updSel(m, function(k){ if (k.k !== 'asset' && k.k !== 'img') k.c = c; return k; }); }
  function toLayer(m, lid){ updSel(m, function(k){ k.l = lid; return k; }); }
  function copy(m){ var list = selected(m); if (list.length) clip = list.map(function(k){ return JSON.parse(JSON.stringify(k)); }); return !!clip; }
  function paste(m){ if (!clip || !clip.length) return; var lids = {}; m.layers.forEach(function(l){ lids[l.id] = 1; }); var list = clip.map(function(k){ var n = JSON.parse(JSON.stringify(k)); if (!lids[n.l]) n.l = A.layer(); return n; }); dup(m, list, 1, 1); }

  /* Barra flotante: aparece con algo elegido */
  function barHtml(m){
    var list = selected(m); if (!list.length) return '';
    var one = list.length === 1 ? list[0] : null, canColor = list.some(function(k){ return k.k !== 'asset' && k.k !== 'img'; });
    var name = one ? ({pen:'Trazo', line:'Línea', rect:'Rectángulo', text:'Texto', asset:(window.Assets && Assets.info(one.a) || {}).name || 'Objeto', img:'Imagen'}[one.k] || 'Elemento') : list.length + ' elementos';
    return '<div class="sel-bar" role="toolbar" aria-label="Selección"><b>' + A.esc(name) + '</b>'
      + (canColor ? '<div class="sel-sw">' + A.colors().map(function(c){ return '<button type="button" class="sw" data-act="selcolor" data-v="' + c[0] + '" style="background:' + c[0] + '" aria-label="Color ' + c[1] + '"></button>'; }).join('') + '</div>' : '')
      + (m.layers.length > 1 ? '<select class="field sel-layer" id="selLayer" aria-label="Mover a la capa"><option value="">Capa…</option>' + m.layers.map(function(l){ return '<option value="' + A.attr(l.id) + '">' + A.esc(l.name) + '</option>'; }).join('') + '</select>' : '')
      + (one && one.k === 'text' ? '<button class="icon-btn sm" type="button" data-act="seltext" aria-label="Editar texto" title="Editar texto"><svg class="ic"><use href="#i-text"/></svg></button>' : '')
      + '<button class="icon-btn sm" type="button" data-act="selrot" aria-label="Girar 90°" title="Girar 90° (R)"><svg class="ic"><use href="#i-undo"/></svg></button>'
      + '<button class="icon-btn sm" type="button" data-act="seldup" aria-label="Duplicar" title="Duplicar (Ctrl+D)"><svg class="ic"><use href="#i-plus"/></svg></button>'
      + '<button class="icon-btn sm del" type="button" data-act="seldel" aria-label="Borrar" title="Borrar (Supr)"><svg class="ic"><use href="#i-trash"/></svg></button>'
      + '<button class="icon-btn sm" type="button" data-act="selx" aria-label="Soltar" title="Soltar (Esc)"><svg class="ic"><use href="#i-x"/></svg></button></div>';
  }
  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('[data-act^="sel"]'); if (!b || !A) return; var m = mp(); if (!m) return; var a = b.dataset.act;
    if (a === 'selcolor') color(m, b.dataset.v);
    else if (a === 'seldel') del(m);
    else if (a === 'seldup') dup(m);
    else if (a === 'selrot') rotate90(m);
    else if (a === 'selx') clear(m);
    else if (a === 'seltext') { var k = selected(m)[0]; if (k && k.k === 'text') A.askText(k); }
  });
  document.addEventListener('change', function(ev){ if (ev.target && ev.target.id === 'selLayer' && ev.target.value && A) { var m = mp(); if (m) toLayer(m, ev.target.value); } });
  // en fase de captura: Esc suelta la selección antes de que el diario lo use para cerrar el mapa
  document.addEventListener('keydown', function(ev){
    if (!A || !A.active()) return; var t = ev.target; if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
    var m = mp(); if (!m) return; var mod = ev.ctrlKey || ev.metaKey, k = ev.key, step = ev.shiftKey ? 0.25 : 1;
    if (mod && (k === 'z' || k === 'Z') && !ev.shiftKey) { if (undo(m)) ev.preventDefault(); return; }
    if (mod && ((k === 'z' || k === 'Z') && ev.shiftKey || k === 'y' || k === 'Y')) { if (redo(m)) ev.preventDefault(); return; }
    if (mod && (k === 'v' || k === 'V')) { if (clip) { paste(m); ev.preventDefault(); } return; }
    if (!count(m)) return;
    if (k === 'Delete' || k === 'Backspace') { del(m); ev.preventDefault(); }
    else if (k === 'Escape') { clear(m); ev.preventDefault(); ev.stopPropagation(); }
    else if (mod && (k === 'c' || k === 'C')) { copy(m); }
    else if (mod && (k === 'd' || k === 'D')) { dup(m); ev.preventDefault(); }
    else if (!mod && (k === 'r' || k === 'R')) rotate90(m);
    else if (k === 'ArrowLeft') { nudge(m, -step, 0); ev.preventDefault(); }
    else if (k === 'ArrowRight') { nudge(m, step, 0); ev.preventDefault(); }
    else if (k === 'ArrowUp') { nudge(m, 0, -step); ev.preventDefault(); }
    else if (k === 'ArrowDown') { nudge(m, 0, step); ev.preventDefault(); }
  }, true);

  function onHandle(m, x, y, touch){ return !!handleAt(m, x, y, touch ? 26 : 14); }
  function cancel(){ if (!op) return; op = null; preview = null; rev++; if (A) A.paint(); }
  return {init:function(api){ A = api; }, onHandle:onHandle, cancel:cancel, box:box, hit:hit, transform:transform, down:down, move:move, up:up, busy:function(){ return !!op; }, overlay:overlay, strokes:strokes, rev:function(){ return rev; },
    record:record, undo:undo, redo:redo, canUndo:canUndo, canRedo:canRedo, select:setSel, clear:clear, count:count, barHtml:barHtml, newId:newId, prune:prune};
})();
