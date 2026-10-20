// 改完東西後跑一次：npm run check
//
// 1. 資料檢查（不用瀏覽器）：notes/*.json 能讀、每題測驗答案在選項裡、
//    notes/index.json 的重點數／題數跟內容一致、每支影片都有筆記、動畫章節語法正確。
// 2. 頁面檢查（headless 瀏覽器）：主要頁面沒有錯誤訊息；日曆／六科／搜尋鈕
//    捲動後仍固定在畫面上、蓋在內容上面（這個壞過兩次）。
// 3. 動畫檢查：每個場景播一下、每個互動模式點一下、每個頁面畫一次，收集錯誤。
//    預設只跑「還沒 commit 的改動」動到的章節；--labs=all 全部（約 20 分鐘）、
//    --labs=ds-4,os-1 指定、--labs=none 不跑。
//
// 伺服器：先找 http://localhost:3210（或 BASE 環境變數），沒開就自己在 3299 開一個。
// 瀏覽器：CHROME_PATH 環境變數 → Playwright 的 Chromium → Chrome → Edge。
import { spawn, execSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, dirname } from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = join(ROOT, 'public');
const arg = (k) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : null; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = [];
let browser = null, PROFILE = null, server = null;
const fail = (where, msg) => { problems.push(where + '：' + msg); console.log('  ✗ ' + where + '：' + msg); };
const ok = (msg) => console.log('  ✓ ' + msg);

// ───────────────────────── 1. 資料 ─────────────────────────
console.log('資料');
{
  const index = JSON.parse(readFileSync(join(PUB, 'notes/index.json'), 'utf8'));
  let notes = 0, quizzes = 0;
  for (const f of readdirSync(join(PUB, 'notes'))) {
    if (!f.endsWith('.json') || f === 'index.json') continue;
    const id = f.slice(0, -5);
    let n;
    try { n = JSON.parse(readFileSync(join(PUB, 'notes', f), 'utf8')); } catch (e) { fail('notes/' + f, '不是正確的 JSON'); continue; }
    notes++;
    (n.quiz || []).forEach((q, i) => {
      quizzes++;
      const at = 'notes/' + f + ' 第 ' + (i + 1) + ' 題';
      if (!q.q || !Array.isArray(q.opts) || q.opts.length < 2) fail(at, '題目或選項不完整');
      else if (!q.opts.includes(q.ans)) fail(at, '答案不在選項裡');
      else if (new Set(q.opts).size !== q.opts.length) fail(at, '選項重複');
    });
    const ix = index[id];
    const points = (n.sections || []).reduce((s, x) => s + (x.points || []).length, 0);
    if (!ix) fail('notes/index.json', id + ' 沒有列在索引裡');
    else if (ix.points !== points || ix.quiz !== (n.quiz || []).length) fail('notes/index.json', id + ' 的重點數／題數跟筆記不一致（索引 ' + ix.points + '／' + ix.quiz + '，實際 ' + points + '／' + (n.quiz || []).length + '）');
  }
  for (const id of Object.keys(index)) if (!existsSync(join(PUB, 'notes', id + '.json'))) fail('notes/index.json', id + ' 列在索引裡但沒有筆記檔');
  // 每章要看的影片：用網站自己的 chapterDisplayMaterials 算，跟日曆／六科看到的一樣
  const site = vm.createContext({});
  for (const f of ['data.js', 'video-order.js', 'chapter-core.js']) vm.runInContext(readFileSync(join(PUB, f), 'utf8').replace(/^const (SUBJECTS|VIDEO_ORDER|VIDEO_PLAYLIST)\b/m, 'var $1'), site, { filename: f });
  const vids = vm.runInContext('SUBJECTS.flatMap((s) => s.chapters.flatMap((c) => chapterDisplayMaterials(c).map((m) => m.videoId))).filter(Boolean)', site);
  const missing = [...new Set(vids)].filter((v) => !index[v]);
  if (missing.length) fail('data.js', missing.length + ' 支排程裡的影片沒有筆記：' + missing.slice(0, 5).join(', '));
  ok(notes + ' 份筆記、' + quizzes + ' 題測驗、' + vids.length + ' 支影片');
  let bad = 0;
  for (const f of readdirSync(join(PUB, 'lab/chapters'))) {
    const r = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: readFileSync(join(PUB, 'lab/chapters', f)), encoding: 'utf8' });
    if (r.status !== 0) { bad++; fail('lab/chapters/' + f, '語法錯誤：' + r.stderr.split('\n').find((l) => /Error/.test(l))); }
  }
  if (!bad) ok('動畫章節語法正確');
}

