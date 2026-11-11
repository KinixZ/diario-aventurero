// Hoja más ágil (módulo 20) en un Chromium real: encabezado con Buscar y Menú, la hoja resumen (PG grandes con Daño,
// Curar y Temporales; CA, iniciativa, velocidad, competencia, percepción pasiva e inspiración), las tres partes
// (Características con salvaciones, Habilidades, Competencias), el botón Acciones (teclado de daño, dados, descanso,
// usar), deshacer durante 5 s, y el buscador de todo el diario.
// Con SHOTS=carpeta guarda capturas. Uso: npm run build && node tests/web/hoja.pw.mjs
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { startServer } from '../../server/index.mjs';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { console.log('Sin playwright: se salta la prueba de la hoja.'); process.exit(0); }
const PKG = process.env.DIARIO_PAQUETE || '/mnt/user-data/uploads/6be5287b-diario-5e.json';
if (!existsSync(PKG)) { console.log('Sin el paquete de 5etools: se salta la prueba de la hoja.'); process.exit(0); }
const shots = process.env.SHOTS || '';
const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: {} });
const URL = 'http://127.0.0.1:' + srv.port + '/';
const browser = await chromium.launch();
const errors = []; const ok = (n, c) => { console.log((c ? 'bien ' : 'MAL  ') + n); if (!c) errors.push('falló: ' + n); };
const LIB = JSON.parse(readFileSync(PKG, 'utf8'));
const PAL = { id: 'p', name: 'Lyra', level: 11, method: 'array', base: { str: 15, dex: 10, con: 14, int: 8, wis: 12, cha: 13 },
  ch: { cls: 'Paladin|XPHB', sub: 'Oathbreaker|DMG', race: 'Aasimar|XPHB', bg: 'Soldier|XPHB', bgAbil: { alt: 0, picks: ['str', 'con'] }, 'feat:asi4': 'Lucky|XPHB' },
  rt: { quick: ['f:Lucky'], items: [{ id: 'ls', n: 'Espada larga', ref: 'item|Longsword|XPHB', k: 'wpn', ic: 'i-sword', w: 1, h: 3, slot: 'main', eq: 'main' }] } };
async function open(name, w, h) {
  const p = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: w, height: h } })).newPage();
  p.on('pageerror', (e) => errors.push(name + ' pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_TUNNEL|fonts/.test(m.text())) errors.push(name + ': ' + m.text()); });
  await p.addInitScript(([c]) => { if (!sessionStorage.getItem('pw-init')) { sessionStorage.setItem('pw-init', '1'); localStorage.setItem('diario-v4', JSON.stringify({ v: 4, skin: 'carmesi', chars: [c], active: 'p', tab: 'personaje', left: 'personaje' })); localStorage.setItem('diario-fx', JSON.stringify({ m: 'off' })); } }, [PAL]);
  await p.goto(URL); await p.waitForTimeout(1000);
  await p.evaluate(async (lib) => { await new Promise((res) => { const r = indexedDB.open('diario5e', 2); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); }; r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(lib, 'lib'); t.oncomplete = () => { r.result.close(); res(); }; }; }); }, LIB);
  await p.reload(); await p.waitForTimeout(2500); await p.evaluate(() => { const c = document.querySelector('[data-act="open"]'); if (c) c.click(); }); await p.waitForTimeout(800);
  return p;
}
const shot = (p, n) => shots ? p.screenshot({ path: shots + '/hoja-' + n + '.png' }) : null;
const click = (p, sel) => p.evaluate((s) => { const b = document.querySelector(s); if (!b) throw new Error('falta ' + s); b.click(); }, sel);
const vis = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e || e.hidden) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).display !== 'none'; }, sel);
const pg = (p) => p.evaluate(() => Diario.rt(Diario.cur()).hp);

