const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const h=fs.readFileSync(process.argv[2],'utf8'), txt=fs.readFileSync(process.argv[3],'utf8'), errors=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
const d=new JSDOM(h,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://example.org/',beforeParse(w){w.indexedDB=indexedDB;w.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});w.HTMLElement.prototype.scrollIntoView=function(){};w.Element.prototype.animate=function(){return {set onfinish(f){setTimeout(f,5)}}};w.addEventListener('error',e=>errors.push(e.message));w.console.error=(...a)=>errors.push(a.join(' '));}});
const w=d.window,$=s=>w.document.querySelector(s); await wait(800);
w.document.querySelector('[data-act="settings"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await wait(50);
console.log('dir pick hidden on phone:', $('#dirPick').hidden);
async function pick(name, content, type){ const inp=$('#fileIn'); const f=new w.File([content], name, {type}); Object.defineProperty(inp,'files',{value:[f],configurable:true}); inp.dispatchEvent(new w.Event('change',{bubbles:true})); for(let i=0;i<60;i++){ await wait(100); if(!/Leyendo|Revisando|Guardando/.test($('#libProgress').textContent)) break; } console.log(name,'→',$('#libProgress').textContent); }
await pick('foto.jpg','xx','image/jpeg');
await pick('diario-5e.json', txt.slice(0, 50000), 'application/octet-stream');
await pick('diario-5e.json.txt', txt, 'text/plain');
console.log('lib rows:', w.document.querySelectorAll('#libTable tr').length, '| head:', $('#hSub').textContent);
console.log(errors.length?'ERRORS '+errors.join('\n'):'NO ERRORS'); process.exit(0);
})();
