import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Campaigns, hpState, checkKey } from '../../server/campaigns.mjs';
import { memoryStore } from '../../server/store.mjs';
import { mesa, pc } from './helpers.mjs';

test('crear campaña: código fijo de 6 letras, clave del DM y entrar desde otro aparato', async () => {
  const { R, c, dm, a } = await mesa();
  assert.match(c.code, /^[A-HJKMNP-Z]{6}$/); assert.equal(dm.role, 'dm'); assert.equal(a.role, 'player');
  assert.ok(checkKey('dragon', c.dmHash)); assert.ok(!checkKey('otra', c.dmHash));
  // el DM entra desde su tablet con la clave: es el mismo DM
  const dm2 = R.join(c, { dmKey: 'dragon' }); assert.equal(dm2.member.id, dm.id); assert.ok(dm2.rejoined);
  assert.throws(() => R.join(c, { dmKey: 'mala' }), /clave del DM/);
  // volver con el token recupera tu lugar
  const back = R.join(c, { token: a.token, char: pc('Lyra', 20) }); assert.ok(back.rejoined); assert.equal(back.member.id, a.id); assert.equal(back.member.char.hp, 20);
  // en otro teléfono, sin token, con el mismo personaje y sin estar conectado: recupera su lugar
  const other = R.join(c, { name: 'Lyra', char: pc('Lyra') }); assert.equal(other.member.id, a.id);
  R.connect(c, a.id); assert.notEqual(R.join(c, { name: 'Lyra', char: pc('Lyra') }).member.id, a.id, 'si está conectada en otro lado, es otra persona');
  await assert.rejects(R.open('ZZZZZZ'), /No existe/);
  await assert.rejects(R.open('ABC'), /6 letras/);
  await assert.rejects(R.create({ name: 'x', dmKey: '12' }), /al menos 4/);
});

test('la campaña se guarda y vuelve igual después de un reinicio', async () => {
  const { R, c, dm, a, store } = await mesa();
  R.act(c, dm.id, { t: 'session.start', title: 'La cripta' });
  R.act(c, a.id, { t: 'chat.send', text: 'Abro la puerta' });
  R.act(c, a.id, { t: 'init', value: 14 });
  R.act(c, dm.id, { t: 'npc.add', name: 'Ogro', ac: 11, hp: 59, init: 8 });
  R.act(c, dm.id, { t: 'board.add', item: { cat: 'mision', title: 'Rescatar a Vel' } });
  assert.ok(c.dirty); await R.flushAll(); assert.ok(!c.dirty);
  // otro servidor con el mismo almacén
  const R2 = new Campaigns(store), c2 = await R2.open(c.code.toLowerCase());
  assert.equal(c2.name, 'La Costa de la Espada'); assert.equal(c2.live, true); assert.equal(c2.session.title, 'La cripta');
  assert.equal(c2.chat.length, 1); assert.equal(c2.npcs.size, 1); assert.equal(c2.order.length, 2); assert.equal(c2.board[0].title, 'Rescatar a Vel');
  const back = R2.join(c2, { token: a.token }); assert.equal(back.member.id, a.id);
  assert.equal(R2.join(c2, { dmKey: 'dragon' }).member.id, dm.id);
  assert.equal(R2.view(c2, a.id).members.find((m) => m.id === a.id).online, false);
});

test('se descarga de memoria cuando nadie la usa, guardando antes', async () => {
  let t = 0; const { R, c, a } = await mesa({ now: () => t });
  R.connect(c, a.id); R.act(c, a.id, { t: 'chat.send', text: 'hola' });
  t = 60 * 60 * 1000; await R.sweep(); assert.ok(R.get(c.code), 'con alguien conectado se queda');
  R.disconnect(c, a.id); t += 25 * 60 * 1000; await R.sweep();
  assert.equal(R.get(c.code), undefined);
  const again = await R.open(c.code); assert.equal(again.chat.length, 1);
});

