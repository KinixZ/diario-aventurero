#!/usr/bin/env node
// Escribe docs/HECHIZOS.md: cuántos conjuros resuelve solos la app (con su área, salvación, daño, estados, zona y
// concentración) y la lista de los asistidos, agrupados por lo que falta hacer a mano.
//   node tools/hechizos.mjs [paquete-5e.json]     (por defecto el paquete del Diario en DIARIO_PAQUETE)
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const Hechizos = createRequire(import.meta.url)('../web/src/hechizos.cjs');
const file = process.argv[2] || process.env.DIARIO_PAQUETE;
if (!file) { console.error('Falta el paquete: node tools/hechizos.mjs ruta/al/diario-5e.json'); process.exit(1); }
const data = JSON.parse(readFileSync(file, 'utf8')), spells = data.spell || [];
const S = Hechizos.survey(spells);
const by2024 = (d) => /\|XPHB$/.test(d.ref);
const AREA = Hechizos.AREA_ES;
const line = (d) => `${d.name} (${d.ref.split('|')[1]}, ${d.lv ? 'nivel ' + d.lv : 'truco'})`;
let md = `# Hechizos: lo que resuelve la app

Cada conjuro de 5etools (2014 y 2024) lleva su **definición de efecto**, que sale de sus datos (\`web/src/hechizos.cjs\`)
más unas pocas correcciones a mano: el área (esfera, cilindro, cubo, cono, línea, emanación o muro y su tamaño), si sale de
ti, el alcance, la tirada de ataque o la salvación (y si hace la mitad al superarla), los dados de daño o curación, los
estados que impone, si la salvación se repite al final de cada turno, la concentración y si deja una **zona en el mapa**
(que daña al entrar, al empezar o al terminar el turno, que es terreno difícil, que tapa la vista, que se mueve o que sigue
a quien lo lanza).

En el combate la app propone y el jugador o el DM confirman: apuntar el área en el mapa elige a los que toca, los dados los
tira el servidor, cada objetivo tira su salvación (con su cobertura) y se aplica el daño y los estados.

Este archivo lo escribe \`npm run hechizos -- paquete.json\` (o \`node tools/hechizos.mjs paquete.json\`).

## Resumen

| | Conjuros |
|---|---|
| En el paquete | ${S.total} |
| Automáticos (la app los resuelve enteros) | ${S.auto} |
| Asistidos (algo se hace a mano) | ${S.asistidos} |
| Con área | ${S.areas} |
| Dejan una zona en el mapa | ${S.zones} |
| De 2024 (XPHB) | ${S.all.filter(by2024).length} (${S.all.filter((d) => by2024(d) && d.auto === 'auto').length} automáticos) |

Áreas por forma: ${Object.entries(S.all.reduce((o, d) => { if (d.area) o[d.area.t] = (o[d.area.t] || 0) + 1; return o; }, {})).map(([k, n]) => `${AREA[k] || k} ${n}`).join(', ')}.

## Asistidos

Un conjuro puede estar en más de un grupo. «Efecto sin tirada» son los de utilidad o los que cambian números de otras
tiradas: se publican como acción (con su texto) y lo demás se aplica a mano.
`;
const order = ['summon', 'tp', 'wall', 'area', 'perMove', 'choose', 'shape', 'dice', 'reaction', 'effect'];
for (const k of order.concat(Object.keys(S.byWhy).filter((x) => !order.includes(x)))) {
  const list = S.byWhy[k]; if (!list || !list.length) continue;
  md += `\n### ${Hechizos.whyText(k).replace(/^./, (c) => c.toUpperCase())} (${list.length})\n\n`;
  md += list.slice().sort((a, b) => a.name.localeCompare(b.name) || a.ref.localeCompare(b.ref)).map((d) => '- ' + line(d)).join('\n') + '\n';
}
md += `\n## Zonas que se quedan en el mapa\n\n` + S.all.filter((d) => d.zone).sort((a, b) => a.name.localeCompare(b.name)).map((d) => `- ${line(d)}: ${[d.zone.on.length ? 'actúa al ' + d.zone.on.map((x) => ({ enter: 'entrar', end: 'terminar el turno', start: 'empezar el turno' })[x]).join(', ') : '', d.zone.terrain ? 'terreno difícil' : '', d.zone.obscure ? 'tapa la vista' : '', d.zone.follow ? 'te sigue' : '', d.zone.move ? 'se mueve' : '', d.conc ? 'concentración' : ''].filter(Boolean).join(' · ')}`).join('\n') + '\n';
writeFileSync(join(root, 'docs', 'HECHIZOS.md'), md);
console.log(`docs/HECHIZOS.md: ${S.total} conjuros, ${S.auto} automáticos, ${S.asistidos} asistidos, ${S.zones} con zona.`);
