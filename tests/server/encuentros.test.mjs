import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rooms } from '../../server/rooms.mjs';

const pc = (name, initMod = 0) => ({ name, cls: 'Bard 5', lvl: 5, ac: 14, hp: 30, hpMax: 30, initMod });
function mesa() {
  const R = new Rooms();
  const { room, member: dm } = R.create('DM', null, true);
  const a = R.join(room.code, 'Lyra', pc('Lyra')).member, b = R.join(room.code, 'Bram', pc('Bram')).member;
  return { R, room, dm, a, b };
}
const ogro = (v) => v.npcs.find((n) => n.name === 'Ogro');

test('vida de los enemigos: el DM elige qué ven los jugadores', () => {
  const { R, room, dm, a } = mesa();
  R.act(room, dm.id, { t: 'npc.add', name: 'Ogro', ac: 11, hp: 68, init: 8, ref: 'Ogre|XMM', initMod: -1, formula: '8d10 + 24' });
  const id = ogro(R.view(room, dm.id)).id;
  R.act(room, dm.id, { t: 'npc.set', id, delta: -17 });
  let o = ogro(R.view(room, a.id));
  assert.equal(o.state, 'herido'); assert.equal(o.hp, undefined); assert.equal(o.ref, undefined, 'los jugadores no ven qué monstruo es');
  R.act(room, dm.id, { t: 'npchp', value: 'pct' }); o = ogro(R.view(room, a.id)); assert.equal(o.pct, 75); assert.equal(o.state, null);
  R.act(room, dm.id, { t: 'npchp', value: 'bar' }); o = ogro(R.view(room, a.id)); assert.equal(o.show, 'bar'); assert.equal(o.pct, 75);
  R.act(room, dm.id, { t: 'npchp', value: 'num' }); o = ogro(R.view(room, a.id)); assert.equal(o.hp, 51); assert.equal(o.hpMax, 68);
  R.act(room, dm.id, { t: 'npchp', value: 'none' }); o = ogro(R.view(room, a.id)); assert.equal(o.hp, undefined); assert.equal(o.pct, undefined); assert.equal(o.state, undefined);
  assert.equal(R.view(room, a.id).npcHp, 'none');
  const d = ogro(R.view(room, dm.id)); assert.equal(d.ref, 'Ogre|XMM'); assert.equal(d.formula, '8d10 + 24'); assert.equal(d.hp, 51);
  assert.throws(() => R.act(room, a.id, { t: 'npchp', value: 'num' }), /Solo el DM/);
  assert.throws(() => R.act(room, dm.id, { t: 'npchp', value: 'todo' }), /desconocida/);
});

test('encuentro guardado: se carga con PG, estados, iniciativa y turno', () => {
  const { R, room, dm, a, b } = mesa();
  const enc = { name: 'Emboscada en el puente', round: 3, turnName: 'Ogro', pcInit: { Lyra: 17, Bram: 5, Nadie: 9 },
    npcs: [{ name: 'Ogro', ac: 11, hp: 20, hpMax: 68, init: 8, conds: ['prone', 'nada'], ref: 'Ogre|XMM' }, { name: 'Goblin', ac: 15, hp: 0, hpMax: 7, init: 14, hidden: true }] };
  R.act(room, dm.id, { t: 'enc.load', enc });
  const v = R.view(room, dm.id);
  assert.equal(v.round, 3);
  assert.deepEqual(v.order.map((x) => R.nameOf(room, x)), ['Lyra', 'Goblin', 'Ogro', 'Bram']);
  assert.equal(R.nameOf(room, v.turnId), 'Ogro');
  assert.deepEqual(ogro(v).conds, ['prone']); assert.equal(ogro(v).hp, 20);
  assert.equal(R.view(room, a.id).order.length, 3, 'el goblin oculto no aparece para los jugadores');
  assert.throws(() => R.act(room, b.id, { t: 'enc.load', enc }), /Solo el DM/);
  // si alguien entra después con ese nombre, recupera su iniciativa
  R.act(room, dm.id, { t: 'enc.load', enc: { ...enc, pcInit: { Cael: 12 } } });
  const c = R.join(room.code, 'Cael', pc('Cael')).member;
  assert.equal(c.init, 12); assert.ok(R.view(room, dm.id).order.includes(c.id));
});

