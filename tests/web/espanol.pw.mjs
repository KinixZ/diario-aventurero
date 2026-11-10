// Todo en español (módulo 23) en un Chromium real: rasgos de clase y especie, clases, subclases, reglas y estados en
// español con el inglés chico, «Ver el original», el Grimorio con las reglas más consultadas arriba, y Ajustes › Idioma
// › «Traducir todo» (por tandas, con avance, pausa y exportar). El traductor del servidor se simula en la prueba.
// Con SHOTS=carpeta guarda capturas. Uso: npm run build && node tests/web/espanol.pw.mjs
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { startServer } from '../../server/index.mjs';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { console.log('Sin playwright: se salta la prueba del español.'); process.exit(0); }
const PKG = process.env.DIARIO_PAQUETE || '/mnt/user-data/uploads/6be5287b-diario-5e.json';
if (!existsSync(PKG)) { console.log('Sin el paquete de 5etools: se salta la prueba del español.'); process.exit(0); }
const shots = process.env.SHOTS || '';
const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: {} });
const URL = 'http://127.0.0.1:' + srv.port + '/';
const browser = await chromium.launch();
const errors = []; const ok = (n, c) => { console.log((c ? 'bien ' : 'MAL  ') + n); if (!c) errors.push('falló: ' + n); };
const LIB = JSON.parse(readFileSync(PKG, 'utf8'));
const PAL = { id: 'p', name: 'Lyra', level: 11, method: 'array', base: { str: 15, dex: 10, con: 14, int: 8, wis: 12, cha: 13 },
  ch: { cls: 'Paladin|XPHB', sub: 'Oathbreaker|DMG', race: 'Aasimar|XPHB', bg: 'Soldier|XPHB', bgAbil: { alt: 0, picks: ['str', 'con'] }, 'feat:asi4': 'Lucky|XPHB' } };
let calls = 0;
async function open(name, w, h) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: w, height: h }, acceptDownloads: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(name + ' pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_TUNNEL|fonts/.test(m.text())) errors.push(name + ': ' + m.text()); });
  // el traductor del servidor, simulado: antepone «ES» a cada texto y deja las marcas {@…} tal cual
  await p.route('**/api/translate', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: true, provider: 'prueba' }) });
    calls++;
    const { html } = JSON.parse(req.postData() || '{}');
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ html: html.replace(/(<p data-i="\d+">)/g, '$1ES ') }) });
  });
  await p.addInitScript(([c]) => { window.DIARIO_TT_GAP = 0; if (!sessionStorage.getItem('pw-init')) { sessionStorage.setItem('pw-init', '1'); localStorage.setItem('diario-v4', JSON.stringify({ v: 4, skin: 'carmesi', chars: [c], active: 'p', tab: 'personaje', left: 'personaje' })); localStorage.setItem('diario-fx', JSON.stringify({ m: 'off' })); } }, [PAL]);
  await p.goto(URL); await p.waitForTimeout(1000);
  await p.evaluate(async (lib) => { await new Promise((res) => { const r = indexedDB.open('diario5e', 2); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); }; r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(lib, 'lib'); t.oncomplete = () => { r.result.close(); res(); }; }; }); }, LIB);
  await p.reload(); await p.waitForTimeout(2500); await p.evaluate(() => { const c = document.querySelector('[data-act="open"]'); if (c) c.click(); }); await p.waitForTimeout(800);
  return p;
}
const shot = (p, n) => shots ? p.screenshot({ path: shots + '/es-' + n + '.png' }) : null;
const click = (p, sel) => p.evaluate((s) => { const b = document.querySelector(s); if (!b) throw new Error('falta ' + s); b.click(); }, sel);
const tab = (p, t) => click(p, '#ribbons [data-tab="' + t + '"]').then(() => p.waitForTimeout(350));

