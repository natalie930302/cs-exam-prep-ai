// 作業系統 第3章：Thread 與並行（thread vs process、multithreading models、user/kernel threads、
// Amdahl's law、shared-memory programming、POSIX pthread create/join/detach、Java thread、Linux clone）。
// 場景依清大周志遠《作業系統》第 16A 講的段落與例子；課本＝恐龍書（Silberschatz）Ch4。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
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
    am.cap.position.y = (isFinite(lim) ? Math.min(lim * H, 5) : 5) - 1; am.capL.position.y = am.cap.position.y + 1.4; txt(am.capL, isFinite(lim) ? '上限 ×' + lim.toFixed(2) : '無上限（S = 0）');
    // time bar: total length 6 at N = 1
    const L = 6, ls = am.S * L, lp = (1 - am.S) * L / am.N;
    am.timeS.scale.x = Math.max(0.01, ls); am.timeS.position.x = -3 + ls / 2;
    am.timeP.scale.x = Math.max(0.01, lp); am.timeP.position.x = -3 + ls + lp / 2;
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
    const opts = [...p.opts].sort(() => Math.random() - 0.5);
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
    const oss = [['Linux', -3.2], ['Mac', 0], ['UNIX', 3.2]].map(([n, x]) => cube(n + '：自己的 kernel、system call', COL.os, [3, 0.9, 1], x, 2.3, 0));
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
    for (let t = 0; t < 4; t++) { tag('Hello from ' + t, 'idx', -0.6 + t * 1.6, 2.9 + (t % 2) * 0.35); }
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
    say('library 不知道你未來會不會 join', '資源一直 hang 著，program 也結束不了');
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
    move(t1, -3, 4.0, 0.8); move(t2, 3, 4.0, 0.8); await W(tok, 1600);
    move(t1, -3, 2.6, 0.8); move(t2, 3, 2.6, 0.8);
    say('Windows → Win32 thread；UNIX → pthread', '同一份 Java 程式兩邊都能跑');
    await W(tok, 2600);
    move(t1, -3, 1.2, 0.8); move(t2, 3, 1.2, 0.8);
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
    ],
    stop() { stopTimer(); modeGen++; },
  };
}
