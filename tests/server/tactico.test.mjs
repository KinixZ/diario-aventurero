import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mesa, pc } from './helpers.mjs';
import { Tactica } from '../../server/tactico.mjs';

const to = (n, id) => n.filter((x) => x.to === id).map((x) => x.msg);
const card = (n, id) => to(n, id).filter((m) => m.t === 'act').map((m) => m.card);
const MAPA = (id, extra = {}) => ({ id, name: 'Cripta', cols: 24, rows: 16, grid: 'square', layers: [{ id: 'l1', name: 'Capa 1' }], strokes: [], ...extra });
const tok = (c, name) => c.maps.get('mapa-cripta').tokens.find((t) => t.name === name);

/* Lyra y Bram en la cripta, dos goblins en el mapa, el combate empezado (turno de Lyra) */
async function cripta(extra) {
  const ctx = await mesa(), { R, c, dm, a, b } = ctx;
  R.act(c, dm.id, { t: 'map.save', map: MAPA('mapa-cripta', extra) });
  R.act(c, a.id, { t: 'tok.add', id: 'mapa-cripta', tok: { kind: 'pc', name: 'Lyra', x: 2, y: 2 } });
  R.act(c, b.id, { t: 'tok.add', id: 'mapa-cripta', tok: { kind: 'pc', name: 'Bram', x: 2, y: 8 } });
  R.act(c, dm.id, { t: 'npc.add', name: 'Goblin', ac: 15, hp: 7, count: 2, map: 'mapa-cripta' });
  const [g1, g2] = [...c.npcs.values()];
  R.act(c, dm.id, { t: 'tok.add', id: 'mapa-cripta', tok: { kind: 'npc', name: g1.name, ref: g1.id, x: 3, y: 2 } });
  R.act(c, dm.id, { t: 'tok.add', id: 'mapa-cripta', tok: { kind: 'npc', name: g2.name, ref: g2.id, x: 12, y: 8 } });
  R.act(c, dm.id, { t: 'map.state', id: 'mapa-cripta', state: 'combat' });
  R.act(c, a.id, { t: 'init', value: 20 }); R.act(c, b.id, { t: 'init', value: 10 }); R.act(c, dm.id, { t: 'init', id: g1.id, value: 5 }); R.act(c, dm.id, { t: 'init', id: g2.id, value: 4 });
  R.act(c, dm.id, { t: 'turn', dir: 'start' });
  return { ...ctx, g1, g2 };
}

test('motor táctico: distancia con altura, áreas cortadas por paredes, cobertura y flanqueo', () => {
  assert.equal(Tactica.dist({ x: 0, y: 0 }, { x: 1, y: 1 }), 1, 'diagonal: 1,5 m');
  assert.equal(Tactica.dist({ x: 0, y: 0 }, { x: 1, y: 0, z: 4 }), 4, 'volando a 6 m');
  assert.equal(Tactica.dist({ x: 0, y: 0, s: 2 }, { x: 3, y: 0 }), 2, 'una ficha grande');
  const mp = { cols: 20, rows: 20, wrev: 1, tokens: [], walls: [{ id: 'w', a: [10, 0], b: [10, 20], t: 'wall' }] };
  const bola = Tactica.area(mp, { t: 'sphere', x: 8, y: 8, r: 4 });
  assert.ok(bola.length > 20 && bola.every((p) => p[0] < 10), 'la pared corta la bola de fuego');
  const cono = Tactica.area(mp, { t: 'cone', x: 2, y: 5.5, a: 0, l: 3 });
  assert.ok(cono.some((p) => p[0] === 4 && p[1] === 5) && !cono.some((p) => p[0] < 2), 'el cono sale hacia delante');
  assert.equal(Tactica.cover(mp, { x: 5, y: 5 }, { x: 14, y: 5 }), 'total', 'detrás de la pared: cobertura total');
  assert.equal(Tactica.cover(mp, { x: 2, y: 5 }, { x: 6, y: 5 }), 0);
  const bajo = { cols: 20, rows: 20, wrev: 1, walls: [{ id: 'l', a: [4, 4], b: [4, 7], t: 'low' }] };
  assert.equal(Tactica.cover(bajo, { x: 2, y: 5 }, { x: 5, y: 5 }), 2, 'muro bajo: media cobertura');
  assert.equal(Tactica.cover({ cols: 20, rows: 20 }, { x: 2, y: 5 }, { x: 6, y: 5 }, [{ x: 4, y: 5 }]), 2, 'una criatura en medio');
  assert.ok(Tactica.flanks({ x: 4, y: 5 }, { x: 6, y: 5 }, { x: 5, y: 5 }), 'lados opuestos');
  assert.ok(!Tactica.flanks({ x: 5, y: 4 }, { x: 6, y: 5 }, { x: 5, y: 5 }), 'lados vecinos no');
  const r = Tactica.walk({ cols: 10, rows: 5, trig: [{ k: 'dificil', x: 3, y: 0, w: 2, h: 5 }] }, { x: 0, y: 2 }, 7, 2);
  assert.equal(r.cost, 9, 'dos casillas de terreno difícil cuestan el doble');
  assert.equal(Tactica.walk({ cols: 10, rows: 5, trig: [{ k: 'dificil', x: 3, y: 0, w: 2, h: 5 }] }, { x: 0, y: 2, z: 2 }, 7, 2, { fly: true }).cost, 7, 'volando no cuenta');
  const m = Tactica.attackMods({ att: { conds: ['poisoned'] }, tgt: { conds: ['paralyzed'] }, near: true });
  assert.equal(m.k, null, 'ventaja y desventaja se anulan'); assert.ok(m.crit, 'paralizado a 1,5 m: crítico');
  assert.ok(Tactica.saveMods(['stunned'], 'dex').fail); assert.equal(Tactica.saveMods(['restrained'], 'dex').k, 'dis');
});

