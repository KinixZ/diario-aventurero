const fs = require('fs'); const { JSDOM } = require('jsdom'); require('fake-indexeddb/auto');
const html = fs.readFileSync(process.argv[2], 'utf8'), lib = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), errors = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
const art = {id:'art', name:'Tink', level:6, method:'array', base:{str:8,dex:14,con:14,int:16,wis:12,cha:10}, ch:{cls:'Artificer|TCE', race:'Human|XPHB', bg:'Sage|XPHB'}, rt:{}};
const mc = {id:'mc', name:'Mixto', level:11, cl:['Paladin|XPHB','Paladin|XPHB','Paladin|XPHB','Paladin|XPHB','Paladin|XPHB','Paladin|XPHB','Paladin|XPHB','Paladin|XPHB','Paladin|XPHB','Warlock|XPHB','Warlock|XPHB'], method:'array', base:{str:15,dex:10,con:14,int:8,wis:12,cha:13}, ch:{cls:'Paladin|XPHB', sub:'Oathbreaker|DMG', race:'Aasimar|XPHB', bg:'Soldier|XPHB', bgAbil:{alt:0,picks:['str','con']}}, rt:{}};
(async () => {
  await new Promise((res) => { const r = indexedDB.open('diario5e', 2); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(lib, 'lib'); t.oncomplete = () => { r.result.close(); res(); }; }; });
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) {
    w.localStorage.setItem('diario-v4', JSON.stringify({v:4, skin:'carmesi', chars:[art, mc], active:'mc', tab:'personaje', left:'personaje'}));
    w.indexedDB = indexedDB; w.matchMedia = q => ({ matches: false, addEventListener(){}, addListener(){} });
    w.addEventListener('error', e => errors.push('window error: ' + (e.error && e.error.stack || e.message))); w.console.error = (...a) => errors.push(a.join(' '));
    w.HTMLElement.prototype.scrollIntoView = function(){}; w.Element.prototype.animate = function(){ return {set onfinish(f){ setTimeout(f, 5); }}; }; } });
  const w = dom.window, d = w.document, $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
  const click = el => el ? el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })) : errors.push('missing element');
  const act = (a, x) => click(d.querySelector('[data-act="' + a + '"]' + (x || '')));
  await wait(1500);
  const R = w.Rules5e;
  const D = R.derive(JSON.parse(JSON.stringify(mc)));
  console.log('MC label:', D.clsLabel, '| multi', D.multi, '| slots', JSON.stringify(D.slots), '| pact', JSON.stringify(D.pact), '| mcCL', D.mcCasterLevel, '| HP', D.hp.max, '| pb', D.pb);
  console.log('casters:', D.casters.map(k => k.name + ' ' + k.ability + ' dc' + k.dc + ' can' + k.nCantrips + ' prep' + k.nPrepared + ' max' + k.maxLv).join(' | '));
  console.log('pending:', D.pending.map(c => c.id + '@lv' + c.lv).join(', '));
  console.log('warlock feats:', D.features.filter(f => f.cn === 'Warlock').map(f => f.name + '(' + f.level + '/' + f.clv + ')').join(', '));
  console.log('armor/weapons', D.armor.join(','), '/', D.weapon.join(','), '| req', JSON.stringify(D.mcReqs), '| lay on hands', JSON.stringify(D.resources.filter(r => /lay/.test(r.key))));
  // 2014: Paladin PHB 6 + Wizard PHB 4 => caster level 3+4 = 7
  const c14 = {level:10, cl:Array(6).fill('Paladin|PHB').concat(Array(4).fill('Wizard|PHB')), base:{str:15,dex:10,con:14,int:13,wis:12,cha:13}, ch:{cls:'Paladin|PHB', race:'Human|PHB', bg:'Soldier|PHB'}};
  const D14 = R.derive(c14); console.log('2014 pal6/wiz4 slots', JSON.stringify(D14.slots), 'mcCL', D14.mcCasterLevel, 'hp', D14.hp.perLevel.map(p => p.faces).join(''));
  // full list
  const full = JSON.parse(JSON.stringify(mc)); full.house = {allSpells:true}; const DF = R.derive(full);
  console.log('full list prepared:', DF.casters.map(k => k.name + ' ' + k.prepared.length + (k.full ? ' (lista)' : '')).join(' | '), '| pending ids', DF.pending.map(c => c.id).join(','));
  // UI: sheet head
  console.log('head:', $('#hSub').textContent);
  act('tab', '[data-tab="rasgos"]'); await wait(20);
  console.log('rasgos groups:', $$('#pRasgos .group-h').map(e => e.textContent).join(' | '));
  act('tab', '[data-tab="conjuros"]'); await wait(20);
  console.log('trios:', $$('#pConjuros .trio').length, '| toggle', !!$('[data-act="fullspells"]'));
  const tog = $(`[data-act="fullspells"]`); click(tog); await wait(30);
  console.log('cards after full list:', $$('#pConjuros .spell').length, '| search box', !!$('#spQ'));
  const q = $('#spQ'); q.value = 'cure'; q.dispatchEvent(new w.Event('input', {bubbles:true})); await wait(20);
  console.log('after search "cure":', $$('#pConjuros .spell').map(e => e.querySelector('h3').textContent).join(', '));
  // creator: add multiclass level
  act('levelup'); await wait(40);
  console.log('lvbtns:', $$('.lvbtns button').map(b => b.textContent + (b.disabled ? '(x)' : '')).join(' | '));
  // complete pending first? list
  console.log('hint:', $('#crHint').textContent);
  // Artificer + homunculus
  act('usechar', '[data-id="art"]');
  const sheetBtn = d.querySelector('[data-act="usechar"][data-id="art"]'); if (sheetBtn) click(sheetBtn); else { /* switch via state */ }
  await wait(30);
  console.log('active head:', $('#hSub').textContent);
  act('tab', '[data-tab="personaje"]'); await wait(20);
  console.log('comp banner:', ($('#pPersonaje .comp-card') || {}).textContent.slice(0, 160));
  act('compnew'); await wait(20);
  console.log('comp list first:', $$('#compList .prow b').slice(0, 5).map(e => e.textContent).join(', '));
  click(d.querySelector('#compList [data-act="compadd"][data-ref="Homunculus Servant|TCE"]')); await wait(30);
  const cc = $('#pPersonaje .compc'); console.log('comp card:', cc && cc.querySelector('.comp-stats').textContent, '|', cc && $$('#pPersonaje .comp-atk').map(e => e.textContent).join(' / '));
  act('comphp', '[data-v="-5"]'); await wait(20); console.log('after -5:', $('#pPersonaje .comp-stats').textContent);
  const det = $('#pPersonaje .comp-d'); det.open = true; det.dispatchEvent(new w.Event('toggle')); await wait(20);
  console.log('ficha text:', det.querySelector('.gtext').textContent.replace(/\s+/g, ' ').slice(0, 400));
  // EFA homunculus spell version
  act('compnew'); await wait(10); click(d.querySelector('#compList [data-act="compadd"][data-ref="Homunculus Servant|EFA"]')); await wait(30);
  const c2 = $$('#pPersonaje .compc')[1]; console.log('EFA card:', c2 && c2.querySelector('.comp-stats').textContent, '|', c2 && [...c2.querySelectorAll('.comp-atk')].map(e => e.textContent).join(' / '));
  const sel = c2.querySelector('[data-compsl]'); console.log('sl options', sel && [...sel.options].map(o => o.value).join(','));
  // steel defender from library
  act('compnew'); await wait(10); click(d.querySelector('#compList [data-act="compadd"][data-ref="Steel Defender|TCE"]')); await wait(30);
  const c3 = $$('#pPersonaje .compc')[2]; console.log('Steel Defender:', c3 && c3.querySelector('.comp-stats').textContent, '|', c3 && [...c3.querySelectorAll('.comp-atk')].map(e => e.textContent).join(' / '));
  act('combat'); await wait(30); console.log('combat comps:', $$('#cRec .compc').length);
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO ERRORS'); process.exit(0);
})().catch(e => { console.log('FAIL', e.stack, errors.join('\n')); process.exit(1); });
