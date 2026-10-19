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

async function syncFoundationWeek(wk){
  await syncFoundationWeekTasks(wk, DONE_TASK_IDS);
  await fetchDoneTasks();
}

// ── Constants ──────────────────────────────────────────────────────
const EXAM_DATE = new Date('2027-02-01');
const FOUNDATION_WEEKS = 19; // weeks of chapter-by-chapter foundation from start date
const CONVERGENCE_DAYS = 21; // last N days before exam = pure convergence, no new material
// The chapter card's main call to action: open the chapter study room
// (video + synced notes + lab + quiz). See public/study.html.
function chapterStudyHtml(subjectId, idx){
  return '<a class="ch-study-link" href="'+studyRoomUrl(subjectId, idx)+'">'+svgIcon('film',14)+'進入學習空間：邊看影片邊學</a>';
}
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
    {name:'3Blue1Brown《Essence of Linear Algebra》',url:'https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab'}
  ],
  dm:[
    {name:'交大OCW 易志偉《離散數學》',url:'https://www.youtube.com/playlist?list=PLj6E8qlqmkFu0DqDkiub6adY9HBkEsNNG'},
    {name:'清大OCW 趙啟超《離散數學》',url:'https://www.youtube.com/playlist?list=PLS0SUwlYe8cyaHfrgAVaaKVNkwLYNsTA2'}
  ],
  ca:[
    {name:'清大 黃婷婷《計算機結構》',url:'https://www.youtube.com/playlist?list=PLS0SUwlYe8czszh6M74JCU0mIUL_ymBbe'}
  ]
};
// ── State ──────────────────────────────────────────────────────────
// SETTINGS is loaded from the server (SQLite-backed) in init(); everything
// that used to read localStorage now reads/writes through the API instead.
let SETTINGS = { start_date: new Date().toISOString().slice(0,10) };
// Cache of completed task ids (foundation-phase queue). Fetched in init()
// and refreshed after every toggle — dayInfo() reads this synchronously,
// same pattern as SETTINGS.
let DONE_TASK_IDS = [];
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
  return DONE_TASK_IDS;
}
// Queue tasks (w<N>-video) are derived from the per-video marks, never the
// other way round, so the stored ids are used as they are.
function expandQueueDoneIds(ids){
  return Array.from(new Set(ids || []));
}

function startDate(){
  const d = new Date(SETTINGS.start_date); d.setHours(0,0,0,0); return d;
}

