// Combate táctico en un Chromium real: movimiento por velocidad (y la ficha que vuelve si no alcanza), Espíritus
// guardianes apuntado en el mapa (la zona sigue a la ficha y alcanza al goblin que entra), cobertura, altura de vuelo,
// reglas del mapa, dados físicos, salvación contra la muerte y los dados 3D.
// Uso: npm run build && node tests/web/tactico.pw.mjs [auto|2d]
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { startServer } from '../../server/index.mjs';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { console.log('Sin playwright: se salta la prueba táctica.'); process.exit(0); }
const engine = process.argv[2] || 'auto', shots = process.env.SHOTS || '', out = shots ? shots + '/tactico-' + engine : '';
const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: {} });
const URL = 'http://127.0.0.1:' + srv.port + '/';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = []; const ok = (n, c) => { console.log((c ? 'bien ' : 'MAL  ') + n); if (!c) errors.push('falló: ' + n); };
const CLR = { id: 'c', name: 'Mira', level: 5, method: 'array', base: { str: 10, dex: 12, con: 14, int: 8, wis: 15, cha: 13 }, ch: { cls: 'Cleric|XPHB', race: 'Human|XPHB', bg: 'Acolyte|XPHB', bgAbil: { alt: 0, picks: ['wis', 'con'] }, cantrips: ['Sacred Flame|XPHB', 'Guidance|XPHB', 'Thaumaturgy|XPHB'], spells: ['Spirit Guardians|XPHB', 'Bless|XPHB', 'Cure Wounds|XPHB', 'Hold Person|XPHB', 'Guiding Bolt|XPHB', 'Shield of Faith|XPHB', 'Aid|XPHB', 'Healing Word|XPHB', 'Spiritual Weapon|XPHB'] },
  rt: { items: [{ id: 'maza', n: 'Maza', ref: 'item|Mace|XPHB', k: 'wpn', ic: 'i-sword', w: 1, h: 3, slot: 'main', eq: 'main' }] } };
