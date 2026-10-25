// Hoja propia de compañero (Haku) y conversión de uno de la biblioteca
const fs=require('fs');const {JSDOM}=require('jsdom');const {IDBFactory}=require('fake-indexeddb');
const [html,pkg]=process.argv.slice(2), lib=JSON.parse(fs.readFileSync(pkg,'utf8')), errors=[]; const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const idb=new IDBFactory(); await new Promise(res=>{const r=idb.open('diario5e',2);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>{const t=r.result.transaction('kv','readwrite');t.objectStore('kv').put(lib,'lib');t.oncomplete=()=>{r.result.close();res();};};});
  const dom=new JSDOM(fs.readFileSync(html,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://example.org/',beforeParse(w){w.indexedDB=idb;w.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});w.HTMLElement.prototype.scrollIntoView=function(){};w.Element.prototype.animate=function(){return {set onfinish(f){setTimeout(f,5)}}};w.addEventListener('error',e=>errors.push(e.error&&e.error.stack||e.message));w.console.error=(...a)=>errors.push(a.join(' '));}});
  const w=dom.window,d=w.document,$=s=>d.querySelector(s),$$=s=>[...d.querySelectorAll(s)];
  const click=el=>{ if(!el) throw new Error('falta elemento'); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); };
  const set=(n,v)=>{ const el=$('#ceForm [name="'+n+'"]'); if(!el) throw new Error('falta campo '+n); el.value=v; };
  await wait(1500);
  click($('[data-act="compnew"]')); await wait(20);
  click($('[data-act="compblank"]')); await wait(20);
  set('name','Haku'); set('kind','Dragón feérico'); set('size','T'); set('ac','15'); set('hpMax','22'); set('sp_walk','20'); set('sp_fly','40');
  set('ab_str','6'); set('ab_dex','16'); set('ab_con','13'); set('ab_int','10'); set('ab_wis','12'); set('ab_cha','14');
  $('#ceForm [name="sv"][value="dex"]').checked=true; set('sk_perception','1'); set('sk_stealth','2');
  set('senses','visión ciega 3 m, visión en la oscuridad 18 m'); set('langs','Dracónico, Silvano (telepatía 18 m)'); set('resist','');
  const row=$('#ceAtks .ce-atk'); row.querySelector('[name=an]').value='Mordisco'; row.querySelector('[name=aab]').value='dex'; row.querySelector('[name=ad]').value='1d4 + 3'; row.querySelector('[name=at]').value='perforante';
  click($('[data-act="ceaddatk"]')); const r2=$$('#ceAtks .ce-atk')[1]; r2.querySelector('[name=an]').value='Aliento euforizante'; r2.querySelector('[name=ab2]').value='–'; r2.querySelector('[name=ad]').value='2d4'; r2.querySelector('[name=at]').value='veneno'; r2.querySelector('[name=ano]').value='cono 1,5 m, salv. Sab CD 11';
  set('traits','Aliento euforizante. Recarga 6. Las criaturas en un cono hacen salvación de Sabiduría.\nResistencia mágica. Ventaja en salvaciones contra conjuros.');
  set('notes','Le gustan las cerezas.');
  $('#ceForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true})); await wait(30);
  console.log('error:', $('#ceErr') && !$('#ceErr').hidden ? $('#ceErr').textContent : '-');
  const card=$('#pPersonaje .compc'); console.log('tarjeta:', card.querySelector('.comp-h b').textContent, '|', card.querySelector('.comp-h small').textContent, '|', card.querySelector('.comp-stats').textContent, '|', $$('#pPersonaje .comp-atk').map(e=>e.textContent).join(' / '));
  const det=card.querySelector('.comp-d'); det.open=true; det.dispatchEvent(new w.Event('toggle')); await wait(20);
  console.log('ficha:', det.querySelector('.gtext').textContent.replace(/\s+/g,' ').slice(0,300));
  // editar: subir PG máximos
  click(card.querySelector('[data-act="compedit"]')); await wait(20); set('hpMax','30'); $('#ceForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true})); await wait(30);
  console.log('tras editar PG:', $('#pPersonaje .compc .comp-stats').textContent);
  // homúnculo integrado → hoja editable
  click($('[data-act="compnew"]')); await wait(20); click($('#compList [data-act="compadd"][data-ref="Homunculus Servant|TCE"]')); await wait(30);
  const cards=$$('#pPersonaje .compc'); click(cards[1].querySelector('[data-act="compnick"]')); await wait(20); set('n','Tuerca'); $('#ceForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true})); await wait(30);
  console.log('apodo:', $$('#pPersonaje .compc')[1].querySelector('.comp-h b').textContent, '|', $$('#pPersonaje .compc')[1].querySelector('.comp-h small').textContent);
  click($$('#pPersonaje .compc')[1].querySelector('[data-act="compfork"]')); await wait(30);
  console.log('hoja convertida, nombre en editor:', $('#ceForm [name=name]').value, '| CA', $('#ceForm [name=ac]').value, '| ataques', $$('#ceAtks .ce-atk').map(r=>r.querySelector('[name=an]').value+' '+r.querySelector('[name=ab2]').value+' '+r.querySelector('[name=ad]').value).join(';'));
  click($('[data-act="closesheet"]'));
  // combate y resumen para la sala
  click($('[data-act="combat"]')); await wait(30);
  console.log('compañeros en combate:', $$('#cLeft .compc').length, '| para la sala:', JSON.stringify(w.Diario.compSummaries()));
  console.log(errors.length?'ERRORS:\n'+errors.join('\n'):'NO ERRORS'); process.exit(errors.length?1:0);
})();
