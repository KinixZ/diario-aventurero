// Bestiario del DM (archivo aparte) y mapas locales
const fs = require('fs'); const { JSDOM } = require('jsdom'); require('fake-indexeddb/auto');
const html = fs.readFileSync(process.argv[2], 'utf8'), lib = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), errors = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
const check = (name, cond) => { console.log((cond ? 'bien ' : 'MAL  ') + name); if (!cond) errors.push('falló: ' + name); };
const best = {_bestiario:{v:1, creado:'2026-10-26T00:00:00Z'}, monster:[
  {name:'Ogre', source:'XMM', size:['L'], type:'giant', ac:[11], hp:{average:68, formula:'8d10 + 24'}, speed:{walk:40}, str:19, dex:8, con:16, int:5, wis:7, cha:7, passive:8, cr:'2', action:[{name:'Greatclub', entries:['{@atkr m} {@hit 6}, reach 5 ft. {@h}13 ({@damage 2d8 + 4}) Bludgeoning damage.']}]},
  {name:'Ogre', source:'MM', rep:1, size:['L'], type:'giant', ac:[{ac:11, from:['hide armor']}], hp:{average:59, formula:'7d10 + 21'}, speed:{walk:40}, str:19, dex:8, con:16, int:5, wis:7, cha:7, cr:'2'},
  {name:'Goblin Boss', source:'XMM', size:['S'], type:{type:'fey', tags:['goblinoid']}, ac:[17], hp:{average:21, formula:'6d6'}, speed:{walk:30}, str:10, dex:15, con:10, int:10, wis:8, cha:10, cr:'1', initiative:{proficiency:1}}]};
(async () => {
  await new Promise((res) => { const r = indexedDB.open('diario5e', 2); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(lib, 'lib'); t.oncomplete = () => { r.result.close(); res(); }; }; });
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) {
    w.localStorage.setItem('diario-v4', JSON.stringify({v:4, skin:'carmesi'}));
    w.indexedDB = indexedDB; w.matchMedia = q => ({ matches: false, addEventListener(){}, addListener(){} });
    w.addEventListener('error', e => errors.push('window error: ' + (e.error && e.error.stack || e.message))); w.console.error = (...a) => errors.push(a.join(' '));
    w.HTMLElement.prototype.scrollIntoView = function(){}; w.HTMLCanvasElement.prototype.getContext = function(){ return null; }; w.Element.prototype.animate = function(){ return {set onfinish(f){ setTimeout(f, 5); }}; }; } });
  const w = dom.window, d = w.document, $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
  const click = el => el ? el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })) : errors.push('falta un elemento');
  const act = (a, x) => click($('[data-act="' + a + '"]' + (x || '')));
  await wait(1500);
  // cargar el archivo como lo haría el DM en Ajustes
  const inp = $('#bestFile'); Object.defineProperty(inp, 'files', { value: [new w.File([JSON.stringify(best)], 'bestiario-5e.json', {type:'application/json'})], configurable:true });
  inp.dispatchEvent(new w.Event('change', {bubbles:true})); await wait(300);
  check('se carga el bestiario', /3 criaturas/.test($('#bestStatus').textContent));
  const bad = $('#bestFile'); Object.defineProperty(bad, 'files', { value: [new w.File([JSON.stringify({_diario:{}, monster:[{name:'x'}]})], 'diario-5e.json')], configurable:true });
  bad.dispatchEvent(new w.Event('change', {bubbles:true})); await wait(200);
  check('avisa si cargas el paquete equivocado', /paquete del diario/.test($('#bestStatus').textContent));
  w.Bestiario.open(null, false); await wait(100);
  check('oculta reimpresiones', $$('.best-row').length === 2);
  click($('[data-bestf="old"]')); $('[data-bestf="old"]').checked = true; $('[data-bestf="old"]').dispatchEvent(new w.Event('change', {bubbles:true}));
  check('muestra las viejas si se pide', $$('.best-row').length === 3);
  const q = $('#bestQ'); q.value = 'gob'; q.dispatchEvent(new w.Event('input', {bubbles:true}));
  check('busca por nombre', $$('.best-row').length === 1);
  click($('.best-row')); 
  check('ficha: iniciativa con competencia', /\+4/.test($('.best-stats').textContent) && /21/.test($('.best-stats').textContent));
  check('sin mesa no deja agregar', /entra a la mesa como DM/.test($('#bestBody').textContent));
  w.Bestiario.open('Ogre|XMM', true); await wait(50);
  check('ficha: ataque listo para tirar', /Tira 1d20 \+ 6 · 2d8 \+ 4 contundente/.test($('.best-atk').textContent));
  check('ficha: guarda la fórmula de PG', /8d10 \+ 24/.test($('.best-stats').textContent));
  act('closesheet');
  // mapas sin mesa: se dibujan en la copia del teléfono
  act('mapsopen'); await wait(50);
  check('pestaña de mapas', $('#combat').getAttribute('data-tab') === 'mapas' && /Mis mapas/.test($('#mesaMaps').textContent));
  act('mapnew'); const f = $('[data-form="mapnew"]'); f.elements.name.value = 'Cripta de Vel'; f.elements.size.value = '24x18';
  f.dispatchEvent(new w.Event('submit', {bubbles:true, cancelable:true})); await wait(50);
  check('editor abierto', !!$('#mapCv') && $('#mapName').value === 'Cripta de Vel');
  const maps = w.Mapas._maps(), mp = Object.values(maps)[0];
  check('capas por defecto', mp.layers.map(l => l.name).join(',') === 'Terreno,Paredes y puertas,Notas');
  act('maplayers'); act('mapladd'); check('agregar capa', mp.layers.length === 4);
  act('mapset'); const g = $('#mapGrid'); g.value = 'hex'; g.dispatchEvent(new w.Event('change', {bubbles:true})); check('cambiar cuadrícula', mp.grid === 'hex');
  act('mapback'); await wait(700);
  const ix = JSON.parse(w.localStorage.getItem('diario-mapas'));
  check('queda en la lista del teléfono', ix.length === 1 && ix[0].name === 'Cripta de Vel' && $$('.map-card').length === 1);
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO ERRORS'); process.exit(0);
})().catch(e => { console.log('FAIL', e.stack, errors.join('\n')); process.exit(1); });