async function open(name, extra = null, fx = 'off') {
  const p = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1100, height: 820 } })).newPage();
  p.on('pageerror', (e) => errors.push(name + ' pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_TUNNEL|fonts/.test(m.text())) errors.push(name + ': ' + m.text()); });
  await p.addInitScript(([eng, extra, fx]) => { if (!sessionStorage.getItem('pw-init')) { sessionStorage.setItem('pw-init', '1'); localStorage.setItem('diario-v4', JSON.stringify(Object.assign({ v: 4, skin: 'carmesi' }, extra || {}))); } localStorage.setItem('diario-gfx', JSON.stringify({ q: 'alta', engine: eng === '2d' ? '2d' : 'auto' })); localStorage.setItem('diario-fx', JSON.stringify({ m: fx })); }, [engine, extra, fx]);
  await p.goto(URL); await p.waitForTimeout(1500);
  return p;
}
const act = (p, a, v) => p.evaluate(([a, v]) => { const el = document.querySelector('[data-act="' + a + '"]' + (v ? '[data-v="' + v + '"]' : '')); if (!el) throw new Error('falta ' + a + ' ' + (v || '')); el.click(); }, [a, v]);
const has = (p, sel) => p.evaluate((s) => !!document.querySelector(s), sel);
const until = (p, fn, arg, ms = 6000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const scr = (p, x, y) => p.evaluate(([x, y]) => { const cv = document.getElementById('mapCv'), r = cv.getBoundingClientRect(), v = Mapas._view(); return [r.left + v.x + x * v.s, r.top + v.y + y * v.s, v.s]; }, [x, y]);
const drag = async (p, a, b) => { const q0 = await scr(p, a[0], a[1]), q1 = await scr(p, b[0], b[1]); await p.mouse.move(q0[0], q0[1]); await p.mouse.down(); await p.mouse.move(q1[0], q1[1], { steps: 12 }); await p.mouse.up(); await p.waitForTimeout(300); };
const toks = (p, mid) => p.evaluate((m) => Mapas._maps()[m].tokens.map((t) => ({ id: t.id, name: t.name, x: t.x, y: t.y, z: t.z || 0, kind: t.kind, ref: t.ref })), mid);

const dm = await open('DM');
await dm.evaluate(() => Sala.create('Prueba táctica', 'clave1234'));
await dm.waitForFunction(() => Sala.status() === 'on' && Sala.room() && Sala.room().code);
const code = await dm.evaluate(() => Sala.room().code);
const MID = 'mapa-cripta';
await dm.evaluate((id) => Sala.send({ t: 'map.save', map: { id, name: 'Cripta', cols: 24, rows: 16, grid: 'square', layers: [{ id: 'l1', name: 'Capa 1' }], strokes: [], walls: [{ id: 'w1', a: [12, 0], b: [12, 6], t: 'wall' }], trig: [{ id: 'zbarro', k: 'dificil', x: 6, y: 9, w: 2, h: 7, name: 'Barro' }] } }), MID);
await dm.evaluate(() => Sala.send({ t: 'npc.add', name: 'Goblin', ac: 15, hp: 7, count: 2, initMod: 2, reach: 1 }));
await dm.waitForFunction(() => Sala.room().npcs.length === 2);
const G = await dm.evaluate(() => Sala.room().npcs.map((n) => n.id));
await dm.evaluate(([mid, g]) => { Sala.send({ t: 'tok.add', id: mid, tok: { kind: 'npc', name: 'Goblin 1', ref: g[0], x: 4, y: 4 } }); Sala.send({ t: 'tok.add', id: mid, tok: { kind: 'npc', name: 'Goblin 2', ref: g[1], x: 16, y: 10 } }); Sala.send({ t: 'scene.set', id: mid }); }, [MID, G]);

const PKG = process.env.DIARIO_PAQUETE || '/mnt/user-data/uploads/6be5287b-diario-5e.json';
if (!existsSync(PKG)) { console.log('Sin el paquete de 5etools: se salta la prueba táctica.'); await browser.close(); await srv.close(); process.exit(0); }
const pj = await open('PJ', { chars: [CLR], active: 'c', tab: 'personaje', left: 'personaje' });
await pj.evaluate(async (lib) => { await new Promise((res) => { const r = indexedDB.open('diario5e', 2); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); }; r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(lib, 'lib'); t.oncomplete = () => { r.result.close(); res(); }; }; }); }, JSON.parse(readFileSync(PKG, 'utf8')));
await pj.reload(); await pj.waitForTimeout(2500);
await pj.evaluate((c) => Sala.join(c, { char: 'c' }), code);
await pj.waitForFunction(() => Sala.status() === 'on' && Sala.room() && Sala.room().npcs.length === 2, null, { timeout: 8000 });
const PJ = await pj.evaluate(() => Sala.room().you);
await pj.evaluate((mid) => Sala.send({ t: 'tok.add', id: mid, tok: { kind: 'pc', name: 'Mira', x: 3, y: 4 } }), MID);
await pj.waitForTimeout(400);
await dm.evaluate((mid) => Sala.send({ t: 'map.state', id: mid, state: 'combat' }), MID);
await pj.evaluate(() => Sala.send({ t: 'init', value: 20 }));
await dm.evaluate((g) => { Sala.send({ t: 'init', id: g[0], value: 5 }); Sala.send({ t: 'init', id: g[1], value: 4 }); }, G);
await dm.waitForTimeout(300);
await dm.evaluate(() => Sala.send({ t: 'turn', dir: 'start' }));
// los dos abren el mapa
for (const p of [dm, pj]) { await p.evaluate((mid) => { document.getElementById('combat').hidden = false; Mesa.show('mapas'); Mapas.open(mid); }, MID); }
await pj.waitForTimeout(1200); await dm.waitForTimeout(600);

