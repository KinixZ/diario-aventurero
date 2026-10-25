// Servidor del Diario del Aventurero: sirve la web (web/dist) y las salas de combate por WebSocket en /ws.
// Uso: npm run build && npm start   (PORT=8080 por defecto)

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Rooms } from './rooms.mjs';
import { createTranslator } from './translate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const DIST = normalize(join(here, '..', 'web', 'dist'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
const MAX_MSG = 512 * 1024; // alcanza para reabrir una mesa con su chat y su pizarra

export function startServer({ port = Number(process.env.PORT) || 8080, host = process.env.HOST || '0.0.0.0', quiet = false, env = process.env } = {}) {
  const rooms = new Rooms();
  const tr = createTranslator(env);
  const trHits = new Map(); // ip → [inicio de ventana, cuántas]
  const sockets = new Map(); // memberId → ws

  const http = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, rooms: rooms.rooms.size, translate: tr.status().enabled })); return; }
    if (url.pathname === '/api/translate') { await handleTranslate(req, res); return; }
    if (url.pathname.startsWith('/api/img')) { await handleImage(req, res, url); return; }
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
  /* Imágenes de la mesa: el DM (o cualquiera) sube una y el chat solo lleva su id */
  async function handleImage(req, res, url) {
    if (req.method === 'POST') {
      const room = rooms.get(String(url.searchParams.get('code') || '').toUpperCase()), token = url.searchParams.get('token') || '';
      const me = room && [...room.members.values()].find((m) => m.token === token);
      if (!room || !me) { json(res, 403, { code: 'no_room', msg: 'No estás en esa sala.' }); return; }
      const chunks = []; let size = 0;
      for await (const c of req) { size += c.length; if (size > 1700 * 1024) { json(res, 413, { code: 'too_large', msg: 'La imagen es demasiado grande.' }); return; } chunks.push(c); }
      try { const im = rooms.addImage(room, me.id, Buffer.concat(chunks), String(req.headers['content-type'] || '').split(';')[0]); json(res, 200, { id: im.id }); }
      catch (e) { json(res, 400, { code: e.code || 'error', msg: e.message }); }
      return;
    }
    const m = /^\/api\/img\/([A-Z]{4})\/(i[\w-]+)$/.exec(url.pathname);
    const im = m && rooms.get(m[1]) && rooms.get(m[1]).images.get(m[2]);
    if (!im) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('Esa imagen ya no está en el servidor.'); return; }
    res.writeHead(200, { 'content-type': im.type, 'cache-control': 'private, max-age=86400' }); res.end(im.data);
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
  function broadcast(room) {
    for (const m of room.members.values()) { const ws = sockets.get(m.id); if (ws) send(ws, { t: 'state', room: rooms.view(room, m.id) }); }
  }

  wss.on('connection', (ws) => {
    ws.alive = true; ws.on('pong', () => { ws.alive = true; });
    let room = null, me = null, count = 0, windowStart = Date.now();
    ws.on('message', (raw) => {
      // límite sencillo: 30 mensajes cada 5 segundos
      if (Date.now() - windowStart > 5000) { windowStart = Date.now(); count = 0; }
      if (++count > 80) { send(ws, { t: 'error', code: 'rate', msg: 'Vas muy rápido; espera un momento.' }); return; }
      let msg; try { msg = JSON.parse(raw); } catch { return; }
      try {
        if (msg.t === 'create' || msg.t === 'join') {
          if (room && me) { rooms.leave(room, me.id, false); sockets.delete(me.id); broadcast(room); }
          const r = msg.t === 'create' ? rooms.create(msg.name, msg.char, !!msg.dm, msg.restore) : rooms.join(msg.code, msg.name, msg.char, msg.token, !!msg.dm);
          room = r.room; me = r.member;
          const old = sockets.get(me.id); if (old && old !== ws) old.close(4000, 'otra conexión');
          sockets.set(me.id, ws);
          send(ws, { t: 'joined', code: room.code, you: me.id, token: me.token, role: me.role, rejoined: !!r.rejoined, restored: !!r.restored });
          send(ws, rooms.mesaInit(room, me.id));
          broadcast(room); return;
        }
        if (!room || !me) { send(ws, { t: 'error', code: 'no_room', msg: 'Primero entra a una sala.' }); return; }
        if (msg.t === 'leave') { rooms.leave(room, me.id, true); sockets.delete(me.id); broadcast(room); room = null; me = null; return; }
        if (msg.t === 'ping') { send(ws, { t: 'pong' }); return; }
        const notes = rooms.act(room, me.id, msg);
        for (const n of notes) send(sockets.get(n.to), n.msg);
        if (!notes.quiet) broadcast(room);
      } catch (e) {
        send(ws, { t: 'error', code: e.code || 'error', msg: e.code ? e.message : 'Algo salió mal en el servidor.' });
        if (!e.code && !quiet) console.error(e);
      }
    });
    ws.on('close', () => { if (room && me && sockets.get(me.id) === ws) { sockets.delete(me.id); rooms.leave(room, me.id, false); broadcast(room); } });
  });

  // mantener vivas las conexiones de teléfono y limpiar salas viejas
  const beat = setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); } rooms.sweep(); }, 30000);
  wss.on('close', () => clearInterval(beat));

  return new Promise((resolve) => http.listen(port, host, () => {
    const addr = http.address();
    if (!quiet) console.log(`Diario del Aventurero en http://localhost:${addr.port}  (salas en ws://localhost:${addr.port}/ws)`);
    resolve({ http, wss, rooms, port: addr.port, close: () => new Promise(r => { clearInterval(beat); for (const c of wss.clients) c.terminate(); wss.close(); http.close(() => r()); }) });
  }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) startServer();
