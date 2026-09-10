#!/usr/bin/env node
// Safe, narrow CLI surface for the AI bridge to mutate the study-plan database.
// This is the ONLY script the embedded AI agent is allowed to run (see server.js
// --allowedTools scoping). Keep every command here small, validated, and reversible.

process.removeAllListeners('warning'); // silence node:sqlite experimental warning on stderr
const db = require('../db.js');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const [, , cmd, ...args] = process.argv;

function out(obj) {
  console.log(JSON.stringify(obj));
}

let studyDataCache = null;
function extractAssignedLiteral(source, name) {
  const marker = `const ${name} =`;
  const markerAt = source.indexOf(marker);
  if (markerAt < 0) throw new Error(`missing ${name}`);
  let start = markerAt + marker.length;
  while (/\s/.test(source[start])) start++;
  const opener = source[start];
  const closer = opener === '{' ? '}' : opener === '[' ? ']' : null;
  if (!closer) throw new Error(`unsupported ${name} literal`);
  let depth = 0, quote = '', escaped = false, lineComment = false, blockComment = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i], next = source[i + 1];
    if (lineComment) { if (ch === '\n') lineComment = false; continue; }
    if (blockComment) { if (ch === '*' && next === '/') { blockComment = false; i++; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === opener) depth++;
    else if (ch === closer && --depth === 0) {
      return vm.runInNewContext('(' + source.slice(start, i + 1) + ')', {}, { timeout: 1000 });
    }
  }
  throw new Error(`unterminated ${name}`);
}
function loadStudyData() {
  if (studyDataCache) return studyDataCache;
  const publicDir = path.join(__dirname, '..', 'public');
  const dataSource = fs.readFileSync(path.join(publicDir, 'data.js'), 'utf8');
  const context = {};
  vm.runInNewContext(dataSource + '\n;globalThis.__CSIE_DATA__={SUBJECTS,MATS,UNIS};', context, { timeout: 3000 });
  const appSource = fs.readFileSync(path.join(publicDir, 'app.js'), 'utf8');
  studyDataCache = {
    subjects: context.__CSIE_DATA__.SUBJECTS,
    library: context.__CSIE_DATA__.MATS,
    schools: context.__CSIE_DATA__.UNIS,
    playlists: extractAssignedLiteral(appSource, 'SUBJECT_PLAYLISTS'),
    foundation: extractAssignedLiteral(appSource, 'FOUNDATION_CONTENT'),
  };
  return studyDataCache;
}
function stableTaskKey(value) {
  const text = String(value || '').trim().toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(36);
}
function chapterTasks(subject, chapter) {
  const tasks = [];
  const hasVideo = chapter.mats.some((m) => m.type === 'vid' || m.type === 'vidgroup');
  if (hasVideo) tasks.push({ type: 'video', id: `mat-v2-${subject.id}-${stableTaskKey(chapter.t)}-video` });
  chapter.mats.forEach((m, index) => {
    if (m.type === 'vid' || m.type === 'vidgroup') return;
    const taskKey = m.type + '-' + stableTaskKey(m.text || String(index));
    const type = m.type === 'book' ? 'book' : m.type === 'ex' ? 'practice' : 'notes';
    tasks.push({ type, id: `mat-v2-${subject.id}-${stableTaskKey(chapter.t)}-${taskKey}` });
  });
  return tasks;
}
function taskDone(task, chapter, doneSet) {
  return doneSet.has(task.id) || (chapter.wk && (doneSet.has(`w${chapter.wk}-review`) || doneSet.has(`w${chapter.wk}-${task.type}`)));
}
function resolveSubject(query) {
  const subjects = loadStudyData().subjects;
  const q = String(query || '').trim().toLowerCase();
  return subjects.find((s) => s.id === q || s.name.toLowerCase() === q || s.name.includes(query));
}
function chapterProgress(subject, chapter, doneSet) {
  const tasks = chapterTasks(subject, chapter);
  const done = tasks.filter((t) => taskDone(t, chapter, doneSet)).length;
  return { done, total: tasks.length, complete: tasks.length > 0 && done === tasks.length };
}
function subjectProgress(subject, doneSet) {
  const tasks = subject.chapters.flatMap((c) => chapterTasks(subject, c).map((t) => ({ ...t, chapter: c })));
  const done = tasks.filter((t) => taskDone(t, t.chapter, doneSet)).length;
  const next = subject.chapters.find((c) => !chapterProgress(subject, c, doneSet).complete);
  return { done, total: tasks.length, percent: tasks.length ? Math.round(done / tasks.length * 100) : 0, next_chapter: next?.t || null };
}
function videoSource(title) {
  const text = String(title || '');
  const rules = [
    [/林軒田/,'台大 林軒田 DSA'],[/彭文志/,'交大OCW 彭文志'],[/江蕙如/,'交大OCW 江蕙如'],
    [/易志偉/,'交大OCW 易志偉'],[/周志遠/,'清大OCW 周志遠'],[/趙啟超/,'清大OCW 趙啟超'],
    [/黃婷婷/,'清大 黃婷婷'],[/韓永楷/,'清大 韓永楷'],[/Abdul Bari/i,'Abdul Bari'],
    [/3Blue1Brown/i,'3Blue1Brown'],[/MIT(?: OCW)? 6\.006/i,'MIT OCW 6.006'],[/MIT(?: OCW)? 18\.06/i,'MIT OCW 18.06'],
  ];
  return (rules.find((r) => r[0].test(text)) || [null, '精選單篇'])[1];
}
function videoSequence(title, fallback) {
  const text = String(title || '');
  const patterns = [/\bLec\s*0*(\d+)/i,/\bLecture\s*0*(\d+)/i,/第\s*0*(\d+)(?:[A-Z](?:\+[A-Z])?)?講/i,/\bL\s*0*(\d+)\b/i,/\bCh(?:apter)?\s*0*(\d+)/i];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  return 10000 + fallback;
}
function chapterVideoSeries(chapter) {
  const rows = [];
  chapter.mats.forEach((m) => {
    if (m.type === 'vidgroup') m.options.forEach((o) => rows.push({ source: videoSource(o.label), topic: m.text, title: o.label, duration: o.dur || null, url: o.url }));
    else if (m.type === 'vid') rows.push({ source: videoSource(m.text), topic: '', title: m.text, duration: m.dur || null, url: m.url });
  });
  const groups = [];
  rows.forEach((row) => {
    let group = groups.find((g) => g.source === row.source);
    if (!group) { group = { source: row.source, topics: [], videos: [] }; groups.push(group); }
    if (row.topic && !group.topics.includes(row.topic)) group.topics.push(row.topic);
    group.videos.push({ title: row.title, duration: row.duration, url: row.url, sequence: videoSequence(row.title, group.videos.length) });
  });
  groups.forEach((group) => {
    group.videos.sort((a, b) => a.sequence - b.sequence);
    group.videos.forEach((video, index) => { video.order = index + 1; delete video.sequence; });
  });
  return groups;
}
function chapterDetails(subject, chapter, doneSet) {
  const videos = [];
  const paper = [];
  const exercises = [];
  const notes = [];
  chapter.mats.forEach((m) => {
    if (m.type === 'vidgroup') videos.push({ topic: m.text, videos: m.options.map((o) => ({ title: o.label, duration: o.dur || null, url: o.url })) });
    else if (m.type === 'vid') videos.push({ topic: m.text, videos: [{ title: m.text, duration: m.dur || null, url: m.url }] });
    else if (m.type === 'book') paper.push(m.text);
    else if (m.type === 'ex') exercises.push(m.text);
    else notes.push(m.text);
  });
  return {
    subject: subject.name, chapter: chapter.t, subtitle: chapter.sub, week: chapter.wk,
    priority: chapter.pri, estimated_hours: chapter.hrs, key_points: chapter.key,
    progress: chapterProgress(subject, chapter, doneSet),
    task_status: chapterTasks(subject, chapter).map((task) => ({ type: task.type, done: taskDone(task, chapter, doneSet), task_id: task.id })),
    paper,
    scheduled_paper: loadStudyData().foundation[chapter.wk]?.subj === subject.name ? loadStudyData().foundation[chapter.wk].book : null,
    video_groups_by_topic: videos, video_series: chapterVideoSeries(chapter),
    exercises, supplementary_notes: notes, full_course_playlists: loadStudyData().playlists[subject.id] || [],
  };
}
// Verified peer-note takeaways now live as `insights` directly on each
// 同儕筆記 card in public/data.js (also rendered on the 素材 tab), so this
// reads that single source instead of keeping a second copy here that could
// drift out of sync with what the website actually shows.
function peerNoteCard(subject) {
  return loadStudyData().library.find((m) => m.type === '同儕筆記' && m.name.startsWith(subject.name));
}
function peerNotesForSubject(subject) {
  const card = peerNoteCard(subject);
  return card ? (card.urls || []).map((u) => ({ title: u.label, url: u.url })) : [];
}
function verifiedNoteGuidance(subject) {
  const card = peerNoteCard(subject);
  return card ? (card.insights || []) : [];
}
function conceptList(chapter) {
  return Array.from(new Set((chapter.sub + '、' + chapter.key)
    .split(/[、，。；：()（）/＋+]|\bvs\b/i).map((s) => s.trim()).filter((s) => s.length >= 2))).slice(0, 30);
}
function chapterCoverageAudit(subject, chapter, doneSet) {
  const details = chapterDetails(subject, chapter, doneSet);
  return {
    subject: subject.name, chapter: chapter.t, priority: chapter.pri,
    required_concepts: conceptList(chapter),
    video_evidence: details.video_series.map((series) => ({
      source: series.source, stated_topics: series.topics,
      ordered_videos: series.videos.map((v) => ({ order: v.order, title: v.title, duration: v.duration, url: v.url })),
    })),
    paper_evidence: Array.from(new Set(details.paper.concat(details.scheduled_paper ? [details.scheduled_paper] : []))),
    practice_evidence: details.exercises,
    peer_note_sources: peerNotesForSubject(subject),
    verified_note_guidance: verifiedNoteGuidance(subject),
    progress: details.task_status,
    evaluation_rules: [
      '影片內容只可依課程名稱、單集標題與已整理主題判斷；沒有逐字稿時標為推定覆蓋，不可宣稱已逐句核實。',
      '同一考點至少要有紙本或影片講解，並有練習／考古題驗證，才可判為學習鏈完整。',
      'HackMD只作交叉核對與補漏，不單獨取代課本或官方考試範圍。',
      '回覆時分列：已充分覆蓋、疑似覆蓋但待驗證、缺少練習驗證、明顯缺口。',
    ],
  };
}
function masteryEvidenceMap() {
  const map = new Map();
  db.getMasteryEvidence().forEach((e) => map.set(`${e.subject_id}:${e.chapter_key}`, e));
  return map;
}
function chapterMastery(subject, chapter, doneSet, evidenceMap) {
  const weights = { video: 20, book: 25, practice: 45, notes: 10 };
  const tasks = chapterTasks(subject, chapter);
  const availableWeight = tasks.reduce((sum, task) => sum + (weights[task.type] || 0), 0) || 1;
  const completedWeight = tasks.filter((task) => taskDone(task, chapter, doneSet)).reduce((sum, task) => sum + (weights[task.type] || 0), 0);
  const completionEstimate = Math.round(completedWeight / availableWeight * 100);
  const evidence = evidenceMap.get(`${subject.id}:${stableTaskKey(chapter.t)}`) || null;
  const practicePercent = evidence ? Math.round(evidence.correct / evidence.total * 100) : null;
  const score = evidence ? Math.round(completionEstimate * 0.35 + practicePercent * 0.65) : completionEstimate;
  const status = score === 0 ? '未開始'
    : !evidence && score >= 70 ? '教材完成，尚待題目驗證'
    : score < 40 ? '建立概念中'
    : score < 70 ? '需要補強'
    : score < 85 ? '基本掌握'
    : '掌握良好';
  const missing = tasks.filter((task) => !taskDone(task, chapter, doneSet)).map((task) => task.type);
  const nextAction = missing.includes('video') ? '完成一套對應影片系列'
    : missing.includes('book') ? '完成紙本對應範圍並整理重點'
    : missing.includes('practice') ? '完成章節練習並回報正確題數'
    : !evidence ? '用考古題或小測驗驗證並回報正確題數'
    : practicePercent < 70 ? '重做錯題並再次測驗' : '間隔複習維持熟練度';
  return {
    score, status, completion_estimate: completionEstimate,
    practice_evidence: evidence ? { correct: evidence.correct, total: evidence.total, percent: practicePercent, note: evidence.note, updated_at: evidence.updated_at } : null,
    confidence: evidence ? (evidence.total >= 10 ? '高' : '中') : '低',
    next_action: nextAction,
  };
}
function masteryMap(subjects) {
  const doneSet = new Set(db.getDoneTaskIds());
  const evidenceMap = masteryEvidenceMap();
  return subjects.map((subject) => {
    const chapters = subject.chapters.map((chapter, index) => ({
      number: index + 1, chapter: chapter.t, priority: chapter.pri, estimated_hours: chapter.hrs,
      mastery: chapterMastery(subject, chapter, doneSet, evidenceMap),
    }));
    const weighted = chapters.reduce((sum, row) => {
      const hours = parseFloat(row.estimated_hours) || 1;
      const priority = row.priority === 'must' ? 1.35 : row.priority === 'hi' ? 1.15 : 0.8;
      return { points: sum.points + row.mastery.score * hours * priority, weight: sum.weight + hours * priority };
    }, { points: 0, weight: 0 });
    const weakest = chapters.slice().sort((a, b) => {
      const pa = a.priority === 'must' ? 0 : a.priority === 'hi' ? 1 : 2;
      const pb = b.priority === 'must' ? 0 : b.priority === 'hi' ? 1 : 2;
      return a.mastery.score - b.mastery.score || pa - pb;
    }).slice(0, 3).map((row) => ({ chapter: row.chapter, score: row.mastery.score, status: row.mastery.status, next_action: row.mastery.next_action }));
    return { id: subject.id, subject: subject.name, estimated_mastery: Math.round(weighted.points / (weighted.weight || 1)), weakest_chapters: weakest, chapters };
  });
}
const PREREQUISITE_GUIDE = {
  alg:{'Divide and Conquer':['離散數學：遞推關係','演算法：複雜度分析'],'Dynamic Programming':['離散數學：遞推關係','演算法：Divide and Conquer'],'圖演算法':['資料結構：圖（基礎）'],'NP-Complete':['離散數學：證明方法','演算法：圖演算法']},
  ca:{'Pipeline':['計算機組織：指令集與Datapath'],'記憶體層次與Cache':['計算機組織：數位邏輯與效能分析']},
  os:{'同步與互斥':['作業系統：Process與Thread'],'Deadlock':['作業系統：同步與互斥'],'虛擬記憶體':['作業系統：記憶體管理']},
  ds:{'BST、AVL Tree、Red-Black Tree':['資料結構：樹（基礎）'],'圖演算法':['資料結構：圖（基礎）']},
  la:{'特徵值與特徵向量':['線性代數：向量空間','線性代數：線性轉換'],'對角化':['線性代數：特徵值與特徵向量']},
  dm:{'遞推關係':['離散數學：證明方法','離散數學：集合與函數'],'進階計數':['離散數學：計數原理'],'圖論（進階）':['離散數學：圖論（基礎）']},
};
function smartLearningSummary() {
  const subjects = loadStudyData().subjects;
  const maps = masteryMap(subjects);
  const sessions = db.getStudySessions(200);
  const ratios = sessions.filter((s) => s.planned_minutes > 0 && s.actual_minutes > 0).map((s) => Math.max(.4,Math.min(2.5,s.actual_minutes/s.planned_minutes))).sort((a,b)=>a-b);
  const factor = ratios.length >= 3 ? ratios[Math.floor(ratios.length/2)] : 1;
  const attempts = db.getQuizAttempts(300);
  const reviews = db.getReviewSchedule();
  const today = new Date().toISOString().slice(0,10);
  const weakest = maps.flatMap((s) => s.chapters.map((c) => ({subject:s.subject,...c}))).filter((c)=>c.priority==='must').sort((a,b)=>a.mastery.score-b.mastery.score).slice(0,8);
  const scoreById=Object.fromEntries(maps.map((m)=>[m.id,m.estimated_mastery]));
  const school_readiness=loadStudyData().schools.map((u)=>{
    const weights={ds:1,alg:1,os:1,ca:1,la:1,dm:1}, text=(u.subjs||[]).join(' ');
    if(/資料結構與演算法.*1\.5|資結與演算法.*1\.5/.test(text))weights.ds=weights.alg=1.5;
    if(/計算機系統.*1\.5/.test(text))weights.os=weights.ca=1.5;
    let points=0,total=0;Object.entries(weights).forEach(([id,w])=>{points+=(scoreById[id]||0)*w;total+=w;});
    return {school:u.name,code:u.en,readiness:Math.round(points/total),basis:'依六科章節掌握推估與已知考科加權；尚未公布116學年度簡章的細節不臆測'};
  });
  const weekAgo=Date.now()-7*86400000, recentAttempts=attempts.filter((a)=>new Date(a.created_at+'Z').getTime()>=weekAgo), recentSessions=sessions.filter((s)=>new Date((s.finished_at||s.started_at)+'Z').getTime()>=weekAgo);
  const correct=recentAttempts.reduce((n,a)=>n+a.correct,0), total=recentAttempts.reduce((n,a)=>n+a.total,0);
  return {
    queue:queueStatus(), time_calibration:{factor:Math.round(factor*100)/100, samples:ratios.length, confidence:ratios.length>=10?'高':ratios.length>=3?'中':'低'},
    due_reviews:reviews.filter((r)=>r.due_date<=today), weakest_required_chapters:weakest,
    recent_attempts:attempts.slice(0,10),
    weekly_review:{study_minutes:recentSessions.reduce((n,s)=>n+(s.actual_minutes||0),0),attempts:recentAttempts.length,accuracy:total?Math.round(correct/total*100):null,repeated_error_types:Object.entries(recentAttempts.reduce((o,a)=>{if(a.error_type)o[a.error_type]=(o[a.error_type]||0)+1;return o;},{})).sort((a,b)=>b[1]-a[1]).slice(0,3)},
    school_readiness, prerequisites:PREREQUISITE_GUIDE, subjects:maps,
  };
}

