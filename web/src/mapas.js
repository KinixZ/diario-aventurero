/* ==================== MAPAS: TABLERO VIRTUAL ==================== */
/* Lienzos con cuadrícula, capas, fichas y niebla. En una campaña cada mapa tiene un estado que pone el DM:
   Preparación — solo el DM lo ve: lo arma, prepara encuentros y coloca enemigos.
   Exploración — cada quien mueve su ficha (con paredes, visión y zonas); el DM puede congelar el movimiento.
   Combate     — antes de empezar, cada quien se acomoda en su zona de despliegue y tira iniciativa; luego, cada quien en su turno.
   Encima de cualquier estado van las herramientas: Dibujar (lápiz, líneas, objetos, paredes, zonas por capas) y
   Escena (solo el DM: niebla, luz y hora, clima). Mantén presionado para señalar un punto.
   Con un encuentro abierto (Encuentros → Colocar en el mapa) el DM acomoda sus enemigos, oleadas y zonas de despliegue.
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
  // paredes: [tipo, nombre, icono, qué hace, solo DM]
  var WALLT = [['wall','Pared','i-wall','Tapa la vista y el paso.'],['door','Puerta','i-door','Se abre y se cierra; cerrada tapa todo.'],['secret','Puerta secreta','i-secret','Para los jugadores es pared hasta que la encuentran.',1],['window','Ventana','i-window','Se ve a través, no se pasa.'],['oneway','Un sentido','i-oneway','Se ve solo desde el lado de la flecha.'],['low','Muro bajo','i-lowwall','No tapa la vista ni el paso; dará cobertura.'],['curtain','Cortina','i-curtain','Tapa la vista; se puede cruzar.'],['barrier','Barrera invisible','i-barrier','Nadie la ve ni tapa la vista; no deja pasar.',1]];
  var WCOL = {wall:'#e8c26a', door:'#e0873a', secret:'#d070e0', window:'#5fc6e8', oneway:'#f0d040', low:'#7cc86a', curtain:'#a98ae8', barrier:'#5b9cf0'};
  var RANGES = [[0,'Sin límite'],[4,'6 m'],[8,'12 m'],[12,'18 m'],[20,'30 m'],[40,'60 m']];
  var maps = {}, cur = null, mode = 'jugar', tool = {k:'pen', c:COLORS[0][0], w:0.14, snap:true, fill:false, layer:null, fogV:1, wt:'wall', wroom:false, sc:'niebla', zk:'paso'}, hidden = {}, views = {}, asked = {};
  var locked = {}; // capas bloqueadas por mapa (solo en tu vista)
  var newOpen = false, layersOpen = false, pendingText = null, selTok = null, pings = [], imgs = {}, fogCache = {}, newImg = null, busyUp = false;
  var waitOpen = null, canvas = null, ptr = {}, gesture = null, drawing = null, erasing = null, drag = null, fogDrag = null, press = null, raf = 0;
  var edOn = false; // un gesto del editor (seleccionar, mover, girar…) en curso
  var gl = null, glRaf = 0, fogSeq = 0, preloaded = false; // motor WebGL (mapa-gl.js) cuando el aparato lo permite; si no, Canvas 2D
  var selZone = null, zop = null, ask = null; // zona elegida, gesto de zona y la pregunta abierta (subir, leer…)
  var encEd = null, eop = null, encPend = null; // el encuentro que el DM acomoda en el mapa ({id, k:'npc'|'deploy', wave, pick, sel, zsel}) y su gesto
  var selWall = null, wop = null, viewAs = false, doorAnim = {}, visCache = {}, visSeq = 0; // paredes elegida y en edición; el DM viendo como jugador

  /* ---------- Guardado en el dispositivo ---------- */
  function idb(){ return new Promise(function(res, rej){ var r = indexedDB.open('diario5e', 2); r.onupgradeneeded = function(){ if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); }; r.onsuccess = function(){ res(r.result); }; r.onerror = function(){ rej(r.error); }; }); }
  function idbGet(k){ return idb().then(function(db){ return new Promise(function(res){ var q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = function(){ res(q.result); }; q.onerror = function(){ res(null); }; }); }).catch(function(){ return null; }); }
  function idbPut(k, v){ return idb().then(function(db){ return new Promise(function(res){ var t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = function(){ res(true); }; t.onerror = function(){ res(false); }; }); }).catch(function(){ return false; }); }
  function idbDel(k){ return idb().then(function(db){ return new Promise(function(res){ var t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = function(){ res(true); }; }); }).catch(function(){ return false; }); }
  function index(){ try { return JSON.parse(localStorage.getItem(IDX) || '[]'); } catch(e){ return []; } }
  function setIndex(a){ try { localStorage.setItem(IDX, JSON.stringify(a)); } catch(e){} }
  var saveT = {};
  function norm(mp){ if (!mp.tokens) mp.tokens = []; if (!mp.fog) mp.fog = {on:false, cells:''}; if (!mp.layers || !mp.layers.length) mp.layers = [{id:'l1', name:'Terreno'}]; if (!mp.strokes) mp.strokes = []; if (!mp.walls) mp.walls = []; if (!mp.vis) mp.vis = {on:false, range:0, lines:'auto'}; if (mp.wrev == null) mp.wrev = 0; if (!mp.light) mp.light = {time:'dia', amb:'auto', wx:'despejado'}; if (!mp.trig) mp.trig = []; return mp; }
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
  /* Estado del mapa (en tu copia siempre se explora) y si su combate ya empezó */
  var STATES = [['prep','Preparación','i-prep','Solo tú lo ves: ármalo, prepara encuentros y coloca enemigos.'],['explore','Exploración','i-compass','Cada quien mueve su ficha; las paredes, la visión y las zonas cuentan.'],['combat','Combate','i-swords','Se acomodan, tiran iniciativa y cada quien se mueve en su turno.']];
  function stateOf(mp){ if (!mp || !shared(mp.id)) return 'explore'; var m = roomMeta(mp.id); return mp.state || (m && m.state) || (mp.hidden || (m && m.hidden) ? 'prep' : 'explore'); }
  function started(mp){ var r = room(); return !!r && r.round > 0 && (!r.split || r.fight === mp.id); }
  function deploying(mp){ return stateOf(mp) === 'combat' && !started(mp); }
  function deployZ(mp, owner){ return (mp.trig || []).filter(function(z){ return z.k === 'despliegue' && (!z.for || !owner || z.for === owner); }); }
  function inDeploy(zs, x, y, s){ return zs.some(function(z){ return s <= z.w && s <= z.h ? x >= z.x - 0.01 && y >= z.y - 0.01 && x + s <= z.x + z.w + 0.01 && y + s <= z.y + z.h + 0.01 : x + s / 2 >= z.x && x + s / 2 <= z.x + z.w && y + s / 2 >= z.y && y + s / 2 <= z.y + z.h; }); }
  function ownerOf(t){ return t.kind === 'pc' && !t.comp ? t.ref : t.by; }
  /* ¿Puede un jugador mover esta ficha ahora? (el servidor decide; esto evita el viaje de ida y vuelta) */
  function moveBlock(mp, t){
    if (master(mp) || !shared(mp.id)) return null;
    if (mp.frozen) return 'El DM detuvo el movimiento por ahora.';
    if (stateOf(mp) !== 'combat' || !started(mp) || mp.turnOnly === false) return null;
    var r = room(); return r.turnId && r.turnId !== ownerOf(t) ? 'Espera tu turno para moverte.' : null;
  }
  function master(mp){ return !shared(mp.id) || isDm(); } // niebla, fichas de enemigos, ocultar
  function mine(t){ var mp = maps[cur]; return !mp || !shared(mp.id) || isDm() || t.by === me() || t.ref === me(); }
  function visible(){ var c = document.getElementById('combat'); return c && !c.hidden && c.getAttribute('data-tab') === 'mapas'; }
  function repaintIfCur(id){ if (cur === id) { paint(); tokPanel(); } }
  if (window.Sala) {
    Sala.on('state', function(r){
      if (!preloaded && window.Gfx) { preloaded = true; setTimeout(Gfx.preload, 1500); } // el motor del mapa se baja en segundo plano al entrar a la campaña
      (r.maps || []).forEach(function(m){
        if (maps[m.id] && m.state) { maps[m.id].state = m.state; maps[m.id].frozen = !!m.frozen; maps[m.id].hidden = !!m.hidden; }
        var have = maps[m.id] || index().filter(function(x){ return x.id === m.id; })[0];
        if ((!have || (have.updated || 0) < m.updated) && asked[m.id] !== m.updated) { asked[m.id] = m.updated; Sala.send({t:'map.get', id:m.id}); }
      });
      if (cur && maps[cur] && maps[cur].room && !roomMeta(cur) && maps[cur].room === r.code) { var gone = maps[cur]; cur = null; canvas = null; dropGL(); if (visible()) { render(); Sala.toast('El DM ocultó «' + gone.name + '».'); } }
      if (visible() && !cur) render();
      if (visible() && cur) { toolbar(); paint(); tokPanel(); }
      badge();
    });
    Sala.on('map', function(m){ var mp = norm(m.map); mp.room = room() && room().code; keep(mp); if (waitOpen === mp.id) { waitOpen = null; openMap(mp.id); return; } if (cur === mp.id) { toolbar(); paint(); } else if (visible() && !cur) render(); });
    Sala.on('map.add', function(m){ var mp = maps[m.id]; if (!mp) return; putStroke(mp, m.stroke); mp.updated = m.updated; keep(mp); if (cur === m.id) paint(); });
    Sala.on('map.upd', function(m){ var mp = maps[m.id]; if (!mp) return; (m.strokes || []).forEach(function(k){ putStroke(mp, k); }); mp.updated = m.updated; keep(mp); if (cur === m.id) { if (window.MapEd) MapEd.prune(mp); toolbar(); paint(); } });
    Sala.on('map.rm', function(m){ var mp = maps[m.id]; if (!mp) return; var set = {}; m.sids.forEach(function(x){ set[x] = 1; }); mp.strokes = mp.strokes.filter(function(k){ return !set[k.id]; }); mp.updated = m.updated; keep(mp); if (cur === m.id) paint(); });
    Sala.on('map.meta', function(m){ var mp = maps[m.id]; if (!mp) return; mp.name = m.name; mp.grid = m.grid; mp.layers = m.layers; var ok = {}; m.layers.forEach(function(l){ ok[l.id] = 1; }); mp.strokes = mp.strokes.filter(function(k){ return ok[k.l]; }); mp.updated = m.updated; keep(mp); if (cur === m.id) { toolbar(); paint(); } });
    Sala.on('map.bg', function(m){ var mp = maps[m.id]; if (!mp) return; mp.bg = m.bg; mp.updated = m.updated; keep(mp); if (cur === m.id) { toolbar(); paint(); } });
    Sala.on('map.fog', function(m){ var mp = maps[m.id]; if (!mp) return; mp.fog = m.fog; mp.updated = m.updated; keep(mp); if (cur === m.id) { toolbar(); paint(); } });
    Sala.on('walls', function(m){
      var mp = maps[m.id]; if (!mp) return; var now = Date.now();
      (m.put || []).forEach(function(w){
        var i = wallIdx(mp, w.id), old = i >= 0 ? mp.walls[i] : null;
        if (old && isDoorT(w) && !!old.open !== !!w.open) { doorAnim[w.id] = {t0:now, to:w.open ? 1 : 0}; if (cur === m.id && window.Sfx) Sfx.play('door'); }
        if (i >= 0) mp.walls[i] = w; else mp.walls.push(w);
      });
      if (m.del && m.del.length) { var set = {}; m.del.forEach(function(x){ set[x] = 1; }); mp.walls = mp.walls.filter(function(w){ return !set[w.id]; }); if (set[selWall]) selWall = null; }
      mp.wrev = (mp.wrev || 0) + 1; mp.updated = m.updated || mp.updated; keep(mp); if (cur === m.id) { toolbar(); paint(); animate(); }
    });
    Sala.on('trigs', function(m){
      var mp = maps[m.id]; if (!mp) return;
      (m.put || []).forEach(function(z){ var i = zoneIdx(mp, z.id); if (i >= 0) mp.trig[i] = z; else mp.trig.push(z); });
      if (m.del && m.del.length) { mp.trig = mp.trig.filter(function(z){ return m.del.indexOf(z.id) < 0; }); if (m.del.indexOf(selZone) >= 0) { selZone = null; if (pop === 'zone') pop = null; } }
      mp.updated = m.updated || mp.updated; keep(mp); if (cur === m.id) { toolbar(); paint(); }
    });
    Sala.on('trig', function(m){ trigEvent(m); });
    Sala.on('map.play', function(m){ var mp = maps[m.id]; if (!mp) return; mp.state = m.state; mp.frozen = !!m.frozen; mp.turnOnly = m.turnOnly !== false; mp.hidden = m.state === 'prep'; mp.updated = m.updated || mp.updated; keep(mp); if (cur === m.id) { toolbar(); paint(); } });
    /* El DM prepara un combate (o empieza un encuentro): quien está ahí se acomoda; quien no, se puede unir */
    Sala.on('combat', function(m){
      if (isDm()) return; var mp = m.map && maps[m.map], here = mp && myTok(mp);
      if (!m.map || here) { if (window.Fx) Fx.announce('¡Combate!', m.map ? 'Acomódate y tira iniciativa' : 'Tiren iniciativa', 'fight'); else Sala.toast('¡Combate! Tira iniciativa.'); if (window.Sfx) Sfx.play('turn'); if (m.map && cur !== m.map) Sala.toast('Hay combate en «' + m.name + '».', {act:'mapgoscene', v:m.map, label:'Ver mapa'}); return; }
      Sala.toast('El DM preparó un combate en «' + (m.name || 'otro mapa') + '».', {act:'mapjoin', v:m.map, label:'Unirme'}); if (window.Sfx) Sfx.play('turn');
    });
    Sala.on('wave', function(m){ if (window.Fx) Fx.announce('¡Refuerzos!', m.name || 'Llega la oleada ' + m.n, 'round'); else Sala.toast('¡Llegan refuerzos!'); if (window.Sfx) Sfx.play('turn'); });
    Sala.on('goto', function(m){ arrive(m.map, m.name); });
    Sala.on('map.light', function(m){ var mp = maps[m.id]; if (!mp) return; mp.light = m.light; mp.updated = m.updated; keep(mp); if (cur === m.id) { toolbar(); paint(); } });
    Sala.on('map.vis', function(m){ var mp = maps[m.id]; if (!mp) return; mp.vis = m.vis; if (m.vis.on) mp.fog.on = true; mp.updated = m.updated; keep(mp); if (cur === m.id) { toolbar(); paint(); } });
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
    var mp = {id:uid('mp'), name:o.name || 'Mapa nuevo', cols:o.cols || wh[0], rows:o.rows || wh[1], grid:o.grid || 'square', layers:[{id:'l1', name:'Capa 1'}], strokes:[], tokens:[], fog:{on:false, cells:''}, bg:null, created:Date.now(), updated:Date.now(), by:'yo', hidden:!!o.hidden};
    if (room()) { Sala.send({t:'map.save', map:mp}); mp.room = room().code; mp.by = me(); fresh[mp.id] = Date.now(); }
    keep(mp); return mp;
  }
  /* Trazos: el id lo pone el cliente y el cambio se ve al instante; en una campaña el servidor lo confirma a todos.
     addStroke y rmStrokes anotan en el historial (MapEd); addMany/updMany/rmIds no, porque los usa el propio historial. */
  function putStroke(mp, k){ var i = mp.strokes.findIndex(function(x){ return x.id === k.id; }); if (i >= 0) mp.strokes[i] = k; else mp.strokes.push(k); }
  function addMany(mp, list){
    if (!list.length) return; var sh = shared(mp.id);
    list.forEach(function(k){ if (!k.id) k.id = MapEd.newId(); k.by = sh ? me() : 'yo'; putStroke(mp, k); });
    if (sh) Sala.send({t:'map.add', id:mp.id, strokes:list}); else if (list.some(lightK)) exploreLocal(mp); mp.updated = Date.now(); keep(mp); paint();
  }
  function lightK(k){ return (k.k === 'asset' || k.k === 'img') && (k.lt ? !k.lt.off : !!(window.Vision && Vision.LIGHTS[k.a])); }
  function updMany(mp, list){
    if (!list.length) return; list.forEach(function(k){ delete k._p; putStroke(mp, k); });
    if (shared(mp.id)) Sala.send({t:'map.upd', id:mp.id, strokes:list}); else if (list.some(lightK)) exploreLocal(mp); mp.updated = Date.now(); keep(mp); paint();
  }
  function rmIds(mp, ids){
    if (!ids.length) return; var set = {}; ids.forEach(function(x){ set[x] = 1; });
    mp.strokes = mp.strokes.filter(function(k){ return !set[k.id]; });
    if (shared(mp.id)) Sala.send({t:'map.rm', id:mp.id, sids:ids}); mp.updated = Date.now(); keep(mp); paint();
  }
  function addStroke(mp, k){ addMany(mp, [k]); MapEd.record(mp, {add:[JSON.parse(JSON.stringify(k))]}); }
  function rmStrokes(mp, ids){
    if (!ids.length) return; var set = {}; ids.forEach(function(x){ set[x] = 1; });
    var gone = mp.strokes.filter(function(k){ return set[k.id]; }).map(function(k){ return JSON.parse(JSON.stringify(k)); });
    rmIds(mp, ids); if (gone.length) MapEd.record(mp, {rm:gone});
  }
  function undo(mp){
    if (MapEd.undo(mp)) return;
    Sala.toast('No hay nada tuyo que deshacer en este mapa.');
  }
  function setMeta(mp, o){
    if (shared(mp.id)) { o.t = 'map.meta'; o.id = mp.id; Sala.send(o); return; }
    if (o.name) mp.name = o.name; if (o.grid) mp.grid = o.grid; if (o.layers) { mp.layers = o.layers; var ok = {}; o.layers.forEach(function(l){ ok[l.id] = 1; }); mp.strokes = mp.strokes.filter(function(k){ return ok[k.l]; }); }
    mp.updated = Date.now(); keep(mp); toolbar(); paint();
  }
  function tokAdd(mp, t){
    if (shared(mp.id)) { Sala.send({t:'tok.add', id:mp.id, tok:t}); return; }
    t.id = uid('t'); t.by = 'yo'; mp.tokens.push(t); exploreLocal(mp, [t]); mp.updated = Date.now(); keep(mp); selTok = t.id; paint(); tokPanel();
  }
  function tokMove(mp, t, x, y, cells){
    if (shared(mp.id)) { t.x = x; t.y = y; paint(); Sala.send({t:'tok.move', id:mp.id, tid:t.id, x:x, y:y}); return; }
    var from = window.Vision ? Vision.center(t) : null, ox = t.x, oy = t.y; t.x = x; t.y = y; exploreLocal(mp, [t], from, cells); mp.updated = Date.now(); keep(mp); paint(); zonesLocal(mp, t, ox, oy);
  }
  function tokSet(mp, t, o){
    if (shared(mp.id)) { o.t = 'tok.set'; o.id = mp.id; o.tid = t.id; Sala.send(o); return; }
    Object.keys(o).forEach(function(k){ t[k] = o[k]; }); if ('lt' in o || 'sn' in o) exploreLocal(mp); mp.updated = Date.now(); keep(mp); paint(); tokPanel();
  }
  function tokDel(mp, t){
    if (shared(mp.id)) { Sala.send({t:'tok.del', id:mp.id, tid:t.id}); selTok = null; return; }
    mp.tokens = mp.tokens.filter(function(x){ return x !== t; }); selTok = null; keep(mp); paint(); tokPanel();
  }
  function fogDo(mp, msg){
    if (shared(mp.id)) { msg.id = mp.id; Sala.send(msg); return; }
    var bits = fogBits(mp).slice();
    if (msg.t === 'fog.on') { mp.fog.on = !!msg.value; if (!mp.fog.on) mp.vis.on = false; }
    else if (msg.t === 'fog.all') bits.fill(msg.value ? 255 : 0);
    else { var r = msg.rect; for (var y = Math.max(0, Math.min(r[1], r[3])); y <= Math.min(mp.rows - 1, Math.max(r[1], r[3])); y++) for (var x = Math.max(0, Math.min(r[0], r[2])); x <= Math.min(mp.cols - 1, Math.max(r[0], r[2])); x++) { var i = y * mp.cols + x; if (msg.value) bits[i >> 3] |= 1 << (i & 7); else bits[i >> 3] &= ~(1 << (i & 7)); } }
    if (msg.t !== 'fog.on') { mp.fog.cells = b64(bits); exploreLocal(mp); }
    mp.updated = Date.now(); keep(mp); toolbar(); paint();
  }
  function ping(mp, p){
    var col = mp && room() ? (myTok(mp) || {}).color || '#ffd66e' : '#ffd66e';
    if (shared(mp.id)) Sala.send({t:'map.ping', id:mp.id, x:p[0], y:p[1], color:col});
    else { pings.push({x:p[0], y:p[1], name:'', color:col, t:Date.now()}); animate(); }
  }

  /* ---------- Paredes y puertas ---------- */
  function wallIdx(mp, id){ for (var i = 0; i < mp.walls.length; i++) if (mp.walls[i].id === id) return i; return -1; }
  function wallById(mp, id){ var i = wallIdx(mp, id); return i >= 0 ? mp.walls[i] : null; }
  function isDoorT(w){ return w.t === 'door' || w.t === 'secret'; }
  function newWid(){ return 'w' + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 6); }
  function cloneW(w){ return JSON.parse(JSON.stringify(w)); }
  /* Se ven al instante; en la campaña el servidor las confirma a todos. wput/wrm no anotan en el historial (los usa el propio historial). */
  function wput(mp, list){
    list = list.filter(function(w){ return w && w.a && w.b && !(w.a[0] === w.b[0] && w.a[1] === w.b[1]); }); if (!list.length) return;
    list.forEach(function(w){ var i = wallIdx(mp, w.id); if (i >= 0) mp.walls[i] = w; else mp.walls.push(w); });
    mp.wrev = (mp.wrev || 0) + 1; mp.updated = Date.now();
    if (shared(mp.id)) Sala.send({t:'wall.add', id:mp.id, walls:list}); else exploreLocal(mp);
    keep(mp); toolbar(); paint();
  }
  function wrm(mp, ids){
    if (!ids.length) return; var set = {}; ids.forEach(function(x){ set[x] = 1; });
    mp.walls = mp.walls.filter(function(w){ return !set[w.id]; }); if (set[selWall]) selWall = null;
    mp.wrev = (mp.wrev || 0) + 1; mp.updated = Date.now();
    if (shared(mp.id)) Sala.send({t:'wall.rm', id:mp.id, wids:ids}); else exploreLocal(mp);
    keep(mp); toolbar(); paint();
  }
  function wallsAdd(mp, list){ wput(mp, list); MapEd.record(mp, {wadd:list.map(cloneW)}); }
  function wallsDel(mp, ids){ var set = {}; ids.forEach(function(x){ set[x] = 1; }); var gone = mp.walls.filter(function(w){ return set[w.id]; }).map(cloneW); if (!gone.length) return; wrm(mp, ids); MapEd.record(mp, {wrm:gone}); }
  function wallsUpd(mp, before, after){ if (!after.length) return; wput(mp, after); MapEd.record(mp, {wupd:{b:before.map(cloneW), a:after.map(cloneW)}}); }
  /* Abrir o cerrar: en la campaña lo decide el servidor (con llave no, de lejos no) y llega a todos con su animación */
  function doorToggle(mp, w, open){
    if (open == null) open = !w.open;
    if (shared(mp.id)) { Sala.send({t:'door', id:mp.id, wid:w.id, open:open}); return; }
    var n = cloneW(w); if (open) n.open = true; else delete n.open; if (n.t === 'secret' && open) n.found = true;
    doorAnim[w.id] = {t0:Date.now(), to:open ? 1 : 0}; if (window.Sfx) Sfx.play('door');
    mp.walls[wallIdx(mp, w.id)] = n; mp.wrev = (mp.wrev || 0) + 1; mp.updated = Date.now(); exploreLocal(mp); keep(mp); toolbar(); paint(); animate();
  }
  /* Un jugador toca una puerta: tiene que tener una ficha cerca y que no esté con llave */
  function doorClick(mp, w){
    if (!master(mp)) {
      if (w.lock && !w.open) { Sala.toast('Está cerrada con llave.'); if (window.Sfx) Sfx.play('locked'); return; }
      var near = mp.tokens.some(function(t){ if (t.hidden || !mine(t)) return false; var c = Vision.center(t); return Vision.segDist(c[0], c[1], w.a, w.b) <= 2 + (t.s || 1) / 2; });
      if (!near) { Sala.toast('Acércate a la puerta para abrirla.'); return; }
    }
    doorToggle(mp, w);
  }
  function doorAt(mp, m){
    if (!window.Vision || !mp.walls.length) return null; var dm = master(mp) && !viewAs, tol = Math.max(0.3, 16 / V().s), best = null, bd = tol, bits = mp.fog && mp.fog.on && !dm ? fogBits(mp) : null, vs = bits ? visOf(mp) : null;
    mp.walls.forEach(function(w){
      if (!(w.t === 'door' || (w.t === 'secret' && dm))) return;
      var d = Vision.segDist(m[0], m[1], w.a, w.b); if (d >= bd) return;
      // con niebla, solo las puertas que el grupo ya conoce (descubierta o a la vista alguna de sus dos caras)
      if (bits) {
        var mx = (w.a[0] + w.b[0]) / 2, my = (w.a[1] + w.b[1]) / 2, L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) || 1, nx = -(w.b[1] - w.a[1]) / L * 0.4, ny = (w.b[0] - w.a[0]) / L * 0.4;
        var known = [[mx + nx, my + ny], [mx - nx, my - ny]].some(function(q){ var cx = Math.min(mp.cols - 1, Math.max(0, Math.floor(q[0]))), cy = Math.min(mp.rows - 1, Math.max(0, Math.floor(q[1]))); return seen(bits, mp, cx, cy) || (vs && seenAt(vs, q[0], q[1])); });
        if (!known) return;
      }
      bd = d; best = w;
    });
    return best;
  }
  /* Ajustes de la visión (alcance, si los jugadores ven las líneas de pared) */
  function visDo(mp, o){
    if (shared(mp.id)) { o.t = 'map.vis'; o.id = mp.id; Sala.send(o); return; }
    if (o.on != null) mp.vis.on = !!o.on; if (o.range != null) mp.vis.range = o.range; if (o.lines) mp.vis.lines = o.lines;
    if (mp.vis.on) mp.fog.on = true; exploreLocal(mp); mp.updated = Date.now(); keep(mp); toolbar(); paint();
  }
  function linesOn(mp){ var l = mp.vis && mp.vis.lines || 'auto'; return l === 'yes' || (l === 'auto' && !mp.bg); }

  /* ---------- Zonas: pasos a otro mapa, trampas, textos y emboscadas ----------
     Un rectángulo de casillas {id, k, x, y, w, h, name, to:{map, zid}, lock, hidden, text, once, fired, say, all}.
     En la campaña las pone el DM y el servidor las dispara; en tu copia se disparan aquí mismo. */
  var ZK = [['paso','Paso a otro mapa','i-stairs','#e8c26a','Escalera, puerta o salida: lleva a otro mapa (pregunta antes).'],['trampa','Trampa','i-trap','#e0574a','Te avisa a ti cuando alguien la pisa (o la cruza).'],['texto','Texto','i-scroll','#5fa8e8','Una descripción que se lee al entrar.'],['encuentro','Emboscada','i-ambush','#b07ae8','Al entrar, aparecen los enemigos ocultos de este mapa.']];
  function zoneT(k){ return ZK.filter(function(x){ return x[0] === k; })[0] || ZK[0]; }
  function zoneIdx(mp, id){ for (var i = 0; i < mp.trig.length; i++) if (mp.trig[i].id === id) return i; return -1; }
  function zoneById(mp, id){ var i = zoneIdx(mp, id); return i >= 0 ? mp.trig[i] : null; }
  function newZid(){ return 'z' + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 6); }
  function zput(mp, z){
    var i = zoneIdx(mp, z.id); if (i >= 0) mp.trig[i] = z; else mp.trig.push(z);
    if (z.to && z.to.map) { var tm = maps[z.to.map] || roomMeta(z.to.map); z.toName = tm ? tm.name : ''; }
    if (shared(mp.id)) Sala.send({t:'trig.add', id:mp.id, trig:z}); mp.updated = Date.now(); keep(mp); toolbar(); paint();
  }
  function zrm(mp, id){ mp.trig = mp.trig.filter(function(z){ return z.id !== id; }); if (selZone === id) { selZone = null; if (pop === 'zone') pop = null; } if (shared(mp.id)) Sala.send({t:'trig.rm', id:mp.id, zid:id}); mp.updated = Date.now(); keep(mp); toolbar(); paint(); }
  function inZone(z, x, y){ return x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h; }
  function zoneAt(mp, m, kind){ for (var i = mp.trig.length - 1; i >= 0; i--) { var z = mp.trig[i]; if ((!kind || z.k === kind) && inZone(z, m[0], m[1])) return z; } return null; }
  /* Mapas a los que puede llevar un paso: los de la campaña (o los tuyos, sin campaña) */
  function otherMaps(mp){
    var r = room(), list = r && shared(mp.id) ? (r.maps || []).map(function(x){ return {id:x.id, name:x.name, hidden:x.hidden}; }) : index().filter(function(x){ return !x.room; }).map(function(x){ return {id:x.id, name:x.name}; });
    return list.filter(function(x){ return x.id !== mp.id; });
  }
  /* El panel de la zona elegida (todo se guarda al cambiar) */
  function zoneHtml(mp){
    var z = selZone && zoneById(mp, selZone); if (!z) return '';
    var T = zoneT(z.k), others = otherMaps(mp), tm = z.to && maps[z.to.map], tz = tm ? tm.trig || [] : [];
    var h = '<div class="zonepop" style="--zc:' + T[3] + '"><div class="row"><b><svg class="ic"><use href="#' + T[2] + '"/></svg>Zona</b><button class="icon-btn sm" type="button" data-act="mappopx" aria-label="Cerrar"><svg class="ic"><use href="#i-x"/></svg></button></div>'
      + '<div class="zone-kinds" role="group" aria-label="Qué hace">' + ZK.map(function(x){ return '<button type="button" data-act="mapzk" data-v="' + x[0] + '" aria-pressed="' + (z.k === x[0]) + '" style="--zc:' + x[3] + '" title="' + attr(x[4]) + '"><svg class="ic"><use href="#' + x[2] + '"/></svg>' + x[1].split(' ')[0] + '</button>'; }).join('') + '</div>'
      + '<p class="note">' + T[4] + '</p>'
      + '<label class="fl">Nombre<input class="field" id="mapZName" maxlength="50" value="' + attr(z.name || '') + '" placeholder="' + (z.k === 'paso' ? 'Escalera a la torre' : z.k === 'trampa' ? 'Foso con estacas' : z.k === 'texto' ? 'El altar' : 'Los goblins del puente') + '" autocomplete="off"></label>';
    if (z.k === 'paso') {
      h += '<div class="two"><label class="fl">Lleva a<select class="field" id="mapZMap"><option value="">Elige un mapa…</option>' + others.map(function(o){ return '<option value="' + attr(o.id) + '"' + (z.to && z.to.map === o.id ? ' selected' : '') + '>' + esc(o.name) + (o.hidden ? ' (oculto)' : '') + '</option>'; }).join('') + '</select></label>'
        + '<label class="fl">Llega a<select class="field" id="mapZTo"' + (z.to && z.to.map ? '' : ' disabled') + '><option value="">El centro del mapa</option>' + tz.filter(function(q){ return q.k === 'paso'; }).map(function(q){ return '<option value="' + attr(q.id) + '"' + (z.to && z.to.zid === q.id ? ' selected' : '') + '>' + esc(q.name || 'Paso sin nombre') + '</option>'; }).join('') + '</select></label></div>'
        + (z.to && z.to.map && !tz.some(function(q){ return q.k === 'paso' && q.to && q.to.map === mp.id; }) ? '<button class="btn sm" type="button" data-act="mapzback"><svg class="ic"><use href="#i-stairs"/></svg>Crear la vuelta en ese mapa</button>' : '')
        + '<label class="toggle"><input type="checkbox" id="mapZLock"' + (z.lock ? ' checked' : '') + '> Bloqueada: los jugadores no pasan</label>'
        + '<label class="toggle"><input type="checkbox" id="mapZHide"' + (z.hidden ? ' checked' : '') + '> Oculta para los jugadores</label>';
    } else {
      if (z.k !== 'encuentro') h += '<label class="fl">' + (z.k === 'trampa' ? 'Qué pasa (para ti)' : 'Lo que se lee') + '<textarea class="field" id="mapZText" rows="3" maxlength="600">' + esc(z.text || '') + '</textarea></label>';
      if (z.k === 'trampa') h += '<label class="toggle"><input type="checkbox" id="mapZSay"' + (z.say ? ' checked' : '') + '> Decírselo también al jugador</label>';
      if (z.k === 'texto') h += '<label class="toggle"><input type="checkbox" id="mapZAll"' + (z.all ? ' checked' : '') + '> A todos los del mapa (no solo a quien entra)</label>';
      h += '<label class="toggle"><input type="checkbox" id="mapZOnce"' + (z.once ? ' checked' : '') + '> Una sola vez</label>' + (z.fired ? '<button class="btn sm" type="button" data-act="mapzrearm">Ya se activó · rearmar</button>' : '');
    }
    return h + '<div class="dm-row"><button class="btn sm del" type="button" data-act="mapzdel"><svg class="ic"><use href="#i-trash"/></svg>Quitar la zona</button><span class="muted">' + z.w + ' × ' + z.h + ' casillas</span></div></div>';
  }
  /* Herramienta de zonas (Dibujar): arrastrar en vacío crea una; sobre una zona, la mueve; desde su esquina, la agranda */
  function zcell(mp, m){ return [Math.max(0, Math.min(mp.cols - 1, Math.floor(m[0]))), Math.max(0, Math.min(mp.rows - 1, Math.floor(m[1])))]; }
  function zoneDown(mp, m, ev){
    var sz = selZone && zoneById(mp, selZone), tol = (ev.pointerType === 'touch' ? 22 : 12) / V().s;
    if (sz && Math.hypot(m[0] - (sz.x + sz.w), m[1] - (sz.y + sz.h)) < tol) { zop = {k:'size', z:sz, orig:JSON.parse(JSON.stringify(sz)), m0:m, moved:false}; return; }
    var hit = zoneAt(mp, m);
    if (hit) { zop = {k:'move', z:hit, orig:JSON.parse(JSON.stringify(hit)), m0:m, moved:false}; return; }
    var c = zcell(mp, m); zop = {k:'new', a:c, b:c, m0:m, moved:false};
  }
  function zoneMove(mp, m){
    if (!zop.moved && Math.hypot(m[0] - zop.m0[0], m[1] - zop.m0[1]) * V().s < 6) return; zop.moved = true;
    if (zop.k === 'new') zop.b = zcell(mp, m);
    else if (zop.k === 'move') { var o = zop.orig, dx = Math.round(m[0] - zop.m0[0]), dy = Math.round(m[1] - zop.m0[1]); zop.z.x = Math.max(0, Math.min(mp.cols - o.w, o.x + dx)); zop.z.y = Math.max(0, Math.min(mp.rows - o.h, o.y + dy)); }
    else { var o2 = zop.orig; zop.z.w = Math.max(1, Math.min(mp.cols - o2.x, Math.round(m[0] - o2.x))); zop.z.h = Math.max(1, Math.min(mp.rows - o2.y, Math.round(m[1] - o2.y))); }
    paint();
  }
  function zoneUp(mp){
    var o = zop; zop = null;
    if (o.k === 'new') {
      if (!o.moved) { selZone = null; if (pop === 'zone') pop = null; toolbar(); paint(); return; }
      var z = {id:newZid(), k:tool.zk, x:Math.min(o.a[0], o.b[0]), y:Math.min(o.a[1], o.b[1]), w:Math.abs(o.a[0] - o.b[0]) + 1, h:Math.abs(o.a[1] - o.b[1]) + 1, name:''};
      if (z.k !== 'paso') z.once = z.k !== 'texto';
      zput(mp, z); selZone = z.id; pop = 'zone'; if (window.Sfx) Sfx.play('click'); toolbar(); paint(); return;
    }
    if (!o.moved) { selZone = o.z.id; pop = 'zone'; toolbar(); paint(); return; }
    zput(mp, o.z); selZone = o.z.id;
  }
  /* Lo que llega del servidor (o de tu copia) cuando alguien entra a una zona */
  function trigEvent(m){
    var mp = maps[m.id], mapName = mp ? mp.name : '';
    if (m.dm) {
      var verb = m.k === 'trampa' ? '⚠ ' + m.who + ' activó ' + (m.name || 'una trampa') : m.k === 'texto' ? m.who + ' llegó a ' + (m.name || 'una zona de texto') : '¡' + (m.name || 'Emboscada') + '! Aparecen los enemigos';
      if (window.Sfx) Sfx.play(m.k === 'trampa' ? 'hit' : m.k === 'encuentro' ? 'turn' : 'page');
      Sala.toast(verb + (mapName && cur !== m.id ? ' (' + mapName + ')' : '') + (m.k === 'trampa' && m.text ? ': ' + m.text : ''), cur !== m.id ? {act:'mapgoscene', v:m.id, label:'Ver'} : null);
      return;
    }
    if (m.k === 'paso') { askShow({k:'paso', map:m.id, zid:m.zid, title:m.name || 'Una salida', text:m.lock ? 'Está bloqueado: por ahora no se puede pasar.' : 'Lleva a «' + (m.to && m.to.name || 'otro mapa') + '». ¿Pasas?', go:!m.lock, icon:'i-stairs'}); return; }
    if (m.k === 'encuentro') { if (window.Fx) Fx.announce(m.name || '¡Emboscada!', 'Tiren iniciativa'); else Sala.toast('¡' + (m.name || 'Emboscada') + '!'); return; }
    if (window.Sfx) Sfx.play(m.k === 'trampa' ? 'hit' : 'page');
    askShow({k:m.k, title:m.name || (m.k === 'trampa' ? '¡Trampa!' : 'Al entrar…'), text:m.text || '', icon:m.k === 'trampa' ? 'i-trap' : 'i-scroll'});
  }
  /* Tarjeta en medio del mapa: pregunta para subir o bajar, o texto que se lee */
  function askShow(o){ ask = o; askPaint(); }
  function askPaint(){
    var el = $('#mapAsk'); if (!el) return; if (!ask) { el.hidden = true; el.innerHTML = ''; return; }
    var o = ask;
    el.className = 'map-ask k-' + o.k; el.hidden = false;
    el.innerHTML = '<div class="ask-card" role="dialog" aria-live="polite"><div class="ask-h"><svg class="ic"><use href="#' + (o.icon || 'i-scroll') + '"/></svg><b>' + esc(o.title) + '</b></div>' + (o.text ? '<p>' + esc(o.text).replace(/\n/g, '<br>') + '</p>' : '')
      + '<div class="ask-b">' + (o.k === 'paso' && o.go ? '<button class="btn main" type="button" data-act="mapaskgo">' + (o.dm ? 'Llevar a todos' : 'Pasar') + '</button>' + (o.dm ? '<button class="btn" type="button" data-act="mapaskopen">Ver ese mapa</button>' : '') + '<button class="btn" type="button" data-act="mapaskno">Quedarme</button>' : '<button class="btn main" type="button" data-act="mapaskno">' + (o.k === 'paso' ? 'Entendido' : 'Seguir') + '</button>') + '</div></div>';
    if (window.Fx && Fx.pop) try { Fx.pop(el.firstChild); } catch(e){}
  }
  /* Tocar un paso en modo Jugar: el jugador (de cerca) pregunta si pasa; el DM puede llevar a todos */
  function zoneClick(mp, z){
    if (master(mp) && shared(mp.id)) { askShow({k:'paso', dm:true, map:mp.id, zid:z.id, title:z.name || 'Paso', text:z.to ? 'Lleva a «' + (z.toName || (maps[z.to.map] || {}).name || 'otro mapa') + '».' : 'Todavía no lleva a ningún mapa (ponlo en Dibujar → Zonas).', go:!!z.to, icon:'i-stairs'}); return; }
    if (z.lock) { Sala.toast('Está bloqueado.'); if (window.Sfx) Sfx.play('locked'); return; }
    var t = myTok(mp); if (!t) { Sala.toast('Primero pon tu ficha en el mapa.'); return; }
    var c = Vision.center(t), dx = Math.max(z.x - c[0], 0, c[0] - (z.x + z.w)), dy = Math.max(z.y - c[1], 0, c[1] - (z.y + z.h));
    if (Math.max(dx, dy) > 1.5) { Sala.toast('Acércate a ' + (z.name ? '«' + z.name + '»' : 'la salida') + '.'); return; }
    askShow({k:'paso', map:mp.id, zid:z.id, title:z.name || 'Una salida', text:z.to ? 'Lleva a «' + (z.to.name || z.toName || (maps[z.to.map] || {}).name || 'otro mapa') + '». ¿Pasas?' : 'No lleva a ningún lado todavía.', go:!!z.to, icon:'i-stairs'});
  }
  /* Pasar: en la campaña lo hace el servidor; en tu copia se mueven las fichas de un mapa al otro */
  function travel(mpId, zid, all){
    var mp = maps[mpId]; if (!mp) return;
    if (shared(mp.id)) { var msg = {t:'travel', id:mp.id, zid:zid}; if (all) msg.all = true; Sala.send(msg); return; }
    var z = zoneById(mp, zid); if (!z || !z.to) return;
    load(z.to.map).then(function(dest){
      if (!dest) { Sala.toast('Ese mapa ya no está en este aparato.'); return; }
      var toks = mp.tokens.filter(function(t){ return t.kind === 'pc'; }), az = z.to.zid && zoneById(dest, z.to.zid), ax = az ? az.x + az.w / 2 : dest.cols / 2, ay = az ? az.y + az.h / 2 : dest.rows / 2, used = {};
      dest.tokens.forEach(function(t){ used[Math.round(t.x) + ',' + Math.round(t.y)] = 1; });
      toks.forEach(function(t){
        mp.tokens = mp.tokens.filter(function(x){ return x !== t; }); var s = t.s || 1, bx = Math.round(ax - s / 2), by = Math.round(ay - s / 2), p = null;
        for (var r = 0; r < 24 && !p; r++) for (var dy = -r; dy <= r && !p; dy++) for (var dx = -r; dx <= r && !p; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; var x = bx + dx, y = by + dy; if (x < 0 || y < 0 || x > dest.cols - s || y > dest.rows - s || used[x + ',' + y]) continue; used[x + ',' + y] = 1; p = [x, y]; }
        p = p || [Math.max(0, bx), Math.max(0, by)]; t.x = p[0]; t.y = p[1]; dest.tokens.push(t);
      });
      exploreLocal(dest); mp.updated = dest.updated = Date.now(); keep(mp); keep(dest); arrive(dest.id, dest.name);
    });
  }
  /* Llegar a otro mapa: se abre (si estás viendo los mapas) */
  function arrive(id, name){
    ask = null;
    var cb = document.getElementById('combat'), open = cb && !cb.hidden;
    if (open && (visible() || !document.querySelector('#combat .mesa-p:focus-within'))) { if (window.Mesa) Mesa.show('mapas'); openMap(id); Sala.toast('Llegas a «' + (name || 'otro mapa') + '».'); }
    else Sala.toast('Llegas a «' + (name || 'otro mapa') + '».', {act:'mapgoscene', v:id, label:'Ver mapa'});
  }
  /* En tu copia, las zonas se disparan aquí: al mover una ficha del grupo */
  function zonesLocal(mp, t, ox, oy){
    if (shared(mp.id) || !mp.trig.length || t.kind !== 'pc') return;
    var s = t.s || 1, ax = ox + s / 2, ay = oy + s / 2, bx = t.x + s / 2, by = t.y + s / 2, n = Math.min(400, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 2)), hit = {};
    var before = mp.trig.filter(function(z){ return inZone(z, ax, ay); }).map(function(z){ return z.id; });
    for (var i = 1; i <= n; i++) { var px = ax + (bx - ax) * i / n, py = ay + (by - ay) * i / n; mp.trig.forEach(function(z){ if (before.indexOf(z.id) < 0 && inZone(z, px, py)) hit[z.id] = z; }); }
    Object.keys(hit).forEach(function(k){
      var z = hit[k]; if (z.k === 'paso') { if (inZone(z, bx, by) && z.to) zoneClick(mp, z); return; }
      if (z.once && z.fired) return; z.fired = true;
      if (z.k === 'encuentro') mp.tokens.forEach(function(x){ if (x.hidden && x.kind === 'npc') x.hidden = false; });
      trigEvent({id:mp.id, k:z.k, name:z.name, text:z.text || '', who:t.name});
    });
  }

  /* ---------- Encuentro abierto en el mapa: el DM acomoda enemigos (por oleada) y zonas de despliegue ----------
     Los datos viven en Encuentros (encuentros.js); aquí solo se dibujan y se arrastran. Cada cambio se guarda solo. */
  function encData(){ return encEd && window.Encuentros ? Encuentros.get(encEd.id) : null; }
  function encHere(mp){ var e = encData(); return !!(e && mp && e.map === mp.id); }
  function encSave(e){ if (window.Encuentros) Encuentros.put(e); toolbar(); paint(); }
  function encGhosts(){
    var e = encData(); if (!e) return [];
    return e.npcs.filter(function(d){ return d.x != null; }).map(function(d){ var nm = d.name + (d.wave > 1 ? ' · O' + d.wave : ''); return {id:'E:' + d.k, x:d.x, y:d.y, s:d.s || 1, color:d.color || '#8c2626', img:d.img ? Mesa.imgUrl(d.img) : null, imgId:d.img || null, ini:ini(d.name), name:nm, pct:null, turn:false, down:false, hidden:d.wave !== encEd.wave || !!d.hidden, sel:encEd.sel === d.k, late:false, label:true}; });
  }
  function encHit(e, m){ var hit = null; e.npcs.forEach(function(d){ if (d.x == null) return; var s = d.s || 1; if (Math.hypot(m[0] - (d.x + s / 2), m[1] - (d.y + s / 2)) <= Math.max(s * 0.5 + 0.15, 24 / V().s)) hit = d; }); return hit; }
  function encDown(mp, m, ev, p){
    var e = encData(); if (!e) return; var tol = (ev.pointerType === 'touch' ? 22 : 12) / V().s;
    if (encEd.k === 'deploy') {
      var sz = encEd.zsel && e.deploy.filter(function(z){ return z.id === encEd.zsel; })[0];
      if (sz && Math.hypot(m[0] - (sz.x + sz.w), m[1] - (sz.y + sz.h)) < tol) { eop = {k:'size', z:sz, orig:JSON.parse(JSON.stringify(sz)), m0:m, moved:false}; return; }
      var hit = null; e.deploy.forEach(function(z){ if (inZone(z, m[0], m[1])) hit = z; });
      if (hit) { eop = {k:'zmove', z:hit, orig:JSON.parse(JSON.stringify(hit)), m0:m, moved:false}; return; }
      var c0 = zcell(mp, m); eop = {k:'znew', a:c0, b:c0, m0:m, moved:false}; return;
    }
    var d = encHit(e, m);
    eop = d ? {k:'npc', d:d, ox:m[0] - d.x, oy:m[1] - d.y, m0:m, moved:false} : {k:'tap', m0:m, px:p[0], py:p[1], moved:false};
  }
  function encMove(mp, m, p){
    var o = eop;
    if (o.k === 'tap') { if (!o.moved && Math.hypot(p[0] - o.px, p[1] - o.py) < 8) return; o.moved = true; var v = V(); v.x += p[0] - o.px; v.y += p[1] - o.py; o.px = p[0]; o.py = p[1]; paint(); return; }
    if (!o.moved && Math.hypot(m[0] - o.m0[0], m[1] - o.m0[1]) * V().s < 6) return; o.moved = true;
    if (o.k === 'npc') { var s = o.d.s || 1; o.d.x = Math.max(0, Math.min(mp.cols - s, m[0] - o.ox)); o.d.y = Math.max(0, Math.min(mp.rows - s, m[1] - o.oy)); }
    else if (o.k === 'znew') o.b = zcell(mp, m);
    else if (o.k === 'zmove') { var q = o.orig, dx = Math.round(m[0] - o.m0[0]), dy = Math.round(m[1] - o.m0[1]); o.z.x = Math.max(0, Math.min(mp.cols - q.w, q.x + dx)); o.z.y = Math.max(0, Math.min(mp.rows - q.h, q.y + dy)); }
    else { var q2 = o.orig; o.z.w = Math.max(1, Math.min(mp.cols - q2.x, Math.round(m[0] - q2.x))); o.z.h = Math.max(1, Math.min(mp.rows - q2.y, Math.round(m[1] - q2.y))); }
    paint();
  }
  function encUp(mp){
    var o = eop, e = encData(); eop = null; if (!e) return;
    if (o.k === 'tap') {
      if (o.moved) return;
      var pk = encEd.pick && e.npcs.filter(function(d){ return d.k === encEd.pick; })[0];
      if (pk) { encPlace(mp, pk, o.m0); var nx = e.npcs.filter(function(d){ return d.x == null; })[0]; encEd.pick = nx ? nx.k : null; encEd.sel = pk.k; encSave(e); return; }
      encEd.sel = null; toolbar(); paint(); return;
    }
    if (o.k === 'npc') { if (o.moved) { if (mp.grid !== 'none') { o.d.x = Math.round(o.d.x); o.d.y = Math.round(o.d.y); } encEd.sel = o.d.k; encSave(e); return; } encEd.sel = encEd.sel === o.d.k ? null : o.d.k; toolbar(); paint(); return; }
    if (o.k === 'znew') {
      if (!o.moved) { encEd.zsel = null; toolbar(); paint(); return; }
      if (e.deploy.length >= 12) { Sala.toast('Un encuentro lleva hasta 12 zonas de despliegue.'); paint(); return; }
      var z = {id:newZid(), k:'despliegue', x:Math.min(o.a[0], o.b[0]), y:Math.min(o.a[1], o.b[1]), w:Math.abs(o.a[0] - o.b[0]) + 1, h:Math.abs(o.a[1] - o.b[1]) + 1, name:''};
      e.deploy.push(z); encEd.zsel = z.id; if (window.Sfx) Sfx.play('click'); encSave(e); return;
    }
    encEd.zsel = o.z.id; if (o.moved) encSave(e); else { toolbar(); paint(); }
  }
  /* Pone un enemigo del encuentro en la casilla tocada (centrado) */
  function encPlace(mp, d, m){ var s = d.s || 1; d.x = Math.max(0, Math.min(mp.cols - s, Math.round(m[0] - s / 2))); d.y = Math.max(0, Math.min(mp.rows - s, Math.round(m[1] - s / 2))); }
  function encHud(mp){
    var e = encData(); if (!e) return '';
    var waves = [1].concat(e.waves.map(function(w){ return w.n; })), un = e.npcs.filter(function(d){ return d.x == null; }), sel = encEd.sel && e.npcs.filter(function(d){ return d.k === encEd.sel; })[0], zs = encEd.zsel && e.deploy.filter(function(z){ return z.id === encEd.zsel; })[0], r = room();
    var wname = function(n){ var w = e.waves.filter(function(x){ return x.n === n; })[0]; return n === 1 ? 'Al empezar' : (w && w.name) || 'Oleada ' + n; };
    var h = '<div class="hud-row enc-h"><div class="seg sm" role="group" aria-label="Qué acomodas"><button type="button" data-act="mapenck" data-v="npc" aria-pressed="' + (encEd.k === 'npc') + '"><svg class="ic"><use href="#i-paw"/></svg>Enemigos</button><button type="button" data-act="mapenck" data-v="deploy" aria-pressed="' + (encEd.k === 'deploy') + '"><svg class="ic"><use href="#i-flag"/></svg>Despliegue</button></div>'
      + (encEd.k === 'npc' && waves.length > 1 ? '<div class="seg sm enc-waves" role="group" aria-label="Oleada que se resalta">' + waves.map(function(n){ return '<button type="button" data-act="mapencw" data-v="' + n + '" aria-pressed="' + (encEd.wave === n) + '" title="' + attr(wname(n)) + '"><svg class="ic"><use href="#i-wave"/></svg>' + n + '</button>'; }).join('') + '</div>' : '')
      + '<span class="hud-sp"></span><button class="btn sm" type="button" data-act="encopen" data-id="' + attr(e.id) + '"><svg class="ic"><use href="#i-scroll"/></svg>Ficha del encuentro</button></div>';
    if (encEd.k === 'npc') {
      if (sel) h += '<div class="hud-row enc-sel"><b>' + esc(sel.name) + '</b><label class="fl sm">Llega<select class="field" data-encnpc="wave">' + waves.map(function(n){ return '<option value="' + n + '"' + (sel.wave === n ? ' selected' : '') + '>' + esc(wname(n)) + '</option>'; }).join('') + '</select></label>'
        + '<label class="toggle"><input type="checkbox" data-encnpc="hidden"' + (sel.hidden ? ' checked' : '') + '> Oculto</label>' + (sel.x != null ? '<button class="btn sm" type="button" data-act="mapencun">Quitar del mapa</button>' : '') + '</div>';
      if (un.length) h += '<div class="hud-row enc-tray"><small>Sin lugar:</small>' + un.map(function(d){ return '<button type="button" class="chip' + (encEd.pick === d.k ? ' on' : '') + '" data-act="mapencpick" data-v="' + attr(d.k) + '">' + esc(d.name) + (d.wave > 1 ? ' · O' + d.wave : '') + '</button>'; }).join('') + '<button class="btn sm" type="button" data-act="mapencall">Todos cerca del centro</button></div>';
      h += '<p class="hud-hint">' + (!e.npcs.length ? 'Este encuentro no tiene enemigos: agrégalos en su ficha.' : encEd.pick ? 'Toca el mapa para poner a ' + esc((e.npcs.filter(function(d){ return d.k === encEd.pick; })[0] || {}).name || '') + '.' : 'Arrastra a cada enemigo a su lugar; toca uno para cambiar su oleada.' + (un.length ? ' Los que no tengan lugar llegan cerca del centro.' : '')) + '</p>';
    } else {
      if (zs) h += '<div class="hud-row enc-sel"><label class="fl sm">Nombre<input class="field" id="mapEncZName" maxlength="50" value="' + attr(zs.name || '') + '" placeholder="Orilla" autocomplete="off"></label><label class="fl sm">Para<select class="field" id="mapEncZFor"><option value="">Todo el grupo</option>' + (r ? r.members.filter(function(m){ return m.role !== 'dm'; }).map(function(m){ return '<option value="' + attr(m.id) + '"' + (zs.for === m.id ? ' selected' : '') + '>' + esc(m.char ? m.char.name : m.name) + '</option>'; }).join('') : '') + '</select></label><button class="btn sm del" type="button" data-act="mapenczdel"><svg class="ic"><use href="#i-trash"/></svg>Quitar</button></div>';
      h += '<p class="hud-hint">Arrastra para marcar dónde se acomoda el grupo antes de empezar (' + e.deploy.length + ' de 12). Sin zonas, cada quien se pone donde quiera.</p>';
    }
    return h;
  }
  /* Abre el mapa del encuentro para acomodarlo (lo llama Encuentros) */
  function editEnc(id, k){
    var e = window.Encuentros && Encuentros.get(id); if (!e || !e.map) return;
    var ed = {id:id, k:k || 'npc', wave:1, pick:null, sel:null, zsel:null}, un = e.npcs.filter(function(d){ return d.x == null; })[0]; if (un && ed.k === 'npc') ed.pick = un.k;
    if (window.Mesa && !visible()) Mesa.show('mapas');
    if (cur === e.map && canvas && document.contains(canvas)) { encEd = ed; selTok = null; pop = null; mode = 'jugar'; toolbar(); paint(); tokPanel(); return; }
    encPend = {map:e.map, ed:ed}; openMap(e.map);
  }
  function encDone(){ encEd = null; eop = null; if (cur) { toolbar(); paint(); } }

  /* ---------- Visión del grupo ---------- */
  function charOf(mp, t){ var r = room(); if (!r || !shared(mp.id) || !t.ref || t.comp) return null; var m = r.members.filter(function(x){ return x.id === t.ref; })[0]; return m && m.role !== 'dm' ? m.char : null; }
  /* Polígonos de lo que ve ahora el grupo (se recalculan solo si algo cambió) */
  function visOf(mp){
    if (!mp.vis || !mp.vis.on || !window.Vision) return null;
    var il = illumOf(mp), range = Vision.effRange(mp), key = mp.wrev + '|' + mp.walls.length + '|' + range + '|' + mp.cols + 'x' + mp.rows + '|' + il.key, toks = [];
    mp.tokens.forEach(function(t){ var ch = charOf(mp, t); if (!Vision.isViewer(t, ch)) return; var R = Vision.reachOf(t, ch), sn = Vision.sensesOf(t, ch); toks.push({t:t, R:R, sn:sn}); key += '|' + t.id + ':' + t.x + ',' + t.y + ',' + (t.s || 1) + ',' + R + ',' + sn.dv + ',' + sn.bs; });
    var c = visCache[mp.id]; if (c && c.key === key) return c;
    var ix = Vision.sightOf(mp);
    c = visCache[mp.id] = {key:key, n:++visSeq, il:il, vw:toks.map(function(o){ var p = Vision.center(o.t); return {x:p[0], y:p[1], R:o.R, dv:o.sn.dv, bs:o.sn.bs}; }), polys:toks.map(function(o){ var p = Vision.center(o.t); return Vision.poly(ix, p[0], p[1], range, mp.cols, mp.rows); })};
    return c;
  }
  /* ¿El grupo percibe este punto? A la vista y con luz, o dentro del alcance de los sentidos (o la luz) de quien lo ve */
  function seenAt(vs, x, y){
    for (var i = 0; i < vs.polys.length; i++) {
      if (!Vision.inPoly(vs.polys[i], x, y)) continue;
      if (vs.il.amb >= 1) return true; var v = vs.vw[i], dx = x - v.x, dy = y - v.y; if (dx * dx + dy * dy <= v.R * v.R) return true;
      for (var j = 0; j < vs.il.lights.length; j++) { var L = vs.il.lights[j]; if (L.D && Vision.inPoly(L.D, x, y)) return true; }
    }
    return false;
  }
  /* Luces del mapa (las de capas solo-DM no alumbran) y su clave para no rehacer lo que no cambió */
  function skipL(mp){ var s = {}; mp.layers.forEach(function(l){ if (l.dm) s[l.id] = 1; }); return function(l){ return !!s[l]; }; }
  function illumOf(mp){
    var il = Vision.illum(mp, skipL(mp));
    il.key = il.amb + '|' + mp.wrev + '|' + il.lights.map(function(L){ return L.id + ':' + L.x + ',' + L.y + ',' + L.b + ',' + L.d + ',' + L.c; }).join(';');
    return il;
  }
  function levelName(lv){ return lv >= 2 ? 'luz brillante' : lv === 1 ? 'penumbra' : 'oscuridad'; }
  /* Lo que dicen las reglas de estar ahí (2024): penumbra = ligeramente oscurecido, oscuridad = muy oscurecido */
  function lightRule(lv, wx){
    var r = lv >= 2 ? '' : lv === 1 ? 'Ligeramente oscurecido: desventaja en Percepción con la vista.' : 'Muy oscurecido: quien no tenga visión en la oscuridad no lo ve (cegado respecto a esa zona).';
    var w = wx === 'lluvia' || wx === 'tormenta' || wx === 'nieve' ? 'Con este clima todo está ligeramente oscurecido.' : wx === 'niebla' ? 'Niebla espesa: no se ve más allá de 9 m.' : '';
    return [r, w].filter(Boolean).join(' ');
  }
  /* Sin campaña (o en tu copia) la niebla la descubres tú mismo al mover las fichas */
  function exploreLocal(mp, toks, from, cells){
    if (shared(mp.id) || !mp.vis || !mp.vis.on || !window.Vision) return 0;
    var bits = fogBits(mp).slice(), o = {skipLayer:skipL(mp)};
    var n = Vision.exploreParty(mp, bits, toks ? {skipLayer:o.skipLayer, toks:toks, from:from, cells:cells} : o);
    if (toks && toks.some(function(t){ return t.lt; })) n += Vision.exploreParty(mp, bits, o);
    if (n) mp.fog.cells = b64(bits);
    return n;
  }
  /* Con la visión puesta, un jugador solo ve a los enemigos que alguien del grupo ve (los objetos, si ya se descubrió dónde están) */
  function ownT(t){ return !viewAs && mine(t); }
  function tokShown(mp, t, vs, dmView){
    if (dmView || !vs || t.kind === 'pc' || ownT(t)) return true;
    var s = t.s || 1, pts = [[t.x + s / 2, t.y + s / 2]]; if (s > 1) pts.push([t.x + 0.3, t.y + 0.3], [t.x + s - 0.3, t.y + 0.3], [t.x + 0.3, t.y + s - 0.3], [t.x + s - 0.3, t.y + s - 0.3]);
    for (var i = 0; i < pts.length; i++) if (seenAt(vs, pts[i][0], pts[i][1])) return true;
    if (t.kind === 'obj') { var b = fogBits(mp); return !!seen(b, mp, Math.min(mp.cols - 1, Math.floor(pts[0][0])), Math.min(mp.rows - 1, Math.floor(pts[0][1]))); }
    return false;
  }

  /* ---------- Niebla: un bit por casilla (1 = descubierta) ---------- */
  function b64(u8){ var s = ''; for (var i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); }
  function fogBits(mp){
    // se compara el texto completo: antes solo el principio y el final, y descubrir en medio del mapa no se veía
    var n = Math.ceil(mp.cols * mp.rows / 8), c = mp.fog && mp.fog.cells || '', k = mp.cols + 'x' + mp.rows + ':' + c;
    if (fogCache[mp.id] && fogCache[mp.id].k === k) return fogCache[mp.id].b;
    var b = new Uint8Array(n);
    if (c) { try { var s = atob(c); for (var i = 0; i < Math.min(n, s.length); i++) b[i] = s.charCodeAt(i); } catch(e){} }
    fogCache[mp.id] = {k:k, b:b, n:++fogSeq}; return b;
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
      + '<span class="map-thumb' + (th ? ' img' : '') + '"' + (th ? ' style="background-image:url(\'' + attr(th) + '\')"' : '') + '>' + (th ? '' : '<svg class="ic"><use href="#' + (kind === 'pj' ? 'i-pencil' : 'i-map') + '"/></svg>') + (scene ? '<i class="map-seal">En pantalla</i>' : '') + (m.hidden ? '<i class="map-seal off">En preparación</i>' : m.state === 'combat' ? '<i class="map-seal fight">Combate</i>' : '') + '</span>'
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
    box.innerHTML = '<div class="map-ed vtt"><div class="map-bar" id="mapBar"></div><div class="map-wrap" id="mapWrap"><canvas id="mapCv" aria-label="Mapa: arrastra tu ficha, mantén presionado para señalar; con dos dedos mueves y haces zoom"></canvas><canvas class="map-wx" id="mapWx" aria-hidden="true" hidden></canvas>'
      + '<div class="vtt-init" id="vttInit" hidden></div><div class="map-pal" id="mapPal"></div>'
      + '<div class="map-zoom"><button class="icon-btn sm" type="button" data-act="mapzoom" data-v="1" aria-label="Acercar"><svg class="ic"><use href="#i-plus"/></svg></button><button class="icon-btn sm" type="button" data-act="mapzoom" data-v="-1" aria-label="Alejar"><svg class="ic"><use href="#i-minus"/></svg></button><button class="icon-btn sm" type="button" data-act="mapfit" aria-label="Encuadrar el mapa" title="Encuadrar"><svg class="ic"><use href="#i-fit"/></svg></button></div>'
      + '<div class="map-pop" id="mapPop" hidden></div><div class="vtt-hud" id="vttHud"></div><div class="map-txt" id="mapTxt" hidden></div><div class="map-tok" id="mapTok" hidden></div><div class="map-selbar" id="mapSel" hidden></div><div class="map-ask" id="mapAsk" hidden></div></div></div>';
    dropGL(); canvas = $('#mapCv', box); bind(); if (window.Gfx && Gfx.wantGL()) startGL(canvas); toolbar(); fit(); frame(maps[cur]); var mt = !master(maps[cur]) && myTok(maps[cur]); if (mt) focus(maps[cur], mt); paint(); tokPanel(); badge(); askPaint();
    var r0 = room(); if (r0 && r0.split && isDm() && shared(cur) && r0.fight !== cur) Sala.send({t:'fight.focus', map:cur}); // con el combate separado, el DM ve el de este mapa
  }
  /* No repinta un bloque mientras escribes en él (el estado llega seguido) */
  function put(el, html){ var a = document.activeElement; if (a && el.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && el.innerHTML) return; el.innerHTML = html; }
  function myTok(mp){ var id = me(), sh = shared(mp.id); return mp.tokens.filter(function(t){ return t.kind === 'pc' && (sh ? t.ref === id : t.mine) && !t.comp; })[0]; }
  function toolbar(){
    var bar = $('#mapBar'), mp = maps[cur]; if (!bar || !mp) return;
    if (!tool.layer || !mp.layers.some(function(l){ return l.id === tool.layer; })) tool.layer = mp.layers[0].id;
    var admin = canAdmin(mp), sh = shared(mp.id), dm = master(mp), r = room(), scene = r && r.scene === mp.id;
    if (mode === 'niebla' && !dm) mode = 'jugar';
    if (encEd && !encHere(mp)) { encEd = null; eop = null; }
    if (encEd) mode = 'jugar';
    // el estado lo cambia el DM; los jugadores lo ven. Dibujar y Escena son herramientas que se abren encima
    var st = stateOf(mp), dmc = sh && isDm(), ee = encEd && encData();
    var tb = function(v, label, ic){ return '<button type="button" class="icon-btn sm tool-b" data-act="mapmode" data-v="' + v + '" aria-pressed="' + (mode === v) + '" aria-label="' + attr(label) + '" title="' + attr(label) + '"><svg class="ic"><use href="#' + ic + '"/></svg></button>'; };
    var stH = ee ? '<span class="map-st st-enc"><svg class="ic"><use href="#i-scroll"/></svg><span>' + esc(ee.name) + '</span></span>'
      : dmc ? '<div class="seg map-state" role="group" aria-label="Estado del mapa">' + STATES.map(function(x){ return '<button type="button" class="st-' + x[0] + '" data-act="mapstate" data-v="' + x[0] + '" aria-pressed="' + (st === x[0]) + '" title="' + attr(x[1] + ': ' + x[3]) + '"><svg class="ic"><use href="#' + x[2] + '"/></svg><span>' + x[1] + '</span></button>'; }).join('') + '</div>'
      : sh ? '<span class="map-st st-' + st + '" title="' + attr(stateT(st)[3]) + '"><svg class="ic"><use href="#' + stateT(st)[2] + '"/></svg><span>' + (st === 'combat' ? (started(mp) ? 'Combate' : 'Despliegue') : stateT(st)[1]) + '</span></span>' : '';
    put(bar, '<button class="icon-btn sm" type="button" data-act="mapback" aria-label="Volver a los mapas" title="Mapas"><svg class="ic"><use href="#i-back"/></svg></button>'
      + (admin && !ee ? '<input class="field map-name" id="mapName" value="' + attr(mp.name) + '" aria-label="Nombre del mapa">' : '<b class="map-name ro">' + esc(mp.name) + '</b>')
      + '<span class="map-where">' + (scene ? '<i class="tag new">en pantalla</i>' : '') + (mp.frozen && sh ? '<i class="tag frozen">quietos</i>' : '') + (sh ? '' : '<i class="tag">solo tu copia</i>') + (viewAs && dm ? '<button type="button" class="tag vis-as" data-act="mapviewas" title="Dejar de ver como jugador">como jugador ×</button>' : '') + '</span>'
      + stH
      + (ee ? '<button class="btn main sm" type="button" data-act="mapencdone">Listo</button>' : '<div class="map-tbx" role="group" aria-label="Herramientas">' + tb('dibujar', 'Dibujar: lápiz, objetos, paredes y zonas', 'i-pencil') + (dm ? tb('niebla', 'Escena: niebla, luz y clima', 'i-fog') : '') + '</div>'
      + (admin ? '<button class="icon-btn sm" type="button" data-act="mapset" aria-expanded="' + (pop === 'set') + '" aria-label="Ajustes del mapa" title="Ajustes del mapa"><svg class="ic"><use href="#i-gear"/></svg></button>' : '')));
    palette(mp, dm, sh); popover(mp, dm, sh, admin); hud(mp, dm, sh, scene); initStrip(mp); wxSync(mp);
    var sb = $('#mapSel'); if (sb) { var bh = mode === 'dibujar' && !pop ? (tool.k === 'wall' ? wallBar(mp) : MapEd.barHtml(mp)) : ''; put(sb, bh); sb.hidden = !bh; }
  }
  /* Paleta flotante de dibujo (a la izquierda, como en los VTT) */
  function palette(mp, dm, sh){
    var p = $('#mapPal'); if (!p) return;
    if (mode !== 'dibujar') { p.innerHTML = ''; p.hidden = true; return; }
    p.hidden = false;
    var tb = function(k, label, ic){ return '<button type="button" class="icon-btn" data-act="maptool" data-v="' + k + '" aria-pressed="' + (tool.k === k) + '" aria-label="' + label + '" title="' + label + '"><svg class="ic"><use href="#' + ic + '"/></svg></button>'; };
    p.innerHTML = tb('select', 'Seleccionar: mover, girar y escalar', 'i-cursor') + tb('pan', 'Mover el mapa', 'i-hand')
      + '<button type="button" class="icon-btn pen-btn" data-act="mappen" aria-expanded="' + (pop === 'pen') + '" aria-pressed="' + (tool.k === 'pen') + '" aria-label="Lápiz: grosor y color" title="Lápiz"><svg class="ic"><use href="#i-pencil"/></svg><i class="pen-dot" style="background:' + attr(tool.c) + ';--w:' + (tool.w === 0.06 ? 4 : tool.w === 0.14 ? 7 : 11) + 'px"></i></button>'
      + tb('line', 'Línea', 'i-line') + tb('rect', 'Rectángulo', 'i-rect') + tb('text', 'Texto', 'i-text')
      + '<button type="button" class="icon-btn" data-act="mapassets" aria-expanded="' + (pop === 'assets') + '" aria-pressed="' + (tool.k === 'asset') + '" aria-label="Objetos: puertas, escaleras, muebles…" title="Objetos"><svg class="ic"><use href="#i-chest"/></svg></button>'
      + (canAdmin(mp) ? '<button type="button" class="icon-btn wall-btn" data-act="mapwalls" aria-expanded="' + (pop === 'walls') + '" aria-pressed="' + (tool.k === 'wall') + '" aria-label="Paredes y puertas" title="Paredes y puertas" style="--wc:' + WCOL[tool.wt] + '"><svg class="ic"><use href="#' + wallT(tool.wt)[2] + '"/></svg></button>' : '')
      + (dm ? '<button type="button" class="icon-btn zone-btn" data-act="mapzones" aria-pressed="' + (tool.k === 'zone') + '" aria-label="Zonas: escaleras a otro mapa, trampas, textos y emboscadas" title="Zonas" style="--zc:' + zoneT(tool.zk)[3] + '"><svg class="ic"><use href="#i-zone"/></svg></button>' : '')
      + tb('erase', 'Borrar', 'i-eraser')
      + '<span class="pal-sep"></span><button type="button" class="icon-btn" data-act="maplayers" aria-expanded="' + (pop === 'layers') + '" aria-label="Capas" title="Capas"><svg class="ic"><use href="#i-layers"/></svg></button>'
      + '<button type="button" class="icon-btn" data-act="mapundo" aria-label="Deshacer" title="Deshacer (Ctrl+Z)"' + (MapEd.canUndo(mp) ? '' : ' disabled') + '><svg class="ic"><use href="#i-undo"/></svg></button>'
      + '<button type="button" class="icon-btn" data-act="mapredo" aria-label="Rehacer" title="Rehacer (Ctrl+Y)"' + (MapEd.canRedo(mp) ? '' : ' disabled') + '><svg class="ic"><use href="#i-redo"/></svg></button>'
      + '<span class="pal-sep"></span><button type="button" class="icon-btn pal-done" data-act="mapmode" data-v="jugar" aria-label="Listo: guardar las herramientas" title="Listo"><svg class="ic"><use href="#i-check"/></svg></button>';
  }
  function penHtml(){
    return '<div class="penpop"><span class="label">trazo</span><div class="pen-ws" role="group" aria-label="Grosor">' + WIDTHS.map(function(x, i){ return '<button type="button" data-act="mapw" data-v="' + x[0] + '" aria-pressed="' + (tool.w === x[0]) + '" aria-label="' + x[1] + '" title="' + x[1] + '"><svg viewBox="0 0 60 20" aria-hidden="true"><path d="M6 14 Q20 2 32 10 T54 6" stroke="' + attr(tool.c) + '" stroke-width="' + [2, 4.5, 8][i] + '" fill="none" stroke-linecap="round"/></svg></button>'; }).join('') + '</div>'
      + '<span class="label">color</span><div class="swatches" role="group" aria-label="Color">' + COLORS.map(function(c){ return '<button type="button" class="sw" data-act="mapcolor" data-v="' + c[0] + '" style="background:' + c[0] + '" aria-pressed="' + (tool.c === c[0]) + '" aria-label="' + c[1] + '"></button>'; }).join('') + '</div>'
      + '<label class="toggle"><input type="checkbox" id="mapSnap"' + (tool.snap ? ' checked' : '') + '> Ajustar a la cuadrícula</label><label class="toggle"><input type="checkbox" id="mapFill"' + (tool.fill ? ' checked' : '') + '> Rellenar rectángulos</label></div>';
  }
  function wallT(k){ return WALLT.filter(function(x){ return x[0] === k; })[0] || WALLT[0]; }
  function stateT(k){ return STATES.filter(function(x){ return x[0] === k; })[0] || STATES[1]; }
  /* Paredes: el tipo que vas a trazar y si es un tramo o una habitación entera */
  function wallsHtml(mp){
    var dm = master(mp);
    return '<div class="wallpop"><div class="row"><span class="label">paredes · arrastra para trazar</span><button class="icon-btn sm" type="button" data-act="mappopx" aria-label="Cerrar"><svg class="ic"><use href="#i-x"/></svg></button></div>'
      + '<div class="wall-types" role="group" aria-label="Tipo de pared">' + WALLT.filter(function(x){ return !x[4] || dm; }).map(function(x){ return '<button type="button" class="wall-t" data-act="mapwallt" data-v="' + x[0] + '" aria-pressed="' + (tool.wt === x[0]) + '" style="--wc:' + WCOL[x[0]] + '"><svg class="ic"><use href="#' + x[2] + '"/></svg><span><b>' + x[1] + '</b><small>' + x[3] + '</small></span></button>'; }).join('') + '</div>'
      + '<div class="row wall-opts"><div class="seg sm" role="group" aria-label="Forma"><button type="button" data-act="mapwallroom" data-v="0" aria-pressed="' + !tool.wroom + '"><svg class="ic"><use href="#i-line"/></svg>Tramo</button><button type="button" data-act="mapwallroom" data-v="1" aria-pressed="' + !!tool.wroom + '"><svg class="ic"><use href="#i-room"/></svg>Habitación</button></div>'
      + '<label class="toggle"><input type="checkbox" id="mapSnap"' + (tool.snap ? ' checked' : '') + '> A la cuadrícula</label></div>'
      + '<p class="note">Empieza en la punta de otra pared para seguirla. Toca una pared para cambiarla y arrastra sus puntas para moverla. Con Puerta, Puerta secreta o Ventana, toca una pared para abrirle un hueco.' + (mp.walls.length ? ' Hay ' + mp.walls.length + ' en este mapa.' : '') + '</p></div>';
  }
  /* Barra de la pared elegida: tipo, abrir/cerrar, llave, encontrada, lado, borrar */
  function wallBar(mp){
    var w = selWall && wallById(mp, selWall); if (!w) return '';
    var dm = master(mp), T = wallT(w.t), door = isDoorT(w), len = Math.round(Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) * 1.5 * 10) / 10;
    return '<div class="sel-bar wall-bar" role="toolbar" aria-label="Pared elegida" style="--wc:' + WCOL[w.t] + '"><svg class="ic wc"><use href="#' + T[2] + '"/></svg>'
      + '<select class="field" id="mapWallType" aria-label="Tipo de pared">' + WALLT.filter(function(x){ return !x[4] || dm || x[0] === w.t; }).map(function(x){ return '<option value="' + x[0] + '"' + (x[0] === w.t ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>'
      + (door ? '<button class="btn sm" type="button" data-act="mapwallopen">' + (w.open ? 'Cerrar' : 'Abrir') + '</button><button class="icon-btn sm" type="button" data-act="mapwalllock" aria-pressed="' + !!w.lock + '" aria-label="' + (w.lock ? 'Quitar la llave' : 'Cerrar con llave') + '" title="' + (w.lock ? 'Con llave: los jugadores no la abren' : 'Sin llave') + '"><svg class="ic"><use href="#i-lock"/></svg></button>' : '')
      + (w.t === 'secret' ? '<button class="btn sm" type="button" data-act="mapwallfound" aria-pressed="' + !!w.found + '" title="Encontrada: los jugadores la ven como puerta">' + (w.found ? 'Encontrada' : 'Sin encontrar') + '</button>' : '')
      + (w.t === 'oneway' ? '<button class="icon-btn sm" type="button" data-act="mapwallflip" aria-label="Cambiar el lado desde el que se ve" title="Cambiar el lado"><svg class="ic"><use href="#i-flip"/></svg></button>' : '')
      + '<small class="wall-len">' + String(len).replace('.', ',') + ' m</small>'
      + '<button class="icon-btn sm del" type="button" data-act="mapwalldel" aria-label="Borrar la pared" title="Borrar (Supr)"><svg class="ic"><use href="#i-trash"/></svg></button><button class="icon-btn sm" type="button" data-act="mapwallx" aria-label="Soltar" title="Soltar (Esc)"><svg class="ic"><use href="#i-x"/></svg></button></div>';
  }
  /* Capas: arriba la que se dibuja encima. Se reordenan arrastrando la manija; el ojo y el candado son de tu vista. */
  function layersHtml(mp, dm, sh, admin){
    var hid = hidden[mp.id] || {}, lk = locked[mp.id] || {}, n = {}; mp.strokes.forEach(function(k){ n[k.l] = (n[k.l] || 0) + 1; });
    var rows = mp.layers.slice().reverse().map(function(l){
      return '<div class="map-layer' + (tool.layer === l.id ? ' on' : '') + (hid[l.id] ? ' off' : '') + (lk[l.id] ? ' locked' : '') + (l.dm ? ' secret' : '') + '" data-lid="' + attr(l.id) + '">'
        + (admin && mp.layers.length > 1 ? '<span class="lgrip" data-ldrag="' + attr(l.id) + '" role="button" aria-label="Arrastra para reordenar ' + attr(l.name) + '" title="Arrastra para reordenar"><svg class="ic"><use href="#i-grip"/></svg></span>' : '')
        + '<button type="button" class="eye" data-act="mapeye" data-v="' + attr(l.id) + '" aria-pressed="' + !hid[l.id] + '" aria-label="' + (hid[l.id] ? 'Mostrar ' : 'Ocultar ') + attr(l.name) + '" title="' + (hid[l.id] ? 'Mostrar' : 'Ocultar') + '"><svg class="ic"><use href="#i-eye"/></svg></button>'
        + '<button type="button" class="eye lock" data-act="maplock" data-v="' + attr(l.id) + '" aria-pressed="' + !!lk[l.id] + '" aria-label="' + (lk[l.id] ? 'Desbloquear ' : 'Bloquear ') + attr(l.name) + '" title="' + (lk[l.id] ? 'Bloqueada: no se puede elegir' : 'Bloquear para no moverla sin querer') + '"><svg class="ic"><use href="#i-lock"/></svg></button>'
        + '<button type="button" class="ln" data-act="maplayer" data-v="' + attr(l.id) + '" aria-pressed="' + (tool.layer === l.id) + '">' + esc(l.name) + (l.dm ? ' <small>solo DM</small>' : '') + '<i>' + (n[l.id] || 0) + '</i></button></div>'
        + (layersOpen ? '<div class="line map-lrow"><input class="field" data-maplname="' + attr(l.id) + '" value="' + attr(l.name) + '" aria-label="Nombre de la capa">' + (dm && sh ? '<label class="toggle"><input type="checkbox" data-maplsecret="' + attr(l.id) + '"' + (l.dm ? ' checked' : '') + '> Solo DM</label>' : '') + (admin && mp.layers.length > 1 ? '<button class="icon-btn sm" type="button" data-act="mapldel" data-v="' + attr(l.id) + '" aria-label="Borrar capa"><svg class="ic"><use href="#i-trash"/></svg></button>' : '') + '</div>' : '');
    }).join('');
    return '<div class="map-layers-p"><div class="row"><span class="label">capas · la de arriba tapa a las demás</span><button class="icon-btn sm" type="button" data-act="mappopx" aria-label="Cerrar"><svg class="ic"><use href="#i-x"/></svg></button></div><div class="map-lrows" id="mapLRows">' + rows + '</div>'
      + '<div class="dm-row"><button class="btn sm" type="button" data-act="maplayeredit">' + (layersOpen ? 'Listo' : 'Editar capas') + '</button>' + (mp.layers.length < 8 ? '<button class="btn sm" type="button" data-act="mapladd">Agregar capa</button>' : '') + '</div>'
      + '<p class="note">Toca una capa para dibujar en ella.' + (dm && sh ? ' Las «Solo DM» no las ven los jugadores: trampas, puertas secretas y notas.' : '') + '</p></div>';
  }
  /* Arrastrar una capa por su manija */
  var ldrag = null;
  document.addEventListener('pointerdown', function(ev){
    var g = ev.target.closest && ev.target.closest('[data-ldrag]'); if (!g) return; var box = $('#mapLRows'); if (!box) return;
    ev.preventDefault(); ldrag = {id:g.dataset.ldrag, row:g.closest('.map-layer'), box:box, to:null}; ldrag.row.classList.add('dragging');
  });
  document.addEventListener('pointermove', function(ev){
    if (!ldrag) return; var rows = Array.prototype.slice.call(ldrag.box.querySelectorAll('.map-layer')), y = ev.clientY, to = rows.length;
    for (var i = 0; i < rows.length; i++) { var r = rows[i].getBoundingClientRect(); if (y < r.top + r.height / 2) { to = i; break; } }
    rows.forEach(function(r, i){ r.classList.toggle('drop-before', i === to && r !== ldrag.row); }); ldrag.box.classList.toggle('drop-end', to === rows.length); ldrag.to = to;
  });
  document.addEventListener('pointerup', function(){
    if (!ldrag) return; var d = ldrag; ldrag = null; d.row.classList.remove('dragging'); d.box.classList.remove('drop-end'); d.box.querySelectorAll('.drop-before').forEach(function(r){ r.classList.remove('drop-before'); });
    var mp = maps[cur]; if (!mp || d.to == null) return;
    var shown = mp.layers.slice().reverse(), from = shown.findIndex(function(l){ return l.id === d.id; }); if (from < 0) return;
    var L = shown.splice(from, 1)[0], to = d.to > from ? d.to - 1 : d.to; shown.splice(to, 0, L);
    var order = shown.reverse(); if (order.map(function(l){ return l.id; }).join() !== mp.layers.map(function(l){ return l.id; }).join()) setMeta(mp, {layers:order});
  });
  function popover(mp, dm, sh, admin){
    var p = $('#mapPop'); if (!p) return;
    if (pop === 'pen' && mode !== 'dibujar') pop = null;
    if ((pop === 'layers' || pop === 'assets' || pop === 'walls' || pop === 'zone') && mode !== 'dibujar') pop = null;
    if (pop === 'zone' && !(selZone && zoneById(mp, selZone))) pop = null;
    if (pop === 'encs' && !(isDm() && sh && window.Encuentros)) pop = null;
    var h = pop === 'encs' ? Encuentros.mapPop(mp) : pop === 'set' && admin ? setHtml(mp, dm, sh) : pop === 'layers' ? layersHtml(mp, dm, sh, admin) : pop === 'pen' ? penHtml() : pop === 'add' ? addHtml(mp, dm) : pop === 'assets' && window.Assets ? Assets.pickerHtml(tool.k === 'asset' ? tool.asset : null) : pop === 'walls' && admin ? wallsHtml(mp) : pop === 'zone' && dm ? zoneHtml(mp) : pop === 'travel' ? travelHtml(mp) : '';
    p.className = 'map-pop' + (pop ? ' p-' + pop : ''); put(p, h); p.hidden = !h;
  }
  function setHtml(mp, dm, sh){
    var meta = roomMeta(mp.id), bg = mp.bg;
    return '<div class="map-set"><div class="row"><b>Ajustes del mapa</b><button class="icon-btn sm" type="button" data-act="mappopx" aria-label="Cerrar"><svg class="ic"><use href="#i-x"/></svg></button></div><div class="two"><label class="fl">Cuadrícula<select class="field" id="mapGrid">' + [['square','Cuadrada'],['hex','Hexagonal'],['none','Sin cuadrícula']].map(function(x){ return '<option value="' + x[0] + '"' + (mp.grid === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>'
      + '<div class="fl"><span>Imagen de fondo</span><div class="row" style="gap:6px;flex-wrap:wrap"><label class="btn sm pickbtn">' + (busyUp ? 'Subiendo…' : bg ? 'Cambiar' : 'Subir imagen') + '<input type="file" id="mapBgFile" accept="image/*"></label>' + (bg ? '<button class="btn sm" type="button" data-act="mapbgx">Quitar</button>' : '') + '</div></div></div>'
      + (bg ? '<label class="fl">Opacidad del fondo<input type="range" id="mapBgOp" min="0.2" max="1" step="0.1" value="' + (bg.op || 1) + '"></label>' : '')
      + (dm && sh ? '<label class="toggle"><input type="checkbox" id="mapHide"' + (meta && meta.hidden ? ' checked' : '') + '> En preparación (oculto para los jugadores)</label>' : '')
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
    var here = function(x){ if (!r.split) return true; var at = (x.pc ? x.m.at : x.n.at) || r.scene || null; return at === r.fight; };
    var ord = r.order.map(function(id){ return all[id]; }).filter(Boolean), rest = Object.keys(all).map(function(k){ return all[k]; }).filter(function(x){ return r.order.indexOf(x.id) < 0 && here(x); });
    return ord.concat(rest);
  }
  function cInfo(x, r){
    var dm = isDm(), o = {name:'', init:null, pct:null, label:'', down:false};
    if (x.pc) { var c = x.m.char || {}; o.name = c.name || x.m.name; o.init = x.m.init; if (c.hp != null && c.hpMax) { o.pct = c.hp / c.hpMax; o.label = c.hp + '/' + c.hpMax; o.down = c.hp <= 0; } }
    else { var n = x.n; o.name = n.name; o.init = n.init; if (n.hp != null && n.hpMax) { o.pct = n.hp / n.hpMax; o.label = dm || n.show === 'num' ? n.hp + '/' + n.hpMax : ''; o.down = n.hp <= 0; } else if (n.pct != null) { o.pct = n.pct / 100; o.down = n.pct <= 0; } if (n.state) { o.label = n.state; o.down = n.state === 'caído'; } }
    return o;
  }
  function chipImg(x, t){ if (x.pc) return x.m.char && (x.m.char.img || x.m.char.tok) || (t && t.img) || null; return x.n.img || (t && t.img) || null; }
  function initStrip(mp){
    var el = $('#vttInit'); if (!el) return;
    var r = fight(); if (!r || encEd || (stateOf(mp) !== 'combat' && !(r.round > 0))) { el.hidden = true; el.innerHTML = ''; return; }
    var list = combatants(r), onMap = {}; mp.tokens.forEach(function(t){ if (t.ref && !t.comp) onMap[t.ref] = t; });
    el.hidden = false;
    el.innerHTML = '<span class="vi-round">' + (r.round ? '<small>ronda</small><b>' + r.round + '</b>' : '<small>despliegue</small><b><svg class="ic"><use href="#i-flag"/></svg></b>') + '</span><div class="vi-list">' + list.map(function(x, i){
      var o = cInfo(x, r), t = onMap[x.id], turn = r.round && r.turnId === x.id, col = t ? t.color : x.pc ? '#2f5d8a' : '#8c2626', p = o.pct == null ? null : Math.max(0, Math.min(1, o.pct));
      return '<button type="button" class="vi-chip' + (turn ? ' turn' : '') + (x.pc ? ' pc' : ' npc') + (o.down ? ' down' : '') + (x.id === r.you ? ' me' : '') + (x.n && x.n.hidden ? ' hid' : '') + (r.order.indexOf(x.id) < 0 ? ' noinit' : '') + '" data-act="mapchip" data-id="' + attr(x.id) + '" style="--d:' + (i * 35) + 'ms" title="' + attr(o.name + (o.label ? ' · ' + o.label : '')) + '">'
        + '<span class="vi-av" style="background:' + attr(col) + '">' + (chipImg(x, t) ? '<img alt="" src="' + attr(Mesa.imgUrl(chipImg(x, t))) + '">' : !x.pc && window.Retratos ? '<svg class="gi"><use href="#gi-' + Retratos.typeIcon(x.n.binfo ? x.n.binfo.type : x.n.ty) + '"/></svg>' : esc(ini(o.name))) + '</span><span class="vi-init">' + (o.init == null ? '–' : o.init) + '</span>'
        + (p != null ? '<i class="vi-hp"><i style="width:' + Math.round(p * 100) + '%;background:' + (p > 0.66 ? '#5fb85a' : p > 0.33 ? '#e0b43a' : '#d24a3a') + '"></i></i>' : '') + '<span class="vi-n">' + esc(String(o.name).split(' ')[0]) + '</span></button>';
    }).join('') + '</div>';
    var on = el.querySelector('.vi-chip.turn'), ls = el.querySelector('.vi-list'); if (on && ls) ls.scrollLeft = Math.max(0, on.offsetLeft - (ls.clientWidth - on.offsetWidth) / 2);
  }
  function hud(mp, dm, sh, scene){
    var el = $('#vttHud'); if (!el) return;
    var r = room(), h = '';
    if (mode === 'niebla' && tool.sc === 'luz') h = lightHud(mp);
    else if (mode === 'niebla' && tool.sc === 'clima') h = wxHud(mp);
    else if (mode === 'niebla') {
      var fo = mp.fog && mp.fog.on, vo = mp.vis && mp.vis.on, rg = mp.vis ? mp.vis.range || 0 : 0, ln = mp.vis && mp.vis.lines || 'auto';
      h = '<div class="hud-row"><label class="toggle big"><input type="checkbox" id="mapFogOn"' + (fo ? ' checked' : '') + '> Niebla</label>'
        + '<label class="toggle big vis-on"><input type="checkbox" id="mapVisOn"' + (vo ? ' checked' : '') + '> <svg class="ic"><use href="#i-vision"/></svg>Visión de los personajes</label>'
        + (vo ? '<label class="toggle"><input type="checkbox" id="mapViewAs"' + (viewAs ? ' checked' : '') + '> Ver como jugador</label>' : '') + '</div>'
        + (vo ? '<div class="hud-row vis-row"><label class="fl sm">Alcance de la vista<select class="field" id="mapVisRange">' + RANGES.map(function(x){ return '<option value="' + x[0] + '"' + (rg === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + (RANGES.some(function(x){ return x[0] === rg; }) ? '' : '<option value="' + rg + '" selected>' + String(rg * 1.5).replace('.', ',') + ' m</option>') + '</select></label>'
          + '<label class="fl sm">Líneas de pared<select class="field" id="mapVisLines">' + [['auto','Si no hay imagen de fondo'],['yes','Los jugadores las ven'],['no','Solo tú las ves']].map(function(x){ return '<option value="' + x[0] + '"' + (ln === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label></div>' : '')
        + '<div class="hud-row"><div class="seg sm" role="group" aria-label="Al arrastrar"><button type="button" data-act="mapfogv" data-v="1" aria-pressed="' + (tool.fogV === 1) + '">Descubrir</button><button type="button" data-act="mapfogv" data-v="0" aria-pressed="' + (tool.fogV === 0) + '">Cubrir</button></div><button class="btn sm" type="button" data-act="mapfogall" data-v="1">Todo visible</button><button class="btn sm" type="button" data-act="mapfogall" data-v="0">Todo cubierto</button></div>'
        + '<p class="hud-hint">' + (vo ? 'Se descubre solo lo que ven las fichas del grupo al moverse; las paredes tapan la vista.' + (mp.walls.length ? '' : ' Todavía no hay paredes: ponlas en Dibujar → Paredes.') + ' Tú ves en penumbra lo que ellos no ven ahora.'
          : fo ? 'Arrastra sobre el mapa para ' + (tool.fogV ? 'descubrir' : 'cubrir') + '. Tú la ves translúcida; los jugadores, negra.' : 'Actívala para que los jugadores solo vean lo descubierto.') + '</p>';
    } else if (mode === 'jugar' && encEd) h = encHud(mp);
    else if (mode === 'jugar') {
      var f = fight(), mt = myTok(mp), st = stateOf(mp), dep = deploying(mp), zs = dep ? deployZ(mp, me()) : [];
      var canPut = !(isDm() && sh) && (!!(window.Sala && Sala.summary && Sala.summary()) || !sh);
      // con la visión, en pleno combate o congelados, tu ficha camina: no se trae (en el despliegue, sí: a tu zona)
      var noTp = mt && sh && !dep && ((mp.vis && mp.vis.on) || st === 'combat' || mp.frozen);
      var tokBtns = (canPut ? (noTp ? '' : '<button class="btn main sm" type="button" data-act="mapputme"><svg class="ic"><use href="#' + (dep && zs.length ? 'i-flag' : 'i-token') + '"/></svg>' + (mt ? (dep && zs.length ? 'A mi zona' : 'Traer mi ficha') : 'Poner mi ficha') + '</button>') + (mt ? '<button class="icon-btn sm" type="button" data-act="mapfindme" aria-label="Ir a mi ficha" title="Ir a mi ficha"><svg class="ic"><use href="#i-target"/></svg></button>' : '') : '')
        + '<button class="icon-btn sm" type="button" data-act="mapadd" aria-expanded="' + (pop === 'add') + '" aria-label="' + (dm ? 'Agregar ficha' : 'Otra ficha (familiar, montura)') + '" title="' + (dm ? 'Agregar ficha' : 'Otra ficha') + '"><svg class="ic"><use href="#i-plus"/></svg></button>';
      if (r && isDm() && sh) h = dmHud(mp, r, f, st, dep, scene, tokBtns);
      else if (r && sh) h = pjHud(mp, r, f, st, dep, zs, mt, tokBtns);
      else h = '<div class="hud-row">' + tokBtns + '</div>';
    }
    if (mode === 'niebla') h = scTabs() + h;
    put(el, h); el.hidden = !h;
  }
  /* HUD del DM según el estado: preparación (armar), exploración (mostrar, llevar, congelar) y combate (despliegue, iniciativa, oleadas, turnos) */
  function dmHud(mp, r, f, st, dep, scene, tokBtns){
    var encN = (r.encs || []).filter(function(e){ return e.map === mp.id; }).length, run = (r.runs || []).filter(function(x){ return x.map === mp.id; })[0];
    var encB = '<button class="btn sm" type="button" data-act="mapencs" aria-expanded="' + (pop === 'encs') + '" title="Encuentros de este mapa"><svg class="ic"><use href="#i-scroll"/></svg><span class="lb">Encuentros</span>' + (encN ? ' <i class="hud-n">' + encN + '</i>' : '') + '</button>';
    var bestB = '<button class="btn sm" type="button" data-act="bestopen" title="Agregar un enemigo del bestiario"><svg class="ic"><use href="#i-paw"/></svg><span class="lb">Enemigo</span></button>';
    var frz = '<button class="icon-btn sm frz" type="button" data-act="mapfreeze" aria-pressed="' + !!mp.frozen + '" aria-label="' + (mp.frozen ? 'Dejar que se muevan' : 'Congelar: nadie se mueve') + '" title="' + (mp.frozen ? 'Congelados: toca para que se muevan' : 'Congelar el movimiento') + '"><svg class="ic"><use href="#i-snow"/></svg></button>';
    if (st === 'prep') return '<div class="hud-row dm st-prep"><span class="hud-st"><svg class="ic"><use href="#i-prep"/></svg><span><b>Preparación</b> · solo tú lo ves</span></span><span class="hud-sp"></span>' + tokBtns + bestB + encB
      + '<button class="btn main sm" type="button" data-act="mapstate" data-v="explore"><svg class="ic"><use href="#i-compass"/></svg>Mostrar y explorar</button></div>';
    var fsplit = fightsHtml(r), missing = f ? combatants(f).filter(function(x){ return !mp.tokens.some(function(t){ return t.ref === x.id && !t.comp; }); }).length : 0, inFight = st === 'combat' || !!(f && f.round);
    var row = '<div class="hud-row dm">' + tokBtns + (!scene ? '<button class="btn sm" type="button" data-act="mapscene" data-id="' + attr(mp.id) + '" title="Mostrar a todos"><svg class="ic"><use href="#i-screen"/></svg><span class="lb">Mostrar a todos</span></button>' : '')
      + (otherMaps(mp).length && mp.tokens.some(function(t){ return t.kind === 'pc'; }) ? '<button class="btn sm" type="button" data-act="maptravelp" aria-expanded="' + (pop === 'travel') + '" title="Llevar al grupo a otro mapa"><svg class="ic"><use href="#i-group"/></svg><span class="lb">Llevar al grupo</span></button>' : '')
      + (f && !r.split && spread(r) ? '<button class="btn sm" type="button" data-act="mapsplit" data-v="1" title="El grupo está en varios mapas: cada mapa con su propio combate"><svg class="ic"><use href="#i-swords"/></svg><span class="lb">Combate por mapa</span></button>' : '')
      + '<span class="hud-sp"></span>' + bestB + (missing && inFight ? '<button class="btn sm" type="button" data-act="mapplaceall" title="Poner en el mapa a ' + missing + ' del combate sin ficha"><svg class="ic"><use href="#i-token"/></svg><span class="lb">Poner ' + missing + ' en el mapa</span><i class="hud-n sm-only">' + missing + '</i></button>' : '') + encB + frz + '</div>';
    if (!inFight) return row + fsplit;
    var here = function(n){ return !r.split || (n.at || r.scene) === r.fight; };
    var noInit = (r.npcs || []).filter(function(n){ return n.init == null && here(n); }).length;
    var pcs = r.members.filter(function(m){ return m.role !== 'dm' && mp.tokens.some(function(t){ return t.kind === 'pc' && !t.comp && t.ref === m.id; }); }), ready = pcs.filter(function(m){ return m.init != null; }).length;
    var waves = run ? run.waves.map(function(w){ return '<button class="btn sm wave" type="button" data-act="mapwave" data-v="' + w.n + '" title="' + attr(w.round ? 'Llega sola al empezar la ronda ' + w.round + '; tócala para que llegue ya' : 'Tócala para que llegue') + '"><svg class="ic"><use href="#i-wave"/></svg><span class="lb">' + esc(w.name || 'Oleada ' + w.n) + '</span><small>' + w.count + (w.round ? ' · r' + w.round : '') + '</small></button>'; }).join('') : '';
    var ctl = f && f.round ? '<button class="icon-btn sm" type="button" data-act="salaturn" data-v="prev" aria-label="Turno anterior"><svg class="ic"><use href="#i-back"/></svg></button><button class="btn main sm hud-next" type="button" data-act="salaturn" data-v="next"><svg class="ic"><use href="#i-next"/></svg>Siguiente</button><button class="icon-btn sm" type="button" data-act="salaend" aria-label="Terminar combate" title="Terminar combate"><svg class="ic"><use href="#i-stop"/></svg></button>'
      : '<button class="btn main sm" type="button" data-act="salaturn" data-v="start"' + (f && f.order.length ? '' : ' disabled title="Falta iniciativa"') + '><svg class="ic"><use href="#i-swords"/></svg>Empezar combate</button>';
    var lead = dep ? '<span class="hud-st dep"><svg class="ic"><use href="#i-flag"/></svg><span><b>Despliegue</b> · ' + (pcs.length ? ready + ' de ' + pcs.length + ' con iniciativa' : 'esperando al grupo') + '</span></span>'
      : '<span class="hud-st"><svg class="ic"><use href="#i-swords"/></svg><span><b>Ronda ' + (f ? f.round : 0) + '</b>' + (f && f.turnId ? ' · ' + esc(nameIn(r, f.turnId)) : '') + '</span></span>';
    var row2 = '<div class="hud-row dm fight">' + lead + '<span class="hud-sp"></span>' + (noInit ? '<button class="btn sm" type="button" data-act="mapnpcinit" title="Tira 1d20 + su modificador a cada enemigo sin iniciativa (los iguales comparten tirada)"><svg class="ic"><use href="#i-d20"/></svg><span class="lb">Iniciativa de enemigos</span><small>' + noInit + '</small></button>' : '') + waves
      + '<button class="icon-btn sm" type="button" data-act="mapturnonly" aria-pressed="' + (mp.turnOnly !== false) + '" aria-label="' + (mp.turnOnly !== false ? 'Cada quien se mueve en su turno (toca para dejarlos libres)' : 'Se mueven libres (toca para que sea en su turno)') + '" title="' + (mp.turnOnly !== false ? 'Se mueve quien tiene el turno' : 'Se mueven libres') + '"><svg class="ic"><use href="#i-turn"/></svg></button>' + ctl + '</div>';
    return row2 + row + fsplit;
  }
  function nameIn(r, id){ var m = r.members.filter(function(x){ return x.id === id; })[0]; if (m) return m.char ? m.char.name : m.name; var n = (r.npcs || []).filter(function(x){ return x.id === id; })[0]; return n ? n.name : ''; }
  function pjHud(mp, r, f, st, dep, zs, mt, tokBtns){
    var meM = r.members.filter(function(m){ return m.id === r.you; })[0] || {}, c = meM.char || {}, myTurn = f && f.round && f.turnId === r.you, p = c.hpMax ? Math.max(0, Math.min(1, c.hp / c.hpMax)) : null;
    var h = '<div class="hud-row pj' + (myTurn ? ' myturn' : '') + '">' + (c.name ? '<span class="hud-me"><b>' + esc(c.name) + '</b><span class="hud-hp"><i style="width:' + Math.round((p || 0) * 100) + '%;background:' + (p > 0.66 ? '#5fb85a' : p > 0.33 ? '#e0b43a' : '#d24a3a') + '"></i></span><small>PG ' + (c.hp != null ? c.hp + '/' + c.hpMax : '–') + (c.temp ? ' +' + c.temp : '') + ' · CA ' + (c.ac || '–') + '</small></span>' : '')
      + (myTurn ? '<span class="hud-turn">¡Tu turno!</span><button class="btn main sm hud-next" type="button" data-act="salaturn" data-v="next"><svg class="ic"><use href="#i-next"/></svg>Terminar turno</button>' : '')
      + litChip(mp, mt) + '<span class="hud-sp"></span>' + (f && f.round && window.Acciones ? '<button class="btn sm" type="button" data-act="actopen" title="Publicar tu acción: se tiran los dados y lo ve el grupo"><svg class="ic"><use href="#i-d20"/></svg>Acción</button>' : '') + tokBtns + '<button class="icon-btn sm" type="button" data-act="mapsheet" aria-label="Mi hoja de combate" title="Mi hoja de combate"><svg class="ic"><use href="#i-swords"/></svg></button></div>';
    // lo que pide el estado: acomodarse, tirar iniciativa, esperar el turno o unirse al combate de otro mapa
    var bits = '';
    if (mp.frozen) bits += '<span class="hud-st frozen"><svg class="ic"><use href="#i-snow"/></svg><span>El DM detuvo el movimiento</span></span>';
    if (dep) bits += '<span class="hud-st dep"><svg class="ic"><use href="#i-flag"/></svg><span><b>¡Combate!</b> ' + (mt ? (zs.length ? 'Acomódate en la zona marcada.' : 'Acomódate donde quieras.') : 'Únete para ponerte en el mapa.') + '</span></span>';
    else if (st === 'combat' && f && f.round && !myTurn && mp.turnOnly !== false && mt) bits += '<span class="hud-st wait"><svg class="ic"><use href="#i-turn"/></svg><span>Te mueves en tu turno</span></span>';
    if (st === 'combat' && meM.init == null) bits += initForm(c);
    var cm = (r.maps || []).filter(function(x){ return x.state === 'combat'; }), herec = cm.some(function(x){ return x.id === mp.id; });
    if (herec && !mt) bits += '<button class="btn main sm" type="button" data-act="mapjoin" data-v="' + attr(mp.id) + '"><svg class="ic"><use href="#i-swords"/></svg>Unirme al combate</button>';
    else if (!herec && cm.length && !cm.some(function(x){ return x.id === meM.at; })) bits += '<button class="btn sm" type="button" data-act="mapjoin" data-v="' + attr(cm[0].id) + '"><svg class="ic"><use href="#i-swords"/></svg>Combate en «' + esc(cm[0].name) + '» · Unirme</button>';
    if (bits) h += '<div class="hud-row pj st">' + bits + '</div>';
    return h + (c.conds && c.conds.length ? '<div class="hud-conds">' + c.conds.map(function(k){ return '<span class="chip">' + esc((Sala.COND || {})[k] || k) + '</span>'; }).join('') + '</div>' : '');
  }
  /* Iniciativa: tirarla en la app (1d20 + tu modificador, con ventaja si toca) o escribir el total de tus dados */
  function initForm(c){
    var mod = c.initMod || 0;
    return '<form class="hud-init" data-form="salainit"><button class="btn main sm" type="button" data-act="salaroll" data-v="n"><svg class="ic"><use href="#i-d20"/></svg>Tirar 1d20 ' + (mod < 0 ? '− ' : '+ ') + Math.abs(mod) + '</button><button class="btn sm" type="button" data-act="salaroll" data-v="adv" title="Tira dos d20 y se queda con el mayor">Con ventaja</button>'
      + '<input class="field" name="v" inputmode="numeric" autocomplete="off" placeholder="o escribe" aria-label="Tu iniciativa (el total de tus dados)"><button class="btn sm" type="submit">Listo</button></form>';
  }
  /* Escena (solo el DM): pestañas de niebla, luz y clima */
  function scTabs(){ var t = tool.sc || 'niebla'; return '<div class="sc-head"><div class="seg sm sc-tabs" role="tablist" aria-label="Escena">' + [['niebla','Niebla','i-fog'],['luz','Luz y hora','i-sun'],['clima','Clima','i-rain']].map(function(x){ return '<button type="button" role="tab" data-act="mapsctab" data-v="' + x[0] + '" aria-selected="' + (t === x[0]) + '" aria-pressed="' + (t === x[0]) + '"><svg class="ic"><use href="#' + x[2] + '"/></svg>' + x[1] + '</button>'; }).join('') + '</div><button class="icon-btn sm" type="button" data-act="mapmode" data-v="jugar" aria-label="Cerrar la escena" title="Listo"><svg class="ic"><use href="#i-check"/></svg></button></div>'; }
  var TIMES = [['dia','Día','i-sun'],['amanecer','Amanecer','i-dawn'],['atardecer','Atardecer','i-dusk'],['noche','Noche','i-moon']];
  var AMBS = [['auto','Según la hora'],['bright','Luz brillante'],['dim','Penumbra'],['dark','Oscuridad (interior, mazmorra)']];
  function lightHud(mp){
    var L = mp.light || {}, il = illumOf(mp), n = il.lights.length, lv = Vision.ambient(mp);
    return '<div class="hud-row"><div class="seg sm" role="group" aria-label="Hora">' + TIMES.map(function(x){ return '<button type="button" data-act="maptime" data-v="' + x[0] + '" aria-pressed="' + ((L.time || 'dia') === x[0]) + '"><svg class="ic"><use href="#' + x[2] + '"/></svg>' + x[1] + '</button>'; }).join('') + '</div>'
      + '<label class="fl sm lt-amb">Luz del lugar<select class="field" id="mapAmb">' + AMBS.map(function(x){ return '<option value="' + x[0] + '"' + ((L.amb || 'auto') === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label></div>'
      + '<p class="hud-hint"><b>Ahora: ' + levelName(lv) + '.</b> ' + (lv >= 2 ? 'Todo se ve.' : lv === 1 ? 'Todo se ve en penumbra (desventaja en Percepción con la vista).' : 'Sin luz no se ve nada, salvo con visión en la oscuridad (se toma de la hoja de cada quien).')
      + ' Hay ' + n + ' luz' + (n === 1 ? '' : 'es') + ': pon antorchas, velas o fogatas desde Dibujar → Objetos → Luz y fuego, y a cada ficha su luz desde su panel.' + (mp.vis && mp.vis.on ? '' : ' Para que la luz decida qué ven los jugadores, prende la visión en la pestaña Niebla.') + '</p>';
  }
  function wxHud(mp){
    var w = mp.light && mp.light.wx || 'despejado', snd = {lluvia:'lluvia', tormenta:'tormenta', viento:'viento', nieve:'viento'}[w], r = room();
    return '<div class="hud-row wx-row" role="group" aria-label="Clima">' + Clima.KINDS.map(function(x){ return '<button type="button" class="btn sm wx-b" data-act="mapwx" data-v="' + x[0] + '" aria-pressed="' + (w === x[0]) + '"><svg class="ic"><use href="#' + x[2] + '"/></svg>' + x[1] + '</button>'; }).join('')
      + (snd && r && isDm() ? '<button type="button" class="btn sm" data-act="mapwxsnd" data-v="' + snd + '"><svg class="ic"><use href="#i-music"/></svg>Poner su sonido</button>' : '') + '</div>'
      + '<p class="hud-hint">' + (lightRule(2, w) || 'Sin efecto en las reglas.') + ' Se anima sobre el mapa para todos.</p>';
  }
  /* Cambiar hora, luz o clima: en la campaña lo confirma el servidor */
  function lightDo(mp, o){
    if (shared(mp.id)) { Sala.send({t:'map.light', id:mp.id, light:o}); return; }
    Object.keys(o).forEach(function(k){ mp.light[k] = o[k]; }); exploreLocal(mp); mp.updated = Date.now(); keep(mp); toolbar(); paint();
  }
  /* El DM lleva al grupo (las fichas de personaje de este mapa) a otro mapa, a una de sus zonas de paso o al centro */
  function travelHtml(mp){
    var others = otherMaps(mp), n = mp.tokens.filter(function(t){ return t.kind === 'pc'; }).length;
    return '<div class="travelpop"><div class="row"><b><svg class="ic"><use href="#i-group"/></svg>Llevar al grupo</b><button class="icon-btn sm" type="button" data-act="mappopx" aria-label="Cerrar"><svg class="ic"><use href="#i-x"/></svg></button></div>'
      + '<p class="note">' + n + ' ficha' + (n === 1 ? '' : 's') + ' de personaje en este mapa pasan a:</p><div class="travel-list">'
      + (others.length ? others.map(function(o){ var full = maps[o.id], zs = full ? (full.trig || []).filter(function(z){ return z.k === 'paso'; }) : [];
        return '<div class="travel-map"><b>' + esc(o.name) + (o.hidden ? ' <small>oculto</small>' : '') + '</b><div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm" type="button" data-act="maptravel" data-map="' + attr(o.id) + '">Al centro</button>' + zs.map(function(z){ return '<button class="btn sm" type="button" data-act="maptravel" data-map="' + attr(o.id) + '" data-zid="' + attr(z.id) + '"><svg class="ic"><use href="#i-stairs"/></svg>' + esc(z.name || 'Paso') + '</button>'; }).join('') + '</div></div>'; }).join('') : '<p class="note">No hay otros mapas todavía.</p>')
      + '</div></div>';
  }
  /* Combate separado por mapa: cada mapa con su ronda y su turno; el DM ve el del mapa que tiene abierto */
  function fightsHtml(r){
    if (!r || !r.split) return '';
    return '<div class="hud-row fights">' + (r.fights || []).map(function(f){ return '<button type="button" class="fight-chip' + (f.map === r.fight ? ' on' : '') + '" data-act="mapfight" data-v="' + attr(f.map || '') + '" title="Ir a este combate"><b>' + esc(f.name) + '</b><small>' + (f.round ? 'ronda ' + f.round : 'sin empezar') + ' · ' + f.n + '</small></button>'; }).join('') + '<button class="btn sm" type="button" data-act="mapsplit" data-v="0"><svg class="ic"><use href="#i-swords"/></svg>Unir combates</button></div>';
  }
  /* ¿El grupo está en varios mapas? (para ofrecer separar el combate) */
  function spread(r){ var at = {}; r.members.forEach(function(m){ if (m.role !== 'dm' && m.at) at[m.at] = 1; }); return Object.keys(at).length > 1; }
  /* Dónde está tu ficha: luz brillante, penumbra u oscuridad (con lo que dicen las reglas) */
  function litChip(mp, t){
    if (!t || !window.Vision) return ''; var L = mp.light || {}, il = illumOf(mp); if (il.amb >= 2 && !il.lights.length && (!L.wx || L.wx === 'despejado')) return '';
    var c = Vision.center(t), lv = Vision.levelAt(il, c[0], c[1]), rule = lightRule(lv, L.wx);
    return '<span class="lit-chip lv' + lv + '" title="' + attr(rule) + '"><svg class="ic"><use href="#' + (lv >= 2 ? 'i-sun' : lv === 1 ? 'i-dusk' : 'i-moon') + '"/></svg>' + (lv >= 2 ? 'A plena luz' : lv === 1 ? 'En penumbra' : 'A oscuras') + '</span>';
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
    h += tokLightInfo(mp, t);
    if (can) h += '<details class="map-tok-more"' + (cb ? '' : ' open') + '><summary>Ficha en el mapa</summary><div class="map-tok-b"><label>Tamaño<select class="field" data-tokset="s">' + TSIZE.map(function(x){ return '<option value="' + x[0] + '"' + (t.s === x[0] ? ' selected' : '') + '>' + x[1].split(' (')[0] + '</option>'; }).join('') + '</select></label>'
      + tokLightCtl(mp, t)
      + '<div class="swatches" role="group" aria-label="Color">' + TOKCOL.map(function(c){ return '<button type="button" class="sw" data-act="maptokcol" data-v="' + c + '" style="background:' + c + '" aria-pressed="' + (t.color === c) + '" aria-label="Color ' + c + '"></button>'; }).join('') + '</div>'
      + '<div class="row" style="gap:6px;flex-wrap:wrap">' + (room() ? '<label class="btn sm pickbtn">' + (busyUp ? 'Subiendo…' : t.img ? 'Cambiar retrato' : 'Retrato') + '<input type="file" id="mapTokImg" accept="image/*"></label>' + (t.img ? '<button class="btn sm" type="button" data-act="maptoknoimg">Sin retrato</button>' : '') : '') + (dm && room() ? '<button class="btn sm" type="button" data-act="maptokhide">' + (t.hidden ? 'Mostrar a los jugadores' : 'Ocultar a los jugadores') + '</button>' : '')
      + (dm && room() && shared(mp.id) && otherMaps(mp).length ? '<select class="field tok-travel" data-toktravel="1" aria-label="Llevar a otro mapa"><option value="">Llevar a otro mapa…</option>' + otherMaps(mp).map(function(o){ return '<option value="' + attr(o.id) + '">' + esc(o.name) + '</option>'; }).join('') + '</select>' : '') + '<button class="btn sm" type="button" data-act="maptokdel">Quitar del mapa</button></div></div></details>';
    put(p, h); p.hidden = false;
  }
  /* La luz donde está la ficha y lo que dicen las reglas */
  function tokLightInfo(mp, t){
    if (!window.Vision) return ''; var L = mp.light || {}, il = illumOf(mp); if (il.amb >= 2 && !il.lights.length && (!L.wx || L.wx === 'despejado')) return '';
    var c = Vision.center(t), lv = Vision.levelAt(il, c[0], c[1]), rule = lightRule(lv, L.wx);
    return '<p class="tok-lit lv' + lv + '"><svg class="ic"><use href="#' + (lv >= 2 ? 'i-sun' : lv === 1 ? 'i-dusk' : 'i-moon') + '"/></svg><span><b>En ' + levelName(lv) + '.</b> ' + esc(rule) + '</span></p>';
  }
  /* Luz que lleva la ficha y su visión en la oscuridad (la de un personaje sale de su hoja) */
  function tokLightCtl(mp, t){
    var P = Vision.PRESETS, k = t.lt ? (t.lt.k || 'otra') : '', ch = charOf(mp, t), sheet = ch && ch.dv ? ch.dv : 0, dv = t.sn && t.sn.dv != null ? String(t.sn.dv) : '';
    var m = function(ft){ return String(ft / 5 * 1.5).replace('.', ',') + ' m'; };
    return '<label>Luz<select class="field" data-toklt="1"><option value=""' + (!k ? ' selected' : '') + '>Sin luz</option>' + P.map(function(p){ return '<option value="' + p[0] + '"' + (k === p[0] ? ' selected' : '') + '>' + p[1] + ' · ' + m(p[2] * 5) + (p[3] ? ' + ' + m(p[3] * 5) : '') + '</option>'; }).join('') + (k === 'otra' ? '<option value="otra" selected>Otra</option>' : '') + '</select></label>'
      + '<label>Visión en la oscuridad<select class="field" data-toksn="dv"><option value=""' + (dv === '' ? ' selected' : '') + '>' + (ch ? 'De la hoja (' + (sheet ? m(sheet) : 'no tiene') + ')' : 'No tiene') + '</option>' + [0, 30, 60, 90, 120].map(function(ft){ return '<option value="' + ft + '"' + (dv === String(ft) ? ' selected' : '') + '>' + (ft ? m(ft) : 'Ninguna') + '</option>'; }).join('') + '</select></label>';
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
        + '<div class="tok-row">' + (window.Acciones ? '<button class="btn sm" type="button" data-act="actopen" data-actor="' + attr(n.id) + '"><svg class="ic"><use href="#i-d20"/></svg>Su acción</button>' : '') + (n.ref ? '<button class="btn sm" type="button" data-act="bestref" data-ref="' + attr(n.ref) + '">Ficha</button>' : '') + '<button class="btn sm" type="button" data-act="salareveal" data-id="' + attr(n.id) + '">' + (n.hidden ? 'Mostrar en el combate' : 'Ocultar del combate') + '</button></div>';
    } else if (dm && cb.pc) {
      h += '<div class="tok-row"><label>Inic.<input class="field" data-salainit="' + attr(cb.id) + '" inputmode="numeric" value="' + (cb.init == null ? '' : cb.init) + '" aria-label="Iniciativa"></label></div>';
    } else {
      if (window.Acciones && cb.id !== r.you) h += '<div class="tok-row"><button class="btn main sm" type="button" data-act="actopen" data-target="' + attr(cb.id) + '"><svg class="ic"><use href="#i-d20"/></svg>' + (cb.pc ? 'Acción sobre ' : 'Atacar a ') + esc(cb.pc ? (cb.m.char && cb.m.char.name) || cb.m.name : cb.n.name) + '</button></div>';
      h += '<form class="tok-apply" data-form="mapapply" data-id="' + attr(cb.id) + '"><input class="field" name="amount" inputmode="numeric" autocomplete="off" placeholder="Total" aria-label="Cantidad"><button class="btn dmg sm" type="submit" data-kind="damage">Daño</button><button class="btn heal sm" type="submit" data-kind="heal">Curar</button></form>'
        + '<div class="tok-row"><select class="field" name="cond" form="" data-mapcond="' + attr(cb.id) + '" aria-label="Aplicar condición"><option value="">Condición…</option>' + Object.keys(C2).map(function(k){ return '<option value="' + k + '">' + C2[k] + '</option>'; }).join('') + '</select></div>';
    }
    return h + '</div>';
  }
  /* La imagen de una ficha: la que se le puso; si no, la ficha del jugador o la imagen del enemigo */
  function tokImg(t){
    if (t.img) return t.img; var r = room(); if (!r || !t.ref || t.comp) return null;
    var m = r.members.filter(function(x){ return x.id === t.ref; })[0]; if (m && m.char) return m.char.tok || m.char.img || null;
    var n = (r.npcs || []).filter(function(x){ return x.id === t.ref; })[0]; return n && n.img || null;
  }
  function avatar(t){ var c = t.color || '#8c2626', id = tokImg(t); return '<span class="tok-av" style="background:' + attr(c) + '">' + (id ? '<img alt="" src="' + attr(Mesa.imgUrl(id)) + '">' : esc(ini(t.name))) + '</span>'; }
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
    canvas.style.width = w + 'px'; canvas.style.height = hh + 'px';
    var wx = document.getElementById('mapWx'); if (wx) { wx.style.width = w + 'px'; wx.style.height = hh + 'px'; }
    if (canvas.dataset.engine === 'gl') { if (gl) gl.resize(w, hh, Gfx.resolution()); return; }
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr);
  }
  function frame(mp){ if (!canvas || !mp) return; var w = canvas.clientWidth || 360, h = canvas.clientHeight || 400, s = Math.max(4, Math.min(80, Math.min((w - 20) / mp.cols, (h - 20) / mp.rows))); views[mp.id] = {s:s, x:(w - mp.cols * s) / 2, y:(h - mp.rows * s) / 2}; }
  /* Acerca y centra la vista en una ficha (para encontrar la tuya en el teléfono) */
  function focus(mp, t){ var v = V(), w = canvas.clientWidth || 360, h = canvas.clientHeight || 400, s = Math.max(v.s, 30), z = t.s || 1; v.s = s; v.x = w / 2 - (t.x + z / 2) * s; v.y = h / 2 - (t.y + z / 2) * s; }
  function zoomAt(f, cx, cy){ var v = V(), ns = Math.max(3, Math.min(160, v.s * f)); v.x = cx - (cx - v.x) * ns / v.s; v.y = cy - (cy - v.y) * ns / v.s; v.s = ns; paint(); }
  function toMap(px, py){ var v = V(); return [(px - v.x) / v.s, (py - v.y) / v.s]; }

  /* ---------- Pintar ---------- */
  /* paint() solo agenda: varios cambios seguidos (zoom, estado del servidor, arrastre) se dibujan en un cuadro */
  function paint(){
    if (!canvas || !document.contains(canvas)) { if (gl) dropGL(); return; }
    if (canvas.dataset.engine === 'gl') { if (gl && !glRaf) glRaf = requestAnimationFrame(glPaint); return; }
    if (!glRaf) glRaf = requestAnimationFrame(function(){ glRaf = 0; paint2d(); });
  }
  function paint2d(){
    if (!canvas || !document.contains(canvas)) return;
    var c = canvas.getContext && canvas.getContext('2d'); if (!c) return; var mp = maps[cur]; if (!mp) return;
    var dpr = canvas.width / (canvas.clientWidth || canvas.width); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(c, mp, V(), canvas.clientWidth, canvas.clientHeight, hidden[mp.id] || {}, true);
    if (drawing) strokeOn(c, drawing, V());
    if (erasing) { var v = V(); mp.strokes.forEach(function(k){ if (erasing.hits[k.id]) { c.save(); c.globalAlpha = 0.25; strokeOn(c, Object.assign({}, k, {c:'#ff3b30'}), v); c.restore(); } }); }
    overlay(c, mp, V());
  }

  /* ---------- Motor WebGL: arranca aparte y, si falla, el mapa vuelve a Canvas 2D ---------- */
  function startGL(cv){
    cv.dataset.engine = 'gl'; cv.closest('.map-wrap') && cv.closest('.map-wrap').classList.add('gl-loading');
    Gfx.loadGL().then(function(M){
      if (canvas !== cv) return null;
      return M.create(cv, {width:cv.clientWidth || 360, height:cv.clientHeight || 400, resolution:Gfx.resolution(), antialias:Gfx.antialias(), onNeed:paint});
    }).then(function(r){
      if (!r) return; if (canvas !== cv) { r.destroy(); return; }
      gl = r; var w = cv.closest('.map-wrap'); if (w) w.classList.remove('gl-loading'); fit(); paint();
    }).catch(function(e){
      Gfx.failed(e); if (canvas !== cv) return;
      // el lienzo pudo quedar con un contexto WebGL a medias: se cambia por uno limpio
      var n = cv.cloneNode(false); delete n.dataset.engine; cv.replaceWith(n); canvas = n; bind();
      var w = n.closest('.map-wrap'); if (w) w.classList.remove('gl-loading'); fit(); paint();
    });
  }
  function dropGL(){ if (glRaf) { cancelAnimationFrame(glRaf); glRaf = 0; } if (gl) { gl.destroy(); gl = null; } }
  function glPaint(){
    glRaf = 0; var mp = maps[cur]; if (!gl || !mp || !canvas || !document.contains(canvas)) return;
    var sc = scene(mp, V(), canvas.clientWidth, canvas.clientHeight); gl.render(sc); flicker(sc);
  }
  /* ---------- Luz: velo, brillos y tinte (los usan los dos motores) ---------- */
  function hiddenObj(k){ return k.k === 'asset' && k.a === 'luz'; } // la luz invisible solo la ve el DM
  function canv(c, w, h){ if (!c) c = document.createElement('canvas'); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return c; }
  var veil = {c:null, t:null, d:null, s:null, key:'', n:0}, glowC = {c:null, key:'', n:0};
  /* La niebla por casilla en un píxel por casilla: lo no descubierto con `un`, lo descubierto con `mem` */
  function fogSmall(mp, un, mem){
    var bits = fogBits(mp), c = veil.s = canv(veil.s, mp.cols, mp.rows), g = c.getContext('2d'), id = g.createImageData(mp.cols, mp.rows), d = id.data, a = Math.round(un * 255), am = Math.round(mem * 255);
    for (var i = 0, n = mp.cols * mp.rows; i < n; i++) { var o = i * 4, dark = !((bits[i >> 3] >> (i & 7)) & 1); d[o] = 11; d[o + 1] = 8; d[o + 2] = 6; d[o + 3] = dark ? a : am; }
    g.putImageData(id, 0, 0); return c;
  }
  function pathPoly(g, P){ g.beginPath(); for (var i = 0; i < P.length; i += 2) { if (i) g.lineTo(P[i], P[i + 1]); else g.moveTo(P[i], P[i + 1]); } g.closePath(); }
  function fillPoly(g, P){ if (P && P.length >= 6) { pathPoly(g, P); g.fill(); } }
  function fillCircle(g, x, y, r){ if (r > 0) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); } }
  /* Lo que el viewer i percibe (luz o sentidos) y lo que percibe con luz brillante */
  function fillSeen(g, vs, i, W, H){ var v = vs.vw[i]; if (vs.il.amb >= 1) { g.fillRect(-1, -1, W, H); return; } vs.il.lights.forEach(function(L){ fillPoly(g, L.D); }); fillCircle(g, v.x, v.y, v.R); }
  function fillBright(g, vs, i, W, H){
    var v = vs.vw[i], amb = vs.il.amb; if (amb >= 2) { g.fillRect(-1, -1, W, H); return; }
    vs.il.lights.forEach(function(L){ fillPoly(g, L.B); });
    fillCircle(g, v.x, v.y, v.bs);
    if (v.dv > 0) { g.save(); g.beginPath(); g.arc(v.x, v.y, v.dv, 0, Math.PI * 2); g.clip(); if (amb >= 1) g.fillRect(-1, -1, W, H); else vs.il.lights.forEach(function(L){ fillPoly(g, L.D); }); g.restore(); } // en penumbra, la visión en la oscuridad ve como con luz
  }
  /* El velo de la niebla con visión y luz, en el espacio del mapa (un lienzo de (cols+2M)·K × (rows+2M)·K):
     negro lo no descubierto, penumbra fuerte lo descubierto que no se percibe ahora, limpio lo que se ve con luz
     y algo oscuro lo que se ve con poca luz (o con visión en la oscuridad). Se rehace solo si algo cambió. */
  function veilOf(mp, dmView, vs){
    var lvl = window.Gfx ? Gfx.level() : 'media', M = 2, big = Math.max(mp.cols, mp.rows) + M * 2, K = Math.max(3, Math.min(lvl === 'baja' ? 6 : lvl === 'alta' ? 14 : 10, Math.floor(2048 / big)));
    fogBits(mp); var key = [mp.id, mp.cols, mp.rows, fogCache[mp.id].n, vs.key, dmView ? 1 : 0, K, lvl].join('|');
    if (veil.c && veil.key === key) return {cv:veil.c, key:veil.n, M:M};
    var W = (mp.cols + M * 2) * K, H = (mp.rows + M * 2) * K, un = dmView ? 0.5 : 1, mem = dmView ? 0.22 : 0.62;
    veil.t = canv(veil.t, W, H); veil.d = canv(veil.d, W, H); veil.c = canv(veil.c, W, H);
    var g = veil.t.getContext('2d'), e = M * K; g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, W, H);
    if (!dmView) { g.fillStyle = OUT; g.fillRect(0, 0, W, e); g.fillRect(0, H - e, W, e); g.fillRect(0, e, e, H - 2 * e); g.fillRect(W - e, e, e, H - 2 * e); }
    g.setTransform(K, 0, 0, K, e, e); g.imageSmoothingEnabled = false; g.drawImage(fogSmall(mp, un, mem), 0, 0, mp.cols, mp.rows); g.imageSmoothingEnabled = true;
    var MW = mp.cols + 2, MH = mp.rows + 2;
    // lo que el grupo percibe ahora queda limpio
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
    vs.polys.forEach(function(P, i){ if (P.length < 6) return; g.save(); pathPoly(g, P); g.clip(); fillSeen(g, vs, i, MW, MH); g.restore(); });
    g.globalCompositeOperation = 'source-over';
    // con poca luz: un velo azulado (lo que se percibe, menos lo que se percibe con luz brillante)
    if (vs.il.amb < 2) {
      var d = veil.d.getContext('2d'); d.setTransform(1, 0, 0, 1, 0, 0); d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, W, H); d.setTransform(K, 0, 0, K, e, e); d.fillStyle = '#0a0d1c';
      vs.polys.forEach(function(P, i){ if (P.length < 6) return; d.save(); pathPoly(d, P); d.clip(); fillSeen(d, vs, i, MW, MH); d.restore(); });
      d.globalCompositeOperation = 'destination-out';
      vs.polys.forEach(function(P, i){ if (P.length < 6) return; d.save(); pathPoly(d, P); d.clip(); fillBright(d, vs, i, MW, MH); d.restore(); });
      d.globalCompositeOperation = 'source-over';
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = dmView ? 0.18 : 0.42; g.drawImage(veil.d, 0, 0); g.globalAlpha = 1;
    }
    // borde suave (si el navegador sabe desenfocar un lienzo)
    var o = veil.c.getContext('2d'); o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, W, H);
    if (lvl !== 'baja' && 'filter' in o) { o.filter = 'blur(' + Math.max(1, K * 0.3).toFixed(1) + 'px)'; o.drawImage(veil.t, 0, 0); o.filter = 'none'; } else o.drawImage(veil.t, 0, 0);
    veil.key = key; veil.n++;
    return {cv:veil.c, key:veil.n, M:M};
  }
  /* Brillo de las luces (se suma encima del mapa, debajo de la niebla), cortado por las paredes */
  function rgb(h){ var n = parseInt(String(h || '#ffd27a').slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function glowOf(mp, il){
    if (!il.lights.length) return null;
    var Kg = Math.max(2, Math.min(8, Math.floor(1024 / Math.max(mp.cols, mp.rows)))), key = il.key + '|' + Kg + '|' + mp.cols + 'x' + mp.rows;
    if (glowC.c && glowC.key === key) return {cv:glowC.c, key:glowC.n};
    var c = glowC.c = canv(glowC.c, mp.cols * Kg, mp.rows * Kg), g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); g.setTransform(Kg, 0, 0, Kg, 0, 0); g.globalCompositeOperation = 'lighter';
    il.lights.forEach(function(L){
      var R = L.b + L.d; if (R <= 0 || !L.D) return; var q = rgb(L.c), k = R ? L.b / R : 0;
      g.save(); pathPoly(g, L.D); g.clip();
      var gr = g.createRadialGradient(L.x, L.y, 0, L.x, L.y, R); gr.addColorStop(0, 'rgba(' + q + ',.6)'); gr.addColorStop(Math.max(0.05, Math.min(0.95, k)), 'rgba(' + q + ',.32)'); gr.addColorStop(1, 'rgba(' + q + ',0)');
      g.fillStyle = gr; g.fillRect(L.x - R, L.y - R, R * 2, R * 2); g.restore();
    });
    g.globalCompositeOperation = 'source-over'; glowC.key = key; glowC.n++;
    return {cv:c, key:glowC.n};
  }
  var TINT = {amanecer:['#ffb38a', 0.2], atardecer:['#ff8a4c', 0.26], noche:['#1c2650', 0.5]};
  /* Hora (tinte), brillo de las luces (más fuerte cuanto más oscuro) y si parpadean */
  function lightScene(mp, dmView, now){
    var L = mp.light || {}, t = TINT[L.time] || null, il = illumOf(mp), glow = glowOf(mp, il), flick = il.lights.some(function(x){ return x.f; });
    var base = il.amb >= 2 ? 0.28 : il.amb === 1 ? 0.62 : 0.9, f = 1;
    if (flick && glow && motionOn()) { var k = now / 1000; f = 0.9 + 0.1 * (Math.sin(k * 9.1) * 0.5 + Math.sin(k * 23.7) * 0.3 + Math.sin(k * 3.3) * 0.2); }
    return {tint:t ? {c:t[0], a:t[1]} : null, glow:glow ? {cv:glow.cv, key:glow.key, a:base * f} : null, flick:flick && !!glow};
  }
  function motionOn(){ return !(window.Fx && Fx.mode && Fx.mode() === 'off') && (!window.Gfx || Gfx.level() !== 'baja'); }
  /* Las antorchas parpadean: con WebGL se repinta unas 12 veces por segundo mientras se ve el mapa */
  var flickT = 0;
  function flicker(sc){ if (!sc.light || !sc.light.flick || !motionOn() || flickT) return; flickT = setTimeout(function(){ flickT = 0; if (cur && visible() && canvas && canvas.dataset.engine === 'gl') paint(); }, 85); }
  function wxSync(mp){ if (window.Clima) Clima.set(document.getElementById('mapWx'), mp && mp.light ? mp.light.wx : 'despejado'); }
  /* Lo que se ve, ya resuelto, para el motor WebGL (las mismas reglas que draw()/overlay()) */
  function scene(mp, v, W, H){
    var hid = hidden[mp.id] || {}, dmView = master(mp) && !viewAs, vs = visOf(mp), toks = [], now = Date.now(), lvl = window.Gfx ? Gfx.level() : 'media';
    if (encEd && encHere(mp)) toks = encGhosts();
    else (mp.tokens || []).forEach(function(t){ if (drag && drag.tok.id === t.id) return; if (viewAs && t.hidden) return; if (!tokShown(mp, t, vs, dmView)) return; toks.push(tokScene(t, v, !dmView && (ownT(t) || (!!vs && t.kind === 'pc')))); });
    var strokes = MapEd.strokes(mp); if (!dmView && strokes.some(hiddenObj)) strokes = strokes.filter(function(k){ return !hiddenObj(k); });
    var anim = Object.keys(doorAnim).length || (wop && wop.prev);
    var sc = {W:W, H:H, v:v, tokens:toks,
      map:{id:mp.id, cols:mp.cols, rows:mp.rows, grid:mp.grid, layers:mp.layers, strokes:strokes, rev:MapEd.rev(), hid:hid, asset:window.Assets ? Assets.imageFor : null, bgUrl:mp.bg ? (mp.bg.img ? Mesa.imgUrl(mp.bg.img) : mp.bg.data) : null, bgOp:mp.bg ? mp.bg.op : 1},
      walls:{ink:wallInk(mp, dmView, now), key:[mp.id, mp.wrev, dmView ? 1 : 0, linesOn(mp) ? 1 : 0, anim ? now : 0].join('|'), tech:mode === 'dibujar' && canAdmin(mp) ? wallTech(mp, tool.k === 'wall') : null},
      fog:mp.fog && mp.fog.on ? {on:true, dm:dmView, bits:fogBits(mp), key:fogCache[mp.id].n, un:dmView ? 0.5 : 1, mem:0, veil:vs ? veilOf(mp, dmView, vs) : null} : null,
      light:lightScene(mp, dmView, now), zones:zonePrims(mp, dmView),
      edit:mode === 'dibujar' ? MapEd.overlay(mp) : null, drawing:drawing, erase:erasing ? mp.strokes.filter(function(k){ return erasing.hits[k.id]; }) : null, fogRect:fogDrag ? {a:fogDrag.a, b:fogDrag.b, v:tool.fogV} : null, pings:[]};
    if (drag && drag.moved) {
      var t = drag.tok, s = t.s || 1, rr = ruler(mp);
      sc.ghost = Object.assign(tokScene(Object.assign({}, t, {x:drag.x, y:drag.y}), v, false), {ghost:true, bad:rr.bad && !master(mp)});
      sc.ruler = {ax:drag.sx + s / 2, ay:drag.sy + s / 2, bx:drag.x + s / 2, by:drag.y + s / 2, half:s * 0.5, text:rr.text, path:rr.path, bad:rr.bad};
      if (drag.pv) sc.preview = {polys:[drag.pv]};
    }
    var wl = wallLabel(); if (wl) sc.label = wl;
    var now = Date.now(); pings = pings.filter(function(p){ return now - p.t < 2400; });
    sc.pings = pings.map(function(p){ return {x:p.x, y:p.y, k:(now - p.t) / 2400, color:p.color, name:p.name}; });
    return sc;
  }
  function tokScene(t, v, late){
    var info = tokInfo(t);
    return {id:t.id, x:t.x, y:t.y, s:t.s || 1, color:t.color || '#8c2626', img:tokImg(t) ? Mesa.imgUrl(tokImg(t)) : null, ini:ini(info.name), name:info.name, pct:info.pct, turn:info.turn, down:info.down, hidden:!!t.hidden, sel:selTok === t.id, late:late, label:v.s >= 40 || selTok === t.id || info.turn};
  }
  /* La regla de la ficha que arrastras: en recto o rodeando paredes; si no hay camino, avisa */
  function ruler(mp){
    if (drag.dep) { var dz = deployZ(mp, ownerOf(drag.tok)), s0 = drag.tok.s || 1, rx = mp.grid !== 'none' ? Math.round(drag.x) : drag.x, ry = mp.grid !== 'none' ? Math.round(drag.y) : drag.y, out = dz.length && !inDeploy(dz, rx, ry, s0); return {bad:out, text:out ? 'Fuera de tu zona de despliegue' : 'Aquí te acomodas', path:null}; }
    var rt = drag.route, bad = !!(rt && !rt.ok), steps = rt && rt.cells ? rt.steps : Math.max(Math.abs(Math.round(drag.x - drag.sx)), Math.abs(Math.round(drag.y - drag.sy)));
    var text = bad ? (master(mp) ? 'Atraviesa paredes (solo el DM)' : 'Hay una pared en medio') : (steps * 1.5).toString().replace('.', ',') + ' m · ' + steps + ' casilla' + (steps === 1 ? '' : 's') + (rt && rt.cells ? ' · rodeando' : '');
    return {bad:bad, text:text, path:rt && rt.cells ? drag.path : null};
  }
  /* Largo de la pared que trazas */
  function wallLabel(){
    if (!wop || wop.k !== 'new' || !wop.moved || !wop.b) return null;
    var dx = Math.abs(wop.b[0] - wop.a[0]), dy = Math.abs(wop.b[1] - wop.a[1]), m = function(x){ return String(Math.round(x * 15) / 10).replace('.', ','); };
    return {x:wop.b[0], y:wop.b[1], text:tool.wroom ? m(dx) + ' × ' + m(dy) + ' m' : m(Math.hypot(dx, dy)) + ' m'};
  }
  /* ---------- Paredes en el mapa ----------
     Se describen con figuras sencillas que dibujan igual Canvas 2D y WebGL:
       seg {a, b, w, c, o, d (guiones), px (ancho en píxeles)} · door {a, b, r (grados abierta), w, c, s, o, dash} · dot {x, y, r, c} · lock {x, y} · arrow {a, b, c}
     wallInk: lo que forma parte del mapa (debajo de la niebla). wallTech: las líneas de colores para editar (encima de todo). */
  function wallsShown(mp){ if (!wop || !wop.prev) return mp.walls; return mp.walls.map(function(w){ return wop.prev[w.id] || w; }); }
  function doorAng(w, now){
    var a = doorAnim[w.id], tg = w.open ? 1 : 0; if (!a) return tg;
    var k = Math.min(1, (now - a.t0) / 280); if (k >= 1) { delete doorAnim[w.id]; return tg; }
    k = 1 - Math.pow(1 - k, 3); return a.to ? k : 1 - k;
  }
  function wallInk(mp, dmView, now){
    var out = [], lines = linesOn(mp);
    wallsShown(mp).forEach(function(w){
      var t = w.t;
      if (t === 'door' || t === 'secret') {
        if (t === 'secret' && !dmView) return;
        var r = doorAng(w, now) * 80;
        if (r > 1) out.push({p:'seg', a:w.a, b:w.b, w:0.05, c:'#2b1d12', o:0.4, d:0.12});
        out.push({p:'door', a:w.a, b:w.b, r:r, w:0.22, c:t === 'secret' ? '#7a3f86' : '#8a5a2b', s:'#2b1d12', o:1, dash:t === 'secret'});
        if (w.lock && dmView) out.push({p:'lock', x:(w.a[0] + w.b[0]) / 2, y:(w.a[1] + w.b[1]) / 2});
        return;
      }
      if (t === 'barrier') { if (dmView) out.push({p:'seg', a:w.a, b:w.b, w:0.06, c:'#5b9cf0', o:0.55, d:0.3}); return; }
      if (!lines) { if (dmView) out.push({p:'seg', a:w.a, b:w.b, w:0.07, c:t === 'window' ? '#2f6f8a' : '#2b1d12', o:0.45, d:t === 'low' || t === 'curtain' ? 0.25 : 0}); return; }
      if (t === 'window') { out.push({p:'seg', a:w.a, b:w.b, w:0.22, c:'#2b1d12', o:1}); out.push({p:'seg', a:w.a, b:w.b, w:0.1, c:'#bfe6f2', o:1}); return; }
      if (t === 'low') { out.push({p:'seg', a:w.a, b:w.b, w:0.12, c:'#5a4630', o:0.9, d:0.18}); return; }
      if (t === 'curtain') { out.push({p:'seg', a:w.a, b:w.b, w:0.12, c:'#6a3fa0', o:0.85, d:0.12}); return; }
      out.push({p:'seg', a:w.a, b:w.b, w:0.18, c:'#2b1d12', o:1});
    });
    return out;
  }
  function wallTech(mp, full){
    var out = [], er = erasing && erasing.walls || {};
    wallsShown(mp).forEach(function(w){
      var col = WCOL[w.t] || WCOL.wall, sel = full && w.id === selWall, dash = w.t === 'secret' || w.t === 'barrier' || w.t === 'low' ? 8 : w.t === 'curtain' ? 3 : 0;
      if (sel) out.push({p:'seg', a:w.a, b:w.b, w:11, px:1, c:'#fff3c4', o:0.35});
      out.push({p:'seg', a:w.a, b:w.b, w:full ? (sel ? 5 : 3.5) : 2, px:1, c:er[w.id] ? '#ff3b30' : col, o:full ? 1 : 0.6, d:dash});
      if (w.t === 'oneway') { var dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], L = Math.hypot(dx, dy) || 1, sg = w.side < 0 ? -1 : 1, nx = dy / L * sg, ny = -dx / L * sg, mx = (w.a[0] + w.b[0]) / 2, my = (w.a[1] + w.b[1]) / 2; out.push({p:'arrow', a:[mx + nx * 0.6, my + ny * 0.6], b:[mx + nx * 0.08, my + ny * 0.08], c:col, o:full ? 1 : 0.6}); }
      if (isDoorT(w) && full) out.push({p:'door', a:w.a, b:w.b, r:w.open ? 80 : 0, w:0.16, c:col, s:'#2b1d12', o:0.75, dash:w.t === 'secret'});
      if (full) { out.push({p:'dot', x:w.a[0], y:w.a[1], r:sel ? 6 : 3.5, c:sel ? '#fff8e6' : col}); out.push({p:'dot', x:w.b[0], y:w.b[1], r:sel ? 6 : 3.5, c:sel ? '#fff8e6' : col}); }
    });
    if (wop && wop.k === 'new' && wop.moved && wop.b) {
      var c = WCOL[tool.wt] || WCOL.wall, a = wop.a, b = wop.b;
      var segs = tool.wroom ? [[a, [b[0], a[1]]], [[b[0], a[1]], b], [b, [a[0], b[1]]], [[a[0], b[1]], a]] : [[a, b]];
      segs.forEach(function(q){ out.push({p:'seg', a:q[0], b:q[1], w:4, px:1, c:c, o:0.95}); });
      out.push({p:'dot', x:a[0], y:a[1], r:5, c:'#fff8e6'}); out.push({p:'dot', x:b[0], y:b[1], r:5, c:'#fff8e6'});
    }
    return out;
  }
  /* Zonas en el mapa: zone {x, y, w, h, c, a (relleno), o, d (guiones px), lw (px)} · path {pts, c, lw, o} · label {x, y, t, c} */
  var GLYPH = {paso:[[[-0.9, 0.8], [-0.3, 0.8], [-0.3, 0.2], [0.3, 0.2], [0.3, -0.4], [0.9, -0.4], [0.9, -0.9]]], trampa:[[[-0.9, 0.7], [-0.6, -0.6], [-0.3, 0.7], [0, -0.6], [0.3, 0.7], [0.6, -0.6], [0.9, 0.7]]],
    texto:[[[-0.8, -0.5], [0.8, -0.5]], [[-0.8, 0], [0.8, 0]], [[-0.8, 0.5], [0.4, 0.5]]], encuentro:[[[0, -0.9], [0, 0.35]], [[0, 0.7], [0, 0.8]], [[-0.8, -0.8], [-0.5, -0.3]], [[0.8, -0.8], [0.5, -0.3]]],
    lock:[[[-0.5, 0], [0.5, 0], [0.5, 0.8], [-0.5, 0.8], [-0.5, 0]], [[-0.3, 0], [-0.3, -0.4], [0, -0.7], [0.3, -0.4], [0.3, 0]]],
    despliegue:[[[-0.6, 0.9], [-0.6, -0.9]], [[-0.6, -0.85], [0.75, -0.85], [0.35, -0.45], [0.75, -0.05], [-0.6, -0.05]]]};
  var DEPC = '#5fb85a';
  function deployPrim(out, z, sel, o){
    var r = Math.max(0.22, Math.min(0.45, Math.min(z.w, z.h) * 0.3)), cx = z.x + z.w / 2, cy = z.y + z.h / 2;
    out.push({p:'zone', x:z.x, y:z.y, w:z.w, h:z.h, c:DEPC, a:sel ? 0.24 : 0.14, o:o, d:7, lw:sel ? 3 : 2.2});
    glyph(out, 'despliegue', cx, cy, r, DEPC, o);
    out.push({p:'label', x:cx, y:z.y + z.h + 0.08, t:(z.name || 'Despliegue') + (z.for ? ' · ' + who(z.for) : ''), c:'#2f6b2a'});
    if (sel) out.push({p:'dot', x:z.x + z.w, y:z.y + z.h, r:6, c:'#fff8e6'});
  }
  function glyph(out, k, x, y, r, c, o){ (GLYPH[k] || []).forEach(function(line){ out.push({p:'path', pts:line.map(function(q){ return [x + q[0] * r, y + q[1] * r]; }), c:c, lw:2.2, o:o}); }); }
  function zonePrims(mp, dmView){
    var ink = [], top = [], edit = mode === 'dibujar' && tool.k === 'zone', ee = encEd && encHere(mp) ? encData() : null, dep = !ee && deploying(mp);
    (mp.trig || []).forEach(function(z){
      if (z.k === 'despliegue') { if (dep) deployPrim(top, z, false, 1); return; }
      var T = zoneT(z.k), col = T[3], r = Math.max(0.22, Math.min(0.45, Math.min(z.w, z.h) * 0.3)), cx = z.x + z.w / 2, cy = z.y + z.h / 2;
      if (dmView) {
        var sel = edit && z.id === selZone, o = (z.fired ? 0.45 : 1) * (edit ? 1 : 0.7);
        top.push({p:'zone', x:z.x, y:z.y, w:z.w, h:z.h, c:col, a:sel ? 0.2 : 0.1, o:o, d:z.hidden || z.k !== 'paso' ? 6 : 0, lw:sel ? 3 : 2});
        glyph(top, z.k, cx, cy, r, col, o); if (z.lock) glyph(top, 'lock', z.x + z.w - 0.3, z.y + 0.35, 0.22, col, o);
        top.push({p:'label', x:cx, y:z.y + z.h + 0.08, t:(z.name || T[1]) + (z.k === 'paso' && z.toName ? ' » ' + z.toName : '') + (z.fired ? ' ✓' : ''), c:col});
        if (sel) top.push({p:'dot', x:z.x + z.w, y:z.y + z.h, r:6, c:'#fff8e6'});
      } else if (z.k === 'paso' && !z.hidden) {
        ink.push({p:'zone', x:z.x, y:z.y, w:z.w, h:z.h, c:'#e8c26a', a:0.14, o:0.85, d:0, lw:2});
        glyph(ink, 'paso', cx, cy, r, '#7a5a1c', 1); if (z.lock) glyph(ink, 'lock', z.x + z.w - 0.3, z.y + 0.35, 0.22, '#7a5a1c', 1);
        if (z.name) ink.push({p:'label', x:cx, y:z.y + z.h + 0.08, t:z.name, c:'#2b1d12'});
      }
    });
    if (zop && zop.k === 'new' && zop.moved) { var a = zop.a, b = zop.b, c0 = zoneT(tool.zk)[3]; top.push({p:'zone', x:Math.min(a[0], b[0]), y:Math.min(a[1], b[1]), w:Math.abs(a[0] - b[0]) + 1, h:Math.abs(a[1] - b[1]) + 1, c:c0, a:0.2, o:1, d:6, lw:2}); }
    if (ee) {
      ee.deploy.forEach(function(z){ deployPrim(top, z, encEd.k === 'deploy' && encEd.zsel === z.id, encEd.k === 'deploy' ? 1 : 0.55); });
      if (eop && eop.k === 'znew' && eop.moved) { var a1 = eop.a, b1 = eop.b; top.push({p:'zone', x:Math.min(a1[0], b1[0]), y:Math.min(a1[1], b1[1]), w:Math.abs(a1[0] - b1[0]) + 1, h:Math.abs(a1[1] - b1[1]) + 1, c:DEPC, a:0.22, o:1, d:7, lw:2}); }
      var sg = encEd.sel && ee.npcs.filter(function(d){ return d.k === encEd.sel && d.x != null; })[0];
      if (sg) { var ss = sg.s || 1; top.push({p:'zone', x:sg.x - 0.08, y:sg.y - 0.08, w:ss + 0.16, h:ss + 0.16, c:'#ffd66e', a:0, o:1, d:5, lw:2.5}); }
    }
    return {ink:ink, top:top};
  }
  /* Canvas 2D: las mismas figuras */
  function primsOn(c, list, v){
    list.forEach(function(q){
      c.save(); c.globalAlpha = q.o == null ? 1 : q.o; var X = function(p){ return [v.x + p[0] * v.s, v.y + p[1] * v.s]; };
      if (q.p === 'seg') { var a = X(q.a), b = X(q.b); c.strokeStyle = q.c; c.lineWidth = q.px ? q.w : Math.max(1, q.w * v.s); c.lineCap = q.d ? 'butt' : 'round'; if (q.d) { var dd = q.px ? q.d : Math.max(2, q.d * v.s); c.setLineDash([dd, dd * 0.8]); } c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
      else if (q.p === 'door') {
        var h = X(q.a), L = Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]) * v.s * 0.97, an = Math.atan2(q.b[1] - q.a[1], q.b[0] - q.a[0]) + q.r * Math.PI / 180, w = Math.max(3, q.w * v.s);
        c.translate(h[0], h[1]); c.rotate(an); c.fillStyle = q.c; c.strokeStyle = q.s; c.lineWidth = Math.max(1, w * 0.16);
        if (q.dash) { c.globalAlpha *= 0.6; c.setLineDash([w * 0.7, w * 0.45]); }
        c.beginPath(); c.rect(0, -w / 2, L, w); c.fill(); c.stroke(); c.setLineDash([]); c.beginPath(); c.arc(0, 0, w * 0.32, 0, Math.PI * 2); c.fillStyle = q.s; c.fill();
      }
      else if (q.p === 'dot') { var d = X([q.x, q.y]); c.beginPath(); c.arc(d[0], d[1], q.r, 0, Math.PI * 2); c.fillStyle = q.c; c.fill(); c.strokeStyle = '#2b1d12'; c.lineWidth = 1.5; c.stroke(); }
      else if (q.p === 'lock') { var l = X([q.x, q.y]), z = Math.max(5, v.s * 0.16); c.fillStyle = '#ffd66e'; c.strokeStyle = '#2b1d12'; c.lineWidth = 1.5; c.beginPath(); c.rect(l[0] - z, l[1] - z * 0.2, z * 2, z * 1.5); c.fill(); c.stroke(); c.beginPath(); c.arc(l[0], l[1] - z * 0.2, z * 0.65, Math.PI, 0); c.stroke(); }
      else if (q.p === 'zone') { var zx = v.x + q.x * v.s, zy = v.y + q.y * v.s, zw = q.w * v.s, zh = q.h * v.s; c.globalAlpha = q.a; c.fillStyle = q.c; c.fillRect(zx, zy, zw, zh); c.globalAlpha = q.o; c.strokeStyle = q.c; c.lineWidth = q.lw || 2; if (q.d) c.setLineDash([q.d, q.d * 0.7]); c.strokeRect(zx, zy, zw, zh); }
      else if (q.p === 'path') { c.strokeStyle = q.c; c.lineWidth = q.lw || 2; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); q.pts.forEach(function(pt, i){ var X0 = v.x + pt[0] * v.s, Y0 = v.y + pt[1] * v.s; if (i) c.lineTo(X0, Y0); else c.moveTo(X0, Y0); }); c.stroke(); }
      else if (q.p === 'label') { if (v.s < 14) { c.restore(); return; } var lx = v.x + q.x * v.s, ly = v.y + q.y * v.s; c.font = '600 12px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'top'; c.lineWidth = 3; c.strokeStyle = 'rgba(243,233,210,.9)'; c.strokeText(q.t, lx, ly); c.fillStyle = q.c; c.fillText(q.t, lx, ly); }
      else if (q.p === 'arrow') { var ta = X(q.a), tb = X(q.b), ang = Math.atan2(tb[1] - ta[1], tb[0] - ta[0]), k = 7; c.strokeStyle = q.c; c.lineWidth = 2.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(ta[0], ta[1]); c.lineTo(tb[0], tb[1]); c.moveTo(tb[0] - k * Math.cos(ang - 0.5), tb[1] - k * Math.sin(ang - 0.5)); c.lineTo(tb[0], tb[1]); c.lineTo(tb[0] - k * Math.cos(ang + 0.5), tb[1] - k * Math.sin(ang + 0.5)); c.stroke(); }
      c.restore();
    });
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
    var list = window.MapEd ? MapEd.strokes(mp) : mp.strokes, dmView = master(mp) && !viewAs, vs = visOf(mp), late = [], ls = lightScene(mp, dmView, Date.now());
    mp.layers.forEach(function(l){ if (hid[l.id]) return; list.forEach(function(k){ if (k.l === l.id && (dmView || !hiddenObj(k))) strokeOn(c, k, v); }); });
    primsOn(c, wallInk(mp, dmView, Date.now()), v);
    var zp = zonePrims(mp, dmView); primsOn(c, zp.ink, v);
    if (ls.tint) { c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = ls.tint.a; c.fillStyle = ls.tint.c; c.fillRect(v.x, v.y, mp.cols * v.s, mp.rows * v.s); c.restore(); }
    if (ls.glow) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = ls.glow.a; c.drawImage(ls.glow.cv, v.x, v.y, mp.cols * v.s, mp.rows * v.s); c.restore(); }
    if (encEd && encHere(mp)) encGhosts().forEach(function(g){ tokOn(c, {id:g.id, x:g.x, y:g.y, s:g.s, color:g.color, img:g.imgId, name:g.name, hidden:g.hidden}, v, mp); });
    else (mp.tokens || []).forEach(function(t){ if (drag && drag.tok.id === t.id) return; if (viewAs && t.hidden) return; if (!tokShown(mp, t, vs, dmView)) return; if (!dmView && (ownT(t) || (vs && t.kind === 'pc'))) late.push(t); else tokOn(c, t, v, mp); });
    if (mp.fog && mp.fog.on) fogOn(c, mp, v, W, H, dmView, vs);
    late.forEach(function(t){ tokOn(c, t, v, mp); });
    c.strokeStyle = 'rgba(60,40,20,.6)'; c.lineWidth = 1.5; c.strokeRect(v.x, v.y, mp.cols * v.s, mp.rows * v.s);
  }
  /* Niebla en Canvas 2D. Con la visión: negro lo no descubierto, penumbra lo descubierto y limpio lo que el grupo ve ahora
     (se compone en un lienzo aparte y se recortan los polígonos de vista) */
  function fogOn(c, mp, v, W, H, dmView, vs){
    var bits = fogBits(mp), x0 = Math.max(0, Math.floor(-v.x / v.s)), x1 = Math.min(mp.cols - 1, Math.ceil((W - v.x) / v.s)), y0 = Math.max(0, Math.floor(-v.y / v.s)), y1 = Math.min(mp.rows - 1, Math.ceil((H - v.y) / v.s));
    // con visión, el velo ya compuesto (el mismo que usa WebGL) se estira sobre el mapa
    if (vs) { var vl = veilOf(mp, dmView, vs), M = vl.M; c.drawImage(vl.cv, v.x - M * v.s, v.y - M * v.s, (mp.cols + M * 2) * v.s, (mp.rows + M * 2) * v.s); return; }
    var g = c, un = dmView ? 'rgba(12,8,6,.5)' : '#0b0806', mem = null;
    c.save();
    for (var y = y0; y <= y1; y++) {
      var run = -1, st = -1;
      for (var x = x0; x <= x1 + 1; x++) {
        var k = x <= x1 ? (seen(bits, mp, x, y) ? 1 : 0) : -1;
        // bordes redondeados al píxel: las franjas no se enciman (si no, se ven rayas más oscuras con la niebla translúcida)
        if (k !== st) { if (run >= 0 && (st === 0 || mem)) { var rx0 = Math.round(v.x + run * v.s), rx1 = Math.round(v.x + x * v.s), ry0 = Math.round(v.y + y * v.s), ry1 = Math.round(v.y + (y + 1) * v.s); g.fillStyle = st === 0 ? un : mem; g.fillRect(rx0, ry0, rx1 - rx0, ry1 - ry0); } run = x; st = k; }
      }
    }
    c.restore();
  }
  function tokOn(c, t, v, mp, ghost){
    var info = tokInfo(t), s = t.s || 1, cx = v.x + (t.x + s / 2) * v.s, cy = v.y + (t.y + s / 2) * v.s, rad = Math.max(5, s * v.s * 0.44);
    c.save(); if (t.hidden) c.globalAlpha = 0.5; if (ghost) c.globalAlpha = 0.85;
    if (info.turn) { c.beginPath(); c.arc(cx, cy, rad + Math.max(3, v.s * 0.12), 0, Math.PI * 2); c.fillStyle = 'rgba(255,214,110,.55)'; c.fill(); }
    c.beginPath(); c.arc(cx, cy, rad, 0, Math.PI * 2); c.fillStyle = t.color || '#8c2626'; c.fill();
    var tid = tokImg(t), im = tid && tokImage(tid);
    if (im) { c.save(); c.beginPath(); c.arc(cx, cy, rad - 1.5, 0, Math.PI * 2); c.clip(); var k = Math.max(rad * 2 / im.naturalWidth, rad * 2 / im.naturalHeight); c.drawImage(im, cx - im.naturalWidth * k / 2, cy - im.naturalHeight * k / 2, im.naturalWidth * k, im.naturalHeight * k); c.restore(); }
    else { c.fillStyle = '#fff'; c.font = '700 ' + Math.max(8, rad * 0.8) + 'px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ini(info.name), cx, cy + 1); }
    c.lineWidth = Math.max(1.5, v.s * (ghost === 'bad' ? 0.1 : 0.06)); c.strokeStyle = ghost === 'bad' ? '#ff4b3a' : selTok === t.id ? '#ffd66e' : 'rgba(20,12,8,.85)'; if (t.hidden) c.setLineDash([4, 3]); c.stroke(); c.setLineDash([]);
    if (info.pct != null && v.s >= 10) { var p = Math.max(0, Math.min(1, info.pct)); c.beginPath(); c.arc(cx, cy, rad + c.lineWidth, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); c.strokeStyle = p > 0.66 ? '#5fb85a' : p > 0.33 ? '#e0b43a' : '#d24a3a'; c.lineWidth = Math.max(2, v.s * 0.08); c.stroke(); }
    if (info.down) { c.strokeStyle = '#d24a3a'; c.lineWidth = Math.max(2, rad * 0.18); c.beginPath(); c.moveTo(cx - rad * 0.6, cy - rad * 0.6); c.lineTo(cx + rad * 0.6, cy + rad * 0.6); c.moveTo(cx + rad * 0.6, cy - rad * 0.6); c.lineTo(cx - rad * 0.6, cy + rad * 0.6); c.stroke(); }
    if (v.s >= 40 || selTok === t.id || info.turn) { var fs = Math.max(10, Math.min(15, v.s * 0.38)); var lbl = info.name.length > 14 ? info.name.slice(0, 13) + '…' : info.name; c.font = '600 ' + fs + 'px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'top'; c.lineWidth = 3; c.strokeStyle = 'rgba(243,233,210,.9)'; var ly = cy + rad + 3; c.strokeText(lbl, cx, ly); c.fillStyle = '#2b1d12'; c.fillText(lbl, cx, ly); }
    c.restore();
  }
  /* Encima de todo: la ficha que arrastras con su regla, el área de niebla y las señales */
  function overlay(c, mp, v){
    if (drag && drag.moved) {
      var t = drag.tok, s = t.s || 1, ax = v.x + (drag.sx + s / 2) * v.s, ay = v.y + (drag.sy + s / 2) * v.s, bx = v.x + (drag.x + s / 2) * v.s, by = v.y + (drag.y + s / 2) * v.s, rr = ruler(mp), gold = rr.bad ? '#ff6b5a' : '#ffd66e';
      if (drag.pv) { c.save(); c.beginPath(); for (var pi = 0; pi < drag.pv.length; pi += 2) { var qx = v.x + drag.pv[pi] * v.s, qy = v.y + drag.pv[pi + 1] * v.s; if (pi) c.lineTo(qx, qy); else c.moveTo(qx, qy); } c.closePath(); c.fillStyle = 'rgba(255,214,110,.08)'; c.fill(); c.strokeStyle = 'rgba(255,214,110,.6)'; c.lineWidth = 1.5; c.stroke(); c.restore(); }
      c.save(); c.strokeStyle = gold; c.globalAlpha = 0.95; c.lineWidth = 3; c.setLineDash([8, 6]); c.beginPath(); c.moveTo(ax, ay);
      if (rr.path) rr.path.forEach(function(q, i){ if (i) c.lineTo(v.x + q[0] * v.s, v.y + q[1] * v.s); }); else c.lineTo(bx, by);
      c.stroke(); c.restore();
      tokOn(c, Object.assign({}, t, {x:drag.x, y:drag.y}), v, mp, rr.bad && !master(mp) ? 'bad' : true);
      tag(c, rr.text, bx, by - s * v.s * 0.5 - 21, gold);
    }
    if (mode === 'dibujar' && canAdmin(mp)) primsOn(c, wallTech(mp, tool.k === 'wall'), v);
    primsOn(c, zonePrims(mp, master(mp) && !viewAs).top, v);
    var wl = wallLabel(); if (wl) tag(c, wl.text, v.x + wl.x * v.s, v.y + wl.y * v.s - 26, '#ffd66e');
    if (mode === 'dibujar' && window.MapEd) editOn(c, MapEd.overlay(mp), v);
    if (fogDrag) { var r = fogDrag; c.save(); c.fillStyle = tool.fogV ? 'rgba(95,184,90,.28)' : 'rgba(10,6,4,.55)'; c.strokeStyle = tool.fogV ? '#5fb85a' : '#ffd66e'; c.lineWidth = 2; var x0 = Math.min(r.a[0], r.b[0]), y0 = Math.min(r.a[1], r.b[1]); c.fillRect(v.x + x0 * v.s, v.y + y0 * v.s, (Math.abs(r.a[0] - r.b[0]) + 1) * v.s, (Math.abs(r.a[1] - r.b[1]) + 1) * v.s); c.strokeRect(v.x + x0 * v.s, v.y + y0 * v.s, (Math.abs(r.a[0] - r.b[0]) + 1) * v.s, (Math.abs(r.a[1] - r.b[1]) + 1) * v.s); c.restore(); }
    var now = Date.now(); pings = pings.filter(function(p){ return now - p.t < 2400; });
    pings.forEach(function(p){ var k = (now - p.t) / 2400, px = v.x + p.x * v.s, py = v.y + p.y * v.s; c.save(); c.globalAlpha = 1 - k; c.strokeStyle = p.color || '#ffd66e'; c.lineWidth = 4; for (var i = 0; i < 2; i++) { c.beginPath(); c.arc(px, py, 8 + ((k * 2 + i * 0.5) % 1) * v.s * 2.2, 0, Math.PI * 2); c.stroke(); } c.fillStyle = p.color || '#ffd66e'; c.beginPath(); c.arc(px, py, 5, 0, Math.PI * 2); c.fill(); if (p.name) { c.font = '700 14px Georgia, serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(18,13,11,.9)'; c.strokeText(p.name, px, py - 16); c.fillStyle = '#fff'; c.fillText(p.name, px, py - 16); } c.restore(); });
  }
  /* Etiqueta oscura con letras doradas (regla, largo de una pared) */
  function tag(c, text, cx, cy, col){
    c.save(); c.font = '700 15px Georgia, serif'; var w = c.measureText(text).width + 16, lx = Math.min((canvas.clientWidth || 300) - w - 4, Math.max(4, cx - w / 2)), ly = Math.max(4, cy - 13);
    c.fillStyle = 'rgba(18,13,11,.88)'; c.fillRect(lx, ly, w, 26); c.strokeStyle = col; c.lineWidth = 1; c.strokeRect(lx, ly, w, 26); c.fillStyle = col; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(text, lx + 8, ly + 13); c.restore();
  }
  function animate(){ if (raf) return; var step = function(){ raf = 0; paint(); if (pings.length || Object.keys(doorAnim).length) raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step); }
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
    if (k.k === 'asset' || k.k === 'img') {
      var im = window.Assets && Assets.imageFor(k); if (!im) return; var q = P(0), w = (k.s || 1) * v.s, h = (k.h || k.s || 1) * v.s;
      c.save(); c.translate(q[0], q[1]); if (k.r) c.rotate(k.r * Math.PI / 180); c.drawImage(im, -w / 2, -h / 2, w, h); c.restore(); return;
    }
    c.save(); c.strokeStyle = k.c; c.fillStyle = k.c; c.lineWidth = Math.max(1, k.w * v.s); c.lineCap = 'round'; c.lineJoin = 'round';
    if (k.k === 'text') { var p = P(0), fs = Math.max(6, (k.fs || TEXTS[k.w] || k.w * 6) * v.s); c.translate(p[0], p[1]); if (k.r) c.rotate(k.r * Math.PI / 180); c.font = '600 ' + fs + 'px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = Math.max(2, fs / 6); c.strokeStyle = 'rgba(243,233,210,.85)'; c.strokeText(k.t, 0, 0); c.fillText(k.t, 0, 0); }
    else if (k.k === 'rect') { var a = P(0), b = P(2), w2 = Math.abs(a[0] - b[0]), h2 = Math.abs(a[1] - b[1]); c.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); if (k.r) c.rotate(k.r * Math.PI / 180); if (k.f) { c.globalAlpha = 0.35; c.fillRect(-w2 / 2, -h2 / 2, w2, h2); c.globalAlpha = 1; } c.strokeRect(-w2 / 2, -h2 / 2, w2, h2); }
    else { c.beginPath(); var q2 = P(0); c.moveTo(q2[0], q2[1]); if (k.pts.length === 2) c.lineTo(q2[0] + 0.1, q2[1]); for (var i = 2; i < k.pts.length; i += 2) { var pp = P(i); c.lineTo(pp[0], pp[1]); } c.stroke(); }
    c.restore();
  }
  /* Selección del editor: cajas, manijas y el recuadro que encierra (modo Dibujar) */
  function editOn(c, ed, v){
    if (!ed) return; var X = function(p){ return [v.x + p[0] * v.s, v.y + p[1] * v.s]; };
    c.save();
    if (ed.lasso) { var l = ed.lasso; c.fillStyle = 'rgba(217,184,102,.12)'; c.strokeStyle = '#d9b866'; c.lineWidth = 1.5; c.setLineDash([6, 4]); var x0 = v.x + Math.min(l.x0, l.x1) * v.s, y0 = v.y + Math.min(l.y0, l.y1) * v.s, w = Math.abs(l.x1 - l.x0) * v.s, h = Math.abs(l.y1 - l.y0) * v.s; c.fillRect(x0, y0, w, h); c.strokeRect(x0, y0, w, h); c.setLineDash([]); }
    (ed.boxes || []).forEach(function(b){ var pts = MapEdCorners(b).map(X); c.strokeStyle = 'rgba(217,184,102,.7)'; c.lineWidth = 1; c.beginPath(); pts.forEach(function(p, i){ if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); c.stroke(); });
    var H = ed.handles; if (H) {
      var cs = H.corners.map(X), t = X(H.top), r = X(H.rot);
      c.strokeStyle = '#d9b866'; c.lineWidth = 2; c.setLineDash([7, 4]); c.beginPath(); cs.forEach(function(p, i){ if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); c.stroke(); c.setLineDash([]);
      c.beginPath(); c.moveTo(t[0], t[1]); c.lineTo(r[0], r[1]); c.stroke();
      cs.forEach(function(p){ c.fillStyle = '#fff8e6'; c.fillRect(p[0] - 6, p[1] - 6, 12, 12); c.strokeRect(p[0] - 6, p[1] - 6, 12, 12); });
      c.fillStyle = '#d9b866'; c.beginPath(); c.arc(r[0], r[1], 8, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#2b1d12'; c.lineWidth = 1.5; c.stroke();
    }
    c.restore();
  }
  function MapEdCorners(b){ var a = (b.r || 0) * Math.PI / 180, co = Math.cos(a), si = Math.sin(a); return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(function(q){ var dx = q[0] * b.w / 2, dy = q[1] * b.h / 2; return [b.cx + dx * co - dy * si, b.cy + dx * si + dy * co]; }); }


  /* ---------- Dedo y ratón ---------- */
  function snapPt(p, kind){ if (!tool.snap || maps[cur].grid === 'none') return p; if (kind === 'text') return [Math.floor(p[0]) + 0.5, Math.floor(p[1]) + 0.5]; return [Math.round(p[0]), Math.round(p[1])]; }
  function clampPt(p){ var mp = maps[cur]; return [Math.round(Math.max(0, Math.min(mp.cols, p[0])) * 100) / 100, Math.round(Math.max(0, Math.min(mp.rows, p[1])) * 100) / 100]; }
  function local(ev){ var r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; }
  function tokAt(mp, m){
    var dmView = master(mp) && !viewAs, vs = dmView ? null : visOf(mp);
    for (var i = mp.tokens.length - 1; i >= 0; i--) { var t = mp.tokens[i], s = t.s || 1, cx = t.x + s / 2, cy = t.y + s / 2; if (Math.hypot(m[0] - cx, m[1] - cy) <= Math.max(s * 0.5 + 0.15, 24 / V().s)) { if (viewAs && t.hidden) continue; if (vs && !tokShown(mp, t, vs, false)) continue; if (!dmView && mp.fog && mp.fog.on && !ownT(t) && !(vs && t.kind === 'pc')) { var b = fogBits(mp); if (!seen(b, mp, Math.floor(cx), Math.floor(cy)) && !(vs && seenAt(vs, cx, cy))) continue; } return t; } }
    return null;
  }
  function bind(){
    canvas.addEventListener('pointerdown', function(ev){
      ev.preventDefault(); try { canvas.setPointerCapture(ev.pointerId); } catch(e){}
      ptr[ev.pointerId] = local(ev);
      var ids = Object.keys(ptr), mp = maps[cur];
      clearTimeout(press && press.t); press = null;
      if (ids.length === 2) { drawing = null; erasing = null; drag = null; fogDrag = null; wop = null; zop = null; if (edOn) { MapEd.cancel(); edOn = false; } var a = ptr[ids[0]], b = ptr[ids[1]]; gesture = {d:Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, cx:(a[0] + b[0]) / 2, cy:(a[1] + b[1]) / 2}; paint(); return; }
      if (ids.length > 2) return;
      var p = local(ev), m = toMap(p[0], p[1]);
      if (ev.button === 1 || ev.button === 2) { gesture = {pan:true, px:p[0], py:p[1]}; return; }
      if (encEd && encHere(mp)) { encDown(mp, m, ev, p); return; }
      if (mode === 'jugar') {
        var t = tokAt(mp, m), dw = doorAt(mp, m);
        // junto a una puerta, la ficha solo se toma si tocas su círculo (si no, se toca la puerta)
        if (t && dw) { var tc = Vision.center(t); if (Math.hypot(m[0] - tc[0], m[1] - tc[1]) > (t.s || 1) * 0.44) t = null; }
        if (t) { var blk = mine(t) ? moveBlock(mp, t) : null; drag = {tok:t, ox:m[0] - t.x, oy:m[1] - t.y, sx:t.x, sy:t.y, x:t.x, y:t.y, moved:false, can:mine(t) && !blk, blk:blk, dep:!master(mp) && shared(mp.id) && deploying(mp), px:p[0], py:p[1]}; return; }
        var zw = !dw && !t && zoneAt(mp, m, 'paso'), vsz = zw && !(master(mp) && !viewAs) && mp.fog && mp.fog.on ? fogBits(mp) : null;
        if (zw && vsz && !seen(vsz, mp, Math.min(mp.cols - 1, Math.floor(m[0])), Math.min(mp.rows - 1, Math.floor(m[1])))) zw = null; // una escalera aún sin descubrir no se toca
        if (zw && zw.hidden && !master(mp)) zw = null;
        gesture = {pan:true, px:p[0], py:p[1], tap:true, x0:p[0], y0:p[1], door:dw, zone:zw};
        if (!dw && !zw) press = {t:setTimeout(function(){ if (gesture && gesture.tap) { gesture.tap = false; ping(mp, clampPt(m)); } }, 550)};
        return;
      }
      if (mode === 'niebla') { var cell = [Math.max(0, Math.min(mp.cols - 1, Math.floor(m[0]))), Math.max(0, Math.min(mp.rows - 1, Math.floor(m[1])))]; fogDrag = {a:cell, b:cell}; paint(); return; }
      if (tool.k === 'select') { MapEd.down(mp, m[0], m[1], ev); edOn = true; return; }
      if (tool.k === 'wall') { if (canAdmin(mp)) wallDown(mp, m, ev); return; }
      if (tool.k === 'zone') { if (master(mp)) zoneDown(mp, m, ev); return; }
      if (tool.k === 'asset') { if (MapEd.onHandle(mp, m[0], m[1], ev.pointerType === 'touch')) { MapEd.down(mp, m[0], m[1], ev); edOn = true; } else placeAsset(mp, m); return; }
      if (tool.k === 'pan') { gesture = {pan:true, px:p[0], py:p[1]}; return; }
      if (tool.k === 'text') { var tx = clampPt(snapPt(m, 'text')); askText(tx, p); return; }
      if (tool.k === 'erase') { erasing = {hits:{}, walls:{}}; eraseAt(m); return; }
      var s = clampPt(snapPt(m, tool.k));
      drawing = {k:tool.k, l:tool.layer, c:tool.c, w:tool.w, pts: tool.k === 'pen' ? [s[0], s[1]] : [s[0], s[1], s[0], s[1]]}; if (tool.k === 'rect' && tool.fill) drawing.f = 1;
      paint();
    });
    canvas.addEventListener('pointermove', function(ev){
      if (!ptr[ev.pointerId]) { if (ev.pointerType === 'mouse' && mode === 'jugar' && maps[cur]) { var hp = local(ev), hm = toMap(hp[0], hp[1]), hv = doorAt(maps[cur], hm) || zoneAt(maps[cur], hm, 'paso'); canvas.style.cursor = hv ? 'pointer' : ''; } return; }
      var p = local(ev); ptr[ev.pointerId] = p;
      var ids = Object.keys(ptr), mp = maps[cur];
      if (gesture && !gesture.pan && ids.length === 2) { var a = ptr[ids[0]], b = ptr[ids[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, v = V(); v.x += cx - gesture.cx; v.y += cy - gesture.cy; zoomAt(d / gesture.d, cx, cy); gesture.d = d; gesture.cx = cx; gesture.cy = cy; return; }
      if (gesture && gesture.pan) { if (gesture.tap && Math.hypot(p[0] - gesture.x0, p[1] - gesture.y0) > 8) { gesture.tap = false; clearTimeout(press && press.t); } var v2 = V(); v2.x += p[0] - gesture.px; v2.y += p[1] - gesture.py; gesture.px = p[0]; gesture.py = p[1]; paint(); return; }
      var m = toMap(p[0], p[1]);
      if (eop) { encMove(mp, m, p); return; }
      if (drag) {
        if (!drag.can) { if (drag.blk && !drag.told && Math.hypot(p[0] - drag.px, p[1] - drag.py) > 8) { drag.told = true; Sala.toast(drag.blk); if (window.Sfx) Sfx.play('locked'); } return; }
        if (!drag.moved && Math.hypot(p[0] - drag.px, p[1] - drag.py) < 6) return;
        drag.moved = true; var s = drag.tok.s || 1;
        drag.x = Math.max(0, Math.min(mp.cols - s, m[0] - drag.ox)); drag.y = Math.max(0, Math.min(mp.rows - s, m[1] - drag.oy));
        dragRoute(mp); paint(); return;
      }
      if (wop) { wallMove(mp, m, ev, p); return; }
      if (zop) { zoneMove(mp, m); return; }
      if (fogDrag) { fogDrag.b = [Math.max(0, Math.min(mp.cols - 1, Math.floor(m[0]))), Math.max(0, Math.min(mp.rows - 1, Math.floor(m[1])))]; paint(); return; }
      if (edOn) { MapEd.move(mp, m[0], m[1], ev); return; }
      if (erasing) { eraseAt(m); return; }
      if (!drawing) return;
      if (drawing.k === 'pen') { var q = clampPt(m), n = drawing.pts.length, dx = q[0] - drawing.pts[n - 2], dy = q[1] - drawing.pts[n - 1]; if (dx * dx + dy * dy < 0.01 || n >= 1180) return; drawing.pts.push(q[0], q[1]); }
      else { var e = clampPt(snapPt(m, drawing.k)); drawing.pts[2] = e[0]; drawing.pts[3] = e[1]; }
      paint();
    });
    var end = function(ev){
      delete ptr[ev.pointerId]; clearTimeout(press && press.t);
      var mp = maps[cur];
      if (eop) { encUp(mp); return; }
      if (gesture) { var tap = gesture.tap, door = gesture.door, gz = gesture.zone; if (!Object.keys(ptr).length) gesture = null; if (tap && door) { doorClick(mp, door); return; } if (tap && gz) { zoneClick(mp, gz); return; } if (tap && selTok) { selTok = null; tokPanel(); paint(); } return; }
      if (wop) { wallUp(mp); return; }
      if (zop) { zoneUp(mp); return; }
      if (drag) {
        var d = drag; drag = null;
        if (d.moved) {
          var s = d.tok.s || 1, nx = d.x, ny = d.y; if (mp.grid !== 'none') { nx = Math.round(nx); ny = Math.round(ny); } nx = Math.max(0, Math.min(mp.cols - s, nx)); ny = Math.max(0, Math.min(mp.rows - s, ny));
          // antes de empezar el combate cada quien se acomoda (sin rodear paredes), dentro de su zona si la hay
          if (d.dep) { var dz = deployZ(mp, ownerOf(d.tok)); if (dz.length && !inDeploy(dz, nx, ny, s)) { Sala.toast('Acomódate dentro de la zona de despliegue.'); if (window.Sfx) Sfx.play('locked'); selTok = d.tok.id; tokPanel(); paint(); return; } tokMove(mp, d.tok, nx, ny, null); selTok = d.tok.id; tokPanel(); paint(); return; }
          var rt = mp.walls.length && window.Vision ? Vision.route(mp, d.tok, nx, ny) : {ok:true};
          if (!rt.ok && !master(mp)) { Sala.toast('Hay una pared en medio: por ahí no se llega.'); if (window.Sfx) Sfx.play('locked'); selTok = d.tok.id; tokPanel(); paint(); return; }
          tokMove(mp, d.tok, nx, ny, rt.cells); selTok = d.tok.id;
        }
        else selTok = selTok === d.tok.id ? null : d.tok.id;
        tokPanel(); paint(); return;
      }
      if (fogDrag) { var f = fogDrag; fogDrag = null; if (!mp.fog || !mp.fog.on) { fogDo(mp, {t:'fog.on', value:true}); } fogDo(mp, {t:'fog.rect', rect:[f.a[0], f.a[1], f.b[0], f.b[1]], value:tool.fogV ? 1 : 0}); paint(); return; }
      if (edOn) { edOn = false; var mm = toMap(local(ev)[0], local(ev)[1]); MapEd.up(mp, mm[0], mm[1], ev); toolbar(); return; }
      if (erasing) { var ids = Object.keys(erasing.hits), wids = Object.keys(erasing.walls || {}); erasing = null; rmStrokes(mp, ids); if (wids.length) wallsDel(mp, wids); paint(); return; }
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
    var mp = maps[cur], hid = hidden[mp.id] || {}, lk = locked[mp.id] || {}, tol = Math.max(0.35, 10 / V().s), changed = false;
    mp.strokes.forEach(function(k){ if (hid[k.l] || lk[k.l] || erasing.hits[k.id]) return; if (MapEd.hit(k, m[0], m[1], tol)) { erasing.hits[k.id] = 1; changed = true; } });
    if (canAdmin(mp) && window.Vision) mp.walls.forEach(function(w){ if (erasing.walls[w.id]) return; if (Vision.segDist(m[0], m[1], w.a, w.b) < tol) { erasing.walls[w.id] = 1; changed = true; } });
    if (changed) paint();
  }
  /* La ruta de la ficha que arrastras (solo cuando cambia de casilla) y, para el DM, lo que vería desde ahí */
  function dragRoute(mp){
    if (!window.Vision) return; var t = drag.tok, s = t.s || 1, rx = mp.grid !== 'none' ? Math.round(drag.x) : drag.x, ry = mp.grid !== 'none' ? Math.round(drag.y) : drag.y, ck = rx + ',' + ry;
    if (drag.ck === ck) return; drag.ck = ck;
    drag.route = mp.walls.length && !drag.dep ? Vision.route(mp, t, rx, ry) : null;
    drag.path = drag.route && drag.route.cells ? Vision.smooth(Vision.moveOf(mp), drag.route.cells, s) : null;
    drag.pv = master(mp) && !viewAs && mp.vis && mp.vis.on && Vision.isViewer(t, charOf(mp, t)) ? Vision.poly(Vision.sightOf(mp), rx + s / 2, ry + s / 2, mp.vis.range, mp.cols, mp.rows) : null;
  }
  /* ---------- Herramienta de paredes ----------
     Arrastrar traza una pared (o las cuatro de una habitación); las puntas se pegan a otras puntas y a la cuadrícula.
     Tocar una pared la elige; con una elegida, arrastrar una de sus puntas la mueve junto con las que comparten esa punta
     (con Alt o Mayús, solo esa). */
  function wallSnap(mp, m, skip){
    var tol = 14 / V().s, best = null, bd = tol;
    mp.walls.forEach(function(w){ if (skip && skip[w.id]) return; [w.a, w.b].forEach(function(p){ var d = Math.hypot(p[0] - m[0], p[1] - m[1]); if (d < bd) { bd = d; best = p; } }); });
    if (best) return [best[0], best[1]];
    var p = tool.snap && mp.grid !== 'none' ? [Math.round(m[0]), Math.round(m[1])] : m;
    return [Math.round(Math.max(0, Math.min(mp.cols, p[0])) * 100) / 100, Math.round(Math.max(0, Math.min(mp.rows, p[1])) * 100) / 100];
  }
  function wallAt(mp, m, tol){ var best = null, bd = tol; mp.walls.forEach(function(w){ var d = Vision.segDist(m[0], m[1], w.a, w.b); if (d < bd) { bd = d; best = w; } }); return best; }
  function wallDown(mp, m, ev){
    var touch = ev.pointerType === 'touch', tol = (touch ? 22 : 12) / V().s, sw = selWall && wallById(mp, selWall);
    if (sw) {
      var end = Math.hypot(m[0] - sw.a[0], m[1] - sw.a[1]) < tol ? 'a' : Math.hypot(m[0] - sw.b[0], m[1] - sw.b[1]) < tol ? 'b' : null;
      if (end) {
        var at = sw[end].slice(), same = function(p){ return p[0] === at[0] && p[1] === at[1]; };
        var linked = mp.walls.filter(function(w){ return w.id !== sw.id && (same(w.a) || same(w.b)); });
        wop = {k:'end', at:at, list:[sw].concat(linked).map(cloneW), prev:null, moved:false, m0:m}; return;
      }
    }
    wop = {k:'new', a:wallSnap(mp, m), b:null, hit:wallAt(mp, m, (touch ? 14 : 8) / V().s), moved:false, m0:m};
  }
  function wallMove(mp, m, ev, p){
    if (!wop.moved && Math.hypot(m[0] - wop.m0[0], m[1] - wop.m0[1]) * V().s < 6) return;
    wop.moved = true;
    if (wop.k === 'new') wop.b = wallSnap(mp, m);
    else {
      var skip = {}, only = ev.altKey || ev.shiftKey; wop.list.forEach(function(w){ skip[w.id] = 1; });
      var q = wallSnap(mp, m, skip), prev = {};
      wop.list.forEach(function(w, i){ if (only && i) return; var n = cloneW(w); ['a', 'b'].forEach(function(e){ if (n[e][0] === wop.at[0] && n[e][1] === wop.at[1]) n[e] = q.slice(); }); prev[w.id] = n; });
      wop.prev = prev;
    }
    paint();
  }
  function opening(mp, w, m, t){
    var dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], L = Math.hypot(dx, dy); if (!L) return;
    var ux = dx / L, uy = dy / L, s = Math.max(0, Math.min(L, (m[0] - w.a[0]) * ux + (m[1] - w.a[1]) * uy));
    var grid = tool.snap && mp.grid !== 'none' && (dx === 0 || dy === 0), s0 = grid ? Math.floor(s) : s - 0.5; s0 = Math.max(0, Math.min(L - 1, s0));
    var P = function(k){ return [Math.round((w.a[0] + ux * k) * 100) / 100, Math.round((w.a[1] + uy * k) * 100) / 100]; };
    var before = [cloneW(w)], after = [];
    if (L <= 1) after.push(Object.assign(cloneW(w), {t:t}));
    else {
      var p0 = P(s0), p1 = P(s0 + 1);
      if (s0 > 0.01) after.push({id:w.id, a:w.a.slice(), b:p0, t:'wall'});
      var dr = mkWall(p0, p1, t); if (s0 <= 0.01) dr.id = w.id; after.push(dr);
      if (s0 + 1 < L - 0.01) after.push(mkWall(p1, w.b, 'wall'));
    }
    var door = after.filter(function(x){ return x.t === t; })[0];
    var gone = before.filter(function(x){ return !after.some(function(y){ return y.id === x.id; }); }).map(function(x){ return x.id; });
    if (gone.length) wrm(mp, gone); wput(mp, after); MapEd.record(mp, {wset:{b:before, a:after.map(cloneW)}});
    selWall = door ? door.id : null; if (window.Sfx) Sfx.play('click'); toolbar(); paint();
  }
  function mkWall(a, b, t){ var w = {id:newWid(), a:a.slice(), b:b.slice(), t:t}; if (t === 'oneway') w.side = 1; return w; }
  function wallUp(mp){
    var o = wop; wop = null;
    if (o.k === 'new') {
      if (!o.moved || !o.b) {
        // con Puerta, Puerta secreta o Ventana, tocar una pared le abre un hueco de una casilla
        if (o.hit && o.hit.t === 'wall' && /^(door|secret|window)$/.test(tool.wt)) { opening(mp, o.hit, o.m0, tool.wt); return; }
        selWall = o.hit ? o.hit.id : null; toolbar(); paint(); return;
      }
      if (o.a[0] === o.b[0] && o.a[1] === o.b[1]) { paint(); return; }
      var t = tool.wt, list = [];
      if (tool.wroom) {
        if (o.a[0] === o.b[0] || o.a[1] === o.b[1]) { paint(); return; }
        var rt = isDoorT({t:t}) ? 'wall' : t, x0 = o.a[0], y0 = o.a[1], x1 = o.b[0], y1 = o.b[1];
        [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]].forEach(function(q){ list.push(mkWall([q[0], q[1]], [q[2], q[3]], rt)); });
      } else list.push(mkWall(o.a, o.b, t));
      wallsAdd(mp, list); selWall = list.length === 1 ? list[0].id : null; if (window.Sfx) Sfx.play('click'); toolbar(); paint(); return;
    }
    if (!o.moved || !o.prev) { paint(); return; }
    var before = o.list.filter(function(w){ return o.prev[w.id]; }), after = before.map(function(w){ return o.prev[w.id]; });
    wallsUpd(mp, before, after); paint();
  }
  /* Objetos: se ponen centrados donde tocas (ajustados a la cuadrícula) y quedan elegidos para girarlos o escalarlos */
  function placeAsset(mp, m){
    var key = tool.asset, inf = window.Assets && Assets.info(key); if (!inf) { pop = 'assets'; toolbar(); return; }
    var w = inf.w, h = inf.h, cx = m[0], cy = m[1];
    if (tool.snap && mp.grid !== 'none') { cx = Math.round(cx - w / 2) + w / 2; cy = Math.round(cy - h / 2) + h / 2; }
    cx = Math.max(0, Math.min(mp.cols, cx)); cy = Math.max(0, Math.min(mp.rows, cy));
    var base = {l:tool.layer, pts:[Math.round(cx * 100) / 100, Math.round(cy * 100) / 100], s:w, h:h, id:MapEd.newId()};
    var put1 = function(k){ addStroke(mp, k); MapEd.select(mp, [k.id]); if (window.Sfx) Sfx.play('click'); };
    if (inf.user) { busyUp = true; Assets.forMap(key.slice(2), shared(mp.id)).then(function(img){ put1(Object.assign({k:'img', img:img}, base)); }).catch(function(e){ Sala.toast(e.message || 'No se pudo poner la imagen.'); }).then(function(){ busyUp = false; }); }
    else put1(Object.assign({k:'asset', a:key}, base));
  }
  function askText(pt, px){
    var box = $('#mapTxt'); if (!box) return; pendingText = pt;
    if (pt && pt.id) { var v = V(); px = [v.x + pt.pts[0] * v.s, v.y + pt.pts[1] * v.s]; }
    box.style.left = Math.max(4, Math.min((canvas.clientWidth || 300) - 250, px[0] - 120)) + 'px'; box.style.top = Math.max(4, px[1] - 52) + 'px';
    box.innerHTML = '<form data-form="maptext" class="map-txtf"><input class="field" name="t" maxlength="60" placeholder="Torre, puerta secreta…" aria-label="Texto para el mapa" autocomplete="off"><button class="btn main sm" type="submit">Poner</button><button class="btn sm" type="button" data-act="maptextno">×</button></form>';
    box.hidden = false; var i = box.querySelector('input'); if (i) { if (pt && pt.id) i.value = pt.t || ''; i.focus(); }
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
      cur = id; layersOpen = false; pop = null; selTok = null; mode = 'jugar'; encEd = encPend && encPend.map === id ? encPend.ed : null; encPend = null; var box = document.getElementById('mesaMaps'); if (box && visible()) editor(box); else if (box) { box.innerHTML = ''; }
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
    else if (a === 'mapback') { cur = null; canvas = null; dropGL(); selTok = null; encEd = null; eop = null; render.sceneOpened = room() && room().scene; render(); badge(); }
    else if (a === 'mapscene') { Sala.send({t:'scene.set', id:b.dataset.id}); Sala.toast('Todos ven este mapa ahora.'); }
    else if (a === 'mapshare') load(b.dataset.id).then(function(m){
      if (!m || !room()) return;
      var copy = JSON.parse(JSON.stringify(m)); delete copy.by; delete copy.room; copy.tokens = (copy.tokens || []).filter(function(t){ return t.kind !== 'pc'; });
      // tus imágenes importadas (u:…) viven en este aparato: se suben antes de compartir el mapa
      var send = function(){ Sala.send({t:'map.save', map:copy}); Sala.toast('«' + m.name + '» ya está en la campaña.'); };
      var go = function(){
        var local = copy.strokes.filter(function(k){ return k.k === 'img' && String(k.img).indexOf('u:') === 0; });
        if (!local.length || !window.Assets) return send();
        Promise.all(local.map(function(k){ return Assets.forMap(k.img.slice(2), true).then(function(id){ k.img = id; }).catch(function(){ k.drop = 1; }); }))
          .then(function(){ copy.strokes = copy.strokes.filter(function(k){ return !k.drop; }); send(); });
      };
      if (copy.bg && copy.bg.data) { var bgd = copy.bg.data; delete copy.bg; Mesa.upload(dataToBlob(bgd), 2400).then(function(id){ copy.bg = {img:id, op:m.bg.op || 1}; go(); }).catch(function(){ go(); }); } else go();
    });
    else if (a === 'mappng') load(b.dataset.id).then(function(m){ if (m) png(m); });
    else if (a === 'mapdel') {
      if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = '¿Seguro? Toca otra vez'; return; }
      if (b.dataset.room) Sala.send({t:'map.del', id:b.dataset.id});
      else { delete maps[b.dataset.id]; idbDel('map:' + b.dataset.id); setIndex(index().filter(function(x){ return x.id !== b.dataset.id; })); render(); }
    }
    else if (a === 'mapjoin') { if (Sala.send({t:'enc.join', map:b.dataset.v})) Sala.toast('Te unes al combate…'); }
    else if (!mp) return;
    // las herramientas se abren encima del juego; «Listo» (✓) las guarda
    else if (a === 'mapmode') { MapEd.clear(mp); selWall = null; wop = null; mode = b.dataset.v; if (mode === 'dibujar' && (tool.k === 'pan' || !tool.k)) tool.k = 'pen'; pop = null; toolbar(); paint(); }
    else if (a === 'mapstate') {
      var sv = b.dataset.v, cs = stateOf(mp); if (sv === cs) return;
      if (cs === 'combat' && started(mp) && !b.dataset.sure) { b.dataset.sure = 1; Sala.toast('Eso termina el combate de este mapa. Toca otra vez para confirmar.'); setTimeout(function(){ if (b) delete b.dataset.sure; }, 4500); return; }
      if (Sala.send({t:'map.state', id:mp.id, state:sv})) { pop = null; if (window.Sfx) Sfx.play(sv === 'combat' ? 'turn' : 'click'); }
    }
    else if (a === 'mapfreeze') Sala.send({t:'map.play', id:mp.id, frozen:!mp.frozen});
    else if (a === 'mapturnonly') Sala.send({t:'map.play', id:mp.id, turnOnly:mp.turnOnly === false});
    else if (a === 'mapnpcinit') Sala.send({t:'init.npcs', map:mp.id, group:true});
    else if (a === 'mapwave') Sala.send({t:'enc.wave', map:mp.id, n:+b.dataset.v});
    else if (a === 'mapencs') { pop = pop === 'encs' ? null : 'encs'; toolbar(); }
    else if (a === 'mapencdone') { encDone(); Sala.toast('El encuentro quedó guardado.'); }
    else if (a.indexOf('mapenc') === 0) {
      var ee = encData(); if (!ee || !encEd) return;
      if (a === 'mapenck') { encEd.k = b.dataset.v; encEd.sel = null; encEd.zsel = null; toolbar(); paint(); }
      else if (a === 'mapencw') { encEd.wave = +b.dataset.v; toolbar(); paint(); }
      else if (a === 'mapencpick') { encEd.pick = encEd.pick === b.dataset.v ? null : b.dataset.v; toolbar(); }
      else if (a === 'mapencall') { var used = {}; ee.npcs.forEach(function(d){ if (d.x != null) used[Math.round(d.x) + ',' + Math.round(d.y)] = 1; }); var cc = [Math.floor(mp.cols / 2), Math.floor(mp.rows / 2)];
        ee.npcs.forEach(function(d){ if (d.x != null) return; for (var rg = 0, done = false; rg < 20 && !done; rg++) for (var dy = -rg; dy <= rg && !done; dy++) for (var dx = -rg; dx <= rg && !done; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== rg) continue; var x = cc[0] + dx, y = cc[1] + dy, sz = d.s || 1; if (x < 0 || y < 0 || x > mp.cols - sz || y > mp.rows - sz || used[x + ',' + y]) continue; used[x + ',' + y] = 1; d.x = x; d.y = y; done = true; } });
        encEd.pick = null; encSave(ee); }
      else if (a === 'mapencun') { var sd = ee.npcs.filter(function(d){ return d.k === encEd.sel; })[0]; if (sd) { delete sd.x; delete sd.y; encSave(ee); } }
      else if (a === 'mapenczdel') { ee.deploy = ee.deploy.filter(function(z){ return z.id !== encEd.zsel; }); encEd.zsel = null; encSave(ee); }
    }
    else if (a === 'mapset') { pop = pop === 'set' ? null : 'set'; toolbar(); }
    else if (a === 'mapadd') { pop = pop === 'add' ? null : 'add'; toolbar(); }
    else if (a === 'mappen') { if (tool.k !== 'pen') { tool.k = 'pen'; pop = 'pen'; } else pop = pop === 'pen' ? null : 'pen'; toolbar(); }
    else if (a === 'mappopx') { pop = null; toolbar(); }
    else if (a === 'maplayeredit') { layersOpen = !layersOpen; toolbar(); }
    else if (a === 'mapplaceall') placeAll(mp);
    else if (a === 'mapsheet') { if (window.Mesa) Mesa.show('combate'); if (window.Diario) Diario.renderCombat(); }
    else if (a === 'mapchip') { var tc = mp.tokens.filter(function(t){ return t.ref === b.dataset.id && !t.comp; })[0], vsc = !(master(mp) && !viewAs) && visOf(mp); if (tc && vsc && !tokShown(mp, tc, vsc, false)) { Sala.toast('Ahora nadie del grupo lo ve.'); return; } if (tc) { focus(mp, tc); selTok = tc.id; paint(); tokPanel(); } else Sala.toast(isDm() ? 'No tiene ficha en este mapa: usa «Poner en el mapa».' : 'No está en este mapa.'); }
    else if (a === 'mapputme') {
      var s = Sala.summary ? Sala.summary() : null, t = myTok(mp), c = center(mp);
      if (t && shared(mp.id) && deploying(mp)) { Sala.send({t:'tok.add', id:mp.id, tok:{kind:'pc', name:t.name, x:c[0], y:c[1]}}); selTok = t.id; tokPanel(); } // el servidor la acomoda en tu zona
      else if (t) { tokMove(mp, t, c[0], c[1]); selTok = t.id; tokPanel(); }
      else tokAdd(mp, {kind:'pc', name: s ? s.name : 'Yo', x:c[0], y:c[1], s:1, color:TOKCOL[1], mine:!shared(mp.id)});
    }
    else if (a === 'mapfindme') { var me2 = myTok(mp); if (me2) { focus(mp, me2); selTok = me2.id; paint(); tokPanel(); } }
    else if (a === 'maptool') { tool.k = b.dataset.v; selWall = null; if (pop === 'pen' || pop === 'walls') pop = null; toolbar(); paint(); }
    else if (a === 'mapwalls') { MapEd.clear(mp); if (tool.k !== 'wall') { tool.k = 'wall'; pop = 'walls'; } else pop = pop === 'walls' ? null : 'walls'; toolbar(); paint(); }
    else if (a === 'mapwallt') { tool.wt = b.dataset.v; tool.k = 'wall'; pop = null; toolbar(); paint(); Sala.toast('Arrastra sobre el mapa para trazar: ' + wallT(tool.wt)[1].toLowerCase() + '.'); }
    else if (a === 'mapwallroom') { tool.wroom = b.dataset.v === '1'; toolbar(); }
    else if (a === 'mapviewas') { viewAs = false; toolbar(); paint(); }
    else if (a === 'mapsctab') { tool.sc = b.dataset.v; toolbar(); }
    else if (a === 'mapzones') { MapEd.clear(mp); selWall = null; if (tool.k !== 'zone') { tool.k = 'zone'; Sala.toast('Arrastra sobre el mapa para marcar una zona; toca una para cambiarla.'); } else if (pop === 'zone') pop = null; toolbar(); paint(); }
    else if (a === 'mapzk') { tool.zk = b.dataset.v; var zk = selZone && zoneById(mp, selZone); if (zk) { var nz = JSON.parse(JSON.stringify(zk)); nz.k = b.dataset.v; if (nz.k !== 'paso') { delete nz.to; delete nz.lock; delete nz.hidden; if (nz.once == null) nz.once = nz.k !== 'texto'; } zput(mp, nz); } }
    else if (a === 'mapzdel') { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = '¿Quitarla?'; return; } if (selZone) zrm(mp, selZone); }
    else if (a === 'mapzrearm') { var zr = selZone && zoneById(mp, selZone); if (zr) { var nr = JSON.parse(JSON.stringify(zr)); delete nr.fired; zput(mp, nr); } }
    else if (a === 'mapzback') {
      var zb = selZone && zoneById(mp, selZone); if (!zb || !zb.to) return;
      load(zb.to.map).then(function(dest){
        if (!dest) { Sala.toast('Abre ese mapa una vez para poder enlazarlo.'); return; }
        var back = {id:newZid(), k:'paso', x:Math.max(0, Math.floor(dest.cols / 2) - 1), y:Math.max(0, Math.floor(dest.rows / 2) - 1), w:Math.min(2, dest.cols), h:Math.min(2, dest.rows), name:'Vuelta a ' + mp.name, to:{map:mp.id, zid:zb.id}};
        if (!dest.trig) dest.trig = []; zput(dest, back);
        var nb = JSON.parse(JSON.stringify(zb)); nb.to.zid = back.id; zput(mp, nb);
        Sala.toast('Listo: en «' + dest.name + '» hay un paso de vuelta en el centro; muévelo a su lugar.');
      });
    }
    else if (a === 'mapaskno') { ask = null; askPaint(); }
    else if (a === 'mapaskgo') { var o = ask; ask = null; askPaint(); if (o && o.k === 'paso') travel(o.map, o.zid, !!o.dm); }
    else if (a === 'mapaskopen') { var o2 = ask; ask = null; askPaint(); var zz = o2 && maps[o2.map] && zoneById(maps[o2.map], o2.zid); if (zz && zz.to) openMap(zz.to.map); }
    else if (a === 'maptravelp') { pop = pop === 'travel' ? null : 'travel'; toolbar(); }
    else if (a === 'maptravel') { var tm = {map:b.dataset.map}; if (b.dataset.zid) tm.zid = b.dataset.zid; Sala.send({t:'travel', id:mp.id, all:true, to:tm}); pop = null; toolbar(); }
    else if (a === 'mapsplit') Sala.send({t:'fight.split', value:b.dataset.v === '1'});
    else if (a === 'mapfight') { if (b.dataset.v && b.dataset.v !== cur) openMap(b.dataset.v); else Sala.send({t:'fight.focus', map:b.dataset.v}); }
    else if (a === 'maptime') lightDo(mp, {time:b.dataset.v});
    else if (a === 'mapwx') lightDo(mp, {wx:b.dataset.v});
    else if (a === 'mapwxsnd') { Sala.send({t:'amb.set', amb:{k:b.dataset.v, v:0.8}}); Sala.toast('Suena: ' + b.textContent.trim().toLowerCase() + '.'); }
    else if (a.indexOf('mapwall') === 0) {
      var w = selWall && wallById(mp, selWall); if (!w) return;
      if (a === 'mapwallx') { selWall = null; toolbar(); paint(); }
      else if (a === 'mapwalldel') wallsDel(mp, [w.id]);
      else if (a === 'mapwallopen') doorToggle(mp, w);
      else { var n = cloneW(w); if (a === 'mapwalllock') { if (n.lock) delete n.lock; else n.lock = true; } else if (a === 'mapwallfound') { if (n.found) delete n.found; else n.found = true; } else if (a === 'mapwallflip') n.side = n.side < 0 ? 1 : -1; wallsUpd(mp, [w], [n]); }
    }
    else if (a === 'mapcolor') { tool.c = b.dataset.v; if (tool.k === 'pan' || tool.k === 'erase') tool.k = 'pen'; toolbar(); }
    else if (a === 'mapw') { tool.w = +b.dataset.v; toolbar(); }
    else if (a === 'maplayer') { tool.layer = b.dataset.v; var hd = hidden[mp.id] = hidden[mp.id] || {}; delete hd[tool.layer]; toolbar(); paint(); }
    else if (a === 'mapeye') { var hh = hidden[mp.id] = hidden[mp.id] || {}; hh[b.dataset.v] = !hh[b.dataset.v]; toolbar(); paint(); }
    else if (a === 'maplayers') { pop = pop === 'layers' ? null : 'layers'; toolbar(); }
    else if (a === 'mapladd') { var n = 1; while (mp.layers.some(function(l){ return l.id === 'l' + n; })) n++; setMeta(mp, {layers:mp.layers.concat([{id:'l' + n, name:'Capa ' + n}])}); tool.layer = 'l' + n; }
    else if (a === 'mapldel') { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = '¿Borrar con lo que tiene?'; return; } setMeta(mp, {layers:mp.layers.filter(function(l){ return l.id !== b.dataset.v; })}); }
    else if (a === 'maplup') { var L = mp.layers.slice(), i = L.findIndex(function(l){ return l.id === b.dataset.v; }); if (i > 0) { var tt = L[i - 1]; L[i - 1] = L[i]; L[i] = tt; setMeta(mp, {layers:L}); } }
    else if (a === 'mapundo') undo(mp);
    else if (a === 'mapredo') { if (!MapEd.redo(mp)) Sala.toast('No hay nada que rehacer.'); }
    else if (a === 'maplock') { var lk = locked[mp.id] = locked[mp.id] || {}; lk[b.dataset.v] = !lk[b.dataset.v]; MapEd.clear(mp); toolbar(); paint(); }
    else if (a === 'mapassets') { pop = pop === 'assets' ? null : 'assets'; toolbar(); }
    else if (a === 'mapascat') { Assets.pick.cat = b.dataset.v; Assets.pick.q = ''; toolbar(); }
    else if (a === 'mapaspick') { tool.k = 'asset'; tool.asset = b.dataset.v; pop = null; MapEd.clear(mp); toolbar(); Sala.toast('Toca el mapa para poner: ' + ((Assets.info(b.dataset.v) || {}).name || 'el objeto') + '.'); }
    else if (a === 'mapasdel') { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = '¿?'; return; } Assets.removeUser(b.dataset.v).then(function(){ toolbar(); }); }
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
    if (t && m && pendingText && pendingText.id) { var old = m.strokes.filter(function(k){ return k.id === pendingText.id; })[0]; if (old && old.t !== t) { var n = JSON.parse(JSON.stringify(old)); n.t = t; n.v = (old.v || 0) + 1; updMany(m, [n]); MapEd.record(m, {upd:{b:[old], a:[n]}}); } }
    else if (t && m && pendingText) addStroke(m, {k:'text', l:tool.layer, c:tool.c, w:tool.w, pts:pendingText, t:t});
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
    else if (t.id === 'mapVisOn') { visDo(mp, {on:t.checked}); if (t.checked && !mp.walls.length) Sala.toast('Pon paredes en Dibujar → Paredes para que tapen la vista.'); }
    else if (t.id === 'mapVisRange') visDo(mp, {range:+t.value || 0});
    else if (t.id === 'mapVisLines') visDo(mp, {lines:t.value});
    else if (t.id === 'mapViewAs') { viewAs = t.checked; selTok = null; toolbar(); tokPanel(); paint(); }
    else if (t.id === 'mapWallType') { var w0 = selWall && wallById(mp, selWall); if (w0 && t.value !== w0.t) { var nw = {id:w0.id, a:w0.a.slice(), b:w0.b.slice(), t:t.value}; if (t.value === 'oneway') nw.side = 1; if (isDoorT(nw) && isDoorT(w0)) { if (w0.open) nw.open = true; if (w0.lock) nw.lock = true; } wallsUpd(mp, [w0], [nw]); } }
    else if (t.id === 'mapHide') Sala.send({t:'map.hide', id:mp.id, value:t.checked});
    else if (t.id === 'mapBgFile' && t.files && t.files[0]) { setBg(mp, t.files[0]); t.value = ''; }
    else if (t.id === 'mapBgOp' && mp.bg) { if (shared(mp.id)) Sala.send({t:'map.bg', id:mp.id, op:+t.value}); else { mp.bg.op = +t.value; keep(mp); paint(); } }
    else if (t.id === 'mapTokImg' && t.files && t.files[0]) { var tk = mp.tokens.filter(function(x){ return x.id === selTok; })[0]; if (!tk) return; busyUp = true; tokPanel(); Mesa.upload(t.files[0], 400).then(function(id){ tokSet(mp, tk, {img:id}); }).catch(function(e){ Sala.toast(e.message || 'No se pudo subir.'); }).then(function(){ busyUp = false; tokPanel(); }); }
    else if (t.dataset && t.dataset.toklt) { var tk3 = mp.tokens.filter(function(x){ return x.id === selTok; })[0]; if (tk3 && t.value !== 'otra') tokSet(mp, tk3, {lt:t.value ? Vision.preset(t.value) : null}); }
    else if (t.dataset && t.dataset.toksn) { var tk4 = mp.tokens.filter(function(x){ return x.id === selTok; })[0]; if (tk4) { var sn = Object.assign({}, tk4.sn || {}); if (t.value === '') delete sn[t.dataset.toksn]; else sn[t.dataset.toksn] = +t.value; tokSet(mp, tk4, {sn:Object.keys(sn).length ? sn : null}); } }
    else if (t.id === 'mapAmb') lightDo(mp, {amb:t.value});
    else if (t.dataset && t.dataset.toktravel && t.value) { var tk5 = mp.tokens.filter(function(x){ return x.id === selTok; })[0]; if (tk5) { Sala.send({t:'travel', id:mp.id, tid:tk5.id, to:{map:t.value}}); selTok = null; tokPanel(); } }
    else if (t.dataset && t.dataset.encnpc) { var ee2 = encData(), sd2 = ee2 && encEd && ee2.npcs.filter(function(d){ return d.k === encEd.sel; })[0]; if (sd2) { if (t.dataset.encnpc === 'wave') sd2.wave = +t.value || 1; else sd2.hidden = t.checked; encSave(ee2); } }
    else if (t.id === 'mapEncZName' || t.id === 'mapEncZFor') { var ee3 = encData(), z3 = ee3 && encEd && ee3.deploy.filter(function(z){ return z.id === encEd.zsel; })[0]; if (z3) { if (t.id === 'mapEncZName') z3.name = t.value.trim().slice(0, 50); else if (t.value) z3.for = t.value; else delete z3.for; encSave(ee3); } }
    else if (/^mapZ/.test(t.id)) {
      var z0 = selZone && zoneById(mp, selZone); if (!z0) return; var nz = JSON.parse(JSON.stringify(z0));
      if (t.id === 'mapZName') nz.name = t.value.trim().slice(0, 50);
      else if (t.id === 'mapZMap') { if (t.value) { nz.to = {map:t.value}; load(t.value).then(function(){ toolbar(); }); } else delete nz.to; }
      else if (t.id === 'mapZTo') { if (nz.to) { if (t.value) nz.to.zid = t.value; else delete nz.to.zid; } }
      else if (t.id === 'mapZText') nz.text = t.value.slice(0, 600);
      else { var key = {mapZLock:'lock', mapZHide:'hidden', mapZSay:'say', mapZAll:'all', mapZOnce:'once'}[t.id]; if (key) { if (t.checked) nz[key] = true; else delete nz[key]; } }
      zput(mp, nz);
    }
    else if (t.dataset && t.dataset.tokset) { var tk2 = mp.tokens.filter(function(x){ return x.id === selTok; })[0]; if (tk2) tokSet(mp, tk2, {s:+t.value}); }
    else if (t.dataset && t.dataset.maplname && t.value.trim()) setMeta(mp, {layers:mp.layers.map(function(l){ return l.id === t.dataset.maplname ? Object.assign({}, l, {name:t.value.trim()}) : l; })});
    else if (t.dataset && t.dataset.maplsecret) setMeta(mp, {layers:mp.layers.map(function(l){ if (l.id !== t.dataset.maplsecret) return l; var o = {id:l.id, name:l.name}; if (t.checked) o.dm = true; return o; })});
  });
  document.addEventListener('input', function(ev){ if (ev.target && ev.target.id === 'asQ' && window.Assets) { Assets.pick.q = ev.target.value; var g = $('#asGrid'); if (g) { var tmp = document.createElement('div'); tmp.innerHTML = Assets.pickerHtml(tool.k === 'asset' ? tool.asset : null); var ng = tmp.querySelector('#asGrid'); if (ng) g.innerHTML = ng.innerHTML; } } });
  document.addEventListener('change', function(ev){ var t = ev.target; if (t && t.id === 'asImport' && t.files && t.files.length && window.Assets) { var fl = Array.prototype.slice.call(t.files), n0 = fl.length; Assets.importFiles(fl).then(function(){ Assets.pick.cat = 'propios'; toolbar(); Sala.toast(n0 + ' imagen' + (n0 === 1 ? '' : 'es') + ' en tus objetos.'); }); t.value = ''; } });
  if (window.Assets) Assets.onReady(function(){ if (cur) paint(); });
  /* Esc dentro del mapa cierra primero lo que está abierto encima (texto, panel), no el mapa */
  document.addEventListener('keydown', function(ev){
    if (ev.key !== 'Escape' || !cur || !visible()) return;
    var tb = $('#mapTxt'); if (tb && !tb.hidden) { tb.hidden = true; pendingText = null; ev.stopPropagation(); ev.preventDefault(); return; }
    if (pop) { pop = null; toolbar(); ev.stopPropagation(); ev.preventDefault(); return; }
    if (wop) { wop = null; paint(); ev.stopPropagation(); ev.preventDefault(); return; }
    if (selWall) { selWall = null; toolbar(); paint(); ev.stopPropagation(); ev.preventDefault(); }
  }, true);
  /* Supr borra la pared elegida */
  document.addEventListener('keydown', function(ev){
    if ((ev.key !== 'Delete' && ev.key !== 'Backspace') || !cur || !visible() || mode !== 'dibujar' || tool.k !== 'wall' || !selWall) return;
    var t = ev.target; if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
    var mp = maps[cur]; if (mp && wallById(mp, selWall)) { wallsDel(mp, [selWall]); ev.preventDefault(); }
  });
  /* El editor (editor.js) trabaja sobre el mapa abierto con estas piezas */
  function initEd(){
    if (!window.MapEd || initEd.done) return; initEd.done = true;
    MapEd.init({map:function(){ return cur && maps[cur]; }, V:V, paint:paint, toolbar:function(){ if (cur) toolbar(); }, shared:function(m){ return shared(m.id); }, isDm:isDm, me:me,
      hidden:function(m){ return hidden[m.id] || {}; }, locked:function(m){ return locked[m.id] || {}; }, snap:function(){ return tool.snap && maps[cur] && maps[cur].grid !== 'none'; }, layer:function(){ return tool.layer; },
      add:addMany, rm:rmIds, upd:updMany, wput:wput, wrm:wrm, askText:function(k){ askText(k); }, esc:esc, attr:attr, colors:function(){ return COLORS; }, active:function(){ return !!cur && !!canvas && visible() && mode === 'dibujar'; }});
  }
  setTimeout(initEd, 0);
  window.addEventListener('resize', function(){ if (cur && canvas && visible()) { fit(); paint(); } });

  return {refreshPop:function(){ if (cur) toolbar(); }, render:render, editEnc:editEnc, encDone:encDone, closePop:function(){ if (pop) { pop = null; if (cur) toolbar(); } }, _enc:function(){ return encEd; }, cur:function(){ return cur; }, png:png, open:openMap, _maps:function(){ return maps; }, _open:openMap, _tool:tool, _mode:function(v){ if (v) { mode = v; toolbar(); } return mode; }, _sel:function(){ return selTok; },
    _view:function(){ return V(); }, _cur:function(){ return cur; }, _wall:function(){ return selWall; }, _shown:function(tid){ var mp = maps[cur], t = mp && mp.tokens.filter(function(x){ return x.id === tid; })[0]; if (!t) return null; var dv = master(mp) && !viewAs; return tokShown(mp, t, visOf(mp), dv); }, _vis:function(id){ var mp = maps[id || cur]; return mp ? visOf(mp) : null; }, _viewAs:function(v){ if (v != null) { viewAs = !!v; if (cur) { toolbar(); paint(); } } return viewAs; }};
})();
