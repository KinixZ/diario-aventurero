import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mesa } from './helpers.mjs';
import { memoryStore } from '../../server/store.mjs';
import { Campaigns } from '../../server/campaigns.mjs';

const to = (n, id) => n.filter((x) => x.to === id).map((x) => x.msg);
const MAPA = (id, name, extra = {}) => ({ id, name, cols: 20, rows: 14, grid: 'square', layers: [{ id: 'l1', name: 'Capa 1' }], strokes: [], ...extra });
const tokOf = (c, mid, name) => c.maps.get(mid).tokens.find((t) => t.name === name);

async function puente() {
  const ctx = await mesa(), { R, c, dm, a, b } = ctx;
  R.act(c, dm.id, { t: 'map.save', map: MAPA('mapa-camino', 'Camino') });
  R.act(c, dm.id, { t: 'map.save', map: MAPA('mapa-puente', 'Puente', { hidden: true }) });
  R.act(c, dm.id, { t: 'scene.set', id: 'mapa-camino' });
  R.act(c, a.id, { t: 'tok.add', id: 'mapa-camino', tok: { kind: 'pc', name: 'Lyra', x: 3, y: 3 } });
  R.act(c, b.id, { t: 'tok.add', id: 'mapa-camino', tok: { kind: 'pc', name: 'Bram', x: 5, y: 3 } });
  return ctx;
}
const ENC = {
  name: 'Emboscada en el puente', map: 'mapa-puente', notes: 'Los goblins esperan bajo el puente',
  npcs: [
    { k: 'g1', name: 'Goblin 1', ac: 15, hp: 7, ref: 'Goblin|XMM', initMod: 2, x: 12, y: 4 },
    { k: 'g2', name: 'Goblin 2', ac: 15, hp: 7, ref: 'Goblin|XMM', initMod: 2, x: 13, y: 4 },
    { k: 'j1', name: 'Jefe goblin', ac: 17, hp: 21, initMod: 1, x: 14, y: 8, wave: 2 },
    { k: 'l1', name: 'Lobo 1', ac: 13, hp: 11, initMod: 2, wave: 3 },
  ],
  deploy: [{ x: 1, y: 1, w: 3, h: 3, name: 'Orilla' }],
  waves: [{ n: 2, name: 'El jefe', round: 2 }, { n: 3, name: 'Los lobos' }],
};

test('estados del mapa: preparación lo oculta, exploración lo muestra; el viejo «ocultar» es lo mismo', async () => {
  const { R, c, dm, a } = await puente();
  const p = c.maps.get('mapa-puente');
  assert.equal(p.state, 'prep'); assert.equal(R.view(c, a.id).maps.some((m) => m.id === 'mapa-puente'), false);
  let n = R.act(c, dm.id, { t: 'map.state', id: 'mapa-puente', state: 'explore' });
  assert.equal(p.hidden, false);
  assert.ok(to(n, a.id).some((m) => m.t === 'map' && m.map.id === 'mapa-puente' && m.map.state === 'explore'), 'al jugador le llega el mapa');
  assert.ok(to(n, a.id).some((m) => m.t === 'map.play' && m.state === 'explore'));
  assert.equal(R.view(c, a.id).maps.find((m) => m.id === 'mapa-puente').state, 'explore');
  R.act(c, dm.id, { t: 'map.hide', id: 'mapa-puente', value: true });
  assert.equal(p.state, 'prep');
  assert.throws(() => R.act(c, a.id, { t: 'map.state', id: 'mapa-camino', state: 'combat' }), /Solo el DM/);
  // mostrarlo a todos lo pasa a exploración
  R.act(c, dm.id, { t: 'scene.set', id: 'mapa-puente' });
  assert.equal(p.state, 'explore');
  // se guarda
  const c2 = R.fromDoc(JSON.parse(JSON.stringify(R.toDoc(c))));
  assert.equal(c2.maps.get('mapa-puente').state, 'explore');
});

