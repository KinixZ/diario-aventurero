/* ==================== MAPAS: TABLERO VIRTUAL ==================== */
/* Lienzos con cuadrícula, capas, fichas y niebla. Tres modos:
   Jugar   — mueves tu ficha (el DM, todas) y ves la distancia en metros; mantén presionado para señalar un punto.
   Dibujar — lápiz, líneas, rectángulos y texto por capas, como antes.
   Niebla  — solo el DM: arrastra para descubrir o cubrir casillas.
   En una campaña todo viaja por el servidor; cada teléfono guarda su copia (IndexedDB) para verla sin conexión.
   Fuera de una campaña dibujas y pones fichas solo en tu copia. */
var Mapas = (function(){
  var esc = function(s){ return Render5e.esc(s == null ? '' : s); }, attr = function(s){ return Render5e.attr(s == null ? '' : s); };
  var $ = function(s, r){ return (r || document).querySelector(s); };
  var IDX = 'diario-mapas', PAPER = '#f3e9d2', OUT = '#1c1512', GRID = 'rgba(80,58,34,.28)';
  var COLORS = [['#2b1d12','Tinta'],['#8c2626','Rojo'],['#2f5d8a','Agua'],['#3f6b3a','Bosque'],['#b08a3e','Oro'],['#6a3fa0','Magia'],['#7b7468','Piedra'],['#ffffff','Blanco']];
  var TOKCOL = ['#8c2626','#2f5d8a','#3f6b3a','#b08a3e','#6a3fa0','#e07a2e','#2a8c86','#7b7468'];
  var WIDTHS = [[0.06,'Fino'],[0.14,'Medio'],[0.32,'Grueso']], TEXTS = {0.06:0.7, 0.14:1.1, 0.32:1.8};
  var SIZES = [['24x18','Pequeño · 24 × 18'],['40x30','Mediano · 40 × 30'],['60x45','Grande · 60 × 45'],['100x75','Enorme · 100 × 75']];
  var DRAW_TOOLS = [['pen','Lápiz','i-brush'],['line','Línea','i-line'],['rect','Rectángulo','i-rect'],['text','Texto','i-text'],['erase','Borrar','i-eraser']];
  var TSIZE = [[1,'Mediano (1 casilla)'],[2,'Grande (2 × 2)'],[3,'Enorme (3 × 3)'],[4,'Gargantuesco (4 × 4)']];
  var maps = {}, cur = null, mode = 'jugar', tool = {k:'pen', c:COLORS[0][0], w:0.14, snap:true, fill:false, layer:null, fogV:1}, hidden = {}, views = {}, asked = {};
  var newOpen = false, layersOpen = false, setOpen = false, addOpen = false, pendingText = null, selTok = null, pings = [], imgs = {}, fogCache = {}, newImg = null, busyUp = false;
  var waitOpen = null, canvas = null, ptr = {}, gesture = null, drawing = null, erasing = null, drag = null, fogDrag = null, press = null, raf = 0;

  /* ---------- Guardado en el dispositivo ---------- */
  function idb(){ return new Promise(function(res, rej){ var r = indexedDB.open('diario5e', 2); r.onupgradeneeded = function(){ if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); }; r.onsuccess = function(){ res(r.result); }; r.onerror = function(){ rej(r.error); }; }); }
  function idbGet(k){ return idb().then(function(db){ return new Promise(function(res){ var q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = function(){ res(q.result); }; q.onerror = function(){ res(null); }; }); }).catch(function(){ return null; }); }
  function idbPut(k, v){ return idb().then(function(db){ return new Promise(function(res){ var t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = function(){ res(true); }; t.onerror = function(){ res(false); }; }); }).catch(function(){ return false; }); }
  function idbDel(k){ return idb().then(function(db){ return new Promise(function(res){ var t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = function(){ res(true); }; }); }).catch(function(){ return false; }); }
  function index(){ try { return JSON.parse(localStorage.getItem(IDX) || '[]'); } catch(e){ return []; } }
  function setIndex(a){ try { localStorage.setItem(IDX, JSON.stringify(a)); } catch(e){} }
  var saveT = {};
  function norm(mp){ if (!mp.tokens) mp.tokens = []; if (!mp.fog) mp.fog = {on:false, cells:''}; if (!mp.layers || !mp.layers.length) mp.layers = [{id:'l1', name:'Terreno'}]; if (!mp.strokes) mp.strokes = []; return mp; }
  function keep(mp){
    norm(mp); maps[mp.id] = mp;
    var ix = index().filter(function(x){ return x.id !== mp.id; });
    ix.unshift({id:mp.id, name:mp.name, cols:mp.cols, rows:mp.rows, n:mp.strokes.length, t:mp.tokens.length, updated:mp.updated || Date.now(), room:mp.room || null});
    ix.sort(function(a, b){ return (b.updated || 0) - (a.updated || 0); }); setIndex(ix.slice(0, 120));
    clearTimeout(saveT[mp.id]); saveT[mp.id] = setTimeout(function(){ idbPut('map:' + mp.id, mp); }, 600);
  }
  function load(id){ if (maps[id]) return Promise.resolve(maps[id]); return idbGet('map:' + id).then(function(m){ if (m) maps[id] = norm(m); return m; }); }

  /* ---------- Campaña ---------- */
  function room(){ return window.Sala && Sala.status() === 'on' ? Sala.room() : null; }
  function roomMeta(id){ var r = room(); return r && (r.maps || []).filter(function(m){ return m.id === id; })[0]; }
  var fresh = {}; // mapas recién creados en la campaña, antes de que llegue el estado
  function shared(id){ if (roomMeta(id)) { delete fresh[id]; return true; } return !!(fresh[id] && room() && Date.now() - fresh[id] < 20000); }
  function me(){ var r = room(); return r ? r.you : 'yo'; }
  function isDm(){ var r = room(); return !!r && r.role === 'dm'; }
  function canAdmin(mp){ return !shared(mp.id) || isDm() || mp.by === me(); }
  function master(mp){ return !shared(mp.id) || isDm(); } // niebla, fichas de enemigos, ocultar
  function mine(t){ var mp = maps[cur]; return !mp || !shared(mp.id) || isDm() || t.by === me() || t.ref === me(); }
  function visible(){ var c = document.getElementById('combat'); return c && !c.hidden && c.getAttribute('data-tab') === 'mapas'; }
  function repaintIfCur(id){ if (cur === id) { paint(); tokPanel(); } }
  if (window.Sala) {
    Sala.on('state', function(r){
      (r.maps || []).forEach(function(m){
        var have = maps[m.id] || index().filter(function(x){ return x.id === m.id; })[0];
        if ((!have || (have.updated || 0) < m.updated) && asked[m.id] !== m.updated) { asked[m.id] = m.updated; Sala.send({t:'map.get', id:m.id}); }
      });
      if (cur && maps[cur] && maps[cur].room && !roomMeta(cur) && maps[cur].room === r.code) { var gone = maps[cur]; cur = null; canvas = null; if (visible()) { render(); Sala.toast('El DM ocultó «' + gone.name + '».'); } }
      if (visible() && !cur) render();
      if (visible() && cur) { toolbar(); paint(); }
      badge();
    });
    Sala.on('map', function(m){ var mp = norm(m.map); mp.room = room() && room().code; keep(mp); if (waitOpen === mp.id) { waitOpen = null; openMap(mp.id); return; } if (cur === mp.id) { toolbar(); paint(); } else if (visible() && !cur) render(); });
    Sala.on('map.add', function(m){ var mp = maps[m.id]; if (!mp) return; mp.strokes.push(m.stroke); mp.updated = m.updated; keep(mp); if (cur === m.id) paint(); });
    Sala.on('map.rm', function(m){ var mp = maps[m.id]; if (!mp) return; var set = {}; m.sids.forEach(function(x){ set[x] = 1; }); mp.strokes = mp.strokes.filter(function(k){ return !set[k.id]; }); mp.updated = m.updated; keep(mp); if (cur === m.id) paint(); });
    Sala.on('map.meta', function(m){ var mp = maps[m.id]; if (!mp) return; mp.name = m.name; mp.grid = m.grid; mp.layers = m.layers; var ok = {}; m.layers.forEach(function(l){ ok[l.id] = 1; }); mp.strokes = mp.strokes.filter(function(k){ return ok[k.l]; }); mp.updated = m.updated; keep(mp); if (cur === m.id) { toolbar(); paint(); } });
    Sala.on('map.bg', function(m){ var mp = maps[m.id]; if (!mp) return; mp.bg = m.bg; mp.updated = m.updated; keep(mp); if (cur === m.id) { toolbar(); paint(); } });
    Sala.on('map.fog', function(m){ var mp = maps[m.id]; if (!mp) return; mp.fog = m.fog; mp.updated = m.updated; keep(mp); if (cur === m.id) { toolbar(); paint(); } });
    Sala.on('tok', function(m){ var mp = maps[m.id]; if (!mp) return; var i = mp.tokens.findIndex(function(t){ return t.id === m.tok.id; }); if (i >= 0) mp.tokens[i] = m.tok; else mp.tokens.push(m.tok); mp.updated = m.updated || mp.updated; keep(mp); if (drag && drag.tok.id === m.tok.id) return; repaintIfCur(m.id); });
    Sala.on('tok.del', function(m){ var mp = maps[m.id]; if (!mp) return; mp.tokens = mp.tokens.filter(function(t){ return t.id !== m.tid; }); if (selTok === m.tid) selTok = null; keep(mp); repaintIfCur(m.id); });
    Sala.on('ping', function(m){ if (cur !== m.id) return; pings.push({x:m.x, y:m.y, name:m.name, color:m.color, t:Date.now()}); animate(); });
    Sala.on('scene', function(m){
      if (isDm()) return;
      var cb = document.getElementById('combat'), open = cb && !cb.hidden;
      if (open && (visible() || !document.querySelector('#combat .mesa-p:focus-within'))) { if (window.Mesa) Mesa.show('mapas'); openMap(m.id); Sala.toast('El DM les muestra «' + m.name + '».'); }
      else Sala.toast('El DM les muestra «' + m.name + '».', {act:'mapgoscene', v:m.id, label:'Ver mapa'});
      badge();
    });
    Sala.on('left', function(){ if (cur && maps[cur] && maps[cur].room) { cur = null; canvas = null; } if (visible()) render(); });
  }
  function badge(){ var r = room(), b = document.querySelector('#mesaTabs [data-v="mapas"] .badge'); if (b) b.hidden = !(r && r.scene && !(visible() && cur === r.scene)); }

  /* ---------- Operaciones (en la campaña van al servidor; si no, a tu copia) ---------- */
  function uid(p){ return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function newMap(o){
    var wh = String(o.size || '40x30').split('x').map(Number);
    var mp = {id:uid('mp'), name:o.name || 'Mapa nuevo', cols:o.cols || wh[0], rows:o.rows || wh[1], grid:o.grid || 'square', layers:[{id:'l1', name:'Terreno'},{id:'l2', name:'Paredes y puertas'},{id:'l3', name:'Notas'}], strokes:[], tokens:[], fog:{on:false, cells:''}, bg:null, created:Date.now(), updated:Date.now(), by:'yo', hidden:!!o.hidden};
    if (isDm()) mp.layers.push({id:'ldm', name:'Secretos del DM', dm:true});
    if (room()) { Sala.send({t:'map.save', map:mp}); mp.room = room().code; mp.by = me(); fresh[mp.id] = Date.now(); }
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
  function tokAdd(mp, t){
    if (shared(mp.id)) { Sala.send({t:'tok.add', id:mp.id, tok:t}); return; }
    t.id = uid('t'); t.by = 'yo'; mp.tokens.push(t); mp.updated = Date.now(); keep(mp); selTok = t.id; paint(); tokPanel();
  }
  function tokMove(mp, t, x, y){
    if (shared(mp.id)) { t.x = x; t.y = y; paint(); Sala.send({t:'tok.move', id:mp.id, tid:t.id, x:x, y:y}); return; }
    t.x = x; t.y = y; mp.updated = Date.now(); keep(mp); paint();
  }
  function tokSet(mp, t, o){
    if (shared(mp.id)) { o.t = 'tok.set'; o.id = mp.id; o.tid = t.id; Sala.send(o); return; }
    Object.keys(o).forEach(function(k){ t[k] = o[k]; }); mp.updated = Date.now(); keep(mp); paint(); tokPanel();
  }
  function tokDel(mp, t){
    if (shared(mp.id)) { Sala.send({t:'tok.del', id:mp.id, tid:t.id}); selTok = null; return; }
    mp.tokens = mp.tokens.filter(function(x){ return x !== t; }); selTok = null; keep(mp); paint(); tokPanel();
  }
  function fogDo(mp, msg){
    if (shared(mp.id)) { msg.id = mp.id; Sala.send(msg); return; }
    var bits = fogBits(mp).slice();
    if (msg.t === 'fog.on') mp.fog.on = !!msg.value;
    else if (msg.t === 'fog.all') bits.fill(msg.value ? 255 : 0);
    else { var r = msg.rect; for (var y = Math.max(0, Math.min(r[1], r[3])); y <= Math.min(mp.rows - 1, Math.max(r[1], r[3])); y++) for (var x = Math.max(0, Math.min(r[0], r[2])); x <= Math.min(mp.cols - 1, Math.max(r[0], r[2])); x++) { var i = y * mp.cols + x; if (msg.value) bits[i >> 3] |= 1 << (i & 7); else bits[i >> 3] &= ~(1 << (i & 7)); } }
    if (msg.t !== 'fog.on') mp.fog.cells = b64(bits);
    mp.updated = Date.now(); keep(mp); toolbar(); paint();
  }
  function ping(mp, p){
    var col = mp && room() ? (myTok(mp) || {}).color || '#ffd66e' : '#ffd66e';
    if (shared(mp.id)) Sala.send({t:'map.ping', id:mp.id, x:p[0], y:p[1], color:col});
    else { pings.push({x:p[0], y:p[1], name:'', color:col, t:Date.now()}); animate(); }
  }

  /* ---------- Niebla: un bit por casilla (1 = descubierta) ---------- */
  function b64(u8){ var s = ''; for (var i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); }
  function fogBits(mp){
    var n = Math.ceil(mp.cols * mp.rows / 8), c = mp.fog && mp.fog.cells || '', k = mp.id + ':' + c.length + ':' + c.slice(0, 40) + c.slice(-40);
    if (fogCache[mp.id] && fogCache[mp.id].k === k) return fogCache[mp.id].b;
    var b = new Uint8Array(n);
    if (c) { try { var s = atob(c); for (var i = 0; i < Math.min(n, s.length); i++) b[i] = s.charCodeAt(i); } catch(e){} }
    fogCache[mp.id] = {k:k, b:b}; return b;
  }
  function seen(bits, mp, x, y){ var i = y * mp.cols + x; return (bits[i >> 3] >> (i & 7)) & 1; }

  /* ---------- Lista de mapas ---------- */
  function render(){
    var box = document.getElementById('mesaMaps'); if (!box) return;
    if (cur) { if (!$('#mapCv', box)) editor(box); else { toolbar(); fit(); paint(); } return; }
    var r = room(), ix = index(), inRoom = r ? (r.maps || []) : [], ids = {}, dm = isDm();
    // si el DM tiene un mapa en pantalla y acabas de abrir la pestaña, ábrelo
    if (r && r.scene && !dm && !render.sceneOpened) { render.sceneOpened = r.scene; openMap(r.scene); return; }
    inRoom.forEach(function(m){ ids[m.id] = 1; });
    var h = '<div class="map-head"><div><b>Mapas</b><p class="note">' + (r ? (dm ? 'Prepara mapas ocultos y muéstralos cuando lleguen. Los jugadores mueven sus fichas; tú, todas.' : 'Pon tu ficha y muévela. Lo que dibujen aquí lo ven todos.') : 'Sin campaña, dibujas solo en tu copia.') + '</p></div><button class="btn main" type="button" data-act="mapnew">' + (newOpen ? 'Cerrar' : 'Nuevo mapa') + '</button></div>';
    if (newOpen) h += '<form class="map-new card" data-form="mapnew"><label class="fl">Nombre<input class="field" name="name" placeholder="Las minas de Phandelver" autocomplete="off"></label>'
      + '<div class="seg sm map-src" role="group" aria-label="Origen"><button type="button" data-act="mapsrc" data-v="blank" aria-pressed="' + !newImg + '">En blanco</button><button type="button" data-act="mapsrc" data-v="img" aria-pressed="' + !!newImg + '">Desde una imagen</button></div>'
      + (newImg ? '<div class="map-imgnew"><label class="btn pickbtn">' + (newImg.url ? 'Cambiar imagen' : 'Elegir imagen') + '<input type="file" id="mapNewImg" accept="image/*"></label>' + (newImg.url ? '<img alt="" src="' + attr(newImg.url) + '">' : '') + '<label class="fl">Casillas a lo ancho<input class="field" name="cols" inputmode="numeric" value="' + (newImg.cols || 30) + '" id="mapNewCols"></label><p class="note" id="mapNewRows">' + (newImg.w ? 'Quedará de ' + (newImg.cols || 30) + ' × ' + Math.max(8, Math.round((newImg.cols || 30) * newImg.h / newImg.w)) + ' casillas. Cuenta los cuadros de la imagen para que la cuadrícula coincida.' : 'Sube el mapa (de un libro, de Dungeondraft, una foto…).') + '</p></div>'
        : '<div class="two"><label class="fl">Tamaño (casillas)<select class="field" name="size">' + SIZES.map(function(x, i){ return '<option value="' + x[0] + '"' + (i === 1 ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label><label class="fl">Cuadrícula<select class="field" name="grid"><option value="square">Cuadrada</option><option value="hex">Hexagonal</option><option value="none">Sin cuadrícula</option></select></label></div>')
      + (dm ? '<label class="toggle"><input type="checkbox" name="hidden" checked> Oculto para los jugadores hasta que lo muestres</label>' : '')
      + '<button class="btn main" type="submit"' + (busyUp || (newImg && !newImg.url) ? ' disabled' : '') + '>' + (busyUp ? 'Subiendo…' : r ? 'Crear en la campaña' : 'Crear en mi diario') + '</button></form>';
    if (r) h += '<div class="group-h">En la campaña</div>' + (inRoom.length ? '<div class="map-grid">' + inRoom.map(function(m){ return card(m, true); }).join('') + '</div>' : '<p class="note">Todavía no hay mapas en esta campaña.</p>');
    var mine2 = ix.filter(function(x){ return !ids[x.id]; });
    if (mine2.length || !r) h += '<div class="group-h">' + (r ? 'Guardados en este teléfono' : 'Mis mapas') + '</div>' + (mine2.length ? '<div class="map-grid">' + mine2.map(function(m){ return card(m, false); }).join('') + '</div>' : '<p class="note">Aún no tienes mapas. Crea uno para la zona donde están.</p>');
    box.innerHTML = h;
  }
  function card(m, inRoom){
    var r = room(), scene = r && r.scene === m.id;
    return '<div class="map-card card' + (m.hidden ? ' prep' : '') + (scene ? ' scene' : '') + '"><button type="button" class="map-open" data-act="mapopen" data-id="' + attr(m.id) + '"><svg class="ic"><use href="#i-map"/></svg><span><b>' + esc(m.name) + '</b><small>' + m.cols + ' × ' + m.rows + ' casillas' + (m.tokens ? ' · ' + m.tokens + ' ficha' + (m.tokens === 1 ? '' : 's') : m.t ? ' · ' + m.t + ' fichas' : '') + (m.bg ? ' · con imagen' : '') + (m.updated ? ' · ' + new Date(m.updated).toLocaleDateString('es-MX', {day:'numeric', month:'short'}) : '') + (!inRoom && m.room ? ' · de la campaña ' + esc(m.room) : '') + '</small>' + (scene ? '<i class="tag new">en pantalla</i>' : '') + (m.hidden ? '<i class="tag">oculto</i>' : '') + '</span></button>'
      + '<div class="map-btns">' + (inRoom && isDm() ? '<button class="btn sm' + (scene ? '' : ' main') + '" type="button" data-act="mapscene" data-id="' + attr(m.id) + '">' + (scene ? 'En pantalla' : 'Mostrar a todos') + '</button>' : '') + (!inRoom && r ? '<button class="btn sm" type="button" data-act="mapshare" data-id="' + attr(m.id) + '">Llevar a la campaña</button>' : '') + '<button class="btn sm" type="button" data-act="mappng" data-id="' + attr(m.id) + '">Imagen</button><button class="btn sm" type="button" data-act="mapdel" data-id="' + attr(m.id) + '" data-room="' + (inRoom ? 1 : '') + '">' + (inRoom ? 'Quitar' : 'Borrar') + '</button></div></div>';
  }

  /* ---------- Editor ---------- */
  function editor(box){
    box.innerHTML = '<div class="map-ed"><div class="map-bar" id="mapBar"></div><div class="map-wrap"><canvas id="mapCv" aria-label="Mapa: arrastra tu ficha, mantén presionado para señalar; con dos dedos mueves y haces zoom"></canvas><div class="map-txt" id="mapTxt" hidden></div><div class="map-tok" id="mapTok" hidden></div></div></div>';
    canvas = $('#mapCv', box); bind(); toolbar(); fit(); frame(maps[cur]); var mt = !master(maps[cur]) && myTok(maps[cur]); if (mt) focus(maps[cur], mt); paint(); tokPanel(); badge();
  }
  function myTok(mp){ var id = me(), sh = shared(mp.id); return mp.tokens.filter(function(t){ return t.kind === 'pc' && (sh ? t.ref === id : t.mine) && !t.comp; })[0]; }
  function toolbar(){
    var bar = $('#mapBar'), mp = maps[cur]; if (!bar || !mp) return;
    if (!tool.layer || !mp.layers.some(function(l){ return l.id === tool.layer; })) tool.layer = mp.layers[0].id;
    var hid = hidden[mp.id] || {}, admin = canAdmin(mp), sh = shared(mp.id), dm = master(mp), r = room(), meta = roomMeta(mp.id), scene = r && r.scene === mp.id;
    if (mode === 'niebla' && !dm) mode = 'jugar';
    var h = '<div class="map-top"><button class="btn sm" type="button" data-act="mapback">Mapas</button>' + (admin ? '<input class="field map-name" id="mapName" value="' + attr(mp.name) + '" aria-label="Nombre del mapa">' : '<b class="map-name ro">' + esc(mp.name) + '</b>')
      + '<span class="map-where">' + (scene ? '<i class="tag new">en pantalla</i>' : '') + (meta && meta.hidden ? '<i class="tag">oculto</i>' : '') + (sh ? '' : 'Solo tu copia') + '</span>' + (admin ? '<button class="icon-btn sm" type="button" data-act="mapset" aria-expanded="' + setOpen + '" aria-label="Ajustes del mapa" title="Ajustes del mapa"><svg class="ic"><use href="#i-gear"/></svg></button>' : '') + '</div>';
    h += '<div class="map-modes"><div class="seg" role="tablist" aria-label="Modo"><button type="button" data-act="mapmode" data-v="jugar" aria-pressed="' + (mode === 'jugar') + '"><svg class="ic"><use href="#i-token"/></svg>Jugar</button><button type="button" data-act="mapmode" data-v="dibujar" aria-pressed="' + (mode === 'dibujar') + '"><svg class="ic"><use href="#i-brush"/></svg>Dibujar</button>' + (dm ? '<button type="button" data-act="mapmode" data-v="niebla" aria-pressed="' + (mode === 'niebla') + '"><svg class="ic"><use href="#i-fog"/></svg>Niebla</button>' : '') + '</div>'
      + '<span class="map-act"><button class="btn sm" type="button" data-act="mapzoom" data-v="-1" aria-label="Alejar">−</button><button class="btn sm" type="button" data-act="mapzoom" data-v="1" aria-label="Acercar">+</button><button class="btn sm" type="button" data-act="mapfit" aria-label="Encuadrar el mapa" title="Encuadrar">⤢</button></span></div>';
    if (setOpen && admin) h += setHtml(mp, dm, sh);
    if (mode === 'jugar') {
      var mt = myTok(mp), canPut = !(isDm() && sh) && (!!(window.Sala && Sala.summary && Sala.summary()) || !sh);
      h += '<div class="map-opts">' + (canPut ? '<button class="btn main sm" type="button" data-act="mapputme">' + (mt ? 'Traer mi ficha aquí' : 'Poner mi ficha') + '</button>' + (mt ? '<button class="btn sm" type="button" data-act="mapfindme">Ir a mi ficha</button>' : '') : '') + '<button class="btn sm" type="button" data-act="mapadd" aria-expanded="' + addOpen + '">' + (dm ? 'Agregar ficha' : 'Otra ficha') + '</button>' + (r && isDm() && !scene ? '<button class="btn sm" type="button" data-act="mapscene" data-id="' + attr(mp.id) + '">Mostrar a todos</button>' : '')
        + '<span class="note map-hint">Arrastra una ficha para moverla · mantén presionado para señalar</span></div>';
      if (addOpen) h += addHtml(mp, dm);
    } else if (mode === 'dibujar') {
      h += '<div class="map-tools" role="group" aria-label="Herramienta"><button type="button" data-act="maptool" data-v="pan" aria-pressed="' + (tool.k === 'pan') + '" title="Mover el mapa"><svg class="ic"><use href="#i-hand"/></svg><span>Mover</span></button>' + DRAW_TOOLS.map(function(t){ return '<button type="button" data-act="maptool" data-v="' + t[0] + '" aria-pressed="' + (tool.k === t[0]) + '" title="' + t[1] + '"><svg class="ic"><use href="#' + t[2] + '"/></svg><span>' + t[1] + '</span></button>'; }).join('') + '</div>';
      h += '<div class="map-opts"><div class="swatches" role="group" aria-label="Color">' + COLORS.map(function(c){ return '<button type="button" class="sw" data-act="mapcolor" data-v="' + c[0] + '" style="background:' + c[0] + '" aria-pressed="' + (tool.c === c[0]) + '" aria-label="' + c[1] + '"></button>'; }).join('') + '</div>'
        + '<div class="map-seg" role="group" aria-label="Grosor">' + WIDTHS.map(function(x){ return '<button type="button" data-act="mapw" data-v="' + x[0] + '" aria-pressed="' + (tool.w === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>'
        + '<label class="toggle"><input type="checkbox" id="mapSnap"' + (tool.snap ? ' checked' : '') + '> Ajustar a la cuadrícula</label>'
        + '<label class="toggle"><input type="checkbox" id="mapFill"' + (tool.fill ? ' checked' : '') + '> Rellenar rectángulos</label><button class="btn sm" type="button" data-act="mapundo">Deshacer lo mío</button></div>';
      h += '<div class="map-layers"><button type="button" class="map-lbtn" data-act="maplayers" aria-expanded="' + layersOpen + '"><svg class="ic"><use href="#i-layers"/></svg>Capas</button>' + mp.layers.map(function(l){ return '<span class="map-layer' + (tool.layer === l.id ? ' on' : '') + (hid[l.id] ? ' off' : '') + (l.dm ? ' secret' : '') + '"><button type="button" data-act="maplayer" data-v="' + attr(l.id) + '" aria-pressed="' + (tool.layer === l.id) + '">' + esc(l.name) + (l.dm ? ' <small>solo DM</small>' : '') + '</button><button type="button" class="eye" data-act="mapeye" data-v="' + attr(l.id) + '" aria-pressed="' + !hid[l.id] + '" aria-label="' + (hid[l.id] ? 'Mostrar ' : 'Ocultar ') + attr(l.name) + '"><svg class="ic"><use href="#i-eye"/></svg></button></span>'; }).join('') + '</div>';
      if (layersOpen) h += '<div class="map-lpanel card">' + mp.layers.map(function(l, i){ return '<div class="line"><input class="field" data-maplname="' + attr(l.id) + '" value="' + attr(l.name) + '" aria-label="Nombre de la capa">' + (dm && sh ? '<label class="toggle"><input type="checkbox" data-maplsecret="' + attr(l.id) + '"' + (l.dm ? ' checked' : '') + '> Solo DM</label>' : '') + (i ? '<button class="btn sm" type="button" data-act="maplup" data-v="' + attr(l.id) + '">Subir</button>' : '') + (admin && mp.layers.length > 1 ? '<button class="btn sm" type="button" data-act="mapldel" data-v="' + attr(l.id) + '">Borrar capa</button>' : '') + '</div>'; }).join('')
        + (mp.layers.length < 8 ? '<button class="btn sm" type="button" data-act="mapladd">Agregar capa</button>' : '') + '<p class="note">Las capas de abajo se dibujan primero. Ocultar una capa solo cambia lo que ves tú.' + (dm && sh ? ' Las capas «Solo DM» no las ven los jugadores: úsalas para trampas, puertas secretas y notas.' : '') + '</p></div>';
    } else {
      var fo = mp.fog && mp.fog.on;
      h += '<div class="map-opts fog-opts"><label class="toggle big"><input type="checkbox" id="mapFogOn"' + (fo ? ' checked' : '') + '> Niebla activada</label><div class="seg sm" role="group" aria-label="Al arrastrar"><button type="button" data-act="mapfogv" data-v="1" aria-pressed="' + (tool.fogV === 1) + '">Descubrir</button><button type="button" data-act="mapfogv" data-v="0" aria-pressed="' + (tool.fogV === 0) + '">Cubrir</button></div><button class="btn sm" type="button" data-act="mapfogall" data-v="1">Descubrir todo</button><button class="btn sm" type="button" data-act="mapfogall" data-v="0">Cubrir todo</button><span class="note map-hint">' + (fo ? 'Arrastra sobre el mapa para ' + (tool.fogV ? 'descubrir' : 'cubrir') + ' un área. Tú la ves translúcida; los jugadores, negra.' : 'Actívala para que los jugadores solo vean lo descubierto.') + '</span></div>';
    }
    bar.innerHTML = h;
  }
  function setHtml(mp, dm, sh){
    var meta = roomMeta(mp.id), bg = mp.bg;
    return '<div class="map-set card"><div class="two"><label class="fl">Cuadrícula<select class="field" id="mapGrid">' + [['square','Cuadrada'],['hex','Hexagonal'],['none','Sin cuadrícula']].map(function(x){ return '<option value="' + x[0] + '"' + (mp.grid === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>'
      + '<div class="fl"><span>Imagen de fondo</span><div class="row" style="gap:6px;flex-wrap:wrap"><label class="btn sm pickbtn">' + (busyUp ? 'Subiendo…' : bg ? 'Cambiar' : 'Subir imagen') + '<input type="file" id="mapBgFile" accept="image/*"></label>' + (bg ? '<button class="btn sm" type="button" data-act="mapbgx">Quitar</button>' : '') + '</div></div></div>'
      + (bg ? '<label class="fl">Opacidad del fondo<input type="range" id="mapBgOp" min="0.2" max="1" step="0.1" value="' + (bg.op || 1) + '"></label>' : '')
      + (dm && sh ? '<label class="toggle"><input type="checkbox" id="mapHide"' + (meta && meta.hidden ? ' checked' : '') + '> Oculto para los jugadores</label>' : '')
      + '<p class="note">La imagen se estira sobre todas las casillas (' + mp.cols + ' × ' + mp.rows + '). Si la cuadrícula no coincide, crea el mapa «Desde una imagen» con las casillas que tiene a lo ancho.</p></div>';
  }
  function addHtml(mp, dm){
    var r = room(), onMap = {}; mp.tokens.forEach(function(t){ if (t.ref) onMap[t.ref] = 1; });
    var h = '<form class="map-add card" data-form="maptok">';
    if (dm && r) {
      var pcs = r.members.filter(function(m){ return m.role !== 'dm' && !onMap[m.id]; }), npcs = (r.npcs || []).filter(function(n){ return !onMap[n.id]; });
      h += '<label class="fl">Quién<select class="field" name="who"><option value="obj">Objeto o PNJ nuevo…</option>' + (npcs.length ? '<optgroup label="Del combate">' + npcs.map(function(n){ return '<option value="npc:' + attr(n.id) + '">' + esc(n.name) + (n.hidden ? ' (oculto)' : '') + '</option>'; }).join('') + '</optgroup>' : '') + (pcs.length ? '<optgroup label="Jugadores">' + pcs.map(function(m){ return '<option value="pc:' + attr(m.id) + '">' + esc(m.char ? m.char.name : m.name) + '</option>'; }).join('') + '</optgroup>' : '') + '</select></label>';
    } else if (!r) h += '<input type="hidden" name="who" value="obj">';
    else h += '<input type="hidden" name="who" value="comp">';
    h += '<div class="two"><label class="fl">Nombre<input class="field" name="name" maxlength="40" autocomplete="off" placeholder="' + (r && !dm ? 'Mi familiar, mi montura…' : 'Cofre, Goblin, Vela…') + '"></label><label class="fl">Tamaño<select class="field" name="s">' + TSIZE.map(function(x){ return '<option value="' + x[0] + '">' + x[1] + '</option>'; }).join('') + '</select></label></div>'
      + '<div class="swatches" role="group" aria-label="Color">' + TOKCOL.map(function(c, i){ return '<label class="sw" style="background:' + c + '"><input type="radio" name="color" value="' + c + '"' + (i === 0 ? ' checked' : '') + ' aria-label="Color ' + c + '"></label>'; }).join('') + '</div>'
      + (dm && r ? '<label class="toggle"><input type="checkbox" name="hidden"> Oculta para los jugadores</label>' : '')
      + '<button class="btn main sm" type="submit">Poner en el centro</button></form>';
    return h;
  }
  /* Panel de la ficha elegida */
  function tokPanel(){
    var p = $('#mapTok'), mp = maps[cur]; if (!p) return;
    var t = mp && selTok && mp.tokens.filter(function(x){ return x.id === selTok; })[0];
    if (!t) { p.hidden = true; return; }
    var can = mine(t), dm = master(mp), info = tokInfo(t), h = '<div class="row map-tok-h">' + avatar(t) + '<span style="flex:1;min-width:0"><b>' + esc(info.name) + '</b><small>' + esc(info.sub) + '</small></span><button class="icon-btn sm" type="button" data-act="maptokx" aria-label="Cerrar"><svg class="ic"><use href="#i-x"/></svg></button></div>';
    if (can) h += '<div class="map-tok-b"><label>Tamaño<select class="field" data-tokset="s">' + TSIZE.map(function(x){ return '<option value="' + x[0] + '"' + (t.s === x[0] ? ' selected' : '') + '>' + x[1].split(' (')[0] + '</option>'; }).join('') + '</select></label>'
      + '<div class="swatches" role="group" aria-label="Color">' + TOKCOL.map(function(c){ return '<button type="button" class="sw" data-act="maptokcol" data-v="' + c + '" style="background:' + c + '" aria-pressed="' + (t.color === c) + '" aria-label="Color ' + c + '"></button>'; }).join('') + '</div>'
      + '<div class="row" style="gap:6px;flex-wrap:wrap">' + (room() ? '<label class="btn sm pickbtn">' + (busyUp ? 'Subiendo…' : t.img ? 'Cambiar retrato' : 'Retrato') + '<input type="file" id="mapTokImg" accept="image/*"></label>' + (t.img ? '<button class="btn sm" type="button" data-act="maptoknoimg">Sin retrato</button>' : '') : '') + (dm && room() ? '<button class="btn sm" type="button" data-act="maptokhide">' + (t.hidden ? 'Mostrar a los jugadores' : 'Ocultar a los jugadores') + '</button>' : '') + '<button class="btn sm" type="button" data-act="maptokdel">Quitar del mapa</button></div></div>';
    p.innerHTML = h; p.hidden = false;
  }
  function avatar(t){ var c = t.color || '#8c2626'; return '<span class="tok-av" style="background:' + attr(c) + '">' + (t.img ? '<img alt="" src="' + attr(Mesa.imgUrl(t.img)) + '">' : esc(ini(t.name))) + '</span>'; }
  function ini(n){ return String(n || '?').split(/\s+/).slice(0, 2).map(function(w){ return w.charAt(0); }).join('').toUpperCase(); }
  /* Lo que se sabe de una ficha: nombre, PG o cómo se ve, si es su turno */
  function tokInfo(t){
    var r = room(), o = {name:t.name, sub:t.kind === 'pc' ? 'Personaje' : t.kind === 'npc' ? 'Enemigo' : 'Ficha', pct:null, state:null, turn:false, down:false};
    if (!r || !t.ref) return o;
    var m = r.members.filter(function(x){ return x.id === t.ref; })[0];
    if (m && m.char) { o.name = t.comp ? t.name : m.char.name; if (!t.comp && m.char.hp != null) { o.pct = m.char.hp / m.char.hpMax; o.sub = 'PG ' + m.char.hp + '/' + m.char.hpMax + (m.online ? '' : ' · desconectado'); o.down = m.char.hp <= 0; } }
    var n = (r.npcs || []).filter(function(x){ return x.id === t.ref; })[0];
    if (n) { if (n.hp != null && n.hpMax) { o.pct = n.hp / n.hpMax; o.down = n.hp <= 0; o.sub = (isDm() ? 'PG ' + n.hp + '/' + n.hpMax : 'Enemigo') + (n.hidden ? ' · oculto' : ''); } else if (n.pct != null) { o.pct = n.pct / 100; o.down = n.pct <= 0; } if (n.state) { o.state = n.state; o.sub = 'Se ve ' + n.state; o.down = n.state === 'caído'; } }
    o.turn = r.turnId === t.ref && r.round > 0;
    return o;
  }

  /* ---------- Vista: zoom y desplazamiento ---------- */
  function V(){ return views[cur] || (views[cur] = {s:24, x:20, y:20}); }
  function fit(){
    if (!canvas) return; var wrap = canvas.parentNode, w = wrap.clientWidth || 360, top = canvas.getBoundingClientRect().top || 220;
    var hh = Math.max(300, Math.min(1600, (window.innerHeight || 800) - top - 12)), dpr = window.devicePixelRatio || 1;
    canvas.style.width = w + 'px'; canvas.style.height = hh + 'px'; canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr);
  }
  function frame(mp){ if (!canvas || !mp) return; var w = canvas.clientWidth || 360, h = canvas.clientHeight || 400, s = Math.max(4, Math.min(80, Math.min((w - 20) / mp.cols, (h - 20) / mp.rows))); views[mp.id] = {s:s, x:(w - mp.cols * s) / 2, y:(h - mp.rows * s) / 2}; }
  /* Acerca y centra la vista en una ficha (para encontrar la tuya en el teléfono) */
  function focus(mp, t){ var v = V(), w = canvas.clientWidth || 360, h = canvas.clientHeight || 400, s = Math.max(v.s, 30), z = t.s || 1; v.s = s; v.x = w / 2 - (t.x + z / 2) * s; v.y = h / 2 - (t.y + z / 2) * s; }
  function zoomAt(f, cx, cy){ var v = V(), ns = Math.max(3, Math.min(160, v.s * f)); v.x = cx - (cx - v.x) * ns / v.s; v.y = cy - (cy - v.y) * ns / v.s; v.s = ns; paint(); }
  function toMap(px, py){ var v = V(); return [(px - v.x) / v.s, (py - v.y) / v.s]; }

  /* ---------- Pintar ---------- */
  function paint(){
    if (!canvas || !document.contains(canvas)) return; var c = canvas.getContext && canvas.getContext('2d'); if (!c) return; var mp = maps[cur]; if (!mp) return;
    var dpr = canvas.width / (canvas.clientWidth || canvas.width); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(c, mp, V(), canvas.clientWidth, canvas.clientHeight, hidden[mp.id] || {}, true);
    if (drawing) strokeOn(c, drawing, V());
    overlay(c, mp, V());
  }
  function bgImage(mp){
    if (!mp.bg) return null; var key = mp.bg.img || ('d:' + (mp.bg.data || '').length);
    var im = imgs[key]; if (im) return im.complete && im.naturalWidth ? im : null;
    im = new Image(); im.onload = function(){ if (cur === mp.id) paint(); }; im.src = mp.bg.img ? Mesa.imgUrl(mp.bg.img) : mp.bg.data; imgs[key] = im; return null;
  }
  function tokImage(id){ var im = imgs[id]; if (im) return im.complete && im.naturalWidth ? im : null; im = new Image(); im.onload = function(){ paint(); }; im.src = Mesa.imgUrl(id); imgs[id] = im; return null; }
  function draw(c, mp, v, W, H, hid, live){
    c.fillStyle = OUT; c.fillRect(0, 0, W, H);
    c.fillStyle = PAPER; c.fillRect(v.x, v.y, mp.cols * v.s, mp.rows * v.s);
    var bi = bgImage(mp); if (bi) { c.save(); c.globalAlpha = mp.bg.op || 1; c.drawImage(bi, v.x, v.y, mp.cols * v.s, mp.rows * v.s); c.restore(); }
    gridOn(c, mp, v, W, H);
    mp.layers.forEach(function(l){ if (hid[l.id]) return; mp.strokes.forEach(function(k){ if (k.l === l.id) strokeOn(c, k, v); }); });
    var dmView = master(mp), meId = me(), late = [];
    (mp.tokens || []).forEach(function(t){ if (drag && drag.tok.id === t.id) return; if (!dmView && mine(t)) late.push(t); else tokOn(c, t, v, mp); });
    if (mp.fog && mp.fog.on) fogOn(c, mp, v, W, H, dmView);
    late.forEach(function(t){ tokOn(c, t, v, mp); });
    c.strokeStyle = 'rgba(60,40,20,.6)'; c.lineWidth = 1.5; c.strokeRect(v.x, v.y, mp.cols * v.s, mp.rows * v.s);
  }
  function fogOn(c, mp, v, W, H, dmView){
    var bits = fogBits(mp), x0 = Math.max(0, Math.floor(-v.x / v.s)), x1 = Math.min(mp.cols - 1, Math.ceil((W - v.x) / v.s)), y0 = Math.max(0, Math.floor(-v.y / v.s)), y1 = Math.min(mp.rows - 1, Math.ceil((H - v.y) / v.s));
    c.save(); c.fillStyle = dmView ? 'rgba(12,8,6,.5)' : '#0b0806';
    for (var y = y0; y <= y1; y++) { var run = -1; for (var x = x0; x <= x1 + 1; x++) { var dark = x <= x1 && !seen(bits, mp, x, y); if (dark && run < 0) run = x; else if (!dark && run >= 0) { c.fillRect(v.x + run * v.s - 0.5, v.y + y * v.s - 0.5, (x - run) * v.s + 1, v.s + 1); run = -1; } } }
    c.restore();
  }
  function tokOn(c, t, v, mp, ghost){
    var info = tokInfo(t), s = t.s || 1, cx = v.x + (t.x + s / 2) * v.s, cy = v.y + (t.y + s / 2) * v.s, rad = Math.max(5, s * v.s * 0.44);
    c.save(); if (t.hidden) c.globalAlpha = 0.5; if (ghost) c.globalAlpha = 0.85;
    if (info.turn) { c.beginPath(); c.arc(cx, cy, rad + Math.max(3, v.s * 0.12), 0, Math.PI * 2); c.fillStyle = 'rgba(255,214,110,.55)'; c.fill(); }
    c.beginPath(); c.arc(cx, cy, rad, 0, Math.PI * 2); c.fillStyle = t.color || '#8c2626'; c.fill();
    var im = t.img && tokImage(t.img);
    if (im) { c.save(); c.beginPath(); c.arc(cx, cy, rad - 1.5, 0, Math.PI * 2); c.clip(); var k = Math.max(rad * 2 / im.naturalWidth, rad * 2 / im.naturalHeight); c.drawImage(im, cx - im.naturalWidth * k / 2, cy - im.naturalHeight * k / 2, im.naturalWidth * k, im.naturalHeight * k); c.restore(); }
    else { c.fillStyle = '#fff'; c.font = '700 ' + Math.max(8, rad * 0.8) + 'px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ini(info.name), cx, cy + 1); }
    c.lineWidth = Math.max(1.5, v.s * 0.06); c.strokeStyle = selTok === t.id ? '#ffd66e' : 'rgba(20,12,8,.85)'; if (t.hidden) c.setLineDash([4, 3]); c.stroke(); c.setLineDash([]);
    if (info.pct != null && v.s >= 10) { var p = Math.max(0, Math.min(1, info.pct)); c.beginPath(); c.arc(cx, cy, rad + c.lineWidth, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); c.strokeStyle = p > 0.66 ? '#5fb85a' : p > 0.33 ? '#e0b43a' : '#d24a3a'; c.lineWidth = Math.max(2, v.s * 0.08); c.stroke(); }
    if (info.down) { c.strokeStyle = '#d24a3a'; c.lineWidth = Math.max(2, rad * 0.18); c.beginPath(); c.moveTo(cx - rad * 0.6, cy - rad * 0.6); c.lineTo(cx + rad * 0.6, cy + rad * 0.6); c.moveTo(cx + rad * 0.6, cy - rad * 0.6); c.lineTo(cx - rad * 0.6, cy + rad * 0.6); c.stroke(); }
    if (v.s >= 18) { var fs = Math.max(10, Math.min(15, v.s * 0.38)); c.font = '600 ' + fs + 'px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'top'; c.lineWidth = 3; c.strokeStyle = 'rgba(243,233,210,.9)'; var ly = cy + rad + 3; c.strokeText(info.name, cx, ly); c.fillStyle = '#2b1d12'; c.fillText(info.name, cx, ly); }
    c.restore();
  }
  /* Encima de todo: la ficha que arrastras con su regla, el área de niebla y las señales */
  function overlay(c, mp, v){
    if (drag && drag.moved) {
      var t = drag.tok, s = t.s || 1, ax = v.x + (drag.sx + s / 2) * v.s, ay = v.y + (drag.sy + s / 2) * v.s, bx = v.x + (drag.x + s / 2) * v.s, by = v.y + (drag.y + s / 2) * v.s;
      c.save(); c.strokeStyle = 'rgba(255,214,110,.95)'; c.lineWidth = 3; c.setLineDash([8, 6]); c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); c.restore();
      tokOn(c, Object.assign({}, t, {x:drag.x, y:drag.y}), v, mp, true);
      var cells = Math.max(Math.abs(Math.round(drag.x - drag.sx)), Math.abs(Math.round(drag.y - drag.sy))), m = (cells * 1.5).toString().replace('.', ',');
      var label = m + ' m · ' + cells + ' casilla' + (cells === 1 ? '' : 's');
      c.save(); c.font = '700 15px Georgia, serif'; var w = c.measureText(label).width + 16, lx = Math.min(canvas.clientWidth - w - 4, Math.max(4, bx - w / 2)), ly = Math.max(4, by - s * v.s * 0.5 - 34);
      c.fillStyle = 'rgba(18,13,11,.88)'; c.fillRect(lx, ly, w, 26); c.strokeStyle = '#ffd66e'; c.lineWidth = 1; c.strokeRect(lx, ly, w, 26); c.fillStyle = '#ffd66e'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(label, lx + 8, ly + 13); c.restore();
    }
    if (fogDrag) { var r = fogDrag; c.save(); c.fillStyle = tool.fogV ? 'rgba(95,184,90,.28)' : 'rgba(10,6,4,.55)'; c.strokeStyle = tool.fogV ? '#5fb85a' : '#ffd66e'; c.lineWidth = 2; var x0 = Math.min(r.a[0], r.b[0]), y0 = Math.min(r.a[1], r.b[1]); c.fillRect(v.x + x0 * v.s, v.y + y0 * v.s, (Math.abs(r.a[0] - r.b[0]) + 1) * v.s, (Math.abs(r.a[1] - r.b[1]) + 1) * v.s); c.strokeRect(v.x + x0 * v.s, v.y + y0 * v.s, (Math.abs(r.a[0] - r.b[0]) + 1) * v.s, (Math.abs(r.a[1] - r.b[1]) + 1) * v.s); c.restore(); }
    var now = Date.now(); pings = pings.filter(function(p){ return now - p.t < 2400; });
    pings.forEach(function(p){ var k = (now - p.t) / 2400, px = v.x + p.x * v.s, py = v.y + p.y * v.s; c.save(); c.globalAlpha = 1 - k; c.strokeStyle = p.color || '#ffd66e'; c.lineWidth = 4; for (var i = 0; i < 2; i++) { c.beginPath(); c.arc(px, py, 8 + ((k * 2 + i * 0.5) % 1) * v.s * 2.2, 0, Math.PI * 2); c.stroke(); } c.fillStyle = p.color || '#ffd66e'; c.beginPath(); c.arc(px, py, 5, 0, Math.PI * 2); c.fill(); if (p.name) { c.font = '700 14px Georgia, serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(18,13,11,.9)'; c.strokeText(p.name, px, py - 16); c.fillStyle = '#fff'; c.fillText(p.name, px, py - 16); } c.restore(); });
  }
  function animate(){ if (raf) return; var step = function(){ raf = 0; paint(); if (pings.length) raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step); }
  function gridOn(c, mp, v, W, H){
    if (mp.grid === 'none' || v.s < 5) return;
    c.save(); c.beginPath(); c.rect(v.x, v.y, mp.cols * v.s, mp.rows * v.s); c.clip(); c.strokeStyle = mp.bg ? 'rgba(30,20,10,.35)' : GRID; c.lineWidth = 1; c.beginPath();
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
  function tokAt(mp, m){
    for (var i = mp.tokens.length - 1; i >= 0; i--) { var t = mp.tokens[i], s = t.s || 1, cx = t.x + s / 2, cy = t.y + s / 2; if (Math.hypot(m[0] - cx, m[1] - cy) <= Math.max(s * 0.5 + 0.15, 24 / V().s)) { if (!master(mp) && mp.fog && mp.fog.on && !mine(t)) { var b = fogBits(mp); if (!seen(b, mp, Math.floor(cx), Math.floor(cy))) continue; } return t; } }
    return null;
  }
  function bind(){
    canvas.addEventListener('pointerdown', function(ev){
      ev.preventDefault(); try { canvas.setPointerCapture(ev.pointerId); } catch(e){}
      ptr[ev.pointerId] = local(ev);
      var ids = Object.keys(ptr), mp = maps[cur];
      clearTimeout(press && press.t); press = null;
      if (ids.length === 2) { drawing = null; erasing = null; drag = null; fogDrag = null; var a = ptr[ids[0]], b = ptr[ids[1]]; gesture = {d:Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, cx:(a[0] + b[0]) / 2, cy:(a[1] + b[1]) / 2}; paint(); return; }
      if (ids.length > 2) return;
      var p = local(ev), m = toMap(p[0], p[1]);
      if (ev.button === 1 || ev.button === 2) { gesture = {pan:true, px:p[0], py:p[1]}; return; }
      if (mode === 'jugar') {
        var t = tokAt(mp, m);
        if (t) { drag = {tok:t, ox:m[0] - t.x, oy:m[1] - t.y, sx:t.x, sy:t.y, x:t.x, y:t.y, moved:false, can:mine(t), px:p[0], py:p[1]}; return; }
        gesture = {pan:true, px:p[0], py:p[1], tap:true, x0:p[0], y0:p[1]};
        press = {t:setTimeout(function(){ if (gesture && gesture.tap) { gesture.tap = false; ping(mp, clampPt(m)); } }, 550)};
        return;
      }
      if (mode === 'niebla') { var cell = [Math.max(0, Math.min(mp.cols - 1, Math.floor(m[0]))), Math.max(0, Math.min(mp.rows - 1, Math.floor(m[1])))]; fogDrag = {a:cell, b:cell}; paint(); return; }
      if (tool.k === 'pan') { gesture = {pan:true, px:p[0], py:p[1]}; return; }
      if (tool.k === 'text') { var tx = clampPt(snapPt(m, 'text')); askText(tx, p); return; }
      if (tool.k === 'erase') { erasing = {hits:{}}; eraseAt(m); return; }
      var s = clampPt(snapPt(m, tool.k));
      drawing = {k:tool.k, l:tool.layer, c:tool.c, w:tool.w, pts: tool.k === 'pen' ? [s[0], s[1]] : [s[0], s[1], s[0], s[1]]}; if (tool.k === 'rect' && tool.fill) drawing.f = 1;
      paint();
    });
    canvas.addEventListener('pointermove', function(ev){
      if (!ptr[ev.pointerId]) return;
      var p = local(ev); ptr[ev.pointerId] = p;
      var ids = Object.keys(ptr), mp = maps[cur];
      if (gesture && !gesture.pan && ids.length === 2) { var a = ptr[ids[0]], b = ptr[ids[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, v = V(); v.x += cx - gesture.cx; v.y += cy - gesture.cy; zoomAt(d / gesture.d, cx, cy); gesture.d = d; gesture.cx = cx; gesture.cy = cy; return; }
      if (gesture && gesture.pan) { if (gesture.tap && Math.hypot(p[0] - gesture.x0, p[1] - gesture.y0) > 8) { gesture.tap = false; clearTimeout(press && press.t); } var v2 = V(); v2.x += p[0] - gesture.px; v2.y += p[1] - gesture.py; gesture.px = p[0]; gesture.py = p[1]; paint(); return; }
      var m = toMap(p[0], p[1]);
      if (drag) {
        if (!drag.can) return;
        if (!drag.moved && Math.hypot(p[0] - drag.px, p[1] - drag.py) < 6) return;
        drag.moved = true; var s = drag.tok.s || 1;
        drag.x = Math.max(0, Math.min(mp.cols - s, m[0] - drag.ox)); drag.y = Math.max(0, Math.min(mp.rows - s, m[1] - drag.oy)); paint(); return;
      }
      if (fogDrag) { fogDrag.b = [Math.max(0, Math.min(mp.cols - 1, Math.floor(m[0]))), Math.max(0, Math.min(mp.rows - 1, Math.floor(m[1])))]; paint(); return; }
      if (erasing) { eraseAt(m); return; }
      if (!drawing) return;
      if (drawing.k === 'pen') { var q = clampPt(m), n = drawing.pts.length, dx = q[0] - drawing.pts[n - 2], dy = q[1] - drawing.pts[n - 1]; if (dx * dx + dy * dy < 0.01 || n >= 1180) return; drawing.pts.push(q[0], q[1]); }
      else { var e = clampPt(snapPt(m, drawing.k)); drawing.pts[2] = e[0]; drawing.pts[3] = e[1]; }
      paint();
    });
    var end = function(ev){
      delete ptr[ev.pointerId]; clearTimeout(press && press.t);
      var mp = maps[cur];
      if (gesture) { var tap = gesture.tap; if (!Object.keys(ptr).length) gesture = null; if (tap && selTok) { selTok = null; tokPanel(); paint(); } return; }
      if (drag) {
        var d = drag; drag = null;
        if (d.moved) { var s = d.tok.s || 1, nx = d.x, ny = d.y; if (mp.grid !== 'none') { nx = Math.round(nx); ny = Math.round(ny); } nx = Math.max(0, Math.min(mp.cols - s, nx)); ny = Math.max(0, Math.min(mp.rows - s, ny)); tokMove(mp, d.tok, nx, ny); selTok = d.tok.id; }
        else selTok = selTok === d.tok.id ? null : d.tok.id;
        tokPanel(); paint(); return;
      }
      if (fogDrag) { var f = fogDrag; fogDrag = null; if (!mp.fog || !mp.fog.on) { fogDo(mp, {t:'fog.on', value:true}); } fogDo(mp, {t:'fog.rect', rect:[f.a[0], f.a[1], f.b[0], f.b[1]], value:tool.fogV ? 1 : 0}); paint(); return; }
      if (erasing) { var ids = Object.keys(erasing.hits); erasing = null; rmStrokes(mp, ids); paint(); return; }
      if (!drawing) return; var k = drawing; drawing = null;
      if (k.k !== 'pen' && k.pts[0] === k.pts[2] && k.pts[1] === k.pts[3]) { paint(); return; }
      addStroke(mp, k); paint();
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

  /* ---------- Imágenes: fondo, retratos, mapa nuevo desde imagen ---------- */
  function readImg(file){ return new Promise(function(res, rej){ var url = URL.createObjectURL(file), im = new Image(); im.onload = function(){ res({url:url, w:im.naturalWidth, h:im.naturalHeight, file:file}); }; im.onerror = function(){ rej(new Error('No pude leer esa imagen.')); }; im.src = url; }); }
  function toDataUrl(file, max){ return Mesa.shrink(file, max).then(function(b){ return new Promise(function(res){ var fr = new FileReader(); fr.onload = function(){ res(fr.result); }; fr.readAsDataURL(b); }); }); }
  function setBg(mp, file){
    busyUp = true; toolbar();
    var done = function(){ busyUp = false; toolbar(); paint(); };
    if (shared(mp.id)) return Mesa.upload(file, 2400).then(function(id){ Sala.send({t:'map.bg', id:mp.id, img:id, op:1}); }).catch(function(e){ Sala.toast(e.message || 'No se pudo subir la imagen.'); }).then(done);
    return toDataUrl(file, 2000).then(function(u){ mp.bg = {data:u, op:1}; mp.updated = Date.now(); keep(mp); }).catch(function(){ Sala.toast('No pude leer esa imagen.'); }).then(done);
  }
  function dataToBlob(u){ var p = u.split(','), bin = atob(p[1]), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], {type:'image/jpeg'}); }

  /* ---------- Imagen para descargar ---------- */
  function png(mp){
    var s = Math.max(8, Math.min(32, Math.floor(4000 / Math.max(mp.cols, mp.rows)))), cv = document.createElement('canvas'); cv.width = mp.cols * s; cv.height = mp.rows * s;
    var c = cv.getContext && cv.getContext('2d'); if (!c) return;
    var prevCur = cur; cur = cur || mp.id; draw(c, mp, {s:s, x:0, y:0}, cv.width, cv.height, {}); cur = prevCur;
    try { cv.toBlob(function(b){ if (!b) return; var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = (mp.name || 'mapa').replace(/[^\wáéíóúñü -]/gi, '').trim().replace(/\s+/g, '-').toLowerCase() + '.png'; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1500); }, 'image/png'); } catch(e){ Sala.toast('No se pudo crear la imagen.'); }
  }

  /* ---------- Eventos ---------- */
  function openMap(id){
    load(id).then(function(mp){
      if (!mp) { var meta = roomMeta(id); if (meta) { asked[id] = null; waitOpen = id; Sala.send({t:'map.get', id:id}); Sala.toast('Trayendo el mapa…'); } return; }
      cur = id; layersOpen = false; setOpen = false; addOpen = false; selTok = null; mode = 'jugar'; var box = document.getElementById('mesaMaps'); if (box && visible()) editor(box); else if (box) { box.innerHTML = ''; }
      badge();
    });
  }
  function center(mp, s){ s = s || 1; var c = toMap((canvas ? canvas.clientWidth : 300) / 2, (canvas ? canvas.clientHeight : 300) / 2); return [Math.max(0, Math.min(mp.cols - s, Math.round(c[0] - s / 2))), Math.max(0, Math.min(mp.rows - s, Math.round(c[1] - s / 2)))]; }
  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('[data-act]'); if (!b || b.dataset.act.indexOf('map') !== 0) return;
    var a = b.dataset.act, mp = cur && maps[cur];
    if (a === 'mapnew') { newOpen = !newOpen; newImg = null; render(); }
    else if (a === 'mapsrc') { newImg = b.dataset.v === 'img' ? (newImg || {cols:30}) : null; render(); }
    else if (a === 'mapopen') openMap(b.dataset.id);
    else if (a === 'mapgoscene') { if (window.Mesa) { document.getElementById('combat').hidden = false; Mesa.show('mapas'); } openMap(b.dataset.v); }
    else if (a === 'mapback') { cur = null; canvas = null; selTok = null; render.sceneOpened = room() && room().scene; render(); badge(); }
    else if (a === 'mapscene') { Sala.send({t:'scene.set', id:b.dataset.id}); Sala.toast('Todos ven este mapa ahora.'); }
    else if (a === 'mapshare') load(b.dataset.id).then(function(m){
      if (!m || !room()) return;
      var copy = JSON.parse(JSON.stringify(m)); delete copy.by; delete copy.room; copy.tokens = (copy.tokens || []).filter(function(t){ return t.kind !== 'pc'; });
      var go = function(){ Sala.send({t:'map.save', map:copy}); Sala.toast('«' + m.name + '» ya está en la campaña.'); };
      if (copy.bg && copy.bg.data) { var bgd = copy.bg.data; delete copy.bg; Mesa.upload(dataToBlob(bgd), 2400).then(function(id){ copy.bg = {img:id, op:m.bg.op || 1}; go(); }).catch(function(){ go(); }); } else go();
    });
    else if (a === 'mappng') load(b.dataset.id).then(function(m){ if (m) png(m); });
    else if (a === 'mapdel') {
      if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = '¿Seguro? Toca otra vez'; return; }
      if (b.dataset.room) Sala.send({t:'map.del', id:b.dataset.id});
      else { delete maps[b.dataset.id]; idbDel('map:' + b.dataset.id); setIndex(index().filter(function(x){ return x.id !== b.dataset.id; })); render(); }
    }
    else if (!mp) return;
    else if (a === 'mapmode') { mode = b.dataset.v; if (mode === 'dibujar' && (tool.k === 'pan' || !tool.k)) tool.k = 'pen'; addOpen = false; toolbar(); paint(); }
    else if (a === 'mapset') { setOpen = !setOpen; toolbar(); fit(); paint(); }
    else if (a === 'mapadd') { addOpen = !addOpen; toolbar(); }
    else if (a === 'mapputme') {
      var s = Sala.summary ? Sala.summary() : null, t = myTok(mp), c = center(mp);
      if (t) { tokMove(mp, t, c[0], c[1]); selTok = t.id; tokPanel(); }
      else tokAdd(mp, {kind:'pc', name: s ? s.name : 'Yo', x:c[0], y:c[1], s:1, color:TOKCOL[1], mine:!shared(mp.id)});
    }
    else if (a === 'mapfindme') { var me2 = myTok(mp); if (me2) { focus(mp, me2); selTok = me2.id; paint(); tokPanel(); } }
    else if (a === 'maptool') { tool.k = b.dataset.v; toolbar(); }
    else if (a === 'mapcolor') { tool.c = b.dataset.v; if (tool.k === 'pan' || tool.k === 'erase') tool.k = 'pen'; toolbar(); }
    else if (a === 'mapw') { tool.w = +b.dataset.v; toolbar(); }
    else if (a === 'maplayer') { tool.layer = b.dataset.v; var hd = hidden[mp.id] = hidden[mp.id] || {}; delete hd[tool.layer]; toolbar(); paint(); }
    else if (a === 'mapeye') { var hh = hidden[mp.id] = hidden[mp.id] || {}; hh[b.dataset.v] = !hh[b.dataset.v]; toolbar(); paint(); }
    else if (a === 'maplayers') { layersOpen = !layersOpen; toolbar(); }
    else if (a === 'mapladd') { var n = 1; while (mp.layers.some(function(l){ return l.id === 'l' + n; })) n++; setMeta(mp, {layers:mp.layers.concat([{id:'l' + n, name:'Capa ' + n}])}); tool.layer = 'l' + n; }
    else if (a === 'mapldel') { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = '¿Borrar con lo que tiene?'; return; } setMeta(mp, {layers:mp.layers.filter(function(l){ return l.id !== b.dataset.v; })}); }
    else if (a === 'maplup') { var L = mp.layers.slice(), i = L.findIndex(function(l){ return l.id === b.dataset.v; }); if (i > 0) { var tt = L[i - 1]; L[i - 1] = L[i]; L[i] = tt; setMeta(mp, {layers:L}); } }
    else if (a === 'mapundo') undo(mp);
    else if (a === 'mapzoom') zoomAt(+b.dataset.v > 0 ? 1.3 : 1 / 1.3, (canvas.clientWidth || 300) / 2, (canvas.clientHeight || 300) / 2);
    else if (a === 'mapfit') { frame(mp); paint(); }
    else if (a === 'maptextno') { $('#mapTxt').hidden = true; pendingText = null; }
    else if (a === 'mapfogv') { tool.fogV = +b.dataset.v; toolbar(); }
    else if (a === 'mapfogall') { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = '¿Seguro?'; setTimeout(function(){ if (document.contains(b)) toolbar(); }, 3000); return; } fogDo(mp, {t:'fog.all', value:+b.dataset.v}); }
    else if (a === 'mapbgx') { if (shared(mp.id)) Sala.send({t:'map.bg', id:mp.id, img:null}); else { mp.bg = null; keep(mp); toolbar(); paint(); } }
    else if (a === 'maptokx') { selTok = null; tokPanel(); paint(); }
    else if (a.indexOf('maptok') === 0) {
      var tk = mp.tokens.filter(function(x){ return x.id === selTok; })[0]; if (!tk) return;
      if (a === 'maptokcol') tokSet(mp, tk, {color:b.dataset.v});
      else if (a === 'maptokhide') tokSet(mp, tk, {hidden:!tk.hidden});
      else if (a === 'maptoknoimg') tokSet(mp, tk, {img:null});
      else if (a === 'maptokdel') { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = '¿Quitar?'; return; } tokDel(mp, tk); }
    }
  });
  document.addEventListener('submit', function(ev){
    var f = ev.target, k = f.dataset && f.dataset.form; if (k !== 'mapnew' && k !== 'maptext' && k !== 'maptok') return; ev.preventDefault();
    if (k === 'mapnew') {
      var hide = !!(f.elements.hidden && f.elements.hidden.checked), name = f.elements.name.value.trim();
      if (newImg) {
        if (!newImg.file) return;
        var cols = Math.max(8, Math.min(160, parseInt(f.elements.cols.value, 10) || 30)), rows = Math.max(8, Math.min(160, Math.round(cols * newImg.h / newImg.w)));
        var mp = newMap({name:name || newImg.file.name.replace(/\.\w+$/, ''), cols:cols, rows:rows, grid:'square', hidden:hide}), file = newImg.file;
        newOpen = false; newImg = null; cur = mp.id; mode = 'jugar';
        var box = document.getElementById('mesaMaps'); if (box) editor(box);
        setBg(mp, file);
        return;
      }
      var mp2 = newMap({name:name, size:f.elements.size.value, grid:f.elements.grid.value, hidden:hide}); newOpen = false; cur = mp2.id; mode = 'dibujar'; tool.k = 'pen'; var box2 = document.getElementById('mesaMaps'); if (box2) editor(box2); return;
    }
    var m = maps[cur]; if (!m) return;
    if (k === 'maptok') {
      var who = f.elements.who ? f.elements.who.value : 'obj', nm = f.elements.name.value.trim(), sz = +f.elements.s.value || 1, col = (f.querySelector('input[name="color"]:checked') || {}).value || TOKCOL[0], c = center(m, sz), r = room();
      var tok = {kind:'obj', name:nm || 'Ficha', x:c[0], y:c[1], s:sz, color:col, hidden:!!(f.elements.hidden && f.elements.hidden.checked)};
      if (who.indexOf('npc:') === 0) { var n = (r.npcs || []).filter(function(x){ return 'npc:' + x.id === who; })[0]; tok.kind = 'npc'; tok.ref = n.id; tok.name = nm || n.name; if (n.hidden) tok.hidden = true; }
      else if (who.indexOf('pc:') === 0) { var pm = r.members.filter(function(x){ return 'pc:' + x.id === who; })[0]; tok.kind = 'pc'; tok.ref = pm.id; tok.name = nm || (pm.char ? pm.char.name : pm.name); tok.color = col; }
      else if (who === 'comp') { tok.kind = 'pc'; tok.comp = 1; tok.name = nm || 'Compañero'; }
      tokAdd(m, tok); addOpen = false; toolbar(); return;
    }
    var t = f.elements.t.value.trim(); $('#mapTxt').hidden = true;
    if (t && m && pendingText) addStroke(m, {k:'text', l:tool.layer, c:tool.c, w:tool.w, pts:pendingText, t:t});
    pendingText = null;
  });
  document.addEventListener('change', function(ev){
    var t = ev.target;
    if (t.id === 'mapNewImg' && t.files && t.files[0]) { readImg(t.files[0]).then(function(o){ var keepCols = newImg && newImg.cols || 30; newImg = o; newImg.cols = keepCols; render(); }).catch(function(e){ Sala.toast(e.message); }); return; }
    if (t.id === 'mapNewCols' && newImg) { newImg.cols = Math.max(8, Math.min(160, parseInt(t.value, 10) || 30)); var p = document.getElementById('mapNewRows'); if (p && newImg.w) p.textContent = 'Quedará de ' + newImg.cols + ' × ' + Math.max(8, Math.round(newImg.cols * newImg.h / newImg.w)) + ' casillas.'; return; }
    var mp = cur && maps[cur]; if (!mp) return;
    if (t.id === 'mapSnap') tool.snap = t.checked;
    else if (t.id === 'mapFill') tool.fill = t.checked;
    else if (t.id === 'mapName' && t.value.trim()) setMeta(mp, {name:t.value.trim()});
    else if (t.id === 'mapGrid') setMeta(mp, {grid:t.value});
    else if (t.id === 'mapFogOn') fogDo(mp, {t:'fog.on', value:t.checked});
    else if (t.id === 'mapHide') Sala.send({t:'map.hide', id:mp.id, value:t.checked});
    else if (t.id === 'mapBgFile' && t.files && t.files[0]) { setBg(mp, t.files[0]); t.value = ''; }
    else if (t.id === 'mapBgOp' && mp.bg) { if (shared(mp.id)) Sala.send({t:'map.bg', id:mp.id, op:+t.value}); else { mp.bg.op = +t.value; keep(mp); paint(); } }
    else if (t.id === 'mapTokImg' && t.files && t.files[0]) { var tk = mp.tokens.filter(function(x){ return x.id === selTok; })[0]; if (!tk) return; busyUp = true; tokPanel(); Mesa.upload(t.files[0], 400).then(function(id){ tokSet(mp, tk, {img:id}); }).catch(function(e){ Sala.toast(e.message || 'No se pudo subir.'); }).then(function(){ busyUp = false; tokPanel(); }); }
    else if (t.dataset && t.dataset.tokset) { var tk2 = mp.tokens.filter(function(x){ return x.id === selTok; })[0]; if (tk2) tokSet(mp, tk2, {s:+t.value}); }
    else if (t.dataset && t.dataset.maplname && t.value.trim()) setMeta(mp, {layers:mp.layers.map(function(l){ return l.id === t.dataset.maplname ? Object.assign({}, l, {name:t.value.trim()}) : l; })});
    else if (t.dataset && t.dataset.maplsecret) setMeta(mp, {layers:mp.layers.map(function(l){ if (l.id !== t.dataset.maplsecret) return l; var o = {id:l.id, name:l.name}; if (t.checked) o.dm = true; return o; })});
  });
  window.addEventListener('resize', function(){ if (cur && canvas && visible()) { fit(); paint(); } });

  return {render:render, png:png, open:openMap, _maps:function(){ return maps; }, _open:openMap, _tool:tool, _mode:function(v){ if (v) { mode = v; toolbar(); } return mode; }, _sel:function(){ return selTok; }};
})();
