// Ayudante para las pruebas con varios diarios (jsdom) conectados al servidor real.
const fs = require('fs'); const { JSDOM } = require('jsdom'); const { IDBFactory } = require('fake-indexeddb');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch (e) {} await wait(40); } return false; };

/* Un diario con su propio almacenamiento. chars = personajes guardados (opcional); best = bestiario del DM (opcional) */
async function page(html, lib, url, tag, errors, opts = {}) {
  const idb = new IDBFactory();
  await new Promise((res) => { const r = idb.open('diario5e', 2); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(lib, 'lib'); if (opts.best) t.objectStore('kv').put(opts.best, 'bestiary'); t.oncomplete = () => { r.result.close(); res(); }; }; });
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url, beforeParse(w) {
    if (opts.chars) w.localStorage.setItem('diario-v4', JSON.stringify({ v: 4, skin: 'carmesi', chars: opts.chars, active: opts.chars[0].id }));
    w.indexedDB = idb; w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {}; w.fetch = (u, o) => fetch(new URL(u, url).href, o); w.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
    w.addEventListener('error', (e) => errors.push(tag + ': ' + (e.error && e.error.stack || e.message))); w.console.error = (...a) => errors.push(tag + ': ' + a.join(' '));
    w.HTMLElement.prototype.scrollIntoView = function () {}; w.Element.prototype.animate = function () { return { set onfinish(f) { setTimeout(f, 5); } }; };
    w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  } });
  const w = dom.window, d = w.document;
  const api = { w, d, tag, $: (s) => d.querySelector(s), $$: (s) => [...d.querySelectorAll(s)],
    click(el) { if (!el) throw new Error(tag + ': falta un elemento'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); },
    act(a, x) { api.click(d.querySelector('[data-act="' + a + '"]' + (x || ''))); },
    tab(v) { api.act('mesatab', '[data-v="' + v + '"]'); },
    change(el, v) { if (!el) throw new Error(tag + ': falta un elemento'); if (el.type === 'checkbox') el.checked = !!v; else el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); },
    submit(form, kind) { if (!form) throw new Error(tag + ': falta un formulario'); const btn = kind ? form.querySelector('[data-kind="' + kind + '"]') : form.querySelector('[type=submit]'); const ev = new w.Event('submit', { bubbles: true, cancelable: true }); Object.defineProperty(ev, 'submitter', { value: btn }); form.dispatchEvent(ev); },
    fill(form, vals) { for (const [k, v] of Object.entries(vals)) form.elements[k].value = v; return form; },
    msgs() { return [...d.querySelectorAll('#mesaChat .msg')].map((m) => m.textContent.replace(/\s+/g, ' ').trim()); },
    hp() { const S = JSON.parse(w.localStorage.getItem('diario-v4')); return S.chars.find((c) => c.id === S.active).rt.hp; } };
  await wait(1500);
  api.act('campanas'); await wait(40);
  return api;
}
/* El DM crea una campaña desde Inicio; devuelve el código */
async function create(P, name = 'Prueba', key = 'dragon') {
  P.submit(P.fill(P.$('[data-form="campnew"]'), { name, key, key2: key }));
  if (!await until(() => P.$('.camp-codebig b'))) throw new Error(P.tag + ': no se creó la campaña');
  return P.$('.camp-codebig b').textContent.trim();
}
async function join(P, code) {
  P.submit(P.fill(P.$('[data-form="campjoin"]'), { code }));
  if (!await until(() => P.$('.camp-top'))) throw new Error(P.tag + ': no pudo entrar a ' + code);
}
const mk = (id, name, cls = 'Bard|XPHB') => [{ id, name, level: 3, method: 'array', base: { str: 10, dex: 14, con: 12, int: 10, wis: 12, cha: 16 }, ch: { cls, race: 'Human|XPHB', bg: 'Sage|XPHB' }, rt: {} }];
module.exports = { page, create, join, wait, until, mk };
