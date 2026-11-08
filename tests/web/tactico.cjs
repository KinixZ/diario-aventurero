// La hoja en el combate táctico: definición de efecto de los conjuros (área, zona, estados), alcance de las armas,
// salvaciones contra la muerte, cansancio (2024) y lo que viaja en el resumen a la campaña.
const fs = require('fs'); const { JSDOM } = require('jsdom'); require('fake-indexeddb/auto');
const html = fs.readFileSync(process.argv[2], 'utf8'), lib = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), errors = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
const clr = {id:'c', name:'Mira', level:5, method:'array', base:{str:10,dex:12,con:14,int:8,wis:15,cha:13}, ch:{cls:'Cleric|XPHB', race:'Human|XPHB', bg:'Acolyte|XPHB', bgAbil:{alt:0,picks:['wis','con']}, cantrips:['Sacred Flame|XPHB','Guidance|XPHB','Thaumaturgy|XPHB'], spells:['Spirit Guardians|XPHB','Bless|XPHB','Cure Wounds|XPHB','Hold Person|XPHB','Spiritual Weapon|XPHB','Shield of Faith|XPHB','Guiding Bolt|XPHB','Aid|XPHB','Healing Word|XPHB']},
  rt:{items:[{id:'lan', n:'Lanza', ref:'item|Spear|XPHB', k:'wpn', ic:'i-sword', w:1, h:3, slot:'main', eq:'main'}]}};
const check = (name, cond) => { console.log((cond ? 'bien ' : 'MAL  ') + name); if (!cond) errors.push('falló: ' + name); };
(async () => {
  await new Promise((res) => { const r = indexedDB.open('diario5e', 2); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(lib, 'lib'); t.oncomplete = () => { r.result.close(); res(); }; }; });
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) {
    w.localStorage.setItem('diario-v4', JSON.stringify({v:4, skin:'carmesi', chars:[clr], active:'c', tab:'personaje', left:'personaje'}));
    w.indexedDB = indexedDB; w.matchMedia = q => ({ matches: false, addEventListener(){}, addListener(){} });
    w.addEventListener('error', e => errors.push('window error: ' + (e.error && e.error.stack || e.message))); w.console.error = (...a) => errors.push(a.join(' '));
    w.HTMLElement.prototype.scrollIntoView = function(){}; w.Element.prototype.animate = function(){ return {set onfinish(f){ setTimeout(f, 5); }}; }; } });
  const w = dom.window;
  await wait(1500);
  check('los motores están cargados', !!w.Tactica && !!w.Hechizos && !!w.Efectos && !!w.Dados);
  // todos los conjuros del paquete tienen su definición
  const sv = w.Hechizos.survey(lib.spell);
  check('todos los conjuros con definición; la mayoría automáticos', sv.total === lib.spell.length && sv.auto > sv.total * 0.45 && sv.zones > 50);
  console.log('conjuros:', sv.total, 'automáticos', sv.auto, 'asistidos', sv.asistidos, 'zonas', sv.zones);
  const X = w.Diario, A = X.actions();
  const sg = A.find((a) => /Spirit Guardians|Guardianes espirituales/.test(a.title));
  check('Espíritus guardianes: emanación que sigue a la ficha, con concentración', !!sg && sg.def.area.t === 'emanation' && sg.def.zone.follow && sg.def.conc && sg.save.ab === 'wis');
  const lan = A.find((a) => a.key === 'w:lan');
  check('la lanza: cuerpo a cuerpo, se puede arrojar (alcance en pies)', !!lan && lan.melee && lan.reach === 1 && lan.range && lan.range[0] === 20);
  check('los conjuros sin tirada también están (asistidos)', A.some((a) => a.group === 'Otros conjuros' && a.def && a.def.auto === 'asistido'));
  // salvaciones contra la muerte
  const r = X.rt(X.cur());
  X.applyToMe({kind:'damage', amount:r.hp}); await wait(30);
  check('a 0 PG empieza la cuenta', r.hp === 0 && r.death && r.death.s === 0 && r.death.f === 0);
  X.applyToMe({kind:'death', amount:12}); X.applyToMe({kind:'death', amount:4}); X.applyToMe({kind:'death', amount:1});
  check('éxito, fallo y un 1 (dos fallos): muerto con 3 fallos', r.death.s === 1 && r.death.f === 3 && r.death.dead);
  X.applyToMe({kind:'heal', amount:5}); await wait(30);
  check('curarte borra la cuenta', r.hp === 5 && !r.death);
  X.applyToMe({kind:'damage', amount:5}); X.applyToMe({kind:'death', amount:20}); await wait(30);
  check('un 20: recuperas 1 PG', r.hp === 1 && !r.death);
  X.applyToMe({kind:'damage', amount:1 + 60}); await wait(30);
  check('daño masivo (lo que sobra iguala tus PG máximos): muerte', r.death && r.death.dead);
  X.applyToMe({kind:'heal', amount:40}); await wait(30);
  // concentración que termina por el servidor
  r.conc = 'Bless|XPHB'; X.applyToMe({kind:'conc-'}); check('el servidor termina tu concentración', !r.conc);
  // cansancio 2024
  w.document.querySelector('[data-act="campanas"]') && null;
  r.exh = 2; X.save();
  check('el cansancio resta 2 por nivel al d20', X.exhPen() === -4);
  const s = w.Sala.summary();
  check('el resumen lleva cansancio, salvaciones y alcance', s.exh === 2 && s.reach === 1 && 'ds' in s);
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO ERRORS'); process.exit(0);
})().catch(e => { console.log('FAIL', e.stack, errors.join('\n')); process.exit(1); });