test('movimiento por velocidad: se gasta en la ronda, Correr duplica, el terreno difícil cobra doble y el DM no tiene límite', async () => {
  const { R, c, dm, a, b } = await cripta({ trig: [{ id: 'zpiedras', k: 'dificil', x: 6, y: 0, w: 2, h: 16, name: 'Escombros' }] });
  const L = tok(c, 'Lyra');
  // Lyra tiene 9 m (6 casillas): de x=2 a x=5 gasta 3
  let n = R.act(c, a.id, { t: 'tok.move', id: 'mapa-cripta', tid: L.id, x: 2, y: 5 });
  assert.equal(L.y, 5); assert.equal(to(n, a.id).find((m) => m.t === 'mv').u, 3);
  // 2 casillas de escombros cuestan 4: de x=2 a x=8 serían 8 → no alcanza
  n = R.act(c, a.id, { t: 'tok.move', id: 'mapa-cripta', tid: L.id, x: 8, y: 5 });
  assert.equal(L.x, 2, 'la ficha vuelve'); assert.match(to(n, a.id).find((m) => m.t === 'error').msg, /Te quedan 4,5 m/);
  R.act(c, a.id, { t: 'mv.set', id: 'mapa-cripta', tid: L.id, dash: true });
  n = R.act(c, a.id, { t: 'tok.move', id: 'mapa-cripta', tid: L.id, x: 8, y: 5 });
  assert.equal(L.x, 8, 'corriendo sí llega'); assert.equal(c.mv[L.id].u, 11);
  assert.ok(R.view(c, a.id).mv[L.id].max === 12, 'la vista dice cuánto le queda');
  // el DM mueve sin límite
  R.act(c, dm.id, { t: 'tok.move', id: 'mapa-cripta', tid: tok(c, 'Bram').id, x: 20, y: 8 });
  assert.equal(tok(c, 'Bram').x, 20);
  // en la ronda siguiente el movimiento vuelve
  R.act(c, a.id, { t: 'turn' }); R.act(c, dm.id, { t: 'turn' }); R.act(c, dm.id, { t: 'turn' }); R.act(c, dm.id, { t: 'turn' });
  assert.equal(c.round, 2);
  R.act(c, a.id, { t: 'tok.move', id: 'mapa-cripta', tid: L.id, x: 9, y: 5 });
  assert.equal(c.mv[L.id].u, 1);
  // agarrado: velocidad 0
  R.act(c, a.id, { t: 'char', char: { ...pc('Lyra'), conds: ['grappled'] } });
  n = R.act(c, a.id, { t: 'tok.move', id: 'mapa-cripta', tid: L.id, x: 10, y: 5 });
  assert.match(to(n, a.id).find((m) => m.t === 'error').msg, /velocidad es 0/);
});

