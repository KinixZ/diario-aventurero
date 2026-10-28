// Rasgos agrupados, habilidades homebrew y acceso rápido del combate
const fs = require('fs'); const { JSDOM } = require('jsdom'); require('fake-indexeddb/auto');
const html = fs.readFileSync(process.argv[2], 'utf8'), lib = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), errors = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
const pal = {id:'p', name:'Lyra', level:11, method:'array', base:{str:15,dex:10,con:14,int:8,wis:12,cha:13}, ch:{cls:'Paladin|XPHB', sub:'Oathbreaker|DMG', race:'Aasimar|XPHB', bg:'Soldier|XPHB', bgAbil:{alt:0,picks:['str','con']}},
  rt:{items:[{id:'esp', n:'Espada larga', ref:'item|Longsword|XPHB', k:'wpn', ic:'i-sword', w:1, h:3, slot:'main', eq:'main'}, {id:'jav', n:'Jabalinas', ref:'item|Javelin|XPHB', q:6, k:'wpn', ic:'i-sword', w:1, h:2, x:0, y:0, slot:'main', in:'body'}, {id:'pla', n:'Placas', ref:'item|Plate Armor|XPHB', k:'wpn', ic:'i-armor', w:3, h:3, x:2, y:0, slot:'armor', in:'body'}, {id:'poc', n:'Poción de curación', ref:'item|Potion of Healing|XDMG', q:2, k:'mag', ic:'i-flask', w:1, h:2, x:1, y:0, in:'body', use:'Tira 2d4 + 2.'}]}};