test('sesión: el DM la empieza y la termina; fuera de sesión todo sigue disponible', async () => {
  const { R, c, dm, a, b } = await mesa();
  assert.throws(() => R.act(c, a.id, { t: 'session.start' }), /Solo el DM/);
  R.act(c, a.id, { t: 'chat.send', text: 'antes de la sesión' });
  let n = R.act(c, dm.id, { t: 'session.start', title: 'La cripta de Vel' });
  assert.equal(c.live, true); assert.equal(c.session.n, 1); assert.equal(n.filter((x) => x.msg.t === 'live').length, 3);
  R.act(c, a.id, { t: 'chat.send', text: 'hola' }); R.act(c, a.id, { t: 'chat.send', text: 'secreto', to: dm.id });
  R.act(c, b.id, { t: 'draw.add', stroke: { color: '#112233', w: 4, pts: [0, 0, 1, 1] } });
  n = R.act(c, dm.id, { t: 'session.end' });
  const forB = n.find((x) => x.to === b.id).msg.snapshot;
  assert.equal(forB.title, 'La cripta de Vel'); assert.equal(forB.n, 1); assert.equal(forB.campaign, 'La Costa de la Espada');
  assert.equal(forB.chat.length, 1, 'Bram no ve el susurro ni lo de antes de la sesión'); assert.equal(forB.pages.length, 1);
  assert.equal(c.live, false);
  assert.throws(() => R.act(c, dm.id, { t: 'session.end' }), /No hay una sesión/);
  // fuera de sesión: chat, tablero y mapas siguen
  R.act(c, b.id, { t: 'chat.send', text: '¿Qué hacemos con la gema?' });
  assert.equal(c.chat.length, 4); assert.equal(c.chat.at(-1).ses, 0);
  R.act(c, dm.id, { t: 'session.start' }); assert.equal(c.session.n, 2); assert.equal(c.session.title, 'La cripta de Vel', 'conserva el título si no se da otro');
  assert.equal(R.peek(c).live, true);
});

test('el DM cambia nombre y clave, y quita a un jugador', async () => {
  const { R, c, dm, a, b } = await mesa();
  R.act(c, dm.id, { t: 'camp.name', name: 'Tumba de la aniquilación' }); assert.equal(c.name, 'Tumba de la aniquilación');
  R.act(c, dm.id, { t: 'camp.key', key: 'nueva-clave' }); assert.ok(checkKey('nueva-clave', c.dmHash));
  assert.throws(() => R.act(c, a.id, { t: 'member.del', id: b.id }), /Solo el DM/);
  R.act(c, b.id, { t: 'init', value: 10 });
  const n = R.act(c, dm.id, { t: 'member.del', id: b.id });
  assert.equal(n.kicked, b.id); assert.ok(!c.members.has(b.id)); assert.ok(!c.order.includes(b.id));
  assert.throws(() => R.act(c, b.id, { t: 'chat.send', text: 'x' }), /Ya no estás/);
  R.act(c, dm.id, { t: 'member.del', id: dm.id }); assert.ok(c.members.has(dm.id), 'al DM no se le puede quitar');
});

test('iniciativa ordena, desempata por Destreza y pasa turnos con rondas', async () => {
  const { R, c, dm, a, b } = await mesa();
  R.act(c, a.id, { t: 'init', value: 15 }); R.act(c, b.id, { t: 'init', value: 15 });
  R.act(c, dm.id, { t: 'npc.add', name: 'Goblin', ac: 15, hp: 7, init: 18, count: 2 });
  assert.equal(c.order.length, 4);
  assert.equal(c.order[2], b.id, 'Bram gana el empate por mejor Destreza');
  assert.throws(() => R.act(c, a.id, { t: 'turn', dir: 'next' }), /Solo el DM/);
  const notes = R.act(c, dm.id, { t: 'turn', dir: 'start' });
  assert.equal(c.round, 1); assert.equal(c.turn, 0); assert.equal(notes[0].msg.t, 'yourturn');
  for (let i = 0; i < 4; i++) R.act(c, dm.id, { t: 'turn', dir: 'next' });
  assert.equal(c.round, 2); assert.equal(c.turn, 0);
  R.act(c, dm.id, { t: 'turn', dir: 'next' }); R.act(c, dm.id, { t: 'turn', dir: 'next' });
  assert.equal(c.order[c.turn], b.id);
  R.act(c, b.id, { t: 'turn', dir: 'next' });
  assert.equal(c.order[c.turn], a.id);
});

test('aplicar daño y curación: temporales primero, aviso al jugador, PNJ directo', async () => {
  const { R, c, dm, a, b } = await mesa();
  a.char.temp = 5;
  R.act(c, dm.id, { t: 'npc.add', name: 'Ogro', ac: 11, hp: 59 });
  const ogro = [...c.npcs.values()][0];
  const n = R.act(c, b.id, { t: 'apply', kind: 'damage', amount: 12, targets: [a.id, ogro.id], note: 'Garrote' });
  assert.equal(a.char.temp, 0); assert.equal(a.char.hp, 23); assert.equal(ogro.hp, 47);
  assert.deepEqual(n.map(x => x.to), [a.id]); assert.equal(n[0].msg.amount, 12);
  R.act(c, a.id, { t: 'apply', kind: 'heal', amount: 100, targets: [a.id] });
  assert.equal(a.char.hp, 30);
  R.act(c, a.id, { t: 'apply', kind: 'cond+', cond: 'prone', targets: [ogro.id] });
  assert.deepEqual(ogro.conds, ['prone']);
  assert.throws(() => R.act(c, a.id, { t: 'apply', kind: 'damage', amount: 0, targets: [ogro.id] }), /cantidad/);
  assert.match(c.log.at(-1).text, /Lyra aplicó Derribado a Ogro/);
});

