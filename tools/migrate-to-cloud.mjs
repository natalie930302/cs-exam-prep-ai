// Copy this computer's progress (data/prep.db) into the cloud database.
//
//   vercel env pull .env.cloud          (writes TURSO_DATABASE_URL / TURSO_AUTH_TOKEN)
//   node --env-file=.env.cloud tools/migrate-to-cloud.mjs
//
// Copies the three tables the site uses: settings (start date), task_done
// (finished videos) and client_state (quiz history, asked quizzes, video
// positions). Rows already in the cloud with the same key are overwritten by
// the local copy; nothing in the cloud is deleted. Safe to run again.
import { createClient } from '@libsql/client';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(ROOT, 'data/prep.db');
if (!process.env.TURSO_DATABASE_URL) {
  console.error('沒有 TURSO_DATABASE_URL：先執行 vercel env pull .env.cloud，再用 node --env-file=.env.cloud 執行這個檔案');
  process.exit(1);
}
if (!existsSync(file)) { console.error('找不到 ' + file); process.exit(1); }

const local = createClient({ url: 'file:' + file });
const cloud = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

await cloud.batch([
  'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)',
  "CREATE TABLE IF NOT EXISTS task_done (task_id TEXT PRIMARY KEY, done_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS client_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
], 'write');

const tables = {
  settings: ['key', 'value'],
  task_done: ['task_id', 'done_at'],
  client_state: ['key', 'value', 'updated_at'],
};
for (const [table, cols] of Object.entries(tables)) {
  const rows = (await local.execute(`SELECT ${cols.join(', ')} FROM ${table}`)).rows;
  const sql = `INSERT OR REPLACE INTO ${table}(${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
  for (let i = 0; i < rows.length; i += 100) {
    await cloud.batch(rows.slice(i, i + 100).map((r) => ({ sql, args: cols.map((c) => r[c]) })), 'write');
  }
  const n = (await cloud.execute(`SELECT count(*) AS n FROM ${table}`)).rows[0].n;
  console.log(`${table}：本機 ${rows.length} 筆 → 雲端現在 ${n} 筆`);
}
console.log('完成');
