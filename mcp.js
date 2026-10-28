// Claude connector: an MCP server at /mcp, with OAuth so Claude can connect
// the same way it connects to other services. Connecting opens a page that
// asks for the site password (SITE_PASSWORD); Claude then gets its own token
// and never sees the password. Clients, codes and tokens live in the
// database because on Vercel every request may run on a fresh machine.
//
// Tools: progress, a chapter's videos, search, a video's notes and quiz,
// subtitles, quiz answer history (read-only) and marking a video finished.
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const { z } = require('zod');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } = require('@modelcontextprotocol/sdk/server/auth/router.js');
const { requireBearerAuth } = require('@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js');
const { InvalidGrantError, InvalidTokenError } = require('@modelcontextprotocol/sdk/server/auth/errors.js');
const db = require('./db.js');
const auth = require('./auth.js');
const course = require('./course.js');
const { search } = require('./search.js');

const PUBLIC_DIR = path.join(__dirname, 'public');
const BASE = (process.env.PUBLIC_URL || 'https://csie-study.anting.uk').replace(/\/$/, '');
const ACCESS_TTL = 24 * 3600, REFRESH_TTL = 180 * 86400, CODE_TTL = 600;

// ───────────────────────── OAuth storage ─────────────────────────
const sql = db.client;
const ready = sql.batch([
  "CREATE TABLE IF NOT EXISTS oauth_clients (client_id TEXT PRIMARY KEY, info TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  'CREATE TABLE IF NOT EXISTS oauth_codes (code TEXT PRIMARY KEY, client_id TEXT NOT NULL, challenge TEXT NOT NULL, redirect_uri TEXT NOT NULL, resource TEXT, scopes TEXT, expires INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS oauth_tokens (hash TEXT PRIMARY KEY, kind TEXT NOT NULL, client_id TEXT NOT NULL, resource TEXT, scopes TEXT, expires INTEGER NOT NULL)',
], 'write').then(async () => {
  // tokens remember which site password they were granted under (added later: older rows have none)
  const cols = (await sql.execute('PRAGMA table_info(oauth_tokens)')).rows.map((r) => r.name);
  if (!cols.includes('pw')) await sql.execute('ALTER TABLE oauth_tokens ADD COLUMN pw TEXT');
});
// changing SITE_PASSWORD signs every connected Claude out, like the site login
const pwMark = () => crypto.createHash('sha256').update('csie-mcp:' + (process.env.SITE_PASSWORD || '')).digest('hex').slice(0, 16);
const pwOk = (r) => r.pw == null || r.pw === pwMark();
const q = async (s, args = []) => { await ready; return (await sql.execute({ sql: s, args })).rows; };
const now = () => Math.floor(Date.now() / 1000);
const random = () => crypto.randomBytes(32).toString('base64url');
const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');

const clientsStore = {
  async getClient(id) {
    const r = (await q('SELECT info FROM oauth_clients WHERE client_id = ?', [id]))[0];
    return r ? JSON.parse(r.info) : undefined;
  },
  async registerClient(client) {
    const full = { ...client, client_id: crypto.randomUUID(), client_id_issued_at: now() };
    await q('INSERT INTO oauth_clients(client_id, info) VALUES (?, ?)', [full.client_id, JSON.stringify(full)]);
    return full;
  },
};

