// Secciones compactas (módulo 22) en un Chromium real: conjuros en lista con los espacios en cada nivel, el equipo con
// su resumen arriba (CA, sintonizados, casillas y monedas), la figura compacta y la mochila en lista o cuadrícula,
// los rasgos con «Con usos» y «más», y las notas por sesión con fichas de personajes, lugares y pistas.
// Con SHOTS=carpeta guarda capturas. Uso: npm run build && node tests/web/secciones.pw.mjs
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { startServer } from '../../server/index.mjs';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { console.log('Sin playwright: se salta la prueba de las secciones.'); process.exit(0); }
const PKG = process.env.DIARIO_PAQUETE || '/mnt/user-data/uploads/6be5287b-diario-5e.json';
if (!existsSync(PKG)) { console.log('Sin el paquete de 5etools: se salta la prueba de las secciones.'); process.exit(0); }
const shots = process.env.SHOTS || '';
const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: {} });
const URL = 'http://127.0.0.1:' + srv.port + '/';
const browser = await chromium.launch();
const errors = []; const ok = (n, c) => { console.log((c ? 'bien ' : 'MAL  ') + n); if (!c) errors.push('falló: ' + n); };
const LIB = JSON.parse(readFileSync(PKG, 'utf8'));
const PAL = { id: 'p', name: 'Lyra', level: 11, method: 'array', base: { str: 15, dex: 10, con: 14, int: 8, wis: 12, cha: 13 },
  ch: { cls: 'Paladin|XPHB', sub: 'Oathbreaker|DMG', race: 'Aasimar|XPHB', bg: 'Soldier|XPHB', bgAbil: { alt: 0, picks: ['str', 'con'] }, 'feat:asi4': 'Lucky|XPHB' },
  rt: { notes: 'Conocimos a la Hermana Vela en el templo.', coins: { cp: 12, sp: 40, ep: 0, gp: 125, pp: 2 },
    items: [{ id: 'ls', n: 'Espada larga', ref: 'item|Longsword|XPHB', k: 'wpn', ic: 'i-sword', w: 1, h: 3, slot: 'main', eq: 'main' }, { id: 'pl', n: 'Placas', ref: 'item|Plate Armor|XPHB', k: 'wpn', ic: 'i-armor', w: 3, h: 3, x: 0, y: 0, slot: 'armor', eq: 'armor' }, { id: 'poc', n: 'Poción de curación', ref: 'item|Potion of Healing|XPHB', k: 'pot', ic: 'i-flask', w: 1, h: 1, q: 3, x: 0, y: 0 }, { id: 'cue', n: 'Cuerda de cáñamo', ref: 'item|Hempen Rope (50 feet)|PHB', ic: 'i-rope', w: 1, h: 2, x: 1, y: 0 }] } };
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
const shot = (p, n) => shots ? p.screenshot({ path: shots + '/sec-' + n + '.png' }) : null;
const click = (p, sel) => p.evaluate((s) => { const b = document.querySelector(s); if (!b) throw new Error('falta ' + s); b.click(); }, sel);
const tab = (p, t) => click(p, '#ribbons [data-tab="' + t + '"]').then(() => p.waitForTimeout(350));

