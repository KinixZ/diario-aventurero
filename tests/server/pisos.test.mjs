import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mesa } from './helpers.mjs';

const to = (n, id) => n.filter((x) => x.to === id).map((x) => x.msg);
const A = { id: 'mapa-sotano', name: 'Sótano', cols: 20, rows: 12, grid: 'square', layers: [{ id: 'l1', name: 'Capa 1' }], strokes: [] };
const B = { id: 'mapa-torre', name: 'Torre', cols: 16, rows: 16, grid: 'square', layers: [{ id: 'l1', name: 'Capa 1' }], strokes: [], hidden: true };

async function dosPisos() {
  const ctx = await mesa(), { R, c, dm } = ctx;
  R.act(c, dm.id, { t: 'map.save', map: A }); R.act(c, dm.id, { t: 'map.save', map: B });
  R.act(c, dm.id, { t: 'trig.add', id: B.id, trig: { id: 'zbaja', k: 'paso', x: 7, y: 7, w: 2, h: 2, name: 'Escalera abajo', to: { map: A.id, zid: 'zsube' } } });
  R.act(c, dm.id, { t: 'trig.add', id: A.id, trig: { id: 'zsube', k: 'paso', x: 15, y: 5, w: 2, h: 2, name: 'Escalera arriba', to: { map: B.id, zid: 'zbaja' } } });
  R.act(c, dm.id, { t: 'scene.set', id: A.id });
  return ctx;
}

test('zonas: el DM las pone; los jugadores solo ven los pasos', async () => {
  const { R, c, dm, a } = await dosPisos();
  let n = R.act(c, dm.id, { t: 'trig.add', id: A.id, trig: { id: 'ztrampa', k: 'trampa', x: 5, y: 5, w: 1, h: 1, name: 'Foso', text: 'Cae 3 m' } });
  assert.equal(to(n, a.id).length, 0, 'la trampa no le llega al jugador');
  assert.equal(to(n, dm.id)[0].put[0].k, 'trampa');
  assert.throws(() => R.act(c, a.id, { t: 'trig.add', id: A.id, trig: { k: 'paso', x: 1, y: 1 } }), /Solo el DM/);
  const view = R.act(c, a.id, { t: 'map.get', id: A.id })[0].msg.map.trig;
  assert.deepEqual(view.map((z) => z.k), ['paso']);
  assert.equal(view[0].to.name, 'Torre');
  // un paso hacia un mapa que no existe no lleva a ningún lado
  R.act(c, dm.id, { t: 'trig.add', id: A.id, trig: { id: 'zrota', k: 'paso', x: 1, y: 1, to: { map: 'nada' } } });
  assert.equal(c.maps.get(A.id).trig.find((z) => z.id === 'zrota').to, undefined);
  n = R.act(c, dm.id, { t: 'trig.rm', id: A.id, zid: 'zrota' });
  assert.deepEqual(to(n, a.id)[0].del, ['zrota']);
});