const p = await open('pj', 390, 844);
ok('el encabezado: Aasimar · Paladín · Rompejuramentos', await p.evaluate(() => document.getElementById('hSub').textContent === 'Aasimar · Paladín · Rompejuramentos'));
await tab(p, 'rasgos');
ok('rasgos: los grupos en español (Paladín 11, Rompejuramentos)', await p.evaluate(() => { const g = [...document.querySelectorAll('#pRasgos .rg-gh b')].map((b) => b.textContent); return g[0] === 'Paladín 11' && g[1] === 'Rompejuramentos'; }));
const names = await p.evaluate(() => [...document.querySelectorAll('#pRasgos .rg-t b:not(.sr)')].map((b) => b.textContent));
ok('rasgos de clase en español: Imposición de manos, Canalizar divinidad, Ataque adicional', ['Imposición de manos', 'Canalizar divinidad', 'Ataque adicional'].every((n) => names.includes(n)));
ok('rasgos de especie en español: Manos sanadoras, Portador de luz', ['Manos sanadoras', 'Portador de luz'].every((n) => names.includes(n)));
ok('al lado, chico, el nombre en inglés', await p.evaluate(() => [...document.querySelectorAll('#pRasgos .rg-en')].some((e) => e.textContent === 'Lay on Hands')));
await shot(p, 'rasgos');
await click(p, '#pRasgos [data-act="origtoggle"]'); await p.waitForTimeout(250);
ok('«Ver el original»: todo en inglés (Lay on Hands, Paladin 11)', await p.evaluate(() => { const b = [...document.querySelectorAll('#pRasgos .rg-t b:not(.sr)')].map((x) => x.textContent); return b.includes('Lay on Hands') && document.querySelector('#pRasgos .rg-gh b').textContent === 'Paladin 11' && !document.querySelector('#pRasgos .rg-en'); }));
ok('y el botón dice «Ver en español»', await p.evaluate(() => /Ver en español/.test(document.querySelector('#pRasgos [data-act="origtoggle"]').textContent)));
await click(p, '#pRasgos [data-act="origtoggle"]'); await p.waitForTimeout(250);
ok('«Ver en español» vuelve', await p.evaluate(() => [...document.querySelectorAll('#pRasgos .rg-t b:not(.sr)')].some((x) => x.textContent === 'Imposición de manos')));
// --- Grimorio ---
await tab(p, 'grimorio');
await click(p, '#grim [data-act="gsec"][data-v="reglas"]'); await p.waitForTimeout(250);
ok('grimorio: «más consultadas» arriba, con Ventaja primero', await p.evaluate(() => { const t = document.querySelector('#grim .g-top'); return !!t && /más consultadas/i.test(t.textContent) && t.querySelector('.gitem b').textContent.startsWith('Ventaja'); }));
ok('grimorio: cada una con su nombre en inglés y una línea de qué es', await p.evaluate(() => { const r = document.querySelector('#grim .g-top .gitem'); return r.querySelector('.g-en').textContent === 'Advantage' && r.querySelector('.g-line').textContent.length > 10; }));
ok('grimorio: luego todas de la A a la Z en español', await p.evaluate(() => { const b = [...document.querySelectorAll('#grim .glist:not(.g-top) .gitem b')].map((x) => x.childNodes[0].textContent.trim()); return b.length > 50 && b[0] === 'Acción' && b.indexOf('Agarrar') > 0 && b.indexOf('Agarrar') < b.indexOf('Alcance'); }));
await shot(p, 'grimorio');
await p.fill('#gq', 'cobertura'); await p.waitForTimeout(300);
ok('grimorio: buscar «cobertura» encuentra Cover', await p.evaluate(() => [...document.querySelectorAll('#grim .gitem .g-en')].some((x) => x.textContent === 'Cover')));
await p.fill('#gq', ''); await p.waitForTimeout(200);
await click(p, '#grim [data-act="gsec"][data-v="condiciones"]'); await p.waitForTimeout(250);
ok('grimorio: estados en español (Cegado, Derribado, Envenenado)', await p.evaluate(() => { const b = [...document.querySelectorAll('#grim .gitem b')].map((x) => x.childNodes[0].textContent.trim()); return ['Cegado', 'Derribado', 'Envenenado'].every((n) => b.includes(n)); }));
// --- Ajustes › Idioma › Traducir todo ---
await p.evaluate(() => { document.querySelector('[data-act="settings"]').click(); }); await p.waitForTimeout(300);
await p.evaluate(() => document.querySelector('[data-act="setcat"][data-v="idioma"]').click()); await p.waitForTimeout(600);
ok('Traducir todo: cinco grupos con cuántos textos tiene cada uno', await p.evaluate(() => { const r = [...document.querySelectorAll('#ttBox .tt-row')]; return r.length === 5 && r.every((x) => /\d[\d,.]* textos/.test(x.textContent)); }));
ok('por defecto: tu personaje y las reglas', await p.evaluate(() => [...document.querySelectorAll('#ttBox [data-tt]')].filter((x) => x.checked).map((x) => x.dataset.tt).join() === 'mine,rules'));
await shot(p, 'ajustes');
await p.evaluate(() => { const r = document.querySelector('#ttBox [data-tt="rules"]'); r.click(); });
await click(p, '#ttBox [data-act="ttgo"]');
await p.waitForFunction(() => /Listo:/.test((document.querySelector('#ttBox .tt-msg') || {}).textContent || ''), null, { timeout: 60000 }).catch(() => {});
ok('traduce tu personaje por tandas (' + calls + ' tandas)', calls > 2 && await p.evaluate(() => /Listo: [\d,.]+ textos en español/.test(document.querySelector('#ttBox .tt-msg').textContent)));
ok('«Tu personaje» queda listo', await p.evaluate(() => /listo/.test(document.querySelector('#ttBox [data-tt="mine"]').closest('.tt-row').textContent)));
ok('queda como traducción fija «Traducido en este aparato»', await p.evaluate(() => /Traducido en este aparato/.test(document.getElementById('trdList').textContent)));
await click(p, '#settingsSheet [data-act="closesheet"]'); await p.waitForTimeout(200);
await tab(p, 'rasgos');
ok('las descripciones de tus rasgos ya salen traducidas', await p.evaluate(() => [...document.querySelectorAll('#pRasgos .rg-s')].filter((x) => /^ES /.test(x.textContent)).length >= 5));
ok('las marcas {@…} se respetaron (los nombres de conjuros siguen como enlaces)', await p.evaluate(() => !/\{@|data-t=/.test(document.getElementById('pRasgos').textContent)));
// exportar
await p.evaluate(() => { document.querySelector('[data-act="settings"]').click(); }); await p.waitForTimeout(300);
await p.evaluate(() => document.querySelector('[data-act="setcat"][data-v="idioma"]').click()); await p.waitForTimeout(400);
const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }).catch(() => null), click(p, '#ttBox [data-act="ttexport"]')]);
ok('exportar baja traduccion-diario.json para el grupo', !!dl && dl.suggestedFilename() === 'traduccion-diario.json');
// pausa
const before = calls;
await p.evaluate(() => { const r = document.querySelector('#ttBox [data-tt="rules"]'); if (!r.checked) r.click(); });
await p.evaluate(() => { window.DIARIO_TT_GAP = 300; }); await click(p, '#ttBox [data-act="ttgo"]'); await p.waitForTimeout(1200);
ok('mientras traduce, muestra el avance', await p.evaluate(() => !!document.querySelector('#ttBox .tt-prog') && /de [\d,.]+/.test(document.querySelector('#ttBox .tt-prog').textContent)));
await shot(p, 'traduciendo');
await click(p, '#ttBox [data-act="ttpause"]'); await p.waitForTimeout(1500);
ok('Pausar lo detiene y lo traducido se queda', calls > before && await p.evaluate(() => /En pausa/.test(document.querySelector('#ttBox .tt-msg').textContent) && !document.querySelector('#ttBox .tt-prog')));
console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'SIN ERRORES');
await browser.close(); await srv.close();
process.exit(errors.length ? 1 : 0);
