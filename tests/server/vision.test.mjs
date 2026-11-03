import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mesa } from './helpers.mjs';

const Vision = createRequire(import.meta.url)('../../web/src/vision.cjs');
const to = (n, id) => n.filter((x) => x.to === id).map((x) => x.msg);
const bit = (fog, cols, x, y) => { const b = Buffer.from(fog.cells, 'base64'), i = y * cols + x; return (b[i >> 3] >> (i & 7)) & 1; };
// Una habitación de 4..10 × 2..8 con una puerta al este (x = 10, y 4..5) y un pasillo fuera
const ROOM = [
  { id: 'w1', a: [4, 2], b: [10, 2] }, { id: 'w2', a: [10, 2], b: [10, 4] }, { id: 'd1', a: [10, 4], b: [10, 5], t: 'door' },
  { id: 'w3', a: [10, 5], b: [10, 8] }, { id: 'w4', a: [10, 8], b: [4, 8] }, { id: 'w5', a: [4, 8], b: [4, 2] },
];
const MAP = { id: 'mapa-cripta', name: 'La cripta', cols: 20, rows: 12, grid: 'square', layers: [{ id: 'l1', name: 'Capa 1' }], strokes: [] };

test('motor de visión: polígono, puertas, un sentido, caminos y exploración', () => {
  const mp = { cols: 20, rows: 12, walls: ROOM.map((w) => ({ t: 'wall', ...w })), wrev: 0 };
  const P = Vision.poly(Vision.sightOf(mp), 6.5, 5.5, 0, 20, 12);
  assert.ok(Vision.inPoly(P, 9.5, 3.5) && !Vision.inPoly(P, 12.5, 4.5), 'dentro sí, fuera no');
  mp.walls[2].open = true; mp.wrev++;
  assert.ok(Vision.inPoly(Vision.poly(Vision.sightOf(mp), 6.5, 4.5, 0, 20, 12), 15.5, 4.5), 'por la puerta abierta se ve el pasillo');
  assert.equal(Vision.route(mp, { x: 6, y: 4 }, 14, 4).ok, true);
  mp.walls[2].open = false; mp.wrev++;
  assert.equal(Vision.route(mp, { x: 6, y: 4 }, 14, 4).ok, false, 'puerta cerrada: no hay camino');
  assert.equal(Vision.route(mp, { x: 6, y: 4 }, 8, 6).ok, true, 'dentro de la habitación sí');
  // rodear: una pared en medio del camino con espacio a los lados
  const open = { cols: 12, rows: 12, walls: [{ id: 'x', a: [5, 2], b: [5, 9], t: 'wall' }], wrev: 0 };
  const r = Vision.route(open, { x: 2, y: 5 }, 8, 5);
  assert.ok(r.ok && r.steps > 6, 'da la vuelta a la pared');
  // ventana: se ve, no se pasa; cortina: al revés
  const win = { cols: 12, rows: 12, walls: [{ id: 'v', a: [6, 0], b: [6, 12], t: 'window' }], wrev: 0 };
  assert.ok(Vision.inPoly(Vision.poly(Vision.sightOf(win), 2.5, 5.5, 0, 12, 12), 9.5, 5.5));
  assert.equal(Vision.route(win, { x: 2, y: 5 }, 9, 5).ok, false);
  const cur = { cols: 12, rows: 12, walls: [{ id: 'c', a: [6, 0], b: [6, 12], t: 'curtain' }], wrev: 0 };
  assert.ok(!Vision.inPoly(Vision.poly(Vision.sightOf(cur), 2.5, 5.5, 0, 12, 12), 9.5, 5.5));
  assert.equal(Vision.route(cur, { x: 2, y: 5 }, 9, 5).ok, true);
  // alcance limitado
  const far = Vision.poly(Vision.sightOf({ cols: 40, rows: 40, walls: [], wrev: 0 }), 20, 20, 6, 40, 40);
  assert.ok(Vision.inPoly(far, 25, 20) && !Vision.inPoly(far, 27, 20));
  // exploración: casillas tocadas por el polígono, sin pasar la pared
  const bits = new Uint8Array(Math.ceil(240 / 8)); mp.walls[2].open = false; mp.wrev++;
  assert.equal(Vision.explore(bits, 20, 12, Vision.poly(Vision.sightOf(mp), 6.5, 5.5, 0, 20, 12)), 36, '6 × 6 casillas de la habitación');
  // fichas grandes: un hueco de 1 casilla no deja pasar a una de 2 × 2
  const gap = { cols: 12, rows: 12, walls: [{ id: 'g1', a: [6, 0], b: [6, 5] }, { id: 'g2', a: [6, 6], b: [6, 12] }].map((w) => ({ t: 'wall', ...w })), wrev: 0 };
  assert.ok(Vision.route(gap, { x: 2, y: 5, s: 1 }, 9, 5).ok);
  assert.equal(Vision.route(gap, { x: 2, y: 5, s: 2 }, 9, 5).ok, false);
});

