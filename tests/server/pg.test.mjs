// Prueba con un Postgres real (como Neon). Solo corre si le das la dirección:
//   PG_TEST_URL=postgres://postgres@127.0.0.1:5432/postgres npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pgStore } from '../../server/store.mjs';
import { startServer } from '../../server/index.mjs';
import { client } from './helpers.mjs';

const URL = process.env.PG_TEST_URL;

test('Postgres: guardar, leer y reemplazar campañas e imágenes', { skip: !URL && 'sin PG_TEST_URL' }, async () => {
  const s = pgStore(URL); await s.init(); await s.init(); // crear las tablas dos veces no falla
  try {
    const code = 'TSTPGA';
    await s.save(code, { code, name: 'Prueba', n: 1, deep: { a: [1, 2, 3] } });
    await s.save(code, { code, name: 'Prueba 2', n: 2 });
    assert.deepEqual(await s.load(code), { code, name: 'Prueba 2', n: 2 });
    assert.equal(await s.has(code), true); assert.equal(await s.has('NADANA'), false); assert.equal(await s.load('NADANA'), null);
    const data = Buffer.from([0, 1, 2, 250, 255]);
    await s.putImage(code, 'iprueba1', 'image/png', data);
    const im = await s.getImage(code, 'iprueba1'); assert.equal(im.type, 'image/png'); assert.deepEqual(Buffer.from(im.data), data);
    await s.delImage(code, 'iprueba1'); assert.equal(await s.getImage(code, 'iprueba1'), null);
  } finally { await s.close(); }
});

test('Postgres: el servidor recuerda la campaña después de reiniciar', { skip: !URL && 'sin PG_TEST_URL' }, async () => {
  let srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: { DATABASE_URL: URL } });
  const dm = client(srv.port); await dm.open;
  dm.send({ t: 'camp.create', name: 'Neon', dmKey: 'llave' });
  const j = await dm.next('joined'); assert.equal(j.durable, true);
  dm.send({ t: 'board.add', item: { cat: 'mision', title: 'Encontrar la forja' } }); await dm.next('state', (m) => m.room.board.length === 1);
  dm.ws.close(); await srv.close();
  srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, env: { DATABASE_URL: URL } });
  try {
    assert.equal((await (await fetch(`http://127.0.0.1:${srv.port}/health`)).json()).store, 'postgres');
    const again = client(srv.port); await again.open;
    again.send({ t: 'join', code: j.code, dmKey: 'llave' });
    await again.next('joined');
    const st = await again.next('state'); assert.equal(st.room.board[0].title, 'Encontrar la forja'); assert.equal(st.room.name, 'Neon');
    again.ws.close();
  } finally { await srv.close(); }
});
