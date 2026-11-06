/* ==================== ESCENARIO DE PRUEBA ====================
   Con un toque, el DM arma en su campaña algo para probar todo:
   · «La cripta del juramento roto» (exploración): vestíbulo con braseros, osario con escombros (terreno difícil),
     pasillo con una trampa, capilla con altar, columnas y sarcófagos, una puerta secreta a la cámara del tesoro,
     textos al entrar y una escalera que baja al patio. De noche, con visión y paredes: hay que alumbrarse.
   · «El patio del campamento goblin» (combate): tiendas, carreta, fogata, barro (terreno difícil), rocas y una
     empalizada baja para cubrirse, y una zona de despliegue para el grupo.
   · Dos encuentros listos para usar: «Emboscada en el campamento» (jefe goblin, guerreros goblin, un hobgoblin y,
     en la ronda 3, un osgo y dos lobos) y «Guardianes de la cripta» (esqueletos y un zombi en la capilla).
   Todo va por los mensajes de siempre (map.save, enc.save): se puede editar, borrar o volver a crear. */
var Escenario = (function(){
  var CRIPTA = 'prueba-cripta', PATIO = 'prueba-patio';
  function room(){ return window.Sala && Sala.status() === 'on' ? Sala.room() : null; }
  var n = 0; function kid(){ n++; return 'kp' + Date.now().toString(36).slice(-4) + n; }
  function size(a){ var d = window.Assets && Assets.DEFS && Assets.DEFS[a]; if (!d) return [1, 1]; return [d.w || d[3] || 1, d.h || d[4] || 1]; }
  /* Un objeto centrado en (cx, cy), del tamaño que trae (o el que se diga) */
  function obj(a, cx, cy, o){ o = o || {}; var s = size(a); var k = {id:kid(), k:'asset', l:'l2', a:a, pts:[cx, cy], s:o.s || s[0], h:o.h || s[1]}; if (o.r) k.r = o.r; return k; }
  function txt(t, x, y, fs){ return {id:kid(), k:'text', l:'l1', t:t, pts:[x, y], fs:fs || 0.8, c:'#5e4630'}; }
  function rect(x, y, w, h, c){ return {id:kid(), k:'rect', l:'l1', pts:[x, y, x + w, y + h], c:c || '#8a7a62', f:1, w:0.05}; }
  var wn = 0; function W(ax, ay, bx, by, t, o){ wn++; var w = {id:'wp' + wn, a:[ax, ay], b:[bx, by], t:t || 'wall'}; if (o) Object.keys(o).forEach(function(k){ w[k] = o[k]; }); return w; }
  function box(x0, y0, x1, y1){ return [W(x0, y0, x1, y0), W(x1, y0, x1, y1), W(x1, y1, x0, y1), W(x0, y1, x0, y0)]; }

  /* ---------- El patio del campamento goblin (combate) ---------- */
  function patio(back){
    var st = [
      rect(0, 0, 24, 16, '#cdbf9b'),
      rect(9, 9, 5, 4, '#8a6b4a'), txt('Barro', 10.2, 10.6, 0.7),
      obj('tienda', 18, 3), obj('tienda', 21, 7), obj('tienda', 18, 12),
      obj('fogata', 15, 7.5), obj('carreta', 6.5, 3.5, {r:90}), obj('barril', 4, 12.5), obj('barril', 5, 12.5), obj('caja', 4.5, 13.5),
      obj('rocas', 11, 4), obj('roca', 8, 13), obj('arbol', 1.5, 1.5), obj('pino', 2, 14), obj('arbusto', 22.5, 14.5), obj('pozo', 13.5, 13.5),
      obj('escaleras', 1.5, 7.5), txt('A la cripta', 0.4, 6, 0.6)
    ];
    // empalizada baja (cubre sin tapar la vista) y las rocas como muro bajo
    var walls = [W(8, 1, 8, 5, 'low'), W(16, 15, 23, 15, 'low'), W(10, 3, 12, 3, 'low'), W(10, 3, 10, 5, 'low')];
    var trig = [{id:'zpdif', k:'dificil', x:9, y:9, w:5, h:4, name:'Barro'}];
    if (back) trig.push({id:'zpsube', k:'paso', x:1, y:7, w:1, h:2, name:'Escalera a la cripta', to:{map:CRIPTA, zid:'zcbaja'}});
    return {id:PATIO, name:'El patio del campamento goblin', cols:24, rows:16, grid:'square', hidden:false,
      layers:[{id:'l1', name:'Terreno'}, {id:'l2', name:'Objetos'}], strokes:st, walls:walls, trig:trig,
      vis:{on:true, range:0, lines:'auto'}, light:{time:'atardecer', amb:'auto', wx:'despejado'}, fog:{on:true}};
  }
  /* ---------- La cripta del juramento roto (exploración) ---------- */
  function cripta(){
    wn = 100;
    var walls = []
      // vestíbulo (2,8)-(10,14): puerta al osario arriba, puerta al pasillo a la derecha
      .concat([W(2, 8, 2, 14), W(2, 14, 10, 14), W(2, 8, 5, 8), W(5, 8, 7, 8, 'door'), W(7, 8, 10, 8), W(10, 8, 10, 10), W(10, 10, 10, 12, 'door'), W(10, 12, 10, 14)])
      // osario (2,2)-(10,8)
      .concat([W(2, 2, 10, 2), W(10, 2, 10, 8), W(2, 2, 2, 8)])
      // pasillo (10,10)-(18,12)
      .concat([W(10, 10, 18, 10), W(10, 12, 18, 12)])
      // capilla (18,4)-(28,18): puerta con llave desde el pasillo, puerta secreta al tesoro
      .concat([W(18, 4, 28, 4), W(18, 4, 18, 10), W(18, 10, 18, 12, 'door', {lock:true}), W(18, 12, 18, 18), W(18, 18, 28, 18), W(28, 4, 28, 10), W(28, 10, 28, 12, 'secret'), W(28, 12, 28, 18)])
      // tesoro (28,8)-(33,14)
      .concat([W(28, 8, 33, 8), W(33, 8, 33, 14), W(33, 14, 28, 14)])
      // un muro bajo (los bancos) en la capilla
      .concat([W(21, 11, 25, 11, 'low')]);
    var st = [
      rect(2, 8, 8, 6, '#c9bb98'), rect(2, 2, 8, 6, '#bfb08c'), rect(10, 10, 8, 2, '#c4b694'), rect(18, 4, 10, 14, '#cbbf9f'), rect(28, 8, 5, 6, '#c2b18a'),
      obj('brasero', 3.5, 9.5), obj('brasero', 8.5, 9.5), obj('escaleras', 3, 12.5), obj('estatua', 6, 12.5), txt('Vestíbulo', 4.2, 13.6, 0.6),
      obj('huesos', 4, 4), obj('huesos', 8, 6.5), obj('escombros', 5, 4.5), obj('escombros', 6.5, 5.5), obj('telarana', 9, 3), obj('sarcofago', 3, 6), txt('Osario', 7.5, 2.8, 0.6),
      obj('trampa', 14.5, 11), obj('antorcha', 12, 10.5),
      obj('altar', 23, 6), obj('candelabro', 20.5, 5.5), obj('candelabro', 25.5, 5.5), obj('columna', 20.5, 8.5), obj('columna', 25.5, 8.5), obj('columna', 20.5, 14.5), obj('columna', 25.5, 14.5),
      obj('banco', 22, 10.5), obj('banco', 24, 10.5), obj('banco', 22, 12.5), obj('banco', 24, 12.5), obj('sarcofago', 21, 16), obj('sarcofago', 25, 16), obj('alfombra', 23, 9, {s:2, h:6}), txt('Capilla', 26.2, 17.4, 0.6),
      obj('cofre', 31, 11), obj('vela', 30, 9.5), obj('huesos', 32, 13), obj('cristal', 29.5, 12.8), txt('Tesoro', 29, 13.6, 0.6)
    ];
    var trig = [
      {id:'zcentra', k:'texto', x:3, y:10, w:2, h:2, name:'La entrada', all:true, once:true, text:'El aire huele a cera vieja y a hierro. Dos braseros todavía arden a los lados de una estatua sin rostro: alguien estuvo aquí hace poco.'},
      {id:'zcdif', k:'dificil', x:3, y:3, w:6, h:4, name:'Escombros'},
      {id:'zctrampa', k:'trampa', x:14, y:10, w:1, h:2, name:'Losa suelta', say:true, once:true, text:'Una losa cede bajo tus pies: dardos desde las paredes. Salvación de Destreza CD 13 o 2d6 de daño perforante (mitad si la supera).'},
      {id:'zccapilla', k:'texto', x:19, y:10, w:2, h:2, name:'La capilla', all:true, once:true, text:'Las velas se encienden solas. Sobre el altar, un juramento escrito con sangre seca y tachado con tres rayas. Las tapas de los sarcófagos están corridas.'},
      {id:'zctesoro', k:'texto', x:29, y:10, w:2, h:2, name:'El tesoro', once:true, text:'Un cofre con el sello de la orden roto. Dentro: 120 po, una poción de curación mayor y un anillo con un cráneo grabado.'},
      {id:'zcbaja', k:'paso', x:2, y:12, w:2, h:2, name:'Escalera al patio', to:{map:PATIO, zid:'zpsube'}}
    ];
    return {id:CRIPTA, name:'La cripta del juramento roto', cols:34, rows:20, grid:'square', hidden:false,
      layers:[{id:'l1', name:'Terreno'}, {id:'l2', name:'Objetos'}], strokes:st, walls:walls, trig:trig,
      vis:{on:true, range:0, lines:'auto'}, light:{time:'noche', amb:'dark', wx:'despejado'}, fog:{on:true}};
  }
  /* ---------- Enemigos: del Manual si está cargado, si no, con sus números ---------- */
  var STATS = {
    'Goblin Boss|XMM':{name:'Jefe goblin', ac:17, hp:21, initMod:2, s:1},
    'Goblin Warrior|XMM':{name:'Guerrero goblin', ac:15, hp:10, initMod:2, s:1},
    'Hobgoblin Warrior|XMM':{name:'Guerrero hobgoblin', ac:18, hp:11, initMod:1, s:1},
    'Bugbear Warrior|XMM':{name:'Guerrero osgo', ac:14, hp:33, initMod:2, s:1, reach:2},
    'Wolf|XMM':{name:'Lobo', ac:12, hp:11, initMod:2, s:1},
    'Skeleton|XMM':{name:'Esqueleto', ac:14, hp:13, initMod:3, s:1},
    'Zombie|XMM':{name:'Zombi', ac:8, hp:15, initMod:-2, s:1}
  };
  function foe(ref, x, y, wave, num, color){
    var b = window.Bestiario && Bestiario.has && Bestiario.has() && Bestiario.npcOf ? Bestiario.npcOf(ref) : null, f = STATS[ref] || {name:ref.split('|')[0], ac:12, hp:10, initMod:0};
    var o = b ? Object.assign({}, b) : {name:f.name, ac:f.ac, hp:f.hp, hpMax:f.hp, initMod:f.initMod, ref:ref, s:f.s || 1, reach:f.reach || 1};
    if (!b) o.ref = null; // sin el Manual no hay ficha que abrir
    // en español y numerados
    o.name = f.name + (num ? ' ' + num : ''); o.hpMax = o.hpMax || o.hp; o.x = x; o.y = y; o.wave = wave || 1; o.k = 'p' + (++n); if (color) o.color = color;
    return o;
  }
  function encuentros(){
    var patioE = {id:'Eprueba1', name:'Emboscada en el campamento', map:PATIO,
      notes:'De prueba. El jefe goblin grita órdenes desde la carreta; los guerreros goblin se cubren detrás de las rocas y la empalizada (cobertura). En la ronda 3 llegan desde las tiendas un osgo y dos lobos. El barro es terreno difícil.',
      waves:[{n:2, name:'Los de las tiendas', round:3}],
      npcs:[foe('Goblin Boss|XMM', 7, 5), foe('Goblin Warrior|XMM', 11, 5, 1, 1), foe('Goblin Warrior|XMM', 9, 2, 1, 2), foe('Goblin Warrior|XMM', 17, 9, 1, 3), foe('Hobgoblin Warrior|XMM', 15, 10),
        foe('Bugbear Warrior|XMM', 20, 5, 2), foe('Wolf|XMM', 19, 13, 2, 1), foe('Wolf|XMM', 21, 12, 2, 2)],
      deploy:[{id:'zpdesp', x:1, y:9, w:4, h:5, name:'El grupo llega por la escalera'}]};
    var criptaE = {id:'Eprueba2', name:'Guardianes de la cripta', map:CRIPTA,
      notes:'De prueba. Úsalo cuando el grupo entre a la capilla: los esqueletos salen de los sarcófagos y el zombi espera junto al altar. La puerta secreta del muro este lleva al tesoro (Sabiduría (Percepción) CD 15).',
      waves:[], npcs:[foe('Skeleton|XMM', 21, 15, 1, 1), foe('Skeleton|XMM', 25, 15, 1, 2), foe('Skeleton|XMM', 26, 7, 1, 3), foe('Zombie|XMM', 23, 7)],
      deploy:[{id:'zcdesp', x:19, y:9, w:2, h:4, name:'La entrada de la capilla'}]};
    return [patioE, criptaE];
  }
  /* Lo arma en la campaña: el patio primero (la escalera de la cripta lo necesita), la cripta y luego la vuelta del patio */
  function crear(){
    var r = room(); if (!r || r.role !== 'dm') { if (window.Sala) Sala.toast('El escenario de prueba lo arma el DM, dentro de una campaña.'); return false; }
    var ok = Sala.send({t:'map.save', map:patio(false)}) && Sala.send({t:'map.save', map:cripta()}) && Sala.send({t:'map.save', map:patio(true)});
    if (!ok) return false;
    encuentros().forEach(function(e){ Sala.send({t:'enc.save', enc:e}); });
    Sala.toast('Escenario listo: la cripta para explorar, el patio para combatir y dos encuentros en Encuentros.');
    return true;
  }
  /* Ponerlo en pantalla para todos (la cripta), para empezar a explorar */
  function mostrar(){ var r = room(); if (!r || r.role !== 'dm') return; Sala.send({t:'scene.set', id:CRIPTA}); Sala.send({t:'map.state', id:CRIPTA, state:'explore'}); if (window.Mesa) Mesa.show('mapas'); if (window.Mapas) setTimeout(function(){ Mapas.open(CRIPTA); }, 300); }
  function hay(r){ return !!(r && (r.maps || []).some(function(m){ return m.id === CRIPTA; })); }
  /* El bloque del panel del DM */
  function panel(r){
    var ya = hay(r);
    return '<p class="note">Arma una cripta para explorar (paredes, puertas, una puerta secreta, trampa, textos y de noche) y un patio para combatir, con dos encuentros listos. Ideal para probar con el grupo antes de una sesión.</p>'
      + '<div class="dm-row"><button class="btn' + (ya ? '' : ' main') + '" type="button" data-act="escprueba">' + (ya ? 'Volver a crearlo' : 'Preparar escenario de prueba') + '</button>'
      + (ya ? '<button class="btn main" type="button" data-act="escver">Mostrar la cripta a todos</button><button class="btn" type="button" data-act="campgo" data-v="encuentros">Ver los encuentros</button>' : '') + '</div>';
  }
  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'escprueba') { ev.preventDefault(); crear(); }
    else if (b.dataset.act === 'escver') { ev.preventDefault(); mostrar(); }
  });
  return {crear:crear, mostrar:mostrar, panel:panel, hay:hay, _cripta:cripta, _patio:patio, _encs:encuentros, IDS:{cripta:CRIPTA, patio:PATIO}};
})();
