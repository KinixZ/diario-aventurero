// Combate táctico en el mapa (módulo 9), encima de las campañas. Lo instala campaigns.mjs en su clase.
//  - Movimiento por velocidad: cada ficha de personaje gasta casillas en su ronda (el terreno difícil cuesta el doble,
//    volando no cuenta); Correr duplica, Retirarse evita los ataques de oportunidad y levantarse cuesta la mitad.
//  - Ataques de oportunidad: al salir del alcance de un enemigo se avisa a quien lo controla (con su tirada lista).
//  - Altura: las fichas pueden volar (z, en casillas); cuenta para el alcance y la distancia.
//  - Cobertura automática con las paredes (y criaturas en medio) para ataques y salvaciones de Destreza.
//  - Zonas de conjuro que se quedan en el mapa (Espíritus guardianes, Nube de dagas…): todos las ven, pueden ser terreno
//    difícil, y quien entra, empieza o termina su turno ahí recibe su tarjeta con la salvación y los dados ya tirados.
//  - Estados que imponen las acciones (con salvación repetida al final de cada turno) y la concentración (al recibir
//    daño, salvación de Constitución; perderla termina sus zonas y sus estados).
//  - Salvaciones contra la muerte tiradas en el servidor; la hoja de cada jugador lleva la cuenta.
import { createRequire } from 'node:module';
const Tactica = createRequire(import.meta.url)('../web/src/tactica.cjs');
export { Tactica };

const FX_MAX = 30, EFFS_MAX = 100, SHAPES = ['sphere', 'cylinder', 'cube', 'cone', 'line'], ZONE_ON = ['enter', 'end', 'start'];

