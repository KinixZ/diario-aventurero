// Navegación (módulo 21) en un Chromium real: un solo menú de separadores (Hoja · Conjuros · Equipo · Rasgos · Mesa ·
// Más), «Más» con Notas, Bestiario, Grimorio y Ajustes, la Mesa dentro del mismo menú (sus secciones arriba y los
// separadores abajo), «Despertando el servidor» cuando tarda en abrir, el teléfono acostado y la laptop con el riel.
// Con SHOTS=carpeta guarda capturas. Uso: npm run build && node tests/web/navegacion.pw.mjs
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { startServer } from '../../server/index.mjs';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { console.log('Sin playwright: se salta la prueba de la navegación.'); process.exit(0); }
const PKG = process.env.DIARIO_PAQUETE || '/mnt/user-data/uploads/6be5287b-diario-5e.json';
if (!existsSync(PKG)) { console.log('Sin el paquete de 5etools: se salta la prueba de la navegación.'); process.exit(0); }
const shots = process.env.SHOTS || '';
const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: {} });
const URL = 'http://127.0.0.1:' + srv.port + '/';
const browser = await chromium.launch();
const errors = []; const ok = (n, c) => { console.log((c ? 'bien ' : 'MAL  ') + n); if (!c) errors.push('falló: ' + n); };
const LIB = JSON.parse(readFileSync(PKG, 'utf8'));
const PAL = { id: 'p', name: 'Lyra', level: 11, method: 'array', base: { str: 15, dex: 10, con: 14, int: 8, wis: 12, cha: 13 },
  ch: { cls: 'Paladin|XPHB', sub: 'Oathbreaker|DMG', race: 'Aasimar|XPHB', bg: 'Soldier|XPHB', bgAbil: { alt: 0, picks: ['str', 'con'] } } };
async function open(name, w, h, camp) {
  const p = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: w, height: h } })).newPage();
  p.on('pageerror', (e) => errors.push(name + ' pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_TUNNEL|ERR_CONNECTION|WebSocket|fonts/.test(m.text())) errors.push(name + ': ' + m.text()); });
  await p.addInitScript(([c, camp]) => { if (!sessionStorage.getItem('pw-init')) { sessionStorage.setItem('pw-init', '1'); localStorage.setItem('diario-v4', JSON.stringify({ v: 4, skin: 'carmesi', chars: [c], active: 'p', tab: 'personaje', left: 'personaje' })); localStorage.setItem('diario-fx', JSON.stringify({ m: 'off' })); if (camp) localStorage.setItem('diario-campanas', JSON.stringify(camp)); } }, [PAL, camp || null]);
  await p.goto(URL); await p.waitForTimeout(1000);
  await p.evaluate(async (lib) => { await new Promise((res) => { const r = indexedDB.open('diario5e', 2); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); }; r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(lib, 'lib'); t.oncomplete = () => { r.result.close(); res(); }; }; }); }, LIB);
  await p.reload(); await p.waitForTimeout(2500); await p.evaluate(() => { const c = document.querySelector('[data-act="open"]'); if (c) c.click(); }); await p.waitForTimeout(800);
  return p;
}
const shot = (p, n) => shots ? p.screenshot({ path: shots + '/nav-' + n + '.png' }) : null;
const click = (p, sel) => p.evaluate((s) => { const b = document.querySelector(s); if (!b) throw new Error('falta ' + s); b.click(); }, sel);
const vis = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e || e.hidden) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden'; }, sel);
const navShown = (p) => p.evaluate(() => [...document.querySelectorAll('#ribbons .ribbon')].filter((b) => b.getBoundingClientRect().width > 0 && getComputedStyle(b).display !== 'none').map((b) => b.textContent.trim()));
const pressed = (p) => p.evaluate(() => [...document.querySelectorAll('#ribbons .ribbon[aria-pressed="true"]')].filter((b) => b.getBoundingClientRect().width > 0).map((b) => b.dataset.tab).join());

