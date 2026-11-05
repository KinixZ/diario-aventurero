/* ==================== IDENTIDAD POR CLASE Y SUBCLASE ====================
   Cada subclase de 5etools (2014 y 2024) tiene su identidad: dos colores, un emblema (game-icons.net, CC BY 3.0), las
   partículas que flotan en el encabezado y una frase. El diario la toma de tu subclase (o de tu clase, si aún no tienes)
   y la aplica en todo el libro: el acento de los marcos, el medallón del encabezado, la portada y el modo combate. Las
   del grupo (el Oathbreaker y los artífices) traen detalles hechos a mano.
   Además, el libro reacciona a ti:
     vida   a la mitad, una viñeta; a un cuarto, grietas y pulso; a 0 PG, el libro se apaga y late
     CA     más metal y remaches cuanto más alta (cuero, acero, placas, placas ornamentadas)
     estados cada estado y la concentración con su efecto propio y útil (cegado oscurece, envenenado tiñe de verde,
            apresado pone cadenas…), y los estados de clase que activas (Furia, Forma salvaje, Canción del filo…)
   Lo que ve el grupo: el color de tu identidad y tus estados activos viajan en el resumen (char.idc, char.on) y
   marcan tu ficha en el mapa. Se apaga en Ajustes (localStorage['diario-id']). */
