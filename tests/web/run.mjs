// Pruebas de la web con jsdom. Necesitan un paquete de 5etools (no se sube al repo):
//   DIARIO_PAQUETE=./diario-5e.json npm test
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)), html = join(here, '../../web/dist/index.html');
const pkg = process.env.DIARIO_PAQUETE || join(here, '../../diario-5e.json');
if (!existsSync(pkg)) { console.log('Sin paquete de 5etools: se saltan las pruebas de la web. Crea uno con "npm run paquete -- <carpeta data> diario-5e.json".'); process.exit(0); }
let bad = 0;
for (const t of ['smoke2.cjs', 'smoke3.cjs', 'smoke4.cjs', 'smoke5.cjs', 'import.cjs', 'chars.cjs', 'sala.e2e.cjs']) {
  const r = spawnSync(process.execPath, [join(here, t), html, pkg, '390'], { encoding: 'utf8', timeout: 240000 });
  const out = (r.stdout || '') + (r.stderr || ''), ok = /NO ERRORS/.test(out) && !/FAIL/.test(out);
  console.log((ok ? 'ok   ' : 'FALLA ') + t); if (!ok) { bad++; console.log(out.split('\n').slice(-25).join('\n')); }
}
process.exit(bad ? 1 : 0);
