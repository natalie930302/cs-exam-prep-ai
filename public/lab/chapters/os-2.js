// 作業系統 第2章：Process 管理（program vs process、memory layout、PCB、狀態與 queue、
// long/short/mid-term scheduler、context switch、fork/exec/wait、copy-on-write、IPC）。
// 場景依清大周志遠《作業系統》第 6B、8A、8B 講的段落與例子；課本＝恐龍書（Silberschatz）Ch3。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;

  // ───────────────────────── 共用小工具 ─────────────────────────
  let timer = null;
  const stopTimer = () => { clearInterval(timer); timer = null; };
  let modeGen = 0, busyG = -1;
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', RED = '#5a1010';
  const COL = { cpu: '#4b9ee2', io: '#dd8238', os: '#9b7ef4', user: '#2fc092', mem: '#c9b48e', idle: '#d8cfc0', bad: '#d64545', gold: '#c08a1f', disk: '#5c7a4a', paper: '#e9dcc4' };
  const PC_ = ['#4b9ee2', '#e55a9b', '#2fc092', '#c08a1f', '#9b7ef4', '#31aab0', '#dd8238', '#5c7a4a'];
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

  // ───────────────────────── 五狀態圖（課本 Fig. 3.2） ─────────────────────────
  const ST = { new: [-5.2, 4.8], ready: [-2.8, 2.7], running: [2.8, 2.7], waiting: [0, 0.6], terminated: [5.2, 4.8] };
  const ST_ZH = { new: 'new', ready: 'ready', running: 'running', waiting: 'waiting', terminated: 'terminated' };
  const TRANS = [
    ['new', 'ready', 'admitted'], ['ready', 'running', 'scheduler dispatch'], ['running', 'ready', 'interrupt'],
    ['running', 'waiting', 'I/O or event wait'], ['waiting', 'ready', 'I/O or event completion'], ['running', 'terminated', 'exit'],
  ];
  function drawStates() {
    const S = {};
    for (const k in ST) S[k] = cube(ST_ZH[k], k === 'running' ? COL.cpu : k === 'waiting' ? COL.io : k === 'ready' ? COL.user : COL.paper, [2.4, 0.8, 1], ST[k][0], ST[k][1], -0.6);
    const off = { 'ready>running': [0, 0.3], 'running>ready': [0, -0.3] };
    for (const [a, b, n] of TRANS) {
      const [x1, y1] = ST[a], [x2, y2] = ST[b]; const o = off[a + '>' + b] || [0, 0];
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
      arrow(x1 + ux * 1.35, y1 + uy * 0.55 + o[1], x2 - ux * 1.35, y2 - uy * 0.55 + o[1], '#8a7a5c', -0.6);
      tag(n, 'idx', (x1 + x2) / 2 + (a === 'waiting' ? -1.3 : a === 'running' && b === 'waiting' ? 1.4 : 0), (y1 + y2) / 2 + o[1] * 1.8 + (a === 'new' || b === 'terminated' ? 0.35 : 0), -0.6);
    }
    return S;
  }
  const slotPos = (state, k) => { const [x, y] = ST[state]; return [x - 0.75 + (k % 4) * 0.5, y + 0.75 + Math.floor(k / 4) * 0.5, 0.2]; };

  // ───────────────────────── 模式 1：狀態圖 ─────────────────────────
  const sm = { procs: [], next: 1, sel: null };
  const ALLOWED = Object.fromEntries(TRANS.map(([a, b, n]) => [a + '>' + b, n]));
  function enterStates() {
    fresh([0, 3.2, 14.5], [0, 2.8, 0]);
    sm.procs = []; sm.next = 1; sm.sel = null;
    sm.S = drawStates();
    controls('<button class="primary" id="mNew">建立 process</button><select id="mSel"></select>'
      + '<button id="mAdmit">admit</button><button id="mDisp">dispatch</button><button id="mInt">interrupt</button><button id="mIO">等 I/O</button><button id="mDone">I/O 完成</button><button id="mExit">exit</button>');
    on('mNew', () => smNew());
    const go = (from, to) => () => smGo(from, to);
    on('mAdmit', go('new', 'ready')); on('mDisp', go('ready', 'running')); on('mInt', go('running', 'ready')); on('mIO', go('running', 'waiting')); on('mDone', go('waiting', 'ready')); on('mExit', go('running', 'terminated'));
    $('mSel').onchange = (e) => { sm.sel = Number(e.target.value); smState(); };
    log('按「建立 process」，再選一個 process 做狀態轉換。只有 1 顆 CPU：running 最多一個。');
    smState();
  }
  function smLayout() {
    const cnt = {};
    sm.procs.forEach((p) => { if (p.state === 'gone') return; const k = cnt[p.state] = (cnt[p.state] || 0); cnt[p.state]++; move(p.m, ...slotPos(p.state, k)); glow(p.m, p.id === sm.sel ? GOLD : null); });
  }
  function smSelOpts() {
    const el = $('mSel'); if (!el) return;
    const live = sm.procs.filter((p) => p.state !== 'gone');
    el.innerHTML = live.map((p) => '<option value="' + p.id + '">P' + p.id + '（' + p.state + '）</option>').join('');
    if (sm.sel !== null) el.value = sm.sel;
  }
  function smNew() {
    if (sm.procs.filter((p) => p.state !== 'gone').length >= 8) { log('最多 8 個 process（畫面放不下）。', true); return; }
    const id = sm.next++;
    const [x, y, z] = slotPos('new', sm.procs.filter((p) => p.state === 'new').length);
    const m = cube('P' + id, PC_[id % 8], [0.42, 0.42, 0.42], x, y, z, 3);
    sm.procs.push({ id, state: 'new', m });
    sm.sel = id; smSelOpts(); smLayout();
    log('P' + id + ' 被 create：狀態 new（還在 disk 上，等著進 memory）。');
    smState();
  }
  function smGo(from, to) {
    const p = sm.procs.find((q) => q.id === sm.sel && q.state !== 'gone');
    if (!p) { log('先建立並選一個 process。', true); return; }
    const key = p.state + '>' + to;
    if (p.state === 'terminated') { log('P' + p.id + ' 已經 terminated，不能再轉換。', true); return; }
    if (p.state !== from && ALLOWED[key]) { log('這個按鈕是 ' + from + ' → ' + to + '；P' + p.id + ' 現在是 ' + p.state + '，要用「' + ALLOWED[key] + '」那個按鈕。', true); return; }
    if (!ALLOWED[key]) {
      const why = p.state === 'waiting' && to === 'running' ? 'waiting 的 process 等到 I/O 完成只能回 ready，要再被 dispatch 才能 running。'
        : p.state === 'ready' && to === 'waiting' ? '沒在 CPU 上執行，就不會發出 I/O request；只有 running 才能進 waiting。'
          : p.state === 'new' ? 'new 只能被 admit 進 ready。'
            : p.state === to ? 'P' + p.id + ' 已經是 ' + to + ' 了。'
              : '這個按鈕是 ' + from + ' → ' + to + '；P' + p.id + ' 現在是 ' + p.state + '，五狀態圖沒有 ' + p.state + ' → ' + to + '。';
      log('不行：' + why, true); return;
    }
    if (to === 'running' && sm.procs.some((q) => q.state === 'running')) { log('只有一顆 CPU，已經有 process 在 running；先讓它 interrupt / 等 I/O / exit。', true); return; }
    p.state = to;
    log('P' + p.id + '：' + key.replace('>', ' → ') + '（' + ALLOWED[key] + '）');
    const g = modeGen;
    if (to === 'terminated') setTimeout(() => { if (g === modeGen && p.state === 'terminated') { fly(p.m); p.state = 'gone'; smSelOpts(); smLayout(); smState(); } }, 1200);
    smSelOpts(); smLayout(); smState();
  }
  function smState() {
    const live = sm.procs.filter((p) => p.state !== 'gone');
    const by = (s) => live.filter((p) => p.state === s).map((p) => 'P' + p.id).join(' ') || '—';
    setState('Process 狀態', [['new', by('new')], ['ready', by('ready')], ['running', by('running')], ['waiting', by('waiting')], ['terminated', by('terminated')]],
      'new＝disk 上剛 create；ready＝在 memory 等 CPU<br>running＝在 CPU 上；waiting＝等 I/O 或事件');
  }

  // ───────────────────────── 模式 2：fork() 樹 ─────────────────────────
  // ops: 每個 process 依序執行；cond(r) 為真才 fork（r = 前面每次 fork 的回傳值）
  const FORKS = {
    two: { name: 'fork(); fork();', lines: ['fork();', 'fork();', 'printf("hi");'], ops: [{}, {}] },
    loop: { name: 'for (i = 0; i < n; i++) fork();', lines: ['for (i = 0; i < n; i++)', '  fork();', 'printf("hi");'], ops: null },
    ifc: { name: 'if (fork() == 0) fork();', lines: ['if (fork() == 0)', '  fork();', 'printf("hi");'], ops: [{}, { c: (r) => r[0] === 0 }] },
    and: { name: 'fork() && fork();', lines: ['fork() && fork();', 'printf("hi");'], ops: [{}, { c: (r) => r[0] > 0 }] },
    or: { name: 'fork() || fork();', lines: ['fork() || fork();', 'printf("hi");'], ops: [{}, { c: (r) => r[0] === 0 }] },
    mix: { name: 'if (fork() > 0) fork(); fork();', lines: ['if (fork() > 0)', '  fork();', 'fork();', 'printf("hi");'], ops: [{}, { c: (r) => r[0] > 0 }, {}] },
  };
  const fk = { kind: 'two', n: 3 };
  function forkOps() { return fk.kind === 'loop' ? Array.from({ length: fk.n }, () => ({})) : FORKS[fk.kind].ops; }
  // returns events [{step, parent, child}] and the process list
  function simulateFork(ops, basePid = 100) {
    let next = basePid + 1;
    const procs = [{ pid: basePid, parent: null, r: [], from: 0, depth: 0 }];
    const events = [];
    for (let i = 0; i < ops.length; i++) {
      const cur = procs.filter((p) => p.from <= i);
      for (const p of cur) {
        if (ops[i].c && !ops[i].c(p.r)) { p.r[i] = undefined; continue; }
        const ch = { pid: next++, parent: p.pid, r: [...p.r], from: i + 1, depth: p.depth + 1 };
        ch.r[i] = 0; p.r[i] = ch.pid;
        procs.push(ch); events.push({ step: i, parent: p.pid, child: ch.pid });
      }
    }
    return { procs, events };
  }
  function layoutTree(procs) {
    // leaves left to right; parent above its first child …last child, children ordered by creation
    const kids = {}; procs.forEach((p) => { if (p.parent !== null) (kids[p.parent] = kids[p.parent] || []).push(p.pid); });
    const pos = {}; let leaf = 0;
    const rootPid = procs[0].pid;
    function walk(pid, d) {
      const ks = kids[pid] || [];
      ks.forEach((k) => walk(k, d + 1));
      pos[pid] = ks.length ? { x: (pos[ks[0]].x + pos[ks[ks.length - 1]].x) / 2, d } : { x: leaf++, d };
    }
    walk(rootPid, 0);
    return { pos, leaves: leaf, depth: Math.max(...Object.values(pos).map((p) => p.d)) };
  }
  async function drawForkTree(tok, ops, msStep, cx = 1.8, width = 8) {
    const { procs, events } = simulateFork(ops);
    const L = layoutTree(procs);
    const sx = L.leaves > 1 ? width / (L.leaves - 1) : 0, dy = Math.min(1.4, 5 / Math.max(1, L.depth));
    const P = (pid) => [cx - width / 2 + L.pos[pid].x * sx + (L.leaves > 1 ? 0 : width / 2), 5.6 - L.pos[pid].d * dy];
    const nodes = {};
    const root = procs[0].pid;
    nodes[root] = cube(String(root), PC_[0], [0.62, 0.42, 0.5], ...P(root), 0);
    for (let i = 0; i < ops.length; i++) {
      const ev = events.filter((e) => e.step === i);
      if (!ev.length) { say('第 ' + (i + 1) + ' 個 fork：條件不成立，沒人 fork', ''); await W(tok, msStep); continue; }
      for (const e of ev) {
        const [x1, y1] = P(e.parent), [x2, y2] = P(e.child);
        line(x1, y1 - 0.22, 0, x2, y2 + 0.22, 0, '#8a7a5c');
        nodes[e.child] = cube(String(e.child), PC_[(i + 1) % 8], [0.62, 0.42, 0.5], x2, y2, 0, 2);
        glow(nodes[e.parent], GOLD);
      }
      say('第 ' + (i + 1) + ' 個 fork：' + ev.length + ' 個 process 各生一個', '現在共 ' + (1 + events.filter((e) => e.step <= i).length) + ' 個 process');
      await W(tok, msStep);
      Object.values(nodes).forEach((m) => glow(m, null));
    }
    return { procs, events };
  }
  function enterFork() {
    fresh([0, 3.6, 14], [0, 3.2, 0]);
    controls('<select id="fKind">' + Object.keys(FORKS).map((k) => '<option value="' + k + '">' + FORKS[k].name + '</option>').join('') + '</select>'
      + '<label>n = <input id="fN" type="number" min="1" max="4" value="' + fk.n + '"></label><button class="primary" id="fRun">執行</button>');
    $('fKind').value = fk.kind;
    $('fKind').onchange = (e) => { fk.kind = e.target.value; clearLog(); enterFork(); };
    $('fN').onchange = (e) => { const v = Number(e.target.value); if (!(v >= 1 && v <= 4)) log('n 限 1～4（2⁴ = 16 個 process 已經很擠）。', true); fk.n = Math.max(1, Math.min(4, v || 3)); if (fk.kind !== 'loop') log('n 只對 for 迴圈那一題有用。', true); };
    on('fRun', () => run(() => runFork()));
    const F = FORKS[fk.kind];
    const cd = code((fk.kind === 'loop' ? F.lines.map((s) => s.replace('n', String(fk.n))) : F.lines), -5.2, 1.6, 0.45);
    void cd;
    log('fork()：parent 拿到 child 的 PID（> 0），child 拿到 0。數字是 PID，root 從 100 開始。');
    if (fk.kind === 'and') log('&& 短路：child 拿到 0（false）就不會執行第二個 fork。');
    if (fk.kind === 'or') log('|| 短路：parent 拿到 PID（true）就不會執行第二個 fork。');
    setState(F.name, [['process 數', '?'], ['printf 次數', '?']], '先猜，再按「執行」');
  }
  async function runFork(tok) {
    const F = FORKS[fk.kind];
    lab.clear();
    code((fk.kind === 'loop' ? F.lines.map((s) => s.replace('n', String(fk.n))) : F.lines), -5.2, 1.6, 0.45);
    const res = await drawForkTree(tok, forkOps(), tok === undefined ? 900 : 1500);
    const n = res.procs.length;
    say('最後共 ' + n + ' 個 process', 'printf 印出 ' + n + ' 次');
    setState(F.name, [['process 數', String(n)], ['printf 次數', String(n)], ['新建立的', String(n - 1)]],
      res.procs.map((p) => p.pid + '：' + p.r.map((v) => v === undefined ? '－' : v === 0 ? '0' : v).join(', ')).slice(0, 8).join('<br>'));
    log('每個 process 依序列出它每次 fork() 的回傳值（－ 表示沒有執行那個 fork）。');
  }

  // ───────────────────────── 模式 3：Context switch（課本 Fig. 3.4） ─────────────────────────
  const cs = { cur: 0, regs: [{ pc: 100, r1: 7 }, { pc: 300, r1: 42 }], switches: 0, busy: false };
  function enterCtx() {
    fresh([0, 5, 14], [0, 2.4, 0]);
    Object.assign(cs, { cur: 0, regs: [{ pc: 100, r1: 7 }, { pc: 300, r1: 42 }], switches: 0 });
    cs.cpu = cube('CPU', COL.cpu, [2.6, 1, 1.4], 0, 0.5, 0);
    cs.pcb = [cube('PCB₀', PC_[0], [2.2, 1.6, 1], -4.6, 0.8, 0), cube('PCB₁', PC_[1], [2.2, 1.6, 1], 4.6, 0.8, 0)];
    cs.pl = [tag('', 'idx', -4.6, 2), tag('', 'idx', 4.6, 2)];
    cs.reg = [cube('PC', '#ffffff', [1, 0.45, 0.6], -0.6, 1.3, 0.4), cube('r1', '#ffffff', [1, 0.45, 0.6], 0.6, 1.3, 0.4)];
    cs.who = tag('', 'ptr alt', 0, 2.3);
    cs.ovh = tag('', 'ptr', 0, -0.3, 1.2);
    controls('<button class="primary" id="cRun">執行一段</button><button id="cSw">interrupt → context switch</button><button id="cReset">重來</button>');
    on('cRun', () => run(() => ctxRun()));
    on('cSw', () => run(() => ctxSwitch()));
    on('cReset', () => { clearLog(); enterCtx(); });
    log('CPU 只有一套 register；換 process 時要把目前的 state 存進它的 PCB，再載入另一個的 PCB。');
    ctxDraw();
  }
  function ctxDraw() {
    const r = cs.regs[cs.cur];
    relabel(cs.reg[0], 'PC=' + r.pc); relabel(cs.reg[1], 'r1=' + r.r1);
    cs.reg.forEach((m) => tint(m, PC_[cs.cur]));
    txt(cs.who, 'CPU 在跑 P' + cs.cur);
    txt(cs.pl[0], cs.cur === 0 ? '（P0 執行中）' : '存著 PC=' + cs.regs[0].pc + '、r1=' + cs.regs[0].r1);
    txt(cs.pl[1], cs.cur === 1 ? '（P1 執行中）' : '存著 PC=' + cs.regs[1].pc + '、r1=' + cs.regs[1].r1);
    txt(cs.ovh, cs.switches ? 'context switch ' + cs.switches + ' 次：每次 CPU 都沒在做 user 的事' : '');
    setState('Context switch', [['執行中', 'P' + cs.cur], ['PC', String(r.pc)], ['r1', String(r.r1)], ['已切換', cs.switches + ' 次']],
      '存 state 進 PCB₍舊₎ → 載入 PCB₍新₎<br>這段時間是純 <span class="no">overhead</span>（系統沒做有用的事）');
  }
  async function ctxRun(tok) {
    const r = cs.regs[cs.cur];
    for (let k = 0; k < 3; k++) { r.pc += 4; r.r1 += cs.cur ? -3 : 5; ctxDraw(); await W(tok, 250); }
    log('P' + cs.cur + ' 執行了 3 道指令：PC 和 register 都變了。');
  }
  async function ctxSwitch(tok) {
    const a = cs.cur, b = 1 - a;
    glow(cs.cpu, RED); txt(cs.who, 'OS：save state into PCB' + a);
    const [x0] = [a ? 4.6 : -4.6];
    const c0 = cs.reg.map((m) => { const c = cube(m.userData.lbl.element.textContent, PC_[a], [1, 0.45, 0.6], m.position.x, m.position.y, 0.4); return c; });
    c0.forEach((c, k) => move(c, x0, 0.9 + k * 0.5, 0.6));
    await W(tok, 900); c0.forEach((c) => kill(c));
    log('save：P' + a + ' 的 PC、register 存進 PCB' + a + '（P' + a + ' 回到 ready / waiting）。');
    cs.reg.forEach((m) => { relabel(m, ''); tint(m, '#ffffff'); });
    await W(tok, 500);
    txt(cs.who, 'OS：reload state from PCB' + b);
    const x1 = b ? 4.6 : -4.6;
    const c1 = ['PC=' + cs.regs[b].pc, 'r1=' + cs.regs[b].r1].map((s, k) => cube(s, PC_[b], [1, 0.45, 0.6], x1, 0.9 + k * 0.5, 0.6));
    c1.forEach((c, k) => move(c, cs.reg[k].position.x, cs.reg[k].position.y, 0.4));
    await W(tok, 900); c1.forEach((c) => kill(c));
    cs.cur = b; cs.switches++; glow(cs.cpu, null);
    log('reload：載入 PCB' + b + '，P' + b + ' 從上次停下的 PC = ' + cs.regs[b].pc + ' 接著跑。');
    ctxDraw();
  }

  // ───────────────────────── 模式 4：三種 scheduler ─────────────────────────
  const sc = { procs: [], next: 1, cap: 4 };
  const ZONE = { disk: [-4.8, '#d8e6cf', 'disk（new / 被 swap out）'], mem: [0, '#f3e6c8', 'memory（ready queue）'], cpu: [4.8, '#d6e6f6', 'CPU'] };
  function enterSched() {
    fresh([0, 6, 13.5], [0, 1.4, 0]);
    sc.procs = []; sc.next = 1;
    for (const k in ZONE) { ctx.tile(V3(ZONE[k][0], 0.04, 0), 3.6, 3.4, ZONE[k][1]); tag(ZONE[k][2], 'ptr', ZONE[k][0], 0.1, 2); }
    tag('memory 容量 4 個', 'idx', 0, 0.1, -2);
    for (let k = 0; k < 6; k++) scAdd(true);
    controls('<button id="sNew">新 process</button><button class="primary" id="sLong">long-term：admit</button><button id="sShort">short-term：dispatch</button><button id="sTime">time slice 到</button><button id="sOut">mid-term：swap out</button><button id="sIn">mid-term：swap in</button>');
    on('sNew', () => { scAdd(); });
    on('sLong', () => scMove('long')); on('sShort', () => scMove('short')); on('sTime', () => scMove('time'));
    on('sOut', () => scMove('out')); on('sIn', () => scMove('in'));
    log('long-term：disk → memory（控制 degree of multiprogramming）；short-term：memory → CPU；mid-term：memory ⇄ disk（swapping）。');
    scLayout(); scState();
  }
  function scAdd(silent) {
    if (sc.procs.length >= 10) { log('畫面最多 10 個 process。', true); return; }
    const id = sc.next++, io = Math.random() < 0.5;
    const m = cube('P' + id + (io ? ' I/O' : ' CPU'), io ? COL.io : COL.cpu, [1, 0.42, 0.7], -4.8, 3, 0);
    sc.procs.push({ id, where: 'disk', swapped: false, io, m });
    if (!silent) { log('新的 P' + id + '（' + (io ? 'I/O-bound' : 'CPU-bound') + '）在 disk 上，狀態 new。'); scLayout(); scState(); }
  }
  function scLayout() {
    const cnt = { disk: 0, mem: 0, cpu: 0 };
    sc.procs.forEach((p) => { const k = cnt[p.where]++; move(p.m, ZONE[p.where][0] - 0.6 + (k % 2) * 1.2, 0.3 + Math.floor(k / 2) * 0.5, -0.9 + (k % 2) * 0.2); glow(p.m, p.swapped ? RED : null); });
  }
  function scMove(kind) {
    const inMem = sc.procs.filter((p) => p.where === 'mem'), onCpu = sc.procs.find((p) => p.where === 'cpu');
    const deg = inMem.length + (onCpu ? 1 : 0);
    if (kind === 'long') {
      const p = sc.procs.find((q) => q.where === 'disk' && !q.swapped);
      if (!p) { log('disk 上沒有新的（new）process 可以 admit。被 swap out 的要用 mid-term swap in。', true); return; }
      if (deg >= sc.cap) { log('memory 滿了（degree = ' + deg + '）：long-term scheduler 不再 admit，否則會 thrashing。', true); return; }
      p.where = 'mem'; log('long-term：P' + p.id + ' 進 memory（new → ready）。這種事幾秒、幾分鐘才發生一次。');
    } else if (kind === 'short') {
      if (onCpu) { log('CPU 上已經有 P' + onCpu.id + '：要等它 time slice 到或去做 I/O。', true); return; }
      const p = inMem[0]; if (!p) { log('ready queue 是空的，沒有人可以 dispatch。', true); return; }
      p.where = 'cpu'; log('short-term：P' + p.id + ' 上 CPU（ready → running）。每幾個 ms 就要做一次。');
    } else if (kind === 'time') {
      if (!onCpu) { log('CPU 上沒有 process。', true); return; }
      onCpu.where = 'mem'; sc.procs.splice(sc.procs.indexOf(onCpu), 1); sc.procs.push(onCpu);
      log('timer interrupt：P' + onCpu.id + ' 回到 ready queue 尾端（running → ready）。');
    } else if (kind === 'out') {
      const p = inMem[inMem.length - 1]; if (!p) { log('memory 裡沒有 ready 的 process 可以 swap out（不會把 running 的直接踢走）。', true); return; }
      p.where = 'disk'; p.swapped = true; log('mid-term：P' + p.id + ' 的 memory content swap out 到 disk，降低 degree of multiprogramming。');
    } else if (kind === 'in') {
      const p = sc.procs.find((q) => q.swapped); if (!p) { log('沒有被 swap out 的 process。', true); return; }
      if (deg >= sc.cap) { log('memory 滿了，要先 swap out 別人才能 swap in。', true); return; }
      p.where = 'mem'; p.swapped = false; log('mid-term：P' + p.id + ' swap in 回 memory，回到 ready。');
    }
    scLayout(); scState();
  }
  function scState() {
    const mem = sc.procs.filter((p) => p.where === 'mem' || p.where === 'cpu');
    const io = mem.filter((p) => p.io).length;
    setState('三種 scheduler', [['degree of multiprogramming', mem.length + ' / ' + sc.cap], ['memory 裡 I/O-bound', String(io)], ['memory 裡 CPU-bound', String(mem.length - io)], ['被 swap out', String(sc.procs.filter((p) => p.swapped).length)]],
      mem.length && (io === 0 || io === mem.length) ? '<span class="no">mix 不平衡</span>：全是 ' + (io ? 'I/O-bound → CPU idle' : 'CPU-bound → I/O idle') : 'CPU-bound 與 I/O-bound 混著放，兩邊都不 idle');
  }

  // ───────────────────────── 模式 5：IPC（shared memory bounded buffer vs message passing） ─────────────────────────
  const BS = 5;
  const ipc = { mode: 'shm', in: 0, out: 0, items: [], nextV: 1, box: [], copies: 0 };
  function enterIpc() {
    fresh([0, 6, 13.5], [0, 1.6, 0]);
    Object.assign(ipc, { in: 0, out: 0, items: Array(BS).fill(null), nextV: 1, box: [], copies: 0, inL: null, outL: null });
    controls('<select id="pMode"><option value="shm">shared memory（bounded buffer）</option><option value="msg">message passing（經過 kernel）</option></select><button class="primary" id="pProd">producer 產生</button><button id="pCons">consumer 取用</button>');
    $('pMode').value = ipc.mode;
    $('pMode').onchange = (e) => { ipc.mode = e.target.value; clearLog(); enterIpc(); };
    on('pProd', () => run(() => ipcProd()));
    on('pCons', () => run(() => ipcCons()));
    cube('producer', COL.user, [2, 0.8, 1], -5, 0.4, 0); cube('consumer', COL.cpu, [2, 0.8, 1], 5, 0.4, 0);
    if (ipc.mode === 'shm') {
      for (let k = 0; k < BS; k++) { ctx.tile(V3(-2 + k, 0.04, 0), 0.9, 0.9, '#f3e6c8'); tag('[' + k + ']', 'idx', -2 + k, 0, 0.8); }
      ipc.inL = tag('in', 'ptr', -2, 0, -0.9); ipc.outL = tag('out', 'ptr alt', -2, 0, -1.4);
      tag('shared buffer（BUFFER_SIZE = 5）', 'ptr', 0, 1.6);
      log('課本的 bounded buffer：in 指向下一個空格、out 指向第一個有資料的格。');
      log('空：in == out；滿：(in + 1) % 5 == out → 最多只放 4 個（BUFFER_SIZE − 1）。');
    } else {
      cube('kernel（mailbox）', COL.os, [3.4, 0.8, 1.2], 0, 0.4, -1.2);
      log('message passing：send() 把 message copy 進 kernel，receive() 再 copy 出來；不需要共用的變數。');
    }
    ipcState();
  }
  function ipcState() {
    if (ipc.mode === 'shm') {
      if (ipc.inL) { ipc.inL.position.x = -2 + ipc.in; ipc.outL.position.x = -2 + ipc.out; }
      const n = (ipc.in - ipc.out + BS) % BS;
      setState('Shared memory：bounded buffer', [['in', String(ipc.in)], ['out', String(ipc.out)], ['buffer 裡有', n + ' 個'], ['狀態', ipc.in === ipc.out ? '空' : (ipc.in + 1) % BS === ipc.out ? '滿' : '可放可取']],
        'producer：while ((in + 1) % 5 == out); buffer[in] = item; in = (in + 1) % 5;<br>consumer：while (in == out); item = buffer[out]; out = (out + 1) % 5;');
    } else setState('Message passing', [['mailbox 裡', ipc.box.length + ' 則'], ['memory copy 次數', String(ipc.copies)]], 'send(P, message)／receive(Q, message)<br>每則 message：producer → kernel → consumer，copy 2 次');
  }
  async function ipcProd(tok) {
    const v = ipc.nextV;
    if (ipc.mode === 'shm') {
      if ((ipc.in + 1) % BS === ipc.out) { log('buffer 滿了：(in + 1) % 5 == out，producer 只能 busy-wait。', true); return; }
      ipcItem(v, -5, 1.2); const m = ipc.last; move(m, -2 + ipc.in, 0.35, 0);
      ipc.items[ipc.in] = m; ipc.in = (ipc.in + 1) % BS; ipc.nextV++;
      log('producer 寫入 buffer[' + ((ipc.in + BS - 1) % BS) + '] = ' + v + '，in 變成 ' + ipc.in + '（直接寫共用 memory，不用 system call）。');
    } else {
      if (ipc.box.length >= 4) { log('mailbox 滿了（容量 4）：blocking send 會讓 producer 等。', true); return; }
      ipcItem(v, -5, 1.2); const m = ipc.last; move(m, -1.2 + ipc.box.length * 0.8, 1.1, -1.2);
      ipc.box.push(m); ipc.copies++; ipc.nextV++;
      log('send()：message ' + v + ' copy 進 kernel（system call）。');
    }
    await W(tok, 500); ipcState();
  }
  function ipcItem(v, x, y) { ipc.last = cube(v, PC_[v % 8], [0.6, 0.5, 0.6], x, y, 0); }
  async function ipcCons(tok) {
    if (ipc.mode === 'shm') {
      if (ipc.in === ipc.out) { log('buffer 是空的：in == out，consumer 只能等。', true); return; }
      const m = ipc.items[ipc.out]; ipc.items[ipc.out] = null; ipc.out = (ipc.out + 1) % BS;
      move(m, 5, 1.2, 0); await W(tok, 600); fly(m, V3(2, 6, 2));
      log('consumer 讀走一個，out 變成 ' + ipc.out + '。');
    } else {
      if (!ipc.box.length) { log('mailbox 是空的：blocking receive 會讓 consumer 等。', true); return; }
      const m = ipc.box.shift(); ipc.copies++;
      move(m, 5, 1.2, 0); await W(tok, 600); fly(m, V3(2, 6, 2));
      ipc.box.forEach((b, k) => move(b, -1.2 + k * 0.8, 1.1, -1.2));
      log('receive()：從 kernel copy 到 consumer（第 2 次 copy）。');
    }
    ipcState();
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  let qs = { score: 0, total: 0 };
  function genQ() {
    const r = Math.random();
    if (r < 0.22) {
      const keys = Object.keys(FORKS); const k = pick(keys); const n = 1 + Math.floor(Math.random() * 4);
      const ops = k === 'loop' ? Array.from({ length: n }, () => ({})) : FORKS[k].ops;
      const cnt = simulateFork(ops).procs.length;
      const name = k === 'loop' ? 'for (i = 0; i < ' + n + '; i++) fork();' : FORKS[k].name;
      const opts = [...new Set([cnt, cnt + 1, cnt - 1, cnt * 2, Math.pow(2, ops.length)].filter((v) => v > 0).map(String))].slice(0, 4);
      if (!opts.includes(String(cnt))) opts[0] = String(cnt);
      return { q: name + '\nprintf("hi");\n執行後總共印出幾次 hi？（含原本的 process）', opts, ans: String(cnt), why: k === 'and' ? 'child 拿到 0，&& 短路不再 fork；只有 parent 再 fork 一次：共 3 個。' : k === 'or' ? 'parent 拿到 PID（非 0），|| 短路；只有 child 再 fork：共 3 個。' : k === 'ifc' ? '只有 child（fork 回傳 0）再 fork：共 3 個。' : k === 'mix' ? '第一次後 2 個；只有 parent 再 fork → 3 個；最後每個都 fork → 6 個。' : '每個 fork 讓 process 數加倍：2^' + ops.length + ' = ' + cnt + '。' };
    }
    if (r < 0.34) {
      const pid = 2000 + Math.floor(Math.random() * 3000);
      const who = pick(['parent', 'child']);
      return { q: 'pid = fork(); 成功後新 child 的 PID 是 ' + pid + '。' + who + ' 拿到的 pid 值是？', opts: [String(pid), '0', '-1', 'parent 自己的 PID'], ans: who === 'parent' ? String(pid) : '0', why: 'parent 拿到 child 的 PID；child 拿到 0；失敗才回傳 −1。' };
    }
    if (r < 0.5) {
      const all = [['ready', 'running', true], ['running', 'ready', true], ['running', 'waiting', true], ['waiting', 'ready', true], ['new', 'ready', true], ['running', 'terminated', true], ['waiting', 'running', false], ['ready', 'waiting', false], ['new', 'running', false], ['terminated', 'ready', false]];
      const [a, b, ok] = pick(all);
      return { q: '五狀態圖中，' + a + ' → ' + b + ' 這個轉換存在嗎？', opts: ['存在', '不存在'], ans: ok ? '存在' : '不存在', why: ok ? '對應 ' + (ALLOWED[a + '>' + b] || '') + '。' : a === 'waiting' ? 'I/O 完成只能回 ready，要再被 dispatch。' : a === 'ready' ? '只有 running 的 process 才會發 I/O request 進 waiting。' : a === 'new' ? 'new 要先被 admit 成 ready。' : 'terminated 不能再回來。' };
    }
    if (r < 0.62) {
      const q = pick([['控制 degree of multiprogramming、決定哪個新 process 進 memory 的是？', 'long-term scheduler'], ['每幾個 ms 就要執行、必須非常快的是？', 'short-term scheduler'], ['把 process 從 memory swap out 到 disk 的是？', 'medium-term scheduler'], ['又叫 job scheduler 的是？', 'long-term scheduler'], ['又叫 CPU scheduler 的是？', 'short-term scheduler']]);
      return { q: q[0], opts: ['long-term scheduler', 'short-term scheduler', 'medium-term scheduler', 'disk scheduler'], ans: q[1], why: 'long-term：disk → memory；short-term：memory → CPU；medium-term：memory ⇄ disk（swapping）。' };
    }
    if (r < 0.72) {
      const p = pick([50, 100, 200]), c = pick([5, 10, 20, 25]);
      const v = Math.round(c / p * 100);
      return { q: '每 ' + p + ' ms 要做一次 CPU scheduling，排程演算法本身每次跑 ' + c + ' ms。CPU 花在排程的 overhead 約多少？', opts: [v + '%', Math.round(c / (p + c) * 100) + '%', Math.round(p / c) + '%', '0%'].filter((x, i, s) => s.indexOf(x) === i), ans: v + '%', why: c + ' / ' + p + ' = ' + v + '%（課堂例：100 ms 中跑 10 ms → 10%）。short-term 演算法一定要很快。' };
    }
    if (r < 0.84) {
      const q = pick([['int g = 5;（宣告在所有函式外）', 'data section'], ['函式裡的 int x = 3;', 'stack'], ['p = malloc(100); 配置的那 100 bytes', 'heap'], ['編譯好的機器指令', 'code（text）section'], ['main 的參數 argc', 'stack'], ['static int count;（全域）', 'data section']]);
      return { q: q[0] + ' 放在 process 的哪一區？', opts: ['code（text）section', 'data section', 'stack', 'heap'], ans: q[1], why: 'code：指令；data：global/static；stack：local 變數、參數、return address；heap：動態配置。' };
    }
    if (r < 0.92) {
      return { q: 'Context switch 時，OS 把舊 process 的 PC 和 register 存到哪裡？', opts: ['它的 PCB', 'ready queue 的尾端', 'disk 的 swap 區', '新 process 的 stack'], ans: '它的 PCB', why: '存進 PCB，之後 reload 才能從原地繼續；這段時間是純 overhead。' };
    }
    return { q: 'fork() 之後 parent 和 child 都還沒改任何變數，copy-on-write 會怎麼做？', opts: ['先共用同一份 page，誰寫入才複製那一頁', '立刻把整個 address space 複製一份', '讓 child 直接用 parent 的 stack', '把 parent 的 memory swap 到 disk'], ans: '先共用同一份 page，誰寫入才複製那一頁', why: '內容一樣就先 share，run time 發現有人改才分家，省 memory。' };
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
  // ─── FiRH2TYB1Mw（第 6B 講）：program vs process、memory layout、metadata ───
  async function scProgProc(tok) {
    fresh([0, 5.5, 14], [0, 2, 0]);
    ctx.tile(V3(-3.8, 0.04, 0), 4.4, 3.4, '#d8e6cf'); tag('disk', 'ptr', -3.8, 0.1, 2);
    ctx.tile(V3(3.2, 0.04, 0), 4.4, 3.4, '#f3e6c8'); tag('memory', 'ptr', 3.2, 0.1, 2);
    const f = cube('a.out（binary）', COL.paper, [2.4, 0.6, 1.2], -3.8, 0.3, 0, 3);
    say('中文都叫「程式」，英文分 program 和 process', '寫程式 = programming；跑起來 = process');
    await W(tok, 2600);
    say('Program：passive entity', '只是 disk 上的一堆 bits / bytes，等著被執行');
    await W(tok, 2400);
    const p = cube('process', COL.user, [2.4, 1.2, 1.2], -3.8, 0.6, 0);
    move(p, 3.2, 0.6, 0);
    say('Process：active entity', '正在 execute 的程式，在 memory 裡');
    await W(tok, 1800);
    const pc = cube('PC', COL.gold, [0.6, 0.35, 0.4], 3.2, 1.6, 0.7);
    for (let k = 0; k < 4; k++) { move(pc, 2.4 + k * 0.5, 1.6, 0.7); await W(tok, 400); }
    say('位置不同：program 在 disk，process 在 memory', '因為 CPU 只能 access memory');
    await W(tok, 2600);
    say('OS 管的是 process，不是 program', '答題時用字要分清楚');
    await W(tok, 2600);
    void f;
  }
  async function scMemLayout(tok) {
    fresh([0, 5, 14], [0, 2.6, 0]);
    // 補充：程式碼範例為動畫自訂；分區依課堂與恐龍書 Fig. 3.1
    const cd = code(['int g = 10;          // global', 'int main() {', '  int x = 3;         // local', '  int *p = malloc(8); // dynamic', '  g = g + x;', '}'], -3.6, 5.4, 0.55);
    const X = 3.4;
    const sec = { text: cube('code（text）', COL.cpu, [2.6, 0.9, 1.2], X, 0.45, 0), data: cube('data', COL.user, [2.6, 0.9, 1.2], X, 1.4, 0), heap: cube('heap ↑', COL.io, [2.6, 0.9, 1.2], X, 2.35, 0), gap: cube('', '#f3ead9', [2.6, 1.6, 1.2], X, 3.6, 0), stack: cube('stack ↓', COL.os, [2.6, 0.9, 1.2], X, 4.85, 0) };
    tag('max', 'idx', X + 1.7, 5.3); tag('0', 'idx', X + 1.7, 0.1);
    say('一個 process 有自己的 memory space', '切成幾個區塊');
    await W(tok, 2200);
    const steps = [[-1, 'text', '程式碼 load 進 memory：code segment', '等著被 CPU fetch 的 instruction'], [0, 'data', 'global variable → data section', 'load 時就知道、每個 function 都看得到'], [2, 'stack', 'local variable → stack', 'function return 就一次 pop 掉'], [3, 'heap', 'malloc 出來的 → heap', '最自由、也最要小心']];
    for (const [ln, k, a, b] of steps) {
      cd.hl(ln); glow(sec[k], GOLD);
      if (ln >= 0) { const v = cube(k === 'data' ? 'g' : k === 'stack' ? 'x' : '8B', '#ffffff', [0.5, 0.4, 0.4], -1, 5.4 - ln * 0.55, 0.6); move(v, X - 0.6, sec[k].position.y, 0.8); }
      say(a, b); await W(tok, 2400); glow(sec[k], null);
    }
    cd.hl(-1);
    say('stack 往下長、heap 往上長', '中間留空間給兩者動態增加');
    await W(tok, 2600);
    say('寫程式要清楚變數放在哪一區', '管理方式不同');
    await W(tok, 2400);
    void sec.gap;
  }
  async function scPcb(tok) {
    fresh([0, 5, 13.5], [0, 2.6, 0]);
    const F = [['process state', 'running'], ['process number（PID）', '1234'], ['program counter', '0x40a2'], ['registers', 'r1=7, sp=…'], ['memory limits（base / limit）', '…'], ['list of open files', 'a.txt, socket'], ['CPU scheduling 資訊', 'priority…']];
    tag('PCB（process control block）', 'ptr', 0, 6.2);
    say('OS 還要管理 process 的 metadata', '');
    await W(tok, 2000);
    const ms = [];
    for (let i = 0; i < F.length; i++) {
      ms.push(cube(F[i][0] + '：' + F[i][1], i === 2 ? COL.gold : i === 3 ? COL.cpu : i === 5 ? COL.io : COL.paper, [5.6, 0.6, 1], 0, 5.4 - i * 0.7, 0, 2));
      say(i === 2 ? 'program counter：目前執行到哪裡' : i === 3 ? 'register：被換走時要記下來讓出來' : i === 5 ? 'resource：開了哪些 file、socket、port' : F[i][0], i === 3 ? 'CPU 是很多程式共用的' : '');
      await W(tok, i === 2 || i === 3 || i === 5 ? 2000 : 900);
    }
    say('這些都存在 PCB：context switch 就靠它', '課本 Fig. 3.3');
    await W(tok, 2800);
    void ms;
  }

  // ─── AztAXONxs7M（第 8A 講）：狀態對應位置、三種 scheduler、degree、overhead ───
  async function scStateLoc(tok) {
    fresh([0, 6, 14], [0, 1.6, 0]);
    const Z = [['disk', -4.8, '#d8e6cf'], ['memory', 0, '#f3e6c8'], ['CPU', 4.8, '#d6e6f6']];
    Z.forEach(([n, x, c]) => { ctx.tile(V3(x, 0.04, 0), 3.6, 3.2, c); tag(n, 'ptr', x, 0.1, 1.9); });
    const P = cube('P', COL.user, [0.8, 0.6, 0.8], -4.8, 0.3, 0, 3);
    const st = tag('new', 'ptr alt', -4.8, 1.6);
    say('把 state 和「process 在哪裡」串在一起', 'CPU 只有個位數～十幾個 core');
    await W(tok, 2400);
    say('在 disk 上：new', '只是被 create，還在等著搶進 memory');
    await W(tok, 2200);
    move(P, 0, 0.3, 0); txt(st, 'ready'); st.position.x = 0;
    say('進了 memory：ready', 'ready to run');
    await W(tok, 2200);
    move(P, 4.8, 0.3, 0); txt(st, 'running'); st.position.x = 4.8;
    say('在 CPU 上：running', '');
    await W(tok, 2000);
    move(P, 0, 0.3, -1); txt(st, 'waiting'); st.position.x = 0; tint(P, COL.io);
    say('waiting：在 memory，但就算 CPU 空也不能跑', '等 I/O、等別人、或自己 call sleep');
    await W(tok, 2800);
    tint(P, COL.user); move(P, 0, 0.3, 0); txt(st, 'ready'); await W(tok, 900);
    move(P, 4.8, 0.3, 0); txt(st, 'running'); st.position.x = 4.8; await W(tok, 900);
    fly(P); txt(st, 'terminated');
    say('執行完離開：terminated', '');
    await W(tok, 2400);
  }
  async function scLongShort(tok) {
    fresh([0, 6, 14], [0, 1.6, 0]);
    const Z = [['disk', -4.8, '#d8e6cf'], ['memory（ready）', 0, '#f3e6c8'], ['CPU', 4.8, '#d6e6f6']];
    Z.forEach(([n, x, c]) => { ctx.tile(V3(x, 0.04, 0), 3.6, 3.2, c); tag(n, 'ptr', x, 0.1, 1.9); });
    tag('long-term（job scheduler）', 'ptr alt', -2.4, 2.6); tag('short-term（CPU scheduler）', 'ptr alt', 2.4, 2.6);
    arrow(-3, 1.8, -1.8, 1.8, COL.gold); arrow(1.8, 1.8, 3, 1.8, COL.gold);
    const lc = tag('', 'idx', -2.4, 2.1), sc_ = tag('', 'idx', 2.4, 2.1);
    const ps = []; for (let k = 0; k < 6; k++) ps.push(cube('P' + (k + 1), PC_[k], [0.6, 0.45, 0.6], -5.6 + (k % 3) * 0.8, 0.25 + Math.floor(k / 3) * 0.5, 0));
    say('要搶的資源很少：要排程', '進 memory 要排、上 CPU 也要排');
    await W(tok, 2400);
    let L = 0, S = 0; const mem = [];
    for (let t = 0; t < 12; t++) {
      if (t % 5 === 0 && ps.length) { const p = ps.shift(); mem.push(p); move(p, -0.8 + (mem.length % 3) * 0.8, 0.25, 0); L++; txt(lc, '執行 ' + L + ' 次'); say('使用者 launch 程式：long-term 才動', '幾秒、幾分鐘一次 → long-term'); }
      if (mem.length) { const p = mem.shift(); move(p, 4.8, 0.25, 0); S++; txt(sc_, '執行 ' + S + ' 次'); await W(tok, 420); move(p, -0.8 + (mem.length % 3) * 0.8, 0.75, 0); mem.push(p); }
      if (t % 5 !== 0) say('timer 每幾 ms 響一次：重新排 CPU', '非常頻繁 → short-term');
      await W(tok, 300);
    }
    say('long-term 次數少，short-term 次數多', '名字就照頻率來理解');
    await W(tok, 2800);
  }
  async function scMidterm(tok) {
    fresh([0, 6, 14], [0, 1.6, 0]);
    ctx.tile(V3(-3.6, 0.04, 0), 4.6, 3.2, '#d8e6cf'); tag('disk（swap 區）', 'ptr', -3.6, 0.1, 1.9);
    ctx.tile(V3(2.8, 0.04, 0), 5.4, 3.2, '#f3e6c8'); tag('memory（容量有限）', 'ptr', 2.8, 0.1, 1.9);
    const ps = []; for (let k = 0; k < 6; k++) ps.push(cube('P' + (k + 1), PC_[k], [0.75, 0.5, 0.7], 0.8 + (k % 3) * 1.1, 0.25 + Math.floor(k / 3) * 0.55, 0, 2));
    say('mid-term scheduler 跟 virtual memory 結合', 'disk 拿一塊來當 memory 用');
    await W(tok, 2600);
    say('memory 不夠：把一些 process swap out 到 disk', '整個 memory content 搬過去，不是原本的檔案');
    for (const k of [4, 5]) { move(ps[k], -4.4 + (k - 4) * 1.4, 0.3, 0); glow(ps[k], RED); await W(tok, 900); }
    say('被 swap out 的 process 不能直接執行', '要先 swap in 回 memory 才回到 ready');
    await W(tok, 2600);
    fly(ps[0], V3(3, 6, 2));
    say('有空間了（或被選中要執行）：swap in', '');
    await W(tok, 900);
    move(ps[4], 0.8, 0.25, 0); glow(ps[4], null);
    await W(tok, 2000);
    say('目的：控制 degree、改善 process mix', '現代 OS 的 long-term 角色多被 mid-term 取代');
    await W(tok, 3000);
  }
  async function scDopMix(tok) {
    fresh([0, 5.5, 14], [0, 2.2, 0]);
    const cpuB = cube('CPU', COL.cpu, [1.8, 1, 1.2], -4.2, 0.5, 0), ioB = cube('I/O', COL.io, [1.8, 1, 1.2], 4.2, 0.5, 0);
    const cl = tag('', 'ptr', -4.2, 1.6), il = tag('', 'ptr', 4.2, 1.6), dl = tag('', 'ptr alt', 0, 4.8);
    const mem = []; const clear_ = () => { mem.splice(0).forEach((m) => kill(m)); };
    function fill(list) { clear_(); list.forEach((k, i) => mem.push(cube(k === 'C' ? 'CPU-bound' : 'I/O-bound', k === 'C' ? COL.cpu : COL.io, [1.6, 0.4, 0.8], -0.9 + (i % 2) * 1.8, 0.25 + Math.floor(i / 2) * 0.45, 0, 2))); txt(dl, 'degree of multiprogramming = ' + list.length); }
    say('Degree：memory 裡有幾個 process', 'degree of multiprogramming，由 long-term scheduler 控制');
    fill(['C']); txt(cl, 'CPU 常 idle'); glow(cpuB, null);
    await W(tok, 2600);
    say('degree 太低：像 batch（degree = 1）', 'CPU 在等 I/O → 使用率下降');
    await W(tok, 2400);
    fill(['C', 'C', 'C', 'C', 'C', 'C']); txt(cl, 'CPU 很忙'); txt(il, 'I/O 閒著'); glow(cpuB, GOLD); glow(ioB, null);
    say('全是 CPU-bound：只有 CPU 在動', 'I/O bandwidth 浪費掉');
    await W(tok, 2800);
    fill(['I', 'I', 'I', 'I', 'I', 'I']); txt(cl, 'CPU idle'); txt(il, '大家都在等 I/O'); glow(cpuB, null); glow(ioB, GOLD);
    say('全是 I/O-bound：都在 printf、scanf', 'CPU 指令很少 → CPU 仍然 idle');
    await W(tok, 2800);
    fill(['C', 'I', 'C', 'I', 'C', 'I']); txt(cl, 'CPU 忙'); txt(il, 'I/O 忙'); glow(cpuB, GOLD); glow(ioB, GOLD);
    say('挑一個好的 mix：CPU 和 I/O 都不 idle', '使用率才會增加');
    await W(tok, 2800);
    fill(['C', 'I', 'C', 'I', 'C', 'I', 'C', 'I', 'C', 'I', 'C', 'I']); glow(cpuB, RED); txt(cl, '忙著 swapping'); txt(il, '');
    say('degree 太高：搶有限的 memory → thrashing', '一直 swap，使用者的指令沒在跑');
    await W(tok, 3000);
  }
  async function scStOverhead(tok) {
    fresh([0, 5, 14], [0, 2.2, 0]);
    const u = 0.035, x0 = -5.5;
    tag('CPU 時間軸（每 100 ms 重排一次）', 'ptr', 0, 4.6);
    async function strip(y, algo, name) {
      tag(name, 'ptr alt', x0 - 0.3, y + 0.6);
      let t = 0;
      for (let k = 0; k < 3; k++) {
        const a = lab.box(COL.bad, [algo * u, 0.5, 0.6]); a.position.set(x0 + (t + algo / 2) * u, y, 0); lab.world.add(a);
        const w = 100 - algo; const b = lab.box(COL.user, [w * u, 0.5, 0.6]); b.position.set(x0 + (t + algo + w / 2) * u, y, 0); lab.world.add(b);
        t += 100; await W(tok, 700);
      }
      tag('overhead ' + algo + '%', 'ptr', x0 + 300 * u + 0.6, y);
    }
    say('short-term 要確保 wait time 短、fairness', '平均低不代表大家都滿意（像國民所得 vs 均富）');
    await W(tok, 2800);
    say('但演算法本身一定要非常快', '例：每 100 ms 做一次 scheduling');
    await W(tok, 2000);
    await strip(2.6, 10, '演算法跑 10 ms');
    say('紅 = 排程演算法，綠 = 真的在跑使用者程式', '10 / 100 = 10% 的 CPU 是 overhead');
    await W(tok, 2600);
    await strip(0.8, 50, '演算法跑 50 ms');
    say('如果演算法要 50 ms：一半時間沒在做事', 'CPU 100% 忙，使用者卻覺得很慢');
    await W(tok, 2800);
    say('queue 很長時，n² 的演算法就不實用', 'short-term：效率第一');
    await W(tok, 2600);
  }

  // ─── ETPHC9DffdU（第 8B 講）：PID、process tree、creation 的選擇、fork/exec/wait、copy-on-write ───
  async function scProcTree(tok) {
    fresh([0, 3.6, 14], [0, 3.2, 0]);
    // 課本 Fig. 3.8（Linux 的 process tree）
    const T = [['init', 1, null], ['login', 8415, 1], ['kthreadd', 2, 1], ['sshd', 3028, 1], ['bash', 8416, 8415], ['pdflush', 200, 2], ['khelper', 6, 2], ['sshd', 3610, 3028], ['ps', 9298, 8416], ['emacs', 9204, 8416], ['tcsch', 4005, 3610]];
    const pos = { 1: [0, 5.6], 8415: [-3.6, 4.2], 2: [0, 4.2], 3028: [3.6, 4.2], 8416: [-3.6, 2.8], 200: [-0.8, 2.8], 6: [0.9, 2.8], 3610: [3.6, 2.8], 9298: [-4.7, 1.4], 9204: [-2.5, 1.4], 4005: [3.6, 1.4] };
    say('每個 process 都有唯一的 PID', 'process identifier');
    await W(tok, 2200);
    const M = {};
    for (const [n, pid, par] of T) {
      const [x, y] = pos[pid];
      if (par !== null) line(pos[par][0], pos[par][1] - 0.25, 0, x, y + 0.25, 0, '#8a7a5c');
      M[pid] = cube(n + '\npid=' + pid, PC_[pid % 8], [1.6, 0.55, 0.7], x, y, 0, 2);
      if (pid === 1) say('開機時只有一個 process', '其他 process 都是被 create 出來的');
      await W(tok, pid === 1 ? 1800 : 450);
    }
    say('任何時候都畫得出一棵 tree：parent / children', '用 ps -ael 看 PID 和 parent（PPID）就能重建');
    await W(tok, 3000);
    say('parent 不見了，下面的也全部砍掉', '不會有找不到 parent 的 process（像 dangling pointer）');
    for (const pid of [8416, 9298, 9204]) { glow(M[pid], RED); }
    await W(tok, 1200);
    for (const pid of [9298, 9204, 8416]) { fly(M[pid]); await W(tok, 400); }
    await W(tok, 2200);
    say('補充：Linux 實際會把孤兒交給 init 收養', '課堂講的是概念上的 tree 關係');
    await W(tok, 2600);
  }
  async function scCreationOpts(tok) {
    fresh([0, 5, 14], [0, 2.4, 0]);
    const D = [['resource sharing', ['share all', 'subset', 'share nothing']], ['execution', ['concurrent', 'parent wait 到 child 結束']], ['address space', ['duplicate（複製 parent）', 'load 新的 program']]];
    say('parent 和 child 的關係有三個面向', '由 OS 設計者決定');
    await W(tok, 2200);
    const rows = [];
    for (let i = 0; i < D.length; i++) {
      tag(D[i][0], 'ptr', -4.6, 4.6 - i * 1.7);
      rows.push(D[i][1].map((o, k) => cube(o, COL.paper, [2.6, 0.6, 0.9], -1.4 + k * 2.9, 4.6 - i * 1.7, 0, 2)));
      say(D[i][0] + '：' + D[i][1].length + ' 種選擇', D[i][1].join(' / ') + '；' + (i === 0 ? '例：child 能否繼承 file handler？' : i === 1 ? 'wait 的話 parent 進 waiting queue' : 'duplicate 連 PC 都一樣'));
      await W(tok, 2800);
    }
    say('UNIX / Linux 的選擇', 'fork()');
    for (const [i, k] of [[1, 0], [2, 0]]) { tint(rows[i][k], COL.user); glow(rows[i][k], GREEN); await W(tok, 900); }
    say('fork：duplicate + concurrent', 'parent 不用等；誰先跑由 scheduler 決定');
    await W(tok, 3000);
  }
  async function scForkReturn(tok) {
    fresh([0, 5.5, 14], [0, 2.4, 0]);
    const lines = ['pid = fork();', 'if (pid == 0)', '  /* child */', 'else', '  /* parent */'];
    const A = code(lines, -4.6, 5.2, 0.5), B = code(lines, 2.4, 5.2, 0.5);
    B.ls.forEach((l) => { l.element.style.opacity = '0.15'; });
    const pa = cube('parent  PID 100', PC_[0], [3, 0.7, 1], -3.6, 1.6, 0);
    A.hl(0);
    say('parent 執行到 fork()', '');
    await W(tok, 2000);
    const ch = cube('child  PID 101', PC_[1], [3, 0.7, 1], -3.6, 1.6, 0);
    move(ch, 3.4, 1.6, 0);
    B.ls.forEach((l) => { l.element.style.opacity = ''; }); B.hl(0);
    say('child：parent 的完整 duplicate', 'global、heap 的值、連 PC 都一樣 → 也停在 fork 這行');
    await W(tok, 2800);
    const ra = tag('fork() 回傳 101', 'ptr alt', -3.6, 2.6), rb = tag('fork() 回傳 0', 'ptr alt', 3.4, 2.6);
    say('唯一的差別：回傳值', 'parent 拿到 child 的 PID；child 拿到 0');
    await W(tok, 2800);
    A.hl(4); B.hl(2);
    say('用回傳值判斷自己是 child 還是 parent', '父母一定知道小孩是誰，小孩不一定知道父母');
    await W(tok, 3000);
    say('child 想知道 parent：另外 call getppid()', '兩者 concurrent 執行，順序不一定');
    await W(tok, 2600);
    void pa; void ra; void rb;
  }
  async function scExecReplace(tok) {
    fresh([0, 5, 14], [0, 2.4, 0]);
    const mk = (x, name, col) => [cube('code', col, [2, 0.8, 1], x, 0.4, 0), cube('data', col, [2, 0.6, 1], x, 1.1, 0), cube('heap', col, [2, 0.6, 1], x, 1.7, 0), cube('stack', col, [2, 0.6, 1], x, 2.3, 0), tag(name, 'ptr', x, 3.1)];
    const P = mk(-3.6, 'parent', PC_[0]);
    say('fork 完：child 和 parent 一模一樣', '但開新 process 通常是要它做別的事');
    const C = mk(3.6, 'child（duplicate）', PC_[0]);
    await W(tok, 2800);
    const pc = tag('PC = 第 3 行', 'ptr alt', 3.6, 3.6);
    say('child 呼叫 execlp("/bin/ls", "ls", NULL)', '');
    await W(tok, 1800);
    const bin = cube('/bin/ls', COL.disk, [1.6, 0.6, 1], 6.2, 4.6, 0); move(bin, 3.6, 0.4, 0.8);
    await W(tok, 800); kill(bin);
    tint(C[0], COL.disk); relabel(C[0], 'code：ls');
    say('code segment 整個換成新的 binary', '');
    await W(tok, 1800);
    for (const k of [1, 2, 3]) { tint(C[k], COL.idle); relabel(C[k], ['', 'data（重設）', 'heap（清空）', 'stack（清空）'][k]); }
    txt(pc, 'PC = 0（從頭開始）');
    say('heap、stack 清空，PC 設回起點', '等於 reset：跑一支完全不同的程式');
    await W(tok, 2800);
    say('為什麼不直接 load？還是要先 create', '要先跟 OS 註冊 PID、配置 memory space');
    await W(tok, 3000);
    void P;
  }
  async function scForkExecWait(tok) {
    fresh([0, 5.5, 14], [0, 2.6, 0]);
    // 恐龍書 Fig. 3.9：Creating a separate process using the UNIX fork() system call
    const L = ['pid = fork();', 'if (pid < 0) { /* error */ }', 'else if (pid == 0)', '  execlp("/bin/ls", "ls", NULL);', 'else {', '  wait(NULL);', '  printf("Child Complete");', '}'];
    const cd = code(L, -2.6, 5.6, 0.48);
    const par = cube('parent', PC_[0], [1.8, 0.6, 1], 3.8, 3.4, 0), chd = cube('child', PC_[1], [1.8, 0.6, 1], 3.8, 1.4, 0);
    chd.visible = false;
    const st = tag('', 'ptr alt', 3.8, 4.3), sc2 = tag('', 'ptr alt', 3.8, 2.2);
    cd.hl(0); say('課本的 fork → exec → wait', ''); await W(tok, 2200);
    chd.visible = true; txt(st, 'pid = child 的 PID'); txt(sc2, 'pid = 0');
    say('fork 之後兩個 process 都從這裡繼續', ''); await W(tok, 2200);
    cd.hl(5); txt(st, 'wait(NULL) → waiting'); tint(par, COL.idle);
    say('parent 呼叫 wait：自己進 waiting queue', '這是 programmer 下的同步指令，不是 OS 預設'); await W(tok, 2600);
    cd.hl(3); relabel(chd, 'child：ls'); tint(chd, COL.disk);
    say('child 呼叫 execlp：變成 ls', ''); await W(tok, 2200);
    txt(sc2, 'ls 執行完 → exit'); await W(tok, 1200); fly(chd); txt(sc2, '');
    cd.hl(6); tint(par, PC_[0]); txt(st, '被叫醒 → ready');
    say('child 結束，parent 從 wait 返回', '印出 Child Complete'); await W(tok, 2800);
    say('parent 也能對 child 做 kill、suspend', '最基本的三個：fork、exec、wait'); await W(tok, 2600);
  }
  async function scCow(tok) {
    fresh([0, 5.5, 14], [0, 2.2, 0]);
    const A = cube('A（100 MB）', PC_[0], [2.4, 2.4, 1], -4.6, 1.2, 0);
    cube('OS', COL.os, [1.6, 1.2, 1], 4.8, 0.6, 0);
    say('A 呼叫 fork', '');
    await W(tok, 1600);
    const B = cube("A'（完整複製）", PC_[0], [2.4, 2.4, 1], -1.4, 1.2, 0, 3);
    say('naive：exact copy，再配置 100 MB', '內容一模一樣，何必兩份？浪費 memory');
    await W(tok, 2800);
    kill(B);
    const C = cube("A'", PC_[0], [2.4, 0.6, 1], -1.4, 0.3, 0, 2);
    const link = line(-3.4, 1.8, 0, -1.4, 0.9, 0, '#c08a1f');
    say('copy-on-write：只複製一定會不同的部分', '其他先用 pointer 共用 parent 的內容');
    await W(tok, 2800);
    const cl = tag('', 'ptr alt', -1.4, 3);
    for (let k = 1; k <= 4; k++) {
      C.scale.y = 1 + k; C.position.y = 0.3 * (1 + k);
      txt(cl, (k % 2 ? 'child' : 'parent') + ' 寫入 → 那一塊才分家');
      await W(tok, 900);
    }
    say('run time 有人改共用的值，才真的 copy', 'A\' 慢慢長大，最後大小一樣但內容不同');
    await W(tok, 2800);
    kill(link); txt(cl, '');
    tint(C, COL.disk); relabel(C, 'C：exec 了新程式');
    say('child 呼叫 execlp：整塊換掉', '大小、內容都跟 A 完全脫鉤');
    await W(tok, 3000);
    void A;
  }

  // ─── 課本補充（影片未轉錄的部分）：五狀態圖、queueing diagram、context switch、fork 計數、IPC ───
  async function scFiveState(tok) {
    enterStates(); controls('');
    say('課本 Fig. 3.2：五個狀態', 'new、ready、running、waiting、terminated');
    await W(tok, 2600);
    smNew(); await W(tok, 900);
    const seq = [['new', 'ready', 'admitted：進 memory'], ['ready', 'running', 'scheduler dispatch：拿到 CPU'], ['running', 'ready', 'interrupt：time slice 用完'], ['ready', 'running', '再被 dispatch'], ['running', 'waiting', 'I/O or event wait'], ['waiting', 'ready', 'I/O 完成：回 ready，不是回 running'], ['ready', 'running', '再 dispatch'], ['running', 'terminated', 'exit']];
    for (const [from, to, s] of seq) { smGo(from, to); say('P1 → ' + to, s); await W(tok, 1700); }
    await W(tok, 1400);
    say('任何時刻一顆 CPU 只有一個 running', '很多個可以 ready 或 waiting');
    await W(tok, 2600);
  }
  async function scQueues(tok) {
    fresh([0, 6, 14], [0, 2.2, 0]);
    // 課本 Fig. 3.6：Queueing-diagram representation of process scheduling
    for (let k = 0; k < 5; k++) ctx.tile(V3(-5.4 + k * 0.8, 0.04, 2.6), 0.7, 0.7, '#f3e6c8');
    tag('ready queue', 'ptr', -3.8, 0.1, 3.4);
    const cpu = cube('CPU', COL.cpu, [1.6, 1, 1.2], 2.6, 0.5, 2.6);
    const outs = [['I/O request → I/O queue → I/O', 1.0], ['time slice expired', 0], ['fork a child → child 執行', -1.4], ['wait for an interrupt', -2.6]];
    outs.forEach(([n, z]) => { tag(n, 'idx', 0.4, 0.1, z); line(-6, 0.05, z - 0.3, 5.6, 0.05, z - 0.3, '#e0d3bb'); });
    const P = cube('P', PC_[1], [0.6, 0.5, 0.6], -2.2, 0.3, 2.6);
    const others = [0, 1, 2].map((k) => cube('', PC_[k + 2], [0.6, 0.5, 0.6], -3 - k * 0.8, 0.3, 2.6));
    say('Process 在各種 queue 之間移動', 'ready queue 和 device（I/O）queue');
    await W(tok, 2600);
    const q = [P, ...others];
    const place = () => q.forEach((o, k) => move(o, -2.2 - k * 0.8, 0.3, 2.6));
    const route = async (z, s1, s2) => {
      q.shift(); place(); move(P, 2.6, 1.4, 2.6); say('從 ready queue 被 dispatch 到 CPU', ''); await W(tok, 1300);
      move(P, 4.6, 0.3, z); say(s1, s2); await W(tok, 1600);
      move(P, -6.2, 0.3, z); await W(tok, 1300);
      q.push(P); place(); say('回到 ready queue 尾端', '其他 process 輪流用 CPU'); await W(tok, 1300);
      while (q[0] !== P) { const o = q.shift(); place(); move(o, 2.6, 1.4, 2.6); await W(tok, 450); q.push(o); place(); await W(tok, 350); }
    };
    await route(1.0, '發出 I/O request：進 I/O queue', 'I/O 做完再回 ready queue');
    await route(0, 'time slice 用完', '直接回 ready queue');
    await route(-1.4, 'fork 一個 child', '（可能）等 child 執行');
    say('一直循環，直到 exit', '');
    await W(tok, 2400);
    void cpu;
  }
  async function scCtxSwitch(tok) {
    enterCtx(); controls('');
    say('課本 Fig. 3.4：CPU 從 P0 切到 P1', '');
    await W(tok, 2000);
    await ctxRun(tok); say('P0 執行中', 'PC、register 一直在變'); await W(tok, 1400);
    say('interrupt 或 system call：OS 接手', 'save state into PCB₀');
    await ctxSwitch(tok); await W(tok, 1400);
    await ctxRun(tok); say('P1 執行', ''); await W(tok, 1200);
    say('再切回 P0：save PCB₁、reload PCB₀', '');
    await ctxSwitch(tok);
    say('P0 從上次停下的地方繼續', 'context switch 時間 = 純 overhead，看硬體支援');
    await W(tok, 3000);
  }
  async function scForkCount(tok) {
    fresh([0, 3.6, 14], [0, 3.2, 0]);
    code(['fork();', 'fork();', 'fork();', 'printf("hi");'], -5.2, 1.6, 0.45);
    say('課本習題型：連續 3 個 fork', '每個 process 都會執行後面的 fork');
    await W(tok, 2200);
    await drawForkTree(tok, [{}, {}, {}], 1800);
    say('1 → 2 → 4 → 8 個 process', 'n 個 fork → 2ⁿ 個 process（新建 2ⁿ − 1 個）');
    await W(tok, 3200);
    lab.clear();
    code(['if (fork() == 0)', '  fork();', 'printf("hi");'], -5.2, 1.6, 0.45);
    say('加上條件：只有 child（回傳 0）再 fork', '');
    await W(tok, 1600);
    await drawForkTree(tok, FORKS.ifc.ops, 1800);
    say('只有 3 個 process：印 3 次', '看清楚哪個分支拿到 0');
    await W(tok, 3000);
  }
  async function scIpcShm(tok) {
    ipc.mode = 'shm'; enterIpc(); controls('');
    say('課本：shared memory 的 producer–consumer', 'bounded buffer，BUFFER_SIZE = 5');
    await W(tok, 2600);
    for (let k = 0; k < 4; k++) { await ipcProd(tok); say('producer 放一個，in 前進', 'in = (in + 1) % 5'); await W(tok, 700); }
    say('只放了 4 個就「滿」了', '(in + 1) % 5 == out → 最多 BUFFER_SIZE − 1 個');
    await W(tok, 2800);
    for (let k = 0; k < 2; k++) { await ipcCons(tok); say('consumer 取一個，out 前進', 'out = (out + 1) % 5'); await W(tok, 800); }
    for (let k = 0; k < 2; k++) { await ipcProd(tok); say('in 繞回 0：circular buffer', ''); await W(tok, 800); }
    say('共用的是 buffer、in、out', '同步問題留到第 5 章（同步與互斥）');
    await W(tok, 2800);
  }
  async function scIpcMsg(tok) {
    ipc.mode = 'msg'; enterIpc(); controls('');
    say('課本：message passing 用 send / receive', '不用共用變數，跨電腦也適用');
    await W(tok, 2600);
    for (let k = 0; k < 3; k++) { await ipcProd(tok); say('send：copy 進 kernel 的 mailbox', 'indirect：透過 mailbox（port）'); await W(tok, 700); }
    for (let k = 0; k < 2; k++) { await ipcCons(tok); say('receive：從 kernel copy 出來', ''); await W(tok, 800); }
    say('每則 message 被 copy 2 次', 'blocking（同步）或 non-blocking（非同步）');
    await W(tok, 3000);
  }

  const scenes = {
    'program-vs-process': { title: 'Program（passive）vs Process（active）', play: scProgProc },
    'process-memory': { title: 'Process 的 memory：code、data、stack、heap', play: scMemLayout },
    'pcb': { title: 'PCB：PC、register、open files…', play: scPcb },
    'state-location': { title: '狀態 ↔ 位置：disk、memory、CPU', play: scStateLoc },
    'lt-st-scheduler': { title: 'Long-term vs Short-term scheduler', play: scLongShort },
    'midterm-swap': { title: 'Mid-term scheduler：swap out / swap in', play: scMidterm },
    'dop-mix': { title: 'Degree of multiprogramming 與 CPU/I/O mix', play: scDopMix },
    'st-overhead': { title: 'Short-term 演算法要快：10 ms / 100 ms = 10%', play: scStOverhead },
    'process-tree': { title: 'PID 與 process tree', play: scProcTree },
    'creation-options': { title: 'Parent 與 child 的三種關係選擇', play: scCreationOpts },
    'fork-return': { title: 'fork()：duplicate，回傳 PID / 0', play: scForkReturn },
    'exec-replace': { title: 'execlp：換掉 code、清空 heap 與 stack', play: scExecReplace },
    'fork-exec-wait': { title: 'fork → exec → wait（範例）', play: scForkExecWait },
    'copy-on-write': { title: 'Duplicate 的實作：copy-on-write', play: scCow },
    'five-state': { title: '課本：五狀態圖', play: scFiveState },
    'queueing-diagram': { title: '課本：ready queue 與 I/O queue', play: scQueues },
    'context-switch': { title: '課本：Context switch（PCB₀ ⇄ PCB₁）', play: scCtxSwitch },
    'fork-count': { title: '課本：fork 計數與 process tree', play: scForkCount },
    'ipc-shm-buffer': { title: '課本：Shared memory bounded buffer', play: scIpcShm },
    'ipc-message': { title: '課本：Message passing send / receive', play: scIpcMsg },
  };

  return {
    kicker: '作業系統・第 2 章',
    title: 'Process 管理',
    color: 'var(--os)',
    modes: [
      { id: 'states', name: '五狀態圖', enter: enterStates },
      { id: 'sched', name: '三種 scheduler', enter: enterSched },
      { id: 'ctx', name: 'Context switch', enter: enterCtx },
      { id: 'fork', name: 'fork() 樹', enter: enterFork },
      { id: 'ipc', name: 'IPC', enter: enterIpc },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: [
      'program-vs-process', 'process-memory', 'pcb',
      'five-state', 'state-location', 'queueing-diagram', 'lt-st-scheduler', 'midterm-swap', 'dop-mix', 'st-overhead', 'context-switch',
      'process-tree', 'creation-options', 'fork-return', 'exec-replace', 'fork-exec-wait', 'copy-on-write', 'fork-count',
      'ipc-shm-buffer', 'ipc-message',
    ],
    stop() { stopTimer(); modeGen++; },
  };
}
