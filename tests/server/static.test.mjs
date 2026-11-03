import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { startServer } from '../../server/index.mjs';

const built = existsSync(new URL('../../web/dist/index.html', import.meta.url));

test('la web viaja comprimida y el motor del mapa se guarda en caché por versión', { skip: !built && 'falta npm run build' }, async () => {
  const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: {} });
  try {
    const base = 'http://127.0.0.1:' + srv.port;
    const plain = await fetch(base + '/', { headers: { 'accept-encoding': 'identity' } });
    const html = await plain.text();
    assert.equal(plain.headers.get('content-encoding'), null);
    assert.match(html, /DIARIO_CONFIG/);
    // fetch de Node descomprime solo; se pide con http para ver los bytes comprimidos
    const http = await import('node:http');
    const get = (u, enc) => new Promise((res, rej) => http.get(base + u, { headers: { 'accept-encoding': enc } }, (r) => { const ch = []; r.on('data', (c) => ch.push(c)); r.on('end', () => res({ h: r.headers, buf: Buffer.concat(ch) })); }).on('error', rej));
    const br = await get('/', 'gzip, deflate, br');
    assert.equal(br.h['content-encoding'], 'br');
    assert.equal(brotliDecompressSync(br.buf).toString(), html);
    assert.ok(br.buf.length < html.length / 2, 'brotli reduce a menos de la mitad');
    assert.equal(br.h['cache-control'], 'no-cache');
    const gz = await get('/mapa-gl.js?v=abc', 'gzip');
    assert.equal(gz.h['content-encoding'], 'gzip');
    assert.match(gz.h['cache-control'], /immutable/);
    assert.match(gunzipSync(gz.buf).toString(), /MapaGL/);
    const again = await get('/', 'br'); // segunda vez sale del caché del servidor, igual
    assert.deepEqual(again.buf, br.buf);
  } finally { await srv.close(); }
});
