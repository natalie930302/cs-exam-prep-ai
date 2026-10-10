// 作業系統 第2章：Process 管理（program vs process、memory layout、PCB、狀態與 queue、
// long/short/mid-term scheduler、context switch、fork/exec/wait、copy-on-write、IPC）。
// 場景依清大周志遠《作業系統》第 6B、8A、8B 講的段落與例子；課本＝恐龍書（Silberschatz）Ch3。
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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ proc.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 第 2 章 Process：清大周志遠 6A–9B、Neso fork/exec — cued scenes ───
// Every `await step(tok)` waits until the lecturer says that sentence (notes "cues");
// between steps only short moves (≤ ~2.5 s); nothing loops or replays.
// 課堂的例子照影片；動畫自己補的數字一律標「示意」。
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
const tx = (l, t) => P.txt(l, t);
async function slide(tok, o, x, y, z = 0, ms = 700) { const a = o.position.clone(); await travel(tok, o, a, V3(x, y, z), ms); }
const pal = (name, v, color, x, y = 0, z = 0, s = 0.8) => buddy(name, v, color, x, y, z, s);
const gone = (...os) => os.forEach((o) => { if (o) kill(o.g || o); });
const PC = ['#4b9ee2', '#e55a9b', '#2fc092', '#c08a1f', '#9b7ef4', '#31aab0', '#dd8238', '#5c7a4a'];
const CO = { cpu: '#4b9ee2', io: '#dd8238', os: '#9b7ef4', user: '#2fc092', disk: '#5c7a4a', paper: '#e9dcc4', idle: '#d8cfc0', bad: '#d64545', gold: '#c08a1f', kern: '#7d6bd6' };
// three places a process can be: disk, memory, CPU (zones + props)
function places(y = 0, labels = ['disk', 'memory', 'CPU'], xs = [-4.6, 0, 4.6]) {
  const zs = xs.map((x, i) => zone(labels[i], x, y + 0.02, 0, 3.4, 3.0, ['#d8e6cf', '#f3e6c8', '#d6e6f6'][i]));
  const d = prop('disk', xs[0] + 1.1, y, -0.9, 0.7), c = prop('cpu', xs[2] + 1.0, y, -0.9, 0.7);
  return { zs, d, c, xs };
}

// ════════ FiRH2TYB1Mw（第 6B 講）：program vs process、memory 內容、metadata ════════
FRAG.push(['proc-6b-progproc', 'Program（passive）vs Process（active）', async (tok) => {
  fresh([0, 5, 14], [0, 2.2, 0]);
  await step(tok);                                   // 136 program vs process 差在哪
  zone('disk', -3.6, 0.02, 0, 4.4, 3.2, '#d8e6cf'); zone('memory', 3.2, 0.02, 0, 4.4, 3.2, '#f3e6c8');
  hd('Program vs Process：差在哪？', 0, 5.4);
  cap('第一件事：Program 和 Process 差在哪', '');
  await step(tok);                                   // 146 中文都叫程式
  const zh = note('中文都叫「程式」→ 容易混淆', 0, 4.5);
  cap('中文都叫「程式」', '寫程式、執行程式，同一個詞');
  await step(tok);                                   // 156 英文兩個字
  remove(zh);
  bub('我寫程式 = programming', -3.6, 4.5); bub('我的程式在執行 = process', 3.2, 4.5);
  cap('英文分得很清楚', '所以鼓勵看原文');
  await step(tok);                                   // 195 program: passive entity
  const f = prop('file', -3.6, 0, 0, 1.2, 'program');
  hot('passive entity（被動、死的）', -3.6, 3.4);
  cap('Program：passive entity', '只是放著不動的東西');
  await step(tok);                                   // 202 binary code, bits/bytes
  const bits = ['0101', '1100', '0011'].map((b, i) => pkt(b, -5.0 + i * 1.4, 2.6, 0.6));
  cap('就是一些 binary code', '一堆 bits、bytes 的檔案');
  await step(tok);                                   // 217 在 disk 上等著被執行
  note('存在 disk 上，等著被執行', -3.6, 0.3, 1.9);
  cap('Program：disk 上等著被執行的程式碼', '');
  await step(tok);                                   // 232 process: active entity
  bits.forEach(remove);
  const pr = pal('process', '執行中', CO.user, -3.6, 0, 1.0, 0.8); pr.mood('happy');
  cap('Process：active entity', '正在 execute 的程式');
  await step(tok);                                   // 242 process = 在 memory 裡的 program
  await slide(tok, pr.g, 3.2, 0, 0.6, 1200); pr.mood('wow');
  hot('active entity（正在動）', 3.2, 3.4);
  cap('Process 就是在 memory 裡的 program', '位置不一樣');
  await step(tok);                                   // 248 CPU 只能 access memory
  const c = prop('cpu', 6.0, 0, -1.6, 0.8, 'CPU');
  arr(5.4, 0.8, 4.3, 0.8, CO.cpu);
  cap('因為 CPU 只能 access memory', 'program 留在 disk 上它碰不到');
  await step(tok);                                   // 265 差很多，用字要對
  good('process ≠ program', 0, 1.0, 1.8);
  cap('兩個是不一樣的東西', '回答問題時用字要分清楚');
  await step(tok);                                   // 279 OS 管的是 process
  pr.glow('#6a4a00'); pr.mood('happy');
  hd('OS 這章要介紹的是 process', 0, 6.2);
  cap('OS 關心的是 process', '怎麼寫 program 大一大二學過了');
  void f; void c;
}]);

FRAG.push(['proc-6b-memory', 'Process 的 memory：code、data、stack、heap', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.6, 0]);
  const X = 3.4;
  await step(tok);                                   // 292 process 在 memory 裡
  zone('memory', X, 0.02, 0, 3.6, 3.0, '#f3e6c8');
  hd('一個 process 的 memory space', X, 6.3);
  cap('Process 在 memory 裡', '');
  await step(tok);                                   // 302 有自己的 space、切成區塊
  const frame = P.ghostBox('#9b7ef4', 2.8, 5.0, 1.3); frame.position.set(X, 2.7, 0);
  tag('max', 'idx', X + 1.8, 5.1); tag('0', 'idx', X + 1.8, 0.3);
  cap('每個 process 有自己的 space', '裡面的 content 切成幾個區塊');
  await step(tok);                                   // 316 code segment
  const S = {};
  S.code = bx('code（text）', CO.cpu, X, 0.55, 0, 2.6, 0.9, 1.1, 2);
  cap('第一塊：code segment', '簡單講就是你的程式碼');
  await step(tok);                                   // 333 程式碼原本在 file，load 進 memory
  const f = prop('file', -5.2, 0, 0, 1.0, 'a.out');
  const pk = pkt('load', -4.6, 1.4, 0.6);
  await travel(tok, pk, V3(-4.6, 1.4, 0.6), V3(X - 1.6, 0.6, 0.8), 1200); remove(pk);
  cap('原本在 file，執行時 load 進 memory', '沒有程式碼怎麼執行');
  await step(tok);                                   // 347 等 CPU fetch 的 instruction
  const cpu = prop('cpu', -1.6, 0, 0, 0.9, 'CPU');
  const ins = pkt('instruction', X - 1.4, 0.8, 0.8);
  await travel(tok, ins, V3(X - 1.4, 0.8, 0.8), V3(-1.4, 1.2, 0.6), 1000); remove(ins);
  cap('放在 memory 等 CPU fetch', '一道一道 instruction');
  await step(tok);                                   // 357 compile 好的機器指令
  note('compile 好的指令，不是 C code', X, 1.4, 1.0);
  cap('不是 C code', '是 compile 好、直接送進 CPU 的指令');
  await step(tok);                                   // 367 接下來三塊放變數
  gone(f, cpu);
  const cd = code(['int g;            // 示意', 'int main() {', '  int x;', '  p = malloc(8);', '}'], -3.6, 5.0, 0.55);
  cap('接下來三塊放 variable', '變數放在三個不同的地方，非常重要');
  await step(tok);                                   // 386 data section：global
  S.data = bx('data', CO.user, X, 1.45, 0, 2.6, 0.8, 1.1, 2);
  cd.hl(0);
  cap('第一個：data section', '放 global variable');
  await step(tok);                                   // 404 load 時就存在，所有 function 都看得到
  const g = pkt('g', -3.6, 5.0, 0.6); await travel(tok, g, V3(-3.6, 5.0, 0.6), V3(X, 1.5, 0.8), 1000);
  cap('load 時就知道它存在', '任何 function 都 access 得到');
  await step(tok);                                   // 423 範圍不會剛剛好
  note('留一段範圍，因為會動態增加', X, 3.4, 1.0);
  cap('不會切得剛剛好', '後面會動態增加，所以留一個範圍');
  await step(tok);                                   // 433 stack：local variable
  S.stack = bx('stack ↓', CO.os, X, 4.6, 0, 2.6, 0.8, 1.1, 2);
  cd.hl(2);
  const x = pkt('x', -3.6, 3.9, 0.6); await travel(tok, x, V3(-3.6, 3.9, 0.6), V3(X, 4.6, 0.8), 1000);
  cap('stack 放 local variable', 'function 裡的變數');
  await step(tok);                                   // 445 function return 就 pop 掉
  cd.hl(4);
  await anim(tok, 800, (u) => { x.position.y = 4.6 + u * 2; }); remove(x);
  cap('function return 就消失', '用 stack 一次 pop 掉，有效率');
  await step(tok);                                   // 463 heap：dynamic allocation
  S.heap = bx('heap ↑', CO.io, X, 2.35, 0, 2.6, 0.8, 1.1, 2);
  cd.hl(3);
  const h = pkt('8 bytes', -2.6, 3.4, 0.6); await travel(tok, h, V3(-2.6, 3.4, 0.6), V3(X, 2.4, 0.8), 1000);
  cap('heap：dynamic allocation', 'malloc 出來的東西放這裡');
  await step(tok);                                   // 465 最自由也最要小心
  bad('最自由，也最要小心', X - 3.4, 2.4, 0.8);
  cap('大家最怕的一塊', '最自由，但自己要最小心');
  await step(tok);                                   // 478 要知道變數放哪
  cd.hl(-1);
  Object.values(S).forEach((m) => glow(m, '#3a2a00'));
  good('知道變數放在哪一區', -3.6, 1.6, 0.6);
  cap('寫程式要清楚變數放在哪', '每一區的管理方式不同');
}]);

FRAG.push(['proc-6b-meta', 'Process 的 metadata：PC、register、resource', async (tok) => {
  fresh([0, 5, 14], [0, 2.4, 0]);
  await step(tok);                                   // 495 還需要 metadata
  zone('memory 內容', -3.8, 0.02, 0, 3.4, 3.0, '#f3e6c8');
  ['code', 'data', 'heap', 'stack'].forEach((n, i) => bx(n, [CO.cpu, CO.user, CO.io, CO.os][i], -3.8, 0.35 + i * 0.7, 0, 2.2, 0.6, 1));
  hd('metadata：管理這個 process 的資料', 2.6, 5.6);
  const card = bx('', '#fffaf0', 2.6, 2.6, 0, 3.8, 4.0, 0.3);
  cap('除了 memory 裡的東西', '還需要管理 process 的 metadata');
  await step(tok);                                   // 501 program counter
  const pcRow = bx('program counter', CO.gold, 2.6, 4.1, 0.3, 3.4, 0.6, 0.3);
  const pp = arr(0.8, 4.1, -2.6, 0.5, CO.gold, 0.4);
  cap('最重要：program counter', '目前執行到哪裡');
  await step(tok);                                   // 507 register content
  const rg = bx('register 內容', CO.cpu, 2.6, 3.3, 0.3, 3.4, 0.6, 0.3);
  cap('還有 register 的 content', '執行過程中會用到 register');
  await step(tok);                                   // 517 CPU 是很多程式共用
  const cpu = prop('cpu', 6.0, 0, 1.6, 0.8, 'CPU');
  const a = pal('P1', '', PC[0], 4.4, 0, 2.6, 0.55), b = pal('P2', '', PC[1], 6.6, 0, 3.0, 0.55);
  a.mood('happy'); b.mood('sad');
  cap('CPU 是很多程式在共用', 'register 不可能一直歸你用');
  await step(tok);                                   // 522 被 switch 走時要存下來
  const r = pkt('r1, r2, …', 5.6, 1.4, 1.8);
  await travel(tok, r, V3(5.6, 1.4, 1.8), V3(2.6, 3.3, 0.6), 1100); remove(r);
  a.mood('calm'); b.mood('happy');
  cap('被 switch 換走時', 'register 的值要存起來，讓出來');
  await step(tok);                                   // 532 resource
  const fl = prop('file', 1.2, 1.5, 0.3, 0.6);
  bx('resource：開的 file、socket…', CO.io, 2.6, 2.5, 0.3, 3.4, 0.6, 0.3);
  cap('最後是 resource 的狀態', '開 file、用系統資源時拿到的 reference');
  await step(tok);                                   // 544 知道開了哪些 file、哪些 port
  note('a.txt、socket port 8080（示意）', 2.6, 1.6, 0.8);
  cap('記得開了哪些 file', '用了哪些 socket 的 port');
  void card; void pcRow; void pp; void rg; void cpu; void fl;
}]);

