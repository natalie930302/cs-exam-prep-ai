// 清空進度和作答紀錄（看完的影片、作答紀錄、出過的題、影片看到哪）。開始日期不動。
// Backs the data up to data/ first. Every browser clears its own copy on its next load.
//   node --env-file=.env.cloud tools/reset-progress.mjs      (cloud)
//   node tools/reset-progress.mjs                             (this computer's data/prep.db)
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const db = require('../db.js');
const out = { exported_at: new Date().toISOString(), cloud: !!process.env.TURSO_DATABASE_URL };
for (const t of ['settings', 'task_done', 'client_state']) out[t] = (await db.client.execute('SELECT * FROM ' + t)).rows.map((r) => ({ ...r }));
mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
const file = new URL('../data/backup-before-reset-' + out.exported_at.replace(/[:.]/g, '-').slice(0, 19) + '.json', import.meta.url);
writeFileSync(file, JSON.stringify(out, null, 1));
console.log('備份：', decodeURIComponent(file.pathname), `（看完 ${out.task_done.length} 支、紀錄 ${out.client_state.length} 筆）`);
await db.resetProgress();
console.log('已清空');
