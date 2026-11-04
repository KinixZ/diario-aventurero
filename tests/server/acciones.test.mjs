import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mesa } from './helpers.mjs';

const to = (n, id) => n.filter((x) => x.to === id).map((x) => x.msg);
const card = (n, id) => to(n, id).find((m) => m.t === 'act')?.card;

async function pelea() {
  const ctx = await mesa(), { R, c, dm, a, b } = ctx;
  R.act(c, dm.id, { t: 'npc.add', name: 'Goblin', ac: 15, hp: 7, count: 2, initMod: 2 });
  R.act(c, dm.id, { t: 'npc.add', name: 'Asesino', ac: 15, hp: 30, hidden: true });
  const [g1, g2, ase] = [...c.npcs.values()];
  R.act(c, a.id, { t: 'init', value: 15 }); R.act(c, b.id, { t: 'init', value: 10 });
  R.act(c, dm.id, { t: 'init.npcs' });
  R.act(c, dm.id, { t: 'turn', dir: 'start' });
  return { ...ctx, g1, g2, ase };
}

test('acción del jugador: ataque y daño tirados en el servidor, impacta según la CA; el daño al enemigo lo aplica quien atacó', async () => {
  const { R, c, dm, a, b, g1, g2 } = await pelea();
  assert.equal(c.fightN, 1, 'empezar el combate le da número');
  let n = R.act(c, a.id, { t: 'act.post', act: { title: 'Espada larga', atk: { bonus: 7 }, dmg: [{ dice: '1d8+4', type: 'cortante' }], targets: [g1.id, g2.id, 'nadie'] } });
  const k = card(n, a.id);
  assert.match(k.id, /^a/); assert.equal(k.actor.name, 'Lyra'); assert.equal(k.f, 1); assert.equal(k.round, 1);
  assert.ok(k.atk.nat >= 1 && k.atk.nat <= 20 && k.atk.total === k.atk.nat + 7);
  assert.equal(k.dmg[0].dice, '1d8 + 4');
  const d = k.dmg[0].rolls[0]; assert.ok(d >= 1 && d <= 8); assert.equal(k.amt, (k.atk.crit ? k.dmg[0].rolls[0] + k.dmg[0].rolls[1] : d) + 4);
  assert.equal(k.targets.length, 2, 'los que no existen no cuentan');
  const hit = k.atk.crit || (!k.atk.fumble && k.atk.total >= 15);
  assert.equal(k.targets[0].hit, hit);
  assert.equal(k.targets[0].ac, undefined, 'el jugador no ve la CA del enemigo');
  assert.equal(card(n, dm.id).targets[0].ac, 15, 'el DM sí');
  assert.ok(card(n, b.id), 'a todos les llega');
  // aplicar: el que atacó o el DM; otro jugador no
  assert.throws(() => R.act(c, b.id, { t: 'act.apply', id: k.id, tid: g1.id }), /DM o quien/);
  R.act(c, a.id, { t: 'act.apply', id: k.id, tid: g1.id, how: 'full' });
  assert.equal(g1.hp, Math.max(0, 7 - k.amt));
  assert.throws(() => R.act(c, a.id, { t: 'act.apply', id: k.id, tid: g1.id }), /ya se aplicó/);
  R.act(c, dm.id, { t: 'act.apply', id: k.id, tid: g2.id, how: 'half' });
  assert.equal(g2.hp, 7 - Math.floor(k.amt / 2));
  // la del jugador se borra por él o por el DM
  assert.throws(() => R.act(c, b.id, { t: 'act.del', id: k.id }), /Solo quien/);
  n = R.act(c, a.id, { t: 'act.del', id: k.id });
  assert.ok(to(n, b.id).some((m) => m.t === 'act.del'));
  assert.equal(c.acts.length, 0);
});

test('acción del enemigo con salvación: cada jugador tira la suya y aplica a su hoja (completo o mitad)', async () => {
  const { R, c, dm, a, b, g1 } = await pelea();
  const n = R.act(c, dm.id, { t: 'act.post', act: { actor: g1.id, title: 'Aliento', save: { ab: 'dex', dc: 13 }, dmg: [{ dice: '4d6', type: 'fuego' }], targets: [a.id, b.id] } });
  const k = card(n, a.id);
  assert.equal(k.actor.kind, 'npc'); assert.equal(k.actor.name, g1.name); assert.equal(k.atk, undefined);
  assert.ok(k.amt >= 4 && k.amt <= 24); assert.equal(k.save.dc, 13);
  assert.throws(() => R.act(c, b.id, { t: 'act.save', id: k.id, tid: a.id, mod: 3 }), /Cada quien/);
  R.act(c, a.id, { t: 'act.save', id: k.id, tid: a.id, mod: 3, k: 'adv' });
  const sv = c.acts.at(-1).targets[0].sv;
  assert.equal(sv.dice.length, 2); assert.equal(sv.total, sv.nat + 3); assert.equal(sv.ok, sv.nat !== 1 && (sv.nat === 20 || sv.total >= 13));
  assert.throws(() => R.act(c, a.id, { t: 'act.save', id: k.id, tid: a.id, mod: 3 }), /Ya tiró/);
  // el DM no aplica en la hoja de un jugador; el jugador sí (le llega `applied`)
  assert.throws(() => R.act(c, dm.id, { t: 'act.apply', id: k.id, tid: a.id }), /Cada quien aplica/);
  const m = R.act(c, a.id, { t: 'act.apply', id: k.id, tid: a.id, how: 'half' });
  const ap = to(m, a.id).find((x) => x.t === 'applied');
  assert.deepEqual([ap.kind, ap.amount, ap.from, ap.note], ['damage', Math.floor(k.amt / 2), g1.name, 'Aliento']);
  R.act(c, b.id, { t: 'act.apply', id: k.id, tid: b.id, how: 'none' });
  assert.deepEqual(c.acts.at(-1).targets.map((t) => t.res), ['half', 'none']);
});

