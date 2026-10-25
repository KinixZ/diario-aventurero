
/* ==================== SALA DE COMBATE COMPARTIDA ==================== */
/* Se conecta por WebSocket al servidor del proyecto (server/index.mjs). La hoja de cada jugador sigue
   siendo la dueña de sus PG: cuando alguien te aplica daño o curación, el servidor te lo reenvía, tu hoja
   lo aplica y manda tu resumen actualizado. Usa la API pequeña que expone el diario en window.Diario. */
var Sala = (function(){
  var KEY = 'diario-sala';
  var COND = {blinded:'Cegado', charmed:'Hechizado', deafened:'Ensordecido', exhaustion:'Agotamiento', frightened:'Asustado', grappled:'Agarrado', incapacitated:'Incapacitado', invisible:'Invisible', paralyzed:'Paralizado', petrified:'Petrificado', poisoned:'Envenenado', prone:'Derribado', restrained:'Apresado', stunned:'Aturdido', unconscious:'Inconsciente', concentration:'Concentración'};
  var st = {}; try { st = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch(e){ st = {}; }
  var ws = null, room = null, status = 'off', lastErr = '', sel = {}, retry = 0, retryT = null, manual = false, toastT = null, lastSent = '', syncT = null, box = null, npcOpen = false;

  function store(){ try { localStorage.setItem(KEY, JSON.stringify(st)); } catch(e){} }
  function esc(s){ return Render5e.esc(s == null ? '' : s); }
  function attr(s){ return Render5e.attr(s == null ? '' : s); }
  function sgn(n){ return Rules5e.sgn(n); }

  /* Dónde está el servidor: el que guardaste en Ajustes, el de la compilación o el mismo sitio que sirve el diario */
  function serverUrl(){
    if (st.url) return st.url;
    if (window.DIARIO_CONFIG && DIARIO_CONFIG.salaUrl) return DIARIO_CONFIG.salaUrl;
    if (window.DIARIO_CONFIG && DIARIO_CONFIG.artifact) return '';
    if (/^https?:$/.test(location.protocol) && !/claude\.ai$|claudeusercontent\.com$|^$/.test(location.hostname)) return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    return '';
  }
  function available(){ return typeof WebSocket !== 'undefined' && !!serverUrl(); }

  function summary(){
    var X = window.Diario; if (!X) return null;
    var C = X.cur(), D = X.D(); if (!C || !D || !D.ok) return null;
    var r = X.rt(C);
    return {name: C.name || 'Sin nombre', cls: D.clsLabel, lvl: D.level, ac: D.ac, hp: r.hp, hpMax: D.hp.max, temp: r.temp || 0, initMod: D.init, conc: r.conc ? String(r.conc).split('|')[0] : null, conds: (r.conds || []).slice(), comps: X.compSummaries ? X.compSummaries() : []};
  }

  function connect(first){
    var url = serverUrl(); if (!url) { status = 'error'; lastErr = 'Falta la dirección del servidor de salas (Ajustes → Salas de combate).'; draw(); return; }
    try { if (ws) { ws.onclose = null; ws.close(); } } catch(e){}
    status = 'connecting'; lastErr = ''; manual = false; draw();
    try { ws = new WebSocket(url); } catch(e){ status = 'error'; lastErr = 'No pude abrir la conexión: revisa la dirección.'; draw(); return; }
    ws.onopen = function(){ retry = 0; ws.send(JSON.stringify(first)); };
    ws.onmessage = function(ev){ var m; try { m = JSON.parse(ev.data); } catch(e){ return; } onMsg(m); };
    ws.onclose = function(){
      var wasOn = status === 'on'; ws = null;
      if (manual || !st.code) { status = 'off'; draw(); return; }
      status = 'connecting'; lastErr = wasOn ? 'Se perdió la conexión; reconectando…' : 'No pude conectar con el servidor; reintentando…'; draw();
      clearTimeout(retryT); retryT = setTimeout(function(){ rejoin(); }, [1000, 2000, 5000, 10000, 20000][Math.min(retry++, 4)]);
    };
  }
  function rejoin(){ var s = summary(); connect({t:'join', code: st.code, token: st.token, name: s ? s.name : 'Jugador', char: s, dm: st.role === 'dm'}); }
  function send(m){ if (ws && ws.readyState === 1) { ws.send(JSON.stringify(m)); return true; } lastErr = 'Sin conexión con la sala.'; draw(); return false; }

  function onMsg(m){
    if (m.t === 'joined') { st.code = m.code; st.token = m.token; st.role = m.role; store(); status = 'on'; lastErr = ''; lastSent = ''; if (m.role === 'dm') { /* el DM no manda hoja */ } else sync(true); }
    else if (m.t === 'state') { room = m.room; status = 'on'; Object.keys(sel).forEach(function(k){ if (!exists(k)) delete sel[k]; }); }
    else if (m.t === 'applied') { if (window.Diario) Diario.applyToMe(m); toast(appliedText(m)); }
    else if (m.t === 'yourturn') { toast('¡Es tu turno! Ronda ' + m.round); if (window.Diario && Diario.newTurn) Diario.newTurn(); try { if (navigator.vibrate) navigator.vibrate([120, 60, 120]); } catch(e){} }
    else if (m.t === 'error') { lastErr = m.msg || 'Error'; if (m.code === 'no_room' || m.code === 'not_member') { st.code = null; st.token = null; store(); room = null; manual = true; try { ws.close(); } catch(e){} status = 'off'; } }
    draw();
  }
  function exists(id){ return room && (room.members.some(function(x){ return x.id === id; }) || room.npcs.some(function(x){ return x.id === id; })); }
  function appliedText(m){
    var a = m.amount, f = m.from || 'Alguien', n = m.note ? ' (' + m.note + ')' : '';
    return {damage: f + ' te hizo ' + a + ' de daño' + n, heal: f + ' te curó ' + a + ' PG' + n, temp: f + ' te dio ' + a + ' PG temporales' + n, 'cond+': f + ' te aplicó ' + (COND[m.cond] || m.cond) + n, 'cond-': f + ' te quitó ' + (COND[m.cond] || m.cond) + n}[m.kind] || 'Cambio en tu hoja';
  }
  function toast(t){ var el = document.getElementById('salaToast'); if (!el) return; el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(function(){ el.hidden = true; }, 4500); }

  /* Manda tu resumen cuando cambia algo de tu hoja (PG, CA, concentración…) */
  function sync(now){
    if (status !== 'on' || st.role === 'dm') return;
    clearTimeout(syncT);
    syncT = setTimeout(function(){ var s = summary(); if (!s) return; var j = JSON.stringify(s); if (j === lastSent) return; lastSent = j; send({t:'char', char:s}); }, now ? 0 : 250);
  }

  /* ---------- Dibujo ---------- */
  function mount(el){ box = el || null; draw(); }
  function draw(){
    if (!box || !document.contains(box)) { box = document.getElementById('salaBox'); if (!box) return; }
    box.innerHTML = status === 'on' && room ? roomHtml() : lobbyHtml();
    header();
  }
  /* Ronda y turno en el encabezado del modo combate: solo dentro de una sala con el combate empezado */
  function header(){
    var on = status === 'on' && room && room.round > 0, t = document.getElementById('roundTxt'), cb = document.getElementById('combat');
    if (cb) cb.classList.toggle('dm-mode', status === 'on' && !!room && room.role === 'dm');
    if (!t) return;
    t.hidden = !on;
    if (on) { document.getElementById('round').textContent = room.round; var who = room.turnId ? nameOf(room.turnId) : ''; document.getElementById('turnName').textContent = who ? ' · turno de ' + who : ''; }
  }
  function nameOf(id){ var m = room.members.filter(function(x){ return x.id === id; })[0]; if (m) return m.char ? m.char.name : m.name; var n = room.npcs.filter(function(x){ return x.id === id; })[0]; return n ? n.name : ''; }
  function lobbyHtml(){
    var h = '<div class="card sala"><div class="row"><span class="label">sala de combate</span>' + (status === 'connecting' ? '<span class="muted" style="font-size:14px">Conectando…</span>' : '') + '</div>';
    if (!available()) h += '<p class="note">Para jugar en grupo abre el diario desde el servidor del proyecto o escribe su dirección en Ajustes → Salas de combate.</p>';
    else {
      h += '<p class="note">Un jugador o el DM crea la sala y comparte el código de 4 letras; los demás entran con él. Cada quien ve los PG, la CA y el turno de todos. Las rondas empiezan cuando el DM inicia el combate.</p>'
        + '<div class="sala-join"><input class="field" id="salaCode" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="CÓDIGO" aria-label="Código de la sala" value="' + attr(st.code || '') + '"><button class="btn main" type="button" data-act="salajoin">Entrar</button></div>'
        + '<div class="row" style="gap:8px;margin-top:8px"><button class="btn" type="button" data-act="salacreate" style="flex:1">Crear sala</button><label class="toggle" style="flex:1"><input type="checkbox" id="salaDm"' + (st.role === 'dm' ? ' checked' : '') + '> Soy el DM</label></div><p class="note" style="font-size:14px">Como DM no necesitas hoja: agregas enemigos, llevas su vida y sus estados, y pasas los turnos.</p>';
    }
    if (lastErr) h += '<p class="err">' + esc(lastErr) + '</p>';
    return h + '</div>';
  }
  function roomHtml(){
    var R0 = room, me = R0.members.filter(function(x){ return x.id === R0.you; })[0] || {}, dm = R0.role === 'dm';
    var all = {}; R0.members.forEach(function(m){ if (m.role !== 'dm') all[m.id] = {id:m.id, pc:true, m:m}; }); R0.npcs.forEach(function(n){ all[n.id] = {id:n.id, pc:false, n:n}; });
    var ordered = R0.order.map(function(id){ return all[id]; }).filter(Boolean), rest = Object.keys(all).map(function(k){ return all[k]; }).filter(function(x){ return R0.order.indexOf(x.id) < 0; });
    var myTurn = R0.turnId === R0.you;
    var h = '<div class="card sala on"><div class="sala-h"><div><span class="label">sala</span><b class="sala-code">' + esc(R0.code) + '</b></div><div class="sala-round">' + (R0.round ? 'Ronda <b>' + R0.round + '</b>' : 'Sin iniciar') + '</div><button class="btn sm" type="button" data-act="salashare">Compartir</button><button class="btn sm" type="button" data-act="salaleave">Salir</button></div>';
    if (myTurn) h += '<div class="sala-myturn">Es tu turno<button class="btn main sm" type="button" data-act="salaturn" data-v="next">Terminar mi turno</button></div>';
    if (!dm && me.init == null) { var s = summary(); h += '<form class="sala-initf" data-form="salainit"><span>Iniciativa: tira 1d20 ' + (s ? sgn(s.initMod).replace('+', '+ ').replace('−', '− ') : '') + '</span><input class="field" name="v" inputmode="numeric" autocomplete="off" placeholder="Total" aria-label="Tu iniciativa"><button class="btn main sm" type="submit">Listo</button></form>'; }
    if (dm) h += '<div class="sala-dm">' + (R0.round ? '<button class="btn sm" type="button" data-act="salaturn" data-v="prev">Anterior</button><button class="btn main sm" type="button" data-act="salaturn" data-v="next">Siguiente turno</button><button class="btn sm" type="button" data-act="salaend">Terminar combate</button>' : '<button class="btn main sm" type="button" data-act="salaturn" data-v="start"' + (R0.order.length ? '' : ' disabled title="Primero pongan iniciativa"') + '>Empezar combate</button>') + '<button class="btn sm" type="button" data-act="salanpc">' + (npcOpen ? 'Cerrar' : 'Agregar enemigo') + '</button><label class="toggle"><input type="checkbox" data-act="salahide"' + (R0.hidePc ? ' checked' : '') + '> Ocultar PG del grupo</label></div>'
      + (R0.round ? '' : '<p class="note" style="margin-top:6px">' + (R0.order.length ? 'Cuando todos tengan iniciativa, empieza el combate.' : 'Los jugadores ponen su iniciativa; a los enemigos se la pones tú en su fila.') + '</p>');
    if (dm && npcOpen) h += '<form class="sala-npc" data-form="salanpc"><input class="field" name="name" placeholder="Nombre (Goblin)" aria-label="Nombre del enemigo" autocomplete="off"><input class="field" name="ac" inputmode="numeric" placeholder="CA" aria-label="CA"><input class="field" name="hp" inputmode="numeric" placeholder="PG" aria-label="PG"><input class="field" name="init" inputmode="numeric" placeholder="Inic." aria-label="Iniciativa"><input class="field" name="count" inputmode="numeric" placeholder="×1" aria-label="Cantidad"><label class="toggle"><input type="checkbox" name="hidden"> Oculto</label><button class="btn main sm" type="submit">Agregar</button></form>';
    h += '<div class="sala-list" role="list">' + ordered.map(function(x){ return rowHtml(x, dm, true); }).join('') + (rest.length ? '<div class="sala-sep">Sin iniciativa</div>' + rest.map(function(x){ return rowHtml(x, dm, false); }).join('') : '') + (!ordered.length && !rest.length ? '<p class="note">Todavía no hay nadie más. Comparte el código.</p>' : '') + '</div>';
    var n = Object.keys(sel).length;
    if (n) h += '<form class="sala-apply" data-form="salaapply"><div class="sala-apply-h"><b>' + n + ' seleccionado' + (n > 1 ? 's' : '') + '</b><button class="pill" type="button" data-act="salaclear">Quitar selección</button></div>'
      + '<div class="sala-apply-row"><input class="field" name="amount" inputmode="numeric" autocomplete="off" placeholder="Total" aria-label="Cantidad"><button class="btn dmg" type="submit" data-kind="damage">Daño</button><button class="btn heal" type="submit" data-kind="heal">Curar</button><button class="btn" type="submit" data-kind="temp">Temp.</button></div>'
      + '<div class="sala-apply-row"><select class="field" name="cond" aria-label="Condición"><option value="">Condición…</option>' + Object.keys(COND).map(function(k){ return '<option value="' + k + '">' + COND[k] + '</option>'; }).join('') + '</select><button class="btn" type="submit" data-kind="cond+">Aplicar</button><button class="btn" type="submit" data-kind="cond-">Quitar</button></div>'
      + '<input class="field" name="note" maxlength="80" autocomplete="off" placeholder="De qué (Bola de fuego, Palabra de curación…)" aria-label="Nota"></form>';
    if (lastErr) h += '<p class="err">' + esc(lastErr) + '</p>';
    h += '<details class="feat-d sala-log"><summary><b>Registro</b><small>' + R0.log.length + ' eventos</small></summary><div style="padding:0 12px 10px">' + R0.log.slice().reverse().map(function(l){ return '<p class="note" style="margin:4px 0">' + esc(l.text) + '</p>'; }).join('') + '</div></details>';
    return h + '</div>';
  }
  function bar(hp, max, temp){ var p = Math.max(0, Math.min(100, Math.round(hp / max * 100))), c = p <= 33 ? 'var(--bad)' : p <= 66 ? 'var(--warn)' : 'var(--ok)'; return '<div class="bar"><i style="width:' + p + '%;background:' + c + '"></i></div><span class="sala-hp">' + hp + '/' + max + (temp ? ' +' + temp : '') + '</span>'; }
  function rowHtml(x, dm, inOrder){
    var turn = room.turnId === x.id, on = !!sel[x.id], name, sub, hp = '', ac = '', conds = [], init;
    if (x.pc) { var m = x.m, c = m.char || {}; name = c.name || m.name; sub = (c.cls || '') + (m.online ? '' : ' · desconectado'); ac = c.ac; init = m.init; conds = (c.conds || []).slice(); if (c.conc) conds.push('concentration'); hp = c.hp == null ? '<span class="sala-state">PG ocultos</span>' : bar(c.hp, c.hpMax, c.temp); if (c.comps && c.comps.length) sub += ' · ' + c.comps.map(function(k){ return k.name + ' ' + k.hp + '/' + k.hpMax; }).join(', '); }
    else { var n = x.n; name = n.name; init = n.init; conds = n.conds || []; if (dm) { ac = n.ac; hp = bar(n.hp, n.hpMax, n.temp); sub = n.hidden ? 'oculto para los jugadores' : 'enemigo'; } else { sub = 'enemigo'; hp = '<span class="sala-state ' + (n.state === 'caído' ? 'down' : '') + '">' + esc(n.state) + '</span>'; } }
    var me = x.id === room.you;
    var pickable = !(dm && x.pc);
    var h = '<div class="sala-row' + (turn ? ' turn' : '') + (on ? ' sel' : '') + (x.pc ? '' : ' npc') + '" role="listitem"><button type="button" class="sala-pick" ' + (pickable ? 'data-act="salasel" data-id="' + attr(x.id) + '" aria-pressed="' + on + '" aria-label="Seleccionar a ' + attr(name) + '"' : 'tabindex="-1" aria-disabled="true"') + '><span class="sala-init">' + (init == null ? '–' : init) + '</span><span class="sala-name"><b>' + esc(name) + (me ? ' <small>(tú)</small>' : '') + '</b><small>' + esc(sub || '') + '</small></span>' + (ac !== '' && ac != null ? '<span class="sala-ac">' + ac + '</span>' : '') + '</button><div class="sala-hpbox">' + hp + '</div>';
    var dmNpc = dm && !x.pc;
    if (conds.length) h += '<div class="sala-conds">' + conds.map(function(k){ return dmNpc ? '<button type="button" class="chip" data-act="salacondoff" data-id="' + attr(x.id) + '" data-v="' + k + '" aria-label="Quitar ' + attr(COND[k] || k) + ' a ' + attr(name) + '">' + esc(COND[k] || k) + ' ×</button>' : '<span class="chip">' + esc(COND[k] || k) + '</span>'; }).join('') + '</div>';
    if (dmNpc) {
      var n2 = x.n;
      h += '<div class="sala-npcedit"><div class="quick"><button type="button" class="m" data-act="salanpchp" data-id="' + attr(x.id) + '" data-v="-10">−10</button><button type="button" class="m" data-act="salanpchp" data-id="' + attr(x.id) + '" data-v="-5">−5</button><button type="button" class="m" data-act="salanpchp" data-id="' + attr(x.id) + '" data-v="-1">−1</button><button type="button" class="p" data-act="salanpchp" data-id="' + attr(x.id) + '" data-v="1">+1</button><button type="button" class="p" data-act="salanpchp" data-id="' + attr(x.id) + '" data-v="5">+5</button></div>'
        + '<div class="sala-npcf"><label>PG<input class="field" data-npcset="hp" data-id="' + attr(x.id) + '" inputmode="numeric" value="' + n2.hp + '" aria-label="PG de ' + attr(name) + '"></label><label>Máx.<input class="field" data-npcset="hpMax" data-id="' + attr(x.id) + '" inputmode="numeric" value="' + n2.hpMax + '" aria-label="PG máximos de ' + attr(name) + '"></label><label>CA<input class="field" data-npcset="ac" data-id="' + attr(x.id) + '" inputmode="numeric" value="' + n2.ac + '" aria-label="CA de ' + attr(name) + '"></label><label>Inic.<input class="field" data-salainit="' + attr(x.id) + '" inputmode="numeric" value="' + (init == null ? '' : init) + '" aria-label="Iniciativa de ' + attr(name) + '"></label></div>'
        + '<div class="sala-npcf"><select class="field" data-npccond="' + attr(x.id) + '" aria-label="Agregar estado a ' + attr(name) + '"><option value="">+ Estado…</option>' + Object.keys(COND).filter(function(k){ return (n2.conds || []).indexOf(k) < 0; }).map(function(k){ return '<option value="' + k + '">' + COND[k] + '</option>'; }).join('') + '</select><button class="btn sm" type="button" data-act="salareveal" data-id="' + attr(x.id) + '">' + (n2.hidden ? 'Mostrar' : 'Ocultar') + '</button><button class="btn sm" type="button" data-act="salanpcdel" data-id="' + attr(x.id) + '">Quitar</button></div></div>';
    } else if (dm && x.pc) h += '<div class="sala-rowdm"><label class="muted" style="font-size:14px">Inic. <input class="field" data-salainit="' + attr(x.id) + '" inputmode="numeric" value="' + (init == null ? '' : init) + '" aria-label="Iniciativa de ' + attr(name) + '"></label></div>';
    return h + '</div>';
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('[data-act]'); if (!b || b.dataset.act.indexOf('sala') !== 0) return;
    var a = b.dataset.act, s = summary();
    if (a === 'salacreate') { var dm = !!(document.getElementById('salaDm') || {}).checked; st.role = dm ? 'dm' : 'player'; st.token = null; connect({t:'create', name: dm ? 'DM' : s ? s.name : 'Jugador', char: dm ? null : s, dm: dm}); }
    else if (a === 'salajoin') { var code = String((document.getElementById('salaCode') || {}).value || '').toUpperCase().replace(/[^A-Z]/g, ''); if (code.length !== 4) { lastErr = 'El código tiene 4 letras.'; draw(); return; } var dm2 = !!(document.getElementById('salaDm') || {}).checked; if (code !== st.code) st.token = null; st.code = code; st.role = dm2 ? 'dm' : 'player'; store(); connect({t:'join', code: code, token: st.token, name: dm2 ? 'DM' : s ? s.name : 'Jugador', char: dm2 ? null : s, dm: dm2}); }
    else if (a === 'salaleave') { send({t:'leave'}); manual = true; st.code = null; st.token = null; store(); room = null; sel = {}; try { ws.close(); } catch(e){} status = 'off'; draw(); }
    else if (a === 'salashare') { var txt = 'Únete a la sala ' + room.code + ' del Diario del Aventurero'; if (navigator.share) navigator.share({title:'Sala ' + room.code, text: txt, url: location.href.split('#')[0]}).catch(function(){}); else if (navigator.clipboard) navigator.clipboard.writeText(room.code).then(function(){ toast('Código copiado: ' + room.code); }, function(){}); }
    else if (a === 'salasel') { var id = b.dataset.id; if (sel[id]) delete sel[id]; else sel[id] = 1; draw(); }
    else if (a === 'salaclear') { sel = {}; draw(); }
    else if (a === 'salaturn') send({t:'turn', dir: b.dataset.v});
    else if (a === 'salaend') send({t:'end'});
    else if (a === 'salanpc') { npcOpen = !npcOpen; draw(); }
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
    else if (t.dataset.npcset) { var o = {t:'npc.set', id:t.dataset.id}; o[t.dataset.npcset] = t.value.trim(); if (o[t.dataset.npcset] !== '') send(o); }
    else if (t.dataset.npccond && t.value) { var nn = room && room.npcs.filter(function(x){ return x.id === t.dataset.npccond; })[0]; if (nn) send({t:'npc.set', id:nn.id, conds:(nn.conds || []).concat([t.value])}); }
  });
  document.addEventListener('input', function(ev){ if (ev.target.id === 'salaCode') ev.target.value = ev.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });

  /* Ajustes: dirección del servidor */
  function settings(){
    var i = document.getElementById('salaUrl'); if (!i) return;
    i.value = st.url || ''; i.placeholder = (window.DIARIO_CONFIG && DIARIO_CONFIG.salaUrl) || serverUrl() || 'wss://tu-servidor.onrender.com/ws';
    var s = document.getElementById('salaStatus'); if (s) s.textContent = available() ? 'Se conectará a ' + serverUrl() : 'Sin servidor: escribe la dirección para jugar en grupo.';
  }
  document.addEventListener('change', function(ev){ if (ev.target.id === 'salaUrl') { var u = ev.target.value.trim(); if (u && !/^wss?:\/\//.test(u)) u = (/^localhost|^127\./.test(u) ? 'ws://' : 'wss://') + u.replace(/^https?:\/\//, ''); if (u && !/\/ws$/.test(u)) u = u.replace(/\/$/, '') + '/ws'; st.url = u || null; store(); settings(); } });

  /* Al abrir el diario, si estabas en una sala, vuelve a entrar sola */
  function resume(){ if (st.code && st.token && available() && status === 'off') rejoin(); }

  return {mount:mount, sync:sync, settings:settings, resume:resume, status:function(){ return status; }, room:function(){ return room; }};
})();
