// The site's server: pages, the few APIs the pages use, and search.
// Runs locally (npm start) and on Vercel (api/index.js) with the same code.
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const compression = require('compression');
const db = require('./db.js');
const auth = require('./auth.js');

const app = express();
app.use(compression());
app.use(express.json({ limit: '5mb' }));
// behind Vercel / a proxy: trust its https header for the Secure cookie
app.set('trust proxy', true);

// ── Login (only when SITE_PASSWORD is set; see auth.js) ──
app.get('/login', (req, res) => {
  if (auth.signedIn(req)) return res.redirect(302, '/');
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.post('/api/login', auth.login);
app.use(auth.requireLogin);

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


// three.js for the labs: locally straight from node_modules; the cloud build
// copies the few files the labs import into public/vendor (tools/build.mjs).
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

// async route: a failed database call answers 500 instead of crashing
const route = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  console.error(e);
  if (!res.headersSent) res.status(500).json({ error: '伺服器錯誤：' + e.message });
});

// ── Settings ──
app.get('/api/settings', route(async (req, res) => res.json({ start_date: await db.getStartDate() })));
app.post('/api/settings', route(async (req, res) => {
  const { start_date } = req.body || {};
  try { if (start_date !== undefined) await db.setStartDate(start_date); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  res.json({ start_date: await db.getStartDate() });
}));

// ── Finished videos (stable task ids: vid-<youtube id>, w<N>-video) ──
app.get('/api/tasks/done', route(async (req, res) => res.json({ done: await db.getDoneTaskIds() })));
app.post('/api/tasks/:id/toggle', route(async (req, res) => {
  const done = await db.toggleTask(req.params.id);
  res.json({ done, all: await db.getDoneTaskIds() });
}));
app.post('/api/tasks/:id/set', route(async (req, res) => {
  if (typeof req.body?.done !== 'boolean') return res.status(400).json({ error: 'done must be boolean' });
  await db.setTaskDone(req.params.id, req.body.done);
  res.json({ done: req.body.done, all: await db.getDoneTaskIds() });
}));

// ── Study-room state kept in the browser, mirrored here (see db.js) ──
app.get('/api/state', route(async (req, res) => res.json(await db.getClientState())));
app.put('/api/state/:key', route(async (req, res) => {
  const ok = await db.setClientState(req.params.key, req.body ? req.body.value : null);
  res.status(ok ? 200 : 400).json({ ok });
}));

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

// Locally: `npm start`. On Vercel, api/index.js imports the app instead.
if (require.main === module) {
  const PORT = process.env.PORT || 3210;
  app.listen(PORT, () => console.log(`CSIE Prep Hub running at http://localhost:${PORT}`));
}
module.exports = app;