async function issueTokens(clientId, resource, scopes) {
  const access = random(), refresh = random();
  await q('DELETE FROM oauth_tokens WHERE expires < ?', [now()]);
  const ins = 'INSERT INTO oauth_tokens(hash, kind, client_id, resource, scopes, expires, pw) VALUES (?, ?, ?, ?, ?, ?, ?)';
  await q(ins, [hash(access), 'access', clientId, resource || null, scopes.join(' '), now() + ACCESS_TTL, pwMark()]);
  await q(ins, [hash(refresh), 'refresh', clientId, resource || null, scopes.join(' '), now() + REFRESH_TTL, pwMark()]);
  return { access_token: access, token_type: 'bearer', expires_in: ACCESS_TTL, refresh_token: refresh, scope: scopes.join(' ') || undefined };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function consentPage(req, client, error) {
  const fields = req.method === 'POST' ? req.body : req.query;
  const hidden = Object.entries(fields || {}).filter(([k]) => !['password', 'approve'].includes(k))
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('');
  // already signed in to the site (or no password locally): one click is enough
  const signedIn = auth.signedIn(req);
  const name = client.client_name || 'Claude';
  return `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>連接 ${esc(name)}｜資工所備考中心</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/theme.css">
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; box-sizing: border-box; background: var(--bg); color: var(--tx); font-family: var(--font); }
  form { width: min(380px, 100%); background: var(--surf); border: 1px solid var(--bd); border-radius: 20px; padding: 24px 16px; box-sizing: border-box; display: grid; gap: 16px; animation: m-in .22s cubic-bezier(.2,.8,.2,1) both; }
  h1 { margin: 0; font-size: 18px; line-height: 1.3; }
  p, li { margin: 0; font-size: 13px; line-height: 1.6; color: var(--mt2); }
  ul { margin: 0; padding-left: 20px; display: grid; gap: 4px; }
  input[type=password] { font: inherit; font-size: 16px; padding: 10px 12px; border: 1px solid var(--bd2); border-radius: 10px; background: var(--surf); color: var(--tx); outline: none; transition: border-color .16s ease; }
  input[type=password]:focus { border-color: var(--ac); }
  button { font: inherit; font-size: 14px; font-weight: 700; padding: 10px 12px; border: 0; border-radius: 10px; background: var(--ac); color: var(--on-ac); cursor: pointer; transition: filter .16s ease; }
  button:hover { filter: brightness(1.06); }
  button:active { scale: .97; }
  .err { color: var(--red); font-size: 13px; margin-top: -8px; }
</style></head><body>
<form method="POST" action="/authorize">
  <h1>讓 ${esc(name)} 連接資工所備考中心</h1>
  <p>連接後，${esc(name)} 可以：</p>
  <ul><li>看你的讀書進度、每章的影片</li><li>搜尋與讀取筆記、字幕、測驗</li><li>看你的作答紀錄（哪些題答錯）</li><li>在你要求時，把影片標成看完</li></ul>
  ${hidden}
  ${signedIn ? '<input type="hidden" name="approve" value="1">' : '<input name="password" type="password" autocomplete="current-password" aria-label="網站密碼" placeholder="網站密碼" required autofocus>'}
  <button type="submit">允許連接</button>
  ${error ? `<div class="err" role="alert">${esc(error)}</div>` : ''}
</form></body></html>`;
}

const provider = {
  clientsStore,
  async authorize(client, params, res) {
    const req = res.req;
    const given = req.method === 'POST' ? String((req.body || {}).password || '') : '';
    const pw = process.env.SITE_PASSWORD || '';
    const byCookie = req.method === 'POST' && (req.body || {}).approve === '1' && auth.signedIn(req);
    const byPassword = !!given && !!pw && crypto.timingSafeEqual(crypto.createHash('sha256').update(given).digest(), crypto.createHash('sha256').update(pw).digest());
    // locally (no SITE_PASSWORD) the server is not public: one click is enough
    const open = !pw && req.method === 'POST' && (req.body || {}).approve === '1';
    if (!byCookie && !byPassword && !open) {
      if (given) await new Promise((r) => setTimeout(r, 800));
      res.set('Cache-Control', 'no-store').type('html').send(consentPage(req, client, given ? '密碼不對' : ''));
      return;
    }
    const code = random();
    await q('DELETE FROM oauth_codes WHERE expires < ?', [now()]);
    await q('INSERT INTO oauth_codes VALUES (?, ?, ?, ?, ?, ?, ?)', [hash(code), client.client_id, params.codeChallenge, params.redirectUri,
      params.resource ? params.resource.href : null, (params.scopes || []).join(' '), now() + CODE_TTL]);
    const to = new URL(params.redirectUri);
    to.searchParams.set('code', code);
    if (params.state !== undefined) to.searchParams.set('state', params.state);
    res.redirect(302, to.href);
  },
  async challengeForAuthorizationCode(client, code) {
    const r = (await q('SELECT challenge FROM oauth_codes WHERE code = ? AND client_id = ? AND expires >= ?', [hash(code), client.client_id, now()]))[0];
    if (!r) throw new InvalidGrantError('授權碼無效或已過期');
    return r.challenge;
  },
  async exchangeAuthorizationCode(client, code, verifier, redirectUri) {
    const r = (await q('SELECT * FROM oauth_codes WHERE code = ? AND client_id = ? AND expires >= ?', [hash(code), client.client_id, now()]))[0];
    if (!r) throw new InvalidGrantError('授權碼無效或已過期');
    if (redirectUri && redirectUri !== r.redirect_uri) throw new InvalidGrantError('redirect_uri 不符');
    await q('DELETE FROM oauth_codes WHERE code = ?', [hash(code)]); // one use only
    return issueTokens(client.client_id, r.resource, r.scopes ? r.scopes.split(' ') : []);
  },
  async exchangeRefreshToken(client, refresh) {
    const r = (await q("SELECT * FROM oauth_tokens WHERE hash = ? AND kind = 'refresh' AND client_id = ? AND expires >= ?", [hash(refresh), client.client_id, now()]))[0];
    if (!r || !pwOk(r)) throw new InvalidGrantError('refresh token 無效或已過期（或網站密碼已更換）');
    await q('DELETE FROM oauth_tokens WHERE hash = ?', [hash(refresh)]); // rotate
    return issueTokens(client.client_id, r.resource, r.scopes ? r.scopes.split(' ') : []);
  },
  async verifyAccessToken(token) {
    const r = (await q("SELECT * FROM oauth_tokens WHERE hash = ? AND kind = 'access'", [hash(token)]))[0];
    // (this message goes into a WWW-Authenticate header: ASCII only)
    if (!r || r.expires < now() || !pwOk(r)) throw new InvalidTokenError('Invalid or expired token');
    return { token, clientId: r.client_id, scopes: r.scopes ? r.scopes.split(' ') : [], expiresAt: Number(r.expires), resource: r.resource ? new URL(r.resource) : undefined };
  },
  async revokeToken(client, { token }) {
    await q('DELETE FROM oauth_tokens WHERE hash = ? AND client_id = ?', [hash(token), client.client_id]);
  },
};

// ───────────────────────── tools ─────────────────────────
const link = (v, at) => `${BASE}/study/${v.subject}/${v.chapter}?v=${v.id}${at ? '&at=' + Math.floor(at) : ''}`;
const mmss = (t) => { t = Math.floor(t); const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };
const hours = (sec) => Math.round(sec / 360) / 10;
const json = (o) => ({ content: [{ type: 'text', text: JSON.stringify(o, null, 1) }] });
const fail = (msg) => ({ content: [{ type: 'text', text: msg }], isError: true });
const readJson = (rel) => { try { return JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, rel), 'utf8')); } catch (e) { return null; } };
const SUBJECT_IDS = course.subjects.map((s) => s.id);
const subjectArg = z.enum(SUBJECT_IDS).describe('科目：' + course.subjects.map((s) => s.id + '=' + s.name).join('、'));
const videoArg = z.string().regex(/^[\w-]{11}$/).describe('YouTube 影片 id（11 個字元，其他工具的結果裡都有）');
const READ = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