/* ---------- Movimiento por velocidad ---------- */
ok('el jugador ve su movimiento en la ronda (9 m)', await until(pj, () => /9 m/.test((document.querySelector('.hud-mv') || {}).textContent || '')));
ok('el DM ve las reglas del mapa', await has(dm, '[data-act="maptac"][data-v="flank"]'));
let T = await toks(pj, MID), me = T.find((t) => t.kind === 'pc');
await drag(pj, [me.x + 0.5, me.y + 0.5], [3.5, 8.5]); // 4 casillas: 6 m
ok('se mueve y le quedan 3 m', await until(pj, () => /3 m/.test(document.querySelector('.hud-mv').textContent)));
ok('al salir del alcance del goblin, el DM recibe el ataque de oportunidad', await until(dm, () => /ataque de oportunidad/.test((document.getElementById('salaToast') || {}).textContent || '')));
await pj.evaluate(() => { const x = document.querySelector('[data-act="maptokx"]'); if (x) x.click(); });
await drag(pj, [3.5, 8.5], [9.5, 8.5]);
T = await toks(pj, MID); me = T.find((t) => t.kind === 'pc');
ok('más lejos que su velocidad: la ficha no se mueve', me.x === 3 && me.y === 8);
await act(pj, 'mapmv', 'dash');
ok('Correr: el movimiento se duplica', await until(pj, () => /de 18 m/.test(document.querySelector('.hud-mv').textContent)));
if (out) await pj.screenshot({ path: out + '-movimiento.png' });

/* ---------- Altura ---------- */
await pj.evaluate(() => { const x = document.querySelector('[data-act="maptokx"]'); if (x) x.click(); });
const meS = await scr(pj, 3.5, 8.5); await pj.mouse.click(meS[0], meS[1]); await pj.waitForTimeout(250);
ok('el panel de la ficha tiene la altura', await has(pj, '[data-act="maptokz"][data-v="1"]'));
await act(pj, 'maptokz', '1'); await act(pj, 'maptokz', '1');
ok('vuela a 3 m', await until(pj, (mid) => (Mapas._maps()[mid].tokens.find((t) => t.kind === 'pc').z || 0) === 2, MID));
ok('el DM la ve volando', await until(dm, (mid) => (Mapas._maps()[mid].tokens.find((t) => t.kind === 'pc').z || 0) === 2, MID));
await act(pj, 'maptokz', '-1'); await act(pj, 'maptokz', '-1'); await pj.waitForTimeout(200);
await act(pj, 'maptokx');

/* ---------- Espíritus guardianes apuntado en el mapa ---------- */
await pj.evaluate(() => Acciones.open({ key: 'sp:Spirit Guardians|XPHB' })); await pj.waitForTimeout(400);
ok('el compositor ofrece apuntar en el mapa', await has(pj, '.cs-comp [data-act="actaim"]'));
await pj.evaluate(() => document.querySelector('.cs-comp [data-act="actaim"]').click()); await pj.waitForTimeout(900);
ok('en el mapa, la barra de apuntar', await has(pj, '.hud-row.aim') && await has(pj, '[data-act="mapaimgo"]'));
if (out) await pj.screenshot({ path: out + '-apuntar.png' });
await act(pj, 'mapaimgo');
ok('la tarjeta del conjuro llega al DM con su zona', await until(dm, () => Acciones._cards().some((k) => k.title === 'Spirit Guardians' && k.fx)));
ok('la zona queda en el mapa para los dos', await until(pj, (mid) => (Mapas._maps()[mid].fx || []).length === 1, MID) && await until(dm, (mid) => (Mapas._maps()[mid].fx || []).length === 1, MID));
ok('la concentración queda en la hoja', await until(pj, () => /Spirit Guardians/.test(Diario.rt(Diario.cur()).conc || '')));
// el lienzo de efectos se pinta en el siguiente cuadro: se mira varias veces
let painted = 0;
for (let i = 0; i < 12 && painted <= 20; i++) { await pj.waitForTimeout(250); painted = await pj.evaluate(() => { const c = document.getElementById('mapFx'); if (window.Efectos) Efectos.sync(); const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 64) if (d[i] > 0) n++; return n; }); }
ok('el lienzo de efectos dibuja la zona', painted > 20);
// el DM mete al goblin 2 en la zona: su tarjeta, con la salvación
await dm.evaluate(([mid, g]) => { const t = Mapas._maps()[mid].tokens.find((x) => x.ref === g); Sala.send({ t: 'tok.move', id: mid, tid: t.id, x: 5, y: 9 }); }, [MID, G[1]]);
ok('el goblin entra en la zona: tarjeta con salvación de Sabiduría', await until(dm, () => Acciones._cards().some((k) => k.zone && k.save && k.save.ab === 'wis' && /entra/.test(k.text))));
if (out) await dm.screenshot({ path: out + '-zona.png' });