test('congelar: nadie más que el DM se mueve; luego sí', async () => {
  const { R, c, dm, a } = await puente();
  const lyra = tokOf(c, 'mapa-camino', 'Lyra');
  let n = R.act(c, dm.id, { t: 'map.play', id: 'mapa-camino', frozen: true });
  assert.ok(to(n, a.id).some((m) => m.t === 'map.play' && m.frozen));
  n = R.act(c, a.id, { t: 'tok.move', id: 'mapa-camino', tid: lyra.id, x: 8, y: 8 });
  assert.equal(lyra.x, 3, 'no se movió');
  assert.equal(to(n, a.id).find((m) => m.t === 'error').code, 'frozen');
  assert.equal(to(n, a.id).find((m) => m.t === 'tok').tok.x, 3, 'la ficha vuelve a su lugar');
  R.act(c, dm.id, { t: 'tok.move', id: 'mapa-camino', tid: lyra.id, x: 6, y: 6 });
  assert.equal(lyra.x, 6, 'el DM sí la mueve');
  // «traer mi ficha» tampoco la teletransporta
  R.act(c, a.id, { t: 'tok.add', id: 'mapa-camino', tok: { kind: 'pc', name: 'Lyra', x: 1, y: 1 } });
  assert.equal(lyra.x, 6);
  R.act(c, dm.id, { t: 'map.play', id: 'mapa-camino', frozen: false });
  R.act(c, a.id, { t: 'tok.move', id: 'mapa-camino', tid: lyra.id, x: 8, y: 8 });
  assert.equal(lyra.x, 8);
});

