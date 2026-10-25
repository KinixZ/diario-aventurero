import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rooms, hpState } from '../../server/rooms.mjs';

const pc = (name, hp = 30, initMod = 2) => ({ name, cls: 'Paladin 5', lvl: 5, ac: 18, hp, hpMax: hp, temp: 0, initMod, conds: [] });

test('crear, unirse y volver con el token', () => {
  const R = new Rooms();
  const { room, member: dm } = R.create('DM', null, true);
  assert.equal(room.code.length, 4); assert.equal(dm.role, 'dm');
  const a = R.join(room.code, 'Lyra', pc('Lyra'), null, false).member;
  assert.equal(a.role, 'player');
  R.leave(room, a.id, false); assert.equal(room.members.get(a.id).online, false);
  const back = R.join(room.code.toLowerCase(), 'Lyra', pc('Lyra', 20), a.token, false);
  assert.ok(back.rejoined); assert.equal(back.member.id, a.id); assert.equal(back.member.char.hp, 20);
  assert.throws(() => R.join('ZZZZ', 'X', pc('X')), /No existe/);
});

test('iniciativa ordena, desempata por Destreza y pasa turnos con rondas', () => {
  const R = new Rooms();
  const { room, member: dm } = R.create('DM', null, true);
  const a = R.join(room.code, 'A', pc('A', 30, 1)).member, b = R.join(room.code, 'B', pc('B', 30, 4)).member;
  R.act(room, a.id, { t: 'init', value: 15 }); R.act(room, b.id, { t: 'init', value: 15 });
  R.act(room, dm.id, { t: 'npc.add', name: 'Goblin', ac: 15, hp: 7, init: 18, count: 2 });
  assert.equal(room.order.length, 4);
  assert.equal(room.order[2], b.id, 'B gana el empate por mejor Destreza');
  assert.throws(() => R.act(room, a.id, { t: 'turn', dir: 'next' }), /Solo el DM/);
  const notes = R.act(room, dm.id, { t: 'turn', dir: 'start' });
  assert.equal(room.round, 1); assert.equal(room.turn, 0); assert.equal(notes[0].msg.t, 'yourturn');
  for (let i = 0; i < 4; i++) R.act(room, dm.id, { t: 'turn', dir: 'next' });
  assert.equal(room.round, 2); assert.equal(room.turn, 0);
  // el jugador en turno puede pasarlo
  R.act(room, dm.id, { t: 'turn', dir: 'next' }); R.act(room, dm.id, { t: 'turn', dir: 'next' });
  assert.equal(room.order[room.turn], b.id);
  R.act(room, b.id, { t: 'turn', dir: 'next' });
  assert.equal(room.order[room.turn], a.id);
});

test('aplicar daño y curación: temporales primero, aviso al jugador, PNJ directo', () => {
  const R = new Rooms();
  const { room, member: dm } = R.create('DM', null, true);
  const a = R.join(room.code, 'Lyra', { ...pc('Lyra', 30), temp: 5 }).member;
  R.act(room, dm.id, { t: 'npc.add', name: 'Ogro', ac: 11, hp: 59 });
  const ogro = [...room.npcs.values()][0];
  const b = R.join(room.code, 'Bram', pc('Bram')).member;
  const n = R.act(room, b.id, { t: 'apply', kind: 'damage', amount: 12, targets: [a.id, ogro.id], note: 'Garrote' });
  assert.equal(a.char.temp, 0); assert.equal(a.char.hp, 23); assert.equal(ogro.hp, 47);
  assert.deepEqual(n.map(x => x.to), [a.id]); assert.equal(n[0].msg.amount, 12);
  R.act(room, a.id, { t: 'apply', kind: 'heal', amount: 100, targets: [a.id] });
  assert.equal(a.char.hp, 30);
  R.act(room, a.id, { t: 'apply', kind: 'cond+', cond: 'prone', targets: [ogro.id] });
  assert.deepEqual(ogro.conds, ['prone']);
  assert.throws(() => R.act(room, a.id, { t: 'apply', kind: 'damage', amount: 0, targets: [ogro.id] }), /cantidad/);
  assert.match(room.log.at(-1).text, /Lyra aplicó Derribado a Ogro/);
});

test('lo que ve un jugador: sin PNJ ocultos ni PG exactos de enemigos', () => {
  const R = new Rooms();
  const { room, member: dm } = R.create('DM', null, true);
  const a = R.join(room.code, 'Lyra', pc('Lyra')).member;
  R.act(room, dm.id, { t: 'npc.add', name: 'Asesino', ac: 15, hp: 40, hidden: true });
  R.act(room, dm.id, { t: 'npc.add', name: 'Lobo', ac: 13, hp: 11 });
  const v = R.view(room, a.id);
  assert.deepEqual(v.npcs.map(x => x.name), ['Lobo']);
  assert.equal(v.npcs[0].hp, undefined); assert.equal(v.npcs[0].state, 'ileso');
  assert.equal(R.view(room, dm.id).npcs.length, 2);
  assert.equal(hpState({ hp: 3, hpMax: 40 }), 'casi muerto');
  R.act(room, dm.id, { t: 'hidepc', value: true });
  const b = R.join(room.code, 'Bram', pc('Bram')).member;
  assert.equal(R.view(room, b.id).members.find(m => m.id === a.id).char.hp, null);
  assert.equal(R.view(room, a.id).members.find(m => m.id === a.id).char.hp, 30);
});

test('limpia salas viejas', () => {
  let t = 0; const R = new Rooms(() => t);
  const { room } = R.create('DM', null, true);
  t = 9 * 3600 * 1000; R.sweep();
  assert.equal(R.get(room.code), undefined);
});

test('el DM ajusta a los enemigos y no toca la hoja de los jugadores', () => {
  const R = new Rooms();
  const { room, member: dm } = R.create('DM', null, true);
  const a = R.join(room.code, 'Lyra', pc('Lyra', 30)).member;
  R.act(room, dm.id, { t: 'npc.add', name: 'Troll', ac: 15, hp: 84 });
  const troll = [...room.npcs.values()][0];
  R.act(room, dm.id, { t: 'npc.set', id: troll.id, delta: -10 }); assert.equal(troll.hp, 74);
  R.act(room, dm.id, { t: 'npc.set', id: troll.id, hp: 30, ac: 16, conds: ['prone', 'nope'] });
  assert.equal(troll.hp, 30); assert.equal(troll.ac, 16); assert.deepEqual(troll.conds, ['prone']);
  R.act(room, dm.id, { t: 'npc.set', id: troll.id, hpMax: 20 }); assert.equal(troll.hp, 20);
  assert.throws(() => R.act(room, a.id, { t: 'npc.set', id: troll.id, hp: 1 }), /Solo el DM/);
  // el DM no puede dañar a un jugador; si incluye enemigos, solo se aplica a ellos
  assert.throws(() => R.act(room, dm.id, { t: 'apply', kind: 'damage', amount: 5, targets: [a.id] }), /enemigos/);
  const notes = R.act(room, dm.id, { t: 'apply', kind: 'damage', amount: 5, targets: [a.id, troll.id] });
  assert.equal(a.char.hp, 30); assert.equal(troll.hp, 15); assert.equal(notes.length, 0);
  // los jugadores sí pueden dañar enemigos y curarse entre ellos
  R.act(room, a.id, { t: 'apply', kind: 'damage', amount: 3, targets: [troll.id] }); assert.equal(troll.hp, 12);
});
