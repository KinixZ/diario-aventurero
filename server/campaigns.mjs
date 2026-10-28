// Campañas del Diario del Aventurero, sin red: así se pueden probar solas.
// Una campaña tiene un código fijo de 6 letras y una clave del DM. Vive guardada (store.mjs) y se carga en memoria
// cuando alguien entra. Dentro van el combate, el chat, la pizarra, el tablero, los mapas con fichas y el bestiario
// del grupo; todo se puede consultar fuera de sesión. El DM decide cuándo empieza y termina cada sesión.
// La hoja de cada jugador sigue siendo la autoridad de sus propios PG: el servidor reenvía lo que le aplican
// y el jugador responde con su resumen actualizado.

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const CONDITIONS = ['blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'grappled', 'incapacitated',
  'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious', 'concentration'];

export const COND_ES = { blinded: 'Cegado', charmed: 'Hechizado', deafened: 'Ensordecido', exhaustion: 'Cansancio', frightened: 'Asustado', grappled: 'Agarrado', incapacitated: 'Incapacitado',
  invisible: 'Invisible', paralyzed: 'Paralizado', petrified: 'Petrificado', poisoned: 'Envenenado', prone: 'Derribado', restrained: 'Apresado', stunned: 'Aturdido', unconscious: 'Inconsciente', concentration: 'Concentración' };

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // sin I, L ni O para no confundir
export const CODE_LEN = 6;
const MAX_LOADED = 300;
const MAX_MEMBERS = 16;
const MAX_NPCS = 40;
const LOG_LEN = 80;
export const IDLE_UNLOAD_MS = 20 * 60 * 1000;
const CHAT_MAX = 1200, BOARD_MAX = 100, STROKES_MAX = 4000, PAGES_MAX = 30, PTS_MAX = 900;
export const IMG_MAX_BYTES = 2 * 1024 * 1024, CAMP_IMG_BYTES = 60 * 1024 * 1024;
export const BOARD_CATS = ['mision', 'pnj', 'lugar', 'pista', 'objeto', 'otro'];
const COLOR_RE = /^#[0-9a-f]{6}$/i;
export const NPC_HP = ['none', 'state', 'bar', 'pct', 'num']; // lo que ven los jugadores de la vida de los enemigos
const MAPS_MAX = 40, MAP_STROKES_MAX = 6000, MAP_PTS_MAX = 600, MAP_LAYERS_MAX = 8, MAP_TOOLS = ['pen', 'line', 'rect', 'text'];
const TOKENS_MAX = 120, PLAYER_TOKENS_MAX = 5, TOKEN_KINDS = ['pc', 'npc', 'obj'];
const BEASTS_MAX = 400, NOTES_MAX = 60, STAT_MAX = 80000;
export const BEAST_KINDS = ['enemigo', 'pnj', 'criatura'];

const int = (v, lo, hi, def = 0) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def; };
const num = (v, lo, hi, def = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n * 100) / 100)) : def; };
const str = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);
const txt = (v, max) => String(v ?? '').replace(/[\u0000-\u0009\u000b-\u001f]/g, '').trim().slice(0, max); // deja saltos de línea
const id = (n = 6) => randomBytes(n).toString('base64url');

/* ---------- Clave del DM ---------- */
export function hashKey(key) { const salt = randomBytes(12).toString('base64url'); return salt + ':' + scryptSync(String(key), salt, 32).toString('base64url'); }
export function checkKey(key, stored) {
  if (!stored || typeof key !== 'string' || !key) return false;
  const [salt, h] = String(stored).split(':'); if (!salt || !h) return false;
  const a = scryptSync(key, salt, 32), b = Buffer.from(h, 'base64url');
  return a.length === b.length && timingSafeEqual(a, b);
}
export function cleanKey(k) { const s = String(k ?? '').trim(); if (s.length < 4) throw err('bad_key', 'La clave del DM necesita al menos 4 caracteres.'); if (s.length > 64) throw err('bad_key', 'La clave del DM es demasiado larga.'); return s; }
export function cleanCode(c) { return String(c ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8); }

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
    speed: int(c.speed, 0, 200, 9),
    conc: str(c.conc, 60) || null,
    conds: Array.isArray(c.conds) ? c.conds.filter(x => CONDITIONS.includes(x)).slice(0, 16) : [],
    comps: Array.isArray(c.comps) ? c.comps.slice(0, 4).map(k => ({ name: str(k.name, 40), ac: int(k.ac, 0, 40, 10), hp: int(k.hp, 0, 999, 0), hpMax: int(k.hpMax, 1, 999, 1) })) : [],
  };
}

/* ---------- Niebla de guerra: un bit por casilla (1 = descubierta) ---------- */
function fogNew(map, revealed) { const b = Buffer.alloc(Math.ceil(map.cols * map.rows / 8), revealed ? 255 : 0); return b; }
function fogRect(map, x0, y0, x1, y1, v) {
  const a = Math.max(0, Math.min(x0, x1)), b = Math.min(map.cols - 1, Math.max(x0, x1)), c = Math.max(0, Math.min(y0, y1)), d = Math.min(map.rows - 1, Math.max(y0, y1));
  let n = 0;
  for (let y = c; y <= d; y++) for (let x = a; x <= b; x++) { const i = y * map.cols + x, byte = i >> 3, bit = 1 << (i & 7); if (v) map.fog.cells[byte] |= bit; else map.fog.cells[byte] &= ~bit; n++; }
  return n;
}
function fogOut(map) { return { on: !!map.fog.on, cells: map.fog.cells.toString('base64') }; }

export class Campaigns {
  constructor(store, now = () => Date.now()) { this.store = store; this.loaded = new Map(); this.loading = new Map(); this.now = now; }

  async newCode() {
    for (let tries = 0; tries < 60; tries++) {
      let c = ''; for (const b of randomBytes(CODE_LEN)) c += CODE_CHARS[b % CODE_CHARS.length];
      if (!this.loaded.has(c) && !(await this.store.has(c))) return c;
    }
    throw err('no_code', 'No pude crear un código; intenta otra vez.');
  }

  blank(code, name, dmHash) {
    const t = this.now();
    return { code, name: str(name, 60) || 'Campaña sin nombre', dmHash, created: t, touched: t, dirty: false, members: new Map(), npcs: new Map(), order: [], turn: -1, round: 0, hidePc: false, log: [],
      npcHp: 'state', pcInit: {}, maps: new Map(), scene: null, chat: [], board: [], strokes: [], pages: [], images: new Map(), imgBytes: 0,
      live: false, session: { n: 0, title: '', started: null, ended: null }, beasts: [], autoBeasts: true };
  }

  /* El DM crea la campaña: queda guardada de inmediato */
  async create({ name, dmKey } = {}) {
    if (this.loaded.size >= MAX_LOADED) await this.sweep(true);
    const key = cleanKey(dmKey);
    const c = this.blank(await this.newCode(), name, hashKey(key));
    const dm = this.addMember(c, 'DM', null, 'dm');
    this.log(c, `Se creó la campaña ${c.name}`);
    this.loaded.set(c.code, c);
    await this.flush(c);
    return { c, member: dm };
  }