test('encuentro: se guarda, se usa, llegan los enemigos a su lugar y el mapa pasa a combate con su zona de despliegue', async () => {
  const { R, c, dm, a, b } = await puente();
  let n = R.act(c, dm.id, { t: 'enc.save', enc: ENC });
  const e = to(n, dm.id).find((m) => m.t === 'enc').enc;
  assert.match(e.id, /^E/); assert.equal(e.npcs.length, 4); assert.equal(e.deploy[0].k, 'despliegue');
  assert.equal(e.npcs.find((x) => x.k === 'l1').x, undefined, 'el lobo no tiene lugar');
  assert.throws(() => R.act(c, a.id, { t: 'enc.save', enc: ENC }), /Solo el DM/);
  assert.equal(R.view(c, a.id).encs, undefined, 'los jugadores no ven los encuentros');
  assert.deepEqual(R.view(c, dm.id).encs.map((x) => [x.name, x.n, x.placed, x.waves, x.deploy]), [['Emboscada en el puente', 4, 3, 2, 1]]);
  // una oleada que no existe se vuelve la primera
  R.act(c, dm.id, { t: 'enc.save', enc: { ...e, npcs: e.npcs.concat([{ name: 'Rata', hp: 2, wave: 7 }]) } });
  assert.equal(c.encs[0].npcs.find((x) => x.name === 'Rata').wave, 1);
  R.act(c, dm.id, { t: 'enc.save', enc: e });
  assert.equal(c.encs.length, 1, 'guardar otra vez lo reemplaza');

  n = R.act(c, dm.id, { t: 'enc.use', id: e.id });
  const p = c.maps.get('mapa-puente');
  assert.equal(p.state, 'combat'); assert.equal(p.hidden, false);
  assert.deepEqual([...c.npcs.values()].map((x) => x.name).sort(), ['Goblin 1', 'Goblin 2'], 'solo la primera oleada');
  assert.ok([...c.npcs.values()].every((x) => x.at === 'mapa-puente' && x.init == null));
  const g1 = p.tokens.find((t) => t.name === 'Goblin 1');
  assert.deepEqual([g1.x, g1.y, g1.kind], [12, 4, 'npc']);
  assert.equal(c.npcs.get(g1.ref).name, 'Goblin 1');
  const dz = p.trig.find((z) => z.k === 'despliegue');
  assert.deepEqual([dz.x, dz.y, dz.w, dz.h], [1, 1, 3, 3]);
  assert.ok(to(n, a.id).some((m) => m.t === 'combat' && m.map === 'mapa-puente' && m.enc), 'el jugador recibe el aviso');
  assert.ok(R.act(c, a.id, { t: 'map.get', id: 'mapa-puente' })[0].msg.map.trig.some((z) => z.k === 'despliegue'), 'el jugador ve la zona de despliegue');
  assert.deepEqual(R.view(c, dm.id).runs[0].waves.map((w) => [w.n, w.count, w.round]), [[2, 1, 2], [3, 1, 0]]);

  // los jugadores se unen: su ficha (y su compañero) llega a la zona de despliegue
  R.act(c, a.id, { t: 'tok.add', id: 'mapa-camino', tok: { kind: 'pc', comp: 1, name: 'Búho', x: 4, y: 4 } });
  n = R.act(c, a.id, { t: 'enc.join', map: 'mapa-puente' });
  const lyra = tokOf(c, 'mapa-puente', 'Lyra'), buho = tokOf(c, 'mapa-puente', 'Búho');
  assert.ok(lyra && buho, 'pasa con su compañero');
  assert.ok(lyra.x >= 1 && lyra.x <= 3 && lyra.y >= 1 && lyra.y <= 3, 'dentro de la zona');
  assert.equal(c.members.get(a.id).at, 'mapa-puente');
  assert.ok(to(n, a.id).some((m) => m.t === 'goto' && m.map === 'mapa-puente'));
  // se acomodan: dentro de la zona sí, fuera no; sin rodear paredes
  R.act(c, a.id, { t: 'tok.move', id: 'mapa-puente', tid: lyra.id, x: 3, y: 3 });
  assert.deepEqual([lyra.x, lyra.y], [3, 3]);
  n = R.act(c, a.id, { t: 'tok.move', id: 'mapa-puente', tid: lyra.id, x: 9, y: 9 });
  assert.deepEqual([lyra.x, lyra.y], [3, 3]); assert.equal(to(n, a.id).find((m) => m.t === 'error').code, 'deploy');
  // Bram no estaba en el camino con ficha… sí estaba: se une también
  R.act(c, b.id, { t: 'enc.join', map: 'mapa-puente' });
  const bram = tokOf(c, 'mapa-puente', 'Bram');
  assert.ok(bram.x >= 1 && bram.x <= 3 && !(bram.x === lyra.x && bram.y === lyra.y), 'en otro lugar de la zona');
  // no se puede viajar en pleno despliegue
  R.act(c, dm.id, { t: 'trig.add', id: 'mapa-puente', trig: { id: 'zsalida', k: 'paso', x: 2, y: 4, w: 1, h: 1, to: { map: 'mapa-camino' } } });
  assert.throws(() => R.act(c, a.id, { t: 'travel', id: 'mapa-puente', zid: 'zsalida' }), /por empezar/);

  // iniciativa: escrita o tirada en el servidor; el DM tira la de los enemigos (una por tipo)
  R.act(c, a.id, { t: 'init', roll: 'adv' });
  const ia = c.members.get(a.id).init;
  assert.ok(ia >= 3 && ia <= 22, 'd20 + 2: ' + ia);
  assert.match(c.log.at(-1).text, /Lyra tiró iniciativa: \d+ \(\d+ y \d+, con ventaja \+ 2\)/);
  R.act(c, b.id, { t: 'init', value: 30 });
  assert.throws(() => R.act(c, a.id, { t: 'init.npcs' }), /Solo el DM/);
  R.act(c, dm.id, { t: 'init.npcs', group: true });
  const gs = [...c.npcs.values()];
  assert.ok(gs.every((x) => x.init != null)); assert.equal(gs[0].init, gs[1].init, 'los dos goblins comparten tirada');
  assert.throws(() => R.act(c, dm.id, { t: 'init.npcs' }), /ya tienen/);
  assert.throws(() => R.act(c, a.id, { t: 'turn', dir: 'start' }), /DM/);

  // empieza: las zonas de despliegue se van y cada quien se mueve en su turno
  n = R.act(c, dm.id, { t: 'turn', dir: 'start' });
  assert.equal(p.trig.some((z) => z.k === 'despliegue'), false);
  assert.ok(to(n, a.id).some((m) => m.t === 'trigs' && m.del.includes(dz.id)), 'al jugador se le quita la zona');
  assert.equal(c.order[c.turn], b.id, 'Bram (30) va primero');
  n = R.act(c, a.id, { t: 'tok.move', id: 'mapa-puente', tid: lyra.id, x: 6, y: 3 });
  assert.equal(lyra.x, 3); assert.equal(to(n, a.id).find((m) => m.t === 'error').code, 'not_your_turn');
  R.act(c, b.id, { t: 'tok.move', id: 'mapa-puente', tid: bram.id, x: 6, y: 6 });
  assert.equal(bram.x, 6, 'Bram se mueve en su turno');
  // el DM puede soltar el movimiento en combate
  R.act(c, dm.id, { t: 'map.play', id: 'mapa-puente', turnOnly: false });
  R.act(c, a.id, { t: 'tok.move', id: 'mapa-puente', tid: lyra.id, x: 6, y: 3 });
  assert.equal(lyra.x, 6);
  R.act(c, dm.id, { t: 'map.play', id: 'mapa-puente', turnOnly: true });

  // la oleada 2 llega sola al empezar la ronda 2 (con iniciativa, porque el combate ya empezó)
  for (let i = 0; i < c.order.length && c.round < 2; i++) n = R.act(c, dm.id, { t: 'turn', dir: 'next' });
  assert.equal(c.round, 2);
  const jefe = [...c.npcs.values()].find((x) => x.name === 'Jefe goblin');
  assert.ok(jefe && jefe.init != null && c.order.includes(jefe.id), 'el jefe entra al orden');
  assert.deepEqual([tokOf(c, 'mapa-puente', 'Jefe goblin').x, tokOf(c, 'mapa-puente', 'Jefe goblin').y], [14, 8]);
  assert.ok(to(n, a.id).some((m) => m.t === 'wave' && m.n === 2 && m.name === 'El jefe'));
  // la 3 la manda el DM; el lobo sin lugar llega cerca del centro
  assert.throws(() => R.act(c, dm.id, { t: 'enc.wave', map: 'mapa-puente', n: 2 }), /ya llegó/);
  R.act(c, dm.id, { t: 'enc.wave', map: 'mapa-puente', n: 3 });
  const lobo = tokOf(c, 'mapa-puente', 'Lobo 1');
  assert.ok(lobo && Math.abs(lobo.x - 9.5) <= 3 && Math.abs(lobo.y - 6.5) <= 3);
  assert.deepEqual(R.view(c, dm.id).runs[0].waves, []);

  // terminar: el mapa vuelve a exploración y el encuentro en curso se acaba
  R.act(c, dm.id, { t: 'end' });
  assert.equal(p.state, 'explore'); assert.deepEqual(Object.keys(c.runs), []);
  R.act(c, a.id, { t: 'tok.move', id: 'mapa-puente', tid: lyra.id, x: 8, y: 3 });
  assert.equal(lyra.x, 8, 'en exploración se mueve libre');
});

