// El jugador en el VTT, en un Chromium real: el abanico de acciones al tocar tu ficha (atacar apuntando en el mapa,
// un conjuro de área, usar, moverse), tu hoja dentro del mapa (personaje, conjuros, mochila; al cerrarla vuelve al
// libro), el abanico del DM con las acciones del enemigo, y que todo cabe en horizontal y en vertical.
// Uso: npm run build && node tests/web/vtt.pw.mjs [auto|2d]
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { startServer } from '../../server/index.mjs';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { console.log('Sin playwright: se salta la prueba del VTT.'); process.exit(0); }
const PKG = process.env.DIARIO_PAQUETE || '/mnt/user-data/uploads/6be5287b-diario-5e.json';
if (!existsSync(PKG)) { console.log('Sin el paquete de 5etools: se salta la prueba del VTT.'); process.exit(0); }
const engine = process.argv[2] || 'auto', shots = process.env.SHOTS || '', out = shots ? shots + '/vtt-' + engine : '';
const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: {} });
const URL = 'http://127.0.0.1:' + srv.port + '/';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = []; const ok = (n, c) => { console.log((c ? 'bien ' : 'MAL  ') + n); if (!c) errors.push('falló: ' + n); };
const LIB = JSON.parse(readFileSync(PKG, 'utf8'));
const CLR = { id: 'c', name: 'Mira', level: 5, method: 'array', base: { str: 10, dex: 12, con: 14, int: 8, wis: 15, cha: 13 }, ch: { cls: 'Cleric|XPHB', race: 'Human|XPHB', bg: 'Acolyte|XPHB', bgAbil: { alt: 0, picks: ['wis', 'con'] }, cantrips: ['Sacred Flame|XPHB', 'Guidance|XPHB', 'Thaumaturgy|XPHB'], spells: ['Spirit Guardians|XPHB', 'Bless|XPHB', 'Cure Wounds|XPHB', 'Hold Person|XPHB', 'Guiding Bolt|XPHB', 'Shield of Faith|XPHB', 'Aid|XPHB', 'Healing Word|XPHB', 'Spiritual Weapon|XPHB'] },
  rt: { items: [{ id: 'maza', n: 'Maza', ref: 'item|Mace|XPHB', k: 'wpn', ic: 'i-sword', w: 1, h: 3, slot: 'main', eq: 'main' }, { id: 'poc', n: 'Poción de curación', ref: 'item|Potion of Healing|XPHB', k: 'con', ic: 'i-flask', w: 1, h: 1, q: 2, use: 'Recuperas 2d4 + 2 PG.' }] } };
