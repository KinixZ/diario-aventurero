// Lógica de las salas de combate, sin red: así se puede probar sola.
// Cada sala guarda a los jugadores conectados, los PNJ del DM, la iniciativa, la ronda y un registro.
// La hoja de cada jugador sigue siendo la autoridad de sus propios PG: el servidor reenvía
// lo que le aplican y el jugador responde con su resumen actualizado.

import { randomBytes } from 'node:crypto';

export const CONDITIONS = ['blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'grappled', 'incapacitated',
  'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious', 'concentration'];

export const COND_ES = { blinded: 'Cegado', charmed: 'Hechizado', deafened: 'Ensordecido', exhaustion: 'Agotamiento', frightened: 'Asustado', grappled: 'Agarrado', incapacitated: 'Incapacitado',
  invisible: 'Invisible', paralyzed: 'Paralizado', petrified: 'Petrificado', poisoned: 'Envenenado', prone: 'Derribado', restrained: 'Apresado', stunned: 'Aturdido', unconscious: 'Inconsciente', concentration: 'Concentración' };

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // sin I, L ni O para no confundir
const MAX_ROOMS = 500;
const MAX_MEMBERS = 12;
const MAX_NPCS = 40;
const LOG_LEN = 60;
export const ROOM_TTL_MS = 8 * 60 * 60 * 1000;

const int = (v, lo, hi, def = 0) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def; };
const str = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);
const id = (n = 6) => randomBytes(n).toString('base64url');

/* Resumen público de un personaje que manda el cliente */
export function cleanChar(c = {}) {
  return {
    name: str(c.name, 40) || 'Sin nombre',
    cls: str(c.cls, 60),
    lvl: int(c.lvl, 1, 20, 1),
    ac: int(c.ac, 0, 40, 10),
    hp: int(c.hp, 0, 999, 0),
    hpMax: int(c.hpMax, 1, 999, 1),
    temp: int(c.temp, 0, 999, 0),
    initMod: int(c.initMod, -10, 20, 0),
    conc: str(c.conc, 60) || null,
    conds: Array.isArray(c.conds) ? c.conds.filter(x => CONDITIONS.includes(x)).slice(0, 16) : [],
    comps: Array.isArray(c.comps) ? c.comps.slice(0, 4).map(k => ({ name: str(k.name, 40), ac: int(k.ac, 0, 40, 10), hp: int(k.hp, 0, 999, 0), hpMax: int(k.hpMax, 1, 999, 1) })) : [],
  };
}

export class Rooms {
  constructor(now = () => Date.now()) { this.rooms = new Map(); this.now = now; }

  newCode() {
    for (let tries = 0; tries < 50; tries++) {
      const bytes = randomBytes(4); let c = '';
      for (const b of bytes) c += CODE_CHARS[b % CODE_CHARS.length];
      if (!this.rooms.has(c)) return c;
    }
    throw new Error('no_code');
  }

  create(name, char, asDm) {
    if (this.rooms.size >= MAX_ROOMS) this.sweep();
    if (this.rooms.size >= MAX_ROOMS) throw err('full', 'El servidor tiene demasiadas salas abiertas. Intenta en un rato.');
    const room = { code: this.newCode(), created: this.now(), touched: this.now(), members: new Map(), npcs: new Map(), order: [], turn: -1, round: 0, hidePc: false, log: [] };
    this.rooms.set(room.code, room);
    const m = this.addMember(room, name, char, asDm ? 'dm' : 'player');
    this.log(room, `${m.name} abrió la sala`);
    return { room, member: m };
  }

  join(code, name, char, token, asDm) {
    const room = this.rooms.get(str(code, 8).toUpperCase());
    if (!room) throw err('no_room', 'No existe una sala con ese código. Revisa las letras.');
    // volver a entrar con el mismo token recupera tu lugar (por ejemplo tras perder la señal)
    if (token) for (const m of room.members.values()) if (m.token === token) { m.online = true; if (char) m.char = cleanChar(char); this.touch(room); return { room, member: m, rejoined: true }; }
    if (room.members.size >= MAX_MEMBERS) throw err('room_full', 'La sala ya está llena.');
    const wantsDm = asDm && ![...room.members.values()].some(x => x.role === 'dm');
    const m = this.addMember(room, name, char, wantsDm ? 'dm' : 'player');
    this.log(room, `${m.name} entró`);
    return { room, member: m };
  }

  addMember(room, name, char, role) {
    const m = { id: 'p' + id(4), token: id(12), role, name: str(name, 40) || 'Jugador', online: true, init: null, char: role === 'dm' ? null : cleanChar(char) };
    room.members.set(m.id, m); this.touch(room);
    return m;
  }

  leave(room, memberId, forget) {
    const m = room.members.get(memberId); if (!m) return;
    if (forget) { room.members.delete(memberId); room.order = room.order.filter(x => x !== memberId); this.log(room, `${m.name} salió`); }
    else m.online = false;
    this.touch(room);
  }

