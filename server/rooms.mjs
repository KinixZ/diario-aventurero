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
export const ROOM_TTL_MS = 10 * 60 * 60 * 1000;
const CHAT_MAX = 800, BOARD_MAX = 80, STROKES_MAX = 4000, PAGES_MAX = 30, PTS_MAX = 900;
export const IMG_MAX_BYTES = 1600 * 1024, ROOM_IMG_BYTES = 30 * 1024 * 1024;
export const BOARD_CATS = ['mision', 'pnj', 'lugar', 'pista', 'objeto', 'otro'];
const COLOR_RE = /^#[0-9a-f]{6}$/i;
export const NPC_HP = ['none', 'state', 'bar', 'pct', 'num']; // lo que ven los jugadores de la vida de los enemigos
const MAPS_MAX = 30, MAP_STROKES_MAX = 6000, MAP_PTS_MAX = 600, MAP_LAYERS_MAX = 8, MAP_TOOLS = ['pen', 'line', 'rect', 'text'];

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

  create(name, char, asDm, restore) {
    if (this.rooms.size >= MAX_ROOMS) this.sweep();
    if (this.rooms.size >= MAX_ROOMS) throw err('full', 'El servidor tiene demasiadas salas abiertas. Intenta en un rato.');
    // Si el servidor se reinició, el DM puede reabrir la mesa con su copia local y el mismo código
    const want = restore && /^[A-Z]{4}$/.test(String(restore.code || '')) && !this.rooms.has(restore.code) ? restore.code : null;
    const room = { code: want || this.newCode(), created: this.now(), touched: this.now(), members: new Map(), npcs: new Map(), order: [], turn: -1, round: 0, hidePc: false, log: [],
      npcHp: 'state', maps: new Map(), chat: [], board: [], strokes: [], pages: [], images: new Map(), imgBytes: 0, session: { title: '', started: this.now(), ended: null } };
    if (want) this.restore(room, restore);
    this.rooms.set(room.code, room);
    const m = this.addMember(room, name, char, asDm ? 'dm' : 'player');
    this.log(room, want ? `${m.name} reabrió la mesa` : `${m.name} abrió la sala`);
    return { room, member: m, restored: !!want };
  }

  restore(room, r) {
    room.session.title = str(r.title, 80);
    room.session.started = Number(r.started) || this.now();
    room.chat = (Array.isArray(r.chat) ? r.chat : []).slice(-CHAT_MAX).map((c) => cleanChatMsg(c)).filter(Boolean);
    room.board = (Array.isArray(r.board) ? r.board : []).slice(0, BOARD_MAX).map((b) => cleanBoard(b)).filter(Boolean);
    room.strokes = (Array.isArray(r.strokes) ? r.strokes : []).slice(-STROKES_MAX).map((k) => cleanStroke(k, k && k.by)).filter(Boolean);
    room.pages = (Array.isArray(r.pages) ? r.pages : []).slice(-PAGES_MAX).map((pg) => ({ at: Number(pg.at) || 0, strokes: (pg.strokes || []).slice(0, STROKES_MAX).map((k) => cleanStroke(k, k && k.by)).filter(Boolean) }));
    if (NPC_HP.includes(r.npcHp)) room.npcHp = r.npcHp;
    if (r.combat) this.loadEncounter(room, r.combat);
  }

  /* Encuentro guardado: enemigos con sus números, ronda y de quién era el turno */
  loadEncounter(room, e) {
    room.npcs = new Map();
    for (const x of (Array.isArray(e.npcs) ? e.npcs : []).slice(0, MAX_NPCS)) {
      const hpMax = int(x.hpMax, 1, 9999, 10);
      const n = { id: 'n' + id(4), name: str(x.name, 40) || 'Enemigo', ac: int(x.ac, 0, 40, 12), hp: int(x.hp, 0, hpMax, hpMax), hpMax, temp: int(x.temp, 0, 999, 0),
        init: x.init == null || x.init === '' ? null : int(x.init, -10, 50, 0), conds: Array.isArray(x.conds) ? x.conds.filter(c => CONDITIONS.includes(c)).slice(0, 16) : [], hidden: !!x.hidden,
        ref: x.ref ? str(x.ref, 120) : null, initMod: int(x.initMod, -10, 20, 0), formula: x.formula ? str(x.formula, 30) : null };
      room.npcs.set(n.id, n);
    }
    // la iniciativa de los jugadores se recupera por el nombre de su personaje (o se guarda para cuando entren)
    room.pcInit = {};
    for (const [nm, v] of Object.entries(e.pcInit && typeof e.pcInit === 'object' ? e.pcInit : {}).slice(0, MAX_MEMBERS)) room.pcInit[str(nm, 40)] = int(v, -10, 50, 0);
    for (const m of room.members.values()) if (m.char && room.pcInit[m.char.name] != null) m.init = room.pcInit[m.char.name];
    this.sortOrder(room);
    room.round = int(e.round, 0, 999, 0);
    const tn = str(e.turnName, 40), ti = room.order.findIndex((oid) => this.nameOf(room, oid) === tn);
    room.turn = room.round > 0 && room.order.length ? Math.max(0, ti) : -1;
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
    if (m.char && room.pcInit && room.pcInit[m.char.name] != null) m.init = room.pcInit[m.char.name];
    room.members.set(m.id, m); this.touch(room);
    if (m.init != null) this.sortOrder(room);
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
      if (r.session && r.session.ended && t - r.session.ended > 20 * 60 * 1000) { this.rooms.delete(code); continue; }
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
          const n = { id: 'n' + id(4), name: (str(msg.name, 40) || 'Enemigo') + (count > 1 ? ' ' + (i + 1) : ''), ac: int(msg.ac, 0, 40, 12), hp: hpMax, hpMax, temp: 0, init: msg.init == null || msg.init === '' ? null : int(msg.init, -10, 50, 0), conds: [], hidden: !!msg.hidden,
            ref: msg.ref ? str(msg.ref, 120) : null, initMod: int(msg.initMod, -10, 20, 0), formula: msg.formula ? str(msg.formula, 30) : null };
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
      case 'npc.set': {
        // el DM ajusta a mano los números de un enemigo: PG, PG máximos, CA, nombre y estados
        if (!isDm) throw err('dm_only', 'Solo el DM ajusta a los enemigos.');
        const n = room.npcs.get(msg.id); if (!n) throw err('no_target', 'Ese enemigo ya no está.');
        if (msg.hpMax != null) { n.hpMax = int(msg.hpMax, 1, 9999, n.hpMax); n.hp = Math.min(n.hp, n.hpMax); }
        if (msg.hp != null) n.hp = int(msg.hp, 0, n.hpMax, n.hp);
        if (msg.delta != null) { const d = int(msg.delta, -9999, 9999, 0); if (d < 0) applyTo(n, 'damage', -d); else applyTo(n, 'heal', d); }
        if (msg.ac != null) n.ac = int(msg.ac, 0, 40, n.ac);
        if (msg.name != null && str(msg.name, 40)) n.name = str(msg.name, 40);
        if (Array.isArray(msg.conds)) n.conds = msg.conds.filter(x => CONDITIONS.includes(x)).slice(0, 16);
        break;
      }
      case 'npc.reveal': { if (!isDm) throw err('dm_only', 'Solo el DM.'); const n = room.npcs.get(msg.id); if (n) n.hidden = !n.hidden; break; }
      case 'hidepc': if (!isDm) throw err('dm_only', 'Solo el DM.'); room.hidePc = !!msg.value; break;
      case 'npchp': if (!isDm) throw err('dm_only', 'Solo el DM.'); if (!NPC_HP.includes(msg.value)) throw err('bad_msg', 'Opción desconocida.'); room.npcHp = msg.value; break;
      case 'enc.load': {
        if (!isDm) throw err('dm_only', 'Solo el DM carga encuentros.');
        this.loadEncounter(room, msg.enc || {});
        this.log(room, `El DM cargó el encuentro ${str(msg.enc && msg.enc.name, 60) || 'guardado'}`);
        break;
      }
      /* ---------- Mapas: cada zona es un lienzo grande con cuadrícula y capas; dibujan todos ---------- */
      case 'map.save': {
        const mp = cleanMap(msg.map, me.id); if (!mp) throw err('bad_map', 'El mapa no tiene un formato válido.');
        const old = room.maps.get(mp.id);
        if (!old && room.maps.size >= MAPS_MAX) throw err('too_many', 'La mesa ya tiene demasiados mapas.');
        if (old && !isDm && old.by !== me.id) throw err('dm_only', 'Solo el DM o quien lo creó puede reemplazar este mapa.');
        mp.updated = this.now(); room.maps.set(mp.id, mp);
        for (const mm of room.members.values()) out.push({ to: mm.id, msg: { t: 'map', map: mp } });
        break;
      }
      case 'map.meta': {
        const mp = room.maps.get(str(msg.id, 24)); if (!mp) throw err('no_map', 'Ese mapa ya no está.');
        if (msg.name != null && str(msg.name, 60)) mp.name = str(msg.name, 60);
        if (['square', 'hex', 'none'].includes(msg.grid)) mp.grid = msg.grid;
        if (Array.isArray(msg.layers)) { const ls = cleanLayers(msg.layers); if (ls.length) { mp.layers = ls; const ok = new Set(ls.map((l) => l.id)); mp.strokes = mp.strokes.filter((k) => ok.has(k.l)); } }
        mp.updated = this.now();
        for (const mm of room.members.values()) out.push({ to: mm.id, msg: { t: 'map.meta', id: mp.id, name: mp.name, grid: mp.grid, layers: mp.layers, updated: mp.updated } });
        break;
      }
      case 'map.del': {
        const mp = room.maps.get(str(msg.id, 24)); if (!mp) break;
        if (!isDm && mp.by !== me.id) throw err('dm_only', 'Solo el DM o quien lo creó puede quitarlo de la mesa.');
        room.maps.delete(mp.id);
        break;
      }
      case 'map.get': { const mp = room.maps.get(str(msg.id, 24)); if (!mp) throw err('no_map', 'Ese mapa ya no está.'); out.push({ to: me.id, msg: { t: 'map', map: mp } }); out.quiet = true; break; }
      case 'map.add': {
        const mp = room.maps.get(str(msg.id, 24)); if (!mp) throw err('no_map', 'Ese mapa ya no está.');
        if (mp.strokes.length >= MAP_STROKES_MAX) throw err('board_full', 'Este mapa está lleno: hagan uno nuevo para la siguiente zona.');
        const k = cleanMapStroke(msg.stroke, me.id, mp); if (!k) throw err('bad_stroke', 'No se pudo guardar el trazo.');
        k.id = 'k' + id(5); mp.strokes.push(k); mp.updated = this.now();
        for (const mm of room.members.values()) out.push({ to: mm.id, msg: { t: 'map.add', id: mp.id, stroke: k, updated: mp.updated } });
        out.quiet = true;
        break;
      }
      case 'map.rm': case 'map.undo': {
        const mp = room.maps.get(str(msg.id, 24)); if (!mp) throw err('no_map', 'Ese mapa ya no está.');
        let ids;
        if (msg.t === 'map.undo') { const last = [...mp.strokes].reverse().find((k) => k.by === me.id); ids = last ? [last.id] : []; }
        else ids = (Array.isArray(msg.sids) ? msg.sids : []).slice(0, 200).map((x) => str(x, 20));
        const set = new Set(ids), before = mp.strokes.length;
        mp.strokes = mp.strokes.filter((k) => !set.has(k.id));
        if (mp.strokes.length !== before) { mp.updated = this.now(); for (const mm of room.members.values()) out.push({ to: mm.id, msg: { t: 'map.rm', id: mp.id, sids: ids, updated: mp.updated } }); }
        out.quiet = true;
        break;
      }
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
          else if (pc && pc.role !== 'dm' && isDm) continue; // el DM maneja solo a los enemigos; cada jugador lleva su hoja
          else if (pc && pc.role !== 'dm') {
            // la hoja del jugador aplica el cambio y luego manda su resumen; mientras, se refleja aquí
            applyTo(pc.char, kind, amount, cond); names.push(pc.char.name);
            out.push({ to: pc.id, msg: { t: 'applied', kind, amount, cond, note, from: me.name } });
          }
        }
        if (!names.length) throw err('no_target', isDm ? 'Como DM puedes aplicar a los enemigos; los jugadores llevan su propia hoja.' : 'Elige al menos un objetivo.');
        const verb = { damage: `hizo ${amount} de daño a`, heal: `curó ${amount} PG a`, temp: `dio ${amount} PG temporales a`, 'cond+': `aplicó ${COND_ES[cond]} a`, 'cond-': `quitó ${COND_ES[cond]} a` }[kind];
        this.log(room, `${me.name} ${verb} ${names.join(', ')}${note ? ' (' + note + ')' : ''}`);
        break;
      }
      /* ---------- Mesa: chat, tiradas, imágenes, susurros ---------- */
      case 'chat.send': case 'chat.roll': case 'chat.img': {
        let to = msg.to ? String(msg.to) : null;
        if (to) {
          const tm = room.members.get(to);
          if (!tm || tm.id === me.id) throw err('no_target', 'No encuentro a quién mandarle el susurro.');
          if (!isDm && tm.role !== 'dm') throw err('dm_only', 'Los susurros son entre un jugador y el DM.');
        }
        const base = { id: 'm' + id(5), at: this.now(), from: me.id, name: isDm ? 'DM' : (me.char && me.char.name) || me.name, role: me.role, to };
        let m;
        if (msg.t === 'chat.send') { const text = str(msg.text, 1200); if (!text) throw err('empty', 'Escribe algo primero.'); m = { ...base, kind: 'msg', text }; }
        else if (msg.t === 'chat.roll') { const total = int(msg.total, -50, 300, NaN); if (!Number.isFinite(total)) throw err('bad_roll', 'Escribe el total de tu tirada.'); m = { ...base, kind: 'roll', roll: { label: str(msg.label, 50) || 'Tirada', total, nat: msg.nat == null || msg.nat === '' ? null : int(msg.nat, 1, 20, null), adv: ['adv', 'dis'].includes(msg.adv) ? msg.adv : null } }; }
        else { const im = room.images.get(String(msg.img || '')); if (!im) throw err('no_img', 'La imagen no se subió bien; vuelve a intentar.'); m = { ...base, kind: 'img', img: im.id, text: str(msg.caption, 200) }; }
        room.chat.push(m); if (room.chat.length > CHAT_MAX) room.chat.splice(0, room.chat.length - CHAT_MAX);
        for (const mm of room.members.values()) if (visible(m, mm.id)) out.push({ to: mm.id, msg: { t: 'chat', msg: m } });
        out.quiet = true;
        break;
      }
      /* ---------- Tablero del DM ---------- */
      case 'board.add': case 'board.edit': {
        if (!isDm) throw err('dm_only', 'Solo el DM escribe en el tablero.');
        if (msg.img && !room.images.has(String(msg.img))) throw err('no_img', 'Esa imagen ya no está en la sala.');
        const b = cleanBoard({ ...msg.item, img: msg.img || (msg.item && msg.item.img) });
        if (!b) throw err('empty', 'Ponle título a la nota.');
        if (msg.t === 'board.add') { if (room.board.length >= BOARD_MAX) throw err('too_many', 'El tablero está lleno; borra notas viejas.'); b.id = 'b' + id(4); b.at = this.now(); room.board.unshift(b); }
        else { const i = room.board.findIndex((x) => x.id === msg.id); if (i < 0) throw err('no_target', 'Esa nota ya no está.'); room.board[i] = { ...room.board[i], ...b, id: room.board[i].id, at: room.board[i].at }; }
        break;
      }
      case 'board.del': if (!isDm) throw err('dm_only', 'Solo el DM borra notas del tablero.'); room.board = room.board.filter((x) => x.id !== msg.id); break;
      case 'board.done': { if (!isDm) throw err('dm_only', 'Solo el DM.'); const b = room.board.find((x) => x.id === msg.id); if (b) b.done = !b.done; break; }
      /* ---------- Pizarra ---------- */
      case 'draw.add': {
        if (room.strokes.length >= STROKES_MAX) throw err('board_full', 'La pizarra está llena: que el DM pase a una hoja nueva.');
        const k = cleanStroke(msg.stroke, me.id); if (!k) throw err('bad_stroke', 'No se pudo guardar el trazo.');
        k.id = 'k' + id(5); room.strokes.push(k);
        for (const mm of room.members.values()) out.push({ to: mm.id, msg: { t: 'draw', stroke: k } });
        out.quiet = true;
        break;
      }
      case 'draw.undo': {
        let i = -1; for (let j = room.strokes.length - 1; j >= 0; j--) if (room.strokes[j].by === me.id) { i = j; break; }
        if (i < 0) { out.quiet = true; break; }
        const [k] = room.strokes.splice(i, 1);
        for (const mm of room.members.values()) out.push({ to: mm.id, msg: { t: 'draw.undo', id: k.id } });
        out.quiet = true;
        break;
      }
      case 'draw.clear': {
        if (!isDm) throw err('dm_only', 'Solo el DM pasa a una hoja nueva.');
        if (room.strokes.length) { room.pages.push({ at: this.now(), strokes: room.strokes }); if (room.pages.length > PAGES_MAX) room.pages.shift(); }
        room.strokes = [];
        for (const mm of room.members.values()) out.push({ to: mm.id, msg: { t: 'draw.clear', pages: room.pages.length } });
        out.quiet = true;
        break;
      }
      /* ---------- Sesión ---------- */
      case 'session.title': if (!isDm) throw err('dm_only', 'Solo el DM.'); room.session.title = str(msg.title, 80); break;
      case 'session.end': {
        if (!isDm) throw err('dm_only', 'Solo el DM termina la sesión.');
        room.session.ended = this.now();
        if (room.strokes.length) { room.pages.push({ at: this.now(), strokes: room.strokes }); room.strokes = []; }
        this.log(room, 'El DM terminó la sesión');
        for (const mm of room.members.values()) out.push({ to: mm.id, msg: { t: 'ended', snapshot: this.snapshot(room, mm.id) } });
        break;
      }
      default: throw err('bad_msg', 'Mensaje desconocido.');
    }
    return out;
  }

  /* Lo que recibe cada quien al entrar: el chat que puede ver y la pizarra */
  mesaInit(room, forId) { return { t: 'mesa.init', chat: room.chat.filter((m) => visible(m, forId)).slice(-400), strokes: room.strokes, pages: room.pages.length }; }
  /* Todo lo de la sesión para guardarlo en el diario de cada quien */
  snapshot(room, forId) {
    return { code: room.code, title: room.session.title, started: room.session.started, ended: room.session.ended || this.now(), chat: room.chat.filter((m) => visible(m, forId)), board: room.board, pages: room.pages,
      members: [...room.members.values()].map((m) => ({ id: m.id, name: m.role === 'dm' ? 'DM' : (m.char && m.char.name) || m.name, role: m.role })) };
  }
  addImage(room, who, buf, type) {
    const me = room.members.get(who); if (!me) throw err('not_member', 'Ya no estás en la sala.');
    if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) throw err('bad_img', 'Solo imágenes JPG, PNG, WebP o GIF.');
    if (buf.length > IMG_MAX_BYTES) throw err('too_large', 'La imagen es demasiado grande.');
    if (room.imgBytes + buf.length > ROOM_IMG_BYTES) throw err('too_many', 'La sala ya tiene demasiadas imágenes.');
    const im = { id: 'i' + id(8), by: who, type, data: buf, at: this.now() };
    room.images.set(im.id, im); room.imgBytes += buf.length; this.touch(room);
    return im;
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
    const npcs = [...room.npcs.values()].filter(n => dm || !n.hidden).map(n => dm ? n : npcForPlayers(n, room.npcHp));
    const maps = [...room.maps.values()].map((mp) => ({ id: mp.id, name: mp.name, cols: mp.cols, rows: mp.rows, grid: mp.grid, layers: mp.layers, n: mp.strokes.length, by: mp.by, updated: mp.updated }));
    return { code: room.code, you: forId, role: me ? me.role : null, members, npcs, npcHp: room.npcHp, maps, board: room.board, session: room.session, pages: room.pages.length, order: room.order.filter(x => dm || !room.npcs.get(x)?.hidden), turnId: room.order[room.turn] || null, round: room.round, hidePc: room.hidePc, log: room.log.slice(-20) };
  }
}