// ════════ AztAXONxs7M（第 8A 講）：狀態 ↔ 位置、三種 scheduler、degree、mix、overhead ════════
// a little crowd of processes (buddies) laid out in a grid inside a zone
function crowd(n, x0, z0, names, colors, s = 0.48, cols = 3, dx = 0.95, dz = 0.9) {
  return Array.from({ length: n }, (_, k) => pal(names ? names[k] : '', '', colors ? colors[k % colors.length] : PC[k % 8], x0 + (k % cols) * dx, 0, z0 + Math.floor(k / cols) * dz, s));
}
const setCls = (l, cls) => { l.element.className = 'lab-label ' + cls; };
FRAG.push(['proc-8a-stateloc', '狀態 ↔ 位置：disk、memory、CPU', async (tok) => {
  fresh([0, 6, 14], [0, 1.4, 0]);
  places();
  await step(tok);                                   // 15 OS 要做 scheduling：CPU 很少
  hot('CPU 只有個位數～十幾個 core', 4.6, 3.0);
  cap('除了切換 state，OS 還要做 scheduling', 'CPU 的數量很少');
  await step(tok);                                   // 20 memory 裡的 process 很多
  const mem = crowd(6, -0.95, -0.6, ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'], null);
  cap('memory 裡的 process 卻很多', 'multiprogramming');
  await step(tok);                                   // 44 輪流使用 CPU
  await slide(tok, mem[0].g, 4.6, 0, 0.4, 700); mem[0].mood('happy');
  await wt(tok, 300);
  await slide(tok, mem[0].g, -0.95, 0, -0.6, 700); mem[0].mood('calm');
  cap('所以大家輪流使用 CPU', '');
  await step(tok);                                   // 48 等著被 load 的 program 更多
  const dk = crowd(9, -5.55, -0.9, null, ['#c9b48e', '#b9a27a'], 0.4, 3, 0.95, 0.8);
  cap('等著被 load 進 memory 的更多', 'memory 也是有限的');
  await step(tok);                                   // 62 不是想執行就能進 memory
  dk[0].mood('sad'); dk[4].mood('sad');
  bad('memory 滿了：要排隊', 0, 3.0);
  cap('使用者說要執行，不一定進得去', '也要排程決定誰先');
  await step(tok);                                   // 81 CPU = running
  good('running', 4.6, 2.4, 1.4);
  cap('對到 state：在 CPU 上 = running', '');
  await step(tok);                                   // 86 memory = ready
  good('ready', 0, 2.4, 1.4);
  mem.forEach((b) => b.mood('happy'));
  cap('在 memory 裡 = ready', 'ready to run');
  await step(tok);                                   // 94 disk = new
  good('new', -4.6, 2.4, 1.4);
  cap('還在 disk 上 = new', '只是被 create，等著搶進 memory');
  await step(tok);                                   // 112 執行完 = terminated
  const t = pal('P7', '', PC[6], 4.6, 0, 0.3, 0.5); t.mood('happy');
  await wt(tok, 300); await slide(tok, t.g, 6.4, 0, 2.6, 900);
  hd('terminated', 5.8, 1.2, 2.6);
  cap('執行完離開 = terminated', '');
  await step(tok);                                   // 118 特別的：waiting
  await slide(tok, mem[5].g, 0.6, 0, 1.6, 700); mem[5].mood('sad'); mem[5].glow('#3a2400');
  bad('waiting', 1.4, 1.4, 2.2);
  cap('唯一特別的是 waiting', '');
  await step(tok);                                   // 122 等別人、interrupt、sleep
  note('等別人 / 等 interrupt / call sleep()', 0.6, 3.6, 1.6);
  cap('在等別人、等 interrupt', '或自己 call sleep 這種 system call');
  await step(tok);                                   // 137 在 memory 但 CPU 空也不能跑
  arr(1.4, 1.0, 3.6, 1.0, CO.bad, 1.6); bad('✗', 2.5, 1.5, 1.6);
  cap('在 memory，但就算 CPU 空也不能執行', '這就是 waiting state');
}]);

FRAG.push(['proc-8a-ltst', 'Long-term（job）vs Short-term（CPU）scheduler', async (tok) => {
  fresh([0, 6, 14], [0, 1.4, 0]);
  places(0, ['disk（new）', 'memory（ready）', 'CPU（running）']);
  const dk = crowd(4, -5.4, -0.6, ['A', 'B', 'C', 'D'], ['#c9b48e', '#b9a27a'], 0.45, 2, 1.2, 1.0);
  const mem = crowd(3, -0.95, -0.6, ['P1', 'P2', 'P3'], null, 0.45);
  await step(tok);                                   // 158 要搶就要排程
  arr(-2.9, 1.8, -1.7, 1.8, CO.gold); arr(1.7, 1.8, 2.9, 1.8, CO.gold);
  cap('三個階段之間要搶', '要搶就需要 schedule');
  await step(tok);                                   // 171 進 CPU：CPU scheduling
  hot('CPU scheduling', 2.3, 2.6);
  await slide(tok, mem[0].g, 4.4, 0, 0, 700);
  cap('進到 CPU：CPU scheduling', '');
  await step(tok);                                   // 175 進 memory：job scheduling
  hot('job scheduling', -2.3, 2.6);
  await slide(tok, dk[0].g, 0.95, 0, 0.4, 700);
  cap('進到 memory：job scheduling', '不同的 scheduler 負責');
  await step(tok);                                   // 190 CPU scheduler = short-term
  good('short-term', 2.3, 3.4);
  cap('CPU scheduler 又叫 short-term', '照字面理解：很頻繁');
  await step(tok);                                   // 204 time sharing：每幾 ms 一個 alarm
  pkt('⏰ timer alarm', 4.6, 3.6, 0);
  await slide(tok, mem[0].g, 0.95, 0, 0.6, 450);
  await slide(tok, mem[1].g, 4.4, 0, 0, 450);
  cap('time sharing：每幾 ms 響一次 alarm', '打斷程式，叫 OS 重新排');
  await step(tok);                                   // 216 頻率非常高
  await slide(tok, mem[1].g, -0.95, 0, 0.6, 400);
  await slide(tok, mem[2].g, 4.4, 0, 0, 400);
  idx('幾 ms 一次', 2.3, 2.2);
  cap('頻率非常非常高', '所以叫 short-term');
  await step(tok);                                   // 225 job = long-term：幾秒、幾分鐘
  good('long-term', -2.3, 3.4);
  idx('幾秒～幾分鐘一次', -2.3, 2.2);
  cap('job scheduler 叫 long-term', '相較之下很久才做一次');
  await step(tok);                                   // 245 因為是使用者 launch 才需要
  const u = pal('使用者', '', '#f0c27a', -5.0, 0, 2.6, 0.6); u.mood('happy');
  bub('我要開程式！', -5.0, 1.6, 2.6);
  await slide(tok, dk[1].g, 0.95, 0, 1.4, 800);
  cap('人 launch 新 process 才要排', '人的動作大概幾秒一次');
  await step(tok);                                   // 271 對應記好
  note('short-term = CPU；long-term = job', 0, 4.4);
  cap('short-term ↔ CPU scheduling', 'long-term ↔ job scheduling');
}]);

FRAG.push(['proc-8a-midterm', 'Mid-term scheduler：把 process swap 回 disk', async (tok) => {
  fresh([0, 6, 14], [0, 1.4, 0]);
  zone('disk', -3.8, 0.02, 0, 4.6, 3.2, '#d8e6cf'); zone('memory（容量有限）', 2.8, 0.02, 0, 5.0, 3.2, '#f3e6c8');
  prop('disk', -5.4, 0, -1.0, 0.7);
  const ps = crowd(6, 1.3, -0.7, ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'], null, 0.5, 3, 1.4, 1.2);
  await step(tok);                                   // 284 中間還有 mid-term
  hot('mid-term scheduler', -0.6, 3.8);
  cap('兩者中間還有一個', 'mid-term scheduler');
  await step(tok);                                   // 297 把 process 從 memory swap 回 disk
  arr(0.6, 2.8, -1.8, 2.8, CO.bad);
  cap('它決定什麼時候', '把 process 從 memory swap 回 disk');
  await step(tok);                                   // 315 跟 virtual memory 結合
  bx('拿來當 memory 用', '#f3e6c8', -3.8, 0.2, 1.0, 3.6, 0.3, 0.9);
  cap('跟 virtual memory 結合', 'disk 拿一塊當 memory 用');
  await step(tok);                                   // 337 memory 不夠：踢回 disk
  ps.slice(3).forEach((b) => b.mood('sad'));
  bad('memory 不夠了', 2.8, 3.2);
  await slide(tok, ps[5].g, -3.0, 0, 0.9, 900);
  cap('memory 不夠時', '把一些 process 踢回 disk');
  await step(tok);                                   // 349 swapping：memory content dump 到 disk
  await slide(tok, ps[4].g, -4.6, 0, 0.9, 800);
  good('swapping', -3.8, 2.6);
  cap('這個動作叫 swapping', '把 memory content dump 到 disk');
  await step(tok);                                   // 367 allocate 1 GB 但不會立刻用
  const big = bx('allocate 1 GB', '#e8d9bd', 4.6, 2.2, 1.0, 1.6, 0.8, 0.8);
  note('真的會馬上用嗎？不會', 4.6, 3.4, 1.0);
  cap('程式可以 allocate 很大的空間', '但不一定會立刻用');
  await step(tok);                                   // 387 沒用到的空間切到 disk
  await slide(tok, big, -3.8, 1.2, -0.6, 900);
  cap('沒在用的空間就搬到 disk', '保留 memory 的空間');
  await step(tok);                                   // 410 被搬走的 process 不能直接跑
  ps[4].glow('#3a2400'); ps[5].glow('#3a2400');
  hd('不能直接執行', -3.8, 3.6);
  cap('整個 process 被搬到 disk', '要執行前得先搬回 memory');
  await step(tok);                                   // 443 是 memory content，不是檔案
  note('存的是 memory content，不是程式檔', -3.8, -0.4, 2.0);
  cap('不是你的程式檔', '是 memory content 的形式存到 disk');
  await step(tok);                                   // 458 有空了 / 被選中：先搬回 memory
  ps[4].glow(null); ps[4].mood('happy');
  await slide(tok, ps[4].g, 4.1, 0, 0.5, 900);
  good('swap in → ready', 3.4, 1.6, 1.4);
  cap('有空位或被選中要執行', 'mid-term 先搬回 memory 才回到 ready');
}]);

FRAG.push(['proc-8a-dopmix', 'Degree of multiprogramming 與 CPU / I/O mix', async (tok) => {
  fresh([0, 5.5, 14], [0, 2.0, 0]);
  zone('memory', 0, 0.02, 0, 4.4, 3.2, '#f3e6c8');
  prop('cpu', -5.0, 0, 0, 1.0, 'CPU'); prop('printer', 5.0, 0, 0, 1.0, 'I/O device');
  const deg = hot('degree = 0', 0, 4.4);
  let mem = [];
  const fill = (kinds) => { gone(...mem); mem = kinds.map((k, i) => pal(k === 'C' ? 'CPU' : 'I/O', '', k === 'C' ? CO.cpu : CO.io, -1.5 + (i % 4) * 1.0, 0, -0.9 + Math.floor(i / 4) * 1.1, 0.45)); tx(deg, 'degree = ' + kinds.length); };
  await step(tok);                                   // 491 long-term 控制 degree
  good('long-term scheduler 控制它', 0, 5.2);
  cap('long-term 的角色', '控制 degree of multiprogramming');
  await step(tok);                                   // 507 degree = memory 裡有幾個 process
  fill(['C', 'I', 'C']);
  cap('degree：memory 裡有幾個 process', 'multiprogramming 的「幾個」');
  await step(tok);                                   // 530 決定 new 能不能進 memory
  const nw = pal('new', '', '#c9b48e', -3.2, 0, 2.2, 0.45);
  await slide(tok, nw.g, 1.5, 0, 0.2, 800); gone(nw); fill(['C', 'I', 'C', 'I']);
  cap('決定 new 的程式能不能進 memory', '就是在控制 degree');
  await step(tok);                                   // 543 太少：CPU idle（batch = 1）
  fill(['C']); const lo = bad('CPU 在等 I/O → idle', -5.0, 2.4);
  cap('degree 太少：CPU 可能 idle', '像 batch，degree 永遠是 1');
  await step(tok);                                   // 559 太高：thrashing
  remove(lo);
  fill(['C', 'I', 'C', 'I', 'C', 'I', 'C', 'I', 'C', 'I', 'C', 'I']); mem.forEach((b) => b.mood('sad'));
  const th = bad('一直 swapping → thrashing', 0, 3.6);
  cap('degree 太高：thrashing', '大家搶 memory，一直在 swapping');
  await step(tok);                                   // 589 long-term：頻率不高、使用者驅動
  remove(th); fill(['C', 'I', 'C', 'I']);
  note('沒新 process 進來，long-term 就沒事做', 0, 6.0);
  cap('long-term 執行頻率不高', '由使用者驅動');
  await step(tok);                                   // 607 選誰進 memory 影響效能
  const pick = idx('不能全部讓它進來：要挑', 0, 3.6);
  cap('它要挑哪些 process 進 memory', '怎麼挑會影響效能');
  await step(tok);                                   // 619 目的：CPU 和 I/O 時間 overlap
  remove(pick);
  const ov = note('CPU 時間 ≈ I/O 時間 → overlap', 0, 3.6);
  cap('multiprogramming 的目的', 'CPU 和 I/O 的時間 overlap');
  await step(tok);                                   // 644 全是 CPU-bound
  remove(ov);
  fill(['C', 'C', 'C', 'C', 'C', 'C']);
  const s1 = bad('I/O 閒著', 5.0, 2.6), s2 = good('CPU 很忙', -5.0, 2.6);
  cap('全是 CPU-bound', 'CPU 忙翻，I/O bandwidth 浪費');
  await step(tok);                                   // 680 全是 I/O-bound
  fill(['I', 'I', 'I', 'I', 'I', 'I']);
  tx(s1, '大家都在等 I/O'); tx(s2, 'CPU 仍然 idle'); setCls(s1, 'good'); setCls(s2, 'bad');
  cap('全是 I/O-bound：都在 printf、scanf', 'I/O 很慢，CPU 仍然 idle');
  await step(tok);                                   // 706 挑出平衡的 mix
  fill(['C', 'I', 'C', 'I', 'C', 'I']); mem.forEach((b) => b.mood('happy'));
  tx(s1, 'I/O 也忙'); tx(s2, 'CPU 忙'); setCls(s1, 'good'); setCls(s2, 'good');
  cap('選進來的要讓 CPU 和 I/O 平衡', '兩邊都不 idle，使用率才會增加');
  await step(tok);                                   // 734 使用者的程式可能突然全是某一種
  note('找一個好的 mix ratio', 0, 3.6);
  cap('使用者的程式可能突然全是 CPU-bound', 'scheduler 要從中挑出好的 mix');
  await step(tok);                                   // 749 現代電腦：long-term 淡化
  bx('memory 很大 + virtual memory', '#f3e6c8', 0, 3.0, -1.6, 4.0, 0.4, 0.6);
  cap('現代 memory 大的電腦', 'long-term 的角色已被淡化');
  await step(tok);                                   // 795 角色流到 mid-term
  hot('mid-term：決定誰被 kick out 回 disk', 0, 6.6);
  cap('角色流到 mid-term scheduler', '先全部載入，再挑誰踢回 disk');
  await step(tok);                                   // 821 重要的是 mix 和 degree
  good('重點：CPU / I/O mix + degree', 0, 1.4, 2.0);
  cap('誰來控制不重要', 'ready queue 的 mix 和 degree 才重要');
}]);

FRAG.push(['proc-8a-stdesign', 'Short-term scheduler：頻繁、要公平、演算法要快', async (tok) => {
  fresh([0, 5.5, 14], [0, 2.2, 0]);
  prop('cpu', 4.6, 0, 0, 1.0, 'CPU');
  const q = crowd(4, -4.6, 0, ['P1', 'P2', 'P3', 'P4'], null, 0.5, 4, 1.1, 0);
  hd('ready queue', -3.0, 1.6);
  await step(tok);                                   // 872 大概 100 ms 一次
  pkt('⏰ 每 100 ms', 4.6, 2.6);
  cap('short-term：大概 100 ms 一次', '甚至更短，由 timer 控制');
  await step(tok);                                   // 897 system call、I/O interrupt 也會叫它
  bub('system call！', 1.6, 3.4); bub('I/O interrupt！', 1.6, 4.1);
  cap('還有 system call、I/O interrupt', '被叫起的頻率更高');
  await step(tok);                                   // 920 long-term 在前，short-term 在後
  arr(-6.4, 0.5, -5.2, 0.5, CO.gold); idx('long-term', -6.0, 1.1); arr(-0.6, 0.5, 3.4, 0.5, CO.gold); idx('short-term', 1.4, 1.1);
  cap('long-term 在前，short-term 在後', '做完 I/O 回到 ready queue');
  await step(tok);                                   // 930 重點是演算法
  hot('scheduling algorithm', 0, 5.4);
  cap('short-term 的重點是它的演算法', '後面有整章介紹');
  await step(tok);                                   // 946 第一個要確保：wait time
  q.forEach((b) => b.mood('sad'));
  note('平均等了多久（wait time）', -3.0, 2.6);
  cap('第一個：wait time', '大家都不喜歡等很久，像中午排隊買飯');
  await step(tok);                                   // 976 同樣的人、不同演算法 → 平均不同
  await slide(tok, q[3].g, -4.6, 0, 0.9, 400);
  await slide(tok, q[0].g, -1.3, 0, 0.9, 400);
  idx('換個順序（示意）→ 平均 wait time 不同', -3.0, 3.4);
  cap('同樣的人、同樣的順序進來', '不同演算法 → 平均 wait time 不同');
  await step(tok);                                   // 992 fairness
  good('fairness：每個人等得差不多', -3.0, 4.2);
  cap('或是 fairness', 'priority、round-robin 等演算法');
  await step(tok);                                   // 1007 平均低 ≠ 大家都高興
  q[1].mood('happy'); q[2].mood('happy');
  bad('平均很低 ≠ 大家都滿意', 1.0, 2.6);
  cap('平均很低不代表大家都高興', '國家收入高，不代表均富');
  await step(tok);                                   // 1041 直接影響效能、response time
  hd('response time', 4.6, 3.6);
  cap('short-term 直接決定等待時間', '影響效能和使用者看到的 response time');
  await step(tok);                                   // 1058 演算法本身要很快
  gone(...q);
  bad('queue 很長 + n² 演算法 → 太慢', -2.4, 2.6);
  cap('偏偏演算法本身必須非常有效率', 'queue 很長時 n² 會很驚人');
  await step(tok);                                   // 1099 100 ms 跑 10 ms → 10%
  const u = 0.03, x0 = -6.2;
  for (let k = 0; k < 3; k++) {
    cube('', CO.bad, [10 * u, 0.5, 0.6], x0 + (k * 100 + 5) * u, 0.4, 1.6); cube('', CO.user, [90 * u, 0.5, 0.6], x0 + (k * 100 + 55) * u, 0.4, 1.6);
    await wt(tok, 250);
  }
  idx('10 ms / 100 ms = 10% overhead', 3.8, 1.0, 1.6);
  cap('例：每 100 ms 排一次，每次跑 10 ms', '10% 的 CPU 是 overhead');
  await step(tok);                                   // 1123 50 ms → 一半沒在做事
  for (let k = 0; k < 3; k++) {
    cube('', CO.bad, [50 * u, 0.5, 0.6], x0 + (k * 100 + 25) * u, 0.4, 3.0); cube('', CO.user, [50 * u, 0.5, 0.6], x0 + (k * 100 + 75) * u, 0.4, 3.0);
    await wt(tok, 250);
  }
  bad('50 ms → 一半時間沒在做使用者的事', 3.8, 1.0, 3.0);
  cap('如果要 50 ms', 'CPU 100% 忙，使用者卻覺得很慢');
  await step(tok);                                   // 1167 太複雜的不實用
  good('演算法要簡單、快', 4.6, 4.4);
  cap('太複雜的演算法', '在現實中不 practical');
}]);

FRAG.push(['proc-8a-swapio', 'Mid-term：swap out 與 swap in', async (tok) => {
  fresh([0, 6, 14], [0, 1.4, 0]);
  zone('disk', -3.8, 0.02, 0, 4.6, 3.2, '#d8e6cf'); zone('memory', 2.8, 0.02, 0, 5.0, 3.2, '#f3e6c8');
  prop('disk', -5.4, 0, -1.0, 0.7); prop('cpu', 6.4, 0, -2.4, 0.6, 'CPU');
  const ps = crowd(6, 1.3, -0.7, ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'], [CO.cpu, CO.cpu, CO.cpu, CO.io, CO.cpu, CO.io], 0.5, 3, 1.4, 1.2);
  await step(tok);                                   // 1184 swap out / swap in
  hot('mid-term：swap out ⇄ swap in', -0.6, 4.0);
  cap('mid-term 做 swap out 和 swap in', '在 disk 和 memory 之間切換');
  await step(tok);                                   // 1207 swap out：搬回 disk
  ps[4].mood('sad'); await slide(tok, ps[4].g, -3.6, 0, 0.2, 900);
  cap('swap out：把 process 從 memory 搬回 disk', '');
  await step(tok);                                   // 1215 為了控制 degree
  const d = bad('太多 → thrashing', 2.8, 3.1);
  cap('為什麼要搬？控制 degree', '太多會 thrashing');
  await step(tok);                                   // 1222 CPU 很忙卻沒跑使用者的指令
  const n2 = note('CPU 忙著搬，使用者的指令沒在跑', 2.8, 3.8);
  cap('CPU 很忙碌', '但根本不在跑使用者的指令');
  await step(tok);                                   // 1234 swap in：位置空出來就搬回來
  remove(d); remove(n2); gone(ps[1]);
  ps[4].mood('happy'); await slide(tok, ps[4].g, 2.7, 0, -0.7, 900);
  cap('swap in：memory 位置空出來', '讓等在 disk 的再回來執行');
  await step(tok);                                   // 1253 improve process mix
  await slide(tok, ps[2].g, -4.8, 0, 0.6, 700); ps[2].mood('sad');
  good('改善 CPU / I/O mix', 2.8, 3.4);
  cap('最主要：improve process mix', '挑誰留在 memory、誰先離開');
  await step(tok);                                   // 1272 現代沒有 long-term，靠 mid-term
  idx('現代：先全部進來，再由 mid-term 管', -0.6, 5.0);
  cap('現在的電腦沒有 long-term', '進來之後靠 mid-term 進一步管理');
  await step(tok);                                   // 1285 free 出 memory 給正在執行的
  await slide(tok, ps[5].g, -2.6, 0, 0.6, 700);
  good('memory 讓給真的在執行的', 4.0, 1.6, 1.6);
  cap('第二：free out memory', '讓給正在執行的，而不是在等的');
  await step(tok);                                   // 1317 跟 virtual memory 結合
  hd('之後在 virtual memory 章節講清楚', 0, 6.0);
  cap('mid-term 跟 virtual memory 結合', '後面章節會講得更清楚');
}]);

// ════════ ETPHC9DffdU（第 8B 講）：PID、process tree、parent/child 的選擇、fork、exec、wait、copy-on-write ════════
FRAG.push(['proc-8b-recap', '回顧：三種 scheduler 的角色', async (tok) => {
  fresh([0, 5, 14], [0, 2.0, 0]);
  await step(tok);                                   // 15 三種 scheduler
  const L = ['short-term', 'long-term', 'mid-term'].map((n, i) => bx(n, [CO.cpu, CO.user, CO.io][i], -4.2 + i * 4.2, 3.6, 0, 3.2, 0.7, 1, 2));
  cap('剛剛三種不同 type 的 scheduler', '');
  await step(tok);                                   // 16 CPU：一定要很 efficient
  glow(L[0], '#3a2a00'); good('一定要很 efficient', -4.2, 2.6);
  cap('CPU（short-term）：一定要很 efficient', '');
  await step(tok);                                   // 17 long-term：控制 degree
  glow(L[1], '#3a2a00'); good('控制 degree', 0, 2.6);
  cap('long-term：控制 degree of multiprogramming', '');
  await step(tok);                                   // 19 mid-term：swapping
  glow(L[2], '#3a2a00'); good('做 swapping', 4.2, 2.6);
  note('現代 OS 會綁上其他機制，但原則一樣', 0, 1.2);
  cap('mid-term：做 swapping', '現代更複雜，但要做的事情原則上是這些');
}]);

FRAG.push(['proc-8b-tree', 'PID 與 tree of processes', async (tok) => {
  fresh([0, 4, 14.5], [0, 3.2, 0]);
  // 課本 Fig. 3.8（Linux 的 process tree）
  const T = [['init', 1, null], ['login', 8415, 1], ['kthreadd', 2, 1], ['sshd', 3028, 1], ['bash', 8416, 8415], ['pdflush', 200, 2], ['khelper', 6, 2], ['sshd', 3610, 3028], ['ps', 9298, 8416], ['emacs', 9204, 8416], ['tcsch', 4005, 3610]];
  const pos = { 1: [0, 5.6], 8415: [-3.6, 4.2], 2: [0, 4.2], 3028: [3.6, 4.2], 8416: [-3.6, 2.8], 200: [-0.9, 2.8], 6: [0.9, 2.8], 3610: [3.6, 2.8], 9298: [-4.7, 1.4], 9204: [-2.5, 1.4], 4005: [3.6, 1.4] };
  const M = {};
  const add = (n, pid, par) => { const [x, y] = pos[pid]; if (par !== null) M['e' + pid] = ln(pos[par][0], pos[par][1] - 0.25, x, y + 0.25, 0, '#8a7a5c'); M[pid] = bx(n + ' · ' + pid, PC[pid % 8], x, y, 0, 1.7, 0.5, 0.7, 2); };
  await step(tok);                                   // 54 進入 process 本身
  const os = pal('OS', '', CO.os, -5.4, 0, 1.6, 0.7);
  cap('剛剛講 OS 怎麼管理 process', '接下來看 process 本身');
  await step(tok);                                   // 65 programmer 怎麼 create、怎麼溝通
  const pg = pal('programmer', '', '#f0c27a', 5.4, 0, 1.6, 0.7); pg.mood('happy');
  bub('怎麼 create process？怎麼溝通？', 5.0, 1.6, 1.6);
  cap('回到 user / programmer', '怎麼 create process、怎麼溝通');
  await step(tok);                                   // 83 process 是 entity：要 unique ID
  const me = pal('process', '?', PC[2], 0, 0, 1.6, 0.7);
  cap('process 是一個 entity', '要認得它，就需要一個 unique 的 ID');
  await step(tok);                                   // 91 PID
  me.set('PID'); hot('process identifier（PID）', 0, 1.3, 1.6);
  cap('這個 ID 叫 process identifier', '簡稱 PID');
  await step(tok);                                   // 98 一被 create 就 assign PID
  me.mood('happy'); await me.hop(tok);
  cap('process 只要被 create 出來', '就會被 assign 一個 PID');
  await step(tok);                                   // 111 有 parent / children 關係
  gone(me, os, pg);
  cap('process 不是一開始就全部跑出來', '要被 create，有 parent / children 關係');
  await step(tok);                                   // 122 一開始只有一個 process
  add('init', 1, null);
  cap('一開始整台電腦只有一個 process', '');
  await step(tok);                                   // 128 由它 create 其他 process
  for (const [n, pid, par] of T.slice(1, 4)) { add(n, pid, par); await wt(tok, 350); }
  cap('透過這個 process', '才 create 出其他 process');
  await step(tok);                                   // 137 任何時候都畫得出一棵 tree
  for (const [n, pid, par] of T.slice(4)) { add(n, pid, par); await wt(tok, 200); }
  hd('tree of processes（課本 Fig. 3.8）', 0, 6.6);
  cap('任何系統、任何時候', '都畫得出一棵 tree，沒有例外');
  await step(tok);                                   // 148 不會有 parent 不存在的 process
  const lone = bx('? · 7777', CO.idle, 5.6, 0.4, 0, 1.5, 0.5, 0.7); bad('沒有 parent？不可能', 5.4, 1.2);
  cap('不可能 parent 不存在', '像 dangling pointer 一樣，OS 不允許');
  await step(tok);                                   // 166 parent 不見了，下面全部砍掉
  kill(lone);
  for (const pid of [8416, 9298, 9204]) glow(M[pid], '#5a1010');
  await wt(tok, 500);
  for (const pid of [9298, 9204, 8416]) { kill(M[pid]); kill(M['e' + pid]); await wt(tok, 250); }
  cap('parent 不見了，下面的全部砍掉', '不然 OS 不知道怎麼管理');
  await step(tok);                                   // 179 ps -ael
  const ps = code(['$ ps -ael', '  PID  PPID  CMD', '    1     0  init', ' 8415     1  login'], 4.6, 0.9, 0.42);
  cap('在 server 上打 ps -ael', 'list 出所有 process 和 PID');
  await step(tok);                                   // 199 會告訴你 parent 是誰：重建 tree
  ps.hl(3); arr(4.0, 1.7, -2.6, 3.9, CO.gold, 0.4);
  cap('每個 process 會列出 parent 是誰', '把數字串起來就能重建這棵 tree');
}]);

FRAG.push(['proc-8b-options', 'Parent 與 child 的三種關係選擇', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.6, 0]);
  const par = pal('parent', '', PC[0], -5.4, 0, 1.4, 0.65), chs = [];
  await step(tok);                                   // 231 creation = parent / children 的關聯
  const ch = pal('child', '', PC[1], -5.4, 0, 1.4, 0.55); chs.push(ch);
  await slide(tok, ch.g, -3.8, 0, 2.0, 700); ch.mood('happy');
  cap('process creation', '其實是 parent 跟 children 的關聯性');
  await step(tok);                                   // 251 兩支不同的程式，有三個面向
  const rows = ['① resource sharing', '② execution', '③ address space'].map((n, i) => hd(n, -0.6, 5.6 - i * 1.9));
  cap('兩支不同的程式，卻有關聯', '分成三個比較重要的部分');
  await step(tok);                                   // 267 由 OS 設計者決定
  note('由 OS 的設計者決定', 4.6, 6.4);
  cap('到底什麼關聯性', '由 OS 的設計者自己決定');
  await step(tok);                                   // 274 resource sharing：能不能繼承 file handler
  setCls(rows[0], 'ptr alt'); const f = prop('file', -5.4, 1.4, -0.4, 0.6, 'a.txt');
  bub('我也能用這個 file 嗎？', -3.8, 1.5, 2.0);
  cap('第一：resource sharing', 'parent open 的 file，child 能直接 access 嗎？');
  await step(tok);                                   // 302 file handler、memory、global、dynamic
  idx('file handler、global variable、動態配置的變數…', 2.2, 5.0);
  cap('process 有很多 memory content', 'file handler、global、動態配置的 variable');
  await step(tok);                                   // 322 share all
  const o1 = bx('share all', CO.user, 0.2, 5.6, 0, 2.2, 0.55, 0.8, 2);
  cap('可能是 share all', '兩個看到一模一樣的 content');
  await step(tok);                                   // 328 subset
  const o2 = bx('subset', CO.user, 2.6, 5.6, 0, 2.0, 0.55, 0.8, 2);
  cap('或只 share 一部分（subset）', '例：global 看得到，動態的看不到');
  await step(tok);                                   // 339 nothing：分家
  const o3 = bx('share nothing', CO.user, 5.0, 5.6, 0, 2.4, 0.55, 0.8, 2);
  cap('或全部不一樣：你是你、我是我', '只給一份 copy，memory address 完全不同');
  await step(tok);                                   // 371 execution 順序：一顆 CPU
  const cpu = prop('cpu', -0.6, 0, 2.8, 0.7, 'CPU');
  bub('call system call：create child', -5.4, 2.4, 1.4);
  cap('第二：執行順序', 'child 被 create 出來，但 CPU 只有一個');
  await step(tok);                                   // 403 concurrent：scheduler 決定
  const e1 = bx('concurrent', CO.cpu, 1.4, 3.7, 0, 2.4, 0.55, 0.8, 2);
  cap('concurrent：讓 OS scheduler 決定', '誰先誰後都 OK');
  await step(tok);                                   // 423 wait until children terminate
  const e2 = bx('parent 等 child 結束', CO.cpu, 4.4, 3.7, 0, 3.0, 0.55, 0.8, 2);
  cap('或 wait until children terminate', 'child 先執行完，parent 才接著跑');
  await step(tok);                                   // 440 所以 fork 後 parent 進 waiting queue
  par.mood('sad'); await slide(tok, par.g, -5.4, 0, -1.2, 600);
  idx('parent → waiting queue', -5.4, 1.4, -1.2);
  cap('如果 OS 這樣定義', 'parent 會因為 create child 而進 waiting queue');
  await step(tok);                                   // 470 address space（memory content）
  par.mood('calm'); await slide(tok, par.g, -5.4, 0, 1.4, 500);
  cap('第三：memory content', '也是最重要的部分');
  await step(tok);                                   // 493 duplicate
  const a1 = bx('duplicate（完全複製）', CO.io, 1.4, 1.8, 0, 3.0, 0.55, 0.8, 2);
  cap('duplicate', '把 parent 的內容完全複製一份');
  await step(tok);                                   // 516 load 新 program、PC 重設
  const a2 = bx('load 新 program', CO.io, 4.8, 1.8, 0, 2.8, 0.55, 0.8, 2);
  cap('或 create 完直接 load 一個 program', 'code 換掉、PC 重設，變成完全不同的程式');
  await step(tok);                                   // 539 duplicate 連 PC 都一樣
  const pa = pkt('PC：第 3 行（示意）', -5.4, 2.6, 1.4), pb = pkt('PC：第 3 行（示意）', -3.8, 1.0, 2.6);
  cap('duplicate 連 program counter 都一樣', 'parent 在第 3 行，child 也從第 3 行開始');
  await step(tok);                                   // 560 看起來一樣，address 不同
  bad('memory address 不同：是兩支程式', -4.6, 0.3, 3.4);
  cap('兩支分不出來，行為完全一樣', '但 memory address 不同，只是 copy');
  void f; void o1; void o2; void o3; void cpu; void e1; void e2; void a1; void a2; void pa; void pb;
}]);

FRAG.push(['proc-8b-fork', 'fork()：duplicate + concurrent，回傳 PID / 0', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.6, 0]);
  const lines = ['int a = 5;          // 示意', 'pid = fork();', 'if (pid == 0) …    // child', 'else …             // parent'];
  const A = code(lines, -3.4, 6.2, 0.48);
  await step(tok);                                   // 588 實際的 Linux / UNIX
  hd('Linux / UNIX（Windows 也類似）', 3.6, 6.4);
  cap('直接看真實的 Linux / UNIX', '大部分作業系統都類似');
  await step(tok);                                   // 606 fork system call
  A.hl(1);
  const par = pal('parent', '100', PC[0], -3.4, 0, 1.0, 0.8);
  cap('create 就是 call fork', 'OS 幫你 create 一個 child 出來');
  await step(tok);                                   // 622 選擇 duplicate
  const chd = pal('child', '101', PC[0], -3.4, 0, 1.0, 0.8);
  await slide(tok, chd.g, 3.4, 0, 1.0, 1000);
  cap('它選擇 duplicate', 'child 的 memory content 跟 parent 一模一樣');
  await step(tok);                                   // 640 global、heap、值都一樣
  const mk = (x) => ['global', 'heap', 'stack'].map((n, i) => bx(n, PC[0], x, 2.2 + i * 0.6, -0.8, 1.6, 0.5, 0.6));
  mk(-3.4); mk(3.4);
  cap('fork 之前的 global、heap 的值', 'child 通通都有，完全一樣');
  await step(tok);                                   // 659 你有 a，我就有 a
  pkt('a = 5', -3.4, 4.3, 0); pkt('a = 5', 3.4, 4.3, 0);
  cap('你有 variable a，我就有 variable a', '動態配置的值也照抄一份');
  await step(tok);                                   // 675 連 PC 都一樣
  hot('PC → fork 那行', -3.4, 5.0); hot('PC → fork 那行', 3.4, 5.0);
  cap('連 program counter 的位置都一樣', '等於完全一樣的兩支程式');
  await step(tok);                                   // 683 concurrent：誰先跑不一定
  const cpu = prop('cpu', 0, 0, -1.6, 0.8, 'CPU');
  await slide(tok, chd.g, 0.6, 0, -0.6, 500); await slide(tok, chd.g, 3.4, 0, 1.0, 500);
  cap('它選擇 concurrent execution', '可能 child 先跑，也可能 parent');
  await step(tok);                                   // 699 parent 不用等
  par.mood('happy'); good('parent 不用進 waiting', -3.4, 0.3, 2.4);
  cap('看 OS 決定，parent 不用等', '大部分使用者也比較希望這樣');
  await step(tok);                                   // 709 唯一不同：回傳值
  A.hl(1);
  cap('兩個唯一不同的是什麼？', 'fork 也是 function call，會 return 一個值');
  await step(tok);                                   // 730 child 拿到 0
  chd.set('fork() = 0'); chd.mood('wow');
  cap('如果是 child：return 0', '代表它不知道對方是誰');
  await step(tok);                                   // 747 parent 拿到 child 的 PID
  par.set('fork() = 101'); par.mood('happy');
  cap('如果是 parent：return 新 child 的 PID', '所以 parent 知道 child 是誰');
  await step(tok);                                   // 760 父母一定知道小孩是誰
  bub('我知道你是 101', -3.4, 2.0, 1.6); bub('我不知道爸媽是誰…', 3.4, 2.0, 1.6);
  cap('跟人很像：父母一定知道小孩', '小孩不一定知道父母');
  await step(tok);                                   // 781 child 可以另外問 OS
  const os = pal('OS', '', CO.os, 6.0, 0, -1.2, 0.6);
  bub('getppid() → 100', 6.0, 1.3, -1.2);
  cap('child 可以再 call 別的 system call 問 OS', 'fork 的回傳值不會告訴它');
  await step(tok);                                   // 794 用回傳值判斷自己是誰
  A.hl(2); chd.glow('#3a2a00');
  cap('程式用回傳值判斷', '自己是 child 還是 parent，做不同的事');
  void cpu; void os;
}]);

FRAG.push(['proc-8b-exec', 'execlp：換掉 code、清空 heap 與 stack、PC 歸零', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.4, 0]);
  const mk = (x, col) => ['code', 'data', 'heap', 'stack'].map((n, i) => bx(n, col, x, 0.4 + i * 0.7, 0, 2.2, 0.6, 1));
  hd('parent', -3.6, 3.6); const C = mk(3.6, PC[0]); mk(-3.6, PC[0]); const cn = hd('child', 3.6, 3.6);
  await step(tok);                                   // 810 fork 完通常接著 execlp
  const cd = code(['pid = fork();', 'if (pid == 0)', '  execlp("/bin/ls", "ls", NULL);'], -1.4, 6.4, 0.45);
  cd.hl(2);
  cap('Linux 程式 fork 完', '下一個通常就 call execlp');
  await step(tok);                                   // 823 因為 duplicate，內容完全一樣
  const eq = good('= 一模一樣', 0, 1.6);
  cap('因為 parent 跟 child 是 duplicate', 'content 完全一樣，包括執行碼');
  await step(tok);                                   // 835 create 是要它做不一樣的事
  remove(eq); bub('一件事一個 process 做就好', 0, 4.4);
  cap('create 新 process 的目的', '當然是叫它做不一樣的事');
  await step(tok);                                   // 850 要執行不同的 binary
  cap('做不一樣的事 = 執行不同的 binary code', '也就是另一支程式');
  await step(tok);                                   // 856 execlp：塞一個 binary file 進去
  const bin = prop('file', 6.2, 3.2, 0, 0.8, '/bin/ls');
  cap('execlp 這個 system call', '可以塞一個 binary file（program）進去');
  await step(tok);                                   // 865 code segment 整個 replace
  await slide(tok, bin, 5.4, 0.2, 0.8, 800); kill(bin);
  C[0].material.color.set(CO.disk); P.relabel(C[0], 'code：ls');
  cap('新 process 的 code segment', '整個 replace 掉');
  await step(tok);                                   // 871 heap、stack 清空，PC = 0
  for (const k of [1, 2, 3]) { C[k].material.color.set(CO.idle); P.relabel(C[k], ['', 'data（重設）', 'heap（清空）', 'stack（清空）'][k]); }
  hot('PC = 0', 5.6, 3.0);
  cap('heap、stack 全部清空，PC 設成 0', '也就是 reset');
  await step(tok);                                   // 881 child 執行完全不一樣的程式
  tx(cn, 'child：現在是 ls');
  cap('新的 child process', '等於在執行完全不一樣的一支程式');
  await step(tok);                                   // 894 只是 reset，為什麼還要先 create？
  note('既然要重來，為什麼還要先 create？', 0, 5.0);
  cap('這只是把 memory content reset', '那為什麼還要先 create？');
  await step(tok);                                   // 904 要跟 OS 註冊 PID、配置 memory
  const os = pal('OS', '', CO.os, 0, 0, 2.2, 0.6);
  bub('PID 登記好了、memory 配好了', 0, 1.4, 2.2);
  cap('要跟 OS 配置 memory space', '先跟 OS 註冊 PID：creation 還是要的');
  await step(tok);                                   // 926 by default 跟 parent 一樣，exec 後才不同
  good('fork：先有一個新 process　exec：再換內容', 0, 0.5, 3.0);
  cap('by default 新程式跟 parent 做一樣的事', 'call execlp 才 reset、做不一樣的事');
  void os;
}]);