function isoDate(d){
  const t = new Date(d); t.setHours(12,0,0,0);
  return t.toISOString().slice(0,10);
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
  let hrs = '~6hr';
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
    1: {subj:'資料結構', ch:'Ch1 基本概念（複雜度分析、Big-O/Θ/Ω、Master Method）+ Ch2 陣列與結構（Array）+ Ch3 堆疊與佇列（Stack/Queue）',
        book:'資結七版（洪逸）Ch1–Ch3',
        vid:[{icon:'🎬',text:'交大OCW 彭文志《資料結構》Ch1 Introduction',url:'https://www.youtube.com/watch?v=3503j2L6qNA',dur:'1:10:42'},
             {icon:'🎬',text:'Time Complexity of a Computer Program',url:'https://www.youtube.com/watch?v=V42FBiohc6c',dur:'9:42'}]},
    2: {subj:'資料結構', ch:'Ch4 鏈結串列（Linked List各類型）+ Ch5 樹與二元樹（Tree & Binary Tree、走訪Traversal【非常重要】）',
        book:'資結七版（洪逸）Ch4–Ch5',
        vid:[{icon:'🎬',text:'Linked List Introduction & Concepts',url:'https://www.youtube.com/watch?v=akErwS16DUg',dur:'27:07'},
             {icon:'🎬',text:'Binary Tree Traversals（Inorder, Preorder, Postorder）',url:'https://www.youtube.com/watch?v=-b2lciNd2L4',dur:'11:07'}]},
    3: {subj:'資料結構', ch:'Ch6 圖形（表示法、Traversal、Spanning Tree、最短路徑、拓撲排序）+ Ch7 搜尋與排序（Search、Sort）',
        book:'資結七版（洪逸）Ch6–Ch7',
        vid:[{icon:'🎬',text:'Abdul Bari：Graph Traversals - BFS & DFS',url:'https://www.youtube.com/watch?v=pcKY4hjDrxk',dur:'18:30'},
             {icon:'🎬',text:'Abdul Bari：Merge Sort',url:'https://www.youtube.com/watch?v=mB5HXBb_HY8',dur:'20:23'},
             {icon:'🎬',text:'Abdul Bari：Quick Sort',url:'https://www.youtube.com/watch?v=7h1s2SojIRw',dur:'13:42'}]},
    4: {subj:'資料結構', ch:'Ch8 雜湊（Hashing、衝突處理）+ Ch9 高等樹結構（Heap、AVL樹、2-3樹、紅黑樹、B樹）',
        book:'資結七版（洪逸）Ch8–Ch9',
        vid:[{icon:'🎬',text:'What is a HashTable Data Structure',url:'https://www.youtube.com/watch?v=MfhjkfocRR0',dur:'7:37'},
             {icon:'🎬',text:'Abdul Bari：Heap',url:'https://www.youtube.com/watch?v=HqPJF2L5h9U',dur:'51:08'},
             {icon:'🎬',text:'MIT 6.006：AVL Trees, AVL Sort',url:'https://www.youtube.com/watch?v=FNeL18KsWPc',dur:'51:59'}]},
    5: {subj:'演算法', ch:'ALG Ch1 Analyzing Algorithms（Asymptotic notation、Recurrence relation、Amortized analysis）+ Ch2 Divide-and-Conquer（Maximum subarray、Matrix multiplication、Closest pair）',
        book:'演算法~1~ Ch1–Ch2',
        vid:[{icon:'🎬',text:'Abdul Bari：Merge Sort（分治法範例）',url:'https://www.youtube.com/watch?v=mB5HXBb_HY8',dur:'20:23'},
             {icon:'🎬',text:"Master's Theorem Explained",url:'https://www.youtube.com/watch?v=SLsHKh_OUEM',dur:'7:19'}]},
    6: {subj:'演算法', ch:'ALG Ch3 Dynamic Programming（Rod cutting、Knapsack、Matrix-chain、Optimal BST、LCS、KMP）——全科最重的一章',
        book:'演算法~1~ Ch3',
        vid:[{icon:'🎬',text:'MIT 6.006 L11：DP I',url:'https://www.youtube.com/watch?v=OQ5jsbhAv_M',dur:'51:47'},
             {icon:'🎬',text:'MIT 6.006 L12：DP II',url:'https://www.youtube.com/watch?v=ENyox7kNKeY',dur:'52:11'},
             {icon:'🎬',text:'MIT 6.006 L14：DP IV（Matrix Chain）',url:'https://www.youtube.com/watch?v=ocZMDMZwhCY',dur:'52:41'},
             {icon:'🎬',text:'Abdul Bari：Matrix Chain Multiplication',url:'https://www.youtube.com/watch?v=_WncuhSJZyA',dur:'52:01'}]},
    7: {subj:'演算法', ch:'ALG Ch4 Graph Algorithms（BFS、DFS、Shortest Paths、MST、Max Flow）+ Ch6 NP-completeness（研究確認清大常考）——Ch5計算幾何、Ch7其他問題較低頻，留到刷題期',
        book:'演算法~1~ Ch4、Ch6',
        vid:[{icon:'🎬',text:'Abdul Bari：BFS（Breadth First Search）',url:'https://www.youtube.com/watch?v=pcKY4hjDrxk',dur:'18:30'},
             {icon:'🎬',text:'WilliamFiset：DFS（Depth First Search）',url:'https://www.youtube.com/watch?v=7fujbpJ0LB4',dur:'10:20'},
             {icon:'🎬',text:'Tushar Roy：Topological Sort',url:'https://www.youtube.com/watch?v=ddTC4Zovtbc',dur:'10:31'},
             {icon:'🎬',text:'Tushar Roy：Strongly Connected Components',url:'https://www.youtube.com/watch?v=RpgcYiky7uw',dur:'24:29'},
             {icon:'🎬',text:'Theory of Computation：P, NP, NP-Complete and NP-Hard',url:'https://www.youtube.com/watch?v=tIE2lkJv20c',dur:'5:06'}]},
    8: {subj:'作業系統', ch:'OS Ch1 導論 + Ch2 Computer System Architecture（Dual Mode、特權指令）+ Ch3 系統作業結構（System Call、Layered/Microkernel）+ Ch4 處理程序（Process、CPU排程FCFS/SJF/RR/Priority）',
        book:'金寶典四版（洪逸）Ch1–Ch4 + Q講義Q1–Q2',
        vid:[{icon:'🎬',text:'清大OCW 周志遠《作業系統》第1A講',url:'https://www.youtube.com/watch?v=3PfL2WIS22o',dur:'15:57'},
             {icon:'🎬',text:'清大OCW 周志遠《作業系統》第1B講',url:'https://www.youtube.com/watch?v=QK63Mw9hPec',dur:'16:13'},
             {icon:'🎬',text:'清大OCW 周志遠《作業系統》第1C講',url:'https://www.youtube.com/watch?v=wzRwuRrUzNQ',dur:'24:14'},
             {icon:'🎬',text:'清大OCW 周志遠 第9A講 Ch3:Processes Concept',url:'https://www.youtube.com/watch?v=dDghjse91lE',dur:'35:59'},
             {icon:'🎬',text:'清大OCW 周志遠 第9B講 Ch3:Processes Concept',url:'https://www.youtube.com/watch?v=iFRv7y8i7Sw',dur:'11:01'}]},
    9: {subj:'作業系統', ch:'OS Ch5 死結 Dead Lock（必要條件、預防、Banker Algorithm）+ Ch6 處理程序的協調（Critical Section、Semaphore、Monitor）',
        book:'金寶典 Ch5–Ch6 + Q講義Q3–Q4',
        vid:[{icon:'🎬',text:'Gate Smashers：Banker Algorithm',url:'https://www.youtube.com/watch?v=7gMLNiEz3nw',dur:'24:04'},
             {icon:'🎬',text:'Process Synchronisation | Critical Section Problem',url:'https://www.youtube.com/watch?v=sEVfeXqWY-s',dur:'13:32'}]},
    10:{subj:'作業系統', ch:'OS Ch7 記憶管理（Paging、Segmentation）+ Ch8 虛擬記憶體（Page Replacement Algorithms）+ Ch9 輔助儲存體管理（磁碟排程SCAN/C-SCAN）+ Ch10 檔案系統——基礎期最後一週',
        book:'金寶典 Ch7–Ch10 + Q講義Q5–Q6',
        vid:[{icon:'🎬',text:'Page Replacement Algorithms（LRU and Optimal）',url:'https://www.youtube.com/watch?v=DXU7SqsYDvg',dur:'16:18'},
             {icon:'🎬',text:'SCAN Disk Scheduling Algorithm',url:'https://www.youtube.com/watch?v=lQAYseBJPuA',dur:'4:24'}]},
    11:{subj:'離散數學', ch:'DM Ch1 邏輯（命題與真值表、邏輯等價）+ Ch2 集合論（集合論、排容原理）',
        book:'離散上冊（林緯）Ch1–Ch2',
        vid:[{icon:'🎬',text:'交大OCW 易志偉《離散數學》Lec01 Logic and Proofs (1/5)',url:'https://www.youtube.com/watch?v=klWl-t7V5qY',dur:'1:21:01'},
             {icon:'🎬',text:'交大OCW 易志偉《離散數學》Lec02 Logic and Proofs (2/5)',url:'https://www.youtube.com/watch?v=ih43BS7GsNY',dur:'36:23'},
             {icon:'🎬',text:'The Principle of Inclusion-Exclusion',url:'https://www.youtube.com/watch?v=YlKDp03Kg68',dur:'17:35'}]},
    12:{subj:'離散數學', ch:'DM Ch3 函數（可數/不可數集、鴿籠原理）+ Ch4 數學歸納法與數論（數學歸納法、質數）',
        book:'離散上冊（林緯）Ch3–Ch4',
        vid:[{icon:'🎬',text:'TrevTutor：Pigeonhole Principle',url:'https://www.youtube.com/watch?v=2-mxYrCNX60',dur:'16:46'},
             {icon:'🎬',text:'Proof Using Mathematical Induction — Summation Formulae',url:'https://www.youtube.com/watch?v=ZJeBDVMbhJE',dur:'23:24'}]},
    13:{subj:'離散數學', ch:'DM Ch5 組合計數（排列組合、二項式係數）+ Ch6 生成函數（一般/指數生成函數）+ Ch7 遞迴關係式（求解法、轉換法）——研究確認這三章是「最容易拿分」的必考點',
        book:'離散上冊（林緯）Ch5–Ch7',
        vid:[{icon:'🎬',text:'Generating Functions | Part 1',url:'https://www.youtube.com/watch?v=tA2cqfNh5EM',dur:'31:07'},
             {icon:'🎬',text:'Solving Recurrences Using Substitution Method',url:'https://www.youtube.com/watch?v=dVPDdHE3RJU',dur:'13:12'}]},
    14:{subj:'離散數學', ch:'DM Ch8 圖論I（基本定義、路徑、連通、最短路徑）+ Ch9 圖論II（著色問題、平面圖、流量）+ Ch10 樹（生成樹、有根樹、最佳樹）',
        book:'離散下冊（林緯）Ch8–Ch10',
        vid:[{icon:'🎬',text:'交大OCW 易志偉《離散數學》Lec22 Graphs (1/3)',url:'https://www.youtube.com/watch?v=q0Vy0gQCB_g',dur:'1:23:28'},
             {icon:'🎬',text:'交大OCW 易志偉《離散數學》Lec23 Graphs (2/3)',url:'https://www.youtube.com/watch?v=y4sLC9zeEvU',dur:'40:14'},
             {icon:'🎬',text:'交大OCW 易志偉《離散數學》Lec24 Graphs (3/3)',url:'https://www.youtube.com/watch?v=P2FRYshQ57s',dur:'1:27:09'},
             {icon:'🎬',text:'Spanning Tree：Discrete Mathematics',url:'https://www.youtube.com/watch?v=6WZvVJ0Q1FA',dur:'43:05'}]},
    15:{subj:'離散數學', ch:'DM Ch11 二元關係及其應用（等價關係、偏序集、布林代數）+ Ch12 代數結構（群、環與體）+ Ch13 有限狀態機（清大每年必考）',
        book:'離散下冊（林緯）Ch11–Ch13',
        vid:[{icon:'🎬',text:'Equivalence Relation',url:'https://www.youtube.com/watch?v=RexPywlCmV8',dur:'6:29'},
             {icon:'🎬',text:'Neso Academy：Finite State Machine（Finite Automata）',url:'https://www.youtube.com/watch?v=Qa6csfkK7_I',dur:'11:05'}]},
    16:{subj:'線性代數', ch:'LA Ch1 矩陣（定義與運算）+ Ch2 線性方程組與求解（高斯消去、行列式）+ Ch3 向量空間 + Ch4 線性映射',
        book:'線代上冊（林緯）Ch1–Ch4',
        vid:[{icon:'🎬',text:'MIT 18.06 L1：Geometry of Linear Equations',url:'https://www.youtube.com/watch?v=ZK3O402wf1c',dur:'39:49'},
             {icon:'🎬',text:'MIT 18.06 L2：Elimination',url:'https://www.youtube.com/watch?v=QVKj3LADCnA',dur:'47:41'},
             {icon:'🎬',text:'MIT 18.06 L18：Determinants',url:'https://www.youtube.com/watch?v=srxexLishgY',dur:'49:12'},
             {icon:'🎬',text:'MIT 18.06 L9：Four Fundamental Subspaces',url:'https://www.youtube.com/watch?v=nHlE7EgJFds',dur:'49:20'}]},
    17:{subj:'線性代數', ch:'LA Ch5 對角化理論（特徵值/特徵向量、對角化、Cayley-Hamilton）+ Ch7 內積空間（Gram-Schmidt正交化）+ Ch8 各內積算子（SVD）——Ch6 Jordan Form基礎要知道，深入題型可選擇性放（曾有考生反映意外被考到，別完全跳過）',
        book:'線代下冊（林緯）Ch5、Ch7–Ch8',
        vid:[{icon:'🎬',text:'MIT 18.06 L21：Eigenvalues',url:'https://www.youtube.com/watch?v=cdZnhQjJu4I',dur:'51:22'},
             {icon:'🎬',text:'3Blue1Brown：Eigenvectors',url:'https://www.youtube.com/watch?v=PFDu9oVAE-g',dur:'17:15'},
             {icon:'🎬',text:'MIT 18.06 L29：SVD',url:'https://www.youtube.com/watch?v=TX_vooSnhm8',dur:'40:28'}]},
    18:{subj:'計算機組織', ch:'《數位邏輯講義》Ch1–Ch3（二進位系統、布林代數、組合邏輯，精簡讀過即可）+ CA Ch1 指令（MIPS、ISA）+ Ch2 計算機算術（IEEE 754浮點數）',
        book:'數位邏輯講義 Ch1–Ch3（精簡）+ 計組上冊（張凡）Ch1–Ch2',
        vid:[{icon:'🎬',text:'Neso Academy：Logic Gates（Part 2）',url:'https://www.youtube.com/watch?v=iogRGu7nbJw',dur:'14:14'},
             {icon:'🎬',text:'IEEE 754 Floating Point Representation（Single & Double Precision）',url:'https://www.youtube.com/watch?v=sKxdXfH5qko',dur:'12:42'}]},
    19:{subj:'計算機組織', ch:'CA Ch3 效能評估（Amdahl定律）+ Ch4 處理器資料路徑 + Ch5 管線（Pipeline Hazard，最重要）+ Ch6 記憶體階層與Cache（AMAT計算，最重要）——Ch7儲存裝置、Ch8多重處理器、Ch9基本概念較低頻，留到刷題期',
        book:'計組上冊（張凡）Ch3–Ch5 + 計組下冊 Ch6',
        vid:[{icon:'🎬',text:'Pipeline Hazards（Structural, Data and Control Hazards）',url:'https://www.youtube.com/watch?v=t27kbXWP5GY',dur:'15:37'},
             {icon:'🎬',text:'Average Memory Access Time（AMAT）— Computer Organization',url:'https://www.youtube.com/watch?v=Y1esjWBTf7Q',dur:'6:54'}]},
};
// Week-specific task text (matches FOUNDATION_CONTENT — same DM→DS→LA→
// ALG→CA→OS order, see the comment there for why). Shared by getChecklist()
// and buildFoundationTasks() so the two never drift out of sync.

