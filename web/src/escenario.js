/* ==================== ESCENARIO DE PRUEBA ====================
   Para probar todo de una vez. El DM, con un toque desde su panel, recibe en su campaña:
   · «Cripta del juramento (prueba)»: una mazmorra de noche y a oscuras con la visión puesta: vestíbulo, pasillo con
     escombros (terreno difícil) y una trampa, la cripta con columnas, sarcófago, altar y braseros, una sala lateral con
     una puerta secreta y un cofre; antorchas que alumbran, un texto al entrar y una salida al bosque.
   · «Claro del bosque (prueba)»: de día, con fogata, tienda, carreta y la vuelta a la cripta.
   · Dos encuentros: «Emboscada en la cripta» (goblins en la cripta y una segunda oleada que llega en la ronda 2, con
     zona de despliegue en el vestíbulo) y «Bandidos en el camino» (sin mapa, para el combate de teatro de la mente).
   Con el Manual de Monstruos cargado usa sus fichas; si no, números a mano.
   Al jugador: tres personajes de prueba (paladín, maga y pícaro) para entrar con uno. */
var Escenario = (function(){
  var MAP_A = 'prueba-cripta', MAP_B = 'prueba-bosque';
  function room(){ return window.Sala && Sala.status() === 'on' ? Sala.room() : null; }
  function sid(){ return 's' + Math.random().toString(36).slice(2, 9); }
  /* Un objeto del mapa centrado en (x, y) casillas */
  function obj(a, x, y, l){
    var inf = window.Assets && Assets.info(a) || {w:1, h:1};
    return {k:'asset', a:a, l:l || 'l1', pts:[x, y], s:inf.w, h:inf.h, id:sid()};
  }
  /* Paredes: un tramo con huecos (las puertas van aparte) */
  var W = [];
  function wall(ax, ay, bx, by, t, o){ W.push(Object.assign({id:'w' + W.length + Math.random().toString(36).slice(2, 5), a:[ax, ay], b:[bx, by], t:t || 'wall'}, o || {})); }
  function hline(y, x1, x2, gaps){ var cur = x1; (gaps || []).forEach(function(g){ if (g[0] > cur) wall(cur, y, g[0], y); if (g[2]) wall(g[0], y, g[1], y, g[2], g[3]); cur = g[1]; }); if (x2 > cur) wall(cur, y, x2, y); }
  function vline(x, y1, y2, gaps){ var cur = y1; (gaps || []).forEach(function(g){ if (g[0] > cur) wall(x, cur, x, g[0]); if (g[2]) wall(x, g[0], x, g[1], g[2], g[3]); cur = g[1]; }); if (y2 > cur) wall(x, cur, x, y2); }

  function cripta(){
    W = [];
    // vestíbulo (2..10 × 6..13), con salida al oeste (al bosque); arriba, la sala lateral (2..15 × 1..6) con su puerta
    hline(6, 2, 15, [[5, 6, 'door']]); hline(13, 2, 10); vline(2, 1, 13, [[9, 10]]); vline(10, 6, 13, [[9, 10, 'door']]);
    // pasillo (10..15 × 8..11)
    hline(8, 10, 15); hline(11, 10, 15);
    // la cripta (15..25 × 1..17): entra el pasillo, una puerta secreta desde la sala lateral, un muro bajo junto al altar y una ventana alta
    hline(1, 2, 25, [[19, 20, 'window']]); hline(17, 15, 25); vline(15, 1, 17, [[3, 4, 'secret'], [9, 10]]); vline(25, 1, 17); wall(21, 12, 23, 12, 'low');
    var S = [
      obj('antorcha', 3, 6.5), obj('antorcha', 9, 6.5), obj('antorcha', 12.5, 8.5),
      obj('barril', 3.5, 11.5), obj('barril', 4.5, 11.5), obj('caja', 3.5, 12.4), obj('telarana', 9.5, 12.5), obj('huesos', 7.5, 11.5),
      obj('mesa', 5, 3), obj('silla', 4, 3), obj('silla', 6, 3), obj('cofre', 13.5, 2), obj('vela', 5, 2.4), obj('libreria', 3.5, 1.6),
      obj('escombros', 12.5, 9.5), obj('escombros', 13.5, 10.5),
      obj('columna', 17.5, 4.5), obj('columna', 22.5, 4.5), obj('columna', 17.5, 13.5), obj('columna', 22.5, 13.5),
      obj('sarcofago', 20, 9), obj('altar', 23.5, 9), obj('brasero', 23.5, 6.5), obj('brasero', 23.5, 11.5), obj('estatua', 16.5, 2), obj('huesos', 19, 15.5), obj('alfombra', 20, 9)
    ];
    // la alfombra va debajo de todo
    S.sort(function(a, b){ return (a.a === 'alfombra' ? -1 : 0) - (b.a === 'alfombra' ? -1 : 0); });
    return {map:{id:MAP_A, name:'Cripta del juramento (prueba)', cols:26, rows:18, grid:'square', layers:[{id:'l1', name:'Suelo'}], strokes:S, hidden:true}, walls:W.slice()};
  }
  function bosque(){
    var S = [obj('arbol', 2, 2), obj('arbol', 5, 1.5), obj('pino', 16, 2), obj('pino', 18, 4), obj('arbol', 17.5, 11), obj('arbusto', 7, 12), obj('arbusto', 12, 1.5), obj('roca', 13, 10), obj('rocas', 3, 9),
      obj('fogata', 10, 7), obj('tronco', 8.5, 7), obj('tronco', 11.5, 7.5), obj('tienda', 6, 5), obj('carreta', 14, 6), obj('agua', 3, 12.5), obj('hongos', 15.5, 12.5)];
    return {map:{id:MAP_B, name:'Claro del bosque (prueba)', cols:20, rows:14, grid:'square', layers:[{id:'l1', name:'Suelo'}], strokes:S}};
  }
  /* Un enemigo del Manual si está (por nombre, prefiere 2024) o a mano */
  function foe(names, fb){
    if (window.Bestiario && Bestiario.search) for (var i = 0; i < names.length; i++) { var want = names[i].toLowerCase(), h = Bestiario.search(names[i], 8) || []; var hit = h.filter(function(x){ return String(x.ref || '').split('|')[0].toLowerCase() === want; })[0]; var n = hit && Bestiario.npcOf(hit.ref); if (n) return n; }
    return {name:fb[0], ac:fb[1], hp:fb[2], initMod:fb[3], formula:null, ref:null, binfo:null, s:1};
  }
  function npc(base, x, y, wave){ return {name:base.name, ac:base.ac, hp:base.hp, hpMax:base.hp, ref:base.ref || null, initMod:base.initMod || 0, formula:base.formula || null, binfo:base.binfo || null, s:base.s || 1, reach:base.reach || 1, x:x, y:y, wave:wave || 1, hidden:false}; }

  /* El DM: todo de una vez (se puede repetir: reemplaza los mapas y agrega los encuentros otra vez) */
  function dm(){
    var r = room(); if (!r || r.role !== 'dm') { if (window.Sala && Sala.toast) Sala.toast('Abre tu campaña como DM para preparar el escenario.'); return Promise.resolve(false); }
    var wait = window.Bestiario && Bestiario.ready ? Promise.race([Bestiario.ready(), new Promise(function(res){ setTimeout(res, 3000); })]).catch(function(){}) : Promise.resolve();
    return wait.then(build);
  }
  function build(){
    var A = cripta(), B = bosque();
    Sala.send({t:'map.save', map:A.map}); Sala.send({t:'map.save', map:B.map});
    Sala.send({t:'wall.add', id:MAP_A, walls:A.walls});
    Sala.send({t:'map.light', id:MAP_A, light:{time:'noche', amb:'dark', wx:'despejado'}});
    Sala.send({t:'map.vis', id:MAP_A, on:true, range:0, lines:'auto'});
    Sala.send({t:'map.light', id:MAP_B, light:{time:'dia', amb:'auto', wx:'viento'}});
    // zonas: salida al bosque y vuelta, texto al entrar, escombros (terreno difícil) y una trampa en el pasillo
    Sala.send({t:'trig.add', id:MAP_A, trig:{id:'z-salida', k:'paso', x:0, y:9, w:2, h:1, name:'Salida al bosque', to:{map:MAP_B, zid:'z-cripta'}}});
    Sala.send({t:'trig.add', id:MAP_B, trig:{id:'z-cripta', k:'paso', x:0, y:6, w:1, h:2, name:'Entrada a la cripta', to:{map:MAP_A, zid:'z-salida'}}});
    Sala.send({t:'trig.add', id:MAP_A, trig:{id:'z-texto', k:'texto', x:2, y:7, w:3, h:5, name:'Vestíbulo', text:'Huele a humedad y a cera vieja. Al fondo del pasillo, una luz roja late como un corazón.', once:true}});
    Sala.send({t:'trig.add', id:MAP_A, trig:{id:'z-escombros', k:'dificil', x:12, y:9, w:2, h:2, name:'Escombros'}});
    Sala.send({t:'trig.add', id:MAP_A, trig:{id:'z-trampa', k:'trampa', x:14, y:9, w:1, h:1, name:'Losa suelta', text:'Salvación de Destreza CD 12 o 2d6 de daño perforante (dardos).', say:true}});
    // encuentros
    var gob = foe(['Goblin Warrior', 'Goblin'], ['Goblin', 15, 10, 2]), arq = foe(['Goblin Minion', 'Goblin'], ['Goblin arquero', 13, 7, 2]), jefe = foe(['Goblin Boss', 'Hobgoblin Captain', 'Hobgoblin'], ['Jefe goblin', 17, 21, 2]);
    Sala.send({t:'enc.save', enc:{name:'Emboscada en la cripta (prueba)', map:MAP_A, notes:'Los goblins esperan en la cripta. En la ronda 2 entra el jefe con su arquero desde la sala lateral (por la puerta secreta o por el vestíbulo). Prueba: movimiento, cobertura (columnas y muro bajo), terreno difícil, la trampa y la visión a oscuras.',
      npcs:[npc(gob, 18, 7), npc(gob, 18, 11), npc(arq, 22, 15), npc(jefe, 7, 3, 2), npc(arq, 6, 4, 2)],
      deploy:[{id:'d-vestibulo', x:3, y:7, w:6, h:5, name:'Vestíbulo'}], waves:[{n:1, name:'Guardia'}, {n:2, name:'Refuerzos', round:2}]}});
    var ban = foe(['Bandit', 'Tough'], ['Bandido', 12, 11, 1]), cap = foe(['Bandit Captain', 'Bandit Deceiver'], ['Capitán bandido', 15, 52, 3]);
    Sala.send({t:'enc.save', enc:{name:'Bandidos en el camino (prueba, sin mapa)', notes:'Combate sin mapa: la escena de combate, las tarjetas, las salvaciones y el daño oculto.', npcs:[npc(ban), npc(ban), npc(cap)], deploy:[], waves:[{n:1}]}});
    Sala.send({t:'scene.set', id:MAP_A});
    Sala.send({t:'map.state', id:MAP_A, state:'explore'});
    if (Sala.toast) Sala.toast('Escenario de prueba listo: dos mapas y dos encuentros. Ve a Encuentros para empezar uno.');
    return true;
  }

  /* El jugador: personajes de prueba (se pueden completar o cambiar en el creador) */
  var PJS = [
    {id:'prueba-pal', name:'Lyra (prueba)', level:5, method:'array', base:{str:15, dex:10, con:14, int:8, wis:12, cha:13}, ch:{cls:'Paladin|XPHB', sub:'Oathbreaker|DMG', race:'Aasimar|XPHB', bg:'Soldier|XPHB', bgAbil:{alt:0, picks:['str', 'con']}},
      rt:{items:[{id:'ls', n:'Espada larga', ref:'item|Longsword|XPHB', k:'wpn', ic:'i-sword', w:1, h:3, slot:'main', eq:'main'}, {id:'cm', n:'Cota de malla', ref:'item|Chain Mail|XPHB', k:'arm', ic:'i-armor', w:2, h:3, eq:'armor'}, {id:'es', n:'Escudo', ref:'item|Shield|XPHB', k:'arm', ic:'i-shield', w:2, h:2, eq:'off'}, {id:'pc', n:'Poción de curación', ref:'item|Potion of Healing|XPHB', k:'con', ic:'i-flask', w:1, h:1}]}},
    {id:'prueba-mag', name:'Iria (prueba)', level:5, method:'array', base:{str:8, dex:14, con:13, int:15, wis:12, cha:10}, ch:{cls:'Wizard|XPHB', sub:'Evoker|XPHB', race:'Elf|XPHB', bg:'Sage|XPHB', bgAbil:{alt:0, picks:['int', 'con']}},
      rt:{items:[{id:'bs', n:'Bastón', ref:'item|Quarterstaff|XPHB', k:'wpn', ic:'i-wand', w:1, h:3, slot:'main', eq:'main'}, {id:'pc', n:'Poción de curación', ref:'item|Potion of Healing|XPHB', k:'con', ic:'i-flask', w:1, h:1}]}},
    {id:'prueba-pic', name:'Tobías (prueba)', level:5, method:'array', base:{str:10, dex:15, con:13, int:12, wis:14, cha:8}, ch:{cls:'Rogue|XPHB', sub:'Thief|XPHB', race:'Halfling|XPHB', bg:'Criminal|XPHB', bgAbil:{alt:0, picks:['dex', 'con']}},
      rt:{items:[{id:'dg', n:'Daga', ref:'item|Dagger|XPHB', k:'wpn', ic:'i-sword', w:1, h:1, slot:'main', eq:'main'}, {id:'ac', n:'Arco corto', ref:'item|Shortbow|XPHB', k:'wpn', ic:'i-bow', w:1, h:3}, {id:'cu', n:'Armadura de cuero', ref:'item|Leather Armor|XPHB', k:'arm', ic:'i-armor', w:2, h:3, eq:'armor'}]}}
  ];
  function pjs(){ return JSON.stringify({chars:PJS}); }
  document.addEventListener('click', function(ev){ var b = ev.target.closest && ev.target.closest('[data-act="escdm"]'); if (!b) return; b.disabled = true; dm().then(function(){ b.disabled = false; }); });
  return {dm:dm, pjs:pjs, MAP_A:MAP_A, MAP_B:MAP_B, _cripta:cripta};
})();