// Lightweight parallel catalog of the foundation task queue (id + week +
// estimated minutes only — no titles/links, those live in public/app.js
// and are what the browser actually renders). This only exists so this CLI
// tool can compute aggregate numbers (undone count, remaining hours) without
// duplicating the full content. If a task's estimate changes in app.js's
// FOUNDATION_BOOK_MINUTES table, mirror it here too.
const FOUNDATION_WEEKS = 19;
const FOUNDATION_BOOK_MINUTES = {
  1: 480, 2: 480, 3: 600, 4: 720, 5: 600, 6: 480, 7: 600, 8: 660, 9: 720,
  10: 900, 11: 720, 12: 480, 13: 720, 14: 660, 15: 600, 16: 900,
  17: 720, 18: 480, 19: 720,
};
function foundationCatalog() {
  const tasks = [];
  const foundation = loadStudyData().foundation;
  const durationMinutes = (value) => {
    const parts = String(value || '').split(':').map(Number);
    if (parts.some((n) => !Number.isFinite(n))) return 0;
    const seconds = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2]
      : parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
    return Math.max(0, Math.ceil(seconds / 60));
  };
  for (let wk = 1; wk <= FOUNDATION_WEEKS; wk++) {
    const videos = foundation[wk]?.vid || [];
    const videoMinutes = videos.reduce((sum, video) => sum + durationMinutes(video.dur), 0) || 60;
    tasks.push({ id: `w${wk}-video`, week: wk, minutes: videoMinutes });
    tasks.push({ id: `w${wk}-book`, week: wk, minutes: FOUNDATION_BOOK_MINUTES[wk] || 480 });
    tasks.push({ id: `w${wk}-practice`, week: wk, minutes: 60 });
    tasks.push({ id: `w${wk}-notes`, week: wk, minutes: 30 });
    tasks.push({ id: `w${wk}-review`, week: wk, minutes: 150 });
  }
  return tasks;
}
function queueStatus() {
  const doneSet = new Set(db.getDoneTaskIds());
  const catalog = foundationCatalog();
  const undone = catalog.filter((t) => !doneSet.has(t.id));
  return {
    effective_week: undone.length ? undone[0].week : FOUNDATION_WEEKS + 1,
    undone_count: undone.length,
    total_tasks: catalog.length,
    remaining_hours: Math.round((undone.reduce((s, t) => s + t.minutes, 0) / 60) * 10) / 10,
  };
}

