// El diario servido por el servidor usa su traductor (simulado) en el grimorio
const fs = require('fs'); const { JSDOM } = require('jsdom'); const path = require('path'); const { IDBFactory } = require('fake-indexeddb');
const [html, bundle] = process.argv.slice(2), lib = JSON.parse(fs.readFileSync(bundle, 'utf8')), errors = []; const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const { startServer } = await import(path.join(__dirname, '../../server/index.mjs'));
  const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: { TR_PROVIDER: 'mock' } });
  try {
    const idb = new IDBFactory();
    await new Promise(res => { const r = idb.open('diario5e', 2); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(lib, 'lib'); t.oncomplete = () => { r.result.close(); res(); }; }; });
    const dom = new JSDOM(fs.readFileSync(html, 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://127.0.0.1:' + srv.port + '/', beforeParse(w){
      w.indexedDB = idb; w.fetch = (u, o) => fetch(new URL(u, 'http://127.0.0.1:' + srv.port + '/').href, o); w.matchMedia = () => ({ matches: false, addEventListener(){}, addListener(){} });
      w.addEventListener('error', e => errors.push(e.error && e.error.stack || e.message)); w.console.error = (...a) => errors.push(a.join(' '));
      w.HTMLElement.prototype.scrollIntoView = function(){}; w.Element.prototype.animate = function(){ return {set onfinish(f){ setTimeout(f, 5); }}; };
    }});
    const w = dom.window, d = w.document, $ = s => d.querySelector(s), click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await wait(1500);
    click($('[data-act="settings"]')); await wait(300);
    console.log('estado:', $('#trStatus').textContent);
    click($('[data-act="closesheet"]'));
    click($('[data-act="tab"][data-tab="grimorio"]')); await wait(30); click($('[data-act="gsec"][data-v="conjuros"]')); await wait(30);
    const q = $('#gq'); q.value = 'fireball'; q.dispatchEvent(new w.Event('input', { bubbles: true })); await wait(40);
    click(d.querySelector('#grim [data-act="gopen"]')); await wait(40);
    click(d.querySelector('#grim [data-act="trgo"]'));
    for (let i = 0; i < 40 && !d.querySelector('#grim .mock'); i++) await wait(100);
    console.log('barra:', (d.querySelector('#grim .trbar') || {}).textContent, '| traducido:', !!d.querySelector('#grim .mock'));
    if (!d.querySelector('#grim .mock')) errors.push('no llegó la traducción del servidor');
  } catch(e){ errors.push(e.stack); }
  await srv.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO ERRORS'); process.exit(errors.length ? 1 : 0);
})();