test('escaleras: el jugador llega, confirma y sube; bloqueadas no; el DM lleva a todo el grupo', async () => {
  const { R, c, dm, a, b } = await dosPisos();
  R.act(c, a.id, { t: 'tok.add', id: A.id, tok: { kind: 'pc', name: 'Lyra', x: 10, y: 5 } });
  R.act(c, b.id, { t: 'tok.add', id: A.id, tok: { kind: 'pc', name: 'Bram', x: 3, y: 3 } });
  R.act(c, a.id, { t: 'tok.add', id: A.id, tok: { kind: 'pc', comp: 1, name: 'Búho', x: 9, y: 5 } });
  const lyra = c.maps.get(A.id).tokens.find((t) => t.name === 'Lyra');
  assert.throws(() => R.act(c, a.id, { t: 'travel', id: A.id, zid: 'zsube' }), /Acércate/);
  let n = R.act(c, a.id, { t: 'tok.move', id: A.id, tid: lyra.id, x: 15, y: 5 });
  const ask = to(n, a.id).find((m) => m.t === 'trig');
  assert.deepEqual([ask.k, ask.zid, ask.to.name], ['paso', 'zsube', 'Torre'], 'al pisar la escalera le pregunta');
  // bloqueada: no pasa
  R.act(c, dm.id, { t: 'trig.upd', id: A.id, trig: { ...c.maps.get(A.id).trig.find((z) => z.id === 'zsube'), lock: true } });
  assert.throws(() => R.act(c, a.id, { t: 'travel', id: A.id, zid: 'zsube' }), /bloqueado/);
  R.act(c, dm.id, { t: 'trig.upd', id: A.id, trig: { ...c.maps.get(A.id).trig.find((z) => z.id === 'zsube'), lock: false } });
  n = R.act(c, a.id, { t: 'travel', id: A.id, zid: 'zsube' });
  const tower = c.maps.get(B.id);
  assert.equal(tower.hidden, false, 'el mapa de llegada se destapa');
  assert.deepEqual(tower.tokens.map((t) => t.name).sort(), ['Búho', 'Lyra'], 'sube con su compañero');
  assert.ok(tower.tokens.every((t) => t.x >= 6 && t.x <= 9 && t.y >= 6 && t.y <= 9), 'llegan junto a la otra escalera');
  assert.equal(c.maps.get(A.id).tokens.length, 1, 'en el sótano se queda Bram');
  assert.ok(to(n, a.id).some((m) => m.t === 'goto' && m.map === B.id));
  assert.ok(to(n, b.id).some((m) => m.t === 'tok.del'), 'Bram ve que se fue');
  assert.equal(c.members.get(a.id).at, B.id);
  // el DM lleva a todos los del sótano a la torre
  n = R.act(c, dm.id, { t: 'travel', id: A.id, all: true, to: { map: B.id, zid: 'zbaja' } });
  assert.equal(c.maps.get(A.id).tokens.length, 0); assert.equal(tower.tokens.length, 3);
  assert.ok(to(n, b.id).some((m) => m.t === 'goto'));
  assert.throws(() => R.act(c, a.id, { t: 'travel', id: B.id, all: true, to: { map: A.id } }), /Solo el DM/);
});

test('trampas, textos y emboscadas al entrar (también al cruzarlas)', async () => {
  const { R, c, dm, a, b } = await dosPisos();
  R.act(c, dm.id, { t: 'trig.add', id: A.id, trig: { id: 'zfoso', k: 'trampa', x: 6, y: 2, w: 1, h: 3, name: 'Foso', text: 'Salvación de DES CD 13', once: true } });
  R.act(c, dm.id, { t: 'trig.add', id: A.id, trig: { id: 'zaltar', k: 'texto', x: 12, y: 2, w: 2, h: 2, name: 'El altar', text: 'Huele a incienso viejo.', all: true } });
  R.act(c, dm.id, { t: 'trig.add', id: A.id, trig: { id: 'zemb', k: 'encuentro', x: 12, y: 8, w: 3, h: 3, name: 'Emboscada', once: true } });
  R.act(c, dm.id, { t: 'npc.add', name: 'Goblin', ac: 15, hp: 7, hidden: true });
  const gob = [...c.npcs.values()][0];
  R.act(c, dm.id, { t: 'tok.add', id: A.id, tok: { kind: 'npc', ref: gob.id, name: 'Goblin', x: 14, y: 10, hidden: true } });
  R.act(c, a.id, { t: 'tok.add', id: A.id, tok: { kind: 'pc', name: 'Lyra', x: 2, y: 3 } });
  R.act(c, b.id, { t: 'tok.add', id: A.id, tok: { kind: 'pc', name: 'Bram', x: 10, y: 3 } });
  const lyra = c.maps.get(A.id).tokens.find((t) => t.name === 'Lyra');
  // cruza el foso sin pararse en él: igual lo activa (y solo una vez)
  let n = R.act(c, a.id, { t: 'tok.move', id: A.id, tid: lyra.id, x: 9, y: 3 });
  const dmNote = to(n, dm.id).find((m) => m.t === 'trig');
  assert.deepEqual([dmNote.k, dmNote.who, dmNote.text], ['trampa', 'Lyra', 'Salvación de DES CD 13']);
  assert.equal(to(n, a.id).filter((m) => m.t === 'trig').length, 0, 'sin «decir», el jugador no se entera');
  n = R.act(c, a.id, { t: 'tok.move', id: A.id, tid: lyra.id, x: 2, y: 3 });
  assert.equal(to(n, dm.id).filter((m) => m.t === 'trig').length, 0, 'una sola vez');
  // texto para todos los del mapa
  n = R.act(c, a.id, { t: 'tok.move', id: A.id, tid: lyra.id, x: 12, y: 2 });
  assert.equal(to(n, b.id).find((m) => m.t === 'trig').text, 'Huele a incienso viejo.');
  // emboscada: aparece el goblin oculto
  n = R.act(c, a.id, { t: 'tok.move', id: A.id, tid: lyra.id, x: 13, y: 9 });
  assert.ok(to(n, b.id).some((m) => m.t === 'tok' && m.tok.name === 'Goblin'), 'los jugadores ya ven al goblin');
  assert.equal(c.npcs.get(gob.id).hidden, false);
  assert.ok(!n.quiet, 'cambia el combate: se manda el estado');
  // el DM ve las zonas ya disparadas
  assert.equal(c.maps.get(A.id).trig.find((z) => z.id === 'zemb').fired, true);
});