FRAG.push(['proc-8b-wait', 'wait()：parent 等 child 結束', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.4, 0]);
  const L = ['pid = fork();', 'if (pid == 0)', '  execlp("/bin/ls", "ls", NULL);', 'else', '  wait(NULL);'];
  const cd = code(L, -2.6, 6.2, 0.45);
  const par = pal('parent', '', PC[0], -4.4, 0, 1.2, 0.75), chd = pal('child', 'ls', CO.disk, 2.4, 0, 1.2, 0.75);
  const cpu = prop('cpu', -1.0, 0, -1.4, 0.8, 'CPU');
  await step(tok);                                   // 942 最後一個常用：wait
  cd.hl(4);
  cap('最後一個常用的：wait', '');
  await step(tok);                                   // 948 concurrent：順序沒辦法控制
  await slide(tok, chd.g, -1.0, 0, -0.4, 450); await slide(tok, chd.g, 2.4, 0, 1.2, 450);
  await slide(tok, par.g, -1.0, 0, -0.4, 450); await slide(tok, par.g, -4.4, 0, 1.2, 450);
  cap('Linux 是 concurrent 執行', 'parent 和 child 的順序你沒辦法控制');
  await step(tok);                                   // 964 想控制：用 wait system call
  bub('wait()', -4.4, 1.7, 1.2);
  cap('想控制也可以', '使用者透過 wait 這個 system call');
  await step(tok);                                   // 970 指定等哪個 child
  arr(-3.6, 0.8, 1.6, 0.8, CO.gold, 1.2);
  cap('call wait 時', '可以指定要等哪一個 child 結束');
  await step(tok);                                   // 980 parent 自己進 waiting queue
  par.mood('sad'); await slide(tok, par.g, -5.4, 0, 3.0, 700);
  bad('parent → waiting queue', -5.0, 1.5, 3.0);
  chd.mood('happy'); await slide(tok, chd.g, -1.0, 0, -0.4, 600);
  cap('等於強迫把 parent 自己', '放進 waiting queue');
  await step(tok);                                   // 987 programmer 下的同步指令
  note('programmer 下的指令，不是 OS 預設', 3.4, 4.0);
  cap('這是 programmer 自己下的指令', '想做同步化，就 call wait');
  await step(tok);                                   // 998 還有 kill、suspend
  bub('kill / suspend', -2.6, 3.3, 1.6);
  cap('parent 還能對 child 做很多事', '像 kill、suspend');
  await step(tok);                                   // 1010 最基本三個
  gone(chd); par.mood('happy'); await slide(tok, par.g, -1.0, 0, -0.4, 600);
  good('fork、exec、wait：最基本的三個', 0, 0.4, 3.4);
  cap('這三個是最基本的', '尤其 fork 和 exec 對行為影響最大');
  void cpu;
}]);

FRAG.push(['proc-8b-cow', 'Duplicate 的實作：copy-on-write', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.4, 0]);
  zone('memory', 0, 0.02, 0, 13, 3.4, '#f3e6c8');
  await step(tok);                                   // 1036 先看 memory 裡的樣子
  cap('看範例程式碼之前', '先看 duplicate 和 reload 在 memory 裡的樣子');
  await step(tok);                                   // 1053 A、另一個 user program、OS、空的
  const A = bx('A', PC[0], -5.0, 1.2, 0, 2.0, 2.4, 1.2);
  bx('另一個程式', PC[4], -2.4, 0.9, 0, 2.0, 1.8, 1.2); const os = bx('OS', CO.os, 5.4, 0.8, 0, 1.6, 1.6, 1.2);
  idx('空的空間', 1.4, 0.3, 1.2);
  cap('process 就是 memory 裡的 content', 'A、另一個 user 程式、OS、空的空間');
  await step(tok);                                   // 1073 A call fork
  bub('fork()', -5.0, 2.9);
  cap('A 這個程式 call fork', '');
  await step(tok);                                   // 1084 child 佔一塊空間，同顏色 = 同內容
  const C = bx("A'", PC[0], 0.6, 0.5, 0, 2.0, 1.0, 1.2, 3);
  cap('產生一個 child，佔住一塊空間', '同樣的顏色：內容一樣，叫 A\'');
  await step(tok);                                   // 1100 為什麼比較小？兩種實作
  note('為什麼 A\' 比較小？', 0.6, 2.6);
  cap('A\' 比 A 小一點', '因為實作上有兩種選擇');
  await step(tok);                                   // 1113 naive：exact copy，100 MB
  P.relabel(A, 'A（100 MB）');
  const B = bx("A'（再 100 MB）", PC[0], 3.0, 1.2, 0, 2.0, 2.4, 1.2, 3);
  cap('naive 的選擇：exact copy', '佔 100 MB 就再要 100 MB，全部 copy');
  await step(tok);                                   // 1130 浪費 memory
  bad('一模一樣，何必兩份？', 3.0, 3.2);
  cap('裡面 content 完全一樣', '何必兩份？浪費 memory');
  await step(tok);                                   // 1146 實際作法：copy-on-write
  kill(B);
  hot('copy-on-write', 0.6, 3.6);
  cap('比較好的實作：copy-on-write', '下一章 memory 會講更仔細');
  await step(tok);                                   // 1158 只 copy 一定會改的部分
  pkt('PC', 0.2, 1.3, 0.8); pkt('初始變數', 1.2, 1.3, 0.8);
  cap('只 copy 一定會改掉的部分', '像 program counter、一些基本 variable');
  await step(tok);                                   // 1176 其他用 pointer 共用
  const link = ln(-4.0, 1.8, -0.4, 0.9, 0.8, '#c08a1f');
  cap('不影響執行的，就用 pointer', '讀 global 沒被改過，就直接讀 parent 的');
  await step(tok);                                   // 1200 一開始大家相同：share
  good('一開始相同 → share', -2.0, 3.0);
  cap('一開始大家都相同', '所以讓你們 share');
  await step(tok);                                   // 1207 有人修改 → run time 才 copy
  bub('child 改了 x！', 0.6, 3.0, 0.8);
  await anim(tok, 900, (u) => { C.scale.y = 1 + u * 0.6; C.position.y = 0.5 * (1 + u * 0.6); });
  cap('parent 或 child 修改共用的值', 'run time 時 OS 才幫你 copy，兩邊分家');
  await step(tok);                                   // 1229 慢慢長到一樣大，內容不同
  await anim(tok, 1200, (u) => { C.scale.y = 1.6 + u * 0.8; C.position.y = 0.5 * (1.6 + u * 0.8); });
  kill(link); C.material.color.set(PC[3]);
  cap('A\' 慢慢長到跟 A 一樣大', '但裡面的值不一樣');
  await step(tok);                                   // 1266 對使用者：內容一模一樣
  note('使用者看到：一模一樣；OS 偷偷省 memory', 0.6, 5.0);
  cap('對使用者看到的 process 而言', '內容一模一樣，OS 偷偷省 memory');
  await step(tok);                                   // 1284 call execlp：整個換掉
  C.material.color.set(CO.disk); P.relabel(C, 'C：execlp 新程式');
  cap('想讓新 process 跑不同程式', 'call execlp：code 換掉、heap 等 reset');
  await step(tok);                                   // 1304 大小、內容跟 A 脫鉤
  await anim(tok, 800, (u) => { C.scale.y = 2.4 - u * 1.0; C.position.y = 0.5 * (2.4 - u * 1.0); });
  good('大小、內容都跟 A 脫鉤', 0.6, 3.4, 0.8);
  cap('空間大小和內容', '跟 A 完全無關了');
  void os;
}]);

// ════════ qbUTlZ05VYk（第 6A 講）：OS 架構（simple、layered、microkernel、module）、virtual machine ════════
FRAG.push(['proc-6a-struct', 'OS 架構：simple 與 layered', async (tok) => {
  fresh([0, 5, 14], [0, 2.4, 0]);
  await step(tok);                                   // 1 好多不同的 architecture
  hd('OS 的架構（architecture）', 0, 6.2);
  cap('前面介紹了好多種 OS 架構', '要知道定義、好處和壞處');
  await step(tok);                                   // 3 simple：developer 很自由
  zone('simple', -3.6, 0.02, 0, 5.0, 3.4, '#f3e6c8');
  const S = ['檔案', 'I/O', 'memory', '排程', 'driver'].map((n, i) => bx(n, PC[i], -5.2 + (i % 3) * 1.6, 0.4 + Math.floor(i / 3) * 0.9, -0.6 + (i % 2) * 1.0, 1.3, 0.5, 0.7, 2));
  const dev = pal('developer', '', '#f0c27a', -3.6, 0, 2.4, 0.55); dev.mood('happy');
  cap('simple：很簡單', 'developer 可以用任何方式建構 OS');
  await step(tok);                                   // 6 沒有任何區分、規則
  ln(-5.2, 0.4, -3.6, 1.3, 0, CO.bad); ln(-2.0, 0.4, -5.2, 1.3, 0, CO.bad); ln(-3.6, 0.4, -2.0, 1.3, 0, CO.bad);
  cap('缺點：沒有任何區分', '非常自由，沒有任何規則');
  await step(tok);                                   // 42 容易有 bug、被 hacker 侵入、難維護
  bad('容易有 bug、被 hacker 侵入、難 maintain', -3.6, 3.0); dev.mood('sad');
  cap('所以很容易有 bug、被 hacker 侵入', '也造成 maintenance 的問題');
  await step(tok);                                   // 56 layered：從最底層到最上層
  zone('layered', 3.4, 0.02, 0, 4.4, 3.4, '#d6e6f6');
  const Ly = ['hardware', 'layer 1', 'layer 2', 'user interface'].map((n, i) => bx(n, ['#8a94a6', CO.cpu, CO.user, CO.io][i], 3.4, 0.35 + i * 0.75, 0, 3.4, 0.6, 1.4, 2));
  cap('Layer：把 OS 的 component 做區隔', '從最底層到最上層');
  await step(tok);                                   // 68 每層只能往下 call
  arr(5.4, 2.6, 5.4, 1.1, CO.user, 0.8); bad('✗ 不能往上', 1.2, 2.2, 0.8);
  cap('每一層只能往它下面 call', '不能往上');
  await step(tok);                                   // 76 好維護、一層一層 debug
  glow(Ly[2], '#3a2a00');
  good('改一層只影響上面的；一層一層 debug', 3.4, 4.0);
  cap('出問題時知道影響誰', '修改只影響上面，debug 可以一層一層來');
  void S;
}]);

FRAG.push(['proc-6a-micro', 'Microkernel 與 modular OS', async (tok) => {
  fresh([0, 5, 14], [0, 2.4, 0]);
  zone('user space', 0, 2.6, -0.4, 12, 2.4, '#e3f3ea'); zone('kernel space', 0, 0.02, 0.6, 12, 2.4, '#ece3fb');
  await step(tok);                                   // 89 microkernel：只留最核心的
  const k = bx('micro kernel', CO.os, -3.6, 0.4, 0.6, 2.0, 0.6, 1.0, 2);
  cap('Microkernel：一定要知道', '只把 OS 最核心、必要的部分當 kernel');
  await step(tok);                                   // 100 其他變成可替換的 module
  const M = ['file system', 'device driver', 'memory 管理'].map((n, i) => bx(n, PC[i + 2], -3.6 + (i - 1) * 2.2, 0.5, 0.6, 2.0, 0.5, 0.8, 0));
  M.forEach((m) => { m.position.y = 0.4; m.position.z = 1.8; });
  good('configurable：module 可以替換', -3.6, 1.6, 2.6);
  cap('其他部分盡量變成一堆 module', '可以替換 → OS 是 configurable');
  await step(tok);                                   // 116 module run 在 user space
  for (const [i, m] of M.entries()) { await slide(tok, m, -3.6 + (i - 1) * 2.2, 2.9, -0.4, 500); }
  hot('module 放在 user space！', -3.6, 4.0, -0.4);
  cap('非常重要：這些 module run 在 user space', '要分清 kernel space 和 user space');
  await step(tok);                                   // 134 用 message passing 溝通
  const msg = pkt('message', -5.8, 3.0, -0.2);
  await travel(tok, msg, V3(-5.8, 3.0, -0.2), V3(-3.6, 0.9, 0.8), 800);
  await travel(tok, msg, V3(-3.6, 0.9, 0.8), V3(-1.4, 3.0, -0.2), 800); remove(msg);
  cap('所以溝通要透過 message passing', '由 kernel 提供的 communication service');
  await step(tok);                                   // 149 效能比較慢
  bad('system call、interrupt 很慢 → 效能差一些', -3.6, 5.0);
  cap('效能上會比較慢', 'message passing 的 system call、interrupt 很 slow');
  await step(tok);                                   // 158 flexible、reliable
  good('flexible、kernel 小 → 比較 reliable', -3.6, -0.3, 2.4);
  cap('但很 modular：非常 flexible', 'kernel 很小，出錯機會自然小');
  await step(tok);                                   // 180 modular OS：module 在 kernel space
  const K2 = bx('kernel', CO.os, 3.6, 0.4, 0.6, 2.0, 0.6, 1.0, 2);
  ['fs', 'driver', 'mm'].forEach((n, i) => bx(n, PC[i + 2], 3.6 + (i - 1) * 1.5, 1.05, 0.6, 1.3, 0.5, 0.8, 2));
  hd('modular OS（現代 OS）', 3.6, 4.6); good('plug in，但都在 kernel space → 有效率', 3.6, -0.3, 2.4);
  cap('modular OS：現代 OS 的主要架構', 'module 可以 plug in，但都在 kernel space');
  await step(tok);                                   // 209 自己試 insert kernel module
  const ins = bx('insmod 新 module', CO.gold, 6.0, 3.2, 0.6, 1.8, 0.5, 0.8);
  await slide(tok, ins, 5.6, 1.65, 0.6, 800);
  cap('有興趣可以自己試', 'insert kernel module 來修改 OS');
  void k; void K2;
}]);

FRAG.push(['proc-6a-vmhist', 'Virtual machine：四五十年前就有了', async (tok) => {
  fresh([0, 5, 14], [0, 2.2, 0]);
  await step(tok);                                   // 227 最後講 virtual machine
  hd('Virtual Machine（VM）', 0, 6.0);
  const st = crowd(4, -1.5, 2.6, null, null, 0.5, 4, 1.0, 0); st.forEach((b) => b.mood('happy'));
  bub('聽過！', 1.6, 1.4, 2.6);
  cap('最後講 virtual machine', '相信大家都聽過');
  await step(tok);                                   // 254 不是這一兩年才有
  gone(...st);
  note('四五十年前就有這個技術了', 0, 4.8);
  cap('不是這一兩年才出來的', '其實四五十年前就有了');
  await step(tok);                                   // 275 一台硬體很多使用者：每人一個 OS？
  const hw = bx('hardware', '#8a94a6', 0, 0.3, 0, 7.0, 0.6, 1.4);
  const us = ['A', 'B', 'C'].map((n, i) => pal('user ' + n, '', PC[i], -2.4 + i * 2.4, 0.6, 0, 0.6));
  const os = ['A', 'B', 'C'].map((n, i) => bx('OS ' + n, CO.os, -2.4 + i * 2.4, 2.0, 0, 1.8, 0.4, 0.9, 3));
  cap('一台 hardware 有很多使用者', '為什麼不每個人有自己的 OS？');
  await step(tok);                                   // 292 做出來、work、isolation 很好
  us.forEach((b) => b.mood('happy')); [-1.2, 1.2].forEach((x) => ln(x, 0.7, x, 2.4, 0.8, '#5c7a4a'));
  good('isolation 很好：不怕別人影響你', 0, 3.2);
  cap('很早就做出來，也真的 work', '自己有自己的 OS → isolation 非常好');
  await step(tok);                                   // 305 當時不 popular：效能太差
  glow(hw, '#5a1010'); us.forEach((b) => b.mood('sad'));
  bad('當時 CPU 不快、memory 不大 → 太慢', 0, 4.0);
  cap('當時不 popular：計算效能太差', '每人除了 app 還要跑自己的 OS，負擔太重');
  void os;
}]);

FRAG.push(['proc-6a-vmconcept', 'VM 的概念：把下面整個抽象成 hardware', async (tok) => {
  fresh([0, 5, 14], [0, 2.4, 0]);
  const hw = bx('hardware', '#8a94a6', 0, 0.3, 0, 8.0, 0.6, 1.4);
  await step(tok);                                   // 335 把下面的東西整個抽象化
  cap('VM：把下面的東西整個抽象化', 'OS 本來就有這個特性，VM 的定義更 general');
  await step(tok);                                   // 349 下面已經有 OS / 軟體，也抽象成像 hardware
  const host = bx('已經有一個 OS', CO.os, 0, 1.0, 0, 8.0, 0.6, 1.4, 2);
  hot('看起來就像 hardware 一樣', 0, 1.9, 0.8);
  cap('下面即使已經有作業系統、別的軟體', '仍然把它抽象成就像 hardware');
  await step(tok);                                   // 362 灌一個 OS，上面再灌一個 OS
  const g = bx('再灌一個 OS', PC[1], -2.0, 1.75, 0, 3.4, 0.6, 1.2, 3);
  const app = bx('app', PC[2], -2.0, 2.45, 0, 2.4, 0.6, 1.0, 3);
  cap('灌了一個 OS，上面還可以透過 VM', '再灌一個 OS：抽象又多一層');
  await step(tok);                                   // 388 Nachos：translation 轉換指令
  const tr = pkt('instruction → translation → instruction', 2.6, 2.6, 0.6);
  cap('Nachos 就是一種 virtualize 的方式', '透過 translation 轉換指令');
  await step(tok);                                   // 408 但不只是 CPU instruction，還有 I/O
  prop('printer', 4.4, 1.3, -0.4, 0.6, 'I/O');
  cap('可是電腦運作不只 CPU instruction', '還要做 I/O 等等很多動作');
  await step(tok);                                   // 425 難在 OS 對 hardware 有 assumption
  remove(tr); bad('OS 設計時對 hardware 有 assumption → critical instruction', 0, 4.4);
  cap('難的是：OS 設計時對 hardware 有 assumption', '其中很困擾的叫 critical instruction');
  void hw; void host; void g; void app;
}]);

FRAG.push(['proc-6a-trap', 'VM 怎麼執行 privileged instruction：trap 給下面代做', async (tok) => {
  fresh([0, 5, 14], [0, 2.6, 0]);
  const hw = bx('hardware', '#8a94a6', 0, 0.3, 0, 9.0, 0.6, 1.4);
  const vmm = bx('host OS / VM 管理層（kernel mode）', CO.os, 0, 1.0, 0, 9.0, 0.6, 1.4);
  idx('user space', -5.6, 2.0, 0.8);
  await step(tok);                                   // 455 VM 的定義：hardware 上有管理軟體，上面很多 VM
  const V = [-3, 0, 3].map((x, i) => [bx('VM ' + (i + 1), PC[i], x, 2.0, 0, 2.6, 0.9, 1.2, 2), bx('guest kernel', CO.kern, x, 2.9, 0, 2.4, 0.5, 1.0, 2)]);
  cap('hardware 上有原本的 OS 或管理軟體', '上面 create 很多 VM，各自有自己的 OS');
  await step(tok);                                   // 481 夾一個 layer；彼此不知道；都以為 hardware 是自己的
  V.forEach(([v], i) => bub('hardware 是我的！', -3 + i * 3, 3.8, 0.6));
  cap('虛擬化：夾一個 layer', 'VM 互不知道彼此，都以為整台 hardware 屬於自己');
  await step(tok);                                   // 504 難點：kernel 假設自己在 kernel space
  hot('kernel 才能執行 privileged instruction', 0, 5.2);
  cap('難點又是 user space vs kernel space', 'kernel 假設自己在 kernel space');
  await step(tok);                                   // 527 guest kernel 其實在 user space
  glow(V[0][1], '#5a1010');
  bad('其實 run 在 user space！', -3, 1.2, 1.0);
  cap('可是這個 guest kernel', '對底層來說其實是 run 在 user space');
  await step(tok);                                   // 552 執行 privileged instruction 就 fail
  const pi = pkt('privileged instruction', -3, 3.6, 0.8);
  await travel(tok, pi, V3(-3, 3.6, 0.8), V3(-3, 2.2, 0.8), 700);
  tx(pi, '✗ 在 user space 執行 → fail');
  cap('它執行 privileged instruction 時', '因為在 user space，沒辦法執行');
  await step(tok);                                   // 585 解法：interrupt（exception）
  tx(pi, 'illegal instruction → exception');
  cap('第一代 VM 就知道怎麼解', '還記得 interrupt 嗎？非法指令丟 exception');
  await step(tok);                                   // 613 interrupt 先回到下面這個 OS
  await travel(tok, pi, V3(-3, 2.2, 0.8), V3(-3, 1.2, 0.8), 700);
  glow(vmm, '#3a2a00');
  cap('這個 interrupt 先回到下面的 OS', '它接到 interrupt');
  await step(tok);                                   // 633 知道是 VM → 在 kernel space 幫它再執行一次
  tx(pi, '在 kernel space 代為執行 ✓'); setCls(pi, 'good');
  cap('它知道上面是 VM', '在 kernel space 幫它再執行一次 → 過了');
  await step(tok);                                   // 690 攔截 interrupt、再幫它做一次
  await travel(tok, pi, V3(-3, 1.2, 0.8), V3(-3, 3.6, 0.8), 700);
  cap('VM 能 run 的關鍵', '攔截 interrupt，再幫它執行一次');
  await step(tok);                                   // 704 比較慢：做兩次
  bad('下去、上來、再下去：做兩次 → 慢', 3.0, 5.2);
  cap('所以比較慢', 'system call 本來就慢，現在做兩次');
  await step(tok);                                   // 728 只有 privileged instruction 做兩次
  const ok = pkt('一般 instruction：直接 go through', 3, 3.6, 0.8);
  cap('只有 privileged instruction 做兩次', '不是的話直接 go through，沒問題');
  await step(tok);                                   // 735 hardware support：CPU 支援 virtualization
  remove(pi); remove(ok);
  prop('cpu', 5.4, 0, 1.8, 0.8, 'CPU 支援 VT');
  cap('買 CPU 時看有沒有支援', 'Virtualization Technology：hardware support');
  await step(tok);                                   // 762 多一個 bit：VM mode
  note('kernel mode / user mode / VM mode', 5.0, 4.0, 1.8);
  cap('CPU 多加一個 bit', '除了 kernel、user mode，還有 VM mode');
  await step(tok);                                   // 773 CPU 自己判斷，一次就過 → 快
  const p2 = pkt('privileged（來自 VM）', 0, 3.6, 0.8);
  await travel(tok, p2, V3(0, 3.6, 0.8), V3(0, 0.6, 0.8), 1000); tx(p2, '來自 VM → 直接 go through ✓'); setCls(p2, 'good');
  cap('CPU 自己知道指令來自 VM', '直接 go through，不用上來 → 比較快');
  void hw;
}]);

FRAG.push(['proc-6a-critical', 'Critical instruction：user / kernel 結果不同（補充）', async (tok) => {
  fresh([0, 5, 14], [0, 2.4, 0]);
  zone('user space', -3.2, 0.02, 0, 5.4, 3.0, '#e3f3ea'); zone('kernel space', 3.2, 0.02, 0, 5.4, 3.0, '#ece3fb');
  await step(tok);                                   // 812 看起來很美好，但……
  hd('critical instruction', 0, 6.0);
  cap('看起來問題解決了', '但有個非常討厭的：critical instruction');
  await step(tok);                                   // 826 補充，考試不考
  note('補充：課本不一定有，考試不考', 0, 5.1);
  cap('這是補充', '知道比較好');
  await step(tok);                                   // 834 不是 privileged → user space 也能執行
  const a = pal('「假」指令', '', PC[3], -3.2, 0, 0, 0.7); a.mood('happy');
  cap('它不是 privileged instruction', '所以 user space 也可以執行');
  await step(tok);                                   // 843 user / kernel 執行結果不一樣
  const b = pal('「假」指令', '', PC[3], 3.2, 0, 0, 0.7); b.mood('wow');
  cap('奇妙的是：在 user space 和 kernel space', '執行的結果不一樣（問 x86 的設計者）');
  await step(tok);                                   // 861 例：user = A+B，kernel = A+2B
  a.set('A + B'); b.set('A + 2B');
  cap('老師的例子：同一個指令「假」', 'user space：A + B；kernel space：A + 2B');
  await step(tok);                                   // 884 沒 hardware support：不會被 catch
  bad('不會丟 interrupt → 下面的人不知道', 0, 3.6);
  cap('沒有 hardware support 就麻煩了', '它不會被 catch，不會丟 interrupt');
  await step(tok);                                   // 911 guest kernel 執行 → 結果錯
  const g = pal('guest kernel', 'A + B ✗', CO.kern, -3.2, 0, 1.6, 0.55); g.mood('sad');
  bub('我以為會得到 A + 2B…', -3.2, 1.5, 1.6);
  cap('guest kernel 在 user space 執行它', '直接 go through，得到 A + B：結果錯了');
  await step(tok);                                   // 927 要用別的方式找出它們 → 很囉嗦
  note('不能靠 privileged 的定義判斷 → 很囉嗦', 0, 4.4);
  cap('得先知道哪些是 critical instruction', '不能靠 privileged 的定義，變得很麻煩');
  await step(tok);                                   // 966 software 虛擬化不簡單
  good('software 虛擬化要處理 critical instruction', 0, 5.1);
  cap('所以 software 要虛擬化不簡單', '要 handle critical instruction');
}]);