// --- Teléfono ---
const p = await open('pj', 390, 844);
ok('un solo menú: Hoja, Conjuros, Equipo, Rasgos, Mesa y Más', (await navShown(p)).join() === 'Hoja,Conjuros,Equipo,Rasgos,Mesa,Más');
ok('los seis caben en una fila (nada se sale de la pantalla)', await p.evaluate(() => { const r = [...document.querySelectorAll('#ribbons .ribbon')].filter((b) => b.getBoundingClientRect().width > 0).map((b) => b.getBoundingClientRect()); return r.every((x) => Math.abs(x.top - r[0].top) < 12 && x.bottom <= innerHeight + 1); }));
ok('Hoja está puesta', (await pressed(p)) === 'personaje');
await shot(p, 'hoja');
await click(p, '#ribbons [data-act="nvmore"]'); await p.waitForTimeout(200);
ok('Más abre Notas, Bestiario, Grimorio y Ajustes', await p.evaluate(() => { const m = document.getElementById('nvMore'); return !m.hidden && [...m.querySelectorAll('.nv-tile b')].map((b) => b.textContent).join() === 'Notas,Bestiario,Grimorio,Ajustes'; }));
ok('mientras, Más se ve puesto y dice que está abierto', (await pressed(p)) === 'mas' && await p.evaluate(() => document.querySelector('#ribbons [data-act="nvmore"]').getAttribute('aria-expanded') === 'true'));
await shot(p, 'mas');
await click(p, '#nvMore [data-tab="notas"]'); await p.waitForTimeout(250);
ok('Notas abre su página y cierra Más; Más queda marcado', await p.evaluate(() => document.getElementById('nvMore').hidden && !document.querySelector('[data-panel="notas"]').hidden) && (await pressed(p)) === 'mas');
await click(p, '#ribbons [data-act="nvmore"]'); await p.waitForTimeout(150);
ok('la página en la que estás va marcada en Más', await p.evaluate(() => document.querySelector('#nvMore .nv-tile[aria-current="page"]').dataset.tab === 'notas'));
await p.keyboard.press('Escape'); await p.waitForTimeout(100);
ok('Esc cierra Más', !(await vis(p, '#nvMore')));
await click(p, '#ribbons [data-act="nvmore"]'); await click(p, '#nvMore .nv-more-scrim'); await p.waitForTimeout(100);
ok('tocar fuera cierra Más', !(await vis(p, '#nvMore')));
await click(p, '#ribbons [data-tab="conjuros"]'); await p.waitForTimeout(200);
ok('Conjuros desde el menú', (await pressed(p)) === 'conjuros' && await p.evaluate(() => !document.getElementById('pConjuros').hidden));
// --- La Mesa dentro del mismo menú ---
await click(p, '#ribbons [data-act="nvmesa"]'); await p.waitForTimeout(400);
ok('Mesa abre la campaña y deja ver el menú abajo', await p.evaluate(() => { const c = document.getElementById('combat').getBoundingClientRect(), n = document.getElementById('ribbons').getBoundingClientRect(); return !document.getElementById('combat').hidden && n.height > 40 && n.top >= c.bottom - 1 && n.bottom <= innerHeight + 1; }) && (await pressed(p)) === 'mesa');
ok('las secciones de la mesa van arriba', await p.evaluate(() => { const t = document.getElementById('mesaTabs').getBoundingClientRect(), h = document.querySelector('#combat .combat-h').getBoundingClientRect(); return t.top >= h.bottom - 1 && t.top < 200; }));
await click(p, '#mesaTabs [data-v="chat"]'); await p.waitForTimeout(200);
await shot(p, 'mesa');
await click(p, '#ribbons [data-tab="rasgos"]'); await p.waitForTimeout(300);
ok('otro separador sale de la mesa y abre su página', await p.evaluate(() => document.getElementById('combat').hidden && !document.getElementById('pRasgos').hidden) && (await pressed(p)) === 'rasgos');
await click(p, '#ribbons [data-act="nvmesa"]'); await p.waitForTimeout(300);
await click(p, '#ribbons [data-act="nvmore"]'); await click(p, '#nvMore [data-act="settings"]'); await p.waitForTimeout(300);
ok('Ajustes desde Más, estando en la mesa, se ve encima', await p.evaluate(() => document.getElementById('combat').hidden && !document.getElementById('settingsSheet').hidden));
await click(p, '#settingsSheet [data-act="closesheet"]'); await p.waitForTimeout(100);
await click(p, '#ribbons [data-tab="personaje"]'); await p.waitForTimeout(200);
// --- Teléfono acostado ---
await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(400);
ok('acostado: el menú es un riel a la derecha con los seis', await p.evaluate(() => { const r = document.getElementById('ribbons').getBoundingClientRect(); return r.left > innerWidth - 100 && [...document.querySelectorAll('#ribbons .ribbon')].filter((b) => b.getBoundingClientRect().width > 0).every((b) => b.getBoundingClientRect().bottom <= innerHeight + 1); }));
await click(p, '#ribbons [data-act="nvmore"]'); await p.waitForTimeout(200);
ok('acostado: Más sale junto al riel', await p.evaluate(() => { const m = document.querySelector('#nvMore .nv-more-p').getBoundingClientRect(); return m.right <= innerWidth - 60 && m.bottom <= innerHeight + 1; }));
await shot(p, 'acostado-mas');
await p.keyboard.press('Escape');
await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
await p.close();

