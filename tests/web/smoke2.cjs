const fs = require('fs'); const { JSDOM } = require('jsdom'); require('fake-indexeddb/auto');
const html = fs.readFileSync(process.argv[2], 'utf8'), lib = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), errors = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await new Promise((res) => { const r = indexedDB.open('diario5e', 2); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(lib, 'lib'); t.oncomplete = () => { r.result.close(); res(); }; }; });
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) {
    w.indexedDB = indexedDB; w.matchMedia = q => ({ matches: false, addEventListener(){}, addListener(){} });
    w.addEventListener('error', e => errors.push('window error: ' + (e.error && e.error.stack || e.message))); w.console.error = (...a) => errors.push(a.join(' '));
    w.HTMLElement.prototype.scrollIntoView = function(){}; w.HTMLElement.prototype.setPointerCapture = function(){}; } });
  const w = dom.window, d = w.document, $ = s => d.querySelector(s);
  const click = el => el ? el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })) : errors.push('missing ' + new Error().stack.split('\n')[2]);
  const act = (a, x) => click(d.querySelector('[data-act="' + a + '"]' + (x || '')));
  await wait(1500); act('open'); await wait(1400);
  act('levelup'); await wait(50);
  console.log('step:', d.querySelector('#crSteps [aria-current]').textContent, '| head:', d.querySelector('.lvhead h3').textContent);
  const up = () => d.querySelector('[data-act="crup"]');
  console.log('up enabled at 11:', !up().disabled);
  act('crup'); await wait(50);
  console.log('lvl12 head:', d.querySelector('.lvhead h3').textContent, '| up disabled:', up().disabled, '| groups:', [...d.querySelectorAll('#crIn .group-h')].map(e => e.textContent).join(' / '));
  console.log('lvl12 choices:', [...d.querySelectorAll('#crIn .ch h3')].map(e => e.textContent).join(' | '));
  console.log('help:', [...d.querySelectorAll('#crIn .lvbtns + .help')].map(e => e.textContent).join(''));
  act('crdown'); await wait(50);
  console.log('back:', d.querySelector('.lvhead h3').textContent, '| up enabled:', !up().disabled);
  act('crclose'); await wait(20);
  // homebrew
  act('tab', '[data-tab="equipo"]'); await wait(20); act('hbnew'); await wait(20);
  $('#hbName').value = 'Matadragones'; $('#hbDice').value = '3d6';
  d.querySelector('#hbProps input[value="H"]').checked = true; d.querySelector('#hbProps input[value="2H"]').checked = true;
  $('#hbXDice').value = '1d6'; $('#hbSize').value = '2x6'; $('#hbNotes').value = 'Arma de Guts';
  $('#hbForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await wait(50);
  console.log('hb err hidden:', $('#hbErr').hidden, '| sheet hidden:', $('#hbSheet').hidden, '| main slot:', [...d.querySelectorAll('#bodySlots .slot .v')].map(e => e.textContent).join(', '));
  act('campanas'); act('mesatab', '[data-v="combate"]'); await wait(30);
  console.log('combat weapon:', d.querySelector('#cTurno .wpn h3').textContent, '|', d.querySelector('#cTurno .wpn .wpn-dmg').textContent, '|', d.querySelector('#cTurno .wpn .wpn-roll').textContent);
  act('endcombat'); act('hbnew'); await wait(20); console.log('saved list:', d.querySelectorAll('#hbSaved .line').length);
  // validacion
  $('#hbName').value = 'X'; $('#hbDice').value = 'mucho'; $('#hbForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await wait(20);
  console.log('validation msg:', $('#hbErr').textContent);
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO ERRORS'); process.exit(0);
})().catch(e => { console.log('FAIL', e.stack, errors.join('\n')); process.exit(1); });
