#!/usr/bin/env node
// Arma web/dist/index.html: un solo archivo con estilos, iconos y scripts.
//   node tools/build-web.mjs            → página completa (para el servidor o GitHub Pages)
//   node tools/build-web.mjs --artifact → fragmento para publicar como artefacto de claude.ai
// Variable opcional SALA_URL=wss://tu-servidor/ws para fijar el servidor de salas en la compilación.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'web');
const artifact = process.argv.includes('--artifact');
const read = (p) => readFileSync(join(root, p), 'utf8');

const css = readdirSync(join(root, 'styles')).filter(f => f.endsWith('.css')).sort().map(f => read('styles/' + f)).join('\n');
const icons = read('assets/icons.svg');
const body = read('body.html');
const order = ['lib.js', 'render.js', 'rules.js', 'app.js', 'sala.js', 'mesa.js'];
const js = order.map(f => `/* ---- ${f} ---- */\n` + read('src/' + f)).join('\n');
const config = `window.DIARIO_CONFIG = ${JSON.stringify({ salaUrl: process.env.SALA_URL || '', artifact, version: process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 7) : 'dev' })};`;
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;600&family=Cinzel:wght@400;600;700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap">';

const inner = `<title>Diario del Aventurero</title>\n${fonts}\n<style>${css}</style>\n${icons}\n${body}\n<script>${config}\n${js}\n</script>\n`;
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