  /* Trae una campaña a memoria (desde lo guardado si hace falta) */
  async open(code) {
    code = cleanCode(code);
    if (code.length !== CODE_LEN) throw err('no_room', 'El código de una campaña tiene 6 letras.');
    if (this.loaded.has(code)) return this.loaded.get(code);
    if (!this.loading.has(code)) this.loading.set(code, (async () => {
      try {
        const doc = await this.store.load(code);
        if (!doc) throw err('no_room', 'No existe una campaña con ese código. Revisa las letras.');
        if (this.loaded.size >= MAX_LOADED) await this.sweep(true);
        const c = this.fromDoc(doc); this.loaded.set(code, c); return c;
      } finally { this.loading.delete(code); }
    })());
    return this.loading.get(code);
  }
  get(code) { return this.loaded.get(cleanCode(code)); }

  /* Entrar: con tu token vuelves a tu lugar; con la clave del DM entras como DM; si no, como jugador */
  join(c, { name, char, token, dmKey } = {}) {
    if (token) for (const m of c.members.values()) if (m.token === token) { if (char && m.role !== 'dm') m.char = cleanChar(char); m.seen = this.now(); this.touch(c); return { member: m, rejoined: true }; }
    if (dmKey != null && dmKey !== '') {
      if (!checkKey(String(dmKey), c.dmHash)) throw err('bad_key', 'Esa no es la clave del DM de esta campaña.');
      const dm = [...c.members.values()].find((m) => m.role === 'dm') || this.addMember(c, 'DM', null, 'dm');
      dm.seen = this.now(); this.touch(c); return { member: dm, rejoined: true };
    }
    const ch = char ? cleanChar(char) : null;
    // Si cambias de teléfono, recuperas tu lugar con el mismo personaje (si nadie lo está usando ahora)
    if (ch) for (const m of c.members.values()) if (m.role === 'player' && !m.conns && m.char && m.char.name.toLowerCase() === ch.name.toLowerCase()) { m.char = ch; m.seen = this.now(); this.touch(c); return { member: m, rejoined: true }; }
    if (c.members.size >= MAX_MEMBERS) throw err('room_full', 'La campaña ya tiene demasiados jugadores. El DM puede quitar a los que ya no juegan.');
    const m = this.addMember(c, name, ch || {}, 'player');
    this.log(c, `${m.char ? m.char.name : m.name} se unió a la campaña`);
    return { member: m };
  }

  addMember(c, name, char, role) {
    const m = { id: 'p' + id(4), token: id(16), role, name: str(name, 40) || 'Jugador', conns: 0, init: null, char: role === 'dm' ? null : cleanChar(char), seen: this.now() };
    if (m.char && c.pcInit[m.char.name] != null) m.init = c.pcInit[m.char.name];
    c.members.set(m.id, m); this.touch(c);
    if (m.init != null) this.sortOrder(c);
    return m;
  }

  connect(c, memberId) { const m = c.members.get(memberId); if (m) { m.conns = (m.conns || 0) + 1; m.seen = this.now(); } c.touched = this.now(); }
  disconnect(c, memberId) { const m = c.members.get(memberId); if (m) { m.conns = Math.max(0, (m.conns || 0) - 1); m.seen = this.now(); } c.touched = this.now(); }
  online(c) { let n = 0; for (const m of c.members.values()) if (m.conns > 0) n++; return n; }

  touch(c) { c.touched = this.now(); c.dirty = true; }
  log(c, text) { c.log.push({ at: this.now(), text: str(text, 200) }); if (c.log.length > LOG_LEN) c.log.splice(0, c.log.length - LOG_LEN); c.dirty = true; }

  /* ---------- Guardado ---------- */
  async flush(c) { if (!c) return; c.dirty = false; await this.store.save(c.code, this.toDoc(c)); }
  async flushAll() { for (const c of this.loaded.values()) if (c.dirty) { try { await this.flush(c); } catch { c.dirty = true; } } }
  /* Guarda lo pendiente y saca de memoria las campañas sin nadie conectado */
  async sweep(force) {
    const t = this.now();
    for (const [code, c] of this.loaded) {
      if (c.dirty) { try { await this.flush(c); } catch { continue; } }
      if (!this.online(c) && (force || t - c.touched > IDLE_UNLOAD_MS)) this.loaded.delete(code);
    }
  }

  toDoc(c) {
    return { v: 2, code: c.code, name: c.name, dmHash: c.dmHash, created: c.created, live: c.live, session: c.session, npcHp: c.npcHp, hidePc: c.hidePc, pcInit: c.pcInit,
      members: [...c.members.values()].map((m) => ({ id: m.id, token: m.token, role: m.role, name: m.name, init: m.init, char: m.char, seen: m.seen })),
      npcs: [...c.npcs.values()], order: c.order, turn: c.turn, round: c.round, log: c.log, chat: c.chat, board: c.board, strokes: c.strokes, pages: c.pages,
      maps: [...c.maps.values()].map((mp) => ({ ...mp, fog: { on: mp.fog.on, cells: mp.fog.cells.toString('base64') } })), scene: c.scene,
      images: [...c.images.values()], beasts: c.beasts, autoBeasts: c.autoBeasts };
  }
  fromDoc(d) {
    const c = this.blank(str(d.code, 8), d.name, d.dmHash);
    c.created = Number(d.created) || this.now(); c.live = !!d.live; c.hidePc = !!d.hidePc; if (NPC_HP.includes(d.npcHp)) c.npcHp = d.npcHp;
    c.session = { n: int(d.session && d.session.n, 0, 99999, 0), title: str(d.session && d.session.title, 80), started: (d.session && d.session.started) || null, ended: (d.session && d.session.ended) || null };
    c.pcInit = d.pcInit && typeof d.pcInit === 'object' ? d.pcInit : {};
    for (const m of d.members || []) c.members.set(m.id, { id: m.id, token: m.token, role: m.role === 'dm' ? 'dm' : 'player', name: str(m.name, 40), init: m.init ?? null, char: m.role === 'dm' ? null : cleanChar(m.char || {}), seen: m.seen || 0, conns: 0 });
    for (const n of d.npcs || []) c.npcs.set(n.id, n);
    c.order = Array.isArray(d.order) ? d.order : []; c.turn = int(d.turn, -1, 999, -1); c.round = int(d.round, 0, 999, 0);
    c.log = Array.isArray(d.log) ? d.log.slice(-LOG_LEN) : [];
    c.chat = Array.isArray(d.chat) ? d.chat.slice(-CHAT_MAX) : []; c.board = Array.isArray(d.board) ? d.board : []; c.strokes = Array.isArray(d.strokes) ? d.strokes : []; c.pages = Array.isArray(d.pages) ? d.pages.slice(-PAGES_MAX) : [];
    for (const mp of d.maps || []) { const m = { ...mp, layers: mp.layers || [], strokes: mp.strokes || [], tokens: mp.tokens || [], bg: mp.bg || null }; m.fog = { on: !!(mp.fog && mp.fog.on), cells: mp.fog && mp.fog.cells ? Buffer.from(mp.fog.cells, 'base64') : null }; if (!m.fog.cells || m.fog.cells.length !== Math.ceil(m.cols * m.rows / 8)) m.fog.cells = fogNew(m, false); c.maps.set(m.id, m); }
    c.scene = d.scene && c.maps.has(d.scene) ? d.scene : null;
    for (const im of d.images || []) { c.images.set(im.id, im); c.imgBytes += im.size || 0; }
    c.beasts = Array.isArray(d.beasts) ? d.beasts : []; c.autoBeasts = d.autoBeasts !== false;
    c.dirty = false;
    return c;
  }