async function doneSet() { return new Set(await db.getDoneTaskIds()); }
async function quizHistory() {
  try { return JSON.parse((await db.getClientState())['qz-history'] || '[]'); } catch (e) { return []; }
}

function buildServer() {
  const server = new McpServer({ name: '資工所備考中心', version: '1.0.0' }, {
    instructions: '使用者準備台灣資工所考試（資料結構、演算法、作業系統、線性代數、離散數學、計算機組織）。'
      + '每章有一串課程影片，每支影片有重點筆記、字幕和測驗。回答時盡量附上學習空間的連結（link 欄位，點了會從那個時間點開始播）。'
      + '想知道某個主題在哪裡教，先用 search_materials；要複習或出題，用 get_video_notes 的筆記和測驗。',
  });

  server.registerTool('get_progress', {
    title: '讀書進度',
    description: '各科、各章看完了幾支影片、還剩幾小時。給 subject 就只看那一科（列出每章）。',
    inputSchema: { subject: subjectArg.optional() },
    annotations: READ,
  }, async ({ subject }) => {
    const done = await doneSet();
    const out = course.subjects.filter((s) => !subject || s.id === subject).map((s) => {
      const chapters = s.chapters.map((c) => {
        const left = c.videos.filter((v) => !done.has('vid-' + v.id));
        return { chapter: c.n, title: c.title, priority: c.priority, videos: c.videos.length, done: c.videos.length - left.length,
          hours_left: hours(left.reduce((a, v) => a + v.seconds, 0)), next_video: left[0] ? { id: left[0].id, title: left[0].title } : null };
      });
      const total = chapters.reduce((a, c) => a + c.videos, 0), fin = chapters.reduce((a, c) => a + c.done, 0);
      return { subject: s.id, name: s.name, videos: total, done: fin, hours_left: Math.round(chapters.reduce((a, c) => a + c.hours_left, 0) * 10) / 10,
        chapters: subject ? chapters : undefined };
    });
    return json(subject ? out[0] : { subjects: out, note: '給 subject 可以看每一章' });
  });

  server.registerTool('get_today_plan', {
    title: '今天要看的影片',
    description: '日曆排給某一天的影片（和網站日曆同一套排法：依週次、科目、章節順序，週二到週六每天 6 小時，週日休息、週一打工）。不給 date 就是今天（台灣時間）。',
    inputSchema: { date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('YYYY-MM-DD') },
    annotations: READ,
  }, async ({ date }) => {
    const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);   // Asia/Taipei
    date = date || today;
    if (date < today) return fail('只能查今天以後的日子');
    const done = await doneSet(), state = await db.getClientState();
    // the unwatched videos in queue order, minus where each was left off (as the calendar does)
    const queue = [], seen = new Set();
    for (let wk = 1; wk <= 19; wk++) for (const s of course.subjects) for (const c of s.chapters) {
      if (c.week !== wk) continue;
      c.videos.forEach((v, vi) => {
        if (done.has('vid-' + v.id) || seen.has(v.id)) return;
        seen.add(v.id);
        let pos = Number(state['yt-pos-' + v.id]) || 0;
        if (pos < 30 || pos >= v.seconds - 30) pos = 0;
        queue.push({ v: { ...v, subject: s.id, chapter: c.n }, s, c, vi, start: pos / 60, min: Math.max(1, (v.seconds - pos) / 60) });
      });
    }
    const CAP = { 0: 0, 1: 0, 2: 6, 3: 6, 4: 6, 5: 6, 6: 6 };
    const day = new Date(today + 'T12:00:00Z');
    let i = 0, used = 0;
    for (let guard = 0; guard < 800; guard++) {
      const iso = day.toISOString().slice(0, 10), dow = day.getUTCDay();
      let cap = CAP[dow] * 60;
      const items = [];
      let minutes = 0;
      while (cap > 0 && i < queue.length) {
        const x = queue[i], left = x.min - used, take = Math.min(left, cap), from = x.start + used;
        items.push({ subject: x.s.name, chapter: x.c.n, chapter_title: x.c.title, video: `${x.vi + 1}/${x.c.videos.length}`,
          id: x.v.id, title: x.v.title, teacher: x.v.teacher, duration: x.v.duration,
          watch: (from > 0 ? `從 ${Math.round(from)} 分處接著看` : '從頭看') + (take < left ? `到 ${Math.round(from + take)} 分處，剩下的下一個讀書日看` : '到結束'),
          link: link(x.v, from * 60) });
        cap -= take; used += take; minutes += take;
        if (used >= x.min) { i++; used = 0; }
      }
      if (iso === date) {
        const kind = dow === 0 ? '休息日' : dow === 1 ? '打工日' : items.length ? '讀書日' : '影片都看完了：做歷屆試題';
        return json({ date, kind, minutes: Math.round(minutes), videos: items, videos_left_in_course: queue.length });
      }
      day.setUTCDate(day.getUTCDate() + 1);
    }
    return fail('那天太遠了，排不到');
  });

  server.registerTool('list_chapter_videos', {
    title: '一章的影片',
    description: '某科某章的所有影片（照上課順序）：標題、老師、長度、看完沒、學習空間連結。',
    inputSchema: { subject: subjectArg, chapter: z.number().int().min(1).describe('第幾章（從 1 開始）') },
    annotations: READ,
  }, async ({ subject, chapter }) => {
    const s = course.subjects.find((x) => x.id === subject);
    const c = s && s.chapters[chapter - 1];
    if (!c) return fail(`${s ? s.name : subject} 沒有第 ${chapter} 章（共 ${s ? s.chapters.length : 0} 章）`);
    const done = await doneSet();
    return json({ subject: s.name, chapter: c.n, title: c.title, topics: c.topics, chapters_in_subject: s.chapters.map((x) => x.n + '. ' + x.title),
      videos: c.videos.map((v) => ({ id: v.id, title: v.title, teacher: v.teacher, duration: v.duration, done: done.has('vid-' + v.id),
        link: link({ ...v, subject: s.id, chapter: c.n }) })) });
  });

  server.registerTool('search_materials', {
    title: '搜尋筆記和字幕',
    description: '在所有影片的重點筆記和字幕裡找關鍵字（中英文都可以，例如「AVL 旋轉」「banker」「LU分解」），回傳影片、時間點和連結。',
    inputSchema: { query: z.string().min(2).describe('要找的詞'), limit: z.number().int().min(1).max(50).optional().describe('最多幾筆，預設 20') },
    annotations: READ,
  }, async ({ query, limit }) => {
    const hits = search(query, limit || 20);
    if (!hits.length) return json({ results: [], note: '找不到，可以換個說法或用英文術語再試' });
    return json({ results: hits.map((h) => {
      const v = course.videos.get(h.vid);
      return { video_id: h.vid, video: v ? v.title : h.vid, where: v ? `${v.subjectName} 第 ${v.chapter} 章 ${v.chapterTitle}` : '', at: mmss(h.t),
        from: h.src === 'note' ? '筆記' : '字幕', section: h.sec || undefined, text: h.text, link: v ? link(v, h.t) : undefined };
    }) });
  });

  server.registerTool('get_video_notes', {
    title: '影片的重點筆記和測驗',
    description: '一支影片的重點筆記（每段標題、重點和時間點、常見陷阱），以及這支影片的測驗題（含答案和解說）。適合拿來複習或出題考使用者。',
    inputSchema: { video_id: videoArg, include_quiz: z.boolean().optional().describe('要不要附測驗題，預設要') },
    annotations: READ,
  }, async ({ video_id, include_quiz }) => {
    const n = readJson(`notes/${video_id}.json`);
    if (!n) return fail('這支影片沒有筆記：' + video_id);
    const v = course.videos.get(video_id);
    return json({ video: n.label, where: v ? `${v.subjectName} 第 ${v.chapter} 章 ${v.chapterTitle}` : undefined, link: v ? link(v) : undefined,
      sections: (n.sections || []).map((s) => ({ title: s.title, at: mmss((s.points[0] || {}).t || 0),
        points: (s.points || []).map((p) => mmss(p.t) + ' ' + p.text), trap: s.trap || undefined })),
      quiz: include_quiz === false ? undefined : (n.quiz || []).map((x) => ({ q: x.q, options: x.opts, answer: x.ans, why: x.why })) });
  });

  server.registerTool('get_subtitles', {
    title: '影片字幕',
    description: '一支影片某段時間的字幕（老師講的原話）。用秒數指定範圍；一次最多約 10 分鐘，結果太長會告訴你下一段從哪裡接。',
    inputSchema: { video_id: videoArg, from_seconds: z.number().min(0).optional().describe('從第幾秒，預設 0'), to_seconds: z.number().min(0).optional().describe('到第幾秒，預設 from + 600') },
    annotations: READ,
  }, async ({ video_id, from_seconds, to_seconds }) => {
    const cues = readJson(`transcripts/${video_id}.json`);
    if (!Array.isArray(cues)) return fail('這支影片沒有字幕：' + video_id);
    const from = from_seconds || 0, to = Math.min(to_seconds != null ? to_seconds : from + 600, from + 900);
    const lines = [];
    let size = 0, next = null;
    for (const c of cues) {
      if (c[0] < from) continue;
      if (c[0] >= to) { next = c[0]; break; }
      const line = `[${mmss(c[0])}] ${c[2]}`;
      if (size + line.length > 12000) { next = c[0]; break; }
      lines.push(line); size += line.length + 1;
    }
    const v = course.videos.get(video_id);
    return { content: [{ type: 'text', text: (v ? v.title + '\n' : '') + lines.join('\n') + (next != null ? `\n（還有，下一段從 ${Math.floor(next)} 秒開始）` : '\n（到影片結尾）') }] };
  });

  server.registerTool('get_quiz_history', {
    title: '作答紀錄',
    description: '使用者看影片時答過的測驗：各章答對率，以及題目、使用者的答案、正確答案和解說。only_wrong=true 只列「最近一次還是答錯」的題目，適合找弱點。',
    inputSchema: { subject: subjectArg.optional(), chapter: z.number().int().min(1).optional(), only_wrong: z.boolean().optional(), limit: z.number().int().min(1).max(200).optional().describe('最多幾題，預設 50') },
    annotations: READ,
  }, async ({ subject, chapter, only_wrong, limit }) => {
    let h = (await quizHistory()).filter((r) => (!subject || r.subj === subject) && (!chapter || r.ch === chapter - 1));
    const stats = {};
    for (const r of h) {
      const s = course.subjects.find((x) => x.id === r.subj);
      const k = (s ? s.name : r.subj) + ' 第 ' + (r.ch + 1) + ' 章';
      (stats[k] = stats[k] || { answered: 0, right: 0 }).answered++;
      if (r.ok) stats[k].right++;
    }
    if (only_wrong) {
      const last = new Map();
      for (const r of h) last.set(r.q, r);
      h = [...last.values()].filter((r) => !r.ok);
    }
    const items = h.slice(-(limit || 50)).reverse().map((r) => {
      const v = course.videos.get(r.vid);
      return { question: r.q, your_answer: r.pick, answer: r.ans, correct: r.ok, why: r.why || undefined,
        video: r.label || (v && v.title), when: new Date(r.ts).toISOString().slice(0, 10), link: v ? link(v, r.at) : undefined };
    });
    return json({ by_chapter: stats, items, total: h.length });
  });

  server.registerTool('set_video_done', {
    title: '標記影片看完',
    description: '把一支影片標成看完（done=true）或取消（done=false），跟在網站上打勾一樣。只在使用者明確要求時使用。',
    inputSchema: { video_id: videoArg, done: z.boolean() },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ video_id, done }) => {
    const v = course.videos.get(video_id);
    if (!v) return fail('排程裡沒有這支影片：' + video_id);
    await db.setTaskDone('vid-' + video_id, done);
    return json({ ok: true, video: v.title, done });
  });

  return server;
}

// ───────────────────────── routes ─────────────────────────
function install(app) {
  const mcpUrl = new URL(BASE + '/mcp');
  app.use(mcpAuthRouter({
    provider, issuerUrl: new URL(BASE), baseUrl: new URL(BASE), resourceServerUrl: mcpUrl,
    resourceName: '資工所備考中心', scopesSupported: [],
  }));
  const bearer = requireBearerAuth({ verifier: provider, resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpUrl) });
  app.post('/mcp', bearer, async (req, res) => {
    // stateless: a fresh server and transport per request (fits serverless)
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { transport.close(); server.close(); });
    // one line per call (method + status, no content), to see what clients send
    const rpc = Array.isArray(req.body) ? req.body.map((m) => m && m.method).join(',') : req.body && req.body.method;
    res.on('finish', () => console.log('mcp', rpc, req.body && req.body.params && req.body.params.name || '', res.statusCode, 'proto=' + (req.headers['mcp-protocol-version'] || '-'), 'session=' + (req.headers['mcp-session-id'] ? 'yes' : 'no')));
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: '伺服器錯誤' }, id: null });
    }
  });
  app.all('/mcp', (req, res) => res.status(405).set('Allow', 'POST').json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null }));
}

module.exports = { install, buildServer };
