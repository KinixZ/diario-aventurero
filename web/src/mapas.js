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
  var newOpen = false, layersOpen = false, pendingText = null, selTok = null, pings = [], imgs = {}, fogCache = {}, newImg = null, busyUp = false;
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
    ix.unshift({id:mp.id, name:mp.name, cols:mp.cols, rows:mp.rows, n:mp.strokes.length, t:mp.tokens.length, updated:mp.updated || Date.now(), room:mp.room || null, bgi:mp.bg && mp.bg.img || null});
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
      if (visible() && cur) { toolbar(); paint(); tokPanel(); }
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
  function dmId(){ var r = room(); var d = r && r.members.filter(function(m){ return m.role === 'dm'; })[0]; return d ? d.id : null; }
  function who(id){ var r = room(); var m = r && r.members.filter(function(x){ return x.id === id; })[0]; return m ? (m.role === 'dm' ? 'el DM' : m.char ? m.char.name : m.name) : ''; }
  function render(){
    var box = document.getElementById('mesaMaps'); if (!box) return;
    if (cur) { if (!$('#mapCv', box)) editor(box); else { toolbar(); fit(); paint(); } return; }
    var r = room(), ix = index(), inRoom = r ? (r.maps || []) : [], ids = {}, dm = isDm(), did = dmId();
    // si el DM tiene un mapa en pantalla y acabas de abrir la pestaña, ábrelo
    if (r && r.scene && !dm && !render.sceneOpened) { render.sceneOpened = r.scene; openMap(r.scene); return; }
    inRoom.forEach(function(m){ ids[m.id] = 1; });
    var ofDm = inRoom.filter(function(m){ return m.by === did; }), ofPj = inRoom.filter(function(m){ return m.by !== did; }), local = ix.filter(function(x){ return !ids[x.id]; });
    var h = '<div class="maps-home">';
    if (r) {
      h += '<section class="maps-sec official"><div class="maps-h"><svg class="ic"><use href="#i-crown"/></svg><div><b>' + (dm ? 'Tus mapas de DM' : 'Mapas del DM') + '</b><small>' + (dm ? 'Prepáralos ocultos y muéstralos cuando lleguen.' : 'Los que el DM les va mostrando.') + '</small></div></div>'
        + '<div class="map-grid">' + (dm ? newTile('dm') : '') + ofDm.map(function(m, i){ return card(m, true, 'dm', i); }).join('') + (!dm && !ofDm.length ? '<p class="note maps-empty">El DM todavía no les muestra ningún mapa.</p>' : '') + '</div></section>';
      h += '<section class="maps-sec sketch"><div class="maps-h"><svg class="ic"><use href="#i-pencil"/></svg><div><b>Dibujos del grupo</b><small>' + (dm ? 'Los croquis que dibujan los jugadores.' : 'Croquis de lo que exploran: los ven todos.') + '</small></div></div>'
        + '<div class="map-grid">' + (dm ? '' : newTile('pj')) + ofPj.map(function(m, i){ return card(m, true, 'pj', i); }).join('') + (dm && !ofPj.length ? '<p class="note maps-empty">Nadie ha dibujado nada todavía.</p>' : '') + '</div></section>';
    }
    if (local.length || !r) h += '<section class="maps-sec mine"><div class="maps-h"><svg class="ic"><use href="#i-book"/></svg><div><b>' + (r ? 'Solo en este aparato' : 'Mis mapas') + '</b><small>' + (r ? 'Puedes llevarlos a la campaña.' : 'Sin campaña dibujas en tu copia.') + '</small></div></div>'
      + '<div class="map-grid">' + (r ? '' : newTile('pj')) + local.map(function(m, i){ return card(m, false, 'mine', i); }).join('') + '</div></section>';
    box.innerHTML = h + '</div>';
  }
  /* El botón para crear un mapa vive dentro de la cuadrícula, como una ficha más */
  function newTile(kind){
    if (newOpen === kind) return newForm(kind);
    var dm = kind === 'dm';
    return '<div class="map-newtile' + (dm ? ' dm' : '') + '"><button type="button" class="map-newb" data-act="mapnew" data-v="' + kind + '"><span class="map-newic"><svg class="ic"><use href="#i-mapdraw"/></svg></span><b>' + (dm ? 'Nuevo mapa' : 'Dibujar mapa') + '</b><small>' + (dm ? 'En blanco o desde una imagen' : 'Un croquis de donde están') + '</small></button>'
      + (dm ? '<button type="button" class="map-newimg" data-act="mapnew" data-v="dm" data-src="img"><svg class="ic"><use href="#i-image"/></svg>Desde una imagen</button>' : '') + '</div>';
  }
  function newForm(kind){
    var dm = kind === 'dm' && isDm(), r = room();
    return '<form class="map-new card" data-form="mapnew"><div class="row map-new-h"><b><svg class="ic"><use href="#i-mapdraw"/></svg>' + (dm ? 'Nuevo mapa' : 'Dibujar mapa') + '</b><button class="icon-btn sm" type="button" data-act="mapnewx" aria-label="Cancelar"><svg class="ic"><use href="#i-x"/></svg></button></div><label class="fl">Nombre<input class="field" name="name" placeholder="' + (dm ? 'La cripta de Vel' : 'El camino al norte') + '" autocomplete="off"></label>'
      + '<div class="seg sm map-src" role="group" aria-label="Origen"><button type="button" data-act="mapsrc" data-v="blank" aria-pressed="' + !newImg + '"><svg class="ic"><use href="#i-pencil"/></svg>En blanco</button><button type="button" data-act="mapsrc" data-v="img" aria-pressed="' + !!newImg + '"><svg class="ic"><use href="#i-image"/></svg>Desde una imagen</button></div>'
      + (newImg ? '<div class="map-imgnew"><label class="btn pickbtn">' + (newImg.url ? 'Cambiar imagen' : 'Elegir imagen') + '<input type="file" id="mapNewImg" accept="image/*"></label>' + (newImg.url ? '<img alt="" src="' + attr(newImg.url) + '">' : '') + '<label class="fl">Casillas a lo ancho<input class="field" name="cols" inputmode="numeric" value="' + (newImg.cols || 30) + '" id="mapNewCols"></label><p class="note" id="mapNewRows">' + (newImg.w ? 'Quedará de ' + (newImg.cols || 30) + ' × ' + Math.max(8, Math.round((newImg.cols || 30) * newImg.h / newImg.w)) + ' casillas. Cuenta los cuadros de la imagen para que la cuadrícula coincida.' : 'Sube el mapa (de un libro, de Dungeondraft, una foto…).') + '</p></div>'
        : '<div class="two"><label class="fl">Tamaño (casillas)<select class="field" name="size">' + SIZES.map(function(x, i){ return '<option value="' + x[0] + '"' + (i === (dm ? 1 : 0) ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label><label class="fl">Cuadrícula<select class="field" name="grid"><option value="square">Cuadrada</option><option value="hex">Hexagonal</option><option value="none">Sin cuadrícula</option></select></label></div>')
      + (dm ? '<label class="toggle"><input type="checkbox" name="hidden" checked> Oculto para los jugadores hasta que lo muestres</label>' : '')
      + '<button class="btn main" type="submit"' + (busyUp || (newImg && !newImg.url) ? ' disabled' : '') + '>' + (busyUp ? 'Subiendo…' : r ? (dm ? 'Crear en la campaña' : 'Empezar a dibujar') : 'Crear en mi diario') + '</button></form>';
  }
  function thumbOf(m){ var full = maps[m.id], bi = (full && full.bg && full.bg.img) || m.bgi; return bi ? Mesa.imgUrl(bi) : (full && full.bg && full.bg.data) || ''; }
  function card(m, inRoom, kind, i){
    var r = room(), scene = r && r.scene === m.id, dm = isDm(), th = thumbOf(m), nt = m.tokens != null ? m.tokens : m.t || 0;
    var meta = m.cols + ' × ' + m.rows + (nt ? ' · ' + nt + ' ficha' + (nt === 1 ? '' : 's') : '') + (m.updated ? ' · ' + new Date(m.updated).toLocaleDateString('es-MX', {day:'numeric', month:'short'}) : '');
    var h = '<div class="map-card ' + kind + (m.hidden ? ' prep' : '') + (scene ? ' scene' : '') + '" style="--d:' + ((i || 0) * 45) + 'ms;--r:' + (kind === 'pj' ? ((((m.id.charCodeAt(m.id.length - 1) || 0) % 5) - 2) * 0.6) : 0) + 'deg"><button type="button" class="map-open" data-act="mapopen" data-id="' + attr(m.id) + '">'
      + '<span class="map-thumb' + (th ? ' img' : '') + '"' + (th ? ' style="background-image:url(\'' + attr(th) + '\')"' : '') + '>' + (th ? '' : '<svg class="ic"><use href="#' + (kind === 'pj' ? 'i-pencil' : 'i-map') + '"/></svg>') + (scene ? '<i class="map-seal">En pantalla</i>' : '') + (m.hidden ? '<i class="map-seal off">Oculto</i>' : '') + '</span>'
      + '<span class="map-info"><b>' + esc(m.name) + '</b><small>' + (kind === 'pj' && inRoom ? 'por ' + esc(who(m.by) || 'alguien') + ' · ' : '') + meta + (!inRoom && m.room ? ' · de ' + esc(m.room) : '') + '</small></span></button>'
      + '<div class="map-btns">' + (inRoom && dm ? '<button class="icon-btn sm' + (scene ? ' on' : '') + '" type="button" data-act="mapscene" data-id="' + attr(m.id) + '" aria-label="' + (scene ? 'Ya está en pantalla' : 'Mostrar a todos') + '" title="' + (scene ? 'En pantalla' : 'Mostrar a todos') + '"><svg class="ic"><use href="#i-screen"/></svg></button>' : '')
      + (!inRoom && r ? '<button class="icon-btn sm" type="button" data-act="mapshare" data-id="' + attr(m.id) + '" aria-label="Llevar a la campaña" title="Llevar a la campaña"><svg class="ic"><use href="#i-up"/></svg></button>' : '')
      + '<button class="icon-btn sm" type="button" data-act="mappng" data-id="' + attr(m.id) + '" aria-label="Bajar como imagen" title="Bajar como imagen"><svg class="ic"><use href="#i-image"/></svg></button>'
      + (!inRoom || dm || m.by === me() ? '<button class="icon-btn sm del" type="button" data-act="mapdel" data-id="' + attr(m.id) + '" data-room="' + (inRoom ? 1 : '') + '" aria-label="' + (inRoom ? 'Quitar de la campaña' : 'Borrar') + '" title="' + (inRoom ? 'Quitar' : 'Borrar') + '"><svg class="ic"><use href="#i-trash"/></svg></button>' : '') + '</div></div>';
    return h;
  }

  /* ---------- Editor: el mapa ocupa todo; las herramientas flotan encima ---------- */
  var pop = null; // 'set' | 'layers' | 'add' | 'pen' | null
  function editor(box){
    box.innerHTML = '<div class="map-ed vtt"><div class="map-bar" id="mapBar"></div><div class="map-wrap" id="mapWrap"><canvas id="mapCv" aria-label="Mapa: arrastra tu ficha, mantén presionado para señalar; con dos dedos mueves y haces zoom"></canvas>'
      + '<div class="vtt-init" id="vttInit" hidden></div><div class="map-pal" id="mapPal"></div>'
      + '<div class="map-zoom"><button class="icon-btn sm" type="button" data-act="mapzoom" data-v="1" aria-label="Acercar"><svg class="ic"><use href="#i-plus"/></svg></button><button class="icon-btn sm" type="button" data-act="mapzoom" data-v="-1" aria-label="Alejar"><svg class="ic"><use href="#i-minus"/></svg></button><button class="icon-btn sm" type="button" data-act="mapfit" aria-label="Encuadrar el mapa" title="Encuadrar"><svg class="ic"><use href="#i-fit"/></svg></button></div>'
      + '<div class="map-pop" id="mapPop" hidden></div><div class="vtt-hud" id="vttHud"></div><div class="map-txt" id="mapTxt" hidden></div><div class="map-tok" id="mapTok" hidden></div></div></div>';
    canvas = $('#mapCv', box); bind(); toolbar(); fit(); frame(maps[cur]); var mt = !master(maps[cur]) && myTok(maps[cur]); if (mt) focus(maps[cur], mt); paint(); tokPanel(); badge();
  }
  /* No repinta un bloque mientras escribes en él (el estado llega seguido) */
  function put(el, html){ var a = document.activeElement; if (a && el.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && el.innerHTML) return; el.innerHTML = html; }
  function myTok(mp){ var id = me(), sh = shared(mp.id); return mp.tokens.filter(function(t){ return t.kind === 'pc' && (sh ? t.ref === id : t.mine) && !t.comp; })[0]; }
  function toolbar(){
    var bar = $('#mapBar'), mp = maps[cur]; if (!bar || !mp) return;
    if (!tool.layer || !mp.layers.some(function(l){ return l.id === tool.layer; })) tool.layer = mp.layers[0].id;
    var admin = canAdmin(mp), sh = shared(mp.id), dm = master(mp), r = room(), meta = roomMeta(mp.id), scene = r && r.scene === mp.id;
    if (mode === 'niebla' && !dm) mode = 'jugar';
    var modes = [['jugar','Jugar','i-token'],['dibujar','Dibujar','i-pencil']]; if (dm) modes.push(['niebla','Niebla','i-fog']);
    put(bar, '<button class="icon-btn sm" type="button" data-act="mapback" aria-label="Volver a los mapas" title="Mapas"><svg class="ic"><use href="#i-back"/></svg></button>'
      + (admin ? '<input class="field map-name" id="mapName" value="' + attr(mp.name) + '" aria-label="Nombre del mapa">' : '<b class="map-name ro">' + esc(mp.name) + '</b>')
      + '<span class="map-where">' + (scene ? '<i class="tag new">en pantalla</i>' : '') + (meta && meta.hidden ? '<i class="tag">oculto</i>' : '') + (sh ? '' : '<i class="tag">solo tu copia</i>') + '</span>'
      + '<div class="seg map-modes" role="tablist" aria-label="Modo">' + modes.map(function(x){ return '<button type="button" data-act="mapmode" data-v="' + x[0] + '" aria-pressed="' + (mode === x[0]) + '" title="' + x[1] + '"><svg class="ic"><use href="#' + x[2] + '"/></svg><span>' + x[1] + '</span></button>'; }).join('') + '</div>'
      + (admin ? '<button class="icon-btn sm" type="button" data-act="mapset" aria-expanded="' + (pop === 'set') + '" aria-label="Ajustes del mapa" title="Ajustes del mapa"><svg class="ic"><use href="#i-gear"/></svg></button>' : ''));
    palette(mp, dm, sh); popover(mp, dm, sh, admin); hud(mp, dm, sh, scene); initStrip(mp);
  }
  /* Paleta flotante de dibujo (a la izquierda, como en los VTT) */
  function palette(mp, dm, sh){
    var p = $('#mapPal'); if (!p) return;
    if (mode !== 'dibujar') { p.innerHTML = ''; p.hidden = true; return; }
    p.hidden = false;
    var tb = function(k, label, ic){ return '<button type="button" class="icon-btn" data-act="maptool" data-v="' + k + '" aria-pressed="' + (tool.k === k) + '" aria-label="' + label + '" title="' + label + '"><svg class="ic"><use href="#' + ic + '"/></svg></button>'; };
    p.innerHTML = tb('pan', 'Mover el mapa', 'i-hand')
      + '<button type="button" class="icon-btn pen-btn" data-act="mappen" aria-expanded="' + (pop === 'pen') + '" aria-pressed="' + (tool.k === 'pen') + '" aria-label="Lápiz: grosor y color" title="Lápiz"><svg class="ic"><use href="#i-pencil"/></svg><i class="pen-dot" style="background:' + attr(tool.c) + ';--w:' + (tool.w === 0.06 ? 4 : tool.w === 0.14 ? 7 : 11) + 'px"></i></button>'
      + tb('line', 'Línea', 'i-line') + tb('rect', 'Rectángulo', 'i-rect') + tb('text', 'Texto', 'i-text') + tb('erase', 'Borrar', 'i-eraser')
      + '<span class="pal-sep"></span><button type="button" class="icon-btn" data-act="maplayers" aria-expanded="' + (pop === 'layers') + '" aria-label="Capas" title="Capas"><svg class="ic"><use href="#i-layers"/></svg></button><button type="button" class="icon-btn" data-act="mapundo" aria-label="Deshacer lo mío" title="Deshacer lo mío"><svg class="ic"><use href="#i-undo"/></svg></button>';
  }
  function penHtml(){
    return '<div class="penpop"><span class="label">trazo</span><div class="pen-ws" role="group" aria-label="Grosor">' + WIDTHS.map(function(x, i){ return '<button type="button" data-act="mapw" data-v="' + x[0] + '" aria-pressed="' + (tool.w === x[0]) + '" aria-label="' + x[1] + '" title="' + x[1] + '"><svg viewBox="0 0 60 20" aria-hidden="true"><path d="M6 14 Q20 2 32 10 T54 6" stroke="' + attr(tool.c) + '" stroke-width="' + [2, 4.5, 8][i] + '" fill="none" stroke-linecap="round"/></svg></button>'; }).join('') + '</div>'
      + '<span class="label">color</span><div class="swatches" role="group" aria-label="Color">' + COLORS.map(function(c){ return '<button type="button" class="sw" data-act="mapcolor" data-v="' + c[0] + '" style="background:' + c[0] + '" aria-pressed="' + (tool.c === c[0]) + '" aria-label="' + c[1] + '"></button>'; }).join('') + '</div>'
      + '<label class="toggle"><input type="checkbox" id="mapSnap"' + (tool.snap ? ' checked' : '') + '> Ajustar a la cuadrícula</label><label class="toggle"><input type="checkbox" id="mapFill"' + (tool.fill ? ' checked' : '') + '> Rellenar rectángulos</label></div>';
  }
  function layersHtml(mp, dm, sh, admin){
    var hid = hidden[mp.id] || {};
    return '<div class="map-layers-p"><span class="label">capas · toca una para dibujar en ella</span>' + mp.layers.map(function(l, i){ return '<div class="map-layer' + (tool.layer === l.id ? ' on' : '') + (hid[l.id] ? ' off' : '') + (l.dm ? ' secret' : '') + '"><button type="button" class="eye" data-act="mapeye" data-v="' + attr(l.id) + '" aria-pressed="' + !hid[l.id] + '" aria-label="' + (hid[l.id] ? 'Mostrar ' : 'Ocultar ') + attr(l.name) + '"><svg class="ic"><use href="#i-eye"/></svg></button><button type="button" class="ln" data-act="maplayer" data-v="' + attr(l.id) + '" aria-pressed="' + (tool.layer === l.id) + '">' + esc(l.name) + (l.dm ? ' <small>solo DM</small>' : '') + '</button></div>'
      + (layersOpen ? '<div class="line map-lrow"><input class="field" data-maplname="' + attr(l.id) + '" value="' + attr(l.name) + '" aria-label="Nombre de la capa">' + (dm && sh ? '<label class="toggle"><input type="checkbox" data-maplsecret="' + attr(l.id) + '"' + (l.dm ? ' checked' : '') + '> Solo DM</label>' : '') + (i ? '<button class="icon-btn sm" type="button" data-act="maplup" data-v="' + attr(l.id) + '" aria-label="Subir capa"><svg class="ic"><use href="#i-up"/></svg></button>' : '') + (admin && mp.layers.length > 1 ? '<button class="icon-btn sm" type="button" data-act="mapldel" data-v="' + attr(l.id) + '" aria-label="Borrar capa"><svg class="ic"><use href="#i-trash"/></svg></button>' : '') + '</div>' : ''); }).join('')
      + '<div class="dm-row"><button class="btn sm" type="button" data-act="maplayeredit">' + (layersOpen ? 'Listo' : 'Editar capas') + '</button>' + (mp.layers.length < 8 ? '<button class="btn sm" type="button" data-act="mapladd">Agregar capa</button>' : '') + '</div>'
      + (dm && sh ? '<p class="note">Las capas «Solo DM» no las ven los jugadores: trampas, puertas secretas y notas.</p>' : '') + '</div>';
  }
  function popover(mp, dm, sh, admin){
    var p = $('#mapPop'); if (!p) return;
    if (pop === 'pen' && mode !== 'dibujar') pop = null;
    if (pop === 'layers' && mode !== 'dibujar') pop = null;
    var h = pop === 'set' && admin ? setHtml(mp, dm, sh) : pop === 'layers' ? layersHtml(mp, dm, sh, admin) : pop === 'pen' ? penHtml() : pop === 'add' ? addHtml(mp, dm) : '';
    p.className = 'map-pop' + (pop ? ' p-' + pop : ''); put(p, h); p.hidden = !h;
  }
  function setHtml(mp, dm, sh){
    var meta = roomMeta(mp.id), bg = mp.bg;
    return '<div class="map-set"><div class="row"><b>Ajustes del mapa</b><button class="icon-btn sm" type="button" data-act="mappopx" aria-label="Cerrar"><svg class="ic"><use href="#i-x"/></svg></button></div><div class="two"><label class="fl">Cuadrícula<select class="field" id="mapGrid">' + [['square','Cuadrada'],['hex','Hexagonal'],['none','Sin cuadrícula']].map(function(x){ return '<option value="' + x[0] + '"' + (mp.grid === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>'
      + '<div class="fl"><span>Imagen de fondo</span><div class="row" style="gap:6px;flex-wrap:wrap"><label class="btn sm pickbtn">' + (busyUp ? 'Subiendo…' : bg ? 'Cambiar' : 'Subir imagen') + '<input type="file" id="mapBgFile" accept="image/*"></label>' + (bg ? '<button class="btn sm" type="button" data-act="mapbgx">Quitar</button>' : '') + '</div></div></div>'
      + (bg ? '<label class="fl">Opacidad del fondo<input type="range" id="mapBgOp" min="0.2" max="1" step="0.1" value="' + (bg.op || 1) + '"></label>' : '')
      + (dm && sh ? '<label class="toggle"><input type="checkbox" id="mapHide"' + (meta && meta.hidden ? ' checked' : '') + '> Oculto para los jugadores</label>' : '')
      + '<p class="note">La imagen se estira sobre todas las casillas (' + mp.cols + ' × ' + mp.rows + '). Si la cuadrícula no coincide, crea el mapa «Desde una imagen» con las casillas que tiene a lo ancho.</p></div>';
  }
  function addHtml(mp, dm){
    var r = room(), onMap = {}; mp.tokens.forEach(function(t){ if (t.ref) onMap[t.ref] = 1; });
    var h = '<form class="map-add" data-form="maptok"><div class="row"><b>Poner una ficha</b><button class="icon-btn sm" type="button" data-act="mappopx" aria-label="Cerrar"><svg class="ic"><use href="#i-x"/></svg></button></div>';
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

  /* ---------- Combate dentro del mapa ---------- */
  function fight(){ var r = room(); return r && ((r.round > 0) || (r.npcs || []).length || r.order.length) ? r : null; }
  function combatants(r){
    var all = {}; r.members.forEach(function(m){ if (m.role !== 'dm') all[m.id] = {id:m.id, pc:true, m:m}; }); (r.npcs || []).forEach(function(n){ all[n.id] = {id:n.id, pc:false, n:n}; });
    var ord = r.order.map(function(id){ return all[id]; }).filter(Boolean), rest = Object.keys(all).map(function(k){ return all[k]; }).filter(function(x){ return r.order.indexOf(x.id) < 0; });
    return ord.concat(rest);
  }
  function cInfo(x, r){
    var dm = isDm(), o = {name:'', init:null, pct:null, label:'', down:false};
    if (x.pc) { var c = x.m.char || {}; o.name = c.name || x.m.name; o.init = x.m.init; if (c.hp != null && c.hpMax) { o.pct = c.hp / c.hpMax; o.label = c.hp + '/' + c.hpMax; o.down = c.hp <= 0; } }
    else { var n = x.n; o.name = n.name; o.init = n.init; if (n.hp != null && n.hpMax) { o.pct = n.hp / n.hpMax; o.label = dm || n.show === 'num' ? n.hp + '/' + n.hpMax : ''; o.down = n.hp <= 0; } else if (n.pct != null) { o.pct = n.pct / 100; o.down = n.pct <= 0; } if (n.state) { o.label = n.state; o.down = n.state === 'caído'; } }
    return o;
  }
  function initStrip(mp){
    var el = $('#vttInit'); if (!el) return;
    var r = fight(); if (!r || mode !== 'jugar') { el.hidden = true; el.innerHTML = ''; return; }
    var list = combatants(r), onMap = {}; mp.tokens.forEach(function(t){ if (t.ref && !t.comp) onMap[t.ref] = t; });
    el.hidden = false;
    el.innerHTML = '<span class="vi-round">' + (r.round ? '<small>ronda</small><b>' + r.round + '</b>' : '<small>combate</small><b>·</b>') + '</span><div class="vi-list">' + list.map(function(x, i){
      var o = cInfo(x, r), t = onMap[x.id], turn = r.round && r.turnId === x.id, col = t ? t.color : x.pc ? '#2f5d8a' : '#8c2626', p = o.pct == null ? null : Math.max(0, Math.min(1, o.pct));
      return '<button type="button" class="vi-chip' + (turn ? ' turn' : '') + (x.pc ? ' pc' : ' npc') + (o.down ? ' down' : '') + (x.id === r.you ? ' me' : '') + (x.n && x.n.hidden ? ' hid' : '') + (r.order.indexOf(x.id) < 0 ? ' noinit' : '') + '" data-act="mapchip" data-id="' + attr(x.id) + '" style="--d:' + (i * 35) + 'ms" title="' + attr(o.name + (o.label ? ' · ' + o.label : '')) + '">'
        + '<span class="vi-av" style="background:' + attr(col) + '">' + (t && t.img ? '<img alt="" src="' + attr(Mesa.imgUrl(t.img)) + '">' : esc(ini(o.name))) + '</span><span class="vi-init">' + (o.init == null ? '–' : o.init) + '</span>'
        + (p != null ? '<i class="vi-hp"><i style="width:' + Math.round(p * 100) + '%;background:' + (p > 0.66 ? '#5fb85a' : p > 0.33 ? '#e0b43a' : '#d24a3a') + '"></i></i>' : '') + '<span class="vi-n">' + esc(String(o.name).split(' ')[0]) + '</span></button>';
    }).join('') + '</div>';
    var on = el.querySelector('.vi-chip.turn'), ls = el.querySelector('.vi-list'); if (on && ls) ls.scrollLeft = Math.max(0, on.offsetLeft - (ls.clientWidth - on.offsetWidth) / 2);
  }
  function hud(mp, dm, sh, scene){
    var el = $('#vttHud'); if (!el) return;
    var r = room(), h = '';
    if (mode === 'niebla') {
      var fo = mp.fog && mp.fog.on;
      h = '<div class="hud-row"><label class="toggle big"><input type="checkbox" id="mapFogOn"' + (fo ? ' checked' : '') + '> Niebla</label><div class="seg sm" role="group" aria-label="Al arrastrar"><button type="button" data-act="mapfogv" data-v="1" aria-pressed="' + (tool.fogV === 1) + '">Descubrir</button><button type="button" data-act="mapfogv" data-v="0" aria-pressed="' + (tool.fogV === 0) + '">Cubrir</button></div><button class="btn sm" type="button" data-act="mapfogall" data-v="1">Todo visible</button><button class="btn sm" type="button" data-act="mapfogall" data-v="0">Todo cubierto</button></div>'
        + '<p class="hud-hint">' + (fo ? 'Arrastra sobre el mapa para ' + (tool.fogV ? 'descubrir' : 'cubrir') + '. Tú la ves translúcida; los jugadores, negra.' : 'Actívala para que los jugadores solo vean lo descubierto.') + '</p>';
    } else if (mode === 'jugar') {
      var f = fight(), mt = myTok(mp), canPut = !(isDm() && sh) && (!!(window.Sala && Sala.summary && Sala.summary()) || !sh);
      var tokBtns = (canPut ? '<button class="btn main sm" type="button" data-act="mapputme"><svg class="ic"><use href="#i-token"/></svg>' + (mt ? 'Traer mi ficha' : 'Poner mi ficha') + '</button>' + (mt ? '<button class="icon-btn sm" type="button" data-act="mapfindme" aria-label="Ir a mi ficha" title="Ir a mi ficha"><svg class="ic"><use href="#i-target"/></svg></button>' : '') : '')
        + '<button class="icon-btn sm" type="button" data-act="mapadd" aria-expanded="' + (pop === 'add') + '" aria-label="' + (dm ? 'Agregar ficha' : 'Otra ficha (familiar, montura)') + '" title="' + (dm ? 'Agregar ficha' : 'Otra ficha') + '"><svg class="ic"><use href="#i-plus"/></svg></button>';
      if (r && isDm() && sh) {
        var missing = f ? combatants(f).filter(function(x){ return !mp.tokens.some(function(t){ return t.ref === x.id && !t.comp; }); }).length : 0;
        h = '<div class="hud-row dm">' + tokBtns + (!scene ? '<button class="btn sm" type="button" data-act="mapscene" data-id="' + attr(mp.id) + '"><svg class="ic"><use href="#i-screen"/></svg>Mostrar a todos</button>' : '')
          + '<span class="hud-sp"></span><button class="btn sm" type="button" data-act="bestopen"><svg class="ic"><use href="#i-paw"/></svg>Enemigo</button>' + (missing ? '<button class="btn sm" type="button" data-act="mapplaceall"><svg class="ic"><use href="#i-token"/></svg>Poner ' + missing + ' en el mapa</button>' : '')
          + (f ? (f.round ? '<button class="icon-btn sm" type="button" data-act="salaturn" data-v="prev" aria-label="Turno anterior"><svg class="ic"><use href="#i-back"/></svg></button><button class="btn main sm hud-next" type="button" data-act="salaturn" data-v="next"><svg class="ic"><use href="#i-next"/></svg>Siguiente</button><button class="icon-btn sm" type="button" data-act="salaend" aria-label="Terminar combate" title="Terminar combate"><svg class="ic"><use href="#i-stop"/></svg></button>' : '<button class="btn main sm" type="button" data-act="salaturn" data-v="start"' + (f.order.length ? '' : ' disabled title="Falta iniciativa"') + '><svg class="ic"><use href="#i-swords"/></svg>Empezar combate</button>') : '') + '</div>';
      } else if (r && sh) {
        var meM = r.members.filter(function(m){ return m.id === r.you; })[0] || {}, c = meM.char || {}, myTurn = f && f.round && f.turnId === r.you, p = c.hpMax ? Math.max(0, Math.min(1, c.hp / c.hpMax)) : null;
        h = '<div class="hud-row pj' + (myTurn ? ' myturn' : '') + '">' + (c.name ? '<span class="hud-me"><b>' + esc(c.name) + '</b><span class="hud-hp"><i style="width:' + Math.round((p || 0) * 100) + '%;background:' + (p > 0.66 ? '#5fb85a' : p > 0.33 ? '#e0b43a' : '#d24a3a') + '"></i></span><small>PG ' + (c.hp != null ? c.hp + '/' + c.hpMax : '–') + (c.temp ? ' +' + c.temp : '') + ' · CA ' + (c.ac || '–') + '</small></span>' : '')
          + (myTurn ? '<span class="hud-turn">¡Tu turno!</span><button class="btn main sm hud-next" type="button" data-act="salaturn" data-v="next"><svg class="ic"><use href="#i-next"/></svg>Terminar turno</button>'
            : f && meM.init == null ? '<form class="hud-init" data-form="salainit"><input class="field" name="v" inputmode="numeric" autocomplete="off" placeholder="Inic." aria-label="Tu iniciativa"><button class="btn main sm" type="submit">Iniciativa</button></form>' : '')
          + '<span class="hud-sp"></span>' + tokBtns + '<button class="icon-btn sm" type="button" data-act="mapsheet" aria-label="Mi hoja de combate" title="Mi hoja de combate"><svg class="ic"><use href="#i-swords"/></svg></button></div>'
          + (c.conds && c.conds.length ? '<div class="hud-conds">' + c.conds.map(function(k){ return '<span class="chip">' + esc((Sala.COND || {})[k] || k) + '</span>'; }).join('') + '</div>' : '');
      } else h = '<div class="hud-row">' + tokBtns + '</div>';
    }
    put(el, h); el.hidden = !h;
  }
  /* Pone en el mapa a quien esté en el combate y no tenga ficha, alrededor del centro */
  function placeAll(mp){
    var f = fight(); if (!f) return; var c = center(mp), k = 0, used = {}; mp.tokens.forEach(function(t){ used[Math.round(t.x) + ',' + Math.round(t.y)] = 1; });
    var spot = function(){ for (var ring = 0; ring < 12; ring++) for (var dy = -ring; dy <= ring; dy++) for (var dx = -ring; dx <= ring; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue; var x = c[0] + dx, y = c[1] + dy; if (x < 0 || y < 0 || x >= mp.cols || y >= mp.rows || used[x + ',' + y]) continue; used[x + ',' + y] = 1; return [x, y]; } return c; };
    combatants(f).forEach(function(x){
      if (mp.tokens.some(function(t){ return t.ref === x.id && !t.comp; })) return;
      var p = spot(); k++;
      if (x.pc) tokAdd(mp, {kind:'pc', ref:x.id, name:(x.m.char && x.m.char.name) || x.m.name, x:p[0], y:p[1], s:1, color:TOKCOL[(k % (TOKCOL.length - 1)) + 1]});
      else tokAdd(mp, {kind:'npc', ref:x.id, name:x.n.name, x:p[0], y:p[1], s:1, color:'#8c2626', hidden:!!x.n.hidden});
    });
    if (k) Sala.toast(k + ' ficha' + (k === 1 ? '' : 's') + ' en el mapa.');
  }
  /* Panel de la ficha elegida: datos y, si está en el combate, daño, curación y estados */
  function tokPanel(){
    var p = $('#mapTok'), mp = maps[cur]; if (!p) return;
    var t = mp && selTok && mp.tokens.filter(function(x){ return x.id === selTok; })[0];
    if (!t) { p.hidden = true; return; }
    var can = mine(t), dm = master(mp), info = tokInfo(t), r = room(), cb = r && t.ref && !t.comp ? combatant(r, t.ref) : null;
    var h = '<div class="row map-tok-h">' + avatar(t) + '<span style="flex:1;min-width:0"><b>' + esc(info.name) + '</b><small>' + esc(info.sub) + (cb && cb.init != null ? ' · inic. ' + cb.init : '') + '</small></span><button class="icon-btn sm" type="button" data-act="maptokx" aria-label="Cerrar"><svg class="ic"><use href="#i-x"/></svg></button></div>';
    if (cb) h += combatHtml(t, cb, r);
    if (can) h += '<details class="map-tok-more"' + (cb ? '' : ' open') + '><summary>Ficha en el mapa</summary><div class="map-tok-b"><label>Tamaño<select class="field" data-tokset="s">' + TSIZE.map(function(x){ return '<option value="' + x[0] + '"' + (t.s === x[0] ? ' selected' : '') + '>' + x[1].split(' (')[0] + '</option>'; }).join('') + '</select></label>'
      + '<div class="swatches" role="group" aria-label="Color">' + TOKCOL.map(function(c){ return '<button type="button" class="sw" data-act="maptokcol" data-v="' + c + '" style="background:' + c + '" aria-pressed="' + (t.color === c) + '" aria-label="Color ' + c + '"></button>'; }).join('') + '</div>'
      + '<div class="row" style="gap:6px;flex-wrap:wrap">' + (room() ? '<label class="btn sm pickbtn">' + (busyUp ? 'Subiendo…' : t.img ? 'Cambiar retrato' : 'Retrato') + '<input type="file" id="mapTokImg" accept="image/*"></label>' + (t.img ? '<button class="btn sm" type="button" data-act="maptoknoimg">Sin retrato</button>' : '') : '') + (dm && room() ? '<button class="btn sm" type="button" data-act="maptokhide">' + (t.hidden ? 'Mostrar a los jugadores' : 'Ocultar a los jugadores') + '</button>' : '') + '<button class="btn sm" type="button" data-act="maptokdel">Quitar del mapa</button></div></div></details>';
    put(p, h); p.hidden = false;
  }
  function combatant(r, id){
    var m = r.members.filter(function(x){ return x.id === id && x.role !== 'dm'; })[0]; if (m) return {pc:true, id:id, init:m.init, m:m};
    var n = (r.npcs || []).filter(function(x){ return x.id === id; })[0]; return n ? {pc:false, id:id, init:n.init, n:n} : null;
  }
  function combatHtml(t, cb, r){
    var dm = isDm(), C2 = Sala.COND || {}, h = '<div class="tok-fight">';
    if (dm && !cb.pc) {
      var n = cb.n;
      h += '<div class="tok-hp"><b>' + n.hp + '</b><small>/ ' + n.hpMax + ' PG' + (n.temp ? ' · +' + n.temp : '') + ' · CA ' + n.ac + '</small></div>'
        + '<div class="quick">' + [-10, -5, -1, 1, 5].map(function(d){ return '<button type="button" class="' + (d < 0 ? 'm' : 'p') + '" data-act="salanpchp" data-id="' + attr(n.id) + '" data-v="' + d + '">' + (d > 0 ? '+' : '−') + Math.abs(d) + '</button>'; }).join('') + '</div>'
        + '<div class="tok-row"><label>Inic.<input class="field" data-salainit="' + attr(n.id) + '" inputmode="numeric" value="' + (n.init == null ? '' : n.init) + '" aria-label="Iniciativa de ' + attr(n.name) + '"></label><select class="field" data-npccond="' + attr(n.id) + '" aria-label="Agregar estado"><option value="">+ Estado…</option>' + Object.keys(C2).filter(function(k){ return (n.conds || []).indexOf(k) < 0; }).map(function(k){ return '<option value="' + k + '">' + C2[k] + '</option>'; }).join('') + '</select></div>'
        + ((n.conds || []).length ? '<div class="sala-conds">' + n.conds.map(function(k){ return '<button type="button" class="chip" data-act="salacondoff" data-id="' + attr(n.id) + '" data-v="' + k + '">' + esc(C2[k] || k) + ' ×</button>'; }).join('') + '</div>' : '')
        + '<div class="tok-row">' + (n.ref ? '<button class="btn sm" type="button" data-act="bestref" data-ref="' + attr(n.ref) + '">Ficha</button>' : '') + '<button class="btn sm" type="button" data-act="salareveal" data-id="' + attr(n.id) + '">' + (n.hidden ? 'Mostrar en el combate' : 'Ocultar del combate') + '</button></div>';
    } else if (dm && cb.pc) {
      h += '<div class="tok-row"><label>Inic.<input class="field" data-salainit="' + attr(cb.id) + '" inputmode="numeric" value="' + (cb.init == null ? '' : cb.init) + '" aria-label="Iniciativa"></label></div>';
    } else {
      h += '<form class="tok-apply" data-form="mapapply" data-id="' + attr(cb.id) + '"><input class="field" name="amount" inputmode="numeric" autocomplete="off" placeholder="Total" aria-label="Cantidad"><button class="btn dmg sm" type="submit" data-kind="damage">Daño</button><button class="btn heal sm" type="submit" data-kind="heal">Curar</button></form>'
        + '<div class="tok-row"><select class="field" name="cond" form="" data-mapcond="' + attr(cb.id) + '" aria-label="Aplicar condición"><option value="">Condición…</option>' + Object.keys(C2).map(function(k){ return '<option value="' + k + '">' + C2[k] + '</option>'; }).join('') + '</select></div>';
    }
    return h + '</div>';
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
    var hh = Math.max(300, Math.min(1600, (window.innerHeight || 800) - top - (document.querySelector('.app.camp-wide') ? 0 : 12))), dpr = window.devicePixelRatio || 1;
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
    if (v.s >= 40 || selTok === t.id || info.turn) { var fs = Math.max(10, Math.min(15, v.s * 0.38)); var lbl = info.name.length > 14 ? info.name.slice(0, 13) + '…' : info.name; c.font = '600 ' + fs + 'px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'top'; c.lineWidth = 3; c.strokeStyle = 'rgba(243,233,210,.9)'; var ly = cy + rad + 3; c.strokeText(lbl, cx, ly); c.fillStyle = '#2b1d12'; c.fillText(lbl, cx, ly); }
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
      cur = id; layersOpen = false; pop = null; selTok = null; mode = 'jugar'; var box = document.getElementById('mesaMaps'); if (box && visible()) editor(box); else if (box) { box.innerHTML = ''; }
      badge();
    });
  }
  function center(mp, s){ s = s || 1; var c = toMap((canvas ? canvas.clientWidth : 300) / 2, (canvas ? canvas.clientHeight : 300) / 2); return [Math.max(0, Math.min(mp.cols - s, Math.round(c[0] - s / 2))), Math.max(0, Math.min(mp.rows - s, Math.round(c[1] - s / 2)))]; }
  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('[data-act]'); if (!b || b.dataset.act.indexOf('map') !== 0) return;
    var a = b.dataset.act, mp = cur && maps[cur];
    if (a === 'mapnew') { newOpen = b.dataset.v || (room() && isDm() ? 'dm' : 'pj'); newImg = b.dataset.src === 'img' ? {cols:30} : null; render(); var f0 = $('form[data-form="mapnew"] [name=name]'); if (f0) try { f0.focus(); } catch(e){} }
    else if (a === 'mapnewx') { newOpen = false; newImg = null; render(); }
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
    else if (a === 'mapmode') { mode = b.dataset.v; if (mode === 'dibujar' && (tool.k === 'pan' || !tool.k)) tool.k = 'pen'; pop = null; toolbar(); paint(); }
    else if (a === 'mapset') { pop = pop === 'set' ? null : 'set'; toolbar(); }
    else if (a === 'mapadd') { pop = pop === 'add' ? null : 'add'; toolbar(); }
    else if (a === 'mappen') { if (tool.k !== 'pen') { tool.k = 'pen'; pop = 'pen'; } else pop = pop === 'pen' ? null : 'pen'; toolbar(); }
    else if (a === 'mappopx') { pop = null; toolbar(); }
    else if (a === 'maplayeredit') { layersOpen = !layersOpen; toolbar(); }
    else if (a === 'mapplaceall') placeAll(mp);
    else if (a === 'mapsheet') { if (window.Mesa) Mesa.show('combate'); if (window.Diario) Diario.renderCombat(); }
    else if (a === 'mapchip') { var tc = mp.tokens.filter(function(t){ return t.ref === b.dataset.id && !t.comp; })[0]; if (tc) { focus(mp, tc); selTok = tc.id; paint(); tokPanel(); } else Sala.toast(isDm() ? 'No tiene ficha en este mapa: usa «Poner en el mapa».' : 'No está en este mapa.'); }
    else if (a === 'mapputme') {
      var s = Sala.summary ? Sala.summary() : null, t = myTok(mp), c = center(mp);
      if (t) { tokMove(mp, t, c[0], c[1]); selTok = t.id; tokPanel(); }
      else tokAdd(mp, {kind:'pc', name: s ? s.name : 'Yo', x:c[0], y:c[1], s:1, color:TOKCOL[1], mine:!shared(mp.id)});
    }
    else if (a === 'mapfindme') { var me2 = myTok(mp); if (me2) { focus(mp, me2); selTok = me2.id; paint(); tokPanel(); } }
    else if (a === 'maptool') { tool.k = b.dataset.v; if (pop === 'pen') pop = null; toolbar(); }
    else if (a === 'mapcolor') { tool.c = b.dataset.v; if (tool.k === 'pan' || tool.k === 'erase') tool.k = 'pen'; toolbar(); }
    else if (a === 'mapw') { tool.w = +b.dataset.v; toolbar(); }
    else if (a === 'maplayer') { tool.layer = b.dataset.v; var hd = hidden[mp.id] = hidden[mp.id] || {}; delete hd[tool.layer]; toolbar(); paint(); }
    else if (a === 'mapeye') { var hh = hidden[mp.id] = hidden[mp.id] || {}; hh[b.dataset.v] = !hh[b.dataset.v]; toolbar(); paint(); }
    else if (a === 'maplayers') { pop = pop === 'layers' ? null : 'layers'; toolbar(); }
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
    var f = ev.target, k = f.dataset && f.dataset.form; if (k !== 'mapnew' && k !== 'maptext' && k !== 'maptok' && k !== 'mapapply') return; ev.preventDefault();
    if (k === 'mapapply') { var amt = parseInt(f.elements.amount.value, 10); if (!(amt > 0)) { f.elements.amount.focus(); return; } var kd = ev.submitter && ev.submitter.dataset.kind || 'damage'; if (Sala.send({t:'apply', kind:kd, amount:amt, cond:null, note:'', targets:[f.dataset.id]})) { f.elements.amount.value = ''; Sala.toast((kd === 'heal' ? 'Curaste ' : 'Hiciste ') + amt + (kd === 'heal' ? ' PG.' : ' de daño.')); } return; }
    if (k === 'mapnew') {
      var hide = !!(f.elements.hidden && f.elements.hidden.checked), name = f.elements.name.value.trim();
      if (newImg) {
        if (!newImg.file) return;
        var cols = Math.max(8, Math.min(160, parseInt(f.elements.cols.value, 10) || 30)), rows = Math.max(8, Math.min(160, Math.round(cols * newImg.h / newImg.w)));
        var mp = newMap({name:name || newImg.file.name.replace(/\.\w+$/, ''), cols:cols, rows:rows, grid:'square', hidden:hide}), file = newImg.file;
        newOpen = false; newImg = null; cur = mp.id; mode = 'jugar'; pop = null;
        var box = document.getElementById('mesaMaps'); if (box) editor(box);
        setBg(mp, file);
        return;
      }
      var mp2 = newMap({name:name, size:f.elements.size.value, grid:f.elements.grid.value, hidden:hide}); newOpen = false; cur = mp2.id; mode = 'dibujar'; tool.k = 'pen'; pop = null; var box2 = document.getElementById('mesaMaps'); if (box2) editor(box2); return;
    }
    var m = maps[cur]; if (!m) return;
    if (k === 'maptok') {
      var who = f.elements.who ? f.elements.who.value : 'obj', nm = f.elements.name.value.trim(), sz = +f.elements.s.value || 1, col = (f.querySelector('input[name="color"]:checked') || {}).value || TOKCOL[0], c = center(m, sz), r = room();
      var tok = {kind:'obj', name:nm || 'Ficha', x:c[0], y:c[1], s:sz, color:col, hidden:!!(f.elements.hidden && f.elements.hidden.checked)};
      if (who.indexOf('npc:') === 0) { var n = (r.npcs || []).filter(function(x){ return 'npc:' + x.id === who; })[0]; tok.kind = 'npc'; tok.ref = n.id; tok.name = nm || n.name; if (n.hidden) tok.hidden = true; }
      else if (who.indexOf('pc:') === 0) { var pm = r.members.filter(function(x){ return 'pc:' + x.id === who; })[0]; tok.kind = 'pc'; tok.ref = pm.id; tok.name = nm || (pm.char ? pm.char.name : pm.name); tok.color = col; }
      else if (who === 'comp') { tok.kind = 'pc'; tok.comp = 1; tok.name = nm || 'Compañero'; }
      tokAdd(m, tok); pop = null; toolbar(); return;
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
    if (t.dataset && t.dataset.mapcond && t.value) { if (Sala.send({t:'apply', kind:'cond+', amount:0, cond:t.value, note:'', targets:[t.dataset.mapcond]})) Sala.toast('Aplicaste ' + ((Sala.COND || {})[t.value] || t.value) + '.'); t.value = ''; return; }
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