  /* Encuentro guardado: enemigos con sus números, ronda y de quién era el turno */
  loadEncounter(c, e) {
    c.npcs = new Map();
    for (const x of (Array.isArray(e.npcs) ? e.npcs : []).slice(0, MAX_NPCS)) {
      const hpMax = int(x.hpMax, 1, 9999, 10);
      const n = { id: 'n' + id(4), name: str(x.name, 40) || 'Enemigo', ac: int(x.ac, 0, 40, 12), hp: int(x.hp, 0, hpMax, hpMax), hpMax, temp: int(x.temp, 0, 999, 0),
        init: x.init == null || x.init === '' ? null : int(x.init, -10, 50, 0), conds: Array.isArray(x.conds) ? x.conds.filter(k => CONDITIONS.includes(k)).slice(0, 16) : [], hidden: !!x.hidden,
        ref: x.ref ? str(x.ref, 120) : null, initMod: int(x.initMod, -10, 20, 0), formula: x.formula ? str(x.formula, 30) : null };
      c.npcs.set(n.id, n);
      if (!n.hidden) this.autoBeast(c, n);
    }
    // la iniciativa de los jugadores se recupera por el nombre de su personaje (o se guarda para cuando entren)
    c.pcInit = {};
    for (const [nm, v] of Object.entries(e.pcInit && typeof e.pcInit === 'object' ? e.pcInit : {}).slice(0, MAX_MEMBERS)) c.pcInit[str(nm, 40)] = int(v, -10, 50, 0);
    for (const m of c.members.values()) if (m.char && c.pcInit[m.char.name] != null) m.init = c.pcInit[m.char.name];
    this.sortOrder(c);
    c.round = int(e.round, 0, 999, 0);
    const tn = str(e.turnName, 40), ti = c.order.findIndex((oid) => this.nameOf(c, oid) === tn);
    c.turn = c.round > 0 && c.order.length ? Math.max(0, ti) : -1;
  }

  /* Al aparecer un enemigo visible, se anota en el bestiario del grupo (si no estaba) */
  autoBeast(c, n) {
    if (!c.autoBeasts || c.beasts.length >= BEASTS_MAX) return;
    const base = str(n.name, 40).replace(/\s+\d+$/, '');
    if (!base || c.beasts.some((b) => b.name.toLowerCase() === base.toLowerCase())) return;
    c.beasts.unshift({ id: 'B' + id(5), name: base, kind: 'enemigo', ref: n.ref || null, img: null, text: '', info: {}, stat: null, hidden: false, auto: true, seen: this.now(), ses: c.session.n, notes: [] });
    this.log(c, `Nuevo en el bestiario: ${base}`);
  }

  member(c, who) { const m = c.members.get(who); if (!m) throw err('not_member', 'Ya no estás en esta campaña.'); return m; }