test('encuentro: guardado y en curso se recuperan; usarlo otra vez reemplaza a sus enemigos; sin mapa solo la iniciativa', async () => {
  const store = memoryStore(); await store.init();
  const { R, c, dm } = await mesa({ store });
  R.act(c, dm.id, { t: 'map.save', map: MAPA('mapa-puente', 'Puente', { hidden: true }) });
  const e = to(R.act(c, dm.id, { t: 'enc.save', enc: ENC }), dm.id).find((m) => m.t === 'enc').enc;
  R.act(c, dm.id, { t: 'enc.use', id: e.id });
  R.act(c, dm.id, { t: 'enc.use', id: e.id });
  assert.equal(c.npcs.size, 2, 'no se duplican');
  assert.equal(c.maps.get('mapa-puente').tokens.filter((t) => t.kind === 'npc').length, 2);
  await R.flush(c);
  const R2 = new Campaigns(store), c2 = await R2.open(c.code);
  assert.equal(c2.encs[0].npcs.length, 4);
  assert.equal(c2.runs['mapa-puente'].pend.length, 2, 'las oleadas pendientes siguen');
  assert.equal(c2.maps.get('mapa-puente').state, 'combat');
  assert.equal(c2.maps.get('mapa-puente').trig.filter((z) => z.k === 'despliegue').length, 1);
  // sin mapa: los enemigos llegan a la iniciativa
  const libre = to(R.act(c, dm.id, { t: 'enc.save', enc: { name: 'En la taberna', npcs: [{ name: 'Matón', hp: 11, x: 3, y: 3 }] } }), dm.id).find((m) => m.t === 'enc').enc;
  assert.equal(libre.map, null); assert.equal(libre.npcs[0].x, undefined);
  R.act(c, dm.id, { t: 'enc.use', id: libre.id });
  const maton = [...c.npcs.values()].find((x) => x.name === 'Matón');
  assert.ok(maton && !maton.at); assert.ok(c.runs._);
  R.act(c, dm.id, { t: 'enc.del', id: libre.id });
  assert.equal(c.encs.length, 1);
});

