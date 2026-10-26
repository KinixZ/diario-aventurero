#!/usr/bin/env node
// Crea el bestiario del DM (bestiario-5e.json) desde tu copia de 5etools.
//   npm run bestiario -- <carpeta data de 5etools> [salida.json]
//   npm run bestiario -- ./5etools-src/data ./bestiario-5e.json
// Junta todos los data/bestiary/bestiary-*.json, resuelve las copias (_copy con sus _mod)
// y deja solo lo que se usa en la mesa: números, rasgos, acciones y conjuros.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dataDir = resolve(process.argv[2] || './5etools-src/data');
const outFile = resolve(process.argv[3] || './bestiario-5e.json');
const dir = existsSync(join(dataDir, 'bestiary')) ? join(dataDir, 'bestiary') : dataDir;
if (!existsSync(dir) || !statSync(dir).isDirectory()) { console.error('No encuentro la carpeta ' + dir + '. Pasa la carpeta "data" de 5etools.'); process.exit(1); }
const files = readdirSync(dir).filter((f) => /^bestiary-.+\.json$/.test(f)).sort();
if (!files.length) { console.error('No hay archivos bestiary-*.json en ' + dir); process.exit(1); }

const KEEP = ['name', 'source', 'page', 'size', 'type', 'alignment', 'alignmentPrefix', 'ac', 'hp', 'speed', 'initiative', 'str', 'dex', 'con', 'int', 'wis', 'cha', 'save', 'skill', 'senses', 'passive',
  'resist', 'immune', 'vulnerable', 'conditionImmune', 'languages', 'cr', 'pbNote', 'trait', 'spellcasting', 'action', 'bonus', 'reaction', 'reactionHeader', 'legendary', 'legendaryHeader', 'legendaryActions',
  'legendaryActionsLair', 'mythic', 'mythicHeader', 'legendaryGroup', 'shortName', 'alias', 'isNpc', 'isNamedCreature', 'environment', 'group'];
const ENTRY_PROPS = ['trait', 'action', 'bonus', 'reaction', 'legendary', 'mythic', 'spellcasting', 'variant'];

const all = [];
for (const f of files) { const j = JSON.parse(readFileSync(join(dir, f), 'utf8')); for (const m of j.monster || []) all.push(m); }
const key = (n, s) => String(n).toLowerCase() + '|' + String(s).toLowerCase();
const byKey = new Map(all.map((m) => [key(m.name, m.source), m]));

/* ---------- _copy y _mod (lo que usa 5etools en el bestiario) ---------- */
const clone = (x) => JSON.parse(JSON.stringify(x));
function replaceTxtDeep(x, re, w) {
  if (typeof x === 'string') return x.replace(re, w);
  if (Array.isArray(x)) return x.map((y) => replaceTxtDeep(y, re, w));
  if (x && typeof x === 'object') { const o = {}; for (const k in x) o[k] = k === 'type' || k === 'name' && false ? x[k] : replaceTxtDeep(x[k], re, w); return o; }
  return x;
}
const nameOf = (it) => (it && typeof it === 'object' ? it.name : it);
function applyMod(m, prop, mod) {
  const mode = typeof mod === 'string' ? mod : mod.mode, items = mod.items == null ? [] : [].concat(mod.items);
  const arr = () => (m[prop] = Array.isArray(m[prop]) ? m[prop] : []);
  switch (mode) {
    case 'replaceTxt': {
      const re = new RegExp(mod.replace, 'g' + (mod.flags || '').replace('g', '')), props = prop === '*' ? (mod.props || ENTRY_PROPS) : [prop];
      for (const p of props) if (m[p]) m[p] = replaceTxtDeep(m[p], re, mod.with ?? '');
      break;
    }
    case 'appendArr': arr().push(...items); break;
    case 'prependArr': arr().unshift(...items); break;
    case 'appendIfNotExistsArr': for (const it of items) if (!arr().some((x) => JSON.stringify(x) === JSON.stringify(it))) m[prop].push(it); break;
    case 'insertArr': arr().splice(mod.index ?? 0, 0, ...items); break;
    case 'replaceArr': {
      const a = arr(), r = mod.replace; let i = -1;
      if (r && typeof r === 'object' && r.index != null) i = r.index;
      else i = a.findIndex((x) => nameOf(x) === (r && r.regex ? undefined : r) || (r && r.regex && new RegExp(r.regex, r.flags || '').test(nameOf(x) || '')));
      if (i >= 0) a.splice(i, 1, ...items);
      break;
    }
    case 'removeArr': {
      const names = [].concat(mod.names || []), its = [].concat(mod.items || []);
      if (Array.isArray(m[prop])) m[prop] = m[prop].filter((x) => !names.includes(nameOf(x)) && !its.some((y) => JSON.stringify(y) === JSON.stringify(x)));
      break;
    }
    case 'remove': if (mod.prop) delete m[mod.prop]; else if (mod.props) for (const p of mod.props) delete m[p]; else delete m[prop]; break;
    case 'setProp': { const path = String(mod.prop || '').split('.'); let o = m; while (path.length > 1) { const k = path.shift(); o = o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}; } o[path[0]] = mod.value; break; }
    case 'addSkills': { m.skill = m.skill || {}; for (const k in mod.skills || {}) { const pb = Math.max(2, Math.floor(((parseCr(m.cr) || 0) - 1) / 4) + 2), ab = SKILL_AB[k] || 'wis', base = Math.floor(((m[ab] || 10) - 10) / 2); m.skill[k] = '+' + (base + pb * (mod.skills[k] === 2 ? 2 : 1)); } break; }
    case 'addSpells': case 'replaceSpells': case 'removeSpells': {
      const sc = m.spellcasting && m.spellcasting[0]; if (!sc) break;
      const edit = (grp, fn) => { for (const k in grp || {}) fn(k, grp[k]); };
      if (mode === 'addSpells') {
        edit(mod.spells, (lv, v) => { sc.spells = sc.spells || {}; const t = sc.spells[lv] = sc.spells[lv] || { spells: [] }; t.spells.push(...(v.spells || [])); });
        if (mod.will) sc.will = (sc.will || []).concat(mod.will);
        edit(mod.daily, (k, v) => { sc.daily = sc.daily || {}; sc.daily[k] = (sc.daily[k] || []).concat(v); });
      } else if (mode === 'replaceSpells') {
        edit(mod.spells, (lv, reps) => { const t = sc.spells && sc.spells[lv]; if (!t) return; for (const rp of reps) { const i = t.spells.indexOf(rp.replace); if (i >= 0) t.spells.splice(i, 1, ...rp.with); } });
        edit(mod.daily, (k, reps) => { const t = sc.daily && sc.daily[k]; if (!t) return; for (const rp of reps) { const i = t.indexOf(rp.replace); if (i >= 0) t.splice(i, 1, ...rp.with); } });
      } else {
        edit(mod.spells, (lv, names) => { const t = sc.spells && sc.spells[lv]; if (t) t.spells = t.spells.filter((s) => !names.includes(s)); });
        edit(mod.daily, (k, names) => { if (sc.daily && sc.daily[k]) sc.daily[k] = sc.daily[k].filter((s) => !names.includes(s)); });
      }
      break;
    }
    default: break;
  }
}
const SKILL_AB = { athletics: 'str', acrobatics: 'dex', 'sleight of hand': 'dex', stealth: 'dex', arcana: 'int', history: 'int', investigation: 'int', nature: 'int', religion: 'int', 'animal handling': 'wis', insight: 'wis', medicine: 'wis', perception: 'wis', survival: 'wis', deception: 'cha', intimidation: 'cha', performance: 'cha', persuasion: 'cha' };
function parseCr(cr) { const c = typeof cr === 'object' && cr ? cr.cr : cr; if (c == null) return null; if (String(c).includes('/')) { const [a, b] = String(c).split('/'); return +a / +b; } return +c; }