/* Lo que ven los jugadores de un enemigo según lo que eligió el DM */
function npcForPlayers(n, mode) {
  const o = { id: n.id, name: n.name, init: n.init, conds: n.conds, show: mode };
  if (mode === 'state') o.state = hpState(n);
  else if (mode === 'bar' || mode === 'pct') { o.pct = n.hp <= 0 ? 0 : Math.max(1, Math.round(n.hp / n.hpMax * 100)); o.state = n.hp <= 0 ? 'caído' : null; }
  else if (mode === 'num') { o.hp = n.hp; o.hpMax = n.hpMax; o.temp = n.temp; o.state = n.hp <= 0 ? 'caído' : null; }
  return o;
}
function cleanLayers(ls) {
  const out = [], seen = new Set();
  for (const l of ls.slice(0, MAP_LAYERS_MAX)) { const lid = str(l && l.id, 12); if (!/^[\w-]{1,12}$/.test(lid) || seen.has(lid)) continue; seen.add(lid); out.push({ id: lid, name: str(l.name, 30) || 'Capa' }); }
  return out;
}
const r2 = (v) => Math.round(v * 100) / 100;
function cleanMapStroke(k, by, mp) {
  if (!k || !MAP_TOOLS.includes(k.k) || !Array.isArray(k.pts)) return null;
  if (!mp.layers.some((l) => l.id === k.l)) return null;
  const n = k.pts.length; if (n < 2 || n % 2 || n > MAP_PTS_MAX * 2 || (k.k !== 'pen' && k.k !== 'text' && n !== 4) || (k.k === 'text' && n !== 2)) return null;
  const pts = [];
  for (let i = 0; i < n; i += 2) { const x = Number(k.pts[i]), y = Number(k.pts[i + 1]); if (!(x >= -1 && x <= mp.cols + 1 && y >= -1 && y <= mp.rows + 1)) return null; pts.push(r2(x), r2(y)); }
  const o = { id: k.id ? str(k.id, 20) : undefined, by: str(by, 20), l: k.l, k: k.k, c: COLOR_RE.test(k.c) ? k.c : '#2b1d12', w: Math.min(3, Math.max(0.03, Number(k.w) || 0.12)), pts };
  if (k.k === 'text') { o.t = str(k.t, 60); if (!o.t) return null; }
  if (k.k === 'rect' && k.f) o.f = 1;
  return o;
}
function cleanMap(m, by) {
  if (!m || typeof m !== 'object') return null;
  const mid = str(m.id, 24); if (!/^[\w-]{4,24}$/.test(mid)) return null;
  const mp = { id: mid, name: str(m.name, 60) || 'Mapa', cols: int(m.cols, 8, 160, 40), rows: int(m.rows, 8, 160, 30), grid: ['square', 'hex', 'none'].includes(m.grid) ? m.grid : 'square', by: str(m.by, 20) || str(by, 20), created: Number(m.created) || Date.now() };
  mp.layers = cleanLayers(Array.isArray(m.layers) ? m.layers : []); if (!mp.layers.length) mp.layers = [{ id: 'l1', name: 'Terreno' }];
  mp.strokes = (Array.isArray(m.strokes) ? m.strokes : []).slice(0, MAP_STROKES_MAX).map((k) => { const c = cleanMapStroke(k, k && k.by || by, mp); if (c && k.id) c.id = str(k.id, 20); return c; }).filter(Boolean);
  for (const k of mp.strokes) if (!k.id) k.id = 'k' + id(5);
  return mp;
}

