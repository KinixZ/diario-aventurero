#!/usr/bin/env node
// Traducción fija al español de los datos de 5etools (sin IA al usar el diario).
//
//   node tools/traduccion.mjs extraer <datos.json> <carpeta>      saca los textos en inglés por partes (pendientes/NNN-seccion.tsv)
//   node tools/traduccion.mjs armar <carpeta> <salida.json>        junta las partes traducidas (hechos/NNN-seccion.tsv) en un archivo
//   node tools/traduccion.mjs estado <carpeta>                     cuánto falta
//
// Cada línea de un .tsv es:  id <TAB> texto. El id es un hash del texto en inglés, así que la traducción
// sirve aunque cambie la versión de 5etools: lo que no se encuentre se queda en inglés.
// Las etiquetas {@spell fireball|XPHB} se dejan tal cual; el diario traduce el nombre que muestran.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

/* El mismo hash que usa el diario (cyrb53) */
export function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/* Qué textos se traducen: nombres y todo lo que va dentro de entries (párrafos, listas, tablas) */
const TOP = ['name', 'entries', 'entriesHigherLevel', 'additionalEntries', 'headerEntries', 'footerEntries', 'trait', 'action', 'bonus', 'reaction', 'legendary', 'mythic', 'spellcasting', 'legendaryHeader', 'reactionHeader', 'mythicHeader', 'lairActions', 'regionalEffects'];
const IN = new Set(['name', 'entry', 'entries', 'items', 'caption', 'colLabels', 'rows', 'text', 'title', 'headerEntries', 'footerEntries', 'will', 'spells', 'daily']);
const NOT = new Set(['type', 'source', 'page', 'style', 'href', 'hash', 'path', 'url', 'id', 'width', 'height', 'imageType', 'roll', 'min', 'max', 'exact', 'pad', 'ability', 'attributes', 'dataCreature']);
function skipText(s) { return s.length < 3 || /^[\s\d+\-–—/×x.,:%()dD]+$/.test(s) || /^\{@\w+ [^{}]*\}$/.test(s) && !/\{@(b|i|bold|italic|note)\b/.test(s); }
function collect(obj, out) {
  const add = (s) => { if (typeof s === 'string' && !skipText(s)) out.push(s); };
  const walk = (v, k) => {
    if (typeof v === 'string') { if (!NOT.has(k)) add(v); return; }
    if (Array.isArray(v)) { v.forEach((x) => walk(x, k)); return; }
    if (v && typeof v === 'object') for (const kk of Object.keys(v)) { if (kk[0] === '_' || NOT.has(kk)) continue; if (IN.has(kk) || /^\d+[a-z]*$/.test(kk) || k === 'daily' || k === 'spells') walk(v[kk], kk); }
  };
  for (const k of TOP) if (obj[k] != null) { if (k === 'name') add(obj.name); else walk(obj[k], k); }
  if (obj.components && typeof obj.components.m === 'string') add(obj.components.m);
  if (obj.components && obj.components.m && typeof obj.components.m.text === 'string') add(obj.components.m.text);
}

/* Orden de trabajo: primero lo que más se ve en la mesa */
const SECTIONS = [
  ['basico', ['condition', 'status', 'action', 'skill', 'sense', 'itemProperty', 'itemMastery', 'itemType', 'language']],
  ['conjuros', ['spell']],
  ['clases', ['class', 'subclass', 'classFeature', 'subclassFeature', 'optionalfeature']],
  ['dotes', ['feat']],
  ['especies', ['race', 'subrace']],
  ['trasfondos', ['background']],
  ['equipo', ['baseitem', 'item']],
  ['reglas', ['variantrule', 'disease']],
  ['companeros', ['monster']],
  ['bestiario', ['monster', 'legendaryGroup']],
];
const CHUNK = 22000;

function extraer(file, dir) {
  const data = JSON.parse(readFileSync(file, 'utf8')), isBest = !!data._bestiario;
  const seen = new Set(), pend = join(dir, 'pendientes'); mkdirSync(pend, { recursive: true }); mkdirSync(join(dir, 'hechos'), { recursive: true });
  let n = 0, chars = 0, files = 0;
  const secs = isBest ? SECTIONS.filter((s) => s[0] === 'bestiario') : SECTIONS.filter((s) => s[0] !== 'bestiario');
  for (const [sec, keys] of secs) {
    const strs = [];
    for (const k of keys) for (const o of data[k] || []) { const out = []; collect(o, out); for (const s of out) { if (seen.has(s)) continue; seen.add(s); strs.push(s); } }
    let part = [], size = 0, idx = 0;
    const flush = () => { if (!part.length) return; idx++; files++; writeFileSync(join(pend, `${String(files).padStart(3, '0')}-${sec}-${idx}.tsv`), part.join('\n') + '\n'); part = []; size = 0; };
    for (const s of strs) { part.push(hash(s) + '\t' + s); size += s.length; n++; chars += s.length; if (size >= CHUNK) flush(); }
    flush();
  }
  console.log(`${n} textos únicos (${(chars / 1e6).toFixed(2)} M caracteres) en ${files} partes → ${pend}`);
}

function readTsv(f) { const m = new Map(); for (const line of readFileSync(f, 'utf8').split('\n')) { const i = line.indexOf('\t'); if (i > 0) m.set(line.slice(0, i), line.slice(i + 1)); } return m; }
function armar(dir, outFile, label) {
  const hechos = join(dir, 'hechos'), s = {};
  let n = 0, partes = 0;
  for (const f of readdirSync(hechos).filter((x) => x.endsWith('.tsv')).sort()) { partes++; for (const [id, es] of readTsv(join(hechos, f))) { if (es.trim()) { s[id] = es; n++; } } }
  writeFileSync(outFile, JSON.stringify({ _traduccion: { v: 1, idioma: 'es', de: label || basename(dir), creado: new Date().toISOString(), textos: n, partes }, s }));
  console.log(`Listo: ${outFile} con ${n} textos traducidos de ${partes} partes.`);
}
function estado(dir) {
  const p = readdirSync(join(dir, 'pendientes')).filter((x) => x.endsWith('.tsv')).sort(), h = new Set(existsSync(join(dir, 'hechos')) ? readdirSync(join(dir, 'hechos')) : []);
  let tot = 0, done = 0;
  for (const f of p) { const c = readFileSync(join(dir, 'pendientes', f), 'utf8').length; tot += c; if (h.has(f)) done += c; }
  console.log(`${p.filter((f) => h.has(f)).length} de ${p.length} partes (${Math.round(done / tot * 100)} %). Siguiente: ${p.find((f) => !h.has(f)) || 'ninguna'}`);
}

const [cmd, a, b, c] = process.argv.slice(2);
if (cmd === 'extraer') extraer(resolve(a), resolve(b));
else if (cmd === 'armar') armar(resolve(a), resolve(b), c);
else if (cmd === 'estado') estado(resolve(a));
else if (cmd) { console.log('Uso: extraer <datos.json> <carpeta> | armar <carpeta> <salida.json> | estado <carpeta>'); process.exit(1); }
