/* ==================== ENCUENTROS (solo el DM) ==================== */
/* Combates preparados antes de la sesión, guardados en la campaña: mapa (o ninguno), enemigos con su lugar y su
   oleada, zonas de despliegue para el grupo y oleadas que llegan solas en una ronda o cuando el DM las suelta.
   Flujo: Usar → el mapa pasa a Combate con los enemigos en su lugar → los jugadores se unen y se acomodan en su zona →
   tiran iniciativa (escrita o en la app) → el DM empieza. Los enemigos se acomodan en el mapa (Mapas.editEnc).
   El servidor guarda cada encuentro completo; en el estado solo llega un resumen (room.encs) y los que están en curso
   (room.runs). Cada cambio se guarda solo. */
var Encuentros = (function(){
  var esc = function(s){ return Render5e.esc(s == null ? '' : s); }, attr = function(s){ return Render5e.attr(s == null ? '' : s); };
  var $ = function(s, r){ return (r || document).querySelector(s); };
  var full = {}, saveT = {}, waiting = {}, view = {open:null, q:'', hits:[], add:false, sure:null}, busy = false;

  function room(){ return window.Sala && Sala.status() === 'on' ? Sala.room() : null; }
  function isDm(){ var r = room(); return !!r && r.role === 'dm'; }
  function box(){ return document.getElementById('mesaEnc'); }
  function visible(){ var c = document.getElementById('combat'); return c && !c.hidden && c.getAttribute('data-tab') === 'encuentros'; }
  function uid(p){ return p + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 6); }
  function mapName(id){ var r = room(), m = r && (r.maps || []).filter(function(x){ return x.id === id; })[0]; return m ? m.name : ''; }
  function mapsOf(){ var r = room(); return r ? (r.maps || []) : []; }
  function runOf(e){ var r = room(); return r && (r.runs || []).filter(function(x){ return x.enc === e.id; })[0]; }
  function ini(n){ return String(n || '?').split(/\s+/).slice(0, 2).map(function(w){ return w.charAt(0); }).join('').toUpperCase(); }
  function sgn(n){ return (n < 0 ? '−' : '+') + Math.abs(n || 0); }

  /* ---------- Datos: el resumen viene en el estado; el encuentro completo, con enc.get ---------- */
  function get(id){ return full[id] || null; }
  /* Guarda (al rato, por si sigues cambiando cosas). Lo de aquí manda mientras lo editas. */
  function put(e){
    full[e.id] = e; clearTimeout(saveT[e.id]);
    saveT[e.id] = setTimeout(function(){ delete saveT[e.id]; Sala.send({t:'enc.save', enc:e}); }, 350);
    if (visible()) render();
  }
  function withFull(id, fn){ if (full[id]) { fn(full[id]); return; } (waiting[id] = waiting[id] || []).push(fn); Sala.send({t:'enc.get', id:id}); }
  if (window.Sala) {
    Sala.on('enc', function(m){
      var e = m.enc; if (!e || !e.id) return;
      var ed = window.Mapas && Mapas._enc && Mapas._enc();
      // mientras lo editas (o falta guardar), tu copia manda; si no, la del servidor (ya limpia)
      if (!saveT[e.id] && !(ed && ed.id === e.id) || !full[e.id]) full[e.id] = e;
      (waiting[e.id] || []).splice(0).forEach(function(fn){ try { fn(full[e.id]); } catch(x){ if (window.console) console.warn(x); } });
      if (visible()) render();
    });
    Sala.on('state', function(r){
      tab(r.role === 'dm');
      // si otro aparato del DM lo cambió, se vuelve a pedir (salvo el que estás editando)
      var ed = window.Mapas && Mapas._enc && Mapas._enc();
      (r.encs || []).forEach(function(s){ var f = full[s.id]; if (f && (s.updated || 0) > (f.updated || 0) && !saveT[s.id] && !(ed && ed.id === s.id) && view.open !== s.id) delete full[s.id]; });
      if (visible()) render();
    });
    Sala.on('left', function(){ full = {}; view.open = null; tab(false); });
  }
  /* La pestaña Encuentros solo la tiene el DM */
  function tab(on){ var b = document.querySelector('#mesaTabs [data-v="encuentros"]'); if (b) b.hidden = !on; }

  /* ---------- Pantalla ---------- */
  function render(){
    var b = box(); if (!b) return;
    var r = room();
    if (!r || !isDm()) { b.innerHTML = '<div class="mesa-lobby card"><p class="note">Los encuentros los prepara el DM antes de la sesión.</p>' + (r ? '' : '<button class="btn main" type="button" data-act="mesatab" data-v="inicio">Elegir campaña</button>') + '</div>'; return; }
    if (view.open) {
      var e = full[view.open], has = (r.encs || []).some(function(x){ return x.id === view.open; });
      if (!e && has) { withFull(view.open, function(){ if (visible()) render(); }); b.innerHTML = '<p class="note">Abriendo el encuentro…</p>'; return; }
      if (e) { putHtml(b, editHtml(e, r)); return; }
      view.open = null;
    }
    putHtml(b, listHtml(r));
  }
  function putHtml(el, html){ var a = document.activeElement; if (a && el.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.type !== 'checkbox' && el.innerHTML && !render.force) return; render.force = false; el.innerHTML = html; }

  function listHtml(r){
    var L = r.encs || [], runs = r.runs || [], old = window.Sala && Sala.legacyEncs ? Sala.legacyEncs() : [];
    var h = '<div class="enc-head"><div><b>Encuentros</b><p class="note">Prepáralos antes de la sesión: el mapa, los enemigos en su lugar, dónde se acomoda el grupo y las oleadas que llegan después.</p></div>'
      + '<div class="enc-acts"><button class="btn main" type="button" data-act="encnew"><svg class="ic"><use href="#i-plus"/></svg>Nuevo encuentro</button>' + ((r.npcs || []).length ? '<button class="btn" type="button" data-act="encnow" title="Guarda los enemigos de ahora (con su lugar en el mapa) como un encuentro">Guardar el combate de ahora</button>' : '') + '</div></div>';
    if (runs.length) h += '<section class="enc-sec"><span class="label">en curso</span>' + runs.map(function(x){
      return '<div class="enc-run card"><svg class="ic"><use href="#i-swords"/></svg><span class="enc-txt"><b>' + esc(x.name) + '</b><small>' + (x.map ? 'en ' + esc(mapName(x.map) || 'un mapa') : 'sin mapa') + (x.waves.length ? ' · faltan ' + x.waves.length + ' oleada' + (x.waves.length === 1 ? '' : 's') : '') + '</small></span>'
        + x.waves.map(function(w){ return '<button class="btn sm" type="button" data-act="encwave" data-map="' + attr(x.map || '') + '" data-v="' + w.n + '"><svg class="ic"><use href="#i-wave"/></svg>' + esc(w.name || 'Oleada ' + w.n) + (w.round ? ' <small>r' + w.round + '</small>' : '') + '</button>'; }).join('')
        + (x.map ? '<button class="btn sm" type="button" data-act="encgomap" data-v="' + attr(x.map) + '"><svg class="ic"><use href="#i-map"/></svg>Ver el mapa</button>' : '') + '</div>';
    }).join('') + '</section>';
    h += '<section class="enc-sec"><span class="label">preparados · ' + L.length + '</span>';
    if (!L.length) h += '<p class="empty-state">Todavía no hay encuentros. Crea uno, elige su mapa y acomoda a los enemigos.</p>';
    else h += '<div class="enc-grid">' + L.map(function(e, i){ return cardHtml(e, runs, i); }).join('') + '</div>';
    h += '</section>';
    if (old.length) h += '<section class="enc-sec"><span class="label">guardados en este aparato (de antes)</span>' + old.map(function(o){ return '<div class="line enc-old"><span class="enc-txt"><b>' + esc(o.name) + '</b><small>' + (o.enc && o.enc.npcs ? o.enc.npcs.length : 0) + ' enemigos · ' + new Date(o.at).toLocaleDateString('es-MX', {day:'numeric', month:'short'}) + '</small></span><button class="btn sm" type="button" data-act="encmigrate" data-id="' + attr(o.id) + '">Pasar a la campaña</button><button class="icon-btn sm" type="button" data-act="encolddel" data-id="' + attr(o.id) + '" aria-label="Borrar ' + attr(o.name) + '"><svg class="ic"><use href="#i-trash"/></svg></button></div>'; }).join('') + '</section>';
    return h;
  }
  function cardHtml(e, runs, i){
    var live = runs.some(function(x){ return x.enc === e.id; }), mn = e.map ? mapName(e.map) : '';
    return '<div class="enc-card card' + (live ? ' live' : '') + '" style="--d:' + (i * 40) + 'ms"><button type="button" class="enc-open" data-act="encopen" data-id="' + attr(e.id) + '"><span class="enc-ic"><svg class="ic"><use href="#' + (e.map ? 'i-map' : 'i-swords') + '"/></svg></span><span class="enc-txt"><b>' + esc(e.name) + '</b>'
      + '<small>' + (e.map ? esc(mn || 'mapa borrado') : 'sin mapa') + ' · ' + e.n + ' enemigo' + (e.n === 1 ? '' : 's') + (e.map && e.n ? ' (' + e.placed + ' en su lugar)' : '') + (e.waves ? ' · ' + (e.waves + 1) + ' oleadas' : '') + (e.deploy ? ' · ' + e.deploy + ' zona' + (e.deploy === 1 ? '' : 's') : '') + '</small>' + (live ? '<i class="tag new">en curso</i>' : '') + '</span></button>'
      + '<div class="enc-btns"><button class="btn main sm" type="button" data-act="encuse" data-id="' + attr(e.id) + '"' + (e.n ? '' : ' disabled title="Agrega enemigos primero"') + '><svg class="ic"><use href="#i-play"/></svg>Usar</button>' + (e.map ? '<button class="btn sm" type="button" data-act="encplace" data-id="' + attr(e.id) + '"><svg class="ic"><use href="#i-token"/></svg>Colocar</button>' : '')
      + '<button class="icon-btn sm" type="button" data-act="encdup" data-id="' + attr(e.id) + '" aria-label="Duplicar" title="Duplicar"><svg class="ic"><use href="#i-copy"/></svg></button><button class="icon-btn sm del" type="button" data-act="encdel" data-id="' + attr(e.id) + '" aria-label="Borrar ' + attr(e.name) + '" title="Borrar"><svg class="ic"><use href="#i-trash"/></svg></button></div></div>';
  }
  function editHtml(e, r){
    var placed = e.npcs.filter(function(d){ return d.x != null; }).length, waves = [1].concat(e.waves.map(function(w){ return w.n; })), run = runOf(e);
    var wname = function(n){ var w = e.waves.filter(function(x){ return x.n === n; })[0]; return n === 1 ? 'Al empezar' : (w && w.name) || 'Oleada ' + n; };
    var h = '<div class="enc-ed"><div class="row enc-ed-h"><button class="btn sm" type="button" data-act="encback"><svg class="ic"><use href="#i-back"/></svg>Encuentros</button><span class="hud-sp"></span>' + (run ? '<i class="tag new">en curso</i>' : '') + '<button class="btn main sm" type="button" data-act="encuse" data-id="' + attr(e.id) + '"' + (e.npcs.length ? '' : ' disabled') + '><svg class="ic"><use href="#i-play"/></svg>Usar ahora</button></div>'
      + '<div class="two"><label class="fl">Nombre<input class="field" data-encf="name" maxlength="60" value="' + attr(e.name) + '" autocomplete="off"></label><label class="fl">Mapa<select class="field" data-encf="map"><option value="">Sin mapa (solo la iniciativa)</option>' + mapsOf().map(function(m){ return '<option value="' + attr(m.id) + '"' + (e.map === m.id ? ' selected' : '') + '>' + esc(m.name) + (m.state === 'prep' ? ' (en preparación)' : '') + '</option>'; }).join('') + '</select></label></div>'
      + '<label class="fl">Notas para ti<textarea class="field" data-encf="notes" rows="2" maxlength="1000" placeholder="Qué quieren, cómo pelean, qué pasa si huyen…">' + esc(e.notes || '') + '</textarea></label>';
    // en el mapa: dónde va cada enemigo y dónde se acomoda el grupo
    if (e.map) h += '<div class="enc-onmap card"><svg class="ic"><use href="#i-map"/></svg><span class="enc-txt"><b>En «' + esc(mapName(e.map)) + '»</b><small>' + placed + ' de ' + e.npcs.length + ' enemigos con su lugar · ' + e.deploy.length + ' zona' + (e.deploy.length === 1 ? '' : 's') + ' de despliegue' + (e.deploy.length ? '' : ' (sin zonas, se acomodan donde quieran)') + '</small></span>'
      + '<button class="btn sm" type="button" data-act="encplace" data-id="' + attr(e.id) + '"><svg class="ic"><use href="#i-token"/></svg>Colocar enemigos</button><button class="btn sm" type="button" data-act="encplace" data-id="' + attr(e.id) + '" data-k="deploy"><svg class="ic"><use href="#i-flag"/></svg>Zonas de despliegue</button></div>';
    // enemigos
    h += '<section class="enc-sec"><span class="label">enemigos · ' + e.npcs.length + ' de 40</span>';
    h += e.npcs.length ? '<div class="enc-npcs">' + e.npcs.map(function(d){
      return '<div class="enc-npc"><span class="enc-av">' + (d.img && window.Mesa ? '<img alt="" loading="lazy" src="' + attr(Mesa.imgUrl(d.img)) + '">' : esc(ini(d.name))) + '</span><span class="enc-txt"><input class="field enc-nm" data-encn="name" data-k="' + attr(d.k) + '" value="' + attr(d.name) + '" maxlength="40" aria-label="Nombre"><small>CA <input class="field mini" data-encn="ac" data-k="' + attr(d.k) + '" inputmode="numeric" value="' + d.ac + '" aria-label="CA de ' + attr(d.name) + '"> PG <input class="field mini" data-encn="hp" data-k="' + attr(d.k) + '" inputmode="numeric" value="' + d.hpMax + '" aria-label="PG de ' + attr(d.name) + '"> inic. ' + sgn(d.initMod) + (d.x != null ? ' · en su lugar' : '') + '</small></span>'
        + '<select class="field enc-w" data-encn="wave" data-k="' + attr(d.k) + '" aria-label="Oleada de ' + attr(d.name) + '">' + waves.map(function(n){ return '<option value="' + n + '"' + (d.wave === n ? ' selected' : '') + '>' + esc(wname(n)) + '</option>'; }).join('') + '</select>'
        + '<label class="toggle sm" title="Oculto para los jugadores hasta que lo muestres"><input type="checkbox" data-encn="hidden" data-k="' + attr(d.k) + '"' + (d.hidden ? ' checked' : '') + '> Oculto</label><button class="icon-btn sm" type="button" data-act="encndel" data-k="' + attr(d.k) + '" aria-label="Quitar a ' + attr(d.name) + '"><svg class="ic"><use href="#i-x"/></svg></button></div>';
    }).join('') + '</div>' : '<p class="note">Agrega enemigos del Manual de Monstruos o a mano.</p>';
    h += addHtml(e) + '</section>';
    // oleadas
    h += '<section class="enc-sec"><span class="label">oleadas</span><div class="enc-waves"><div class="enc-wave"><svg class="ic"><use href="#i-wave"/></svg><b>Oleada 1</b><small>Llegan al usar el encuentro · ' + e.npcs.filter(function(d){ return d.wave === 1; }).length + '</small></div>'
      + e.waves.map(function(w){ return '<div class="enc-wave"><svg class="ic"><use href="#i-wave"/></svg><b>' + w.n + '</b><input class="field" data-encw="name" data-n="' + w.n + '" value="' + attr(w.name || '') + '" placeholder="Refuerzos" maxlength="40" aria-label="Nombre de la oleada ' + w.n + '"><label class="fl sm">Llega en la ronda<input class="field mini" data-encw="round" data-n="' + w.n + '" inputmode="numeric" value="' + (w.round || '') + '" placeholder="–" aria-label="Ronda en que llega la oleada ' + w.n + '"></label><small>' + e.npcs.filter(function(d){ return d.wave === w.n; }).length + ' enemigos</small><button class="icon-btn sm" type="button" data-act="encwdel" data-n="' + w.n + '" aria-label="Quitar la oleada ' + w.n + '"><svg class="ic"><use href="#i-x"/></svg></button></div>'; }).join('')
      + (e.waves.length < 8 ? '<button class="btn sm" type="button" data-act="encwadd"><svg class="ic"><use href="#i-plus"/></svg>Otra oleada</button>' : '') + '</div><p class="note">Sin ronda, la sueltas tú desde el mapa o desde aquí cuando quieras. Con el combate empezado, sus enemigos entran con su iniciativa tirada.</p></section>';
    return h + '<div class="dm-row"><button class="btn sm del" type="button" data-act="encdel" data-id="' + attr(e.id) + '"><svg class="ic"><use href="#i-trash"/></svg>Borrar el encuentro</button></div></div>';
  }
  /* Agregar enemigos: del Manual de Monstruos (con su ficha e imagen) o a mano */
  function addHtml(e){
    var has = window.Bestiario && Bestiario.has();
    var h = '<div class="enc-add card"><div class="row"><b>Agregar</b>' + (has ? '<input class="field" id="encQ" type="search" placeholder="Buscar en el Manual de Monstruos…" value="' + attr(view.q) + '" autocomplete="off" aria-label="Buscar monstruo">' : '<small class="muted">Carga el bestiario en Ajustes para buscar monstruos.</small>') + '<label class="fl sm">Cuántos<input class="field mini" id="encCount" inputmode="numeric" value="1" aria-label="Cuántos"></label></div>';
    if (has && view.hits.length) h += '<div class="enc-hits">' + view.hits.map(function(x){ return '<button type="button" class="enc-hit" data-act="encaddref" data-ref="' + attr(x.ref) + '"' + (busy ? ' disabled' : '') + '><b>' + esc(x.name) + '</b><small>VD ' + esc(x.cr) + ' · ' + esc(x.type) + '</small></button>'; }).join('') + '</div>';
    return h + '<form class="enc-hand" data-form="enchand"><input class="field" name="name" placeholder="A mano: nombre" maxlength="40" autocomplete="off" aria-label="Nombre"><input class="field mini" name="ac" inputmode="numeric" placeholder="CA" aria-label="CA"><input class="field mini" name="hp" inputmode="numeric" placeholder="PG" aria-label="PG"><input class="field mini" name="init" inputmode="numeric" placeholder="+inic." aria-label="Modificador de iniciativa"><button class="btn sm" type="submit">Agregar</button></form></div>';
  }

  /* ---------- En el mapa: los encuentros de ese mapa (popover del HUD del DM) ---------- */
  function mapPop(mp){
    var r = room(), L = r ? (r.encs || []).filter(function(e){ return e.map === mp.id; }) : [], runs = r ? r.runs || [] : [];
    return '<div class="encpop"><div class="row"><b><svg class="ic"><use href="#i-scroll"/></svg>Encuentros de este mapa</b><button class="icon-btn sm" type="button" data-act="mappopx" aria-label="Cerrar"><svg class="ic"><use href="#i-x"/></svg></button></div>'
      + (L.length ? L.map(function(e){ var live = runs.some(function(x){ return x.enc === e.id; }); return '<div class="enc-line"><span class="enc-txt"><b>' + esc(e.name) + '</b><small>' + e.n + ' enemigo' + (e.n === 1 ? '' : 's') + (e.waves ? ' · ' + (e.waves + 1) + ' oleadas' : '') + (e.deploy ? ' · ' + e.deploy + ' zona' + (e.deploy === 1 ? '' : 's') : '') + (live ? ' · en curso' : '') + '</small></span><button class="btn main sm" type="button" data-act="encuse" data-id="' + attr(e.id) + '"' + (e.n ? '' : ' disabled') + '>Usar</button><button class="btn sm" type="button" data-act="encplace" data-id="' + attr(e.id) + '">Colocar</button><button class="icon-btn sm" type="button" data-act="encopen" data-id="' + attr(e.id) + '" aria-label="Abrir su ficha" title="Su ficha"><svg class="ic"><use href="#i-scroll"/></svg></button></div>'; }).join('') : '<p class="note">Todavía no hay encuentros en este mapa.</p>')
      + '<div class="dm-row"><button class="btn sm" type="button" data-act="encnew" data-map="' + attr(mp.id) + '"><svg class="ic"><use href="#i-plus"/></svg>Nuevo aquí</button><button class="btn sm" type="button" data-act="encall">Todos los encuentros</button></div></div>';
  }

  /* ---------- Acciones ---------- */
  function blank(map){ return {id:uid('E'), name:'Encuentro nuevo', map:map || null, notes:'', npcs:[], deploy:[], waves:[], updated:Date.now()}; }
  function nk(e){ var k; do { k = Math.random().toString(36).slice(2, 6); } while (e.npcs.some(function(d){ return d.k === k; })); return k; }
  function nextName(e, base, i, count){ if (count <= 1 && !e.npcs.some(function(d){ return d.name.replace(/\s+\d+$/, '') === base; })) return base; var n = e.npcs.filter(function(d){ return d.name.replace(/\s+\d+$/, '') === base; }).length; return base + ' ' + (n + 1); }
  function addMany(e, base, count){ var n = Math.max(1, Math.min(12, count || 1)), room0 = 40 - e.npcs.length; if (room0 <= 0) { Sala.toast('Un encuentro lleva hasta 40 enemigos.'); return 0; } n = Math.min(n, room0); var nm0 = base.name; for (var i = 0; i < n; i++) { var d = JSON.parse(JSON.stringify(base)); d.k = nk(e); d.name = nextName(e, nm0, i, n); d.wave = d.wave || 1; e.npcs.push(d); } return n; }
  function open(id){ view.open = id; view.q = ''; view.hits = []; if (window.Mesa) Mesa.show('encuentros'); render.force = true; render(); }
  function useIt(id, btn){
    var r = room(), s = r && (r.encs || []).filter(function(x){ return x.id === id; })[0]; if (!s) return;
    var busyRun = (r.runs || []).filter(function(x){ return (x.map || null) === (s.map || null); })[0];
    if (busyRun && btn && !btn.dataset.sure) { btn.dataset.sure = 1; btn.textContent = busyRun.enc === id ? '¿Empezarlo otra vez?' : '¿Reemplazar «' + busyRun.name + '»?'; return; }
    var go = function(){ if (!Sala.send({t:'enc.use', id:id})) return; if (window.Mapas) Mapas.closePop(); Sala.toast('¡«' + s.name + '» en marcha! El grupo se une, se acomoda y tira iniciativa.'); if (s.map && window.Mapas) { view.open = null; if (window.Mesa) Mesa.show('mapas'); if (Mapas.cur() !== s.map) Mapas.open(s.map); } };
    if (saveT[id]) { clearTimeout(saveT[id]); delete saveT[id]; Sala.send({t:'enc.save', enc:full[id]}); }
    go();
  }
  function fromNow(){
    // los enemigos de ahora, con su lugar en el mapa donde están (o el que está en pantalla)
    var r = room(); if (!r) return; var all = window.Mapas ? Mapas._maps() : {}, at = {};
    r.npcs.forEach(function(n){ var k = n.at || r.scene; if (k) at[k] = (at[k] || 0) + 1; });
    var map = Object.keys(at).sort(function(a, b){ return at[b] - at[a]; })[0] || null, mp = map && all[map], e = blank(map && mapName(map) ? map : null);
    e.name = 'Combate del ' + new Date().toLocaleDateString('es-MX', {day:'numeric', month:'short'});
    r.npcs.slice(0, 40).forEach(function(n){
      var d = {k:nk(e), name:n.name, ac:n.ac, hp:n.hpMax, hpMax:n.hpMax, ref:n.ref || null, initMod:n.initMod || 0, formula:n.formula || null, img:n.img || null, binfo:n.binfo || null, hidden:!!n.hidden, wave:1, s:1};
      var t = mp && mp.tokens.filter(function(x){ return x.kind === 'npc' && x.ref === n.id; })[0]; if (t && e.map) { d.x = t.x; d.y = t.y; d.s = t.s || 1; d.color = t.color; }
      e.npcs.push(d);
    });
    put(e); open(e.id); Sala.toast('Guardado como «' + e.name + '». Cámbiale el nombre si quieres.');
  }
  function migrate(id){
    var o = (Sala.legacyEncs() || []).filter(function(x){ return x.id === id; })[0]; if (!o || !o.enc) return;
    var e = blank(null); e.name = o.name || e.name;
    (o.enc.npcs || []).slice(0, 40).forEach(function(n){ e.npcs.push({k:nk(e), name:n.name, ac:n.ac, hp:n.hpMax || n.hp, hpMax:n.hpMax || n.hp, ref:n.ref || null, initMod:n.initMod || 0, formula:n.formula || null, hidden:!!n.hidden, wave:1, s:1}); });
    put(e); Sala.dropLegacy(id); Sala.toast('«' + e.name + '» ya está en la campaña. Elige su mapa y acomoda a los enemigos.'); open(e.id);
  }
  function search(q){ view.q = q; view.hits = q && window.Bestiario ? Bestiario.search(q, 8) : []; var b = box(), hits = b && b.querySelector('.enc-hits'), add = b && b.querySelector('.enc-add'); if (add) { var tmp = document.createElement('div'); tmp.innerHTML = addHtml(full[view.open] || blank()); var nh = tmp.querySelector('.enc-hits'); if (hits) hits.remove(); if (nh) add.querySelector('.row').insertAdjacentElement('afterend', nh); } }
  function addRef(e, ref){
    var base = window.Bestiario && Bestiario.npcOf(ref); if (!base) return;
    var cnt = parseInt((($('#encCount') || {}).value || '1'), 10) || 1, d = {name:base.name, ac:base.ac, hp:base.hp, hpMax:base.hp, ref:base.ref, initMod:base.initMod, formula:base.formula, binfo:base.binfo, s:base.s, wave:1, hidden:false, img:null};
    busy = true; render.force = true; render();
    var img = window.Retratos ? Promise.race([Retratos.monster(ref), new Promise(function(res){ setTimeout(function(){ res(null); }, 4000); })]) : Promise.resolve(null);
    img.then(function(id){ busy = false; if (id) d.img = id; var n = addMany(e, d, cnt); view.q = ''; view.hits = []; render.force = true; put(e); if (n) Sala.toast((n > 1 ? n + ' × ' : '') + base.name + ' en el encuentro.'); }).catch(function(){ busy = false; render(); });
  }

  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('[data-act]'); if (!b || b.dataset.act.indexOf('enc') !== 0) return;
    var a = b.dataset.act, e = view.open && full[view.open];
    if (a === 'encnew') { var ne = blank(b.dataset.map || null); put(ne); if (b.dataset.map && window.Mapas) Mapas.refreshPop(); open(ne.id); }
    else if (a === 'encopen') open(b.dataset.id);
    else if (a === 'encback') { view.open = null; render.force = true; render(); }
    else if (a === 'encall') { view.open = null; if (window.Mesa) Mesa.show('encuentros'); }
    else if (a === 'encnow') fromNow();
    else if (a === 'encuse') useIt(b.dataset.id, b);
    else if (a === 'encplace') withFull(b.dataset.id, function(x){ if (!x.map) { Sala.toast('Primero elige el mapa del encuentro.'); return; } if (window.Mapas) Mapas.editEnc(x.id, b.dataset.k || 'npc'); });
    else if (a === 'encdup') withFull(b.dataset.id, function(x){ var c = JSON.parse(JSON.stringify(x)); c.id = uid('E'); c.name = (x.name + ' (copia)').slice(0, 60); put(c); Sala.toast('Copia lista: «' + c.name + '».'); });
    else if (a === 'encdel') { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = '¿Borrarlo? Toca otra vez'; return; } clearTimeout(saveT[b.dataset.id]); delete saveT[b.dataset.id]; delete full[b.dataset.id]; Sala.send({t:'enc.del', id:b.dataset.id}); if (view.open === b.dataset.id) view.open = null; render.force = true; render(); }
    else if (a === 'encwave') Sala.send({t:'enc.wave', map:b.dataset.map || null, n:+b.dataset.v});
    else if (a === 'encgomap') { if (window.Mesa) Mesa.show('mapas'); if (window.Mapas) Mapas.open(b.dataset.v); }
    else if (a === 'encmigrate') migrate(b.dataset.id);
    else if (a === 'encolddel') { if (!b.dataset.sure) { b.dataset.sure = 1; b.style.borderColor = 'var(--bad)'; return; } Sala.dropLegacy(b.dataset.id); render(); }
    else if (!e) return;
    else if (a === 'encndel') { e.npcs = e.npcs.filter(function(d){ return d.k !== b.dataset.k; }); render.force = true; put(e); }
    else if (a === 'encwadd') { var n = 2; while (e.waves.some(function(w){ return w.n === n; })) n++; if (n > 9) return; e.waves.push({n:n, name:'', round:0}); render.force = true; put(e); }
    else if (a === 'encwdel') { var wn = +b.dataset.n; e.waves = e.waves.filter(function(w){ return w.n !== wn; }); e.npcs.forEach(function(d){ if (d.wave === wn) d.wave = 1; }); render.force = true; put(e); }
    else if (a === 'encaddref') addRef(e, b.dataset.ref);
  });
  document.addEventListener('input', function(ev){ if (ev.target && ev.target.id === 'encQ') search(ev.target.value.trim()); });
  document.addEventListener('change', function(ev){
    var t = ev.target, e = view.open && full[view.open]; if (!e || !t.dataset) return;
    if (t.dataset.encf) {
      var f = t.dataset.encf;
      if (f === 'name') e.name = t.value.trim().slice(0, 60) || 'Encuentro';
      else if (f === 'notes') e.notes = t.value.slice(0, 1000);
      else if (f === 'map') { e.map = t.value || null; e.deploy = []; e.npcs.forEach(function(d){ delete d.x; delete d.y; }); render.force = true; }
      put(e);
    } else if (t.dataset.encn) {
      var d = e.npcs.filter(function(x){ return x.k === t.dataset.k; })[0]; if (!d) return; var k = t.dataset.encn;
      if (k === 'name') d.name = t.value.trim().slice(0, 40) || d.name;
      else if (k === 'ac') d.ac = Math.max(0, Math.min(40, parseInt(t.value, 10) || d.ac));
      else if (k === 'hp') { d.hpMax = Math.max(1, Math.min(9999, parseInt(t.value, 10) || d.hpMax)); d.hp = d.hpMax; }
      else if (k === 'wave') d.wave = +t.value || 1;
      else if (k === 'hidden') d.hidden = t.checked;
      put(e);
    } else if (t.dataset.encw) {
      var w = e.waves.filter(function(x){ return x.n === +t.dataset.n; })[0]; if (!w) return;
      if (t.dataset.encw === 'name') w.name = t.value.trim().slice(0, 40); else w.round = Math.max(0, Math.min(99, parseInt(t.value, 10) || 0));
      put(e);
    }
  });
  document.addEventListener('submit', function(ev){
    var f = ev.target; if (!f.dataset || f.dataset.form !== 'enchand') return; ev.preventDefault();
    var e = view.open && full[view.open]; if (!e) return;
    var nm = f.elements.name.value.trim(), hp = parseInt(f.elements.hp.value, 10); if (!nm) { f.elements.name.focus(); return; } if (!(hp > 0)) { f.elements.hp.focus(); return; }
    var cnt = parseInt((($('#encCount') || {}).value || '1'), 10) || 1, n = addMany(e, {name:nm, ac:parseInt(f.elements.ac.value, 10) || 12, hp:hp, hpMax:hp, initMod:parseInt(f.elements.init.value, 10) || 0, wave:1, s:1}, cnt);
    render.force = true; put(e); if (n) Sala.toast((n > 1 ? n + ' × ' : '') + nm + ' en el encuentro.');
  });

  return {render:render, get:get, put:put, mapPop:mapPop, open:open, _full:function(){ return full; }};
})();
