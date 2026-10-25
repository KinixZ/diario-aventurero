
/* ==================== EL DIARIO ==================== */
(function(){
  var esc = Render5e.esc, attr = Render5e.attr, R = Rules5e, N = Lib5e.norm;
  var $ = function(s, r){ return (r||document).querySelector(s); };
  var $$ = function(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };

  var TABS = [
    ['personaje','Personaje','i-scroll','Folio I · Personaje'],
    ['conjuros','Conjuros','i-star','Folio II · Conjuros'],
    ['equipo','Equipo','i-bag','Folio III · Equipo'],
    ['rasgos','Rasgos','i-shield','Folio IV · Rasgos'],
    ['notas','Notas','i-quill','Folio V · Notas'],
    ['grimorio','Grimorio','i-tome','Grimorio']
  ];
  var GSECS = [['reglas','Reglas'],['acciones','Acciones'],['condiciones','Condiciones'],['conjuros','Conjuros'],['objetos','Objetos'],['dotes','Dotes']];
  var SKINS = [
    ['carmesi','Carmesí','Cuero y pergamino', ['#3a1d17','#f1e6cc','#8c2626','#b08a3e']],
    ['acero','Acero','Azul y plata', ['#1d2a3a','#e9edf0','#2f5d8a','#8797a8']],
    ['bosque','Bosque','Verde y oro viejo', ['#22311f','#ece6cf','#3f6b3a','#9c8a3e']],
    ['obsidiana','Obsidiana','Páginas oscuras', ['#0f0e13','#1d1b21','#a8323a','#d9b866']]
  ];
  var SLOTS = [['head','Cabeza','i-helm'],['cloak','Capa','i-cloak'],['back','Espalda','i-bag'],['armor','Armadura','i-armor'],['bracers','Brazales','i-bracer'],['gloves','Guantes','i-glove'],['boots','Botas','i-boot'],['main','Mano principal','i-sword'],['off','Mano secundaria','i-shield'],['acc','Accesorios','i-ring']];
  var SRC = {XPHB:'Manual del jugador 2024', PHB:'Manual del jugador 2014', XDMG:'Guía del DM 2024', DMG:'Guía del DM 2014', XGE:'Guía de Xanathar', TCE:'Caldero de Tasha', EFA:'Forge of the Artificer', FTD:'Tesoro de dragones de Fizban', ERLW:'Eberron: Rising from the Last War', BGG:'Gloria de los gigantes de Bigby', DSotDQ:'Dragonlance', SatO:'Sigil and the Outlands', BMT:'Book of Many Things', MTF:'Mordenkainen: Tome of Foes', SCC:'Strixhaven', FRHoF:'Heroes of Faerûn', SCAG:'Guía de la Costa de la Espada'};
  var SIZE = {S:'Pequeño', M:'Mediano', L:'Grande', T:'Diminuto'};
  var STD = [15,14,13,12,10,8];
  var PBCOST = {8:0,9:1,10:2,11:3,12:4,13:5,14:7,15:9};

  /* ---------- Personaje de ejemplo ---------- */
  function sampleChar(){
    return {id:'ejemplo', name:'[Nombre del paladín]', level:11, method:'array', base:{str:15,dex:10,con:14,int:8,wis:12,cha:13},
      ch:{cls:'Paladin|XPHB', sub:'Oathbreaker|DMG', race:'Aasimar|XPHB', bg:'Soldier|XPHB', size:'M', bgAbil:{alt:0, picks:['str','con']}, clssk0:['persuasion','insight'], langs:['Draconic','Elvish'],
        'feat:asi4':'Ability Score Improvement|XPHB', 'fab:asi4':{alt:0, picks:['str']}, 'feat:asi8':'Ability Score Improvement|XPHB', 'fab:asi8':{alt:1, picks:['cha','con']}, 'feat:fp_fightingstyle2_0':'Defense|XPHB',
        mastery:['Longsword','Javelin'], spells:['Bless|XPHB','Command|XPHB','Cure Wounds|XPHB','Shield of Faith|XPHB','Heroism|XPHB','Aid|XPHB','Magic Weapon|XPHB','Lesser Restoration|XPHB','Revivify|XPHB','Aura of Vitality|XPHB'], 'eq:c0':'A', 'eq:b0':'A'},
      rt:{hp:78, items:[
        {id:'esp', n:'Espada larga', ref:'item|Longsword|XPHB', k:'wpn', ic:'i-sword', w:1, h:3, slot:'main', eq:'main', d:'Arma cuerpo a cuerpo'},
        {id:'esc', n:'Escudo', ref:'item|Shield|XPHB', k:'wpn', ic:'i-shield', w:2, h:2, slot:'off', eq:'off', d:'Escudo'},
        {id:'pla', n:'Armadura de placas', ref:'item|Plate Armor|XPHB', k:'wpn', ic:'i-armor', w:3, h:3, slot:'armor', eq:'armor', d:'Armadura pesada'},
        {id:'jav', n:'Jabalinas', ref:'item|Javelin|XPHB', q:6, k:'wpn', ic:'i-sword', w:1, h:2, x:3, y:2, slot:'main', d:'Arma cuerpo a cuerpo arrojadiza'},
        {id:'rac', n:'Raciones', ref:'item|Rations|XPHB', q:10, k:'con', ic:'i-food', w:2, h:1, x:0, y:0, d:'Comida para un día cada una.'},
        {id:'cue', n:'Cuerda', ref:'item|Rope|XPHB', k:'', ic:'i-rope', w:2, h:2, x:2, y:0, d:'15 m de cuerda.'},
        {id:'sac', n:'Saco de dormir', ref:'item|Bedroll|XPHB', k:'', ic:'i-bed', w:3, h:2, x:4, y:0, d:'Para descansar al aire libre.'},
        {id:'ant', n:'Antorchas', ref:'item|Torch|XPHB', q:10, k:'con', ic:'i-torch', w:1, h:3, x:7, y:0, d:'Luz brillante 6 m y tenue 6 m más, durante 1 hora.'},
        {id:'odr', n:'Odre', ref:'item|Waterskin|XPHB', k:'', ic:'i-water', w:1, h:2, x:0, y:1, d:'Agua para un día.'},
        {id:'poc', n:'Poción de curación', ref:'item|Potion of Healing|XDMG', q:1, k:'mag', ic:'i-flask', w:1, h:2, x:2, y:2, use:'Tira 2d4 + 2 y suma el resultado a tus PV.', d:'Recuperas 2d4 + 2 PV.'},
        {id:'cap', n:'Capa de protección', ref:'item|Cloak of Protection|XDMG', k:'mag', ic:'i-cloak', w:2, h:2, x:4, y:2, slot:'cloak', att:true, d:'+1 a la CA y a las salvaciones. Requiere sintonización.'}
      ], coins:{cp:0, sp:0, ep:0, gp:120, pp:0}, notes:''}};
  }

  /* ---------- Estado ---------- */
  var S = {skin:'carmesi', chars:[], active:null, tab:'personaje', left:'personaje', v:4};
  try { var sv = JSON.parse(localStorage.getItem('diario-v4') || 'null'); if (sv && sv.v === 4) Object.assign(S, sv); else { var old = JSON.parse(localStorage.getItem('diario-paladin') || 'null'); if (old && old.skin) S.skin = old.skin; } } catch(e){}
  function save(){ try { localStorage.setItem('diario-v4', JSON.stringify(S)); } catch(e){} if (window.Sala) Sala.sync(); }
  function cur(){ return S.chars.filter(function(c){ return c.id === S.active; })[0] || null; }
  function rt(C){
    C.rt = C.rt || {};
    var d = {hp:null, temp:0, slotsUsed:[], pactUsed:0, res:{}, items:[], notes:'', conc:null, econ:{a:false,b:false,r:false,m:false}, crit:false, smite:0, round:1, coins:{cp:0,sp:0,ep:0,gp:0,pp:0}};
    Object.keys(d).forEach(function(k){ if (C.rt[k] === undefined) C.rt[k] = d[k]; });
    return C.rt;
  }
  var D = null, libReady = false;
  function recompute(){ var C = cur(); D = C && Lib5e.has() ? R.derive(C) : null; if (D && D.ok) { var r = rt(C); if (r.hp == null || r.hp > D.hp.max) r.hp = D.hp.max; } }
  var G = {sec:'reglas', q:'', sub:'*', hideOld:true, view:null, hist:[], from:null};

  var book = $('#book'), cover = $('#cover'), veil = $('#veil');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mq = window.matchMedia('(min-width: 900px)');
  function wide(){ return mq.matches; }
  function sgn(n){ return R.sgn(n); }
  function spellLink(e){ return '<a class="ref" data-ref="spell|' + attr(e.name) + '|' + attr(e.source) + '">' + esc(e.name) + '</a>'; }

  /* ---------- Estilos ---------- */
  function applySkin(){
    if (S.skin === 'carmesi') document.documentElement.removeAttribute('data-skin');
    else document.documentElement.setAttribute('data-skin', S.skin);
    $('#skins').innerHTML = SKINS.map(function(k){
      return '<button type="button" class="skin" data-act="skin" data-v="'+k[0]+'" aria-pressed="'+(S.skin===k[0])+'"><span class="sw">' + k[3].map(function(c){ return '<i style="background:'+c+'"></i>'; }).join('') + '</span><b>'+k[1]+'</b><small>'+k[2]+'</small></button>';
    }).join('');
  }

  /* ---------- Separadores ---------- */
  $('#ribbons').innerHTML = TABS.map(function(t){
    return '<button type="button" class="ribbon'+(t[0]==='grimorio'?' grim':'')+'" data-act="tab" data-tab="'+t[0]+'" aria-pressed="false"><svg class="ic"><use href="#'+t[2]+'"/></svg><span>'+t[1]+'</span></button>';
  }).join('');
  $('#ctabs').innerHTML = '<button type="button" class="ctab char" data-act="left" data-v="personaje" aria-pressed="false">Personaje</button>' + GSECS.map(function(s){
    return '<button type="button" class="ctab" data-act="left" data-v="'+s[0]+'" aria-pressed="false">'+s[1]+'</button>';
  }).join('');

  /* ---------- Laptop vs teléfono ---------- */
  var head = $('#head'), personaje = $('#pPersonaje'), grim = $('#grim'), scroll = $('#scroll'), left = $('#pageLeft');
  var leftScroll = document.createElement('div'); leftScroll.className = 'scroll';
  function layout(){
    if (wide()) {
      left.appendChild(head); left.appendChild(leftScroll); leftScroll.appendChild(personaje); leftScroll.appendChild(grim);
      if (S.tab === 'personaje' || S.tab === 'grimorio') S.tab = 'conjuros';
    } else {
      $('#pageRight').insertBefore(head, scroll); scroll.appendChild(personaje); scroll.appendChild(grim);
      if (leftScroll.parentNode) leftScroll.remove();
    }
    render(false); renderGrim();
  }

  /* ==================== HOJA ==================== */
  function noLibHtml(){
    if (!libReady) return '<div class="empty-state"><b>Abriendo la biblioteca…</b></div>';
    return '<div class="empty-state"><b>Falta tu biblioteca de 5etools</b>El diario calcula todo con los datos de 5etools. Cárgalos una vez desde Ajustes.<br><br><button class="btn main" type="button" data-act="settings">Abrir Ajustes</button></div>';
  }
  function noCharHtml(){ return '<div class="empty-state"><b>Todavía no hay personaje</b>Crea uno con el asistente: elige clase, origen y características y el diario hace las cuentas.<br><br><button class="btn main" type="button" data-act="newchar">Crear personaje</button></div>'; }
  function render(animate){
    recompute();
    var C = cur(), showLeftGrim = wide() && S.left !== 'personaje';
    $$('.ribbon').forEach(function(b){ b.setAttribute('aria-pressed', String(b.dataset.tab === S.tab)); });
    $$('.ctab').forEach(function(b){ b.setAttribute('aria-pressed', String(b.dataset.v === S.left)); });
    if (wide()) { personaje.hidden = showLeftGrim; grim.hidden = !showLeftGrim; }
    $$('#scroll > .panel').forEach(function(p){
      var on = p.dataset.panel === S.tab; p.hidden = !on;
      if (on && animate && !reduce) { p.classList.remove('enter'); void p.offsetWidth; p.classList.add('enter'); }
    });
    $('#folio').textContent = TABS.filter(function(x){ return x[0] === S.tab; })[0][3];
    renderHead();
    if (!Lib5e.has() || !C || !D || !D.ok) {
      var h = !Lib5e.has() ? noLibHtml() : noCharHtml();
      ['#pPersonaje','#pConjuros','#pRasgos'].forEach(function(s){ $(s).innerHTML = h; });
      $('#bodySlots').innerHTML = ''; $('#coins').innerHTML = '';
      $$('.it', grid).forEach(function(e){ e.remove(); }); $('#caseText').innerHTML = h; $('#caseActions').innerHTML = '';
      $('#notes').value = ''; $('#notes').disabled = true;
      renderChars(); save(); return;
    }
    $('#notes').disabled = false; $('#notes').value = rt(C).notes || '';
    renderPersonaje(C); renderConjuros(C); renderRasgos(C); renderEquip(); renderCoins(C); renderChars();
    if (!$('#combat').hidden) renderCombat();
    save();
  }
  function renderHead(){
    var C = cur();
    if (C && D && D.ok) {
      $('#hLvl').textContent = D.level; $('#hName').textContent = C.name || 'Sin nombre';
      var clsTxt = D.multi ? D.classes.map(function(E){ return E.cls.name + ' ' + E.lv + (E.sub ? ' (' + E.sub.name + ')' : ''); }).join(' / ') : D.cls.name + (D.sub ? ' · ' + D.sub.name : '');
      $('#hSub').textContent = [D.race && D.race.name, clsTxt].filter(Boolean).join(' · ');
      $('#cvName').textContent = C.name || 'Sin nombre'; $('#cvSub').textContent = D.clsLabel + ' · nivel ' + D.level;
    } else {
      $('#hLvl').textContent = '–'; $('#hName').textContent = 'Diario del Aventurero'; $('#hSub').textContent = C ? 'Personaje sin calcular' : 'Sin personaje';
      $('#cvName').textContent = C ? (C.name || 'Sin nombre') : 'Sin personaje'; $('#cvSub').textContent = Lib5e.has() ? '' : 'Carga tu 5etools en Ajustes';
    }
  }
  function pendingBanner(){
    if (!D.pending.length) return '';
    return '<div class="banner"><p>Te falta' + (D.pending.length > 1 ? 'n ' : ' ') + D.pending.length + ' elecci' + (D.pending.length > 1 ? 'ones' : 'ón') + ' para completar tu personaje.</p><button class="btn main sm" type="button" data-act="levelup" data-step="' + D.pending[0].step + '">Completar</button></div>';
  }
  function mcBanner(){ return D.mcReqs && D.mcReqs.length ? '<div class="banner warn"><p>Multiclase sin el requisito de 13: ' + esc(D.mcReqs.join(' · ')) + '. Si tu DM lo permite, no pasa nada.</p></div>' : ''; }
  function renderPersonaje(C){
    var h = pendingBanner() + mcBanner();
    h += '<div class="abil">' + R.ABS.map(function(k){ return '<div class="ab"><small>' + R.AB[k].toUpperCase() + '</small><div class="medal">' + sgn(D.mod[k]) + '</div><span class="score">' + D.abil[k] + '</span></div>'; }).join('') + '</div>';
    h += '<div class="stats"><div class="stat" title="' + attr(D.acNote) + '"><div class="shield"><svg width="44" height="50" viewBox="0 0 44 50" aria-hidden="true"><path d="M22 2 L41 9 Q41 33 22 48 Q3 33 3 9 Z"/></svg><span>' + D.ac + '</span></div><span class="label">clase de armadura</span></div>'
      + '<div class="stat"><span class="big">' + sgn(D.init) + '</span><span class="label">iniciativa</span></div><div class="stat"><span class="big">' + D.speed + '</span><span class="label">velocidad</span></div></div>';
    h += '<p class="note" style="margin-top:-6px">CA: ' + esc(D.acNote) + '</p>';
    h += '<div class="card"><div class="row" style="margin-bottom:4px"><span class="label"><a class="ref" data-ref="variantrule|Saving Throw|XPHB">tiradas de salvación</a></span>' + (D.aura ? '<span class="muted" style="font-size:13px">incluye Aura ' + sgn(D.aura) + '</span>' : '') + '</div><div class="saves">'
      + ['str','wis','dex','cha','con','int'].map(function(k){ return '<div class="line"><span class="dot' + (D.saves.indexOf(k) >= 0 ? ' on' : '') + '"></span><span>' + R.ABL[k] + '</span><span class="num">' + sgn(D.save[k]) + '</span></div>'; }).join('') + '</div></div>';
    h += '<div class="card"><span class="label">habilidades</span><div class="skl">' + Object.keys(R.SK).sort(function(a, b){ return R.SKES[a].localeCompare(R.SKES[b]); }).map(function(s){
      var cls = D.expert[s] ? 'dot ex' : D.skills[s] ? 'dot on' : 'dot';
      return '<div class="line"><span class="' + cls + '" title="' + (D.expert[s] ? 'Pericia' : D.skills[s] ? 'Competencia (' + attr(D.skills[s]) + ')' : 'Sin competencia') + '"></span><span><a class="ref" data-ref="skill|' + attr(s.replace(/\b\w/g, function(c){ return c.toUpperCase(); })) + '|XPHB">' + R.SKES[s] + '</a> <span class="muted">· ' + R.AB[R.SK[s]] + '</span></span><span class="num">' + sgn(D.skill[s]) + '</span></div>';
    }).join('') + '</div></div>';
    h += '<div class="mini"><div class="stat"><span class="big">' + sgn(D.pb) + '</span><span class="label">competencia</span></div><div class="stat"><span class="big">' + D.passive + '</span><span class="label">perc. pasiva</span></div><div class="stat"><span class="big">' + (SIZE[D.size] || D.size).slice(0, 4) + '.</span><span class="label">tamaño</span></div></div>';
    var prof = [['Armaduras', D.armor.map(function(a){ return {light:'ligeras', medium:'medias', heavy:'pesadas', shield:'escudos'}[a] || a; })], ['Armas', D.weapon.map(function(w){ return {simple:'sencillas', martial:'marciales'}[w] || w; })], ['Herramientas', D.tools], ['Idiomas', D.langs]];
    if (D.darkvision) prof.push(['Sentidos', ['Visión en la oscuridad ' + (D.darkvision / 5 * 1.5) + ' m']]);
    if (D.resist.length) prof.push(['Resistencias', D.resist]);
    h += '<div class="card"><span class="label">competencias y rasgos</span>' + prof.filter(function(p){ return p[1].length; }).map(function(p){ return '<div class="line" style="align-items:flex-start;padding:6px 0"><span class="muted" style="min-width:110px">' + p[0] + '</span><span style="flex:1;text-align:right">' + p[1].map(esc).join(', ') + '</span></div>'; }).join('') + '</div>';
    compBodies = {}; h += compSection(false);
    $('#pPersonaje').innerHTML = h;
  }

  /* ---------- Conjuros ---------- */
  function spellChips(e){
    var d = Render5e.detail('spell', e).meta, get = function(k){ var r = d.filter(function(x){ return x[0] === k; })[0]; return r ? r[1].replace(/<[^>]+>/g, '') : ''; };
    var t = get('Lanzamiento').split(',')[0], rg = get('Alcance'), du = get('Duración');
    return '<span class="chip">' + esc(t) + '</span><span class="chip">' + esc(rg) + '</span>' + (/Concentración/.test(du) ? '<span class="tag conc">C</span>' : '') + (e.meta && e.meta.ritual ? '<span class="tag cls">R</span>' : '');
  }
  function spellCard(e, tag, tagCls){
    return '<div class="card light spell"><div class="row" style="align-items:baseline"><h3>' + spellLink(e) + '</h3><span class="tag ' + (tagCls || 'cls') + '">' + esc(tag) + '</span></div><div class="chips">' + spellChips(e) + '</div></div>';
  }
  function allSpells(){
    var out = [], seen = {};
    function add(e, tag, cls){ var k = e.name + '|' + e.source; if (seen[k]) return; seen[k] = 1; out.push({e:e, tag:tag, cls:cls}); }
    D.extraSpells.forEach(function(x){ add(x.e, x.how === 'siempre preparado' ? 'Siempre · ' + x.from : x.from + ' · ' + x.how, x.how === 'siempre preparado' ? 'oath' : 'cls'); });
    (D.casters || []).forEach(function(K){
      var who = D.multi ? ' · ' + K.name : '';
      K.cantrips.forEach(function(e){ add(e, 'Truco' + who, 'cls'); });
      K.prepared.forEach(function(e){ add(e, (K.full ? 'Lista' : 'Preparado') + who, 'cls'); });
    });
    return out;
  }
  var spQ = '';
  function casterTrios(){
    return (D.casters || []).map(function(K){
      return (D.multi ? '<div class="group-h" style="margin-top:4px">' + esc(K.name) + '</div>' : '') + '<div class="trio"><div><b>' + K.dc + '</b><span>cd salvación</span></div><div><b>' + sgn(K.atk) + '</b><span>ataque</span></div><div><b>' + R.AB[K.ability] + '</b><span>aptitud</span></div></div>';
    }).join('');
  }
  function prepBanners(){
    return (D.casters || []).filter(function(K){ return !K.full && K.nPrepared && K.maxLv && K.prepared.length < K.nPrepared; }).map(function(K){ return '<div class="banner"><p>' + (D.multi ? esc(K.name) + ': p' : 'P') + 'uedes preparar ' + K.nPrepared + ' conjuros y tienes ' + K.prepared.length + '.</p><button class="btn main sm" type="button" data-act="levelup" data-step="' + (K.key ? 'niveles' : 'conjuros') + '">Elegir</button></div>'; }).join('');
  }
  function fullToggle(){
    var C = cur(), on = !!(C && C.house && C.house.allSpells), any = (D.casters || []).some(function(K){ return K.nPrepared && K.maxLv; });
    if (!any) return '';
    return '<label class="toggle fulltog"><input type="checkbox" data-act="fullspells"' + (on ? ' checked' : '') + '> Lista completa de mi clase siempre preparada <small class="muted">(regla de la mesa)</small></label>';
  }
  function renderConjuros(C){
    var r = rt(C), h = '', sp = allSpells();
    if (!D.spellAbility && !sp.length) { $('#pConjuros').innerHTML = '<div class="empty-state"><b>Sin conjuros</b>Tu clase no lanza conjuros. Si una dote o tu especie te da alguno, aparecerá aquí.</div>'; return; }
    h += casterTrios();
    h += slotsCard(r);
    h += fullToggle();
    var total = sp.length;
    h += '<div class="viewseg" role="group" aria-label="Vista de conjuros"><button type="button" data-act="spview" data-v="cards" aria-pressed="' + (S.spView !== 'table') + '">Tarjetas</button><button type="button" data-act="spview" data-v="table" aria-pressed="' + (S.spView === 'table') + '">Tabla</button>'
      + (total > 24 ? '<input class="field spq" id="spQ" type="search" placeholder="Buscar entre ' + total + '" aria-label="Buscar conjuro" autocomplete="off" value="' + attr(spQ) + '">' : '') + '</div>';
    if (total > 24 && spQ.trim()) { var qq = N(spQ.trim()); sp = sp.filter(function(x){ return N(x.e.name).indexOf(qq) >= 0; }); }
    if (S.spView === 'table') { h += spellRowsHtml(sp, {origin:true, act:'spsort', sort:S.spSort || {k:'lv', dir:1}}); h += prepBanners(); $('#pConjuros').innerHTML = h; return; }
    var byLv = {}; sp.forEach(function(x){ (byLv[x.e.level] = byLv[x.e.level] || []).push(x); });
    h += '<div class="spell-grid">' + Object.keys(byLv).sort(function(a, b){ return a - b; }).map(function(lv){
      return '<div class="lvl-sep" style="grid-column:1/-1">— ' + (+lv === 0 ? 'trucos' : 'nivel ' + lv) + ' —</div>' + byLv[lv].sort(function(a, b){ return a.e.name.localeCompare(b.e.name); }).map(function(x){ return spellCard(x.e, x.tag, x.cls); }).join('');
    }).join('') + '</div>';
    if (!sp.length && spQ) h += '<p class="empty-state">Ningún conjuro se llama así.</p>';
    h += prepBanners();
    $('#pConjuros').innerHTML = h;
    var qi = $('#spQ'); if (qi && spFocus) { qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); }
  }
  var spFocus = false;
  document.addEventListener('input', function(ev){ if (ev.target.id === 'spQ') { spQ = ev.target.value; spFocus = true; renderConjuros(cur()); spFocus = false; } });
  function pipsHTML(total, used, key){
    var out = '', avail = total - used;
    for (var i = 0; i < total; i++) { var spent = i >= avail; out += '<button type="button" class="pip" data-act="pip" data-key="' + key + '" data-i="' + i + '" data-max="' + total + '" aria-pressed="' + spent + '" aria-label="' + (spent ? 'Gastado' : 'Disponible') + ' ' + (i + 1) + '"><span></span></button>'; }
    return out;
  }
  function slotsCard(r){
    var rows = '';
    D.slots.forEach(function(n, i){ if (n > 0) rows += '<div class="line"><span class="num">Nivel ' + (i + 1) + '</span><div class="pips">' + pipsHTML(n, Math.min(n, r.slotsUsed[i] || 0), 'slot:' + i) + '</div></div>'; });
    if (D.pact) rows += '<div class="line"><span class="num">Pacto · nivel ' + D.pact.level + '</span><div class="pips">' + pipsHTML(D.pact.count, Math.min(D.pact.count, r.pactUsed || 0), 'pact') + '</div></div>';
    if (!rows) return '';
    return '<div class="card"><span class="label">espacios de conjuro</span>' + rows + '<p class="note" style="margin-top:6px">' + (D.mcCasterLevel ? 'Multiclase: espacios de un lanzador de nivel ' + D.mcCasterLevel + '. Cada clase prepara conjuros solo hasta el nivel que ella sola alcanzaría. ' : '') + 'Toca un rombo para gastarlo o recuperarlo.</p></div>';
  }

  /* ---------- Rasgos ---------- */
  var featCache = [];
  function renderRasgos(C){
    featCache = D.features;
    var groups = [], used = {};
    D.classes.forEach(function(E){ groups.push(['Clase', E.cls.name + (D.multi ? ' ' + E.lv : ''), E.cls.name]); if (E.sub) groups.push(['Subclase', E.sub.name, E.cls.name]); });
    groups.push(['Especie', D.race ? D.race.name : '']); groups.push(['Dote', 'Dotes']);
    var h = pendingBanner() + mcBanner() + '<div class="row"><span class="label">rasgos de ' + esc(C.name || 'tu personaje') + '</span><button class="btn main sm" type="button" data-act="levelup">Subir de nivel o editar</button></div>';
    groups.forEach(function(g){
      var list = D.features.map(function(f, i){ return {f:f, i:i}; }).filter(function(x){ return x.f.from === g[0] && (!g[2] || x.f.cn === g[2]); });
      if (!list.length) return;
      h += '<div class="group-h">' + esc(g[1]) + '</div>' + list.map(function(x){ used[x.i] = 1; return featD(x.f, x.i); }).join('');
    });
    var rest = D.features.map(function(f, i){ return {f:f, i:i}; }).filter(function(x){ return !used[x.i]; });
    if (rest.length) h += '<div class="group-h">Otras opciones</div>' + rest.map(function(x){ return featD(x.f, x.i); }).join('');
    $('#pRasgos').innerHTML = h;
  }
  function featD(f, i){ return '<details class="feat-d" data-feat="' + i + '"><summary><b>' + esc(f.name) + '</b><small>' + (f.level ? 'nivel ' + (D && D.multi && f.clv ? f.clv + ' de ' + f.cn : f.level) + ' · ' : '') + esc(f.e.source || '') + '</small></summary><div class="gtext"></div></details>'; }
  document.addEventListener('toggle', function(ev){
    var d = ev.target; if (!d.matches || !d.open) return;
    var box = d.querySelector('.gtext'); if (!box || box.dataset.done) return;
    function fkey(e){ return 'f|' + (e.className || '') + '|' + (e.subclassShortName || '') + '|' + e.name + '|' + e.source + '|' + (e.level || ''); }
    if (d.dataset.crfeat != null) { var cf = crFeats[+d.dataset.crfeat]; if (cf) { box.innerHTML = trWrap(Render5e.entries(cf.e.entries) || '<p class="note">Sin texto.</p>', fkey(cf.e)); box.dataset.done = 1; trInit(box); } return; }
    if (d.dataset.feat != null) { var f = featCache[+d.dataset.feat]; if (f) { box.innerHTML = trWrap(Render5e.entries(f.e.entries) || '<p class="note">Sin texto.</p>', fkey(f.e)); box.dataset.done = 1; trInit(box); } }
    else if (d.dataset.det) { box.innerHTML = trWrap(detailHtml(JSON.parse(d.dataset.det)), 'd|' + d.dataset.det); box.dataset.done = 1; trInit(box); }
  }, true);

  /* ---------- Monedas ---------- */
  function renderCoins(C){
    var r = rt(C), c = [['cp','pc','#b5703f','#7c4723','#fbf3e2'],['sp','pp','#d4d1c8','#8a867a','#2b1d12'],['ep','pe','#c9c3a0','#8a8460','#2b1d12'],['gp','po','#e0b84a','#9c7a1e','#2b1d12'],['pp','ppt','#e8e6ef','#8f8ca3','#2b1d12']];
    $('#coins').innerHTML = c.map(function(x){ return '<div><div class="coin" style="background:' + x[2] + ';border:2px solid ' + x[3] + ';color:' + x[4] + '">' + x[1] + '</div><input class="field coinin" type="text" inputmode="numeric" data-coin="' + x[0] + '" aria-label="Monedas ' + x[1] + '" value="' + (r.coins[x[0]] || 0) + '"></div>'; }).join('');
  }
  document.addEventListener('change', function(ev){
    var t = ev.target;
    if (t.dataset && t.dataset.coin) { var C = cur(); if (!C) return; var v = parseInt(String(t.value).replace(/\D/g, ''), 10) || 0; rt(C).coins[t.dataset.coin] = v; t.value = v; save(); }
  });

  /* ==================== CHISPAS ==================== */
  var fxLayer = $('#fx');
  function sparkBurst(x, y, n, opt){
    if (reduce || !fxLayer || !fxLayer.animate) return;
    opt = opt || {};
    var spread = opt.spread || 70;
    for (var i = 0; i < n; i++) {
      var sp = document.createElement('span'); sp.className = 'spark' + (Math.random() < .5 ? ' s' : '');
      sp.style.left = x + 'px'; sp.style.top = y + 'px'; fxLayer.appendChild(sp);
      var ang = (opt.up ? -Math.PI / 2 : 0) + (Math.random() - .5) * (opt.up ? 2.2 : Math.PI * 2), dist = spread * (.35 + Math.random() * .75);
      var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist + (opt.up ? 0 : 10);
      var a = sp.animate([{transform:'translate(0,0) scale(1)', opacity:1}, {transform:'translate(' + dx + 'px,' + dy + 'px) scale(.2)', opacity:0}], {duration:550 + Math.random() * 650, easing:'cubic-bezier(.2,.7,.3,1)', delay:Math.random() * 120});
      a.onfinish = (function(el){ return function(){ el.remove(); }; })(sp);
    }
  }
  function fxAt(id, n, el){
    if (reduce) return;
    requestAnimationFrame(function(){
      var t = el || (id && (grid.querySelector('[data-id="' + id + '"]') || $('#bodySlots [data-id="' + id + '"]'))); if (!t || !fxLayer) return;
      var r = t.getBoundingClientRect(), f = fxLayer.getBoundingClientRect();
      sparkBurst(r.left - f.left + r.width / 2, r.top - f.top + r.height / 2, n || 10, {spread:40});
    });
  }

  /* ==================== MOCHILA Y CONTENEDORES ==================== */
  var grid = $('#grid'), ghost = $('#ghost'), sel = null, pendingDrop = null, invMsg = '', moveMenu = false;
  var BODY_BOX = {id:'body', n:'Encima', w:6, h:4, ic:'i-bag'};
  var CONT = [[/\bbag of holding\b/, 10, 12], [/\bportable hole\b/, 12, 12], [/\bhandy haversack\b/, 9, 9, true], [/\befficient quiver\b/, 4, 8], [/\bbackpack\b/, 8, 10, true], [/\bcomponent pouch\b/, 3, 2], [/\bquiver\b/, 2, 6], [/\bpouch\b/, 3, 3], [/\bsack\b/, 6, 6], [/\bchest\b/, 10, 8], [/\bbasket\b/, 5, 5], [/\b(map|scroll) case\b|\bcase, (map|scroll)/, 2, 4], [/\bbarrel\b/, 8, 8]];
  var EXTRADIM = /\b(bag of holding|portable hole|handy haversack)\b/;
  function boxFor(e){ var n = N(e.name); for (var i = 0; i < CONT.length; i++) if (CONT[i][0].test(n)) return {w:CONT[i][1], h:CONT[i][2], back:!!CONT[i][3]}; if (e.containerCapacity) return {w:5, h:5}; return null; }
  function items(){ var C = cur(); return C ? rt(C).items : []; }
  function setItems(list){ var C = cur(); if (C) rt(C).items = list; }
  function itemById(id){ return items().filter(function(i){ return i.id === id; })[0]; }
  function boxes(){ var out = [BODY_BOX]; items().forEach(function(i){ if (i.box) out.push({id:i.id, n:i.n, w:i.box.w, h:i.box.h, ic:i.ic, it:i}); }); return out; }
  function boxById(id){ return boxes().filter(function(b){ return b.id === id; })[0] || BODY_BOX; }
  function openBoxId(){
    var C = cur(); if (!C) return 'body'; var r = rt(C);
    if (!boxes().some(function(b){ return b.id === r.openBox; })) { var back = items().filter(function(i){ return i.box && i.eq === 'back'; })[0]; r.openBox = back ? back.id : 'body'; }
    return r.openBox;
  }
  function inBox(id){ return items().filter(function(i){ return !i.eq && (i.in || 'body') === id; }); }
  function fits(it, x, y, w, h, boxId){
    boxId = boxId || it.in || 'body'; var b = boxById(boxId);
    if (x < 0 || y < 0 || x + w > b.w || y + h > b.h) return false;
    return inBox(boxId).every(function(o){ if (o.id === it.id) return true; return x + w <= o.x || o.x + o.w <= x || y + h <= o.y || o.y + o.h <= y; });
  }
  function freeSpot(it, boxId){
    var b = boxById(boxId || 'body'), tries = [[it.w, it.h], [it.h, it.w]];
    for (var t = 0; t < tries.length; t++) for (var y = 0; y <= b.h - tries[t][1]; y++) for (var x = 0; x <= b.w - tries[t][0]; x++) if (fits(it, x, y, tries[t][0], tries[t][1], b.id)) return {x:x, y:y, w:tries[t][0], h:tries[t][1], box:b.id};
    return null;
  }
  function descendants(id){ var out = []; items().forEach(function(i){ if (i.in === id && !i.eq) { out.push(i); out = out.concat(descendants(i.id)); } }); return out; }
  function canGoInto(it, boxId){
    if (it.id === boxId) return false;
    if (descendants(it.id).some(function(d){ return d.id === boxId; })) return false;
    var tb = boxById(boxId).it;
    if (it.box && tb && EXTRADIM.test(N(it.n + ' ' + (it.ref || ''))) && EXTRADIM.test(N(tb.n + ' ' + (tb.ref || '')))) return 'portal';
    return true;
  }
  function putAt(it, sp){ it.in = sp.box; it.x = sp.x; it.y = sp.y; it.w = sp.w; it.h = sp.h; }
  function stash(it, prefer){
    var order = [prefer || openBoxId()].concat(boxes().map(function(b){ return b.id; })), seen = {};
    for (var i = 0; i < order.length; i++) {
      var id = order[i]; if (seen[id]) continue; seen[id] = 1;
      if (canGoInto(it, id) !== true) continue;
      var sp = freeSpot(it, id); if (sp) { putAt(it, sp); return true; }
    }
    return false;
  }
  function ensureInventory(C){
    var r = rt(C); if (r.inv2) return; r.inv2 = true;
    var back = r.items.filter(function(i){ return i.box && i.eq === 'back'; })[0];
    if (!back) { back = {id:'mochila', n:'Mochila', ref:'item|Backpack|XPHB', k:'box', ic:'i-bag', w:2, h:2, box:{w:8, h:10}, slot:'back', eq:'back', d:'Contenedor de 8 × 10 casillas'}; r.items.push(back); }
    r.items.forEach(function(i){ if (!i.eq && !i.in && i !== back) i.in = back.id; });
    r.openBox = back.id;
  }
  function place(el, x, y, w, h, b){ b = b || boxById(openBoxId()); el.style.left = (x / b.w * 100) + '%'; el.style.top = (y / b.h * 100) + '%'; el.style.width = (w / b.w * 100) + '%'; el.style.height = (h / b.h * 100) + '%'; }
  function attuned(){ return items().filter(function(i){ return i.eq && i.att; }).length; }
  function renderEquip(){
    var C = cur(); if (!C) return; ensureInventory(C);
    $('#bodySlots').innerHTML = SLOTS.map(function(s){
      var its = items().filter(function(i){ return i.eq === s[0]; });
      if (!its.length) return '<div class="slot empty"><span class="ico"><svg class="ic"><use href="#'+s[2]+'"/></svg></span><div><small>'+s[1]+'</small><span class="v">Vacío</span></div></div>';
      return its.map(function(it){ return '<button type="button" class="slot" data-act="selslot" data-id="'+it.id+'" aria-pressed="'+(sel===it.id)+'"><span class="ico"><svg class="ic"><use href="#'+it.ic+'"/></svg></span><div><small>'+s[1]+'</small><span class="v">'+esc(it.n)+(it.q > 1 ? ' ×' + it.q : '')+'</span></div></button>'; }).join('');
    }).join('');
    $('#attuneCount').textContent = 'Sintonización ' + attuned() + ' / 3';
    renderGrid();
  }
  function boxUsed(id){ return inBox(id).reduce(function(t, i){ return t + i.w * i.h; }, 0); }
  function renderGrid(){
    var ob = openBoxId(), b = boxById(ob);
    $('#boxTabs').innerHTML = boxes().filter(function(x){ return x.id === 'body' || (x.it && (x.it.eq || x.it.in)); }).map(function(x){
      return '<button type="button" role="tab" data-act="openbox" data-id="' + x.id + '" aria-selected="' + (x.id === ob) + '"><svg class="ic"><use href="#' + (x.ic || 'i-bag') + '"/></svg>' + esc(x.n) + ' <small>' + boxUsed(x.id) + '/' + (x.w * x.h) + '</small></button>';
    }).join('');
    $('#caseName').textContent = b.n;
    grid.style.aspectRatio = b.w + ' / ' + b.h;
    grid.style.backgroundSize = (100 / b.w) + '% ' + (100 / b.h) + '%';
    grid.style.maxWidth = b.w <= 4 ? '220px' : b.w <= 6 ? '320px' : '';
    grid.style.margin = '0 auto';
    $$('.it', grid).forEach(function(e){ e.remove(); });
    inBox(ob).forEach(function(it){
      var bt = document.createElement('button');
      bt.type = 'button'; bt.className = 'it' + (it.box ? ' k-box' : it.k ? ' k-' + it.k : ''); bt.dataset.id = it.id;
      bt.setAttribute('aria-pressed', String(sel === it.id));
      bt.setAttribute('aria-label', it.n + (it.q ? ', ' + it.q : '') + ', ' + it.w + ' por ' + it.h + ' casillas' + (it.box ? ', contenedor' : ''));
      bt.innerHTML = '<span><svg class="ic"><use href="#'+it.ic+'"/></svg>' + (it.w * it.h >= 2 ? '<em>'+esc(it.n)+'</em>' : '') + (it.q ? '<i>'+it.q+'</i>' : '') + '</span>';
      place(bt, it.x, it.y, it.w, it.h, b); grid.appendChild(bt);
    });
    $('#caseCount').textContent = boxUsed(ob) + ' / ' + (b.w * b.h) + ' casillas';
    renderInfo();
  }
  function renderInfo(){
    var it = sel && itemById(sel), acts = [];
    if (!it) { $('#caseText').innerHTML = invMsg || 'Toca un objeto para verlo. Arrástralo para acomodarlo.'; $('#caseActions').innerHTML = ''; invMsg = ''; return; }
    var where = it.eq ? 'equipado' : 'en ' + boxById(it.in || 'body').n;
    $('#caseText').innerHTML = '<b>'+esc(it.n)+'</b>'+(it.q ? ' ×'+it.q : '')+' · '+esc(where)+'<small>'+esc(it.d || '')+(it.eq ? '' : ' · '+it.w+'×'+it.h+' casillas')+(it.box ? ' · guarda ' + it.box.w + '×' + it.box.h : '')+'</small>' + (invMsg ? '<small style="color:#f2b8bb">'+invMsg+'</small>' : '');
    invMsg = '';
    if (pendingDrop === it.id) { var nIn = descendants(it.id).length; $('#caseActions').innerHTML = '<span style="align-self:center">¿Tirar '+esc(it.n)+(nIn ? ' y lo que contiene (' + nIn + ')' : '')+'?</span><button class="btn main" type="button" data-act="dropyes">Sí, tirar</button><button class="btn" type="button" data-act="dropno">No</button>'; return; }
    if (moveMenu) {
      var opts = boxes().filter(function(x){ return x.id !== (it.in || 'body') && (x.id === 'body' || x.it.eq || x.it.in); }).map(function(x){
        var ok = canGoInto(it, x.id), room = ok === true && freeSpot(it, x.id);
        return '<button class="btn" type="button" data-act="moveto" data-id="' + x.id + '"' + (ok === true && room ? '' : ' disabled') + '>' + esc(x.n) + (ok === 'portal' ? ' (portal)' : ok !== true ? '' : room ? '' : ' (lleno)') + '</button>';
      }).join('');
      $('#caseActions').innerHTML = '<div class="moveto"><span>Mover a:</span>' + (opts || '<span>No hay otros contenedores.</span>') + '<button class="btn" type="button" data-act="movecancel">Cancelar</button></div>'; return;
    }
    if (it.box) acts.push('<button class="btn main" type="button" data-act="openbox" data-id="' + it.id + '">Abrir</button>');
    if (it.eq) acts.push('<button class="btn main" type="button" data-act="unequip">Quitar</button>');
    else if (it.slot) acts.push('<button class="btn main" type="button" data-act="equip">' + (it.slot === 'back' ? 'Llevar a la espalda' : 'Equipar') + '</button>');
    if (it.hb) acts.push('<button class="btn" type="button" data-act="hbedit">Editar</button>');
    if (!it.eq && (it.k === 'con' || it.use)) acts.push('<button class="btn main" type="button" data-act="use">Usar</button>');
    if (!it.eq) acts.push('<button class="btn" type="button" data-act="movemenu">Mover a…</button>');
    if (!it.eq) acts.push('<button class="btn" type="button" data-act="rotate">Girar</button>');
    if (it.ref && Lib5e.has()) acts.push('<button class="btn" type="button" data-act="itemrule">Ver regla</button>');
    if (!it.eq) acts.push('<button class="btn" type="button" data-act="drop">Tirar</button>');
    $('#caseActions').innerHTML = acts.join('');
  }
  function select(id){ sel = id; pendingDrop = null; moveMenu = false; renderEquip(); var e = grid.querySelector('[data-id="'+id+'"]'); if (e) e.focus({preventScroll:true}); }
  function invChanged(){ save(); render(false); }
  function rotate(){
    var it = sel && itemById(sel); if (!it || it.eq) return;
    if (fits(it, it.x, it.y, it.h, it.w)) { var t = it.w; it.w = it.h; it.h = t; save(); }
    else invMsg = 'No cabe girado aquí. Muévelo a un hueco más grande.';
    renderGrid();
  }
  function equip(){
    var it = sel && itemById(sel); if (!it || !it.slot) return;
    var target = it.slot;
    if (target === 'main' && items().some(function(o){ return o.eq === 'main'; }) && !items().some(function(o){ return o.eq === 'off'; }) && it.k === 'wpn') target = 'off';
    var from = {in:it.in, x:it.x, y:it.y};
    it.eq = target; it.in = null;
    if (target !== 'acc') {
      var curIt = items().filter(function(o){ return o.eq === target && o !== it; })[0];
      if (curIt) { curIt.eq = null; if (!stash(curIt, from.in)) { curIt.eq = target; it.eq = null; it.in = from.in; invMsg = 'No hay espacio para guardar ' + esc(curIt.n) + '.'; renderEquip(); return; } }
    }
    if (it.att && attuned() > 3) invMsg = 'Ya tienes más de 3 objetos sintonizados.';
    fxAt(sel); invChanged();
  }
  function unequip(){
    var it = sel && itemById(sel); if (!it || !it.eq) return;
    var prev = it.eq; it.eq = null;
    var pref = openBoxId() === it.id ? 'body' : openBoxId();
    if (!stash(it, pref)) { it.eq = prev; invMsg = 'No hay espacio en tus contenedores. Haz lugar primero.'; renderEquip(); return; }
    if (rt(cur()).openBox === it.id && !it.in) rt(cur()).openBox = 'body';
    invChanged();
  }
  function useItem(){
    var it = sel && itemById(sel); if (!it) return;
    var msg = it.use || ('Usaste ' + it.n + '.');
    if (it.q > 1) it.q -= 1; else { setItems(items().filter(function(o){ return o.id !== it.id; })); sel = null; }
    invMsg = esc(msg); invChanged();
  }
  function moveTo(boxId){
    var it = sel && itemById(sel); if (!it) return;
    var ok = canGoInto(it, boxId);
    if (ok === 'portal') { invMsg = 'Meter un espacio extradimensional dentro de otro abre un portal al Plano Astral y destruye ambos. Mejor no.'; moveMenu = false; renderInfo(); return; }
    var sp = ok === true && freeSpot(it, boxId);
    if (!sp) { invMsg = 'No cabe ahí.'; renderInfo(); return; }
    putAt(it, sp); moveMenu = false; rt(cur()).openBox = boxId; sel = it.id; fxAt(it.id); invChanged();
  }
  var drag = null;
  grid.addEventListener('pointerdown', function(ev){
    var bt = ev.target.closest('.it'); if (!bt) return;
    var it = itemById(bt.dataset.id), b = boxById(openBoxId()), r = grid.getBoundingClientRect(), cw = r.width / b.w, chh = r.height / b.h;
    drag = {it:it, el:bt, b:b, sx:ev.clientX, sy:ev.clientY, ox:ev.clientX - r.left - it.x * cw, oy:ev.clientY - r.top - it.y * chh, moved:false, tx:it.x, ty:it.y, ok:true};
    bt.setPointerCapture(ev.pointerId);
  });
  grid.addEventListener('pointermove', function(ev){
    if (!drag) return;
    if (!drag.moved && Math.abs(ev.clientX - drag.sx) + Math.abs(ev.clientY - drag.sy) < 6) return;
    if (!drag.moved) { drag.moved = true; sel = drag.it.id; drag.el.classList.add('dragging'); drag.el.setAttribute('aria-pressed','true'); }
    var b = drag.b, r = grid.getBoundingClientRect(), cw = r.width / b.w, chh = r.height / b.h, it = drag.it;
    drag.el.style.left = (ev.clientX - r.left - drag.ox) + 'px'; drag.el.style.top = (ev.clientY - r.top - drag.oy) + 'px';
    drag.tx = Math.round((ev.clientX - r.left - drag.ox) / cw); drag.ty = Math.round((ev.clientY - r.top - drag.oy) / chh);
    drag.ok = fits(it, drag.tx, drag.ty, it.w, it.h, b.id);
    ghost.hidden = false; ghost.classList.toggle('bad', !drag.ok);
    place(ghost, Math.max(0, Math.min(b.w - it.w, drag.tx)), Math.max(0, Math.min(b.h - it.h, drag.ty)), it.w, it.h, b);
  });
  function endDrag(){ if (!drag) return; var d = drag; drag = null; ghost.hidden = true; if (d.moved && d.ok) { d.it.x = d.tx; d.it.y = d.ty; save(); } sel = d.it.id; renderEquip(); if (d.moved && d.ok) fxAt(d.it.id, 6); }
  grid.addEventListener('pointerup', endDrag);
  grid.addEventListener('pointercancel', endDrag);
  grid.addEventListener('keydown', function(ev){
    var it = sel && itemById(sel); if (!it || it.eq) return;
    var mv = {ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1]}[ev.key];
    if (mv) { ev.preventDefault(); if (fits(it, it.x + mv[0], it.y + mv[1], it.w, it.h)) { it.x += mv[0]; it.y += mv[1]; save(); } select(it.id); }
    else if (ev.key === 'r' || ev.key === 'R') { ev.preventDefault(); rotate(); }
  });
  function itemShape(e){
    var t = (e.type || '').split('|')[0], props = (e.property || []).map(function(p){ return (typeof p === 'string' ? p : p.uid || '').split('|')[0]; });
    var n = N(e.name), slot = null, ic = 'i-bag', w = 1, h = 1, k = '';
    if (t === 'M' || t === 'R') { k = 'wpn'; ic = t === 'R' ? 'i-bow' : 'i-sword'; slot = 'main'; h = props.indexOf('2H') >= 0 || props.indexOf('H') >= 0 ? 4 : props.indexOf('V') >= 0 ? 3 : 2; }
    else if (t === 'LA') { k = 'wpn'; ic = 'i-armor'; slot = 'armor'; w = 2; h = 2; }
    else if (t === 'MA') { k = 'wpn'; ic = 'i-armor'; slot = 'armor'; w = 2; h = 3; }
    else if (t === 'HA') { k = 'wpn'; ic = 'i-armor'; slot = 'armor'; w = 3; h = 3; }
    else if (t === 'S') { k = 'wpn'; ic = 'i-shield'; slot = 'off'; w = 2; h = 2; }
    else if (t === 'P') { k = 'mag'; ic = 'i-flask'; h = 2; }
    else if (t === 'SC') { k = 'mag'; ic = 'i-scroll'; }
    else if (t === 'RG') { k = 'mag'; ic = 'i-ring'; slot = 'acc'; }
    else if (t === 'WD') { k = 'mag'; ic = 'i-wand'; h = 2; }
    else if (t === 'RD') { k = 'mag'; ic = 'i-wand'; h = 3; }
    else if (t === 'ST') { ic = 'i-wand'; h = 4; }
    else if (t === 'A' || t === 'AF') { k = 'con'; ic = 'i-bow'; }
    else if (t === 'FD') { k = 'con'; ic = 'i-food'; w = 2; }
    else if (t === 'INS' || t === 'AT' || t === 'T' || t === 'GS') { ic = 'i-tool'; w = 2; h = 2; }
    else if (/^\$/.test(t)) { ic = 'i-gem'; }
    else if (t === 'SCF') { ic = 'i-holy'; }
    else if (e.weight >= 10) { w = 2; h = 2; } else if (e.weight >= 3) { h = 2; }
    if (e.wondrous || !slot) {
      if (/\b(boots|slippers)\b/.test(n)) { slot = 'boots'; ic = 'i-boot'; w = 2; h = 2; }
      else if (/\b(gloves|gauntlets)\b/.test(n)) { slot = 'gloves'; ic = 'i-glove'; w = 2; h = 1; }
      else if (/\bbracers\b/.test(n)) { slot = 'bracers'; ic = 'i-bracer'; w = 2; h = 1; }
      else if (/\b(cloak|cape|mantle|robe)\b/.test(n)) { slot = 'cloak'; ic = 'i-cloak'; w = 2; h = 2; }
      else if (/\b(helm|hat|circlet|headband|crown|cap|diadem|goggles|eyes)\b/.test(n)) { slot = 'head'; ic = 'i-helm'; w = 2; h = 1; }
      else if (/\b(amulet|necklace|periapt|medallion|scarab|brooch|pendant|talisman)\b/.test(n)) { slot = 'acc'; ic = 'i-gem'; }
    }
    var bx = boxFor(e);
    if (bx) { k = 'box'; ic = 'i-bag'; w = Math.max(w, bx.w >= 8 ? 2 : 1); h = Math.max(h, bx.h >= 8 ? 2 : 1); if (bx.back) slot = 'back'; }
    if (e.rarity && e.rarity !== 'none' && !k) k = 'mag';
    return {w:w, h:h, ic:ic, slot:slot, k:k, box:bx ? {w:bx.w, h:bx.h} : null};
  }
  function newItem(type, e, q){
    var sh = itemShape(e);
    var it = {id:'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), n:e.name, ref:type + '|' + e.name + '|' + e.source, k:sh.k, ic:sh.ic, w:sh.w, h:sh.h, slot:sh.slot, att:!!e.reqAttune, d:Render5e.itemType(e)};
    if (sh.box) { it.box = sh.box; it.d = 'Contenedor de ' + sh.box.w + ' × ' + sh.box.h + ' casillas'; }
    if (q > 1 || /^P$|^FD$/.test((e.type || '').split('|')[0])) it.q = q || 1;
    return it;
  }
  function addItemFromLib(type, e){
    var it = newItem(type, e);
    if (!stash(it)) return false;
    items().push(it); sel = it.id; invChanged(); return true;
  }

  /* ==================== ARMAS HOMEBREW ==================== */
  var HB_PROPS = [['L','Ligera'],['F','Sutileza'],['H','Pesada'],['2H','A dos manos'],['V','Versátil'],['R','Alcance extra (reach)'],['T','Arrojadiza'],['A','Munición'],['LD','Carga']];
  var HB_MAST = [['','Ninguna'],['Cleave','Cleave (hender)'],['Graze','Graze (rozar)'],['Nick','Nick (mellar)'],['Push','Push (empujar)'],['Sap','Sap (debilitar)'],['Slow','Slow (ralentizar)'],['Topple','Topple (derribar)'],['Vex','Vex (fastidiar)']];
  var DICE_RE = /^\s*\d+\s*d\s*\d+\s*$/i, hbEdit = null;
  S.homebrew = S.homebrew || [];
  function hbSummary(h){ return h.dice + ' ' + (R.DT[h.dtype] || h.dtype) + ' · ' + (h.cat === 'martial' ? 'marcial' : 'sencilla') + (h.props.length ? ' · ' + h.props.map(function(p){ return HB_PROPS.filter(function(x){ return x[0] === p; })[0][1]; }).join(', ') : '') + (h.magic ? ' · +' + h.magic : '') + (h.xdice ? ' · +' + h.xdice + ' ' + (R.DT[h.xtype] || h.xtype) : ''); }
  function hbShape(h){
    if (h.size && h.size !== 'auto') { var p = h.size.split('x'); return {w:+p[0], h:+p[1], ic: h.ranged ? 'i-bow' : 'i-sword'}; }
    var props = h.props; return {w:1, h: props.indexOf('2H') >= 0 || props.indexOf('H') >= 0 ? 4 : props.indexOf('V') >= 0 ? 3 : 2, ic: h.ranged ? 'i-bow' : 'i-sword'};
  }
  function hbOpts(sel, list, val){ sel.innerHTML = list.map(function(x){ return '<option value="' + attr(x[0]) + '"' + (x[0] === val ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join(''); }
  function hbToggleRows(){
    var on = function(p){ var el = $('#hbProps input[value="' + p + '"]'); return el && el.checked; };
    $('#hbVRow').hidden = !on('V'); $('#hbRangeRow').hidden = !(on('T') || on('A') || $('#hbRanged').value === '1');
  }
  function openHb(item){
    hbEdit = item || null;
    var h = item && item.hb || {name:'', dice:'', dtype:'S', cat:'martial', ranged:false, props:[], vdice:'', range:'', mastery:'', magic:0, xdice:'', xtype:'N', size:'auto', weight:'', notes:''};
    var types = Object.keys(R.DT).map(function(k){ return [k, R.DT[k].charAt(0).toUpperCase() + R.DT[k].slice(1)]; });
    $('#hbName').value = h.name; $('#hbDice').value = h.dice; hbOpts($('#hbType'), types, h.dtype); $('#hbCat').value = h.cat; $('#hbRanged').value = h.ranged ? '1' : '0';
    $('#hbProps').innerHTML = HB_PROPS.map(function(p){ return '<label><input type="checkbox" value="' + p[0] + '"' + (h.props.indexOf(p[0]) >= 0 ? ' checked' : '') + '> ' + p[1] + '</label>'; }).join('');
    $('#hbVDice').value = h.vdice || ''; $('#hbRange').value = h.range || ''; hbOpts($('#hbMastery'), HB_MAST, h.mastery || ''); $('#hbMagic').value = String(h.magic || 0);
    $('#hbXDice').value = h.xdice || ''; hbOpts($('#hbXType'), types, h.xtype || 'N'); $('#hbSize').value = h.size || 'auto'; $('#hbWeight').value = h.weight || ''; $('#hbNotes').value = h.notes || '';
    $('#hbEquip').checked = !item; $('#hbEquip').closest('label').hidden = !!item; $('#hbKeep').checked = !item || S.homebrew.some(function(x){ return x.name === h.name; });
    $('#hbTitle').textContent = item ? 'Editar ' + h.name : 'Arma homebrew'; $('#hbSubmit').textContent = item ? 'Guardar cambios' : 'Crear arma'; $('#hbErr').hidden = true;
    $('#hbSaved').innerHTML = !item && S.homebrew.length ? '<div class="card" style="margin-bottom:14px"><span class="label">tus armas homebrew</span>' + S.homebrew.map(function(x, i){ return '<div class="line"><span style="flex:1"><b>' + esc(x.name) + '</b><br><small class="muted">' + esc(hbSummary(x)) + '</small></span><button class="btn sm" type="button" data-act="hbadd" data-i="' + i + '">Añadir</button><button class="icon-btn" type="button" data-act="hbdel" data-i="' + i + '" aria-label="Borrar ' + attr(x.name) + ' de la lista"><svg class="ic"><use href="#i-x"/></svg></button></div>'; }).join('') + '<p class="note" style="margin-top:6px">O crea una nueva abajo.</p></div>' : '';
    hbToggleRows(); openSheet('hbSheet'); $('#hbName').focus({preventScroll:true});
  }
  function hbPlace(h, equipNow){
    var sh = hbShape(h), it = {id:'h' + Date.now().toString(36), n:h.name, hb:h, k:'wpn', ic:sh.ic, w:sh.w, h:sh.h, slot:'main', d:hbSummary(h)};
    if (equipNow) {
      var curMain = items().filter(function(o){ return o.eq === 'main'; })[0];
      if (curMain) { curMain.eq = null; if (!stash(curMain)) { curMain.eq = 'main'; return 'No hay espacio para guardar ' + curMain.n + '. Desmárcalo de equipar o haz espacio.'; } }
      it.eq = 'main';
    } else if (!stash(it)) return 'No cabe en tus contenedores. Haz espacio o elige un tamaño menor.';
    items().push(it); sel = it.id; return null;
  }
  $('#hbProps').addEventListener('change', hbToggleRows);
  $('#hbRanged').addEventListener('change', hbToggleRows);
  $('#hbForm').addEventListener('submit', function(ev){
    ev.preventDefault();
    var err = function(m, el){ var e = $('#hbErr'); e.textContent = m; e.hidden = false; if (el) el.focus(); };
    var props = $$('#hbProps input:checked').map(function(i){ return i.value; });
    var h = {name:$('#hbName').value.trim(), dice:$('#hbDice').value.replace(/\s+/g, '').toLowerCase(), dtype:$('#hbType').value, cat:$('#hbCat').value, ranged:$('#hbRanged').value === '1', props:props,
      vdice:$('#hbVDice').value.replace(/\s+/g, '').toLowerCase(), range:$('#hbRange').value.trim(), mastery:$('#hbMastery').value, magic:+$('#hbMagic').value,
      xdice:$('#hbXDice').value.replace(/\s+/g, '').toLowerCase(), xtype:$('#hbXType').value, size:$('#hbSize').value, weight:parseFloat($('#hbWeight').value) || '', notes:$('#hbNotes').value.trim()};
    if (!h.name) return err('Ponle nombre al arma.', $('#hbName'));
    if (!DICE_RE.test(h.dice)) return err('Escribe el daño como dados, por ejemplo 2d6.', $('#hbDice'));
    if (props.indexOf('V') >= 0 && !DICE_RE.test(h.vdice)) return err('Escribe el daño a dos manos, por ejemplo 1d10.', $('#hbVDice'));
    if (h.xdice && !DICE_RE.test(h.xdice)) return err('El daño extra debe ser dados, por ejemplo 1d6, o déjalo vacío.', $('#hbXDice'));
    if (!cur()) return err('Primero crea o elige un personaje.');
    if (hbEdit) {
      var it = itemById(hbEdit.id); if (!it) return err('No encontré el arma en la mochila.');
      var sh = hbShape(h);
      if (!it.eq && (sh.w !== it.w || sh.h !== it.h)) { if (fits(it, it.x, it.y, sh.w, sh.h)) { it.w = sh.w; it.h = sh.h; } else { var ow = it.w, oh = it.h; it.w = sh.w; it.h = sh.h; if (!stash(it, it.in)) { it.w = ow; it.h = oh; return err('Con ese tamaño ya no cabe en tus contenedores.'); } } }
      it.n = h.name; it.hb = h; it.ic = sh.ic; it.d = hbSummary(h);
    } else { var e2 = hbPlace(h, $('#hbEquip').checked); if (e2) return err(e2); }
    if ($('#hbKeep').checked) { S.homebrew = S.homebrew.filter(function(x){ return x.name !== h.name; }); S.homebrew.push(JSON.parse(JSON.stringify(h))); }
    closeSheets(); invChanged();
  });

  /* ==================== COMPAÑEROS (homúnculo, defensor, familiares…) ==================== */
  /* Fichas integradas por si la biblioteca no trae el bestiario: solo números y un resumen propio en español. */
  var COMP_BUILTIN = [
    {name:'Homunculus Servant', source:'TCE', _builtin:1, summonedByClass:'Artificer|TCE', size:['T'], type:'construct', ac:[{ac:13, from:['armadura natural']}],
      hp:{special:'1 + your Intelligence modifier + your artificer level'}, hd:4, speed:{walk:20, fly:30}, str:4, dex:15, con:12, int:10, wis:10, cha:7,
      save:{dex:'+2 plus PB'}, skill:{perception:'+0 plus PB × 2', stealth:'+2 plus PB'}, senses:['visión en la oscuridad 18 m'], passive:'10 + (PB × 2)',
      immune:['veneno'], conditionImmune:['agotamiento','envenenado'], languages:['entiende los idiomas que tú hablas'],
      trait:[{name:'Evasión', entries:['Si una tirada de salvación de Destreza le permite recibir la mitad del daño, no recibe daño si la supera y solo la mitad si la falla. No funciona si está incapacitado.']}],
      actionNote:'Solo actúa si gastas tu acción adicional para ordenárselo; si no, esquiva.',
      action:[{name:'Golpe de fuerza', entries:['{@atk rs} {@hitYourSpellAttack} al golpe, alcance 9 m, un objetivo que pueda ver. {@h}{@damage 1d4 + PB} de daño de fuerza.']}],
      reaction:[{name:'Canalizar magia', entries:['Entrega un conjuro tuyo de alcance toque, siempre que esté a 36 m o menos de ti.']}]},
    {name:'Homunculus Servant', source:'EFA', _builtin:1, summonedBySpell:'Homunculus Servant|EFA', summonedBySpellLevel:2, size:['T'], type:'construct', ac:[13],
      hp:{special:'5 + 5 per spell level'}, hd:4, speed:{walk:20, fly:30}, str:4, dex:15, con:12, int:10, wis:10, cha:7,
      senses:['visión en la oscuridad 18 m'], passive:10, immune:['veneno'], conditionImmune:['agotamiento','envenenado'], languages:['telepatía a 1,6 km (solo contigo)'],
      trait:[{name:'Evasión', entries:['Si una tirada de salvación de Destreza le permite recibir la mitad del daño, no recibe daño si la supera y solo la mitad si la falla. No funciona si está incapacitado.']},
        {name:'Vínculo mágico', entries:['Suma el nivel del conjuro a todas sus pruebas de característica y tiradas de salvación.']}],
      action:[{name:'Golpe de fuerza', entries:['{@atkr m,r} {@hitYourSpellAttack} al golpe, alcance 1,5 m o 9 m a distancia. {@h}{@dice 1d6 + summonSpellLevel} de daño de fuerza.']}],
      reaction:[{name:'Canalizar magia', entries:['{@actTrigger} Lanzas un conjuro de alcance toque y el homúnculo está a 36 m o menos de ti. {@actResponse} El homúnculo entrega el conjuro con su toque.']}]}
  ];
  var NUMW = {one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10};
  var ABW = {strength:'str', dexterity:'dex', constitution:'con', intelligence:'int', wisdom:'wis', charisma:'cha'};
  var DMGW = {force:'fuerza', fire:'fuego', cold:'frío', lightning:'relámpago', thunder:'trueno', acid:'ácido', poison:'veneno', necrotic:'necrótico', radiant:'radiante', psychic:'psíquico', slashing:'cortante', piercing:'perforante', bludgeoning:'contundente'};
  var CSKILL = {perception:'Percepción', stealth:'Sigilo', athletics:'Atletismo', acrobatics:'Acrobacias', insight:'Perspicacia', survival:'Supervivencia', investigation:'Investigación', arcana:'Arcanos', history:'Historia', deception:'Engaño', intimidation:'Intimidación', persuasion:'Persuasión', performance:'Interpretación'};
  var SENSEW = {darkvision:'visión en la oscuridad', blindsight:'vista ciega', truesight:'visión verdadera', tremorsense:'sentido sísmico'};
  var CONDW = {exhaustion:'agotamiento', poisoned:'envenenado', charmed:'hechizado', frightened:'asustado', paralyzed:'paralizado', petrified:'petrificado', prone:'derribado', unconscious:'inconsciente', blinded:'cegado', deafened:'ensordecido', grappled:'agarrado', restrained:'apresado', stunned:'aturdido', incapacitated:'incapacitado'};
  var CTYPE = {construct:'constructo', beast:'bestia', fey:'feérico', fiend:'infernal', celestial:'celestial', elemental:'elemental', undead:'muerto viviente', dragon:'dragón', aberration:'aberración', monstrosity:'monstruosidad', plant:'planta', ooze:'cieno', humanoid:'humanoide', giant:'gigante'};

  function compAll(){
    var lib = (Lib5e.get() && Lib5e.get().monster) || [], out = lib.slice(), have = {};
    lib.forEach(function(m){ have[N(m.name) + '|' + N(m.source)] = 1; });
    COMP_BUILTIN.forEach(function(m){ if (!have[N(m.name) + '|' + N(m.source)]) out.push(m); });
    return out.filter(function(m){ return !m._copy; });
  }
  function compMon(ref){ var p = String(ref).split('|'); return compAll().filter(function(m){ return N(m.name) === N(p[0]) && N(m.source) === N(p[1]); })[0] || null; }
  function compOwner(m){
    var cn = m.summonedByClass ? N(m.summonedByClass.split('|')[0]) : null;
    var K = (D.casters || []).filter(function(k){ return cn && N(k.name) === cn; })[0] || (D.casters || [])[0] || null;
    return {cls:cn, lv: cn ? (D.clsLv[cn] || D.level) : D.level, K:K};
  }
  /* Convierte "1 + your Intelligence modifier + five times your artificer level" y similares en un número */
  function compEval(txt, c, m){
    if (txt == null) return null;
    if (typeof txt === 'number') return txt;
    var o = compOwner(m), sl = c.sl || m.summonedBySpellLevel || 1, t = String(txt);
    var parts = t.split(/\s+or\s+/);
    if (parts.length > 1) { var pick = parts.filter(function(x){ return c.v && new RegExp('\\(' + c.v.replace(/[^\w ]/g, '') + '\\b', 'i').test(x); })[0] || parts[0]; var tail = parts[parts.length - 1].replace(/^\s*\d+\s*\([^)]*only\)/i, ''); t = pick.replace(/\+.*$/, '') + (/\+/.test(tail) ? tail.slice(tail.indexOf('+')) : ''); }
    t = t.replace(/\([^)]*only\)/gi, '').replace(/\bplus\b/gi, '+').replace(/×/g, '*');
    t = t.replace(/(\d+)\s+for each spell level above\s+(\d+)(?:st|nd|rd|th)?/gi, function(_, n, k){ return n + '*' + Math.max(0, sl - k); });
    t = t.replace(/(\d+)\s+per spell level/gi, function(_, n){ return n + '*' + sl; });
    t = t.replace(/the level of the spell|the spell's level|spell level|summonSpellLevel/gi, String(sl));
    t = t.replace(/(\w+)\s+times your\s+(\w+)\s+level/gi, function(_, n, cl){ var k = NUMW[N(n)] || +n || 1; return k + '*' + (D.clsLv[N(cl)] || o.lv); });
    t = t.replace(/your\s+(\w+)\s+level/gi, function(_, cl){ return String(D.clsLv[N(cl)] || o.lv); });
    t = t.replace(/your\s+(\w+)\s+modifier/gi, function(_, a){ var k = ABW[N(a)]; return k ? '(' + D.mod[k] + ')' : '0'; });
    t = t.replace(/\bPB\b/g, String(D.pb));
    t = t.replace(/\([^)]*[a-z][^)]*\)/gi, '').replace(/[a-z]+[^+\-*()\d]*/gi, ' ');
    t = t.replace(/[^\d+\-*() ]/g, '').trim();
    if (!t || !/\d/.test(t)) return null;
    try { var v = Function('return (' + t + ')')(); return isFinite(v) ? Math.floor(v) : null; } catch(e){ return null; }
  }
  /* Dados con PB o nivel del conjuro → texto final ("1d4 + 3") */
  function compDice(ex, c, m){
    var sl = c.sl || m.summonedBySpellLevel || 1;
    var t = ex.replace(/summonSpellLevel/g, String(sl)).replace(/\bPB\b/g, String(D.pb));
    t = t.replace(/\(([\d\s+\-*]+)\)d(\d+)/g, function(_, e, f){ var n; try { n = Function('return (' + e + ')')(); } catch(x){ n = 1; } return Math.max(1, n) + 'd' + f; });
    var dice = [], k = 0;
    t.replace(/\s/g, '').replace(/([+-]?)(\d+d\d+|\d+)/g, function(_, sg, term){ if (/d/.test(term)) dice.push(term); else k += (sg === '-' ? -1 : 1) * +term; return ''; });
    return (dice.join(' + ') || '0') + (k ? (k > 0 ? ' + ' : ' − ') + Math.abs(k) : '');
  }
  function compSub(m, c){
    var o = compOwner(m), atk = o.K ? o.K.atk : D.pb, dc = o.K ? o.K.dc : 8 + D.pb;
    var j = JSON.stringify({trait:m.trait || [], action:m.action || [], bonus:m.bonus || [], reaction:m.reaction || []});
    j = j.replace(/\{@hitYourSpellAttack[^}]*\}/g, '{@hit ' + atk + '}').replace(/\{@dcYourSpellSave[^}]*\}/g, '{@dc ' + dc + '}');
    j = j.replace(/\{@(damage|dice) ([^}|]+)(\|[^}]*)?\}/g, function(_, tg, ex){ return '{@' + tg + ' ' + compDice(ex, c, m) + '}'; });
    return JSON.parse(j);
  }
  function compStats(c){
    var m = compMon(c.ref); if (!m) return null;
    var a0 = (m.ac || [])[0], ac = typeof a0 === 'number' ? a0 : a0 && a0.ac != null ? a0.ac : a0 && a0.special ? compEval(a0.special, c, m) : 10;
    var hpMax = c.hpMax || (m.hp && m.hp.special ? compEval(m.hp.special, c, m) : m.hp && m.hp.average) || 1;
    var save = {}, skill = {}; Object.keys(m.save || {}).forEach(function(k){ save[k] = compEval(m.save[k], c, m); }); Object.keys(m.skill || {}).forEach(function(k){ skill[k] = compEval(m.skill[k], c, m); });
    if (/vínculo mágico|magic bond/i.test(JSON.stringify(m.trait || []))) { var sl = c.sl || m.summonedBySpellLevel || 1; R.ABS.forEach(function(k){ save[k] = (save[k] != null ? save[k] : R.mod(m[k] || 10)) + sl; }); }
    var sub = compSub(m, c), attacks = [];
    (sub.action || []).concat(sub.bonus || []).forEach(function(a){
      var s = JSON.stringify(a.entries || []), h = /\{@hit (-?\d+)\}/.exec(s), dm = /\{@(?:damage|dice) ([^}]+)\}\)?\s*(?:de daño de\s+)?(\w+)?/.exec(s);
      if (h) attacks.push({name:a.name, atk:+h[1], dmg: dm ? dm[1] : '', type: dm && dm[2] ? (DMGW[N(dm[2])] || dm[2]) : ''});
    });
    var spd = m.speed || {}, ft = function(v){ return ((typeof v === 'object' ? v.number : v) / 5 * 1.5).toString().replace('.', ',') + ' m'; };
    return {m:m, ac:ac, hpMax:Math.max(1, hpMax), save:save, skill:skill, attacks:attacks, sub:sub,
      speed:[['walk',''],['fly','vuelo '],['swim','nado '],['climb','trepar '],['burrow','excavar ']].filter(function(x){ return spd[x[0]]; }).map(function(x){ return x[1] + ft(spd[x[0]]); }).join(', '),
      passive: m.passive != null ? compEval(m.passive, c, m) : 10 + R.mod(m.wis || 10), spellSummon: !!m.summonedBySpell};
  }
  function compCandidates(){
    var names = {}; D.features.forEach(function(f){ names[N(f.name)] = 1; }); allSpells().forEach(function(x){ names[N(x.e.name)] = 1; });
    return compAll().map(function(m){
      var byCls = m.summonedByClass && D.clsLv[N(m.summonedByClass.split('|')[0])] != null;
      var why = names[N(m.name)] ? 'Lo tienes' : byCls ? 'De tu clase' : m.summonedBySpell ? 'Conjuro ' + m.summonedBySpell.split('|')[0] : m.familiar ? 'Familiar' : 'Invocación';
      return {m:m, ref:m.name + '|' + m.source, score: names[N(m.name)] ? 0 : byCls ? 1 : m.summonedBySpell ? 2 : 3, why:why};
    }).sort(function(a, b){ return a.score - b.score || a.m.name.localeCompare(b.m.name); });
  }
  function compSuggest(){ var r = rt(cur()); return compCandidates().filter(function(x){ return x.score === 0 && !(r.comp || []).some(function(c){ return c.ref === x.ref; }); }); }
  function compVariants(m){ var s = JSON.stringify([m.hp, m.ac]), v = {}; s.replace(/\(([A-Z][\w ]*?) only\)/g, function(_, n){ n.split(/ and | or /).forEach(function(x){ v[x.trim()] = 1; }); return ''; }); return Object.keys(v); }
  function compCard(c, i, compact){
    var st = compStats(c); if (!st) return '<div class="compc"><p class="note">No encuentro la ficha de ' + esc(c.ref.split('|')[0]) + '. Carga el bestiario en Ajustes.</p><button class="btn sm" type="button" data-act="compdel" data-i="' + i + '">Quitar</button></div>';
    var m = st.m, hp = c.hp == null ? st.hpMax : Math.min(c.hp, st.hpMax), pct = Math.round(hp / st.hpMax * 100), barc = pct <= 33 ? 'var(--bad)' : pct <= 66 ? 'var(--warn)' : 'var(--ok)';
    var h = '<div class="compc" data-i="' + i + '"><div class="comp-h"><svg class="ic"><use href="#i-paw"/></svg><div style="flex:1;min-width:0"><b>' + esc(c.n || m.name) + '</b><small>' + esc((SIZE[(m.size || [])[0]] || '') + ' ' + (CTYPE[typeof m.type === 'string' ? m.type : m.type && m.type.type] || '')) + ' · ' + esc(R.srcName(m.source)) + (m._builtin ? ' · ficha integrada' : '') + '</small></div>'
      + (compact ? '' : '<button class="icon-btn" type="button" data-act="compdel" data-i="' + i + '" aria-label="Quitar a ' + attr(c.n || m.name) + '"><svg class="ic"><use href="#i-x"/></svg></button>') + '</div>';
    h += '<div class="comp-stats"><div><b>' + st.ac + '</b><span>CA</span></div><div><b>' + hp + '<small>/' + st.hpMax + '</small></b><span>PG</span></div><div><b>' + esc(st.speed.split(',')[0] || '–') + '</b><span>' + esc(st.speed.split(',').slice(1).join(',') || 'velocidad') + '</span></div></div>';
    h += '<div class="bar"><i style="width:' + pct + '%;background:' + barc + '"></i></div>';
    h += '<div class="quick comp-q"><button type="button" class="m" data-act="comphp" data-i="' + i + '" data-v="-5">−5</button><button type="button" class="m" data-act="comphp" data-i="' + i + '" data-v="-1">−1</button><button type="button" class="p" data-act="comphp" data-i="' + i + '" data-v="1">+1</button><button type="button" class="p" data-act="comphp" data-i="' + i + '" data-v="5">+5</button><button type="button" data-act="comphp" data-i="' + i + '" data-v="full">Lleno</button></div>';
    if (st.spellSummon) h += '<label class="comp-sl">Nivel del conjuro<select class="field" data-compsl="' + i + '">' + [1,2,3,4,5,6,7,8,9].filter(function(l){ return l >= (m.summonedBySpellLevel || 1) && l <= Math.max(m.summonedBySpellLevel || 1, D.maxSpellLevel || 1); }).map(function(l){ return '<option value="' + l + '"' + ((c.sl || m.summonedBySpellLevel || 1) === l ? ' selected' : '') + '>' + l + '</option>'; }).join('') + '</select></label>';
    var vs = compVariants(m); if (vs.length) h += '<label class="comp-sl">Forma<select class="field" data-compv="' + i + '">' + vs.map(function(v){ return '<option' + (c.v === v ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('') + '</select></label>';
    st.attacks.forEach(function(a){ h += '<div class="comp-atk"><span>' + esc(a.name) + '</span><span class="roll">Tira 1d20 ' + sgn(a.atk).replace('+', '+ ').replace('−', '− ') + '</span>' + (a.dmg ? '<span class="dmg">' + esc(a.dmg) + ' ' + esc(a.type) + '</span>' : '') + '</div>'; });
    if (m.actionNote) h += '<p class="note">' + esc(/bonus action/i.test(m.actionNote) ? 'Actúa cuando gastas tu acción adicional para ordenárselo.' : /your action/i.test(m.actionNote) ? 'Actúa cuando gastas tu acción para ordenárselo.' : m.actionNote) + '</p>';
    if (!compact) {
      var body = '<div class="abil comp-abil">' + R.ABS.map(function(k){ return '<div class="ab"><small>' + R.AB[k].toUpperCase() + '</small><div class="medal">' + sgn(R.mod(m[k] || 10)) + '</div><span class="score">' + (m[k] || 10) + '</span></div>'; }).join('') + '</div>';
      var rows = [];
      if (Object.keys(st.save).length) rows.push(['Salvaciones', Object.keys(st.save).map(function(k){ return R.AB[k] + ' ' + sgn(st.save[k]); }).join(', ')]);
      if (Object.keys(st.skill).length) rows.push(['Habilidades', Object.keys(st.skill).map(function(k){ return (CSKILL[k] || k) + ' ' + sgn(st.skill[k]); }).join(', ')]);
      rows.push(['Sentidos', (m.senses || []).map(function(x){ return String(x).replace(/\{@\w+ ([^|}]*)[^}]*\}/g, '$1').replace(/^(\w+)/, function(w0){ return SENSEW[N(w0)] || w0; }).replace(/(\d+) ft\./, function(_, n){ return (n / 5 * 1.5).toString().replace('.', ',') + ' m'; }); }).concat(['Percepción pasiva ' + st.passive]).join(', ')]);
      if (m.immune) rows.push(['Inmune', m.immune.map(function(x){ return typeof x === 'string' ? DMGW[N(x)] || x : (x.immune || []).join(', '); }).join(', ')]);
      if (m.resist) rows.push(['Resistente', m.resist.map(function(x){ return typeof x === 'string' ? DMGW[N(x)] || x : (x.resist || []).join(', '); }).join(', ')]);
      if (m.conditionImmune) rows.push(['Inmune a', m.conditionImmune.map(function(x){ return typeof x === 'string' ? CONDW[N(x)] || x : (x.conditionImmune || []).map(function(y){ return CONDW[N(y)] || y; }).join(', '); }).join(', ')]);
      if (m.languages) rows.push(['Idiomas', m.languages.join(', ')]);
      body += '<dl class="gmeta">' + rows.map(function(r){ return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>';
      [['trait','Rasgos'],['action','Acciones'],['bonus','Acciones adicionales'],['reaction','Reacciones']].forEach(function(g){
        var list = st.sub[g[0]] || []; if (!list.length) return;
        body += '<h4>' + g[1] + '</h4>' + list.map(function(x){ return Render5e.entries([{type:'entries', name:x.name, entries:x.entries}]); }).join('');
      });
      h += '<details class="feat-d comp-d" data-comp="' + i + '"><summary><b>Ficha completa</b><small>rasgos y acciones</small></summary><div class="gtext"></div></details>';
      compBodies[i] = trWrap(body, 'c|' + c.ref + '|' + (c.sl || '') + '|' + D.pb);
    }
    return h + '</div>';
  }
  var compBodies = {};
  function compSection(compact){
    var C = cur(), r = rt(C), list = r.comp || [], h = '';
    if (compact && !list.length) return '';
    h += '<div class="card comp-card"><div class="row"><span class="label">compañeros</span>' + (compact ? '' : '<button class="btn sm" type="button" data-act="compnew">Añadir</button>') + '</div>';
    if (!list.length) {
      var sug = compSuggest()[0];
      h += sug ? '<div class="banner"><p>Tienes ' + esc(sug.m.name) + '. Añade su ficha para llevar sus PG y ataques.</p><button class="btn main sm" type="button" data-act="compadd" data-ref="' + attr(sug.ref) + '">Añadir</button></div>' : '<p class="note">Homúnculos, defensores de acero, familiares e invocaciones. Sus números se calculan con tu nivel y tu bonificador.</p>';
    }
    h += list.map(function(c, i){ return compCard(c, i, compact); }).join('');
    return h + '</div>';
  }
  function compAdd(ref){
    var C = cur(), r = rt(C); r.comp = r.comp || [];
    var m = compMon(ref); if (!m) return;
    var c = {id:'k' + Date.now().toString(36), ref:ref}; if (m.summonedBySpellLevel) c.sl = m.summonedBySpellLevel;
    var vs = compVariants(m); if (vs.length) c.v = vs[0];
    r.comp.push(c); var st = compStats(c); c.hp = st ? st.hpMax : 1;
    save(); closeSheets(); render(false);
  }
  var compQ = '';
  function openComp(){
    compQ = ''; renderCompList(); openSheet('compSheet');
    var q = $('#compQ'); q.value = ''; if (!wide()) q.blur();
  }
  function renderCompList(){
    var q = N(compQ), list = compCandidates().filter(function(x){ return !q || N(x.m.name).indexOf(q) >= 0; }), lib = (Lib5e.get() && Lib5e.get().monster || []).length;
    $('#compList').innerHTML = (lib ? '' : '<p class="note">Tu biblioteca no trae criaturas todavía: solo aparece la ficha integrada del Homúnculo. Vuelve a crear el paquete con el script nuevo para tener defensores, familiares e invocaciones.</p>')
      + list.slice(0, 120).map(function(x){ var m = x.m; return '<div class="prow"><div class="top"><button type="button" class="sel" data-act="compadd" data-ref="' + attr(x.ref) + '"><span class="nm"><b>' + esc(m.name) + '</b><small>' + esc(x.why + ' · ' + R.srcName(m.source)) + (x.score === 0 ? ' <span class="flag taken">Sugerido</span>' : '') + '</small></span></button></div></div>'; }).join('')
      + (list.length > 120 ? '<p class="note">Se muestran 120 de ' + list.length + '. Escribe para afinar.</p>' : '') + (!list.length ? '<p class="empty-state">Nada coincide con la búsqueda.</p>' : '');
  }
  document.addEventListener('input', function(ev){ if (ev.target.id === 'compQ') { compQ = ev.target.value; renderCompList(); } });
  document.addEventListener('change', function(ev){
    var t = ev.target, C = cur(); if (!C || !t.dataset) return;
    var r = rt(C);
    if (t.dataset.compsl != null) { var c = r.comp[+t.dataset.compsl]; c.sl = +t.value; var st = compStats(c); c.hp = st.hpMax; save(); render(false); }
    if (t.dataset.compv != null) { var c2 = r.comp[+t.dataset.compv]; c2.v = t.value; var st2 = compStats(c2); c2.hp = st2.hpMax; save(); render(false); }
  });
  document.addEventListener('toggle', function(ev){
    var d = ev.target; if (!d.matches || !d.open || d.dataset.comp == null) return;
    var box = d.querySelector('.gtext'); if (box.dataset.done) return;
    box.innerHTML = compBodies[+d.dataset.comp] || ''; box.dataset.done = 1; trInit(box);
  }, true);

  /* ==================== API PARA LA SALA DE COMBATE ==================== */
  var COND_ES = {blinded:'Cegado', charmed:'Hechizado', deafened:'Ensordecido', exhaustion:'Agotamiento', frightened:'Asustado', grappled:'Agarrado', incapacitated:'Incapacitado', invisible:'Invisible', paralyzed:'Paralizado', petrified:'Petrificado', poisoned:'Envenenado', prone:'Derribado', restrained:'Apresado', stunned:'Aturdido', unconscious:'Inconsciente', concentration:'Concentración'};
  function applyToMe(m){
    var C = cur(); if (!C || !D || !D.ok) return;
    var r = rt(C), n = Math.max(0, +m.amount || 0); r.conds = r.conds || [];
    if (m.kind === 'damage') { var t = Math.min(r.temp || 0, n); r.temp = (r.temp || 0) - t; r.hp = Math.max(0, r.hp - (n - t)); if (r.conc) r.concDc = Math.max(10, Math.floor(n / 2)); }
    else if (m.kind === 'heal') r.hp = Math.min(D.hp.max, r.hp + n);
    else if (m.kind === 'temp') r.temp = Math.max(r.temp || 0, n);
    else if (m.kind === 'cond+' && m.cond && r.conds.indexOf(m.cond) < 0) r.conds.push(m.cond);
    else if (m.kind === 'cond-') r.conds = r.conds.filter(function(k){ return k !== m.cond; });
    save(); render(false);
  }
  window.Diario = {cur:cur, D:function(){ return D; }, rt:rt, applyToMe:applyToMe,
    compSummaries:function(){ var C = cur(); if (!C || !D || !D.ok) return []; return (rt(C).comp || []).map(function(c){ var st = compStats(c); return st ? {name:c.n || st.m.name, ac:st.ac, hp:c.hp == null ? st.hpMax : c.hp, hpMax:st.hpMax} : null; }).filter(Boolean); }};

  /* ==================== COMBATE ==================== */
  function renderCombat(){
    var C = cur(); if (!C || !D || !D.ok) { $('#cLeft').innerHTML = noCharHtml(); $('#cRight').innerHTML = ''; return; }
    var r = rt(C), L = '', Rr = '<div id="salaBox"></div>';
    $('#round').textContent = r.round;
    L += '<div class="stats"><div class="stat"><div class="shield"><svg width="44" height="50" viewBox="0 0 44 50" aria-hidden="true"><path d="M22 2 L41 9 Q41 33 22 48 Q3 33 3 9 Z"/></svg><span>' + D.ac + '</span></div><span class="label">clase de armadura</span></div><div class="stat"><span class="big">' + sgn(D.init) + '</span><span class="label">iniciativa</span></div><div class="stat"><span class="big">' + D.speed + '</span><span class="label">velocidad</span></div></div>';
    var pct = Math.round(r.hp / D.hp.max * 100), barc = pct <= 33 ? 'var(--bad)' : pct <= 66 ? 'var(--warn)' : 'var(--ok)';
    L += '<div class="card"><div class="row"><span class="label">puntos de golpe</span><span class="muted" style="font-size:15px">Temporales ' + (r.temp || 0) + '</span></div><div class="hp-top"><b>' + r.hp + '</b><span>/ ' + D.hp.max + '</span></div><div class="bar"><i style="width:' + pct + '%;background:' + barc + '"></i></div>'
      + '<form class="hp-form" id="hpForm"><label for="hpIn">Resultado de tus dados<input id="hpIn" class="field" inputmode="numeric" autocomplete="off" placeholder="0"></label><button class="btn dmg" type="submit" data-sign="-1">Daño</button><button class="btn heal" type="submit" data-sign="1">Curar</button><button class="btn" type="submit" data-sign="0">Temp.</button></form><p class="err" id="hpErr" hidden>Escribe un número primero.</p>'
      + '<div class="quick"><button type="button" class="m" data-act="hp" data-v="-5">−5</button><button type="button" class="m" data-act="hp" data-v="-1">−1</button><button type="button" class="p" data-act="hp" data-v="1">+1</button><button type="button" class="p" data-act="hp" data-v="5">+5</button></div></div>';
    var concSp = allSpells().filter(function(x){ return (x.e.duration || []).some(function(d){ return d.concentration; }); });
    if (r.conc) { var cs = R.findSpell(r.conc); L += '<div class="conc"><div class="halo"><svg class="ic"><use href="#i-star"/></svg></div><div style="flex:1"><b>Concentración · ' + (cs ? spellLink(cs).replace('class="ref"', 'class="ref" style="color:inherit"') : esc(r.conc)) + '</b><small>Si recibes daño: salvación de Con, CD <span id="concDc">' + (r.concDc || 10) + '</span> o la mitad del daño.</small></div><button class="btn" type="button" data-act="endconc">Terminar</button></div>'; }
    else if (concSp.length) L += '<div class="card"><label class="label" for="concSel">concentración</label><select class="field" id="concSel" style="margin-top:6px"><option value="">No me estoy concentrando</option>' + concSp.map(function(x){ return '<option value="' + attr(x.e.name + '|' + x.e.source) + '">' + esc(x.e.name) + '</option>'; }).join('') + '</select></div>';
    var res = '';
    D.resources.forEach(function(x){
      if (x.max) res += '<div class="line"><span>' + esc(x.label) + '</span><div class="pips">' + pipsHTML(x.max, Math.min(x.max, r.res[x.key] || 0), 'res:' + x.key) + '</div></div>';
      else if (x.pool) { var left = x.pool - (r.res[x.key] || 0); res += '<div class="line"><span>' + esc(x.label) + '</span><div class="row"><span class="num">' + left + ' <small class="muted">/ ' + x.pool + '</small></span><button class="btn sm" type="button" data-act="pool" data-key="' + attr(x.key) + '" data-v="1">−1</button><button class="btn sm" type="button" data-act="pool" data-key="' + attr(x.key) + '" data-v="5">−5</button></div></div>'; }
      else if (x.text) res += '<div class="line"><span>' + esc(x.label) + '</span><span class="num">' + esc(x.text) + '</span></div>';
    });
    L += '<div class="card"><span class="label">recursos</span>' + (res || '<p class="note">Sin recursos con usos limitados.</p>') + '<div class="row" style="margin-top:10px;gap:8px"><button class="btn" type="button" data-act="short" style="flex:1">Descanso corto</button><button class="btn" type="button" data-act="long" style="flex:1">Descanso largo</button></div></div>';
    if ((r.conds || []).length) L += '<div class="card"><span class="label">condiciones</span><div class="chips">' + r.conds.map(function(k){ return '<button type="button" class="chip big" data-act="condoff" data-v="' + attr(k) + '" aria-label="Quitar ' + attr(COND_ES[k] || k) + '">' + esc(COND_ES[k] || k) + ' ×</button>'; }).join('') + '</div></div>';
    L += slotsCard(r);
    L += compSection(true);
    Rr += '<div class="card"><div class="row"><span class="label">tu turno</span><button class="pill" type="button" data-act="newturn">Reiniciar turno</button></div><div class="econ">' + [['a','Acción'],['b','Acción adicional'],['r','Reacción'],['m','Movimiento']].map(function(e){ return '<button type="button" data-act="econ" data-k="' + e[0] + '" aria-pressed="' + !!r.econ[e[0]] + '">' + e[1] + '</button>'; }).join('') + '</div></div>';
    if (!D.attacks.length) Rr += '<div class="card"><p class="note">Equipa un arma en la pestaña Equipo para ver aquí tu tirada de ataque y de daño.</p></div>';
    D.attacks.forEach(function(a){
      var m = r.crit ? 2 : 1, dice = a.dice.replace(/^(\d+)d/, function(_, n){ return (n * m) + 'd'; });
      var extra = {}; a.extra.forEach(function(x){ var mm = /^(\d+)d(\d+)/.exec(x.dice); if (!mm) return; var key = x.type + '|' + mm[2]; extra[key] = (extra[key] || 0) + mm[1] * m; });
      var smiteOk = D.smite && !a.ranged;
      if (smiteOk && r.smite) extra['radiante|8'] = (extra['radiante|8'] || 0) + (r.smite + 1) * m;
      var lines = '<div>' + dice + ' ' + sgn(a.mod).replace('+', '+ ').replace('−', '− ') + ' ' + esc(a.type) + '</div>' + Object.keys(extra).map(function(k){ var p = k.split('|'); return '<div class="rad">' + extra[k] + 'd' + p[1] + ' ' + esc(p[0]) + '</div>'; }).join('');
      Rr += '<div class="weapon"><div class="weapon-h"><svg class="ic"><use href="#' + (a.ranged ? 'i-bow' : 'i-sword') + '"/></svg><h3>' + (a.ref ? '<a class="ref" data-ref="' + attr(a.ref) + '" style="color:inherit">' + esc(a.name) + '</a>' : esc(a.name) + '<span class="hb-tag">homebrew</span>') + '</h3><button class="crit" type="button" data-act="crit" aria-pressed="' + !!r.crit + '">Crítico</button></div><div class="weapon-b">'
        + '<div class="row"><span class="label">ataque</span><span class="roll">Tira 1d20 ' + sgn(a.atk).replace('+', '+ ').replace('−', '− ') + '</span></div><div style="height:1px;background:var(--rule-2)"></div>'
        + '<div class="row" style="align-items:flex-start"><span class="label" style="padding-top:4px">daño</span><div class="dmg-out">' + lines + '</div></div><div class="muted" style="font-size:14px">' + esc(a.notes) + (a.extra.length ? ' · ' + a.extra.map(function(x){ return esc(x.note); }).join(', ') : '') + '</div>'
        + (smiteOk ? '<div><span class="label"><a class="ref" data-ref="spell|Divine Smite|XPHB">castigo divino</a></span><div class="smite">' + [0].concat(D.slots.map(function(n, i){ return n > 0 ? i + 1 : null; }).filter(Boolean)).slice(0, 5).map(function(v){ return '<button type="button" data-act="smite" data-v="' + v + '" aria-pressed="' + (r.smite === v) + '">' + (v ? 'Nv ' + v : 'No') + '</button>'; }).join('') + '</div></div>' : '')
        + (a.hbNotes ? '<div class="mastery" style="white-space:pre-line">' + esc(a.hbNotes) + '</div>' : '')
        + (a.mastery.length ? '<div class="mastery"><b>Maestría · ' + a.mastery.map(function(mm){ return '<a class="ref" data-ref="itemMastery|' + attr(mm) + '|XPHB" style="color:inherit">' + esc(mm) + '</a>'; }).join(', ') + '</b></div>' : '')
        + '</div></div>';
    });
    Rr += '<div class="card"><span class="label">acciones rápidas</span><div class="chips">' + [['Dash','Correr'],['Disengage','Retirarse'],['Dodge','Esquivar'],['Help','Ayudar'],['Ready','Preparar'],['Opportunity Attack','Ataque de oportunidad'],['Grapple','Agarrar']].map(function(a){ return '<a class="ref chip big" data-ref="action|' + a[0] + '|XPHB">' + a[1] + '</a>'; }).join('') + '</div><p class="note">Toca una acción para ver la regla.</p></div>';
    $('#cLeft').innerHTML = L; $('#cRight').innerHTML = Rr;
    if (window.Sala) Sala.mount($('#salaBox'));
  }
  document.addEventListener('submit', function(ev){
    if (ev.target.id !== 'hpForm') return;
    ev.preventDefault();
    var C = cur(), r = rt(C), inp = $('#hpIn'), n = parseInt(inp.value, 10), sign = +(ev.submitter && ev.submitter.dataset.sign || -1);
    if (!(n >= 0)) { $('#hpErr').hidden = false; inp.focus(); return; }
    if (sign === 0) r.temp = n;
    else if (sign < 0) { var t = Math.min(r.temp || 0, n); r.temp = (r.temp || 0) - t; r.hp = Math.max(0, r.hp - (n - t)); if (r.conc) r.concDc = Math.max(10, Math.floor(n / 2)); }
    else r.hp = Math.min(D.hp.max, r.hp + n);
    save(); renderCombat();
  });
  document.addEventListener('input', function(ev){ if (ev.target.id === 'hpIn') { ev.target.value = ev.target.value.replace(/[^0-9]/g, ''); var e = $('#hpErr'); if (e) e.hidden = true; } });
  document.addEventListener('change', function(ev){ if (ev.target.id === 'concSel') { var C = cur(); rt(C).conc = ev.target.value || null; rt(C).concDc = 10; save(); renderCombat(); } });

  /* ==================== GRIMORIO ==================== */
  var SECDATA = {
    reglas: function(L){ return L.variantrule.map(function(e){ return ['variantrule', e]; }); },
    acciones: function(L){ return L.action.map(function(e){ return ['action', e]; }); },
    condiciones: function(L){ return L.condition.concat(L.status).map(function(e){ return [L.status.indexOf(e) >= 0 ? 'status' : 'condition', e]; }); },
    conjuros: function(L){ return L.spell.map(function(e){ return ['spell', e]; }); },
    objetos: function(L){ return L.item.map(function(e){ return ['item', e]; }).concat(L.baseitem.map(function(e){ return ['baseitem', e]; })); },
    dotes: function(L){ return L.feat.map(function(e){ return ['feat', e]; }); }
  };
  var SUBS = {
    conjuros: [['*','Todos los niveles'],['0','Trucos'],['1','Nivel 1'],['2','Nivel 2'],['3','Nivel 3'],['4','Nivel 4'],['5','Nivel 5'],['6','Nivel 6'],['7','Nivel 7'],['8','Nivel 8'],['9','Nivel 9']],
    objetos: [['*','Todos los objetos'],['wpn','Armas'],['arm','Armaduras y escudos'],['pot','Pociones y pergaminos'],['won','Objetos maravillosos'],['ring','Anillos, varitas y bastones'],['gear','Equipo de aventura'],['mag','Solo mágicos']],
    reglas: [['*','Todas las reglas'],['XPHB','Glosario 2024 (PHB)'],['XDMG','Guía del DM 2024'],['old','Reglas 2014 y variantes']]
  };
  function subMatch(sec, type, e){
    if (G.sub === '*') return true;
    if (sec === 'conjuros') return String(e.level) === G.sub;
    if (sec === 'reglas') return G.sub === 'old' ? (e.source !== 'XPHB' && e.source !== 'XDMG') : e.source === G.sub;
    if (sec === 'objetos') {
      var t = (e.type || '').split('|')[0];
      if (G.sub === 'wpn') return t === 'M' || t === 'R' || !!e.weapon;
      if (G.sub === 'arm') return /^(LA|MA|HA|S)$/.test(t) || !!e.armor;
      if (G.sub === 'pot') return t === 'P' || t === 'SC';
      if (G.sub === 'won') return !!e.wondrous;
      if (G.sub === 'ring') return /^(RG|WD|RD|ST)$/.test(t);
      if (G.sub === 'gear') return t === 'G' || t === 'AT' || t === 'T' || t === 'INS' || t === 'FD' || t === 'SCF';
      if (G.sub === 'mag') return e.rarity && e.rarity !== 'none';
    }
    return true;
  }
  function grimSecs(){ return '<div class="gsecs" role="tablist" aria-label="Secciones del grimorio">' + GSECS.map(function(s){ return '<button type="button" data-act="gsec" data-v="'+s[0]+'" aria-pressed="'+(G.sec===s[0])+'">'+s[1]+'</button>'; }).join('') + '</div>'; }
  var SPELL_CLASSES = null;
  function spellClassList(){ if (!SPELL_CLASSES) { var seen = {}; SPELL_CLASSES = R.classes().map(function(c){ return c.name; }).filter(function(n){ if (seen[n]) return false; seen[n] = 1; return true; }).sort(); } return SPELL_CLASSES; }
  var ES_CLASS = {Artificer:'Artífice', Barbarian:'Bárbaro', Bard:'Bardo', Cleric:'Clérigo', Druid:'Druida', Fighter:'Guerrero', Monk:'Monje', Paladin:'Paladín', Ranger:'Explorador', Rogue:'Pícaro', Sorcerer:'Hechicero', Warlock:'Brujo', Wizard:'Mago'};
  function spellRowsHtml(rows, opts){
    opts = opts || {};
    var cols = [['name','Nombre'],['lv','Nv'],['time','Tiempo'],['school','Escuela'],['cr','C/R'],['range','Alcance']].concat(opts.origin ? [['origin','Origen']] : [['src','Libro']]);
    var sort = opts.sort || {k:'lv', dir:1};
    rows = rows.map(function(x){ var e = x.e || x, ss = Render5e.spellShort(e); return {e:e, ss:ss, origin:x.tag || '', key:{name:e.name, lv:e.level, time:ss.time, school:ss.school, cr:(ss.conc ? 'C' : '') + (ss.rit ? 'R' : ''), range:ss.range, origin:x.tag || '', src:e.source}}; });
    rows.sort(function(a, b){ var va = a.key[sort.k], vb = b.key[sort.k]; var c = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb)); return (c || a.e.name.localeCompare(b.e.name)) * sort.dir; });
    return '<div class="stable"><table><thead><tr>' + cols.map(function(c){ return '<th scope="col"><button type="button" data-act="' + (opts.act || 'gsort') + '" data-k="' + c[0] + '"' + (sort.k === c[0] ? ' aria-sort="' + (sort.dir > 0 ? 'ascending' : 'descending') + '"' : '') + '>' + c[1] + (sort.k === c[0] ? (sort.dir > 0 ? ' ▲' : ' ▼') : '') + '</button></th>'; }).join('') + '</tr></thead><tbody>'
      + rows.map(function(r){ var ref = 'spell|' + r.e.name + '|' + r.e.source; return '<tr data-act="gopen" data-ref="' + attr(ref) + '" tabindex="0"><td>' + esc(r.e.name) + '</td><td class="lv">' + (r.e.level || 'T') + '</td><td>' + esc(r.ss.time) + '</td><td>' + esc(r.ss.school) + '</td><td><span class="flags">' + (r.ss.conc ? '<span class="tag conc">C</span>' : '') + (r.ss.rit ? '<span class="tag cls">R</span>' : '') + '</span></td><td>' + esc(r.ss.range) + '</td><td>' + esc(opts.origin ? r.origin : r.e.source) + '</td></tr>'; }).join('')
      + '</tbody></table></div>';
  }
  function renderGrim(){
    var showSecs = !wide();
    if (!Lib5e.has()) { grim.innerHTML = (showSecs ? grimSecs() : '<div class="folio"><span>Grimorio</span></div>') + noLibHtml(); return; }
    if (G.view) { renderGrimDetail(showSecs); return; }
    var L = Lib5e.get(), sec = G.sec, rows = SECDATA[sec](L), q = G.q.trim().toLowerCase(), isSp = sec === 'conjuros';
    G.cls = G.cls || '*'; G.school = G.school || '*'; G.mode = G.mode || 'list'; G.sort = G.sort || {k:'lv', dir:1};
    var list = rows.filter(function(r){
      var e = r[1]; if (!e.name) return false; if (G.hideOld && e.reprintedAs) return false; if (q && e.name.toLowerCase().indexOf(q) < 0) return false;
      if (isSp) {
        if (G.cls !== '*' && !R.spellHasClass(e, G.cls)) return false;
        if (G.school !== '*' && e.school !== G.school) return false;
        if (G.conc && !(e.duration || []).some(function(d){ return d.concentration; })) return false;
        if (G.rit && !(e.meta && e.meta.ritual)) return false;
      }
      return subMatch(sec, r[0], e);
    }).sort(function(a, b){ return isSp ? (a[1].level - b[1].level || a[1].name.localeCompare(b[1].name)) : a[1].name.localeCompare(b[1].name); });
    var total = list.length, cap = isSp && G.mode === 'table' ? 400 : 150, shown = list.slice(0, cap), subs = SUBS[sec], secName = GSECS.filter(function(s){ return s[0] === sec; })[0][1];
    var fil = '<div class="gfil"><input class="field" id="gq" type="search" placeholder="Buscar en ' + secName.toLowerCase() + '…" aria-label="Buscar en ' + secName + '" value="' + attr(G.q) + '">';
    if (isSp) {
      fil += '<div class="three"><select class="field" id="gsub" aria-label="Nivel">' + subs.map(function(s){ return '<option value="' + s[0] + '"' + (G.sub === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select>'
        + '<select class="field" id="gcls" aria-label="Clase"><option value="*">Todas las clases</option>' + spellClassList().map(function(c){ return '<option value="' + attr(c) + '"' + (G.cls === c ? ' selected' : '') + '>' + esc(ES_CLASS[c] || c) + '</option>'; }).join('') + '</select>'
        + '<select class="field" id="gsch" aria-label="Escuela"><option value="*">Todas las escuelas</option>' + Object.keys(Render5e.SCHOOL).map(function(k){ return '<option value="' + k + '"' + (G.school === k ? ' selected' : '') + '>' + Render5e.SCHOOL[k] + '</option>'; }).join('') + '</select></div>'
        + '<div class="viewseg"><label class="toggle"><input type="checkbox" id="gconc"' + (G.conc ? ' checked' : '') + '> Concentración</label><label class="toggle"><input type="checkbox" id="grit"' + (G.rit ? ' checked' : '') + '> Ritual</label><label class="toggle"><input type="checkbox" id="gold"' + (G.hideOld ? ' checked' : '') + '> Ocultar 2014 reemplazados</label></div>'
        + '<div class="viewseg" role="group" aria-label="Vista"><button type="button" data-act="gmode" data-v="list" aria-pressed="' + (G.mode === 'list') + '">Lista</button><button type="button" data-act="gmode" data-v="table" aria-pressed="' + (G.mode === 'table') + '">Tabla</button></div>';
    } else fil += '<div class="two">' + (subs ? '<select class="field" id="gsub" aria-label="Filtro">' + subs.map(function(s){ return '<option value="' + s[0] + '"' + (G.sub === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select>' : '<span></span>') + '<label class="toggle"><input type="checkbox" id="gold"' + (G.hideOld ? ' checked' : '') + '> Ocultar 2014 reemplazadas</label></div>';
    fil += '</div>';
    var body;
    if (isSp && G.mode === 'table') body = spellRowsHtml(shown.map(function(r){ return r[1]; }), {sort:G.sort});
    else if (isSp) {
      var lv = -1; body = '<div class="glist">' + shown.map(function(r){ var e = r[1], h = ''; if (e.level !== lv) { lv = e.level; h += '<div class="group-h" style="margin:12px 0 2px">' + (lv ? 'Nivel ' + lv : 'Trucos') + '</div>'; } var ss = Render5e.spellShort(e); return h + '<button type="button" class="gitem" data-act="gopen" data-ref="' + attr('spell|' + e.name + '|' + e.source) + '"><b>' + esc(e.name) + '</b><small>' + esc(ss.school.toLowerCase()) + (ss.conc ? ' · C' : '') + (ss.rit ? ' · R' : '') + ' · ' + esc(e.source) + '</small></button>'; }).join('') + '</div>';
    } else body = '<div class="glist">' + shown.map(function(r){ var e = r[1], sub = (r[0] === 'item' || r[0] === 'baseitem') ? Render5e.itemType(e).toLowerCase() + ' · ' : ''; return '<button type="button" class="gitem" data-act="gopen" data-ref="' + attr(r[0] + '|' + e.name + '|' + e.source) + '"><b>' + esc(e.name) + '</b><small>' + esc(sub) + esc(e.source) + '</small></button>'; }).join('') + '</div>';
    grim.innerHTML = (showSecs ? grimSecs() : '<div class="folio"><span>Grimorio · ' + secName + '</span></div>') + fil
      + '<p class="note" style="margin:10px 0 4px">' + total + ' resultados' + (total > cap ? '; se muestran ' + cap + ', afina con los filtros' : '') + '.</p>' + body;
    var gq = $('#gq'); if (gq) gq.addEventListener('input', function(){ G.q = gq.value; var pos = gq.selectionStart; renderGrim(); var n = $('#gq'); n.focus(); n.setSelectionRange(pos, pos); });
    [['#gsub','sub'],['#gcls','cls'],['#gsch','school']].forEach(function(p){ var el = $(p[0]); if (el) el.addEventListener('change', function(){ G[p[1]] = el.value; renderGrim(); }); });
    [['#gold','hideOld'],['#gconc','conc'],['#grit','rit']].forEach(function(p){ var el = $(p[0]); if (el) el.addEventListener('change', function(){ G[p[1]] = el.checked; renderGrim(); }); });
  }
  function featCtx(){ return D && D.ok ? {level:D.level, cls:D.cls.name, classes:D.clsLv, abil:D.abil, species:D.race ? D.race.name : '', background:D.bg ? D.bg.name : '', feats:D.feats.map(function(f){ return N(f.e.name); }), caster:!!D.spellAbility, armor:D.armor, weapon:D.weapon, features:D.features.map(function(f){ return N(f.name); })} : null; }
  function renderGrimDetail(showSecs){
    var v = G.view, d = Render5e.detail(v.type, v.e), e = v.e, extra = '';
    var title = e.name || (e.entries && e.entries[0] && e.entries[0].name) || e.abbreviation || '';
    if ((v.type === 'item' || v.type === 'baseitem') && cur()) extra = '<button class="btn main" type="button" data-act="additem">Añadir a la mochila</button>';
    if (v.type === 'feat') { var cx = featCtx(); if (cx) { var pr = R.featPrereq(e, cx); extra = '<div class="req ' + pr.st + '" style="margin-top:8px"><span class="mark" aria-hidden="true"></span><span><b>' + (pr.st === 'ok' ? 'Cumples' : pr.st === 'dm' ? 'Lo decide el DM' : 'No cumples') + '.</b> ' + esc(pr.text) + '</span></div><p class="note" style="margin-top:6px">Las dotes se toman al subir de nivel, desde el creador.</p>'; } }
    var back = G.hist.length ? 'Volver' : (G.from ? 'Volver a ' + G.from[1] : 'Volver a la lista');
    grim.innerHTML = (showSecs ? grimSecs() : '') + '<button class="gback" type="button" data-act="gback"><svg class="ic" style="width:18px;height:18px"><use href="#i-back"/></svg>'+esc(back)+'</button>'
      + '<article class="gdetail torn worn"><h2>'+esc(title)+'</h2><div class="muted" style="font-size:14px">'+esc(Rules5e.srcName(e.source))+(e.page ? ', p. '+e.page : '')+'</div>'
      + (d.meta.length ? '<dl class="gmeta">' + d.meta.map(function(r){ return '<dt>'+esc(r[0])+'</dt><dd>'+r[1]+'</dd>'; }).join('') + '</dl>' : '<div style="height:10px"></div>')
      + '<div class="gtext">' + trWrap(d.body, 'g|' + v.type + '|' + e.name + '|' + e.source) + '</div>' + extra + '<p class="err" id="gerr" hidden></p></article>';
    var sc = grim.closest('.scroll'); if (sc) sc.scrollTop = 0;
    trInit(grim); fxAt(null, 12, grim.querySelector('.gdetail h2'));
  }
  function openRef(ref, fromBack){
    var p = ref.split('|'), f = Lib5e.find(p[0], p[1], p[2]);
    if (!f) { if (!Lib5e.has()) openSettings(); return; }
    if (!$('#picker').hidden || !$('#creator').hidden) { showRefInPicker(f); return; }
    var inCombat = !$('#combat').hidden;
    if (!fromBack && G.view && !inCombat) G.hist.push(G.view);
    if (inCombat) { G.hist = []; G.from = ['__combat', 'el combate']; $('#combat').hidden = true; }
    else if (!G.view && !fromBack) G.from = wide() ? null : [S.tab, (TABS.filter(function(t){ return t[0] === S.tab; })[0] || [0,'el diario'])[1].toLowerCase()];
    G.view = {type:f.type, e:f.e};
    if (wide()) { if (S.left === 'personaje') S.left = secFor(f.type); } else if (S.tab !== 'grimorio') S.tab = 'grimorio';
    render(false); renderGrim();
  }
  function secFor(type){ return {spell:'conjuros', item:'objetos', baseitem:'objetos', condition:'condiciones', status:'condiciones', disease:'condiciones', action:'acciones', feat:'dotes'}[type] || 'reglas'; }
  function grimBack(){
    if (G.hist.length) { G.view = G.hist.pop(); renderGrim(); return; }
    G.view = null;
    if (G.from && G.from[0] === '__combat') { G.from = null; $('#combat').hidden = false; renderCombat(); renderGrim(); return; }
    if (G.from && !wide()) { S.tab = G.from[0]; G.from = null; render(true); }
    renderGrim();
  }

  /* ==================== TRADUCCIÓN ==================== */
  var trServer = '', TRmem = {}, TRorig = {}, trEng = null, trChrome = null, trSample = null;
  var TR_PROMPT = 'Traduce al español de México el texto en inglés de este fragmento HTML con reglas de Dungeons & Dragons.\n'
    + 'Reglas:\n1) Conserva exactamente todas las etiquetas HTML y sus atributos. No traduzcas ni cambies los valores de class ni de data-ref.\n'
    + '2) Usa la terminología oficial de D&D en español: saving throw = tirada de salvación; ability check = prueba de característica; attack roll = tirada de ataque; Advantage = ventaja; Disadvantage = desventaja; Action = acción; Bonus Action = acción adicional; Reaction = reacción; spell slot = espacio de conjuro; cantrip = truco; Hit Points = puntos de golpe; Temporary Hit Points = puntos de golpe temporales; Armor Class = clase de armadura; Proficiency Bonus = bonificador de competencia; Concentration = concentración; Difficulty Class (DC) = clase de dificultad (CD); Short Rest = descanso corto; Long Rest = descanso largo; Strength = Fuerza; Dexterity = Destreza; Constitution = Constitución; Intelligence = Inteligencia; Wisdom = Sabiduría; Charisma = Carisma; Blinded = cegado; Charmed = hechizado; Deafened = ensordecido; Frightened = asustado; Grappled = agarrado; Incapacitated = incapacitado; Paralyzed = paralizado; Petrified = petrificado; Poisoned = envenenado; Prone = derribado; Restrained = apresado; Stunned = aturdido; Unconscious = inconsciente.\n'
    + '3) Convierte distancias en pies a metros (5 pies = 1,5 m).\n'
    + '4) Traduce los nombres de conjuros, dotes y objetos y deja el nombre original en inglés entre paréntesis la primera vez que aparezcan, por ejemplo: Bola de fuego (Fireball).\n'
    + '5) Responde solo con el HTML traducido, sin explicaciones y sin bloques de código.\n\nHTML:\n';
  function trEngine(){
    if (trEng !== null) return Promise.resolve(trEng);
    return (async function(){
      /* 1) Claude, si el diario corre como artefacto de claude.ai */
      try { if (window.claude && window.claude.use) { trSample = await window.claude.use('sample'); if (trSample) { trEng = 'claude'; return trEng; } } } catch(e){}
      /* 2) El servidor del proyecto, con caché compartida para todo el grupo (funciona en cualquier teléfono) */
      try { if (/^https?:$/.test(location.protocol) && !(window.DIARIO_CONFIG && DIARIO_CONFIG.artifact)) { var r = await fetch('api/translate', {cache:'no-store'}); if (r.ok) { var j = await r.json(); if (j && j.enabled) { trEng = 'server'; trServer = j.provider; return trEng; } } } } catch(e){}
      /* 3) El traductor integrado de Chrome de escritorio */
      try { if (typeof Translator !== 'undefined') { var a = await Translator.availability({sourceLanguage:'en', targetLanguage:'es'}); if (a && a !== 'unavailable') { trEng = 'chrome'; return trEng; } } } catch(e){}
      trEng = ''; return trEng;
    })();
  }
  var TR_TAGS = /^(P|B|I|U|EM|STRONG|UL|OL|LI|H4|DIV|SPAN|A|TABLE|THEAD|TBODY|TR|TD|TH|CAPTION|DL|DT|DD|HR|BR|SMALL)$/;
  function trSanitize(html){
    var tpl = document.createElement('template'); tpl.innerHTML = String(html).replace(/^\s*```(?:html)?\s*/i, '').replace(/\s*```\s*$/, '');
    (function walk(node){
      Array.prototype.slice.call(node.childNodes).forEach(function(ch){
        if (ch.nodeType === 1) {
          if (!TR_TAGS.test(ch.tagName)) { walk(ch); while (ch.firstChild) node.insertBefore(ch.firstChild, ch); node.removeChild(ch); return; }
          Array.prototype.slice.call(ch.attributes).forEach(function(at){ if (at.name !== 'class' && !(at.name === 'data-ref' && ch.tagName === 'A')) ch.removeAttribute(at.name); });
          walk(ch);
        } else if (ch.nodeType !== 3) node.removeChild(ch);
      });
    })(tpl.content);
    return tpl.innerHTML;
  }
  async function trTranslate(html){
    var eng = await trEngine();
    if (eng === 'chrome') {
      if (!trChrome) trChrome = await Translator.create({sourceLanguage:'en', targetLanguage:'es'});
      var tpl = document.createElement('template'); tpl.innerHTML = html;
      var w = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT), nodes = [];
      while (w.nextNode()) if (w.currentNode.nodeValue.trim().length > 1) nodes.push(w.currentNode);
      for (var i = 0; i < nodes.length; i++) { var lead = nodes[i].nodeValue.match(/^\s*/)[0], tail = nodes[i].nodeValue.match(/\s*$/)[0]; nodes[i].nodeValue = lead + (await trChrome.translate(nodes[i].nodeValue.trim())) + tail; }
      return tpl.innerHTML;
    }
    if (eng === 'claude') { var res = await trSample(TR_PROMPT + html, {modelTier:'quick', cache:{gcTime:86400000}}); return trSanitize(res.text); }
    if (eng === 'server') {
      var rr, ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, tmo = ctl && setTimeout(function(){ ctl.abort(); }, 90000);
      try { rr = await fetch('api/translate', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({html:html}), signal: ctl ? ctl.signal : undefined}); } catch(e){ throw {code: e && e.name === 'AbortError' ? 'timeout' : 'offline'}; } finally { clearTimeout(tmo); }
      var jj = await rr.json().catch(function(){ return {}; });
      if (!rr.ok) throw {code: jj.code || 'error', msg: jj.msg};
      return trSanitize(jj.html);
    }
    throw {code:'no_engine'};
  }
  function trWrap(html, key){ if (S.trMode === 'off' || !key) return html; return '<div class="trwrap" data-trkey="' + attr(key) + '"><div class="trbar"></div><div class="gtext trbody">' + html + '</div></div>'; }
  function trBar(wrap){
    var st = wrap.dataset.st || 'orig', bar = wrap.querySelector('.trbar'), h = '';
    if (st === 'orig') h = '<button class="btn" type="button" data-act="trgo">Traducir al español</button>';
    else if (st === 'origtr') h = '<span class="trtag">Texto original</span><button class="btn" type="button" data-act="trshow">Ver traducción</button>';
    else if (st === 'loading') h = '<span class="trtag">Traduciendo…</span><span class="muted" style="font-size:13px">' + (trEng === 'server' ? 'la primera vez puede tardar hasta un minuto' : '') + '</span>';
    else if (st === 'tr') h = '<span class="trtag">Traducción automática</span><button class="btn" type="button" data-act="trorig">Ver original</button>';
    else if (st === 'err') h = '<span class="trerr">' + esc(wrap.dataset.err || 'No se pudo traducir.') + '</span><button class="btn" type="button" data-act="trgo">Reintentar</button>';
    bar.innerHTML = h;
  }
  function trShow(wrap, which){
    var key = wrap.dataset.trkey, body = wrap.querySelector('.trbody');
    if (which === 'tr' && TRmem[key]) { body.innerHTML = TRmem[key]; wrap.dataset.st = 'tr'; }
    else { body.innerHTML = TRorig[key] || body.innerHTML; wrap.dataset.st = TRmem[key] ? 'origtr' : 'orig'; }
    trBar(wrap);
  }
  function trGo(wrap){
    if (!wrap) return;
    var key = wrap.dataset.trkey, body = wrap.querySelector('.trbody');
    if (TRmem[key]) { trShow(wrap, 'tr'); return; }
    wrap.dataset.st = 'loading'; trBar(wrap); body.classList.add('translating');
    trTranslate(TRorig[key]).then(function(out){
      TRmem[key] = out; idbSet('tr:' + key, out);
      body.classList.remove('translating'); if (document.contains(wrap)) trShow(wrap, 'tr');
    }).catch(function(e){
      body.classList.remove('translating');
      var code = e && e.code;
      wrap.dataset.err = e && e.msg ? e.msg : code === 'not_granted' || code === 'sampling_disabled' ? 'La traducción con Claude no está permitida en esta vista.' : code === 'rate_limited' ? 'Demasiadas traducciones seguidas; intenta en un momento.' : code === 'no_engine' ? 'Aquí no hay traductor disponible.' : code === 'timeout' ? 'El traductor tardó demasiado. Intenta otra vez.' : code === 'offline' ? 'Sin conexión: la traducción necesita internet la primera vez.' : code === 'too_large' ? 'Este texto es demasiado largo para traducirlo.' : 'No se pudo traducir.';
      wrap.dataset.st = 'err'; if (document.contains(wrap)) trBar(wrap);
    });
  }
  function trInit(root){
    if (!root || S.trMode === 'off') return;
    $$('.trwrap', root).forEach(function(wrap){
      if (wrap.dataset.init) return; wrap.dataset.init = 1;
      var key = wrap.dataset.trkey; TRorig[key] = wrap.querySelector('.trbody').innerHTML;
      if (TRmem[key]) { trShow(wrap, S.trPref === 'orig' ? 'orig' : 'tr'); return; }
      wrap.dataset.st = 'orig'; trBar(wrap);
      idbGet('tr:' + key).then(function(v){
        if (v) { TRmem[key] = v; if (document.contains(wrap) && wrap.dataset.st === 'orig' && S.trPref !== 'orig') trShow(wrap, 'tr'); else if (document.contains(wrap) && wrap.dataset.st === 'orig') { wrap.dataset.st = 'origtr'; trBar(wrap); } }
        else if (S.trMode === 'auto' && document.contains(wrap) && wrap.dataset.st === 'orig') trGo(wrap);
      });
    });
  }
  function trSettings(){
    var m = S.trMode || 'manual';
    $('#trModes').innerHTML = [['off','Desactivada'],['manual','Con botón'],['auto','Automática']].map(function(x){ return '<button type="button" data-act="trmode" data-v="' + x[0] + '" aria-pressed="' + (m === x[0]) + '">' + x[1] + '</button>'; }).join('');
    $('#trStatus').textContent = 'Revisando qué traductor hay disponible…';
    trEngine().then(function(e){
      if (e === 'server') fetch('api/translate', {cache:'no-store'}).then(function(r){ return r.json(); }).then(function(j){ if (j && j.lastError) $('#trStatus').textContent += ' Último problema del servidor (' + String(j.lastError.at).slice(11, 16) + ' UTC): ' + j.lastError.msg; }).catch(function(){});
      $('#trStatus').textContent = e === 'server' ? 'Traduce el servidor del grupo' + (trServer === 'gemini' ? ' con Gemini' : trServer === 'cloudflare' ? ' con Cloudflare' : trServer === 'claude' ? ' con Claude' : trServer === 'deepl' ? ' con DeepL' : '') + '. Lo que alguien ya tradujo sale al instante para todos y queda guardado en tu teléfono.' : e === 'chrome' ? 'Se usará el traductor integrado del navegador: funciona en el dispositivo y no gasta nada.' : e === 'claude' ? 'Se usará Claude con la cuenta de quien abre el diario. La primera vez pedirá permiso.' : 'Aquí no hay traductor disponible: el servidor del grupo no tiene traductor configurado y este navegador no trae uno.';
    });
  }

  /* ==================== DETALLES DE OPCIONES ==================== */
  function detailHtml(det){
    try {
      if (det.type === 'classSummary') {
        var c = R.byRef(Lib5e.get().class, det.ref); if (!c) return '';
        var sp = c.startingProficiencies || {}, sk = (sp.skills || [])[0], skT = sk && sk.choose ? 'Elige ' + (sk.choose.count || 1) + ' de: ' + sk.choose.from.map(function(s){ return R.SKES[s] || s; }).join(', ') : sk && sk.any ? 'Elige ' + sk.any + ' cualquiera' : '—';
        var feats = R.featRefs(c).filter(function(f){ return !/^Ability Score/.test(f.name); });
        return '<dl class="gmeta"><dt>Dado de golpe</dt><dd>d' + c.hd.faces + '</dd><dt>Salvaciones</dt><dd>' + (c.proficiency || []).map(function(k){ return R.ABL[k]; }).join(', ') + '</dd><dt>Habilidades</dt><dd>' + esc(skT) + '</dd><dt>Armaduras</dt><dd>' + esc((sp.armor || []).map(R.strip).join(', ') || '—') + '</dd><dt>Armas</dt><dd>' + esc((sp.weapons || []).map(R.strip).join(', ') || '—') + '</dd>' + (c.spellcastingAbility ? '<dt>Conjuros</dt><dd>Con ' + R.ABL[c.spellcastingAbility] + '</dd>' : '') + '<dt>Subclase</dt><dd>Nivel ' + R.subclassLevel(c) + '</dd></dl>'
          + '<p><b>Rasgos por nivel:</b> ' + feats.map(function(f){ return f.level + '. ' + esc(f.name); }).join(' · ') + '</p>';
      }
      if (det.type === 'subclassSummary') {
        var cls = R.byRef(Lib5e.get().class, det.cls), s = cls && R.subclassesOf(cls).filter(function(x){ return x.name + '|' + x.source === det.ref; })[0]; if (!s) return '';
        return (s.subclassFeatures || []).map(function(ref){ var f = Lib5e.subclassFeature(ref); return f ? '<h4>Nivel ' + f.level + ': ' + esc(f.name) + '</h4>' + Render5e.entries(f.entries) : ''; }).join('') + (s.additionalSpells ? '<p class="note">Incluye conjuros siempre preparados.</p>' : '');
      }
      if (det.type === 'race') {
        var r = R.byRef(Lib5e.get().race, det.ref); if (!r) return '';
        var spd = typeof r.speed === 'number' ? r.speed : r.speed && r.speed.walk;
        return '<dl class="gmeta"><dt>Tamaño</dt><dd>' + (r.size || []).map(function(z){ return SIZE[z] || z; }).join(' o ') + '</dd><dt>Velocidad</dt><dd>' + (spd ? (spd / 5 * 1.5).toString().replace('.', ',') + ' m' : '—') + '</dd>' + (r.darkvision ? '<dt>Visión</dt><dd>En la oscuridad ' + (r.darkvision / 5 * 1.5) + ' m</dd>' : '') + (r.ability ? '<dt>Aumentos</dt><dd>' + esc(R.abilitySpec(r.ability).map(R.altLabel).join(' o ')) + '</dd>' : '') + '</dl>' + Render5e.entries(r.entries);
      }
      if (det.type === 'background') {
        var b = R.byRef(Lib5e.get().background, det.ref); if (!b) return '';
        var feats = (b.feats || []).map(function(o){ return Object.keys(o).map(function(k){ return k === 'anyFromCategory' ? 'Una dote de origen a tu elección' : k.split('|')[0].replace(/\b\w/g, function(c){ return c.toUpperCase(); }); }).join(', '); }).join(', ');
        var eq = (b.startingEquipment && Array.isArray(b.startingEquipment) ? b.startingEquipment : []).map(function(g){ return Object.keys(g).map(function(k){ return '<li><b>' + (k === '_' ? 'Siempre' : 'Opción ' + k.toUpperCase()) + ':</b> ' + R.eqItems(g[k]).map(function(x){ return esc((x.q > 1 ? x.q + ' × ' : '') + x.name); }).join(', ') + '</li>'; }).join(''); }).join('');
        return '<dl class="gmeta">' + (b.ability ? '<dt>Aumentos</dt><dd>' + esc(R.abilitySpec(b.ability).map(R.altLabel).join(' — o — ')) + '</dd>' : '') + (feats ? '<dt>Dote</dt><dd>' + esc(feats) + '</dd>' : '') + '<dt>Habilidades</dt><dd>' + esc((b.skillProficiencies || []).map(function(o){ return Object.keys(o).filter(function(k){ return o[k] === true; }).map(function(k){ return R.SKES[k] || k; }).join(', ') || 'a elegir'; }).join(', ')) + '</dd></dl>' + (eq ? '<p><b>Equipo:</b></p><ul>' + eq + '</ul>' : '') + Render5e.entries((b.entries || []).filter(function(e){ return !(e && e.type === 'list' && e.style === 'list-hang-notitle'); }));
      }
      if (det.type === 'feat' || det.type === 'optfeature') {
        var f = det.type === 'feat' ? (function(){ var p = Lib5e.parseRef(det.ref), x = Lib5e.find('feat', p.name, p.source); return x && x.e; })() : Lib5e.optionalfeature(det.ref); if (!f) return '';
        var cx = crCtx() || featCtx(), pr = det.type === 'feat' && cx ? R.featPrereq(f, cx) : null;
        return (pr ? '<div class="req ' + pr.st + '"><span class="mark" aria-hidden="true"></span><span><b>' + (pr.st === 'ok' ? 'Cumples' : pr.st === 'dm' ? 'Lo decide el DM' : 'No cumples') + '.</b> ' + esc(pr.text) + '</span></div>' : '') + Render5e.entries(f.entries);
      }
      if (det.type === 'grants') {
        var gr = R.spellGrants(det.group, 20);
        return '<ul>' + gr.fixed.map(function(s){ var e = R.findSpell(s.ref); return '<li>' + (e ? spellLink(e) : esc(s.ref)) + ' <span class="muted">(' + esc(s.how) + ')</span></li>'; }).join('') + gr.chooses.map(function(c){ return '<li>Eliges ' + c.count + ' ' + esc(c.filter ? R.filterLabel(c.filter) : 'de una lista') + ' <span class="muted">(' + esc(c.how) + ')</span></li>'; }).join('') + '</ul>' + (det.group.ability ? '<p class="note">Característica para lanzar: ' + (typeof det.group.ability === 'string' ? R.ABL[det.group.ability] : 'a elegir entre ' + det.group.ability.choose.map(function(a){ return R.ABL[a]; }).join(', ')) + '</p>' : '');
      }
      if (det.type === 'item') { var p = det.ref.split('|'), it = Lib5e.find(p[0], p[1], p[2]); if (!it) return ''; var dd = Render5e.detail(it.type, it.e); return '<dl class="gmeta">' + dd.meta.map(function(r){ return '<dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>' + dd.body; }
      if (det.type === 'equip') return '<ul>' + det.items.map(function(x){ return '<li>' + (x.ref ? '<a class="ref" data-ref="' + attr(x.ref) + '">' + esc(x.name) + '</a>' : esc(x.name)) + (x.q > 1 ? ' ×' + x.q : '') + '</li>'; }).join('') + '</ul>';
      if (det.type === 'spell') { var sp2 = R.findSpell(det.ref); if (!sp2) return ''; var ds = Render5e.detail('spell', sp2); return '<dl class="gmeta">' + ds.meta.map(function(r){ return '<dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>' + ds.body; }
    } catch(e) { return '<p class="note">No se pudo mostrar el detalle.</p>'; }
    return '';
  }
  function detAttr(det){ return attr(JSON.stringify(det)); }

  /* ==================== CREADOR DE PERSONAJES ==================== */
  var CR = null, CD = null;
  function crCtx(){ return CR && CD && CD.ok ? {level:CD.level, cls:CD.cls.name, classes:CD.clsLv, abil:CD.abil, species:CD.race ? CD.race.name : '', background:CD.bg ? CD.bg.name : '', feats:CD.feats.map(function(f){ return N(f.e.name); }), caster:!!CD.spellAbility, armor:CD.armor, weapon:CD.weapon, features:CD.features.map(function(f){ return N(f.name); })} : null; }
  function openCreator(C, isNew, step){
    if (!Lib5e.has()) { openSettings(); return; }
    closeSheets();
    CR = {C: JSON.parse(JSON.stringify(C || {name:'', level:1, method:'array', base:{}, ch:{}})), isNew: !!isNew, step: step || 'clase', origLevel: C ? C.level : 1};
    $('#crTitle').textContent = isNew ? 'Nuevo personaje' : 'Editar ' + (C.name || 'personaje');
    $('#creator').hidden = false; renderCreator(); $('#crBody').scrollTop = 0;
  }
  function closeCreator(){ $('#creator').hidden = true; $('#picker').hidden = true; CR = null; CD = null; }
  var RESET = {
    cls: [/@/, /^mcsk/, /^sub$/, /^clssk/, /^exp\d/, /^cantrips$/, /^spells$/, /^mastery$/, /^opt:/, /^eq:c/, /^hp:/, /^feat:(asi|fp_)/, /^(fab|fsk):(asi|fp_)/, /^(gsp|gab|grp):f:(asi|fp_)/, /^(gsp|gab|grp):o:/],
    race: [/^size$/, /^lineage$/, /^racesk/, /^raceAbil$/, /^feat:race/, /^(fab|fsk):race/, /^(gsp|gab|grp):(race|f:race)/],
    bg: [/^bgAbil$/, /^bgsk/, /^eq:b/, /^feat:bg/, /^(fab|fsk):bg/, /^(gsp|gab|grp):f:bg/]
  };
  function setChoice(id, val){
    var ch = CR.C.ch, before = CD ? CD.choices.map(function(c){ return c.id; }) : [];
    if (id === '_mcadd') { crLevelUp(val); return; }
    if (id === 'cls' && ch.cls && ch.cls !== val) { CR.C.level = 1; CR.C.cl = null; }
    if (RESET[id] && ch[id] !== val) Object.keys(ch).forEach(function(k){ if (RESET[id].some(function(re){ return re.test(k); })) delete ch[k]; });
    var m = /^feat:(.+)$/.exec(id);
    if (m && ch[id] !== val) Object.keys(ch).forEach(function(k){ if (k.indexOf('fab:' + m[1]) === 0 || k.indexOf('fsk:' + m[1] + ':') === 0 || k.indexOf(':f:' + m[1]) > 0) delete ch[k]; });
    if (val == null || (Array.isArray(val) && !val.length)) delete ch[id]; else ch[id] = val;
    renderCreator();
    var changed = CD.choices.filter(function(c){ return c.id === id; })[0];
    var fresh = CD.choices.filter(function(c){ return c.prompt && !c.done && before.indexOf(c.id) < 0; })[0]
      || (changed && changed.prompt && changed.parent ? CD.choices.filter(function(c){ return c.prompt && !c.done && c.parent === changed.parent && c.id !== id; })[0] : null);
    if (fresh) setTimeout(function(){ openPicker(fresh.id); }, 0);
  }
  function renderCreator(){
    CD = R.derive(CR.C);
    var steps = R.STEPS, i = steps.findIndex(function(s){ return s[0] === CR.step; });
    $('#crSteps').innerHTML = steps.map(function(s){ var todo = CD.choices.some(function(c){ return !c.done && inStep(c, s[0]); }) || (s[0] === 'listo' && !CR.C.name); return '<button type="button" class="' + (todo ? 'todo' : '') + '" data-act="crstep" data-v="' + s[0] + '"' + (s[0] === CR.step ? ' aria-current="step"' : '') + '><i aria-hidden="true"></i>' + s[1] + '</button>'; }).join('');
    $('#crPrev').disabled = i === 0;
    $('#crNext').textContent = CR.step === 'listo' ? (CR.isNew ? 'Crear personaje' : 'Guardar cambios') : 'Siguiente';
    var todoN = CD.choices.filter(function(c){ return !c.done && inStep(c, CR.step); }).length;
    $('#crHint').textContent = todoN ? 'Faltan ' + todoN + ' en este paso' : 'Paso completo';
    var h = '';
    if (CR.step === 'clase') h += levelNote();
    if (CR.step === 'caract') h += scoresUI();
    if (CR.step === 'conjuros') h += spellsInfo();
    if (CR.step === 'listo') h += finalUI();
    if (CR.step === 'niveles') h += levelsUI();
    else if (CR.step !== 'listo') {
      var list = CD.choices.filter(function(c){ return c.step === CR.step && c.kind !== 'scores' && c.kind !== 'hp' && (c.lv || 1) <= 1; });
      if (!list.length && CR.step !== 'clase' && CR.step !== 'caract' && CR.step !== 'niveles') h += '<p class="empty-state">No hay nada que elegir en este paso con tu combinación actual.</p>';
      h += list.map(renderChoice).join('');
      if (CR.step === 'habil') h += skillSummary();
      if (CR.step === 'equipo' && !CR.isNew) h += '<div class="card"><p class="note">El equipo inicial se añade solo al crear el personaje. Si quieres agregarlo ahora a la mochila:</p><button class="btn" type="button" data-act="cradditems" style="margin-top:8px">Añadir equipo inicial a la mochila</button></div>';
    }
    if (CR.step === 'clase' && !CD.cls) h += '<p class="note">Elige una clase para continuar.</p>';
    $('#crIn').innerHTML = h;
  }
  function inStep(c, step){
    if (c.kind === 'hp') return false;
    if (step === 'niveles') return (c.lv || 1) > 1 || c.step === 'niveles';
    return c.step === step && (c.lv || 1) <= 1;
  }
  function levelNote(){
    return '<div class="ch"><div class="ch-h"><h3>Nivel</h3><span class="st ok">Nivel ' + (CR.C.level || 1) + '</span></div><p class="help">' + (CR.isNew ? 'Empiezas en nivel 1. Cuando termines los primeros pasos, en Niveles subes uno por uno y el diario te pide lo que cada nivel necesita.' : 'Para subir de nivel ve al paso Niveles.') + ' Esta es tu clase principal: la multiclase se añade en Niveles, al subir.</p></div>';
  }
  function classSeq(C){ var a = []; for (var i = 0; i < (C.level || 1); i++) a.push(i === 0 ? C.ch.cls : (C.cl && C.cl[i]) || C.ch.cls); return a; }
  function crLevelUp(ref){
    var C = CR.C; if (!CD || CD.pending.length || C.level >= 20 || !ref) return;
    var seq = classSeq(C); seq.push(ref); C.cl = seq; C.level += 1;
    renderCreator(); $('#crBody').scrollTop = 0;
    var fresh = CD.choices.filter(function(c){ return c.prompt && !c.done; })[0]; if (fresh) setTimeout(function(){ openPicker(fresh.id); }, 0);
  }
  function mcAddChoice(){
    var have = {}; CD.classes.forEach(function(E){ have[N(E.cls.name)] = 1; });
    var prim = R.mcReq(CD.cls, CD.abil), all = R.classes();
    return {id:'_mcadd', kind:'one', title:'Multiclase: elige la nueva clase', options: all.filter(function(c){ return !have[N(c.name)]; }).map(function(c){
      var rq = R.mcReq(c, CD.abil), ok = rq.ok && prim.ok;
      return {v:c.name + '|' + c.source, label:c.name, sub:'d' + (c.hd ? c.hd.faces : 8) + ' · ' + R.srcLabel(c), st: ok ? 'ok' : 'no', req:'Pide ' + rq.text + (prim.ok ? '' : ' · y para salir de ' + CD.cls.name + ': ' + prim.text), old: c.source !== 'XPHB' && c.source !== 'EFA' && all.some(function(o){ return o.name === c.name && o.source === 'XPHB'; }), detail:{type:'classSummary', ref:c.name + '|' + c.source}};
    })};
  }
  var crFeats = [];
  function levelsUI(){
    var L = CD.level, pend = CD.pending, h = '';
    if (!CD.cls) return '<p class="empty-state">Elige una clase primero.</p>';
    crFeats = CD.features;
    var lastE = CD.classes.filter(function(E){ return E.at.indexOf(L) >= 0; })[0] || CD.classes[0];
    h += '<div class="ch"><div class="lvhead"><span class="big">' + L + '</span><div><h3 style="margin:0;font-family:var(--display);font-size:18px">Nivel ' + L + (CD.multi ? ' · ' + esc(lastE.cls.name) + ' ' + (lastE.at.indexOf(L) + 1) : ' de ' + esc(CD.cls.name)) + '</h3><p class="help">' + (CD.multi ? esc(CD.clsLabel) + ' · ' : '') + 'Competencia ' + sgn(CD.pb) + ' · ' + CD.hp.max + ' PG</p></div></div></div>';
    var gained = CD.features.map(function(f, i){ return {f:f, i:i}; }).filter(function(x){ return x.f.level === L && (x.f.from === 'Clase' || x.f.from === 'Subclase') && !/^(ability score improvement|.* subclass|subclass feature)$/i.test(x.f.name); });
    if (gained.length) h += '<div class="ch"><div class="ch-h"><h3>Lo que ganas en el nivel ' + L + '</h3></div>' + gained.map(function(x){ return '<details class="feat-d" data-crfeat="' + x.i + '"><summary><b>' + esc(x.f.name) + '</b><small>' + esc(x.f.from + (CD.multi ? ' · ' + x.f.cn : '')) + '</small></summary><div class="gtext"></div></details>'; }).join('') + '</div>';
    if (CD.mcReqs && CD.mcReqs.length) h += '<div class="banner warn"><p>No cumples el requisito de multiclase: ' + esc(CD.mcReqs.join(' · ')) + '. Puedes seguir si tu DM lo permite.</p></div>';
    h += hpLevelUI(L);
    var list = CD.choices.filter(function(c){ return c.kind !== 'scores' && c.kind !== 'hp' && (c.lv === L || !c.done); });
    var now = list.filter(function(c){ return c.lv === L; }), old = list.filter(function(c){ return c.lv !== L; });
    if (now.length) h += '<div class="group-h">Elecciones del nivel ' + L + '</div>' + now.map(renderChoice).join('');
    if (old.length) h += '<div class="group-h">Pendiente de otros pasos</div>' + old.map(renderChoice).join('');
    var dis = pend.length ? ' disabled' : '';
    var ups = L < 20 ? CD.classes.map(function(E){ return '<button class="btn main" type="button" data-act="crup" data-cls="' + attr(E.ref) + '"' + dis + '>' + (CD.multi ? 'Subir ' + esc(E.cls.name) + ' a ' + (E.lv + 1) : 'Subir a nivel ' + (L + 1)) + '</button>'; }).join('') + '<button class="btn" type="button" data-act="mcadd"' + dis + '>Multiclase…</button>' : '';
    h += '<div class="ch"><div class="lvbtns">' + (L > 1 ? '<button class="btn" type="button" data-act="crdown">Quitar el nivel ' + L + '</button>' : '') + ups + '</div>'
      + (pend.length ? '<p class="help">Para subir de nivel completa primero: ' + pend.map(function(c){ return esc(c.title); }).join(' · ') + '.</p>' : '<p class="help">Todo listo en el nivel ' + L + '.' + (L < 20 ? ' Puedes subir o terminar en el paso Listo.' : '') + '</p>') + '</div>';
    return h;
  }
  function hpLevelUI(L){
    var hp = CD.hp, faces = hp.faces, con = hp.con, h = '<div class="ch"><div class="ch-h"><h3>Puntos de golpe</h3><span class="st ok">' + hp.max + ' PG</span></div>';
    if (L === 1) h += '<p class="help">Nivel 1: máximo del dado (' + faces + ') ' + sgn(con) + ' Con = <b>' + hp.perLevel[0].total + '</b>.</p>';
    else {
      var v = CR.C.ch['hp:' + L], pl = hp.perLevel[L - 1];
      h += '<p class="help">Reglas 2024: cada nivel sumas el valor fijo de tu dado (' + pl.avg + ' con d' + pl.faces + (CD.multi ? ', de ' + esc(pl.cn) : '') + ') ' + sgn(con) + ' Con. Si prefieres tirar tu d' + pl.faces + ', anota el resultado.</p>'
        + '<div class="hprow"><b>Nivel ' + L + '</b><input class="field" type="text" inputmode="numeric" data-hp="' + L + '" aria-label="Tirada de PG del nivel ' + L + '" placeholder="' + pl.avg + '" value="' + (v || '') + '"><span class="muted">' + (v ? 'tirada ' + v : 'valor fijo ' + pl.avg) + ' ' + sgn(con) + ' = ' + pl.total + '</span></div>';
    }
    if (hp.notes.length) h += '<p class="help">Además, por dotes y rasgos: ' + esc(hp.notes.join(', ')) + '. Cuentan todos tus niveles, también los de antes de tomarlos.</p>';
    if (L > 1) h += '<details class="feat-d"><summary><b>PG de todos los niveles</b><small>' + hp.max + ' en total</small></summary><div style="padding:0 12px 10px">' + hp.perLevel.map(function(p){ return p.lv === 1 ? '<div class="hprow"><b>Nivel 1</b><span>' + faces + ' ' + sgn(con) + ' = ' + p.total + '</span></div>' : '<div class="hprow"><b>Nivel ' + p.lv + '</b><input class="field" type="text" inputmode="numeric" data-hp="' + p.lv + '" aria-label="Tirada de PG del nivel ' + p.lv + '" placeholder="' + p.avg + '" value="' + (CR.C.ch['hp:' + p.lv] || '') + '"><span class="muted">d' + p.faces + (CD.multi ? ' ' + esc(p.cn) : '') + ' = ' + p.total + '</span></div>'; }).join('') + '</div></details>';
    return h + '</div>';
  }
  function levelPicker(){
    return '<div class="ch"><div class="ch-h"><h3>Nivel</h3><span class="st ok">' + (CR.isNew ? 'Empiezas en este nivel' : 'Sube aquí de nivel') + '</span></div><div class="lvlpick"><button type="button" data-act="crlvl" data-v="-1" aria-label="Bajar nivel">−</button><b>' + (CR.C.level || 1) + '</b><button type="button" data-act="crlvl" data-v="1" aria-label="Subir nivel">+</button><span class="muted" style="font-size:14px">Bonificador de competencia ' + sgn(Math.floor(((CR.C.level || 1) - 1) / 4) + 2) + '</span></div><p class="help">Al subir de nivel aparecerán las nuevas elecciones (dotes, conjuros, rasgos) en sus pasos.</p></div>';
  }
  function chHead(c){ return '<div class="ch-h"><h3>' + esc(c.title) + '</h3><span class="st ' + (c.done ? 'ok">Listo' : 'todo">Falta') + '</span></div>' + (c.help ? '<p class="help">' + esc(c.help) + '</p>' : ''); }
  function optCard(c, o, multi){
    var on = multi ? (c.value || []).indexOf(o.v) >= 0 : c.value === o.v;
    var flags = (o.st === 'no' ? '<span class="flag no">No cumples</span>' : o.st === 'dm' ? '<span class="flag dm">Decide el DM</span>' : '') + (o.taken ? '<span class="flag taken">Ya la tienes</span>' : '');
    return '<div class="opt" aria-checked="' + on + '"><button type="button" data-act="crpick" data-c="' + attr(c.id) + '" data-v="' + attr(o.v) + '"' + (multi ? ' data-multi="1"' : '') + '><span class="radio' + (multi ? ' box' : '') + '"></span><span style="min-width:0"><b>' + esc(o.label) + '</b>' + (o.sub ? '<small>' + esc(o.sub) + '</small>' : '') + (o.req ? '<small>' + esc(o.req) + '</small>' : '') + flags + '</span></button>' + (o.detail ? '<details data-det="' + detAttr(o.detail) + '"><summary>Qué incluye</summary><div class="gtext"></div></details>' : '') + '</div>';
  }
  function renderChoice(c){
    var h = '<div class="ch' + (c.parent ? ' sub' : '') + (c.done ? '' : ' todo') + '" id="ch-' + attr(c.id) + '">' + chHead(c);
    if (c.kind === 'one') {
      if (c.options.length <= 8 && !c.search) h += '<div class="opts">' + c.options.map(function(o){ return optCard(c, o, false); }).join('') + '</div>';
      else {
        var o = c.options.filter(function(x){ return x.v === c.value; })[0];
        h += (o ? '<div class="opts">' + optCard(c, o, false) + '</div>' : '<p class="note">' + c.options.length + ' opciones.</p>') + '<div><button class="btn' + (o ? '' : ' main') + '" type="button" data-act="pkopen" data-c="' + attr(c.id) + '">' + (o ? 'Cambiar' : 'Elegir') + '</button></div>';
      }
    } else if (c.kind === 'many') {
      if (c.options.length <= 18 && !c.search) h += '<p class="help">' + ((c.value || []).length) + ' de ' + c.count + ' elegidas.</p><div class="opts">' + c.options.map(function(o){ return optCard(c, o, true); }).join('') + '</div>';
      else h += '<div class="chosen">' + (c.value || []).map(function(v){ var o = c.options.filter(function(x){ return x.v === v; })[0]; return '<span>' + esc(o ? o.label : v) + '</span>'; }).join('') + '</div><div><button class="btn' + (c.done ? '' : ' main') + '" type="button" data-act="pkopen" data-c="' + attr(c.id) + '">Elegir (' + ((c.value || []).length) + '/' + c.count + ')</button></div>';
    } else if (c.kind === 'spells') {
      h += '<div class="chosen">' + (c.value || []).map(function(v){ var e = R.findSpell(v); return '<span>' + (e ? spellLink(e) + ' <small class="muted">' + (e.level ? 'nv ' + e.level : 'truco') + '</small>' : esc(v)) + '</span>'; }).join('') + '</div><div><button class="btn' + (c.done ? '' : ' main') + '" type="button" data-act="pkopen" data-c="' + attr(c.id) + '">Elegir (' + ((c.value || []).length) + '/' + c.count + ')</button></div>';
    } else if (c.kind === 'abil') {
      var v = c.value || {alt:0, picks:[]}, alt = c.spec[v.alt || 0];
      if (c.spec.length > 1) h += '<div class="seg">' + c.spec.map(function(a, i){ return '<button type="button" data-act="cralt" data-c="' + attr(c.id) + '" data-v="' + i + '" aria-pressed="' + ((v.alt || 0) === i) + '">' + esc(R.altLabel(a)) + '</button>'; }).join('') + '</div>';
      if (alt && alt.slots.length) h += '<div class="abilrow">' + alt.slots.map(function(s, i){ return '<label style="display:flex;align-items:center;gap:6px"><b>' + sgn(s.n) + '</b><select class="field" data-abil="' + attr(c.id) + '" data-i="' + i + '" aria-label="Característica para ' + sgn(s.n) + '"><option value="">Elige…</option>' + s.from.map(function(k){ return '<option value="' + k + '"' + (v.picks && v.picks[i] === k ? ' selected' : '') + '>' + R.ABL[k] + '</option>'; }).join('') + '</select></label>'; }).join('') + '</div>';
      else if (alt) h += '<p class="note">' + esc(R.altLabel(alt)) + '</p>';
    }
    return h + '</div>';
  }
  function scoresUI(){
    var C = CR.C, base = C.base || (C.base = {}), m = C.method || 'array';
    var h = '<div class="ch"><div class="ch-h"><h3>Método</h3></div><div class="seg">' + [['array','Valores estándar'],['buy','Compra de puntos'],['roll','Tiradas con dados']].map(function(x){ return '<button type="button" data-act="crmethod" data-v="' + x[0] + '" aria-pressed="' + (m === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
    if (m === 'array') h += '<p class="help">Asigna 15, 14, 13, 12, 10 y 8, una vez cada uno.</p>';
    if (m === 'buy') { var spent = R.ABS.reduce(function(t, k){ return t + (PBCOST[base[k] || 8] || 0); }, 0); h += '<p class="help">27 puntos. Cada característica va de 8 a 15. Te quedan <b>' + (27 - spent) + '</b>.</p>'; }
    if (m === 'roll') h += '<p class="help">Tira 4d6 con tus dados físicos, descarta el menor y anota el total de cada característica.</p>';
    var usedArr = R.ABS.map(function(k){ return base[k]; });
    h += '<div style="overflow-x:auto"><table class="scores"><tr><th>Característica</th><th>Base</th><th>Aumentos</th><th>Total</th><th>Mod.</th></tr>' + R.ABS.map(function(k){
      var ctl;
      if (m === 'array') ctl = '<select class="field" data-score="' + k + '" aria-label="' + R.ABL[k] + '"><option value="">–</option>' + STD.map(function(v){ var taken = usedArr.filter(function(x){ return x === v; }).length >= STD.filter(function(x){ return x === v; }).length && base[k] !== v; return '<option value="' + v + '"' + (base[k] === v ? ' selected' : '') + (taken ? ' disabled' : '') + '>' + v + '</option>'; }).join('') + '</select>';
      else if (m === 'buy') ctl = '<span class="pb-ctl"><button type="button" data-act="crbuy" data-k="' + k + '" data-v="-1" aria-label="Bajar ' + R.ABL[k] + '">−</button><b>' + (base[k] || 8) + '</b><button type="button" data-act="crbuy" data-k="' + k + '" data-v="1" aria-label="Subir ' + R.ABL[k] + '">+</button></span>';
      else ctl = '<input class="field" type="text" inputmode="numeric" data-score="' + k + '" aria-label="' + R.ABL[k] + '" value="' + (base[k] || '') + '">';
      var bon = CD.bonus ? CD.bonus[k] : 0, tot = CD.abil ? CD.abil[k] : (base[k] || 8) + bon;
      var srcs = (CD.bonusSrc || []).filter(function(b){ return b.abil === k; }).map(function(b){ return b.from + ' ' + sgn(b.n); }).join(', ');
      return '<tr><td>' + R.ABL[k] + '</td><td>' + ctl + '</td><td title="' + attr(srcs) + '">' + (bon ? sgn(bon) : '–') + (srcs ? '<br><small class="muted">' + esc(srcs) + '</small>' : '') + '</td><td class="tot">' + (base[k] ? tot : '–') + '</td><td>' + (base[k] ? sgn(R.mod(tot)) : '–') + '</td></tr>';
    }).join('') + '</table></div></div>';
    return h;
  }
  function hpUI(){
    if (!CD.cls) return '';
    var lvl = CD.level, faces = CD.hp.faces, h = '<div class="ch"><div class="ch-h"><h3>Puntos de golpe</h3><span class="st ok">' + CD.hp.max + ' PG</span></div><p class="help">Nivel 1: ' + faces + ' + Con. En cada nivel siguiente usa el promedio (' + CD.hp.avg + ') o anota lo que sacaste en tu d' + faces + '.</p>';
    h += '<div class="hprow"><b>Nivel 1</b><span>' + faces + ' ' + sgn(CD.mod.con) + '</span></div>';
    for (var l = 2; l <= lvl; l++) { var v = CR.C.ch['hp:' + l]; h += '<div class="hprow"><b>Nivel ' + l + '</b><input class="field" type="text" inputmode="numeric" data-hp="' + l + '" aria-label="Tirada de PG del nivel ' + l + '" placeholder="' + CD.hp.avg + '" value="' + (v || '') + '"><span class="muted">' + (v ? 'tirada' : 'promedio') + ' ' + sgn(CD.mod.con) + '</span></div>'; }
    if (CD.hp.notes.length) h += '<p class="note">Además: ' + esc(CD.hp.notes.join(', ')) + '.</p>';
    return h + '</div>';
  }
  function spellsInfo(){
    if (!CD.cls) return '';
    var h = '';
    (CD.casters || []).forEach(function(K){ h += '<div class="ch"><div class="ch-h"><h3>Conjuros de ' + esc(K.name) + '</h3></div><div class="summary"><div><small>Característica</small><b>' + R.ABL[K.ability] + '</b></div><div><small>CD de salvación</small><b>' + K.dc + '</b></div><div><small>Ataque</small><b>' + sgn(K.atk) + '</b></div><div><small>Trucos</small><b>' + K.nCantrips + '</b></div><div><small>Preparados</small><b>' + (K.full ? 'Toda la lista' : K.nPrepared) + '</b></div><div><small>Nivel máximo</small><b>' + (K.maxLv || '–') + '</b></div></div></div>'; });
    if ((CD.casters || []).some(function(K){ return K.nPrepared && K.maxLv; })) { var on = !!(CR.C.house && CR.C.house.allSpells); h += '<div class="ch"><div class="ch-h"><h3>Regla de la mesa</h3><span class="st ok">' + (on ? 'Activada' : 'Normal') + '</span></div><label class="toggle"><input type="checkbox" data-act="crfull"' + (on ? ' checked' : '') + '> Toda la lista de conjuros de mi clase cuenta como preparada</label><p class="help">Si tu DM lo permite, no eliges preparados: tienes todos los de tu lista hasta el nivel que puedes lanzar. Los trucos se siguen eligiendo.</p></div>'; }
    if (!(CD.casters || []).length) h += '<div class="ch"><p class="help">' + esc(CD.cls.name) + (CD.sub ? ' (' + esc(CD.sub.name) + ')' : '') + ' no lanza conjuros a este nivel.</p></div>';
    if (CD.extraSpells.length) h += '<div class="ch"><div class="ch-h"><h3>Conjuros que ya tienes</h3></div><p class="help">Vienen de tu clase, subclase, especie o dotes; no cuentan contra tus preparados.</p><div class="chosen">' + CD.extraSpells.map(function(x){ return '<span>' + spellLink(x.e) + ' <small class="muted">' + esc(x.from) + '</small></span>'; }).join('') + '</div></div>';
    return h;
  }
  function skillSummary(){
    var sk = Object.keys(CD.skills || {});
    return '<div class="ch"><div class="ch-h"><h3>Tus habilidades</h3></div><div class="chosen">' + (sk.length ? sk.map(function(s){ return '<span>' + R.SKES[s] + (CD.expert[s] ? ' (pericia)' : '') + ' <small class="muted">' + esc(CD.skills[s]) + '</small></span>'; }).join('') : '<span class="muted">Ninguna todavía</span>') + '</div></div>';
  }
  function finalUI(){
    var h = '<div class="ch"><label class="ch-h" for="crName"><h3>Nombre del personaje</h3></label><input class="field" id="crName" value="' + attr(CR.C.name || '') + '" placeholder="Escribe su nombre" autocomplete="off"></div>';
    if (CD.cls) h += '<div class="ch"><div class="ch-h"><h3>Resumen</h3></div><div class="summary">' + [['Clase', CD.multi ? CD.clsLabel : CD.cls.name + ' ' + CD.level], ['Subclase', CD.sub ? CD.sub.name : '—'], ['Especie', CD.race ? CD.race.name : '—'], ['Trasfondo', CD.bg ? CD.bg.name : '—'], ['PG', CD.hp.max], ['Competencia', sgn(CD.pb)]].concat(R.ABS.map(function(k){ return [R.ABL[k], CD.abil[k] + ' (' + sgn(CD.mod[k]) + ')']; })).map(function(x){ return '<div><small>' + x[0] + '</small><b>' + esc(x[1]) + '</b></div>'; }).join('') + '</div></div>';
    var pend = CD.choices.filter(function(c){ return !c.done; });
    h += '<div class="ch"><div class="ch-h"><h3>Pendientes</h3><span class="st ' + (pend.length ? 'todo">' + pend.length : 'ok">Nada') + '</span></div>' + (pend.length ? '<p class="help">Puedes guardar así y completarlas después.</p>' + pend.map(function(c){ return '<div class="pend"><span>' + esc(c.title) + '</span><button class="btn sm" type="button" data-act="crgo" data-step="' + c.step + '" data-c="' + attr(c.id) + '">Ir</button></div>'; }).join('') : '<p class="help">Todo está elegido.</p>') + '</div>';
    return h;
  }
  function saveCreator(){
    var C = CR.C, D2 = R.derive(C);
    if (!D2.cls) { CR.step = 'clase'; renderCreator(); return; }
    if (!C.name) { C.name = D2.cls.name + ' sin nombre'; }
    if (CR.isNew) {
      C.id = 'c' + Date.now().toString(36);
      var r = rt(C); r.items = []; S.chars.push(C); S.active = C.id;
      giveStartingItems(C, D2);
      r.hp = null;
    } else {
      var i = S.chars.findIndex(function(x){ return x.id === C.id; });
      var old = S.chars[i]; C.rt = old.rt; S.chars[i] = C;
    }
    closeCreator(); save(); render(false);
  }
  function giveStartingItems(C, D2){
    var st = R.startingItems(C, D2), r = rt(C), prevActive = S.active;
    S.active = C.id; r.inv2 = true;
    r.coins.gp = (r.coins.gp || 0) + st.gold;
    /* desempacar los paquetes (Explorer's Pack, etc.) en sus objetos */
    var list = [];
    st.items.forEach(function(x){
      if (x.e && x.e.packContents) {
        x.e.packContents.forEach(function(pc){
          var ref = typeof pc === 'string' ? pc : pc.item, q = typeof pc === 'object' && pc.quantity || 1;
          if (!ref) { if (pc.special) list.push({name:pc.special, q:q}); return; }
          var p = Lib5e.parseRef(ref, 'phb'), f = Lib5e.find('item', p.name, p.source);
          list.push(f ? {e:f.e, ref:f.type + '|' + f.e.name + '|' + f.e.source, name:f.e.name, q:q} : {name:p.name, q:q});
        });
      } else list.push(x);
    });
    list.sort(function(a, b){ return (b.e && boxFor(b.e) ? 1 : 0) - (a.e && boxFor(a.e) ? 1 : 0); });
    list.forEach(function(x){
      var it;
      if (x.e) it = newItem(x.ref.split('|')[0], x.e, x.q);
      else it = {id:'i' + Math.random().toString(36).slice(2, 8), n:x.name, k:'', ic:'i-bag', w:1, h:1, d:'Equipo inicial', q: x.q > 1 ? x.q : undefined};
      var t = x.e ? (x.e.type || '').split('|')[0] : '';
      if (it.slot === 'back' && !r.items.some(function(o){ return o.eq === 'back'; })) it.eq = 'back';
      else if (/^(LA|MA|HA)$/.test(t) && !r.items.some(function(o){ return o.eq === 'armor'; })) it.eq = 'armor';
      else if (t === 'S' && !r.items.some(function(o){ return o.eq === 'off'; })) it.eq = 'off';
      else if ((t === 'M' || t === 'R') && !r.items.some(function(o){ return o.eq === 'main'; })) it.eq = 'main';
      if (it.eq) { r.items.push(it); if (it.eq === 'back') r.openBox = it.id; return; }
      r.items.push(it);
      if (!stash(it)) r.items.pop();
    });
    S.active = prevActive;
  }

  /* ---------- Selector emergente ---------- */
  var PK = null;
  function openPicker(cid, cobj){
    var c = cobj || CD.choices.filter(function(x){ return x.id === cid; })[0]; if (!c) return;
    var rows;
    if (c.kind === 'spells') {
      var list = R.spellsMatching(c.filter, c.list, {minLevel:c.minLevel, maxLevel:c.maxLevel});
      (c.extra || []).forEach(function(e){ if (list.indexOf(e) < 0) list.push(e); });
      var have = {}; CD.extraSpells.forEach(function(x){ have[x.e.name + '|' + x.e.source] = 1; });
      rows = list.map(function(e){ var k = e.name + '|' + e.source; return {v:k, label:e.name, sub:(e.level ? 'Nivel ' + e.level : 'Truco') + ' · ' + e.source, lvl:e.level, taken: !!have[k], detail:{type:'spell', ref:k}}; });
    } else rows = c.options;
    PK = {c:c, rows:rows, sel: c.kind === 'one' ? c.value : (c.value || []).slice(), q:'', lvl:'*', showOld:false, hideNo:false, open:{}};
    pickerUI();
  }
  function pickerUI(){
    var c = PK.c, rows = PK.rows;
    $('#pkTitle').textContent = c.title;
    var lv = {}; rows.forEach(function(r){ if (r.lvl != null) lv[r.lvl] = 1; });
    var f = '<input class="field" id="pkQ" type="search" placeholder="Buscar…" aria-label="Buscar" autocomplete="off">';
    if (Object.keys(lv).length > 1) f += '<select class="field" id="pkLvl" aria-label="Nivel" style="flex:0 1 160px"><option value="*">Todos los niveles</option>' + Object.keys(lv).sort(function(a, b){ return a - b; }).map(function(l){ return '<option value="' + l + '">' + (+l ? 'Nivel ' + l : 'Trucos') + '</option>'; }).join('') + '</select>';
    if (rows.some(function(r){ return r.old; })) f += '<label class="toggle"><input type="checkbox" id="pkOld"> Mostrar versiones 2014 reemplazadas</label>';
    if (rows.some(function(r){ return r.st === 'no'; })) f += '<label class="toggle"><input type="checkbox" id="pkNo"> Ocultar las que no cumplo</label>';
    $('#pkFilters').innerHTML = f;
    $('#picker').hidden = false;
    $('#pkQ').value = PK.q; if ($('#pkLvl')) $('#pkLvl').value = PK.lvl; if ($('#pkOld')) $('#pkOld').checked = PK.showOld; if ($('#pkNo')) $('#pkNo').checked = PK.hideNo;
    $('#pkQ').addEventListener('input', function(){ PK.q = this.value; renderPicker(); });
    if ($('#pkLvl')) $('#pkLvl').addEventListener('change', function(){ PK.lvl = this.value; renderPicker(); });
    if ($('#pkOld')) $('#pkOld').addEventListener('change', function(){ PK.showOld = this.checked; renderPicker(); });
    if ($('#pkNo')) $('#pkNo').addEventListener('change', function(){ PK.hideNo = this.checked; renderPicker(); });
    renderPicker();
    if (!wide()) $('#pkQ').blur(); else $('#pkQ').focus();
  }
  function renderPicker(){
    var c = PK.c, q = PK.q.trim().toLowerCase(), multi = c.kind !== 'one';
    var list = PK.rows.filter(function(r){ if (r.old && !PK.showOld && r.v !== PK.sel && (!multi || PK.sel.indexOf(r.v) < 0)) return false; if (PK.hideNo && r.st === 'no') return false; if (q && r.label.toLowerCase().indexOf(q) < 0) return false; if (PK.lvl !== '*' && String(r.lvl) !== PK.lvl) return false; return true; });
    var n = multi ? PK.sel.length : (PK.sel ? 1 : 0);
    $('#pkCount').textContent = multi ? n + ' / ' + c.count : '';
    var shown = list.slice(0, 250);
    $('#pkList').innerHTML = (shown.length ? shown.map(function(r){
      var on = multi ? PK.sel.indexOf(r.v) >= 0 : PK.sel === r.v, full = multi && !on && n >= c.count, dis = r.taken && c.kind === 'spells';
      var flags = (r.st === 'no' ? ' <span class="flag no">No cumples</span>' : r.st === 'dm' ? ' <span class="flag dm">Decide el DM</span>' : '') + (r.taken ? ' <span class="flag taken">Ya lo tienes</span>' : '');
      return '<div class="prow' + (full || dis ? ' dis' : '') + '" aria-checked="' + on + '"><div class="top"><button type="button" class="sel" data-act="pksel" data-v="' + attr(r.v) + '"' + (full || dis ? ' aria-disabled="true"' : '') + '><span class="radio' + (multi ? ' box' : '') + '"></span><span class="nm"><b>' + esc(r.label) + '</b><small>' + esc(r.sub || '') + flags + '</small>' + (r.req ? '<small>' + esc(r.req) + '</small>' : '') + '</span></button>' + (r.detail ? '<button type="button" class="more" data-act="pkmore" data-v="' + attr(r.v) + '" aria-expanded="' + !!PK.open[r.v] + '" aria-label="Ver qué incluye ' + attr(r.label) + '"><svg class="ic" style="transform:rotate(' + (PK.open[r.v] ? '90' : '-90') + 'deg)"><use href="#i-back"/></svg></button>' : '') + '</div><div class="det gtext"' + (PK.open[r.v] ? '' : ' hidden') + '>' + (PK.open[r.v] ? trWrap(detailHtml(r.detail), 'd|' + JSON.stringify(r.detail)) : '') + '</div></div>';
    }).join('') : '<p class="empty-state">Nada coincide con la búsqueda.</p>') + (list.length > 250 ? '<p class="note">Se muestran 250 de ' + list.length + '. Escribe para afinar.</p>' : '');
    trInit($('#pkList'));
  }
  function pickerSelect(v){
    var c = PK.c;
    if (c.kind === 'one') { PK.sel = v; $('#picker').hidden = true; var id = c.id; PK = null; setChoice(id, v); return; }
    var row = PK.rows.filter(function(r){ return r.v === v; })[0]; if (row && row.taken && c.kind === 'spells') return;
    var i = PK.sel.indexOf(v);
    if (i >= 0) PK.sel.splice(i, 1); else if (PK.sel.length < c.count) PK.sel.push(v);
    renderPicker();
  }
  function pickerDone(){ if (!PK) { $('#picker').hidden = true; return; } var c = PK.c, v = PK.sel; $('#picker').hidden = true; PK = null; if (c.kind !== 'one') setChoice(c.id, v.slice()); }
  function showRefInPicker(f){
    var d = Render5e.detail(f.type, f.e);
    PK = PK || null;
    var box = document.createElement('div');
    $('#pkTitle').textContent = f.e.name; $('#pkCount').textContent = ''; $('#pkFilters').innerHTML = '<button class="btn sm" type="button" data-act="pkrefback">Volver</button>';
    $('#pkList').innerHTML = '<div class="gtext">' + (d.meta.length ? '<dl class="gmeta">' + d.meta.map(function(r){ return '<dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>' : '') + d.body + '</div>';
    $('#picker').hidden = false;
  }

  /* ==================== BIBLIOTECA ==================== */
  function idb(){ return new Promise(function(res, rej){ try { var r = indexedDB.open('diario5e', 2); r.onupgradeneeded = function(){ if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); }; r.onsuccess = function(){ res(r.result); }; r.onerror = function(){ rej(r.error); }; } catch(e){ rej(e); } }); }
  function idbGet(k){ return idb().then(function(db){ return new Promise(function(res){ var q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = function(){ res(q.result); }; q.onerror = function(){ res(null); }; }); }).catch(function(){ return null; }); }
  function idbSet(k, v){ return idb().then(function(db){ return new Promise(function(res){ var t = db.transaction('kv','readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = function(){ res(true); }; t.onerror = function(){ res(false); }; }); }).catch(function(){ return false; }); }
  function idbDel(k){ return idb().then(function(db){ return new Promise(function(res){ var t = db.transaction('kv','readwrite'); t.objectStore('kv').delete(k); t.oncomplete = function(){ res(true); }; }); }).catch(function(){ return false; }); }
  var LABELS = {variantrule:'Reglas', action:'Acciones', condition:'Condiciones', spell:'Conjuros', item:'Objetos mágicos y equipo', baseitem:'Armas y armaduras básicas', feat:'Dotes', race:'Especies', background:'Trasfondos', 'class':'Clases', subclass:'Subclases', classFeature:'Rasgos de clase', subclassFeature:'Rasgos de subclase', optionalfeature:'Opciones (invocaciones, maniobras…)', monster:'Compañeros (invocaciones y familiares)'};
  function libTable(){
    var c = Lib5e.counts();
    $('#libTable').innerHTML = Lib5e.has() ? Object.keys(LABELS).filter(function(k){ return c[k]; }).map(function(k){ return '<tr><td>'+LABELS[k]+'</td><td>'+c[k]+'</td></tr>'; }).join('') : '<tr><td colspan="2" class="muted">Todavía no hay datos cargados.</td></tr>';
    $('#clearLib').hidden = !Lib5e.has();
  }
  function readText(file){ return new Promise(function(res){ var r = new FileReader(); r.onload = function(){ res(r.result); }; r.onerror = function(){ res(null); }; r.readAsText(file); }); }
  function mb(n){ return (n / 1048576).toFixed(1).replace('.', ',') + ' MB'; }
  function importFiles(fileList, fromDir){
    var all = Array.prototype.slice.call(fileList || []), prog = $('#libProgress');
    if (!all.length) { prog.textContent = 'No llegó ningún archivo. Vuelve a tocar y elige diario-5e.json.'; return; }
    /* En el teléfono el nombre o el tipo del archivo pueden cambiar (diario-5e.json.txt, sin extensión…): se revisa el contenido */
    var files = all.filter(function(f){ var p = (f.webkitRelativePath || f.name || '').replace(/\\/g, '/'); if (fromDir) return Lib5e.WANT.test(p); return !/^(fluff-|foundry)/.test(f.name || '') && !/\.(png|jpe?g|webp|gif|mp3|mp4|pdf)$/i.test(f.name || ''); });
    if (!files.length) { prog.textContent = fromDir ? 'No encontré archivos de 5etools ahí. Elige la carpeta "data" de tu copia.' : 'Ese archivo no sirve. Elige diario-5e.json.'; return; }
    var lib = Lib5e.empty(), done = 0, used = 0, skipped = [], bad = [], chain = Promise.resolve();
    prog.textContent = files.length === 1 ? 'Leyendo ' + (files[0].name || 'archivo') + ' (' + mb(files[0].size || 0) + ')…' : 'Leyendo 0 de ' + files.length + ' archivos…';
    files.forEach(function(f){
      chain = chain.then(function(){ return readText(f); }).then(function(txt){
        done++; if (files.length > 1) prog.textContent = 'Leyendo ' + done + ' de ' + files.length + ' archivos…'; else prog.textContent = 'Revisando ' + (f.name || 'archivo') + '…';
        if (txt == null) { bad.push(f.name); return; }
        txt = String(txt).replace(/^\uFEFF/, '');
        var json; try { json = JSON.parse(txt); } catch(e){ bad.push(f.name); return; }
        try { var n = Lib5e.ingest(lib, json, f.webkitRelativePath || f.name); if (n) used++; else skipped.push(f.name); } catch(e){ bad.push(f.name); }
      });
    });
    chain.then(function(){
      if (!used) { prog.textContent = bad.length ? 'No pude leer ' + (bad.length === 1 ? '“' + bad[0] + '”' : bad.length + ' archivos') + ': no es un JSON completo. Si lo pasaste por WhatsApp o Drive, descárgalo de nuevo; a veces llega cortado o como vista previa.' : 'El archivo se leyó, pero no trae datos del diario. Elige diario-5e.json.'; return false; }
      Lib5e.set(lib);
      prog.textContent = (used > 1 ? 'Listo: se usaron ' + used + ' archivos' : 'Listo: se cargó ' + (files.length === 1 ? 'el paquete' : '1 archivo')) + (skipped.length + bad.length ? '; ' + (skipped.length + bad.length) + ' no traían datos que el diario use.' : '.') + ' Guardando en este dispositivo…';
      return idbSet('lib', lib).then(function(ok){ prog.textContent = prog.textContent.replace('Guardando en este dispositivo…', ok ? 'Guardado en este dispositivo.' : 'No se pudo guardar; tendrás que cargarlo de nuevo la próxima vez.'); return true; });
    }).then(function(ok){ if (ok) afterLib(); }).catch(function(e){ prog.textContent = 'El teléfono se quedó sin memoria al leerlo (' + (e && e.message || 'error') + '). Cierra otras apps e inténtalo otra vez.'; });
  }
  function afterLib(){ libReady = true; setTimeout(function(){ if (window.Sala) Sala.resume(); }, 0); if (Lib5e.has() && !S.chars.length) { var s = sampleChar(); S.chars.push(s); S.active = s.id; } libTable(); render(false); renderGrim(); }
  $('#fileIn').addEventListener('change', function(){ importFiles(this.files, false); this.value = ''; });
  $('#dirIn').addEventListener('change', function(){ importFiles(this.files, true); this.value = ''; });
  $('#fileIn').addEventListener('click', function(){ $('#libProgress').textContent = 'Elige el archivo diario-5e.json…'; });

  /* ---------- Personajes ---------- */
  var pendingDel = null;
  function renderChars(){
    var box = $('#charList'); if (!box) return;
    if (!S.chars.length) { box.innerHTML = '<p class="note" style="margin-top:6px">Aún no hay personajes.</p>'; return; }
    box.innerHTML = S.chars.map(function(c){
      var d = c.id === S.active && D && D.ok ? D : null, sub = (c.ch.cls || '').split('|')[0] + ' · nivel ' + c.level;
      if (pendingDel === c.id) return '<div class="line"><b>¿Borrar a ' + esc(c.name || 'este personaje') + '?</b><button class="btn main sm" type="button" data-act="delyes" data-id="' + c.id + '">Sí, borrar</button><button class="btn sm" type="button" data-act="delno">No</button></div>';
      return '<div class="line"><b>' + esc(c.name || 'Sin nombre') + '<small>' + esc(sub) + (c.id === S.active ? ' · activo' : '') + '</small></b>' + (c.id !== S.active ? '<button class="btn sm" type="button" data-act="usechar" data-id="' + c.id + '">Usar</button>' : '') + '<button class="btn sm" type="button" data-act="editchar" data-id="' + c.id + '">Editar</button><button class="icon-btn" type="button" data-act="delchar" data-id="' + c.id + '" aria-label="Borrar ' + attr(c.name || 'personaje') + '"><svg class="ic"><use href="#i-x"/></svg></button></div>';
    }).join('');
  }

  /* ---------- Exportar e importar personajes ---------- */
  function exportChars(){
    var data = JSON.stringify({diario:'personajes', v:4, exportado:new Date().toISOString(), chars:S.chars, homebrew:S.homebrew || []});
    var msg = $('#charMsg'), ta = $('#charText'), n = S.chars.length, what = n + ' personaje' + (n === 1 ? '' : 's');
    ta.hidden = false; ta.value = data;
    /* Dentro de claude.ai la descarga pasa por la capacidad "downloads" (el visor pide confirmación) */
    if (window.claude && window.claude.use) {
      msg.textContent = 'Preparando la descarga…';
      window.claude.use('downloads').then(function(dl){
        if (!dl) throw {code:'unavailable'};
        return dl.save({filename:'personajes-diario.json', data:new Blob([data], {type:'application/json'})}).then(function(){ msg.textContent = 'Listo: guardaste personajes-diario.json con ' + what + '.'; });
      }).catch(function(e){ msg.textContent = e && e.code === 'declined' ? 'Cancelaste la descarga. Puedes copiar el texto de abajo.' : 'Aquí no se puede descargar; copia el texto de abajo y guárdalo en un archivo .json.'; });
      return;
    }
    try {
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], {type:'application/json'})); a.download = 'personajes-diario.json';
      document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      msg.textContent = 'Listo: se descargó personajes-diario.json con ' + what + '. Si no ves la descarga, copia el texto de abajo.';
    } catch(e){ msg.textContent = 'No pude descargar el archivo aquí; copia el texto de abajo.'; }
    if (navigator.clipboard) navigator.clipboard.writeText(data).then(function(){ msg.textContent += ' También quedó copiado.'; }, function(){});
  }
  function importChars(txt){
    var msg = $('#charMsg'), j;
    try { j = JSON.parse(String(txt).replace(/^\uFEFF/, '')); } catch(e){ msg.textContent = 'Eso no es un archivo de personajes del diario.'; return; }
    var list = Array.isArray(j) ? j : j && Array.isArray(j.chars) ? j.chars : j && j.ch && j.base ? [j] : null;
    if (!list || !list.length) { msg.textContent = 'El archivo no trae personajes.'; return; }
    var added = 0, updated = 0;
    list.forEach(function(c){
      if (!c || !c.ch || !c.ch.cls) return;
      var i = S.chars.findIndex(function(x){ return x.id === c.id; });
      if (i >= 0) { S.chars[i] = c; updated++; } else { if (!c.id) c.id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); S.chars.push(c); added++; }
    });
    (j.homebrew || []).forEach(function(h){ S.homebrew = S.homebrew || []; if (!S.homebrew.some(function(x){ return x.name === h.name; })) S.homebrew.push(h); });
    if (!S.active && S.chars[0]) S.active = S.chars[0].id;
    msg.textContent = added || updated ? 'Importados: ' + added + ' nuevo' + (added === 1 ? '' : 's') + (updated ? ', ' + updated + ' actualizado' + (updated === 1 ? '' : 's') : '') + '.' : 'No encontré personajes válidos.';
    save(); render(false);
  }
  $('#charIn').addEventListener('change', function(){ var f = this.files && this.files[0]; this.value = ''; if (!f) return; readText(f).then(importChars); });
  document.addEventListener('change', function(ev){ if (ev.target.id === 'charText' && ev.target.value.trim().charAt(0) === '{' && ev.target.dataset.paste) importChars(ev.target.value); });

  /* ---------- Hojas ---------- */
  function openSheet(id){ $$('.sheet').forEach(function(s){ s.hidden = s.id !== id; }); var s = $('#' + id); var f = s.querySelector('input,button'); if (f) f.focus({preventScroll:true}); }
  function openSettings(){ if (window.Sala) Sala.settings(); $('#dirPick').hidden = !wide(); $('#dirPick').parentNode.style.gridTemplateColumns = wide() ? '' : '1fr'; libTable(); renderChars(); trSettings(); openSheet('settingsSheet'); }
  function closeSheets(){ $$('.sheet').forEach(function(s){ s.hidden = true; }); }

  /* ---------- Libro ---------- */
  var busy = false;
  function openBook(){
    if (busy || cover.hidden) return; busy = true;
    var cl = cover.querySelector('.clasp'), f = fxLayer.getBoundingClientRect(), r = cl.getBoundingClientRect();
    sparkBurst(r.left - f.left + r.width / 2, r.top - f.top + r.height / 2, 26, {spread:110});
    cover.classList.remove('dragging'); cover.style.transform = ''; veil.style.opacity = '';
    book.classList.add('opening');
    setTimeout(function(){
      cover.hidden = true; veil.hidden = true; busy = false;
      var pg = $('#pageRight'); pg.classList.remove('glowpage'); void pg.offsetWidth; pg.classList.add('glowpage');
      var pr = pg.getBoundingClientRect(), f2 = fxLayer.getBoundingClientRect();
      sparkBurst(pr.left - f2.left + pr.width / 2, pr.top - f2.top + 60, 18, {spread:140, up:false});
    }, reduce ? 0 : 1300);
  }
  /* Abrir deslizando la tapa */
  var sw = null;
  cover.addEventListener('pointerdown', function(ev){
    if (busy || ev.target.closest('button')) return;
    sw = {x:ev.clientX, y:ev.clientY, w:cover.getBoundingClientRect().width, p:0, on:false};
    try { cover.setPointerCapture(ev.pointerId); } catch(e){}
  });
  cover.addEventListener('pointermove', function(ev){
    if (!sw) return;
    var dx = ev.clientX - sw.x, dy = ev.clientY - sw.y;
    if (!sw.on) { if (Math.abs(dx) < 8 || Math.abs(dy) > Math.abs(dx)) return; sw.on = true; cover.classList.add('dragging'); }
    sw.p = Math.max(0, Math.min(1, -dx / sw.w));
    var max = wide() ? 180 : 115;
    cover.style.transform = 'perspective(' + (wide() ? 2400 : 1600) + 'px) rotateY(' + (-sw.p * max) + 'deg)';
    if (wide()) veil.style.opacity = String(1 - sw.p);
  });
  function endSwipe(){
    if (!sw) return; var s0 = sw; sw = null;
    if (!s0.on) return;
    if (s0.p > .3) openBook();
    else { cover.classList.remove('dragging'); cover.style.transform = ''; veil.style.opacity = ''; }
  }
  cover.addEventListener('pointerup', endSwipe);
  cover.addEventListener('pointercancel', endSwipe);
  function closeBook(){ if (busy) return; busy = true; closeSheets(); $('#combat').hidden = true; cover.hidden = false; veil.hidden = false; void cover.offsetWidth; requestAnimationFrame(function(){ book.classList.remove('opening'); }); setTimeout(function(){ busy = false; }, reduce ? 0 : 1300); }

  /* ---------- Gasto de rombos ---------- */
  function setUsed(key, used){
    var r = rt(cur());
    if (key === 'pact') r.pactUsed = used;
    else if (key.indexOf('slot:') === 0) r.slotsUsed[+key.slice(5)] = used;
    else if (key.indexOf('res:') === 0) r.res[key.slice(4)] = used;
  }

  /* ---------- Clics ---------- */
  document.addEventListener('click', function(ev){
    var rl = ev.target.closest('a.ref');
    if (rl) { ev.preventDefault(); openRef(rl.dataset.ref); return; }
    var it = ev.target.closest('.it');
    if (it && grid.contains(it)) { select(it.dataset.id); return; }
    var b = ev.target.closest('[data-act]'); if (!b) return;
    var a = b.dataset.act, C = cur(), r = C ? rt(C) : null;
    switch (a) {
      case 'open': openBook(); break;
      case 'close': closeBook(); break;
      case 'tab': closeSheets(); S.tab = b.dataset.tab; if (S.tab === 'grimorio') G.from = null; render(true); renderGrim(); $('#scroll').scrollTop = 0; if (S.tab === 'grimorio' || S.tab === 'equipo') fxAt(null, 10, b); break;
      case 'left': S.left = b.dataset.v; if (S.left !== 'personaje') { G.sec = S.left; G.view = null; G.hist = []; G.q = ''; G.sub = '*'; } render(true); renderGrim(); break;
      case 'gsec': G.sec = b.dataset.v; G.view = null; G.hist = []; G.q = ''; G.sub = '*'; renderGrim(); break;
      case 'gopen': openRef(b.dataset.ref); break;
      case 'trgo': trGo(b.closest('.trwrap')); break;
      case 'trorig': S.trPref = 'orig'; save(); trShow(b.closest('.trwrap'), 'orig'); break;
      case 'trshow': S.trPref = 'tr'; save(); trShow(b.closest('.trwrap'), 'tr'); break;
      case 'trmode': S.trMode = b.dataset.v; save(); trSettings(); render(false); renderGrim(); break;
      case 'trclear': TRmem = {}; idb().then(function(db){ var t = db.transaction('kv','readwrite'), st = t.objectStore('kv'); st.openCursor().onsuccess = function(ev){ var c = ev.target.result; if (!c) return; if (String(c.key).indexOf('tr:') === 0) c.delete(); c.continue(); }; }).catch(function(){}); b.textContent = 'Traducciones borradas'; break;
      case 'gmode': G.mode = b.dataset.v; renderGrim(); break;
      case 'gsort': G.sort = G.sort && G.sort.k === b.dataset.k ? {k:b.dataset.k, dir:-G.sort.dir} : {k:b.dataset.k, dir:1}; renderGrim(); break;
      case 'spsort': S.spSort = S.spSort && S.spSort.k === b.dataset.k ? {k:b.dataset.k, dir:-S.spSort.dir} : {k:b.dataset.k, dir:1}; save(); render(false); break;
      case 'spview': S.spView = b.dataset.v; save(); render(false); break;
      case 'gback': grimBack(); break;
      case 'additem': var ok = addItemFromLib(G.view.type, G.view.e), ge = $('#gerr'); ge.hidden = false; ge.style.color = ok ? 'var(--ok-ink)' : ''; ge.textContent = ok ? 'Añadido a tu mochila.' : 'No cabe en la mochila. Acomoda o tira algo primero.'; break;
      case 'finditems': G.sec = 'objetos'; G.view = null; G.hist = []; G.q = ''; G.sub = '*'; if (wide()) S.left = 'objetos'; else { G.from = null; S.tab = 'grimorio'; } render(true); renderGrim(); break;
      case 'settings': openSettings(); break;
      case 'closesheet': closeSheets(); break;
      case 'skin': S.skin = b.dataset.v; applySkin(); save(); break;
      case 'clearlib': idbDel('lib'); Lib5e.set(Lib5e.empty()); G.view = null; $('#libProgress').textContent = 'Datos quitados de este dispositivo.'; libTable(); render(false); renderGrim(); break;
      case 'newchar': if (!Lib5e.has()) { openSettings(); break; } openCreator(null, true, 'clase'); break;
      case 'levelup': if (C && Lib5e.has()) openCreator(C, false, b.dataset.step || 'niveles'); else if (Lib5e.has()) openCreator(null, true); else openSettings(); break;
      case 'usechar': S.active = b.dataset.id; sel = null; render(false); break;
      case 'editchar': var ec = S.chars.filter(function(x){ return x.id === b.dataset.id; })[0]; if (ec) openCreator(ec, false, 'clase'); break;
      case 'charexport': exportChars(); break;
      case 'delchar': pendingDel = b.dataset.id; renderChars(); break;
      case 'delno': pendingDel = null; renderChars(); break;
      case 'delyes': S.chars = S.chars.filter(function(x){ return x.id !== b.dataset.id; }); if (S.active === b.dataset.id) S.active = S.chars[0] ? S.chars[0].id : null; pendingDel = null; render(false); break;
      case 'selslot': select(b.dataset.id); break;
      case 'hbnew': if (!cur()) { openSettings(); break; } openHb(null); break;
      case 'hbedit': var hi = itemById(sel); if (hi && hi.hb) openHb(hi); break;
      case 'hbadd': var tpl = S.homebrew[+b.dataset.i]; if (tpl) { var e3 = hbPlace(JSON.parse(JSON.stringify(tpl)), false); if (e3) { var he = $('#hbErr'); he.textContent = e3; he.hidden = false; } else { closeSheets(); invChanged(); } } break;
      case 'hbdel': S.homebrew.splice(+b.dataset.i, 1); save(); openHb(null); break;
      case 'rotate': rotate(); break;
      case 'equip': equip(); break;
      case 'unequip': unequip(); break;
      case 'use': useItem(); break;
      case 'drop': pendingDrop = sel; renderInfo(); break;
      case 'dropyes': var gone = [pendingDrop].concat(descendants(pendingDrop).map(function(x){ return x.id; })); setItems(items().filter(function(o){ return gone.indexOf(o.id) < 0; })); pendingDrop = null; sel = null; invChanged(); break;
      case 'openbox': rt(C).openBox = b.dataset.id; moveMenu = false; save(); renderGrid(); fxAt(null, 8, $('#grid')); break;
      case 'movemenu': moveMenu = true; renderInfo(); break;
      case 'movecancel': moveMenu = false; renderInfo(); break;
      case 'moveto': moveTo(b.dataset.id); break;
      case 'dropno': pendingDrop = null; renderInfo(); break;
      case 'itemrule': var ci = itemById(sel); if (ci && ci.ref) openRef(ci.ref); break;
      case 'combat': closeSheets(); $('#combat').hidden = false; renderCombat(); break;
      case 'endcombat': $('#combat').hidden = true; break;
      case 'nextround': r.round += 1; r.econ = {a:false,b:false,r:false,m:false}; save(); renderCombat(); break;
      case 'hp': r.hp = Math.max(0, Math.min(D.hp.max, r.hp + (+b.dataset.v))); save(); renderCombat(); break;
      case 'econ': r.econ[b.dataset.k] = !r.econ[b.dataset.k]; save(); renderCombat(); break;
      case 'newturn': r.econ = {a:false,b:false,r:false,m:false}; save(); renderCombat(); break;
      case 'crit': r.crit = !r.crit; save(); renderCombat(); break;
      case 'smite': r.smite = +b.dataset.v; save(); renderCombat(); break;
      case 'endconc': r.conc = null; save(); renderCombat(); break;
      case 'condoff': r.conds = (r.conds || []).filter(function(k){ return k !== b.dataset.v; }); save(); renderCombat(); break;
      case 'pool': r.res[b.dataset.key] = Math.min((D.resources.filter(function(x){ return x.key === b.dataset.key; })[0] || {pool:0}).pool, (r.res[b.dataset.key] || 0) + (+b.dataset.v)); save(); renderCombat(); break;
      case 'pip': var max = +b.dataset.max, i = +b.dataset.i, k = b.dataset.key, used0 = k === 'pact' ? r.pactUsed || 0 : k.indexOf('slot:') === 0 ? r.slotsUsed[+k.slice(5)] || 0 : r.res[k.slice(4)] || 0, avail = max - used0, next = i < avail ? i : i + 1; setUsed(k, max - next); save(); render(false); break;
      case 'short': r.pactUsed = 0; ['channel divinity','second wind','focus points','ki points','superiority dice','wild shape'].forEach(function(kk){ if (r.res[kk]) r.res[kk] = kk === 'channel divinity' || kk === 'second wind' || kk === 'wild shape' ? Math.max(0, r.res[kk] - 1) : 0; }); save(); render(false); break;
      case 'long': r.hp = D.hp.max; r.temp = 0; r.slotsUsed = []; r.pactUsed = 0; r.res = {}; r.conc = null; r.econ = {a:false,b:false,r:false,m:false}; r.round = 1; save(); render(false); break;
      /* creador */
      case 'crclose': closeCreator(); break;
      case 'crstep': CR.step = b.dataset.v; renderCreator(); $('#crBody').scrollTop = 0; break;
      case 'crprev': var si = R.STEPS.findIndex(function(s){ return s[0] === CR.step; }); if (si > 0) { CR.step = R.STEPS[si - 1][0]; renderCreator(); $('#crBody').scrollTop = 0; } break;
      case 'crnext': var sj = R.STEPS.findIndex(function(s){ return s[0] === CR.step; }); if (CR.step === 'listo') saveCreator(); else { CR.step = R.STEPS[sj + 1][0]; renderCreator(); $('#crBody').scrollTop = 0; } break;
      case 'crgo': CR.step = b.dataset.step; renderCreator(); var tgt = document.getElementById('ch-' + b.dataset.c); if (tgt) tgt.scrollIntoView({block:'center'}); break;
      case 'crup': crLevelUp(b.dataset.cls || CR.C.ch.cls); break;
      case 'fullspells': if (C) { C.house = C.house || {}; C.house.allSpells = b.checked; save(); render(false); } break;
      case 'crfull': CR.C.house = CR.C.house || {}; CR.C.house.allSpells = b.checked; renderCreator(); break;
      case 'mcadd': if (CD.pending.length) break; openPicker('_mcadd', mcAddChoice()); break;
      case 'compnew': openComp(); break;
      case 'compadd': compAdd(b.dataset.ref); break;
      case 'compdel': r.comp.splice(+b.dataset.i, 1); save(); render(false); break;
      case 'comphp': var cp = r.comp[+b.dataset.i], cst = compStats(cp); if (cst) { cp.hp = b.dataset.v === 'full' ? cst.hpMax : Math.max(0, Math.min(cst.hpMax, (cp.hp == null ? cst.hpMax : cp.hp) + (+b.dataset.v))); save(); render(false); } break;
      case 'crdown': var Lc = CD.level; if (Lc <= 1) break;
        CD.choices.filter(function(x){ return x.lv === Lc; }).forEach(function(x){ delete CR.C.ch[x.id]; }); delete CR.C.ch['hp:' + Lc];
        var sq = classSeq(CR.C), goneRef = sq.pop(); CR.C.cl = sq;
        if (sq.indexOf(goneRef) < 0) { var sfx = '@' + N(goneRef.split('|')[0]).replace(/\W+/g, ''); Object.keys(CR.C.ch).forEach(function(k){ if (k.indexOf(sfx) >= 0) delete CR.C.ch[k]; }); }
        CR.C.level = Lc - 1;
        R.derive(CR.C).choices.forEach(function(x){ if ((x.kind === 'many' || x.kind === 'spells') && Array.isArray(x.value) && x.value.length > x.count) CR.C.ch[x.id] = x.value.slice(0, x.count); });
        renderCreator(); $('#crBody').scrollTop = 0; break;
      case 'crlvl': CR.C.level = Math.max(1, Math.min(20, (CR.C.level || 1) + (+b.dataset.v))); renderCreator(); break;
      case 'crpick': var cc = CD.choices.filter(function(x){ return x.id === b.dataset.c; })[0]; if (!cc) break;
        if (b.dataset.multi) { var arr = (cc.value || []).slice(), ix = arr.indexOf(b.dataset.v); if (ix >= 0) arr.splice(ix, 1); else if (arr.length < cc.count) arr.push(b.dataset.v); setChoice(cc.id, arr); }
        else setChoice(cc.id, b.dataset.v); break;
      case 'cralt': setChoice(b.dataset.c, {alt:+b.dataset.v, picks:[]}); break;
      case 'crmethod': CR.C.method = b.dataset.v; CR.C.base = b.dataset.v === 'buy' ? {str:8,dex:8,con:8,int:8,wis:8,cha:8} : {}; renderCreator(); break;
      case 'crbuy': var bs = CR.C.base, kk2 = b.dataset.k, nv = (bs[kk2] || 8) + (+b.dataset.v); var spent = R.ABS.reduce(function(t, x){ return t + (PBCOST[x === kk2 ? nv : bs[x] || 8] || 0); }, 0); if (nv >= 8 && nv <= 15 && spent <= 27) { bs[kk2] = nv; renderCreator(); } break;
      case 'cradditems': var orig = S.chars.filter(function(x){ return x.id === CR.C.id; })[0]; if (orig) { giveStartingItems(orig, CD); save(); b.textContent = 'Añadido a la mochila'; b.disabled = true; } break;
      case 'pkopen': openPicker(b.dataset.c); break;
      case 'pksel': if (PK) pickerSelect(b.dataset.v); break;
      case 'pkmore': if (PK) { PK.open[b.dataset.v] = !PK.open[b.dataset.v]; renderPicker(); } break;
      case 'pkdone': pickerDone(); break;
      case 'pkclose': $('#picker').hidden = true; PK = null; break;
      case 'pkrefback': if (PK) pickerUI(); else $('#picker').hidden = true; break;
    }
  });
  document.addEventListener('change', function(ev){
    var t = ev.target;
    if (!CR) return;
    if (t.dataset.abil) { var c = CD.choices.filter(function(x){ return x.id === t.dataset.abil; })[0], v = JSON.parse(JSON.stringify(c.value || {alt:0, picks:[]})); v.picks = v.picks || []; v.picks[+t.dataset.i] = t.value || null; setChoice(c.id, v); }
    else if (t.dataset.score) { var n = parseInt(String(t.value).replace(/\D/g, ''), 10); if (n >= 3 && n <= 20) CR.C.base[t.dataset.score] = n; else delete CR.C.base[t.dataset.score]; renderCreator(); }
    else if (t.dataset.hp) { var lv = t.dataset.hp, hv = parseInt(String(t.value).replace(/\D/g, ''), 10); if (hv >= 1 && hv <= ((CD.hp.perLevel[lv - 1] || {}).faces || CD.hp.faces)) CR.C.ch['hp:' + lv] = hv; else delete CR.C.ch['hp:' + lv]; renderCreator(); }
  });
  document.addEventListener('input', function(ev){ if (ev.target.id === 'crName' && CR) { CR.C.name = ev.target.value; } });
  document.addEventListener('keydown', function(e){
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('tr[data-act="gopen"]')) { e.preventDefault(); openRef(e.target.dataset.ref); return; }
    if (e.key !== 'Escape') return;
    if (!$('#picker').hidden) { $('#picker').hidden = true; PK = null; return; }
    if (!$('#creator').hidden) return;
    if (!$('#combat').hidden && $$('.sheet').every(function(s){ return s.hidden; })) $('#combat').hidden = true;
    closeSheets();
  });
  var notes = $('#notes');
  notes.addEventListener('input', function(){ var C = cur(); if (C) { rt(C).notes = notes.value; save(); } });

  applySkin();
  if (mq.addEventListener) mq.addEventListener('change', layout); else mq.addListener(layout);
  layout();
  idbGet('lib').then(function(lib){ if (lib && lib.spell) Lib5e.set(lib); afterLib(); });
})();
