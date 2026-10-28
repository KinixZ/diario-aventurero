// Servidor del Diario del Aventurero: sirve la web (web/dist), las campañas por WebSocket en /ws y las imágenes.
// Uso: npm run build && npm start   (PORT=8080 por defecto)
// Guardado: DATABASE_URL (Postgres/Neon) o DATA_DIR (carpeta). Sin ninguna, todo vive en memoria.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Campaigns, cleanCode, CODE_LEN, IMG_MAX_BYTES } from './campaigns.mjs';
import { createStore, memoryStore } from './store.mjs';
import { createTranslator } from './translate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const DIST = normalize(join(here, '..', 'web', 'dist'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
const MAX_MSG = 2 * 1024 * 1024; // alcanza para subir un mapa grande con sus trazos
const SAVE_EVERY = 4000, SWEEP_EVERY = 60000;

export async function startServer({ port = Number(process.env.PORT) || 8080, host = process.env.HOST || '0.0.0.0', quiet = false, env = process.env, store = null } = {}) {
  let storeError = '';
  store = store || createStore(env);
  try { await store.init(); }
  catch (e) {
    storeError = 'No pude conectar con la base de datos: ' + (e.message || e) + '. Las campañas se guardan solo en memoria hasta que se arregle.';
    if (!quiet) console.error(storeError);
    store = memoryStore(); await store.init();
  }
  if (!quiet && !store.durable) console.warn('Aviso: sin DATABASE_URL ni DATA_DIR, las campañas se borran al reiniciar el servidor.');
  const camps = new Campaigns(store);
  const tr = createTranslator(env);
  const trHits = new Map(); // ip → [inicio de ventana, cuántas]
  const sockets = new Map(); // "CODIGO:miembro" → Set de ws
  const imgCache = new Map(); // "CODIGO/id" → {type, data}
  const key = (c, mid) => c.code + ':' + mid;

  const http = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      if (url.pathname === '/health') { json(res, 200, { ok: true, campaigns: camps.loaded.size, store: store.kind, durable: store.durable, storeError: storeError || undefined, translate: tr.status().enabled }); return; }
      if (url.pathname === '/api/translate') { await handleTranslate(req, res); return; }
      if (url.pathname === '/api/camp') { await handlePeek(res, url); return; }
      if (url.pathname.startsWith('/api/img')) { await handleImage(req, res, url); return; }
    } catch (e) { if (!quiet) console.error(e); json(res, 500, { code: 'error', msg: 'Algo salió mal en el servidor.' }); return; }
    let p = decodeURIComponent(url.pathname); if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(DIST, p));
    if (!file.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
    try {
      const s = await stat(file); if (!s.isFile()) throw new Error('dir');
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': /\.(html|webmanifest)$|sw\.js$/.test(file) ? 'no-cache' : 'public, max-age=3600' });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('No existe. ¿Corriste npm run build?');
    }
  });

  function json(res, code, obj) { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); }

  /* Estado de varias campañas para el selector (nombre, si está en sesión, cuántos conectados) */
  async function handlePeek(res, url) {
    const codes = String(url.searchParams.get('codes') || '').split(',').map(cleanCode).filter((c) => c.length === CODE_LEN).slice(0, 20);
    const out = [];
    for (const code of codes) { try { out.push(camps.peek(await camps.open(code))); } catch (e) { out.push({ code, missing: e.code === 'no_room' }); } }
    json(res, 200, { campaigns: out, durable: store.durable });
  }

  /* Imágenes de la campaña: se suben por HTTP y el chat, el tablero o el mapa solo llevan su id */
  async function handleImage(req, res, url) {
    if (req.method === 'POST') {
      let c = null; try { c = await camps.open(url.searchParams.get('code')); } catch {}
      const token = url.searchParams.get('token') || '';
      const me = c && [...c.members.values()].find((m) => m.token === token);
      if (!c || !me) { json(res, 403, { code: 'no_room', msg: 'No estás en esa campaña.' }); return; }
      const type = String(req.headers['content-type'] || '').split(';')[0];
      const chunks = []; let size = 0;
      for await (const ch of req) { size += ch.length; if (size > IMG_MAX_BYTES + 1024) { json(res, 413, { code: 'too_large', msg: 'La imagen es demasiado grande.' }); return; } chunks.push(ch); }
      try {
        camps.checkImage(c, me.id, size, type);
        const im = camps.noteImage(c, me.id, size, type), data = Buffer.concat(chunks);
        await store.putImage(c.code, im.id, type, data);
        imgCache.set(c.code + '/' + im.id, { type, data });
        json(res, 200, { id: im.id });
      } catch (e) { json(res, 400, { code: e.code || 'error', msg: e.code ? e.message : 'No se pudo guardar la imagen.' }); }
      return;
    }
    const m = /^\/api\/img\/([A-Z]{4,8})\/(i[\w-]+)$/.exec(url.pathname);
    const ck = m && m[1] + '/' + m[2];
    let im = ck && imgCache.get(ck);
    if (!im && ck) { im = await store.getImage(m[1], m[2]); if (im) { imgCache.set(ck, im); if (imgCache.size > 60) imgCache.delete(imgCache.keys().next().value); } }
    if (!im) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('Esa imagen ya no está en el servidor.'); return; }
    res.writeHead(200, { 'content-type': im.type, 'cache-control': 'private, max-age=604800, immutable' }); res.end(im.data);
  }

  async function handleTranslate(req, res) {
    if (req.method === 'GET') { json(res, 200, tr.status()); return; }
    if (req.method !== 'POST') { json(res, 405, { code: 'bad_request' }); return; }
    // 40 traducciones nuevas por minuto por dirección; lo que ya está en caché responde igual
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const now = Date.now(), h = trHits.get(ip) || [now, 0];
    if (now - h[0] > 60000) { h[0] = now; h[1] = 0; }
    if (++h[1] > 40) { trHits.set(ip, h); json(res, 429, { code: 'rate_limited', msg: 'Demasiadas traducciones seguidas.' }); return; }
    trHits.set(ip, h); if (trHits.size > 5000) trHits.clear();
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 60000) { json(res, 413, { code: 'too_large' }); return; } }
    try {
      const { html } = JSON.parse(body || '{}');
      const out = await tr.translate(html);
      json(res, 200, out);
    } catch (e) {
      const code = e.code || 'error';
      json(res, code === 'rate_limited' ? 429 : code === 'no_engine' ? 503 : code === 'bad_request' || code === 'too_large' ? 400 : 502, { code, msg: e.code ? e.message : 'No se pudo traducir.' });
      if (!e.code && !quiet) console.error(e);
    }
  }

  const wss = new WebSocketServer({ server: http, path: '/ws', maxPayload: MAX_MSG });

  function send(ws, msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }
  function sendTo(c, mid, msg) { const set = sockets.get(key(c, mid)); if (set) for (const ws of set) send(ws, msg); }
  function broadcast(c) { for (const m of c.members.values()) { const set = sockets.get(key(c, m.id)); if (set && set.size) { const v = { t: 'state', room: camps.view(c, m.id) }; for (const ws of set) send(ws, v); } } }
  function attach(ws, c, m) { const k = key(c, m.id); if (!sockets.has(k)) sockets.set(k, new Set()); sockets.get(k).add(ws); camps.connect(c, m.id); }
  function detach(ws, c, m) { const k = key(c, m.id), set = sockets.get(k); if (set && set.delete(ws)) { camps.disconnect(c, m.id); if (!set.size) sockets.delete(k); } }

  wss.on('connection', (ws) => {
    ws.alive = true; ws.on('pong', () => { ws.alive = true; });
    let c = null, me = null, count = 0, windowStart = Date.now(), chain = Promise.resolve();
    const welcome = (r, created) => {
      send(ws, { t: 'joined', code: c.code, name: c.name, you: me.id, token: me.token, role: me.role, rejoined: !!r.rejoined, created: !!created, durable: store.durable });
      send(ws, camps.mesaInit(c, me.id));
      broadcast(c);
    };
    async function handle(raw) {
      let msg; try { msg = JSON.parse(raw); } catch { return; }
      try {
        if (msg.t === 'camp.create' || msg.t === 'join') {
          if (c && me) { const oc = c; detach(ws, c, me); c = null; me = null; broadcast(oc); }
          if (msg.t === 'camp.create') { const r = await camps.create({ name: msg.name, dmKey: msg.dmKey }); c = r.c; me = r.member; attach(ws, c, me); welcome(r, true); return; }
          const cc = await camps.open(msg.code), r = camps.join(cc, { name: msg.name, char: msg.char, token: msg.token, dmKey: msg.dmKey });
          c = cc; me = r.member; attach(ws, c, me); welcome(r, false); return;
        }
        if (msg.t === 'ping') { send(ws, { t: 'pong' }); return; }
        if (!c || !me) { send(ws, { t: 'error', code: 'no_room', msg: 'Primero entra a una campaña.' }); return; }
        if (!c.members.has(me.id)) { send(ws, { t: 'error', code: 'not_member', msg: 'Ya no estás en esta campaña.' }); return; }
        if (msg.t === 'leave') {
          const oc = c; detach(ws, c, me);
          if (msg.forget && me.role !== 'dm') { oc.members.delete(me.id); oc.order = oc.order.filter((x) => x !== me.id); camps.log(oc, `${me.char ? me.char.name : me.name} dejó la campaña`); oc.dirty = true; }
          c = null; me = null; broadcast(oc); return;
        }
        const notes = camps.act(c, me.id, msg);
        for (const n of notes) sendTo(c, n.to, n.msg);
        if (notes.kicked) { const set = sockets.get(key(c, notes.kicked)); if (set) for (const w of [...set]) w.close(4001, 'quitado'); sockets.delete(key(c, notes.kicked)); }
        if (!notes.quiet) broadcast(c);
      } catch (e) {
        send(ws, { t: 'error', code: e.code || 'error', msg: e.code ? e.message : 'Algo salió mal en el servidor.', on: msg.t });
        if (!e.code && !quiet) console.error(e);
      }
    }
    ws.on('message', (raw) => {
      // límite sencillo: 80 mensajes cada 5 segundos
      if (Date.now() - windowStart > 5000) { windowStart = Date.now(); count = 0; }
      if (++count > 80) { send(ws, { t: 'error', code: 'rate', msg: 'Vas muy rápido; espera un momento.' }); return; }
      chain = chain.then(() => handle(raw)); // en orden, aunque cargar una campaña tarde
    });
    ws.on('close', () => { chain = chain.then(() => { if (c && me) { const oc = c; detach(ws, c, me); c = null; me = null; broadcast(oc); } }); });
  });

  // guardar lo pendiente cada pocos segundos; mantener vivas las conexiones de teléfono; descargar campañas sin nadie
  let saving = false;
  const saver = setInterval(async () => { if (saving) return; saving = true; try { await camps.flushAll(); } finally { saving = false; } }, SAVE_EVERY);
  const sweeper = setInterval(() => { camps.sweep().catch(() => {}); }, SWEEP_EVERY);
  const beat = setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); } }, 30000);
  const stopTimers = () => { clearInterval(saver); clearInterval(sweeper); clearInterval(beat); };
  wss.on('close', stopTimers);

  return new Promise((resolve) => http.listen(port, host, () => {
    const addr = http.address();
    if (!quiet) console.log(`Diario del Aventurero en http://localhost:${addr.port}  (campañas en ws://localhost:${addr.port}/ws · guardado: ${store.kind})`);
    resolve({ http, wss, camps, store, port: addr.port,
      close: async () => { stopTimers(); for (const ws of wss.clients) ws.terminate(); wss.close(); await camps.flushAll(); await new Promise((r) => http.close(() => r())); await store.close(); } });
  }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const srv = await startServer();
  // Render avisa con SIGTERM antes de dormir o reiniciar: guardamos todo antes de salir
  const bye = async () => { try { await srv.camps.flushAll(); await srv.store.close(); } finally { process.exit(0); } };
  process.on('SIGTERM', bye); process.on('SIGINT', bye);
}
