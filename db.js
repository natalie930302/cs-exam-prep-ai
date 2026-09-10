const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const dataDir = process.env.CSIE_DATA_DIR
  ? path.resolve(process.env.CSIE_DATA_DIR)
  : path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'prep.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS task_done (
  task_id TEXT PRIMARY KEY,
  done_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS checklist (
  date TEXT NOT NULL,
  item_index INTEGER NOT NULL,
  PRIMARY KEY (date, item_index)
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  action TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS chat_session (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  claude_session_id TEXT
);
CREATE TABLE IF NOT EXISTS ai_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS daily_checkins (
  date TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS mastery_evidence (
  subject_id TEXT NOT NULL,
  chapter_key TEXT NOT NULL,
  correct INTEGER NOT NULL,
  total INTEGER NOT NULL,
  note TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (subject_id, chapter_key)
);
CREATE TABLE IF NOT EXISTS study_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  subject_id TEXT,
  chapter_key TEXT,
  planned_minutes INTEGER,
  actual_minutes INTEGER,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id TEXT NOT NULL,
  chapter_key TEXT NOT NULL,
  school TEXT,
  correct INTEGER NOT NULL,
  total INTEGER NOT NULL,
  minutes INTEGER,
  error_type TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS review_schedule (
  subject_id TEXT NOT NULL,
  chapter_key TEXT NOT NULL,
  due_date TEXT NOT NULL,
  interval_days INTEGER NOT NULL DEFAULT 1,
  streak INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(subject_id, chapter_key)
);
CREATE TABLE IF NOT EXISTS material_preferences (
  source TEXT PRIMARY KEY,
  rating INTEGER NOT NULL,
  note TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}
function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value));
}

// Claude and Codex use unrelated session ids. On the first Codex-backed run,
// discard only the old provider session pointer; visible history and memories
// remain untouched.
if (getSetting('chat_provider', 'claude') !== 'codex') {
  db.exec('DELETE FROM chat_session');
  setSetting('chat_provider', 'codex');
}

function getStartDate() {
  return getSetting('start_date', new Date().toISOString().slice(0, 10));
}
function setStartDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw new Error('invalid date format, expected YYYY-MM-DD');
  setSetting('start_date', dateStr);
}

// Task queue done-state, keyed by stable task id (e.g. "w4-book") instead
// of (date,index) — a task stays "the same task" no matter which day it
// actually gets done on, so falling behind just means it's still first in
// the undone list tomorrow instead of being silently replaced by new content.
function getDoneTaskIds() {
  return db.prepare('SELECT task_id FROM task_done').all().map((r) => r.task_id);
}
// Grouped by the real calendar date each task was actually completed on —
// lets the UI show "what did I really do on day X" instead of only "what's
// the queue's current pointer", which used to make finished tasks vanish
// from view the moment the queue advanced past them.
function getTaskDoneDates() {
  const rows = db.prepare("SELECT task_id, date(done_at) AS d FROM task_done").all();
  const map = {};
  rows.forEach((r) => { (map[r.d] = map[r.d] || []).push(r.task_id); });
  return map;
}
function isTaskDone(taskId) {
  return !!db.prepare('SELECT 1 FROM task_done WHERE task_id = ?').get(taskId);
}
function toggleTask(taskId) {
  const exists = db.prepare('SELECT 1 FROM task_done WHERE task_id = ?').get(taskId);
  if (exists) {
    db.prepare('DELETE FROM task_done WHERE task_id = ?').run(taskId);
    return false;
  }
  db.prepare('INSERT INTO task_done(task_id) VALUES (?)').run(taskId);
  return true;
}
function setTaskDone(taskId, done) {
  if (done) db.prepare('INSERT OR IGNORE INTO task_done(task_id) VALUES (?)').run(taskId);
  else db.prepare('DELETE FROM task_done WHERE task_id = ?').run(taskId);
}

