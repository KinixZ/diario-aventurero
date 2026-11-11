// Identidad por clase y subclase: todas las subclases del paquete con la suya (a mano), el Oathbreaker del grupo con sus
// detalles, y el libro que reacciona a la vida, la CA y los estados (y lo que viaja en el resumen).
const fs = require('fs'); const { JSDOM } = require('jsdom'); require('fake-indexeddb/auto');
const html = fs.readFileSync(process.argv[2], 'utf8'), lib = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), errors = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
const pal = {id:'p', name:'Lyra', level:11, method:'array', base:{str:15,dex:10,con:14,int:8,wis:12,cha:13}, ch:{cls:'Paladin|XPHB', sub:'Oathbreaker|DMG', race:'Aasimar|XPHB', bg:'Soldier|XPHB', bgAbil:{alt:0,picks:['str','con']}},
  rt:{items:[{id:'esp', n:'Espada larga', ref:'item|Longsword|XPHB', k:'wpn', ic:'i-sword', w:1, h:3, slot:'main', eq:'main'}, {id:'pla', n:'Placas', ref:'item|Plate Armor|XPHB', k:'wpn', ic:'i-armor', w:3, h:3, x:2, y:0, slot:'armor', in:'body'}]}};
const check = (name, cond) => { console.log((cond ? 'bien ' : 'MAL  ') + name); if (!cond) errors.push('falló: ' + name); };
(async () => {
  await new Promise((res) => { const r = indexedDB.open('diario5e', 2); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(lib, 'lib'); t.oncomplete = () => { r.result.close(); res(); }; }; });
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) {
    w.localStorage.setItem('diario-v4', JSON.stringify({v:4, skin:'carmesi', chars:[pal], active:'p', tab:'personaje', left:'personaje'}));
    w.indexedDB = indexedDB; w.matchMedia = q => ({ matches: false, addEventListener(){}, addListener(){} });
    w.addEventListener('error', e => errors.push('window error: ' + (e.error && e.error.stack || e.message))); w.console.error = (...a) => errors.push(a.join(' '));
    w.HTMLElement.prototype.scrollIntoView = function(){}; w.Element.prototype.animate = function(){ return {set onfinish(f){ setTimeout(f, 5); }}; }; } });
  const w = dom.window, I = w.Identidad, app = w.document.querySelector('.app');
  await wait(1500);
  const all = I.all();
  check('todas las subclases del paquete con identidad, todas hechas a mano', all.length >= 150 && all.every((x) => x.hand));
  console.log('subclases:', all.length, 'sin tabla:', all.filter((x) => !x.hand).map((x) => x.cls + ':' + x.sub).join(', ') || 'ninguna');
  const icons = new Set(JSON.parse(fs.readFileSync(require('path').join(__dirname, '../../web/src/iconos.js'), 'utf8').match(/var GI = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"')));
  check('cada emblema está en el paquete de iconos', all.every((x) => icons.has(x.t.e)) && Object.values(I.CLS).every((c) => icons.has(c[3])));
  check('una subclase nueva sale por las palabras de su nombre', I.of('Wizard', 'School of Frostfire').p === 'embers' && I.of('Cleric', 'Storm Domain').e === 'lightning-storm');
  const st = I._state();
  check('Lyra es Oathbreaker: rojo oscuro con humo y detalles a mano', st.theme && st.theme.key === 'paladin:oathbreaker' && st.theme.p === 'smoke' && st.theme.x && st.theme.x.aura);
  check('el libro toma sus colores', w.document.documentElement.style.getPropertyValue('--id-a') === '#6e0f12' && app.getAttribute('data-id') === 'paladin-oathbreaker');
  check('el emblema en el encabezado, con su borde de metal', !!w.document.querySelector('#head > .id-emb use[href="#gi-broken-skull"]') && !!w.document.querySelector('#head > .id-rim'));
  w.document.querySelector('[data-act="ptab"][data-v="comp"]').dispatchEvent(new w.MouseEvent('click', {bubbles:true})); await wait(20);
  check('la tarjeta de identidad en la hoja (Competencias)', /Oathbreaker/.test(w.document.querySelector('#pPersonaje .id-card').textContent));
  const ac = w.Diario.D().ac; check('el metal sigue a la CA (' + ac + ')', +app.getAttribute('data-ac') === (ac >= 20 ? 4 : ac >= 18 ? 3 : ac >= 16 ? 2 : ac >= 13 ? 1 : 0));
  // la vida
  const X = w.Diario, r = X.rt(X.cur()), max = X.D().hp.max;
  check('con toda la vida, nada', app.getAttribute('data-hp') === 'ok' && !!w.document.getElementById('idVeil'));
  X.applyToMe({kind:'damage', amount:Math.ceil(max * 0.6)}); await wait(30);
  check('a menos de la mitad: viñeta', app.getAttribute('data-hp') === 'hurt');
  X.applyToMe({kind:'damage', amount:Math.ceil(max * 0.2)}); await wait(30);
  check('a un cuarto: grietas y pulso', app.getAttribute('data-hp') === 'bad');
  X.applyToMe({kind:'damage', amount:r.hp}); await wait(30);
  check('a 0 PG: el libro se apaga y late', app.getAttribute('data-hp') === 'down');
  X.applyToMe({kind:'heal', amount:max}); await wait(30);
  // estados y concentración
  X.applyToMe({kind:'cond+', cond:'poisoned'}); X.applyToMe({kind:'cond+', cond:'restrained'}); r.conc = 'Bless|XPHB'; X.save(); X.renderAll(); await wait(30);
  const sts = app.getAttribute('data-st') || '';
  check('envenenado, apresado y concentrado: cada uno con su efecto', /poisoned/.test(sts) && /restrained/.test(sts) && /\bconc\b/.test(sts));
  // estados de clase: el aura del paladín (con el Aura de odio del Oathbreaker)
  w.Diario.renderCombat && (w.document.getElementById('combat').hidden = false, w.Diario.renderCombat());
  const tg = w.document.querySelector('[data-act="idon"][data-v="aura"]');
  check('en el combate, el aura se activa', !!tg);
  if (tg) { tg.click(); await wait(30); }
  check('aura activa: el libro late en rojo (Aura de odio)', /on-aura/.test(app.getAttribute('data-st')) && /aura-hate/.test(app.getAttribute('data-st')));
  const s = w.Sala.summary();
  check('el resumen lleva el color y el estado de clase', s.idc === '#6e0f12' && s.on.includes('aura'));
  // apagarlo en Ajustes
  I.paint(); const box = w.document.getElementById('idBox');
  check('Ajustes: la galería con todas', box && box.querySelectorAll('.id-g').length === all.length);
  const on = w.document.getElementById('idOn'); on.checked = false; on.dispatchEvent(new w.Event('change', {bubbles:true})); await wait(30);
  check('apagada: el libro vuelve a lo de siempre', !app.getAttribute('data-id') && !app.getAttribute('data-hp'));
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO ERRORS'); process.exit(0);
})().catch(e => { console.log('FAIL', e.stack, errors.join('\n')); process.exit(1); });
