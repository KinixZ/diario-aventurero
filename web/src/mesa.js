
/* ==================== CAMPAÑA: CHAT, PIZARRA, TABLERO Y PESTAÑAS ==================== */
/* Pestañas de la vista de campaña. Usa la conexión de la Sala (Sala.on / Sala.send). El servidor guarda todo;
   cada teléfono conserva una copia de la campaña abierta para verla aunque se corte la señal.
   Al terminar cada sesión, cada quien guarda el resumen en sus Notas y en un archivo. */
var Mesa = (function(){
  var esc = function(s){ return Render5e.esc(s == null ? '' : s); }, attr = function(s){ return Render5e.attr(s == null ? '' : s); };
  var $ = function(s, r){ return (r || document).querySelector(s); }, $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var KEY = 'diario-mesa', IDX = 'diario-sesiones';
  var PAPER = '#f3e9d2', COLORS = ['#2b1d12', '#8c2626', '#2f5d8a', '#3f6b3a', '#b08a3e', '#6a3fa0', '#e07a2e', '#ffffff'];
  var CATS = [['mision','Misión'],['pnj','PNJ'],['lugar','Lugar'],['pista','Pista'],['objeto','Objeto'],['otro','Otro']];
  var ROLLS = ['Ataque', 'Daño', 'Iniciativa', 'Percepción', 'Perspicacia', 'Investigación', 'Sigilo', 'Atletismo', 'Acrobacias', 'Arcanos', 'Historia', 'Religión', 'Naturaleza', 'Supervivencia', 'Medicina', 'Engaño', 'Persuasión', 'Intimidación', 'Interpretación', 'Juego de manos', 'Trato con animales', 'Salvación de Fuerza', 'Salvación de Destreza', 'Salvación de Constitución', 'Salvación de Inteligencia', 'Salvación de Sabiduría', 'Salvación de Carisma', 'Concentración', 'Salvación contra muerte'];
  var C = load(), tab = 'inicio', unread = 0, rollOpen = false, tool = {color: COLORS[0], w: 4, erase: false}, boardEdit = null, boardOpen = false, endedSnap = null, uploading = false;

  function load(){ try { return JSON.parse(localStorage.getItem(KEY) || 'null') || blank(); } catch(e){ return blank(); } }
  function blank(code){ return {code: code || null, title: '', started: Date.now(), chat: [], board: [], strokes: [], pages: [], members: []}; }
  var saveT = null;
  function persist(){ clearTimeout(saveT); saveT = setTimeout(function(){ try { localStorage.setItem(KEY, JSON.stringify(C)); } catch(e){ try { C.pages = C.pages.slice(-3); C.chat = C.chat.slice(-300); localStorage.setItem(KEY, JSON.stringify(C)); } catch(e2){} } }, 400); }
  function room(){ return window.Sala ? Sala.room() : null; }
  function online(){ return window.Sala && Sala.status() === 'on' && !!room(); }
  function isDm(){ var r = room(); return !!r && r.role === 'dm'; }
  function myId(){ var r = room(); return r ? r.you : null; }
  function nameOf(id){ var r = room(); if (r) { var m = r.members.filter(function(x){ return x.id === id; })[0]; if (m) return m.role === 'dm' ? 'DM' : m.char ? m.char.name : m.name; } var k = (C.members || []).filter(function(x){ return x.id === id; })[0]; return k ? k.name : '¿?'; }
  function hhmm(t){ var d = new Date(t || Date.now()); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }

  /* ---------- Mensajes de la Sala ---------- */
  Sala.on('joined', function(m){ if (C.code !== m.code) { C = blank(m.code); endedSnap = null; unread = 0; } persist(); });
  Sala.on('live', function(){ endedSnap = null; if (tab === 'chat' && visibleNow()) renderChat(false); });
  Sala.on('mesa.init', function(m){ C.chat = m.chat || []; C.strokes = m.strokes || []; persist(); drawAll(); render(); });
  Sala.on('state', function(r){ C.board = r.board || []; C.title = r.session ? r.session.title : C.title; if (r.session) C.started = r.session.started; C.members = r.members.map(function(x){ return {id:x.id, name: x.role === 'dm' ? 'DM' : x.char ? x.char.name : x.name, role:x.role}; }); C.live = r.live; C.ses = r.session ? r.session.n : 0; C.name = r.name; persist(); if (tab === 'tablero' || (tab === 'chat' && !document.querySelector('#mesaChat .chat-list'))) render(); else if (tab === 'chat') chatHead(); badge(); });
  Sala.on('chat', function(m){ C.chat.push(m.msg); if (C.chat.length > 800) C.chat.shift(); persist(); if (tab === 'chat' && visibleNow()) renderChat(true); else { unread++; badge(); } });
  Sala.on('draw', function(m){ C.strokes.push(m.stroke); persist(); strokeOn(ctx(), m.stroke); });
  Sala.on('draw.undo', function(m){ C.strokes = C.strokes.filter(function(k){ return k.id !== m.id; }); persist(); drawAll(); });
  Sala.on('draw.clear', function(){ if (C.strokes.length) C.pages.push({at: Date.now(), strokes: C.strokes}); C.strokes = []; persist(); drawAll(); render(); });
  Sala.on('ended', function(m){ endedSnap = m.snapshot; finishSession(m.snapshot); });
  Sala.on('left', function(){ C = blank(); persist(); render(); });
  function visibleNow(){ var c = document.getElementById('combat'); return c && !c.hidden; }


  /* ---------- Pestañas ---------- */
  function show(t){
    tab = t || tab; var cb = document.getElementById('combat'); if (!cb) return; cb.setAttribute('data-tab', tab);
    $$('#mesaTabs button').forEach(function(b){ var on = b.dataset.v === tab; b.setAttribute('aria-selected', String(on)); if (on && b.scrollIntoView && b.parentNode.scrollWidth > b.parentNode.clientWidth) try { b.scrollIntoView({block:'nearest', inline:'nearest'}); } catch(e){} });
    if (tab === 'chat') { unread = 0; } badge(); render();
    var sc = document.querySelector('#combat [data-tab-body="' + tab + '"]'); if (sc) sc.scrollTop = 0;
  }
  function badge(){ var b = $('#mesaTabs [data-v="chat"] .badge'); if (b) { b.textContent = unread > 99 ? '99+' : unread; b.hidden = !unread; } }
  function render(){
    if (tab === 'inicio' && window.Campana) Campana.render();
    else if (tab === 'bestiario' && window.Grupo) Grupo.render();
    else if (tab === 'chat') renderChat(false);
    else if (tab === 'pizarra') renderDraw();
    else if (tab === 'tablero') renderBoard();
    else if (tab === 'mapas' && window.Mapas) Mapas.render();
  }
  function lobby(where){ var e = Sala.active(), conn = e && Sala.status() === 'connecting'; return '<div class="mesa-lobby card">' + (endedSnap ? endedBanner() : '') + '<p class="note">' + (where || 'Esto vive dentro de una campaña.') + '</p>' + (conn ? '<p class="note"><b>Entrando a ' + esc(e.name || e.code) + '…</b> ' + esc(Sala.error() || '') + '</p>' : '<button class="btn main" type="button" data-act="mesatab" data-v="inicio">Elegir campaña</button>') + '</div>'; }
  function mountLobby(){}

  /* ---------- Chat ---------- */
  function msgHtml(m){
    var mine = m.from === myId(), wh = m.to ? (m.from === myId() ? 'susurro para ' + nameOf(m.to) : 'susurro de ' + m.name) : '';
    var h = '<div class="msg' + (mine ? ' mine' : '') + (m.role === 'dm' ? ' dm' : '') + (m.to ? ' whisper' : '') + (m.kind === 'roll' ? ' is-roll' : '') + '" data-id="' + attr(m.id) + '"><div class="msg-h"><b>' + esc(m.name) + '</b>' + (wh ? '<span class="wh"><svg class="ic"><use href="#i-eye"/></svg>' + esc(wh) + '</span>' : '') + '<time>' + hhmm(m.at) + '</time></div>';
    if (m.kind === 'roll') { var r = m.roll || {}, crit = r.nat === 20, fumble = r.nat === 1; h += '<div class="roll-card' + (crit ? ' is-crit' : fumble ? ' is-fumble' : '') + '"><span class="roll-lbl">' + esc(r.label) + (r.adv === 'adv' ? ' · con ventaja' : r.adv === 'dis' ? ' · con desventaja' : '') + '</span><b>' + r.total + '</b>' + (r.nat ? '<small>' + (crit ? '¡20 natural!' : fumble ? '1 natural' : 'd20: ' + r.nat) + '</small>' : '') + '</div>'; }
    else if (m.kind === 'img') h += '<button type="button" class="msg-img" data-act="mesaview" data-img="' + attr(m.img) + '"><img alt="' + attr(m.text || 'Imagen') + '" loading="lazy" src="' + attr(imgUrl(m.img)) + '"></button>' + (m.text ? '<p>' + esc(m.text) + '</p>' : '') + (isDm() ? '<button class="pill" type="button" data-act="mesapin" data-img="' + attr(m.img) + '" data-cap="' + attr(m.text || '') + '">Fijar en el tablero</button>' : '');
    else h += '<p>' + esc(m.text).replace(/\n/g, '<br>') + '</p>';
    return h + '</div>';
  }
  function imgUrl(id){ var c = C.code || (window.Sala && Sala.code()); return (window.Sala ? Sala.httpBase() : '') + '/api/img/' + c + '/' + id; }
  function toOptions(){
    var r = room(); if (!r) return '';
    var opts = '<option value="">Todos</option>';
    if (isDm()) r.members.filter(function(m){ return m.role !== 'dm'; }).forEach(function(m){ opts += '<option value="' + attr(m.id) + '">Susurro a ' + esc(m.char ? m.char.name : m.name) + '</option>'; });
    else { var dm = r.members.filter(function(m){ return m.role === 'dm'; })[0]; if (dm) opts += '<option value="' + attr(dm.id) + '">Susurro al DM</option>'; }
    return opts;
  }
  function renderChat(keepComposer){
    var box = document.getElementById('mesaChat'); if (!box) return;
    if (!online()) { box.innerHTML = lobby('Aquí va el chat de la sesión: notas de todos, tiradas, imágenes del DM y susurros.'); mountLobby(); return; }
    var list = box.querySelector('.chat-list');
    if (keepComposer && list) { var atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80; list.innerHTML = chatItems(); if (atBottom) list.scrollTop = list.scrollHeight; return; }
    var r = room(), dm = isDm(), draft = (box.querySelector('#chatIn') || {}).value || '';
    var h = '<div class="mesa-head" id="chatHead">' + headHtml() + '</div>';
    if (endedSnap) h += endedBanner();
    h += '<div class="chat-list" role="log" aria-live="polite">' + chatItems() + '</div>';
    h += '<form class="chat-form" data-form="mesachat">'
      + (rollOpen ? '<div class="roll-form"><input class="field" name="label" list="rollList" placeholder="Qué tiraste (Percepción)" aria-label="Qué tiraste" autocomplete="off"><input class="field" name="total" inputmode="numeric" placeholder="Total" aria-label="Total"><input class="field" name="nat" inputmode="numeric" placeholder="d20" aria-label="Lo que salió en el d20 (opcional)"><select class="field" name="adv" aria-label="Ventaja"><option value="">Normal</option><option value="adv">Ventaja</option><option value="dis">Desventaja</option></select><button class="btn main" type="submit" data-kind="roll">Compartir tirada</button><datalist id="rollList">' + ROLLS.map(function(x){ return '<option value="' + x + '">'; }).join('') + '</datalist></div>' : '')
      + '<div class="chat-row"><select class="field chat-to" name="to" aria-label="Para quién">' + toOptions() + '</select><button type="button" class="icon-btn" data-act="mesaroll" aria-pressed="' + rollOpen + '" aria-label="Compartir una tirada" title="Tirada"><svg class="ic"><use href="#i-d20"/></svg></button><label class="icon-btn pickbtn" aria-label="Compartir una imagen" title="Imagen"><svg class="ic"><use href="#i-image"/></svg><input type="file" id="mesaImg" accept="image/*"></label></div>'
      + '<div class="chat-row"><textarea class="field" id="chatIn" name="text" rows="2" placeholder="Escribe una nota de la sesión…" aria-label="Mensaje">' + esc(draft) + '</textarea><button class="btn main" type="submit" data-kind="msg">Enviar</button></div>'
      + (uploading ? '<p class="note">Subiendo imagen…</p>' : '') + '</form>';
    box.innerHTML = h;
    var l2 = box.querySelector('.chat-list'); l2.scrollTop = l2.scrollHeight;
  }
  function headHtml(){
    var r = room(); if (!r) return '';
    return (r.live ? '<span class="camp-pill live">Sesión ' + r.session.n + '</span><b class="mesa-title-ro">' + esc(r.session.title || '') + '</b>' : '<span class="camp-pill">Fuera de sesión</span><span class="note mesa-off">El chat sigue abierto entre sesiones.</span>')
      + (isDm() ? (r.live ? '<button class="btn sm" type="button" data-act="mesaend">Terminar sesión</button>' : '<button class="btn main sm" type="button" data-act="mesastart">Empezar sesión</button>') : '');
  }
  function chatHead(){ var h = document.getElementById('chatHead'); if (h) h.innerHTML = headHtml(); }
  /* Separadores entre sesiones: «Sesión 3», «Fuera de sesión» */
  function chatItems(){
    if (!C.chat.length) return '<p class="note chat-empty">Nada todavía. Escribe lo que pasa, lo que descubren o lo que sacaron en sus dados.</p>';
    var out = [], prev = null;
    C.chat.forEach(function(m){ var s = m.ses || 0; if (s !== prev) { out.push('<div class="chat-sep"><span>' + (s ? 'Sesión ' + s : 'Fuera de sesión') + ' · ' + new Date(m.at).toLocaleDateString('es-MX', {day:'numeric', month:'short'}) + '</span></div>'); prev = s; } out.push(msgHtml(m)); });
    return out.join('');
  }
  function endedBanner(){ return '<div class="banner"><p>La sesión terminó y se guardó en tus Notas.</p><button class="btn main sm" type="button" data-act="mesadl">Descargar resumen</button></div>'; }

  /* Imágenes: se achican en el teléfono antes de subirlas */
  function shrink(file, max){
    return new Promise(function(res, rej){
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function(){ var s = Math.min(1, max / Math.max(img.width, img.height)), cv = document.createElement('canvas'); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url); cv.toBlob(function(b){ b ? res(b) : rej(new Error('blob')); }, 'image/jpeg', 0.82); };
      img.onerror = function(){ URL.revokeObjectURL(url); rej(new Error('img')); };
      img.src = url;
    });
  }
  /* Sube una imagen a la campaña (achicada) y devuelve su id */
  function upload(file, max){
    return shrink(file, max || 1600).then(function(blob){ return fetch(Sala.httpBase() + '/api/img?code=' + encodeURIComponent(Sala.code()) + '&token=' + encodeURIComponent(Sala.token()), {method:'POST', headers:{'content-type':'image/jpeg'}, body:blob}); })
      .then(function(r){ return r.json().then(function(j){ if (!r.ok) throw new Error(j.msg || 'No se pudo subir'); return j.id; }); });
  }
  function uploadImage(file, caption, to){
    uploading = true; renderChat(false);
    return upload(file, 1600)
      .then(function(id){ Sala.send({t:'chat.img', img:id, caption:caption || '', to:to || null}); })
      .catch(function(e){ Sala.toast(e.message || 'No se pudo subir la imagen.'); })
      .then(function(){ uploading = false; renderChat(false); });
  }

  /* ---------- Pizarra ---------- */
  var canvas = null, drawing = null;
  function ctx(){ return canvas && canvas.getContext('2d'); }
  function renderDraw(){
    var box = document.getElementById('mesaDraw'); if (!box) return;
    if (!online()) { box.innerHTML = lobby('Aquí dibujan todos con el dedo: mapas, rutas, la cara del villano.'); mountLobby(); return; }
    var dm = isDm();
    box.innerHTML = '<div class="draw-tools"><div class="swatches" role="group" aria-label="Color">' + COLORS.map(function(c){ return '<button type="button" class="sw" data-act="mesacolor" data-v="' + c + '" style="background:' + c + '" aria-pressed="' + (!tool.erase && tool.color === c) + '" aria-label="Color ' + c + '"></button>'; }).join('') + '</div>'
      + '<div class="seg sm" role="group" aria-label="Grosor">' + [[2,'Fino'],[5,'Medio'],[12,'Grueso']].map(function(x){ return '<button type="button" data-act="mesaw" data-v="' + x[0] + '" aria-pressed="' + (tool.w === x[0]) + '">' + x[1] + '</button>'; }).join('') + '<button type="button" data-act="mesaerase" aria-pressed="' + tool.erase + '">Borrador</button></div>'
      + '<div class="row" style="gap:6px"><button class="btn sm" type="button" data-act="mesaundo">Deshacer lo mío</button>' + (dm ? '<button class="btn sm" type="button" data-act="mesaclear">Hoja nueva</button>' : '') + '<span class="muted" style="font-size:13px">' + (C.pages.length ? C.pages.length + ' hoja' + (C.pages.length > 1 ? 's' : '') + ' guardada' + (C.pages.length > 1 ? 's' : '') : '') + '</span></div></div>'
      + '<div class="draw-wrap"><canvas id="mesaCanvas" aria-label="Pizarra compartida: dibuja con el dedo"></canvas></div>';
    canvas = box.querySelector('canvas');
    fit(); drawAll(); bindCanvas();
  }
  function fit(){ if (!canvas) return; var w = canvas.parentNode.clientWidth || 320, dpr = window.devicePixelRatio || 1; canvas.style.width = w + 'px'; canvas.style.height = Math.round(w * 4 / 3) + 'px'; canvas.width = Math.round(w * dpr); canvas.height = Math.round(w * 4 / 3 * dpr); }
  function strokeOn(c, k, W){
    if (!c || !k || !k.pts || k.pts.length < 2) return;
    W = W || (canvas ? canvas.width : 0); if (!W) return;
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = k.erase ? PAPER : k.color; c.lineWidth = Math.max(1, k.w * W / 400);
    c.beginPath(); c.moveTo(k.pts[0] * W, k.pts[1] * W);
    if (k.pts.length === 2) c.lineTo(k.pts[0] * W + 0.1, k.pts[1] * W);
    for (var i = 2; i < k.pts.length; i += 2) c.lineTo(k.pts[i] * W, k.pts[i + 1] * W);
    c.stroke(); c.restore();
  }
  function paintAll(c, W, H, strokes){ c.fillStyle = PAPER; c.fillRect(0, 0, W, H); strokes.forEach(function(k){ strokeOn(c, k, W); }); }
  function drawAll(){ if (!canvas || !document.contains(canvas)) return; var c = ctx(); if (!c) return; paintAll(c, canvas.width, canvas.height, C.strokes); if (drawing) strokeOn(c, drawing); }
  function bindCanvas(){
    var pos = function(ev){ var r = canvas.getBoundingClientRect(); return [Math.round((ev.clientX - r.left) / r.width * 1000) / 1000, Math.round((ev.clientY - r.top) / r.width * 1000) / 1000]; };
    canvas.addEventListener('pointerdown', function(ev){ ev.preventDefault(); try { canvas.setPointerCapture(ev.pointerId); } catch(e){} var p = pos(ev); drawing = {color: tool.color, w: tool.w, erase: tool.erase, pts: [p[0], p[1]]}; strokeOn(ctx(), drawing); });
    canvas.addEventListener('pointermove', function(ev){ if (!drawing) return; var p = pos(ev), n = drawing.pts.length; var dx = p[0] - drawing.pts[n - 2], dy = p[1] - drawing.pts[n - 1]; if (dx * dx + dy * dy < 0.000016) return; if (n >= 1700) return; drawing.pts.push(p[0], p[1]); var c = ctx(), W = canvas.width; c.save(); c.lineCap = 'round'; c.strokeStyle = drawing.erase ? PAPER : drawing.color; c.lineWidth = Math.max(1, drawing.w * W / 400); c.beginPath(); c.moveTo(drawing.pts[n - 2] * W, drawing.pts[n - 1] * W); c.lineTo(p[0] * W, p[1] * W); c.stroke(); c.restore(); });
    var end = function(){ if (!drawing) return; var k = drawing; drawing = null; Sala.send({t:'draw.add', stroke:k}); };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end); canvas.addEventListener('pointerleave', function(ev){ if (ev.buttons === 0) end(); });
  }
  window.addEventListener('resize', function(){ if (tab === 'pizarra' && canvas) { fit(); drawAll(); } });

  /* ---------- Tablero del DM ---------- */
  function renderBoard(){
    var box = document.getElementById('mesaBoard'); if (!box) return;
    if (!online()) { box.innerHTML = lobby('Aquí el DM fija la misión, los PNJ, los lugares y las pistas para que todos los tengan a la mano.'); mountLobby(); return; }
    var dm = isDm(), h = '';
    if (dm) h += '<div class="row" style="gap:8px;margin-bottom:10px"><button class="btn main sm" type="button" data-act="mesaboardnew">' + (boardOpen ? 'Cerrar' : 'Nueva nota') + '</button><span class="note">Solo tú escribes aquí; todos lo ven.</span></div>';
    if (dm && boardOpen) { var e = boardEdit || {cat:'mision', title:'', text:''}; h += '<form class="board-form card" data-form="mesaboard"><div class="seg sm">' + CATS.map(function(c){ return '<button type="button" data-act="mesacat" data-v="' + c[0] + '" aria-pressed="' + (e.cat === c[0]) + '">' + c[1] + '</button>'; }).join('') + '</div><input type="hidden" name="cat" value="' + attr(e.cat) + '"><input class="field" name="title" value="' + attr(e.title) + '" placeholder="Título (Vela, la herrera)" aria-label="Título" autocomplete="off"><textarea class="field" name="text" rows="3" placeholder="Lo que deben recordar…" aria-label="Texto">' + esc(e.text) + '</textarea>' + (e.img ? '<img class="board-img" alt="" src="' + attr(imgUrl(e.img)) + '">' : '') + '<button class="btn main" type="submit">' + (e.id ? 'Guardar' : 'Fijar en el tablero') + '</button></form>'; }
    if (!C.board.length) h += '<p class="note">' + (dm ? 'Todavía no hay notas. Empieza por la misión actual.' : 'El DM todavía no ha fijado nada.') + '</p>';
    CATS.forEach(function(c){
      var items = C.board.filter(function(b){ return b.cat === c[0]; }); if (!items.length) return;
      h += '<div class="group-h">' + c[1] + '</div>' + items.map(function(b){ return '<div class="board-item card' + (b.done ? ' done' : '') + '"><div class="row"><b>' + esc(b.title) + '</b>' + (dm ? '<span class="board-btns"><button class="pill" type="button" data-act="mesabdone" data-id="' + attr(b.id) + '">' + (b.done ? 'Reabrir' : 'Hecho') + '</button><button class="pill" type="button" data-act="mesabedit" data-id="' + attr(b.id) + '">Editar</button><button class="pill" type="button" data-act="mesabdel" data-id="' + attr(b.id) + '">Borrar</button></span>' : '') + '</div>' + (b.text ? '<p>' + esc(b.text).replace(/\n/g, '<br>') + '</p>' : '') + (b.img ? '<button type="button" class="msg-img" data-act="mesaview" data-img="' + attr(b.img) + '"><img alt="" loading="lazy" src="' + attr(imgUrl(b.img)) + '"></button>' : '') + '</div>'; }).join('');
    });
    box.innerHTML = h;
  }

  /* ---------- Fin de la sesión: Notas + archivo ---------- */
  function idb(){ return new Promise(function(res, rej){ var r = indexedDB.open('diario5e', 2); r.onupgradeneeded = function(){ if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); }; r.onsuccess = function(){ res(r.result); }; r.onerror = function(){ rej(r.error); }; }); }
  function idbPut(k, v){ return idb().then(function(db){ return new Promise(function(res){ var t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = function(){ res(true); }; t.onerror = function(){ res(false); }; }); }).catch(function(){ return false; }); }
  function idbGetK(k){ return idb().then(function(db){ return new Promise(function(res){ var q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = function(){ res(q.result); }; q.onerror = function(){ res(null); }; }); }).catch(function(){ return null; }); }
  function idbDelK(k){ return idb().then(function(db){ return new Promise(function(res){ var t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = function(){ res(true); }; }); }).catch(function(){ return false; }); }
  function index(){ try { return JSON.parse(localStorage.getItem(IDX) || '[]'); } catch(e){ return []; } }
  function setIndex(a){ try { localStorage.setItem(IDX, JSON.stringify(a)); } catch(e){} }
  function pageImg(strokes){ var W = 900, H = 1200, cv = document.createElement('canvas'); cv.width = W; cv.height = H; var c = cv.getContext('2d'); if (!c) return ''; paintAll(c, W, H, strokes); try { return cv.toDataURL('image/png'); } catch(e){ return ''; } }
  function toDataUrl(url){ return fetch(url).then(function(r){ if (!r.ok) throw 0; return r.blob(); }).then(function(b){ return new Promise(function(res){ var fr = new FileReader(); fr.onload = function(){ res(fr.result); }; fr.onerror = function(){ res(''); }; fr.readAsDataURL(b); }); }).catch(function(){ return ''; }); }
  function plain(snap){
    var d = new Date(snap.started), lines = ['=== ' + (snap.title || 'Sesión') + ' · ' + d.toLocaleDateString('es-MX') + ' ==='];
    var bd = snap.board || []; if (bd.length) { lines.push('Tablero:'); bd.forEach(function(b){ lines.push('- [' + (CATS.filter(function(c){ return c[0] === b.cat; })[0] || ['', 'Otro'])[1] + '] ' + b.title + (b.text ? ': ' + b.text : '') + (b.done ? ' (hecho)' : '')); }); }
    lines.push('Chat:');
    (snap.chat || []).forEach(function(m){ var who = m.name + (m.to ? ' (susurro)' : ''); if (m.kind === 'roll') lines.push(hhmm(m.at) + ' ' + who + ' tiró ' + m.roll.label + ': ' + m.roll.total + (m.roll.nat ? ' (d20 ' + m.roll.nat + ')' : '')); else if (m.kind === 'img') lines.push(hhmm(m.at) + ' ' + who + ' compartió una imagen' + (m.text ? ': ' + m.text : '')); else lines.push(hhmm(m.at) + ' ' + who + ': ' + m.text); });
    if ((snap.pages || []).length) lines.push('Dibujos: ' + snap.pages.length + ' (en el archivo de la sesión)');
    return lines.join('\n');
  }
  function fileHtml(snap){
    var imgs = {};
    (snap.chat || []).concat(snap.board || []).forEach(function(m){ if (m.img) imgs[m.img] = 1; });
    var ids = Object.keys(imgs);
    return Promise.all(ids.map(function(id){ return toDataUrl(imgUrl(id)).then(function(u){ imgs[id] = u; }); })).then(function(){
      var d = new Date(snap.started), e2 = function(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };
      var h = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + e2(snap.title || 'Sesión') + '</title><style>body{margin:0;background:#24130f;font-family:Georgia,serif;color:#2b1d12}main{max-width:760px;margin:0 auto;background:#f1e6cc;padding:24px 20px 40px}h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;border-bottom:2px solid #b08a3e;padding-bottom:4px;margin-top:28px}.muted{color:#5e4630}.m{padding:8px 10px;border-radius:8px;background:#f6eedb;margin:6px 0;border:1px solid #d6c193}.m.w{border-style:dashed}.m b{color:#8c2626}.m time{float:right;color:#5e4630;font-size:13px}.roll{font-size:20px}.roll strong{font-size:26px}img{max-width:100%;border-radius:8px;border:1px solid #c8ad74}.b{margin:8px 0;padding:8px 10px;background:#f6eedb;border-left:4px solid #b08a3e}.done{opacity:.6;text-decoration:line-through}</style></head><body><main>';
      h += '<h1>' + e2(snap.title || 'Sesión de D&amp;D') + '</h1><p class="muted">' + d.toLocaleDateString('es-MX', {weekday:'long', year:'numeric', month:'long', day:'numeric'}) + ' · ' + hhmm(snap.started) + '–' + hhmm(snap.ended) + ' · Mesa ' + e2(snap.code) + '</p><p class="muted">En la mesa: ' + (snap.members || []).map(function(x){ return e2(x.name); }).join(', ') + '</p>';
      if ((snap.board || []).length) { h += '<h2>Tablero del DM</h2>'; CATS.forEach(function(c){ var it = snap.board.filter(function(b){ return b.cat === c[0]; }); if (!it.length) return; h += '<h3>' + c[1] + '</h3>' + it.map(function(b){ return '<div class="b' + (b.done ? ' done' : '') + '"><b>' + e2(b.title) + '</b>' + (b.text ? '<br>' + e2(b.text).replace(/\n/g, '<br>') : '') + (b.img && imgs[b.img] ? '<br><img alt="" src="' + imgs[b.img] + '">' : '') + '</div>'; }).join(''); }); }
      h += '<h2>Chat de la sesión</h2>' + ((snap.chat || []).map(function(m){ var body = m.kind === 'roll' ? '<div class="roll">' + e2(m.roll.label) + ': <strong>' + m.roll.total + '</strong>' + (m.roll.nat ? ' <span class="muted">(d20: ' + m.roll.nat + ')</span>' : '') + '</div>' : m.kind === 'img' ? (imgs[m.img] ? '<img alt="" src="' + imgs[m.img] + '">' : '<p class="muted">(imagen no disponible)</p>') + (m.text ? '<div>' + e2(m.text) + '</div>' : '') : '<div>' + e2(m.text).replace(/\n/g, '<br>') + '</div>'; return '<div class="m' + (m.to ? ' w' : '') + '"><time>' + hhmm(m.at) + '</time><b>' + e2(m.name) + '</b>' + (m.to ? ' <span class="muted">(susurro)</span>' : '') + body + '</div>'; }).join('') || '<p class="muted">Sin mensajes.</p>');
      if ((snap.pages || []).length) { h += '<h2>Pizarra</h2>'; snap.pages.forEach(function(pg, i){ var u = pageImg(pg.strokes); if (u) h += '<p class="muted">Hoja ' + (i + 1) + ' · ' + hhmm(pg.at) + '</p><img alt="Dibujo ' + (i + 1) + '" src="' + u + '">'; }); }
      return h + '<p class="muted" style="margin-top:30px">Guardado con el Diario del Aventurero.</p></main></body></html>';
    });
  }
  function finishSession(snap){
    var id = 's' + snap.started.toString(36), title = snap.title || 'Sesión del ' + new Date(snap.started).toLocaleDateString('es-MX');
    if (window.Diario && Diario.addNote) Diario.addNote(plain(snap));
    fileHtml(snap).then(function(html){
      idbPut('ses:' + id, html);
      var ix = index().filter(function(x){ return x.id !== id; }); ix.unshift({id:id, title:title, date:snap.started}); setIndex(ix.slice(0, 60));
      renderSessions();
    });
    if (C.strokes.length) { C.pages.push({at: Date.now(), strokes: C.strokes}); C.strokes = []; }
    persist(); Sala.toast('La sesión terminó y se guardó en tus Notas.');
    render();
  }
  function download(id){
    var it = index().filter(function(x){ return x.id === id; })[0];
    idbGetK('ses:' + id).then(function(html){
      if (!html) { Sala.toast('No encuentro ese archivo en este teléfono.'); return; }
      var name = (it ? it.title : 'sesion').replace(/[^\wáéíóúñü -]/gi, '').trim().replace(/\s+/g, '-').toLowerCase() + '.html';
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], {type:'text/html'})); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    });
  }
  /* Lista en la pestaña Notas */
  function renderSessions(){
    var box = document.getElementById('sesList'); if (!box) return;
    var ix = index();
    box.innerHTML = ix.length ? '<span class="label">sesiones guardadas</span>' + ix.map(function(x){ return '<div class="line"><span style="flex:1"><b>' + esc(x.title) + '</b><br><small class="muted">' + new Date(x.date).toLocaleDateString('es-MX', {day:'numeric', month:'long', year:'numeric'}) + '</small></span><button class="btn sm" type="button" data-act="sesdl" data-id="' + attr(x.id) + '">Descargar</button><button class="icon-btn" type="button" data-act="sesdel" data-id="' + attr(x.id) + '" aria-label="Borrar ' + attr(x.title) + '"><svg class="ic"><use href="#i-x"/></svg></button></div>'; }).join('') : '';
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('[data-act]'); if (!b) return;
    var a = b.dataset.act;
    if (a === 'mesatab') { show(b.dataset.v); return; }
    if (a.indexOf('mesa') !== 0 && a.indexOf('ses') !== 0) return;
    if (a === 'mesaroll') { rollOpen = !rollOpen; renderChat(false); }
    else if (a === 'mesaview') openViewer(imgUrl(b.dataset.img));
    else if (a === 'mesaviewclose') closeViewer();
    else if (a === 'mesapin') { boardEdit = {cat:'otro', title: b.dataset.cap || 'Imagen', text:'', img: b.dataset.img}; boardOpen = true; show('tablero'); }
    else if (a === 'mesaend') { if (b.dataset.sure) Sala.send({t:'session.end'}); else { b.dataset.sure = 1; b.textContent = '¿Seguro? Toca otra vez'; setTimeout(function(){ if (document.contains(b)) { delete b.dataset.sure; b.textContent = 'Terminar sesión'; } }, 4000); } }
    else if (a === 'mesastart') Sala.send({t:'session.start'});
    else if (a === 'mesadl') { var ix = index(); if (ix[0]) download(ix[0].id); }
    else if (a === 'mesacolor') { tool.color = b.dataset.v; tool.erase = false; renderDraw(); }
    else if (a === 'mesaw') { tool.w = +b.dataset.v; renderDraw(); }
    else if (a === 'mesaerase') { tool.erase = !tool.erase; renderDraw(); }
    else if (a === 'mesaundo') Sala.send({t:'draw.undo'});
    else if (a === 'mesaclear') { if (b.dataset.sure) Sala.send({t:'draw.clear'}); else { b.dataset.sure = 1; b.textContent = '¿Guardar y limpiar?'; setTimeout(function(){ if (document.contains(b)) { delete b.dataset.sure; b.textContent = 'Hoja nueva'; } }, 4000); } }
    else if (a === 'mesaboardnew') { boardOpen = !boardOpen; boardEdit = null; renderBoard(); }
    else if (a === 'mesacat') { var f = b.closest('form'); f.elements.cat.value = b.dataset.v; $$('[data-act="mesacat"]', f).forEach(function(x){ x.setAttribute('aria-pressed', String(x === b)); }); if (boardEdit) boardEdit.cat = b.dataset.v; }
    else if (a === 'mesabedit') { boardEdit = JSON.parse(JSON.stringify(C.board.filter(function(x){ return x.id === b.dataset.id; })[0] || null)); boardOpen = !!boardEdit; renderBoard(); }
    else if (a === 'mesabdel') { if (b.dataset.sure) Sala.send({t:'board.del', id:b.dataset.id}); else { b.dataset.sure = 1; b.textContent = '¿Borrar?'; } }
    else if (a === 'mesabdone') Sala.send({t:'board.done', id:b.dataset.id});
    else if (a === 'sesdl') download(b.dataset.id);
    else if (a === 'sesdel') { if (b.dataset.sure) { idbDelK('ses:' + b.dataset.id); setIndex(index().filter(function(x){ return x.id !== b.dataset.id; })); renderSessions(); } else { b.dataset.sure = 1; b.style.borderColor = 'var(--bad)'; b.setAttribute('aria-label', 'Toca otra vez para borrar'); } }
  });
  document.addEventListener('submit', function(ev){
    var f = ev.target, kind = f.dataset && f.dataset.form; if (kind !== 'mesachat' && kind !== 'mesaboard') return;
    ev.preventDefault();
    if (kind === 'mesaboard') { var it = {cat:f.elements.cat.value, title:f.elements.title.value.trim(), text:f.elements.text.value.trim()}; if (!it.title) { f.elements.title.focus(); return; } if (boardEdit && boardEdit.id) Sala.send({t:'board.edit', id:boardEdit.id, item:it, img:boardEdit.img || null}); else Sala.send({t:'board.add', item:it, img: boardEdit && boardEdit.img || null}); boardEdit = null; boardOpen = false; return; }
    var k = ev.submitter && ev.submitter.dataset.kind || 'msg', to = f.elements.to ? f.elements.to.value : '';
    if (k === 'roll') { var tot = parseInt(f.elements.total.value, 10); if (!isFinite(tot)) { f.elements.total.focus(); return; } Sala.send({t:'chat.roll', label:f.elements.label.value.trim(), total:tot, nat:f.elements.nat.value.trim() || null, adv:f.elements.adv.value || null, to:to || null}); rollOpen = false; renderChat(false); return; }
    var tx = f.elements.text.value.trim(); if (!tx) return;
    Sala.send({t:'chat.send', text:tx, to:to || null}); f.elements.text.value = '';
  });
  document.addEventListener('keydown', function(ev){ if (ev.target && ev.target.id === 'chatIn' && ev.key === 'Enter' && !ev.shiftKey && window.matchMedia('(min-width: 900px)').matches) { ev.preventDefault(); var f = ev.target.form; var btn = f.querySelector('[data-kind="msg"]'); var e2 = new Event('submit', {bubbles:true, cancelable:true}); try { Object.defineProperty(e2, 'submitter', {value:btn}); } catch(x){} f.dispatchEvent(e2); } });
  document.addEventListener('change', function(ev){
    var t = ev.target;
    if (t.id === 'mesaImg' && t.files && t.files[0]) { var f = t.form, to = f && f.elements.to ? f.elements.to.value : ''; var cap = f ? f.elements.text.value.trim() : ''; if (f) f.elements.text.value = ''; uploadImage(t.files[0], cap, to); t.value = ''; }
  });

  /* Visor de imagen a pantalla completa */
  function openViewer(src){ var v = document.getElementById('mesaViewer'); if (!v) { v = document.createElement('div'); v.id = 'mesaViewer'; v.className = 'mesa-viewer'; document.getElementById('combat').appendChild(v); } v.innerHTML = '<button type="button" class="icon-btn" data-act="mesaviewclose" aria-label="Cerrar imagen"><svg class="ic"><use href="#i-x"/></svg></button><img alt="" src="' + attr(src) + '">'; v.hidden = false; }
  function closeViewer(){ var v = document.getElementById('mesaViewer'); if (v) v.hidden = true; }

  setTimeout(renderSessions, 0);
  return {show:show, render:render, renderSessions:renderSessions, tab:function(){ return tab; }, imgUrl:imgUrl, shrink:shrink, upload:upload, openViewer:openViewer};
})();