FRAG.push(['proc-6a-vmwhy', '為什麼 VM 這麼 popular', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.4, 0]);
  const R = [];
  const reason = (t, i) => { const r = bx(t, [CO.user, CO.cpu, CO.io, CO.os][i], -4.6, 5.4 - i * 1.0, 0, 3.0, 0.6, 0.9, 2); R.push(r); return r; };
  await step(tok);                                   // 976 VM popular 的原因
  hd('VM 的好處', -4.6, 6.4);
  cap('VM 為什麼這麼 popular？', '有幾個原因');
  await step(tok);                                   // 988 ① protection
  reason('① protection', 0);
  const v1 = bx('VM 1', PC[0], 0.4, 0.5, 0, 1.6, 1.0, 1.0), v2 = bx('VM 2', PC[1], 2.6, 0.5, 0, 1.6, 1.0, 1.0);
  const hk = pal('hacker', '', '#444', 0.4, 1.0, 0, 0.5); hk.mood('happy');
  bad('hack 一個 OS，碰不到另一個', 1.5, 2.6);
  cap('第一：protection', 'isolation 更好：hack 一個 OS 也碰不到另一個');
  await step(tok);                                   // 1029 ② compatibility：legacy software
  gone(v1, v2, hk);
  reason('② compatibility', 1);
  const lg = prop('file', 0.4, 0, 0, 0.9, 'legacy software');
  bub('我一定要舊版 Windows！', 0.4, 2.4);
  cap('第二：compatibility', 'legacy software 一定要特定的舊環境');
  await step(tok);                                   // 1065 每個環境一台電腦 → 浪費
  const pcs = [1.8, 3.4, 5.0].map((x) => prop('monitor', x, 0, 0, 0.7));
  bad('一個環境買一台電腦 → 浪費錢', 3.2, 2.6);
  cap('每個 app 要的環境不同', '只好買很多台電腦，很浪費');
  await step(tok);                                   // 1103 一台電腦開 VM 就好
  gone(...pcs.slice(1));
  good('一台電腦 + 開個 VM 就好', 3.2, 3.4);
  cap('有 VM：買一台、灌最常用的 OS', '要別的環境就開個 VM，例如在 Mac 上跑 Linux');
  await step(tok);                                   // 1143 ③ research 與開發
  gone(lg, pcs[0]);
  reason('③ research / 開發', 2);
  const dev = pal('kernel 開發者', '', '#f0c27a', 1.0, 0, 0, 0.6);
  cap('第三：academic 的 research 和開發', 'kernel 只要有 bug 就 crash');
  await step(tok);                                   // 1173 沒有 VM：整台 crash
  dev.mood('sad'); const m1 = prop('monitor', 3.6, 0, 0, 0.8); bad('整台 crash、重新開機', 3.6, 2.2);
  cap('沒有 VM：改實體機器的 OS', '有 bug 整台 crash、重開機，很痛苦');
  await step(tok);                                   // 1196 有 VM：只是一個 program
  dev.mood('happy'); good('VM crash 也只是一個 program', 3.6, 2.9);
  cap('有 VM：OS 再怎麼 crash', '也只是一個 program，還能把 state 存下來');
  await step(tok);                                   // 1228 honey farm
  gone(dev, m1);
  const hv = prop('warehouse', 2.2, 0, 0, 0.9, 'honey farm');
  cap('很好玩的應用：honey farm', '做 security 的人最喜歡');
  await step(tok);                                   // 1281 假的 VM 讓你攻擊，記錄 pattern
  const at = pal('attacker', '', '#444', 5.6, 0, 0.6, 0.5); at.mood('happy');
  await slide(tok, at.g, 3.4, 0, 0.8, 800);
  note('記錄 attack 的 pattern 與 behavior', 2.6, 3.0);
  cap('開假的 VM 讓人攻擊', '把攻擊的 pattern 記下來做研究');
  await step(tok);                                   // 1323 ④ cloud computing
  gone(hv, at);
  reason('④ cloud computing', 3);
  const dc = prop('warehouse', 2.6, 0, -0.6, 1.2, 'data center');
  cap('第四：cloud computing（雲端計算）', 'Google、Microsoft、Amazon');
  await step(tok);                                   // 1361 用 SSH 連進來就好
  const ph = pal('你', '', '#f0c27a', -1.0, 0, 1.6, 0.5); ph.mood('happy');
  const s = pkt('SSH', -0.4, 1.0, 1.6); await travel(tok, s, V3(-0.4, 1.0, 1.6), V3(1.8, 1.0, 0.4), 900); remove(s);
  cap('只要能連線、能下指令就好', '用什麼 device 都無所謂，不用買硬體');
  await step(tok);                                   // 1404 resource sharing、使用率要高
  bad('一人一台實體機器 → 很多空的 CPU cycle', 2.6, 3.4);
  cap('重點：resource sharing', '還要讓資源的使用率高');
  await step(tok);                                   // 1431 切成很多小 VM
  [0, 1, 2, 3].forEach((i) => bx('VM', PC[i], 1.2 + i * 1.0, 2.4, 0.6, 0.8, 0.5, 0.6, 2));
  cap('VM：把很大的實體機器', '切成很多小的 virtual machine');
  await step(tok);                                   // 1457 不一定要 VM：container
  note('也可以用 container（更 lightweight）', 2.6, 4.2);
  cap('雲端不一定要靠 VM', '現在很多人用 container');
  await step(tok);                                   // 1485 重點是 isolation
  good('isolation：讓你覺得電腦是你自己的', 2.6, 5.0);
  cap('重點是一定程度的 isolation', '實際上共用，你卻覺得是自己的電腦');
  void R; void dc;
}]);

FRAG.push(['proc-6a-fullpara', 'Full virtualization vs Para-virtualization', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.6, 0]);
  await step(tok);                                   // 1503 virtualization 的類型
  hd('virtualization 的幾種類型', 0, 6.4);
  cap('Virtualization 技術', '可以分成幾種類型');
  await step(tok);                                   // 1518 full virtualization
  bx('hardware', '#8a94a6', -3.4, 0.3, 0, 5.0, 0.6, 1.4); hd('Full virtualization', -3.4, 5.6);
  cap('第一種：full virtualization', '');
  await step(tok);                                   // 1533 host OS 和 guest OS
  bx('host OS', CO.os, -3.4, 1.0, 0, 5.0, 0.6, 1.4, 2);
  const g = [-4.6, -2.2].map((x) => bx('guest OS', PC[1], x, 1.8, 0, 2.2, 0.8, 1.2, 2));
  idx('guest 在 user space', -3.4, 2.6, 0.8);
  cap('下面原來的 OS 叫 host OS', '上面 run 在 user space、暫時來的叫 guest OS');
  await step(tok);                                   // 1548 guest OS 的程式碼完全不用動
  good('guest OS 完全不用改', -3.4, 3.4);
  cap('full：guest OS 的程式碼完全不用動', '它渾然不知自己在虛擬世界');
  await step(tok);                                   // 1574 比較困難：靠下面那一層或 hardware support
  idx('只能靠 virtualization layer / kernel module / hardware support', -3.4, -0.4, 1.2);
  cap('比較困難', '只能靠下面那一層或 hardware support');
  await step(tok);                                   // 1596 VMware：不靠 hardware 做到
  note('VMware：早期不靠 hardware 就做到', -3.4, 4.3);
  cap('VMware 早期就做到 full virtualization', '而且不靠 hardware support');
  await step(tok);                                   // 1643 para-virtualization
  bx('hardware', '#8a94a6', 3.4, 0.3, 0, 5.0, 0.6, 1.4); bx('host OS', CO.os, 3.4, 1.0, 0, 5.0, 0.6, 1.4, 2);
  hd('Para-virtualization', 3.4, 5.6);
  cap('另一種：para-virtualization', '');
  await step(tok);                                   // 1666 global zone / master
  const ms = bx('master（global zone）', CO.gold, 1.9, 1.8, 0, 2.0, 0.8, 1.2, 2);
  cap('左邊多一個 global zone', '叫 master / manager：知道所有 VM 的存在');
  await step(tok);                                   // 1687 guest OS 必須修改
  const pg = [3.9, 5.4].map((x) => bx('改過的 guest', PC[3], x, 1.8, 0, 1.4, 0.8, 1.2, 2));
  bad('guest OS 必須被修改', 4.6, 3.4);
  cap('重點：guest OS 要被修改', '只有一半虛擬化，比較有限制');
  await step(tok);                                   // 1730 效能不一定比較差
  note('效能不一定比 full 差，有時更好', 3.4, 4.3);
  cap('多一個 master，效能不一定比較差', '有些研究發現反而比較好');
  await step(tok);                                   // 1752 OS 假設 hardware 只屬於自己：disk 例子
  const d = prop('disk', 0, 0, 2.4, 0.9, '共用的 disk');
  cap('每個 OS 都假設 hardware 只屬於自己', '例：file system 把讀取排成 sequential');
  await step(tok);                                   // 1790 你 sequential + 我 sequential = random
  const s1 = pkt('1 2 3 4', -1.8, 1.6, 2.4), s2 = pkt('7 8 9 10', 1.8, 1.6, 2.4);
  await wt(tok, 300); tx(s1, '1 7 2 8 3 9…（random）'); remove(s2); s1.position.x = 0;
  cap('你 sequential、我 sequential', '加起來變 random，最佳化白做');
  await step(tok);                                   // 1812 master 做 global 最佳化，但多一層 overhead
  glow(ms, '#3a2a00'); good('master 拿大家的 pattern 重新最佳化', 2.0, -0.4, 1.8);
  cap('para 有 master 可以做 global 最佳化', '缺點：多一層溝通的 overhead');
  await step(tok);                                   // 1845 現在多用 full；Xen / VMware / KVM
  note('Xen（para）、VMware、KVM（full，open source）', 0, 4.9, 1.0);
  cap('沒有哪個一定比較好', '有 hardware support 後 full 比較熱門');
  void g; void pg; void d;
}]);

FRAG.push(['proc-6a-jvm', 'Java virtual machine：bytecode、translation、JIT', async (tok) => {
  fresh([0, 5, 14], [0, 2.4, 0]);
  await step(tok);                                   // 1898 Java：以 VM 概念設計
  const j = bx('Java 程式', PC[6], -4.4, 3.6, 0, 2.4, 0.7, 1.0, 2);
  hd('Java virtual machine（JVM）', 0, 6.0);
  cap('Java 是很特殊的 language', '執行方式以 virtual machine 的概念設計');
  await step(tok);                                   // 1924 比較單純：只管 instruction，像 Nachos
  cap('它的 virtualization 相對單純', '只管執行 instruction，跟 Nachos 很接近');
  await step(tok);                                   // 1942 bytecode：不是 x86 也不是 MIPS
  const bc = bx('bytecode', CO.gold, -1.2, 3.6, 0, 2.2, 0.7, 1.0, 2);
  arr(-3.1, 3.6, -2.4, 3.6);
  bad('不是 x86、不是 MIPS', -1.2, 4.6);
  cap('compile 完是自己的 binary：bytecode', '不屬於任何一種 hardware');
  await step(tok);                                   // 1959 translate 到下面的 host
  const hs = [-2.6, 0.2, 3.0].map((x, i) => bx(['x86 電腦', 'ARM 手機', 'MIPS'][i], '#8a94a6', x, 0.4, 0, 2.4, 0.6, 1.0, 2));
  const t = pkt('translate', -1.2, 3.0, 0.6); await travel(tok, t, V3(-1.2, 3.0, 0.6), V3(0.2, 1.0, 0.6), 900); remove(t);
  cap('要裝到不同電腦上', '就 translate 成下面 host 的指令');
  await step(tok);                                   // 1972 isolation 很好 → secure
  const box = P.ghostBox('#2fc092', 3.4, 1.6, 1.4); box.position.set(-1.2, 3.6, 0);
  good('只用 VM 裡的 memory → secure', 3.2, 3.6);
  cap('像 OS 一樣有很好的 isolation', '再怎麼寫 bug、attack 都不影響下面');
  await step(tok);                                   // 2015 translation 很慢
  bad('一個 instruction 一個 instruction 翻 → 慢', 0, 2.4, 1.0);
  cap('translation 是一定要的', '但一行一行翻很慢');
  await step(tok);                                   // 2026 JIT：翻過的記下來重用
  const dict = bx('翻過的（JIT 記下來）', CO.user, 4.6, 2.4, -1.0, 2.6, 0.6, 1.0, 2);
  cap('Java 厲害的是 just-in-time compile', '翻過的像字典一樣記下來，直接 reuse');
  await step(tok);                                   // 2067 還是比 C 慢一點
  note('還是比 C 慢一點', 4.6, 3.3, -1.0);
  cap('省下一些時間', '效能還是會比 C 這些差一點');
  void j; void bc; void hs; void dict;
}]);

// ════════ f-mBLtGY6Ig（第 7A 講）：memory layout、thread、五狀態、PCB、context switch ════════
// a process's memory image: text / data / heap / free / stack, bottom = address 0
function memImage(x, y0 = 0.1, w = 2.6, z = 0) {
  const S = {};
  S.text = bx('text（code）', CO.cpu, x, y0 + 0.35, z, w, 0.7, 1.1);
  S.data = bx('data', CO.user, x, y0 + 1.1, z, w, 0.7, 1.1);
  S.heap = bx('heap', CO.io, x, y0 + 1.85, z, w, 0.7, 1.1);
  S.stack = bx('stack', CO.os, x, y0 + 4.25, z, w, 0.7, 1.1);
  tag('0', 'idx', x + w / 2 + 0.3, y0 + 0.05, z); tag('max', 'idx', x + w / 2 + 0.4, y0 + 4.6, z);
  return S;
}
FRAG.push(['proc-7a-layout', 'Process 在 memory 裡的樣子', async (tok) => {
  fresh([0, 5, 14], [0, 2.6, 0]);
  const X = 3.6;
  zone('process 的 memory space', X, 0.02, 0, 3.6, 2.4, '#f3e6c8');
  const show = (m) => { m.visible = true; };
  const S = memImage(X); Object.values(S).forEach((m) => { m.visible = false; });
  await step(tok);                                   // 2 memory 的組成：程式碼
  show(S.text);
  cap('上次說 process 在 memory 裡', '第一部分：程式碼');
  await step(tok);                                   // 5 data：global variable
  show(S.data); pkt('global', X - 2.2, 1.2, 0.6);
  cap('第二：data，放 global variable', '程式一 load 進來就幫你 allocate');
  await step(tok);                                   // 8 stack：local variable
  show(S.stack); pkt('local', X - 2.2, 4.3, 0.6);
  cap('stack：function 的 local variable', 'function return 就消失');
  await step(tok);                                   // 51 heap：malloc
  show(S.heap); pkt('malloc', X - 2.2, 1.95, 0.6);
  cap('heap：malloc、用 pointer dynamic allocate', '');
  await step(tok);                                   // 60 programmer 自己管理：memory leak
  const lk = bad('忘了 deallocate → memory leak', -2.6, 2.0);
  cap('heap 由 programmer 自己管理', '要記得 deallocate，不然 memory leak');
  await step(tok);                                   // 77 OS 還要記 state、PC、register
  remove(lk);
  const card = bx('PCB 的資訊', '#fffaf0', -3.4, 3.0, 0, 3.4, 2.8, 0.3);
  const r1 = bx('state、program counter', CO.gold, -3.4, 3.9, 0.3, 3.0, 0.5, 0.3);
  cap('OS 還需要知道 process 的資訊', '目前的 state、program counter');
  await step(tok);                                   // 97 register：context switch 時要存
  const r2 = bx('register', CO.cpu, -3.4, 3.2, 0.3, 3.0, 0.5, 0.3);
  cap('還有 register', 'time sharing：被 switch 出來時要存下來');
  await step(tok);                                   // 129 resource：open file
  const r3 = bx('resource（open file…）', CO.io, -3.4, 2.5, 0.3, 3.0, 0.5, 0.3);
  cap('最後是 resource', '開 file、跟 OS 要的 hardware control');
  await step(tok);                                   // 152 layout 例子：0 在下
  gone(card, r1, r2, r3);
  hd('一個例子（每個 OS 不太一樣）', X, 5.7);
  cap('基本架構的一個例子', '0 在下面：先放 text，再放 data');
  await step(tok);                                   // 166 heap、stack run time 會變：中間留空
  const up = arr(X + 1.8, 2.2, X + 1.8, 3.1, CO.io, 0.6), dn = arr(X + 1.8, 3.9, X + 1.8, 3.1, CO.os, 0.6);
  await anim(tok, 900, (u) => { S.heap.scale.y = 1 + u * 0.5; S.heap.position.y = 1.95 + u * 0.17; S.stack.scale.y = 1 + u * 0.5; S.stack.position.y = 4.35 - u * 0.17; });
  note('空間留在中間：一個往上長、一個往下長', -2.6, 3.2);
  cap('heap 和 stack 在 run time 會變化', '一個往上長、一個往下長');
  await step(tok);                                   // 188 out of memory
  await anim(tok, 900, (u) => { S.stack.scale.y = 1.5 + u * 0.8; S.stack.position.y = 4.18 - u * 0.28; });
  bad('recursive 太深 / allocate 太多 → out of memory', -2.6, 4.2);
  cap('allocate 太多或一直 recursive', '空間用完 → out of memory');
  void up; void dn;
}]);

FRAG.push(['proc-7a-thread', 'Thread：lightweight process', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.6, 0]);
  await step(tok);                                   // 223 除了 process，還有 thread
  hd('Thread', 0, 6.2);
  cap('除了 process，常聽到 thread', '跟 process 不太一樣，又很相似');
  await step(tok);                                   // 246 lightweight process
  hot('又叫 lightweight process', 0, 5.4);
  cap('thread 又叫 lightweight process', '');
  await step(tok);                                   // 251 管理一樣，但共用一些 memory
  const pz = zone('一個 process', 0, 0.02, 0, 9.0, 3.4, '#f3e6c8');
  const sh = ['code', 'data', 'files'].map((n, i) => bx(n, [CO.cpu, CO.user, CO.io][i], -2.4 + i * 2.4, 3.6, -0.6, 2.2, 0.7, 1.0, 2));
  cap('管理跟長相跟 process 一樣', '但同一個 process 的 thread 共用一些 memory');
  await step(tok);                                   // 276 create thread 不用重建共用空間 → lightweight
  const T = [-3, 0, 3].map((x, i) => pal('thread ' + (i + 1), '', PC[i + 4], x, 0, 0.6, 0.6));
  T.forEach((t) => t.mood('happy'));
  cap('create thread 時共用的空間不用重建', 'parent process 已經 allocate 好 → lightweight');
  await step(tok);                                   // 297 thread 才是 CPU 執行的單位
  const cpu = prop('cpu', 5.8, 0, 2.2, 0.7, 'CPU');
  await slide(tok, T[1].g, 4.6, 0, 2.2, 700); await slide(tok, T[1].g, 0, 0, 0.6, 700);
  cap('thread 是 CPU 執行最基本的單位', '一個 process 至少對到一個 thread');
  await step(tok);                                   // 329 最大差別：共用 memory
  cap('process 和 thread 最大的差別', '同一個 process 下的 thread 共用部分 memory');
  await step(tok);                                   // 352 code、data、OS resource 共用
  sh.forEach((m) => glow(m, '#3a2a00'));
  good('code、data、OS resource：共用', 0, 4.7);
  cap('by definition：code、data section', '還有 OS 的 resource，這三塊共用');
  await step(tok);                                   // 374 一個 thread 開 file，另一個直接用
  const fp = pkt('file pointer', 2.4, 3.0, 0.2);
  await travel(tok, fp, V3(2.4, 3.0, 0.2), V3(-3, 1.6, 0.8), 900);
  cap('一個 thread open 一個 file', '另一個 thread 直接拿 file pointer 讀寫');
  await step(tok);                                   // 385 register、stack 不共用
  const own = T.map((t, i) => [bx('register', CO.cpu, [-3, 0, 3][i], 0.3, 1.9, 1.4, 0.35, 0.6), bx('stack', CO.os, [-3, 0, 3][i], 0.75, 1.9, 1.4, 0.35, 0.6)]);
  cap('但 register 和 stack', '就沒有 share');
  await step(tok);                                   // 394 register：每個執行位置不同
  T.forEach((t, i) => t.set('PC：第 ' + (3 + i * 4) + ' 行'));
  cap('每個 thread 執行的位置不同', '甚至執行不同的 function，狀態各自記');
  await step(tok);                                   // 417 stack：local variable 互相看不見
  bad('local variable 互相看不見', 0, -0.4, 2.6);
  cap('stack 放各自的 function call', 'local variable 互相看不見');
  await step(tok);                                   // 438 data 共用 → 用 global variable 溝通
  const g = pkt('global x', 0, 3.6, 0.2);
  await travel(tok, g, V3(0, 3.6, 0.2), V3(-3, 1.6, 0.8), 700); await travel(tok, g, V3(-3, 1.6, 0.8), V3(3, 1.6, 0.8), 900);
  cap('data 是 shared', 'multi-thread programming 用 global variable 溝通');
  await step(tok);                                   // 475 各自獨立：PC、register、thread ID、stack
  note('各自獨立：PC、register、thread ID、stack', 0, 5.6, 1.0);
  cap('要能獨立執行', 'PC、register、thread ID、stack 各自一份');
  await step(tok);                                   // 502 管理方式一樣，這章講 process
  cap('管理 thread 的大概念跟 process 一樣', '這章講 process，概念可以 apply 到 thread');
  await step(tok);                                   // 529 Linux：都當 thread；Nachos 也叫 thread
  T.forEach((t) => t.mood('wow'));
  idx('Linux、Nachos：process 當 thread 管理', 0, 6.6);
  cap('Linux 對 OS 而言只有 thread', 'Nachos 也都叫 thread：名字是次要的');
  void pz; void cpu; void own;
}]);

// the five-state diagram (textbook Fig. 3.2) with labelled arrows; returns state boxes
const ST5 = { new: [-5.0, 4.6], ready: [-2.4, 2.6], running: [2.4, 2.6], waiting: [0, 0.5], terminated: [5.0, 4.6] };
function fiveStates(show = true) {
  const S = {};
  for (const k in ST5) { S[k] = bx(k, k === 'running' ? CO.cpu : k === 'waiting' ? CO.io : k === 'ready' ? CO.user : CO.paper, ST5[k][0], ST5[k][1], -0.6, 2.2, 0.7, 0.9); S[k].visible = show; }
  return S;
}
function arrowST(a, b, name, dy = 0, lx = 0, ly = 0) {
  const [x1, y1] = ST5[a], [x2, y2] = ST5[b]; const dx = x2 - x1, dyy = y2 - y1, L = Math.hypot(dx, dyy), ux = dx / L, uy = dyy / L;
  const ar = arr(x1 + ux * 1.25, y1 + uy * 0.5 + dy, x2 - ux * 1.25, y2 - uy * 0.5 + dy, '#8a7a5c', -0.6);
  const t = tag(name, 'idx', (x1 + x2) / 2 + lx, (y1 + y2) / 2 + dy * 1.8 + ly, -0.6);
  return [ar, t];
}
const at5 = (k, dz = 0.4) => [ST5[k][0], ST5[k][1] - 0.35, dz];
FRAG.push(['proc-7a-states', 'Process 的五個狀態（life cycle）', async (tok) => {
  fresh([0, 3.6, 14.5], [0, 2.6, 0]);
  const S = fiveStates(false);
  const p = pal('P', '', PC[1], -6.4, 4.25, 0.4, 0.45); p.g.visible = false;
  const go = async (k, ms = 700) => { const [x, y, z] = at5(k); await slide(tok, p.g, x, y, z, ms); };
  await step(tok);                                   // 586 life cycle：五個 state
  hd('process 的 life cycle：五個 state', 0, 6.2);
  cap('process 被 launch 後', '整個執行過程分成五個 state');
  await step(tok);                                   // 605 new：load 進 memory、initialize
  S.new.visible = true; p.g.visible = true; await go('new');
  bub('load、allocate segment、initialize', -5.0, 5.6);
  cap('第一個：new', '把 program load 進 memory、initialize');
  await step(tok);                                   // 648 memory 少時連 new 都會 fail
  const f = bad('memory 不夠 → new 就 fail、被 kill', -5.0, 3.6);
  cap('早期 memory 少、launch 太多', '連 new 都 allocate 不到 memory，直接 fail');
  await step(tok);                                   // 686 ready：在 queue 裡等 CPU core
  remove(f); S.ready.visible = true;
  cap('第二：ready', 'CPU core 有限：在 queue 裡等著被排');
  await step(tok);                                   // 732 running：被選中，送 instruction 進 CPU
  S.running.visible = true;
  cap('第三：running', '被選中，真的把 instruction 送進 CPU 執行');
  await step(tok);                                   // 746 做 I/O → waiting
  S.waiting.visible = true;
  bub('printf / scanf', 0, -0.4, 0.6);
  cap('執行中會做 I/O（printf、scanf）', '不需要 CPU 也不能立刻執行：waiting');
  await step(tok);                                   // 783 I/O 做完才放回 ready
  cap('等這些事情完成、需要 CPU 時', '才被放回 ready state');
  await step(tok);                                   // 795 terminate：release 資源
  S.terminated.visible = true;
  cap('最後：terminated', '跟 new 相反：把所有資源 release 給 OS');
  await step(tok);                                   // 821 diagram：new 之後 OS 要 admit
  const [a1, t1] = arrowST('new', 'ready', 'admitted', 0, -0.4, 0.4);
  bad('memory 不夠 / 沒有 permission → 擋掉', -5.0, 3.6);
  cap('用這個 diagram 記起來', 'new 之後 OS 還要 admit：不夠或沒權限就擋掉');
  await step(tok);                                   // 859 正常就進 ready（一個 queue）
  await go('ready');
  cap('一切正常就進入 ready', 'ready 其實是一個 queue，等著被 schedule');
  await step(tok);                                   // 875 schedule → dispatch → running
  arrowST('ready', 'running', 'scheduler dispatch', 0.3);
  await go('running'); p.mood('happy');
  cap('schedule 是選人；dispatch 是把它 load 進 CPU', '進入 running');
  await step(tok);                                   // 900 簡單程式：算完就離開
  const ex = arrowST('running', 'terminated', 'exit', 0, 0, 0.35);
  bub('for (…) i++; 算完就離開', 2.4, 3.8);
  cap('簡單的程式只做計算', '執行完就直接離開');
  await step(tok);                                   // 913 interrupt（timer）→ 回 ready
  arrowST('running', 'ready', 'interrupt', -0.3);
  pkt('⏰ timer', 0, 3.6); p.mood('sad'); await go('ready');
  cap('就算純計算也可能被 interrupt', 'timer 響了（time sharing）→ 回到 ready');
  await step(tok);                                   // 967 switch 給 OS scheduler
  const os = pal('OS scheduler', '', CO.os, 0, 4.4, -0.8, 0.5);
  cap('切換給 OS 的 scheduler', '所以 OS 隨時能掌握、隨時能換人');
  await step(tok);                                   // 984 自己做 I/O、sleep → waiting
  await go('running', 500);
  arrowST('running', 'waiting', 'I/O or event wait', 0, 1.6, 0);
  p.mood('calm'); await go('waiting');
  cap('自己要做 I/O 或 call sleep', '放掉 CPU，進入 waiting');
  await step(tok);                                   // 1018 event 完成（interrupt）→ ready
  arrowST('waiting', 'ready', 'I/O or event completion', 0, -1.6, 0);
  pkt('sleep 10 秒到了！', 0, -0.4, 1.0); await go('ready'); p.mood('happy');
  cap('I/O 結束或 sleep 10 秒到了', '靠 interrupt 通知 OS → 從 waiting 回到 ready');
  await step(tok);                                   // 1051 scheduler 從 ready queue 挑人
  const q = [1, 2].map((k) => pal('', '', PC[k + 2], -2.4 - k * 0.7, 2.25, 1.0, 0.35));
  cap('scheduler 只要從 ready queue 挑程式', '在 ready 就代表一定可以執行');
  await step(tok);                                   // 1080 記住轉換的原因；ready / waiting 都是 queue
  good('ready、waiting 都是 queue', 0, -0.9, 1.6);
  cap('這張圖非常重要', '記好每個轉換的原因；ready、waiting 都用 queue 管理');
  void a1; void t1; void ex; void os; void q;
}]);