test('paredes en el servidor: las pone el DM, las secretas se disfrazan y las puertas se abren de cerca', async () => {
  const { R, c, dm, a, b } = await mesa();
  R.act(c, dm.id, { t: 'map.save', map: MAP });
  let n = R.act(c, dm.id, { t: 'wall.add', id: MAP.id, walls: [...ROOM, { id: 's1', a: [4, 5], b: [4, 6], t: 'secret' }] });
  assert.equal(to(n, a.id)[0].t, 'walls');
  assert.equal(to(n, a.id)[0].put.find((w) => w.id === 's1').t, 'wall', 'la puerta secreta llega al jugador como pared');
  assert.equal(to(n, dm.id)[0].put.find((w) => w.id === 's1').t, 'secret');
  assert.throws(() => R.act(c, a.id, { t: 'wall.add', id: MAP.id, walls: [{ a: [1, 1], b: [2, 1] }] }), /Solo el DM/);
  assert.equal(R.act(c, a.id, { t: 'map.get', id: MAP.id })[0].msg.map.walls.find((w) => w.id === 's1').t, 'wall');
  // fichas: Lyra dentro de la habitación, Bram lejos
  R.act(c, a.id, { t: 'tok.add', id: MAP.id, tok: { kind: 'pc', name: 'Lyra', x: 8, y: 4 } });
  R.act(c, b.id, { t: 'tok.add', id: MAP.id, tok: { kind: 'pc', name: 'Bram', x: 16, y: 10 } });
  assert.throws(() => R.act(c, b.id, { t: 'door', id: MAP.id, wid: 'd1' }), /Acércate/);
  assert.throws(() => R.act(c, a.id, { t: 'door', id: MAP.id, wid: 's1' }), /no hay una puerta/, 'no se puede abrir una secreta sin encontrarla');
  // con llave: el jugador no puede, el DM sí
  R.act(c, dm.id, { t: 'wall.upd', id: MAP.id, walls: [{ ...ROOM[2], lock: true }] });
  assert.throws(() => R.act(c, a.id, { t: 'door', id: MAP.id, wid: 'd1' }), /llave/);
  R.act(c, dm.id, { t: 'wall.upd', id: MAP.id, walls: [{ ...ROOM[2] }] });
  n = R.act(c, a.id, { t: 'door', id: MAP.id, wid: 'd1' });
  assert.equal(to(n, b.id)[0].put[0].open, true, 'todos ven la puerta abierta');
  // el DM descubre la secreta: abrirla la marca encontrada y al jugador le llega como puerta
  n = R.act(c, dm.id, { t: 'door', id: MAP.id, wid: 's1', open: true });
  assert.deepEqual([to(n, a.id)[0].put[0].t, to(n, a.id)[0].put[0].open], ['door', true]);
  assert.equal(c.maps.get(MAP.id).walls.find((w) => w.id === 's1').found, true);
  n = R.act(c, dm.id, { t: 'wall.rm', id: MAP.id, wids: ['w1', 'nada'] });
  assert.deepEqual(to(n, a.id)[0].del, ['w1']);
  // se guardan y vuelven a cargar
  const back = R.fromDoc(JSON.parse(JSON.stringify(R.toDoc(c))));
  assert.equal(back.maps.get(MAP.id).walls.length, ROOM.length);
});