// ── Task queue (foundation phase only) ───────────────────────────────
// Foundation has genuinely finite content (six subjects' chapters) — it's
// the one phase where "did I actually finish this" should matter more than
// "how many calendar days have passed". Drilling/convergence stay date-
// driven below: they're open-ended recurring practice, not a queue to drain.
function durationToMinutes(value){
  const parts = String(value || '').split(':').map(Number);
  if(parts.some(function(n){ return !Number.isFinite(n); })) return 0;
  const seconds = parts.length === 3 ? parts[0]*3600+parts[1]*60+parts[2]
    : parts.length === 2 ? parts[0]*60+parts[1] : 0;
  return Math.max(0, seconds/60);   // exact; summing per-video round-ups overstated hours
}
function foundationVideoMinutes(videos){
  const exact = (videos || []).reduce(function(sum, video){ return sum + durationToMinutes(video.dur); }, 0);
  return exact || 60;
}

// The week's chapters, in subject order, with every one of their videos.
function foundationWeekVideos(wk){
  const out = [];
  SUBJECTS.forEach(function(s){
    s.chapters.forEach(function(c){ if(c.wk === wk) out.push.apply(out, chapterDisplayMaterials(c)); });
  });
  return out;
}
function buildFoundationTasks(){
  const tasks = [];
  for(let wk=1; wk<=FOUNDATION_WEEKS; wk++){
    const c = FOUNDATION_CONTENT[wk];
    if(!c) continue;
    // One task per week: every video of every chapter scheduled that week,
    // watched in order. Its minutes are the real sum of those videos.
    const videos = foundationWeekVideos(wk);
    if(!videos.length) continue;
    tasks.push({id:'w'+wk+'-video', week:wk, subject:c.subj, type:'video', title:'本週影片（全部依序看完，共 '+videos.length+' 支）', url:videos[0].url, estMinutes:foundationVideoMinutes(videos)});
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


// The single next undone task in queue order — 六科 opens on its subject.
function nextFoundationTask(doneIds){
  const doneSet = new Set(doneIds || []);
  const queue = buildFoundationTasks();
  return queue.find((t) => !doneSet.has(t.id)) || null;
}

// Study hours per weekday, the same rhythm dayInfo() assumes (Sunday off,
// Monday ~0hr, everything else 6hr). dayPlan() fills each day with this.
const DAILY_CAPACITY_HOURS = { 0:0, 1:0, 2:6, 3:6, 4:6, 5:6, 6:6 };
let activeVoiceRecognition=null;
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
// Total length of a chapter's videos, e.g. "12.5hr".
function chapterVideoHours(videos){
  const minutes = videos.reduce(function(t,m){ return t + durationToMinutes(m.dur); },0);
  return Math.round(minutes/6)/10+'hr';
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

// Foundation: task queue, keyed by stable taskId.
// `el`, if passed, gets its own `.done` class toggled directly (used by
// callers like the 六科 material checkboxes that don't otherwise re-render).
async function toggleTask(taskId, el){
  let chapter = null, subject = null;
  if(el){
    const panel = el.closest('.sp');
    const row = el.closest('.ch-row');
    subject = SUBJECTS.find(function(s){ return panel && panel.id === 'sp-'+s.id; });
    const rowIndex = row ? Array.from(row.parentNode.children).indexOf(row) : -1;
    chapter = subject && subject.chapters[rowIndex];
  }
  const wasComplete = chapter ? chapterVideosDone(subject.id, chapter, new Set(DONE_TASK_IDS)) : false;
  await fetch('/api/tasks/' + encodeURIComponent(taskId) + '/toggle', { method:'POST' });
  await fetchDoneTasks();
  if(chapter && chapter.wk) await syncFoundationWeek(chapter.wk);
  // Toggling changes what's done, which affects the calendar's per-day tags.
  renderCalContainer();
  if(el){
    const isDone = DONE_TASK_IDS.indexOf(taskId) !== -1;
    el.classList.toggle('done', isDone);
    el.setAttribute('aria-checked', String(isDone));
    refreshVisibleSubjectProgress(el);
    if(isDone && chapter && !wasComplete && chapterVideosDone(subject.id, chapter, new Set(DONE_TASK_IDS))){
      const p = subjectVideoProgress(subject, new Set(DONE_TASK_IDS));
      celebrate(chapter.t+' 完成！', subject.name+' 已看 '+p.done+'/'+p.total+' 支', subject.color);
    }else showTaskToast(isDone ? '已看完，進度已同步到日曆' : '已取消完成');
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

// ── Calendar: 月曆 (subject/phase grid) + the selected day's video list. ──
let calMonthCursor = null; // Date, first-of-month currently shown
let pendingCalMotion = 'fade';

function renderCalContainer(){
  const container = document.getElementById('calContainer');
  if(!container) return;
  container.classList.remove('motion-prev','motion-next','motion-fade');
  void container.offsetWidth;
  container.classList.add('motion-'+pendingCalMotion);
  pendingCalMotion = 'fade';
  renderCalMonthView(container);
}

// Clicking a day in the month view shows that day's video list below it.
function goCalDay(iso){
  noteUiAction();
  calSelectedIso = iso;
  pendingCalMotion = 'none';
  renderCalContainer();
  writeRoute('/calendar/' + iso, true);
}

// ── Day-by-day video plan: starting today, the unwatched videos are laid
// out in queue order (week, subject, chapter, playlist order) and each study
// day takes as many minutes as DAILY_CAPACITY_HOURS allows; a video longer
// than what is left of a day continues on the next study day. So every
// calendar day can say exactly which videos it is for. ──
let calSelectedIso = null;
let dayPlanCache = null;
function foundationVideoQueue(){
  const done = new Set(DONE_TASK_IDS), out = [], seen = new Set();
  for(let wk=1; wk<=FOUNDATION_WEEKS; wk++){
    SUBJECTS.forEach(function(sub){
      sub.chapters.forEach(function(c, ci){
        if(c.wk !== wk) return;
        chapterDisplayMaterials(c).forEach(function(m, vi, all){
          if(done.has(chapterMaterialTaskId(sub.id, c, m))) return;
          // a video listed in two chapters is scheduled once (where it first appears)
          if(m.videoId){ if(seen.has(m.videoId)) return; seen.add(m.videoId); }
          // exact length (not rounded up per video), minus what was already
          // watched of it in the study room (it resumes from there)
          const p = String(m.dur || '').split(':').map(Number);
          const sec = p.some(isNaN) ? 0 : p.length === 3 ? p[0]*3600+p[1]*60+p[2] : p.length === 2 ? p[0]*60+p[1] : 0;
          let pos = 0;
          try{ pos = Number(localStorage.getItem('yt-pos-' + m.videoId)) || 0; }catch(e){}
          if(pos < 30 || pos >= sec - 30) pos = 0;
          out.push({subj:sub.name, subjId:sub.id, ci:ci, ch:c.t, vi:vi, vn:all.length, title:m.text,
            series:m.series || '', dur:m.dur, start:pos/60, min:Math.max(1, (sec - pos)/60), href:studyRoomUrl(sub.id, ci, m.videoId), wk:wk});
        });
      });
    });
  }
  return out;
}
function dayPlan(){
  const key = DONE_TASK_IDS.length + '|' + isoDate(new Date());
  if(dayPlanCache && dayPlanCache.key === key) return dayPlanCache.map;
  const map = new Map(), q = foundationVideoQueue();
  const cur = new Date(); cur.setHours(12,0,0,0);
  let i = 0, usedOfVideo = 0, guard = 0;
  while(i < q.length && guard++ < 800){
    let cap = (DAILY_CAPACITY_HOURS[cur.getDay()] || 0) * 60;
    const items = [];
    while(cap > 0 && i < q.length){
      const v = q[i], left = v.min - usedOfVideo;
      const take = Math.min(left, cap);
      items.push(Object.assign({}, v, {take:take, from:v.start + usedOfVideo, cont:v.start + usedOfVideo > 0, more:take < left}));
      cap -= take; usedOfVideo += take;
      if(usedOfVideo >= v.min){ i++; usedOfVideo = 0; }
    }
    if(items.length) map.set(isoDate(cur), items);
    cur.setDate(cur.getDate() + 1);
  }
  dayPlanCache = {key:key, map:map};
  return map;
}
// "資料結構 第1章 複雜度分析" for the first chapter a day's videos belong to
function dayPlanHeadline(items){
  const a = items[0];
  const chs = [];
  items.forEach(function(x){ const k = x.subj+'|'+x.ci; if(chs.indexOf(k) < 0) chs.push(k); });
  return {subj:a.subj, ch:'第'+(a.ci+1)+'章 '+a.ch, more:chs.length - 1};
}
function fmtMin(m){ m = Math.round(m); const h = Math.floor(m/60), r = m%60; return h ? h+' 小時'+(r ? ' '+r+' 分' : '') : r+' 分'; }
function renderCalDayDetail(iso){
  const p = iso.split('-');
  const d = new Date(Number(p[0]), Number(p[1])-1, Number(p[2]));
  const info = dayInfo(d);
  const dow7 = ['日','一','二','三','四','五','六'];
  const head = '<div class="calday-hd"><b>'+(d.getMonth()+1)+'/'+d.getDate()+'（'+dow7[d.getDay()]+'）</b>';
  const today0 = new Date(); today0.setHours(0,0,0,0);
  if(d < today0) return head+'<span>已經過去了</span></div>';
  if(info.isRest) return head+'<span>休息日：不排讀書</span></div>';
  if(info.isDayOff) return head+'<span>打工日：不排讀書</span></div>';
  const items = dayPlan().get(iso);
  if(!items){
    if(d > EXAM_DATE) return head+'<span>複試準備</span></div>';
    return head+'<span>'+(info.phase === 'converge' ? '收斂複習：速記清單、模擬考、錯題本' : '影片都看完了：這天做歷屆試題'+(info.drillSubj ? '（'+escapeHtml(info.drillSubj)+'）' : '')+'、對答案、整理錯題')+'</span></div>';
  }
  const total = items.reduce(function(a, x){ return a + x.take; }, 0);
  const h = dayPlanHeadline(items);
  return head+'<span>'+escapeHtml(h.subj)+'・'+escapeHtml(h.ch)+(h.more ? ' 等' : '')+'・共 '+items.length+' 支・約 '+fmtMin(total)+'</span></div>'
    +'<ol class="calday-list">'+items.map(function(x){
      const part = x.cont || x.more
        ? '<span class="calday-part">'+(x.cont ? '從 '+fmtMin(x.from)+' 處接著看' : '從頭看')+(x.more ? '到 '+fmtMin(x.from + x.take)+' 處，剩下的下一個讀書日接著看' : '到結束')+'</span>' : '';
      return '<li><a href="'+x.href+'"><span class="calday-ch" style="color:var('+(SUBJ_COLOR_VAR[x.subj] || '--ac2')+')">'+escapeHtml(x.subj)+' 第'+(x.ci+1)+'章・第 '+(x.vi+1)+'/'+x.vn+' 支</span>'
        +'<span class="calday-title">'+escapeHtml(x.title)+'</span>'
        +'<span class="calday-meta">'+(x.series ? escapeHtml(x.series)+'・' : '')+escapeHtml(x.dur || '')+'</span>'+part+'</a></li>';
    }).join('')+'</ol>';
}

// ── Month view: subject/phase per day; the day's list is in renderCalDayDetail. ──
function buildCalMonthCells(y, m, ctx){
  const startWeekday = (new Date(y, m, 1).getDay() + 6) % 7;   // weeks start on Monday
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
        else if(dayPlan().has(iso)){
          const items = dayPlan().get(iso), h = dayPlanHeadline(items);
          const mins = items.reduce(function(a, x){ return a + x.take; }, 0);
          colorVar = SUBJ_COLOR_VAR[h.subj] || '--ac2';
          tagHtml = '<div class="cal-tag" style="background:var('+colorVar+');color:#fff;">'+escapeHtml(h.subj)+'</div>'
            +'<div class="cal-what">'+escapeHtml(h.ch)+(h.more ? ' 等' : '')+'</div>'
            +'<div class="cal-howmuch">'+items.length+' 支・'+fmtMin(mins)+'</div>';
        }
        else if(info.phase === 'foundation' && d < today0){ label = null; }
        else if(info.phase === 'foundation'){ label = '歷屆試題'; colorVar = '--ac2'; } else if(info.phase === 'drilling'){
          label = info.drillSubj;
          colorVar = (label && SUBJ_COLOR_VAR[label]) ? SUBJ_COLOR_VAR[label] : '--ac2';
        } else {
          label = '收斂複習'; colorVar = '--ac2';
        }
        if(label && !tagHtml){
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
    if(iso === (calSelectedIso || todayIso)) classes.push('selected');
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
  const dowLabels = ['一','二','三','四','五','六','日'];
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
    +'<div class="calday" id="calDay">'+renderCalDayDetail(calSelectedIso || todayIso)+'</div>'
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
  if(id === 'schedule') writeRoute('/calendar' + (calSelectedIso ? '/' + calSelectedIso : ''));
  else if(id === 'subjects') writeRoute(subjectsRoute());
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
  await Promise.all([fetchSettings(), fetchDoneTasks()]);

  renderCalContainer();

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
      if(document.getElementById('sec-subjects').classList.contains('on')) writeRoute(subjectsRoute());
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
    // always open: a plain card, no toggle
    var videosHtml = '<div class="rec-books rec-series rec-fixed"><div class="rec-books-body">'
      + subjectPlaylists.map(function(series){
          return '<div class="rec-book-row rec-series-row"><div class="rec-book-body">'
            +'<a class="rec-book-name" href="'+series.url+'" target="_blank" rel="noopener">'+series.name+'</a>'
            +'<span class="rec-book-note">開啟完整 YouTube Playlist</span>'
            +'</div></div>';
        }).join('')
      + '</div></div>';

    // Chapters render as a numbered sequence (dot + connecting line), the
    // same visual language as the Today page's stepper — one signature
    // motif for "this is an ordered flow" instead of a new card pattern,
    // so a 12-chapter list reads as a path to scan down rather than a
    // stack of identical boxes that blur together.
    var chaptersHtml = s.chapters.map(function(c, idx){
      // A chapter is its videos: every one is required and checked off on its
      // own, listed in teaching order (teacher by teacher, playlist order).
      var displayMats = chapterDisplayMaterials(c);
      var chapterTaskIds = displayMats.map(function(m){ return chapterMaterialTaskId(s.id,c,m); });
      var chapterDoneCount = chapterTaskIds.filter(function(id){ return DONE_TASK_IDS.indexOf(id) !== -1; }).length;

      var matsHtml = displayMats.map(function(m, vi){
        var matTaskId = chapterMaterialTaskId(s.id,c,m);
        var matDone = DONE_TASK_IDS.indexOf(matTaskId) !== -1;
        var href = m.videoId ? studyRoomUrl(s.id, idx, m.videoId) : m.url;
        return '<div class="ch-mat ch-video'+(matDone?' done':'')+'" data-material-task="'+matTaskId+'" role="checkbox" tabindex="0" aria-checked="'+matDone+'" onclick="toggleTask(\''+matTaskId+'\', this)">'
          +'<div class="cb"></div>'
          +'<span class="video-series-order">'+String(vi+1).padStart(2,'0')+'</span>'
          +'<a class="mat-link video-series-label" href="'+href+'" onclick="event.stopPropagation();">'+m.text+'</a>'
          +(m.series?'<span class="ch-video-teacher">'+m.series+'</span>':'')
          +(videoPlaylistUrl(m.videoId)?'<a class="ch-video-pl" href="'+videoPlaylistUrl(m.videoId)+'" target="_blank" rel="noopener" onclick="event.stopPropagation();" title="在原本的 YouTube 播放清單中開啟">播放清單</a>':'')
          +(m.dur?'<span class="mat-dur">'+m.dur+'</span>':'')+'</div>';
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
        +'<span class="pri '+priClass+'">'+priLabel+'</span><span class="ch-hrs">'+chapterVideoHours(displayMats)+' · <b class="ch-progress-count">'+chapterDoneCount+'/'+chapterTaskIds.length+'</b></span></div></div>'
        +'<div class="ch-body"><div>'
        // key points and peer notes live inside the chapter (study room), next
        // to the video parts that teach them; the card stays a plain list
        +'<div class="ch-section">'+chapterStudyHtml(s.id,idx)+'</div>'
        +'<div class="ch-section"><div class="ch-mats">'+(matsHtml||'<div class="ch-video-empty">這章沒有指定影片</div>')+'</div></div>'
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
    var remainingHours = Math.round(s.chapters.reduce(function(sum,c){
      return sum + chapterDisplayMaterials(c).filter(function(m){ return DONE_TASK_IDS.indexOf(chapterMaterialTaskId(s.id,c,m)) === -1; })
        .reduce(function(t,m){ return t + durationToMinutes(m.dur); },0);
    },0)/6)/10;
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
        +'<div class="sm"><div class="sm-n" style="color:'+s.color+';">'+(subjTasks.length-subjDone)+'</div><div class="sm-l">還沒看的影片</div></div>'
        +'<div class="sm"><div class="sm-n" style="color:'+s.color+';">'+remainingHours+'hr</div><div class="sm-l">剩餘影片長度</div></div>'
        +'<div class="sm"><div class="sm-n" style="color:'+s.color+';">'+doneChapterCount+'/'+s.chapters.length+'</div><div class="sm-l">完成章節</div></div>'
      +'</div>'
      +'</div></div>'
      // the series list sits on its own row below; the progress card above is
      // small enough to share the header row with the title and subject tabs
      +'<div class="rec-row sp-rec-row">'+booksHtml+videosHtml+'</div>'
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
        writeRoute(subjectsRoute(), true);
      });
      head.addEventListener('keydown', function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); head.click(); } });
    });
    p.querySelectorAll('.ch-mat').forEach(function(task){
      task.addEventListener('keydown', function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); task.click(); } });
    });
    // the priority filter is no longer shown: always list every chapter
    // (each chapter still carries its 必考／高頻／補充 tag)
    try{ localStorage.removeItem('subjectFilter-'+s.id); }catch(err){}
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

  document.body.classList.add('ui-ready');
  // 六科 opens on the subject of the current task, not always the first tab.
  const cur = nextFoundationTask(DONE_TASK_IDS), curSub = cur && SUBJECTS.find(function(s){ return s.name === cur.subject; });
  const curTab = curSub && document.querySelector('.stab[data-id="'+curSub.id+'"]');
  if(curTab) curTab.click();
  // The URL decides what opens: /calendar[/YYYY-MM-DD], /subjects[/subj[/chapter]]
  applyRoute(true);
  window.addEventListener('popstate', function(){ applyRoute(false); });
}

