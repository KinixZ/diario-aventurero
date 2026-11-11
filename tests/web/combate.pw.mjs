// Combate sin mapa en un Chromium real: la escena del turno con retratos, el compositor de acciones y las tarjetas.
// El jugador publica un ataque y un hechizo (el servidor tira los dados) y aplica el daño al enemigo; el DM usa la
// acción del goblin de su Manual de Monstruos y una salvación libre; el jugador tira su salvación y recibe el daño.
// Uso: npm run build && node tests/web/combate.pw.mjs [auto|2d]
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { startServer } from '../../server/index.mjs';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { console.log('Sin playwright: se salta la prueba del combate.'); process.exit(0); }
const engine = process.argv[2] || 'auto', shots = process.env.SHOTS || '', out = shots ? shots + '/combate-' + engine : '';
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

const dm = await open('DM');
await dm.evaluate(() => Sala.create('Prueba combate', 'clave1234'));
await dm.waitForFunction(() => Sala.status() === 'on' && Sala.room() && Sala.room().code);
const code = await dm.evaluate(() => Sala.room().code);
const BEST = process.env.BESTIARIO || '/mnt/user-data/uploads/48880306-bestiario-5e.json', withBest = existsSync(BEST);
if (withBest) await dm.evaluate((j) => Bestiario._set(j), JSON.parse(readFileSync(BEST, 'utf8')));
await dm.evaluate((ref) => Sala.send({ t: 'npc.add', name: 'Goblin', ac: 15, hp: 7, initMod: 2, ref }), withBest ? 'Goblin|MM' : null);
const pj = await open('PJ', 420, 860);
await pj.evaluate((c) => Sala.join(c), code);
await pj.waitForFunction(() => Sala.status() === 'on' && Sala.room() && Sala.room().npcs.length === 1, null, { timeout: 8000 });
const ids = await dm.evaluate(() => { const r = Sala.room(); return { pj: r.members.find((m) => m.role !== 'dm').id, gob: r.npcs[0].id }; });
await combat(dm); await combat(pj);
ok('antes de empezar: botón de acción, sin escena', await has(dm, '#actBox .cs-acts') && !(await has(dm, '.cs-stage')));
await pj.evaluate(() => Sala.send({ t: 'init', value: 18 }));
await dm.evaluate((g) => Sala.send({ t: 'init', id: g, value: 4 }), ids.gob);
await dm.waitForTimeout(300);
await act(dm, 'salaturn', 'start');
ok('la escena del turno aparece', await until(pj, () => !!document.querySelector('.cs-stage .cs-turn')));
ok('la cinta con los dos y el turno del jugador', await pj.evaluate(() => document.querySelectorAll('.cs-ribbon .cs-chip').length === 2 && document.querySelector('.cs-chip.turn.me') && /es tu turno/.test(document.querySelector('.cs-round').textContent)));
ok('el DM ve la CA del goblin solo cuando es su turno; ahora la del jugador no se muestra sin hoja', await dm.evaluate(() => !!document.querySelector('.cs-stage [data-act="salaturn"][data-v="next"]')));