  /* Acciones. Devuelven una lista de avisos para miembros concretos ({to, msg}); out.quiet = no hace falta repartir el estado. */
  act(c, who, msg) {
    const me = this.member(c, who);
    const isDm = me.role === 'dm';
    const out = [];
    const dmOnly = (what) => { if (!isDm) throw err('dm_only', what || 'Solo el DM puede hacer eso.'); };
    const toAll = (m, filter) => { for (const mm of c.members.values()) if (!filter || filter(mm)) out.push({ to: mm.id, msg: m }); };
    if (msg.t === 'map.get' || msg.t === 'beast.get' || msg.t === 'map.ping') c.touched = this.now(); else this.touch(c);
    switch (msg.t) {
      case 'char': if (!isDm) me.char = cleanChar(msg.char); break;
      /* ---------- Campaña y sesión ---------- */
      case 'camp.name': dmOnly(); { const n = str(msg.name, 60); if (!n) throw err('empty', 'Ponle nombre a la campaña.'); c.name = n; } break;
      case 'camp.key': dmOnly(); c.dmHash = hashKey(cleanKey(msg.key)); this.log(c, 'El DM cambió su clave'); break;
      case 'member.del': {
        dmOnly('Solo el DM puede quitar jugadores.');
        const m = c.members.get(str(msg.id, 20)); if (!m || m.role === 'dm') break;
        c.members.delete(m.id); c.order = c.order.filter((x) => x !== m.id); if (c.turn >= c.order.length) c.turn = c.order.length ? 0 : -1;
        out.push({ to: m.id, msg: { t: 'kicked' } }); out.kicked = m.id;
        this.log(c, `${m.char ? m.char.name : m.name} ya no está en la campaña`);
        break;
      }
      case 'session.start': {
        dmOnly('Solo el DM empieza la sesión.');
        if (c.live) break;
        c.live = true; c.session = { n: c.session.n + 1, title: str(msg.title, 80) || c.session.title || '', started: this.now(), ended: null };
        this.log(c, `Empezó la sesión ${c.session.n}${c.session.title ? ': ' + c.session.title : ''}`);
        toAll({ t: 'live', live: true, n: c.session.n, title: c.session.title });
        break;
      }
      case 'session.title': dmOnly(); c.session.title = str(msg.title, 80); break;
      case 'session.end': {
        dmOnly('Solo el DM termina la sesión.');
        if (!c.live) throw err('not_live', 'No hay una sesión en curso.');
        c.session.ended = this.now(); c.live = false;
        if (c.strokes.length) { c.pages.push({ at: this.now(), strokes: c.strokes }); if (c.pages.length > PAGES_MAX) c.pages.shift(); c.strokes = []; }
        this.log(c, `El DM terminó la sesión ${c.session.n}`);
        for (const mm of c.members.values()) out.push({ to: mm.id, msg: { t: 'ended', snapshot: this.snapshot(c, mm.id) } });
        break;
      }
      /* ---------- Combate ---------- */
      case 'init': {
        const target = msg.id ? (c.members.get(msg.id) || c.npcs.get(msg.id)) : me;
        if (!target) throw err('no_target', 'No encuentro a quién ponerle iniciativa.');
        if (target !== me && !isDm) throw err('dm_only', 'Solo el DM puede poner la iniciativa de otros.');
        target.init = msg.value == null || msg.value === '' ? null : int(msg.value, -10, 50, 0);
        if (target.char) { if (target.init == null) delete c.pcInit[target.char.name]; else c.pcInit[target.char.name] = target.init; }
        this.sortOrder(c);
        this.log(c, `${target.name && !target.char ? target.name : target.char?.name} tiene iniciativa ${target.init ?? '–'}`);
        break;
      }
      case 'npc.add': {
        dmOnly('Solo el DM agrega enemigos.');
        if (c.npcs.size >= MAX_NPCS) throw err('too_many', 'Ya hay demasiados PNJ en el combate.');
        const count = int(msg.count, 1, 12, 1);
        for (let i = 0; i < count; i++) {
          const hpMax = int(msg.hp, 1, 9999, 10);
          const n = { id: 'n' + id(4), name: (str(msg.name, 40) || 'Enemigo') + (count > 1 ? ' ' + (i + 1) : ''), ac: int(msg.ac, 0, 40, 12), hp: hpMax, hpMax, temp: 0, init: msg.init == null || msg.init === '' ? null : int(msg.init, -10, 50, 0), conds: [], hidden: !!msg.hidden,
            ref: msg.ref ? str(msg.ref, 120) : null, initMod: int(msg.initMod, -10, 20, 0), formula: msg.formula ? str(msg.formula, 30) : null };
          c.npcs.set(n.id, n);
          if (!n.hidden && i === 0) this.autoBeast(c, n);
        }
        this.sortOrder(c);
        this.log(c, `El DM agregó ${count > 1 ? count + ' × ' : ''}${str(msg.name, 40) || 'enemigo'}`);
        break;
      }
      case 'npc.del': {
        dmOnly('Solo el DM quita enemigos.');
        const n = c.npcs.get(msg.id); if (!n) break;
        c.npcs.delete(msg.id); c.order = c.order.filter(x => x !== msg.id); if (c.turn >= c.order.length) c.turn = c.order.length ? 0 : -1;
        this.log(c, `${n.name} salió del combate`);
        break;
      }
      case 'npc.set': {
        dmOnly('Solo el DM ajusta a los enemigos.');
        const n = c.npcs.get(msg.id); if (!n) throw err('no_target', 'Ese enemigo ya no está.');
        if (msg.hpMax != null) { n.hpMax = int(msg.hpMax, 1, 9999, n.hpMax); n.hp = Math.min(n.hp, n.hpMax); }
        if (msg.hp != null) n.hp = int(msg.hp, 0, n.hpMax, n.hp);
        if (msg.delta != null) { const d = int(msg.delta, -9999, 9999, 0); if (d < 0) applyTo(n, 'damage', -d); else applyTo(n, 'heal', d); }
        if (msg.ac != null) n.ac = int(msg.ac, 0, 40, n.ac);
        if (msg.name != null && str(msg.name, 40)) n.name = str(msg.name, 40);
        if (Array.isArray(msg.conds)) n.conds = msg.conds.filter(x => CONDITIONS.includes(x)).slice(0, 16);
        break;
      }
      case 'npc.reveal': { dmOnly(); const n = c.npcs.get(msg.id); if (n) { n.hidden = !n.hidden; if (!n.hidden) this.autoBeast(c, n); } break; }
      case 'hidepc': dmOnly(); c.hidePc = !!msg.value; break;
      case 'npchp': dmOnly(); if (!NPC_HP.includes(msg.value)) throw err('bad_msg', 'Opción desconocida.'); c.npcHp = msg.value; break;
      case 'enc.load': {
        dmOnly('Solo el DM carga encuentros.');
        this.loadEncounter(c, msg.enc || {});
        this.log(c, `El DM cargó el encuentro ${str(msg.enc && msg.enc.name, 60) || 'guardado'}`);
        break;
      }
      case 'turn': {
        if (!c.order.length) throw err('no_order', 'Primero tiren iniciativa.');
        const cur = c.order[c.turn];
        if (!isDm && cur !== me.id) throw err('not_your_turn', 'Solo el DM o quien tiene el turno puede pasarlo.');
        if (msg.dir === 'start' || c.turn < 0) { c.turn = 0; c.round = 1; }
        else if (msg.dir === 'prev') { c.turn -= 1; if (c.turn < 0) { c.turn = c.order.length - 1; c.round = Math.max(1, c.round - 1); } }
        else { c.turn += 1; if (c.turn >= c.order.length) { c.turn = 0; c.round += 1; } }
        this.log(c, `Ronda ${c.round}: turno de ${this.nameOf(c, c.order[c.turn])}`);
        out.push({ to: c.order[c.turn], msg: { t: 'yourturn', round: c.round } });
        break;
      }
      case 'end': dmOnly('Solo el DM termina el combate.'); c.turn = -1; c.round = 0; for (const n of c.npcs.values()) n.init = null; for (const m of c.members.values()) m.init = null; c.pcInit = {}; c.order = []; this.log(c, 'Terminó el combate'); break;
      case 'apply': {
        const kind = ['damage', 'heal', 'temp', 'cond+', 'cond-'].includes(msg.kind) ? msg.kind : null;
        if (!kind) throw err('bad_kind', 'Acción desconocida.');
        const amount = int(msg.amount, 0, 999, 0), cond = CONDITIONS.includes(msg.cond) ? msg.cond : null;
        if ((kind === 'cond+' || kind === 'cond-') && !cond) throw err('bad_cond', 'Elige una condición.');
        if ((kind === 'damage' || kind === 'heal' || kind === 'temp') && !amount) throw err('no_amount', 'Escribe una cantidad.');
        const note = str(msg.note, 80), names = [];
        for (const tid of (Array.isArray(msg.targets) ? msg.targets : []).slice(0, 20)) {
          const npc = c.npcs.get(tid), pc = c.members.get(tid);
          if (npc) { applyTo(npc, kind, amount, cond); names.push(npc.name); }
          else if (pc && pc.role !== 'dm' && isDm) continue; // el DM maneja solo a los enemigos; cada jugador lleva su hoja
          else if (pc && pc.role !== 'dm') {
            applyTo(pc.char, kind, amount, cond); names.push(pc.char.name);
            out.push({ to: pc.id, msg: { t: 'applied', kind, amount, cond, note, from: me.name } });
          }
        }
        if (!names.length) throw err('no_target', isDm ? 'Como DM puedes aplicar a los enemigos; los jugadores llevan su propia hoja.' : 'Elige al menos un objetivo.');
        const verb = { damage: `hizo ${amount} de daño a`, heal: `curó ${amount} PG a`, temp: `dio ${amount} PG temporales a`, 'cond+': `aplicó ${COND_ES[cond]} a`, 'cond-': `quitó ${COND_ES[cond]} a` }[kind];
        this.log(c, `${isDm ? 'El DM' : (me.char && me.char.name) || me.name} ${verb} ${names.join(', ')}${note ? ' (' + note + ')' : ''}`);
        break;
      }
      /* ---------- Mapas: lienzos con cuadrícula, capas, fichas y niebla ---------- */
      case 'map.save': {
        const mp = cleanMap(msg.map, me.id, isDm, c); if (!mp) throw err('bad_map', 'El mapa no tiene un formato válido.');
        const old = c.maps.get(mp.id);
        if (!old && c.maps.size >= MAPS_MAX) throw err('too_many', 'La campaña ya tiene demasiados mapas.');
        if (old && !isDm && old.by !== me.id) throw err('dm_only', 'Solo el DM o quien lo creó puede reemplazar este mapa.');
        if (old && !isDm) { mp.hidden = old.hidden; mp.tokens = old.tokens; mp.fog = old.fog; mp.bg = old.bg; mp.layers = old.layers.filter((l) => l.dm).concat(mp.layers); mp.strokes = old.strokes.filter((k) => layerDm(old, k.l)).concat(mp.strokes); }
        if (!old && !isDm) mp.hidden = false;
        mp.updated = this.now(); c.maps.set(mp.id, mp);
        this.sendMap(c, mp, out);
        break;
      }
      case 'map.meta': {
        const mp = this.mapFor(c, me, msg.id);
        if (msg.name != null && str(msg.name, 60)) mp.name = str(msg.name, 60);
        if (['square', 'hex', 'none'].includes(msg.grid)) mp.grid = msg.grid;
        if (Array.isArray(msg.layers)) {
          const ls = cleanLayers(msg.layers, isDm);
          // un jugador no ve ni puede tocar las capas secretas del DM
          const keep = isDm ? ls : mp.layers.filter((l) => l.dm).concat(ls.map((l) => ({ id: l.id, name: l.name })));
          if (keep.length) { mp.layers = keep; const ok = new Set(keep.map((l) => l.id)); mp.strokes = mp.strokes.filter((k) => ok.has(k.l)); }
        }
        mp.updated = this.now();
        for (const mm of c.members.values()) if (this.canSeeMap(c, mp, mm)) out.push({ to: mm.id, msg: { t: 'map.meta', id: mp.id, name: mp.name, grid: mp.grid, layers: mm.role === 'dm' ? mp.layers : mp.layers.filter((l) => !l.dm), updated: mp.updated } });
        break;
      }
      case 'map.del': {
        const mp = c.maps.get(str(msg.id, 24)); if (!mp) break;
        if (!isDm && mp.by !== me.id) throw err('dm_only', 'Solo el DM o quien lo creó puede quitarlo de la campaña.');
        c.maps.delete(mp.id); if (c.scene === mp.id) c.scene = null;
        break;
      }
      case 'map.hide': {
        dmOnly('Solo el DM oculta o muestra mapas.');
        const mp = this.mapFor(c, me, msg.id); mp.hidden = !!msg.value; mp.updated = this.now();
        if (mp.hidden && c.scene === mp.id) c.scene = null;
        if (!mp.hidden) this.sendMap(c, mp, out, (mm) => mm.role !== 'dm');
        break;
      }
      case 'map.get': { const mp = this.mapFor(c, me, msg.id); out.push({ to: me.id, msg: { t: 'map', map: this.mapView(mp, me) } }); out.quiet = true; break; }
      case 'map.add': {
        const mp = this.mapFor(c, me, msg.id);
        if (mp.strokes.length >= MAP_STROKES_MAX) throw err('board_full', 'Este mapa está lleno: hagan uno nuevo para la siguiente zona.');
        const k = cleanMapStroke(msg.stroke, me.id, mp); if (!k) throw err('bad_stroke', 'No se pudo guardar el trazo.');
        const secret = layerDm(mp, k.l); if (secret && !isDm) throw err('dm_only', 'Esa capa es solo del DM.');
        k.id = 'k' + id(5); mp.strokes.push(k); mp.updated = this.now();
        for (const mm of c.members.values()) if (this.canSeeMap(c, mp, mm) && (!secret || mm.role === 'dm')) out.push({ to: mm.id, msg: { t: 'map.add', id: mp.id, stroke: k, updated: mp.updated } });
        out.quiet = true;
        break;
      }
      case 'map.rm': case 'map.undo': {
        const mp = this.mapFor(c, me, msg.id);
        let ids;
        if (msg.t === 'map.undo') { const last = [...mp.strokes].reverse().find((k) => k.by === me.id); ids = last ? [last.id] : []; }
        else ids = (Array.isArray(msg.sids) ? msg.sids : []).slice(0, 200).map((x) => str(x, 20));
        const set = new Set(ids), gone = [];
        mp.strokes = mp.strokes.filter((k) => { const del = set.has(k.id) && (isDm || !layerDm(mp, k.l)); if (del) gone.push(k.id); return !del; });
        if (gone.length) { mp.updated = this.now(); for (const mm of c.members.values()) if (this.canSeeMap(c, mp, mm)) out.push({ to: mm.id, msg: { t: 'map.rm', id: mp.id, sids: gone, updated: mp.updated } }); }
        out.quiet = true;
        break;
      }
      case 'map.bg': {
        const mp = this.mapFor(c, me, msg.id);
        if (!isDm && mp.by !== me.id) throw err('dm_only', 'Solo el DM o quien creó el mapa cambia el fondo.');
        if (msg.img) { const im = c.images.get(str(msg.img, 30)); if (!im) throw err('no_img', 'La imagen no se subió bien; vuelve a intentar.'); mp.bg = { img: im.id, op: num(msg.op, 0.1, 1, 1) }; }
        else if (msg.op != null && mp.bg) mp.bg.op = num(msg.op, 0.1, 1, 1);
        else mp.bg = null;
        mp.updated = this.now();
        for (const mm of c.members.values()) if (this.canSeeMap(c, mp, mm)) out.push({ to: mm.id, msg: { t: 'map.bg', id: mp.id, bg: mp.bg, updated: mp.updated } });
        out.quiet = true;
        break;
      }
      case 'fog.on': case 'fog.rect': case 'fog.all': {
        dmOnly('Solo el DM maneja la niebla.');
        const mp = this.mapFor(c, me, msg.id);
        if (msg.t === 'fog.on') mp.fog.on = !!msg.value;
        else if (msg.t === 'fog.all') mp.fog.cells = fogNew(mp, !!msg.value);
        else { const r = Array.isArray(msg.rect) ? msg.rect.map((v) => int(v, -1, 999, 0)) : null; if (!r || r.length !== 4) throw err('bad_msg', 'Área de niebla inválida.'); fogRect(mp, r[0], r[1], r[2], r[3], !!msg.value); }
        mp.updated = this.now();
        for (const mm of c.members.values()) if (this.canSeeMap(c, mp, mm)) out.push({ to: mm.id, msg: { t: 'map.fog', id: mp.id, fog: fogOut(mp), updated: mp.updated } });
        out.quiet = true;
        break;
      }
      case 'tok.add': {
        const mp = this.mapFor(c, me, msg.id);
        const t = cleanToken(msg.tok, mp, c, me);
        if (!isDm) {
          t.hidden = false;
          if (t.kind === 'npc') throw err('dm_only', 'Solo el DM pone enemigos en el mapa.');
          // tu personaje solo puede estar una vez en cada mapa: si ya estaba, se mueve
          if (t.kind === 'pc' && t.ref === me.id) { const was = mp.tokens.find((x) => x.kind === 'pc' && x.ref === me.id && !x.comp); if (was && !msg.tok.comp) { was.x = t.x; was.y = t.y; mp.updated = this.now(); this.sendTok(c, mp, was, out, was.hidden); out.quiet = true; break; } }
          if (mp.tokens.filter((x) => x.by === me.id).length >= PLAYER_TOKENS_MAX) throw err('too_many', 'Ya tienes muchas fichas en este mapa.');
        }
        if (mp.tokens.length >= TOKENS_MAX) throw err('too_many', 'Este mapa ya tiene demasiadas fichas.');
        mp.tokens.push(t); mp.updated = this.now();
        this.sendTok(c, mp, t, out, t.hidden); out.quiet = true;
        break;
      }
      case 'tok.move': case 'tok.set': {
        const mp = this.mapFor(c, me, msg.id);
        const t = mp.tokens.find((x) => x.id === str(msg.tid, 20)); if (!t) throw err('no_target', 'Esa ficha ya no está.');
        if (!isDm && t.by !== me.id && t.ref !== me.id) throw err('not_yours', 'Solo puedes mover tus fichas; el DM mueve todas.');
        const wasHidden = t.hidden;
        if (msg.t === 'tok.move') { t.x = num(msg.x, 0, mp.cols - 1, t.x); t.y = num(msg.y, 0, mp.rows - 1, t.y); }
        else {
          if (msg.name != null && str(msg.name, 40)) t.name = str(msg.name, 40);
          if (msg.s != null) t.s = int(msg.s, 1, 6, t.s);
          if (msg.color != null && COLOR_RE.test(msg.color)) t.color = msg.color;
          if (msg.img !== undefined) { if (!msg.img) t.img = null; else if (c.images.has(str(msg.img, 30))) t.img = str(msg.img, 30); }
          if (msg.hidden != null && isDm) t.hidden = !!msg.hidden;
          if (msg.ref !== undefined && isDm) t.ref = msg.ref ? str(msg.ref, 20) : null;
        }
        mp.updated = this.now();
        this.sendTok(c, mp, t, out, wasHidden); out.quiet = true;
        break;
      }
      case 'tok.del': {
        const mp = this.mapFor(c, me, msg.id);
        const t = mp.tokens.find((x) => x.id === str(msg.tid, 20)); if (!t) break;
        if (!isDm && t.by !== me.id && t.ref !== me.id) throw err('not_yours', 'Solo puedes quitar tus fichas.');
        mp.tokens = mp.tokens.filter((x) => x !== t); mp.updated = this.now();
        for (const mm of c.members.values()) if (this.canSeeMap(c, mp, mm)) out.push({ to: mm.id, msg: { t: 'tok.del', id: mp.id, tid: t.id } });
        out.quiet = true;
        break;
      }
      case 'scene.set': {
        dmOnly('Solo el DM elige qué mapa ven todos.');
        if (!msg.id) { c.scene = null; break; }
        const mp = this.mapFor(c, me, msg.id);
        if (mp.hidden) { mp.hidden = false; this.sendMap(c, mp, out, (mm) => mm.role !== 'dm'); }
        c.scene = mp.id;
        toAll({ t: 'scene', id: mp.id, name: mp.name });
        this.log(c, `El DM muestra el mapa ${mp.name}`);
        break;
      }
      case 'map.ping': {
        const mp = this.mapFor(c, me, msg.id);
        const p = { t: 'ping', id: mp.id, x: num(msg.x, 0, mp.cols, 0), y: num(msg.y, 0, mp.rows, 0), name: isDm ? 'DM' : (me.char && me.char.name) || me.name, color: COLOR_RE.test(msg.color) ? msg.color : '#ffd66e' };
        for (const mm of c.members.values()) if (this.canSeeMap(c, mp, mm)) out.push({ to: mm.id, msg: p });
        out.quiet = true;
        break;
      }
      /* ---------- Bestiario del grupo: el DM revela, todos anotan ---------- */
      case 'beast.add': case 'beast.edit': {
        dmOnly('Solo el DM registra criaturas; ustedes pueden dejar notas.');
        const b = cleanBeast(msg.beast, c); if (!b) throw err('empty', 'Ponle nombre a la criatura.');
        if (msg.t === 'beast.add') {
          if (c.beasts.length >= BEASTS_MAX) throw err('too_many', 'El bestiario está lleno.');
          const same = c.beasts.find((x) => x.name.toLowerCase() === b.name.toLowerCase());
          if (same) { Object.assign(same, b, { id: same.id, notes: same.notes, seen: same.seen, ses: same.ses, auto: false }); out.push({ to: me.id, msg: { t: 'beast.saved', id: same.id } }); }
          else { const nb = { ...b, id: 'B' + id(5), seen: this.now(), ses: c.session.n, notes: [], auto: false }; c.beasts.unshift(nb); out.push({ to: me.id, msg: { t: 'beast.saved', id: nb.id } }); if (!nb.hidden) this.log(c, `Nuevo en el bestiario: ${nb.name}`); }
        } else {
          const cur = c.beasts.find((x) => x.id === str(msg.id, 20)); if (!cur) throw err('no_target', 'Esa criatura ya no está.');
          const wasHidden = cur.hidden;
          Object.assign(cur, b, { id: cur.id, notes: cur.notes, seen: cur.seen, ses: cur.ses, auto: false });
          if (wasHidden && !cur.hidden) this.log(c, `Nuevo en el bestiario: ${cur.name}`);
          this.sendBeast(c, cur, out);
        }
        break;
      }
      case 'beast.del': dmOnly(); c.beasts = c.beasts.filter((x) => x.id !== str(msg.id, 20)); break;
      case 'beast.auto': dmOnly(); c.autoBeasts = !!msg.value; break;
      case 'beast.get': {
        const b = c.beasts.find((x) => x.id === str(msg.id, 20)); if (!b || (b.hidden && !isDm)) throw err('no_target', 'Esa criatura no está en el bestiario.');
        out.push({ to: me.id, msg: { t: 'beast', beast: b } }); out.quiet = true;
        break;
      }
      case 'beast.note': {
        const b = c.beasts.find((x) => x.id === str(msg.id, 20)); if (!b || (b.hidden && !isDm)) throw err('no_target', 'Esa criatura no está en el bestiario.');
        const text = txt(msg.text, 600); if (!text) throw err('empty', 'Escribe tu nota primero.');
        if (b.notes.length >= NOTES_MAX) b.notes.shift();
        b.notes.push({ id: 'q' + id(4), by: me.id, name: isDm ? 'DM' : (me.char && me.char.name) || me.name, text, at: this.now() });
        this.sendBeast(c, b, out);
        break;
      }
      case 'beast.unnote': {
        const b = c.beasts.find((x) => x.id === str(msg.id, 20)); if (!b) break;
        const n = b.notes.find((x) => x.id === str(msg.nid, 20)); if (!n) break;
        if (!isDm && n.by !== me.id) throw err('not_yours', 'Solo puedes borrar tus notas.');
        b.notes = b.notes.filter((x) => x !== n);
        this.sendBeast(c, b, out);
        break;
      }
      /* ---------- Chat, tiradas, imágenes, susurros ---------- */
      case 'chat.send': case 'chat.roll': case 'chat.img': {
        let to = msg.to ? String(msg.to) : null;
        if (to) {
          const tm = c.members.get(to);
          if (!tm || tm.id === me.id) throw err('no_target', 'No encuentro a quién mandarle el susurro.');
          if (!isDm && tm.role !== 'dm') throw err('dm_only', 'Los susurros son entre un jugador y el DM.');
        }
        const base = { id: 'm' + id(5), at: this.now(), from: me.id, name: isDm ? 'DM' : (me.char && me.char.name) || me.name, role: me.role, to, ses: c.live ? c.session.n : 0 };
        let m;
        if (msg.t === 'chat.send') { const text = txt(msg.text, 1200); if (!text) throw err('empty', 'Escribe algo primero.'); m = { ...base, kind: 'msg', text }; }
        else if (msg.t === 'chat.roll') { const total = int(msg.total, -50, 300, NaN); if (!Number.isFinite(total)) throw err('bad_roll', 'Escribe el total de tu tirada.'); m = { ...base, kind: 'roll', roll: { label: str(msg.label, 50) || 'Tirada', total, nat: msg.nat == null || msg.nat === '' ? null : int(msg.nat, 1, 20, null), adv: ['adv', 'dis'].includes(msg.adv) ? msg.adv : null } }; }
        else { const im = c.images.get(String(msg.img || '')); if (!im) throw err('no_img', 'La imagen no se subió bien; vuelve a intentar.'); m = { ...base, kind: 'img', img: im.id, text: str(msg.caption, 200) }; }
        c.chat.push(m); if (c.chat.length > CHAT_MAX) c.chat.splice(0, c.chat.length - CHAT_MAX);
        for (const mm of c.members.values()) if (visible(m, mm.id)) out.push({ to: mm.id, msg: { t: 'chat', msg: m } });
        out.quiet = true;
        break;
      }
      /* ---------- Tablero del DM ---------- */
      case 'board.add': case 'board.edit': {
        dmOnly('Solo el DM escribe en el tablero.');
        if (msg.img && !c.images.has(String(msg.img))) throw err('no_img', 'Esa imagen ya no está en la campaña.');
        const b = cleanBoard({ ...msg.item, img: msg.img || (msg.item && msg.item.img) });
        if (!b) throw err('empty', 'Ponle título a la nota.');
        if (msg.t === 'board.add') { if (c.board.length >= BOARD_MAX) throw err('too_many', 'El tablero está lleno; borra notas viejas.'); b.id = 'b' + id(4); b.at = this.now(); c.board.unshift(b); }
        else { const i = c.board.findIndex((x) => x.id === msg.id); if (i < 0) throw err('no_target', 'Esa nota ya no está.'); c.board[i] = { ...c.board[i], ...b, id: c.board[i].id, at: c.board[i].at }; }
        break;
      }
      case 'board.del': dmOnly('Solo el DM borra notas del tablero.'); c.board = c.board.filter((x) => x.id !== msg.id); break;
      case 'board.done': { dmOnly(); const b = c.board.find((x) => x.id === msg.id); if (b) b.done = !b.done; break; }
      /* ---------- Pizarra ---------- */
      case 'draw.add': {
        if (c.strokes.length >= STROKES_MAX) throw err('board_full', 'La pizarra está llena: que el DM pase a una hoja nueva.');
        const k = cleanStroke(msg.stroke, me.id); if (!k) throw err('bad_stroke', 'No se pudo guardar el trazo.');
        k.id = 'k' + id(5); c.strokes.push(k);
        toAll({ t: 'draw', stroke: k });
        out.quiet = true;
        break;
      }
      case 'draw.undo': {
        let i = -1; for (let j = c.strokes.length - 1; j >= 0; j--) if (c.strokes[j].by === me.id) { i = j; break; }
        if (i < 0) { out.quiet = true; break; }
        const [k] = c.strokes.splice(i, 1);
        toAll({ t: 'draw.undo', id: k.id });
        out.quiet = true;
        break;
      }
      case 'draw.clear': {
        dmOnly('Solo el DM pasa a una hoja nueva.');
        if (c.strokes.length) { c.pages.push({ at: this.now(), strokes: c.strokes }); if (c.pages.length > PAGES_MAX) c.pages.shift(); }
        c.strokes = [];
        toAll({ t: 'draw.clear', pages: c.pages.length });
        out.quiet = true;
        break;
      }
      default: throw err('bad_msg', 'Mensaje desconocido.');
    }
    return out;
  }