async function open(name, w, h, extra) {
  const p = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: w, height: h } })).newPage();
  p.on('pageerror', (e) => errors.push(name + ' pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_TUNNEL|fonts/.test(m.text())) errors.push(name + ': ' + m.text()); });
  await p.addInitScript(([eng, extra]) => { if (!sessionStorage.getItem('pw-init')) { sessionStorage.setItem('pw-init', '1'); localStorage.setItem('diario-v4', JSON.stringify(Object.assign({ v: 4, skin: 'carmesi' }, extra || {}))); } localStorage.setItem('diario-gfx', JSON.stringify({ q: 'alta', engine: eng === '2d' ? '2d' : 'auto' })); localStorage.setItem('diario-fx', JSON.stringify({ m: 'off' })); }, [engine, extra]);
  await p.goto(URL); await p.waitForTimeout(1200);
  if (extra && extra.chars) {
    await p.evaluate(async (lib) => { await new Promise((res) => { const r = indexedDB.open('diario5e', 2); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); }; r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(lib, 'lib'); t.oncomplete = () => { r.result.close(); res(); }; }; }); }, LIB);
    await p.reload(); await p.waitForTimeout(2500);
  }
  return p;
}
const act = (p, a, v) => p.evaluate(([a, v]) => { const el = document.querySelector('[data-act="' + a + '"]' + (v ? '[data-v="' + v + '"]' : '')); if (!el) throw new Error('falta ' + a + ' ' + (v || '')); el.click(); }, [a, v]);
const has = (p, sel) => p.evaluate((s) => !!document.querySelector(s), sel);
const until = (p, fn, arg, ms = 6000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const scr = (p, x, y) => p.evaluate(([x, y]) => { const cv = document.getElementById('mapCv'), r = cv.getBoundingClientRect(), v = Mapas._view(); return [r.left + v.x + x * v.s, r.top + v.y + y * v.s, v.s]; }, [x, y]);
const tapTok = async (p, x, y) => { const q = await scr(p, x + 0.5, y + 0.5); await p.mouse.click(q[0], q[1]); await p.waitForTimeout(300); };
const fan = (p, re) => p.evaluate((src) => { const b = [...document.querySelectorAll('.fan-i')].find((x) => new RegExp(src).test(x.textContent)); if (!b) throw new Error('falta en el abanico: ' + src + ' · hay: ' + [...document.querySelectorAll('.fan-i b')].map((x) => x.textContent).join(', ')); b.click(); }, re);
const fanLabels = (p) => p.evaluate(() => [...document.querySelectorAll('.fan-i b')].map((x) => x.textContent));
/* ¿Todo el abanico cabe dentro del mapa? */
const fanFits = (p) => p.evaluate(() => { const w = document.getElementById('mapWrap').getBoundingClientRect(); return [...document.querySelectorAll('.fan-i, .fan-c')].every((b) => { const r = b.getBoundingClientRect(); return r.left >= w.left - 1 && r.right <= w.right + 1 && r.top >= w.top - 1 && r.bottom <= w.bottom + 1; }); });

const dm = await open('DM', 1100, 820);
await dm.evaluate(() => Sala.create('Prueba VTT', 'clave1234'));
await dm.waitForFunction(() => Sala.status() === 'on' && Sala.room() && Sala.room().code);
const code = await dm.evaluate(() => Sala.room().code);
const BEST = process.env.BESTIARIO || '/mnt/user-data/uploads/48880306-bestiario-5e.json', withBest = existsSync(BEST);
if (withBest) await dm.evaluate((j) => Bestiario._set(j), JSON.parse(readFileSync(BEST, 'utf8')));
const MID = 'mapa-sala';
await dm.evaluate((id) => Sala.send({ t: 'map.save', map: { id, name: 'Sala del trono', cols: 20, rows: 14, grid: 'square', layers: [{ id: 'l1', name: 'Capa 1' }], strokes: [] } }), MID);
await dm.evaluate((ref) => Sala.send({ t: 'npc.add', name: 'Goblin', ac: 15, hp: 7, initMod: 2, ref }), withBest ? 'Goblin|MM' : null);
await dm.waitForFunction(() => Sala.room().npcs.length === 1);
const G = await dm.evaluate(() => Sala.room().npcs[0].id);
await dm.evaluate(([mid, g]) => { Sala.send({ t: 'tok.add', id: mid, tok: { kind: 'npc', name: 'Goblin', ref: g, x: 10, y: 6 } }); Sala.send({ t: 'scene.set', id: mid }); }, [MID, G]);

const pj = await open('PJ', 1100, 820, { chars: [CLR], active: 'c', tab: 'personaje', left: 'personaje' });
await pj.evaluate((c) => Sala.join(c, { char: 'c' }), code);
await pj.waitForFunction(() => Sala.status() === 'on' && Sala.room() && Sala.room().npcs.length === 1, null, { timeout: 8000 });
await pj.evaluate((mid) => Sala.send({ t: 'tok.add', id: mid, tok: { kind: 'pc', name: 'Mira', x: 6, y: 6 } }), MID);
await dm.evaluate((mid) => Sala.send({ t: 'map.state', id: mid, state: 'combat' }), MID);
await pj.evaluate(() => Sala.send({ t: 'init', value: 20 })); await dm.evaluate((g) => Sala.send({ t: 'init', id: g, value: 3 }), G);
await dm.waitForTimeout(300); await dm.evaluate(() => Sala.send({ t: 'turn', dir: 'start' }));
for (const p of [dm, pj]) await p.evaluate((mid) => { document.getElementById('combat').hidden = false; Mesa.show('mapas'); Mapas.open(mid); }, MID);
await pj.waitForTimeout(1200); await dm.waitForTimeout(600);

/* ---------- El abanico del jugador ---------- */
await tapTok(pj, 6, 6);
ok('tocar tu ficha abre el abanico', await has(pj, '.vtt-fan .fan-i'));
const L = await fanLabels(pj);
ok('con Atacar, Conjuros, Usar, Moverse, Mi hoja, Terminar turno y Ficha', ['Atacar', 'Conjuros', 'Usar', 'Moverse', 'Mi hoja', 'Terminar turno', 'Ficha'].every((x) => L.includes(x)));
ok('el abanico cabe en el mapa', await fanFits(pj));
if (out) await pj.screenshot({ path: out + '-abanico.png' });
await fan(pj, '^Conjuros'); await pj.waitForTimeout(150);
ok('los conjuros por nivel, con sus espacios', (await fanLabels(pj)).some((x) => /Nivel 3/.test(x)) && await pj.evaluate(() => /espacios/.test(document.querySelector('.vtt-fan').textContent)));
await fan(pj, 'Nivel 3'); await pj.waitForTimeout(150);
await fan(pj, 'Spirit Guardians'); await pj.waitForTimeout(900);
ok('un conjuro de área apunta en el mapa', await has(pj, '.hud-row.aim') && await pj.evaluate(() => Mapas.aiming()));
await act(pj, 'mapaimgo');
ok('y se publica desde el mapa (con su zona)', await until(dm, () => Acciones._cards().some((k) => /Spirit Guardians/.test(k.title) && k.fx)));
// atacar: elegir al goblin tocándolo
await tapTok(pj, 6, 6); await fan(pj, '^Atacar'); await pj.waitForTimeout(150); await fan(pj, 'Maza'); await pj.waitForTimeout(900);
ok('atacar: elige el objetivo en el mapa', await has(pj, '.hud-row.aim'));
await tapTok(pj, 10, 6);
ok('el goblin queda marcado', await until(pj, () => /Goblin/.test((document.querySelector('.aim-list') || {}).textContent || '')));
await act(pj, 'mapaimgo');
ok('la tarjeta del ataque llega con su objetivo', await until(dm, (g) => Acciones._cards().some((k) => k.title === 'Maza' && k.targets.some((t) => t.id === g) && k.map), G));
// usar: la poción se gasta en la hoja y lo ve el grupo
await tapTok(pj, 6, 6); await fan(pj, '^Usar'); await pj.waitForTimeout(150); await fan(pj, 'Poción');
ok('usar una poción la gasta y lo cuenta al grupo', await until(dm, () => Acciones._cards().some((k) => /Poción/.test(k.title))) && await pj.evaluate(() => Diario.rt(Diario.cur()).items.find((i) => i.id === 'poc').q === 1));
// moverse: correr
await tapTok(pj, 6, 6); await fan(pj, '^Moverse'); await pj.waitForTimeout(150); await fan(pj, 'Correr');
ok('Correr desde el abanico duplica el movimiento', await until(pj, () => /de 18 m/.test((document.querySelector('.hud-mv') || {}).textContent || '')));

/* ---------- La hoja en el mapa ---------- */
await tapTok(pj, 6, 6); await fan(pj, 'Mi hoja'); await pj.waitForTimeout(400);
ok('tu hoja se abre al lado del mapa', await has(pj, '#mapWrap .vtt-sheet #pPersonaje') && await pj.evaluate(() => /Mira/.test(document.querySelector('.vtt-sheet .vs-who').textContent)));
await act(pj, 'vsheet', 'equipo'); await pj.waitForTimeout(400);
ok('la mochila de verdad (con su cuadrícula) dentro del mapa', await has(pj, '.vtt-sheet #pEquipo #grid') && await pj.evaluate(() => document.querySelector('.vtt-sheet #pEquipo').offsetHeight > 100));
ok('la hoja de personaje volvió al libro', await pj.evaluate(() => !!document.querySelector('#book #pPersonaje') && !document.querySelector('.vtt-sheet #pPersonaje')));
await act(pj, 'vsheet', 'conjuros'); await pj.waitForTimeout(300);
ok('los conjuros también', await pj.evaluate(() => document.querySelector('.vtt-sheet #pConjuros').textContent.length > 50));
if (out) await pj.screenshot({ path: out + '-hoja.png' });
await act(pj, 'vsheetx'); await pj.waitForTimeout(200);
ok('al cerrar, todo vuelve a su lugar en el libro', await pj.evaluate(() => !document.querySelector('.vtt-sheet') && document.querySelector('#scroll #pConjuros') && document.querySelector('#scroll #pEquipo')));
// Ficha: el panel de siempre
await tapTok(pj, 6, 6); await fan(pj, 'Ficha'); await pj.waitForTimeout(200);
ok('«Ficha» abre el panel de la ficha', await pj.evaluate(() => !document.getElementById('mapTok').hidden));
await pj.evaluate(() => { const x = document.querySelector('[data-act="maptokx"]'); if (x) x.click(); });

/* ---------- El abanico del DM ---------- */
await act(pj, 'salaturn', 'next').catch(() => pj.evaluate(() => Sala.send({ t: 'turn', dir: 'next' })));
await dm.waitForTimeout(400);
await tapTok(dm, 10, 6);
ok('el DM toca al goblin: el abanico con sus acciones', await has(dm, '.vtt-fan .fan-i') && (!withBest || (await fanLabels(dm)).some((x) => /Scimitar|Cimitarra/i.test(x))));
ok('y «Siguiente turno»', (await fanLabels(dm)).includes('Siguiente turno'));
if (withBest) { await fan(dm, 'Scimitar|Cimitarra'); await dm.waitForTimeout(900); ok('la cimitarra apunta en el mapa', await has(dm, '.hud-row.aim')); await act(dm, 'mapaimx'); }
else await act(dm, 'vfanx');

/* ---------- En el teléfono: vertical y horizontal ---------- */
for (const [w, h, name] of [[390, 844, 'vertical'], [844, 390, 'horizontal']]) {
  await pj.setViewportSize({ width: w, height: h }); await pj.waitForTimeout(600);
  await pj.evaluate((mid) => { Mapas.open(mid); }, MID); await pj.waitForTimeout(900);
  await pj.evaluate(() => { const v = Mapas._view(); });
  const me = await pj.evaluate((mid) => Mapas._maps()[mid].tokens.find((t) => t.kind === 'pc'), MID);
  await pj.evaluate(([mid, id]) => { const mp = Mapas._maps()[mid]; }, [MID, me.id]);
  await tapTok(pj, me.x, me.y);
  ok(name + ': el abanico se abre y cabe', await has(pj, '.vtt-fan .fan-i') && await fanFits(pj));
  if (out) await pj.screenshot({ path: out + '-' + name + '-abanico.png' });
  await fan(pj, 'Mi hoja'); await pj.waitForTimeout(400);
  const geo = await pj.evaluate(() => { const s = document.querySelector('.vtt-sheet').getBoundingClientRect(), wr = document.getElementById('mapWrap').getBoundingClientRect(); return { sw: s.width, sh: s.height, ww: wr.width, wh: wr.height, bottom: Math.abs(s.bottom - wr.bottom) < 2 }; });
  ok(name + ': la hoja ' + (name === 'vertical' ? 'sube desde abajo' : 'va de lado'), name === 'vertical' ? geo.sw >= geo.ww - 2 && geo.bottom : geo.sw < geo.ww * 0.7);
  if (out) await pj.screenshot({ path: out + '-' + name + '-hoja.png' });
  await act(pj, 'vsheetx'); await pj.waitForTimeout(200);
  // en combate, la barra de tu turno va abajo, a lo ancho, y deja libre más de la mitad del mapa
  if (name === 'horizontal') ok('horizontal: la barra del turno va abajo y deja el mapa libre', await pj.evaluate(() => { const hd = document.getElementById('vttHud').getBoundingClientRect(), wr = document.getElementById('mapWrap').getBoundingClientRect(); return hd.bottom >= wr.bottom - 12 && hd.height < wr.height * 0.5; }));
}
await dm.setViewportSize({ width: 390, height: 844 }); await dm.waitForTimeout(500); await dm.evaluate((mid) => Mapas.open(mid), MID); await dm.waitForTimeout(800);
ok('el DM en el teléfono: el HUD no se sale de la pantalla', await dm.evaluate(() => { const hd = document.getElementById('vttHud').getBoundingClientRect(); return hd.right <= window.innerWidth + 1 && hd.left >= -1; }));
if (out) await dm.screenshot({ path: out + '-dm-telefono.png' });

console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'SIN ERRORES');
await browser.close(); await srv.close();
process.exit(errors.length ? 1 : 0);
