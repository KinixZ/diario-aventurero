// La mesa con DM y dos jugadores: chat, susurros, tiradas, tablero, pizarra y cierre de sesión
const fs = require('fs'); const path = require('path');
const { page: open, create, join, until, wait, mk } = require('./camp.cjs');
const [htmlFile, bundle] = process.argv.slice(2), html = fs.readFileSync(htmlFile, 'utf8'), lib = JSON.parse(fs.readFileSync(bundle, 'utf8')), errors = [];
(async () => {
  const { startServer } = await import(path.join(__dirname, '../../server/index.mjs'));
  const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: {} });
  const url = 'http://127.0.0.1:' + srv.port + '/';
  try {
    const M = await open(html, lib, url, 'DM', errors), A = await open(html, lib, url, 'Lyra', errors, { chars: mk('ly', 'Lyra') }), B = await open(html, lib, url, 'Bram', errors, { chars: mk('br', 'Bram') });
    console.log('pestaña inicial:', M.$('#combat').dataset.tab, '| selector visible:', !!M.$('[data-form="campnew"]'));
    const code = await create(M, 'Cripta'); await join(A, code); await join(B, code);
    // el DM empieza la sesión con título desde Inicio
    M.submit(M.fill(M.$('[data-form="campsesstart"]'), { title: 'La cripta de Vel' }));
    await until(() => B.$('.camp-pill.live'));
    for (const P of [M, A, B]) P.tab('chat');
    await until(() => A.$('#mesaChat .chat-form') && B.$('#mesaChat .chat-form') && M.$('#mesaChat .chat-form'));
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
    await until(() => A.$$('#mesaBoard .npc-card').length === 1);
    // misión principal en pergamino y una secundaria
    const quest = async (title, prio, look) => { M.click(M.$('[data-act="mesaboardnew"]')); await wait(20); const f = M.$('[data-form="mesaboard"]'); M.click(f.querySelector('[data-act="mesacat"][data-v="mision"]')); M.click(f.querySelector('[data-act="mesaprio"][data-v="' + prio + '"]')); if (look) M.click(f.querySelector('[data-act="mesalook"][data-v="' + look + '"]')); f.elements.title.value = title; M.submit(f); await wait(150); };
    await quest('Encontrar la llave', 'main', 'scroll'); await quest('Pagarle a Harbin', 'side');
    await until(() => A.$$('#mesaBoard .quest').length === 2);
    console.log('tablero de Lyra: pergamino', A.$$('.q-scroll').length, '| nota chica', A.$$('.q-note').length, '| PNJ', A.$$('.npc-card').length, '| Lyra puede editar:', !!A.$('[data-act="mesabedit"]'));
    if (A.$$('.q-scroll').length !== 1 || A.$$('.q-note').length !== 1) errors.push('las misiones no se ven como principal y secundaria');
    A.click(A.$('.q-scroll')); await wait(30); console.log('leer misión en grande:', !!A.$('.board-read .quest.big'));
    // ya no hay pestaña Pizarra: los dibujos se adjuntan al chat
    console.log('sin pestaña pizarra:', !M.$('[data-act="mesatab"][data-v="pizarra"]'));
    A.click(A.$('[data-act="mesatab"][data-v="chat"]')); await wait(20); A.click(A.$('[data-act="mesapad"]')); await wait(20);
    console.log('papel de dibujo en el chat:', !!A.$('#chatPad canvas'), '| lápiz:', !!A.$('[data-act="mesapen"]'));
    A.click(A.$('[data-act="mesapen"]')); await wait(10); console.log('grosores al tocar el lápiz:', A.$$('.pad-pop [data-act="mesaw"]').length);
    if (!A.$('#chatPad canvas') || A.$$('.pad-pop [data-act="mesaw"]').length !== 3) errors.push('el dibujo del chat no abre bien');
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