FRAG.push(['proc-7a-pcb', 'Process Control Block（PCB）', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.6, 0]);
  await step(tok);                                   // 1124 OS 要掌握 process：怎麼實現？
  zone('kernel space（OS 自己的 memory）', 2.6, 0.02, 0, 7.6, 3.6, '#ece3fb');
  const p = pal('process', '', PC[2], -5.0, 0, 0.6, 0.7);
  cap('OS 要掌握每個 process', '剛剛的邏輯要怎麼實現？');
  await step(tok);                                   // 1142 每個 process 一個 PCB
  hd('Process Control Block（PCB）', 2.6, 6.4);
  cap('每個 process 有一個', 'process control block');
  await step(tok);                                   // 1164 create 時 allocate 一張 table
  const card = bx('', '#fffaf0', 2.6, 3.1, 0, 4.4, 5.2, 0.3, 3);
  cap('process 被 create 時', 'OS 幫它 allocate 一張 table：PCB');
  await step(tok);                                   // 1179 pointer：放進 queue = PCB 串成 linked list
  const rows = [];
  const row = (t, c, i) => { const r = bx(t, c, 2.6, 5.2 - i * 0.6, 0.3, 4.0, 0.5, 0.3); rows.push(r); return r; };
  row('pointer（下一個 PCB）', CO.gold, 0);
  const others = [5.8, 6.8].map((x) => bx('PCB', '#fffaf0', x, 1.0, 1.4, 0.8, 1.0, 0.2));
  arr(4.8, 5.2, 5.6, 1.6, CO.gold, 0.4); arr(6.2, 1.0, 6.4, 1.0, CO.gold, 1.5);
  cap('process 放進 queue 的真正意思', '是把 PCB 用 linked list 串進 queue');
  await step(tok);                                   // 1231 process state
  row('process state', CO.user, 1);
  cap('process state', '在 new、ready queue 還是 waiting queue');
  await step(tok);                                   // 1250 PC、register：OS 幫它記，在 kernel space
  row('program counter', CO.gold, 2); row('CPU registers', CO.cpu, 3);
  note('process 自己的 memory 裡沒有，只有 OS 需要', -3.0, 3.6);
  cap('PC 和 CPU register 是 OS 幫它記的', '放在 kernel space 的 memory');
  await step(tok);                                   // 1286 複雜的 OS 塞很多資訊
  cap('比較複雜的 OS', '任何管理 process 的資訊都統一放這裡');
  await step(tok);                                   // 1311 CPU scheduling：priority
  row('CPU scheduling：priority', CO.cpu, 4);
  cap('CPU scheduling 的資訊', '例：priority（作業會 implement priority scheduling）');
  await step(tok);                                   // 1327 memory：base / limit register
  row('memory：base / limit', CO.io, 5);
  const hw = pkt('running 時 load 到 hardware register', -3.0, 1.8);
  cap('memory 的 base、limit register 值', '進 running 時才 load 到 hardware');
  await step(tok);                                   // 1374 I/O：在哪個 device 的 waiting queue
  remove(hw); row('I/O status：哪個 device queue', CO.io, 6);
  cap('I/O 的資訊', '在哪一個 I/O device 的 waiting queue');
  await step(tok);                                   // 1394 accounting：開了幾個 file
  row('accounting：開了幾個 file', CO.paper, 7);
  bub('開超過 400 個 file？它知道！', -3.0, 1.6);
  cap('accounting', '開了多少個 file 也記在這');
  await step(tok);                                   // 1405 存在 kernel 自己的 memory
  glow(card, '#3a2a00'); p.mood('happy');
  good('PCB 存在 kernel 自己的 memory', 2.6, -0.4, 2.0);
  cap('PCB 是 OS 管理 process 最重要的資訊', '記得它存在 kernel 自己的 memory');
  void others; void rows;
}]);

// context switch stage: CPU (registers) in the middle, PCB0 / PCB1 on both sides, P0 / P1 buddies
function ctxStage() {
  const cpu = prop('cpu', 0, 0, 0, 1.2, 'CPU');
  const reg = bx('register：P0', PC[0], 0, 1.3, 0.6, 2.2, 0.5, 0.8);
  const pcb = [bx('PCB₀', PC[0], -4.6, 1.0, 0, 1.8, 1.6, 0.6), bx('PCB₁', PC[1], 4.6, 1.0, 0, 1.8, 1.6, 0.6)];
  const pp = [pal('P0', '', PC[0], -4.6, 0, 2.0, 0.55), pal('P1', '', PC[1], 4.6, 0, 2.0, 0.55)];
  return { cpu, reg, pcb, pp };
}
async function regTo(tok, from, to, text, color) {
  const c = bx(text, color, from.x, from.y, 0.9, 1.6, 0.4, 0.5);
  await slide(tok, c, to.x, to.y, 0.9, 800); kill(c);
}
FRAG.push(['proc-7a-ctx', 'Context switch：save 進 PCB、load 另一個 PCB', async (tok) => {
  fresh([0, 5, 14], [0, 2.0, 0]);
  const C = ctxStage(); C.pp[0].mood('happy');
  const who = hot('', 0, 3.4);
  await step(tok);                                   // 1420 context switch 是專有名詞
  hd('context switch', 0, 5.4);
  cap('有了 PCB，還有一件很重要的事', 'context switch（專有名詞）');
  await step(tok);                                   // 1449 定義：把 CPU 上的 process 換成另一個
  cap('把原來在 CPU 上執行的 process', '換成另一個 process 的動作');
  await step(tok);                                   // 1478 P0 在執行：狀態在 register
  tx(who, 'P0 執行中');
  cap('假設 P0 原本在執行', '它的狀態都 load 在 CPU 的 register');
  await step(tok);                                   // 1490 一定是 interrupt 或 system call
  pkt('interrupt / system call', -2.4, 2.6);
  cap('context switch 發生，一定是因為', 'interrupt，或程式 call system call');
  await step(tok);                                   // 1505 不然 CPU 就一直讀下去
  cap('沒有 interrupt 或 system call', 'CPU 就一直 sequential 讀 P0 的指令，永遠卡住');
  await step(tok);                                   // 1522 printf 呼叫 OS；或按 keyboard
  bub('printf → 請 OS 幫忙', -4.6, 3.2); prop('keyboard', 2.4, 0, 2.6, 0.6);
  cap('例：程式 call printf，請 OS 幫忙', '或 hardware interrupt：有人按 keyboard');
  await step(tok);                                   // 1549 P0 被打斷 → idle
  C.pp[0].mood('sad'); tx(who, 'P0 被打斷：idle');
  cap('P0 被打斷後只能 idle', '等 OS 處理完、重新讓它執行');
  await step(tok);                                   // 1566 save：CPU state 存進 PCB0
  tx(who, 'save state into PCB₀');
  await regTo(tok, C.reg.position, C.pcb[0].position, 'PC、reg', PC[0]);
  P.relabel(C.reg, 'register：（空）'); C.reg.material.color.set('#ffffff');
  cap('把 CPU 裡的 state', '全部存到 P0 的 PCB');
  await step(tok);                                   // 1588 load P1 的 state（P1 可能是 OS）
  tx(who, 'reload state from PCB₁');
  await regTo(tok, C.pcb[1].position, C.reg.position, 'PC、reg', PC[1]);
  P.relabel(C.reg, 'register：P1'); C.reg.material.color.set(PC[1]);
  cap('要 run 新的 P1（可能是 OS 或別的 process）', '從 P1 的 PCB load 它的 state');
  await step(tok);                                   // 1616 這段時間兩個都 idle
  bad('這段時間 P0、P1 都 idle', 0, 4.4);
  cap('這段時間 P0、P1 都在 idle', '只是在跑 OS 做 context switch');
  await step(tok);                                   // 1647 switch 完 P1 才執行
  C.pp[1].mood('happy'); tx(who, 'P1 執行中（PC 設到它的位置）');
  cap('context switch 完成，P1 才開始執行', 'PC 設到它要執行的位置開始 fetch');
  await step(tok);                                   // 1672 P1 讓回給 P0：save PCB1、load PCB0
  tx(who, 'save PCB₁ → load PCB₀');
  await regTo(tok, C.reg.position, C.pcb[1].position, 'PC、reg', PC[1]);
  await regTo(tok, C.pcb[0].position, C.reg.position, 'PC、reg', PC[0]);
  P.relabel(C.reg, 'register：P0'); C.reg.material.color.set(PC[0]);
  C.pp[0].mood('happy'); C.pp[1].mood('calm');
  cap('P1 再把執行權讓回 P0', '一樣 save 進 PCB₁、load PCB₀');
  await step(tok);                                   // 1700 context switch = PCB 的 load / save
  tx(who, 'P0 從原來的地方繼續');
  good('context switch = PCB 的 save + load', 0, 4.4, 0.8);
  cap('context switch 就是 kernel', '透過 PCB 做 load 和 save 的動作');
}]);

FRAG.push(['proc-7a-ctxcost', 'Context switch 是 overhead：怎麼變快', async (tok) => {
  fresh([0, 5, 14], [0, 2.2, 0]);
  const u = 0.05, x0 = -6.0;
  await step(tok);                                   // 1731 overhead：浪費 CPU cycle
  for (let k = 0; k < 3; k++) { cube('P' + (k % 2), PC[k % 2], [60 * u, 0.5, 0.6], x0 + (k * 80 + 30) * u, 0.4, 1.4); cube('', CO.bad, [20 * u, 0.5, 0.6], x0 + (k * 80 + 70) * u, 0.4, 1.4); }
  bad('紅色 = context switch：大家都 idle', 0, 1.2, 1.4);
  cap('context switch 是 overhead', '過程中 process 都 idle，浪費 CPU cycle');
  await step(tok);                                   // 1763 想避免，但避免不了：trade-off
  cap('通常想盡量避免：是個 trade-off', '但 CPU 要 share 給所有 process，避免不了');
  await step(tok);                                   // 1784 每幾 ms 一次：非常頻繁
  pkt('⏰ 每幾 ms 一次', 0, 2.2, 1.4);
  cap('time sharing 每多少 ms 就做一次', '非常非常頻繁');
  await step(tok);                                   // 1799 改善：memory 的速度
  const mem = prop('warehouse', -4.4, 0, -1.6, 0.8, 'memory');
  cap('實際系統要減少 switch 的時間', '第一：memory 快一點（save / load 都是 memory 存取）');
  await step(tok);                                   // 1817 register 數量：少存一點，但大家想要更多
  const rg = Array.from({ length: 8 }, (_, i) => bx('r' + i, CO.cpu, -0.9 + (i % 4) * 0.6, 3.0 + Math.floor(i / 4) * 0.5, -1.6, 0.5, 0.4, 0.5));
  note('register 少 → 要存的少；但大家想要更多 register', 0, 4.4, -1.6);
  cap('第二：register 的數量', '少一點要存的就少，但現在 CPU 的 register 只會變多');
  await step(tok);                                   // 1847 software：一個指令做完 load + save
  pkt('一個 instruction：load + save 一次做完', 3.4, 3.2, -1.6);
  cap('software 端：OS 跟 CPU 合作', '一個 instruction 就做完 load 和 save');
  await step(tok);                                   // 1883 hardware support：多組 register set
  const sets = [0, 1, 2, 3].map((i) => bx('register set ' + i, PC[i], 4.6, 0.4 + i * 0.55, -0.4, 2.4, 0.45, 0.8, 2));
  cap('更常見的是 hardware support', 'CPU 裡有好幾組 register set');
  await step(tok);                                   // 1915 switch 只是換一組 → 快；成本高
  glow(sets[1], '#3a2a00'); good('不用寫回 memory → 快', 4.6, 2.9, -0.4); bad('register 比較貴', 4.6, 3.5, -0.4);
  cap('switch 只是換用另一組 register', '不用寫回 memory → 快；但成本比較高');
  await step(tok);                                   // 1975 作業 3 trace code
  code(['void Scheduler::Run(…) {   // 示意', '  SWITCH(old, next);  // save / load', '}'], -3.0, 6.4, 0.42, 0);
  cap('作業 3 trace code 會看到', 'context switch 的 function 和 PCB（Nachos 叫 thread control block）');
  void mem; void rg;
}]);

// ════════ aKiUuuKXfKY（第 7B 講）：scheduling 與各種 queue、queueing diagram ════════
// a queue drawn as a row of floor slots with a header label and PCB cards
function qRow(name, x, z, n = 5, color = '#f3e6c8') {
  for (let k = 0; k < n; k++) ctx.tile(V3(x + k * 0.8, 0.04, z), 0.7, 0.7, color);
  const h = hd(name, x - 1.3, 0.3, z);
  return { x, z, h, at: (k) => [x + k * 0.8, 0, z] };
}
FRAG.push(['proc-7b-queues', 'Process scheduling 與各種 queue', async (tok) => {
  fresh([0, 6.5, 13.5], [0, 1.2, 0]);
  await step(tok);                                   // 1 介紹 OS 裡的 scheduler
  hd('process scheduling', 0, 4.6);
  cap('知道 life cycle 和 context switch 後', '先簡單介紹 OS 裡的 scheduler');
  await step(tok);                                   // 6 非常重要
  note('scheduling 在 OS 裡非常非常重要', 0, 3.8);
  cap('process 的 scheduling', '在 OS 裡非常非常重要');
  await step(tok);                                   // 45 很多 process 在 memory：maximize utilization
  const ps = crowd(5, -2.0, -2.4, ['P1', 'P2', 'P3', 'P4', 'P5'], null, 0.45, 5, 1.0, 0);
  const cpu = prop('cpu', 4.6, 0, -2.4, 0.8, 'CPU');
  cap('很多 process 在 memory：multiprogramming', '才能 maximize CPU utilization');
  await step(tok);                                   // 60 很頻繁 context switch → time sharing
  await slide(tok, ps[0].g, 4.6, 0, -1.4, 450); await slide(tok, ps[0].g, -2.0, 0, -2.4, 450);
  cap('而且很頻繁地做 context switch', '實現 time sharing，才有 interactive 的系統');
  await step(tok);                                   // 78 輪流使用 CPU，順序由 scheduling 決定
  const sch = pal('scheduler', '', CO.os, 1.8, 0, -0.6, 0.55);
  cap('process 必須輪流使用 CPU', '誰先誰後由 scheduling algorithm 負責');
  await step(tok);                                   // 92 CPU free 或被迫 switch → scheduler 選一個
  sch.mood('wow'); await sch.hop(tok);
  await slide(tok, ps[1].g, 4.6, 0, -1.4, 600); ps[1].mood('happy');
  cap('CPU free 出來，或被強迫 context switch', 'scheduler 被叫起來，選一個新的 process');
  await step(tok);                                   // 115 在 queue 裡；不只 ready queue
  gone(...ps, sch);
  const R = qRow('ready queue', -2.4, -0.6), J = qRow('job queue', -2.4, -2.2), D = qRow('device queue', -2.4, 1.4);
  cap('排程時 process 被放在 queue 裡', '不只 ready queue，還有 job queue、device queue');
  await step(tok);                                   // 136 有 queue 就要 schedule；最主要是 ready queue
  setCls(R.h, 'ptr alt');
  cap('只要有 queue 的地方就要 schedule', '最主要的是 ready queue：誰去用 CPU');
  await step(tok);                                   // 152 早期 memory 少：job queue
  const disk = prop('disk', -6.0, 0, -2.2, 0.6);
  const jp = [0, 1, 2].map((k) => bx('PCB', '#c9b48e', ...J.at(k), 0.6, 0.4, 0.6));
  jp.forEach((m) => { m.position.y = 0.25; });
  cap('早期 memory 有限時還有 job queue', '決定哪個 program 可以 load 進 memory 成為 process');
  await step(tok);                                   // 182 進 ready queue 後再 schedule 一次
  await slide(tok, jp[0], R.at(0)[0], 0.25, R.z, 700); jp[0].material.color.set(CO.user);
  cap('被選中進入 ready queue 之後', '還要再被 schedule 一次，決定何時用 CPU');
  await step(tok);                                   // 193 waiting：device queue，每個 device 一個
  const dq = [1.4, 2.4, 3.4].map((z, i) => { const h = hd(['disk', 'printer', 'keyboard'][i] + ' queue', 3.6, 0.3, z - 1.0 + i * 0.3); return h; });
  cap('waiting state 有 device queue', '每個 device 通常有自己的 queue；sleep 也有別的 waiting queue');
  await step(tok);                                   // 232 一個 ready queue、很多 I/O queue，用 PCB pointer 串
  const rp = [1, 2].map((k) => { const m = bx('PCB', CO.user, ...R.at(k), 0.6, 0.4, 0.6); m.position.y = 0.25; return m; });
  arr(R.at(0)[0] + 0.3, 0.3, R.at(1)[0] - 0.3, 0.3, CO.gold, R.z); arr(R.at(1)[0] + 0.3, 0.3, R.at(2)[0] - 0.3, 0.3, CO.gold, R.z);
  cap('一個 ready queue for CPU、很多個 I/O queue', '用 PCB 裡的 pointer 串起來');
  await step(tok);                                   // 251 head、tail、雙向串，方便 reorder
  hot('head', R.at(0)[0], 0.9, R.z); hot('tail', R.at(2)[0], 0.9, R.z);
  cap('有時 head 和 tail 都串起來、甚至雙向', '方便 run time 調整順序（reorder）');
  await step(tok);                                   // 277 作業 3：ready queue 分 level 1、2、3
  [1, 2, 3].forEach((l) => idx('level ' + l, 3.0, 0.3, -2.4 + l * 0.5));
  cap('作業 3 實作比較複雜的 scheduling', 'ready queue 可能分成 level 1、2、3');
  void cpu; void disk; void D; void dq; void rp;
}]);

FRAG.push(['proc-7b-qdiagram', 'Queueing diagram：process 在 queue 之間移動', async (tok) => {
  fresh([0, 6, 14], [0, 1.6, 0]);
  const R = qRow('ready queue', -5.0, 2.4);
  const cpu = prop('cpu', 2.6, 0, 2.4, 0.9, 'CPU');
  const lanes = [['I/O queue → I/O', 1.0], ['time slice expired', 0], ['fork a child', -1.2], ['wait for an interrupt', -2.4]];
  lanes.forEach(([n, z]) => { idx(n, 0.8, 0.1, z); P.line(-6.0, 0.05, 6.0, 0.05, z - 0.3, '#e0d3bb'); });
  const p = pal('P', '', PC[1], ...R.at(0), 0.45);
  const others = [1, 2, 3].map((k) => pal('', '', PC[k + 2], ...R.at(k), 0.4));
  const toCpu = async () => { await slide(tok, p.g, 2.6, 0.5, 2.4, 600); p.mood('happy'); };
  const lane = async (z) => { await slide(tok, p.g, 5.0, 0, z, 600); };
  const back = async (z) => { await slide(tok, p.g, -6.2, 0, z, 800); await slide(tok, p.g, ...R.at(4), 500); p.mood('calm'); };
  await step(tok);                                   // 303 queue 和 state 轉換的關係
  hd('queueing diagram', 0, 4.4);
  cap('ready queue 是最主要的 scheduling', '看 queue 跟 state 轉換之間的關係');
  await step(tok);                                   // 317 在 ready queue 等 CPU
  await toCpu();
  cap('process 通常在 ready queue 等 CPU', '被 dispatch 上去執行');
  await step(tok);                                   // 323 I/O request → I/O queue
  bub('printf！', 2.6, 2.0, 2.4);
  await lane(1.0); p.mood('sad');
  cap('自己發出 I/O request（call printf）', '被放到 I/O queue（monitor 的 device queue）');
  await step(tok);                                   // 334 I/O 做完 → interrupt → 回 ready queue
  pkt('I/O 完成：interrupt', 5.0, 1.2, 1.0);
  await back(1.0);
  cap('做完 I/O，丟一個 interrupt 回來', 'OS 就把它放回 ready queue');
  await step(tok);                                   // 346 timer alarm → 直接回 ready queue
  await slide(tok, p.g, 2.6, 0.5, 2.4, 600);
  pkt('⏰ timer', 2.6, 2.0, 1.6); await lane(0); await back(0);
  cap('timer 的 alarm 被 fire（time sharing）', '從 CPU 直接回到 ready queue');
  await step(tok);                                   // 357 create process（fork）：parent / children 是 tree
  await slide(tok, p.g, 2.6, 0.5, 2.4, 600);
  await lane(-1.2);
  const ch = pal('child', '', PC[5], 5.0, 0, -1.2, 0.35); await slide(tok, ch.g, 6.2, 0, -0.6, 500);
  cap('process 可以 create process', 'Linux 叫 fork；parent 和 children 形成 tree');
  await step(tok);                                   // 385 讓 child 先跑：parent 進 waiting queue
  bub('child 先執行，parent 等', 5.0, 1.2, -1.2); p.mood('sad');
  await wt(tok, 600); gone(ch); await back(-1.2);
  cap('設計成讓 children 先執行的話', 'parent 進 waiting queue，等 child 完再回 ready queue');
  await step(tok);                                   // 419 wait for interrupt：sleep 100 秒
  await slide(tok, p.g, 2.6, 0.5, 2.4, 600);
  bub('sleep(100)', 2.6, 2.0, 2.4); await lane(-2.4); p.mood('calm');
  pkt('100 秒到：interrupt → wake up', 5.0, 1.2, -2.4); await back(-2.4);
  cap('wait for interrupt：例如 sleep 100 秒', '時間到 fire interrupt 叫醒它，回 ready queue');
  await step(tok);                                   // 450 waiting queue 有很多種
  good('不同的 event → 各有專門的 waiting queue', 0, 3.6);
  cap('從 CPU 被踢出來的原因很多', 'OS 通常為每種 event 準備專門的 queue');
  void cpu; void others;
}]);

// ════════ RrjOXZ-XzkM（第 8C 講）：fork / execlp 為何分開、範例程式、fork 迴圈的 tree、termination ════════
FRAG.push(['proc-8c-why', '為什麼 Linux 把 fork 和 execlp 分開', async (tok) => {
  fresh([0, 5, 14], [0, 2.4, 0]);
  await step(tok);                                   // 15 為什麼要有 fork 再 execlp？
  const st = pal('同學', '', '#f0c27a', -5.4, 0, 1.6, 0.6); st.mood('wow');
  bub('為什麼要 fork 再 execlp？', -5.0, 1.6, 1.6);
  cap('下課很多同學問', '為什麼要先 fork、再 execlp？');
  await step(tok);                                   // 27 每個 OS 可以 define 自己的 system call
  const os = pal('Linux', '', CO.os, 0, 0, 0, 0.8);
  cap('回到根本：每個 OS 可以 define 自己的 system call', '這是 Linux 的 decision');
  await step(tok);                                   // 38 fork：process creation
  const f = bx('fork()：create process', CO.user, -3.0, 4.2, 0, 3.4, 0.7, 1.0, 2);
  cap('一個 system call 叫 fork', '做 process creation');
  await step(tok);                                   // 44 execlp：replace 執行的 code（reset）
  const e = bx('execlp()：reset 內容', CO.disk, 3.0, 4.2, 0, 3.4, 0.7, 1.0, 2);
  cap('另一個叫 execlp', 'replace 程式目前執行的 code：reset 一個 program');
  await step(tok);                                   // 62 兩件事切開
  ln(0, 3.8, 0, 4.6, 0, CO.bad);
  cap('它決定把兩件事切開', '用兩個不同的 system call');
  await step(tok);                                   // 76 想 run 另一個 binary：先 fork 再 execlp
  const seq = pkt('fork → execlp', 0, 3.2);
  cap('想 create 新 process 跑另一個 binary', '就必須先 call fork，再 call execlp');
  await step(tok);                                   // 96 合理：create 和 reset 完全不同
  remove(seq);
  cap('這很合理', 'create process 和 reset 內容是完全不同的兩件事');
  await step(tok);                                   // 111 create：allocate memory、PCB、initialize
  ['memory space', 'PCB', 'metadata', 'initialize'].forEach((n, i) => bx(n, CO.user, -4.4 + (i % 2) * 2.4, 2.4 - Math.floor(i / 2) * 0.7, 0.4, 2.2, 0.5, 0.6, 2));
  cap('create：allocate memory 空間', 'create PCB、metadata，還要 initialize');
  await step(tok);                                   // 145 裡面存什麼（變數、PC、code）是 execlp 設定
  ['variable 狀態', 'program counter', 'code section'].forEach((n, i) => bx(n, CO.disk, 4.0, 2.4 - i * 0.7, 0.4, 2.6, 0.5, 0.6, 2));
  cap('create 出來後裡面存什麼', '變數、PC、code 的內容：由 execlp 設定');
  await step(tok);                                   // 184 之前討論 creation 的可能性：別被綁死
  os.mood('happy');
  note('這只是 Linux 的決定，別被綁死', 0, 5.4);
  cap('之前花工夫討論各種可能性', '因為這只是 Linux 的決定');
  await step(tok);                                   // 200 三個考量
  idx('執行順序 / resource 歸屬 / memory 起始狀態', 0, 6.2);
  cap('parent 和 children 的關聯性', '執行順序、資源歸屬、memory space 的起始狀態');
  await step(tok);                                   // 238 新版 Linux 也可能有新的 system call
  cap('新版 Linux 也可能 define', '新的 system call 支援不同方式的 creation');
  await step(tok);                                   // 257 system call 越少越好，programmer 自己兜
  st.mood('happy'); good('kernel：system call 越少越好；programmer 自己組合', 0, 0.2, 2.2);
  cap('kernel 很複雜，system call 越少越好', '像一個個 service，programmer 自己去兜');
  void f; void e;
}]);