test('ataque de oportunidad: salir del alcance de un goblin avisa al DM (salvo con Retirarse); altura en el panel', async () => {
  const { R, c, dm, a, g1 } = await cripta();
  const L = tok(c, 'Lyra');
  let n = R.act(c, a.id, { t: 'tok.move', id: 'mapa-cripta', tid: L.id, x: 2, y: 6 });
  const oa = to(n, dm.id).find((m) => m.t === 'oa');
  assert.equal(oa.by, g1.id); assert.equal(oa.target, a.id);
  assert.match(c.log.at(-1).text, /ataque de oportunidad/);
  // vuelve junto al goblin y se retira: no provoca
  R.act(c, dm.id, { t: 'tok.move', id: 'mapa-cripta', tid: L.id, x: 2, y: 3 });
  R.act(c, a.id, { t: 'mv.set', id: 'mapa-cripta', tid: L.id, dis: true });
  n = R.act(c, a.id, { t: 'tok.move', id: 'mapa-cripta', tid: L.id, x: 2, y: 6 });
  assert.ok(!to(n, dm.id).some((m) => m.t === 'oa'));
  // volar: la altura viaja con la ficha
  R.act(c, a.id, { t: 'tok.set', id: 'mapa-cripta', tid: L.id, z: 4 });
  assert.equal(L.z, 4);
  R.act(c, a.id, { t: 'tok.set', id: 'mapa-cripta', tid: L.id, z: 0 });
  assert.equal(L.z, undefined);
});

test('cobertura en el mapa: detrás de una pared no impacta; la media cobertura suma a la CA y a la salvación de Destreza', async () => {
  const { R, c, dm, a, g1, g2 } = await cripta({ walls: [{ id: 'w1', a: [8, 6], b: [8, 12], t: 'wall' }, { id: 'w2', a: [10, 0], b: [10, 5], t: 'low' }] });
  let n = R.act(c, a.id, { t: 'act.post', act: { title: 'Arco largo', map: 'mapa-cripta', atk: { bonus: 30 }, dmg: [{ dice: '1d8+3', type: 'perforante' }], targets: [g2.id] } });
  // Lyra (2,2) contra el goblin 2 (12,8): la pared de x=8 no tapa del todo; el arco con +30 impacta salvo pifia
  let k = card(n, dm.id)[0];
  assert.equal(k.map, 'mapa-cripta'); assert.deepEqual(k.from.slice(0, 2), [2.5, 2.5]);
  assert.deepEqual(k.targets[0].at.slice(0, 2), [12.5, 8.5]);
  // ahora Bram (2,8) contra el goblin 2 (12,8): la pared está justo en medio
  n = R.act(c, dm.id, { t: 'act.post', act: { actor: g2.id, title: 'Arco corto', map: 'mapa-cripta', atk: { bonus: 30 }, targets: [c.members.get(a.id) ? [...c.members.values()].find((m) => m.name === 'Bram').id : null] } });
  k = card(n, dm.id)[0];
  assert.equal(k.targets[0].cover, 'total'); assert.equal(k.targets[0].hit, false);
  // salvación de Destreza con media cobertura (muro bajo): +2 a la tirada
  R.act(c, dm.id, { t: 'tok.move', id: 'mapa-cripta', tid: tok(c, g1.name).id, x: 11, y: 2 });
  n = R.act(c, a.id, { t: 'act.post', act: { title: 'Bola de fuego', map: 'mapa-cripta', area: { t: 'sphere', x: 11.5, y: 2.5, r: 1 }, save: { ab: 'dex', dc: 15 }, dmg: [{ dice: '8d6', type: 'fuego' }], targets: [g1.id] } });
  k = card(n, dm.id)[0];
  assert.equal(k.area.t, 'sphere');
  assert.equal(k.targets[0].cover, undefined, 'el área explota del otro lado del muro: sin cobertura');
  R.act(c, a.id, { t: 'act.post', act: { title: 'Rayo de escarcha', map: 'mapa-cripta', save: { ab: 'dex', dc: 15 }, targets: [g1.id] } });
  const k2 = c.acts.at(-1); assert.equal(k2.targets[0].cover, 2);
  R.act(c, dm.id, { t: 'act.save', id: k2.id, tid: g1.id, mod: 1 });
  assert.equal(k2.targets[0].sv.mod, 3); assert.equal(k2.targets[0].sv.cov, 2);
});

