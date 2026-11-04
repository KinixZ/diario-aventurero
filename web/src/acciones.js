/* ==================== ESCENA DE COMBATE (combate sin mapa) ==================== */
/* Arriba de la lista de iniciativa (Combate → Orden): la cinta de turnos con retratos, el turno en grande, el
   compositor de acciones y lo que va pasando (las tarjetas de acción). El DM publica lo que hacen sus enemigos
   (sus acciones del Manual de Monstruos, o libres) y cada jugador lo suyo (sus armas y conjuros, o libre).
   Los dados los tira el servidor. Cada tarjeta dice si impacta contra la CA de cada objetivo y deja aplicar el daño
   (al enemigo: el DM o quien lo hizo; a un personaje: su jugador en su hoja) o tirar la salvación.
   Si la vida de los enemigos está oculta, el daño que reciben tampoco se ve (lo decide el servidor). */
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
  }
  /* La cinta de turnos y el turno en grande */
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
        + '<div class="cs-ctl">' + (dm ? '<button class="icon-btn sm" type="button" data-act="salaturn" data-v="prev" aria-label="Turno anterior"><svg class="ic"><use href="#i-back"/></svg></button>' : '')
        + (dm && !cur.pc ? '<button class="btn sm" type="button" data-act="actopen" data-actor="' + attr(cur.id) + '"><svg class="ic"><use href="#i-swords"/></svg>Su acción</button>' : '')
        + (mine ? '<button class="btn sm" type="button" data-act="actopen"><svg class="ic"><use href="#i-swords"/></svg>Mi acción</button>' : '')
        + (dm || mine ? '<button class="btn main sm" type="button" data-act="salaturn" data-v="next"><svg class="ic"><use href="#i-next"/></svg>' + (mine && !dm ? 'Terminar turno' : 'Siguiente') + '</button>' : '') + '</div></div>';
    }
    return h + '</section>';
  }

  /* ---------- Compositor: qué hago, con qué dados y a quién ---------- */
  function sources(r){
    if (!comp) return [];
    if (comp.actor && comp.actor !== 'me' && comp.actor !== 'dm') { var x = who(r, comp.actor); return x && x.ref && window.Bestiario && Bestiario.has() ? Bestiario.actionsOf(x.ref) : []; }
    return comp.actor === 'me' && window.Diario && Diario.actions ? Diario.actions() : [];
  }
  function open(o){
    var r = room(); if (!r) return; o = o || {};
    // desde el mapa (o desde Mi turno): primero a la escena de combate
    if (!box() || !box().offsetParent) { if ((o.tries = (o.tries || 0) + 1) > 3) return; goCombat(); setTimeout(function(){ open(o); }, 60); return; }
    var dm = isDm(), actor = o.actor || (dm ? (r.turnId && (r.npcs || []).some(function(n){ return n.id === r.turnId; }) ? r.turnId : (r.npcs[0] || {}).id || 'dm') : 'me');
    comp = {actor:actor, comp:'', key:'free', title:'', atkOn:false, bonus:0, k:'n', saveOn:false, ab:'dex', dc:13, half:true, dmg:'', type:'', heal:false, text:'', lv:'', targets:{}};
    if (o.key) pick(o.key);
    if (o.target) comp.targets[o.target] = 1;
    if (dm && window.Bestiario && !Bestiario.has()) Bestiario.ready().then(function(){ render.force = true; render(); });
    render.force = true; render();
    var b = box(); if (b) { var el = b.querySelector('.cs-comp'); if (el && el.scrollIntoView) try { el.scrollIntoView({block:'nearest', behavior:'smooth'}); } catch(e){} }
  }
  function pick(key){
    var r = room(), src = sources(r), a = src.filter(function(x){ return x.key === key; })[0];
    comp.key = key;
    if (!a) { comp.title = comp.title || ''; return; }
    comp.title = a.title; comp.text = a.text || ''; comp.atkOn = !!a.atk; comp.bonus = a.atk ? a.atk.bonus : 0; comp.saveOn = !!a.save;
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
      + '<label class="fl">Detalle<textarea class="field" data-actf="text" rows="2" maxlength="500" placeholder="Lo que pasa, alcance, efectos…">' + esc(comp.text) + '</textarea></label>';
    // objetivos: los del combate (los enemigos primero para un jugador; el grupo primero para el DM)
    var tg = function(x){ return '<button type="button" class="cs-tg' + (x.pc ? ' pc' : ' npc') + (x.down ? ' down' : '') + '" data-act="acttg" data-id="' + attr(x.id) + '" aria-pressed="' + !!comp.targets[x.id] + '">' + pic(x) + '<span>' + esc(x.name) + '</span></button>'; };
    var npcs = foes.map(function(n){ return who(r, n.id); }).filter(Boolean), ps = pcs.map(function(m){ return who(r, m.id); }).filter(Boolean), list = dm ? ps.concat(npcs) : npcs.concat(ps);
    h += '<div class="cs-tgs"><span class="label">objetivos</span><div class="cs-tg-l">' + (list.length ? list.filter(function(x){ return x.id !== comp.actor; }).map(tg).join('') : '<small class="muted">Nadie en el combate todavía.</small>') + '</div></div>';
    return h + '<div class="cs-go"><button class="btn main" type="submit"><svg class="ic"><use href="#i-d20"/></svg>Tirar y publicar</button><small class="muted">Los dados se tiran en el servidor; lo ve todo el grupo.</small></div></form>';
  }
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
    if (!act.title && !act.text && !act.atk && !act.dmg && !act.save) { Sala.toast('Escribe qué haces o elige una acción.'); return; }
    if (!act.title) act.title = act.heal ? 'Curación' : act.atk ? 'Ataque' : 'Acción';
    if (!Sala.send({t:'act.post', act:act})) return;
    // un conjuro con espacio: se gasta en tu hoja (y queda la concentración si la pide)
    if (!dm && comp.spell && comp.lv) Diario.cast(comp.spell.ref, comp.lv);
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
    return '<p class="ac-dmg' + (k.heal ? ' heal' : '') + '"><b class="ac-n">' + k.amt + '</b> ' + (k.heal ? 'PG de curación' : 'de daño') + ' <small>' + k.dmg.map(function(d){ return esc(d.dice) + (d.type ? ' ' + esc(d.type) : '') + ' <i>[' + d.rolls.map(function(v){ return Math.abs(v); }).join(', ') + ']</i>'; }).join(' + ') + '</small></p>';
  }
  function cardHtml(k, r){
    var dm = isDm(), a = k.actor, mineCard = k.by === r.you, x = a.kind === 'npc' ? who(r, a.id) : a.kind === 'pc' ? who(r, a.id) : null;
    var face = a.kind === 'dm' ? '<span class="cs-pic dm ic"><svg class="ic"><use href="#i-crown"/></svg></span>' : x && !a.of ? pic(x) : '<span class="cs-pic ini' + (a.kind === 'pc' ? ' pc' : '') + '">' + esc(ini(a.name)) + '</span>';
    var h = '<article class="ac-card ' + a.kind + (k.atk && k.atk.crit ? ' crit' : '') + '" data-id="' + attr(k.id) + '"><header>' + face + '<span class="ac-who"><b>' + esc(a.name) + '</b>' + (a.of ? '<small>de ' + esc(a.of) + '</small>' : '') + '<span>' + esc(k.title) + '</span></span><small class="ac-r">' + (k.round ? 'ronda ' + k.round : '') + '</small>'
      + (dm || mineCard ? '<button class="icon-btn sm ac-x" type="button" data-act="actdel" data-id="' + attr(k.id) + '" aria-label="Quitar esta acción"><svg class="ic"><use href="#i-x"/></svg></button>' : '') + '</header>';
    if (k.atk) h += '<p class="ac-atk"><svg class="ic"><use href="#i-d20"/></svg><b class="ac-n">' + k.atk.total + '</b> para impactar <small>' + (k.atk.k ? '[' + k.atk.dice.join(', ') + '] ' + (k.atk.k === 'adv' ? 'con ventaja' : 'con desventaja') + ' · ' : '') + k.atk.nat + ' ' + sgn(k.atk.bonus).replace(/^([+−])/, '$1 ') + '</small>' + (k.atk.crit ? '<i class="ac-badge crit">¡Crítico!</i>' : k.atk.fumble ? '<i class="ac-badge fumble">Pifia</i>' : '') + '</p>';
    if (k.save) h += '<p class="ac-save"><svg class="ic"><use href="#i-shield"/></svg>Salvación de <b>' + AB[k.save.ab] + '</b> CD <b>' + k.save.dc + '</b>' + (k.save.half ? ' <small>(mitad si la supera)</small>' : '') + '</p>';
    h += dmgLine(k);
    if (k.text) h += '<p class="ac-text">' + esc(k.text) + '</p>';
    if (k.targets && k.targets.length) h += '<ul class="ac-tgs">' + k.targets.map(function(t){ return tgHtml(k, t, r); }).join('') + '</ul>';
    return h + '</article>';
  }
  function tgHtml(k, t, r){
    var dm = isDm(), me = r.you, canApply = !t.res && (t.kind === 'npc' ? dm || k.by === me : t.id === me) && k.amt != null && !(k.atk && !t.hit), canSave = k.save && !t.sv && (t.kind === 'npc' ? dm : t.id === me);
    var h = '<li class="ac-tg' + (t.kind === 'pc' && t.id === me ? ' me' : '') + '"><b>' + esc(t.name) + '</b>' + (dm && t.kind === 'npc' && t.ac != null ? '<small>CA ' + t.ac + '</small>' : t.kind === 'pc' && t.ac != null ? '<small>CA ' + t.ac + '</small>' : '');
    if (k.atk) h += t.hit ? '<i class="ac-badge hit">impacta</i>' : '<i class="ac-badge miss">falla</i>';
    if (t.sv) h += '<i class="ac-badge ' + (t.sv.ok ? 'ok' : 'ko') + '">' + t.sv.total + ' · ' + (t.sv.ok ? 'la supera' : 'falla') + '</i>';
    if (t.res) h += '<i class="ac-badge done">' + (t.res === 'none' ? 'sin efecto' : (t.amt != null ? t.amt + ' ' : '') + (k.heal ? 'PG curados' : 'de daño') + (t.res === 'half' ? ' (mitad)' : '')) + '</i>';
    var btns = '';
    if (canSave) { var mod = t.kind === 'pc' ? (window.Diario && Diario.saveMod ? Diario.saveMod(k.save.ab) : 0) : saveOfNpc(r, t.id, k.save.ab); btns += '<button class="btn sm" type="button" data-act="actsave" data-id="' + attr(k.id) + '" data-tid="' + attr(t.id) + '" data-mod="' + mod + '"><svg class="ic"><use href="#i-d20"/></svg>Salvación ' + sgn(mod) + '</button>'; }
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
      var k = m.card, r = room(), isNew = !cards.some(function(x){ return x.id === k.id; }); upsert(k); render();
      if (isNew && window.Sfx) Sfx.play(k.atk && k.atk.crit ? 'crit' : k.heal ? 'heal' : k.atk && (k.targets || []).some(function(x){ return x.hit; }) ? 'hit' : k.save ? 'spell' : 'dice');
      // te toca a ti: impacta, pide tu salvación o te cura
      var t = r && (k.targets || []).filter(function(x){ return x.kind === 'pc' && x.id === r.you; })[0];
      if (isNew && t && k.by !== r.you && !seenMine[k.id]) { seenMine[k.id] = 1; var msg = k.actor.name + ': ' + k.title + (k.atk ? (t.hit ? ' · te impacta' : ' · falla') : '') + (k.save ? ' · salvación de ' + AB[k.save.ab] + ' CD ' + k.save.dc : '') + (k.amt != null && (!k.atk || t.hit) ? ' · ' + k.amt + (k.heal ? ' PG' : ' de daño') : '');
        Sala.toast(msg, {act:'actgo', label:'Ver'}); try { if (navigator.vibrate) navigator.vibrate([60, 40, 60]); } catch(e){} }
    });
    Sala.on('act.del', function(m){ cards = cards.filter(function(x){ return x.id !== m.id; }); render(); });
    Sala.on('left', function(){ cards = []; comp = null; fightN = 0; });
  }
  document.addEventListener('focusout', function(){ if (render.pending) setTimeout(function(){ var a = document.activeElement, b = box(); if (!(a && b && b.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) render(); }, 0); });
  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('[data-act]'); if (!b || b.dataset.act.indexOf('act') !== 0) return;
    var a = b.dataset.act;
    if (a === 'actopen') open({actor:b.dataset.actor, target:b.dataset.target});
    else if (a === 'actclose') { comp = null; render.force = true; render(); }
    else if (a === 'actpick') {
      if (!comp || !box() || !box().offsetParent) { open({key:b.dataset.k}); return; }
      pick(b.dataset.k); render.force = true; render();
    }
    else if (a === 'actk' && comp) { comp.k = b.dataset.v; render.force = true; render(); }
    else if (a === 'acttg' && comp) { var id = b.dataset.id; if (comp.targets[id]) delete comp.targets[id]; else comp.targets[id] = 1; b.setAttribute('aria-pressed', String(!!comp.targets[id])); }
    else if (a === 'actapply') { Sala.send({t:'act.apply', id:b.dataset.id, tid:b.dataset.tid, how:b.dataset.v}); b.disabled = true; }
    else if (a === 'actsave') { Sala.send({t:'act.save', id:b.dataset.id, tid:b.dataset.tid, mod:+b.dataset.mod || 0}); b.disabled = true; if (window.Sfx) Sfx.play('dice'); }
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
  document.addEventListener('input', function(ev){ var t = ev.target; if (comp && t.dataset && t.dataset.actf && t.type !== 'checkbox' && t.tagName !== 'SELECT') comp[t.dataset.actf] = t.value; });
  document.addEventListener('submit', function(ev){ var f = ev.target; if (!f.dataset || f.dataset.form !== 'actpost') return; ev.preventDefault(); post(); });

  return {render:render, open:open, _cards:function(){ return cards; }, _comp:function(){ return comp; }};
})();