/* ---------- El jugador: un ataque libre y un hechizo de daño seguro ---------- */
await act(pj, 'actopen'); await pj.waitForTimeout(200);
ok('se abre el paso 1 (¿con qué?) con «Otra cosa»', await has(pj, '.cs-comp.tw [data-act="actfree"]') && await pj.evaluate(() => /¿Con qué\?/.test(document.querySelector('.tw-t b').textContent)));
await act(pj, 'actfree'); await pj.waitForTimeout(150);
ok('«Otra cosa» va a tirar con los números abiertos y los objetivos', await has(pj, '.cs-comp [data-act="acttg"][data-id="' + ids.gob + '"]') && await has(pj, '.cs-comp [data-actf="title"]'));
await field(pj, 'title', 'Espada corta'); await field(pj, 'atkOn', true); await pj.waitForTimeout(100);
await field(pj, 'bonus', '5'); await field(pj, 'dmg', '1d6+3'); await field(pj, 'type', 'perforante');
await target(pj, ids.gob); await submit(pj);
ok('la tarjeta del ataque llega a los dos', await until(dm, () => document.querySelectorAll('.ac-card.pc').length === 1) && await until(pj, () => document.querySelectorAll('.ac-card.pc').length === 1));
ok('dice si impacta o falla', await pj.evaluate(() => !!document.querySelector('.ac-card .ac-badge.hit, .ac-card .ac-badge.miss')));
ok('el DM ve la CA del objetivo; el jugador no', await dm.evaluate(() => /CA 15/.test(document.querySelector('.ac-card .ac-tg').textContent)) && await pj.evaluate(() => !/CA 15/.test(document.querySelector('.ac-card .ac-tg').textContent)));
ok('el resultado sale en grande con «Usar otra cosa»', await until(pj, () => !!document.querySelector('.tw-res .ac-card')));
await pj.evaluate(() => document.querySelector('.tw-res [data-act="actopen"]').click()); await pj.waitForTimeout(150);
await act(pj, 'actfree'); await pj.waitForTimeout(150);
await field(pj, 'title', 'Proyectil mágico'); await field(pj, 'dmg', '3d4+3'); await field(pj, 'type', 'fuerza'); await target(pj, ids.gob); await submit(pj);
ok('sin ataque: se puede aplicar', await until(pj, () => !!document.querySelector('.ac-card [data-act="actapply"][data-v="full"]')));
const amt = await pj.evaluate(() => +document.querySelector('.ac-card [data-act="actapply"][data-v="full"]').textContent.replace(/\D+/g, ''));
ok('el daño está entre 6 y 15', amt >= 6 && amt <= 15);
await pj.evaluate(() => document.querySelector('.ac-card [data-act="actapply"][data-v="full"]').click());
ok('el goblin recibe el daño', await until(dm, (n) => Sala.room().npcs[0].hp === Math.max(0, 7 - n), amt));
ok('la tarjeta lo marca', await until(pj, () => !!document.querySelector('.ac-card .ac-badge.done')));
if (out) await pj.screenshot({ path: out + '-pj-tarjetas.png', fullPage: false });
await act(pj, 'salaturn', 'next');

/* ---------- El DM: la acción del goblin (del Manual) y una salvación ---------- */
ok('turno del goblin: el DM tiene «Su acción»', await until(dm, () => !!document.querySelector('.cs-stage [data-act="actopen"][data-actor]')));
await dm.evaluate(() => document.querySelector('.cs-stage [data-act="actopen"][data-actor]').click()); await dm.waitForTimeout(300);
if (withBest) {
  ok('acciones del Manual en el paso 1', await until(dm, () => document.querySelectorAll('.cs-comp [data-act="actpick"]').length >= 2));
  await dm.evaluate(() => [...document.querySelectorAll('.cs-comp [data-act="actpick"]')].find((b) => /Scimitar|Cimitarra/i.test(b.textContent)).click()); await dm.waitForTimeout(150);
  ok('elegir la cimitarra pasa a ¿A quién?', await dm.evaluate(() => Acciones._comp().step === 'tg'));
  const f = await dm.evaluate(() => Acciones._comp());
  ok('la cimitarra llena el ataque y el daño', f.atkOn && f.bonus === 4 && /1d6\+2/.test(f.dmg.replace(/\s+/g, '')) && f.type === 'cortante');
  if (out) await dm.screenshot({ path: out + '-dm-compositor.png' });
  await target(dm, ids.pj); await dm.waitForTimeout(150);
  ok('tocar al jugador pasa a tirar', await dm.evaluate(() => Acciones._comp().step === 'go' && /contra/.test(document.querySelector('.tw-sum').textContent)));
  await submit(dm);
  ok('al jugador le llega la acción del goblin', await until(pj, () => !!document.querySelector('.ac-card.npc')));
  ok('y un aviso', await pj.evaluate(() => /Goblin: Scimitar/.test(document.getElementById('salaToast').textContent)));
} else console.log('(sin bestiario: se salta la acción del Manual)');
await dm.evaluate(() => Acciones.open({ actor: 'dm' })); await dm.waitForTimeout(150);
await act(dm, 'actfree'); await dm.waitForTimeout(100);
await field(dm, 'title', 'Explota un barril'); await field(dm, 'saveOn', true); await dm.waitForTimeout(100);
await field(dm, 'dc', '12'); await field(dm, 'dmg', '2d6'); await field(dm, 'type', 'fuego'); await target(dm, ids.pj); await submit(dm);
ok('el jugador puede tirar su salvación', await until(pj, () => !!document.querySelector('.ac-card.dm [data-act="actsave"]')));
await pj.evaluate(() => document.querySelector('.ac-card.dm [data-act="actsave"]').click());
ok('su salvación queda en la tarjeta', await until(pj, () => !!document.querySelector('.ac-card.dm .ac-badge.ok, .ac-card.dm .ac-badge.ko')));
ok('y le propone completo o mitad', await pj.evaluate(() => !!document.querySelector('.ac-card.dm [data-act="actapply"].main')));
await pj.evaluate(() => document.querySelector('.ac-card.dm [data-act="actapply"].main').click());
ok('lo recibe', await until(pj, () => !!document.querySelector('.ac-card.dm .ac-badge.done')));
if (out) await pj.screenshot({ path: out + '-pj-salvacion.png' });
if (out) await dm.screenshot({ path: out + '-dm-escena.png' });
ok('el registro lo cuenta', await dm.evaluate(() => Sala.room().log.some((l) => /salvación de Destreza/.test(l.text))));

