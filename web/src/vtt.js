/* ==================== EL JUGADOR EN EL VTT: ABANICO DE ACCIONES Y HOJA EN EL MAPA ====================
   Tocar tu ficha en el mapa abre un abanico alrededor de ella: Atacar (tus armas), Conjuros (por nivel, con los
   espacios que te quedan), Usar (rasgos con usos, pociones, consumibles), Moverse (Correr, Retirarse, Esquivar,
   levantarte, volar), Mi hoja y Terminar turno. Elegir un ataque o un conjuro apunta en el mapa y se publica desde ahí.
   Al DM, tocar un enemigo en combate le abre el abanico con sus acciones del Manual.
   «Mi hoja» abre al lado del mapa (o abajo, en vertical) las páginas de verdad del diario: personaje, conjuros, mochila
   (se equipa y se acomoda igual), rasgos y notas; al cerrarla vuelven a su lugar en el libro. */
var VTT = (function(){
  var esc = function(s){ return Render5e.esc(s == null ? '' : s); }, attr = function(s){ return Render5e.attr(s == null ? '' : s); };
  var wrap = null, ctx = null, stack = [], moved = null, tab = null;
  var PANELS = [['personaje', 'Hoja', '#pPersonaje', 'i-helm'], ['conjuros', 'Conjuros', '#pConjuros', 'i-wand'], ['equipo', 'Mochila', '#pEquipo', 'i-bag'], ['rasgos', 'Rasgos', '#pRasgos', 'i-star'], ['notas', 'Notas', '[data-panel="notas"]', 'i-quill']];
  function room(){ return window.Sala && Sala.status() === 'on' ? Sala.room() : null; }
  function isDm(){ var r = room(); return !!r && r.role === 'dm'; }
  function sgn(n){ n = +n || 0; return (n < 0 ? '−' : '+') + Math.abs(n); }
  function cut(t, n){ t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; }

  /* Mapas lo conecta al abrir un mapa (el contenedor del mapa) */
  function attach(w){ restore(); wrap = w; ctx = null; stack = []; }

  /* ---------- Abanico ---------- */
  /* ¿Este toque abre el abanico? (tu ficha en una campaña; para el DM, un enemigo en combate) */
  function tap(mp, t, px, py, o){
    var r = room(); if (!r || !wrap || !document.contains(wrap)) return false;
    var mineTok = !isDm() && t.kind === 'pc' && !t.comp && t.ref === r.you, foe = isDm() && t.kind === 'npc' && t.ref && (r.npcs || []).some(function(n){ return n.id === t.ref; }) && (r.round > 0 || (r.order || []).length);
    if (!mineTok && !foe) return false;
    open({mp:mp, tok:t, x:px, y:py, actor:mineTok ? 'me' : t.ref, panel:o && o.panel});
    return true;
  }
  /* Un verbo de la barra de tu turno (Atacar, Conjuros, Usar, Moverse): el abanico se abre en tu ficha, ya en ese nivel */
  function verb(label, mp, t){
    var r = room(); if (!r || !wrap || !t) return false;
    var v = window.Mapas && Mapas._view ? Mapas._view() : {x:0, y:0, s:40}, s = t.s || 1;
    open({mp:mp, tok:t, x:v.x + (t.x + s / 2) * v.s, y:v.y + (t.y + s / 2) * v.s, actor:'me'});
    var it = stack[0].items.filter(function(x){ return x.label === label; })[0];
    if (!it) { close(); if (window.Sala && Sala.toast) Sala.toast(label === 'Atacar' ? 'No tienes armas equipadas en tu hoja.' : label === 'Conjuros' ? 'No tienes conjuros preparados.' : 'No tienes nada para usar en el acceso rápido.'); return false; }
    if (it.kids) { stack.push({title:it.label, items:it.kids}); draw(); } else { close(); if (it.run) it.run(); }
    return true;
  }
  function open(c){ ctx = c; stack = [root()]; draw(); if (window.Sfx) Sfx.play('page'); }
  function close(){ ctx = null; stack = []; var f = wrap && wrap.querySelector('.vtt-fan'); if (f) f.remove(); var bk = wrap && wrap.querySelector('.vtt-fan-bk'); if (bk) bk.remove(); }
  function isOpen(){ return !!ctx; }
  /* Lo que hay en el abanico: para ti, tus armas, conjuros, lo que usas y cómo te mueves; para el DM, las acciones del enemigo */
  function root(){
    var ctx = VTTctx(); // una copia propia: al tocar, el abanico se cierra (y borra el suyo) antes de correr la acción
    var r = room(), items = [], acts = window.Acciones ? Acciones.sources(ctx.actor) : [];
    if (ctx.actor === 'me') {
      var w = acts.filter(function(a){ return a.group === 'Armas'; }), sp = acts.filter(function(a){ return a.group === 'Conjuros' || a.group === 'Otros conjuros'; });
      if (w.length) items.push({label:'Atacar', icon:'i-sword', kids:w.map(function(a){ return {label:a.title, sub:'1d20 ' + sgn(a.atk && a.atk.bonus), icon:a.melee ? 'i-sword' : 'i-bow', run:function(){ Acciones.quick({key:a.key}); }}; })});
      if (sp.length) {
        var lvs = {}, slots = window.Diario && Diario.slotsLeft ? Diario.slotsLeft() : [];
        sp.forEach(function(a){ (lvs[a.lv || 0] = lvs[a.lv || 0] || []).push(a); });
        var spellKid = function(a){ var d = a.def || {}; return {label:a.title, sub:d.area && window.Hechizos ? cut(Hechizos.line(d), 22) : a.save ? 'salvación' : a.atk ? 'ataque' : a.heal ? 'cura' : a.group === 'Otros conjuros' ? 'asistido' : '', gi:a.key, icon:'i-wand', dim:a.group === 'Otros conjuros', run:function(){ Acciones.quick({key:a.key}); }}; };
        var keys = Object.keys(lvs).map(Number).sort(function(a, b){ return a - b; });
        items.push({label:'Conjuros', icon:'i-wand', kids:keys.length === 1 ? lvs[keys[0]].map(spellKid) : keys.map(function(lv){ var sl = slots.filter(function(x){ return x.lv === lv && !x.pact; })[0]; return {label:lv ? 'Nivel ' + lv : 'Trucos', sub:lv ? (sl ? sl.left + ' de ' + sl.max + ' espacios' : 'con espacio mayor') : 'sin espacio', icon:'i-star', kids:lvs[lv].map(spellKid)}; })});
      }
      var q = window.Diario && Diario.quickList ? Diario.quickList() : [];
      if (q.length) items.push({label:'Usar', icon:'i-flask', kids:q.map(function(x){ return {label:x.label, sub:x.sub, icon:x.kind === 'it' ? x.icon || 'i-flask' : 'i-star', off:x.left === 0, run:function(){ Acciones.use(x.key, x.label); }}; })});
      var mv = [{label:'Correr', icon:'i-run', sub:'acción: mueve el doble', run:function(){ mvSet('dash', ctx); }}, {label:'Retirarse', icon:'i-retreat', sub:'acción: sin ataques de oportunidad', run:function(){ mvSet('dis', ctx); }},
        {label:'Esquivar', icon:'i-shield', sub:'acción', run:function(){ Acciones.note('Esquivar', 'Hasta su próximo turno, los ataques contra ella tienen desventaja y tiene ventaja en las salvaciones de Destreza.'); }},
        {label:'Subir', icon:'i-wing', sub:'volar 1,5 m', run:function(){ fly(1, ctx); }}, {label:'Bajar', icon:'i-minus', sub:'1,5 m', off:!(ctx.tok.z > 0), run:function(){ fly(-1, ctx); }}];
      var ch = Sala.summary && Sala.summary(); if (ch && (ch.conds || []).indexOf('prone') >= 0) mv.unshift({label:'Levantarme', icon:'i-up', sub:'la mitad de tu velocidad', run:function(){ mvSet('stand', ctx); }});
      items.push({label:'Moverse', icon:'i-boot', kids:mv});
      items.push({label:'Mi hoja', icon:'i-book', run:function(){ sheet('personaje'); }});
      if (r && r.turnId === r.you && r.round > 0) items.push({label:'Terminar turno', icon:'i-next', main:true, run:function(){ Sala.send({t:'turn', dir:'next'}); }});
    } else {
      var groups = {}, order = [];
      acts.forEach(function(a){ if (!groups[a.group]) { groups[a.group] = []; order.push(a.group); } groups[a.group].push(a); });
      var kid = function(a){ return {label:a.title, sub:a.atk ? '1d20 ' + sgn(a.atk.bonus) : a.save ? 'CD ' + a.save.dc : '', icon:a.atk ? (a.melee ? 'i-sword' : 'i-bow') : a.save ? 'i-shield' : 'i-scroll', run:function(){ Acciones.quick({key:a.key, actor:ctx.actor}); }}; };
      if (order.length === 1 || acts.length <= 6) acts.forEach(function(a){ items.push(kid(a)); });
      else order.forEach(function(g){ items.push({label:g, icon:g === 'Reacciones' ? 'i-shield' : g === 'Legendarias' ? 'i-crown' : 'i-swords', kids:groups[g].map(kid)}); });
      items.push({label:'Otra acción', icon:'i-quill', run:function(){ Acciones.open({actor:ctx.actor}); }});
      if (r && r.turnId === ctx.actor && r.round > 0) items.push({label:'Siguiente turno', icon:'i-next', main:true, run:function(){ Sala.send({t:'turn', dir:'next'}); }});
    }
    if (ctx.panel) items.push({label:'Ficha', icon:'i-token', run:ctx.panel});
    return {title:ctx.actor === 'me' ? 'Tu turno' : (ctx.tok && ctx.tok.name) || 'Enemigo', items:items};
  }
  function VTTctx(){ return ctx; }
  function mvSet(k, c){ c = c || ctx; var mp = c.mp, t = c.tok, o = {t:'mv.set', id:mp.id, tid:t.id}; var x = (room().mv || {})[t.id] || {}; if (k === 'dash') o.dash = !x.dash; else if (k === 'dis') o.dis = !x.dis; else o.stand = true; Sala.send(o); if (k === 'stand' && window.Diario) { var r0 = Diario.cur() && Diario.rt(Diario.cur()); if (r0) { r0.conds = (r0.conds || []).filter(function(c){ return c !== 'prone'; }); Diario.save(); } } }
  function fly(d, c){ c = c || ctx; var t = c.tok, z = Math.max(0, Math.min(60, (t.z || 0) + d)); t.z = z || undefined; Sala.send({t:'tok.set', id:c.mp.id, tid:t.id, z:z}); }
  function draw(){
    if (!wrap || !ctx) return; var lvl = stack[stack.length - 1], n = lvl.items.length;
    // un anillo (o dos, si son muchos) que se aplana en una elipse cuando el mapa es bajo (horizontal en el teléfono)
    var W = wrap.clientWidth || 360, H = wrap.clientHeight || 400, small = H < 330 || W < 330, iw = small ? 30 : 42, ih = small ? 26 : 36, two = n > 8;
    var Rx = Math.max(70, Math.min(two ? 120 : 132, W / 2 - iw - 8)), Ry = Math.max(46, Math.min(two ? 100 : 132, H / 2 - ih - 8)), Rx2 = Math.min(Rx + 62, W / 2 - iw - 4), Ry2 = Math.min(Ry + 52, H / 2 - ih - 4);
    var px0 = (two ? Rx2 : Rx) + iw + 4, py0 = (two ? Ry2 : Ry) + ih + 4, x = Math.max(px0, Math.min(W - px0, ctx.x)), y = Math.max(py0, Math.min(H - py0, ctx.y));
    if (W < px0 * 2) x = W / 2; if (H < py0 * 2) y = H / 2;
    var h = '<div class="vtt-fan-bk" data-act="vfanx" aria-hidden="true"></div><div class="vtt-fan' + (small ? ' small' : '') + '" role="menu" aria-label="' + attr(lvl.title) + '" style="left:' + x + 'px;top:' + y + 'px">'
      + '<button type="button" class="fan-c" data-act="' + (stack.length > 1 ? 'vfanback' : 'vfanx') + '" aria-label="' + (stack.length > 1 ? 'Volver' : 'Cerrar') + '"><svg class="ic"><use href="#i-' + (stack.length > 1 ? 'back' : 'x') + '"/></svg><small>' + esc(cut(lvl.title, 14)) + '</small></button>';
    lvl.items.forEach(function(it, i){
      var out = two && i % 2, a = -Math.PI / 2 + (Math.PI * 2 * i) / n, px = Math.cos(a) * (out ? Rx2 : Rx), py = Math.sin(a) * (out ? Ry2 : Ry);
      var ge = it.gi && window.Iconos && window.Lib5e ? (function(){ var p = it.gi.slice(3).split('|'), f = Lib5e.find('spell', p[0], p[1]); return f ? f.e : null; })() : null;
      var ic = ge ? Iconos.spellTile(ge, 'sm') : '<svg class="ic"><use href="#' + (it.icon || 'i-star') + '"/></svg>';
      h += '<button type="button" role="menuitem" class="fan-i' + (it.kids ? ' sub' : '') + (it.main ? ' main' : '') + (it.off ? ' off' : '') + (it.dim ? ' dim' : '') + '" data-act="vfan" data-i="' + i + '" style="--x:' + Math.round(px) + 'px;--y:' + Math.round(py) + 'px;--d:' + (i * 18) + 'ms"' + (it.off ? ' disabled' : '') + ' title="' + attr(it.label + (it.sub ? ' · ' + it.sub : '')) + '">' + ic + '<b>' + esc(cut(it.label, 16)) + '</b>' + (it.sub ? '<small>' + esc(cut(it.sub, 22)) + '</small>' : '') + '</button>';
    });
    h += '</div>';
    var old = wrap.querySelector('.vtt-fan'); if (old) old.remove(); var ob = wrap.querySelector('.vtt-fan-bk'); if (ob) ob.remove();
    wrap.insertAdjacentHTML('beforeend', h);
  }

  /* ---------- La hoja en el mapa ---------- */
  function sheet(k){
    if (!wrap) return; close();
    var P = PANELS.filter(function(x){ return x[0] === k; })[0] || PANELS[0]; tab = P[0];
    var box = wrap.querySelector('.vtt-sheet');
    if (!box) { wrap.insertAdjacentHTML('beforeend', '<aside class="vtt-sheet" role="dialog" aria-label="Tu hoja"><header class="vs-h"></header><div class="vs-b scroll"></div></aside>'); box = wrap.querySelector('.vtt-sheet'); }
    var C = window.Diario && Diario.cur(), D = window.Diario && Diario.D();
    box.querySelector('.vs-h').innerHTML = '<div class="vs-who"><b>' + esc(C ? C.name || 'Sin nombre' : 'Sin personaje') + '</b><small>' + (D && D.ok ? esc(D.clsLabel) + ' · CA ' + D.ac : '') + '</small></div>'
      + '<nav class="vs-tabs" role="tablist">' + PANELS.map(function(x){ return '<button type="button" role="tab" data-act="vsheet" data-v="' + x[0] + '" aria-selected="' + (x[0] === tab) + '"><svg class="ic"><use href="#' + x[3] + '"/></svg><span>' + x[1] + '</span></button>'; }).join('') + '</nav>'
      + '<button class="icon-btn sm" type="button" data-act="vsheetx" aria-label="Cerrar la hoja"><svg class="ic"><use href="#i-x"/></svg></button>';
    var el = document.querySelector(P[2]); if (!el) return;
    if (moved && moved.el !== el) restore();
    if (!moved) moved = {el:el, parent:el.parentNode, next:el.nextSibling, hidden:el.hidden};
    var body = box.querySelector('.vs-b'); body.innerHTML = ''; body.appendChild(el); el.hidden = false; body.scrollTop = 0;
    if (window.Diario && Diario.renderAll) Diario.renderAll();
    wrap.classList.add('with-sheet');
  }
  /* Las páginas vuelven a su lugar en el libro */
  function restore(){
    if (!moved) return; var m = moved; moved = null;
    try { if (m.next && m.next.parentNode === m.parent) m.parent.insertBefore(m.el, m.next); else m.parent.appendChild(m.el); m.el.hidden = m.hidden; } catch(e){}
    if (window.Diario && Diario.renderAll) Diario.renderAll();
  }
  function closeSheet(){ var box = wrap && wrap.querySelector('.vtt-sheet'); restore(); if (box) box.remove(); if (wrap) wrap.classList.remove('with-sheet'); tab = null; }

  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('[data-act]'); if (!b) return; var a = b.dataset.act;
    if (a === 'vfan') { var lvl = stack[stack.length - 1], it = lvl && lvl.items[+b.dataset.i]; if (!it) return; if (it.kids) { stack.push({title:it.label, items:it.kids}); draw(); } else { var run = it.run; close(); if (run) run(); } }
    else if (a === 'vfanback') { stack.pop(); draw(); }
    else if (a === 'vfanx') close();
    else if (a === 'vsheet') sheet(b.dataset.v);
    else if (a === 'vsheetx') closeSheet();
    else if (a === 'mapsheet' && room() && !isDm()) { ev.stopPropagation(); sheet('personaje'); }
    else if (a === 'endcombat' || (a === 'mesatab' && b.dataset.v !== 'mapas') || a === 'mapback') closeSheet();
  }, true);
  // Esc cierra el abanico, y solo el abanico (no la campaña)
  document.addEventListener('keydown', function(ev){ if (ev.key === 'Escape' && ctx) { close(); ev.stopPropagation(); ev.preventDefault(); } }, true);
  if (window.Sala) Sala.on('left', function(){ close(); closeSheet(); });
  return {attach:attach, tap:tap, verb:verb, open:open, close:close, isOpen:isOpen, sheet:sheet, closeSheet:closeSheet, restore:restore, _tab:function(){ return tab; }};
})();
