// ── Icons ──────────────────────────────────────────────────────────
// Thin-line SVG icons (Feather-style: 24x24 viewBox, stroke=currentColor,
// no fill) replacing emoji throughout the UI, to match the reference
// design language (frosted-glass apps use minimal line icons, not emoji).
const ICON_PATHS = {
  moon:            '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  sun:             '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  sunset:          '<path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="9" x2="12" y2="2"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/><line x1="23" y1="22" x2="1" y2="22"/><polyline points="16 5 12 9 8 5"/>',
  'book-open':     '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  link:            '<path d="M15 7h3a5 5 0 0 1 5 5 5 5 0 0 1-5 5h-3"/><path d="M9 12h6"/><path d="M9 7H6a5 5 0 0 0-5 5 5 5 0 0 0 5 5h3"/>',
  'message-circle':'<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  'trending-up':   '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  bookmark:        '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  'alert-triangle':'<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  target:          '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  clipboard:       '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>',
  'check-circle':  '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  clock:           '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
  x:               '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  check:           '<polyline points="20 6 9 17 4 12"/>',
  'chevron-left':  '<polyline points="15 18 9 12 15 6"/>',
  'chevron-right': '<polyline points="9 18 15 12 9 6"/>',
  film:            '<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>',
  calendar:        '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  'alert-octagon': '<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
};
function svgIcon(name, size){
  const s = size || 16;
  const d = ICON_PATHS[name] || '';
  return '<svg class="ic" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg>';
}