// ───────────────────────── 伺服器、瀏覽器 ─────────────────────────
let BASE = process.env.BASE || 'http://localhost:3210';
const up = async (u) => { try { return (await fetch(u + '/calendar')).ok; } catch (e) { return false; } };
if (!(await up(BASE))) {
  BASE = 'http://localhost:3299';
  server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: '3299' }, stdio: 'ignore' });
  for (let i = 0; i < 40 && !(await up(BASE)); i++) await sleep(250);
}
function findBrowser() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const pw = join(homedir(), 'AppData/Local/ms-playwright');
  if (existsSync(pw)) for (const d of readdirSync(pw).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
    const p = join(pw, d, 'chrome-win64/chrome.exe'); if (existsSync(p)) return p;
  }
  return ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
}
const exe = findBrowser();
if (!exe) { fail('瀏覽器', '找不到 Chrome／Edge，跳過頁面與動畫檢查（可設定 CHROME_PATH）'); finish(); await new Promise(() => {}); }
PROFILE = mkdtempSync(join(tmpdir(), 'check-'));
const port = 47000 + Math.floor(Math.random() * 2000);
browser = spawn(exe, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${PROFILE}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let ws;
for (let i = 0; i < 100 && !ws; i++) { await sleep(300); try { const t = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((x) => x.type === 'page'); if (t) ws = new WebSocket(t.webSocketDebuggerUrl); } catch (e) {} }
await new Promise((r) => ws.addEventListener('open', r));
let seq = 0, logs = [];
const pend = {};
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (pend[d.id]) { pend[d.id](d); delete pend[d.id]; }
  if (d.method === 'Runtime.exceptionThrown') logs.push((d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).split('\n')[0]);
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') logs.push(d.params.args.map((a) => a.value ?? a.description).join(' ').split('\n')[0]);
  if (d.method === 'Network.loadingFailed' && !d.params.canceled && d.params.type !== 'Media') logs.push('載入失敗 ' + d.params.errorText);
  if (d.method === 'Network.responseReceived' && d.params.response.status >= 400 && d.params.response.url.startsWith(BASE)) logs.push('HTTP ' + d.params.response.status + ' ' + d.params.response.url.slice(BASE.length));
});
const call = (method, params = {}) => new Promise((r) => { const i = ++seq; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => { const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, timeout: 1800000 }); return r.result.result?.value; };
const size = (w) => call('Emulation.setDeviceMetricsOverride', { width: w, height: w < 700 ? 812 : 800, deviceScaleFactor: 1, mobile: w < 700 });
async function open(path, w, settle = 4000) {
  await size(w);
  logs = [];
  await call('Page.navigate', { url: BASE + path });
  await sleep(settle);
}
await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
// YouTube 播放器、字型等外部資源在離線時會失敗，不算網站本身的錯
const external = (l) => /youtube|ytimg|googleapis|gstatic|doubleclick|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_BLOCKED/i.test(l);

// ───────────────────────── 2. 頁面 ─────────────────────────
console.log('頁面');
const PAGES = ['/calendar', '/calendar/2026-10-20', '/subjects', '/subjects/ds/4', '/study/ds/4', '/study/ds/4?t=full', '/study/ds/4?t=quiz', '/study/ds/4?t=goals', '/study/os/1?t=lab'];
for (const w of [375, 1366]) {
  for (const p of PAGES) {
    await open(p, w, p.startsWith('/study') ? 7000 : 4000);
    const r = JSON.parse(await evaluate(`JSON.stringify({
      wide: document.documentElement.scrollWidth > innerWidth + 1,
      loading: document.querySelectorAll('.is-loading, [aria-busy="true"]').length,
      blank: (document.querySelector('main, .st-main') || document.body).innerText.trim().length < 20 })`));
    const errs = logs.filter((l) => !external(l));
    if (errs.length) fail(p + ' @' + w, [...new Set(errs)].slice(0, 3).join('；'));
    if (r.wide) fail(p + ' @' + w, '頁面比螢幕寬，會左右捲動');
    if (r.blank) fail(p + ' @' + w, '內容是空的');
    if (r.loading) fail(p + ' @' + w, '還停在載入中');
  }
}
ok(PAGES.length * 2 + ' 個頁面／寬度看過');
// 懸浮按鈕：捲到底以後位置不變、而且在最上層（沒被內容蓋住）
for (const w of [375, 1366]) {
  for (const p of ['/calendar', '/subjects/ds/4']) {
    await open(p, w);
    const r = JSON.parse(await evaluate(`(async () => {
      const f = document.querySelector('.fab-nav');
      if (!f) return JSON.stringify({ missing: true });
      await Promise.all(f.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {})));
      await Promise.all((document.getElementById('main')?.getAnimations() || []).map((a) => a.finished.catch(() => {})));
      scrollTo(0, 0); await new Promise((r) => setTimeout(r, 200));
      const a = f.getBoundingClientRect().top;
      const max = document.scrollingElement.scrollHeight - innerHeight;
      scrollTo(0, max); await new Promise((r) => setTimeout(r, 400));
      const b = f.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + Math.min(20, b.height / 2));
      return JSON.stringify({ a, b: b.top, scrolled: scrollY, onTop: !!hit && f.contains(hit) });
    })()`));
    if (r.missing) fail('懸浮按鈕 ' + p + ' @' + w, '找不到 .fab-nav');
    else if (r.scrolled > 50 && Math.abs(r.a - r.b) > 1) fail('懸浮按鈕 ' + p + ' @' + w, '捲動 ' + Math.round(r.scrolled) + 'px 後跟著跑掉（' + Math.round(r.a) + ' → ' + Math.round(r.b) + '）');
    else if (!r.onTop) fail('懸浮按鈕 ' + p + ' @' + w, '被其他內容蓋住');
  }
}
ok('懸浮按鈕檢查完');