test('estados con salvación repetida y concentración: Inmovilizar persona, perder la concentración quita el estado', async () => {
  const { R, c, dm, a, b, g1 } = await cripta();
  let n = R.act(c, a.id, { t: 'act.post', act: { title: 'Inmovilizar persona', save: { ab: 'wis', dc: 30 }, conds: ['paralyzed'], repeat: true, conc: true, targets: [g1.id] } });
  const k = c.acts.at(-1);
  assert.ok(k.conc && k.repeat); assert.deepEqual(k.conds, ['paralyzed']);
  assert.equal(c.concs[a.id].title, 'Inmovilizar persona');
  R.act(c, dm.id, { t: 'act.save', id: k.id, tid: g1.id, mod: 0 });
  if (k.targets[0].sv.ok) k.targets[0].sv.ok = false; // CD 30: solo un 20 la supera; para la prueba, falla
  assert.throws(() => R.act(c, b.id, { t: 'act.cond', id: k.id, tid: g1.id }), /Cada quien/);
  R.act(c, a.id, { t: 'act.cond', id: k.id, tid: g1.id });
  assert.ok(g1.conds.includes('paralyzed')); assert.equal(c.effs.length, 1);
  // al terminar el turno del goblin, repite la salvación (le llega su tarjeta al DM)
  R.act(c, a.id, { t: 'turn' }); R.act(c, b.id, { t: 'turn' });
  n = R.act(c, dm.id, { t: 'turn' });
  const rep = card(n, dm.id).find((x) => x.eff);
  assert.ok(rep, 'tarjeta de salvación repetida'); assert.equal(rep.save.dc, 30); assert.equal(rep.targets[0].id, g1.id);
  // Lyra recibe daño: salvación de concentración (CD 10 o la mitad)
  n = R.act(c, dm.id, { t: 'act.post', act: { actor: g1.id, title: 'Cimitarra', dmg: [{ dice: '24' }], targets: [a.id] } });
  R.act(c, a.id, { t: 'char', char: { ...pc('Lyra'), conc: 'Inmovilizar persona' } });
  n = R.act(c, a.id, { t: 'act.apply', id: c.acts.at(-1).id, tid: a.id, how: 'full' });
  const chk = card(n, a.id).find((x) => x.concChk);
  assert.equal(chk.save.ab, 'con'); assert.equal(chk.save.dc, 12);
  // la falla: se acaba la concentración, el goblin deja de estar paralizado y la hoja de Lyra recibe conc-
  R.act(c, a.id, { t: 'act.save', id: chk.id, tid: a.id, mod: -30 });
  assert.ok(!g1.conds.includes('paralyzed')); assert.equal(c.effs.length, 0); assert.equal(c.concs[a.id], undefined);
  assert.ok(R.act(c, a.id, { t: 'char', char: { ...pc('Lyra') } }));
});

test('zonas de conjuro: se quedan en el mapa, las ve todo el grupo, dañan al entrar y al terminar el turno, y terminan con la concentración', async () => {
  const { R, c, dm, a, b, g1, g2 } = await cripta();
  let n = R.act(c, a.id, { t: 'act.post', act: { title: 'Nube de dagas', map: 'mapa-cripta', area: { t: 'cube', x: 12, y: 7, w: 1 }, dmg: [{ dice: '4d4', type: 'cortante' }], conc: true, zone: { on: ['enter', 'end'], move: true }, targets: [g2.id] } });
  const z = c.maps.get('mapa-cripta').fx[0];
  assert.equal(z.name, 'Nube de dagas'); assert.equal(z.ck, a.id); assert.ok(z.conc && z.move);
  assert.ok(to(n, b.id).some((m) => m.t === 'fx' && m.put[0].id === z.id), 'el grupo ve la zona');
  assert.equal(R.mapView(c.maps.get('mapa-cripta'), b).fx.length, 1);
  // el goblin 1 entra a la nube: su tarjeta con el daño ya tirado (la aplica Lyra o el DM)
  n = R.act(c, dm.id, { t: 'tok.move', id: 'mapa-cripta', tid: tok(c, g1.name).id, x: 12, y: 7 });
  const hit = card(n, dm.id).find((x) => x.zone === z.id);
  assert.ok(hit && hit.amt >= 4 && hit.amt <= 16); assert.equal(hit.by, a.id); assert.equal(hit.targets[0].id, g1.id);
  R.act(c, a.id, { t: 'act.apply', id: hit.id, tid: g1.id, how: 'full' });
  // al terminar su turno ahí, ya no (una vez por turno: entró en el turno de Lyra; termina en el suyo → sí)
  R.act(c, a.id, { t: 'turn' }); R.act(c, b.id, { t: 'turn' });
  n = R.act(c, dm.id, { t: 'turn' });
  assert.ok(card(n, dm.id).some((x) => x.zone === z.id && x.text.includes('termina su turno')));
  // mover la nube (Lyra) alcanza a quien queda dentro
  R.act(c, dm.id, { t: 'tok.move', id: 'mapa-cripta', tid: tok(c, g1.name).id, x: 15, y: 7 });
  n = R.act(c, a.id, { t: 'fx.move', id: 'mapa-cripta', fid: z.id, x: 15, y: 7 });
  assert.ok(card(n, a.id).some((x) => x.zone === z.id && /queda dentro/.test(x.text)));
  assert.throws(() => R.act(c, b.id, { t: 'fx.move', id: 'mapa-cripta', fid: z.id, x: 1, y: 1 }), /no es tuya/);
  // Lyra deja de concentrarse en su hoja: la nube desaparece
  R.act(c, a.id, { t: 'char', char: { ...pc('Lyra'), conc: 'Nube de dagas' } });
  n = R.act(c, a.id, { t: 'char', char: { ...pc('Lyra') } });
  assert.equal(c.maps.get('mapa-cripta').fx.length, 0);
  assert.ok(to(n, b.id).some((m) => m.t === 'fx' && m.del.includes(z.id)));
});

