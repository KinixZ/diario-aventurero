
/* ==================== BIBLIOTECA 5ETOOLS (sin DOM) ==================== */
var Lib5e = (function(){
  var KEYS = ['spell','item','baseitem','itemProperty','itemMastery','itemType','condition','status','disease','action','variantrule','feat','skill','sense','race','subrace','background','class','subclass','classFeature','subclassFeature','optionalfeature','language','monster'];
  var WANT = /(^|\/)data\/(feats|items|items-base|conditionsdiseases|actions|variantrules|skills|senses|races|backgrounds|optionalfeatures|languages)\.json$|(^|\/)data\/spells\/spells-[^\/]+\.json$|(^|\/)data\/class\/class-[^\/]+\.json$|gendata-spell-source-lookup\.json$|(^|\/)data\/bestiary\/bestiary-[^\/]+\.json$/;
  /* Del bestiario solo se guardan las criaturas que acompañan a un personaje: invocaciones de clase o conjuro y familiares */
  function keepMonster(m){ return !!(m && m.name && (m.summonedByClass || m.summonedBySpell || m.familiar)); }
  var L = null, IDX = {};
  function empty(){ var o = {spellLookup:{}}; KEYS.forEach(function(k){ o[k] = []; }); return o; }
  function norm(s){ return String(s || '').toLowerCase().trim(); }
  function key(type, name, source){ return type + '|' + norm(name) + '|' + norm(source); }
  /* Une archivos de 5etools (o un paquete del diario) en una sola biblioteca */
  function ingest(lib, json, fileName){
    var added = 0;
    if (!json || typeof json !== 'object') return 0;
    if (/gendata-spell-source-lookup/.test(fileName || '')) { lib.spellLookup = json; return 1; }
    if (json._diario && json.spellLookup) lib.spellLookup = json.spellLookup;
    KEYS.forEach(function(k){ if (Array.isArray(json[k])) { var arr = k === 'monster' ? json[k].filter(keepMonster) : json[k]; Array.prototype.push.apply(lib[k], arr); added += arr.length; } });
    return added;
  }
  /* Resuelve los objetos que 5etools guarda como copia de otro (_copy) */
  function copyKey(k, x){ return norm(x.name) + '|' + norm(x.source) + (k === 'subclass' ? '|' + norm(x.className) + '|' + norm(x.classSource) : ''); }
  function resolveCopies(lib){
    ['item','spell','feat','race','background','subclass','optionalfeature','monster'].forEach(function(k){
      var arr = lib[k] || (lib[k] = []);
      for (var pass = 0; pass < 3; pass++) {
        var by = {}, left = 0;
        arr.forEach(function(x){ if (!x._copy) by[copyKey(k, x)] = x; });
        for (var i = 0; i < arr.length; i++) {
          var x = arr[i]; if (!x._copy) continue;
          var base = by[copyKey(k, x._copy)];
          if (!base) { left++; continue; }
          var m = Object.assign({}, base, x); delete m._copy; arr[i] = m;
        }
        if (!left) break;
      }
    });
    return lib;
  }
  function index(lib){
    IDX = {};
    function add(type, x, nameKey){ var n = nameKey ? x[nameKey] : x.name; if (!n) return; IDX[key(type, n, x.source)] = x; var anyK = type + '|' + norm(n) + '|*'; if (!IDX[anyK] || x.source === 'XPHB' || x.source === 'XDMG') IDX[anyK] = x; }
    ['spell','item','baseitem','condition','status','disease','action','variantrule','feat','skill','sense','itemMastery','race','background','class','optionalfeature','language','monster'].forEach(function(t){ (lib[t] || []).forEach(function(x){ add(t, x); }); });
    (lib.itemProperty || []).forEach(function(p){ add('itemProperty', p, 'abbreviation'); });
    (lib.itemType || []).forEach(function(p){ add('itemType', p, 'abbreviation'); });
  }
  function set(lib){ L = resolveCopies(lib); index(L); return L; }
  function get(){ return L; }
  function has(){ return !!L && (L.spell.length + L.item.length + L.variantrule.length + L.feat.length) > 0; }
  /* Busca una entrada por tipo, nombre y libro (si no hay libro, prefiere 2024) */
  var TAGTYPE = {spell:['spell'], item:['item','baseitem'], condition:['condition','status','disease'], status:['status','condition'], disease:['disease'], action:['action'], variantrule:['variantrule'], feat:['feat'], skill:['skill'], sense:['sense'], itemProperty:['itemProperty'], itemMastery:['itemMastery'], race:['race'], background:['background'], 'class':['class'], optfeature:['optionalfeature'], language:['language'], baseitem:['baseitem'], monster:['monster']};
  var DEFSRC = {spell:'phb', item:'dmg', condition:'phb', status:'phb', action:'phb', variantrule:'dmg', feat:'phb', skill:'phb', sense:'phb', itemProperty:'phb', itemMastery:'xphb', race:'phb', background:'phb', 'class':'phb', language:'phb', baseitem:'phb'};
  function find(tag, name, source){
    var types = TAGTYPE[tag]; if (!types || !L) return null;
    for (var i = 0; i < types.length; i++) {
      var t = types[i];
      if (source) { var e = IDX[key(t, name, source)]; if (e) return {type:t, e:e}; }
      var a = IDX[t + '|' + norm(name) + '|*']; if (a) return {type:t, e:a};
    }
    return null;
  }
  function canLink(tag){ return !!TAGTYPE[tag]; }
  function spellClasses(sp){
    if (!L || !L.spellLookup) return [];
    var bySrc = L.spellLookup[norm(sp.source)]; var rec = bySrc && bySrc[norm(sp.name)];
    if (!rec || !rec['class']) return [];
    var out = {}; Object.keys(rec['class']).forEach(function(src){ Object.keys(rec['class'][src]).forEach(function(c){ out[c] = 1; }); });
    return Object.keys(out).sort();
  }
  function counts(){ var o = {}; if (L) KEYS.forEach(function(k){ o[k] = L[k].length; }); return o; }
  /* "name|source" → {name, source} */
  function parseRef(s, defSrc){ var p = String(s).split('|'); return {name: p[0], source: p[1] || defSrc || ''}; }
  /* Rasgos de clase y subclase por su referencia */
  function classFeature(refStr){
    if (!L) return null; var p = refStr.split('|');
    var name = norm(p[0]), cn = norm(p[1]), cs = norm(p[2] || 'phb'), lv = +p[3], src = norm(p[4] || p[2] || 'phb');
    return L.classFeature.filter(function(f){ return norm(f.name) === name && norm(f.className) === cn && norm(f.classSource) === cs && f.level === lv && norm(f.source) === src; })[0]
      || L.classFeature.filter(function(f){ return norm(f.name) === name && norm(f.className) === cn && norm(f.classSource) === cs && f.level === lv; })[0] || null;
  }
  function subclassFeature(refStr){
    if (!L) return null; var p = refStr.split('|');
    var name = norm(p[0]), cn = norm(p[1]), sn = norm(p[3]), ss = norm(p[4] || 'phb'), lv = +p[5];
    return L.subclassFeature.filter(function(f){ return norm(f.name) === name && norm(f.className) === cn && norm(f.subclassShortName) === sn && norm(f.subclassSource) === ss && f.level === lv; })[0] || null;
  }
  function optionalfeature(refStr){ var r = parseRef(refStr, 'phb'), f = find('optfeature', r.name, r.source); return f && f.e; }
  return {keepMonster:keepMonster, KEYS:KEYS, WANT:WANT, empty:empty, ingest:ingest, set:set, get:get, has:has, find:find, canLink:canLink, spellClasses:spellClasses, counts:counts, norm:norm, DEFSRC:DEFSRC, parseRef:parseRef, classFeature:classFeature, subclassFeature:subclassFeature, optionalfeature:optionalfeature};
})();