  /* ---------- Mapas: quién ve qué ---------- */
  canSeeMap(c, mp, mm) { return mm.role === 'dm' || !mp.hidden; }
  mapFor(c, me, mid) { const mp = c.maps.get(str(mid, 24)); if (!mp || !this.canSeeMap(c, mp, me)) throw err('no_map', 'Ese mapa ya no está.'); return mp; }
  mapView(mp, mm) {
    const dm = mm.role === 'dm';
    const secret = new Set(mp.layers.filter((l) => l.dm).map((l) => l.id));
    return { id: mp.id, name: mp.name, cols: mp.cols, rows: mp.rows, grid: mp.grid, by: mp.by, created: mp.created, updated: mp.updated, hidden: !!mp.hidden, bg: mp.bg || null, fog: fogOut(mp),
      layers: dm ? mp.layers : mp.layers.filter((l) => !l.dm), strokes: dm ? mp.strokes : mp.strokes.filter((k) => !secret.has(k.l)), tokens: dm ? mp.tokens : mp.tokens.filter((t) => !t.hidden) };
  }
  sendMap(c, mp, out, filter) { for (const mm of c.members.values()) if (this.canSeeMap(c, mp, mm) && (!filter || filter(mm))) out.push({ to: mm.id, msg: { t: 'map', map: this.mapView(mp, mm) } }); }
  sendTok(c, mp, t, out, wasHidden) {
    for (const mm of c.members.values()) {
      if (!this.canSeeMap(c, mp, mm)) continue;
      if (mm.role === 'dm' || !t.hidden) out.push({ to: mm.id, msg: { t: 'tok', id: mp.id, tok: t, updated: mp.updated } });
      else if (!wasHidden) out.push({ to: mm.id, msg: { t: 'tok.del', id: mp.id, tid: t.id } });
    }
  }
  sendBeast(c, b, out) { for (const mm of c.members.values()) if (mm.role === 'dm' || !b.hidden) out.push({ to: mm.id, msg: { t: 'beast', beast: b } }); }