// ───────────────────────── 3. 動畫 ─────────────────────────
const all = readdirSync(join(PUB, 'lab/chapters')).filter((f) => f !== '_kit.js' && f.endsWith('.js')).map((f) => f.slice(0, -3));
let labs = arg('labs');
if (!labs) {
  const changed = execSync('git status --porcelain -- public/lab', { cwd: ROOT, encoding: 'utf8' });
  labs = /lab-engine|lab-shell|_kit\.js|lab\.css|lab\.html/.test(changed) ? 'all'
    : [...changed.matchAll(/chapters\/([\w-]+)\.js/g)].map((m) => m[1]).join(',') || 'none';
}
const chs = labs === 'all' ? all : labs === 'none' ? [] : labs.split(',').filter(Boolean);
console.log('動畫（' + (chs.length ? chs.length + ' 章' : '沒有改動，略過；--labs=all 可以全跑') + '）');
await size(1100);
for (const ch of chs) {
  if (!all.includes(ch)) { fail('動畫', '沒有 ' + ch + ' 這一章'); continue; }
  await open('/lab/lab.html?ch=' + ch + '&stage=1&scene=none', 1100, 1500);
  const r = JSON.parse(await evaluate(`(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const errs = [];
    addEventListener('error', (e) => errs.push(e.message));
    addEventListener('unhandledrejection', (e) => errs.push(String(e.reason && (e.reason.message || e.reason))));
    for (let i = 0; i < 240 && !window.__labCheck; i++) await wait(250);
    const C = window.__labCheck;
    if (!C) return JSON.stringify({ n: 0, errs: ['動畫沒有載入'] });
    let n = 0;
    for (const id of Object.keys(C.def.scenes || {})) {
      try { C.playScene(id); } catch (e) { errs.push(id + '：' + e); }
      await wait(300); try { window.__lab.advance(0.3); } catch (e) {} n++;
    }
    C.stop();
    for (const md of C.def.modes || []) {
      try { md.enter(); await wait(200); for (const b of [...document.querySelectorAll('#controls button')].slice(0, 4)) { b.click(); await wait(200); } window.__lab.advance(0.5); }
      catch (e) { errs.push('模式 ' + md.id + '：' + e); }
    }
    for (const P of C.def.pages || []) { try { P.render(document.getElementById('page') || document.createElement('div')); } catch (e) { errs.push('頁面 ' + P.id + '：' + e); } }
    await wait(400);
    return JSON.stringify({ n, errs });
  })()`));
  const errs = [...new Set([...r.errs, ...logs.filter((l) => !external(l))])];
  if (errs.length) fail('動畫 ' + ch, errs.slice(0, 3).join('；'));
  else ok(ch + '：' + r.n + ' 個場景沒有錯誤');
}

finish();
function finish() {
  try { browser?.kill(); } catch (e) {}
  try { server?.kill(); } catch (e) {}
  setTimeout(() => {
    try { if (PROFILE) rmSync(PROFILE, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch (e) {}
    console.log(problems.length ? '\n有 ' + problems.length + ' 個問題（見上面 ✗）' : '\n全部通過');
    process.exit(problems.length ? 1 : 0);
  }, 1000);
}
