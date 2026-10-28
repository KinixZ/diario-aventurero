/* ==================== CONEXIÓN CON LAS CAMPAÑAS ==================== */
/* Se conecta por WebSocket al servidor del proyecto (server/index.mjs). Cada teléfono recuerda las campañas en las
   que está (código, rol y su token para volver sin escribir nada). La hoja de cada jugador sigue siendo la dueña de
   sus PG: cuando alguien te aplica daño o curación, el servidor te lo reenvía, tu hoja lo aplica y manda tu resumen.
   Aquí también vive la lista de iniciativa (Combate → Orden). Usa la API pequeña del diario en window.Diario. */
var Sala = (function(){
  var KEY = 'diario-campanas';
  var COND = {blinded:'Cegado', charmed:'Hechizado', deafened:'Ensordecido', exhaustion:'Cansancio', frightened:'Asustado', grappled:'Agarrado', incapacitated:'Incapacitado', invisible:'Invisible', paralyzed:'Paralizado', petrified:'Petrificado', poisoned:'Envenenado', prone:'Derribado', restrained:'Apresado', stunned:'Aturdido', unconscious:'Inconsciente', concentration:'Concentración'};
  var st = load();
  function load(){
    var s = {}; try { s = JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch(e){ s = {}; }
    if (!Array.isArray(s.list)) s.list = [];
    if (!s.url) { try { var old = JSON.parse(localStorage.getItem('diario-sala') || '{}'); if (old && old.url) s.url = old.url; } catch(e){} }
    return s;
  }
  var hooks = {};
  function on(t, fn){ (hooks[t] = hooks[t] || []).push(fn); }
  function emit(t, m){ (hooks[t] || []).forEach(function(fn){ try { fn(m); } catch(e){ if (window.console) console.warn(e); } }); }
  var ws = null, room = null, status = 'off', lastErr = '', sel = {}, retry = 0, retryT = null, manual = false, toastT = null, lastSent = '', syncT = null, box = null, npcOpen = false, pending = null, durable = true;

  function store(){ try { localStorage.setItem(KEY, JSON.stringify(st)); } catch(e){} }
  function esc(s){ return Render5e.esc(s == null ? '' : s); }
  function attr(s){ return Render5e.attr(s == null ? '' : s); }
  function sgn(n){ return Rules5e.sgn(n); }

  /* ---------- Campañas guardadas en este teléfono ---------- */
  function entry(code){ return st.list.filter(function(e){ return e.code === code; })[0] || null; }
  function upsert(e){ var cur = entry(e.code); if (cur) Object.keys(e).forEach(function(k){ if (e[k] !== undefined) cur[k] = e[k]; }); else { cur = e; st.list.unshift(e); } st.list.sort(function(a, b){ return (b.last || 0) - (a.last || 0); }); store(); return cur; }
  function forget(code){ st.list = st.list.filter(function(e){ return e.code !== code; }); if (st.active === code) st.active = null; store(); }
  function active(){ return st.active ? entry(st.active) : null; }

  /* Dónde está el servidor: el que guardaste en Ajustes, el de la compilación o el mismo sitio que sirve el diario */
  function serverUrl(){
    if (st.url) return st.url;
    if (window.DIARIO_CONFIG && DIARIO_CONFIG.salaUrl) return DIARIO_CONFIG.salaUrl;
    if (window.DIARIO_CONFIG && DIARIO_CONFIG.artifact) return '';
    if (/^https?:$/.test(location.protocol) && !/claude\.ai$|claudeusercontent\.com$|^$/.test(location.hostname)) return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    return '';
  }
  function available(){ return typeof WebSocket !== 'undefined' && !!serverUrl(); }
  function httpBase(){ var u = serverUrl(); return u ? u.replace(/^ws/, 'http').replace(/\/ws$/, '') : ''; }

  function summary(){
    var X = window.Diario; if (!X) return null;
    var C = X.cur(), D = X.D(); if (!C || !D || !D.ok) return null;
    var r = X.rt(C);
    return {name: C.name || 'Sin nombre', cls: D.clsLabel, lvl: D.level, ac: D.ac, hp: r.hp, hpMax: D.hp.max, temp: r.temp || 0, initMod: D.init, speed: parseFloat(String(D.speed).replace(',', '.')) || 9, conc: r.conc ? String(r.conc).split('|')[0] : null, conds: (r.conds || []).slice(), comps: X.compSummaries ? X.compSummaries() : []};
  }

  /* ---------- Conexión ---------- */
  function connect(first){
    var url = serverUrl(); if (!url) { status = 'error'; lastErr = 'Falta la dirección del servidor (Ajustes → Servidor de campañas).'; draw(); return; }
    try { if (ws) { ws.onclose = null; ws.close(); } } catch(e){}
    status = 'connecting'; lastErr = ''; manual = false; pending = first; draw();
    try { ws = new WebSocket(url); } catch(e){ status = 'error'; lastErr = 'No pude abrir la conexión: revisa la dirección.'; draw(); return; }
    ws.onopen = function(){ retry = 0; ws.send(JSON.stringify(first)); };
    ws.onmessage = function(ev){ var m; try { m = JSON.parse(ev.data); } catch(e){ return; } onMsg(m); };
    ws.onclose = function(){
      var wasOn = status === 'on'; ws = null;
      if (manual || !st.active) { status = 'off'; draw(); return; }
      status = 'connecting'; lastErr = wasOn ? 'Se perdió la conexión; reconectando…' : 'No pude conectar con el servidor (puede estar despertando); reintentando…'; draw();
      clearTimeout(retryT); retryT = setTimeout(function(){ rejoin(); }, [1500, 3000, 5000, 10000, 20000][Math.min(retry++, 4)]);
    };
  }
  function rejoin(){ var e = active(); if (!e) return; var s = summary(); if (e.char && window.Diario && Diario.useChar) { Diario.useChar(e.char); s = summary(); } connect({t:'join', code:e.code, token:e.token, name: s ? s.name : 'Jugador', char: e.role === 'dm' ? null : s}); }
  function send(m){ if (ws && ws.readyState === 1 && status === 'on') { ws.send(JSON.stringify(m)); return true; } lastErr = 'Sin conexión con la campaña.'; toast(lastErr); draw(); return false; }

  /* Acciones del selector */
  function select(code){ var e = entry(code); if (!e) return; if (st.active === code && status !== 'off' && status !== 'error') return; disconnect(true); st.active = code; e.last = Date.now(); store(); room = null; sel = {}; emit('switch', e); rejoin(); }
  function createCampaign(name, key){ disconnect(true); st.active = null; store(); room = null; connect({t:'camp.create', name:name, dmKey:key}); }
  function joinCampaign(code, opts){
    opts = opts || {};
    if (opts.char && window.Diario && Diario.useChar) Diario.useChar(opts.char);
    var s = summary(), e = entry(code);
    disconnect(true); room = null; sel = {};
    st.active = code; store();
    connect({t:'join', code:code, token: e && !opts.dmKey ? e.token : null, dmKey: opts.dmKey || null, name: s ? s.name : 'Jugador', char: opts.dmKey ? null : s});
  }
  function disconnect(keepActive){ manual = true; clearTimeout(retryT); try { if (ws) ws.close(); } catch(e){} ws = null; status = 'off'; if (!keepActive) { st.active = null; store(); room = null; emit('left'); } }
  function leaveActive(){ if (status === 'on') { try { ws.send(JSON.stringify({t:'leave'})); } catch(e){} } disconnect(false); draw(); }
  function forgetCampaign(code){ var e = entry(code); if (e && st.active === code && status === 'on' && e.role !== 'dm') { try { ws.send(JSON.stringify({t:'leave', forget:true})); } catch(x){} } if (st.active === code) disconnect(false); forget(code); draw(); emit('list'); }

  function onMsg(m){
    if (m.t === 'joined') {
      var s = summary(), C = window.Diario && Diario.activeId ? Diario.activeId() : null;
      var e = upsert({code:m.code, name:m.name, role:m.role, token:m.token, last:Date.now(), char: m.role === 'dm' ? null : C, missing:false});
      st.active = m.code; store(); durable = m.durable !== false;
      status = 'on'; lastErr = ''; lastSent = ''; pending = null;
      if (m.created) toast('Campaña creada. Comparte el código ' + m.code + ' con tu grupo.');
      if (m.role !== 'dm') sync(true);
      emit('joined', m); emit('list');
    }
    else if (m.t === 'state') { room = m.room; status = 'on'; var en = entry(room.code); if (en && (en.name !== room.name || en.live !== room.live)) { en.name = room.name; en.live = room.live; store(); } Object.keys(sel).forEach(function(k){ if (!exists(k)) delete sel[k]; }); emit('state', m.room); }
    else if (m.t === 'applied') { if (window.Diario) Diario.applyToMe(m); toast(appliedText(m)); }
    else if (m.t === 'yourturn') { toast('¡Es tu turno! Ronda ' + m.round); if (window.Diario && Diario.newTurn) Diario.newTurn(); buzz([120, 60, 120]); }
    else if (m.t === 'live') { if (room && room.role !== 'dm') { toast('El DM empezó la sesión ' + m.n + (m.title ? ': ' + m.title : '') + '.'); buzz([80]); } emit('live', m); }
    else if (m.t === 'kicked') { var k = st.active; toast('El DM te quitó de esta campaña.'); forget(k); disconnect(false); emit('list'); }
    else if (m.t === 'error') {
      lastErr = m.msg || 'Error';
      if (pending && (m.code === 'no_room' || m.code === 'bad_key' || m.code === 'room_full' || m.code === 'bad_key')) {
        // no se pudo entrar: no reintentar
        var code = pending.code; pending = null;
        if (m.code === 'no_room' && code) { var ee = entry(code); if (ee) { ee.missing = true; store(); } }
        if (st.active === code || !code) st.active = null; store();
        disconnect(true); status = 'error'; emit('list');
      }
      else if (m.code === 'not_member') { var c2 = st.active; forget(c2); disconnect(false); toast('Ya no estás en esa campaña.'); emit('list'); }
      else toast(lastErr);
      emit('error', m);
    }
    else emit(m.t, m);
    draw();
  }
  function buzz(p){ try { if (navigator.vibrate) navigator.vibrate(p); } catch(e){} }
  function exists(id){ return room && (room.members.some(function(x){ return x.id === id; }) || room.npcs.some(function(x){ return x.id === id; })); }
  function appliedText(m){
    var a = m.amount, f = m.from || 'Alguien', n = m.note ? ' (' + m.note + ')' : '';
    return {damage: f + ' te hizo ' + a + ' de daño' + n, heal: f + ' te curó ' + a + ' PG' + n, temp: f + ' te dio ' + a + ' PG temporales' + n, 'cond+': f + ' te aplicó ' + (COND[m.cond] || m.cond) + n, 'cond-': f + ' te quitó ' + (COND[m.cond] || m.cond) + n}[m.kind] || 'Cambio en tu hoja';
  }
  function toast(t, action){
    var el = document.getElementById('salaToast'); if (!el) return;
    el.innerHTML = '<span>' + esc(t) + '</span>' + (action ? '<button class="btn sm" type="button" data-act="' + attr(action.act) + '"' + (action.v ? ' data-v="' + attr(action.v) + '"' : '') + '>' + esc(action.label) + '</button>' : '');
    el.hidden = false; clearTimeout(toastT); toastT = setTimeout(function(){ el.hidden = true; }, action ? 7000 : 4500);
  }

  /* Manda tu resumen cuando cambia algo de tu hoja (PG, CA, concentración…) */
  function sync(now){
    if (status !== 'on' || !room || room.role === 'dm') return;
    clearTimeout(syncT);
    syncT = setTimeout(function(){ var s = summary(); if (!s) return; var j = JSON.stringify(s); if (j === lastSent) return; lastSent = j; send({t:'char', char:s}); var e = active(); var C = window.Diario && Diario.activeId ? Diario.activeId() : null; if (e && C && e.char !== C) { e.char = C; store(); } }, now ? 0 : 250);
  }

  /* Estado de las campañas guardadas, sin entrar (para el selector) */
  var peekT = 0;
  function peek(force){
    if (!available() || !st.list.length || (!force && Date.now() - peekT < 15000)) return;
    peekT = Date.now();
    fetch(httpBase() + '/api/camp?codes=' + st.list.map(function(e){ return e.code; }).join(','), {cache:'no-store'}).then(function(r){ return r.json(); }).then(function(j){
      (j.campaigns || []).forEach(function(c){ var e = entry(c.code); if (!e) return; if (c.missing) e.missing = true; else { e.missing = false; e.name = c.name; e.live = c.live; e.online = c.online; e.players = c.players; e.ses = c.session; } });
      durable = j.durable !== false; store(); emit('list');
    }).catch(function(){});
  }

  /* ---------- Combate → Orden (lista de iniciativa) ---------- */
  function mount(el){ box = el || null; draw(); }
  function draw(){
    emit('redraw');
    if (!box || !document.contains(box)) { box = document.getElementById('salaBox'); if (!box) { header(); return; } }
    box.innerHTML = status === 'on' && room ? roomHtml() : lobbyHtml();
    header();
  }
  /* Ronda y turno en el encabezado: solo con el combate empezado */
  function header(){
    var on = status === 'on' && room && room.round > 0, t = document.getElementById('roundTxt'), cb = document.getElementById('combat');
    if (cb) { cb.classList.toggle('dm-mode', status === 'on' && !!room && room.role === 'dm'); cb.classList.toggle('in-camp', status === 'on' && !!room); }
    if (window.Diario && Diario.combatRefresh) Diario.combatRefresh();
    if (!t) return;
    t.hidden = !on;
    if (on) { document.getElementById('round').textContent = room.round; var who = room.turnId ? nameOf(room.turnId) : ''; document.getElementById('turnName').textContent = who ? ' · turno de ' + who : ''; }
  }
  function nameOf(id){ var m = room.members.filter(function(x){ return x.id === id; })[0]; if (m) return m.char ? m.char.name : m.name; var n = room.npcs.filter(function(x){ return x.id === id; })[0]; return n ? n.name : ''; }
  function lobbyHtml(){
    var e = active();
    return '<div class="card sala"><div class="row"><span class="label">combate en grupo</span>' + (status === 'connecting' ? '<span class="muted" style="font-size:14px">Conectando…</span>' : '') + '</div>'
      + '<p class="note">' + (e && status === 'connecting' ? 'Entrando a ' + esc(e.name || e.code) + '…' : 'El orden de iniciativa, los enemigos y los turnos se comparten dentro de una campaña. Mientras tanto, Mi turno y Recursos funcionan con tu hoja.') + '</p>'
      + (e && status === 'connecting' ? '' : '<button class="btn main" type="button" data-act="mesatab" data-v="inicio">Elegir campaña</button>')
      + (lastErr ? '<p class="err">' + esc(lastErr) + '</p>' : '') + '</div>';
  }
  function roomHtml(){
    var R0 = room, me = R0.members.filter(function(x){ return x.id === R0.you; })[0] || {}, dm = R0.role === 'dm';
    var all = {}; R0.members.forEach(function(m){ if (m.role !== 'dm') all[m.id] = {id:m.id, pc:true, m:m}; }); R0.npcs.forEach(function(n){ all[n.id] = {id:n.id, pc:false, n:n}; });
    var ordered = R0.order.map(function(id){ return all[id]; }).filter(Boolean), rest = Object.keys(all).map(function(k){ return all[k]; }).filter(function(x){ return R0.order.indexOf(x.id) < 0; });
    var myTurn = R0.turnId === R0.you;
    var h = '<div class="card sala on"><div class="sala-h"><div><span class="label">' + esc(R0.name) + '</span><b class="sala-code">' + esc(R0.code) + '</b></div><div class="sala-round">' + (R0.round ? 'Ronda <b>' + R0.round + '</b>' : 'Sin combate') + '</div></div>';
    if (myTurn) h += '<div class="sala-myturn">Es tu turno<button class="btn main sm" type="button" data-act="salaturn" data-v="next">Terminar mi turno</button></div>';
    if (!dm && me.init == null) { var s = summary(); h += '<form class="sala-initf" data-form="salainit"><span>Iniciativa: tira 1d20 ' + (s ? sgn(s.initMod).replace('+', '+ ').replace('−', '− ') : '') + '</span><input class="field" name="v" inputmode="numeric" autocomplete="off" placeholder="Total" aria-label="Tu iniciativa"><button class="btn main sm" type="submit">Listo</button></form>'; }
    if (dm) h += '<div class="sala-dm">' + (R0.round ? '<button class="btn sm" type="button" data-act="salaturn" data-v="prev">Anterior</button><button class="btn main sm" type="button" data-act="salaturn" data-v="next">Siguiente turno</button><button class="btn sm" type="button" data-act="salaend">Terminar combate</button>' : '<button class="btn main sm" type="button" data-act="salaturn" data-v="start"' + (R0.order.length ? '' : ' disabled title="Primero pongan iniciativa"') + '>Empezar combate</button>') + '<button class="btn sm" type="button" data-act="bestopen">Del bestiario</button><button class="btn sm" type="button" data-act="salanpc">' + (npcOpen ? 'Cerrar' : 'Enemigo a mano') + '</button><button class="btn sm" type="button" data-act="salaenc" aria-pressed="' + encOpen + '">Encuentros</button></div>'
      + '<div class="sala-dmopts"><label>Los jugadores ven la vida de los enemigos<select class="field" id="salaNpcHp">' + NPC_HP.map(function(x){ return '<option value="' + x[0] + '"' + ((R0.npcHp || 'state') === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label><label class="toggle"><input type="checkbox" data-act="salahide"' + (R0.hidePc ? ' checked' : '') + '> Ocultar PG del grupo</label></div>'
      + (encOpen ? encHtml() : '')
      + (R0.round ? '' : '<p class="note" style="margin-top:6px">' + (R0.order.length ? 'Cuando todos tengan iniciativa, empieza el combate.' : 'Los jugadores ponen su iniciativa; a los enemigos se la pones tú en su fila.') + '</p>');
    if (dm && npcOpen) h += '<form class="sala-npc" data-form="salanpc"><input class="field" name="name" placeholder="Nombre (Goblin)" aria-label="Nombre del enemigo" autocomplete="off"><input class="field" name="ac" inputmode="numeric" placeholder="CA" aria-label="CA"><input class="field" name="hp" inputmode="numeric" placeholder="PG" aria-label="PG"><input class="field" name="init" inputmode="numeric" placeholder="Inic." aria-label="Iniciativa"><input class="field" name="count" inputmode="numeric" placeholder="×1" aria-label="Cantidad"><label class="toggle"><input type="checkbox" name="hidden"> Oculto</label><button class="btn main sm" type="submit">Agregar</button></form>';
    h += '<div class="sala-list" role="list">' + ordered.map(function(x){ return rowHtml(x, dm, true); }).join('') + (rest.length ? '<div class="sala-sep">Sin iniciativa</div>' + rest.map(function(x){ return rowHtml(x, dm, false); }).join('') : '') + (!ordered.length && !rest.length ? '<p class="note">Todavía no hay nadie más. Comparte el código desde Inicio.</p>' : '') + '</div>';
    var n = Object.keys(sel).length;
    if (n) h += '<form class="sala-apply" data-form="salaapply"><div class="sala-apply-h"><b>' + n + ' seleccionado' + (n > 1 ? 's' : '') + '</b><button class="pill" type="button" data-act="salaclear">Quitar selección</button></div>'
      + '<div class="sala-apply-row"><input class="field" name="amount" inputmode="numeric" autocomplete="off" placeholder="Total" aria-label="Cantidad"><button class="btn dmg" type="submit" data-kind="damage">Daño</button><button class="btn heal" type="submit" data-kind="heal">Curar</button><button class="btn" type="submit" data-kind="temp">Temp.</button></div>'
      + '<div class="sala-apply-row"><select class="field" name="cond" aria-label="Condición"><option value="">Condición…</option>' + Object.keys(COND).map(function(k){ return '<option value="' + k + '">' + COND[k] + '</option>'; }).join('') + '</select><button class="btn" type="submit" data-kind="cond+">Aplicar</button><button class="btn" type="submit" data-kind="cond-">Quitar</button></div>'
      + '<input class="field" name="note" maxlength="80" autocomplete="off" placeholder="De qué (Bola de fuego, Palabra de curación…)" aria-label="Nota"></form>';
    h += '<details class="feat-d sala-log"><summary><b>Registro</b><small>' + R0.log.length + ' eventos</small></summary><div style="padding:0 12px 10px">' + R0.log.slice().reverse().map(function(l){ return '<p class="note" style="margin:4px 0">' + esc(l.text) + '</p>'; }).join('') + '</div></details>';
    return h + '</div>';
  }
  /* ---------- Encuentros guardados (en este dispositivo del DM) ---------- */
  var ENC_KEY = 'diario-encuentros', encOpen = false;
  var NPC_HP = [['none','Nada'],['state','Cómo se ve (herido…)'],['bar','Solo la barra'],['pct','Barra y porcentaje'],['num','Los números']];
  function encList(){ try { return JSON.parse(localStorage.getItem(ENC_KEY) || '[]'); } catch(e){ return []; } }
  function encSave(a){ try { localStorage.setItem(ENC_KEY, JSON.stringify(a)); return true; } catch(e){ return false; } }
  function encounter(name){
    if (!room) return null;
    var pcInit = {}; room.members.forEach(function(m){ if (m.char && m.init != null) pcInit[m.char.name] = m.init; });
    return {name: name || '', round: room.round, turnName: room.turnId ? nameOf(room.turnId) : '', pcInit: pcInit, npcHp: room.npcHp,
      npcs: room.npcs.map(function(n){ return {name:n.name, ac:n.ac, hp:n.hp, hpMax:n.hpMax, temp:n.temp, init:n.init, conds:n.conds, hidden:n.hidden, ref:n.ref, initMod:n.initMod, formula:n.formula}; })};
  }
  function encHtml(){
    var L = encList();
    return '<div class="sala-enc card"><form class="sala-encf" data-form="salaencsave"><input class="field" name="name" placeholder="Nombre (Emboscada en el puente)" aria-label="Nombre del encuentro" autocomplete="off"><button class="btn main sm" type="submit"' + (room.npcs.length ? '' : ' disabled') + '>Guardar este</button></form>'
      + '<p class="note">Guarda enemigos con su vida y estados, la iniciativa de todos, la ronda y de quién es el turno. Sirve para prepararlo antes de la sesión.</p>'
      + (L.length ? L.map(function(e){ return '<div class="line"><span style="flex:1;min-width:0"><b>' + esc(e.name) + '</b><br><small class="muted">' + e.enc.npcs.length + ' enemigo' + (e.enc.npcs.length === 1 ? '' : 's') + (e.enc.round ? ' · ronda ' + e.enc.round : ' · sin empezar') + ' · ' + new Date(e.at).toLocaleDateString('es-MX', {day:'numeric', month:'short'}) + '</small></span><button class="btn sm" type="button" data-act="salaencload" data-id="' + attr(e.id) + '">Cargar</button><button class="icon-btn" type="button" data-act="salaencdel" data-id="' + attr(e.id) + '" aria-label="Borrar ' + attr(e.name) + '"><svg class="ic"><use href="#i-x"/></svg></button></div>'; }).join('') : '<p class="note">Todavía no hay encuentros guardados.</p>') + '</div>';
  }
  function npcHpHtml(n){
    var show = n.show || (n.state ? 'state' : 'none');
    if (n.state === 'caído') return '<span class="sala-state down">caído</span>';
    if (show === 'none') return '<span class="sala-state">?</span>';
    if (show === 'state') return '<span class="sala-state">' + esc(n.state || '') + '</span>';
    if (show === 'num') return bar(n.hp, n.hpMax, n.temp);
    var p = n.pct || 0, c = p <= 33 ? 'var(--bad)' : p <= 66 ? 'var(--warn)' : 'var(--ok)';
    return '<div class="bar"><i style="width:' + p + '%;background:' + c + '"></i></div>' + (show === 'pct' ? '<span class="sala-hp">' + p + '%</span>' : '');
  }
  function bar(hp, max, temp){ var p = Math.max(0, Math.min(100, Math.round(hp / max * 100))), c = p <= 33 ? 'var(--bad)' : p <= 66 ? 'var(--warn)' : 'var(--ok)'; return '<div class="bar"><i style="width:' + p + '%;background:' + c + '"></i></div><span class="sala-hp">' + hp + '/' + max + (temp ? ' +' + temp : '') + '</span>'; }
  function rowHtml(x, dm, inOrder){
    var turn = room.turnId === x.id, on = !!sel[x.id], name, sub, hp = '', ac = '', conds = [], init;
    if (x.pc) { var m = x.m, c = m.char || {}; name = c.name || m.name; sub = (c.cls || '') + (m.online ? '' : ' · desconectado'); ac = c.ac; init = m.init; conds = (c.conds || []).slice(); if (c.conc) conds.push('concentration'); hp = c.hp == null ? '<span class="sala-state">PG ocultos</span>' : bar(c.hp, c.hpMax, c.temp); if (c.comps && c.comps.length) sub += ' · ' + c.comps.map(function(k){ return k.name + ' ' + k.hp + '/' + k.hpMax; }).join(', '); }
    else { var n = x.n; name = n.name; init = n.init; conds = n.conds || []; if (dm) { ac = n.ac; hp = bar(n.hp, n.hpMax, n.temp); sub = (n.hidden ? 'oculto para los jugadores' : 'enemigo') + (n.init == null && n.ref ? ' · inic. 1d20 ' + sgn(n.initMod || 0).replace('+', '+ ').replace('−', '− ') : ''); } else { sub = 'enemigo'; hp = npcHpHtml(n); } }
    var me = x.id === room.you;
    var pickable = !(dm && x.pc);
    var h = '<div class="sala-row' + (turn ? ' turn' : '') + (on ? ' sel' : '') + (x.pc ? '' : ' npc') + '" role="listitem"><button type="button" class="sala-pick" ' + (pickable ? 'data-act="salasel" data-id="' + attr(x.id) + '" aria-pressed="' + on + '" aria-label="Seleccionar a ' + attr(name) + '"' : 'tabindex="-1" aria-disabled="true"') + '><span class="sala-init">' + (init == null ? '–' : init) + '</span><span class="sala-name"><b>' + esc(name) + (me ? ' <small>(tú)</small>' : '') + '</b><small>' + esc(sub || '') + '</small></span>' + (ac !== '' && ac != null ? '<span class="sala-ac">' + ac + '</span>' : '') + '</button><div class="sala-hpbox">' + hp + '</div>';
    var dmNpc = dm && !x.pc;
    if (conds.length) h += '<div class="sala-conds">' + conds.map(function(k){ return dmNpc ? '<button type="button" class="chip" data-act="salacondoff" data-id="' + attr(x.id) + '" data-v="' + k + '" aria-label="Quitar ' + attr(COND[k] || k) + ' a ' + attr(name) + '">' + esc(COND[k] || k) + ' ×</button>' : '<span class="chip">' + esc(COND[k] || k) + '</span>'; }).join('') + '</div>';
    if (dmNpc) {
      var n2 = x.n;
      h += '<div class="sala-npcedit"><div class="quick"><button type="button" class="m" data-act="salanpchp" data-id="' + attr(x.id) + '" data-v="-10">−10</button><button type="button" class="m" data-act="salanpchp" data-id="' + attr(x.id) + '" data-v="-5">−5</button><button type="button" class="m" data-act="salanpchp" data-id="' + attr(x.id) + '" data-v="-1">−1</button><button type="button" class="p" data-act="salanpchp" data-id="' + attr(x.id) + '" data-v="1">+1</button><button type="button" class="p" data-act="salanpchp" data-id="' + attr(x.id) + '" data-v="5">+5</button></div>'
        + '<div class="sala-npcf"><label>PG<input class="field" data-npcset="hp" data-id="' + attr(x.id) + '" inputmode="numeric" value="' + n2.hp + '" aria-label="PG de ' + attr(name) + '"></label><label>Máx.<input class="field" data-npcset="hpMax" data-id="' + attr(x.id) + '" inputmode="numeric" value="' + n2.hpMax + '" aria-label="PG máximos de ' + attr(name) + '"></label><label>CA<input class="field" data-npcset="ac" data-id="' + attr(x.id) + '" inputmode="numeric" value="' + n2.ac + '" aria-label="CA de ' + attr(name) + '"></label><label>Inic.<input class="field" data-salainit="' + attr(x.id) + '" inputmode="numeric" value="' + (init == null ? '' : init) + '" aria-label="Iniciativa de ' + attr(name) + '"></label></div>'
        + '<div class="sala-npcf"><select class="field" data-npccond="' + attr(x.id) + '" aria-label="Agregar estado a ' + attr(name) + '"><option value="">+ Estado…</option>' + Object.keys(COND).filter(function(k){ return (n2.conds || []).indexOf(k) < 0; }).map(function(k){ return '<option value="' + k + '">' + COND[k] + '</option>'; }).join('') + '</select>' + (n2.ref ? '<button class="btn sm" type="button" data-act="bestref" data-ref="' + attr(n2.ref) + '">Ficha</button>' : '') + '<button class="btn sm" type="button" data-act="salareveal" data-id="' + attr(x.id) + '">' + (n2.hidden ? 'Mostrar' : 'Ocultar') + '</button><button class="btn sm" type="button" data-act="salanpcdel" data-id="' + attr(x.id) + '">Quitar</button></div></div>';
    } else if (dm && x.pc) h += '<div class="sala-rowdm"><label class="muted" style="font-size:14px">Inic. <input class="field" data-salainit="' + attr(x.id) + '" inputmode="numeric" value="' + (init == null ? '' : init) + '" aria-label="Iniciativa de ' + attr(name) + '"></label></div>';
    return h + '</div>';
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('[data-act]'); if (!b || b.dataset.act.indexOf('sala') !== 0) return;
    var a = b.dataset.act;
    if (a === 'salasel') { var id = b.dataset.id; if (sel[id]) delete sel[id]; else sel[id] = 1; draw(); }
    else if (a === 'salaclear') { sel = {}; draw(); }
    else if (a === 'salaturn') send({t:'turn', dir: b.dataset.v});
    else if (a === 'salaend') send({t:'end'});
    else if (a === 'salanpc') { npcOpen = !npcOpen; draw(); }
    else if (a === 'salaenc') { encOpen = !encOpen; draw(); }
    else if (a === 'salaencload') { var e = encList().filter(function(x){ return x.id === b.dataset.id; })[0]; if (e) { if (b.dataset.sure || !room.npcs.length) { send({t:'enc.load', enc:e.enc}); if (e.enc.npcHp) send({t:'npchp', value:e.enc.npcHp}); encOpen = false; toast('Encuentro cargado: ' + e.name); } else { b.dataset.sure = 1; b.textContent = '¿Reemplazar los enemigos de ahora?'; } } }
    else if (a === 'salaencdel') { if (b.dataset.sure) { encSave(encList().filter(function(x){ return x.id !== b.dataset.id; })); draw(); } else { b.dataset.sure = 1; b.style.borderColor = 'var(--bad)'; b.setAttribute('aria-label', 'Toca otra vez para borrar'); } }
    else if (a === 'salanpcdel') send({t:'npc.del', id: b.dataset.id});
    else if (a === 'salareveal') send({t:'npc.reveal', id: b.dataset.id});
    else if (a === 'salahide') send({t:'hidepc', value: b.checked});
    else if (a === 'salanpchp') send({t:'npc.set', id: b.dataset.id, delta: +b.dataset.v});
    else if (a === 'salacondoff') { var nn = room.npcs.filter(function(x){ return x.id === b.dataset.id; })[0]; if (nn) send({t:'npc.set', id: nn.id, conds: (nn.conds || []).filter(function(k){ return k !== b.dataset.v; })}); }
  });
  document.addEventListener('submit', function(ev){
    var f = ev.target, kind = f.dataset && f.dataset.form; if (!kind || kind.indexOf('sala') !== 0) return;
    ev.preventDefault(); lastErr = '';
    var v = function(n){ var el = f.elements[n]; return el ? (el.type === 'checkbox' ? el.checked : el.value.trim()) : ''; };
    if (kind === 'salainit') { var n = parseInt(v('v'), 10); if (!(n > -20 && n < 60)) { lastErr = 'Escribe el total de tu tirada.'; draw(); return; } send({t:'init', value:n}); }
    else if (kind === 'salaencsave') { var nm = v('name') || 'Encuentro del ' + new Date().toLocaleDateString('es-MX'), L = encList(); L.unshift({id:'e' + Date.now().toString(36), name:nm, at:Date.now(), enc:encounter(nm)}); if (encSave(L.slice(0, 40))) toast('Guardado: ' + nm); else lastErr = 'No hay espacio para guardar el encuentro.'; draw(); }
    else if (kind === 'salanpc') { if (!v('hp')) { lastErr = 'Ponle PG al enemigo.'; draw(); return; } send({t:'npc.add', name:v('name'), ac:v('ac'), hp:v('hp'), init:v('init'), count:v('count') || 1, hidden:v('hidden')}); npcOpen = false; }
    else if (kind === 'salaapply') {
      var k = ev.submitter && ev.submitter.dataset.kind || 'damage', amt = parseInt(v('amount'), 10), cond = v('cond');
      if ((k === 'damage' || k === 'heal' || k === 'temp') && !(amt > 0)) { lastErr = 'Escribe la cantidad que sacaste en tus dados.'; draw(); return; }
      if ((k === 'cond+' || k === 'cond-') && !cond) { lastErr = 'Elige una condición.'; draw(); return; }
      if (send({t:'apply', kind:k, amount:amt || 0, cond:cond || null, note:v('note'), targets:Object.keys(sel)})) sel = {};
    }
  });
  document.addEventListener('change', function(ev){
    var t = ev.target; if (!t.dataset) return;
    if (t.dataset.salainit) send({t:'init', id:t.dataset.salainit, value:t.value.trim()});
    else if (t.id === 'salaNpcHp') send({t:'npchp', value:t.value});
    else if (t.dataset.npcset) { var o = {t:'npc.set', id:t.dataset.id}; o[t.dataset.npcset] = t.value.trim(); if (o[t.dataset.npcset] !== '') send(o); }
    else if (t.dataset.npccond && t.value) { var nn = room && room.npcs.filter(function(x){ return x.id === t.dataset.npccond; })[0]; if (nn) send({t:'npc.set', id:nn.id, conds:(nn.conds || []).concat([t.value])}); }
  });

  /* Ajustes: dirección del servidor */
  function settings(){
    var i = document.getElementById('salaUrl'); if (!i) return;
    i.value = st.url || ''; i.placeholder = (window.DIARIO_CONFIG && DIARIO_CONFIG.salaUrl) || serverUrl() || 'wss://tu-servidor.onrender.com/ws';
    var s = document.getElementById('salaStatus'); if (s) s.textContent = available() ? 'Se conectará a ' + serverUrl() : 'Sin servidor: escribe la dirección para jugar en grupo.';
  }
  document.addEventListener('change', function(ev){ if (ev.target.id === 'salaUrl') { var u = ev.target.value.trim(); if (u && !/^wss?:\/\//.test(u)) u = (/^localhost|^127\./.test(u) ? 'ws://' : 'wss://') + u.replace(/^https?:\/\//, ''); if (u && !/\/ws$/.test(u)) u = u.replace(/\/$/, '') + '/ws'; st.url = u || null; store(); settings(); } });

  /* Al abrir el diario, si estabas en una campaña, vuelve a entrar sola */
  function resume(){ if (st.active && active() && available() && status === 'off') rejoin(); }

  return {encounter:encounter, mount:mount, sync:sync, settings:settings, resume:resume, status:function(){ return status; }, room:function(){ return room; }, on:on, send:send, toast:toast, httpBase:httpBase,
    code:function(){ return st.active; }, token:function(){ var e = active(); return e ? e.token : null; }, role:function(){ var e = active(); return e ? e.role : null; }, redraw:function(){ draw(); },
    list:function(){ return st.list.slice(); }, active:active, select:select, create:createCampaign, join:joinCampaign, leave:leaveActive, forget:forgetCampaign, peek:peek, available:available,
    error:function(){ return lastErr; }, clearError:function(){ lastErr = ''; }, durable:function(){ return durable; }, summary:summary, COND:COND};
})();
