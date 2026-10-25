import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTranslator } from '../../server/translate.mjs';
import { startServer } from '../../server/index.mjs';

test('sin clave no hay traductor', async () => {
  const t = createTranslator({});
  assert.equal(t.status().enabled, false);
  await assert.rejects(t.translate('<p>Hi</p>'), (e) => e.code === 'no_engine');
});

test('caché compartida y tope diario', async () => {
  const t = createTranslator({ TR_PROVIDER: 'mock', TR_DAILY_CHARS: '30' });
  const a = await t.translate('<p>Fireball</p>');
  assert.equal(a.cached, false); assert.match(a.html, /ES/);
  const b = await t.translate('<p>Fireball</p>');
  assert.equal(b.cached, true); assert.equal(b.html, a.html);
  await assert.rejects(t.translate('<p>' + 'x'.repeat(40) + '</p>'), (e) => e.code === 'rate_limited');
});

test('endpoint /api/translate', async () => {
  const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: { TR_PROVIDER: 'mock' } });
  try {
    const base = `http://127.0.0.1:${srv.port}/api/translate`;
    assert.deepEqual((await (await fetch(base)).json()).enabled, true);
    const r = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ html: '<p>Bless</p>' }) });
    assert.equal(r.status, 200); assert.match((await r.json()).html, /Bless/);
    const bad = await fetch(base, { method: 'POST', body: JSON.stringify({ html: '' }) });
    assert.equal(bad.status, 400);
  } finally { await srv.close(); }
  const off = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: {} });
  try { assert.equal((await (await fetch(`http://127.0.0.1:${off.port}/api/translate`)).json()).enabled, false); } finally { await off.close(); }
});

test('Gemini: arma la petición, reintenta una vez y limpia la respuesta', async () => {
  const calls = []; const real = globalThis.fetch;
  globalThis.fetch = async (url, opt) => {
    calls.push({ url, opt });
    if (calls.length === 1) return new Response('{}', { status: 429 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '```html\n<p>Bola de fuego (Fireball)</p>\n```' }] } }] }), { status: 200 });
  };
  const orig = globalThis.setTimeout; globalThis.setTimeout = (f) => orig(f, 0);
  try {
    const t = createTranslator({ GEMINI_API_KEY: 'k', TR_MODEL: 'gemini-x' });
    assert.equal(t.provider, 'gemini');
    const out = await t.translate('<p>Fireball</p>');
    assert.equal(out.html, '<p>Bola de fuego (Fireball)</p>');
    assert.equal(calls.length, 2);
    assert.match(calls[1].url, /models\/gemini-x:generateContent$/);
    assert.equal(calls[1].opt.headers['x-goog-api-key'], 'k');
    assert.match(JSON.parse(calls[1].opt.body).systemInstruction.parts[0].text, /tirada de salvación/);
  } finally { globalThis.fetch = real; globalThis.setTimeout = orig; }
});

test('Gemini: si un modelo no existe prueba el siguiente', async () => {
  const seen = []; const real = globalThis.fetch;
  globalThis.fetch = async (url) => { seen.push(url.match(/models\/([^:]+)/)[1]); return seen.length === 1 ? new Response('not found', { status: 404 }) : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '<p>ok</p>' }] } }] }), { status: 200 }); };
  const warn = console.warn; console.warn = () => {};
  try { const t = createTranslator({ GEMINI_API_KEY: 'k' }); assert.equal((await t.translate('<p>x</p>')).html, '<p>ok</p>'); assert.deepEqual(seen, ['gemini-flash-latest', 'gemini-flash-lite-latest']); }
  finally { globalThis.fetch = real; console.warn = warn; }
});