const done = new Map();
function resolveMon(m, depth = 0) {
  const k = key(m.name, m.source);
  if (done.has(k)) return done.get(k);
  if (!m._copy || depth > 8) { done.set(k, m); return m; }
  const baseRaw = byKey.get(key(m._copy.name, m._copy.source));
  if (!baseRaw) { const o = { ...m }; delete o._copy; done.set(k, o); return o; }
  const base = clone(resolveMon(baseRaw, depth + 1));
  const out = { ...base, ...clone(m) };
  delete out._copy;
  for (const p of ['_versions', 'reprintedAs', 'srd', 'srd52', 'basicRules', 'basicRules2024', 'otherSources', 'referenceSources']) if (!(p in m)) delete out[p];
  const mods = m._copy._mod || {};
  for (const prop in mods) for (const mod of [].concat(mods[prop])) { try { applyMod(out, prop === '_' ? prop : prop, mod); } catch (e) { /* un _mod raro no detiene el resto */ } }
  done.set(k, out);
  return out;
}

const out = [];
let skipped = 0;
for (const m of all) {
  const r = resolveMon(m);
  if (!r.hp || !r.ac || r.cr == null && !r.summonedBySpell && !r.summonedByClass) { skipped++; continue; } // plantillas y criaturas sin números
  const s = {};
  for (const k of KEEP) if (r[k] != null) s[k] = r[k];
  if (r.reprintedAs) s.rep = 1; // hay una versión más nueva (por ejemplo 2014 → 2024)
  if (s.legendaryGroup) s.legendaryGroup = { name: s.legendaryGroup.name, source: s.legendaryGroup.source };
  out.push(s);
}
out.sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source));

/* Acciones de guarida y efectos regionales (legendarygroups.json), solo las que se usan */
let groups = [];
const lgFile = join(dataDir, 'bestiary', 'legendarygroups.json');
if (existsSync(lgFile)) {
  const used = new Set(out.filter((m) => m.legendaryGroup).map((m) => key(m.legendaryGroup.name, m.legendaryGroup.source)));
  groups = (JSON.parse(readFileSync(lgFile, 'utf8')).legendaryGroup || []).filter((g) => used.has(key(g.name, g.source))).map((g) => ({ name: g.name, source: g.source, lairActions: g.lairActions, regionalEffects: g.regionalEffects }));
}

const json = JSON.stringify({ _bestiario: { v: 1, creado: new Date().toISOString(), monstruos: out.length, archivos: files.length }, monster: out, legendaryGroup: groups });
writeFileSync(outFile, json);
const libros = new Set(out.map((m) => m.source)).size;
console.log(`Listo: ${outFile}\n${out.length} criaturas de ${libros} libros (${files.length} archivos), ${groups.length} guaridas, ${(json.length / 1048576).toFixed(1)} MB.` + (skipped ? ` Se saltaron ${skipped} plantillas sin números.` : ''));
console.log('En el diario: Ajustes → Bestiario del DM → Elegir archivo.');
