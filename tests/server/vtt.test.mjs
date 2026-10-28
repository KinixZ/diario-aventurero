import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mesa } from './helpers.mjs';

const MAP = { id: 'mapa-puente', name: 'El puente', cols: 20, rows: 10, grid: 'square', layers: [{ id: 'l1', name: 'Terreno' }, { id: 'l2', name: 'Paredes' }], strokes: [] };
const to = (n, id) => n.filter((x) => x.to === id).map((x) => x.msg);

test('mapas: crear, dibujar en capas, borrar, deshacer y permisos', async () => {
  const { R, c, dm, a, b } = await mesa();
  let n = R.act(c, a.id, { t: 'map.save', map: MAP });
  assert.equal(n.length, 3); assert.equal(n[0].msg.map.by, a.id); assert.equal(n[0].msg.map.hidden, false);
  n = R.act(c, b.id, { t: 'map.add', id: MAP.id, stroke: { k: 'line', l: 'l2', c: '#8c2626', w: 0.2, pts: [1, 1, 10, 1] } });
  const sid = n[0].msg.stroke.id;
  R.act(c, a.id, { t: 'map.add', id: MAP.id, stroke: { k: 'text', l: 'l1', pts: [5, 5], t: 'Torre' } });
  R.act(c, a.id, { t: 'map.add', id: MAP.id, stroke: { k: 'pen', l: 'l1', pts: [1, 1, 2, 2, 3, 2.5] } });
  assert.throws(() => R.act(c, a.id, { t: 'map.add', id: MAP.id, stroke: { k: 'line', l: 'zz', pts: [1, 1, 2, 2] } }), /trazo/);
  assert.throws(() => R.act(c, a.id, { t: 'map.add', id: MAP.id, stroke: { k: 'line', l: 'l1', pts: [1, 1, 900, 2] } }), /trazo/);
  n = R.act(c, a.id, { t: 'map.undo', id: MAP.id }); assert.equal(n[0].msg.t, 'map.rm');
  n = R.act(c, a.id, { t: 'map.rm', id: MAP.id, sids: [sid] }); assert.deepEqual(n[0].msg.sids, [sid]);
  const g = R.act(c, b.id, { t: 'map.get', id: MAP.id });
  assert.deepEqual(g[0].msg.map.strokes.map((k) => k.t), ['Torre']);
  R.act(c, b.id, { t: 'map.meta', id: MAP.id, grid: 'hex', layers: [{ id: 'l1', name: 'Suelo' }] });
  assert.equal(R.view(c, a.id).maps[0].grid, 'hex');
  assert.throws(() => R.act(c, b.id, { t: 'map.save', map: { ...MAP, name: 'Mío' } }), /quien lo creó/);
  assert.throws(() => R.act(c, b.id, { t: 'map.del', id: MAP.id }), /quien lo creó/);
  R.act(c, dm.id, { t: 'map.del', id: MAP.id }); assert.equal(R.view(c, a.id).maps.length, 0);
  assert.throws(() => R.act(c, a.id, { t: 'map.save', map: { id: 'x' } }), /formato/);
});

test('mapas del DM: ocultos mientras los prepara, capa secreta y mostrar a todos', async () => {
  const { R, c, dm, a } = await mesa();
  let n = R.act(c, dm.id, { t: 'map.save', map: { ...MAP, hidden: true, layers: [{ id: 'l1', name: 'Terreno' }, { id: 'dm', name: 'Trampas', dm: true }] } });
  assert.deepEqual(n.map((x) => x.to), [dm.id], 'solo el DM recibe un mapa oculto');
  assert.equal(R.view(c, a.id).maps.length, 0);
  assert.throws(() => R.act(c, a.id, { t: 'map.get', id: MAP.id }), /ya no está/);
  R.act(c, dm.id, { t: 'map.add', id: MAP.id, stroke: { k: 'text', l: 'dm', pts: [3, 3], t: 'Foso' } });
  R.act(c, dm.id, { t: 'map.add', id: MAP.id, stroke: { k: 'line', l: 'l1', pts: [0, 0, 5, 0] } });
  // mostrarlo a todos lo destapa y lo pone como escena
  n = R.act(c, dm.id, { t: 'scene.set', id: MAP.id });
  const forA = to(n, a.id);
  assert.ok(forA.some((m) => m.t === 'scene' && m.id === MAP.id));
  const mA = forA.find((m) => m.t === 'map').map;
  assert.deepEqual(mA.layers.map((l) => l.id), ['l1'], 'la capa secreta no llega al jugador');
  assert.equal(mA.strokes.length, 1);
  assert.equal(R.view(c, a.id).scene, MAP.id);
  // trazos en la capa secreta: solo los ve el DM; un jugador no puede dibujar ahí
  n = R.act(c, dm.id, { t: 'map.add', id: MAP.id, stroke: { k: 'text', l: 'dm', pts: [4, 4], t: 'Llave' } });
  assert.deepEqual(n.map((x) => x.to), [dm.id]);
  assert.throws(() => R.act(c, a.id, { t: 'map.add', id: MAP.id, stroke: { k: 'text', l: 'dm', pts: [4, 4], t: 'x' } }), /trazo|solo del DM/);
  // el jugador no puede borrar la capa secreta al editar las capas
  R.act(c, a.id, { t: 'map.meta', id: MAP.id, layers: [{ id: 'l1', name: 'Suelo' }] });
  assert.ok(c.maps.get(MAP.id).layers.some((l) => l.id === 'dm'));
  assert.equal(c.maps.get(MAP.id).strokes.filter((k) => k.l === 'dm').length, 2);
  // ocultarlo otra vez quita la escena
  R.act(c, dm.id, { t: 'map.hide', id: MAP.id, value: true }); assert.equal(c.scene, null);
  assert.throws(() => R.act(c, a.id, { t: 'map.hide', id: MAP.id, value: false }), /Solo el DM/);
});

