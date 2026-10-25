import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rooms } from '../../server/rooms.mjs';
import { startServer } from '../../server/index.mjs';

const pc = (name) => ({ name, cls: 'Bard 5', lvl: 5, ac: 14, hp: 30, hpMax: 30 });
function mesa() {
  const R = new Rooms();
  const { room, member: dm } = R.create('DM', null, true);
  const a = R.join(room.code, 'Lyra', pc('Lyra')).member, b = R.join(room.code, 'Bram', pc('Bram')).member;
  return { R, room, dm, a, b };
}

test('chat, tiradas y susurros: cada quien ve lo suyo', () => {
  const { R, room, dm, a, b } = mesa();
  let n = R.act(room, a.id, { t: 'chat.send', text: 'Abro la puerta' });
  assert.equal(n.quiet, true); assert.equal(n.length, 3); assert.equal(n[0].msg.msg.name, 'Lyra');
  n = R.act(room, b.id, { t: 'chat.roll', label: 'Percepción', total: 17, nat: 12, adv: 'adv' });
  assert.equal(n[0].msg.msg.roll.total, 17); assert.equal(n[0].msg.msg.roll.adv, 'adv');
  n = R.act(room, a.id, { t: 'chat.send', text: 'Robo la gema', to: dm.id });
  assert.deepEqual(n.map((x) => x.to).sort(), [a.id, dm.id].sort(), 'el susurro solo llega a Lyra y al DM');
  assert.throws(() => R.act(room, a.id, { t: 'chat.send', text: 'psst', to: b.id }), /entre un jugador y el DM/);
  R.act(room, dm.id, { t: 'chat.send', text: 'Sientes un escalofrío', to: b.id });
  assert.equal(R.mesaInit(room, b.id).chat.length, 3); // Lyra, su tirada y el susurro del DM
  assert.equal(R.mesaInit(room, a.id).chat.length, 3); // Lyra, tirada de Bram y su susurro
  assert.throws(() => R.act(room, a.id, { t: 'chat.send', text: '  ' }), /Escribe algo/);
});

test('tablero: solo el DM escribe; todos lo ven en el estado', () => {
  const { R, room, dm, a } = mesa();
  assert.throws(() => R.act(room, a.id, { t: 'board.add', item: { title: 'x' } }), /Solo el DM/);
  R.act(room, dm.id, { t: 'board.add', item: { cat: 'pnj', title: 'Vela, la herrera', text: 'Debe un favor' } });
  const id = room.board[0].id;
  R.act(room, dm.id, { t: 'board.edit', id, item: { cat: 'pnj', title: 'Vela, la herrera', text: 'Ya pagó' } });
  R.act(room, dm.id, { t: 'board.done', id });
  const v = R.view(room, a.id);
  assert.equal(v.board[0].text, 'Ya pagó'); assert.equal(v.board[0].done, true); assert.equal(v.board[0].cat, 'pnj');
  R.act(room, dm.id, { t: 'board.del', id }); assert.equal(room.board.length, 0);
});

test('pizarra: trazos, deshacer el propio y hoja nueva del DM', () => {
  const { R, room, dm, a, b } = mesa();
  const st = { color: '#aa2233', w: 6, pts: [0.1, 0.1, 0.2, 0.25, 0.3, 0.3] };
  R.act(room, a.id, { t: 'draw.add', stroke: st }); R.act(room, b.id, { t: 'draw.add', stroke: st }); R.act(room, a.id, { t: 'draw.add', stroke: st });
  assert.equal(room.strokes.length, 3);
  const n = R.act(room, a.id, { t: 'draw.undo' });
  assert.equal(room.strokes.length, 2); assert.equal(n[0].msg.t, 'draw.undo'); assert.equal(room.strokes[1].by, b.id);
  assert.throws(() => R.act(room, a.id, { t: 'draw.add', stroke: { pts: [5, 5, 6, 6] } }), /trazo/);
  assert.throws(() => R.act(room, a.id, { t: 'draw.clear' }), /Solo el DM/);
  R.act(room, dm.id, { t: 'draw.clear' }); assert.equal(room.strokes.length, 0); assert.equal(room.pages.length, 1);
});

test('terminar la sesión manda a cada quien su resumen; reabrir con copia local', () => {
  const { R, room, dm, a, b } = mesa();
  R.act(room, dm.id, { t: 'session.title', title: 'La cripta de Vel' });
  R.act(room, a.id, { t: 'chat.send', text: 'hola' }); R.act(room, a.id, { t: 'chat.send', text: 'secreto', to: dm.id });
  R.act(room, b.id, { t: 'draw.add', stroke: { color: '#112233', w: 4, pts: [0, 0, 1, 1] } });
  const n = R.act(room, dm.id, { t: 'session.end' });
  const forB = n.find((x) => x.to === b.id).msg.snapshot;
  assert.equal(forB.title, 'La cripta de Vel'); assert.equal(forB.chat.length, 1, 'Bram no ve el susurro'); assert.equal(forB.pages.length, 1);
  // el servidor se reinicia: el DM reabre con su copia
  const R2 = new Rooms();
  const snapDm = n.find((x) => x.to === dm.id).msg.snapshot;
  const re = R2.create('DM', null, true, { ...snapDm, code: room.code });
  assert.equal(re.restored, true); assert.equal(re.room.code, room.code); assert.equal(re.room.chat.length, 2); assert.equal(re.room.session.title, 'La cripta de Vel');
  const again = R2.create('DM', null, true, { code: room.code }); assert.notEqual(again.room.code, room.code, 'si el código ya existe, se usa otro');
});

test('imágenes por HTTP: subir con token y leer por id', async () => {
  const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: {} });
  try {
    const { room, member } = srv.rooms.create('DM', null, true);
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4ac0000000049454e44ae426082', 'hex');
    const base = `http://127.0.0.1:${srv.port}/api/img`;
    const bad = await fetch(`${base}?code=${room.code}&token=nope`, { method: 'POST', headers: { 'content-type': 'image/png' }, body: png });
    assert.equal(bad.status, 403);
    const up = await fetch(`${base}?code=${room.code}&token=${member.token}`, { method: 'POST', headers: { 'content-type': 'image/png' }, body: png });
    const { id } = await up.json(); assert.match(id, /^i/);
    const got = await fetch(`${base}/${room.code}/${id}`); assert.equal(got.status, 200); assert.equal(got.headers.get('content-type'), 'image/png');
    assert.equal(Buffer.from(await got.arrayBuffer()).length, png.length);
    const txt = await fetch(`${base}?code=${room.code}&token=${member.token}`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x' });
    assert.equal(txt.status, 400);
  } finally { await srv.close(); }
});
