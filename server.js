process.removeAllListeners('warning'); // silence node:sqlite experimental warning

const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const compression = require('compression');
const db = require('./db.js');

const app = express();
app.use(compression());
app.use(express.json());

// index.html is served dynamically (not via express.static below) so the
// ?v= cache-busting query strings on styles.css/data.js/app.js can be
// derived automatically from each file's mtime, instead of hand-bumped
// strings that are easy to forget — see the long maxAge on the static
// middleware right below, which relies on these query strings changing
// whenever the underlying file does.
const PUBLIC_DIR = path.join(__dirname, 'public');
function assetVersion(relPath) {
  try { return String(fs.statSync(path.join(PUBLIC_DIR, relPath)).mtimeMs | 0); }
  catch (e) { return String(Date.now()); }
}
// Every page served from here gets each local script/stylesheet's ?v=
// replaced by that file's modification time, so a changed file is always
// re-fetched and an unchanged one stays cached — no hand-bumped versions.
function serveHtmlPage(file) {
  return (req, res) => {
    let html;
    try { html = fs.readFileSync(path.join(PUBLIC_DIR, file), 'utf8'); }
    catch (e) { return res.status(500).send(file + ' missing'); }
    html = html.replace(/((?:src|href)=")(\/?[\w./-]+\.(?:js|css))\?v=[^"]*(")/g,
      (m, pre, asset, post) => `${pre}/${asset.replace(/^\//, '')}?v=${assetVersion(asset.replace(/^\//, ''))}${post}`);
    res.set('Cache-Control', 'no-cache');
    res.type('html').send(html);
  };
}
// One address scheme, no .html and no #:
//   /calendar[/YYYY-MM-DD]          the calendar
//   /subjects[/<subj>[/<chapter>]]  六科 (chapter numbers start at 1)
//   /study/<subj>/<chapter>[?v=<video>&t=<tab>]  the study room
app.get(['/', /^\/(calendar|subjects)(\/[\w-]+){0,2}\/?$/], serveHtmlPage('index.html'));
app.get(/^\/study\/[\w-]+\/\d+\/?$/, serveHtmlPage('study.html'));
// old addresses
app.get('/index.html', (req, res) => res.redirect(301, '/'));
app.get('/study.html', (req, res) => {
  const q = new URLSearchParams();
  if (req.query.v) q.set('v', req.query.v);
  if (req.query.t) q.set('t', req.query.t);
  const s = String(req.query.s || 'ds').replace(/[^\w-]/g, '');
  const c = (parseInt(req.query.c, 10) || 0) + 1;
  res.redirect(301, `/study/${s}/${c}` + (q.toString() ? '?' + q : ''));
});

app.use('/vendor/katex', express.static(path.join(__dirname, 'node_modules', 'katex', 'dist'), { maxAge: '30d', etag: true }));
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules', 'three'), { maxAge: '30d', etag: true }));
// Chapter labs change often while their content is being built — always revalidate.
app.use('/lab', express.static(path.join(PUBLIC_DIR, 'lab'), { maxAge: 0, etag: true }));
app.use('/notes', express.static(path.join(PUBLIC_DIR, 'notes'), { maxAge: 0, etag: true }));
app.use('/transcripts', express.static(path.join(PUBLIC_DIR, 'transcripts'), { maxAge: 0, etag: true }));
// Assets are versioned with ?v= and cached long; HTML pages must always
// revalidate so a new ?v= reference is picked up immediately.
app.use(express.static(PUBLIC_DIR, {
  maxAge: '30d', etag: true,
  setHeaders: (res, filePath) => { if (/\.html$|(glossary|skips)\.json$/.test(filePath)) res.setHeader('Cache-Control', 'no-cache'); },
}));

const PORT = process.env.PORT || 3210;

function currentSettings() {
  return { start_date: db.getStartDate() };
}

// ── Settings ──────────────────────────────────────────────────────
app.get('/api/settings', (req, res) => {
  res.json(currentSettings());
});

app.post('/api/settings', (req, res) => {
  const { start_date } = req.body || {};
  try {
    if (start_date !== undefined) db.setStartDate(start_date);
    res.json(currentSettings());
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Task queue (foundation phase — finite content, stable task ids) ──
app.get('/api/tasks/done', (req, res) => {
  const ids = new Set(db.getDoneTaskIds());
  readStudyLog().done.forEach((d) => d && d.task_id && ids.add(String(d.task_id)));
  res.json({ done: Array.from(ids) });
});

app.get('/api/tasks/done-dates', (req, res) => {
  const dates = db.getTaskDoneDates();
  readStudyLog().done.forEach((d) => {
    if (!d || !d.task_id || !/^\d{4}-\d{2}-\d{2}$/.test(d.date || '')) return;
    const list = (dates[d.date] = dates[d.date] || []);
    if (!list.includes(String(d.task_id))) list.push(String(d.task_id));
  });
  res.json({ dates });
});

app.post('/api/tasks/:id/toggle', (req, res) => {
  const done = db.toggleTask(req.params.id);
  res.json({ done, all: db.getDoneTaskIds() });
});

app.post('/api/tasks/:id/set', (req, res) => {
  if (typeof req.body?.done !== 'boolean') return res.status(400).json({ error: 'done must be boolean' });
  db.setTaskDone(req.params.id, req.body.done);
  res.json({ done: req.body.done, all: db.getDoneTaskIds() });
});

// ── Study room: the user's own notes per chapter ───────────────────
app.get('/api/chapter-notes/:key', (req, res) => {
  res.json(db.getChapterNote(req.params.key) || { key: req.params.key, content: '', updated_at: null });
});
app.post('/api/chapter-notes/:key', (req, res) => {
  const content = String(req.body?.content ?? '').slice(0, 100000);
  db.setChapterNote(req.params.key, content);
  res.json(db.getChapterNote(req.params.key));
});

// ── Adaptive learning evidence ─────────────────────────────────────
app.get('/api/learning/evidence', (req, res) => {
  res.json({
    sessions: db.getStudySessions(),
    attempts: db.getQuizAttempts(),
    reviews: db.getReviewSchedule(),
    mastery: db.getMasteryEvidence(),
  });
});
app.post('/api/learning/session/start', (req, res) => {
  try { res.json(db.startStudySession(req.body?.task_id, req.body?.subject_id, req.body?.chapter_key, Number(req.body?.planned_minutes))); }
  catch (e) { res.status(400).json({ error:e.message }); }
});
app.post('/api/learning/session/:id/finish', (req, res) => {
  try { res.json(db.finishStudySession(Number(req.params.id), Number(req.body?.actual_minutes))); }
  catch (e) { res.status(400).json({ error:e.message }); }
});
app.delete('/api/learning/session/:id', (req, res) => {
  try { res.json({ discarded: db.discardStudySession(Number(req.params.id)) }); }
  catch (e) { res.status(400).json({ error:e.message }); }
});
app.post('/api/learning/attempt', (req, res) => {
  try { res.json(db.addQuizAttempt(req.body || {})); }
  catch (e) { res.status(400).json({ error:e.message }); }
});
app.post('/api/learning/review', (req, res) => {
  try { res.json(db.setReviewResult(req.body?.subject_id, req.body?.chapter_key, Number(req.body?.quality))); }
  catch (e) { res.status(400).json({ error:e.message }); }
});
app.get('/api/progress/export', (req, res) => {
  res.json(db.exportProgress());
});

app.post('/api/progress/import', (req, res) => {
  try {
    res.json({ ok: true, backup: db.importProgress(req.body) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Checklist (drilling/convergence — recurring daily practice) ─────
app.get('/api/checklist/:date', (req, res) => {
  res.json({ done: db.getChecklistDone(req.params.date) });
});

app.post('/api/checklist/:date/toggle', (req, res) => {
  const index = Number(req.body?.index);
  if (!Number.isInteger(index)) return res.status(400).json({ error: 'index must be an integer' });
  const done = db.toggleChecklistItem(req.params.date, index);
  res.json({ done, all: db.getChecklistDone(req.params.date) });
});

// ── Study-room state kept in the browser, mirrored here (see db.js) ──
app.get('/api/state', (req, res) => res.json(db.getClientState()));
app.put('/api/state/:key', (req, res) => {
  const ok = db.setClientState(req.params.key, req.body ? req.body.value : null);
  res.status(ok ? 200 : 400).json({ ok });
});

// ── Full-text search over notes and subtitles ──
// Built once (lazily) from public/notes and public/transcripts; each hit is
// a video id + second, so the page can open the study room right there.
let SEARCH_INDEX = null;
let KEYMAP = null;
function buildSearchIndex() {
  const rows = [];
  const read = (dir) => { try { return fs.readdirSync(path.join(PUBLIC_DIR, dir)).filter((f) => /^[\w-]{11}\.json$/.test(f)); } catch (e) { return []; } };
  for (const f of read('notes')) {
    try {
      const n = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'notes', f), 'utf8'));
      const vid = f.slice(0, -5);
      for (const sec of n.sections || []) {
        const t0 = (sec.points && sec.points[0] && sec.points[0].t) || (sec.cues && sec.cues[0]) || 0;
        rows.push({ vid, t: Math.floor(t0), text: sec.title || '', src: 'note', sec: sec.title || '', title: true });
        for (const p of sec.points || []) rows.push({ vid, t: Math.floor(p.t || t0), text: p.text || '', src: 'note', sec: sec.title || '' });
      }
    } catch (e) { /* skip a broken file */ }
  }
  for (const f of read('transcripts')) {
    try {
      const cues = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'transcripts', f), 'utf8'));
      const vid = f.slice(0, -5);
      for (const c of cues) rows.push({ vid, t: Math.floor(c[0]), text: (c[3] ? c[3] + ' ' : '') + (c[2] || ''), src: 'sub' });
    } catch (e) { /* skip */ }
  }
  for (const r of rows) r.low = r.text.toLowerCase();
  return rows;
}
// Chinese ↔ English names of the same thing, from the glossary cards (and a
// few common ones it lacks), so 「前綴樹」 finds trie and 「銀行家」 finds Banker's.
let SYNONYMS = null;
function synonyms() {
  if (SYNONYMS) return SYNONYMS;
  const map = new Map();
  const link = (a, b) => {
    a = a.trim().toLowerCase(); b = b.trim().toLowerCase();
    if (!a || !b || a === b) return;
    if (!map.has(a)) map.set(a, new Set()); if (!map.has(b)) map.set(b, new Set());
    map.get(a).add(b); map.get(b).add(a);
  };
  try {
    const g = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'glossary.json'), 'utf8'));
    for (const [k, v] of Object.entries(g)) for (const en of String(v.en || '').split(/\s*[\/／]\s*/)) link(k, en.replace(/[（(].*?[)）]/g, ''));
  } catch (e) { /* no glossary: plain search */ }
  [['前綴樹', 'trie'], ['字首樹', 'trie'], ['銀行家', "banker"], ['鴿籠', 'pigeonhole'], ['死結', 'deadlock'], ['分頁', 'paging'],
   ['快取', 'cache'], ['雜湊', 'hash'], ['堆疊', 'stack'], ['佇列', 'queue'], ['鏈結串列', 'linked list'], ['二元樹', 'binary tree'],
   ['動態規劃', 'dynamic programming'], ['貪婪', 'greedy'], ['特徵值', 'eigenvalue'], ['行列式', 'determinant'], ['生成樹', 'spanning tree'],
   ['最短路徑', 'shortest path'], ['排程', 'scheduling'], ['號誌', 'semaphore'], ['補數', "complement"], ['管線', 'pipeline'],
   ['分解', 'factorization'], ['分解', 'decomposition'], ['主定理', 'master theorem']]
    .forEach(([a, b]) => link(a, b));
  return (SYNONYMS = map);
}
const isAscii = (w) => /^[\x00-\x7f]+$/.test(w);
function termTest(w) {
  // English words match whole words only (trie ≠ retrieve); Chinese matches anywhere
  if (isAscii(w)) {
    const re = new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(s|es)?($|[^a-z0-9])');
    return (low) => re.test(low);
  }
  return (low) => low.includes(w);
}
app.get('/api/search', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase().slice(0, 60);
  if (q.length < 2) return res.json({ results: [] });
  if (!SEARCH_INDEX) SEARCH_INDEX = buildSearchIndex();
  const syn = synonyms();
  // the whole query may itself be a known term with a translation
  const whole = syn.get(q);
  // 「lu分解」 is two words: English and Chinese written together are split
  const words = q.split(/\s+/).filter(Boolean).flatMap((w) => w.match(/[\x00-\x7f]+|[^\x00-\x7f]+/g) || []);
  const groups = (whole ? [q] : words).map((w) =>
    [w].concat(Array.from(syn.get(w) || [])).map(termTest));
  const hits = [], perVid = new Map();
  for (const r of SEARCH_INDEX) {
    if (!groups.every((g) => g.some((test) => test(r.low)))) continue;
    hits.push({ r, score: 0 });
    perVid.set(r.vid, (perVid.get(r.vid) || 0) + 1);
  }
  // section titles first, then key points, then subtitles; exact phrase
  // bonus; and a lecture that keeps coming back to the term (the one that
  // teaches it) before one that mentions it in passing
  // a chapter goal that names the term (public/keymap.json) points at the
  // video parts that teach it: those come first
  const goalHit = new Map();
  try {
    if (!KEYMAP) KEYMAP = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'keymap.json'), 'utf8'));
    const tests = groups.map((g) => (low) => g.some((test) => test(low)));
    for (const ch of Object.values(KEYMAP)) for (const p of ch.points || []) {
      if (!tests.every((t) => t(String(p.point).toLowerCase()))) continue;
      for (const w of p.where || []) goalHit.set(w.video, Math.min(goalHit.get(w.video) || Infinity, w.t));
    }
  } catch (e) { /* no keymap: no goal boost */ }
  for (const h of hits) {
    const r = h.r;
    h.score = (r.title ? 3 : r.src === 'note' ? 2 : 1) + (r.low.includes(q) ? 0.5 : 0) + Math.min(2, Math.log2(1 + perVid.get(r.vid)) / 2)
      + (goalHit.has(r.vid) ? 2 : 0);
  }
  hits.sort((a, b) => b.score - a.score);
  const out = [], perVideo = new Map();
  for (const { r } of hits) {
    const k = r.vid + r.src;
    const n = perVideo.get(k) || 0;
    if (n >= (r.src === 'note' ? 3 : 2)) continue; // a few hits per video, so one video can't fill the list
    perVideo.set(k, n + 1);
    out.push({ vid: r.vid, t: r.t, text: r.text.slice(0, 140), src: r.src, sec: r.sec });
    if (out.length >= 50) break;
  }
  res.json({ results: out });
});