FRAG.push(['proc-8c-example', '範例：fork + execlp + wait 的輸出', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.6, 0]);
  const L = ['a = fork();', 'if (a == 0) {', '  printf("child\\n");', '  execlp("/bin/ls", "ls", NULL);', '} else {', '  printf("parent\\n");', '  wait(&status);', '}', 'printf("process end\\n");'];
  const A = code(L, -3.8, 6.4, 0.46), B = code(L, 3.4, 6.4, 0.46);
  B.ls.forEach((l) => { l.element.style.opacity = '0.12'; });
  tag('示意程式（依課堂說明）', 'idx', -3.8, 6.9);
  const out = []; const outY = (k) => 1.6 - k * 0.42;
  const print = (t) => { out.push(tag(t, 'pkt', 0, outY(out.length), 2.2)); };
  await step(tok);                                   // 297 直接用三個 system call 寫程式
  hd('螢幕 output', 0, 2.1, 2.2);
  cap('用剛剛三個 system call', '寫一個簡單的程式');
  await step(tok);                                   // 310 call fork（C library function）
  A.hl(0);
  const pa = pal('parent', '', PC[0], -5.8, 0, 2.2, 0.55);
  cap('call fork：其實是 C library 的 function', '它會再去 call OS 的 system call');
  await step(tok);                                   // 333 旁邊又來一支一模一樣的：雙胞胎
  const ch = pal('child', '', PC[1], -5.8, 0, 2.2, 0.55);
  await slide(tok, ch.g, 5.8, 0, 2.2, 900);
  B.ls.forEach((l) => { l.element.style.opacity = ''; }); B.hl(0);
  cap('腦中要想像：旁邊又來一支 process', '程式一模一樣（雙胞胎），各有自己的 PC');
  await step(tok);                                   // 357 唯一不同：return 值
  pa.set('a = child 的 PID'); ch.set('a = 0');
  cap('唯一不一樣：return 值', 'parent 的 a 不可能是 0（是 child 的 PID）');
  await step(tok);                                   // 373 parent 走 else
  A.hl(4);
  cap('下一行 if else', 'parent 發現不符合，跳到 else');
  await step(tok);                                   // 388 child 的 a = 0：進 if
  B.hl(1);
  cap('child 剛好反過來', 'a 是 0，所以進到 if 裡面');
  await step(tok);                                   // 397 程式碼一樣，走到不同的地方
  cap('程式碼一樣、同時在跑', '但 trace 時會走到不同的地方，各自獨立');
  await step(tok);                                   // 409 child print「我是 child」
  B.hl(2); print('child');
  cap('child 就去 print 這一行', '「我是 child process」');
  await step(tok);                                   // 429 child call execlp；parent call wait
  B.hl(3); A.hl(6); pa.mood('sad');
  cap('接著 child call execlp', 'parent call wait');
  await step(tok);                                   // 441 execlp 覆蓋程式碼 → 跑 ls
  B.ls.forEach((l, k) => { if (k > 3) l.element.style.opacity = '0.12'; });
  ch.set('ls'); ch.mood('happy');
  cap('execlp 把原來的程式碼整個覆蓋掉', '/bin/ls：Linux 裡 list folder 的指令');
  await step(tok);                                   // 475 ls 跑完就結束，不會執行後面
  print('（ls 的輸出：檔案列表）');
  await wt(tok, 400); gone(ch);
  cap('child 執行完 ls 就結束', '後面的程式它全部看不見了');
  await step(tok);                                   // 492 parent wait：等的還是同一個 process
  bub('等的還是同一個 child（同一個 PID）', -3.8, 1.6, 2.2);
  cap('parent 在 wait', '內容換了，但還是同一支 process');
  await step(tok);                                   // 518 parent 在 waiting queue；child 結束 → signal → ready
  pa.mood('happy'); A.hl(8);
  cap('parent 在 waiting queue 等 child terminate', 'OS 知道結束就 signal 它，放回 ready queue');
  await step(tok);                                   // 552 最後一行只有 parent 執行
  print('process end');
  cap('最後一行只會被 parent 執行到', 'child 已經變成 ls，看不見它');
  await step(tok);                                   // 574 output：前兩行 child、parent，順序不一定
  const sw = note('前兩行順序不一定（concurrent）', 3.0, 1.6, 2.2);
  cap('看 output：前兩行是 child 和 parent', '順序沒有一定，可能互換');
  await step(tok);                                   // 599 第三行 ls，一定在最後一行之前
  remove(sw); out.forEach((o) => setCls(o, 'pkt'));
  good('ls 一定在 process end 之前（因為 wait）', 3.0, 1.6, 2.2);
  cap('ls 一定出現在最後一行之前', '因為 parent 要 wait child 結束');
  await step(tok);                                   // 662 process end 只會有一行
  bad('process end 只會有一行', 3.0, 0.9, 2.2);
  cap('process end 只可能看見一行', '不可能看見兩行');
  await step(tok);                                   // 672 考試：用 system call 寫的程式，要能推出 output
  cap('考試可能給這種簡單程式', '懂 fork、execlp、wait 的意義就能推出 output');
  await step(tok);                                   // 711 wait(&status)：status 指標、回傳 PID
  A.hl(6);
  note('wait(&status)：存 child 的結束狀態；回傳 child 的 PID', -3.8, 0.9, 2.2);
  cap('Linux 的 wait 要塞一個 status pointer', '記錄 success 或 fail；回傳等到的 PID');
  await step(tok);                                   // 754 沒指定哪個 child：任何一個結束就 break
  cap('這裡沒指定等哪一個', '任何一個 child 結束就 break；也有指定的版本');
}]);

// a fork tree for `for (i = 0; i < 3; i++) fork();` (creation order P0..P7)
FRAG.push(['proc-8c-forkloop', 'for 迴圈裡 fork 三次：畫出 process tree', async (tok) => {
  fresh([0, 4, 14.5], [0, 3.0, 0]);
  const cd = code(['for (i = 0; i < 3; i++)', '  fork();'], -4.6, 6.6, 0.5);
  const pos = { 0: [0.4, 5.6], 1: [3.6, 4.0], 2: [-1.6, 4.0], 3: [4.8, 2.4], 4: [-3.4, 2.4], 5: [2.4, 2.4], 6: [-1.6, 2.4], 7: [4.8, 0.8] };
  const par = { 1: 0, 2: 0, 3: 1, 4: 0, 5: 1, 6: 2, 7: 3 };
  const N = {};
  const node = (k, i) => { const [x, y] = pos[k]; if (par[k] !== undefined) ln(pos[par[k]][0], pos[par[k]][1] - 0.25, x, y + 0.25, 0, '#8a7a5c'); N[k] = bx('P' + k + (i !== undefined ? '（i=' + i + '）' : ''), PC[k % 8], x, y, 0, 1.6, 0.5, 0.7, 2); };
  const cnt = hot('', 4.8, 6.4);
  await step(tok);                                   // 798 tree：child 也可以再 create
  cap('還記得 process 是一棵 tree', '因為 child 也可以再 create');
  await step(tok);                                   // 810 三次 for loop 裡寫 fork
  cd.hl(0);
  cap('簡單的程式：for loop 三次', '裡面都寫個 fork');
  await step(tok);                                   // 819 每個人繼續下一個 iteration，又 fork
  cd.hl(1);
  cap('fork 之後有 child 和 parent', '每個人都會繼續下一個 iteration，又 call fork');
  await step(tok);                                   // 835 trace：畫成 tree 就不會 lost
  note('畫成 tree：誰是誰的 parent、PC 在哪', -4.6, 5.0);
  cap('trace code 要知道誰是誰的 parent', '最簡單的方式：畫成 tree');
  await step(tok);                                   // 860 P0，i = 0 fork → P1
  node(0); await wt(tok, 300); node(1, 0); tx(cnt, '2 個 process');
  cap('P0 是原來的程式：i = 0 call fork', '產生 P1');
  await step(tok);                                   // 894 PC 沒 reset：i = 1 兩個都 fork
  node(2, 1); await wt(tok, 300); node(3, 1); tx(cnt, '4 個 process');
  cap('fork 不會 reset PC：下一輪 i 都是 1', 'P0 生 P2、P1 生 P3');
  await step(tok);                                   // 919 4 個都跑 i = 2：每個人再 fork
  for (const k of [4, 5, 6, 7]) { node(k, 2); await wt(tok, 250); }
  tx(cnt, '8 個 process = 2³');
  cap('4 個 process 都再走一次 for loop', 'i = 2 每個人 call 一次 fork → 8 個');
  await step(tok);                                   // 937 考題會混 if else、execlp
  cap('考題可能複雜一點', '多一些 if else、加上 execlp');
  await step(tok);                                   // 951 if pid == 0 execlp：那支就斷掉，不會多產生
  glow(N[2], '#5a1010'); bad('execlp：內容換掉，不再往下 fork', -1.6, 3.3, 0.6);
  cap('例：if (pid == 0) call execlp', 'execlp 不會產生新 process，那支就停在這');
  await step(tok);                                   // 987 自己出題、在 server 上跑跑看
  good('自己寫程式在 server 上 run，對照你的 tree', 0, 0.0, 1.6);
  cap('最好的練習：自己寫程式', '在 server 上 run，看結果跟你想的有沒有 match');
}]);

FRAG.push(['proc-8c-exit', 'Termination：exit、abort、cascading', async (tok) => {
  fresh([0, 4.5, 14.5], [0, 2.6, 0]);
  await step(tok);                                   // 1046 termination：call exit
  hd('process termination', 0, 6.2);
  const p = pal('process', '', PC[2], -4.0, 0, 0.6, 0.7);
  bub('exit()', -4.0, 1.6, 0.6);
  cap('termination：call exit', '這個 system call');
  await step(tok);                                   // 1063 main return 也會 call exit
  code(['int main() {', '  …', '  return 0;   // → exit()', '}'], -4.0, 4.6, 0.45);
  cap('main return 的時候', '其實就會 call 到 exit');
  await step(tok);                                   // 1072 把 resource 全部 deallocate
  const rs = ['file handler', 'I/O buffer', 'memory'].map((n, i) => bx(n, [CO.io, CO.cpu, CO.user][i], -1.8, 0.4 + i * 0.6, 0.6, 1.8, 0.5, 0.6));
  const os = pal('OS', '', CO.os, 1.6, 0, 0.6, 0.6);
  for (const r of rs) await slide(tok, r, 1.6, 1.6, 0.6, 400);
  gone(...rs, p); os.mood('happy');
  cap('把所有 resource deallocate', 'file handler、I/O buffer、memory 全部還給 OS');
  await step(tok);                                   // 1101 parent 可以強迫 kill child：abort(PID)
  const P0 = pal('parent', '', PC[0], 3.0, 0, -1.4, 0.6), C1 = pal('child', '', PC[1], 5.4, 0, 0.6, 0.5);
  ln(3.0, 0.6, 5.4, 0.6, 0);
  bub('abort(child 的 PID)', 3.0, 1.6, -1.4);
  cap('parent 也可以強迫 kill 一個程式', '叫 abort，給它一個 PID');
  await step(tok);                                   // 1124 只能 kill children
  C1.mood('sad');
  note('只能 kill 自己的 children', 4.2, 2.6, -0.4);
  cap('只能 kill 你的 children', '不能 kill parent（那自己也會被砍）');
  await step(tok);                                   // 1146 何時 abort：child 用太多資源、client 斷線
  const ws = prop('monitor', 0, 0, -1.6, 0.7, 'web server');
  cap('什麼時候 abort？例：web server', 'child 用太多資源（malicious user）或 client 斷線了');
  await step(tok);                                   // 1208 tree：kill parent → 下面全部砍掉
  gone(C1);
  const kids = [[5.0, 0.6], [6.2, 0.6], [5.6, 2.0]].map(([x, z], i) => pal('', '', PC[i + 3], x, 0, z, 0.4));
  await wt(tok, 300); P0.mood('sad'); for (const k of [P0, ...kids]) { gone(k); await wt(tok, 250); }
  bad('kill parent → 下面全部一層一層砍掉', 4.2, 2.6, 0.6);
  cap('OS 是 tree：kill 一個 parent', '它下面所有 children 都會被一層一層砍掉');
  await step(tok);                                   // 1245 Ctrl-C：console 是 parent
  gone(ws);
  const con = pal('console', '', CO.os, -1.0, 0, 2.4, 0.6), run = pal('你的程式', '', PC[5], 1.4, 0, 2.4, 0.5);
  bub('Ctrl-C', -1.0, 1.5, 2.4); await wt(tok, 500); run.mood('sad'); gone(run);
  cap('你一定用過 Ctrl-C', 'console 是上層的 process，對它的 child 下 abort');
  await step(tok);                                   // 1311 kill 別人的程式：要 permission，找 OS
  bub('kill（需要 permission）→ OS（root）', 3.6, 3.6, 0);
  cap('砍別人產生的 process 要用 kill', '透過 system call 請 OS（root），要有權限');
  await step(tok);                                   // 1360 層層嚴謹的關係
  good('process 之間有嚴謹的上下層關係', 0, 0.2, 3.4);
  cap('使用上感覺不出來', '但 process 之間有很嚴謹的一層一層關係');
  void con;
}]);

// ════════ oiB5Oalb8A8（第 8D 講）：IPC、shared memory vs message passing、socket、RPC、bounded buffer ════════
FRAG.push(['proc-8d-ipc', 'Interprocess communication：為什麼要溝通', async (tok) => {
  fresh([0, 5, 14], [0, 2.4, 0]);
  await step(tok);                                   // 2 最後一塊：IPC
  hd('Interprocess Communication（IPC）', 0, 6.2);
  cap('最後一塊：interprocess communication', '俗稱 IPC');
  await step(tok);                                   // 4 能 create、kill 了，接下來要溝通
  const a = pal('P1', '', PC[0], -2.4, 0, 0.6, 0.7), b = pal('P2', '', PC[1], 2.4, 0, 0.6, 0.7);
  const m = pkt('hello', -1.6, 1.4, 0.6); await travel(tok, m, V3(-1.6, 1.4, 0.6), V3(1.6, 1.4, 0.6), 900); remove(m);
  a.mood('happy'); b.mood('happy');
  cap('process 能 create、能 kill 了', '真的使用時常要互相溝通，兜成更大的系統');
  await step(tok);                                   // 55 process 或 thread 之間都叫 IPC
  note('process 或 thread 之間的溝通都叫 IPC', 0, 5.2);
  cap('多個 process 甚至 thread 之間', 'OS 有時不分，溝通機制統稱 IPC');
  await step(tok);                                   // 93 independent vs cooperating
  const c = pal('獨行俠', '', CO.idle, -5.4, 0, 2.2, 0.5);
  idx('independent：不溝通', -5.4, 1.2, 2.2); idx('cooperating：要溝通', 0, -0.2, 2.2);
  cap('independent process：不溝通', 'cooperating process：大系統、網路程式都需要');
  await step(tok);                                   // 123 ① information sharing
  const R = [];
  const reason = (t, i) => { R.push(bx(t, [CO.user, CO.cpu, CO.io, CO.os][i], 5.0, 4.4 - i * 0.8, 0, 2.8, 0.6, 0.9, 2)); };
  reason('① information sharing', 0);
  cap('溝通的目的一：information sharing', '網路程式都是，socket 也是一種 IPC');
  await step(tok);                                   // 138 ② 平行計算加速
  reason('② 平行計算加速', 1);
  cap('二：平行程式', '很多 process / thread 一起算同一個問題來加速');
  await step(tok);                                   // 160 ③ 方便：web server
  reason('③ convenience', 2);
  prop('monitor', -5.4, 2.4, -1.6, 0.6, 'web server');
  cap('三：方便', '像 web server：每個 user 對到一個 process / thread');
  await step(tok);                                   // 180 ④ modularity：microkernel
  reason('④ modularity', 3);
  cap('四：modularity，標準例子是 microkernel', 'component 放 user space，用 IPC 溝通');
  void c;
}]);

FRAG.push(['proc-8d-models', 'Shared memory vs Message passing', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.4, 0]);
  const L = [pal('P1', '', PC[0], -5.4, 0, 0.6, 0.55), pal('P2', '', PC[1], -1.6, 0, 0.6, 0.55)];
  const R = [pal('P1', '', PC[0], 1.6, 0, 0.6, 0.55), pal('P2', '', PC[1], 5.4, 0, 0.6, 0.55)];
  await step(tok);                                   // 208 兩種：shared memory、message passing
  hd('shared memory', -3.5, 5.8); hd('message passing', 3.5, 5.8);
  cap('OS 提供的溝通方式用 memory 來分', '要嘛 shared memory，要嘛 message passing');
  await step(tok);                                   // 237 shared memory：一塊共用空間，pointer 直接存取
  const sh = bx('shared region', CO.gold, -3.5, 2.4, 0, 2.6, 0.6, 1.0, 2);
  arr(-5.0, 1.2, -4.2, 2.1, CO.gold); arr(-2.0, 1.2, -2.8, 2.1, CO.gold);
  cap('shared memory：有一塊共用的 memory', '兩個都用 pointer 直接 access、讀寫');
  await step(tok);                                   // 252 message passing：memory copy，像傳訊息
  const k = bx('kernel', CO.os, 3.5, 2.4, 0, 2.2, 0.6, 1.0, 2);
  const msg = pkt('copy', 1.6, 1.4, 0.6);
  await travel(tok, msg, V3(1.6, 1.4, 0.6), V3(3.5, 2.9, 0.6), 600); await travel(tok, msg, V3(3.5, 2.9, 0.6), V3(5.4, 1.4, 0.6), 600); remove(msg);
  cap('message passing：透過 memory copy', '跨電腦時更像傳訊息，像 email');
  await step(tok);                                   // 277 network、socket programming 都是 message passing
  note('socket programming：封包傳到另一台電腦', 3.5, 4.0);
  cap('網路程式、socket programming', '都是 message passing');
  await step(tok);                                   // 298 shared memory：synchronization 討厭；快
  bad('缺點：synchronization 很難', -3.5, 4.6); good('優點：快（直接用 address）', -3.5, 4.0);
  cap('shared memory 最討厭的是 synchronization', '好處是快：用 memory address 直接存取');
  await step(tok);                                   // 321 用 pointer → shared；call send / receive → message
  idx('用 pointer → shared memory', -3.5, 3.4); idx('call send / receive → message passing', 3.5, 3.4);
  cap('自己就感覺得出來', '用 pointer 是 shared memory；call send、receive 是 message passing');
  await step(tok);                                   // 343 message passing：要 system call + copy → 慢
  bad('system call + copy → 比較慢', 3.5, 4.6);
  cap('message passing 要透過 system call', '又要 copy，通常比較慢');
  await step(tok);                                   // 357 資料小、免 synchronization → 可能更快
  good('資料小 / 不用 locking → 有時更快', 3.5, 4.0);
  cap('但資料很小、或不想碰 synchronization', 'message passing 有時反而更快');
  await step(tok);                                   // 382 跨電腦只能 message passing
  const net = prop('monitor', 6.4, 0, -1.8, 0.6, '另一台電腦');
  cap('看你要做的事', '跨電腦沒有選擇：用 message passing');
  await step(tok);                                   // 401 人多、複雜 → message；人少、簡單 → shared
  note('人多、pattern 複雜 → message passing；人少、簡單 → shared memory', 0, 6.6);
  cap('一般判斷：一台還多台、溝通的人多還少', '複雜用 message passing，簡單用 shared memory');
  await step(tok);                                   // 425 OS 提供兩種；message passing 包成 API
  glow(k, '#3a2a00'); bx('API（一層層包起來）', CO.cpu, 3.5, 3.1, 0, 2.6, 0.4, 0.8, 2);
  cap('OS 兩種都提供', 'message passing 不直接 call system call，用包好的 API');
  void L; void R; void sh; void net;
}]);

FRAG.push(['proc-8d-socket', 'Socket：IP + port', async (tok) => {
  fresh([0, 5, 14], [0, 2.2, 0]);
  await step(tok);                                   // 453 最常見：socket，還有 RPC
  bx('socket', CO.cpu, -2.4, 5.4, 0, 2.2, 0.6, 0.9, 2); bx('RPC', CO.user, 2.4, 5.4, 0, 2.2, 0.6, 0.9, 2);
  cap('message passing 最常見的：socket', '另一個是 RPC');
  await step(tok);                                   // 471 分散式系統用 RPC
  idx('跨電腦的分散式系統常用', 2.4, 4.6);
  cap('很多大型、跨電腦的分散式系統', '都用 RPC 做 programming');
  await step(tok);                                   // 492 socket 很基本
  note('建議修網路程式設計，寫一次 socket', -2.4, 4.6);
  cap('socket 很基本', '不熟的話一定要寫一下 socket programming');
  await step(tok);                                   // 505 用 IP 跟 port identify
  const h1 = prop('monitor', -4.4, 0, 0, 1.0), h2 = prop('monitor', 4.4, 0, 0, 1.0);
  cap('socket identify 對方的方式', '透過 IP 和 port');
  await step(tok);                                   // 516 IP：一台電腦
  hot('IP：140.114.x.x（示意）', -4.4, 2.6); hot('IP：另一台', 4.4, 2.6);
  cap('IP 指的是一台電腦', '');
  await step(tok);                                   // 522 port：HTTP、FTP 21
  cap('port 呢？每個服務有 port number', '例：FTP 是 21');
  await step(tok);                                   // 532 port 就是 process：bind
  const ps = [80, 21].map((p, i) => pal('port ' + p, '', PC[i + 2], 3.6 + i * 1.6, 0, 1.8, 0.45));
  ps.forEach((b) => b.mood('happy'));
  idx('process bind 到 port', 4.4, 0.3, 2.8);
  cap('port number 其實就是 process', '程式先 bind 到 port，OS 就把封包交給它');
  await step(tok);                                   // 556 identify 哪台 host 的哪支程式；不能兩個綁同一個 port
  const pk = pkt('封包 → IP:port', -3.6, 1.6, 0.8);
  await travel(tok, pk, V3(-3.6, 1.6, 0.8), V3(3.6, 1.0, 1.8), 1000);
  bad('兩個 process 綁同一個 port？不可能', 0, 3.6);
  cap('IP + port：哪台 host 上的哪支程式', '不可能兩個 process 綁到同一個 port');
  await step(tok);                                   // 580 socket 很 low-level：一串 bytes
  tx(pk, '0x48 0x65 0x6c 0x6c …（bytes）');
  cap('socket 的溝通很 low-level', 'message 就是一串 bytes，沒有資料型態');
  await step(tok);                                   // 604 sender、receiver 自己說好怎麼解讀
  bub('這串 bytes 要怎麼解讀？我們先說好', 0, 4.4);
  cap('sender、receiver 要自己說好', '才能解讀內容；要 data structure 就用別的方式');
  void h1; void h2;
}]);

FRAG.push(['proc-8d-rpc', 'RPC：像呼叫 function 一樣溝通', async (tok) => {
  fresh([0, 5, 14], [0, 2.4, 0]);
  const cl = pal('client', '', PC[0], -4.4, 0, 0.6, 0.75), sv = pal('server', '', PC[1], 4.4, 0, 0.6, 0.75);
  await step(tok);                                   // 637 Remote Procedure Call
  hd('RPC：Remote Procedure Call', 0, 6.0);
  cap('另一個很重要的：RPC', 'remote procedure call');
  await step(tok);                                   // 643 跟 socket 不同：大家喜歡寫 function call
  bad('socket：一串 bytes', -4.4, 2.4);
  cap('socket 很 flexible 但很 low-level', '可是寫程式時我們喜歡 function call');
  await step(tok);                                   // 669 直接 call 對方的 function 來溝通
  const fn = code(['int add(int a, int b) {', '  return a + b;', '}'], 4.4, 4.6, 0.45);
  cap('如果能直接 call 對方的 function', '來溝通，是最好的');
  await step(tok);                                   // 684 procedure 在 remote：別的 process / 電腦
  idx('在另一個 process，甚至另一台電腦', 4.4, 2.6);
  cap('call 的 procedure 是 remote 的', '在另一個 process，甚至另一台電腦上');
  await step(tok);                                   // 694 一層 API：架在 system call 上
  bx('RPC API', CO.user, 0, 0.3, -1.4, 4.0, 0.5, 0.8); bx('OS system call（message passing）', CO.os, 0, 0.3, -2.4, 6.0, 0.5, 0.8);
  cap('RPC 是一層 API', '建在 OS 的 system call 上，expose 給使用者');
  await step(tok);                                   // 713 server register 可以被 call 的 function
  sv.mood('happy'); bub('register：add() 可以被 call', 4.4, 1.8, 0.6);
  cap('server 定義 function', '向 library register 哪些可以被 call；也要 set up port');
  await step(tok);                                   // 741 client 直接 call server 的 function
  const c = pkt('add(3, 4)', -3.4, 1.4, 0.8);
  await travel(tok, c, V3(-3.4, 1.4, 0.8), V3(3.4, 1.4, 0.8), 1000);
  cap('client 用了 RPC 之後', '就可以直接 call server 上的 function');
  await step(tok);                                   // 746 argument、return 有 data type
  tx(c, 'return 7（int）');
  await travel(tok, c, V3(3.4, 1.4, 0.8), V3(-3.4, 1.4, 0.8), 1000); cl.mood('happy');
  good('參數、回傳值有 type（int、float…）', -3.4, 2.6, 0.8);
  cap('重點：input、output 的 argument 有 data type', '不只是一堆 bytes（3、4 是示意）');
  await step(tok);                                   // 766 programmer 不用管在哪台電腦
  cap('programmer 不用管它在哪台電腦、哪個 process', '就像 call 一個 function 一樣溝通');
  void fn;
}]);

FRAG.push(['proc-8d-shm', 'Shared memory：create、attach、synchronization', async (tok) => {
  fresh([0, 5, 14], [0, 2.2, 0]);
  const A = pal('P1', '', PC[0], -4.6, 0, 0.6, 0.65), B = pal('P2', '', PC[1], 4.6, 0, 0.6, 0.65);
  const zA = zone('P1 的 memory', -3.0, 0.02, -1.4, 3.6, 1.6, '#e3f3ea'), zB = zone('P2 的 memory', 3.0, 0.02, -1.4, 3.6, 1.6, '#d6e6f6');
  await step(tok);                                   // 788 shared memory：thread programming；沒有 API，直接存取
  cap('shared memory 主要用 thread programming', '沒什麼 API：就是 direct memory access');
  await step(tok);                                   // 810 唯一條件：要有一塊共用的 region
  const reg = bx('shared region', CO.gold, 0, 0.3, -1.4, 2.0, 0.5, 1.2); reg.visible = false;
  cap('唯一的條件', '要 create 一塊 process 和 OS 都知道可以共用的 region');
  await step(tok);                                   // 825 by default 不會發生：protection
  bad('protection：不同 process 不會有共用的 region', 0, 2.8);
  cap('by default 不會發生', '因為 OS 的 protection 機制');
  await step(tok);                                   // 848 process 自己 call system call create region
  const os = pal('OS', '', CO.os, 0, 0, 2.4, 0.6);
  bub('shmget()：create region', 0, 1.5, 2.4);
  reg.visible = true;
  cap('要溝通的 process 自己 call system call', '請 OS 幫忙 create 這塊 region');
  await step(tok);                                   // 863 再 call attach
  arr(-3.8, 0.8, -1.1, 0.4, CO.gold, -1.0); arr(3.8, 0.8, 1.1, 0.4, CO.gold, -1.0);
  bub('attach！', -4.6, 1.6, 0.6); bub('attach！', 4.6, 1.6, 0.6);
  cap('用這塊 region 的 process 還要 call attach', '告訴 OS：我要用這塊空間');
  await step(tok);                                   // 881 之後 OS 什麼都不管；自己說好怎麼用
  os.mood('calm'); idx('OS：裡面放什麼我不管', 0, 1.0, 2.4);
  note('放什麼 data structure，兩邊自己說好', 0, 3.6);
  cap('create 完之後 OS 什麼事也不幫你', '就是一堆 bytes，怎麼用兩邊自己決定');
  await step(tok);                                   // 922 synchronization：兩個同時 write
  cap('還有非常重要的 synchronization', '兩個以上 process 同時 write，結果不知道是什麼');
  await step(tok);                                   // 940 counter：一個 ++、一個 --
  const cn = bx('counter = 5', CO.gold, 0, 0.75, -1.4, 2.0, 0.4, 1.0);
  bub('counter++', -4.6, 2.2, 0.6); bub('counter--', 4.6, 2.2, 0.6);
  cap('例：counter 放在共用空間', 'producer 放東西做 ++，consumer 拿東西做 --');
  await step(tok);                                   // 962 5 + 1 − 1 不一定回到 5
  P.relabel(cn, 'counter = ？'); A.mood('wow'); B.mood('wow');
  bad('兩個同時執行：不一定回到 5', 0, 3.0);
  cap('5 加 1 再減 1，應該回到 5', '但兩個同時執行，答案可能不是 5');
  await step(tok);                                   // 991 ++ 會變好幾行 assembly，交錯就出問題
  code(['load  r1, counter', 'add   r1, 1', 'store counter, r1'], 0, 5.6, 0.42);
  cap('因為 counter++ 會變成好幾行 assembly', '交錯在一起又共用 memory 就出錯：使用者要處理');
  void zA; void zB;
}]);

