// La mesa con DM y dos jugadores: chat, susurros, tiradas, tablero, pizarra y cierre de sesión
const fs = require('fs'); const { JSDOM } = require('jsdom'); const path = require('path'); const { IDBFactory } = require('fake-indexeddb');
const [html, bundle] = process.argv.slice(2), lib = JSON.parse(fs.readFileSync(bundle, 'utf8')), errors = []; const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const { startServer } = await import(path.join(__dirname, '../../server/index.mjs'));
  const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: {} });
  const url = 'http://127.0.0.1:' + srv.port + '/';
  async function page(tag, chars){
    const idb = new IDBFactory();
    await new Promise(res => { const r = idb.open('diario5e', 2); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(lib, 'lib'); t.oncomplete = () => { r.result.close(); res(); }; }; });
    const dom = new JSDOM(fs.readFileSync(html, 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url, beforeParse(w){
      if (chars) w.localStorage.setItem('diario-v4', JSON.stringify({v:4, chars, active:chars[0].id}));
      w.indexedDB = idb; w.fetch = (u, o) => fetch(new URL(u, url).href, o); w.matchMedia = () => ({ matches: false, addEventListener(){}, addListener(){} });
      w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
      w.addEventListener('error', e => errors.push(tag + ': ' + (e.error && e.error.stack || e.message))); w.console.error = (...a) => errors.push(tag + ': ' + a.join(' '));
      w.HTMLElement.prototype.scrollIntoView = function(){}; w.Element.prototype.animate = function(){ return {set onfinish(f){ setTimeout(f, 5); }}; };
    }});
    const w = dom.window, d = w.document;
    const api = { w, d, $: s => d.querySelector(s), $$: s => [...d.querySelectorAll(s)],
      click(el){ if (!el) throw new Error(tag + ': falta un elemento'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); },
      submit(form, kind){ const ev = new w.Event('submit', { bubbles: true, cancelable: true }); Object.defineProperty(ev, 'submitter', { value: kind ? form.querySelector('[data-kind="' + kind + '"]') : form.querySelector('[type=submit]') }); form.dispatchEvent(ev); },
      msgs(){ return [...d.querySelectorAll('#mesaChat .msg')].map(m => m.textContent.replace(/\s+/g, ' ').trim()); } };
    await wait(1500); api.click(d.querySelector('[data-act="mesa"]')); await wait(50);
    return api;
  }
  const until = async (fn, ms = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch(e){} await wait(50); } return false; };
  const mk = (id, name) => [{id, name, level:3, method:'array', base:{str:10,dex:14,con:12,int:10,wis:12,cha:16}, ch:{cls:'Bard|XPHB', race:'Human|XPHB', bg:'Sage|XPHB'}, rt:{}}];
  try {
    const M = await page('DM'), A = await page('Lyra', mk('ly', 'Lyra')), B = await page('Bram', mk('br', 'Bram'));
    console.log('pestaña inicial:', M.$('#combat').dataset.tab, '| lobby en el chat:', !!M.$('#mesaChat .sala'));
    M.$('#mesaChat #salaDm').checked = true; M.click(M.$('#mesaChat [data-act="salacreate"]'));
    await until(() => M.$('#mesaChat .chat-form'));
    const code = M.$('.mesa-code').textContent.replace('Mesa ', '');
    for (const P of [A, B]) { P.$('#mesaChat #salaCode').value = code; P.click(P.$('#mesaChat [data-act="salajoin"]')); }
    await until(() => A.$('#mesaChat .chat-form') && B.$('#mesaChat .chat-form'));
    // título, mensaje, susurro y tirada
    const t = M.$('#mesaTitle'); t.value = 'La cripta de Vel'; t.dispatchEvent(new M.w.Event('change', { bubbles: true }));
    A.$('#chatIn').value = 'Abro el sarcófago con cuidado'; A.submit(A.$('[data-form="mesachat"]'), 'msg');
    await until(() => B.msgs().length === 1);
    const lyraId = [...M.$$('#mesaChat .chat-to option')].find(o => /Lyra/.test(o.textContent)).value;
    M.$('#mesaChat .chat-to').value = lyraId; M.$('#chatIn').value = 'Sientes que algo te observa'; M.submit(M.$('[data-form="mesachat"]'), 'msg');
    B.click(B.$('[data-act="mesaroll"]')); await wait(20);
    const rf = B.$('[data-form="mesachat"]'); rf.elements.label.value = 'Percepción'; rf.elements.total.value = '21'; rf.elements.nat.value = '20'; B.submit(rf, 'roll');
    await until(() => A.msgs().length === 3 && B.msgs().length === 2 && M.msgs().length === 3);
    console.log('Lyra ve:', A.msgs().join(' || '));
    console.log('Bram ve:', B.msgs().join(' || '));
    console.log('crítico resaltado:', !!A.$('.roll-card.is-crit'), '| título para Bram:', B.$('.mesa-title-ro').textContent);
    // pestaña sin leer
    A.click(A.$('[data-act="mesatab"][data-v="tablero"]')); await wait(20);
    B.$('#chatIn').value = 'Yo cubro la puerta'; B.submit(B.$('[data-form="mesachat"]'), 'msg');
    await until(() => !A.$('#mesaTabs .badge').hidden);
    console.log('aviso de no leídos en Lyra:', A.$('#mesaTabs .badge').textContent);
    // tablero
    M.click(M.$('[data-act="mesatab"][data-v="tablero"]')); await wait(20); M.click(M.$('[data-act="mesaboardnew"]')); await wait(20);
    M.click(M.$('[data-act="mesacat"][data-v="pnj"]')); const bf = M.$('[data-form="mesaboard"]'); bf.elements.title.value = 'Vel, el sepulturero'; bf.elements.text.value = 'Sabe dónde está la llave'; M.submit(bf);
    await until(() => A.$$('#mesaBoard .board-item').length === 1);
    console.log('tablero de Lyra:', A.$('#mesaBoard').textContent.replace(/\s+/g, ' ').trim(), '| Lyra puede editar:', !!A.$('[data-act="mesabedit"]'));
    // pizarra
    A.w.Sala.send({t:'draw.add', stroke:{color:'#8c2626', w:5, pts:[0.1,0.1,0.5,0.6,0.9,0.2]}});
    await until(() => JSON.parse(B.w.localStorage.getItem('diario-mesa') || '{}').strokes?.length === 1);
    M.click(M.$('[data-act="mesatab"][data-v="pizarra"]')); await wait(20);
    console.log('pizarra del DM tiene herramientas:', !!M.$('.draw-tools'), '| hoja nueva:', !!M.$('[data-act="mesaclear"]'));
    // terminar la sesión
    M.click(M.$('[data-act="mesatab"][data-v="chat"]')); await wait(20);
    M.click(M.$('[data-act="mesaend"]')); await wait(10); M.click(M.$('[data-act="mesaend"]'));
    await until(() => (JSON.parse(B.w.localStorage.getItem('diario-sesiones') || '[]')).length === 1, 6000);
    const notesB = JSON.parse(B.w.localStorage.getItem('diario-v4')).chars[0].rt.notes || '';
    console.log('notas de Bram:', notesB.split('\n').slice(0, 6).join(' / '));
    console.log('Bram no ve el susurro en sus notas:', !/observa/.test(notesB), '| Lyra sí:', /observa/.test(JSON.parse(A.w.localStorage.getItem('diario-v4')).chars[0].rt.notes || ''));
    console.log('sesiones guardadas en Bram:', JSON.parse(B.w.localStorage.getItem('diario-sesiones')).map(x => x.title).join(', '));
    B.click(B.$('[data-act="tab"][data-tab="notas"]')); await wait(30);
    console.log('lista en Notas:', (B.$('#sesList') || {}).textContent.replace(/\s+/g, ' ').trim().slice(0, 80));
  } catch(e){ errors.push(e.stack); }
  await srv.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO ERRORS'); process.exit(errors.length ? 1 : 0);
})();
