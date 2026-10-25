
/* ==================== REGLAS: CÁLCULOS Y ELECCIONES (sin DOM) ==================== */
var Rules5e = (function(){
  var N = Lib5e.norm;
  var ABS = ['str','dex','con','int','wis','cha'];
  var AB = {str:'Fue', dex:'Des', con:'Con', int:'Int', wis:'Sab', cha:'Car'};
  var ABL = {str:'Fuerza', dex:'Destreza', con:'Constitución', int:'Inteligencia', wis:'Sabiduría', cha:'Carisma'};
  var SK = {acrobatics:'dex', 'animal handling':'wis', arcana:'int', athletics:'str', deception:'cha', history:'int', insight:'wis', intimidation:'cha', investigation:'int', medicine:'wis', nature:'int', perception:'wis', performance:'cha', persuasion:'cha', religion:'int', 'sleight of hand':'dex', stealth:'dex', survival:'wis'};
  var SKES = {acrobatics:'Acrobacias', 'animal handling':'Trato con animales', arcana:'Arcanos', athletics:'Atletismo', deception:'Engaño', history:'Historia', insight:'Perspicacia', intimidation:'Intimidación', investigation:'Investigación', medicine:'Medicina', nature:'Naturaleza', perception:'Percepción', performance:'Interpretación', persuasion:'Persuasión', religion:'Religión', 'sleight of hand':'Juego de manos', stealth:'Sigilo', survival:'Supervivencia'};
  var ALLSK = Object.keys(SK);
  var STEPS = [['clase','Clase'],['origen','Origen'],['caract','Características'],['habil','Habilidades'],['conjuros','Conjuros'],['equipo','Equipo'],['niveles','Niveles'],['listo','Listo']];
  var EQT = {setGaming:'Juego a tu elección', instrumentMusical:'Instrumento musical a tu elección', toolArtisan:"Herramientas de artesano a tu elección", weaponSimple:'Arma sencilla a tu elección', weaponMartial:'Arma marcial a tu elección', weaponSimpleMelee:'Arma sencilla cuerpo a cuerpo a tu elección', weaponMartialMelee:'Arma marcial cuerpo a cuerpo a tu elección', focusSpellcastingArcane:'Canalizador arcano', focusSpellcastingHoly:'Símbolo sagrado', focusSpellcastingDruidic:'Canalizador druídico'};
  var RES_ES = {'channel divinity':'Canalizar divinidad', 'rages':'Furias', 'rage damage':'Daño de furia', 'sneak attack':'Ataque furtivo', 'focus points':'Puntos de foco', 'ki points':'Puntos de ki', 'martial arts':'Artes marciales', 'unarmored movement':'Movimiento sin armadura', 'sorcery points':'Puntos de hechicería', 'wild shape':'Forma salvaje', 'second wind':'Recuperar aliento', 'weapon mastery':'Maestrías de arma', 'favored enemy':'Enemigo predilecto', 'magic items':'Objetos mágicos', 'infused items':'Objetos infundidos', 'bardic die':'Dado bárdico', 'superiority dice':'Dados de superioridad'};
  var SKIP_COL = /cantrip|prepared|spells known|spell slots|slot level|invocation|infusions known|plans known|proficiency bonus|^level$|features|weapon mastery|magic items|infused items|maneuvers known/i;

  function mod(s){ return Math.floor((s - 10) / 2); }
  function pbOf(l){ return Math.floor((l - 1) / 4) + 2; }
  function sgn(n){ return (n >= 0 ? '+' : '−') + Math.abs(n); }
  function strip(s){ return String(s).replace(/\{@\w+ ([^|}]*)[^}]*\}/g, '$1'); }
  function L(){ return Lib5e.get(); }
  function refKey(o){ return o ? o.name + '|' + o.source : ''; }
  function byRef(arr, ref){ if (!ref) return null; var r = Lib5e.parseRef(ref); return (arr || []).filter(function(x){ return N(x.name) === N(r.name) && N(x.source) === N(r.source); })[0] || null; }
  var BOOKS = {"PHB":["Player's Handbook (2014)","2014-08"],"MM":["Monster Manual (2014)","2014-09"],"DMG":["Dungeon Master's Guide (2014)","2014-12"],"Screen":["Dungeon Master's Screen","2015-01"],"SCAG":["Sword Coast Adventurer's Guide","2015-11"],"PS-Z":["Plane Shift: Zendikar","2016-04"],"PS-I":["Plane Shift: Innistrad","2016-07"],"AL":["Adventurers League","2016-08"],"VGM":["Volo's Guide to Monsters","2016-11"],"PS-K":["Plane Shift: Kaladesh","2017-02"],"PS-A":["Plane Shift: Amonkhet","2017-07"],"OGA":["One Grung Above","2017-10"],"XGE":["Xanathar's Guide to Everything","2017-11"],"PS-X":["Plane Shift: Ixalan","2018-01"],"MTF":["Mordenkainen's Tome of Foes","2018-05"],"PS-D":["Plane Shift: Dominaria","2018-07"],"GGR":["Guildmasters' Guide to Ravnica","2018-11"],"SAC":["Sage Advice Compendium (2014)","2019-01"],"AI":["Acquisitions Incorporated","2019-06"],"AWM":["Adventure with Muk","2019-11"],"RMR":["Dungeons & Dragons vs. Rick and Morty: Basic Rules","2019-11"],"ERLW":["Eberron: Rising from the Last War","2019-11"],"EGW":["Explorer's Guide to Wildemount","2020-03"],"MOT":["Mythic Odysseys of Theros","2020-06"],"ScreenDungeonKit":["Dungeon Master's Screen: Dungeon Kit","2020-09"],"HF":["Heroes' Feast","2020-10"],"ScreenWildernessKit":["Dungeon Master's Screen: Wilderness Kit","2020-11"],"TCE":["Tasha's Cauldron of Everything","2020-11"],"MGELFT":["Muk's Guide to Everything He Learned From Tasha","2020-12"],"VRGR":["Van Richten's Guide to Ravenloft","2021-05"],"DoD":["Domains of Delight","2021-09"],"MaBJoV":["Minsc and Boo's Journal of Villainy","2021-10"],"FTD":["Fizban's Treasury of Dragons","2021-10"],"SCC":["Strixhaven: A Curriculum of Chaos","2021-12"],"MPMM":["Mordenkainen Presents: Monsters of the Multiverse","2022-01"],"MCV1SC":["Monstrous Compendium Volume 1: Spelljammer Creatures","2022-04"],"TD":["Tarot Deck","2022-05"],"ScreenSpelljammer":["Dungeon Master's Screen: Spelljammer","2022-08"],"AAG":["Astral Adventurer's Guide","2022-08"],"BAM":["Boo's Astral Menagerie","2022-08"],"HAT-TG":["Thieves' Gallery","2023-03"],"BGG":["Bigby Presents: Glory of the Giants","2023-08"],"MCV4EC":["Monstrous Compendium Volume 4: Eldraine Creatures","2023-09"],"MPP":["Morte's Planar Parade","2023-10"],"SatO":["Sigil and the Outlands","2023-10"],"AATM":["Adventure Atlas: The Mortuary","2023-10"],"HFFotM":["Heroes' Feast Flavors of the Multiverse","2023-11"],"BMT":["The Book of Many Things","2023-11"],"DMTCRG":["The Deck of Many Things: Card Reference Guide","2023-11"],"PaF":["Puncheons and Flagons","2024-08"],"XPHB":["Player's Handbook (2024)","2024-09"],"XDMG":["Dungeon Master's Guide (2024)","2024-11"],"XScreen":["Dungeon Master's Screen (2024)","2024-11"],"XMM":["Monster Manual (2025)","2025-02"],"XSAC":["Sage Advice Compendium (2025)","2025-04"],"ABH":["Astarion's Book of Hungers","2025-11"],"FRAiF":["Forgotten Realms: Adventures in Faerûn","2025-11"],"FRHoF":["Forgotten Realms: Heroes of Faerûn","2025-11"],"NF":["Netheril's Fall","2025-11"],"LFL":["Lorwyn: First Light","2025-11"],"EFA":["Eberron: Forge of the Artificer","2025-12"],"CaBoMP":["Crochet: A Book of Many Patterns","2026-03"],"XScreenRHW":["Dungeon Master's Screen; Ravenloft: The Horrors Within","2026-06"],"RHW":["Ravenloft: The Horrors Within","2026-06"],"AU":["Arcana Unleashed","2026-09"],"HFLotT":["Heroes' Feast Legends of the Table","2026-09"],"PL":["Project_Lamordia","2026-10"],"LMoP":["Lost Mine of Phandelver","2014-07"],"HotDQ":["Hoard of the Dragon Queen","2014-08"],"RoT":["Rise of Tiamat","2014-11"],"PotA":["Princes of the Apocalypse","2015-04"],"OotA":["Out of the Abyss","2015-09"],"CoS":["Curse of Strahd","2016-03"],"SKT":["Storm King's Thunder","2016-09"],"TftYP-TSC":["Tales from the Yawning Portal: The Sunless Citadel","2017-03"],"TftYP-TFoF":["Tales from the Yawning Portal: The Forge of Fury","2017-03"],"TftYP-THSoT":["Tales from the Yawning Portal: The Hidden Shrine of Tamoachan","2017-03"],"TftYP-WPM":["Tales from the Yawning Portal: White Plume Mountain","2017-03"],"TftYP-DiT":["Tales from the Yawning Portal: Dead in Thay","2017-03"],"TftYP-AtG":["Tales from the Yawning Portal: Against the Giants","2017-03"],"TftYP-ToH":["Tales from the Yawning Portal: Tomb of Horrors","2017-03"],"ToA":["Tomb of Annihilation","2017-09"],"TTP":["The Tortle Package","2017-11"],"TLK":["The Lost Kenku","2017-11"],"XMtS":["X Marks the Spot","2017-12"],"WDH":["Waterdeep: Dragon Heist","2018-09"],"LLK":["Lost Laboratory of Kwalish","2018-11"],"WDMM":["Waterdeep: Dungeon of the Mad Mage","2018-11"],"KKW":["Krenko's Way","2018-11"],"AZfyT":["A Zib for Your Thoughts","2019-03"],"GoS":["Ghosts of Saltmarsh","2019-05"],"HftT":["Hunt for the Thessalhydra","2019-05"],"OoW":["The Orrery of the Wanderer","2019-06"],"DIP":["Essentials Kit: Dragon of Icespire Peak","2019-06"],"SLW":["Essentials Kit: Storm Lord's Wrath","2019-09"],"SDW":["Essentials Kit: Sleeping Dragon's Wake","2019-09"],"DC":["Essentials Kit: Divine Contention","2019-09"],"BGDIA":["Baldur's Gate: Descent Into Avernus","2019-09"],"LR":["Locathah Rising","2019-09"],"IMR":["Infernal Machine Rebuild","2019-11"],"EFR":["Eberron: Forgotten Relics","2019-11"],"RMBRE":["The Lost Dungeon of Rickedness: Big Rick Energy","2019-11"],"ToR":["Wildemount: Tide of Retribution","2020-03"],"DD":["Wildemount: Dangerous Designs","2020-03"],"FS":["Wildemount: Frozen Sick","2020-03"],"US":["Wildemount: Unwelcome Spirits","2020-03"],"MOT-NSS":["Theros: No Silent Secret","2020-06"],"IDRotF":["Icewind Dale: Rime of the Frostmaiden","2020-09"],"CM":["Candlekeep Mysteries","2021-03"],"HoL":["Ravenloft: The House of Lament","2021-05"],"RtG":["Return to the Glory","2021-05"],"AitFR-ISF":["Adventures in the Forgotten Realms: In Scarlet Flames","2021-06"],"AitFR-THP":["Adventures in the Forgotten Realms: The Hidden Page","2021-07"],"AitFR-AVT":["Adventures in the Forgotten Realms: A Verdant Tomb","2021-07"],"AitFR-DN":["Adventures in the Forgotten Realms: Deepest Night","2021-07"],"AitFR-FCD":["Adventures in the Forgotten Realms: From Cyan Depths","2021-07"],"NRH-TCMC":["NERDS Restoring Harmony: The Candy Mountain Caper","2021-09"],"NRH-AVitW":["NERDS Restoring Harmony: A Voice in the Wilderness","2021-09"],"NRH-ASS":["NERDS Restoring Harmony: A Sticky Situation","2021-09"],"NRH-CoI":["NERDS Restoring Harmony: Circus of Illusion","2021-09"],"NRH-TLT":["NERDS Restoring Harmony: The Lost Tomb","2021-09"],"NRH-AWoL":["NERDS Restoring Harmony: A Web of Lies","2021-09"],"NRH-AT":["NERDS Restoring Harmony: Adventure Together","2021-09"],"WBtW":["The Wild Beyond the Witchlight","2021-09"],"SCC-CK":["Strixhaven: Campus Kerfuffle","2021-12"],"SCC-HfMT":["Strixhaven: Hunt for Mage Tower","2021-12"],"SCC-TMM":["Strixhaven: The Magister's Masquerade","2021-12"],"SCC-ARiR":["Strixhaven: A Reckoning in Ruins","2021-12"],"CRCotN":["Critical Role: Call of the Netherdeep","2022-03"],"JttRC":["Journeys through the Radiant Citadel","2022-07"],"DoSI":["Dragons of Stormwreck Isle","2022-07"],"SjA":["Spelljammer Academy","2022-08"],"LoX":["Light of Xaryxis","2022-08"],"DSotDQ":["Dragonlance: Shadow of the Dragon Queen","2022-11"],"KftGV":["Keys from the Golden Vault","2023-02"],"GotSF":["Giants of the Star Forge","2023-08"],"PaBTSO":["Phandelver and Below: The Shattered Obelisk","2023-09"],"LK":["Lightning Keep","2023-09"],"ToFW":["Turn of Fortune's Wheel","2023-10"],"CoA":["Chains of Asmodeus","2023-10"],"PiP":["Peril in Pinebrook","2023-11"],"HFStCM":["Heroes' Feast: Saving the Children's Menu","2023-11"],"DitLCoT":["Descent into the Lost Caverns of Tsojcanth","2024-03"],"LRDT":["Red Dragon's Tale: A LEGO Adventure","2024-04"],"VNotEE":["Vecna: Nest of the Eldritch Eye","2024-04"],"VEoR":["Vecna: Eve of Ruin","2024-05"],"QftIS":["Quests from the Infinite Staircase","2024-07"],"UtHftLH":["Uni and the Hunt for the Lost Horn","2024-09"],"ScoEE":["Scions of Elemental Evil","2024-10"],"HBTD":["Hold Back The Dead","2025-02"],"BQGT":["Borderlands Quest: Goblin Trouble","2025-06"],"DrDe-DaS":["Dragon Delves: Death at Sunset","2025-07"],"DrDe-BD":["Dragon Delves: Baker's Doesn't","2025-07"],"DrDe-TWoO":["Dragon Delves: The Will of Orcus","2025-07"],"DrDe-FWtVC":["Dragon Delves: For Whom the Void Calls","2025-07"],"DrDe-TDoN":["Dragon Delves: The Dragon of Najkir","2025-07"],"DrDe-TFV":["Dragon Delves: The Forbidden Vale","2025-07"],"DrDe-BtS":["Dragon Delves: Before the Storm","2025-07"],"DrDe-SD":["Dragon Delves: Shivering Death","2025-07"],"DrDe-ACfaS":["Dragon Delves: A Copper for a Song","2025-07"],"DrDe-DotSC":["Dragon Delves: Dragons of the Sandstone City","2025-07"],"HotB":["Heroes of the Borderlands","2025-09"],"WttHC":["Stranger Things: Welcome to the Hellfire Club","2025-10"],"FRAiF-TLLoL":["The Lost Library of Lethchauntos","2025-11"],"FFotR":["Fated Flight of the Recluse","2025-12"],"BQDD":["Borderlands Quest: Dagger Danger!","2026-05"],"SoS":["Shadows of Sithicus","2026-05"],"RWG":["Red Wizards' Gambit","2026-09"],"AUD":["Arcana Unleashed: Deadfall","2026-09"]};
  var SRC_ES = {XPHB:'Manual del jugador 2024', PHB:'Manual del jugador 2014', XDMG:'Guía del DM 2024', DMG:'Guía del DM 2014', XMM:'Manual de monstruos 2025', MM:'Manual de monstruos 2014', XGE:'Guía de Xanathar', TCE:'Caldero de Tasha', FTD:'Tesoro de dragones de Fizban', BGG:'Gloria de los gigantes de Bigby', SCAG:'Guía de la Costa de la Espada', MPMM:'Mordenkainen presenta: Monstruos del Multiverso'};
  function srcName(code){ return SRC_ES[code] || (BOOKS[code] && BOOKS[code][0]) || code || ''; }
  function edition(x){ if (x.edition === 'one' || /^(XPHB|XDMG|XMM|EFA|FRHoF|AU|ABH)$/.test(x.source)) return '2024'; if (x.edition === 'classic') return '2014'; var b = BOOKS[x.source]; return b && b[1] >= '2024-09' ? '2024' : '2014'; }
  function srcLabel(x){ return edition(x) + ' · ' + srcName(x.source); }

  /* ---------- Catálogos ---------- */
  function classes(){ return L().class.filter(function(c){ return !/^UA/.test(c.source) && !/Sidekick/.test(c.name) && c.classFeatures; }); }
  function subclassesOf(cls){
    var seen = {};
    return L().subclass.filter(function(s){ return s.name && s.subclassFeatures && N(s.className) === N(cls.name) && N(s.classSource) === N(cls.source) && !/^UA/.test(s.source); })
      .filter(function(s){ var k = s.name + '|' + s.source; if (seen[k]) return false; seen[k] = 1; return true; });
  }
  function races(){ return L().race.filter(function(r){ return r.name && !/^UA/.test(r.source) && !r._copy; }); }
  function backgrounds(){ return L().background.filter(function(b){ return b.name && !/^UA/.test(b.source) && !b._copy; }); }
  function featRefs(cls){
    return (cls.classFeatures || []).map(function(f){
      var ref = typeof f === 'string' ? f : f.classFeature, p = ref.split('|');
      return {ref:ref, name:p[0], level:+p[3], gainSub: typeof f === 'object' && f.gainSubclassFeature};
    });
  }
  function subclassLevel(cls){ var f = featRefs(cls).filter(function(x){ return x.gainSub; })[0]; return f ? f.level : 3; }

  /* ---------- Tablas de clase ---------- */
  function colIndex(g, re){ return (g.colLabels || []).findIndex(function(c){ return re.test(strip(c)); }); }
  function cellVal(v){
    if (v == null) return null;
    if (typeof v === 'number' || typeof v === 'string') return v;
    if (v.type === 'dice' && v.toRoll) return v.toRoll.map(function(d){ return d.number + 'd' + d.faces; }).join(' + ');
    if (v.type === 'bonus') return sgn(v.value);
    if (v.type === 'bonusSpeed') return '+' + (v.value / 5 * 1.5).toString().replace('.', ',') + ' m';
    if (v.value != null) return v.value;
    return null;
  }
  function tableGroups(cls, sub){ return (cls.classTableGroups || []).concat(sub && sub.subclassTableGroups || []); }
  function tableCol(cls, sub, re, lvl){
    var gs = tableGroups(cls, sub);
    for (var i = 0; i < gs.length; i++) { var g = gs[i]; if (!g.rows) continue; var ix = colIndex(g, re); if (ix >= 0 && g.rows[lvl - 1]) return cellVal(g.rows[lvl - 1][ix]); }
    return null;
  }
  function slotsFor(cls, sub, lvl){
    var gs = tableGroups(cls, sub), out = {slots:[], pact:null};
    gs.forEach(function(g){ if (g.rowsSpellProgression && g.rowsSpellProgression[lvl - 1] && !out.slots.length) out.slots = g.rowsSpellProgression[lvl - 1].slice(); });
    if (!out.slots.length) {
      var n = tableCol(cls, sub, /^spell slots$/i, lvl), sl = tableCol(cls, sub, /^slot level$/i, lvl);
      if (n) out.pact = {count: +n, level: parseInt(String(sl).replace(/\D/g, ''), 10) || 1};
    }
    return out;
  }
  function progAt(arr, lvl){ return arr && arr[lvl - 1] != null ? arr[lvl - 1] : null; }
  function progMap(p, lvl){ if (!p) return 0; if (Array.isArray(p)) return p[lvl - 1] || 0; var n = 0; Object.keys(p).forEach(function(k){ if (+k <= lvl) n += p[k]; }); return n; }
  function progMax(p, lvl){ if (!p) return 0; var n = 0; Object.keys(p).forEach(function(k){ if (+k <= lvl) n = Math.max(n, p[k]); }); return n; }

  /* ---------- Multiclase ---------- */
  var MC_SLOTS = [[],[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]];
  function casterShare(prog, lv){ return prog === 'full' ? lv : prog === 'artificer' ? Math.ceil(lv / 2) : prog === '1/2' ? Math.floor(lv / 2) : prog === '1/3' ? Math.floor(lv / 3) : 0; }
  /* Requisito de 13 en características: 2014 usa multiclassing.requirements, 2024 la característica principal */
  function mcReq(c, abil){
    var m = c.multiclassing || {}, req = m.requirements, alts = [];
    if (req) {
      var base = {}; Object.keys(req).forEach(function(k){ if (k !== 'or') base[k] = req[k]; });
      var ors = []; (req.or || []).forEach(function(o){ Object.keys(o).forEach(function(k){ var a = {}; a[k] = o[k]; ors.push(a); }); });
      if (ors.length) ors.forEach(function(o){ alts.push(Object.assign({}, base, o)); }); else alts.push(base);
    } else if (c.primaryAbility) c.primaryAbility.forEach(function(o){ var a = {}; Object.keys(o).forEach(function(k){ if (o[k]) a[k] = 13; }); alts.push(a); });
    alts = alts.filter(function(a){ return Object.keys(a).length; });
    if (!alts.length) return {ok:true, text:'Sin requisitos'};
    var ok = !abil || alts.some(function(a){ return Object.keys(a).every(function(k){ return (abil[k] || 0) >= a[k]; }); });
    return {ok:ok, text: alts.map(function(a){ return Object.keys(a).map(function(k){ return AB[k] + ' ' + a[k]; }).join(' y '); }).join(' o ')};
  }
  /* Lista de conjuros que usa una clase (las subclases arcanas de guerrero y pícaro usan la del mago) */
  function spellListOf(c, s){ if (!c.spellcastingAbility && s && /eldritch knight|arcane trickster/i.test(s.name)) return 'Wizard'; return c.name; }

  /* ---------- Especificación de aumentos de característica ---------- */
  function abilitySpec(list){
    if (!list || !list.length) return null;
    var alts = list.map(function(a){
      var fixed = {}, slots = [], max = a.max || 20;
      ABS.forEach(function(k){ if (typeof a[k] === 'number') fixed[k] = a[k]; });
      if (a.choose) {
        var c = a.choose;
        if (c.weighted) c.weighted.weights.forEach(function(w){ slots.push({from:c.weighted.from, n:w}); });
        else for (var i = 0; i < (c.count || 1); i++) slots.push({from:c.from || ABS, n:c.amount || 1});
      }
      return {fixed:fixed, slots:slots, max:max};
    });
    return alts;
  }
  function altLabel(alt){
    var parts = Object.keys(alt.fixed).map(function(k){ return AB[k] + ' ' + sgn(alt.fixed[k]); });
    if (alt.slots.length) {
      var ns = alt.slots.map(function(s){ return sgn(s.n); });
      parts.push(ns.join(' y ') + ' a ' + (alt.slots.length > 1 ? 'características distintas' : 'una característica') + ' (' + alt.slots[0].from.map(function(k){ return AB[k]; }).join('/') + ')');
    }
    return parts.join(', ');
  }
  function applyAbility(spec, val, bonus, src, caps){
    if (!spec) return true;
    var ai = val && val.alt != null ? val.alt : 0, alt = spec[ai]; if (!alt) return false;
    Object.keys(alt.fixed).forEach(function(k){ bonus[k] += alt.fixed[k]; src.push([k, alt.fixed[k]]); if (alt.max > 20) caps[k] = Math.max(caps[k] || 20, alt.max); });
    if (!alt.slots.length) return true;
    var picks = val && val.picks || [], ok = picks.length === alt.slots.length && picks.every(Boolean) && new Set(picks).size === picks.length;
    if (ok) alt.slots.forEach(function(s, i){ bonus[picks[i]] += s.n; src.push([picks[i], s.n]); if (alt.max > 20) caps[picks[i]] = Math.max(caps[picks[i]] || 20, alt.max); });
    return ok;
  }

  /* ---------- Conjuros adicionales (dotes, especies, clases) ---------- */
  function spellRefStr(x){ return String(x).replace(/#.*$/, ''); }
  function spellGrants(group, lvl){
    var fixed = [], chooses = [];
    function leaf(arr, how, key){
      (arr || []).forEach(function(x, i){
        if (typeof x === 'string') fixed.push({ref:spellRefStr(x), how:how});
        else if (x && x.choose) chooses.push({key:key + ':' + i, filter: typeof x.choose === 'string' ? x.choose : null, list: typeof x.choose === 'object' ? (x.choose.from || []).map(spellRefStr) : null, count: x.count || (x.choose && x.choose.count) || 1, how:how});
      });
    }
    /* Recorre formas anidadas: {rest:{1:[…]}}, {daily:{1e:[…]}}, {will:[…]} */
    function walk(v, how, key){
      if (Array.isArray(v)) { leaf(v, how, key); return; }
      if (!v || typeof v !== 'object') return;
      Object.keys(v).forEach(function(kk){
        var h2 = kk === 'will' ? 'a voluntad' : kk === 'ritual' ? 'ritual' : /^\d+e?$/.test(kk) ? kk.replace('e', '') + '/' + (/daily/.test(key) ? 'día' : /rest/.test(key) ? 'descanso' : 'uso') : how;
        walk(v[kk], h2, key + ':' + kk);
      });
    }
    function lvOk(k){ return k === '_' || +k <= lvl || /^s\d/.test(k); }
    ['known','prepared','expanded'].forEach(function(t){
      var m = group[t]; if (!m) return;
      Object.keys(m).forEach(function(k){ if (!lvOk(k)) return; walk(m[k], t === 'expanded' ? 'expandida' : t === 'known' ? 'conocido' : 'siempre preparado', t + ':' + k); });
    });
    if (group.innate) Object.keys(group.innate).forEach(function(k){
      if (!lvOk(k)) return; var v = group.innate[k];
      if (Array.isArray(v)) leaf(v, 'a voluntad', 'innate:' + k);
      else Object.keys(v).forEach(function(kind){
        var vv = v[kind];
        if (Array.isArray(vv)) leaf(vv, kind === 'will' ? 'a voluntad' : kind, 'innate:' + k + ':' + kind);
        else Object.keys(vv).forEach(function(n){ leaf(vv[n], n.replace('e', '') + '/' + (kind === 'daily' ? 'día' : kind === 'rest' ? 'descanso' : kind), 'innate:' + k + ':' + kind + ':' + n); });
      });
    });
    return {fixed:fixed, chooses:chooses};
  }
  function parseFilter(f){
    var o = {};
    String(f || '').split('|').forEach(function(p){ var kv = p.split('='); if (kv.length === 2) o[N(kv[0])] = kv[1].split(';').map(function(s){ return N(s); }); });
    return o;
  }
  function filterLabel(f){
    var o = parseFilter(f), parts = [];
    if (o.level) parts.push(o.level.map(function(l){ return l === '0' ? 'trucos' : 'nivel ' + l; }).join(' o '));
    if (o['class']) parts.push('de la lista de ' + o['class'].map(function(c){ return c.charAt(0).toUpperCase() + c.slice(1); }).join(' o '));
    if (o.school) parts.push('escuela ' + o.school.join('/').toUpperCase());
    return parts.join(' ') || 'conjuros';
  }
  function spellHasClass(sp, cname){
    var lk = L().spellLookup || {}, rec = (lk[N(sp.source)] || {})[N(sp.name)];
    if (!rec || !rec['class']) return false;
    return Object.keys(rec['class']).some(function(src){ return Object.keys(rec['class'][src]).some(function(c){ return N(c) === N(cname); }); });
  }
  function spellsMatching(filter, list, opts){
    opts = opts || {};
    if (list) return list.map(function(r){ var p = Lib5e.parseRef(r), f = Lib5e.find('spell', p.name, p.source); return f && f.e; }).filter(Boolean);
    var o = parseFilter(filter);
    return L().spell.filter(function(sp){
      if (opts.hideOld !== false && sp.reprintedAs) return false;
      if (o.level && o.level.indexOf(String(sp.level)) < 0) return false;
      if (opts.maxLevel != null && sp.level > opts.maxLevel) return false;
      if (opts.minLevel != null && sp.level < opts.minLevel) return false;
      if (o['class'] && !o['class'].some(function(c){ return spellHasClass(sp, c); })) return false;
      if (o.school && o.school.indexOf(N(sp.school)) < 0) return false;
      return true;
    }).sort(function(a, b){ return a.level - b.level || a.name.localeCompare(b.name); });
  }
  function findSpell(ref){ var p = Lib5e.parseRef(spellRefStr(ref)), f = Lib5e.find('spell', p.name, p.source); return f && f.e; }

  /* ---------- Requisitos de dotes ---------- */
  function featPrereq(f, ctx){
    var alts = f.prerequisite || [];
    if (!alts.length) return {st:'ok', text:'Sin requisitos'};
    var res = alts.map(function(alt){
      var parts = [], st = 'ok';
      function add(t, s){ parts.push(t); if (s === 'no') st = 'no'; else if (s === 'dm' && st === 'ok') st = 'dm'; }
      Object.keys(alt).forEach(function(k){
        var v = alt[k];
        if (k === 'level') { var lv = typeof v === 'number' ? v : v.level, cl = typeof v === 'object' && v['class'] ? v['class'].name : null; add((cl ? cl + ', nivel ' : 'Nivel ') + lv + '+', (cl ? (ctx.classes ? (ctx.classes[N(cl)] || 0) >= lv : ctx.level >= lv && N(cl) === N(ctx.cls)) : ctx.level >= lv) ? 'ok' : 'no'); }
        else if (k === 'ability') add(v.map(function(o){ return Object.keys(o).map(function(a){ return AB[a] + ' ' + o[a] + '+'; }).join(' y '); }).join(' o '), v.some(function(o){ return Object.keys(o).every(function(a){ return ctx.abil[a] >= o[a]; }); }) ? 'ok' : 'no');
        else if (k === 'race') add('Especie: ' + v.map(function(r){ return r.name; }).join(' o '), v.some(function(r){ return N(r.name) === N(ctx.species); }) ? 'ok' : 'no');
        else if (k === 'feat') { var names = v.map(function(x){ return N(x.split('|')[0]); }); add('Dote: ' + names.join(', '), names.every(function(n){ return ctx.feats.indexOf(n) >= 0; }) ? 'ok' : 'no'); }
        else if (/^spellcasting/.test(k)) add('Poder lanzar conjuros', ctx.caster ? 'ok' : 'no');
        else if (k === 'proficiency') add('Competencia: ' + v.map(function(p){ return p.armor ? 'armadura ' + p.armor : 'arma ' + p.weapon; }).join(' o '), v.some(function(p){ return (p.armor && ctx.armor.indexOf(p.armor) >= 0) || (p.weapon && ctx.weapon.indexOf(p.weapon) >= 0); }) ? 'ok' : 'no');
        else if (k === 'feature') add('Rasgo: ' + v.join(', '), v.every(function(x){ return ctx.features.indexOf(N(x)) >= 0; }) ? 'ok' : 'no');
        else if (k === 'background') add('Trasfondo: ' + v.map(function(b){ return b.name; }).join(' o '), v.some(function(b){ return N(b.name) === N(ctx.background); }) ? 'ok' : 'no');
        else if (k === 'campaign') add('Campaña: ' + v.join(' o ') + ' (decide el DM)', 'dm');
        else if (k === 'otherSummary') add(v.entrySummary || 'Requisito especial', 'dm');
        else if (k === 'other') add(typeof v === 'string' ? v : 'Requisito especial', 'dm');
        else if (k !== 'exclusiveFeatCategory' && k !== 'featCategory') add('Requisito: ' + k, 'dm');
      });
      return {st:st, parts:parts};
    });
    var best = res.filter(function(r){ return r.st === 'ok'; })[0] || res.filter(function(r){ return r.st === 'dm'; })[0] || res[0];
    return {st:best.st, text:res.map(function(r){ return r.parts.join(', '); }).join(' — o — ')};
  }
  function featsFor(cats, ctx){
    return L().feat.filter(function(f){
      if (f.reprintedAs || /^UA/.test(f.source)) return false;
      if (cats && cats.indexOf(f.category || '') < 0 && !(f.category === 'D' && cats.indexOf('O') >= 0)) return false;
      return true;
    });
  }

  /* ---------- Equipo inicial ---------- */
  function eqItems(list){
    return (list || []).map(function(x){
      if (x.item) { var p = Lib5e.parseRef(x.item, 'phb'), f = Lib5e.find('item', p.name, p.source); return {kind:'item', ref: f ? f.type + '|' + f.e.name + '|' + f.e.source : null, name: x.displayName || (f ? f.e.name : p.name), q: x.quantity || 1, e: f && f.e}; }
      if (x.value != null) return {kind:'gold', gp: x.value / 100, name: (x.value / 100) + ' po'};
      if (x.special) return {kind:'special', name: x.special, q: x.quantity || 1};
      if (x.equipmentType) return {kind:'special', name: EQT[x.equipmentType] || 'Objeto a tu elección', q: x.quantity || 1};
      if (x.containsValue) return {kind:'special', name: 'Contenedor con ' + (x.containsValue / 100) + ' po'};
      return null;
    }).filter(Boolean);
  }
  function eqGroups(se){ return se && se.defaultData ? se.defaultData : Array.isArray(se) ? se : []; }

  /* ==================== DERIVAR EL PERSONAJE ==================== */
  function derive(C){
    var D = {ok:false, choices:[], warn:[], features:[], feats:[], spells:[], bonusSrc:[], resources:[], attacks:[], extraSpells:[]};
    if (!Lib5e.has()) { D.err = 'nolib'; return D; }
    var ch = C.ch || (C.ch = {});
    var curLv = 1;
    function choice(o){ if (o.lv == null) o.lv = curLv; o.value = ch[o.id]; o.done = o.check ? o.check(o.value) : (o.kind === 'many' || o.kind === 'spells' ? Array.isArray(o.value) && o.value.length === o.count : o.value != null && o.value !== ''); D.choices.push(o); return o; }

    /* Clase y nivel */
    var allCls = classes();
    choice({id:'cls', step:'clase', kind:'one', title:'Clase', help:'Define tu dado de golpe, competencias, rasgos y conjuros.', search:true,
      options: allCls.map(function(c){ return {v:refKey(c), label:c.name, sub:'d' + c.hd.faces + ' · ' + srcLabel(c), old: c.source !== 'XPHB' && c.source !== 'EFA' && allCls.some(function(o){ return o.name === c.name && (o.source === 'XPHB'); }), detail:{type:'classSummary', ref:refKey(c)}}; })});
    var cls = byRef(L().class, ch.cls);
    var lvl = Math.max(1, Math.min(20, +C.level || 1));
    D.level = lvl; D.pb = pbOf(lvl);
    if (!cls) { D.cls = null; return D; }
    D.cls = cls;
    /* Qué clase tomaste en cada nivel del personaje (C.cl); sin datos, todo es la clase principal */
    var CLS = [], byK = {}, seqE = [];
    for (var si = 0; si < lvl; si++) {
      var ref = si === 0 ? ch.cls : (C.cl && C.cl[si]) || ch.cls, E = byK[ref];
      if (!E) { var cc0 = byRef(L().class, ref); if (!cc0) { ref = ch.cls; E = byK[ref]; } else { E = byK[ref] = {cls:cc0, ref:ref, lv:0, at:[], primary: !CLS.length, sfx: CLS.length ? '@' + N(cc0.name).replace(/\W+/g, '') : ''}; CLS.push(E); } }
      E.lv++; E.at.push(si + 1); seqE.push(E);
    }
    function at(E, l){ return E.at[l - 1] || 99; }
    D.classes = CLS; D.clsLv = {}; CLS.forEach(function(E){ D.clsLv[N(E.cls.name)] = E.lv; });
    D.multi = CLS.length > 1;
    D.clsLabel = D.multi ? CLS.map(function(E){ return E.cls.name + ' ' + E.lv; }).join(' / ') : cls.name;
    CLS.forEach(function(E){
      var sl0 = subclassLevel(E.cls); E.subLvl = sl0; E.sub = null;
      if (E.lv < sl0) return;
      var sid = 'sub' + E.sfx;
      choice({id:sid, step: E.primary ? 'clase' : 'niveles', kind:'one', lv:at(E, sl0), title:'Subclase' + (D.multi ? ' de ' + E.cls.name : '') + ' (' + strip(E.cls.subclassTitle || 'subclase') + ')', help:'La obtienes en el nivel ' + sl0 + ' de ' + E.cls.name + '. Las subclases 2014 aparecen adaptadas a la clase 2024.', search:true,
        options: subclassesOf(E.cls).map(function(s){ return {v:refKey(s), label:s.name, sub:srcLabel(s), detail:{type:'subclassSummary', ref:refKey(s), cls:refKey(E.cls)}}; })});
      E.sub = subclassesOf(E.cls).filter(function(s){ return refKey(s) === ch[sid]; })[0] || null;
    });
    var sub = CLS[0].sub, subLvl = CLS[0].subLvl;
    D.subLevel = subLvl; D.sub = sub;

    /* Especie y trasfondo */
    choice({id:'race', step:'origen', kind:'one', title:'Especie', help:'Tamaño, velocidad, sentidos y rasgos especiales.', search:true,
      options: races().map(function(r){ return {v:refKey(r), label:r.name, sub:srcLabel(r), old: !!r.reprintedAs, detail:{type:'race', ref:refKey(r)}}; })});
    var race = byRef(L().race, ch.race); D.race = race;
    choice({id:'bg', step:'origen', kind:'one', title:'Trasfondo', help:'En 2024 da aumentos de característica, una dote de origen, habilidades y equipo.', search:true,
      options: backgrounds().map(function(b){ return {v:refKey(b), label:b.name, sub:srcLabel(b), old: !!b.reprintedAs, detail:{type:'background', ref:refKey(b)}}; })});
    var bg = byRef(L().background, ch.bg); D.bg = bg;

    /* Puntuaciones base */
    var base = C.base || {}; D.base = base;
    choice({id:'_scores', step:'caract', kind:'scores', title:'Puntuaciones de característica', check:function(){ return ABS.every(function(k){ return base[k] >= 3 && base[k] <= 20; }); }});

    var bonus = {str:0,dex:0,con:0,int:0,wis:0,cha:0}, caps = {}, src = [];
    function bonusFrom(label, arr){ arr.forEach(function(p){ D.bonusSrc.push({from:label, abil:p[0], n:p[1]}); }); }
    if (bg && bg.ability) {
      var bspec = abilitySpec(bg.ability), bs = [];
      choice({id:'bgAbil', step:'origen', kind:'abil', title:'Aumentos del trasfondo', help:'Elige cómo repartir los aumentos que da ' + bg.name + '.', spec:bspec, check:function(v){ var t = []; return applyAbility(bspec, v, {str:0,dex:0,con:0,int:0,wis:0,cha:0}, t, {}); }});
      applyAbility(bspec, ch.bgAbil, bonus, bs, caps); bonusFrom('Trasfondo', bs);
    }
    if (race && race.ability && !(bg && bg.ability)) {
      var rspec = abilitySpec(race.ability), rs = [];
      choice({id:'raceAbil', step:'origen', kind:'abil', title:'Aumentos de la especie', help:'Reglas 2014: la especie da los aumentos.', spec:rspec, check:function(v){ return applyAbility(rspec, v, {str:0,dex:0,con:0,int:0,wis:0,cha:0}, [], {}); }});
      applyAbility(rspec, ch.raceAbil, bonus, rs, caps); bonusFrom('Especie', rs);
    }

    /* Detalles de la especie */
    if (race) {
      if (race.size && race.size.length > 1) choice({id:'size', step:'origen', kind:'one', title:'Tamaño', options: race.size.map(function(s){ return {v:s, label:{S:'Pequeño', M:'Mediano', L:'Grande'}[s] || s}; })});
      var named = (race.additionalSpells || []).filter(function(g){ return g.name; });
      if (named.length > 1) choice({id:'lineage', step:'origen', kind:'one', title:'Linaje', help:'Cada linaje da conjuros y rasgos distintos.', options: named.map(function(g){ var sg = spellGrants(g, 20); return {v:g.name, label:g.name, sub: sg.fixed.map(function(s){ return Lib5e.parseRef(s.ref).name; }).join(', '), detail:{type:'grants', group:g, raceRef:refKey(race)}}; })});
    }

    /* ---------- Rasgos ---------- */
    CLS.forEach(function(E){
      featRefs(E.cls).forEach(function(r){ if (r.level > E.lv || r.gainSub && r.level > E.subLvl) return; var f = Lib5e.classFeature(r.ref); if (f) D.features.push({name:f.name, level:at(E, r.level), clv:r.level, from:'Clase', cn:E.cls.name, e:f}); });
      var S0 = E.sub;
      if (S0) (S0.subclassFeatures || []).forEach(function(ref){ var p = ref.split('|'), lv = +p[5]; if (lv > E.lv) return; var f = Lib5e.subclassFeature(ref); if (f) D.features.push({name: f.name === S0.name || f.name === S0.shortName ? S0.name : f.name, level:at(E, lv), clv:lv, from:'Subclase', cn:E.cls.name, e:f}); });
    });
    if (race) (race.entries || []).forEach(function(e){ if (e && e.name && !/^(Size|Speed|Creature Type)/.test(e.name)) D.features.push({name:e.name, from:'Especie', e:e}); });
    var featNames = D.features.map(function(f){ return N(f.name); });

    /* ---------- Competencias base ---------- */
    var sp0 = cls.startingProficiencies || {};
    D.saves = (cls.proficiency || []).slice();
    D.armor = (sp0.armor || []).map(function(a){ return N(strip(a)).replace(/ armor$/, '').replace(/^shields?$/, 'shield'); });
    D.weapon = (sp0.weapons || []).map(function(w){ return N(strip(w)).replace(/ weapons?$/, ''); });
    D.tools = (sp0.tools || []).map(strip);
    D.langs = ['Común'];
    CLS.slice(1).forEach(function(E){
      var g = (E.cls.multiclassing || {}).proficienciesGained || {};
      (g.armor || []).forEach(function(a){ var v = N(strip(a)).replace(/ armor$/, '').replace(/^shields?$/, 'shield'); if (D.armor.indexOf(v) < 0) D.armor.push(v); });
      (g.weapons || []).forEach(function(w){ var v = N(strip(w)).replace(/ weapons?$/, ''); if (D.weapon.indexOf(v) < 0) D.weapon.push(v); });
      (g.tools || []).forEach(function(t){ var v = strip(t); if (D.tools.indexOf(v) < 0) D.tools.push(v); });
    });

    /* ---------- Contexto para requisitos ---------- */
    var caster = CLS.some(function(E){ return E.cls.spellcastingAbility || E.sub && E.sub.spellcastingAbility; });
    function ctx(){ var a = {}; ABS.forEach(function(k){ a[k] = (base[k] || 8) + bonus[k]; }); return {level:lvl, cls:cls.name, classes:D.clsLv, abil:a, species: race ? race.name : '', background: bg ? bg.name : '', feats: D.feats.map(function(f){ return N(f.e.name); }), caster:caster, armor:D.armor, weapon:D.weapon, features:featNames}; }

    /* ---------- Dotes (espacios) ---------- */
    var slots = [];
    function fixedFeat(key){ var m = key.split('|'), nm = m[0], grp = null; if (nm.indexOf(';') >= 0) { grp = nm.split(';')[1].trim(); nm = nm.split(';')[0].trim(); } return {ref: nm + '|' + (m[1] || 'phb'), group: grp}; }
    if (bg && bg.feats) bg.feats.forEach(function(o, i){
      Object.keys(o).forEach(function(k){
        if (k === 'anyFromCategory') slots.push({id:'bg' + i, step:'origen', label:'Dote de origen (trasfondo)', cats:o[k].category});
        else if (o[k]) { var ff = fixedFeat(k); slots.push({id:'bg' + i, step:'origen', label:'Dote del trasfondo', fixed:ff.ref, group:ff.group}); }
      });
    });
    if (race && race.feats) race.feats.forEach(function(o, i){
      Object.keys(o).forEach(function(k){
        if (k === 'anyFromCategory') slots.push({id:'race' + i, step:'origen', label:'Dote de la especie', cats:o[k].category});
        else if (k === 'any') slots.push({id:'race' + i, step:'origen', label:'Dote de la especie', cats:null});
        else if (o[k]) { var ff = fixedFeat(k); slots.push({id:'race' + i, step:'origen', label:'Dote de la especie', fixed:ff.ref, group:ff.group}); }
      });
    });
    CLS.forEach(function(E){
      var tag = D.multi ? ' (' + E.cls.name + ' ' : '';
      featRefs(E.cls).forEach(function(r){ if (r.level <= E.lv && /^ability score improvement$/i.test(r.name)) slots.push({id:'asi' + r.level + E.sfx, step:'niveles', level:at(E, r.level), label:'Nivel ' + at(E, r.level) + (tag ? tag + r.level + ')' : '') + ': mejora de característica o dote', cats:null, asi:true}); });
      (E.cls.featProgression || []).forEach(function(fp){
        Object.keys(fp.progression || {}).forEach(function(k){ if (+k > E.lv) return; for (var i = 0; i < fp.progression[k]; i++) slots.push({id:'fp_' + N(fp.name).replace(/\W+/g, '') + k + '_' + i + E.sfx, step:'niveles', level:at(E, +k), label:'Nivel ' + at(E, +k) + (tag ? tag + k + ')' : '') + ': ' + fp.name, cats:fp.category}); });
      });
    });
    slots.forEach(function(sl){
      curLv = sl.level || 1;
      var fid = 'feat:' + sl.id, val = sl.fixed || ch[fid];
      if (!sl.fixed) {
        var c0 = ctx();
        choice({id:fid, step:sl.step, kind:'one', title:sl.label, help: sl.asi ? 'Toma la dote "Ability Score Improvement" para subir características, o cualquier otra dote cuyos requisitos cumplas.' : 'Solo aparecen las dotes de esta categoría; las que no cumples se marcan en rojo.', search:true, feat:true,
          options: featsFor(sl.cats).map(function(f){ var pr = featPrereq(f, c0); return {v:refKey(f), label:f.name, sub:(f.category || '2014') + ' · ' + f.source, st:pr.st, req:pr.text, detail:{type:'feat', ref:refKey(f)}}; }).sort(function(a, b){ return (a.st === 'no') - (b.st === 'no') || a.label.localeCompare(b.label); })});
      }
      var feat = val ? byRef(L().feat, val) : null;
      if (!feat) return;
      D.feats.push({slot:sl.id, e:feat, from:sl.label, level:sl.level || 1});
      D.features.push({name:feat.name, level:sl.level || 1, from:'Dote', e:feat});
      featNames.push(N(feat.name));
      /* aumentos de la dote */
      var fspec = abilitySpec(feat.ability), fs = [];
      if (fspec && (fspec.length > 1 || fspec[0].slots.length)) choice({id:'fab:' + sl.id, step:sl.step, kind:'abil', title:feat.name + ': aumento de característica', spec:fspec, parent:fid, check:function(v){ return applyAbility(fspec, v, {str:0,dex:0,con:0,int:0,wis:0,cha:0}, [], {}); }});
      applyAbility(fspec, ch['fab:' + sl.id], bonus, fs, caps); bonusFrom(feat.name, fs);
      /* habilidades de la dote */
      (feat.skillProficiencies || []).forEach(function(o, i){
        var cnt = o.any || (o.choose && (o.choose.count || 1)), from = o.any ? ALLSK : o.choose ? o.choose.from : null;
        if (from) choice({id:'fsk:' + sl.id + ':' + i, step:sl.step, kind:'many', count:cnt, title:feat.name + ': habilidades', parent:fid, options: from.map(function(s){ return {v:s, label:SKES[s] || s}; })});
      });
      /* conjuros de la dote */
      grantGroups(feat, 'f:' + sl.id, sl.group, sl.step, fid, feat.name);
    });
    curLv = 1;

    /* ---------- Conjuros que dan especie, clase y subclase ---------- */
    function grantGroups(owner, key, fixedGroup, step, parent, label, charLevel){
      var groups = owner.additionalSpells || []; if (!groups.length) return;
      var g = groups[0];
      if (groups.length > 1) {
        if (fixedGroup) g = groups.filter(function(x){ return x.name && N(x.name).indexOf(N(fixedGroup)) === 0; })[0] || groups[0];
        else {
          var gid = 'grp:' + key;
          if (key !== 'race') choice({id:gid, step:step, kind:'one', title:label + ': elige una opción', help:'Cada opción da conjuros distintos.', parent:parent, options: groups.map(function(x, i){ return {v:x.name || String(i), label:x.name || 'Opción ' + (i + 1), detail:{type:'grants', group:x}}; })});
          var pick = key === 'race' ? ch.lineage : ch[gid];
          g = groups.filter(function(x, i){ return (x.name || String(i)) === pick; })[0];
          if (!g) return;
        }
      }
      var gr = spellGrants(g, charLevel || lvl);
      gr.fixed.forEach(function(s){ var e = findSpell(s.ref); if (e) D.extraSpells.push({e:e, how:s.how, from:label}); });
      if (g.ability && g.ability.choose) choice({id:'gab:' + key, step:step, kind:'one', title:label + ': característica para lanzar', parent:parent, options: g.ability.choose.map(function(a){ return {v:a, label:ABL[a]}; })});
      gr.chooses.forEach(function(c){
        var cid = 'gsp:' + key + ':' + c.key, title = 'Elige ' + c.count + ' ' + (c.filter ? filterLabel(c.filter) : 'conjuro(s) de la lista');
        var o = choice({id:cid, step:step, kind:'spells', count:c.count, title:label + ': ' + title, filter:c.filter, list:c.list, parent:parent, how:c.how, prompt:true});
        (Array.isArray(o.value) ? o.value : []).forEach(function(r){ var e = findSpell(r); if (e) D.extraSpells.push({e:e, how:c.how, from:label}); });
      });
    }
    if (race) grantGroups(race, 'race', null, 'origen', 'race', race.name, lvl);
    if (race && race.feats) {} /* ya contemplado */

    /* ---------- Habilidades ---------- */
    D.skills = {}; D.expert = {};
    function addSk(s, from){ if (!D.skills[s]) D.skills[s] = from; }
    if (bg) (bg.skillProficiencies || []).forEach(function(o, i){
      Object.keys(o).forEach(function(k){ if (SK[k] && o[k] === true) addSk(k, 'Trasfondo'); });
      var cnt = o.any || (o.choose && (o.choose.count || 1)), from = o.any ? ALLSK : o.choose ? o.choose.from : null;
      if (from) { var c = choice({id:'bgsk' + i, step:'habil', kind:'many', count:cnt, title:'Habilidades del trasfondo', options: from.map(function(s){ return {v:s, label:SKES[s] || s}; })}); (c.value || []).forEach(function(s){ addSk(s, 'Trasfondo'); }); }
    });
    if (race) (race.skillProficiencies || []).forEach(function(o, i){
      Object.keys(o).forEach(function(k){ if (SK[k] && o[k] === true) addSk(k, 'Especie'); });
      var cnt = o.any || (o.choose && (o.choose.count || 1)), from = o.any ? ALLSK : o.choose ? o.choose.from : null;
      if (from) { var c = choice({id:'racesk' + i, step:'habil', kind:'many', count:cnt, title:'Habilidad de la especie', options: from.map(function(s){ return {v:s, label:SKES[s] || s, taken: !!D.skills[s]}; })}); (c.value || []).forEach(function(s){ addSk(s, 'Especie'); }); }
    });
    (sp0.skills || []).forEach(function(o, i){
      var cnt = o.any || (o.choose && (o.choose.count || 1)), from = o.any ? ALLSK : o.choose ? o.choose.from : null;
      if (from) { var c = choice({id:'clssk' + i, step:'habil', kind:'many', count:cnt, title:'Habilidades de ' + cls.name, help:'Elige ' + cnt + '. Las que ya tienes por otro lado aparecen marcadas.', options: from.map(function(s){ return {v:s, label:SKES[s] || s, taken: !!D.skills[s]}; })}); (c.value || []).forEach(function(s){ addSk(s, 'Clase'); }); }
    });
    CLS.slice(1).forEach(function(E){
      ((E.cls.multiclassing || {}).proficienciesGained || {}).skills && E.cls.multiclassing.proficienciesGained.skills.forEach(function(o, i){
        var cnt = o.any || (o.choose && (o.choose.count || 1)), from = o.any ? ALLSK : o.choose ? o.choose.from : null;
        if (from) { var c = choice({id:'mcsk' + E.sfx + i, step:'habil', lv:at(E, 1), kind:'many', count:cnt, title:'Habilidad de ' + E.cls.name + ' (multiclase)', help:'Al tomar tu primer nivel de ' + E.cls.name + ' ganas ' + cnt + '.', options: from.map(function(s){ return {v:s, label:SKES[s] || s, taken: !!D.skills[s]}; })}); (c.value || []).forEach(function(s){ addSk(s, E.cls.name); }); }
      });
    });
    D.feats.forEach(function(f){ (f.e.skillProficiencies || []).forEach(function(o, i){ (ch['fsk:' + f.slot + ':' + i] || []).forEach(function(s){ addSk(s, f.e.name); }); }); });
    D.features.filter(function(f){ return f.from === 'Clase' && /^expertise$/i.test(f.name); }).forEach(function(f){
      var c = choice({id:'exp' + f.level, step:'habil', lv:f.level, kind:'many', count:2, title:'Pericia (nivel ' + f.level + ')', help:'Duplica tu bonificador de competencia en dos habilidades que ya domines.', options: Object.keys(D.skills).map(function(s){ return {v:s, label:SKES[s] || s}; })});
      (c.value || []).forEach(function(s){ if (D.skills[s]) D.expert[s] = 1; });
    });
    if (bg && bg.toolProficiencies) bg.toolProficiencies.forEach(function(o){ Object.keys(o).forEach(function(k){ if (o[k] === true) D.tools.push(k); else if (/^any/.test(k)) D.tools.push({anyGamingSet:'Un juego a tu elección', anyMusicalInstrument:'Un instrumento a tu elección', anyArtisansTool:'Herramientas de artesano a tu elección'}[k] || 'Herramienta a tu elección'); }); });
    if (race && race.languageProficiencies) race.languageProficiencies.forEach(function(o){ Object.keys(o).forEach(function(k){ if (o[k] === true && N(k) !== 'common') D.langs.push(k.charAt(0).toUpperCase() + k.slice(1)); }); });
    var stdLangs = L().language.filter(function(l){ return l.source === 'XPHB' && l.type === 'standard' && N(l.name) !== 'common'; });
    var lc = choice({id:'langs', step:'origen', kind:'many', count:2, title:'Idiomas', help:'Además del Común, eliges dos idiomas estándar.', options: stdLangs.map(function(l){ return {v:l.name, label:l.name}; })});
    (lc.value || []).forEach(function(l){ D.langs.push(l); });

    /* ---------- Maestría de armas ---------- */
    var mCount = 0; CLS.forEach(function(E){ mCount = Math.max(mCount, progMax(E.cls.itemMasteriesProgression, E.lv)); });
    if (mCount) {
      var mw = L().baseitem.filter(function(b){ return b.mastery && b.source === 'XPHB' && (D.weapon.indexOf(b.weaponCategory) >= 0); });
      var mc = choice({id:'mastery', step:'niveles', kind:'many', count:mCount, title:'Maestría de armas', help:'Puedes usar la propiedad de maestría de ' + mCount + ' tipos de arma.', options: mw.map(function(b){ return {v:b.name, label:b.name, sub:(b.mastery || []).map(function(m){ return m.split('|')[0]; }).join(', '), detail:{type:'item', ref:'baseitem|' + b.name + '|' + b.source}}; })});
      D.mastery = mc.value || [];
    }

    /* ---------- Rasgos opcionales (invocaciones, maniobras, estilos 2014) ---------- */
    CLS.forEach(function(E){ (E.cls.optionalfeatureProgression || []).concat(E.sub && E.sub.optionalfeatureProgression || []).forEach(function(op){
      var n = progMap(op.progression, E.lv); if (!n) return;
      var pool = L().optionalfeature.filter(function(o){ return (o.featureType || []).some(function(t){ return op.featureType.indexOf(t) >= 0; }) && !/^UA/.test(o.source); });
      var oc = choice({id:'opt:' + N(op.name).replace(/\W+/g, '') + E.sfx, step:'niveles', lv: E.primary ? 1 : at(E, 1), kind:'many', count:n, title:op.name + (D.multi ? ' (' + E.cls.name + ')' : ''), help:'Elige ' + n + '.', search:true, options: pool.map(function(o){
        var lvReq = (o.prerequisite || []).map(function(p){ return p.level ? (typeof p.level === 'number' ? p.level : p.level.level) : 0; })[0] || 0;
        return {v:refKey(o), label:o.name, sub:o.source + (lvReq ? ' · nivel ' + lvReq + '+' : ''), st: lvReq > E.lv ? 'no' : 'ok', detail:{type:'optfeature', ref:refKey(o)}};
      })});
      (oc.value || []).forEach(function(r){ var o = Lib5e.optionalfeature(r); if (o) { D.features.push({name:o.name, from:op.name, e:o}); grantGroups(o, 'o:' + N(o.name), null, 'niveles', oc.id, o.name); } });
    }); });

    /* ---------- Objetos equipados: bonos a salvaciones, conjuros, armas, características y resistencias ---------- */
    var fx = {save:0, spellAtk:0, spellDc:0, weapon:0, resist:[], set:{}, add:{}, notes:[]};
    ((C.rt && C.rt.items) || []).filter(function(i){ return i.eq; }).forEach(function(i){
      var d = itemData(i); if (!d) return;
      var n = function(v){ return parseInt(v, 10) || 0; };
      if (d.bonusSavingThrow) { fx.save += n(d.bonusSavingThrow); fx.notes.push(d.name); }
      if (d.bonusSpellAttack) fx.spellAtk += n(d.bonusSpellAttack);
      if (d.bonusSpellSaveDc) fx.spellDc += n(d.bonusSpellSaveDc);
      if (d.hbWeaponAll) fx.weapon += n(d.hbWeaponAll);
      if (d.ability && typeof d.ability === 'object') {
        if (d.ability.static) Object.keys(d.ability.static).forEach(function(k){ if (ABS.indexOf(k) >= 0) fx.set[k] = Math.max(fx.set[k] || 0, n(d.ability.static[k])); });
        ABS.forEach(function(k){ if (typeof d.ability[k] === 'number') fx.add[k] = (fx.add[k] || 0) + d.ability[k]; });
      }
      (d.resist || []).forEach(function(r){ var t = typeof r === 'string' ? r : null; if (t && fx.resist.indexOf(t) < 0) fx.resist.push(t); });
    });
    D.itemFx = fx;

    /* ---------- Características finales ---------- */
    D.abil = {}; D.mod = {};
    ABS.forEach(function(k){ var cap = caps[k] || 20, b = base[k] || 8; D.abil[k] = Math.min(Math.max(cap, b), b + bonus[k]); if (fx.add[k]) D.abil[k] = Math.min(30, D.abil[k] + fx.add[k]); if (fx.set[k] && fx.set[k] > D.abil[k]) D.abil[k] = fx.set[k]; D.mod[k] = mod(D.abil[k]); });
    D.bonus = bonus;

    /* ---------- Puntos de golpe ---------- */
    /* Reglas 2024: nivel 1 = dado máximo + Con; cada nivel siguiente = valor fijo (mitad del dado + 1) + Con, o tu tirada.
       Las dotes y rasgos que dan PG por nivel cuentan todos tus niveles, también los anteriores a tomarlos. */
    var faces = cls.hd ? cls.hd.faces : 8, avg = faces / 2 + 1, hp = Math.max(1, faces + D.mod.con), hpParts = [], perLevel = [{lv:1, die:faces, faces:faces, avg:avg, cn:cls.name, rolled:false, total:Math.max(1, faces + D.mod.con)}];
    for (var lv = 2; lv <= lvl; lv++) {
      var fE = seqE[lv - 1].cls.hd ? seqE[lv - 1].cls.hd.faces : 8, aE = fE / 2 + 1;
      var r = ch['hp:' + lv], die = r >= 1 && r <= fE ? r : aE, t = Math.max(1, die + D.mod.con);
      hp += t; perLevel.push({lv:lv, die:die, faces:fE, avg:aE, cn:seqE[lv - 1].cls.name, rolled: r >= 1 && r <= fE, total:t});
    }
    function hpBonus(name, per, label){ if (featNames.indexOf(name) >= 0) { hp += per * lvl; hpParts.push(label + ' +' + per * lvl + ' (' + per + ' por nivel)'); } }
    hpBonus('tough', 2, 'Tough'); hpBonus('dwarven toughness', 1, 'Dwarven Toughness'); hpBonus('draconic resilience', 1, 'Draconic Resilience');
    if (featNames.indexOf('boon of fortitude') >= 0) { hp += 40; hpParts.push('Boon of Fortitude +40'); }
    D.hp = {max:hp, faces:faces, avg:avg, notes:hpParts, perLevel:perLevel, con:D.mod.con};
    choice({id:'_hp', step:'niveles', kind:'hp', title:'Puntos de golpe por nivel', check:function(){ return true; }});

    /* ---------- Conjuros ---------- */
    /* Cada clase tiene su característica, trucos y preparados; los espacios se combinan con la tabla de multiclase */
    D.casters = []; D.house = C.house || {};
    var slotCasters = [], pact = null;
    CLS.forEach(function(E){
      var c = E.cls, s2 = E.sub, L1 = E.lv;
      var scAb = c.spellcastingAbility || s2 && s2.spellcastingAbility || null;
      var sl = slotsFor(c, s2, L1);
      if (sl.pact && !pact) pact = sl.pact;
      if (sl.slots.some(function(n){ return n > 0; })) slotCasters.push({E:E, slots:sl.slots});
      var maxLv = 0; sl.slots.forEach(function(n, i){ if (n > 0) maxLv = i + 1; }); if (sl.pact) maxLv = Math.max(maxLv, sl.pact.level);
      var expanded = [];
      [c, s2].forEach(function(o){ if (!o) return; (o.additionalSpells || []).forEach(function(g){ var gr = spellGrants(g, L1); gr.fixed.forEach(function(s){ var e = findSpell(s.ref); if (!e) return; if (s.how === 'expandida') expanded.push(e); else D.extraSpells.push({e:e, how:'siempre preparado', from: o === s2 ? s2.name : c.name}); }); }); });
      if (!scAb) return;
      var listName = spellListOf(c, s2);
      var K = {cls:c, sub:s2, key:E.sfx, name:c.name, list:listName, ability:scAb, dc:8 + D.pb + D.mod[scAb] + fx.spellDc, atk:D.pb + D.mod[scAb] + fx.spellAtk, maxLv:maxLv, cantrips:[], prepared:[], full:false};
      var nCan = progAt(c.cantripProgression || s2 && s2.cantripProgression, L1);
      if (nCan == null) { var tc = tableCol(c, s2, /cantrips/i, L1); nCan = tc != null ? +tc : 0; }
      var nPrep = progAt(c.preparedSpellsProgression, L1) || progAt(c.spellsKnownProgression, L1) || (s2 && (progAt(s2.preparedSpellsProgression, L1) || progAt(s2.spellsKnownProgression, L1)));
      if (!nPrep && c.preparedSpells) { try { nPrep = Math.max(1, Math.floor(Function('return ' + c.preparedSpells.replace(/<\$level\$>/g, L1).replace(/<\$(\w+)_mod\$>/g, function(_, a){ return '(' + D.mod[a] + ')'; }))())); } catch(e){ nPrep = 0; } }
      if (!nPrep) { var tp = tableCol(c, s2, /prepared|spells known/i, L1); nPrep = tp != null ? +tp : 0; }
      K.nCantrips = nCan || 0; K.nPrepared = nPrep || 0;
      var lvOpt = E.primary ? 1 : at(E, 1);
      if (K.nCantrips) { var cc = choice({id:'cantrips' + E.sfx, step:'conjuros', lv:lvOpt, kind:'spells', count:K.nCantrips, title:'Trucos de ' + c.name, filter:'level=0|class=' + listName, extra:expanded.filter(function(e){ return e.level === 0; })}); K.cantrips = (cc.value || []).map(findSpell).filter(Boolean); }
      if (K.nPrepared && maxLv) {
        if (D.house.allSpells) {
          /* Regla de la mesa: toda la lista de la clase cuenta como preparada */
          K.full = true;
          var seen = {}; K.prepared = spellsMatching('class=' + listName, null, {minLevel:1, maxLevel:maxLv}).concat(expanded.filter(function(e){ return e.level > 0 && e.level <= maxLv; })).filter(function(e){ var k = e.name + '|' + e.source; if (seen[k]) return false; seen[k] = 1; return true; });
        } else {
          var pc = choice({id:'spells' + E.sfx, step:'conjuros', lv:lvOpt, kind:'spells', count:K.nPrepared, title:'Conjuros preparados de ' + c.name, help:'Hasta nivel ' + maxLv + '. Los que tu clase o subclase siempre tienen preparados no cuentan.', filter:'class=' + listName, minLevel:1, maxLevel:maxLv, extra:expanded.filter(function(e){ return e.level > 0 && e.level <= maxLv; })});
          K.prepared = (pc.value || []).map(findSpell).filter(Boolean);
        }
      }
      D.casters.push(K);
    });
    if (slotCasters.length >= 2) {
      var clv = 0; slotCasters.forEach(function(x){ clv += casterShare(x.E.cls.casterProgression || x.E.sub && x.E.sub.casterProgression, x.E.lv); });
      D.mcCasterLevel = Math.min(20, clv); D.slots = (MC_SLOTS[D.mcCasterLevel] || []).slice();
    } else D.slots = slotCasters[0] ? slotCasters[0].slots.slice() : [];
    D.pact = pact;
    var maxAll = 0; D.slots.forEach(function(n, i){ if (n > 0) maxAll = i + 1; }); if (pact) maxAll = Math.max(maxAll, pact.level);
    D.maxSpellLevel = maxAll;
    var K0 = D.casters[0];
    if (K0) { D.spellAbility = K0.ability; D.spellDc = K0.dc; D.spellAtk = K0.atk; }
    D.nCantrips = D.casters.reduce(function(t, k){ return t + k.nCantrips; }, 0);
    D.nPrepared = D.casters.reduce(function(t, k){ return t + (k.full ? 0 : k.nPrepared); }, 0);
    D.cantrips = [].concat.apply([], D.casters.map(function(k){ return k.cantrips; }));
    D.prepared = [].concat.apply([], D.casters.map(function(k){ return k.prepared; }));
    D.cantrips = D.cantrips || []; D.prepared = D.prepared || [];

    /* ---------- Recursos de clase ---------- */
    CLS.forEach(function(E){ tableGroups(E.cls, E.sub).forEach(function(g){
      if (g.rowsSpellProgression || !g.rows || !g.rows[E.lv - 1]) return;
      (g.colLabels || []).forEach(function(lab, i){
        var name = strip(lab); if (SKIP_COL.test(name)) return;
        var v = cellVal(g.rows[E.lv - 1][i]); if (v == null || v === 0 || v === '—' || v === '-') return;
        if (D.resources.some(function(x){ return x.key === N(name); })) return;
        D.resources.push({key:N(name), label:RES_ES[N(name)] || name, max: typeof v === 'number' ? v : null, text: typeof v === 'number' ? null : String(v)});
      });
    }); });
    if (featNames.indexOf('lay on hands') >= 0) D.resources.push({key:'lay on hands', label:'Imponer manos', pool:5 * (D.clsLv.paladin || lvl)});
    if (featNames.indexOf('bardic inspiration') >= 0 && !D.resources.some(function(r){ return /bard/.test(r.key); })) D.resources.push({key:'bardic inspiration', label:'Inspiración bárdica', max:Math.max(1, D.mod.cha)});
    if (featNames.indexOf('celestial revelation') >= 0) D.resources.push({key:'celestial revelation', label:'Revelación celestial', max:1});
    if (featNames.indexOf('healing hands') >= 0) D.resources.push({key:'healing hands', label:'Manos sanadoras', max:1});
    if (featNames.indexOf('breath weapon') >= 0) D.resources.push({key:'breath weapon', label:'Arma de aliento', max:D.pb});
    if (featNames.indexOf('relentless endurance') >= 0) D.resources.push({key:'relentless endurance', label:'Aguante incansable', max:1});

    /* ---------- Salvaciones, habilidades, defensas ---------- */
    var auraP = featNames.indexOf('aura of protection') >= 0 ? Math.max(1, D.mod.cha) : 0;
    D.aura = auraP;
    D.save = {}; ABS.forEach(function(k){ D.save[k] = D.mod[k] + (D.saves.indexOf(k) >= 0 ? D.pb : 0) + auraP + fx.save; });
    D.saveItems = fx.save;
    D.skill = {}; ALLSK.forEach(function(s){ D.skill[s] = D.mod[SK[s]] + (D.skills[s] ? D.pb * (D.expert[s] ? 2 : 1) : 0); });
    D.passive = 10 + D.skill.perception;
    D.init = D.mod.dex + (featNames.indexOf('alert') >= 0 ? D.pb : 0);
    var spd = race ? (typeof race.speed === 'number' ? race.speed : race.speed && race.speed.walk) : 30;
    D.speedFt = spd || 30; D.speed = ((spd || 30) / 5 * 1.5).toString().replace('.', ',') + ' m';
    D.size = ch.size || (race && race.size && race.size[0]) || 'M';
    D.darkvision = race && race.darkvision ? race.darkvision : 0;
    D.resist = [];
    (race && race.resist ? race.resist.filter(function(r){ return typeof r === 'string'; }) : []).concat(fx.resist).forEach(function(t){ var es = DT[t] || DT[String(t).charAt(0).toUpperCase()] || t; var full = {acid:'ácido', bludgeoning:'contundente', cold:'frío', fire:'fuego', force:'fuerza', lightning:'relámpago', necrotic:'necrótico', piercing:'perforante', poison:'veneno', psychic:'psíquico', radiant:'radiante', slashing:'cortante', thunder:'trueno'}[N(t)]; es = full || es; if (D.resist.indexOf(es) < 0) D.resist.push(es); });

    /* ---------- Equipo inicial ---------- */
    D.equipChoices = [];
    [['c', cls.startingEquipment, cls.name], ['b', bg && bg.startingEquipment, bg && bg.name]].forEach(function(t){
      eqGroups(t[1]).forEach(function(g, gi){
        var keys = Object.keys(g);
        if (keys.length === 1 && keys[0] === '_') return;
        var c = choice({id:'eq:' + t[0] + gi, step:'equipo', kind:'one', title:'Equipo inicial de ' + t[2], help:'Elige un paquete. Puedes cambiarlo antes de terminar.', options: keys.filter(function(k){ return k !== '_'; }).map(function(k){
          var its = eqItems(g[k]);
          return {v:k, label:'Opción ' + k.toUpperCase(), sub: its.map(function(x){ return (x.q > 1 ? x.q + ' × ' : '') + x.name; }).join(', '), detail:{type:'equip', items:its}};
        })});
      });
    });

    /* ---------- CA y ataques (con el equipo actual) ---------- */
    var items = (C.rt && C.rt.items) || [];
    function itemData(it){ if (!it) return null; if (it.hb) return hbData(it.hb); if (!it.ref) return null; var p = it.ref.split('|'), f = Lib5e.find(p[0], p[1], p[2]); return f && f.e; }
    var armorIt = items.filter(function(i){ return i.eq === 'armor'; })[0], shieldIt = items.filter(function(i){ return i.eq === 'off' && i.slot === 'off'; })[0];
    var ad = itemData(armorIt), ac = 10 + D.mod.dex, acNote = 'Sin armadura';
    if (ad && ad.ac) { var t = (ad.type || '').split('|')[0]; ac = ad.ac + (t === 'HA' ? 0 : t === 'MA' ? Math.min(2, D.mod.dex) : D.mod.dex); var abn = parseInt(ad.bonusAc, 10) || 0; ac += abn; acNote = ad.name + (abn ? ' ' + sgn(abn) : ''); if (ad.stealth) acNote += ' (desventaja en Sigilo)'; if (ad.strength && D.abil.str < parseInt(ad.strength, 10)) acNote += ' (te falta Fuerza ' + ad.strength + ': −3 m de velocidad)'; }
    else if (featNames.indexOf('unarmored defense') >= 0) { var ud = CLS.filter(function(E){ return /^(barbarian|monk)$/.test(N(E.cls.name)); })[0]; if (ud && N(ud.cls.name) === 'barbarian') { ac = 10 + D.mod.dex + D.mod.con; acNote = 'Defensa sin armadura'; } else if (ud) { ac = 10 + D.mod.dex + D.mod.wis; acNote = 'Defensa sin armadura'; } }
    var sd = itemData(shieldIt); if (shieldIt) { var sbn = sd ? parseInt(sd.bonusAc, 10) || 0 : 0; ac += (sd && sd.ac ? sd.ac : 2) + sbn; acNote += ' + escudo' + (sbn ? ' ' + sgn(sbn) : ''); }
    items.filter(function(i){ return i.eq; }).forEach(function(i){ var d = itemData(i); if (d && d.bonusAc) { if (i === armorIt || i === shieldIt) return; ac += parseInt(d.bonusAc, 10) || 0; acNote += ' + ' + d.name; } });
    if (ad && featNames.indexOf('defense') >= 0) { ac += 1; acNote += ' + Defensa'; }
    D.ac = ac; D.acNote = acNote;
    var auraHate = featNames.indexOf('aura of hate') >= 0 ? D.mod.cha : 0, radiant = featNames.indexOf('radiant strikes') >= 0;
    items.filter(function(i){ return i.eq === 'main' || (i.eq === 'off' && i.slot !== 'off'); }).forEach(function(i){
      var d = itemData(i); if (!d || !d.dmg1) return;
      var t = (d.type || '').split('|')[0], props = (d.property || []).map(function(p){ return (typeof p === 'string' ? p : p.uid || '').split('|')[0]; });
      var ranged = t === 'R', ab = ranged ? 'dex' : props.indexOf('F') >= 0 ? (D.mod.dex > D.mod.str ? 'dex' : 'str') : 'str';
      var prof = D.weapon.indexOf(d.weaponCategory) >= 0 || D.weapon.indexOf(N(d.name)) >= 0;
      var magic = (parseInt(d.bonusWeapon, 10) || 0) + fx.weapon;
      var dueling = !ranged && featNames.indexOf('dueling') >= 0 && props.indexOf('2H') < 0 && !items.some(function(o){ return o.eq === 'off' && o !== i && o.slot !== 'off'; }) ? 2 : 0;
      var archery = ranged && featNames.indexOf('archery') >= 0 ? 2 : 0;
      var dmgMod = D.mod[ab] + magic + (!ranged ? auraHate : 0) + dueling;
      var twoFree = !shieldIt && !items.some(function(o){ return o.eq === 'off' && o !== i; });
      var dice = props.indexOf('V') >= 0 && twoFree && d.dmg2 ? d.dmg2 : d.dmg1;
      var extra = []; if (!ranged && radiant) extra.push({dice:'1d8', type:'radiante', note:'Golpes radiantes'});
      if (d.hbExtra) extra.push(d.hbExtra);
      D.attacks.push({id:i.id, name:i.n || d.name, ref:i.ref, ab:ab, atk:D.mod[ab] + (prof ? D.pb : 0) + magic + archery, dice:dice, mod:dmgMod, type:DT[d.dmgType] || d.dmgType || '', extra:extra, ranged:ranged, hb:!!d.hb, hbNotes:d.hb ? d.hb.notes || '' : '',
        notes:[AB[ab] + ' ' + sgn(D.mod[ab])].concat(prof ? ['competencia ' + sgn(D.pb)] : []).concat(!ranged && auraHate ? ['Aura de odio ' + sgn(auraHate)] : []).concat(magic ? ['mágica ' + sgn(magic)] : []).concat(dueling ? ['Duelo +2'] : []).concat(archery ? ['Arquería +2 al ataque'] : []).join(' · '),
        mastery:(d.mastery || []).map(function(m){ return m.split('|')[0]; }).filter(function(m){ return d.hb || !D.mastery || D.mastery.indexOf(d.name) >= 0; })});
    });
    var allSpells = D.cantrips.concat(D.prepared).concat(D.extraSpells.map(function(x){ return x.e; }));
    D.smite = allSpells.some(function(s){ return N(s.name) === 'divine smite'; });

    /* ---------- Requisitos de multiclase (13 en las características de cada clase) ---------- */
    D.mcReqs = [];
    if (D.multi) CLS.forEach(function(E){ var rq = mcReq(E.cls, D.abil); E.req = rq; if (!rq.ok) D.mcReqs.push(E.cls.name + ': ' + rq.text); });

    /* ---------- Resumen de pendientes ---------- */
    D.pending = D.choices.filter(function(c){ return !c.done; });
    D.ok = true;
    return D;
  }

  /* ---------- Armas homebrew ---------- */
  var DT = {S:'cortante', P:'perforante', B:'contundente', A:'ácido', C:'frío', F:'fuego', O:'fuerza', L:'relámpago', N:'necrótico', I:'veneno', Y:'psíquico', R:'radiante', T:'trueno'};
  function hbData(h){
    var k = h.kind || 'weapon', mg = h.magic ? '+' + h.magic : null;
    if (k === 'armor') return {name:h.name, hb:h, type:h.atype || 'HA', ac:h.ac || 10, bonusAc:mg, stealth:!!h.stealth, strength:h.str || null, reqAttune:!!h.attune};
    if (k === 'shield') return {name:h.name, hb:h, type:'S', ac:h.sac || 2, bonusAc:mg, reqAttune:!!h.attune};
    if (k === 'item') {
      var ab = null; if (h.setAb) { ab = {static:{}}; ab.static[h.setAb] = h.setVal; } if (h.addAb) { ab = ab || {}; ab[h.addAb] = h.addVal; }
      return {name:h.name, hb:h, bonusAc:h.bAc ? '+' + h.bAc : null, bonusSavingThrow:h.bSave ? '+' + h.bSave : null, bonusSpellAttack:h.bSpell ? '+' + h.bSpell : null, bonusSpellSaveDc:h.bSpell ? '+' + h.bSpell : null, hbWeaponAll:h.bWeapon || 0, ability:ab, resist:(h.resist || []).map(function(t){ return DT[t] || t; }), reqAttune:!!h.attune};
    }
    if (k !== 'weapon') return {name:h.name, hb:h};
    return {name:h.name, hb:h, dmg1:h.dice, dmg2:h.props.indexOf('V') >= 0 ? h.vdice : null, dmgType:h.dtype, type:h.ranged ? 'R' : 'M', property:h.props.slice(), weaponCategory:h.cat,
      bonusWeapon: h.magic ? '+' + h.magic : null, mastery: h.mastery ? [h.mastery + '|XPHB'] : [], range:h.range || null, weight:h.weight || null,
      hbExtra: h.xdice ? {dice:h.xdice, type:DT[h.xtype] || h.xtype, note:'daño extra'} : null};
  }

  /* ---------- Equipo inicial → objetos del inventario ---------- */
  function startingItems(C, D){
    var out = [], gold = 0;
    [['c', D.cls && D.cls.startingEquipment], ['b', D.bg && D.bg.startingEquipment]].forEach(function(t){
      eqGroups(t[1]).forEach(function(g, gi){
        var k = g._ ? '_' : null, pick = (C.ch || {})['eq:' + t[0] + gi];
        var lists = []; if (g._) lists.push(g._); if (pick && g[pick]) lists.push(g[pick]);
        lists.forEach(function(lst){ eqItems(lst).forEach(function(x){ if (x.kind === 'gold') gold += x.gp; else out.push(x); }); });
      });
    });
    return {items:out, gold:gold};
  }

  return {mcReq:mcReq, MC_SLOTS:MC_SLOTS, srcName:srcName, srcLabel:srcLabel, spellHasClass:spellHasClass, DT:DT, hbData:hbData, ABS:ABS, AB:AB, ABL:ABL, SK:SK, SKES:SKES, STEPS:STEPS, mod:mod, sgn:sgn, strip:strip, derive:derive, classes:classes, subclassesOf:subclassesOf, featRefs:featRefs, spellsMatching:spellsMatching, filterLabel:filterLabel, spellGrants:spellGrants, findSpell:findSpell, featPrereq:featPrereq, startingItems:startingItems, abilitySpec:abilitySpec, altLabel:altLabel, edition:edition, byRef:byRef, subclassLevel:subclassLevel, eqItems:eqItems};
})();