FRAG.push(['proc-8d-buffer', 'Producer–consumer：shared memory 的 bounded buffer', async (tok) => {
  fresh([0, 5.5, 13.5], [0, 1.6, 0]);
  const N = 5, X = (k) => -2.0 + k * 1.0;
  const pr = pal('producer', '', CO.user, -5.4, 0, 0, 0.7), co = pal('consumer', '', CO.cpu, 5.4, 0, 0, 0.7);
  let inI = 0, outI = 0; const items = Array(N).fill(null);
  let inL, outL;
  const place = () => { if (inL) { inL.position.x = X(inI); outL.position.x = X(outI); } };
  const prod = async (v) => { const m = cube(String(v), PC[v % 8], [0.6, 0.5, 0.6], -5.4, 1.4, 0); await slide(tok, m, X(inI), 0.35, 0, 450); items[inI] = m; inI = (inI + 1) % N; place(); };
  const cons = async () => { const m = items[outI]; items[outI] = null; outI = (outI + 1) % N; place(); await slide(tok, m, 5.4, 1.4, 0, 450); kill(m); };
  await step(tok);                                   // 1012 標準例子：producer、consumer
  hd('producer–consumer', 0, 4.6);
  cap('shared memory programming 的標準例子', 'producer 產生資料，consumer 把它拿掉');
  await step(tok);                                   // 1033 兩支程式共用一塊 buffer
  for (let k = 0; k < N; k++) { ctx.tile(V3(X(k), 0.04, 0), 0.9, 0.9, '#f3e6c8'); idx('[' + k + ']', X(k), 0, 0.8); }
  hd('shared buffer（BUFFER_SIZE = 5，示意）', 0, 3.8);
  cap('兩支不同的程式', '共用這塊 memory buffer（create 的方法跳過）');
  await step(tok);                                   // 1051 producer 一直放
  await prod(1); await prod(2);
  cap('producer 不斷把 content 放進去', '顏色深的就是有東西的');
  await step(tok);                                   // 1062 consumer 拿出來
  await cons();
  cap('consumer 把資料讀出來', '一個一個拿掉');
  await step(tok);                                   // 1073 size 有限
  note('難在 buffer 的 size 有限', 0, 2.6);
  cap('難就難在 buffer 的 size 有限制', '');
  await step(tok);                                   // 1103 in 給 producer、out 給 consumer
  inL = hot('in', X(inI), 0, -0.9); outL = hot('out', X(outI), 0, -1.5);
  cap('in：producer 知道要寫到哪', 'out：consumer 知道從哪讀');
  await step(tok);                                   // 1125 要知道 empty：consumer 要等
  co.mood('sad'); bub('空的就不能拿，要等', 5.4, 1.6);
  cap('要知道什麼時候 buffer 是 empty', '空的話 consumer 不能拿，要等 producer');
  await step(tok);                                   // 1145 要知道 full：producer 不能覆蓋
  pr.mood('sad'); bub('滿了再寫會覆蓋資料！', -5.4, 1.6);
  cap('也要知道什麼時候是 full', '滿了還寫，會 override 原來的資料');
  await step(tok);                                   // 1188 empty：in == out
  await cons();
  good('empty：in == out', 0, -1.9, 1.2);
  cap('全部拿光時 in 和 out 在同一格', 'empty 的判斷：in == out');
  await step(tok);                                   // 1206 full：(in + 1) % size == out，繞回來
  co.mood('calm'); pr.mood('happy');
  for (const v of [3, 4, 5, 6]) await prod(v);
  good('full：(in + 1) % BUFFER_SIZE == out', 0, -2.5, 1.2);
  cap('一直加、繞回來（circular）', 'full 的判斷：(in + 1) % size == out');
  await step(tok);                                   // 1232 這一格永遠空著：不然 in == out 分不出
  glow(P.cube('', '#ffffff', [0.3, 0.3, 0.3], X(inI), 0.9, 0), null);
  bad('這一格永遠空著：全填滿的話 in == out，分不出空或滿', 0, 2.6);
  cap('所以永遠有一格是空的', '真的寫滿，in 又等於 out，分不出 empty 還是 full');
  await step(tok);                                   // 1284 犧牲一格；之後 locking 解決
  note('犧牲一個空間；之後學 locking 就能解決', 0, 3.2);
  cap('為了 synchronize 犧牲一個儲存空間', '之後介紹 locking 就能解決');
  await step(tok);                                   // 1335 producer：while (full) ; busy waiting
  const pc = code(['while (true) {', '  while (((in + 1) % BUFFER_SIZE) == out)', '    ;   /* do nothing */', '  buffer[in] = item;', '  in = (in + 1) % BUFFER_SIZE;', '}'], -3.4, 7.4, 0.36);
  pc.hl(1);
  cap('producer：一直寫', '滿了就卡在 while 那行（分號）：busy waiting');
  await step(tok);                                   // 1362 consumer：while (in == out) ;
  const cc = code(['while (true) {', '  while (in == out)', '    ;   /* do nothing */', '  item = buffer[out];', '  out = (out + 1) % BUFFER_SIZE;', '}'], 3.6, 7.4, 0.36);
  cc.hl(1);
  cap('consumer：in == out 就是 empty', '注意分號：卡在這行，直到不空才讀');
  await step(tok);                                   // 1393 shared region 存 buffer、in、out
  good('shared region 裡：buffer、in、out', 0, 4.4);
  cap('shared memory region 裡', '除了 buffer，還要存 in 和 out');
  await step(tok);                                   // 1417 沒有 locking：第七章再看
  pc.hl(-1); cc.hl(-1);
  idx('這裡沒有 locking；同步章節再回來看', 0, 2.0, 1.2);
  cap('這個例子沒有任何 locking', '之後的同步章節會用 lock 重新看，用滿整個 buffer');
}]);

// ════════ dDghjse91lE（第 9A 講）：circular buffer 回顧、message passing、link、direct / indirect、blocking ════════
FRAG.push(['proc-9a-recap', '回顧：circular buffer 與 shared memory 的同步', async (tok) => {
  fresh([0, 5.5, 13.5], [0, 1.8, 0]);
  const N = 5, X = (k) => -2.0 + k * 1.0;
  const items = Array(N).fill(null); let inI = 0, outI = 0, inL = null, outL = null;
  const place = () => { if (inL) { inL.position.x = X(inI); outL.position.x = X(outI); } };
  const put = (v) => { items[inI] = cube(String(v), PC[v % 8], [0.6, 0.5, 0.6], X(inI), 0.35, 0, 1.5); inI = (inI + 1) % N; place(); };
  const take = () => { kill(items[outI]); items[outI] = null; outI = (outI + 1) % N; place(); };
  await step(tok);                                   // 1 上次的 shared memory 例子
  hd('shared memory 的標準例子：buffer', 0, 4.4);
  cap('上次下課前講的 shared memory', '有同學又來問，再提醒一下');
  await step(tok);                                   // 3 共用的是 buffer 這個 array
  for (let k = 0; k < N; k++) { ctx.tile(V3(X(k), 0.04, 0), 0.9, 0.9, '#f3e6c8'); idx('[' + k + ']', X(k), 0, 0.8); }
  idx('示意：BUFFER_SIZE = 5', 0, 3.7);
  cap('共用的 memory content', '就是 buffer 這個 array');
  await step(tok);                                   // 43 producer、consumer 各用一個 pointer
  pal('producer', '', CO.user, -5.4, 0, 0, 0.65); pal('consumer', '', CO.cpu, 5.4, 0, 0, 0.65);
  inL = hot('in', X(0), 0, -0.9); outL = hot('out', X(0), 0, -1.5);
  cap('producer、consumer 各用一個 pointer', '來操作這塊記憶體');
  await step(tok);                                   // 52 空間有限 → reuse：circular buffer
  put(1); put(2); put(3); take(); take();
  cap('空間是有限的', '要不斷輸出、輸入，就得 reuse：circular buffer');
  await step(tok);                                   // 79 mod：折回來
  put(4); put(5); await wt(tok, 300); put(6);
  note('in = (in + 1) % 5：寫到底就折回來', 0, 2.6);
  cap('所以程式裡都有 mod', '寫到最後一格就折回前面');
  await step(tok);                                   // 106 programmer 要負責 synchronization
  bad('滿了還寫 → overwrite 還沒讀的資料', 0, 3.2);
  cap('programmer 必須負責 synchronization', '例：buffer 滿了，producer 不能再寫');
  await step(tok);                                   // 142 要有 condition 判斷滿；in、out 共用
  cap('要有一個 condition 描述「滿」', 'in、out 兩個變數是共用的，大家都看得到');
  await step(tok);                                   // 172 full：(in + 1) % N == out，其實還剩一格
  good('full：(in + 1) % 5 == out', 0, -2.2, 1.2);
  cap('(in + 1) % size == out 就叫滿', '可是看起來還有一格空的？');
  await step(tok);                                   // 196 真的寫滿：in == out，跟空分不出
  const g = cube('?', '#ffffff', [0.6, 0.5, 0.6], X(inI), 1.4, 0); g.material.transparent = true; g.material.opacity = 0.5;
  bad('寫滿的話 in == out，跟 empty 一樣！', 0, 2.0);
  cap('只用 in、out 判斷', '真的寫滿的話 in 又等於 out，分不出滿還空');
  await step(tok);                                   // 230 犧牲一格
  kill(g);
  cap('所以犧牲掉一格', '只剩一格時就先定義為滿');
  await step(tok);                                   // 238 while loop 就是在做同步
  code(['while (((in + 1) % 5) == out) ;', 'while (in == out) ;'], 0, 6.2, 0.45);
  cap('這兩個 while loop', '其實就是在做 synchronization；寫錯整個會亂掉');
  await step(tok);                                   // 275 怎麼用這塊空間由 programmer 決定
  idx('int buffer[5]？float buffer[5]？programmer 自己決定', 0, 5.2);
  cap('把它定義成 integer array', '還是 float，都由 programmer 自己決定');
  await step(tok);                                   // 309 同步章節：locking 用到所有空間
  note('同步章節：用 locking，不必犧牲一格', 0, 4.6);
  cap('之後的 synchronization 章節', '用 locking 讓所有空間都用到');
  await step(tok);                                   // 324 很常見：compiler → linker
  const cp = bx('compiler', CO.user, -4.6, 2.2, -2.0, 2.0, 0.6, 0.9), lk = bx('linker', CO.cpu, 4.6, 2.2, -2.0, 2.0, 0.6, 0.9);
  const o = pkt('.o 檔', -3.4, 2.2, -1.6); await travel(tok, o, V3(-3.4, 2.2, -1.6), V3(3.4, 2.2, -1.6), 1200);
  cap('別看它簡單，系統裡非常多這種問題', '例：compiler 是 producer、linker 是 consumer');
  void cp; void lk;
}]);

FRAG.push(['proc-9a-mp', 'Message passing：send / receive 本身就有同步', async (tok) => {
  fresh([0, 5, 14], [0, 2.2, 0]);
  const P1 = pal('sender', '', PC[0], -4.6, 0, 0.6, 0.75), P2 = pal('receiver', '', PC[1], 4.6, 0, 0.6, 0.75);
  await step(tok);                                   // 396 message passing：memory copy
  hd('message passing', 0, 5.6);
  cap('接下來是 message passing', '用 memory copy 的方式');
  await step(tok);                                   // 409 目的不只溝通
  cap('它的目的跟 shared memory 有點不一樣', '不只包含溝通這件事');
  await step(tok);                                   // 426 send、receive 加一個 message buffer
  code(['send(message);'], -4.6, 2.8, 0.45); code(['receive(message);'], 4.6, 2.8, 0.45);
  cap('最基本：send 和 receive', '裡面是 message 的 memory buffer');
  await step(tok);                                   // 438 blocking call：做完才 return
  bad('blocking：沒做完不 return', -4.6, 3.6);
  cap('熟悉的 function call 通常是 blocking', 'call 下去，除非動作完成，不然不會 return');
  await step(tok);                                   // 449 sender、receiver 都要 call
  P1.mood('happy');
  cap('message passing 的特色', 'sender 和 receiver 兩端都要 call，對在一起才完成');
  await step(tok);                                   // 463 像打電話
  bub('☎ 鈴…', -4.6, 1.8, 0.6); P2.mood('calm');
  cap('blocking 就像打電話', '另一邊要接起來，你們才能開始對話');
  await step(tok);                                   // 477 包含同步
  P2.mood('happy'); bub('喂？', 4.6, 1.8, 0.6);
  const m = pkt('message', -3.6, 1.2, 0.8); await travel(tok, m, V3(-3.6, 1.2, 0.8), V3(3.6, 1.2, 0.8), 900);
  good('接起來 = 同步：兩邊確定此刻一起做事', 0, 3.6);
  cap('所以它還包含同步的概念', '你知道對方現在在跟你講話');
  await step(tok);                                   // 507 shared memory 的溝通本身做不到同步
  note('shared memory：要另外寫 code 才能同步', 0, 4.4);
  cap('用 shared memory 溝通本身做不到 synchronize', '要另外寫程式（像剛剛的 while）');
  await step(tok);                                   // 520 比較慢但比較好寫：自己的 memory 不會被覆蓋
  good('比較好寫：同步內建、自己的 memory 不會被別人覆蓋', 0, -0.2, 2.0);
  cap('message passing 比較慢（要 copy）', '但比較好寫：內建同步，memory 不會被任意覆蓋');
  await step(tok);                                   // 551 scale 大：比較好 debug
  [-1.6, 0, 1.6].forEach((x, i) => pal('', '', PC[i + 3], x, 0, -1.4, 0.4));
  cap('溝通的人比較多時', '大家傾向用 message passing，比較好 debug');
}]);

FRAG.push(['proc-9a-link', 'Message passing 的 link：physical 與 logical', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.4, 0]);
  const A = pal('P', '', PC[0], -5.0, 0, 0.6, 0.65), B = pal('Q', '', PC[1], 5.0, 0, 0.6, 0.65);
  await step(tok);                                   // 575 OS 的 system call 負責 memory copy
  const os = bx('OS：message system（做 memory copy）', CO.os, 0, 0.3, -1.2, 5.0, 0.6, 0.9);
  cap('實現：send、receive 加一個 memory buffer', 'OS 的 system call 負責 memory copy，不需要 shared variable');
  await step(tok);                                   // 612 要先建立一個 link
  const link = ln(-4.2, 0.6, 4.2, 0.6, 0.6, '#c08a1f');
  cap('過程中必須先建立一個 link（管道）', '像 email 透過 internet、網路線');
  await step(tok);                                   // 639 提供 send / receive 透過 link 傳
  const m = pkt('msg', -3.8, 0.9, 0.6); await travel(tok, m, V3(-3.8, 0.9, 0.6), V3(3.8, 0.9, 0.6), 900); remove(m);
  cap('再提供 send、receive 的 function', '透過這個 link 交換資料');
  await step(tok);                                   // 650 link 拆成 physical / logical
  hd('physical', -3.4, 5.6); hd('logical', 3.4, 5.6);
  cap('link 再細看', '要拆成 physical layer 和 logical layer');
  await step(tok);                                   // 660 physical：network、memory bus、shared memory
  ['network（跨電腦）', 'memory bus（同一台）', 'shared memory'].forEach((n, i) => bx(n, '#8a94a6', -3.4, 4.6 - i * 0.7, 0, 3.0, 0.5, 0.8, 2));
  cap('physical：用什麼方式建立通道', '網路、主機板上的 memory bus，甚至 shared memory');
  await step(tok);                                   // 715 logical：programmer care 的 send / receive 定義
  cap('logical：programmer care 的事', 'send、receive 這些 function 的定義和特性');
  await step(tok);                                   // 733 direct / indirect
  const L = [];
  const prop_ = (t, i) => { L.push(bx(t, CO.user, 3.4, 4.6 - i * 0.6, 0, 3.4, 0.45, 0.8, 2)); };
  prop_('direct / indirect', 0);
  cap('link 的特性：課本列了很多', '例如 direct 還是 indirect');
  await step(tok);                                   // 750 有沒有方向性
  prop_('單向 / 雙向', 1);
  arr(-3.0, 1.5, 3.0, 1.5, CO.gold, 0.6);
  cap('connection 有沒有方向性', '單向：我能送給你，你不能送給我');
  await step(tok);                                   // 778 symmetric / asymmetric
  prop_('symmetric / asymmetric', 2);
  cap('symmetric 或 asymmetric', '兩邊角色是不是相對的（比較 minor）');
  await step(tok);                                   // 796 blocking / non-blocking（最重要）
  prop_('blocking / non-blocking ★', 3); glow(L[3], '#3a2a00');
  cap('最重要：blocking 還是 non-blocking', 'non-blocking：call 下去立刻 return，不等對方收到');
  await step(tok);                                   // 834 真的 copy 還是送 reference
  prop_('copy / reference', 4);
  cap('傳輸時真的 copy', '還是先送 reference、之後再 copy');
  await step(tok);                                   // 848 fixed / variable size
  prop_('fixed / variable size', 5);
  note('越 low level 越 fixed size（IP 封包）；HTTP body 可任意大小', 0, 6.4);
  cap('message 固定大小還是可變', '越接近 physical layer，越會限制成 fixed size');
  await step(tok);                                   // 921 programmer 看到的 behavior = logical
  good('programmer 看到的 behavior = logical', 3.4, 0.6, 1.6);
  cap('跟 programming 有關、programmer 看到的', '就叫 logical；有很多種 send / receive');
  void A; void B; void os; void link;
}]);

FRAG.push(['proc-9a-direct', 'Direct communication：指名道姓', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.4, 0]);
  const P1 = pal('P', '', PC[0], -4.6, 0, 0.6, 0.7), Q = pal('Q', '', PC[1], 4.6, 0, 0.6, 0.7);
  await step(tok);                                   // 936 direct vs indirect
  hd('direct communication', 0, 5.8);
  cap('先看 direct 和 indirect', '它們在管理上的差別');
  await step(tok);                                   // 946 直接指定對方：像打電話
  bub('☎ 撥給 Q', -4.6, 1.8, 0.6);
  cap('direct：必須指定溝通的對象是誰', '像打電話：按了號碼就是那個人');
  await step(tok);                                   // 959 send(Q, msg) / receive(P, msg)
  code(['send(Q, message);'], -4.6, 3.0, 0.45); code(['receive(P, message);'], 4.6, 3.0, 0.45);
  cap('send 要指定 receiver', 'receive 要指定 sender（P、Q 能 identify 對方就好）');
  await step(tok);                                   // 995 link 自動建立
  const link = ln(-3.8, 0.6, 3.8, 0.6, 0.6, '#c08a1f');
  good('一 call send 就自動建 link', 0, 1.3, 0.6);
  cap('已經指定是誰跟誰', 'link 通常不用另外 init，一 call 就自動建立');
  await step(tok);                                   // 1044 one-to-one
  const R = pal('R', '', PC[2], 0, 0, -1.6, 0.55); R.mood('sad');
  bad('只能 one-to-one：不能 broadcast', 0, 1.6, -1.6);
  cap('最重要：一定是 one-to-one', '沒辦法 broadcast 或對一整個 group 傳');
  await step(tok);                                   // 1073 link 通常是單向
  arr(-3.6, 1.0, 3.6, 1.0, CO.gold, 0.6);
  cap('誰是 sender、誰是 receiver 很清楚', '所以 link 通常是單向的（沒有規定）');
  await step(tok);                                   // 1097 producer-consumer：兩行就寫完
  gone(R);
  code(['while (true) send(Q, next);'], -4.6, 4.2, 0.45); code(['while (true) receive(P, next);'], 4.6, 4.2, 0.45);
  cap('用 message passing 寫 producer–consumer', '非常單純：send、receive 兩行就好');
  await step(tok);                                   // 1128 blocking → 自然同步、很強
  for (let k = 0; k < 2; k++) { const m = pkt('item', -3.8, 1.2, 0.6); await travel(tok, m, V3(-3.8, 1.2, 0.6), V3(3.8, 1.2, 0.6), 700); remove(m); }
  P1.mood('happy'); Q.mood('happy');
  cap('兩邊都是 blocking', '送一個、收一個才能再送：自然被 synchronize');
  await step(tok);                                   // 1162 太 synchronous：sender 端可能爆掉
  P1.mood('sad'); bad('太同步：很多人要寫時，等太久 buffer 會爆', -4.6, 1.8, 0.6);
  cap('但太 synchronous 也有缺點', '很多人要寫、一直等，source 端可能 out of memory');
  await step(tok);                                   // 1203 缺點：對象不能換，要重建連線
  const C = pal('C', '', PC[3], 4.6, 0, -1.6, 0.55);
  bub('想改跟 C 講話？要重建連線', 0, 3.4, -1.2);
  cap('direct 最大的缺點：對象不能替換', '要跟別人講就得重建連線：overhead，沒有 modularity（ad hoc）');
  void link; void C;
}]);

FRAG.push(['proc-9a-indirect', 'Indirect communication：mailbox', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.4, 0]);
  const P1 = pal('P', '', PC[0], -5.0, 0, 0.6, 0.65), Q = pal('Q', '', PC[1], 5.0, 0, 0.6, 0.65);
  const box = prop('warehouse', 0, 0, -0.6, 0.9, 'mailbox A'); box.visible = false;
  await step(tok);                                   // 1269 indirect = email、mailbox
  hd('indirect communication', 0, 5.8);
  box.visible = true;
  cap('indirect：想像成 email', 'direct 像打電話，indirect 有一個 mailbox');
  await step(tok);                                   // 1293 放進另一個 system 管理的地方
  cap('寄信時信封上雖然寫了人', '但不是直接送到對方手上，而是放進另一個系統');
  await step(tok);                                   // 1325 只放進 mailbox，要的人自己拿
  const m = pkt('msg', -4.2, 1.4, 0.6); await travel(tok, m, V3(-4.2, 1.4, 0.6), V3(0, 1.6, -0.2), 900);
  code(['send(A, message);'], -5.0, 3.0, 0.45);
  cap('不指定 receiver 是誰', '只是把 message 放進 mailbox，要的人自己去拿');
  await step(tok);                                   // 1342 Q 去 A 拿，不知道是誰送的
  await travel(tok, m, V3(0, 1.6, -0.2), V3(4.2, 1.4, 0.6), 900);
  code(['receive(A, message);'], 5.0, 3.0, 0.45);
  bub('這是誰寄的？不知道', 5.0, 1.8, 0.6);
  cap('Q 自己去 mailbox A 拿', '不知道是誰送的；sender 也不用 care receiver');
  await step(tok);                                   // 1372 像一個 port
  remove(m); idx('mailbox 也可以說是一個 port', 0, 2.2, 0.6);
  cap('mailbox 也可以說像一個 port', '透過它溝通，不知道對方是誰');
  await step(tok);                                   // 1389 mailbox 要 programmer 先建立
  note('mailbox 要先建立，大家才能溝通', 0, 4.6);
  cap('這時的 link 就是 mailbox', '必須由 programmer 自己先建立');
  await step(tok);                                   // 1404 many-to-many
  const others = [[-5.0, -1.8], [5.0, -1.8], [-2.6, 2.2], [2.6, 2.2]].map(([x, z], i) => pal('', '', PC[i + 2], x, 0, z, 0.45));
  others.forEach((o) => o.mood('happy'));
  good('many-to-many；也可以像海報一樣大家都讀', 0, 1.0, 2.2);
  cap('最主要特色：many-to-many', '很 general 的溝通方式');
  await step(tok);                                   // 1448 mailbox 由第三方（OS process）管理
  const os = pal('OS', '', CO.os, 0, 0, -2.4, 0.55);
  idx('用 kernel 的 memory 保存 message', 0, 0.3, -3.2);
  cap('保管 message 的是獨立的第三支程式', 'OS 提供的 mailbox：用 kernel memory，使用者需要時 copy 出來');
  await step(tok);                                   // 1503 多人同時 receive：誰拿到？
  gone(...others);
  const P2 = pal('P2', '', PC[4], 3.8, 0, 1.8, 0.5), P3 = pal('P3', '', PC[5], 5.4, 0, 1.8, 0.5);
  const one = pkt('只有 1 個 message', 0, 1.6, -0.2);
  P2.mood('wow'); P3.mood('wow');
  cap('很多人同時 receive 同一個 message', '應該只有一個人拿到：P2 還是 P3？同步問題');
  await step(tok);                                   // 1561 解法 1：一個 link 只能兩個 process
  bad('解法 1：一個 link 只允許兩個 process（等於 direct，很爛）', 0, 4.0);
  cap('解法一：link 最多只能兩個 process', '其實就變成 one-to-one，沒什麼意義');
  await step(tok);                                   // 1603 解法 2：locking，一次只能一個 receive
  const lock = prop('lock', 0, 2.2, -0.6, 0.8);
  cap('解法二：用 locking', '同一時間只允許一個人 call receive');
  await step(tok);                                   // 1649 解法 3：mailbox 偵測、決定、通知
  kill(lock); P2.mood('happy'); P3.mood('sad');
  bub('你可以來拿了（notify）', 3.8, 1.4, 1.8);
  cap('解法三：mailbox 自己偵測同時 receive', '決定給誰、notify 那個人來拿：像加簽');
  await step(tok);                                   // 1722 要分清 direct / indirect、何時用
  good('分清 direct / indirect，知道什麼時候用哪個', 0, 6.6);
  cap('重點：區分 direct 和 indirect', '知道什麼時候用哪一種比較好');
  void P1; void Q; void os; void one;
}]);