test('combate por mapa: separar, turnos de cada mapa y volver a unir', async () => {
  const { R, c, dm, a, b } = await dosPisos();
  R.act(c, a.id, { t: 'tok.add', id: A.id, tok: { kind: 'pc', name: 'Lyra', x: 15, y: 5 } });
  R.act(c, b.id, { t: 'tok.add', id: A.id, tok: { kind: 'pc', name: 'Bram', x: 3, y: 3 } });
  R.act(c, a.id, { t: 'travel', id: A.id, zid: 'zsube' });
  R.act(c, dm.id, { t: 'npc.add', name: 'Gárgola', ac: 15, hp: 52, init: 12, map: B.id });
  R.act(c, dm.id, { t: 'npc.add', name: 'Rata', ac: 10, hp: 3, init: 5, map: A.id });
  R.act(c, a.id, { t: 'init', value: 18 }); R.act(c, b.id, { t: 'init', value: 9 });
  assert.equal(c.order.length, 4);
  R.act(c, dm.id, { t: 'fight.split', value: true });
  // Lyra (torre) ve su combate: ella y la gárgola; Bram (sótano): él y la rata
  assert.deepEqual(R.view(c, a.id).order.map((x) => R.nameOf(c, x)), ['Lyra', 'Gárgola']);
  assert.deepEqual(R.view(c, b.id).order.map((x) => R.nameOf(c, x)), ['Bram', 'Rata']);
  assert.equal(R.view(c, dm.id).fights.length, 2);
  // turnos por separado
  R.act(c, dm.id, { t: 'turn', dir: 'start', map: B.id });
  assert.equal(R.view(c, a.id).turnId, a.id); assert.equal(R.view(c, b.id).turnId, null);
  R.act(c, a.id, { t: 'turn', dir: 'next' });
  assert.equal(R.view(c, a.id).turnId, [...c.npcs.values()].find((n) => n.name === 'Gárgola').id);
  assert.throws(() => R.act(c, b.id, { t: 'turn', dir: 'next' }), /Solo el DM|turno|iniciativa/);
  R.act(c, dm.id, { t: 'turn', dir: 'start', map: A.id });
  assert.equal(R.view(c, b.id).turnId, b.id);
  // el DM ve el combate del mapa que tiene abierto
  R.act(c, dm.id, { t: 'fight.focus', map: B.id });
  assert.equal(R.view(c, dm.id).fight, B.id);
  // se guarda y se recarga separado
  const back = R.fromDoc(JSON.parse(JSON.stringify(R.toDoc(c))));
  assert.equal(back.split, true); assert.equal(back.members.get(a.id).at, B.id);
  // unir: un solo orden con todos, sigue el turno del mapa enfocado
  R.act(c, dm.id, { t: 'fight.split', value: false });
  assert.equal(R.view(c, b.id).order.length, 4);
  assert.equal(R.view(c, dm.id).turnId, [...c.npcs.values()].find((n) => n.name === 'Gárgola').id);
  // terminar solo un mapa
  R.act(c, dm.id, { t: 'fight.split', value: true });
  R.act(c, dm.id, { t: 'end', map: A.id });
  assert.deepEqual(c.order.map((x) => R.nameOf(c, x)), ['Lyra', 'Gárgola']);
});
