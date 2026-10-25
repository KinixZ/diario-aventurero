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
  try {
    const t = createTranslator({ GEMINI_API_KEY: 'k', TR_MODEL: 'gemini-x', TR_RETRY_MS: '0' });
    assert.equal(t.provider, 'gemini');
    const out = await t.translate('<p>Fireball</p>');
    assert.equal(out.html, '<p>Bola de fuego (Fireball)</p>');
    assert.equal(calls.length, 2);
    assert.match(calls[1].url, /models\/gemini-x:generateContent$/);
    assert.equal(calls[1].opt.headers['x-goog-api-key'], 'k');
    assert.match(JSON.parse(calls[1].opt.body).systemInstruction.parts[0].text, /tirada de salvación/);
  } finally { globalThis.fetch = real; }
});

test('Gemini: si un modelo no existe prueba el siguiente', async () => {
  const seen = []; const real = globalThis.fetch;
  globalThis.fetch = async (url) => { seen.push(url.match(/models\/([^:]+)/)[1]); return seen.length === 1 ? new Response('not found', { status: 404 }) : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '<p>ok</p>' }] } }] }), { status: 200 }); };
  const warn = console.warn; console.warn = () => {};
  try { const t = createTranslator({ GEMINI_API_KEY: 'k' }); assert.equal((await t.translate('<p>x</p>')).html, '<p>ok</p>'); assert.deepEqual(seen, ['gemini-flash-latest', 'gemini-flash-lite-latest']); }
  finally { globalThis.fetch = real; console.warn = warn; }
});

test('Cloudflare m2m100: bloque por bloque, pies a metros y glosario', async () => {
  const sent = []; const real = globalThis.fetch;
  globalThis.fetch = async (url, opt) => { const b = JSON.parse(opt.body); sent.push(b.text); return new Response(JSON.stringify({ result: { translated_text: b.text.includes('meters') ? 'Cada criatura a 6 metros hace un tiro de salvación de Destreza.' : 'Un hechizo de acción de bonificación.' } }), { status: 200 }); };
  const warn = console.warn; console.warn = () => {};
  try {
    const t = createTranslator({ CLOUDFLARE_ACCOUNT_ID: 'a', CLOUDFLARE_API_TOKEN: 't' });
    assert.equal(t.provider, 'cloudflare');
    const out = await t.translate('<p>Each creature within 20 feet makes a <a class="ref" data-ref="x">Dexterity saving throw</a>.</p><ul><li>A bonus action spell.</li></ul>');
    assert.deepEqual(sent, ['Each creature within 6 meters makes a Dexterity saving throw.', 'A bonus action spell.']);
    assert.equal(out.html, '<p>Cada criatura a 6 metros hace un tirada de salvación de Destreza.</p><ul><li>Un conjuro de acción adicional.</li></ul>');
  } finally { globalThis.fetch = real; console.warn = warn; }
});

test('Gemini: mensaje claro cuando la cuenta no tiene plan gratis', async () => {
  const real = globalThis.fetch; const warn = console.warn; console.warn = () => {};
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'The Gemini API free tier is not available for this project. Please set up billing' } }), { status: 429 });
  try { const t = createTranslator({ GEMINI_API_KEY: 'k', TR_MODEL: 'm', TR_RETRY_MS: '0' }); await assert.rejects(t.translate('<p>x</p>'), /cuenta personal de Gmail/); assert.match(t.status().lastError.msg, /free tier/); }
  finally { globalThis.fetch = real; console.warn = warn; }
});