export function installTactico(P, H) {
  const { str, int, num, err, d20, rollDice, id, applyTo, COND_ES, AB_ES, DMG_TYPES, stateOf } = H;

  /* ---------- Formas de área (en casillas) ---------- */
  function cleanShape(sh, mp) {
    if (!sh || typeof sh !== 'object' || !SHAPES.includes(sh.t)) return null;
    const o = { t: sh.t, x: num(sh.x, -2, mp.cols + 2, 0), y: num(sh.y, -2, mp.rows + 2, 0) };
    if (sh.t === 'sphere' || sh.t === 'cylinder') o.r = num(sh.r, 0.5, 60, 1);
    else if (sh.t === 'cube') o.w = num(sh.w, 1, 60, 1);
    else { o.a = num(sh.a, -7, 7, 0); o.l = num(sh.l, 1, 120, 1); if (sh.t === 'line') o.w = num(sh.w, 1, 12, 1); }
    return o;
  }
  H.cleanShape = cleanShape;
  const ctr = (t) => { const s = t.s || 1; return [Math.round((t.x + s / 2) * 100) / 100, Math.round((t.y + s / 2) * 100) / 100, t.z || 0]; };

  /* ---------- Quién es cada ficha ---------- */
  P.tokOf = function (c, mp, cid) { return mp.tokens.find((t) => (t.kind === 'npc' && t.ref === cid) || (t.kind === 'pc' && !t.comp && t.ref === cid)) || null; };
  P.whoTok = function (c, t) {
    if (t.kind === 'npc') { const n = t.ref && c.npcs.get(t.ref); return n ? { id: n.id, kind: 'npc', name: n.name, conds: n.conds || [], hidden: !!(n.hidden || t.hidden), reach: n.reach || 1, npc: n, down: n.hp <= 0 } : null; }
    if (t.kind === 'pc' && !t.comp) { const m = c.members.get(t.ref); if (!m || m.role === 'dm') return null; const ch = m.char || {}; return { id: m.id, kind: 'pc', name: ch.name || m.name, conds: ch.conds || [], reach: ch.reach || 1, m, down: ch.hpMax > 1 && ch.hp <= 0 }; }
    return null;
  };
  P.inFight = function (c, mp) { return stateOf(mp) === 'combat' && this.started(c, mp); };

  /* ---------- Movimiento por velocidad ---------- */
  P.mvKey = function (c, mp) { const r = c.split ? (c.fights[mp.id] || {}).round || 0 : c.round; return c.fightN + ':' + r; };
  P.mvOf = function (c, mp, t) { const k = this.mvKey(c, mp); let v = c.mv[t.id]; if (!v || v.k !== k) v = c.mv[t.id] = { k, m: mp.id, u: 0, dash: false, dis: false }; return v; };
  /* Velocidad en casillas (de la hoja): 0 si un estado la anula; el cansancio quita 1,5 m por nivel */
  P.speedOf = function (c, t) {
    const m = t.kind === 'pc' && !t.comp ? c.members.get(t.ref) : null; if (!m || !m.char) return null;
    const ch = m.char; if (Tactica.speed0(ch.conds)) return 0;
    return Math.max(0, Math.floor((ch.speed || 9) / 1.5 + 1e-6) - (ch.exh || 0));
  };
  P.moveLimited = function (c, mp, t, isDm) { return !isDm && t.kind === 'pc' && !t.comp && this.inFight(c, mp) && !(mp.tac && mp.tac.mov === false); };
  /* El camino de la ficha a (nx, ny): rodeando paredes, con el costo del terreno; con límite, cuánto le queda */
  P.walkFor = function (c, mp, t, nx, ny, limit) {
    const r = Tactica.walk(mp, t, nx, ny, { fly: (t.z || 0) > 0 });
    if (!r.ok) return { err: ['blocked', 'Hay una pared en medio: por ahí no se llega.'] };
    const cells = r.cells || Tactica.line(t.x, t.y, nx, ny);
    if (!limit) return { cells, cost: r.cost };
    const sp = this.speedOf(c, t); if (sp == null) return { cells, cost: r.cost };
    const mv = this.mvOf(c, mp, t), left = sp * (mv.dash ? 2 : 1) - mv.u;
    if (r.cost > left + 1e-6) {
      const diff = r.cost > Math.max(Math.abs(Math.round(nx) - Math.round(t.x)), Math.abs(Math.round(ny) - Math.round(t.y)));
      return { err: ['speed', left <= 0 ? (sp ? 'Ya usaste todo tu movimiento en esta ronda.' : 'No puedes moverte (tu velocidad es 0).') : `Te quedan ${Tactica.meters(left)} m de movimiento y ahí son ${Tactica.meters(r.cost)} m${diff ? ' (con terreno difícil)' : ''}.`] };
    }
    return { cells, cost: r.cost, mv };
  };
  /* Lo que lleva gastado cada ficha en su ronda (cada quien ve las suyas; el DM, todas) */
  P.mvView = function (c, forId) {
    const me = c.members.get(forId), dm = !!me && me.role === 'dm', o = {};
    for (const [tid, v] of Object.entries(c.mv || {})) {
      const mp = c.maps.get(v.m); if (!mp || v.k !== this.mvKey(c, mp)) continue;
      const t = mp.tokens.find((x) => x.id === tid); if (!t || (!dm && t.ref !== forId && t.by !== forId)) continue;
      const sp = this.speedOf(c, t);
      o[tid] = { u: v.u, dash: v.dash, dis: v.dis, max: sp == null ? null : sp * (v.dash ? 2 : 1) };
    }
    return o;
  };
  P.sendMv = function (c, mp, t, out) {
    const v = c.mv[t.id]; if (!v) return; const sp = this.speedOf(c, t), msg = { t: 'mv', id: mp.id, tid: t.id, u: v.u, dash: v.dash, dis: v.dis, max: sp == null ? null : sp * (v.dash ? 2 : 1) };
    for (const mm of c.members.values()) if (mm.role === 'dm' || mm.id === t.ref || mm.id === t.by) out.push({ to: mm.id, msg });
  };

  /* ---------- Ataques de oportunidad ---------- */
  P.oaCheck = function (c, mp, t, cells, out) {
    if ((mp.tac && mp.tac.oa === false) || !this.inFight(c, mp)) return;
    const me = this.whoTok(c, t); if (!me || me.down) return;
    const mv = c.mv[t.id]; if (mv && mv.k === this.mvKey(c, mp) && mv.dis) return;
    const foes = mp.tokens.filter((x) => x !== t && x.kind !== 'obj' && (x.kind === 'npc') !== (t.kind === 'npc')).map((x) => ({ x, cr: this.whoTok(c, x) }))
      .filter((o) => o.cr && !o.cr.down && !Tactica.incapacitated(o.cr.conds));
    const list = Tactica.provokes(t, cells, foes.map((o) => ({ id: o.cr.id, t: o.x, reach: o.cr.reach })));
    for (const p of list) {
      const f = foes.find((o) => o.cr.id === p.id).cr;
      this.log(c, `${me.name} sale del alcance de ${f.name}: puede hacerle un ataque de oportunidad`, me.hidden || f.hidden ? '' : null);
      const note = { t: 'oa', map: mp.id, by: f.id, byName: f.name, target: me.id, targetName: me.name, tok: t.id };
      if (f.kind === 'npc') { for (const d of c.members.values()) if (d.role === 'dm') out.push({ to: d.id, msg: note }); }
      else out.push({ to: f.id, msg: note });
      out.state = true;
    }
  };

  /* ---------- Zonas de conjuro ---------- */
  P.fxFor = function (mp, mm) { const fx = mp.fx || []; return mm.role === 'dm' ? fx : fx.filter((z) => !z.hid); };
  P.sendFx = function (c, mp, out, put, del) {
    for (const mm of c.members.values()) {
      if (!this.canSeeMap(c, mp, mm)) continue;
      const vis = mm.role === 'dm' ? put : put.filter((z) => !z.hid);
      if (vis.length || (del && del.length)) out.push({ to: mm.id, msg: { t: 'fx', id: mp.id, put: vis, del: del || [] } });
    }
  };
  /* Crea la zona de una acción: sigue a la ficha (emanación) o se queda donde cayó el área */
  P.addZone = function (c, mp, card, a, at, ck, hid, out) {
    const zq = a.zone; if (!zq || typeof zq !== 'object') return null;
    mp.fx = mp.fx || [];
    const z = { id: 'f' + id(4), name: card.title, by: card.by, ck, conc: !!card.conc, f: c.fightN, on: (Array.isArray(zq.on) ? zq.on : []).filter((k) => ZONE_ON.includes(k)),
      terrain: !!zq.terrain, obscure: !!zq.obscure, move: !!zq.move, dtype: DMG_TYPES.includes(card.dtype) ? card.dtype : '', hid: !!hid, card: card.id, hit: {} };
    if (zq.follow && at) { z.tok = at.id; z.r = num(zq.r, 0.5, 30, 1); }
    else { z.sh = cleanShape(zq.sh || a.area, mp); if (!z.sh) return null; }
    const dm = (Array.isArray(a.dmg) ? a.dmg : []).slice(0, 4).map((d) => ({ dice: str(d && d.dice, 40), type: DMG_TYPES.includes(d && d.type) ? d.type : '' })).filter((d) => rollDice(d.dice));
    if (card.save || dm.length || card.conds) z.act = { save: card.save ? { ...card.save } : null, dmg: dm, heal: !!card.heal, conds: card.conds ? card.conds.slice() : null };
    const del = [];
    while (mp.fx.length >= FX_MAX) del.push(mp.fx.shift().id);
    mp.fx.push(z); mp.updated = this.now();
    this.sendFx(c, mp, out, [z], del);
    return z;
  };
  /* Una zona alcanza a una criatura (entra, empieza o termina su turno ahí): su tarjeta, una vez por turno */
  P.zoneFire = function (c, mp, z, cr, why, out, tag) {
    if (!z.act) return;
    tag = tag || this.mvKey(c, mp) + ':' + (this.curTurn(c, mp) || ''); z.hit = z.hit || {};
    if (z.hit[cr.id] === tag) return; z.hit[cr.id] = tag;
    const card = { id: 'a' + id(5), at: this.now(), f: c.fightN, round: c.split ? (c.fights[mp.id] || {}).round || 0 : c.round, by: z.by, actor: { id: z.id, name: z.name, kind: 'fx' }, title: z.name, text: `${cr.name} ${why}.`, map: mp.id, zone: z.id };
    if (z.act.save) card.save = { ...z.act.save };
    const dm = z.act.dmg.map((d) => { const r = rollDice(d.dice); return r ? { dice: r.expr, type: d.type, rolls: r.rolls, total: r.total } : null; }).filter(Boolean);
    if (dm.length) { card.dmg = dm; card.amt = dm.reduce((s, d) => s + d.total, 0); card.dtype = dm[0].type; }
    if (z.act.heal) card.heal = true;
    if (z.act.conds && z.act.conds.length) card.conds = z.act.conds.slice(); // una telaraña apresa a quien entra y falla
    const tt = this.tokOf(c, mp, cr.id), t = { id: cr.id, name: cr.name, kind: cr.kind };
    if (cr.kind === 'npc') t.ac = cr.npc.ac; else if (cr.m.char) t.ac = cr.m.char.ac;
    if (tt) t.at = ctr(tt);
    card.targets = [t];
    if (z.hid || cr.hidden) card.hid = true;
    this.pushCard(c, card, out);
    this.log(c, `${z.name}: ${cr.name} ${why}`, card.hid ? '' : null);
  };
  P.pushCard = function (c, card, out) { c.acts.push(card); if (c.acts.length > 60) c.acts.splice(0, c.acts.length - 60); this.sendCard(c, card, out); };
  /* Al moverse: las zonas con «entrar» a las que llega (o que cruza) */
  P.fxEnter = function (c, mp, t, ox, oy, cells, out) {
    if (!mp.fx || !mp.fx.length) return;
    const cr = this.whoTok(c, t); if (!cr) return;
    const s = t.s || 1, path = (cells || []).concat([[t.x, t.y]]);
    for (const z of mp.fx) {
      if (!z.act || !z.on.includes('enter') || z.tok === t.id) continue;
      const set = Tactica.cellSet(Tactica.zoneCells(mp, z), mp.cols);
      if (Tactica.touches(set, { x: ox, y: oy, s }, mp.cols)) continue;
      if (!path.some((p) => Tactica.touches(set, { x: p[0], y: p[1], s }, mp.cols))) continue;
      this.zoneFire(c, mp, z, cr, 'entra en la zona', out);
    }
  };
  /* Zonas que se mueven (la del conjuro que el DM o quien lo lanzó arrastra, o la que sigue a una ficha): alcanzan a quien queda dentro */
  P.fxSwept = function (c, mp, z, before, out) {
    if (!z.act || !z.on.includes('enter')) return;
    const set = Tactica.cellSet(Tactica.zoneCells(mp, z), mp.cols);
    for (const t of mp.tokens) {
      if (t.kind === 'obj' || t.id === z.tok || before.has(t.id) || !Tactica.touches(set, t, mp.cols)) continue;
      const cr = this.whoTok(c, t); if (cr) this.zoneFire(c, mp, z, cr, 'queda dentro de la zona', out);
    }
  };
  P.inZoneNow = function (mp, z) { const set = Tactica.cellSet(Tactica.zoneCells(mp, z), mp.cols); return new Set(mp.tokens.filter((t) => t.kind !== 'obj' && Tactica.touches(set, t, mp.cols)).map((t) => t.id)); };
  /* Fin y comienzo de turno: zonas con «termina» o «empieza» y las salvaciones que se repiten */
  P.turnEnd = function (c, cid, out) {
    if (!cid) return;
    for (const mp of c.maps.values()) {
      if (!mp.fx || !mp.fx.length || stateOf(mp) !== 'combat') continue;
      const t = this.tokOf(c, mp, cid); if (!t) continue; const cr = this.whoTok(c, t); if (!cr) continue;
      for (const z of mp.fx) if (z.on.includes('end') && z.tok !== t.id && Tactica.touches(Tactica.cellSet(Tactica.zoneCells(mp, z), mp.cols), t, mp.cols)) this.zoneFire(c, mp, z, cr, 'termina su turno en la zona', out);
    }
    for (const e of (c.effs || []).filter((x) => x.tid === cid)) this.repeatSave(c, e, out);
  };
  P.turnStart = function (c, cid, out) {
    if (!cid) return;
    for (const mp of c.maps.values()) {
      if (!mp.fx || !mp.fx.length || stateOf(mp) !== 'combat') continue;
      const t = this.tokOf(c, mp, cid); if (!t) continue; const cr = this.whoTok(c, t); if (!cr) continue;
      for (const z of mp.fx) if (z.on.includes('start') && z.tok !== t.id && Tactica.touches(Tactica.cellSet(Tactica.zoneCells(mp, z), mp.cols), t, mp.cols)) this.zoneFire(c, mp, z, cr, 'empieza su turno en la zona', out);
    }
  };

  /* ---------- Estados con salvación repetida ---------- */
  P.repeatSave = function (c, e, out) {
    const n = c.npcs.get(e.tid), m = c.members.get(e.tid); if (!n && !m) { c.effs = c.effs.filter((x) => x !== e); return; }
    const card = { id: 'a' + id(5), at: this.now(), f: c.fightN, round: c.round, by: e.by, actor: { id: e.id, name: e.title, kind: 'sys' }, title: 'Repite la salvación: ' + e.title,
      text: `${e.name} intenta librarse de ${e.conds.map((k) => COND_ES[k] || k).join(', ').toLowerCase()}.`, save: { ab: e.ab, dc: e.dc, half: false }, eff: e.id,
      targets: [{ id: e.tid, name: e.name, kind: n ? 'npc' : 'pc', ac: n ? n.ac : m.char ? m.char.ac : null }] };
    if (n && n.hidden) card.hid = true;
    this.pushCard(c, card, out);
  };
  P.dropEff = function (c, eid, out, why) {
    const e = (c.effs || []).find((x) => x.id === eid); if (!e) return;
    c.effs = c.effs.filter((x) => x !== e);
    // otro efecto que imponga el mismo estado a la misma criatura lo deja
    const keep = new Set(c.effs.filter((x) => x.tid === e.tid).flatMap((x) => x.conds));
    const gone = e.conds.filter((k) => !keep.has(k)); if (!gone.length) return;
    const n = c.npcs.get(e.tid), m = c.members.get(e.tid);
    if (n) for (const k of gone) applyTo(n, 'cond-', 0, k);
    else if (m) for (const k of gone) out.push({ to: m.id, msg: { t: 'applied', kind: 'cond-', amount: 0, cond: k, note: e.title, from: '' } });
    this.log(c, `${e.name} ${why || 'se libra de'} ${gone.map((k) => (COND_ES[k] || k).toLowerCase()).join(', ')} (${e.title})`, n && n.hidden ? '' : null);
    out.state = true;
  };

  /* ---------- Concentración ---------- */
  P.casterKey = function (card) { const a = card.actor; return a.kind === 'npc' ? a.id : a.kind === 'pc' ? (a.of ? card.by + ':' + a.name : card.by) : 'dm'; };
  /* Termina la concentración de alguien: sus zonas y los estados de su conjuro se acaban */
  P.endConc = function (c, ck, out, o = {}) {
    const was = c.concs[ck]; delete c.concs[ck];
    let any = !!was;
    for (const mp of c.maps.values()) {
      const gone = (mp.fx || []).filter((z) => z.conc && z.ck === ck); if (!gone.length) continue;
      mp.fx = mp.fx.filter((z) => !gone.includes(z)); mp.updated = this.now(); any = true;
      this.sendFx(c, mp, out, [], gone.map((z) => z.id));
    }
    for (const e of (c.effs || []).filter((x) => x.conc && x.ck === ck)) { this.dropEff(c, e.id, out, 'ya no tiene'); any = true; }
    const n = c.npcs.get(ck); if (n && n.conc) { n.conc = null; any = true; }
    const m = c.members.get(ck);
    if (m && m.role !== 'dm' && !o.fromSheet && m.char && m.char.conc) out.push({ to: m.id, msg: { t: 'applied', kind: 'conc-', amount: 0, cond: null, note: o.why || '', from: '' } });
    if (any && was && !o.quiet) this.log(c, `${was.name} deja de concentrarse en ${was.title}`, n && n.hidden ? '' : null);
    if (any) out.state = true;
  };
  P.startConc = function (c, card, out) {
    const ck = this.casterKey(card);
    if (c.concs[ck]) this.endConc(c, ck, out, { quiet: true, why: 'otro conjuro' });
    c.concs[ck] = { title: card.title, name: card.actor.name, card: card.id };
    const n = card.actor.kind === 'npc' && c.npcs.get(card.actor.id); if (n) n.conc = card.title;
    return ck;
  };
  /* Quien se concentra y recibe daño: salvación de Constitución (CD 10 o la mitad del daño, hasta 30) */
  P.concCheck = function (c, t, amount, out) {
    const n = t.kind === 'npc' ? c.npcs.get(t.id) : null, m = t.kind === 'pc' ? c.members.get(t.id) : null;
    const conc = n ? n.conc : m && m.char ? m.char.conc : null; if (!conc || amount <= 0) return;
    const dc = Math.min(30, Math.max(10, Math.floor(amount / 2)));
    const dmId = [...c.members.values()].find((x) => x.role === 'dm');
    const card = { id: 'a' + id(5), at: this.now(), f: c.fightN, round: c.round, by: m ? m.id : dmId ? dmId.id : '', actor: { id: 'conc', name: 'Concentración', kind: 'sys' }, title: 'Concentración: ' + conc,
      text: `${t.name} recibió ${amount} de daño.`, save: { ab: 'con', dc, half: false }, concChk: true, targets: [{ id: t.id, name: t.name, kind: t.kind }] };
    if (n && n.hidden) card.hid = true;
    this.pushCard(c, card, out);
  };

  /* ---------- La acción en el mapa: de dónde sale, el área, la cobertura de cada objetivo ---------- */
  P.mapAct = function (c, mp, card, a) {
    card.map = mp.id;
    const at = card.actor.kind === 'npc' ? this.tokOf(c, mp, card.actor.id) : card.actor.kind === 'pc' ? (card.actor.of ? mp.tokens.find((t) => t.kind === 'pc' && t.comp && t.by === card.by && t.name === card.actor.name) : this.tokOf(c, mp, card.by)) : null;
    if (at) card.from = ctr(at);
    const sh = a.area ? cleanShape(a.area, mp) : null; if (sh) { card.area = sh; if (a.self) card.self = true; }
    const origin = sh && !a.self ? (sh.t === 'cube' ? [sh.x + sh.w / 2, sh.y + sh.w / 2] : [sh.x, sh.y]) : null;
    const crowd = mp.tokens.filter((x) => x.kind !== 'obj');
    for (const t of card.targets) {
      const tt = this.tokOf(c, mp, t.id); if (!tt) continue;
      t.at = ctr(tt);
      if (!(card.atk || (card.save && card.save.ab === 'dex')) || !(at || origin)) continue;
      const v = Tactica.cover(mp, origin || at, tt, crowd); if (!v) continue;
      t.cover = v;
      if (card.atk) t.hit = v === 'total' ? false : card.atk.crit || (!card.atk.fumble && (t.ac == null || card.atk.total >= t.ac + v));
    }
    return at;
  };

  /* ---------- Mensajes del combate táctico ---------- */
  P.tactic = function (c, me, msg, out) {
    const isDm = me.role === 'dm';
    switch (msg.t) {
      case 'map.tac': {
        if (!isDm) throw err('dm_only', 'Solo el DM cambia las reglas del mapa.');
        const mp = this.mapFor(c, me, msg.id), t0 = mp.tac || {};
        mp.tac = { flank: msg.flank != null ? !!msg.flank : !!t0.flank, mov: msg.mov != null ? !!msg.mov : t0.mov !== false, oa: msg.oa != null ? !!msg.oa : t0.oa !== false };
        mp.updated = this.now(); this.sendPlay(c, mp, out); out.quiet = true;
        break;
      }
      case 'mv.set': {
        const mp = this.mapFor(c, me, msg.id), t = mp.tokens.find((x) => x.id === str(msg.tid, 20)); if (!t) throw err('no_target', 'Esa ficha ya no está.');
        if (!isDm && t.ref !== me.id && t.by !== me.id) throw err('not_yours', 'Solo tus fichas.');
        if (!this.inFight(c, mp)) throw err('no_fight', 'Eso es para el combate.');
        const v = this.mvOf(c, mp, t), cr = this.whoTok(c, t), nm = cr ? cr.name : t.name;
        if (msg.dash != null && !!msg.dash !== v.dash) { v.dash = !!msg.dash; this.log(c, `${nm} ${v.dash ? 'corre (acción de Carrera)' : 'ya no corre'}`, cr && cr.hidden ? '' : null); }
        if (msg.dis != null && !!msg.dis !== v.dis) { v.dis = !!msg.dis; this.log(c, `${nm} ${v.dis ? 'se retira (no provoca ataques de oportunidad)' : 'ya no se retira'}`, cr && cr.hidden ? '' : null); }
        if (msg.stand) { const sp = this.speedOf(c, t) || 0; v.u += Math.ceil(sp / 2); this.log(c, `${nm} se levanta (gasta la mitad de su movimiento)`); }
        this.sendMv(c, mp, t, out);
        break;
      }
      case 'fx.rm': {
        const mp = this.mapFor(c, me, msg.id), z = (mp.fx || []).find((x) => x.id === str(msg.fid, 20)); if (!z) { out.quiet = true; break; }
        if (!isDm && z.by !== me.id) throw err('not_yours', 'Solo quien lanzó el conjuro (o el DM) lo quita.');
        mp.fx = mp.fx.filter((x) => x !== z); mp.updated = this.now();
        this.sendFx(c, mp, out, [], [z.id]); out.quiet = true;
        break;
      }
      case 'fx.move': {
        const mp = this.mapFor(c, me, msg.id), z = (mp.fx || []).find((x) => x.id === str(msg.fid, 20)); if (!z || !z.sh) throw err('no_target', 'Esa zona ya no está.');
        if (!isDm && (z.by !== me.id || !z.move)) throw err('not_yours', 'Esa zona no se mueve (o no es tuya).');
        const before = this.inZoneNow(mp, z);
        z.sh = cleanShape({ ...z.sh, x: msg.x, y: msg.y }, mp) || z.sh; mp.updated = this.now();
        this.sendFx(c, mp, out, [z], []); this.fxSwept(c, mp, z, before, out); out.quiet = !out.state;
        break;
      }
      case 'act.cond': {
        const card = c.acts.find((x) => x.id === str(msg.id, 20)); if (!card || !card.conds || !card.conds.length) throw err('no_target', 'Esa acción no impone estados.');
        const t = (card.targets || []).find((x) => x.id === str(msg.tid, 20)); if (!t) throw err('no_target', 'No era objetivo de esa acción.');
        if (t.cd) throw err('done', 'Eso ya se aplicó.');
        const n = t.kind === 'npc' ? c.npcs.get(t.id) : null, m = t.kind === 'pc' ? c.members.get(t.id) : null;
        if (n ? !isDm && card.by !== me.id : me.id !== t.id) throw err('not_yours', 'Cada quien aplica los estados en su hoja (el DM, los de los enemigos).');
        if (!n && !m) throw err('no_target', 'Ya no está.');
        if (n) for (const k of card.conds) applyTo(n, 'cond+', 0, k);
        else for (const k of card.conds) out.push({ to: m.id, msg: { t: 'applied', kind: 'cond+', amount: 0, cond: k, note: card.title, from: card.actor.name } });
        t.cd = true;
        if (card.repeat && card.save) {
          c.effs = c.effs || [];
          if (c.effs.length >= EFFS_MAX) c.effs.shift();
          c.effs.push({ id: 'e' + id(4), tid: t.id, name: t.name, conds: card.conds.slice(), ab: card.save.ab, dc: card.save.dc, title: card.title, ck: card.ck || null, conc: !!card.conc, by: card.by });
        }
        this.log(c, `${t.name} queda ${card.conds.map((k) => (COND_ES[k] || k).toLowerCase()).join(', ')} (${card.title})`, n && n.hidden ? '' : null);
        this.sendCard(c, card, out);
        break;
      }
      case 'death': {
        if (isDm) throw err('bad_msg', 'El DM no tira por los jugadores.');
        const ch = me.char; if (!ch || ch.hp > 0) throw err('not_down', 'Solo con 0 PG se tiran salvaciones contra la muerte.');
        const nat = msg.man != null ? int(msg.man, 1, 20, 10) : d20().d;
        const res = nat === 20 ? 'revive' : nat === 1 ? 'dos fallos' : nat >= 10 ? 'éxito' : 'fallo';
        const card = { id: 'a' + id(5), at: this.now(), f: c.fightN, round: c.round, by: me.id, actor: { id: me.id, name: ch.name, kind: 'pc', img: ch.tok || ch.img || null }, title: 'Salvación contra la muerte', text: '', death: { nat, res }, targets: [] };
        if (msg.man != null) card.man = true;
        this.pushCard(c, card, out);
        this.log(c, `${ch.name}: salvación contra la muerte ${nat} (${res === 'revive' ? '¡20! recupera 1 PG' : res})`);
        out.push({ to: me.id, msg: { t: 'applied', kind: 'death', amount: nat, cond: null, note: '', from: '' } });
        break;
      }
      default: throw err('bad_msg', 'Mensaje desconocido.');
    }
  };
}
