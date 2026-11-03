// Prueba del editor del mapa en un Chromium real: objetos, seleccionar, mover, girar, escalar, deshacer/rehacer,
// encerrar varios, duplicar, borrar, editar texto, color, capas (mover entre capas y reordenar arrastrando) y Esc.
// Uso: npm run build && node tests/web/editor.pw.mjs [auto|2d]   (lo corre npm run test:gl con los dos motores)
import { createRequire } from 'node:module';
import { startServer } from '../../server/index.mjs';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { console.log('Sin playwright: se salta la prueba del editor.'); process.exit(0); }
const engine = process.argv[2] || 'auto', shots = process.env.SHOTS || '', out = shots ? shots + '/editor-' + engine : '';
const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: {} });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1100, height: 780 } })).newPage();
const errors = []; const ok = (n, c) => { console.log((c ? 'bien ' : 'MAL  ') + n); if (!c) errors.push('falló: ' + n); };
p.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await p.addInitScript((eng) => { localStorage.setItem('diario-v4', JSON.stringify({ v: 4, skin: 'carmesi' })); localStorage.setItem('diario-gfx', JSON.stringify({ q: 'alta', engine: eng === '2d' ? '2d' : 'auto' })); localStorage.setItem('diario-fx', JSON.stringify({ m: 'off' })); }, engine);
await p.goto('http://127.0.0.1:' + srv.port + '/'); await p.waitForTimeout(1200);
const act = (a, v) => p.evaluate(([a, v]) => { const el = document.querySelector('[data-act="' + a + '"]' + (v ? '[data-v="' + v + '"]' : '')); if (!el) throw new Error('falta ' + a + ' ' + (v || '')); el.click(); }, [a, v]);
await act('mapsopen'); await p.waitForTimeout(200); await act('mapnew');
await p.evaluate(() => { const f = document.querySelector('[data-form="mapnew"]'); f.elements.name.value = 'Taberna'; f.elements.size.value = '24x18'; f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
await p.waitForTimeout(1500);
const M = () => p.evaluate(() => Object.values(Mapas._maps())[0]);
ok('una sola capa al crear', (await M()).layers.length === 1);
const box = await p.locator('#mapCv').boundingBox();
// coordenadas de pantalla de una casilla
const scr = async (x, y) => p.evaluate(([x, y]) => { const cv = document.getElementById('mapCv'), r = cv.getBoundingClientRect(); const m = Object.values(Mapas._maps())[0]; const W = cv.clientWidth, H = cv.clientHeight, s = Math.max(4, Math.min(80, Math.min((W - 20) / m.cols, (H - 20) / m.rows))); const ox = (W - m.cols * s) / 2, oy = (H - m.rows * s) / 2; return [r.left + ox + x * s, r.top + oy + y * s, s]; }, [x, y]);
// objetos
await act('mapassets'); await p.waitForTimeout(200);
ok('panel de objetos', await p.evaluate(() => document.querySelectorAll('.as-it').length > 5));
await act('mapascat', 'muebles'); await act('mapaspick', 'mesa'); let q = await scr(10, 8); await p.mouse.click(q[0], q[1]); await p.waitForTimeout(150);
await p.evaluate(() => document.querySelector('[data-act="mapassets"]').click()); await p.waitForTimeout(100); await act('mapascat', 'luz'); await act('mapaspick', 'fogata'); q = await scr(5.5, 5.5); await p.mouse.click(q[0], q[1]); await p.waitForTimeout(150);
await p.evaluate(() => document.querySelector('[data-act="mapassets"]').click()); await p.waitForTimeout(100); await p.fill('#asQ', 'barril'); await p.waitForTimeout(100); await act('mapaspick', 'barril');
for (const [x, y] of [[15.5, 4.5], [16.5, 4.5], [15.5, 5.5]]) { q = await scr(x, y); await p.mouse.click(q[0], q[1]); await p.waitForTimeout(80); }
let m = await M(); ok('cinco objetos puestos', m.strokes.filter((k) => k.k === 'asset').length === 5);
ok('la mesa queda centrada en la cuadrícula', JSON.stringify(m.strokes[0].pts) === '[10,8.5]' || JSON.stringify(m.strokes[0].pts) === '[10,8]');
// texto
await act('maptool', 'text'); q = await scr(12, 3); await p.mouse.click(q[0], q[1]); await p.waitForTimeout(100); await p.fill('#mapTxt input', 'El Poni Pisador'); await p.press('#mapTxt input', 'Enter'); await p.waitForTimeout(150);
// seleccionar la mesa y moverla
await act('maptool', 'select');
const mesa = (await M()).strokes[0]; q = await scr(mesa.pts[0], mesa.pts[1]);
await p.mouse.move(q[0], q[1]); await p.mouse.down(); await p.mouse.move(q[0] + q[2] * 3, q[1] + q[2] * 2, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(200);
m = await M(); const mesa2 = m.strokes.find((k) => k.id === mesa.id);
ok('mover con arrastre (3, 2 casillas)', Math.abs(mesa2.pts[0] - mesa.pts[0] - 3) < 0.01 && Math.abs(mesa2.pts[1] - mesa.pts[1] - 2) < 0.01);
ok('barra de selección visible', await p.evaluate(() => !document.getElementById('mapSel').hidden));
// girar con la manija
const hd = await p.evaluate(() => { const o = MapEd.overlay(Object.values(Mapas._maps())[0]); return o.handles; });
q = await scr(hd.rot[0], hd.rot[1]); const c0 = await scr(hd.box.cx, hd.box.cy);
await p.mouse.move(q[0], q[1]); await p.mouse.down(); await p.mouse.move(c0[0] + (q[1] - c0[1]) * -1 * -1, c0[1], { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(150);
m = await M(); ok('girar con la manija (90°)', Math.abs(Math.abs(m.strokes.find((k) => k.id === mesa.id).r || 0) - 90) < 0.5);
if (out) await p.screenshot({ path: out + '-girada.png' });
// escalar con una esquina
const hd2 = await p.evaluate(() => MapEd.overlay(Object.values(Mapas._maps())[0]).handles);
q = await scr(hd2.corners[2][0], hd2.corners[2][1]); const cc = await scr(hd2.box.cx, hd2.box.cy);
await p.mouse.move(q[0], q[1]); await p.mouse.down(); await p.mouse.move(cc[0] + (q[0] - cc[0]) * 1.5, cc[1] + (q[1] - cc[1]) * 1.5, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(150);
m = await M(); const sc = m.strokes.find((k) => k.id === mesa.id); ok('escalar con la esquina (×1.5)', Math.abs(sc.s - 3) < 0.15);
// deshacer y rehacer
await act('mapundo'); await p.waitForTimeout(100); m = await M(); ok('deshacer la escala', m.strokes.find((k) => k.id === mesa.id).s === 2);
await act('mapredo'); await p.waitForTimeout(100); m = await M(); ok('rehacer', Math.abs(m.strokes.find((k) => k.id === mesa.id).s - 3) < 0.15);
// encerrar los tres barriles, duplicar, borrar y deshacer el borrado
const a = await scr(17.4, 6.4), bb = await scr(14.7, 4.1);
await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move(bb[0], bb[1], { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(150);
ok('encerrar varios (3 barriles)', await p.evaluate(() => MapEd.count() === 3));
await act('seldup'); await p.waitForTimeout(100); m = await M(); ok('duplicar', m.strokes.filter((k) => k.a === 'barril').length === 6);
await act('seldel'); await p.waitForTimeout(100); m = await M(); ok('borrar lo elegido', m.strokes.filter((k) => k.a === 'barril').length === 3);
await act('mapundo'); await p.waitForTimeout(100); m = await M(); ok('deshacer el borrado', m.strokes.filter((k) => k.a === 'barril').length === 6);
// Esc con algo elegido lo suelta y no cierra el mapa
await act('maptool', 'select'); { const bq = await scr(15.5, 4.5); await p.mouse.click(bq[0], bq[1]); await p.waitForTimeout(100); }
await p.keyboard.press('Escape'); await p.waitForTimeout(100);
ok('Esc suelta la selección sin cerrar el mapa', await p.evaluate(() => MapEd.count() === 0 && document.getElementById('mapCv').clientWidth > 0));
// editar el texto
const tx = (await M()).strokes.find((k) => k.k === 'text'); q = await scr(tx.pts[0], tx.pts[1]); await p.mouse.click(q[0], q[1]); await p.waitForTimeout(100);
await act('seltext'); await p.waitForTimeout(100); await p.fill('#mapTxt input', 'La Jarra Rota'); await p.press('#mapTxt input', 'Enter'); await p.waitForTimeout(100);
m = await M(); ok('editar texto', m.strokes.find((k) => k.k === 'text').t === 'La Jarra Rota');
await act('selcolor', '#2f5d8a'); m = await M(); ok('cambiar color', m.strokes.find((k) => k.k === 'text').c === '#2f5d8a');
// capas: agregar, mover la fogata a la nueva y reordenar arrastrando
await p.keyboard.press('Escape'); await act('maplayers'); await p.waitForTimeout(100); await act('mapladd'); await p.waitForTimeout(150);
m = await M(); ok('capa nueva', m.layers.length === 2);
await act('mappopx'); const fog = m.strokes.find((k) => k.a === 'fogata'); q = await scr(fog.pts[0], fog.pts[1]); await act('maptool', 'select'); await p.mouse.click(q[0], q[1]); await p.waitForTimeout(100);
await p.selectOption('#selLayer', m.layers[1].id); await p.waitForTimeout(100);
m = await M(); ok('mover a otra capa', m.strokes.find((k) => k.a === 'fogata').l === m.layers[1].id);
await p.keyboard.press('Escape'); await act('maplayers'); await p.waitForTimeout(150);
const g = await p.locator('#mapLRows .map-layer').nth(1).locator('[data-ldrag]').boundingBox(), t0 = await p.locator('#mapLRows .map-layer').nth(0).boundingBox();
await p.mouse.move(g.x + g.width / 2, g.y + g.height / 2); await p.mouse.down(); await p.mouse.move(g.x + g.width / 2, t0.y + 3, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(150);
m = await M(); ok('reordenar capas arrastrando', m.layers[1].id === 'l1');
if (out) await p.screenshot({ path: out + '-capas.png' });
await act('mappopx'); await p.waitForTimeout(150);
await act('maptool', 'select'); q = await scr(15.5, 4.5); await p.mouse.click(q[0], q[1]); await p.waitForTimeout(200);
if (out) await p.screenshot({ path: out + '-final.png' });
console.log('motor: ' + engine + ' · ' + (errors.length ? 'ERRORES:\n' + errors.join('\n') : 'NO ERRORS'));
await browser.close(); await srv.close();
process.exit(errors.length ? 1 : 0);