function usage() {
  out({
    error: 'unknown or missing command',
    commands: [
      'get-status                                     # start_date + current foundation queue status',
      'get-queue-status                                # foundation task queue: effective week, undone count, remaining hours',
      'get-study-context [subject-id|科目名稱]          # queue + six-subject progress + current-week books/videos/practice',
      'get-subject-materials <subject-id|科目名稱>      # exact books, playlists, chapters and per-chapter progress',
      'get-chapter-materials <subject> <章節序號|名稱>  # exact paper, individual videos/durations/links, exercises and progress',
      'audit-learning-coverage <subject> <章節序號|名稱> # compare required concepts, ordered videos, paper, exercises and HackMD evidence',
      'search-study-materials <keywords>                # search all paper titles, chapter videos, playlists and reference resources',
      'get-mastery-map [subject-id|科目名稱]            # evidence-aware mastery estimate and weakest chapters',
      'record-practice-result <subject> <chapter> <correct> <total> [note] # save quiz/past-paper evidence; only after user reports a result',
      'get-smart-dashboard                            # adaptive time factor, reviews, weaknesses, prerequisites and school-ready evidence',
      'record-review-result <subject> <chapter> <0-3>  # 0 forgot, 1 difficult, 2 remembered, 3 fluent; schedules next review',
      'log-study-time <task-id> <planned-min> <actual-min> [subject] [chapter] # calibrate future estimates',
      'set-start-date <YYYY-MM-DD>                     # change the 備考開始日期 — this is the ONLY way to set it now, there is no UI for it',
      'mark-done <task-id>                             # mark one foundation task done, e.g. "w4-book" or "w7-video"',
      'mark-undone <task-id>                           # unmark a foundation task',
      'mark-checklist-done <YYYY-MM-DD> <item_index>    # drilling/convergence only: mark a recurring daily checklist item done (item_index is 0-based)',
      'mark-checklist-undone <YYYY-MM-DD> <item_index>  # unmark a recurring daily checklist item',
      'remember <text>                                 # save a long-term fact about the user (survives "開始新對話")',
      'list-memories                                   # list saved facts with their ids',
      'forget <id>                                     # delete a saved fact by id (see list-memories)',
    ],
  });
}

