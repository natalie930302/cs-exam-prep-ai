// SQLite through libSQL: the same code opens the local file (data/prep.db)
// or, in the cloud, a Turso database (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN).
// Every call is async.
//
// Only the tables the site still uses are touched: settings (start date),
// task_done (which videos are finished) and client_state (the study room's
// quiz history, asked quizzes and video positions). Older tables from removed
// features stay in the database untouched.
const path = require('node:path');
const fs = require('node:fs');
const { createClient } = require('@libsql/client');

function localUrl() {
  const dir = process.env.CSIE_DATA_DIR ? path.resolve(process.env.CSIE_DATA_DIR) : path.join(__dirname, 'data');
  fs.mkdirSync(dir, { recursive: true });
  return 'file:' + path.join(dir, 'prep.db');
}
const client = createClient(process.env.TURSO_DATABASE_URL
  ? { url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN }
  : { url: localUrl() });

const ready = client.batch([
  'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)',
  "CREATE TABLE IF NOT EXISTS task_done (task_id TEXT PRIMARY KEY, done_at TEXT NOT NULL DEFAULT (datetime('now')))",
  // study-room state the browser keeps (quiz answer history, which quizzes
  // were asked, where each video was left off), so it survives clearing the
  // browser and is the same on every device
  "CREATE TABLE IF NOT EXISTS client_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
], 'write');
async function run(sql, args = []) { await ready; return client.execute({ sql, args }); }

const CLIENT_KEY = /^(qz-history|qz-asked-[\w-]+|yt-pos-[\w-]+)$/;
async function getClientState() {
  const out = {};
  for (const r of (await run('SELECT key, value FROM client_state')).rows) out[r.key] = r.value;
  return out;
}
async function setClientState(key, value) {
  if (!CLIENT_KEY.test(key)) return false;
  if (value == null) await run('DELETE FROM client_state WHERE key = ?', [key]);
  else await run("INSERT INTO client_state(key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at", [key, String(value).slice(0, 2000000)]);
  return true;
}

async function getStartDate() {
  const row = (await run("SELECT value FROM settings WHERE key = 'start_date'")).rows[0];
  return row ? row.value : new Date().toISOString().slice(0, 10);
}
async function setStartDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw new Error('invalid date format, expected YYYY-MM-DD');
  await run("INSERT INTO settings(key, value) VALUES ('start_date', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [dateStr]);
}

// Finished videos, keyed by stable task id ("vid-<youtube id>", "w<N>-video").
async function getDoneTaskIds() {
  return (await run('SELECT task_id FROM task_done')).rows.map((r) => r.task_id);
}
async function toggleTask(taskId) {
  if ((await run('SELECT 1 FROM task_done WHERE task_id = ?', [taskId])).rows.length) {
    await run('DELETE FROM task_done WHERE task_id = ?', [taskId]);
    return false;
  }
  await run('INSERT INTO task_done(task_id) VALUES (?)', [taskId]);
  return true;
}
async function setTaskDone(taskId, done) {
  if (done) await run('INSERT OR IGNORE INTO task_done(task_id) VALUES (?)', [taskId]);
  else await run('DELETE FROM task_done WHERE task_id = ?', [taskId]);
}

module.exports = { client, getClientState, setClientState, getStartDate, setStartDate, getDoneTaskIds, toggleTask, setTaskDone };