function getMasteryEvidence() {
  return db.prepare('SELECT subject_id, chapter_key, correct, total, note, updated_at FROM mastery_evidence ORDER BY subject_id, chapter_key').all();
}
function setMasteryEvidence(subjectId, chapterKey, correct, total, note) {
  if (!subjectId || !chapterKey || !Number.isInteger(correct) || !Number.isInteger(total) || total <= 0 || correct < 0 || correct > total) {
    throw new Error('invalid mastery evidence');
  }
  db.prepare(`
    INSERT INTO mastery_evidence(subject_id, chapter_key, correct, total, note, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(subject_id, chapter_key) DO UPDATE SET
      correct=excluded.correct,total=excluded.total,note=excluded.note,updated_at=datetime('now')
  `).run(subjectId, chapterKey, correct, total, note || null);
  return db.prepare('SELECT subject_id, chapter_key, correct, total, note, updated_at FROM mastery_evidence WHERE subject_id = ? AND chapter_key = ?').get(subjectId, chapterKey);
}

function startStudySession(taskId, subjectId, chapterKey, plannedMinutes) {
  const result = db.prepare('INSERT INTO study_sessions(task_id, subject_id, chapter_key, planned_minutes) VALUES (?, ?, ?, ?)')
    .run(String(taskId), subjectId || null, chapterKey || null, Number.isFinite(plannedMinutes) ? Math.round(plannedMinutes) : null);
  return db.prepare('SELECT * FROM study_sessions WHERE id = ?').get(result.lastInsertRowid);
}
function finishStudySession(id, actualMinutes) {
  const minutes = Number(actualMinutes);
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 1440) throw new Error('invalid actual minutes');
  db.prepare("UPDATE study_sessions SET actual_minutes=?, finished_at=datetime('now') WHERE id=?").run(minutes, Number(id));
  return db.prepare('SELECT * FROM study_sessions WHERE id=?').get(Number(id));
}
function discardStudySession(id) {
  const result = db.prepare('DELETE FROM study_sessions WHERE id=? AND actual_minutes IS NULL').run(Number(id));
  return result.changes > 0;
}
function getStudySessions(limit = 200) {
  return db.prepare('SELECT * FROM study_sessions WHERE actual_minutes IS NOT NULL ORDER BY id DESC LIMIT ?').all(limit);
}
function addQuizAttempt(input) {
  const correct = Number(input.correct), total = Number(input.total), minutes = input.minutes == null ? null : Number(input.minutes);
  if (!input.subject_id || !input.chapter_key || !Number.isInteger(correct) || !Number.isInteger(total) || total <= 0 || correct < 0 || correct > total) throw new Error('invalid quiz attempt');
  const result = db.prepare('INSERT INTO quiz_attempts(subject_id,chapter_key,school,correct,total,minutes,error_type,note) VALUES (?,?,?,?,?,?,?,?)')
    .run(input.subject_id,input.chapter_key,input.school||null,correct,total,Number.isInteger(minutes)&&minutes>0?minutes:null,input.error_type||null,input.note||null);
  return db.prepare('SELECT * FROM quiz_attempts WHERE id=?').get(result.lastInsertRowid);
}
function getQuizAttempts(limit = 300) {
  return db.prepare('SELECT * FROM quiz_attempts ORDER BY id DESC LIMIT ?').all(limit);
}
function setReviewResult(subjectId, chapterKey, quality) {
  const q = Number(quality);
  if (!subjectId || !chapterKey || !Number.isInteger(q) || q < 0 || q > 3) throw new Error('invalid review quality');
  const old = db.prepare('SELECT * FROM review_schedule WHERE subject_id=? AND chapter_key=?').get(subjectId,chapterKey);
  const oldInterval = old ? old.interval_days : 0;
  const interval = q === 0 ? 1 : q === 1 ? Math.max(2, Math.round(oldInterval * 1.5) || 3) : q === 2 ? Math.max(4, Math.round(oldInterval * 2) || 7) : Math.max(7, Math.round(oldInterval * 2.5) || 14);
  const due = new Date(); due.setDate(due.getDate()+interval);
  const dueDate = due.toISOString().slice(0,10);
  db.prepare(`INSERT INTO review_schedule(subject_id,chapter_key,due_date,interval_days,streak,updated_at)
    VALUES(?,?,?,?,?,datetime('now')) ON CONFLICT(subject_id,chapter_key) DO UPDATE SET due_date=excluded.due_date,interval_days=excluded.interval_days,streak=excluded.streak,updated_at=datetime('now')`)
    .run(subjectId,chapterKey,dueDate,interval,q===0?0:(old?.streak||0)+1);
  return db.prepare('SELECT * FROM review_schedule WHERE subject_id=? AND chapter_key=?').get(subjectId,chapterKey);
}
function getReviewSchedule() { return db.prepare('SELECT * FROM review_schedule ORDER BY due_date, subject_id, chapter_key').all(); }
function setMaterialPreference(source, rating, note) {
  const r = Number(rating); if (!source || !Number.isInteger(r) || r < 1 || r > 5) throw new Error('invalid material preference');
  db.prepare(`INSERT INTO material_preferences(source,rating,note,updated_at) VALUES(?,?,?,datetime('now'))
    ON CONFLICT(source) DO UPDATE SET rating=excluded.rating,note=excluded.note,updated_at=datetime('now')`).run(source,r,note||null);
  return db.prepare('SELECT * FROM material_preferences WHERE source=?').get(source);
}
function getMaterialPreferences() { return db.prepare('SELECT * FROM material_preferences ORDER BY rating DESC, source').all(); }

