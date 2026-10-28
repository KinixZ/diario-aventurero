/* ==================== BESTIARIO DEL DIARIO ==================== */
/* Separador «Bestiario» del diario, sin entrar a una campaña:
   - Nuestros encuentros: lo que el grupo ha encontrado en cada campaña (lo que el DM reveló y las notas de todos).
     Cada teléfono guarda una copia en IndexedDB (`encuentros`) cada vez que la campaña le manda algo, así se puede
     revisar sin conexión.
   - Manual de Monstruos: el archivo bestiario-5e.json cargado en Ajustes; marca lo que ya encontraron. */
var Cronica = (function(){
  var esc = function(s){ return Render5e.esc(s == null ? '' : s); }, attr = function(s){ return Render5e.attr(s == null ? '' : s); };
  var $ = function(s, r){ return (r || document).querySelector(s); };
  var KEY = 'encuentros', KINDS = {enemigo:'Enemigo', pnj:'PNJ', criatura:'Criatura'};
  var INFO = [['type','Tipo'],['size','Tamaño'],['cr','VD'],['ac','CA'],['hp','PG'],['speed','Velocidad'],['where','Dónde lo vieron']];
  var DB = {camps:{}}, loaded = false, view = {part:'enc', camp:'*', q:'', kind:'*', open:null}, saveT = null, metRefs = {};

  /* ---------- Guardado ---------- */
  function idb(){ return new Promise(function(res, rej){ var r = indexedDB.open('diario5e', 2); r.onupgradeneeded = function(){ if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); }; r.onsuccess = function(){ res(r.result); }; r.onerror = function(){ rej(r.error); }; }); }
  function load(){ return idb().then(function(db){ return new Promise(function(res){ var q = db.transaction('kv').objectStore('kv').get(KEY); q.onsuccess = function(){ res(q.result); }; q.onerror = function(){ res(null); }; }); }).catch(function(){ return null; }).then(function(v){ if (v && v.camps) DB = v; loaded = true; index(); render(); }); }
  function save(){ clearTimeout(saveT); saveT = setTimeout(function(){ idb().then(function(db){ var t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(DB, KEY); }).catch(function(){}); }, 600); }
  function index(){ metRefs = {}; Object.keys(DB.camps).forEach(function(c){ var bs = DB.camps[c].beasts || {}; Object.keys(bs).forEach(function(id){ var b = bs[id]; if (b.ref) metRefs[String(b.ref).toLowerCase()] = 1; }); }); }
  function met(ref){ return !!metRefs[String(ref || '').toLowerCase()]; }

  /* ---------- Lo que manda la campaña ---------- */
  function camp(code, name){ var c = DB.camps[code]; if (!c) c = DB.camps[code] = {name:name || code, beasts:{}, at:Date.now()}; if (name) c.name = name; return c; }
  Sala.on('state', function(r){
    if (!r || !r.code) return; var c = camp(r.code, r.name), seen = {}, ch = false;
    (r.beasts || []).forEach(function(s){
      if (s.hidden) return; seen[s.id] = 1;
      var o = c.beasts[s.id] || {}, n = {id:s.id, name:s.name, kind:s.kind, img:s.img, info:s.info || {}, ref:s.ref || o.ref || null, manual:!!s.manual, seen:s.seen, ses:s.ses, notes:o.notes || [], nNotes:s.notes || 0, text:o.text || '', stat:o.stat || null, hasStat:!!s.hasStat};
      if (!o.id || o.name !== n.name || o.img !== n.img || o.nNotes !== n.nNotes || o.hasStat !== n.hasStat || JSON.stringify(o.info) !== JSON.stringify(n.info)) ch = true;
      c.beasts[s.id] = n;
    });
    Object.keys(c.beasts).forEach(function(id){ if (!seen[id]) { delete c.beasts[id]; ch = true; } });
    if (ch) { c.at = Date.now(); index(); save(); if (visible()) render(); }
  });
  Sala.on('beast', function(m){
    var code = Sala.code(), r = Sala.room(); if (!code || !m.beast || m.beast.hidden) return;
    var c = camp(code, r && r.name), b = m.beast, o = c.beasts[b.id] || {};
    c.beasts[b.id] = {id:b.id, name:b.name, kind:b.kind, img:b.img, info:b.info || {}, ref:b.ref || null, manual:!!b.manual, seen:b.seen || o.seen, ses:b.ses || o.ses, notes:b.notes || [], nNotes:(b.notes || []).length, text:b.text || '', stat:b.stat || null, hasStat:!!b.stat, full:true};
    index(); save(); if (visible()) render();
  });

  /* ---------- Vista ---------- */
  function box(){ return document.getElementById('pBestias'); }
  function visible(){ var b = box(); return b && !b.hidden; }
  function all(){ var out = []; Object.keys(DB.camps).forEach(function(code){ var c = DB.camps[code]; Object.keys(c.beasts || {}).forEach(function(id){ var b = c.beasts[id]; out.push({b:b, code:code, camp:c.name}); }); }); return out.sort(function(x, y){ return (y.b.seen || 0) - (x.b.seen || 0); }); }
  function norm(s){ return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function initials(n){ return String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(function(w){ return w.charAt(0); }).join('').toUpperCase(); }
  function imgUrl(code, id){ return (window.Sala ? Sala.httpBase() : '') + '/api/img/' + code + '/' + id; }
  function when(t){ return t ? new Date(t).toLocaleDateString('es-MX', {day:'numeric', month:'short', year:'numeric'}) : ''; }
  function online(code){ return Sala.status() === 'on' && Sala.code() === code; }
  function portrait(x, big){ var b = x.b; return '<span class="bx-face' + (big ? ' big' : '') + ' k-' + attr(b.kind || 'enemigo') + '">' + (b.img ? '<img alt="" loading="lazy" src="' + attr(imgUrl(x.code, b.img)) + '" onerror="this.remove()">' : '') + '<b>' + esc(initials(b.name)) + '</b></span>'; }

  function render(){
    var el = box(); if (!el || el.hidden) return;
    if (!loaded) { el.innerHTML = '<p class="note">Abriendo el bestiario…</p>'; return; }
    var h = '<div class="bx-home"><div class="bx-tabs" role="tablist"><button type="button" role="tab" data-act="bxpart" data-v="enc" aria-selected="' + (view.part === 'enc') + '"><svg class="ic"><use href="#i-paw"/></svg>Nuestros encuentros</button><button type="button" role="tab" data-act="bxpart" data-v="man" aria-selected="' + (view.part === 'man') + '"><svg class="ic"><use href="#i-tome"/></svg>Manual de Monstruos</button></div>';
    h += view.part === 'man' ? manualHtml() : view.open ? detailHtml() : listHtml();
    el.innerHTML = h + '</div>';
    if (window.Bestiario && !Bestiario.has() && !render.tried) { render.tried = true; Bestiario.ready().then(function(ok){ if (ok && visible()) render(); }); }
  }

  function listHtml(){
    var L = all(), codes = Object.keys(DB.camps).filter(function(c){ return Object.keys(DB.camps[c].beasts || {}).length; }), q = norm(view.q);
    if (view.camp !== '*' && !DB.camps[view.camp]) view.camp = '*';
    var res = L.filter(function(x){ return (view.camp === '*' || x.code === view.camp) && (view.kind === '*' || x.b.kind === view.kind) && (!q || norm(x.b.name).indexOf(q) >= 0); });
    var h = '<p class="bx-intro">Lo que han encontrado en sus aventuras. Se guarda en este teléfono: lo puedes revisar sin entrar a la campaña.</p>';
    if (!L.length) return h + '<div class="bx-empty"><svg class="ic"><use href="#i-paw"/></svg><b>Páginas en blanco… por ahora</b><span>Cuando el DM meta al combate un monstruo de los manuales, o registre una criatura, aparecerá aquí.</span></div>';
    h += '<div class="bx-f"><input class="field" id="crQ" type="search" placeholder="Buscar entre ' + L.length + '…" aria-label="Buscar encuentros" autocomplete="off" value="' + attr(view.q) + '">'
      + (codes.length > 1 ? '<select class="field" id="crCamp" aria-label="Campaña"><option value="*">Todas las campañas</option>' + codes.map(function(c){ return '<option value="' + attr(c) + '"' + (view.camp === c ? ' selected' : '') + '>' + esc(DB.camps[c].name) + '</option>'; }).join('') + '</select>' : '')
      + '<div class="seg sm" role="group" aria-label="Tipo">' + [['*','Todos'],['enemigo','Enemigos'],['pnj','PNJ'],['criatura','Criaturas']].map(function(k){ return '<button type="button" data-act="bxkind" data-v="' + k[0] + '" aria-pressed="' + (view.kind === k[0]) + '">' + k[1] + '</button>'; }).join('') + '</div></div>';
    h += '<div class="bx-grid">' + res.map(function(x, i){
      var b = x.b, inf = b.info || {};
      return '<button type="button" class="bx-card k-' + attr(b.kind || 'enemigo') + '" data-act="bxopen" data-code="' + attr(x.code) + '" data-id="' + attr(b.id) + '" style="--d:' + Math.min(i, 14) * 40 + 'ms">' + portrait(x)
        + '<span class="bx-name">' + esc(b.name) + '</span><span class="bx-sub">' + esc([KINDS[b.kind] || 'Enemigo', inf.type, inf.cr ? 'VD ' + inf.cr : ''].filter(Boolean).join(' · ')) + '</span>'
        + '<span class="bx-meta">' + (b.manual ? '<i class="tag">del Manual</i>' : '') + (b.hasStat ? '<i class="tag">ficha</i>' : '') + (b.nNotes ? '<i class="tag">' + b.nNotes + ' nota' + (b.nNotes === 1 ? '' : 's') + '</i>' : '') + '</span>'
        + '<span class="bx-when">' + (codes.length > 1 && view.camp === '*' ? esc(x.camp) + ' · ' : '') + (b.ses ? 'Sesión ' + b.ses + ' · ' : '') + esc(when(b.seen)) + '</span></button>';
    }).join('') + '</div>' + (!res.length ? '<p class="empty-state">Nada con ese filtro.</p>' : '');
    return h;
  }

  function detailHtml(){
    var p = view.open, c = DB.camps[p.code], b = c && c.beasts[p.id]; if (!b) { view.open = null; return listHtml(); }
    var x = {b:b, code:p.code, camp:c.name}, inf = b.info || {}, live = online(p.code), hasMan = window.Bestiario && Bestiario.has() && b.ref && Bestiario.find(b.ref);
    if (live && !b.full) Sala.send({t:'beast.get', id:b.id});
    var h = '<div class="bx-detail"><button class="btn sm" type="button" data-act="bxback"><svg class="ic"><use href="#i-back"/></svg>Encuentros</button>';
    h += '<div class="bx-page"><div class="bx-top">' + portrait(x, true) + '<div><h3>' + esc(b.name) + '</h3><p class="muted">' + esc(KINDS[b.kind] || 'Enemigo') + ' · ' + esc(c.name) + (b.ses ? ' · sesión ' + b.ses : '') + (b.seen ? ' · visto el ' + esc(when(b.seen)) : '') + '</p>'
      + (b.ref && b.manual ? (hasMan ? '<button class="btn sm" type="button" data-act="bestref" data-ref="' + attr(b.ref) + '"><svg class="ic"><use href="#i-tome"/></svg>Leer en el Manual</button>' : '<p class="note">Viene del Manual de Monstruos. Carga el Manual en Ajustes para leer su entrada.</p>') : '') + '</div></div>';
    var rows = INFO.filter(function(k){ return inf[k[0]]; });
    if (rows.length) h += '<dl class="gmeta bx-info">' + rows.map(function(k){ return '<dt>' + k[1] + '</dt><dd>' + esc(inf[k[0]]) + '</dd>'; }).join('') + '</dl>';
    if (b.text) h += '<div class="bx-text">' + esc(b.text).replace(/\n/g, '<br>') + '</div>';
    if (b.stat && window.Bestiario) h += '<details class="feat-d gr-stat"><summary><b>Ficha completa</b><small>la compartió el DM</small></summary><div style="padding:0 12px 12px">' + Bestiario.statHtml(b.stat) + '</div></details>';
    else if (b.hasStat && !b.full) h += '<p class="note">El DM compartió su ficha completa: entra a la campaña una vez para guardarla en este teléfono.</p>';
    var notes = b.notes || [];
    h += '<div class="bx-notes"><span class="label">notas del grupo</span>' + (notes.length ? notes.map(function(n){ return '<div class="bx-note"><b>' + esc(n.name) + '</b><time>' + esc(when(n.at)) + '</time><p>' + esc(n.text).replace(/\n/g, '<br>') + '</p></div>'; }).join('') : '<p class="note">' + (b.nNotes ? 'Hay ' + b.nNotes + ' nota' + (b.nNotes === 1 ? '' : 's') + ': entra a la campaña para traerlas.' : 'Nadie ha escrito nada todavía.') + '</p>')
      + (live ? '<form class="gr-noteform" data-form="grnote" data-id="' + attr(b.id) + '"><textarea class="field" name="text" rows="2" maxlength="600" placeholder="Lo que descubrieron: le duele el fuego, huyó al norte…" aria-label="Tu nota"></textarea><button class="btn main" type="submit">Anotar</button></form>' : '<p class="note">Para anotar algo, entra a «' + esc(c.name) + '».</p>') + '</div>';
    return h + '</div></div>';
  }

  function manualHtml(){
    if (!window.Bestiario) return '';
    if (!Bestiario.has()) return '<div class="bx-empty man"><svg class="ic"><use href="#i-tome"/></svg><b>El Manual no está en este teléfono</b><span>Sale de tu copia de 5etools. En la laptop: <code>npm run bestiario -- ./5etools-src/data ./bestiario-5e.json</code>, y luego cárgalo en Ajustes → Manual de Monstruos.</span><button class="btn main" type="button" data-act="settings">Ir a Ajustes</button></div>';
    var n = Bestiario.count(), m = Object.keys(metRefs).length;
    return '<div class="bx-man"><div class="bx-cover"><svg class="ic"><use href="#i-tome"/></svg><div><b>Manual de Monstruos</b><span>' + n + ' criaturas · ' + m + ' ya encontrada' + (m === 1 ? '' : 's') + ' por el grupo</span></div></div>'
      + '<form class="bx-mansearch" data-form="bxman"><input class="field" name="q" type="search" placeholder="Busca: ogro, beholder, dragón rojo…" aria-label="Buscar en el Manual" autocomplete="off"><button class="btn main" type="submit">Buscar</button></form>'
      + '<button class="btn" type="button" data-act="bxmanall" style="width:100%">Hojear todo el Manual</button>'
      + '<p class="note">Ojo con los spoilers: lo que leas aquí, tu personaje no necesariamente lo sabe.</p></div>';
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('[data-act]'); if (!b) return;
    var a = b.dataset.act; if (a.indexOf('bx') !== 0) return;
    if (a === 'bxpart') { view.part = b.dataset.v; view.open = null; render(); }
    else if (a === 'bxkind') { view.kind = b.dataset.v; render(); }
    else if (a === 'bxopen') { view.open = {code:b.dataset.code, id:b.dataset.id}; render(); var sc = document.getElementById('scroll'); if (sc) sc.scrollTop = 0; }
    else if (a === 'bxback') { view.open = null; render(); }
    else if (a === 'bxmanall') Bestiario.open(null, true, '');
  });
  document.addEventListener('submit', function(ev){ var f = ev.target; if (!f.dataset || f.dataset.form !== 'bxman') return; ev.preventDefault(); Bestiario.open(null, true, f.elements.q.value.trim()); });
  document.addEventListener('input', function(ev){ if (ev.target.id === 'crQ') { view.q = ev.target.value; var pos = ev.target.selectionStart; render(); var q = $('#crQ'); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch(e){} } } });
  document.addEventListener('change', function(ev){ if (ev.target.id === 'crCamp') { view.camp = ev.target.value; render(); } });

  load();
  return {render:render, met:met, _db:function(){ return DB; }};
})();
