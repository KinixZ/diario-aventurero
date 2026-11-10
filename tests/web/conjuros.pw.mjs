// Módulo 16 en un Chromium real: filtros de la página de conjuros, nombres de conjuros en español (y el modo inglés),
// usos limitados leídos del texto (Suerte) y puestos a mano, en Rasgos y en el acceso rápido del combate.
// Con SHOTS=carpeta guarda capturas. Uso: npm run build && node tests/web/conjuros.pw.mjs
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { startServer } from '../../server/index.mjs';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { console.log('Sin playwright: se salta la prueba de conjuros.'); process.exit(0); }
const PKG = process.env.DIARIO_PAQUETE || '/mnt/user-data/uploads/6be5287b-diario-5e.json';
if (!existsSync(PKG)) { console.log('Sin el paquete de 5etools: se salta la prueba de conjuros.'); process.exit(0); }
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
const shot = (p, n) => shots ? p.screenshot({ path: shots + '/conjuros-' + n + '.png' }) : null;
const until = (p, fn, arg, ms = 6000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
/* ¿Algún botón del HUD sin texto visible? (solo icono) */
const iconOnly = (p) => p.evaluate(() => [...document.querySelectorAll('#vttHud button, #mapBar button')].filter((b) => b.offsetParent && !b.textContent.trim() && !b.closest('.map-zoom')).map((b) => b.dataset.act + ':' + (b.dataset.v || '')).filter((x) => x !== 'mapback:'));


const C = JSON.parse(JSON.stringify(PAL)); C.house = { allSpells: true }; C.ch['feat:asi4'] = 'Lucky|XPHB';
const p = await open('pj', 390, 844, C);
const tab = async (t) => { await p.evaluate((t) => { const b = document.querySelector('[data-act="tab"][data-tab="' + t + '"], .ribbon[data-tab="' + t + '"]'); if (b) b.click(); }, t); await p.waitForTimeout(400); };
// --- Conjuros: nombres en español ---
await tab('conjuros');
const names = await p.evaluate(() => [...document.querySelectorAll('#pConjuros .sp-row .sp-n')].map((a) => a.textContent));
ok('hay conjuros en la página (' + names.length + ')', names.length > 10);
ok('los nombres salen en español (Bendición, Curar heridas…)', names.includes('Bendición') && names.includes('Curar heridas'));
ok('al lado va el nombre en inglés', await p.evaluate(() => [...document.querySelectorAll('#pConjuros .sp-row .sp-en')].some((s) => s.textContent === 'Bless')));
// lista compacta: los espacios en la cabecera de cada nivel; tocar un conjuro lo abre ahí mismo
ok('cada nivel lleva sus espacios en la cabecera', await p.evaluate(() => { const h = [...document.querySelectorAll('#pConjuros .sp-lh')].find((x) => /Nivel 1/.test(x.textContent)); return !!h && h.querySelectorAll('.pip.slotpip').length === 4; }));
ok('ya no va la tarjeta de espacios aparte', await p.evaluate(() => ![...document.querySelectorAll('#pConjuros .card .label')].some((l) => /espacios de conjuro/i.test(l.textContent))));
await p.evaluate(() => [...document.querySelectorAll('#pConjuros .sp-row')].find((r) => r.querySelector('.sp-n').textContent === 'Bendición').querySelector('.sp-tog').click()); await p.waitForTimeout(250);
ok('tocar Bendición la abre ahí: alcance, duración, texto y Lanzar', await p.evaluate(() => { const o = document.querySelector('#pConjuros .sp-row.open'); return !!o && /Alcance/.test(o.textContent) && /Duración/.test(o.textContent) && !!o.querySelector('[data-act="spcast"]') && !!o.querySelector('[data-act="gopen"]'); }));
await shot(p, 'lista');
const used0 = await p.evaluate(() => Diario.rt(Diario.cur()).slotsUsed[0] || 0);
await p.click('#pConjuros .sp-row.open [data-act="spcast"]'); await p.waitForTimeout(300);
ok('Lanzar gasta un espacio de nivel 1 y se puede deshacer', (await p.evaluate(() => Diario.rt(Diario.cur()).slotsUsed[0] || 0)) === used0 + 1 && await p.evaluate(() => !document.getElementById('undoToast').hidden && /Bendición/.test(document.getElementById('undoTxt').textContent)));
await p.click('[data-act="undo"]'); await p.waitForTimeout(200);
ok('deshacer devuelve el espacio', (await p.evaluate(() => Diario.rt(Diario.cur()).slotsUsed[0] || 0)) === used0);
await p.click('.sp-quick [data-act="spft"][data-v="r"]'); await p.waitForTimeout(250);
ok('el atajo Reacción deja solo reacciones', await p.evaluate(() => { const r = [...document.querySelectorAll('#pConjuros .sp-row .sp-sub')]; return r.length > 0 && r.every((x) => /^Reacción/.test(x.textContent)); }));
await p.click('.sp-quick [data-act="spft"][data-v=""]'); await p.waitForTimeout(250);
// buscar en español y en inglés
const count = () => p.evaluate(() => document.querySelectorAll('#pConjuros .sp-row').length);
const all = await count();
await p.fill('#spQ', 'curar'); await p.waitForTimeout(300);
ok('buscar «curar» encuentra Curar heridas', await p.evaluate(() => [...document.querySelectorAll('#pConjuros .sp-row .sp-n')].some((a) => a.textContent === 'Curar heridas')) && (await count()) < all);
await p.fill('#spQ', 'bless'); await p.waitForTimeout(300);
ok('buscar en inglés («bless») también', await p.evaluate(() => [...document.querySelectorAll('#pConjuros .sp-row .sp-n')].some((a) => a.textContent === 'Bendición')));
await p.fill('#spQ', ''); await p.waitForTimeout(300);
// --- Filtros ---
await p.click('[data-act="spfopen"]'); await p.waitForTimeout(300);
ok('se abren los filtros con nivel, tiempo, escuela, qué hace y cómo verlos', await p.evaluate(() => document.querySelectorAll('.sp-filters .sp-fg').length === 5 && /Ver como/.test(document.querySelector('.sp-filters').textContent)));
await p.click('.sp-chip[data-g="lv"][data-v="1"]'); await p.waitForTimeout(300);
ok('filtrar nivel 1: solo conjuros de nivel 1', await p.evaluate(() => { const s = [...document.querySelectorAll('#pConjuros .lvl-sep')].map((x) => x.textContent); return s.length === 1 && /nivel 1/i.test(s[0]); }));
const n1 = await count();
await p.click('.sp-chip[data-g="t"][data-v="b"]'); await p.waitForTimeout(300);
const n1b = await count();
ok('y además adicional: menos conjuros (' + n1 + ' → ' + n1b + ')', n1b > 0 && n1b < n1);
ok('el botón dice cuántos filtros hay', await p.evaluate(() => /Filtros · 2/.test(document.querySelector('[data-act="spfopen"]').textContent)));
await shot(p, 'filtros');
await p.click('.sp-chip[data-g="t"][data-v="b"]'); await p.click('.sp-chip[data-g="lv"][data-v="1"]'); await p.waitForTimeout(200);
await p.click('.sp-chip[data-g="p"][data-v="conc"]'); await p.waitForTimeout(300);
ok('filtro de concentración', await p.evaluate(() => document.querySelectorAll('#pConjuros .sp-row').length > 0) && (await count()) < all);
await p.click('[data-act="spfclear"]'); await p.waitForTimeout(300);
ok('quitar filtros vuelve a todos', (await count()) === all);
// --- Modo inglés ---
await p.evaluate(() => Render5e.spMode('en')); await p.evaluate(() => Diario.renderAll()); await p.waitForTimeout(300);
ok('en modo inglés salen en inglés', await p.evaluate(() => [...document.querySelectorAll('#pConjuros .sp-row .sp-n')].some((a) => a.textContent === 'Bless')));
await p.evaluate(() => Render5e.spMode('es')); await p.evaluate(() => Diario.renderAll()); await p.waitForTimeout(200);
// --- Rasgos: Suerte con sus puntos ---
await tab('rasgos');
ok('la dote sale en español (Suerte)', await p.evaluate(() => [...document.querySelectorAll('#pRasgos .rg-f summary b')].some((b) => b.textContent === 'Suerte')));
const lucky = await p.evaluate(() => { const rows = [...document.querySelectorAll('#pRasgos .rg-f')].filter((r) => /Lucky|Suerte|Afortunado/i.test(r.querySelector('summary b')?.textContent || '')); const r = rows[0]; return r ? { pips: r.querySelectorAll('.pip').length, pin: !!r.querySelector('.rg-pin') } : null; });
ok('Suerte tiene sus puntos (bonificador de competencia = 4) y se puede fijar', lucky && lucky.pips === 4 && lucky.pin);
ok('Manos sanadoras del aasimar también cuenta su uso', await p.evaluate(() => [...document.querySelectorAll('#pRasgos .rg-f')].some((r) => /Healing Hands|Manos sanadoras/i.test(r.textContent) && r.querySelector('.pip'))));
// fijarla al acceso rápido
await p.evaluate(() => { const r = [...document.querySelectorAll('#pRasgos .rg-f')].find((r) => /Lucky|Suerte/i.test(r.querySelector('summary b')?.textContent || '')); r.querySelector('.rg-pin').click(); });
await p.waitForTimeout(300);
ok('Suerte entra al acceso rápido (con su nombre en español)', await p.evaluate(() => (Diario.quickList() || []).some((q) => q.key === 'f:Lucky' && q.left === 4 && q.label === 'Suerte')));
// gastar un punto desde el acceso rápido
await p.evaluate(() => Diario.quickUse('f:Lucky')); await p.waitForTimeout(300);
ok('usarla gasta un punto (quedan 3)', await p.evaluate(() => (Diario.quickList() || []).some((q) => q.key === 'f:Lucky' && q.left === 3)));
// --- Contar usos a mano: un rasgo sin usos ---
const target = await p.evaluate(() => { const r = [...document.querySelectorAll('#pRasgos .rg-f')].find((r) => !r.querySelector('.pip') && r.querySelector('[data-act="ctropen"]')); return r ? r.querySelector('[data-act="ctropen"]').dataset.n : null; });
ok('hay un rasgo sin usos con «Contar usos»', !!target);
await p.evaluate((n) => document.querySelector('[data-act="ctropen"][data-n="' + n + '"]').click(), target); await p.waitForTimeout(300);
ok('se abre la hoja para contar usos', await p.evaluate(() => !document.getElementById('ctrSheet').hidden));
await p.selectOption('#ctrHow', 'n'); await p.fill('#ctrNum', '2');
await p.click('#ctrRest [data-v="short"]'); await shot(p, 'contar-usos');
await p.click('#ctrForm [type="submit"]'); await p.waitForTimeout(400);
ok('el rasgo ahora tiene 2 usos', await p.evaluate((n) => { const b = document.querySelector('[data-act="ctropen"][data-n="' + n + '"]'); const r = b && b.closest('.rg-f'); return r && r.querySelectorAll('.pip').length === 2; }, target));
ok('y se guarda en el personaje', await p.evaluate((n) => { const s = JSON.parse(localStorage.getItem('diario-v4')); const c = s.chars[0]; return !!(c.ctr && Object.values(c.ctr).some((o) => o.max === 2 && o.rest === 'short')); }, target));
await tab('conjuros'); await shot(p, 'conjuros');
console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'SIN ERRORES');
await browser.close(); await srv.close(); process.exit(errors.length ? 1 : 0);