// Stable task IDs are derived from content, never array position. This keeps
// completion records attached to the same chapter/material after future edits.
function stableTaskKey(value){
  const text = String(value || '').trim().toLowerCase();
  let hash = 2166136261;
  for(let i=0;i<text.length;i++){
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
function videoSeriesName(label){
  const text = String(label || '');
  const rules = [
    [/林軒田/,'台大 林軒田 DSA'],[/彭文志/,'交大OCW 彭文志'],[/江蕙如/,'交大OCW 江蕙如'],
    [/易志偉/,'交大OCW 易志偉'],[/周志遠/,'清大OCW 周志遠'],[/趙啟超/,'清大OCW 趙啟超'],
    [/黃婷婷/,'清大 黃婷婷'],[/韓永楷/,'清大 韓永楷'],[/Abdul Bari/i,'Abdul Bari'],
    [/3Blue1Brown/i,'3Blue1Brown'],[/MIT(?: OCW)? 6\.006/i,'MIT OCW 6.006'],
    [/MIT(?: OCW)? 18\.06/i,'MIT OCW 18.06']
  ];
  for(let i=0;i<rules.length;i++) if(rules[i][0].test(text)) return rules[i][1];
  return '精選單篇';
}
function videoSequenceNumber(label, fallback){
  const text = String(label || '');
  const patterns = [/\bLec\s*0*(\d+)/i,/\bLecture\s*0*(\d+)/i,/第\s*0*(\d+)講/i,/\bL\s*0*(\d+)\b/i,/\bCh(?:apter)?\s*0*(\d+)/i,/^\s*0*(\d+)[.：\s]/];
  for(let i=0;i<patterns.length;i++){
    const m = text.match(patterns[i]);
    if(m) return Number(m[1]);
  }
  return 10000 + fallback;
}
function groupVideoSeries(options){
  const groups = [];
  const map = {};
  options.forEach(function(option,index){
    const name = videoSeriesName(option.label);
    if(!map[name]){
      map[name] = {name:name,options:[],firstIndex:index};
      groups.push(map[name]);
    }
    map[name].options.push(Object.assign({},option,{sourceIndex:index,sequence:videoSequenceNumber(option.label,index)}));
  });
  groups.forEach(function(group){
    group.options.sort(function(a,b){ return a.sequence-b.sequence || a.sourceIndex-b.sourceIndex; });
    group.topics = Array.from(new Set(group.options.map(function(o){ return o.topic; }).filter(Boolean)));
  });
  return groups.sort(function(a,b){ return a.firstIndex-b.firstIndex; });
}
function chapterDisplayMaterials(c){
  const firstVideoIndex = c.mats.findIndex(function(m){ return m.type === 'vid' || m.type === 'vidgroup'; });
  const videoOptions = [];
  c.mats.forEach(function(m){
    if(m.type === 'vidgroup') m.options.forEach(function(o){ videoOptions.push(Object.assign({},o,{topic:m.text})); });
    else if(m.type === 'vid') videoOptions.push({label:m.text,url:m.url,dur:m.dur,note:m.note,topic:''});
  });
  const display = [];
  c.mats.forEach(function(m, sourceIndex){
    if(sourceIndex === firstVideoIndex && videoOptions.length){
      display.push({type:'vidgroup',text:'本章影片',options:videoOptions,series:groupVideoSeries(videoOptions),taskKey:'video'});
    }
    if(m.type !== 'vid' && m.type !== 'vidgroup'){
      const copy = Object.assign({},m);
      copy.taskKey = m.type+'-'+stableTaskKey(m.text || String(sourceIndex));
      display.push(copy);
    }
  });
  return display;
}
function chapterMaterialTaskId(subjectId, chapter, material){
  return 'mat-v2-'+subjectId+'-'+stableTaskKey(chapter.t)+'-'+material.taskKey;
}
function weekMaterialTasks(wk){
  const rows = [];
  SUBJECTS.forEach(function(s){
    s.chapters.forEach(function(c){
      if(c.wk !== wk) return;
      chapterDisplayMaterials(c).forEach(function(m){
        rows.push({id:chapterMaterialTaskId(s.id,c,m),type:m.type});
      });
    });
  });
  return rows;
}
async function syncFoundationWeek(wk){
  if(!wk) return;
  const rows = weekMaterialTasks(wk);
  if(!rows.length) return;
  const done = new Set(DONE_TASK_IDS);
  const groups = {
    video:rows.filter(function(r){ return r.type === 'vidgroup'; }),
    book:rows.filter(function(r){ return r.type === 'book'; }),
    practice:rows.filter(function(r){ return r.type === 'ex'; }),
    notes:rows.filter(function(r){ return r.type === 'rec'; })
  };
  const allDone = rows.every(function(r){ return done.has(r.id); });
  const targets = {
    video:groups.video.length > 0 && groups.video.every(function(r){ return done.has(r.id); }),
    book:groups.book.length > 0 && groups.book.every(function(r){ return done.has(r.id); }),
    practice:groups.practice.length > 0 && groups.practice.every(function(r){ return done.has(r.id); }),
    notes:groups.notes.length ? groups.notes.every(function(r){ return done.has(r.id); }) : allDone,
    review:allDone
  };
  await Promise.all(Object.keys(targets).map(function(type){
    return fetch('/api/tasks/w'+wk+'-'+type+'/set', {
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({done:targets[type]})
    });
  }));
  await fetchDoneTasks();
}

// ── Constants ──────────────────────────────────────────────────────
const EXAM_DATE = new Date('2027-02-01');
const FOUNDATION_WEEKS = 19; // weeks of chapter-by-chapter foundation from start date
const CONVERGENCE_DAYS = 21; // last N days before exam = pure convergence, no new material
// Subject overview uses one canonical YouTube playlist link per adopted
// course. Individual watch links stay inside chapter tasks below.
const SUBJECT_PLAYLISTS = {
  ds:[
    {name:'交大OCW 彭文志《資料結構》',url:'https://www.youtube.com/playlist?list=PLj6E8qlqmkFusQlwukXMUDVdYfd7oPyr3'},
    {name:'台大 林軒田《Data Structures and Algorithms》',url:'https://www.youtube.com/playlist?list=PLXVfgk9fNX2Kda9rttSvGROCtRQ3Sb8bA'},
    {name:'MIT OCW 6.006《Introduction to Algorithms》',url:'https://www.youtube.com/playlist?list=PLUl4u3cNGP61Oq3tWYp6V_F-5jb5L2iHb'}
  ],
  alg:[
    {name:'MIT OCW 6.006《Introduction to Algorithms》',url:'https://www.youtube.com/playlist?list=PLUl4u3cNGP61Oq3tWYp6V_F-5jb5L2iHb'},
    {name:'交大OCW 江蕙如《演算法》',url:'https://www.youtube.com/playlist?list=PLj6E8qlqmkFtoRpLn6IXnH_eboef-3QvZ'}
  ],
  os:[
    {name:'清大OCW 周志遠《作業系統》',url:'https://www.youtube.com/playlist?list=PLS0SUwlYe8czigQPzgJTH2rJtwm0LXvDX'}
  ],
  la:[
    {name:'MIT OCW 18.06《Linear Algebra》Gilbert Strang',url:'https://www.youtube.com/playlist?list=PL49CF3715CB9EF31D'},
    {name:'3Blue1Brown《Essence of Linear Algebra》',url:'https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab'},
    {name:'3Blue1Brown《Essence of Calculus》',url:'https://www.youtube.com/playlist?list=PLZHQObOWTQDMsr9K-rj53DwVRMYO3t5Yr'}
  ],
  dm:[
    {name:'交大OCW 易志偉《離散數學》',url:'https://www.youtube.com/playlist?list=PLj6E8qlqmkFu0DqDkiub6adY9HBkEsNNG'},
    {name:'清大OCW 趙啟超《離散數學》',url:'https://www.youtube.com/playlist?list=PLS0SUwlYe8cyaHfrgAVaaKVNkwLYNsTA2'}
  ],
  ca:[
    {name:'清大 黃婷婷《計算機結構》',url:'https://www.youtube.com/playlist?list=PLS0SUwlYe8czszh6M74JCU0mIUL_ymBbe'}
  ]
};
// Soft target for finishing all foundation content — later than this and
// there's less runway left for 刷題期 before 收斂期 kicks in. This is a pace
// warning threshold, not a hard cutoff: the queue itself only hard-stops at
// EXAM_DATE - CONVERGENCE_DAYS.
//
// 2026/8/20: recomputed for the 19-week plan (was 11/18, calibrated to the
// old 13-week plan). NOT "19 weeks × 7 days" (that assumes a full calendar
// week of work per queue-week, but most weeks only need ~2.5–3.5 work-days
// at 6hr/day — using 7 gave an unrealistically loose 46%-of-capacity buffer
// that would never trigger the pace warning even when genuinely behind).
// Set to match the illustrative 5-day-per-week calendar in data.js's
// WK_FOUND (which lands foundation's last block on 11/17–11/21) so the AI
// card's pace warning and the 日程與時程 reference page agree on when
// foundation is "supposed to" wrap — both derived from the same ~304.5hr
// total, giving a comparable buffer to the original 13-week plan.
// 11/22–11/28 is reserved as a recovery window. If the queue finishes on
// time, drilling starts immediately; if real life interrupts a few days,
// foundation can roll into this week without consuming the 10% safety margin.
const FOUNDATION_TARGET_DATE = new Date('2026-11-29');

// ── State ──────────────────────────────────────────────────────────
// SETTINGS is loaded from the server (SQLite-backed) in init(); everything
// that used to read localStorage now reads/writes through the API instead.
let SETTINGS = { start_date: new Date().toISOString().slice(0,10) };
// Cache of completed task ids (foundation-phase queue). Fetched in init()
// and refreshed after every toggle — dayInfo() reads this synchronously,
// same pattern as SETTINGS.
let DONE_TASK_IDS = [];
// { "2026-08-21": ["w1-video-0","w1-book"], ... } — which real calendar date
// each task was actually completed on. Lets the Today page and calendar show
// genuine history instead of only the queue's current pointer, which used to
// make finished tasks disappear the moment the queue advanced past them.
let TASK_DONE_DATES = {};
let LEARNING_EVIDENCE = {sessions:[],attempts:[],reviews:[],mastery:[]};

async function fetchSettings(){
  const r = await fetch('/api/settings');
  SETTINGS = await r.json();
  return SETTINGS;
}
async function fetchDoneTasks(){
  try{
    const r = await fetch('/api/tasks/done');
    DONE_TASK_IDS = expandQueueDoneIds((await r.json()).done || []);
  }catch(e){
    DONE_TASK_IDS = [];
  }
  try{
    const r2 = await fetch('/api/tasks/done-dates');
    TASK_DONE_DATES = (await r2.json()).dates || {};
  }catch(e){
    TASK_DONE_DATES = {};
  }
  return DONE_TASK_IDS;
}
async function fetchLearningEvidence(){
  try{
    const r = await fetch('/api/learning/evidence');
    if(r.ok) LEARNING_EVIDENCE = await r.json();
  }catch(e){ LEARNING_EVIDENCE = {sessions:[],attempts:[],reviews:[],mastery:[]}; }
  return LEARNING_EVIDENCE;
}

function expandQueueDoneIds(ids){
  const expanded = new Set(ids || []);
  SUBJECTS.forEach(function(s){
    s.chapters.forEach(function(c){
      if(!c.wk) return;
      const reviewDone = expanded.has('w'+c.wk+'-review');
      chapterDisplayMaterials(c).forEach(function(m){
        const queueType = m.type === 'vidgroup' ? 'video' : m.type === 'book' ? 'book' : m.type === 'ex' ? 'practice' : 'notes';
        if(reviewDone || expanded.has('w'+c.wk+'-'+queueType)) expanded.add(chapterMaterialTaskId(s.id,c,m));
      });
    });
  });
  return Array.from(expanded);
}

function startDate(){
  const d = new Date(SETTINGS.start_date); d.setHours(0,0,0,0); return d;
}

function isoDate(d){
  const t = new Date(d); t.setHours(12,0,0,0);
  return t.toISOString().slice(0,10);
}

function isToday(d){
  return isoDate(d) === isoDate(new Date());
}

// ── Day info ──────────────────────────────────────────────────────
// Foundation content is now queue-driven, not date-driven: `wk` comes from
// getFoundationQueueStatus() (the week of your first undone task), not from
// counting days since start_date. Falling behind means today keeps showing
// that same undone week instead of silently jumping to "new" content —
// finishing early lets it advance past what the calendar alone would imply.
// Drilling/convergence remain date-driven (they're recurring daily practice,
// not finite content to drain), and convergence is a hard cutoff tied to
// EXAM_DATE regardless of queue state — the exam date itself doesn't move.
// Weekly drilling-phase subject rotation. Tue/Wed/Thu/Fri are the four
// active weekday slots (Mon is 打工, Sun is rest, Sat is the mock-exam
// day) — six subjects don't divide evenly into four slots, so this
// alternates two week patterns to cover all six every 2 weeks. This is
// also a corrected version of a real bug where the old rotation (subMap
// keyed 1-6 to weekday number) silently gave 資料結構 the day-off slot
// (Monday) so it never appeared, and never included 計算機組織 at all.
//
// 數學（線性代數＋離散數學）gets double weight — 2 of every 4 weekday slots
// across the 2-week cycle — per the user's explicit call after reviewing
// two rounds of conflicting research: one strand said 演算法 is the hardest
// subject and needs extra reps; another strand (multiple independent
// examinee accounts) argued the opposite — that 演算法 has comparatively
// low ROI on additional drilling time, and 數學 is "the one subject that
// actually swings your score" since it's the most learnable-to-mastery
// subject relative to time invested. The user resolved this in favor of
// prioritizing 數學; 演算法/資料結構/作業系統/計算機組織 each still get a
// slot every 2 weeks so none of them go fully unpracticed.
// Week parity anchors to the plan's own start_date (not to when drilling
// actually began, since that's completion-driven and varies per user).
const DRILL_WEEK_A = {2:'資料結構', 3:'線性代數', 4:'作業系統', 5:'離散數學'};
const DRILL_WEEK_B = {2:'線性代數', 3:'演算法', 4:'計算機組織', 5:'離散數學'};
function drillingSubject(t, dow){
  const days = Math.floor((t - startDate()) / 86400000);
  const parity = ((Math.floor(days / 7) % 2) + 2) % 2; // normalize to 0/1 regardless of sign
  const map = parity === 0 ? DRILL_WEEK_A : DRILL_WEEK_B;
  return map[dow] || '複習整理';
}

function dayInfo(d){
  const t = new Date(d); t.setHours(12,0,0,0);
  const dow = t.getDay();
  const examLeft = Math.ceil((EXAM_DATE - t) / 86400000);
  const isRest = dow === 0; // Sunday: 完全休息
  const isDayOff = dow === 1; // Monday: 固定去媽媽公司幫忙，不排讀書任務

  const convergeStart = new Date(EXAM_DATE); convergeStart.setDate(convergeStart.getDate() - CONVERGENCE_DAYS);
  const queueStatus = getFoundationQueueStatus(DONE_TASK_IDS);

  let phase, wk; // phase: 'foundation' | 'drilling' | 'converge'
  if(t >= convergeStart){
    phase = 'converge';
    wk = FOUNDATION_WEEKS;
  } else if(queueStatus.undoneCount > 0){
    phase = 'foundation';
    wk = queueStatus.effectiveWeek;
  } else {
    phase = 'drilling';
    wk = FOUNDATION_WEEKS;
  }
  const phase2 = phase !== 'foundation'; // kept for legacy checks (true once past foundation)

  const ps = phase === 'foundation' ? '基礎' : phase === 'drilling' ? '刷題' : '收斂';
  let hrs = '~5hr';
  if(isRest) hrs = '休息日';
  else if(isDayOff) hrs = '打工';
  else if(phase === 'drilling') hrs = '~7hr';
  else if(phase === 'converge') hrs = '~3hr';
  const drillSubj = phase === 'drilling' ? drillingSubject(t, dow) : null;
  return {dow, wk, examLeft, ps, isDayOff, isRest, phase, phase2, hrs, queueStatus, drillSubj};
}

// ── Schedule content (accurate per chapter, not generic playlist) ──
// Maps each week to specific subject+chapter. Order is DM → DS → LA → ALG
// → CA → OS: research (PTT/prep-blog consensus + TKB's official 資工所
// guide) converged on math (離散+線代) needing to come BEFORE 演算法,
// since algorithm analysis leans on discrete math's logic/recursion/
// counting/graph-theory groundwork.
//
// 2026/8/21: swapped 離散數學 in front of 資料結構 (was DS W1–4 → DM
// W5–9; now DM W1–5 → DS W6–9). User pushed back on "資結先" — a real
// admitted-台清交 student's HackMD write-up (十週考上台清交資工所) shows
// discrete math starting before data structures in their actual schedule.
// It's one primary source, not a sweeping consensus (a pixnet blog article
// that an earlier search summary implied said "math first" turned out, on
// fetching the actual page, to say no such thing — that citation was
// dropped), but it's real and it directly contradicts DS-first, so the
// order changed. Linear algebra stays after both, unaffected — that
// student's account didn't treat LA as part of the main sequence either.
//
// 2026/8/20 rework: expanded 13→19 weeks after cross-checking against
// book-toc.md (the user's real textbook tables of contents). The old
// 13-week plan silently omitted real chapters (DS Graph/Search&Sort, ALG
// Graph Algorithms/NP-completeness, CA's whole 數位邏輯 prerequisite +
// several chapters, DM generating functions/trees/FSM, OS disk
// scheduling/file systems) and misplaced some (AVL Tree is really in DS
// Ch9, not Ch5). Genuinely low-yield chapters (confirmed via researched
// exam-frequency: LA Jordan Form, DM Polya counting, ALG computational
// geometry/misc, CA Ch9 IC fabrication) are deliberately left OUT of the
// queue — they're 選讀, picked up during 刷題期 only if a past exam
// question actually needs them, not silently missing. See README.md
// changelog for details.
//
// `vid` entries without a `url` are topics where no specific single video
// has been verified yet (many prior citations turned out to be whole
// playlists or bare channel links, not the specific video claimed) — the
// task still exists so it isn't silently dropped, it just isn't a
// clickable link until re-verified.
const FOUNDATION_CONTENT = {
    1: {subj:'離散數學', ch:'DM Ch1 邏輯（命題與真值表、邏輯等價）+ Ch2 集合論（集合論、排容原理）',
        book:'離散上冊（林緯）Ch1–Ch2',
        vid:[{icon:'🎬',text:'交大OCW 易志偉《離散數學》Lec01 Logic and Proofs (1/5)',url:'https://www.youtube.com/watch?v=klWl-t7V5qY',dur:'1:21:01'},
             {icon:'🎬',text:'交大OCW 易志偉《離散數學》Lec02 Logic and Proofs (2/5)',url:'https://www.youtube.com/watch?v=ih43BS7GsNY',dur:'36:23'},
             {icon:'🎬',text:'The Principle of Inclusion-Exclusion',url:'https://www.youtube.com/watch?v=YlKDp03Kg68',dur:'17:35'}]},
    2: {subj:'離散數學', ch:'DM Ch3 函數（可數/不可數集、鴿籠原理）+ Ch4 數學歸納法與數論（數學歸納法、質數）',
        book:'離散上冊（林緯）Ch3–Ch4',
        vid:[{icon:'🎬',text:'TrevTutor：Pigeonhole Principle',url:'https://www.youtube.com/watch?v=2-mxYrCNX60',dur:'16:46'},
             {icon:'🎬',text:'Proof Using Mathematical Induction — Summation Formulae',url:'https://www.youtube.com/watch?v=ZJeBDVMbhJE',dur:'23:24'}]},
    3: {subj:'離散數學', ch:'DM Ch5 組合計數（排列組合、二項式係數）+ Ch6 生成函數（一般/指數生成函數）+ Ch7 遞迴關係式（求解法、轉換法）——研究確認這三章是「最容易拿分」的必考點',
        book:'離散上冊（林緯）Ch5–Ch7',
        vid:[{icon:'🎬',text:'Generating Functions | Part 1',url:'https://www.youtube.com/watch?v=tA2cqfNh5EM',dur:'31:07'},
             {icon:'🎬',text:'Solving Recurrences Using Substitution Method',url:'https://www.youtube.com/watch?v=dVPDdHE3RJU',dur:'13:12'}]},
    4: {subj:'離散數學', ch:'DM Ch8 圖論I（基本定義、路徑、連通、最短路徑）+ Ch9 圖論II（著色問題、平面圖、流量）+ Ch10 樹（生成樹、有根樹、最佳樹）',
        book:'離散下冊（林緯）Ch8–Ch10',
        vid:[{icon:'🎬',text:'交大OCW 易志偉《離散數學》Lec22 Graphs (1/3)',url:'https://www.youtube.com/watch?v=q0Vy0gQCB_g',dur:'1:23:28'},
             {icon:'🎬',text:'交大OCW 易志偉《離散數學》Lec23 Graphs (2/3)',url:'https://www.youtube.com/watch?v=y4sLC9zeEvU',dur:'40:14'},
             {icon:'🎬',text:'交大OCW 易志偉《離散數學》Lec24 Graphs (3/3)',url:'https://www.youtube.com/watch?v=P2FRYshQ57s',dur:'1:27:09'},
             {icon:'🎬',text:'Spanning Tree：Discrete Mathematics',url:'https://www.youtube.com/watch?v=6WZvVJ0Q1FA',dur:'43:05'}]},
    5: {subj:'離散數學', ch:'DM Ch11 二元關係及其應用（等價關係、偏序集、布林代數）+ Ch12 代數結構（群、環與體）+ Ch13 有限狀態機（清大每年必考）',
        book:'離散下冊（林緯）Ch11–Ch13',
        vid:[{icon:'🎬',text:'Equivalence Relation',url:'https://www.youtube.com/watch?v=RexPywlCmV8',dur:'6:29'},
             {icon:'🎬',text:'Neso Academy：Finite State Machine（Finite Automata）',url:'https://www.youtube.com/watch?v=Qa6csfkK7_I',dur:'11:05'}]},
    6: {subj:'資料結構', ch:'Ch1 基本概念（複雜度分析、Big-O/Θ/Ω、Master Method）+ Ch2 陣列與結構（Array）+ Ch3 堆疊與佇列（Stack/Queue）',
        book:'資結七版（洪逸）Ch1–Ch3',
        vid:[{icon:'🎬',text:'交大OCW 彭文志《資料結構》Ch1 Introduction',url:'https://www.youtube.com/watch?v=3503j2L6qNA',dur:'1:10:42'},
             {icon:'🎬',text:'Time Complexity of a Computer Program',url:'https://www.youtube.com/watch?v=V42FBiohc6c',dur:'9:42'}]},
    7: {subj:'資料結構', ch:'Ch4 鏈結串列（Linked List各類型）+ Ch5 樹與二元樹（Tree & Binary Tree、走訪Traversal【非常重要】）',
        book:'資結七版（洪逸）Ch4–Ch5',
        vid:[{icon:'🎬',text:'Linked List Introduction & Concepts',url:'https://www.youtube.com/watch?v=akErwS16DUg',dur:'27:07'},
             {icon:'🎬',text:'Binary Tree Traversals（Inorder, Preorder, Postorder）',url:'https://www.youtube.com/watch?v=-b2lciNd2L4',dur:'11:07'}]},
    8: {subj:'資料結構', ch:'Ch6 圖形（表示法、Traversal、Spanning Tree、最短路徑、拓撲排序）+ Ch7 搜尋與排序（Search、Sort）',
        book:'資結七版（洪逸）Ch6–Ch7',
        vid:[{icon:'🎬',text:'Abdul Bari：Graph Traversals - BFS & DFS',url:'https://www.youtube.com/watch?v=pcKY4hjDrxk',dur:'18:30'},
             {icon:'🎬',text:'Abdul Bari：Merge Sort',url:'https://www.youtube.com/watch?v=mB5HXBb_HY8',dur:'20:23'},
             {icon:'🎬',text:'Abdul Bari：Quick Sort',url:'https://www.youtube.com/watch?v=7h1s2SojIRw',dur:'13:42'}]},
    9: {subj:'資料結構', ch:'Ch8 雜湊（Hashing、衝突處理）+ Ch9 高等樹結構（Heap、AVL樹、2-3樹、紅黑樹、B樹）',
        book:'資結七版（洪逸）Ch8–Ch9',
        vid:[{icon:'🎬',text:'What is a HashTable Data Structure',url:'https://www.youtube.com/watch?v=MfhjkfocRR0',dur:'7:37'},
             {icon:'🎬',text:'Abdul Bari：Heap',url:'https://www.youtube.com/watch?v=HqPJF2L5h9U',dur:'51:08'},
             {icon:'🎬',text:'MIT 6.006：AVL Trees, AVL Sort',url:'https://www.youtube.com/watch?v=FNeL18KsWPc',dur:'51:59'}]},
    10:{subj:'線性代數', ch:'LA Ch1 矩陣（定義與運算）+ Ch2 線性方程組與求解（高斯消去、行列式）+ Ch3 向量空間 + Ch4 線性映射',
        book:'線代上冊（林緯）Ch1–Ch4',
        vid:[{icon:'🎬',text:'MIT 18.06 L1：Geometry of Linear Equations',url:'https://www.youtube.com/watch?v=ZK3O402wf1c',dur:'39:49'},
             {icon:'🎬',text:'MIT 18.06 L2：Elimination',url:'https://www.youtube.com/watch?v=QVKj3LADCnA',dur:'47:41'},
             {icon:'🎬',text:'MIT 18.06 L18：Determinants',url:'https://www.youtube.com/watch?v=srxexLishgY',dur:'49:12'},
             {icon:'🎬',text:'MIT 18.06 L9：Four Fundamental Subspaces',url:'https://www.youtube.com/watch?v=nHlE7EgJFds',dur:'49:20'}]},
    11:{subj:'線性代數', ch:'LA Ch5 對角化理論（特徵值/特徵向量、對角化、Cayley-Hamilton）+ Ch7 內積空間（Gram-Schmidt正交化）+ Ch8 各內積算子（SVD）——Ch6 Jordan Form基礎要知道，深入題型可選擇性放（曾有考生反映意外被考到，別完全跳過）',
        book:'線代下冊（林緯）Ch5、Ch7–Ch8',
        vid:[{icon:'🎬',text:'MIT 18.06 L21：Eigenvalues',url:'https://www.youtube.com/watch?v=cdZnhQjJu4I',dur:'51:22'},
             {icon:'🎬',text:'3Blue1Brown：Eigenvectors',url:'https://www.youtube.com/watch?v=PFDu9oVAE-g',dur:'17:15'},
             {icon:'🎬',text:'MIT 18.06 L29：SVD',url:'https://www.youtube.com/watch?v=TX_vooSnhm8',dur:'40:28'}]},
    12:{subj:'演算法', ch:'ALG Ch1 Analyzing Algorithms（Asymptotic notation、Recurrence relation、Amortized analysis）+ Ch2 Divide-and-Conquer（Maximum subarray、Matrix multiplication、Closest pair）',
        book:'演算法~1~ Ch1–Ch2',
        vid:[{icon:'🎬',text:'Abdul Bari：Merge Sort（分治法範例）',url:'https://www.youtube.com/watch?v=mB5HXBb_HY8',dur:'20:23'},
             {icon:'🎬',text:"Master's Theorem Explained",url:'https://www.youtube.com/watch?v=SLsHKh_OUEM',dur:'7:19'}]},
    13:{subj:'演算法', ch:'ALG Ch3 Dynamic Programming（Rod cutting、Knapsack、Matrix-chain、Optimal BST、LCS、KMP）——全科最重的一章',
        book:'演算法~1~ Ch3',
        vid:[{icon:'🎬',text:'MIT 6.006 L11：DP I',url:'https://www.youtube.com/watch?v=OQ5jsbhAv_M',dur:'51:47'},
             {icon:'🎬',text:'MIT 6.006 L12：DP II',url:'https://www.youtube.com/watch?v=ENyox7kNKeY',dur:'52:11'},
             {icon:'🎬',text:'MIT 6.006 L14：DP IV（Matrix Chain）',url:'https://www.youtube.com/watch?v=ocZMDMZwhCY',dur:'52:41'},
             {icon:'🎬',text:'Abdul Bari：Matrix Chain Multiplication',url:'https://www.youtube.com/watch?v=_WncuhSJZyA',dur:'52:01'}]},
    14:{subj:'演算法', ch:'ALG Ch4 Graph Algorithms（BFS、DFS、Shortest Paths、MST、Max Flow）+ Ch6 NP-completeness（研究確認清大常考）——Ch5計算幾何、Ch7其他問題較低頻，留到刷題期',
        book:'演算法~1~ Ch4、Ch6',
        vid:[{icon:'🎬',text:'Abdul Bari：BFS（Breadth First Search）',url:'https://www.youtube.com/watch?v=pcKY4hjDrxk',dur:'18:30'},
             {icon:'🎬',text:'WilliamFiset：DFS（Depth First Search）',url:'https://www.youtube.com/watch?v=7fujbpJ0LB4',dur:'10:20'},
             {icon:'🎬',text:'Tushar Roy：Topological Sort',url:'https://www.youtube.com/watch?v=ddTC4Zovtbc',dur:'10:31'},
             {icon:'🎬',text:'Tushar Roy：Strongly Connected Components',url:'https://www.youtube.com/watch?v=RpgcYiky7uw',dur:'24:29'},
             {icon:'🎬',text:'Theory of Computation：P, NP, NP-Complete and NP-Hard',url:'https://www.youtube.com/watch?v=tIE2lkJv20c',dur:'5:06'}]},
    15:{subj:'計算機組織', ch:'《數位邏輯講義》Ch1–Ch3（二進位系統、布林代數、組合邏輯，精簡讀過即可）+ CA Ch1 指令（MIPS、ISA）+ Ch2 計算機算術（IEEE 754浮點數）',
        book:'數位邏輯講義 Ch1–Ch3（精簡）+ 計組上冊（張凡）Ch1–Ch2',
        vid:[{icon:'🎬',text:'Neso Academy：Logic Gates（Part 2）',url:'https://www.youtube.com/watch?v=iogRGu7nbJw',dur:'14:14'},
             {icon:'🎬',text:'IEEE 754 Floating Point Representation（Single & Double Precision）',url:'https://www.youtube.com/watch?v=sKxdXfH5qko',dur:'12:42'}]},
    16:{subj:'計算機組織', ch:'CA Ch3 效能評估（Amdahl定律）+ Ch4 處理器資料路徑 + Ch5 管線（Pipeline Hazard，最重要）+ Ch6 記憶體階層與Cache（AMAT計算，最重要）——Ch7儲存裝置、Ch8多重處理器、Ch9基本概念較低頻，留到刷題期',
        book:'計組上冊（張凡）Ch3–Ch5 + 計組下冊 Ch6',
        vid:[{icon:'🎬',text:'Pipeline Hazards（Structural, Data and Control Hazards）',url:'https://www.youtube.com/watch?v=t27kbXWP5GY',dur:'15:37'},
             {icon:'🎬',text:'Average Memory Access Time（AMAT）— Computer Organization',url:'https://www.youtube.com/watch?v=Y1esjWBTf7Q',dur:'6:54'}]},
    17:{subj:'作業系統', ch:'OS Ch1 導論 + Ch2 Computer System Architecture（Dual Mode、特權指令）+ Ch3 系統作業結構（System Call、Layered/Microkernel）+ Ch4 處理程序（Process、CPU排程FCFS/SJF/RR/Priority）',
        book:'金寶典四版（洪逸）Ch1–Ch4 + Q講義Q1–Q2',
        vid:[{icon:'🎬',text:'清大OCW 周志遠《作業系統》第1A講',url:'https://www.youtube.com/watch?v=3PfL2WIS22o',dur:'15:57'},
             {icon:'🎬',text:'清大OCW 周志遠《作業系統》第1B講',url:'https://www.youtube.com/watch?v=QK63Mw9hPec',dur:'16:13'},
             {icon:'🎬',text:'清大OCW 周志遠《作業系統》第1C講',url:'https://www.youtube.com/watch?v=wzRwuRrUzNQ',dur:'24:14'},
             {icon:'🎬',text:'清大OCW 周志遠 第9A講 Ch3:Processes Concept',url:'https://www.youtube.com/watch?v=dDghjse91lE',dur:'35:59'},
             {icon:'🎬',text:'清大OCW 周志遠 第9B講 Ch3:Processes Concept',url:'https://www.youtube.com/watch?v=iFRv7y8i7Sw',dur:'11:01'}]},
    18:{subj:'作業系統', ch:'OS Ch5 死結 Dead Lock（必要條件、預防、Banker Algorithm）+ Ch6 處理程序的協調（Critical Section、Semaphore、Monitor）',
        book:'金寶典 Ch5–Ch6 + Q講義Q3–Q4',
        vid:[{icon:'🎬',text:'Gate Smashers：Banker Algorithm',url:'https://www.youtube.com/watch?v=7gMLNiEz3nw',dur:'24:04'},
             {icon:'🎬',text:'Process Synchronisation | Critical Section Problem',url:'https://www.youtube.com/watch?v=sEVfeXqWY-s',dur:'13:32'}]},
    19:{subj:'作業系統', ch:'OS Ch7 記憶管理（Paging、Segmentation）+ Ch8 虛擬記憶體（Page Replacement Algorithms）+ Ch9 輔助儲存體管理（磁碟排程SCAN/C-SCAN）+ Ch10 檔案系統——基礎期最後一週',
        book:'金寶典 Ch7–Ch10 + Q講義Q5–Q6',
        vid:[{icon:'🎬',text:'Page Replacement Algorithms（LRU and Optimal）',url:'https://www.youtube.com/watch?v=DXU7SqsYDvg',dur:'16:18'},
             {icon:'🎬',text:'SCAN Disk Scheduling Algorithm',url:'https://www.youtube.com/watch?v=ko8ogLJc1Ko',dur:'5:40'}]},
};
// Week-specific task text (matches FOUNDATION_CONTENT — same DM→DS→LA→
// ALG→CA→OS order, see the comment there for why). Shared by getChecklist()
// and buildFoundationTasks() so the two never drift out of sync.
const FOUNDATION_TASK_TEXT = {
    1: {subj:'離散數學',
        am:'讀《離散上冊》Ch1 邏輯（命題與真值表、邏輯等價）+ Ch2 集合論（集合論、排容原理）',
        pm:'真值表練習 × 5 題 + 排容原理應用題 × 3 題',
        vid:'看 交大易志偉 Logic and Proofs + The Principle of Inclusion-Exclusion',
        note:'排容原理其實是Ch2（跟集合論同一章），不是跟圖論放一起'},
    2: {subj:'離散數學',
        am:'讀《離散上冊》Ch3 函數（鴿籠原理）+ Ch4 數學歸納法與數論（數學歸納法、質數）',
        pm:'鴿籠原理應用題 × 3 題 + 數學歸納法完整證明 × 5 題',
        vid:'看 Neso Academy：Pigeonhole Principle + Mathematical Induction',
        note:'數學歸納法的證明格式要練到能一次寫對，演算法正確性證明會一直用到'},
    3: {subj:'離散數學',
        am:'讀《離散上冊》Ch5 組合計數（排列組合、二項式係數）+ Ch6 生成函數 + Ch7 遞迴關係式（求解法）',
        pm:'排列組合應用題 × 10 題 + 生成函數求解 × 3 題 + 遞迴關係式求通解 × 5 題',
        vid:'看 Generating Functions Part 1 + Solving Recurrences Using Substitution Method',
        note:'組合計數、生成函數與遞迴關係式是高頻題型，先寫清楚初始條件再計算'},
    4: {subj:'離散數學',
        am:'讀《離散下冊》Ch8 圖論I（路徑、連通、最短路徑）+ Ch9 圖論II（著色、平面圖）+ Ch10 樹（生成樹）',
        pm:'Euler/Hamilton路徑判斷 × 3 題 + 圖著色問題 × 2 題 + 生成樹手畫 × 3 題',
        vid:'看 交大易志偉 Lec22 Graphs + Spanning Tree：Discrete Mathematics',
        note:'圖論與樹一起讀，生成樹可同時銜接資料結構的圖演算法'},
    5: {subj:'離散數學',
        am:'讀《離散下冊》Ch11 二元關係及其應用（等價關係、偏序集、布林代數）+ Ch12 代數結構（群）+ Ch13 有限狀態機',
        pm:'等價關係判斷 × 3 題 + Boolean Algebra基本運算 × 5 題 + 有限狀態機設計 × 2 題',
        vid:'看 Equivalence Relation + Neso Academy：Finite State Machine',
        note:'有限狀態機與二元關係列為重點；玻里亞計數掌握基礎公式即可'},
    6: {subj:'資料結構',
        am:'讀《資結七版》Ch1 基本概念（複雜度分析、Master Method）+ Ch2 陣列與結構 + Ch3 堆疊與佇列',
        pm:'做課本後附練習題 Ch1–Ch3（至少各5題）',
        vid:'看 Abdul Bari：Asymptotic Notations（20分鐘）',
        note:'在書上標記 Master Theorem 三種情況'},
    7: {subj:'資料結構',
        am:'讀《資結七版》Ch4 鏈結串列（各類型LL）+ Ch5 樹與二元樹（5-5走訪【非常重要】）',
        pm:'手寫Circular Queue操作 × 5題 + 給定一棵樹手寫三種走訪結果 × 5題',
        vid:'看 Abdul Bari：Linked List Introduction + Binary Tree Traversals',
        note:'走訪程式碼抄一遍，用手跑過一棵樹'},
    8: {subj:'資料結構',
        am:'讀《資結七版》Ch6 圖形（表示法、Traversal、最短路徑、拓撲排序）+ Ch7 搜尋與排序',
        pm:'DFS/BFS手算 × 3題 + Merge/Quick Sort手跑過程 × 3題',
        vid:'看 Abdul Bari：Graph Data Structure + Merge Sort + Quick Sort',
        note:'圖形走訪與排序都要能手算完整過程'},
    9: {subj:'資料結構',
        am:'讀《資結七版》Ch8 雜湊（衝突處理）+ Ch9 高等樹結構（Heap、AVL樹、2-3/紅黑/B樹）',
        pm:'Hash Table衝突手算 × 3題 + 手畫AVL Tree旋轉過程（LL/RR/LR/RL）各3次',
        vid:'看 Abdul Bari：Hashing + Heap + AVL Tree',
        note:'AVL樹其實在真書Ch9（不是Ch5），資料結構到此結束，下週起轉線性代數'},
    10:{subj:'線性代數',
        am:'讀《線代上冊》Ch1 矩陣與線性方程組（高斯消去）+ Ch2 矩陣運算（逆矩陣）+ Ch3 行列式 + Ch4 向量空間',
        pm:'高斯消去法手算 × 5 題 + 3×3逆矩陣手算 × 3 題 + 行列式Cofactor展開 × 5 題',
        vid:'看 MIT 18.06 L1 Geometry of Linear Equations + L2 Elimination + L18 Determinants',
        note:'高斯消去和行列式計算幾乎每校必考，練到能快速手算'},
    11:{subj:'線性代數',
        am:'讀《線代下冊》Ch5 對角化理論（特徵值/特徵向量、對角化）+ Ch7 內積空間（Gram-Schmidt）+ Ch8 各內積算子（SVD）',
        pm:'特徵值/特徵向量計算 × 5 題 + Gram-Schmidt正交化 × 3 題 + SVD分解步驟練習 × 2 題',
        vid:'看 MIT 18.06 L21 Eigenvalues + 3Blue1Brown Eigenvectors + L29 SVD',
        note:'特徵多項式 det(A-λI)=0 要熟練；Jordan Form掌握定義與基本求法'},
    12:{subj:'演算法',
        am:'讀《演算法~1~》Ch1 Analyzing Algorithms（Asymptotic notation、Recurrence relation）+ Ch2 Divide-and-Conquer（Maximum subarray、Matrix multiplication）',
        pm:'Recurrence Relation用Master Theorem求解 × 5題 + Maximum Subarray手推 × 2題',
        vid:'看 Abdul Bari：Merge Sort（分治法範例）+ Recurrence Relation教學影片',
        note:'這兩章是全書基礎，複雜度分析要練到直覺反應'},
    13:{subj:'演算法',
        am:'讀《演算法~1~》Ch3 Dynamic Programming（Rod cutting、Knapsack、Matrix-chain、LCS、KMP）',
        pm:'手推 LCS 狀態表 × 3 題 + 手推 0/1 Knapsack dp table × 2 題 + 手填 Matrix Chain m[i][j] 表格 × 3 題',
        vid:'看 MIT 6.006 L11 DP I + L12 DP II + L14 DP IV（Matrix Chain）+ Abdul Bari：Matrix Chain Multiplication',
        note:'DP 是全科最高頻考點，這週要花最多時間，之前的遞迴/歸納法基礎這裡會用上，KMP也在這章（不是資結章節）'},
    14:{subj:'演算法',
        am:'讀《演算法~1~》Ch4 Graph Algorithms（BFS/DFS/最短路徑/MST/最大流）+ Ch6 NP-completeness',
        pm:'手算 BFS/DFS 執行過程 × 3 題 + Dijkstra手算 × 2 題 + NP-Complete問題判斷 × 3 題',
        vid:'看 Abdul Bari：BFS + DFS + Topological Sort + Strongly Connected Components',
        note:'NP理論列為重點；計算幾何與其他問題放到刷題期補強'},
    15:{subj:'計算機組織',
        am:'讀《數位邏輯講義》Ch1–Ch3（二進位系統、布林代數、組合邏輯，精簡讀過即可）+ 《計組上冊》Ch1 指令（MIPS）+ Ch2 計算機算術（IEEE 754）',
        pm:'IEEE 754 浮點數轉換 × 5 題 + 布林函數化簡 × 3 題',
        vid:'看 Neso Academy：Logic Gates + IEEE 754 Floating Point Representation',
        note:'數位邏輯是計組的前置基礎，掌握二進位、布林代數與組合邏輯即可'},
    16:{subj:'計算機組織',
        am:'讀《計組上冊》Ch3 效能評估（Amdahl定律）+ Ch4 處理器資料路徑 + Ch5 管線（Pipeline Hazard）+ 《計組下冊》Ch6 記憶體階層與Cache（AMAT計算）',
        pm:'Amdahl定律計算 × 3 題 + Pipeline CPI/Stall 手算 × 5 題 + AMAT計算 × 5 題',
        vid:'看 Pipeline Hazards + Average Memory Access Time（AMAT）',
        note:'Pipeline跟Cache幾乎每校必考，這週花最多時間；Ch7儲存裝置、Ch8多重處理器、Ch9基本概念較低頻，留到刷題期，計組到此結束'},
    17:{subj:'作業系統',
        am:'讀《金寶典》Ch1 導論 + Ch2 電腦系統架構（Dual Mode）+ Ch3 系統作業結構（System Call）+ Ch4 處理程序（CPU排程）',
        pm:'做 Q講義 Q1（Ch1–Ch3）所有例題 + 五狀態圖默寫 × 5 次 + Gantt Chart排程計算 × 5 題（Q講義 Q2）',
        vid:'看 清大OCW 周志遠 第1A–1C講（OS概論）+ 第9A–9B講 Process',
        note:'五狀態圖要能閉眼默寫，Gantt Chart 排程計算每校必出'},
    18:{subj:'作業系統',
        am:'讀《金寶典》Ch5 死結（四條件、Banker Algorithm）+ Ch6 處理程序的協調（Critical Section、Semaphore、Monitor）',
        pm:'Banker Algorithm 安全狀態判斷 × 5 題（Q講義 Q3）+ Semaphore解同步問題 × 3 題（Q講義 Q4）',
        vid:'看 Abdul Bari：Banker Algorithm + Process Synchronization（Critical Section／Semaphore）',
        note:'Banker Algorithm 要能手算'},
    19:{subj:'作業系統',
        am:'讀《金寶典》Ch7 記憶管理（Paging）+ Ch8 虛擬記憶體（Page Replacement）+ Ch9 輔助儲存體管理（磁碟排程）+ Ch10 檔案系統',
        pm:'Page Table 位址轉換計算 × 5 題 + FIFO/LRU/Optimal 計算 × 3 題（Q講義 Q5）+ SCAN/C-SCAN磁碟排程手算 × 3 題（Q講義 Q6）',
        vid:'看 Page Replacement Algorithms（LRU/Optimal）+ SCAN Disk Scheduling Algorithm',
        note:'Page Fault與磁碟排程要能快速手算；完成後進入刷題期'},
};

// ── Task queue (foundation phase only) ───────────────────────────────
// Foundation has genuinely finite content (six subjects' chapters) — it's
// the one phase where "did I actually finish this" should matter more than
// "how many calendar days have passed". Drilling/convergence stay date-
// driven below: they're open-ended recurring practice, not a queue to drain.
//
// Book-task minutes are grounded in SUBJECTS' real per-chapter `hrs` figures
// (data.js), summed for whichever chapters that week covers — not guessed.
const FOUNDATION_BOOK_MINUTES = {
  1:480, 2:480, 3:600, 4:720, 5:600, 6:480, 7:600, 8:660, 9:720,
  10:900, 11:720, 12:480, 13:720, 14:660, 15:600, 16:900,
  17:720, 18:480, 19:720,
};
function durationToMinutes(value){
  const parts = String(value || '').split(':').map(Number);
  if(parts.some(function(n){ return !Number.isFinite(n); })) return 0;
  const seconds = parts.length === 3 ? parts[0]*3600+parts[1]*60+parts[2]
    : parts.length === 2 ? parts[0]*60+parts[1] : 0;
  return Math.max(0, Math.ceil(seconds/60));
}
function foundationVideoMinutes(videos){
  const exact = (videos || []).reduce(function(sum, video){ return sum + durationToMinutes(video.dur); }, 0);
  return exact || 60;
}

function buildFoundationTasks(){
  const tasks = [];
  for(let wk=1; wk<=FOUNDATION_WEEKS; wk++){
    const c = FOUNDATION_CONTENT[wk];
    const t = FOUNDATION_TASK_TEXT[wk];
    if(!c || !t) continue;
    // One grouped video task per week. Sequential parts in the selected
    // series belong to the same task; alternate teachers are equivalent paths.
    const videos = c.vid || [];
    if(videos.length){
      tasks.push({id:'w'+wk+'-video', week:wk, subject:c.subj, type:'video', title:'本週影片（依序完成指定系列）', url:videos[0].url, estMinutes:foundationVideoMinutes(videos)});
    }
    tasks.push({id:'w'+wk+'-book', week:wk, subject:c.subj, type:'book', title:t.am, estMinutes:FOUNDATION_BOOK_MINUTES[wk] || 480});
    tasks.push({id:'w'+wk+'-practice', week:wk, subject:c.subj, type:'practice', title:t.pm, estMinutes:60});
    tasks.push({id:'w'+wk+'-notes', week:wk, subject:c.subj, type:'notes', title:'整理筆記：'+t.note, estMinutes:30});
    tasks.push({id:'w'+wk+'-review', week:wk, subject:c.subj, type:'review', title:'本週複習＋本科歷屆題目練習', estMinutes:150});
  }
  return tasks;
}

// effectiveWeek = the week containing the first undone task. Falling behind
// just means this stays put (no more content silently swapped out from
// under you); finishing early lets it advance past what the calendar alone
// would imply.
function getFoundationQueueStatus(doneIds){
  const doneSet = new Set(doneIds || []);
  const queue = buildFoundationTasks();
  const undone = queue.filter((t) => !doneSet.has(t.id));
  return {
    effectiveWeek: undone.length ? undone[0].week : FOUNDATION_WEEKS + 1,
    undoneCount: undone.length,
    totalTasks: queue.length,
    totalRemainingMinutes: undone.reduce((s, t) => s + t.estMinutes, 0),
  };
}


// True once every video/book/practice/notes task for a week is done — the
// review task is deliberately excluded (it's what "content done" unlocks).
// Used by the 六科 page to light up a chapter's dot once its mapped week
// is fully done.
function foundationContentDone(wk){
  const weekTasks = buildFoundationTasks().filter((t) => t.week === wk);
  const videos = weekTasks.filter((t) => t.type === 'video');
  const byType = {};
  weekTasks.forEach((t) => { if(t.type !== 'video') byType[t.type] = t; });
  return videos.every((v) => DONE_TASK_IDS.includes(v.id))
    && (!byType.book || DONE_TASK_IDS.includes(byType.book.id))
    && (!byType.practice || DONE_TASK_IDS.includes(byType.practice.id))
    && (!byType.notes || DONE_TASK_IDS.includes(byType.notes.id));
}

// ── Render ─────────────────────────────────────────────────────────
// Time-of-day greeting — the calendar page's opening line. Always about
// today specifically (there's no more per-day browsing UI to show a
// different date's label instead).
function greetingLine(){
  const h = new Date().getHours();
  const g = function(icon, text){ return '<span class="greet-icon">'+svgIcon(icon, 18)+'</span>'+text; };
  if(h < 5) return g('moon', '這麼晚了，早點休息吧');
  if(h < 11) return g('sun', '早安，準備好了嗎？');
  if(h < 14) return g('sun', '午安，繼續加油');
  if(h < 18) return g('sunset', '下午好，還在狀態內嗎');
  if(h < 22) return g('sunset', '晚上好，今天辛苦了');
  return g('moon', '這麼晚了，早點休息吧');
}

// The single next undone task in queue order — what the calendar header's
// "現在該做" line points to, and what happens when you click a week-view
// task block for a foundation-phase day.
function nextFoundationTask(doneIds){
  const doneSet = new Set(doneIds || []);
  const queue = buildFoundationTasks();
  return queue.find((t) => !doneSet.has(t.id)) || null;
}

// Jumps to a subject's own tab on 六科 and, if a foundation week is given,
// scrolls to + flashes the first chapter mapped to that week (via each
// chapter's `wk` field) — shared by the header's "現在該做" link and every
// week-view task block, so both land you in the same place.
function goSubjWeek(subjName, wk, taskType){
  const s = SUBJECTS.find(function(x){ return x.name === subjName; });
  if(!s) return;
  goSec('subjects', document.querySelector('.pill[data-sec="subjects"]'));
  const matchingTypes = taskType === 'video' ? ['vidgroup','vid'] : taskType === 'practice' ? ['ex'] : taskType === 'book' ? ['book'] : [];
  const candidates = s.chapters.map(function(c,i){ return {chapter:c,index:i}; }).filter(function(x){ return x.chapter.wk === wk; });
  let targetMaterialId = '';
  let target = candidates.find(function(x){
    const mats = chapterDisplayMaterials(x.chapter);
    const material = mats.find(function(m){
      const id = chapterMaterialTaskId(s.id,x.chapter,m);
      return matchingTypes.indexOf(m.type) !== -1 && DONE_TASK_IDS.indexOf(id) === -1;
    });
    if(material) targetMaterialId = chapterMaterialTaskId(s.id,x.chapter,material);
    return !!material;
  });
  if(!target){
    target = candidates.find(function(x){
      const material = chapterDisplayMaterials(x.chapter).find(function(m){ return DONE_TASK_IDS.indexOf(chapterMaterialTaskId(s.id,x.chapter,m)) === -1; });
      if(material) targetMaterialId = chapterMaterialTaskId(s.id,x.chapter,material);
      return !!material;
    }) || candidates[0];
  }
  const idx = target ? target.index : -1;
  // Resolve the explicit destination after the section becomes visible.
  setTimeout(function(){
    const tab = document.querySelector('.stab[data-id="'+s.id+'"]');
    if(tab) tab.click();
    if(wk == null || idx === -1) return;
    const row = document.querySelectorAll('#sp-'+s.id+' .ch-row')[idx];
    if(!row) return;
    row.classList.remove('collapsed');
    const head = row.querySelector('[data-chtoggle]');
    if(head) head.setAttribute('aria-expanded','true');
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      const materialRow = targetMaterialId ? row.querySelector('[data-material-task="'+targetMaterialId+'"]') : null;
      (materialRow || row).scrollIntoView({behavior:'auto',block:'center',inline:'nearest'});
      if(materialRow) materialRow.classList.add('mat-flash');
      setTimeout(function(){ if(materialRow) materialRow.classList.remove('mat-flash'); },1800);
    }); });
  },0);
}

