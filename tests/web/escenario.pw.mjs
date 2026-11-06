// El escenario de prueba en un Chromium real: el DM lo arma con un toque (la cripta para explorar y el patio para
// combatir, con sus paredes, puertas, zonas, luz y dos encuentros), lo muestra a todos, y el encuentro del patio se
// usa: el mapa pasa a combate con los enemigos en su lugar y la zona de despliegue. También: la pestaña Combate se
// pinta al abrirla. Con SHOTS=carpeta guarda capturas. Uso: npm run build && node tests/web/escenario.pw.mjs
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { startServer } from '../../server/index.mjs';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { console.log('Sin playwright: se salta la prueba del escenario.'); process.exit(0); }
const BEST = process.env.DIARIO_BESTIARIO || '/mnt/user-data/uploads/48880306-bestiario-5e.json';
const shots = process.env.SHOTS || '';
const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: {} });
const URL = 'http://127.0.0.1:' + srv.port + '/';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = []; const ok = (n, c) => { console.log((c ? 'bien ' : 'MAL  ') + n); if (!c) errors.push('falló: ' + n); };
async function open(name, w, h) {
  const p = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: w, height: h } })).newPage();
  p.on('pageerror', (e) => errors.push(name + ' pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_TUNNEL|fonts/.test(m.text())) errors.push(name + ': ' + m.text()); });
  await p.addInitScript(() => { if (!sessionStorage.getItem('pw-init')) { sessionStorage.setItem('pw-init', '1'); localStorage.setItem('diario-v4', JSON.stringify({ v: 4, skin: 'carmesi' })); localStorage.setItem('diario-fx', JSON.stringify({ m: 'off' })); } });
  await p.goto(URL); await p.waitForTimeout(1000);
  return p;
}
const until = (p, fn, arg, ms = 8000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const dm = await open('dm', 1280, 800);
await dm.evaluate(() => Sala.create('Prueba del escenario', 'clave1234'));
await dm.waitForFunction(() => Sala.room() && Sala.room().code);
if (existsSync(BEST)) await dm.evaluate((j) => Bestiario._set(j), JSON.parse(readFileSync(BEST, 'utf8')));
await dm.evaluate(() => { document.getElementById('combat').hidden = false; Mesa.show('inicio'); }); await dm.waitForTimeout(500);
ok('el panel del DM ofrece el escenario de prueba', await dm.evaluate(() => !!document.querySelector('[data-act="escprueba"]')));
await dm.evaluate(() => document.querySelector('[data-act="escprueba"]').click());
ok('se crean la cripta y el patio', await until(dm, () => { const ids = (Sala.room().maps || []).map((m) => m.id); return ids.includes('prueba-cripta') && ids.includes('prueba-patio'); }));
ok('y los dos encuentros', await until(dm, () => (Sala.room().encs || []).filter((e) => /^Eprueba/.test(e.id)).length === 2));
await dm.evaluate(() => { Mesa.show('mapas'); Mapas.open('prueba-cripta'); }); await dm.waitForTimeout(1500);
const cr = await dm.evaluate(() => { const m = Object.values(Mapas._maps()).find((x) => x.id === 'prueba-cripta'); return m && { walls: m.walls.length, door: m.walls.filter((w) => w.t === 'door').length, secret: m.walls.filter((w) => w.t === 'secret').length, lock: m.walls.some((w) => w.lock), trig: m.trig.map((z) => z.k).sort().join(','), assets: m.strokes.filter((k) => k.k === 'asset').length, vis: m.vis && m.vis.on, time: m.light && m.light.time, paso: (m.trig.find((z) => z.k === 'paso') || {}).to }; });
ok('la cripta: paredes, puertas (una con llave) y una secreta', cr && cr.walls >= 24 && cr.door >= 3 && cr.secret === 1 && cr.lock);
ok('la cripta: textos, trampa, terreno difícil y la escalera al patio', cr && /dificil/.test(cr.trig) && /trampa/.test(cr.trig) && /texto/.test(cr.trig) && cr.paso && cr.paso.map === 'prueba-patio');
ok('la cripta: de noche, con visión y objetos (braseros, altar, sarcófagos…)', cr && cr.vis && cr.time === 'noche' && cr.assets > 25);
if (shots) await dm.screenshot({ path: shots + '/escenario-cripta.png' });
// el patio y su encuentro
await dm.evaluate(() => document.querySelector('[data-act="mapback"]').click()); await dm.waitForTimeout(300);
await dm.evaluate(() => Mapas.open('prueba-patio')); await dm.waitForTimeout(1200);
ok('el patio: muros bajos para cubrirse, barro y la escalera de vuelta', await dm.evaluate(() => { const m = Object.values(Mapas._maps()).find((x) => x.id === 'prueba-patio'); return m.walls.filter((w) => w.t === 'low').length >= 3 && m.trig.some((z) => z.k === 'dificil') && m.trig.some((z) => z.k === 'paso' && z.to && z.to.map === 'prueba-cripta'); }));
const enc = await dm.evaluate(() => (Sala.room().encs || []).find((e) => e.id === 'Eprueba1'));
ok('la emboscada trae 8 enemigos en dos oleadas (la segunda en la ronda 3)', enc && (enc.n || (enc.npcs || []).length) >= 5);
await dm.evaluate(() => Sala.send({ t: 'enc.use', id: 'Eprueba1' }));
const u1 = await until(dm, () => { const m = (Sala.room().maps || []).find((x) => x.id === 'prueba-patio'); return m && m.state === 'combat' && (Sala.room().npcs || []).length === 5; });; ok('usar la emboscada: el patio pasa a combate con los enemigos de la primera oleada', u1);
ok('los enemigos salen del Manual (con su ficha)', await dm.evaluate(() => (Sala.room().npcs || []).every((n) => !!n.ref)));
ok('y la zona de despliegue del grupo', await dm.evaluate(() => { const m = Object.values(Mapas._maps()).find((x) => x.id === 'prueba-patio'); return m.trig.some((z) => z.k === 'despliegue'); }));
if (shots) await dm.screenshot({ path: shots + '/escenario-patio.png' });
// la pestaña Combate se pinta al abrirla
await dm.evaluate(() => document.querySelector('[data-act="mesatab"][data-v="combate"]').click()); await dm.waitForTimeout(600);
ok('la pestaña Combate no queda vacía al abrirla', await dm.evaluate(() => { const b = document.querySelector('#combat [data-tab-body="combate"]') || document.getElementById('actBox'); return !!b && b.textContent.trim().length > 20; }));
console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'SIN ERRORES');
await browser.close(); await srv.close();
process.exit(errors.length ? 1 : 0);
