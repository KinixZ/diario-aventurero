// Pisos y zonas en un Chromium real: el DM marca una escalera entre dos mapas (con su vuelta) y una trampa;
// el jugador pisa la escalera, confirma y sube; el DM recibe el aviso de la trampa; el DM lleva al grupo de vuelta
// y separa el combate por mapa.
// Uso: npm run build && node tests/web/pisos.pw.mjs [auto|2d]
import { createRequire } from 'node:module';
import { startServer } from '../../server/index.mjs';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { console.log('Sin playwright: se salta la prueba de pisos.'); process.exit(0); }
const engine = process.argv[2] || 'auto', shots = process.env.SHOTS || '', out = shots ? shots + '/pisos-' + engine : '';
const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: {} });
const URL = 'http://127.0.0.1:' + srv.port + '/';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = []; const ok = (n, c) => { console.log((c ? 'bien ' : 'MAL  ') + n); if (!c) errors.push('falló: ' + n); };
async function open(name) {
  const p = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1100, height: 780 } })).newPage();
  p.on('pageerror', (e) => errors.push(name + ' pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_TUNNEL|fonts/.test(m.text())) errors.push(name + ': ' + m.text()); });
  await p.addInitScript((eng) => { localStorage.setItem('diario-v4', JSON.stringify({ v: 4, skin: 'carmesi' })); localStorage.setItem('diario-gfx', JSON.stringify({ q: 'alta', engine: eng === '2d' ? '2d' : 'auto' })); localStorage.setItem('diario-fx', JSON.stringify({ m: 'off' })); }, engine);
  await p.goto(URL); await p.waitForTimeout(1200);
  return p;
}
const act = (p, a, v) => p.evaluate(([a, v]) => { const el = document.querySelector('[data-act="' + a + '"]' + (v ? '[data-v="' + v + '"]' : '')); if (!el) throw new Error('falta ' + a + ' ' + (v || '')); el.click(); }, [a, v]);
const scr = (p, x, y) => p.evaluate(([x, y]) => { const cv = document.getElementById('mapCv'), r = cv.getBoundingClientRect(), v = Mapas._view(); return [r.left + v.x + x * v.s, r.top + v.y + y * v.s, v.s]; }, [x, y]);
const drag = async (p, a, b) => { const q0 = await scr(p, a[0], a[1]), q1 = await scr(p, b[0], b[1]); await p.mouse.move(q0[0], q0[1]); await p.mouse.down(); await p.mouse.move(q1[0], q1[1], { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(200); };
const pick = (p, sel, v) => p.evaluate(([sel, v]) => { const el = document.querySelector(sel); if (!el) throw new Error('falta ' + sel); if (el.type === 'checkbox') el.checked = !!v; else el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);

/* ---------- En tu copia: dos mapas, una escalera y una trampa que se disparan aquí ---------- */
{
  const p = await open('local');
  await act(p, 'mapsopen'); await p.waitForTimeout(200);
  const mkl = async (name) => { await act(p, 'mapnew'); await p.evaluate((nm) => { const f = document.querySelector('[data-form="mapnew"]'); f.elements.name.value = nm; f.elements.size.value = '24x18'; f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }, name); await p.waitForTimeout(700); };
  await mkl('Cueva alta'); await act(p, 'mapback'); await p.waitForTimeout(200); await mkl('Cueva baja');
  const L = await p.evaluate(() => { const ms = Object.values(Mapas._maps()); return { alta: ms.find((m) => m.name === 'Cueva alta').id, baja: ms.find((m) => m.name === 'Cueva baja').id }; });
  await act(p, 'mapzones'); await drag(p, [20.5, 8.5], [20.5, 8.5]); await drag(p, [20.2, 8.2], [21.5, 9.5]);
  await pick(p, '#mapZMap', L.alta); await p.waitForTimeout(300); await act(p, 'mappopx');
  await drag(p, [10.5, 6.5], [10.5, 10.5]); await act(p, 'mapzk', 'texto'); await pick(p, '#mapZText', 'Gotea agua del techo.'); await act(p, 'mappopx');
  await act(p, 'mapmode', 'jugar'); await act(p, 'mapputme'); await p.waitForTimeout(200);
  const me = await p.evaluate(() => Object.values(Mapas._maps()).find((m) => m.name === 'Cueva baja').tokens[0]);
  await drag(p, [me.x + 0.5, me.y + 0.5], [6.5, 8.5]); await p.waitForTimeout(300);
  ok('en tu copia: el texto se lee al cruzar la zona', await p.evaluate(() => /Gotea agua/.test(document.getElementById('mapAsk').textContent)));
  await act(p, 'mapaskno'); await drag(p, [6.5, 8.5], [20.5, 8.5]); await p.waitForTimeout(300);
  ok('en tu copia: la escalera pregunta', await p.evaluate(() => /Cueva alta/.test(document.getElementById('mapAsk').textContent)));
  await act(p, 'mapaskgo'); await p.waitForTimeout(900);
  ok('en tu copia: pasas al otro mapa con tu ficha', await p.evaluate((id) => Mapas._cur() === id && Mapas._maps()[id].tokens.length === 1, L.alta));
  await p.context().close();
}

const dm = await open('DM');
await dm.evaluate(() => Sala.create('Prueba pisos', 'clave1234'));
await dm.waitForFunction(() => Sala.status() === 'on' && Sala.room() && Sala.room().code);
const code = await dm.evaluate(() => Sala.room().code);
await dm.evaluate(() => document.querySelector('[data-act="mapsopen"]').click()); await dm.waitForTimeout(200);
const mk = async (name) => { await dm.evaluate((nm) => { document.querySelector('[data-act="mapnew"][data-v="dm"]').click(); const f = document.querySelector('[data-form="mapnew"]'); f.elements.name.value = nm; f.elements.size.value = '24x18'; f.elements.hidden.checked = false; f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }, name); await dm.waitForTimeout(700); };
await mk('Torre'); await dm.evaluate(() => document.querySelector('[data-act="mapback"]').click()); await dm.waitForTimeout(200);
await mk('Sótano');
await dm.waitForFunction(() => Sala.room().maps && Sala.room().maps.length === 2, null, { timeout: 5000 });
const ids = await dm.evaluate(() => { const r = Sala.room(); const t = r.maps.find((m) => m.name === 'Torre'), s = r.maps.find((m) => m.name === 'Sótano'); return { torre: t.id, sotano: s.id }; });
await dm.evaluate((id) => Sala.send({ t: 'scene.set', id }), ids.sotano);
// la escalera: zona de paso en el sótano que lleva a la torre, con su vuelta
await act(dm, 'mapmode', 'dibujar'); await act(dm, 'mapzones');
await drag(dm, [18.5, 6.5], [19.5, 7.5]);
ok('se abre el panel de la zona', await dm.evaluate(() => !!document.getElementById('mapZName')));
await pick(dm, '#mapZName', 'Escalera a la torre'); await dm.waitForTimeout(150);
await pick(dm, '#mapZMap', ids.torre); await dm.waitForTimeout(500);
await act(dm, 'mapzback'); await dm.waitForTimeout(700);
let zs = await dm.evaluate((id) => Mapas._maps()[id].trig, ids.sotano);
ok('paso con destino y vuelta', zs.length === 1 && zs[0].to && zs[0].to.map === ids.torre && !!zs[0].to.zid);
const back = await dm.evaluate((id) => Mapas._maps()[id].trig, ids.torre);
ok('la vuelta en la torre', back.length === 1 && back[0].to.map === ids.sotano);
// una trampa en el camino
await drag(dm, [12.5, 4.5], [12.5, 9.5]);
await act(dm, 'mapzk', 'trampa'); await dm.waitForTimeout(150);
await pick(dm, '#mapZName', 'Foso'); await dm.waitForTimeout(100); await pick(dm, '#mapZText', 'Salvación de DES CD 13'); await dm.waitForTimeout(250);
zs = await dm.evaluate((id) => Mapas._maps()[id].trig, ids.sotano);
ok('trampa puesta (una sola vez)', zs.some((z) => z.k === 'trampa' && z.name === 'Foso' && z.once));
await act(dm, 'mappopx'); await act(dm, 'mapmode', 'jugar'); await dm.waitForTimeout(300);
if (out) await dm.screenshot({ path: out + '-dm-zonas.png' });
// el jugador entra, pone su ficha y cruza la trampa hasta la escalera
const pj = await open('PJ');
await pj.evaluate((c) => Sala.join(c), code);
await pj.waitForFunction(() => Sala.status() === 'on' && Sala.room() && Sala.room().scene, null, { timeout: 8000 });
await pj.evaluate(() => document.querySelector('[data-act="mapsopen"]').click());
await pj.waitForFunction(() => document.querySelector('#mapCv'), null, { timeout: 8000 }); await pj.waitForTimeout(800);
await pj.evaluate((id) => Sala.send({ t: 'tok.add', id, tok: { kind: 'pc', name: 'Lyra', x: 8, y: 6, color: '#2f5d8a' } }), ids.sotano);
await pj.waitForTimeout(700);
ok('el jugador ve la escalera (no la trampa)', await pj.evaluate((id) => { const z = Mapas._maps()[id].trig; return z.length === 1 && z[0].k === 'paso' && z[0].to.name === 'Torre'; }, ids.sotano));
await drag(pj, [8.5, 6.5], [18.5, 6.5]); await pj.waitForTimeout(900);
ok('al DM le llega el aviso de la trampa', await dm.evaluate(() => /activó Foso/.test(document.getElementById('salaToast').textContent)));
ok('al pisar la escalera le pregunta', await pj.evaluate(() => { const a = document.getElementById('mapAsk'); return a && !a.hidden && !!a.querySelector('[data-act="mapaskgo"]') && /Torre/.test(a.textContent); }));
if (out) await pj.screenshot({ path: out + '-pj-pregunta.png' });
await act(pj, 'mapaskgo'); await pj.waitForTimeout(1200);
ok('sube: se abre la torre con su ficha', await pj.evaluate((id) => { const mp = Mapas._maps()[id]; return Mapas._cur && Mapas._cur() === id && mp.tokens.some((t) => t.name === 'Lyra'); }, ids.torre));
ok('en el sótano ya no está', await dm.evaluate((id) => !Mapas._maps()[id].tokens.some((t) => t.name === 'Lyra'), ids.sotano));
if (out) await pj.screenshot({ path: out + '-pj-torre.png' });
// el DM pone un enemigo en el sótano con iniciativa; con el grupo repartido puede separar el combate
await dm.evaluate((id) => { Sala.send({ t: 'npc.add', name: 'Rata', ac: 10, hp: 3, init: 5, map: id }); }, ids.sotano); await dm.waitForTimeout(300);
await dm.evaluate(() => Sala.send({ t: 'tok.add', id: Sala.room().scene, tok: { kind: 'pc', name: 'Aliado', x: 3, y: 3 } })); await dm.waitForTimeout(200);
await pj.evaluate(() => Sala.send({ t: 'init', value: 15 })); await dm.waitForTimeout(500);
await dm.evaluate(() => Sala.send({ t: 'fight.split', value: true })); await dm.waitForTimeout(600);
ok('combate separado: el jugador ve solo el suyo', await pj.evaluate(() => { const r = Sala.room(); return r.split && r.order.length === 1; }));
ok('el DM ve los combates por mapa', await dm.evaluate(() => Sala.room().fights.length >= 1 && !!document.querySelector('.fight-chip')));
await dm.evaluate(() => Sala.send({ t: 'fight.split', value: false })); await dm.waitForTimeout(400);
// el DM abre la torre y trae al grupo de vuelta al sótano
await dm.evaluate((id) => Mapas.open(id), ids.torre); await dm.waitForTimeout(800);
await act(dm, 'maptravelp'); await dm.waitForTimeout(200);
await dm.evaluate((id) => document.querySelector('[data-act="maptravel"][data-map="' + id + '"][data-zid]').click(), ids.sotano); await dm.waitForTimeout(1200);
ok('el DM trae al grupo de vuelta', await dm.evaluate((id) => Mapas._maps()[id].tokens.some((t) => t.name === 'Lyra'), ids.sotano));
ok('al jugador se le abre el sótano', await pj.evaluate((id) => Mapas._cur() === id, ids.sotano));

await browser.close(); await srv.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('Pisos: todo bien (' + engine + ')');
