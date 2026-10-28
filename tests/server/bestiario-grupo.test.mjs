import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mesa } from './helpers.mjs';

test('los monstruos de los manuales que entran al combate se anotan solos como encuentros', async () => {
  const { R, c, dm, a } = await mesa();
  R.act(c, dm.id, { t: 'npc.add', name: 'Goblin', ac: 15, hp: 7, count: 3, ref: 'Goblin|XMM', binfo: { type: 'feérico', size: 'Pequeño' } });
  assert.equal(c.beasts.length, 1, 'tres goblins, una sola entrada');
  assert.equal(c.beasts[0].name, 'Goblin'); assert.equal(c.beasts[0].ref, 'Goblin|XMM'); assert.equal(c.beasts[0].auto, true); assert.equal(c.beasts[0].manual, true);
  assert.deepEqual(c.beasts[0].info, { type: 'feérico', size: 'Pequeño' });
  R.act(c, dm.id, { t: 'npc.add', name: 'Bandido', ac: 12, hp: 11 });
  assert.equal(c.beasts.length, 1, 'un enemigo hecho a mano no se anota solo');
  R.act(c, dm.id, { t: 'npc.add', name: 'Asesino', ac: 15, hp: 40, hidden: true, ref: 'Assassin|XMM' });
  assert.equal(c.beasts.length, 1, 'el oculto no se anota todavía');
  const asesino = [...c.npcs.values()].find((n) => n.name === 'Asesino');
  R.act(c, dm.id, { t: 'npc.reveal', id: asesino.id });
  assert.deepEqual(c.beasts.map((b) => b.name), ['Asesino', 'Goblin']);
  const v = R.view(c, a.id);
  assert.equal(v.beasts.length, 2); assert.equal(v.beasts[0].ref, 'Assassin|XMM', 'vinculado al manual: los jugadores pueden leer su entrada'); assert.equal(v.beasts[0].manual, true);
  // el DM puede quitar el vínculo: entonces los jugadores ya no ven de qué libro es
  const id = c.beasts[0].id;
  R.act(c, dm.id, { t: 'beast.edit', id, beast: { name: 'El encapuchado', kind: 'enemigo', ref: 'Assassin|XMM', manual: false } });
  assert.equal(R.view(c, a.id).beasts[0].ref, undefined);
  assert.equal(R.act(c, a.id, { t: 'beast.get', id })[0].msg.beast.ref, null);
  assert.equal(R.act(c, dm.id, { t: 'beast.get', id })[0].msg.beast.ref, 'Assassin|XMM');
  R.act(c, dm.id, { t: 'beast.auto', value: false });
  R.act(c, dm.id, { t: 'npc.add', name: 'Lobo', ac: 13, hp: 11, ref: 'Wolf|XMM' });
  assert.equal(c.beasts.length, 2, 'con el registro automático apagado no se anota');
});

test('tablero: misiones principales y secundarias, en papel o pergamino', async () => {
  const { R, c, dm } = await mesa();
  R.act(c, dm.id, { t: 'board.add', item: { cat: 'mision', title: 'Rescatar a Vel', prio: 'main', look: 'scroll' } });
  R.act(c, dm.id, { t: 'board.add', item: { cat: 'mision', title: 'Traer hongos', prio: 'rara', look: 'x' } });
  assert.deepEqual(c.board.map((b) => [b.title, b.prio, b.look]), [['Traer hongos', 'side', 'paper'], ['Rescatar a Vel', 'main', 'scroll']]);
});

test('el DM revela lo que quiere; todos dejan notas', async () => {
  const { R, c, dm, a, b } = await mesa();
  assert.throws(() => R.act(c, a.id, { t: 'beast.add', beast: { name: 'Vela' } }), /Solo el DM/);
  const stat = { name: 'Ogre', source: 'XMM', ac: [11], hp: { average: 68, formula: '8d10 + 24' }, str: 19 };
  let n = R.act(c, dm.id, { t: 'beast.add', beast: { name: 'Ogro', kind: 'enemigo', ref: 'Ogre|XMM', text: 'Huele a pantano.', info: { type: 'gigante', cr: '2', ac: '11', nope: 'x' }, stat, hidden: true } });
  const id = n.find((x) => x.msg.t === 'beast.saved').msg.id;
  assert.equal(R.view(c, a.id).beasts.length, 0, 'en preparación: los jugadores no lo ven');
  assert.throws(() => R.act(c, a.id, { t: 'beast.get', id }), /no está/);
  R.act(c, dm.id, { t: 'beast.edit', id, beast: { name: 'Ogro', kind: 'enemigo', ref: 'Ogre|XMM', text: 'Huele a pantano.', info: { type: 'gigante', cr: '2' }, stat, hidden: false } });
  const sum = R.view(c, a.id).beasts[0];
  assert.equal(sum.name, 'Ogro'); assert.equal(sum.hasStat, true); assert.equal(sum.stat, undefined, 'la ficha completa no viaja en cada estado');
  assert.deepEqual(sum.info, { type: 'gigante', cr: '2' });
  const full = R.act(c, a.id, { t: 'beast.get', id })[0].msg.beast;
  assert.equal(full.stat.hp.average, 68); assert.equal(full.text, 'Huele a pantano.');
  n = R.act(c, a.id, { t: 'beast.note', id, text: 'Le duele el fuego.\nO eso creo.' });
  assert.equal(n.filter((x) => x.msg.t === 'beast').length, 3);
  R.act(c, b.id, { t: 'beast.note', id, text: 'Lo vimos en el pantano de Vel' });
  const nid = c.beasts[0].notes[0].id;
  assert.throws(() => R.act(c, b.id, { t: 'beast.unnote', id, nid }), /tus notas/);
  R.act(c, a.id, { t: 'beast.unnote', id, nid }); assert.equal(c.beasts[0].notes.length, 1);
  assert.throws(() => R.act(c, a.id, { t: 'beast.note', id, text: '   ' }), /Escribe/);
  // registrar otra vez el mismo nombre actualiza la entrada y conserva las notas
  R.act(c, dm.id, { t: 'beast.add', beast: { name: 'ogro', text: 'Jefe de la tribu' } });
  assert.equal(c.beasts.length, 1); assert.equal(c.beasts[0].text, 'Jefe de la tribu'); assert.equal(c.beasts[0].notes.length, 1);
  assert.throws(() => R.act(c, dm.id, { t: 'beast.add', beast: { name: 'Enorme', stat: { x: 'y'.repeat(90000) } } }), /demasiado grande/);
  R.act(c, dm.id, { t: 'beast.del', id }); assert.equal(c.beasts.length, 0);
});
