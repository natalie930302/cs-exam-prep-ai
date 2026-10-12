process.removeAllListeners('warning'); // silence node:sqlite experimental warning

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawn } = require('node:child_process');
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
    html = html.replace(/((?:src|href)=")([\w./-]+\.(?:js|css))\?v=[^"]*(")/g,
      (m, pre, asset, post) => `${pre}${asset}?v=${assetVersion(asset)}${post}`);
    res.set('Cache-Control', 'no-cache');
    res.type('html').send(html);
  };
}
app.get(['/', '/index.html'], serveHtmlPage('index.html'));
app.get('/study.html', serveHtmlPage('study.html'));

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
  setHeaders: (res, filePath) => { if (/\.html$|(resources|glossary|skips)\.json$/.test(filePath)) res.setHeader('Cache-Control', 'no-cache'); },
}));

const PORT = process.env.PORT || 3210;

// Codex automatically discovers AGENTS.md from the project root.

function currentSettings() {
  return { start_date: db.getStartDate() };
}

// Rewrites the marked section before every spawn so a new thread still knows
// the user's durable preferences and weak subjects.
const AGENTS_MD_PATH = path.join(__dirname, 'AGENTS.md');
function syncMemoryIntoAgentsMd() {
  let md;
  try {
    md = fs.readFileSync(AGENTS_MD_PATH, 'utf8');
  } catch (e) {
    return;
  }
  const memories = db.getMemories();
  const block = memories.length
    ? memories.map((m) => `- (#${m.id}) ${m.content}`).join('\n')
    : '（尚無記憶）';
  const next = md.replace(
    /<!-- MEMORY_START -->[\s\S]*?<!-- MEMORY_END -->/,
    `<!-- MEMORY_START -->\n${block}\n<!-- MEMORY_END -->`
  );
  if (next !== md) fs.writeFileSync(AGENTS_MD_PATH, next, 'utf8');
}

// ── AI long-term memory (survives chat reset; web UI can also manage it) ──
app.get('/api/memory', (req, res) => {
  res.json({ memories: db.getMemories() });
});

app.delete('/api/memory/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  const removed = db.deleteMemory(id);
  res.json({ ok: removed, memories: db.getMemories() });
});

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

// ── Node binary the Codex sandbox is allowed to execute ──
// On Windows, Codex runs the agent's shell commands as a restricted local
// account (CodexSandboxOnline / CodexSandboxOffline, members of "Users").
// A default Node.js install under C:/Program Files/nodejs only grants
// SYSTEM, Administrators and the installing user, so that account cannot
// launch node.exe and every tools/plan-tool.cmd call fails with
// "Access is denied." (the AI then reports it cannot read progress). The
// project directory, on the other hand, is ACL'd for the sandbox group by
// Codex itself, so we keep a private copy of the running node binary inside
// it (tools/.runtime/, gitignored) and hand that path to plan-tool.cmd via
// CSIE_NODE_EXE. The copy is refreshed whenever the real node.exe changes.
const SANDBOX_NODE_DIR = path.join(__dirname, 'tools', '.runtime');
const SANDBOX_NODE_EXE = path.join(SANDBOX_NODE_DIR, path.basename(process.execPath));
function ensureSandboxNode() {
  if (process.platform !== 'win32') return process.execPath;
  try {
    const src = fs.statSync(process.execPath);
    let stale = true;
    try {
      const dst = fs.statSync(SANDBOX_NODE_EXE);
      stale = dst.size !== src.size || dst.mtimeMs < src.mtimeMs;
    } catch (_) { /* missing -> copy */ }
    if (stale) {
      fs.mkdirSync(SANDBOX_NODE_DIR, { recursive: true });
      fs.copyFileSync(process.execPath, SANDBOX_NODE_EXE);
      console.log('已更新 sandbox 用的 Node 執行檔：' + SANDBOX_NODE_EXE);
    }
    return SANDBOX_NODE_EXE;
  } catch (err) {
    console.warn('無法準備 sandbox 用的 Node 執行檔（' + err.message + '），改用 ' + process.execPath);
    return process.execPath;
  }
}
const CODEX_NODE_EXE = ensureSandboxNode();

