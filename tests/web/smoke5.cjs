const fs = require('fs'); const { JSDOM } = require('jsdom'); require('fake-indexeddb/auto');
const html = fs.readFileSync(process.argv[2], 'utf8'), lib = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), errors = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await new Promise((res) => { const r = indexedDB.open('diario5e', 2); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(lib, 'lib'); t.oncomplete = () => { r.result.close(); res(); }; }; });
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) {
    w.indexedDB = indexedDB; w.matchMedia = q => ({ matches: false, addEventListener(){}, addListener(){} });
    w.addEventListener('error', e => errors.push('window error: ' + (e.error && e.error.stack || e.message))); w.console.error = (...a) => errors.push(a.join(' '));
    w.HTMLElement.prototype.scrollIntoView = function(){}; w.Element.prototype.animate = function(){ return {set onfinish(f){ setTimeout(f, 5); }}; }; } });
  const w = dom.window, d = w.document, $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
  const click = el => el ? el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })) : errors.push('missing element ' + new Error().stack.split('\n')[2]);
  const act = (a, x) => click(d.querySelector('[data-act="' + a + '"]' + (x || '')));
  await wait(1500);
  act('levelup'); await wait(40);
  console.log('lvbtns:', $$('.lvbtns button').map(b => b.textContent + (b.disabled ? '(x)' : '')).join(' | '));
  act('mcadd'); await wait(30);
  console.log('picker:', $('#pkTitle').textContent, '| rows', $$('#pkList .prow').length, '| first', $$('#pkList .prow b').slice(0, 4).map(e => e.textContent).join(','), '| warlock flags:', ($$('#pkList .prow').find(p => /Warlock/.test(p.textContent) && /2024/.test(p.textContent)) || {}).textContent);
  click(d.querySelector('#pkList [data-act="pksel"][data-v="Warlock|XPHB"]')); await wait(60);
  console.log('after add: head', $('.lvhead h3').textContent, '|', $('.lvhead .help').textContent);
  console.log('picker auto-open:', !$('#picker').hidden, $('#pkTitle').textContent);
  act('pkclose'); await wait(20);
  console.log('choices now:', $$('#crIn .ch h3').map(e => e.textContent).join(' | '));
  console.log('gained:', $$('#crIn details[data-crfeat] b').map(e => e.textContent).join(', '));
  console.log('lvbtns:', $$('.lvbtns button').map(b => b.textContent + (b.disabled ? '(x)' : '')).join(' | '));
  // save and check sheet
  act('crstep', '[data-v="listo"]'); await wait(20); act('crnext'); await wait(40);
  console.log('sheet head:', $('#hSub').textContent, '| lvl', $('#hLvl').textContent);
  act('tab', '[data-tab="conjuros"]'); await wait(20);
  console.log('slots card:', ($('#pConjuros .card') || {}).textContent.replace(/\s+/g,' ').slice(0, 200));
  console.log('banners:', $$('#pConjuros .banner p').map(e => e.textContent).join(' || '));
  // remove the warlock level again
  act('levelup'); await wait(30); act('crdown'); await wait(30);
  console.log('after down:', $('.lvhead h3').textContent, '| btns', $$('.lvbtns button').map(b => b.textContent).join(' | '));
  act('crstep', '[data-v="listo"]'); await wait(20); act('crnext'); await wait(40);
  console.log('sheet head after:', $('#hSub').textContent);
  const S = JSON.parse(w.localStorage.getItem('diario-v4')); const c = S.chars[0]; console.log('saved cl', JSON.stringify(c.cl), 'leftover @ keys', Object.keys(c.ch).filter(k => k.includes('@')));
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO ERRORS'); process.exit(0);
})().catch(e => { console.log('FAIL', e.stack, errors.join('\n')); process.exit(1); });
