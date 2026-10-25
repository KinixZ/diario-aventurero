#!/usr/bin/env node
// Crea "diario-5e.json": un solo archivo con los datos de tu copia de 5etools
// que usa el Diario del Aventurero (conjuros, objetos, reglas, dotes, especies,
// trasfondos, clases y criaturas compañeras: homúnculos, defensores, familiares e invocaciones). Así lo puedes cargar en el teléfono con un solo archivo.
//
// Uso:
//   node crear-paquete-diario.mjs <carpeta data de 5etools> [archivo de salida]
// Ejemplo:
//   node crear-paquete-diario.mjs ./5etools-src/data ./diario-5e.json

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const dataDir = process.argv[2];
const outFile = process.argv[3] || 'diario-5e.json';

if (!dataDir || !existsSync(dataDir) || !statSync(dataDir).isDirectory()) {
  console.error('Indica la carpeta "data" de tu copia de 5etools.');
  console.error('Ejemplo: node crear-paquete-diario.mjs ./5etools-src/data');
  process.exit(1);
}

// Las mismas claves que el diario sabe leer.
const KEYS = ['spell', 'item', 'baseitem', 'itemProperty', 'itemMastery', 'itemType',
  'condition', 'status', 'disease', 'action', 'variantrule', 'feat', 'skill', 'sense',
  'race', 'subrace', 'background', 'class', 'subclass', 'classFeature', 'subclassFeature',
  'optionalfeature', 'language', 'monster'];

// Del bestiario solo se guardan las criaturas que acompañan a un personaje.
const keepMonster = m => !!(m && m.name && (m.summonedByClass || m.summonedBySpell || m.familiar));

const files = [
  'feats.json', 'items.json', 'items-base.json', 'conditionsdiseases.json', 'actions.json',
  'variantrules.json', 'skills.json', 'senses.json', 'races.json', 'backgrounds.json',
  'optionalfeatures.json', 'languages.json'
].map(f => join(dataDir, f));

const listDir = (sub, re) => {
  const dir = join(dataDir, sub);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => re.test(f)).map(f => join(dir, f));
};
files.push(...listDir('spells', /^spells-.*\.json$/));
files.push(...listDir('class', /^class-.*\.json$/));
files.push(...listDir('bestiary', /^bestiary-.*\.json$/));

const out = { _diario: 1, creado: new Date().toISOString(), spellLookup: {} };
for (const k of KEYS) out[k] = [];

let read = 0;
for (const file of files) {
  if (!existsSync(file)) { console.warn('No encontré', basename(file), '(se omite)'); continue; }
  const json = JSON.parse(readFileSync(file, 'utf8'));
  for (const k of KEYS) if (Array.isArray(json[k])) out[k].push(...(k === 'monster' ? json[k].filter(keepMonster) : json[k]));
  read++;
}

const lookup = join(dataDir, 'generated', 'gendata-spell-source-lookup.json');
if (existsSync(lookup)) { out.spellLookup = JSON.parse(readFileSync(lookup, 'utf8')); read++; }
else console.warn('No encontré generated/gendata-spell-source-lookup.json: los conjuros no dirán qué clases los tienen.');

writeFileSync(outFile, JSON.stringify(out));
const mb = (statSync(outFile).size / 1048576).toFixed(1);
console.log(`Listo: ${outFile} (${mb} MB) a partir de ${read} archivos.`);
for (const k of KEYS) if (out[k].length) console.log(`  ${k}: ${out[k].length}`);
