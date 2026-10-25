import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { startServer } from '../../server/index.mjs';

function client(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`), inbox = [], waiters = [];
  ws.on('message', (d) => { const m = JSON.parse(d); inbox.push(m); waiters.splice(0).forEach(w => w()); });
  const next = (t, pred = () => true) => new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('timeout esperando ' + t)), 3000);
    const check = () => { const i = inbox.findIndex(m => m.t === t && pred(m)); if (i >= 0) { clearTimeout(to); res(inbox.splice(i, 1)[0]); } else waiters.push(check); };
    check();
  });
  return { ws, next, send: (m) => ws.send(JSON.stringify(m)), open: new Promise(r => ws.on('open', r)) };
}

test('partida por WebSocket: DM, dos jugadores, iniciativa, daño y reconexión', async () => {
  const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true });
  try {
    const dm = client(srv.port); await dm.open;
    dm.send({ t: 'create', name: 'DM', dm: true });
    const j = await dm.next('joined'); assert.equal(j.role, 'dm');
    const a = client(srv.port), b = client(srv.port); await Promise.all([a.open, b.open]);
    a.send({ t: 'join', code: j.code, name: 'Lyra', char: { name: 'Lyra', hp: 30, hpMax: 30, ac: 18, initMod: 2 } });
    b.send({ t: 'join', code: j.code, name: 'Bram', char: { name: 'Bram', hp: 22, hpMax: 22, ac: 15, initMod: 3 } });
    const ja = await a.next('joined'); await b.next('joined');
    a.send({ t: 'init', value: 17 }); b.send({ t: 'init', value: 9 });
    dm.send({ t: 'npc.add', name: 'Goblin', ac: 15, hp: 7, init: 12 });
    const s = await dm.next('state', m => m.room.order.length === 3);
    assert.deepEqual(s.room.order.map(id => (s.room.members.find(x => x.id === id) || s.room.npcs.find(x => x.id === id)).char?.name || s.room.npcs.find(x => x.id === id).name), ['Lyra', 'Goblin', 'Bram']);
    dm.send({ t: 'turn', dir: 'start' });
    await a.next('yourturn');
    // Bram cura a Lyra; Lyra recibe el aviso para aplicarlo en su hoja
    b.send({ t: 'apply', kind: 'heal', amount: 5, targets: [ja.you], note: 'Healing Word' });
    const ap = await a.next('applied'); assert.equal(ap.kind, 'heal'); assert.equal(ap.from, 'Bram'); assert.equal(ap.note, 'Healing Word');
    // un jugador no puede pasar el turno de otro
    b.send({ t: 'turn', dir: 'next' });
    const e = await b.next('error'); assert.equal(e.code, 'not_your_turn');
    // Lyra pierde la señal y vuelve con su token
    a.ws.close(); await dm.next('state', m => m.room.members.some(x => x.id === ja.you && !x.online));
    const a2 = client(srv.port); await a2.open;
    a2.send({ t: 'join', code: j.code, token: ja.token, name: 'Lyra', char: { name: 'Lyra', hp: 12, hpMax: 30, ac: 18 } });
    const back = await a2.next('joined'); assert.ok(back.rejoined); assert.equal(back.you, ja.you);
    const view = await dm.next('state', m => m.room.members.find(x => x.id === ja.you)?.online && m.room.members.find(x => x.id === ja.you).char.hp === 12);
    assert.equal(view.room.members.find(x => x.id === ja.you).char.hp, 12);
    // la web se sirve desde el mismo servidor
    const res = await fetch(`http://127.0.0.1:${srv.port}/health`); assert.equal((await res.json()).ok, true);
    [dm, b, a2].forEach(c => c.ws.close());
  } finally { await srv.close(); }
});