test('lo que ve un jugador: sin PNJ ocultos ni PG exactos de enemigos', async () => {
  const { R, c, dm, a, b } = await mesa();
  R.act(c, dm.id, { t: 'npc.add', name: 'Asesino', ac: 15, hp: 40, hidden: true });
  R.act(c, dm.id, { t: 'npc.add', name: 'Lobo', ac: 13, hp: 11 });
  const v = R.view(c, a.id);
  assert.deepEqual(v.npcs.map(x => x.name), ['Lobo']);
  assert.equal(v.npcs[0].hp, undefined); assert.equal(v.npcs[0].state, 'ileso');
  assert.equal(R.view(c, dm.id).npcs.length, 2);
  assert.equal(hpState({ hp: 3, hpMax: 40 }), 'casi muerto');
  R.act(c, dm.id, { t: 'hidepc', value: true });
  assert.equal(R.view(c, b.id).members.find(m => m.id === a.id).char.hp, null);
  assert.equal(R.view(c, a.id).members.find(m => m.id === a.id).char.hp, 30);
  assert.equal(v.name, 'La Costa de la Espada'); assert.equal(v.live, false);
  assert.equal(JSON.stringify(v).includes('dmHash'), false); assert.equal(JSON.stringify(v).includes(a.token), false, 'los tokens no salen en la vista');
});

test('el DM ajusta a los enemigos y no toca la hoja de los jugadores', async () => {
  const { R, c, dm, a } = await mesa();
  R.act(c, dm.id, { t: 'npc.add', name: 'Troll', ac: 15, hp: 84 });
  const troll = [...c.npcs.values()][0];
  R.act(c, dm.id, { t: 'npc.set', id: troll.id, delta: -10 }); assert.equal(troll.hp, 74);
  R.act(c, dm.id, { t: 'npc.set', id: troll.id, hp: 30, ac: 16, conds: ['prone', 'nope'] });
  assert.equal(troll.hp, 30); assert.equal(troll.ac, 16); assert.deepEqual(troll.conds, ['prone']);
  R.act(c, dm.id, { t: 'npc.set', id: troll.id, hpMax: 20 }); assert.equal(troll.hp, 20);
  assert.throws(() => R.act(c, a.id, { t: 'npc.set', id: troll.id, hp: 1 }), /Solo el DM/);
  assert.throws(() => R.act(c, dm.id, { t: 'apply', kind: 'damage', amount: 5, targets: [a.id] }), /enemigos/);
  const notes = R.act(c, dm.id, { t: 'apply', kind: 'damage', amount: 5, targets: [a.id, troll.id] });
  assert.equal(a.char.hp, 30); assert.equal(troll.hp, 15); assert.equal(notes.length, 0);
  R.act(c, a.id, { t: 'apply', kind: 'damage', amount: 3, targets: [troll.id] }); assert.equal(troll.hp, 12);
});

test('vida de los enemigos: el DM elige qué ven los jugadores', async () => {
  const { R, c, dm, a } = await mesa();
  const ogro = (v) => v.npcs.find((n) => n.name === 'Ogro');
  R.act(c, dm.id, { t: 'npc.add', name: 'Ogro', ac: 11, hp: 68, init: 8, ref: 'Ogre|XMM', initMod: -1, formula: '8d10 + 24' });
  const id = ogro(R.view(c, dm.id)).id;
  R.act(c, dm.id, { t: 'npc.set', id, delta: -17 });
  let o = ogro(R.view(c, a.id));
  assert.equal(o.state, 'herido'); assert.equal(o.hp, undefined); assert.equal(o.ref, undefined, 'los jugadores no ven qué monstruo es');
  R.act(c, dm.id, { t: 'npchp', value: 'pct' }); o = ogro(R.view(c, a.id)); assert.equal(o.pct, 75); assert.equal(o.state, null);
  R.act(c, dm.id, { t: 'npchp', value: 'num' }); o = ogro(R.view(c, a.id)); assert.equal(o.hp, 51); assert.equal(o.hpMax, 68);
  R.act(c, dm.id, { t: 'npchp', value: 'none' }); o = ogro(R.view(c, a.id)); assert.equal(o.hp, undefined); assert.equal(o.state, undefined);
  assert.throws(() => R.act(c, a.id, { t: 'npchp', value: 'num' }), /Solo el DM/);
  assert.throws(() => R.act(c, dm.id, { t: 'npchp', value: 'todo' }), /desconocida/);
});