init();

function escapeHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function globalSearchCatalog(){
  // chapters (open on 六科) and every lecture video (open in the study room)
  const items = [];
  SUBJECTS.forEach(function(s){
    s.chapters.forEach(function(c,idx){
      items.push({kind:'章節',subj:s,title:'第'+(idx+1)+'章 '+c.t,detail:c.sub || '',searchText:c.key||'',action:'chapter',subject:s.name,index:idx});
      chapterDisplayMaterials(c).forEach(function(m){
        if(!m.videoId) return;
        items.push({kind:'影片',subj:s,title:m.text,detail:'第'+(idx+1)+'章 '+c.t+(m.dur?'・'+m.dur:''),href:studyRoomUrl(s.id,idx,m.videoId)});
      });
    });
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
let globalSearchActive=0;
function renderGlobalSearch(query){
  const out = document.getElementById('globalSearchResults');
  const announcement = document.getElementById('globalSearchAnnouncement');
  if(!out) return;
  const q = String(query||'').trim().toLowerCase();
  globalSearchActive = 0;
  if(!q){ out.innerHTML='<div class="global-search-empty">輸入章節、考點或影片名稱，例如 AVL、Page Fault、Jordan</div>'; if(announcement)announcement.textContent=''; return; }
  const all = globalSearchCatalog().filter(function(x){ return (x.title+' '+x.detail+' '+(x.searchText||'')+' '+x.subj.name).toLowerCase().includes(q); });
  // chapters first, then videos; at most 30
  const matches = all.filter(function(x){return x.kind==='章節';}).concat(all.filter(function(x){return x.kind==='影片';})).slice(0,30);
  if(announcement) announcement.textContent = matches.length ? '找到 '+matches.length+' 筆結果' : '找不到符合的結果';
  out.innerHTML = renderSearchItems(matches);
  if(!matches.length) out.innerHTML = '<div class="global-search-empty">搜尋筆記與字幕內容…</div>';
  // then the full-text hits (notes + subtitles), fetched from the server
  clearTimeout(searchTimer);
  const asked = q;
  searchTimer = setTimeout(async function(){
    try{
      const r = await fetch('/api/search?q=' + encodeURIComponent(asked));
      const j = await r.json();
      if(asked !== String(document.getElementById('globalSearchInput').value||'').trim().toLowerCase()) return;
      const map = videoPlaceMap();
      const hits = (j.results||[]).map(function(h){
        const p = map[h.vid]; if(!p) return null;
        return {kind: h.src === 'note' ? '筆記' : '字幕', subj: p.subj, title: h.text, detail: p.label + '・' + fmtClock(h.t) + (h.sec && h.src === 'note' && h.sec !== h.text ? '・' + h.sec : ''),
          href: studyRoomUrl(p.subj.id, p.idx, h.vid) + '&at=' + h.t + '&t=full'};
      }).filter(Boolean);
      const all = matches.concat(hits).slice(0, 60);
      if(announcement) announcement.textContent = all.length ? '找到 '+all.length+' 筆結果' : '找不到符合的結果';
      out.innerHTML = all.length ? renderSearchItems(all) : '<div class="global-search-empty">找不到符合的章節、影片或內容</div>';
      globalSearchActive = 0;
    }catch(e){ if(!matches.length) out.innerHTML = '<div class="global-search-empty">找不到符合的章節或影片</div>'; }
  }, 220);
}
let searchTimer = null, videoPlaceCache = null;
function videoPlaceMap(){
  if(videoPlaceCache) return videoPlaceCache;
  const m = {};
  SUBJECTS.forEach(function(s){ s.chapters.forEach(function(c, idx){ chapterDisplayMaterials(c).forEach(function(v){ if(v.videoId && !m[v.videoId]) m[v.videoId] = {subj: s, idx: idx, label: v.text}; }); }); });
  return (videoPlaceCache = m);
}
function fmtClock(t){ t = Math.max(0, Math.floor(t)); const h = Math.floor(t/3600), m = Math.floor(t%3600/60), s = t%60; return (h ? h+':'+String(m).padStart(2,'0') : m)+':'+String(s).padStart(2,'0'); }
function renderSearchItems(matches){
  return matches.map(function(x,i){
    const open = x.href ? 'a href="'+x.href+'"' : 'button type="button" onclick="goSearchChapter(\''+x.subject+'\','+x.index+')"';
    const close = x.href ? 'a' : 'button';
    return '<'+open+' class="global-search-item'+(i===0?' active':'')+'" style="--gs-c:'+(x.subj.color||'var(--ac)')+'">'
      +'<b>'+escapeHtml(x.title)+'</b>'
      +'<small><span class="gs-subj">'+escapeHtml(x.subj.name)+'</span>'+x.kind+(x.detail?'・'+escapeHtml(x.detail):'')+'</small></'+close+'>';
  }).join('');
}
function moveGlobalSearch(delta){
  const items = Array.from(document.querySelectorAll('#globalSearchResults .global-search-item'));
  if(!items.length) return;
  globalSearchActive = (globalSearchActive + delta + items.length) % items.length;
  items.forEach(function(el,i){ el.classList.toggle('active', i===globalSearchActive); });
  items[globalSearchActive].scrollIntoView({block:'nearest'});
}
function goSearchChapter(subjectName,index){
  closeGlobalSearch();
  const s=SUBJECTS.find(function(x){return x.name===subjectName;});if(!s)return;
  goSec('subjects');const tab=document.querySelector('.stab[data-id="'+s.id+'"]');if(tab)tab.click();
  const row=document.querySelectorAll('#sp-'+s.id+' .ch-row')[index];if(row){row.classList.remove('collapsed');const h=row.querySelector('[data-chtoggle]');if(h)h.setAttribute('aria-expanded','true');row.scrollIntoView({block:'start'});}
  writeRoute(subjectsRoute(), true);
}
document.addEventListener('DOMContentLoaded', function(){
  const globalInput = document.getElementById('globalSearchInput');
  if(globalInput) globalInput.addEventListener('input',function(){renderGlobalSearch(this.value);});
  if(globalInput) globalInput.addEventListener('keydown',function(e){
    if(e.isComposing || e.keyCode === 229) return;
    if(e.key==='ArrowDown'){ e.preventDefault(); moveGlobalSearch(1); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); moveGlobalSearch(-1); }
    else if(e.key==='Enter'){ const a=document.querySelector('#globalSearchResults .global-search-item.active'); if(a){ e.preventDefault(); a.click(); } }
  });
  document.addEventListener('keydown',function(e){
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openGlobalSearch();}
    if(e.key==='Escape'){
      if(document.getElementById('globalSearchPanel')?.classList.contains('open'))closeGlobalSearch();
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
});


// ── Router ──
// Every view has its own address, so back/forward, refresh and bookmarks
// land on the same place:
//   /calendar                 the month calendar
//   /calendar/2026-10-15      …with that day's list open
//   /subjects/ds              六科, on 資料結構
//   /subjects/ds/3            …with chapter 3 open
// (old "#/subjects/…" and "#subjects" links are converted on load.)
let routing = false;
function writeRoute(path, replace){
  if(routing || location.pathname === path) return;
  if(replace) history.replaceState(null, '', path); else history.pushState(null, '', path);
}
function subjectsRoute(){
  const tab = document.querySelector('.stab.on'); if(!tab) return '/subjects';
  const rows = Array.from(document.querySelectorAll('#sp-' + tab.dataset.id + ' .ch-row'));
  const open = rows.findIndex(function(r){ return !r.classList.contains('collapsed'); });
  return '/subjects/' + tab.dataset.id + (open >= 0 ? '/' + (open + 1) : '');
}
function routeParts(){
  // an old hash link wins over the path it was opened on
  const h = location.hash.replace(/^#\/?/, '');
  const src = /^(calendar|subjects|schedule)/.test(h) ? h : location.pathname.replace(/^\//, '');
  return src.split('/').filter(Boolean);
}
function applyRoute(initial){
  const parts = routeParts();
  routing = true;
  try {
    if(parts[0] === 'subjects'){
      goSec('subjects');
      const subj = parts[1] && SUBJECTS.find(function(x){ return x.id === parts[1]; });
      if(subj){
        const tab = document.querySelector('.stab[data-id="' + subj.id + '"]'); if(tab) tab.click();
        const rows = document.querySelectorAll('#sp-' + subj.id + ' .ch-row');
        const n = parseInt(parts[2], 10);
        rows.forEach(function(r, i){
          const open = i === n - 1;
          r.classList.toggle('collapsed', !open);
          const head = r.querySelector('[data-chtoggle]'); if(head) head.setAttribute('aria-expanded', String(open));
        });
        if(n >= 1 && rows[n - 1]) setTimeout(function(){ rows[n - 1].scrollIntoView({behavior: initial ? 'auto' : 'smooth', block: 'start'}); }, 0);
        else window.scrollTo(0, 0);
      }
    } else {
      const day = /^\d{4}-\d{2}-\d{2}$/.test(parts[1] || '') ? parts[1] : null;
      if(day){
        calSelectedIso = day;
        const d = new Date(day + 'T12:00:00');
        if(typeof calMonthCursor !== 'undefined' && !isNaN(d)) calMonthCursor = new Date(d.getFullYear(), d.getMonth(), 1);
        pendingCalMotion = 'none';
        renderCalContainer();
      }
      goSec('schedule');
    }
  } finally { routing = false; }
  // normalise the address (e.g. "" or the old "#subjects") without a new history entry
  const want = document.getElementById('sec-subjects').classList.contains('on') ? subjectsRoute() : '/calendar' + (calSelectedIso && parts[1] ? '/' + calSelectedIso : '');
  if(location.pathname !== want || location.hash) history.replaceState(null, '', want);
}