const p = await open('pj', 390, 844);
// --- Conjuros ---
await tab(p, 'conjuros');
ok('conjuros: CD y ataque en una línea, sin las tres cajas grandes', await p.evaluate(() => /CD\s*13/.test(document.querySelector('#pConjuros .sp-cl').textContent) && !document.querySelector('#pConjuros .trio')));
ok('conjuros: Trucos, Nivel 1, 2 y 3 con sus espacios en la cabecera', await p.evaluate(() => { const h = [...document.querySelectorAll('#pConjuros .sp-lh')]; return /Trucos/.test(h[0].textContent) && [1, 2, 3].every((n) => h.some((x) => new RegExp('Nivel ' + n).test(x.textContent) && x.querySelector('.pip'))); }));
ok('conjuros: cada fila dice cuándo se lanza (Acción, Adicional, Reacción…)', await p.evaluate(() => [...document.querySelectorAll('#pConjuros .sp-sub')].every((s) => s.textContent.trim().length > 2)));
await shot(p, 'conjuros');
await p.evaluate(() => { const h = [...document.querySelectorAll('#pConjuros .sp-lh')].find((x) => /Nivel 1/.test(x.textContent)); const av = [...h.querySelectorAll('.pip[aria-pressed="false"]')]; av[av.length - 1].click(); }); await p.waitForTimeout(150);
ok('conjuros: tocar un espacio de la cabecera lo gasta', await p.evaluate(() => (Diario.rt(Diario.cur()).slotsUsed[0] || 0) === 1));
await click(p, '[data-act="undo"]'); await p.waitForTimeout(150);
await click(p, '[data-act="spfopen"]'); await p.waitForTimeout(200);
await click(p, '.sp-filters [data-act="spview"][data-v="cards"]'); await p.waitForTimeout(250);
ok('conjuros: Tarjetas sigue en Filtros › Ver como', await p.evaluate(() => document.querySelectorAll('#pConjuros .spell').length > 3 && !!document.querySelector('#pConjuros .trio')));
await click(p, '.sp-filters [data-act="spview"][data-v="list"]'); await click(p, '[data-act="spfopen"]'); await p.waitForTimeout(200);
// --- Equipo ---
await tab(p, 'equipo');
ok('equipo: resumen con CA, sintonizados y casillas', await p.evaluate(() => { const t = document.querySelector('#pEquipo .eq-st').textContent; return /CA con tu equipo/.test(t) && /Sintonizados/.test(t) && /Casillas/.test(t) && +document.getElementById('eqAc').textContent === Diario.D().ac; }));
ok('equipo: las monedas van en el resumen y se pueden escribir', await p.evaluate(() => document.querySelectorAll('#pEquipo .eq-sum .coinin').length === 5 && document.querySelector('.eq-sum [data-coin="gp"]').value === '125'));
ok('equipo: la figura compacta con los 10 espacios en 5 columnas', await p.evaluate(() => { const s = [...document.querySelectorAll('#bodySlots > *')]; const tops = new Set(s.map((x) => Math.round(x.getBoundingClientRect().top))); return s.length === 10 && tops.size === 2; }));
ok('equipo: la mochila en lista por defecto', await p.evaluate(() => !document.getElementById('invList').hidden && document.getElementById('grid').hidden));
await shot(p, 'equipo');
await click(p, '#invView [data-v="grid"]'); await p.waitForTimeout(200);
ok('equipo: Cuadrícula vuelve a la de arrastrar', await p.evaluate(() => document.getElementById('invList').hidden && !document.getElementById('grid').hidden));
await click(p, '#invView [data-v="list"]'); await p.waitForTimeout(150);
await p.evaluate(() => { const m = [...document.querySelectorAll('#boxTabs button')].find((b) => /Mochila/.test(b.textContent)); if (m) m.click(); }); await p.waitForTimeout(200);
const rows = await p.evaluate(() => document.querySelectorAll('#invList .inv-row').length);
ok('equipo: la mochila tiene sus cosas en filas (' + rows + ')', rows > 0);
await click(p, '#invList .inv-row'); await p.waitForTimeout(150);
await p.evaluate(() => document.getElementById('invList').scrollIntoView({ block: 'center' })); await p.waitForTimeout(150); await shot(p, 'mochila');
ok('equipo: tocar una fila la elige y muestra qué hacer con ella', await p.evaluate(() => !!document.querySelector('#invList .inv-row[aria-pressed="true"]') && document.getElementById('caseActions').children.length > 0));
// --- Rasgos ---
await tab(p, 'rasgos');
ok('rasgos: Con usos · En combate · Todos', await p.evaluate(() => [...document.querySelectorAll('#pRasgos .rg-seg button')].map((b) => b.textContent.replace(/\s*·.*$/, '')).join() === 'Con usos,En combate,Todos'));
ok('rasgos: Subir de nivel ya no ocupa la barra (va en el menú)', await p.evaluate(() => !document.querySelector('#pRasgos .rg-tools [data-act="levelup"]')));
await click(p, '#pRasgos [data-act="rgf"][data-v="use"]'); await p.waitForTimeout(200);
ok('rasgos: Con usos deja solo los que cuentan usos (Suerte, Imposición de manos…)', await p.evaluate(() => { const r = [...document.querySelectorAll('#pRasgos .rg-f')]; return r.length >= 2 && r.every((x) => x.querySelector('.rg-use')); }));
ok('rasgos: dos líneas y «más» si hay más texto', await p.evaluate(() => !!document.querySelector('#pRasgos .rg-more') && getComputedStyle(document.querySelector('#pRasgos .rg-s')).webkitLineClamp === '2'));
await shot(p, 'rasgos');
await click(p, '#pRasgos [data-act="rgf"][data-v="all"]');
// --- Notas ---
await tab(p, 'notas');
ok('notas: Sesiones, Personajes, Lugares y Pistas', await p.evaluate(() => [...document.querySelectorAll('#pNotas .nt-h [data-act="nttab"]')].map((b) => b.textContent.replace(/\s*\d+$/, '')).join() === 'Sesiones,Personajes,Lugares,Pistas'));
ok('notas: lo que tenías escrito pasa a una nota', await p.evaluate(() => /Hermana Vela/.test(document.querySelector('#pNotas .nt-ses').textContent)));
await click(p, '#pNotas [data-act="nttab"][data-v="npc"]'); await p.waitForTimeout(150);
await click(p, '#pNotas [data-act="ntnew"]'); await p.waitForTimeout(200);
await p.fill('#ntName', 'Hermana Vela'); await p.fill('#ntText', 'Sacerdotisa del templo. Nos debe un favor.'); await p.waitForTimeout(400);
ok('notas: la ficha dice en qué sesión sale', await p.evaluate(() => /Sesión 1/.test(document.getElementById('noteBody').textContent)));
await click(p, '#noteSheet [data-act="closesheet"]'); await p.waitForTimeout(200);
ok('notas: la ficha queda en Personajes', await p.evaluate(() => /Hermana Vela/.test(document.querySelector('#pNotas .nt-fis').textContent) && /1 sesión/.test(document.querySelector('#pNotas .nt-fis').textContent)));
await click(p, '#pNotas [data-act="nttab"][data-v="ses"]'); await p.waitForTimeout(150);
ok('notas: la sesión lleva la ficha como etiqueta', await p.evaluate(() => /Hermana Vela/.test(document.querySelector('#pNotas .nt-ses .nt-tags').textContent)));
await click(p, '#pNotas [data-act="ntnew"][data-k="ses"]'); await p.waitForTimeout(200);
await p.fill('#ntTitle', 'El patio de la cripta'); await p.fill('#ntText', 'Emboscada de goblins. La Hermana Vela nos curó.'); await p.waitForTimeout(400);
ok('notas: al escribir, dice quién aparece', await p.evaluate(() => /Hermana Vela/.test(document.getElementById('ntMent').textContent)));
await click(p, '#noteSheet [data-act="closesheet"]'); await p.waitForTimeout(200);
ok('notas: la nueva sesión va primero y es la 2', await p.evaluate(() => /Sesión 2 · El patio de la cripta/.test(document.querySelector('#pNotas .nt-ses').textContent)));
await click(p, '#pNotas [data-act="ntnew"][data-k="ses"]'); await p.waitForTimeout(150);
await click(p, '#noteSheet [data-act="closesheet"]'); await p.waitForTimeout(150);
ok('notas: una nota que dejas vacía no se queda', await p.evaluate(() => document.querySelectorAll('#pNotas .nt-ses').length === 2));
await shot(p, 'notas');
await p.reload(); await p.waitForTimeout(2500); await p.evaluate(() => { const c = document.querySelector('[data-act="open"]'); if (c) c.click(); }); await p.waitForTimeout(600);
ok('notas: todo se guarda', await p.evaluate(() => { const J = Diario.journal(); return J.ses.length === 2 && J.fi.length === 1; }));
console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'SIN ERRORES');
await browser.close(); await srv.close();
process.exit(errors.length ? 1 : 0);