  touch(room) { room.touched = this.now(); }
  log(room, text) { room.log.push({ at: this.now(), text: str(text, 200) }); if (room.log.length > LOG_LEN) room.log.splice(0, room.log.length - LOG_LEN); }

  sweep() {
    const t = this.now();
    for (const [code, r] of this.rooms) {
      const anyone = [...r.members.values()].some(m => m.online);
      if (t - r.touched > ROOM_TTL_MS || (!anyone && t - r.touched > 30 * 60 * 1000)) this.rooms.delete(code);
    }
  }

  get(code) { return this.rooms.get(code); }

  /* Acciones. Devuelven una lista de avisos para reenviar a miembros concretos ({to, msg}). */
  act(room, who, msg) {
    const me = room.members.get(who); if (!me) throw err('not_member', 'Ya no estás en la sala.');
    const isDm = me.role === 'dm';
    const out = [];
    this.touch(room);
    switch (msg.t) {
      case 'char': if (me.role !== 'dm') me.char = cleanChar(msg.char); break;
      case 'init': {
        const target = msg.id ? (room.members.get(msg.id) || room.npcs.get(msg.id)) : me;
        if (!target) throw err('no_target', 'No encuentro a quién ponerle iniciativa.');
        if (target !== me && !isDm) throw err('dm_only', 'Solo el DM puede poner la iniciativa de otros.');
        target.init = msg.value == null || msg.value === '' ? null : int(msg.value, -10, 50, 0);
        this.sortOrder(room);
        this.log(room, `${target.name || target.char?.name} tiene iniciativa ${target.init ?? '–'}`);
        break;
      }
      case 'npc.add': {
        if (!isDm) throw err('dm_only', 'Solo el DM agrega enemigos.');
        if (room.npcs.size >= MAX_NPCS) throw err('too_many', 'Ya hay demasiados PNJ en la sala.');
        const count = int(msg.count, 1, 12, 1);
        for (let i = 0; i < count; i++) {
          const hpMax = int(msg.hp, 1, 9999, 10);
          const n = { id: 'n' + id(4), name: (str(msg.name, 40) || 'Enemigo') + (count > 1 ? ' ' + (i + 1) : ''), ac: int(msg.ac, 0, 40, 12), hp: hpMax, hpMax, temp: 0, init: msg.init == null || msg.init === '' ? null : int(msg.init, -10, 50, 0), conds: [], hidden: !!msg.hidden };
          room.npcs.set(n.id, n);
        }
        this.sortOrder(room);
        this.log(room, `El DM agregó ${count > 1 ? count + ' × ' : ''}${str(msg.name, 40) || 'enemigo'}`);
        break;
      }
      case 'npc.del': {
        if (!isDm) throw err('dm_only', 'Solo el DM quita enemigos.');
        const n = room.npcs.get(msg.id); if (!n) break;
        room.npcs.delete(msg.id); room.order = room.order.filter(x => x !== msg.id); if (room.turn >= room.order.length) room.turn = room.order.length ? 0 : -1;
        this.log(room, `${n.name} salió del combate`);
        break;
      }
      case 'npc.reveal': { if (!isDm) throw err('dm_only', 'Solo el DM.'); const n = room.npcs.get(msg.id); if (n) n.hidden = !n.hidden; break; }
      case 'hidepc': if (!isDm) throw err('dm_only', 'Solo el DM.'); room.hidePc = !!msg.value; break;
      case 'turn': {
        if (!room.order.length) throw err('no_order', 'Primero tiren iniciativa.');
        const cur = room.order[room.turn];
        const mine = cur === me.id;
        if (!isDm && !mine) throw err('not_your_turn', 'Solo el DM o quien tiene el turno puede pasarlo.');
        if (msg.dir === 'start' || room.turn < 0) { room.turn = 0; room.round = 1; }
        else if (msg.dir === 'prev') { room.turn -= 1; if (room.turn < 0) { room.turn = room.order.length - 1; room.round = Math.max(1, room.round - 1); } }
        else { room.turn += 1; if (room.turn >= room.order.length) { room.turn = 0; room.round += 1; } }
        const now = this.nameOf(room, room.order[room.turn]);
        this.log(room, `Ronda ${room.round}: turno de ${now}`);
        out.push({ to: room.order[room.turn], msg: { t: 'yourturn', round: room.round } });
        break;
      }
      case 'end': if (!isDm) throw err('dm_only', 'Solo el DM termina el combate.'); room.turn = -1; room.round = 0; for (const n of room.npcs.values()) n.init = null; for (const m of room.members.values()) m.init = null; room.order = []; this.log(room, 'Terminó el combate'); break;
      case 'apply': {
        // daño, curación, PG temporales o condiciones sobre uno o varios objetivos
        const kind = ['damage', 'heal', 'temp', 'cond+', 'cond-'].includes(msg.kind) ? msg.kind : null;
        if (!kind) throw err('bad_kind', 'Acción desconocida.');
        const amount = int(msg.amount, 0, 999, 0), cond = CONDITIONS.includes(msg.cond) ? msg.cond : null;
        if ((kind === 'cond+' || kind === 'cond-') && !cond) throw err('bad_cond', 'Elige una condición.');
        if ((kind === 'damage' || kind === 'heal' || kind === 'temp') && !amount) throw err('no_amount', 'Escribe una cantidad.');
        const note = str(msg.note, 80), names = [];
        for (const tid of (Array.isArray(msg.targets) ? msg.targets : []).slice(0, 20)) {
          const npc = room.npcs.get(tid), pc = room.members.get(tid);
          if (npc) { applyTo(npc, kind, amount, cond); names.push(npc.name); }
          else if (pc && pc.role !== 'dm') {
            // la hoja del jugador aplica el cambio y luego manda su resumen; mientras, se refleja aquí
            applyTo(pc.char, kind, amount, cond); names.push(pc.char.name);
            out.push({ to: pc.id, msg: { t: 'applied', kind, amount, cond, note, from: me.name } });
          }
        }
        if (!names.length) throw err('no_target', 'Elige al menos un objetivo.');
        const verb = { damage: `hizo ${amount} de daño a`, heal: `curó ${amount} PG a`, temp: `dio ${amount} PG temporales a`, 'cond+': `aplicó ${COND_ES[cond]} a`, 'cond-': `quitó ${COND_ES[cond]} a` }[kind];
        this.log(room, `${me.name} ${verb} ${names.join(', ')}${note ? ' (' + note + ')' : ''}`);
        break;
      }
      default: throw err('bad_msg', 'Mensaje desconocido.');
    }
    return out;
  }