/* Un susurro solo lo ven quien lo manda y quien lo recibe */
function visible(m, forId) { return !m.to || m.to === forId || m.from === forId; }
function cleanChatMsg(c) {
  if (!c || !['msg', 'roll', 'img'].includes(c.kind)) return null;
  return { id: str(c.id, 20) || 'm' + id(5), at: Number(c.at) || 0, from: str(c.from, 20), name: str(c.name, 40), role: c.role === 'dm' ? 'dm' : 'player', to: c.to ? str(c.to, 20) : null, kind: c.kind,
    text: c.text ? str(c.text, 1200) : undefined, img: c.img ? str(c.img, 20) : undefined, roll: c.roll ? { label: str(c.roll.label, 50), total: int(c.roll.total, -50, 300, 0), nat: c.roll.nat == null ? null : int(c.roll.nat, 1, 20, null), adv: ['adv', 'dis'].includes(c.roll.adv) ? c.roll.adv : null } : undefined };
}
function cleanBoard(b) {
  if (!b) return null; const title = str(b.title, 80); if (!title) return null;
  return { id: b.id ? str(b.id, 20) : undefined, at: Number(b.at) || undefined, cat: BOARD_CATS.includes(b.cat) ? b.cat : 'otro', title, text: str(b.text, 1500), img: b.img ? str(b.img, 20) : null, done: !!b.done };
}
function cleanStroke(k, by) {
  if (!k || !Array.isArray(k.pts) || k.pts.length < 2 || k.pts.length > PTS_MAX * 2) return null;
  const pts = []; for (let i = 0; i + 1 < k.pts.length; i += 2) { const x = Number(k.pts[i]), y = Number(k.pts[i + 1]); if (!(x >= -0.01 && x <= 1.01 && y >= -0.01 && y <= 1.34)) return null; pts.push(Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000); }
  return { id: k.id ? str(k.id, 20) : undefined, by: str(by, 20), color: COLOR_RE.test(k.color) ? k.color : '#2b1d12', w: int(k.w, 1, 40, 4), pts, erase: !!k.erase };
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
