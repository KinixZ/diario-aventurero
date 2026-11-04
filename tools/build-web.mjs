#!/usr/bin/env node
// Arma web/dist/index.html: un solo archivo con estilos, iconos y scripts.
//   node tools/build-web.mjs            → página completa (para el servidor o GitHub Pages)
//   node tools/build-web.mjs --artifact → fragmento para publicar como artefacto de claude.ai
// Variable opcional SALA_URL=wss://tu-servidor/ws para fijar el servidor de salas en la compilación.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildSync, transformSync } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'web');
const artifact = process.argv.includes('--artifact');
const read = (p) => readFileSync(join(root, p), 'utf8');

let css = readdirSync(join(root, 'styles')).filter(f => f.endsWith('.css')).sort().map(f => read('styles/' + f)).join('\n');
const icons = read('assets/icons.svg');
const body = read('body.html');
const order = ['gfx.js', 'fx.js', 'sonido.js', 'dados.js', 'iconos.js', 'lib.js', 'render.js', 'hechizos.cjs', 'rules.js', 'app.js', 'sala.js', 'mesa.js', 'retratos.js', 'campana.js', 'bestiario.js', 'grupo.js', 'cronica.js', 'assets.js', 'editor.js', 'vision.cjs', 'tactica.cjs', 'clima.js', 'efectos.js', 'mapas.js', 'encuentros.js', 'acciones.js', 'vtt.js'];
const js = order.map(f => `/* ---- ${f} ---- */\n` + read('src/' + f)).join('\n');
// Motor del mapa (PixiJS): archivo aparte que se baja solo al abrir un mapa. El artefacto de claude.ai usa Canvas 2D.
const plain = process.argv.includes('--plain');
let glHash = '', diceHash = '';
if (!artifact) {
  const gl = buildSync({ entryPoints: [join(root, 'gl', 'mapa-gl.js')], bundle: true, format: 'iife', minify: !plain, target: 'es2020', write: false, legalComments: 'none', logLevel: 'warning' }).outputFiles[0].text;
  mkdirSync(join(root, 'dist'), { recursive: true });
  writeFileSync(join(root, 'dist', 'mapa-gl.js'), gl);
  glHash = createHash('sha1').update(gl).digest('hex').slice(0, 10);
  console.log(`Motor del mapa: mapa-gl.js (${(gl.length / 1024).toFixed(0)} KB)`);
  // Dados 3D (three.js): otro archivo aparte, solo para quien los usa
  const dice = buildSync({ entryPoints: [join(root, 'gl', 'dados3d.js')], bundle: true, format: 'iife', minify: !plain, target: 'es2020', write: false, legalComments: 'none', logLevel: 'warning' }).outputFiles[0].text;
  writeFileSync(join(root, 'dist', 'dados3d.js'), dice);
  diceHash = createHash('sha1').update(dice).digest('hex').slice(0, 10);
  console.log(`Dados 3D: dados3d.js (${(dice.length / 1024).toFixed(0)} KB)`);
}
// Iconos de juego (game-icons.net, CC BY 3.0): solo los que lista web/src/iconos.js, en un archivo aparte.
// En el artefacto van dentro de la página (window.DIARIO_ICONS) porque no hay archivos aparte.
let iconsHash = '', iconsInline = '';
{
  const src = readFileSync(join(root, 'src', 'iconos.js'), 'utf8');
  const list = JSON.parse(src.match(/var GI = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"'));
  const gi = JSON.parse(readFileSync(join(root, '..', 'node_modules', '@iconify-json', 'game-icons', 'icons.json'), 'utf8'));
  const miss = list.filter((n) => !gi.icons[n]);
  if (miss.length) throw new Error('Iconos que no existen en game-icons: ' + miss.join(', '));
  const sprite = '<svg xmlns="http://www.w3.org/2000/svg">' + [...new Set(list)].map((n) => `<symbol id="gi-${n}" viewBox="0 0 ${gi.width || 512} ${gi.height || 512}">${gi.icons[n].body}</symbol>`).join('') + '</svg>';
  iconsHash = createHash('sha1').update(sprite).digest('hex').slice(0, 10);
  if (artifact) iconsInline = `window.DIARIO_ICONS = ${JSON.stringify(sprite)};`;
  else { mkdirSync(join(root, 'dist'), { recursive: true }); writeFileSync(join(root, 'dist', 'iconos.svg'), sprite); }
  console.log(`Iconos de juego: ${list.length} (${(sprite.length / 1024).toFixed(0)} KB)`);
}
const sha = process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA || '';
const config = `window.DIARIO_CONFIG = ${JSON.stringify({ salaUrl: process.env.SALA_URL || '', artifact, version: sha ? sha.slice(0, 7) : 'dev', gl: glHash, dice: diceHash, icons: iconsHash })};${iconsInline}`;
// Minificado: los scripts siguen siendo globales (sin "format"), así que Diario, Sala, Mapas… conservan su nombre.
const jsOut = plain ? js : transformSync(js, { minify: true, target: 'es2017', legalComments: 'none', charset: 'utf8' }).code;
// Fuentes propias (sin Google): se sirven desde el servidor, funcionan sin internet y se ven igual en todos los teléfonos.
// En el artefacto de claude.ai no hay archivos aparte, así que ahí se piden a Google Fonts como antes.
const FONTS = [
  ['Cinzel', 'cinzel', 'cinzel', [[400, 'normal'], [600, 'normal'], [700, 'normal']]],
  ['Cinzel Decorative', 'cinzel-decorative', 'cinzel-decorative', [[700, 'normal']]],
  ['EB Garamond', 'eb-garamond', 'eb-garamond', [[400, 'normal'], [500, 'normal'], [600, 'normal'], [400, 'italic']]],
  ['Caveat', 'caveat', 'caveat', [[500, 'normal'], [600, 'normal']]],
];
const nm = join(root, '..', 'node_modules', '@fontsource');
let fontCss = '';
const fonts = artifact
  ? '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;600&family=Cinzel:wght@400;600;700&family=Cinzel+Decorative:wght@700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap">'
  : '<link rel="preload" href="fonts/cinzel-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>\n<link rel="preload" href="fonts/eb-garamond-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>';
if (!artifact) {
  mkdirSync(join(root, 'dist', 'fonts'), { recursive: true });
  for (const [family, pkg, file, variants] of FONTS) for (const [w, st] of variants) {
    const f = `${file}-latin-${w}-${st}.woff2`;
    cpSync(join(nm, pkg, 'files', f), join(root, 'dist', 'fonts', f));
    fontCss += `@font-face{font-family:'${family}';font-style:${st};font-weight:${w};font-display:swap;src:url(fonts/${f}) format('woff2')}\n`;
  }
}

css = fontCss + css;
const cssOut = plain ? css : transformSync(css, { loader: 'css', minify: true, charset: 'utf8' }).code;
const inner = `<title>Diario del Aventurero</title>\n${fonts}\n<style>${cssOut}</style>\n${icons}\n${body}\n<script>${config}\n${jsOut}\n</script>\n`;
const page = artifact ? inner : `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#24130f">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Diario">
<meta name="description" content="Hoja de personaje de D&D con forma de diario, creador nivel por nivel desde 5etools y salas de combate para todo el grupo.">
<style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0}</style>
</head>
<body>
${inner}<script>if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) addEventListener('load', function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); });</script>
</body>
</html>
`;
mkdirSync(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist', artifact ? 'diario-artefacto.html' : 'index.html');
if (!artifact && existsSync(join(root, 'public'))) cpSync(join(root, 'public'), join(root, 'dist'), { recursive: true });
writeFileSync(out, page);
writeFileSync(join(root, 'dist', 'all.js'), js);
console.log(`Listo: ${out} (${(page.length / 1024).toFixed(0)} KB)`);
