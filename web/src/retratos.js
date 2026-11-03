/* ==================== RETRATOS ====================
   Cada personaje tiene una o varias formas (normal, las tres revelaciones del aasimar, formas salvajes del druida,
   caras de un cambiaformas…). Cada forma tiene su imagen original y dos encuadres:
     tok — círculo de la ficha (cuadrado, 1:1)
     por — retrato (3:4): portada, encabezado, barra de turnos
   La imagen vive en IndexedDB ('pt:<personaje>:<forma>'), porque en localStorage no cabe. En el personaje solo
   se guardan los encuadres: C.pt = {cur, forms:[{id, name, ic, has, ver, crop:{tok:{x,y,z}, por:{x,y,z}}}], up:{}}.
   En una campaña se suben solo los recortes chicos de la forma actual (C.pt.up['CODIGO|forma|ver'] = {t, p})
   y viajan en el resumen del personaje (char.img, char.tok, char.form), así todos ven tu cara.
   También busca la imagen de los monstruos en la carpeta de 5etools del DM (5etools-img). */
var Retratos = (function(){
  var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var SIZES = {tok:[256, 256], por:[360, 480], cov:[600, 800]}, ASPECT = {tok:1, por:3 / 4, cov:3 / 4};
  var urls = {}, pending = {}, imgs = {};

  /* ---------- Almacén en el aparato ---------- */
  function idb(){ return new Promise(function(res, rej){ if (!window.indexedDB) return rej(new Error('sin IndexedDB')); var r = indexedDB.open('diario5e', 2); r.onupgradeneeded = function(){ if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); }; r.onsuccess = function(){ res(r.result); }; r.onerror = function(){ rej(r.error); }; }); }
  function get(k){ return idb().then(function(db){ return new Promise(function(res){ var q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = function(){ res(q.result || null); }; q.onerror = function(){ res(null); }; }); }).catch(function(){ return null; }); }
  function put(k, v){ return idb().then(function(db){ return new Promise(function(res){ var t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = function(){ res(true); }; t.onerror = function(){ res(false); }; }); }).catch(function(){ return false; }); }
  function del(k){ return idb().then(function(db){ return new Promise(function(res){ var t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = function(){ res(true); }; }); }).catch(function(){ return false; }); }

  /* ---------- Formas ---------- */
  function pt(C){ if (!C.pt || !C.pt.forms || !C.pt.forms.length) C.pt = {cur:'base', forms:[{id:'base', name:'Normal', ver:0}], up:{}}; if (!C.pt.up) C.pt.up = {}; return C.pt; }
  function form(C, fid){ var P = pt(C); return P.forms.filter(function(f){ return f.id === (fid || P.cur); })[0] || P.forms[0]; }
  function cur(C){ return form(C); }
  /* Formas que sugiere la hoja: especie, clase y rasgos */
  var WILD = [['Lobo','wolf-head'],['Oso','bear-head'],['Pantera','cat'],['Águila','eagle-head'],['Araña','spider-alt'],['Caballo','horse-head'],['Rata','rat'],['Tiburón','shark-jaws'],['Sapo','frog'],['Serpiente','snake'],['Murciélago','bat'],['Jabalí','boar'],['Pulpo','octopus'],['Elefante','elephant-head'],['Escorpión','scorpion'],['Búho','owl']];
  function suggestions(C, D){
    var out = [], race = D && D.race ? String(D.race.name || '') : '', cls = D && D.classes ? D.classes.map(function(E){ return E.cls.name + '|' + E.lv + '|' + (E.sub ? E.sub.name : ''); }).join(' ') : '';
    if (/aasimar/i.test(race)) out.push({group:'Revelación celestial', items:[['Alas celestiales','angel-wings'],['Resplandor interior','sunbeams'],['Sudario necrótico','death-skull']]});
    if (/druid/i.test(cls)) out.push({group:'Forma salvaje', items:WILD});
    if (/changeling|cambiante|shapechanger/i.test(race) || /shapechang|polymorph/i.test(JSON.stringify((D && D.features || []).map(function(f){ return f.name; })))) out.push({group:'Otras caras', items:[['Otra cara','domino-mask'],['Disfraz','hood']]});
    if (/barbarian/i.test(cls)) out.push({group:'Furia', items:[['En furia','fist']]});
    out.push({group:'Libre', items:[['Nueva forma','person']]});
    return out;
  }
  function addForm(C, name, ic){ var P = pt(C), id = 'f' + Math.random().toString(36).slice(2, 7); P.forms.push({id:id, name:String(name || 'Forma').slice(0, 40), ic:ic || null, ver:0}); return id; }
  function setCur(C, fid){ var P = pt(C); if (!P.forms.some(function(f){ return f.id === fid; })) return; P.cur = fid; done(C); }

  /* ---------- Encuadre ---------- */
  function defCrop(kind){ return kind === 'tok' ? {x:0.5, y:0.32, z:1.5} : {x:0.5, y:0.42, z:1}; }
  function crop(f, kind){ var k = kind === 'cov' ? 'por' : kind; return (f.crop && f.crop[k]) || defCrop(k); }
  function region(w, h, c, aspect){
    var fw, fh; if (w / h > aspect) { fh = h; fw = h * aspect; } else { fw = w; fh = w / aspect; }
    var z = Math.max(1, c.z || 1), rw = fw / z, rh = fh / z, cx = Math.max(rw / 2, Math.min(w - rw / 2, c.x * w)), cy = Math.max(rh / 2, Math.min(h - rh / 2, c.y * h));
    return {sx:cx - rw / 2, sy:cy - rh / 2, sw:rw, sh:rh};
  }
  function loadImg(C, fid){
    var k = 'pt:' + C.id + ':' + fid;
    if (imgs[k]) return Promise.resolve(imgs[k]);
    return get(k).then(function(b){ if (!b) return null; return new Promise(function(res){ var im = new Image(); im.onload = function(){ imgs[k] = im; res(im); }; im.onerror = function(){ res(null); }; im.src = URL.createObjectURL(b); }); });
  }
  function render(im, c, kind, type){
    var sz = SIZES[kind], r = region(im.naturalWidth, im.naturalHeight, c, ASPECT[kind]), cv = document.createElement('canvas'); cv.width = sz[0]; cv.height = sz[1];
    var x = cv.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(im, r.sx, r.sy, r.sw, r.sh, 0, 0, sz[0], sz[1]);
    return new Promise(function(res){ cv.toBlob(function(b){ res(b); }, type || 'image/jpeg', 0.86); });
  }
  /* URL del recorte ya hecho, o '' (y se prepara; al estar listo se repinta lo que lo use) */
  function url(C, fid, kind){
    if (!C) return ''; var f = form(C, fid); if (!f || !f.has) return '';
    var k = C.id + ':' + f.id + ':' + (f.ver || 0) + ':' + kind;
    if (urls[k]) return urls[k];
    if (!pending[k]) { pending[k] = 1; loadImg(C, f.id).then(function(im){ return im ? render(im, crop(f, kind), kind, 'image/webp') : null; }).then(function(b){ delete pending[k]; if (!b) return; urls[k] = URL.createObjectURL(b); refresh(); }).catch(function(){ delete pending[k]; }); }
    return '';
  }
  var refreshT = 0;
  function refresh(){ clearTimeout(refreshT); refreshT = setTimeout(function(){ if (window.Diario && Diario.redraw) Diario.redraw(); paintSheet(); }, 30); }

  /* ---------- Piezas de HTML ---------- */
  function placeholder(f, cls){ var ic = (f && f.ic) || 'person'; return '<span class="pt-ph ' + (cls || '') + '" aria-hidden="true"><svg class="gi"><use href="#gi-' + esc(ic) + '"/></svg></span>'; }
  /* Retrato del personaje propio: kind 'tok' (círculo) o 'por' (3:4) */
  function pic(C, kind, cls, fid){
    var f = C && form(C, fid), u = C && url(C, fid, kind);
    if (u) return '<span class="pt-img ' + kind + ' ' + (cls || '') + '" style="background-image:url(\'' + u + '\')" role="img" aria-label="' + esc(f.name) + '"></span>';
    return '<span class="pt-img ' + kind + ' empty ' + (cls || '') + '">' + placeholder(f) + '</span>';
  }
  function has(C){ return !!(C && form(C) && form(C).has); }
  /* Retrato de otro miembro de la campaña (o de un enemigo) por el id de imagen que mandó */
  function remote(id){ return id && window.Mesa ? Mesa.imgUrl(id) : ''; }
  /* Icono por tipo de criatura (para enemigos sin imagen) */
  var TYPE_IC = {'aberración':'tentacles-skull', bestia:'wolf-head', celestial:'angel-outfit', constructo:'robot-golem', 'dragón':'dragon-head', elemental:'flame', 'feérico':'fairy', infernal:'devil-mask', gigante:'giant', humanoide:'hood', monstruosidad:'hydra', cieno:'slime', planta:'vine-flower', 'muerto viviente':'raise-zombie'};
  function typeIcon(t){ return TYPE_IC[String(t || '').toLowerCase()] || 'goblin-head'; }

  /* ---------- Subir a la campaña ---------- */
  var syncing = null;
  function upKey(code, f){ return code + '|' + f.id + '|' + (f.ver || 0); }
  function forSummary(C){
    var code = window.Sala && Sala.code && Sala.code(), f = C && form(C); if (!code || !f) return {};
    var u = C.pt && C.pt.up && C.pt.up[upKey(code, f)]; return {img:u ? u.p : null, tok:u ? u.t : null, form:f.id !== 'base' ? f.name : null};
  }
  function sync(){
    if (!window.Sala || Sala.status() !== 'on' || !window.Diario) return Promise.resolve();
    var C = Diario.cur(), code = Sala.code(); if (!C || !code || (Sala.role && Sala.role() === 'dm')) return Promise.resolve();
    var f = form(C); if (!f.has) { Sala.sync(); return Promise.resolve(); }
    var key = upKey(code, f); if (C.pt.up[key] || syncing === key) { Sala.sync(); return Promise.resolve(); }
    syncing = key;
    return loadImg(C, f.id).then(function(im){
      if (!im) return null;
      return Promise.all([render(im, crop(f, 'tok'), 'tok'), render(im, crop(f, 'por'), 'por')]).then(function(b){ return Mesa.upload(b[0], 256).then(function(t){ return Mesa.upload(b[1], 480).then(function(p){ return {t:t, p:p}; }); }); });
    }).then(function(ids){
      syncing = null; if (!ids) return;
      // solo se recuerdan las subidas de esta campaña para esta versión
      Object.keys(C.pt.up).forEach(function(k){ if (k.indexOf(code + '|' + f.id + '|') === 0) delete C.pt.up[k]; });
      C.pt.up[key] = ids; if (Diario.save) Diario.save(); else Sala.sync();
    }).catch(function(){ syncing = null; });
  }
  function done(C){ if (window.Diario && Diario.save) Diario.save(); refresh(); sync(); }

  /* ---------- Hoja de retratos y editor de encuadre ---------- */
  var ed = null; // {cid, fid, kind, crop:{tok,por}, im, file}
  function sheet(){ return document.getElementById('ptSheet'); }
  function open(fid){
    var C = window.Diario && Diario.cur(); if (!C) return;
    ed = null; if (fid) startEdit(C, fid); if (Diario.openSheet) Diario.openSheet('ptSheet'); paintSheet();
  }
  function paintSheet(){
    var s = sheet(); if (!s || s.hidden && !ed) return; var body = document.getElementById('ptBody'), C = window.Diario && Diario.cur(); if (!body || !C) return;
    if (ed) { body.innerHTML = editorHtml(C); drawStage(); return; }
    var P = pt(C), D = Diario.D && Diario.D(), sug = suggestions(C, D), have = {}; P.forms.forEach(function(f){ have[f.name] = 1; });
    var h = '<div class="pt-hero">' + pic(C, 'por', 'big') + '<div class="pt-hero-t"><b>' + esc(C.name || 'Sin nombre') + '</b><small>Forma: ' + esc(form(C).name) + '</small>'
      + '<label class="btn main pickbtn">' + (form(C).has ? 'Cambiar imagen' : 'Subir imagen') + '<input type="file" accept="image/*" data-ptfile="' + esc(P.cur) + '"></label>'
      + (form(C).has ? '<button class="btn" type="button" data-act="ptedit" data-v="' + esc(P.cur) + '">Encuadrar</button>' : '') + '</div></div>'
      + '<span class="label">formas</span><p class="note">Toca una para ponértela: cambia tu retrato en la portada, el combate y el mapa de la campaña.</p><div class="pt-forms">'
      + P.forms.map(function(f){ return '<div class="pt-form' + (f.id === P.cur ? ' on' : '') + '"><button type="button" class="pt-pick" data-act="ptcur" data-v="' + esc(f.id) + '" aria-pressed="' + (f.id === P.cur) + '">' + pic(C, 'tok', 'sm', f.id) + '<span>' + esc(f.name) + '</span></button>'
        + '<div class="pt-fb"><label class="icon-btn sm pickbtn" title="Imagen" aria-label="Imagen de ' + esc(f.name) + '"><svg class="ic"><use href="#i-image"/></svg><input type="file" accept="image/*" data-ptfile="' + esc(f.id) + '"></label>' + (f.has ? '<button class="icon-btn sm" type="button" data-act="ptedit" data-v="' + esc(f.id) + '" aria-label="Encuadrar ' + esc(f.name) + '" title="Encuadrar"><svg class="ic"><use href="#i-fit"/></svg></button>' : '') + (f.id !== 'base' ? '<button class="icon-btn sm" type="button" data-act="ptdel" data-v="' + esc(f.id) + '" aria-label="Quitar ' + esc(f.name) + '" title="Quitar"><svg class="ic"><use href="#i-trash"/></svg></button>' : '') + '</div></div>'; }).join('') + '</div>'
      + '<span class="label" style="margin-top:14px">agregar forma</span>' + sug.map(function(g){ return '<div class="pt-sug"><small>' + esc(g.group) + '</small><div class="chips">' + g.items.map(function(x){ var got = have[x[0]] && x[0] !== 'Nueva forma'; return '<button type="button" class="chip pt-add' + (got ? ' got' : '') + '" data-act="ptadd" data-n="' + esc(x[0]) + '" data-ic="' + esc(x[1]) + '"' + (got ? ' disabled' : '') + '><svg class="gi"><use href="#gi-' + esc(x[1]) + '"/></svg>' + esc(x[0]) + '</button>'; }).join('') + '</div></div>'; }).join('')
      + '<p class="note">Sin imagen, cada forma lleva un icono. La imagen se queda en este aparato; en una campaña solo se suben los recortes de la forma que llevas puesta.</p>';
    body.innerHTML = h;
  }
  function startEdit(C, fid){ var f = form(C, fid); ed = {cid:C.id, fid:f.id, kind:'por', crop:{tok:Object.assign({}, crop(f, 'tok')), por:Object.assign({}, crop(f, 'por'))}, im:null}; loadImg(C, f.id).then(function(im){ if (ed && ed.fid === f.id) { ed.im = im; drawStage(); } }); }
  function editorHtml(C){
    var f = form(C, ed.fid), c = ed.crop[ed.kind];
    return '<div class="pt-ed"><div class="seg" role="group" aria-label="Qué encuadras"><button type="button" data-act="ptkind" data-v="por" aria-pressed="' + (ed.kind === 'por') + '">Retrato</button><button type="button" data-act="ptkind" data-v="tok" aria-pressed="' + (ed.kind === 'tok') + '">Ficha del mapa</button></div>'
      + '<div class="pt-stage-w"><canvas class="pt-stage" id="ptStage" aria-label="Arrastra para mover la imagen; con dos dedos o la rueda acercas"></canvas></div>'
      + '<label class="sfx-vol"><span><b>Acercar</b></span><input type="range" min="100" max="400" step="5" id="ptZoom" value="' + Math.round(c.z * 100) + '" aria-label="Acercar"><output>' + Math.round(c.z * 100) + '%</output></label>'
      + '<p class="note">' + (ed.kind === 'por' ? 'El retrato sale en la portada, el encabezado y la barra de turnos.' : 'La ficha es el círculo que se ve en el mapa y en el chat.') + ' Forma: <b>' + esc(f.name) + '</b>.</p>'
      + '<div class="dm-row"><button class="btn" type="button" data-act="ptcancel">Cancelar</button><button class="btn main" type="button" data-act="ptsave">Guardar encuadre</button></div></div>';
  }
  /* El marco queda fijo en el centro y la imagen se mueve debajo */
  function frame(cv){ var W = cv.width, H = cv.height, a = ASPECT[ed.kind], fw = ed.kind === 'tok' ? Math.min(W, H) * 0.72 : Math.min(W * 0.66, H * 0.8 * a); return {w:fw, h:fw / a, x:(W - fw) / 2, y:(H - fw / a) / 2}; }
  function drawStage(){
    var cv = document.getElementById('ptStage'); if (!cv || !ed) return; var dpr = Math.min(2, window.devicePixelRatio || 1), cw = cv.clientWidth || 320, ch = Math.round(cw * 1.05);
    if (cv.width !== Math.round(cw * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); cv.style.height = ch + 'px'; }
    var x = cv.getContext('2d'); if (!x) return; x.fillStyle = '#120d0b'; x.fillRect(0, 0, cv.width, cv.height);
    var im = ed.im; if (!im) { x.fillStyle = '#c9b48a'; x.font = (14 * dpr) + 'px Georgia'; x.textAlign = 'center'; x.fillText('Cargando…', cv.width / 2, cv.height / 2); return; }
    var F = frame(cv), r = region(im.naturalWidth, im.naturalHeight, ed.crop[ed.kind], ASPECT[ed.kind]), s = F.w / r.sw;
    x.drawImage(im, F.x - r.sx * s, F.y - r.sy * s, im.naturalWidth * s, im.naturalHeight * s);
    x.save(); x.fillStyle = 'rgba(10,6,4,.62)'; x.beginPath(); x.rect(0, 0, cv.width, cv.height);
    if (ed.kind === 'tok') x.arc(F.x + F.w / 2, F.y + F.h / 2, F.w / 2, 0, Math.PI * 2, true); else { x.moveTo(F.x, F.y); x.lineTo(F.x, F.y + F.h); x.lineTo(F.x + F.w, F.y + F.h); x.lineTo(F.x + F.w, F.y); x.closePath(); }
    x.fill('evenodd'); x.restore();
    x.strokeStyle = '#d9b866'; x.lineWidth = 2 * dpr; x.beginPath(); if (ed.kind === 'tok') x.arc(F.x + F.w / 2, F.y + F.h / 2, F.w / 2, 0, Math.PI * 2); else x.rect(F.x, F.y, F.w, F.h); x.stroke();
  }
  /* Gestos del editor: arrastrar mueve, dos dedos o la rueda acercan */
  var ptr = {}, g0 = null;
  function stageEv(ev){
    var cv = document.getElementById('ptStage'); if (!cv || !ed || !ed.im || ev.target !== cv) return;
    var dpr = cv.width / (cv.clientWidth || 1), F = frame(cv), c = ed.crop[ed.kind], r = region(ed.im.naturalWidth, ed.im.naturalHeight, c, ASPECT[ed.kind]), s = F.w / r.sw / dpr;
    if (ev.type === 'pointerdown') { ev.preventDefault(); try { cv.setPointerCapture(ev.pointerId); } catch(e){} ptr[ev.pointerId] = [ev.clientX, ev.clientY]; var ids = Object.keys(ptr); g0 = ids.length === 2 ? {d:dist(), z:c.z} : null; return; }
    if (ev.type === 'pointermove' && ptr[ev.pointerId]) {
      var p0 = ptr[ev.pointerId]; ptr[ev.pointerId] = [ev.clientX, ev.clientY];
      if (Object.keys(ptr).length === 2 && g0) { c.z = Math.max(1, Math.min(4, g0.z * dist() / g0.d)); syncZoom(); }
      else { c.x -= (ev.clientX - p0[0]) / s / ed.im.naturalWidth; c.y -= (ev.clientY - p0[1]) / s / ed.im.naturalHeight; clampCrop(c); }
      drawStage(); return;
    }
    if (ev.type === 'pointerup' || ev.type === 'pointercancel') { delete ptr[ev.pointerId]; g0 = null; return; }
    if (ev.type === 'wheel') { ev.preventDefault(); c.z = Math.max(1, Math.min(4, c.z * (ev.deltaY < 0 ? 1.08 : 1 / 1.08))); syncZoom(); drawStage(); }
  }
  function dist(){ var p = Object.keys(ptr).map(function(k){ return ptr[k]; }); return Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]) || 1; }
  function clampCrop(c){ var r = region(ed.im.naturalWidth, ed.im.naturalHeight, c, ASPECT[ed.kind]); c.x = (r.sx + r.sw / 2) / ed.im.naturalWidth; c.y = (r.sy + r.sh / 2) / ed.im.naturalHeight; }
  function syncZoom(){ var z = document.getElementById('ptZoom'); if (z) { z.value = Math.round(ed.crop[ed.kind].z * 100); if (z.nextElementSibling) z.nextElementSibling.textContent = z.value + '%'; } }
  ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach(function(t){ document.addEventListener(t, stageEv); });
  document.addEventListener('wheel', stageEv, {passive:false});

  /* Imagen nueva: se achica a 1200 px y se guarda en el aparato */
  function setImage(C, fid, file){
    return new Promise(function(res, rej){
      var im = new Image(), u = URL.createObjectURL(file);
      im.onload = function(){ var s = Math.min(1, 1200 / Math.max(im.naturalWidth, im.naturalHeight)), cv = document.createElement('canvas'); cv.width = Math.round(im.naturalWidth * s); cv.height = Math.round(im.naturalHeight * s); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); URL.revokeObjectURL(u); cv.toBlob(function(b){ b ? res(b) : rej(new Error('No pude leer esa imagen.')); }, 'image/webp', 0.88); };
      im.onerror = function(){ URL.revokeObjectURL(u); rej(new Error('No pude leer esa imagen.')); };
      im.src = u;
    }).then(function(b){
      var k = 'pt:' + C.id + ':' + fid; delete imgs[k];
      return put(k, b).then(function(ok){ if (!ok) throw new Error('No hay espacio en este aparato para la imagen.'); var f = form(C, fid); f.has = true; f.ver = (f.ver || 0) + 1; f.crop = {tok:defCrop('tok'), por:defCrop('por')}; pt(C).cur = fid; done(C); startEdit(C, fid); paintSheet(); });
    });
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('[data-act^="pt"]'); if (!b || !window.Diario) return;
    var C = Diario.cur(); if (!C) return; var a = b.dataset.act, P = pt(C);
    if (a === 'ptopen') open();
    else if (a === 'ptcur') { setCur(C, b.dataset.v); if (window.Sfx) Sfx.play('toggle'); paintSheet(); }
    else if (a === 'ptadd') { var id = addForm(C, b.dataset.n === 'Nueva forma' ? 'Forma ' + P.forms.length : b.dataset.n, b.dataset.ic); P.cur = id; done(C); paintSheet(); }
    else if (a === 'ptdel') { if (!b.dataset.sure) { b.dataset.sure = 1; b.classList.add('war'); return; } P.forms = P.forms.filter(function(f){ return f.id !== b.dataset.v; }); if (P.cur === b.dataset.v) P.cur = 'base'; del('pt:' + C.id + ':' + b.dataset.v); done(C); paintSheet(); }
    else if (a === 'ptedit') { startEdit(C, b.dataset.v); paintSheet(); }
    else if (a === 'ptkind' && ed) { ed.kind = b.dataset.v; paintSheet(); }
    else if (a === 'ptcancel') { ed = null; paintSheet(); }
    else if (a === 'ptsave' && ed) { var f = form(C, ed.fid); f.crop = {tok:ed.crop.tok, por:ed.crop.por}; f.ver = (f.ver || 0) + 1; ed = null; done(C); paintSheet(); if (window.Sala) Sala.toast('Encuadre guardado.'); }
  });
  document.addEventListener('input', function(ev){ if (ev.target && ev.target.id === 'ptZoom' && ed) { ed.crop[ed.kind].z = (+ev.target.value) / 100; if (ed.im) clampCrop(ed.crop[ed.kind]); syncZoom(); drawStage(); } });
  document.addEventListener('change', function(ev){
    var t = ev.target; if (!t || !t.dataset || t.dataset.ptfile == null || !t.files || !t.files[0] || !window.Diario) return;
    var C = Diario.cur(); if (!C) return; setImage(C, t.dataset.ptfile, t.files[0]).catch(function(e){ if (window.Sala) Sala.toast(e.message || 'No se pudo usar esa imagen.'); }); t.value = '';
  });
  window.addEventListener('resize', function(){ if (ed) drawStage(); });
  if (window.Sala && Sala.on) Sala.on('state', function(){ sync(); });

  /* ==================== IMÁGENES DE MONSTRUOS (carpeta 5etools-img del DM) ====================
     En la laptop con Chrome se recuerda la carpeta (File System Access); si no, se elige cada vez que abres el diario.
     Para 'Goblin Boss|XMM' busca bestiary/tokens/XMM/Goblin Boss.webp (o .png/.jpg), luego bestiary/XMM/Goblin Boss.webp. */
  var dir = null, files = null, monUp = {}, monLocal = {};
  try { monUp = JSON.parse(localStorage.getItem('diario-mon-img') || '{}'); } catch(e){}
  get('imgdir').then(function(h){ if (h) dir = h; paintMon(); });
  function candidates(ref){
    var p = String(ref || '').split('|'), name = p[0], src = p[1] || 'MM', out = [];
    ['', 'img/'].forEach(function(root){ ['webp', 'png', 'jpg'].forEach(function(ext){ out.push(root + 'bestiary/tokens/' + src + '/' + name + '.' + ext); }); ['webp', 'png', 'jpg'].forEach(function(ext){ out.push(root + 'bestiary/' + src + '/' + name + '.' + ext); }); });
    return out;
  }
  function fromHandle(path){
    var seg = path.split('/'), h = dir;
    return seg.slice(0, -1).reduce(function(pr, s){ return pr.then(function(d){ return d && d.getDirectoryHandle(s).catch(function(){ return null; }); }); }, Promise.resolve(h))
      .then(function(d){ return d && d.getFileHandle(seg[seg.length - 1]).then(function(f){ return f.getFile(); }).catch(function(){ return null; }); });
  }
  function findFile(ref){
    var cs = candidates(ref);
    if (files) { for (var i = 0; i < cs.length; i++) { var f = files[cs[i].toLowerCase()]; if (f) return Promise.resolve(f); } return Promise.resolve(null); }
    if (!dir) return Promise.resolve(null);
    var perm = dir.queryPermission ? dir.queryPermission({mode:'read'}) : Promise.resolve('granted');
    return perm.then(function(st){ return st === 'granted' ? st : dir.requestPermission ? dir.requestPermission({mode:'read'}) : st; }).then(function(st){
      if (st !== 'granted') return null;
      return cs.reduce(function(pr, path){ return pr.then(function(found){ return found || fromHandle(path); }); }, Promise.resolve(null));
    }).catch(function(){ return null; });
  }
  /* Imagen chica del monstruo (ficha 256 px) y su id en la campaña; null si no la hay */
  function monster(ref){
    if (!ref || !window.Sala || Sala.status() !== 'on') return Promise.resolve(null);
    var code = Sala.code(), k = code + '|' + ref; if (monUp[k]) return Promise.resolve(monUp[k]);
    var cached = monLocal[ref] ? Promise.resolve(monLocal[ref]) : get('mimg:' + ref);
    return cached.then(function(b){
      if (b) return b;
      return findFile(ref).then(function(file){
        if (!file) return null;
        return new Promise(function(res){ var im = new Image(), u = URL.createObjectURL(file); im.onload = function(){ var n = 256, cv = document.createElement('canvas'); cv.width = cv.height = n; var s = Math.max(n / im.naturalWidth, n / im.naturalHeight), w = im.naturalWidth * s, h = im.naturalHeight * s; cv.getContext('2d').drawImage(im, (n - w) / 2, (n - h) / 2, w, h); URL.revokeObjectURL(u); cv.toBlob(function(bb){ res(bb); }, 'image/png'); }; im.onerror = function(){ URL.revokeObjectURL(u); res(null); }; im.src = u; })
          .then(function(bb){ if (bb) { monLocal[ref] = bb; put('mimg:' + ref, bb); } return bb; });
      });
    }).then(function(b){
      if (!b) return null;
      return Mesa.upload(b, 256).then(function(id){ monUp[k] = id; try { localStorage.setItem('diario-mon-img', JSON.stringify(monUp)); } catch(e){} return id; });
    }).catch(function(){ return null; });
  }
  function paintMon(){
    var box = document.getElementById('monImgBox'); if (!box) return;
    var n = files ? Object.keys(files).length : 0;
    box.innerHTML = '<p style="margin:6px 0 0;font-size:15px">Para que tus enemigos salgan con su imagen en el mapa y la barra de turnos, elige la carpeta <b>5etools-img</b> (o la <code>img</code> de tu 5etools). Solo se lee cuando agregas un monstruo; se guarda una ficha chica de cada uno.</p>'
      + '<div class="picks">' + (window.showDirectoryPicker ? '<button class="btn" type="button" data-act="monimgdir">Elegir carpeta</button>' : '<label class="btn pickbtn">Elegir carpeta<input type="file" id="monImgIn" webkitdirectory directory multiple></label>') + (dir || files ? '<button class="btn" type="button" data-act="monimgx">Olvidar carpeta</button>' : '') + '</div>'
      + '<p class="note" style="margin:6px 0 0">' + (dir ? 'Carpeta lista: ' + esc(dir.name) + '. Se recuerda en este aparato.' : files ? 'Carpeta lista para esta sesión (' + n + ' imágenes).' : window.showDirectoryPicker ? 'Sin carpeta: los enemigos llevan un icono de su tipo.' : 'Sin carpeta: los enemigos llevan un icono de su tipo. En este navegador hay que elegirla cada vez que abres el diario.') + '</p>';
  }
  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('[data-act="monimgdir"],[data-act="monimgx"]'); if (!b) return;
    if (b.dataset.act === 'monimgx') { dir = null; files = null; del('imgdir'); paintMon(); return; }
    window.showDirectoryPicker({mode:'read', id:'5etools-img'}).then(function(h){ dir = h; files = null; return put('imgdir', h); }).then(paintMon).catch(function(){});
  });
  document.addEventListener('change', function(ev){
    var t = ev.target; if (!t || t.id !== 'monImgIn' || !t.files) return;
    files = {}; for (var i = 0; i < t.files.length; i++) { var f = t.files[i], p = String(f.webkitRelativePath || f.name).toLowerCase(); if (!/\.(webp|png|jpe?g)$/.test(p)) continue; var cut = p.indexOf('bestiary/'); if (cut >= 0) { var root = p.slice(0, cut); files[p.slice(root.length)] = f; files['img/' + p.slice(root.length)] = f; } }
    paintMon();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintMon); else setTimeout(paintMon, 0);
  setTimeout(refresh, 0); // el diario se dibujó antes de que este módulo existiera

  return {pt:pt, form:form, cur:cur, has:has, url:url, pic:pic, placeholder:placeholder, remote:remote, typeIcon:typeIcon, forSummary:forSummary, sync:sync, open:open, setCur:setCur, suggestions:suggestions, monster:monster, paint:paintSheet};
})();