  /* Lo que recibe cada quien al entrar: el chat que puede ver y la pizarra */
  mesaInit(c, forId) { return { t: 'mesa.init', chat: c.chat.filter((m) => visible(m, forId)).slice(-500), strokes: c.strokes, pages: c.pages.length }; }
  /* Lo de la sesión que terminó, para guardarlo en el diario de cada quien */
  snapshot(c, forId) {
    const from = c.session.started || 0;
    return { code: c.code, campaign: c.name, n: c.session.n, title: c.session.title, started: c.session.started, ended: c.session.ended || this.now(), chat: c.chat.filter((m) => visible(m, forId) && m.ses === c.session.n), board: c.board, pages: c.pages.filter((p) => p.at >= from),
      members: [...c.members.values()].map((m) => ({ id: m.id, name: m.role === 'dm' ? 'DM' : (m.char && m.char.name) || m.name, role: m.role })) };
  }
  /* Las imágenes van al almacén; aquí solo se anotan */
  checkImage(c, who, size, type) {
    const me = this.member(c, who);
    if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) throw err('bad_img', 'Solo imágenes JPG, PNG, WebP o GIF.');
    if (size > IMG_MAX_BYTES) throw err('too_large', 'La imagen es demasiado grande.');
    if (c.imgBytes + size > CAMP_IMG_BYTES) throw err('too_many', 'La campaña ya tiene demasiadas imágenes.');
    return me;
  }
  noteImage(c, who, size, type) { const im = { id: 'i' + id(9), by: who, type, size, at: this.now() }; c.images.set(im.id, im); c.imgBytes += size; this.touch(c); return im; }

  nameOf(c, oid) { const m = c.members.get(oid); if (m) return m.char ? m.char.name : m.name; const n = c.npcs.get(oid); return n ? n.name : '?'; }

  /* Orden de iniciativa: mayor primero; empates por modificador de Destreza (initMod) */
  sortOrder(c) {
    const cur = c.order[c.turn];
    const list = [];
    for (const m of c.members.values()) if (m.role !== 'dm' && m.init != null) list.push({ id: m.id, init: m.init, mod: m.char ? m.char.initMod : 0 });
    for (const n of c.npcs.values()) if (n.init != null) list.push({ id: n.id, init: n.init, mod: 0 });
    list.sort((a, b) => b.init - a.init || b.mod - a.mod);
    c.order = list.map(x => x.id);
    c.turn = cur ? Math.max(0, c.order.indexOf(cur)) : c.turn >= 0 && c.order.length ? 0 : -1;
  }

  /* Lo que ve cada quien: los jugadores no ven PNJ ocultos, ni PG exactos de enemigos, ni mapas o criaturas en preparación */
  view(c, forId) {
    const me = c.members.get(forId), dm = !!me && me.role === 'dm';
    const members = [...c.members.values()].map(m => ({ id: m.id, role: m.role, name: m.name, online: m.conns > 0, seen: m.seen, init: m.init, char: m.char && (dm || m.id === forId || !c.hidePc ? m.char : { ...m.char, hp: null, temp: null }) }));
    const npcs = [...c.npcs.values()].filter(n => dm || !n.hidden).map(n => dm ? n : npcForPlayers(n, c.npcHp));
    const maps = [...c.maps.values()].filter((mp) => dm || !mp.hidden).map((mp) => ({ id: mp.id, name: mp.name, cols: mp.cols, rows: mp.rows, grid: mp.grid, n: mp.strokes.length, tokens: mp.tokens.length, by: mp.by, updated: mp.updated, hidden: !!mp.hidden, bg: !!mp.bg }));
    const beasts = c.beasts.filter((b) => dm || !b.hidden).map((b) => ({ id: b.id, name: b.name, kind: b.kind, img: b.img, info: b.info, hasStat: !!b.stat, ref: dm ? b.ref : undefined, hidden: !!b.hidden, auto: !!b.auto, seen: b.seen, ses: b.ses, notes: b.notes.length }));
    return { code: c.code, name: c.name, you: forId, role: me ? me.role : null, live: c.live, session: c.session, members, npcs, npcHp: c.npcHp, maps, scene: c.scene && (dm || !c.maps.get(c.scene)?.hidden) ? c.scene : null, board: c.board, pages: c.pages.length,
      beasts, autoBeasts: c.autoBeasts, order: c.order.filter(x => dm || !c.npcs.get(x)?.hidden), turnId: c.order[c.turn] || null, round: c.round, hidePc: c.hidePc, log: c.log.slice(-25) };
  }
  /* Lo que se ve de una campaña en el selector, sin entrar */
  peek(c) { return { code: c.code, name: c.name, live: c.live, session: c.session.n, title: c.session.title, online: this.online(c), players: [...c.members.values()].filter((m) => m.role === 'player').length }; }
}