  nameOf(room, oid) { const m = room.members.get(oid); if (m) return m.char ? m.char.name : m.name; const n = room.npcs.get(oid); return n ? n.name : '?'; }

  /* Orden de iniciativa: mayor primero; empates por modificador de Destreza (initMod) */
  sortOrder(room) {
    const cur = room.order[room.turn];
    const list = [];
    for (const m of room.members.values()) if (m.role !== 'dm' && m.init != null) list.push({ id: m.id, init: m.init, mod: m.char ? m.char.initMod : 0 });
    for (const n of room.npcs.values()) if (n.init != null) list.push({ id: n.id, init: n.init, mod: 0 });
    list.sort((a, b) => b.init - a.init || b.mod - a.mod);
    room.order = list.map(x => x.id);
    room.turn = cur ? Math.max(0, room.order.indexOf(cur)) : room.turn >= 0 && room.order.length ? 0 : -1;
  }

  /* Lo que ve cada quien: los jugadores no ven PNJ ocultos ni los PG exactos de los enemigos */
  view(room, forId) {
    const me = room.members.get(forId), dm = me && me.role === 'dm';
    const members = [...room.members.values()].map(m => ({ id: m.id, role: m.role, name: m.name, online: m.online, init: m.init, char: m.char && (dm || m.id === forId || !room.hidePc ? m.char : { ...m.char, hp: null, temp: null }) }));
    const npcs = [...room.npcs.values()].filter(n => dm || !n.hidden).map(n => dm ? n : { id: n.id, name: n.name, init: n.init, conds: n.conds, state: hpState(n) });
    return { code: room.code, you: forId, role: me ? me.role : null, members, npcs, order: room.order.filter(x => dm || !room.npcs.get(x)?.hidden), turnId: room.order[room.turn] || null, round: room.round, hidePc: room.hidePc, log: room.log.slice(-20) };
  }
}

function applyTo(t, kind, amount, cond) {
  if (!t) return;
  t.conds = t.conds || [];
  if (kind === 'damage') { const fromTemp = Math.min(t.temp || 0, amount); t.temp = (t.temp || 0) - fromTemp; t.hp = Math.max(0, t.hp - (amount - fromTemp)); }
  else if (kind === 'heal') t.hp = Math.min(t.hpMax, t.hp + amount);
  else if (kind === 'temp') t.temp = Math.max(t.temp || 0, amount);
  else if (kind === 'cond+' && !t.conds.includes(cond)) t.conds.push(cond);
  else if (kind === 'cond-') t.conds = t.conds.filter(c => c !== cond);
}

/* A los jugadores se les dice cómo se ve el enemigo, no sus números */
export function hpState(n) {
  if (n.hp <= 0) return 'caído';
  const p = n.hp / n.hpMax;
  return p >= 1 ? 'ileso' : p > 0.5 ? 'herido' : p > 0.25 ? 'malherido' : 'casi muerto';
}

function err(code, message) { const e = new Error(message); e.code = code; return e; }