function exportProgress() {
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    start_date: getStartDate(),
    done_tasks: db.prepare('SELECT task_id, done_at FROM task_done ORDER BY done_at, task_id').all(),
    checklist: db.prepare('SELECT date, item_index FROM checklist ORDER BY date, item_index').all(),
    memories: getMemories().map((m) => ({ content: m.content, created_at: m.created_at })),
    mastery_evidence: getMasteryEvidence(),
    study_sessions: getStudySessions(10000),
    quiz_attempts: getQuizAttempts(10000),
    review_schedule: getReviewSchedule(),
    material_preferences: getMaterialPreferences(),
  };
}
function importProgress(payload) {
  if (!payload || payload.version !== 1) throw new Error('不支援的備份格式');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.start_date || '')) throw new Error('備考開始日期格式錯誤');
  if (!Array.isArray(payload.done_tasks) || !Array.isArray(payload.checklist) || !Array.isArray(payload.memories)) {
    throw new Error('備份內容不完整');
  }
  const safeTasks = payload.done_tasks.map((r) => ({ task_id: String(r.task_id || ''), done_at: String(r.done_at || '') }))
    .filter((r) => r.task_id && /^\d{4}-\d{2}-\d{2}/.test(r.done_at));
  const safeChecklist = payload.checklist.map((r) => ({ date: String(r.date || ''), item_index: Number(r.item_index) }))
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Number.isInteger(r.item_index) && r.item_index >= 0);
  const safeMemories = payload.memories.map((r) => ({ content: String(r.content || '').trim(), created_at: String(r.created_at || '') }))
    .filter((r) => r.content && /^\d{4}-\d{2}-\d{2}/.test(r.created_at));
  const safeMastery = (Array.isArray(payload.mastery_evidence) ? payload.mastery_evidence : []).map((r) => ({
    subject_id: String(r.subject_id || ''), chapter_key: String(r.chapter_key || ''),
    correct: Number(r.correct), total: Number(r.total), note: String(r.note || ''), updated_at: String(r.updated_at || ''),
  })).filter((r) => r.subject_id && r.chapter_key && Number.isInteger(r.correct) && Number.isInteger(r.total) && r.total > 0 && r.correct >= 0 && r.correct <= r.total);
  const safeSessions = (Array.isArray(payload.study_sessions)?payload.study_sessions:[]).filter((r)=>r.task_id&&Number(r.actual_minutes)>0);
  const safeAttempts = (Array.isArray(payload.quiz_attempts)?payload.quiz_attempts:[]).filter((r)=>r.subject_id&&r.chapter_key&&Number(r.total)>0&&Number(r.correct)>=0&&Number(r.correct)<=Number(r.total));
  const safeReviews = (Array.isArray(payload.review_schedule)?payload.review_schedule:[]).filter((r)=>r.subject_id&&r.chapter_key&&/^\d{4}-\d{2}-\d{2}$/.test(r.due_date||''));
  const safePreferences = (Array.isArray(payload.material_preferences)?payload.material_preferences:[]).filter((r)=>r.source&&Number(r.rating)>=1&&Number(r.rating)<=5);
  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM task_done; DELETE FROM checklist; DELETE FROM ai_memory; DELETE FROM mastery_evidence; DELETE FROM study_sessions; DELETE FROM quiz_attempts; DELETE FROM review_schedule; DELETE FROM material_preferences;');
    setStartDate(payload.start_date);
    const taskStmt = db.prepare('INSERT OR IGNORE INTO task_done(task_id, done_at) VALUES (?, ?)');
    safeTasks.forEach((r) => taskStmt.run(r.task_id, r.done_at));
    const checklistStmt = db.prepare('INSERT OR IGNORE INTO checklist(date, item_index) VALUES (?, ?)');
    safeChecklist.forEach((r) => checklistStmt.run(r.date, r.item_index));
    const memoryStmt = db.prepare('INSERT INTO ai_memory(content, created_at) VALUES (?, ?)');
    safeMemories.forEach((r) => memoryStmt.run(r.content, r.created_at));
    const masteryStmt = db.prepare('INSERT INTO mastery_evidence(subject_id, chapter_key, correct, total, note, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
    safeMastery.forEach((r) => masteryStmt.run(r.subject_id, r.chapter_key, r.correct, r.total, r.note || null, /^\d{4}-\d{2}-\d{2}/.test(r.updated_at) ? r.updated_at : new Date().toISOString()));
    const sessionStmt=db.prepare('INSERT INTO study_sessions(task_id,subject_id,chapter_key,planned_minutes,actual_minutes,started_at,finished_at) VALUES(?,?,?,?,?,?,?)');
    safeSessions.forEach((r)=>sessionStmt.run(String(r.task_id),r.subject_id||null,r.chapter_key||null,Number(r.planned_minutes)||null,Number(r.actual_minutes),r.started_at||new Date().toISOString(),r.finished_at||new Date().toISOString()));
    const attemptStmt=db.prepare('INSERT INTO quiz_attempts(subject_id,chapter_key,school,correct,total,minutes,error_type,note,created_at) VALUES(?,?,?,?,?,?,?,?,?)');
    safeAttempts.forEach((r)=>attemptStmt.run(r.subject_id,r.chapter_key,r.school||null,Number(r.correct),Number(r.total),Number(r.minutes)||null,r.error_type||null,r.note||null,r.created_at||new Date().toISOString()));
    const reviewStmt=db.prepare('INSERT INTO review_schedule(subject_id,chapter_key,due_date,interval_days,streak,updated_at) VALUES(?,?,?,?,?,?)');
    safeReviews.forEach((r)=>reviewStmt.run(r.subject_id,r.chapter_key,r.due_date,Number(r.interval_days)||1,Number(r.streak)||0,r.updated_at||new Date().toISOString()));
    const preferenceStmt=db.prepare('INSERT INTO material_preferences(source,rating,note,updated_at) VALUES(?,?,?,?)');
    safePreferences.forEach((r)=>preferenceStmt.run(r.source,Number(r.rating),r.note||null,r.updated_at||new Date().toISOString()));
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return exportProgress();
}

