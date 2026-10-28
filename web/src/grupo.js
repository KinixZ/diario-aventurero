/* ==================== BESTIARIO DEL GRUPO ==================== */
/* Las criaturas y PNJ que el grupo ha encontrado en esta campaña. El DM decide qué revela (nombre, imagen,
   descripción, algunos datos o la ficha completa de su bestiario) y todos pueden dejar notas: «le duele el fuego».
   Los enemigos visibles se anotan solos al aparecer en el combate; el DM luego completa lo que quiera. */
var Grupo = (function(){
  var esc = function(s){ return Render5e.esc(s == null ? '' : s); }, attr = function(s){ return Render5e.attr(s == null ? '' : s); };
  var $ = function(s, r){ return (r || document).querySelector(s); };
  var KINDS = [['enemigo','Enemigo'],['pnj','PNJ'],['criatura','Criatura']];
  var INFO = [['type','Tipo'],['cr','VD'],['ac','CA'],['hp','PG'],['size','Tamaño'],['speed','Velocidad'],['where','Dónde lo vieron']];
  var view = {q:'', kind:'*', open:null}, full = {}, edit = null, uploading = false, pickQ = '';

  function room(){ return Sala.status() === 'on' ? Sala.room() : null; }
  function isDm(){ var r = room(); return !!r && r.role === 'dm'; }
  function box(){ return document.getElementById('mesaBest'); }
  function visible(){ var c = document.getElementById('combat'); return c && !c.hidden && c.getAttribute('data-tab') === 'bestiario'; }
  function img(id){ return window.Mesa ? Mesa.imgUrl(id) : ''; }
  function norm(s){ return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function initials(n){ return String(n || '?').split(/\s+/).slice(0, 2).map(function(w){ return w.charAt(0); }).join('').toUpperCase(); }
  function kindName(k){ return (KINDS.filter(function(x){ return x[0] === k; })[0] || KINDS[0])[1]; }

  function render(){
    var b = box(); if (!b) return;
    var r = room();
    if (!r) { b.innerHTML = '<div class="mesa-lobby card"><p class="note">Aquí se anotan los enemigos y PNJ que encuentra el grupo en la campaña: lo que el DM revela y lo que ustedes descubren.</p><button class="btn main" type="button" data-act="mesatab" data-v="inicio">Elegir campaña</button></div>'; return; }
    if (edit) { b.innerHTML = editHtml(); return; }
    if (view.open) { var sum = (r.beasts || []).filter(function(x){ return x.id === view.open; })[0]; if (sum) { b.innerHTML = detailHtml(sum, full[view.open]); if (!full[view.open] || full[view.open]._stale) Sala.send({t:'beast.get', id:view.open}); if (window.Diario) Diario.trInit(b); return; } view.open = null; }
    b.innerHTML = listHtml(r);
  }

  function listHtml(r){
    var dm = isDm(), q = norm(view.q), all = r.beasts || [];
    var res = all.filter(function(x){ return (view.kind === '*' || x.kind === view.kind) && (!q || norm(x.name).indexOf(q) >= 0); });
    var h = '<div class="gr-head"><div><b>Bestiario del grupo</b><p class="note">' + (dm ? 'Tú decides qué ven. Los enemigos visibles se anotan solos; completa lo que quieras revelar.' : 'Lo que han encontrado en esta campaña. Deja tus notas en cada criatura.') + '</p></div>' + (dm ? '<button class="btn main" type="button" data-act="grnew">Registrar criatura</button>' : '') + '</div>';
    h += '<div class="gr-f"><input class="field" id="grQ" type="search" placeholder="Buscar entre ' + all.length + '…" aria-label="Buscar en el bestiario del grupo" autocomplete="off" value="' + attr(view.q) + '"><div class="seg sm" role="group" aria-label="Tipo">' + [['*','Todos']].concat(KINDS).map(function(k){ return '<button type="button" data-act="grkind" data-v="' + k[0] + '" aria-pressed="' + (view.kind === k[0]) + '">' + k[1] + '</button>'; }).join('') + '</div></div>';
    if (!all.length) return h + '<p class="empty-state">' + (dm ? 'Todavía no hay criaturas. Registra una o agrega enemigos visibles al combate.' : 'Todavía no se han topado con nada… por ahora.') + '</p>';
    h += '<div class="gr-grid">' + res.map(function(x){
      var fresh = r.live && x.ses === r.session.n;
      return '<button type="button" class="gr-card' + (x.hidden ? ' prep' : '') + '" data-act="gropen" data-id="' + attr(x.id) + '">' + (x.img ? '<img alt="" loading="lazy" src="' + attr(img(x.img)) + '">' : '<span class="gr-ini">' + esc(initials(x.name)) + '</span>')
        + '<span class="gr-txt"><b>' + esc(x.name) + '</b><small>' + esc(kindName(x.kind)) + (x.info && x.info.type ? ' · ' + esc(x.info.type) : '') + (x.info && x.info.cr ? ' · VD ' + esc(x.info.cr) : '') + '</small><span class="gr-tags">' + (fresh ? '<i class="tag new">nuevo</i>' : '') + (x.hidden ? '<i class="tag">en preparación</i>' : '') + (dm && x.auto ? '<i class="tag">anotado solo</i>' : '') + (x.hasStat ? '<i class="tag">ficha</i>' : '') + (x.notes ? '<i class="tag">' + x.notes + ' nota' + (x.notes === 1 ? '' : 's') + '</i>' : '') + '</span></span></button>';
    }).join('') + '</div>' + (!res.length ? '<p class="empty-state">Nada con ese filtro.</p>' : '');
    return h;
  }

  function detailHtml(sum, b){
    var dm = isDm(), r = room(), d = b || sum, info = d.info || {};
    var h = '<div class="gr-detail"><div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm" type="button" data-act="grback">Volver</button>' + (dm ? '<button class="btn sm" type="button" data-act="gredit" data-id="' + attr(sum.id) + '"' + (b ? '' : ' disabled') + '>Editar</button><button class="btn sm" type="button" data-act="grdel" data-id="' + attr(sum.id) + '">Borrar</button>' : '') + '</div>';
    h += '<div class="gr-top">' + (d.img ? '<button type="button" class="gr-img" data-act="mesaview" data-img="' + attr(d.img) + '"><img alt="' + attr(d.name) + '" src="' + attr(img(d.img)) + '"></button>' : '<span class="gr-ini big">' + esc(initials(d.name)) + '</span>')
      + '<div><h3>' + esc(d.name) + '</h3><p class="muted">' + esc(kindName(d.kind)) + (sum.hidden ? ' · en preparación, solo tú lo ves' : '') + (sum.seen ? ' · visto el ' + new Date(sum.seen).toLocaleDateString('es-MX', {day:'numeric', month:'long'}) + (sum.ses ? ' (sesión ' + sum.ses + ')' : '') : '') + '</p>'
      + (dm && sum.ref ? '<p class="note">De tu bestiario: ' + esc(window.Bestiario ? Bestiario.nameOf(sum.ref) : sum.ref) + ' <button class="pill" type="button" data-act="bestref" data-ref="' + attr(sum.ref) + '">Ver ficha</button></p>' : '') + '</div></div>';
    var rows = INFO.filter(function(k){ return info[k[0]]; });
    if (rows.length) h += '<dl class="gmeta gr-info">' + rows.map(function(k){ return '<dt>' + k[1] + '</dt><dd>' + esc(info[k[0]]) + '</dd>'; }).join('') + '</dl>';
    if (b && b.text) h += '<div class="card gr-text">' + esc(b.text).replace(/\n/g, '<br>') + '</div>';
    if (!b) h += '<p class="note">Cargando…</p>';
    if (b && b.stat && window.Bestiario) h += '<details class="feat-d gr-stat"' + (dm ? '' : ' open') + '><summary><b>Ficha completa</b><small>la compartió el DM</small></summary><div style="padding:0 12px 12px">' + Bestiario.statHtml(b.stat) + '</div></details>';
    if (dm && !sum.hidden && !(b && (b.text || b.stat || b.img)) && !rows.length) h += '<div class="banner"><p>Los jugadores solo ven el nombre. Toca «Editar» para revelar una imagen, una descripción o algunos datos.</p></div>';
    // notas
    var notes = (b && b.notes) || [];
    h += '<div class="gr-notes"><span class="label">notas del grupo</span>' + (notes.length ? notes.map(function(n){ var mine = n.by === r.you; return '<div class="gr-note' + (mine ? ' mine' : '') + '"><div class="msg-h"><b>' + esc(n.name) + '</b><time>' + new Date(n.at).toLocaleDateString('es-MX', {day:'numeric', month:'short'}) + '</time>' + (mine || dm ? '<button class="icon-btn sm" type="button" data-act="grunnote" data-id="' + attr(sum.id) + '" data-nid="' + attr(n.id) + '" aria-label="Borrar nota"><svg class="ic"><use href="#i-x"/></svg></button>' : '') + '</div><p>' + esc(n.text).replace(/\n/g, '<br>') + '</p></div>'; }).join('') : '<p class="note">Nadie ha escrito nada todavía.</p>')
      + '<form class="gr-noteform" data-form="grnote" data-id="' + attr(sum.id) + '"><textarea class="field" name="text" id="grNoteIn" rows="2" maxlength="600" placeholder="Lo que descubrieron: le duele el fuego, huyó al norte…" aria-label="Tu nota"></textarea><button class="btn main" type="submit">Anotar</button></form></div>';
    return h + '</div>';
  }

  function editHtml(){
    var e = edit, hasB = window.Bestiario && Bestiario.has();
    var h = '<form class="gr-edit card" data-form="grsave"><div class="row"><b>' + (e.id ? 'Editar criatura' : 'Registrar criatura') + '</b><button class="btn sm" type="button" data-act="grcancel">Cancelar</button></div>';
    if (hasB) h += '<div class="gr-pick"><label class="fl">Desde tu bestiario (opcional)<input class="field" id="grPick" type="search" autocomplete="off" placeholder="Buscar: ogro, goblin…" value="' + attr(pickQ) + '"></label><div class="gr-picklist" id="grPickList">' + pickList() + '</div>' + (e.ref ? '<p class="note">Vinculado a <b>' + esc(Bestiario.nameOf(e.ref)) + '</b>. <button class="pill" type="button" data-act="grunlink">Quitar vínculo</button></p>' : '') + '</div>';
    h += '<label class="fl">Nombre que verán<input class="field" name="name" maxlength="60" autocomplete="off" value="' + attr(e.name || '') + '" placeholder="El ogro del puente"></label>';
    h += '<div class="seg sm" role="group" aria-label="Tipo">' + KINDS.map(function(k){ return '<button type="button" data-act="grekind" data-v="' + k[0] + '" aria-pressed="' + (e.kind === k[0]) + '">' + k[1] + '</button>'; }).join('') + '</div>';
    h += '<div class="gr-imgrow">' + (e.img ? '<img alt="" src="' + attr(img(e.img)) + '"><button class="pill" type="button" data-act="grnoimg">Quitar imagen</button>' : '<span class="gr-ini">' + esc(initials(e.name || '?')) + '</span>') + '<label class="btn sm pickbtn">' + (uploading ? 'Subiendo…' : e.img ? 'Cambiar imagen' : 'Poner imagen') + '<input type="file" id="grImg" accept="image/*"></label></div>';
    h += '<label class="fl">Descripción para el grupo<textarea class="field" name="text" rows="3" maxlength="2000" placeholder="Lo que saben de ella…">' + esc(e.text || '') + '</textarea></label>';
    h += '<fieldset class="fl"><legend>Datos que quieres revelar (deja vacío lo que sigue en secreto)</legend><div class="gr-infof">' + INFO.map(function(k){ return '<label>' + k[1] + '<input class="field" name="i_' + k[0] + '" maxlength="80" autocomplete="off" value="' + attr((e.info || {})[k[0]] || '') + '"></label>'; }).join('') + '</div>' + (e.ref && hasB ? '<button class="pill" type="button" data-act="grfill">Rellenar con la ficha</button>' : '') + '</fieldset>';
    if (e.ref && hasB) h += '<label class="toggle"><input type="checkbox" name="stat"' + (e.shareStat ? ' checked' : '') + '> Compartir la ficha completa (acciones, rasgos, conjuros)</label>';
    h += '<label class="toggle"><input type="checkbox" name="hidden"' + (e.hidden ? ' checked' : '') + '> En preparación: solo tú la ves hasta que la muestres</label>';
    return h + '<button class="btn main" type="submit"' + (uploading ? ' disabled' : '') + '>' + (e.id ? 'Guardar' : 'Registrar') + '</button></form>';
  }
  function pickList(){ if (!window.Bestiario || !pickQ.trim()) return ''; var res = Bestiario.search(pickQ, 8); return res.length ? res.map(function(x){ return '<button type="button" class="best-row" data-act="grpick" data-ref="' + attr(x.ref) + '"><span><b>' + esc(x.name) + '</b><small>VD ' + esc(x.cr) + ' · ' + esc(x.type) + ' · ' + esc(x.src) + '</small></span></button>'; }).join('') : '<p class="note">Nada con ese nombre.</p>'; }

  /* Lo que se escribió en el formulario, para no perderlo al repintar */
  function readForm(){
    var f = $('form[data-form="grsave"]'); if (!f || !edit) return;
    edit.name = f.elements.name.value; edit.text = f.elements.text.value; edit.hidden = f.elements.hidden.checked; if (f.elements.stat) edit.shareStat = f.elements.stat.checked;
    edit.info = {}; INFO.forEach(function(k){ var v = f.elements['i_' + k[0]].value.trim(); if (v) edit.info[k[0]] = v; });
  }
  function startNew(pre){
    pre = pre || {}; pickQ = '';
    edit = {id:null, name:pre.name || '', kind:pre.kind || 'enemigo', ref:pre.ref || null, img:null, text:'', info:pre.info || {}, hidden:false, shareStat:false};
    if (edit.ref && window.Bestiario) { if (!edit.name) edit.name = Bestiario.nameOf(edit.ref); if (!pre.info) edit.info = Bestiario.infoOf(edit.ref) || {}; }
    needBest();
  }
  function startEdit(b){ pickQ = ''; edit = {id:b.id, name:b.name, kind:b.kind, ref:b.ref, img:b.img, text:b.text, info:JSON.parse(JSON.stringify(b.info || {})), hidden:!!b.hidden, shareStat:!!b.stat}; needBest(); }
  /* El bestiario del DM se carga del teléfono la primera vez que hace falta */
  function needBest(){ if (window.Bestiario && !Bestiario.has()) Bestiario.ready().then(function(ok){ if (ok && edit && visible()) { readForm(); render(); } }); }
  /* Desde el bestiario del DM: abre la campaña en esta pestaña con la criatura lista para registrar */
  function startFrom(ref){
    if (!isDm()) { Sala.toast('Entra a tu campaña como DM para registrarla.'); return; }
    var r = room(), name = window.Bestiario ? Bestiario.nameOf(ref) : String(ref).split('|')[0];
    var same = (r.beasts || []).filter(function(x){ return x.ref === ref || norm(x.name) === norm(name); })[0];
    if (window.Diario) Diario.closeSheets();
    document.getElementById('combat').hidden = false;
    if (same) { view.open = same.id; Sala.send({t:'beast.get', id:same.id}); pendingEdit = same.id; }
    else startNew({ref:ref});
    if (window.Mesa) Mesa.show('bestiario');
  }
  var pendingEdit = null;

  /* ---------- Eventos ---------- */
  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('[data-act]'); if (!b) return;
    var a = b.dataset.act; if (a.indexOf('gr') !== 0) return;
    if (a === 'grnew') { startNew(); if (!visible() && window.Mesa) Mesa.show('bestiario'); else render(); }
    else if (a === 'grfrom') startFrom(b.dataset.ref);
    else if (a === 'gropen') { view.open = b.dataset.id; render(); var bx = box(); if (bx) bx.scrollTop = 0; }
    else if (a === 'grback') { view.open = null; render(); }
    else if (a === 'grkind') { view.kind = b.dataset.v; render(); }
    else if (a === 'gredit') { var f = full[b.dataset.id]; if (f) { startEdit(f); render(); } }
    else if (a === 'grdel') { if (b.dataset.sure) { Sala.send({t:'beast.del', id:b.dataset.id}); view.open = null; render(); } else { b.dataset.sure = 1; b.textContent = '¿Borrar con sus notas?'; } }
    else if (a === 'grcancel') { edit = null; render(); }
    else if (a === 'grekind') { readForm(); edit.kind = b.dataset.v; render(); }
    else if (a === 'grpick') { readForm(); edit.ref = b.dataset.ref; if (!edit.name.trim()) edit.name = Bestiario.nameOf(edit.ref); edit.info = Bestiario.infoOf(edit.ref) || edit.info; pickQ = ''; render(); }
    else if (a === 'grunlink') { readForm(); edit.ref = null; edit.shareStat = false; render(); }
    else if (a === 'grfill') { readForm(); edit.info = Bestiario.infoOf(edit.ref) || edit.info; render(); }
    else if (a === 'grnoimg') { readForm(); edit.img = null; render(); }
    else if (a === 'grunnote') Sala.send({t:'beast.unnote', id:b.dataset.id, nid:b.dataset.nid});
  });
  document.addEventListener('submit', function(ev){
    var f = ev.target, k = f.dataset && f.dataset.form; if (k !== 'grsave' && k !== 'grnote') return; ev.preventDefault();
    if (k === 'grnote') { var t = f.elements.text.value.trim(); if (!t) { f.elements.text.focus(); return; } if (Sala.send({t:'beast.note', id:f.dataset.id, text:t})) f.elements.text.value = ''; return; }
    readForm(); if (!edit.name.trim()) { f.elements.name.focus(); return; }
    var beast = {name:edit.name.trim(), kind:edit.kind, ref:edit.ref, img:edit.img, text:edit.text.trim(), info:edit.info, hidden:edit.hidden, stat: edit.ref && edit.shareStat && window.Bestiario ? Bestiario.statOf(edit.ref) : null};
    if (edit.ref && edit.shareStat && !beast.stat) { var old = full[edit.id]; if (old && old.stat) beast.stat = old.stat; }
    if (Sala.send(edit.id ? {t:'beast.edit', id:edit.id, beast:beast} : {t:'beast.add', beast:beast})) { if (edit.id) { view.open = edit.id; if (full[edit.id]) full[edit.id]._stale = true; } edit = null; render(); }
  });
  document.addEventListener('input', function(ev){
    if (ev.target.id === 'grQ') { view.q = ev.target.value; var b = box(); if (b && room()) { var pos = ev.target.selectionStart; b.innerHTML = listHtml(room()); var q = $('#grQ'); q.focus(); try { q.setSelectionRange(pos, pos); } catch(e){} } }
    else if (ev.target.id === 'grPick') { pickQ = ev.target.value; var pl = $('#grPickList'); if (pl) pl.innerHTML = pickList(); }
  });
  document.addEventListener('change', function(ev){
    var t = ev.target;
    if (t.id === 'grImg' && t.files && t.files[0] && edit) {
      readForm(); uploading = true; render();
      Mesa.upload(t.files[0], 1200).then(function(id){ if (edit) edit.img = id; }).catch(function(e){ Sala.toast(e.message || 'No se pudo subir la imagen.'); }).then(function(){ uploading = false; render(); });
    }
  });

  Sala.on('beast', function(m){ full[m.beast.id] = m.beast; if (pendingEdit === m.beast.id) { pendingEdit = null; startEdit(m.beast); } if (visible() && !edit && view.open === m.beast.id) { var a = document.activeElement; if (a && a.id === 'grNoteIn' && a.value) return; render(); } else if (visible() && edit && pendingEdit === null && edit.id === m.beast.id) render(); });
  Sala.on('beast.saved', function(m){ view.open = m.id; if (full[m.id]) full[m.id]._stale = true; if (visible() && !edit) render(); });
  Sala.on('state', function(){ if (!visible() || edit) return; var a = document.activeElement, b = box(); if (b && a && b.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return; render(); });
  Sala.on('joined', function(){ full = {}; edit = null; view.open = null; });

  return {render:render, startFrom:startFrom};
})();