// ── Codex bridge (spawns the local Codex CLI non-interactively) ──
// Shared spawn logic behind the AI endpoints below — one-off Codex CLI
// runs with the same JSON-parsing/error handling.
// Resolves { reply } on success or { errMsg, status, detail } on failure so
// callers can decide how to persist/respond without duplicating the
// spawn/parse plumbing.
function runCodex(message) {
  return new Promise((resolve) => {
    const codexBin = path.join(__dirname, 'tools', 'codex-cli', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe');
    const args = ['exec', '--skip-git-repo-check', '--sandbox', 'workspace-write', '--json', '-'];

    const userHome = os.homedir();
    const codexEnv = {
      ...process.env,
      HOME: process.env.HOME || userHome,
      USERPROFILE: process.env.USERPROFILE || userHome,
      CODEX_HOME: path.join(userHome, '.codex'),
      CSIE_NODE_EXE: CODEX_NODE_EXE,
    };
    const pathKey = Object.keys(codexEnv).find((key) => key.toLowerCase() === 'path') || 'Path';
    codexEnv[pathKey] = [path.dirname(process.execPath), codexEnv[pathKey] || ''].filter(Boolean).join(path.delimiter);

    const child = spawn(codexBin, args, {
      cwd: __dirname,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120000,
      env: codexEnv,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.stdin.write(
      '（系統執行提示：規劃工具一律使用 tools\\plan-tool.cmd，不要直接呼叫 node；啟動器已取得正確的 Node 執行檔路徑。）\n' +
      message
    );
    child.stdin.end();

    child.on('error', (err) => {
      resolve({ errMsg: '（無法啟動 Codex CLI：' + err.message + '）', status: 500, detail: { error: 'spawn_failed', detail: err.message } });
    });

    child.on('close', () => {
      const events = stdout.split(/\r?\n/).filter(Boolean).map((line) => {
        try { return JSON.parse(line); } catch (_) { return null; }
      }).filter(Boolean);
      if (!events.length) {
        const cliDetail = stderr.trim() || stdout.trim();
        resolve({
          errMsg: cliDetail
            ? '（AI 目前無法啟動：' + cliDetail.split(/\r?\n/).slice(-1)[0].slice(0, 240) + '）'
            : '（AI 沒有回傳內容，請確認 Codex 已登入）',
          status: 500,
          detail: { error: 'cli_unavailable', raw: stdout.slice(0, 800), stderr: stderr.slice(0, 800) },
        });
        return;
      }
      const failure = events.find((e) => e.type === 'turn.failed' || e.type === 'error');
      if (failure) {
        resolve({
          errMsg: '（Codex 執行錯誤：' + (failure.message || failure.error?.message || '未知錯誤') + '）',
          status: 500,
          detail: { error: 'codex_error', detail: failure },
        });
        return;
      }
      const replies = events
        .filter((e) => e.type === 'item.completed' && e.item?.type === 'agent_message')
        .map((e) => e.item.text)
        .filter(Boolean);
      resolve({ reply: replies.at(-1) || '（沒有回覆內容）' });
    });
  });
}

app.post('/api/diagnostic', async (req, res) => {
  const subject = String(req.body?.subject || '').slice(0, 60);
  const chapter = String(req.body?.chapter || '').slice(0, 100);
  const keyPoints = String(req.body?.key_points || '').slice(0, 1200);
  const peerNote = String(req.body?.peer_note || '').slice(0, 800);
  const priorErrorType = String(req.body?.prior_error_type || '').slice(0, 20);
  if (!subject || !chapter) return res.status(400).json({ error:'missing chapter' });
  const personalization = priorErrorType
    ? `這位學生過去在這章診斷測驗裡最常見的錯誤類型是「${priorErrorType}」，這次出題請提高涉及這個弱點的題目比例（例如錯誤類型是「計算」就多安排要實際算出數字的題目），但5題仍要涵蓋不同角度，不要全部只考同一種。`
    : '這位學生還沒做過這章的診斷測驗，五題平均涵蓋核心概念、計算或推導、常見陷阱即可。';
  const peerNoteInstruction = peerNote
    ? `這章已經有實際讀過同儕筆記後驗證的地雷：${peerNote}\n請至少安排1–2題直接測驗學生是否真的掌握這些已驗證的地雷（不是泛泛的常見陷阱，是這裡列出的具體內容），其餘題目再涵蓋其他考點。`
    : '';
  const prompt = `你是台灣資工所筆試命題老師。請針對「${subject}／${chapter}」產生5題繁體中文單選診斷題，涵蓋核心概念、計算或推導、常見陷阱。章節考點：${keyPoints}\n\n${peerNoteInstruction}\n\n${personalization}\n\n只輸出合法JSON，不要Markdown、不要前後說明。格式：{"questions":[{"question":"題目","choices":["選項A","選項B","選項C","選項D"],"answer":0,"explanation":"答案解析","error_type":"概念|公式|計算|讀題|時間"}]}。answer必須是0到3的整數，正確選項位置要分散。所有數學式、矩陣、集合、漸近符號與邏輯式都必須使用可由KaTeX解析的LaTeX：行內公式用$...$，獨立公式用$$...$$；JSON內的反斜線必須正確跳脫。不要用純文字模擬分數或上下標。`;
  const result = await runCodex(prompt);
  if (result.errMsg) return res.status(result.status).json({ error:'diagnostic_unavailable', message:result.errMsg });
  try {
    const raw=result.reply.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
    const start=raw.indexOf('{'),end=raw.lastIndexOf('}');
    const parsed=JSON.parse(raw.slice(start,end+1));
    const questions=Array.isArray(parsed.questions)?parsed.questions.slice(0,5):[];
    const valid=questions.length===5&&questions.every((q)=>typeof q.question==='string'&&Array.isArray(q.choices)&&q.choices.length===4&&Number.isInteger(q.answer)&&q.answer>=0&&q.answer<4&&typeof q.explanation==='string');
    if(!valid) throw new Error('invalid diagnostic format');
    res.json({ questions });
  } catch(e) {
    res.status(502).json({ error:'diagnostic_parse_failed', message:'測驗題目格式異常，請再試一次。' });
  }
});

// On-demand, per-chapter AI synthesis — pulls together the official key
// points and any verified peer-note callout into one detailed, correct
// study summary, generated fresh each time rather than a hardcoded blob,
// so opening a chapter can surface real depth without the student having
// to separately ask the chat AI the same question every time.
app.post('/api/chapter-summary', async (req, res) => {
  const subject = String(req.body?.subject || '').slice(0, 60);
  const chapter = String(req.body?.chapter || '').slice(0, 100);
  const keyPoints = String(req.body?.key_points || '').slice(0, 1200);
  const peerNote = String(req.body?.peer_note || '').slice(0, 800);
  const materials = String(req.body?.materials || '').slice(0, 1200);
  const priorScore = String(req.body?.prior_score || '').slice(0, 10);
  const priorErrorType = String(req.body?.prior_error_type || '').slice(0, 20);
  if (!subject || !chapter) return res.status(400).json({ error: 'missing chapter' });
  const personalization = priorScore
    ? `這位學生先前在這章的診斷測驗拿到 ${priorScore}${priorErrorType ? '，錯誤類型偏向「' + priorErrorType + '」' : ''}。請在「核心觀念」與「常見陷阱」裡特別針對這個弱點多花篇幅講清楚，不要泛泛而談。`
    : '這位學生還沒做過這章的診斷測驗，先給均衡、完整的整理即可。';
  const prompt = `你是台灣資工所筆試的資深家教。請針對「${subject}／${chapter}」這一章，幫準備考試的學生寫一份正確、詳細、可以直接拿來讀的重點整理，目標是讓他讀完這份整理就掌握這章大部分該會的東西。

本章官方核心考點：${keyPoints}
${peerNote ? '同儕筆記已提醒的地雷（務必納入，不要遺漏，也不要跟核心考點重複貼一次原文）：' + peerNote : ''}
${materials ? '本章已經安排的教材/影片（不用重複列書單，只在需要時提及對應到哪個素材）：' + materials : ''}
${personalization}

寫作規則：
- 用繁體中文，語氣像學長姐幫學弟妹複習，不要學術論文腔，不要輸出開場白或「以下是」這種話，直接從第一個「## 」標題開始寫。
- 固定用這幾個區塊，每個區塊用「## 標題」開頭：
  ## 核心觀念
  ## 常見陷阱
  ## 範例或手算示範
  ## 一句話總結
- 「核心觀念」要把官方考點展開講清楚（為什麼、怎麼推導），不是重複貼一次考點原文。
- 「常見陷阱」優先納入上面提供的同儕筆記地雷；如果要補充你自己知道的常見誤區，必須在該句前標註「（補充）」，不可假裝是已驗證的同儕心得。
- 有計算或推導的主題要給至少一個實際範例（數字代入或列出推導步驟），不能只有文字敘述。
- 所有數學式、矩陣、集合、漸近符號都必須用KaTeX可解析的LaTeX：行內用$...$，獨立成行用$$...$$。
- 條列時每行開頭用「- 」。
- 長度大約500–900字，寧可精簡正確，不要為了湊字數亂補內容。`;
  const result = await runCodex(prompt);
  if (result.errMsg) return res.status(result.status).json({ error: 'summary_unavailable', message: result.errMsg });
  res.json({ summary: result.reply.trim() });
});

const SUBJECT_NAMES = { ds: '資料結構', alg: '演算法', os: '作業系統', la: '線性代數', dm: '離散數學', ca: '計算機組織' };

// On-demand AI reading of the same numbers the rule-based "smart overview"
// cards on the calendar tab already show (due reviews, weakest verified
// chapter, weekly accuracy, time calibration) — turns three disconnected
// stats into one coherent, reasoned recommendation for today, instead of
// leaving the student to interpret them themselves.
app.post('/api/daily-brief', async (req, res) => {
  const currentWeek = String(req.body?.current_week ?? '').slice(0, 10);
  const nextTask = String(req.body?.next_task || '').replace(/\s+/g, ' ').slice(0, 300);
  const dueReviewCount = Number(req.body?.due_review_count) || 0;
  const dueReviews = String(req.body?.due_reviews || '').slice(0, 400);
  const weakChapter = String(req.body?.weak_chapter || '').slice(0, 200);
  const recentAccuracy = String(req.body?.recent_accuracy || '').slice(0, 10);
  const timeCalibration = String(req.body?.time_calibration || '').slice(0, 100);

  const prompt = `你是台灣資工所考試準備的讀書教練。請根據以下這位學生今天的真實進度數據，寫一段今天具體該怎麼安排的建議。

目前基礎期第 ${currentWeek || '未知'} 週${nextTask ? '，下一個該做的任務：' + nextTask : ''}
到期待複習：${dueReviewCount} 個章節${dueReviews ? '（' + dueReviews + '）' : ''}
目前驗證到最弱的必考章節：${weakChapter || '尚無資料'}
最近7天診斷正確率：${recentAccuracy || '尚無資料'}
讀書時間校準：${timeCalibration || '尚無足夠資料'}

寫作規則：
- 用繁體中文，語氣像學長姐在幫學弟妹排今天的行程，直接、具體，不要空話，不要輸出開場白或「以下是」這種話，直接從第一個「## 」標題開始寫。
- 固定用這幾個區塊，每個用「## 標題」開頭：
  ## 今天優先順序
  ## 為什麼
  ## 如果時間有限
  ## 一句話總結
- 「今天優先順序」要給明確、按順序的行動清單（用「- 」條列），基於上面給的真實數據排序（例如複習到期優先於新進度、驗證過的弱點優先於還沒驗證的），不是空泛的「要努力讀書」。
- 「為什麼」要解釋這個排序背後的邏輯（例如複習有到期日、弱點已有實際作答證據等），讓學生理解而不是照單全收。
- 上面任何一項寫「尚無資料」的，不要假裝有那項數據、也不要虛構具體數字。
- 條列時每行開頭用「- 」。
- 長度大約300–500字，精簡勝過長篇。`;
  const result = await runCodex(prompt);
  if (result.errMsg) return res.status(result.status).json({ error: 'brief_unavailable', message: result.errMsg });
  res.json({ brief: result.reply.trim() });
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
// Readable paths open the same views as the hash routes in app.js:
// /calendar[/YYYY-MM-DD] and /subjects[/subj[/chapter]].
app.get(/^\/(calendar|subjects)(\/[\w-]+){0,2}\/?$/, (req, res) => {
  res.redirect('/#' + req.path.replace(/\/$/, ''));
});

app.listen(PORT, () => {
  console.log(`CSIE Prep Hub running at http://localhost:${PORT}`);
});
