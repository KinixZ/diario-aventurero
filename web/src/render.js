/* ==================== TEXTO DE 5ETOOLS → HTML (sin DOM) ==================== */
var Render5e = (function(){
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function attr(s){ return esc(s).replace(/'/g, '&#39;'); }
  var DMG = {S:'cortante', P:'perforante', B:'contundente', A:'ácido', C:'frío', F:'fuego', O:'fuerza', L:'relámpago', N:'necrótico', I:'veneno', Y:'psíquico', R:'radiante', T:'trueno'};
  function tag(t, body){
    var p = body.split('|');
    if (t === 'dc') return 'CD ' + p[0];
    if (t === 'chance') return p[0] + '%';
    if (t === 'b' || t === 'bold') return '<b>' + p[0] + '</b>';
    if (t === 'i' || t === 'italic') return '<i>' + p[0] + '</i>';
    if (t === 'u' || t === 'underline') return '<u>' + p[0] + '</u>';
    if (t === 'dice' || t === 'damage' || t === 'd20' || t === 'autodice' || t === 'scaledice' || t === 'scaledamage') return p[t.indexOf('scale') === 0 ? 2 : 0] || p[0];
    if (t === 'hit') return (/^[-+]/.test(p[0]) ? '' : '+') + p[0];
    if (t === 'recharge') return '(Recarga ' + (p[0] || 6) + ')';
    if (t === 'atk' || t === 'atkr') { var A = {m:'cuerpo a cuerpo', r:'a distancia', mw:'con arma cuerpo a cuerpo', rw:'con arma a distancia', ms:'de conjuro cuerpo a cuerpo', rs:'de conjuro a distancia'}; return '<i>Ataque ' + p[0].split(',').map(function(x){ return A[x.trim()] || x; }).join(' o ') + ':</i>'; }
    var name = p[0], src = p[1] || '', disp = p[2] || p[0];
    if (t === 'itemProperty') { var f0 = Lib5e.find('itemProperty', name, src); disp = p[2] || (f0 && f0.e.entries && f0.e.entries[0] && f0.e.entries[0].name) || name; }
    if (t === 'quickref' || t === 'filter' || t === 'book' || t === 'table' || t === 'adventure' || t === 'creature' || t === 'deity' || t === 'subclass' || t === 'classFeature' || t === 'subclassFeature' || !Lib5e.canLink(t)) return '<span class="term">' + (t === 'filter' ? p[0] : disp) + '</span>';
    if (!Lib5e.find(t, name, src)) return '<span class="term">' + disp + '</span>';
    return '<a class="ref" data-ref="' + attr(t + '|' + name + '|' + src) + '">' + disp + '</a>';
  }
  function inline(s){
    var out = esc(s), prev;
    do { prev = out; out = out.replace(/\{@(\w+) ([^{}]*?)\}/g, function(_, t, b){ return tag(t, b); }); } while (out !== prev);
    out = out.replace(/\{@h\}/g, '<i>Impacto:</i> ').replace(/\{@actTrigger\}/g, '<i>Desencadenante:</i> ').replace(/\{@actResponse\}/g, '<i>Respuesta:</i> ');
    return out.replace(/\{@(\w+)\}/g, '');
  }
  function cell(c){
    if (c == null) return '';
    if (typeof c === 'string' || typeof c === 'number') return inline(String(c));
    if (c.roll) return c.roll.exact != null ? String(c.roll.exact) : (c.roll.min + '–' + c.roll.max);
    if (c.entry) return inline(c.entry);
    if (c.entries) return entries(c.entries);
    return '';
  }
  function entries(list){
    return (list || []).map(function(e){
      if (typeof e === 'string') return '<p>' + inline(e) + '</p>';
      if (!e || typeof e !== 'object') return '';
      switch (e.type) {
        case 'list': return '<ul>' + (e.items || []).map(function(i){
            if (typeof i === 'string') return '<li>' + inline(i) + '</li>';
            return '<li>' + (i.name ? '<b>' + inline(i.name) + '.</b> ' : '') + (i.entry ? inline(i.entry) : '') + (i.entries ? entries(i.entries).replace(/^<p>|<\/p>$/g, '') : '') + '</li>';
          }).join('') + '</ul>';
        case 'table': return '<div class="tbl"><table>' + (e.caption ? '<caption>' + inline(e.caption) + '</caption>' : '') + (e.colLabels ? '<tr>' + e.colLabels.map(function(c){ return '<th>' + inline(c) + '</th>'; }).join('') + '</tr>' : '') + (e.rows || []).map(function(r){ return '<tr>' + (Array.isArray(r) ? r : (r.row || [])).map(function(c){ return '<td>' + cell(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div>';
        case 'item': case 'itemSpell': return '<p>' + (e.name ? '<b>' + inline(e.name) + '.</b> ' : '') + (e.entry ? inline(e.entry) : '') + '</p>' + entries(e.entries);
        case 'inset': case 'insetReadaloud': case 'quote': return '<div class="inset">' + (e.name ? '<h4>' + inline(e.name) + '</h4>' : '') + entries(e.entries) + '</div>';
        case 'inline': case 'inlineBlock': return '<p>' + (e.entries || []).map(function(x){ return typeof x === 'string' ? inline(x) : entries([x]); }).join('') + '</p>';
        case 'abilityDc': return '<p><b>CD de salvación de conjuros</b> = 8 + bonificador de competencia + modificador de ' + (e.attributes || []).join('/') + '</p>';
        case 'abilityAttackMod': return '<p><b>Modificador de ataque de conjuros</b> = bonificador de competencia + modificador de ' + (e.attributes || []).join('/') + '</p>';
        case 'hr': return '<hr>';
        case 'refClassFeature': var cf = Lib5e.classFeature(e.classFeature); return cf ? '<h4>' + inline(cf.name) + '</h4>' + entries(cf.entries) : '';
        case 'refSubclassFeature': var sf = Lib5e.subclassFeature(e.subclassFeature); return sf ? '<h4>' + inline(sf.name) + '</h4>' + entries(sf.entries) : '';
        case 'refOptionalfeature': var of = Lib5e.optionalfeature(e.optionalfeature); return of ? '<div class="inset"><h4>' + inline(of.name) + '</h4>' + entries(of.entries) + '</div>' : '';
        case 'refFeat': var rp = Lib5e.parseRef(e.feat, 'phb'), ff = Lib5e.find('feat', rp.name, rp.source); return ff ? '<div class="inset"><h4>' + inline(ff.e.name) + '</h4>' + entries(ff.e.entries) + '</div>' : '';
        case 'options': return '<p class="note">Elige ' + (e.count || 1) + ':</p>' + entries(e.entries);
        case 'link': return '<span class="term">' + inline(e.text || '') + '</span>';
        default: return (e.name ? '<h4>' + inline(e.name) + '</h4>' : '') + (e.entry ? '<p>' + inline(e.entry) + '</p>' : '') + entries(e.entries || e.items);
      }
    }).join('');
  }
  /* Ficha de datos para cada tipo */
  var SCHOOL = {A:'Abjuración', C:'Conjuración', D:'Adivinación', E:'Encantamiento', V:'Evocación', I:'Ilusión', N:'Nigromancia', T:'Transmutación'};
  var UNIT = {action:'acción', bonus:'acción adicional', reaction:'reacción', minute:'min', hour:'h', round:'ronda', day:'día', turn:'turno'};
  function meters(ft){ var m = ft / 5 * 1.5; return (Math.round(m * 10) / 10 + '').replace('.', ',') + ' m'; }
  function dist(d){ if (!d) return ''; if (d.type === 'feet') return meters(d.amount); if (d.type === 'miles') return d.amount + ' mi'; return {self:'Propio', touch:'Toque', sight:'Vista', unlimited:'Ilimitado'}[d.type] || d.type; }
  function spellMeta(s){
    var rows = [];
    rows.push(['Nivel', (s.level === 0 ? 'Truco' : 'Nivel ' + s.level) + ' · ' + (SCHOOL[s.school] || s.school || '') + (s.meta && s.meta.ritual ? ' (ritual)' : '')]);
    rows.push(['Lanzamiento', (s.time || []).map(function(t){ return t.number + ' ' + (UNIT[t.unit] || t.unit) + (t.condition ? ', ' + inline(t.condition) : ''); }).join(' o ')]);
    var r = s.range || {}, rt = '';
    if (r.type === 'point') rt = dist(r.distance); else if (r.type === 'special') rt = 'Especial'; else rt = 'Propio (' + ({cone:'cono', cube:'cubo', line:'línea', radius:'radio', sphere:'esfera', emanation:'emanación', hemisphere:'hemisferio', cylinder:'cilindro'}[r.type] || r.type) + (r.distance ? ' de ' + dist(r.distance) : '') + ')';
    rows.push(['Alcance', rt]);
    var c = s.components || {}, ct = [];
    if (c.v) ct.push('V'); if (c.s) ct.push('S'); if (c.m) ct.push('M (' + esc(typeof c.m === 'string' ? c.m : c.m.text) + ')');
    rows.push(['Componentes', ct.join(', ')]);
    rows.push(['Duración', (s.duration || []).map(function(d){
      if (d.type === 'instant') return 'Instantánea';
      if (d.type === 'permanent') return 'Hasta que se disipe';
      if (d.type === 'special') return 'Especial';
      var t = d.duration ? d.duration.amount + ' ' + (UNIT[d.duration.type] || d.duration.type) : '';
      return d.concentration ? 'Concentración, hasta ' + t : t;
    }).join(' o ')]);
    var cls = Lib5e.spellClasses(s); if (cls.length) rows.push(['Clases', cls.join(', ')]);
    return rows;
  }
  var ITYPE = {M:'Arma cuerpo a cuerpo', R:'Arma a distancia', A:'Munición', LA:'Armadura ligera', MA:'Armadura media', HA:'Armadura pesada', S:'Escudo', P:'Poción', SC:'Pergamino', RG:'Anillo', RD:'Vara', WD:'Varita', ST:'Bastón', INS:'Instrumento', AT:'Herramientas de artesano', T:'Herramientas', GS:'Juego', G:'Equipo de aventura', SCF:'Canalizador mágico', FD:'Comida y bebida', TG:'Bienes comerciales', MNT:'Montura', VEH:'Vehículo', TAH:'Arreos', OTH:'Otro', EXP:'Explosivo', AF:'Munición', $C:'Moneda', $G:'Gema', $A:'Objeto de arte'};
  var RAR = {none:'', common:'Común', uncommon:'Poco común', rare:'Raro', 'very rare':'Muy raro', legendary:'Legendario', artifact:'Artefacto', varies:'Variable', unknown:'Desconocida', 'unknown (magic)':'Desconocida (mágico)'};
  function itemType(it){ var t = (it.type || '').split('|')[0]; if (ITYPE[t]) return ITYPE[t]; if (it.wondrous) return 'Objeto maravilloso'; if (it.weapon) return 'Arma'; if (it.armor) return 'Armadura'; return 'Objeto'; }
  function itemMeta(it){
    var rows = [['Tipo', itemType(it) + (RAR[it.rarity] ? ' · ' + RAR[it.rarity] : '')]];
    if (it.reqAttune) rows.push(['Sintonización', it.reqAttune === true ? 'Requiere sintonización' : 'Requiere sintonización ' + inline(it.reqAttune)]);
    if (it.dmg1) rows.push(['Daño', it.dmg1 + ' ' + (DMG[it.dmgType] || '') + (it.dmg2 ? ' (' + it.dmg2 + ' a dos manos)' : '')]);
    if (it.ac) rows.push(['CA', it.ac + (it.type && /^MA|^LA/.test(it.type) ? ' + mod. Des' + (/^MA/.test(it.type) ? ' (máx. 2)' : '') : '')]);
    if (it.property && it.property.length) rows.push(['Propiedades', it.property.map(function(p){ var a = (typeof p === 'string' ? p : p.uid || '').split('|'); return tag('itemProperty', a[0] + '|' + (a[1] || 'XPHB')); }).join(', ')]);
    if (it.mastery && it.mastery.length) rows.push(['Maestría', it.mastery.map(function(m){ var a = (typeof m === 'string' ? m : m.uid || '').split('|'); return tag('itemMastery', a[0] + '|' + (a[1] || 'XPHB')); }).join(', ')]);
    if (it.range) rows.push(['Alcance', esc(it.range) + ' pies']);
    if (it.weight) rows.push(['Peso', (it.weight + '').replace('.', ',') + ' lb']);
    if (it.value) rows.push(['Valor', it.value >= 100 ? (it.value / 100).toLocaleString('es-MX') + ' po' : it.value >= 10 ? (it.value / 10) + ' pp' : it.value + ' pc']);
    return rows;
  }
  function detail(type, e){
    var meta = [], body = '';
    if (type === 'spell') { meta = spellMeta(e); body = entries(e.entries) + entries(e.entriesHigherLevel); }
    else if (type === 'item' || type === 'baseitem') {
      meta = itemMeta(e); body = entries(e.entries);
      if (!e.entries && e.property) body = '<p class="note">Arma o armadura básica: revisa sus propiedades arriba.</p>';
    }
    else if (type === 'action') { if (e.time) meta = [['Tiempo', e.time.map(function(t){ return typeof t === 'string' ? t : t.number + ' ' + (UNIT[t.unit] || t.unit); }).join(' o ')]]; body = entries(e.entries); }
    else if (type === 'skill') { meta = [['Característica', {str:'Fuerza', dex:'Destreza', con:'Constitución', int:'Inteligencia', wis:'Sabiduría', cha:'Carisma'}[e.ability] || e.ability]]; body = entries(e.entries); }
    else if (type === 'itemProperty') { body = entries(e.entries); }
    else body = entries(e.entries);
    return {meta: meta.map(function(r){ return [r[0], r[1]]; }), body: body || '<p class="note">Sin texto en los datos.</p>'};
  }
  var UNIT_S = {action:'acción', bonus:'adicional', reaction:'reacción', minute:'min', hour:'h', round:'ronda', day:'día'};
  var AREA = {cone:'Cono', cube:'Cubo', line:'Línea', radius:'Radio', sphere:'Esfera', emanation:'Emanación', hemisphere:'Hemisferio', cylinder:'Cilindro'};
  function spellShort(e){
    var t = (e.time || [])[0] || {}, r = e.range || {};
    var rg = r.type === 'point' ? dist(r.distance) : r.type === 'special' ? 'Especial' : (AREA[r.type] || r.type || '') + (r.distance ? ' ' + dist(r.distance) : '');
    return {time: t.number ? t.number + ' ' + (UNIT_S[t.unit] || t.unit) : '', range: rg, school: SCHOOL[e.school] || e.school || '', conc: (e.duration || []).some(function(d){ return d.concentration; }), rit: !!(e.meta && e.meta.ritual)};
  }
  return {esc:esc, attr:attr, inline:inline, entries:entries, detail:detail, itemType:itemType, ITYPE:ITYPE, spellShort:spellShort, SCHOOL:SCHOOL};
})();