test('fichas: cada jugador mueve la suya, el DM todas; ocultas solo para el DM', async () => {
  const { R, c, dm, a, b } = await mesa();
  R.act(c, dm.id, { t: 'map.save', map: MAP });
  let n = R.act(c, a.id, { t: 'tok.add', id: MAP.id, tok: { kind: 'pc', name: 'Lyra', x: 2, y: 3, color: '#2f5d8a' } });
  const lyra = c.maps.get(MAP.id).tokens[0];
  assert.equal(lyra.ref, a.id); assert.equal(lyra.by, a.id); assert.equal(n.length, 3);
  // poner tu ficha otra vez la mueve, no la duplica
  R.act(c, a.id, { t: 'tok.add', id: MAP.id, tok: { kind: 'pc', name: 'Lyra', x: 7, y: 1 } });
  assert.equal(c.maps.get(MAP.id).tokens.length, 1); assert.equal(lyra.x, 7);
  R.act(c, a.id, { t: 'tok.move', id: MAP.id, tid: lyra.id, x: 4.5, y: 2 }); assert.equal(lyra.x, 4.5);
  R.act(c, a.id, { t: 'tok.move', id: MAP.id, tid: lyra.id, x: 999, y: -5 }); assert.equal(lyra.x, 19); assert.equal(lyra.y, 0, 'no se sale del mapa');
  assert.throws(() => R.act(c, b.id, { t: 'tok.move', id: MAP.id, tid: lyra.id, x: 1, y: 1 }), /tus fichas/);
  assert.throws(() => R.act(c, b.id, { t: 'tok.add', id: MAP.id, tok: { kind: 'npc', name: 'Ogro' } }), /Solo el DM/);
  R.act(c, dm.id, { t: 'tok.move', id: MAP.id, tid: lyra.id, x: 1, y: 1 }); assert.equal(lyra.x, 1);
  // enemigo oculto: el jugador no lo recibe; al destaparlo sí
  R.act(c, dm.id, { t: 'npc.add', name: 'Ogro', ac: 11, hp: 59, hidden: true });
  const ogroNpc = [...c.npcs.values()][0];
  n = R.act(c, dm.id, { t: 'tok.add', id: MAP.id, tok: { kind: 'npc', name: 'Ogro', ref: ogroNpc.id, x: 10, y: 5, s: 2, hidden: true } });
  assert.deepEqual(n.map((x) => x.to), [dm.id]);
  const ogro = c.maps.get(MAP.id).tokens[1]; assert.equal(ogro.ref, ogroNpc.id); assert.equal(ogro.s, 2);
  assert.equal(R.act(c, a.id, { t: 'map.get', id: MAP.id })[0].msg.map.tokens.length, 1);
  n = R.act(c, dm.id, { t: 'tok.set', id: MAP.id, tid: ogro.id, hidden: false });
  assert.equal(to(n, a.id)[0].t, 'tok');
  n = R.act(c, dm.id, { t: 'tok.set', id: MAP.id, tid: ogro.id, hidden: true });
  assert.equal(to(n, a.id)[0].t, 'tok.del', 'al ocultarla, desaparece para los jugadores');
  R.act(c, a.id, { t: 'tok.set', id: MAP.id, tid: lyra.id, hidden: true }); assert.equal(lyra.hidden, false, 'un jugador no oculta fichas');
  assert.throws(() => R.act(c, b.id, { t: 'tok.del', id: MAP.id, tid: lyra.id }), /tus fichas/);
  R.act(c, a.id, { t: 'tok.del', id: MAP.id, tid: lyra.id }); assert.equal(c.maps.get(MAP.id).tokens.length, 1);
});

