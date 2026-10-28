/* ==================== CAMPAÑAS: SELECTOR, INICIO Y PANEL DEL DM ==================== */
/* El botón del estandarte abre la vista de campaña a pantalla completa. En Inicio eliges en qué campaña estás
   (cada una tiene un código fijo), te unes con el código o, como DM, creas una o la abres en otro aparato con tu clave.
   Ya dentro, Inicio muestra quién está, si hay sesión, y al DM le da botones grandes para llevar la partida. */
var Campana = (function(){
  var esc = function(s){ return Render5e.esc(s == null ? '' : s); }, attr = function(s){ return Render5e.attr(s == null ? '' : s); };
  var $ = function(s, r){ return (r || document).querySelector(s); };
  var form = {mode:'join', dmTab:'new'}, settingsOpen = false, showList = false, keyMsg = '';

  function room(){ return Sala.status() === 'on' ? Sala.room() : null; }
  function isDm(){ var r = room(); return !!r && r.role === 'dm'; }
  function box(){ return document.getElementById('mesaHome'); }
  function visible(){ var c = document.getElementById('combat'); return c && !c.hidden && c.getAttribute('data-tab') === 'inicio'; }
  function ago(t){ if (!t) return ''; var m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'ahora' : m < 60 ? 'hace ' + m + ' min' : m < 1440 ? 'hace ' + Math.round(m / 60) + ' h' : 'hace ' + Math.round(m / 1440) + ' d'; }
  function pill(live, missing){ return missing ? '<span class="camp-pill gone">No encontrada</span>' : live ? '<span class="camp-pill live">En sesión</span>' : '<span class="camp-pill">Fuera de sesión</span>'; }

  /* ---------- Vista expandida: el libro ocupa toda la pantalla mientras la campaña está abierta ---------- */
  function watch(){
    var cb = document.getElementById('combat'), app = document.querySelector('.app'); if (!cb || !app) return;
    var sync = function(){ app.classList.toggle('camp-wide', !cb.hidden); title(); };
    new MutationObserver(sync).observe(cb, {attributes:true, attributeFilter:['hidden']}); sync();
  }
  function title(){ var h = document.getElementById('campTitle'); if (!h) return; var r = room(), e = Sala.active(); h.textContent = r ? r.name : e && Sala.status() === 'connecting' ? (e.name || e.code) : 'Campañas'; var lv = document.getElementById('campLive'); if (lv) { lv.hidden = !(r && r.live); } }

  /* ---------- Render ---------- */
  function render(){
    var b = box(); if (!b) return;
    title();
    var r = room();
    if (r && !showList) { b.innerHTML = inside(r); return; }
    b.innerHTML = selector();
    Sala.peek();
  }
  function keepFocus(fn){ var a = document.activeElement, id = a && a.id, s = a && a.selectionStart; fn(); if (id) { var n = document.getElementById(id); if (n && n !== a) { n.focus(); try { if (s != null) n.setSelectionRange(s, s); } catch(e){} } } }

  /* ---------- Tarjetas desplegables ---------- */
  var FKEY = 'diario-camp-folds', folds = (function(){ try { return JSON.parse(localStorage.getItem(FKEY) || '{}') || {}; } catch(e){ return {}; } })();
  function isOpen(id, def){ return folds[id] == null ? !!def : !!folds[id]; }
  function fold(id, o){
    var open = isOpen(id, o.open);
    return '<section class="fold' + (o.cls ? ' ' + o.cls : '') + (open ? ' open' : '') + '" data-fold="' + id + '"><button type="button" class="fold-h" data-act="campfold" data-v="' + id + '" aria-expanded="' + open + '"><span class="fold-ic"><svg class="ic"><use href="#' + o.icon + '"/></svg></span><span class="fold-t"><b>' + o.title + '</b>' + (o.sum ? '<small>' + o.sum + '</small>' : '') + '</span>' + (o.badge || '') + '<svg class="ic fold-chev"><use href="#i-chev"/></svg></button><div class="fold-b"' + (open ? '' : ' inert') + '><div class="fold-in">' + o.body + '</div></div></section>';
  }
  function toggleFold(id){
    var sec = document.querySelector('[data-fold="' + id + '"]'); if (!sec) return;
    var open = !sec.classList.contains('open'); folds[id] = open; try { localStorage.setItem(FKEY, JSON.stringify(folds)); } catch(e){}
    sec.classList.toggle('open', open); sec.querySelector('.fold-h').setAttribute('aria-expanded', String(open));
    var bd = sec.querySelector('.fold-b'); if (open) bd.removeAttribute('inert'); else bd.setAttribute('inert', '');
    if (open) setTimeout(function(){ var r = sec.getBoundingClientRect(); if (r.bottom > (window.innerHeight || 800)) try { sec.scrollIntoView({block:'nearest', behavior:'smooth'}); } catch(e){} }, 300);
  }
  function charName(id){ var cs = window.Diario && Diario.chars ? Diario.chars() : []; var c = cs.filter(function(x){ return x.id === id; })[0]; return c ? c.name : ''; }
  function initials(n){ return String(n || '?').split(/\s+/).slice(0, 2).map(function(w){ return w.charAt(0); }).join('').toUpperCase(); }

  function selector(){
    var L = Sala.list(), act = Sala.active(), err = Sala.error(), r = room(), can = Sala.available();
    var h = '<div class="camp-home">';
    if (r) h += '<button class="btn sm camp-back" type="button" data-act="campback"><svg class="ic"><use href="#i-back"/></svg>Volver a ' + esc(r.name) + '</button>';
    h += '<div class="camp-sec"><h3 class="camp-h">Tus campañas</h3>';
    if (!can) h += '<p class="note">Para jugar en grupo abre el diario desde el servidor del proyecto o escribe su dirección en Ajustes → Servidor de campañas.</p>';
    if (L.length) h += '<div class="camp-list">' + L.map(function(e, i){
      var on = act && act.code === e.code && Sala.status() !== 'off', conn = on && Sala.status() === 'connecting', dm = e.role === 'dm', cn = !dm && e.char ? charName(e.char) : '';
      return '<div class="camp-card ' + (dm ? 'role-dm' : 'role-pj') + (on ? ' on' : '') + (e.missing ? ' missing' : '') + '" style="--d:' + (i * 50) + 'ms"><button type="button" class="camp-open" data-act="campselect" data-code="' + attr(e.code) + '"' + (e.missing ? ' disabled' : '') + '><span class="camp-crest">' + (dm ? '<svg class="ic"><use href="#i-crown"/></svg>' : cn ? esc(initials(cn)) : '<svg class="ic"><use href="#i-banner"/></svg>') + '</span><span class="camp-txt"><b>' + esc(e.name || 'Campaña ' + e.code) + '</b><small><span class="camp-role">' + (dm ? 'Eres el DM' : 'Jugador' + (cn ? ' · ' + esc(cn) : '')) + '</span> · <span class="camp-code">' + esc(e.code) + '</span>' + (e.online ? ' · ' + e.online + ' conectado' + (e.online > 1 ? 's' : '') : '') + (e.last ? ' · ' + ago(e.last) : '') + '</small></span>' + pill(e.live, e.missing) + '<span class="camp-go">' + (conn ? 'Entrando…' : on ? 'Abierta' : 'Entrar') + '</span></button>'
        + '<button class="icon-btn camp-forget" type="button" data-act="campforget" data-code="' + attr(e.code) + '" aria-label="Olvidar ' + attr(e.name || e.code) + ' en este aparato" title="Olvidar en este aparato"><svg class="ic"><use href="#i-x"/></svg></button></div>';
    }).join('') + '</div>';
    else h += '<p class="note">Todavía no estás en ninguna campaña. Únete con el código que te pase tu DM, o crea una si tú diriges.</p>';
    if (err && Sala.status() !== 'on') h += '<p class="err">' + esc(err) + '</p>';
    h += '</div>';
    /* Dos puertas: jugador y DM */
    var chars = window.Diario && Diario.chars ? Diario.chars() : [];
    var join = '<form class="camp-form" data-form="campjoin"><label class="fl">Código de la campaña<input class="field camp-codein" id="campCode" name="code" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCDEF"></label>'
      + (chars.length ? '<label class="fl">Entrar con<select class="field" name="char">' + chars.map(function(c){ return '<option value="' + attr(c.id) + '"' + (c.active ? ' selected' : '') + '>' + esc(c.name) + (c.sub ? ' · ' + esc(c.sub) : '') + '</option>'; }).join('') + '</select></label>' : '<p class="note">Crea tu personaje primero para entrar con su hoja.</p>')
      + '<button class="btn main" type="submit"' + (can ? '' : ' disabled') + '>Entrar a la campaña</button></form>';
    var dmf = '<div class="seg sm" role="tablist"><button type="button" data-act="campdmtab" data-v="new" aria-pressed="' + (form.dmTab === 'new') + '">Crear campaña</button><button type="button" data-act="campdmtab" data-v="open" aria-pressed="' + (form.dmTab === 'open') + '">Abrir en este aparato</button></div>';
    if (form.dmTab === 'new') dmf += '<form class="camp-form" data-form="campnew"><label class="fl">Nombre<input class="field" name="name" maxlength="60" autocomplete="off" placeholder="La Costa de la Espada"></label><label class="fl">Clave del DM<input class="field" name="key" type="password" maxlength="64" autocomplete="new-password" placeholder="Al menos 4 caracteres"></label><label class="fl">Repite la clave<input class="field" name="key2" type="password" maxlength="64" autocomplete="new-password"></label><p class="note">Con la clave abres tu campaña en la tablet, la laptop o tu teléfono. Guárdala: no se puede recuperar.</p><button class="btn main" type="submit"' + (can ? '' : ' disabled') + '>Crear campaña</button></form>';
    else dmf += '<form class="camp-form" data-form="campdmopen"><label class="fl">Código<input class="field camp-codein" name="code" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCDEF"></label><label class="fl">Clave del DM<input class="field" name="key" type="password" maxlength="64" autocomplete="current-password"></label><button class="btn main" type="submit"' + (can ? '' : ' disabled') + '>Abrir como DM</button></form>';
    h += '<div class="camp-doors">'
      + fold('sel-pj', {cls:'door pj', icon:'i-banner', title:'Soy jugador', sum:'Entra con el código que te pasó tu DM', open:!L.length, body:join})
      + fold('sel-dm', {cls:'door dm', icon:'i-crown', title:'Soy el DM', sum:'Crea tu campaña o ábrela en este aparato con tu clave', body:dmf})
      + '</div>';
    return h + '</div>';
  }

  function inside(r){
    var dm = r.role === 'dm', me = r.members.filter(function(m){ return m.id === r.you; })[0] || {}, mc = me.char || {};
    var players = r.members.filter(function(m){ return m.role !== 'dm'; }), dmOn = r.members.some(function(m){ return m.role === 'dm' && m.online; }), on = players.filter(function(m){ return m.online; }).length;
    var h = '<div class="camp-home in ' + (dm ? 'as-dm' : 'as-pj') + '">';
    h += '<div class="camp-hero">'
      + '<div class="camp-ribbon">' + (dm ? '<svg class="ic"><use href="#i-crown"/></svg><span>Pantalla del DM</span>' : '<span class="camp-av">' + esc(initials(mc.name || me.name)) + '</span><span>Juegas como <b>' + esc(mc.name || me.name || 'tu personaje') + '</b>' + (mc.cls ? ' · ' + esc(mc.cls) : '') + '</span>') + '</div>'
      + '<div class="camp-top-h"><div class="camp-name"><b>' + esc(r.name) + '</b><span class="camp-sesline">' + (r.live ? 'Sesión ' + r.session.n + (r.session.title ? ' · ' + esc(r.session.title) : '') + ' · empezó ' + ago(r.session.started) : r.session.n ? 'Última sesión: ' + r.session.n + (r.session.ended ? ', ' + ago(r.session.ended) : '') : 'Aún no empieza la primera sesión') + '</span></div>' + pill(r.live) + '</div>'
      + '<div class="camp-people">' + (dm ? '' : '<span class="camp-who dm' + (dmOn ? ' on' : '') + '"><i></i>DM</span>') + players.map(function(m, i){ var c = m.char || {}; return '<span class="camp-who' + (m.online ? ' on' : '') + (m.id === r.you ? ' me' : '') + '" style="--d:' + (i * 40) + 'ms" title="' + attr(m.online ? 'Conectado' : 'Visto ' + ago(m.seen)) + '"><i></i>' + esc(c.name || m.name) + '</span>'; }).join('') + (players.length ? '' : '<span class="note">Nadie más todavía: comparte el código.</span>')
      + '<button type="button" class="camp-codechip" data-act="campshare" aria-label="Compartir el código ' + attr(r.code) + '"><small>código</small><b>' + esc(r.code) + '</b></button></div></div>';
    if (!Sala.durable()) h += '<div class="banner warn"><p><b>El servidor no tiene base de datos.</b> Si se reinicia, esta campaña se borra. ' + (dm ? 'Conecta Neon (gratis) como dice el README para que se guarde siempre.' : 'Avísale al DM.') + '</p></div>';
    h += dm ? dmPanel(r, players, on) : playerPanel(r, me);
    h += '<div class="camp-foot"><button class="btn" type="button" data-act="camplist">Cambiar de campaña</button></div>';
    return h + '</div>';
  }

  function sceneName(r){ var m = (r.maps || []).filter(function(x){ return x.id === r.scene; })[0]; return m ? m.name : ''; }
  function tile(v, icon, title, sub, cls){ return '<button type="button" class="camp-tile' + (cls ? ' ' + cls : '') + '" data-act="campgo" data-v="' + v + '"><svg class="ic"><use href="#' + icon + '"/></svg><b>' + title + '</b><small>' + sub + '</small></button>'; }
  function playerPanel(r, me){
    var chars = window.Diario && Diario.chars ? Diario.chars() : [], sn = sceneName(r), myTurn = r.round && r.turnId === r.you, board = r.board || [], quests = board.filter(function(b){ return b.cat === 'mision' && !b.done; });
    var h = '';
    // Lo que pasa ahora: el mapa del DM y el combate, en grande
    if (sn || r.round) {
      h += '<div class="camp-now">';
      if (r.round) h += '<button type="button" class="camp-now-b fight' + (myTurn ? ' myturn' : '') + '" data-act="campgo" data-v="' + (r.scene ? 'mapas' : 'combate') + '"><svg class="ic"><use href="#i-swords"/></svg><span><b>' + (myTurn ? '¡Es tu turno!' : 'Combate · ronda ' + r.round) + '</b><small>' + (myTurn ? 'Ronda ' + r.round + ' · ' : r.turnId ? 'Turno de ' + esc(nameOf(r, r.turnId)) + ' · ' : '') + (r.scene ? 'Abrir el mapa con el combate' : 'Ver la iniciativa') + '</small></span></button>';
      else if (sn) h += '<button type="button" class="camp-now-b scene" data-act="campgo" data-v="mapas"><svg class="ic"><use href="#i-map"/></svg><span><b>El DM les muestra un mapa</b><small>' + esc(sn) + ' · toca para abrirlo</small></span></button>';
      h += '</div>';
    }
    h += '<div class="camp-tiles">'
      + tile('mapas', 'i-map', 'Mapa', sn ? esc(sn) : (r.maps || []).length + ' en la campaña')
      + tile('combate', 'i-swords', 'Combate', r.round ? 'Ronda ' + r.round : me.init != null ? 'Iniciativa ' + me.init : 'Tu hoja en combate')
      + tile('chat', 'i-chat', 'Chat', 'Notas, tiradas y dibujos')
      + tile('tablero', 'i-pin', 'Tablero', quests.length ? quests.length + ' misi' + (quests.length === 1 ? 'ón' : 'ones') + ' abiertas' : 'Misiones y PNJ')
      + tile('bestiario', 'i-paw', 'Bestiario', (r.beasts || []).length + ' encuentro' + ((r.beasts || []).length === 1 ? '' : 's'))
      + '</div>';
    if (chars.length > 1) h += fold('pj-char', {icon:'i-shield', title:'Tu personaje', sum:'Cambia con qué hoja juegas', body:'<label class="fl">Tu personaje en esta campaña<select class="field" id="campChar">' + chars.map(function(c){ return '<option value="' + attr(c.id) + '"' + (c.active ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></label><p class="note">Cambiarlo cambia la hoja que ven los demás.</p>'});
    h += fold('pj-camp', {icon:'i-banner', title:'La campaña', sum:'Código, quién está y salir', body:'<p class="note">Comparte el código <b class="camp-code">' + esc(r.code) + '</b> con quien falte.</p><div class="dm-row"><button class="btn" type="button" data-act="campshare">Compartir código</button><button class="btn" type="button" data-act="campforget" data-code="' + attr(r.code) + '">Salir de la campaña</button></div>'});
    return h;
  }

  function dmPanel(r, players, on){
    var maps = r.maps || [], sn = sceneName(r), npcs = r.npcs || [], pcsReady = players.filter(function(m){ return m.init != null; }).length;
    var bs = r.beasts || [], hid = bs.filter(function(b){ return b.hidden; }).length, h = '<div class="dm-panel">';
    // Sesión
    h += fold('dm-ses', {cls:'dm-box', icon:'i-play', title:'Sesión', open:true, sum: r.live ? '<span class="ok">Sesión ' + r.session.n + ' en curso</span>' + (r.session.title ? ' · ' + esc(r.session.title) : '') : 'Fuera de sesión · lista para la ' + (r.session.n + 1), body: r.live
      ? '<form class="dm-row" data-form="campsestitle"><input class="field" name="title" id="campSesTitle" value="' + attr(r.session.title || '') + '" placeholder="Título (La cripta de Vel)" aria-label="Título de la sesión" autocomplete="off"><button class="btn sm" type="submit">Guardar</button></form><button class="btn dm-huge end" type="button" data-act="campsesend"><svg class="ic"><use href="#i-stop"/></svg>Terminar la sesión ' + r.session.n + '</button><p class="note">Al terminar, cada quien guarda el resumen en sus Notas. La campaña sigue abierta.</p>'
      : '<form data-form="campsesstart" class="dm-col"><input class="field" name="title" value="' + attr(r.session.title || '') + '" placeholder="Título de la sesión (opcional)" aria-label="Título de la sesión" autocomplete="off"><button class="btn main dm-huge" type="submit"><svg class="ic"><use href="#i-play"/></svg>Empezar la sesión ' + (r.session.n + 1) + '</button></form>'});
    // Mapa en pantalla
    h += fold('dm-map', {cls:'dm-box', icon:'i-map', title:'Mapa en pantalla', sum: sn ? 'Todos ven: ' + esc(sn) : maps.length ? 'Nadie tiene un mapa en pantalla' : 'Aún no hay mapas', body: maps.length
      ? '<div class="dm-row"><select class="field" id="campScene" aria-label="Mapa">' + maps.map(function(m){ return '<option value="' + attr(m.id) + '"' + (m.id === r.scene ? ' selected' : '') + '>' + esc(m.name) + (m.hidden ? ' (oculto)' : '') + '</option>'; }).join('') + '</select></div><div class="dm-row"><button class="btn main" type="button" data-act="campscene">Mostrar a todos</button><button class="btn" type="button" data-act="campopenmap">Abrir</button>' + (r.scene ? '<button class="btn" type="button" data-act="campscenex">Quitar</button>' : '') + '</div><p class="note">Los mapas ocultos solo los ves tú.</p>'
      : '<p class="note">Crea uno en blanco o súbelo desde una imagen.</p><button class="btn main" type="button" data-act="campgo" data-v="mapas">Ir a Mapas</button>'});
    // Combate
    h += fold('dm-fight', {cls:'dm-box', icon:'i-swords', title:'Combate', sum: r.round ? 'Ronda ' + r.round + (r.turnId ? ' · turno de ' + esc(nameOf(r, r.turnId)) : '') : npcs.length + ' enemigo' + (npcs.length === 1 ? '' : 's') + ' · ' + pcsReady + ' con iniciativa', body:'<div class="dm-row">'
      + (r.round ? '<button class="btn main dm-huge" type="button" data-act="salaturn" data-v="next"><svg class="ic"><use href="#i-next"/></svg>Siguiente turno</button>' : '<button class="btn main" type="button" data-act="salaturn" data-v="start"' + (r.order.length ? '' : ' disabled') + '>Empezar combate</button>')
      + '<button class="btn" type="button" data-act="bestopen">Del bestiario</button><button class="btn" type="button" data-act="campgo" data-v="combate">Ver iniciativa</button>' + (r.round ? '<button class="btn" type="button" data-act="salaend">Terminar combate</button>' : '') + '</div>' + (r.scene ? '<p class="note">Con un mapa en pantalla, el combate también se lleva desde el mapa.</p>' : '')});
    // Bestiario del grupo
    h += fold('dm-best', {cls:'dm-box', icon:'i-paw', title:'Bestiario del grupo', sum: bs.length + ' criatura' + (bs.length === 1 ? '' : 's') + (hid ? ' · ' + hid + ' en preparación' : ''), body:'<div class="dm-row"><button class="btn main" type="button" data-act="grnew">Registrar criatura</button><button class="btn" type="button" data-act="campgo" data-v="bestiario">Abrir</button></div><label class="toggle"><input type="checkbox" id="campAuto"' + (r.autoBeasts ? ' checked' : '') + '> Anotar solos los monstruos de los manuales cuando entran al combate</label>'});
    // Jugadores y ajustes
    h += fold('dm-set', {cls:'dm-box', icon:'i-gear', title:'Jugadores y ajustes', sum: players.length + ' jugador' + (players.length === 1 ? '' : 'es') + ' · ' + on + ' conectado' + (on === 1 ? '' : 's'), body:
      '<span class="label">jugadores</span>' + (players.map(function(m){ return '<div class="line"><span class="camp-av sm">' + esc(initials(m.char ? m.char.name : m.name)) + '</span><span style="flex:1;min-width:0"><b>' + esc(m.char ? m.char.name : m.name) + '</b><br><small class="muted">' + (m.online ? 'Conectado' : 'Visto ' + ago(m.seen)) + (m.char && m.char.cls ? ' · ' + esc(m.char.cls) : '') + '</small></span><button class="btn sm" type="button" data-act="campkick" data-id="' + attr(m.id) + '">Quitar</button></div>'; }).join('') || '<p class="note">Sin jugadores. Comparte el código <b class="camp-code">' + esc(r.code) + '</b>.</p>')
      + '<span class="label" style="margin-top:10px">campaña</span><form class="dm-row" data-form="campname"><input class="field" name="name" value="' + attr(r.name) + '" aria-label="Nombre de la campaña" autocomplete="off"><button class="btn sm" type="submit">Renombrar</button></form>'
      + '<form class="dm-row" data-form="campkey"><input class="field" name="key" type="password" placeholder="Nueva clave del DM" aria-label="Nueva clave del DM" autocomplete="new-password"><button class="btn sm" type="submit">Cambiar clave</button></form>' + (keyMsg ? '<p class="note">' + esc(keyMsg) + '</p>' : '')});
    return h + '</div>';
  }
  function nameOf(r, id){ var m = r.members.filter(function(x){ return x.id === id; })[0]; if (m) return m.char ? m.char.name : m.name; var n = r.npcs.filter(function(x){ return x.id === id; })[0]; return n ? n.name : ''; }

  /* ---------- Eventos ---------- */
  function go(tab){ if (window.Mesa) Mesa.show(tab); if (tab === 'combate' && window.Diario) Diario.renderCombat(); var r = room(); if (tab === 'mapas' && r && r.scene && r.role !== 'dm' && window.Mapas) Mapas.open(r.scene); }
  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('[data-act]'); if (!b) return;
    var a = b.dataset.act; if (a.indexOf('camp') !== 0) return;
    var r = room();
    if (a === 'campselect') { Sala.clearError(); showList = false; Sala.select(b.dataset.code); render(); }
    else if (a === 'campforget') {
      if (!b.dataset.sure) { b.dataset.sure = 1; if (b.classList.contains('icon-btn')) { b.style.borderColor = 'var(--bad)'; b.setAttribute('aria-label', 'Toca otra vez para olvidarla en este aparato'); } else b.textContent = '¿Seguro? Toca otra vez'; setTimeout(function(){ if (document.contains(b)) { delete b.dataset.sure; render(); } }, 4000); return; }
      Sala.forget(b.dataset.code); showList = false; render();
    }
    else if (a === 'camplist') { showList = true; render(); }
    else if (a === 'campback') { showList = false; render(); }
    else if (a === 'campdmtab') { form.dmTab = b.dataset.v; render(); }
    else if (a === 'campgo') go(b.dataset.v);
    else if (a === 'campshare' && r) { var txt = 'Únete a «' + r.name + '» en el Diario del Aventurero con el código ' + r.code; if (navigator.share) navigator.share({title:r.name, text:txt, url:location.href.split('#')[0]}).catch(function(){}); else if (navigator.clipboard) navigator.clipboard.writeText(r.code).then(function(){ Sala.toast('Código copiado: ' + r.code); }, function(){}); }
    else if (a === 'campsesend') { if (b.dataset.sure) Sala.send({t:'session.end'}); else { b.dataset.sure = 1; b.textContent = '¿Seguro? Toca otra vez para terminar'; setTimeout(function(){ if (document.contains(b)) render(); }, 4000); } }
    else if (a === 'campscene') { var s = $('#campScene'); if (s && s.value) { Sala.send({t:'scene.set', id:s.value}); } }
    else if (a === 'campscenex') Sala.send({t:'scene.set', id:null});
    else if (a === 'campopenmap') { var s2 = $('#campScene'); if (s2 && s2.value && window.Mapas) { go('mapas'); Mapas.open(s2.value); } }
    else if (a === 'campkick') { if (b.dataset.sure) Sala.send({t:'member.del', id:b.dataset.id}); else { b.dataset.sure = 1; b.textContent = '¿Quitar?'; } }
    else if (a === 'campfold') toggleFold(b.dataset.v);
  });
  document.addEventListener('submit', function(ev){
    var f = ev.target, k = f.dataset && f.dataset.form; if (!k || k.indexOf('camp') !== 0) return; ev.preventDefault();
    var v = function(n){ var el = f.elements[n]; return el ? el.value.trim() : ''; }, fail = function(msg, el){ var p = f.querySelector('.err'); if (!p) { p = document.createElement('p'); p.className = 'err'; f.appendChild(p); } p.textContent = msg; if (el) el.focus(); };
    if (k === 'campjoin') { var code = v('code').toUpperCase().replace(/[^A-Z]/g, ''); if (code.length !== 6) return fail('El código tiene 6 letras.', f.elements.code); Sala.clearError(); showList = false; Sala.join(code, {char:v('char') || null}); render(); }
    else if (k === 'campnew') { var key = f.elements.key.value; if (key.length < 4) return fail('La clave necesita al menos 4 caracteres.', f.elements.key); if (key !== f.elements.key2.value) return fail('Las dos claves no coinciden.', f.elements.key2); Sala.clearError(); showList = false; Sala.create(v('name') || 'Nueva campaña', key); render(); }
    else if (k === 'campdmopen') { var c2 = v('code').toUpperCase().replace(/[^A-Z]/g, ''); if (c2.length !== 6) return fail('El código tiene 6 letras.', f.elements.code); if (!f.elements.key.value) return fail('Escribe tu clave de DM.', f.elements.key); Sala.clearError(); showList = false; Sala.join(c2, {dmKey:f.elements.key.value}); render(); }
    else if (k === 'campsesstart') Sala.send({t:'session.start', title:v('title')});
    else if (k === 'campsestitle') { Sala.send({t:'session.title', title:v('title')}); Sala.toast('Título guardado.'); }
    else if (k === 'campname') { if (v('name')) Sala.send({t:'camp.name', name:v('name')}); }
    else if (k === 'campkey') { var nk = f.elements.key.value; if (nk.length < 4) return fail('La clave necesita al menos 4 caracteres.', f.elements.key); if (Sala.send({t:'camp.key', key:nk})) { keyMsg = 'Clave cambiada. Los aparatos donde ya entraste siguen dentro.'; render(); } }
  });
  document.addEventListener('change', function(ev){
    var t = ev.target;
    if (t.id === 'campAuto') Sala.send({t:'beast.auto', value:t.checked});
    else if (t.id === 'campChar' && window.Diario) { if (Diario.useChar(t.value)) { Sala.sync(true); Sala.toast('Ahora juegas con ' + (t.options[t.selectedIndex] || {}).text + '.'); } }
  });
  document.addEventListener('input', function(ev){ if (ev.target.classList && ev.target.classList.contains('camp-codein')) { var p = ev.target.selectionStart; ev.target.value = ev.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6); try { ev.target.setSelectionRange(p, p); } catch(e){} } });

  /* El estado cambia seguido: solo se repinta si Inicio está a la vista y no estás escribiendo en él */
  function refresh(){ if (!visible()) { title(); return; } var a = document.activeElement, b = box(); if (b && a && b.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) { title(); return; } render(); }
  Sala.on('state', refresh); Sala.on('list', refresh); Sala.on('left', function(){ showList = false; refresh(); }); Sala.on('switch', refresh);
  Sala.on('joined', function(m){ showList = false; keyMsg = ''; render(); if (m.created && visible()) render(); });
  Sala.on('error', function(){ refresh(); });
  Sala.on('redraw', function(){ title(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
  return {render:render, title:title};
})();