// Drilling/convergence phases are recurring daily practice, not a finite
// list of content to drain — same-shaped checklist every day, so those
// still key off (date, item_index) rather than a stable task id.
function getChecklistDone(date) {
  return db.prepare('SELECT item_index FROM checklist WHERE date = ? ORDER BY item_index').all(date)
    .map((r) => r.item_index);
}
function toggleChecklistItem(date, index) {
  const exists = db.prepare('SELECT 1 FROM checklist WHERE date = ? AND item_index = ?').get(date, index);
  if (exists) {
    db.prepare('DELETE FROM checklist WHERE date = ? AND item_index = ?').run(date, index);
    return false;
  }
  db.prepare('INSERT INTO checklist(date, item_index) VALUES (?, ?)').run(date, index);
  return true;
}
function setChecklistItem(date, index, done) {
  if (done) db.prepare('INSERT OR IGNORE INTO checklist(date, item_index) VALUES (?, ?)').run(date, index);
  else db.prepare('DELETE FROM checklist WHERE date = ? AND item_index = ?').run(date, index);
}

function addChatMessage(role, content, action) {
  db.prepare('INSERT INTO chat_messages(role, content, action) VALUES (?, ?, ?)')
    .run(role, content, action ? JSON.stringify(action) : null);
}
function getChatHistory(limit = 100) {
  return db.prepare('SELECT role, content, action, created_at FROM chat_messages ORDER BY id DESC LIMIT ?')
    .all(limit).reverse();
}

