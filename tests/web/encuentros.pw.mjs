// Estados del mapa y encuentros en un Chromium real:
// el DM arma un mapa en preparación, congela el movimiento en exploración, prepara un encuentro (enemigos a mano,
// una oleada que llega en la ronda 2), acomoda los enemigos y una zona de despliegue en el mapa y lo usa;
// el jugador se une, se acomoda en su zona y tira iniciativa en la app; el DM tira la de los enemigos y empieza;
// cada quien se mueve en su turno; en la ronda 2 llega la oleada; al terminar, el mapa vuelve a exploración.
// Uso: npm run build && node tests/web/encuentros.pw.mjs [auto|2d]
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { startServer } from '../../server/index.mjs';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { console.log('Sin playwright: se salta la prueba de encuentros.'); process.exit(0); }
const engine = process.argv[2] || 'auto', shots = process.env.SHOTS || '', out = shots ? shots + '/encuentros-' + engine : '';
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
const has = (p, sel) => p.evaluate((s) => !!document.querySelector(s), sel);
const scr = (p, x, y) => p.evaluate(([x, y]) => { const cv = document.getElementById('mapCv'), r = cv.getBoundingClientRect(), v = Mapas._view(); return [r.left + v.x + x * v.s, r.top + v.y + y * v.s, v.s]; }, [x, y]);
const drag = async (p, a, b) => { const q0 = await scr(p, a[0], a[1]), q1 = await scr(p, b[0], b[1]); await p.mouse.move(q0[0], q0[1]); await p.mouse.down(); await p.mouse.move(q1[0], q1[1], { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(250); };
const click = async (p, x, y) => { const q = await scr(p, x, y); await p.mouse.click(q[0], q[1]); await p.waitForTimeout(200); };
const pick = (p, sel, v) => p.evaluate(([sel, v]) => { const el = document.querySelector(sel); if (!el) throw new Error('falta ' + sel); if (el.type === 'checkbox') el.checked = !!v; else el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);
const until = (p, fn, arg, ms = 6000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const closeTok = (p) => p.evaluate(() => { const x = document.querySelector('[data-act="maptokx"]'); if (x) x.click(); });

/* ---------- El DM arma dos mapas: el puente en preparación y el camino donde está el grupo ---------- */
const dm = await open('DM');
await dm.evaluate(() => Sala.create('Prueba encuentros', 'clave1234'));
await dm.waitForFunction(() => Sala.status() === 'on' && Sala.room() && Sala.room().code);
const code = await dm.evaluate(() => Sala.room().code);
ok('la pestaña Encuentros es del DM', await dm.evaluate(() => !document.querySelector('#mesaTabs [data-v="encuentros"]').hidden));
await dm.evaluate(() => document.querySelector('[data-act="mapsopen"]').click()); await dm.waitForTimeout(200);
const mk = async (name, hide) => { await dm.evaluate(([nm, hd]) => { document.querySelector('[data-act="mapnew"][data-v="dm"]').click(); const f = document.querySelector('[data-form="mapnew"]'); f.elements.name.value = nm; f.elements.size.value = '24x18'; f.elements.hidden.checked = hd; f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }, [name, hide]); await dm.waitForTimeout(800); };
await mk('Puente', true);
ok('un mapa oculto empieza en preparación', await dm.evaluate(() => !!document.querySelector('[data-act="mapstate"][data-v="prep"][aria-pressed="true"]')));
ok('dibujar es una herramienta abierta encima', await dm.evaluate(() => !!document.querySelector('.tool-b[data-v="dibujar"][aria-pressed="true"]') && !document.getElementById('mapPal').hidden));
await act(dm, 'mapmode', 'jugar'); await dm.waitForTimeout(150);
ok('«Listo» guarda las herramientas', await dm.evaluate(() => document.getElementById('mapPal').hidden));
ok('el HUD de preparación', await has(dm, '.hud-row.st-prep [data-act="mapstate"][data-v="explore"]'));
await act(dm, 'mapmode', 'niebla'); await dm.waitForTimeout(150);
ok('Escena también es una herramienta, con su botón para cerrarla', await has(dm, '.sc-head [data-act="mapmode"][data-v="jugar"]'));
await act(dm, 'mapmode', 'jugar');
if (out) await dm.screenshot({ path: out + '-dm-prep.png' });
await dm.evaluate(() => document.querySelector('[data-act="mapback"]').click()); await dm.waitForTimeout(200);
await mk('Camino', false); await act(dm, 'mapmode', 'jugar');
await dm.waitForFunction(() => Sala.room().maps && Sala.room().maps.length === 2, null, { timeout: 5000 });
const ids = await dm.evaluate(() => { const r = Sala.room(); return { puente: r.maps.find((m) => m.name === 'Puente').id, camino: r.maps.find((m) => m.name === 'Camino').id }; });
await dm.evaluate((id) => Sala.send({ t: 'scene.set', id }), ids.camino); await dm.waitForTimeout(300);

/* ---------- El jugador entra y explora; el DM congela el movimiento ---------- */
const pj = await open('PJ');
await pj.evaluate((c) => Sala.join(c), code);
await pj.waitForFunction(() => Sala.status() === 'on' && Sala.room() && Sala.room().scene, null, { timeout: 8000 });
ok('el jugador no tiene la pestaña Encuentros', await pj.evaluate(() => document.querySelector('#mesaTabs [data-v="encuentros"]').hidden));
ok('el jugador no ve el mapa en preparación', await pj.evaluate(() => Sala.room().maps.length === 1));
await pj.evaluate(() => document.querySelector('[data-act="mapsopen"]').click());
await pj.waitForFunction(() => document.querySelector('#mapCv'), null, { timeout: 8000 }); await pj.waitForTimeout(800);
ok('el jugador ve el estado (sin poder cambiarlo)', await pj.evaluate(() => !!document.querySelector('.map-st.st-explore') && !document.querySelector('[data-act="mapstate"]')));
await pj.evaluate((id) => Sala.send({ t: 'tok.add', id, tok: { kind: 'pc', name: 'Lyra', x: 5, y: 5, color: '#2f5d8a' } }), ids.camino);
await pj.waitForTimeout(700);
await act(dm, 'mapfreeze'); await dm.waitForTimeout(500);
ok('congelado: el jugador lo ve', await until(pj, () => !!document.querySelector('.hud-st.frozen')));
await drag(pj, [5.5, 5.5], [9.5, 5.5]); await pj.waitForTimeout(400);
let lyra = await pj.evaluate((id) => Mapas._maps()[id].tokens.find((t) => t.name === 'Lyra'), ids.camino);
ok('congelado: su ficha no se mueve', lyra.x === 5);
ok('congelado: le dice por qué', await pj.evaluate(() => /detuvo el movimiento/.test(document.getElementById('salaToast').textContent)));
if (out) await pj.screenshot({ path: out + '-pj-congelado.png' });
await act(dm, 'mapfreeze'); await dm.waitForTimeout(500);
await closeTok(pj); await drag(pj, [5.5, 5.5], [9.5, 5.5]); await pj.waitForTimeout(500);
lyra = await pj.evaluate((id) => Mapas._maps()[id].tokens.find((t) => t.name === 'Lyra'), ids.camino);
ok('descongelado: se mueve', lyra.x === 9);

/* ---------- El DM prepara el encuentro ---------- */
await dm.evaluate(() => Mesa.show('encuentros')); await dm.waitForTimeout(200);
await act(dm, 'encnew'); await dm.waitForTimeout(300);
await pick(dm, '[data-encf="name"]', 'Emboscada en el puente');
await pick(dm, '[data-encf="map"]', ids.puente); await dm.waitForTimeout(200);
await dm.evaluate(() => { document.getElementById('encCount').value = '3'; const f = document.querySelector('[data-form="enchand"]'); f.elements.name.value = 'Goblin'; f.elements.ac.value = '15'; f.elements.hp.value = '7'; f.elements.init.value = '2'; f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
await dm.waitForTimeout(300);
ok('tres goblins en el encuentro', await dm.evaluate(() => document.querySelectorAll('.enc-npc').length === 3 && /Goblin 3/.test(document.querySelector('.enc-npcs').innerHTML)));
await act(dm, 'encwadd'); await dm.waitForTimeout(200);
await pick(dm, '[data-encw="name"][data-n="2"]', 'Refuerzos'); await pick(dm, '[data-encw="round"][data-n="2"]', '2');
await dm.evaluate(() => { const s = [...document.querySelectorAll('[data-encn="wave"]')].pop(); s.value = '2'; s.dispatchEvent(new Event('change', { bubbles: true })); });
ok('el encuentro se guarda en la campaña', await until(dm, () => { const e = (Sala.room().encs || [])[0]; return !!e && e.n === 3 && e.waves === 1 && e.map; }));
if (out) await dm.screenshot({ path: out + '-dm-ficha.png' });

/* ---------- Lo acomoda en el mapa: enemigos y una zona de despliegue ---------- */
await dm.evaluate(() => document.querySelector('.enc-onmap [data-act="encplace"]').click());
ok('se abre el mapa con el encuentro', await until(dm, (id) => Mapas.cur() === id && Mapas._enc() && document.querySelector('.enc-tray'), ids.puente));
await click(dm, 16.5, 5.5); await click(dm, 17.5, 6.5); await click(dm, 18.5, 9.5);
let enc = await dm.evaluate(() => Encuentros.get(Mapas._enc().id));
ok('los tres enemigos con su lugar', enc.npcs.every((d) => d.x != null) && enc.npcs[0].x === 16 && enc.npcs[0].y === 5);
await act(dm, 'mapenck', 'deploy'); await dm.waitForTimeout(150);
await drag(dm, [1.5, 1.5], [3.5, 3.5]);
await pick(dm, '#mapEncZName', 'Orilla'); await dm.waitForTimeout(150);
enc = await dm.evaluate(() => Encuentros.get(Mapas._enc().id));
ok('zona de despliegue de 3 × 3', enc.deploy.length === 1 && enc.deploy[0].w === 3 && enc.deploy[0].h === 3 && enc.deploy[0].name === 'Orilla');
if (out) await dm.screenshot({ path: out + '-dm-colocar.png' });
await act(dm, 'mapencdone'); await dm.waitForTimeout(300);
ok('guardado con todo en su lugar', await until(dm, () => { const e = Sala.room().encs[0]; return e.placed === 3 && e.deploy === 1; }));

/* ---------- Lo usa: el mapa pasa a combate; el jugador se une y se acomoda ---------- */
await act(dm, 'mapencs'); await dm.waitForTimeout(200);
await dm.evaluate(() => document.querySelector('.encpop [data-act="encuse"]').click());
ok('el puente pasa a combate', await until(dm, (id) => { const m = Sala.room().maps.find((x) => x.id === id); return m && m.state === 'combat'; }, ids.puente));
ok('llegan dos goblins (la oleada 2 espera)', await until(dm, (id) => Sala.room().npcs.length === 2 && Mapas._maps()[id].tokens.filter((t) => t.kind === 'npc').length === 2, ids.puente));
ok('el jugador recibe la invitación', await until(pj, () => !!document.querySelector('#salaToast [data-act="mapjoin"]')));
await pj.evaluate(() => document.querySelector('#salaToast [data-act="mapjoin"]').click());
ok('se une: se abre el puente', await until(pj, (id) => Mapas.cur() === id && Mapas._maps()[id] && Mapas._maps()[id].tokens.some((t) => t.name === 'Lyra'), ids.puente, 8000));
await pj.waitForTimeout(500);
lyra = await pj.evaluate((id) => Mapas._maps()[id].tokens.find((t) => t.name === 'Lyra'), ids.puente);
ok('llega dentro de su zona', lyra.x >= 1 && lyra.x <= 3 && lyra.y >= 1 && lyra.y <= 3);
ok('ve la zona de despliegue y el aviso', await pj.evaluate((id) => Mapas._maps()[id].trig.some((z) => z.k === 'despliegue') && !!document.querySelector('.hud-st.dep') && !!document.querySelector('.map-st.st-combat'), ids.puente));
await closeTok(pj); await drag(pj, [lyra.x + 0.5, lyra.y + 0.5], [10.5, 8.5]); await pj.waitForTimeout(400);
let l2 = await pj.evaluate((id) => Mapas._maps()[id].tokens.find((t) => t.name === 'Lyra'), ids.puente);
ok('fuera de la zona no se acomoda', l2.x === lyra.x && l2.y === lyra.y);
await closeTok(pj); await drag(pj, [lyra.x + 0.5, lyra.y + 0.5], [3.5, 3.5]); await pj.waitForTimeout(500);
l2 = await pj.evaluate((id) => Mapas._maps()[id].tokens.find((t) => t.name === 'Lyra'), ids.puente);
ok('dentro de la zona sí', l2.x === 3 && l2.y === 3);
ok('puede tirar iniciativa en la app', await has(pj, '.hud-init [data-act="salaroll"][data-v="n"]'));
if (out) await pj.screenshot({ path: out + '-pj-despliegue.png' });
await act(pj, 'salaroll', 'n');
ok('su iniciativa tirada', await until(pj, () => { const r = Sala.room(), m = r.members.find((x) => x.id === r.you); return m.init != null && m.init >= 1 && m.init <= 20; }));

/* ---------- El DM tira la de los enemigos y empieza; cada quien en su turno; llega la oleada ---------- */
await dm.waitForTimeout(300);
ok('el DM ve el despliegue', await has(dm, '.hud-st.dep'));
await act(dm, 'mapnpcinit');
ok('los goblins tienen iniciativa (la misma)', await until(dm, () => { const n = Sala.room().npcs; return n.length === 2 && n.every((x) => x.init != null) && n[0].init === n[1].init; }));
if (out) await dm.screenshot({ path: out + '-dm-despliegue.png' });
await act(dm, 'salaturn', 'start');
ok('empieza: ronda 1 y sin zona de despliegue', await until(pj, (id) => Sala.room().round === 1 && !Mapas._maps()[id].trig.some((z) => z.k === 'despliegue'), ids.puente));
// que el turno no sea del jugador
const me = await pj.evaluate(() => Sala.room().you);
if (await dm.evaluate((m) => Sala.room().turnId === m, me)) { await act(dm, 'salaturn', 'next'); await dm.waitForTimeout(400); }
await closeTok(pj); await drag(pj, [3.5, 3.5], [5.5, 3.5]); await pj.waitForTimeout(400);
l2 = await pj.evaluate((id) => Mapas._maps()[id].tokens.find((t) => t.name === 'Lyra'), ids.puente);
ok('fuera de su turno no se mueve', l2.x === 3);
ok('el HUD le dice que espere', await has(pj, '.hud-st.wait'));
for (let i = 0; i < 4 && await dm.evaluate((m) => Sala.room().turnId !== m, me); i++) { await act(dm, 'salaturn', 'next'); await dm.waitForTimeout(400); }
await closeTok(pj); await drag(pj, [3.5, 3.5], [5.5, 3.5]); await pj.waitForTimeout(500);
l2 = await pj.evaluate((id) => Mapas._maps()[id].tokens.find((t) => t.name === 'Lyra'), ids.puente);
ok('en su turno sí se mueve', l2.x === 5);
for (let i = 0; i < 5 && await dm.evaluate(() => Sala.room().round < 2); i++) { await act(dm, 'salaturn', 'next'); await dm.waitForTimeout(400); }
ok('ronda 2: llega la oleada', await until(dm, (id) => Sala.room().npcs.length === 3 && Mapas._maps()[id].tokens.filter((t) => t.kind === 'npc').length === 3, ids.puente));
ok('al jugador le llega el tercer goblin', await until(pj, (id) => Mapas._maps()[id].tokens.filter((t) => t.kind === 'npc').length === 3, ids.puente));
if (out) await pj.screenshot({ path: out + '-pj-oleada.png' });
await act(dm, 'salaend');
ok('al terminar, el puente vuelve a exploración', await until(pj, (id) => { const m = Sala.room().maps.find((x) => x.id === id); return m && m.state === 'explore' && Sala.room().round === 0; }, ids.puente));
ok('el jugador ve exploración', await until(pj, () => !!document.querySelector('.map-st.st-explore')));

/* ---------- Con el bestiario cargado: buscar un monstruo y agregarlo con su ficha (opcional) ---------- */
const BEST = process.env.BESTIARIO || '/mnt/user-data/uploads/48880306-bestiario-5e.json';
if (existsSync(BEST)) {
  await dm.evaluate((j) => Bestiario._set(j), JSON.parse(readFileSync(BEST, 'utf8')));
  await dm.evaluate(() => Mesa.show('encuentros')); await dm.waitForTimeout(200);
  await dm.evaluate(() => document.querySelector('.enc-card [data-act="encopen"]').click()); await dm.waitForTimeout(300);
  await dm.evaluate(() => { const q = document.getElementById('encQ'); q.value = 'ogre'; q.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('encCount').value = '1'; });
  await dm.waitForTimeout(200);
  ok('busca en el Manual de Monstruos', await has(dm, '.enc-hits [data-act="encaddref"]'));
  await dm.evaluate(() => { const b = [...document.querySelectorAll('.enc-hits [data-act="encaddref"]')].find((x) => /^Og/i.test(x.textContent)) || document.querySelector('.enc-hits [data-act="encaddref"]'); b.click(); });
  ok('lo agrega con su ficha (grande: 2 × 2)', await until(dm, () => { const e = Object.values(Encuentros._full())[0]; const o = e && e.npcs.find((d) => d.ref && /Ogre/.test(d.ref)); return !!o && o.s === 2 && o.hpMax > 20; }, null, 8000));
} else console.log('(sin bestiario: se salta la búsqueda de monstruos)');

/* ---------- La pestaña: el encuentro sigue ahí para otra vez ---------- */
await dm.evaluate(() => { Mesa.show('encuentros'); const b = document.querySelector('[data-act="encback"]'); if (b) b.click(); }); await dm.waitForTimeout(300);
ok('la lista de encuentros', await dm.evaluate(() => document.querySelectorAll('.enc-card').length === 1 && /Emboscada en el puente/.test(document.querySelector('.enc-card').textContent)));
if (out) await dm.screenshot({ path: out + '-dm-lista.png' });

await browser.close(); await srv.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('Encuentros: todo bien (' + engine + ')');
