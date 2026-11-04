/* ==================== HECHIZOS: LA DEFINICIÓN DE EFECTO DE CADA CONJURO ====================
   Lo usan el navegador (variable global Hechizos) y tools/hechizos.mjs (que escribe docs/HECHIZOS.md). Sale de los datos
   de 5etools (2014 y 2024) más unas pocas correcciones a mano, así que cubre todos los conjuros de golpe:
     area   {t, ft, w?}  esfera, cilindro, cubo, cono, línea, emanación (alrededor tuyo) o muro; tamaño en pies
     self   el área sale de ti (cono, línea, cubo, emanación) en lugar de un punto a distancia
     range  alcance en pies (0 = toque o tú mismo)
     atk    'melee' | 'ranged'     tirada de ataque de conjuro
     save   'dex', 'wis'…  y half (mitad si la supera)
     dmg    [{dice, type}]  daño base (los dados exactos para tu nivel y tu espacio los calcula la hoja)
     heal   cura · conds: estados que impone · repeat: se repite la salvación al final de cada turno
     conc   concentración · zone: se queda en el mapa ({on: ['enter','end','start'], terrain, obscure, follow, move})
     auto   'auto' si la app lo resuelve entero; 'asistido' si algo se hace a mano, con why (la lista de lo que falta) */
