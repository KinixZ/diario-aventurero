/* ==================== ICONOS DE JUEGO (game-icons.net, CC BY 3.0) ====================
   Lorc, Delapouite y colaboradores de game-icons.net. Licencia: https://creativecommons.org/licenses/by/3.0/
   El build (tools/build-web.mjs) lee la lista GI de abajo y arma web/dist/iconos.svg solo con esos.
   El archivo se baja en segundo plano; mientras llega, el recuadro se ve con el color de su escuela.
   Un conjuro recibe su icono por, en orden: su nombre (los conocidos), si cura, su daño, el estado que impone,
   lo que hace (teletransporte, invocar, luz…) y por último su escuela. */
var Iconos = (function(){
  // --- lista que el build empaqueta (todas las que aparecen abajo) ---
  var GI = ['fire-ray','fireball','frozen-orb','ice-bolt','lightning-arc','sonic-boom','acid','poison-bottle','death-skull','sunbeams','psychic-waves','mighty-force','sword-wound','pierced-body','hammer-drop',
    'charm','terror','manacles','spider-web','blindfold','knockout','invisible','falling','stone-bust','dread','silenced','sleepy','heart-plus','healing','magic-shield','teleport','pentacle','light-bulb','candle-light','eye-target',
    'portal','crystal-ball','brain','bolt-spell-cast','mirror-mirror','raise-zombie','magic-swirl','shield-reflect','holy-symbol','fog','missile-swarm','divert','pentagram-rose','beam-wake','gift-of-knowledge','hand','angel-wings',
    'sprint','slow-blob','ghost','vine-whip','sparkles','wolf-head','meteor-impact','spinning-sword','breastplate','wizard-staff','oak-leaf','paw','wolf-howl','music-spell','tornado','earth-crack','wave-crest','barbed-coil','moon','ringing-bell',
    'thorny-vine','firewall','target-arrows','shouting','magnifying-glass','owl','horse-head','time-trap','hourglass','dragon-breath','spell-book','smoking-finger','sound-waves','dark-squad','burning-skull','muscle-up','fist','claws','tree-branch'];
  var DMG = {fire:'fire-ray', cold:'frozen-orb', lightning:'lightning-arc', thunder:'sonic-boom', acid:'acid', poison:'poison-bottle', necrotic:'death-skull', radiant:'sunbeams', psychic:'psychic-waves', force:'mighty-force', slashing:'sword-wound', piercing:'pierced-body', bludgeoning:'hammer-drop'};
  var COND = {charmed:'charm', frightened:'terror', paralyzed:'manacles', restrained:'spider-web', blinded:'blindfold', stunned:'knockout', invisible:'invisible', prone:'falling', petrified:'stone-bust', incapacitated:'dread', poisoned:'poison-bottle', deafened:'silenced', unconscious:'sleepy', grappled:'manacles'};
  var MISC = {HL:'heart-plus', THP:'magic-shield', TP:'teleport', SMN:'pentacle', LGT:'candle-light', SGT:'eye-target'};
  var SCHOOL = {A:'magic-shield', C:'portal', D:'crystal-ball', E:'brain', V:'bolt-spell-cast', I:'mirror-mirror', N:'raise-zombie', T:'magic-swirl'};
  var NAME = {'fireball':'fireball', 'magic missile':'missile-swarm', 'shield':'shield-reflect', 'healing word':'healing', 'mass healing word':'healing', 'cure wounds':'heart-plus', 'mass cure wounds':'heart-plus', 'heal':'healing', 'mass heal':'healing', 'prayer of healing':'healing', 'revivify':'heart-plus',
    'bless':'holy-symbol', 'bane':'death-skull', 'hold person':'manacles', 'hold monster':'manacles', 'web':'spider-web', 'fog cloud':'fog', 'darkness':'dark-squad', 'misty step':'teleport', 'dimension door':'portal', 'teleport':'teleport', 'banishment':'portal', 'counterspell':'divert', 'hex':'pentagram-rose',
    'eldritch blast':'beam-wake', 'sacred flame':'sunbeams', 'guidance':'gift-of-knowledge', 'light':'light-bulb', 'mage hand':'hand', 'invisibility':'invisible', 'greater invisibility':'invisible', 'fly':'angel-wings', 'haste':'sprint', 'slow':'slow-blob', 'thunderwave':'sonic-boom', 'lightning bolt':'lightning-arc',
    'ice storm':'ice-bolt', 'spirit guardians':'ghost', 'entangle':'vine-whip', 'faerie fire':'sparkles', 'sleep':'sleepy', 'polymorph':'wolf-head', 'meteor swarm':'meteor-impact', 'spiritual weapon':'spinning-sword', 'mage armor':'breastplate', 'shield of faith':'magic-shield', 'mirror image':'mirror-mirror',
    'detect magic':'crystal-ball', 'identify':'magnifying-glass', 'fire bolt':'fire-ray', 'ray of frost':'ice-bolt', 'shocking grasp':'lightning-arc', 'vicious mockery':'music-spell', 'minor illusion':'mirror-mirror', 'prestidigitation':'sparkles', 'thaumaturgy':'sparkles', 'druidcraft':'oak-leaf',
    'shillelagh':'wizard-staff', 'thorn whip':'vine-whip', 'produce flame':'candle-light', 'speak with animals':'paw', 'animal friendship':'wolf-head', 'conjure animals':'wolf-howl', 'find familiar':'owl', 'find steed':'horse-head', 'find greater steed':'horse-head', 'call lightning':'lightning-arc', 'moonbeam':'moon',
    'toll the dead':'ringing-bell', 'spike growth':'thorny-vine', 'wall of fire':'firewall', 'wall of thorns':'thorny-vine', "hunter's mark":'target-arrows', 'command':'shouting', 'time stop':'hourglass', 'dragon\'s breath':'dragon-breath', 'whirlwind':'tornado', 'earthquake':'earth-crack', 'tidal wave':'wave-crest',
    'divine smite':'sword-wound', 'searing smite':'fire-ray', 'thunderous smite':'sonic-boom', 'wrathful smite':'terror', 'branding smite':'sunbeams', 'blinding smite':'blindfold', 'staggering smite':'knockout', 'banishing smite':'portal', 'shining smite':'sunbeams', 'chill touch':'death-skull',
    'enhance ability':'muscle-up', 'hellish rebuke':'fire-ray', 'armor of agathys':'frozen-orb', 'arms of hadar':'barbed-coil', 'power word kill':'death-skull', 'power word stun':'knockout', 'wish':'sparkles', 'thorn':'tree-branch', 'magic weapon':'spinning-sword', 'aid':'heart-plus', 'lesser restoration':'healing', 'greater restoration':'healing'};
  /* Colores por escuela (fondo del recuadro, como en los juegos) */
  var SCOL = {A:'#2f6fa8', C:'#c08a25', D:'#5f8fb0', E:'#b3478f', V:'#c0392b', I:'#6a4fb0', N:'#3f5a3c', T:'#2f8f86'};
  var SES = {A:'Abjuración', C:'Conjuración', D:'Adivinación', E:'Encantamiento', V:'Evocación', I:'Ilusión', N:'Nigromancia', T:'Transmutación'};

  function spellIcon(e){
    if (!e) return 'magic-swirl';
    var n = String(e.name || '').toLowerCase().replace(/\s*\(.*\)$/, '');
    if (NAME[n]) return NAME[n];
    var misc = e.miscTags || [];
    if (misc.indexOf('HL') >= 0) return 'heart-plus';
    var d = (e.damageInflict || [])[0]; if (d && DMG[d]) return DMG[d];
    var c = (e.conditionInflict || [])[0]; if (c && COND[c]) return COND[c];
    for (var i = 0; i < misc.length; i++) if (MISC[misc[i]]) return MISC[misc[i]];
    return SCHOOL[e.school] || 'magic-swirl';
  }
  /* Recuadro del icono de un conjuro: color de su escuela y el dibujo encima */
  function spellTile(e, cls){
    var sc = e && e.school || 'V', ic = spellIcon(e);
    return '<span class="gi-tile' + (cls ? ' ' + cls : '') + '" style="--sc:' + (SCOL[sc] || '#7a5a12') + '" title="' + (SES[sc] || '') + '" aria-hidden="true"><svg class="gi"><use href="#gi-' + ic + '"/></svg></span>';
  }

  /* Se baja el paquete de iconos una vez y se mete al documento */
  var loaded = false;
  function load(){
    if (loaded || document.getElementById('giSprite')) return; loaded = true;
    if (window.DIARIO_ICONS) { put(window.DIARIO_ICONS); return; }
    if (typeof window.fetch !== 'function') { loaded = false; return; }
    var v = window.DIARIO_CONFIG && (DIARIO_CONFIG.icons || DIARIO_CONFIG.version);
    fetch('iconos.svg' + (v ? '?v=' + encodeURIComponent(v) : '')).then(function(r){ return r.ok ? r.text() : ''; }).then(function(t){ if (t) put(t); }).catch(function(){ loaded = false; });
  }
  function put(svg){ var d = document.createElement('div'); d.id = 'giSprite'; d.setAttribute('aria-hidden', 'true'); d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'; d.innerHTML = svg; document.body.appendChild(d); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(load, 300); }); else setTimeout(load, 300);

  return {GI:GI, spellIcon:spellIcon, spellTile:spellTile, load:load, SCOL:SCOL};
})();
