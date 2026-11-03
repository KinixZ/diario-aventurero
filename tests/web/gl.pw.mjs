// Prueba en un Chromium real (con WebGL por software): DM y jugador en dos navegadores, mapa compartido,
// fichas que se mueven en vivo, niebla negra para el jugador y abrir/cerrar el mapa sin dejar contextos colgados.
// Uso: npm run build && npm run test:gl   (necesita el paquete playwright; si no está, se salta)
import { createRequire } from 'node:module';
import { startServer } from '../../server/index.mjs';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { console.log('Sin playwright: se salta la prueba del mapa en navegador.'); process.exit(0); }
const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: {} });
const URL = 'http://127.0.0.1:' + srv.port + '/';
const shots = process.env.SHOTS || '';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
async function open(name) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(name + ' pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|fonts/.test(m.text())) errors.push(name + ': ' + m.text()); });
  await p.addInitScript(() => { localStorage.setItem('diario-v4', JSON.stringify({ v: 4, skin: 'carmesi' })); localStorage.setItem('diario-gfx', JSON.stringify({ q: 'alta' })); });
  await p.goto(URL); await p.waitForTimeout(1200);
  return p;
}
const ok = (n, c) => { console.log((c ? 'bien ' : 'MAL  ') + n); if (!c) errors.push('falló: ' + n); };
const dm = await open('DM');
await dm.evaluate(() => Sala.create('Prueba GL', 'clave1234'));
await dm.waitForFunction(() => Sala.status() === 'on' && Sala.room() && Sala.room().code);
const code = await dm.evaluate(() => Sala.room().code);
console.log('código', code);
// el DM crea un mapa visible y lo pone en pantalla
await dm.evaluate(() => document.querySelector('[data-act="mapsopen"]').click());
await dm.waitForTimeout(200);
await dm.evaluate(() => { document.querySelector('[data-act="mapnew"][data-v="dm"]').click(); const f = document.querySelector('[data-form="mapnew"]'); f.elements.name.value = 'Salón'; f.elements.size.value = '24x18'; f.elements.hidden.checked = false; f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
await dm.waitForFunction(() => Sala.room().maps && Sala.room().maps.length === 1, null, { timeout: 5000 });
const mid = await dm.evaluate(() => Sala.room().maps[0].id);
await dm.evaluate((id) => { Sala.send({ t: 'scene.set', id }); Sala.send({ t: 'tok.add', id, tok: { name: 'Ogro', kind: 'npc', x: 10, y: 8, s: 2, color: '#8c2626' } }); Sala.send({ t: 'fog.all', id, value: 0 }); Sala.send({ t: 'fog.on', id, value: true }); Sala.send({ t: 'fog.rect', id, rect: [2, 2, 9, 9], value: 1 }); }, mid);
await dm.waitForTimeout(800);
ok('DM ve el mapa con WebGL', await dm.evaluate(() => document.querySelector('#mapCv') && document.querySelector('#mapCv').dataset.engine === 'gl'));
// el jugador entra con el código
const pj = await open('PJ');
await pj.evaluate((c) => Sala.join(c), code);
await pj.waitForFunction(() => Sala.status() === 'on' && Sala.room() && Sala.room().scene, null, { timeout: 8000 });
await pj.evaluate(() => document.querySelector('[data-act="mapsopen"]').click());
await pj.waitForFunction(() => document.querySelector('#mapCv') && document.querySelector('#mapCv').dataset.engine === 'gl', null, { timeout: 8000 });
await pj.waitForTimeout(1200);
ok('jugador ve el mapa con WebGL', true);
if (shots) await pj.screenshot({ path: shots + '/gl-pj-1.png' });
// el DM mueve al ogro dentro de la zona descubierta: el jugador lo ve llegar
await dm.evaluate((id) => { const mp = Mapas._maps()[id]; const t = mp.tokens[0]; Sala.send({ t: 'tok.move', id, tid: t.id, x: 5, y: 5 }); }, mid);
await pj.waitForTimeout(900);
const moved = await pj.evaluate((id) => { const t = Mapas._maps()[id].tokens[0]; return t && t.x === 5 && t.y === 5; }, mid);
ok('el movimiento llega al jugador', moved);
// descubrir más zona
await dm.evaluate((id) => Sala.send({ t: 'fog.rect', id, rect: [10, 2, 20, 12], value: 1 }), mid);
await pj.waitForTimeout(900);
if (shots) { await pj.screenshot({ path: shots + '/gl-pj-2.png' }); await dm.screenshot({ path: shots + '/gl-dm.png' }); }
// volver a la lista y abrir otra vez: el contexto WebGL se libera y se crea uno nuevo sin errores
for (let i = 0; i < 6; i++) { await pj.evaluate(() => document.querySelector('[data-act="mapback"]').click()); await pj.waitForTimeout(150); await pj.evaluate((id) => Mapas.open(id), mid); await pj.waitForTimeout(500); }
ok('abrir y cerrar el mapa 6 veces', await pj.evaluate(() => document.querySelector('#mapCv').dataset.engine === 'gl'));
console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'NO ERRORS');
await browser.close(); await srv.close();
process.exit(errors.length ? 1 : 0);