// ── 重啟模式（2026/9 加入）─────────────────────────────────────────
// 不看「還剩多少任務／小時」的總量，只看今天的一小步：每天最小目標會
// 隨週數慢慢加量（第 1 週 1 個番茄鐘 → 第 4 週起約 2.5 小時），並顯示
// 連續天數與最近 14 天的小格子，讓進步看得見。
const RESTART_START = '2026-09-24';
function localDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return localDate(d);
}
function restartWeek(today) {
  const diff = Math.floor((new Date(today + 'T12:00:00') - new Date(RESTART_START + 'T12:00:00')) / 86400000);
  return diff < 0 ? 0 : Math.floor(diff / 7) + 1;
}
function restartTarget(week) {
  if (week <= 1) return { minutes: 25, walk: 10, label: '讀 25 分鐘＋散步 10 分' };
  if (week === 2) return { minutes: 50, walk: 15, label: '讀 50 分鐘＋散步 15 分' };
  if (week === 3) return { minutes: 100, walk: 20, label: '讀 1 小時 40 分＋散步 20 分' };
  return { minutes: 150, walk: 20, label: '讀 2.5 小時＋散步 20 分' };
}
// 2026/9/25：網站改成純顯示。紀錄由 Claude 寫進 data/study-log.json
// （每次請求都重讀，不用重開伺服器）。格式：
// { "focus": "目前考科重點", "entries": [ { "date":"YYYY-MM-DD", "kind":"study"|"walk"|"mood",
//   "subject":"ds", "minutes":10, "what":"讀了什麼", "mood":7 } ],
//   "done": [ { "task_id":"w1-video", "date":"YYYY-MM-DD" } ] }
const STUDY_LOG_PATH = path.join(__dirname, 'data', 'study-log.json');
function readStudyLog() {
  try {
    const j = JSON.parse(fs.readFileSync(STUDY_LOG_PATH, 'utf8').replace(/^\uFEFF/, ''));
    return { focus: j.focus || '', entries: Array.isArray(j.entries) ? j.entries : [], done: Array.isArray(j.done) ? j.done : [] };
  } catch (e) {
    return { focus: '', entries: [], done: [] };
  }
}
function restartStatus() {
  const today = localDate();
  const since = addDays(today, -60);
  const logs = db.getRestartLog(since);
  const study = db.getStudyMinutesByDate(since);
  const slog = readStudyLog();
  const byDate = {};
  const get = (d) => (byDate[d] = byDate[d] || { date: d, pomodoros: 0, walk: 0, mood: null, studyMinutes: 0, items: [] });
  for (const l of logs) {
    const r = get(l.date);
    if (l.kind === 'pomodoro') { r.pomodoros += 1; r.studyMinutes += (l.minutes || 25); }
    else if (l.kind === 'walk') r.walk += (l.minutes || 10);
    else if (l.kind === 'mood') r.mood = l.mood;
  }
  for (const s of study) get(s.date).studyMinutes += s.minutes || 0;
  for (const e of slog.entries) {
    if (!e || !/^\d{4}-\d{2}-\d{2}$/.test(e.date || '') || e.date < since) continue;
    const r = get(e.date);
    const kind = e.kind || 'study';
    if (kind === 'study') {
      const m = Math.max(0, Number(e.minutes) || 0);
      r.studyMinutes += m;
      r.items.push({ subject: SUBJECT_NAMES[e.subject] || e.subject || '', what: e.what || '', minutes: m });
    } else if (kind === 'walk') r.walk += Math.max(0, Number(e.minutes) || 0);
    else if (kind === 'mood') r.mood = Number(e.mood) || null;
  }
  const didStudy = (d) => { const r = byDate[d]; return !!r && r.studyMinutes >= 20; };
  let streak = 0;
  let cursor = didStudy(today) ? today : addDays(today, -1);
  while (didStudy(cursor)) { streak += 1; cursor = addDays(cursor, -1); }
  const empty = (d) => ({ date: d, pomodoros: 0, walk: 0, mood: null, studyMinutes: 0, items: [] });
  const days = [];
  for (let i = 13; i >= 0; i--) { const d = addDays(today, -i); days.push(byDate[d] || empty(d)); }
  const week = restartWeek(today);
  const weekDays = days.slice(-7);
  return {
    start: RESTART_START, today, week, target: restartTarget(week), streak,
    todayStats: byDate[today] || empty(today),
    days, last7Studied: weekDays.filter((x) => didStudy(x.date)).length,
    last7Minutes: weekDays.reduce((s, x) => s + x.studyMinutes, 0),
    examFocus: slog.focus || '資料結構 → 演算法 → 作業系統（11/21 前）',
  };
}
app.get('/api/restart', (req, res) => res.json(restartStatus()));
app.post('/api/restart/log', (req, res) => {
  const kind = String((req.body || {}).kind || '');
  if (!['pomodoro', 'walk', 'mood'].includes(kind)) return res.status(400).json({ error: 'bad kind' });
  const minutes = kind === 'pomodoro' ? 25 : kind === 'walk' ? Math.max(1, Math.min(180, Number(req.body.minutes) || 10)) : null;
  const mood = kind === 'mood' ? Math.max(1, Math.min(10, Number(req.body.mood) || 5)) : null;
  db.addRestartLog(localDate(), kind, minutes, mood);
  res.json(restartStatus());
});
app.post('/api/restart/undo', (req, res) => {
  const kind = String((req.body || {}).kind || '');
  db.undoRestartLog(localDate(), kind);
  res.json(restartStatus());
});


app.listen(PORT, () => {
  console.log(`CSIE Prep Hub running at http://localhost:${PORT}`);
});