FRAG.push(['proc-9a-block', 'Blocking vs Non-blocking（synchronous vs asynchronous）', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.4, 0]);
  const S = pal('sender', '', PC[0], -5.0, 0, 0.6, 0.65), R = pal('receiver', '', PC[1], 5.0, 0, 0.6, 0.65);
  await step(tok);                                   // 1743 很重要的基本觀念
  hd('blocking vs non-blocking', 0, 5.8);
  cap('一定要知道的基本觀念', 'blocking 和 non-blocking 的差別');
  await step(tok);                                   // 1753 blocking = synchronous
  good('blocking = synchronous（同步）', -3.4, 4.8);
  cap('send、receive 都可以 blocking 或 non-blocking', 'blocking 通常對應 synchronous 的溝通');
  await step(tok);                                   // 1764 non-blocking = asynchronous：email
  good('non-blocking = asynchronous（非同步）', 3.4, 4.8);
  const em = pkt('✉ email', -4.0, 1.4, 0.6); await travel(tok, em, V3(-4.0, 1.4, 0.6), V3(0, 1.4, 0.6), 700);
  S.mood('happy'); bub('寄出去我就 move on', -5.0, 1.8, 0.6);
  cap('non-blocking 不知道對方是否立刻收到', '又叫 asynchronous，像 email');
  await step(tok);                                   // 1788 可能被 drop；比較複雜但有效率
  tx(em, '✉（被 drop？）');
  cap('對方可能根本沒收到', '比較複雜，但通常比較有效率：不用等');
  await step(tok);                                   // 1808 send、receive 都有兩種版本，可以混搭
  remove(em);
  ['blocking send', 'non-blocking send'].forEach((n, i) => bx(n, CO.user, -3.4, 3.6 - i * 0.6, 0, 2.8, 0.45, 0.8, 2));
  ['blocking receive', 'non-blocking receive'].forEach((n, i) => bx(n, CO.cpu, 3.4, 3.6 - i * 0.6, 0, 2.8, 0.45, 0.8, 2));
  cap('send、receive 都有兩種 version', '不一定要配對（blocking 配 blocking 比較常見）');
  await step(tok);                                   // 1856 blocking send：對方 copy 進 buffer 才 return
  S.mood('sad');
  const m = pkt('msg', -4.0, 1.2, 0.6); await travel(tok, m, V3(-4.0, 1.2, 0.6), V3(4.0, 1.2, 0.6), 900);
  S.mood('happy'); bub('return', -5.0, 1.8, 0.6);
  cap('blocking send：對方真的 receive', 'copy 進它的 user buffer 後，send 才 return');
  await step(tok);                                   // 1873 non-blocking send：送出就結束
  remove(m);
  cap('non-blocking send：送出去就結束', '像 Gmail 按 send');
  await step(tok);                                   // 1880 blocking receive：拿到才 return
  R.mood('sad'); bub('等到 message 才 return', 5.0, 1.8, 0.6);
  cap('blocking receive：一定要拿到 message', '才 return；對方何時 send 無法預測，只好等');
  await step(tok);                                   // 1897 non-blocking receive：可能沒拿到，用 token 事後檢查
  R.mood('wow'); const tk = pkt('token：之後再檢查收到沒', 5.0, 2.6, 0.6);
  cap('non-blocking receive：立刻 return', 'buffer 可能根本沒被填；回傳 token 讓你事後檢查');
  await step(tok);                                   // 1968 實作：blocking → 直接 copy，不用 buffer
  remove(tk);
  const os = bx('message service', CO.os, 0, 0.3, -1.2, 3.6, 0.6, 0.9);
  cap('實作上：blocking 等兩邊都 call', '直接從 sender copy 到 receiver，中間不用 buffer');
  await step(tok);                                   // 1999 non-blocking：中間要 maintain buffer
  const buf = [0, 1, 2].map((k) => bx('msg', CO.gold, -0.8 + k * 0.8, 0.85, -1.2, 0.7, 0.4, 0.6, 2));
  cap('non-blocking：sender 可能送了好幾個', '中間的 service 要 maintain 一個 buffer 給兩人');
  await step(tok);                                   // 2064 blocking 通常也有 buffer，size 1
  idx('blocking：buffer size 1（或 0）', 0, 1.6, -1.2);
  cap('blocking 通常也有 buffer', '但 size 就是 1，空的就把 receiver 擋住');
  await step(tok);                                   // 2090 0 / 1 / bounded / unbounded
  note('buffer：0 / 1 → blocking；bounded：滿了就擋或回 error；unbounded：一直 allocate 到 out of memory', 0, 6.6);
  cap('buffer 大小決定行為', 'bounded 滿了變 blocking 或回 error；unbounded 一直長');
  void os; void buf;
}]);

// ════════ iFRv7y8i7Sw（第 9B 講）：socket programming 流程、RPC 的 stub 與 marshalling ════════
FRAG.push(['proc-9b-socket', 'Socket programming 的流程', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.6, 0]);
  const sv = pal('server', '', PC[1], 4.8, 0, -0.4, 0.75), cl = pal('client', '', PC[0], -4.8, 0, -0.4, 0.75);
  const sl = (t, i, x) => bx(t, x > 0 ? CO.cpu : CO.user, x, 6.0 - i * 0.62, 0, 2.2, 0.48, 0.7, 2);
  await step(tok);                                   // 1 另一種 message passing：socket（IP + port）
  hd('socket：IP + port', 0, 6.6);
  cap('另一種 message passing：socket', '用 IP 和 port 指定哪台機器上的哪支程式');
  await step(tok);                                   // 43 流程：server 先開 socket
  sl('socket()', 0, 4.8);
  cap('socket programming 的流程', 'server 端先開一個 socket');
  await step(tok);                                   // 62 bind 到 port
  sl('bind(port)', 1, 4.8); const port = prop('lock', 6.4, 0, 1.0, 0.6); idx('port', 6.4, 1.0, 1.0);
  cap('socket 只是 logical 的 channel', '要 bind 到一個 port，OS 才知道誰用這個 port');
  await step(tok);                                   // 79 server 先 listen
  sl('listen()', 2, 4.8); sv.mood('calm'); bub('等有沒有人進來…', 4.8, 1.8, -0.4);
  cap('server 要先 listen', '像 web server 要先上線，使用者才能連');
  await step(tok);                                   // 93 client 開 socket、call connect
  sl('socket()', 0, -4.8); sl('connect()', 1, -4.8);
  cap('client 端同樣開一個 socket', '然後 call connect 連過去');
  await step(tok);                                   // 100 server block 到有人來 → accept，link 建立
  sl('accept()', 3, 4.8); sv.mood('happy');
  const link = ln(-3.8, 0.7, 3.8, 0.7, -0.4, '#c08a1f');
  cap('server 一直 block 等到有人連過來', '就 accept：兩邊的 link 真的建起來');
  await step(tok);                                   // 115 read / write
  sl('read / write', 4, 4.8); sl('read / write', 2, -4.8);
  const m = pkt('data', -3.6, 1.1, -0.4); await travel(tok, m, V3(-3.6, 1.1, -0.4), V3(3.6, 1.1, -0.4), 700); await travel(tok, m, V3(3.6, 1.1, -0.4), V3(-3.6, 1.1, -0.4), 700); remove(m);
  cap('建起來之後', '就可以透過這個 channel read / write');
  await step(tok);                                   // 122 close
  sl('close()', 5, 4.8); sl('close()', 3, -4.8);
  note('server close：連 port 都關掉，沒人能再連進來', 0, 3.0, -0.4);
  cap('最後雙方都可以 close', 'client 只關 socket；server 關掉的話整個 port 都關了');
  await step(tok);                                   // 141 single thread 只能服務一個人
  kill(link);
  const us = [-5.8, -4.6, -3.4].map((x, i) => pal('', '', PC[i + 3], x, 0, 1.8, 0.4)); us.forEach((u) => u.mood('sad'));
  bad('single thread：一次只能 handle 一個使用者', 0, 3.6, -0.4);
  cap('web server 希望很多人連進來', '如果是 single thread，只能 handle 一個使用者');
  await step(tok);                                   // 174 accept 之後 create 一個 thread（共享資訊）
  const th = pal('thread', '', PC[5], 3.0, 0, 1.6, 0.45); th.mood('happy');
  ln(-3.4, 0.6, 3.0, 0.6, 1.6, '#c08a1f'); us[2].mood('happy');
  cap('實際上 accept 之後', 'main thread 動態 create 一個 thread 去服務它（要 share 資訊，用 thread）');
  await step(tok);                                   // 207 main thread 不被擋，繼續 listen
  const th2 = pal('thread', '', PC[6], 4.4, 0, 2.6, 0.45); th2.mood('happy'); us[1].mood('happy');
  bub('我繼續 listen 下一個', 4.8, 1.8, -0.4);
  cap('main thread 不會被擋住', '交給新 thread 後又回去 listen，等下一個人');
  await step(tok);                                   // 230 這就是 socket programming
  good('web server = multi-thread programming', 0, 3.6, -0.4);
  cap('所以 web server 都是 multi-thread', '網路很基本，建議要會 socket programming');
  await step(tok);                                   // 252 unstructured string of bytes；parsing 自己來
  bub('HTTP body：一串 bytes，自己 parse', 0, 4.4, -0.4);
  cap('溝通的特色：unstructured string of bytes', 'parsing 由 programmer 負責，socket 只建 channel');
  void port;
}]);

FRAG.push(['proc-9b-rpc', 'RPC：stub、skeleton 與 parameter marshalling', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.4, 0]);
  const cl = pal('client', '', PC[0], -5.4, 0, 0.6, 0.65), sv = pal('server', '', PC[1], 5.4, 0, 0.6, 0.65);
  await step(tok);                                   // 274 RPC：socket 只有 bytes，不好用
  hd('RPC', 0, 6.2);
  bad('socket：只有 bytes，沒有 data structure', 0, 5.4);
  cap('最後介紹 RPC', 'socket 只有 bytes、沒有 data structure，不好用');
  await step(tok);                                   // 286 remote 的 function call
  code(['result = add(3, 4);   // 示意'], -4.6, 4.4, 0.45);
  cap('RPC：call 起來還是 function call', '但其實在 remote 端，貼近一般的寫法');
  await step(tok);                                   // 304 library 有 stub（小 daemon）
  const stub = bx('stub', CO.gold, -2.4, 0.6, 0.6, 1.6, 0.8, 0.9, 2);
  cap('為什麼做得到？提供 RPC 的 library', '有 stub：run 在兩端幫忙傳參數的小程式');
  await step(tok);                                   // 325 client 的 stub、server 的 skeleton
  const sk = bx('skeleton', CO.gold, 2.4, 0.6, 0.6, 1.8, 0.8, 0.9, 2);
  cap('client 端叫 stub，remote 端叫 skeleton', '使用者不需要自己 implement');
  await step(tok);                                   // 345 有 data type：package / unpackage 參數
  const pa = pkt('3, 4（int）', -4.4, 1.6, 0.6); await travel(tok, pa, V3(-4.4, 1.6, 0.6), V3(-2.4, 1.6, 0.6), 600);
  tx(pa, '📦 package');
  cap('跟 socket 的差別：有 data type', '兩個小程式負責把 parameter package / unpackage');
  await step(tok);                                   // 357 下面通常也是透過 socket
  const sk2 = bx('socket', CO.cpu, 0, 0.3, -0.8, 6.0, 0.4, 0.6);
  await travel(tok, pa, V3(-2.4, 1.6, 0.6), V3(2.4, 1.6, 0.6), 900); tx(pa, '3, 4（int）');
  cap('兩者之間的溝通，下面通常也是 socket', '只是一層包一層，讓 programmer 更方便');
  await step(tok);                                   // 389 packing 叫 parameter marshalling
  hot('parameter marshalling', -2.4, 2.4, 0.6);
  cap('client 端最重要的：pack parameters', '這叫 parameter marshalling');
  await step(tok);                                   // 414 跨電腦：big / little endian 不同
  remove(pa);
  const be = code(['big endian:    12 34 56 78', 'little endian: 78 56 34 12'], 0, 4.4, 0.42);
  cap('RPC 的特色是可以跨電腦', '電腦設定可能不同：big endian 和 little endian');
  await step(tok);                                   // 447 int 有的 16 bit、有的 32 bit
  note('int：有的電腦 16 bit、有的 32 bit', 0, 3.4);
  cap('或 int 的大小', '有些電腦 16 bit、有些 32 bit，單純 copy bytes 會出錯');
  await step(tok);                                   // 473 marshalling 負責處理這些
  glow(stub, '#3a2a00'); glow(sk, '#3a2a00');
  good('marshalling：轉成雙方都懂的格式', 0, 2.6, 0.6);
  cap('marshalling 要處理這些繁瑣的事', '由它負責，不讓使用者自己處理');
  await step(tok);                                   // 498 其他就像 blocking call
  sv.mood('happy'); cl.mood('happy');
  const r = pkt('return 7', 4.4, 1.6, 0.6); await travel(tok, r, V3(4.4, 1.6, 0.6), V3(-4.4, 1.6, 0.6), 900);
  cap('後面就單純了', 'caller 像 blocking call 一樣等結果傳回來');
  await step(tok);                                   // 526 傳 pointer：指的是 local memory，到別台沒意義
  remove(r);
  const ptr = pkt('pointer → 0x7ffc…', -4.4, 2.6, 0.6); await travel(tok, ptr, V3(-4.4, 2.6, 0.6), V3(4.4, 2.6, 0.6), 900);
  tx(ptr, '0x7ffc… 在這台沒有意義 ✗'); setCls(ptr, 'bad');
  cap('要傳 data structure、尤其 pointer 很累', 'pointer 指的是 local memory，傳到別台沒意義');
  await step(tok);                                   // 569 小的、well-defined 會幫你 copy；pointer 不支援
  good('完整、大小確定的 data structure：幫你 copy', -2.4, 4.4, 0.6);
  cap('大小確定的 data structure 會幫你 copy', '但 pointer 不知道要 copy 多少，大多不 support');
  void be; void sk2;
}]);

// ════════ IFEFVXvjiHY（Neso Academy：fork() and exec()）：定義、Linux 實機示範 ════════
// a little terminal: monospace lines appended at (x, yTop)
function term(x, yTop, w = 26) {
  const head = tag('$ terminal'.padEnd(w, ' '), 'idx', x, yTop + 0.5); Object.assign(head.element.style, P.MONO);
  const ls = [];
  return { add(t, cls = '') { const l = tag(t.padEnd(w, ' '), cls, x, yTop - ls.length * 0.42); Object.assign(l.element.style, P.MONO); ls.push(l); return l; }, ls };
}
FRAG.push(['proc-neso-def', 'fork() 與 exec() 的定義', async (tok) => {
  fresh([0, 5, 14], [0, 2.4, 0]);
  await step(tok);                                   // 77 fork 和 exec 是什麼
  hd('fork()', -3.4, 5.8); hd('exec()', 3.4, 5.8);
  cap('fork 和 exec 這兩個 system call', '各做什麼？');
  await step(tok);                                   // 84 fork：create 一個 duplicate process
  const p = pal('process', 'PID 100', PC[0], -5.0, 0, 0.6, 0.7);
  cap('fork：create 一個獨立的 duplicate process', '');
  await step(tok);                                   // 97 跟原本 process 一模一樣的 replica
  const c = pal('process', 'PID 100', PC[0], -5.0, 0, 0.6, 0.7);
  await slide(tok, c.g, -1.8, 0, 0.6, 900);
  cap('想要一個正在跑的 process 的 exact replica', '就用 fork');
  await step(tok);                                   // 115 唯一不同：PID 不同
  c.set('PID 101'); c.mood('wow');
  idx('（PID 數字是示意）', -3.4, -0.2, 1.6);
  cap('唯一的差別', '新的 process 有不同的 process ID');
  await step(tok);                                   // 121 parent / child
  P.txt(p.name, 'parent'); P.txt(c.name, 'child');
  cap('call fork 的叫 parent process', '複製出來的叫 child process');
  await step(tok);                                   // 138 exec：參數裡的 program 取代整個 process（含所有 thread）
  const e = pal('process', 'PID 200', PC[2], 3.4, 0, 0.6, 0.75);
  const prg = prop('file', 6.2, 0, 0.6, 0.8, 'program');
  cap('exec：參數指定的 program', '會取代整個 process，包括所有 thread');
  await step(tok);                                   // 158 要傳另一個 program 當參數
  await slide(tok, prg, 3.8, 0.9, 1.2, 900);
  cap('不像 fork', 'exec 要傳入一個參數：另一個 program');
  await step(tok);                                   // 181 用另一個 process 取代；同一個 PID
  kill(prg); e.body.material.color.set(PC[5]); e.mood('happy');
  cap('簡單說：把一個 process 換成另一個', '沒有建立新的 process');
  await step(tok);                                   // 199 PID 不變，內容不同
  good('PID 不變（200），內容換了', 3.4, 2.2, 0.6);
  cap('所以 process ID 維持不變', '但內容不一樣了');
}]);

FRAG.push(['proc-neso-fork1', '實機示範：加一個 fork()，印兩次', async (tok) => {
  fresh([0, 5, 14], [0, 2.6, 0]);
  await step(tok);                                   // 214 在 Linux 上寫 C 程式來看
  prop('monitor', 4.2, 0, -1.0, 1.4, 'Linux Mint');
  cap('用 C 寫程式、在 Linux 上跑', '看 fork、exec 實際怎麼運作');
  await step(tok);                                   // 255 fex1.c：印 Hello + PID
  const cd = code(['#include <stdio.h>', '#include <unistd.h>', 'int main() {', '  printf("Hello Neso Academy! PID = %d\\n", getpid());', '  return 0;', '}'], -3.2, 5.8, 0.45);
  cd.hl(3);
  cap('fex1.c：印出 Hello Neso Academy', '再用 getpid() 印出 process ID');
  await step(tok);                                   // 317 gcc fex1.c → a.out
  const T = term(3.4, 3.0);
  T.add('$ gcc fex1.c'); prop('file', 6.0, 0, 1.4, 0.6, 'a.out');
  cap('gcc 是 Linux 的 C compiler', 'gcc fex1.c 會產生執行檔 a.out');
  await step(tok);                                   // 371 ./a.out → PID 5824
  T.add('$ ./a.out'); T.add('Hello Neso Academy! PID = 5824', 'good');
  cap('執行 ./a.out', '印出一行，PID = 5824');
  await step(tok);                                   // 394 加上 fork()
  const cd2 = code(['  fork();'], -3.2, 4.45, 0.45); cd2.hl(0);
  cd.ls.slice(3).forEach((l) => { l.position.y -= 0.45; });
  cap('回到程式加一個 fork()', '存檔');
  await step(tok);                                   // 434 重新編譯執行：印兩次
  T.add('$ ./a.out'); T.add('Hello Neso Academy! PID = 5837', 'good'); T.add('Hello Neso Academy! PID = 5838', 'good');
  cap('重新 compile、執行', '印了兩次：PID 5837 和 5838');
  await step(tok);                                   // 454 因為 fork：parent 一次、child 一次
  const a = pal('parent', '5837', PC[0], -5.0, 0, 1.4, 0.55), b = pal('child', '5838', PC[1], -5.0, 0, 1.4, 0.55);
  await slide(tok, b.g, -3.4, 0, 1.4, 700); a.mood('happy'); b.mood('happy');
  cap('因為 fork 建立了自己的 child process', '程式被執行兩次：parent 一次、child 一次');
  await step(tok);                                   // 488 PID 不同、內容相同
  good('PID 不同，內容一模一樣', -4.2, 2.4, 1.4);
  cap('process ID 不一樣', '但內容完全相同，所以印出同樣的字');
}]);

FRAG.push(['proc-neso-fork3', '三個 fork()：印 8 次', async (tok) => {
  fresh([0, 4, 14.5], [0, 3.0, 0]);
  const cd = code(['int main() {', '  fork();', '  fork();', '  fork();', '  printf("Hello… PID = %d\\n", getpid());', '}'], -4.8, 6.4, 0.45);
  const pos = { 1: [1.0, 5.8], 2: [4.4, 4.2], 3: [-1.6, 4.2], 4: [5.6, 2.6], 5: [-2.6, 2.6], 6: [3.2, 2.6], 7: [5.6, 1.0], 8: [-1.0, 2.6] };
  const par = { 2: 1, 3: 1, 4: 2, 5: 1, 6: 2, 7: 4, 8: 3 };
  const N = {};
  const node = (k) => { const [x, y] = pos[k]; if (par[k]) ln(pos[par[k]][0], pos[par[k]][1] - 0.25, x, y + 0.25, 0, '#8a7a5c'); N[k] = bx('P' + k, PC[k % 8], x, y, 0, 0.9, 0.5, 0.7, 2); };
  const cnt = hot('', -4.8, 2.6);
  await step(tok);                                   // 508 再加兩個 fork：共三個
  cd.hl(3);
  cap('再加兩個 fork', '總共三個 fork system call');
  await step(tok);                                   // 539 先暫停想想：印幾次？
  note('先暫停想一想：會印幾次？', -4.8, 3.4);
  cap('先暫停影片想一想', '有三個 fork，print 會執行幾次？');
  await step(tok);                                   // 560 印了 8 次，PID 都不同
  tx(cnt, '印了 8 次，PID 都不同');
  cap('執行結果：印了 8 次', '每一次的 process ID 都不一樣');
  await step(tok);                                   // 591 P1：第一個 parent
  node(1); cd.hl(0);
  cap('一開始只有第一個 parent：P1', '它只會印一次自己的 PID');
  await step(tok);                                   // 613 第一個 fork：P1 生 P2
  cd.hl(1); node(2);
  cap('第一個 fork：P1 create 自己的 child P2', '現在有 2 個 process');
  await step(tok);                                   // 627 第二個 fork：兩個各生一個
  cd.hl(2); node(3); await wt(tok, 300); node(4);
  cap('第二個 fork：兩個 process 各生一個 child', 'P1 生 P3、P2 生 P4 → 4 個');
  await step(tok);                                   // 653 第三個 fork：四個各生一個
  cd.hl(3); for (const k of [5, 6, 7, 8]) { node(k); await wt(tok, 250); }
  cap('最後一個 fork：4 個 process 各生一個', 'P1→P5、P2→P6、P4→P7、P3→P8');
  await step(tok);                                   // 694 8 個 process → 印 8 次
  cd.hl(4); Object.values(N).forEach((m) => glow(m, '#3a2a00'));
  good('2³ = 8 個 process：內容相同、PID 不同', 1.0, 0.2, 1.2);
  cap('總共建立 8 個 process', '所以 Hello 印了 8 次：內容相同、PID 不同');
}]);

FRAG.push(['proc-neso-exec', '實機示範：execv() 換掉內容，PID 不變', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.6, 0]);
  await step(tok);                                   // 725 exec 資料夾：ex1.c、ex2.c
  prop('file', -4.4, 5.0, 0, 0.6, 'ex1.c'); prop('file', 3.0, 5.0, 0, 0.6, 'ex2.c');
  cap('接著看 exec', '資料夾裡有兩個程式：ex1.c 和 ex2.c');
  await step(tok);                                   // 755 ex1.c：印自己的 PID
  const A = code(['int main(int argc, char *argv[]) {', '  printf("PID of ex1.c = %d\\n", getpid());', '  char *args[] = {"Hello", "Neso", "Academy", NULL};', '  execv("./ex2", args);', '  printf("Back to ex1.c");', '  return 0;', '}'], -3.4, 4.2, 0.45);
  A.hl(1);
  cap('ex1.c：先印出自己的 PID', '用 getpid()');
  await step(tok);                                   // 782 宣告字元陣列 Hello Neso Academy NULL
  A.hl(2);
  cap('宣告一個 character array', '放 Hello、Neso、Academy，最後是 NULL');
  await step(tok);                                   // 791 execv：exec 家族之一，參數是 ex2
  A.hl(3);
  cap('然後呼叫 execv（exec 家族的一種）', '把 ex2 程式的執行檔當參數傳進去');
  await step(tok);                                   // 833 之後還有 printf Back to ex1.c
  A.hl(4);
  cap('後面還有一行 printf', '「Back to ex1.c」，然後 return 0');
  await step(tok);                                   // 841 ex2.c：印 We are in ex2.c 和 PID
  const B = code(['int main(int argc, char *argv[]) {', '  printf("We are in ex2.c\\n");', '  printf("PID of ex2.c = %d\\n", getpid());', '}'], 3.6, 4.2, 0.45);
  B.hl(1);
  cap('ex2.c：印「We are in ex2.c」', '再印出它的 PID');
  await step(tok);                                   // 878 用 -o 指定輸出檔名，避免都叫 a.out
  const T = term(0, 1.4, 30);
  T.add('$ gcc ex1.c -o ex1'); T.add('$ gcc ex2.c -o ex2');
  cap('兩個都 compile', '用 -o 指定檔名，不然都叫 a.out 會互相覆蓋');
  await step(tok);                                   // 1008 只執行 ./ex1
  T.add('$ ./ex1');
  const p = pal('ex1', '', PC[0], -5.8, 0, 1.6, 0.55);
  cap('只執行第一個：./ex1', '');
  await step(tok);                                   // 1026 印出 PID of ex1.c = 5962
  A.hl(1); T.add('PID of ex1.c = 5962', 'good'); p.set('5962');
  cap('先印出 ex1.c 的 PID', '5962');
  await step(tok);                                   // 1049 印出 We are in ex2.c
  A.hl(3); B.hl(1); T.add('We are in ex2.c', 'good');
  p.body.material.color.set(PC[5]); P.txt(p.name, 'ex2');
  cap('接著竟然印出「We are in ex2.c」', '因為 execv 把它換成 ex2 了');
  await step(tok);                                   // 1077 PID of ex2 = 5962：一樣
  B.hl(2); T.add('PID of ex2.c = 5962', 'good'); p.mood('wow');
  cap('ex2 的 PID 是多少？', '一樣是 5962');
  await step(tok);                                   // 1081 不是跳過去，是內容被取代
  good('不是「跳過去」：同一個 process 的內容被換掉', 0, 6.4);
  cap('其實不是跳過去', '是第一個 process 的內容被第二個取代；PID 不變');
  await step(tok);                                   // 1139 Back to ex1.c 沒有印出來
  A.hl(4); bad('「Back to ex1.c」沒有印！', -3.4, 0.6, 1.2);
  cap('ex1.c 還有一行 Back to ex1.c 沒印', '因為內容被換掉了，控制權永遠回不來');
  await step(tok);                                   // 1183 總結
  note('fork：新 process、PID 不同、內容相同　exec：同一個 process、PID 相同、內容換掉', 0, 7.1);
  cap('fork：建立 duplicate 的 child，PID 不同', 'exec：取代整個 process，PID 不變');
}]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
    ].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); modeGen++; },
  };
}
