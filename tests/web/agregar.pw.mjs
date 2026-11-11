// Agregar enemigos rápido en un Chromium real (el DM en el teléfono): buscar en el Manual, +4 con su iniciativa ya
// tirada (la misma para los iguales), otro más sigue la numeración y toma la misma iniciativa, los recientes y un
// enemigo a mano en una línea. Con SHOTS=carpeta guarda capturas. Uso: npm run build && node tests/web/agregar.pw.mjs
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { startServer } from '../../server/index.mjs';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { console.log('Sin playwright: se salta la prueba de agregar enemigos.'); process.exit(0); }
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
const shot = (n) => shots ? dm.screenshot({ path: shots + '/agregar-' + n + '.png' }) : null;
const until = (p, fn, arg, ms = 8000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const dm = await open('dm', 390, 844);
await dm.evaluate(() => Sala.create('Prueba de enemigos', 'clave1234'));
await dm.waitForFunction(() => Sala.room() && Sala.room().code);
if (existsSync(BEST)) await dm.evaluate((j) => Bestiario._set(j), JSON.parse(readFileSync(BEST, 'utf8')));
const hasBest = existsSync(BEST);
await dm.evaluate(() => { document.getElementById('combat').hidden = false; Mesa.show('combate'); }); await dm.waitForTimeout(600);
ok('el DM tiene «Agregar enemigos» en el combate', await dm.evaluate(() => { const b = document.querySelector('#salaBox [data-act="addopen"]'); return !!b && /Agregar enemigos/.test(b.textContent); }));
await dm.evaluate(() => document.querySelector('#salaBox [data-act="addopen"]').click()); await dm.waitForTimeout(400);
ok('se abre la hoja con el buscador enfocado', await dm.evaluate(() => !document.getElementById('addSheet').hidden && document.activeElement && document.activeElement.id === 'addQ'));
const npcs = () => dm.evaluate(() => (Sala.room().npcs || []).map((n) => ({ name: n.name, init: n.init, hp: n.hp, ac: n.ac, ref: n.ref })));
if (hasBest) {
  await dm.fill('#addQ', 'gob'); await dm.waitForTimeout(300);
  ok('buscar «gob» encuentra al goblin con VD, PG y CA', await dm.evaluate(() => [...document.querySelectorAll('#addRes .qa-row')].some((r) => /Goblin/i.test(r.textContent) && /VD/.test(r.textContent) && /PG/.test(r.textContent) && /CA/.test(r.textContent))));
  await shot('buscar');
  const gname = await dm.evaluate(() => { const r = [...document.querySelectorAll('#addRes .qa-row')].find((x) => /^Goblin/i.test(x.querySelector('b').textContent)); r.querySelector('[data-n="4"]').click(); return r.querySelector('b').textContent; });
  ok('+4: entran cuatro ' + gname, await until(dm, (b) => (Sala.room().npcs || []).filter((n) => n.name.replace(/ \d+$/, '') === b).length === 4, gname));
  const g = await npcs();
  ok('con su iniciativa ya tirada y la misma para los cuatro', g.every((n) => n.init != null) && new Set(g.map((n) => n.init)).size === 1);
  ok('con PG y CA de su ficha y su referencia al Manual', g.every((n) => n.hp > 0 && n.ac > 0 && !!n.ref));
  ok('y ya están en el orden de iniciativa', await dm.evaluate(() => (Sala.room().npcs || []).every((n) => Sala.room().order.includes(n.id))));
  await dm.evaluate((b) => { const r = [...document.querySelectorAll('#addRes .qa-row')].find((x) => x.querySelector('b').textContent === b); r.querySelector('[data-n="1"]').click(); }, gname);
  ok('+1 más: sigue la numeración (5) con la misma iniciativa', await until(dm, (b) => { const l = Sala.room().npcs || []; const g5 = l.find((n) => n.name === b + ' 5'); return !!g5 && g5.init === l.find((n) => n.name === b + ' 1').init; }, gname));
  ok('el panel dice quién ya está (×5)', await until(dm, (b) => document.getElementById('addNow').textContent.includes(b + ' ×5'), gname));
  await dm.fill('#addQ', ''); await dm.waitForTimeout(300);
  ok('sin buscar: el goblin sale en los recientes de la campaña', await dm.evaluate(() => /recientes/i.test(document.getElementById('addRes').textContent) && /Goblin/.test(document.getElementById('addRes').textContent)));
}
// a mano en una línea
ok('leer la línea: nombre, PG, CA, cuántos e iniciativa', await dm.evaluate(() => { const o = Agregar.parse('Capitán bandido 45 PG CA 15 x2 inic +3'); return o.name === 'Capitán bandido' && o.hp === 45 && o.ac === 15 && o.count === 2 && o.initMod === 3; }));
await dm.fill('#addLine', 'Capitán bandido 45 PG CA 15 x2'); await dm.click('#addHand [type="submit"]');
ok('a mano: dos capitanes con 45 PG, CA 15 e iniciativa', await until(dm, () => { const l = (Sala.room().npcs || []).filter((n) => /^Capitán bandido \d$/.test(n.name)); return l.length === 2 && l.every((n) => n.hp === 45 && n.ac === 15 && n.init != null); }));
await dm.fill('#addLine', 'Lobo'); await dm.click('#addHand [type="submit"]'); await dm.waitForTimeout(300);
ok('sin PG avisa qué falta', await dm.evaluate(() => !document.getElementById('addErr').hidden && /PG/.test(document.getElementById('addErr').textContent)));
// sin tirar iniciativa
await dm.evaluate(() => { const c = document.getElementById('addRoll'); c.click(); });
await dm.fill('#addLine', 'Lobo 11 PG CA 13'); await dm.click('#addHand [type="submit"]');
ok('con «tirar iniciativa» apagado entra sin iniciativa', await until(dm, () => { const l = (Sala.room().npcs || []).find((n) => n.name === 'Lobo'); return !!l && l.init == null; }));
await shot('mano');
console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'SIN ERRORES');
await browser.close(); await srv.close();
process.exit(errors.length ? 1 : 0);
