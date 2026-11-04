// Luz, hora y clima en un Chromium real.
// 1) En tu copia: de noche, una antorcha alumbra parte de la habitación; un enemigo en la oscuridad no se ve hasta que
//    tu ficha lleva luz o tiene visión en la oscuridad; de día se ve todo; la lluvia se anima encima del mapa.
// 2) En una campaña: el DM pone la noche y una antorcha; al jugador le llega y solo descubre lo iluminado.
// Uso: npm run build && node tests/web/luz.pw.mjs [auto|2d]
import { createRequire } from 'node:module';
import { startServer } from '../../server/index.mjs';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { console.log('Sin playwright: se salta la prueba de luz.'); process.exit(0); }
const engine = process.argv[2] || 'auto', shots = process.env.SHOTS || '', out = shots ? shots + '/luz-' + engine : '';
const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: {} });
const URL = 'http://127.0.0.1:' + srv.port + '/';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = []; const ok = (n, c) => { console.log((c ? 'bien ' : 'MAL  ') + n); if (!c) errors.push('falló: ' + n); };
async function open(name) {
  const p = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1100, height: 780 } })).newPage();
  p.on('pageerror', (e) => errors.push(name + ' pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_TUNNEL|fonts/.test(m.text())) errors.push(name + ': ' + m.text()); });
  await p.addInitScript((eng) => { localStorage.setItem('diario-v4', JSON.stringify({ v: 4, skin: 'carmesi' })); localStorage.setItem('diario-gfx', JSON.stringify({ q: 'alta', engine: eng === '2d' ? '2d' : 'auto' })); }, engine);
  await p.goto(URL); await p.waitForTimeout(1200);
  return p;
}
const act = (p, a, v) => p.evaluate(([a, v]) => { const el = document.querySelector('[data-act="' + a + '"]' + (v ? '[data-v="' + v + '"]' : '')); if (!el) throw new Error('falta ' + a + ' ' + (v || '')); el.click(); }, [a, v]);
const scr = (p, x, y) => p.evaluate(([x, y]) => { const cv = document.getElementById('mapCv'), r = cv.getBoundingClientRect(), v = Mapas._view(); return [r.left + v.x + x * v.s, r.top + v.y + y * v.s, v.s]; }, [x, y]);
const drag = async (p, a, b) => { const q0 = await scr(p, a[0], a[1]), q1 = await scr(p, b[0], b[1]); await p.mouse.move(q0[0], q0[1]); await p.mouse.down(); await p.mouse.move(q1[0], q1[1], { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(150); };
const click = async (p, x, y) => { const q = await scr(p, x, y); await p.mouse.click(q[0], q[1]); await p.waitForTimeout(150); };
const pick = (p, sel, v) => p.evaluate(([sel, v]) => { const el = document.querySelector(sel); if (!el) throw new Error('falta ' + sel); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);
const fogBit = (mm, x, y) => { const b = Buffer.from(mm.fog.cells || '', 'base64'), i = y * mm.cols + x; return (b[i >> 3] >> (i & 7)) & 1; };

/* ---------- 1) En tu copia ---------- */
const p = await open('local');
await act(p, 'mapsopen'); await p.waitForTimeout(200); await act(p, 'mapnew');
await p.evaluate(() => { const f = document.querySelector('[data-form="mapnew"]'); f.elements.name.value = 'Cripta de noche'; f.elements.size.value = '24x18'; f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
await p.waitForTimeout(1500);
const M = () => p.evaluate(() => Object.values(Mapas._maps())[0]);
// una habitación y una antorcha en su esquina
await act(p, 'mapwalls'); await act(p, 'mapwallroom', '1'); await act(p, 'mapwallt', 'wall');
await drag(p, [3, 3], [15, 13]);
await act(p, 'mapassets'); await p.waitForTimeout(150); await act(p, 'mapascat', 'luz');
ok('objetos de luz nuevos: vela, farol y luz invisible', await p.evaluate(() => ['vela', 'farol', 'luz'].every((k) => document.querySelector('[data-act="mapaspick"][data-v="' + k + '"]'))));
await act(p, 'mapaspick', 'antorcha'); await click(p, 4.5, 4.5);
let m = await M(); ok('antorcha puesta', m.strokes.some((k) => k.a === 'antorcha'));
// la escena: visión y noche
await act(p, 'mapmode', 'niebla'); await p.waitForTimeout(150);
await p.evaluate(() => { const c = document.getElementById('mapVisOn'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
await act(p, 'mapsctab', 'luz'); await p.waitForTimeout(100);
ok('pestaña de luz y hora', await p.evaluate(() => !!document.querySelector('[data-act="maptime"][data-v="noche"]') && !!document.getElementById('mapAmb')));
await act(p, 'maptime', 'noche'); await p.waitForTimeout(150);
m = await M(); ok('es de noche', m.light.time === 'noche');
// una ficha en medio de la habitación y un enemigo en la esquina oscura
await act(p, 'mapmode', 'jugar'); await act(p, 'mapputme'); await p.waitForTimeout(200);
m = await M(); const me = m.tokens[0];
await drag(p, [me.x + 0.5, me.y + 0.5], [9.5, 8.5]); await p.waitForTimeout(200);
await p.evaluate(() => { const mp = Object.values(Mapas._maps())[0]; mp.tokens.push({ id: 'tnpc1', kind: 'npc', name: 'Sombra', x: 13, y: 11, s: 1, color: '#6a3fa0', by: 'yo' }); Mapas._viewAs(true); });
await p.waitForTimeout(250);
ok('ambiente de noche: oscuridad', await p.evaluate(() => Mapas._vis().il.amb === 0 && Mapas._vis().il.lights.length === 1));
ok('el enemigo en la oscuridad no se ve', await p.evaluate(() => Mapas._shown('tnpc1') === false));
m = await M(); ok('se descubre lo iluminado, no la esquina oscura', fogBit(m, 5, 5) === 1 && fogBit(m, 13, 11) === 0);
if (out) await p.screenshot({ path: out + '-noche.png' });
// tu ficha lleva una antorcha: ahora lo ve
await p.evaluate(() => Mapas._viewAs(false)); await click(p, 10, 9); await p.waitForTimeout(150);
ok('panel de la ficha con luz y visión en la oscuridad', await p.evaluate(() => !!document.querySelector('[data-toklt]') && !!document.querySelector('[data-toksn]') && !!document.querySelector('.tok-lit')));
await pick(p, '[data-toklt]', 'antorcha'); await p.waitForTimeout(200);
m = await M(); ok('la ficha lleva antorcha', m.tokens[0].lt && m.tokens[0].lt.b === 4);
await p.evaluate(() => Mapas._viewAs(true)); await p.waitForTimeout(250);
ok('con su luz ve al enemigo', await p.evaluate(() => Mapas._shown('tnpc1') === true));
m = await M(); ok('y descubre la esquina', fogBit(m, 13, 11) === 1);
if (out) await p.screenshot({ path: out + '-antorcha.png' });
// sin luz pero con visión en la oscuridad (18 m)
await p.evaluate(() => Mapas._viewAs(false)); await click(p, 10, 9);
await pick(p, '[data-toklt]', ''); await pick(p, '[data-toksn]', '60'); await p.waitForTimeout(200);
m = await M(); ok('visión en la oscuridad puesta', !m.tokens[0].lt && m.tokens[0].sn && m.tokens[0].sn.dv === 60);
await p.evaluate(() => Mapas._viewAs(true)); await p.waitForTimeout(250);
ok('con visión en la oscuridad también lo ve', await p.evaluate(() => Mapas._shown('tnpc1') === true));
if (out) await p.screenshot({ path: out + '-vision-oscuridad.png' });
// de día se ve todo
await p.evaluate(() => Mapas._viewAs(false)); await act(p, 'mapmode', 'niebla'); await act(p, 'mapsctab', 'luz'); await act(p, 'maptime', 'dia'); await p.waitForTimeout(150);
ok('de día: luz brillante', await p.evaluate(() => Mapas._vis().il.amb === 2));
// lluvia
await act(p, 'mapsctab', 'clima'); await p.waitForTimeout(100); await act(p, 'mapwx', 'lluvia'); await p.waitForTimeout(500);
m = await M(); ok('llueve', m.light.wx === 'lluvia');
// con WebGL por software el primer cuadro de la lluvia puede tardar: se espera hasta 4 s
let rain = false; for (let i = 0; i < 12 && !rain; i++) { rain = await p.evaluate(() => { const c = document.getElementById('mapWx'); if (!c || c.hidden || !c.width) return false; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4 * 7) if (d[i]) n++; return n > 50; }); if (!rain) await p.waitForTimeout(350); }
ok('la lluvia se dibuja encima del mapa', rain);
if (out) await p.screenshot({ path: out + '-lluvia.png' });
await act(p, 'mapwx', 'niebla'); await p.waitForTimeout(300);
ok('la niebla espesa limita la vista a 9 m', await p.evaluate(() => Vision.effRange(Object.values(Mapas._maps())[0]) === 6));
await act(p, 'mapwx', 'despejado'); await p.waitForTimeout(150);
ok('despejado apaga el clima', await p.evaluate(() => document.getElementById('mapWx').hidden));
// la luz de un objeto se cambia desde la barra de selección
await act(p, 'mapmode', 'dibujar'); await act(p, 'maptool', 'select'); await click(p, 4.5, 4.5);
ok('barra con la luz del objeto', await p.evaluate(() => !!document.getElementById('selLight')));
await pick(p, '#selLight', 'off'); await p.waitForTimeout(150);
m = await M(); ok('apagar la antorcha', m.strokes.find((k) => k.a === 'antorcha').lt.off === 1);

/* ---------- 2) En una campaña ---------- */
const dm = await open('DM');
await dm.evaluate(() => Sala.create('Prueba luz', 'clave1234'));
await dm.waitForFunction(() => Sala.status() === 'on' && Sala.room() && Sala.room().code);
const code = await dm.evaluate(() => Sala.room().code);
await dm.evaluate(() => document.querySelector('[data-act="mapsopen"]').click()); await dm.waitForTimeout(200);
await dm.evaluate(() => { document.querySelector('[data-act="mapnew"][data-v="dm"]').click(); const f = document.querySelector('[data-form="mapnew"]'); f.elements.name.value = 'Bosque'; f.elements.size.value = '40x30'; f.elements.hidden.checked = false; f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
await dm.waitForFunction(() => Sala.room().maps && Sala.room().maps.length === 1, null, { timeout: 5000 });
const mid = await dm.evaluate(() => Sala.room().maps[0].id);
await dm.evaluate((id) => { const mp = Mapas._maps()[id]; Sala.send({ t: 'scene.set', id }); Sala.send({ t: 'map.vis', id, on: true }); Sala.send({ t: 'map.light', id, light: { time: 'noche', wx: 'nieve' } }); Sala.send({ t: 'map.add', id, strokes: [{ id: 'kfogata1', k: 'asset', a: 'fogata', l: mp.layers[0].id, pts: [20.5, 15.5], s: 1, h: 1 }] }); }, mid);
await dm.waitForTimeout(600);
const pj = await open('PJ');
await pj.evaluate((c) => Sala.join(c), code);
await pj.waitForFunction(() => Sala.status() === 'on' && Sala.room() && Sala.room().scene, null, { timeout: 8000 });
await pj.evaluate(() => document.querySelector('[data-act="mapsopen"]').click());
await pj.waitForFunction(() => document.querySelector('#mapCv'), null, { timeout: 8000 }); await pj.waitForTimeout(800);
await pj.evaluate((id) => Sala.send({ t: 'tok.add', id, tok: { kind: 'pc', name: 'Lyra', x: 22, y: 15, color: '#2f5d8a' } }), mid);
await pj.waitForTimeout(900);
const pm = await pj.evaluate((id) => Mapas._maps()[id], mid);
ok('al jugador le llega la noche y la nieve', pm.light.time === 'noche' && pm.light.wx === 'nieve');
ok('descubre lo que alumbra la fogata', fogBit(pm, 18, 15) === 1 && fogBit(pm, 34, 15) === 0);
ok('ve el ambiente oscuro', await pj.evaluate((id) => Mapas._vis(id).il.amb === 0, mid));
ok('el aviso de luz del jugador', await pj.evaluate(() => !!document.querySelector('.lit-chip')));
await pj.waitForTimeout(400);
if (out) { await pj.screenshot({ path: out + '-pj-fogata.png' }); await dm.screenshot({ path: out + '-dm-fogata.png' }); }

await browser.close(); await srv.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('Luz: todo bien (' + engine + ')');
