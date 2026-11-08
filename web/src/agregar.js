/* ==================== AGREGAR ENEMIGOS RÁPIDO (DM) ====================
   Una hoja con buscador del Manual: cada resultado lleva +1, +2 y +4, y entran al combate con sus PG promedio, CA,
   imagen y su iniciativa ya tirada (los iguales comparten tirada; si ya había de ese tipo, toman la suya).
   Abajo: los recientes de la campaña y un enemigo a mano en una línea («Capitán bandido 45 PG CA 15 x2»). */
var Agregar = (function(){
  var esc = Render5e.esc, attr = Render5e.attr;
  var q = '', opt = {roll:true, hidden:false}, err = '';
  function $(s){ return document.querySelector(s); }
  function room(){ return window.Sala && Sala.room ? Sala.room() : null; }
  function sgn(n){ return (n >= 0 ? '+' : '−') + Math.abs(n); }
  /* ---------- Recientes por campaña ---------- */
  function recents(){ var r = room(); if (!r) return []; try { var all = JSON.parse(localStorage.getItem('diario-recientes') || '{}'); return all[r.code] || []; } catch(e){ return []; } }
  function remember(ref){
    var r = room(); if (!r || !ref) return;
    try { var all = JSON.parse(localStorage.getItem('diario-recientes') || '{}'), l = (all[r.code] || []).filter(function(x){ return x !== ref; }); l.unshift(ref); all[r.code] = l.slice(0, 8); localStorage.setItem('diario-recientes', JSON.stringify(all)); } catch(e){}
  }
  /* ---------- Lo que se ve ---------- */
  function rowHtml(ref, dup){
    var n = Bestiario.npcOf(ref); if (!n) return '';
    var info = (dup ? esc(String(ref).split('|')[1] || '') + ' · ' : '') + 'VD ' + esc(n.cr) + ' · ' + n.hp + ' PG · CA ' + n.ac + ' · inic. ' + sgn(n.initMod) + (n.binfo && n.binfo.type ? ' · ' + esc(n.binfo.type) : '');
    return '<div class="qa-row"><button type="button" class="qa-n" data-act="addstat" data-ref="' + attr(ref) + '" title="Ver su ficha"><b>' + esc(n.name) + '</b><small>' + info + '</small></button>'
      + '<div class="qa-b">' + [1, 2, 4].map(function(k){ return '<button type="button" class="btn sm' + (k === 1 ? ' main' : '') + '" data-act="addgo" data-ref="' + attr(ref) + '" data-n="' + k + '" aria-label="Agregar ' + k + ' ' + attr(n.name) + '">+' + k + '</button>'; }).join('') + '</div></div>';
  }
  function inFight(){
    var r = room(); if (!r || !r.npcs || !r.npcs.length) return '';
    var g = {}; r.npcs.forEach(function(n){ var b = n.name.replace(/\s+\d+$/, ''); g[b] = (g[b] || 0) + 1; });
    return '<div class="qa-now"><span class="label">ya en el combate</span><p>' + Object.keys(g).map(function(b){ return esc(b) + (g[b] > 1 ? ' ×' + g[b] : ''); }).join(' · ') + '</p></div>';
  }
  function results(){
    if (!window.Bestiario || !Bestiario.has()) return '<p class="note">Para buscar por nombre carga el Manual de Monstruos en Ajustes → Biblioteca. Mientras, agrégalos a mano aquí abajo.</p>';
    var t = q.trim();
    if (t) { var hits = Bestiario.search(t, 8); var cnt = {}; hits.forEach(function(h){ cnt[h.name] = (cnt[h.name] || 0) + 1; }); return hits.length ? hits.map(function(h){ return rowHtml(h.ref, cnt[h.name] > 1); }).join('') : '<p class="note">No hay ningún monstruo que se llame así. Agrégalo a mano aquí abajo.</p>'; }
    var rc = recents().filter(function(ref){ return Bestiario.find(ref); });
    return rc.length ? '<span class="label">recientes de esta campaña</span>' + rc.map(function(ref){ return rowHtml(ref); }).join('') : '<p class="note">Escribe parte del nombre: «gob», «orco», «lobo»…</p>';
  }
  function draw(){
    var box = $('#addRes'); if (box) box.innerHTML = results();
    var now = $('#addNow'); if (now) now.innerHTML = inFight();
    var e = $('#addErr'); if (e) { e.textContent = err; e.hidden = !err; }
  }
  function body(){
    return '<div class="qa">'
      + '<input class="field qa-q" id="addQ" type="search" placeholder="Buscar en el Manual: goblin, orco…" aria-label="Buscar monstruo" autocomplete="off" value="' + attr(q) + '">'
      + '<div class="qa-opts"><label class="toggle"><input type="checkbox" id="addRoll"' + (opt.roll ? ' checked' : '') + '> Tirar su iniciativa al agregarlos</label><label class="toggle"><input type="checkbox" id="addHid"' + (opt.hidden ? ' checked' : '') + '> Ocultos para los jugadores</label></div>'
      + '<div id="addRes" class="qa-res"></div>'
      + '<form class="qa-hand card" id="addHand"><span class="label">a mano, en una línea</span><div class="qa-hrow"><input class="field" id="addLine" placeholder="Capitán bandido 45 PG CA 15 x2" aria-label="Enemigo a mano: nombre, PG, CA y cuántos" autocomplete="off"><button class="btn" type="submit">Agregar</button></div><p class="note">Nombre, sus PG y su CA. Opcional: «x3» para varios e «inic +2».</p></form>'
      + '<p class="err" id="addErr" hidden></p><div id="addNow"></div></div>';
  }
  function open(){
    if (!window.Diario) return;
    err = ''; $('#addBody').innerHTML = body(); draw(); Diario.openSheet('addSheet');
    if (window.Bestiario) Bestiario.ready().then(function(){ draw(); });
    setTimeout(function(){ var i = $('#addQ'); if (i) i.focus(); }, 60);
  }
  /* ---------- Agregar ---------- */
  function send(msg, label){
    var ok = Sala.send(msg);
    if (ok) Sala.toast(label + ' en el combate' + (msg.roll ? ', con su iniciativa.' : '.'));
    return ok;
  }
  function addRef(ref, count){
    var n = Bestiario.npcOf(ref); if (!n) return;
    var msg = {t:'npc.add', name:n.name, ac:n.ac, hp:n.hp, initMod:n.initMod, formula:n.formula, ref:n.ref, binfo:n.binfo, reach:n.reach, count:count, hidden:opt.hidden, roll:opt.roll};
    remember(ref);
    var img = window.Retratos ? Promise.race([Retratos.monster(ref), new Promise(function(res){ setTimeout(function(){ res(null); }, 4000); })]) : Promise.resolve(null);
    img.then(function(id){ if (id) msg.img = id; send(msg, (count > 1 ? count + ' × ' : '') + n.name); });
  }
  /* «Capitán bandido 45 PG CA 15 x2 inic +1» → {name, hp, ac, count, initMod} */
  function parse(s){
    var t = ' ' + String(s || '') + ' ', o = {count:1, initMod:0}, m;
    if ((m = /\s[x×]\s*(\d{1,2})(?=\s)/i.exec(t))) { o.count = Math.max(1, Math.min(12, +m[1])); t = t.replace(m[0], ' '); }
    if ((m = /\s(?:inic(?:iativa)?|ini)\.?\s*([+−-]?\s*\d{1,2})(?=\s)/i.exec(t))) { o.initMod = parseInt(m[1].replace(/\s|−/g, function(c){ return c === '−' ? '-' : ''; }), 10) || 0; t = t.replace(m[0], ' '); }
    if ((m = /\s(?:ca|ac)\s*:?\s*(\d{1,2})(?=\s)/i.exec(t)) || (m = /\s(\d{1,2})\s*(?:ca|ac)(?=\s)/i.exec(t))) { o.ac = +m[1]; t = t.replace(m[0], ' '); }
    if ((m = /\s(\d{1,4})\s*(?:pg|hp|pv)(?=\s)/i.exec(t)) || (m = /\s(?:pg|hp|pv)\s*:?\s*(\d{1,4})(?=\s)/i.exec(t))) { o.hp = +m[1]; t = t.replace(m[0], ' '); }
    if (o.hp == null && (m = /\s(\d{1,4})(?=\s*$)/.exec(t))) { o.hp = +m[1]; t = t.replace(m[0], ' '); }
    o.name = t.replace(/\s+/g, ' ').trim();
    return o;
  }
  function addHand(){
    var o = parse($('#addLine').value);
    if (!o.name) { err = 'Escribe el nombre del enemigo.'; draw(); return; }
    if (!(o.hp > 0)) { err = 'Ponle sus PG, por ejemplo «45 PG».'; draw(); return; }
    err = '';
    if (send({t:'npc.add', name:o.name, hp:o.hp, ac:o.ac == null ? 12 : o.ac, initMod:o.initMod, count:o.count, hidden:opt.hidden, roll:opt.roll}, (o.count > 1 ? o.count + ' × ' : '') + o.name)) $('#addLine').value = '';
    draw();
  }
  /* ---------- Eventos ---------- */
  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('[data-act]'); if (!b) return; var a = b.dataset.act;
    if (a === 'addopen') open();
    else if (a === 'addgo') addRef(b.dataset.ref, +b.dataset.n || 1);
    else if (a === 'addstat' && window.Bestiario) Bestiario.open(b.dataset.ref, true);
  });
  document.addEventListener('input', function(ev){ if (ev.target.id === 'addQ') { q = ev.target.value; draw(); } });
  document.addEventListener('change', function(ev){ if (ev.target.id === 'addRoll') opt.roll = ev.target.checked; if (ev.target.id === 'addHid') opt.hidden = ev.target.checked; });
  document.addEventListener('submit', function(ev){ if (ev.target.id === 'addHand') { ev.preventDefault(); addHand(); } });
  if (window.Sala && Sala.on) Sala.on('state', function(){ var s = document.getElementById('addSheet'); if (s && !s.hidden) { var now = $('#addNow'); if (now) now.innerHTML = inFight(); } });
  return {open:open, parse:parse};
})();
