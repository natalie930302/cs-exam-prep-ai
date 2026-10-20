// 作業系統 第3章：Thread 與並行（thread vs process、multithreading models、user/kernel threads、
// Amdahl's law、shared-memory programming、POSIX pthread create/join/detach、Java thread、Linux clone）。
// 場景依清大周志遠《作業系統》第 16A 講的段落與例子；課本＝恐龍書（Silberschatz）Ch4。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
import kit from './_kit.js';

export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;

  // ───────────────────────── 共用小工具 ─────────────────────────
  let timer = null;
  const stopTimer = () => { clearInterval(timer); timer = null; };
  let modeGen = 0, busyG = -1;
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', RED = '#5a1010';
  const COL = { cpu: '#4b9ee2', io: '#dd8238', os: '#9b7ef4', user: '#2fc092', mem: '#c9b48e', idle: '#d8cfc0', bad: '#d64545', gold: '#c08a1f', disk: '#5c7a4a', paper: '#e9dcc4', code: '#4b9ee2', data: '#2fc092', files: '#dd8238', stack: '#9b7ef4', reg: '#e55a9b' };
  const TC = ['#4b9ee2', '#e55a9b', '#2fc092', '#c08a1f', '#9b7ef4', '#31aab0', '#dd8238', '#5c7a4a'];
  const MONO = { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '11px', fontWeight: '600' };
  async function W(tok, ms) {
    if (tok === undefined) { const g = modeGen; await sleep(ms); if (g !== modeGen) throw new Error('mode changed'); }
    else await beat(tok, ms);
  }
  async function run(fn) {
    if (busyG === modeGen) { log('動畫還在跑，等它跑完再按。', true); return; }
    const g = modeGen; busyG = g;
    try { await fn(); } catch (e) { if (!/changed/.test(e.message)) console.error(e); } finally { if (busyG === g) busyG = -1; }
  }
  function fresh(pos, look) { stopTimer(); modeGen++; lab.clear(); controls(''); lab.frameCamera(pos, look); }
  function tag(text, cls, x, y, z = 0) { const l = lab.label(text, cls || ''); l.position.set(x, y, z); lab.world.add(l); return l; }
  function cube(text, color, size, x, y, z = 0, dropH = 0) {
    const m = lab.box(color, size);
    if (text !== null && text !== undefined && text !== '') { m.userData.lbl = lab.label(String(text), 'val'); m.add(m.userData.lbl); }
    if (dropH > 0) { m.position.set(x, y + dropH, z); lab.dropTo(lab.addBody(m), V3(x, y, z)); }
    else { m.position.set(x, y, z); lab.world.add(m); }
    return m;
  }
  function bodyOf(o) { for (const b of lab.bodies) if (b.obj === o) return b; return lab.addBody(o); }
  const move = (o, x, y, z = 0) => lab.springTo(bodyOf(o), V3(x, y, z));
  const fly = (o, dir) => lab.flyAway(bodyOf(o), dir || V3((Math.random() - 0.5) * 6, 8, 4));
  function kill(o) {
    if (!o) return;
    for (const b of lab.bodies) if (b.obj === o) { lab.removeBody(b); return; }
    lab.world.remove(o); o.traverse((c) => { if (c.element) c.element.remove(); });
  }
  const glow = (m, c) => { m.material.emissive = new THREE.Color(c || '#000000'); };
  const tint = (m, c) => { m.material.color.set(c); };
  const txt = (l, t) => { l.element.textContent = t; };
  const relabel = (m, t) => { if (m.userData.lbl) txt(m.userData.lbl, String(t)); };
  function code(lines, x, yTop, dy = 0.5, z = 0) {
    const w = Math.max(...lines.map((s) => s.length));
    const ls = lines.map((s, i) => { const l = tag(s.padEnd(w, ' '), '', x, yTop - i * dy, z); Object.assign(l.element.style, MONO); return l; });
    return { ls, hl(i) { ls.forEach((l, k) => { l.element.className = 'lab-label' + (k === i ? ' ptr alt' : ''); }); } };
  }
  async function anim(tok, ms, fn) { const steps = 10; for (let k = 1; k <= steps; k++) { fn(k / steps); await W(tok, ms / steps); } }
  function line(x1, y1, z1, x2, y2, z2, color = '#c9b48e') {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(x1, y1, z1), V3(x2, y2, z2)]), new THREE.LineBasicMaterial({ color }));
    lab.world.add(l); return l;
  }
  function arrow(x1, y1, x2, y2, color = '#8a7a5c', z = 0) {
    const from = V3(x1, y1, z), dir = V3(x2 - x1, y2 - y1, 0); const len = dir.length();
    const a = new THREE.ArrowHelper(dir.normalize(), from, len, color, Math.min(0.35, len * 0.35), 0.22);
    lab.world.add(a); return a;
  }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  // ───────────────────────── 模式 1：Thread vs Process 的組成（課本 Fig. 4.1） ─────────────────────────
  const an = { threads: 0, procs: [], g: 10, objs: [] };
  function drawProcess(x0, nThreads, label, gVal) {
    const w = Math.max(3.2, nThreads * 1.25 + 0.4);
    const o = { x0, w, th: [] };
    o.shell = cube('', '#f3ead9', [w, 0.1, 3.4], x0, 0.05, 0);
    o.code = cube('code', COL.code, [w - 0.3, 0.45, 0.8], x0, 3.9, -0.6);
    o.data = cube('data：g = ' + gVal, COL.data, [w - 0.3, 0.45, 0.8], x0, 3.35, -0.6);
    o.files = cube('files', COL.files, [w - 0.3, 0.45, 0.8], x0, 2.8, -0.6);
    o.name = tag(label, 'ptr', x0, 4.6);
    for (let k = 0; k < nThreads; k++) addThreadCol(o, k, nThreads);
    return o;
  }
  function addThreadCol(o, k, n) {
    const x = o.x0 - (n - 1) * 0.62 + k * 1.25;
    const reg = cube('registers', COL.reg, [1.1, 0.4, 0.7], x, 1.95, 0.2), st = cube('stack', COL.stack, [1.1, 0.7, 0.7], x, 1.2, 0.2);
    const t = tag('T' + (k + 1) + ' 〰', 'ptr alt', x, 0.45, 0.6);
    o.th.push({ reg, st, t });
  }
  function enterAnatomy() {
    fresh([0, 4.5, 14], [0, 2.4, 0]);
    an.threads = 1; an.g = 10;
    an.P = drawProcess(-3, 1, 'process A', an.g); an.Q = null;
    controls('<button class="primary" id="aT">新增 thread</button><button id="aP">fork 一個 process</button><button id="aW">T1 寫入 g = g + 1</button><button id="aR">重來</button>');
    on('aT', () => anAddThread());
    on('aP', () => anFork());
    on('aW', () => run(() => anWrite()));
    on('aR', () => { clearLog(); enterAnatomy(); });
    log('上排（code、data、files）是 process 的；下排（registers、stack）每個 thread 各一份。');
    anState();
  }
  function rebuildP() {
    [an.P.shell, an.P.code, an.P.data, an.P.files, an.P.name].forEach(kill);
    an.P.th.forEach((t) => { kill(t.reg); kill(t.st); kill(t.t); });
    an.P = drawProcess(-3, an.threads, 'process A', an.g);
  }
  function anAddThread() {
    if (an.threads >= 4) { log('最多 4 個 thread（畫面放不下）。', true); return; }
    an.threads++; rebuildP();
    log('pthread_create：只多一組 registers + stack，code / data / files 共用 → 建立便宜（economy）。');
    anState();
  }
  function anFork() {
    if (an.Q) { log('已經 fork 過了；按「重來」。', true); return; }
    an.qg = an.g; an.Q = drawProcess(3.8, 1, 'process A\'（fork）', an.g);
    log('fork：整個 address space 複製一份（code、data、files、stack 都是自己的）→ 比 thread 重。');
    anState();
  }
  async function anWrite(tok) {
    an.g++;
    const d = cube('g+1', COL.gold, [0.8, 0.4, 0.5], an.P.th[0].reg.position.x, 2.4, 0.6); move(d, -3, 3.35, 0.2);
    await W(tok, 700); kill(d);
    relabel(an.P.data, 'data：g = ' + an.g); glow(an.P.data, GOLD);
    log('T1 把 g 改成 ' + an.g + '：同一個 process 的其他 thread 立刻看得到（共用 data）。');
    if (an.Q) log('fork 出來的 process A\' 看到的還是 ' + an.qg + '：address space 是分開的。', true);
    await W(tok, 600); glow(an.P.data, null);
    anState();
  }
  function anState() {
    setState('Thread vs Process', [['process A 的 thread 數', String(an.threads)], ['共用（per process）', 'code、data、files'], ['私有（per thread）', 'registers（含 PC）、stack'], ['A 的 g', String(an.g)], ['fork 出的 A\'', an.Q ? 'g = ' + an.qg : '—']],
      'thread = 輕量的執行單位：共用 address space<br>process 間要溝通得透過 OS（IPC）');
  }

  // ───────────────────────── 模式 2：Multithreading models ─────────────────────────
  const MODELS = {
    m1: { name: 'Many-to-One', note: '多個 user thread 對到 1 個 kernel thread：一個 block 全部 block，也無法用多核心', map: [0, 0, 0, 0], nk: 1 },
    o1: { name: 'One-to-One', note: '每個 user thread 一個 kernel thread：並行度高，但建立 kernel thread 有成本（Linux、Windows）', map: [0, 1, 2, 3], nk: 4 },
    mm: { name: 'Many-to-Many', note: '多個 user thread 多工到較少或相等的 kernel thread：兼顧並行與成本', map: [0, 1, 2, 0], nk: 3 },
    two: { name: 'Two-level', note: 'Many-to-Many，但允許某個 user thread 綁定一個 kernel thread', map: [0, 1, 0, 2], nk: 3, bound: 3 },
  };
  const md = { kind: 'm1', blocked: null };
  function enterModels() {
    fresh([0, 4.5, 14], [0, 2.6, 0]);
    md.blocked = null;
    controls('<select id="mKind">' + Object.keys(MODELS).map((k) => '<option value="' + k + '">' + MODELS[k].name + '</option>').join('') + '</select><button class="primary" id="mBlock">T1 呼叫 blocking system call</button><button id="mRun">排到 2 顆 CPU 上</button><button id="mClear">T1 的 I/O 完成</button>');
    $('mKind').value = md.kind;
    $('mKind').onchange = (e) => { md.kind = e.target.value; clearLog(); enterModels(); };
    on('mBlock', () => run(() => mdBlock()));
    on('mRun', () => run(() => mdRun()));
    on('mClear', () => mdUnblock());
    md.d = drawModel(md.kind);
    log(MODELS[md.kind].note);
    mdState();
  }
  function drawModel(kind) {
    const M = MODELS[kind], d = { u: [], k: [], lines: [] };
    tag('user space', 'idx', -6, 5.2); tag('kernel space', 'idx', -6, 2.5);
    line(-6.5, 3.8, -0.5, 6.5, 3.8, -0.5, '#8a7a5c');
    for (let i = 0; i < 4; i++) d.u.push(cube('T' + (i + 1), TC[i], [0.9, 0.6, 0.6], -3.3 + i * 2.2, 5.2, 0));
    const kx = (j) => M.nk === 1 ? 0 : -3.3 + j * (6.6 / (M.nk - 1));
    for (let j = 0; j < M.nk; j++) d.k.push(cube('K' + (j + 1), COL.os, [0.9, 0.6, 0.6], kx(j), 2.4, 0));
    M.map.forEach((j, i) => d.lines.push(line(-3.3 + i * 2.2, 4.88, 0, kx(j), 2.72, 0, M.bound === i ? '#d64545' : '#8a7a5c')));
    if (M.bound !== undefined) tag('bound', 'idx', -3.3 + M.bound * 2.2 + 0.6, 4.1);
    d.cpu = [cube('CPU 0', COL.cpu, [1.6, 0.6, 1], -1.6, 0.3, 0), cube('CPU 1', COL.cpu, [1.6, 0.6, 1], 1.6, 0.3, 0)];
    return d;
  }
  function mdState() {
    const M = MODELS[md.kind];
    const blockedK = md.blocked === null ? null : M.map[md.blocked];
    const stuck = md.blocked === null ? [] : M.map.map((j, i) => (j === blockedK && (md.kind !== 'mm' && md.kind !== 'two' || i === md.blocked) ? i : -1)).filter((i) => i >= 0);
    setState(M.name, [['kernel threads', String(M.nk)], ['可同時跑在多核心', M.nk > 1 ? '可以' : '不行（kernel 只看到 1 個）'], ['T1 block 時被卡住', md.blocked === null ? '—' : stuck.map((i) => 'T' + (i + 1)).join(' ')]], M.note);
    return stuck;
  }
  async function mdBlock(tok) {
    if (md.blocked !== null) { log('T1 已經在等 I/O 了。', true); return; }
    md.blocked = 0;
    const M = MODELS[md.kind], kj = M.map[0];
    glow(md.d.u[0], RED); glow(md.d.k[kj], RED);
    await W(tok, 500);
    if (md.kind === 'm1') { md.d.u.forEach((u) => glow(u, RED)); log('Many-to-One：唯一的 kernel thread 被 block，整個 process 的 thread 全停。', true); }
    else if (md.kind === 'o1') log('One-to-One：只有 K1 被 block，T2～T4 還有自己的 kernel thread 可以跑。');
    else log(M.name + '：K' + (kj + 1) + ' 被 block，thread library 把其他 user thread 排到別的 kernel thread 上繼續跑。');
    mdState();
  }
  function mdUnblock() {
    if (md.blocked === null) { log('現在沒有 thread 在等 I/O。', true); return; }
    md.blocked = null; md.d.u.forEach((u) => glow(u, null)); md.d.k.forEach((k) => glow(k, null));
    log('I/O 完成，T1 回到 ready。'); mdState();
  }
  async function mdRun(tok) {
    const M = MODELS[md.kind];
    const free = md.d.k.map((k, j) => j).filter((j) => md.blocked === null || j !== M.map[md.blocked]);
    const use = free.slice(0, 2);
    if (!use.length) { log('所有 kernel thread 都被 block，沒有東西可以排到 CPU。', true); return; }
    const toks = use.map((j, c) => { const t = cube('K' + (j + 1), COL.os, [0.9, 0.6, 0.6], md.d.k[j].position.x, 2.4, 0.8); move(t, md.d.cpu[c].position.x, 1, 0.8); return t; });
    await W(tok, 1200);
    log(use.length === 2 ? '兩個 kernel thread 同時跑在兩顆 CPU：真正的 parallelism。' : '只有 1 個 kernel thread 可用 → 只能用一顆 CPU。', use.length < 2);
    await W(tok, 900); toks.forEach(kill);
  }

  // ───────────────────────── 模式 3：pthread create / join / detach ─────────────────────────
  const pt = { th: [], next: 0 };
  function enterPthread() {
    fresh([0, 4.8, 14], [0, 2.4, 0]);
    pt.th = []; pt.next = 0;
    pt.main = cube('main thread', COL.user, [2.4, 0.8, 1], -4.6, 0.4, 0);
    tag('global：int sum（所有 thread 共用）', 'idx', -4.6, 1.4);
    controls('<button class="primary" id="pC">pthread_create</button><select id="pSel"></select><button id="pJ">pthread_join</button><button id="pD">pthread_detach</button><button id="pR">重來</button>');
    on('pC', () => run(() => ptCreate()));
    on('pJ', () => run(() => ptJoin()));
    on('pD', () => ptDetach());
    on('pR', () => { clearLog(); enterPthread(); });
    $('pSel').onchange = () => ptState();
    log('pthread_create(&tid, attr, func, arg)：每個 thread 執行一個 function；arg 只有一個 void*。');
    ptState();
  }
  function ptSel() { const el = $('pSel'); const v = el ? Number(el.value) : NaN; return pt.th.find((t) => t.id === v) || pt.th.find((t) => !t.gone); }
  function ptOpts() { const el = $('pSel'); if (!el) return; el.innerHTML = pt.th.filter((t) => !t.gone).map((t) => '<option value="' + t.id + '">tid ' + t.id + '（' + t.st + '）</option>').join(''); }
  async function ptCreate(tok) {
    if (pt.th.filter((t) => !t.gone).length >= 5) { log('畫面最多 5 個 thread；先 join 或 detach 一些。', true); return; }
    const id = pt.next++;
    const x = -1.6 + (id % 5) * 1.8;
    const m = cube('tid ' + id, TC[id % 8], [1.4, 0.7, 0.9], -4.6, 0.4, 0);
    move(m, x, 2.6, 0);
    const t = { id, m, st: '執行中', gone: false, ret: (id + 1) * 10 };
    pt.th.push(t); ptOpts();
    log('create tid ' + id + '：arg = (void*)' + id + '，thread 裡要 cast 回正確型別。');
    ptState();
    await W(tok, 1400);
    t.st = '已結束（等 join）'; tint(m, COL.idle); relabel(m, 'tid ' + id + ' 結束');
    log('tid ' + id + ' 的 function return → thread 結束；回傳值 ' + t.ret + '（透過 pointer）留著等 join。');
    ptOpts(); ptState();
  }
  async function ptJoin(tok) {
    const t = ptSel();
    if (!t) { log('還沒有 thread 可以 join。', true); return; }
    if (t.st === '已 detach') { log('tid ' + t.id + ' 已經 detach：detach 之後永遠不能 join。', true); return; }
    if (t.gone) { log('tid ' + t.id + ' 已經 join 過了，不能 join 兩次。', true); return; }
    if (t.st === '執行中') log('tid ' + t.id + ' 還在跑：main thread 會在 join 這裡等它結束。');
    while (t.st === '執行中') await W(tok, 200);
    move(t.m, -4.6, 1.4, 0);
    await W(tok, 900);
    kill(t.m); t.gone = true; t.st = 'joined';
    log('join tid ' + t.id + '：拿到回傳值 ' + t.ret + '，thread 的資源釋放。');
    ptOpts(); ptState();
  }
  function ptDetach() {
    const t = ptSel();
    if (!t) { log('還沒有 thread 可以 detach。', true); return; }
    if (t.gone) { log('tid ' + t.id + ' 已經 join 了。', true); return; }
    if (t.st === '已 detach') { log('已經 detach 過了。', true); return; }
    const done = t.st !== '執行中';
    t.st = '已 detach'; tint(t.m, '#efe6d6');
    log('detach tid ' + t.id + '：告訴 library 結束就直接 free，不會 hang 著等 join；回傳值拿不到了。');
    if (done) { fly(t.m); t.gone = true; }
    ptOpts(); ptState();
  }
  function ptState() {
    const live = pt.th.filter((t) => !t.gone);
    setState('pthread', [['存在的 thread', live.map((t) => t.id).join(', ') || '—'], ['等 join 的', live.filter((t) => t.st.startsWith('已結束')).map((t) => t.id).join(', ') || '—'], ['已 detach', pt.th.filter((t) => t.st === '已 detach').map((t) => t.id).join(', ') || '—']],
      '結束但沒人 join、也沒 detach → 資源一直 hang 著<br>好習慣：create 之後一定 join 或 detach 其中之一');
  }

  // ───────────────────────── 模式 4：Amdahl's law ─────────────────────────
  const am = { S: 0.25, N: 4 };
  const speed = (S, N) => 1 / (S + (1 - S) / N);
  function enterAmdahl() {
    fresh([0, 4.5, 14], [0, 2.8, 0]);
    controls('<label>serial 比例 S = <input id="aS" type="range" min="0" max="0.9" step="0.05" value="' + am.S + '" style="width:140px"></label> <b id="aSv"></b>'
      + '<label>核心數 N = <input id="aN" type="range" min="1" max="64" value="' + am.N + '" style="width:140px"></label> <b id="aNv"></b>');
    $('aS').oninput = (e) => { am.S = Number(e.target.value); amUpdate(); };
    $('aN').oninput = (e) => { am.N = Number(e.target.value); amUpdate(); };
    am.bars = [];
    const Ns = [1, 2, 4, 8, 16, 64];
    Ns.forEach((n, i) => { const b = cube('', COL.cpu, [1, 1, 1], -5 + i * 1.9, 0.5, 0); tag(n + ' 核', 'idx', -5 + i * 1.9, -0.2, 0.8); const l = tag('', 'idx', -5 + i * 1.9, 1.5); am.bars.push({ n, b, l }); });
    am.cap = line(-6, 1, -0.6, 6, 1, -0.6, '#d64545'); am.capL = tag('', 'ptr', 5.8, 1.4, -0.6);
    am.timeS = cube('serial', COL.bad, [1, 0.5, 0.8], 0, 5.6, 0); am.timeP = cube('parallel', COL.user, [1, 0.5, 0.8], 0, 5.6, 0);
    tag('執行時間（上）／speedup（下）', 'idx', -5.6, 6.2);
    log('Amdahl\'s law：speedup ≤ 1 / (S + (1 − S) / N)。N → ∞ 時上限是 1 / S。');
    amUpdate();
  }
  function amUpdate() {
    if ($('aSv')) { $('aSv').textContent = am.S.toFixed(2); $('aNv').textContent = am.N; }
    const H = Math.min(0.5, 4.5 / Math.max(...am.bars.map(({ n }) => speed(am.S, n))));
    am.bars.forEach(({ n, b, l }) => { const s = speed(am.S, n); const h = s * H; b.scale.y = h; b.position.y = h / 2; txt(l, '×' + s.toFixed(2)); l.position.y = h + 0.4; glow(b, n === am.N ? GOLD : null); });
    const lim = am.S > 0 ? 1 / am.S : Infinity;
    am.cap.position.y = (isFinite(lim) ? Math.min(lim * H, 5) : 5) - 1; am.capL.position.x = -5.2; am.capL.position.y = am.cap.position.y + 1.35; txt(am.capL, isFinite(lim) ? '上限 ×' + lim.toFixed(2) : '無上限（S = 0）');
    // time bar: total length 6 at N = 1
    const L = 6, ls = am.S * L, lp = (1 - am.S) * L / am.N;
    am.timeS.scale.x = Math.max(0.01, ls); am.timeS.position.x = -3 + ls / 2;
    am.timeP.scale.x = Math.max(0.01, lp); am.timeP.position.x = -3 + ls + lp / 2;
    // short bar: keep the bar's own name beside it instead of on top of its neighbour
    am.timeS.userData.lbl.position.x = ls < 1.2 ? -(ls / 2 + 0.5) / Math.max(0.01, ls) : 0;
    am.timeP.userData.lbl.position.x = lp < 1.4 ? (lp / 2 + 0.75) / Math.max(0.01, lp) : 0;
    const s = speed(am.S, am.N);
    setState('Amdahl\'s law', [['S（serial）', am.S.toFixed(2)], ['N（cores）', String(am.N)], ['speedup', '×' + s.toFixed(2)], ['N → ∞ 上限', isFinite(lim) ? '×' + lim.toFixed(2) : '∞']],
      'speedup = 1 / (' + am.S.toFixed(2) + ' + ' + (1 - am.S).toFixed(2) + ' / ' + am.N + ') = <span class="ok">' + s.toFixed(2) + '</span><br>serial 部分不會因為加核心而變短');
    return s;
  }

  // ───────────────────────── 模式 5：Linux clone() flags ─────────────────────────
  const FLAGS = [['CLONE_VM', 'memory space', COL.data], ['CLONE_FS', 'file-system info', COL.files], ['CLONE_FILES', 'open files', '#c08a1f'], ['CLONE_SIGHAND', 'signal handlers', COL.reg]];
  const cl = { on: [true, true, true, true] };
  function enterClone() {
    fresh([0, 5, 14], [0, 2.4, 0]);
    controls(FLAGS.map(([f], i) => '<label><input type="checkbox" id="cf' + i + '"' + (cl.on[i] ? ' checked' : '') + '> ' + f + '</label>').join(' ') + '<button class="primary" id="cGo">clone()</button><button id="cFork">fork()（全部不 share）</button>');
    FLAGS.forEach((f, i) => { const el = $('cf' + i); if (el) el.onchange = (e) => { cl.on[i] = !!e.target.checked; }; });
    on('cGo', () => run(() => clDo(cl.on)));
    on('cFork', () => run(() => clDo([false, false, false, false])));
    tag('parent', 'ptr', -4, 5.4); tag('child', 'ptr alt', 4, 5.4);
    cl.parent = FLAGS.map(([, n, c], i) => cube(n, c, [2.6, 0.6, 1], -4, 4.4 - i * 0.9, 0));
    cl.child = [];
    log('Linux kernel 沒有另外的 thread 結構：thread 就是 clone() 出來、共用部分資源的 process（task）。');
    setState('clone()', FLAGS.map(([f, n], i) => [f, cl.on[i] ? 'share ' + n : '複製一份']), '勾越多 → 越像 thread；全部不勾 → 跟 fork 一樣');
  }
  async function clDo(flags, tok) {
    cl.child.forEach(kill); cl.child = [];
    for (let i = 0; i < FLAGS.length; i++) {
      const [, n, c] = FLAGS[i], y = 4.4 - i * 0.9;
      if (flags[i]) { const l = line(-2.7, y, 0, 2.7, y, 0, '#c08a1f'); cl.child.push(l); const t = tag('share', 'idx', 0, y + 0.25); cl.child.push(t); glow(cl.parent[i], GOLD); }
      else { const m = cube(n + '（copy）', c, [2.6, 0.6, 1], -4, y, 0); move(m, 4, y, 0); cl.child.push(m); glow(cl.parent[i], null); }
      await W(tok, 450);
    }
    const all = flags.every(Boolean), none = flags.every((f) => !f);
    log(all ? 'clone(CLONE_VM | CLONE_FS | CLONE_FILES | CLONE_SIGHAND)：全部共用 → 等同建立一個 thread。' : none ? '什麼都不 share：child 有自己一份 → 等同 fork()。' : '部分共用：介於 process 與 thread 之間，Linux 叫它 task。');
    setState('clone()', FLAGS.map(([f, n], i) => [f, flags[i] ? 'share ' + n : '複製一份']), all ? '<span class="ok">thread 行為</span>' : none ? '<span class="no">fork 行為</span>' : '部分共用');
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  let qs = { score: 0, total: 0 };
  function genQ() {
    const r = Math.random();
    if (r < 0.18) {
      const it = pick([['code section', true], ['global 變數（data section）', true], ['open files', true], ['heap 上 malloc 的資料', true], ['stack', false], ['program counter', false], ['registers', false]]);
      return { q: '同一個 process 的多個 thread 之間，「' + it[0] + '」是共用的還是各自一份？', opts: ['共用', '每個 thread 各一份'], ans: it[1] ? '共用' : '每個 thread 各一份', why: 'thread 共用 code、data、heap、files；各自擁有 thread ID、PC、register set、stack。' };
    }
    if (r < 0.36) {
      const S = pick([0.1, 0.2, 0.25, 0.4, 0.5]), N = pick([2, 4, 8, 16]);
      const s = speed(S, N), ans = s.toFixed(2);
      const opts = [ans, String(N), (1 / S).toFixed(2), (N * (1 - S)).toFixed(2)].filter((v, i, a) => a.indexOf(v) === i);
      return { q: '程式有 ' + Math.round(S * 100) + '% 必須 serial 執行，用 ' + N + ' 核心，依 Amdahl\'s law 最大 speedup 約多少？', opts, ans, why: '1 / (' + S + ' + ' + (1 - S).toFixed(2) + ' / ' + N + ') = ' + ans + '；核心再多也不會超過 1/S = ' + (1 / S).toFixed(2) + '。' };
    }
    if (r < 0.52) {
      const q = pick([['一個 thread 呼叫 blocking system call 會讓整個 process 都停住的是？', 'Many-to-One'], ['Linux 與 Windows 採用的是？', 'One-to-One'], ['多個 user thread 多工到較少或相等數量的 kernel thread 是？', 'Many-to-Many'], ['無法讓同一個 process 的 thread 在多核心上平行執行的是？', 'Many-to-One']]);
      return { q: q[0], opts: ['Many-to-One', 'One-to-One', 'Many-to-Many', 'Two-level'], ans: q[1], why: 'Many-to-One：kernel 只看到一個執行單位；One-to-One：並行最好但 kernel thread 有成本；Many-to-Many：折衷。' };
    }
    if (r < 0.64) {
      const q = pick([['pthread_create 的第一個參數用來？', '取得新 thread 的 ID（pthread_t 的位址）'], ['pthread_create 的第三個參數是？', 'thread 要執行的 function pointer'], ['function 需要多個參數時該怎麼傳？', '包成 struct，傳它的 pointer（void*）'], ['要取得 thread 的回傳值要呼叫？', 'pthread_join']]);
      return { q: q[0], opts: ['取得新 thread 的 ID（pthread_t 的位址）', 'thread 要執行的 function pointer', '包成 struct，傳它的 pointer（void*）', 'pthread_join'], ans: q[1], why: 'pthread_create(&tid, attr, func, arg)：只有一個 void* 參數，多個值要包成 struct；回傳值要 join 才拿得到。' };
    }
    if (r < 0.74) {
      return { q: '建立 thread 之後既不 join 也不 detach，會怎樣？', opts: ['thread 結束後資源一直 hang 著，等不知會不會來的 join', 'thread 不會開始執行', 'process 立刻結束', 'OS 自動 join'], ans: 'thread 結束後資源一直 hang 著，等不知會不會來的 join', why: '不打算 join 就要 detach，結束時才會立刻 free。detach 後就不能再 join。' };
    }
    if (r < 0.84) {
      const n = pick(['CLONE_VM', 'CLONE_FILES', 'CLONE_FS', 'CLONE_SIGHAND']);
      const d = { CLONE_VM: 'memory space', CLONE_FILES: 'open files', CLONE_FS: 'file-system information', CLONE_SIGHAND: 'signal handlers' }[n];
      return { q: 'Linux clone() 加上 ' + n + ' 代表 parent 和 child 共用什麼？', opts: ['memory space', 'open files', 'file-system information', 'signal handlers'], ans: d, why: 'clone 的 flag 決定哪些資源共用；全部共用就是 thread，全部不共用就像 fork。' };
    }
    if (r < 0.92) {
      return { q: 'pthread 的 p 代表什麼？', opts: ['POSIX（Portable Operating System Interface）', 'process', 'parallel', 'pointer'], ans: 'POSIX（Portable Operating System Interface）', why: 'POSIX 是 API 標準：照它寫，Linux、Mac 上 recompile 就能跑，不用改程式。' };
    }
    return { q: '單核心上跑多個 thread 時，下列何者正確？', opts: ['有 concurrency（交錯執行），沒有 parallelism', '有 parallelism', '一次只能有一個 thread 存在', 'thread 不能被 context switch'], ans: '有 concurrency（交錯執行），沒有 parallelism', why: 'parallelism 需要多核心同時執行；單核心只能輪流（concurrency）。' };
  }
  function renderQuiz(el) {
    const p = genQ();
    const opts = [...p.opts].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
    el.innerHTML = '<h2>小測驗</h2><div class="lab-quiz-score">答對 ' + qs.score + ' / ' + qs.total + '</div>'
      + '<div class="lab-quiz-q" style="white-space:pre-wrap">' + p.q + '</div><div class="lab-quiz-opts">'
      + opts.map((o) => '<button data-o="' + encodeURIComponent(o) + '">' + o + '</button>').join('') + '</div><div id="qx"></div>';
    el.querySelectorAll('.lab-quiz-opts button').forEach((btn) => {
      btn.onclick = () => {
        if (el.querySelector('.right')) return;
        const pk = decodeURIComponent(btn.dataset.o);
        qs.total++; if (pk === p.ans) qs.score++;
        el.querySelectorAll('.lab-quiz-opts button').forEach((b) => {
          const o = decodeURIComponent(b.dataset.o);
          if (o === p.ans) b.classList.add('right'); else if (b === btn) b.classList.add('wrong');
        });
        $('qx').innerHTML = '<div class="lab-quiz-explain">' + (pk === p.ans ? '答對了。' : '答錯了。') + p.why + '</div><button class="lab-next" id="qNext">下一題</button>';
        $('qNext').onclick = () => renderQuiz(el);
      };
    });
  }

  // ═════════════════════════ 跟著影片的場景 ═════════════════════════
  // ─── 8x6-r-maTZA（第 16A 講）：shared-memory programming、POSIX、pthread、Java thread、Linux clone ───
  async function scShmWays(tok) {
    fresh([0, 5, 14], [0, 2.4, 0]);
    const shared = cube('shared memory', COL.gold, [3, 0.7, 1.2], 0, 0.35, 0);
    say('Shared memory：大家隨時能寫同一塊 memory', '要處理 synchronization，花的時間可能比省下的還多');
    const ws = [0, 1, 2].map((k) => cube('W' + (k + 1), TC[k], [0.8, 0.6, 0.6], -2 + k * 2, 2.2, 0));
    for (let k = 0; k < 3; k++) { move(ws[k], -0.8 + k * 0.8, 0.95, 0); await W(tok, 500); }
    glow(shared, RED); await W(tok, 1600); glow(shared, null);
    ws.forEach(kill);
    say('通常還是比較快：不用 memory copy', '寫 shared-memory 程式有三種方式');
    await W(tok, 2400);
    const W3 = [['① pthread', '同一 process 的 thread，global 預設共用', COL.cpu], ['② process + OS', 'run time 建 segment，告訴 OS 要 share（較重）', COL.os], ['③ compiler directive', '標記 for loop，compiler 幫你轉成 threads', COL.user]];
    for (let i = 0; i < 3; i++) {
      cube(W3[i][0], W3[i][2], [3.4, 0.7, 1], -4 + i * 4, 4.6, 0, 2);
      tag(W3[i][1], 'idx', -4 + i * 4, 3.8 - (i % 2) * 0.4);
      say(W3[i][0], W3[i][1]);
      await W(tok, 2400);
    }
    say('③ 例：for loop 每個 iteration 一個 thread', '最省 programmer 的力氣，但只適用有規律的 pattern');
    for (let k = 0; k < 6; k++) { cube('i=' + k, TC[k % 8], [0.8, 0.45, 0.6], 2.4 + (k % 3) * 0.9, 1.8 + Math.floor(k / 3) * 0.55, 0.8, 2); await W(tok, 250); }
    await W(tok, 2400);
    say('本課重點：thread（pthread）', '補充：③ 即 OpenMP 之類的 #pragma');
    await W(tok, 2400);
  }
  async function scPosix(tok) {
    fresh([0, 5, 14], [0, 2.4, 0]);
    const app = cube('你的程式碼', COL.user, [3, 0.7, 1], 0, 5.2, 0);
    const api = cube('POSIX API（相同 interface）', COL.gold, [9, 0.7, 1.2], 0, 3.9, 0);
    const oss = [['Linux', -3.2], ['Mac', 0], ['UNIX', 3.2]].map(([n, x]) => cube(n, COL.os, [3, 0.9, 1], x, 2.3, 0));
    tag('各自有自己的 kernel、system call', 'idx', 0, 1.5);
    say('Portability：換平台只要 recompile，不用改 code', '');
    await W(tok, 2400);
    say('作法：OS 上面一層 API layer', '下面怎麼用 system call 實作，各 OS 自己決定');
    glow(api, GOLD); await W(tok, 2600); glow(api, null);
    say('POSIX = Portable Operating System Interface', 'UNIX、Linux 等 open-source 社群訂的 API 標準');
    await W(tok, 2800);
    const win = cube('Windows：Win32 API', COL.bad, [3, 0.9, 1], 0, 0.5, 0, 2);
    say('Windows 有自己的 API', '程式搬到 Windows 可能要整個重寫');
    await W(tok, 2600);
    say('pthread 的 p 就是 POSIX', 'C library 也屬於 POSIX；pthread = POSIX 的 thread API');
    await W(tok, 3000);
    void app; void oss; void win;
  }
  async function scCreateArgs(tok) {
    fresh([0, 5, 14], [0, 2.6, 0]);
    const cd = code(['int pthread_create(', '    pthread_t *tid,              // ① 回傳 thread ID', '    const pthread_attr_t *attr,  // ② 屬性', '    void *(*func)(void *),       // ③ 要執行的 function', '    void *arg);                  // ④ 只有一個參數'], -3.2, 5.6, 0.55);
    say('pthread：create、terminate、溝通', 'thread 就是去執行一個 function');
    await W(tok, 2600);
    cd.hl(1); const tidB = cube('tid', COL.cpu, [1, 0.5, 0.6], 4.6, 4.2, 0);
    say('① tid：拿到這個 thread 的 token', '之後 join 等動作用它指定是哪個 thread');
    await W(tok, 2600);
    cd.hl(2);
    const cores = [0, 1].map((k) => cube('core ' + k, COL.cpu, [1.4, 0.6, 1], 3.6 + k * 1.8, 0.3, 0));
    const t = cube('T', COL.gold, [0.6, 0.5, 0.5], 4.6, 1.4, 0.8); move(t, 3.6, 1.0, 0.8);
    say('② attr：細部控制，例如把 thread 綁在某個 core', '不同 core 的 L1 cache 不 share → 提高 hit rate');
    await W(tok, 2800);
    cd.hl(3);
    say('③ func：這個 thread 要執行的 function', 'local variable 私有、global variable 共用');
    await W(tok, 2600);
    cd.hl(4);
    const s = cube('struct { a, b, c }', COL.user, [2.4, 0.6, 0.8], 4.6, 3.0, 0);
    say('④ 為了 API 簡潔，只給一個 void* 參數', '多個參數：包成 struct，傳它的 pointer');
    await W(tok, 2600);
    say('進 function 後要自己 cast 回正確型別', '搞錯就讀出亂碼，programmer 自己負責');
    glow(s, GOLD); await W(tok, 2400);
    say('回傳也是 pointer，要 join 才拿得到', '沒有 delete thread：function return 就結束');
    await W(tok, 2800);
    void tidB; void cores;
  }
  async function scHelloJoin(tok) {
    fresh([0, 5.5, 14], [0, 2.6, 0]);
    const cd = code(['pthread_t threads[N];', 'for (t = 0; t < N; t++)', '  pthread_create(&threads[t], NULL,', '                 PrintHello, (void *)t);', 'for (t = 0; t < N; t++)', '  pthread_join(threads[t], NULL);'], -3.4, 5.8, 0.5);
    const main = cube('main thread', COL.user, [2.2, 0.7, 1], -4.4, 0.4, 0);
    say('範例：每個 thread 印 hello world', 'thread ID 存在 array，數量沒有限制');
    await W(tok, 2400);
    const ts = [];
    cd.hl(2);
    for (let t = 0; t < 4; t++) {
      const m = cube('T' + t, TC[t], [0.9, 0.6, 0.7], -4.4, 0.4, 0); move(m, -0.6 + t * 1.6, 2.2, 0);
      ts.push(m); say('create T' + t + '：arg = (void *)' + t, '傳進去前轉成 void*，function 裡再 cast 回來'); await W(tok, 900);
    }
    cd.hl(-1);
    for (let t = 0; t < 4; t++) { tag('Hello from ' + t, 'idx', -0.6 + t * 1.6, 1.55 - (t % 2) * 0.4); }
    say('同一個 function，不同的 thread ID', '執行順序不一定');
    await W(tok, 2600);
    cd.hl(5);
    for (let t = 0; t < 4; t++) { move(ts[t], -4.4, 1.2 + t * 0.15, 0); say('join T' + t + '：把結果讀回 main thread', ''); await W(tok, 700); kill(ts[t]); }
    cd.hl(-1);
    say('fork–join model：main 執行非平行部分', '需要平行就 create，做完 join 回來再繼續');
    await W(tok, 3000);
    void main;
  }
  async function scDetach(tok) {
    fresh([0, 5, 14], [0, 2.4, 0]);
    const main = cube('main thread', COL.user, [2.2, 0.7, 1], -4.4, 0.4, 0);
    const a = cube('T0（不 join）', TC[0], [2, 0.7, 1], 0, 2.4, 0), b = cube('T1（detach）', TC[1], [2, 0.7, 1], 4, 2.4, 0);
    say('不想讀回結果，就不會 call join', '那結束的 thread 怎麼辦？');
    await W(tok, 2400);
    tint(a, COL.idle); relabel(a, 'T0 結束了…');
    say('library 不知道你未來會不會 join', '結束的 thread 資源一直 hang 著，沒被釋放');
    for (let k = 0; k < 3; k++) { glow(a, k % 2 ? null : RED); await W(tok, 600); }
    await W(tok, 1200);
    say('好習慣：不 join 就立刻 pthread_detach', '結束時 OS 馬上把它的 memory 清乾淨');
    await W(tok, 1400);
    tint(b, COL.idle); relabel(b, 'T1 結束'); await W(tok, 600); fly(b);
    await W(tok, 1600);
    say('detach 之後永遠不能 join', '除了 global variable，main 和 worker 不再有關聯');
    await W(tok, 2800);
    say('pthread 主要就是 create、join（detach）', 'lock / unlock 等同步函式留到同步章');
    await W(tok, 2600);
    void main;
  }
  async function scJava(tok) {
    fresh([0, 5.5, 14], [0, 2.6, 0]);
    const jt = cube('Java Thread（class / Runnable）', COL.io, [5, 0.7, 1], 0, 5.4, 0);
    const jvmW = cube('JVM for Windows', COL.gold, [3.2, 0.7, 1], -3, 4.0, 0), jvmL = cube('JVM for Linux（POSIX）', COL.gold, [3.2, 0.7, 1], 3, 4.0, 0);
    const lw = cube('Win32 thread', COL.os, [3, 0.7, 1], -3, 2.6, 0), ll = cube('pthread', COL.os, [3, 0.7, 1], 3, 2.6, 0);
    const kw = cube('Windows kernel', COL.cpu, [3, 0.7, 1], -3, 1.2, 0), kl = cube('Linux kernel', COL.cpu, [3, 0.7, 1], 3, 1.2, 0);
    say('Java 本來就有 Thread class', '');
    await W(tok, 1800);
    const t1 = cube('t', TC[2], [0.6, 0.45, 0.5], 0, 5.4, 0.8), t2 = cube('t', TC[2], [0.6, 0.45, 0.5], 0, 5.4, 0.8);
    say('中間隔一層 virtual machine：JVM', '裝哪個平台的 JVM 就對到哪個平台');
    move(t1, -5.0, 4.0, 0.8); move(t2, 5.0, 4.0, 0.8); await W(tok, 1600);
    move(t1, -5.0, 2.6, 0.8); move(t2, 5.0, 2.6, 0.8);
    say('Windows → Win32 thread；UNIX → pthread', '同一份 Java 程式兩邊都能跑');
    await W(tok, 2600);
    move(t1, -5.0, 1.2, 0.8); move(t2, 5.0, 1.2, 0.8);
    say('pthread 不能跑在 Windows，Java 可以', 'portability 比其他語言好');
    await W(tok, 2600);
    say('對到哪種 model 依 OS 而定', 'one-to-one 或 many-to-many；' + 'JVM 控制（pthread 由 programmer 用 attr 控制）');
    await W(tok, 3000);
    void jt; void jvmW; void jvmL; void lw; void ll; void kw; void kl;
  }
  async function scClone(tok) {
    enterClone(); controls('');
    say('Linux kernel 其實不 support thread', '對 OS 來說每個 thread 都是 process');
    await W(tok, 2600);
    say('fork：兩個人的 memory 完全不相通', '要 copy');
    await clDo([false, false, false, false], tok); await W(tok, 2200);
    say('thread = 部分 memory 共用的 process', 'Linux 另外提供 clone() system call');
    await W(tok, 2600);
    say('clone 用 flag 決定哪些 share、哪些不 share', 'file system、memory space、signal…');
    await clDo([true, true, true, true], tok); await W(tok, 2400);
    say('全部 share → 就是 thread 的行為', 'kernel 不用另外寫 code 管理 thread');
    await W(tok, 3000);
  }

  // ─── 課本補充（第 15A/15B/16B 講與多執行緒模型影片尚未轉錄）───
  async function scThreadVsProc(tok) {
    enterAnatomy(); controls('');
    say('課本 Fig. 4.1：single-threaded process', 'code、data、files ＋ 一組 registers、stack');
    await W(tok, 2800);
    for (let k = 0; k < 2; k++) { anAddThread(); say('多一個 thread：只多一組 registers + stack', 'code、data、files 共用'); await W(tok, 1800); }
    await anWrite(tok); say('T1 改 global g，其他 thread 立刻看到', '溝通不用經過 OS'); await W(tok, 2200);
    anFork(); say('對照：fork 出一個 process', '所有東西都各一份'); await W(tok, 2000);
    await anWrite(tok); say('A 改了 g，A\' 看不到', 'process 間要用 IPC'); await W(tok, 3000);
  }
  async function scBenefits(tok) {
    fresh([0, 5.5, 14], [0, 2.4, 0]);
    // 課本 Fig. 4.2：Multithreaded server architecture
    const cli = [0, 1, 2].map((k) => cube('client ' + (k + 1), TC[k], [1.6, 0.6, 0.8], -5, 4.6 - k * 1.2, 0));
    const srv = cube('server', COL.os, [2, 1, 1.2], -0.6, 2.4, 0);
    tag('① request　② create thread 服務它　③ 繼續聽下一個', 'idx', 0, 5.6);
    say('課本：多執行緒 web server', '');
    await W(tok, 2000);
    for (let k = 0; k < 3; k++) {
      const r = cube('req', COL.gold, [0.7, 0.4, 0.5], -5, 4.6 - k * 1.2, 0.8); move(r, -0.6, 2.9, 0.8); await W(tok, 700); kill(r);
      cube('thread ' + (k + 1), TC[k], [1.6, 0.6, 0.8], 3.6, 4.4 - k * 1.1, 0, 2);
      say('來一個 request 就 create 一個 thread 處理', 'server 立刻回去 listen'); await W(tok, 900);
    }
    const B = [['Responsiveness', '一部分 block，其他照樣回應'], ['Resource sharing', '預設共用 memory 與資源'], ['Economy', '建立、切換都比 process 便宜'], ['Scalability', '可以平行跑在多核心上']];
    for (const [n, d] of B) { say('好處：' + n, d); await W(tok, 2000); }
    await W(tok, 1200);
    void cli; void srv;
  }
  async function scConcPar(tok) {
    fresh([0, 5, 14.5], [0, 2.4, 0]);
    // 課本 Fig. 4.3 / 4.4
    const u = 0.75, x0 = -4.6;
    tag('single core', 'ptr', x0 - 1.4, 4.2); tag('core 0', 'ptr', x0 - 1.4, 2.0); tag('core 1', 'ptr', x0 - 1.4, 1.1);
    say('4 個 thread：T1～T4', '');
    await W(tok, 1600);
    const seqA = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3];
    for (let i = 0; i < seqA.length; i++) { const m = cube('T' + (seqA[i] + 1), TC[seqA[i]], [u * 0.95, 0.5, 0.6], x0 + (i + 0.5) * u, 4.2, 0); void m; await W(tok, 200); }
    say('單核心：輪流交錯 → concurrency', '不是同時執行');
    await W(tok, 2200);
    const seqB = [[0, 2], [1, 3], [0, 2], [1, 3], [0, 2], [1, 3]];
    for (let i = 0; i < seqB.length; i++) { for (const [c, t] of [[0, seqB[i][0]], [1, seqB[i][1]]]) cube('T' + (t + 1), TC[t], [u * 0.95, 0.5, 0.6], x0 + (i + 0.5) * u, c ? 1.1 : 2.0, 0); await W(tok, 250); }
    say('雙核心：同時執行 → parallelism', '同樣的工作，時間減半');
    await W(tok, 2600);
    say('有 parallelism 一定有 concurrency', '反之不一定');
    await W(tok, 2400);
  }
  async function scModels(tok) {
    for (const k of ['m1', 'o1', 'mm', 'two']) {
      md.kind = k; enterModels(); controls('');
      say(MODELS[k].name, MODELS[k].note.split('：')[0]);
      await W(tok, 2000);
      await mdBlock(tok);
      say('T1 呼叫 blocking system call', k === 'm1' ? '唯一的 kernel thread 卡住 → 全部停' : '其他 thread 還能跑');
      await W(tok, 1800);
      await mdRun(tok);
      say(k === 'm1' ? '也無法同時用兩顆 CPU' : '可以同時跑在兩顆 CPU', MODELS[k].note.split('：')[1] || '');
      await W(tok, 1800);
    }
  }
  async function scUserKernel(tok) {
    fresh([0, 5, 14], [0, 2.4, 0]);
    line(-6.5, 3.4, -0.5, 6.5, 3.4, -0.5, '#8a7a5c'); tag('user space', 'idx', -6, 4.8); tag('kernel', 'idx', -6, 2.2);
    const lib = cube('thread library（user level）', COL.gold, [4.4, 0.6, 1], -3, 4.0, 0);
    const kts = cube('kernel 排程的單位', COL.os, [4.4, 0.6, 1], 3, 1.6, 0);
    const us = [0, 1, 2].map((k) => cube('U' + (k + 1), TC[k], [0.8, 0.5, 0.6], -4.2 + k * 1.2, 5.0, 0));
    say('User thread：由 thread library 管理', 'user-level library；kernel 不知道它們存在');
    await W(tok, 2600);
    say('建立、切換不用進 kernel：很快', '但 kernel 只看到一個 process');
    const k1 = cube('K', COL.os, [0.8, 0.5, 0.6], -3, 2.2, 0, 2);
    us.forEach((u) => line(u.position.x, 4.75, 0, -3, 2.45, 0, '#8a7a5c'));
    await W(tok, 2600);
    say('Kernel thread：由 OS 直接管理、排程', 'Windows、Linux、Mac OS X 都支援');
    const ks = [0, 1, 2].map((k) => cube('K' + (k + 1), COL.os, [0.8, 0.5, 0.6], 1.8 + k * 1.2, 2.4, 0, 2));
    await W(tok, 2600);
    say('兩者之間的對應關係 = multithreading model', 'many-to-one、one-to-one、many-to-many');
    await W(tok, 2800);
    void lib; void kts; void k1; void ks;
  }
  async function scAmdahl(tok) {
    am.S = 0.25; am.N = 1; enterAmdahl(); controls('');
    say('課本：Amdahl\'s law', 'speedup ≤ 1 / (S + (1 − S) / N)');
    await W(tok, 2600);
    say('例：75% 可平行、25% 必須 serial', 'S = 0.25');
    await W(tok, 2200);
    for (const n of [2, 4, 8, 16, 64]) {
      am.N = n; const s = amUpdate();
      say('N = ' + n + '：speedup ≈ ' + s.toFixed(2), n === 2 ? '例子：2 核 1.6' : n === 4 ? '例子：4 核約 2.28' : '');
      await W(tok, 1600);
    }
    say('N → ∞：上限 1 / S = 4', 'serial 部分決定加核心的效益');
    await W(tok, 3000);
  }

  const scenes = {
    'shm-three-ways': { title: 'Shared-memory programming 的三種方式', play: scShmWays },
    'posix-api': { title: 'POSIX API 與 portability', play: scPosix },
    'pthread-create-args': { title: 'pthread_create 的四個參數', play: scCreateArgs },
    'pthread-hello-join': { title: 'Hello world：for 迴圈 create，再 join', play: scHelloJoin },
    'pthread-detach': { title: '不 join 就要 detach', play: scDetach },
    'java-thread-jvm': { title: 'Java thread 經由 JVM 對到 Win32 / pthread', play: scJava },
    'linux-clone': { title: 'Linux：thread 就是 clone() 出來的 process', play: scClone },
    'thread-vs-process': { title: '課本：Thread 共用什麼、私有什麼', play: scThreadVsProc },
    'thread-benefits': { title: '課本：多執行緒 server 與四個好處', play: scBenefits },
    'concurrency-parallelism': { title: '課本：Concurrency vs Parallelism', play: scConcPar },
    'user-kernel-threads': { title: '課本：User thread vs Kernel thread', play: scUserKernel },
    'mt-models': { title: '課本：Many-to-One / One-to-One / Many-to-Many', play: scModels },
    'amdahl': { title: '課本：Amdahl\'s law', play: scAmdahl },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ thr.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { GOLD, GREEN, RED } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 作業系統 第 3 章 Thread（清大周志遠 15A、15B、16A、16B 講＋ Multithreading Models 影片）— cued scenes ───
// Every `await step(tok)` waits until the lecturer says that sentence (notes "cues"; the "@秒數" comment is the cue);
// between steps only short moves (≤ ~2.5 s); nothing loops or replays.
// 例子照老師的講法（browser、web server、青蛙過河、fork vs pthread_create 20～50 倍、sort 10 個 element 給 5 個 thread、
// hello world、clone 的 flag、sleep 10 秒、pool 20 / 100 個…）；老師沒給的數字一律標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const idx = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const bx = (t, c, x, y, z = 0, w = 2.4, h = 0.6, d = 0.9, drop = 0) => cube(t, c, [w, h, d], x, y, z, drop);
const ln = (x1, y1, x2, y2, z = 0, c = '#a99470') => P.line(x1, y1, x2, y2, z, c);
const arr = (x1, y1, x2, y2, c = '#8a7a5c', z = 0) => arrow(V3(x1, y1, z), V3(x2, y2, z), c);
async function slide(tok, o, x, y, z = 0, ms = 700) { const a = o.position.clone(); await travel(tok, o, a, V3(x, y, z), ms); }
const pal = (name, v, color, x, y = 0, z = 0, s = 0.7) => buddy(name, v, color, x, y, z, s);
const gone = (...os) => os.forEach((o) => { if (!o) return; if (o.g) kill(o.g); else if (o.ls) o.kill(); else if (o.userData && o.userData.name) remove(o); else kill(o); });
// move a zone's name label (kit puts it on the back edge, where it lands behind the buddies' name tags)
const zname = (zn, x, y, z, left = true) => { const l = zn.userData.name; l.position.set(x, y, z); l.center.set(left ? 0 : 0.5, 0.5); };
// a label flying from a to b (a message, a request, a byte), removed on arrival unless keep
async function fly(tok, kind, text, a, b, ms = 800, keep = false) { const l = tag(text, kind, a.x, a.y, a.z); await travel(tok, l, a, b, ms); if (!keep) remove(l); return l; }
const TH = ['#4b9ee2', '#e55a9b', '#2fc092', '#c08a1f', '#31aab0', '#dd8238', '#5c7a4a', '#9b7ef4'];
const CO = { code: '#4b9ee2', data: '#2fc092', files: '#dd8238', heap: '#7fc6a4', stack: '#9b7ef4', reg: '#e55a9b', kern: '#8f7be8', proc: '#f3d9a8', os: '#7d6bd6', bad: '#d64545', idle: '#d8cfc0', gold: '#c08a1f', cpu: '#5d8fc2' };
// user threads on a shelf (top) and kernel threads on the floor; one line per user thread shows its binding
function mapRig(nu, nk, map, o = {}) {
  const ux = (i) => (i - (nu - 1) / 2) * (o.du || 1.7), kx = (j) => (j - (nk - 1) / 2) * (o.dk || 1.9);
  const yU = o.yU || 3.3;
  const shelf = bx('', '#eadcc3', 0, yU - 0.08, 0, Math.max(nu * 1.7, 4) + 0.6, 0.12, 1.2);
  const sep = ln(-6, yU - 0.55, 6, yU - 0.55, 0, '#8a7a5c');
  const l1 = idx('user space', -5.3, yU + 0.5), l2 = idx('kernel space', -5.3, yU - 1.0);
  const U = [], Kk = [], L = [];
  for (let i = 0; i < nu; i++) U.push(pal(o.un ? o.un[i] : 'U' + (i + 1), '', TH[i % 8], ux(i), yU, 0, 0.55));
  for (let j = 0; j < nk; j++) Kk.push(pal('K' + (j + 1), '', CO.kern, kx(j), 0, 0, 0.6));
  const link = (i, j, c) => ln(ux(i), yU, kx(j), 0.62, 0.05, c || '#8a7a5c');
  map.forEach((j, i) => { L[i] = j === null ? null : link(i, j); });
  return {
    U, K: Kk, L, ux, kx, yU, parts: [shelf, sep, l1, l2],
    remap(i, j, c) { if (L[i]) kill(L[i]); L[i] = j === null ? null : link(i, j, c); },
    clear() { [...U, ...Kk].forEach((b) => kill(b.g)); L.forEach((l) => l && kill(l)); [shelf, sep, l1, l2].forEach(kill); },
  };
}
// a process drawn like the textbook's Fig. 4.1: shared code / data / files on top, one column per thread below
function fig41(x, n, name, w0) {
  const w = w0 || Math.max(3.6, n * 1.45 + 0.7);
  const z = zone(name, x, 0.02, 0, w, 3.4, '#f3e6c8');
  // name beside the code / data / files row (outer side), not on the back edge behind the T labels
  z.userData.name.position.set(x < 0 ? x - w / 2 - 0.15 : x + w / 2 + 0.15, 4.3, -0.6); z.userData.name.center.set(x < 0 ? 1 : 0, 0.5);
  const sw = (w - 0.5) / 3;
  const sh = [['code', CO.code], ['data', CO.data], ['files', CO.files]].map(([t, c], i) => bx(t, c, x - w / 2 + 0.25 + sw * (i + 0.5), 4.3, -0.6, sw - 0.08, 0.55, 0.8));
  const cols = [];
  const addCol = (k, nn) => {
    const cx = x + (k - (nn - 1) / 2) * 1.45;
    const reg = bx('registers', CO.reg, cx, 3.2, -0.2, 1.3, 0.42, 0.6);
    const st = bx('stack', CO.stack, cx, 2.55, -0.2, 1.3, 0.62, 0.6);
    const t = pal('T' + (k + 1), '', TH[k % 8], cx, 0.15, 0.6, 0.55);
    cols.push({ reg, st, t, cx });
  };
  for (let k = 0; k < n; k++) addCol(k, n);
  return { z, sh, cols, w, x, kill() { remove(z); sh.forEach(kill); cols.forEach((c) => { kill(c.reg); kill(c.st); kill(c.t.g); }); } };
}
// a simple bar timeline segment (for core usage)
function seg(t, c, x, y, w, z = 0) { return bx(t, c, x + w / 2, y, z, Math.max(0.05, w - 0.04), 0.42, 0.6); }

// ════════ iEipIUjbQxk（第 15A 講 Thread Introduction） ════════
FRAG.push(['thr-15a-map', '本章地圖：thread、user / kernel、library、issues', async (tok) => {
  fresh([0, 5, 14], [0, 2.2, 0]);
  await step(tok);                                   // @111.7 先 formal define 什麼是 thread
  const t = pal('thread', '', TH[0], -3.2, 2.8, 0, 0.8); t.mood('happy');
  hd('第一件事：什麼是 thread？', -3.2, 5.0);
  cap('先正式定義：什麼是一個 thread');
  await step(tok);                                   // @119.9 跟 process 差在哪（找工作必問）
  const p = pal('process', '', CO.proc, 3.2, 2.8, 0, 0.9);
  const q = hot('差在哪？', 0, 3.6);
  note('找工作必問：答不出來就不會被考慮', 0, 1.9);
  cap('thread 跟 process 差在哪', '基本中的基本（101）');
  await step(tok);                                   // @138.7 thread 分 user level / kernel level
  gone(t, p, q);
  ln(-6, 2.6, 6, 2.6, 0, '#8a7a5c');
  idx('user level', -5.2, 3.1); idx('kernel level', -5.2, 2.1);
  cap('thread 其實分兩層', 'user level 跟 kernel level');
  await step(tok);                                   // @157.3 什麼是 user thread、kernel thread
  const us = [0, 1, 2].map((i) => pal('user', '', TH[i], -1.8 + i * 1.8, 3.0, 0, 0.55));
  const ks = [0, 1].map((i) => pal('kernel', '', CO.kern, -0.9 + i * 1.8, 0, 0, 0.6));
  cap('都叫 thread，但是不同層的東西', 'user thread 與 kernel thread');
  await step(tok);                                   // @160.4 兩者在電腦運作時怎麼 manage
  const ls = us.map((u, i) => ln(-1.8 + i * 1.8, 3.0, -0.9 + (i % 2) * 1.8, 0.6, 0.05));
  hot('兩者的關係？', 3.8, 1.4);
  cap('兩者在執行時是什麼關係', 'OS 怎麼 manage 它們');
  await step(tok);                                   // @167.0 thread library：call 哪些 API 去 create thread
  const c = code(['pthread_create(...)', 'pthread_join(...)'], 3.6, 5.4, 0.5);
  cap('thread library', '有哪些 API 可以 create、使用 thread');
  await step(tok);                                   // @178.5 最後：thread 會產生的 issue
  c.hl(-1); note('最後：使用 thread 要特別留意的 issue', -3.4, 5.4);
  cap('最後：thread 使用上的一些 issue', '畢竟它不是 process');
  void ks; void ls;
}]);

FRAG.push(['thr-15a-what', '什麼是 thread：lightweight process', async (tok) => {
  fresh([0, 5, 14], [0, 2.2, 0]);
  await step(tok);                                   // @188.2 所以什麼是 thread
  hd('什麼是 thread？', 0, 5.3);
  cap('所以什麼是 thread？');
  await step(tok);                                   // @192.9 又叫 lightweight process
  const p = pal('process', '', CO.proc, -3.2, 0, 0, 1.1);
  const t = pal('thread', '', TH[0], 3.2, 0, 0, 0.7); t.mood('happy');
  const lw = hot('lightweight process（輕量的 process）', 3.2, 2.0);
  cap('thread 又叫 lightweight process', '');
  await step(tok);                                   // @198.4 界線其實蠻模糊
  const fz = note('界線蠻模糊：不是完全不同的東西', 0, 3.6);
  cap('thread 跟 process 的界線其實很模糊', '只是比較「輕」而已');
  await step(tok);                                   // @208.0 把 process 的一些東西拿掉，或跟其他 thread 共用
  remove(fz);
  const parts = ['code', 'data', 'files', 'stack'].map((n, i) => bx(n, [CO.code, CO.data, CO.files, CO.stack][i], -3.2, 1.6 + i * 0.6, 0.2, 1.6, 0.5, 0.6));
  for (let i = 0; i < 3; i++) { await slide(tok, parts[i], -0.6, 1.6 + i * 0.6, 0.2, 350); }
  const rm = idx('拿掉／共用', -0.6, 3.6);
  cap('把完整 process 的一些東西拿掉', '或跟其他 thread 共用 → thread');
  await step(tok);                                   // @231.0 process 有點像容器而已
  p.mood('calm'); bub('process 比較像「容器」', -3.2, 4.2);
  cap('所有電腦系統裡', 'process 有點像裝 thread 的容器');
  await step(tok);                                   // @238.7 thread 才是真的在使用 CPU core 的基本單位
  gone(...parts, lw, rm); kill(t.g);
  const core = prop('cpu', 3.4, 0, 0, 1.3); idx('CPU core', 3.4, -0.2, 1.2);
  cap('真正在使用 CPU core 計算的', '是 thread');
  await step(tok);                                   // @246.8 process 可以 breakdown 成很多 thread
  const ts = [0, 1, 2].map((i) => pal('T' + (i + 1), '', TH[i], -4.4 + i * 1.1, 2.4, 0, 0.45));
  cap('process 可以拆成很多 thread', '');
  await step(tok);                                   // @250.5 真正執行在 core 上的是 thread
  await slide(tok, ts[1].g, 3.4, 0.45, 0, 800); ts[1].mood('happy');
  cap('執行在 core 上的是 thread', '是某個 process 的某個 thread 在用 core');
  await step(tok);                                   // @258.5 最基本 utilize CPU 的 entity
  good('thread = 使用 CPU 的最基本單位', 0, 4.8);
  cap('thread：utilize CPU 的最基本 entity', '（basic unit of CPU utilization）');
  void core;
}]);

FRAG.push(['thr-15a-shared', '共用的 memory content：code、data、resources', async (tok) => {
  fresh([0, 5, 14], [0, 2.2, 0]);
  await step(tok);                                   // @264.5 什麼叫 lightweight：看 memory content
  hd('什麼叫 lightweight？看 memory content', 0, 5.3);
  cap('什麼叫 lightweight？', '最重要的觀點：memory content');
  await step(tok);                                   // @272.3 process 的 code segment、data segment…
  const z1 = zone('process 的 memory', -3.3, 0.02, 0, 4.2, 3.6, '#f3e6c8');
  z1.userData.name.position.z = 2.0;                 // name on the front edge, clear of the code block
  const segs = [['code', CO.code], ['data', CO.data], ['resource（files）', CO.files], ['stack', CO.stack]].map(([n, c], i) => bx(n, c, -3.3, 0.9 + i * 0.75, 0, 3.2, 0.6, 0.9));
  cap('process 的重點是它的 memory content', 'code segment、data segment…');
  await step(tok);                                   // @286.0 thread：code、data、resource section 是 shared
  for (let i = 0; i < 3; i++) glow(segs[i], GOLD);
  hot('shared', -0.6, 2.0);
  cap('thread 的定義：code、data、resource', '這三塊 memory content 是 shared');
  await step(tok);                                   // @295.0 同一 process 的不同 thread，這三個是 minimum
  const ta = pal('T1', '', TH[0], 2.2, 0, 0.6, 0.55), tb = pal('T2', '', TH[1], 4.4, 0, 0.6, 0.55);
  const la = ln(2.2, 0.6, -1.7, 1.6, 0.3), lb = ln(4.4, 0.6, -1.7, 2.8, 0.3);
  cap('同一個 process 裡的不同 threads', '至少（minimum）共用這三塊');
  await step(tok);                                   // @311.0 學過 segmentation：segment table 一個個 entry
  gone(la, lb);
  const tb1 = code(['T1 的 segment table', ' code  → 0x1000', ' data  → 0x4000', ' files → 0x7000'], 0.1, 4.55, 0.42);
  cap('學過 segmentation 就知道', '這些是不同 segment，table 裡一個個 entry');
  await step(tok);                                   // @322.2 create thread = 把這些 segment 做 sharing
  const tb2 = code(['T2 的 segment table', ' code  → 0x1000', ' data  → 0x4000', ' files → 0x7000'], 4.8, 4.55, 0.42);
  tb2.ls.slice(1).forEach((l) => { l.element.className = 'lab-label ptr alt'; });
  idx('（位址示意）', 4.8, 2.75);
  cap('create thread：把這些 segment 拿來 share', '就可以了');
  await step(tok);                                   // @337.7 有 sharing 所以省掉那些部分
  good('不用另外複製 → 省掉 → lightweight', 3.9, 1.6);
  ta.mood('happy'); tb.mood('happy');
  cap('因為共用，就省掉了那些部分', '所以叫 lightweight');
  void z1; void tb1;
}]);

FRAG.push(['thr-15a-private', '每個 thread 自己擁有的：TCB、ID、PC、registers、stack', async (tok) => {
  fresh([0, 5.4, 14.5], [0, 2.4, 0]);
  await step(tok);                                   // @344.2 single-threaded process：什麼 segment 都有
  const A = fig41(-3.6, 1, 'single-threaded', 3.6);
  cap('左邊：single-threaded process', '什麼 memory content、segment 都有');
  await step(tok);                                   // @352.0 create thread：code、data、resource 共用
  const B = fig41(2.6, 3, 'multithreaded', 5.0);
  B.sh.forEach((s) => glow(s, GOLD));
  cap('在 process 裡 create thread', 'code、data、resource 這幾塊共用');
  await step(tok);                                   // @364.7 能獨立執行 → 執行的部分不 share
  B.cols.forEach((c) => { glow(c.reg, '#3a0f22'); glow(c.st, '#24174a'); });
  cap('但每個 thread 能獨立執行', '執行用的部分必須自己擁有');
  await step(tok);                                   // @375.7 第一：thread control block
  const tcb = B.cols.map((c) => bx('TCB', '#c9b48e', c.cx, 1.55, 0.6, 0.9, 0.35, 0.5));
  cap('第一：自己的 thread control block', '就像 process 有 process control block');
  await step(tok);                                   // @386.5 Nachos 只看到 thread：本質上相同的 data structure
  const n1 = note('Nachos 裡只看見 thread（沒有 PCB）', 0, 5.6);
  cap('Nachos trace code 只看見 thread', 'process 與 thread 本質上可以用同一種資料結構');
  await step(tok);                                   // @407.2 Linux 根本沒有 process；Windows 兩者不同
  remove(n1);
  note('Linux：都是同一種東西　Windows：TCB、PCB 內容不同', 0, 5.6);
  cap('Linux 把兩者當同一種東西管', 'Windows 比較複雜，兩者設計不同');
  await step(tok);                                   // @445.0 block 裡：每個 thread 自己的 ID
  B.cols.forEach((c, k) => c.t.set('id ' + (k + 1)));
  cap('control block 管一個執行的 entity', '每個 thread 有自己獨立的 ID');
  await step(tok);                                   // @455.0 program counter 獨立：執行位置可以不同
  const pcs = B.cols.map((c, k) => hot('PC → 第 ' + [3, 7, 12][k] + ' 行', c.cx, -0.5 - (k % 2) * 0.6, 1.2));
  idx('（行號示意）', 2.6, -1.75, 1.2);
  cap('program counter 是獨立的', '每個 thread 執行的位置可以不一樣');
  await step(tok);                                   // @476.4 各自獨立執行不同 instruction、不同 function
  B.cols.forEach((c) => c.t.mood('happy'));
  cap('每個 thread 可以完全獨立', '執行不同的 instruction、不同的 function');
  await step(tok);                                   // @492.0 所以 register 也獨立
  B.cols.forEach((c) => glow(c.reg, '#7a1040'));
  cap('因為獨立執行，register 也是獨立的', '');
  await step(tok);                                   // @503.1 heap（dynamic allocate）也是 sharing
  const hp = bx('heap（malloc）', CO.heap, 2.6, 5.05, -0.6, 4.4, 0.45, 0.8);
  glow(hp, GOLD);
  cap('data 包括 global variable', '還有 heap 上 dynamic allocate 的，都 share');
  await step(tok);                                   // @517.3 不 share 的：stack
  B.cols.forEach((c) => glow(c.st, '#5a1aa0'));
  bad('stack 不 share！', 6.9, 2.55);
  cap('有一種 variable 不 share', '就是 stack 裡的');
  await step(tok);                                   // @520.0 stack 存 local variable：名字相同，位址不同
  tcb.forEach(kill);                                 // TCB 已講完，讓出位置給 local variable 的位址
  B.cols.forEach((c, k) => idx('int i @' + ['0x7f10', '0x7e10', '0x7d10'][k], c.cx, 2.0 - (k % 2) * 0.5, 0.4));
  idx('（位址示意）', -3.6, 2.0, 0.4);
  cap('stack 存 local variable', '程式裡名字相同，其實是不同 memory address');
  await step(tok);                                   // @537.3 function return 就沒了；每個 thread 一個 stack
  pcs.forEach(remove);
  good('每個 thread = 一個自己的 stack', 2.6, -0.6, 1.2);
  cap('function return 東西就沒了（temporary）', '每個 thread 都有自己獨立的 stack');
  void A;
}]);

FRAG.push(['thr-15a-progview', '寫程式時：local 私有、global / malloc 共用', async (tok) => {
  fresh([0, 5, 14], [0, 2.2, 0]);
  await step(tok);                                   // @547.0 thread 跟 process 差在哪：programming 上很容易辨別
  const c = code(['int g = 0;                  // global', 'void *work(void *arg) {', '  int i = 0;                // local', '  int *p = malloc(4);       // heap', '}'], -2.6, 5.4, 0.5);
  cap('在 programming 上很容易辨別', '');
  await step(tok);                                   // @552.0 local variable 在 stack → 獨立
  c.hl(2);
  const s1 = bx('T1 stack：i', CO.stack, 2.4, 1.0, 0, 2.2, 0.55, 0.8), s2 = bx('T2 stack：i', CO.stack, 5.0, 1.0, 0, 2.2, 0.55, 0.8);
  cap('local variable 放在 stack', '每個 thread 各一份，互相獨立');
  await step(tok);                                   // @559.0 global、malloc 出來的 → 可以 share
  c.hl(0);
  const gb = bx('global g ／ heap', CO.data, 3.7, 2.4, 0, 4.8, 0.55, 0.8); glow(gb, GOLD);
  ln(2.4, 1.3, 3.0, 2.1, 0.3); ln(5.0, 1.3, 4.4, 2.1, 0.3);
  cap('global variable、malloc 出來的記憶體', 'thread 之間可以 share');
  await step(tok);                                   // @567.3 不會 segmentation fault：data section 本來就 share
  c.hl(3);
  good('pointer 拿給別的 thread 用：有效', 3.7, 3.4);
  cap('把 pointer 傳給別的 thread 也不會出錯', 'data section 本來就全部 share');
  await step(tok);                                   // @583.1 OS 實作上可能混淆，對 programmer 完全不同
  c.hl(-1);
  note('OS 實作可能混著管；對 programmer 是完全不同的東西', 0, 0.0, 1.4);
  cap('OS 管理時可能有些混淆', '但對 programmer 應該分得很清楚');
  void s1; void s2;
}]);

FRAG.push(['thr-15a-apps', '為什麼要 thread：browser、web server、RPC', async (tok) => {
  fresh([0, 5, 14], [0, 2.2, 0]);
  await step(tok);                                   // @599.0 很多事一定要用 multithreading 才能完成
  hd('Thread programming 的好處？', 0, 5.3);
  cap('很多事情一定要靠 multithreading', '其實你常常在用');
  await step(tok);                                   // @614.3 web browser：文字先出來、圖片慢慢 pop out
  const mon = prop('monitor', -3.6, 0, 0, 1.6);
  const tx1 = idx('文字 ✓', -4.1, 2.2, 0.3);
  cap('例 1：web browser', '文字很快出現，圖片過一陣子才 pop out');
  await step(tok);                                   // @632.0 每個 object 用不同 thread 獨立 download
  const ts = [0, 1, 2].map((i) => pal('T' + (i + 1), '', TH[i], 0.4 + i * 1.5, 0, 0.6, 0.5));
  for (let i = 0; i < 3; i++) await fly(tok, 'pkt', ['文字', '圖片 1', '圖片 2'][i], V3(0.4 + i * 1.5, 1.2, 0.8), V3(-3.6, 1.7, 0.4), 420);
  const tx2 = idx('圖片 ✓', -3.1, 1.6, 0.3);
  cap('browser 用不同 thread', '各自獨立 download 每個 object');
  await step(tok);                                   // @650.6 web server（socket programming 講過）
  gone(mon, tx1, tx2, ...ts);
  const srv = pal('server', '', CO.os, -1.0, 0, 0, 0.95);
  const cl = [0, 1, 2].map((i) => pal('client', '', TH[i + 3], -5.2, 3.6 - i * 1.7, 0, 0.45));
  cap('例 2：web server', '講 socket programming 時看過');
  await step(tok);                                   // @668.5 request 都很小；main thread 一直在等
  srv.g.children; const m = hot('main thread：一直在等', 0.6, 2.4);
  cap('server 要接很多 request', '每個都很小；main thread 一直在等');
  await step(tok);                                   // @684.4 接到 connect 就 create 一個 thread 去 handle
  await fly(tok, 'pkt', 'request', V3(-4.6, 3.8, 0), V3(-1.0, 0.5, 0.6), 700);
  const w1 = pal('thread', '', TH[0], 2.4, 0, 0.6, 0.5); w1.mood('happy');
  cap('一接到 connection', '就 create 一個 thread 去 handle 這個 request');
  await step(tok);                                   // @692.1 main thread 繼續等下一個 request
  await fly(tok, 'pkt', 'request', V3(-4.6, 2.1, 0), V3(-1.0, 0.5, 0.6), 600);
  const w2 = pal('thread', '', TH[1], 4.2, 0, 0.6, 0.5); w2.mood('happy');
  cap('main thread 馬上回去', '繼續等下一個 request');
  await step(tok);                                   // @703.4 沒用 thread：一個 request 卡住所有人 → 連不進去
  remove(m); srv.mood('sad'); w1.mood('calm'); w2.mood('calm');
  bad('沒用 thread：一個 request 卡住所有人 → 連不進去', 0, 4.6);
  cap('不用 multithreading 的話', '一個 request 就卡住所有使用者，連不進去');
  await step(tok);                                   // @728.7 RPC 也一樣有 server
  srv.mood('happy');
  note('RPC（remote procedure call）server 也一樣', 0.6, 3.85);
  cap('例 3：RPC 也是一個 server', '很多人同時 remote call 上面的 function');
  await step(tok);                                   // @755.0 client 連進來由新 thread 接，main thread loop 等待
  await fly(tok, 'pkt', 'call', V3(-4.6, 0.4, 0), V3(-1.0, 0.5, 0.6), 600);
  pal('thread', '', TH[2], 6.0, 0, 0.6, 0.5);
  cap('新 thread 接 request，main thread loop 等下一個', '處理慢沒關係，connection 要馬上接起來');
  void cl;
}]);

FRAG.push(['thr-15a-benefit12', '好處 1、2：Responsiveness、Resource sharing', async (tok) => {
  fresh([0, 5, 14], [0, 2.2, 0]);
  await step(tok);                                   // @779.5 第一個：responsiveness
  hd('① Responsiveness（反應快）', -3, 5.3);
  cap('整理一下作用：第一，responsiveness', '');
  await step(tok);                                   // @788.4 server：很快 response connection，不被卡住
  const srv = pal('server', '', CO.os, -3.6, 0, 0, 0.9); srv.mood('happy');
  good('不會因為某個 request 卡住', -3.6, 2.4);
  cap('server 可以很快回應 connection', '不會因為某些 request 把 response time 拖慢');
  await step(tok);                                   // @813.0 或是寫遊戲：青蛙過河
  kill(srv.g);
  const road = bx('', '#9a9a9a', 1.0, 0.05, 0, 9, 0.1, 2.2);
  const frog = pal('青蛙', '', '#5fbf5a', -3.8, 0.1, 1.6, 0.5);
  const cars = [0, 1].map((i) => bx('🚗', TH[i * 3], -1 + i * 3.4, 0.4, -0.3 + i * 0.4, 1.0, 0.5, 0.6));
  cap('或是寫互動遊戲，例如青蛙過河', '');
  await step(tok);                                   // @827.5 一個 thread 控制車流，一個接 keyboard input
  const tc = pal('車流 thread', '', TH[0], 3.6, 2.6, -1, 0.5), tk = pal('鍵盤 thread', '', TH[1], -3.6, 2.6, -1, 0.5);
  await Promise.all([slide(tok, cars[0], 1.4, 0.4, -0.3, 900), slide(tok, cars[1], 4.6, 0.4, 0.1, 900)]);
  cap('一個 thread 控制車子流量', '一個接受使用者的 keyboard input');
  await step(tok);                                   // @845.0 獨立，但必要時可以同步、溝通（青蛙被撞）
  await slide(tok, frog.g, 1.4, 0.1, 0.4, 700); frog.mood('wow');
  bad('撞到了！要溝通', 1.4, 1.8, 0.6);
  cap('它們各自獨立', '必要時又可以同步、溝通（青蛙被撞到）');
  await step(tok);                                   // @861.8 第二個：resource sharing
  gone(road, frog, ...cars);
  hd('② Resource sharing', 3, 5.3);
  cap('第二：resource sharing', '撞到時要怎麼溝通？');
  await step(tok);                                   // @871.4 不同 process 為了 protection 不 share，要透過 OS 很慢
  const pa = pal('process A', '', CO.proc, -4.6, 0, 0, 0.6), pb = pal('process B', '', CO.proc, -1.6, 0, 0, 0.6);
  const os = bx('OS', CO.os, -3.1, 0.3, -1.4, 1.4, 0.5, 0.6);
  await fly(tok, 'pkt', '訊息', V3(-4.6, 1.0, 0.4), V3(-3.1, 0.8, -1.0), 500);
  await fly(tok, 'pkt', '訊息', V3(-3.1, 0.8, -1.0), V3(-1.6, 1.0, 0.4), 500);
  idx('不同 process：繞道 OS，慢', -3.1, 1.8);
  cap('不同 process 為了 protection 不 share memory', '溝通要透過 OS，可以但很慢');
  await step(tok);                                   // @887.0 thread：直接透過 global variable 溝通
  const g = bx('global: hit = 1', CO.data, 3.4, 0.35, 0, 2.6, 0.55, 0.8); glow(g, GOLD);
  ln(2.4, 2.35, 3.0, 0.7, 0); ln(4.4, 2.35, 3.8, 0.7, 0);
  tc.mood('happy'); tk.mood('happy');
  cap('同一個 process 的 thread', '直接透過 global variable 就能溝通');
  void pa; void pb; void os;
}]);

FRAG.push(['thr-15a-benefit34', '好處 3、4：用上多核心、Economy', async (tok) => {
  fresh([0, 5, 14], [0, 2.2, 0]);
  await step(tok);                                   // @911.8 第三：現在的硬體都是 multi-core
  const h3 = hd('③ 用上 multi-core（scalability）', 0, 5.3);
  const cores = [0, 1, 2, 3].map((i) => prop('cpu', -4.5 + i * 3, 0, 0, 1.0));
  cap('第三：現在所有硬體都是 multi-core', '');
  await step(tok);                                   // @926.5 多核心、多 CPU、雲端多台
  idx('多核心、多 CPU、甚至雲端多台電腦', 0, 1.6);
  cap('多核心、多 CPU', '甚至跑到 cloud 上是很多台電腦');
  await step(tok);                                   // @946.3 要達到最好效能一定要靠 thread
  const ts = cores.map((c, i) => pal('T' + (i + 1), '', TH[i], -4.5 + i * 3, 0.3, 0.9, 0.42));
  ts.forEach((t) => t.mood('happy'));
  cap('要把這些資源用滿，一定要靠 thread', '不用 thread 就浪費掉了');
  await step(tok);                                   // @962.5 也可以用 process 嗎？
  cores.forEach((c) => kill(c)); ts.forEach((t) => kill(t.g)); remove(h3);
  hd('④ Economy（便宜）', 0, 5.3);
  cap('那我用 process 也可以吧？', 'process 跟 thread 最大差別是什麼');
  await step(tok);                                   // @969.4 process cost 比較高：凡事透過 OS、memory content 多
  const pr = pal('process', '', CO.proc, -3.4, 0, 0, 1.0); pr.mood('sad');
  bx('code+data+files+stack…', CO.files, -3.4, 2.2, 0, 3, 0.45, 0.6);
  cap('process 的 cost 比較高', '凡事要透過 OS，memory content 也多');
  await step(tok);                                   // @978.2 create process 比 create thread 久得多
  const th = pal('thread', '', TH[0], 3.4, 0, 0, 0.6); th.mood('happy');
  bx('registers+stack', CO.stack, 3.4, 1.6, 0, 2.0, 0.4, 0.6);
  cap('create process 的時間遠比 create thread 長', '要準備的 data structure 多很多');
  await step(tok);                                   // @1004.8 這就是 Economy
  const eco = good('Economy：能用 thread 就不用 process', 0, 4.4);
  cap('能用 thread 就不用 process', '程式更快、系統 loading 更輕：Economy');
  await step(tok);                                   // @1021.2 實驗：fork vs pthread_create 快 20 幾倍到 50 倍
  kill(pr.g); kill(th.g); remove(eco);
  const b1 = bx('fork()', CO.bad, -1.0, 1.2, 0, 5.0, 0.5, 0.6), b2 = bx('pthread_create', CO.data, -3.25, 0.5, 0, 0.5, 0.5, 0.6);
  hot('快 20 幾倍到 50 倍', 3.3, 0.9);
  cap('實驗：fork vs pthread_create', 'thread 快了 20 幾倍到 50 倍');
  await step(tok);                                   // @1066.1 溝通：message passing（MPI）要 memory copy
  const m1 = bx('message passing（MPI）：send / receive 要 copy', CO.files, 0, 2.6, 0, 7.5, 0.5, 0.6);
  cap('第二點：溝通', 'MPI 是 message passing：send、receive 要 memory copy');
  await step(tok);                                   // @1093.6 shared memory：直接寫 global → 差 2 到 15 倍
  const m2 = bx('shared memory：直接寫 global', CO.data, 0, 3.4, 0, 7.5, 0.5, 0.6); glow(m2, GOLD);
  hot('傳輸量差 2 倍到 15 倍（同一台電腦）', 0, 4.3);
  cap('thread 用 shared memory 直接讀寫 global', '同一台電腦就差到 2 倍甚至 15 倍');
  await step(tok);                                   // @1118.8 除非是不同系統、不同 application → 才用 process
  note('溝通雙方是不同系統／application → 用 process', 0, -0.5, 1.2);
  cap('除非溝通的是不同系統、不同 application', '那就有必要用 process');
  await step(tok);                                   // @1133.1 把自己的工作平行加速 → 用 thread
  good('同一個工作要平行加速 → 用 thread', 0, -1.2, 1.2);
  cap('只是想把自己的工作平行加速', '本來就在解同一個問題 → thread');
  void b1; void b2; void m1;
}]);

FRAG.push(['thr-15a-hwsw', 'Software × Hardware：multithreaded programming 與 multicore', async (tok) => {
  fresh([0, 5, 14], [0, 2.2, 0]);
  await step(tok);                                   // @1151.6 可以從 software 和 hardware 兩個角度看
  const zs = zone('Software', -3.2, 0.02, 0, 5.4, 3.2, '#d6e6f6'), zh = zone('Hardware', 3.2, 0.02, 0, 5.4, 3.2, '#d8e6cf');
  zh.userData.name.position.set(3.6, 0.07, 1.85); // front edge: threads later stand at the back of this zone
  cap('thread programming 可以從兩個角度看', 'software 跟 hardware');
  await step(tok);                                   // @1159.4 software：multithreaded programming（Pthread、Java thread）
  code(['pthread_create(...)', 'new Thread(...)'], -3.2, 2.4, 0.5);
  cap('Software：multithreaded programming', '用 Pthread、Java thread 這些 library');
  await step(tok);                                   // @1181.5 hardware：multi-core system
  const cs = [0, 1, 2, 3].map((i) => prop('cpu', 1.9 + (i % 2) * 2.4, 0, -0.6 + Math.floor(i / 2) * 1.4, 0.75));
  cap('Hardware：multi-core 系統', '多核心、多 CPU');
  await step(tok);                                   // @1197.0 相輔相成：硬體廠商不斷增加核心
  arr(-0.4, 2.0, 0.6, 2.0, '#c08a1f'); arr(0.6, 1.2, -0.4, 1.2, '#c08a1f');
  cap('兩邊相輔相成', '有 thread programming，廠商才一直加核心');
  await step(tok);                                   // @1212.3 death of CPU scaling：以前靠頻率
  const cl = bx('時脈 GHz ↑↑', CO.bad, 3.2, 4.2, 0, 3, 0.5, 0.6);
  hd('Death of CPU scaling', 0, 5.4);
  cap('Death of CPU scaling', '以前電腦變快靠時脈（GHz）一直加');
  await step(tok);                                   // @1226.0 製程到瓶頸 → 現在比核心數
  P.tint(cl, CO.idle); P.relabel(cl, '時脈到瓶頸');
  bx('核心數 ↑↑', CO.data, 3.2, 3.5, 0, 3, 0.5, 0.6);
  cap('製程到瓶頸，時脈加不上去', '現在大家比的是有幾個核心');
  await step(tok);                                   // @1257.1 有多核心卻不會 thread programming → 跑不贏
  bad('有多核心卻不會寫 thread → 跑不贏', -3.2, 4.2);
  cap('有這種系統卻不會 thread programming', '怎麼跑得贏人家');
  await step(tok);                                   // @1274.1 OS 要管：thread 跟 core 的 binding
  remove(zs);
  const t = pal('thread', '', TH[0], -3.2, 0, 0.6, 0.55);
  await slide(tok, t.g, 1.9, 0.4, -0.6 + 0.4, 900);
  hot('binding', 0, 0.8, 1.2);
  cap('OS 要管的：thread 跟 core 的 binding', '有些功能甚至拆進 CPU 裡');
  await step(tok);                                   // @1292.5 Intel Hyper-Threading：一個 core 兩個 thread 同時跑
  const t2 = pal('thread', '', TH[1], 2.6, 0.4, 0.2, 0.45);
  note('Hyper-Threading：一個 core 讓兩個 thread 同時跑', 0, 5.0, 1);
  cap('Intel 的 Hyper-Threading', '一個 core 可以讓兩個 thread 同時跑');
  await step(tok);                                   // @1311.0 CPU、core 內部也在做 hardware scheduling
  idx('OS 排 → CPU 排 → core 內部也排', 3.2, -0.9, 1.6);
  cap('scheduling 更複雜了', '不只 OS，CPU 和 core 內部也在 schedule');
  await step(tok);                                   // @1333.2 中間有好幾個 layer，像 virtual → physical address
  good('像 virtual → physical address：中間有好幾層', -2.6, 3.2);
  cap('中間有好幾個 layer', '就像 virtual address 轉成 physical address');
  void zh; void cs; void t2;
}]);

FRAG.push(['thr-15a-challenges', 'Multicore programming 的挑戰', async (tok) => {
  fresh([0, 5.2, 14], [0, 2.2, 0]);
  await step(tok);                                   // @1354.6 thread programming 是 parallel programming 的一種
  hd('Parallel programming 的挑戰', 0, 5.4);
  const two = idx('兩種：shared memory（thread）、message passing', 0, 4.8);
  cap('thread programming 是平行程式的一種', '另一種是 message passing；問題相同、技巧不同');
  await step(tok);                                   // @1395.1 ① dividing activities
  const job = bx('一件大工作', CO.files, 0, 3.4, 0, 4, 0.6, 0.9);
  cap('① Dividing activities', '把一件事拆給很多人一起做');
  await step(tok);                                   // @1409.0 像分組作業
  kill(job);
  const tasks = ['Report', 'Code', 'Survey', '實驗'].map((n, i) => bx(n, TH[i], -4.5 + i * 3, 3.4, 0, 2.2, 0.55, 0.8));
  const ws = [0, 1, 2, 3].map((i) => pal('T' + (i + 1), '', TH[i], -4.5 + i * 3, 1.4, 0, 0.45));
  cap('像大家寫作業要先分配', '你寫 report、我寫 code…');
  await step(tok);                                   // @1425.8 不是所有問題都能拆；拆不好會卡在某個人
  ws[2].mood('sad'); const stuck = note('拆不好：卡在某一個人身上', 1.5, 0.6, 0.6);
  cap('不是所有問題都能這樣拆', '怎麼拆影響很大');
  await step(tok);                                   // @1439.6 ② data splitting：計算要拆，data 也要拆
  tasks.forEach(kill); ws.forEach((w) => kill(w.g)); remove(stuck);
  cap('② Data splitting', '電腦就是 compute on data：計算拆、data 也要拆');
  await step(tok);                                   // @1463.4 例：平行 sorting，10 個 element、5 個 thread
  const arrB = [];
  for (let i = 0; i < 10; i++) arrB.push(bx(String([7, 2, 9, 4, 1, 8, 3, 6, 5, 0][i]), TH[Math.floor(i / 2)], -4.5 + i, 3.2, 0, 0.9, 0.6, 0.6));
  idx('（數值示意）', 4.8, 3.9);
  const w5 = [0, 1, 2, 3, 4].map((k) => pal('T' + (k + 1), '', TH[k], -4.0 + k * 2, 1.1, 0, 0.42));
  cap('例：平行 sorting，10 個 element、5 個 thread', '每人各兩個？');
  await step(tok);                                   // @1496.4 平分不一定最好；Graph 怎麼切？
  remove(two);
  const even = note('平分不一定最好：每個 data 計算量不同', 0, 5.0);
  const gph = idx('Graph：vertex 數一樣？edge 數一樣？', 0, 0.0, 1.0);
  cap('平分不一定最好', '像 graph 要怎麼 partition 更不單純');
  await step(tok);                                   // @1530.0 ③ data dependency
  arrB.forEach(kill); w5.forEach((w) => kill(w.g)); gone(even, gph);
  const d = bx('shared data', CO.data, 0, 1.0, 0, 2.4, 0.6, 0.8);
  const a = pal('T1', '', TH[0], -3.4, 0, 0.6, 0.5), b = pal('T2', '', TH[1], 3.4, 0, 0.6, 0.5);
  arr(-2.8, 0.8, -1.3, 1.0, '#d64545', 0.4); arr(2.8, 0.8, 1.3, 1.0, '#d64545', 0.4);
  cap('③ Data dependency', '兩人同時改同一個 data，或後者要等前者改完');
  await step(tok);                                   // @1576.2 ④ balance：程式取決於最後結束的人
  gone(d, a, b);
  const bars = [2, 2.3, 5.2, 1.8].map((w, i) => seg('T' + (i + 1), TH[i], -4.5, 3.6 - i * 0.6, w));
  idx('（時間示意）', 3.8, 1.4);
  hot('等最慢的那個', 1.4, 2.8);
  cap('④ Load balancing', '程式什麼時候結束，取決於最慢的那個');
  await step(tok);                                   // @1615.4 很多執行時間是跑了才知道
  const late = note('執行時間常常跑了才知道，很難事先預測', 0, 4.6);
  cap('很多執行時間跑了才發現', '不容易事先預測、達到最好效果');
  await step(tok);                                   // @1627.0 最後：testing 跟 debugging
  bars.forEach(kill); remove(late);
  const dbg = pal('debugger', '', CO.os, 0, 0, 0, 0.7);
  cap('最後一個幾乎無解：testing 跟 debugging', '');
  await step(tok);                                   // @1661.0 GDB 等工具只適用 sequential code
  idx('GDB：單一 thread 一步一步 trace ✓', 0, 2.2);
  cap('GDB 這些 debugger', '其實只適用 sequential code（單一 thread）');
  await step(tok);                                   // @1693.1 先做後做結果就不一樣 → 很難 debug
  dbg.mood('sad');
  const tA = pal('T1', '', TH[0], -3.6, 0, 0.6, 0.45), tB = pal('T2', '', TH[1], 3.6, 0, 0.6, 0.45);
  bad('同樣的步驟，先後順序不同 → 結果不同', 0, 3.4);
  cap('每個 thread 都照步驟做', '但一個先一個後，結果就不一樣');
  await step(tok);                                   // @1749.0 parallel 跟 sequential programming 的差別
  good('這就是 parallel 和 sequential programming 的差別', 0, 4.4);
  cap('這就是 thread（parallel）programming', '跟一般 sequential programming 的差別');
  void tA; void tB;
}]);

// ════════ GO4Lbeh8M_0（第 15B 講 Thread Introduction 續：user / kernel thread、三種 model） ════════
FRAG.push(['thr-15b-twolevels', 'User thread 與 kernel thread：兩層與 binding', async (tok) => {
  fresh([0, 5, 14], [0, 2.0, 0]);
  await step(tok);                                   // @15.9 thread management：分 user thread 跟 kernel thread 兩層
  const R = mapRig(3, 2, [null, null, null]);
  cap('Thread management', '分成 user thread 跟 kernel thread 兩層');
  await step(tok);                                   // @20.3 user thread：Pthreads、Java threads、Win32 threads
  R.U.forEach((u, i) => u.set(['Pthread', 'Java', 'Win32'][i]));
  cap('User thread：平常看到的那些', 'Pthreads、Java threads、Win32 threads');
  await step(tok);                                   // @63.3 都是 thread library，在 API 層（user level）
  const lib = bx('thread library（API 層）', '#e2c98f', 0, 4.9, -0.6, 6.0, 0.4, 0.6);
  cap('它們都是 thread library', '放在電腦系統的 API 層，屬於 user level');
  await step(tok);                                   // @84.5 programmer 直接用 user thread library
  const pg = pal('programmer', '', '#f0b27a', 5.2, 3.2, 0, 0.5); pg.mood('happy');
  cap('programmer 寫程式', '直接用的就是 user thread 的 library');
  await step(tok);                                   // @89.6 kernel thread：OS 真正 manage 的執行單位
  R.K.forEach((k) => k.glow('#2a1a5a'));
  cap('Kernel thread：OS 裡面的', 'OS 真正管理、排程的基本執行單位');
  await step(tok);                                   // @108.7 每個 OS 有自己的 kernel thread
  idx('每個 OS 各自定義（像各自定義 process）', 0, -0.6, 1.2);
  cap('每個 OS 都有自己的 kernel thread', '就像它定義自己的 process 一樣');
  await step(tok);                                   // @117.6 不是一對一，是 binding / mapping 的關係
  hot('binding / mapping', 4.6, 1.8);
  cap('兩者沒有一對一的關聯', '而是 binding（mapping）的關係');
  await step(tok);                                   // @132.0 要執行時，OS 把 user thread bind 到某個 kernel thread
  R.remap(0, 0, '#c08a1f'); R.U[0].mood('happy');
  cap('user thread 要執行時', 'OS 把它 bind 到其中一個 kernel thread');
  await step(tok);                                   // @145.3 run time 可以調整：做 I/O 離開，再回來可能 bind 到第二個
  R.remap(0, null); R.U[0].mood('calm'); const io = note('去做 I/O…', R.ux(0), 4.9);
  await wt(tok, 500); remove(io);
  R.remap(0, 1, '#c08a1f'); R.U[0].mood('happy');
  cap('binding 在 run time 可以調整', '做完 I/O 再被排程，可能改 bind 到第二個');
  await step(tok);                                   // @167.6 programmer 不 care kernel thread；OS designer 管它
  pg.mood('calm'); const os = pal('OS designer', '', CO.os, -5.2, 0, 0.8, 0.5); os.mood('happy');
  cap('programmer 不 care kernel thread', 'OS 的 designer 才在管理它們');
  void lib;
}]);

FRAG.push(['thr-15b-fastblock', 'User thread 快、kernel thread 互不影響', async (tok) => {
  fresh([0, 5, 14], [0, 2.0, 0]);
  await step(tok);                                   // @184.7 user thread 就是 thread library（API）
  const R = mapRig(4, 1, [null, null, null, null]);
  cap('User thread 就是這些 thread library', '也就是 API');
  await step(tok);                                   // @191.6 很快：user level，不用 interrupt、不用跟 OS 溝通
  R.U.forEach((u) => u.mood('happy'));
  const fast = good('不用 interrupt、不用找 OS → 快', 0, 5.0);
  cap('通常很快：它在 OS 上面（user level）', 'API 只是 user level，不用進 kernel');
  await step(tok);                                   // @222.6 create 快、好 manage；那為什麼要 kernel thread？
  const why = hot('那為什麼要 kernel thread？', 4.2, 1.4);
  cap('create 快、也容易 manage', '那問題是什麼？為什麼還要 kernel thread');
  await step(tok);                                   // @234.0 kernel 只有一個 thread 時，user 很多 thread 沒用
  cap('如果 kernel 只有一個 thread', 'user level 再多 thread 其實沒用');
  await step(tok);                                   // @249.0 全部 bind 到同一個 kernel thread
  for (let i = 0; i < 4; i++) R.remap(i, 0);
  cap('因為它們全部 bind 到', '同一個 kernel thread');
  await step(tok);                                   // @252.4 一個 user thread call I/O 或 sleep → block
  R.U[0].mood('sad'); R.U[0].glow('#5a1010'); R.K[0].glow('#5a1010');
  remove(fast);
  const blk = note('call I/O 或 sleep → block', R.ux(0), 4.9);
  cap('只要一個 user thread call I/O 或 sleep', '把自己 block 住');
  await step(tok);                                   // @263.0 大家都 bind 同一個 → 都不能動；只是假象
  R.U.forEach((u) => u.mood('sad'));
  const fake = bad('大家都卡住：多 thread 只是假象', 0, 1.6, 1.0);
  cap('大家都 bind 同一個，就沒人能用它', '以為 create 很多 thread，其實只是假象');
  await step(tok);                                   // @287.0 kernel thread：OS 最基本 utilize CPU 的 entity
  R.clear(); gone(why, blk, fake);
  const R2 = mapRig(4, 4, [0, 1, 2, 3]);
  cap('Kernel thread', 'OS 裡最基本 utilize CPU 的 entity');
  await step(tok);                                   // @297.6 在 kernel 裡，經過 protection 等機制 → 比較慢
  R2.K.forEach((k) => k.mood('calm')); note('進 kernel、protection 檢查 → 較慢', 0, -0.6, 1.2);
  cap('因為在 kernel 裡', '要經過 protection 等複雜機制，一定比較慢');
  await step(tok);                                   // @303.6 好處：獨立，一個 block 其他照常
  R2.U[0].mood('sad'); R2.K[0].glow('#5a1010'); R2.U[0].glow('#5a1010');
  [1, 2, 3].forEach((i) => R2.U[i].mood('happy'));
  good('K1 被 block，其他照常跑', 2.4, 1.7, 1.0);
  cap('好處：每個 kernel thread 獨立執行', '一個被 block，其他照常運作');
  await step(tok);                                   // @327.5 只有 kernel level 有這特性
  hot('只有 kernel level 才保證這個特性', 0, 5.0);
  cap('像不同 process 互不影響', '但只有 kernel level thread 才有這特性');
}]);

FRAG.push(['thr-15b-m1', 'Many-to-One', async (tok) => {
  fresh([0, 5, 14], [0, 2.0, 0]);
  await step(tok);                                   // @334.8 OS 要決定兩者的 mapping：幾個 model
  const R = mapRig(4, 1, [null, null, null, null]);
  cap('有 user thread、有 kernel thread', 'OS 要決定它們怎麼 mapping：幾種 model');
  await step(tok);                                   // @360.2 最簡單：所有 user thread 對到一個 kernel thread
  for (let i = 0; i < 4; i++) { R.remap(i, 0); await wt(tok, 200); }
  cap('最簡單的第一種', '所有 user thread 都對到一個 kernel thread');
  await step(tok);                                   // @369.0 many-to-one
  hd('Many-to-One', 0, 5.3);
  cap('這就是 many-to-one', 'user 不管 create 幾個，都對到一個');
  await step(tok);                                   // @376.5 以 process 為單位：一個 process 一個 kernel thread
  const z = zone('同一個 process', 0, 3.2, 0, 7.4, 1.6, '#f3e6c8');
  cap('通常以 process 的角度', '一個 process 一個 kernel thread');
  await step(tok);                                   // @389.6 任何一個 thread block，其他 thread 都不能跑
  R.U[1].mood('sad'); R.U[1].glow('#5a1010'); R.K[0].glow('#5a1010');
  await wt(tok, 400); [0, 2, 3].forEach((i) => R.U[i].mood('sad'));
  bad('一個 block → 全部停', 3.2, 0.9, 0.8);
  cap('只要任何一個 thread block', '這個 process 的其他 thread 都不能跑');
  await step(tok);                                   // @395.7 像傳統 process，只是能 resource sharing
  R.K[0].glow(null); R.U[1].glow(null); R.U.forEach((u) => u.mood('calm'));
  note('比較像傳統 process，只是多了 resource sharing', 0, 5.9);
  cap('比較像傳統的 process 觀念', '只是讓 thread 能做 resource sharing');
  await step(tok);                                   // @404.0 4 個 core、create 4 個 thread，從沒同時執行
  const cs = [0, 1, 2, 3].map((i) => prop('cpu', -4.8 + i * 3.2, 0, 2.2, 0.6));
  cs.slice(1).forEach((c) => void c);
  bad('4 個 core，只有 1 個在用', 0, -0.6, 2.6);
  cap('電腦有 4 個 core、create 4 個 thread', '它們從來沒有同時執行過（要排隊）');
  await step(tok);                                   // @420.2 但可以用 global variable sharing、做到 responsiveness
  good('仍可：global variable sharing、responsiveness', 0, -1.5, 2.6);
  cap('不過還是可以用 global variable 做 sharing', 'responsiveness 也做得到，用途不同');
  void z;
}]);

FRAG.push(['thr-15b-o1', 'One-to-One', async (tok) => {
  fresh([0, 5, 14], [0, 2.0, 0]);
  await step(tok);                                   // @432.0 第二個比較常見：one-to-one
  const R = mapRig(4, 4, [null, null, null, null]);
  hd('One-to-One', 0, 5.3);
  cap('第二種比較常見：one-to-one', '');
  await step(tok);                                   // @441.2 一個 user 一個 kernel：不會有任何感覺
  for (let i = 0; i < 4; i++) { R.remap(i, i); await wt(tok, 200); }
  cap('一個 user thread 就配一個 kernel thread', '一對一，你不會有任何感覺');
  await step(tok);                                   // @450.0 純粹因為 user 跟 kernel 是不同層；方便 implement、manage
  note('實際上是兩個東西；一對一最好 implement、manage', 0, 5.9);
  cap('純粹因為 kernel 跟 user 是不同層', '一對一最單純、好實作好管理');
  await step(tok);                                   // @462.0 很多 OS 這麼做：資源多，不怕 create 一堆 kernel thread
  R.U.forEach((u) => u.mood('happy'));
  cap('很多 OS 都這麼做', '現在電腦資源多，不怕一堆 kernel thread');
  await step(tok);                                   // @476.6 壞處：kernel thread 有 control block，數量有上限
  R.K.forEach((k) => k.set('TCB'));
  hot('kernel thread 數量有上限', 4.6, 1.6);
  cap('壞處：kernel thread 要有 control block 等等', '所以數量通常有上限');
  await step(tok);                                   // @488.0 就像開 file 的數量也有上限
  const f = prop('file', 5.4, 0, 1.4, 0.6);
  idx('開 file 也有上限', 5.0, -0.6, 1.6);
  cap('就像在電腦上開 file', '數量也有 limit，怕影響整個系統');
  await step(tok);                                   // @507.0 programmer 以為能開無限 thread → 系統卡住
  const extra = [0, 1].map((i) => pal('U' + (5 + i), '', TH[(4 + i) % 8], 4.9 + i * 0.9, 3.3, 0, 0.42));
  extra.forEach((e) => e.mood('wow')); R.K.forEach((k) => k.mood('sad'));
  bad('一直開 thread → 整個系統卡住', 0, -1.6, 1.0);
  cap('使用者以為可以開無限的 thread', '有事沒事就開一個，可能把整個系統卡住');
  void f;
}]);

FRAG.push(['thr-15b-mm', 'Many-to-Many', async (tok) => {
  fresh([0, 5, 14], [0, 2.0, 0]);
  await step(tok);                                   // @518.3 第三個最複雜：many-to-many
  const R = mapRig(4, 3, [null, null, null, null]);
  hd('Many-to-Many', 0, 5.3);
  cap('第三種最複雜：many-to-many', '');
  await step(tok);                                   // @527.3 只要能對到就好，數字不必相同
  [0, 1, 2, 0].forEach((j, i) => R.remap(i, j));
  cap('只要能對到就好', '兩邊的數字不一定要相同');
  await step(tok);                                   // @532.4 implement 最複雜：執行時要確保 mapping 正確
  const os = pal('OS', '', CO.os, 5.4, 0, 0.8, 0.5); os.mood('wow');
  cap('support 它的 OS 實作最複雜', '執行時要自己管、確保 mapping 正確');
  await step(tok);                                   // @552.0 例：四個 user thread share 三個 kernel thread
  note('4 個 user thread share 3 個 kernel thread', 0, 5.9);
  cap('例如這四個', '可能只 share 三個 kernel thread');
  await step(tok);                                   // @559.0 一個被 block，用掉一個 kernel thread
  R.remap(0, 0, '#d64545'); R.U[0].mood('sad'); R.U[0].glow('#5a1010'); R.K[0].glow('#5a1010');
  cap('假設有一個被 block', '它就占用了一個 kernel thread');
  await step(tok);                                   // @564.2 剩下三個 share 兩個，輪流繼續
  R.remap(3, 2); R.U[3].mood('happy'); await wt(tok, 500);
  R.remap(1, 2); R.remap(3, 1); R.U[1].mood('happy'); R.U[2].mood('happy');
  cap('剩下三個人 share 另外兩個', '輪流使用，繼續執行');
  await step(tok);                                   // @577.2 最有彈性，最不容易互相卡住
  good('最有彈性、最不容易互卡', 0, -0.5, 1.4);
  cap('最有彈性', '最不容易碰到互相卡住的問題');
  await step(tok);                                   // @584.0 kernel 可以自己決定需要幾個 kernel thread
  note('loading 輕 → 全部交給一個 kernel thread 也行', 0, -1.4, 1.4);
  cap('kernel 也可以自己決定要幾個 kernel thread', 'user thread loading 很輕就全用一個處理');
  await step(tok);                                   // @598.0 管理複雜 → overhead；情境單純反而划不來
  os.mood('sad');
  bad('管理複雜 → overhead', 5.0, 2.0);
  cap('但管理機制複雜，一定有很多 overhead', '使用情境單純時反而划不來');
}]);

FRAG.push(['thr-15b-compare', '三種 model 的好處與壞處', async (tok) => {
  fresh([0, 5.4, 14], [0, 2.4, 0]);
  await step(tok);                                   // @622.4 看圖就知道，好處壞處要記下來
  const cols = [['Many-to-One', -4.4], ['One-to-One', 0], ['Many-to-Many', 4.4]];
  cols.forEach(([n, x]) => hd(n, x, 5.4));
  const mini = [[4, 1, [0, 0, 0, 0]], [4, 4, [0, 1, 2, 3]], [4, 3, [0, 1, 2, 0]]];
  mini.forEach(([nu, nk, mp], c) => {
    const x0 = cols[c][1];
    const ux = (i) => x0 + (i - 1.5) * 0.8, kx = (j) => x0 + (j - (nk - 1) / 2) * 0.9;
    for (let i = 0; i < nu; i++) bx('', TH[i], ux(i), 4.6, 0, 0.5, 0.35, 0.4);
    for (let j = 0; j < nk; j++) bx('', CO.kern, kx(j), 3.6, 0, 0.6, 0.35, 0.4);
    mp.forEach((j, i) => ln(ux(i), 4.42, kx(j), 3.78, 0));
  });
  cap('看圖就知道三種是什麼意思', '重點是把好處、壞處記下來');
  const row = (t, cls, x, y) => tag(t, cls, x, y);
  await step(tok);                                   // @638.1 many-to-one：thread management 在 user space → 快
  row('✓ 管理在 user space：快', 'good', -4.4, 2.7);
  cap('Many-to-one：管理在 user space', 'create thread 不用 create kernel thread → 快');
  await step(tok);                                   // @662.4 缺點：blocking；不能用 multiprocessor
  row('✗ 一個 block 全卡住', 'bad', -4.4, 2.0); row('✗ 無法平行用多核心', 'bad', -4.4, 1.3);
  cap('缺點：blocking 的問題', '而且沒辦法用 multiprocessor 真的平行');
  await step(tok);                                   // @680.6 one-to-one：最單純
  row('最單純', 'idx', 0, 2.7);
  cap('One-to-one：最單純的 case', '');
  await step(tok);                                   // @690.7 缺點：數量被 kernel 限制，programmability 差
  row('✗ thread 數量有上限', 'bad', 0, 2.0);
  cap('問題：thread 數量會被 kernel 限制住', 'user 也跟著受限，不利 programmability');
  await step(tok);                                   // @708.4 好處：concurrency 最高
  row('✓ concurrency 最高', 'good', 0, 1.3);
  cap('好處：concurrency 一定最高', '完全不會互相影響');
  await step(tok);                                   // @714.4 每個 user thread 都要 create kernel thread → 慢
  row('✗ 每個都要建 kernel thread：慢', 'bad', 0, 0.6);
  cap('缺點：每個都要 create kernel thread', '所以比 many-to-one 明顯慢');
  await step(tok);                                   // @728.2 但很常見：大部分 OS 用 one-to-one
  const cm = row('★ 最常見：大部分 OS', 'ptr alt', 0, -0.1);
  cap('但 one-to-one 很常見', '現代電腦資源多，大部分 OS 用它');
  await step(tok);                                   // @753.0 OS 不希望太複雜：難 debug、common case 變慢
  note('OS 不想太複雜：難 debug、common case 反而變慢', 0, -0.9);
  cap('OS 其實不希望太複雜', '不好 debug，一般情況反而變慢');
  await step(tok);                                   // @764.7 many-to-many：最複雜，run time 任意 mapping
  row('run time 任意 mapping', 'idx', 4.4, 2.7);
  cap('Many-to-many：最複雜', '在 run time、每次執行前決定 mapping');
  await step(tok);                                   // @784.0 沒有限制、不容易被卡住
  row('✓ 沒限制、不易卡住', 'good', 4.4, 2.0);
  cap('好處：沒有任何限制', '也不太容易被卡住');
  await step(tok);                                   // @791.0 缺點：overhead，一般情況較慢、OS 易出錯
  row('✗ overhead 大、OS 易出錯', 'bad', 4.4, 1.3);
  cap('缺點：overhead', '一般情況稍慢，OS 也比較容易出錯');
  void cm;
}]);

FRAG.push(['thr-15b-recap', '回顧：thread vs process、user / kernel 與 binding', async (tok) => {
  fresh([0, 5, 14], [0, 2.2, 0]);
  await step(tok);                                   // @815.4 前半段很重要：thread 跟 process 的差別
  const p = pal('process', '', CO.proc, -3.6, 0, 0, 0.9), t = pal('thread', '', TH[0], -1.2, 0, 0, 0.6);
  hd('今天的重點', 0, 5.3);
  cap('前半段很重要', 'thread 跟 process 的差別');
  await step(tok);                                   // @829.9 為什麼用 thread、會碰到的 challenge
  note('為什麼用 thread？會碰到哪些 challenge？', -2.4, 2.6);
  cap('為什麼要用 thread', 'thread programming 會碰到的 challenge');
  await step(tok);                                   // @836.2 管理上分 user / kernel 兩層
  ln(1.0, 1.4, 6.2, 1.4, 0, '#8a7a5c'); idx('user', 1.4, 1.8); idx('kernel', 1.4, 0.9);
  const u = [0, 1, 2].map((i) => bx('U', TH[i], 2.6 + i * 1.3, 2.2, 0, 0.7, 0.45, 0.5));
  const k = [0, 1].map((j) => bx('K', CO.kern, 3.25 + j * 1.3, 0.4, 0, 0.7, 0.45, 0.5));
  cap('OS 特別強調：管理上分成', 'user 跟 kernel 兩個不同的 layer');
  await step(tok);                                   // @846.0 不同 binding option：有些 1-to-1，有些 many-to-many
  [[0, 0], [1, 1], [2, 0]].forEach(([i, j]) => ln(2.6 + i * 1.3, 1.98, 3.25 + j * 1.3, 0.62, 0.1, '#c08a1f'));
  good('one-to-one：Linux、Windows 等多數 OS', 3.6, 3.4);
  cap('不同的 binding option', '有些 OS 用 one-to-one，有些 many-to-many');
  await step(tok);                                   // @854.6 many-to-one 較少：embedded、limited hardware
  note('many-to-one 較少：embedded device 等資源有限的硬體', 0, -0.8, 1.4);
  cap('many-to-one 比較少見', '可能用在 embedded device 等資源有限的硬體');
  void p; void t; void u; void k;
}]);

// ════════ 8x6-r-maTZA（第 16A 講 Multithreaded Programming：shared memory、POSIX、pthread、Java、Linux clone） ════════
FRAG.push(['thr-16a-intro', '本講預告：pthread、Java thread、Linux 怎麼管 thread', async (tok) => {
  fresh([0, 5, 14], [0, 2.2, 0]);
  await step(tok);                                   // @13.8 後半段：thread 使用上的特性；user thread = library
  hd('Thread 使用上的特性', 0, 5.3);
  const lib = bx('user thread = thread library', '#e2c98f', 0, 3.8, 0, 6, 0.5, 0.7);
  cap('後半段：thread 實際使用的特性', 'user thread 這邊就是 thread library');
  await step(tok);                                   // @16.4 pthread：Linux 上用 C、C++ 的 thread library
  const pt = pal('pthread', 'C / C++', TH[0], -3.4, 0, 0, 0.75);
  cap('簡單介紹 pthread', 'Linux 上用 C、C++ 會用的 thread library');
  await step(tok);                                   // @18.8 Java 有 thread class，更容易用
  const jv = pal('Java', 'Thread', TH[5], 0, 0, 0, 0.75); jv.mood('happy');
  cap('Java 不用講', '它有 Thread class，可能更容易用');
  await step(tok);                                   // @20.7 OS 部分主要講 Linux；Windows 較複雜看課本
  const lx = pal('Linux', 'kernel', CO.os, 3.4, 0, 0, 0.75);
  const win = note('Windows 比較複雜：有興趣看課本', 3.4, 2.4);
  cap('OS 的部分主要講 Linux 怎麼處理 thread', 'Windows 比較複雜，有興趣看課本');
  await step(tok);                                   // @63.1 Linux 不做區隔：把 process 當 thread 來管
  lx.mood('happy'); remove(win); hot('process ＝ thread 一起管', 3.4, 2.4);
  cap('Linux 沒做區隔', '就把 process 當作 thread 來管理');
  await step(tok);                                   // @70.2 programmer 要明確區隔；OS 可以用相同 data structure
  note('programmer：完全不同的東西　OS：同一套 data structure 管理', 0, -0.6, 1.4);
  cap('對 programmer：兩者要分得很清楚', '對 OS：都是要 CPU core 執行的執行序，可以一樣管');
  void lib; void pt;
}]);

FRAG.push(['thr-shm-concept', 'Shared-memory programming：共用與私有', async (tok) => {
  fresh([0, 5, 14], [0, 2.2, 0]);
  await step(tok);                                   // @99.0 thread programming 是一種平行程式
  hd('Thread programming = 平行程式', 0, 5.3);
  cap('Thread programming', '其實就是一種平行程式');
  await step(tok);                                   // @110.0 分兩種溝通：shared memory、message passing
  const L1 = bx('Shared memory', CO.data, -3.2, 4.2, 0, 3.6, 0.55, 0.8), L2 = bx('Message passing', CO.files, 3.2, 4.2, 0, 3.6, 0.55, 0.8);
  cap('平行程式依「怎麼溝通」分兩種', 'shared memory 跟 message passing');
  await step(tok);                                   // @127.2 thread 屬於 shared memory：讀寫共同 variable 溝通
  glow(L1, GOLD); kill(L2);
  cap('thread 屬於 shared memory programming', '讀寫大家都看得到的 variable 來溝通');
  await step(tok);                                   // @144.7 架構：一塊共用 memory＋各自 private 空間
  const sh = bx('shared memory（大家都讀得到）', CO.data, 0, 3.3, 0, 7, 0.6, 1);
  const ts = [0, 1, 2].map((i) => pal('T' + (i + 1), '', TH[i], -3.2 + i * 3.2, 0, 0.6, 0.55));
  const pv = [0, 1, 2].map((i) => bx('private', CO.stack, -3.2 + i * 3.2, 1.55, -0.6, 1.6, 0.45, 0.6));
  cap('一塊所有 thread 都讀得到的 memory', '加上每個 thread 自己 private 的空間');
  await step(tok);                                   // @161.6 shared：global、data segment、heap
  P.relabel(sh, 'shared：global、data segment、heap');
  cap('同一個 process 的 threads', 'global（data segment）、heap 是 shared');
  await step(tok);                                   // @173.6 private：local variable，在 stack 裡
  pv.forEach((b) => P.relabel(b, 'stack：local'));
  cap('private 的是 local variable', '也就是 function 在 stack 裡的變數，別人拿不到');
  await step(tok);                                   // @184.7 透過 global 或 malloc 的 pointer 溝通
  await fly(tok, 'pkt', 'x = 5', V3(-3.2, 2.75, 0.9), V3(-0.8, 2.75, 0.9), 600);   // 在 private 與 shared 之間的高度移動，不穿過名牌
  await fly(tok, 'pkt', '讀 x', V3(0.8, 2.75, 0.9), V3(3.2, 2.75, 0.9), 600);
  cap('通常用 global variable', '或 malloc 出來的 pointer 讀寫來溝通');
  await step(tok);                                   // @195.7 比 message passing 快：不用 memory copy
  const fastL = good('不用 memory copy → 快', 0, -0.8, 1.2);
  cap('跟 message passing 比通常比較快', '因為不用做 memory copy');
  await step(tok);                                   // @210.2 缺點：同時寫 → 覆蓋、順序不同結果不同、deadlock
  const ws = ts.map((t, i) => fly(tok, 'pkt', 'write', V3(-3.2 + i * 3.2, 2.75, 0.9), V3(-1.6 + i * 1.6, 2.75, 0.9), 600));
  await Promise.all(ws); remove(fastL); glow(sh, RED); ts.forEach((t) => t.mood('wow'));
  bad('覆蓋、順序不同結果不同、deadlock', 0, -0.8, 1.2);
  cap('缺點：大家隨時能寫同一塊 memory', '會覆蓋、順序不同結果不同（synchronization 章）');
  await step(tok);                                   // @235.3 為正確花的時間可能比好處多；通常仍較快
  glow(sh, null); ts.forEach((t) => t.mood('calm'));
  note('同步的代價可能比好處還多；但通常還是比較快', 0, 4.9);
  cap('為了正確做同步，時間可能比省下的還多', '不過通常還是比較好：不用 memory copy');
}]);

FRAG.push(['thr-shm-ways', 'Shared-memory programming 的三種方式', async (tok) => {
  fresh([0, 5.2, 14], [0, 2.4, 0]);
  await step(tok);                                   // @258.0 shared memory programming 有很多種方式
  hd('Shared-memory programming 的三種方式', 0, 5.6);
  cap('shared-memory programming 有很多種', '大致上有三種用法');
  await step(tok);                                   // @265.1 ① 用 thread 的概念
  bx('① thread', CO.code, -4.4, 4.6, 0, 3.2, 0.6, 0.9, 2);
  const t1 = pal('T1', '', TH[0], -5.0, 2.0, 0, 0.45), t2 = pal('T2', '', TH[1], -3.8, 2.0, 0, 0.45);
  cap('① 用 thread 的概念做 memory sharing', '這堂課要講的');
  await step(tok);                                   // @276.4 ② process 之間也可以
  bx('② process + OS', CO.os, 0, 4.6, 0, 3.2, 0.6, 0.9, 2);
  const pa = pal('P1', '', CO.proc, -0.8, 2.0, 0, 0.45), pb = pal('P2', '', CO.proc, 0.8, 2.0, 0, 0.45);
  cap('② 沒說一定要 thread', 'process 跟 process 之間也可以');
  await step(tok);                                   // @285.7 透過 OS：run time create segment，宣告 share
  const sg = bx('shared segment', CO.data, 0, 0.6, 0, 2.4, 0.45, 0.7);
  ln(-0.8, 2.0, -0.4, 0.85, 0.2); ln(0.8, 2.0, 0.4, 0.85, 0.2);
  cap('透過 OS：run time 建一個 segment', '告訴 OS 這塊要 share between processes');
  await step(tok);                                   // @305.3 thread 較快：process 較 heavy，thread 預設 share global
  good('thread 預設就 share global → 快', -4.4, 0.8); note('process 較 heavy：要經過 OS', 0, -0.2, 0.6);
  cap('thread 會比較快', 'process 比較 heavy；thread 預設就 share global');
  await step(tok);                                   // @320.1 ③ 最方便：compiler directive
  bx('③ compiler directive', CO.data, 4.4, 4.6, 0, 3.2, 0.6, 0.9, 2);
  cap('③ 最方便：透過 compiler', '也是 porting 時很多人用的');
  await step(tok);                                   // @339.5 在 code 加 directive，compiler 轉成 thread
  const c = code(['#pragma ... parallel', 'for (i = 0; i < N; i++)', '  a[i] = f(a[i]);'], 4.4, 3.4, 0.45);
  c.hl(0);
  cap('在程式碼加上 compiler directive', '告訴 compiler 這塊要平行化，轉成 thread');
  await step(tok);                                   // @356.0 要有規律，compiler 才認得
  note('要很有規律，compiler 才認得出來', 4.4, 1.8);
  cap('能平行化的程式碼不可能是任何程式', '一定要很有規律');
  await step(tok);                                   // @366.9 例：for loop 處理大 array，每個 iteration 一個 thread
  c.hl(1);
  for (let k = 0; k < 4; k++) bx('i=' + k, TH[k], 3.0 + k * 0.95, 0.5, 0.6, 0.85, 0.45, 0.5, 1.5);
  cap('例：for loop 處理一個很大的 array', '每個 iteration create 一個 thread 同時做');
  await step(tok);                                   // @390.0 compiler 轉成 multithreaded program；最省力但有限制
  c.hl(-1);
  good('最省 programmer 力氣', 4.4, -0.3, 0.6);
  cap('compiler 幫你轉成 multithreaded program', '最省力，但只適用有限制的 pattern');
  await step(tok);                                   // @408.5 本課主要講 thread
  t1.mood('happy'); t2.mood('happy'); await t1.hop(tok);
  cap('這堂課主要講的是 ① thread', '（補充：③ 實務上就是 OpenMP 這類）');
  void pa; void pb; void sg;
}]);

FRAG.push(['thr-posix', 'POSIX：portability 與 pthread 的 P', async (tok) => {
  fresh([0, 5.2, 14], [0, 2.2, 0]);
  await step(tok);                                   // @417.8 Linux（POSIX）平台；API 與 system call 的概念
  const ttl = hd('POSIX 平台上的 thread', 0, 5.6);
  cap('先回想 introduction 講過的', 'API 跟 system call 的概念');
  await step(tok);                                   // @431.5 programmer 喜歡 portability：只 recompile 不改 code
  const app = bx('你的程式碼', CO.data, 0, 4.6, 0, 3, 0.6, 0.9);
  const pg = pal('programmer', '', '#f0b27a', -4.8, 3.6, 0, 0.5); pg.mood('happy');
  cap('programmer 喜歡 portability', '換平台只要 recompile，不用改 code');
  await step(tok);                                   // @449.3 怎麼做到：OS 上面還有一層 API layer
  const api = bx('API layer', CO.gold, 0, 3.4, 0, 9, 0.55, 1.1); glow(api, GOLD);
  cap('怎麼做到？', '所有 OS 上面還有一層 API layer');
  await step(tok);                                   // @461.0 各 OS 自己的 kernel、system call；API 層 interface 相同
  glow(api, null);
  const oss = [['Linux', -3.2], ['Mac', 0], ['UNIX', 3.2]].map(([n, x]) => bx(n + ' kernel', CO.os, x, 2.0, 0, 2.8, 0.7, 0.9));
  idx('下面各自用 system call 實作', 0, 1.2, 0.6);
  cap('各 OS 可以有自己的 kernel、system call', 'API 這層大家同意用完全相同的 interface');
  await step(tok);                                   // @483.0 Windows 有自己的 API
  const win = bx('Windows：自己的 API', CO.bad, 0, 0.4, 1.2, 3.4, 0.6, 0.9);
  cap('早期 Windows 是一大宗', '它有自己的 API');
  await step(tok);                                   // @492.1 open source 社群（Linux、UNIX）訂了 POSIX
  P.relabel(api, 'POSIX API');
  cap('Windows 以外，open source 社群', 'Linux、UNIX 的 developer 一起訂了一個 API');
  await step(tok);                                   // @507.6 Portable Operating System Interface：一個 standard
  hot('POSIX = Portable Operating System Interface', 0, 5.0);
  cap('POSIX = Portable OS Interface', 'OS 不同但 API 完全相同：一個 standard');
  await step(tok);                                   // @528.7 Mac、Linux 都符合：recompile 就能跑
  oss.forEach((o) => glow(o, GREEN)); pg.mood('happy');
  cap('照這個 standard 寫', 'Mac、Linux 上 recompile 就能跑');
  await step(tok);                                   // @539.0 搬到 Windows 可能要整個重寫
  glow(win, RED); pg.mood('sad');
  bad('搬到 Windows：可能整個重寫', 4.2, 0.9, 1.4);
  cap('可是搬到 Windows 就不一樣', '可能要整個重寫');
  await step(tok);                                   // @546.0 C library 屬於 POSIX；pthread 的 P 就是 POSIX
  pg.mood('happy'); remove(ttl);
  good('pthread 的 p = POSIX', 0, 5.6, 0.4);
  cap('C library 屬於 POSIX', 'Pthread 的 P 就是 POSIX：這個 standard 下的 thread API');
  void app;
}]);

FRAG.push(['thr-pt-flow', 'pthread 的流程：create → 執行 function → join', async (tok) => {
  fresh([0, 5, 14], [0, 2.2, 0]);
  await step(tok);                                   // @587.7 pthread library 使用很單純
  const main = pal('main thread', '', CO.data, -4.6, 0, 0, 0.75);
  cap('pthread library 的基本使用', '其實蠻單純的');
  await step(tok);                                   // @593.2 只讓你 create、terminate、溝通；其他自由
  const ops = code(['create', 'terminate', '溝通'], -1.0, 4.8, 0.5);
  cap('它只讓你 create、terminate thread', '加上 thread 間溝通；裡面做什麼完全自由');
  await step(tok);                                   // @615.3 最重要的 library call：pthread_create
  ops.hl(0);
  const c = code(['pthread_create(&tid, NULL, work, arg);'], 1.6, 3.4, 0.5); c.hl(0);
  cap('最重要的 library call', 'pthread_create：create 一個 thread');
  await step(tok);                                   // @627.6 create 的 thread 就是去執行一個 function
  const t = pal('thread', '', TH[0], -4.6, 0, 0.8, 0.55);
  await slide(tok, t.g, 1.6, 0, 0.8, 900);
  bx('void *work(void *arg) { … }', CO.code, 1.6, 1.6, -0.4, 4.2, 0.45, 0.6);
  cap('create 的 thread 要做什麼？', '就是去執行一個 function');
  await step(tok);                                   // @647.1 function 的 local private、global share
  idx('local：private　global：shared', 1.6, 2.3, 0.4);
  cap('function 裡的 local variable 是 private', 'function 之間的 global variable 是 share');
  await step(tok);                                   // @659.9 結束後 join：結果回傳 main thread
  c.hl(-1); const j = code(['pthread_join(tid, &ret);'], 1.6, 4.2, 0.5); j.hl(0);
  await slide(tok, t.g, -3.0, 0, 0.8, 900); main.mood('happy');
  cap('結束之後 join', '把結果回傳給 main thread');
  await step(tok);                                   // @674.6 可以同時 call 很多次 pthread_create
  const more = [1, 2, 3].map((k) => pal('thread', '', TH[k], 0.4 + k * 1.4, 0, 0.8, 0.45));
  more.forEach((m) => m.mood('happy'));
  cap('可以同時 call 很多次 pthread_create', 'create 出非常多的 thread');
}]);

FRAG.push(['thr-pt-args', 'pthread_create 的四個參數', async (tok) => {
  fresh([0, 5.2, 14], [0, 2.6, 0]);
  await step(tok);                                   // @681.9 看 argument
  const cd = code(['int pthread_create(', '    pthread_t *tid,              // ①', '    const pthread_attr_t *attr,  // ②', '    void *(*func)(void *),       // ③', '    void *arg);                  // ④'], -2.6, 5.6, 0.55);
  cap('來看 pthread_create 的 argument', '');
  await step(tok);                                   // @686.0 ① pointer：回傳 thread ID（token）
  cd.hl(1);
  const tk = bx('tid = 7', CO.code, 4.4, 4.6, 0, 1.8, 0.5, 0.6); const tkN = idx('（ID 值示意）', 4.4, 5.2);
  cap('① 一個 pointer：回傳這個 thread 的 ID', '像拿到一個 token');
  await step(tok);                                   // @700.2 之後用 token 指定是哪個 thread
  const th = pal('thread 7', '', TH[0], 4.4, 2.4, 0, 0.5);
  arr(4.4, 4.3, 4.4, 3.4, '#c08a1f');
  cap('之後就用這個 token', '指定要對哪一個 thread 做動作（例如 join）');
  await step(tok);                                   // @707.7 ② attribute：細部控制
  cd.hl(2); kill(tk); kill(th.g); remove(tkN);
  cap('② attribute', 'create 之後行為的細部控制選項');
  await step(tok);                                   // @720.7 例：綁在某個 core，L1 cache 不 share → hit rate
  const cores = [0, 1].map((k) => prop('cpu', 2.6 + k * 3, 0, 0, 0.9));
  const l1 = [0, 1].map((k) => bx('L1', '#cfe3e6', 2.6 + k * 3, 1.1, 0.8, 0.8, 0.35, 0.4));
  const t = pal('T', '', TH[1], 2.6, 1.6, 0.4, 0.4); t.mood('happy');
  cap('例：把 thread 綁在某個 core 上', '不同 core 的 L1 cache 不 share → 提高 hit rate');
  await step(tok);                                   // @751.0 OS 預設有空就跑；想給 hint 用 attribute
  const dflt = note('OS 預設：哪個 core 有空就跑', 4.1, -0.5, 1.2);
  cap('OS 預設不限制，有空的 core 就跑', '想給 OS hint，就透過 attribute');
  await step(tok);                                   // @765.1 attribute 就是 integer，每個 bit 代表 enable/disable
  const bits = code(['attr = 0 1 0 0 1 …（老師的比喻）'], 4.1, 3.2, 0.5); bits.hl(0);
  cap('老師：attribute 像一串 bit，各代表一個選項', '實際是 pthread_attr_t，用 pthread_attr_set… 設定；NULL = 預設');
  await step(tok);                                   // @796.6 ③ function pointer
  cd.hl(3); cores.forEach(kill); l1.forEach(kill); kill(t.g); bits.kill(); remove(dflt);
  const fn = bx('void *work(void *)', CO.code, 4.0, 3.6, 0, 3.2, 0.55, 0.8);
  cap('③ function pointer', '告訴它要執行哪一個 function');
  await step(tok);                                   // @809.0 ④ function 的 argument
  cd.hl(4);
  cap('④ 那個 function 的 argument', '就像拿這個 argument 去 call function');
  await step(tok);                                   // @818.5 function 通常多個參數，API 只給一個：越簡潔越好
  bad('只能給一個！', 4.0, 2.6);
  cap('function 通常不只一個參數', 'API 為了簡潔、general，只給一個');
  await step(tok);                                   // @848.7 包成 data structure，傳 pointer
  const s = bx('struct { a, b, c }', CO.data, 4.0, 1.2, 0, 2.8, 0.55, 0.8);
  arr(4.0, 1.5, 4.0, 3.3, '#c08a1f');
  cap('要很多 argument 怎麼辦？', '包成一個 data structure，把它的 pointer 傳進去');
  await step(tok);                                   // @868.0 function 裡再解開，讀出每個 member
  ['a', 'b', 'c'].forEach((m, i) => pkt(m, 3.2 + i * 0.8, 4.4, 0.6));
  cap('function 裡自己再把 structure 解開', '讀出每個 member 的值');
  await step(tok);                                   // @889.5 型別是 void*：要自己 cast，搞錯讀到亂碼
  glow(s, GOLD); note('void* → 自己 cast 回 struct；搞錯就讀到亂碼', 0, -0.4, 1.2);
  cap('型別是 void pointer，什麼都能傳', 'programmer 要自己 cast 回正確的型別');
  await step(tok);                                   // @923.6 return 也是透過 pointer
  cd.hl(-1);
  const r = pkt('return (void*) result', 4.0, 5.4, 0.4);
  cap('return 也一樣', '不能直接回傳 value，要透過 pointer');
  await step(tok);                                   // @945.2 要 call join 才拿得到 return 值
  const j = code(['pthread_join(tid, &ret);'], -2.6, 2.4, 0.5); j.hl(0);
  cap('所以要 call join', '才拿得到 return 的 pointer 值');
  await step(tok);                                   // @967.5 沒有 delete thread：function return 就結束
  kill(fn); remove(r);
  good('function return → thread 就結束（沒有 delete thread）', 0, 0.6, 1.2);
  cap('沒有所謂 delete thread', 'function return，thread 就結束了');
}]);

FRAG.push(['thr-pt-hello', 'Hello world：for 迴圈 create，再 join', async (tok) => {
  fresh([0, 5.5, 14], [0, 2.6, 0]);
  const cd = code(['pthread_t threads[N];', 'for (t = 0; t < N; t++)', '  pthread_create(&threads[t], NULL,', '                 PrintHello, (void *)t);', 'void *PrintHello(void *id) {', '  long tid = (long)id;  printf("Hello World! %ld", tid); }', 'for (t = 0; t < N; t++)', '  pthread_join(threads[t], NULL);'], -2.8, 6.0, 0.48);
  await step(tok);                                   // @982.7 example：main program print Hello World
  const main = pal('main', '', CO.data, -5.0, 0, 0, 0.7);
  cap('簡單的 example', '每個 thread 去 print Hello World');
  await step(tok);                                   // @991.1 用 array 存 thread ID，可 create 任意數量
  cd.hl(0);
  const slots = [0, 1, 2, 3].map((k) => bx('–', '#efe7d8', 2.6 + k * 0.9, 1.9, 0, 0.8, 0.4, 0.5));
  idx('threads[ ]', 0.9, 1.9);
  cap('用一個 array 存 thread ID', '可以 create 任意數量的 thread');
  await step(tok);                                   // @998.5 user thread 多，不代表 map 到不同 kernel thread
  const many = note('user thread 多 ≠ kernel thread 多', 4.0, 1.1);
  cap('user thread 通常可以很多', '不代表會 map 到不同的 kernel thread');
  await step(tok);                                   // @1012.5 for loop create 很多 thread
  cd.hl(2); remove(many);
  const ts = [];
  for (let k = 0; k < 4; k++) { const b = pal('T' + k, '', TH[k], -2.6 + k * 1.6, 0.6, 0.8, 0.45); ts.push(b); P.relabel(slots[k], k); await slide(tok, b.g, -2.6 + k * 1.6, 0, 0.8, 360); }
  cap('用 for loop', 'create 出很多 thread');
  await step(tok);                                   // @1021.8 argument 傳 thread ID，要轉成 void* 傳入
  cd.hl(3);
  ts.forEach((b, k) => b.set('(void*)' + k));
  cap('argument 傳的就是 thread 的 ID', '要先轉成 void* 才能傳進去');
  await step(tok);                                   // @1033.8 function 裡對它做 cast
  cd.hl(5);
  ts.forEach((b, k) => b.set('tid=' + k));
  cap('讀進 function 時', '要把它 cast 回來；pthread 一定要這麼做');
  await step(tok);                                   // @1042.5 每個 thread 執行同一行，但 thread ID 不同
  ts.forEach((b, k) => { b.mood('happy'); bub('Hello World! ' + k, 5.0, 1.2 - k * 0.8, 0.8); });   // 印出來的一行行輸出，排在右邊
  cap('每個 thread 都執行這一行', '但印出來的 thread ID 不同');
  await step(tok);                                   // @1057.3 基本上就是 create 然後 join 回來
  cd.hl(-1);
  cap('pthread 基本上要用的', '就是 create，然後 join 回來');
  await step(tok);                                   // @1066.8 join 主要目的：讀回 return 值
  cd.hl(7);
  cap('join 最主要的目的', '把 thread 的 return 值讀回來');
  await step(tok);                                   // @1079.0 for loop 一個一個 join
  cd.hl(6);
  for (let k = 0; k < 4; k++) { await slide(tok, ts[k].g, -5.0 + 0.4 * k, 0, 0.8, 300); kill(ts[k].g); }
  main.mood('happy');
  cap('寫一個 for loop 一個一個 join', '把每個 thread 的 return 值讀回來');
  await step(tok);                                   // @1088.3 model：main thread 執行非平行部分
  cd.kill(); slots.forEach(kill);
  const lane = (y) => ln(-6, y, 6, y, 0, '#c9b48e');
  lane(4.5); seg('main：非平行部分', CO.data, -6, 4.5, 3.2);
  cap('一般 thread programming 的 model', 'main thread 執行不需要平行的部分');
  await step(tok);                                   // @1098.0 平行時 create，每個 thread 不同或相同 function、不同 data
  for (let k = 0; k < 3; k++) seg('T' + k, TH[k], -2.8, 3.6 - k * 0.6, 2.6 + (k % 2) * 0.6);
  idx('fork', -2.8, 5.0);
  cap('要平行就 create thread', '執行不同或相同的 function，傳進不同的 data');
  await step(tok);                                   // @1106.0 做完 join 回來，結果取回再繼續；可動態重複
  idx('join', 0.6, 5.0); seg('main 繼續', CO.data, 0.6, 4.5, 1.8);
  for (let k = 0; k < 2; k++) seg('T' + k, TH[k + 3], 2.4, 3.6 - k * 0.6, 2.0);
  seg('main', CO.data, 4.4, 4.5, 1.6);
  cap('做完就 join 回來，把結果取回再繼續', '之後可以動態地再 create、再 join');
}]);

FRAG.push(['thr-pt-detach', '不 join 就要 detach', async (tok) => {
  fresh([0, 5, 14], [0, 2.4, 0]);
  await step(tok);                                   // @1120.0 create 之後不讀回資料 → 不會 call join
  const main = pal('main', '', CO.data, -4.6, 0, 0, 0.7);
  const a = pal('T0', '', TH[0], 0, 0, 0.6, 0.6);
  cap('要小心的一件事', 'create 之後不想讀回資料，就不會 call join');
  await step(tok);                                   // @1131.0 大部分 library 要求 call pthread_detach
  const c = code(['pthread_detach(tid);'], 3.4, 4.6, 0.5); c.hl(0);
  cap('不 call join 的話', '大部分 thread library 會要求你 call pthread_detach');
  await step(tok);                                   // @1138.0 意思：結束後直接 free resource
  cap('意思是告訴 thread library', '這個 thread 結束後，resource 直接 free 掉');
  await step(tok);                                   // @1145.6 不 call：OS 不知道未來會不會 join
  c.hl(-1); a.set('結束了'); a.mood('wow');
  const ask = hot('之後會有人 join 我嗎？', 0, 2.0);
  cap('不 call 的話，程式在 run time', 'OS 不知道你未來會不會 join');
  await step(tok);                                   // @1154.6 一直 hang 著、keep return 值；program 無法結束
  a.glow('#5a1010'); a.mood('sad'); main.mood('sad');
  bad('一直 hang 著 → 資源沒被釋放', 0, 3.0);
  cap('結束的 thread 一直 hang 在那裡', 'return 值一直 keep 著，資源要等 join 才釋放');
  await step(tok);                                   // @1167.4 好習慣：create 後要嘛 join，要嘛立刻 detach
  kill(a.g); remove(ask);
  const b = pal('T1', '', TH[1], 0, 0, 0.6, 0.6); c.hl(0);
  good('create 之後：要嘛 join，要嘛立刻 detach', 0, 4.4, 0.4);
  cap('比較好的 programming 習慣', 'create 完要嘛 join，不 join 就立刻 detach');
  await step(tok);                                   // @1183.9 結束後 OS 立刻把 memory 清乾淨
  b.set('結束'); await wt(tok, 300);
  b.g.traverse((o) => { if (o.element) o.element.style.visibility = 'hidden'; });   // 名牌先收起來，縮小時才不會疊在一起
  await anim(tok, 700, (u) => { b.g.scale.setScalar(Math.max(0.01, 1 - u)); }); kill(b.g);
  cap('它結束之後', 'OS 立刻把它用到的 memory 清乾淨');
  await step(tok);                                   // @1192.3 detach 了就永遠不能 join
  main.mood('calm');
  bad('detach 之後：永遠不能 join', 0, 2.2);
  cap('一旦 detach', '就永遠不能 join');
  await step(tok);                                   // @1198.6 main 跟 worker 沒有關聯（除了 global variable）
  const g = bx('global variable', CO.data, 0, 0.35, -1.2, 3, 0.5, 0.7);
  cap('detach 代表 main 跟這個 worker', '除了 global variable，之後不再有關聯');
  await step(tok);                                   // @1218.2 pthread 主要就這兩個；麻煩的是 synchronization
  c.kill();
  hd('pthread 主要：create、join（detach）', 0, 5.4);
  cap('pthread 主要就是這兩個', '比較麻煩的是 synchronization');
  await step(tok);                                   // @1236.4 lock / unlock 的 function，同步章再補充
  prop('lock', 3.6, 0, 0.6, 1.2);
  note('lock / unlock：講 synchronization 時再補充', 3.6, 1.4, 1.2);
  cap('pthread 也提供 lock、unlock 的 function', '講完 synchronization 章再回來補充');
  void g;
}]);

FRAG.push(['thr-java', 'Java thread：經由 JVM 對到各 OS 的 thread', async (tok) => {
  fresh([0, 5.5, 14], [0, 2.6, 0]);
  await step(tok);                                   // @1263.3 Java 有 Thread class，implement Runnable
  const jt = bx('Java Thread（class / Runnable）', TH[5], 0, 5.4, 0, 5.4, 0.6, 0.9);
  cap('Java 本來就有一個專門的 Thread class', 'implement Runnable 這個 interface');
  await step(tok);                                   // @1287.0 Java 有自己的 virtual machine，像一個 OS
  const jvm = bx('JVM（Java Virtual Machine）', CO.gold, 0, 4.1, 0, 9, 0.6, 1);
  cap('Java 有自己的 virtual machine', '它自己就像一個 OS');
  await step(tok);                                   // @1296.0 portability 比其他語言好：隔了一層 VM
  glow(jvm, GOLD);
  cap('所以 Java 的 portability 比其他語言都好', '因為中間隔了一層 virtual machine');
  await step(tok);                                   // @1304.0 同一個 Java program 可放 Windows、也可放 Linux
  glow(jvm, null);
  const kw = bx('Windows kernel', CO.os, -3.2, 1.0, 0, 3.4, 0.6, 0.9), kl = bx('Linux kernel', CO.os, 3.2, 1.0, 0, 3.4, 0.6, 0.9);
  cap('寫一個 Java program', '可以放在 Windows，也可以放在 Linux');
  await step(tok);                                   // @1311.7 裝 JVM 時選 Windows 的或 Linux（POSIX）的
  kill(jvm);
  const jw = bx('JVM for Windows', CO.gold, -3.2, 4.1, 0, 3.4, 0.6, 1), jl = bx('JVM for Linux（POSIX）', CO.gold, 3.2, 4.1, 0, 3.4, 0.6, 1);
  cap('安裝時選 Windows 的 Java machine', '或是 Linux（POSIX）的 Java machine');
  await step(tok);                                   // @1323.1 Windows JVM：Java thread → Win32 thread
  const lw = bx('Win32 thread', CO.files, -3.2, 2.55, 0, 3.0, 0.55, 0.9);
  const t1 = pal('t', '', TH[2], -6.1, 5.2, 0.9, 0.35);
  await slide(tok, t1.g, -6.1, 2.9, 0.9, 900);
  cap('Windows 的 JVM', 'Java 的 thread 會對到 Win32 thread');
  await step(tok);                                   // @1331.7 UNIX：對到 pthread
  const ll = bx('pthread', CO.files, 3.2, 2.55, 0, 3.0, 0.55, 0.9);
  const t2 = pal('t', '', TH[2], 6.1, 5.2, 0.9, 0.35);
  await slide(tok, t2.g, 6.1, 2.9, 0.9, 900);
  cap('UNIX（Linux）的 JVM', '就對到 pthread');
  await step(tok);                                   // @1342.4 Java thread → user thread library → kernel
  await Promise.all([slide(tok, t1.g, -6.1, 1.3, 0.9, 700), slide(tok, t2.g, 6.1, 1.3, 0.9, 700)]);
  cap('Java 上 create 一個 thread', '先對到那個 OS 的 user thread library，再到 kernel');
  await step(tok);                                   // @1349.2 pthread 不能跑在 Windows，Java 可以
  bad('pthread 程式 ✗ Windows', -3.2, -0.2, 1.2); good('Java 程式 ✓ 兩邊都行', 3.2, -0.2, 1.2);
  cap('pthread 沒辦法 run 在 Windows 上', '寫 Java 卻可以：隔了一層 VM');
  await step(tok);                                   // @1373.5 對到不同 OS 行為不同：one-to-one 或 many-to-many
  idx('one-to-one？', -3.2, 0.3, -0.8); idx('many-to-many？', 3.2, 0.3, -0.8);
  cap('對到不同作業系統，behavior 可能不同', '可能是 one-to-one，也可能是 many-to-many');
  await step(tok);                                   // @1392.5 JVM 幫忙控制；pthread 是 programmer 用 attribute 控制
  note('Java：JVM 控制　pthread：programmer 用 attribute 控制', 0, 6.0);
  cap('這由 JVM 幫忙控制', 'pthread 則是 programmer 自己透過 attribute 控制');
  void jt; void kw; void kl; void jw; void jl; void lw; void ll;
}]);

FRAG.push(['thr-clone', 'Linux：thread 就是 clone() 出來的 process', async (tok) => {
  fresh([0, 5, 14], [0, 2.4, 0]);
  const FL = [['file system', CO.files], ['memory space', CO.data], ['signal handlers', CO.reg]];
  await step(tok);                                   // @1411.1 Linux thread：指 kernel 怎麼管理 thread
  hd('Linux thread：kernel 怎麼管 thread', 0, 5.4);
  cap('最後講 Linux 的 thread', '這裡指的是 OS kernel 怎麼管理 thread');
  await step(tok);                                   // @1424.1 好講：因為它根本就是 process
  const lx = pal('Linux', '', CO.os, 0, 0, 0, 0.8); lx.mood('happy');
  cap('講 Linux 是因為它非常好講', '因為它根本就是 process');
  await step(tok);                                   // @1432.1 某種程度 Linux 根本不 support thread
  bub('我其實不 support thread（對 OS 本身而言）', 0, 2.2);
  cap('某種程度來講', 'Linux 根本不 support thread（對 OS 本身）');
  await step(tok);                                   // @1437.3 programmer 還是有 thread：用 pthread
  const pg = pal('programmer', 'pthread', '#f0b27a', -4.6, 0, 0, 0.6); pg.mood('happy');
  cap('programmer 還是有 thread', '因為用的是 pthread library');
  await step(tok);                                   // @1457.5 Linux 把每個 create 的 thread 當成一個 process
  kill(lx.g);
  const t = pal('thread？', '', TH[0], -1.4, 0, 0.6, 0.55);
  await wt(tok, 200); t.set('= process');
  cap('Linux 把每個 create 的 thread', '都當作一個 process');
  await step(tok);                                   // @1465.4 fork：兩人 memory 完全不相通，要 copy
  gone(t, pg);
  hd('parent', -4.4, 4.6); hd('child', 4.4, 4.6);
  const par = FL.map(([n, c], i) => bx(n, c, -4.4, 3.6 - i * 0.9, 0, 2.8, 0.6, 0.9));
  const cps = [];
  for (let i = 0; i < 3; i++) { const m = bx(FL[i][0] + '（copy）', FL[i][1], -4.4, 3.6 - i * 0.9, 0, 2.8, 0.6, 0.9); cps.push(m); await slide(tok, m, 4.4, 3.6 - i * 0.9, 0, 350); }
  bx('fork()', CO.bad, 0, 0.3, 0, 1.6, 0.5, 0.7);
  cap('fork 一個 process', '兩個人的 memory 完全不相通，要 copy');
  await step(tok);                                   // @1479.5 thread：有些 memory 是 shared 的特別 process
  cps.forEach(kill);
  cap('pthread 要的是很特別的 process', '有些 memory 是 shared 的');
  await step(tok);                                   // @1489.5 Linux 另外提供 system call：clone
  const cl = bx('clone()', CO.gold, 2.4, 0.3, 1.2, 1.8, 0.5, 0.7); glow(cl, GOLD);
  cap('Linux 另外提供一個 system call', '叫做 clone，一樣是 create process');
  await step(tok);                                   // @1501.0 引數控制哪些 segment shared、哪些不 share
  cap('clone 有比較多的 argument', '可以控制哪些 segment shared、哪些不 share');
  const sharedL = [];
  await step(tok);                                   // @1530.3 flag：file system（file handler）是否 share
  sharedL.push(ln(-3.0, 3.6, 3.0, 3.6, 0, '#c08a1f')); glow(par[0], GOLD); idx('share', 0, 3.85);
  bx('file system', CO.files, 4.4, 3.6, 0, 2.8, 0.6, 0.9);
  cap('每個 flag 定義一種資源：例如 file system', '開的 file handler 另一個人讀不讀得到');
  await step(tok);                                   // @1546.2 memory space、signal 也各有 flag
  sharedL.push(ln(-3.0, 2.7, 3.0, 2.7, 0, '#c08a1f')); glow(par[1], GOLD); idx('share', 0, 2.95);
  bx('memory space', CO.data, 4.4, 2.7, 0, 2.8, 0.6, 0.9);
  bx('signal（copy）', CO.reg, 4.4, 1.8, 0, 2.8, 0.6, 0.9);
  cap('memory space 要不要 share、signal 呢', '這些 resource 各有一個 flag');
  await step(tok);                                   // @1556.7 用 0、1 控制，create 出新的 process
  code(['flags = FS:1 VM:1 SIG:0（示意）'], 0, -1.3, 0.5).hl(0);
  cap('用 0、1 控制每個 flag', 'create 出一個新的 process');
  await step(tok);                                   // @1568.0 這就是 create thread 的方式
  good('很多 memory content 都 share → 這就是 thread', 0, 5.0, 0.4);
  cap('很多 memory content share', '這就是 Linux create thread 的方式');
  await step(tok);                                   // @1574.3 kernel 不必另外寫 code 管 thread
  note('kernel 不另外管 thread：process ＋ 不同的 share 設定', 0, -2.1, 1.6);
  cap('kernel 不需要另外寫 code 管理 thread', '它就是 process，只是 share 設定不同');
}]);

// ════════ Z9OPaNpNwXk（第 16B 講 Threading Issues：fork/exec、cancellation、signal、thread pool） ════════
FRAG.push(['thr-16b-intro', 'Threading issues：thread 都屬於同一個 process', async (tok) => {
  fresh([0, 5, 14], [0, 2.2, 0]);
  await step(tok);                                   // @16.4 create thread 之後，和 process 不同的細節
  hd('Threading issues', 0, 5.3);
  const z = zone('同一個 process', 2.6, 0.02, 0, 5.4, 2.6, '#f3e6c8'); zname(z, 5.45, 0.05, 0);
  const ts = [0, 1, 2].map((i) => pal('T' + (i + 1), '', TH[i], 1.0 + i * 1.6, 0, 0.2, 0.55));
  cap('create 了 thread 之後', '有些行為跟 process 不一樣，要注意');
  await step(tok);                                   // @17.4 process 之間沒關聯；thread 屬於同一個 process
  const pa = pal('P1', '', CO.proc, -5.0, 0, 0, 0.6), pb = pal('P2', '', CO.proc, -2.8, 0, 0, 0.6);
  idx('process：彼此沒關聯', -3.9, 2.0); hot('thread：屬於同一個 process', 2.6, 2.2);
  cap('process 彼此沒有關聯', '但 thread 都屬於同一個 process');
  await step(tok);                                   // @21.0 課本列了六個，只講其中四個
  code(['① fork / exec', '② cancellation', '③ signal handling', '④ thread pool'], 0, 4.6, 0.45);
  cap('課本列了六個', '這裡只講比較基本的其中四個');
  void z; void ts; void pa; void pb;
}]);

FRAG.push(['thr-16b-fork', '在 thread 裡呼叫 fork()', async (tok) => {
  fresh([0, 5.2, 14], [0, 2.2, 0]);
  await step(tok);                                   // @48.1 第一個：process 可以 fork
  hd('fork()', 0, 5.6);
  cap('第一個問題：我們知道 process 可以 fork', '');
  await step(tok);                                   // @56.7 process 有兩個 thread，某一個 thread call fork
  const z0 = zone('P0', -4.2, 0.02, 0, 3.4, 2.6, '#f3e6c8');
  const a = pal('T1', '', TH[0], -5.0, 0, 0.2, 0.55), b = pal('T2', '', TH[1], -3.4, 0, 0.2, 0.55);
  bub('fork()', -3.4, 1.7, 0.4); b.mood('wow');
  cap('process 本來有兩個 thread', '其中一個 thread call 了 fork，會怎樣？');
  await step(tok);                                   // @69.6 有兩種可能
  hot('兩種可能？', 0, 3.2);
  cap('有兩種可能', '');
  await step(tok);                                   // @72.2 ① fork 針對整個 process：新 process 也兩個 thread
  const z1 = zone('新 process（複製全部）', 2.0, 0.02, -1.4, 3.4, 2.0, '#d6e6f6'); zname(z1, 2.0, 1.5, -2.5, false);
  const c1 = pal('T1′', '', TH[0], 1.2, 0, -1.2, 0.45), c2 = pal('T2′', '', TH[1], 2.8, 0, -1.2, 0.45);
  cap('第一種：fork 針對整個 process', '原本兩個 thread，新的也要兩個');
  await step(tok);                                   // @91.0 ② 只複製 call fork 的那個 thread
  const z2 = zone('新 process（只有呼叫者）', 5.2, 0.02, 1.4, 2.6, 2.0, '#d8e6cf'); zname(z2, 5.2, 0.05, 2.7, false);
  const c3 = pal('T2′', '', TH[1], 5.2, 0, 1.6, 0.45); c3.mood('happy');
  cap('第二種：只在一個 thread 裡 call fork', '新 process 只包含原來那個 thread');
  await step(tok);                                   // @105.0 Linux 比較容易這麼做：本來就把 thread 當 process
  note('Linux：本來就把 thread 當 process → 較像第二種', 3.6, 3.6);
  cap('Linux 比較容易這麼做', 'OS 看到的就只是那個 thread（process）');
  await step(tok);                                   // @125.1 process 跟 thread 是兩個 level，可能左也可能右
  cap('process 跟 thread 是兩個 level', 'fork 的 behavior 可能是左邊或右邊');
  await step(tok);                                   // @137.7 沒有對錯；OS 可兩種都 support 讓你選，或只 support 一種
  good('沒有對錯：兩種都 support，或只 support 一種', 0, 4.6);
  cap('系統設計沒有對錯，也都辦得到', 'OS 可以兩種都支援讓你選，或只支援一種');
  await step(tok);                                   // @160.0 寫程式時要查 OS 的規格
  const pg = pal('programmer', '', '#f0b27a', -4.6, 2.6, -1.0, 0.45); pg.mood('wow');
  cap('寫程式時要試試看或查 OS 的規格', '才知道你的 fork 是哪一種');
  void z0; void a; void z1; void c1; void c2; void z2;
}]);

FRAG.push(['thr-16b-exec', 'exec()：整個 process 換掉', async (tok) => {
  fresh([0, 5, 14], [0, 2.2, 0]);
  await step(tok);                                   // @180.0 exec 比較沒問題
  hd('exec()', 0, 5.3);
  const z = zone('process', 0, 0.02, 0, 5, 2.6, '#f3e6c8'); zname(z, 2.65, 0.05, 0);
  const ts = [0, 1, 2].map((i) => pal('T' + (i + 1), '', TH[i], -1.6 + i * 1.6, 0, 0.2, 0.55));
  cap('exec 就比較沒有問題', '');
  await step(tok);                                   // @185.2 exec 是 replace：整個 process 換掉
  bub('exec("new_prog")', -1.6, 1.8, 0.4);
  await anim(tok, 700, (u) => ts.forEach((t) => t.g.scale.setScalar(Math.max(0.01, 1 - u))));
  ts.forEach((t) => kill(t.g));
  const np = pal('new program', '', TH[4], 0, 0, 0.2, 0.75); np.mood('happy');
  cap('exec 的定義是 replace', '整個 process 直接換成新的程式');
  await step(tok);                                   // @195.5 原本幾個 thread OS 都不管，整個換掉
  good('原本有幾個 thread 都沒差：整個換掉', 0, 3.4);
  cap('原來有幾個 thread，OS 通常都不管', '整個換掉就對了');
  void z;
}]);

FRAG.push(['thr-16b-cancel', 'Thread cancellation：asynchronous vs deferred', async (tok) => {
  fresh([0, 5.2, 14], [0, 2.2, 0]);
  await step(tok);                                   // @202.2 另一個：cancellation
  hd('Thread cancellation', 0, 5.6);
  cap('另一個 issue：cancellation', '');
  await step(tok);                                   // @213.7 一個 thread 被 terminate，行為是什麼
  const main = pal('main', '', CO.data, -4.6, 0, 0, 0.65);
  const tg = pal('target', '', TH[1], 0, 0, 0.4, 0.65);
  bub('cancel！', -3.0, 1.8, 0.4);
  cap('一個 thread 被 terminate 掉', '它的行為會是什麼');
  await step(tok);                                   // @227.1 被結束的 thread 的 memory 要有人清掉
  tg.mood('sad');
  const mem = bx('它用的 memory', CO.stack, 0, 1.8, -0.6, 2.2, 0.45, 0.6);
  cap('被結束的 thread', '它的 memory 等資源要有人清掉');
  await step(tok);                                   // @241.4 thread library 必須 clean up
  const lib = pal('thread library', '', '#e2c98f', 4.4, 0, 0, 0.6); lib.mood('wow');
  cap('thread library 必須 clean up', '被 cancel 的 thread 的 memory content');
  await step(tok);                                   // @253.2 library 通常有兩種做法
  kill(mem); kill(main.g);
  ln(-6, 2.6, 6, 2.6, 0, '#c9b48e');
  hd('asynchronous（課本：立刻終止）', -3.3, 4.6); hd('deferred（延後到 cancellation point）', 3.3, 4.6);
  cap('library 通常有兩種做法', 'asynchronous 與 deferred cancellation');
  await step(tok);                                   // @261.5 等執行到某個地方才 clean up → 狀態一致
  const ta = pal('T', '', TH[0], -3.3, 2.75, 0, 0.45); ta.mood('sad');
  bad('課本：一砍就停，資源可能沒清乾淨', -3.3, 4.0);
  const td = pal('T', '', TH[2], 3.3, 2.75, 0, 0.45); td.mood('calm');
  good('等到安全的地方才清 → state 一致', 3.3, 4.0);
  cap('老師強調：執行到某個階段才 clean up', '容易預測、拿到 consistent 的 state');
  await step(tok);                                   // @299.7 deferred：target thread 預設幾個 cancellation point
  kill(tg.g); kill(lib.g);
  const pts = [0, 1, 2].map((k) => tag('◆ check', 'idx', 1.0 + k * 2.0, 0.4, 0.6));
  const tt = pal('target', '', TH[2], -0.8, 0, 0.4, 0.5);
  cap('deferred cancellation', 'target thread 自己預設幾個能被中斷的點');
  await step(tok);                                   // @320.5 按 Ctrl-C 砍它，仍執行到 checkpoint 才結束
  bub('Ctrl-C', -0.8, 1.6, 0.4);
  await slide(tok, tt.g, 1.0, 0, 0.4, 900); tt.mood('wow');
  await anim(tok, 500, (u) => tt.g.scale.setScalar(Math.max(0.01, 1 - u))); kill(tt.g);
  cap('就算按了 Ctrl-C 要砍它', '它仍會執行到 checkpoint 才結束 → 叫 defer');
  await step(tok);                                   // @361.0 兩個 thread 互相運作時，何時把 memory free 出來
  cap('簡單說：兩個 thread 互相運作時', '什麼時候把被 cancel 者的 memory free 掉、重新分配');
  await step(tok);                                   // @378.2 通常不立刻做：overhead 大、做到一半 → synchronization issue
  note('不立刻清：overhead 大；指令做到一半 → synchronization issue', 0, -0.6, 1.4);
  cap('通常不會立刻去做', 'overhead 大，做到一半還可能造成同步問題');
  void ta; void td; void pts;
}]);

FRAG.push(['thr-16b-signal', 'Signal handling：signal 給哪個 thread？', async (tok) => {
  fresh([0, 5.2, 14], [0, 2.2, 0]);
  await step(tok);                                   // @393.8 第三：signal handling
  hd('Signal handling', 0, 5.6);
  const z = zone('process', 0, 0.02, 0, 9.4, 2.4, '#f3e6c8'); zname(z, 4.85, 0.05, 0);
  const ts = [0, 1, 2, 3].map((i) => pal(i === 0 ? 'main' : 'T' + i, '', i === 0 ? CO.data : TH[i], -3.3 + i * 2.2, 0, 0.2, 0.55));
  cap('第三個：signal handling', '');
  await step(tok);                                   // @401.2 例：thread 呼叫 sleep 10 秒，之後 signal 通知
  const slp = bub('sleep(10)', ts[1].g.position.x, 1.6, 0.4); ts[1].mood('calm');
  cap('例：一個 thread 呼叫 sleep 10 秒', '10 秒後會有 signal 跑出來 notify 它');
  await step(tok);                                   // @418.2 process 有很多 thread：給指定的還是全部？
  const sig = pkt('signal', 0, 4.4, 0);
  const who = hot('給誰？', 0, 3.6);
  cap('一個 process 有很多 threads', 'signal 是給指定的 thread，還是全部？');
  await step(tok);                                   // @495.4 general form：先送到 process level，再決定
  await travel(tok, sig, V3(0, 4.4, 0), V3(0, 2.0, 0.6), 700);
  cap('一般的形式：signal 先送到 process level', '再由 process 決定怎麼 handle；下面四種');
  await step(tok);                                   // @511.3 ① 給當初產生它的 thread（sleep）
  await fly(tok, 'pkt', '①', V3(0, 2.0, 0.6), V3(ts[1].g.position.x + 0.75, 0.45, 0.6), 600);
  ts[1].mood('happy'); await ts[1].hop(tok);
  cap('① 送給當初產生它的那個 thread', '像 sleep：只有它被叫醒');
  await step(tok);                                   // @518.1 ② 給所有 thread：例如 terminate process（exit）
  remove(slp);
  await Promise.all(ts.map((t) => fly(tok, 'pkt', '②', V3(0, 2.0, 0.6), V3(t.g.position.x + 0.75, 0.45, 0.6), 600)));
  ts.forEach((t) => t.mood('wow'));
  cap('② 送給所有 thread', '例如有 thread 直接 terminate process（exit）：全部 kill');
  await step(tok);                                   // @538.5 ③ 給指定的某個 thread：有 thread ID 就能互傳
  ts.forEach((t) => t.mood('calm'));
  await fly(tok, 'pkt', '③ → T3', V3(ts[1].g.position.x, 0.45, 0.6), V3(ts[3].g.position.x, 0.45, 0.6), 800);
  ts[3].mood('happy');
  cap('③ 送給某個指定的 thread', 'thread 之間有 thread ID 就能互傳 signal');
  await step(tok);                                   // @566.4 ④ 沒指定：由特定的 thread（main thread）處理
  ts[3].mood('calm');
  await fly(tok, 'pkt', '④', V3(0, 2.0, 0.6), V3(ts[0].g.position.x + 0.75, 0.45, 0.6), 600);
  ts[0].mood('happy'); ts[0].glow('#0d3d20');
  cap('④ 沒說誰處理：指定一個 thread 專門接', '例如 by default 由 main thread 來 handle');
  await step(tok);                                   // @597.0 OS 要判斷：broadcast、指定、或 main thread
  remove(who);
  note('OS 要判斷：broadcast 全部？指定 thread？main thread？', 0, 3.4);
  cap('丟出 signal 時，OS 要判斷', 'broadcast 給全部、給指定的、或由 main thread 處理');
  void z;
}]);

FRAG.push(['thr-16b-pool', 'Thread pool：先建好一池 thread 重複使用', async (tok) => {
  fresh([0, 5.2, 14], [0, 2.2, 0]);
  await step(tok);                                   // @638.4 下一個：thread pool，實作常用
  hd('Thread pool', 0, 5.6);
  cap('下一個：thread pool', '實作上常常用到的技巧');
  await step(tok);                                   // @650.7 原本：需要平行時動態 create，不要時 delete
  const t = pal('T', '', TH[0], -3.6, 0, 0, 0.55);
  bub('create', -3.6, 1.7, 0.4);
  cap('原本的概念：需要平行時', '動態產生一個 thread，不要時再 delete');
  await step(tok);                                   // @665.0 不斷 create / delete → 不 efficient
  await anim(tok, 500, (u) => t.g.scale.setScalar(Math.max(0.01, 1 - u))); kill(t.g);
  const ineff = bad('一直 create、delete → 不 efficient', -3.6, 1.0);
  cap('壞處：一直 create、一直 delete', '比較不 efficient');
  await step(tok);                                   // @674.1 web server：一開始就 create 一堆 thread（pool）
  const pool = zone('pool of threads', 2.6, 0.02, 0, 6.2, 2.6, '#d6e6f6'); zname(pool, 5.85, 0.05, 0); remove(ineff);
  const ws = [];
  for (let i = 0; i < 6; i++) ws.push(pal('', '', TH[i % 8], 0.4 + (i % 3) * 2.2, 0, -0.6 + Math.floor(i / 3) * 1.3, 0.42));
  cap('像 web server：一開始就 create 一堆 thread', '放在一個 pool 裡');
  await step(tok);                                   // @684.0 控制 pool size：20 個還是 100 個
  hot('pool size：20？100？', 2.6, 2.4);
  cap('可以控制 pool 的 size', '例如 20 個還是 100 個');
  await step(tok);                                   // @690.5 執行中一直 reuse，執行不同 function
  await fly(tok, 'pkt', 'request', V3(-5.4, 1.4, 0.4), V3(0.4, 0.9, -0.6), 600); ws[0].mood('happy'); ws[0].set('f()');
  await fly(tok, 'pkt', 'request', V3(-5.4, 1.4, 0.4), V3(2.6, 0.9, -0.6), 600); ws[1].mood('happy'); ws[1].set('g()');
  cap('執行過程中一直 reuse 這些 thread', '讓它們執行不同的 function');
  await step(tok);                                   // @705.0 好處①：不用 run time create → 處理 request 更快
  good('① 不用臨時 create → 更快', -3.4, 3.4);
  cap('好處①：event 進來時不用 run time create', '處理 request 的速度更快');
  await step(tok);                                   // @724.3 好處②：控制 pool size → 控制 resource 使用量
  good('② 控制 resource 用量', -3.4, 2.7);
  cap('更主要的好處②：控制 pool size', '就控制了這台 host 的 resource 使用量');
  await step(tok);                                   // @738.0 沒限制：request 越多 thread 越多，CPU 被分光
  const many = [];
  for (let i = 0; i < 6; i++) many.push(pal('', '', TH[(i + 2) % 8], -5.4 + (i % 3) * 0.9, 0, -1.2 + Math.floor(i / 3) * 0.9, 0.32));
  many.forEach((m) => m.mood('wow'));
  bad('沒限制：thread 爆量 → CPU 被分光、系統 hang', -3.2, -0.2, 1.6);
  cap('沒有限制的話：request 越多 thread 越多', 'CPU 被分光，OS 都跑得很慢');
  await step(tok);                                   // @753.6 限 10 或 100：最多用這麼多，剩下留給 system
  many.forEach((m) => kill(m.g));
  good('最多就用這麼多，剩下留給 system', 2.6, -0.6, 1.6);
  cap('pool size 限 10 或 100', '最多就用掉這麼多，剩下留給系統');
  await step(tok);                                   // @793.1 resource control：依 core 數、memory 估算
  const cs = [0, 1].map((k) => prop('cpu', -4.6 + k * 1.6, 0, 1.6, 0.6));
  note('依 core 數、memory 用量估算 pool size', -3.6, 1.6, 1.6);
  cap('thread pool 是一種 resource control', '依幾個 core、多少 memory 估算最多能開多少');
  void pool; void cs;
}]);

FRAG.push(['thr-16b-recap', '第四章 Multithread 回顧', async (tok) => {
  fresh([0, 5, 14], [0, 2.2, 0]);
  await step(tok);                                   // @828.1 最主要：user thread 跟 kernel thread 的差別
  hd('第四章重點', 0, 5.3);
  const R = mapRig(3, 2, [null, null, null], { yU: 3.0 });
  cap('第四章最主要：', 'user thread 跟 kernel thread 的差別');
  await step(tok);                                   // @836.4 三個 mapping model 的差異
  [0, 1, 1].forEach((j, i) => R.remap(i, j, '#c08a1f'));
  idx('many-to-one ／ one-to-one ／ many-to-many', 0, 4.6);
  cap('三個 mapping model', '差異在哪裡');
  await step(tok);                                   // @839.2 Pthread、Java thread 等 use case 自己練習
  note('Pthread、Java thread：以後自己練習時再用', 4.2, 1.6);
  cap('Pthread、Java thread 這些 use case', '未來寫 thread programming 時自己練習');
  await step(tok);                                   // @860.0 在 thread 裡 call function：記得同一 process 有很多 thread
  hot('同一個 process 有很多 thread：fork、signal…要小心', 0, -0.6, 1.4);
  cap('在 thread 裡 call 這些 function 時', '要考慮同一個 process 有很多 thread');
}]);

// ════════ LsgJDGJIrJI（Multithreading Models：many-to-one / one-to-one / many-to-many） ════════
FRAG.push(['thr-neso-intro', '三種 multithreading model 與 user / kernel thread', async (tok) => {
  fresh([0, 5, 14], [0, 2.0, 0]);
  await step(tok);                                   // @0.0 今天討論 multithreading model
  hd('Multithreading models', 0, 5.3);
  cap('今天討論 multithreading model', '');
  await step(tok);                                   // @6.8 三種：many-to-one、one-to-one、many-to-many
  code(['① many-to-one', '② one-to-one', '③ many-to-many'], 4.7, 4.8, 0.5);
  cap('一共三種 model', 'many-to-one、one-to-one、many-to-many');
  await step(tok);                                   // @15.7 像 process 有 user/kernel mode，thread 也有 user/kernel thread
  const R = mapRig(3, 2, [null, null, null], { yU: 2.6 });
  cap('就像 process 有 user mode 和 kernel mode', 'thread 也有 user thread 和 kernel thread');
  await step(tok);                                   // @21.6 user thread 要在 kernel thread 上執行
  [0, 1, 1].forEach((j, i) => R.remap(i, j, '#c08a1f')); R.U.forEach((u) => u.mood('happy'));
  cap('任何 user thread 要執行', '都是在某個 kernel thread 上執行');
}]);

FRAG.push(['thr-neso-m1', 'Many-to-One：快，但一個 block 全部 block', async (tok) => {
  fresh([0, 5, 14], [0, 2.0, 0]);
  await step(tok);                                   // @26.9 many user threads → one kernel thread（4 對 1）
  const R = mapRig(4, 1, [0, 0, 0, 0]);
  hd('Many-to-One', 0, 5.3);
  cap('多個 user-level thread 對到一個 kernel thread', '這裡 4 個都 map 到同一個');
  await step(tok);                                   // @35.1 一次只有一個 map 上去：輪流執行
  for (let i = 0; i < 4; i++) { R.U.forEach((u, k) => u.glow(k === i ? '#3a3000' : null)); await wt(tok, 350); }
  R.U.forEach((u) => u.glow(null));
  cap('同一時間只有一個能 map 上去', '先跑這個，再跑下一個，輪流');
  await step(tok);                                   // @38.1 management 都在 user space，沒有 mode switching
  const us = zone('全部在 user space 管理', 0, R.yU - 0.2, -0.9, 7.2, 0.6, '#d6e6f6');
  cap('這些 thread 的管理都在 user space', '不進 kernel space，沒有 mode switching');
  await step(tok);                                   // @52.5 context switching 有，mode switching 沒有
  good('context switch：有', -3.4, 1.6); bad('mode switch（user↔kernel）：沒有', 2.2, 1.6);
  cap('從這個 thread 換到那個：有 context switching', '但沒有 mode switching');
  await step(tok);                                   // @62.7 優點：creation、context switch 很快
  R.U.forEach((u) => u.mood('happy'));
  good('優點：create、切換都很快（不用 system call）', 0, -1.4, 1.2);
  cap('優點：thread creation、context switching 很快', '在 user space 做，不需要 system call');
  await step(tok);                                   // @74.4 缺點：blocking issue，一個 block 整個 process block
  R.U[0].mood('sad'); R.U[0].glow('#5a1010'); R.K[0].glow('#5a1010');
  await wt(tok, 400); R.U.forEach((u) => u.mood('sad'));
  cap('缺點：blocking issue', '一個 thread block，整個 process 都 block');
  await step(tok);                                   // @107.7 kernel 不知道它分成 threads，只當一個 process
  const kb = bub('我只看到一個 process', R.kx(0) + 2.4, 1.2, 0.4);
  cap('因為 kernel 根本不知道', '它以為這只是一個 process，不知道裡面分成 threads');
  await step(tok);                                   // @119.0 no parallelism：一次只有一個 thread 能 access kernel
  remove(kb);
  bad('no parallelism：一次只有一個 thread 進 kernel', 0, -0.6, 1.2);
  cap('沒有 parallelism', '一次只有一個 thread 能 access kernel');
  void us;
}]);

FRAG.push(['thr-neso-o1', 'One-to-One：真平行，但成本高、有上限', async (tok) => {
  fresh([0, 5, 14], [0, 2.0, 0]);
  await step(tok);                                   // @128.1 one-to-one：每個 thread 有自己的 kernel thread
  const R = mapRig(4, 4, [null, null, null, null]);
  hd('One-to-One', 0, 5.3);
  for (let i = 0; i < 4; i++) { R.remap(i, i); await wt(tok, 200); }
  cap('one-to-one：每個 thread', '都有一個專屬的 kernel thread');
  await step(tok);                                   // @145.0 each user thread maps to exactly one kernel thread
  const ex1 = hot('exactly one', 4.8, 1.6);
  cap('每個 user thread', '剛好對到一個 kernel thread');
  await step(tok);                                   // @163.4 優點：true parallelism，各自分開執行
  R.U.forEach((u) => u.mood('happy')); R.K.forEach((k) => k.mood('happy'));
  good('優點：true parallelism（可同時跑在多核心）', 0, -1.4, 1.2);
  cap('優點：parallelism', '每一個都可以分開、同時執行');
  await step(tok);                                   // @172.0 no blocking issue
  R.U[1].mood('sad'); R.U[1].glow('#5a1010'); R.K[1].glow('#5a1010');
  remove(ex1);
  good('一個 block，其他照跑', 3.4, 1.6, 0.8);
  cap('沒有 blocking issue', '一個 thread block 了，其他不受影響（各有 kernel thread）');
  await step(tok);                                   // @183.3 缺點：higher overhead，kernel 參與
  R.U[1].glow(null); R.K[1].glow(null); R.U[1].mood('calm');
  bad('缺點：kernel 也要參與 → overhead 高', 0, -0.6, 1.2);
  cap('缺點：higher overhead', '建立 thread 時 kernel 也要參與');
  await step(tok);                                   // @208.4 OS 可能限制 thread 最大數量（例：100）
  const ex = pal('U5', '', TH[4], 5.4, R.yU, 0, 0.5); ex.mood('sad');
  bad('上限！（例如最多 100 個，示意）', 5.0, 4.6);
  cap('OS 可能限制 thread 的最大數量', '例如假設最多只能有 100 個 kernel thread');
  await step(tok);                                   // @231.4 creation、context switching 較貴：有 mode change
  note('create、切換都要 mode change → 較貴', -3.4, 1.6, 0.8);
  cap('thread creation 與 context switching 比較貴', '因為有 mode change（多對一沒有）');
}]);

FRAG.push(['thr-neso-mm', 'Many-to-Many：彈性最好，但最複雜', async (tok) => {
  fresh([0, 5, 14], [0, 2.0, 0]);
  await step(tok);                                   // @240.2 many-to-many
  const R = mapRig(4, 3, [null, null, null, null]);
  hd('Many-to-Many', 0, 5.3);
  cap('下一個 multithreading model：many-to-many', '');
  await step(tok);                                   // @246.6 多個 user thread → 較少或相等數量的 kernel thread
  [0, 1, 2, 0].forEach((j, i) => R.remap(i, j));
  cap('多個 user thread map 到', '較少或相等數量的 kernel thread');
  await step(tok);                                   // @263.6 kernel thread 不會比 user thread 多
  const le = idx('kernel thread 數 ≤ user thread 數', 0, -0.6, 1.2);
  cap('kernel thread 的數量', '不會比 user thread 多');
  await step(tok);                                   // @271.0 優點：true parallelism，多核心
  R.K.forEach((k) => k.mood('happy'));
  good('優點：true parallelism', 0, -1.4, 1.2);
  cap('優點：true parallelism', '多個 thread 可以跑在多個 core 上');
  await step(tok);                                   // @281.2 no blocking issue：其他用別的 kernel thread
  R.U[1].mood('sad'); R.U[1].glow('#5a1010'); R.K[1].glow('#5a1010');
  R.remap(3, 2); R.U[3].mood('happy');
  cap('沒有 blocking issue', '一個 block 了，其他用別的 kernel thread 繼續');
  await step(tok);                                   // @290.6 scalability 比 one-to-one 好：可以 assign 給任一個
  R.U[1].glow(null); R.K[1].glow(null); R.U[1].mood('calm');
  R.remap(3, 0, '#c08a1f'); await wt(tok, 300); R.remap(3, 2, '#c08a1f');
  cap('scalability 比 one-to-one 好', '一個 thread 可以被 assign 到任何一個 kernel thread');
  await step(tok);                                   // @303.0 缺點：設計實作複雜、scheduling 難
  remove(le);
  bad('缺點：設計、實作複雜；scheduling 難', 0, -0.6, 1.2);
  cap('缺點：設計與實作比較複雜', 'thread scheduling 也比較難');
  await step(tok);                                   // @310.8 creation、context switching 仍貴
  note('kernel 參與、有 mode switching → creation、切換仍貴', 0, 5.8, -0.4);
  cap('thread creation、context switching 一樣貴', 'kernel 也參與、有 mode switching');
}]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '作業系統・第 3 章',
    title: 'Thread 與並行',
    color: 'var(--os)',
    modes: [
      { id: 'anatomy', name: 'Thread vs Process', enter: enterAnatomy },
      { id: 'models', name: 'Multithreading models', enter: enterModels },
      { id: 'pthread', name: 'pthread create / join', enter: enterPthread },
      { id: 'clone', name: 'Linux clone()', enter: enterClone },
      { id: 'amdahl', name: 'Amdahl\'s law', enter: enterAmdahl },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: [
      'thread-vs-process', 'thread-benefits', 'concurrency-parallelism', 'amdahl',
      'user-kernel-threads', 'mt-models',
      'shm-three-ways', 'posix-api', 'pthread-create-args', 'pthread-hello-join', 'pthread-detach', 'java-thread-jvm', 'linux-clone',
    ].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); modeGen++; },
  };
}