test('visión del grupo: descubre al moverse, no atraviesa paredes y las fichas rodean', async () => {
  const { R, c, dm, a } = await mesa();
  R.act(c, dm.id, { t: 'map.save', map: MAP });
  R.act(c, dm.id, { t: 'wall.add', id: MAP.id, walls: ROOM });
  let n = R.act(c, dm.id, { t: 'map.vis', id: MAP.id, on: true });
  assert.ok(to(n, a.id).some((m) => m.t === 'map.vis' && m.vis.on));
  assert.equal(c.maps.get(MAP.id).fog.on, true, 'la visión prende la niebla');
  assert.throws(() => R.act(c, a.id, { t: 'map.vis', id: MAP.id, on: false }), /Solo el DM/);
  n = R.act(c, a.id, { t: 'tok.add', id: MAP.id, tok: { kind: 'pc', name: 'Lyra', x: 6, y: 4 } });
  const fog = to(n, a.id).find((m) => m.t === 'map.fog').fog;
  assert.equal(bit(fog, 20, 9, 7), 1, 've su habitación');
  assert.equal(bit(fog, 20, 12, 4), 0, 'no ve tras la puerta cerrada');
  const tok = c.maps.get(MAP.id).tokens[0];
  // no puede salir con la puerta cerrada: la ficha vuelve y le llega el aviso
  n = R.act(c, a.id, { t: 'tok.move', id: MAP.id, tid: tok.id, x: 14, y: 4 });
  assert.deepEqual([tok.x, tok.y], [6, 4]);
  assert.ok(to(n, a.id).some((m) => m.t === 'error' && m.code === 'blocked'));
  assert.ok(to(n, a.id).some((m) => m.t === 'tok' && m.tok.x === 6), 'el servidor le regresa la ficha');
  // abre la puerta y sale: descubre el pasillo, también lo que vio en el camino
  R.act(c, a.id, { t: 'tok.move', id: MAP.id, tid: tok.id, x: 9, y: 4 });
  n = R.act(c, a.id, { t: 'door', id: MAP.id, wid: 'd1' });
  assert.equal(bit(to(n, a.id).find((m) => m.t === 'map.fog').fog, 20, 15, 4), 1, 'abrir la puerta descubre lo que se ve por ella');
  n = R.act(c, a.id, { t: 'tok.move', id: MAP.id, tid: tok.id, x: 16, y: 4 });
  assert.deepEqual([tok.x, tok.y], [16, 4]);
  const f2 = to(n, a.id).find((m) => m.t === 'map.fog').fog;
  assert.equal(bit(f2, 20, 16, 0), 1);
  // el DM mueve donde quiera, aunque haya pared
  R.act(c, dm.id, { t: 'tok.move', id: MAP.id, tid: tok.id, x: 6, y: 6 });
  assert.deepEqual([tok.x, tok.y], [6, 6]);
  // con la visión puesta, «traer mi ficha» no la teletransporta
  R.act(c, a.id, { t: 'tok.add', id: MAP.id, tok: { kind: 'pc', name: 'Lyra', x: 18, y: 10 } });
  assert.deepEqual([tok.x, tok.y], [6, 6]);
  // cubrir todo: lo que ve ahora vuelve a quedar descubierto; lo demás, no
  n = R.act(c, dm.id, { t: 'fog.all', id: MAP.id, value: 0 });
  const f3 = to(n, a.id).find((m) => m.t === 'map.fog').fog;
  assert.equal(bit(f3, 20, 7, 7), 1); assert.equal(bit(f3, 20, 16, 11), 0);
  // un personaje caído no ve
  c.members.get(a.id).char.hp = 0;
  R.act(c, dm.id, { t: 'fog.all', id: MAP.id, value: 0 });
  assert.equal(bit({ cells: c.maps.get(MAP.id).fog.cells.toString('base64') }, 20, 7, 7), 0);
  // apagar la niebla apaga la visión
  n = R.act(c, dm.id, { t: 'fog.on', id: MAP.id, value: false });
  assert.equal(c.maps.get(MAP.id).vis.on, false);
  assert.ok(to(n, a.id).some((m) => m.t === 'map.vis'));
});