test('terreno difícil: zona del DM que ven los jugadores; Espíritus guardianes sigue a la ficha', async () => {
  const { R, c, dm, a, b, g1 } = await cripta();
  R.act(c, dm.id, { t: 'trig.add', id: 'mapa-cripta', trig: { k: 'dificil', x: 4, y: 0, w: 2, h: 16, name: 'Barro' } });
  assert.ok(R.mapView(c.maps.get('mapa-cripta'), b).trig.some((z) => z.k === 'dificil'), 'los jugadores lo ven');
  R.act(c, a.id, { t: 'act.post', act: { title: 'Espíritus guardianes', map: 'mapa-cripta', save: { ab: 'wis', dc: 14, half: true }, dmg: [{ dice: '3d8', type: 'radiante' }], conc: true, zone: { follow: true, r: 3, on: ['enter', 'end'] }, targets: [] } });
  const z = c.maps.get('mapa-cripta').fx[0];
  assert.equal(z.tok, tok(c, 'Lyra').id); assert.equal(z.r, 3);
  // Lyra se acerca al goblin 2 (12,8): la emanación lo alcanza
  R.act(c, dm.id, { t: 'tok.move', id: 'mapa-cripta', tid: tok(c, 'Lyra').id, x: 9, y: 8 });
  assert.ok(c.acts.some((x) => x.zone === z.id && x.targets[0].name === 'Goblin 2'));
});

test('salvación contra la muerte en el servidor y dados físicos', async () => {
  const { R, c, dm, a, g1 } = await cripta();
  assert.throws(() => R.act(c, a.id, { t: 'death' }), /0 PG/);
  R.act(c, a.id, { t: 'char', char: { ...pc('Lyra'), hp: 0 } });
  let n = R.act(c, a.id, { t: 'death', man: 20 });
  const ap = to(n, a.id).find((m) => m.t === 'applied');
  assert.equal(ap.kind, 'death'); assert.equal(ap.amount, 20);
  assert.equal(c.acts.at(-1).death.res, 'revive');
  // dados físicos: el d20 y el total del daño que escribió el jugador
  n = R.act(c, a.id, { t: 'act.post', act: { title: 'Espada', atk: { bonus: 5, k: 'adv' }, man: { d20: [3, 17], dmg: [9] }, dmg: [{ dice: '1d8+3', type: 'cortante' }], targets: [g1.id] } });
  const k = c.acts.at(-1);
  assert.equal(k.atk.nat, 17); assert.equal(k.atk.total, 22); assert.equal(k.amt, 9); assert.ok(k.man);
  // contra un paralizado a 1,5 m, el impacto es crítico (dobla los dados)
  R.act(c, a.id, { t: 'act.post', act: { title: 'Espada', atk: { bonus: 30, autoCrit: true }, dmg: [{ dice: '1d8', type: 'cortante' }], targets: [g1.id] } });
  const k2 = c.acts.at(-1);
  if (!k2.atk.fumble) { assert.ok(k2.atk.crit); assert.equal(k2.dmg[0].dice, '2d8'); }
});
