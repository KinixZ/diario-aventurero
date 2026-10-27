
/* ==================== BESTIARIO DEL DM ==================== */
/* Archivo aparte (bestiario-5e.json, lo crea "npm run bestiario"). Solo lo carga el DM en su teléfono o laptop.
   Busca enemigos, muestra su ficha y los agrega a la iniciativa de la sala con CA, PG y modificador de iniciativa. */
var Bestiario = (function(){
  var esc = function(s){ return Render5e.esc(s == null ? '' : s); }, attr = function(s){ return Render5e.attr(s == null ? '' : s); };
  var $ = function(s, r){ return (r || document).querySelector(s); };
  var list = null, groups = {}, meta = null, loading = null, view = {q:'', cr:'*', type:'*', src:'*', old:false, ref:null, readOnly:false, shown:60};
  var TYPE_ES = {aberration:'aberración', beast:'bestia', celestial:'celestial', construct:'constructo', dragon:'dragón', elemental:'elemental', fey:'feérico', fiend:'infernal', giant:'gigante', humanoid:'humanoide', monstrosity:'monstruosidad', ooze:'cieno', plant:'planta', undead:'muerto viviente'};
  var SIZE_ES = {T:'Diminuto', S:'Pequeño', M:'Mediano', L:'Grande', H:'Enorme', G:'Gargantuesco'};
  var AB = ['str','dex','con','int','wis','cha'], ABN = {str:'FUE', dex:'DES', con:'CON', int:'INT', wis:'SAB', cha:'CAR'};
  var DMG_ES = {force:'fuerza', fire:'fuego', cold:'frío', lightning:'relámpago', thunder:'trueno', acid:'ácido', poison:'veneno', necrotic:'necrótico', radiant:'radiante', psychic:'psíquico', slashing:'cortante', piercing:'perforante', bludgeoning:'contundente'};
  var CR_OPTS = [['*','Cualquier VD'],['0-1','0 a 1'],['2-4','2 a 4'],['5-10','5 a 10'],['11-16','11 a 16'],['17-30','17 o más']];

  /* ---------- Guardado en el dispositivo (IndexedDB, misma base que la biblioteca) ---------- */
  function idb(){ return new Promise(function(res, rej){ var r = indexedDB.open('diario5e', 2); r.onupgradeneeded = function(){ if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); }; r.onsuccess = function(){ res(r.result); }; r.onerror = function(){ rej(r.error); }; }); }
  function idbGet(k){ return idb().then(function(db){ return new Promise(function(res){ var q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = function(){ res(q.result); }; q.onerror = function(){ res(null); }; }); }).catch(function(){ return null; }); }
  function idbPut(k, v){ return idb().then(function(db){ return new Promise(function(res){ var t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = function(){ res(true); }; t.onerror = function(){ res(false); }; }); }).catch(function(){ return false; }); }
  function idbDel(k){ return idb().then(function(db){ return new Promise(function(res){ var t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = function(){ res(true); }; }); }).catch(function(){ return false; }); }
  function setData(j){
    list = (j.monster || []).filter(function(m){ return m && m.name && m.source; });
    groups = {}; (j.legendaryGroup || []).forEach(function(g){ groups[key(g.name, g.source)] = g; });
    meta = j._bestiario || {monstruos: list.length};
    list.forEach(function(m){ m._k = key(m.name, m.source); m._n = norm(m.name + ' ' + (m.alias || []).join(' ')); m._cr = crNum(m.cr); m._t = typeName(m.type); });
  }
  function ready(){ if (list) return Promise.resolve(true); if (!loading) loading = idbGet('bestiary').then(function(j){ if (j && j.monster) setData(j); return !!list; }); return loading; }
  function has(){ return !!(list && list.length); }
  function key(n, s){ return String(n).toLowerCase() + '|' + String(s).toLowerCase(); }
  function norm(s){ return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function crNum(cr){ var c = cr && typeof cr === 'object' ? cr.cr : cr; if (c == null) return -1; if (String(c).indexOf('/') > 0) { var p = String(c).split('/'); return +p[0] / +p[1]; } return +c; }
  function crText(cr){ var c = cr && typeof cr === 'object' ? cr.cr : cr; return c == null ? '—' : String(c); }
  function typeName(t){ return typeof t === 'string' ? t : t && typeof t.type === 'string' ? t.type : t && t.type && t.type.choose ? t.type.choose[0] : ''; }
  function mod(v){ return Math.floor(((v || 10) - 10) / 2); }
  function sgn(n){ return (n >= 0 ? '+' : '−') + Math.abs(n); }
  function pbOf(m){ var c = Math.max(0, m._cr); return c < 5 ? 2 : c < 9 ? 3 : c < 13 ? 4 : c < 17 ? 5 : c < 21 ? 6 : c < 25 ? 7 : c < 29 ? 8 : 9; }
  function acOf(m){ var a = (m.ac || [])[0]; return typeof a === 'number' ? a : a && a.ac != null ? a.ac : 10; }
  function acNote(m){ var a = (m.ac || [])[0]; return a && a.from ? a.from.map(strip).join(', ') : ''; }
  function hpOf(m){ return m.hp && m.hp.average != null ? m.hp.average : m.hp && m.hp.special ? parseInt(m.hp.special, 10) || 1 : 1; }
  function initOf(m){ var b = mod(m.dex); if (typeof m.initiative === 'number') return b + m.initiative; if (m.initiative && m.initiative.proficiency) b += pbOf(m) * m.initiative.proficiency; return b; }
  function strip(s){ return String(s).replace(/\{@\w+ ([^|}]*)[^}]*\}/g, '$1'); }
  function ft(v){ var n = typeof v === 'object' ? v.number : v; return (n / 5 * 1.5).toString().replace('.', ',') + ' m' + (typeof v === 'object' && v.condition ? ' ' + strip(v.condition) : ''); }
  function find(ref){ if (!list) return null; var p = String(ref || '').split('|'); var k = key(p[0], p[1] || ''); for (var i = 0; i < list.length; i++) if (list[i]._k === k) return list[i]; return null; }

  /* ---------- Ajustes: cargar el archivo ---------- */
  function settings(){
    var st = $('#bestStatus'); if (!st) return;
    ready().then(function(){
      st.textContent = has() ? list.length + ' criaturas cargadas' + (meta && meta.creado ? ' · creado el ' + new Date(meta.creado).toLocaleDateString('es-MX') : '') + '.' : 'Sin bestiario. Solo lo necesita el DM.';
      var del = $('#bestDel'); if (del) del.hidden = !has();
    });
  }
  function importFile(file){
    var st = $('#bestStatus'); if (st) st.textContent = 'Leyendo ' + file.name + '…';
    var fr = new FileReader();
    fr.onload = function(){
      var j; try { j = JSON.parse(fr.result); } catch(e){ if (st) st.textContent = 'Ese archivo no es un JSON válido.'; return; }
      if (!j || !Array.isArray(j.monster) || !j.monster.length) { if (st) st.textContent = 'Ese archivo no trae criaturas. Usa el que crea "npm run bestiario".'; return; }
      if (!j._bestiario && j._diario) { if (st) st.textContent = 'Ese es el paquete del diario. El bestiario es otro archivo: bestiario-5e.json.'; return; }
      setData(j); loading = Promise.resolve(true);
      idbPut('bestiary', j).then(function(ok){ if (st) st.textContent = ok ? list.length + ' criaturas cargadas en este dispositivo.' : 'Se cargó, pero no hubo espacio para guardarlo: tendrás que cargarlo otra vez.'; var del = $('#bestDel'); if (del) del.hidden = false; });
    };
    fr.onerror = function(){ if (st) st.textContent = 'No se pudo leer el archivo.'; };
    fr.readAsText(file);
  }

  /* ---------- Buscador ---------- */
  function open(ref, readOnly){
    view.ref = ref || null; view.readOnly = !!readOnly;
    if (window.Diario) Diario.openSheet('bestSheet');
    ready().then(render);
  }
  function filtered(){
    var q = norm(view.q.trim()), r = view.cr === '*' ? null : view.cr.split('-').map(Number);
    return list.filter(function(m){
      if (!view.old && m.rep) return false;
      if (q && m._n.indexOf(q) < 0) return false;
      if (r && (m._cr < r[0] || m._cr > r[1])) return false;
      if (view.type !== '*' && m._t !== view.type) return false;
      if (view.src !== '*' && m.source !== view.src) return false;
      return true;
    });
  }
  function render(){
    var box = $('#bestBody'); if (!box) return;
    if (!has()) { box.innerHTML = '<div class="empty-state"><b>No hay bestiario en este dispositivo</b>Créalo en tu laptop con <code>npm run bestiario -- ./5etools-src/data ./bestiario-5e.json</code> y cárgalo en Ajustes → Bestiario del DM.</div>'; return; }
    if (view.ref) { var m = find(view.ref); if (m) { box.innerHTML = detail(m); if (window.Diario) Diario.trInit(box); box.parentNode.scrollTop = 0; return; } view.ref = null; }
    var srcs = {}; list.forEach(function(x){ srcs[x.source] = (srcs[x.source] || 0) + 1; });
    var types = Object.keys(TYPE_ES);
    var opt = function(v, l, cur){ return '<option value="' + attr(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(l) + '</option>'; };
    var res = filtered(), focus = document.activeElement && document.activeElement.id === 'bestQ';
    var h = '<div class="best-f"><input class="field" id="bestQ" type="search" placeholder="Buscar entre ' + list.length + ': ogro, goblin, dragón rojo…" aria-label="Buscar enemigo" autocomplete="off" value="' + attr(view.q) + '">'
      + '<div class="best-sel"><select class="field" data-bestf="cr" aria-label="Valor de desafío">' + CR_OPTS.map(function(x){ return opt(x[0], x[1], view.cr); }).join('') + '</select>'
      + '<select class="field" data-bestf="type" aria-label="Tipo">' + opt('*', 'Cualquier tipo', view.type) + types.map(function(t){ return opt(t, TYPE_ES[t], view.type); }).join('') + '</select>'
      + '<select class="field" data-bestf="src" aria-label="Libro">' + opt('*', 'Todos los libros', view.src) + Object.keys(srcs).sort(function(a, b){ return srcs[b] - srcs[a]; }).map(function(s){ return opt(s, (window.Rules5e ? Rules5e.srcName(s) : s) + ' (' + srcs[s] + ')', view.src); }).join('') + '</select></div>'
      + '<label class="toggle"><input type="checkbox" data-bestf="old"' + (view.old ? ' checked' : '') + '> Incluir versiones viejas que ya tienen reimpresión (por ejemplo, el Ogro de 2014)</label></div>';
    h += '<p class="note best-count">' + (res.length === list.length ? 'Todas las criaturas' : res.length + ' resultado' + (res.length === 1 ? '' : 's')) + '</p><div class="best-list">'
      + res.slice(0, view.shown).map(function(m){ return '<button type="button" class="best-row" data-act="bestpick" data-ref="' + attr(m.name + '|' + m.source) + '"><span><b>' + esc(Render5e.Tname(m.name)) + '</b><small>VD ' + esc(crText(m.cr)) + ' · ' + esc(TYPE_ES[m._t] || m._t) + ' · ' + esc(m.source) + '</small></span><span class="best-n"><i>CA</i>' + acOf(m) + '</span><span class="best-n"><i>PG</i>' + hpOf(m) + '</span></button>'; }).join('')
      + '</div>' + (res.length > view.shown ? '<button class="btn" type="button" data-act="bestmore" style="width:100%">Ver más (' + (res.length - view.shown) + ')</button>' : '') + (!res.length ? '<p class="empty-state">Nada con esos filtros.</p>' : '');
    box.innerHTML = h;
    if (focus) { var qi = $('#bestQ'); qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); }
  }

  /* ---------- Ficha ---------- */
  function attackLine(a){
    var s = JSON.stringify(a.entries || []), hit = /\{@hit (-?\d+)\}/.exec(s), dc = /\{@dc (\d+)\}/.exec(s), dmgs = [], re = /\{@damage ([^}|]+)\}\)?\s*([A-Za-z]+)?/g, mm;
    while ((mm = re.exec(s))) dmgs.push(mm[1].replace(/\s+/g, ' ') + (mm[2] && DMG_ES[mm[2].toLowerCase()] ? ' ' + DMG_ES[mm[2].toLowerCase()] : ''));
    var p = []; if (hit) p.push('Tira 1d20 ' + sgn(+hit[1]).replace('+', '+ ').replace('−', '− ')); if (dc) p.push('CD ' + dc[1]); if (dmgs.length) p.push(dmgs.join(' + '));
    return p.length ? '<span class="best-atk">' + esc(p.join(' · ')) + '</span>' : '';
  }
  function block(title, arr, header){
    if (!arr || !arr.length) return '';
    return '<h4>' + title + '</h4>' + (header ? Render5e.entries(header) : '') + arr.map(function(a){ return '<div class="best-a">' + attackLine(a) + Render5e.entries([{type:'entries', name:a.name, entries:a.entries}]) + '</div>'; }).join('');
  }
  function spells(sc){
    return (sc || []).map(function(s){
      var h = '<div class="best-a">' + Render5e.entries([{type:'entries', name:s.name || 'Lanzamiento de conjuros', entries:s.headerEntries || []}]);
      var L = function(lab, arr){ return arr && arr.length ? '<p><b>' + esc(lab) + ':</b> ' + Render5e.entries([arr.join(', ')]).replace(/^<p>|<\/p>$/g, '') + '</p>' : ''; };
      h += L('A voluntad', s.will);
      Object.keys(s.daily || {}).forEach(function(k){ h += L(k.replace('e', '') + '/día' + (/e$/.test(k) ? ' cada uno' : ''), s.daily[k]); });
      Object.keys(s.spells || {}).forEach(function(lv){ var t = s.spells[lv]; h += L(+lv === 0 ? 'Trucos' : 'Nivel ' + lv + (t.slots ? ' (' + t.slots + ' espacios)' : ''), t.spells); });
      return h + (s.footerEntries ? Render5e.entries(s.footerEntries) : '') + '</div>';
    }).join('');
  }
  function listOf(arr, field){ return (arr || []).map(function(x){ return typeof x === 'string' ? DMG_ES[x] || x : x[field] ? x[field].map(function(y){ return DMG_ES[y] || y; }).join(', ') + (x.note ? ' ' + strip(x.note) : '') : strip(x.special || ''); }).join('; '); }
  function detail(m){
    var ro = view.readOnly, dm = window.Sala && Sala.room() && Sala.room().role === 'dm', sp = m.speed || {}, pb = pbOf(m);
    var h = '<button class="btn sm" type="button" data-act="bestback">' + (ro ? 'Buscar otro' : 'Volver a la lista') + '</button>';
    h += '<div class="best-card"><h3>' + esc(Render5e.Tname(m.name)) + '</h3><p class="muted">' + esc((SIZE_ES[(m.size || [])[0]] || '') + ' ' + (TYPE_ES[m._t] || m._t)) + ' · VD ' + esc(crText(m.cr)) + ' · ' + esc(window.Rules5e ? Rules5e.srcName(m.source) : m.source) + '</p>'
      + '<div class="best-stats"><div><b>' + acOf(m) + '</b><span>CA' + (acNote(m) ? ' · ' + esc(acNote(m)) : '') + '</span></div><div><b>' + hpOf(m) + '</b><span>PG' + (m.hp && m.hp.formula ? ' · ' + esc(m.hp.formula) : '') + '</span></div><div><b>' + sgn(initOf(m)) + '</b><span>iniciativa</span></div></div>'
      + '<p><b>Velocidad</b> ' + esc([['walk',''],['fly','vuelo '],['swim','nado '],['climb','trepar '],['burrow','excavar ']].filter(function(x){ return sp[x[0]]; }).map(function(x){ return x[1] + ft(sp[x[0]]); }).join(', ') || '—') + (sp.canHover ? ' (flota)' : '') + '</p>'
      + '<div class="best-ab">' + AB.map(function(k){ return '<div><small>' + ABN[k] + '</small><b>' + sgn(mod(m[k])) + '</b><span>' + (m[k] || 10) + '</span></div>'; }).join('') + '</div>';
    var rows = [];
    if (m.save) rows.push(['Salvaciones', Object.keys(m.save).map(function(k){ return ABN[k] + ' ' + m.save[k]; }).join(', ')]);
    if (m.skill) rows.push(['Habilidades', Object.keys(m.skill).filter(function(k){ return typeof m.skill[k] === 'string'; }).map(function(k){ return k + ' ' + m.skill[k]; }).join(', ')]);
    if (m.vulnerable) rows.push(['Vulnerable', listOf(m.vulnerable, 'vulnerable')]);
    if (m.resist) rows.push(['Resistente', listOf(m.resist, 'resist')]);
    if (m.immune) rows.push(['Inmune', listOf(m.immune, 'immune')]);
    if (m.conditionImmune) rows.push(['Inmune a', listOf(m.conditionImmune, 'conditionImmune')]);
    rows.push(['Sentidos', (m.senses || []).map(strip).concat(['Percepción pasiva ' + (m.passive != null ? m.passive : 10 + mod(m.wis))]).join(', ')]);
    if (m.languages) rows.push(['Idiomas', m.languages.map(strip).join(', ')]);
    rows.push(['Competencia', '+' + pb]);
    h += '<dl class="gmeta">' + rows.map(function(r){ return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>';
    if (!ro) h += addForm(m, dm);
    var body = block('Rasgos', m.trait) + (m.spellcasting ? '<h4>Conjuros</h4>' + spells(m.spellcasting) : '') + block('Acciones', m.action) + block('Acciones adicionales', m.bonus) + block('Reacciones', m.reaction, m.reactionHeader)
      + block('Acciones legendarias', m.legendary, m.legendaryHeader || (m.legendary ? ['Puede usar ' + (m.legendaryActions || 3) + ' acciones legendarias, una a la vez, al final del turno de otra criatura.'] : null)) + block('Acciones míticas', m.mythic, m.mythicHeader);
    var g = m.legendaryGroup && groups[key(m.legendaryGroup.name, m.legendaryGroup.source)];
    if (g && g.lairActions) body += '<h4>Guarida</h4>' + Render5e.entries(g.lairActions);
    h += window.Diario ? Diario.trWrap(body, 'm|' + m.name + '|' + m.source) : body;
    if (ro && dm) h += '<button class="btn" type="button" data-act="bestpick" data-ref="' + attr(m.name + '|' + m.source) + '" data-add="1" style="width:100%;margin-top:10px">Agregar más como este</button>';
    return h + '</div>';
  }
  function addForm(m, dm){
    if (!dm) return '<p class="note best-add">Para agregarlo a la iniciativa entra a la mesa como DM.</p>';
    return '<form class="best-add card" data-form="bestadd" data-ref="' + attr(m.name + '|' + m.source) + '"><span class="label">agregar al combate</span>'
      + '<div class="best-addf"><label>Nombre<input class="field" name="name" value="' + attr(m.name) + '" autocomplete="off"></label><label>Cuántos<input class="field" name="count" inputmode="numeric" value="1"></label></div>'
      + '<div class="best-addf"><label>PG<input class="field" name="hp" inputmode="numeric" value="' + hpOf(m) + '"></label><label>CA<input class="field" name="ac" inputmode="numeric" value="' + acOf(m) + '"></label><label>Iniciativa<input class="field" name="init" inputmode="numeric" placeholder="1d20 ' + sgn(initOf(m)) + '"></label></div>'
      + '<p class="note">PG promedio de la ficha' + (m.hp && m.hp.formula ? '; si prefieres tirarlos: ' + esc(m.hp.formula) : '') + '. La iniciativa la puedes poner después en su fila.</p>'
      + '<label class="toggle"><input type="checkbox" name="hidden"> Oculto para los jugadores (aparece cuando lo muestres)</label>'
      + '<button class="btn main" type="submit">Agregar a la iniciativa</button></form>';
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('[data-act]'); if (!b || b.dataset.act.indexOf('best') !== 0) return;
    var a = b.dataset.act;
    if (a === 'bestopen') open(null, false);
    else if (a === 'bestref') open(b.dataset.ref, true);
    else if (a === 'bestpick') { view.ref = b.dataset.ref; if (b.dataset.add) view.readOnly = false; render(); }
    else if (a === 'bestback') { view.ref = null; view.readOnly = false; render(); }
    else if (a === 'bestmore') { view.shown += 80; render(); }
    else if (a === 'bestdel') { if (b.dataset.sure) { idbDel('bestiary'); list = null; loading = null; settings(); } else { b.dataset.sure = 1; b.textContent = '¿Seguro? Toca otra vez'; } }
  });
  document.addEventListener('input', function(ev){ if (ev.target.id === 'bestQ') { view.q = ev.target.value; view.shown = 60; render(); } });
  document.addEventListener('change', function(ev){
    var t = ev.target;
    if (t.dataset && t.dataset.bestf) { view[t.dataset.bestf] = t.type === 'checkbox' ? t.checked : t.value; view.shown = 60; render(); }
    if (t.id === 'bestFile' && t.files && t.files[0]) { importFile(t.files[0]); t.value = ''; }
  });
  document.addEventListener('submit', function(ev){
    var f = ev.target; if (!f.dataset || f.dataset.form !== 'bestadd') return; ev.preventDefault();
    var m = find(f.dataset.ref); if (!m || !window.Sala) return;
    var v = function(n){ return f.elements[n].type === 'checkbox' ? f.elements[n].checked : f.elements[n].value.trim(); };
    var hp = parseInt(v('hp'), 10), count = Math.max(1, Math.min(12, parseInt(v('count'), 10) || 1));
    if (!(hp > 0)) { f.elements.hp.focus(); return; }
    var ok = Sala.send({t:'npc.add', name:v('name') || m.name, ac:parseInt(v('ac'), 10) || acOf(m), hp:hp, init:v('init'), count:count, hidden:v('hidden'), ref:m.name + '|' + m.source, initMod:initOf(m), formula:m.hp && m.hp.formula || null});
    if (ok) { Sala.toast((count > 1 ? count + ' × ' : '') + (v('name') || m.name) + ' en la iniciativa.'); if (window.Diario) Diario.closeSheets(); view.ref = null; }
  });

  return {open:open, settings:settings, ready:ready, has:has, find:find, initOf:initOf, _set:setData};
})();