test('encuentro guardado: se carga con PG, estados, iniciativa y turno', async () => {
  const { R, c, dm, a, b } = await mesa();
  const enc = { name: 'Emboscada en el puente', round: 3, turnName: 'Ogro', pcInit: { Lyra: 17, Bram: 5, Nadie: 9 },
    npcs: [{ name: 'Ogro', ac: 11, hp: 20, hpMax: 68, init: 8, conds: ['prone', 'nada'], ref: 'Ogre|XMM' }, { name: 'Goblin', ac: 15, hp: 0, hpMax: 7, init: 14, hidden: true }] };
  R.act(c, dm.id, { t: 'enc.load', enc });
  const v = R.view(c, dm.id);
  assert.equal(v.round, 3);
  assert.deepEqual(v.order.map((x) => R.nameOf(c, x)), ['Lyra', 'Goblin', 'Ogro', 'Bram']);
  assert.equal(R.nameOf(c, v.turnId), 'Ogro');
  assert.equal(R.view(c, a.id).order.length, 3, 'el goblin oculto no aparece para los jugadores');
  assert.throws(() => R.act(c, b.id, { t: 'enc.load', enc }), /Solo el DM/);
  R.act(c, dm.id, { t: 'enc.load', enc: { ...enc, pcInit: { Cael: 12 } } });
  const k = R.join(c, { name: 'Cael', char: pc('Cael') }).member;
  assert.equal(k.init, 12); assert.ok(R.view(c, dm.id).order.includes(k.id));
});

test('chat, tiradas y susurros: cada quien ve lo suyo', async () => {
  const { R, c, dm, a, b } = await mesa();
  let n = R.act(c, a.id, { t: 'chat.send', text: 'Abro la puerta\ncon cuidado' });
  assert.equal(n.quiet, true); assert.equal(n.length, 3); assert.equal(n[0].msg.msg.name, 'Lyra'); assert.equal(n[0].msg.msg.text, 'Abro la puerta\ncon cuidado');
  n = R.act(c, b.id, { t: 'chat.roll', label: 'Percepción', total: 17, nat: 12, adv: 'adv' });
  assert.equal(n[0].msg.msg.roll.total, 17);
  n = R.act(c, a.id, { t: 'chat.send', text: 'Robo la gema', to: dm.id });
  assert.deepEqual(n.map((x) => x.to).sort(), [a.id, dm.id].sort());
  assert.throws(() => R.act(c, a.id, { t: 'chat.send', text: 'psst', to: b.id }), /entre un jugador y el DM/);
  R.act(c, dm.id, { t: 'chat.send', text: 'Sientes un escalofrío', to: b.id });
  assert.equal(R.mesaInit(c, b.id).chat.length, 3);
  assert.equal(R.mesaInit(c, a.id).chat.length, 3);
});

test('tablero y pizarra', async () => {
  const { R, c, dm, a, b } = await mesa();
  assert.throws(() => R.act(c, a.id, { t: 'board.add', item: { title: 'x' } }), /Solo el DM/);
  R.act(c, dm.id, { t: 'board.add', item: { cat: 'pnj', title: 'Vela, la herrera', text: 'Debe un favor' } });
  const id = c.board[0].id;
  R.act(c, dm.id, { t: 'board.edit', id, item: { cat: 'pnj', title: 'Vela, la herrera', text: 'Ya pagó' } });
  R.act(c, dm.id, { t: 'board.done', id });
  assert.equal(R.view(c, a.id).board[0].text, 'Ya pagó');
  const st = { color: '#aa2233', w: 6, pts: [0.1, 0.1, 0.2, 0.25, 0.3, 0.3] };
  R.act(c, a.id, { t: 'draw.add', stroke: st }); R.act(c, b.id, { t: 'draw.add', stroke: st }); R.act(c, a.id, { t: 'draw.add', stroke: st });
  R.act(c, a.id, { t: 'draw.undo' });
  assert.equal(c.strokes.length, 2); assert.equal(c.strokes[1].by, b.id);
  assert.throws(() => R.act(c, a.id, { t: 'draw.clear' }), /Solo el DM/);
  R.act(c, dm.id, { t: 'draw.clear' }); assert.equal(c.strokes.length, 0); assert.equal(c.pages.length, 1);
});