test('salir del combate desde el estado del mapa lo termina ahí; con combate separado, solo el de ese mapa', async () => {
  const { R, c, dm, a, b } = await puente();
  R.act(c, dm.id, { t: 'map.state', id: 'mapa-camino', state: 'combat' });
  assert.equal(c.maps.get('mapa-camino').state, 'combat');
  // sin zonas: colocación libre (atraviesa lo que sea) y sin trampas
  R.act(c, dm.id, { t: 'wall.add', id: 'mapa-camino', walls: [{ id: 'w1', a: [7, 0], b: [7, 14] }] });
  const lyra = tokOf(c, 'mapa-camino', 'Lyra');
  R.act(c, a.id, { t: 'tok.move', id: 'mapa-camino', tid: lyra.id, x: 10, y: 3 });
  assert.equal(lyra.x, 10, 'se acomoda donde quiera');
  R.act(c, a.id, { t: 'init', value: 12 }); R.act(c, b.id, { t: 'init', value: 8 });
  R.act(c, dm.id, { t: 'turn', dir: 'start' });
  assert.equal(c.round, 1);
  R.act(c, dm.id, { t: 'map.state', id: 'mapa-camino', state: 'explore' });
  assert.equal(c.round, 0); assert.equal(c.members.get(a.id).init, null);
  // combate separado: Bram en otro mapa
  R.act(c, dm.id, { t: 'map.save', map: MAPA('mapa-torre', 'Torre') });
  R.act(c, dm.id, { t: 'travel', id: 'mapa-camino', tid: tokOf(c, 'mapa-camino', 'Bram').id, to: { map: 'mapa-torre' } });
  R.act(c, a.id, { t: 'init', value: 12 }); R.act(c, b.id, { t: 'init', value: 8 });
  R.act(c, dm.id, { t: 'fight.split', value: true });
  R.act(c, dm.id, { t: 'turn', dir: 'start', map: 'mapa-camino' });
  R.act(c, dm.id, { t: 'turn', dir: 'start', map: 'mapa-torre' });
  assert.equal(c.maps.get('mapa-camino').state, 'combat'); assert.equal(c.maps.get('mapa-torre').state, 'combat', 'empezar lo pasa a combate');
  R.act(c, dm.id, { t: 'map.state', id: 'mapa-torre', state: 'explore' });
  assert.equal(c.fights['mapa-torre'], undefined); assert.equal(c.fights['mapa-camino'].round, 1, 'el otro combate sigue');
  assert.equal(c.members.get(a.id).init, 12); assert.equal(c.members.get(b.id).init, null);
});
