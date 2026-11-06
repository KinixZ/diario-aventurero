/* ==================== ESCENA DE COMBATE (combate sin mapa) ==================== */
/* Arriba de la lista de iniciativa (Combate → Orden): la cinta de turnos con retratos, el turno en grande, el
   compositor de acciones y lo que va pasando (las tarjetas de acción). El DM publica lo que hacen sus enemigos
   (sus acciones del Manual de Monstruos, o libres) y cada jugador lo suyo (sus armas y conjuros, o libre).
   Los dados los tira el servidor. Cada tarjeta dice si impacta contra la CA de cada objetivo y deja aplicar el daño
   (al enemigo: el DM o quien lo hizo; a un personaje: su jugador en su hoja) o tirar la salvación.
   Si la vida de los enemigos está oculta, el daño que reciben tampoco se ve (lo decide el servidor).
   Con un mapa (módulo 9): se apunta el área o los objetivos en el mapa (Mapas.aim), la app propone la ventaja o
   desventaja por los estados y el flanqueo, el servidor suma la cobertura, y cada tarjeta deja aplicar los estados que
   impone (con su salvación repetida) y la concentración. Con dados físicos se escribe lo que salió. */
var Acciones = (function(){
  var esc = function(s){ return Render5e.esc(s == null ? '' : s); }, attr = function(s){ return Render5e.attr(s == null ? '' : s); };
  var $ = function(s, r){ return (r || document).querySelector(s); };
  var AB = {str:'Fuerza', dex:'Destreza', con:'Constitución', int:'Inteligencia', wis:'Sabiduría', cha:'Carisma'}, ABS = {str:'FUE', dex:'DES', con:'CON', int:'INT', wis:'SAB', cha:'CAR'};
  var TYPES = ['', 'ácido', 'contundente', 'cortante', 'perforante', 'fuego', 'frío', 'fuerza', 'relámpago', 'necrótico', 'veneno', 'psíquico', 'radiante', 'trueno'];
  var cards = [], fightN = 0, comp = null, older = false, seenMine = {};

  function room(){ return window.Sala && Sala.status() === 'on' ? Sala.room() : null; }
  function isDm(){ var r = room(); return !!r && r.role === 'dm'; }
  function box(){ var b = document.getElementById('actBox'); return b && document.contains(b) ? b : null; }
  function sgn(n){ n = +n || 0; return (n < 0 ? '−' : '+') + Math.abs(n); }
  function ini(n){ return String(n || '?').split(/\s+/).slice(0, 2).map(function(w){ return w.charAt(0); }).join('').toUpperCase(); }
  function img(id){ return id && window.Mesa ? Mesa.imgUrl(id) : ''; }

  /* ---------- Quién es quién ---------- */
  function who(r, id){
    var m = r.members.filter(function(x){ return x.id === id && x.role !== 'dm'; })[0];
    if (m) { var c = m.char || {}; return {id:id, pc:true, name:c.name || m.name, sub:c.cls || '', img:c.img || c.tok || null, tok:c.tok || c.img || null, hp:c.hp, hpMax:c.hpMax, temp:c.temp, ac:c.ac, init:m.init, conds:(c.conds || []).concat(c.conc ? ['concentration'] : []), online:m.online, down:c.hp != null && c.hp <= 0 && c.hpMax > 1}; }
    var n = (r.npcs || []).filter(function(x){ return x.id === id; })[0];
    if (n) return {id:id, pc:false, name:n.name, sub:'enemigo', img:n.img || null, tok:n.img || null, ty:n.binfo ? n.binfo.type : n.ty, hp:n.hp, hpMax:n.hpMax, temp:n.temp, pct:n.pct, state:n.state, ac:n.ac, init:n.init, conds:n.conds || [], hidden:n.hidden, ref:n.ref, down:n.hp != null ? n.hp <= 0 : n.state === 'caído' || n.pct === 0};
    return null;
  }
  function pic(x, big){
    var u = img(big ? x.img : x.tok);
    if (u) return '<span class="cs-pic' + (x.pc ? ' pc' : '') + '"><img alt="" src="' + attr(u) + '"></span>';
    if (!x.pc && window.Retratos) return '<span class="cs-pic npc ic"><svg class="gi"><use href="#gi-' + Retratos.typeIcon(x.ty) + '"/></svg></span>';
    return '<span class="cs-pic ini' + (x.pc ? ' pc' : '') + '">' + esc(ini(x.name)) + '</span>';
  }
  function hpHtml(x){
    var p = x.hp != null && x.hpMax ? Math.max(0, Math.min(100, Math.round(x.hp / x.hpMax * 100))) : x.pct != null ? x.pct : null, col = p == null ? '' : p <= 33 ? 'var(--bad)' : p <= 66 ? 'var(--warn)' : 'var(--ok)';
    if (p == null) return x.state ? '<span class="cs-state">' + esc(x.state) + '</span>' : '';
    return '<span class="cs-hp"><i style="width:' + p + '%;background:' + col + '"></i></span><small>' + (x.hp != null ? 'PG ' + x.hp + '/' + x.hpMax + (x.temp ? ' +' + x.temp : '') : x.state || p + '%') + '</small>';
  }

  /* ---------- Pantalla ---------- */
  function render(){
    var b = box(); if (!b) return;
    var r = room(); if (!r) { b.innerHTML = ''; return; }
    var a = document.activeElement;
    if (a && b.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.type !== 'checkbox' && b.innerHTML && !render.force) { render.pending = true; return; }
    render.force = false; render.pending = false;
    b.innerHTML = stageHtml(r) + compHtml(r) + feedHtml(r);
    var cm = document.getElementById('cMine'); if (cm) cm.innerHTML = mineHtml(r);
  }
  /* Tu turno, en un solo lugar: lo que te queda, cuatro verbos grandes y un solo «Terminar turno» que dice quién sigue.
     Fuera de tu turno, lo que te queda (la reacción) y el botón para reaccionar. Vive arriba de la pantalla de combate (#cMine). */
  function mineHtml(r){
    if (isDm() || !(r.round > 0) || !r.order.length || r.order.indexOf(r.you) < 0) return '';
    var me = who(r, r.you); if (!me) return '';
    var mine = r.turnId === r.you, E = window.Diario && Diario.econ ? Diario.econ() : null, ti = r.order.indexOf(r.turnId), next = null, cur = who(r, r.turnId);
    for (var k = 1; k <= r.order.length && !next; k++) { var nx = who(r, r.order[(ti + k) % r.order.length]); if (nx && !nx.down) next = nx; }
    var src = window.Diario && Diario.actions ? Diario.actions() : [], w = src.filter(function(a){ return /^w:/.test(a.key); })[0], sp = src.filter(function(a){ return /^sp:/.test(a.key); });
    var econ = E ? '<div class="cm-econ" role="group" aria-label="Lo que te queda en el turno">' + [['a','Acción'],['b','Adicional'],['r','Reacción'],['m','Movimiento']].map(function(x){ return '<button type="button" class="e-' + x[0] + '" data-act="econ" data-k="' + x[0] + '" aria-pressed="' + !!E[x[0]] + '" title="' + (E[x[0]] ? 'Ya la usaste: toca para recuperarla' : 'Tócala cuando la uses') + '"><i aria-hidden="true"></i>' + x[1] + '</button>'; }).join('') + '</div>' : '';
    if (me.down) return '<section class="cs-mine down"><p class="cm-h"><b>Estás a 0 PG</b></p>' + (mine ? '<button class="btn main cm-end" type="button" data-act="actdeath"><svg class="ic"><use href="#i-skull"/></svg>Salvación contra la muerte</button>' : '<p class="note">En tu turno tiras la salvación contra la muerte.</p>') + '</section>';
    if (!mine) return '<section class="cs-mine wait"><p class="cm-h"><span>Turno de <b>' + esc(cur ? cur.name : '…') + '</b></span>' + (next && next.id === r.you ? '<small>Sigues tú</small>' : '') + '</p>' + econ
      + '<button class="btn cm-react" type="button" data-act="actopen" data-react="1"><svg class="ic"><use href="#i-shield"/></svg>Reacción u otra acción</button></section>';
    var verb = function(act, kind, ic, label, sub){ return '<button type="button" class="cm-verb" data-act="' + act + '"' + (kind ? (act === 'csub' ? ' data-v="' : ' data-kind="') + kind + '"' : '') + '><svg class="ic"><use href="#' + ic + '"/></svg><span><b>' + label + '</b><small>' + esc(sub) + '</small></span></button>'; };
    return '<section class="cs-mine turn"><p class="cm-h"><b>Tu turno</b><small>Ronda ' + r.round + '</small></p>' + econ
      + '<div class="cm-verbs">' + verb('actopen', 'w', 'i-sword', 'Atacar', w ? w.title + (w.atk ? ' ' + sgn(w.atk.bonus) : '') : 'Sin arma equipada')
      + verb('actopen', 's', 'i-wand', 'Conjuro', sp.length ? sp.length + ' en tu hoja' : 'Sin conjuros')
      + verb('csub', 'turno', 'i-flask', 'Usar', 'Objetos y rasgos')
      + verb('actopen', 'free', 'i-quill', 'Otra acción', 'Esquivar, ayudar…') + '</div>'
      + '<button class="btn main cm-end hud-next" type="button" data-act="salaturn" data-v="next"><svg class="ic"><use href="#i-next"/></svg>Terminar turno' + (next ? ' · sigue ' + esc(String(next.name).split(' ')[0]) : '') + '</button></section>';
  }
  /* La cinta de turnos y el turno en grande */
  function hasMine(){ return !!document.getElementById('cMine') && !isDm(); }
  function stageHtml(r){
    if (!(r.round > 0) || !r.order.length) return '';
    var list = r.order.map(function(id){ return who(r, id); }).filter(Boolean), ti = r.order.indexOf(r.turnId), cur = who(r, r.turnId), dm = isDm(), mine = r.turnId === r.you;
    var next = null; for (var k = 1; k <= r.order.length && !next; k++) { var nx = who(r, r.order[(ti + k) % r.order.length]); if (nx && !nx.down) next = nx; }
    var h = '<section class="cs-stage' + (mine ? ' mine' : '') + (cur && !cur.pc ? ' foe' : '') + '"><div class="cs-ribbon" role="list" aria-label="Orden de iniciativa">'
      + list.map(function(x, i){ return '<span role="listitem" class="cs-chip' + (x.id === r.turnId ? ' turn' : '') + (i < ti ? ' done' : '') + (x.down ? ' down' : '') + (x.pc ? ' pc' : ' npc') + (x.id === r.you ? ' me' : '') + '" title="' + attr(x.name + (x.init != null ? ' · ' + x.init : '')) + '">' + pic(x) + '<b>' + (x.init == null ? '–' : x.init) + '</b><small>' + esc(String(x.name).split(' ')[0]) + '</small></span>'; }).join('') + '</div>';
    if (cur) {
      h += '<div class="cs-turn"><div class="cs-big">' + pic(cur, true) + '</div><div class="cs-info"><small class="cs-round">Ronda ' + r.round + ' · ' + (mine ? 'es tu turno' : 'turno de') + '</small><h2>' + esc(cur.name) + '</h2>'
        + '<p class="cs-sub">' + esc(cur.pc ? cur.sub : 'Enemigo') + (cur.ac != null && (cur.pc || dm) ? ' · CA ' + cur.ac : '') + '</p><div class="cs-hpbox">' + hpHtml(cur) + '</div>'
        + (cur.conds.length ? '<div class="cs-conds">' + cur.conds.map(function(k){ return '<span class="chip">' + esc((Sala.COND || {})[k] || k) + '</span>'; }).join('') + '</div>' : '')
        + (next ? '<p class="cs-next">Sigue: <b>' + esc(next.name) + '</b></p>' : '') + '</div>'
        + '<div class="cs-ctl">' + (dm ? '<button class="btn sm" type="button" data-act="salaturn" data-v="prev"><svg class="ic"><use href="#i-back"/></svg>Anterior</button>' : '')
        + (dm && !cur.pc ? '<button class="btn sm" type="button" data-act="actopen" data-actor="' + attr(cur.id) + '"><svg class="ic"><use href="#i-swords"/></svg>Su acción</button>' : '')
        + (mine && cur.down ? '<button class="btn main sm" type="button" data-act="actdeath"><svg class="ic"><use href="#i-skull"/></svg>Salvación contra la muerte</button>' : '')
        + (mine && !cur.down && !hasMine() ? '<button class="btn sm" type="button" data-act="actopen"><svg class="ic"><use href="#i-swords"/></svg>Mi acción</button>' : '')
        + (dm || (mine && !hasMine()) ? '<button class="btn main sm" type="button" data-act="salaturn" data-v="next"><svg class="ic"><use href="#i-next"/></svg>' + (mine && !dm ? 'Terminar turno' : 'Siguiente turno' + (next ? ': ' + esc(String(next.name).split(' ')[0]) : '')) + '</button>' : '') + '</div></div>';
    }
    return h + '</section>';
  }

  /* ---------- Compositor: qué hago, con qué dados y a quién ---------- */
  function sources(r){
    if (!comp) return [];
    if (comp.actor && comp.actor !== 'me' && comp.actor !== 'dm') { var x = who(r, comp.actor); return x && x.ref && window.Bestiario && Bestiario.has() ? Bestiario.actionsOf(x.ref) : []; }
    return comp.actor === 'me' && window.Diario && Diario.actions ? Diario.actions() : [];
  }
  // #actBox puede ir con display:contents (DM en pantalla ancha): entonces no tiene offsetParent propio
  function shown(){ var b = box(); if (!b) return false; if (b.offsetParent) return true; var p = b.parentElement; return !!(p && p.offsetParent && getComputedStyle(b).display === 'contents'); }
  function open(o){
    var r = room(); if (!r) return; o = o || {};
    // desde el mapa (o desde Mi turno): primero a la escena de combate (salvo desde el abanico, que apunta en el mapa)
    if (!o.stay && !shown()) { if ((o.tries = (o.tries || 0) + 1) > 3) return; goCombat(); setTimeout(function(){ open(o); }, 60); return; }
    var dm = isDm(), actor = o.actor || (dm ? (r.turnId && (r.npcs || []).some(function(n){ return n.id === r.turnId; }) ? r.turnId : (r.npcs[0] || {}).id || 'dm') : 'me');
    comp = {actor:actor, comp:'', key:'free', title:'', atkOn:false, bonus:0, k:'n', kSet:false, saveOn:false, ab:'dex', dc:13, half:true, dmg:'', type:'', heal:false, text:'', lv:'', targets:{}, conds:[], repeat:false, conc:false, def:null, area:null, map:null, man:{}};
    if (!o.key && o.kind && actor === 'me' && (o.kind === 'w' || o.kind === 's')) { var pre = o.kind === 'w' ? /^w:/ : /^sp:/, first = sources(r).filter(function(x){ return pre.test(x.key); })[0]; if (first) o.key = first.key; }
    if (o.key) pick(o.key);
    if (o.target) comp.targets[o.target] = 1;
    if (o.title) { comp.title = o.title; if (o.reaction) comp.text = 'Reacción'; }
    if (dm && window.Bestiario && !Bestiario.has()) Bestiario.ready().then(function(){ render.force = true; render(); });
    render.force = true; render();
    var b = box(); if (b) { var el = b.querySelector('.cs-comp'); if (el && el.scrollIntoView) try { el.scrollIntoView({block:'nearest', behavior:'smooth'}); } catch(e){} }
  }
  function pick(key){
    var r = room(), src = sources(r), a = src.filter(function(x){ return x.key === key; })[0];
    comp.key = key;
    if (!a) { comp.title = comp.title || ''; return; }
    comp.title = a.title; comp.text = a.text || ''; comp.atkOn = !!a.atk; comp.bonus = a.atk ? a.atk.bonus + (comp.actor === 'me' && window.Diario && Diario.exhPen ? Diario.exhPen() : 0) : 0; comp.saveOn = !!a.save;
    // lo del mapa: cuerpo a cuerpo o a distancia, el área, los estados que impone, si se repite la salvación y la concentración
    var d = a.def || {}; comp.def = a.def || null; comp.melee = !!a.melee; comp.reach = a.reach || 1; comp.range = a.range || (d.range ? [d.range] : null);
    comp.conds = (d.conds || []).slice(); comp.repeat = !!d.repeat; comp.conc = !!d.conc; comp.area = null; comp.map = null; comp.kSet = false;
    if (a.save) { comp.ab = a.save.ab; comp.dc = a.save.dc; comp.half = a.save.half !== false; }
    comp.dmg = (a.dmg || []).map(function(d){ return d.dice; }).join(' + '); comp.type = (a.dmg && a.dmg[0] && a.dmg[0].type) || ''; comp.heal = !!a.heal; comp.extra = (a.dmg || []).slice(1);
    comp.lv = a.lv ? '' : null; comp.spell = a.lv != null && key.indexOf('sp:') === 0 ? {ref:key.slice(3), lv:a.lv} : null;
    if (comp.spell && comp.spell.lv) { var fs = Diario.slotsFor(comp.spell.lv).filter(function(x){ return x.left > 0; })[0]; comp.lv = fs ? fs.v : ''; if (fs) comp.dmg = recast(comp.spell, fs) || comp.dmg; }
    // a quién: una curación a ti mismo; un ataque, al enemigo del turno si es el DM el que mira
  }
  function recast(sp, slot){ var lv = slot.v === 'pact' ? slot.lvl : +slot.v, d = Diario.spellDice(sp.ref, lv); if (!d) return ''; var a = sources(room()).filter(function(x){ return x.key === 'sp:' + sp.ref; })[0], base = a && a.dmg[0] ? a.dmg[0].dice : ''; var m = /([+-]\s*\d+)\s*$/.exec(base.replace(/\s+/g, '')); return d + (m && !/d/.test(m[1]) ? ' ' + m[1].replace(/([+-])/, '$1 ') : ''); }
  function compHtml(r){
    var dm = isDm(), me = r.members.filter(function(m){ return m.id === r.you; })[0] || {};
    if (!comp) {
      if (!r.order.length && !(r.npcs || []).length) return '';
      if (!dm && hasMine() && r.round > 0 && r.order.indexOf(r.you) >= 0) return '';
      return '<div class="cs-acts"><button class="btn main" type="button" data-act="actopen"><svg class="ic"><use href="#i-swords"/></svg>' + (dm ? 'Acción de un enemigo' : 'Publicar mi acción') + '</button>' + (dm ? '<button class="btn" type="button" data-act="actopen" data-actor="dm"><svg class="ic"><use href="#i-scroll"/></svg>Narrar algo</button>' : '') + '</div>';
    }
    var src = sources(r), groups = {}, order = [];
    src.forEach(function(a){ if (!groups[a.group]) { groups[a.group] = []; order.push(a.group); } groups[a.group].push(a); });
    var foes = (r.npcs || []), pcs = r.members.filter(function(m){ return m.role !== 'dm'; });
    var actors = dm ? '<select class="field" data-actf="actor" aria-label="Quién actúa">' + foes.map(function(n){ return '<option value="' + attr(n.id) + '"' + (comp.actor === n.id ? ' selected' : '') + '>' + esc(n.name) + (n.hidden ? ' (oculto)' : '') + '</option>'; }).join('') + '<option value="dm"' + (comp.actor === 'dm' ? ' selected' : '') + '>Narrador (el DM)</option></select>'
      : '<select class="field" data-actf="comp" aria-label="Quién actúa"><option value="">' + esc((me.char && me.char.name) || 'Yo') + '</option>' + ((me.char && me.char.comps) || []).map(function(k){ return '<option value="' + attr(k.name) + '"' + (comp.comp === k.name ? ' selected' : '') + '>' + esc(k.name) + '</option>'; }).join('') + '</select>';
    var h = '<form class="cs-comp card" data-form="actpost"><div class="cs-comp-h"><b><svg class="ic"><use href="#i-swords"/></svg>Acción</b>' + actors + '<button class="icon-btn sm" type="button" data-act="actclose" aria-label="Cancelar"><svg class="ic"><use href="#i-x"/></svg></button></div>';
    if (order.length) h += '<div class="cs-srcs">' + order.map(function(g){ return '<div class="cs-src"><span class="label">' + esc(g) + '</span><div class="cs-src-l">' + groups[g].map(function(a){ return '<button type="button" class="cs-pick" data-act="actpick" data-k="' + attr(a.key) + '" aria-pressed="' + (comp.key === a.key) + '"><b>' + esc(a.title) + '</b><small>' + esc(srcLine(a)) + '</small></button>'; }).join('') + '</div></div>'; }).join('') + '</div>';
    else if (dm && comp.actor !== 'dm' && window.Bestiario && !Bestiario.has()) h += '<p class="note">Carga el bestiario en Ajustes para elegir sus acciones del Manual; mientras, escríbela abajo.</p>';
    h += '<div class="cs-f"><label class="fl cs-title">Qué hace<input class="field" data-actf="title" maxlength="60" value="' + attr(comp.title) + '" placeholder="' + (dm ? 'Cimitarra, Aliento de fuego…' : 'Espada larga, Rayo de fuego…') + '" autocomplete="off"></label>';
    if (comp.spell && comp.spell.lv) { var sl = Diario.slotsFor(comp.spell.lv); h += '<label class="fl">Espacio<select class="field" data-actf="lv"><option value="">Sin gastar espacio</option>' + sl.map(function(x){ return '<option value="' + x.v + '"' + (comp.lv === x.v ? ' selected' : '') + (x.left > 0 ? '' : ' disabled') + '>' + esc(x.label) + '</option>'; }).join('') + '</select></label>'; }
    h += '</div><div class="cs-f">'
      + '<label class="toggle sm"><input type="checkbox" data-actf="atkOn"' + (comp.atkOn ? ' checked' : '') + '> Ataque</label>' + (comp.atkOn ? '<label class="fl mini-l">1d20 +<input class="field mini" data-actf="bonus" inputmode="numeric" value="' + comp.bonus + '" aria-label="Bonificador de ataque"></label><div class="seg sm" role="group" aria-label="Ventaja">' + [['n','Normal'],['adv','Ventaja'],['dis','Desventaja']].map(function(x){ return '<button type="button" data-act="actk" data-v="' + x[0] + '" aria-pressed="' + (comp.k === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>' : '')
      + '<label class="toggle sm"><input type="checkbox" data-actf="saveOn"' + (comp.saveOn ? ' checked' : '') + '> Salvación</label>' + (comp.saveOn ? '<select class="field mini-s" data-actf="ab" aria-label="Característica">' + Object.keys(AB).map(function(k){ return '<option value="' + k + '"' + (comp.ab === k ? ' selected' : '') + '>' + ABS[k] + '</option>'; }).join('') + '</select><label class="fl mini-l">CD<input class="field mini" data-actf="dc" inputmode="numeric" value="' + comp.dc + '" aria-label="CD"></label><label class="toggle sm"><input type="checkbox" data-actf="half"' + (comp.half ? ' checked' : '') + '> mitad si la supera</label>' : '')
      + '</div><div class="cs-f"><label class="fl cs-dice">' + (comp.heal ? 'Curación' : 'Daño') + '<input class="field" data-actf="dmg" value="' + attr(comp.dmg) + '" placeholder="2d6 + 3" autocomplete="off" spellcheck="false"></label>'
      + (comp.heal ? '' : '<label class="fl">Tipo<select class="field" data-actf="type">' + TYPES.map(function(t){ return '<option value="' + attr(t) + '"' + (comp.type === t ? ' selected' : '') + '>' + (t || '—') + '</option>'; }).join('') + '</select></label>')
      + '<label class="toggle sm"><input type="checkbox" data-actf="heal"' + (comp.heal ? ' checked' : '') + '> Cura</label></div>'
      + tacHtml(r)
      + '<label class="fl">Detalle<textarea class="field" data-actf="text" rows="2" maxlength="500" placeholder="Lo que pasa, alcance, efectos…">' + esc(comp.text) + '</textarea></label>';
    // objetivos: los del combate (los enemigos primero para un jugador; el grupo primero para el DM)
    var tg = function(x){ return '<button type="button" class="cs-tg' + (x.pc ? ' pc' : ' npc') + (x.down ? ' down' : '') + '" data-act="acttg" data-id="' + attr(x.id) + '" aria-pressed="' + !!comp.targets[x.id] + '">' + pic(x) + '<span>' + esc(x.name) + '</span></button>'; };
    var npcs = foes.map(function(n){ return who(r, n.id); }).filter(Boolean), ps = pcs.map(function(m){ return who(r, m.id); }).filter(Boolean), list = dm ? ps.concat(npcs) : npcs.concat(ps);
    h += '<div class="cs-tgs"><span class="label">objetivos</span><div class="cs-tg-l">' + (list.length ? list.filter(function(x){ return x.id !== comp.actor; }).map(tg).join('') : '<small class="muted">Nadie en el combate todavía.</small>') + '</div></div>';
    return h + '<div class="cs-go"><button class="btn main" type="submit"><svg class="ic"><use href="#i-d20"/></svg>Tirar y publicar</button><small class="muted">Los dados se tiran en el servidor; lo ve todo el grupo.</small></div></form>';
  }
  /* ---------- Lo táctico del compositor: el mapa, la ventaja sugerida, los estados y los dados físicos ---------- */
  var COND_ES = function(k){ return (Sala.COND || {})[k] || k; };
  function mapNow(){ return window.Mapas && Mapas.curMap ? Mapas.curMap() : null; }
  function actorKey(){ return comp.actor === 'dm' ? null : comp.actor === 'me' ? (comp.comp ? null : 'me') : comp.actor; }
  /* Ventaja o desventaja por los estados (2024), el flanqueo y un enemigo al lado: la app la propone, tú decides */
  function suggest(r){
    if (!comp || !comp.atkOn || !window.Tactica) return null;
    var ids = Object.keys(comp.targets); if (ids.length !== 1) return null;
    var tg = who(r, ids[0]); if (!tg) return null;
    var att = comp.actor === 'me' ? {conds:window.Diario && Diario.conds ? Diario.conds() : []} : comp.actor !== 'dm' ? {conds:(who(r, comp.actor) || {}).conds || []} : null; if (!att) return null;
    var mp = mapNow(), ak = actorKey(), at = mp && ak ? Mapas.actorTok(ak) : null, tt = mp ? mp.tokens.filter(function(t){ return t.ref === ids[0] && !t.comp; })[0] : null;
    var near = at && tt ? Tactica.dist(at, tt) <= 1 : !!comp.melee, flank = false, threat = false;
    if (mp && at && tt && comp.melee && mp.tac && mp.tac.flank) flank = Tactica.flanked(at, tt, mp.tokens.filter(function(x){ return x !== at && x !== tt && x.kind === at.kind && !x.hidden; }));
    if (mp && at && !comp.melee) threat = mp.tokens.some(function(x){ return x.kind !== 'obj' && x.kind !== at.kind && x !== at && !x.hidden && Tactica.dist(at, x) <= 1; });
    var o = Tactica.attackMods({att:att, tgt:{conds:tg.conds}, near:near, ranged:!comp.melee, flank:flank, threat:threat}); o.far = at && tt && comp.range && !comp.melee ? Tactica.dist(at, tt) > Math.ceil(comp.range[comp.range.length - 1] / 5) : at && tt && comp.melee ? Tactica.dist(at, tt) > (comp.reach || 1) : false;
    return o;
  }
  function tacHtml(r){
    var h = '', d = comp.def, mp = mapNow(), ak = actorKey(), canAim = !!(window.Mapas && Mapas.aim && ak && (r.maps || []).length);
    if (d && d.why && d.why.length && window.Hechizos) h += '<p class="note cs-assist"><svg class="ic"><use href="#i-scroll"/></svg>Asistido: ' + d.why.map(function(w){ return esc(Hechizos.whyText(w)); }).join('; ') + '.</p>';
    if (canAim) {
      var A = d && d.area, nT = Object.keys(comp.targets).length;
      h += '<div class="cs-f cs-aim"><button class="btn sm' + (comp.area || (comp.map && nT) ? ' main' : '') + '" type="button" data-act="actaim"><svg class="ic"><use href="#i-aim"/></svg>' + (A ? (comp.area ? 'Mover el área' : 'Poner el área en el mapa') : 'Elegir objetivos en el mapa') + '</button>'
        + '<small class="muted">' + (A && window.Hechizos ? esc(Hechizos.line(d)) : comp.melee ? 'Cuerpo a cuerpo · ' + String((comp.reach || 1) * 1.5).replace('.', ',') + ' m' : comp.range ? 'A distancia · ' + String(Math.round(comp.range[0] / 5 * 1.5 * 10) / 10).replace('.', ',') + ' m' : '') + (comp.area ? ' · área puesta' : '') + '</small></div>';
    }
    var sg = suggest(r);
    if (sg && (sg.why.length || sg.crit || sg.pen || sg.far)) {
      var lab = sg.k === 'adv' ? 'ventaja' : sg.k === 'dis' ? 'desventaja' : sg.adv.length && sg.dis.length ? 'se anulan' : '';
      if (sg.k && !comp.kSet && comp.k === 'n') comp.k = sg.k;
      h += '<p class="cs-sug' + (sg.k === 'dis' || sg.far ? ' dis' : '') + '"><svg class="ic"><use href="#i-star"/></svg><span>' + (lab ? '<b>' + esc(lab.charAt(0).toUpperCase() + lab.slice(1)) + '</b>: ' : '') + esc(sg.why.join(', ')) + (sg.crit ? (sg.why.length ? '. ' : '') + '<b>Si impacta, es crítico</b>' : '') + (sg.far ? (sg.why.length || sg.crit ? '. ' : '') + '<b>Está fuera de tu alcance</b>' : '') + '</span>'
        + (sg.k && comp.k !== sg.k ? '<button class="btn sm" type="button" data-act="actk" data-v="' + sg.k + '">Usar</button>' : '') + '</p>';
    }
    if (comp.conds.length || (d && d.conds)) h += '<div class="cs-f cs-conds"><span class="label">impone</span>' + ((d && d.conds) || comp.conds).map(function(k){ return '<button type="button" class="chip" data-act="actcondt" data-v="' + attr(k) + '" aria-pressed="' + (comp.conds.indexOf(k) >= 0) + '">' + esc(COND_ES(k)) + '</button>'; }).join('') + (comp.saveOn ? '<label class="toggle sm"><input type="checkbox" data-actf="repeat"' + (comp.repeat ? ' checked' : '') + '> repite la salvación al final de cada turno</label>' : '') + '</div>';
    if (d && d.conc !== undefined || comp.conc) h += '<label class="toggle sm cs-conc"><input type="checkbox" data-actf="conc"' + (comp.conc ? ' checked' : '') + '> Concentración' + (d && d.zone ? ' (la zona dura mientras te concentres)' : '') + '</label>';
    if (window.Dados && Dados.mode() === 'fisico' && (comp.atkOn || comp.dmg)) {
      var parts = String(comp.dmg || '').trim() ? String(comp.dmg).split(/\s*\+\s*(?=\d*d\d)/i) : [];
      h += '<div class="cs-f cs-man"><span class="label">tus dados</span>' + (comp.atkOn ? '<label class="fl mini-l">d20<input class="field mini" data-actman="d0" inputmode="numeric" value="' + attr(comp.man.d0 || '') + '"></label>' + (comp.k !== 'n' ? '<label class="fl mini-l">y<input class="field mini" data-actman="d1" inputmode="numeric" value="' + attr(comp.man.d1 || '') + '"></label>' : '') : '')
        + parts.map(function(p, i){ return '<label class="fl mini-l">' + esc(p) + '<input class="field mini" data-actman="m' + i + '" inputmode="numeric" value="' + attr(comp.man['m' + i] || '') + '" placeholder="total"></label>'; }).join('') + '</div>';
    }
    return h;
  }
  /* Apuntar en el mapa: el área del conjuro (o de la acción del monstruo) y los objetivos */
  function aimNow(){
    var d = comp.def || {}, ak = actorKey(); if (!ak) { Sala.toast('Elige quién actúa (tú o un enemigo).'); return; }
    var c0 = comp;
    Mapas.aim({actor:ak, area:d.area || null, range:d.range || (comp.range ? comp.range[comp.range.length - 1] : comp.melee ? (comp.reach || 1) * 5 : 0), title:comp.title || 'Acción', dtype:comp.type, heal:comp.heal, atk:comp.atkOn, dex:comp.saveOn && comp.ab === 'dex', targets:comp.targets,
      onDone:function(res, go){
        if (comp !== c0) return; comp.map = res.map; comp.area = res.area || null; comp.self = !!res.self; comp.zoneR = res.zoneR || null; comp.targets = {}; res.targets.forEach(function(id){ comp.targets[id] = 1; });
        if (go) post(); else { goCombat(); render.force = true; setTimeout(render, 60); }
      }});
  }
  /* ---------- Desde el abanico del mapa ----------
     quick: prepara la acción (tuya o del enemigo) y, si necesita objetivos o área, apunta en el mapa; si no, la abre.
     use: usa algo del acceso rápido (rasgo, poción) en tu hoja y lo cuenta al grupo. note: una acción sin dados. */
  function quick(o){
    var r = room(); if (!r) return;
    open({key:o.key, actor:o.actor, target:o.target, stay:true});
    if (!comp) return;
    var d = comp.def || {}, needs = d.area || comp.atkOn || comp.saveOn || comp.dmg || comp.heal;
    if (needs && window.Mapas && Mapas.aim) aimNow(); else goCombat();
  }
  function use(key, label){
    var r = room(), msg = window.Diario && Diario.quickUse ? Diario.quickUse(key) : '';
    if (r && msg) Sala.send({t:'act.post', act:{title:label || 'Usa algo', text:String(msg).slice(0, 480), targets:[]}});
  }
  function note(title, text){ if (room()) Sala.send({t:'act.post', act:{title:title, text:text || '', targets:[]}}); }
  function srcLine(a){ var p = []; if (a.atk) p.push('1d20 ' + sgn(a.atk.bonus)); if (a.save) p.push(ABS[a.save.ab] + ' CD ' + a.save.dc); if (a.dmg && a.dmg.length) p.push(a.dmg.map(function(d){ return d.dice + (d.type ? ' ' + d.type : ''); }).join(' + ')); if (a.heal) p.push('cura'); if (a.lv) p.push('nivel ' + a.lv); else if (a.lv === 0) p.push('truco'); return p.join(' · ') || 'sin tirada'; }
  function post(){
    var r = room(); if (!comp || !r) return;
    var dm = isDm(), dice = String(comp.dmg || '').trim(), parts = dice ? dice.split(/\s*\+\s*(?=\d*d\d)/i) : [];
    var act = {title:comp.title.trim(), text:comp.text.trim(), targets:Object.keys(comp.targets)};
    if (dm && comp.actor && comp.actor !== 'dm') act.actor = comp.actor; else if (dm) act.name = 'DM';
    if (!dm && comp.comp) act.comp = comp.comp;
    if (comp.atkOn) act.atk = {bonus:+comp.bonus || 0, k:comp.k === 'n' ? null : comp.k};
    if (comp.saveOn) act.save = {ab:comp.ab, dc:+comp.dc || 10, half:!!comp.half};
    if (dice) act.dmg = comp.heal ? [{dice:dice}] : parts.map(function(d, i){ var ex = comp.extra && comp.key !== 'free' ? comp.extra.filter(function(x){ return x.dice.replace(/\s+/g, '') === d.replace(/\s+/g, ''); })[0] : null; return {dice:d, type:ex ? ex.type : i === 0 ? comp.type : comp.type}; });
    if (comp.heal) act.heal = true;
    // en el mapa: de dónde sale, el área y la zona que deja; estados, salvación repetida, concentración y críticos automáticos
    var d = comp.def || {}, sg = suggest(r);
    if (comp.map) act.map = comp.map; else { var mp = mapNow(), ak = actorKey(); if (mp && ak && Mapas.actorTok(ak)) act.map = mp.id; }
    if (act.atk && comp.melee) act.atk.melee = true;
    if (act.atk && sg && sg.crit) act.atk.autoCrit = true;
    if (comp.area) { act.area = comp.area; if (comp.self) act.self = true; }
    if (comp.conds.length) act.conds = comp.conds.slice();
    if (comp.repeat && act.save && act.conds) act.repeat = true;
    if (comp.conc) act.conc = true;
    if (d.zone && act.map && (comp.area || d.zone.follow)) act.zone = {on:d.zone.on, terrain:d.zone.terrain, obscure:d.zone.obscure, move:d.zone.move, follow:!!d.zone.follow, r:comp.zoneR || (d.area ? d.area.ft / 5 : 1)};
    if (window.Dados && Dados.mode() === 'fisico') {
      var man = {}, d20 = [comp.man.d0, comp.man.d1].filter(function(v){ return v !== undefined && v !== ''; }).map(Number);
      if (act.atk) { if (!d20.length || d20.some(function(v){ return !(v >= 1 && v <= 20); })) { Sala.toast('Escribe lo que sacaste en el d20.'); return; } man.d20 = d20; }
      if (act.dmg) man.dmg = act.dmg.map(function(x, i){ var v = comp.man['m' + i]; return v === undefined || v === '' ? null : +v; });
      act.man = man;
    }
    if (!act.title && !act.text && !act.atk && !act.dmg && !act.save && !act.conds) { Sala.toast('Escribe qué haces o elige una acción.'); return; }
    if (!act.title) act.title = act.heal ? 'Curación' : act.atk ? 'Ataque' : 'Acción';
    if (!Sala.send({t:'act.post', act:act})) return;
    // un conjuro con espacio: se gasta en tu hoja (y queda la concentración si la pide)
    if (!dm && comp.spell && comp.lv) Diario.cast(comp.spell.ref, comp.lv);
    // un ataque con arma de tu hoja gasta tu acción (se ve en la barra de tu turno); la reacción, fuera de tu turno
    if (!dm && !comp.comp && act.atk && comp.key && /^w/.test(comp.key) && window.Diario && Diario.econSet) Diario.econSet(r.turnId === r.you ? 'a' : 'r', true);
    else if (!dm && comp.spell && comp.spell.lv === 0) Diario.cast(comp.spell.ref);
    comp = null; render.force = true; render(); if (window.Sfx) Sfx.play('dice');
  }

  /* ---------- Lo que va pasando ---------- */
  function feedHtml(r){
    var cur = cards.filter(function(k){ return k.f === fightN; }).slice().reverse(), prev = cards.filter(function(k){ return k.f !== fightN; }).slice().reverse();
    if (!cur.length && !prev.length) return '';
    var h = '<section class="cs-feed"><div class="row"><span class="label">' + (cur.length ? 'lo que va pasando' : 'combate anterior') + '</span>' + (prev.length && cur.length ? '<button class="pill" type="button" data-act="actolder" aria-pressed="' + older + '">' + (older ? 'Ocultar' : 'Ver') + ' los anteriores</button>' : '') + '</div>';
    h += (cur.length ? cur : prev.slice(0, 12)).map(function(k){ return cardHtml(k, r); }).join('');
    if (older && cur.length) h += '<div class="cs-older">' + prev.slice(0, 20).map(function(k){ return cardHtml(k, r); }).join('') + '</div>';
    return h + '</section>';
  }
  function dmgLine(k){
    if (!k.dmg) return '';
    if (k.dmg.some(function(d){ return d.hidden; })) return '<p class="ac-dmg hid"><b>' + (k.heal ? 'Curación' : 'Daño') + '</b> ' + esc(k.dmg.map(function(d){ return d.dice; }).join(' + ')) + ' · <i>oculto</i></p>';
    var ty = k.dmg.map(function(d){ return d.type; }).filter(Boolean).filter(function(t, i, a){ return a.indexOf(t) === i; }).join(' y ');
    return '<div class="ac-dmgbig ac-dmg' + (k.heal ? ' heal' : '') + '"><b class="ac-n">' + k.amt + '</b><span>' + (k.heal ? 'PG de curación' : 'de daño' + (ty ? ' ' + esc(ty) : '')) + '<small>' + k.dmg.map(function(d){ return esc(d.dice) + ' [' + d.rolls.map(function(v){ return Math.abs(v); }).join(', ') + ']'; }).join(' + ') + '</small></span></div>';
  }
  function cardHtml(k, r){
    var dm = isDm(), a = k.actor, mineCard = k.by === r.you, x = a.kind === 'npc' ? who(r, a.id) : a.kind === 'pc' ? who(r, a.id) : null;
    var face = a.kind === 'dm' ? '<span class="cs-pic dm ic"><svg class="ic"><use href="#i-crown"/></svg></span>' : a.kind === 'fx' ? '<span class="cs-pic fx ic"><svg class="ic"><use href="#i-cube"/></svg></span>' : a.kind === 'sys' ? '<span class="cs-pic sys ic"><svg class="ic"><use href="#i-' + (k.concChk ? 'star' : 'turn') + '"/></svg></span>' : x && !a.of ? pic(x) : '<span class="cs-pic ini' + (a.kind === 'pc' ? ' pc' : '') + '">' + esc(ini(a.name)) + '</span>';
    var h = '<article class="ac-card ' + a.kind + (k.atk && k.atk.crit ? ' crit' : '') + '" data-id="' + attr(k.id) + '"><header>' + face + '<span class="ac-who"><b>' + esc(a.name) + '</b>' + (a.of ? '<small>de ' + esc(a.of) + '</small>' : '') + '<span>' + esc(k.title) + '</span></span><small class="ac-r">' + (k.round ? 'ronda ' + k.round : '') + '</small>'
      + (dm || mineCard ? '<button class="icon-btn sm ac-x" type="button" data-act="actdel" data-id="' + attr(k.id) + '" aria-label="Quitar esta acción"><svg class="ic"><use href="#i-x"/></svg></button>' : '') + '</header>';
    if (k.atk) {
      // lo importante en grande: si impacta (con un solo objetivo), el total y de dónde salió
      var one = k.targets && k.targets.length === 1 ? k.targets[0] : null, vd = k.atk.crit ? ['crit', '¡Crítico!'] : k.atk.fumble ? ['miss', 'Pifia'] : one ? (one.hit ? ['hit', 'Impacta'] : ['miss', 'Falla']) : ['hit', 'Ataque'];
      h += '<div class="ac-verdict ac-atk"><span class="vd ' + vd[0] + '">' + vd[1] + '</span><span class="tot"><b class="ac-n">' + k.atk.total + '</b><small>' + (k.atk.k ? (k.atk.k === 'adv' ? 'con ventaja ' : 'con desventaja ') + '[' + k.atk.dice.join(', ') + '] · ' : '') + k.atk.nat + ' en el d20 ' + sgn(k.atk.bonus).replace(/^([+−])/, '$1 ') + '</small></span></div>';
    }
    if (k.save) h += '<p class="ac-save"><svg class="ic"><use href="#i-shield"/></svg>Salvación de <b>' + AB[k.save.ab] + '</b> CD <b>' + k.save.dc + '</b>' + (k.save.half ? ' <small>(mitad si la supera)</small>' : '') + '</p>';
    if (k.death) h += '<p class="ac-death ' + (k.death.res === 'revive' || k.death.res === 'éxito' ? 'ok' : 'ko') + '"><svg class="ic"><use href="#i-skull"/></svg><b class="ac-n">' + k.death.nat + '</b> ' + esc(k.death.res === 'revive' ? '¡20! Recupera 1 PG' : k.death.res === 'dos fallos' ? '1: cuenta como dos fallos' : k.death.res === 'éxito' ? 'éxito' : 'fallo') + '</p>';
    h += dmgLine(k);
    var tags = []; if (k.conds && k.conds.length) tags.push('impone ' + k.conds.map(function(c){ return COND_ES(c).toLowerCase(); }).join(', ')); if (k.repeat) tags.push('repite la salvación'); if (k.conc) tags.push('concentración'); if (k.fx) tags.push('deja una zona en el mapa'); if (k.area) tags.push('área'); if (k.man) tags.push('dados físicos'); if (k.atk && k.atk.auto) tags.push('crítico automático');
    if (tags.length) h += '<p class="ac-tags">' + tags.map(function(t){ return '<span>' + esc(t) + '</span>'; }).join('') + '</p>';
    if (k.text) h += '<p class="ac-text">' + esc(k.text) + '</p>';
    if (k.targets && k.targets.length) h += '<ul class="ac-tgs">' + k.targets.map(function(t){ return tgHtml(k, t, r); }).join('') + '</ul>';
    return h + '</article>';
  }
  function tgHtml(k, t, r){
    var dm = isDm(), me = r.you, canApply = !t.res && (t.kind === 'npc' ? dm || k.by === me : t.id === me) && k.amt != null && !(k.atk && !t.hit), canSave = k.save && !t.sv && (t.kind === 'npc' ? dm : t.id === me);
    var h = '<li class="ac-tg' + (t.kind === 'pc' && t.id === me ? ' me' : '') + '"><b>' + esc(t.name) + '</b>' + (dm && t.kind === 'npc' && t.ac != null ? '<small>CA ' + t.ac + '</small>' : t.kind === 'pc' && t.ac != null ? '<small>CA ' + t.ac + '</small>' : '');
    if (t.cover) h += '<i class="ac-badge cover" title="' + attr(window.Tactica ? Tactica.coverName(t.cover) : '') + '">' + (t.cover === 'total' ? 'cobertura total' : 'cobertura +' + t.cover) + '</i>';
    if (k.atk) h += t.hit ? '<i class="ac-badge hit">impacta</i>' : '<i class="ac-badge miss">falla</i>';
    if (t.sv) h += '<i class="ac-badge ' + (t.sv.ok ? 'ok' : 'ko') + '">' + t.sv.total + ' · ' + (t.sv.ok ? 'la supera' : 'falla') + '</i>';
    if (t.res) h += '<i class="ac-badge done">' + (t.res === 'none' ? 'sin efecto' : (t.amt != null ? t.amt + ' ' : '') + (k.heal ? 'PG curados' : 'de daño') + (t.res === 'half' ? ' (mitad)' : '')) + '</i>';
    var btns = '';
    if (canSave) {
      // los estados del que tira: paralizado o aturdido fallan Fuerza y Destreza; apresado, desventaja en Destreza; cansancio, −2
      var tc = (who(r, t.id) || {}).conds || [], sm = window.Tactica ? Tactica.saveMods(tc, k.save.ab) : {}, mod = t.kind === 'pc' ? (window.Diario && Diario.saveMod ? Diario.saveMod(k.save.ab) + (Diario.exhPen ? Diario.exhPen() : 0) : 0) : saveOfNpc(r, t.id, k.save.ab), cov = k.save.ab === 'dex' && typeof t.cover === 'number' ? t.cover : 0;
      var man = window.Dados && Dados.mode() === 'fisico' && t.kind === 'pc' ? '<input class="field mini" data-actsvman="' + attr(k.id + '|' + t.id) + '" inputmode="numeric" placeholder="d20" aria-label="Tu d20">' : '';
      if (sm.fail) btns += '<button class="btn sm" type="button" data-act="actsave" data-id="' + attr(k.id) + '" data-tid="' + attr(t.id) + '" data-mod="' + mod + '" data-fail="1" title="Falla sola por su estado">Falla sola</button>';
      else btns += man + '<button class="btn sm" type="button" data-act="actsave" data-id="' + attr(k.id) + '" data-tid="' + attr(t.id) + '" data-mod="' + mod + '"' + (sm.k ? ' data-k="' + sm.k + '"' : '') + '><svg class="ic"><use href="#i-d20"/></svg>Salvación ' + sgn(mod + cov) + (sm.k ? ' (desv.)' : '') + '</button>';
    }
    // estados que impone: al fallar la salvación, al impactar (o sin tirada); los aplica el DM (enemigos), quien lo hizo o el jugador en su hoja
    var condOk = k.conds && k.conds.length && !t.cd && (t.kind === 'npc' ? dm || k.by === me : t.id === me) && (k.save ? t.sv && !t.sv.ok : k.atk ? t.hit : true);
    if (condOk) btns += '<button class="btn sm" type="button" data-act="actcond" data-id="' + attr(k.id) + '" data-tid="' + attr(t.id) + '">Aplicar ' + esc(k.conds.map(function(c){ return COND_ES(c).toLowerCase(); }).join(', ')) + '</button>';
    if (t.cd) h += '<i class="ac-badge ko">' + esc(k.conds.map(function(c){ return COND_ES(c).toLowerCase(); }).join(', ')) + '</i>';
    if (canApply && (!k.save || t.sv || !canSave)) {
      var n = k.amt, half = Math.floor(n / 2), sug = k.save && t.sv ? (t.sv.ok ? (k.save.half ? 'half' : 'none') : 'full') : 'full';
      btns += '<button class="btn sm' + (sug === 'full' ? ' main' : '') + '" type="button" data-act="actapply" data-id="' + attr(k.id) + '" data-tid="' + attr(t.id) + '" data-v="full">' + (k.heal ? 'Curar ' : (t.kind === 'pc' && t.id === me ? 'Recibir ' : 'Aplicar ')) + n + '</button>'
        + (k.heal ? '' : '<button class="btn sm' + (sug === 'half' ? ' main' : '') + '" type="button" data-act="actapply" data-id="' + attr(k.id) + '" data-tid="' + attr(t.id) + '" data-v="half">Mitad ' + half + '</button>')
        + '<button class="btn sm' + (sug === 'none' ? ' main' : '') + '" type="button" data-act="actapply" data-id="' + attr(k.id) + '" data-tid="' + attr(t.id) + '" data-v="none">Nada</button>';
    }
    return h + (btns ? '<span class="ac-btns">' + btns + '</span>' : '') + '</li>';
  }
  function saveOfNpc(r, id, ab){ var n = (r.npcs || []).filter(function(x){ return x.id === id; })[0]; return n && n.ref && window.Bestiario && Bestiario.has() ? Bestiario.saveOf(n.ref, ab) : 0; }

  /* ---------- Mensajes ---------- */
  function upsert(k){ var i = -1; cards.forEach(function(x, j){ if (x.id === k.id) i = j; }); if (i >= 0) cards[i] = k; else { cards.push(k); if (cards.length > 60) cards.shift(); } }
  if (window.Sala) {
    Sala.on('mesa.init', function(m){ cards = m.acts || []; fightN = m.fightN || 0; render(); });
    Sala.on('state', function(r){ if (r.fightN != null && r.fightN !== fightN) { fightN = r.fightN; older = false; } if (comp && isDm() && comp.actor !== 'dm' && !(r.npcs || []).some(function(n){ return n.id === comp.actor; })) comp.actor = 'dm'; render(); });
    Sala.on('act', function(m){
      var k = m.card, r = room(), old = cards.filter(function(x){ return x.id === k.id; })[0], isNew = !old; upsert(k); render();
      // tus dados ruedan (los de tu acción y los de tus salvaciones)
      if (window.Dados && r) { if (isNew && k.by === r.you && !k.man && (k.atk || k.dmg || k.death)) Dados.card(k); (k.targets || []).forEach(function(t){ var was = old && (old.targets || []).filter(function(x){ return x.id === t.id; })[0]; if (t.sv && !t.sv.man && !t.sv.auto && !(was && was.sv) && (t.id === r.you || (isDm() && t.kind === 'npc'))) Dados.save(t.sv, t.name); }); }
      if (isNew && window.Sfx) Sfx.play(k.atk && k.atk.crit ? 'crit' : k.heal ? 'heal' : k.atk && (k.targets || []).some(function(x){ return x.hit; }) ? 'hit' : k.save ? 'spell' : 'dice');
      // te toca a ti: impacta, pide tu salvación o te cura
      var t = r && (k.targets || []).filter(function(x){ return x.kind === 'pc' && x.id === r.you; })[0];
      if (isNew && t && k.by !== r.you && !seenMine[k.id]) { seenMine[k.id] = 1; var msg = k.actor.name + ': ' + k.title + (k.atk ? (t.hit ? ' · te impacta' : ' · falla') : '') + (k.save ? ' · salvación de ' + AB[k.save.ab] + ' CD ' + k.save.dc : '') + (k.amt != null && (!k.atk || t.hit) ? ' · ' + k.amt + (k.heal ? ' PG' : ' de daño') : '');
        Sala.toast(msg, {act:'actgo', label:'Ver'}); try { if (navigator.vibrate) navigator.vibrate([60, 40, 60]); } catch(e){} }
    });
    Sala.on('act.del', function(m){ cards = cards.filter(function(x){ return x.id !== m.id; }); render(); });
    /* Alguien salió del alcance de tu enemigo (o del tuyo): ataque de oportunidad con su reacción */
    Sala.on('oa', function(m){ Sala.toast(m.byName + ' puede hacerle un ataque de oportunidad a ' + m.targetName + '.', {act:'actoa', v:m.by + '|' + m.target, label:'Atacar'}); if (window.Sfx) Sfx.play('locked'); });
    Sala.on('left', function(){ cards = []; comp = null; fightN = 0; });
  }
  document.addEventListener('focusout', function(){ if (render.pending) setTimeout(function(){ var a = document.activeElement, b = box(); if (!(a && b && b.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) render(); }, 0); });
  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('[data-act]'); if (!b || b.dataset.act.indexOf('act') !== 0) return;
    var a = b.dataset.act;
    if (a === 'actopen') open({actor:b.dataset.actor, target:b.dataset.target, kind:b.dataset.kind, title:b.dataset.react ? '' : undefined});
    else if (a === 'actclose') { comp = null; render.force = true; render(); }
    else if (a === 'actpick') {
      if (!comp || !shown()) { open({key:b.dataset.k}); return; }
      pick(b.dataset.k); render.force = true; render();
    }
    else if (a === 'actk' && comp) { comp.k = b.dataset.v; comp.kSet = true; render.force = true; render(); }
    else if (a === 'actaim' && comp) aimNow();
    else if (a === 'actcondt' && comp) { var ck = b.dataset.v, ci = comp.conds.indexOf(ck); if (ci >= 0) comp.conds.splice(ci, 1); else comp.conds.push(ck); render.force = true; render(); }
    else if (a === 'actcond') { Sala.send({t:'act.cond', id:b.dataset.id, tid:b.dataset.tid}); b.disabled = true; }
    else if (a === 'actdeath') { if (window.Diario && Diario.rollDeath) Diario.rollDeath(); }
    else if (a === 'actoa') { var pr = String(b.dataset.v || '').split('|'); open({actor:isDm() ? pr[0] : undefined, target:pr[1], title:'Ataque de oportunidad', reaction:true}); }
    else if (a === 'acttg' && comp) { var id = b.dataset.id; if (comp.targets[id]) delete comp.targets[id]; else comp.targets[id] = 1; b.setAttribute('aria-pressed', String(!!comp.targets[id])); }
    else if (a === 'actapply') { Sala.send({t:'act.apply', id:b.dataset.id, tid:b.dataset.tid, how:b.dataset.v}); b.disabled = true; }
    else if (a === 'actsave') {
      var sv = {t:'act.save', id:b.dataset.id, tid:b.dataset.tid, mod:+b.dataset.mod || 0}; if (b.dataset.k) sv.k = b.dataset.k; if (b.dataset.fail) sv.fail = true;
      var mi = document.querySelector('[data-actsvman="' + b.dataset.id + '|' + b.dataset.tid + '"]');
      if (mi) { var nv = parseInt(mi.value, 10); if (!(nv >= 1 && nv <= 20)) { Sala.toast('Escribe lo que sacaste en el d20.'); mi.focus(); return; } sv.man = nv; }
      Sala.send(sv); b.disabled = true; if (window.Sfx) Sfx.play('dice');
    }
    else if (a === 'actdel') { if (!b.dataset.sure) { b.dataset.sure = 1; b.style.borderColor = 'var(--bad)'; b.setAttribute('aria-label', 'Toca otra vez para quitarla'); return; } Sala.send({t:'act.del', id:b.dataset.id}); }
    else if (a === 'actolder') { older = !older; render.force = true; render(); }
    else if (a === 'actgo') goCombat();
  });
  /* Ir a la escena de combate (Combate → Orden) */
  function goCombat(){
    var cb = document.getElementById('combat'); if (cb) cb.hidden = false;
    if (window.Mesa) Mesa.show('combate');
    var s = document.querySelector('[data-act="csub"][data-v="orden"]'); if (s && s.getAttribute('aria-selected') !== 'true') s.click(); else if (window.Diario) Diario.renderCombat();
  }
  document.addEventListener('change', function(ev){
    var t = ev.target; if (!comp || !t.dataset || !t.dataset.actf) return; var f = t.dataset.actf;
    if (t.type === 'checkbox') comp[f] = t.checked; else comp[f] = t.value;
    if (f === 'actor') { comp.key = 'free'; comp.title = ''; comp.atkOn = comp.saveOn = false; comp.dmg = ''; comp.text = ''; comp.heal = false; comp.spell = null; }
    if (f === 'comp') { comp.key = 'free'; }
    if (f === 'lv' && comp.spell) { var sl = Diario.slotsFor(comp.spell.lv).filter(function(x){ return x.v === t.value; })[0]; if (sl) comp.dmg = recast(comp.spell, sl) || comp.dmg; }
    if (/^(actor|comp|atkOn|saveOn|heal|lv)$/.test(f)) { render.force = true; render(); }
  });
  document.addEventListener('input', function(ev){ var t = ev.target; if (comp && t.dataset && t.dataset.actman) comp.man[t.dataset.actman] = t.value.replace(/[^0-9]/g, ''); if (comp && t.dataset && t.dataset.actf && t.type !== 'checkbox' && t.tagName !== 'SELECT') comp[t.dataset.actf] = t.value; });
  document.addEventListener('submit', function(ev){ var f = ev.target; if (!f.dataset || f.dataset.form !== 'actpost') return; ev.preventDefault(); post(); });

  return {render:render, open:open, quick:quick, use:use, note:note, sources:function(actor){ var c0 = comp; comp = {actor:actor}; var s0 = sources(room()); comp = c0; return s0; }, _cards:function(){ return cards; }, _comp:function(){ return comp; }};
})();
