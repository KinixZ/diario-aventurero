// Dónde se guardan las campañas para que sobrevivan a los reinicios del servidor.
//   DATABASE_URL=postgres://…   → Postgres (Neon, gratis). Es lo que usa Render.
//   DATA_DIR=./data              → archivos JSON en esa carpeta (para probar en tu laptop).
//   ninguna                      → solo en memoria: se pierde al reiniciar (pruebas).
// Cada campaña es un documento JSON; las imágenes (chat, tablero, fondos de mapa, retratos) van aparte.

import { readFile, writeFile, mkdir, rm, rename, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const SAFE = /^[A-Z0-9]{4,8}$/, SAFE_IMG = /^i[\w-]{4,24}$/;

export function createStore(env = process.env) {
  if (env.DATABASE_URL) return pgStore(env.DATABASE_URL);
  if (env.DATA_DIR) return fileStore(env.DATA_DIR);
  return memoryStore();
}

export function memoryStore() {
  const docs = new Map(), imgs = new Map();
  return {
    kind: 'memoria', durable: false,
    async init() {},
    async load(code) { const d = docs.get(code); return d ? JSON.parse(d) : null; },
    async save(code, data) { docs.set(code, JSON.stringify(data)); },
    async has(code) { return docs.has(code); },
    async putImage(code, id, type, data) { imgs.set(code + '/' + id, { type, data }); },
    async getImage(code, id) { return imgs.get(code + '/' + id) || null; },
    async delImage(code, id) { imgs.delete(code + '/' + id); },
    async close() {},
  };
}

export function fileStore(dir) {
  const cdir = join(dir, 'campanas'), idir = join(dir, 'imagenes');
  const file = (code) => { if (!SAFE.test(code)) throw new Error('bad_code'); return join(cdir, code + '.json'); };
  const img = (code, id) => { if (!SAFE.test(code) || !SAFE_IMG.test(id)) throw new Error('bad_img'); return join(idir, code, id); };
  return {
    kind: 'archivos', durable: true,
    async init() { await mkdir(cdir, { recursive: true }); await mkdir(idir, { recursive: true }); },
    async load(code) { try { return JSON.parse(await readFile(file(code), 'utf8')); } catch { return null; } },
    async save(code, data) { const f = file(code), tmp = f + '.tmp'; await writeFile(tmp, JSON.stringify(data)); await rename(tmp, f); },
    async has(code) { try { await readFile(file(code)); return true; } catch { return false; } },
    async putImage(code, id, type, data) { const f = img(code, id); await mkdir(join(idir, code), { recursive: true }); await writeFile(f, data); await writeFile(f + '.type', type); },
    async getImage(code, id) { try { const f = img(code, id); return { type: await readFile(f + '.type', 'utf8'), data: await readFile(f) }; } catch { return null; } },
    async delImage(code, id) { try { const f = img(code, id); await rm(f, { force: true }); await rm(f + '.type', { force: true }); } catch {} },
    async list() { try { return (await readdir(cdir)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)); } catch { return []; } },
    async close() {},
  };
}

export function pgStore(url) {
  let pool = null;
  const q = async (sql, args) => { if (!pool) throw new Error('store_not_ready'); return pool.query(sql, args); };
  return {
    kind: 'postgres', durable: true,
    async init() {
      const { default: pg } = await import('pg');
      pool = new pg.Pool({ connectionString: url, max: 4, idleTimeoutMillis: 30000, connectionTimeoutMillis: 15000 });
      pool.on('error', () => {}); // Neon cierra conexiones inactivas; el pool abre otras
      await q(`create table if not exists campaigns (code text primary key, data jsonb not null, updated timestamptz not null default now())`);
      await q(`create table if not exists campaign_images (code text not null, id text not null, type text not null, data bytea not null, at timestamptz not null default now(), primary key (code, id))`);
    },
    async load(code) { const r = await q('select data from campaigns where code = $1', [code]); return r.rows[0] ? r.rows[0].data : null; },
    async save(code, data) { await q('insert into campaigns (code, data, updated) values ($1, $2, now()) on conflict (code) do update set data = excluded.data, updated = now()', [code, JSON.stringify(data)]); },
    async has(code) { const r = await q('select 1 from campaigns where code = $1', [code]); return r.rowCount > 0; },
    async putImage(code, id, type, data) { await q('insert into campaign_images (code, id, type, data) values ($1, $2, $3, $4) on conflict (code, id) do update set type = excluded.type, data = excluded.data', [code, id, type, data]); },
    async getImage(code, id) { const r = await q('select type, data from campaign_images where code = $1 and id = $2', [code, id]); return r.rows[0] || null; },
    async delImage(code, id) { await q('delete from campaign_images where code = $1 and id = $2', [code, id]); },
    async close() { if (pool) await pool.end().catch(() => {}); },
  };
}