test('vida de enemigos oculta: el daño que reciben no se ve (salvo quien lo hizo); enemigos ocultos no aparecen', async () => {
  const { R, c, dm, a, b, g1, ase } = await pelea();
  R.act(c, dm.id, { t: 'npchp', value: 'none' });
  let n = R.act(c, a.id, { t: 'act.post', act: { title: 'Rayo', dmg: [{ dice: '2d10', type: 'relámpago' }], targets: [g1.id] } });
  const mine = card(n, a.id), other = card(n, b.id), dms = card(n, dm.id);
  assert.ok(mine.amt > 0 && mine.dmg[0].total > 0, 'quien lo hizo ve su daño');
  assert.equal(other.amt, undefined); assert.equal(other.dmg[0].total, undefined); assert.ok(other.dmg[0].hidden); assert.equal(other.dmg[0].dice, '2d10');
  assert.ok(dms.amt > 0, 'el DM ve todo');
  n = R.act(c, a.id, { t: 'act.apply', id: mine.id, tid: g1.id });
  assert.equal(card(n, b.id).targets[0].amt, undefined);
  assert.equal(card(n, a.id).targets[0].amt, mine.amt);
  const logB = R.view(c, b.id).log.at(-1).text, logDm = R.view(c, dm.id).log.at(-1).text;
  assert.match(logB, /Goblin 1 recibe daño \(Rayo\)/); assert.match(logDm, /recibe \d+ de daño/);
  // con los números a la vista, sí se ve
  R.act(c, dm.id, { t: 'npchp', value: 'num' });
  n = R.act(c, a.id, { t: 'act.post', act: { title: 'Rayo', dmg: [{ dice: '2d10' }], targets: [g1.id] } });
  assert.ok(card(n, b.id).amt > 0);
  // el asesino oculto: sus acciones no le llegan a los jugadores y como objetivo no aparece
  n = R.act(c, dm.id, { t: 'act.post', act: { actor: ase.id, title: 'Daga', atk: { bonus: 6 }, dmg: [{ dice: '1d4+3' }], targets: [b.id] } });
  assert.equal(card(n, b.id), undefined); assert.ok(card(n, dm.id));
  assert.equal(R.view(c, b.id).log.some((l) => /Asesino/.test(l.text)), false);
  n = R.act(c, dm.id, { t: 'act.post', act: { title: 'Trampa', text: 'Cae una red', targets: [ase.id, a.id] } });
  assert.deepEqual(card(n, a.id).targets.map((t) => t.name), ['Lyra']);
  assert.equal(card(n, a.id).actor.kind, 'dm');
  // al entrar, cada quien recibe las últimas tarjetas que puede ver
  const init = R.mesaInit(c, b.id);
  assert.equal(init.fightN, 1); assert.ok(init.acts.length >= 3); assert.equal(init.acts.some((x) => x.actor.name === 'Asesino'), false);
});

test('dados: crítico duplica los dados, expresiones raras no se tiran, compañeros y se guarda', async () => {
  const { R, c, dm, a, g1 } = await pelea();
  for (let i = 0; i < 400; i++) {
    const n = R.act(c, a.id, { t: 'act.post', act: { title: 'Golpe', atk: { bonus: 0, critOn: 15 }, dmg: [{ dice: '2d6+1' }], targets: [g1.id] } });
    const k = card(n, a.id); c.acts.length = 0;
    if (k.atk.crit) { assert.equal(k.dmg[0].rolls.length, 4, 'crítico: 4d6'); assert.equal(k.dmg[0].dice, '4d6 + 1'); assert.ok(k.atk.nat >= 15); assert.equal(k.targets[0].hit, true); break; }
  }
  let n = R.act(c, a.id, { t: 'act.post', act: { title: 'Raro', dmg: [{ dice: 'hola' }, { dice: '1d8 - 1 + 1d4' }] } });
  let k = card(n, a.id);
  assert.equal(k.dmg.length, 1); assert.equal(k.dmg[0].dice, '1d8 - 1 + 1d4'); assert.equal(k.dmg[0].rolls.length, 2);
  assert.throws(() => R.act(c, a.id, { t: 'act.post', act: {} }), /Escribe qué haces/);
  n = R.act(c, a.id, { t: 'act.post', act: { comp: 'Lobo', title: 'Mordisco', atk: { bonus: 4 }, dmg: [{ dice: '2d4+2', type: 'perforante' }], targets: [g1.id] } });
  k = card(n, a.id); assert.deepEqual([k.actor.name, k.actor.of], ['Lobo', 'Lyra']);
  n = R.act(c, a.id, { t: 'act.post', act: { title: 'Palabra de curación', heal: true, dmg: [{ dice: '1d4+3' }], targets: [a.id] } });
  k = card(n, a.id); R.act(c, a.id, { t: 'act.apply', id: k.id, tid: a.id });
  const c2 = R.fromDoc(JSON.parse(JSON.stringify(R.toDoc(c))));
  assert.equal(c2.acts.length, c.acts.length); assert.equal(c2.fightN, 1);
  R.act(c, dm.id, { t: 'end' });
  R.act(c, a.id, { t: 'init', value: 5 }); R.act(c, dm.id, { t: 'turn', dir: 'start' });
  assert.equal(c.fightN, 2, 'otro combate, otro número');
});