// Rule-based pace check — no AI call, just arithmetic. Compares remaining
// foundation workload against how much usable study time is actually left
// before FOUNDATION_TARGET_DATE, using the same weekly rhythm dayInfo()
// assumes (Sunday off, Monday ~0hr, everything else 5hr, matching the three
// visible 2hr + 2hr + 1hr calendar blocks). The calendar's
// dates never get pushed back to hide falling behind (that would just be
// lying about what's really scheduled) — this is the honest alternative:
// a warning, not a rewritten schedule.
const DAILY_CAPACITY_HOURS = { 0:0, 1:0, 2:5, 3:5, 4:5, 5:5, 6:5 };
const FORECAST_RESERVE_RATIO = 0.10;
function foundationForecast(doneIds){
  const status = getFoundationQueueStatus(doneIds);
  if(status.undoneCount === 0) return { status, capacityHours: 0, remainingHours: 0, bufferedHours: 0, behind: false, tight: false, deficitHours: 0, spareHours: 0 };

  const today = new Date(); today.setHours(12,0,0,0);
  let capacityHours = 0;
  const cursor = new Date(today);
  while(cursor < FOUNDATION_TARGET_DATE){
    capacityHours += DAILY_CAPACITY_HOURS[cursor.getDay()] || 0;
    cursor.setDate(cursor.getDate() + 1);
  }
  const remainingHours = Math.round((status.totalRemainingMinutes/60)*10)/10;
  const bufferedHours = Math.round(remainingHours*(1+FORECAST_RESERVE_RATIO)*10)/10;
  const deficitHours = Math.round((bufferedHours - capacityHours)*10)/10;
  const spareHours = Math.round((capacityHours - remainingHours)*10)/10;
  return { status, capacityHours: Math.round(capacityHours*10)/10, remainingHours, bufferedHours, behind: remainingHours > capacityHours, tight: remainingHours <= capacityHours && deficitHours > 0, deficitHours:Math.max(0,deficitHours), spareHours };
}