function getClaudeSessionId() {
  const row = db.prepare('SELECT claude_session_id FROM chat_session WHERE id = 1').get();
  return row ? row.claude_session_id : null;
}
function setClaudeSessionId(id) {
  db.prepare(
    'INSERT INTO chat_session(id, claude_session_id) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET claude_session_id = excluded.claude_session_id'
  ).run(id);
}
function resetChatSession() {
  db.exec('DELETE FROM chat_session; DELETE FROM chat_messages;');
}

// The column keeps its historical name for a no-risk SQLite migration, but
// now stores the active Codex thread id.
const getAiSessionId = getClaudeSessionId;
const setAiSessionId = setClaudeSessionId;

// Long-term facts the AI should keep knowing even after the visible
// conversation is reset (e.g. "weak at DP problems", "prefers short
// reminders") — separate from chat_messages, which "開始新對話" clears.
function addMemory(content) {
  const result = db.prepare('INSERT INTO ai_memory(content) VALUES (?)').run(content);
  return Number(result.lastInsertRowid);
}
function getMemories() {
  return db.prepare('SELECT id, content, created_at FROM ai_memory ORDER BY id').all();
}
function deleteMemory(id) {
  const result = db.prepare('DELETE FROM ai_memory WHERE id = ?').run(id);
  return result.changes > 0;
}

// Daily proactive check-in — one AI-generated greeting per calendar day,
// cached so opening the app twice in one day doesn't re-spend API usage.
// Separate from chat_messages' own history so "did we already check in
// today" is a single indexed lookup, not a date-scan over the chat log.
function getDailyCheckin(date) {
  const row = db.prepare('SELECT message, created_at FROM daily_checkins WHERE date = ?').get(date);
  return row || null;
}
function setDailyCheckin(date, message) {
  db.prepare(
    'INSERT INTO daily_checkins(date, message) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET message = excluded.message'
  ).run(date, message);
}

module.exports = {
  getStartDate,
  setStartDate,
  getDoneTaskIds,
  getTaskDoneDates,
  isTaskDone,
  toggleTask,
  setTaskDone,
  getMasteryEvidence,
  setMasteryEvidence,
  startStudySession,
  finishStudySession,
  discardStudySession,
  getStudySessions,
  addQuizAttempt,
  getQuizAttempts,
  setReviewResult,
  getReviewSchedule,
  setMaterialPreference,
  getMaterialPreferences,
  exportProgress,
  importProgress,
  getChecklistDone,
  toggleChecklistItem,
  setChecklistItem,
  addChatMessage,
  getChatHistory,
  getClaudeSessionId,
  setClaudeSessionId,
  getAiSessionId,
  setAiSessionId,
  resetChatSession,
  addMemory,
  getMemories,
  deleteMemory,
  getDailyCheckin,
  setDailyCheckin,
};
