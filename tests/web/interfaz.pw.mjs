// Claridad de la interfaz (módulo 12) en un Chromium real: Ajustes por categorías (portada, una categoría, atrás),
// el mapa a pantalla completa, la barra del turno del jugador (verbos con nombre, lo que le queda del turno, Atacar abre
// el abanico en su ficha) en vertical y en horizontal, y el HUD del DM agrupado sin botones de solo icono.
// Con SHOTS=carpeta guarda capturas. Uso: npm run build && node tests/web/interfaz.pw.mjs
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { startServer } from '../../server/index.mjs';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { console.log('Sin playwright: se salta la prueba de la interfaz.'); process.exit(0); }
const PKG = process.env.DIARIO_PAQUETE || '/mnt/user-data/uploads/6be5287b-diario-5e.json';
if (!existsSync(PKG)) { console.log('Sin el paquete de 5etools: se salta la prueba de la interfaz.'); process.exit(0); }
const shots = process.env.SHOTS || '';
const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: {} });
const URL = 'http://127.0.0.1:' + srv.port + '/';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = []; const ok = (n, c) => { console.log((c ? 'bien ' : 'MAL  ') + n); if (!c) errors.push('falló: ' + n); };
const LIB = JSON.parse(readFileSync(PKG, 'utf8'));
const PAL = { id: 'p', name: 'Lyra', level: 11, method: 'array', base: { str: 15, dex: 10, con: 14, int: 8, wis: 12, cha: 13 }, ch: { cls: 'Paladin|XPHB', sub: 'Oathbreaker|DMG', race: 'Aasimar|XPHB', bg: 'Soldier|XPHB', bgAbil: { alt: 0, picks: ['str', 'con'] } }, rt: { items: [{ id: 'ls', n: 'Espada larga', ref: 'item|Longsword|XPHB', k: 'wpn', ic: 'i-sword', w: 1, h: 3, slot: 'main', eq: 'main' }] } };
async function open(name, w, h, ch) {
  const p = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: w, height: h } })).newPage();
  p.on('pageerror', (e) => errors.push(name + ' pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_TUNNEL|fonts/.test(m.text())) errors.push(name + ': ' + m.text()); });
  await p.addInitScript(([c]) => { if (!sessionStorage.getItem('pw-init')) { sessionStorage.setItem('pw-init', '1'); localStorage.setItem('diario-v4', JSON.stringify(c ? { v: 4, skin: 'carmesi', chars: [c], active: 'p', tab: 'personaje' } : { v: 4, skin: 'carmesi' })); localStorage.setItem('diario-fx', JSON.stringify({ m: 'off' })); } }, [ch]);
  await p.goto(URL); await p.waitForTimeout(1000);
  if (ch) {
    await p.evaluate(async (lib) => { await new Promise((res) => { const r = indexedDB.open('diario5e', 2); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); }; r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(lib, 'lib'); t.oncomplete = () => { r.result.close(); res(); }; }; }); }, LIB);
    await p.reload(); await p.waitForTimeout(2500); await p.evaluate(() => { const c = document.querySelector('[data-act="open"]'); if (c) c.click(); }); await p.waitForTimeout(800);
  }
  return p;
}
const shot = (p, n) => shots ? p.screenshot({ path: shots + '/interfaz-' + n + '.png' }) : null;
const until = (p, fn, arg, ms = 6000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
/* ¿Algún botón del HUD sin texto visible? (solo icono) */
const iconOnly = (p) => p.evaluate(() => [...document.querySelectorAll('#vttHud button, #mapBar button')].filter((b) => b.offsetParent && !b.textContent.trim() && !b.closest('.map-zoom')).map((b) => b.dataset.act + ':' + (b.dataset.v || '')).filter((x) => x !== 'mapback:'));

// --- Ajustes ---
const pj = await open('pj', 390, 844, PAL);
// --- Encabezado del libro (módulo 14): vitales, botones con nombre, recogido al bajar, lomo en horizontal ---
ok('el encabezado muestra PG y CA', await pj.evaluate(() => { const v = document.getElementById('hVit'); return !v.hidden && /PG/.test(v.textContent) && /CA/.test(v.textContent); }));
ok('Buscar y Menú tienen nombre (aria y texto); Campaña y Ajustes viven en el menú', await pj.evaluate(() => [...document.querySelectorAll('#head .h-btn')].map((b) => b.querySelector('span').textContent).join() === 'Buscar,Menú' && !!document.querySelector('#hMenu [data-act="campanas"]') && !!document.querySelector('#hMenu [data-act="settings"]')));
await pj.evaluate(() => { document.getElementById('scroll').scrollTop = 600; }); await pj.waitForTimeout(250);
ok('al bajar, el encabezado se recoge', await pj.evaluate(() => document.getElementById('head').classList.contains('fold') && document.getElementById('head').offsetHeight < 80));
await pj.evaluate(() => { document.getElementById('scroll').scrollTop = 0; }); await pj.waitForTimeout(250);
ok('al subir, vuelve a abrirse', await pj.evaluate(() => !document.getElementById('head').classList.contains('fold')));
await pj.setViewportSize({ width: 844, height: 390 }); await pj.waitForTimeout(400);
ok('en horizontal: lomo a la izquierda, separadores a la derecha y la campaña sigue cerrada', await pj.evaluate(() => { const h = document.getElementById('head').getBoundingClientRect(), s = document.getElementById('scroll').getBoundingClientRect(), r = document.getElementById('ribbons').getBoundingClientRect(); return h.right <= s.left + 2 && h.height > 300 && r.left >= s.right - 2 && getComputedStyle(document.getElementById('combat')).display === 'none'; }));
await shot(pj, 'libro-horizontal');
await pj.setViewportSize({ width: 390, height: 844 }); await pj.waitForTimeout(300);
await pj.evaluate(() => document.querySelector('[data-act="settings"]').click()); await pj.waitForTimeout(500);
ok('Ajustes abre en la portada con 7 categorías y Avanzado', await pj.evaluate(() => document.querySelectorAll('#setHome .set-cat').length === 8 && [...document.querySelectorAll('#settingsSheet section[data-cat]')].every((s) => s.hidden)));
ok('cada categoría dice lo que tiene puesto', await pj.evaluate(() => [...document.querySelectorAll('#setHome .set-cat small')].every((s) => s.textContent.trim().length > 3)));
await shot(pj, 'ajustes');
await pj.evaluate(() => document.querySelector('[data-act="setcat"][data-v="anim"]').click()); await pj.waitForTimeout(200);
ok('una categoría muestra solo sus secciones (animaciones y sonido)', await pj.evaluate(() => { const v = [...document.querySelectorAll('#settingsSheet section[data-cat]')].filter((s) => !s.hidden); return v.length === 2 && v.every((s) => s.dataset.cat === 'anim') && document.getElementById('setTitle').textContent === 'Animación y sonido'; }));
await pj.evaluate(() => document.querySelector('[data-act="sethome"]').click()); await pj.waitForTimeout(150);
ok('atrás vuelve a la portada', await pj.evaluate(() => !document.getElementById('setHome').hidden && document.getElementById('setTitle').textContent === 'Ajustes'));
await pj.evaluate(() => document.querySelector('[data-act="setcat"][data-v="avanzado"]').click()); await pj.waitForTimeout(150);
ok('lo técnico queda en Avanzado (servidor, imágenes de monstruos, créditos)', await pj.evaluate(() => [...document.querySelectorAll('#settingsSheet section[data-cat]')].filter((s) => !s.hidden).length === 3 && !document.getElementById('salaUrl').closest('section').hidden));
ok('las ayudas ya no van en letra manuscrita', await pj.evaluate(() => !/Caveat/.test(getComputedStyle(document.querySelector('#settingsSheet .note')).fontFamily)));
await pj.evaluate(() => document.querySelector('#settingsSheet [data-act="closesheet"]').click());

// --- Campaña con un mapa en combate ---
const dm = await open('dm', 1280, 800);
await dm.evaluate(() => Sala.create('Prueba', 'clave1234'));
await dm.waitForFunction(() => Sala.room() && Sala.room().code);
const code = await dm.evaluate(() => Sala.room().code);
await dm.evaluate(() => Sala.send({ t: 'map.save', map: { id: 'mapa-cripta', name: 'Cripta', cols: 20, rows: 14, grid: 'square', layers: [{ id: 'l1', name: 'Capa 1' }], strokes: [] } }));
await dm.waitForTimeout(300);
await dm.evaluate(() => { Sala.send({ t: 'npc.add', name: 'Goblin', ac: 15, hp: 7, initMod: 2 }); });
await dm.waitForFunction(() => Sala.room().npcs.length === 1);
const G = await dm.evaluate(() => Sala.room().npcs[0].id);
await dm.evaluate((g) => { Sala.send({ t: 'tok.add', id: 'mapa-cripta', tok: { kind: 'npc', name: 'Goblin', ref: g, x: 8, y: 6 } }); Sala.send({ t: 'scene.set', id: 'mapa-cripta' }); Sala.send({ t: 'map.state', id: 'mapa-cripta', state: 'explore' }); }, G);
await pj.evaluate((c) => Sala.join(c, { char: 'p' }), code);
await pj.waitForFunction(() => Sala.status() === 'on' && Sala.room() && Sala.room().npcs.length === 1, null, { timeout: 8000 });
await pj.evaluate(() => Sala.send({ t: 'tok.add', id: 'mapa-cripta', tok: { kind: 'pc', name: 'Lyra', x: 6, y: 6 } }));
for (const p of [pj, dm]) { await p.evaluate(() => { document.getElementById('combat').hidden = false; Mesa.show('mapas'); Mapas.open('mapa-cripta'); }); await p.waitForTimeout(1200); }
ok('con el mapa abierto, la barra de la campaña y las pestañas se recogen', await pj.evaluate(() => { const c = document.getElementById('combat'); return c.classList.contains('map-full') && getComputedStyle(c.querySelector('.mesa-tabs')).display === 'none'; }));
ok('el estado del mapa lleva su nombre', await pj.evaluate(() => { const s = document.querySelector('#mapBar .map-st span'); return !!s && getComputedStyle(s).display !== 'none' && /Exploración/.test(s.textContent); }));
await dm.evaluate(() => Sala.send({ t: 'map.state', id: 'mapa-cripta', state: 'combat' }));
await pj.evaluate(() => Sala.send({ t: 'init', value: 18 })); await dm.evaluate((g) => Sala.send({ t: 'init', id: g, value: 5 }), G);
await dm.waitForTimeout(400); await dm.evaluate(() => Sala.send({ t: 'turn', dir: 'start' }));
ok('en su turno, el jugador tiene Moverse, Atacar, Conjuro, Usar y Terminar turno', await until(pj, () => { const v = [...document.querySelectorAll('.pj-verbs .pj-verb')].map((b) => b.textContent); return v.length === 5 && /Moverse/.test(v[0]) && /Atacar/.test(v[1]) && /Conjuro/.test(v[2]) && /Usar/.test(v[3]) && /Terminar turno/.test(v[4]); }));
ok('ve lo que le queda del turno (acción, adicional, reacción) y su movimiento', await pj.evaluate(() => document.querySelectorAll('.pj-econ button').length === 3 && /9 m/.test(document.querySelector('.hud-mv').textContent)));
await pj.evaluate(() => document.querySelector('.pj-econ .e-b').click()); await pj.waitForTimeout(150);
ok('tocar «Adicional» la marca como usada', await pj.evaluate(() => document.querySelector('.pj-econ .e-b').getAttribute('aria-pressed') === 'true' && Diario.econ().b === true));
ok('el jugador no tiene botones de solo icono', (await iconOnly(pj)).length === 0);
await shot(pj, 'turno-vertical');
await pj.evaluate(() => document.querySelector('[data-act="mapverb"][data-v="Atacar"]').click()); await pj.waitForTimeout(400);
ok('Atacar abre el abanico en su ficha, ya con sus armas', await pj.evaluate(() => /Atacar/.test((document.querySelector('.vtt-fan .fan-c') || {}).textContent || '') && [...document.querySelectorAll('.vtt-fan .fan-i')].some((b) => /Espada/.test(b.textContent))));
await pj.keyboard.press('Escape'); await pj.waitForTimeout(150);
await pj.setViewportSize({ width: 844, height: 390 }); await pj.waitForTimeout(800); await pj.evaluate(() => { const b = document.querySelector('[data-act="mapfit"]'); if (b) b.click(); }); await pj.waitForTimeout(300);
ok('en horizontal la barra del turno va abajo, a lo ancho, y cabe', await pj.evaluate(() => { const h = document.getElementById('vttHud').getBoundingClientRect(), w = document.getElementById('mapWrap').getBoundingClientRect(); const vb = [...document.querySelectorAll('.pj-verb')].every((b) => { const r = b.getBoundingClientRect(); return r.right <= w.right + 1 && r.bottom <= w.bottom + 1; }); return h.width > w.width * 0.9 && h.bottom > w.bottom - 20 && vb; }));
ok('el mapa se encuadra en lo que queda libre (no detrás de la barra)', await pj.evaluate(() => { const v = Mapas._view(), m = Object.values(Mapas._maps()).find((x) => x.id === 'mapa-cripta'), cv = document.getElementById('mapCv').getBoundingClientRect(), h = document.getElementById('vttHud').getBoundingClientRect(); return cv.top + v.y + m.rows * v.s <= h.top + 2; }));
await shot(pj, 'turno-horizontal');
ok('el DM: Turno, Mesa y Reglas de este mapa, con nombre', await until(dm, () => [...document.querySelectorAll('.hud-grp .gl')].map((x) => x.textContent).join('|').match(/Turno.*\|Mesa\|Reglas de este mapa/)));
ok('el DM: Siguiente turno, Terminar combate y las reglas como opciones con nombre', await dm.evaluate(() => !!document.querySelector('.hud-next') && /Terminar combate/.test(document.querySelector('[data-act="salaend"]').textContent) && document.querySelectorAll('.rule-chip[data-act="maptac"]').length === 3));
ok('el DM no tiene botones de solo icono', (await iconOnly(dm)).length === 0);
await shot(dm, 'dm');
console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'SIN ERRORES');
await browser.close(); await srv.close();
process.exit(errors.length ? 1 : 0);
