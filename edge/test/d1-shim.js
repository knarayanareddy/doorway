/**
 * A D1-compatible wrapper over node:sqlite, so the REAL edge Worker and the REAL
 * schema.sql run in tests and in the local dev server. D1 is SQLite; this keeps the
 * SQL honest without a Cloudflare account. Test/dev only.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

export function createDb({ schema = new URL('../schema.sql', import.meta.url) } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync(schema, 'utf8'));
  const log = [];
  const d1 = {
    log,
    raw: db,
    prepare(sql) {
      return {
        bind(...args) {
          const st = db.prepare(sql);
          return {
            async first() { log.push(sql); return st.get(...args) ?? null; },
            async run() { log.push(sql); const r = st.run(...args); return { success: true, meta: r }; },
            async all() { log.push(sql); return { results: st.all(...args) }; },
          };
        },
      };
    },
  };
  return d1;
}

export async function sha256hex(s) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))]
    .map((b) => b.toString(16).padStart(2, '0')).join('');
}
