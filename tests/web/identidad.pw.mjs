// Identidad de clase en un Chromium real: el Oathbreaker del grupo con su emblema y su humo en el encabezado, el libro
// herido, caído, envenenado y con el Aura de odio, sin errores. Con SHOTS=carpeta guarda las capturas.
// Uso: npm run build && node tests/web/identidad.pw.mjs
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { startServer } from '../../server/index.mjs';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { console.log('Sin playwright: se salta la prueba de identidad.'); process.exit(0); }
const PKG = process.env.DIARIO_PAQUETE || '/mnt/user-data/uploads/6be5287b-diario-5e.json';
if (!existsSync(PKG)) { console.log('Sin el paquete de 5etools: se salta la prueba de identidad.'); process.exit(0); }
const shots = process.env.SHOTS || '';
const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: {} });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = []; const ok = (n, c) => { console.log((c ? 'bien ' : 'MAL  ') + n); if (!c) errors.push('falló: ' + n); };
const pal = { id: 'p', name: 'Lyra', level: 11, method: 'array', base: { str: 15, dex: 10, con: 14, int: 8, wis: 12, cha: 13 }, ch: { cls: 'Paladin|XPHB', sub: 'Oathbreaker|DMG', race: 'Aasimar|XPHB', bg: 'Soldier|XPHB', bgAbil: { alt: 0, picks: ['str', 'con'] } }, rt: { items: [] } };
const p = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 420, height: 860 } })).newPage();
p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_TUNNEL|fonts/.test(m.text())) errors.push(m.text()); });
await p.addInitScript(() => { if (!sessionStorage.getItem('pw-init')) { sessionStorage.setItem('pw-init', '1'); localStorage.setItem('diario-fx', JSON.stringify({ m: 'subtle' })); localStorage.setItem('diario-gfx', JSON.stringify({ q: 'alta' })); } });
await p.goto('http://127.0.0.1:' + srv.port + '/'); await p.waitForTimeout(800);
await p.evaluate(async ([lib, ch]) => { localStorage.setItem('diario-v4', JSON.stringify({ v: 4, skin: 'carmesi', chars: [ch], active: 'p', tab: 'personaje', left: 'personaje' })); await new Promise((res) => { const r = indexedDB.open('diario5e', 2); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); }; r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(lib, 'lib'); t.oncomplete = () => { r.result.close(); res(); }; }; }); }, [JSON.parse(readFileSync(PKG, 'utf8')), pal]);
await p.reload(); await p.waitForTimeout(2500);
await p.evaluate(() => { const c = document.querySelector('.cover [data-act="open"], [data-act="open"]'); if (c) c.click(); }); await p.waitForTimeout(1200);
ok('Oathbreaker: el emblema en el encabezado', await p.evaluate(() => !!document.querySelector('#head > .id-emb use[href="#gi-broken-skull"]') && getComputedStyle(document.documentElement).getPropertyValue('--id-a').trim() === '#6e0f12'));
await p.waitForTimeout(900);
const lit = await p.evaluate(() => { const c = document.querySelector('#head > .id-fx'); if (!c || !c.width) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++; return n; });
ok('el humo se mueve detrás del encabezado', lit > 10);
if (shots) await p.screenshot({ path: shots + '/identidad-oathbreaker.png' });
const max = await p.evaluate(() => Diario.D().hp.max);
await p.evaluate((n) => Diario.applyToMe({ kind: 'damage', amount: n }), Math.ceil(max * 0.8)); await p.waitForTimeout(700);
ok('herido de gravedad: grietas y pulso', await p.evaluate(() => document.querySelector('.app').dataset.hp === 'bad' && getComputedStyle(document.querySelector('#idVeil .v-crack')).opacity > 0.2));
if (shots) await p.screenshot({ path: shots + '/identidad-grietas.png' });
await p.evaluate(() => { Diario.applyToMe({ kind: 'cond+', cond: 'poisoned' }); }); await p.waitForTimeout(1200);
ok('envenenado: el borde se tiñe de verde', await p.evaluate(() => /poisoned/.test(document.querySelector('.app').dataset.st || '') && +getComputedStyle(document.querySelector('#idVeil .v-tint')).opacity > 0.3));
if (shots) await p.screenshot({ path: shots + '/identidad-envenenado.png' });
await p.evaluate(() => { Diario.applyToMe({ kind: 'cond-', cond: 'poisoned' }); Diario.applyToMe({ kind: 'damage', amount: 999 }); }); await p.waitForTimeout(700);
ok('a 0 PG: el libro se apaga', await p.evaluate(() => document.querySelector('.app').dataset.hp === 'down'));
if (shots) await p.screenshot({ path: shots + '/identidad-caido.png' });
await p.evaluate(() => { Diario.applyToMe({ kind: 'heal', amount: 999 }); const r = Diario.rt(Diario.cur()); r.on = ['aura']; Diario.save(); Diario.renderAll(); }); await p.waitForTimeout(800);
ok('el Aura de odio late en el libro', await p.evaluate(() => /aura-hate/.test(document.querySelector('.app').dataset.st || '')));
if (shots) await p.screenshot({ path: shots + '/identidad-aura.png' });
console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'SIN ERRORES');
await browser.close(); await srv.close();
process.exit(errors.length ? 1 : 0);
