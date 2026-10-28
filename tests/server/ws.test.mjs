import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../../server/index.mjs';
import { fileStore } from '../../server/store.mjs';
import { client } from './helpers.mjs';

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4ac0000000049454e44ae426082', 'hex');

test('partida por WebSocket: crear campaña, DM en dos aparatos, jugadores, combate y reconexión', async () => {
  const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: {} });
  try {
    const dm = client(srv.port); await dm.open;
    dm.send({ t: 'camp.create', name: 'Phandelver', dmKey: 'dragon' });
    const j = await dm.next('joined'); assert.equal(j.role, 'dm'); assert.equal(j.created, true); assert.equal(j.code.length, 6); assert.equal(j.durable, false);
    // el DM también abre la campaña en su tablet con la clave
    const tab = client(srv.port); await tab.open;
    tab.send({ t: 'join', code: j.code, dmKey: 'mala' }); assert.equal((await tab.next('error')).code, 'bad_key');
    tab.send({ t: 'join', code: j.code, dmKey: 'dragon' }); const jt = await tab.next('joined'); assert.equal(jt.you, j.you); assert.equal(jt.token, j.token);
    const a = client(srv.port), b = client(srv.port); await Promise.all([a.open, b.open]);
    a.send({ t: 'join', code: j.code.toLowerCase(), name: 'Lyra', char: { name: 'Lyra', hp: 30, hpMax: 30, ac: 18, initMod: 2 } });
    b.send({ t: 'join', code: j.code, name: 'Bram', char: { name: 'Bram', hp: 22, hpMax: 22, ac: 15, initMod: 3 } });
    const ja = await a.next('joined'); await b.next('joined');
    dm.send({ t: 'session.start', title: 'Las minas' });
    await a.next('live'); await tab.next('live');
    a.send({ t: 'init', value: 17 }); b.send({ t: 'init', value: 9 });
    dm.send({ t: 'npc.add', name: 'Goblin', ac: 15, hp: 7, init: 12 });
    const s = await tab.next('state', m => m.room.order.length === 3);
    assert.equal(s.room.live, true); assert.equal(s.room.name, 'Phandelver');
    tab.send({ t: 'turn', dir: 'start' }); // desde la tablet también manda
    await a.next('yourturn');
    b.send({ t: 'apply', kind: 'heal', amount: 5, targets: [ja.you], note: 'Healing Word' });
    const ap = await a.next('applied'); assert.equal(ap.from, 'Bram');
    b.send({ t: 'turn', dir: 'next' }); assert.equal((await b.next('error')).code, 'not_your_turn');
    // Lyra pierde la señal y vuelve con su token
    a.ws.close(); await dm.next('state', m => m.room.members.some(x => x.id === ja.you && !x.online));
    const a2 = client(srv.port); await a2.open;
    a2.send({ t: 'join', code: j.code, token: ja.token, name: 'Lyra', char: { name: 'Lyra', hp: 12, hpMax: 30, ac: 18 } });
    const back = await a2.next('joined'); assert.ok(back.rejoined); assert.equal(back.you, ja.you);
    await dm.next('state', m => m.room.members.find(x => x.id === ja.you)?.online && m.room.members.find(x => x.id === ja.you).char.hp === 12);
    // el selector ve el estado sin entrar
    const peek = await (await fetch(`http://127.0.0.1:${srv.port}/api/camp?codes=${j.code},QQQQQQ`)).json();
    assert.equal(peek.campaigns[0].live, true); assert.equal(peek.campaigns[0].name, 'Phandelver'); assert.equal(peek.campaigns[1].missing, true);
    // el DM quita a Bram: su conexión se cierra
    const closed = new Promise((r) => b.ws.on('close', r));
    dm.send({ t: 'member.del', id: s.room.members.find((m) => m.char && m.char.name === 'Bram').id });
    await b.next('kicked'); await closed;
    [dm, tab, a2].forEach(c => c.ws.close());
  } finally { await srv.close(); }
});

test('guardado en archivos: la campaña y sus imágenes sobreviven a un reinicio del servidor', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'diario-'));
  try {
    let srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: { DATA_DIR: dir } });
    const dm = client(srv.port); await dm.open;
    dm.send({ t: 'camp.create', name: 'Strahd', dmKey: 'barovia' });
    const j = await dm.next('joined'); assert.equal(j.durable, true);
    dm.send({ t: 'chat.send', text: 'Niebla en el camino' }); await dm.next('chat');
    const base = `http://127.0.0.1:${srv.port}/api/img`;
    assert.equal((await fetch(`${base}?code=${j.code}&token=nope`, { method: 'POST', headers: { 'content-type': 'image/png' }, body: PNG })).status, 403);
    const up = await fetch(`${base}?code=${j.code}&token=${j.token}`, { method: 'POST', headers: { 'content-type': 'image/png' }, body: PNG });
    const { id } = await up.json(); assert.match(id, /^i/);
    assert.equal((await fetch(`${base}?code=${j.code}&token=${j.token}`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x' })).status, 400);
    dm.ws.close(); await srv.close();
    // servidor nuevo, misma carpeta
    srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: { DATA_DIR: dir } });
    const got = await fetch(`http://127.0.0.1:${srv.port}/api/img/${j.code}/${id}`); assert.equal(got.status, 200); assert.equal(got.headers.get('content-type'), 'image/png');
    const dm2 = client(srv.port); await dm2.open;
    dm2.send({ t: 'join', code: j.code, token: j.token });
    const back = await dm2.next('joined'); assert.equal(back.role, 'dm'); assert.equal(back.name, 'Strahd');
    const init = await dm2.next('mesa.init'); assert.equal(init.chat[0].text, 'Niebla en el camino');
    dm2.ws.close(); await srv.close();
    assert.deepEqual(await fileStore(dir).list(), [j.code]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('si la base de datos falla, el servidor sigue en memoria y lo avisa', async () => {
  const broken = { kind: 'postgres', durable: true, async init() { throw new Error('sin red'); } };
  const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: {}, store: broken });
  try {
    const h = await (await fetch(`http://127.0.0.1:${srv.port}/health`)).json();
    assert.equal(h.store, 'memoria'); assert.equal(h.durable, false); assert.match(h.storeError, /sin red/);
  } finally { await srv.close(); }
});
