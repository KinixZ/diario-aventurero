const fs = require('fs'); const { JSDOM } = require('jsdom'); require('fake-indexeddb/auto');
const html = fs.readFileSync(process.argv[2], 'utf8'), lib = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), errors = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await new Promise((res) => { const r = indexedDB.open('diario5e', 2); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(lib, 'lib'); t.oncomplete = () => { r.result.close(); res(); }; }; });
  const width = +(process.argv[4] || 390);
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) {
    w.indexedDB = indexedDB; w.matchMedia = q => ({ matches: /min-width: 900px/.test(q) ? width >= 900 : false, addEventListener(){}, addListener(){} });
    w.addEventListener('error', e => errors.push('window error: ' + (e.error && e.error.stack || e.message))); w.console.error = (...a) => errors.push(a.join(' '));
    w.HTMLElement.prototype.scrollIntoView = function(){}; w.HTMLElement.prototype.setPointerCapture = function(){}; w.Element.prototype.animate = function(){ return {set onfinish(f){ setTimeout(f, 5); }}; }; } });
  const w = dom.window, d = w.document, $ = s => d.querySelector(s);
  const click = el => el ? el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })) : errors.push('missing ' + new Error().stack.split('\n')[2]);
  const act = (a, x) => click(d.querySelector('[data-act="' + a + '"]' + (x || '')));
  await wait(1500);
  // deslizar la tapa
  const cv = $('#cover'); const pe = (t, x) => cv.dispatchEvent(new w.MouseEvent(t, { bubbles: true, clientX: x, clientY: 300 }));
  ['pointerdown'].forEach(t => cv.dispatchEvent(Object.assign(new w.Event('pointerdown', {bubbles:true}), {clientX: 300, clientY: 300, pointerId: 1})));
  cv.dispatchEvent(Object.assign(new w.Event('pointermove', {bubbles:true}), {clientX: 250, clientY: 302}));
  cv.dispatchEvent(Object.assign(new w.Event('pointermove', {bubbles:true}), {clientX: 100, clientY: 305}));
  console.log('cover transform while dragging:', cv.style.transform);
  cv.dispatchEvent(Object.assign(new w.Event('pointerup', {bubbles:true}), {clientX: 100, clientY: 305}));
  await wait(1500);
  console.log('cover hidden after swipe:', cv.hidden);
  // contenedores
  act('tab', '[data-tab="equipo"]'); await wait(30);
  console.log('box tabs:', [...d.querySelectorAll('#boxTabs button')].map(b => b.textContent).join(' | '), '| slots:', [...d.querySelectorAll('#bodySlots .slot .v')].map(e => e.textContent).join(', '));
  act('finditems'); await wait(30);
  const q = $('#gq'); q.value = 'bag of holding'; q.dispatchEvent(new w.Event('input', { bubbles: true })); await wait(30);
  click(d.querySelector('#grim .gitem')); await wait(30); act('additem'); await wait(30);
  console.log('add msg:', $('#gerr').textContent);
  act('tab', '[data-tab="equipo"]'); await wait(30);
  console.log('tabs now:', [...d.querySelectorAll('#boxTabs button')].map(b => b.textContent).join(' | '));
  // mover la poción a la bolsa
  const poc = d.querySelector('#grid .it[data-id="poc"]'); click(poc); await wait(20);
  act('movemenu'); await wait(20);
  console.log('move options:', [...d.querySelectorAll('#caseActions [data-act="moveto"]')].map(b => b.textContent + (b.disabled ? '(x)' : '')).join(', '));
  const bagBtn = [...d.querySelectorAll('#caseActions [data-act="moveto"]')].find(b => /Bag of Holding/.test(b.textContent)); click(bagBtn); await wait(30);
  console.log('after move open box:', $('#caseName').textContent, '| items there:', d.querySelectorAll('#grid .it').length, '| count', $('#caseCount').textContent);
  // abrir la mochila otra vez
  act('openbox', '[data-id="mochila"]'); await wait(20); console.log('mochila count', $('#caseCount').textContent);
  // tabla de conjuros grimorio
  act('tab', '[data-tab="grimorio"]'); await wait(20); act('gsec', '[data-v="conjuros"]'); await wait(20);
  const gc = $('#gcls'); gc.value = 'Paladin'; gc.dispatchEvent(new w.Event('change', { bubbles: true })); await wait(20);
  act('gmode', '[data-v="table"]'); await wait(30);
  console.log('paladin spells table rows:', d.querySelectorAll('#grim .stable tbody tr').length, '| first:', d.querySelector('#grim .stable tbody tr td').textContent);
  act('gsort', '[data-k="name"]'); await wait(20); console.log('sorted first:', d.querySelector('#grim .stable tbody tr td').textContent);
  click(d.querySelector('#grim .stable tbody tr')); await wait(30);
  console.log('detail open:', !!d.querySelector('#grim .gdetail'), '| trbar:', (d.querySelector('#grim .trbar') || {}).textContent);
  act('trgo'); await wait(200); console.log('tr result:', (d.querySelector('#grim .trbar') || {}).textContent);
  // conjuros del personaje en tabla
  act('tab', '[data-tab="conjuros"]'); await wait(20); act('spview', '[data-v="table"]'); await wait(20);
  console.log('char spell table rows:', d.querySelectorAll('#pConjuros .stable tbody tr').length);
  // ajustes traducción
  act('settings'); await wait(50); console.log('tr modes:', [...d.querySelectorAll('#trModes button')].map(b => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')).join(', '));
  await wait(11000); console.log('tr status:', $('#trStatus').textContent);
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO ERRORS'); process.exit(0);
})().catch(e => { console.log('FAIL', e.stack, errors.join('\n')); process.exit(1); });