const check = (name, cond) => { console.log((cond ? 'bien ' : 'MAL  ') + name); if (!cond) errors.push('falló: ' + name); };
(async () => {
  await new Promise((res) => { const r = indexedDB.open('diario5e', 2); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(lib, 'lib'); t.oncomplete = () => { r.result.close(); res(); }; }; });
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) {
    w.localStorage.setItem('diario-v4', JSON.stringify({v:4, skin:'carmesi', chars:[pal], active:'p', tab:'rasgos', left:'personaje'}));
    w.indexedDB = indexedDB; w.matchMedia = q => ({ matches: false, addEventListener(){}, addListener(){} });
    w.addEventListener('error', e => errors.push('window error: ' + (e.error && e.error.stack || e.message))); w.console.error = (...a) => errors.push(a.join(' '));
    w.HTMLElement.prototype.scrollIntoView = function(){}; w.Element.prototype.animate = function(){ return {set onfinish(f){ setTimeout(f, 5); }}; }; } });
  const w = dom.window, d = w.document, $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
  const click = el => el ? el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })) : errors.push('falta un elemento');
  const act = (a, x) => click($('[data-act="' + a + '"]' + (x || '')));
  const st = () => JSON.parse(w.localStorage.getItem('diario-v4')).chars[0];
  await wait(1500);
  const R = w.Rules5e;
  check('coste: bonus', R.costOf('As a Bonus Action, you can') === 'b');
  check('coste: Attack action no es coste', R.costOf('whenever you take the Attack action on your turn') === '');
  check('coste: reacción 2014', R.costOf('you can use your reaction to') === 'r');
  const groups = $$('#pRasgos .rg-gh b').map(e => e.textContent);
  check('grupos por origen', groups.join(',') === 'Paladin 11,Oathbreaker,Aasimar,Dotes,Homebrew');
  check('mejoras de característica al final', /Ability Score Improvement/.test($('.rg-also').textContent));
  const first = $('#pRasgos .rg-g .rg-f .rg-t b:not(.sr)'); check('activos primero (Lay on Hands)', first && first.textContent === 'Lay on Hands');
  act('rgf', '[data-v="act"]'); const nAct = $$('#pRasgos .rg-f').length; act('rgf', '[data-v="pas"]'); const nPas = $$('#pRasgos .rg-f').length; act('rgf', '[data-v="all"]');
  check('filtros combate/pasivos', nAct > 0 && nPas > nAct);
  const q = $('#rgQ'); q.value = 'aura'; q.dispatchEvent(new w.Event('input', {bubbles:true}));
  check('buscador', $$('#pRasgos .rg-f').length >= 2 && $$('#pRasgos .rg-f').every(e => /aura/i.test(e.textContent)));
  $('#rgQ').value = ''; $('#rgQ').dispatchEvent(new w.Event('input', {bubbles:true}));
  // habilidad homebrew
  act('abnew'); const f = $('#abForm');
  f.elements.name.value = 'Rayo de fuerza'; f.elements.usesK.value = 'n'; f.elements.usesN.value = '3'; f.elements.dice.value = '3d6'; f.elements.dtype.value = 'O'; f.elements.range.value = '36 m';
  f.dispatchEvent(new w.Event('input', {bubbles:true}));
  check('vista previa', /Tira 1d20 \+ 5 · 3d6 fuerza · 36 m · 3 usos por descanso largo/.test($('#abPrev').textContent));
  f.elements.dice.value = 'mucho'; f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  check('valida los dados', !$('#abErr').hidden);
  f.elements.dice.value = '3d6'; f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await wait(20);
  const ab = st().hbAb; check('se guarda en el personaje', ab && ab.length === 1 && ab[0].uses === '3');
  check('aparece en Homebrew con su línea', /3d6 fuerza/.test($$('#pRasgos .rg-line').map(e => e.textContent).join('|')));
  const D = R.derive(st()); check('es un recurso de 3 usos', D.resources.some(x => x.key === 'hb:' + ab[0].id && x.max === 3));
  // acceso rápido
  act('campanas'); act('mesatab', '[data-v="combate"]'); await wait(30); click($('[data-act="csub"][data-v="turno"]'));
  const rows = $$('#cTurno .q-row h4').map(e => e.textContent);
  check('por defecto: habilidad, rasgos con usos y poción', rows.indexOf('Rayo de fuerza') >= 0 && rows.indexOf('Lay on Hands') >= 0 && rows.indexOf('Poción de curación') >= 0);
  check('otras armas: jabalinas sí, armadura no', rows.indexOf('Jabalinas') >= 0 && rows.indexOf('Placas') < 0);
  act('quse', '[data-q^="hb:"]'); let r = st().rt;
  check('usar gasta la carga y la acción', r.res['hb:' + ab[0].id] === 1 && r.econ.a === true);
  act('quse', '[data-q="it:poc"]'); r = st().rt;
  check('poción: −1 y acción adicional', r.items.filter(i => i.id === 'poc')[0].q === 1 && r.econ.b === true);
  act('qedit'); const sp = $('#quickList [data-q="sp:Hellish Rebuke|XPHB"]') || $('#quickList [data-q^="sp:"]:not([data-q*="Light"])'); const spk = sp.dataset.q; click(sp); act('closesheet');
  check('fijar un conjuro', st().rt.quick.indexOf(spk) >= 0);
  click($('#cTurno [data-act="quse"][data-q="' + spk + '"][data-lv="1"]')); r = st().rt;
  check('lanzar a nivel 1 gasta un espacio', r.slotsUsed[0] === 1);
  act('qequip', '[data-id="jav"]'); r = st().rt;
  check('equipar desde combate', r.items.filter(i => i.id === 'jav')[0].eq);
  act('short'); check('descanso corto no recupera lo de descanso largo', st().rt.res['hb:' + ab[0].id] === 1);
  act('long'); check('descanso largo sí', !st().rt.res['hb:' + ab[0].id]);
  // estilo BG3
  const tg = $('#hudBg3'); tg.checked = true; tg.dispatchEvent(new w.Event('change', {bubbles:true}));
  check('modo Baldur\'s Gate', d.documentElement.getAttribute('data-hud') === 'bg3' && JSON.parse(w.localStorage.getItem('diario-v4')).hud === 'bg3');
  check('espacios con clase propia', $$('.pip.slotpip').length > 0);
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO ERRORS'); process.exit(0);
})().catch(e => { console.log('FAIL', e.stack, errors.join('\n')); process.exit(1); });