/* ---------- Reglas del mapa, dados físicos y cobertura ---------- */
await act(dm, 'maptac', 'flank');
ok('el DM activa el flanqueo', await until(pj, (mid) => !!(Mapas._maps()[mid].tac || {}).flank, MID));
await pj.evaluate(() => Dados.set('fisico'));
await pj.evaluate((g) => Acciones.open({ key: 'w:maza', target: g }), G[0]); await pj.waitForTimeout(300);
ok('con dados físicos pide el d20', await has(pj, '.cs-comp [data-actman="d0"]'));
await pj.evaluate(() => { const a = document.querySelector('[data-actman="d0"]'); a.value = '15'; a.dispatchEvent(new Event('input', { bubbles: true })); const m = document.querySelector('[data-actman="m0"]'); if (m) { m.value = '6'; m.dispatchEvent(new Event('input', { bubbles: true })); } document.querySelector('.cs-comp').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
ok('la tarjeta usa lo que escribió', await until(dm, () => Acciones._cards().some((k) => k.man && k.atk && k.atk.nat === 15 && k.amt === 6)));
await pj.evaluate(() => Dados.set('3d'));

/* ---------- Salvación contra la muerte ---------- */
await pj.evaluate(() => { Diario.applyToMe({ kind: 'damage', amount: Diario.rt(Diario.cur()).hp + (Diario.rt(Diario.cur()).temp || 0) }); });
await pj.waitForTimeout(500);
await pj.evaluate(() => { document.getElementById('combat').hidden = false; Mesa.show('combate'); Diario.renderCombat(); const s = document.querySelector('[data-act="csub"][data-v="orden"]'); if (s) s.click(); });
ok('caído en su turno: botón de salvación contra la muerte', await until(pj, () => !!document.querySelector('[data-act="actdeath"]')));
await act(pj, 'actdeath');
ok('la salvación se tira en el servidor y la ve el DM', await until(dm, () => Acciones._cards().some((k) => k.death)));
ok('la hoja lleva la cuenta', await until(pj, () => { const r = Diario.rt(Diario.cur()); return r.hp === 1 || (r.death && (r.death.s + r.death.f) >= 1); }));

/* ---------- Dados 3D ---------- */
const d3 = await open('Dados', null, 'subtle');
const rolled = await d3.evaluate(() => Dados.load().then((D) => D.roll([{ sides: 20, value: 17 }, { sides: 6, value: 3 }, { sides: 10, value: 10 }, { sides: 4, value: 2 }, { sides: 8, value: 8 }, { sides: 12, value: 11 }], { text: 'Prueba', hold: 50 })).catch((e) => 'error: ' + e.message));
ok('los dados 3D se bajan aparte y ruedan', rolled === true || (engine === '2d' && typeof rolled !== 'string'));

console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'SIN ERRORES');
await browser.close(); await srv.close();
process.exit(errors.length ? 1 : 0);