var Identidad = (function(){
  var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };
  var KEY = 'diario-id';
  // clase: [acento, secundario, partículas, emblema, nombre]
  var CLS = {
    artificer:['#b8742a', '#e8c27a', 'gears', 'gears', 'Artífice'], barbarian:['#b3261e', '#e8873a', 'embers', 'battle-axe', 'Bárbaro'], bard:['#8a3fb0', '#e8c26a', 'notes', 'lyre', 'Bardo'],
    cleric:['#c9a23a', '#fff3d0', 'motes', 'holy-symbol', 'Clérigo'], druid:['#3f8f4a', '#a8d86a', 'leaves', 'oak-leaf', 'Druida'], fighter:['#6f7d8c', '#d0d6dc', 'sparks', 'crossed-sabres', 'Guerrero'],
    monk:['#d0862a', '#f5d28a', 'motes', 'meditation', 'Monje'], paladin:['#c9a23a', '#5f8fd0', 'motes', 'shield-reflect', 'Paladín'], ranger:['#4f7a3a', '#c9a46a', 'leaves', 'bow-arrow', 'Explorador'],
    rogue:['#4e4e5a', '#a8b0bc', 'shadows', 'cloak-dagger', 'Pícaro'], sorcerer:['#c2307a', '#ff9ad0', 'sparks', 'crystal-growth', 'Hechicero'], warlock:['#5a2a8a', '#b07ae8', 'smoke', 'all-seeing-eye', 'Brujo'],
    wizard:['#2f5d9a', '#8fc0ff', 'runes', 'spell-book', 'Mago'], mystic:['#6a4ab0', '#d0b0ff', 'ripples', 'third-eye', 'Místico']};
  // subclase (clase:nombre corto): [acento, secundario, partículas, emblema, frase, detalles a mano]
  var SUB = {
    'artificer:alchemist':['#3f9a5a', '#c6f08a', 'bubbles', 'round-bottom-flask', 'Todo se puede destilar', {gear:1}],
    'artificer:armorer':['#7d8a99', '#ffb050', 'sparks', 'visored-helm', 'La armadura es el arma', {gear:1, plate:1}],
    'artificer:artillerist':['#c0502a', '#ffd04a', 'embers', 'cannon', 'Fuego a discreción', {gear:1}],
    'artificer:battle smith':['#a8742a', '#8fd0ff', 'sparks', 'anvil', 'Forjado para la pelea, con su defensor al lado', {gear:1}],
    'artificer:cartographer':['#2f7a8a', '#e8d6a0', 'motes', 'treasure-map', 'El mapa ya conoce el camino', {gear:1}],
    'artificer:reanimator':['#4a7a3a', '#b8ff9a', 'sparks', 'raise-zombie', 'Un relámpago y vuelve a latir', {gear:1}],
    'barbarian:berserker':['#a8121a', '#ff5a3a', 'embers', 'battle-axe', 'La furia no se apaga'], 'barbarian:totem warrior':['#7a5a2a', '#c9a46a', 'leaves', 'wolf-head', 'El espíritu de la bestia guía'],
    'barbarian:battlerager':['#6f6f6f', '#c02a2a', 'sparks', 'spiked-mace', 'Pinchos y rabia'], 'barbarian:ancestral guardian':['#5f8fd0', '#d0e4ff', 'smoke', 'tribal-mask', 'Los ancestros pelean contigo'],
    'barbarian:storm herald':['#3a6ab0', '#cfe9ff', 'sparks', 'lightning-arc', 'La tormenta te sigue'], 'barbarian:zealot':['#c9a23a', '#ff8a3a', 'motes', 'sun-priest', 'Los dioses quieren que sigas'],
    'barbarian:beast':['#6a3a1a', '#d0862a', 'shadows', 'beast-eye', 'Garras, colmillos, cola'], 'barbarian:wild magic':['#b048c8', '#8fe0ff', 'sparks', 'magic-swirl', 'La magia se desborda'],
    'barbarian:giant':['#7a6a5a', '#e8d6a0', 'motes', 'mountains', 'Crece como los gigantes'], 'barbarian:wild heart':['#4f7a3a', '#d0862a', 'leaves', 'wolf-howl', 'Corazón de bestia'],
    'barbarian:world tree':['#2f6a3a', '#c9e89a', 'leaves', 'tree-branch', 'Raíces que atraviesan los planos'],
    'bard:lore':['#2f5d9a', '#e8c26a', 'runes', 'open-book', 'Cada historia es un arma'], 'bard:valor':['#b3261e', '#e8c26a', 'sparks', 'crossed-sabres', 'Canciones de batalla'],
    'bard:glamour':['#c0509a', '#ffd0f2', 'petals', 'fairy', 'Encanto feérico'], 'bard:swords':['#7a8796', '#e8c26a', 'sparks', 'sword-clash', 'Acero que baila'],
    'bard:whispers':['#3a3a4a', '#9a7ac0', 'shadows', 'hooded-figure', 'Un rumor que mata'], 'bard:creation':['#d0862a', '#fff1a8', 'stars', 'magic-swirl', 'La canción que hizo el mundo'],
    'bard:eloquence':['#8a3fb0', '#ffe0a0', 'notes', 'scroll-unfurled', 'Nadie discute tus palabras'], 'bard:spirits':['#4a6a8a', '#b0d0ff', 'smoke', 'crystal-ball', 'Los muertos cuentan sus historias'],
    'bard:dance':['#c2307a', '#ffd04a', 'petals', 'drama-masks', 'El ritmo es el arma'], 'bard:moon':['#4a5aa0', '#d0e0ff', 'stars', 'moon-orbit', 'Canciones bajo la luna'],
    'cleric:knowledge':['#2f5d9a', '#e8d6a0', 'runes', 'open-book', 'Todo saber es sagrado'], 'cleric:life':['#d9b866', '#a4ffb8', 'motes', 'heart-plus', 'La vida resiste'],
    'cleric:light':['#ffb030', '#fff6d0', 'motes', 'sunbeams', 'La luz quema la oscuridad'], 'cleric:nature':['#3f8f4a', '#d9b866', 'leaves', 'vine-leaf', 'El dios del bosque'],
    'cleric:tempest':['#2f5d9a', '#cfe9ff', 'sparks', 'lightning-storm', 'Truena la ira divina'], 'cleric:trickery':['#7a3fa0', '#c9e89a', 'shadows', 'duality-mask', 'El engaño también es fe'],
    'cleric:war':['#a8322a', '#d9b866', 'sparks', 'war-pick', 'El dios de la guerra marcha contigo'], 'cleric:death':['#2a1430', '#9c6bb0', 'smoke', 'death-skull', 'El fin es un dios'],
    'cleric:arcana':['#4a5ab0', '#d9b866', 'runes', 'pentagram-rose', 'Magia y fe, una sola'], 'cleric:ambition (psa)':['#8a1a2a', '#d9b866', 'embers', 'crown', 'Toma lo que es tuyo'],
    'cleric:knowledge (psa)':['#2f5d9a', '#d9b866', 'runes', 'gift-of-knowledge', 'El saber del dios'], 'cleric:solidarity (psa)':['#5f8fd0', '#d9b866', 'motes', 'shield', 'Juntos, siempre'],
    'cleric:strength (psa)':['#a8322a', '#e8c26a', 'sparks', 'mighty-force', 'La fuerza es devoción'], 'cleric:zeal (psa)':['#c0502a', '#ffd04a', 'embers', 'flame', 'Arde la fe'],
    'cleric:forge':['#c0502a', '#ffb050', 'embers', 'anvil', 'Forjado en la fe'], 'cleric:grave':['#3a3a4a', '#d0d6dc', 'smoke', 'grim-reaper', 'Cada quien a su hora'],
    'cleric:order':['#5f8fd0', '#e8e0cc', 'motes', 'chess-queen', 'La ley es sagrada'], 'cleric:peace':['#8fd0ff', '#ffffff', 'motes', 'dove', 'Unidos por la paz'],
    'cleric:twilight':['#4a3a8a', '#ffd0a0', 'stars', 'moon-orbit', 'La penumbra protege'],
    'druid:land':['#5a7a3a', '#c9a46a', 'leaves', 'mountains', 'La tierra recuerda'], 'druid:moon':['#4a5aa0', '#d0e0ff', 'stars', 'wolf-howl', 'Mil formas bajo la luna'],
    'druid:dreams':['#5a8aa0', '#ffd0f2', 'petals', 'fairy', 'Sueños del Feywild'], 'druid:shepherd':['#6a8a3a', '#e8d6a0', 'leaves', 'paw-print', 'Los espíritus de los animales'],
    'druid:spores':['#5a4a2a', '#b8c86a', 'smoke', 'mushroom-gills', 'De la podredumbre, vida'], 'druid:stars':['#2a2a6a', '#fff1c9', 'stars', 'star-formation', 'Las constelaciones guían'],
    'druid:wildfire':['#c0502a', '#a8d86a', 'embers', 'fire-ring', 'El fuego que renueva'], 'druid:sea':['#1f6a8a', '#8fe0ff', 'bubbles', 'wave-crest', 'La furia del mar'],
    'fighter:battle master':['#6f7d8c', '#e8c26a', 'sparks', 'chess-knight', 'Cada golpe, una maniobra'], 'fighter:champion':['#c9a23a', '#d0d6dc', 'sparks', 'broadsword', 'Más fuerte, más rápido, mejor'],
    'fighter:eldritch knight':['#4a5ab0', '#8fc0ff', 'runes', 'thunder-blade', 'Espada y conjuro'], 'fighter:purple dragon knight (banneret)':['#6a2a8a', '#e8c26a', 'motes', 'eagle-emblem', 'El estandarte inspira'],
    'fighter:arcane archer':['#2f7a8a', '#b07ae8', 'runes', 'heavy-arrow', 'Flechas encantadas'], 'fighter:cavalier':['#7a5a2a', '#d0d6dc', 'motes', 'chess-knight', 'Nadie pasa'],
    'fighter:samurai':['#a8122a', '#e8e0cc', 'petals', 'crossed-sabres', 'Espíritu indomable'], 'fighter:echo knight':['#3a6ab0', '#b0d0ff', 'shadows', 'shadow-grasp', 'Tu eco pelea contigo'],
    'fighter:psi warrior':['#6a4ab0', '#d0b0ff', 'ripples', 'psychic-waves', 'La mente es la hoja'], 'fighter:rune knight':['#5a7a9a', '#ffb050', 'runes', 'stone-tower', 'Runas de gigantes'],
    'fighter:banneret':['#6a2a8a', '#e8c26a', 'motes', 'eagle-emblem', 'El estandarte inspira'],
    'monk:shadow':['#2a2a3a', '#7a7a9a', 'shadows', 'ninja-heroic-stance', 'Uno con la sombra'], 'monk:four elements':['#2f7a8a', '#ff9a40', 'sparks', 'fire-dash', 'Los cuatro elementos'],
    'monk:open hand':['#d0862a', '#fff3d0', 'motes', 'hand', 'La palma abierta'], 'monk:long death':['#3a3a4a', '#9c6bb0', 'smoke', 'death-skull', 'Estudia la muerte'],
    'monk:drunken master':['#a86a2a', '#ffd04a', 'bubbles', 'meditation', 'Tambalea y golpea'], 'monk:kensei':['#7a8796', '#d0862a', 'sparks', 'broadsword', 'El arma es tu cuerpo'],
    'monk:sun soul':['#ffb030', '#fff6d0', 'motes', 'sunbeams', 'El alma del sol'], 'monk:mercy':['#3a6a5a', '#e8e0cc', 'smoke', 'duality-mask', 'Sana o termina'],
    'monk:astral self':['#4a5aa0', '#b0d0ff', 'stars', 'monk-face', 'Tu yo astral'], 'monk:ascendant dragon':['#a8322a', '#ffd04a', 'embers', 'dragon-head', 'El aliento del dragón'],
    'monk:elements':['#2f7a8a', '#ff9a40', 'sparks', 'fire-dash', 'Los elementos responden'], 'monk:mystic arts':['#6a4ab0', '#ffd04a', 'runes', 'meditation', 'Artes místicas'],
    'mystic:avatar':['#c9a23a', '#ffd0a0', 'motes', 'brain', 'Tu mente inspira'], 'mystic:awakened':['#6a4ab0', '#d0b0ff', 'ripples', 'third-eye', 'Ves más allá'],
    'mystic:immortal':['#a8322a', '#ffb050', 'sparks', 'heart-plus', 'La mente sostiene el cuerpo'], 'mystic:nomad':['#2f7a8a', '#e8d6a0', 'motes', 'compass', 'Ningún lugar te retiene'],
    'mystic:soul knife':['#4a4aa0', '#b0d0ff', 'ripples', 'sacrificial-dagger', 'Una hoja de pensamiento'], 'mystic:wu jen':['#2a6a6a', '#c9e89a', 'runes', 'wizard-staff', 'Los elementos obedecen'],
    'paladin:devotion':['#d9b866', '#ffffff', 'motes', 'holy-symbol', 'Honor y verdad'], 'paladin:ancients':['#3f8f4a', '#d9b866', 'leaves', 'vine-leaf', 'Que la luz siga viva'],
    'paladin:vengeance':['#6a1a2a', '#c02a2a', 'embers', 'bloody-sword', 'Ninguna culpa queda impune'],
    'paladin:oathbreaker':['#6e0f12', '#2a0a0a', 'smoke', 'broken-skull', 'El juramento roto arde todavía', {glow:'#c0202a', smoke:1, cracks:1, aura:'Aura de odio'}],
    'paladin:crown':['#c9a23a', '#5f8fd0', 'motes', 'crown', 'Por la corona y la ley'], 'paladin:conquest':['#3a2a3a', '#c02a2a', 'shadows', 'spiked-mace', 'Que tiemblen'],
    'paladin:redemption':['#5f8fd0', '#ffffff', 'motes', 'dove', 'Toda alma merece otra oportunidad'], 'paladin:glory':['#ffb030', '#fff1a8', 'motes', 'sunbeams', 'La gloria espera'],
    'paladin:watchers':['#2a4a8a', '#cfe9ff', 'stars', 'eye-target', 'Nadie cruza sin que lo veamos'], 'paladin:noble genies':['#2f7a8a', '#ffd04a', 'sparks', 'tornado', 'El poder de los genios'],
    'ranger:beast master':['#6a5a2a', '#c9a46a', 'leaves', 'paw-print', 'Tu bestia y tú'], 'ranger:hunter':['#4f7a3a', '#d0862a', 'leaves', 'hunting-horn', 'Ningún monstruo escapa'],
    'ranger:gloom stalker':['#1a1a2a', '#6a7a9a', 'shadows', 'cowled', 'Cazas en la oscuridad'], 'ranger:horizon walker':['#3a6ab0', '#ffd04a', 'stars', 'portal', 'Guardián de los planos'],
    'ranger:monster slayer':['#6a1a1a', '#e8c26a', 'sparks', 'magnifying-glass', 'Conoce a tu presa'], 'ranger:fey wanderer':['#a04ab0', '#a8d86a', 'petals', 'fairy-wand', 'Errante del Feywild'],
    'ranger:swarmkeeper':['#5a6a2a', '#e8d06a', 'motes', 'bee', 'Nunca estás solo'], 'ranger:drakewarden':['#2f7a5a', '#ffd04a', 'embers', 'dragon-head', 'Tu dragón crece contigo'],
    'ranger:winter walker':['#5a8aa0', '#eafcff', 'frost', 'snowflake-1', 'El invierno no perdona'], 'ranger:hollow warden':['#3a4a2a', '#a8b88a', 'smoke', 'tree-branch', 'Guardián de lo hueco'],
    'rogue:arcane trickster':['#4a3a8a', '#8fc0ff', 'runes', 'magic-swirl', 'Truco y conjuro'], 'rogue:assassin':['#1a1a1a', '#a8121a', 'shadows', 'sacrificial-dagger', 'Un solo golpe'],
    'rogue:thief':['#4e4e5a', '#e8c26a', 'shadows', 'cloak-dagger', 'Lo tuyo es mío'], 'rogue:inquisitive':['#3a4a5a', '#e8d6a0', 'motes', 'magnifying-glass', 'Nada se te escapa'],
    'rogue:mastermind':['#2a3a5a', '#d9b866', 'motes', 'chess-queen', 'Todo es parte del plan'], 'rogue:scout':['#4f6a3a', '#c9a46a', 'leaves', 'compass', 'Siempre un paso adelante'],
    'rogue:swashbuckler':['#a8322a', '#e8c26a', 'sparks', 'sword-clash', 'Con estilo'], 'rogue:phantom':['#3a4a5a', '#b0d0ff', 'smoke', 'haunting', 'Entre los vivos y los muertos'],
    'rogue:soulknife':['#4a4aa0', '#b0d0ff', 'ripples', 'psychic-waves', 'Hojas de la mente'], 'rogue:scion of the three':['#3a1a2a', '#c02a2a', 'shadows', 'death-skull', 'Los tres dioses oscuros'],
    'sorcerer:draconic':['#a8322a', '#ffd04a', 'embers', 'dragon-head', 'Sangre de dragón'], 'sorcerer:wild':['#b048c8', '#8fe0ff', 'sparks', 'magic-swirl', 'El caos te elige'],
    'sorcerer:pyromancer (psk)':['#c0502a', '#ffd04a', 'embers', 'flame', 'El fuego vive en ti'], 'sorcerer:divine soul':['#d9b866', '#ffffff', 'motes', 'angel-wings', 'Un alma tocada por los dioses'],
    'sorcerer:shadow':['#1a1a2a', '#7a6a9a', 'shadows', 'shadow-grasp', 'Nacido de la sombra'], 'sorcerer:storm':['#2f5d9a', '#cfe9ff', 'sparks', 'lightning-storm', 'La tormenta en la sangre'],
    'sorcerer:aberrant mind':['#5a2a6a', '#b8ff9a', 'ripples', 'brain', 'Una mente ajena'], 'sorcerer:clockwork soul':['#b8742a', '#e8e0cc', 'gears', 'clockwork', 'El orden de Mechanus'],
    'sorcerer:lunar':['#4a5aa0', '#e0e8ff', 'stars', 'moon-orbit', 'La luna en tu sangre'], 'sorcerer:aberrant':['#5a2a6a', '#b8ff9a', 'ripples', 'brain', 'Una mente ajena'],
    'sorcerer:clockwork':['#b8742a', '#e8e0cc', 'gears', 'clockwork', 'El orden de Mechanus'], 'sorcerer:wild magic':['#b048c8', '#8fe0ff', 'sparks', 'magic-swirl', 'El caos te elige'],
    'sorcerer:spellfire':['#ff8a2a', '#fff1a8', 'embers', 'sun', 'Fuego de conjuro'],
    'warlock:archfey':['#a04ab0', '#a8ffd0', 'petals', 'fairy', 'Un pacto con la corte feérica'], 'warlock:fiend':['#8a1a1a', '#ff8a3a', 'embers', 'evil-wings', 'Un pacto con el infierno'],
    'warlock:great old one':['#3a2a5a', '#8fd0a0', 'ripples', 'tentacles-skull', 'Lo que susurra desde lejos'], 'warlock:undying':['#3a4a3a', '#c9e89a', 'smoke', 'death-skull', 'No mueres'],
    'warlock:celestial':['#d9b866', '#fff6d0', 'motes', 'angel-wings', 'Luz prestada'], 'warlock:hexblade':['#2a1a3a', '#b07ae8', 'shadows', 'dripping-sword', 'La hoja maldita'],
    'warlock:fathomless':['#1a3a5a', '#8fe0ff', 'bubbles', 'jellyfish', 'Desde el fondo del mar'], 'warlock:genie':['#2f7a8a', '#ffd04a', 'sparks', 'tornado', 'Un pacto con un genio'],
    'warlock:undead':['#2a2a2a', '#b8ff9a', 'smoke', 'raise-zombie', 'La muerte es solo el principio'], 'warlock:vestige':['#4a3a3a', '#d0b0ff', 'smoke', 'haunting', 'El eco de un dios muerto'],
    'wizard:abjuration':['#3a6ab0', '#cfe9ff', 'runes', 'shield-reflect', 'Nada te toca'], 'wizard:conjuration':['#6a4ab0', '#ffd04a', 'sparks', 'portal', 'Aparece lo que pidas'],
    'wizard:divination':['#2a4a8a', '#fff1c9', 'stars', 'crystal-ball', 'Ya lo viste venir'], 'wizard:enchantment':['#c0509a', '#ffd0f2', 'petals', 'fairy-wand', 'Una palabra y obedecen'],
    'wizard:evocation':['#c0502a', '#ffd04a', 'embers', 'fire-ring', 'Poder puro'], 'wizard:illusion':['#7a4ab0', '#a8ffd0', 'sparks', 'duality-mask', 'Nada es lo que parece'],
    'wizard:necromancy':['#2a1430', '#b8ff9a', 'smoke', 'death-skull', 'Los muertos te sirven'], 'wizard:transmutation':['#3f8f4a', '#ffd04a', 'sparks', 'cauldron', 'Todo cambia'],
    'wizard:war':['#a8322a', '#8fc0ff', 'sparks', 'thunder-blade', 'Magia de guerra'], 'wizard:chronurgy':['#5a7a9a', '#ffd04a', 'gears', 'hourglass', 'El tiempo es tuyo'],
    'wizard:graviturgy':['#3a2a5a', '#b0a0ff', 'ripples', 'vortex', 'Todo cae hacia ti'], 'wizard:bladesinging':['#2f6a8a', '#d0e4ff', 'sparks', 'sword-clash', 'La espada que canta'],
    'wizard:scribes':['#5a4a2a', '#e8d6a0', 'runes', 'quill-ink', 'Tu libro está vivo'], 'wizard:abjurer':['#3a6ab0', '#cfe9ff', 'runes', 'shield-reflect', 'Nada te toca'],
    'wizard:diviner':['#2a4a8a', '#fff1c9', 'stars', 'crystal-ball', 'Ya lo viste venir'], 'wizard:evoker':['#c0502a', '#ffd04a', 'embers', 'fire-ring', 'Poder puro'],
    'wizard:illusionist':['#7a4ab0', '#a8ffd0', 'sparks', 'duality-mask', 'Nada es lo que parece'], 'wizard:bladesinger':['#2f6a8a', '#d0e4ff', 'sparks', 'sword-clash', 'La espada que canta'],
    'wizard:conjurer':['#6a4ab0', '#ffd04a', 'sparks', 'portal', 'Aparece lo que pidas'], 'wizard:enchanter':['#c0509a', '#ffd0f2', 'petals', 'fairy-wand', 'Una palabra y obedecen'],
    'wizard:necromancer':['#2a1430', '#b8ff9a', 'smoke', 'death-skull', 'Los muertos te sirven'], 'wizard:transmuter':['#3f8f4a', '#ffd04a', 'sparks', 'cauldron', 'Todo cambia']};
  /* Estados de clase que se activan a mano (por el nombre del rasgo): efecto en el libro y en tu ficha del mapa */
  var ON = [['rage', /^rage$/i, 'Furia', 'embers', '#c0201a', 'Ventaja en Fuerza; resistes contundente, cortante y perforante; +daño con Fuerza.'],
    ['wild', /^wild shape$/i, 'Forma salvaje', 'leaves', '#3f8f4a', 'Usas las estadísticas de la bestia; tus PG temporales absorben el daño.'],
    ['bladesong', /^bladesong$/i, 'Canción del filo', 'sparks', '#5fb8e8', 'Suma Inteligencia a la CA y a las salvaciones de concentración; más velocidad.'],
    ['starry', /^starry form$/i, 'Forma estelar', 'stars', '#fff1c9', 'Arquero, cáliz o dragón: tu constelación brilla.'],
    ['innate', /^innate sorcery$/i, 'Hechicería innata', 'sparks', '#ff9ad0', '+1 a la CD de tus conjuros y ventaja al atacar con ellos.'],
    ['symbiotic', /^symbiotic entity$/i, 'Entidad simbiótica', 'smoke', '#b8c86a', 'PG temporales y +1d6 necrótico cuerpo a cuerpo.'],
    ['ward', /^arcane ward$/i, 'Guardia arcana', 'runes', '#8fc0ff', 'Tu guardia absorbe el daño primero.'],
    ['wrath', /^wrath of the sea$/i, 'Ira del mar', 'bubbles', '#8fe0ff', 'Una emanación de mar a tu alrededor.'],
    ['tides', /^(giant'?s might|giants might)$/i, 'Poder del gigante', 'motes', '#e8d6a0', 'Grande y con ventaja en Fuerza.'],
    ['aura', /^aura of (protection|hate|devotion|warding|courage|alacrity|conquest)$/i, 'Aura', 'motes', '#ffd66e', 'Tu aura alcanza a los cercanos.'],
    ['patient', /^(patient defense|uncanny metabolism)$/i, 'Defensa paciente', 'motes', '#f5d28a', 'Esquivar como acción adicional.'],
    ['dodge', null, 'Esquivando', 'motes', '#d0d6dc', 'Los ataques contra ti tienen desventaja; ventaja en salvaciones de Destreza.']];
  var state = {idk:'', theme:null, on:[], hp:'ok', ac:0, conds:[], conc:false, exh:0, raf:0, parts:[]};

  function cfg(){ try { var c = JSON.parse(localStorage.getItem(KEY) || '{}'); return {off:!!c.off, fx:c.fx !== false}; } catch(e){ return {off:false, fx:true}; } }
  function setCfg(o){ var c = cfg(); Object.keys(o).forEach(function(k){ c[k] = o[k]; }); try { localStorage.setItem(KEY, JSON.stringify(c)); } catch(e){} apply(); paintBox(); }
  function N(s){ return String(s || '').toLowerCase().trim(); }
  /* La identidad de una clase y subclase (nombres en inglés de 5etools) */
  function of(cls, sub){
    var c = CLS[N(cls)] || CLS.fighter, k = N(cls) + ':' + N(sub), s = sub ? SUB[k] : null;
    if (!s && sub) s = guess(N(sub), c);
    var t = s ? {a:s[0], b:s[1], p:s[2], e:s[3], m:s[4] || '', x:s[5] || null, key:k, sub:sub} : {a:c[0], b:c[1], p:c[2], e:c[3], m:'', x:null, key:N(cls), sub:null};
    t.cls = c[4]; t.glow = t.x && t.x.glow || t.a; return t;
  }
  /* Una subclase que no está en la tabla (de libros nuevos): por las palabras de su nombre */
  var WORDS = [[/fire|flame|ember|pyro|inferno|sun/, ['#c0502a', '#ffd04a', 'embers', 'flame']], [/storm|tempest|thunder|lightning/, ['#2f5d9a', '#cfe9ff', 'sparks', 'lightning-storm']], [/frost|ice|winter|cold/, ['#5a8aa0', '#eafcff', 'frost', 'snowflake-1']],
    [/death|grave|necro|undead|undying|shadow|gloom|dark|night|hex/, ['#2a1a2a', '#9c6bb0', 'smoke', 'death-skull']], [/light|radian|dawn|celest|divine|holy|glory/, ['#d9b866', '#fff6d0', 'motes', 'sunbeams']],
    [/nature|wild|land|forest|tree|beast|spore|shepherd/, ['#3f8f4a', '#a8d86a', 'leaves', 'oak-leaf']], [/sea|water|tide|fathom|wave/, ['#1f6a8a', '#8fe0ff', 'bubbles', 'wave-crest']],
    [/dragon|drake|draconic/, ['#a8322a', '#ffd04a', 'embers', 'dragon-head']], [/fey|glamour|dream|archfey/, ['#c0509a', '#ffd0f2', 'petals', 'fairy']], [/star|moon|lunar|astral|cosm/, ['#2a2a6a', '#fff1c9', 'stars', 'moon-orbit']],
    [/mind|psi|aberr|soul|old one/, ['#5a2a6a', '#b8ff9a', 'ripples', 'brain']], [/clock|order|forge|smith|armor|gear/, ['#b8742a', '#e8e0cc', 'gears', 'gears']], [/blade|sword|war|battle|champion|knight/, ['#6f7d8c', '#e8c26a', 'sparks', 'sword-clash']]];
  function guess(sub, c){ for (var i = 0; i < WORDS.length; i++) if (WORDS[i][0].test(sub)) { var w = WORDS[i][1]; return [w[0], w[1], w[2], w[3], '']; } return [c[0], c[1], c[2], c[3], '']; }
  /* Todas las subclases del paquete con su identidad (para la galería de Ajustes y las pruebas) */
  function all(){
    var seen = {}, out = [];
    ((window.Lib5e && Lib5e.get && Lib5e.get() && Lib5e.get().subclass) || []).forEach(function(s){ var k = N(s.className) + ':' + N(s.shortName); if (seen[k]) return; seen[k] = 1; out.push({cls:s.className, sub:s.shortName, name:s.name, t:of(s.className, s.shortName), hand:!!SUB[k]}); });
    return out;
  }
  function onStates(D){ if (!D || !D.features) return []; var names = D.features.map(function(f){ return f.name; }); return ON.filter(function(s){ return s[0] === 'dodge' || names.some(function(n){ return s[1] && s[1].test(n); }); }); }

  /* ---------- Aplicar al libro ---------- */
  function apply(){
    var X = window.Diario, C = X && X.cur(), D = X && X.D(), app = document.querySelector('.app'); if (!app) return;
    var c = cfg(), root = document.documentElement;
    if (!C || !D || !D.ok || c.off) { app.removeAttribute('data-id'); ['--id-a', '--id-b', '--id-glow'].forEach(function(v){ root.style.removeProperty(v); }); app.removeAttribute('data-hp'); app.removeAttribute('data-ac'); app.removeAttribute('data-st'); state.theme = null; emblem(); stop(); return; }
    // la clase de más nivel (y su subclase) manda
    var main = (D.classes || []).slice().sort(function(a, b){ return b.lv - a.lv; })[0], cls = main ? main.cls.name : D.cls && D.cls.name, sub = main && main.sub ? main.sub.shortName || main.sub.name : D.sub ? D.sub.shortName || D.sub.name : null;
    var t = of(cls, sub); state.theme = t; state.idk = t.key;
    root.style.setProperty('--id-a', t.a); root.style.setProperty('--id-b', t.b); root.style.setProperty('--id-glow', t.glow);
    app.setAttribute('data-id', t.key.replace(/[^a-z0-9]+/g, '-'));
    var r = X.rt(C), pct = D.hp.max ? r.hp / D.hp.max : 1;
    state.hp = r.hp <= 0 ? 'down' : pct <= 0.25 ? 'bad' : pct <= 0.5 ? 'hurt' : 'ok'; app.setAttribute('data-hp', state.hp);
    state.ac = D.ac >= 20 ? 4 : D.ac >= 18 ? 3 : D.ac >= 16 ? 2 : D.ac >= 13 ? 1 : 0; app.setAttribute('data-ac', String(state.ac));
    state.conds = (r.conds || []).slice(); state.conc = !!r.conc; state.exh = r.exh || 0; state.on = (r.on || []).filter(function(k){ return onStates(D).some(function(s){ return s[0] === k; }); });
    var st = state.conds.concat(state.conc ? ['conc'] : []).concat(state.on.map(function(k){ return 'on-' + k; })); if (t.x && t.x.aura && state.on.indexOf('aura') >= 0) st.push('aura-hate');
    if (st.length) app.setAttribute('data-st', st.join(' ')); else app.removeAttribute('data-st');
    app.style.setProperty('--exh', String(state.exh));
    app.style.setProperty('--id-on', state.on.length ? stColor(state.on[0]) : 'transparent');
    emblem(); veil(); start();
  }
  /* El emblema en el medallón del encabezado y en la portada; el lienzo de partículas detrás del encabezado */
  function emblem(){
    var t = state.theme, head = document.getElementById('head'), cov = document.querySelector('.cover');
    [head, cov].forEach(function(box){
      if (!box) return; var el = box.querySelector(':scope > .id-emb');
      if (!t) { if (el) el.remove(); return; }
      if (!el) { el = document.createElement('span'); el.className = 'id-emb'; el.setAttribute('aria-hidden', 'true'); box.insertBefore(el, box.firstChild); }
      var html = '<svg class="gi"><use href="#gi-' + t.e + '"/></svg>'; if (el.dataset.e !== t.e) { el.innerHTML = html; el.dataset.e = t.e; }
      el.title = t.sub ? t.sub + ' · ' + t.cls : t.cls;
    });
    if (head && !head.querySelector(':scope > .id-fx')) { var cv = document.createElement('canvas'); cv.className = 'id-fx'; cv.setAttribute('aria-hidden', 'true'); head.insertBefore(cv, head.firstChild); }
    // el borde de metal (y sus remaches) que crece con la CA
    if (head && !head.querySelector(':scope > .id-rim')) { var rim = document.createElement('i'); rim.className = 'id-rim'; rim.setAttribute('aria-hidden', 'true'); head.appendChild(rim); }
  }
  /* El velo del libro: viñeta, grietas y pulso según la vida y los estados (uno solo, encima de todo, sin tocar los clics) */
  function veil(){
    var book = document.getElementById('book'); if (!book) return; var v = document.getElementById('idVeil');
    if (!v) { v = document.createElement('div'); v.id = 'idVeil'; v.className = 'id-veil'; v.setAttribute('aria-hidden', 'true'); v.innerHTML = '<i class="v-vig"></i><i class="v-crack"></i><i class="v-tint"></i><i class="v-chain"></i>'; book.appendChild(v); }
  }

  /* ---------- Partículas del encabezado ---------- */
  function motion(){ return cfg().fx && !(window.Fx && Fx.mode && Fx.mode() === 'off') && !(window.Gfx && Gfx.level && Gfx.level() === 'baja'); }
  function kind(){ var k = state.theme && state.theme.p; for (var i = 0; i < state.on.length; i++) { var s = ON.filter(function(x){ return x[0] === state.on[i]; })[0]; if (s) return s[3]; } return state.theme && state.theme.x && state.theme.x.smoke && state.hp !== 'ok' ? 'embers' : k; }
  function start(){ if (!motion() || state.raf || !state.theme) return; state.last = 0; state.raf = requestAnimationFrame(step); }
  function stop(){ if (state.raf) cancelAnimationFrame(state.raf); state.raf = 0; state.parts = []; var cv = document.querySelector('#head .id-fx'); if (cv && cv.width) { try { var g = cv.getContext('2d'); if (g) g.clearRect(0, 0, cv.width, cv.height); } catch(e){} } }
  function step(t){
    state.raf = 0; var cv = document.querySelector('#head .id-fx'); if (!cv || !state.theme || !motion()) { stop(); return; }
    if (!cv.offsetParent) { state.raf = requestAnimationFrame(step); return; }
    if (t - (state.last || 0) < 42) { state.raf = requestAnimationFrame(step); return; }
    var dt = Math.min(0.1, (t - (state.last || t)) / 1000); state.last = t;
    var w = cv.clientWidth, h = cv.clientHeight; if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    var g = cv.getContext('2d'); g.clearRect(0, 0, w, h);
    var k = kind(), col = [state.theme.a, state.theme.b, state.theme.glow], want = state.hp === 'down' ? 6 : 16 + (state.on.length ? 10 : 0);
    var P = state.parts;
    while (P.length < want) P.push(spawn(k, w, h, col));
    state.parts = P.filter(function(p){ p.life += dt; if (p.life > p.max) return false; p.x += p.vx * dt; p.y += p.vy * dt; p.r += (p.vr || 0) * dt; return p.y > -20 && p.y < h + 20; });
    state.parts.forEach(function(p){ var a = Math.sin(Math.PI * p.life / p.max); g.save(); g.globalAlpha = a * p.o; g.fillStyle = p.c; g.strokeStyle = p.c; g.translate(p.x, p.y); g.rotate(p.r || 0); shape(g, p); g.restore(); });
    state.raf = requestAnimationFrame(step);
  }
  function spawn(k, w, h, col){
    var p = {k:k, x:Math.random() * w, y:h * (0.3 + Math.random() * 0.8), vx:(Math.random() - 0.5) * 8, vy:-6 - Math.random() * 10, life:0, max:2 + Math.random() * 3, s:1.5 + Math.random() * 2.5, c:col[(Math.random() * 3) | 0], o:0.55, r:0};
    if (k === 'leaves' || k === 'petals' || k === 'frost') { p.y = -10 * Math.random(); p.vy = 8 + Math.random() * 10; p.vr = (Math.random() - 0.5) * 2; p.s += 1.5; }
    if (k === 'smoke' || k === 'shadows') { p.s = 6 + Math.random() * 10; p.o = k === 'smoke' ? 0.22 : 0.3; p.vy = -4 - Math.random() * 5; p.c = k === 'smoke' ? (Math.random() < 0.5 ? '#1a0a0a' : col[0]) : '#0a0a12'; }
    if (k === 'gears' || k === 'runes') { p.vy = -2 - Math.random() * 3; p.vr = (Math.random() - 0.5) * 1.2; p.s = 4 + Math.random() * 3; p.o = 0.45; }
    if (k === 'ripples') { p.vy = 0; p.vx = 0; p.vr = 0; p.s = 2; p.grow = 10 + Math.random() * 10; }
    if (k === 'stars' || k === 'sparks') { p.vy = (Math.random() - 0.5) * 6; p.max = 0.8 + Math.random() * 1.4; }
    if (k === 'bubbles') { p.vy = -10 - Math.random() * 10; p.s = 2 + Math.random() * 3; }
    return p;
  }
  function shape(g, p){
    var s = p.s;
    switch (p.k) {
      case 'leaves': case 'petals': g.beginPath(); g.ellipse(0, 0, s * 1.6, s * 0.7, 0, 0, Math.PI * 2); g.fill(); break;
      case 'frost': g.lineWidth = 1; g.beginPath(); for (var i = 0; i < 3; i++) { var a = i * Math.PI / 3; g.moveTo(-Math.cos(a) * s * 1.5, -Math.sin(a) * s * 1.5); g.lineTo(Math.cos(a) * s * 1.5, Math.sin(a) * s * 1.5); } g.stroke(); break;
      case 'smoke': case 'shadows': g.beginPath(); g.arc(0, 0, s * (0.6 + p.life / p.max), 0, Math.PI * 2); g.fill(); break;
      case 'gears': g.lineWidth = 1.4; g.beginPath(); g.arc(0, 0, s, 0, Math.PI * 2); g.stroke(); for (var j = 0; j < 6; j++) { var b = j * Math.PI / 3; g.fillRect(Math.cos(b) * s - 1, Math.sin(b) * s - 1, 2.4, 2.4); } break;
      case 'runes': g.lineWidth = 1.3; g.beginPath(); g.moveTo(-s, -s); g.lineTo(0, s); g.lineTo(s, -s); g.moveTo(-s * 0.5, 0); g.lineTo(s * 0.5, 0); g.stroke(); break;
      case 'notes': g.beginPath(); g.ellipse(0, s, s * 0.9, s * 0.65, -0.4, 0, Math.PI * 2); g.fill(); g.fillRect(s * 0.6, -s * 2, 1.4, s * 3); break;
      case 'ripples': g.lineWidth = 1; g.beginPath(); g.arc(0, 0, s + p.grow * p.life / p.max, 0, Math.PI * 2); g.stroke(); break;
      case 'bubbles': g.lineWidth = 1; g.beginPath(); g.arc(0, 0, s, 0, Math.PI * 2); g.stroke(); break;
      case 'stars': case 'sparks': g.beginPath(); g.moveTo(0, -s * 1.6); g.lineTo(s * 0.4, 0); g.lineTo(0, s * 1.6); g.lineTo(-s * 0.4, 0); g.closePath(); g.fill(); g.beginPath(); g.moveTo(-s * 1.6, 0); g.lineTo(0, s * 0.4); g.lineTo(s * 1.6, 0); g.lineTo(0, -s * 0.4); g.closePath(); g.fill(); break;
      default: g.beginPath(); g.arc(0, 0, s * 0.8, 0, Math.PI * 2); g.fill();
    }
  }
  /* Un destello de un momento (canalizar divinidad, oleada de acción, segundo aliento…) */
  function flash(kind, label){
    if (!motion() || !state.theme) return; var b = document.getElementById('book'); if (!b) return;
    var el = document.createElement('div'); el.className = 'id-flash ' + (kind || ''); el.innerHTML = '<svg class="gi"><use href="#gi-' + state.theme.e + '"/></svg>' + (label ? '<b>' + esc(label) + '</b>' : ''); b.appendChild(el); setTimeout(function(){ el.remove(); }, 1400);
  }

  /* ---------- Las piezas que usa el diario ---------- */
  /* Tarjeta de identidad (en la hoja) */
  function card(){
    var t = state.theme; if (!t) return '';
    return '<div class="card id-card"><span class="id-big"><svg class="gi"><use href="#gi-' + t.e + '"/></svg></span><div class="id-txt"><span class="label">identidad</span><b>' + esc(t.sub || t.cls) + '</b>' + (t.m ? '<i>«' + esc(t.m) + '»</i>' : '') + '<small>' + esc(t.cls) + (t.x ? ' · con detalles hechos a mano' : '') + '</small></div><span class="id-sw" style="background:linear-gradient(135deg,' + t.a + ',' + t.b + ')"></span></div>';
  }
  /* Los estados de clase que puedes activar (en el modo combate) */
  function toggles(D){
    var C = window.Diario && Diario.cur(); if (!C || !D || !D.ok) return ''; var r = Diario.rt(C), on = r.on || [], list = onStates(D); if (!list.length) return '';
    return '<div class="id-on" role="group" aria-label="Estados de clase">' + list.map(function(s){ return '<button type="button" class="chip id-onb' + (on.indexOf(s[0]) >= 0 ? ' on' : '') + '" data-act="idon" data-v="' + s[0] + '" aria-pressed="' + (on.indexOf(s[0]) >= 0) + '" title="' + esc(s[5]) + '" style="--sc:' + s[4] + '">' + esc(s[2]) + '</button>'; }).join('') + '</div>';
  }
  function summary(){ var t = state.theme; if (!t || cfg().off) return {}; return {idc:t.a, idk:t.key, on:state.on.slice(0, 6)}; }
  function stName(k){ var s = ON.filter(function(x){ return x[0] === k; })[0]; return s ? s[2] : k; }
  function stColor(k){ var s = ON.filter(function(x){ return x[0] === k; })[0]; return s ? s[4] : '#ffd66e'; }
  function paintBox(){
    var box = document.getElementById('idBox'); if (!box) return; var c = cfg(), list = all(), hand = list.filter(function(x){ return x.hand; }).length;
    box.innerHTML = '<label class="toggle"><input type="checkbox" id="idOn"' + (c.off ? '' : ' checked') + '> Identidad de clase y libro que reacciona (vida, CA y estados)</label>'
      + '<label class="toggle"><input type="checkbox" id="idFx"' + (c.fx ? ' checked' : '') + (c.off ? ' disabled' : '') + '> Partículas en el encabezado</label>'
      + '<p class="note">' + (list.length ? list.length + ' subclases con identidad (' + hand + ' hechas a mano). ' : '') + 'Sale de tu subclase (o de tu clase de más nivel).</p>'
      + (list.length ? '<details class="feat-d id-gal"><summary><b>Ver todas</b><small>' + list.length + '</small></summary><div class="id-grid">' + list.map(function(x){ return '<span class="id-g" title="' + esc(x.name + ' · ' + x.t.cls + (x.t.m ? ' — ' + x.t.m : '')) + '" style="--ia:' + x.t.a + ';--ib:' + x.t.b + '"><svg class="gi"><use href="#gi-' + x.t.e + '"/></svg><small>' + esc(x.sub) + '</small></span>'; }).join('') + '</div></details>' : '');
  }
  document.addEventListener('change', function(ev){ var t = ev.target; if (t.id === 'idOn') setCfg({off:!t.checked}); else if (t.id === 'idFx') { setCfg({fx:t.checked}); if (!t.checked) stop(); } });
  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('[data-act="idon"]'); if (!b || !window.Diario) return;
    var C = Diario.cur(); if (!C) return; var r = Diario.rt(C), k = b.dataset.v; r.on = r.on || [];
    if (r.on.indexOf(k) >= 0) r.on = r.on.filter(function(x){ return x !== k; }); else { r.on.push(k); flash('on-' + k, stName(k)); if (window.Sfx) Sfx.play(k === 'rage' ? 'crit' : 'spell'); }
    Diario.save(); Diario.renderAll();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(paintBox, 0); }); else setTimeout(paintBox, 0);
  return {of:of, all:all, apply:apply, card:card, toggles:toggles, summary:summary, flash:flash, paint:paintBox, stName:stName, stColor:stColor, ON:ON, SUB:SUB, CLS:CLS, _state:function(){ return state; }};
})();
