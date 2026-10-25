// Homebrew de armadura, escudo, objeto mágico y consumible: la hoja suma lo que corresponde
const fs=require('fs');const {JSDOM}=require('jsdom');const {IDBFactory}=require('fake-indexeddb');
const [html,pkg]=process.argv.slice(2), lib=JSON.parse(fs.readFileSync(pkg,'utf8')), errors=[]; const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const idb=new IDBFactory(); await new Promise(res=>{const r=idb.open('diario5e',2);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>{const t=r.result.transaction('kv','readwrite');t.objectStore('kv').put(lib,'lib');t.oncomplete=()=>{r.result.close();res();};};});
  const dom=new JSDOM(fs.readFileSync(html,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://example.org/',beforeParse(w){w.indexedDB=idb;w.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});w.HTMLElement.prototype.scrollIntoView=function(){};w.Element.prototype.animate=function(){return {set onfinish(f){setTimeout(f,5)}}};w.addEventListener('error',e=>errors.push(e.error&&e.error.stack||e.message));w.console.error=(...a)=>errors.push(a.join(' '));}});
  const w=dom.window,d=w.document,$=s=>d.querySelector(s),$$=s=>[...d.querySelectorAll(s)];
  const click=el=>{ if(!el) throw new Error('falta elemento'); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); };
  const submit=()=>$('#hbForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  const D=()=>w.Diario.D();
  await wait(1500);
  const ac0=D().ac, sv0=D().save.wis, str0=D().abil.str, dc0=D().casters[0].dc;
  console.log('inicio: CA', ac0, '| Sab salv', sv0, '| Fue', str0, '| CD', dc0, '|', D().acNote);
  click($('[data-act="tab"][data-tab="equipo"]')); await wait(20);
  // 1) armadura pesada +2 que reemplaza las placas
  click($('[data-act="hbnew"]')); await wait(20);
  click($('#hbKinds [data-v="armor"]')); await wait(10);
  console.log('campos visibles armadura:', $$('#hbForm [data-kind]').filter(e=>!e.hidden).map(e=>e.dataset.kind).join(' | '), '| equipar:', $('#hbEquipTxt').textContent);
  $('#hbName').value='Placas del Juramento'; $('#hbArmorType').value='HA'; $('#hbAc').value='18'; $('#hbMagic').value='2'; $('#hbStealth').checked=true; $('#hbStr').value='15';
  submit(); await wait(30);
  console.log('tras armadura: CA', D().ac, '|', D().acNote, '| err', $('#hbErr').hidden ? '-' : $('#hbErr').textContent);
  // 2) objeto mágico: anillo +1 salvaciones, guanteletes Fue 19 (otro), resistencia fuego, +1 conjuros
  click($('[data-act="hbnew"]')); await wait(20); click($('#hbKinds [data-v="item"]')); await wait(10);
  $('#hbName').value='Anillo del Cuervo'; $('#hbSlot').value='acc'; $('#hbSlot').dispatchEvent(new w.Event('change',{bubbles:true}));
  $('#hbBSave').value='1'; $('#hbBSpell').value='1'; $('#hbSetAb').value='str'; $('#hbSetVal').value='19'; [...d.querySelectorAll('#hbResist input')].find(i=>i.value==='F').checked=true; $('#hbAttune').checked=true;
  submit(); await wait(30);
  console.log('tras anillo: Sab salv', D().save.wis, '| Fue', D().abil.str, '| CD', D().casters[0].dc, '| resist', D().resist.join(','), '| err', $('#hbErr').hidden ? '-' : $('#hbErr').textContent);
  // 3) consumible
  click($('[data-act="hbnew"]')); await wait(20); click($('#hbKinds [data-v="consumable"]')); await wait(10);
  $('#hbName').value='Elixir de Vigor'; $('#hbUse').value='Tira 4d4 + 4 y suma el resultado a tus PG.'; $('#hbQty').value='3'; submit(); await wait(30);
  const S=JSON.parse(w.localStorage.getItem('diario-v4')), its=S.chars[0].rt.items, el=its.find(i=>i.n==='Elixir de Vigor');
  console.log('elixir:', el && el.q, el && el.k, el && el.use, '| guardados en homebrew:', S.homebrew.map(h=>h.kind+':'+h.name).join(', '));
  // 4) escudo +1
  click($('[data-act="hbnew"]')); await wait(20); click($('#hbKinds [data-v="shield"]')); await wait(10);
  $('#hbName').value='Égida de Ámbar'; $('#hbMagic').value='1'; submit(); await wait(30);
  console.log('tras escudo: CA', D().ac, '|', D().acNote);
  // la hoja muestra la nota de salvaciones
  click($('[data-act="tab"][data-tab="personaje"]')); await wait(20);
  console.log('nota salvaciones:', (d.querySelector('#pPersonaje .card .muted')||{}).textContent);
  console.log(errors.length?'ERRORS:\n'+errors.join('\n'):'NO ERRORS'); process.exit(errors.length?1:0);
})();
