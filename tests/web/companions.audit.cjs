// Calcula la ficha de cada compañero de la biblioteca con personajes de prueba y lista problemas
const fs=require('fs');const {JSDOM}=require('jsdom');const {IDBFactory}=require('fake-indexeddb');
const html=fs.readFileSync('web/dist/index.html','utf8'), lib=JSON.parse(fs.readFileSync('diario-5e.json','utf8'));
(async()=>{
  const idb=new IDBFactory(); await new Promise(res=>{const r=idb.open('diario5e',2);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>{const t=r.result.transaction('kv','readwrite');t.objectStore('kv').put(lib,'lib');t.oncomplete=()=>{r.result.close();res();};};});
  const chars=[{id:'r',name:'R',level:7,base:{str:10,dex:16,con:14,int:10,wis:16,cha:8},ch:{cls:'Ranger|XPHB',race:'Human|XPHB',bg:'Sage|XPHB'},rt:{}},
    {id:'d',name:'D',level:7,base:{str:10,dex:14,con:14,int:10,wis:16,cha:8},ch:{cls:'Druid|XPHB',race:'Human|XPHB',bg:'Sage|XPHB'},rt:{}}];
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://example.org/',beforeParse(w){w.localStorage.setItem('diario-v4',JSON.stringify({v:4,chars,active:'r'}));w.indexedDB=idb;w.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});w.HTMLElement.prototype.scrollIntoView=function(){};w.Element.prototype.animate=function(){return {set onfinish(f){setTimeout(f,5)}}};}});
  await new Promise(r=>setTimeout(r,1500));
  const w=dom.window, mons=w.Lib5e.get().monster;
  const T=w.__compTest; if(!T){console.log('falta hook');process.exit(1);}
  const rows=[];
  for (const m of mons.filter(m=>m.summonedByClass||m.summonedBySpell)) {
    const ref=m.name+'|'+m.source; const c={ref, sl:m.summonedBySpellLevel}; const vs=T.variants(m); if(vs.length) c.v=vs[0];
    let st; try{ st=T.stats(c);}catch(e){ rows.push([ref,'ERROR '+e.message]); continue; }
    if(!st){ rows.push([ref,'sin ficha']); continue; }
    const issues=[]; if(!st.ac||st.ac<5) issues.push('CA '+st.ac); if(!st.hpMax||st.hpMax<2) issues.push('PG '+st.hpMax);
    if(!st.attacks.length && (m.action||[]).some(a=>/\{@atk/.test(JSON.stringify(a)))) issues.push('ataques no leídos');
    st.attacks.forEach(a=>{ if(!a.dmg||/[a-z]{3,}/i.test(a.dmg.replace(/d\d+/g,''))) issues.push('daño raro: '+a.dmg); });
    const raw=JSON.stringify(st.sub); if(/hitYourSpellAttack|summonSpellLevel|\bPB\b/.test(raw)) issues.push('quedó texto sin calcular');
    rows.push([ref, 'CA '+st.ac+' PG '+st.hpMax+(vs.length?' formas:'+vs.join('/'):'')+' atk:'+st.attacks.map(a=>a.name+' +'+a.atk+' '+a.dmg).join('; ')+(issues.length?'  <<< '+issues.join(', '):'')]);
  }
  rows.forEach(r=>console.log(r[0].padEnd(42),r[1]));
  process.exit(0);
})();
