// Lo que la escena de combate saca de la hoja: armas con ataque y daño, conjuros con ataque o salvación y sus dados
// (trucos que crecen con el nivel, conjuros con espacio mayor), salvaciones y espacios libres.
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
  const w = dom.window;
  await wait(1500);
  const X = w.Diario, A = X.actions();
  const esp = A.find((a) => a.key === 'w:esp');
  check('el arma con su ataque y su daño', !!esp && esp.atk.bonus > 0 && /^1d(8|10) \+ \d$/.test(esp.dmg[0].dice) && esp.dmg[0].type === 'cortante');
  console.log('espada:', JSON.stringify(esp));
  const sp = A.filter((a) => a.group === 'Conjuros');
  console.log('conjuros:', sp.map((a) => a.title + ' ' + (a.dmg[0] ? a.dmg[0].dice : '')).join(' · '));
  check('conjuros con tirada', sp.length > 0 && sp.every((a) => a.atk || a.save || a.dmg.length));
  const cw = sp.find((a) => /Cure Wounds|Curar heridas/.test(a.title));
  if (cw) check('curar heridas: cura con el modificador de Carisma', cw.heal && /^2d8 \+ \d$/.test(cw.dmg[0].dice));
  check('fuego: el truco crece con el nivel (11: 3d10)', X.spellDice('Fire Bolt|XPHB', 0) === '3d10');
  check('bola de fuego a nivel 5: 10d6', X.spellDice('Fireball|XPHB', 5) === '10d6');
  check('curar heridas a nivel 3: 6d8', X.spellDice('Cure Wounds|XPHB', 3) === '6d8');
  check('salvación de Fuerza de la hoja', X.saveMod('str') === w.Diario.D().save.str && X.saveMod('wis') > 0);
  const sl = X.slotsFor(1);
  check('espacios libres para un conjuro de nivel 1', sl.length >= 3 && sl[0].v === '1' && sl[0].left > 0);
  // lanzarlo desde la escena gasta el espacio
  const used0 = (JSON.parse(w.localStorage.getItem('diario-v4')).chars[0].rt.slotsUsed || [])[1] || 0;
  X.cast('Cure Wounds|XPHB', '2'); await wait(50);
  const used1 = JSON.parse(w.localStorage.getItem('diario-v4')).chars[0].rt.slotsUsed[1] || 0;
  check('lanzar gasta el espacio', used1 === used0 + 1);
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO ERRORS'); process.exit(0);
})().catch(e => { console.log('FAIL', e.stack, errors.join('\n')); process.exit(1); });
