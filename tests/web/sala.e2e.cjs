// Dos diarios conectados al servidor real: uno crea la campaña, el otro entra con el código, ambos tiran iniciativa
// y el segundo le hace daño al primero. Comprueba que la hoja del primero baja sus PG.
const fs = require('fs'); const path = require('path');
const { page, create, join, until, wait, mk } = require('./camp.cjs');
const [htmlFile, bundle] = process.argv.slice(2), html = fs.readFileSync(htmlFile, 'utf8'), lib = JSON.parse(fs.readFileSync(bundle, 'utf8')), errors = [];
(async () => {
  const { startServer } = await import(path.join(__dirname, '../../server/index.mjs'));
  const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: {} });
  const url = 'http://127.0.0.1:' + srv.port + '/';
  try {
    const D = await page(html, lib, url, 'DM', errors), A = await page(html, lib, url, 'A', errors, { chars: mk('ly', 'Lyra') }), B = await page(html, lib, url, 'B', errors, { chars: mk('br', 'Bram') });
    const code = await create(D, 'Mesa de prueba'); console.log('campaña creada:', code);
    await join(A, code); await join(B, code);
    A.tab('combate'); B.tab('combate'); A.w.Diario.renderCombat(); B.w.Diario.renderCombat();
    await until(() => A.$('.sala-code') && B.$('.sala-code') && A.$$('.sala-row').length === 2);
    console.log('A ve filas:', A.$$('.sala-row .sala-name b').map((e) => e.textContent).join(' | '));
    A.$('[data-form="salainit"] [name=v]').value = '18'; A.submit(A.$('[data-form="salainit"]'));
    B.$('[data-form="salainit"] [name=v]').value = '11'; B.submit(B.$('[data-form="salainit"]'));
    await until(() => B.$$('.sala-list > .sala-row').length === 2 && !B.$('.sala-sep'));
    console.log('orden en B:', B.$$('.sala-row .sala-init').map((e) => e.textContent).join(', '));
    const hp0 = A.hp();
    const rowA = B.$$('.sala-row').find((r) => r.querySelector('.sala-init').textContent === '18');
    B.click(rowA.querySelector('[data-act="salasel"]')); await wait(30);
    const f = B.$('[data-form="salaapply"]'); f.querySelector('[name=amount]').value = '9'; f.querySelector('[name=note]').value = 'Prueba';
    B.submit(f, 'damage');
    await until(() => A.hp() === hp0 - 9);
    console.log('PG de A:', hp0, '→', A.hp(), '| aviso:', A.$('#salaToast').textContent);
    await until(() => (B.$$('.sala-row').find((r) => r.querySelector('.sala-init').textContent === '18') || {}).textContent.includes(String(hp0 - 9)));
    B.click(B.$$('.sala-row').find((r) => r.querySelector('.sala-init').textContent === '18').querySelector('[data-act="salasel"]')); await wait(30);
    const f2 = B.$('[data-form="salaapply"]'); f2.querySelector('[name=cond]').value = 'prone'; B.submit(f2, 'cond+');
    await until(() => A.$('[data-act="condoff"][data-v="prone"]'));
    console.log('A tiene condición:', !!A.$('[data-act="condoff"][data-v="prone"]'), '| registro B:', B.$$('.sala-log p').map((p) => p.textContent)[0]);
    if (A.hp() !== hp0 - 9) errors.push('el daño no llegó a la hoja de A');
    // cada aparato recuerda la campaña con su rol
    const dl = JSON.parse(D.w.localStorage.getItem('diario-campanas'));
    if (!dl.list.length || dl.list[0].role !== 'dm') errors.push('el DM no quedó como DM');
    const list = JSON.parse(A.w.localStorage.getItem('diario-campanas'));
    console.log('campañas guardadas en A:', list.list.map((e) => e.code + ':' + e.role).join(', '));
    if (list.list.length !== 1 || list.active !== code) errors.push('la lista de campañas quedó mal');
  } catch (e) { errors.push(e.stack); }
  await srv.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO ERRORS'); process.exit(errors.length ? 1 : 0);
})();
