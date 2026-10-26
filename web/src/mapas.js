
/* ==================== MAPAS ==================== */
/* Lienzos grandes con cuadrícula y capas para cartografiar las zonas entre todos.
   En una mesa, cada trazo viaja por la sala y lo ven todos; cada teléfono guarda su copia (IndexedDB),
   así que los mapas se pueden revisar después, sin conexión. Fuera de una mesa se dibuja solo en tu copia. */
var Mapas = (function(){
  var esc = function(s){ return Render5e.esc(s == null ? '' : s); }, attr = function(s){ return Render5e.attr(s == null ? '' : s); };
  var $ = function(s, r){ return (r || document).querySelector(s); };
  var IDX = 'diario-mapas', PAPER = '#f3e9d2', OUT = '#cdbf9f', GRID = 'rgba(80,58,34,.28)';
  var COLORS = [['#2b1d12','Tinta'],['#8c2626','Rojo'],['#2f5d8a','Agua'],['#3f6b3a','Bosque'],['#b08a3e','Oro'],['#6a3fa0','Magia'],['#7b7468','Piedra'],['#ffffff','Blanco']];
  var WIDTHS = [[0.06,'Fino'],[0.14,'Medio'],[0.32,'Grueso']], TEXTS = {0.06:0.7, 0.14:1.1, 0.32:1.8};
  var SIZES = [['24x18','Pequeño · 24 × 18'],['40x30','Mediano · 40 × 30'],['60x45','Grande · 60 × 45'],['100x75','Enorme · 100 × 75']];
  var TOOLS = [['pan','Mover','i-hand'],['pen','Lápiz','i-brush'],['line','Línea','i-line'],['rect','Rectángulo','i-rect'],['text','Texto','i-text'],['erase','Borrar','i-eraser']];
  var maps = {}, cur = null, tool = {k:'pen', c:COLORS[0][0], w:0.14, snap:true, fill:false, layer:null}, hidden = {}, views = {}, asked = {}, newOpen = false, layersOpen = false, pendingText = null;
  var canvas = null, ptr = {}, gesture = null, drawing = null, erasing = null;

  /* ---------- Guardado en el dispositivo ---------- */
  function idb(){ return new Promise(function(res, rej){ var r = indexedDB.open('diario5e', 2); r.onupgradeneeded = function(){ if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); }; r.onsuccess = function(){ res(r.result); }; r.onerror = function(){ rej(r.error); }; }); }
  function idbGet(k){ return idb().then(function(db){ return new Promise(function(res){ var q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = function(){ res(q.result); }; q.onerror = function(){ res(null); }; }); }).catch(function(){ return null; }); }
  function idbPut(k, v){ return idb().then(function(db){ return new Promise(function(res){ var t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = function(){ res(true); }; t.onerror = function(){ res(false); }; }); }).catch(function(){ return false; }); }
  function idbDel(k){ return idb().then(function(db){ return new Promise(function(res){ var t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = function(){ res(true); }; }); }).catch(function(){ return false; }); }
  function index(){ try { return JSON.parse(localStorage.getItem(IDX) || '[]'); } catch(e){ return []; } }
  function setIndex(a){ try { localStorage.setItem(IDX, JSON.stringify(a)); } catch(e){} }
  var saveT = {};
  function keep(mp){
    maps[mp.id] = mp;
    var ix = index().filter(function(x){ return x.id !== mp.id; });
    ix.unshift({id:mp.id, name:mp.name, cols:mp.cols, rows:mp.rows, n:mp.strokes.length, updated:mp.updated || Date.now(), room:mp.room || null});
    ix.sort(function(a, b){ return (b.updated || 0) - (a.updated || 0); }); setIndex(ix.slice(0, 120));
    clearTimeout(saveT[mp.id]); saveT[mp.id] = setTimeout(function(){ idbPut('map:' + mp.id, mp); }, 600);
  }
  function load(id){ if (maps[id]) return Promise.resolve(maps[id]); return idbGet('map:' + id).then(function(m){ if (m) maps[id] = m; return m; }); }

  /* ---------- Mesa ---------- */
  function room(){ return window.Sala && Sala.status() === 'on' ? Sala.room() : null; }
  function roomMeta(id){ var r = room(); return r && (r.maps || []).filter(function(m){ return m.id === id; })[0]; }
  function shared(id){ return !!roomMeta(id); }
  function me(){ var r = room(); return r ? r.you : 'yo'; }
  function isDm(){ var r = room(); return !!r && r.role === 'dm'; }
  function canAdmin(mp){ return !shared(mp.id) || isDm() || mp.by === me(); }
  if (window.Sala) {
    Sala.on('state', function(r){
      (r.maps || []).forEach(function(m){
        var have = maps[m.id] || index().filter(function(x){ return x.id === m.id; })[0];
        if ((!have || (have.updated || 0) < m.updated) && asked[m.id] !== m.updated) { asked[m.id] = m.updated; Sala.send({t:'map.get', id:m.id}); }
      });
      if (visible() && !cur) render();
      if (visible() && cur) toolbar();
    });
    Sala.on('map', function(m){ var mp = m.map; mp.room = room() && room().code; keep(mp); if (cur === mp.id) { toolbar(); paint(); } else if (visible() && !cur) render(); });
    Sala.on('map.add', function(m){ var mp = maps[m.id]; if (!mp) return; mp.strokes.push(m.stroke); mp.updated = m.updated; keep(mp); if (cur === m.id) paint(); });
    Sala.on('map.rm', function(m){ var mp = maps[m.id]; if (!mp) return; var set = {}; m.sids.forEach(function(x){ set[x] = 1; }); mp.strokes = mp.strokes.filter(function(k){ return !set[k.id]; }); mp.updated = m.updated; keep(mp); if (cur === m.id) paint(); });
    Sala.on('map.meta', function(m){ var mp = maps[m.id]; if (!mp) return; mp.name = m.name; mp.grid = m.grid; mp.layers = m.layers; var ok = {}; m.layers.forEach(function(l){ ok[l.id] = 1; }); mp.strokes = mp.strokes.filter(function(k){ return ok[k.l]; }); mp.updated = m.updated; keep(mp); if (cur === m.id) { toolbar(); paint(); } });
    /* Si el servidor se reinició, el DM vuelve a subir los mapas que había en la mesa */
    Sala.on('joined', function(m){ if (!m.restored || m.role !== 'dm' || !window.Mesa || !Mesa.restoreMapIds) return; Mesa.restoreMapIds().forEach(function(id){ load(id).then(function(mp){ if (mp) Sala.send({t:'map.save', map:mp}); }); }); });
  }
  function visible(){ var c = document.getElementById('combat'); return c && !c.hidden && c.getAttribute('data-tab') === 'mapas'; }

  /* ---------- Operaciones (en la mesa van por la sala; si no, a tu copia) ---------- */
  function uid(p){ return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function newMap(name, size, grid){
    var wh = String(size || '40x30').split('x').map(Number);
    var mp = {id:uid('mp'), name:name || 'Mapa nuevo', cols:wh[0], rows:wh[1], grid:grid || 'square', layers:[{id:'l1', name:'Terreno'},{id:'l2', name:'Paredes y puertas'},{id:'l3', name:'Notas'}], strokes:[], created:Date.now(), updated:Date.now(), by:'yo'};
    if (room()) { Sala.send({t:'map.save', map:mp}); mp.room = room().code; }
    keep(mp); return mp;
  }
  function addStroke(mp, k){
    if (shared(mp.id)) { Sala.send({t:'map.add', id:mp.id, stroke:k}); return; }
    k.id = uid('k'); k.by = 'yo'; mp.strokes.push(k); mp.updated = Date.now(); keep(mp); paint();
  }
  function rmStrokes(mp, ids){
    if (!ids.length) return;
    if (shared(mp.id)) { Sala.send({t:'map.rm', id:mp.id, sids:ids}); return; }
    var set = {}; ids.forEach(function(x){ set[x] = 1; }); mp.strokes = mp.strokes.filter(function(k){ return !set[k.id]; }); mp.updated = Date.now(); keep(mp); paint();
  }
  function undo(mp){
    if (shared(mp.id)) { Sala.send({t:'map.undo', id:mp.id}); return; }
    for (var i = mp.strokes.length - 1; i >= 0; i--) if (mp.strokes[i].by === 'yo') { rmStrokes(mp, [mp.strokes[i].id]); return; }
  }
  function setMeta(mp, o){
    if (shared(mp.id)) { o.t = 'map.meta'; o.id = mp.id; Sala.send(o); return; }
    if (o.name) mp.name = o.name; if (o.grid) mp.grid = o.grid; if (o.layers) { mp.layers = o.layers; var ok = {}; o.layers.forEach(function(l){ ok[l.id] = 1; }); mp.strokes = mp.strokes.filter(function(k){ return ok[k.l]; }); }
    mp.updated = Date.now(); keep(mp); toolbar(); paint();
  }

  /* ---------- Lista de mapas ---------- */
  function render(){
    var box = document.getElementById('mesaMaps'); if (!box) return;
    if (cur) { if (!$('#mapCv', box)) editor(box); else { toolbar(); fit(); paint(); } return; }
    var r = room(), ix = index(), inRoom = r ? (r.maps || []) : [], ids = {};
    inRoom.forEach(function(m){ ids[m.id] = 1; });
    var h = '<div class="map-head"><div><b>Mapas de las zonas</b><p class="note">' + (r ? 'Lo que dibujen aquí lo ven todos en la mesa, y se guarda en cada teléfono.' : 'Sin mesa, dibujas solo en tu copia. Entra a una mesa para cartografiar en grupo.') + '</p></div><button class="btn main" type="button" data-act="mapnew">' + (newOpen ? 'Cerrar' : 'Nuevo mapa') + '</button></div>';
    if (newOpen) h += '<form class="map-new card" data-form="mapnew"><label class="fl">Nombre<input class="field" name="name" placeholder="Las minas de Phandelver" autocomplete="off"></label><div class="two"><label class="fl">Tamaño (casillas)<select class="field" name="size">' + SIZES.map(function(x, i){ return '<option value="' + x[0] + '"' + (i === 1 ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label><label class="fl">Cuadrícula<select class="field" name="grid"><option value="square">Cuadrada</option><option value="hex">Hexagonal</option><option value="none">Sin cuadrícula</option></select></label></div><button class="btn main" type="submit">' + (r ? 'Crear en la mesa' : 'Crear en mi diario') + '</button></form>';
    if (r) h += '<div class="group-h">En la mesa ' + esc(r.code) + '</div>' + (inRoom.length ? '<div class="map-grid">' + inRoom.map(function(m){ return card(m, true); }).join('') + '</div>' : '<p class="note">Todavía no hay mapas en esta mesa.</p>');
    var mine = ix.filter(function(x){ return !ids[x.id]; });
    if (mine.length || !r) h += '<div class="group-h">' + (r ? 'Guardados en este teléfono' : 'Mis mapas') + '</div>' + (mine.length ? '<div class="map-grid">' + mine.map(function(m){ return card(m, false); }).join('') + '</div>' : '<p class="note">Aún no tienes mapas. Crea uno para la zona donde están.</p>');
    box.innerHTML = h;
  }
  function card(m, inRoom){
    var r = room();
    return '<div class="map-card card"><button type="button" class="map-open" data-act="mapopen" data-id="' + attr(m.id) + '"><svg class="ic"><use href="#i-map"/></svg><span><b>' + esc(m.name) + '</b><small>' + m.cols + ' × ' + m.rows + ' casillas · ' + (m.n || 0) + ' trazos' + (m.updated ? ' · ' + new Date(m.updated).toLocaleDateString('es-MX', {day:'numeric', month:'short'}) : '') + (!inRoom && m.room ? ' · de la mesa ' + esc(m.room) : '') + '</small></span></button>'
      + '<div class="map-btns">' + (!inRoom && r ? '<button class="btn sm" type="button" data-act="mapshare" data-id="' + attr(m.id) + '">Llevar a la mesa</button>' : '') + '<button class="btn sm" type="button" data-act="mappng" data-id="' + attr(m.id) + '">Imagen</button><button class="btn sm" type="button" data-act="mapdel" data-id="' + attr(m.id) + '" data-room="' + (inRoom ? 1 : '') + '">' + (inRoom ? 'Quitar de la mesa' : 'Borrar') + '</button></div></div>';
  }

  /* ---------- Editor ---------- */
  function editor(box){
    box.innerHTML = '<div class="map-ed"><div class="map-bar" id="mapBar"></div><div class="map-wrap"><canvas id="mapCv" aria-label="Mapa: dibuja con el dedo; con dos dedos mueves y haces zoom"></canvas><div class="map-txt" id="mapTxt" hidden></div></div></div>';
    canvas = $('#mapCv', box); bind(); toolbar(); fit(); frame(maps[cur]); paint();
  }
  function toolbar(){
    var bar = $('#mapBar'), mp = maps[cur]; if (!bar || !mp) return;
    if (!tool.layer || !mp.layers.some(function(l){ return l.id === tool.layer; })) tool.layer = mp.layers[0].id;
    var hid = hidden[mp.id] || {}, admin = canAdmin(mp), sh = shared(mp.id);
    var h = '<div class="map-top"><button class="btn sm" type="button" data-act="mapback">Mapas</button><input class="field map-name" id="mapName" value="' + attr(mp.name) + '" aria-label="Nombre del mapa"><select class="field map-gridsel" id="mapGrid" aria-label="Cuadrícula">' + [['square','Cuadrada'],['hex','Hexagonal'],['none','Sin cuadrícula']].map(function(x){ return '<option value="' + x[0] + '"' + (mp.grid === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select><span class="map-where">' + (sh ? 'En la mesa' : 'Solo tu copia') + '</span></div>';
    h += '<div class="map-tools" role="group" aria-label="Herramienta">' + TOOLS.map(function(t){ return '<button type="button" data-act="maptool" data-v="' + t[0] + '" aria-pressed="' + (tool.k === t[0]) + '" title="' + t[1] + '"><svg class="ic"><use href="#' + t[2] + '"/></svg><span>' + t[1] + '</span></button>'; }).join('') + '</div>';
    h += '<div class="map-opts"><div class="swatches" role="group" aria-label="Color">' + COLORS.map(function(c){ return '<button type="button" class="sw" data-act="mapcolor" data-v="' + c[0] + '" style="background:' + c[0] + '" aria-pressed="' + (tool.c === c[0]) + '" aria-label="' + c[1] + '"></button>'; }).join('') + '</div>'
      + '<div class="map-seg" role="group" aria-label="Grosor">' + WIDTHS.map(function(x){ return '<button type="button" data-act="mapw" data-v="' + x[0] + '" aria-pressed="' + (tool.w === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>'
      + '<label class="toggle"><input type="checkbox" id="mapSnap"' + (tool.snap ? ' checked' : '') + '> Ajustar a la cuadrícula</label>'
      + '<label class="toggle"><input type="checkbox" id="mapFill"' + (tool.fill ? ' checked' : '') + '> Rellenar rectángulos</label></div>';
    h += '<div class="map-layers"><button type="button" class="map-lbtn" data-act="maplayers" aria-expanded="' + layersOpen + '"><svg class="ic"><use href="#i-layers"/></svg>Capas</button>' + mp.layers.map(function(l){ return '<span class="map-layer' + (tool.layer === l.id ? ' on' : '') + (hid[l.id] ? ' off' : '') + '"><button type="button" data-act="maplayer" data-v="' + attr(l.id) + '" aria-pressed="' + (tool.layer === l.id) + '">' + esc(l.name) + '</button><button type="button" class="eye" data-act="mapeye" data-v="' + attr(l.id) + '" aria-pressed="' + !hid[l.id] + '" aria-label="' + (hid[l.id] ? 'Mostrar ' : 'Ocultar ') + attr(l.name) + '"><svg class="ic"><use href="#i-eye"/></svg></button></span>'; }).join('')
      + '<span class="map-act"><button class="btn sm" type="button" data-act="mapundo">Deshacer lo mío</button><button class="btn sm" type="button" data-act="mapzoom" data-v="-1" aria-label="Alejar">−</button><button class="btn sm" type="button" data-act="mapzoom" data-v="1" aria-label="Acercar">+</button><button class="btn sm" type="button" data-act="mapfit">Encuadrar</button></span></div>';
    if (layersOpen) h += '<div class="map-lpanel card">' + mp.layers.map(function(l, i){ return '<div class="line"><input class="field" data-maplname="' + attr(l.id) + '" value="' + attr(l.name) + '" aria-label="Nombre de la capa">' + (i ? '<button class="btn sm" type="button" data-act="maplup" data-v="' + attr(l.id) + '">Subir</button>' : '') + (admin && mp.layers.length > 1 ? '<button class="btn sm" type="button" data-act="mapldel" data-v="' + attr(l.id) + '">Borrar capa</button>' : '') + '</div>'; }).join('')
      + (mp.layers.length < 8 ? '<button class="btn sm" type="button" data-act="mapladd">Agregar capa</button>' : '') + '<p class="note">Las capas de abajo se dibujan primero. Ocultar una capa solo cambia lo que ves tú. Borrar una capa borra lo que tiene.</p></div>';
    bar.innerHTML = h;
  }

  /* ---------- Vista: zoom y desplazamiento ---------- */
  function V(){ return views[cur] || (views[cur] = {s:24, x:20, y:20}); }
  function fit(){
    if (!canvas) return; var wrap = canvas.parentNode, w = wrap.clientWidth || 360, top = canvas.getBoundingClientRect().top || 220;
    var hh = Math.max(320, Math.min(1400, (window.innerHeight || 800) - top - 16)), dpr = window.devicePixelRatio || 1;
    canvas.style.width = w + 'px'; canvas.style.height = hh + 'px'; canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr);
  }
  function frame(mp){ if (!canvas || !mp) return; var w = canvas.clientWidth || 360, h = canvas.clientHeight || 400, s = Math.max(4, Math.min(80, Math.min((w - 20) / mp.cols, (h - 20) / mp.rows))); views[mp.id] = {s:s, x:(w - mp.cols * s) / 2, y:(h - mp.rows * s) / 2}; }
  function zoomAt(f, cx, cy){ var v = V(), ns = Math.max(3, Math.min(160, v.s * f)); v.x = cx - (cx - v.x) * ns / v.s; v.y = cy - (cy - v.y) * ns / v.s; v.s = ns; paint(); }
  function toMap(px, py){ var v = V(); return [(px - v.x) / v.s, (py - v.y) / v.s]; }

  /* ---------- Pintar ---------- */
  function paint(){ if (!canvas || !document.contains(canvas)) return; var c = canvas.getContext && canvas.getContext('2d'); if (!c) return; var mp = maps[cur]; if (!mp) return; var dpr = canvas.width / (canvas.clientWidth || canvas.width); c.setTransform(dpr, 0, 0, dpr, 0, 0); draw(c, mp, V(), canvas.clientWidth, canvas.clientHeight, hidden[mp.id] || {}); if (drawing) strokeOn(c, drawing, V()); }
  function draw(c, mp, v, W, H, hid){
    c.fillStyle = OUT; c.fillRect(0, 0, W, H);
    c.fillStyle = PAPER; c.fillRect(v.x, v.y, mp.cols * v.s, mp.rows * v.s);
    gridOn(c, mp, v, W, H);
    mp.layers.forEach(function(l){ if (hid[l.id]) return; mp.strokes.forEach(function(k){ if (k.l === l.id) strokeOn(c, k, v); }); });
    c.strokeStyle = 'rgba(60,40,20,.6)'; c.lineWidth = 1.5; c.strokeRect(v.x, v.y, mp.cols * v.s, mp.rows * v.s);
  }
  function gridOn(c, mp, v, W, H){
    if (mp.grid === 'none' || v.s < 5) return;
    c.save(); c.beginPath(); c.rect(v.x, v.y, mp.cols * v.s, mp.rows * v.s); c.clip(); c.strokeStyle = GRID; c.lineWidth = 1; c.beginPath();
    var x0 = Math.max(0, Math.floor(-v.x / v.s)), x1 = Math.min(mp.cols, Math.ceil((W - v.x) / v.s)), y0 = Math.max(0, Math.floor(-v.y / v.s)), y1 = Math.min(mp.rows, Math.ceil((H - v.y) / v.s));
    if (mp.grid === 'square') {
      for (var x = x0; x <= x1; x++) { c.moveTo(v.x + x * v.s, v.y + y0 * v.s); c.lineTo(v.x + x * v.s, v.y + y1 * v.s); }
      for (var y = y0; y <= y1; y++) { c.moveTo(v.x + x0 * v.s, v.y + y * v.s); c.lineTo(v.x + x1 * v.s, v.y + y * v.s); }
    } else {
      var r = 1 / Math.sqrt(3), dy = 1.5 * r;
      for (var row = Math.floor(y0 / dy) - 1; row * dy <= y1 + 1; row++) for (var col = x0 - 1; col <= x1 + 1; col++) {
        var cx = col + (row % 2 ? 1 : 0.5), cy = row * dy + r;
        for (var i = 0; i < 6; i++) { var a = Math.PI / 180 * (60 * i - 90), px = v.x + (cx + r * Math.cos(a)) * v.s, py = v.y + (cy + r * Math.sin(a)) * v.s; if (i) c.lineTo(px, py); else c.moveTo(px, py); }
        c.closePath();
      }
    }
    c.stroke(); c.restore();
  }
  function strokeOn(c, k, v){
    var P = function(i){ return [v.x + k.pts[i] * v.s, v.y + k.pts[i + 1] * v.s]; };
    c.save(); c.strokeStyle = k.c; c.fillStyle = k.c; c.lineWidth = Math.max(1, k.w * v.s); c.lineCap = 'round'; c.lineJoin = 'round';
    if (k.k === 'text') { var p = P(0), fs = Math.max(6, (TEXTS[k.w] || k.w * 6) * v.s); c.font = '600 ' + fs + 'px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = Math.max(2, fs / 6); c.strokeStyle = 'rgba(243,233,210,.85)'; c.strokeText(k.t, p[0], p[1]); c.fillText(k.t, p[0], p[1]); }
    else if (k.k === 'rect') { var a = P(0), b = P(2), x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]), w = Math.abs(a[0] - b[0]), h = Math.abs(a[1] - b[1]); if (k.f) { c.globalAlpha = 0.35; c.fillRect(x, y, w, h); c.globalAlpha = 1; } c.strokeRect(x, y, w, h); }
    else { c.beginPath(); var q = P(0); c.moveTo(q[0], q[1]); if (k.pts.length === 2) c.lineTo(q[0] + 0.1, q[1]); for (var i = 2; i < k.pts.length; i += 2) { var pp = P(i); c.lineTo(pp[0], pp[1]); } c.stroke(); }
    c.restore();
  }

  /* ---------- Dedo y ratón ---------- */
  function snapPt(p, kind){ if (!tool.snap || maps[cur].grid === 'none') return p; if (kind === 'text') return [Math.floor(p[0]) + 0.5, Math.floor(p[1]) + 0.5]; return [Math.round(p[0]), Math.round(p[1])]; }
  function clampPt(p){ var mp = maps[cur]; return [Math.round(Math.max(0, Math.min(mp.cols, p[0])) * 100) / 100, Math.round(Math.max(0, Math.min(mp.rows, p[1])) * 100) / 100]; }
  function local(ev){ var r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; }
  function bind(){
    canvas.addEventListener('pointerdown', function(ev){
      ev.preventDefault(); try { canvas.setPointerCapture(ev.pointerId); } catch(e){}
      ptr[ev.pointerId] = local(ev);
      var ids = Object.keys(ptr);
      if (ids.length === 2) { drawing = null; erasing = null; var a = ptr[ids[0]], b = ptr[ids[1]]; gesture = {d:Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, cx:(a[0] + b[0]) / 2, cy:(a[1] + b[1]) / 2}; paint(); return; }
      if (ids.length > 2) return;
      var p = local(ev), m = toMap(p[0], p[1]);
      if (tool.k === 'pan' || ev.button === 1 || ev.button === 2) { gesture = {pan:true, px:p[0], py:p[1]}; return; }
      if (tool.k === 'text') { var t = clampPt(snapPt(m, 'text')); askText(t, p); return; }
      if (tool.k === 'erase') { erasing = {hits:{}}; eraseAt(m); return; }
      var s = clampPt(snapPt(m, tool.k));
      drawing = {k:tool.k, l:tool.layer, c:tool.c, w:tool.w, pts: tool.k === 'pen' ? [s[0], s[1]] : [s[0], s[1], s[0], s[1]]}; if (tool.k === 'rect' && tool.fill) drawing.f = 1;
      paint();
    });
    canvas.addEventListener('pointermove', function(ev){
      if (!ptr[ev.pointerId]) return;
      var p = local(ev); ptr[ev.pointerId] = p;
      var ids = Object.keys(ptr);
      if (gesture && !gesture.pan && ids.length === 2) { var a = ptr[ids[0]], b = ptr[ids[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, v = V(); v.x += cx - gesture.cx; v.y += cy - gesture.cy; zoomAt(d / gesture.d, cx, cy); gesture.d = d; gesture.cx = cx; gesture.cy = cy; return; }
      if (gesture && gesture.pan) { var v2 = V(); v2.x += p[0] - gesture.px; v2.y += p[1] - gesture.py; gesture.px = p[0]; gesture.py = p[1]; paint(); return; }
      var m = toMap(p[0], p[1]);
      if (erasing) { eraseAt(m); return; }
      if (!drawing) return;
      if (drawing.k === 'pen') { var q = clampPt(m), n = drawing.pts.length, dx = q[0] - drawing.pts[n - 2], dy = q[1] - drawing.pts[n - 1]; if (dx * dx + dy * dy < 0.01 || n >= 1180) return; drawing.pts.push(q[0], q[1]); }
      else { var e = clampPt(snapPt(m, drawing.k)); drawing.pts[2] = e[0]; drawing.pts[3] = e[1]; }
      paint();
    });
    var end = function(ev){
      delete ptr[ev.pointerId];
      if (gesture) { if (!Object.keys(ptr).length) gesture = null; return; }
      if (erasing) { var ids = Object.keys(erasing.hits); erasing = null; rmStrokes(maps[cur], ids); paint(); return; }
      if (!drawing) return; var k = drawing; drawing = null;
      if (k.k !== 'pen' && k.pts[0] === k.pts[2] && k.pts[1] === k.pts[3]) { paint(); return; }
      addStroke(maps[cur], k); paint();
    };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', function(ev){ ev.preventDefault(); var p = local(ev); zoomAt(ev.deltaY < 0 ? 1.15 : 1 / 1.15, p[0], p[1]); }, {passive:false});
    canvas.addEventListener('contextmenu', function(ev){ ev.preventDefault(); });
  }
  function segDist(px, py, ax, ay, bx, by){ var dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0; return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)); }
  function eraseAt(m){
    var mp = maps[cur], hid = hidden[mp.id] || {}, tol = Math.max(0.35, 10 / V().s), changed = false;
    mp.strokes.forEach(function(k){
      if (hid[k.l] || erasing.hits[k.id]) return;
      var hit = false, p = k.pts;
      if (k.k === 'text') { var fs = TEXTS[k.w] || 1; hit = Math.abs(m[0] - p[0]) < k.t.length * fs * 0.3 + tol && Math.abs(m[1] - p[1]) < fs * 0.6 + tol / 2; }
      else if (k.k === 'rect') { var x0 = Math.min(p[0], p[2]), x1 = Math.max(p[0], p[2]), y0 = Math.min(p[1], p[3]), y1 = Math.max(p[1], p[3]); hit = k.f ? m[0] >= x0 - tol && m[0] <= x1 + tol && m[1] >= y0 - tol && m[1] <= y1 + tol : Math.min(segDist(m[0], m[1], x0, y0, x1, y0), segDist(m[0], m[1], x1, y0, x1, y1), segDist(m[0], m[1], x1, y1, x0, y1), segDist(m[0], m[1], x0, y1, x0, y0)) < tol + k.w / 2; }
      else if (p.length === 2) hit = Math.hypot(m[0] - p[0], m[1] - p[1]) < tol;
      else for (var i = 0; i + 3 < p.length; i += 2) if (segDist(m[0], m[1], p[i], p[i + 1], p[i + 2], p[i + 3]) < tol + k.w / 2) { hit = true; break; }
      if (hit) { erasing.hits[k.id] = 1; changed = true; }
    });
    if (changed) { var c = canvas.getContext && canvas.getContext('2d'); if (c) { paint(); var v = V(); mp.strokes.forEach(function(k){ if (erasing.hits[k.id]) { c.save(); c.globalAlpha = 0.25; strokeOn(c, Object.assign({}, k, {c:'#ff3b30'}), v); c.restore(); } }); } }
  }
  function askText(pt, px){
    var box = $('#mapTxt'); if (!box) return; pendingText = pt;
    box.style.left = Math.max(4, Math.min((canvas.clientWidth || 300) - 250, px[0] - 120)) + 'px'; box.style.top = Math.max(4, px[1] - 52) + 'px';
    box.innerHTML = '<form data-form="maptext" class="map-txtf"><input class="field" name="t" maxlength="60" placeholder="Torre, puerta secreta…" aria-label="Texto para el mapa" autocomplete="off"><button class="btn main sm" type="submit">Poner</button><button class="btn sm" type="button" data-act="maptextno">×</button></form>';
    box.hidden = false; var i = box.querySelector('input'); if (i) i.focus();
  }

  /* ---------- Imagen para descargar ---------- */
  function png(mp){
    var s = Math.max(8, Math.min(32, Math.floor(4000 / Math.max(mp.cols, mp.rows)))), cv = document.createElement('canvas'); cv.width = mp.cols * s; cv.height = mp.rows * s;
    var c = cv.getContext && cv.getContext('2d'); if (!c) return;
    draw(c, mp, {s:s, x:0, y:0}, cv.width, cv.height, {});
    cv.toBlob(function(b){ if (!b) return; var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = (mp.name || 'mapa').replace(/[^\wáéíóúñü -]/gi, '').trim().replace(/\s+/g, '-').toLowerCase() + '.png'; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1500); }, 'image/png');
  }

  /* ---------- Eventos ---------- */
  function openMap(id){ load(id).then(function(mp){ if (!mp) { var meta = roomMeta(id); if (meta) { asked[id] = null; Sala.send({t:'map.get', id:id}); Sala.toast('Trayendo el mapa…'); } return; } cur = id; layersOpen = false; var box = document.getElementById('mesaMaps'); if (box) editor(box); }); }
  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('[data-act]'); if (!b || b.dataset.act.indexOf('map') !== 0) return;
    var a = b.dataset.act, mp = cur && maps[cur];
    if (a === 'mapnew') { newOpen = !newOpen; render(); }
    else if (a === 'mapopen') openMap(b.dataset.id);
    else if (a === 'mapback') { cur = null; canvas = null; render(); }
    else if (a === 'mapshare') load(b.dataset.id).then(function(m){ if (m && room()) { var copy = JSON.parse(JSON.stringify(m)); delete copy.by; delete copy.room; Sala.send({t:'map.save', map:copy}); Sala.toast('«' + m.name + '» ya está en la mesa.'); } });
    else if (a === 'mappng') load(b.dataset.id).then(function(m){ if (m) png(m); });
    else if (a === 'mapdel') {
      if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = '¿Seguro? Toca otra vez'; return; }
      if (b.dataset.room) Sala.send({t:'map.del', id:b.dataset.id});
      else { delete maps[b.dataset.id]; idbDel('map:' + b.dataset.id); setIndex(index().filter(function(x){ return x.id !== b.dataset.id; })); render(); }
    }
    else if (!mp) return;
    else if (a === 'maptool') { tool.k = b.dataset.v; toolbar(); }
    else if (a === 'mapcolor') { tool.c = b.dataset.v; if (tool.k === 'pan' || tool.k === 'erase') tool.k = 'pen'; toolbar(); }
    else if (a === 'mapw') { tool.w = +b.dataset.v; toolbar(); }
    else if (a === 'maplayer') { tool.layer = b.dataset.v; var hd = hidden[mp.id] = hidden[mp.id] || {}; delete hd[tool.layer]; toolbar(); paint(); }
    else if (a === 'mapeye') { var hh = hidden[mp.id] = hidden[mp.id] || {}; hh[b.dataset.v] = !hh[b.dataset.v]; toolbar(); paint(); }
    else if (a === 'maplayers') { layersOpen = !layersOpen; toolbar(); }
    else if (a === 'mapladd') { var n = 1; while (mp.layers.some(function(l){ return l.id === 'l' + n; })) n++; setMeta(mp, {layers:mp.layers.concat([{id:'l' + n, name:'Capa ' + n}])}); tool.layer = 'l' + n; }
    else if (a === 'mapldel') { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = '¿Borrar con lo que tiene?'; return; } setMeta(mp, {layers:mp.layers.filter(function(l){ return l.id !== b.dataset.v; })}); }
    else if (a === 'maplup') { var L = mp.layers.slice(), i = L.findIndex(function(l){ return l.id === b.dataset.v; }); if (i > 0) { var t = L[i - 1]; L[i - 1] = L[i]; L[i] = t; setMeta(mp, {layers:L}); } }
    else if (a === 'mapundo') undo(mp);
    else if (a === 'mapzoom') zoomAt(+b.dataset.v > 0 ? 1.3 : 1 / 1.3, (canvas.clientWidth || 300) / 2, (canvas.clientHeight || 300) / 2);
    else if (a === 'mapfit') { frame(mp); paint(); }
    else if (a === 'maptextno') { $('#mapTxt').hidden = true; pendingText = null; }
  });
  document.addEventListener('submit', function(ev){
    var f = ev.target, k = f.dataset && f.dataset.form; if (k !== 'mapnew' && k !== 'maptext') return; ev.preventDefault();
    if (k === 'mapnew') { var mp = newMap(f.elements.name.value.trim(), f.elements.size.value, f.elements.grid.value); newOpen = false; cur = mp.id; var box = document.getElementById('mesaMaps'); if (box) editor(box); return; }
    var t = f.elements.t.value.trim(), m = maps[cur]; $('#mapTxt').hidden = true;
    if (t && m && pendingText) addStroke(m, {k:'text', l:tool.layer, c:tool.c, w:tool.w, pts:pendingText, t:t});
    pendingText = null;
  });
  document.addEventListener('change', function(ev){
    var t = ev.target, mp = cur && maps[cur]; if (!mp) return;
    if (t.id === 'mapSnap') tool.snap = t.checked;
    else if (t.id === 'mapFill') tool.fill = t.checked;
    else if (t.id === 'mapName' && t.value.trim()) setMeta(mp, {name:t.value.trim()});
    else if (t.id === 'mapGrid') setMeta(mp, {grid:t.value});
    else if (t.dataset && t.dataset.maplname && t.value.trim()) setMeta(mp, {layers:mp.layers.map(function(l){ return l.id === t.dataset.maplname ? {id:l.id, name:t.value.trim()} : l; })});
  });
  window.addEventListener('resize', function(){ if (cur && canvas && visible()) { fit(); paint(); } });

  return {render:render, png:png, _maps:function(){ return maps; }, _open:openMap, _tool:tool};
})();