var Hechizos = (function(){
  var DMG = {acid:'ácido', bludgeoning:'contundente', cold:'frío', fire:'fuego', force:'fuerza', lightning:'relámpago', necrotic:'necrótico', piercing:'perforante', poison:'veneno', psychic:'psíquico', radiant:'radiante', slashing:'cortante', thunder:'trueno'};
  var SAVE = {strength:'str', dexterity:'dex', constitution:'con', intelligence:'int', wisdom:'wis', charisma:'cha'};
  var CONDS = ['blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'grappled', 'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious'];
  var AREA = {sphere:'sphere', radius:'sphere', circle:'sphere', hemisphere:'sphere', cylinder:'cylinder', cube:'cube', square:'cube', cone:'cone', line:'line', emanation:'emanation', wall:'wall'};
  var AREA_ES = {sphere:'esfera', cylinder:'cilindro', cube:'cubo', cone:'cono', line:'línea', emanation:'emanación', wall:'muro'};
  var WHY = {
    summon:'invoca criaturas: ponlas en el mapa y en la iniciativa',
    tp:'teletransporte: mueve tú la ficha',
    wall:'muro: se coloca como una línea; la forma de anillo va a mano',
    effect:'efecto sin tirada (se aplica a mano: bonificadores, sentidos, utilidad…)',
    area:'área especial: elige los objetivos a mano',
    perMove:'daño por cada 1,5 m recorridos: se aplica a mano al moverse',
    choose:'el daño o el efecto depende de una elección (tipo de daño, forma…)',
    shape:'cambia la forma o las estadísticas de una criatura',
    dice:'dados que suman o restan a otras tiradas (bendición, guía…)',
    reaction:'reacción: se usa fuera de tu turno, a mano'};
  // correcciones a mano (por nombre en minúsculas): lo que el texto no deja leer bien
  var FIX = {
    'magic missile': {note:'tres dardos que impactan solos; repártelos entre los objetivos'},
    'spike growth': {why:['perMove']},
    'sleep': {repeat:true},
    'web': {zone:{terrain:true, on:['enter', 'start']}, dmg:false},
    'grease': {zone:{terrain:true, on:['enter', 'end']}},
    'entangle': {zone:{terrain:true, on:[]}},
    'plant growth': {why:['effect']},
    'darkness': {zone:{obscure:true, on:[]}},
    'fog cloud': {zone:{obscure:true, on:[]}},
    'silence': {zone:{on:[]}},
    'hunger of hadar': {zone:{on:['start', 'end'], obscure:true, terrain:true}},
    'sleet storm': {zone:{on:['start'], terrain:true, obscure:true}},
    'stinking cloud': {zone:{on:['start'], obscure:true}},
    'cloudkill': {zone:{on:['enter', 'end'], obscure:true, move:true}},
    'moonbeam': {zone:{on:['enter', 'end'], move:true}},
    'flaming sphere': {zone:{on:['end'], move:true}},
    'cloud of daggers': {zone:{on:['enter', 'end'], move:true}},
    'spirit guardians': {zone:{on:['enter', 'end'], follow:true}},
    'wall of fire': {zone:{on:['enter', 'end']}},
    'evard\'s black tentacles': {zone:{on:['enter', 'end'], terrain:true}},
    'shield': {why:['reaction']}, 'counterspell': {why:['reaction']}, 'absorb elements': {why:['reaction']}, 'hellish rebuke': {why:['reaction']}, 'feather fall': {why:['reaction']},
    'bless': {why:['dice']}, 'bane': {why:['dice']}, 'guidance': {why:['dice']}, 'resistance': {why:['dice']},
    'polymorph': {why:['shape']}, 'true polymorph': {why:['shape']}, 'wild shape': {why:['shape']},
    'chromatic orb': {why:['choose']}, 'dragon\'s breath': {why:['choose']}, 'elemental weapon': {why:['choose']}};
  var cache = {};

  /* Texto plano de las entradas: {@tag nombre|libro|lo que se ve} → lo que se ve */
  function plain(x){
    if (x == null) return '';
    if (typeof x === 'string') return x.replace(/\{@\w+ ([^}]*)\}/g, function(_, b){ var p = b.split('|'); return (p[2] || p[0]).replace(/\s*\[[^\]]*\]/g, ''); });
    if (Array.isArray(x)) return x.map(plain).join('\n');
    if (typeof x === 'object') return [x.name || '', plain(x.entries || x.items || x.entry || '')].join(' ');
    return '';
  }
  function first(e){ return (e.entries || []).map(function(x){ return typeof x === 'string' ? x : JSON.stringify(x); }); }
  /* Daños con su tipo, del primer párrafo que tenga {@damage}: «2d10 contundente y 4d6 frío»; si dice «o», el primero */
  function damages(e){
    var paras = first(e), out = [];
    for (var i = 0; i < paras.length && !out.length; i++) {
      var re = /\{@damage ([^}|]+)[^}]*\}\s*(?:points? of\s+)?(\w+)?\s*damage/gi, m, last = -1, p = paras[i];
      while ((m = re.exec(p))) {
        if (last >= 0 && / or /i.test(p.slice(last, m.index)) && !/ and /i.test(p.slice(last, m.index))) break;
        var ty = DMG[String(m[2] || '').toLowerCase()] || ''; out.push({dice:m[1].replace(/\s+/g, ''), type:ty}); last = re.lastIndex;
        if (out.length >= 3) break;
      }
    }
    return out;
  }
  /* El área: primero lo que dice el alcance (las que salen de ti); si no, el texto («a 20-foot-radius Sphere») */
  function areaOf(e, txt){
    var R = e.range || {}, rt = R.type, amt = R.distance && R.distance.amount;
    if (AREA[rt] && rt !== 'wall' && amt) {
      var a = {t:AREA[rt], ft:+amt, self:true};
      if (a.t === 'sphere' || rt === 'radius') a.t = 'emanation';
      if (a.t === 'line') { var w = /(\d+)[- ]f(?:oo|ee)t[- ]wide/i.exec(txt); a.w = w ? +w[1] : 5; }
      return a;
    }
    var tags = e.areaTags || [];
    var m = /(\d+)[- ]foot[- ]long,?\s+(\d+)[- ]foot[- ]wide\s+line/i.exec(txt) || /line\s+(\d+)\s+feet\s+long\s+and\s+(\d+)\s+feet\s+wide/i.exec(txt);
    if (m) return {t:'line', ft:+m[1], w:+m[2]};
    m = /(\d+)[- ]foot(?:[- ]radius|[- ]diameter)?(?:,?\s+\d+[- ]foot[- ](?:high|tall|deep))?\s+(sphere|cube|cone|cylinder|emanation|square|hemisphere|circle|radius)/i.exec(txt) || /(sphere|cube|cylinder|cone|square|circle)\s+(?:with a radius of\s+)?(\d+)\s+feet/i.exec(txt);
    if (m) {
      var n = /^\d/.test(m[1]) ? +m[1] : +m[2], k = AREA[(/^\d/.test(m[1]) ? m[2] : m[1]).toLowerCase()];
      if (/diameter/i.test(m[0])) n = n / 2;
      if (k === 'sphere' && /-foot[- ]radius|radius/i.test(m[0]) === false && (/(cube|square)/i.test(m[0]))) k = 'cube';
      return {t:k || 'sphere', ft:n};
    }
    if (tags.indexOf('W') >= 0) { var wl = /up to (\d+) feet long/i.exec(txt); return {t:'wall', ft:wl ? +wl[1] : 30, w:5}; }
    return null;
  }
  /* El área de un texto cualquiera (las acciones de los monstruos: «exhala fuego en un cono de 4,5 m»); cono, línea y emanación salen de quien actúa */
  function areaIn(entries){
    var a = areaOf({}, plain(entries)); if (a && (a.t === 'cone' || a.t === 'line' || a.t === 'emanation')) a.self = true;
    return a;
  }
  function def(e){
    if (!e || !e.name) return null;
    var key = e.name + '|' + (e.source || ''); if (cache[key]) return cache[key];
    var txt = plain(e.entries || []), low = e.name.toLowerCase(), fix = FIX[low] || {}, mt = e.miscTags || [], why = [];
    var d = {ref:key, name:e.name, lv:e.level || 0};
    var R = e.range || {}; d.range = R.distance ? (R.distance.type === 'touch' ? 0 : R.distance.type === 'self' ? 0 : R.distance.type === 'miles' ? R.distance.amount * 5280 : R.distance.type === 'sight' || R.distance.type === 'unlimited' ? 9999 : +R.distance.amount || 0) : 0;
    if (R.distance && R.distance.type === 'touch') d.touch = true;
    var a = areaOf(e, txt); if (a) { d.area = a; if (a.self) d.self = true; }
    if (e.spellAttack && e.spellAttack.length) d.atk = e.spellAttack[0] === 'M' ? 'melee' : 'ranged';
    if (e.savingThrow && e.savingThrow.length) { d.save = SAVE[e.savingThrow[0]] || 'dex'; d.half = /half as much damage|half damage|half the damage/i.test(txt); }
    var dm = fix.dmg === false ? [] : damages(e); if (dm.length) d.dmg = dm;
    if (mt.indexOf('HL') >= 0) d.heal = true;
    var cs = (e.conditionInflict || []).filter(function(c){ return CONDS.indexOf(c) >= 0; }); if (cs.length) d.conds = cs;
    if ((e.duration || []).some(function(x){ return x.concentration; })) d.conc = true;
    var inst = (e.duration || []).every(function(x){ return x.type === 'instant'; });
    if (fix.repeat || /(end|start) of each of (its|their) turns[^.]*?(repeat|make another|can make)|repeats? the sav/i.test(txt)) d.repeat = !!(d.save && (d.conds || /repeat/i.test(txt)));
    // zona que se queda: un área con duración que hace algo al entrar, al empezar o terminar el turno, o que cambia el terreno
    var zon = fix.zone || null;
    if (!zon && d.area && !inst) {
      var on = [];
      if (/enters? (?:the|that|its|a|an)? ?(?:spell's )?(?:area|sphere|cube|cylinder|emanation|line|wall|cloud|fog|space)|enters the [\w ]{0,20}for the first time/i.test(txt)) on.push('enter');
      if (/ends? (?:its|their) turn (?:there|in|within|inside)/i.test(txt)) on.push('end');
      if (/starts? (?:its|their) turn (?:there|in|within|inside)/i.test(txt)) on.push('start');
      var terr = mt.indexOf('DFT') >= 0, obs = mt.indexOf('OBS') >= 0;
      if (on.length || terr || obs) zon = {on:on, terrain:terr, obscure:obs};
    }
    if (zon) {
      d.zone = {on:zon.on || [], terrain:!!zon.terrain || mt.indexOf('DFT') >= 0, obscure:!!zon.obscure || mt.indexOf('OBS') >= 0};
      if (zon.follow || (d.area && d.area.t === 'emanation')) d.zone.follow = true;
      if (zon.move || /(?:move|teleport) the (?:cylinder|sphere|cube|cloud|emanation|beam|flame|wall)/i.test(txt)) d.zone.move = true;
    }
    if (fix.note) d.note = fix.note;
    // lo que no se puede resolver solo
    (fix.why || []).forEach(function(w){ why.push(w); });
    if (mt.indexOf('SMN') >= 0) why.push('summon');
    if (mt.indexOf('TP') >= 0) why.push('tp');
    if (d.area && d.area.t === 'wall') why.push('wall');
    if (!d.area && (e.areaTags || []).some(function(t){ return /^[SCYNLQRHE]$/.test(t); })) why.push('area');
    if (!d.atk && !d.save && !d.dmg && !d.heal && !d.conds) why.push('effect');
    if (/(?:acid|cold|fire|lightning|poison|thunder|radiant|necrotic|psychic)(?:, \w+)*,? or (?:acid|cold|fire|lightning|poison|thunder|radiant|necrotic|psychic) damage \(your choice\)|damage type (?:of your choice|you choose)|choose (?:a|the|one) (?:damage )?type|of a type you choose/i.test(txt)) why.push('choose');
    var seen = {}; d.why = why.filter(function(w){ if (seen[w]) return false; seen[w] = 1; return true; });
    d.auto = d.why.length ? 'asistido' : 'auto';
    cache[key] = d;
    return d;
  }
  function whyText(k){ return WHY[k] || k; }
  /* Una línea para mostrar: «esfera de 6 m · DES CD · 8d6 fuego · concentración» */
  function line(d){
    if (!d) return '';
    var p = [];
    if (d.area) p.push(AREA_ES[d.area.t] + ' de ' + String(d.area.ft / 5 * 1.5).replace('.', ',') + ' m' + (d.self ? ' desde ti' : ''));
    if (d.zone) p.push(d.zone.terrain ? 'deja terreno difícil' : 'se queda en el mapa');
    if (d.repeat) p.push('repite la salvación');
    if (d.conc) p.push('concentración');
    return p.join(' · ');
  }
  /* Resumen de todos (para docs/HECHIZOS.md y Ajustes): cuántos se resuelven solos y la lista de asistidos */
  function survey(spells){
    var all = (spells || []).map(def).filter(Boolean), auto = all.filter(function(d){ return d.auto === 'auto'; }), by = {};
    all.forEach(function(d){ d.why.forEach(function(w){ (by[w] = by[w] || []).push(d); }); });
    return {total:all.length, auto:auto.length, asistidos:all.length - auto.length, zones:all.filter(function(d){ return d.zone; }).length, areas:all.filter(function(d){ return d.area; }).length, byWhy:by, all:all};
  }
  return {def:def, areaIn:areaIn, line:line, survey:survey, whyText:whyText, plain:plain, WHY:WHY, AREA_ES:AREA_ES, DMG:DMG};
})();
if (typeof module === 'object' && module && module.exports) module.exports = Hechizos;
