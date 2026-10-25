// Un jugador y el DM: las rondas solo aparecen al empezar el combate; el DM lleva vida y estados de los enemigos
const fs = require('fs'); const { JSDOM } = require('jsdom'); const path = require('path'); const { IDBFactory } = require('fake-indexeddb');
const [html, bundle] = process.argv.slice(2), lib = JSON.parse(fs.readFileSync(bundle, 'utf8')), errors = []; const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const { startServer } = await import(path.join(__dirname, '../../server/index.mjs'));
  const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: {} });
  const url = 'http://127.0.0.1:' + srv.port + '/';
  async function page(tag){
    const idb = new IDBFactory();
    await new Promise(res => { const r = idb.open('diario5e', 2); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(lib, 'lib'); t.oncomplete = () => { r.result.close(); res(); }; }; });
    const dom = new JSDOM(fs.readFileSync(html, 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url, beforeParse(w){
      w.indexedDB = idb; w.fetch = (u, o) => fetch(new URL(u, url).href, o); w.matchMedia = () => ({ matches: false, addEventListener(){}, addListener(){} });
      w.addEventListener('error', e => errors.push(tag + ': ' + (e.error && e.error.stack || e.message))); w.console.error = (...a) => errors.push(tag + ': ' + a.join(' '));
      w.HTMLElement.prototype.scrollIntoView = function(){}; w.Element.prototype.animate = function(){ return {set onfinish(f){ setTimeout(f, 5); }}; };
    }});
    const w = dom.window, d = w.document;
    const api = { w, d, $: s => d.querySelector(s), $$: s => [...d.querySelectorAll(s)],
      click(el){ if (!el) throw new Error(tag + ': falta un elemento'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); },
      change(el, v){ el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); },
      submit(form){ const ev = new w.Event('submit', { bubbles: true, cancelable: true }); Object.defineProperty(ev, 'submitter', { value: form.querySelector('[type=submit]') }); form.dispatchEvent(ev); } };
    await wait(1500); api.click(d.querySelector('[data-act="combat"]')); await wait(50);
    return api;
  }
  const until = async (fn, ms = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch(e){} await wait(50); } return false; };
  try {
    const A = await page('jugador'), M = await page('DM');
    console.log('ronda visible sin sala:', !A.$('#roundTxt').hidden);
    A.click(A.$('[data-act="salacreate"]')); await until(() => A.$('.sala-code'));
    const code = A.$('.sala-code').textContent;
    M.$('#salaCode').value = code; M.$('#salaDm').checked = true; M.click(M.$('[data-act="salajoin"]'));
    await until(() => M.$('.sala-code'));
    console.log('DM en modo DM:', M.$('#combat').classList.contains('dm-mode'), '| ronda visible antes de empezar:', !A.$('#roundTxt').hidden);
    // agregar enemigos
    M.click(M.$('[data-act="salanpc"]')); await wait(20);
    const f = M.$('[data-form="salanpc"]'); f.querySelector('[name=name]').value = 'Ogro'; f.querySelector('[name=hp]').value = '59'; f.querySelector('[name=ac]').value = '11'; f.querySelector('[name=init]').value = '8';
    M.submit(f); await until(() => M.$$('.sala-row.npc').length === 1);
    A.$('[data-form="salainit"] [name=v]').value = '17'; A.submit(A.$('[data-form="salainit"]'));
    await until(() => M.$$('.sala-list > .sala-row').length === 2 && !M.$('.sala-sep'));
    console.log('el DM no puede seleccionar al jugador:', !M.$$('.sala-row:not(.npc) [data-act="salasel"]').length);
    M.click(M.$('[data-act="salaturn"][data-v="start"]'));
    await until(() => !A.$('#roundTxt').hidden);
    console.log('encabezado del jugador:', A.$('#roundTxt').textContent.replace(/\s+/g, ' ').trim());
    // vida y estados del enemigo
    M.click(M.$('.sala-row.npc [data-act="salanpchp"][data-v="-10"]'));
    await until(() => M.$('.sala-row.npc .sala-hp').textContent.startsWith('49'));
    M.change(M.$('.sala-row.npc [data-npccond]'), 'frightened');
    await until(() => M.$('.sala-row.npc [data-act="salacondoff"]'));
    M.change(M.$('.sala-row.npc [data-npcset="ac"]'), '13');
    await until(() => M.$('.sala-row.npc .sala-ac').textContent === '13');
    console.log('ogro para el DM:', M.$('.sala-row.npc .sala-hp').textContent, 'CA', M.$('.sala-row.npc .sala-ac').textContent, '| estados:', M.$$('.sala-row.npc .sala-conds .chip').map(c => c.textContent).join(', '));
    await until(() => A.$$('.sala-row.npc .chip').length);
    console.log('ogro para el jugador:', A.$('.sala-row.npc .sala-state').textContent, '| estados:', A.$$('.sala-row.npc .chip').map(c => c.textContent).join(', '));
    M.click(M.$('[data-act="salaend"]'));
    await until(() => A.$('#roundTxt').hidden);
    console.log('al terminar, ronda oculta:', A.$('#roundTxt').hidden);
  } catch(e){ errors.push(e.stack); }
  await srv.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO ERRORS'); process.exit(errors.length ? 1 : 0);
})();
