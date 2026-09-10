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
const INDEX_HTML_PATH = path.join(PUBLIC_DIR, 'index.html');
function assetVersion(relPath) {
  try { return String(fs.statSync(path.join(PUBLIC_DIR, relPath)).mtimeMs | 0); }
  catch (e) { return String(Date.now()); }
}
function serveIndex(req, res) {
  let html;
  try { html = fs.readFileSync(INDEX_HTML_PATH, 'utf8'); }
  catch (e) { return res.status(500).send('index.html missing'); }
  html = html
    .replace(/(href="styles\.css)\?v=[^"]*(")/, `$1?v=${assetVersion('styles.css')}$2`)
    .replace(/(src="data\.js)\?v=[^"]*(")/, `$1?v=${assetVersion('data.js')}$2`)
    .replace(/(src="app\.js)\?v=[^"]*(")/, `$1?v=${assetVersion('app.js')}$2`);
  res.set('Cache-Control', 'no-cache');
  res.type('html').send(html);
}
app.get(['/', '/index.html'], serveIndex);

app.use('/vendor/katex', express.static(path.join(__dirname, 'node_modules', 'katex', 'dist'), { maxAge: '30d', etag: true }));
app.use(express.static(PUBLIC_DIR, { maxAge: '30d', etag: true }));

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
  res.json({ done: db.getDoneTaskIds() });
});

app.get('/api/tasks/done-dates', (req, res) => {
  res.json({ dates: db.getTaskDoneDates() });
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

// ── Chat bridge (spawns the local Codex CLI non-interactively) ──
app.get('/api/chat/history', (req, res) => {
  res.json({ messages: db.getChatHistory() });
});

app.post('/api/chat/reset', (req, res) => {
  db.resetChatSession();
  res.json({ ok: true });
});

// Shared spawn logic behind both /api/chat and /api/checkin — same Codex CLI
// invocation, same session continuity, same JSON-parsing/error handling.
// Resolves { reply } on success or { errMsg, status, detail } on failure so
// callers can decide how to persist/respond without duplicating the
// spawn/parse plumbing.
function runCodex(message, options = {}) {
  return new Promise((resolve) => {
    const sessionId = options.standalone ? null : db.getAiSessionId();
    const codexBin = path.join(__dirname, 'tools', 'codex-cli', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe');
    const args = sessionId
      ? ['exec', 'resume', '--skip-git-repo-check', '--json', sessionId, '-']
      : ['exec', '--skip-git-repo-check', '--sandbox', 'workspace-write', '--json', '-'];

    const userHome = os.homedir();
    const codexEnv = {
      ...process.env,
      HOME: process.env.HOME || userHome,
      USERPROFILE: process.env.USERPROFILE || userHome,
      CODEX_HOME: path.join(userHome, '.codex'),
      CSIE_NODE_EXE: process.execPath,
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
      const started = events.find((e) => e.type === 'thread.started');
      if (started?.thread_id && !options.standalone) db.setAiSessionId(started.thread_id);
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
  const result = await runCodex(prompt, { standalone:true });
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
  const result = await runCodex(prompt, { standalone: true });
  if (result.errMsg) return res.status(result.status).json({ error: 'summary_unavailable', message: result.errMsg });
  res.json({ summary: result.reply.trim() });
});

const SUBJECT_NAMES = { ds: '資料結構', alg: '演算法', os: '作業系統', la: '線性代數', dm: '離散數學', ca: '計算機組織' };

// On-demand, per-school 推甄 prep synthesis — combines the official
// admission status/method (already verified against real sources) with any
// verified peer-experience points and this student's own recorded practice
// accuracy (from mastery_evidence) into one personalized plan, instead of
// generic "how to prep for grad school" advice that ignores their real data.
app.post('/api/school-prep-plan', async (req, res) => {
  const school = String(req.body?.school || '').slice(0, 60);
  const status = String(req.body?.status || '').slice(0, 300);
  const method = String(req.body?.method || '').slice(0, 300);
  const materials = String(req.body?.materials || '').slice(0, 300);
  const subjects = String(req.body?.subjects || '').slice(0, 200);
  const peerPoints = String(req.body?.peer_points || '').slice(0, 800);
  if (!school) return res.status(400).json({ error: 'missing school' });

  const bySubject = {};
  db.getMasteryEvidence().forEach((e) => {
    const s = bySubject[e.subject_id] || { correct: 0, total: 0 };
    s.correct += e.correct; s.total += e.total;
    bySubject[e.subject_id] = s;
  });
  const masterySummary = Object.keys(bySubject)
    .map((id) => `${SUBJECT_NAMES[id] || id}：${Math.round((bySubject[id].correct / bySubject[id].total) * 100)}%（${bySubject[id].correct}/${bySubject[id].total}題）`)
    .join('、');
  const personalization = masterySummary
    ? `這位學生目前有練習紀錄的科目正確率：${masterySummary}。請根據這個資料，針對這間學校實際會考的科目，具體指出應該優先補強哪一科、哪個方向，不要空泛建議「要多練習」。沒有列出正確率的科目代表還沒有紀錄，不要假裝知道。`
    : '這位學生目前還沒有任何診斷測驗紀錄，先給均衡、按部就班的準備建議即可，不要假裝知道他的弱點。';

  const prompt = `你是台灣資工所推甄申請顧問。請針對「${school}」這間學校的116學年度推甄，幫這位學生寫一份具體、可執行的準備建議。

官方公告狀態：${status}
甄試方式：${method}
需先準備的資料：${materials}
這間學校會考的科目：${subjects}
${peerPoints ? '同儕心得整理的重點（非官方，只能當準備方向參考，不可當成錄取規則）：' + peerPoints : ''}
${personalization}

寫作規則：
- 用繁體中文，語氣直接、實用，不要空話，不要輸出開場白或「以下是」這種話，直接從第一個「## 」標題開始寫。
- 固定用這幾個區塊，每個用「## 標題」開頭：
  ## 這間學校的準備重心
  ## 根據你目前進度該優先做的事
  ## 備審或口試準備提醒
  ## 一句話總結
- 「這間學校的準備重心」要說明這個甄試方式（書審／筆試／口試）真正在考什麼，不是重複貼一次官方公告原文。
- 「根據你目前進度該優先做的事」必須基於上面給的正確率資料給具體建議；如果沒有正確率資料，就給一般性但仍具體的準備順序建議，不要虛構學生的弱點。
- 官方公告與同儕心得如果衝突，要提醒以官方公告為準；同儕心得的內容要標明是「個案經驗」，不能講得像保證會考。
- 條列時每行開頭用「- 」。
- 長度大約400–700字。`;
  const result = await runCodex(prompt, { standalone: true });
  if (result.errMsg) return res.status(result.status).json({ error: 'plan_unavailable', message: result.errMsg });
  res.json({ plan: result.reply.trim() });
});

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

  const prompt = `你是台灣資工所推甄／考試準備的讀書教練。請根據以下這位學生今天的真實進度數據，寫一段今天具體該怎麼安排的建議。

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
  const result = await runCodex(prompt, { standalone: true });
  if (result.errMsg) return res.status(result.status).json({ error: 'brief_unavailable', message: result.errMsg });
  res.json({ brief: result.reply.trim() });
});

app.post('/api/chat', async (req, res) => {
  const message = (req.body?.message || '').toString().slice(0, 4000);
  const uiContext = (req.body?.ui_context || '').toString().replace(/\s+/g, ' ').trim().slice(0, 300);
  const rawStudyContext = req.body?.study_context && typeof req.body.study_context === 'object' ? req.body.study_context : null;
  if (!message.trim()) return res.status(400).json({ error: 'empty message' });

  db.addChatMessage('user', message);
  syncMemoryIntoAgentsMd();

  const cleanText = (value, max = 160) => String(value || '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
  let snapshotNote = '';
  if (rawStudyContext) {
    const q = rawStudyContext.queue && typeof rawStudyContext.queue === 'object' ? rawStudyContext.queue : {};
    const next = rawStudyContext.next_task && typeof rawStudyContext.next_task === 'object' ? rawStudyContext.next_task : null;
    const weak = rawStudyContext.evidenced_weakness && typeof rawStudyContext.evidenced_weakness === 'object' ? rawStudyContext.evidenced_weakness : null;
    const due = Array.isArray(rawStudyContext.due_reviews) ? rawStudyContext.due_reviews.slice(0, 5).map((x) => cleanText(x, 100)).filter(Boolean) : [];
    const parts = [
      `頁面=${cleanText(rawStudyContext.section, 30)}`,
      cleanText(rawStudyContext.visible_subject) ? `畫面科目=${cleanText(rawStudyContext.visible_subject)}` : '',
      cleanText(rawStudyContext.visible_chapter) ? `展開章節=${cleanText(rawStudyContext.visible_chapter)}` : '',
      cleanText(rawStudyContext.visible_school) ? `展開學校=${cleanText(rawStudyContext.visible_school)}` : '',
      Number.isFinite(Number(q.effective_week)) ? `有效週次=${Number(q.effective_week)}` : '',
      Number.isFinite(Number(q.undone_count)) ? `未完成任務=${Number(q.undone_count)}` : '',
      Number.isFinite(Number(q.remaining_minutes)) ? `估計剩餘=${Number(q.remaining_minutes)}分鐘` : '',
      next ? `下一任務=${cleanText(next.subject, 40)}／${cleanText(next.title)}（約${Math.max(0, Number(next.estimated_minutes) || 0)}分鐘）` : '',
      due.length ? `到期複習=${due.join('、')}` : '到期複習=無',
      weak ? `優先弱點=${cleanText(weak.subject, 40)}／${cleanText(weak.chapter)}（${Math.max(0, Math.min(100, Number(weak.score) || 0))}%／${weak.verified ? '有作答證據' : '尚待驗證'}）` : '優先弱點=無足夠證據',
      cleanText(rawStudyContext.active_timer) ? `目前計時=${cleanText(rawStudyContext.active_timer)}` : '',
      cleanText(rawStudyContext.daily_energy, 20) ? `今日精神狀態=${cleanText(rawStudyContext.daily_energy, 20)}` : '今日精神狀態=未回報',
      Number.isFinite(Number(rawStudyContext.today_study_minutes)) ? `今日實際計時=${Math.max(0, Number(rawStudyContext.today_study_minutes))}分鐘` : '',
    ].filter(Boolean);
    snapshotNote = '網站同步快照：' + parts.join('；') + '。快照只用來理解目前畫面與提供更主動的下一步；回答規劃類問題時，在正常回答後主動收斂成一個最值得立刻執行的行動。若使用者詢問精確進度、是否落後或要求變更任務，仍須依 AGENTS.md 執行規劃工具查證，不可只信快照。';
  }
  const contextNotes = [uiContext ? '網站目前瀏覽情境：' + uiContext + '。' : '', snapshotNote].filter(Boolean).join('\n');
  const contextualMessage = contextNotes ? '（' + contextNotes + '）\n\n' + message : message;
  const result = await runCodex(contextualMessage);
  if (result.errMsg) {
    db.addChatMessage('assistant', result.errMsg);
    return res.status(result.status).json({ ...result.detail, message: result.errMsg });
  }

  db.addChatMessage('assistant', result.reply);
  res.json({ reply: result.reply, settings: currentSettings() });
});

// ── Daily proactive check-in ─────────────────────────────────────────
// Not a background scheduler — this app has no persistent process to run
// one from. Instead: whenever the frontend asks (on page load), if today
// doesn't have a check-in yet, generate exactly one via the same Codex
// bridge and cache it — so opening the app twice in one day never
// spends a second AI call, but the FIRST open each day gets a real,
// freshly-generated greeting waiting for it rather than a rule-based
// summary. The check-in also lands in the normal chat thread (same
// session, same chat_messages table) so replying to it continues the
// conversation naturally, and it survives "開始新對話" like the rest of
// today's history until that reset also clears it.
const CHECKIN_PROMPT =
  '（系統自動觸發：新的一天開始，使用者剛打開這個網頁。請主動、簡短地打個招呼並關心一下進度——' +
  '先執行 tools\\plan-tool.cmd get-queue-status 查詢目前基礎期佇列剩多少任務、剩多少小時，' +
  '再用 1 個時間有意義（今天日期、剩幾天）判斷目前在基礎期／刷題期／收斂期哪個階段，' +
  '寫一段 2–4 句、口語、像朋友早上打招呼那樣的訊息：帶一點今天的進度或提醒，不要條列、不要長篇大論、' +
  '不要說「以下是」這種開場白，直接講重點就好。用繁體中文。）';

app.get('/api/checkin', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const existing = db.getDailyCheckin(today);
  if (existing) return res.json({ date: today, message: existing.message, isNew: false });

  syncMemoryIntoAgentsMd();
  const result = await runCodex(CHECKIN_PROMPT);
  if (result.errMsg) {
    // Don't cache failures — next page load should just try again rather
    // than being stuck with an error message as "today's greeting".
    return res.status(result.status).json({ ...result.detail, message: result.errMsg });
  }

  db.setDailyCheckin(today, result.reply);
  db.addChatMessage('assistant', result.reply);
  res.json({ date: today, message: result.reply, isNew: true });
});

app.listen(PORT, () => {
  console.log(`CSIE Prep Hub running at http://localhost:${PORT}`);
});