test('reabrir la mesa con la copia del DM trae el combate', () => {
  const R = new Rooms();
  const { room } = R.create('DM', null, true, { code: 'QWER', npcHp: 'bar', combat: { round: 2, turnName: 'Ogro', npcs: [{ name: 'Ogro', ac: 11, hp: 30, hpMax: 68, init: 8 }] } });
  assert.equal(room.code, 'QWER'); assert.equal(room.npcHp, 'bar'); assert.equal(room.round, 2); assert.equal(room.npcs.size, 1);
});

test('mapas: crear, dibujar en capas, borrar, deshacer y permisos', () => {
  const { R, room, dm, a, b } = mesa();
  const map = { id: 'mapa-puente', name: 'El puente', cols: 40, rows: 30, grid: 'square', layers: [{ id: 'l1', name: 'Terreno' }, { id: 'l2', name: 'Paredes' }], strokes: [] };
  let n = R.act(room, a.id, { t: 'map.save', map });
  assert.equal(n.length, 3); assert.equal(n[0].msg.map.by, a.id);
  assert.equal(R.view(room, b.id).maps[0].name, 'El puente');
  n = R.act(room, b.id, { t: 'map.add', id: 'mapa-puente', stroke: { k: 'line', l: 'l2', c: '#8c2626', w: 0.2, pts: [1, 1, 10, 1] } });
  assert.equal(n.quiet, true); assert.equal(n[0].msg.stroke.k, 'line');
  const sid = n[0].msg.stroke.id;
  R.act(room, a.id, { t: 'map.add', id: 'mapa-puente', stroke: { k: 'text', l: 'l1', pts: [5, 5], t: 'Torre' } });
  R.act(room, a.id, { t: 'map.add', id: 'mapa-puente', stroke: { k: 'pen', l: 'l1', pts: [1, 1, 2, 2, 3, 2.5] } });
  assert.throws(() => R.act(room, a.id, { t: 'map.add', id: 'mapa-puente', stroke: { k: 'line', l: 'zz', pts: [1, 1, 2, 2] } }), /trazo/, 'capa que no existe');
  assert.throws(() => R.act(room, a.id, { t: 'map.add', id: 'mapa-puente', stroke: { k: 'line', l: 'l1', pts: [1, 1, 900, 2] } }), /trazo/, 'fuera del mapa');
  assert.throws(() => R.act(room, a.id, { t: 'map.add', id: 'mapa-puente', stroke: { k: 'text', l: 'l1', pts: [1, 1], t: ' ' } }), /trazo/);
  n = R.act(room, a.id, { t: 'map.undo', id: 'mapa-puente' }); assert.equal(n[0].msg.t, 'map.rm');
  n = R.act(room, a.id, { t: 'map.rm', id: 'mapa-puente', sids: [sid] }); assert.deepEqual(n[0].msg.sids, [sid]);
  const g = R.act(room, b.id, { t: 'map.get', id: 'mapa-puente' });
  assert.equal(g.length, 1); assert.deepEqual(g[0].msg.map.strokes.map((k) => k.t), ['Torre']);
  R.act(room, b.id, { t: 'map.meta', id: 'mapa-puente', grid: 'hex', layers: [{ id: 'l1', name: 'Suelo' }] });
  assert.equal(R.view(room, a.id).maps[0].grid, 'hex'); assert.equal(R.view(room, a.id).maps[0].layers[0].name, 'Suelo');
  assert.throws(() => R.act(room, b.id, { t: 'map.save', map: { ...map, name: 'Mío' } }), /quien lo creó/);
  assert.throws(() => R.act(room, b.id, { t: 'map.del', id: 'mapa-puente' }), /quien lo creó/);
  R.act(room, dm.id, { t: 'map.del', id: 'mapa-puente' }); assert.equal(R.view(room, a.id).maps.length, 0);
  assert.throws(() => R.act(room, a.id, { t: 'map.save', map: { id: 'x' } }), /formato/);
});
