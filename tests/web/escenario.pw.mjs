// El escenario de prueba en un Chromium real: el DM lo prepara con un toque (dos mapas, paredes, zonas, luz y dos
// encuentros), un jugador entra con un personaje de prueba, el DM usa la emboscada y el combate arranca en la cripta.
// Con SHOTS=carpeta guarda capturas. Uso: npm run build && node tests/web/escenario.pw.mjs
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { startServer } from '../../server/index.mjs';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { console.log('Sin playwright: se salta la prueba del escenario.'); process.exit(0); }
const PKG = process.env.DIARIO_PAQUETE || '/mnt/user-data/uploads/6be5287b-diario-5e.json';
const BEST = process.env.DIARIO_BESTIARIO || '/mnt/user-data/uploads/48880306-bestiario-5e.json';
if (!existsSync(PKG)) { console.log('Sin el paquete de 5etools: se salta la prueba del escenario.'); process.exit(0); }
const shots = process.env.SHOTS || '';
const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: {} });
const URL = 'http://127.0.0.1:' + srv.port + '/';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = []; const ok = (n, c) => { console.log((c ? 'bien ' : 'MAL  ') + n); if (!c) errors.push('falló: ' + n); };
const LIB = JSON.parse(readFileSync(PKG, 'utf8'));
async function open(name, w, h, lib) {
  const p = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: w, height: h } })).newPage();
  p.on('pageerror', (e) => errors.push(name + ' pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_TUNNEL|fonts/.test(m.text())) errors.push(name + ': ' + m.text()); });
  await p.addInitScript(() => { if (!sessionStorage.getItem('pw-init')) { sessionStorage.setItem('pw-init', '1'); localStorage.setItem('diario-v4', JSON.stringify({ v: 4, skin: 'carmesi' })); localStorage.setItem('diario-fx', JSON.stringify({ m: 'off' })); } });
  await p.goto(URL); await p.waitForTimeout(1000);
  if (lib) {
    await p.evaluate(async (lib) => { await new Promise((res) => { const r = indexedDB.open('diario5e', 2); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); }; r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(lib, 'lib'); t.oncomplete = () => { r.result.close(); res(); }; }; }); }, LIB);
    await p.reload(); await p.waitForTimeout(2500);
  }
  return p;
}
const until = (p, fn, arg, ms = 8000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);

const dm = await open('dm', 1280, 800);
await dm.evaluate(() => Sala.create('Prueba', 'clave1234'));
await dm.waitForFunction(() => Sala.room() && Sala.room().code);
const code = await dm.evaluate(() => Sala.room().code);
if (existsSync(BEST)) await dm.evaluate((j) => Bestiario._set(j), JSON.parse(readFileSync(BEST, 'utf8')));
await dm.evaluate(() => { document.getElementById('combat').hidden = false; Mesa.show('inicio'); }); await dm.waitForTimeout(500);
ok('el DM tiene «Preparar el escenario de prueba» en su panel', await dm.evaluate(() => !!document.querySelector('[data-act="escdm"]')));
await dm.evaluate(() => Escenario.dm());
ok('dos mapas: la cripta y el bosque', await until(dm, () => { const ids = (Sala.room().maps || []).map((m) => m.id); return ids.includes('prueba-cripta') && ids.includes('prueba-bosque'); }));
ok('dos encuentros: la emboscada y los bandidos', await until(dm, () => (Sala.room().encs || []).filter((e) => /prueba/.test(e.name)).length === 2));
const enc = await dm.evaluate(() => (Sala.room().encs || []).find((e) => /Emboscada/.test(e.name)));
ok('la emboscada va en la cripta, con enemigos del Manual', !!enc && enc.map === 'prueba-cripta' && (enc.n || (enc.npcs || []).length) >= 5);
await dm.evaluate(() => { Mesa.show('mapas'); Mapas.open('prueba-cripta'); }); await dm.waitForTimeout(1500);
const mp = await dm.evaluate(() => { const m = Mapas._maps()['prueba-cripta']; return m && { walls: m.walls.length, doors: m.walls.filter((w) => w.t === 'door').length, secret: m.walls.filter((w) => w.t === 'secret').length, trig: (m.trig || []).map((t) => t.k).sort().join(','), assets: m.strokes.filter((s) => s.k === 'asset').length, vis: !!(m.vis && m.vis.on), time: m.light && m.light.time }; });
ok('la cripta: paredes, puertas, una secreta, zonas, objetos, de noche y con visión', !!mp && mp.walls > 20 && mp.doors >= 2 && mp.secret === 1 && mp.trig === 'dificil,paso,texto,trampa' && mp.assets > 20 && mp.vis && mp.time === 'noche');
if (shots) await dm.screenshot({ path: shots + '/escenario-dm-cripta.png' });

// el jugador entra con un personaje de prueba
const pj = await open('pj', 844, 390, true);
await pj.evaluate(() => { document.querySelector('[data-act="escpj"]').click(); }); await pj.waitForTimeout(500);
ok('tres personajes de prueba en el diario', await pj.evaluate(() => Diario.chars ? Diario.chars().filter((c) => /prueba/.test(c.name)).length === 3 : JSON.parse(localStorage.getItem('diario-v4')).chars.filter((c) => /prueba/.test(c.name)).length === 3));
await pj.evaluate((c) => Sala.join(c, { char: 'prueba-pal' }), code);
await pj.waitForFunction(() => Sala.status() === 'on' && Sala.room(), null, { timeout: 8000 });
const eid = await dm.evaluate(() => (Sala.room().encs || []).find((e) => /Emboscada/.test(e.name)).id);
await dm.evaluate((id) => Sala.send({ t: 'enc.use', id }), eid);
ok('usar la emboscada pone la cripta en combate con los enemigos', await until(dm, () => { const m = (Sala.room().maps || []).find((x) => x.id === 'prueba-cripta'); return m && m.state === 'combat' && (Sala.room().npcs || []).length >= 3; }));
await pj.evaluate(() => { const m = document.querySelector('[data-act="mesa"]'); if (m) m.click(); }); await pj.waitForTimeout(500);
await pj.evaluate(() => { document.getElementById('combat').hidden = false; Mesa.show('mapas'); Mapas.open('prueba-cripta'); }); await pj.waitForTimeout(1500);
ok('al jugador le llega el combate en la cripta', await until(pj, () => !!Mapas._maps()['prueba-cripta']));
if (shots) await pj.screenshot({ path: shots + '/escenario-pj-cripta.png' });
console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'SIN ERRORES');
await browser.close(); await srv.close();
process.exit(errors.length ? 1 : 0);