/* Lo que ven los jugadores de un enemigo según lo que eligió el DM */
function npcForPlayers(n, mode) {
  const o = { id: n.id, name: n.name, init: n.init, conds: n.conds, show: mode };
  if (mode === 'state') o.state = hpState(n);
  else if (mode === 'bar' || mode === 'pct') { o.pct = n.hp <= 0 ? 0 : Math.max(1, Math.round(n.hp / n.hpMax * 100)); o.state = n.hp <= 0 ? 'caído' : null; }
  else if (mode === 'num') { o.hp = n.hp; o.hpMax = n.hpMax; o.temp = n.temp; o.state = n.hp <= 0 ? 'caído' : null; }
  return o;
}
function layerDm(mp, lid) { const l = mp.layers.find((x) => x.id === lid); return !!(l && l.dm); }
function cleanLayers(ls, isDm) {
  const out = [], seen = new Set();
  for (const l of ls.slice(0, MAP_LAYERS_MAX)) { const lid = str(l && l.id, 12); if (!/^[\w-]{1,12}$/.test(lid) || seen.has(lid)) continue; seen.add(lid); const o = { id: lid, name: str(l.name, 30) || 'Capa' }; if (isDm && l.dm) o.dm = true; out.push(o); }
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
function cleanToken(t, mp, c, me) {
  if (!t || typeof t !== 'object') throw err('bad_msg', 'Ficha inválida.');
  const kind = TOKEN_KINDS.includes(t.kind) ? t.kind : 'obj';
  const o = { id: 't' + id(5), x: num(t.x, 0, mp.cols - 1, 0), y: num(t.y, 0, mp.rows - 1, 0), s: int(t.s, 1, 6, 1), name: str(t.name, 40) || 'Ficha', color: COLOR_RE.test(t.color) ? t.color : '#8c2626', img: null, kind, ref: null, by: me.id, hidden: !!t.hidden };
  if (t.img && c.images.has(str(t.img, 30))) o.img = str(t.img, 30);
  if (kind === 'pc') { o.ref = me.role === 'dm' && t.ref && c.members.has(str(t.ref, 20)) ? str(t.ref, 20) : me.role === 'dm' ? null : me.id; if (t.comp) o.comp = 1; }
  if (kind === 'npc' && t.ref && c.npcs.has(str(t.ref, 20))) o.ref = str(t.ref, 20);
  return o;
}
function cleanMap(m, by, isDm, c) {
  if (!m || typeof m !== 'object') return null;
  const mid = str(m.id, 24); if (!/^[\w-]{4,24}$/.test(mid)) return null;
  const mp = { id: mid, name: str(m.name, 60) || 'Mapa', cols: int(m.cols, 8, 160, 40), rows: int(m.rows, 8, 160, 30), grid: ['square', 'hex', 'none'].includes(m.grid) ? m.grid : 'square', by: str(m.by, 20) || str(by, 20), created: Number(m.created) || Date.now(), hidden: isDm ? !!m.hidden : false };
  if (!c.members.has(mp.by)) mp.by = str(by, 20);
  mp.layers = cleanLayers(Array.isArray(m.layers) ? m.layers : [], isDm); if (!mp.layers.length) mp.layers = [{ id: 'l1', name: 'Terreno' }];
  mp.strokes = (Array.isArray(m.strokes) ? m.strokes : []).slice(0, MAP_STROKES_MAX).map((k) => { const s = cleanMapStroke(k, k && k.by || by, mp); if (s && k.id) s.id = str(k.id, 20); return s; }).filter(Boolean);
  for (const k of mp.strokes) if (!k.id) k.id = 'k' + id(5);
  mp.bg = isDm && m.bg && m.bg.img && c.images.has(str(m.bg.img, 30)) ? { img: str(m.bg.img, 30), op: num(m.bg.op, 0.1, 1, 1) } : null;
  mp.fog = { on: isDm ? !!(m.fog && m.fog.on) : false, cells: null };
  if (isDm && m.fog && typeof m.fog.cells === 'string') { const b = Buffer.from(m.fog.cells, 'base64'); if (b.length === Math.ceil(mp.cols * mp.rows / 8)) mp.fog.cells = b; }
  if (!mp.fog.cells) mp.fog.cells = fogNew(mp, false);
  const me = c.members.get(by) || { id: by, role: isDm ? 'dm' : 'player' };
  mp.tokens = isDm && Array.isArray(m.tokens) ? m.tokens.slice(0, TOKENS_MAX).map((t) => { try { const o = cleanToken(t, mp, c, me); if (t.id && /^[\w-]{2,20}$/.test(t.id)) o.id = t.id; if (t.by && c.members.has(t.by)) o.by = t.by; if (t.kind === 'pc' && t.ref && c.members.has(t.ref)) o.ref = t.ref; return o; } catch { return null; } }).filter(Boolean) : [];
  return mp;
}
function cleanBeast(b, c) {
  if (!b || typeof b !== 'object') return null;
  const name = str(b.name, 60); if (!name) return null;
  const info = {}; const bi = b.info && typeof b.info === 'object' ? b.info : {};
  for (const k of ['type', 'cr', 'ac', 'hp', 'size', 'speed', 'where']) if (bi[k] != null && str(bi[k], 80)) info[k] = str(bi[k], 80);
  let stat = null;
  if (b.stat && typeof b.stat === 'object') { const s = JSON.stringify(b.stat); if (s.length <= STAT_MAX) stat = JSON.parse(s); else throw err('too_large', 'Esa ficha es demasiado grande para compartirla.'); }
  return { name, kind: BEAST_KINDS.includes(b.kind) ? b.kind : 'enemigo', ref: b.ref ? str(b.ref, 120) : null, img: b.img && c.images.has(str(b.img, 30)) ? str(b.img, 30) : null, text: txt(b.text, 2000), info, stat, hidden: !!b.hidden };
}

/* Un susurro solo lo ven quien lo manda y quien lo recibe */
function visible(m, forId) { return !m.to || m.to === forId || m.from === forId; }
function cleanBoard(b) {
  if (!b) return null; const title = str(b.title, 80); if (!title) return null;
  return { id: b.id ? str(b.id, 20) : undefined, at: Number(b.at) || undefined, cat: BOARD_CATS.includes(b.cat) ? b.cat : 'otro', title, text: txt(b.text, 1500), img: b.img ? str(b.img, 30) : null, done: !!b.done };
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

export function err(code, message) { const e = new Error(message); e.code = code; return e; }