test('niebla de guerra: el DM descubre y cubre por casillas', async () => {
  const { R, c, dm, a } = await mesa();
  R.act(c, dm.id, { t: 'map.save', map: MAP });
  const mp = c.maps.get(MAP.id);
  assert.equal(mp.fog.cells.length, Math.ceil(20 * 10 / 8));
  assert.throws(() => R.act(c, a.id, { t: 'fog.on', id: MAP.id, value: true }), /Solo el DM/);
  let n = R.act(c, dm.id, { t: 'fog.on', id: MAP.id, value: true });
  assert.equal(to(n, a.id)[0].t, 'map.fog'); assert.equal(to(n, a.id)[0].fog.on, true);
  R.act(c, dm.id, { t: 'fog.rect', id: MAP.id, rect: [0, 0, 3, 1], value: true });
  const bit = (x, y) => { const i = y * 20 + x; return (mp.fog.cells[i >> 3] >> (i & 7)) & 1; };
  assert.equal(bit(0, 0), 1); assert.equal(bit(3, 1), 1); assert.equal(bit(4, 1), 0); assert.equal(bit(0, 2), 0);
  R.act(c, dm.id, { t: 'fog.rect', id: MAP.id, rect: [3, 1, 3, 1], value: false }); assert.equal(bit(3, 1), 0);
  R.act(c, dm.id, { t: 'fog.all', id: MAP.id, value: true }); assert.equal(bit(19, 9), 1);
  const got = R.act(c, a.id, { t: 'map.get', id: MAP.id })[0].msg.map.fog;
  assert.equal(got.on, true); assert.equal(Buffer.from(got.cells, 'base64').length, mp.fog.cells.length);
});

test('fondo del mapa con una imagen subida y señalar un punto', async () => {
  const { R, c, dm, a, b } = await mesa();
  R.act(c, dm.id, { t: 'map.save', map: MAP });
  assert.throws(() => R.act(c, dm.id, { t: 'map.bg', id: MAP.id, img: 'inope' }), /imagen/);
  const im = R.noteImage(c, dm.id, 1000, 'image/jpeg');
  let n = R.act(c, dm.id, { t: 'map.bg', id: MAP.id, img: im.id, op: 0.8 });
  assert.equal(to(n, a.id)[0].bg.img, im.id); assert.equal(c.maps.get(MAP.id).bg.op, 0.8);
  assert.throws(() => R.act(c, a.id, { t: 'map.bg', id: MAP.id, img: null }), /fondo/);
  n = R.act(c, b.id, { t: 'map.ping', id: MAP.id, x: 4, y: 5 });
  assert.equal(n.length, 3); assert.equal(n[0].msg.name, 'Bram'); assert.equal(n.quiet, true);
  // el DM puede reemplazar el mapa completo conservando fichas y fondo
  R.act(c, dm.id, { t: 'tok.add', id: MAP.id, tok: { kind: 'obj', name: 'Cofre', x: 1, y: 1 } });
  const full = R.act(c, dm.id, { t: 'map.get', id: MAP.id })[0].msg.map;
  R.act(c, dm.id, { t: 'map.save', map: { ...full, name: 'El puente roto' } });
  assert.equal(c.maps.get(MAP.id).tokens.length, 1); assert.equal(c.maps.get(MAP.id).bg.img, im.id); assert.equal(c.maps.get(MAP.id).name, 'El puente roto');
});

test('la campaña guarda mapas con fichas y niebla', async () => {
  const { R, c, dm, a, store } = await mesa();
  R.act(c, dm.id, { t: 'map.save', map: MAP });
  R.act(c, dm.id, { t: 'fog.rect', id: MAP.id, rect: [0, 0, 1, 1], value: true });
  R.act(c, a.id, { t: 'tok.add', id: MAP.id, tok: { kind: 'pc', name: 'Lyra', x: 2, y: 3 } });
  R.act(c, dm.id, { t: 'scene.set', id: MAP.id });
  await R.flushAll();
  const { Campaigns } = await import('../../server/campaigns.mjs');
  const c2 = await new Campaigns(store).open(c.code), mp = c2.maps.get(MAP.id);
  assert.equal(mp.tokens.length, 1); assert.equal(mp.tokens[0].ref, a.id); assert.equal(c2.scene, MAP.id);
  assert.ok(Buffer.isBuffer(mp.fog.cells)); assert.equal(mp.fog.cells[0] & 3, 3);
});