// For a FUTURE date in week-view: projects which foundation week's content
// would realistically be active by then, by simulating consuming today's
// real remaining-minutes-per-week (starting at the current effective week)
// at the same weekly rhythm DAILY_CAPACITY_HOURS assumes, starting today.
// This is a derived projection, not a stored schedule — falling behind
// pace automatically pushes later weeks' blocks further out, and catching
// up automatically pulls them back in, with no separate "reschedule" step
// and no new persistence (matches "如果隔夜了還沒弄完，順延排到隔天").
function projectedWeekForDate(d){
  const status = getFoundationQueueStatus(DONE_TASK_IDS);
  if(status.undoneCount === 0) return FOUNDATION_WEEKS + 1;

  const today = new Date(); today.setHours(12,0,0,0);
  const target = new Date(d); target.setHours(12,0,0,0);
  if(target <= today) return status.effectiveWeek;

  const doneSet = new Set(DONE_TASK_IDS);
  const remainByWeek = new Map();
  buildFoundationTasks().forEach(function(t){
    if(t.week < status.effectiveWeek || doneSet.has(t.id)) return;
    remainByWeek.set(t.week, (remainByWeek.get(t.week) || 0) + t.estMinutes);
  });
  const weeks = Array.from(remainByWeek.keys()).sort(function(a,b){ return a-b; });

  let wi = 0, bankMinutes = 0;
  const cursor = new Date(today);
  while(cursor < target && wi < weeks.length){
    bankMinutes += (DAILY_CAPACITY_HOURS[cursor.getDay()] || 0) * 60;
    while(wi < weeks.length && bankMinutes >= remainByWeek.get(weeks[wi])){
      bankMinutes -= remainByWeek.get(weeks[wi]);
      wi++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return wi < weeks.length ? weeks[wi] : FOUNDATION_WEEKS + 1;
}

function renderCalPaceWarning(){
  const el = document.getElementById('calPaceWarning');
  if(!el) return;
  const forecast = foundationForecast(DONE_TASK_IDS);
  const targetLabel = (FOUNDATION_TARGET_DATE.getMonth()+1)+'/'+FOUNDATION_TARGET_DATE.getDate();
  el.innerHTML = forecast.behind
    ? '<div class="cal-pace-warn">'+svgIcon('alert-triangle',13)+' 依每天5小時計算，'+targetLabel+'前不足約 <b>'+Math.round((forecast.remainingHours-forecast.capacityHours)*10)/10+'</b> 小時，後續任務會自動順延。</div>'
    : forecast.tight
      ? '<div class="cal-pace-warn">'+svgIcon('alert-triangle',13)+' 目前可完成，但機動時間不足10%：只剩約 <b>'+forecast.spareHours+'</b> 小時緩衝。</div>'
      : '';
}

// "現在該做" + 目前第幾週/主攻科目 — one line, phase-aware. The link jumps
// straight to the matching chapter on 六科 (via goSubjWeek).
function renderCalNextInfo(){
  const el = document.getElementById('calNextInfo');
  if(!el) return;
  const info = dayInfo(new Date());
  let line = '';
  if(info.phase === 'foundation'){
    const next = nextFoundationTask(DONE_TASK_IDS);
    line = next
      ? ('基礎期第 <b>'+info.wk+'</b> 週・現在該做：<span class="cal-next-link" onclick="goSubjWeek(\''+next.subject+'\','+info.wk+',\''+next.type+'\')">『'+next.title+'』（'+next.subject+'）↓</span>')
      : '基礎期內容全部完成了！';
  } else if(info.phase === 'drilling'){
    line = '刷題期・今天主攻：'+(info.drillSubj || '複習整理');
  } else {
    line = '收斂期・只看錯題本＋速記清單，不看新教材';
  }
  el.innerHTML = line;
}

function renderGreetingHeader(){
  const gl = document.getElementById('greetingLine');
  if(gl) gl.innerHTML = greetingLine();
  renderCalPaceWarning();
  renderCalNextInfo();
  renderDailyFocus();
  renderSmartOverview();
  refreshSchoolExamReadiness();
  renderAiContextDock();
  renderChatFollowups();
}

function calibratedTimeFactor(){
  const rows = (LEARNING_EVIDENCE.sessions||[]).filter(function(s){return s.planned_minutes>0&&s.actual_minutes>0;}).slice(0,30);
  if(rows.length<3) return {factor:1,confidence:'尚在建立'};
  const ratios=rows.map(function(s){return Math.min(2.5,Math.max(.4,s.actual_minutes/s.planned_minutes));}).sort(function(a,b){return a-b;});
  return {factor:ratios[Math.floor(ratios.length/2)],confidence:rows.length>=10?'穩定':'初步'};
}
function chapterEstimatedMastery(s,c){
  const mats=chapterDisplayMaterials(c), done=new Set(DONE_TASK_IDS);
  let available=0,completed=0;
  mats.forEach(function(m){const w=m.type==='vidgroup'?20:m.type==='book'?25:m.type==='ex'?45:10;available+=w;if(done.has(chapterMaterialTaskId(s.id,c,m)))completed+=w;});
  const base=available?Math.round(completed/available*100):0;
  const key=stableTaskKey(c.t);
  const attempt=(LEARNING_EVIDENCE.attempts||[]).find(function(a){return a.subject_id===s.id&&a.chapter_key===key;});
  const saved=(LEARNING_EVIDENCE.mastery||[]).find(function(a){return a.subject_id===s.id&&a.chapter_key===key;});
  const evidence=attempt?Math.round(attempt.correct/attempt.total*100):saved?Math.round(saved.correct/saved.total*100):null;
  return {score:evidence==null?base:Math.round(base*.35+evidence*.65),verified:evidence!=null};
}
function subjectMasteryScores(){
  const out={};SUBJECTS.forEach(function(s){let points=0,weight=0;s.chapters.forEach(function(c){const m=chapterEstimatedMastery(s,c);const w=(parseFloat(c.hrs)||1)*(c.pri==='must'?1.35:c.pri==='hi'?1.15:.8);points+=m.score*w;weight+=w;});out[s.id]=Math.round(points/(weight||1));});return out;
}
function schoolExamReadiness(u){
  const text=(u.subjs||[]).join(' ');
  if(/不再考六科筆試/.test(text))return null;
  const subjectRules={
    ds:/資料結構|資結|\bDS\b|程式設計|計算機科學/i,
    alg:/演算法|計算機科學|程式設計/i,
    os:/作業系統|\bOS\b|計算機系統|計算機組織與系統/i,
    ca:/計算機結構|計算機組織|計算機系統|計算機組織與系統/i,
    la:/線性代數|線代|計算機數學|數學基礎/i,
    dm:/離散數學|離散|計算機數學|數學基礎/i
  };
  let ids=Object.keys(subjectRules).filter(function(id){return subjectRules[id].test(text);});
  if(!ids.length)ids=SUBJECTS.map(function(s){return s.id;});
  const scores=subjectMasteryScores(),weights={};ids.forEach(function(id){weights[id]=1;});
  if(/資料結構與演算法（加權×1\.5）/.test(text))weights.ds=weights.alg=1.5;
  if(/計算機系統.*加權×1\.5/.test(text))weights.os=weights.ca=1.5;
  let points=0,total=0,verified=0,chapterCount=0;
  ids.forEach(function(id){
    const s=SUBJECTS.find(function(row){return row.id===id;});
    const weight=weights[id]||1;points+=(scores[id]||0)*weight;total+=weight;
    if(s)s.chapters.forEach(function(c){chapterCount++;if(chapterEstimatedMastery(s,c).verified)verified++;});
  });
  const score=Math.round(points/(total||1));
  const candidates=[];
  ids.forEach(function(id){
    const s=SUBJECTS.find(function(row){return row.id===id;});if(!s)return;
    s.chapters.forEach(function(c,index){const m=chapterEstimatedMastery(s,c);candidates.push({subject:s,chapter:c,index:index,score:m.score,verified:m.verified,priority:c.pri});});
  });
  candidates.sort(function(a,b){return a.score-b.score||(a.priority==='must'?-1:1)-(b.priority==='must'?-1:1);});
  return {score:score,ids:ids,verified:verified,chapterCount:chapterCount,weakest:candidates[0]||null,confidence:verified>=Math.max(3,Math.ceil(chapterCount*.25))?'已有題目驗證':verified?'部分題目驗證':'低信心 · 僅依任務完成度'};
}
function schoolExamReadinessHtml(u){
  const d=schoolExamReadiness(u);if(!d)return '<div class="school-readiness is-unavailable" data-school-readiness="'+u.en+'"><div><strong>116筆試準備度不計算</strong><span>一般考試入學已改制，請依最新甄選方式準備</span></div></div>';
  const names=d.ids.map(function(id){const s=SUBJECTS.find(function(x){return x.id===id;});return s?s.name:id;});
  return '<div class="school-readiness" data-school-readiness="'+u.en+'" style="--readiness:'+d.score+'%">'
    +'<div class="school-readiness-head"><div><strong>目前筆試準備度 '+d.score+'%</strong><span>'+d.confidence+'</span></div><small>依115考科參考 · 非錄取率</small></div>'
    +'<div class="school-readiness-track" role="progressbar" aria-label="'+u.name+'筆試準備度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+d.score+'"><span></span></div>'
    +'<p>'+names.join('、')+(d.verified?' · '+d.verified+' 個章節已有作答紀錄':' · 完成診斷後會提高判斷可信度')+'</p>'
    +(d.weakest?'<button class="school-readiness-next ui-btn" type="button" onclick="event.stopPropagation();openReadinessTarget(\''+d.weakest.subject.id+'\','+d.weakest.index+')"><span><b>建議下一步</b>'+d.weakest.subject.name+' · '+d.weakest.chapter.t+(d.weakest.verified?'':'（待題目驗證）')+'</span>'+svgIcon('chevron-right',13)+'</button>':'')
    +'</div>';
}
function refreshSchoolExamReadiness(){
  document.querySelectorAll('[data-school-readiness]').forEach(function(el){
    const u=UNIS.find(function(row){return row.en===el.dataset.schoolReadiness;});
    if(u)el.outerHTML=schoolExamReadinessHtml(u);
  });
}
function openReadinessTarget(subjectId,index){
  const s=SUBJECTS.find(function(row){return row.id===subjectId;});if(!s)return;
  goSec('subjects');
  const tab=document.querySelector('.stab[data-id="'+subjectId+'"]');if(tab)tab.click();
  setTimeout(function(){
    const row=document.querySelectorAll('#sp-'+subjectId+' .ch-row')[index];if(!row)return;
    row.classList.remove('collapsed');const head=row.querySelector('[data-chtoggle]');if(head)head.setAttribute('aria-expanded','true');
    row.scrollIntoView({behavior:'smooth',block:'center'});row.classList.add('readiness-target-flash');
    setTimeout(function(){row.classList.remove('readiness-target-flash');},1800);
  },0);
}
// Shared by the rule-based smart-overview cards and the AI daily-brief
// request, so the AI reasons over exactly the same real numbers the cards
// show — not a separately-computed or re-guessed picture.
function smartOverviewData(){
  const factor=calibratedTimeFactor();
  const today=isoDate(new Date()), due=(LEARNING_EVIDENCE.reviews||[]).filter(function(r){return r.due_date<=today;});
  const currentWeek=getFoundationQueueStatus(DONE_TASK_IDS).effectiveWeek;const weak=[];SUBJECTS.forEach(function(s){s.chapters.forEach(function(c){const m=chapterEstimatedMastery(s,c);if(c.pri==='must'&&m.score<70)weak.push({s:s.name,c:c.t,score:m.score,verified:m.verified,current:c.wk===currentWeek});});});weak.sort(function(a,b){return a.score-b.score||Number(b.current)-Number(a.current);});
  const recent=(LEARNING_EVIDENCE.attempts||[]).filter(function(a){return new Date(a.created_at+'Z')>=new Date(Date.now()-7*86400000);});
  const accuracy=recent.length?Math.round(recent.reduce(function(n,a){return n+a.correct;},0)/recent.reduce(function(n,a){return n+a.total;},0)*100):null;
  const evidencedWeak=weak.find(function(x){return x.verified||x.score>0;});
  return {factor:factor,due:due,currentWeek:currentWeek,weak:weak,evidencedWeak:evidencedWeak,accuracy:accuracy};
}
function renderSmartOverview(){
  const el=document.getElementById('smartOverview');if(!el)return;
  const d=smartOverviewData();const cards=[];
  if(d.due.length)cards.push('<div class="smart-card"><div class="smart-kicker">到期複習</div><div class="smart-value">'+d.due.length+' 個章節</div><div class="smart-list">'+d.due.slice(0,3).map(function(r){const s=SUBJECTS.find(function(x){return x.id===r.subject_id;});const c=s&&s.chapters.find(function(x){return stableTaskKey(x.t)===r.chapter_key;});return '<div class="smart-item"><span>'+(s?s.name:'章節')+'</span><b>'+(c?c.t:'待複習')+'</b></div>';}).join('')+'</div></div>');
  if(d.evidencedWeak)cards.push('<div class="smart-card"><div class="smart-kicker">優先補強</div><div class="smart-value">'+d.evidencedWeak.c+'</div><div class="smart-copy">'+d.evidencedWeak.s+' · '+d.evidencedWeak.score+'%'+(d.evidencedWeak.verified?'，已有作答證據':'，尚待題目驗證')+'</div></div>');
  if(d.accuracy!==null||(LEARNING_EVIDENCE.sessions||[]).length)cards.push('<div class="smart-card"><div class="smart-kicker">本週學習</div><div class="smart-value">'+(d.accuracy===null?'時間校準中':d.accuracy+'% 正確率')+'</div><div class="smart-copy">時間校準：'+d.factor.confidence+(d.factor.factor!==1?'（實際約為預估 '+Math.round(d.factor.factor*100)+'%）':'')+'</div></div>');
  el.innerHTML=cards.join('');el.style.display=cards.length?'grid':'none';
  const briefBtn=document.getElementById('aiDailyBriefBtn');if(briefBtn)briefBtn.style.display=SUBJECTS.length?'':'none';
}
let dailyBriefReturnFocus=null;
function closeDailyBriefModal(){
  const modal=document.getElementById('dailyBriefModal');
  if(modal){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');}
  if(dailyBriefReturnFocus&&dailyBriefReturnFocus.isConnected)dailyBriefReturnFocus.focus();
  dailyBriefReturnFocus=null;
}
// Same on-demand AI-synthesis pattern, applied to the very first screen the
// student sees: turns the rule-based smart-overview stat cards (due
// reviews, weakest verified chapter, weekly accuracy, time calibration)
// into one coherent, reasoned recommendation instead of three disconnected
// numbers the student has to interpret themselves.
async function requestDailyBrief(){
  const modal=document.getElementById('dailyBriefModal'),body=document.getElementById('dailyBriefBody');if(!modal||!body)return;
  if(!modal.classList.contains('open'))dailyBriefReturnFocus=document.activeElement;
  body.innerHTML='<div class="diagnostic-loading"><span></span><p>正在根據你的實際進度整理今天建議…</p></div>';
  modal.classList.add('open');modal.setAttribute('aria-hidden','false');modal.querySelector('.chapter-tool-close')?.focus();
  const d=smartOverviewData();
  const nextTask=(function(){const el=document.getElementById('calNextInfo');return el?el.textContent.trim():'';})();
  try{
    const r=await fetch('/api/daily-brief',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      current_week:d.currentWeek,
      next_task:nextTask,
      due_review_count:d.due.length,
      due_reviews:d.due.slice(0,5).map(function(r){const s=SUBJECTS.find(function(x){return x.id===r.subject_id;});const c=s&&s.chapters.find(function(x){return stableTaskKey(x.t)===r.chapter_key;});return (s?s.name:'')+'／'+(c?c.t:'');}).join('、'),
      weak_chapter:d.evidencedWeak?(d.evidencedWeak.s+'／'+d.evidencedWeak.c+'（'+d.evidencedWeak.score+'%'+(d.evidencedWeak.verified?'，已有作答證據':'，尚待驗證')+'）'):'',
      recent_accuracy:d.accuracy==null?'':(d.accuracy+'%'),
      time_calibration:d.factor.factor!==1?('實際約為預估的 '+Math.round(d.factor.factor*100)+'%（'+d.factor.confidence+'）'):''
    })});
    const j=await r.json();
    if(!r.ok||!j.brief)throw new Error(j.message||'目前無法產生建議');
    body.innerHTML='<div class="chapter-summary-content">'+renderChapterSummaryText(j.brief)+'</div>';
  }catch(e){
    body.innerHTML='<div class="diagnostic-error"><b>建議暫時載入失敗</b><span>'+escapeHtml(e.message)+'</span><button type="button" onclick="requestDailyBrief()">重新產生</button></div>';
  }
}
function chapterRef(subjectId,index){const s=SUBJECTS.find(function(x){return x.id===subjectId;});return s&&{subject:s,chapter:s.chapters[index]};}
let activeVoiceRecognition=null;
function voiceButtonHtml(targetId){return '<button class="voice-input-btn tool-voice-btn" type="button" onclick="startVoiceInput(\''+targetId+'\',this)" aria-label="語音輸入"></button>';}
function spokenNumber(text){
  const direct=String(text).match(/\d+/);if(direct)return direct[0];
  const map={'零':0,'一':1,'二':2,'兩':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};let total=0,current=0;
  for(const ch of String(text)){if(map[ch]!=null)current=map[ch];else if(ch==='十'){total+=(current||1)*10;current=0;}}
  return String(total+current||'');
}
function startVoiceInput(targetId,button){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition,target=document.getElementById(targetId);if(!Recognition||!target){showTaskToast('目前瀏覽器不支援語音輸入');return;}
  if(activeVoiceRecognition){try{activeVoiceRecognition.stop();}catch(e){}activeVoiceRecognition=null;document.querySelectorAll('.voice-input-btn.listening').forEach(function(x){x.classList.remove('listening');});}
  const recognition=new Recognition();activeVoiceRecognition=recognition;recognition.lang='zh-TW';recognition.interimResults=false;recognition.continuous=false;button.classList.add('listening');target.focus();
  recognition.onresult=function(e){let text=Array.from(e.results).map(function(r){return r[0].transcript;}).join('');if(target.type==='number')text=spokenNumber(text);target.value=target.type==='number'?text:(target.value?(target.value+' '+text):text);target.dispatchEvent(new Event('input',{bubbles:true}));};
  recognition.onerror=function(e){if(e.error!=='aborted')showTaskToast(e.error==='not-allowed'?'請允許麥克風權限後再試':'沒有聽清楚，請再說一次');};
  recognition.onend=function(){button.classList.remove('listening');if(activeVoiceRecognition===recognition)activeVoiceRecognition=null;};recognition.start();
}
function chapterLearningFlowHtml(s,c,index,chapterDoneCount,chapterTaskCount){
  const key=stableTaskKey(c.t), today=isoDate(new Date());
  const attempt=(LEARNING_EVIDENCE.attempts||[]).find(function(a){return a.subject_id===s.id&&a.chapter_key===key;});
  const review=(LEARNING_EVIDENCE.reviews||[]).find(function(r){return r.subject_id===s.id&&r.chapter_key===key;});
  let active=null;try{active=JSON.parse(localStorage.getItem('activeStudySessionV2')||'null');}catch(e){}
  const isTiming=active&&active.subjectId===s.id&&active.index===index;
  const materialDone=chapterTaskCount>0&&chapterDoneCount===chapterTaskCount;
  const primary=isTiming?'timer':review&&review.due_date<=today?'review':materialDone&&!attempt?'diagnostic':'timer';
  function step(title,action,role){
    return '<button class="learning-step ui-btn '+(primary===role?'is-next ':'')+(role==='timer'&&isTiming?'is-active ':'')+'" type="button" onclick="event.stopPropagation();'+action+'">'+title+'</button>';
  }
  const timerTitle=isTiming?(active.paused?'繼續計時':'暫停計時'):'開始計時';
  return '<div class="chapter-learning-flow"><div class="learning-steps">'
    +step(timerTitle,'toggleChapterTimer(\''+s.id+'\','+index+',this)','timer')
    +step('重點統整','requestChapterSummary(\''+s.id+'\','+index+')','summary')
    +step('章節診斷','requestDiagnostic(\''+s.id+'\','+index+')','diagnostic')
    +step('回報複習','reportReviewResult(\''+s.id+'\','+index+')','review')
    +'</div></div>';
}
function refreshChapterLearningFlow(subjectId,index){
  const ref=chapterRef(subjectId,index),row=document.querySelectorAll('#sp-'+subjectId+' .ch-row')[index];if(!ref||!row)return;
  const ids=chapterDisplayMaterials(ref.chapter).map(function(m){return chapterMaterialTaskId(subjectId,ref.chapter,m);});
  const done=ids.filter(function(id){return DONE_TASK_IDS.indexOf(id)!==-1;}).length;
  const old=row.querySelector('.chapter-learning-flow');if(old)old.outerHTML=chapterLearningFlowHtml(ref.subject,ref.chapter,index,done,ids.length);
}
let chapterToolModalState=null;
let chapterToolReturnFocus=null;
function closeChapterToolModal(){const modal=document.getElementById('chapterToolModal');if(modal){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');}chapterToolModalState=null;if(chapterToolReturnFocus?.isConnected)chapterToolReturnFocus.focus();chapterToolReturnFocus=null;}
function openChapterToolModal(mode,subjectId,index){
  const ref=chapterRef(subjectId,index),modal=document.getElementById('chapterToolModal'),body=document.getElementById('chapterToolModalBody');if(!ref||!modal||!body)return;
  chapterToolReturnFocus=document.activeElement;
  chapterToolModalState={mode:mode,subjectId:subjectId,index:index};
  document.getElementById('chapterToolModalKicker').textContent=ref.subject.name;
  document.getElementById('chapterToolModalTitle').textContent=mode==='result'?'紀錄「'+ref.chapter.t+'」測驗':'回報「'+ref.chapter.t+'」複習';
  if(mode==='result') body.innerHTML='<label class="tool-field voice-tool-field"><span>答對題數</span><input id="toolCorrect" type="number" min="0" inputmode="numeric" placeholder="例如 8">'+voiceButtonHtml('toolCorrect')+'</label><label class="tool-field voice-tool-field"><span>總題數</span><input id="toolTotal" type="number" min="1" inputmode="numeric" placeholder="例如 10">'+voiceButtonHtml('toolTotal')+'</label><div class="tool-field tool-field-wide"><span>主要卡住的地方（可不選）</span><div class="tool-choice-row" id="toolErrorChoices">'+['概念','公式','計算','讀題','時間'].map(function(x){return '<button type="button" data-value="'+x+'" onclick="selectToolChoice(this)">'+x+'</button>';}).join('')+'</div></div>';
  else body.innerHTML='<div class="tool-review-grid">'+[['0','幾乎忘記','需要盡快重學'],['1','有點吃力','縮短複習間隔'],['2','大致記得','照正常節奏複習'],['3','已經熟練','延後下次複習']].map(function(x){return '<button type="button" data-quality="'+x[0]+'" onclick="selectReviewQuality(this)"><b>'+x[1]+'</b><span>'+x[2]+'</span></button>';}).join('')+'</div>';
  const submit=document.getElementById('chapterToolModalSubmit');submit.textContent=mode==='result'?'儲存測驗結果':'儲存複習狀況';submit.disabled=mode==='review';modal.classList.add('open');modal.setAttribute('aria-hidden','false');
  setTimeout(function(){var target=mode==='result'?document.getElementById('toolCorrect'):modal.querySelector('.tool-review-grid button');target?.focus();},50);
}
function selectToolChoice(el){el.parentElement.querySelectorAll('button').forEach(function(x){x.classList.toggle('selected',x===el);});}
function selectReviewQuality(el){el.parentElement.querySelectorAll('button').forEach(function(x){x.classList.toggle('selected',x===el);});document.getElementById('chapterToolModalSubmit').disabled=false;}
async function submitChapterToolModal(){
  if(!chapterToolModalState)return;const ref=chapterRef(chapterToolModalState.subjectId,chapterToolModalState.index);if(!ref)return;
  if(chapterToolModalState.mode==='result'){
    const correct=Number(document.getElementById('toolCorrect').value),total=Number(document.getElementById('toolTotal').value);
    if(!Number.isInteger(correct)||!Number.isInteger(total)||total<1||correct<0||correct>total){showTaskToast('請確認答對題數與總題數');return;}
    const selected=document.querySelector('#toolErrorChoices .selected');
    await fetch('/api/learning/attempt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subject_id:chapterToolModalState.subjectId,chapter_key:stableTaskKey(ref.chapter.t),correct:correct,total:total,error_type:selected?selected.dataset.value:''})});
    closeChapterToolModal();await fetchLearningEvidence();renderGreetingHeader();refreshChapterLearningFlow(chapterToolModalState?.subjectId||ref.subject.id,chapterToolModalState?.index??ref.subject.chapters.indexOf(ref.chapter));showTaskToast('已更新掌握程度與弱點排序');
    signalAiNudge(correct/total<.7?{label:'AI 建議先處理這次錯題',detail:ref.subject.name+' · '+ref.chapter.t+' · '+correct+'/'+total+' 題',prompt:'我剛完成「'+ref.subject.name+'／'+ref.chapter.t+'」測驗，答對 '+correct+'/'+total+' 題。請根據這個真實結果與我的錯誤類型，安排一次精簡補強；先處理錯因，不要直接推進新章節。'}:null);
  }else{
    const selected=document.querySelector('.tool-review-grid .selected');if(!selected)return;
    await fetch('/api/learning/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subject_id:chapterToolModalState.subjectId,chapter_key:stableTaskKey(ref.chapter.t),quality:Number(selected.dataset.quality)})});
    const sid=chapterToolModalState.subjectId,idx=chapterToolModalState.index;closeChapterToolModal();await fetchLearningEvidence();renderGreetingHeader();refreshChapterLearningFlow(sid,idx);showTaskToast('已排好下一次複習');signalAiNudge();
  }
}
async function reportChapterResult(subjectId,index){
  openChapterToolModal('result',subjectId,index);
}
let diagnosticState=null;
let diagnosticLoadingInterval=null;
let diagnosticReturnFocus=null;
function stopDiagnosticLoading(){clearInterval(diagnosticLoadingInterval);diagnosticLoadingInterval=null;}
function startDiagnosticLoading(){stopDiagnosticLoading();const started=Date.now();diagnosticLoadingInterval=setInterval(function(){const el=document.getElementById('diagnosticLoadingStatus');if(el)el.textContent='正在整理考點 · '+Math.floor((Date.now()-started)/1000)+' 秒';},1000);}
function closeDiagnosticModal(){stopDiagnosticLoading();const modal=document.getElementById('diagnosticModal');if(modal){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');}diagnosticState=null;if(diagnosticReturnFocus?.isConnected)diagnosticReturnFocus.focus();diagnosticReturnFocus=null;}
// Most recent diagnostic attempt for this chapter, if any — used for the
// "prior_score" shown to the AI, since the latest score is what's actually
// relevant right now.
function priorAttemptFor(subjectId,chapter){
  const key=stableTaskKey(chapter.t);
  return (LEARNING_EVIDENCE.attempts||[]).find(function(a){return a.subject_id===subjectId&&a.chapter_key===key;})||null;
}
// Error-type pattern aggregated across every recorded attempt for this
// chapter, not just the latest one — a single attempt can be noisy (one
// careless mistake), so the recurring weakness is a sturdier signal to
// personalize question generation / summary emphasis around.
function dominantErrorType(subjectId,chapter){
  const key=stableTaskKey(chapter.t);
  const attempts=(LEARNING_EVIDENCE.attempts||[]).filter(function(a){return a.subject_id===subjectId&&a.chapter_key===key&&a.error_type;});
  if(!attempts.length)return '';
  const counts={};
  attempts.forEach(function(a){counts[a.error_type]=(counts[a.error_type]||0)+1;});
  return Object.keys(counts).sort(function(a,b){return counts[b]-counts[a];})[0];
}
async function requestDiagnostic(subjectId,index){
  const ref=chapterRef(subjectId,index),modal=document.getElementById('diagnosticModal'),body=document.getElementById('diagnosticBody');if(!ref||!modal||!body)return;
  if(!modal.classList.contains('open'))diagnosticReturnFocus=document.activeElement;
  diagnosticState={subjectId:subjectId,index:index,questions:[],answers:[],current:0};
  document.getElementById('diagnosticKicker').textContent=ref.subject.name+' · 5 題診斷';document.getElementById('diagnosticTitle').textContent=ref.chapter.t;
  body.innerHTML='<div class="diagnostic-loading"><span></span><p>正在依本章考點準備 5 題測驗…</p><small id="diagnosticLoadingStatus">正在整理考點 · 0 秒</small></div>';modal.classList.add('open');modal.setAttribute('aria-hidden','false');modal.querySelector('.chapter-tool-close')?.focus();startDiagnosticLoading();
  try{
    const r=await fetch('/api/diagnostic',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subject:ref.subject.name,chapter:ref.chapter.t,key_points:ref.chapter.key,peer_note:ref.chapter.peerNote||'',prior_error_type:dominantErrorType(subjectId,ref.chapter)})});const j=await r.json();
    if(!r.ok||!Array.isArray(j.questions))throw new Error(j.message||'目前無法產生題目');
    stopDiagnosticLoading();diagnosticState.questions=j.questions;renderDiagnosticQuestion();
  }catch(e){stopDiagnosticLoading();body.innerHTML='<div class="diagnostic-error"><b>題目暫時載入失敗</b><span>'+escapeHtml(e.message)+'</span><button type="button" onclick="requestDiagnostic(\''+subjectId+'\','+index+')">重新準備</button></div>';}
}
function renderDiagnosticQuestion(){
  if(!diagnosticState)return;const q=diagnosticState.questions[diagnosticState.current],body=document.getElementById('diagnosticBody'),n=diagnosticState.current+1;
  body.innerHTML='<div class="diagnostic-progress"><span style="width:'+(n/diagnosticState.questions.length*100)+'%"></span></div><div class="diagnostic-count">第 '+n+' 題／'+diagnosticState.questions.length+'</div><div class="diagnostic-question">'+formatDiagnosticMath(q.question)+'</div><div class="diagnostic-choices">'+q.choices.map(function(choice,i){return '<button type="button" onclick="answerDiagnostic('+i+')"><span>'+String.fromCharCode(65+i)+'</span><span class="diagnostic-choice-text">'+formatDiagnosticMath(choice)+'</span></button>';}).join('')+'</div>';
}
function answerDiagnostic(choice){if(!diagnosticState)return;diagnosticState.answers.push(choice);diagnosticState.current++;if(diagnosticState.current<diagnosticState.questions.length)renderDiagnosticQuestion();else finishDiagnostic();}
function formatDiagnosticMath(text){
  const source=String(text||''),pattern=/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\])/g;let out='',last=0,match;
  while((match=pattern.exec(source))){
    out+=escapeHtml(source.slice(last,match.index));const token=match[0],display=token.startsWith('$$')||token.startsWith('\\[');const expr=token.replace(/^\$\$|\$\$$/g,'').replace(/^\$|\$$/g,'').replace(/^\\\(|\\\)$/g,'').replace(/^\\\[|\\\]$/g,'');
    try{out+=window.katex?window.katex.renderToString(expr,{throwOnError:false,displayMode:display,strict:false}):escapeHtml(token);}catch(e){out+=escapeHtml(token);}last=match.index+token.length;
  }
  return out+escapeHtml(source.slice(last));
}
async function finishDiagnostic(){
  if(!diagnosticState)return;const state=diagnosticState,ref=chapterRef(state.subjectId,state.index);let correct=0;const errors={};
  state.questions.forEach(function(q,i){if(state.answers[i]===q.answer)correct++;else{const type=q.error_type||'概念';errors[type]=(errors[type]||0)+1;}});
  const mainError=Object.keys(errors).sort(function(a,b){return errors[b]-errors[a];})[0]||'';
  await fetch('/api/learning/attempt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subject_id:state.subjectId,chapter_key:stableTaskKey(ref.chapter.t),correct:correct,total:state.questions.length,error_type:mainError})});
  await fetchLearningEvidence();renderGreetingHeader();refreshChapterLearningFlow(state.subjectId,state.index);
  signalAiNudge(correct/state.questions.length<.7?{label:'AI 已把錯題列為優先',detail:ref.subject.name+' · '+ref.chapter.t+' · '+correct+'/'+state.questions.length+' 題',prompt:'我剛完成「'+ref.subject.name+'／'+ref.chapter.t+'」診斷，答對 '+correct+'/'+state.questions.length+' 題，主要錯誤類型是「'+(mainError||'尚未分類')+'」。請根據這份真實結果，先解釋最可能的觀念缺口，再給我一個30分鐘補強流程。'}:null);
  document.getElementById('diagnosticTitle').textContent='診斷完成';document.getElementById('diagnosticBody').innerHTML='<div class="diagnostic-result"><div class="diagnostic-score"><b>'+correct+'</b><span>/ '+state.questions.length+' 題</span></div><p>'+(correct===5?'本章核心內容掌握良好。':correct>=3?'已有基礎，請優先確認下方錯題。':'建議先回到本章素材補強，再重新測驗。')+'</p><div class="diagnostic-review-list">'+state.questions.map(function(q,i){const ok=state.answers[i]===q.answer;return '<details class="diagnostic-review '+(ok?'correct':'wrong')+'"><summary><span>'+(ok?'✓':'×')+'</span>第 '+(i+1)+' 題 · '+(ok?'答對':'答錯')+'</summary><div><b>正確答案：'+String.fromCharCode(65+q.answer)+'</b><p>'+formatDiagnosticMath(q.explanation)+'</p></div></details>';}).join('')+'</div><button class="chapter-tool-submit" type="button" onclick="closeDiagnosticModal()">完成</button></div>';
}
let chapterSummaryReturnFocus=null;
function closeChapterSummaryModal(){
  const modal=document.getElementById('chapterSummaryModal');
  if(modal){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');}
  if(chapterSummaryReturnFocus&&chapterSummaryReturnFocus.isConnected)chapterSummaryReturnFocus.focus();
  chapterSummaryReturnFocus=null;
}
// Minimal markdown → HTML for the AI's chapter-summary reply: "## " headers,
// "- " bullets, blank-line paragraphs. Reuses formatDiagnosticMath so $...$
// math renders through the same KaTeX pipeline as the diagnostic quiz.
function renderChapterSummaryText(text){
  const lines=String(text||'').split(/\r?\n/);
  let html='',inList=false;
  function closeList(){if(inList){html+='</ul>';inList=false;}}
  lines.forEach(function(line){
    const trimmed=line.trim();
    if(!trimmed){closeList();return;}
    if(trimmed.indexOf('## ')===0){closeList();html+='<h4 class="cs-h">'+formatDiagnosticMath(trimmed.slice(3))+'</h4>';}
    else if(trimmed.indexOf('- ')===0){if(!inList){html+='<ul class="cs-list">';inList=true;}html+='<li>'+formatDiagnosticMath(trimmed.slice(2))+'</li>';}
    else{closeList();html+='<p class="cs-p">'+formatDiagnosticMath(trimmed)+'</p>';}
  });
  closeList();
  return html;
}
async function requestChapterSummary(subjectId,index){
  const ref=chapterRef(subjectId,index),modal=document.getElementById('chapterSummaryModal'),body=document.getElementById('chapterSummaryBody');if(!ref||!modal||!body)return;
  if(!modal.classList.contains('open'))chapterSummaryReturnFocus=document.activeElement;
  document.getElementById('chapterSummaryKicker').textContent=ref.subject.name;
  document.getElementById('chapterSummaryTitle').textContent=ref.chapter.t;
  body.innerHTML='<div class="diagnostic-loading"><span></span><p>正在統整本章重點…</p></div>';
  modal.classList.add('open');modal.setAttribute('aria-hidden','false');modal.querySelector('.chapter-tool-close')?.focus();
  const materialsOutline=chapterDisplayMaterials(ref.chapter).map(function(m){return m.text||'';}).filter(Boolean).join('；');
  const priorAttempt=priorAttemptFor(subjectId,ref.chapter);
  try{
    const r=await fetch('/api/chapter-summary',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subject:ref.subject.name,chapter:ref.chapter.t,key_points:ref.chapter.key,peer_note:ref.chapter.peerNote||'',materials:materialsOutline,prior_score:priorAttempt?(priorAttempt.correct+'/'+priorAttempt.total):'',prior_error_type:dominantErrorType(subjectId,ref.chapter)})});
    const j=await r.json();
    if(!r.ok||!j.summary)throw new Error(j.message||'目前無法產生整理');
    body.innerHTML='<div class="chapter-summary-content">'+renderChapterSummaryText(j.summary)+'</div>';
  }catch(e){
    body.innerHTML='<div class="diagnostic-error"><b>整理暫時載入失敗</b><span>'+escapeHtml(e.message)+'</span><button type="button" onclick="requestChapterSummary(\''+subjectId+'\','+index+')">重新產生</button></div>';
  }
}
let schoolPlanReturnFocus=null;
function closeSchoolPlanModal(){
  const modal=document.getElementById('schoolPlanModal');
  if(modal){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');}
  if(schoolPlanReturnFocus&&schoolPlanReturnFocus.isConnected)schoolPlanReturnFocus.focus();
  schoolPlanReturnFocus=null;
}
// Same on-demand AI-synthesis pattern as requestChapterSummary, but for a
// school's 推甄 prep — combines official admission status/method with
// verified peer-experience points and this student's real mastery data
// (fetched server-side from mastery_evidence) into one personalized plan.
async function requestSchoolPrepPlan(en){
  const u=UNIS.find(function(x){return x.en===en;}),rec=RECOMMEND_ADMISSIONS[en],experience=HACKMD_ADMISSION_GUIDE[en];
  const modal=document.getElementById('schoolPlanModal'),body=document.getElementById('schoolPlanBody');if(!u||!rec||!modal||!body)return;
  if(!modal.classList.contains('open'))schoolPlanReturnFocus=document.activeElement;
  document.getElementById('schoolPlanKicker').textContent=u.en;
  document.getElementById('schoolPlanTitle').textContent=u.name;
  body.innerHTML='<div class="diagnostic-loading"><span></span><p>正在整理這間學校的準備建議…</p></div>';
  modal.classList.add('open');modal.setAttribute('aria-hidden','false');modal.querySelector('.chapter-tool-close')?.focus();
  try{
    const r=await fetch('/api/school-prep-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({school:u.name,status:rec.status,method:rec.method,materials:rec.materials,subjects:u.subjs.join('、'),peer_points:experience?experience.points.join(' '):''})});
    const j=await r.json();
    if(!r.ok||!j.plan)throw new Error(j.message||'目前無法產生建議');
    body.innerHTML='<div class="chapter-summary-content">'+renderChapterSummaryText(j.plan)+'</div>';
  }catch(e){
    body.innerHTML='<div class="diagnostic-error"><b>建議暫時載入失敗</b><span>'+escapeHtml(e.message)+'</span><button type="button" onclick="requestSchoolPrepPlan(\''+en+'\')">重新產生</button></div>';
  }
}
async function reportReviewResult(subjectId,index){
  openChapterToolModal('review',subjectId,index);
}
async function toggleChapterTimer(subjectId,index,el){
  const ref=chapterRef(subjectId,index);if(!ref)return;const storageKey='activeStudySessionV2';
  let active=null;try{active=JSON.parse(localStorage.getItem(storageKey)||'null');}catch(e){}
  if(!active){
    const planned=Math.max(15,Math.round((parseFloat(ref.chapter.hrs)||1)*60));
    const r=await fetch('/api/learning/session/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task_id:'chapter-'+subjectId+'-'+stableTaskKey(ref.chapter.t),subject_id:subjectId,chapter_key:stableTaskKey(ref.chapter.t),planned_minutes:planned})});
    const row=await r.json();active={id:row.id,runningSince:Date.now(),elapsedMs:0,paused:false,subjectId:subjectId,index:index};localStorage.setItem(storageKey,JSON.stringify(active));renderGlobalTimer();refreshChapterLearningFlow(subjectId,index);showTaskToast('已開始記錄實際學習時間');
  }else{
    if(active.subjectId!==subjectId||active.index!==index){showTaskToast('另一個章節正在計時，請先回到該章節結束計時');return;}
    if(active.paused){active.paused=false;active.runningSince=Date.now();localStorage.setItem(storageKey,JSON.stringify(active));showTaskToast('已繼續計時');}
    else{active.elapsedMs=(active.elapsedMs||0)+Math.max(0,Date.now()-(active.runningSince||active.started||Date.now()));active.paused=true;active.runningSince=null;localStorage.setItem(storageKey,JSON.stringify(active));showTaskToast('已暫停，下次可以接著計時');}
    renderGlobalTimer();refreshChapterLearningFlow(subjectId,index);
  }
}
function activeTimerElapsed(active){return (active.elapsedMs||0)+(active.paused?0:Math.max(0,Date.now()-(active.runningSince||active.started||Date.now())));}
function getActiveTimer(){try{return JSON.parse(localStorage.getItem('activeStudySessionV2')||'null');}catch(e){return null;}}
function formatActiveTimer(ms){const total=Math.max(0,Math.floor(ms/1000)),h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;return h?String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'):String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');}
function renderGlobalTimer(){
  const el=document.getElementById('globalTimer');if(!el)return;const active=getActiveTimer();
  if(!active){el.classList.remove('show','paused');return;}
  const ref=chapterRef(active.subjectId,active.index);if(!ref){el.classList.remove('show','paused');return;}
  el.classList.add('show');el.classList.toggle('paused',!!active.paused);
  document.getElementById('globalTimerState').textContent=active.paused?'計時已暫停':'正在計時';
  document.getElementById('globalTimerTitle').textContent=ref.subject.name+' · '+ref.chapter.t;
  document.getElementById('globalTimerElapsed').textContent=formatActiveTimer(activeTimerElapsed(active));
  document.getElementById('globalTimerPause').textContent=active.paused?'繼續':'暫停';
}
function goToActiveTimerChapter(){const active=getActiveTimer();if(!active)return;const ref=chapterRef(active.subjectId,active.index);if(ref)goSearchChapter(ref.subject.name,active.index);}
function toggleActiveTimerFromDock(){const active=getActiveTimer();if(active)toggleChapterTimer(active.subjectId,active.index,null);}
function finishActiveTimerFromDock(){const active=getActiveTimer();if(active)finishChapterTimer(active.subjectId,active.index);}
setInterval(renderGlobalTimer,1000);
async function finishChapterTimer(subjectId,index){
  let active=null;try{active=JSON.parse(localStorage.getItem('activeStudySessionV2')||'null');}catch(e){}if(!active||active.subjectId!==subjectId||active.index!==index)return;
  const minutes=Math.max(1,Math.round(activeTimerElapsed(active)/60000));
  await fetch('/api/learning/session/'+active.id+'/finish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({actual_minutes:minutes})});
  localStorage.removeItem('activeStudySessionV2');renderGlobalTimer();await fetchLearningEvidence();renderGreetingHeader();refreshChapterLearningFlow(subjectId,index);showTaskToast('本次已記錄 '+minutes+' 分鐘');
}
async function discardChapterTimer(subjectId,index){
  let active=null;try{active=JSON.parse(localStorage.getItem('activeStudySessionV2')||'null');}catch(e){}if(!active||active.subjectId!==subjectId||active.index!==index)return;
  await fetch('/api/learning/session/'+active.id,{method:'DELETE'});localStorage.removeItem('activeStudySessionV2');renderGlobalTimer();refreshChapterLearningFlow(subjectId,index);showTaskToast('已放棄這次計時，不會列入紀錄');
}
function renderDailyFocus(){
  const el = document.getElementById('dailyFocus');
  if(!el) return;
  const info = dayInfo(new Date());
  const queue = buildFoundationTasks();
  const done = new Set(DONE_TASK_IDS);
  const completed = queue.filter(function(t){ return done.has(t.id); }).length;
  const pct = queue.length ? Math.round(completed/queue.length*100) : 100;
  if(info.phase === 'foundation'){
    const next = nextFoundationTask(DONE_TASK_IDS);
    if(!next){ el.innerHTML = ''; return; }
    const minimum = next.type === 'video' ? '依序看完本週指定系列' : next.type === 'book' ? '讀完核心段落' : next.type === 'practice' ? '完成基本題' : '完成本週整理';
    el.innerHTML = '<div class="daily-focus-kicker">今日主任務</div>'
      +'<div class="daily-focus-row"><div><div class="daily-focus-title">'+next.title+'</div><div class="daily-focus-meta">'+next.subject+' · 約 '+Math.max(1,Math.round(next.estMinutes/60*10)/10)+' 小時 · 最小目標：'+minimum+'</div></div>'
      +'<button class="daily-focus-btn ui-btn ui-btn-primary" onclick="goSubjWeek(\''+next.subject+'\','+next.week+',\''+next.type+'\')">繼續讀</button></div>'
      +'<div class="daily-focus-progress"><span style="width:'+pct+'%"></span></div><div class="daily-focus-pct">整體 '+pct+'% · '+completed+'/'+queue.length+' 項</div>';
  }else{
    const title = info.phase === 'drilling' ? (info.drillSubj || '複習整理')+'歷屆試題' : '錯題本與速記清單';
    el.innerHTML = '<div class="daily-focus-kicker">今日主任務</div><div class="daily-focus-row"><div><div class="daily-focus-title">'+title+'</div><div class="daily-focus-meta">完成今天的主要練習後，再補弱點項目</div></div></div>';
  }
}

let toastTimer = null;
function showTaskToast(message){
  const el = document.getElementById('taskToast');
  if(!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ el.classList.remove('show'); }, 2200);
}
function refreshVisibleSubjectProgress(el){
  const row = el && el.closest('.ch-row');
  const panel = el && el.closest('.sp');
  if(row){
    const tasks = row.querySelectorAll('.ch-mat');
    const done = row.querySelectorAll('.ch-mat.done').length;
    const count = row.querySelector('.ch-progress-count');
    if(count) count.textContent = done+'/'+tasks.length;
    const complete = tasks.length > 0 && done === tasks.length;
    row.classList.toggle('ch-row-done',complete);
    const dot = row.querySelector('.ch-dot');
    if(dot){ dot.classList.toggle('done',complete); dot.textContent = complete ? '✓' : String(Array.from(row.parentNode.children).indexOf(row)+1); }
  }
  if(panel){
    const tasks = panel.querySelectorAll('.ch-mat');
    const done = panel.querySelectorAll('.ch-mat.done').length;
    const pct = tasks.length ? Math.round(done/tasks.length*100) : 100;
    const pctEl = panel.querySelector('.sp-donut-pct');
    const subEl = panel.querySelector('.sp-donut-sub');
    if(pctEl) pctEl.textContent = pct+'%';
    if(subEl) subEl.textContent = done+'/'+tasks.length+' 項';
    panel.querySelectorAll('.sp-donut-svg circle').forEach(function(circle,i){
      const chapter = panel.querySelectorAll('.ch-row')[i];
      if(chapter) circle.style.stroke = chapter.classList.contains('ch-row-done') ? getComputedStyle(chapter).getPropertyValue('--ch-color') : 'var(--bd2)';
    });
  }
}

function toggleRcLinks(id, btn){
  var el = document.getElementById(id);
  if(!el) return;
  var open = el.classList.toggle('open');
  var total = el.children.length;
  btn.classList.toggle('is-open', open);
  btn.innerHTML = (open ? '收合' : '展開其餘 '+total+' 個連結')+'<span class="expand-icon rc-toggle-icon" aria-hidden="true"></span>';
}

// Foundation: task queue, keyed by stable taskId.
// `el`, if passed, gets its own `.done` class toggled directly (used by
// callers like the 六科 material checkboxes that don't otherwise re-render).
async function toggleTask(taskId, el){
  let chapter = null, materialType = null;
  if(taskId.indexOf('mat-v2-') === 0 && el){
    const panel = el.closest('.sp');
    const row = el.closest('.ch-row');
    const subject = SUBJECTS.find(function(s){ return panel && panel.id === 'sp-'+s.id; });
    const rowIndex = row ? Array.from(row.parentNode.children).indexOf(row) : -1;
    chapter = subject && subject.chapters[rowIndex];
    if(chapter){
      const displayed = chapterDisplayMaterials(chapter);
      const match = displayed.find(function(m){ return chapterMaterialTaskId(subject.id,chapter,m) === taskId; });
      materialType = match && (match.type === 'vidgroup' ? 'video' : match.type === 'book' ? 'book' : match.type === 'ex' ? 'practice' : 'notes');
    }
  }
  const toggleResponse = await fetch('/api/tasks/' + encodeURIComponent(taskId) + '/toggle', { method:'POST' });
  const toggleResult = await toggleResponse.json();
  if(toggleResult.done === false && chapter && chapter.wk && materialType){
    await Promise.all([
      fetch('/api/tasks/w'+chapter.wk+'-'+materialType+'/set',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"done":false}'}),
      fetch('/api/tasks/w'+chapter.wk+'-review/set',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"done":false}'})
    ]);
  }
  await fetchDoneTasks();
  if(taskId.indexOf('mat-v2-') === 0 && el){
    if(chapter && chapter.wk) await syncFoundationWeek(chapter.wk);
  }
  // Toggling can shift the effective week / change what's done, which
  // affects the header progress pills and the calendar's per-day tags.
  renderGreetingHeader();
  renderCalContainer();
  if(el){
    const isDone = DONE_TASK_IDS.indexOf(taskId) !== -1;
    el.classList.toggle('done', isDone);
    el.setAttribute('aria-checked', String(isDone));
    refreshVisibleSubjectProgress(el);
    showTaskToast(isDone ? '已完成，進度已同步到日曆與 AI 助教' : '已取消完成');
    if(isDone)signalAiNudge();
  }
}

// ── Calendar view ──────────────────────────────────────────────────
// A real month grid (not just "today's 3 slots") — each day cell is
// colored by whatever dayInfo() says that day is (subject/rest/day-off/
// mock-exam), reusing the exact same phase logic the Today page already
// uses, so the calendar can never disagree with what "today" shows.
const SUBJ_COLOR_VAR = {
  '資料結構':'--ds', '演算法':'--alg', '作業系統':'--os',
  '線性代數':'--la', '離散數學':'--dm', '計算機組織':'--ca'
};
// Chapter text like "DM Ch1 邏輯（命題與真值表、邏輯等價）+ Ch2 集合論（...）" is too
// long for a calendar block — take just the first chapter's code+name before
// any "＋" or parenthetical detail, so the block shows real content (not
// just a subject-colored blob) without needing more space.
function shortChapterLabel(ch){
  if(!ch) return '';
  const first = ch.split('+')[0].split('（')[0].trim();
  return first.length > 18 ? first.slice(0,17)+'…' : first;
}

// ── Calendar: 週曆 (time-blocked week agenda) + 月曆 (simple subject/phase
// grid), toggle between the two — no other view. ──────────────────────
let calViewMode = 'week';
let calWeekStart = null; // Date, Sunday of the currently-shown week
let calMonthCursor = null; // Date, first-of-month currently shown
let pendingCalMotion = 'fade';

function setCalView(mode){
  noteUiAction();
  pendingCalMotion = 'fade';
  calViewMode = mode;
  const wb = document.getElementById('calViewWeekBtn'), mb = document.getElementById('calViewMonthBtn');
  if(wb){ wb.classList.toggle('active', mode === 'week'); wb.setAttribute('aria-pressed', String(mode === 'week')); }
  if(mb){ mb.classList.toggle('active', mode === 'month'); mb.setAttribute('aria-pressed', String(mode === 'month')); }
  renderCalContainer();
}

function renderCalContainer(){
  const container = document.getElementById('calContainer');
  if(!container) return;
  container.classList.remove('motion-prev','motion-next','motion-fade');
  void container.offsetWidth;
  container.classList.add('motion-'+pendingCalMotion);
  pendingCalMotion = 'fade';
  if(calViewMode === 'month') renderCalMonthView(container);
  else renderCalWeekView(container);
}

// Clicking a day (from month view) jumps straight to that day's week in
// week view — there's no separate day-detail page anymore.
function goCalDay(iso){
  const p = iso.split('-');
  const d = new Date(Number(p[0]), Number(p[1])-1, Number(p[2]));
  calWeekStart = new Date(d); calWeekStart.setDate(d.getDate() - d.getDay());
  setCalView('week');
}

// ── Month view: just subject/phase per day, nothing else — the detailed
// breakdown lives in week view instead. ──────────────────────────────
function buildCalMonthCells(y, m, ctx){
  const startWeekday = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const gridStart = new Date(y, m, 1 - startWeekday);
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const {s, todayIso} = ctx;
  const today0 = new Date(); today0.setHours(0,0,0,0);

  let cellsHtml = '';
  for(let i=0;i<totalCells;i++){
    const d = new Date(gridStart); d.setDate(gridStart.getDate()+i);
    const iso = isoDate(d);
    const inMonth = d.getMonth() === m;
    const beforeStart = d < s;

    let tagHtml = '';
    if(!beforeStart){
      if(d > EXAM_DATE){
        tagHtml = '<div class="cal-tag" style="background:#0F7A8C;color:#fff;">複試準備</div>';
      } else {
        const info = dayInfo(d);
        let label = null, colorVar = null;
        if(info.isRest) label = '休息';
        else if(info.isDayOff) label = '打工';
        else if(info.dow === 6 && info.phase !== 'foundation'){ label = '模考'; colorVar = '--red'; }
        else if(info.phase === 'foundation'){
          const projWk = d > today0 ? projectedWeekForDate(d) : info.wk;
          const c = FOUNDATION_CONTENT[Math.min(projWk, FOUNDATION_WEEKS)];
          label = c ? c.subj : null;
          colorVar = (label && SUBJ_COLOR_VAR[label]) ? SUBJ_COLOR_VAR[label] : '--ac2';
        } else if(info.phase === 'drilling'){
          label = info.drillSubj;
          colorVar = (label && SUBJ_COLOR_VAR[label]) ? SUBJ_COLOR_VAR[label] : '--ac2';
        } else {
          label = '收斂複習'; colorVar = '--ac2';
        }
        if(label){
          const style = colorVar
            ? 'background:var('+colorVar+');color:#fff;'
            : 'background:var(--mt);color:#fff;';
          tagHtml = '<div class="cal-tag" style="'+style+'">'+label+'</div>';
        }
      }
    }

    const classes = ['cal-cell'];
    if(!inMonth) classes.push('out');
    if(beforeStart) classes.push('disabled');
    if(iso === todayIso) classes.push('today');
    const onclick = beforeStart ? '' : ' onclick="goCalDay(\''+iso+'\')"';
    cellsHtml += '<div class="'+classes.join(' ')+'"'+onclick+'>'
      +'<div class="cal-daynum">'+d.getDate()+'</div>'+tagHtml+'</div>';
  }
  return cellsHtml;
}

function renderCalMonthView(container){
  if(!calMonthCursor){
    const base = new Date();
    calMonthCursor = new Date(base.getFullYear(), base.getMonth(), 1);
  }
  const s = startDate();
  const todayIso = isoDate(new Date());
  const y = calMonthCursor.getFullYear(), m = calMonthCursor.getMonth();
  const cellsHtml = buildCalMonthCells(y, m, {s, todayIso});
  const dowLabels = ['日','一','二','三','四','五','六'];
  const dowRowHtml = dowLabels.map(function(l){ return '<div class="cal-dow">'+l+'</div>'; }).join('');

  container.innerHTML =
    '<div class="cal-wrap">'
    +'<div class="cal-head">'
      +'<div class="cal-title">'+y+'年'+(m+1)+'月</div>'
      +'<div class="cal-nav">'
        +'<button class="nav-btn ui-btn ui-btn-icon" onclick="shiftCalMonth(-1)" aria-label="上一個月" title="上一個月">'+svgIcon('chevron-left',18)+'</button>'
        +'<button class="collapse-all-btn ui-btn" onclick="goCalMonthToday()">本月</button>'
        +'<button class="nav-btn ui-btn ui-btn-icon" onclick="shiftCalMonth(1)" aria-label="下一個月" title="下一個月">'+svgIcon('chevron-right',18)+'</button>'
      +'</div>'
    +'</div>'
    +'<div class="cal-grid">'+dowRowHtml+cellsHtml+'</div>'
    +'</div>';
}
function shiftCalMonth(delta){
  noteUiAction();
  pendingCalMotion = delta > 0 ? 'next' : 'prev';
  calMonthCursor = new Date(calMonthCursor.getFullYear(), calMonthCursor.getMonth()+delta, 1);
  renderCalContainer();
}
function goCalMonthToday(){
  noteUiAction();
  pendingCalMotion = 'fade';
  const d = new Date();
  calMonthCursor = new Date(d.getFullYear(), d.getMonth(), 1);
  renderCalContainer();
}

// ── Week view: what to actually do, per day, per rough time slot —
// informational (not checkboxes; checking things off happens on 六科). ──
function buildWeekDayBlocks(d, info){
  if(d > EXAM_DATE) return [{time:'', title:'複試準備', custom:'#0F7A8C'}];
  if(info.isRest) return [{time:'全天', title:'休息'}];
  if(info.isDayOff) return [{time:'全天', title:'打工'}];

  if(info.phase === 'converge'){
    return [
      {time:'早上', title:'速記清單', colorVar:'--ac2'},
      {time:'上午–下午', title:'混搭模擬考', colorVar:'--red'},
      {time:'晚上', title:'錯題本三刷', colorVar:'--ac2'}
    ];
  }
  if(info.phase === 'drilling'){
    if(info.dow === 6) return [{time:'全天', title:'模擬考（全科）', colorVar:'--red'}];
    const subj = info.drillSubj || '複習整理';
    const cv = SUBJ_COLOR_VAR[subj] || '--ac2';
    return [
      {time:'上午–中午', title:subj+' 歷屆試題', colorVar:cv},
      {time:'下午', title:'對答案＋錯題本', colorVar:cv},
      {time:'傍晚', title:'補弱點＋筆記', colorVar:cv}
    ];
  }
  // foundation — clickable: jumps to the matching chapter on 六科. Future
  // dates use a forward projection (projectedWeekForDate) instead of
  // freezing on today's week, so a day that isn't finished effectively
  // pushes its content later on the calendar.
  const today0 = new Date(); today0.setHours(0,0,0,0);
  const projWk = d > today0 ? projectedWeekForDate(d) : info.wk;
  const c = FOUNDATION_CONTENT[Math.min(projWk, FOUNDATION_WEEKS)];
  const subj = c ? c.subj : '複習';
  const cv = SUBJ_COLOR_VAR[subj] || '--ac2';
  const chLabel = c ? shortChapterLabel(c.ch) : '複習';
  const click = c ? {subj:subj, wk:projWk} : null;
  return [
    {time:'09:00–11:00', title:subj+' 影片', colorVar:cv, click:click},
    {time:'14:00–16:00', title:chLabel, colorVar:cv, click:click},
    {time:'19:00–20:00', title:'筆記＋練習', colorVar:cv, click:click}
  ];
}

function renderCalWeekView(container){
  if(!calWeekStart){
    const d = new Date(); d.setHours(0,0,0,0);
    calWeekStart = new Date(d); calWeekStart.setDate(d.getDate() - d.getDay());
  }
  const s = startDate();
  const todayIso = isoDate(new Date());
  const dow7 = ['日','一','二','三','四','五','六'];

  let colsHtml = '';
  for(let i=0;i<7;i++){
    const d = new Date(calWeekStart); d.setDate(calWeekStart.getDate()+i);
    const iso = isoDate(d);
    const beforeStart = d < s;
    const isToday_ = iso === todayIso;

    let blocksHtml = '';
    if(!beforeStart){
      const blocks = buildWeekDayBlocks(d, dayInfo(d));
      blocksHtml = blocks.map(function(b){
        const style = b.custom
          ? '--task-accent:'+b.custom+';'
          : b.colorVar
            ? '--task-accent:var('+b.colorVar+');'
            : '--task-accent:var(--mt);';
        const clickAttr = b.click ? ' onclick="goSubjWeek(\''+b.click.subj+'\','+b.click.wk+')"' : '';
        return '<div class="calweek-block'+(b.click?' clickable':'')+'" style="'+style+'"'+clickAttr+'>'
          +'<div class="calweek-block-title">'+b.title+'</div>'
        +'</div>';
      }).join('');
    }

    colsHtml += '<div class="calweek-col">'
      +'<div class="calweek-col-hd'+(isToday_?' today':'')+'">'
        +'<div class="calweek-dow">週'+dow7[i]+'</div><div class="calweek-daynum">'+d.getDate()+'</div>'
      +'</div>'
      +'<div class="calweek-col-body">'+blocksHtml+'</div>'
    +'</div>';
  }

  const rangeEnd = new Date(calWeekStart); rangeEnd.setDate(calWeekStart.getDate()+6);
  const rangeLabel = (calWeekStart.getMonth()+1)+'/'+calWeekStart.getDate()+' – '+(rangeEnd.getMonth()+1)+'/'+rangeEnd.getDate();

  container.innerHTML =
    '<div class="cal-wrap">'
    +'<div class="cal-head">'
      +'<div class="cal-title">'+rangeLabel+'</div>'
      +'<div class="cal-nav">'
        +'<button class="nav-btn ui-btn ui-btn-icon" onclick="shiftCalWeek(-1)" aria-label="上一週" title="上一週">'+svgIcon('chevron-left',18)+'</button>'
        +'<button class="collapse-all-btn ui-btn" onclick="goCalWeekToday()">本週</button>'
        +'<button class="nav-btn ui-btn ui-btn-icon" onclick="shiftCalWeek(1)" aria-label="下一週" title="下一週">'+svgIcon('chevron-right',18)+'</button>'
      +'</div>'
    +'</div>'
    +'<div class="calweek-grid">'+colsHtml+'</div>'
    +'</div>';
}
function shiftCalWeek(delta){
  noteUiAction();
  pendingCalMotion = delta > 0 ? 'next' : 'prev';
  calWeekStart.setDate(calWeekStart.getDate() + delta*7);
  renderCalContainer();
}
function goCalWeekToday(){
  noteUiAction();
  pendingCalMotion = 'fade';
  const d = new Date(); d.setHours(0,0,0,0);
  calWeekStart = new Date(d); calWeekStart.setDate(d.getDate() - d.getDay());
  renderCalContainer();
}


// Segmented ring chart — one arc per foundation week this subject spans,
// lit in the subject's own color once that week's content is done, muted
// otherwise. Replaces the old single linear progress bar so completion
// reads as "which weeks are done" at a glance, not just an overall %.
function buildDonutSVG(doneFlags, color, size, stroke){
  size = size || 76; stroke = stroke || 9;
  const r = (size - stroke) / 2;
  const cx = size/2, cy = size/2;
  const C = 2*Math.PI*r;
  const n = Math.max(doneFlags.length, 1);
  const segLen = C / n;
  const gap = n > 1 ? 3 : 0;
  let circles = '';
  for(let i=0;i<n;i++){
    const dash = Math.max(segLen-gap, 0);
    circles += '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" '
      +'style="stroke:'+(doneFlags[i]?color:'var(--bd2)')+';stroke-width:'+stroke+'px;'
      +'stroke-dasharray:'+dash+' '+(C-dash)+';stroke-dashoffset:'+(-(i*segLen))+';stroke-linecap:round;"/>';
  }
  return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'" style="transform:rotate(-90deg);">'+circles+'</svg>';
}

// ── Navigation ─────────────────────────────────────────────────────
let lastUiActionAt = 0;
let uiFastTimer = null;
function noteUiAction(){
  const now = performance.now();
  const root = document.documentElement;
  document.body.classList.add('ui-interacted');
  root.classList.toggle('ui-fast', now - lastUiActionAt < 320);
  lastUiActionAt = now;
  clearTimeout(uiFastTimer);
  uiFastTimer = setTimeout(function(){ root.classList.remove('ui-fast'); }, 360);
}

let currentAiContextPrompts = [];
let currentAiProactivePrompt = '';
let transientAiNudge = null;
let lastAiContextLabel = '日曆與今日進度';
function dailyEnergy(){
  try{const row=JSON.parse(localStorage.getItem('dailyEnergyV1')||'null');return row&&row.date===isoDate(new Date())?row.value:'';}catch(e){return '';}
}
function energyLabel(value){return value==='low'?'有點累':value==='high'?'有精神':value==='normal'?'普通':'';}
function setDailyEnergy(value){
  if(['low','normal','high'].indexOf(value)===-1)return;
  try{localStorage.setItem('dailyEnergyV1',JSON.stringify({date:isoDate(new Date()),value:value}));}catch(e){}
  renderAiContextDock();renderChatFollowups();
  signalAiNudge({label:value==='low'?'今天先用小步驟前進':value==='high'?'把精神用在最重要的難題':'照穩定節奏完成一件事',detail:value==='low'?'AI 會縮短單次專注並保留休息':'已依今天狀態調整規劃方式',prompt:'我今天的精神狀態是「'+energyLabel(value)+'」。請依我的真實進度安排下一步，調整任務大小與休息節奏；不要因為今天疲累就降低對長期能力的判斷。'});
}
function energyCheckHtml(){
  const current=dailyEnergy();return '<span>'+(current?'今天狀態':'今天感覺如何')+'</span><div>'+[['low','有點累'],['normal','普通'],['high','有精神']].map(function(x){return '<button type="button" class="'+(current===x[0]?'active':'')+'" aria-pressed="'+String(current===x[0])+'" onclick="setDailyEnergy(\''+x[0]+'\')">'+x[1]+'</button>';}).join('')+'</div>';
}
function todayStudyMinutes(){
  const today=isoDate(new Date());
  return (LEARNING_EVIDENCE.sessions||[]).reduce(function(total,row){
    const raw=row.finished_at||row.started_at;if(!raw)return total;
    const date=new Date(String(raw).endsWith('Z')?raw:raw+'Z');
    return !Number.isNaN(date.getTime())&&isoDate(date)===today?total+(Number(row.actual_minutes)||0):total;
  },0);
}
function endDayPrompt(){
  const minutes=todayStudyMinutes(),d=smartOverviewData(),next=nextFoundationTask(DONE_TASK_IDS);
  return '我今天實際計時讀了 '+minutes+' 分鐘。請根據網站中的真實學習、作答與複習紀錄，幫我做一個簡短收尾：整理今天確實完成或練習的內容、指出一件值得肯定的具體行動、提醒尚未解決的重點，最後只留下明天開始時的第一步'+(next?'（目前下一任務是 '+next.subject+'／'+next.title+'）':'')+'。不要虛構今天沒有發生的成果，也不要用責備語氣。';
}
function aiProactiveNudge(sectionId){
  if(transientAiNudge&&transientAiNudge.expires>Date.now())return transientAiNudge;
  transientAiNudge=null;
  const overview=smartOverviewData();
  if(sectionId==='subjects'){
    const tab=document.querySelector('.stab.on'),subject=SUBJECTS.find(function(s){return tab&&s.id===tab.dataset.id;});
    if(subject){
      const rows=subject.chapters.map(function(c,index){const m=chapterEstimatedMastery(subject,c);return {c:c,index:index,m:m};}).filter(function(x){return x.c.pri==='must';}).sort(function(a,b){return a.m.score-b.m.score;});
      const target=rows[0];if(target)return {label:'本科優先：'+target.c.t,detail:target.m.verified?'目前掌握推估 '+target.m.score+'%，建議先補錯題':'目前僅依完成度推估，建議先做章節診斷',prompt:'請根據我的真實進度，分析「'+subject.name+'／'+target.c.t+'」目前最值得先補的觀念，並安排一個可立即開始的短任務。沒有作答證據時請明確說明。'};
    }
  }
  if(sectionId==='schools'){
    const opened=document.querySelector('.uni-card[open]'),u=opened&&UNIS.find(function(row){return opened.querySelector('.uni-en')?.textContent.startsWith(row.en);});
    if(u){const d=schoolExamReadiness(u);if(d&&d.weakest)return {label:u.name+'：先補 '+d.weakest.subject.name,detail:d.weakest.chapter.t+(d.weakest.verified?'':' · 尚待題目驗證'),prompt:'請依網站記錄的真實進度與「'+u.name+'」考科，說明我現在為什麼應優先處理「'+d.weakest.subject.name+'／'+d.weakest.chapter.t+'」，並給我今天能完成的行動。不要把準備度當成錄取率。'};}
    return {label:'先選一間學校查看個人化建議',detail:'展開校卡後，AI 會依該校考科找出下一步',prompt:'請根據網站目前的各校考科與我的真實六科進度，建議我先深入比較哪三間學校，以及各自需要確認的官方資訊。'};
  }
  if(sectionId==='materials'){
    const next=nextFoundationTask(DONE_TASK_IDS);
    return next?{label:'素材要跟著下一項任務走',detail:next.subject+' · '+next.title,prompt:'我的下一項任務是「'+next.subject+'／'+next.title+'」。請只從網站已有素材中選擇現在最適合的一套，說明使用順序並避免重複學習。'}:{label:'基礎素材已完成',detail:'接著應改用考古題與錯題紀錄',prompt:'我的基礎教材任務已完成，請依真實作答與複習紀錄安排下一輪刷題素材。'};
  }
  const todayMinutes=todayStudyMinutes();
  if((sectionId==='schedule'||sectionId==='ai')&&todayMinutes>=20&&new Date().getHours()>=20)return {label:'今天已讀 '+todayMinutes+' 分鐘，要收尾了嗎？',detail:'AI 可以整理今天並留下明天第一步',prompt:endDayPrompt()};
  if(overview.due.length)return {label:'有 '+overview.due.length+' 個到期複習',detail:'先處理間隔複習，再回到主任務',prompt:'我目前有 '+overview.due.length+' 個到期複習。請依真實進度幫我選出今天先複習的章節，再銜接主任務。'};
  const next=nextFoundationTask(DONE_TASK_IDS);
  return next?{label:'現在最值得做：'+next.title,detail:next.subject+' · 約 '+Math.max(1,Math.round(next.estMinutes/60*10)/10)+' 小時',prompt:'請查詢我的真實任務進度，針對下一項「'+next.subject+'／'+next.title+'」拆成今天可執行的最小步驟。'}:{label:'基礎期任務已完成',detail:'下一步應以作答證據安排補強',prompt:'我的基礎期任務已完成，請根據作答與複習紀錄安排接下來一週的刷題重點。'};
}
function aiPageContext(){
  const active = document.querySelector('.sec.on');
  const id = active ? active.id.replace('sec-','') : 'schedule';
  if(id === 'subjects'){
    const panel = document.querySelector('.sp.on');
    const subject = document.querySelector('.stab.on');
    const chapter = panel && (panel.querySelector('.ch-row:not(.collapsed) .ch-title') || panel.querySelector('.ch-row .ch-title'));
    const label = (subject ? subject.textContent.trim() : '六科')+(chapter ? ' · '+chapter.textContent.trim() : '');
    return {label:label,prompts:[
      {label:'解釋目前考點',text:'我正在看「'+label+'」。請用資工所考試會用到的深度解釋核心觀念，並提醒常見陷阱。'},
      {label:'安排本章讀法',text:'請根據我目前的進度，幫我安排「'+label+'」的閱讀、影片與練習順序。'},
      {label:'出題測驗我',text:'請針對「'+label+'」出3題由淺到深的資工所程度題目，先不要公布答案。'}
    ]};
  }
  if(id === 'schools'){
    const opened = document.querySelector('.uni-card[open] .uni-name');
    const label = opened ? opened.textContent.trim() : '各校考試資訊';
    return {label:label,prompts:[
      {label:'整理考科差異',text:'請根據網站目前的學校資料，整理「'+label+'」的考科、考試方式與我需要注意的差異。'},
      {label:'規劃報考策略',text:'以我準備六科資工所考試的情況，幫我分析「'+label+'」的準備重點與報考策略。'},
      {label:'列出待確認資訊',text:'請列出「'+label+'」目前仍應以116學年度官方簡章確認的資訊，不要把未確認資料說成確定。'}
    ]};
  }
  if(id === 'materials'){
    const activeFilter = document.querySelector('#matFilterChips .filter-chip.active');
    const detail = activeFilter && activeFilter.textContent.trim() !== '全部' ? ' · '+activeFilter.textContent.trim() : '';
    const label = '備考素材'+detail;
    return {label:label,prompts:[
      {label:'推薦現在素材',text:'請依照我的真實進度，從網站現有素材中建議我現在最該使用的書目、影片系列或筆記。'},
      {label:'比較課程版本',text:'請比較網站素材頁中同一科目的不同老師或OCW版本，告訴我卡住時適合換哪一套。'},
      {label:'安排使用順序',text:'請把網站現有素材依照我的六科任務進度排成實際使用順序，避免重複看相同主題。'}
    ]};
  }
  const next = document.getElementById('calNextInfo');
  const cal = document.querySelector('#calContainer .cal-title');
  const label = '日曆'+(cal ? ' · '+cal.textContent.trim() : '');
  const nextText = next ? next.textContent.replace(/\s+/g,' ').trim() : '';
  return {label:label,prompts:[
    {label:'評估下一步',text:'這是我日曆目前顯示的下一步：'+nextText+'。請查詢真實進度後，告訴我現在最應該先完成什麼。'},
    {label:'檢查是否落後',text:'請查詢我目前的任務進度，判斷是否落後，並用剩餘任務數與工時說明。'},
    {label:'調整今天安排',text:'請根據我目前真實進度與今天可讀時間，幫我調整今天的讀書安排；先提出建議，不要直接跳過任務。'}
  ]};
}
function renderAiContextDock(){
  const dock = document.getElementById('aiContextDock');
  const title = document.getElementById('aiContextTitle');
  const actions = document.getElementById('aiContextActions');
  const nudgeEl=document.getElementById('aiContextNudge'),peek=document.getElementById('aiContextPeek');
  if(!dock || !title || !actions) return;
  const onAiPage = document.getElementById('sec-ai').classList.contains('on');
  const active=document.querySelector('.sec.on');
  const nudge=aiProactiveNudge(active?active.id.replace('sec-',''):'schedule');
  const homeNudge=document.getElementById('aiHomeNudge');
  if(homeNudge){homeNudge.innerHTML=nudge?'<small>AI 主動建議</small><b>'+escapeHtml(nudge.label)+'</b><span>'+escapeHtml(nudge.detail)+'</span>':'';homeNudge.hidden=!nudge;}
  const energyHtml=energyCheckHtml(),homeEnergy=document.getElementById('aiHomeEnergy'),contextEnergy=document.getElementById('aiContextEnergy');
  if(homeEnergy)homeEnergy.innerHTML=energyHtml;if(contextEnergy)contextEnergy.innerHTML=energyHtml;
  const timePlansHtml='<span>我現在有</span>'+[30,60,120].map(function(minutes){return '<button type="button" onclick="useAiTimePlan('+minutes+')">'+minutes+' 分</button>';}).join('');
  const homeTime=document.getElementById('aiHomeTimePlans'),contextTime=document.getElementById('aiContextTimePlans');
  if(homeTime)homeTime.innerHTML=timePlansHtml;if(contextTime)contextTime.innerHTML=timePlansHtml;
  currentAiProactivePrompt=nudge?nudge.prompt:'';
  dock.classList.toggle('is-hidden', onAiPage);
  if(onAiPage){ dock.classList.remove('open'); return; }
  const ctx = aiPageContext();
  currentAiContextPrompts = ctx.prompts;
  lastAiContextLabel = ctx.label;
  title.textContent = ctx.label;
  if(nudgeEl)nudgeEl.innerHTML=nudge?'<b>'+escapeHtml(nudge.label)+'</b><span>'+escapeHtml(nudge.detail)+'</span>':'';
  if(peek){peek.innerHTML=nudge?'<span></span>'+escapeHtml(nudge.label):'';peek.hidden=!nudge;}
  actions.innerHTML = ctx.prompts.map(function(p,i){
    return '<button type="button" onclick="useAiContextPrompt('+i+')">'+escapeHtml(p.label)+'</button>';
  }).join('');
}
function signalAiNudge(nudge){
  if(nudge)transientAiNudge=Object.assign({expires:Date.now()+15000},nudge);
  renderAiContextDock();
  const dock=document.getElementById('aiContextDock');if(!dock||dock.classList.contains('is-hidden'))return;
  dock.classList.remove('attention');void dock.offsetWidth;dock.classList.add('attention');
  setTimeout(function(){dock.classList.remove('attention');},1800);
}
function useAiProactivePrompt(){
  if(!currentAiProactivePrompt)return;
  sendAiPromptNow(currentAiProactivePrompt);
}
function sendAiPromptNow(prompt){
  const send=document.getElementById('chatSendBtn');if(send&&send.disabled)return;
  openAiWithPrompt(prompt);
  setTimeout(function(){const input=document.getElementById('chatInput');if(input&&input.value.trim())sendChat();},80);
}
function useAiTimePlan(minutes){
  const allowed=[30,60,120];if(allowed.indexOf(minutes)===-1)return;
  const d=smartOverviewData(),next=nextFoundationTask(DONE_TASK_IDS);
  const due=d.due.slice(0,4).map(function(r){const s=SUBJECTS.find(function(x){return x.id===r.subject_id;});const c=s&&s.chapters.find(function(x){return stableTaskKey(x.t)===r.chapter_key;});return s&&c?s.name+'／'+c.t:'';}).filter(Boolean);
  const context=aiPageContext().label;
  const energy=energyLabel(dailyEnergy());
  const prompt='我現在有 '+minutes+' 分鐘可讀'+(energy?'，今天精神狀態是「'+energy+'」':'')+'。請依我的真實進度，排一份總長不超過 '+minutes+' 分鐘、可以立刻照做的計畫。'
    +'目前頁面情境：'+context+'。'
    +(next?'下一個未完成任務：'+next.subject+'／'+next.title+'。':'基礎期任務已完成。')
    +(due.length?'到期複習：'+due.join('、')+'。':'目前沒有到期複習。')
    +(d.evidencedWeak?'已知優先補強：'+d.evidencedWeak.s+'／'+d.evidencedWeak.c+'（'+d.evidencedWeak.score+'%'+(d.evidencedWeak.verified?'，有作答證據':'，尚待驗證')+'）。':'目前沒有足夠弱點證據。')
    +(energy==='有點累'?'請拆成較短專注段並安排一次明確休息，不要用責備語氣。':energy==='有精神'?'把認知負荷最高、最需要推導或手算的內容排在前面。':'用穩定節奏安排，避免塞入過多切換。')
    +'請分配每一步分鐘數，總和必須等於或小於 '+minutes+' 分鐘；先說第一步，不要提供空泛鼓勵，也不要自行把任何任務標成完成。';
  sendAiPromptNow(prompt);
}
function aiContextSnapshot(){
  const d=smartOverviewData(),queue=getFoundationQueueStatus(DONE_TASK_IDS),next=nextFoundationTask(DONE_TASK_IDS);
  const active=document.querySelector('.sec.on'),section=active?active.id.replace('sec-',''):'schedule';
  const subjectTab=document.querySelector('.stab.on'),openChapter=document.querySelector('.sp.on .ch-row:not(.collapsed) .ch-title');
  const school=document.querySelector('.uni-card[open] .uni-name');
  let timer='';try{const saved=JSON.parse(localStorage.getItem('activeStudySessionV2')||'null');if(saved){const ref=chapterRef(saved.subjectId,saved.index);timer=ref?(ref.subject.name+'／'+ref.chapter.t+(saved.paused?'（已暫停）':'（計時中）')):'';}}catch(e){}
  return {
    section:section,
    page_label:lastAiContextLabel,
    queue:{effective_week:queue.effectiveWeek,undone_count:queue.undoneCount,remaining_minutes:queue.totalRemainingMinutes},
    next_task:next?{subject:next.subject,title:next.title,estimated_minutes:next.estMinutes}:null,
    due_reviews:d.due.slice(0,5).map(function(r){const s=SUBJECTS.find(function(x){return x.id===r.subject_id;});const c=s&&s.chapters.find(function(x){return stableTaskKey(x.t)===r.chapter_key;});return s&&c?s.name+'／'+c.t:'';}).filter(Boolean),
    evidenced_weakness:d.evidencedWeak?{subject:d.evidencedWeak.s,chapter:d.evidencedWeak.c,score:d.evidencedWeak.score,verified:d.evidencedWeak.verified}:null,
    visible_subject:section==='subjects'&&subjectTab?subjectTab.textContent.trim():'',
    visible_chapter:section==='subjects'&&openChapter?openChapter.textContent.trim():'',
    visible_school:section==='schools'&&school?school.textContent.trim():'',
    active_timer:timer,
    daily_energy:energyLabel(dailyEnergy()),
    today_study_minutes:todayStudyMinutes()
  };
}
function renderChatFollowups(){
  const root=document.getElementById('aiFollowups');if(!root)return;
  const d=smartOverviewData(),next=nextFoundationTask(DONE_TASK_IDS),actions=[];
  const todayMinutes=todayStudyMinutes();
  if(todayMinutes>0&&new Date().getHours()>=18)actions.push({label:'幫今天收尾 · '+todayMinutes+' 分',icon:'check-circle',run:'sendAiPromptNow(endDayPrompt())'});
  if(d.due.length)actions.push({label:'安排 '+d.due.length+' 個到期複習',icon:'clock',run:"sendAiPromptNow('請依照到期日、章節重要性與我的真實掌握證據，安排目前到期複習的處理順序。給我第一個立刻能開始的動作。')"});
  if(d.evidencedWeak){
    const s=SUBJECTS.find(function(x){return x.name===d.evidencedWeak.s;}),index=s?s.chapters.findIndex(function(c){return c.t===d.evidencedWeak.c;}):-1;
    if(s&&index>=0)actions.push({label:'前往補強 '+d.evidencedWeak.c,icon:'target',run:"openReadinessTarget('"+s.id+"',"+index+")"});
  }
  if(next)actions.push({label:'前往下一項任務',icon:'chevron-right',run:"goSubjWeek('"+next.subject+"',"+next.week+",'"+next.type+"')"});
  actions.push({label:'縮成 30 分鐘計畫',icon:'clock',run:'useAiTimePlan(30)'});
  root.innerHTML='<span>接下來可以</span><div>'+actions.slice(0,4).map(function(a){return '<button type="button" onclick="'+a.run+'">'+svgIcon(a.icon,12)+escapeHtml(a.label)+'</button>';}).join('')+'</div>';
}
function toggleAiContextDock(){
  const dock = document.getElementById('aiContextDock');
  if(!dock) return;
  const open = dock.classList.toggle('open');
  const panel = document.getElementById('aiContextPanel');
  const trigger = dock.querySelector('.ai-context-trigger');
  if(panel) panel.setAttribute('aria-hidden',String(!open));
  if(trigger) trigger.setAttribute('aria-expanded',String(open));
  if(open) renderAiContextDock();
}
function closeAiContextDock(){
  const dock = document.getElementById('aiContextDock');
  if(!dock) return;
  dock.classList.remove('open');
  const panel = document.getElementById('aiContextPanel');
  const trigger = dock.querySelector('.ai-context-trigger');
  if(panel) panel.setAttribute('aria-hidden','true');
  if(trigger) trigger.setAttribute('aria-expanded','false');
}
function useAiContextPrompt(index){
  const item = currentAiContextPrompts[index];
  if(item) openAiWithPrompt(item.text);
}
function openAiWithPrompt(text){
  closeAiContextDock();
  goSec('ai');
  setTimeout(function(){
    const input = document.getElementById('chatInput');
    if(!input) return;
    const draft = input.value.trim();
    input.value = text ? (draft ? draft+'\n\n'+text : text) : draft;
    input.focus();
  },0);
}
// All 6 destinations are direct pills now (no 更多 dropdown — the user
// didn't want secondary pages tucked away or pushed to the page bottom),
// so active state is a straight data-sec lookup.
function goSec(id, el){
  noteUiAction();
  document.querySelectorAll('.sec').forEach(function(s){ s.classList.remove('on'); s.setAttribute('aria-hidden','true'); });
  const target = document.getElementById('sec-'+id);
  if(target){ target.classList.add('on'); target.setAttribute('aria-hidden','false'); }

  document.querySelectorAll('.pill').forEach(function(p){ p.classList.remove('on'); p.removeAttribute('aria-current'); });
  const directPill = document.querySelector('.pill[data-sec="'+id+'"]');
  if(directPill){ directPill.classList.add('on'); directPill.setAttribute('aria-current','page'); }
  // Opening the AI tab counts as having seen today's proactive check-in
  // (it's the first thing in the chat log), even if they never touched
  // the Today-page banner directly.
  if(id === 'ai') markCheckinSeen(isoDate(new Date()));
  setTimeout(renderAiContextDock,0);
}

function setSchoolInfoMode(mode, el){
  if(['all','recommend','exam'].indexOf(mode) === -1) mode = 'all';
  var section = document.getElementById('sec-schools');
  if(section) section.dataset.schoolMode = mode;
  document.querySelectorAll('[data-school-mode]').forEach(function(btn){
    var selected = btn.dataset.schoolMode === mode;
    btn.classList.toggle('active', selected);
    btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
  if(mode==='exam')setAdmissionStage('all');
  if(el) noteUiAction();
}

function setAdmissionStage(stage, el){
  var valid=['all','partial','upcoming','pending'];
  if(valid.indexOf(stage)===-1)stage='all';
  document.querySelectorAll('#uniGrid .uni-card').forEach(function(card){
    card.classList.toggle('admission-stage-hidden',stage!=='all'&&card.dataset.admissionStage!==stage);
  });
  document.querySelectorAll('[data-admission-stage-filter]').forEach(function(btn){
    var active=btn.dataset.admissionStageFilter===stage;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-pressed',String(active));
  });
  var reset=document.querySelector('.admission-radar-reset');
  if(reset)reset.hidden=stage==='all';
  if(el)noteUiAction();
}

function renderAdmissionRadar(){
  var metricsRoot=document.getElementById('admissionRadarMetrics');
  var actionRoot=document.getElementById('admissionNextAction');
  if(!metricsRoot||!actionRoot)return;
  var definitions=[
    {stage:'partial',label:'已有官方資訊',hint:'現在可先核對',icon:'check-circle'},
    {stage:'upcoming',label:'近期預計公告',hint:'9月重點追蹤',icon:'calendar'},
    {stage:'pending',label:'等待正式簡章',hint:'不預填日期',icon:'clock'}
  ];
  metricsRoot.innerHTML=definitions.map(function(item){
    var count=UNIS.filter(function(u){return RECOMMEND_ADMISSIONS[u.en]?.stage===item.stage;}).length;
    return '<button type="button" class="admission-radar-metric" data-admission-stage-filter="'+item.stage+'" aria-pressed="false" onclick="setAdmissionStage(\''+item.stage+'\',this)">'
      +'<span class="admission-radar-metric-icon">'+svgIcon(item.icon,15)+'</span>'
      +'<strong>'+count+'</strong><span>'+item.label+'</span><small>'+item.hint+'</small></button>';
  }).join('');
  var now=new Date();
  var milestone=new Date(2026,8,11);
  var title=now<milestone?'現在先做：完成共用備審母版':'現在先做：逐校核對正式簡章';
  var detail=now<milestone
    ?'先備妥一頁履歷、成績與排名、專題貢獻摘要、研究方向及推薦人清單；9/11起優先回查中山，接著追蹤清大、陽明交大與北科。'
    :'先從已到公告節點的學校開始，逐項核對名額、必繳資料、推薦函格式、字數限制與複試日期；不要直接沿用前一年度規則。';
  actionRoot.innerHTML='<span>'+svgIcon('target',16)+'</span><div><strong>'+title+'</strong><p>'+detail+'</p></div>';
}

// ── Init ──────────────────────────────────────────────────────────
async function init(){
  // Navigation is always explicit. Remove legacy remembered positions so
  // search/calendar jumps can never be overwritten by a delayed restore.
  try{
    localStorage.removeItem('lastSection');
    localStorage.removeItem('lastSubject');
    SUBJECTS.forEach(function(s){ localStorage.removeItem('lastChapter-'+s.id); });
  }catch(e){}

  // Load settings (start date) and the task-queue done-state from the
  // server-backed DB — dayInfo() reads DONE_TASK_IDS synchronously from here on.
  await Promise.all([fetchSettings(), fetchDoneTasks(), fetchLearningEvidence()]);

  renderGreetingHeader();
  renderCalContainer();
  renderGlobalTimer();
  renderAdmissionRadar();

  var commonGuide = HACKMD_ADMISSION_GUIDE.common;
  var guideRoot = document.getElementById('admissionExperienceGuide');
  if(guideRoot && commonGuide){
    var guideEvidence = document.getElementById('admissionGuideEvidence');
    if(guideEvidence) guideEvidence.textContent = '非官方 · '+commonGuide.sources.length+'篇交叉';
    guideRoot.innerHTML = '<div class="experience-warning">考生心得只能用來準備，不能當作116招生規則或錄取門檻。</div>'
      +'<ul>'+commonGuide.points.map(function(point){ return '<li>'+point+'</li>'; }).join('')+'</ul>'
      +'<div class="experience-sources">'+commonGuide.sources.map(function(source){
        return '<a href="'+source.url+'" target="_blank" rel="noopener">'+source.label+'</a>';
      }).join('')+'</div>';
  }

  // Schools (priority schools first)
  // No more 主力校/有複試 categorization or filter chips — the user
  // explicitly didn't want schools sorted/tagged into tiers, just clear
  // per-school facts. Natural UNIS order (by `n`) is used as-is.
  document.getElementById('uniGrid').innerHTML = UNIS.map(function(u){
    var rec = RECOMMEND_ADMISSIONS[u.en];
    var experience = HACKMD_ADMISSION_GUIDE[u.en];
    // One mini-card per department that shares this exam — the school's
    // own 資工所 program first, then any relatedDepts — each showing what
    // it tests, weighting if known, and complex/second-stage-exam status,
    // instead of a flat subject-chip strip disconnected from which
    // department those subjects actually belong to.
    // relatedDepts[0] is always the school's own 資工所 program restated in
    // plain text (tagged "主力" in the source data) — that's the exact same
    // program the synthesized card above already covers with real chips +
    // examFormat + oral status, so it's filtered out here to avoid showing
    // the same department twice.
    var deptCards = [{
      name: '資工所', subjs: u.subjs, format: u.examFormat,
      oralNote: u.oral ? '有複試（'+u.oral+'）' : '目前查無複試，僅筆試'
    }].concat((u.relatedDepts||[]).filter(function(d){
      return d.name.indexOf('主力') === -1;
    }).map(function(d){
      return {name: d.name, subjs: null, subjsText: d.subjects, format: d.note || null, oralNote: null};
    }));

    var deptCardsHtml = deptCards.map(function(d, i){
      var subjsHtml = d.subjs
        ? '<div class="chips">'+d.subjs.map(function(s){ return '<span class="chip">'+s+'</span>'; }).join('')+'</div>'
        : '<div class="dept-card-subjtext">'+d.subjsText+'</div>';
      return '<div class="dept-card">'
        +'<div class="dept-card-hd"><span class="dept-card-icon">'+svgIcon('book-open',13)+'</span><span class="dept-card-name">'+d.name+'</span></div>'
        +subjsHtml
        +(d.format?'<div class="dept-card-format">'+d.format+'</div>':'')
        +(d.oralNote?'<div class="dept-card-oral">'+d.oralNote+'</div>':'')
      +'</div>';
    }).join('');

    return '<details class="uni-card" data-admission-stage="'+(rec?.stage||'pending')+'">'
      +'<summary class="uni-summary">'
        +'<div><div class="uni-name">'+u.name+'</div><div class="uni-en">'+u.en+' · '+u.loc+'</div></div>'
      +'<div class="uni-summary-facts">'
        +(rec?'<div class="summary-recommend"><span class="admission-status status-'+rec.stage+'">'+rec.stageLabel+'</span><strong>116推甄｜'+rec.status+'</strong></div>':'')
        +'<span class="summary-exam">115考試參考｜'+u.exam+' · '+u.examFormat+'</span>'
      +'</div>'
        +'<span class="expand-icon uni-summary-chevron" aria-hidden="true"></span>'
      +'</summary>'
      +'<div class="uni-body">'

      // Section 1 — 115學年度考試入學 historical reference.
      +'<div class="card-section exam-section">'
        +'<div class="card-section-hd">115學年度考試入學（歷史參考）</div>'
        +schoolExamReadinessHtml(u)
        +'<div class="ir"><span class="il">報名時間</span><span class="iv">114年'+u.reg+'</span></div>'
        +'<div class="ir"><span class="il">筆試日期</span><span class="iv">115年'+u.exam+'</span></div>'
        +(u.oral?'<div class="ir"><span class="il">複試日期</span><span class="iv">115年'+u.oral+'</span></div>':'')
        +'<div class="ir"><span class="il">考試地點</span><span class="iv">'+u.place+'</span></div>'
        +'<div class="ir"><span class="il">放榜日期</span><span class="iv">115年'+u.result+'</span></div>'
      +'</div>'

      // Section 2 — current 116 recommendation-admission tracking. Unknown
      // dates stay explicitly pending instead of inheriting last year's dates.
      +(rec?'<div class="card-section recommend-section">'
        +'<div class="card-section-hd recommend-heading"><span>116學年度推甄資訊</span><span class="admission-status status-'+rec.stage+'">'+rec.stageLabel+'</span></div>'
        +'<div class="ir"><span class="il">公告狀態</span><span class="iv">'+rec.status+'</span></div>'
        +'<div class="ir"><span class="il">重要時程</span><span class="iv">'+rec.schedule+'</span></div>'
        +'<div class="ir"><span class="il">甄試方式</span><span class="iv">'+rec.method+'</span></div>'
        +'<div class="ir"><span class="il">先準備</span><span class="iv">'+rec.materials+'</span></div>'
        +'<div class="depts-footnote">'+rec.reference+'</div>'
        +'<div class="rc-links">'
        +'<a class="lbtn ui-btn" href="'+rec.url+'" target="_blank" rel="noopener">推甄官方資訊 →</a>'
        +'<button class="lbtn ui-btn" type="button" onclick="event.stopPropagation();requestSchoolPrepPlan(\''+u.en+'\')">AI 準備建議 →</button>'
        +'</div>'
      +'</div>':'')

      +(experience?'<div class="card-section experience-section">'
        +'<div class="card-section-hd recommend-heading"><span>HackMD 考生經驗</span><span class="experience-badge">非官方 · '+(experience.sources.length > 1 ? experience.sources.length+'篇交叉' : '單篇個案')+'</span></div>'
        +'<ul class="experience-points">'+experience.points.map(function(point){ return '<li>'+point+'</li>'; }).join('')+'</ul>'
        +'<div class="experience-sources">'+experience.sources.map(function(source){ return '<a href="'+source.url+'" target="_blank" rel="noopener">'+source.label+'</a>'; }).join('')+'</div>'
      +'</div>':'')

      // Section 3 — 系所與考試方式: one small card per department (this
      // school's own 資工所 + any relatedDepts), each with its subjects,
      // weighting/format, and complex-exam status together — instead of a
      // subject-chip strip disconnected from which department they belong to.
      +'<div class="card-section">'
        +'<div class="card-section-hd">系所與考試方式</div>'
        +'<div class="dept-cards">'+deptCardsHtml+'</div>'
        +(u.warn?'<div class="warn">'+svgIcon('alert-triangle',11)+' 116學年度考試方式有異動，請以官方公告為準</div>':'')
        +(u.relatedDeptsFootnote?'<div class="depts-footnote">'+u.relatedDeptsFootnote+'</div>':'')
      +'</div>'

      // Section 4 — 查證備註: research notes/trends/warnings, its own category.
      +(u.flags && u.flags.length ?
        '<div class="card-section">'
          +'<div class="card-section-hd">重要提醒</div>'
          +'<div class="uni-flags">'+u.flags.map(function(f){ return '<div class="uni-flag"><span class="uni-flag-icon">'+svgIcon(f.icon,12)+'</span><span>'+f.text+'</span></div>'; }).join('')+'</div>'
        +'</div>' : '')

      +'<a class="lbtn ui-btn" href="'+u.url+'" target="_blank" rel="noopener">官方簡章 →</a>'
      +'</div></details>';
  }).join('');

  // Subjects
  var stabs = document.getElementById('stabs');
  var spPanels = document.getElementById('spPanels');
  var taskSubjectOrder = ['離散數學','資料結構','線性代數','演算法','計算機組織','作業系統'];
  var orderedSubjects = taskSubjectOrder.map(function(name){
    return SUBJECTS.find(function(s){ return s.name === name; });
  }).filter(Boolean);
  orderedSubjects.forEach(function(s, i){
    var t = document.createElement('button');
    t.type = 'button';
    t.className = 'stab ui-btn' + (i===0?' on':'');
    t.style.setProperty('--subject-color','var(--'+s.id+')');
    t.textContent = s.name;
    t.dataset.c = 'var(--'+s.id+')';
    t.dataset.id = s.id;
    t.id = 'stab-'+s.id;
    t.setAttribute('role','tab');
    t.setAttribute('aria-selected', i===0?'true':'false');
    t.setAttribute('aria-controls','sp-'+s.id);
    t.tabIndex = i===0 ? 0 : -1;
    t.onclick = function(){
      noteUiAction();
      document.querySelectorAll('.stab').forEach(function(x){ x.classList.remove('on'); x.setAttribute('aria-selected','false'); x.tabIndex=-1; });
      document.querySelectorAll('.sp').forEach(function(x){ x.classList.remove('on'); x.setAttribute('aria-hidden','true'); });
      this.classList.add('on');
      this.setAttribute('aria-selected','true');
      this.tabIndex=0;
      document.getElementById('sp-'+this.dataset.id).classList.add('on');
      document.getElementById('sp-'+this.dataset.id).setAttribute('aria-hidden','false');
      setTimeout(renderAiContextDock,0);
    };
    stabs.appendChild(t);

    // Complete bibliography: one row per actual book/handout title. Chapter
    // reading ranges belong to chapter tasks and must not become fake books.
    var subjectBooks = [];
    var seenBookNames = {};
    function addSubjectBook(name, note, url){
      var key = String(name || '').replace(/\s+/g,'').toLowerCase();
      if(!key || seenBookNames[key]) return;
      seenBookNames[key] = true;
      subjectBooks.push({name:name,note:note,url:url});
    }
    (s.recommended_books || []).forEach(function(b){ addSubjectBook(b.name,b.note,b.url); });
    var booksHtml = '<details class="rec-books"><summary class="rec-books-hd">本科完整書目 <span class="rec-count">'+subjectBooks.length+' 項</span><span class="expand-icon rec-books-chevron" aria-hidden="true"></span></summary><div class="rec-books-body">'
      + subjectBooks.map(function(b){
          var nameHtml = b.url
            ? '<a class="rec-book-name" href="'+b.url+'" target="_blank" rel="noopener">'+b.name+'</a>'
            : '<span class="rec-book-name">'+b.name+'</span>';
          return '<div class="rec-book-row"><span class="mat-badge mb-book">書</span><div class="rec-book-body">'+nameHtml+'<span class="rec-book-note">'+b.note+'</span></div></div>';
        }).join('')
      + '</div></details>';

    var subjectPlaylists = SUBJECT_PLAYLISTS[s.id] || [];
    var videosHtml = '<details class="rec-books rec-series"><summary class="rec-books-hd">本科完整影片系列素材 <span class="rec-count">'+subjectPlaylists.length+' 套</span><span class="expand-icon rec-books-chevron" aria-hidden="true"></span></summary><div class="rec-books-body">'
      + subjectPlaylists.map(function(series){
          return '<div class="rec-book-row rec-series-row"><span class="mat-badge mb-vid">系列</span><div class="rec-book-body">'
            +'<a class="rec-book-name" href="'+series.url+'" target="_blank" rel="noopener">'+series.name+'</a>'
            +'<span class="rec-book-note">開啟完整 YouTube Playlist</span>'
            +'</div></div>';
        }).join('')
      + '</div></details>';

    // Chapters render as a numbered sequence (dot + connecting line), the
    // same visual language as the Today page's stepper — one signature
    // motif for "this is an ordered flow" instead of a new card pattern,
    // so a 12-chapter list reads as a path to scan down rather than a
    // stack of identical boxes that blur together.
    var chaptersHtml = s.chapters.map(function(c, idx){
      // A chapter has one video task. All complete lecture-series parts and
      // alternate teachers live inside that task instead of becoming one
      // checkbox per YouTube link. Books and exercises remain independent.
      var displayMats = chapterDisplayMaterials(c);
      var chapterTaskIds = displayMats.map(function(m){ return chapterMaterialTaskId(s.id,c,m); });
      var chapterDoneCount = chapterTaskIds.filter(function(id){ return DONE_TASK_IDS.indexOf(id) !== -1; }).length;

      var matsHtml = displayMats.map(function(m){
        var matTaskId = chapterMaterialTaskId(s.id,c,m);
        var matDone = DONE_TASK_IDS.indexOf(matTaskId) !== -1;
        if(m.type === 'vidgroup'){
          var seriesHtml = m.series.map(function(series){
            var links = series.options.map(function(o,oi){
              return '<a class="mat-link mat-opt video-series-link" href="'+o.url+'" target="_blank" rel="noopener" onclick="event.stopPropagation();">'
                +'<span class="video-series-order">'+String(oi+1).padStart(2,'0')+'</span>'
                +'<span class="video-series-label">'+o.label+'</span>'
                +(o.dur?'<span class="mat-dur">'+o.dur+'</span>':'')+'</a>';
            }).join('');
            return '<div class="video-series-card"><div class="video-series-head"><span>'+series.name+'</span><small>'+series.options.length+' 部</small></div>'
              +(series.topics.length?'<div class="video-series-topics">'+series.topics.join(' · ')+'</div>':'')
              +'<div class="video-series-links">'+links+'</div></div>';
          }).join('');
          return '<div class="ch-mat ch-mat-group'+(matDone?' done':'')+'" data-material-task="'+matTaskId+'" role="checkbox" tabindex="0" aria-checked="'+matDone+'" onclick="toggleTask(\''+matTaskId+'\', this)">'
            +'<div class="cb"></div>'
            +'<span class="mat-badge mb-vid">影片</span>'
            +'<div class="mat-group-body"><div class="mat-group-title">'+m.text+'</div>'
            +'<div class="mat-group-note">'+m.series.length+' 個系列 · 同一主題任選一套，框內依序觀看</div>'
            +'<div class="video-series-list">'+seriesHtml+'</div></div></div>';
        }
        var badge = m.type==='book'?'mb-book':m.type==='vid'?'mb-vid':m.type==='ex'?'mb-ex':'mb-rec';
        var label = m.type==='book'?'書':m.type==='vid'?'影片':m.type==='ex'?'練習':'推薦';
        var linkText = m.url ? '<a class="mat-link" href="'+m.url+'" target="_blank" rel="noopener" onclick="event.stopPropagation();">'+m.text+'</a>' : m.text;
        var durHtml = m.dur ? '<span class="mat-dur">'+m.dur+'</span>' : '';
        var noteHtml = m.note ? '<span style="color:var(--mt);font-size:10px;"> — '+m.note+'</span>' : '';
        return '<div class="ch-mat'+(matDone?' done':'')+'" data-material-task="'+matTaskId+'" role="checkbox" tabindex="0" aria-checked="'+matDone+'" onclick="toggleTask(\''+matTaskId+'\', this)">'
          +'<div class="cb"></div>'
          +'<span class="mat-badge '+badge+'">'+label+'</span>'+durHtml+'<span>'+linkText+noteHtml+'</span></div>';
      }).join('');
      var priKey = c.pri==='must'?'must':c.pri==='hi'?'hi':'lo';
      var priClass = priKey==='must'?'p-must':priKey==='hi'?'p-hi':'p-lo';
      var priLabel = priKey==='must'?'必考':priKey==='hi'?'高頻':'補充';
      // A chapter counts as done once its mapped foundation week's content
      // is fully checked off — chapters with no wk (not part of the queue,
      // e.g. low-yield 選讀 topics) just stay a plain numbered dot.
      var chDone = chapterTaskIds.length > 0 && chapterDoneCount === chapterTaskIds.length;
      var dotHtml = chDone ? '✓' : String(idx+1);
      return '<div class="ch-row collapsed'+(chDone?' ch-row-done':'')+'" data-pri="'+priKey+'" style="--ch-color:'+s.color+';">'
        +'<div class="ch-marker"><div class="ch-dot'+(chDone?' done':'')+'">'+dotHtml+'</div><div class="ch-line"></div></div>'
        +'<div class="ch-content">'
        +'<div class="ch-head" data-chtoggle role="button" tabindex="0" aria-expanded="false"><span class="expand-icon ch-chevron" aria-hidden="true"></span><div style="flex:1;"><div class="ch-title">'+c.t+'</div><div class="ch-sub">'+c.sub+'</div></div>'
        +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">'
        +'<span class="pri '+priClass+'">'+priLabel+'</span><span class="ch-hrs">'+c.hrs+' · <b class="ch-progress-count">'+chapterDoneCount+'/'+chapterTaskIds.length+'</b></span></div></div>'
        +'<div class="ch-body"><div>'
        +'<div class="ch-section"><div class="ch-section-lbl">核心考點</div><div class="ch-key">'+c.key+'</div>'+chapterLearningFlowHtml(s,c,idx,chapterDoneCount,chapterTaskIds.length)+'</div>'
        +(c.peerNote ? '<div class="ch-section ch-peernote-section"><div class="ch-section-lbl">同儕筆記提醒</div><div class="ch-peernote">'+c.peerNote+'</div></div>' : '')
        +'<div class="ch-section"><div class="ch-section-lbl">素材與練習</div><div class="ch-mats">'+matsHtml+'</div></div>'
        +'</div></div>'
        +'</div></div>';
    }).join('');

    var subjTasks = [];
    s.chapters.forEach(function(c){
      chapterDisplayMaterials(c).forEach(function(m){ subjTasks.push({id:chapterMaterialTaskId(s.id,c,m)}); });
    });
    var subjDone = subjTasks.filter(function(tk){ return DONE_TASK_IDS.indexOf(tk.id) !== -1; }).length;
    var subjPct = subjTasks.length ? Math.round((subjDone/subjTasks.length)*100) : 0;

    // One ring segment per foundation week this subject spans (not per
    // chapter — several chapters usually share one week, so week-level
    // segments are the actual unit of "done", matching how the dots above
    // light up too).
    var chapterDoneFlags = s.chapters.map(function(c){
      var ids = chapterDisplayMaterials(c).map(function(m){ return chapterMaterialTaskId(s.id,c,m); });
      return ids.length > 0 && ids.every(function(id){ return DONE_TASK_IDS.indexOf(id) !== -1; });
    });
    var doneChapterCount = chapterDoneFlags.filter(Boolean).length;
    var remainingHours = Math.max(0,Math.round((Number(s.hours)||0)*(1-subjPct/100)*10)/10);
    var donutHtml = '<div class="sp-donut"><div class="sp-donut-svg">'+buildDonutSVG(chapterDoneFlags, s.color)+'</div>'
      +'<div class="sp-donut-label"><div class="sp-donut-pct" style="color:'+s.color+';">'+subjPct+'%</div><div class="sp-donut-sub">'+subjDone+'/'+subjTasks.length+' 項</div></div></div>';

    var p = document.createElement('div');
    p.className = 'sp' + (i===0?' on':'');
    p.id = 'sp-'+s.id;
    p.setAttribute('role','tabpanel');
    p.setAttribute('aria-labelledby','stab-'+s.id);
    p.setAttribute('aria-hidden',i===0?'false':'true');
    p.innerHTML = '<div class="subject-overview-card"><div class="sp-top">'
      +donutHtml
      +'<div class="smeta">'
        +'<div class="sm"><div class="sm-n" style="color:'+s.color+';">'+(subjTasks.length-subjDone)+'</div><div class="sm-l">剩餘任務</div></div>'
        +'<div class="sm"><div class="sm-n" style="color:'+s.color+';">~'+remainingHours+'hr</div><div class="sm-l">預估剩餘時間</div></div>'
        +'<div class="sm"><div class="sm-n" style="color:'+s.color+';">'+doneChapterCount+'/'+s.chapters.length+'</div><div class="sm-l">完成章節</div></div>'
      +'</div>'
      +'</div>'
      +'<div class="rec-row">'+booksHtml+videosHtml+'</div></div>'
      +'<div class="filter-bar"><div class="filter-chips" data-chfilter>'
        +'<button class="filter-chip ui-btn active" type="button" data-pri="all" aria-pressed="true">全部</button>'
        +'<button class="filter-chip ui-btn" type="button" data-pri="must" aria-pressed="false">必考</button>'
        +'<button class="filter-chip ui-btn" type="button" data-pri="hi" aria-pressed="false">高頻</button>'
        +'<button class="filter-chip ui-btn" type="button" data-pri="lo" aria-pressed="false">補充</button>'
      +'</div><button class="collapse-all-btn ui-btn" data-collapseall>全部收合</button></div>'
      +'<div class="ch-list">'+chaptersHtml+'</div>'
      +'<div class="filter-empty" data-chempty>這個分類目前沒有章節。</div>'
      +'<div class="tip">'+s.tip+'</div>';
    spPanels.appendChild(p);

    // Wire up priority filter chips + collapse-all toggle for this subject panel.
    var chFilterBar = p.querySelector('[data-chfilter]');
    var chRows = p.querySelectorAll('.ch-row');
    var chEmpty = p.querySelector('[data-chempty]');
    chFilterBar.addEventListener('click', function(e){
      var btn = e.target.closest('.filter-chip');
      if(!btn) return;
      chFilterBar.querySelectorAll('.filter-chip').forEach(function(b){ b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed','true');
      var pri = btn.dataset.pri;
      var visibleCount = 0;
      chRows.forEach(function(row, idx){
        var rowPri = row.dataset.pri;
        var show = pri === 'all' || rowPri === pri;
        row.classList.toggle('filtered-out', !show);
        if(show) visibleCount++;
      });
      chEmpty.classList.toggle('show', visibleCount === 0);
      try{ localStorage.setItem('subjectFilter-'+s.id, pri); }catch(err){}
    });
    var collapseBtn = p.querySelector('[data-collapseall]');
    var allCollapsed = true;
    collapseBtn.textContent = '全部展開';
    collapseBtn.setAttribute('aria-expanded','false');
    collapseBtn.addEventListener('click', function(){
      allCollapsed = !allCollapsed;
      chRows.forEach(function(row){ row.classList.toggle('collapsed', allCollapsed); });
      collapseBtn.textContent = allCollapsed ? '全部展開' : '全部收合';
      collapseBtn.setAttribute('aria-expanded', String(!allCollapsed));
    });
    p.querySelectorAll('[data-chtoggle]').forEach(function(head){
      head.addEventListener('click', function(){
        noteUiAction();
        var row = head.closest('.ch-row');
        var collapsed = row.classList.toggle('collapsed');
        head.setAttribute('aria-expanded', String(!collapsed));
        setTimeout(renderAiContextDock,0);
      });
      head.addEventListener('keydown', function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); head.click(); } });
    });
    p.querySelectorAll('.ch-mat').forEach(function(task){
      task.addEventListener('keydown', function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); task.click(); } });
    });
    try{
      var savedFilter = localStorage.getItem('subjectFilter-'+s.id);
      if(savedFilter && savedFilter !== 'all'){
        var savedBtn = chFilterBar.querySelector('[data-pri="'+savedFilter+'"]');
        if(savedBtn) savedBtn.click();
      }
    }catch(err){}
  });

  stabs.addEventListener('keydown', function(e){
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
    var tabs=Array.from(stabs.querySelectorAll('[role="tab"]'));
    var current=tabs.indexOf(document.activeElement);
    if(current<0)return;
    e.preventDefault();
    var next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(current+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    tabs[next].focus();tabs[next].click();
  });

  // Materials
  var RC_LINK_LIMIT = 8;
  var subjectNameById = {ds:'資料結構',alg:'演算法',os:'作業系統',la:'線性代數',dm:'離散數學',ca:'計算機組織'};
  var playlistByUrl = {};
  Object.keys(SUBJECT_PLAYLISTS).forEach(function(subjectId){
    SUBJECT_PLAYLISTS[subjectId].forEach(function(series){
      if(!playlistByUrl[series.url]){
        playlistByUrl[series.url] = {name:series.name,url:series.url,subjects:[]};
      }
      if(playlistByUrl[series.url].subjects.indexOf(subjectNameById[subjectId]) === -1){
        playlistByUrl[series.url].subjects.push(subjectNameById[subjectId]);
      }
    });
  });
  var playlistMaterials = Object.keys(playlistByUrl).map(function(url){
    var series = playlistByUrl[url];
    return {
      type:'完整課程',name:series.name,
      st:'適用：'+series.subjects.join('、'),
      url:series.url
    };
  });
  // Books live in 六科; individual videos live in chapter tasks. The material
  // library therefore keeps only playlist entrances and supporting resources.
  var supportingMaterials = MATS.filter(function(m){
    return m.type === '同儕筆記' || m.type === '歷屆試題' || m.type === '複試準備';
  }).map(function(m){
    var clean = Object.assign({},m);
    if(clean.type === '歷屆試題' || clean.type === '複試準備') clean.type = '考古題與複試';
    if(clean.type === '同儕筆記'){
      delete clean.st;
      delete clean.when;
      delete clean.how;
    }
    // A single YouTube watch link belongs in a chapter task, never here.
    if(clean.url && clean.url.indexOf('youtube.com/watch?') !== -1) delete clean.url;
    if(clean.urls){
      clean.urls = clean.urls.filter(function(l){ return !l.url || l.url.indexOf('youtube.com/watch?') === -1; });
    }
    return clean;
  });
  var materialLibrary = playlistMaterials.concat(supportingMaterials);
  document.getElementById('resGrid').innerHTML = materialLibrary.map(function(m, mi){
    var linkHtml;
    if(m.urls && m.urls.length){
      var mkLink = function(l){ return '<a class="lbtn ui-btn" href="'+l.url+'" target="_blank" rel="noopener">'+l.label+' →</a>'; };
      if(m.urls.length > RC_LINK_LIMIT){
        var shown = m.urls.slice(0, RC_LINK_LIMIT).map(mkLink).join('');
        var rest = m.urls.slice(RC_LINK_LIMIT).map(mkLink).join('');
        var restId = 'rc-extra-'+mi;
        linkHtml = '<div class="rc-links">'+shown
          +'<div class="rc-links-extra" id="'+restId+'">'+rest+'</div>'
          +'<button class="rc-toggle ui-btn" onclick="toggleRcLinks(\''+restId+'\', this)">展開其餘 '+(m.urls.length-RC_LINK_LIMIT)+' 個連結<span class="expand-icon rc-toggle-icon" aria-hidden="true"></span></button>'
          +'</div>';
      } else {
        linkHtml = '<div class="rc-links">' + m.urls.map(mkLink).join('') + '</div>';
      }
    } else {
      var linkLabel = m.type === '完整課程' ? '播放清單 ↗' : '前往資源 →';
      linkHtml = m.url ? '<a class="lbtn ui-btn" href="'+m.url+'" target="_blank" rel="noopener" style="margin-top:10px;">'+linkLabel+'</a>' : '';
    }
    var statusHtml = m.st ? '<div class="rc-st">'+m.st+'</div>' : '';
    var whenHtml = m.when ? '<div class="rc-when">'+m.when+'</div>' : '';
    var howHtml = m.how ? '<div class="rc-how">'+m.how+'</div>' : '';
    var insightsHtml = (m.insights && m.insights.length)
      ? (function(){
          // Count only the peer-note (HackMD) links, not official portals/
          // download pages mixed into the same card — those aren't sources
          // the insights above were cross-referenced against.
          var noteUrls = (m.urls || []).filter(function(l){ return l.url && l.url.indexOf('hackmd.io') !== -1; });
          var sourceCount = noteUrls.length || (m.urls && m.urls.length) || 1;
          var badge = sourceCount > 1 ? sourceCount+'篇交叉' : '單篇個案';
          return '<details class="rc-insights"><summary>實際重點（已讀過原筆記整理，非目錄臆測）<span class="experience-badge">'+badge+'</span></summary><ul>'
            + m.insights.map(function(s){ return '<li>'+s+'</li>'; }).join('')
            + '</ul></details>';
        })()
      : '';
    var typeLabel = m.type === '完整課程' ? '課程播放清單' : m.type;
    return '<div class="rc" data-type="'+m.type+'"><div class="rc-type">'+typeLabel+'</div><div class="rc-name">'+m.name+'</div>'+statusHtml+whenHtml+howHtml+linkHtml+insightsHtml+'</div>';
  }).join('');

  (function(){
    var types = materialLibrary.map(function(m){ return m.type; }).filter(function(v,i,a){ return a.indexOf(v)===i; });
    var chipsBar = document.getElementById('matFilterChips');
    chipsBar.innerHTML = '<button class="filter-chip ui-btn active" type="button" data-t="all" aria-pressed="true">全部</button>'
      + types.map(function(t){ return '<button class="filter-chip ui-btn" type="button" data-t="'+t+'" aria-pressed="false">'+t+'</button>'; }).join('');
    var cards = document.querySelectorAll('#resGrid .rc');
    var emptyMsg = document.getElementById('matEmpty');
    var activeType = 'all';
    function applyFilter(){
      var visible = 0;
      cards.forEach(function(card){
        var typeOk = activeType === 'all' || card.dataset.type === activeType;
        var show = typeOk;
        card.classList.toggle('filtered-out', !show);
        if(show) visible++;
      });
      emptyMsg.classList.toggle('show', visible === 0);
    }
    chipsBar.addEventListener('click', function(e){
      var btn = e.target.closest('.filter-chip');
      if(!btn) return;
      chipsBar.querySelectorAll('.filter-chip').forEach(function(b){ b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed','true');
      activeType = btn.dataset.t;
      applyFilter();
    });
  })();

  loadChatHistory();
  loadMemories();
  loadDailyCheckin();
  document.body.classList.add('ui-ready');
  renderAiContextDock();
}

init();

// ── AI Chat (bridges to the local Codex CLI via the server) ─────────
function escapeHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function chatBubbleHtml(role, content){
  const cls = role === 'user' ? 'user' : role === 'assistant' ? 'assistant' : 'system';
  return '<div class="chat-msg '+cls+'">'+escapeHtml(content)+'</div>';
}

async function loadChatHistory(){
  const log = document.getElementById('chatLog');
  if(!log) return;
  try{
    const r = await fetch('/api/chat/history');
    const j = await r.json();
    if(!j.messages || !j.messages.length){
      log.innerHTML = '<div class="chat-empty">還沒有對話。問問題，或跟AI說「這週進度落後了」讓它幫你調整。</div>';
      renderChatFollowups();
      return;
    }
    log.innerHTML = j.messages.map(function(m){ return chatBubbleHtml(m.role, m.content); }).join('');
    log.scrollTop = log.scrollHeight;
    renderChatFollowups();
  }catch(e){
    log.innerHTML = '<div class="chat-empty">無法連線到伺服器。</div>';
  }
}

// Proactive daily check-in — this app has no background process, so
// "proactive" here means: the first time the page loads on a new calendar
// day, ask the server for today's check-in (it generates + caches one real
// AI-written greeting if today doesn't have one yet, otherwise just returns
// the cached one — never more than one AI call per day). If the user
// hasn't "seen" today's check-in yet (tracked in localStorage, since this
// is a single-user local app with no server-side read-state), show it as
// a banner on the Today page and a dot on the AI 助教 nav item, instead of
// only sitting quietly at the top of the AI chat log where they might not
// look until much later.
function checkinSeenKey(date){ return 'checkin-seen-' + date; }
function markCheckinSeen(date){
  try{ localStorage.setItem(checkinSeenKey(date), '1'); }catch(e){}
  const dot = document.getElementById('aiUnreadDot');
  if(dot) dot.style.display = 'none';
}
async function loadDailyCheckin(){
  const banner = document.getElementById('checkinBanner');
  if(!banner) return;
  try{
    const r = await fetch('/api/checkin');
    if(!r.ok) return; // Codex CLI unavailable etc. — fail quietly, rule-based hero still works
    const j = await r.json();
    if(!j.message) return;
    let seen = false;
    try{ seen = !!localStorage.getItem(checkinSeenKey(j.date)); }catch(e){}
    if(seen) return;
    banner.innerHTML = '<span class="checkin-icon">'+svgIcon('message-circle',18)+'</span><span class="checkin-text">'+escapeHtml(j.message)+'</span>'
      +'<button class="checkin-dismiss" onclick="dismissCheckin(\''+j.date+'\')" aria-label="關閉">'+svgIcon('x',13)+'</button>';
    banner.style.display = 'flex';
    const dot = document.getElementById('aiUnreadDot');
    if(dot) dot.style.display = 'inline-block';
    // loadChatHistory() already ran once on init, before this (slower,
    // spawns Codex CLI) request resolved — reload it so a freshly
    // generated check-in is actually there if the user opens the AI tab.
    if(j.isNew) loadChatHistory();
  }catch(e){ /* offline or server not running — quietly skip, not fatal */ }
}
function dismissCheckin(date){
  markCheckinSeen(date);
  const banner = document.getElementById('checkinBanner');
  if(banner) banner.style.display = 'none';
}

async function loadMemories(){
  const list = document.getElementById('memoryList');
  if(!list) return;
  try{
    const r = await fetch('/api/memory');
    const j = await r.json();
    const memories = j.memories || [];
    if(!memories.length){
      list.innerHTML = '<div class="memory-empty">還沒有長期記憶——AI 聊天時發現值得記住的事會存在這裡。</div>';
      return;
    }
    list.innerHTML = memories.map(function(m){
      return '<div class="memory-item"><span>'+escapeHtml(m.content)+'</span>'
        +'<button class="memory-del" onclick="deleteMemory('+m.id+')" title="刪除">'+svgIcon('x',13)+'</button></div>';
    }).join('');
  }catch(e){
    list.innerHTML = '<div class="memory-empty">無法連線到伺服器。</div>';
  }
}

async function deleteMemory(id){
  await fetch('/api/memory/' + id, { method:'DELETE' });
  loadMemories();
}

function quickChat(text){
  const input = document.getElementById('chatInput');
  if(!input) return;
  input.value = text;
  sendChat();
}

async function sendChat(){
  const input = document.getElementById('chatInput');
  const btn = document.getElementById('chatSendBtn');
  const status = document.getElementById('chatStatus');
  const log = document.getElementById('chatLog');
  if(!input || !btn || !status || !log) return;
  const msg = input.value.trim();
  if(!msg) return;

  const empty = log.querySelector('.chat-empty');
  if(empty) empty.remove();
  log.insertAdjacentHTML('beforeend', chatBubbleHtml('user', msg));
  log.scrollTop = log.scrollHeight;
  input.value = '';
  input.disabled = true;
  btn.disabled = true;
  log.setAttribute('aria-busy','true');
  status.textContent = 'AI 思考中…（正在呼叫本機 Codex，約需幾秒）';

  try{
    const r = await fetch('/api/chat', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({message: msg, ui_context: lastAiContextLabel, study_context:aiContextSnapshot()})
    });
    const j = await r.json();
    if(!r.ok){
      log.insertAdjacentHTML('beforeend', chatBubbleHtml('system', '⚠ ' + (j.message || j.error || '發生錯誤')));
      status.textContent = '';
      return;
    }
    log.insertAdjacentHTML('beforeend', chatBubbleHtml('assistant', j.reply));
    log.scrollTop = log.scrollHeight;
    // The AI may have marked tasks done/undone or changed the start date via
    // plan-tool.js (that's the only way to change it now, there's no UI) —
    // refresh queue/settings state and re-render if either actually changed.
    const prevDone = DONE_TASK_IDS.join(',');
    const prevStartDate = SETTINGS.start_date;
    if(j.settings) SETTINGS = j.settings;
    await fetchDoneTasks();
    if(DONE_TASK_IDS.join(',') !== prevDone || SETTINGS.start_date !== prevStartDate){
      renderGreetingHeader();
      renderCalContainer();
    }
    renderChatFollowups();
    loadMemories(); // the AI may have remembered or forgotten something this turn
    status.textContent = typeof j.cost_usd === 'number' ? ('花費 $' + j.cost_usd.toFixed(3)) : '';
  }catch(e){
    log.insertAdjacentHTML('beforeend', chatBubbleHtml('system', '⚠ 連線失敗，確認伺服器（node server.js）是否還在跑'));
    status.textContent = '';
  }finally{
    log.setAttribute('aria-busy','false');
    input.disabled = false;
    btn.disabled = false;
    input.focus();
  }
}

async function resetChat(){
  await fetch('/api/chat/reset', {method:'POST'});
  const log = document.getElementById('chatLog');
  if(log) log.innerHTML = '<div class="chat-empty">已開始新對話。</div>';
  renderChatFollowups();
}

async function exportProgressBackup(){
  try{
    const r = await fetch('/api/progress/export');
    if(!r.ok) throw new Error('匯出失敗');
    const data = await r.json();
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'csie-prep-progress-'+isoDate(new Date())+'.json';
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    showTaskToast('進度備份已匯出');
  }catch(e){ showTaskToast('備份匯出失敗'); }
}
async function importProgressBackup(file){
  if(!file) return;
  try{
    const data = JSON.parse(await file.text());
    if(!confirm('匯入會以備份內容取代目前進度，確定繼續嗎？')) return;
    const r = await fetch('/api/progress/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    const result = await r.json();
    if(!r.ok) throw new Error(result.error || '匯入失敗');
    showTaskToast('備份已匯入，正在重新載入');
    setTimeout(function(){ location.reload(); },700);
  }catch(e){ showTaskToast(e.message || '備份格式錯誤'); }
}

function globalSearchCatalog(){
  const items = [];
  SUBJECTS.forEach(function(s){
    s.chapters.forEach(function(c,idx){
      items.push({type:s.name,title:c.t,detail:c.sub+' '+c.key,action:'chapter',subject:s.name,index:idx});
    });
  });
  Object.keys(SUBJECT_PLAYLISTS).forEach(function(id){
    SUBJECT_PLAYLISTS[id].forEach(function(p){ items.push({type:'完整課程',title:p.name,detail:'YouTube Playlist',url:p.url}); });
  });
  MATS.forEach(function(m){
    const url = m.url || (m.urls && m.urls[0] && m.urls[0].url);
    if(url) items.push({type:m.type,title:m.name,detail:m.st || '',url:url});
  });
  UNIS.forEach(function(u,idx){
    var rec = RECOMMEND_ADMISSIONS[u.en];
    var experience = HACKMD_ADMISSION_GUIDE[u.en];
    var recSearch = rec ? ' 116推甄 '+rec.status+' '+rec.method+' '+rec.materials : '';
    var experienceSearch = experience ? ' HackMD考生經驗 '+experience.points.join(' ') : '';
    var visibleDetail = u.en+'｜116推甄 '+(rec ? rec.stageLabel : '待公告');
    items.push({type:'學校',title:u.name,detail:visibleDetail,searchText:u.subjs.join(' ')+recSearch+experienceSearch,action:'school',index:idx});
  });
  return items;
}
let globalSearchReturnFocus=null;
function openGlobalSearch(){
  const panel = document.getElementById('globalSearchPanel');
  if(!panel) return;
  if(!panel.classList.contains('open'))globalSearchReturnFocus=document.activeElement;
  panel.classList.add('open');panel.setAttribute('aria-hidden','false');
  const input = document.getElementById('globalSearchInput');
  input.value='';renderGlobalSearch('');setTimeout(function(){input.focus();},0);
}
function closeGlobalSearch(){
  const panel = document.getElementById('globalSearchPanel');
  const wasOpen=panel?.classList.contains('open');
  if(panel){panel.classList.remove('open');panel.setAttribute('aria-hidden','true');}
  if(wasOpen&&globalSearchReturnFocus?.isConnected)globalSearchReturnFocus.focus();
  globalSearchReturnFocus=null;
}
function renderGlobalSearch(query){
  const out = document.getElementById('globalSearchResults');
  const announcement = document.getElementById('globalSearchAnnouncement');
  if(!out) return;
  const q = String(query||'').trim().toLowerCase();
  if(!q){ out.innerHTML='<div class="global-search-empty">輸入考點、章節、學校或素材名稱</div>'; if(announcement)announcement.textContent=''; return; }
  const matches = globalSearchCatalog().filter(function(x){ return (x.title+' '+x.detail+' '+(x.searchText||'')+' '+x.type).toLowerCase().includes(q); }).slice(0,24);
  if(announcement) announcement.textContent = matches.length ? '找到 '+matches.length+' 筆結果' : '找不到符合的結果';
  out.innerHTML = matches.length ? matches.map(function(x){
    const action = x.action === 'chapter' ? 'goSearchChapter(\''+x.subject+'\','+x.index+')' : x.action === 'school' ? 'goSearchSchool('+x.index+')' : '';
    const tag = x.url ? 'a href="'+x.url+'" target="_blank" rel="noopener"' : 'button type="button" onclick="'+action+'"';
    const close = x.url ? 'a' : 'button';
    return '<'+tag+' class="global-search-item"><span class="global-search-type">'+escapeHtml(x.type)+'</span><span><b>'+escapeHtml(x.title)+'</b><small>'+escapeHtml(x.detail)+'</small></span></'+close+'>';
  }).join('') : '<div class="global-search-empty">找不到符合的章節或資源</div>';
}
function goSearchChapter(subjectName,index){
  closeGlobalSearch();
  const s=SUBJECTS.find(function(x){return x.name===subjectName;});if(!s)return;
  goSec('subjects');const tab=document.querySelector('.stab[data-id="'+s.id+'"]');if(tab)tab.click();
  const row=document.querySelectorAll('#sp-'+s.id+' .ch-row')[index];if(row){row.classList.remove('collapsed');row.scrollIntoView({block:'center'});}
}
function goSearchSchool(index){
  closeGlobalSearch();goSec('schools');
  const card=document.querySelectorAll('.uni-card')[index];if(card){card.open=true;card.scrollIntoView({block:'center'});}
}

document.addEventListener('DOMContentLoaded', function(){
  const input = document.getElementById('chatInput');
  if(input) input.addEventListener('keydown', function(e){ if(e.key === 'Enter') sendChat(); });
  const globalInput = document.getElementById('globalSearchInput');
  if(globalInput) globalInput.addEventListener('input',function(){renderGlobalSearch(this.value);});
  document.addEventListener('keydown',function(e){
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openGlobalSearch();}
    if(e.key==='Escape'){
      if(document.getElementById('diagnosticModal')?.classList.contains('open'))closeDiagnosticModal();
      else if(document.getElementById('chapterToolModal')?.classList.contains('open'))closeChapterToolModal();
      else if(document.getElementById('globalSearchPanel')?.classList.contains('open'))closeGlobalSearch();
      else closeAiContextDock();
    }
    if(e.key==='Tab'){
      var activeDialog=document.querySelector('.chapter-tool-modal.open .chapter-tool-dialog, .global-search-panel.open .global-search-dialog');
      if(!activeDialog)return;
      var focusable=Array.from(activeDialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(function(el){return el.offsetParent!==null;});
      if(!focusable.length)return;
      var first=focusable[0],last=focusable[focusable.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  document.addEventListener('click',function(e){
    const dock = document.getElementById('aiContextDock');
    if(dock && dock.classList.contains('open') && !e.target.closest('#aiContextDock')) closeAiContextDock();
    if(e.target.closest('.uni-summary,#matFilterChips .filter-chip')) setTimeout(renderAiContextDock,0);
  });
});
