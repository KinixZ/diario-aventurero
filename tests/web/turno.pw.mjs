// El turno en tres pasos en un Chromium real (teléfono vertical): Lyra toca «Atacar» en su tarjeta de turno, salta a
// ¿A quién?, toca al goblin, ve el resumen con la ventaja y tira; el resultado sale en grande con «Aplicar» y «Otro
// ataque». Usa su Suerte desde el paso 1. El DM: el enemigo del turno ya elegido, su acción del Manual, a quién y tirar.
// Con SHOTS=carpeta guarda capturas. Uso: npm run build && node tests/web/turno.pw.mjs
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { startServer } from '../../server/index.mjs';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { console.log('Sin playwright: se salta la prueba del turno.'); process.exit(0); }
const engine = 'auto', shots = process.env.SHOTS || '', out = shots ? shots + '/turno' : '';
const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: {} });
const URL = 'http://127.0.0.1:' + srv.port + '/';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = []; const ok = (n, c) => { console.log((c ? 'bien ' : 'MAL  ') + n); if (!c) errors.push('falló: ' + n); };
async function open(name, w = 1100, h = 820, extra = null) {
  const p = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: w, height: h } })).newPage();
  p.on('pageerror', (e) => errors.push(name + ' pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_TUNNEL|fonts/.test(m.text())) errors.push(name + ': ' + m.text()); });
  await p.addInitScript(([eng, extra]) => { if (!sessionStorage.getItem('pw-init')) { sessionStorage.setItem('pw-init', '1'); localStorage.setItem('diario-v4', JSON.stringify(Object.assign({ v: 4, skin: 'carmesi' }, extra || {}))); } localStorage.setItem('diario-gfx', JSON.stringify({ q: 'alta', engine: eng === '2d' ? '2d' : 'auto' })); localStorage.setItem('diario-fx', JSON.stringify({ m: 'off' })); }, [engine, extra]);
  await p.goto(URL); await p.waitForTimeout(1200);
  return p;
}
const act = (p, a, v) => p.evaluate(([a, v]) => { const el = document.querySelector('[data-act="' + a + '"]' + (v ? '[data-v="' + v + '"]' : '')); if (!el) throw new Error('falta ' + a + ' ' + (v || '')); el.click(); }, [a, v]);
const has = (p, sel) => p.evaluate((s) => !!document.querySelector(s), sel);
const until = (p, fn, arg, ms = 6000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const field = (p, f, v) => p.evaluate(([f, v]) => { const el = document.querySelector('.cs-comp [data-actf="' + f + '"]'); if (!el) throw new Error('falta el campo ' + f); if (el.type === 'checkbox') el.checked = !!v; else el.value = v; el.dispatchEvent(new Event(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); if (el.type !== 'checkbox' && el.tagName !== 'SELECT') el.dispatchEvent(new Event('change', { bubbles: true })); }, [f, v]);
const target = (p, id) => p.evaluate((id) => document.querySelector('.cs-comp [data-act="acttg"][data-id="' + id + '"]').click(), id);
const submit = (p) => p.evaluate(() => document.querySelector('.cs-comp').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
const combat = (p) => p.evaluate(() => { document.getElementById('combat').hidden = false; Mesa.show('combate'); Diario.renderCombat(); const s = document.querySelector('[data-act="csub"][data-v="orden"]'); if (s) s.click(); });

const PKG = process.env.DIARIO_PAQUETE || '/mnt/user-data/uploads/6be5287b-diario-5e.json';
const BEST = process.env.BESTIARIO || '/mnt/user-data/uploads/48880306-bestiario-5e.json', withBest = existsSync(BEST);
if (!existsSync(PKG)) { console.log('Sin paquete de 5etools: se salta la prueba del turno.'); process.exit(0); }
const dm = await open('DM', 390, 844);
await dm.evaluate(() => Sala.create('Prueba del turno', 'clave1234'));
await dm.waitForFunction(() => Sala.status() === 'on' && Sala.room() && Sala.room().code);
const code = await dm.evaluate(() => Sala.room().code);
if (withBest) await dm.evaluate((j) => Bestiario._set(j), JSON.parse(readFileSync(BEST, 'utf8')));
await dm.evaluate((ref) => Sala.send({ t: 'npc.add', name: 'Goblin', ac: 8, hp: 30, initMod: 2, count: 2, ref }), withBest ? 'Goblin|MM' : null);
const pal = {id:'p', name:'Lyra', level:11, method:'array', base:{str:15,dex:10,con:14,int:8,wis:12,cha:13}, ch:{cls:'Paladin|XPHB', sub:'Oathbreaker|DMG', race:'Aasimar|XPHB', bg:'Soldier|XPHB', bgAbil:{alt:0,picks:['str','con']}, 'feat:asi4':'Lucky|XPHB'},
  rt:{quick:['f:Lucky'], items:[{id:'esp', n:'Espada larga', ref:'item|Longsword|XPHB', k:'wpn', ic:'i-sword', w:1, h:3, slot:'main', eq:'main'}, {id:'pla', n:'Placas', ref:'item|Plate Armor|XPHB', k:'wpn', ic:'i-armor', w:3, h:3, x:2, y:0, slot:'armor', in:'body'}]}};
const ly = await open('Lyra', 390, 844, { chars: [pal], active: 'p', tab: 'personaje', left: 'personaje' });
await ly.evaluate(async (lib) => {
  await new Promise((res) => { const r = indexedDB.open('diario5e', 2); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); }; r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(lib, 'lib'); t.oncomplete = () => { r.result.close(); res(); }; }; });
}, JSON.parse(readFileSync(PKG, 'utf8')));
await ly.reload(); await ly.waitForTimeout(2500);
await ly.evaluate((c) => Sala.join(c, { char: 'p' }), code);
await ly.waitForFunction(() => Sala.status() === 'on' && Sala.room() && Sala.room().members.some((m) => m.char && m.char.name === 'Lyra'), null, { timeout: 8000 });
const ids = await dm.evaluate(() => { const r = Sala.room(); return { pj: r.members.find((m) => m.role !== 'dm').id, g1: r.npcs[0].id, g2: r.npcs[1].id }; });
await ly.evaluate(() => Sala.send({ t: 'init', value: 20 }));
await dm.evaluate((g) => { Sala.send({ t: 'init', id: g[0], value: 5 }); Sala.send({ t: 'init', id: g[1], value: 5 }); }, [ids.g1, ids.g2]);
await dm.waitForTimeout(300);
await combat(dm); await combat(ly);
await act(dm, 'salaturn', 'start');
ok('Lyra tiene su tarjeta «Tu turno»', await until(ly, () => !!document.querySelector('#cMine .cs-mine.turn')));
// derribar al goblin 2 para que salga la ventaja
await dm.evaluate((g) => Sala.send({ t: 'npc.set', id: g, conds: ['prone'] }), ids.g2); await ly.waitForTimeout(300);
// 1. «Atacar» → salta a ¿A quién?
await ly.evaluate(() => document.querySelector('#cMine [data-act="actopen"][data-kind="w"]').click()); await ly.waitForTimeout(300);
ok('«Atacar» abre el paso 2 con la espada', await ly.evaluate(() => { const c = Acciones._comp(); return c.step === 'tg' && /Espada larga/.test(document.querySelector('.tw-t small').textContent); }));
ok('los pasos dicen dónde vas (2 · A quién)', await ly.evaluate(() => /A quién/.test(document.querySelector('.tw-steps li.on').textContent)));
ok('los dos goblins en grande, con su estado', await ly.evaluate(() => document.querySelectorAll('.tw-tgs .tw-tg.npc').length === 2 && /derribado/i.test(document.querySelector('.tw-tg[data-id]:nth-child(2)').textContent + document.querySelector('.tw-tg[data-id]').textContent)));
if (out) await ly.screenshot({ path: out + '-2-a-quien.png' });
await ly.evaluate((g) => document.querySelector('.tw-tg[data-id="' + g + '"]').click(), ids.g2); await ly.waitForTimeout(300);
ok('tocar al goblin 2 pasa a tirar', await ly.evaluate(() => Acciones._comp().step === 'go'));
ok('el resumen: espada, contra Goblin 2, para impactar y daño', await ly.evaluate(() => { const t = document.querySelector('.tw-sum').textContent; return /Espada larga/.test(t) && /Goblin 2/.test(t) && /Para impactar/.test(t) && /Daño/.test(t) && /Gasta/.test(t); }));
ok('la ventaja ya viene puesta por el derribado', await ly.evaluate(() => Acciones._comp().k === 'adv' && document.querySelector('.tw-k [aria-pressed="true"]').textContent === 'Ventaja'));
ok('los números quedan escondidos', await ly.evaluate(() => !document.querySelector('.tw-nums') && !!document.querySelector('[data-act="actmore"]')));
if (out) await ly.screenshot({ path: out + '-3-tirar.png' });
await ly.evaluate(() => document.querySelector('[data-act="actmore"]').click()); await ly.waitForTimeout(150);
ok('«Cambiar números» los muestra', await ly.evaluate(() => !!document.querySelector('.tw-nums [data-actf="bonus"]')));
await ly.evaluate(() => document.querySelector('[data-act="actmore"]').click()); await ly.waitForTimeout(100);
await ly.evaluate(() => document.querySelector('.tw-go [type="submit"]').click());
ok('el resultado sale en grande', await until(ly, () => !!document.querySelector('.tw-res .ac-card .ac-verdict')));
ok('con «Otro ataque» y «Terminar turno»', await ly.evaluate(() => !!document.querySelector('.tw-res [data-act="actagain"]') && !!document.querySelector('.tw-res [data-act="salaturn"][data-v="next"]')));
ok('el registro no repite la tarjeta', await ly.evaluate(() => document.querySelectorAll('.ac-card').length === 1));
if (out) await ly.screenshot({ path: out + '-4-resultado.png' });
// otro ataque: mismo objetivo, directo a tirar
await ly.evaluate(() => document.querySelector('.tw-res [data-act="actagain"]').click()); await ly.waitForTimeout(300);
ok('«Otro ataque» vuelve a tirar contra el mismo', await ly.evaluate((g) => { const c = Acciones._comp(); return c.step === 'go' && c.key === 'w:esp' && !!c.targets[g]; }, ids.g2));
await ly.evaluate(() => document.querySelector('[data-act="actclose"]').click()); await ly.waitForTimeout(150);
// 1. ¿Con qué?: armas, conjuros y la Suerte
await ly.evaluate(() => Acciones.open()); await ly.waitForTimeout(300);
ok('el paso 1: armas, conjuros y habilidades', await ly.evaluate(() => { const l = [...document.querySelectorAll('.tw-b > .label')].map((x) => x.textContent); return l.includes('armas') && l.includes('conjuros') && l.includes('habilidades y objetos'); }));
ok('cada uno dice qué gasta', await ly.evaluate(() => /Acción/.test(document.querySelector('.tw-src[data-k^="w:"] .tw-cost').textContent)));
ok('lo que te queda del turno arriba', await ly.evaluate(() => document.querySelectorAll('.tw-econ span').length === 4));
if (out) await ly.screenshot({ path: out + '-1-con-que.png' });
await ly.evaluate(() => [...document.querySelectorAll('[data-act="actuse"]')].find((b) => /Suerte/.test(b.textContent)).click()); await ly.waitForTimeout(400);
ok('usar la Suerte gasta un punto y lo cuenta al grupo', await until(dm, () => Acciones._cards().some((k) => /Suerte/.test(k.title))) && await ly.evaluate(() => (Diario.quickList().find((q) => q.key === 'f:Lucky') || {}).left === 3));
await act(ly, 'salaturn', 'next');
// El DM: el goblin del turno ya elegido
if (withBest) {
  await until(dm, () => !!document.querySelector('.cs-stage [data-act="actopen"][data-actor]'));
  await dm.evaluate(() => document.querySelector('.cs-stage [data-act="actopen"][data-actor]').click()); await dm.waitForTimeout(400);
  ok('DM: el paso 1 dice a quién le toca y sus acciones del Manual', await until(dm, () => /Le toca a Goblin/.test(document.querySelector('.tw-t small').textContent) && document.querySelectorAll('.tw-src[data-act="actpick"]').length >= 2));
  if (out) await dm.screenshot({ path: out + '-dm-1.png' });
  await dm.evaluate(() => [...document.querySelectorAll('.tw-src[data-act="actpick"]')].find((b) => /Scimitar|Cimitarra/i.test(b.textContent)).click()); await dm.waitForTimeout(200);
  ok('DM: ¿A quién? con Lyra', await dm.evaluate((p) => Acciones._comp().step === 'tg' && !!document.querySelector('.tw-tg[data-id="' + p + '"]'), ids.pj));
  await dm.evaluate((p) => document.querySelector('.tw-tg[data-id="' + p + '"]').click(), ids.pj); await dm.waitForTimeout(200);
  await dm.evaluate(() => document.querySelector('.tw-go [type="submit"]').click());
  ok('DM: resultado con «Siguiente turno»', await until(dm, () => !!document.querySelector('.tw-res [data-act="salaturn"][data-v="next"]')));
  ok('a Lyra le llega el ataque', await until(ly, () => !!document.querySelector('.ac-card.npc')));
}
console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'SIN ERRORES');
await browser.close(); await srv.close();
process.exit(errors.length ? 1 : 0);