// --- «Despertando el servidor»: una campaña guardada con un servidor que no contesta ---
const w = await open('wake', 390, 844, { url: 'ws://127.0.0.1:9/ws', active: 'ABCDEF', list: [{ code: 'ABCDEF', name: 'La Costa de la Espada', role: 'pj', token: 't', char: 'p', last: Date.now() }] });
await w.evaluate(() => Sala.resume && Sala.resume()); await w.waitForTimeout(200);
await click(w, '#ribbons [data-act="nvmesa"]'); await w.waitForTimeout(3800);
ok('si tarda, dice «Despertando el servidor» con una barra y los segundos', await w.evaluate(() => { const k = document.querySelector('#mesaHome .wake'); return !!k && /Despertando el servidor/.test(k.textContent) && /reintentando solo/.test(k.textContent) && /\d+ s/.test(k.querySelector('.wake-t').textContent); }));
const t0 = await w.evaluate(() => document.querySelector('.wake-t').textContent);
await w.waitForTimeout(1300);
ok('los segundos avanzan solos', await w.evaluate((t) => document.querySelector('.wake-t').textContent !== t, t0));
ok('y avisa que la hoja sigue funcionando', await w.evaluate(() => /tu hoja funciona sin conexión/.test(document.querySelector('.wake').textContent)));
await shot(w, 'despertando');
await click(w, '#mesaTabs [data-v="combate"]'); await w.waitForTimeout(1200);
ok('también en Combate', await w.evaluate(() => !!document.querySelector('#combat .wake')));
await w.close();

// --- Laptop ---
const L = await open('laptop', 1280, 800);
ok('laptop: un riel a la izquierda del libro con nombre', await L.evaluate(() => { const r = document.getElementById('ribbons').getBoundingClientRect(), b = document.getElementById('book').getBoundingClientRect(); return r.right <= b.left + 8 && r.width > 80; }));
ok('laptop: Hoja, Conjuros, Equipo, Rasgos, Notas, Bestiario, Grimorio, Mesa, Buscar y Ajustes', (await navShown(L)).join() === 'Hoja,Conjuros,Equipo,Rasgos,Notas,Bestiario,Grimorio,Mesa,Buscar,Ajustes');
ok('laptop: sin las contra-pestañas viejas', !(await vis(L, '#ctabs')));
ok('laptop: Hoja (izquierda) y Conjuros (derecha) marcados', (await pressed(L)) === 'personaje,conjuros');
await shot(L, 'laptop');
await click(L, '#ribbons [data-tab="grimorio"]'); await L.waitForTimeout(300);
ok('laptop: Grimorio va a la página izquierda con sus secciones dentro', await L.evaluate(() => !document.getElementById('grim').hidden && document.getElementById('pPersonaje').hidden && document.querySelectorAll('#grim .gsecs [data-act="gsec"]').length === 6) && (await pressed(L)) === 'conjuros,grimorio');
await click(L, '#grim [data-act="gsec"][data-v="condiciones"]'); await L.waitForTimeout(200);
ok('laptop: las secciones del grimorio cambian dentro de su página', await L.evaluate(() => /Condiciones/.test(document.querySelector('#grim .folio').textContent)));
await click(L, '#ribbons [data-tab="equipo"]'); await L.waitForTimeout(200);
ok('laptop: Equipo a la derecha sin tocar la izquierda', (await pressed(L)) === 'equipo,grimorio');
await shot(L, 'laptop-grimorio');
await click(L, '#ribbons [data-tab="personaje"]'); await L.waitForTimeout(200);
ok('laptop: Hoja vuelve a la izquierda', await L.evaluate(() => !document.getElementById('pPersonaje').hidden) && (await pressed(L)) === 'personaje,equipo');
await click(L, '#ribbons [data-act="gsearch"]'); await L.waitForTimeout(200);
ok('laptop: Buscar del riel abre el buscador', await L.evaluate(() => !document.getElementById('searchSheet').hidden));
console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'SIN ERRORES');
await browser.close(); await srv.close();
process.exit(errors.length ? 1 : 0);
