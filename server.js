// The site's server: pages, the few APIs the pages use, and search.
// Runs locally (npm start) and on Vercel (api/index.js) with the same code.
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const compression = require('compression');
const db = require('./db.js');
const auth = require('./auth.js');
const { search } = require('./search.js');

const app = express();
app.use(compression());
app.use(express.json({ limit: '5mb' }));
// behind Vercel (one proxy hop): trust its https header for the Secure cookie
// and its client address for the OAuth endpoints' rate limits
app.set('trust proxy', 1);

// ── Login (only when SITE_PASSWORD is set; see auth.js) ──
app.get('/login', (req, res) => {
  if (auth.signedIn(req)) return res.redirect(302, '/');
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.post('/api/login', auth.login);
// Claude connector (MCP + OAuth, see mcp.js): has its own tokens, so it sits
// before the site login
require('./mcp.js').install(app);
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

// ── Full-text search over notes and subtitles (search.js) ──
app.get('/api/search', (req, res) => res.json({ results: search(req.query.q) }));

// Locally: `npm start`. On Vercel, api/index.js imports the app instead.
if (require.main === module) {
  const PORT = process.env.PORT || 3210;
  app.listen(PORT, () => console.log(`CSIE Prep Hub running at http://localhost:${PORT}`));
}
module.exports = app;
