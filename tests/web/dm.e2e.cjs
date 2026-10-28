// Un jugador y el DM: las rondas solo aparecen al empezar el combate; el DM lleva vida y estados de los enemigos
const fs = require('fs'); const path = require('path');
const { page: open, create, join, until, wait, mk } = require('./camp.cjs');
const [htmlFile, bundle] = process.argv.slice(2), html = fs.readFileSync(htmlFile, 'utf8'), lib = JSON.parse(fs.readFileSync(bundle, 'utf8')), errors = [];
(async () => {
  const { startServer } = await import(path.join(__dirname, '../../server/index.mjs'));
  const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: {} });
  const url = 'http://127.0.0.1:' + srv.port + '/';
  try {
    const A = await open(html, lib, url, 'jugador', errors, { chars: mk('ly', 'Lyra') }), M = await open(html, lib, url, 'DM', errors);
    console.log('ronda visible sin campaña:', !A.$('#roundTxt').hidden);
    const code = await create(M, 'Ogros'); await join(A, code);
    A.tab('combate'); M.tab('combate'); A.w.Diario.renderCombat(); M.w.Diario.renderCombat();
    await until(() => M.$('.sala-code') && A.$('[data-form="salainit"]'));
    console.log('DM en modo DM:', M.$('#combat').classList.contains('dm-mode'), '| ronda visible antes de empezar:', !A.$('#roundTxt').hidden);
    // agregar enemigos
    M.click(M.$('[data-act="salanpc"]')); await wait(20);
    const f = M.$('[data-form="salanpc"]'); f.querySelector('[name=name]').value = 'Ogro'; f.querySelector('[name=hp]').value = '59'; f.querySelector('[name=ac]').value = '11'; f.querySelector('[name=init]').value = '8';
    M.submit(f); await until(() => M.$$('.sala-row.npc').length === 1);
    A.$('[data-form="salainit"] [name=v]').value = '17'; A.submit(A.$('[data-form="salainit"]'));
    await until(() => M.$$('.sala-list > .sala-row').length === 2 && !M.$('.sala-sep'));
    console.log('el DM no puede seleccionar al jugador:', !M.$$('.sala-row:not(.npc) [data-act="salasel"]').length);
    M.click(M.$('[data-act="salaturn"][data-v="start"]'));
    await until(() => !A.$('#roundTxt').hidden);
    console.log('encabezado del jugador:', A.$('#roundTxt').textContent.replace(/\s+/g, ' ').trim());
    // vida y estados del enemigo
    M.click(M.$('.sala-row.npc [data-act="salanpchp"][data-v="-10"]'));
    await until(() => M.$('.sala-row.npc .sala-hp').textContent.startsWith('49'));
    M.change(M.$('.sala-row.npc [data-npccond]'), 'frightened');
    await until(() => M.$('.sala-row.npc [data-act="salacondoff"]'));
    M.change(M.$('.sala-row.npc [data-npcset="ac"]'), '13');
    await until(() => M.$('.sala-row.npc .sala-ac').textContent === '13');
    console.log('ogro para el DM:', M.$('.sala-row.npc .sala-hp').textContent, 'CA', M.$('.sala-row.npc .sala-ac').textContent, '| estados:', M.$$('.sala-row.npc .sala-conds .chip').map(c => c.textContent).join(', '));
    await until(() => A.$$('.sala-row.npc .chip').length);
    console.log('ogro para el jugador:', A.$('.sala-row.npc .sala-state').textContent, '| estados:', A.$$('.sala-row.npc .chip').map(c => c.textContent).join(', '));
    M.click(M.$('[data-act="salaend"]'));
    await until(() => A.$('#roundTxt').hidden);
    console.log('al terminar, ronda oculta:', A.$('#roundTxt').hidden);
  } catch(e){ errors.push(e.stack); }
  await srv.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO ERRORS'); process.exit(errors.length ? 1 : 0);
})();