const p = await open('pj', 390, 844);
// --- Encabezado ---
ok('el encabezado tiene Buscar y Menú con nombre', await p.evaluate(() => [...document.querySelectorAll('#head .h-btn span')].map((s) => s.textContent).join() === 'Buscar,Menú'));
ok('el punto rojo del nivel avisa que faltan elecciones', await vis(p, '#hDot'));
ok('el menú empieza cerrado', !(await vis(p, '#hMenu')));
await click(p, '[data-act="hmenu"]'); await p.waitForTimeout(200);
ok('el menú abre con Campaña, elecciones, personaje, Ajustes y cerrar', await p.evaluate(() => { const m = document.getElementById('hMenu'); return !m.hidden && ['campanas', 'levelup', 'hmchars', 'settings', 'close'].every((a) => m.querySelector('[data-act="' + a + '"]')) && /Completar elecciones/.test(document.getElementById('hmLvlT').textContent); }));
ok('el botón Menú dice que está abierto', await p.evaluate(() => document.querySelector('[data-act="hmenu"]').getAttribute('aria-expanded') === 'true'));
await shot(p, 'menu');
await p.keyboard.press('Escape'); await p.waitForTimeout(100);
ok('Esc cierra el menú', !(await vis(p, '#hMenu')));
// --- Hoja resumen ---
ok('los PG grandes con Daño, Curar y Temporales', await p.evaluate(() => { const h = document.querySelector('#pPersonaje .pv'); return !!h && ['dmg', 'heal', 'temp'].every((m) => h.querySelector('[data-act="hpkey"][data-mode="' + m + '"]')); }));
ok('CA, Iniciativa, Velocidad, Competencia, Perc. pasiva e Inspiración', await p.evaluate(() => { const t = document.querySelector('#pPersonaje .pv').textContent; return ['CA', 'Iniciativa', 'Velocidad', 'Competencia', 'Perc. pasiva', 'Inspiración'].every((x) => t.includes(x)); }));
ok('las tres partes de la hoja, Características primero', await p.evaluate(() => [...document.querySelectorAll('#pPersonaje .p-seg button')].map((b) => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')).join() === 'Características*,Habilidades,Competencias'));
ok('cada característica lleva su salvación', await p.evaluate(() => document.querySelectorAll('#pPersonaje .ab .ab-sv').length === 6 && document.querySelectorAll('#pPersonaje .ab .ab-sv.on').length === 2));
ok('en Características solo tus habilidades, con «Ver las 18»', await p.evaluate(() => { const n = document.querySelectorAll('#pPersonaje .skl-1 .line').length; return n > 0 && n < 18 && /Ver las 18/.test(document.getElementById('pPersonaje').textContent); }));
ok('las elecciones pendientes ya no ocupan la hoja (van al menú)', await p.evaluate(() => !document.querySelector('#pPersonaje .banner [data-act="levelup"]')));
await shot(p, 'resumen');
await click(p, '#pPersonaje [data-act="insp"]'); await p.waitForTimeout(100);
ok('Inspiración se marca con un toque', await p.evaluate(() => !!Diario.rt(Diario.cur()).insp));
await click(p, '[data-act="ptab"][data-v="hab"]'); await p.waitForTimeout(150);
ok('Habilidades muestra las 18', await p.evaluate(() => document.querySelectorAll('#pPersonaje .skl:not(.skl-1) .line').length === 18));
await click(p, '[data-act="ptab"][data-v="comp"]'); await p.waitForTimeout(150);
ok('Competencias: armaduras, armas, idiomas, tamaño, retrato e identidad', await p.evaluate(() => { const t = document.getElementById('pPersonaje').textContent; return ['Armaduras', 'Armas', 'Idiomas', 'Tamaño'].every((x) => t.includes(x)) && !!document.querySelector('#pPersonaje .id-card'); }));
await click(p, '[data-act="ptab"][data-v="car"]'); await p.waitForTimeout(150);
// --- Acciones ---
ok('el botón Acciones está a mano y su menú cerrado', (await vis(p, '#fabBtn')) && !(await vis(p, '#fabMenu')));
await click(p, '#fabBtn'); await p.waitForTimeout(200);
ok('Acciones abre Daño o curación, Tirar un dado, Descanso y Usar', await p.evaluate(() => ['hpkey', 'dicesheet', 'restsheet', 'usesheet'].every((a) => document.querySelector('#fabMenu [data-act="' + a + '"]')) && document.getElementById('fabBtn').textContent.includes('Cerrar')));
await shot(p, 'acciones');
await click(p, '#fabMenu [data-act="hpkey"]'); await p.waitForTimeout(200);
ok('al abrir una hoja, el botón Acciones se aparta', !(await vis(p, '#fabWrap')) && !(await vis(p, '#fabMenu')));
const hp0 = await pg(p);
for (const k of ['1', '2']) await click(p, '[data-act="hkkey"][data-v="' + k + '"]');
ok('el teclado muestra cuánto quedará', await p.evaluate((h) => document.getElementById('hpBody').textContent.includes((h - 12) + ' PG'), hp0));
await shot(p, 'teclado');
await click(p, '[data-act="hkgo"]'); await p.waitForTimeout(300);
ok('recibir 12 de daño baja 12 PG', (await pg(p)) === hp0 - 12);
ok('aparece Deshacer y el botón Acciones sube para no taparse', (await vis(p, '#undoToast')) && await p.evaluate(() => document.body.classList.contains('undo-on') && document.getElementById('fabBtn').getBoundingClientRect().bottom <= document.getElementById('undoToast').getBoundingClientRect().top + 1));
await shot(p, 'deshacer');
await click(p, '[data-act="undo"]'); await p.waitForTimeout(200);
ok('Deshacer devuelve los PG', (await pg(p)) === hp0);
await click(p, '#pPersonaje [data-act="hpkey"][data-mode="heal"]'); await p.waitForTimeout(150);
ok('Curar abre el teclado en Curación', await p.evaluate(() => document.querySelector('#hpBody [data-act="hkmode"][data-v="heal"]').getAttribute('aria-pressed') === 'true'));
await click(p, '#hpSheet [data-act="closesheet"]'); await p.waitForTimeout(150);
await click(p, '#fabBtn'); await click(p, '#fabMenu [data-act="dicesheet"]'); await p.waitForTimeout(150);
await click(p, '[data-act="dkroll"][data-v="1d20"]'); await p.waitForTimeout(200);
ok('Tirar un d20 da entre 1 y 20', await p.evaluate(() => { const n = +document.querySelector('#diceBody .dk-out b').textContent; return n >= 1 && n <= 20; }));
await p.fill('#dkIn', '2d6+3'); await click(p, '#dkForm button[type="submit"]'); await p.waitForTimeout(200);
ok('una tirada escrita (2d6+3) da entre 5 y 15', await p.evaluate(() => { const n = +document.querySelector('#diceBody .dk-out b').textContent; return n >= 5 && n <= 15; }));
await shot(p, 'dados');
await click(p, '#diceSheet [data-act="closesheet"]');
await click(p, '#fabBtn'); await click(p, '#fabMenu [data-act="usesheet"]'); await p.waitForTimeout(150);
ok('Usar muestra tu acceso rápido (Afortunado)', await p.evaluate(() => /Suerte|Afortunad|Lucky/.test(document.getElementById('useBody').textContent)));
await click(p, '#useSheet [data-act="closesheet"]');
await click(p, '#fabBtn'); await click(p, '#fabMenu [data-act="restsheet"]'); await p.waitForTimeout(150);
ok('Descanso ofrece corto y largo', await p.evaluate(() => !!document.querySelector('#restBody [data-act="short"]') && !!document.querySelector('#restBody [data-act="long"]')));
await click(p, '#restSheet [data-act="closesheet"]');
// --- Buscador ---
await click(p, '[data-act="gsearch"]'); await p.waitForTimeout(200);
await p.fill('#gsQ', 'escudo'); await p.waitForTimeout(400);
ok('buscar «escudo» encuentra conjuros en español con su nombre original', await p.evaluate(() => { const t = document.getElementById('gsRes').textContent; return /Escudo/.test(t) && /Shield/.test(t) && /Conjuros/i.test(t); }));
await click(p, '[data-act="gsf"][data-v="spell"]'); await p.waitForTimeout(150);
ok('el filtro Conjuros deja solo conjuros', await p.evaluate(() => (() => { const l = [...document.querySelectorAll('#gsRes .gs-g > .label')]; return l.length === 1 && /Conjuros/.test(l[0].textContent); })()));
await shot(p, 'buscar');
await p.evaluate(() => document.querySelector('#gsRes .gs-row[data-ref]').click()); await p.waitForTimeout(300);
ok('tocar un resultado abre su ficha y cierra el buscador', await p.evaluate(() => document.getElementById('searchSheet').hidden && !!document.querySelector('#grim .gdetail h2')));
await p.evaluate(() => document.querySelector('[data-act="tab"][data-tab="personaje"]').click()); await p.waitForTimeout(200);
// --- Horizontal y laptop ---
await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(400);
ok('en horizontal, Buscar y Menú siguen en el lomo', (await vis(p, '[data-act="gsearch"]')) && (await vis(p, '[data-act="hmenu"]')));
await shot(p, 'horizontal');
await p.setViewportSize({ width: 1280, height: 800 }); await p.waitForTimeout(500);
ok('en laptop, Acciones abajo a la derecha del libro', await p.evaluate(() => { const b = document.getElementById('fabBtn').getBoundingClientRect(); return !document.getElementById('fabWrap').hidden && b.left > innerWidth / 2 && b.bottom > innerHeight * 0.8; }));
await shot(p, 'laptop');
console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'SIN ERRORES');
await browser.close(); await srv.close();
process.exit(errors.length ? 1 : 0);