const TASK_ID_RE = /^w([1-9]|1[0-9])-(video|book|practice|notes|review)$/;

switch (cmd) {
  case 'get-status': {
    out({ start_date: db.getStartDate(), queue: queueStatus() });
    break;
  }
  case 'get-queue-status': {
    out(queueStatus());
    break;
  }
  case 'get-study-context': {
    const data = loadStudyData();
    const doneSet = new Set(db.getDoneTaskIds());
    const queue = queueStatus();
    const requested = args.join(' ').trim();
    const subjects = requested ? [resolveSubject(requested)].filter(Boolean) : data.subjects;
    if (requested && !subjects.length) {
      out({ error: 'unknown subject', valid_subjects: data.subjects.map((s) => ({ id: s.id, name: s.name })) });
      process.exit(1);
    }
    const foundation = data.foundation[queue.effective_week] || null;
    out({
      start_date: db.getStartDate(), queue,
      current_week_content: foundation ? {
        week: queue.effective_week, subject: foundation.subj, chapter: foundation.ch,
        book: foundation.book, videos: foundation.vid, practice: foundation.practice || foundation.pm || null,
      } : null,
      subjects: subjects.map((s) => ({
        id: s.id, name: s.name, estimated_hours: s.hours,
        progress: subjectProgress(s, doneSet),
        paper_titles: (s.recommended_books || []).map((b) => b.name),
        complete_course_playlists: (data.playlists[s.id] || []).map((p) => p.name),
      })),
    });
    break;
  }
  case 'get-subject-materials': {
    const query = args.join(' ').trim();
    const subject = resolveSubject(query);
    if (!query || !subject) {
      out({ error: 'usage: get-subject-materials <subject-id|科目名稱>', valid_subjects: loadStudyData().subjects.map((s) => ({ id: s.id, name: s.name })) });
      process.exit(1);
    }
    const doneSet = new Set(db.getDoneTaskIds());
    out({
      id: subject.id, subject: subject.name, study_tip: subject.tip,
      progress: subjectProgress(subject, doneSet),
      paper_materials: subject.recommended_books || [],
      complete_course_playlists: loadStudyData().playlists[subject.id] || [],
      chapters: subject.chapters.map((c, i) => ({
        number: i + 1, title: c.t, subtitle: c.sub, week: c.wk, priority: c.pri,
        estimated_hours: c.hrs, progress: chapterProgress(subject, c, doneSet),
        paper_items: c.mats.filter((m) => m.type === 'book').length,
        individual_videos: c.mats.reduce((n, m) => n + (m.type === 'vidgroup' ? m.options.length : m.type === 'vid' ? 1 : 0), 0),
        exercises: c.mats.filter((m) => m.type === 'ex').length,
      })),
    });
    break;
  }
  case 'get-chapter-materials': {
    const subjectQuery = args.shift();
    const chapterQuery = args.join(' ').trim();
    const subject = resolveSubject(subjectQuery);
    if (!subject || !chapterQuery) {
      out({ error: 'usage: get-chapter-materials <subject-id|科目名稱> <章節序號|名稱>' });
      process.exit(1);
    }
    const index = Number(chapterQuery);
    const chapter = Number.isInteger(index) && index > 0
      ? subject.chapters[index - 1]
      : subject.chapters.find((c) => c.t.includes(chapterQuery) || c.sub.includes(chapterQuery));
    if (!chapter) {
      out({ error: 'unknown chapter', chapters: subject.chapters.map((c, i) => ({ number: i + 1, title: c.t })) });
      process.exit(1);
    }
    out(chapterDetails(subject, chapter, new Set(db.getDoneTaskIds())));
    break;
  }
  case 'search-study-materials': {
    const query = args.join(' ').trim();
    if (!query) {
      out({ error: 'usage: search-study-materials <keywords>' });
      process.exit(1);
    }
    const q = query.toLowerCase();
    const data = loadStudyData();
    const results = [];
    data.subjects.forEach((s) => {
      (s.recommended_books || []).forEach((b) => {
        if ((b.name + ' ' + (b.note || '')).toLowerCase().includes(q)) results.push({ kind: 'paper', subject: s.name, title: b.name, note: b.note || '', url: b.url || null });
      });
      (data.playlists[s.id] || []).forEach((p) => {
        if (p.name.toLowerCase().includes(q) || s.name.includes(query)) results.push({ kind: 'playlist', subject: s.name, title: p.name, url: p.url });
      });
      s.chapters.forEach((c, ci) => c.mats.forEach((m) => {
        if (m.type === 'book' && (c.t + ' ' + m.text).toLowerCase().includes(q)) results.push({ kind: 'chapter_paper', subject: s.name, chapter: c.t, chapter_number: ci + 1, title: m.text });
        if (m.type === 'vid' && m.text.toLowerCase().includes(q)) results.push({ kind: 'individual_video', subject: s.name, chapter: c.t, chapter_number: ci + 1, title: m.text, duration: m.dur || null, url: m.url });
        if (m.type === 'vidgroup') m.options.forEach((o) => {
          if ((m.text + ' ' + o.label).toLowerCase().includes(q)) results.push({ kind: 'individual_video', subject: s.name, chapter: c.t, chapter_number: ci + 1, topic: m.text, title: o.label, duration: o.dur || null, url: o.url });
        });
      }));
    });
    data.library.forEach((m) => {
      if ((m.name + ' ' + (m.st || '')).toLowerCase().includes(q)) results.push({ kind: 'reference', type: m.type, title: m.name, summary: m.st || '', url: m.url || null });
    });
    out({ query, count: Math.min(results.length, 60), truncated: results.length > 60, results: results.slice(0, 60) });
    break;
  }
  case 'get-mastery-map': {
    const query = args.join(' ').trim();
    const subjects = query ? [resolveSubject(query)].filter(Boolean) : loadStudyData().subjects;
    if (query && !subjects.length) {
      out({ error: 'unknown subject', valid_subjects: loadStudyData().subjects.map((s) => ({ id: s.id, name: s.name })) });
      process.exit(1);
    }
    out({
      method: '任務完成提供初步估計；有練習／考古題正確率後，以35%教材完成度＋65%作答表現計算。沒有作答證據時信心為低，不等同真正掌握。',
      queue: queueStatus(), subjects: masteryMap(subjects),
    });
    break;
  }
  case 'get-smart-dashboard': {
    out(smartLearningSummary());
    break;
  }
  case 'audit-learning-coverage': {
    const subjectQuery = args.shift();
    const chapterQuery = args.join(' ').trim();
    const subject = resolveSubject(subjectQuery);
    const chapterIndex = Number(chapterQuery);
    const chapter = subject && (Number.isInteger(chapterIndex) && chapterIndex > 0
      ? subject.chapters[chapterIndex - 1]
      : subject.chapters.find((c) => c.t.includes(chapterQuery || '') || c.sub.includes(chapterQuery || '')));
    if (!subject || !chapter) {
      out({ error: 'usage: audit-learning-coverage <subject> <chapter>' });
      process.exit(1);
    }
    out(chapterCoverageAudit(subject, chapter, new Set(db.getDoneTaskIds())));
    break;
  }
  case 'record-practice-result': {
    const subjectQuery = args.shift();
    const chapterQuery = args.shift();
    const correct = Number(args.shift());
    const total = Number(args.shift());
    const note = args.join(' ').trim();
    const subject = resolveSubject(subjectQuery);
    const chapterIndex = Number(chapterQuery);
    const chapter = subject && (Number.isInteger(chapterIndex) && chapterIndex > 0
      ? subject.chapters[chapterIndex - 1]
      : subject.chapters.find((c) => c.t.includes(chapterQuery || '') || c.sub.includes(chapterQuery || '')));
    if (!subject || !chapter || !Number.isInteger(correct) || !Number.isInteger(total) || total <= 0 || correct < 0 || correct > total) {
      out({ error: 'usage: record-practice-result <subject> <chapter> <correct> <total> [note]' });
      process.exit(1);
    }
    const chapterKey = stableTaskKey(chapter.t);
    const saved = db.setMasteryEvidence(subject.id, chapterKey, correct, total, note);
    const attempt = db.addQuizAttempt({subject_id:subject.id,chapter_key:chapterKey,correct,total,note});
    const percent = correct/total*100;
    const review = db.setReviewResult(subject.id,chapterKey,percent<50?0:percent<70?1:percent<85?2:3);
    out({ ok: true, subject: subject.name, chapter: chapter.t, saved, attempt, review, mastery: chapterMastery(subject, chapter, new Set(db.getDoneTaskIds()), masteryEvidenceMap()) });
    break;
  }
  case 'record-review-result': {
    const subject=resolveSubject(args.shift()), chapterQuery=args.shift(), quality=Number(args.shift());
    const chapterIndex=Number(chapterQuery);const chapter=subject&&(Number.isInteger(chapterIndex)&&chapterIndex>0?subject.chapters[chapterIndex-1]:subject.chapters.find((c)=>c.t.includes(chapterQuery||'')));
    if(!subject||!chapter||!Number.isInteger(quality)||quality<0||quality>3){out({error:'usage: record-review-result <subject> <chapter> <0-3>'});process.exit(1);}
    out({ok:true,subject:subject.name,chapter:chapter.t,review:db.setReviewResult(subject.id,stableTaskKey(chapter.t),quality)});break;
  }
  case 'log-study-time': {
    const taskId=args.shift(),planned=Number(args.shift()),actual=Number(args.shift()),subjectQuery=args.shift(),chapterQuery=args.join(' ');
    if(!taskId||!Number.isInteger(planned)||planned<=0||!Number.isInteger(actual)||actual<=0){out({error:'usage: log-study-time <task-id> <planned-min> <actual-min> [subject] [chapter]'});process.exit(1);}
    const subject=subjectQuery?resolveSubject(subjectQuery):null;const chapter=subject&&subject.chapters.find((c)=>c.t.includes(chapterQuery||''));
    const row=db.startStudySession(taskId,subject?.id||null,chapter?stableTaskKey(chapter.t):null,planned);out({ok:true,session:db.finishStudySession(row.id,actual),calibration:smartLearningSummary().time_calibration});break;
  }
  case 'set-start-date': {
    const date = args[0];
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      out({ error: 'usage: set-start-date <YYYY-MM-DD>' });
      process.exit(1);
    }
    db.setStartDate(date);
    out({ ok: true, start_date: db.getStartDate(), queue: queueStatus() });
    break;
  }
  case 'mark-done':
  case 'mark-undone': {
    const taskId = args[0];
    if (!taskId || !TASK_ID_RE.test(taskId)) {
      out({ error: 'usage: ' + cmd + ' <task-id>, e.g. w4-book (see get-queue-status for what\'s outstanding)' });
      process.exit(1);
    }
    db.setTaskDone(taskId, cmd === 'mark-done');
    out({ ok: true, queue: queueStatus() });
    break;
  }
  case 'mark-checklist-done':
  case 'mark-checklist-undone': {
    const [date, idxStr] = args;
    const idx = Number(idxStr);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(idx)) {
      out({ error: 'usage: ' + cmd + ' <YYYY-MM-DD> <item_index>' });
      process.exit(1);
    }
    db.setChecklistItem(date, idx, cmd === 'mark-checklist-done');
    out({ ok: true });
    break;
  }
  case 'remember': {
    const text = args.join(' ').trim();
    if (!text) {
      out({ error: 'usage: remember <text>' });
      process.exit(1);
    }
    const id = db.addMemory(text);
    out({ ok: true, id, memories: db.getMemories() });
    break;
  }
  case 'list-memories': {
    out({ memories: db.getMemories() });
    break;
  }
  case 'forget': {
    const id = Number(args[0]);
    if (!Number.isInteger(id)) {
      out({ error: 'usage: forget <id> (see list-memories for ids)' });
      process.exit(1);
    }
    const removed = db.deleteMemory(id);
    out({ ok: removed, memories: db.getMemories() });
    break;
  }
  default: {
    usage();
    process.exit(cmd ? 1 : 0);
  }
}
