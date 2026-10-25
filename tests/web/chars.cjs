// Exportar e importar personajes entre dos diarios
const fs=require('fs');const {JSDOM}=require('jsdom');const {IDBFactory}=require('fake-indexeddb');
const [html,pkg]=process.argv.slice(2), lib=JSON.parse(fs.readFileSync(pkg,'utf8')), errors=[]; const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function page(){ const idb=new IDBFactory(); await new Promise(res=>{const r=idb.open('diario5e',2);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>{const t=r.result.transaction('kv','readwrite');t.objectStore('kv').put(lib,'lib');t.oncomplete=()=>{r.result.close();res();};};});
  const d=new JSDOM(fs.readFileSync(html,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://example.org/',beforeParse(w){w.indexedDB=idb;w.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});w.HTMLElement.prototype.scrollIntoView=function(){};w.Element.prototype.animate=function(){return {set onfinish(f){setTimeout(f,5)}}};w.URL.createObjectURL=()=>'blob:x';w.URL.revokeObjectURL=()=>{};w.addEventListener('error',e=>errors.push(e.message));w.console.error=(...a)=>errors.push(a.join(' '));}});
  await wait(1200); return d.window; }
(async()=>{
  const A=await page(), B=await page();
  // A: renombrar el ejemplo y exportar
  A.document.querySelector('[data-act="settings"]').dispatchEvent(new A.MouseEvent('click',{bubbles:true})); await wait(30);
  A.document.querySelector('[data-act="charexport"]').dispatchEvent(new A.MouseEvent('click',{bubbles:true})); await wait(30);
  const txt=A.document.querySelector('#charText').value; console.log('export msg:', A.document.querySelector('#charMsg').textContent.slice(0,80), '| bytes', txt.length);
  const inp=B.document.querySelector('#charIn'); Object.defineProperty(inp,'files',{value:[new B.File([txt],'personajes-diario.json')],configurable:true}); inp.dispatchEvent(new B.Event('change',{bubbles:true})); await wait(200);
  console.log('import msg:', B.document.querySelector('#charMsg').textContent, '| chars in B:', JSON.parse(B.localStorage.getItem('diario-v4')).chars.map(c=>c.name).join(', '));
  if(!/actualizado|nuevo/.test(B.document.querySelector('#charMsg').textContent)) errors.push('no importó');
  console.log(errors.length?'ERRORS '+errors.join('\n'):'NO ERRORS'); process.exit(0);
})();
