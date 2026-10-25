// Dos diarios (jsdom) conectados al servidor real: uno crea la sala, el otro entra, ambos tiran iniciativa
// y el segundo le hace daño al primero. Comprueba que la hoja del primero baja sus PG.
const fs = require('fs'); const { JSDOM } = require('jsdom'); const path = require('path');
const [html, bundle] = process.argv.slice(2), lib = JSON.parse(fs.readFileSync(bundle, 'utf8')), errors = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const { startServer } = await import(path.join(__dirname, '../../server/index.mjs'));
  const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true });
  const url = 'http://127.0.0.1:' + srv.port + '/';
  async function page(tag){
    const { indexedDB } = require('fake-indexeddb'); // cada página con su propio almacenamiento
    const { IDBFactory } = require('fake-indexeddb'); const idb = new IDBFactory();
    await new Promise(res => { const r = idb.open('diario5e', 2); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(lib, 'lib'); t.oncomplete = () => { r.result.close(); res(); }; }; });
    const dom = new JSDOM(fs.readFileSync(html, 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url, beforeParse(w){
      w.indexedDB = idb; w.matchMedia = () => ({ matches: false, addEventListener(){}, addListener(){} });
      w.addEventListener('error', e => errors.push(tag + ': ' + (e.error && e.error.stack || e.message))); w.console.error = (...a) => errors.push(tag + ': ' + a.join(' '));
      w.HTMLElement.prototype.scrollIntoView = function(){}; w.Element.prototype.animate = function(){ return {set onfinish(f){ setTimeout(f, 5); }}; };
    }});
    const w = dom.window, d = w.document;
    const api = { w, d, $: s => d.querySelector(s), $$: s => [...d.querySelectorAll(s)],
      click: el => { if (!el) throw new Error(tag + ': falta un elemento'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); },
      act(a, x){ api.click(d.querySelector('[data-act="' + a + '"]' + (x || ''))); },
      submit(form, kind){ const btn = kind ? form.querySelector('[data-kind="' + kind + '"]') : form.querySelector('[type=submit]'); const ev = new w.Event('submit', { bubbles: true, cancelable: true }); Object.defineProperty(ev, 'submitter', { value: btn }); form.dispatchEvent(ev); },
      hp(){ const S = JSON.parse(w.localStorage.getItem('diario-v4')); return S.chars[0].rt.hp; } };
    await wait(1500);
    api.act('combat'); await wait(50);
    return api;
  }
  async function until(fn, ms = 4000){ const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await wait(50); } return false; }
  try {
    const A = await page('A'), B = await page('B');
    A.act('salacreate');
    await until(() => A.$('.sala-code'));
    const code = A.$('.sala-code').textContent; console.log('sala creada:', code);
    B.$('#salaCode').value = code; B.act('salajoin');
    await until(() => B.$('.sala-code') && A.$$('.sala-row').length === 2);
    console.log('A ve filas:', A.$$('.sala-row .sala-name b').map(e => e.textContent).join(' | '));
    A.$('[data-form="salainit"] [name=v]').value = '18'; A.submit(A.$('[data-form="salainit"]'));
    B.$('[data-form="salainit"] [name=v]').value = '11'; B.submit(B.$('[data-form="salainit"]'));
    await until(() => B.$$('.sala-list > .sala-row').length === 2 && !B.$('.sala-sep'));
    console.log('orden en B:', B.$$('.sala-row .sala-init').map(e => e.textContent).join(', '));
    const hp0 = A.hp();
    // B selecciona a A (la fila con init 18) y le hace 9 de daño
    const rowA = B.$$('.sala-row').find(r => r.querySelector('.sala-init').textContent === '18');
    B.click(rowA.querySelector('[data-act="salasel"]')); await wait(30);
    const f = B.$('[data-form="salaapply"]'); f.querySelector('[name=amount]').value = '9'; f.querySelector('[name=note]').value = 'Prueba';
    B.submit(f, 'damage');
    await until(() => A.hp() === hp0 - 9);
    console.log('PG de A:', hp0, '→', A.hp(), '| aviso:', A.$('#salaToast').textContent);
    await until(() => (B.$$('.sala-row').find(r => r.querySelector('.sala-init').textContent === '18') || {}).textContent.includes(String(hp0 - 9)));
    console.log('B ve los PG nuevos de A:', B.$$('.sala-row').find(r => r.querySelector('.sala-init').textContent === '18').querySelector('.sala-hp').textContent);
    // condición
    B.click(B.$$('.sala-row').find(r => r.querySelector('.sala-init').textContent === '18').querySelector('[data-act="salasel"]')); await wait(30);
    const f2 = B.$('[data-form="salaapply"]'); f2.querySelector('[name=cond]').value = 'prone'; B.submit(f2, 'cond+');
    await until(() => A.$('[data-act="condoff"][data-v="prone"]'));
    console.log('A tiene condición:', !!A.$('[data-act="condoff"][data-v="prone"]'), '| registro B:', B.$$('.sala-log p').map(p => p.textContent)[0]);
    if (A.hp() !== hp0 - 9) errors.push('el daño no llegó a la hoja de A');
  } catch(e){ errors.push(e.stack); }
  await srv.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO ERRORS'); process.exit(errors.length ? 1 : 0);
})();