/* ---------- Con una hoja de verdad (si hay paquete de 5etools): atacar con el arma desde Mi turno ---------- */
const PKG = process.env.DIARIO_PAQUETE || '/mnt/user-data/uploads/6be5287b-diario-5e.json';
if (existsSync(PKG)) {
  const pal = {id:'p', name:'Lyra', level:11, method:'array', base:{str:15,dex:10,con:14,int:8,wis:12,cha:13}, ch:{cls:'Paladin|XPHB', sub:'Oathbreaker|DMG', race:'Aasimar|XPHB', bg:'Soldier|XPHB', bgAbil:{alt:0,picks:['str','con']}},
    rt:{items:[{id:'esp', n:'Espada larga', ref:'item|Longsword|XPHB', k:'wpn', ic:'i-sword', w:1, h:3, slot:'main', eq:'main'}, {id:'pla', n:'Placas', ref:'item|Plate Armor|XPHB', k:'wpn', ic:'i-armor', w:3, h:3, x:2, y:0, slot:'armor', in:'body'}]}};
  const ly = await open('Lyra', 1100, 820, { chars: [pal], active: 'p', tab: 'personaje', left: 'personaje' });
  await ly.evaluate(async (lib) => {
    await new Promise((res) => { const r = indexedDB.open('diario5e', 2); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); }; r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(lib, 'lib'); t.oncomplete = () => { r.result.close(); res(); }; }; });
  }, JSON.parse(readFileSync(PKG, 'utf8')));
  await ly.reload(); await ly.waitForTimeout(2500);
  await ly.evaluate((c) => Sala.join(c, { char: 'p' }), code);
  await ly.waitForFunction(() => Sala.status() === 'on' && Sala.room() && Sala.room().members.some((m) => m.char && m.char.name === 'Lyra'), null, { timeout: 8000 });
  await ly.evaluate(() => Sala.send({ t: 'init', roll: 'n' })); await ly.waitForTimeout(400);
  await combat(ly); await ly.evaluate(() => document.querySelector('[data-act="csub"][data-v="turno"]').click()); await ly.waitForTimeout(300);
  ok('en Mi turno, el arma tiene «Atacar»', await has(ly, '.wpn [data-act="actpick"][data-k="w:esp"]'));
  await ly.evaluate(() => document.querySelector('.wpn [data-act="actpick"][data-k="w:esp"]').click());
  ok('se abre la escena con la espada lista', await until(ly, () => { const k = Acciones._comp(); return !!k && k.key === 'w:esp' && k.atkOn && k.bonus > 0 && /1d(8|10)/.test(k.dmg) && !!document.querySelector('.cs-comp'); }));
  ok('salta directo a ¿A quién? (paso 2)', await ly.evaluate(() => Acciones._comp().step === 'tg' && !!document.querySelector('.tw-tgs')));
  if (out) await ly.screenshot({ path: out + '-lyra-compositor.png' });
  await target(ly, ids.gob); await submit(ly);
  ok('la tarjeta de Lyra con su espada', await until(dm, () => [...document.querySelectorAll('.ac-card.pc')].some((c) => /Lyra/.test(c.textContent) && /Espada larga/.test(c.textContent))));
  ok('con el daño radiante aparte', await dm.evaluate(() => { const c = [...document.querySelectorAll('.ac-card.pc')].find((x) => /Espada larga/.test(x.textContent)); return /radiante/.test(c.textContent) && /cortante/.test(c.textContent); }));
} else console.log('(sin paquete de 5etools: se salta la hoja de verdad)');

await browser.close(); await srv.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('Combate: todo bien (' + engine + ')');
