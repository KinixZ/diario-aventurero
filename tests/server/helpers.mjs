import { Campaigns } from '../../server/campaigns.mjs';
import { memoryStore } from '../../server/store.mjs';
import { WebSocket } from 'ws';

export const pc = (name, hp = 30, initMod = 2) => ({ name, cls: 'Paladin 5', lvl: 5, ac: 18, hp, hpMax: hp, temp: 0, initMod, conds: [] });

/* Una campaña con DM y dos jugadores, lista para probar acciones */
export async function mesa(opts = {}) {
  const store = opts.store || memoryStore(); await store.init();
  const R = new Campaigns(store, opts.now);
  const { c, member: dm } = await R.create({ name: 'La Costa de la Espada', dmKey: 'dragon' });
  const a = R.join(c, { name: 'Lyra', char: pc('Lyra') }).member, b = R.join(c, { name: 'Bram', char: pc('Bram', 30, 4) }).member;
  return { R, c, room: c, dm, a, b, store };
}

export function client(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`), inbox = [], waiters = [];
  ws.on('message', (d) => { const m = JSON.parse(d); inbox.push(m); waiters.splice(0).forEach(w => w()); });
  const next = (t, pred = () => true) => new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('timeout esperando ' + t)), 3000);
    const check = () => { const i = inbox.findIndex(m => m.t === t && pred(m)); if (i >= 0) { clearTimeout(to); res(inbox.splice(i, 1)[0]); } else waiters.push(check); };
    check();
  });
  return { ws, next, inbox, send: (m) => ws.send(JSON.stringify(m)), open: new Promise(r => ws.on('open', r)) };
}
