// Paredes, puertas y visión en un Chromium real.
// 1) En tu copia: trazar una habitación, abrirle una puerta tocando la pared, cambiar el tipo, deshacer/rehacer, borrar con el borrador,
//    prender la visión y ver cómo se descubre al moverse y al abrir la puerta.
// 2) En una campaña: el DM pone paredes y visión; el jugador no ve al enemigo detrás de la pared, no puede cruzar la puerta cerrada,
//    la abre de cerca y descubre el pasillo.
// Uso: npm run build && node tests/web/vision.pw.mjs [auto|2d]
import { createRequire } from 'node:module';
import { startServer } from '../../server/index.mjs';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { console.log('Sin playwright: se salta la prueba de visión.'); process.exit(0); }
const engine = process.argv[2] || 'auto', shots = process.env.SHOTS || '', out = shots ? shots + '/vision-' + engine : '';
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
// coordenadas de pantalla de un punto del mapa (con la vista actual)
const scr = (p, x, y) => p.evaluate(([x, y]) => { const cv = document.getElementById('mapCv'), r = cv.getBoundingClientRect(), v = Mapas._view(); return [r.left + v.x + x * v.s, r.top + v.y + y * v.s, v.s]; }, [x, y]);
const drag = async (p, a, b) => { const q0 = await scr(p, a[0], a[1]), q1 = await scr(p, b[0], b[1]); await p.mouse.move(q0[0], q0[1]); await p.mouse.down(); await p.mouse.move(q1[0], q1[1], { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(150); };
const click = async (p, x, y) => { const q = await scr(p, x, y); await p.mouse.click(q[0], q[1]); await p.waitForTimeout(150); };

/* ---------- 1) En tu copia ---------- */
const p = await open('local');
await act(p, 'mapsopen'); await p.waitForTimeout(200); await act(p, 'mapnew');
await p.evaluate(() => { const f = document.querySelector('[data-form="mapnew"]'); f.elements.name.value = 'Cripta'; f.elements.size.value = '24x18'; f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
await p.waitForTimeout(1500);
const M = () => p.evaluate(() => Object.values(Mapas._maps())[0]);
await act(p, 'mapwalls'); await p.waitForTimeout(150);
ok('panel de paredes con sus tipos', await p.evaluate(() => document.querySelectorAll('.wall-t').length === 8));
await act(p, 'mapwallroom', '1'); await act(p, 'mapwallt', 'wall');
await drag(p, [6, 4], [16, 13]);
let m = await M(); ok('habitación: 4 paredes', m.walls.length === 4 && m.walls.every((w) => w.t === 'wall'));
// puerta: con el tipo Puerta, tocar la pared del este le abre un hueco de una casilla
await act(p, 'mapwalls'); await act(p, 'mapwallroom', '0'); await act(p, 'mapwallt', 'door');
await click(p, 16, 8.5);
m = await M(); const door = m.walls.find((w) => w.t === 'door');
ok('tocar la pared le abre una puerta (3 tramos)', m.walls.length === 6 && door && door.a[0] === 16 && door.b[0] === 16 && Math.abs(Math.abs(door.a[1] - door.b[1]) - 1) < 0.01);
ok('la puerta queda elegida con su barra', await p.evaluate(() => !!Mapas._wall() && !document.getElementById('mapSel').hidden && !!document.getElementById('mapWallType')));
await act(p, 'mapwalllock'); m = await M(); ok('con llave', m.walls.find((w) => w.t === 'door').lock === true);
await act(p, 'mapwalllock');
await act(p, 'mapundo'); await act(p, 'mapundo'); await act(p, 'mapundo'); await p.waitForTimeout(100); m = await M();
ok('deshacer quita la puerta y vuelve la pared entera', m.walls.length === 4 && !m.walls.some((w) => w.t === 'door'));
await act(p, 'mapredo'); await p.waitForTimeout(100); m = await M(); ok('rehacer la vuelve a poner', m.walls.length === 6 && m.walls.some((w) => w.t === 'door'));
// un tramo suelto de ventana y cambiarle el tipo desde la barra
await act(p, 'mapwalls'); await act(p, 'mapwallt', 'window'); await drag(p, [2, 2], [2, 8]);
m = await M(); ok('tramo de ventana', m.walls.length === 7 && m.walls.some((w) => w.t === 'window'));
await p.selectOption('#mapWallType', 'curtain'); await p.waitForTimeout(100); m = await M(); ok('cambiar a cortina', m.walls.some((w) => w.t === 'curtain'));
// mover una punta arrastrándola (la pared elegida)
const cur = m.walls.find((w) => w.t === 'curtain'); await drag(p, cur.b, [3, 9]);
m = await M(); ok('mover una punta', JSON.stringify(m.walls.find((w) => w.id === cur.id).b) === '[3,9]');
// borrador
await act(p, 'maptool', 'erase'); await drag(p, [2.3, 3], [2.8, 5]);
m = await M(); ok('el borrador quita paredes', m.walls.length === 6 && !m.walls.some((w) => w.t === 'curtain'));
if (out) await p.screenshot({ path: out + '-editor.png' });
// visión: niebla + visión en el panel de niebla, una ficha dentro de la habitación
await act(p, 'mapmode', 'niebla'); await p.waitForTimeout(150);
await p.evaluate(() => { const c = document.getElementById('mapVisOn'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(150);
m = await M(); ok('visión prendida (y la niebla)', m.vis.on && m.fog.on);
await act(p, 'mapmode', 'jugar'); await p.waitForTimeout(100); await act(p, 'mapputme'); await p.waitForTimeout(250);
m = await M(); const tok = m.tokens[0];
ok('la ficha queda dentro', tok && tok.x > 6 && tok.x < 16 && tok.y > 4 && tok.y < 13);
const fogBit = (mm, x, y) => { const b = atob(mm.fog.cells || ''), i = y * mm.cols + x; return (b.charCodeAt(i >> 3) >> (i & 7)) & 1; };
ok('se descubre la habitación y no lo de afuera', fogBit(m, 7, 5) === 1 && fogBit(m, 20, 8) === 0);
ok('el polígono de vista se queda adentro', await p.evaluate(() => { const v = Mapas._vis(); return v && v.polys.length === 1 && Vision.inPoly(v.polys[0], 8, 6) && !Vision.inPoly(v.polys[0], 20, 8.5); }));
await p.evaluate(() => Mapas._viewAs(true)); await p.waitForTimeout(300);
if (out) await p.screenshot({ path: out + '-cerrada.png' });
// abrir la puerta tocándola en modo Jugar: se ve el exterior
await click(p, 16, 8.5); await p.waitForTimeout(450);
m = await M(); ok('tocar la puerta la abre', m.walls.find((w) => w.t === 'door').open === true);
ok('por la puerta abierta se ve afuera', await p.evaluate(() => Vision.inAny(Mapas._vis().polys, 20.5, 7.5)) && fogBit(m, 20, 7) === 1);
if (out) await p.screenshot({ path: out + '-abierta.png' });
// arrastrar la ficha: rodea si hace falta y descubre al salir
await drag(p, [tok.x + 0.5, tok.y + 0.5], [20.5, 8.5]); await p.waitForTimeout(200);
m = await M(); ok('la ficha sale por la puerta', m.tokens[0].x === 20 && m.tokens[0].y === 8);
ok('lo que vio en el camino queda descubierto', fogBit(m, 22, 2) === 1);
await p.evaluate(() => Mapas._viewAs(false));
if (out) await p.screenshot({ path: out + '-afuera.png' });

/* ---------- 2) En una campaña ---------- */
const dm = await open('DM');
await dm.evaluate(() => Sala.create('Prueba visión', 'clave1234'));
await dm.waitForFunction(() => Sala.status() === 'on' && Sala.room() && Sala.room().code);
const code = await dm.evaluate(() => Sala.room().code);
await dm.evaluate(() => document.querySelector('[data-act="mapsopen"]').click()); await dm.waitForTimeout(200);
await dm.evaluate(() => { document.querySelector('[data-act="mapnew"][data-v="dm"]').click(); const f = document.querySelector('[data-form="mapnew"]'); f.elements.name.value = 'Mazmorra'; f.elements.size.value = '24x18'; f.elements.hidden.checked = false; f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
await dm.waitForFunction(() => Sala.room().maps && Sala.room().maps.length === 1, null, { timeout: 5000 });
const mid = await dm.evaluate(() => Sala.room().maps[0].id);
const ROOM = [{ id: 'w1', a: [4, 3], b: [12, 3] }, { id: 'w2', a: [12, 3], b: [12, 7] }, { id: 'd1', a: [12, 7], b: [12, 8], t: 'door' }, { id: 'w3', a: [12, 8], b: [12, 12] }, { id: 'w4', a: [12, 12], b: [4, 12] }, { id: 'w5', a: [4, 12], b: [4, 3] }, { id: 's1', a: [4, 7], b: [4, 8], t: 'secret' }].map((w) => ({ t: 'wall', ...w }));
await dm.evaluate(([id, walls]) => { Sala.send({ t: 'scene.set', id }); Sala.send({ t: 'wall.add', id, walls }); Sala.send({ t: 'map.vis', id, on: true }); Sala.send({ t: 'tok.add', id, tok: { name: 'Ogro', kind: 'npc', x: 18, y: 7, s: 2, color: '#8c2626' } }); }, [mid, ROOM]);
await dm.waitForTimeout(600);
const pj = await open('PJ');
await pj.evaluate((c) => Sala.join(c), code);
await pj.waitForFunction(() => Sala.status() === 'on' && Sala.room() && Sala.room().scene, null, { timeout: 8000 });
await pj.evaluate(() => document.querySelector('[data-act="mapsopen"]').click());
await pj.waitForFunction(() => document.querySelector('#mapCv'), null, { timeout: 8000 }); await pj.waitForTimeout(800);
await pj.evaluate((id) => Sala.send({ t: 'tok.add', id, tok: { kind: 'pc', name: 'Lyra', x: 7, y: 7, color: '#2f5d8a' } }), mid);
await pj.waitForTimeout(800);
const P = () => pj.evaluate((id) => Mapas._maps()[id], mid);
let pm = await P();
ok('al jugador la puerta secreta le llega como pared', pm.walls.find((w) => w.id === 's1').t === 'wall');
ok('el jugador ve su habitación descubierta', fogBit(pm, 6, 5) === 1 && fogBit(pm, 18, 7) === 0);
const ogre = pm.tokens.find((t) => t.kind === 'npc');
ok('no ve al ogro detrás de la pared', await pj.evaluate((tid) => Mapas._shown(tid) === false, ogre.id));
ok('el DM sí lo ve', await dm.evaluate((tid) => Mapas._shown(tid) === true, ogre.id));
// intenta salir con la puerta cerrada: no lo deja
const me = pm.tokens.find((t) => t.kind === 'pc');
await pj.evaluate(() => { const v = Mapas._view(); }); await drag(pj, [7.5, 7.5], [16.5, 7.5]); await pj.waitForTimeout(500);
pm = await P(); ok('la puerta cerrada no deja pasar', pm.tokens.find((t) => t.id === me.id).x === 7);
if (out) await pj.screenshot({ path: out + '-pj-cerrada.png' });
// se acerca y la abre
await drag(pj, [7.5, 7.5], [11.5, 7.5]); await pj.waitForTimeout(500);
pm = await P(); ok('se acerca a la puerta', pm.tokens.find((t) => t.id === me.id).x === 11);
await click(pj, 12, 7.5); await pj.waitForTimeout(700);
pm = await P(); ok('el jugador abre la puerta de cerca', pm.walls.find((w) => w.id === 'd1').open === true);
ok('al DM le llega abierta', await dm.evaluate((id) => Mapas._maps()[id].walls.find((w) => w.id === 'd1').open === true, mid));
ok('ahora ve al ogro', await pj.evaluate((tid) => Mapas._shown(tid) === true, ogre.id));
ok('se descubre el pasillo por la puerta', fogBit(pm, 18, 7) === 1);
if (out) { await pj.screenshot({ path: out + '-pj-abierta.png' }); await dm.screenshot({ path: out + '-dm.png' }); }
// el DM edita en Dibujar: el panel de paredes y la secreta se ven con su color
await dm.evaluate(() => Mapas._mode('dibujar')); await act(dm, 'mapwalls'); await dm.waitForTimeout(200);
ok('el DM ve los tipos solo-DM', await dm.evaluate(() => !!document.querySelector('.wall-t[data-v="secret"]') && !!document.querySelector('.wall-t[data-v="barrier"]')));
await act(dm, 'mappopx'); await dm.waitForTimeout(150);
if (out) await dm.screenshot({ path: out + '-dm-editor.png' });

await browser.close(); await srv.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('Visión: todo bien (' + engine + ')');
