// 作業系統 第1章：OS 概論（演進 batch → multiprogramming → time sharing、中斷與 trap、
// 儲存階層、dual mode、System Call、OS 結構、Nachos）。
// 場景依清大周志遠《作業系統》第 1A、2A、2D、4A、4B、5A、5B 講的段落與例子；課本＝恐龍書（Silberschatz）。
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
  const COL = { cpu: '#4b9ee2', io: '#dd8238', os: '#9b7ef4', user: '#2fc092', mem: '#c9b48e', idle: '#d8cfc0', bad: '#d64545', gold: '#c08a1f', disk: '#5c7a4a', teal: '#31aab0', pink: '#e55a9b' };
  const JOBC = ['#4b9ee2', '#e55a9b', '#2fc092', '#c08a1f', '#9b7ef4'];
  const MONO = { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '11px', fontWeight: '600' };
  // scenes pass a token (beat aborts on scene change); modes pass undefined (abort on mode change)
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
  // stacked memory column (bottom → top): parts = [[name, color, height]]
  function memCol(x, parts, w = 2, z = 0) {
    let y = 0; return parts.map(([n, c, h]) => { const m = cube(n, c, [w, h * 0.96, 1.2], x, y + h / 2, z); y += h; return m; });
  }
  // timeline: rows = [[name, y]], time unit → world units
  function timeline(x0, rows, unit, ticks) {
    rows.forEach(([n, y]) => { tag(n, 'ptr', x0 - 0.8, y); line(x0, y - 0.3, -0.35, x0 + (ticks || 10) * unit, y - 0.3, -0.35); });
    if (ticks) for (let k = 0; k <= ticks; k += Math.max(1, Math.round(ticks / 6))) tag(String(k), 'idx', x0 + k * unit, rows[rows.length - 1][1] - 0.75);
    return {
      async grow(tok, items, ms) { // items: [rowIndex, t0, d, color, text]
        const os = items.map(([r, t0, d, c, tx]) => { const m = lab.box(c, [1, 0.5, 0.6]); m.scale.x = 0.001; m.position.set(x0 + t0 * unit, rows[r][1], 0); lab.world.add(m); return { m, t0, d, tx, r }; });
        await anim(tok, ms, (f) => os.forEach((o) => { o.m.scale.x = Math.max(0.001, o.d * unit * f); o.m.position.x = x0 + o.t0 * unit + o.d * unit * f / 2; }));
        os.forEach((o) => { if (o.tx) tag(o.tx, 'idx', x0 + (o.t0 + o.d / 2) * unit, rows[o.r][1] + 0.48); });
        return os.map((o) => o.m);
      },
    };
  }

  // ───────────────────────── CPU / I/O 排程模擬（batch、multiprogramming、time sharing） ─────────────────────────
  // jobs: [{ name, bursts: [CPU, I/O, CPU, …] }]；假設每個 job 的 I/O 可以同時進行（各用各的裝置）。
  function simulate(jobs, policy, q = 1) {
    const J = jobs.map((j, i) => ({ i, name: j.name, b: [...j.bursts], k: 0, rem: j.bursts[0], state: policy === 'batch' && i > 0 ? 'new' : 'ready', done: -1, first: -1 }));
    const rows = J.map(() => []), cpu = [];
    const ready = J.filter((j) => j.state === 'ready');
    let cur = null, slice = 0, t = 0;
    while (J.some((j) => j.state !== 'done') && t < 200) {
      if (!cur && ready.length) { cur = ready.shift(); cur.state = 'run'; slice = 0; if (cur.first < 0) cur.first = t; }
      J.forEach((j) => { rows[j.i][t] = j === cur ? 'C' : j.state === 'io' ? 'I' : j.state === 'ready' ? 'w' : j.state === 'new' ? '-' : ''; });
      cpu[t] = cur ? cur.i : -1;
      const ioNow = J.filter((j) => j.state === 'io');
      ioNow.forEach((j) => { j.rem--; if (j.rem === 0) { j.k++; if (j.k >= j.b.length) { j.state = 'done'; j.done = t + 1; } else { j.rem = j.b[j.k]; j.state = 'ready'; ready.push(j); } } });
      if (cur) {
        cur.rem--; slice++;
        if (cur.rem === 0) {
          cur.k++;
          if (cur.k >= cur.b.length) { cur.state = 'done'; cur.done = t + 1; if (policy === 'batch') { const nx = J.find((j) => j.state === 'new'); if (nx) { nx.state = 'ready'; ready.push(nx); } } }
          else { cur.rem = cur.b[cur.k]; cur.state = 'io'; }
          cur = null;
        } else if (policy === 'ts' && slice >= q) { cur.state = 'ready'; ready.push(cur); cur = null; }
      }
      // batch: a job that finished its last burst in I/O also hands over
      if (policy === 'batch' && !cur && !ready.length && !J.some((j) => j.state === 'io' || j.state === 'run')) { const nx = J.find((j) => j.state === 'new'); if (nx) { nx.state = 'ready'; ready.push(nx); } }
      t++;
    }
    const busy = cpu.filter((c) => c >= 0).length;
    return { rows, cpu, T: t, busy, util: busy / t, done: J.map((j) => j.done), first: J.map((j) => j.first) };
  }
  // collapse a per-unit row into segments [t0, d, value]
  function runs(arr) {
    const out = []; let s = 0;
    for (let t = 1; t <= arr.length; t++) if (t === arr.length || arr[t] !== arr[s]) { out.push([s, t - s, arr[s]]); s = t; }
    return out;
  }
  async function drawSim(tok, res, jobs, x0, yTop, unit, msPerUnit, onTick) {
    const rowsY = jobs.map((j, i) => [j.name, yTop - i * 0.85]).concat([['CPU', yTop - jobs.length * 0.85 - 0.25]]);
    const tl = timeline(x0, rowsY, unit, res.T);
    const cpuRow = jobs.length;
    for (let t = 0; t < res.T; t++) {
      const items = [];
      jobs.forEach((j, i) => { const v = res.rows[i][t]; if (v === 'C') items.push([i, t, 1, JOBC[i % 5]]); else if (v === 'I') items.push([i, t, 1, COL.io]); else if (v === 'w') items.push([i, t, 1, '#efe6d6']); });
      items.push([cpuRow, t, 1, res.cpu[t] >= 0 ? JOBC[res.cpu[t] % 5] : COL.idle]);
      await tl.grow(tok, items, msPerUnit);
      if (onTick) onTick(t + 1);
    }
    return rowsY;
  }

  // ───────────────────────── 模式 1：演進模擬（batch / multiprogramming / time sharing） ─────────────────────────
  const gen = { policy: 'batch', q: 1, jobs: [{ name: 'Job 1', bursts: [2, 3, 2] }, { name: 'Job 2', bursts: [2, 3, 2] }, { name: 'Job 3', bursts: [2, 3, 2] }] };
  const POLICY = { batch: 'Batch（一次一個 job）', multi: 'Multiprogramming（I/O 時換人）', ts: 'Time sharing（時間片輪流）' };
  function enterGen() {
    fresh([0, 5.5, 14.5], [0, 1.6, 0]);
    controls('<select id="gPol">' + Object.keys(POLICY).map((k) => '<option value="' + k + '">' + POLICY[k] + '</option>').join('') + '</select>'
      + '<label>time slice q = <input id="gQ" type="number" min="1" max="4" value="' + gen.q + '"></label>'
      + '<button class="primary" id="gRun">執行</button><button id="gRand">隨機產生 jobs</button>');
    $('gPol').value = gen.policy;
    $('gPol').onchange = (e) => { gen.policy = e.target.value; clearLog(); enterGen(); };
    $('gQ').onchange = (e) => { gen.q = Math.max(1, Math.min(4, Number(e.target.value) || 1)); if (gen.policy !== 'ts') log('time slice 只對 time sharing 有意義；batch 和 multiprogramming 不會中途切換。', true); };
    on('gRun', () => run(() => runGen()));
    on('gRand', () => {
      gen.jobs = [0, 1, 2].map((i) => { const r = () => 1 + Math.floor(Math.random() * 3); return { name: 'Job ' + (i + 1), bursts: [r(), 1 + Math.floor(Math.random() * 4), r()] }; });
      clearLog(); enterGen(); log('新的 jobs：' + gen.jobs.map((j) => j.name + ' = CPU ' + j.bursts[0] + '、I/O ' + j.bursts[1] + '、CPU ' + j.bursts[2]).join('；'));
    });
    log('每個 job：CPU → I/O → CPU（單位時間）。藍/粉/綠 = 用 CPU，橘 = 做 I/O，米色 = 在 memory 等 CPU。');
    log('假設：各 job 的 I/O 用不同裝置，可以同時進行。');
    genState(null);
  }
  function genState(res) {
    const rows = gen.jobs.map((j) => [j.name, 'CPU ' + j.bursts[0] + ' → I/O ' + j.bursts[1] + ' → CPU ' + j.bursts[2]]);
    if (res) rows.push(['總時間', String(res.T)], ['CPU 忙碌', res.busy + ' / ' + res.T], ['完成時間', res.done.join('、')], ['第一次拿到 CPU', res.first.join('、')]);
    setState(POLICY[gen.policy], rows, res ? 'CPU 使用率 = ' + res.busy + ' / ' + res.T + ' = <span class="' + (res.util > 0.8 ? 'ok' : 'no') + '">' + Math.round(res.util * 100) + '%</span>'
      + (gen.policy === 'batch' ? '<br>I/O 時 CPU 只能 idle' : gen.policy === 'multi' ? '<br>I/O 和 CPU overlap → 使用率上升' : '<br>每 ' + gen.q + ' 單位就換人 → 大家很快都拿到 CPU') : '按「執行」');
  }
  async function runGen(tok) {
    lab.clear();
    const res = simulate(gen.jobs, gen.policy, gen.q);
    const unit = Math.min(0.6, 11 / res.T);
    await drawSim(tok, res, gen.jobs, -5.6, 4, unit, tok === undefined ? 160 : 220);
    genState(res);
    log(POLICY[gen.policy] + '：總時間 ' + res.T + '，CPU 使用率 ' + Math.round(res.util * 100) + '%。');
    return res;
  }

  // ───────────────────────── 模式 2：中斷與 trap ─────────────────────────
  const PROG = ['x = a + b;', 'y = x * 2;', 'write(1, buf, n);', 'z = y / 0;', 'x = x + 1;', 'exit(0);'];
  const VEC = [['#0', 'divide error'], ['#1', 'timer'], ['#2', 'keyboard'], ['#3', 'mouse'], ['#4', 'disk']];
  const SYS = [['case 0', 'exit'], ['case 1', 'write'], ['case 2', 'read'], ['case 3', 'open']];
  const intr = { pc: 0, inH: null, savedPc: null, dead: false, done: false, objs: {} };
  function enterIntr() {
    fresh([0, 6, 14.5], [0, 2.4, 0]);
    Object.assign(intr, { pc: 0, inH: null, savedPc: null, dead: false, done: false });
    tag('user program', 'ptr', -4.6, 6.2);
    intr.code = code(PROG.map((s, i) => i + '  ' + s), -4.6, 5.5, 0.55);
    intr.pcTok = cube('PC', COL.gold, [0.7, 0.4, 0.4], -6.6, 5.5, 0);
    tag('interrupt vector（硬體，固定欄位）', 'ptr', 3.4, 6.2);
    intr.vec = VEC.map(([n, h], i) => cube(n + ' → ' + h + '_handler', '#e9dcc4', [3.6, 0.42, 0.8], 3.4, 5.5 - i * 0.5, 0));
    tag('system call：switch-case（軟體，數量不限）', 'ptr', 3.4, 2.7);
    intr.sys = SYS.map(([n, h], i) => cube(n + ': sys_' + h, '#e9dcc4', [3.6, 0.42, 0.8], 3.4, 2.1 - i * 0.5, 0));
    intr.mode = cube('user mode', COL.user, [2.4, 0.6, 1], -4.6, 0.4, 0);
    intr.saved = tag('', 'ptr alt', -1.2, 0.4);
    controls('<button class="primary" id="iStep">執行下一行</button><button id="iMouse">移動滑鼠（hardware）</button><button id="iDisk">磁碟搬完（hardware）</button><button id="iRet">handler 做完 → return</button><button id="iReset">重來</button>');
    on('iStep', () => run(() => intrStep()));
    on('iMouse', () => run(() => intrHW(3)));
    on('iDisk', () => run(() => intrHW(4)));
    on('iRet', () => run(() => intrRet()));
    on('iReset', () => { clearLog(); enterIntr(); });
    log('一行一行執行；隨時可以按硬體事件打斷它。第 2 行是 system call，第 3 行會除以零。');
    intrState();
  }
  function intrState() {
    setState('中斷與 trap', [['模式', intr.inH ? 'kernel（OS 在處理）' : 'user'], ['PC', intr.dead ? '—' : String(intr.pc)], ['被打斷時存下的 PC', intr.savedPc === null ? '—' : String(intr.savedPc)], ['正在執行', intr.inH || (intr.dead ? '程式已被 OS 結束' : intr.done ? '程式結束' : 'user program')]],
      'hardware 產生 = <b>signal</b>（課堂用語）；software 產生 = <b>trap</b><br>處理完要回到存下的 PC 繼續');
  }
  function setPc(i) { intr.pc = i; intr.code.hl(i); move(intr.pcTok, -6.6, 5.5 - i * 0.55, 0); }
  async function intrStep(tok) {
    if (intr.inH) { log('現在 CPU 在跑 ' + intr.inH + '：user program 被打斷了，要先 return 才能繼續。', true); return; }
    if (intr.dead || intr.done) { log('程式已經結束了，按「重來」。', true); return; }
    const i = intr.pc; intr.code.hl(i);
    if (i === 2) { log('write() 是 system call：一定要透過 trap 進 OS（軟體中斷）。'); await enterHandler(tok, 'sys', 1, i + 1); return; }
    if (i === 3) { log('除以零：CPU 偵測到錯誤 → trap（軟體產生的中斷），OS 的 handler 接手。'); intr.dead = true; await enterHandler(tok, 'vec', 0, null); return; }
    if (i === PROG.length - 1) { intr.done = true; log('exit(0)：程式結束。'); intrState(); return; }
    log('執行第 ' + i + ' 行：一般指令，不需要 OS。');
    setPc(i + 1); intrState();
  }
  async function intrHW(n) {
    if (intr.inH) { log('OS 正在 ' + intr.inH + '：這時中斷被 disable，這個 signal 被忽略（所以有時候動滑鼠電腦沒反應）。', true); return; }
    if (intr.dead || intr.done) { log('沒有程式在跑了：signal 照樣會處理，但這裡先按「重來」比較清楚。', true); return; }
    log((n === 3 ? '滑鼠' : '磁碟 controller') + ' 送出 signal #' + n + '：不管程式跑到哪一行，直接打斷。');
    await enterHandler(undefined, 'vec', n, intr.pc);
  }
  async function enterHandler(tok, kind, idx, retPc) {
    intr.savedPc = retPc;
    txt(intr.saved, retPc === null ? '（錯誤：不會回來了）' : '存下 PC = ' + retPc);
    tint(intr.mode, COL.os); relabel(intr.mode, 'kernel mode');
    const slot = kind === 'vec' ? intr.vec[idx] : intr.sys[idx];
    const y = slot.position.y;
    move(intr.pcTok, 0.9, y, 0);
    await W(tok, 700);
    glow(slot, GOLD);
    intr.inH = kind === 'vec' ? VEC[idx][1] + '_handler' : 'sys_' + SYS[idx][1];
    log(kind === 'vec' ? '查 interrupt vector 第 ' + idx + ' 格：裡面只是一個 function pointer（4 bytes），跳到 ' + intr.inH + '。' : '依 system call number 用 switch-case 找到 sys_' + SYS[idx][1] + '，開始服務。');
    intrState();
  }
  async function intrRet() {
    if (!intr.inH) { log('現在沒有在處理中斷，沒有東西可以 return。', true); return; }
    [...intr.vec, ...intr.sys].forEach((m) => glow(m, null));
    tint(intr.mode, COL.user); relabel(intr.mode, 'user mode');
    intr.inH = null;
    if (intr.savedPc === null) { log('除以零的程式不能繼續：OS 印出錯誤訊息並結束它，系統沒有 crash。', true); move(intr.pcTok, -6.6, 6.4, 0); txt(intr.saved, ''); intrState(); return; }
    log('return：從存下的 PC = ' + intr.savedPc + ' 繼續，原程式完全沒感覺。');
    setPc(intr.savedPc); intr.savedPc = null; txt(intr.saved, ''); intrState();
  }

  // ───────────────────────── 模式 3：Dual mode 與特權指令 ─────────────────────────
  const INSTR = [
    { id: 'add', name: 'add r1, r2', priv: false, note: '一般運算' },
    { id: 'load', name: 'load r1, [x]', priv: false, note: '讀自己的 memory' },
    { id: 'io', name: 'out disk, r1（I/O）', priv: true, note: 'I/O 指令' },
    { id: 'timer', name: 'set timer', priv: true, note: '改 timer' },
    { id: 'cli', name: 'disable interrupts', priv: true, note: '關中斷' },
    { id: 'mode', name: 'set mode bit', priv: true, note: '改 mode bit' },
  ];
  const dm = { bit: 1, n: 0, traps: 0 };
  function enterDual() {
    fresh([0, 5.5, 13.5], [0, 1.8, 0]);
    Object.assign(dm, { bit: 1, n: 0, traps: 0 });
    tile2(-3.4, '#d9efe5', 'user mode（bit = 1）'); tile2(3.4, '#e7defa', 'kernel mode（bit = 0）');
    dm.bitBox = cube('mode bit = 1', COL.user, [2.4, 0.8, 1.2], 0, 4.6, 0);
    controls(INSTR.map((s) => '<button id="d_' + s.id + '">' + s.name + '</button>').join('') + '<button class="primary" id="dSys">system call（trap）</button><button id="dRet">return from trap</button>');
    INSTR.forEach((s) => on('d_' + s.id, () => run(() => dualExec(s))));
    on('dSys', () => run(() => dualSys()));
    on('dRet', () => run(() => dualRet()));
    log('mode bit：1 = user、0 = kernel（恐龍書的慣例）。特權指令只能在 kernel mode 執行。');
    dualState();
  }
  function tile2(x, color, name) { ctx.tile(V3(x, 0.04, 0), 6, 4, color); tag(name, 'ptr', x, 0.1, 2.3); }
  function dualState() {
    setState('Dual mode', [['mode bit', dm.bit + (dm.bit ? '（user）' : '（kernel）')], ['已執行指令', String(dm.n)], ['非法指令 trap', String(dm.traps)]],
      '特權指令：I/O、set timer、關中斷、改 mode bit…<br>user mode 執行 → <span class="no">trap 給 OS</span>，不會真的執行');
  }
  async function dualExec(s) {
    const x0 = dm.bit ? -3.4 : 3.4;
    const m = cube(s.name, s.priv ? COL.bad : COL.cpu, [2.8, 0.5, 0.9], x0 + (Math.random() - 0.5) * 2, 0.3 + (dm.n % 5) * 0.55, (Math.random() - 0.5) * 2, 4);
    dm.n++;
    if (s.priv && dm.bit === 1) {
      dm.traps++;
      await W(undefined, 700);
      fly(m, V3(3, 7, 2));
      tint(dm.bitBox, COL.bad); await W(undefined, 400); tint(dm.bitBox, COL.user);
      log(s.name + ' 是特權指令（' + s.note + '），在 user mode 執行 → 硬體把它當非法指令 trap 給 OS。', true);
    } else log(s.name + '：' + (s.priv ? '在 kernel mode，可以執行。' : '一般指令，哪個 mode 都能執行。'));
    dualState();
  }
  async function dualSys() {
    if (dm.bit === 0) { log('已經在 kernel mode 了；system call 是 user program 進 OS 的入口。', true); return; }
    dm.bit = 0; tint(dm.bitBox, COL.os); relabel(dm.bitBox, 'mode bit = 0');
    log('system call → trap：硬體把 mode bit 設成 0，跳進 OS。現在可以執行特權指令。');
    dualState();
  }
  async function dualRet() {
    if (dm.bit === 1) { log('現在就是 user mode，沒有 trap 可以 return。', true); return; }
    dm.bit = 1; tint(dm.bitBox, COL.user); relabel(dm.bitBox, 'mode bit = 1');
    log('return from system call：mode bit 設回 1，回到 user program。');
    dualState();
  }

  // ───────────────────────── 模式 4：儲存階層 ─────────────────────────
  // 存取時間取自恐龍書 9e Fig. 1.11（Performance of various levels of storage）
  const TIERS = [
    { n: 'registers', t: '0.25–0.5 ns', s: '< 1 KB', vol: true, w: 1.6, c: '#d64545' },
    { n: 'cache (SRAM)', t: '0.5–25 ns', s: '< 16 MB', vol: true, w: 2.8, c: '#dd8238' },
    { n: 'main memory (DRAM)', t: '80–250 ns', s: '< 64 GB', vol: true, w: 4.2, c: '#c08a1f' },
    { n: 'SSD / flash', t: '25–50 μs', s: '< 1 TB', vol: false, w: 5.6, c: '#2fc092' },
    { n: 'hard disk', t: '5 ms', s: '> 1 TB', vol: false, w: 7, c: '#4b9ee2' },
    { n: 'optical / tape', t: '秒級', s: '很大', vol: false, w: 8.4, c: '#9b7ef4' },
  ];
  const st = { off: false, sel: 2, blocks: [] };
  function tierY(i) { return 5.6 - i * 0.95; }
  function enterStorage() {
    fresh([0, 4.5, 14], [0, 3, 0]);
    st.off = false; st.blocks = [];
    st.ms = TIERS.map((T, i) => cube(T.n, T.c, [T.w, 0.8, 1.4], 0, tierY(i), 0));
    tag('越上面：越快、越貴、越小', 'idx', -5.6, 6.3);
    tag('越下面：越慢、越便宜、越大', 'idx', -5.6, 0.3);
    st.volLine = line(-5, tierY(2) - 0.48, 0.8, 5, tierY(2) - 0.48, 0.8, '#d64545');
    tag('↑ volatile（斷電就沒了）', 'ptr', -4.8, tierY(2) - 0.2, 0.8);
    controls('<select id="sTier">' + TIERS.map((T, i) => '<option value="' + i + '">' + T.n + '</option>').join('') + '</select>'
      + '<button class="primary" id="sLoad">把資料從 disk 搬上來</button><button id="sOff">斷電</button><button id="sOn">復電</button>');
    $('sTier').value = st.sel;
    $('sTier').onchange = (e) => { st.sel = Number(e.target.value); stSel(); };
    on('sLoad', () => run(() => stLoad()));
    on('sOff', () => run(() => stPower(false)));
    on('sOn', () => run(() => stPower(true)));
    log('選一層看速度；「搬上來」看資料怎麼一層層 copy 到 CPU 旁邊。');
    stSel();
  }
  function stSel() {
    const T = TIERS[st.sel];
    st.ms.forEach((m, i) => glow(m, i === st.sel ? GOLD : null));
    setState('儲存階層：' + T.n, [['存取時間', T.t], ['典型容量', T.s], ['volatile', T.vol ? '是（斷電就消失）' : '否（non-volatile）'], ['CPU 能直接存取', st.sel <= 2 ? '能' : '不能：要先搬到 memory']],
      'memory 是 CPU 能直接存取的最後一層；以下統稱 <b>secondary storage</b>');
  }
  async function stLoad(tok) {
    if (st.off) { log('斷電中：先「復電」。', true); return; }
    st.blocks.forEach((b) => kill(b)); st.blocks = [];
    const d = cube('data', '#ffffff', [0.8, 0.5, 0.6], 2.5, tierY(4), 1);
    st.blocks.push(d);
    log('資料原本在 hard disk（non-volatile）。');
    for (const i of [2, 1, 0]) {
      await W(tok, 800);
      const c = cube('copy', '#ffffff', [0.8, 0.5, 0.6], 2.5, tierY(4), 1);
      st.blocks.push(c);
      move(c, [1.9, 2.4, 3.1][i], tierY(i), 1);
      log(i === 2 ? 'copy 到 main memory：CPU 這才看得到。' : i === 1 ? 'copy 到 cache：下次讀更快。' : 'load 進 register：CPU 拿來算。');
    }
    await W(tok, 600);
    log('上層都只是 copy；真正的資料以 memory／disk 上的為準。');
  }
  async function stPower(on_) {
    if (!on_ === st.off) { log(st.off ? '已經斷電了。' : '電源本來就是開的。', true); return; }
    st.off = !on_;
    TIERS.forEach((T, i) => { if (T.vol) { tint(st.ms[i], on_ ? T.c : COL.idle); } });
    if (!on_) {
      st.blocks.forEach((b) => { if (b.position.y > tierY(2) - 0.6) fly(b); });
      st.blocks = st.blocks.filter((b) => b.position.y <= tierY(2) - 0.6);
      log('斷電：register、cache、memory 都是 volatile，裡面的 copy 全部消失；disk 上的資料還在。', true);
    } else log('復電：volatile 層是空的，要重新從 disk 載入。');
  }

  // ───────────────────────── 模式 5：OS 結構 ─────────────────────────
  const STRUCT = {
    mono: { name: 'Monolithic（傳統 UNIX）', crossings: 2, msgs: 0, note: '全部服務都在 kernel 裡：呼叫快，但一個 bug 可能拖垮整個 kernel' },
    layer: { name: 'Layered', crossings: 2, msgs: 0, note: '第 i 層只用第 i−1 層的服務：好除錯，但每層都要過一次，比較慢' },
    micro: { name: 'Microkernel（Mach）', crossings: 4, msgs: 2, note: 'kernel 只留通訊、排程、記憶體；file server 在 user space，用 message passing' },
    module: { name: 'Loadable modules（Linux、Solaris）', crossings: 2, msgs: 0, note: '核心小、模組可在執行時載入；模組之間直接呼叫，像 monolithic 一樣快' },
  };
  const so = { kind: 'mono' };
  function enterStruct() {
    fresh([0, 5.5, 14], [0, 2.6, 0]);
    controls('<select id="oKind">' + Object.keys(STRUCT).map((k) => '<option value="' + k + '">' + STRUCT[k].name + '</option>').join('') + '</select><button class="primary" id="oCall">user 呼叫 read()</button><button id="oCrash">file system 出 bug</button>');
    $('oKind').value = so.kind;
    $('oKind').onchange = (e) => { so.kind = e.target.value; clearLog(); enterStruct(); };
    on('oCall', () => run(() => structCall()));
    on('oCrash', () => run(() => structCrash()));
    so.parts = drawStruct(so.kind);
    log(STRUCT[so.kind].note);
    setState(STRUCT[so.kind].name, [['user ↔ kernel 切換', String(STRUCT[so.kind].crossings)], ['message 個數', String(STRUCT[so.kind].msgs)]], STRUCT[so.kind].note);
  }
  function drawStruct(kind) {
    const P = {};
    ctx.tile(V3(0, 0.04, 0), 13, 4.4, '#efe6d6');
    P.user = cube('user program', COL.user, [2.4, 0.8, 1], -4.6, 5.4, 0);
    line(-6.5, 4.6, 0, 6.5, 4.6, 0, '#8a7a5c'); tag('user space ↑　kernel ↓', 'idx', 5.4, 4.85);
    P.hw = cube('hardware', '#8a7a5c', [12, 0.6, 1.4], 0, 0.3, 0);
    if (kind === 'mono') {
      P.k = cube('kernel：file system、CPU scheduling、memory、driver… 全在一起', COL.os, [12, 2.6, 1.4], 0, 2.2, 0);
      P.fs = cube('file system', '#b9a4f7', [2.6, 0.6, 0.3], -3.2, 2.6, 0.75);
    } else if (kind === 'layer') {
      const L = ['layer 1：driver', 'layer 2：memory', 'layer 3：file system', 'layer 4：I/O 緩衝'];
      P.layers = L.map((n, i) => cube(n, i === 2 ? '#b9a4f7' : COL.os, [10 - i * 1.2, 0.72, 1.4], 0, 1.0 + i * 0.85, 0));
      P.fs = P.layers[2];
    } else if (kind === 'micro') {
      P.k = cube('microkernel：IPC、排程、記憶體', COL.os, [6, 1.2, 1.4], 0, 1.4, 0);
      P.fs = cube('file server', '#b9a4f7', [2.4, 0.8, 1], 0.4, 5.4, 0);
      P.drv = cube('device driver', '#b9a4f7', [2.4, 0.8, 1], 4.2, 5.4, 0);
    } else {
      P.k = cube('core kernel', COL.os, [3.2, 1.6, 1.4], 0, 2.2, 0);
      const M = [['file system', -4.2, 3.3], ['scheduling', 4.2, 3.3], ['device driver', -4.2, 1.2], ['executable formats', 4.2, 1.2]];
      M.forEach(([n, x, y]) => { const m = cube(n, '#b9a4f7', [2.8, 0.7, 1], x, y, 0); if (n === 'file system') P.fs = m; line(x > 0 ? x - 1.4 : x + 1.4, y, 0, x > 0 ? 1.6 : -1.6, 2.2, 0, '#8a7a5c'); });
    }
    return P;
  }
  async function structCall(tok) {
    const P = so.parts, S = STRUCT[so.kind];
    const msg = cube('read()', COL.gold, [1.1, 0.45, 0.5], -4.6, 6.1, 0.9);
    const path = so.kind === 'micro'
      ? [[0, 1.4, 'trap 進 microkernel'], [0.4, 5.4, 'message 送到 user space 的 file server'], [0, 1.4, 'file server 回覆 message，再經 kernel'], [-4.6, 6.1, '回到 user program']]
      : so.kind === 'layer'
        ? [[0, 3.55, '進 kernel 的最上層'], [0, 2.7, '往下一層'], [0, 1.85, '再往下'], [0, 1.0, '到 driver'], [-4.6, 6.1, '一層層回來']]
        : [[P.fs.position.x, P.fs.position.y, '一次 trap 進 kernel，直接呼叫 file system'], [-4.6, 6.1, 'return']];
    for (const [x, y, s] of path) { move(msg, x, y, 0.9); log(s); await W(tok, 900); }
    kill(msg);
    setState(S.name, [['user ↔ kernel 切換', String(S.crossings)], ['message 個數', String(S.msgs)]], S.note);
  }
  async function structCrash(tok) {
    const P = so.parts;
    glow(P.fs, RED);
    if (so.kind === 'micro') { log('file server 只是 user space 的一支程式：它掛了，kernel 照常運作，重啟它就好。'); await W(tok, 1200); glow(P.fs, null); }
    else if (so.kind === 'module') { log('模組跑在 kernel 裡：模組的 bug 一樣可能讓 kernel 出事（Linux 稱 kernel oops/panic）。', true); }
    else { log('file system 在 kernel 裡：它出錯，整個 kernel 都可能 crash。', true); if (P.k) glow(P.k, RED); if (P.layers) P.layers.forEach((m) => glow(m, RED)); }
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  let qs = { score: 0, total: 0 };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function genQ() {
    const r = Math.random();
    if (r < 0.14) {
      const ev = pick([['移動滑鼠', 'hardware interrupt（signal）'], ['磁碟 controller 搬完資料', 'hardware interrupt（signal）'], ['timer 時間到', 'hardware interrupt（signal）'], ['程式除以零', 'software interrupt（trap）'], ['程式呼叫 printf → write()', 'software interrupt（trap）'], ['程式存取不屬於它的 memory（segmentation fault）', 'software interrupt（trap）']]);
      return { q: '「' + ev[0] + '」屬於哪一種中斷？', opts: ['hardware interrupt（signal）', 'software interrupt（trap）', '不是中斷，是一般 function call', 'polling'], ans: ev[1], why: '外部裝置產生的是 hardware interrupt（周志遠課堂稱 signal）；程式自己的錯誤或 system call 是 software interrupt（trap）。' };
    }
    if (r < 0.28) {
      const s = pick(INSTR.concat([{ name: 'read the clock', priv: false }, { name: 'switch from user to kernel mode（system call）', priv: false }, { name: 'clear memory', priv: true }, { name: 'turn off interrupts', priv: true }]));
      return { q: '「' + s.name + '」應該是特權指令嗎？', opts: ['是，只能在 kernel mode 執行', '不是，user mode 也能執行', '只有在開機時才能執行', '要看 compiler'], ans: s.priv ? '是，只能在 kernel mode 執行' : '不是，user mode 也能執行', why: s.priv ? '會影響整個系統（I/O、timer、中斷、memory 管理）的指令都是特權指令。' : '讀時鐘、一般運算不會傷害別人；進入 kernel 的唯一合法方法正是 system call（trap）。' };
    }
    if (r < 0.44) {
      const a = 1 + Math.floor(Math.random() * 4), b = 2 + Math.floor(Math.random() * 6);
      const u = Math.round(a / (a + b) * 100);
      return { q: '一個 job 不斷重複：CPU ' + a + ' ms → I/O ' + b + ' ms。系統一次只放這一個 job（batch），CPU 使用率約多少？', opts: [u + '%', Math.round(b / (a + b) * 100) + '%', '100%', Math.round(a / b * 100) + '%'].filter((v, i, s) => s.indexOf(v) === i), ans: u + '%', why: 'I/O 時 CPU 只能 idle：' + a + ' / (' + a + ' + ' + b + ') ≈ ' + u + '%。多放幾個 job（multiprogramming）就能把 I/O 時間補滿。' };
    }
    if (r < 0.56) {
      const n = 8 + Math.floor(Math.random() * 248);
      return { q: '某硬體支援 ' + n + ' 種 interrupt，interrupt vector 每格存一個 32-bit function pointer，vector 共多大？', opts: [n * 4 + ' bytes', n + ' bytes', n * 32 + ' bytes', '不固定，看 handler 程式碼多長'], ans: n * 4 + ' bytes', why: 'vector 只放 function pointer（4 bytes），不放 handler 本身，所以每格大小固定：' + n + ' × 4 = ' + n * 4 + '。' };
    }
    if (r < 0.68) {
      const q = pick([['哪一層是 CPU 能直接存取的最後一層？', 'main memory', ['main memory', 'cache', 'hard disk', 'SSD']], ['下列何者是 volatile？', 'cache', ['cache', 'SSD', 'hard disk', 'tape']], ['main memory 通常用哪種技術做？', 'DRAM（1 個電晶體，便宜、省電、較慢）', ['DRAM（1 個電晶體，便宜、省電、較慢）', 'SRAM（快但貴）', 'flash', 'tape']], ['real-time system 通常避免使用哪一種儲存？', 'secondary storage（存取時間難掌握）', ['secondary storage（存取時間難掌握）', 'register', 'cache', 'main memory']]]);
      return { q: q[0], opts: q[2], ans: q[1], why: '儲存階層：越上層越快越貴越小；memory 以上是 volatile；CPU 只能直接讀 memory，secondary storage 要先搬進 memory。' };
    }
    if (r < 0.8) {
      const q = pick([['哪一種結構把 file system 等服務放在 user space，靠 message passing 溝通？', 'Microkernel'], ['哪一種結構「第 i 層只能用第 i−1 層的服務」？', 'Layered'], ['哪一種結構把所有服務放進同一個大 kernel，效能好但難維護？', 'Monolithic'], ['Linux 可以在執行時載入 driver，屬於哪種設計？', 'Loadable kernel modules']]);
      return { q: q[0], opts: ['Microkernel', 'Layered', 'Monolithic', 'Loadable kernel modules'], ans: q[1], why: 'Microkernel 可靠但 message 多所以慢；layered 好除錯但層層呼叫慢；monolithic 快但耦合高；modules 兼顧彈性與效能。' };
    }
    if (r < 0.9) {
      return { q: '用 message passing 在同一台電腦的兩個 process 間送一份資料，資料至少被 copy 幾次？', opts: ['2 次（sender → kernel → receiver）', '1 次', '0 次', '看 message 大小'], ans: '2 次（sender → kernel → receiver）', why: '因為 protection，process 不能直接寫別人的 memory，要先 copy 到 kernel 再 copy 給對方；shared memory 建好之後就不用 copy，但要自己處理 synchronization。' };
    }
    const q = pick([['Multiprogramming 的主要目的？', '提高 CPU（資源）使用率', ['提高 CPU（資源）使用率', '縮短 response time、可互動', '保證 deadline', '省電']], ['Time sharing 的主要目的？', '縮短 response time、可互動', ['提高 CPU（資源）使用率', '縮短 response time、可互動', '保證 deadline', '省電']], ['Real-time system 的定義？', '在 deadline 之前完成', ['在 deadline 之前完成', '越快越好', '一次一個 job', '一定要用 GPU']]]);
    return { q: q[0], opts: q[2], ans: q[1], why: 'Multiprogramming 從系統角度（讓 CPU 不 idle）；time sharing 從使用者角度（互動、很多人共用）；real-time 只要求 deadline 前完成。' };
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
  // ─── 2nTqrHZhVQ0（第 2A 講）：batch → multiprogramming → time sharing ───
  async function scBatch(tok) {
    fresh([0, 5.5, 14.5], [0, 2.2, 0]);
    memCol(-5.6, [['OS', COL.os, 1.1], ['Job 1', JOBC[0], 1.5], ['（空著）', '#efe6d6', 2.2]], 1.8);
    tag('memory', 'idx', -5.6, -0.2, 1);
    say('Batch：一次只處理一個 job', '讀卡片 → load 進 memory → 執行 → 印出');
    await W(tok, 2600);
    const jobs = [{ name: 'Job 1', bursts: [2, 3, 2, 2, 1] }];
    const res = simulate(jobs, 'batch');
    say('任何 program 都只有兩種 phase：計算或 I/O', '藍 = 用 CPU，橘 = 做 I/O');
    await drawSim(tok, res, jobs, -3.4, 3.4, 0.85, 420, (t) => { if (res.cpu[t - 1] < 0) say('Job 1 在做 I/O：CPU 毫無選擇，只能 idle', 'CPU 遠快於 I/O'); else say('Job 1 在計算：CPU 忙', ''); });
    say('CPU 只忙了 ' + res.busy + ' / ' + res.T + ' 的時間', 'CPU 使用率 = ' + Math.round(res.util * 100) + '%');
    await W(tok, 2600);
    say('三個問題：一次一個 job、不能互動、資源使用率低', '電腦很貴，卻有一半時間在發呆');
    await W(tok, 3000);
  }
  async function scMultiprog(tok) {
    fresh([0, 5.5, 14.5], [0, 2, 0]);
    memCol(-5.8, [['OS', COL.os, 1], ['Job 1', JOBC[0], 0.9], ['Job 2', JOBC[1], 0.9], ['Job 3', JOBC[2], 0.9]], 1.6);
    tag('memory', 'idx', -5.8, -0.2, 1);
    const jobs = [0, 1, 2].map((i) => ({ name: 'Job ' + (i + 1), bursts: [2, 3, 2] }));
    say('Multiprogramming：memory 裡放好幾個 program', 'Job 1~3：CPU 2 → I/O 3 → CPU 2');
    await W(tok, 2600);
    const res = simulate(jobs, 'multi');
    await drawSim(tok, res, jobs, -3.8, 4.2, 0.8, 380, (t) => { if (t === 3) say('Job 1 去做 I/O → CPU 立刻換 Job 2', 'CPU 和 I/O 的時間 overlap'); if (t === 7) say('永遠有人想用 CPU，CPU 就不 idle', ''); });
    const b = simulate(jobs, 'batch');
    say('全部做完只要 ' + res.T + '（batch 要 ' + b.T + '）', 'CPU 使用率：' + Math.round(b.util * 100) + '% → ' + Math.round(res.util * 100) + '%');
    await W(tok, 3000);
    say('目的：從系統角度提高資源使用率', '單一 job 本身沒有變快，甚至要禮讓別人');
    await W(tok, 2800);
  }
  async function scSpooling(tok) {
    fresh([0, 5.5, 13.5], [0, 2, 0]);
    const cpu = cube('CPU（主管）', COL.cpu, [2.2, 1, 1.2], -4.2, 0.5, 0);
    const disk = cube('disk', COL.disk, [2, 1, 1.2], 4.4, 0.5, 0);
    const mem = cube('memory', COL.mem, [2.4, 1, 1.2], 0.6, 0.5, 0);
    const cnt = tag('', 'ptr alt', -4.2, 2);
    say('沒有 spooling：每一步都要 CPU 下指令', '像屬下寫一行字就回來問主管下一步');
    await W(tok, 2400);
    for (let k = 1; k <= 6; k++) {
      const c = cube('指令', COL.gold, [0.6, 0.3, 0.4], -3, 1.4, 0.8); move(c, 4.4, 1.4, 0.8);
      txt(cnt, 'CPU 下了 ' + k + ' 個指令');
      await W(tok, 420); kill(c);
      const d = cube('', COL.disk, [0.4, 0.3, 0.4], 4.4, 1.2, 0.8); move(d, 0.6, 1.2, 0.8); await W(tok, 300); kill(d);
    }
    say('主管整天只在下指令，根本不能做自己的事', 'CPU 被 I/O 綁住 → 無法多工');
    await W(tok, 2400);
    txt(cnt, '');
    say('Spooling：交代一次，做完再 notify 我', '例：從 disk 搬 1 GB 的檔案到 memory');
    const c = cube('搬 1 GB', COL.gold, [1.2, 0.35, 0.4], -3, 1.4, 0.8); move(c, 4.4, 1.4, 0.8);
    await W(tok, 1000); kill(c);
    const blocks = [];
    for (let k = 0; k < 6; k++) { const d = cube('', COL.disk, [0.4, 0.3, 0.4], 4.4, 1.2, 0.8); blocks.push(d); move(d, -0.4 + (k % 3) * 0.5, 1.2 + Math.floor(k / 3) * 0.35, 0.8); glow(cpu, k % 2 ? GREEN : null); txt(cnt, 'CPU 在算別的 job'); await W(tok, 450); }
    const n = cube('notify!', COL.bad, [1.2, 0.4, 0.4], 4.4, 3.4, 0.8); move(n, -4.2, 3.4, 0.8);
    say('搬完才通知 CPU：disk 和 CPU 同時在動', '實現 spooling 的機制 = interrupt（下一章）');
    await W(tok, 3000);
  }
  async function scJobCpuSched(tok) {
    fresh([0, 6, 14], [0, 2, 0]);
    ctx.tile(V3(-4.6, 0.04, 0), 3.4, 3.2, '#d8e6cf'); tag('disk', 'ptr', -4.6, 0.1, 1.9);
    ctx.tile(V3(0, 0.04, 0), 3.4, 3.2, '#f3e6c8'); tag('memory', 'ptr', 0, 0.1, 1.9);
    ctx.tile(V3(4.6, 0.04, 0), 3, 3.2, '#d6e6f6'); tag('CPU cores', 'ptr', 4.6, 0.1, 1.9);
    const P = [];
    for (let k = 0; k < 9; k++) P.push(cube('P' + (k + 1), JOBC[k % 5], [0.7, 0.5, 0.7], -5.6 + (k % 3) * 1, 0.3 + Math.floor(k / 3) * 0.55, -0.5, 0));
    say('寫好、compile 好的 program 一開始都在 disk', 'memory 有限：不能全部 load 進來');
    await W(tok, 2400);
    say('Job scheduling：挑哪些 program 進 memory', 'disk → memory');
    for (let k = 0; k < 5; k++) { move(P[k], -1 + (k % 3) * 1, 0.3 + Math.floor(k / 3) * 0.55, 0); await W(tok, 450); }
    await W(tok, 1200);
    say('CPU scheduling：memory 裡挑誰上 CPU', '核心更少：就算 64 核，也只能同時跑 64 個');
    move(P[0], 4.1, 0.3, 0); await W(tok, 600); move(P[1], 5.1, 0.3, 0); await W(tok, 1200);
    say('還要 memory management：每個 job 分多少空間？', '加上 spooling（interrupt）→ 才湊出 multiprogramming OS');
    await W(tok, 3000);
    say('現在 memory 很大，job scheduling 比較不重要', '一般電腦通常全部 load 進來');
    await W(tok, 2600);
  }
  async function scTimeSharing(tok) {
    fresh([0, 5.5, 14.5], [0, 2, 0]);
    const jobs = [{ name: '使用者 A', bursts: [4] }, { name: '使用者 B', bursts: [3] }, { name: '使用者 C', bursts: [3] }];
    say('Time sharing：大家一起執行，用時間切割 CPU', '每人只跑幾個 ms 就換人（這裡 time slot = 1）');
    await W(tok, 2600);
    const ts = simulate(jobs, 'ts', 1);
    await drawSim(tok, ts, jobs, -4.6, 4.4, 0.95, 420, (t) => { if (t === 3) say('time slot 一到就 switch：A→B→C→A…', '看起來大家同時在跑'); });
    const b = simulate(jobs, 'multi');
    say('使用者 C 第 ' + ts.first[2] + ' 個單位就拿到 CPU', '不切換的話要等到第 ' + b.first[2] + ' 個單位');
    await W(tok, 3000);
    say('頻繁切換 → 一按鍵盤立刻有反應（interactive）', '很多人同時用，卻以為自己獨占這台電腦');
    await W(tok, 3200);
  }
  async function scTsNeeds(tok) {
    fresh([0, 5.5, 14], [0, 2.2, 0]);
    say('Time sharing 帶來新問題，對到後面的章節', '');
    await W(tok, 1800);
    // virtual memory
    const mem = cube('memory', COL.mem, [2.2, 1.2, 1.2], -4.6, 0.6, 0, 3);
    say('程式要更多：用 disk 假裝 memory', 'Virtual memory');
    await W(tok, 1200);
    const vm = cube('disk 當 memory', COL.disk, [2.2, 1.6, 1.2], -4.6, 2.0, 0, 3);
    tag('Virtual memory', 'ptr', -4.6, 3.4);
    await W(tok, 1800);
    say('大家最常做的互動：開檔、編輯、存檔', 'File system');
    ['a.txt', 'b.c', 'hw1'].forEach((n, k) => cube(n, '#e9dcc4', [1.3, 0.5, 0.9], 0, 0.25 + k * 0.55, 0, 3 + k));
    tag('File system', 'ptr', 0, 2.2);
    await W(tok, 2200);
    say('很多程式同時改同一個 counter → 結果亂掉', 'Synchronization：要 lock');
    const ctr = cube('counter', COL.gold, [1.2, 0.8, 0.9], 4.6, 0.4, 0);
    const p1 = cube('P1', JOBC[0], [0.9, 0.7, 0.8], 3.0, 0.35, 0), p2 = cube('P2', JOBC[1], [0.9, 0.7, 0.8], 6.2, 0.35, 0);
    await W(tok, 1500);
    const lockA = cube('lock A', COL.bad, [1, 0.4, 0.6], 3.0, 1.2, 0), lockB = cube('lock B', COL.bad, [1, 0.4, 0.6], 6.2, 1.2, 0);
    tag('P1 拿 A 等 B　P2 拿 B 等 A', 'idx', 4.6, 2.4);
    glow(p1, RED); glow(p2, RED);
    say('lock 用多了：你擋我、我擋你', 'Deadlock');
    await W(tok, 3000);
    say('這些 concept 從來沒變過：OS 的核心問題', 'virtual memory・file system・synchronization・deadlock');
    await W(tok, 2800);
    void mem; void vm; void ctr; void lockA; void lockB;
  }
  async function scGenerations(tok) {
    fresh([0, 5, 14], [0, 2.4, 0]);
    const cols = [['Batch', -4.4, 1, 0.2, '一次一個 job（baseline）'], ['Multiprogramming', 0, 3.6, 0.6, '系統角度：使用率'], ['Time sharing', 4.4, 3.6, 3.6, '使用者角度：互動']];
    tag('CPU 使用率', 'idx', -6.2, 4.6); tag('■ 藍 = 使用率　■ 綠 = 互動性', 'idx', 0, 5.6);
    say('三代系統，目的不同', '');
    await W(tok, 1600);
    for (const [n, x, u, ia, goal] of cols) {
      tag(n, 'ptr', x, -0.2, 1.4);
      const b1 = cube('', COL.cpu, [1, 1, 1], x - 0.65, 0.01, 0), b2 = cube('', COL.user, [1, 1, 1], x + 0.65, 0.01, 0);
      b1.scale.y = 0.01; b2.scale.y = 0.01;
      await anim(tok, 700, (f) => { b1.scale.y = Math.max(0.01, u * f); b1.position.y = u * f / 2; b2.scale.y = Math.max(0.01, ia * f); b2.position.y = ia * f / 2; });
      tag(goal, 'ptr alt', x, Math.max(u, ia) + 0.6);
      say(n + '：' + goal, n === 'Batch' ? '沒有互動、CPU 常 idle' : n === 'Multiprogramming' ? 'CPU 和 I/O overlap，但使用者感受沒變好' : 'response time 短、很多人 sharing');
      await W(tok, 2400);
    }
    say('multiprogramming 為系統，time sharing 為人', '考試常問兩者目的的差別');
    await W(tok, 3000);
  }

  // ─── 1gIwNYCcwAk（第 2D 講）：special-purpose systems ───
  async function scRealtimeEdf(tok) {
    fresh([0, 5.5, 14.5], [0, 2.2, 0]);
    // 補充：課堂只用「寫作業」比喻，數字是自訂的
    const T = [['作業 A', 3, 9], ['作業 B', 2, 4], ['作業 C', 2, 6]];
    say('Real-time ≠ 很快', '慢慢做沒關係，但要在 deadline 前做完');
    await W(tok, 2600);
    const unit = 0.9, x0 = -4.6;
    async function lane(y, order, name) {
      tag(name, 'ptr', x0 - 1.4, y);
      let t = 0;
      for (const k of order) {
        const [n, len, dl] = T[k];
        const m = lab.box(JOBC[k], [len * unit, 0.5, 0.6]); m.position.set(x0 + (t + len / 2) * unit, y, 0); m.add(lab.label(n, 'val')); lab.world.add(m);
        t += len;
        const ok = t <= dl;
        tag((ok ? '✓' : '✗ 遲交') + ' d=' + dl, ok ? 'idx' : 'ptr', x0 + (t - len / 2) * unit, y + 0.55);
        if (!ok) glow(m, RED);
        await W(tok, 900);
      }
    }
    for (const [n, , dl] of T) { line(x0 + dl * unit, 0.4, 0, x0 + dl * unit, 4.6, 0, '#d64545'); tag(n.slice(-1) + ' 的 deadline', 'idx', x0 + dl * unit, 4.9); }
    say('照拿到的順序做（A、B、C）', 'A 長度 3、B 長度 2、C 長度 2');
    await lane(3.4, [0, 1, 2], '先來先做');
    await W(tok, 1200);
    say('Earliest Deadline First：最早 deadline 的先做', '就像寫作業：最快要交的先寫');
    await lane(1.6, [1, 2, 0], 'EDF');
    await W(tok, 1200);
    say('EDF 讓三份都準時交', '直覺、有效，但不保證永遠不 miss');
    await W(tok, 3000);
    say('real-time 系統裡最 critical 的是 scheduler', 'deadline = 使用者能接受的反應時間');
    await W(tok, 2600);
  }
  async function scHardSoft(tok) {
    fresh([0, 5.5, 14], [0, 2.4, 0]);
    tag('Soft real-time：串流影片', 'ptr', -3.6, 5.4); tag('Hard real-time：汽車煞車', 'ptr alt', 3.6, 5.4);
    say('Soft：盡量趕 deadline，沒趕上也不會出人命', '用 priority：重要的先送');
    const frame = cube('', '#efe6d6', [4.2, 2.6, 0.2], -3.6, 2.4, 0);
    await W(tok, 1500);
    const steps = [['先送輪廓（priority 高）', '#8a7a5c'], ['再送顏色', '#c08a1f'], ['最後送高解析度細節', '#4b9ee2']];
    for (const [s, c] of steps) { tint(frame, c); say('收訊不好時：' + s, 'multimedia streaming 是標準的 soft real-time'); await W(tok, 1500); }
    say('Hard：miss 任何一個 deadline → 系統失敗', '踩煞車車子不停，就撞車了');
    const car = cube('car', COL.bad, [1.6, 0.8, 1], 1.6, 0.4, 0);
    const wall = cube('', '#8a7a5c', [0.3, 2, 1.2], 6.2, 1, 0);
    tag('deadline', 'ptr', 4.6, 2.4); line(4.6, 0, 0, 4.6, 2.1, 0, '#d64545');
    await W(tok, 1200);
    move(car, 4.2, 0.4, 0); say('在 deadline 前完成煞車', '✓'); await W(tok, 1600);
    move(car, 1.6, 0.4, 0); await W(tok, 900);
    move(car, 5.5, 0.4, 0); glow(car, RED); glow(wall, RED); say('超過 deadline：fundamental failure', '武器、醫療、控制系統都是 hard real-time'); await W(tok, 2200);
    say('Hard real-time 通常沒有 secondary storage', 'disk 太慢、存取時間又不好掌握：資料全放 memory');
    await W(tok, 3200);
  }
  async function scSpecial(tok) {
    fresh([0, 5, 14], [0, 2.2, 0]);
    const C = [['Multimedia', -4.8, 'soft real-time・壓縮・on-demand / live', '#e55a9b'], ['Handheld / embedded', -1.6, '硬體專用・OS 客製化・省電・記憶體小', '#2fc092'], ['Cloud computing', 1.6, '把 internet 當成你的電腦', '#4b9ee2'], ['IoT 物聯網', 4.8, '所有物品連在一起計算、溝通', '#c08a1f']];
    say('依「用途」區分的電腦系統', '名詞不用背，要知道設計考量差在哪');
    await W(tok, 2200);
    for (const [n, x0, d, c] of C) {
      const x = x0 * 1.12, k = C.findIndex((e) => e[0] === n);
      cube(n, c, [2.8, 1.2, 1], x, 0.6 + (k % 2) * 0.7, 0, 4);
      tag(d, 'idx', x, 2.0 + (k % 2) * 0.9);
      say(n, d);
      await W(tok, 2200);
    }
    say('手機為何不灌傳統 OS？', '光跑 OS 就吃掉大部分資源、又不管電力');
    await W(tok, 3000);
  }

  // ─── BtHlptO34wM（第 4A 講）：controller、busy-wait、interrupt、trap、vector ───
  async function scController(tok) {
    fresh([0, 5.5, 14], [0, 1.8, 0]);
    const cpu = cube('CPU', COL.cpu, [1.8, 1, 1.2], -5, 0.5, 0);
    const mem = cube('memory', COL.mem, [1.8, 1, 1.2], -1.8, 0.5, 0);
    const ctl = cube('device controller', COL.os, [2.6, 1, 1.2], 1.8, 0.5, 0);
    const dev = cube('disk', COL.disk, [1.6, 1, 1.2], 5.4, 0.5, 0);
    tag('registers', 'idx', 1.8, 1.4, 0.7);
    const buf = []; for (let k = 0; k < 4; k++) buf.push(ctx.tile(V3(1.0 + k * 0.55, 1.08, 0), 0.45, 0.6, '#efe6d6'));
    tag('local buffer（很小）', 'idx', 1.8, 1.8, 0);
    say('device 和 memory 中間有一個 device controller', '速度差太多：controller 有自己的 register 和 buffer');
    await W(tok, 2600);
    const cmd = cube('下指令', COL.gold, [1, 0.35, 0.5], -5, 1.4, 0.8); move(cmd, 1.8, 1.4, 0.8);
    say('CPU 是 master：下指令給 controller', 'controller 本身也是被動的');
    await W(tok, 1400); kill(cmd);
    const ds = [];
    for (let k = 0; k < 4; k++) { const d = cube('', COL.disk, [0.4, 0.3, 0.5], 5.4, 1.3, 0); ds.push(d); move(d, 1.0 + k * 0.55, 1.3, 0); await W(tok, 500); }
    say('資料先搬進 buffer，再寫到 memory', 'buffer 滿了就不能再收');
    await W(tok, 1600);
    for (const d of ds) { move(d, -1.8, 1.3, 0); await W(tok, 300); }
    say('buffer 大小和搬移演算法決定 I/O 速度的極限', '一樣需要 CPU 控制和下指令');
    await W(tok, 3000);
    void cpu; void mem; void ctl; void dev;
  }
  async function scBusyWait(tok) {
    fresh([0, 5.5, 14], [0, 2.2, 0]);
    const cd = code(['while (*p != EOF) {', '  while (peek(status) == BUSY)', '    ;  // 一直檢查', '  poke(data, *p++);', '}'], -3.4, 5.2, 0.55);
    const cpu = cube('CPU', COL.cpu, [1.8, 1, 1.2], -3.4, 0.5, 0);
    const ctl = cube('controller', COL.os, [2.2, 1, 1.2], 3.8, 0.5, 0);
    const st = tag('status = BUSY', 'ptr', 3.8, 1.6);
    const cnt = tag('', 'ptr alt', -3.4, 1.6);
    say('Busy-wait：CPU 完全自己控制 I/O', '一個一個 character 寫出去');
    await W(tok, 2200);
    let spins = 0;
    for (let ch = 0; ch < 3; ch++) {
      cd.hl(1);
      for (let k = 0; k < 7; k++) { spins++; txt(cnt, 'peek 了 ' + spins + ' 次'); glow(cpu, k % 2 ? GOLD : null); await W(tok, 220); }
      txt(st, 'status = READY'); cd.hl(3);
      const c = cube("'" + 'abc'[ch] + "'", COL.gold, [0.6, 0.4, 0.5], -3.4, 1.2, 0.8); move(c, 3.8, 1.2, 0.8);
      await W(tok, 700); kill(c); txt(st, 'status = BUSY');
    }
    glow(cpu, null);
    say('一個 byte 要好幾 ms，CPU 都在燒 cycle', 'CPU 使用率 100%，對使用者卻沒幫助');
    await W(tok, 3000);
    say('程式做 I/O 時仍霸佔 CPU', 'multiprogramming 也救不了 → 需要 interrupt');
    await W(tok, 2800);
  }
  async function scIntrTimeline(tok) {
    fresh([0, 5, 14.5], [0, 2.2, 0]);
    // 恐龍書 Fig. 1.3：Interrupt timeline for a single process doing output
    const x0 = -5, u = 0.6;
    tag('CPU', 'ptr', x0 - 1, 3.6); tag('I/O device', 'ptr', x0 - 1.2, 1.2);
    line(x0, 3.0, 0, x0 + 18 * u, 3.0, 0); line(x0, 1.6, 0, x0 + 18 * u, 1.6, 0);
    tag('高 = 執行 user process；低 = 處理 I/O interrupt', 'idx', 0.4, 5.3);
    tag('低 = 傳輸中（busy）；高 = idle', 'idx', 0.4, 0.2);
    const seq = [[3, 'user', 'idle'], [4, 'user', 'busy'], [1, 'intr', 'idle'], [3, 'user', 'idle'], [4, 'user', 'busy'], [1, 'intr', 'idle'], [2, 'user', 'idle']];
    say('有了 interrupt：程式算它的，I/O 傳它的', 'interrupt 改變 CPU 的執行 flow');
    await W(tok, 2000);
    let t = 0;
    for (const [d, c, io] of seq) {
      const cy = c === 'user' ? 3.6 : 3.1, iy = io === 'idle' ? 1.9 : 1.3;
      const m1 = lab.box(c === 'user' ? COL.cpu : COL.os, [d * u, 0.35, 0.5]); m1.position.set(x0 + (t + d / 2) * u, cy, 0); lab.world.add(m1);
      const m2 = lab.box(io === 'idle' ? COL.idle : COL.io, [d * u, 0.35, 0.5]); m2.position.set(x0 + (t + d / 2) * u, iy, 0); lab.world.add(m2);
      if (c === 'intr') { arrow(x0 + t * u, 1.4, x0 + t * u, 2.9, COL.bad); tag('interrupt', 'idx', x0 + t * u, 2.3, 0.4); say('傳輸結束 → controller 發 interrupt', 'CPU 暫停 user process，跑 OS 的 handler，做完 return'); }
      else if (io === 'busy') { tag('I/O request', 'idx', x0 + t * u, 2.3, 0.4); say('發出 I/O request：device 開始傳輸', 'CPU 不用等，照樣跑 user process'); }
      else say('user process 在 CPU 上執行', 'I/O device idle');
      t += d;
      await W(tok, 1300);
    }
    say('CPU 和 I/O 同時運作，只有需要時才被打斷', 'event-driven：沒事時 OS 不執行任何指令');
    await W(tok, 3200);
  }
  async function scIntrFlow(tok) {
    fresh([0, 6, 14], [0, 2.4, 0]);
    const A = cube('A：printf(…)', JOBC[0], [2.4, 0.7, 1], -4.6, 4.6, 0), B = cube('B：計算中', JOBC[1], [2.4, 0.7, 1], -4.6, 3.4, 0);
    const cpu = cube('CPU', COL.cpu, [1.6, 1, 1.2], -0.6, 0.5, 0);
    const drv = cube('OS：disk driver', COL.os, [2.4, 0.7, 1], 3.2, 4.6, 0);
    const ctl = cube('controller', COL.os, [2, 0.8, 1.2], 4.2, 0.4, 0);
    const run_ = tag('CPU 在跑：A', 'ptr alt', -0.6, 1.5);
    say('程式 A 要 output 一個很大的檔案', 'printf → system call → OS 的 device driver');
    glow(A, GOLD); await W(tok, 2200);
    move(drv, 3.2, 4.6, 0); arrow(-3.3, 4.6, 1.9, 4.6, COL.gold);
    say('driver 用 interrupt 的方式 initiate I/O', '告訴 controller：搬 200 bytes，搬完再叫我');
    await W(tok, 2200);
    arrow(3.6, 4.2, 4.2, 0.9, COL.gold);
    glow(A, null); tint(A, COL.idle); relabel(A, 'A：等 I/O');
    say('A 停在 printf 等結果 → CPU 換去跑 B', '不用 while loop 一直盯著 register');
    glow(B, GOLD); txt(run_, 'CPU 在跑：B');
    const ds = []; for (let k = 0; k < 5; k++) { const d = cube('', COL.disk, [0.35, 0.3, 0.4], 6, 0.4, 0); ds.push(d); move(d, 4.2 + (k - 2) * 0.4, 1.2, 0); await W(tok, 450); }
    await W(tok, 600);
    const sig = cube('interrupt!', COL.bad, [1.4, 0.4, 0.5], 4.2, 1.6, 0.8); move(sig, -0.6, 1.6, 0.8);
    say('搬完 → controller signal 一個 interrupt', 'CPU 打斷 B，執行 interrupt handler');
    glow(B, null); txt(run_, 'CPU 在跑：interrupt handler');
    await W(tok, 2200); kill(sig);
    tint(A, JOBC[0]); relabel(A, 'A：ready');
    say('handler 確認 I/O 完成，把 A 改成可執行', '現在 A 和 B 都 ready');
    await W(tok, 2400);
    txt(run_, '誰先跑？由 CPU scheduling 決定');
    say('通常讓被打斷的 B 繼續；A 比較重要也可能先跑', '滑鼠：controller 直接丟 signal，流程一樣');
    await W(tok, 3200);
    void cpu; void ctl;
  }
  async function scSignalTrap(tok) {
    fresh([0, 5.5, 14], [0, 2.2, 0]);
    ctx.tile(V3(-3.4, 0.04, 0), 5.8, 4, '#d6e6f6'); ctx.tile(V3(3.4, 0.04, 0), 5.8, 4, '#f6dfd6');
    tag('hardware interrupt＝signal', 'ptr', -3.4, 0.1, 2.3); tag('software interrupt＝trap', 'ptr alt', 3.4, 0.1, 2.3);
    say('interrupt 有兩種來源', '課堂用語：hardware → signal、software → trap');
    await W(tok, 2400);
    const E = [['移動滑鼠', 'hw'], ['磁碟搬完', 'hw'], ['除以零', 'sw'], ['segmentation fault', 'sw'], ['printf → system call', 'sw'], ['timer 到時', 'hw']];
    let nh = 0, ns = 0;
    for (const [n, k] of E) {
      const hw = k === 'hw', x = hw ? -3.4 : 3.4, y = 0.6 + (hw ? nh : ns) * 0.8;
      cube(n, hw ? COL.cpu : COL.io, [2.6, 0.5, 0.8], x, y, -0.5, 4);
      if (hw) nh++; else ns++;
      say(n + (hw ? '：signal' : '：trap'), hw ? '被動：任何一行指令中間都可能被打斷' : n.includes('system') ? '所有 system call 都必須透過 interrupt，沒有例外' : '程式自己造成；OS 處理錯誤，系統不會 crash');
      await W(tok, 1800);
    }
    say('system call 為何不能像一般 function call？', '透過 trap，OS 才能檢查並保護系統');
    await W(tok, 3000);
    say('補充：恐龍書稱軟體中斷為 trap / exception', 'UNIX 的 "signal" 另有所指（送給 process 的通知）');
    await W(tok, 3200);
  }
  async function scVector(tok) {
    fresh([0, 6, 14.5], [0, 2.6, 0]);
    const cd = code(['x = a + b;', 'y = x * 2;', 'z = y - 1;', 'print(z);'], -4.8, 5.4, 0.55);
    const pc = cube('PC', COL.gold, [0.7, 0.4, 0.4], -6.6, 5.4, 0);
    tag('interrupt vector：array of function pointers（每格 4 bytes）', 'ptr', 1.6, 6.3);
    const V = ['divide_error', 'timer', 'keyboard', 'mouse', 'disk'].map((n, i) => { tag('[' + i + ']', 'idx', -1.9, 5.6 - i * 0.55); return cube('→ ' + n + '_handler', '#e9dcc4', [3.6, 0.45, 0.8], 1.6, 5.6 - i * 0.55, 0); });
    const isr = cube('mouse service routine', COL.os, [3, 0.8, 1], 5.2, 1.2, 0);
    const saved = tag('', 'ptr alt', -4.8, 2.2);
    say('程式正在執行', '');
    for (let i = 0; i < 2; i++) { cd.hl(i); move(pc, -6.6, 5.4 - i * 0.55, 0); await W(tok, 900); }
    const sig = cube('signal #3', COL.bad, [1.4, 0.45, 0.5], -1, 0.4, 1.2);
    say('滑鼠動了：hardware 偵測到 signal #3', '不管執行到哪一行，直接打斷');
    await W(tok, 1800);
    txt(saved, '記下：被打斷的程式、PC = 第 2 行');
    say('先記下被打斷者的 address（PC）', '之後才回得來');
    await W(tok, 2000);
    move(sig, -2.4, 5.6 - 3 * 0.55, 1.2); glow(V[3], GOLD);
    say('用 signal number 查 vector 第 3 格', '每格只放一個 function pointer，大小固定');
    await W(tok, 2200);
    move(sig, 5.2, 1.9, 1.2); glow(isr, GOLD);
    say('跳到 service routine 真正處理', '裝 driver = 改寫那一格的 pointer');
    await W(tok, 2400);
    glow(isr, null); glow(V[3], null); kill(sig);
    cd.hl(2); move(pc, -6.6, 5.4 - 2 * 0.55, 0); txt(saved, '');
    say('做完 return：restore PC，從第 2 行接著跑', '欄位跟硬體綁死：主機板決定有哪些 signal number');
    await W(tok, 3200);
  }
  async function scTrapSwitch(tok) {
    fresh([0, 6, 14.5], [0, 2.6, 0]);
    const cd = code(['fd = open("a.txt");', 'write(fd, buf, n);', 'close(fd);'], -4.6, 5.4, 0.6);
    const cs = code(['switch (syscall_no) {', '  case 0: sys_exit();  break;', '  case 1: sys_write(); break;', '  case 2: sys_read();  break;', '  case 3: sys_open();  break;', '  …（可再加）', '}'], 3.2, 5.6, 0.5);
    tag('OS 裡的 system call 處理', 'ptr', 3.2, 6.3);
    const mode = cube('user mode', COL.user, [2.2, 0.6, 1], -4.6, 2.2, 0);
    say('Software interrupt：程式主動 call system call', '');
    cd.hl(1); await W(tok, 1800);
    const t = cube('trap #1', COL.bad, [1.2, 0.45, 0.5], -4.6, 4.6, 1); move(t, 0.4, 4.6, 1);
    tint(mode, COL.os); relabel(mode, 'kernel mode');
    say('記下 return address，trap 進 OS', '跟 hardware 流程一樣');
    await W(tok, 2000);
    cs.hl(2); move(t, 3.2, 4.6, 1);
    say('依 system call number 用 switch-case 找', '不是固定 array：軟體可以定義任意多個');
    await W(tok, 2600);
    cs.hl(5);
    say('可以 load kernel module 新增 system call', 'Linux 一兩百個、有的 OS 上千個都行');
    await W(tok, 2400);
    cs.hl(-1); move(t, -4.6, 4.6, 1); await W(tok, 900); kill(t);
    tint(mode, COL.user); relabel(mode, 'user mode'); cd.hl(2);
    say('return 回到剛剛 call system call 的人', 'hardware：interrupt vector　software：switch-case');
    await W(tok, 3200);
  }
  async function scMask(tok) {
    fresh([0, 5.5, 14], [0, 2.2, 0]);
    const h = cube('disk interrupt handler 執行中', COL.os, [4.4, 1, 1.2], 0, 0.5, 0);
    const pr = tag('', 'ptr alt', 0, 1.6);
    say('handler 跑到一半又被 interrupt 怎麼辦？', '狀態沒存好 → 回不去原本的樣子');
    await W(tok, 2600);
    say('Linux 這類 OS：處理中先 disable interrupt', 'service routine 用 assembly 寫，要非常快');
    txt(pr, 'interrupts disabled');
    for (let k = 0; k < 3; k++) {
      const s = cube('滑鼠 signal', COL.cpu, [1.6, 0.45, 0.6], -6, 3, 0); move(s, -2.6, 1.2, 0);
      await W(tok, 700); fly(s, V3(-4, 6, 3));
      say('後來的 signal 被忽略', '「動滑鼠怎麼沒反應？」可能卡在某個 routine');
      await W(tok, 700);
    }
    txt(pr, '');
    say('更進一步：interrupt 分 priority', '高 priority 執行時，低 priority 被 mask 掉');
    const hi = cube('高：power fail', COL.bad, [2.4, 0.5, 0.7], 5, 3, 0); move(hi, 2.6, 1.3, 0);
    await W(tok, 900); glow(h, RED); relabel(h, '高 priority handler 先處理');
    await W(tok, 2600);
    say('重點：vector、routine、存下被打斷的 PC', '中斷可以 mask（遮蔽）');
    await W(tok, 3000);
  }

  // ─── 7z3hoaide-4（第 4B 講）：storage hierarchy ───
  async function scHierarchy(tok) {
    enterStorage(); controls('');
    say('儲存是 hierarchical：越上越快、越下越大', '');
    for (let i = 0; i < TIERS.length; i++) { st.sel = i; stSel(); say(TIERS[i].n + '：' + TIERS[i].t, i === 5 ? 'tape 便宜、容量大、不容易壞：大型系統最後一層仍是 tape' : i === 3 ? 'flash / NVM 等新技術插在中間' : ''); await W(tok, 1500); }
    say('三個因素：速度、價錢、volatile', '錢再多也不會全用最快的：hierarchy 的效益最好');
    await W(tok, 2600);
    await stPower(false);
    say('斷電：memory 以上全部消失（volatile）', 'system crash 時資料就沒了');
    await W(tok, 2600);
    await stPower(true);
    say('每層多大、放什麼資料，看設計功力', '設計不好，裝很多 memory 也不會變快');
    await W(tok, 2600);
  }
  async function scMemBoundary(tok) {
    enterStorage(); controls('');
    st.sel = 2; stSel();
    say('最重要的分隔點：main memory', 'von Neumann：CPU、memory、I/O');
    await W(tok, 2400);
    say('CPU 只能直接存取 memory', 'memory 以下統稱 secondary storage');
    await W(tok, 2200);
    await stLoad(tok);
    say('register、cache 只是 copy，以 memory 上的為準', '要讀 disk 上的資料 → 先搬進 memory');
    await W(tok, 2600);
    say('所以 hard real-time 不用 secondary storage', '搬移 copy 太花時間，也不好掌握');
    await W(tok, 2800);
  }
  async function scDramSram(tok) {
    fresh([0, 5, 13.5], [0, 2, 0]);
    tag('DRAM', 'ptr', -3.4, 4.6); tag('SRAM', 'ptr alt', 3.4, 4.6);
    say('RAM 依製程分成 DRAM 和 SRAM', '');
    const d = cube('1 transistor', '#c08a1f', [1.2, 1.2, 1.2], -3.4, 0.6, 0, 3);
    const s = []; for (let k = 0; k < 6; k++) s.push(cube('', '#dd8238', [0.6, 0.6, 0.6], 2.8 + (k % 3) * 0.6, 0.3 + Math.floor(k / 3) * 0.6, 0, 3 + k * 0.3));
    tag('多個 transistor', 'idx', 3.4, 1.6, 0.8);
    await W(tok, 1800);
    say('DRAM：小、便宜、省電，但比較慢', '→ main memory');
    tag('main memory', 'ptr', -3.4, 2.2); await W(tok, 2200);
    say('SRAM：快，但大、耗電、貴', '→ cache（L1、L2、L3）甚至 register');
    tag('cache', 'ptr alt', 3.4, 2.6); await W(tok, 2200);
    say('多核心搶著讀 memory：bus 才是瓶頸', '買 RAM 看到的 DDR 幾代，就是在改進 bus');
    await W(tok, 2800);
    say('Random access：讀任何位置的時間都一樣', 'disk 不是：讀寫位置不同，時間不同');
    const cells = []; for (let k = 0; k < 8; k++) cells.push(cube('', '#e9dcc4', [0.55, 0.3, 0.55], -2.1 + k * 0.6, 3.4, 0));
    for (const k of [0, 6, 2, 7]) { glow(cells[k], GOLD); await W(tok, 450); glow(cells[k], null); }
    await W(tok, 2200);
    void d; void s;
  }

  // ─── 9vrPlp_f5A0（第 5A 講）＋3PfL2WIS22o（第 1A 講）：Nachos ───
  async function scNachosVm(tok) {
    fresh([0, 6, 14], [0, 2.6, 0]);
    const L = [['user program（C++，include syscall.h）', COL.user, 5.2], ['MIPS binary（Nachos 的 compiler 產生）', '#b6e4cf', 4.2], ['Nachos kernel（真正的 OS 程式）', COL.os, 3.2], ['machine simulation：模擬 MIPS CPU', '#b9a4f7', 2.2], ['Linux（x86）', COL.cpu, 1.2], ['實體硬體（x86）', '#8a7a5c', 0.3]];
    say('Nachos：跑在 Linux 上的教學用 OS', '本身就是某種 virtual machine');
    await W(tok, 2400);
    const M = [];
    for (const [n, c, y] of L) { M.push(cube(n, c, [7.4, 0.7, 1.2], 0, y, 0, 3)); await W(tok, 700); }
    say('user program 被 compile 成 MIPS 指令', '不是 x86：所以一定要用 Nachos 的 compile 指令');
    glow(M[1], GOLD); await W(tok, 2400); glow(M[1], null);
    const ins = cube('MIPS 指令', COL.gold, [1.4, 0.4, 0.5], 4.6, 4.2, 0.8);
    say('machine simulation 把 MIPS 翻成 x86 指令', 'instruction set translation');
    move(ins, 4.6, 2.2, 0.8); await W(tok, 1400);
    relabel(ins, 'x86 指令'); move(ins, 4.6, 0.3, 0.8);
    say('真正執行的是下面那顆真實 CPU', '讓你以為有一台 MIPS 機器在跑');
    await W(tok, 2600);
    say('gcc 編的程式 Nachos 看不懂，反之亦然', 'Nachos 沒實作的部分丟給下面的 Linux');
    await W(tok, 3000);
  }
  async function scNachosFolders(tok) {
    fresh([0, 5, 14], [0, 2, 0]);
    const F = [['lib/', '內部 utility：不用理', COL.idle, ''], ['machine/', '模擬的硬體', '#b9a4f7', '作業一加一行 signal'], ['threads/', '把整個 OS 跑起來', COL.cpu, ''], ['test/', 'user program 放這裡', COL.user, '編譯、執行'], ['userprog/', 'OS 的主要程式碼', COL.os, '作業一：system call'], ['filesys/', 'file system', COL.io, '作業四'], ['network/', 'socket、TCP/IP 模擬', COL.idle, '本課不碰']];
    say('打開 Nachos：一堆資料夾，先懂 code structure', 'trace code 不是從第一個檔案第一行看起');
    await W(tok, 2400);
    const ms = F.map(([n], i) => cube(n, '#e9dcc4', [1.7, 0.8, 1.2], -5.4 + i * 1.8, 0.4, 0, 3));
    await W(tok, 1400);
    for (let i = 0; i < F.length; i++) {
      tint(ms[i], F[i][2]); move(ms[i], -5.4 + i * 1.8, 1.0, 0);
      tag(F[i][1], 'idx', -5.4 + i * 1.8, i % 2 ? 2.2 : 2.8);
      say(F[i][0] + '：' + F[i][1], F[i][3]);
      await W(tok, 1600);
    }
    say('改 machine/ = 在主機板上動手腳（hardware）', '改 userprog/ = 改作業系統（software）');
    await W(tok, 3000);
  }
  async function scNachosStub(tok) {
    fresh([0, 6, 14], [0, 2.4, 0]);
    const up = cube('user program：Open("a.txt")', COL.user, [3.6, 0.7, 1], -3.6, 5, 0);
    const sc = cube('Nachos system call', COL.os, [3.2, 0.7, 1], -3.6, 3.6, 0);
    const stub = cube('file system stub', '#b9a4f7', [3.2, 0.7, 1], -3.6, 2.2, 0);
    const lfs = cube('Linux 的 file system', COL.cpu, [3.6, 0.9, 1.2], 3.4, 0.6, 0);
    const real = cube('real file system（作業四才實作）', '#efe6d6', [3.6, 0.7, 1], 3.4, 3.6, 0);
    say('作業一：把 Open / Close 的 system call 接起來', '');
    await W(tok, 2200);
    const r = cube('Open', COL.gold, [1, 0.4, 0.5], -3.6, 5, 0.8);
    for (const [x, y, s] of [[-3.6, 3.6, 'trap 進 Nachos kernel'], [-3.6, 2.2, '還沒有真的 file system → stub'], [3.4, 0.9, 'stub 直接 forward 給下面 Linux 處理']]) { move(r, x, y, 0.8); say(s, ''); await W(tok, 1600); }
    say('所以 Nachos 看到的檔案 = server 上看到的', '真正的 OS 不能依賴另一個 OS');
    await W(tok, 2600);
    kill(r);
    const pf = cube('printf（standard I/O）', COL.bad, [2.6, 0.5, 0.7], -3.6, 5.9, 0.8); move(pf, 3.4, 1.6, 0.8);
    say('小心：直接用 printf 根本沒經過 Nachos', '要看 Nachos 的 counter 才確定是它做的');
    await W(tok, 3200);
    void up; void sc; void stub; void lfs; void real;
  }

  // ─── HA96JKO9znE（第 5B 講）：OS services、CLI/shell、communication ───
  async function scServices(tok) {
    fresh([0, 5.5, 14], [0, 2.4, 0]);
    const os = cube('OS', COL.os, [2.4, 1.2, 1.4], 0, 0.6, 0);
    tag('幫使用者', 'ptr', -4.2, 5.2); tag('讓系統有效率、安全', 'ptr alt', 4.2, 5.2);
    say('OS 透過 system call 提供 service', '');
    await W(tok, 2200);
    const U = ['user interface', 'program execution', 'I/O operations', 'file system', 'communication', 'error detection'];
    const S = ['resource allocation', 'accounting', 'protection & security'];
    for (let i = 0; i < U.length; i++) { cube(U[i], COL.user, [2.6, 0.5, 0.9], -4.2, 0.3 + i * 0.6, 0, 3); await W(tok, 450); }
    say('左邊：程式執行、I/O、檔案… 後面每章各講一個', '');
    await W(tok, 1600);
    for (let i = 0; i < S.length; i++) { cube(S[i], COL.io, [2.8, 0.5, 0.9], 4.2, 0.3 + i * 0.6, 0, 3); await W(tok, 500); }
    say('Accounting：記錄每個程式用了多少資源', '例：一個 process 最多 4 GB memory、開檔數有上限');
    await W(tok, 2600);
    say('Protection & security：帳號密碼、擋惡意程式', 'administrator 才能改 limit');
    await W(tok, 2600);
    void os;
  }
  async function scShell(tok) {
    fresh([0, 5.5, 14], [0, 2.4, 0]);
    const user = cube('使用者', COL.user, [1.6, 0.8, 1], -5.2, 5, 0);
    const shell = cube('shell（bash / csh）', COL.gold, [3, 0.8, 1.2], -1.4, 3.6, 0);
    const os = cube('OS（system call）', COL.os, [3.4, 0.9, 1.2], 2.6, 1.8, 0);
    const gui = cube('GUI', '#e55a9b', [2.2, 0.6, 1], -1.4, 5.2, 0);
    tag('OS 外面的一層，不屬於 OS', 'idx', -1.4, 2.8);
    say('CLI：下指令；提供這個介面的程式叫 shell', '');
    await W(tok, 2200);
    const c = cube('dir', COL.cpu, [0.9, 0.4, 0.5], -5.2, 5.6, 0.8);
    say('習慣 Windows 的人打 dir', '');
    await W(tok, 1200);
    move(c, -1.4, 4.3, 0.8); await W(tok, 1200);
    relabel(c, 'ls');
    say('shell 設定 alias：dir → ls', '每個使用者有自己的 shell 設定（顏色、別名…）');
    await W(tok, 2400);
    move(c, 2.6, 2.6, 0.8);
    say('真正交給 OS 的是同一個 ls', 'system call 的定義大家都一樣、不能隨意改');
    await W(tok, 2400);
    say('GUI 疊在 CLI 上面：方便，但較慢、受限', '自動化、把工具串在一起靠 CLI');
    glow(gui, GOLD);
    await W(tok, 3000);
    void user; void shell; void os;
  }
  async function scIpcModels(tok) {
    fresh([0, 6, 14], [0, 2.4, 0]);
    tag('Message passing', 'ptr', -3.6, 6); tag('Shared memory', 'ptr alt', 3.6, 6);
    const pa = cube('process A', JOBC[0], [2, 0.8, 1], -5, 4.4, 0), pb = cube('process B', JOBC[1], [2, 0.8, 1], -2.2, 4.4, 0);
    const k1 = cube('kernel', COL.os, [4.8, 0.8, 1.2], -3.6, 1.4, 0);
    say('溝通 = 交換 memory 內容', '兩大類');
    await W(tok, 2400);
    const m = cube('M', COL.gold, [0.6, 0.45, 0.5], -5, 5.1, 0.8);
    say('A 不能直接寫進 B 的 memory（protection）', 'base / limit 擋著');
    await W(tok, 1800);
    move(m, -3.6, 2.1, 0.8); say('第 1 次 copy：A → kernel（system call）', '像寄 email'); await W(tok, 1600);
    move(m, -2.2, 5.1, 0.8); say('第 2 次 copy：kernel → B', 'copy 多，所以慢；跨電腦就是 socket / TCP/IP'); await W(tok, 2400);
    const qa = cube('process A', JOBC[0], [2, 0.8, 1], 2.2, 4.4, 0), qb = cube('process B', JOBC[1], [2, 0.8, 1], 5, 4.4, 0);
    const k2 = cube('kernel', COL.os, [4.8, 0.8, 1.2], 3.6, 1.4, 0);
    say('Shared memory：先用 system call 建一塊共用區', 'process 之間 by default 不存在');
    const sh = cube('shared', COL.gold, [2.2, 0.6, 1], 3.6, 2.9, 0, 3);
    await W(tok, 2200);
    for (let k = 0; k < 2; k++) { glow(qa, GOLD); arrow(2.6, 4.0, 3.2, 3.2, COL.gold); await W(tok, 700); glow(qa, null); glow(qb, GOLD); arrow(4.6, 4.0, 4.0, 3.2, '#4b9ee2'); await W(tok, 700); glow(qb, null); }
    say('之後直接讀寫，不用 copy：快', 'threads 之間 by default 就共用');
    await W(tok, 2400);
    glow(sh, RED);
    say('代價：同時讀寫 → synchronization、deadlock', '兩種都要先經過 OS');
    await W(tok, 3000);
    void pa; void pb; void k1; void k2;
  }

  // ─── 課本補充（影片未涵蓋或未轉錄）：dual mode、system call 流程、OS 結構、DMA ───
  async function scDualMode(tok) {
    enterDual(); controls('');
    say('課本：硬體提供 mode bit', '1 = user mode、0 = kernel mode');
    await W(tok, 2600);
    for (const id of ['add', 'io']) { await dualExec(INSTR.find((s) => s.id === id)); say(id === 'add' ? '一般指令：user mode 可以執行' : '特權指令在 user mode → trap 給 OS', id === 'io' ? 'I/O、set timer、關中斷都是特權指令' : ''); await W(tok, 2200); }
    await dualSys(); say('system call：trap 讓 mode bit 變 0', '進入 kernel 的唯一合法入口'); await W(tok, 2200);
    await dualExec(INSTR.find((s) => s.id === 'io')); say('kernel mode 才能執行特權指令', ''); await W(tok, 2000);
    await dualRet(); say('return 前把 mode bit 設回 1', ''); await W(tok, 2000);
    say('Timer：防止 user program 無窮迴圈霸佔 CPU', '時間到 → interrupt → OS 拿回控制權');
    await W(tok, 3000);
  }
  async function scSyscallFlow(tok) {
    fresh([0, 6, 14], [0, 2.6, 0]);
    // 恐龍書 Fig. 2.6：The handling of a user application invoking the open() system call
    ctx.tile(V3(0, 0.04, -0.4), 13, 0.9, '#efe6d6');
    const app = cube('user application：open()', COL.user, [3.6, 0.7, 1], -3.6, 5.6, 0);
    const api = cube('API（libc 的 open()）', '#b6e4cf', [3.6, 0.7, 1], -3.6, 4.4, 0);
    const sci = cube('system call interface', COL.gold, [3.6, 0.7, 1], 0, 3.0, 0);
    line(-6.5, 3.75, 0, 6.5, 3.75, 0, '#8a7a5c'); tag('user mode ↑　kernel mode ↓', 'idx', 4.9, 4.0);
    const tbl = ['0', '1', '…', 'i', '…'].map((n, k) => cube(n, '#e9dcc4', [0.6, 0.45, 0.8], 2.6 + k * 0.65, 2.1, 0));
    const impl = cube('open() 的實作', COL.os, [3, 0.8, 1], 3.9, 0.6, 0);
    const mode = tag('mode bit = 1', 'ptr', -5.4, 1.6);
    say('程式設計師用的是 API，不是直接用 system call', '例：Win32、POSIX、Java API');
    await W(tok, 2600);
    const r = cube('open', COL.cpu, [0.9, 0.4, 0.5], -0.3, 5.6, 0.8);
    move(r, -0.3, 4.4, 0.8); say('API 函式幫你準備參數、放 system call number', '可移植：換平台不用改程式'); await W(tok, 2200);
    move(r, 2.9, 3.0, 0.8); txt(mode, 'mode bit = 0'); say('trap 進 kernel：system call interface', 'mode bit 1 → 0'); await W(tok, 2200);
    glow(tbl[3], GOLD); move(r, 2.6 + 3 * 0.65, 2.75, 0.8); say('用 number i 查 system call table', ''); await W(tok, 1800);
    move(r, 6.1, 0.6, 0.8); glow(impl, GOLD); say('執行 kernel 裡的 open()', '參數：放 register、放 memory block 傳位址、或 push stack'); await W(tok, 2600);
    glow(impl, null); glow(tbl[3], null);
    move(r, -0.3, 5.6, 0.8); txt(mode, 'mode bit = 1'); say('回傳 status / fd，mode bit 回到 1', 'API ≠ system call'); await W(tok, 3000);
    void app; void api; void sci;
  }
  async function scStructures(tok) {
    for (const k of ['mono', 'layer', 'micro', 'module']) {
      so.kind = k; enterStruct(); controls('');
      say(STRUCT[k].name, STRUCT[k].note);
      await W(tok, 1800);
      await structCall(tok);
      if (k === 'micro' || k === 'mono') { await structCrash(tok); say(k === 'micro' ? 'server 掛了，kernel 照常' : '一個服務出錯，整個 kernel 跟著倒', ''); }
      await W(tok, 1800);
    }
  }
  async function scDma(tok) {
    fresh([0, 5.5, 14], [0, 2, 0]);
    const cpu = cube('CPU', COL.cpu, [1.8, 1, 1.2], -5, 0.5, 0);
    const mem = cube('memory', COL.mem, [2.4, 1, 1.2], -1.4, 0.5, 0);
    const dma = cube('DMA controller', COL.os, [2.4, 1, 1.2], 2.2, 0.5, 0);
    const disk = cube('disk', COL.disk, [1.6, 1, 1.2], 5.4, 0.5, 0);
    const cnt = tag('', 'ptr alt', -5, 1.6);
    say('課本：一個 byte 一個 interrupt，大量資料時太多', '例：搬一個 block 共 8 個 word');
    await W(tok, 2400);
    let n = 0;
    for (let k = 0; k < 4; k++) { const d = cube('', COL.disk, [0.35, 0.3, 0.4], 5.4, 1.2, 0.8); move(d, -1.4 + (k - 2) * 0.4, 1.2, 0.8); n++; txt(cnt, 'interrupt ' + n + ' 次'); glow(cpu, RED); await W(tok, 450); glow(cpu, null); await W(tok, 200); }
    say('每個 word 都打斷 CPU 一次', '');
    await W(tok, 1600);
    say('DMA：CPU 只交代「來源、目的、長度」', 'controller 直接把整個 block 搬進 memory');
    n = 0; txt(cnt, '');
    const c = cube('src, dst, 8', COL.gold, [1.4, 0.35, 0.5], -5, 1.4, -0.8); move(c, 2.2, 1.4, -0.8); await W(tok, 1200); kill(c);
    for (let k = 0; k < 8; k++) { const d = cube('', COL.disk, [0.35, 0.3, 0.4], 5.4, 1.2, -0.8); move(d, -1.4 + (k - 4) * 0.35, 1.5, -0.8); glow(cpu, k % 2 ? GREEN : null); txt(cnt, 'CPU 在算別的'); await W(tok, 300); }
    const s = cube('interrupt', COL.bad, [1.3, 0.4, 0.5], 2.2, 2.2, 0); move(s, -5, 2.2, 0);
    txt(cnt, 'interrupt 1 次');
    say('整個 block 搬完才 interrupt 一次', 'DMA 用 memory bus 時 CPU 偶爾要讓（cycle stealing）');
    await W(tok, 3200);
    void mem; void dma; void disk;
  }

  const scenes = {
    'batch-idle': { title: 'Batch：一次一個 job，I/O 時 CPU idle', play: scBatch },
    'multiprog-overlap': { title: 'Multiprogramming：CPU 與 I/O overlap', play: scMultiprog },
    'spooling': { title: 'Spooling：I/O 做完再 notify CPU', play: scSpooling },
    'job-cpu-sched': { title: 'Job scheduling 與 CPU scheduling', play: scJobCpuSched },
    'time-sharing': { title: 'Time sharing：time slot 輪流、可互動', play: scTimeSharing },
    'ts-needs': { title: 'Time sharing 帶出的問題：VM、檔案、同步、死鎖', play: scTsNeeds },
    'os-generations': { title: 'Batch / Multiprogramming / Time sharing 的目的', play: scGenerations },
    'realtime-edf': { title: 'Real-time：deadline 與 EDF', play: scRealtimeEdf },
    'hard-soft-rt': { title: 'Soft vs Hard real-time', play: scHardSoft },
    'special-systems': { title: 'Multimedia、Handheld、Cloud、IoT', play: scSpecial },
    'controller-buffer': { title: 'Device controller 與 buffer', play: scController },
    'busy-wait': { title: 'Busy-wait：CPU 一直 peek status', play: scBusyWait },
    'interrupt-timeline': { title: 'Interrupt timeline：CPU 與 I/O 同時運作', play: scIntrTimeline },
    'interrupt-io-flow': { title: 'Interrupt I/O：A 等 I/O、B 用 CPU', play: scIntrFlow },
    'signal-vs-trap': { title: 'Hardware interrupt（signal）vs Software（trap）', play: scSignalTrap },
    'interrupt-vector': { title: 'Interrupt vector → service routine → return', play: scVector },
    'trap-switch': { title: 'System call：trap 與 switch-case', play: scTrapSwitch },
    'interrupt-mask': { title: '中斷中又中斷：disable 與 priority mask', play: scMask },
    'storage-hierarchy': { title: '儲存階層：速度、價錢、volatile', play: scHierarchy },
    'memory-boundary': { title: 'Main memory：CPU 能直接存取的最後一層', play: scMemBoundary },
    'dram-sram': { title: 'DRAM vs SRAM、random access', play: scDramSram },
    'nachos-vm': { title: 'Nachos：MIPS 模擬機跑在 Linux 上', play: scNachosVm },
    'nachos-folders': { title: 'Nachos 的資料夾結構', play: scNachosFolders },
    'nachos-fs-stub': { title: 'Nachos 的 file system stub', play: scNachosStub },
    'os-services': { title: 'OS services 一覽', play: scServices },
    'shell-layer': { title: 'CLI、shell 與 alias', play: scShell },
    'ipc-two-models': { title: 'Message passing vs Shared memory', play: scIpcModels },
    'dual-mode': { title: '課本：Dual mode 與特權指令', play: scDualMode },
    'syscall-flow': { title: '課本：open() 的 API → system call 流程', play: scSyscallFlow },
    'os-structures': { title: '課本：Monolithic / Layered / Microkernel / Modules', play: scStructures },
    'dma': { title: '課本：DMA 一個 block 一次 interrupt', play: scDma },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ osA.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
// ─── 作業系統 第 1 章（周志遠 第 1A–3A 講、Neso System Calls）— cued scenes ───
// Every `await step(tok)` waits until the lecturer says that sentence (notes "cues");
// between steps only short moves (≤ ~2.5 s); nothing loops or replays.
// 例子都照老師講的（主管與屬下、搬 1 GB 檔案、寫作業的 EDF、串流影片、車子＝四個輪子的電腦…）；
// 動畫自己補的數字一律標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const idx = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const txt = (l, t) => { l.element.textContent = t; };
const blk = (t, c, x, y, z = 0, w = 1.6, h = 0.6, d = 0.9, drop = 0) => cube(t, c, [w, h, d], x, y, z, drop);
const pal = (name, v, color, x, z = 0, s = 0.8) => buddy(name, v, color, x, 0, z, s);
const gone = (...os) => os.forEach((o) => { if (o) kill(o.g || o); });
// a bag of things on stage that leave together
function bag() { const a = []; const f = (o) => (a.push(o), o); f.clear = () => { a.forEach((o) => { if (!o) return; if (o.g) kill(o.g); else if (o.isObject3D) kill(o); else if (o.kill) o.kill(); }); a.length = 0; }; return f; }
async function slide(tok, o, x, y, z = 0, ms = 600) { await travel(tok, o, o.position.clone(), V3(x, y, z), ms); }
// a label that flies from a to b and stays (or vanishes when keep = false)
async function send(tok, text, cls, a, b, ms = 700, keep = false) { const l = tag(text, cls, a.x, a.y, a.z); await travel(tok, l, a, b, ms); if (!keep) kill(l); return l; }
// a little "says" bubble above a buddy
const talk = (b, t, dy = 0.75) => tag(t, 'say', b.g.position.x, b.g.position.y + 1.9 * (b.body.scale.y || 1) + dy, b.g.position.z);

// ════════ 3PfL2WIS22o（第 1A 講：課本與 Nachos 作業） ════════
// 6:50 四個作業：修改一個教學用、模擬的 OS
FRAG.push(['osA-nachos', 'Nachos：教學用的模擬 OS', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 2.2, 0]);
  await step(tok);                                   // 410 four programming assignments
  const nac = buddy('Nachos', 'OS', '#9b7ef4', 0, 0, 0, 1.3);
  const hw = [0, 1, 2, 3].map((k) => pkt('作業 ' + (k + 1), -4.5 + k * 3, 5.6));
  say('四個程式作業：修改一個模擬的 OS', '');
  for (const h of hw) { await travel(tok, h, h.position.clone(), V3(0, 2.6, 0), 350); kill(h); }
  nac.mood('wow');
  await step(tok);                                   // 417.6 for education
  note('simulated・for education', 0, 3.7);
  say('純粹為了「上課教學」開發的 OS', '模擬的，但該有的都有');
  await step(tok);                                   // 423 it is called Nachos — not the chips
  bub('Nachos ≠ 墨西哥玉米片 😄', 3.4, 3.2);
  nac.mood('happy'); await nac.hop(tok);
  say('這個 OS 叫做 Nachos', '全名跟 OS 有關，縮寫好念');
  await step(tok);                                   // 441 used by universities abroad and at home
  const L = [['國外知名大學', -5, 1.2], ['國內重要學校', 5, 1.2]];
  for (const [t, x, y] of L) { const s = pal('', '🏫', '#e9dcc4', x, 0, 0.75); hd(t, x, y + 0.6); s.mood('happy'); }
  say('很多大學都拿 Nachos 當教材', '公認很好的 OS 教學軟體');
  await step(tok);                                   // 464 lots of material — search in English
  note('查資料：用英文查', -4.2, 4.6);
  say('相關資料很多：用英文 Google', '中文大概查不到');
  await step(tok);                                   // 497 file system added last year; main components all there
  ['threads', 'userprog', 'filesys'].forEach((t, k) => blk(t, ['#4b9ee2', '#2fc092', '#dd8238'][k], -1.8 + k * 1.8, 0.35, 2.2, 1.6, 0.5, 0.8, 2));
  say('主要的 component 都有了', '去年加了 file system');
  await step(tok);                                   // 544 demo: the TA asks both teammates
  const ta = pal('助教', '?', '#c08a1f', 5.2, 2.6, 0.7);
  bub('兩位組員都要回答', 5.2, 2.9, 2.6);
  ta.mood('wow');
  bad('只找答案 ✗　自己寫、自己懂 ✓', -3.6, 3.2, 2.2);
  say('Demo 時助教會問兩位組員', '分數看貢獻度與回答，不是同組同分');
}]);

// 9:35 C++、Linux 的 command line
FRAG.push(['osA-env', '作業環境：C++ 與 Linux command line', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 2.2, 0]);
  const A = bag();
  await step(tok);                                   // 578 the code is C++
  hd('挑戰 1：程式是 C++', -3.6, 6);
  A(note('C', -5.9, 4.6)); A(note('物件導向（OO）', -2.9, 4.6));
  say('Nachos 是用 C++ 寫的', '');
  await step(tok);                                   // 593 C background + OO idea = C++
  const plus = A(tag('＋', '', -5.1, 4.6));
  await send(tok, 'C++', 'pkt', V3(-4.2, 4.6, 0), V3(-3.6, 3.5, 0), 600, true);
  say('會 C ＋ 物件導向的觀念 ＝ C++', '問題應該不大');
  void plus;
  await step(tok);                                   // 624.5 second: Linux coding environment
  hd('挑戰 2：Linux 開發環境', 3.6, 6);
  const mon = prop('monitor', 3.6, 0.2, 0, 1.6);
  const sh = code(['$ ls', '$ make', '$ ./nachos'], 3.6, 2.4, 0.42, 0.3);
  say('開發環境是 Linux 的 command line', '');
  await step(tok);                                   // 629 many only used Visual Studio GUI
  const gui = A(bad('GUI 點點點（Visual Studio）', -3.6, 2.4));
  say('以前多半用 Visual Studio 這種 GUI', '');
  await step(tok);                                   // 639.7 OS course → Linux, open source
  A.clear(); kill(gui);
  const lin = pal('Linux', '🐧', '#2fc092', -4.6, 0, 1);
  lin.mood('happy');
  good('open source：可以改、可以動', -4.6, 2.4);
  say('OS 課當然用 Linux：它是 open source', '');
  await step(tok);                                   // 647 Windows is commercial, wrapped up
  const win = pal('Windows', '🔒', '#4b9ee2', -1.6, 0, 0.9);
  bub('commercial、包起來', -1.6, 2.2);
  say('Windows 是商業產品，包得好好的', 'user friendly，但看不到裡面');
  await step(tok);                                   // 669 code tracing, files, compile, run, debug — by command
  sh.hl(0); await wt(tok, 300); sh.hl(1); await wt(tok, 300); sh.hl(2);
  say('用指令做：trace、檔案、compile、執行、debug', '不是用滑鼠點');
  await step(tok);                                   // 700 closer to the OS: you feel what it does
  glow(mon.children[1], GREEN);
  bub('下指令 → 感受 OS 在背後做事', 3.6, 3.3);
  say('指令更貼近 OS 本身', '能感受到指令背後 OS 在做的事');
  await step(tok);                                   // 742 jobs later use this environment too
  note('未來工作也是這種環境', 0, 4.8);
  lin.mood('wow'); win.mood('calm');
  say('未來工作也常在這種環境', '在學校就先熟悉');
}]);

// 12:45 code tracing
FRAG.push(['osA-trace', 'Code tracing：先懂架構再動手改', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 2.2, 0]);
  const A = bag();
  await step(tok);                                   // 765 last one: code tracing
  hd('挑戰 3：code tracing', 0, 6.2);
  say('最後一個特別的挑戰：code tracing', '');
  await step(tok);                                   // 769.8 previous homework: from main
  const me = A(pal('你', '', '#e55a9b', -4.6, 0, 0.9));
  const mine = A(code(['int main() {', '  …', '  // 1000 行', '}'], -1.6, 3.4, 0.42));
  say('以前的作業：從 main 開始自己寫', '寫了一千行就很了不起');
  me.mood('happy');
  await step(tok);                                   // 786.6 real programs: tens of thousands of lines
  for (let k = 0; k < 5; k++) A(blk('', '#e9dcc4', 2.2 + (k % 3) * 1.4, 0.35 + Math.floor(k / 3) * 0.65, 0, 1.2, 0.6, 0.9, 1.5 + k * 0.3));
  A(hot('幾萬、幾十萬行', 3.6, 2.4));
  me.mood('wow');
  say('真實世界的程式：幾萬、幾十萬行', '不可能自己從頭寫');
  await step(tok);                                   // 811 mostly modifying others' code
  bub('多半是「修改別人的程式」', -4.6, 2.4);
  say('未來寫程式，多半是在改別人的程式', '');
  await step(tok);                                   // 814 first understand its architecture
  mine.kill(); A.clear();
  const F = ['threads/', 'machine/', 'userprog/', 'filesys/'].map((n, k) => blk(n, '#e9dcc4', -4.8 + k * 3.2, 0.35, 0, 2.2, 0.6, 1));
  say('先看懂別人的程式架構', '我要做的事在整個程式的哪一塊？');
  await step(tok);                                   // 822.8 after changing, it won't compile → figure out why
  glow(F[2], RED);
  bad('改完連 compile 都過不了？', 1.6, 1.6);
  say('改完不能 compile，要找得出原因', '');
  await step(tok);                                   // 843 the parts to change are in several files
  glow(F[2], null);
  [0, 2, 3].forEach((k) => glow(F[k], GOLD));
  say('要改的部分，散在好幾個檔案', '');
  await step(tok);                                   // 853 code path: order of files and functions
  for (const [a, b] of [[0, 2], [2, 3]]) { const h = arrow(V3(-4.8 + a * 3.2 + 1.1, 0.75, 0.4), V3(-4.8 + b * 3.2 - 1.1, 0.75, 0.4), 0x8a5a00); A(h); await wt(tok, 300); }
  hot('code path', 0, 2.6);
  say('code path：檔案、function 的呼叫順序', '一處改了，其他地方也要跟著調');
  await step(tok);                                   // 868 first work item: trace how it is implemented now
  note('作業第一步：先 trace 目前的實作', 0, 4.4);
  say('每個作業第一步：先 trace 現在怎麼做的', '');
  await step(tok);                                   // 883 then decide what to change; debug with printf
  pkt('printf', 4.6, 2.5);
  say('trace 完才判斷要改哪一塊', '再用 printf 這類基本方式 debug');
  await step(tok);                                   // 928 a chance to debug other people's code
  F.forEach((m) => glow(m, GREEN));
  good('學會 debug「別人的」程式', 0, 3.4);
  say('很好的機會：學會 compile、debug 別人的程式', '');
}]);

// ════════ 2nTqrHZhVQ0（第 2A 講：Batch → Multiprogramming → Time sharing） ════════
// 0:04 Batch
FRAG.push(['osA-batch', 'Batch：一次一個 job，I/O 時 CPU idle', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.4, 0]);
  const A = bag();
  await step(tok);                                   // 4 earliest systems: batch
  A(hd('Batch', 0, 6.4));
  const mem = A(blk('', '#efe6d6', -1, 1.1, 0, 2.2, 2.2, 1.2));
  A(tag('memory', 'val', -1, 2.5, 0));
  const os = A(blk('OS', COL.os, -1, 0.35, 0.65, 2.0, 0.5, 0.2));
  const cpu = A(prop('cpu', 2.2, 0, 0, 1.1, 'CPU'));
  say('最早的電腦系統：batch', '這個字到現在還很常用');
  await step(tok);                                   // 44 one job at a time
  const J = [1, 2, 3].map((k) => A(pal('Job ' + k, '', JOBC[k - 1], -6.2 + (k - 1) * 0.9, 1.6 - (k - 1) * 0.9, 0.6)));
  J[1].mood('sad'); J[2].mood('sad');
  say('Batch：一次只處理一個 job', '後面的 job 只能排隊');
  await step(tok);                                   // 52 OS barely does anything: load the program into memory
  await slide(tok, J[0].g, -1, 0.65, 1.6, 700);
  J[0].mood('happy');
  say('OS 幾乎不用做事', '把程式 load 進 memory，讓 CPU 執行');
  void mem; void os; void cpu;
  await step(tok);                                   // 68 read the cards in, print the output
  const pr = A(prop('printer', 5, 0, 0, 1, 'printer'));
  await send(tok, '卡片（input）', 'pkt', V3(-5.6, 3.6, 0), V3(-1, 3.4, 0), 700);
  await send(tok, '結果（output）', 'pkt', V3(-1, 3.4, 0), V3(5, 1.4, 0), 700);
  say('讀卡片當 input，印到 printer 當 output', '這樣就結束了');
  void pr;
  await step(tok);                                   // 90 problem 1: one job at a time
  A(bad('① 一次只能一個 job', -4, 5.2));
  say('問題一：一次只能處理一個 job', '');
  await step(tok);                                   // 95.4 problem 2: no interaction
  A(bad('② 執行中不能互動', 0, 5.2));
  J[0].mood('sad');
  say('問題二：沒有 interaction', '執行過程中，使用者完全插不上手');
  await step(tok);                                   // 119 problem 3: expensive computer, low utilization
  A(bad('③ 資源使用率低', 4, 5.2));
  say('問題三：電腦很貴，資源使用率卻很低', '尤其是 CPU');
  await step(tok);                                   // 135 CPU is far faster than I/O
  A(note('CPU ≫ I/O（速度）', 2.2, 2.4));
  say('大家都知道：CPU 遠快於 I/O', '');
  await step(tok);                                   // 144.8 any program = compute phases + I/O phases
  A.clear();
  A(hd('Batch', 0, 6.4));
  idx('■ 藍 = 計算（用 CPU）　■ 橘 = I/O　■ 灰 = CPU idle', 0.6, 5.6);
  say('任何 program 都只有兩種 phase', '要嘛在計算、要嘛在做 I/O');
  await step(tok);                                   // 160 one program: during its I/O the CPU can only idle
  const jobs = [{ name: 'Job 1', bursts: [2, 3, 2, 2, 1] }];
  const res = simulate(jobs, 'batch');
  await drawSim(tok, res, jobs, -3.6, 3.6, 0.85, 220);
  hot('I/O 時 CPU 只能 idle', -0.2, 1.4);
  say('只有一個程式：它做 I/O 時', 'CPU 毫無選擇，只能 idle');
  await step(tok);                                   // 174 obvious waste
  note('CPU 只忙了 ' + res.busy + ' / ' + res.T + '（示意）', 3, 4.6);
  say('很明顯的浪費', 'OS 什麼都不做，才會這樣');
}]);

// 3:11 Multiprogramming
FRAG.push(['osA-multi', 'Multiprogramming：CPU 與 I/O overlap', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.4, 0]);
  await step(tok);                                   // 191 next generation: keep the CPU computing
  const cpu = prop('cpu', 6.3, 0, 1.6, 1.1, 'CPU');
  say('下一代 OS：讓 CPU 一直有事做', '就算程式要做 I/O');
  await step(tok);                                   // 217 put multiple programs in the system
  memCol(-5.8, [['OS', COL.os, 1], ['Job 1', JOBC[0], 0.9], ['Job 2', JOBC[1], 0.9], ['Job 3', JOBC[2], 0.9]], 1.6);
  idx('memory', -5.8, -0.2, 1);
  say('系統裡同時放多個 program', '兩個、三個，甚至現在 1000 個');
  await step(tok);                                   // 229.7 one does I/O → another uses the CPU
  const jobs = [0, 1, 2].map((i) => ({ name: 'Job ' + (i + 1), bursts: [2, 3, 2] }));
  const res = simulate(jobs, 'multi');
  await drawSim(tok, res, jobs, -3.8, 4.4, 0.75, 200);
  say('一個 program 去做 I/O', '就讓別的 program 用 CPU（示意）');
  await step(tok);                                   // 243 this is called multiprogramming
  hd('Multiprogramming', 0, 6.4);
  say('這種系統叫 Multiprogramming', 'programming 想成 program 就對了');
  await step(tok);                                   // 255 overlap CPU time and I/O time
  note('CPU 與 I/O 的時間 overlap（重疊）', 0.6, 5.5);
  say('多個 program 的 CPU 和 I/O 時間重疊', '');
  await step(tok);                                   // 274.8 more programs → always someone wants the CPU
  bub('永遠有人要用 CPU', 5.4, 2.6, 1.6);
  glow(cpu.children[0], GREEN);
  say('program 越多，越保證有人要用 CPU', 'CPU 就不會 idle');
  await step(tok);                                   // 285 utilization goes up
  const b = simulate(jobs, 'batch');
  good('CPU 使用率 ' + Math.round(b.util * 100) + '% → ' + Math.round(res.util * 100) + '%（示意）', 0.6, -0.9, 1.2);
  say('CPU 的使用率提高了', '這就是第二代要解決的問題');
}]);

// 4:54 Spooling
FRAG.push(['osA-spool', 'Spooling：I/O 做完再 notify CPU', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 2.2, 0]);
  const A = bag();
  await step(tok);                                   // 294 how do we actually overlap?
  const boss = pal('CPU', '', COL.cpu, -4.4, 0, 1.1);
  const io = pal('I/O 裝置', '', COL.io, 4.4, 0, 1.0);
  const q = A(bub('CPU 和 I/O 怎麼同時動？', 0, 3.4));
  say('說得容易：到底怎麼讓它們 overlap？', '');
  await step(tok);                                   // 318 I/O devices are passive: CPU must keep commanding
  q.element.textContent = 'I/O 很被動：一步一個指令';
  for (let k = 0; k < 3; k++) await send(tok, '指令', 'pkt', V3(-3.6, 2.2, 0), V3(3.6, 2.2, 0), 380);
  io.mood('calm');
  say('I/O device 很被動', 'CPU 要不斷下指令、監測狀況');
  await step(tok);                                   // 332 like a subordinate asking the boss after every line
  txt(boss.name, 'CPU（主管）'); txt(io.name, 'I/O（屬下）');
  const ask = A(talk(io, '寫好一行了，下一步？'));
  boss.mood('sad');
  say('像屬下寫一行字，就回來問主管下一步', '');
  await step(tok);                                   // 345 can the boss do his own work? no
  A(bad('主管整天只在下指令 → 沒有多工', -4.4, 3.2));
  say('主管根本做不了自己的事', '');
  await step(tok);                                   // 357 prerequisite: spooling
  A.clear(); kill(ask);
  boss.mood('calm');
  hd('Spooling', 0, 6);
  say('多工的先決條件：Spooling 的概念', '');
  await step(tok);                                   // 375 e.g. move a 1 GB file from disk to memory
  txt(io.name, 'disk');
  const mem = prop('warehouse', 0.4, 0, -1.4, 1, 'memory');
  void mem;
  const f = pkt('1 GB 檔案', 4.4, 1.6);
  boss.glow(GREEN); boss.mood('happy');
  bub('CPU 完全不用 involve', -4.4, 2.6);
  await travel(tok, f, V3(4.4, 1.6, 0), V3(0.4, 2.4, -1.4), 2200);
  say('例：從 disk 搬 1 GB 的檔案到 memory', '搬很久，這段時間 CPU 去做自己的事');
  await step(tok);                                   // 403 notify the CPU when done
  await send(tok, 'notify！', 'bad', V3(4.4, 3.5, 0), V3(-4.4, 3.5, 0), 800, true);
  boss.glow(null);
  say('搬完了，再 notify CPU', 'CPU 回來做剩下的事');
  await step(tok);                                   // 426 disk and CPU work at the same time = spooling
  good('disk 和 CPU 同時在運作', 0, 4.8);
  say('disk 和 CPU 同時運作', '這種系統概念就叫 Spooling');
  await step(tok);                                   // 438 implemented by interrupt (next chapter)
  note('實現方法：interrupt（下一章）', 0, 4.1);
  say('spooling 只是概念', '真正實現它的機制是 interrupt');
  await step(tok);                                   // 473 multiprogramming's prerequisites
  hot('Multiprogramming ＝ 多個 program ＋ spooling', 0, 5.4);
  say('Multiprogramming 的先決條件', 'I/O 時 CPU 不用參與，做完被通知就好');
}]);

// 8:17 multiprogramming needs: job scheduling, memory management, CPU scheduling
FRAG.push(['osA-sched', 'Job scheduling、memory management、CPU scheduling', async (tok) => {
  fresh([0, 6, 14], [0, 1.8, 0]);
  await step(tok);                                   // 497 memory: OS + job 1, 2, 3, 4
  // zone names sit on the front edge; blocks are stacked by height so their labels never cover each other
  const front = (zn) => { const l = zn.userData.name; l.position.z = 1.85; return zn; };
  front(zone('memory', 0, 0, 0, 3.6, 3.2, '#f3e6c8'));
  blk('OS', COL.os, 0, 0.3, 0, 3, 0.5, 0.8);
  const inMem = [0, 1, 2, 3].map((k) => blk('Job ' + (k + 1), JOBC[k], -1.1 + (k % 2) * 2.2, 1.15 + Math.floor(k / 2) * 0.85, 0, 1.5, 0.5, 0.7, 2));
  say('memory 裡除了 OS，還有 Job 1、2、3、4', '');
  await step(tok);                                   // 512 the CPU can only read memory
  front(zone('CPU cores', 4.8, 0, 0, 2.8, 3.2, '#d6e6f6'));
  prop('cpu', 4.8, 0.05, 1.0, 0.8);
  arrow(V3(1.9, 1.2, 0), V3(3.5, 1.2, 0), 0x6e5f49);
  say('CPU 只能讀 memory', '要執行，得先 load 進 memory');
  await step(tok);                                   // 539 programs start on disk
  front(zone('disk', -4.8, 0, 0, 2.8, 3.2, '#d8e6cf'));
  const onDisk = [];
  for (let k = 0; k < 6; k++) onDisk.push(blk('P' + (k + 5), JOBC[(k + 4) % 5], -5.6 + (k % 2) * 1.6, 0.3 + Math.floor(k / 2) * 0.85, 0, 1.2, 0.5, 0.6));
  say('寫好、compile 好的程式，一開始在 disk', '');
  await step(tok);                                   // 555 which programs to load? memory is limited
  const limBub = bub('memory 有限：先 load 誰？', -4.8, 2.95);
  say('第一個決定：load 哪些 program 進 memory', '早期、embedded 裝置的 memory 有限');
  await step(tok);                                   // 592 how much memory for each job → memory management
  inMem.forEach((m, k) => { m.scale.x = [0.7, 1, 0.8, 0.6][k]; });
  hot('memory management', 0, 3.0);
  say('每個 job 分多少 memory？還會動態配置', '→ memory management');
  await step(tok);                                   // 615 CPU cores are even fewer (64 is a lot)
  note('core 更少：64 個就很了不起', 4.8, 3.9);
  say('CPU core 的數量更有限', 'memory 裡卻可能有幾百個 job');
  await step(tok);                                   // 641 which job runs on a core → CPU scheduling
  await slide(tok, inMem[0], 4.8, 1.4, -0.6, 600);
  hot('CPU scheduling', 4.8, 2.6);
  say('挑哪個 job 上 CPU：CPU scheduling', '作業三會實作基本的演算法');
  await step(tok);                                   // 660 disk → memory: job scheduling
  await slide(tok, onDisk[0], -1.1, 1.15, 0, 600);
  kill(limBub);
  hot('job scheduling', -4.8, 3.2);
  say('disk → memory：Job scheduling', '哪個 job 可以變成 active');
  await step(tok);                                   // 673 job scheduling matters less today
  note('現在 memory 夠大：通常全部 load', -4.8, 4.2);
  say('現在 job scheduling 比較不重要', '一般電腦的 memory 很大');
  await step(tok);                                   // 686 scheduling, memory management, interrupt → multiprogramming OS
  good('scheduling ＋ memory 管理 ＋ interrupt ＝ multiprogramming OS', 0, 5.2);
  say('這些全部湊齊', '才能做出 multiprogramming 的作業系統');
  await step(tok);                                   // 740 I/O devices have small chips to help the CPU
  const chip = prop('cpu', -4.8, 0.05, 2.2, 0.4);
  bub('I/O 裝置上的小 chip 幫忙', -4.8, -0.75, 2.6);
  void chip;
  say('很多 I/O device 上有小 chip（coprocessor）', '幫 CPU 處理 I/O，CPU 專心算');
}]);

// 13:00 Time sharing
FRAG.push(['osA-ts', 'Time sharing：time slot 輪流、可互動', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.4, 0]);
  const A = bag();
  await step(tok);                                   // 795 utilization up, but users still unhappy
  const cpu = A(prop('cpu', 0, 0, 0.5, 1.1, 'CPU'));
  A(good('使用率 ↑', 0, 2.2, 0.5));
  const u = [0, 1, 2].map((k) => pal('使用者 ' + 'ABC'[k], '', JOBC[k], -4.6 + k * 4.6, 2.6, 0.8));
  say('Multiprogramming 提高了 CPU 使用率', '但使用者覺得還是不好用');
  await step(tok);                                   // 815 a single program is the same — or slower
  u[0].mood('sad');
  A(talk(u[0], '我還要禮讓別人…'));
  say('就單一 program 而言，沒有變好', '甚至要讓 CPU 給別人而變慢');
  await step(tok);                                   // 841 what users want: interactive
  A.clear();
  A(talk(u[1], '我要隨時跟程式互動！'));
  u[1].mood('wow');
  say('使用者要的是 interactive', 'I/O 與 CPU 之間很頻繁地交換');
  await step(tok);                                   // 854 many users at once, each feels alone
  A.clear();
  u.forEach((b) => b.mood('happy'));
  A(note('很多人同時用，卻以為只有自己在用', 0, 5.2));
  say('很多人同時使用', '卻感覺不到別人的存在');
  await step(tok);                                   // 870 old way: still one at a time — others delay me
  A.clear();
  u[2].mood('sad');
  A(bad('前面的人先跑 → 我被 delay', 4.6, 4.8));
  say('原本的做法仍然一次一個', '別人先執行，我就被延到後面');
  await step(tok);                                   // 893 solution: time sharing
  A.clear(); gone(...u);
  hd('Time sharing（multi-tasking）', 0, 6.4);
  say('解法：time sharing', '也叫 multi-tasking，但這名字比較混淆');
  await step(tok);                                   // 913 everyone runs together, CPU cut by time
  const jobs = [{ name: '使用者 A', bursts: [4] }, { name: '使用者 B', bursts: [3] }, { name: '使用者 C', bursts: [3] }];
  const res = simulate(jobs, 'ts', 1);
  await drawSim(tok, res, jobs, -4.6, 4.8, 0.85, 200);
  say('讓所有人一起執行', '用時間切割 CPU（示意：一格一個 time slot）');
  await step(tok);                                   // 931 switch very often between CPU and I/O devices
  const kb = prop('keyboard', 4.6, 0, 1.2, 1, '');
  void kb;
  say('CPU 很頻繁地在程式和 I/O device 之間切換', '隨時看看 keyboard 有沒有 input');
  await step(tok);                                   // 974 press a key → handled immediately → interactive
  await send(tok, '按鍵！', 'pkt', V3(4.6, 0.9, 1.2), V3(0.4, 0.9, 0.5), 600);
  glow(cpu.children[0], GREEN);
  good('一有 input 就 react → interactive', 3.6, 2.6);
  say('一按鍵，系統立刻偵測、立刻處理', '就有 interactive 的感覺');
  await step(tok);                                   // 1027 each program only a few ms, then switch
  note('每個程式只跑幾個 ms 就換人', 0, 5.6);
  say('每支程式只執行幾個 millisecond', '就換下一支：看起來大家同時在跑');
  await step(tok);                                   // 1087 difference: switch when done vs at every time slot
  bad('以前：做完（或去 I/O）才換', -3.6, -0.6, 1.4);
  good('Time sharing：time slot 到就 switch', 3.2, -0.6, 1.4);
  say('最大差別：什麼時候換 job', '原本做完才換；現在 time slot 一到就換');
  await step(tok);                                   // 1126 today's computers: hundreds of programs
  hot('你現在的電腦 = time sharing', 0, 6.0, 0);
  say('現在電腦同時跑幾十、幾百個程式', 'CPU scheduling 固定時間就換人');
}]);

// 19:19 what time sharing needs: VM, file system, synchronization, deadlock
FRAG.push(['osA-tsneed', 'Time sharing 的新問題：VM、檔案、同步、死鎖', async (tok) => {
  fresh([0, 5, 14], [0, 2.2, 0]);
  await step(tok);                                   // 1159 the OS has to handle more problems
  hd('Time sharing 要多處理的問題', 0, 6.2);
  say('以使用者角度出發', 'OS 又要多處理一些問題');
  await step(tok);                                   // 1167 virtual memory: disk used as memory
  const mem = blk('memory', COL.mem, -4.6, 0.5, 0, 2, 1, 1.2, 2);
  const dsk = prop('disk', -4.6, 1.05, 0, 1.4);
  hot('Virtual memory', -4.6, 3.6);
  bub('disk 假裝成 memory', -4.6, 2.9);
  say('Virtual memory：把 disk 當 memory 用', 'memory 有限，disk 大上千倍');
  void dsk; void mem;
  await step(tok);                                   // 1202 why: to fit many more programs
  for (let k = 0; k < 6; k++) { blk('', JOBC[k % 5], -5.5 + (k % 3) * 0.9, 0.2 + Math.floor(k / 3) * 0.35, 1.6, 0.7, 0.3, 0.4, 1.5); await wt(tok, 120); }
  say('為什麼要更大？要塞更多程式輪流用 CPU', '切換很頻繁，需要的程式量多十倍、百倍');
  await step(tok);                                   // 1262 users mostly open / edit / save files → file system
  const files = ['開檔', '編輯', '存檔'].map((t, k) => prop('file', -1.2 + k * 1.2, 0, 0, 0.9));
  hot('File system', 0, 2.4);
  say('大家用電腦最常做：開檔、編輯、存檔', '資料存在 disk，要有 file system 管');
  void files;
  await step(tok);                                   // 1325 programs cooperate → synchronization
  const ctr = blk('counter', COL.gold, 4.6, 0.4, 0, 1.3, 0.8, 0.9);
  const p1 = pal('P1', '', JOBC[0], 3.0, 1.6, 0.6), p2 = pal('P2', '', JOBC[1], 6.2, 1.6, 0.6);
  arrow(V3(3.2, 0.8, 1.2), V3(4.2, 0.6, 0.4), 0xa8730f); arrow(V3(6.0, 0.8, 1.2), V3(5.0, 0.6, 0.4), 0xa8730f);
  hot('Synchronization', 4.6, 2.6);
  say('很多程式合作、同時改同一個 memory 內容', '要有大家遵守的規則：synchronization');
  void ctr;
  await step(tok);                                   // 1393 simplest way: lock it
  const lk = prop('lock', 4.6, 0.85, 0, 0.9);
  p2.mood('sad');
  say('最簡單的方式：lock 起來', '一個在用，另一個就不准用');
  void lk;
  await step(tok);                                   // 1407 lots of locks → deadlock
  bub('你擋我、我擋你', 4.6, 3.4);
  p1.mood('sad'); p1.glow(RED); p2.glow(RED);
  hot('Deadlock', 4.6, 4.1);
  say('lock 用多了：你擋到我、我擋到你', '大家都動不了 → deadlock');
  await step(tok);                                   // 1441 hard because switching happens between low-level instructions
  const c = code(['count++  ⟶', '  load  r1, count', '  add   r1, 1', '  ── switch! ──', '  store r1, count'], 0, 5.2, 0.42);
  c.hl(3);
  say('為什麼難？切換發生在 CPU 的低階指令之間', '不是你寫的一行一行 statement');
}]);

// 24:34 summary: purposes of the three systems
FRAG.push(['osA-gens', 'Batch / Multiprogramming / Time sharing 的目的', async (tok) => {
  fresh([0, 5, 14], [0, 2.4, 0]);
  const X = [-4.6, 0, 4.6];
  const sys = [];
  await step(tok);                                   // 1474 batch: one job, one user owns the machine
  sys.push(pal('Batch', '1', COL.idle, X[0], 0, 1));
  bub('一次一個 job、一人獨占', X[0], 2.5);
  say('Batch：一次一個 job', '一個使用者獨占整台電腦');
  await step(tok);                                   // 1479 multiprogramming: many programs, no link to users
  sys.push(pal('Multiprogramming', 'N', COL.cpu, X[1], 0, 1));
  bub('塞很多 program', X[1], 2.5);
  say('Multiprogramming：塞很多 program 進去', '但跟使用者沒關係');
  await step(tok);                                   // 1491 time sharing: adds the human factor
  sys.push(pal('Time sharing', '⌨', COL.user, X[2], 0, 1));
  bub('把「人」加進來', X[2], 2.5);
  say('Time sharing：把人的因素加進來', '互動、很多 I/O、多人同時用');
  await step(tok);                                   // 1512 batch is just the baseline
  sys[0].mood('calm');
  idx('baseline', X[0], 3.2);
  say('Batch 很單純，當 baseline 就好', '');
  await step(tok);                                   // 1519 multiprogramming's purpose: utilization (system view)
  hot('目的：資源使用率', X[1], 3.2); sys[1].mood('happy');
  say('Multiprogramming 的目的：提高資源使用率', '從「系統」的角度出發');
  await step(tok);                                   // 1532.7 time sharing: interactive, short response time
  hot('目的：互動、response time 短', X[2], 3.2); sys[2].mood('happy');
  say('Time sharing：interactive', '每次 input / output 都能立刻反應');
  await step(tok);                                   // 1545 also sharing: many users together
  note('＋ sharing：很多人一起用', X[2], 4.0);
  say('還可以加上 sharing', '很多使用者共同使用這台電腦');
  await step(tok);                                   // 1554 one from the system, one from the user
  note('系統角度', X[1], 4.8); note('使用者角度', X[2], 4.8);
  say('一個從系統出發，一個從使用者出發', '考試常問兩者目的的差別');
  await step(tok);                                   // 1564 these map onto the important chapters
  ['CPU scheduling', 'memory', 'file system', 'sync', 'I/O'].forEach((t, k) => pkt(t, -4.8 + k * 2.4, 6.1));
  say('這些需求剛好對到 OS 的重要章節', '作業和課本重點都在上面');
  await step(tok);                                   // 1588 these concepts never changed
  good('核心概念從來沒變過', 0, 5.4);
  say('這些概念從來沒有變過', '所以是 OS 的核心問題與技術');
}]);

// ════════ 1gIwNYCcwAk（第 2D 講：Special-purpose systems） ════════
// 1:02 real-time: deadline, scheduler, EDF
FRAG.push(['osA-rt', 'Real-time：deadline 與 EDF', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.4, 0]);
  const A = bag();
  await step(tok);                                   // 62 real-time OS / computer systems
  hd('Real-time system', 0, 6.4);
  const os = pal('RT OS', '⏱', COL.os, -6.2, 0, 1);
  say('第一種：real-time 的 OS 或電腦系統', '非常非常重要');
  await step(tok);                                   // 74.2 people think: real-time = very fast
  const q = A(talk(os, '要很快、很即時？'));
  os.mood('wow');
  say('大家可能以為 real-time = 很快、很即時', '');
  await step(tok);                                   // 84.2 definition is the opposite: slow is fine, finish before the deadline
  A.clear();
  A(bad('越快越好 ✗', -2.4, 5.5)); A(good('在 deadline 前做完 ✓', 2.4, 5.5));
  os.mood('happy');
  say('定義其實相反：多慢都沒關係', '但要在 deadline 之前做完');
  void q;
  await step(tok);                                   // 94.6 each job has a deadline
  const unit = 0.85, x0 = -3.4;
  const T = [['作業 A', 3, 9], ['作業 B', 2, 4], ['作業 C', 2, 6]];
  for (const [n, , dl] of T) { line(x0 + dl * unit, 0.6, 0, x0 + dl * unit, 3.6, 0, '#d64545'); idx(n.slice(-1) + ' 的 deadline', x0 + dl * unit, n.endsWith('C') ? 4.65 : 3.9); }
  say('每個工作都有一個 deadline', '（作業長度、deadline 是示意數字）');
  await step(tok);                                   // 103 the scheduler is the most critical part
  const sch = A(pal('scheduler', '', COL.gold, 5.6, 2.4, 0.7));
  sch.mood('wow');
  say('所以 real-time 系統裡最 critical 的是 scheduler', '要排出讓大家都趕上 deadline 的順序');
  await step(tok);                                   // 116.5 like doing homework
  async function lane(y, order, name) {
    idx(name, x0 - 1.0, y); let t = 0;
    for (const k of order) {
      const [n, len, dl] = T[k];
      const m = blk(n, JOBC[k], x0 + (t + len / 2) * unit, y, 0, len * unit, 0.5, 0.6);
      t += len; const ok = t <= dl;
      idx(ok ? '✓' : '✗ 遲交', x0 + (t - 0.4) * unit, y + 0.5);
      if (!ok) glow(m, RED);
      await wt(tok, 450);
    }
  }
  await lane(2.8, [0, 1, 2], '照順序');
  say('就像寫作業：照拿到的順序寫', 'B 就遲交了');
  await step(tok);                                   // 127 Earliest Deadline First
  await lane(1.4, [1, 2, 0], 'EDF');
  hot('Earliest Deadline First', 3.6, 0.6);
  say('EDF：最早 deadline 的先做', '先寫最快要交的作業');
  await step(tok);                                   // 141 intuitive but effective — no guarantee
  note('直覺、有效，但不保證不 miss', -3.8, 4.65);
  sch.mood('happy');
  say('很直覺也很有效', '但不能保證任何事（之後 CPU scheduling 再談）');
  await step(tok);                                   // 161 the deadline is defined by the user
  bub('deadline = 使用者能接受的 response time', 0, -0.6, 1.4);
  say('deadline 是使用者定義的', '可以接受的 response / reaction time');
  await step(tok);                                   // 177.5 or the critical point for a decision
  note('做決定的 critical point', 0, -1.3, 1.4);
  say('或是做出決定的 critical point', '通常不會很寬鬆');
}]);

// 3:14 cars, weapons, medical: computers everywhere
FRAG.push(['osA-rtuse', 'Real-time 的應用：車子是四輪電腦', async (tok) => {
  fresh([0, 4.4, 13], [0, 1.8, 0]);
  await step(tok);                                   // 194 computers are everywhere
  const os = pal('RT OS', '⏱', COL.os, -5, 0, 0.9);
  say('現在電腦無所不在', '');
  await step(tok);                                   // 200 a car = a computer with four wheels
  const car = new THREE.Group();
  const body = lab.box('#d64545', [2.6, 0.7, 1.3]); body.position.y = 0.6; car.add(body);
  const top = lab.box('#f0a0a0', [1.4, 0.5, 1.1]); top.position.set(-0.2, 1.2, 0); car.add(top);
  for (const [x, z] of [[-0.8, 0.65], [0.8, 0.65], [-0.8, -0.65], [0.8, -0.65]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16), new THREE.MeshStandardMaterial({ color: '#333' })); w.rotation.x = Math.PI / 2; w.position.set(x, 0.3, z); car.add(w); }
  car.position.set(-1, 0, 0); lab.world.add(car);
  const cp = prop('cpu', -1, 1.45, 0, 0.5);
  bub('一台電腦 ＋ 四個輪子', -1, 2.9);
  say('一台車子，就想成多了四個輪子的電腦', '全靠電腦控制');
  void cp;
  await step(tok);                                   // 216 the controls are all about time: press the gas
  pkt('踩油門', -4, 2.4);
  await anim(tok, 900, (u) => { car.position.x = -1 + 2 * u; });
  say('這些控制都和時間絕對有關', '踩了油門，車子要立刻跑');
  await step(tok);                                   // 223 press the brake and it does not stop → crash
  pkt('踩煞車', -4, 1.6);
  const wall = blk('', '#8a7a5c', 4.6, 1, 0, 0.3, 2, 1.4);
  await anim(tok, 700, (u) => { car.position.x = 1 + 1.9 * u; });
  glow(body, RED); glow(wall, RED);
  bad('不停 → 撞車！', 4.6, 2.6);
  say('踩了煞車卻不停，就撞車了', '時間的觀念都在裡面');
  await step(tok);                                   // 231 a real-time OS controls the machine
  os.mood('happy'); await os.hop(tok);
  say('靠 real-time OS 控制整個 machine', '');
  await step(tok);                                   // 239 weapons, medical, control systems
  ['武器', '醫療', 'control system'].forEach((t, k) => note(t, -3 + k * 3, 4.6));
  say('武器、醫療、各種 control system', '全部都是 real-time system');
}]);

// 4:17 soft vs hard real-time
FRAG.push(['osA-softhard', 'Soft vs Hard real-time', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.4, 0]);
  const A = bag();
  await step(tok);                                   // 257 two kinds: hard and soft
  hd('Soft real-time', -3.6, 6.2); hot('Hard real-time', 3.6, 6.2);
  say('real-time 又分 hard 和 soft', '區別就如字面意思');
  await step(tok);                                   // 273 soft: try my best; missing it is not the end of the world
  const s = pal('soft', '', COL.user, -3.6, 0, 0.9);
  A(talk(s, '盡量趕，沒趕上天也不會垮'));
  say('Soft：盡量在 deadline 前完成', '沒完成也不會有人因此出事');
  await step(tok);                                   // 290 by priority
  A.clear();
  A(note('用 priority：重要的先做', -3.6, 2.6));
  say('用 priority 的概念', '依優先順序盡量做完');
  await step(tok);                                   // 297.4 the standard example: multimedia streaming
  A.clear(); gone(s);
  const scr = prop('monitor', -3.6, 0, 0, 1.8);
  const pic = scr.children[1];
  pic.material.color.set('#3d4450');
  say('最標準的例子：multimedia', '網路上的 streaming 影片');
  await step(tok);                                   // 305 bad signal: first only the outline
  pic.material.color.set('#8a7a5c');
  A(idx('先看到框（輪廓）', -3.6, 0.9, 1));
  say('收訊不好時，先看到影像的框', '');
  await step(tok);                                   // 312.6 then some colour, then resolution goes up
  pic.material.color.set('#c08a1f'); await wt(tok, 600); pic.material.color.set('#9fd3f0');
  A(idx('→ 顏色 → 解析度慢慢增加', -3.6, 0.4, 1));
  say('好一點：有顏色；再好一點：解析度增加', '');
  await step(tok);                                   // 320 prioritize: important lines first
  A(good('重要的（輪廓）priority 高，先送', -3.6, 4.6));
  say('它會 prioritize：重要的線條先送', '高解析度的細節後送 → soft real-time');
  await step(tok);                                   // 344 hard: miss any deadline → fundamental failure
  const car = blk('car', COL.bad, 1.8, 0.4, 0, 1.4, 0.8, 1);
  const wall = blk('', '#8a7a5c', 6.2, 1, 0, 0.3, 2, 1.2);
  line(4.8, 0, 0, 4.8, 2.1, 0, '#d64545'); idx('deadline', 4.8, 2.4);
  await slide(tok, car, 5.4, 0.4, 0, 800);
  glow(car, RED); glow(wall, RED);
  bad('miss 任何一個 deadline → 系統 crash', 3.6, 4.6);
  say('Hard：不是鬧著玩的', 'miss 任何一個 deadline 就是 fundamental failure');
  await step(tok);                                   // 362 cars, weapons: important control systems
  note('汽車、武器控制 = hard', 3.6, 3.8);
  say('車子、武器這類重要的 control system', '大多是 hard real-time');
  await step(tok);                                   // 370.8 Europe (Germany) is strong here
  idx('歐洲（如德國）在這塊很強', 3.6, 3.1);
  say('歐洲（尤其德國）的 real-time 發展很好', '控制汽車的全是 real-time system');
  await step(tok);                                   // 400.5 challenge 1: scheduling algorithm
  A.clear(); gone(scr);
  A(hot('挑戰 ① scheduling algorithm', -3.6, 4.6));
  say('這種系統的挑戰一：scheduling algorithm', '');
  await step(tok);                                   // 408 challenge 2: usually no secondary storage
  const mem = A(prop('warehouse', -4.6, 0, 0, 1, 'memory'));
  const dk = A(prop('disk', -1.6, 0, 0, 1.2));
  A(bad('不用 secondary storage', -1.6, 2.2));
  say('挑戰二：通常沒有 secondary storage', '沒有 hard drive，全部放在 memory');
  void mem;
  await step(tok);                                   // 423 memory = first level; everything beyond = secondary storage
  A(idx('memory = 第一層　disk = secondary', -3.1, 3.6));
  say('memory 是第一層 storage', 'memory 之外的叫 secondary storage');
  await step(tok);                                   // 433 disk is too slow
  dk.children[0].material.color.set('#b0a090');
  say('因為 disk 太慢了', '');
  await step(tok);                                   // 439 and its access time is hard to predict
  A(bad('讀取時間不好掌握 ❓', -1.6, 3.0));
  say('而且讀取時間不好掌握', '不知道要多久，就保證不了 deadline');
  await step(tok);                                   // 451 hard RT systems avoid it: keep data in memory
  A(good('資料一定要在 memory', -4.6, 2.6));
  say('所以 hard real-time 盡量避免 secondary storage', '要的資料一定要在 memory');
  await step(tok);                                   // 479.5 your PC is not real-time: it is the OS's job
  A(note('硬體一樣，能不能 real-time 看 OS', 0, -0.9, 1.4));
  say('一般電腦沒用 real-time OS', '能不能 real-time，是 OS 控制的問題');
}]);

// 8:13 multimedia
FRAG.push(['osA-media', 'Multimedia system：soft real-time 與壓縮', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 2.2, 0]);
  await step(tok);                                   // 493 multimedia system
  hd('Multimedia system', 0, 6.2);
  const ph = prop('monitor', 0, 0, 0, 1.6);
  say('大家用手機最常做的：影音 application', '這類系統叫 multimedia system');
  void ph;
  await step(tok);                                   // 517 graphics, speech, video, audio
  ['圖形', 'speech', 'video', 'audio'].forEach((t, k) => pkt(t, -4.5 + k * 3, 4.8));
  say('圖形、speech、video、audio', '這幾年非常熱門');
  await step(tok);                                   // 528 it is soft real-time
  good('soft real-time', 0, 3.6);
  say('它是 soft real-time', '就像剛才的串流影片');
  await step(tok);                                   // 534 on-demand or live
  note('on-demand', -4.4, 2.6); note('live', 4.4, 2.6);
  say('分成 on-demand 或 live', '可以先 buffer、或存在某個地方再播');
  await step(tok);                                   // 550 compression everywhere
  const big = blk('影片資料', COL.io, -4.4, 0.6, 1.4, 2.2, 1.2, 1);
  await anim(tok, 900, (u) => { big.scale.set(1 - 0.55 * u, 1 - 0.55 * u, 1); });
  hot('壓縮', -4.4, 1.9, 1.4);
  say('都有很重要的壓縮技術', '所以影片、照片有一大堆格式');
  await step(tok);                                   // 566 data too big, not all equally important
  bub('資料太大，又不全都那麼重要', 2.6, 1.6, 1.4);
  say('因為資料實在太大', '可是又不是都那麼重要');
  await step(tok);                                   // 574 trade-offs: small but blurry, fast decode, fast encode
  ['檔案小、畫質差', '解壓縮快', '壓縮快'].forEach((t, k) => idx(t, 2.6 + (k - 1) * 2.2, 0.6, 2));
  say('各種壓縮方式各有取捨', '看使用的特性選');
}]);

// 10:00 handheld / embedded
FRAG.push(['osA-hand', 'Handheld / embedded system', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 2.2, 0]);
  const A = bag();
  await step(tok);                                   // 600 handheld devices, embedded systems
  hd('Handheld / Embedded system', 0, 6.2);
  const ph = blk('📱', '#3d4450', 0, 1.2, 0, 1.2, 2.2, 0.25);
  say('第三類：handheld device、embedded system', '');
  await step(tok);                                   // 609 mobile, small
  await anim(tok, 900, (u) => { ph.position.x = Math.sin(u * Math.PI * 2) * 1.2; });
  idx('mobile・體積小', 0, -0.4, 0.6);
  say('都是 mobile device', '可以到處移動，體積很小');
  await step(tok);                                   // 619 hardware is specialized: no keyboard
  const kb = A(prop('keyboard', -4.2, 0, 0, 1));
  A(bad('手機沒有 keyboard', -4.2, 1.2));
  say('硬體通常是 specialized', '像手機沒有 keyboard，才能做這麼小');
  void kb;
  await step(tok);                                   // 635 the OS is customized, modular components
  const M = ['顯示', '網路', '相機', '感測器'].map((t, k) => blk(t, JOBC[k], 3.4 + (k % 2) * 1.5, 0.3 + Math.floor(k / 2) * 0.62, 0, 1.4, 0.55, 0.8, 1.5));
  hot('OS 也 customize：module 可增可減', 4.1, 2.2);
  say('OS 也是客製化的', 'component 可以 modular 地增加、減少');
  await step(tok);                                   // 656 Android; nobody installs a traditional OS
  kill(M[3]);
  A(bad('裝傳統 OS？沒人這樣做', -4.2, 3.2));
  say('像 Android；沒有人把傳統 OS 裝在手機上', '不符合需求');
  await step(tok);                                   // 666 running the OS alone eats most resources
  A(note('光跑 OS 就吃掉大部分資源', -4.2, 4.0));
  say('效能不好，光跑 OS 就吃掉大部分資源', '');
  await step(tok);                                   // 674 no power management
  A(note('傳統 OS 不管電：插著電源線', -4.2, 4.8));
  say('傳統 OS 對電力的管理很差、甚至沒有', '因為它插著電源線');
  await step(tok);                                   // 688 small memory, slow processor → the cloud
  A.clear();
  idx('memory 小・processor 慢', 0, -0.9, 0.6);
  await send(tok, '計算 → 雲端', 'pkt', V3(0, 2.6, 0), V3(-4.4, 5, 0), 900, true);
  say('memory 比較小、processor 比較慢', '所以把計算丟到雲端去做');
  await step(tok);                                   // 700 Pokemon Go: everyone bought power banks
  const bat = blk('🔋', COL.user, 4.4, 0.5, 1, 0.7, 1, 0.5);
  void bat;
  bub('Pokémon Go：大家先去買行動電源', 3.6, 1.8, 1);
  say('Pokémon Go 一出來，大家先買行動電源', '電力非常 critical');
  await step(tok);                                   // 709.6 how to display / I/O keeps improving
  note('display、I/O 也要不斷改善', 0, 4.8);
  say('怎麼 display、做 I/O', '也一直需要改善');
}]);

// 11:58 names by purpose; cloud computing; IoT
FRAG.push(['osA-cloud', 'Cloud computing 與 IoT', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 2.2, 0]);
  await step(tok);                                   // 718 systems named by computing power, connectivity, purpose
  hd('依計算能力、連線方式、目的 → 各種系統名詞', 0, 6.2);
  say('依計算能力、連線、目的分', '就有各式各樣的系統名詞');
  await step(tok);                                   // 736.9 don't memorize; know the design considerations
  const memo = [bad('死背名詞 ✗', -3, 5.2), good('懂設計考量、和一般系統的差別 ✓', 2.4, 5.2)];
  say('不用背起來', '要知道它的設計考量、跟一般系統差在哪');
  await step(tok);                                   // 768 cloud computing
  const cl = blk('☁ Cloud', '#cfe3f6', -3.4, 3, 0, 3, 1, 1.4);
  hot('Cloud computing', -3.4, 4.1);
  say('過去五年不能不知道：雲端計算', '另一種提供計算功能的形式');
  void cl;
  await step(tok);                                   // 778.7 the internet used as my computer
  const me = prop('monitor', -3.4, 0, 0, 1);
  await send(tok, 'internet', 'pkt', V3(-3.4, 1.8, 0), V3(-3.4, 2.5, 0), 700, false);
  say('透過 internet，把 internet 當成我的電腦', '現在已經非常普及');
  void me;
  await step(tok);                                   // 793 Internet of Things
  const things = ['📱', '💡', '🚗', '⌚', '🏠'].map((t, k) => pal('', t, JOBC[k], 1.6 + (k % 3) * 1.8, Math.floor(k / 3) * 1.6 - 0.6, 0.55));
  hot('IoT 物聯網', 3.4, 4.1);
  say('手機到了極致：物聯網（IoT）', '把所有物品連在一起計算、溝通');
  for (const t of things) t.mood('happy');
  await step(tok);                                   // 802 all of these need new operating systems
  gone(...memo);
  good('都需要新的 OS', 0, 5.2);
  say('這些都需要開發新的作業系統', '');
}]);

// ════════ QK63Mw9hPec（第 1B 講：這堂課要學什麼） ════════
// 5:05 the book: 8 parts; the course covers the core half
FRAG.push(['osA-parts', '課本八個 part：CPU、memory、storage 三要素', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 2.2, 0]);
  const A = bag();
  await step(tok);                                   // 305 what will we learn?
  hd('這堂課要學什麼？', 0, 6.2);
  const book = A(blk('Operating System Concepts', '#7a9a6a', 0, 0.5, 0, 4, 1, 2.6, 2));
  say('OS 這麼重要，內容非常非常多', '課本那麼厚，都是扎實的內容');
  void book;
  await step(tok);                                   // 329 eight parts, each with 2–3 chapters
  A.clear();
  const parts = [];
  for (let k = 0; k < 8; k++) parts.push(blk('Part ' + (k + 1), '#e9dcc4', -5.6 + k * 1.6, 0.35, 0, 1.4, 0.6, 1, 1.4 + k * 0.15));
  say('一共八個 part（不是 chapter）', '每個 part 裡面還有兩三章');
  await step(tok);                                   // 338.8 this course: only half, up to part 5
  for (let k = 0; k < 5; k++) { glow(parts[k], GOLD); await wt(tok, 150); }
  hot('這堂課：Part 1–5', -2.4, 1.4);
  say('這堂課只 cover 一半：到第五個 part', '');
  await step(tok);                                   // 349 three essential elements of a computer
  bub('電腦不可或缺的三要素？', 0, 4.8);
  say('原因：作業系統 / 電腦最重要的三個要素', '');
  await step(tok);                                   // 356.7 CPU (process), memory, storage / file system
  const T = [['CPU', 'process', COL.cpu, -4], ['Memory', '', COL.mem, 0], ['Storage', 'file', COL.io, 4]];
  const tri = T.map(([n, v, c, x]) => buddy(n, v, c, x, 1.3, 1.0, 0.85));
  tri.forEach((b) => b.mood('happy'));
  say('CPU（process）、Memory、Storage（file system）', '');
  await step(tok);                                   // 364 any computer has these three parts
  for (const b of tri) await b.hop(tok);
  say('拿到一台電腦，一定有這三個 part', '');
  await step(tok);                                   // 375.4 plus the overview / system structure part
  note('＋ Overview（系統設計概念、system call）', 0, 5.4);
  say('前面再加一個 overview', '介紹系統設計概念、system call');
  await step(tok);                                   // 393.9 the rest, e.g. protection & security
  gone(...tri);
  hot('Protection / Security', 4.8, 2.1);
  say('後面的 part，例如 protection、security', '有興趣可以自己看');
  await step(tok);                                   // 420 a system without security = a house anyone breaks into
  const house = prop('warehouse', 3.6, 0, -2.5, 1);
  const thief = pal('入侵者', '', '#5d6b7a', 6.2, -2.5, 0.6);
  thief.mood('happy');
  await slide(tok, thief.g, 4.9, 0, -2.5, 800);
  bad('沒有 security → 誰都能 break in', 3.6, 2.5, -2.5);
  say('把系統想成一個家', '沒有 security，別人可以隨便闖進來');
  void house;
}]);

// 7:23 distributed and special-purpose systems; chapter 0
FRAG.push(['osA-dist', '分散式系統與 special-purpose 系統', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 2.2, 0]);
  const A = bag();
  await step(tok);                                   // 443 distributed systems
  A(hd('分散式系統（distributed system）', 0, 6.2));
  [-4.8, -1.6, 1.6, 4.8].forEach((x) => A(prop('monitor', x, 0, 0, 0.9)));
  say('另一個 part：分散式系統', '');
  await step(tok);                                   // 445.6 early on: expensive computers, poor networking
  A(idx('早期：電腦貴、網路不發達 → 各用各的', 0, -0.6, 1));
  say('早期電腦昂貴、網路不發達', '大家各自用各自的電腦');
  await step(tok);                                   // 455.8 now: cloud computing, big data, IoT
  ['雲端計算', '巨量資料', 'IoT'].forEach((t, k) => A(pkt(t, -3 + k * 3, 4.8)));
  say('現在問題越來越大', '雲端計算、巨量資料、IoT');
  await step(tok);                                   // 474.9 no single computer can do it: connect them all, manage as one
  for (let k = 0; k < 3; k++) A(arrow(V3(-4.8 + k * 3.2 + 0.7, 1.0, 0.3), V3(-1.6 + k * 3.2 - 0.7, 1.0, 0.3), 0x8a5a00));
  A(good('連在一起管理，像一台電腦', 0, 3.4));
  say('一台電腦做不到', '把所有電腦連在一起管理，像一台電腦一樣');
  await step(tok);                                   // 494 special purpose: cars, nuclear plants, weapons, space shuttles
  A.clear();
  hd('Special purpose', 0, 6.2);
  ['🚗 車子', '⚛ 核電廠', '🚀 太空梭', '武器'].forEach((t, k) => A(note(t, -4.8 + k * 3.2, 4.4)));
  say('Special purpose：現在什麼都用電腦控制', '車子、核電廠、武器、太空梭');
  await step(tok);                                   // 521 still a system with an OS — different design
  const os = A(pal('OS', '', COL.os, 0, 0.6, 1));
  os.mood('wow');
  A(bub('還是要有 OS，設計考量完全不同', 0, 2.6, 0.6));
  say('它們還是系統，還是要有 OS', '但設計考量完全不同');
  await step(tok);                                   // 536 Chapter 0: overview of OS evolution
  note('等一下 Chapter 0：OS 的演進（overview）', 0, -0.4, 1.6);
  say('等一下的 Chapter 0', '先講 OS 的演進和基本概念');
}]);

// 9:39 what each part teaches: system call, process scheduling, synchronization
FRAG.push(['osA-plan', 'Overview、Process：system call、scheduling、同步', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 2.2, 0]);
  const A = bag();
  await step(tok);                                   // 579 introduction: the role of the OS
  hd('Part 1：Overview', -3.6, 6.2);
  const os = pal('OS', '', COL.os, -3.6, 0, 1);
  say('Introduction：作業系統的角色是什麼', '');
  await step(tok);                                   // 590 system structure: the system call (assignment 1)
  const sc = A(pkt('system call', -3.6, 3.4));
  A(note('作業一', -1.4, 3.4));
  await travel(tok, sc, V3(-6, 3.4, 0), V3(-3.6, 3.4, 0), 600);
  say('System structure 最重要的：system call', '定義和運作原理，作業一實作');
  await step(tok);                                   // 611.6 part 2: process
  A.clear();
  await slide(tok, os.g, -6.2, 0, 0, 500);
  hd('Part 2：Process', 3.2, 6.2);
  const P = [];
  for (let k = 0; k < 12; k++) P.push(blk('', JOBC[k % 5], 1.2 + (k % 6) * 0.75, 0.25 + Math.floor(k / 6) * 0.55, 1.6, 0.6, 0.45, 0.5, 1 + k * 0.1));
  idx('幾百、幾千個 process', 3.2, 1.8, 1.6);
  say('Part 2：process', '電腦上同時跑幾百、幾千個 process');
  await step(tok);                                   // 630 but how many CPUs? a dozen, fifty
  prop('cpu', 3.2, 0, -1.2, 1.1, 'CPU');
  say('可是 CPU 有幾個？', '再厲害也不過十幾、五十幾個');
  await step(tok);                                   // 647 the OS's key role: scheduling
  os.mood('happy');
  await slide(tok, P[0], 3.2, 0.5, -1.2, 500);
  hot('scheduling：現在該誰執行？', 3.2, 3.2);
  say('靠作業系統：它最重要的角色就是 scheduling', '分配資源，決定現在該誰執行');
  await step(tok);                                   // 669 assignment 3: implement scheduling algorithms on Nachos
  A(note('作業三：在 Nachos 實作排程演算法', 3.2, 4.2));
  say('作業三：實作 scheduling algorithm', '看到誰先開始、誰結束、結束的順序');
  await step(tok);                                   // 692 processes share resources and communicate
  for (let k = 1; k < 4; k++) glow(P[k], GOLD);
  A(bub('不只 share CPU，還 share 資源、互相溝通', -3, 3.2));
  say('process 不只 share CPU 的執行 cycle', '還要 share 很多資源、甚至溝通');
  await step(tok);                                   // 711.7 synchronization: usually the hardest part
  A(hot('Synchronization（同步）', -3, 4.2));
  os.mood('wow');
  say('這時會遇到很討厭的問題：synchronization', '通常是整本書最難的部分');
  await step(tok);                                   // 722 needs rigor like algorithms: make sure nothing goes wrong
  A(note('要像演算法一樣嚴謹', -3, 5.0));
  say('不是大概知道就好', '要像演算法一樣嚴謹，確保不會出問題');
  await step(tok);                                   // 736 design synchronization policies that are correct
  A(good('設計同步的 policy → 保證正確性', -3, 2.4));
  say('要設計同步化的 policy', '確保它的正確性');
  await step(tok);                                   // 752.6 no assignment: a run can't prove correctness
  A(bad('沒有作業：跑一次 ≠ 證明正確', -2.4, 1.6));
  say('同步沒有程式作業', '可能性太多，跑出來只是當下那次的結果');
}]);

// 12:50 memory and storage
FRAG.push(['osA-memsto', 'Memory 與 Storage 兩個 part', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 2.2, 0]);
  await step(tok);                                   // 770.7 memory: the most content in the first half
  hd('Part：Memory', -3.6, 6.2);
  blk('memory', COL.mem, -3.6, 0.8, 0, 2.6, 1.6, 1.4, 2);
  say('Memory：上半學期最複雜、內容最多', '');
  await step(tok);                                   // 789 an assignment on memory management
  note('作業：memory 管理', -3.6, 2.4);
  say('也有一個作業去做 memory 的管理', '');
  await step(tok);                                   // 791.5 storage: easier to imagine — you use files every day
  hd('Part：Storage', 3.6, 6.2);
  ['存檔', '開檔', '看內容'].forEach((t, k) => { prop('file', 2.4 + k * 1.2, 0, 0, 0.9); idx(t, 2.4 + k * 1.2, -0.4, 0.4); });
  say('Storage 比較容易想像', '用電腦就是在存檔、開檔、看內容');
  await step(tok);                                   // 811 but messier: I/O changes the most
  bad('比較雜亂：I/O 變化最大', 3.6, 2.4);
  say('但它比較雜亂', '儲存和 I/O 是變化最大的部分');
  await step(tok);                                   // 826 e.g. touch screens are a new I/O device
  pkt('觸控螢幕 = 新的 I/O device', 3.6, 3.3);
  say('以前沒有觸控螢幕', '現在人人都用：新的 I/O device');
  await step(tok);                                   // 848.8 file system assignment: where file data goes on disk
  prop('disk', 0, 0, 2.4, 1);
  await send(tok, '檔案內容', 'pkt', V3(3.6, 1.6, 0), V3(0, 1.0, 2.4), 900, true);
  say('檔案系統作業：決定檔案內容放在硬碟哪裡', '');
  await step(tok);                                   // 861 user data → the physical device
  good('使用者的資料 → physical device', 0, 2.2, 2.4);
  say('把使用者程式的東西', '放到 physical device 上的過程');
}]);

// ════════ wzRwuRrUzNQ（第 1C 講：Chapter 0、mainframe 與 batch） ════════
// 0:16 why OS matters: the layer between applications and hardware
FRAG.push(['osA-why', '為什麼 OS 重要：夾在應用程式與硬體中間', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 2.4, 0]);
  const A = bag();
  await step(tok);                                   // 15.8 Chapter 0 begins
  hd('Chapter 0', 0, 6.4);
  say('正式開始：作業系統的 Chapter 0', '先重申 OS 有多重要');
  await step(tok);                                   // 19 apps on top, hardware below, OS in the middle
  const app = blk('應用程式', COL.user, 0, 3.6, 0, 6, 0.8, 1.4, 2);
  const os = blk('作業系統（OS）', COL.os, 0, 2.4, 0, 6, 0.8, 1.4, 2.5);
  const hw = blk('硬體', '#8a7a5c', 0, 1.2, 0, 6, 0.8, 1.4, 3);
  say('電腦的運作：上面應用程式、下面硬體', '中間是作業系統');
  await step(tok);                                   // 45 three indispensable parts
  A(note('三個絕對不可或缺的部分', 4.6, 4.6));
  say('三個絕對不可或缺的部分', '');
  await step(tok);                                   // 55 apps use the computer through it; it manages hardware
  glow(os, GOLD);
  await send(tok, '怎麼用電腦', 'pkt', V3(-2, 3.6, 0.8), V3(-2, 2.4, 0.8), 600);
  await send(tok, '管理硬體資源', 'pkt', V3(2, 2.4, 0.8), V3(2, 1.2, 0.8), 600);
  say('上面的軟體怎麼用電腦、下面的硬體怎麼管理', '都靠作業系統');
  await step(tok);                                   // 63 new hardware devices → build a fitting system
  A(pkt('新的 device', 5.6, 1.2));
  say('有新的硬體 device 出來', '也是靠 OS 建立適合它的系統');
  await step(tok);                                   // 80.5 the course that best represents CS (資工)
  A.clear();
  A(good('最能代表資工系的核心課程之一', 0, 5.4));
  say('最能代表資工系的核心課程之一', '');
  await step(tok);                                   // 88 above: domain knowledge; math students may be better at algorithms
  A(idx('數學系：演算法概念可能更強', -4.8, 3.6));
  say('上面的應用需要 domain knowledge', '數學系的演算法概念可能比我們強');
  await step(tok);                                   // 102 below: EE students know hardware better
  A(idx('電機系：硬體更紮實', -4.8, 1.2));
  say('下面的硬體，電機系學得更紮實', '');
  await step(tok);                                   // 113 only the OS sits in the middle: software controlling hardware
  glow(app, null); glow(hw, null);
  const cs = A(pal('資工系', '💪', COL.os, 4.8, 1.6, 0.7));
  cs.mood('happy'); await cs.hop(tok);
  A(hot('用軟體控制硬體，讓人用電腦', 0, 3.0, 1.0));
  say('唯獨作業系統在中間', '用軟體控制硬體＝資工系的強項');
  await step(tok);                                   // 158 programming: Segmentation fault, crash
  A.clear(); gone(app, os, hw);
  const pc = prop('monitor', -3.6, 0, 0, 1.6);
  const err = bad('Segmentation fault 💥', -3.6, 3.2);
  say('寫程式常碰到 Segmentation fault、crash', '錯誤訊息就是線索');
  void pc; void err;
  await step(tok);                                   // 183 learn OS → know why the error happens
  good('學了 OS：知道是哪條規定沒遵守', -3.6, 4.0);
  say('不懂 OS 就不知道問題出在哪', '學完就知道為什麼會有這些錯誤訊息');
  await step(tok);                                   // 207 buy an SSD / hard disk: first thing is formatting
  const dsk = prop('disk', 3.4, 0, 0, 1.3);
  pkt('Formatting', 3.4, 1.6);
  say('買了 SSD 或硬碟，插上去第一件事', 'formatting（格式化）');
  void dsk;
  await step(tok);                                   // 229 formatting the storage device is the OS's job
  hot('format = 作業系統在做的事', 3.4, 2.6);
  say('format storage device', '就是作業系統在做的事');
  await step(tok);                                   // 240 the OS fully controls how devices are used
  note('不是插上電就會動：要透過 OS', 0, 5.2);
  say('硬體不是插上電就能用', 'OS 完全掌控 device 怎麼被使用');
  await step(tok);                                   // 254 why SSD is faster than hard disk: how files are placed
  idx('SSD 快、Hard disk 慢：檔案怎麼擺差在哪？', 3.4, -0.6, 1);
  say('為什麼 SSD 比 hard disk 快？', '從 OS 控制檔案擺放的 concept 就能得知一二');
}]);

// 6:42 chapter 0 roadmap
FRAG.push(['osA-roadmap', 'Chapter 0 地圖：mainframe、各種系統架構、特殊系統', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 2.2, 0]);
  await step(tok);                                   // 412 OS keeps evolving; the concepts never changed
  hd('Chapter 0：OS 的演進', 0, 6.4);
  good('概念從來沒變', 0, 5.5);
  say('OS 是不斷演進的過程', '但 concept 從來沒變過');
  await step(tok);                                   // 424.2 start from the mainframe
  const mf = blk('Mainframe', '#5d6b7a', -4.6, 1, 0, 2.4, 2, 1.6, 2);
  say('先講最早的電腦：mainframe', '現在看是古董，但已看得見 OS 的角色');
  void mf;
  await step(tok);                                   // 441 the basic functions an OS needs → the chapters
  bub('OS 需要的基本功能 → 後面的章節', -4.6, 2.6);
  say('從它看出 OS 需要哪些基本功能', '就是未來上課的那些 chapters');
  await step(tok);                                   // 450.3 computer system architecture: single-core PC … cluster
  const chain = ['Single core PC', 'Multi-core', 'Cluster', '分散式'];
  for (let k = 0; k < chain.length; k++) { blk(chain[k], JOBC[k], -0.6 + k * 1.9, 0.35, 1.6, 1.7, 0.6, 0.9, 1.5); await wt(tok, 180); }
  hd('Computer system architecture', 2.2, 1.4, 1.6);
  say('各式各樣架構的電腦', '從 single core PC 到分散式 cluster');
  await step(tok);                                   // 469 many kinds of systems → their OS designs differ
  note('系統不同 → 上面的 OS 設計也不同', 2.2, 4.2);
  say('有很多種電腦系統存在', '上面的作業系統設計當然不太一樣');
  await step(tok);                                   // 492 even simple PCs can be assembled into a bigger system
  idx('一般 PC 也能兜成更大的系統', 2.2, 3.4);
  say('一般的 PC，也能兜成更大更複雜的系統', '');
  await step(tok);                                   // 504.4 real-time and other special systems
  pkt('Real-time 等特殊系統', 2.2, 5.0);
  say('還有 real-time 這類特殊考量的電腦', 'broad overview：不只侷限在課本最基本的');
  await step(tok);                                   // 545.3 the mainframe's evolution: batch → multiprogramming → time sharing
  const ev = ['Batch', 'Multiprogramming', 'Time sharing'];
  for (let k = 0; k < 3; k++) { hot(ev[k], -5.6 + k * 2.2, 4.4 - k * 0.7); await wt(tok, 300); }
  say('mainframe 上 OS 的演進', 'batch → multiprogramming → time sharing');
  await step(tok);                                   // 566.2 multiprogramming & time sharing still fundamental today
  good('今天的電腦仍然如此', -3.4, 2.2, 1);
  say('multiprogramming 和 time sharing', '到今天仍然是最 fundamental 的 concept');
  await step(tok);                                   // 578 why the change → memory management, file system problems
  ['memory 管理', 'file system'].forEach((t, k) => note(t, -5 + k * 2.6, -0.5, 1.2));
  say('為什麼需要這樣改變？', '就會產生 memory 管理、檔案系統等問題');
}]);

// 9:58 what is a mainframe
FRAG.push(['osA-mainframe', 'Mainframe：體積大、昂貴、單一用途', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 2.2, 0]);
  const A = bag();
  await step(tok);                                   // 598 what is a mainframe system?
  hd('什麼是 Mainframe？', 0, 6.4);
  say('第一個：什麼是 mainframe system', '');
  await step(tok);                                   // 602 OS has many terms: like vocabulary
  ['batch', 'spooling', 'mainframe', 'time sharing'].forEach((t, k) => A(pkt(t, -4.5 + k * 3, 5.2)));
  say('OS 有一大堆名詞，第一次聽很生疏', '像讀英文要背單字');
  await step(tok);                                   // 634 think about what each term meant
  A(note('不只記名詞：想它當初的意義', 0, 4.2));
  say('不只是記名詞', '要去思考它當初的意義是什麼');
  await step(tok);                                   // 646 mainframe = the earliest computers: huge
  A.clear();
  const mf = blk('Mainframe', '#5d6b7a', 0, 1.6, 0, 4.2, 3.2, 2.2);
  const me = pal('人', '', '#e55a9b', 3.2, 1.6, 0.55);
  me.mood('wow');
  say('mainframe 形容最早期的電腦', '第一代電腦體積很大：哇，怎麼那麼大');
  await step(tok);                                   // 670.5 also extremely expensive: national-level research
  A(note('非常昂貴：國家級最尖端研究才用得到', 0, 4.4));
  say('另一個原因：它非常昂貴', '只有國家級研究或特殊用途才用得到');
  await step(tok);                                   // 692 big, slow I/O, strong compute, a single job
  A(bad('I/O 很慢', -3.6, 3.6)); A(good('計算 power 強', 3.6, 3.6));
  say('特性：體積大、I/O 很慢', '計算力比較強，做的事非常單一');
  await step(tok);                                   // 704 e.g. one bank's task, or scientific simulation
  A(idx('只管某家銀行的事 / 只做科學模擬', 0, -0.5, 1.4));
  say('例如只管理銀行的某件事', '或只做科學運算模擬，不是拿來玩遊戲');
  await step(tok);                                   // 722 how programs ran on it: batch → time sharing
  A(pkt('batch → … → time sharing', 0, 5.2));
  say('程式怎麼跑在這台電腦上？', '從 batch 一路演進到 time sharing');
  await step(tok);                                   // 762 not obsolete: today a mainframe = dedicated, heavy-workload machine
  A.clear();
  relabelBox(mf, 'Mainframe（今天）');
  good('專門處理某件事、大量工作的機器', 0, 4.0);
  say('mainframe 不是淘汰的東西', '今天指專門處理某件事、大量工作的機器');
  await step(tok);                                   // 782.2 e.g. bank servers
  pkt('銀行的 server', -3.6, 3.2);
  say('像現在銀行裡用的 server', '精準地說就是 mainframe');
  await step(tok);                                   // 801.4 designed for reliability: a component fails, no crash
  hot('reliability：零件壞了也不 crash', -3.6, 5.0);
  say('設計重點一：reliability 特別好', '就算有 component 壞掉，也不會整台 crash');
  await step(tok);                                   // 815.4 and security: CIA / FBI headquarters
  const lk = prop('lock', 3.4, 0, 1.6, 1.2);
  hot('security：不能隨便被 compromise', 3.4, 5.0);
  me.mood('sad');
  say('重點二：security', '像 CIA、FBI 總部的電腦');
  void lk;
}]);
function relabelBox(m, t) { if (m.userData.lbl) txt(m.userData.lbl, t); }

// 14:07 how batch worked: punch cards, job/load/input cards, memory split in two
FRAG.push(['osA-batchops', 'Batch 怎麼運作：卡片、operator、memory 切兩塊', async (tok) => {
  fresh([0, 4.8, 14], [0, 2.4, 0]);
  const A = bag();
  await step(tok);                                   // 856 programs were punch cards
  hd('Batch：最早的程式＝打洞的卡片', 0, 6.4);
  const deck = [];
  for (let k = 0; k < 5; k++) deck.push(blk('', '#f3e9c9', -5.4, 0.08 + k * 0.1, 1.6, 1.4, 0.08, 1.0));
  say('最早寫程式不是打鍵盤', '是在卡片上打洞：那就是你的程式');
  await step(tok);                                   // 877 a pile of cards fed into the machine
  const mach = blk('電腦', '#5d6b7a', -1.6, 1.2, 0, 2.4, 2.4, 1.6);
  for (const c of deck) { await slide(tok, c, -2.8, 1.2, 0.2, 200); kill(c); }
  say('寫好一大堆卡片，放進機器讀', '讀完才開始做運算');
  void mach;
  await step(tok);                                   // 898.4 one program at a time; everyone else waits
  const Q = [0, 1, 2].map((k) => A(pal('', '', JOBC[k], 2 + k * 1.3, 2.2, 0.6)));
  Q.forEach((b) => b.mood('sad'));
  A(bub('一人一個，慢慢排隊', 3.3, 1.6, 2.2));
  say('一次只能處理一個程式', '這個人做完，其他人才輪得到');
  await step(tok);                                   // 911 that's why it's called batch (批次檔)
  A(note('Batch = 批次：一批一批', 3.3, 3.0));
  say('所以叫 batch：一批一批', 'Windows 的 .bat 批次檔也是這個字');
  await step(tok);                                   // 941 each batch: a job card with the ID
  A.clear(); gone(mach);
  const cards = [['開始卡（ID）', COL.gold], ['程式', COL.user], ['Load 卡', COL.os], ['input 卡', COL.io]];
  const C = [];
  const showCard = (k) => { C[k] = blk(cards[k][0], cards[k][1], -4.6, 0.3 + k * 0.62, 0, 2.4, 0.5, 1.0); };
  showCard(0);
  say('每一批：先一張卡說「我要執行程式」', '有 ID，認得出是誰的');
  await step(tok);                                   // 957 then your program
  showCard(1);
  say('接著是你的程式', '');
  await step(tok);                                   // 960.6 a LOAD card: load into memory (CPU can't read disk)
  showCard(2);
  const memL = blk('', '#efe6d6', 2.6, 1.4, 0, 2.4, 2.8, 1.2);
  tag('memory', 'val', 2.6, 3.1, 0);
  void memL;
  await send(tok, '程式', 'pkt', V3(-4.6, 0.92, 0.6), V3(2.6, 0.6, 0.7), 800, true);
  say('Load 卡：把 compile 好的程式 load 進 memory', 'CPU 讀不到硬碟，只能 access memory');
  await step(tok);                                   // 980 run; input arrives as more cards
  showCard(3);
  say('開始執行；input 也是一疊卡片', '就像現在在 keyboard 上打字');
  await step(tok);                                   // 996 the result comes out as another card
  await send(tok, '結果卡', 'pkt', V3(2.6, 2.4, 0.7), V3(5.8, 3.6, 0.7), 700, true);
  say('結束時 output 另一張卡片：結果', '架構跟現在的電腦一樣');
  await step(tok);                                   // 1015 memory split in two: OS on top, user below
  blk('OS', COL.os, 2.6, 2.4, 0.66, 2.2, 0.7, 0.1);
  blk('', COL.user, 2.6, 1.0, 0.66, 2.2, 1.6, 0.1);
  tag('user 的空間', 'val', 2.6, 1.5, 0.75);
  say('memory 只拆兩塊：上面 OS、下面 user', 'OS 本身也是程式，也要佔 memory');
  await step(tok);                                   // 1045 done → flush, next user
  bad('用完整個清掉，換下一個人', 1.8, 4.1);
  say('切得死死的，因為不會有別人', '你用完就整個清掉，換下一個');
  await step(tok);                                   // 1071 users must order the cards; wrong order fails
  [1, 2].forEach((k) => glow(C[k], RED));
  say('使用者要自己排好卡片順序', '排錯就 fail 掉');
  await step(tok);                                   // 1079.5 an operator (a person) decides who goes first
  [1, 2].forEach((k) => glow(C[k], null));
  const op = A(pal('operator', '', '#c08a1f', -1, 2.2, 0.75));
  A(talk(op, 'A 先，再 C，再 B'));
  op.mood('happy');
  say('誰先誰後？是 operator（人）決定的', '跟電腦設計無關');
  await step(tok);                                   // 1103 the OS only transfers control
  A.clear();
  hot('OS 只做一件事：transfer control', -1, 4.4);
  say('電腦（OS）只做一件事', 'transfer control');
  await step(tok);                                   // 1123 initialize before a job, clean up after
  note('job 之間：initialize ＋ clean up', -1, 3.6);
  say('在一個 job 到下一個 job 之間', '負責 initialize 和 clean up');
  await step(tok);                                   // 1138 one user: total control, no security problem
  good('只有你在 run：total control、沒有 security 問題', -1, 2.8);
  say('反正只有一個人在 run', '空間都是你的：total control');
}]);

// 19:15 batch's flaws → multiprogramming and time sharing
FRAG.push(['osA-batchbad', 'Batch 的缺點 → multiprogramming、time sharing', async (tok) => {
  fresh([0, 4.8, 14], [0, 2.4, 0]);
  await step(tok);                                   // 1162 very many flaws
  hd('Batch system 的缺點', 0, 6.4);
  const os = pal('Batch OS', '', COL.idle, 0, 0, 1);
  say('這樣的電腦有非常多缺失', '但當時能用電腦就很幸福了');
  await step(tok);                                   // 1178 one: one job at a time
  bad('① One job at a time', -4.4, 4.8);
  say('第一：one job at a time', '一次一個程式，限制很大');
  await step(tok);                                   // 1207 two: no interaction
  bad('② No interaction', 0, 4.8);
  say('第二：no interaction', '丟一疊卡片進去，中間完全改不了');
  await step(tok);                                   // 1249.4 three, the biggest: an expensive CPU that idles
  bad('③ 很貴的 CPU 卻在 idle', 4.4, 4.8);
  const cpu = prop('cpu', 4.4, 0, 1.2, 1.1, 'CPU（zzz）');
  os.mood('sad');
  say('最大的問題：電腦很貴，CPU 卻常在 idle', '擺在那裡只是好看');
  void cpu;
  await step(tok);                                   // 1274 because I/O is very slow (mechanical card reading)
  pkt('讀卡片：機械式，很慢', -4.4, 1.6);
  say('因為 I/O 非常慢', '讀卡片是機械式的，跟電子的 CPU 差很多');
  await step(tok);                                   // 1303.8 still true today
  note('今天也一樣：CPU ≫ I/O', 0, 3.8);
  say('現在的電腦也一樣', '手機 CPU 每秒指令超多，I/O 還是遠慢於它');
  await step(tok);                                   // 1338.9 problems 1 and 3 → multiprogramming
  good('①③ → Multiprogramming：塞很多 program', -3.6, 2.6, 1.2);
  say('第一、第三個問題 → multiprogramming', '塞很多 program，讓 CPU 不 idle');
  await step(tok);                                   // 1363.9 interaction → time sharing: switch very fast
  good('② → Time sharing：很快很快地切換', 3.6, 3.3, 1.2);
  say('interaction → time sharing', '程式切換得很快，使用者就沒感覺');
  await step(tok);                                   // 1393.8 humans are slow: the computer quietly serves everyone
  os.mood('happy');
  idx('人比電腦慢很多 → 每個人都以為擁有這台電腦', 0, -0.6, 1.4);
  say('人的速度遠不及電腦', '電腦偷偷處理很多人的事，其實是 step by step');
  await step(tok);                                   // 1427 the batch OS: nothing to solve yet
  note('Batch OS：還不需要解決任何問題', 0, 5.6);
  say('第一代 batch OS：什麼都不用做', '下次介紹 multiprogramming 與 time sharing');
}]);

// ════════ ku1XgA2bZTE（第 2B 講：Computer-system architecture） ════════
// a CPU core drawn as a small chip with a name under it
const coreAt = (name, x, y, z = 0, s = 0.6) => { const c = prop('cpu', x, y, z, s); if (name) idx(name, x, y - 0.35, z + 0.6); return c; };
// 0:01 intro: many kinds of computer systems
FRAG.push(['osA-archintro', '各式各樣的 computer system architecture', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 2.2, 0]);
  await step(tok);                                   // 1.6 computer system architecture: forms vary
  hd('Computer system architecture', 0, 6.4);
  say('各式各樣的 computer system architecture', '從 hardware 看，電腦的組成方式五花八門');
  await step(tok);                                   // 45 first, the early PC — quickly
  prop('monitor', -4.8, 0, 0, 1.1);
  coreAt('1 個 core', -4.8, 2.4, 0, 0.5);
  say('先很快看一下最早期的 PC', '');
  await step(tok);                                   // 56.5 parallel systems: many CPU cores
  for (let k = 0; k < 4; k++) coreAt('', -0.9 + (k % 2) * 1.8, 0.1 + Math.floor(k / 2) * 0.01, -0.6 + Math.floor(k / 2) * 1.6, 0.6);
  hot('Parallel system：很多個 core', 0, 3.0);
  say('多介紹 parallel system', '很多電腦不只一個 CPU core 在計算');
  await step(tok);                                   // 64 loosely coupled: connected through a network
  const pcs = [3.6, 5.6].map((x) => prop('monitor', x, 0, 0, 0.8));
  line(3.6, 0.9, 0.3, 5.6, 0.9, 0.3, '#a8730f');
  hot('Loosely coupled：透過網路連起來', 4.6, 3.0);
  say('有的電腦 loosely coupled：透過網路連結', '例如 Internet，也可看成一個很遠的單一系統');
  void pcs;
}]);

// 1:48 personal computers
FRAG.push(['osA-pc', 'Personal computer：方便、即時回應、security 弱', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 2.2, 0]);
  const A = bag();
  await step(tok);                                   // 108 the simplest: a single core
  hd('PC：single core', 0, 6.4);
  const pc = prop('monitor', 0, 0, 0, 1.3);
  coreAt('single core', -2.2, 0, 0.6, 0.6);
  say('最單純的電腦：只有一個 single core', '早期的 personal computer 就是這樣');
  await step(tok);                                   // 123.4 personal: everyone owns their own system
  const me = pal('我的電腦', '', '#e55a9b', 2.6, 0.8, 0.8);
  me.mood('happy');
  say('為什麼叫 personal？', '每個人都能擁有自己的電腦系統');
  await step(tok);                                   // 135 what users care about: convenience
  A(good('① convenience：好不好用', -4, 4.8));
  say('買 PC、買手機最在乎：convenience', '手機花很多功夫讓它最方便使用');
  await step(tok);                                   // 149 responsiveness: it's interactive — time sharing
  A(good('② responsiveness：反應要快', 0, 4.8));
  A(bub('點了要等好幾秒？不滿意！', 2.6, 2.4, 0.8));
  me.mood('sad');
  say('還要 responsiveness：PC 是 interactive 的', '所以現在電腦一定是 time sharing');
  await step(tok);                                   // 181.9 I/O devices evolve very fast: keyboard → screen → voice
  const kb = A(prop('keyboard', -4.4, 0, 1.6, 0.8));
  await wt(tok, 400);
  A(pkt('觸控螢幕', -4.4, 1.6, 1.6)); await wt(tok, 300);
  A(pkt('聲控', -4.4, 2.3, 1.6));
  me.mood('happy');
  say('I/O device 演進得非常快', 'keyboard → 觸控螢幕 → 聲控');
  void kb;
  await step(tok);                                   // 231 each has its OS: Linux, Mac OS, Windows, Android
  A.clear();
  ['Linux', 'Mac OS', 'Windows', 'Android'].forEach((t, k) => A(pkt(t, -4.5 + k * 3, 5.6)));
  say('不同電腦都有自己的作業系統', 'Linux、Mac OS、Windows，手機的 Android');
  await step(tok);                                   // 258.2 their trait: convenience → good GUI
  A(good('GUI：Graphical User Interface', 0, 4.6));
  glow(pc.children[1], GREEN);
  say('這些 OS 的特色：convenience', '一定有很好的 GUI（圖形化介面）');
  await step(tok);                                   // 276.5 weakness: easily intruded — poor security
  glow(pc.children[1], RED);
  A(bad('security 很差：容易被入侵', 0, 3.8));
  say('缺點：很容易被入侵', 'security 通常非常差');
  await step(tok);                                   // 293 early PCs: software architecture not well defined
  A(idx('原因一：software architecture 沒 define 好', -3.6, 1.6, 1.6));
  say('原因一：PC 比較早期', 'software 架構沒設計好，容易被找到漏洞');
  await step(tok);                                   // 314 nobody imagined the Internet
  A(idx('原因二：當初沒想到 Internet', 3.6, 2.3, 1.6));
  say('最主要原因：當初的 PC 沒想到 Internet', '只要使用者不破壞自己的電腦就好');
  await step(tok);                                   // 332 now everything is online: unexpected outside users
  const bad1 = pal('外來者', '', '#5d6b7a', 5.8, 2.4, 0.6);
  await slide(tok, bad1.g, 3.6, 0, 2.4, 900);
  glow(pc.children[1], RED);
  say('現在都連網：沒授權、你沒預期的使用者', '也能透過網路修改你的東西');
  await step(tok);                                   // 350 news: Taiwan's ATMs got malware and spat out cash
  A(note('新聞：ATM 被植入病毒，自動吐鈔', 0, -1.2, 1.4));
  say('前陣子的新聞：台灣的 ATM 被植入病毒', '會自動吐鈔票');
}]);

// 6:35 multiprocessor (tightly coupled) systems
FRAG.push(['osA-mp', 'Multiprocessor：tightly coupled、共用 memory', async (tok) => {
  fresh([0, 4.8, 14], [0, 2.2, 0]);
  const A = bag();
  await step(tok);                                   // 395 so far: one user, one core
  const one = A(coreAt('1 個 core', 0, 0.2, 0, 0.8));
  say('剛剛：一個使用者、一個 CPU core', '');
  void one;
  await step(tok);                                   // 405.8 more compute → many cores in one system
  A.clear();
  const C = [-3.6, -1.2, 1.2, 3.6].map((x, k) => coreAt('core ' + k, x, 2.4, 0, 0.7));
  say('計算量越來越大', '買來的電腦通常不只一個 core');
  void C;
  await step(tok);                                   // 417 tightly connected → multiprocessor system
  hd('Multiprocessor system', 0, 6.4);
  say('很多 core 很緊密地連在一起', '叫 multiprocessor system');
  await step(tok);                                   // 432 connected by a system bus — hardware lines
  blk('system bus', '#a8730f', 0, 1.6, 0, 9, 0.15, 0.3);
  for (const x of [-3.6, -1.2, 1.2, 3.6]) line(x, 1.7, 0, x, 2.4, 0, '#a8730f');
  say('什麼叫緊密？透過 system bus 連起來', '就是 hardware 的線');
  await step(tok);                                   // 446.7 tightly coupled: all in one box
  ctx.tile(V3(0, 0.03, 0), 10.5, 4.6, '#efe6d6');
  hot('Tightly coupled：全部在一個盒子裡', 0, 5.4);
  say('也叫 tightly coupled', '買來一個盒子，全部用 wire 接在一起');
  await step(tok);                                   // 465 memory (and I/O) are shared
  const mem = blk('shared memory', COL.mem, -2, 0.5, 0, 3.6, 0.8, 1.2);
  blk('I/O', COL.io, 2.6, 0.5, 0, 2, 0.8, 1.2);
  line(-2, 0.9, 0, -2, 1.6, 0, '#a8730f'); line(2.6, 0.9, 0, 2.6, 1.6, 0, '#a8730f');
  say('電腦＝memory、CPU、I/O', 'I/O device 共用，memory 也是共用的');
  await step(tok);                                   // 479 every program sees the same memory content
  const v = mem.userData.lbl; txt(v, 'shared memory：x = 5');
  say('所有 core 上的程式', '都看到相同的 memory content');
  await step(tok);                                   // 488 modify at the same time → synchronization
  const w6 = bad('core 0 寫 x = 6', -3.6, 3.1, 0.6); await wt(tok, 400);
  const w7 = bad('core 3 寫 x = 7', 3.6, 3.1, 0.6); await wt(tok, 400);
  txt(v, 'shared memory：x = ?'); glow(mem, RED);
  say('同時去修改', '就造成 synchronization 的問題');
  await step(tok);                                   // 507 even a single CPU chip is multi-core
  glow(mem, null); txt(v, 'shared memory：x = 5'); gone(w6, w7);
  A(note('買一顆 CPU chip：其實四核、八核', 0, 4.6));
  say('就算只買一顆 CPU chip', '它也是多核心：已經是 tightly coupled 的平行系統');
  await step(tok);                                   // 541.6 why: 1. throughput
  A(good('① throughput：每秒計算量 ↑', -4.2, 3.8, 1));
  say('原因一：throughput', '同樣空間塞更多核心，計算能力提高');
  await step(tok);                                   // 574 2. economy: share memory, I/O, motherboard
  A(good('② economy：共用 → 省成本', 0, 3.8, 1));
  say('原因二：economy', 'memory、I/O、主機板都共用，省下成本');
  await step(tok);                                   // 610 3. reliability: one core fails, others continue
  A(good('③ reliability：一個壞了還能跑', 4.2, 3.8, 1));
  say('原因三：reliability', '一個 core 壞了，其他的還能繼續運作');
  await step(tok);                                   // 640 remember throughput and economy
  A(hot('要記：throughput、economical', 0, -0.8, 1.4));
  say('大家比較需要記得', 'throughput 跟 economical 這兩個原因');
}]);

// 10:52 SMP vs AMP
FRAG.push(['osA-smp', 'Symmetric（SMP）vs Asymmetric（AMP）', async (tok) => {
  fresh([0, 4.8, 14], [0, 2.2, 0]);
  const A = bag();
  await step(tok);                                   // 652 today all computers are multiprocessor
  hd('Multiprocessor 再分兩種', 0, 6.4);
  say('現在的電腦系統全部都是 multiprocessor', '');
  await step(tok);                                   // 662 symmetric vs asymmetric
  hd('SMP（Symmetric）', -3.6, 5.6); hd('AMP（Asymmetric）', 3.6, 5.6);
  say('依角色分：Symmetric（SMP）', '和 Asymmetric（AMP）');
  await step(tok);                                   // 683 processors play different roles
  say('兩種系統裡 processor 扮演的角色', '不太一樣');
  await step(tok);                                   // 692 SMP: all identical, no master; the OS places programs
  const S = [-5.1, -4.1, -3.1, -2.1].map((x) => pal('', '', COL.cpu, x, 1, 0.6));
  const osS = pal('OS', '', COL.os, -3.6, -1.2, 0.6);
  for (let k = 0; k < 4; k++) { await send(tok, 'P' + (k + 1), 'pkt', V3(-3.6, 0.8, -1.2), V3(-5.1 + k, 1.3, 1), 250); S[k].set('P' + (k + 1)); }
  A(bub('大家對等，沒有 master', -3.6, 3.0, 1));
  say('SMP：所有 core 角色完全相同', '由 OS 決定哪個程式放哪個 core');
  void osS;
  await step(tok);                                   // 720.5 today's CPUs are all SMP — simpler
  A(good('現在手上的 CPU 幾乎都是 SMP', -3.6, 4.6));
  say('現在大家手上的 CPU 都是 SMP', '比較簡單');
  await step(tok);                                   // 728 every core computes — none wasted on managing
  S.forEach((b) => b.mood('happy'));
  say('每個 core 都去做計算', '沒有人只負責管別人，分擔 loading');
  await step(tok);                                   // 755.1 drawback: synchronizing programs needs locking
  A(bad('缺點：要同步 → locking', -3.6, 3.8));
  S[1].mood('sad');
  say('缺點：要 synchronize 不同 core 上的程式', '需要 locking 這類機制');
  await step(tok);                                   // 765 so the number of cores can't scale very high
  A(idx('overhead 多 → core 數量 scale 不大', -3.6, -0.3, 1.6));
  say('規則、protocol 都是 overhead', 'SMP 的 core 數量沒辦法漲到很大');
  await step(tok);                                   // 797 consumer computers: SMP is enough
  say('一般消費性電腦', '用 SMP 就足夠了');
  await step(tok);                                   // 808.6 supercomputers: asymmetric
  const M = pal('master', '👑', COL.gold, 3.6, -1.2, 0.75);
  const W = [2.1, 3.1, 4.1, 5.1].map((x) => pal('', '', COL.cpu, x, 1, 0.6));
  say('Supercomputer 等要大量擴充的', '採用 Asymmetric（不對等）');
  await step(tok);                                   // 826 one master core manages everyone; instructions go through it
  for (let k = 0; k < 4; k++) await send(tok, '指令', 'pkt', V3(3.6, 1.2, -1.2), V3(2.1 + k, 1.3, 1), 250);
  M.mood('happy');
  say('有一個 master core 專門管理其他人', '指令都先經過它，再交給其他 core');
  await step(tok);                                   // 845.7 so it scales to more cores
  A(good('可以 scale 到更多 core', 3.6, 3.8));
  say('所以 AMP 可以到比較大的 scale', '');
  await step(tok);                                   // 850 drawback: the master does no user computation
  M.mood('sad'); A(bad('缺點：master 不做使用者的計算 → 浪費', 3.6, 4.6));
  say('缺點：master 基本上不做使用者的計算', '只是在管理，等於浪費掉一個');
  void W;
  await step(tok);                                   // 872 you rarely see AMP in what you buy
  note('一般買的少見 AMP，但要知道兩種角色', 0, -0.9, 1.6);
  say('一般買的比較少見', '但要知道 core 依角色分 SMP 和 AMP');
}]);

// 14:54 multi-core processors and cache coherence
FRAG.push(['osA-cache', 'Multi-core：每個 core 有自己的 cache，要保持一致', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.4, 0]);
  await step(tok);                                   // 894 one CPU chip holds many cores
  hd('Multi-core processor', 0, 6.6);
  ctx.tile(V3(0, 1.0, 0), 7.4, 2.4, '#d6e6f6');
  idx('一顆 CPU chip', -4.8, 1.1, 1.4);
  const xs = [-2.2, 2.2];
  xs.forEach((x, k) => coreAt('Core ' + k, x, 1.1, -0.4, 0.6));
  say('一個 CPU chip 上通常有很多 core', '叫 multi-core processor');
  await step(tok);                                   // 915 the cores share the same memory on the motherboard
  const mem = blk('memory：x = 5', COL.mem, 0, 0.3, 2.6, 4, 0.5, 0.8);
  say('memory 不在 CPU 上，在主機板上', '所有 core 共用、看到相同的 memory content');
  await step(tok);                                   // 939 caches sit between memory and the registers
  const L = xs.map((x) => blk('L1 cache', '#f3d36b', x, 1.6, 0.6, 1.6, 0.35, 0.6));
  say('memory 到 register 之間有 cache', '把常用資料 cache 起來加速');
  await step(tok);                                   // 967 levels L1, L2, L3
  blk('L2 / L3', '#e9c46a', 0, 1.6, 0.6, 1.6, 0.35, 0.6);
  say('cache 又分 Level 1、2、3', '複雜的系統有很多層');
  await step(tok);                                   // 974.7 L1 closest to the registers: each core has its own
  L.forEach((m) => glow(m, GOLD));
  say('最上層的 L1 最接近 register', '基本上每個 core 一定有自己的');
  await step(tok);                                   // 988 your data gets copied into different cores' caches
  const cp = xs.map((x) => pkt('x = 5', x, 2.5, 0.6));
  for (let k = 0; k < 2; k++) await travel(tok, cp[k], V3(0, 1.2, 2.6), V3(xs[k], 2.5, 0.6), 500);
  say('資料會被 copy 到不同 core 的 cache', '');
  await step(tok);                                   // 999 copies should hold the same content
  good('只是複製：內容應該相同', 0, 3.4);
  say('它只是複製', '所以內容應該要相同');
  await step(tok);                                   // 1007 core 0 writes: only its own cache changes
  txt(cp[0], 'x = 9'); glow(L[0], RED);
  bad('Core 0 只改到自己的 cache', -2.2, 4.2);
  say('Core 0 改寫內容時，可能只改到自己的 cache', '不同 copy 的內容就不一樣了');
  await step(tok);                                   // 1033 hardware keeps them consistent: reflect to memory / other caches
  await send(tok, 'x = 9', 'good', V3(-2.2, 2.5, 0.6), V3(0, 1.2, 2.6), 500);
  if (mem.userData.lbl) txt(mem.userData.lbl, 'memory：x = 9');
  await send(tok, 'x = 9', 'good', V3(-2.2, 2.5, 0.6), V3(2.2, 2.5, 0.6), 500);
  txt(cp[1], 'x = 9'); glow(L[0], GREEN); glow(L[1], GREEN);
  say('現在電腦用 hardware 解決', '改寫時反映到 memory、或所有有這份資料的 cache');
  await step(tok);                                   // 1071 programs switch cores every few ms
  const prg = pal('程式', '', '#e55a9b', -2.2, 3.4, 0.6);
  await slide(tok, prg.g, 2.2, 0, 3.4, 900);
  say('程式常被切換：先在 Core 0', '幾個 millisecond 後可能換到 Core 1');
  await step(tok);                                   // 1095 seeing a different value would break programs
  prg.mood('happy');
  note('同一個 address 要看到同樣的值', 2.2, 4.4);
  say('同一個變數沒動它，就該是同樣的值', '看到不一樣，程式就出問題');
  await step(tok);                                   // 1102.8 multi-core processors must keep caches consistent
  hot('cache 資料一致（coherence）', 0, 5.2);
  say('multi-core processor 要處理的', '就是 make sure cache 的資料一致');
  await step(tok);                                   // 1116 not via the memory bus: burned onto one chip — most tightly coupled
  good('同一個 chip 上：最 tightly coupled', 0, -0.6, 1.6);
  say('multi-core 是在單一 CPU 上就有好幾個 core', '燒在同一個 chip：最 tightly coupled');
}]);

// 19:10 many-core processors: GPGPU, SIMD, Xeon Phi
FRAG.push(['osA-many', 'Many-core：GPGPU 與 SIMD', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.4, 0]);
  const A = bag();
  await step(tok);                                   // 1150 compute demand: pack them ever tighter
  hd('Many-core processor', 0, 6.6);
  say('計算量需求越來越大', '希望連結得越緊密越好');
  await step(tok);                                   // 1164 many-core: hundreds of cores on one device
  const G = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 12; c++) G.push(blk('', '#7fb87a', -3.3 + c * 0.6, 0.2 + r * 0.01, -1.2 + r * 0.6, 0.45, 0.3, 0.45));
  A(idx('核心數到幾百的等級（示意）', 0, -0.4, 1.4));
  say('Many-core：同一個 processor 上', '計算核心數到幾百的等級');
  await step(tok);                                   // 1181.7 more parallelism → more powerful
  G.forEach((m, k) => { if (k % 3 === 0) glow(m, GREEN); });
  say('越多 core，平行度越高', '就越 powerful');
  await step(tok);                                   // 1189 the most common: GPGPU
  hot('GPGPU', -4.6, 3.6);
  say('現在最常見的：GPGPU', '');
  await step(tok);                                   // 1200 the graphics card used for computing
  A(bub('顯示卡：以前只拿來 display 圖形', -4.6, 2.8));
  say('用顯示卡來做計算', '以前它只是拿來顯示圖形');
  await step(tok);                                   // 1210 general programs also contain graphics-like computation
  A.clear();
  A(good('一般程式也有很多「像圖形計算」的部分', 0, 4.6));
  say('一般 application 裡也有很多', '很適合這種型別的計算 → 放 GPU 更快');
  await step(tok);                                   // 1229 so many cores because something is sacrificed
  A(note('為什麼能塞幾百個 core？犧牲了一些東西', 0, 5.4));
  say('GPU 能塞幾百個 core', '是因為犧牲掉了一些東西');
  await step(tok);                                   // 1250.3 SIMD: single instruction, multiple data
  A.clear();
  A(hot('SIMD：Single Instruction, Multiple Data', 0, 5.6));
  say('它是 SIMD 的 processor', 'Single Instruction Multiple Data');
  await step(tok);                                   // 1256 700 processors — only one instruction at a time
  const ins = A(pkt('instruction：× 2', 0, 4.4));
  void ins;
  say('就算有 700 個 processor', '同一時間只能做同一個 instruction');
  await step(tok);                                   // 1265.8 … applied to different data
  G.forEach((m) => glow(m, GOLD));
  const D = [];
  for (let c = 0; c < 6; c++) D.push(pkt(String(c + 1), -3 + c * 1.2, 2.2, 1.2));
  await wt(tok, 500);
  D.forEach((d, c) => txt(d, String((c + 1) * 2)));
  say('但同一個 instruction', '可以套用到不同的 data（multiple data）');
  await step(tok);                                   // 1272 array / matrix computation: very fast
  A(good('array / matrix 計算：每個 row、column 同時算', 0, 3.4));
  say('像 linear algebra 的 array、matrix 計算', '同樣的事放到不同 row、column：非常快');
  await step(tok);                                   // 1302 normal programs: lots of if-else → not suitable
  G.forEach((m, k) => glow(m, k % 2 ? RED : null));
  A(bad('很多 if-else 分支：不適合 GPU', 0, -0.6, 1.6));
  say('一般程式有很多 if else condition', '同時要做不同篩選，就不適合放 GPU');
  await step(tok);                                   // 1336.3 Intel's answer: Xeon Phi (~50 cores, in between)
  G.forEach((m) => glow(m, null)); D.forEach(kill);
  A.clear();
  A(pkt('Intel Xeon Phi：約 50 個 core', 0, 4.4));
  A(idx('介於傳統 CPU 與 SIMD 的 GPU 之間，比較 flexible', 0, 3.6));
  say('Intel 也做了 Xeon Phi', '介於傳統 CPU 和 GPU 之間');
  await step(tok);                                   // 1380.7 the trend: more cores, packed tightly
  good('趨勢：core 越多、越緊密，跑大量 thread / process', 0, 5.4);
  say('現在設計 processor 的想法', '增加 core 數量、緊密放在一起');
}]);

// ════════ veTbz_7sDtM（第 2C 講：Computer-system architecture 續） ════════
// 0:01 multiprocessor vs multi-core vs many-core, as you'd see them when buying a computer
FRAG.push(['osA-mcmp', 'Multiprocessor、multi-core、many-core 怎麼分', async (tok) => {
  fresh([0, 4.8, 14], [0, 2.2, 0]);
  const A = bag();
  await step(tok);                                   // 1 when buying a computer: which is which?
  hd('買電腦時怎麼分？', 0, 6.4);
  ctx.tile(V3(0, 0.03, 0), 11, 4.6, '#d9e4cf');
  idx('motherboard（主機板）', -4.2, 0.1, 2.5);
  say('如果難跟現實的電腦連在一起', '重新看：買電腦時怎麼分這三個名詞');
  await step(tok);                                   // 46 open the case: several CPU / GPU slots → multiprocessor
  const S = [-3.6, -1.2].map((x) => prop('cpu', x, 0.05, -0.8, 1));
  const gslot = blk('GPU 卡', '#7fb87a', 2.6, 0.3, -0.8, 2.6, 0.5, 1.2);
  hot('Multiprocessor computer system', 0, 5.4);
  say('打開機殼：有多個 CPU 或 GPU 的插槽', '就叫 multiprocessor computer system');
  void gslot;
  await step(tok);                                   // 72 still one computer, connected on the motherboard
  good('還是一台電腦，在主機板上連起來', 0, 4.6);
  say('它還是一台電腦', '在 motherboard 上連起來');
  await step(tok);                                   // 88 multi-core: ONE processor with several cores
  A(hd('Multi-core processor', -2.4, 2.8));
  const z = A(blk('', '#c9d3dc', -2.4, 1.6, -0.8, 1.6, 0.1, 1.6));
  for (let k = 0; k < 4; k++) A(blk('core', COL.cpu, -2.8 + (k % 2) * 0.8, 1.75, -1.2 + Math.floor(k / 2) * 0.8, 0.6, 0.2, 0.6));
  say('一個 CPU 裡就有多個計算核心', '叫 multi-core processor（本身不算 computer system）');
  void z;
  await step(tok);                                   // 113 combine them: multi-core chips in a multiprocessor system
  S.forEach((s) => glow(s.children[1], GREEN));
  say('兩者結合：multiprocessor 系統', '插上 multi-core 的 processor，核心數一直增加');
  await step(tok);                                   // 133.3 many-core: one device, like a small computer — a card
  A.clear();
  hot('Many-core：一張卡，像小型電腦', 2.6, 2.4);
  for (let k = 0; k < 10; k++) blk('', '#4f8a4a', 1.6 + (k % 5) * 0.5, 0.65, -1.0 + Math.floor(k / 5) * 0.4, 0.35, 0.15, 0.3);
  say('Many-core：單一 device', '自己就像一個小型電腦系統，是一張卡');
  await step(tok);                                   // 162 you may plug in 8 GPU cards, each with 100+ cores
  note('可以插 8 張 GPU 卡；每張 100 多個 core', 2.6, 3.2);
  say('最新的電腦可能插 8 張 GPU 卡', '每張卡裡面塞進 100 多個 core');
  await step(tok);                                   // 186 so many → hardware design revolution, different instruction model
  const hwNote = idx('hardware design 重新做過、指令處理方式不同', 0, -0.6, 2);
  say('能塞這麼多，代表 hardware design', '和指令處理方式都和傳統 CPU 不同');
  await step(tok);                                   // 215 very new and varied: GPU, Xeon Phi, Tile64
  ['GPU', 'Xeon Phi', 'Tile64'].forEach((t, k) => pkt(t, -3 + k * 3, 6.0));
  say('很新、型態多樣', 'GPU、Intel 的 Xeon Phi、Tile64');
  await step(tok);                                   // 240 Tile64: plain CPUs, but a big effort on the on-chip network
  const T = [];
  for (let k = 0; k < 4; k++) T.push(pal('', '', COL.cpu, -1.2 + k * 1.2, 2.6, 0.5));
  line(-1.2, 0.25, 2.6, 2.4, 0.25, 2.6, '#a8730f');
  kill(hwNote);
  idx('chip 上的 interconnect（network）', 0.6, -0.1, 3.4);
  say('Tile64 放的是傳統 CPU', '功夫下在 chip 上的 interconnect（network）');
  await step(tok);                                   // 263 otherwise congestion: you wait for me → like a single CPU
  T.forEach((b) => b.mood('sad'));
  bad('塞車：你等我、我等你 → 64 個像 1 個', 0.6, 2.0, 2.6);
  say('東西塞在小空間又共用', '不處理 congestion，64 個 CPU 跑起來像 1 個');
  await step(tok);                                   // 299 lots of current research here
  T.forEach((b) => b.mood('happy'));
  good('這幾年很多研究與未來發展在這裡', 0, -1.3, 2);
  say('非常複雜', '這幾年很多研究和未來發展都在這邊');
}]);

// 5:18 UMA vs NUMA
FRAG.push(['osA-numa', 'UMA vs NUMA：memory access time 相不相同', async (tok) => {
  fresh([0, 5.2, 14.5], [0, 2, 0]);
  const A = bag();
  await step(tok);                                   // 318 another view: from the memory side
  hd('從 memory 看系統架構', 0, 6.6);
  say('另一個角度：從 memory 看', '計算就是 processor ＋ memory');
  await step(tok);                                   // 341.5 two kinds: UMA and NUMA
  A(pkt('UMA', -2, 5.6)); A(pkt('NUMA', 2, 5.6));
  say('multiprocessor 在 memory 這邊分兩大類', 'UMA 和 NUMA');
  await step(tok);                                   // 360.8 many CPUs must share memory
  const C = [-4.5, -1.5, 1.5, 4.5].map((x) => A(prop('cpu', x, 2.6, 0, 0.8)));
  const mem = A(blk('memory', COL.mem, 0, 0.4, 0, 6, 0.6, 1.2));
  say('一定有多個 CPU，memory 也要 share', 'CPU 越來越多時，怎麼 share？');
  void mem;
  await step(tok);                                   // 377.8 uniform: everyone plugs in the same way
  for (const x of [-4.5, -1.5, 1.5, 4.5]) A(line(x, 2.6, 0, x * 0.4, 0.7, 0, '#a8730f'));
  A(hot('UMA：Uniform Memory Access', 0, 4.4));
  say('Uniform：大家都用同樣的方式接上去', 'Uniform Memory Access（UMA）');
  await step(tok);                                   // 395 the natural fit for SMP
  A(idx('最適合 SMP：大家都一樣', 0, -0.5, 1));
  say('最適合常見的 SMP', '');
  await step(tok);                                   // 408.7 the point: the same memory access time
  A(good('重點：memory access time 都相同', 0, 3.6));
  say('重點不是接法，是 memory access time', '程式跑在哪個 CPU、哪個 core，速度都一樣');
  await step(tok);                                   // 446 users needn't care which CPU the program runs on
  A(note('不用在意程式跑在哪個 CPU', 0, 5.2));
  say('一般電腦、手機都是這樣', '使用者不必在意程式跑在哪個 CPU');
  void C;
  await step(tok);                                   // 464.6 scale up → contention on the memory bus → bottleneck
  A(bad('CPU 一多：大家搶同一條 bus → 變慢', 0, 1.6, 1.2));
  say('scale 變大、CPU 變多時', '大家搶同一個 memory channel / bus：bottleneck');
  await step(tok);                                   // 496 NUMA: hierarchy
  A.clear();
  hot('NUMA：Non-Uniform Memory Access（hierarchy）', 0, 5.6);
  say('NUMA：non-uniform', '要管的東西多，最好的 solution 是 hierarchy');
  await step(tok);                                   // 512 four regions, each with its own local memory
  const R = [[-3.3, -1.2], [3.3, -1.2], [-3.3, 1.6], [3.3, 1.6]];
  const mems = R.map(([x, zz]) => blk('memory', COL.mem, x, 0.3, zz, 2.2, 0.5, 0.9));
  R.forEach(([x, zz]) => { prop('cpu', x - 0.6, 0.6, zz, 0.45); prop('cpu', x + 0.6, 0.6, zz, 0.45); });
  ['A', 'B', 'C', 'D'].forEach((t, k) => idx('區域 ' + t, R[k][0] * 1.7, 0.3, R[k][1]));
  say('把 CPU 切成四個區域（這個例子）', '每個區域有一塊自己的 memory');
  await step(tok);                                   // 524 local memory vs remote memory
  glow(mems[2], GREEN);
  good('local：直接、快', -3.3, 2.4, 1.6);
  say('同區的 memory = local memory', '其他區的 = remote memory');
  await step(tok);                                   // 552 remote: go through that memory's controller (indirect)
  const p = pkt('讀資料', -3.3, 1, 1.6);
  await travel(tok, p, V3(-3.3, 1, 1.6), V3(3.3, 1, -1.2), 1200);
  glow(mems[1], RED);
  bad('remote：先找那塊的 controller → 間接', 3.3, 2.2, -1.2);
  say('也連得到 remote memory', '但要先跟它的 controller 溝通：間接');
  await step(tok);                                   // 563.1 benefit: hierarchy → can build much bigger machines
  good('好處：hierarchy → 可以 scale 很大（4 → 16 個 CPU）', 0, 4.6);
  say('好處：hierarchy 可以建更大的電腦', '這裡 4 區，每區又有好幾個 CPU');
  await step(tok);                                   // 578.8 drawback: remote is slower → non-uniform
  note('local 快、remote 慢 → non-uniform', 0, 3.8);
  say('缺點：remote access 路線比較長', 'access time 不同了 → non-uniform');
  await step(tok);                                   // 599 where you allocate memory matters
  say('執行程式、allocate memory 時', '擺在哪裡，效能有差別');
  await step(tok);                                   // 612 program top-left, memory bottom-right → slow
  const prog = pal('程式', '', '#e55a9b', -5.4, 0.2, 0.5);
  glow(mems[1], RED); glow(mems[2], null);
  bad('程式在左上、memory 在右下 → 變慢', 0, 0.9, 3.2);
  prog.mood('sad');
  say('程式 run 在左上角、memory 卻 allocate 在右下', 'OS 沒管的話就變成 remote access');
  await step(tok);                                   // 631 a good OS manages this, or flags let you pin / allocate locally
  glow(mems[1], null); glow(mems[0], GREEN);
  prog.mood('happy');
  good('好的 OS 自動管理，或用 flag 指定 local', 0, 0.2, 3.2);
  say('好的 OS 會自動管理', '或用 flag 指定程式跑哪、只從 local 要 memory');
  await step(tok);                                   // 673.1 high-performance systems are mostly NUMA
  hot('高效能、大 scale 的電腦多半是 NUMA', 0, -0.6, 3.2);
  say('講究效能、scale 大的電腦多半是 NUMA', 'OS 和使用者要更注意效能');
}]);

// 11:51 distributed (loosely coupled) systems
FRAG.push(['osA-distsys', 'Distributed system：loosely coupled、memory 不共用', async (tok) => {
  fresh([0, 4.8, 14], [0, 2.2, 0]);
  const A = bag();
  await step(tok);                                   // 710.9 so far: tightly coupled — all inside one box
  const box = A(blk('一個 box（server）', '#c9d3dc', 0, 0.8, 0, 3.4, 1.6, 1.6));
  A(idx('tightly coupled：全在同一台電腦 box 裡', 0, 2.2));
  say('剛才的 tightly coupled 再複雜', '都在同一台電腦 box 裡');
  void box;
  await step(tok);                                   // 730 distributed systems: loosely coupled, via the network
  A.clear();
  hd('Distributed system（loosely coupled）', 0, 6.4);
  const X = [-4.8, -1.6, 1.6, 4.8];
  X.forEach((x) => prop('monitor', x, 0, 0, 0.9));
  line(-4.8, 0.3, 0.6, 4.8, 0.3, 0.6, '#a8730f');
  say('Distributed system：loosely coupled', '透過網路（internet）連線');
  await step(tok);                                   // 761 like in school: link PCs to work on the same job
  pkt('一起做同一件事', 0, 2.4);
  say('像學校把電腦串在一起', '做同樣的事，就是分散式系統');
  await step(tok);                                   // 770.4 the Internet itself is a distributed system
  idx('廣義來說：Internet 也是', 0, -0.5, 1);
  say('把 Internet 看成一個系統也可以', '它就是透過 cable 連起來的分散式系統');
  await step(tok);                                   // 786.3 the big difference: every memory is local
  X.forEach((x) => blk('memory', COL.mem, x, 2.0, 0, 1.2, 0.35, 0.6));
  say('最大差別：連線方式，還有 memory', '每台電腦都有 memory，但不 share');
  await step(tok);                                   // 806 nobody can use my memory directly — only through my OS
  await send(tok, '直接用你的 memory？', 'bad', V3(-4.8, 3, 0), V3(-1.8, 2.6, 0), 800);
  A(bad('✗ 要透過我的程式、我的 OS', -1.6, 3.2));
  say('別人不能直接用我電腦上的 memory', '一定要透過我的程式、我的 OS');
  await step(tok);                                   // 827 purpose differs: not mainly performance
  A.clear();
  say('目的跟之前不一樣', '之前都講 performance');
  await step(tok);                                   // 839 1. resource sharing
  good('① resource sharing：去你那抓照片、檔案', -3.2, 4.6);
  await send(tok, '📷', 'pkt', V3(1.6, 1.4, 0), V3(-1.6, 1.4, 0), 700);
  say('原因一：resource sharing', '上網就是為了 share resource、information');
  await step(tok);                                   // 853.7 2. load balancing / sharing
  good('② load balancing：工作太多分給別台', 3.2, 4.6);
  await send(tok, '工作', 'pkt', V3(4.8, 1.4, 0), V3(1.6, 1.4, 0), 700);
  say('原因二：load balancing', '一台工作量太多，移一些給另一台分擔');
  await step(tok);                                   // 891.6 3. reliability — what distributed systems care about most
  hot('③ reliability：最注重的', 0, 5.4);
  say('原因三：reliability', '分散式系統才是真正最注重 reliability');
  await step(tok);                                   // 914 each machine is independent: one fails, others unaffected
  const dead = blk('💥', '#5d6b7a', -4.8, 2.9, 0, 0.6, 0.6, 0.6);
  void dead;
  bad('一台壞了', -4.8, 3.6);
  good('其他台不受影響', 1.6, 3.6);
  say('每台電腦是獨立的，只在溝通資訊', '一台壞掉不會影響另一台');
  await step(tok);                                   // 933 cloud computing: hand the work over, back data up on many machines
  await send(tok, '工作交給別台', 'pkt', V3(-4.8, 1.4, 0), V3(-1.6, 1.4, 0), 700);
  note('資料備份在很多台：同時壞掉機率很低', 1.6, -0.6, 1.2);
  say('像 cloud computing：一台壞了交給另一台', '資料備份在很多台，同時壞的機率很低');
  await step(tok);                                   // 960 a multiprocessor is one machine: a broken memory bus kills it all
  idx('multiprocessor 是同一台：memory bus 壞了整台就毀', 0, 0.6, 2.4);
  say('multiprocessor 畢竟是同一台 machine', 'memory bus 壞了，整台就毀了');
}]);

// 16:34 client-server
FRAG.push(['osA-cs', 'Client-server：server 集中控制', async (tok) => {
  fresh([0, 4.8, 14], [0, 2.2, 0]);
  const A = bag();
  await step(tok);                                   // 994.3 two architectures: peer-to-peer and client-server
  hd('分散式系統的架構', 0, 6.4);
  pkt('Client-server', -2.4, 5.6); pkt('Peer-to-peer', 2.4, 5.6);
  say('分散式系統的架構簡單分兩種', 'peer-to-peer 和 client-server');
  await step(tok);                                   // 1011 client-server = master-slave
  const srv = pal('server', '👑', COL.gold, 0, -0.8, 1);
  const cl = [-4.4, -2.2, 2.2, 4.4].map((x) => pal('client', '', COL.cpu, x, 1.8, 0.65));
  say('Client-server：簡單講就是 master-slave', '');
  await step(tok);                                   // 1017 clients / workers do what the server says
  for (let k = 0; k < 4; k++) await send(tok, '做這個', 'pkt', V3(0, 1.2, -0.8), V3([-4.4, -2.2, 2.2, 4.4][k], 1.2, 1.8), 220);
  srv.mood('happy');
  say('client / worker 透過 server 的控制', '才知道要做什麼：centralized control');
  await step(tok);                                   // 1036.8 e.g. FTP: are you the server or the client?
  A(note('例：FTP server / FTP client', 0, 4.6));
  say('常見例子：FTP', '架的是 FTP server 還是 client？角色很明確');
  await step(tok);                                   // 1067.2 easy to build
  A(good('好處：容易建起來', -3.6, 3.8));
  say('這種架構比較容易建起來', '網路課的作業常寫這種系統');
  await step(tok);                                   // 1080 drawback: the server is often a bottleneck
  srv.mood('sad');
  A(bad('壞處：server 是 bottleneck', 3.6, 3.8));
  say('壞處很明顯：server 往往是 bottleneck', '');
  await step(tok);                                   // 1089 cloud data centers (Google, Microsoft) still use it
  A(idx('Google、Microsoft 的雲端 data center 仍用 client-server', 0, -0.4, 2.6));
  say('雲端的 data center 為了方便', '還是用 client-server，但下了很多功夫');
  await step(tok);                                   // 1106 the server role can be played by ten machines; a backup takes over
  const bk = pal('backup server', '', COL.gold, 2.8, -0.8, 0.75);
  await wt(tok, 300);
  glow(srv.body, RED); srv.mood('sad');
  bk.mood('happy'); await bk.hop(tok);
  say('server 不一定只是一台：可用十台擔任', 'master server 壞了，立刻交給 backup');
  await step(tok);                                   // 1147 otherwise: no server, the whole system stops
  A(bad('server 沒了 → 整個系統不能動', 0, -1.3, 2.6));
  cl.forEach((b) => b.mood('sad'));
  say('要處理：server 沒了', '整個系統就不能動了');
  await step(tok);                                   // 1173 lighten it: clients compute, the server does short tasks
  cl.forEach((b) => b.mood('happy'));
  A(good('計算給 client 做；server 只做最短、最快的事', 0, 3.0, 1.8));
  say('減輕 server：需要計算的讓 client 做', 'server 只處理最重要但最快做完的事');
}]);

// 19:58 peer-to-peer
FRAG.push(['osA-p2p', 'Peer-to-peer：沒有 server，沒有 single point of failure', async (tok) => {
  fresh([0, 4.8, 14], [0, 2.2, 0]);
  await step(tok);                                   // 1198 peer-to-peer: no server
  hd('Peer-to-peer', 0, 6.4);
  const pos = [[-4, -0.6], [-1.4, 1.8], [1.4, 1.8], [4, -0.6], [0, -1.6]];
  const P = pos.map(([x, z]) => pal('peer', '', COL.user, x, z, 0.7));
  say('另一種做法：peer-to-peer', '沒有 server');
  await step(tok);                                   // 1205 everyone is a peer — no master, no slave
  P.forEach((b) => b.mood('happy'));
  const peerBub = bub('大家都是 peer（同僚），角色相同', 0, 3.2);
  say('每個人都是 peer：同僚的意思', '像同修一門課的同學，沒有 master / slave');
  await step(tok);                                   // 1221 they communicate by following a protocol
  for (let k = 0; k < pos.length; k++) { const a = pos[k], b = pos[(k + 1) % pos.length]; line(a[0], 0.4, a[1], b[0], 0.4, b[1], '#a8730f'); }
  const protNote = note('大家 follow 同一套 protocol', 0, 4.2);
  say('怎麼溝通？制定 protocol、rule、policy', '大家 follow 就能溝通');
  await step(tok);                                   // 1239 no single point of failure
  hot('沒有 single point of failure', 0, 5.2);
  say('最重要的：沒有 single point of failure', '');
  await step(tok);                                   // 1241.5 any computer dies or leaves — it keeps running
  await slide(tok, P[3].g, 6.4, 0, -0.6, 700);
  kill(P[3].g);
  say('任何一台死掉或離開', '系統都能繼續運作：沒有誰是必要的');
  await step(tok);                                   // 1261.5 very reliable, load usually balanced
  good('很 reliable・loading 平衡', 0, -0.4, 2.6);
  say('非常 reliable', 'loading 通常也很 balance');
  await step(tok);                                   // 1277.5 streaming: everyone watching the World Cup
  const vid = pkt('世界盃影片', -1.4, 2.6, 1.8);
  void vid;
  say('常用的例子：網路上的 streaming', '全世界的人都在看同一場世界盃');
  await step(tok);                                   // 1312 not all from one server: share with nearby peers
  for (const [a, b] of [[1, 0], [1, 2], [2, 4]]) await send(tok, '片段', 'pkt', V3(pos[a][0], 1.2, pos[a][1]), V3(pos[b][0], 1.2, pos[b][1]), 450);
  say('不可能每個人都從一個 server 拷貝', '大家就近互相 share，分擔 load');
  await step(tok);                                   // 1338.5 the Internet: the standard peer-to-peer system
  hot('Internet = 標準的 peer-to-peer', 0, 6.0, -1);
  say('Internet 就是標準的 peer-to-peer', '');
  await step(tok);                                   // 1348 Terminator's enemy Skynet — the Internet
  gone(peerBub, protNote);
  bub('魔鬼終結者的 SkyNet 就像 Internet', -3.4, 4.4);
  say('魔鬼終結者的敵人 SkyNet', '其實就是 Internet');
  await step(tok);                                   // 1357 nobody owns it and it never breaks
  note('沒有任何國家、組織在管：永遠不會 break', 3.4, 3.5);
  say('沒有任何國家或組織在管理 Internet', '但它永遠不會 break');
  await step(tok);                                   // 1381 the only way: unplug every computer
  P.forEach((b) => { if (b.g.parent) b.mood('wow'); });
  bad('唯一消滅法：拿掉所有連著的電腦', 0, -1.1, 2.8);
  say('唯一把它消滅的方法', '把所有連在一起的電腦全部拿掉：不可能');
}]);

// 23:29 clusters, InfiniBand, RDMA
FRAG.push(['osA-cluster', 'Cluster：LAN、InfiniBand 與 RDMA', async (tok) => {
  fresh([0, 4.8, 14], [0, 2.2, 0]);
  const A = bag();
  await step(tok);                                   // 1416 cluster (叢集電腦)
  hd('Cluster system（叢集電腦）', 0, 6.4);
  const N = [-3, -1.5, 0, 1.5, 3].map((x) => blk('node', '#c9d3dc', x, 0.9, 0, 1.2, 1.8, 1.2));
  say('常聽到的名詞：cluster', '叢集電腦');
  await step(tok);                                   // 1425.8 a subset of distributed systems
  A(note('分散式系統的一個 subset', 0, 4.6));
  say('它把很多台電腦連在一起', '屬於分散式系統，但比較特殊');
  await step(tok);                                   // 1443.9 special: a local area network with better bandwidth
  const lan = blk('LAN', '#a8730f', 0, 2.0, 0.8, 7.2, 0.12, 0.2);
  void lan;
  A(good('local area network：頻寬好、溝通快', 0, 3.6));
  say('特殊在網路：通常是 local area network', '頻寬、網路線比較好，溝通更快');
  await step(tok);                                   // 1458.4 the Internet is far: Taiwan → US has delay
  const far = pkt('台灣 → 美國：delay 久', 5.6, 4.2);
  void far;
  say('Internet 可能很遠', '台灣連到美國，送一個訊息 delay 比較久');
  await step(tok);                                   // 1466.8 a cluster sits in one room
  A(idx('同一個機房，距離很近', 0, -0.5, 1.2));
  say('cluster 通常在同一個機房', '距離很近，傳輸速度更快');
  await step(tok);                                   // 1492 the newest technology: InfiniBand
  A.clear();
  hot('InfiniBand', 0, 4.6);
  say('目前最快的技術：InfiniBand', '已經用了十年');
  await step(tok);                                   // 1500 a dorm cluster uses Ethernet
  pkt('宿舍：Ethernet', -4.6, 3.4);
  say('在宿舍也能 build cluster', '大家用的是 Ethernet');
  await step(tok);                                   // 1505 HPC clusters / supercomputers use InfiniBand: ~10× speed, 10×+ price
  pkt('高效能 cluster：InfiniBand', 4.6, 3.4);
  note('速度快約十倍，價錢也十倍以上', 0, 5.4);
  N.forEach((m) => glow(m, GREEN));
  say('high performance cluster、supercomputer', '用 InfiniBand：快十倍，也貴十倍以上');
  await step(tok);                                   // 1530.5 why fast: RDMA — DMA extended across the network
  await send(tok, 'data（不經 CPU）', 'good', V3(-3, 2.7, 0.8), V3(3, 2.7, 0.8), 1200);
  hot('RDMA：把 DMA 延伸到跨網路', 0, -0.6, 1.4);
  say('為什麼快？RDMA', '把 DMA 技術擴充到跨網路線，I/O 就快');
  await step(tok);                                   // 1556.5 clusters can be symmetric / asymmetric — minor
  idx('cluster 也分 symmetric / asymmetric（不重要）', 0, -1.3, 1.4);
  say('cluster 也分 symmetric / asymmetric', '有一台 master 或大家對等，稍微知道就好');
}]);

// 26:12 summary: from a single-core PC to distributed systems
FRAG.push(['osA-archsum', '統整：single core → multi-core → multiprocessor → cluster → 分散式', async (tok) => {
  fresh([0, 5, 15], [0, 2.4, 0]);
  const X = [-5.4, -2.7, 0, 2.7, 5.4];
  const lab5 = ['Single-core', 'Multi-core', 'Multiprocessor', 'Cluster', 'Distributed'];
  await step(tok);                                   // 1572.9 sum up these terms
  hd('統整：這些名詞要能區分', 0, 6.6);
  say('統整剛剛介紹的各種名詞', '定義、意義要能區分');
  await step(tok);                                   // 1599.4 single-core computer system, like the early PC
  blk('', COL.cpu, X[0], 0.3, 0, 0.6, 0.5, 0.6);
  hd(lab5[0], X[0], 1.4);
  say('一開始：single-core computer system', '像最早期的 PC');
  await step(tok);                                   // 1602 expand: one CPU with many cores (like a phone)
  for (let k = 0; k < 4; k++) blk('', COL.cpu, X[1] - 0.3 + (k % 2) * 0.6, 0.3, -0.3 + Math.floor(k / 2) * 0.6, 0.5, 0.5, 0.5);
  hd(lab5[1], X[1], 1.4);
  say('擴充：multi-core 的系統', '只有一個 CPU，但它有很多 core（像手機）');
  await step(tok);                                   // 1614.3 PCs / servers: several sockets — CPU, GPU, coprocessors
  ctx.tile(V3(X[2], 0.03, 0), 2.4, 2, '#d9e4cf');
  prop('cpu', X[2] - 0.5, 0.05, -0.4, 0.5); prop('cpu', X[2] + 0.5, 0.05, -0.4, 0.5); blk('GPU', '#7fb87a', X[2], 0.2, 0.5, 1.6, 0.3, 0.5);
  hd(lab5[2], X[2], 1.4);
  say('PC、server：主機板上好幾個插槽', 'CPU、GPU、coprocessor：multiprocessor 系統');
  await step(tok);                                   // 1648 one machine is limited → a cluster of machines
  for (let k = 0; k < 3; k++) blk('', '#c9d3dc', X[3] - 0.7 + k * 0.7, 0.6, 0, 0.55, 1.2, 0.8);
  hd(lab5[3], X[3], 1.6);
  say('一台電腦的主機板空間有限', '要更多計算量：湊很多台變成 cluster');
  await step(tok);                                   // 1667.4 LAN, one administrator, identical OS
  idx('LAN・同一個管理者・同樣的 OS', X[3], -0.5, 1.2);
  say('cluster 用 local area 的好網路串起來', '通常軟體、管理者單一，OS 一模一樣');
  await step(tok);                                   // 1693.9 further out: general distributed systems (Internet, cloud data centers)
  ['🖥', '☁', '🖥'].forEach((t, k) => tag(t, 'val', X[4] - 0.7 + k * 0.7, 0.6 + (k % 2) * 0.6));
  hd(lab5[4], X[4], 1.8);
  say('再往外：最 general 的分散式系統', 'Internet、雲端 data center，完全沒限制');
  await step(tok);                                   // 1722.3 tightly coupled = one box; loosely coupled = across the network
  good('tightly coupled：一個 box 裡', -2.7, 3.4);
  note('loosely coupled：跨網路、多個 box', 4.0, 3.4);
  say('tightly vs loosely coupled', '一個 box（machine）裡，還是跨網路的多個 box');
}]);

// ════════ lhToWeuWWfw（Neso Academy：System Calls） ════════
// 0:00 user mode vs kernel mode
FRAG.push(['osA-modes', 'User mode vs Kernel mode', async (tok) => {
  fresh([0, 4.8, 14], [0, 2.2, 0]);
  const A = bag();
  await step(tok);                                   // 0.3 this lecture: system calls
  hd('System calls', 0, 6.4);
  say('這一講：system call', '它是什麼、拿來做什麼');
  await step(tok);                                   // 8.9 an interface to the services an OS provides
  const os = pal('OS', '', COL.os, 3.6, 0, 1);
  ['檔案', 'I/O', 'memory'].forEach((t, k) => pkt(t, 2.2 + k * 1.4, 2.8));
  const app = pal('程式', '', COL.user, -3.6, 0, 0.9);
  arrow(V3(-2.6, 0.8, 0), V3(2.6, 0.8, 0), 0x8a5a00);
  const ifBub = bub('system call ＝ 使用 OS 服務的 interface', 0, 3.7);
  say('system call 提供一個 interface', '讓程式使用 OS 提供的 services');
  await step(tok);                                   // 29.2 first: two modes a program runs in
  ctx.tile(V3(-3.4, 0.02, 0), 6, 3.2, '#d8ecdc'); ctx.tile(V3(3.4, 0.02, 0), 6, 3.2, '#ead9f5');
  hd('User mode', -3.4, 5.4); hd('Kernel mode', 3.4, 5.4);
  say('先懂程式執行的兩種 mode', 'user mode 和 kernel mode');
  await step(tok);                                   // 52.7 user mode: no direct access to memory, hardware
  A(bad('不能直接碰 memory、hardware', -3.4, 4.5));
  say('User mode：程式不能直接存取', 'memory、hardware 這類資源');
  await step(tok);                                   // 63 kernel mode: direct access
  A(good('可以直接存取 memory、hardware', 3.4, 4.5));
  say('Kernel mode：可以直接存取', 'memory 和 hardware');
  await step(tok);                                   // 72 kernel mode = privileged mode
  kill(ifBub);
  A(hot('privileged mode（特權）', 3.4, 3.7));
  os.mood('happy');
  say('所以 kernel mode 是 privileged mode', '能直接動很多資源');
  await step(tok);                                   // 81.4 a crash in kernel mode → the whole system crashes
  glow(os.body, RED); os.mood('sad');
  A(bad('在 kernel mode crash → 整個系統當掉', 3.4, -0.8, 1.6));
  say('問題：在 kernel mode 執行的程式 crash', '整個系統會 crash、停擺');
  await step(tok);                                   // 98 a crash in user mode → the system survives
  glow(os.body, null); os.mood('calm');
  app.mood('sad');
  A(good('在 user mode crash → 系統還好好的', -3.4, -0.8, 1.6));
  say('在 user mode 執行的程式 crash', '整個系統不會跟著當掉');
  await step(tok);                                   // 111 user mode is safer
  app.mood('happy');
  A(note('user mode 比較安全', -3.4, 3.7));
  say('user mode 比較安全', 'kernel mode 則是有特權的 mode');
  await step(tok);                                   // 120 so most programs run in user mode
  say('因為比較安全', '大部分程式都在 user mode 執行');
}]);

// 2:08 the program needs a resource → system call → switch to kernel mode
FRAG.push(['osA-syscall', 'System call：從 user mode 切到 kernel mode', async (tok) => {
  fresh([0, 4.8, 14], [0, 2.2, 0]);
  ctx.tile(V3(-3.4, 0.02, 0), 6, 3.2, '#d8ecdc'); ctx.tile(V3(3.4, 0.02, 0), 6, 3.2, '#ead9f5');
  hd('User mode', -3.4, 5.4); hd('Kernel mode', 3.4, 5.4);
  const app = pal('程式', '', COL.user, -3.4, 0, 0.9);
  const os = pal('OS kernel', '', COL.os, 4.4, -0.8, 0.9);
  const disk = prop('disk', 4.6, 0, 1.2, 0.8);
  void disk;
  await step(tok);                                   // 128 in user mode it may need memory or hardware
  const need = talk(app, '我要用 hardware…');
  app.mood('wow');
  say('user mode 的程式', '可能需要 memory、hardware 等資源');
  await step(tok);                                   // 137 it makes a call to the OS asking for access
  kill(need);
  await send(tok, '請給我用資源', 'pkt', V3(-3.4, 2.2, 0), V3(3.6, 2.2, -0.8), 800);
  say('它就呼叫 OS', '告訴 OS：我需要用某些資源');
  await step(tok);                                   // 147 for an instant the program switches to kernel mode
  await slide(tok, app.g, 2.6, 0, 0.6, 700);
  glow(app.body, GOLD);
  say('那一瞬間，程式從 user mode 切到 kernel mode', '才能使用那些資源');
  await step(tok);                                   // 160 a switch happens — and back again afterwards
  await slide(tok, app.g, -3.4, 0, 0, 700);
  glow(app.body, null);
  bad('Neso 稱 context switch；課本叫 mode switch', 0, 3.6);
  say('這裡發生了切換：user → kernel → user', '課本稱 mode switch（context switch 是換 process）');
  await step(tok);                                   // 187 that call is the system call
  hot('這個呼叫 ＝ system call', 0, 4.5);
  app.mood('happy');
  say('程式為了用資源、進 kernel mode 所發出的呼叫', '就叫 system call');
  await step(tok);                                   // 199.6 made when a user-mode program needs kernel mode for a while
  note('需要資源時才發出，暫時進 kernel mode', -4.2, 2.6);
  say('system call 在程式需要存取資源時發出', 'user mode 的程式暫時切到 kernel mode');
  await step(tok);                                   // 217.3 definition: a programmatic way to request a kernel service
  good('定義：程式向 OS kernel 請求服務的方式', 0, -0.9, 1.6);
  os.mood('happy');
  say('定義：程式向 OS 的 kernel', '請求 service 的 programmatic 方式');
  await step(tok);                                   // 239.2 usually available as routines in C / C++
  code(['open()', 'read()', 'write()'], 1.8, 2.4, 0.42, 0.6);
  say('system call 通常是用 C、C++ 寫成的 routine', '');
}]);

// 4:08 example: copy one file to another — every box is a system call
const CPY = ['Acquire input file name', '  Write prompt to screen', '  Accept input', 'Acquire output file name', '  Write prompt to screen', '  Accept input', 'Open the input file', "  if file doesn't exist, abort", 'Create output file', '  if file exists, abort', 'Loop', '  Read from input file', '  Write to output file', 'Until read fails', 'Close output file', 'Write completion message', 'Terminate normally'];
FRAG.push(['osA-copy', '例子：複製檔案要用多少 system call', async (tok) => {
  fresh([0, 4.6, 14.5], [0, 2.6, 0]);
  let n = 0;
  const cnt = hot('system call：0', 4.6, 6.4);
  const add = (k) => { n += k; txt(cnt, 'system call：' + n); };
  await step(tok);                                   // 257.5 example: copy the contents of one file to another
  const src = prop('file', 2.6, 0, 0, 1.1, 'source'), dst = prop('file', 5.8, 0, 0, 1.1, 'destination');
  arrow(V3(3.2, 0.6, 0), V3(5.2, 0.6, 0), 0x8a5a00);
  say('例子：把一個檔案的內容複製到另一個檔案', '看看要用多少 system call');
  void src; void dst;
  const C = code(CPY, -2.6, 6.4, 0.42);
  C.ls.forEach((l) => { l.element.style.opacity = '0.25'; l.element.style.lineHeight = '1.1'; });
  const show = (a, b) => { for (let i = a; i <= b; i++) C.ls[i].element.style.opacity = '1'; C.hl(b); };
  await step(tok);                                   // 287.1 first: acquire the input file name
  show(0, 0); add(1);
  say('第一步：取得 input 檔名', '這就需要一個 system call');
  await step(tok);                                   // 313 write a prompt to the screen
  show(1, 1); add(1);
  const mon = prop('monitor', 4.2, 1.8, -1.2, 0.9);
  void mon;
  say('在螢幕上顯示提示：請輸入 input 檔名', '又一個 system call');
  await step(tok);                                   // 327.2 accept the user's input
  show(2, 2); add(1);
  say('接收使用者的輸入', '再一個 system call');
  await step(tok);                                   // 333 every box is a separate system call
  bub('每一行（每個框）都是一個 system call', 4.2, 4.4);
  say('這裡每一個框，都代表一個 system call', '');
  await step(tok);                                   // 342 two ways: type the name, or browse with the mouse
  note('打字輸入檔名，或用滑鼠瀏覽點選', 4.2, 5.2);
  say('取得檔名有兩種方式', '請使用者打字，或用滑鼠在檔案裡點選');
  await step(tok);                                   // 387 the prompt uses the monitor — an output device
  glow(mon.children[1], GOLD);
  say('顯示提示要用 monitor：output device 是 hardware', '存取 hardware 就要 system call');
  await step(tok);                                   // 399 keyboard / mouse are input devices
  glow(mon.children[1], null);
  const kb = prop('keyboard', 4.2, 0, 2.4, 0.8);
  void kb;
  say('接收輸入要用 keyboard 或 mouse', '存取 input device，也要 system call');
  await step(tok);                                   // 418.9 the same three for the output file name
  show(3, 5); add(3);
  say('同樣三步：取得 output 檔名', '提示、接收輸入：再 3 個 system call');
  await step(tok);                                   // 460.8 open the input file
  show(6, 6); add(1);
  glow(src.children[0], GREEN);
  say('打開 input 檔案，準備開始複製', '又一個 system call');
  await step(tok);                                   // 482 file doesn't exist → abort
  show(7, 7); add(1);
  say('如果檔案不存在，就要 abort（終止）', '終止也需要 system call');
  await step(tok);                                   // 504 create the output file
  show(8, 8); add(1);
  say('用使用者給的名字建立 output 檔案', 'system call');
  await step(tok);                                   // 515 the file already exists → abort
  show(9, 9); add(1);
  say('如果同名檔案已經存在，也要 abort', '要建的是新檔案');
  await step(tok);                                   // 593 a loop: read from input, write to output, until read fails
  show(10, 13); add(2);
  for (let k = 0; k < 3; k++) await send(tok, 'data', 'pkt', V3(2.6, 1.4, 0), V3(5.8, 1.4, 0), 350);
  say('跑一個 loop：從 input 讀、寫進 output', '直到讀不到東西（read fails）');
  await step(tok);                                   // 623.1 errors (e.g. hardware) → abort, also a system call
  bad('出錯（例如 hardware error）→ abort', 4.2, 3.4);
  say('過程中也可能出錯，例如 hardware error', 'abort 也要 system call');
  await step(tok);                                   // 634 read and write themselves: a loop of system calls
  txt(cnt, 'system call：' + n + ' ＋ 一整串 read / write');
  say('每一次 read、write 都是 system call', '所以這裡是一整串 system call');
  await step(tok);                                   // 641.3 close the output file
  show(14, 14); add(1); txt(cnt, 'system call：很多個');
  say('全部複製完，關閉 output 檔案', 'system call');
  await step(tok);                                   // 653.5 write a completion message to the screen
  show(15, 15);
  say('在螢幕顯示「複製完成」', '告訴使用者：也是 system call');
  await step(tok);                                   // 666 terminate normally
  show(16, 16);
  good('正常結束：最後一個 system call', 4.2, 2.6);
  say('最後正常結束（terminate normally）', '這也需要一個 system call');
}]);

// 11:13 summary: system calls everywhere
FRAG.push(['osA-sysum', 'System call 無所不在', async (tok) => {
  fresh([0, 4.8, 14], [0, 2.2, 0]);
  await step(tok);                                   // 673.2 even a simple task needs lots of system calls
  const app = pal('程式', '', COL.user, -4, 0, 1);
  const os = pal('OS', '', COL.os, 4, 0, 1);
  for (let k = 0; k < 6; k++) await send(tok, 'system call', 'pkt', V3(-3, 1.2 + (k % 3) * 0.5, 0), V3(3, 1.2 + (k % 3) * 0.5, 0), 260);
  say('只是複製一個檔案這種簡單的事', '就執行了一大堆 system call');
  await step(tok);                                   // 692 thousands of system calls per second
  note('有些程式每秒執行上千個 system call', 0, 4.2);
  say('有些程式執行時', '每秒有上千個 system call');
  await step(tok);                                   // 712.2 so system calls are the interface to the OS services
  hot('system call ＝ 使用 OS services 的 interface', 0, 5.2);
  os.mood('happy');
  say('所以 system call 提供 interface', 'OS 的 services 透過它提供給程式');
  await step(tok);                                   // 729.3 a program issues one whenever it needs a service / resource
  app.mood('happy'); await app.hop(tok);
  good('需要服務或資源 → 發出 system call', 0, 3.2);
  say('程式需要使用 service 或 resource 時', '就發出 system call');
}]);

// ════════ bzE9oX8bKqY（第 3A 講：What is an OS?） ════════
// 0:01 chapter 1 outline; protection ≠ security
FRAG.push(['osA-ch1', 'Chapter 1 導覽：protection 不是 security', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 2.2, 0]);
  const A = bag();
  await step(tok);                                   // 1 Chapter 1: finally the OS
  hd('Chapter 1：Introduction', 0, 6.4);
  say('Chapter 1：終於開始講 OS', '上一堂介紹了各式各樣的系統');
  await step(tok);                                   // 4.9 any computer system must have an OS
  const sys = ['手機', 'PC', 'server', 'cluster'].map((t, k) => prop('monitor', -4.8 + k * 3.2, 0, -0.6, 0.8));
  sys.forEach((m, k) => idx(['手機', 'PC', 'server', 'cluster'][k], -4.8 + k * 3.2, -0.4, 0.2));
  const os = pal('OS', '', COL.os, 0, 1.8, 0.8);
  os.mood('happy');
  say('不管什麼電腦系統，一定要有作業系統', '不然沒辦法執行、沒辦法讓人用');
  await step(tok);                                   // 44 core problems → basic components & subsystems
  A(note('核心問題：共用、互動… → 基本 component、subsystem', 0, 4.6));
  say('OS 一定有核心問題：怎麼共用、怎麼互動', '對應到基本的 component 和 subsystem');
  await step(tok);                                   // 59.8 special-purpose systems: OS keeps adapting
  A(idx('special purpose 要不斷 adapt 新需求、新硬體', 0, 3.8));
  say('很多 special purpose 的系統有其他需求', 'OS 要不斷 adapt，但都是上課概念的衍生');
  await step(tok);                                   // 90 first: what is an OS — from its roles
  A.clear(); gone(...sys); kill(os.g);
  const L = ['① 什麼是 OS（從角色看）', '② OS 怎麼管理電腦', '③ Protection'];
  const ls = L.map((t, k) => pkt(t, 0, 5.2 - k * 1.0));
  ls[1].element.style.opacity = ls[2].element.style.opacity = '0.3';
  say('第一：到底什麼是作業系統', '從不同角度、角色來看');
  await step(tok);                                   // 105.9 then: how the OS manages the computer
  ls[1].element.style.opacity = '1';
  say('第二：OS 用什麼方式管理一台電腦', '基本雛形的電腦架構');
  await step(tok);                                   // 121 last: how to protect the computer's use
  ls[2].element.style.opacity = '1';
  say('最後：怎麼保護這台電腦的使用', '');
  await step(tok);                                   // 131 protection, not security
  hot('Protection ≠ Security', 0, 2.2);
  say('注意：這裡是 protection，不是 security', '');
  await step(tok);                                   // 147 protection: one user's crash must not affect others
  const u = [-3, 0, 3].map((x, k) => pal('使用者 ' + 'ABC'[k], '', JOBC[k], x, 2, 0.6));
  u[0].glow(RED); u[0].mood('sad');
  good('A crash 了，B、C 照常', 0, -0.8, 2);
  say('Protection：正常使用下，不會影響別的使用者', '一個人的程式 crash，不能讓整台電腦 crash');
  void u;
  await step(tok);                                   // 197 security (malicious attacks over the network) is out of scope
  bad('Security（惡意、透過網路）：不在這裡', 0, 1.2);
  say('惡意的、透過網路的攻擊是 security', '不在這個範圍');
}]);

// 3:27 the computer's components: user, application, OS, hardware
FRAG.push(['osA-comp', '電腦的組成：user、application、OS、hardware', async (tok) => {
  fresh([0, 4.8, 14], [0, 2.4, 0]);
  const A = bag();
  await step(tok);                                   // 207.3 start from the computer's components: there is a user
  hd('電腦系統的組成', 0, 6.6);
  const user = pal('User', '', '#e55a9b', 0, -1.6, 0.8);
  user.g.position.y = 4.4;
  say('從電腦的組成看起', '第一，一定有 user 來用這台電腦');
  await step(tok);                                   // 226 through applications
  const apps = ['Game', 'Word', 'Compiler'].map((t, k) => blk(t, COL.user, -2.6 + k * 2.6, 3.4, 0, 2.2, 0.6, 1));
  say('使用者透過 application（應用程式）使用', '');
  await step(tok);                                   // 237.4 broadly: any program — games, editors, compilers
  A(idx('廣義：game、Word、compiler 都算 application', 0, 2.75, 0.6));
  say('application 可以定義得很廣', 'game、Word editor、compiler 都是');
  void apps;
  await step(tok);                                   // 259 they run on hardware
  const hw = blk('Hardware', '#8a7a5c', 0, 0.4, 0, 7.8, 0.8, 1.4);
  say('這些 application 要在 hardware 上執行', '');
  await step(tok);                                   // 280 CPU, memory, I/O devices
  A(idx('CPU・memory・I/O device', 0, -0.4, 1));
  say('hardware 不外乎 CPU、memory、I/O device', '');
  await step(tok);                                   // 290.5 the OS sits in between: the bridge
  A.clear();
  const os = blk('OS', COL.os, 0, 1.9, 0, 7.8, 0.8, 1.4, 3);
  say('中間特地切開的，就是 OS', '連結 application 和 hardware 的橋樑');
  await step(tok);                                   // 307 resources are used / shared only through the OS
  await send(tok, '用資源', 'pkt', V3(-2.6, 3.0, 0.8), V3(-2.6, 1.0, 0.8), 600);
  await send(tok, '用資源', 'pkt', V3(2.6, 3.0, 0.8), V3(2.6, 1.0, 0.8), 600);
  glow(os, GOLD);
  say('要透過 OS 的管理', '才能使用、共享 hardware 的資源');
  await step(tok);                                   // 331 users are not only people: machines, programs, computers
  glow(os, null);
  const car1 = pal('🚗', '', '#d64545', -5.6, 1.2, 0.55), car2 = pal('🚗', '', '#4b9ee2', 5.6, 1.2, 0.55);
  say('User 也不一定是人', '也可以是 machine、程式、別的電腦');
  await step(tok);                                   // 342.7 IoT: devices talk to devices directly
  A(bub('物聯網：device 之間直接溝通', 4.2, 5.2));
  say('像物聯網：物體跟物體直接溝通', '每個 device 都是電腦、上面有 OS');
  await step(tok);                                   // 365 self-driving: the users are other cars
  await send(tok, '我要轉彎', 'say', V3(-5.6, 2.85, 1.2), V3(4.4, 2.85, 1.2), 900);
  car1.mood('happy'); car2.mood('happy');
  say('自動駕駛：車子要跟很多 device、別的車溝通', '它的 user 就是別的自動駕駛車');
  await step(tok);                                   // 399.8 in the OS world, hardware = resources
  gone(car1, car2);
  if (hw.userData.lbl) txt(hw.userData.lbl, 'Hardware ＝ 資源（resources）');
  say('OS 的世界裡，hardware 被說成「資源」', '不管哪個 device，只管有什麼、有多少、怎麼分配');
  await step(tok);                                   // 418.5 some resources go whole, some can be split
  A(note('有的要整個獨占，有的可以切細分配', 0, -0.4, 1.4));
  say('有些資源一次就要整個獨占', '有些可以切得更細來分配');
  await step(tok);                                   // 429.3 CPU: computing resource
  const R = [['CPU：計算資源', COL.cpu], ['Memory：較快的儲存資源', COL.mem], ['I/O：disk、網路頻寬', COL.io]];
  const rs = [];
  rs.push(blk(R[0][0], R[0][1], -2.7, 0.4, 0.8, 2.5, 0.5, 0.2));
  say('CPU：computing resource（計算資源）', '');
  await step(tok);                                   // 435.9 memory: fast storage resource
  rs.push(blk(R[1][0], R[1][1], 0, 0.4, 0.8, 2.5, 0.5, 0.2));
  say('Memory：儲存資源，而且是比較快的', '');
  await step(tok);                                   // 442 I/O resources: disk, network bandwidth
  rs.push(blk(R[2][0], R[2][1], 2.7, 0.4, 0.8, 2.5, 0.5, 0.2));
  say('I/O 資源：input / output 資料', '像 disk、network 能傳多少資料（bandwidth）');
  void user;
}]);

// 7:38 the OS's two roles: control and coordinate
FRAG.push(['osA-ctrl', 'OS 的角色：Control 與 Coordinate', async (tok) => {
  fresh([0, 4.8, 14], [0, 2.4, 0]);
  const A = bag();
  await step(tok);                                   // 458 the OS's role: control and coordinate
  hd('OS 的兩個角色', 0, 6.4);
  hot('Control', -3.6, 5.5); hot('Coordinate', 3.6, 5.5);
  const cpu = prop('cpu', 0, 0, -1.2, 1.2, 'CPU');
  say('OS 在中間的角色', '可以分成 control 和 coordinate');
  await step(tok);                                   // 474.3 control: an application wants the CPU — the OS controls it
  const app = pal('程式', '', COL.user, -3.6, 0.6, 0.8);
  await send(tok, '我要 CPU', 'pkt', V3(-3.6, 1.6, 0.6), V3(-0.4, 1.0, -1.2), 700);
  glow(cpu.children[1], GREEN);
  say('Control：單純的控制', '程式要用 CPU，透過 OS 控制 CPU 給它用');
  await step(tok);                                   // 497.2 never forget: systems are shared
  glow(cpu.children[1], null);
  const others = [2.6, 4.6].map((x, k) => pal('程式', '', JOBC[k + 1], x, 0.6, 0.8));
  say('但千萬別忘了：電腦不會只有一個人', '都是 sharing，所以系統才複雜');
  await step(tok);                                   // 509.4 batch: one at a time, nothing to manage
  A(idx('第一代 batch：一次一人，OS 沒什麼好管', -3.6, 3.2));
  say('像第一代 batch 一次一個人', '沒有 sharing，OS 不用做什麼');
  await step(tok);                                   // 525 they all compete for the CPU
  A.clear();
  [app, ...others].forEach((b) => b.mood('wow'));
  bub('我要 CPU！我也要！', 1, 2.6, 0.6);
  say('現在很多程式、很多人', '都在競爭：你要 CPU，我也要');
  await step(tok);                                   // 529 the OS coordinates in between
  const os = pal('OS', '', COL.os, 0, 2.4, 0.9);
  os.mood('happy');
  [app, ...others].forEach((b) => b.mood('happy'));
  say('OS 在中間做協調：coordinate', '讓大家都能 run、滿足需求');
  await step(tok);                                   // 545.2 why time sharing? it costs overhead
  A(bad('time sharing 切得細 → overhead', 3.6, 4.6));
  say('為什麼要 time sharing？', '切那麼細會造成 overhead，浪費計算資源');
  await step(tok);                                   // 557.8 bad for the system, but what users want
  A(good('對使用者：大家能同時用', 3.6, 3.8));
  say('以系統角度不是好事', '但對使用者，這就是我們要的');
  await step(tok);                                   // 572 control is one-way; coordinate is the complex part
  A(note('Control：單方向　Coordinate：協調分配（更複雜）', 0, -0.9, 1.6));
  say('control 只是單方向控制', 'coordinate 才是 OS 更複雜的部分');
  await step(tok);                                   // 588.2 research is in coordinate; control ≈ writing drivers
  A(idx('研究多在 coordinate；control 就是寫 driver', 0, 1.6, 2.2));
  say('很多研究在 coordinate', 'control 就是寫寫 driver');
  await step(tok);                                   // 597.4 don't memorize the definitions
  os.mood('wow');
  say('這些不是要硬背的定義', '用自己的話講出 control、coordinate 的意義就好');
}]);

// 10:32 a permanent piece of software that offers an abstraction (API)
FRAG.push(['osA-api', 'OS：一直都在的軟體，把硬體抽象成 API', async (tok) => {
  fresh([0, 4.8, 14], [0, 2.4, 0]);
  const A = bag();
  await step(tok);                                   // 632.5 the OS is software too
  hd('OS 也是軟體，但很特別', 0, 6.4);
  const apps = ['App 1', 'App 2', 'App 3'].map((t, k) => blk(t, COL.user, -2.6 + k * 2.6, 3.6, 0, 2.2, 0.6, 1));
  const os = blk('OS', COL.os, 0, 2.1, 0, 7.8, 0.8, 1.4);
  const hw = blk('Hardware', '#8a7a5c', 0, 0.6, 0, 7.8, 0.8, 1.4);
  say('application 裡一堆軟體', 'OS 本身也是軟體：它特別在哪？');
  await step(tok);                                   // 646 permanent: always there once the computer starts
  glow(os, GOLD);
  A(good('Permanent：一開機就一直在', -4.6, 5.3));
  say('它是 permanent 的 software', '電腦一啟動，OS 就一直坐在那邊');
  await step(tok);                                   // 662 without it the computer doesn't work
  glow(os, null); os.visible = false;
  A(bad('OS 不見了 → 電腦不會動', 0, 2.1, 1));
  say('OS 不見了，電腦基本上就不會運作', '其他程式都沒有這個特性');
  await step(tok);                                   // 686 it creates an abstraction — an illusion, like a virtual machine
  A.clear(); os.visible = true;
  hot('製造抽象（abstraction）的假象', 4.2, 5.3);
  say('OS 很特別：它製造一個抽象、使用的假象', '就像一個 virtual machine 的 interface');
  await step(tok);                                   // 705 like calling an API when you program
  const api = ['open()', 'read()', 'write()'].map((t, k) => pkt(t, -2.6 + k * 2.6, 2.75, 0.8));
  say('就像寫程式都要 call API', '');
  await step(tok);                                   // 714 hardware abstracted into a set of APIs for the layer above
  for (const k of [0, 1, 2]) await send(tok, 'call', 'say', V3(-2.6 + k * 2.6, 3.3, 0.8), V3(-2.6 + k * 2.6, 2.75, 0.8), 260);
  say('OS 把下面的 hardware 抽象化', '變成一堆 API 讓上面的人 call');
  await step(tok);                                   // 721.9 the API decides how programs see the computer
  A(note('API 怎麼定義 → 決定程式看到的電腦長怎樣', 0, -0.6, 1.4));
  say('API 怎麼定義', '就決定上面的程式怎麼看、怎麼用這台電腦');
  void api; void hw;
  await step(tok);                                   // 755.5 virtual machines: layers of interfaces
  A(idx('一層一層 interface → virtual machine 很自然', -4.6, 4.6));
  say('virtual machine 很紅', 'OS 本來就是一層一層的 interface');
  await step(tok);                                   // 790 abstraction is close to "control"
  A(hot('抽象成 API ≈ Control', -4.6, 5.3));
  say('抽象化比較接近 control', '照你定義的 API 去控制、使用資源');
  await step(tok);                                   // 801 coordinate: many apps go through the same OS
  apps.forEach((m) => glow(m, GOLD));
  say('coordinate 也看得出來：OS 只有一個', '上面很多 application 都要透過它的 API');
  await step(tok);                                   // 829 so it decides who gets the next time slot
  apps.forEach((m) => glow(m, null)); glow(apps[1], GREEN);
  A(good('下個 time slot：給 App 2', 4.6, 4.6));
  say('經過同一個 OS，它就能動手腳', '決定這個 CPU time slot 給哪個程式');
}]);

// 14:12 how your program talks to the OS: user / kernel space, drivers, system library
FRAG.push(['osA-stack', '程式怎麼跟 OS 互動：driver、system library、system call', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.6, 0]);
  const A = bag();
  await step(tok);                                   // 852.6 how does your program interact with the OS?
  hd('你的程式怎麼跟 OS 互動？', 0, 6.6);
  say('你寫程式時，是怎麼跟 OS 互動的？', '');
  await step(tok);                                   // 871.8 compile, run, output — where was the OS?
  A(bub('compile、run、output… OS 在哪？', 0, 5.6));
  say('大一大二寫程式：compile、run，印出結果', 'OS 在哪？什麼時候 call 到它？');
  await step(tok);                                   // 890.8 hardware at the bottom, your program on top
  A.clear();
  blk('Hardware', '#8a7a5c', 0, 0.3, 0, 8, 0.6, 1.4);
  blk('你的 program', COL.user, -2, 4.6, 0, 3.4, 0.6, 1.4);
  say('最下面是 hardware', '最上面是你寫的程式');
  await step(tok);                                   // 900.5 user mode: your programs' space; kernel: the OS's
  ctx.tile(V3(0, 4.0, -1), 8.6, 0.3, '#d8ecdc'); idx('user mode（user space）', 3.6, 4.6);
  idx('kernel mode：OS 自己用的空間', 3.6, 2.6);
  say('user mode：你寫的程式、它用的 memory 空間', 'kernel：OS 這支程式自己用的空間與資源');
  await step(tok);                                   // 920 I/O → drivers, part of the OS
  const drv = blk('Driver', '#b9a4f7', 0, 1.1, 0, 8, 0.5, 1.4, 2);
  say('要碰 I/O，hardware 上要有 driver', 'driver 是 OS 的一部分');
  void drv;
  await step(tok);                                   // 935.9 drivers can be installed — so many kinds of devices
  pkt('裝新 driver', 5.4, 1.1, 0.8);
  say('為什麼特別切開？I/O device 太多樣', 'driver 可以抽換、安裝在最下層');
  await step(tok);                                   // 962 above the drivers: the main OS (memory, CPU …)
  const os = blk('OS（管 memory、CPU…）', COL.os, 0, 1.8, 0, 8, 0.6, 1.4, 2);
  void os;
  say('driver 上面才是主要的 OS', '這堂課講的：怎麼管理 memory、CPU');
  await step(tok);                                   // 979 the OS implements an API
  const lib = blk('System library（API）', '#2fc092', 0, 2.6, 0, 8, 0.5, 1.4, 2);
  say('OS 的目的：implement 一個 API', '就像 C language implement 那些 function');
  await step(tok);                                   // 994 that API = the system library
  if (lib.userData.lbl) txt(lib.userData.lbl, 'System library');
  say('這個 API 俗稱 system library', '');
  await step(tok);                                   // 1001 better known as system calls
  if (lib.userData.lbl) txt(lib.userData.lbl, 'System library ＝ system calls（OS 的 API）');
  glow(lib, GOLD);
  say('更常見的名字：system call', '它代表 OS 的 interface（API）');
  await step(tok);                                   // 1015 assignment 1: implement some of these APIs
  A(note('作業一：implement 一些 system call', -4.6, 5.6));
  say('作業一：implement 一些 API library', '');
  await step(tok);                                   // 1019.6 a library = functions packaged together (#include)
  const cl = blk('C library', '#7fd0a8', 2, 3.6, 0, 3.4, 0.5, 1.4);
  void cl;
  A(idx('library：一堆 function 包成的檔案（#include）', 2, 4.2, 0.8));
  say('library：定義很多 function、包在一起的檔案', '寫 C 先 include C library');
}]);

// 17:32 compile → link (with the system library) → run: printf → system call → driver
FRAG.push(['osA-link', 'Compile、link 與 printf 的一路往下', async (tok) => {
  fresh([0, 5, 14.5], [0, 2.6, 0]);
  const A = bag();
  await step(tok);                                   // 1052.8 your program: first compile
  const src = blk('hello.c', COL.user, -5, 4.4, 0, 2, 0.6, 1);
  const obj = blk('hello.o', '#9fc9e6', -1.8, 4.4, 0, 2, 0.6, 1);
  arrow(V3(-3.9, 4.4, 0.6), V3(-2.9, 4.4, 0.6), 0x8a5a00);
  idx('compile → machine language', -3.4, 5.2);
  say('第一件事：compile', '把程式從 language 變成 machine language（.o）');
  void src;
  await step(tok);                                   // 1077.1 next: link
  const exe = blk('執行檔', COL.gold, 3.6, 4.4, 0, 2.2, 0.6, 1);
  arrow(V3(-0.7, 4.4, 0.6), V3(2.4, 4.4, 0.6), 0x8a5a00);
  hot('link', 0.9, 5.2);
  say('compile 完下一步：link', '一鍵 build 其實是拆開的兩步');
  void obj;
  await step(tok);                                   // 1087 link = combine binaries, to use code others implemented
  A(idx('link：把 .o 和別人寫好的程式接起來', 0.9, 3.6));
  say('link：把 compile 好的 binary 接在一起', '代表要使用別人 implement 好的程式');
  await step(tok);                                   // 1095 it always links the system library automatically
  const lib = blk('System library', '#2fc092', 0.9, 2.4, 0, 3.4, 0.5, 1.2);
  await send(tok, '自動 link', 'pkt', V3(0.9, 2.6, 0.7), V3(3.6, 4.1, 0.7), 700);
  say('一定會自動 link 的是：system library', 'link 完才是能執行的完整執行檔');
  await step(tok);                                   // 1121 why? printf must output to the screen
  A.clear();
  const C = code(['printf("hi");'], -4.6, 2.6, 0.5);
  void C;
  prop('monitor', 5, 0, 0, 1.1);
  say('為什麼一定要 link？例如 printf', 'printf 要輸出到 screen');
  await step(tok);                                   // 1130 who outputs to the screen? the OS
  A(bub('誰負責輸出到螢幕？OS！', 5, 2.6));
  say('誰負責輸出到 screen？OS', '不是 C library');
  await step(tok);                                   // 1143 maybe via the C library, eventually the system library
  A(idx('可能先 link C library，它再用 system library', -1.4, 1.6));
  say('可能先 link 到 C library', 'C library 再用 system library：間接但一定會 link 進去');
  await step(tok);                                   // 1164.6 at run time: printf → system call → driver → hardware
  const path = [['printf', -4.6, 2.6], ['system call', -1.4, 2.4], ['driver', 1.8, 1.1], ['螢幕', 5, 1.3]];
  for (let k = 0; k < 3; k++) await send(tok, path[k + 1][0], 'pkt', V3(path[k][1], path[k][2], 0.8), V3(path[k + 1][1], path[k + 1][2], 0.8), 600, true);
  say('執行時：printf → system call → driver', '一路往下，其實都經過 OS');
  await step(tok);                                   // 1180 hidden because of the many layers
  A(note('包了太多層，所以你沒直接看到', 0, 4.6));
  say('都透過 system library / system call', '只是包得太多層，你沒直接看到');
  await step(tok);                                   // 1198 without the system library you basically can't run anything
  A(bad('不 link system library → 幾乎什麼都不能執行', 0, -0.6, 1.4));
  say('不 link system library', '除非完全不用 OS 的 code，否則什麼都跑不了');
  void lib;
}]);

// 20:28 definitions: resource allocator, control program, kernel
FRAG.push(['osA-defs', 'OS 的定義：resource allocator、control program、kernel', async (tok) => {
  fresh([0, 4.8, 14], [0, 2.4, 0]);
  const A = bag();
  await step(tok);                                   // 1228 how to define an OS? a resource allocator
  hd('怎麼定義 OS？', 0, 6.4);
  hot('① Resource allocator', -4.2, 5.4);
  const os = pal('OS', '', COL.os, -4.2, 0.4, 1);
  say('有人說 OS 是 resource allocator', '整個角色就是在分配資源');
  await step(tok);                                   // 1245 manage & allocate efficiently, fairly, in time
  A(idx('有效率・公平・即時', -4.2, 2.4, 0.4));
  say('manage 再 allocate', '讓大家有效使用，又公平、即時');
  await step(tok);                                   // 1262 memory, disk blocks, CPU cycles: all allocation
  const R = [['memory', COL.mem, 'memory management'], ['disk block', COL.io, 'file system'], ['CPU cycle', COL.cpu, 'CPU scheduling']];
  for (let k = 0; k < 3; k++) { await send(tok, R[k][0], 'pkt', V3(-4.2, 1.6, 0.4), V3(-0.6 + k * 2.6, 1.6, 0.4), 350, true); idx(R[k][2], -0.6 + k * 2.6, 0.9, 0.4); }
  say('分配 memory、disk block、CPU cycle', '全部都在做 allocation');
  await step(tok);                                   // 1279.7 control program: drivers to control hardware
  hot('② Control program', 2, 5.4);
  A(idx('寫 driver、照 spec 控制各種 device', 2, 4.6));
  say('第二：control program', '幫我控制 hardware，例如透過 driver');
  await step(tok);                                   // 1305 mostly hard labor: each device's spec and driver
  A(bad('多半是苦工', 2, 3.9));
  say('這部分問題比較小，多半是苦工', '不同 device 的 spec、driver');
  await step(tok);                                   // 1316.8 nobody literally calls it that — just the concept
  A(note('不用背：只是描述概念', -4.2, 4.6));
  say('沒人真的直接這樣叫 OS', '只是它的概念');
  await step(tok);                                   // 1327.4 remember this one: kernel = the OS's other name
  A.clear();
  hot('③ Kernel ＝ OS 的別名（要記！）', 0, 4.2, 1);
  txt(os.name, 'Kernel'); os.mood('happy'); await os.hop(tok);
  say('這個要記：kernel', 'OS 的別名就叫 kernel');
  await step(tok);                                   // 1338.4 "I'm installing a kernel"
  bub('我在裝一個 kernel', -4.2, 2.6, 0.4);
  say('大家常說：我在裝 kernel、我在用什麼 kernel', 'kernel 就是 OS');
  await step(tok);                                   // 1350 one kernel; everything else is not kernel
  ['application', 'compiler', 'toolchain'].forEach((t, k) => blk(t, '#d8cfc0', -0.6 + k * 2.6, 0.3, 1.4, 2.2, 0.5, 0.8));
  idx('其他都不是 kernel', 2, 0.9, 1.4);
  say('一個 kernel 是所有東西的核心', 'application、compiler、toolchain 都不是 kernel');
}]);

// 23:03 design goals: convenience vs efficiency
FRAG.push(['osA-goals', 'OS 的目標：convenience vs efficiency（trade-off）', async (tok) => {
  fresh([0, 4.8, 14], [0, 2.4, 0]);
  const A = bag();
  await step(tok);                                   // 1383.9 what to consider when writing a kernel?
  hd('設計 OS 要考量什麼？', 0, 6.4);
  // a seesaw: plank on a pivot
  const piv = blk('', '#8a7a5c', 0, 0.4, 0, 0.6, 0.8, 0.8);
  const plank = blk('', '#c9b48e', 0, 0.9, 0, 9, 0.15, 1.2);
  void piv;
  say('自己開發或選擇一個作業系統時', '要考量什麼？');
  await step(tok);                                   // 1401 users want two things: first, convenience
  const conv = pal('Convenience', '😊', COL.user, -3.6, 0, 0.8);
  conv.g.position.y = 1.0;
  say('使用者通常希望兩件事', '第一件：convenience（方便）');
  await step(tok);                                   // 1413.7 Windows rose as the first GUI
  A(note('Windows 崛起：第一個圖形介面', -3.6, 3.4));
  say('Microsoft Windows 為什麼崛起？', '它是第一個圖形介面，大家覺得很方便');
  await step(tok);                                   // 1435.3 second: efficiency / performance (games, programs)
  const eff = pal('Efficiency', '⚡', COL.cpu, 3.6, 0, 0.8);
  eff.g.position.y = 1.0;
  A(note('跑 game 不要 delay', 3.6, 3.4));
  say('第二：efficiency（performance）', '跑 game 不要一直 delay、程式越快跑完越好');
  await step(tok);                                   // 1462 early OSes leaned to efficiency; we use Linux command line
  A(idx('早期偏 efficiency；本課用 Linux command line', 0, 5.4));
  say('早期 OS 偏向 efficiency', '本課用 Linux 的 command line：不浪費資源顯示圖形');
  await step(tok);                                   // 1506.9 the two always contradict
  A.clear();
  bad('兩者一定互相矛盾（contradict）', 0, 5.0);
  say('兩件事都想要', '但它們一定是相反的');
  await step(tok);                                   // 1531 adding convenience costs resources → slower
  await anim(tok, 800, (u) => { plank.rotation.z = 0.12 * u; conv.g.position.y = 1.0 + 0.5 * u; eff.g.position.y = 1.0 - 0.5 * u; });
  A(idx('加 GUI → 吃資源 → 變慢', 0, 3.6));
  eff.mood('sad');
  say('為了方便多加東西（像 GUI）', '要用資源、多跑程式，速度一定慢下來');
  await step(tok);                                   // 1543.7 a trade-off
  hot('Trade-off：看使用者在乎什麼', 0, 4.4);
  say('這是一個 trade-off', '看這個系統的使用者在乎什麼');
  await step(tok);                                   // 1554 Windows / phones → convenience; science → efficiency
  A(good('Windows、手機：重 convenience', -3.6, 2.6));
  A(good('科學計算、大型程式：重 efficiency', 3.6, 2.6));
  say('Windows、手機重視 convenience', '跑大型科學計算就要 efficient 的 OS');
  await step(tok);                                   // 1571 early: only efficiency; now convenience matters
  A(idx('早期：花了錢就要看到效果；現在普及 → 方便很重要', 0, -0.4, 1.6));
  say('早期大家只在乎 efficiency', '現在普及、用途多，方便性變得很重要');
  await step(tok);                                   // 1590 phones: battery life is efficiency too
  await anim(tok, 800, (u) => { plank.rotation.z = 0.12 * (1 - u); conv.g.position.y = 1.5 - 0.5 * u; eff.g.position.y = 0.5 + 0.5 * u; });
  eff.mood('happy');
  bub('🔋 耗多少電做多少事 = efficiency', 3.6, 3.4);
  say('手機也一樣：方便很重要', '但耗電能做多少工作，也是 efficiency');
}]);

// 26:52 why the OS matters so much
FRAG.push(['osA-why2', '為什麼 OS 這麼重要：唯一的 interface', async (tok) => {
  fresh([0, 4.8, 14], [0, 2.4, 0]);
  const A = bag();
  await step(tok);                                   // 1633 reason 1: the only interface between programs and hardware
  hd('為什麼 OS 這麼重要？', 0, 6.4);
  blk('user programs', COL.user, 0, 3.6, 0, 7, 0.6, 1.2);
  const os = blk('OS：唯一的 interface', COL.os, 0, 2.3, 0, 7, 0.6, 1.2);
  blk('Hardware', '#8a7a5c', 0, 1.0, 0, 7, 0.6, 1.2);
  say('原因一：它是 user program 和 hardware', '之間「唯一」的 interface');
  await step(tok);                                   // 1650.2 languages: C, Java, Python — many choices
  ['C', 'Java', 'Python'].forEach((t, k) => A(pkt(t, -2.4 + k * 2.4, 4.4)));
  say('程式語言有好多選擇', 'C、Java、Python…');
  await step(tok);                                   // 1662.4 but the OS: just pick one; switch → rewrite
  A(bad('OS 只能選一個；換掉 → 重寫、重調', 0, 5.2));
  glow(os, GOLD);
  say('OS 就只是選哪一個', '不要它，上面整個東西都要重寫');
  await step(tok);                                   // 1678.3 reason 2: it must never break — no bugs
  A.clear(); glow(os, null);
  A(hot('原因二：絕對不能壞、不能有 bug', 0, 5.4));
  say('原因二：OS 比一般程式難', '它絕對不能壞掉、不能有 bug');
  await step(tok);                                   // 1694 apps have bugs: just reopen the page
  const app = pal('App', '🐞', COL.user, -4.8, 0.4, 0.6);
  app.mood('sad');
  A(idx('App 有 bug：重開就好', -4.8, -0.4, 0.4));
  say('一般軟體、App 多少都有 bug', '大家重新開一下就好');
  await step(tok);                                   // 1709.4 the OS crashes → whole machine and its state gone
  glow(os, RED);
  A(bad('OS crash → 整台電腦、狀態、程式全沒了', 0, 4.6));
  say('OS 一 crash，整台電腦就沒了', '電腦的狀態、上面執行的程式都沒了');
  await step(tok);                                   // 1732 its principle: no bug tolerated
  glow(os, null);
  A(note('原則：不能容許任何 bug', 4.6, 4.0));
  say('所以 OS 的原則', '不能容許任何 bug');
  await step(tok);                                   // 1747.1 reason 3: control the OS → steer software and hardware
  A.clear(); gone(app);
  hot('原因三：掌握 OS → 掌握上下的開發', 0, 5.4);
  say('原因三：因為它是唯一的 interface', '控制 OS 的廠商，就掌握上面軟體、下面硬體的開發');
  await step(tok);                                   // 1770 why Microsoft was the richest company
  const ms = pal('Microsoft', '💰', '#4b9ee2', -5, 0.4, 0.7);
  ms.mood('happy');
  say('為什麼 Microsoft 曾是最有錢的公司？', '它只做一個 OS');
  await step(tok);                                   // 1777 apps on Windows must follow its API
  for (const x of [-2.4, 0, 2.4]) await send(tok, 'follow API', 'pkt', V3(x, 4.2, 0.6), V3(x, 2.7, 0.6), 250);
  say('想在 Windows 上跑的 application', '都要 follow 它的 API');
  await step(tok);                                   // 1795.9 hardware must match the OS: Wintel
  const intel = pal('Intel', '', '#2f6fb0', 5, 0.4, 0.7);
  intel.mood('happy');
  A(note('Wintel ＝ Windows ＋ Intel', 0, -1.4, 1.4));
  say('hardware 設計也要跟 OS 搭配', 'Wintel：Windows 加 Intel');
  await step(tok);                                   // 1828.5 Apple: makes both hardware and OS
  const apple = pal('Apple', '🍎', '#d64545', 0, 3.2, 0.7);
  apple.mood('wow');
  say('Apple：hardware 和 OS 都自己做', '才能很強地配合');
  await step(tok);                                   // 1849.9 not total control: they influence each other
  A(idx('不是完全控制：互相影響、互相配合', 0, 5.0, 1));
  say('OS 不是完全控制 hardware', '而是互相影響、互相配合');
  await step(tok);                                   // 1867.2 phones: different needs → different OSes
  A(good('手機需求不同 → 有自己的 OS', 4.6, 3.6));
  say('最佳例子：手機', '需求、硬體不同，OS 就要調整');
}]);

// 31:57 the many OSes
FRAG.push(['osA-oslist', '形形色色的 OS：PC、手機、embedded', async (tok) => {
  fresh([0, 4.8, 14], [0, 2.4, 0]);
  await step(tok);                                   // 1917.1 OSes come in all shapes
  hd('形形色色的 OS', 0, 6.4);
  say('OS 形形色色', '');
  await step(tok);                                   // 1923 x86: Windows and Linux
  const front = (zn) => { zn.userData.name.position.z = 1.75; return zn; };
  front(zone('x86 PC', -4.2, 0, 0, 3.6, 3, '#d6e6f6'));
  pkt('Windows', -5, 1.4); pkt('Linux', -3.4, 1.4);
  say('早期 x86：不外乎 Windows', '還有歷史最久的 Linux');
  await step(tok);                                   // 1946.1 users like Windows; big important systems choose Linux (open source)
  idx('一般使用者：Windows　大型重要系統：Linux', -4.2, 2.6);
  say('一般使用者喜歡 Windows', '大型、重要的系統多選 Linux：跟 open source 很有關');
  await step(tok);                                   // 1958 Apple does its own
  pkt('Apple（macOS）', -4.2, 0.75, 1);
  say('Apple 自己來', '它的作業系統比較不一樣');
  await step(tok);                                   // 1966.1 phones: Android, iOS; Windows 10 Mobile
  front(zone('手機', 0.2, 0, 0, 3, 3, '#e6f3df'));
  pkt('Android', -0.4, 1.4); pkt('iOS', 1, 1.4); pkt('Windows 10 Mobile', 0.2, 0.75, 1);
  say('時代改變有了手機：Android、iOS', 'Windows 也改出 Windows 10 Mobile');
  await step(tok);                                   // 1987 Ubuntu has different versions too
  idx('Ubuntu 也有不同版本', 0.2, 3.3);
  say('像 Ubuntu，也會有不同版本去調整', '');
  await step(tok);                                   // 1993 embedded: very broad — the IoT era
  zone('Embedded', 4.4, 0, 0, 3.2, 3, '#f6e3d6');
  ['💡', '⌚', '🚗'].forEach((t, k) => tag(t, 'val', 3.6 + k * 0.8, 1.2));
  say('Embedded 更廣：任何嵌入式系統', '物聯網世代，什麼 device 都有');
  await step(tok);                                   // 2016.7 its OS must be flexible: drop unneeded parts quickly
  good('OS 要很 flexible：不要的拿掉', 4.4, 2.6);
  say('上面的 OS 要很 flexible', '新產品馬上裝得上，不要的部分拿掉');
  await step(tok);                                   // 2036.8 phones are embedded too, but more general
  idx('手機也算 embedded，但更 general', 0.2, 4.0);
  say('手機也算一種 embedded', '只是更 general 一些');
  await step(tok);                                   // 2047.3 OSes bound to hardware: Xbox, PS3, PS4
  pkt('Xbox・PS3・PS4：embedded OS', 5.4, 1.9, 0);
  say('有些 OS 綁在 hardware 上', '像 Xbox、PS3、PS4 都有 embedded OS');
  await step(tok);                                   // 2066.3 Raspberry Pi: a board with its own OS for prototypes
  const rp = blk('Raspberry Pi', '#2fc092', -2.2, 0.2, 3.2, 2.6, 0.2, 1.6);
  void rp;
  note('板子 ＋ Raspberry Pi OS → 開發嵌入式雛形', -1.0, -0.6, 3.2);
  say('Raspberry Pi：一塊小板子，上面有它的 OS', '拿來開發各種嵌入式系統的雛形');
}]);
  }

  // ═══ osB.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, tint, icon, line, move, ghostBox } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 作業系統 第 1 章（清大 周志遠 第 3B、4A–4D、5A–5D 講）— cued scenes ───
// Every `await step(tok)` waits until the lecturer says that sentence (notes "cues");
// between steps only short moves (≤ ~2.5 s); nothing loops or replays.
// 例子照老師的講法（printf 大檔案、搬 100 個 byte、移動滑鼠、除以 0、4 bytes 的 function pointer、
// switch-case、base / limit、while(1)、alias、dir/ls…）；老師沒給的數字一律標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const sayc = (a, b = '') => say(a, b);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const bx = (t, c, x, y, z = 0, w = 2.4, drop = 0, h = 0.6, d = 0.9) => cube(t, c, [w, h, d], x, y, z, drop);
const pal = (name, v, color, x, z = 0, s = 0.8) => buddy(name, v, color, x, 0, z, s);
const gone = (...os) => os.forEach((o) => { if (!o) return; if (o.g) kill(o.g); else if (o.element) remove(o); else kill(o); });
async function slide(tok, o, x, y, z = 0, ms = 600) { const a = o.position.clone(); await travel(tok, o, a, V3(x, y, z), ms); }
// a label that flies from a to b and then disappears (a message / a byte / an interrupt)
async function fly(tok, kind, text, a, b, ms = 800, keep = false) {
  const l = tag(text, kind, a.x, a.y, a.z); await travel(tok, l, a, b, ms); if (!keep) remove(l); return l;
}
// a horizontal bar that grows from x0 to x1 (timelines)
async function grow(tok, x0, x1, y, color, text, ms = 900, z = 0, h = 0.32) {
  const m = lab.box(color, [1, h, 0.5]); m.scale.x = 0.001; m.position.set(x0, y, z); lab.world.add(m);
  await anim(tok, ms, (u) => { const w = Math.max(0.001, (x1 - x0) * u); m.scale.x = w; m.position.x = x0 + w / 2; });
  if (text) sm(text, (x0 + x1) / 2, y + 0.42, z);
  return m;
}
// a meter: name + bar that fills to a fraction
function meter(name, x, y, color, w = 3) {
  const back = bx('', '#e9e1d2', x + w / 2, y, 0, w, 0, 0.26, 0.4); const lb = sm(name, x - 0.2, y + 0.38);
  const fill = lab.box(color, [1, 0.3, 0.44]); fill.scale.x = 0.001; fill.position.set(x, y, 0.02); lab.world.add(fill);
  return { back, lb, fill, async to(tok, f, ms = 700) { const s0 = fill.scale.x / w; await anim(tok, ms, (u) => { const v = Math.max(0.001, (s0 + (f - s0) * u) * w); fill.scale.x = v; fill.position.x = x + v / 2; }); } };
}
// buffer slots in front of a controller: fill(k) colours the first k slots
function slots(n, x, y, z, color = COL.disk) {
  const ss = []; for (let i = 0; i < n; i++) ss.push(bx('', '#efe7d8', x + (i - (n - 1) / 2) * 0.5, y, z, 0.42, 0, 0.32, 0.42));
  return { ss, fill(k, c) { ss.forEach((s, i) => tint(s, i < k ? (c || color) : '#efe7d8')); } };
}

// ════════ BtHlptO34wM（第 4A 講 Computer-System Organization：controller、busy waiting、interrupt） ════════
// the board of 4A: CPU (a buddy), memory, a device controller with a register and buffer slots, the disk
function rig4(withCtl = true) {
  const zPc = zone('電腦（示意）', 0, 0, -1.2, 13.4, 1.4, '#efe6d4'); zPc.userData.name.center.set(1, 0.5); zPc.userData.name.position.x = -6.6;
  const cpu = pal('CPU', '', COL.cpu, -5.4, 0, 0.85);
  const chip = prop('cpu', -5.4, 0, 1.3, 0.55);
  const mem = bx('Memory', COL.mem, -2.2, 0.4, 0, 2.2, 0, 0.8, 1.1);
  const disk = prop('disk', 5.3, 0, 0, 1.05, 'Disk');
  const R = { cpu, chip, mem, disk };
  if (withCtl) R.ctl = mkCtl(R);
  return R;
}
function mkCtl(R) {
  const ctl = pal('Controller', '', COL.teal, 1.9, 0, 0.8);
  const reg = bx('register', '#cfe3e6', 0.0, 0.8, 0.6, 1.3, 0, 0.3, 0.3);
  const buf = slots(4, 1.9, 0.18, 1.25);
  sm('buffer', 1.9, 0.1, 1.85);
  R.reg = reg; R.buf = buf; return ctl;
}

// 1:01 device controller 與 buffer
FRAG.push(['osB-ctl-buffer', 'Device controller 與 buffer', async (tok) => {
  fresh([0, 5.2, 13.5], [0, 1.4, 0]);
  await step(tok);                                   // 1:01 last time: I/O as the example
  const R = rig4(false);
  const io = bub('例子：從硬碟把資料讀出來（I/O）', 0, 3.4);
  sayc('上次：用 I/O 當例子', '看電腦怎麼運作');
  await step(tok);                                   // 1:26 a device controller in between
  remove(io);
  R.ctl = mkCtl(R);
  hot('device controller', 1.9, 2.6);
  sayc('device 和 memory 中間', '還有一個 device controller');
  await step(tok);                                   // 1:33 the speeds differ too much
  good('快', -3.8, 2.4); bad('慢', 5.3, 2.4);
  sayc('因為兩邊速度差太多', 'CPU / memory 快、device 慢');
  await step(tok);                                   // 1:44 controller has registers; CPU issues instructions
  await fly(tok, 'pkt', 'instruction', V3(-3.6, 2.0, 0.6), V3(-0.2, 1.7, 0.6), 900);
  glow(R.reg, GOLD);
  sayc('controller 上有 register', 'CPU 對它下 instruction');
  await step(tok);                                   // 1:50 tell the controller to move data
  R.ctl.glow('#0d3d40'); R.ctl.mood('wow');
  sayc('叫 controller 去做事', '幫忙搬資料');
  await step(tok);                                   // 1:56 data goes into the buffer first
  for (let k = 1; k <= 3; k++) { await fly(tok, 'pkt', 'data', V3(5.0, 1.0, 0.8), V3(2.4, 0.5, 1.25), 380); R.buf.fill(k); }
  sayc('資料先搬進', 'controller 的 buffer');
  await step(tok);                                   // 2:03 then written to memory
  await fly(tok, 'pkt', 'data', V3(1.9, 0.5, 1.25), V3(-2.2, 1.35, 0.6), 700); R.buf.fill(2);
  glow(R.mem, GREEN);
  sayc('再從 buffer 寫到 memory');
  await step(tok);                                   // 2:10 the buffer is small
  note('buffer 空間有限', 1.9, -0.55, 2.2);
  sayc('它只是個 controller', 'buffer 空間通常很有限');
  await step(tok);                                   // 2:19 its design limits the I/O speed
  sm('controller + buffer 的設計 → 每秒能搬幾 bytes 的上限', 1.9, 3.4);
  sayc('controller 的設計', '決定 device I/O 速度的極限');
  await step(tok);                                   // 2:33 the controller is passive
  R.ctl.mood('calm'); R.ctl.glow(null);
  bub('我是被動的：等指令', 3.3, 2.0, 0.4);
  sayc('controller 也是被動的');
  await step(tok);                                   // 2:36 the master is the CPU
  hot('master', -5.4, 2.6); R.cpu.mood('happy'); await R.cpu.hop(tok);
  sayc('整台電腦的 master 是 CPU', 'CPU 下指令，controller 才去搬');
  await step(tok);                                   // 2:53 buffer full → cannot write more
  R.buf.fill(4, COL.bad);
  bad('buffer 滿了！', 1.9, -1.2, 2.2);
  sayc('buffer 滿了', '就沒辦法再寫資料進去');
  await step(tok);                                   // 3:06 wait until there is room again
  for (let k = 3; k >= 0; k--) { R.buf.fill(k); await wt(tok, 220); }
  sayc('要等 buffer 有空位或清空', '才能搬下一批');
  await step(tok);                                   // 3:17 even simple I/O needs the CPU to control it
  arrow(V3(-4.6, 1.3, 0.5), V3(1.1, 1.3, 0.5), 0x4b9ee2);
  good('簡單的 I/O 也要 CPU 控制、下指令', -1.6, 3.4);
  sayc('所以連簡單的 I/O', '也需要 CPU 去控制、下指令');
}]);

// 3:27 busy waiting
FRAG.push(['osB-busy-wait', 'Busy waiting：CPU 一直 peek status', async (tok) => {
  fresh([0, 5.6, 14], [0, 1.9, 0]);
  await step(tok);                                   // 3:27 the earliest, most direct way
  const R = rig4(true);
  sayc('早期最直接的控制方式');
  await step(tok);                                   // 3:32 busy waiting: the CPU controls everything
  hot('busy waiting', -5.4, 2.7); R.cpu.glow('#123a5c');
  sayc('busy waiting', '由 CPU 完全控制');
  await step(tok);                                   // 3:38 example: output a string
  const cd = code([
    'while (*p != \'\\0\') {            // 到字串結尾為止',
    '  while (peek(status) == BUSY) ;  // 一直檢查',
    '  poke(data, *p++);               // 寫一個 byte',
    '}',
  ], -0.4, 6.4, 0.5, -0.6);
  sm('（課堂程式的示意）', -3.6, 7.2, -0.6);
  sayc('例子：output 一個 string');
  await step(tok);                                   // 3:43 stop at the end-of-character
  cd.hl(0); note('\\0 = 字串結尾', 4.0, 7.2, -0.6);
  sayc('有個 end of character', '寫到那裡就停');
  await step(tok);                                   // 3:49 one character (byte) at a time: poke
  cd.hl(2);
  await fly(tok, 'pkt', "'H'", V3(-3.0, 2.6, 0.6), V3(1.4, 0.6, 1.25), 700); R.buf.fill(1);
  sayc('一個 character（byte）一個 byte', '用 poke 寫出去');
  await step(tok);                                   // 3:58 into the controller's buffer
  for (let k = 2; k <= 3; k++) { await fly(tok, 'pkt', k === 2 ? "'E'" : "'L'", V3(-3.0, 2.6, 0.6), V3(1.9, 0.6, 1.25), 450); R.buf.fill(k); }
  sayc('寫到 device controller', '的 buffer 再搬出去');
  await step(tok);                                   // 4:04 but it fills up
  R.buf.fill(4, COL.bad); const full = bad('buffer 滿 → BUSY', 1.9, 2.4);
  sayc('可是 buffer 會滿');
  await step(tok);                                   // 4:08 so peek the status first
  cd.hl(1);
  await fly(tok, 'pkt', 'peek status?', V3(-3.6, 2.0, 0.6), V3(-0.2, 1.7, 0.6), 700);
  sayc('所以要另一個指令 peek', '先看 status 是什麼');
  await step(tok);                                   // 4:30 stuck here checking again and again
  const cnt = hot('peek ×0', -5.4, 3.3);
  for (let k = 1; k <= 6; k++) { await fly(tok, 'pkt', 'peek?', V3(-3.6, 2.0, 0.6), V3(-0.2, 1.7, 0.6), 260); txt(cnt, 'peek ×' + k); }
  R.cpu.mood('sad');
  sayc('BUSY 就卡在 while 裡', '一直檢查、一直檢查');
  await step(tok);                                   // 4:33 until it says OK, then write the next one
  remove(full); good('OK！', 1.9, 2.4); R.buf.fill(3);
  cd.hl(2); await fly(tok, 'pkt', "'L'", V3(-3.0, 2.6, 0.6), V3(2.6, 0.6, 1.25), 500); R.buf.fill(4);
  sayc('直到說 OK', '才寫下一個 character');
  await step(tok);                                   // 4:48 I/O slow, CPU fast: one byte may take ms
  note('搬 1 byte 可能要好幾 ms', 5.4, 2.2, 0.4);
  sayc('I/O 很慢、CPU 很快', '搬一個 byte 可能要好幾 ms');
  await step(tok);                                   // 5:04 just burning CPU cycles
  bad('CPU 只是在燒 cycle', -5.4, 3.9);
  sayc('CPU 只是忙著燒 cycle', '對使用者一點幫助都沒有');
  await step(tok);                                   // 5:36 the program holds the CPU while doing I/O
  const A = pal('A', 'I/O 中', COL.user, -3.2, 2.6, 0.6);
  bub('A 做 I/O 時還霸佔 CPU', -1.6, 3.2, 2.6);
  sayc('一支程式在做 I/O 時', '仍然霸佔住 CPU');
  await step(tok);                                   // 5:44 multiprogramming does not help
  const B = pal('B', '等 CPU', COL.pink, -0.8, 2.6, 0.6); B.mood('sad');
  bad('multiprogramming 也沒用', -0.8, 4.0, 2.6);
  sayc('放再多程式在記憶體', 'multiprogramming 也沒用');
  await step(tok);                                   // 6:09 100% utilisation, no help to the user
  const m = meter('CPU 使用率', 3.1, 3.6, COL.bad, 2.6); await m.to(tok, 1, 700);
  sm('100%，但都在 peek', 4.4, 3.2);
  sayc('CPU 使用率看起來 100%', '對使用者卻沒幫助');
  void A;
}]);

// 6:17 interrupt-driven
FRAG.push(['osB-intr-timeline', 'Interrupt-driven：CPU 與 I/O 同時運作', async (tok) => {
  fresh([0, 4.4, 13], [0, 2.6, 0]);
  await step(tok);                                   // 6:17 today: driven by interrupt
  const t1 = hot('現在的電腦：driven by interrupt', 0, 6.0);
  sayc('現在的電腦', '都是 driven by interrupt');
  await step(tok);                                   // 6:25 an event-driven architecture
  const evSm = sm('有事（event）才處理 → event-driven', 0, 5.4);
  sayc('反過來：event-driven 的架構');
  await step(tok);                                   // 6:46 it changes the CPU's flow of execution
  const cpu = pal('CPU', '', COL.cpu, -5.6, 0, 0.7);
  const A = pal('A', '', COL.user, -3.4, 0, 0.6);
  sayc('interrupt 可以改變', 'CPU 執行的 flow');
  await step(tok);                                   // 6:58 interrupt it any time, do something else
  await fly(tok, 'bad', 'interrupt!', V3(-0.5, 2.0, 0), V3(-5.6, 1.4, 0), 600);
  cpu.mood('wow'); await cpu.hop(tok);
  sayc('隨時把 CPU 打斷', '叫它去做另一件事');
  await step(tok);                                   // 7:37 the picture: CPU on top, I/O below
  gone(cpu, A, t1);
  hd('CPU', -6.2, 4.0); hd('I/O', -6.2, 1.6);
  line(-5.6, 3.6, 6.2, 3.6, 0, '#cbbd9e'); line(-5.6, 1.2, 6.2, 1.2, 0, '#cbbd9e');
  sm('高＝做原程式　低＝處理別的', 3.6, 4.85);
  sayc('上面是 CPU、下面是 I/O', 'CPU：高＝做自己的程式');
  await step(tok);                                   // 7:51 for I/O: up means idle
  await grow(tok, -5.4, -4.4, 1.55, COL.idle, 'idle', 500);
  sm('I/O：高＝idle　低＝busy 在 transfer', 3.6, 2.45);
  sayc('I/O 反過來：上面是 idle', '往下才是在傳資料');
  await step(tok);                                   // 8:18 both run at the same time
  await Promise.all([grow(tok, -5.4, 0.6, 3.95, COL.user, '使用者程式在算', 1300), grow(tok, -4.4, 0.6, 0.85, COL.io, 'data transfer（busy）', 1300)]);
  sayc('程式在執行的同時', 'I/O 也同時在執行');
  await step(tok);                                   // 8:27 transfer ends, e.g. the buffer is full
  note('buffer 滿了', 0.6, 0.15);
  sayc('transfer 告一段落', '例如 buffer 滿了');
  await step(tok);                                   // 8:51 it needs the CPU → raises an interrupt
  const irq = await fly(tok, 'bad', 'interrupt', V3(0.7, 1.0, 0.3), V3(0.7, 3.6, 0.3), 700, true);
  sayc('要搬進 memory 需要 CPU', '於是發出一個 interrupt');
  await step(tok);                                   // 8:56 cut to the routine that handles I/O
  remove(irq);
  await grow(tok, 0.7, 2.3, 3.25, COL.os, 'OS routine 搬資料', 700);
  await grow(tok, 0.7, 2.3, 1.55, COL.idle, 'idle', 400);
  sayc('打斷原程式', '切到 OS 處理 I/O 的 routine');
  await step(tok);                                   // 9:08 then go back to the original program
  await Promise.all([grow(tok, 2.4, 6.0, 3.95, COL.user, '回去做原程式', 1100), grow(tok, 2.4, 6.0, 0.85, COL.io, '下一批 transfer', 1100)]);
  sayc('搬完就回去', '繼續執行原來的程式');
  await step(tok);                                   // 9:36 user program ⇄ OS program whenever needed
  remove(evSm);
  bub('user program ⇄ OS program', -2.4, 5.6);
  sayc('需要 OS 時隨時切換', '從 user program 到 OS program');
  await step(tok);                                   // 9:52 return and resume, not kill
  good('return → resume（不是 kill）', 4.2, 5.6);
  sayc('做完 return 回原來狀態', '可以 resume，不會被 kill 掉');
  await step(tok);                                   // 10:19 CPU and I/O run at the same time
  good('CPU 與 I/O 同時運作 ✓', 0, 6.4);
  sayc('有了 interrupt', 'CPU 和 I/O 才能同時運作');
}]);

// 10:31 interrupt I/O：A 等 printf、B 用 CPU
FRAG.push(['osB-intr-io', '用 interrupt 做 I/O：A 等、B 跑', async (tok) => {
  fresh([0, 5.6, 14], [0, 1.6, 0]);
  await step(tok);                                   // 10:31 the flow in detail
  zone('CPU', -4.6, 0, 0, 3.0, 2.6, '#dcebf7');
  const osZ = zone('OS（driver / handler）', -0.6, 0, -1.6, 3.6, 1.6, '#ece4fb');
  osZ.userData.name.center.set(0.5, 0.5); osZ.userData.name.position.set(-0.6, 2.2, -1.6);
  const ctl = pal('Controller', '', COL.teal, 3.0, 0, 0.75);
  const disk = prop('disk', 5.6, 0, 0, 0.9, 'Disk');
  const mem = bx('Memory', COL.mem, -0.6, 0.35, 1.6, 2.2, 0, 0.7, 1.0);
  const A = pal('A', '', COL.user, -4.6, 0, 0.7);
  const B = pal('B', '', COL.pink, -3.0, 3.0, 0.6);
  sayc('仔細看 interrupt I/O 的流程');
  await step(tok);                                   // 10:46 the user wants to output a big file
  const f = prop('file', -3.6, 0.9, 0.4, 0.5);
  bub('printf 一個大檔案', -4.6, 2.3);
  sayc('使用者要 output 一個大檔案');
  await step(tok);                                   // 10:52 call the OS → down to the device driver
  await fly(tok, 'pkt', 'call OS', V3(-4.6, 1.2, 0), V3(-0.6, 0.8, -1.6), 800);
  const drv = bx('device driver', COL.os, -0.6, 0.35, -1.6, 2.4, 0, 0.5, 0.8);
  sayc('call OS', '一路走到最底層的 device driver');
  await step(tok);                                   // 11:09 the driver initiates an interrupt I/O
  glow(drv, GOLD); const viaIrq = note('用 interrupt 方式做 I/O', -0.6, 1.3, -1.6);
  sayc('driver 用 interrupt 的方式', 'initiate I/O');
  await step(tok);                                   // 11:29 the CPU only tells the controller
  await fly(tok, 'pkt', '指令', V3(-0.6, 0.8, -1.6), V3(3.0, 1.2, 0), 800);
  ctl.mood('wow');
  sayc('CPU 只需要下指令', '交給 controller');
  await step(tok);                                   // 11:42 move 100 bytes; tell me when all done
  bub('搬 100 個 byte，搬完再通知我', 3.0, 2.3);
  sayc('例如：搬 100 或 200 個 byte', '過程不用找我，搬完再通知');
  await step(tok);                                   // 11:59 the controller moves the data by itself
  for (let k = 0; k < 3; k++) await fly(tok, 'pkt', 'data', V3(3.0, 0.9, 0.5), V3(4.6, 0.6, 0.8), 380);
  sayc('controller 自己開始搬');
  await step(tok);                                   // 12:06 when done it signals an interrupt
  note('搬完 → signal 一個 interrupt', 3.0, 3.0);
  sayc('結束時才 signal interrupt', '通知 CPU：全部搬好了');
  await step(tok);                                   // 12:16 the data sit at the given place in memory
  await fly(tok, 'pkt', 'data', V3(4.6, 0.6, 0.8), V3(-0.6, 1.3, 1.6), 800); glow(mem, GREEN);
  sm('指定的位置', -0.6, -0.15, 2.2);
  sayc('資料放在 memory 指定的位置', 'CPU 可以直接 access');
  await step(tok);                                   // 12:37 A issued printf and waits
  A.mood('sad'); A.set('等 I/O'); remove(viaIrq);
  await slide(tok, A.g, -6.6, 0, 0, 500);
  sayc('A 呼叫 printf 之後', '停在那邊等 I/O 做完');
  await step(tok);                                   // 12:53 the CPU switches to another program
  sayc('CPU 這時做什麼？', '切換到另一支程式');
  await step(tok);                                   // 13:05 switch to program B
  await slide(tok, B.g, -3.5, 0, 0, 600); B.mood('happy'); B.set('計算');
  sayc('switch 到 program B', 'B 還要做計算');
  await step(tok);                                   // 13:14 an interrupt comes in, interrupting B
  await fly(tok, 'bad', 'interrupt', V3(3.0, 1.6, 0), V3(-4.6, 1.6, 0), 800);
  B.mood('wow'); await B.hop(tok);
  sayc('interrupt 一進來', '打斷正在執行的 B，回到 A 那邊');
  await step(tok);                                   // 13:43 now A and B are both ready
  A.mood('happy'); A.set('ready'); B.set('ready');
  sayc('A 的 I/O 做完了', '現在 A 和 B 都 ready');
  await step(tok);                                   // 13:53 the interrupt handler makes A runnable
  const hdl = pal('handler', '', COL.os, -0.6, -1.6, 0.55);
  bub('A 的狀態 → 可執行', -0.6, 1.6, -1.6);
  sayc('interrupt handler 確認 I/O 做完', '把 A 改成可以執行的狀態');
  await step(tok);                                   // 14:35 B continues, or A if its priority is high
  note('B 繼續？還是 A 先？→ CPU scheduling / priority', -2.6, 3.4);
  sayc('接下來誰跑', '看 scheduling（A 的 priority 高就先跑 A）');
  await step(tok);                                   // 14:44 the mouse: the signal comes straight from the controller
  gone(f);
  const ms = icon('🖱️', 'mouse', 5.6, 2.6, 0, 'sm');
  await fly(tok, 'bad', 'signal', V3(5.6, 2.0, 0), V3(-0.6, 1.0, -1.6), 800);
  sayc('同學問滑鼠：', 'signal 直接從 hardware（controller）丟出來');
  await step(tok);                                   // 15:31 OS's mouse handler, then display
  hdl.set('mouse');
  const mon = prop('monitor', 1.6, 0, -2.6, 0.7);
  await fly(tok, 'pkt', '移動游標', V3(-0.6, 1.0, -1.6), V3(1.6, 1.0, -2.6), 600);
  sayc('OS 的 mouse handler 處理', '再 call display 的程式畫到螢幕');
  await step(tok);                                   // 15:48 all of it inside the OS
  good('全部都在 OS 裡，沒經過 user program', -0.6, 3.0, -1.6);
  sayc('這些全部在 OS 裡面', '沒有經過任何 user program');
  void disk; void ms; void mon;
}]);

// 16:05 hardware 被動 vs software 主動；不需要 while loop
FRAG.push(['osB-active-passive', '被動（hardware）與主動（software）', async (tok) => {
  fresh([0, 4.8, 13], [0, 1.6, 0]);
  await step(tok);                                   // 16:05 who produced the interrupt?
  hd('hardware 產生', -3.4, 4.2); hd('software 產生', 3.4, 4.2);
  sayc('interrupt 是 software 產生', '還是 hardware 產生？');
  await step(tok);                                   // 16:15 hardware: passive, interrupts the running program
  const h = pal('程式', '執行中', COL.user, -3.4, 0, 0.7);
  await fly(tok, 'bad', 'signal', V3(-6.2, 1.2, 0), V3(-3.4, 1.0, 0), 600);
  h.mood('wow'); bub('被動：直接被打斷', -3.4, 2.4);
  sayc('hardware 是被動的', '直接打斷現在的程式');
  await step(tok);                                   // 16:23 software: suspends itself and waits
  const s = pal('程式', 'call I/O', COL.pink, 3.4, 0, 0.7);
  s.mood('calm'); s.set('suspend'); bub('主動：自己 suspend，等完成再被叫醒', 3.4, 2.4);
  sayc('software 是主動的', '自己 suspend，完成後再被叫起來');
  await step(tok);                                   // 16:49 suspended → the CPU is free for others
  const o = pal('別人', '用 CPU', COL.gold, 5.8, 0, 0.55); o.mood('happy');
  sayc('call I/O 之後被 suspend', 'CPU 空出來給別的程式');
  await step(tok);                                   // 16:59 no while loop checking the register
  const w = bad('while (peek…) ; ✗', 0, 3.2);
  sayc('不需要 while loop', '一直下指令、看 register 狀態');
  await step(tok);                                   // 17:19 every OS today is interrupt-driven
  remove(w); hot('所有 OS 都是 interrupt driven', 0, 5.2);
  sayc('現在所有 OS', '都是 interrupt driven（event driven）');
  await step(tok);                                   // 17:33 nothing to do → the CPU idles
  const m = meter('CPU 使用率（沒事時）', -2.4, 3.1, COL.cpu, 4.8); await m.to(tok, 0.06, 500);
  sayc('沒事就什麼都不執行', 'CPU idle，使用率很低');
  await step(tok);                                   // 17:44 move the mouse → it reacts at once
  icon('🖱️', '動滑鼠', 0, 1.0, 1.2, 'sm');
  await m.to(tok, 0.5, 500);
  good('trigger interrupt → 馬上反應', 0, 2.3, 1.2);
  sayc('一動滑鼠就 trigger interrupt', '所以馬上有反應');
}]);

// 17:59 hardware interrupt = signal
FRAG.push(['osB-signal', 'Hardware interrupt 叫 signal', async (tok) => {
  fresh([0, 4.4, 12], [0, 1.6, 0]);
  await step(tok);                                   // 17:59 interrupts can be triggered in many ways
  hd('interrupt', 0, 4.6);
  line(-0.2, 4.3, -3.4, 3.4); line(0.2, 4.3, 3.4, 3.4);
  hd('hardware', -3.4, 3.1); hd('software', 3.4, 3.1);
  sayc('trigger interrupt 有很多方式', '分 software 和 hardware');
  await step(tok);                                   // 18:11 hardware: produced by any device
  prop('keyboard', -4.8, 0, 0.6, 0.6); prop('disk', -3.0, 0, 0.6, 0.6); icon('🖱️', '', -1.8, 0.6, 0.6, 'sm');
  sayc('任何 device 產生的', '不是 user program 的 instruction 產生');
  await step(tok);                                   // 18:25 hardware interrupt has a special name: signal
  await fly(tok, 'bad', 'signal', V3(-3.4, 1.2, 0.6), V3(-3.4, 2.4, 0.6), 500, true);
  hot('Hardware interrupt ＝ signal', -3.4, 1.8, 1.4);
  sayc('hardware 產生的 interrupt', '特別叫做 signal');
  await step(tok);                                   // 18:49 a signal can never come from software
  bad('signal 不會由 software 產生', 3.4, 2.2);
  sayc('signal 一定是 hardware 產生', '不可能是 software');
}]);

// 18:59 software interrupt = trap：error 與 system call
FRAG.push(['osB-trap-kinds', 'Software interrupt（trap）：error 與 system call', async (tok) => {
  fresh([0, 5.0, 13.5], [0, 1.8, 0]);
  await step(tok);                                   // 18:59 software: triggered by the user program
  zone('user program', -3.4, 0, 0, 5.6, 3.0, '#e3f3ea');
  zone('OS', 3.6, 0, 0, 5.0, 3.0, '#ece4fb');
  const u = pal('程式', '', COL.user, -3.4, 0, 0.7);
  const os = pal('OS', '', COL.os, 3.6, 0, 0.75);
  sayc('software interrupt', '一定是 user program 引起的');
  await step(tok);                                   // 19:12 case 1: an error in your code
  hd('① 程式有 error（不預期的）', -3.4, 3.4);
  sayc('第一種：程式裡有 error', '這天天發生');
  await step(tok);                                   // 19:20 e.g. divide by zero → segmentation fault
  const e = bad('x / 0', -3.4, 2.4); u.mood('wow');
  sayc('例如除以 0', '或 segmentation fault');
  await step(tok);                                   // 19:35 why doesn't the whole machine crash?
  sayc('原程式沒辦法繼續', '為什麼整台電腦沒 crash？');
  await step(tok);                                   // 19:52 the OS throws an interrupt and handles it
  await fly(tok, 'bad', 'interrupt', V3(-2.6, 1.2, 0), V3(1.4, 1.2, 0), 800);
  os.mood('calm'); const resetBub = bub('reset PC → 印出 error message', 3.6, 2.4);
  sayc('OS 偵測到 error，throw interrupt', '把 PC 移去印訊息，不再往下跑');
  await step(tok);                                   // 20:19 e.g. accessing another program's memory
  remove(e); bad('碰別人的 memory → 擋下', -3.4, 2.4);
  sayc('像存取別人的 memory', 'OS 擋下來、丟 error message');
  await step(tok);                                   // 20:51 case 2, most common: system call
  hd('② system call（最常見）', -3.4, -1.4, 1.4);
  u.mood('calm');
  sayc('第二種、最常見', 'system call');
  await step(tok);                                   // 21:07 unlike a function call, always through an interrupt
  sm('一般 function call：PC 直接跳過去', -3.4, -2.0, 1.4);
  sayc('和一般 function call 不同', 'system call 一定透過 interrupt');
  await step(tok);                                   // 21:28 e.g. write out to screen → soft interrupt, wait
  await fly(tok, 'pkt', 'write to screen', V3(-2.6, 1.0, 0.4), V3(0.8, 1.0, 0.4), 800);
  u.set('等'); bub('找對應的 routine 處理', 3.6, 3.2);
  sayc('例如 write out to screen', '丟 soft interrupt、等 OS 處理完');
  await step(tok);                                   // 21:52 why indirect? protection (later)
  prop('lock', 0.2, 0, 1.2, 0.8);
  sayc('為什麼要間接處理？', '跟系統的保護有關（後面講）');
  await step(tok);                                   // 22:16 the OS can check it is a valid interrupt
  remove(resetBub);
  good('OS 檢查：是有效的 interrupt 嗎？', 0.2, 2.4, 1.2);
  sayc('透過 interrupt，OS 可以檢查', '哪些有效都定義好了，繞不過去');
  await step(tok);                                   // 22:52 software → trap, hardware → signal
  hot('Software interrupt ＝ trap', 0, 5.0); sm('（Hardware ＝ signal）', 0, 4.4);
  sayc('software interrupt 叫 trap', 'hardware 叫 signal');
  await step(tok);                                   // 23:14 trapped into the OS
  await slide(tok, u.g, 1.4, 0, 0, 700); u.mood('wow');
  sayc('程式被 trap 到 OS 裡', '由 OS 決定怎麼處理');
}]);

// 23:40 hardware interrupt 的處理流程
FRAG.push(['osB-hw-flow', 'Hardware interrupt：interrupt vector → service routine → return', async (tok) => {
  fresh([0, 5.6, 14], [0, 2.4, 0]);
  await step(tok);                                   // 23:40 the flow; hardware vs software handling
  sayc('仔細看流程', 'hardware 和 software 的處理有點不同');
  await step(tok);                                   // 23:49 resident monitor = memory; user side and OS side
  zone('resident monitor（memory）', 0, 0, 0, 13, 3.6, '#f1eadb');
  hd('user program', -4.0, 3.9); hd('OS', 4.4, 3.9);
  const pc = code(['i1: load', 'i2: add ', 'i3: mul ', 'i4: store'], -4.6, 3.1, 0.5, 0.2);
  sayc('resident monitor 就是 memory', '左邊 user program、右邊 OS');
  await step(tok);                                   // 24:17 the user moves the mouse
  icon('🖱️', '動滑鼠', -6.3, 0.9, 1.4, 'sm');
  pc.hl(1);
  sayc('程式跑到一半', '使用者動了一下滑鼠');
  await step(tok);                                   // 24:37 it can cut in between any two instructions
  await fly(tok, 'bad', 'interrupt', V3(-6.3, 0.4, 1.4), V3(-1.6, 2.0, 0.6), 500);
  const cutHot = hot('← 打斷在任何一行之間', -2.0, 2.6, 0.2);
  sayc('任何一行 instruction 中間', '都可能被 hardware interrupt 打斷');
  await step(tok);                                   // 24:54 the hardware (motherboard) detects the signal
  prop('cpu', -1.0, 0, 1.8, 0.5); sm('motherboard 偵測 signal', -1.0, 0.75, 2.2);
  sayc('先由 hardware（主機板）', 'detect 到 signal');
  await step(tok);                                   // 25:08 look up the interrupt vector
  remove(cutHot);
  const vec = []; for (let i = 0; i < 5; i++) vec.push(bx(String(i), '#e8dcc4', 1.0, 3.6 - i * 0.55, 0.2, 0.9, 0, 0.45, 0.6));
  hd('interrupt vector', 1.0, 4.3);
  sayc('第一件事：查 interrupt vector');
  await step(tok);                                   // 25:17 an array of function pointers
  vec.forEach((v, i) => { v.userData.p = sm('→ ptr', 2.5, 3.6 - i * 0.55, 0.2); });
  sayc('vector 是一個 array', '裝的只是 function pointer');
  await step(tok);                                   // 25:38 routines differ in size → only 4-byte pointers
  note('每格只放 4 bytes 的 pointer（routine 大小各不同）', 1.0, 0.0, 1.6);
  sayc('每個 routine 大小不同', '所以每格只放 4 bytes 的 pointer');
  await step(tok);                                   // 25:44 the signal number picks the slot
  await fly(tok, 'pkt', 'signal #2', V3(-1.0, 1.2, 1.8), V3(-0.9, 2.5, 0.2), 600);
  glow(vec[2], GOLD);
  sayc('signal 帶 signal number', '對到 vector 的某一格');
  await step(tok);                                   // 26:08 installing a driver overrides that pointer
  txt(vec[2].userData.p, '→ driver');
  sayc('裝 driver 時', '就是 override 那一格的 pointer');
  await step(tok);                                   // 26:29 redirect to that function's code
  const r = bx('handler code', COL.os, 4.4, 1.9, 0.2, 2.0, 0, 0.9, 0.8);
  arrow(V3(3.0, 2.4, 0.2), V3(3.4, 2.0, 0.2), 0x9b7ef4);
  sayc('拿到 function pointer', '就被 redirect 到那段 code');
  await step(tok);                                   // 26:36 it is called the service routine
  hot('service routine', 4.4, 2.9, 0.2); glow(r, GOLD);
  sayc('真正處理的程式', '叫 service routine');
  await step(tok);                                   // 27:05 it must return without disturbing the program
  sayc('做完一定要 return', '不能影響原程式的執行');
  await step(tok);                                   // 27:23 it recorded which program and its PC
  note('記下：哪支程式、PC = i2', -4.0, -0.6, 1.6);
  sayc('interrupt 時已記下', '被打斷的程式和它的 program counter');
  await step(tok);                                   // 27:30 restore and resume at the right place
  await fly(tok, 'pkt', 'return', V3(4.4, 1.4, 0.4), V3(-4.6, 2.6, 0.4), 800);
  pc.hl(2); good('從 i3 繼續 resume', -1.6, 1.0, 0.4);
  sayc('restore 這些資訊', '從正確的位置 resume');
  await step(tok);                                   // 27:51 the vector is fixed by the motherboard
  sm('欄位數固定（跟主機板綁死），只能換裡面的值', 1.0, 5.0);
  sayc('vector 是固定的', '能處理的 signal number 跟主機板綁死');
}]);

// 28:20 software interrupt（trap）的處理流程
FRAG.push(['osB-sw-flow', 'Software interrupt（trap）：switch-case', async (tok) => {
  fresh([0, 5.4, 13.5], [0, 2.2, 0]);
  await step(tok);                                   // 28:20 software looks similar but is active
  for (const zn of [zone('user program', -4.0, 0, 0, 5.0, 3.4, '#e3f3ea'), zone('OS', 2.8, 0, 0, 7.0, 3.4, '#ece4fb')]) zn.userData.name.position.z = 1.95;
  const u = pal('程式', '', COL.user, -4.0, 0.4, 0.7);
  sayc('software 的流程看起來很像', '但它是主動的');
  await step(tok);                                   // 28:33 the user actively needs the OS (syscall, ÷0)
  const askBub = bub('我要 system call！（或除以 0）', -4.0, 2.4, 0.4);
  sayc('使用者主動需要 OS 幫忙', 'system call，或除以 0');
  await step(tok);                                   // 29:00 record the position, then trap
  note('記下目前位置', -4.0, -0.9, 1.6);
  await fly(tok, 'bad', 'trap', V3(-3.0, 1.4, 0.4), V3(0.6, 1.4, 0.4), 700);
  sayc('一樣先記下位置', '然後 trap 進 OS');
  await step(tok);                                   // 29:12 switch-case, not an array
  const sw = code(['switch (num) {', '  case 1: open(); ', '  case 2: write();', '  case 3: close();', '  ...', '}'], 2.6, 3.2, 0.48, 0.2);
  sayc('這裡用 switch-case', '不是 array');
  await step(tok);                                   // 29:26 an OS may define 100, 1000 system calls
  sm('有的 OS 100 個、有的 1000 個', 5.6, 3.4, 0.2);
  sayc('software 可以定義任意多個', '100 個、1000 個都可以');
  await step(tok);                                   // 29:39 unbounded
  hot('數量 unbounded → 不能燒死成 array', 2.8, 4.3);
  sayc('system call 數量是 unbounded', '所以實作成 switch-case');
  await step(tok);                                   // 29:51 load a kernel module to add new ones
  const mod = bx('kernel module', COL.gold, 5.6, 0.35, 1.2, 1.9, 2.5, 0.5, 0.6);
  sw.ls[4].element.textContent = '  case 9: new();  ';
  sayc('load kernel module', '就能任意增加新的 system call');
  await step(tok);                                   // 30:08 match the number, run the routine
  sw.hl(2); await fly(tok, 'pkt', 'num = 2', V3(0.6, 1.8, 0.4), V3(2.0, 2.3, 0.4), 500);
  sayc('依 system call number 比對', '找到 routine 開始執行');
  await step(tok);                                   // 30:22 return to whoever made the call
  remove(askBub);
  await fly(tok, 'pkt', 'return', V3(-0.8, 1.4, 0.6), V3(-2.6, 1.4, 0.6), 800);
  u.mood('happy');
  sayc('執行完一樣 return', '回到 call system call 的人');
  await step(tok);                                   // 30:48 hardware → interrupt vector; software → switch-case
  hd('hardware → interrupt vector', -3.0, 5.0); hd('software → OS 的 switch-case', 3.0, 5.0);
  sayc('hardware 用 interrupt vector', 'software 用 OS 寫的 switch-case');
  await step(tok);                                   // 31:00 the flow is the same
  good('流程相同：都是 interrupt', 0, 5.8);
  sayc('跑到 OS 不同的 code', '但流程是相同的');
  void mod;
}]);

// 31:10 共同架構、中斷中的中斷、mask
FRAG.push(['osB-intr-common', '共同架構與中斷中的中斷', async (tok) => {
  fresh([0, 5.0, 13.5], [0, 2.0, 0]);
  await step(tok);                                   // 31:10 the common parts: an interrupt vector
  hd('一定有的三樣東西', 0, 5.2);
  const v = bx('① interrupt vector', '#e8dcc4', -4.2, 3.9, 0, 3.2, 0, 0.55, 0.7);
  sayc('廣義的基本架構：', '① interrupt vector（只存 function pointer）');
  await step(tok);                                   // 31:27 handlers / routines that can be overwritten
  bx('② handler / routine', COL.os, 0, 3.9, 0, 3.2, 0, 0.55, 0.7);
  sm('可以被 overwrite', 0, 3.3);
  sayc('② interrupt handler / routine', '可以被 overwrite');
  await step(tok);                                   // 31:36 the interrupted one's address
  bx('③ 被打斷者的 address', COL.gold, 4.2, 3.9, 0, 3.2, 0, 0.55, 0.7);
  sm('PC：才回得去', 4.2, 3.3);
  sayc('③ 記住被打斷那個人的 address', '主動打斷自己也一樣要記');
  await step(tok);                                   // 32:22 interrupted again halfway through a routine?
  const r1 = pal('routine', '處理中', COL.os, -2.4, 0, 0.7);
  await fly(tok, 'bad', 'interrupt ②', V3(-6.0, 1.2, 0), V3(-2.4, 2.0, 0), 600);
  r1.mood('wow');
  sayc('routine 做到一半', '又被 interrupt 怎麼辦？');
  await step(tok);                                   // 32:50 more state to save → overhead
  for (let k = 0; k < 3; k++) bx(['registers', 'program state', 'memory 狀態'][k], '#e9e1d2', 1.4, 0.3 + k * 0.62, 0, 2.2, 1.5, 0.5, 0.8);
  sayc('要回到原來，就得記很多狀態', '花很多 overhead');
  await step(tok);                                   // 33:11 serious synchronization problems
  bad('一直被打斷 → synchronization 問題', 1.4, 2.6);
  sayc('一直切換、一直被打斷', '會有很嚴重的 synchronization 問題');
  await step(tok);                                   // 33:17 the OS must be very fast
  sm('理想：感覺不到 OS 存在', 4.8, 1.4);
  sayc('OS 必須非常快', '最好讓人感覺它不存在');
  await step(tok);                                   // 33:40 service routines usually written in assembly
  note('service routine 常用 assembly 寫', 4.8, 0.6);
  sayc('為了快', 'service routine 通常用 assembly 寫');
  await step(tok);                                   // 33:56 Linux disables later signals while handling
  const d = bad('處理時 disable 後來的 signal（當沒看見）', -2.4, 2.4);
  sayc('像 Linux：處理 interrupt 時', 'disable 後來的 signal，直接忽略');
  await step(tok);                                   // 34:19 interrupts can be masked by priority
  remove(d); gone(r1);
  const hi = pal('High', '執行中', COL.bad, -3.0, 0, 0.65); const lo = pal('Low', '被忽略', COL.idle, -4.9, 0, 0.55); lo.mood('sad');
  sayc('interrupt 可以被 mask', 'high priority 執行時，low priority 被忽略');
  await step(tok);                                   // 34:34 why moving the mouse sometimes does nothing
  icon('🖱️', '動了沒反應', -6.2, 1.6, 0.8, 'sm');
  sayc('所以有時動滑鼠沒反應', '因為卡在某個 interrupt routine 裡');
  await step(tok);                                   // 34:50 remember: vector, routine, why save the address
  glow(v, GOLD);
  sayc('要記：interrupt vector、routine', '為什麼要記被打斷者的 address');
  await step(tok);                                   // 35:48 trap = software, signal = hardware
  hot('trap ＝ software interrupt', -2.6, 6.0); hot('signal ＝ hardware interrupt', 2.6, 6.0);
  sayc('trap ＝ software interrupt', 'signal ＝ hardware interrupt');
  void hi;
}]);

// ════════ 7z3hoaide-4（第 4B 講：storage hierarchy、main memory、DRAM / SRAM） ════════
const TIERS = [['register', '#c96b6b'], ['L1 cache', '#e08a4c'], ['L2 / L3 cache', '#e0a84c'], ['main memory', COL.cpu], ['hard drive', '#7d9a63'], ['光碟', '#8fae8a'], ['tape', '#9a8f7a']];
const tierY = (i) => 5.6 - i * 0.66;
function tierBox(i, drop = 0) { return bx(TIERS[i][0], TIERS[i][1], 0, tierY(i), 0, 1.7 + i * 1.05, drop, 0.52, 1.1); }

// 0:03 storage hierarchy
FRAG.push(['osB-hierarchy', 'Storage hierarchy：越上越快、越下越大越便宜', async (tok) => {
  fresh([0, 3.8, 13], [0, 3.4, 0]);
  await step(tok);                                   // 0:03 now: how data is stored and read
  hd('資料的儲存與讀取', 0, 6.6);
  sayc('接下來：電腦怎麼', '儲存、讀取資料');
  await step(tok);                                   // 0:07 much data is resident, like files
  const f1 = prop('file', -1.0, 2.0, 0, 0.8), f2 = prop('file', 0.2, 2.0, 0.2, 0.8);
  sayc('很多資料是常駐的', '像我們的檔案');
  await step(tok);                                   // 0:51 hierarchical: higher = faster but smaller
  gone(f1, f2);
  arrow(V3(-5.6, 1.8, 0), V3(-5.6, 6.0, 0), 0xc96b6b); sm('越快、越小', -5.6, 6.4);
  sayc('hierarchical 的架構', '越上面越快、空間越小');
  await step(tok);                                   // 0:54 lower = stores more, slower
  arrow(V3(5.6, 6.0, 0), V3(5.6, 1.8, 0), 0x7d9a63); sm('存越多、越慢', 5.6, 1.4);
  sayc('越下面存越多', '但速度越慢');
  await step(tok);                                   // 1:03 and cheaper
  sm('越便宜', 5.6, 0.9);
  sayc('價格也越便宜');
  await step(tok);                                   // 1:12 rich? use only one kind — allowed
  const rich = icon('💰', '全都用最快的？', 0, 3.6, 1.0);
  sayc('很有錢能全部用最快的嗎？', '可以，沒人規定電腦長什麼樣');
  await step(tok);                                   // 1:24 limited money + efficiency → hierarchy is best
  remove(rich);
  const moneyG = good('錢有限 + 看效率 → hierarchy 最好', 0, 3.6, 1.0);
  sayc('有限的錢、考慮效率', '用 hierarchy 通常效果最好');
  await step(tok);                                   // 1:44 how big each layer, what to store: design
  const designN = note('每層多大？放什麼？→ 看設計', 0, 0.9, 1.2);
  sayc('每層多大、放什麼資料', '要看設計：設計不好，花錢也不會變快');
  await step(tok);                                   // 2:19 top: register, inside the CPU
  gone(moneyG, designN);
  const T = [tierBox(0, 2)]; hot('CPU 裡', 1.5, tierY(0));
  sayc('最上面：register', '在 CPU 裡面');
  await step(tok);                                   // 2:27 then caches L1, L2, L3
  T.push(tierBox(1, 2)); T.push(tierBox(2, 2));
  sayc('接著是 cache', 'L1、L2、L3 好幾層');
  await step(tok);                                   // 2:40 L1 per core, lower ones shared
  sm('L1：每個 core 自己的', 3.3, tierY(1)); sm('L2 / L3：大家共用', 4.0, tierY(2));
  sayc('上層 cache 每個 core 自己有', '下層 L2、L3 可能共用');
  await step(tok);                                   // 2:50 memory: the main one
  T.push(tierBox(3, 2)); glow(T[3], GOLD);
  sayc('memory 是最主要的', '而且 CPU 可以直接 access');
  await step(tok);                                   // 2:58 below: secondary storage
  line(-5.2, tierY(3) - 0.34, 5.2, tierY(3) - 0.34, 0.6, '#a8730f'); sm('以下統稱 secondary storage', -3.6, tierY(4) + 0.05, 0.7);
  T.push(tierBox(4, 2));
  sayc('memory 以下統稱', 'secondary storage：hard drive…');
  await step(tok);                                   // 3:08 optical disc, tape — don't laugh
  T.push(tierBox(5, 2)); T.push(tierBox(6, 2));
  sayc('再來是光碟、tape', '別笑，tape 沒有過時');
  await step(tok);                                   // 3:26 big systems still end with tape
  hot('大型系統的最後一層仍是 tape', 0, tierY(6) - 0.75, 0.8);
  sayc('最 fancy 的系統', '最後一層仍然是 tape');
  await step(tok);                                   // 3:36 cheap, large, hard to break
  good('便宜、存得多、不容易壞', 3.6, tierY(6) - 0.2, 1.0);
  sayc('便宜、容量大，而且不容易壞', '比硬碟 reliable；上面再用多層加速');
}]);

// 4:11 新技術與三個不變的因素
FRAG.push(['osB-hier-factors', '三個不變的因素：速度、價錢、volatile', async (tok) => {
  fresh([0, 3.8, 13], [0, 3.4, 0]);
  const T = TIERS.map((_, i) => tierBox(i));
  await step(tok);                                   // 4:11 flash, non-volatile memory keep improving
  await fly(tok, 'pkt', 'SSD / flash / non-volatile memory', V3(7.0, tierY(3) - 0.33, 1.0), V3(5.8, tierY(3) - 0.33, 1.0), 900, true);
  sayc('Flash、non-volatile memory', '新技術插在 hierarchy 中間');
  await step(tok);                                   // 4:51 three things never change: speed
  hd('不變的三件事', -5.4, 6.4);
  sm('① 速度：上層一定快', -5.4, 5.8);
  sayc('不管怎麼變，有三件事不變', '① 速度：上層一定比較快');
  await step(tok);                                   // 4:59 money
  sm('② 價錢', -5.4, 5.3);
  sayc('② 錢', '一定要考慮');
  await step(tok);                                   // 5:11 volatile: lost when powered off
  for (let i = 0; i <= 3; i++) T[i].material.emissive = new THREE.Color('#3a1010');
  bad('volatile：斷電就消失', 4.9, tierY(1));
  good('non-volatile', 5.0, tierY(5));
  sm('③ volatile 或 non-volatile', -5.4, 4.8);
  sayc('③ volatile：關電就遺失', 'memory、cache 以上全部是 volatile');
  await step(tok);                                   // 5:26 a crash → your data is gone
  bad('system crash → 資料沒了', 0, 6.6);
  sayc('system crash 了', '資料就沒了，這是 volatile 的缺點');
  await step(tok);                                   // 5:36 non-volatile memory: hope — but pricey
  note('NVM：快又不怕斷電，但比較貴 → 仍在中間', 0, 1.0, 1.0);
  sayc('non-volatile memory 帶來希望', '但比較貴，不可能全部都用它');
}]);

// 6:03 main memory 是分界
FRAG.push(['osB-mem-boundary', 'Main memory：CPU 能直接存取的最後一層', async (tok) => {
  fresh([0, 4.6, 13], [0, 1.6, 0]);
  await step(tok);                                   // 6:03 the key dividing point is the memory layer
  const mem = bx('Main memory', COL.cpu, 0, 0.45, 0, 3.0, 2, 0.9, 1.3);
  hot('分割點', 0, 1.6);
  sayc('儲存最重要的分割點', '是 memory 這一層');
  await step(tok);                                   // 6:17 von Neumann: memory, CPU, I/O devices
  const cpu = pal('CPU', '', COL.cpu, -4.6, 0, 0.8);
  const disk = prop('disk', 4.6, 0, 0, 0.9, 'I/O device');
  sm('von Neumann architecture', 0, 3.8);
  sayc('von Neumann：CPU、memory、I/O', 'memory 一直都是主角');
  await step(tok);                                   // 6:34 the last layer the CPU can access directly
  arrow(V3(-3.8, 0.8, 0.4), V3(-1.6, 0.8, 0.4), 0x2fc092);
  good('CPU 直接 access', -2.7, 1.9);
  bad('CPU 不能直接讀', 4.6, 2.0);
  sayc('memory 是 CPU 能直接 access', '的最後一層');
  await step(tok);                                   // 6:47 register and cache are only copies
  bx('copy', '#e08a4c', -4.6, 2.3, 0, 0.9, 1, 0.35, 0.5); bx('copy', '#c96b6b', -4.6, 2.75, 0, 0.9, 1, 0.35, 0.5);
  note('以 memory 上的資料為準', 0, 2.4);
  sayc('register、cache 都只是 copy', '最後以 main memory 的資料為準');
  await step(tok);                                   // 7:06 RAM = Random Access Memory
  sm('技術：RAM ＝ Random Access Memory', 0, -0.3, 1.0);
  sayc('它的技術就是 RAM', 'Random Access Memory');
  await step(tok);                                   // 7:19 secondary: move to memory first
  await fly(tok, 'pkt', 'data', V3(4.4, 1.0, 0.4), V3(0.4, 1.0, 0.4), 700, true);
  sayc('secondary storage 的資料', '要先搬到 memory 才能被讀，所以慢');
  await step(tok);                                   // 7:37 real-time systems have no secondary storage
  bad('real-time system 不用（搬移太花時間）', 4.6, 3.0);
  sayc('所以 real-time system', '不會有 secondary storage');
  await step(tok);                                   // 7:52 secondary storage is larger (cheaper)
  sm('比較大、比較便宜', 4.6, -0.4, 1.0);
  sayc('secondary storage 特色：', '比較大（因為比較便宜）');
  await step(tok);                                   // 7:58 and non-volatile
  good('non-volatile：斷電還在', 4.6, 3.8);
  sm('memory：暫時的', 0, -0.9, 1.0);
  sayc('而且 non-volatile', '斷電後資料還在');
  await step(tok);                                   // 8:11 hard disk is standard; SSD, flash too
  prop('disk', 3.4, 0, 2.0, 0.55); bx('SSD', '#7d9a63', 5.6, 0.2, 2.0, 0.9, 1, 0.3, 0.6);
  sayc('最標準的是硬碟', 'SSD、flash 也都是 secondary storage');
  void mem; void cpu; void disk;
}]);

// 8:38 DRAM vs SRAM、random access
FRAG.push(['osB-dram-sram', 'DRAM vs SRAM、random access', async (tok) => {
  fresh([0, 4.8, 13.5], [0, 2.0, 0]);
  await step(tok);                                   // 8:38 RAM is made as DRAM or SRAM
  hd('DRAM', -3.6, 5.4); hd('SRAM', 3.6, 5.4);
  sayc('RAM 的製程', '分成 DRAM 跟 SRAM');
  await step(tok);                                   // 8:41 DRAM: one transistor → small, cheap, low power
  sm('1 個 transistor', -3.6, 4.8); good('小・便宜・省電', -3.6, 4.2);
  sayc('DRAM 只需要一個 transistor', '比較小、便宜、省電');
  await step(tok);                                   // 8:50 but slower → main memory
  bad('比較慢', -3.6, 3.6); const mm = bx('main memory', COL.cpu, -3.6, 0.4, 0, 2.6, 2, 0.7, 1.0);
  sayc('但速度比較慢', '→ 拿來做 main memory');
  await step(tok);                                   // 9:10 the improvement is in the bus to DRAM
  const bus = bx('bus', '#cbbd9e', -3.6, 1.15, 0, 0.5, 0, 0.8, 0.4);
  sayc('進步多半在', '存取 DRAM 的 bus');
  await step(tok);                                   // 9:16 DDR generations
  sm('DDR 第一代、第二代、第三代…', -3.6, 2.0, 0.8);
  sayc('買電腦時說的 DDR 幾代', '講的就是 memory bus');
  await step(tok);                                   // 9:32 many cores → the bus is the bottleneck
  const cores = [0, 1, 2].map((k) => pal('core', '', COL.cpu, -5.4 + k * 1.8, 2.4, 0.45));
  bad('大家搶 → bus 是 bottleneck', -3.6, 2.9, 0.8);
  sayc('core 越來越多、搶著讀資料', 'bus 常常才是真正的 bottleneck');
  await step(tok);                                   // 9:47 SRAM: bigger, power-hungry, fast, expensive
  sm('比較大・耗電', 3.6, 4.8); good('快', 3.6, 4.2); bad('貴', 3.6, 3.6);
  sayc('SRAM：比較大、耗電', '但速度快，所以比較貴');
  await step(tok);                                   // 9:58 → cache L1/L2/L3, even registers
  bx('cache', '#e08a4c', 3.6, 0.4, 0, 2.0, 2, 0.6, 0.9); bx('register', '#c96b6b', 3.6, 1.05, 0, 1.4, 2, 0.5, 0.8);
  sayc('→ 拿來做 L1、L2、L3 cache', '甚至 register');
  await step(tok);                                   // 10:26 every solution has a trade-off
  hot('trade-off：越快通常越貴', 0, 6.1);
  sayc('大部分 solution 都有 trade-off', '越快的通常越貴');
  await step(tok);                                   // 10:35 a technology that dominates wipes out the old one
  const old = bx('舊技術', '#d8cfc0', 0, 0.3, 1.6, 1.6, 0, 0.5, 0.7);
  await anim(tok, 900, (u) => { old.position.y = 0.3 - u * 1.2; });
  sayc('若某技術全面勝出', '舊的就從 hierarchy 上消失');
  await step(tok);                                   // 11:04 random access: same time for any location
  gone(old, mm, bus, ...cores);
  const cells = []; for (let i = 0; i < 8; i++) cells.push(bx(String(i === 7 ? 100 : i + 1), '#efe7d8', -2.8 + i * 0.8, 0.3, 1.4, 0.7, 0, 0.45, 0.7));
  await fly(tok, 'pkt', '讀', V3(-2.8, 1.2, 1.4), V3(-2.8, 0.7, 1.4), 300); sm('同樣時間', -2.8, -0.4, 1.8);
  await fly(tok, 'pkt', '讀', V3(2.8, 1.2, 1.4), V3(2.8, 0.7, 1.4), 300); sm('同樣時間', 2.8, -0.4, 1.8);
  sayc('random access：讀任何位置', '時間都一樣（第 1 或第 100 個 byte）');
  await step(tok);                                   // 11:24 like NUMA/UMA: users want consistent performance
  good('效能一致、可預期', 0, 1.6, 1.4);
  sayc('還記得 NUMA、UMA？', '使用者希望每次效能都一致');
  await step(tok);                                   // 11:47 disk is different: time depends on position
  prop('disk', 5.6, 0, 1.4, 0.7); bad('位置不同 → 時間不同', 5.6, 1.9, 1.4);
  sayc('disk 就完全不同', '讀寫位置不同，花的時間就不同');
  void cells;
}]);

// ════════ 9vrPlp_f5A0（第 5A 講：Nachos 是一個 virtual machine、file system stub） ════════
// layers drawn bottom → top: x86 hardware, Linux, Nachos, user program
function layer(name, color, y, w = 7.4, z = 0, drop = 0) { return bx(name, color, 0, y, z, w, drop, 0.62, 1.4); }

// 1:40 Nachos：OS 上面又架一個 OS
FRAG.push(['osB-nachos-vm', 'Nachos：跑在 Linux 上的 OS → virtual machine', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 2.4, 0]);
  await step(tok);                                   // 1:40 what kind of OS is Nachos? a complete OS
  const nb = pal('Nachos', 'OS', COL.os, 0, 1.6, 0.9);
  sayc('Nachos 是什麼樣的 OS？', '它是一個完整的作業系統');
  await step(tok);                                   // 1:48 it runs on Linux, not on hardware
  const hw = layer('x86 hardware', '#8a94a6', 0.31);
  const lx = layer('Linux（真的 OS）', '#4b9ee2', 0.95, 7.4, 0, 2);
  await slide(tok, nb.g, 0, 1.6, 0, 700);
  sayc('它不是跑在 hardware 上', '而是跑在 Linux 上');
  await step(tok);                                   // 2:03 an OS on top of an OS, behaving the same
  const vmBub = bub('OS 上面又架了一個 OS，運作還要一模一樣？', 0, 3.6);
  sayc('電腦上已經有 OS', '上面卻又架一個 OS');
  await step(tok);                                   // 2:18 that is the virtual machine concept
  hot('virtual machine 的概念', 0, 4.4);
  sayc('這就是 virtual machine 的概念', 'Nachos 某種程度就是一個 VM');
  await step(tok);                                   // 2:38 you write a user program on it
  remove(vmBub);
  const up = pal('user program', '', COL.user, 3.6, 1.6, 0.6);
  await slide(tok, up.g, 3.0, 2.3, 0, 600);
  sayc('跟真的 OS 一樣', '上面要跑你自己寫的 user program');
  await step(tok);                                   // 2:40 a tiny C++ program, under ten lines
  const cd = code(['#include "syscall.h"', 'int main() {', '  …（不超過十行）', '}'], -5.0, 3.0, 0.45, -0.6);
  sayc('是很基本的 C++ 程式', '不會超過十行');
  await step(tok);                                   // 3:25 include syscall.h → Nachos's system calls
  cd.hl(0); await fly(tok, 'pkt', 'system call', V3(2.6, 3.0, 0), V3(0.6, 2.2, 0), 700);
  sayc('一定要 include syscall.h', '才連得到 Nachos 的 system call');
  await step(tok);                                   // 3:41 trace the existing system call (interrupt flow)
  note('作業一：trace 現有的 system call（上一講的 interrupt 流程）', 0, 5.4);
  sayc('作業一：trace 最簡單的 system call', '看 interrupt 流程怎麼實作');
  await step(tok);                                   // 3:56 add one hardware, one software system call
  good('Part 1：加一個 hardware 的', -2.6, 6.0); good('Part 2：加一個 software 的', 2.6, 6.0);
  sayc('再加兩個：一個 hardware', '一個 software（流程很像但不一樣）');
  void hw; void lx;
}]);

// 4:30 Nachos 模擬 MIPS：instruction set translation
FRAG.push(['osB-nachos-mips', 'Nachos 模擬 MIPS：instruction set translation', async (tok) => {
  fresh([0, 4.8, 14], [0, 2.6, 0]);
  const hw = layer('x86 CPU（真的硬體）', '#8a94a6', 0.31);
  const lx = layer('Linux：跑 x86 instruction', '#4b9ee2', 0.95);
  await step(tok);                                   // 4:30 not x86 instructions
  const archSm = sm('你修過 architecture：x86 和別的 instruction 長得完全不同', 0, 1.75, 0.8);
  sayc('Nachos 模擬的 instruction', '不是 x86 instruction');
  await step(tok);                                   // 4:46 it runs MIPS
  const user = bx('user program：MIPS 指令', COL.user, -3.0, 4.2, 0, 3.4, 2, 0.6, 1.1);
  sayc('它跑的是 MIPS', '另一種 instruction set');
  await step(tok);                                   // 4:52 MIPS is simple, easy to generate
  sm('MIPS 簡單 → 容易產生', -3.0, 4.95);
  sayc('選 MIPS 是因為它簡單', '比較容易產生');
  await step(tok);                                   // 5:19 the machine simulation code
  const sim = bx('Nachos：machine simulation', COL.os, -3.0, 2.6, 0, 3.4, 2, 0.6, 1.1);
  sayc('Nachos 裡面有', 'machine simulation code');
  await step(tok);                                   // 5:38 simulate a MIPS CPU, translate into x86
  await fly(tok, 'pkt', 'MIPS 指令', V3(-3.0, 3.8, 0.7), V3(-3.0, 2.9, 0.7), 500);
  await fly(tok, 'pkt', '→ x86 指令', V3(-3.0, 2.3, 0.7), V3(-3.0, 1.2, 0.7), 600);
  sayc('模擬一個 MIPS CPU 的動作', '轉成 x86 instruction 交給 Linux');
  await step(tok);                                   // 6:02 that is instruction set translation
  hot('VM 的關鍵：instruction set translation', 0, 5.8);
  sayc('virtual machine 怎麼做到？', '就是在做 instruction set translation');
  await step(tok);                                   // 6:54 the Nachos kernel code is the real OS
  remove(archSm);
  const kern = pal('Nachos kernel', 'OS', COL.pink, 3.0, 0.4, 0.75);
  await slide(tok, kern.g, 3.0, 1.7, 0, 600);
  arrow(V3(2.1, 2.2, 0), V3(-1.2, 2.5, 0), 0xe55a9b);
  sayc('Nachos kernel code', '才是真正的 OS，跟假的 machine 互動');
  await step(tok);                                   // 7:41 the real CPU and file system below do the work
  glow(hw, GOLD); glow(lx, GOLD);
  bub('真正做事的是下面這台實體機器', 0, -0.3, 1.2);
  sayc('看起來像 MIPS 機器在跑', '其實是下面真的 CPU、file system 在做');
  await step(tok);                                   // 8:22 behaves exactly like a real OS on hardware
  good('OS ⇄ machine 的互動 ＝ 真的 OS ⇄ 真的硬體', 0, 6.4);
  sayc('模擬的 OS 和 machine', '跟真的 Linux 加硬體行為完全一樣');
  await step(tok);                                   // 9:02 compile with Nachos's command → MIPS binary
  const bin = bx('MIPS binary', COL.user, 5.6, 4.2, 0, 2.0, 2, 0.5, 0.8);
  sayc('一定要用 Nachos 的 compile 指令', '編出 MIPS 的 binary code');
  await step(tok);                                   // 9:15 the two binaries can't read each other
  bad('MIPS binary 直接在 Linux 跑 → fail', 3.6, 5.1);
  bad('gcc 的 x86 binary 給 Nachos → fail', 3.6, 3.5);
  sayc('兩邊的 binary 互相看不懂', '跑錯邊就 fail');
  await step(tok);                                   // 10:06 unimplemented parts go to Linux
  await fly(tok, 'pkt', '沒實作的 → 丟給 Linux', V3(3.0, 1.9, 0.8), V3(3.0, 1.0, 0.8), 700, true);
  sayc('教學用、不完整', '沒實作的部分全丟給下面的 Linux');
  void user; void sim; void bin;
}]);

// 16:35 file system：real vs stub
FRAG.push(['osB-nachos-stub', 'Nachos 的 file system：real 與 stub', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 2.2, 0]);
  const lx = layer('Linux server 的 file system', '#4b9ee2', 0.4, 9.0);
  const prog = pal('Nachos 程式', '', COL.user, -4.6, 2.6, 0.6);
  await step(tok);                                   // 16:35 two ways to support a file system
  hd('Nachos 的 file system：兩種', 0, 5.6);
  sayc('Nachos 的 file system', '有兩種支援方式');
  await step(tok);                                   // 16:39 the real file system
  const real = bx('real file system', COL.os, -2.0, 2.4, 0, 3.0, 2, 0.6, 1.0);
  sayc('第一種：real file system', '真的在 Nachos 裡');
  await step(tok);                                   // 16:45 an OS must have one before you can access files
  sm('有 file system 才放得了你的 program', -2.0, 3.1);
  sayc('OS 一定要先有 file system', '才能 access 檔案');
  await step(tok);                                   // 17:05 complex — that is what you will implement
  note('作業四才去實作', -2.0, 1.6, 0.8);
  sayc('它比較複雜', '是你們之後要實作的');
  await step(tok);                                   // 17:13 version 2 is fake
  const stub = bx('stub（假的）', '#d8cfc0', 2.6, 2.4, 0, 3.0, 2, 0.6, 1.0);
  sayc('第二個 version 其實是假的', '不完整的 VM 可以偷吃步');
  await step(tok);                                   // 17:37 open a file → redirect to Linux below
  await fly(tok, 'pkt', 'open("a.txt")', V3(-4.6, 3.6, 0.6), V3(2.6, 2.9, 0.6), 700);
  await fly(tok, 'pkt', 'redirect', V3(2.6, 2.0, 0.6), V3(2.6, 0.8, 0.6), 500);
  sayc('Nachos 程式要 open 檔案', 'stub 直接 redirect 給下面 Linux');
  await step(tok);                                   // 17:51 Nachos sees exactly the server's files
  for (let k = 0; k < 3; k++) prop('file', 1.8 + k * 0.7, 0.75, 1.0, 0.45);
  good('Nachos 看到的 ＝ login server 看到的', 2.6, 3.6);
  sayc('作業一到三在 Nachos 看到的檔案', '跟 server 上一模一樣');
  await step(tok);                                   // 18:05 a real OS can't rely on another OS
  bad('真的 OS／VM 不能依靠另一個 OS', -2.0, 4.6);
  sayc('真的 OS 要完全獨立', '不能依靠另一個 OS');
  await step(tok);                                   // 18:26 it is only a stub: forwards your calls
  hot('stub ＝ 只是幫你轉送指令', 2.6, 4.6);
  sayc('所以它只是一個 stub', '把指令轉給下面的 file system');
  await step(tok);                                   // 19:02 the Part 2 system calls: open and close
  sm('Part 2：open、close', -4.6, 1.6, 2.6);
  sayc('作業一 Part 2 要加的 system call', '就是 open 跟 close');
  await step(tok);                                   // 20:01 just connect the call path
  arrow(V3(-3.8, 2.2, 1.2), V3(1.2, 2.2, 1.2), 0x2fc092);
  sayc('不用實作 file system', '只要把 call path 接起來');
  void lx; void prog; void real; void stub;
}]);

// ════════ HA96JKO9znE（第 5B 講：OS services、CLI / shell / GUI、message passing vs shared memory） ════════
// 0:03 第二章地圖
FRAG.push(['osB-ch2-map', '第二章：services、API vs system call、OS structure', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 2.0, 0]);
  await step(tok);                                   // 0:03 the OS is the only API, the only manager
  const os = pal('OS', '唯一的 manager', COL.os, 0, 0, 1.0);
  [-5.2, -3.6, 3.6, 5.2].forEach((x, k) => pal('', '', JOBC[k], x, 1.6, 0.45));
  sayc('OS 是唯一的 API', '唯一的 manager，大家都要透過它');
  await step(tok);                                   // 0:06 what it provides are services
  bub('你要做什麼？我幫你做 → services', 0, 2.6);
  sayc('它提供的 system call 等等', '其實就是一些 services');
  await step(tok);                                   // 1:08 the key: API vs system call
  hd('API', -2.0, 4.0); hd('≠', 0, 4.0); hd('system call', 2.0, 4.0);
  sayc('本章重點：分清楚', '什麼是 API、什麼是 system call');
  await step(tok);                                   // 1:14 then OS structure
  sm('最後：OS 的 structure（像寫程式也有不同架構）', 0, 4.7);
  sayc('最後介紹 OS 的 structure', '作業系統怎麼搭建');
  await step(tok);                                   // 1:36 virtual machine is one of them
  note('virtual machine 是其中一種', 0, 5.3);
  sayc('剛剛的 virtual machine', '就是其中一種 structure');
  void os;
}]);

// 1:59 OS services
FRAG.push(['osB-services', 'OS services 一覽', async (tok) => {
  fresh([0, 4.8, 13.5], [0, 2.2, 0]);
  const os = pal('OS', '', COL.os, 0, 0, 1.0);
  const card = (t, x, y, c) => bx(t, c || '#e9dcc4', x, y, 0, 2.6, 2, 0.5, 0.8);
  await step(tok);                                   // 1:59 start with services
  hd('OS services', 0, 6.4);
  sayc('從 services 開始', '不用背，看看大概有哪些');
  await step(tok);                                   // 2:24 to protect the system you must go through the OS
  prop('lock', 0, 0, 1.3, 0.7);
  sayc('為了 protect 系統', '很多事一定要透過 OS 的 service（system call）');
  await step(tok);                                   // 2:45 user interface
  card('user interface', -4.6, 5.4, COL.user);
  sayc('使用者的 interface', '怎麼跟電腦溝通');
  await step(tok);                                   // 2:49 program execution, I/O, file system
  card('program execution', -4.6, 4.7); card('I/O', -4.6, 4.0); card('file system', -4.6, 3.3);
  sayc('程式怎麼執行、I/O', '檔案管理');
  await step(tok);                                   // 3:08 communication between computers
  card('communication', -4.6, 2.6, COL.teal);
  const net = pkt('跨電腦：TCP、HTTP…', -1.6, 2.6);
  sayc('communication：不只是', '不同電腦的 process 溝通');
  await step(tok);                                   // 3:19 and between processes on one machine
  const ipcSm = sm('也包括同一台電腦 process ⇄ process、thread', -1.6, 2.0);
  sayc('也包括同一台電腦', 'process 和 process 之間');
  await step(tok);                                   // 4:03 error detection
  remove(ipcSm);
  card('error detection', -4.6, 1.9);
  sayc('error detection', '沒定義 error 就沒辦法運作');
  await step(tok);                                   // 4:23 resource allocation
  remove(net);
  card('resource allocation', 4.6, 5.4, COL.gold);
  sayc('後面三項：resource allocation', 'OS 一直在做的事');
  await step(tok);                                   // 4:28 e.g. the CPU scheduling algorithm
  sm('例：CPU scheduling algorithm', 4.6, 4.85);
  sayc('像 CPU scheduling algorithm', '就是一種 allocation algorithm');
  await step(tok);                                   // 4:35 accounting
  card('accounting', 4.6, 4.2, COL.gold);
  sayc('accounting', '知道每個人用了多少資源');
  await step(tok);                                   // 4:46 a program opening 1000 files drags everyone
  const p = pal('', '開 1000 個檔', COL.pink, 2.4, 2.6, 0.5); p.mood('wow');
  bad('拖垮整台電腦', 2.4, 1.5, 2.6);
  sayc('一支程式開了 1000 個檔案', '整台電腦就被拖累');
  await step(tok);                                   // 5:16 limits, e.g. at most 4 GB per process
  note('limit：一個 process 最多 4 GB memory、開檔數上限', 4.6, 3.4);
  sayc('所以會有 limit', '例如一個 process 最多 4 GB');
  await step(tok);                                   // 5:39 the administrator can change the limits
  pal('admin', '改 limit', COL.cpu, 5.6, 1.6, 0.5);
  sayc('administrator 有最高權限', '可以修改這些 limit');
  await step(tok);                                   // 5:56 protection and security
  card('protection & security', 4.6, 2.6, COL.bad);
  sayc('protection 跟 security', '防病毒、防 malicious 的 user');
  await step(tok);                                   // 6:05 at least accounts and passwords
  sm('至少要有帳號、password 才能 login', 4.6, 2.05);
  sayc('最起碼要有帳號', '要 password 才能 login');
  await step(tok);                                   // 6:33 later chapters cover execution, I/O, file system
  good('後面各有一章', -2.0, 4.0);
  sayc('後三項讓系統本身運作', '程式執行、I/O、file system 後面各一章');
  void os;
}]);

// 7:09 CLI 與 GUI
FRAG.push(['osB-cli-gui', 'User interface：CLI 與 GUI', async (tok) => {
  fresh([0, 4.6, 13], [0, 2.0, 0]);
  await step(tok);                                   // 7:09 interfaces: only two kinds
  hd('user interface 只有兩種', 0, 5.6);
  sayc('interface 只分兩種', '就這麼單純');
  await step(tok);                                   // 7:19 CLI: command line interface
  const mon1 = prop('monitor', -3.4, 0, 0, 1.0); pkt('$ ls', -3.4, 1.1, 0.2);
  hot('CLI：command line', -3.4, 2.6);
  sayc('第一種：CLI', 'command line interface，下指令');
  await step(tok);                                   // 7:35 GUI: graphic user interface
  const mon2 = prop('monitor', 3.4, 0, 0, 1.0); icon('🗂️', '', 3.0, 1.05, 0.2, 'sm'); icon('🖱️', '', 3.9, 1.0, 0.2, 'sm');
  hot('GUI：graphic user interface', 3.4, 2.6);
  sayc('第二種：GUI', '圖形介面（Microsoft 靠它崛起）');
  await step(tok);                                   // 8:00 from this course on, use the CLI
  bub('這堂課開始：login 到 Linux server 用 CLI', -3.4, 3.4);
  sayc('從這堂課開始', '希望大家用 CLI');
  await step(tok);                                   // 8:15 GUI is built on the CLI
  await slide(tok, mon2, 3.4, 1.3, 0, 600);
  bx('CLI', COL.user, 3.4, 0.6, 0, 2.2, 0, 0.5, 1.0);
  sayc('GUI 是架在 CLI 上面', 'GUI 做得到的 CLI 全做得到');
  await step(tok);                                   // 8:34 software stacks: programs talk via commands
  for (let k = 0; k < 3; k++) bx('layer ' + (k + 1), '#e9dcc4', 0, 0.3 + k * 0.55, 1.8, 2.2, 1.5, 0.45, 0.8);
  sayc('電腦世界一層一層堆疊', 'software stack 之間靠 command line 溝通');
  await step(tok);                                   // 8:50 automation: chain tools together via CLI
  pkt('tool A | tool B | tool C', 0, 2.3, 1.8);
  sayc('要把東西串起來、做自動化', '都是透過 CLI');
  await step(tok);                                   // 9:25 the CLI fetches a command and executes it
  await fly(tok, 'pkt', 'fetch command → 執行', V3(-3.4, 1.6, 0.4), V3(-3.4, 0.6, 0.4), 700, true);
  sayc('CLI：fetch command', '然後開始執行');
  void mon1;
}]);

// 9:55 shell
FRAG.push(['osB-shell', 'Shell：CLI 的那支程式，可以個人化', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 2.0, 0]);
  const os = bx('OS（system call）', COL.os, 0, 0.35, 0, 7.0, 0, 0.7, 1.4);
  const u = pal('使用者', '', COL.user, -4.8, 2.6, 0.6);
  await step(tok);                                   // 9:55 commands don't go straight to the OS: the shell
  const sh = bx('shell', COL.gold, 0, 1.1, 0, 5.0, 2, 0.6, 1.2);
  sayc('你下的指令不是直接交給 OS', '中間那支程式叫 shell');
  await step(tok);                                   // 10:06 like a compiler turns code into binary
  sm('像 compiler 幫你把程式翻成 binary', 4.4, 2.8);
  sayc('就像 compiler 幫你 translate', 'shell 接下指令再告訴 OS');
  await step(tok);                                   // 10:36 csh or bash, many versions
  pkt('bash', -1.2, 1.9, 0.6); pkt('csh', 1.2, 1.9, 0.6);
  sayc('常見的有 csh、bash', '可以設定要用哪一個');
  await step(tok);                                   // 11:09 why this layer?
  bub('有 OS 就能跑了，幹嘛還要 shell？', 0, 3.6);
  sayc('重點來了：', '為什麼要這一層？');
  await step(tok);                                   // 11:47 'ls' lists files in Linux
  const a = pal('Linux 人', 'ls', COL.cpu, -2.4, 2.6, 0.55);
  sayc('看資料夾裡有哪些檔案', 'Linux 標準指令是 ls');
  await step(tok);                                   // 11:54 someone from Microsoft is used to 'dir'
  const b = pal('Windows 人', 'dir', COL.pink, 2.4, 2.6, 0.55);
  sayc('從 Microsoft 來的人', '習慣打 dir');
  await step(tok);                                   // 12:18 add an alias: same thing
  await fly(tok, 'pkt', 'alias dir = ls', V3(2.4, 2.4, 2.6), V3(-1.0, 2.75, 0.8), 800, true);
  b.mood('happy');
  sayc('在 shell 加一個 alias（別名）', '就能做完全一樣的事');
  await step(tok);                                   // 12:28 system calls are fixed for everyone
  note('system call：OS 定好、大家都要 follow、不能改', 0, -1.2, 1.0);
  sayc('system call 由 OS 定義', '所有人都要 follow，不能隨意改');
  await step(tok);                                   // 13:17 colours: folders blue, files green
  pkt('folder', 3.4, 1.9, 0.6); pkt('file', 5.0, 1.9, 0.6);
  sayc('每人調自己的 shell', '例如 folder 藍色、檔案綠色');
  await step(tok);                                   // 14:06 the shell is not officially part of the OS
  hot('shell 不屬於 OS：在 OS 外面一層', 0, 4.6);
  sayc('shell 並不屬於 OS', '它是 OS 外面的 interface');
  void os; void u; void sh; void a;
}]);

// 14:34 GUI：方便但慢
FRAG.push(['osB-gui-tradeoff', 'GUI：convenience 與 performance 的 trade-off', async (tok) => {
  fresh([0, 4.2, 12], [0, 1.8, 0]);
  await step(tok);                                   // 14:34 GUI: mouse, icons — the same needs
  prop('monitor', -2.6, 0, 0, 1.0); icon('🖱️', '', -1.2, 0.8, 0.6, 'sm'); icon('📁', '', -2.9, 1.05, 0.2, 'sm');
  sayc('GUI：滑鼠、icon', '目的和需求跟 CLI 相同');
  await step(tok);                                   // 15:26 pure data / computation, nothing human → CLI
  prop('monitor', 2.6, 0, 0, 1.0); pkt('$ ./run', 2.6, 1.1, 0.2);
  sayc('單純處理資料、計算', '跟人無關的時候都用 CLI');
  await step(tok);                                   // 15:47 convenience vs performance trade-off
  hot('convenience ⇄ performance', 0, 3.6);
  good('GUI：方便', -2.6, 2.8); bad('但比較慢、受限', -2.6, 2.3);
  sayc('convenience 跟 performance', '的 trade-off：GUI 方便但較慢');
}]);

// 15:57 communication：message passing
FRAG.push(['osB-msg-passing', 'Communication：message passing', async (tok) => {
  fresh([0, 4.8, 13.5], [0, 1.8, 0]);
  await step(tok);                                   // 15:57 communication — basic idea only
  hd('communication', 0, 5.6);
  sayc('再來是 communication', '只講基本概念');
  await step(tok);                                   // 16:05 within one computer or across computers
  sayc('不只是同一台電腦的 process 之間', '甚至可以跨電腦');
  await step(tok);                                   // 16:21 by memory use: message passing / shared memory
  hd('message passing', -3.4, 4.8); hd('shared memory', 3.4, 4.8);
  sayc('依 memory 的用法分兩大類', 'message passing、shared memory');
  await step(tok);                                   // 16:34 the CPU can only access memory directly
  sm('CPU 能 directly access 的只有 memory → 怎麼靠 memory 交換資料？', 0, 4.2);
  sayc('因為 CPU 能直接 access 的', '只有 memory');
  await step(tok);                                   // 16:56 message passing is like e-mail
  const A = pal('Process A', '', COL.user, -5.4, 0, 0.7), B = pal('Process B', '', COL.pink, -1.4, 0, 0.7);
  const mail = icon('✉️', '像寫 email', -3.4, 2.6, 0, 'sm');
  sayc('message passing', '就像寫 email');
  await step(tok);                                   // 17:14 A copies its message into the kernel
  const k = bx('kernel（OS 的 memory）', COL.os, -3.4, 0.3, 1.6, 4.2, 0, 0.6, 1.0);
  await fly(tok, 'pkt', 'msg', V3(-5.4, 1.2, 0), V3(-3.4, 0.9, 1.6), 700, true);
  sayc('A 把 message', 'copy 到 kernel');
  await step(tok);                                   // 17:19 B copies it over and reads it
  await fly(tok, 'pkt', 'msg', V3(-3.4, 0.9, 1.6), V3(-1.4, 1.2, 0), 700);
  B.mood('happy');
  sayc('B 再從 kernel copy 過來', '讀裡面的資料');
  await step(tok);                                   // 17:26 in short: a memory copy
  note('＝ memory copy', -3.4, 3.4);
  sayc('簡單講', '就是 memory copy');
  await step(tok);                                   // 17:42 not copied directly — protection
  gone(mail);
  bad('A → B 直接 copy ✗', -3.4, 2.2, 0.8);
  sayc('不是直接從 A copy 到 B', '而是經過 OS 的 memory：因為 protection');
  await step(tok);                                   // 17:49 each process has its own base and limit
  sm('A：base / limit', -5.4, -1.0, 0.8); sm('B：base / limit', -1.4, -1.0, 0.8);
  sayc('每個 process 有自己的', 'base 跟 limit，越界是違法的');
  await step(tok);                                   // 18:10 only the OS may read and write your data
  glow(k, GOLD);
  sayc('必須 call system call', '只有 OS 有權讀寫你的資料');
  await step(tok);                                   // 18:43 a direct copy halfway fails → hard to recover
  sm('直接 copy 到一半 fail → 很難重建兩邊', -3.4, -1.7, 0.8);
  sayc('直接 copy 可能比較快', '但 copy 到一半斷掉，很難收拾');
  await step(tok);                                   // 18:51 TCP/IP networking: many layers of copy → slow
  const n = [0, 1, 2].map((i) => bx('layer', '#e9dcc4', 3.0, 0.3 + i * 0.5, -2.0, 1.6, 0, 0.42, 0.8));
  sayc('TCP/IP networking 很慢', '一層一層 copy 才送出封包');
  await step(tok);                                   // 19:15 across computers: copy to kernel, send a packet
  await fly(tok, 'pkt', '網路封包（socket）', V3(-1.2, 2.0, -2.0), V3(5.6, 2.0, -2.0), 900);
  pal('另一台電腦', '', COL.teal, 5.6, -2.0, 0.55);
  sayc('跨電腦也一樣：copy 到 kernel', '送網路封包，對方 kernel 再 copy 過去');
  void A; void n;
}]);

// 19:33 communication：shared memory
FRAG.push(['osB-shared-mem', 'Communication：shared memory', async (tok) => {
  fresh([0, 4.6, 13], [0, 1.8, 0]);
  const A = pal('Process A', '', COL.user, -3.6, 0, 0.7), B = pal('Process B', '', COL.pink, 3.6, 0, 0.7);
  await step(tok);                                   // 19:33 why not just share?
  sayc('另一個做法：', '為什麼我們不就 share 呢？');
  await step(tok);                                   // 19:43 both can read and write the same block
  const sh = bx('shared memory', COL.gold, 0, 0.35, 0, 2.6, 2, 0.7, 1.2);
  await fly(tok, 'pkt', 'write', V3(-3.0, 1.2, 0), V3(-0.6, 0.9, 0), 500);
  await fly(tok, 'pkt', 'read', V3(0.6, 0.9, 0), V3(3.0, 1.2, 0), 500);
  sayc('兩邊都看得到、都能 read / write', '我寫了你直接就看到');
  await step(tok);                                   // 20:22 first create it through a system call
  const os = pal('OS', '', COL.os, 0, -2.2, 0.6);
  const mkBub = bub('system call：create 共用區', 0, 1.5, -2.2);
  sayc('平常每個 process 範圍分開', '要先透過 system call 建立這塊空間');
  await step(tok);                                   // 20:56 threads share memory by default
  pal('thread', '', COL.cpu, -1.6, 2.4, 0.45); pal('thread', '', COL.cpu, 1.6, 2.4, 0.45);
  remove(mkBub);
  good('thread 之間 by default 就共用', 0, -0.4, 2.4);
  sayc('by default 就有的：', 'multi-thread programming，thread 間直接溝通');
  await step(tok);                                   // 21:50 message passing: memory copies → slower
  bad('message passing：要 copy → 較慢', -3.6, 2.6);
  sayc('兩種都要透過 OS', 'message passing 有 memory copy，比較慢');
  await step(tok);                                   // 21:59 shared memory: synchronization, deadlock
  bad('shared memory：synchronization、deadlock', 3.6, 3.3);
  A.mood('wow'); B.mood('wow');
  sayc('shared memory 的壞處', 'synchronization、deadlock（第 7、8 章）');
  void sh; void os;
}]);

// ════════ dFXJM1ZTxdA（第 3B 講 Computer-System Organization：von Neumann、controller、busy waiting） ════════
// 0:04 電腦系統怎麼透過 OS 運作
FRAG.push(['osB-cso', 'Computer-system organization：control 與 coordinate', async (tok) => {
  fresh([0, 5.0, 13.5], [0, 1.8, 0]);
  await step(tok);                                   // 0:04 how the system runs through the OS
  hd('電腦系統怎麼透過 OS 運作？', 0, 5.6);
  sayc('知道 OS 的角色和目的之後', '來看電腦怎麼透過它運作');
  await step(tok);                                   // 0:36 von Neumann: CPU, memory, I/O devices
  const cpu = pal('CPU', '', COL.cpu, -4.6, 0, 0.8);
  const mem = bx('Memory', COL.mem, 0, 0.45, 0, 2.4, 2, 0.9, 1.2);
  const d1 = prop('disk', 3.6, 0, 0, 0.8, 'Disk'), d2 = prop('printer', 5.6, 0, 0, 0.8);
  sayc('von Neumann architecture', 'CPU、memory、I/O device 串起來');
  await step(tok);                                   // 0:57 open the case: buses connect everything
  const bus = bx('bus', '#cbbd9e', 0, 0.1, 1.6, 11.6, 0, 0.16, 0.3);
  sayc('打開主機會看到 bus', '把各種 device 接起來');
  await step(tok);                                   // 1:08 abstracted: connected through buses
  sm('線很複雜，抽象起來就是 bus 連在一起', 0, -0.5, 1.8);
  sayc('看起來很複雜', '抽象起來就是透過 bus 連在一起');
  await step(tok);                                   // 1:19 the OS's job: control
  const os = pal('OS', '', COL.os, -1.8, 2.6, 0.7);
  hot('control', -1.8, 2.2, 2.6);
  sayc('OS 跑在電腦上的目的', '就是去 control');
  await step(tok);                                   // 1:21 and share the memory
  glow(mem, GOLD); sm('大家共用這塊 memory', 0, 1.2);
  sayc('而且要 share 那一塊 memory', 'device 都接在上面');
  await step(tok);                                   // 1:34 a program's instructions run on the CPU
  await fly(tok, 'pkt', 'instruction', V3(0, 1.4, 0.6), V3(-2.6, 1.6, 0.6), 700);
  sayc('執行程式時', 'instruction 在 CPU 上 run');
  await step(tok);                                   // 1:40 its data must be in memory
  pkt('data', 0, 1.7, 0.6);
  sayc('instruction 要用的 data', '一定要在 memory');
  await step(tok);                                   // 1:43 results may be written to an I/O device
  await fly(tok, 'pkt', 'result', V3(0.8, 1.2, 0.6), V3(3.6, 1.9, 0.6), 700);
  sayc('最後的結果', '可能寫到某個 I/O device');
  await step(tok);                                   // 1:51 coordinate: many programs, each with its own needs
  const ps = ['A', 'B', 'C'].map((n, k) => pal(n, '', JOBC[k + 1], 1.4 + k * 1.5, 2.6, 0.5));
  hot('coordinate', 2.9, 2.8, 3.6);
  sayc('coordinate 的問題：', '很多程式，各有自己的要求');
  await step(tok);                                   // 2:00 run concurrently without errors
  sayc('要讓它們 concurrent 地', '同時在這台電腦上執行、又不能出錯');
  await step(tok);                                   // 2:06 I must not modify your memory
  ps[0].mood('wow'); bad('A 改 B 的 memory ✗', 2.2, 4.0, 2.6);
  sayc('例如：我不能修改', '你的 memory content');
  await step(tok);                                   // 2:20 letting them share safely is the OS's job
  ps.forEach((p) => p.mood('happy'));
  good('同時 share 又不出錯 → OS 負責', 0, 4.6);
  sayc('怎麼讓它們同時 share', '就是 OS 要負責的事');
  void cpu; void d1; void d2; void bus; void os;
}]);

// 2:30 一個 I/O 的例子：controller、buffer、兩段 I/O
FRAG.push(['osB-cso-io', 'Device controller：buffer、status / data register', async (tok) => {
  fresh([0, 5.4, 13.5], [0, 1.6, 0]);
  await step(tok);                                   // 2:30 an example: what the OS does
  const cpu = pal('CPU', '', COL.cpu, -5.4, 0, 0.8);
  const mem = bx('Memory', COL.mem, -2.2, 0.4, 0, 2.2, 0, 0.8, 1.1);
  sayc('用一個例子看', 'OS 在裡面扮演什麼角色');
  await step(tok);                                   // 2:41 the CPU does I/O on a device, e.g. a disk
  const disk = prop('disk', 5.3, 0, 0, 1.05, 'Disk');
  sayc('CPU 要對一個 I/O device', '例如 disk，讀寫一筆資料');
  await step(tok);                                   // 3:01 the hardware device: think of a hard drive
  const hwSm = sm('hardware device：想成一顆硬碟', 5.3, 2.4);
  sayc('最右邊是 hardware device', '就想成一個 hard drive');
  await step(tok);                                   // 3:08 through a controller (hardware)
  const ctl = pal('Controller', '', COL.teal, 1.9, 0, 0.8);
  sayc('要把資料寫過去', '得透過一個 controller（硬體）');
  await step(tok);                                   // 3:14 it does the lowest-level control
  const lowSm = sm('最 low level 的控制', 1.9, 2.5);
  sayc('controller 負責', '最 low level 的控制');
  await step(tok);                                   // 3:20 e.g. moving the disk head
  const head = bx('磁頭', '#5d6b7a', 4.4, 1.0, 0.4, 0.8, 0, 0.12, 0.2);
  await anim(tok, 700, (u) => { head.rotation.y = u * 1.2; });
  sayc('例如控制磁頭的轉動');
  await step(tok);                                   // 3:26 data flow through a buffer
  const buf = slots(4, 1.9, 0.18, 1.25); sm('buffer', 1.9, 0.1, 1.85);
  sayc('資料流過 controller', '一定會有 buffer');
  await step(tok);                                   // 3:34 because I/O devices are slow
  bad('I/O device 很慢', 5.3, 3.0); good('CPU 很快', -5.4, 2.5);
  sayc('為什麼一定要 buffer？', '因為 I/O device 很慢，CPU 很快');
  await step(tok);                                   // 3:52 without one, the CPU would idle a long time
  cpu.mood('sad'); sm('沒 buffer：直接從 disk copy 到 memory 要很久 → CPU idle', -2.0, 3.6);
  sayc('沒有 buffer', 'CPU 一定會 idle 很久');
  await step(tok);                                   // 4:04 status register and data register
  gone(hwSm, lowSm);
  const st = bx('status', '#cfe3e6', 1.4, 2.0, 0.6, 1.0, 0, 0.3, 0.3), dr = bx('data', '#cfe3e6', 2.5, 2.0, 0.6, 1.0, 0, 0.3, 0.3);
  sayc('controller 上有', 'status register 跟 data register');
  await step(tok);                                   // 4:13 status: busy or idle
  const sv = hot('BUSY / IDLE？', 1.4, 2.65, 0.6);
  sayc('status 告訴你', '正在做 I/O（busy）還是 idle');
  await step(tok);                                   // 4:16 the data register is just another buffer
  glow(dr, GOLD);
  sayc('data register', '單純是另一個 buffer');
  await step(tok);                                   // 4:37 device → buffer first
  for (let k = 1; k <= 3; k++) { await fly(tok, 'pkt', 'data', V3(5.0, 1.0, 0.8), V3(2.4, 0.5, 1.25), 380); buf.fill(k); }
  sayc('資料先從 I/O device', '寫到 buffer');
  await step(tok);                                   // 4:44 that half is done by the controller alone
  ctl.mood('happy'); good('前半段：controller 自己做（裡面有小 CPU chip）', 3.6, 3.4);
  sayc('這一段 I/O', 'controller 自己做就好，跟 CPU 無關');
  await step(tok);                                   // 5:06 buffer → memory needs CPU instructions
  await fly(tok, 'pkt', '下指令', V3(-3.6, 2.0, 0.6), V3(0.4, 1.7, 0.6), 700);
  await fly(tok, 'pkt', 'data', V3(1.9, 0.5, 1.25), V3(-2.2, 1.35, 0.6), 600); buf.fill(2);
  sayc('後半段要進 memory', '一定要透過 CPU 下指令');
  await step(tok);                                   // 5:15 so I/O happens in two halves
  hd('① device → buffer', 3.6, 4.4); hd('② buffer → memory', -2.2, 4.4);
  sayc('所以 I/O 其實分成兩段');
  void mem; void disk; void st; void sv;
}]);

// 5:27 busy waiting
FRAG.push(['osB-cso-busy', 'Busy waiting：一直等 buffer 有位置', async (tok) => {
  fresh([0, 5.6, 14], [0, 1.9, 0]);
  const R = rig4(true);
  await step(tok);                                   // 5:27 a very simple, basic example
  sayc('CPU 怎麼控制？', '先看一個很簡單的基本例子');
  await step(tok);                                   // 5:36 write a string to an I/O device
  const str = ['H', 'E', 'L', 'L', 'O'].map((c, i) => pkt(c, -6.4 + i * 0.9, 2.4, 1.2));
  sm('（字串示意）', -1.1, 2.4, 1.2);
  sayc('要把一串字串', '寫到 I/O device 上');
  await step(tok);                                   // 5:44 cannot stuff it all: buffer space is limited
  sayc('不可能一次全塞進 buffer', 'buffer 空間有限');
  await step(tok);                                   // 5:46 the way is called busy waiting
  hot('busy waiting', -5.4, 3.2);
  sayc('一種方式叫', 'busy waiting');
  await step(tok);                                   // 5:51 buffer full → wait
  R.buf.fill(4, COL.bad); bad('buffer 滿 → 等', 1.9, 2.4);
  sayc('buffer 寫滿了', '就要等');
  await step(tok);                                   // 5:59 empty to disk, then the next batch: two rounds
  for (let k = 3; k >= 0; k--) { R.buf.fill(k); await wt(tok, 200); }
  sayc('等 buffer 真的寫到 disk、清空', '再寫下一批：要分好幾趟');
  await step(tok);                                   // 6:10 the code: look at each character until the end
  const cd = code([
    'while (*p) {                     // 字串還沒結束',
    '  while (peek(status) == BUSY) ; // 一直等',
    '  poke(data, *p);  p++;          // 寫進 buffer',
    '}',
  ], -0.4, 5.6, 0.5, -0.6);
  sm('（板書程式的示意）', 4.8, 6.0, -0.6);
  cd.hl(0);
  sayc('CPU 端的程式：一直看 character', '看到結尾就知道字串結束');
  await step(tok);                                   // 6:25 a while loop that peeks
  cd.hl(1);
  sayc('怕 buffer 還沒清空', '所以要寫一個 while loop 去 peek');
  await step(tok);                                   // 6:28 status register says busy → wait here
  const cnt = hot('peek ×0', -5.4, 3.9);
  for (let k = 1; k <= 5; k++) { await fly(tok, 'pkt', 'peek?', V3(-3.6, 2.0, 0.6), V3(-0.2, 1.7, 0.6), 260); txt(cnt, 'peek ×' + k); }
  sayc('status register 是 BUSY', '就只能在這邊等：busy waiting');
  await step(tok);                                   // 6:38 the value changes → it is free
  good('沒事了', 1.9, 3.0);
  sayc('值變了', '代表它沒事了');
  await step(tok);                                   // 6:43 p++, poke: write it into the buffer
  cd.hl(2); remove(str[0]);
  await fly(tok, 'pkt', 'H', V3(-6.4, 2.4, 1.2), V3(1.4, 0.6, 1.25), 600); R.buf.fill(1, COL.disk);
  sayc('p++，再用 poke', '把值寫出去到 buffer');
  await step(tok);                                   // 6:55 actual writing is not all the time
  sayc('做 I/O 時', '真正在寫的時間只有一點點');
  await step(tok);                                   // 7:08 I/O takes, say, 10 ms…
  note('I/O 花了 10 ms（示意）', 4.8, 2.6, 0.4);
  sayc('I/O 很慢，假設花了 10 ms', '這 10 ms CPU 在幹嘛？');
  await step(tok);                                   // 7:14 wasting CPU cycles, as good as idle
  R.cpu.mood('sad'); bad('浪費 CPU cycle ≈ idle', -5.4, 4.5);
  sayc('只在浪費 CPU cycle', '等於 idle 一樣');
  await step(tok);                                   // 7:38 CPU and I/O cannot overlap
  sayc('沒辦法實現', 'CPU 和 I/O overlap');
  await step(tok);                                   // 7:44 it holds both the CPU and the I/O
  hot('同時霸佔 CPU 和 I/O → 沒辦法 sharing', 0, 6.6);
  sayc('同時霸佔 CPU', '也霸佔 I/O，電腦沒辦法 sharing');
  await step(tok);                                   // 7:53 next: interrupts fix this
  good('下一段：interrupt 解決', 4.8, 4.8);
  sayc('休息回來講', '怎麼透過 interrupt 解決');
}]);

// ════════ ZsiNkiwki5Q（第 4C 講：hard drive、SSD、caching、coherence / consistency） ════════
// a hard drive: stacked platters that spin, an arm with heads that swings
function hdd(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); lab.world.add(g);
  const plat = new THREE.Group(); g.add(plat);
  for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.08, 40), new THREE.MeshStandardMaterial({ color: '#b9c2d0', metalness: 0.4, roughness: 0.35 })); p.position.y = 0.4 + i * 0.55; plat.add(p); }
  const spot = lab.box(COL.bad, [0.34, 0.1, 0.34]); spot.position.set(-1.55, 1.52, 0); plat.add(spot);
  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.7, 16), new THREE.MeshStandardMaterial({ color: '#5d6b7a' })); spindle.position.y = 0.95; g.add(spindle);
  const arm = new THREE.Group(); arm.position.set(2.7, 0, -1.6); g.add(arm);
  for (let i = 0; i < 3; i++) { const a = lab.box('#5d6b7a', [2.6, 0.06, 0.18]); a.position.set(-1.3, 0.48 + i * 0.55, 0); arm.add(a); const h = lab.box('#e2b13c', [0.16, 0.1, 0.16]); h.position.set(-2.55, 0.48 + i * 0.55, 0); arm.add(h); }
  arm.rotation.y = -0.35;
  return { g, plat, arm, spot };
}

// 0:03 hard drive：機械式、transfer time + positioning time
FRAG.push(['osB-hdd', 'Hard drive：機械式，位置不同時間不同', async (tok) => {
  fresh([0, 5.4, 11.5], [0, 1.2, 0]);
  await step(tok);                                   // 0:03 hard drives are mechanical, not electronic
  const H = hdd(-1.2, 0);
  hot('hard drive：機械式（不是電子式）', 0, 5.7);
  sayc('最普及的儲存還是 hard drive', '特點：機械式，不是電子式');
  await step(tok);                                   // 0:06 read/write heads on an arm, many platters
  const armSm = sm('讀寫手臂 + 很多磁頭', 3.6, 2.6, -1.6); sm('很多片磁碟', -4.4, 2.2);
  sayc('裡面有讀寫手臂、很多磁頭', '和好幾片磁碟');
  await step(tok);                                   // 0:53 platters spin and the heads move
  await anim(tok, 1500, (u) => { H.plat.rotation.y = u * Math.PI * 2; H.arm.rotation.y = -0.35 + Math.sin(u * Math.PI) * 0.3; });
  sayc('磁碟會轉動、磁頭會移動', '才能讀到任何位置的資料');
  await step(tok);                                   // 1:05 where the data sits decides the time
  const d = pkt('要讀的資料', -4.4, 1.2);
  sayc('所以資料的位置', '跟讀取時間有絕對的關係');
  await step(tok);                                   // 1:14 head right next to the data → fast
  await anim(tok, 500, (u) => { H.plat.rotation.y = Math.PI * 2 + u * 0.4; });
  good('磁頭剛好在附近 → 很快', -1.2, 3.4);
  sayc('磁頭剛好落在資料附近', '就很快');
  await step(tok);                                   // 1:19 on the opposite side → must rotate
  await anim(tok, 1400, (u) => { H.plat.rotation.y = Math.PI * 2 + 0.4 + u * Math.PI; });
  bad('在對面 → 要等磁盤轉過來', -1.2, 2.8);
  sayc('很不幸剛好在對面', '磁盤要轉過去才能讀');
  await step(tok);                                   // 1:38 transfer time + positioning time
  remove(d); remove(armSm);
  hd('讀取時間 ＝', 4.2, 5.0);
  const tb = await grow(tok, 3.0, 4.6, 3.9, COL.cpu, 'transfer', 600);
  const pb = await grow(tok, 4.6, 6.4, 3.9, COL.bad, 'positioning', 600);
  sayc('讀取時間切成', 'transfer time ＋ positioning time');
  await step(tok);                                   // 1:42 transfer time only depends on the amount of data
  sm('資料越多 → transfer 越長', 4.4, 3.1);
  sayc('transfer time', '只跟資料量有關');
  await step(tok);                                   // 1:56 seek time: finding the position — not uniform
  sm('seek：找位置，時間不固定', 5.4, 2.6);
  sayc('positioning 要 seek（找位置）', '所以時間不 uniform');
  await step(tok);                                   // 2:04 so not random access
  bad('不是 random access', 4.6, 1.9);
  sayc('所以 hard drive 不叫 random access', '也沒辦法有效率地 random access');
  await step(tok);                                   // 2:14 7200 / 3600 rpm: faster spin, shorter seek, pricier
  await anim(tok, 900, (u) => { H.plat.rotation.y = u * Math.PI * 4; });
  note('7200 轉 / 3600 轉：轉越快越貴', -1.2, 4.9);
  sayc('買硬碟看轉速（7200、3600 轉）', '越快 seek 越短，也越貴');
  void tb; void pb;
}]);

// 2:47 SSD vs hard drive
FRAG.push(['osB-ssd', 'SSD vs hard drive：隨機讀取才差很多', async (tok) => {
  fresh([0, 4.8, 13], [0, 2.0, 0]);
  const hd1 = prop('disk', -4.4, 0, 0, 1.2, 'Hard drive');
  await step(tok);                                   // 2:47 SSD: electronic, like memory but non-volatile
  const ssd = bx('SSD', '#7d9a63', 4.4, 0.25, 0, 2.2, 2, 0.4, 1.4);
  sm('電子式：像 memory，但資料不會遺失', 4.4, 1.3);
  sayc('SSD 為什麼快？', '它是電子式的，像 memory 但不會遺失');
  await step(tok);                                   // 3:03 no seek time → predictable performance
  good('沒有 seek time → 效能好預測', 4.4, 2.0);
  sayc('讀取沒有 seek time', '效能比較容易預測');
  await step(tok);                                   // 3:17 sequential data: transfer time dominates
  hd('連續（sequential）讀大量資料', 0, 5.2);
  await grow(tok, -6.2, -1.4, 4.4, COL.cpu, 'HDD：transfer', 600); await grow(tok, -1.4, -0.9, 4.4, COL.bad, '', 300);
  await grow(tok, 0.6, 5.4, 3.7, COL.cpu, 'SSD：transfer', 600);
  sayc('資料連續、size 夠大時', 'transfer time 會 dominate positioning');
  await step(tok);                                   // 3:39 benchmarks: HDD doesn't lose much
  good('差不多！', 6.0, 4.0);
  sayc('實際 benchmark：sequential 讀取', 'hard drive 並不會輸 SSD 太多');
  await step(tok);                                   // 3:44 jumping around → SSD wins
  for (let k = 0; k < 4; k++) pkt('跳', -6.2 + k * 1.3, 0.7, 1.8);
  bad('HDD：一直 seek，浪費', -4.4, 3.0); good('SSD 贏在這裡', 4.4, 2.7);
  sayc('資料跳來跳去讀時', 'SSD 才有好處（像 booting、控制程式）');
  await step(tok);                                   // 4:03 small SSD for the OS, big HDD for files
  pkt('OS', 6.2, 0.6, 0.9); pkt('一大堆檔案', -4.4, 2.45, 1.2);
  sayc('小顆 SSD 裝 OS', '大量檔案放 hard drive：看特性設計');
  await step(tok);                                   // 4:35 hierarchy: size and access time matter most
  hot('hierarchy：size 和 access time 最重要', 0, 6.0);
  sayc('這就是 hierarchy', 'size、access time 是最主要的因素');
  void hd1; void ssd;
}]);

// 4:55 caching
FRAG.push(['osB-caching', 'Caching：copy 到快的那一層', async (tok) => {
  fresh([0, 4.6, 13], [0, 2.6, 0]);
  const names = [['register', '#c96b6b'], ['cache', '#e08a4c'], ['memory', COL.cpu], ['disk（最慢、最大）', '#7d9a63']];
  const L = names.map(([n, c], i) => bx(n, c, -1.0, 5.0 - i * 1.25, 0, 1.6 + i * 1.0, 0, 0.55, 1.0));
  const cpu = pal('CPU', '', COL.cpu, -5.6, 3.4, 0.7);
  await step(tok);                                   // 4:55 the storage uses the concept of caching
  hot('caching', 3.6, 5.6);
  sayc('儲存系統到處都用', 'caching 的概念');
  await step(tok);                                   // 5:07 data eventually lives on the slowest, biggest device
  const orig = cube('X', '#7d9a63', [0.5, 0.45, 0.5], 1.4, 1.25 + 0.5, 0.4);
  sm('本尊', 1.4, 2.3, 0.4);
  sayc('資料最後都存在', '最慢、空間最大的 device 上');
  await step(tok);                                   // 5:20 read once → keep a copy on a faster device
  const c1 = cube('X', '#e08a4c', [0.5, 0.45, 0.5], 1.4, 1.75, 0.4); await slide(tok, c1, 1.0, 3.25 + 0.5, 0.4, 700);
  sayc('既然讀過了', '就 copy 一份暫存在比較快的 device');
  await step(tok);                                   // 5:27 the more often used, the higher it goes
  const c2 = cube('X', '#c96b6b', [0.5, 0.45, 0.5], 1.0, 3.75, 0.4); await slide(tok, c2, 0.4, 5.5, 0.4, 600);
  sayc('用得越頻繁', '就 cache 到越上層');
  await step(tok);                                   // 5:57 caching is a copy, not a move
  note('cache ＝ copy，不是搬移（本尊還在）', 3.6, 1.0);
  sayc('注意：caching 是 copy', '不是搬移，後面還有一份');
  await step(tok);                                   // 6:11 a temporary copy you may drop any time
  await anim(tok, 500, (u) => { c2.scale.setScalar(1 - u * 0.999); });
  sm('砍掉也不會遺失資料', 3.6, 0.4);
  sayc('copy 是暫時的', '隨時砍掉都不應該造成遺失');
  await step(tok);                                   // 6:41 the CPU asks the nearest layer first
  c2.scale.setScalar(1);
  await fly(tok, 'pkt', '找 Y', V3(-4.8, 4.6, 0.6), V3(-1.0, 5.4, 0.6), 500);
  sayc('access data 時從 CPU 出發', '先到最近的那一層找，有就直接讀');
  await step(tok);                                   // 6:51 miss → one layer down, and down
  for (let i = 1; i < 4; i++) { await fly(tok, 'bad', 'miss', V3(-1.0, 5.4 - (i - 1) * 1.25, 0.6), V3(-1.0, 5.4 - i * 1.25, 0.6), 300); }
  sayc('沒有就往下一層', '一層一層往後看，資料不會掉');
  await step(tok);                                   // 6:57 on the way back it gets cached
  const y = cube('Y', '#7d9a63', [0.5, 0.45, 0.5], -2.2, 1.75, 0.4);
  await slide(tok, y, -2.2, 5.5, 0.4, 900);
  sayc('讀回來時', '順便被 cache 住');
  await step(tok);                                   // 7:04 a miss can be slower than no cache at all
  bad('miss：一層層檢查 + copy → 可能比沒 cache 還慢', -1.0, 6.4);
  sayc('cache miss 時', '可能比沒有 cache 還慢');
  await step(tok);                                   // 7:29 accesses have patterns
  sayc('但人的程式有特性', 'access 的資料有 pattern，常用的就那些');
  await step(tok);                                   // 7:33 first miss slow, then very fast
  good('第一次 miss 慢，之後很快 → 總和還是賺', 4.6, 4.6);
  sayc('第一次 miss 很慢', '之後非常快，總和起來有幫助');
  await step(tok);                                   // 8:04 big data: read once and discard
  icon('📊', '巨量資料：讀一遍就丟', 3.6, 2.2, 0.6, 'sm');
  sayc('巨量資料', '讀一遍就丟，memory 都塞不下');
  await step(tok);                                   // 8:32 such systems don't cache at all
  bad('不 cache 效能反而更好', 3.6, -0.3, 0.6);
  sayc('這種系統甚至不 cache', '效能反而更好');
  void L; void cpu; void orig;
}]);

// 8:47 coherence / consistency
FRAG.push(['osB-coherence', 'Cache coherence 與 consistency', async (tok) => {
  fresh([0, 4.8, 13.5], [0, 2.2, 0]);
  const mem = bx('memory：x = 5', COL.cpu, 0, 0.35, 0, 3.0, 0, 0.7, 1.2);
  const ca = bx('cache：x = 5', '#e08a4c', 0, 1.5, 0, 2.4, 0, 0.55, 1.0);
  await step(tok);                                   // 8:47 a copy must not differ from the original
  const tagsC = [sm('分身（copy）', 1.9, 1.5), sm('本尊', 2.2, 0.35)];
  sayc('cache 只是分身', '不能跟本尊不同');
  await step(tok);                                   // 8:54 otherwise: the coherence problem
  tagsC.push(hot('coherence / consistency 問題', 0, 3.0));
  sayc('不同就會有', 'coherence（consistency）的問題');
  await step(tok);                                   // 9:16 you modified only the cache, not memory yet
  txt(ca.userData.lbl, 'cache：x = 7'); glow(ca, GOLD);
  tagsC.push(bad('不一樣！', 2.6, 1.0));
  sayc('修改時只改了最上層的 cache', '還沒 update 到 memory');
  await step(tok);                                   // 9:29 that's fine — what matters is what programs see
  const p = pal('程式', '看到 7', COL.user, -4.4, 0, 0.6);
  sayc('其實暫時不一樣是可以的', '最後 care 的只有使用者看到什麼');
  await step(tok);                                   // 9:57 every program must see one consistent value
  const sameG = good('大家看到的值都一樣就好', -4.4, 2.0);
  sayc('重點：讓程式看到', '一致（consistent）的值');
  await step(tok);                                   // 10:19 multi-core: cache coherence problem
  gone(p, sameG);
  const c0 = pal('core 0', '', COL.cpu, -4.6, 0, 0.6), c1 = pal('core 1', '', COL.pink, 4.6, 0, 0.6);
  const l0 = bx('L1：x = 7', '#e08a4c', -4.6, 1.75, 0, 1.6, 0, 0.4, 0.8), l1 = bx('L1：x = 5', '#e08a4c', 4.6, 1.75, 0, 1.6, 0, 0.4, 0.8);
  sayc('multi-core：每個 core 的 L1 不同', 'L2、L3 應該同值 → cache coherence');
  await step(tok);                                   // 10:40 one program only → no problem
  sayc('如果資料只有一支程式在用', '怎麼慢慢 update 都沒問題');
  await step(tok);                                   // 11:11 but many programs share memory
  c1.mood('wow'); tagsC.push(bad('看到舊值 5！', 4.6, 2.5));
  sayc('可是電腦不只一個人一支程式', 'memory 的內容是 share 的');
  await step(tok);                                   // 11:34 e.g. multi-thread programming
  tagsC.push(sm('例：multi-thread 故意 share memory', 0, 3.6));
  sayc('像 multi-thread programming', '就是要 share memory 的內容');
  await step(tok);                                   // 11:48 a program hops from core 1 to core 2
  const pr = pal('程式', '', COL.user, -4.6, 2.4, 0.45); await slide(tok, pr.g, 4.6, 0, 2.4, 900);
  sayc('程式跑在第一個 core', '換到第二個 core，看到的 cache 不同');
  await step(tok);                                   // 12:16 the system must keep up the illusion
  tagsC.push(good('系統要製造「資料都一樣」的假象', 0, 4.4));
  sayc('電腦必須符合程式的邏輯', '製造資料一致的假象');
  await step(tok);                                   // 12:35 distributed systems: different computers
  gone(c0, c1, l0, l1, pr, mem, ca, ...tagsC);
  const n1 = prop('monitor', -4.6, 0, 0, 0.8), n2 = prop('monitor', 0, 0, -1, 0.8), n3 = prop('monitor', 4.6, 0, 0, 0.8);
  sayc('分散式系統：不同電腦', '串起來讓它們以為是同一塊 memory');
  await step(tok);                                   // 12:49 the network can drop any time
  line(-3.8, 0.4, -0.8, 0.4, 0); line(0.8, 0.4, 3.8, 0.4, 0);
  bad('網路隨時會斷線', 2.3, 1.2);
  sayc('還要考慮網路', '網路是不穩定的，隨時會斷');
  await step(tok);                                   // 13:22 Google & co. gave up consistency
  hot('雲端大系統：放棄 consistency', 0, 3.6);
  sayc('像 Google 的雲端系統', '最後選擇放棄 consistency');
  await step(tok);                                   // 13:32 same URL, different versions — users don't mind
  pkt('版本 A', -4.6, 2.2); pkt('版本 B', 0, 2.2, -1); pkt('版本 A′', 4.6, 2.2);
  sayc('同一個網址', '大家看到的版本不一定一樣，也不影響');
  await step(tok);                                   // 13:56 telling 10,000 machines is too slow
  note('一台改了要通知一萬台 → 不可能很快', 0, 4.4);
  sayc('要保證一致就要大量溝通', '一台改了要告訴一萬台，太慢');
  void n1; void n2; void n3;
}]);

// ════════ OApn18tz9EU（第 4D 講 Hardware Protection：dual mode、privileged instruction、I/O / memory / CPU 保護） ════════
// the mode bit on the motherboard: 1 = user, 0 = monitor
function modeBit(x, y, z = 0) {
  const b = bx('mode bit = 1', COL.user, x, y, z, 2.0, 0, 0.5, 0.8);
  const st = sm('user mode', x, y + 0.55, z);
  return { b, set(v) { txt(b.userData.lbl, 'mode bit = ' + v); tint(b, v ? COL.user : COL.os); txt(st, v ? 'user mode' : 'monitor（kernel）mode'); } };
}

// 0:02 protection 指的是什麼
FRAG.push(['osB-protect-why', 'Protection：程式之間互不影響', async (tok) => {
  fresh([0, 4.8, 13.5], [0, 1.8, 0]);
  await step(tok);                                   // 0:02 protection is not just security
  hot('protection', 0, 5.4); sm('不只是 security（病毒、網路攻擊）', 0, 4.8);
  sayc('最後一個重點：protection', '不只是 security');
  await step(tok);                                   // 0:05 many users & programs share one system
  const ps = ['A', 'B', 'C'].map((n, k) => pal(n, '', JOBC[k + 1], -3 + k * 3, 0, 0.75));
  sayc('很多使用者、很多程式', '同時共用一個系統');
  await step(tok);                                   // 0:48 my program crashes, yours keeps running
  ps[0].mood('sad'); ps[0].set('crash'); bad('segmentation fault', -3, 2.2);
  ps[1].mood('happy'); good('照常跑', 0, 2.2); ps[2].mood('happy');
  sayc('我的程式 crash 了', '你的程式應該繼續跑，不是整台關機');
  await step(tok);                                   // 1:05 I may only touch my own memory
  [-3, 0, 3].forEach((x) => zone('', x, 0, 0, 2.4, 2.2, '#e3f3ea'));
  bad('不經 OS 跨過去 ✗', -1.5, 3.2);
  sayc('我能碰的 memory', '只有我自己這支程式的');
  await step(tok);                                   // 1:30 dual mode — coming right up
  hot('關鍵：dual mode', 0, 6.0);
  sayc('最重要的是 dual mode', '馬上就會講到');
  await step(tok);                                   // 1:49 does the hardware know who is the OS?
  const cpu = pal('CPU', '?', COL.cpu, 5.6, 0, 0.7); cpu.mood('wow');
  sayc('真的在執行時', 'hardware 知道誰是 OS、誰是 user program 嗎？');
  await step(tok);                                   // 2:01 instructions never carry a tag
  pkt('instruction（沒有 tag）', 5.6, 2.3);
  sayc('CPU 吃的 instruction 上', '從來沒有標記「這是 OS 的」');
  await step(tok);                                   // 2:27 president or citizen? chaos
  bad('不知道你是總統還是平民 → 天下大亂', 0, 4.3);
  sayc('不知道誰是 OS', '使用者就能亂發號司令');
  await step(tok);                                   // 2:34 dual mode can tell them apart
  good('dual mode：分得出來', 5.6, 3.0);
  sayc('所以有 dual mode', '透過 interrupt 的概念來區分');
  await step(tok);                                   // 4:05 hardware can't be modified
  prop('cpu', -5.6, 0, 1.8, 0.6); sm('hardware 燒死，改不了', -5.6, 0.9, 2.4);
  sayc('最底層要靠 hardware', '惡意程式也改不了 hardware');
  await step(tok);                                   // 4:23 minimal protection in HW, the rest in SW
  note('hardware 做最基本的 protection，software 靠它做剩下的', 0, -0.6, 2.0);
  sayc('hardware 提供最 minimum 的保護', 'software 靠這個 support 做剩下的');
  void cpu;
}]);

// 4:47 dual mode 與 mode bit
FRAG.push(['osB-dual-mode', 'Dual mode：user mode / monitor（kernel）mode', async (tok) => {
  fresh([0, 4.8, 13.5], [0, 1.8, 0]);
  await step(tok);                                   // 4:47 at least two modes
  zone('user', -3.4, 0, 0, 5.6, 3.0, '#e3f3ea'); zone('OS', 3.4, 0, 0, 5.6, 3.0, '#ece4fb');
  sayc('hardware support', '至少要兩個 mode');
  await step(tok);                                   // 4:50 user mode: executing user programs
  const u = pal('user program', '', COL.user, -3.4, 0, 0.75);
  hot('user mode', -3.4, 2.4);
  sayc('user mode：執行的是', 'OS 之外的使用者程式');
  await step(tok);                                   // 5:13 monitor mode / kernel mode: the OS runs
  const os = pal('OS', '', COL.os, 3.4, 0, 0.8);
  hot('monitor mode ＝ kernel mode', 3.4, 2.4);
  sayc('另一個：monitor mode', '也叫 kernel mode，OS 在執行');
  await step(tok);                                   // 5:28 the same-looking instruction, different origin
  const adds = [pkt('add', -3.4, 3.2), pkt('add', 3.4, 3.2)];
  sayc('instruction 可能長得一模一樣', '但來自 OS 還是 user 不一樣');
  await step(tok);                                   // 6:08 printf: OS code runs on behalf of the user
  await fly(tok, 'pkt', 'printf → system call', V3(-3.4, 1.4, 0.6), V3(3.4, 1.4, 0.6), 800);
  bub('OS 的程式碼幫你 printf（on behalf of）', 3.4, 4.0);
  sayc('printf 最後是 OS 的程式碼在做', '代替（on behalf of）使用者');
  await step(tok);                                   // 6:32 only one monitor, one I/O device
  const mon = prop('monitor', 0, 0, -2.0, 0.8);
  sayc('因為只有一個 monitor', '只有一個 I/O device，要 OS 統一管');
  await step(tok);                                   // 6:49 you output, I output → the buffer is garbled
  bad('你 output、我也 output → buffer 亂掉', 0, 2.4, -2.0);
  sayc('大家都直接 output', 'controller 的 buffer 就亂掉了');
  await step(tok);                                   // 7:08 how to tell them apart?
  sayc('到底怎麼區分？', '意外的簡單');
  await step(tok);                                   // 7:33 one bit on the motherboard
  const mb = modeBit(0, 0.25, 2.2);
  sayc('主機板上用一個 bit', '兩個 mode 一個 bit 就夠');
  await step(tok);                                   // 7:42 normally user mode: 1
  sayc('平常是 user mode', '例如值是 1');
  await step(tok);                                   // 7:48 an interrupt flips it to 0
  await fly(tok, 'bad', 'interrupt', V3(-3.4, 1.4, 0.6), V3(0, 0.8, 2.2), 600); mb.set(0);
  sayc('call interrupt 時 flip 成 0', 'call interrupt ＝ 要執行 OS 的程式');
  await step(tok);                                   // 8:04 a signal (or a fault) flips it too
  sayc('signal、fault 也一樣', '處理 interrupt 第一件事就是 flip 這個 bit');
  await step(tok);                                   // 8:18 0 → instruction from the OS; 1 → not
  gone(...adds);
  good('看到 0：instruction 來自 OS', 3.4, 3.2); sm('看到 1：不是 OS 的', -3.4, 3.2);
  sayc('看到 0 就知道是 OS 的 instruction', '看到 1 就不是');
  await step(tok);                                   // 8:53 return to user program flips it back
  await fly(tok, 'pkt', 'return', V3(3.4, 1.5, 0.6), V3(-1.2, 1.5, 0.6), 700); mb.set(1);
  sayc('OS 做完 return to user program', '再把 bit flip 回來');
  void u; void os; void mon;
}]);

// 9:22 privileged instruction
FRAG.push(['osB-privileged', 'Privileged instruction：只能在 monitor mode 執行', async (tok) => {
  fresh([0, 4.8, 13.5], [0, 1.8, 0]);
  const u = pal('user program', '', COL.user, -4.6, 0, 0.7);
  const cpu = pal('CPU', '', COL.cpu, 0, 0, 0.8);
  const os = pal('OS', '', COL.os, 4.6, 0, 0.75);
  const mb = modeBit(0, 0.25, 2.2);
  await step(tok);                                   // 9:22 some instructions affect others → must go through the OS
  sayc('會影響別人的 instruction', '要求一定要透過 OS');
  await step(tok);                                   // 9:45 the ISA (e.g. x86) defines a privileged set
  hot('privileged instruction（特權指令）', 0, 4.4);
  sayc('instruction set（像 x86）設計時寫死', '有一組 privileged instruction');
  await step(tok);                                   // 9:53 executable only in monitor mode
  sm('只能在 monitor mode 執行', 0, 3.8);
  sayc('必須在 monitor mode', '才能執行');
  await step(tok);                                   // 10:08 user sends it: the CPU checks the bit
  await fly(tok, 'pkt', 'privileged 指令', V3(-4.6, 1.4, 0.6), V3(0, 1.4, 0.6), 700);
  glow(mb.b, GOLD);
  sayc('使用者自己送到 CPU', 'CPU 一看是 privileged，就 check mode bit');
  await step(tok);                                   // 10:12 user mode → refuse, raise an interrupt
  cpu.mood('sad');
  await fly(tok, 'bad', 'interrupt：有人亂來', V3(0, 1.6, 0.6), V3(4.6, 1.6, 0.6), 700);
  sayc('是 user mode：抱歉不幫你做', '丟 interrupt 給 OS');
  await step(tok);                                   // 10:23 a fault — the program is stopped
  u.mood('sad'); u.set('停掉'); bad('fault → 程式被停掉', -4.6, 2.2);
  sayc('OS 就丟一個 fault', '把程式停掉');
  await step(tok);                                   // 10:54 e.g. writing to an I/O device is privileged
  const mon = prop('monitor', 4.6, 0, -2.2, 0.7);
  sayc('例如把資料寫到 I/O device', '就是 privileged instruction');
  await step(tok);                                   // 11:02 so call a system call
  u.mood('calm'); u.set('');
  await fly(tok, 'pkt', 'system call', V3(-4.6, 2.0, 0.6), V3(4.6, 2.0, 0.6), 800);
  sayc('使用者不能直接 call', '必須 call system call 叫 OS 幫忙');
  await step(tok);                                   // 11:25 → flip to monitor mode
  mb.set(0); os.mood('happy');
  sayc('call system call 時', 'flip 到 monitor mode');
  await step(tok);                                   // 11:35 the OS's routine writes it, not you
  await fly(tok, 'pkt', '照 OS 的規則寫', V3(4.6, 1.2, 0.2), V3(4.6, 1.0, -2.2), 600);
  good('OS 的 routine 寫到螢幕', 4.6, 2.6, -2.2);
  sayc('由 OS 寫好的 routine', '照規則寫到螢幕，不是你自己直接寫 device');
  await step(tok);                                   // 12:22 purpose: force users through the OS
  good('privileged instruction：強迫透過 OS', 0, 5.2);
  sayc('目的：保護電腦', '強迫使用者透過 OS 才能執行');
  void mon;
}]);

// 12:34 I/O protection
FRAG.push(['osB-io-protect', 'I/O 保護：所有 I/O 指令都是 privileged', async (tok) => {
  fresh([0, 4.8, 13.5], [0, 1.8, 0]);
  await step(tok);                                   // 12:34 I/O, memory, CPU — always these three
  hd('I/O', -4.0, 5.4); hd('Memory', 0, 5.4); hd('CPU', 4.0, 5.4);
  sayc('電腦不外乎就是', 'I/O、memory、CPU');
  await step(tok);                                   // 12:43 which I/O to protect? all of it
  hot('I/O：全部要保護', -4.0, 4.7);
  sayc('I/O 哪些要保護？', '答案是全部');
  await step(tok);                                   // 12:53 one screen, one printer, one NIC… all shared
  prop('monitor', -5.6, 0, 0, 0.6); prop('printer', -4.0, 0, 0.4, 0.6); prop('disk', -2.4, 0, 0, 0.6);
  sayc('螢幕、printer、網路卡、硬碟', '全部都只有一個，是共用的');
  await step(tok);                                   // 13:09 so every I/O instruction is privileged
  good('所有 I/O instruction ＝ privileged', -4.0, 2.6);
  sayc('所以所有 I/O 指令', '全部都是 privileged instruction');
  await step(tok);                                   // 13:14 even poke / peek
  pkt('poke', -4.6, 1.9, 0.8); pkt('peek', -3.4, 1.9, 0.8);
  sayc('剛才看到的 poke、peek', '也全部是 privileged');
  await step(tok);                                   // 13:46 hackers look for loopholes
  const h = pal('hacker', '', '#5a5a5a', 1.2, 2.4, 0.6); h.mood('happy');
  sayc('I/O 完全被保護了嗎？', 'hacker 會找漏洞');
  await step(tok);                                   // 14:04 if users could rewrite memory freely…
  const vec = []; for (let i = 0; i < 4; i++) vec.push(bx('ptr', '#e8dcc4', 0, 3.3 - i * 0.5, 0, 1.2, 0, 0.4, 0.6));
  sm('interrupt vector（在 memory 裡）', 0, 3.9);
  sayc('繞不過 I/O 就繞 memory：', '如果使用者能任意改寫 memory…');
  await step(tok);                                   // 14:33 overwrite the interrupt vector
  await fly(tok, 'bad', '改寫', V3(1.2, 1.6, 2.4), V3(0, 2.3, 0.3), 600); txt(vec[2].userData.lbl, '偷換！'); glow(vec[2], RED);
  sayc('把 interrupt vector 的值', '偷偷改掉');
  await step(tok);                                   // 14:41 point it at its own code; it runs in monitor mode
  const ev = bx('惡意 driver', '#5a5a5a', 2.6, 2.3, 0, 1.6, 0, 0.5, 0.6);
  bad('進了 monitor mode 就愛幹嘛都可以', 2.0, 1.0, 1.2);
  sayc('換成自己的程式', 'OS 以為在處理硬碟，其實在 monitor mode 做壞事');
  await step(tok);                                   // 15:15 e.g. buffer overflow attacks
  note('早期常見：buffer overflow', 2.0, 4.6);
  sayc('早期常見的 buffer overflow', '就是偷偷繞過 OS 改 memory');
  await step(tok);                                   // 15:34 protecting I/O isn't enough
  hot('只保護 I/O 不夠 → 要保護 memory', 0, 6.2);
  sayc('所以只保護 I/O 是不夠的', '更重要的是保護 memory');
  void h; void ev;
}]);

// 15:36 memory protection：base / limit
FRAG.push(['osB-mem-protect', 'Memory 保護：base register 與 limit register', async (tok) => {
  fresh([0, 4.8, 14], [0, 2.4, 0]);
  const colY = (a) => 0.3 + a * 0.5;           // address 0..9 drawn bottom → top
  const memc = []; for (let a = 0; a < 10; a++) memc.push(bx('', '#efe7d8', -3.6, colY(a), 0, 2.2, 0, 0.46, 1.0));
  sm('memory（想成連續空間）', -3.6, 5.5);
  await step(tok);                                   // 15:36 more important: protect memory
  hot('保護 memory', 2.6, 6.2);
  sayc('更重要的是', '保護 memory 的 content');
  await step(tok);                                   // 15:56 the vector, the service routines live in memory
  for (let a = 0; a < 2; a++) { tint(memc[a], COL.os); } sm('OS：interrupt vector、service routine', -6.2, colY(0.5), 0.6);
  sayc('像 interrupt vector 的值', 'service routine 的 code，都在 memory 裡');
  await step(tok);                                   // 16:19 user programs may not overwrite each other either
  for (let a = 3; a < 6; a++) tint(memc[a], COL.user); for (let a = 7; a < 9; a++) tint(memc[a], COL.pink);
  sm('程式 A', -1.9, colY(4)); sm('程式 B', -1.9, colY(7.5));
  sayc('不只 OS', 'user program 之間也不能互相篡改');
  await step(tok);                                   // 16:28 record two registers
  sayc('方式沒那麼複雜：', '記錄兩個 register');
  await step(tok);                                   // 16:57 limit each program to a range
  const br = ghostBox(COL.user, 2.5, 1.5, 1.2); br.position.set(-3.6, colY(4), 0);
  sayc('每支程式要限制在', '一段連續空間內，超過就不能用');
  await step(tok);                                   // 17:05 malloc grows the range — through the OS
  const mallocSm = sm('malloc：透過 OS 調整空間', 1.0, colY(6), 0);
  sayc('malloc（dynamic allocation）', '就是透過 OS 調整這個空間');
  await step(tok);                                   // 17:15 cross it on your own → segmentation fault
  const segBad = bad('自己越界 → segmentation fault', 3.2, colY(8));
  sayc('沒跟 OS 講就超過', '就丟 segmentation fault 給你');
  await step(tok);                                   // 17:38 base register and limit register
  const bl = arrow(V3(-6.2, colY(3), 0.6), V3(-4.8, colY(3), 0.6), 0x2fc092); hd('base = 3（示意）', -6.2, colY(3) + 0.4, 0.6);
  sayc('只需要 base register', '跟 limit register');
  await step(tok);                                   // 17:45 base = start, limit = length
  hd('limit = 3', -6.2, colY(5) + 0.1, 0.6);
  sm('base：開始的位置', -6.2, colY(3) - 0.3, 0.6); sm('limit：有多長', -6.2, colY(5) + 0.75, 0.6);
  sayc('base：在連續空間的起點', 'limit：到底有多長');
  await step(tok);                                   // 17:49 e.g. 4 GB or 100 GB
  sm('例：4 GB 還是 100 GB', -6.2, colY(5) + 1.4, 0.6);
  sayc('這支 program 能用 4 GB', '還是 100 GB，就是 limit');
  await step(tok);                                   // 19:13 every access: compare with base first
  gone(mallocSm, segBad);
  const code1 = code(['if (addr <  base)         trap;', 'if (addr >= base + limit) trap;', 'memory 存取 OK'], 3.4, 4.6, 0.5, 0);
  code1.hl(0); const ad = pkt('addr = 4', 3.4, 5.4);
  sayc('每個存取 memory 的 instruction', '先跟 base 比：小於就丟掉');
  await step(tok);                                   // 19:17 that is a trap
  sm('越界 → trap（software 引起的 error）', 3.4, 2.9);
  sayc('這裡用 trap', '因為是 software instruction 引起的 error');
  await step(tok);                                   // 19:32 then check base + limit
  code1.hl(1);
  sayc('再檢查 base + limit', '有在區間內嗎？');
  await step(tok);                                   // 19:53 they are just values
  code1.hl(2); await fly(tok, 'pkt', 'OK', V3(3.4, 3.4, 0.4), V3(-3.6, colY(4), 0.6), 700);
  sayc('在區間內才送上 memory bus', 'base、limit 只是兩個值');
  await step(tok);                                   // 20:12 the instruction that changes them: privileged?
  hot('改 base / limit 的指令 → 一定要 privileged', 2.6, 1.6);
  sayc('修改這兩個 register 的指令', '應該是 privileged instruction 吧？');
  await step(tok);                                   // 20:24 otherwise: double my limit myself
  bad('若不是：我自己把 limit 擴大一倍 → 完了', 2.6, 0.9);
  sayc('不是的話使用者偷偷', '把自己的 limit 擴大一倍就完了');
  await step(tok);                                   // 20:43 malloc changes the limit register (via the OS)
  for (let a = 6; a < 7; a++) tint(memc[a], COL.user);
  good('malloc → OS 改 limit register', 2.6, 0.2);
  sayc('call malloc 時', '裡面就在修改 limit register');
  void bl; void ad;
}]);

// 21:10 CPU protection：timer
FRAG.push(['osB-cpu-protect', 'CPU 保護：timer 與 time sharing', async (tok) => {
  fresh([0, 4.8, 13.5], [0, 1.8, 0]);
  const cpu = pal('CPU', '', COL.cpu, 0, 0, 0.85);
  await step(tok);                                   // 21:10 last one: the CPU
  hot('保護 CPU', 0, 5.0);
  sayc('最後一個：CPU', '也要保護');
  await step(tok);                                   // 21:23 stop a program hogging the CPU
  const p = pal('程式', '', COL.pink, -2.0, 0, 0.6);
  sayc('要阻止一支程式霸佔 CPU', '連 OS 都沒機會執行');
  await step(tok);                                   // 21:40 e.g. while(1) by mistake: infinite loop
  const cd = code(['while (1) {', '   // 寫錯了…', '}'], -4.6, 4.2, 0.45, -0.6); cd.hl(0);
  p.set('∞'); p.mood('wow');
  sayc('例如寫錯了 while(1)', '變成 infinite loop');
  await step(tok);                                   // 21:54 you can still take control of the system
  sayc('這時你仍然可以', 'take control the system');
  await step(tok);                                   // 21:57 Ctrl-C, switch to another program
  const ctrlC = pkt('Ctrl-C', 3.6, 2.4);
  sayc('還能按 Ctrl-C', '或切換到別的程式');
  await step(tok);                                   // 22:40 how? time sharing
  const tsSm = sm('time sharing：沒有人能一直佔著 CPU', 0, 3.3);
  sayc('怎麼做到？', '就是 time sharing');
  await step(tok);                                   // 23:22 a timer on the motherboard
  remove(ctrlC);
  const tm = icon('⏲️', 'timer', 3.6, 1.0, 1.0);
  sayc('主機板上有一個 timer', '使用者沒 call、沒丟 interrupt 也會觸發');
  await step(tok);                                   // 23:25 each tick it raises an interrupt
  await fly(tok, 'bad', 'timer interrupt', V3(3.6, 1.6, 1.0), V3(0, 1.4, 0.4), 700);
  p.mood('sad');
  sayc('時間一到就丟一個 interrupt', '打斷目前在跑的程式');
  await step(tok);                                   // 23:38 the OS scheduler decides who runs next
  const os = pal('OS scheduler', '', COL.os, 2.0, -1.8, 0.6);
  await slide(tok, p.g, -4.6, 0, 1.6, 600);
  const q = pal('別人', '', COL.user, -2.0, 0, 0.6); q.mood('happy');
  sayc('讓 OS 的 scheduler 決定', '原程式繼續，還是換別人（作業三）');
  await step(tok);                                   // 24:21 each tick gives control back to the OS
  good('每次 timer → 控制權回到 OS', 0, 4.4);
  sayc('每次 timer 觸發', '就把 CPU 的控制權拿回 OS');
  await step(tok);                                   // 24:55 10 ms or 100 ms — adjustable
  note('10 ms？100 ms？可以調整', 3.6, 2.6, 1.0);
  sayc('timer 的值', '10 ms 還是 100 ms 可以動態調整');
  await step(tok);                                   // 25:08 'load' = override the hardware register
  remove(tsSm);
  sm('load：覆寫 hardware register 的設定', 3.6, 3.2, 1.0);
  sayc('調整用 load 指令', 'load ＝ override hardware register');
  await step(tok);                                   // 25:22 privileged: only the OS may change it
  hot('load timer ＝ privileged instruction', -2.0, 5.6);
  sayc('它是 privileged instruction', '只有 OS 能調 timer');
  await step(tok);                                   // 25:27 else: set it to infinity and hog forever
  bad('使用者把 timer 設成無限大 → 永遠霸佔 CPU', 0, 6.2);
  sayc('不然使用者把 timer 設成無限大', '就能永遠霸佔 CPU');
  void cpu; void tm; void os;
}]);

// 25:45 總結：怎麼判斷是不是 privileged instruction
FRAG.push(['osB-priv-quiz', '判斷：這是 privileged instruction 嗎？', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 1.8, 0]);
  await step(tok);                                   // 25:45 remember dual mode, privileged instructions
  hot('dual mode ＋ privileged instruction', 0, 5.0);
  sayc('最重要：dual mode', 'kernel mode / user mode 與 privileged instruction');
  await step(tok);                                   // 26:07 exam: is it privileged? yes / no
  hd('考題：這是 privileged instruction 嗎？', 0, 4.2);
  sayc('考試常問：這個 instruction', '應不應該是 privileged？yes or no');
  await step(tok);                                   // 26:20 would a user doing it harm the system?
  note('判斷：使用者擅自執行，會危害電腦運作嗎？', 0, 3.4);
  sayc('判斷標準：使用者擅自執行', '會不會危害電腦的運作？會 → privileged');
  await step(tok);                                   // 26:31 e.g. arithmetic: 3 + 4
  const a = pal('add 3, 4', '', COL.user, -3.0, 0, 0.7);
  sayc('像加減乘除', '程式裡寫 3 + 4 就是一個 add');
  await step(tok);                                   // 26:40 add is not privileged
  a.mood('happy'); good('add：不是 privileged（只動自己的資料）', -3.0, 2.2);
  bad('I/O、改 base/limit、load timer：privileged', 3.2, 2.2);
  sayc('add 只是把兩個 register 相加', '跟系統無關，不是 privileged');
}]);

// ════════ lpOMe56f1Nw（第 5C 講 OS Application Interface：system call vs API、POSIX、parameter passing） ════════
// the layer stack of this lecture: hardware, OS (service routines), system call, API library, user application
const L5 = [['hardware', '#8a94a6'], ['OS：service routine', COL.os], ['system call（assembly）', COL.bad], ['API（C library、Java…）', COL.gold], ['user application', COL.user]];
function stack5(n, x = 0, w = 6.0, drop = 0) { const out = []; for (let i = 0; i < n; i++) out.push(bx(L5[i][0], L5[i][1], x, 0.32 + i * 0.68, 0, w, drop, 0.6, 1.4)); return out; }

// 0:03 system call 是什麼
FRAG.push(['osB-syscall-props', 'System call：OS 唯一的介面，software interrupt', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 2.0, 0]);
  await step(tok);                                   // 0:03 the key of this chapter: system call vs API
  hd('system call', -2.6, 5.4); hd('vs', 0, 5.4); hd('API', 2.6, 5.4);
  sayc('本章最重要的部分：', 'system call 和 API 差在哪裡');
  await step(tok);                                   // 0:37 not just two names for one thing
  bad('不是別名！是不一樣的東西', 0, 4.7);
  sayc('它們不是別名', '而是不一樣的東西');
  await step(tok);                                   // 0:59 services: send / receive message, read / write files
  const os = pal('OS', 'services', COL.os, 0, 0, 1.0);
  pkt('send / receive', -2.4, 2.4); pkt('read / write', 2.4, 2.4);
  sayc('OS 提供各種 service', '像 send、receive message，讀寫 file');
  await step(tok);                                   // 1:19 CLI / GUI are for people typing commands
  const man = pal('人', 'CLI / GUI', COL.teal, -5.0, 0, 0.6);
  sayc('剛才的 CLI、GUI', '是給「人」下指令用的');
  await step(tok);                                   // 1:35 a program can only use function calls: API / system call
  const prg = pal('program', 'function call', COL.user, 5.0, 0, 0.6);
  sayc('program 要跑在電腦上', '只能透過 function call：API、system call');
  await step(tok);                                   // 1:44 every service is defined as a function call
  sm('每個 service 都定義成 function 的形式', 0, 3.2);
  sayc('所以每個 service', '都定義成一個 function 的形式');
  await step(tok);                                   // 2:07 the OS's own function calls are system calls
  gone(man, prg);
  gone(os); const S = stack5(3, 0, 6.0);
  hot('system call ＝ OS 唯一的 interface', 0, 2.8);
  sayc('OS 自己提供的 function', '就叫 system call，是唯一的 interface');
  await step(tok);                                   // 2:26 part of the OS, its outermost interface
  sm('part of OS：最外層的 interface 定義', 4.6, 1.68);
  sayc('它是 OS 的一部分', 'OS 最外層 interface 的定義');
  await step(tok);                                   // 2:45 it is a software interrupt
  pkt('software interrupt（trap）', -4.4, 1.68);
  sayc('特性一：system call', '就是一個 software interrupt');
  await step(tok);                                   // 2:58 you always enter kernel mode
  const mb = bx('mode：user → kernel', COL.os, -4.4, 3.4, 0, 2.6, 0, 0.5, 0.8);
  sayc('call 了就一定進 kernel mode', '離開 user mode：只有 system call 有這特性');
  await step(tok);                                   // 3:08 written in assembly language to be fast
  note('用 assembly language 寫 → 才夠快', 4.6, 3.4);
  sayc('特性二：為了效能', '通常用 assembly language 寫');
  await step(tok);                                   // 3:30 performance first; convenience is for upper layers
  good('效能優先，大家共用', 4.6, 4.0);
  sayc('OS 講求效能優先', '方便性交給上層（shell、API）');
  await step(tok);                                   // 3:48 that's why homework 1 edits a .S file
  sm('作業一要改的 .S 檔：定義 system call 的 interface', 0, -0.6, 1.0);
  sayc('所以作業一有一個 .S 檔要改', '它就是 system call');
  await step(tok);                                   // 4:06 but nobody writes assembly
  bad('可是大家都不會寫 assembly…', 0, -1.3, 1.0);
  sayc('可是 assembly 大家（老師也）不太會寫', '怎麼在上面寫 program？');
  void S; void mb;
}]);

// 4:19 API：在 system call 上面再加一層
FRAG.push(['osB-api-layer', 'API：在 system call 上面再加一層', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 2.4, 0]);
  const S = stack5(3, 0, 6.0);
  await step(tok);                                   // 4:19 like the shell idea, but for programs
  const shellSm = sm('shell：給人下 command　API：給 program call function', 0, 4.9);
  sayc('跟 shell 的概念很像', '但這裡是 program 要 call function');
  await step(tok);                                   // 4:36 API = Application Program Interface
  const api = bx(L5[3][0], L5[3][1], 0, 0.32 + 3 * 0.68, 0, 6.0, 2.5, 0.6, 1.4);
  sayc('於是再加一層：API', 'Application Program Interface');
  await step(tok);                                   // 4:47 purely for programming convenience
  sm('純粹為了 programming 方便', 4.6, 2.36);
  sayc('它純粹是為了 programming 的方便', '跟 OS 不需要那麼緊密');
  await step(tok);                                   // 5:00 API sits on top of system calls
  remove(shellSm);
  hot('API 在上，system call 在下', -4.8, 4.4);
  sayc('API 建在 system call 的上面', '是另外一層');
  await step(tok);                                   // 5:13 then the OS's service routines drive the hardware
  for (let i = 3; i >= 1; i--) await fly(tok, 'pkt', '↓', V3(-2.4, 0.32 + i * 0.68 + 0.4, 0.8), V3(-2.4, 0.32 + (i - 1) * 0.68 + 0.4, 0.8), 260);
  sayc('system call 之後才去執行', 'OS 的 service routine，操作 hardware');
  await step(tok);                                   // 5:28 you program against the API
  const app = bx(L5[4][0], L5[4][1], 0, 0.32 + 4 * 0.68, 0, 6.0, 2.5, 0.6, 1.4);
  good('programming against API', 5.0, 4.4);
  sayc('寫程式時 program against API', '很少直接 call system call');
  await step(tok);                                   // 6:00 an API is a bunch of libraries
  sm('形式：一堆 library', -4.8, 2.36);
  sayc('API 的形式', '就是一堆 library');
  await step(tok);                                   // 6:04 the C library is one OS API
  pkt('C library', -2.0, 3.75);
  sayc('C library 就被定義為', '作業系統的 API 之一');
  await step(tok);                                   // 6:26 Android: Java
  pkt('Java（Android）', 1.2, 3.75);
  sayc('也不是唯一：Android 上', '是 programming against Java');
  await step(tok);                                   // 6:54 hence 'system programming languages'
  sm('所以 C、Java 叫 system programming language', 0, 5.5);
  sayc('所以這些常被叫做', 'system programming language');
  await step(tok);                                   // 7:14 otherwise program against system calls — hard
  bad('只能直接 program against system call → 很難', 0, -0.5, 1.0);
  sayc('只有 C 而你不會 C？', '就得直接對 system call 寫，很難很複雜');
  void S; void api; void app;
}]);

// 7:28 API 和 system call 的對應：一對多、一對零、多對一
FRAG.push(['osB-api-map', 'API ↔ system call：一對多、一對零、多對一', async (tok) => {
  fresh([0, 4.8, 13.5], [0, 2.4, 0]);
  for (const zn of [zone('API', 0, 0, -1.0, 13.0, 1.2, '#f6ead0'), zone('system call', 0, 0, 2.0, 13.0, 1.2, '#f6dcdc')]) { const l = zn.userData.name; l.center.set(1, 0.5); l.position.x = -6.6; }
  const apiBox = (t, x) => bx(t, COL.gold, x, 0.3, -1.0, 1.7, 1.5, 0.5, 0.8);
  const scBox = (t, x) => bx(t, COL.bad, x, 0.3, 2.0, 1.4, 1.5, 0.5, 0.8);
  const link = (x1, x2) => arrow(V3(x1, 0.6, -0.55), V3(x2, 0.6, 1.55), 0x8a7a5c);
  await step(tok);                                   // 7:28 not translation / forwarding 1:1 — two layers
  bad('不是一對一的 translation / forwarding', 0, 5.9);
  sayc('API 不只是一對一的', '翻譯或轉送：它們根本是兩層');
  await step(tok);                                   // 7:43 one API may need many system calls
  hd('一對多', -4.4, 2.4);
  sayc('一個 API function', '可能要好幾個 system call 才完成');
  await step(tok);                                   // 7:43 or one-to-zero
  hd('一對零', -0.6, 2.4);
  sayc('也可能一對零：', 'call 了 API，完全不 call system call');
  await step(tok);                                   // 8:12 e.g. abs() from the math library
  apiBox('abs()', -0.6); bx('×', '#d8cfc0', -0.6, 0.3, 2.0, 0.6, 0, 0.3, 0.5);
  sayc('例如 math library 的 abs', '取絕對值只是處理數字，不需要 OS');
  await step(tok);                                   // 8:27 it exists just to make programming easy
  good('API 的目的：方便寫 program', -0.6, 1.5, -1.0);
  sayc('為什麼還要有它？', '因為方便你寫 program');
  await step(tok);                                   // 8:31 or exponentials, wrapped in one function
  apiBox('pow()', 1.3);
  sayc('像指數也是', '用一個 function 包起來好操作');
  await step(tok);                                   // 9:14 many APIs need several system calls
  sayc('相對的，很多 API', '需要好幾個 system call 才完成');
  await step(tok);                                   // 9:38 system calls should be as few as possible
  note('system call 越少越好：越多越難 debug', 4.6, 3.6);
  sayc('因為 system call 希望越少越好', '越多就越難 debug、越容易出問題');
  await step(tok);                                   // 9:49 each does one simple thing, no overlap
  sm('每個只做一件事、彼此沒交集', 4.6, 3.0);
  sayc('最好每個 system call', '只做一件事，完全沒交集');
  await step(tok);                                   // 10:07 fopen is an API → 3–4+ system calls
  apiBox('fopen()', -4.4);
  for (let k = 0; k < 3; k++) { scBox('sc' + (k + 1), -5.6 + k * 1.2); link(-4.4, -5.6 + k * 1.2); }
  sm('（至少三四個以上）', -4.4, -0.4, 2.6);
  sayc('fopen 是 API', '背後至少要三四個 system call');
  await step(tok);                                   // 10:23 malloc and free are different APIs…
  apiBox('malloc()', 3.4); apiBox('free()', 5.4);
  hd('多對一', 4.4, 2.4);
  sayc('有趣的例子：malloc 和 free', '是不一樣的 API');
  await step(tok);                                   // 10:28 …but both call the same system call: brk
  scBox('brk', 4.4); link(3.4, 4.4); link(5.4, 4.4);
  sayc('但它們 call 的是同一個', 'system call：brk（只是參數不同）');
  await step(tok);                                   // 10:56 one-to-many, many-to-one: no fixed relation
  sayc('一對多、多對一都有', '沒有限制，看需求');
  await step(tok);                                   // 11:15 calling an API is not an interrupt
  hot('call API ≠ interrupt', -4.0, 4.6);
  sayc('API 不是 interrupt', '裡面 call 到 system call 才產生 interrupt');
  await step(tok);                                   // 11:23 an API call does not enter kernel mode
  sm('API 本身不會進 kernel mode', -4.0, 4.0);
  sayc('call API 並不會進 kernel mode', '是間接透過 system call 進 OS');
  await step(tok);                                   // 11:58 a system call interrupts someone: be quick
  note('system call 是打斷別人 → 要簡潔、越快越好', 3.0, 5.2);
  sayc('system call 是 interrupt', '打斷別人，一定要簡潔、越快越好');
  await step(tok);                                   // 12:19 an API is for me; it may take long — C, Java fine
  good('API：自己要做的，慢一點沒差 → C、Java 都 OK', 3.0, 4.5);
  sayc('API 是我自己方便', '做久一點也沒差，用 C、Java 都 OK');
}]);

// 12:28 interface 與 library（implementation）
FRAG.push(['osB-interface-impl', 'Interface 與 library：一個介面、多種實作', async (tok) => {
  fresh([0, 4.6, 13], [0, 2.2, 0]);
  await step(tok);                                   // 12:28 interface vs library
  const itf = bx('interface：pow2(n)', COL.gold, 0, 4.2, 0, 3.6, 2, 0.6, 1.0);
  sayc('觀念釐清：', 'interface 跟 library');
  await step(tok);                                   // 12:48 you only define the interface (like OO / Java)
  sm('只定義怎麼 call（像 OO、Java 的 interface）', 0, 5.0);
  sayc('你只定義了 interface', '怎麼 implement 是另一回事');
  await step(tok);                                   // 13:00 implementation 1: a for loop
  const i1 = bx('for 迴圈一直 ×2', '#e9dcc4', -4.2, 1.6, 0, 3.0, 2, 0.6, 1.0); arrow(V3(-0.8, 3.8, 0), V3(-3.6, 2.0, 0));
  sayc('例：算 2 的 n 次方', '可以寫 for 迴圈一直乘');
  await step(tok);                                   // 13:10 implementation 2: shift
  const i2 = bx('shift：<< n', '#e9dcc4', 0, 1.6, 0, 3.0, 2, 0.6, 1.0); arrow(V3(0, 3.8, 0), V3(0, 2.0, 0));
  sayc('聰明一點：用 shift', 'binary 左移一位就是乘以 2');
  await step(tok);                                   // 13:18 implementation 3: hardware support
  const i3 = bx('hardware instruction', '#8a94a6', 4.2, 1.6, 0, 3.0, 2, 0.6, 1.0); arrow(V3(0.8, 3.8, 0), V3(3.6, 2.0, 0));
  sayc('更厲害的：hardware support', 'call 一個 hardware instruction 瞬間完成');
  await step(tok);                                   // 13:45 three different implementations
  hot('同一個 interface，三種 implementation', 0, 0.6);
  sayc('三種不同的 implementation', '介面都一樣');
  await step(tok);                                   // 13:49 the implementations are what we call a library
  zone('library', 0, 0, 0.9, 12.6, 1.0, '#e3f3ea');
  sayc('這些 implementation 集合起來', '就是我們俗稱的 library');
  void itf; void i1; void i2; void i3;
}]);

// 14:17 Win32、POSIX、Java API
FRAG.push(['osB-posix', 'Win32、POSIX、Java API：portability', async (tok) => {
  fresh([0, 4.8, 13.5], [0, 2.2, 0]);
  await step(tok);                                   // 14:17 Windows: Win32 API
  const w = bx('Win32 API', '#4b9ee2', -4.4, 1.6, 0, 3.0, 2, 0.6, 1.0); bx('Windows', '#8a94a6', -4.4, 0.35, 0, 3.0, 0, 0.6, 1.0);
  sayc('真實的作業系統：Windows', '它的 API 叫 Win32');
  await step(tok);                                   // 14:43 Windows asks you to program on Win32
  sm('要求你用 Win32 寫 program', -4.4, 2.4);
  sayc('Windows 要求你', '在 Win32 API 上面寫程式');
  await step(tok);                                   // 14:54 it is not the system call — don't mix them up
  bad('Win32 ≠ system call', -4.4, 3.0);
  sayc('Win32 是 API', '不是 system call，不要搞混');
  await step(tok);                                   // 15:10 UNIX, Linux, Mac follow POSIX
  const p = bx('POSIX API', COL.gold, 2.4, 1.6, 0, 7.0, 2, 0.6, 1.0);
  ['Linux', 'Mac', 'UNIX'].forEach((n, k) => bx(n, '#8a94a6', 0.2 + k * 2.2, 0.35, 0, 2.0, 0, 0.6, 1.0));
  sayc('另一大陣營：UNIX、Linux、Mac', 'API 都 follow POSIX');
  await step(tok);                                   // 15:30 Portable Operating System Interface for UNIX
  sm('Portable Operating System Interface（for UNIX）', 2.4, 2.4);
  sayc('POSIX 全名', 'Portable Operating System Interface');
  await step(tok);                                   // 15:43 their system calls differ; the API is identical
  ['sc: A', 'sc: B', 'sc: C'].forEach((n, k) => sm(n, 0.2 + k * 2.2, -0.2, 0.8));
  sayc('它們的 system call 不一樣', '但 API 的定義完全相同');
  await step(tok);                                   // 16:11 why 'portable'
  hot('portable', 2.4, 3.1);
  sayc('所以叫 portable', '原因很明顯');
  await step(tok);                                   // 16:30 move the program, recompile, no rewrite
  const prg = prop('file', 0.2, 2.0, 1.2, 0.5);
  await anim(tok, 900, (u) => { prg.position.x = 0.2 + u * 2.2; });
  good('只要重新 compile，不用改寫', 2.4, 3.7);
  sayc('Linux 上寫的程式拿到 Mac', '重新 compile 就好，不用改寫');
  await step(tok);                                   // 17:15 Pthread library
  pkt('Pthread', 5.6, 1.75);
  sayc('thread programming', '用的是 Pthread 這個 library');
  await step(tok);                                   // 17:21 the P stands for POSIX
  sm('P ＝ POSIX', 6.0, 1.15);
  sayc('為什麼前面有 P？', 'P 就是 POSIX 的簡寫');
  await step(tok);                                   // 17:54 last one: Java
  const j = bx('Java API', '#e08a4c', -4.4, 4.55, 0, 3.0, 2, 0.6, 1.0);
  sayc('最後一個：Java', '它是 language，為什麼也有自己的 API？');
  await step(tok);                                   // 18:08 it runs on the Java Virtual Machine
  bx('Java Virtual Machine', '#9b7ef4', -4.4, 3.9, 0, 3.0, 0, 0.6, 1.0);
  sayc('Java 跑在 Java Virtual Machine 上', '跟 Nachos 差不多的概念');
  await step(tok);                                   // 18:41 hence better portability
  good('portability 更好', -4.4, 5.35);
  sayc('它跑在自己模擬的 machine 上', '下面是什麼都沒差，portability 更好');
  await step(tok);                                   // 18:57 its own API: the Java API
  sayc('自己是 virtual machine', '所以自己定義的 API 叫 Java API');
  void w; void p; void j;
}]);

// 19:21 例子：copy 一個 file；Java 的 trade-off
FRAG.push(['osB-copy-example', '例子：copy 一個檔案要幾個 system call', async (tok) => {
  fresh([0, 4.6, 13], [0, 2.2, 0]);
  await step(tok);                                   // 19:21 copy content from one file to another
  const f1 = prop('file', -4.6, 0, 0, 0.9), f2 = prop('file', 4.6, 0, 0, 0.9);
  await fly(tok, 'pkt', 'content', V3(-4.0, 0.8, 0.3), V3(4.0, 0.8, 0.3), 900);
  sayc('例子：把一個 file 的內容', 'copy 到另一個 file');
  await step(tok);                                   // 19:37 (Q&A) Java is slower: translates at runtime
  sm('Java：runtime 要 translate 成 x86 / MIPS → 較慢', 0, 4.6);
  sayc('（同學問 Java）它要在 runtime', 'translate 你的 code，所以比較慢');
  await step(tok);                                   // 19:58 general & portable ↔ more work: a trade-off
  hot('越 general、越 portable → 要做的越多（trade-off）', 0, 5.2);
  sayc('這是一個 trade-off', '越 general、越 portable，要做的越多');
  await step(tok);                                   // 20:46 tens of system calls
  const sc = []; for (let k = 0; k < 18; k++) sc.push(pkt('sc', -4.2 + (k % 9) * 1.05, 2.4 + Math.floor(k / 9) * 0.55, 0.6));
  const manyN = note('十幾、二十個 system call', 0, 3.7, 0.6);
  sayc('只是 copy 一個檔案', '就要十幾二十個 system call');
  await step(tok);                                   // 20:57 low level, detailed, not programming-friendly
  const lowB = bad('low level、細節多、不 friendly', 0, 1.6, 0.6);
  sayc('直接用 system call：要寫 low level', '還要懂很多 detail，很不 friendly');
  await step(tok);                                   // 21:15 the API: fopen, fread, fwrite — three lines
  sc.forEach(remove); gone(manyN, lowB);
  code(['fopen(...);', 'fread(...);', 'fwrite(...);'], 0, 3.2, 0.5, 0.6);
  good('API：三行就好', 0, 1.6, 0.6);
  sayc('用 C library 的 API', 'fopen、fread、fwrite 三行就寫完');
  await step(tok);                                   // 21:23 still many parameters, each clearly defined
  sm('parameter 很多，但每個 field 都定義得很清楚', 0, 1.0, 0.6);
  sayc('一樣有很多 parameter', '但每個都定義得很清楚、很好用');
  void f1; void f2;
}]);

// 21:59 呼叫流程與為什麼要 API
FRAG.push(['osB-api-why', '呼叫流程：application → API → system call → OS；為什麼要 API', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 2.4, 0]);
  const S = stack5(5, -2.4, 5.0);
  const pk = (i) => V3(-4.4, 0.32 + i * 0.68 + 0.42, 0.8);
  await step(tok);                                   // 21:59 the user application calls the API library
  await fly(tok, 'pkt', 'call', pk(4), pk(3), 500, true);
  sayc('user application', '先 call API library');
  await step(tok);                                   // 22:01 API calls a system call when the OS is needed
  await fly(tok, 'pkt', 'call', pk(3), pk(2), 500, true);
  sayc('API 裡需要 OS 幫忙時', '才 call system call，進到 OS');
  await step(tok);                                   // 22:14 via interrupts → service routine → return
  await fly(tok, 'bad', 'interrupt', pk(2), pk(1), 500, true);
  await fly(tok, 'pkt', 'return', V3(-0.4, 1.1, 0.8), V3(-0.4, 2.6, 0.8), 600);
  sayc('透過 interrupt 那一套', '到 service routine，再 return 回 API');
  await step(tok);                                   // 22:29 many APIs never touch system calls
  const doneG = good('很多 API 在這層就做完了', 3.8, 2.4);
  sayc('很多 API 根本沒碰到 system call', '單純在 API 那邊就做完');
  await step(tok);                                   // 22:44 printf: output to the screen, an I/O device
  const pfP = pkt('printf', 3.8, 3.0);
  sayc('standard C 的 printf', '要 output 到螢幕：I/O device');
  await step(tok);                                   // 22:51 that is a privileged instruction → system call
  const ioSm = sm('I/O → privileged → 一定要 system call', 3.8, 3.6);
  sayc('I/O 指令一定是 privileged', '所以 API 要去 call system call');
  await step(tok);                                   // 23:05 then return to where it was called
  sayc('做完 return 回原來的地方', '跟之前 system call 的流程一樣');
  await step(tok);                                   // 23:25 why add the API layer? 1. fast to program
  gone(doneG, pfP, ioSm);
  hd('為什麼要 API？', 3.8, 5.6); sm('① 用 C、Java 很快寫 program', 3.8, 5.0);
  sayc('為什麼要在 system call 上加 API？', '① 才能很快寫 program');
  await step(tok);                                   // 23:35 2. portability (POSIX)
  sm('② portability（POSIX）', 3.8, 4.5);
  sayc('② portability', '像 POSIX');
  await step(tok);                                   // 23:42 POSIX also united against Microsoft back then
  sm('（當年也是為了整合、對抗 Microsoft）', 3.8, 4.05);
  sayc('POSIX 出現的大目的', '也是整合起來對抗當時的 Microsoft');
  await step(tok);                                   // 23:46 3. efficiency
  sm('③ efficiency', 3.8, 3.6 + 0.0);
  sayc('③ efficiency', '很多 code 根本不需要 call OS');
  await step(tok);                                   // 24:01 a system call is very expensive
  bad('system call 很 expensive：interrupt、動到 OS', 3.8, 1.6);
  sayc('system call 很 expensive', '不只移 PC，是 interrupt，還影響別人');
  await step(tok);                                   // 24:31 copying a file: 20-something calls
  sayc('copy 一個 file 要二十幾個 system call', '你自己寫得過設計 OS 的人嗎？');
  await step(tok);                                   // 24:44 the API uses them in the most efficient way
  good('API 幫你用最 efficient 的方式 call', 3.8, 1.0);
  sayc('API 由懂 OS 的人用最 efficient 的方式', '去 call system call');
  void S;
}]);

// 25:16 system call 的參數傳遞
FRAG.push(['osB-param-pass', 'System call 的參數傳遞：register、table、stack', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 2.2, 0]);
  const u = pal('user program', '', COL.user, -4.6, 0, 0.7);
  const os = pal('OS', 'kernel', COL.os, 4.6, 0, 0.75);
  await step(tok);                                   // 25:16 passing parameters, like a function call
  sayc('system call 就像 function call', '要 passing parameter');
  await step(tok);                                   // 25:31 exactly the same as a normal function call
  sm('傳參數的方式和一般 function call 完全相同', 0, 4.8);
  sayc('後面流程不同', '但傳參數的方式跟一般 function call 一樣');
  await step(tok);                                   // 25:47 1. directly in registers
  hd('① register', 0, 3.8);
  const r = bx('register：x', COL.cpu, 0, 0.4, 0, 1.8, 2, 0.6, 0.9);
  await fly(tok, 'pkt', 'x', V3(-4.0, 1.2, 0.5), V3(0, 1.0, 0.5), 600);
  sayc('第一種：直接用 register', '寫進 register，CPU 讀到就能做事');
  await step(tok);                                   // 26:03 2. a table in memory: pass a pointer
  hd('② table in memory（傳 pointer）', 0, 3.2, -1.6);
  sayc('第二種：table in memory', '簡單講就是傳一個 pointer');
  await step(tok);                                   // 26:17 many arguments → build a data structure
  const tbl = []; for (let k = 0; k < 3; k++) tbl.push(bx('arg' + (k + 1), '#e9dcc4', -1.4 + k * 1.4, 0.3, -2.2, 1.2, 1.5, 0.45, 0.8));
  sayc('參數很多時', '先 create 一個 data structure 放進去');
  await step(tok);                                   // 26:31 pass its pointer; the callee reads the fields
  txt(r.userData.lbl, 'register：ptr'); arrow(V3(0, 1.0, -0.5), V3(0, 0.6, -1.7), 0xa8730f);
  sayc('把 pointer 傳進去', '收到的一方就能讀裡面的值');
  await step(tok);                                   // 26:49 the OS is in kernel mode: any pointer is fine
  good('OS 在 kernel mode：任何 pointer 都能 access', 4.6, 2.4);
  sayc('OS 有所有權限', '已在 kernel mode，任何 pointer 都不會被擋');
  await step(tok);                                   // 26:52 3. the stack
  hd('③ stack', 0, 2.6, 1.6);
  const st = []; for (let k = 0; k < 3; k++) st.push(bx('', '#d8cfc0', -2.4, 0.25 + k * 0.42, 1.8, 1.2, 0, 0.38, 0.7));
  sayc('最後一種：stack', '每個 process 都有一塊 stack');
  await step(tok);                                   // 27:11 push in, pop out
  for (let k = 0; k < 2; k++) { const b = bx('p' + (k + 1), COL.user, -2.4, 3.0, 1.8, 1.0, 0, 0.36, 0.6); await slide(tok, b, -2.4, 1.51 + k * 0.42, 1.8, 400); }
  sayc('呼叫方 push 進去', '被呼叫的一方 pop 出來');
  await step(tok);                                   // 27:49 (figure) pointer X in a register → the table
  sm('圖：pointer X 放 register → 找到 table', 0, -0.6, 1.0);
  sayc('圖上就是：把 pointer X 放 register', '就知道資料放在哪');
  await step(tok);                                   // 28:05 check which one homework 1 uses
  note('作業一用的是哪一種？demo 可能會問', 0, 5.4);
  sayc('看看作業一的實作', '用的是三種裡的哪一種');
  await step(tok);                                   // 28:32 the main point: system call vs API
  hot('重點：system call 和 API 的差別', 0, 6.0);
  sayc('本講最重要的：', '清楚知道 system call 和 API 的不同');
  void u; void os; void tbl; void st;
}]);

// ════════ _RxbSP6hjqU（第 5D 講 OS Structure：simple、layered、microkernel、modular、kernel module） ════════
// 0:01 使用者要的 vs 系統設計者要的
FRAG.push(['osB-os-goals', 'OS 設計目標：使用者 vs 系統設計者', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 2.2, 0]);
  await step(tok);                                   // 0:01 the last part: OS structure
  hot('OS structure：作業系統自己的軟體架構', 0, 5.6);
  sayc('最後一塊：OS structure', '作業系統本身的軟體架構');
  await step(tok);                                   // 0:04 many kinds, from simple to virtual machine
  ['simple', 'layered', 'microkernel', 'modular', 'VM'].forEach((n, k) => pkt(n, -4.8 + k * 2.4, 4.9));
  sayc('有非常多種', '從最 simple 的到現在熱門的 virtual machine');
  await step(tok);                                   // 0:46 what users want ≠ what the system sees
  const u = pal('使用者', '', COL.user, -3.6, 0, 0.8), d = pal('系統設計者', '', COL.os, 3.6, 0, 0.8);
  sayc('使用者要的東西', '往往跟系統看的不一樣');
  await step(tok);                                   // 1:20 users: easy to use, convenient
  const U = (t, y) => good(t, -3.6, y);
  U('easy to use、convenient', 2.4);
  sayc('使用者覺得好的 OS：', '第一，easy to use、方便');
  await step(tok);                                   // 1:24 reliable
  U('reliable：不能隨時 crash', 2.95);
  sayc('第二，要很 reliable', '不能隨時 crash');
  await step(tok);                                   // 1:31 the blue screen joke
  bad('早期的 blue screen', -6.0, 1.4);
  sayc('早期 OS 常常 blue screen', '變成一個笑話');
  await step(tok);                                   // 1:40 safe, secure
  U('safe / secure：不被入侵', 3.5);
  sayc('再來是 safe、security', '電腦不能隨便被入侵');
  await step(tok);                                   // 2:04 fast — interactive fast
  U('fast：interactive 的快', 4.05);
  sayc('還要快：是 interactive 的快', '手機點下去就要有反應');
  await step(tok);                                   // 2:34 designers: easy to design…
  const D = (t, y) => hd(t, 3.6, y);
  D('easy to design', 2.4);
  sayc('系統這邊要的不是 easy to use', '而是 easy to design');
  await step(tok);                                   // 2:34 …easy to debug, easy to implement & maintain
  D('easy to debug / implement / maintain', 2.95);
  sayc('easy to debug、easy to implement', '寫太複雜就很難抓 bug、很難 maintain');
  await step(tok);                                   // 2:56 kernel code must be bug-free; efficient
  D('reliable（kernel 不能有 bug）、efficient', 3.5);
  sayc('也要 reliable：kernel code 不能有 bug', 'efficient 指系統本身的運作');
  await step(tok);                                   // 3:09 users need convenience; designers need maintainability
  note('使用者要「用」得方便　系統要「維護、實作」得方便', 0, -0.8, 1.0);
  sayc('最大差別：使用者要用得方便', '系統要維護、實作得方便');
  void u; void d;
}]);

// 3:27 simple OS：MS-DOS
FRAG.push(['osB-simple-os', 'Simple OS（MS-DOS）：沒有架構', async (tok) => {
  fresh([0, 4.6, 13], [0, 2.0, 0]);
  await step(tok);                                   // 3:27 the first generation of OS
  hd('第一代 OS', 0, 5.4);
  sayc('第一代、最早期的 OS', '不管多複雜，架構就像這樣');
  await step(tok);                                   // 3:40 MS-DOS is the representative
  hot('MS-DOS：最簡單的架構', 0, 4.8);
  sayc('代表：Microsoft 的 MS-DOS', '最簡單架構的 OS');
  await step(tok);                                   // 3:53 the bottom: drivers
  const drv = bx('device driver', '#8a94a6', 0, 0.3, 0, 7.0, 2, 0.6, 1.4);
  sayc('最下層一定要有 driver', '因為有 I/O device');
  await step(tok);                                   // 4:01 BIOS drivers and software drivers
  bx('ROM BIOS driver', '#9aa3ad', -2.0, 0.95, 0, 3.0, 2, 0.6, 1.2); bx('software driver', '#9aa3ad', 2.0, 0.95, 0, 3.0, 2, 0.6, 1.2);
  sayc('有 BIOS 的 driver', '也有 software 的 driver');
  await step(tok);                                   // 4:13 the real OS: the resident system program
  const os = bx('', COL.os, 0, 1.85, 0, 7.0, 2, 1.1, 1.4);
  tag('resident system program', 'val', 0, 2.15, 0.75);
  bx('application', COL.user, 0, 2.75, 0, 7.0, 2, 0.6, 1.4);
  sayc('真正的 OS：resident system program', '一言以蔽之，所有事情都在裡面');
  await step(tok);                                   // 4:21 everything piled in, no structure
  for (let k = 0; k < 6; k++) pkt(['memory', 'I/O', 'file', 'sched', 'shell', '…'][k], -3.0 + k * 1.2, 1.5, 0.9);
  sayc('它沒有分：所有東西都堆在裡頭', '怎麼 call 隨便你，沒定義');
  await step(tok);                                   // 4:27 quick to develop then
  good('開發很快，當時系統沒那麼複雜', -4.4, 3.4);
  sayc('當時開發可能很快', '會動就好，user-friendly 比較重要');
  await step(tok);                                   // 4:51 the only structure: drivers split from the OS
  glow(drv, GOLD); good('唯一的架構：driver 跟 OS 切開（可 plug-in）', 3.4, 3.4);
  sayc('唯一的架構：driver 跟 OS 切開', 'driver 是一層，可以 plug-in 新 device');
  await step(tok);                                   // 5:06 very unsafe
  bad('非常不安全', 0, 3.9, 1.0);
  sayc('問題很明顯：', '非常不安全');
  await step(tok);                                   // 5:20 the '90s: worms, easy to exploit
  icon('🐛', '90 年代：worm、病毒', -5.0, 1.0, 1.2, 'sm');
  sayc('90 年代那麼多 bug、worm', '定義不清楚，很容易被鑽漏洞');
  await step(tok);                                   // 5:29 very hard to maintain
  bad('很難 maintain', 0, 4.4, 1.0);
  sayc('而且非常難 maintain');
  await step(tok);                                   // 5:39 one company, total control — OK-ish
  sm('單一公司 total control → 還好', -4.4, 4.4);
  sayc('Microsoft 是單一公司', 'total control，所以還好');
  await step(tok);                                   // 5:52 open source communities can't co-work like this
  const cs = [0, 1, 2].map((k) => pal('', '', JOBC[k], 3.4 + k * 1.2, 2.4, 0.4));
  bad('open source：改一處影響所有人', 4.6, 1.3, 2.4);
  sayc('現在講 open source、community', '這種架構改一處就影響所有人，沒法 co-work');
  void os; void cs;
}]);

// 6:33 layered OS
FRAG.push(['osB-layered', 'Layered OS：只能往下 call', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 2.4, 0]);
  await step(tok);                                   // 6:33 the layered OS architecture
  hot('layered OS architecture', 0, 6.2);
  sayc('很快有人提出', 'layer 的 OS architecture');
  await step(tok);                                   // 6:39 the OS is a very big program
  const big = bx('OS：很大很大的 program', COL.os, 0, 0.6, 0, 7.0, 0, 1.2, 1.4);
  sayc('OS 是一個', '很大很大的 program');
  await step(tok);                                   // 6:41 with many subsystems
  gone(big);
  const subs = ['memory', 'I/O driver', 'process', 'CPU scheduling', 'hardware'].map((n, k) => bx(n, JOBC[k % 5], -4.4 + (k % 3) * 4.4, 0.3 + Math.floor(k / 3) * 1.0, 0, 3.0, 2, 0.6, 1.0));
  sayc('裡面有非常多 subsystem', 'memory、I/O driver、process、CPU scheduling…');
  await step(tok);                                   // 7:13 they depend on each other
  sayc('它們很複雜', '而且互相依賴彼此');
  await step(tok);                                   // 7:22 virtual memory uses the disk: memory calls I/O
  const a1 = arrow(V3(-3.0, 0.4, 0.6), V3(-0.9, 0.4, 0.6), 0x2fc092); sm('virtual memory 用 disk → memory call I/O', -2.0, -0.4, 0.8);
  sayc('virtual memory 用 disk 當儲存', '所以 memory 要 call I/O');
  await step(tok);                                   // 7:30 and I/O calls memory too
  const a2 = arrow(V3(-0.9, 0.2, 0.6), V3(-3.0, 0.2, 0.6), 0xe55a9b);
  sayc('I/O 難道不 call memory？', '也會：想少做 memory copy 就要用 memory management');
  await step(tok);                                   // 7:59 cut into layers; the innermost is layer 0
  gone(...subs); remove(a1); remove(a2);
  const Ls = []; for (let i = 0; i < 4; i++) { Ls.push(bx('layer ' + i, ['#8a94a6', COL.cpu, COL.gold, COL.user][i], 0, 0.32 + i * 0.7, 0, 7.0 - i * 1.2, 2, 0.6, 1.4)); }
  sm('（最 low level）', 4.6, 0.32);
  sayc('強硬地切成一層一層', '最核心、最 low level 的叫 layer 0');
  await step(tok);                                   // 8:02 outer can call inner, inner can't call outer
  arrow(V3(-1.6, 2.5, 0.8), V3(-1.6, 0.6, 0.8), 0x2fc092); good('外 → 內 ✓', -2.8, 2.9);
  arrow(V3(1.6, 0.6, 0.8), V3(1.6, 2.5, 0.8), 0xd64545); bad('內 → 外 ✗', 2.8, 2.9);
  sayc('上面的可以 call 裡面的', '裡面的不能 call 外面的');
  await step(tok);                                   // 8:27 e.g. memory can't call I/O (higher layer)
  sm('例：memory 不能 call 比較高層的 I/O', 0, 3.5);
  sayc('例如 memory 不能 call I/O', '因為 I/O 在比較高的 layer');
  await step(tok);                                   // 8:42 layer N calls only layers 0..N-1
  hot('layer N 只能 call layer 0 ～ N−1', 0, 4.1);
  sayc('layer N 可以 call', '任何 layer 0 到 N−1 的 function');
  await step(tok);                                   // 8:51 easy to debug and maintain
  good('好處：容易 debug、maintain', -4.6, 4.7);
  sayc('好處：非常容易', 'debug 跟 maintain');
  await step(tok);                                   // 8:56 test layer by layer
  for (let i = 0; i < 4; i++) { glow(Ls[i], GREEN); await wt(tok, 250); }
  sayc('可以一層一層 test', '這層 OK，下面就一定 OK');
  await step(tok);                                   // 9:41 defining the layers is arbitrary
  bad('缺點：layer 很難定義（I/O、memory 互相 call）', 4.0, 4.7);
  sayc('缺點：define layer 很 arbitrary', 'I/O、memory 互相 call，到底怎麼切？');
  await step(tok);                                   // 10:01 performance is worse
  bad('效能比較差：一層一層往下 call', 4.0, 5.3);
  sayc('效能比較差', '要一層一層往下 call');
  await step(tok);                                   // 10:20 like networking: package / unpack
  for (let i = 3; i > 0; i--) await fly(tok, 'pkt', 'pack', V3(-4.4, 0.32 + i * 0.7 + 0.4, 0.8), V3(-4.4, 0.32 + (i - 1) * 0.7 + 0.4, 0.8), 260);
  sayc('像網路 socket 那樣', '一層層 package、unpack，很多 memory copy');
  await step(tok);                                   // 10:45 early Linux was more like this
  sm('早期 Linux 比較像 layered', 0, -0.5, 1.0);
  sayc('這是傳統的 layer', '早期 Linux 比較像這樣');
}]);

// 11:03 microkernel
FRAG.push(['osB-microkernel', 'Microkernel：kernel 越小越好', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 2.0, 0]);
  for (const zn of [zone('user space', 0, 0, -0.6, 13.0, 2.4, '#e3f3ea'), zone('kernel space', 0, 0, 2.2, 13.0, 1.6, '#ece4fb')]) { const l = zn.userData.name; l.center.set(1, 0.5); l.position.x = -6.6; }
  await step(tok);                                   // 11:03 a very interesting idea: microkernel
  hot('microkernel', 0, 5.4);
  sayc('研究界提出一個很有趣的概念', 'microkernel');
  await step(tok);                                   // 11:09 from Carnegie Mellon (Mach)
  sm('Carnegie Mellon 提出（Mach）', 0, 4.8);
  sayc('Carnegie Mellon', '設計 OS 架構時提出的');
  await step(tok);                                   // 11:20 kernel code: the less the better
  const k = bx('micro kernel', COL.os, 0, 0.3, 2.2, 2.4, 2, 0.6, 1.0);
  sayc('kernel 的程式碼', '應該越少越好');
  await step(tok);                                   // 11:28 more reliable
  const relG = good('比較 reliable：只要那一點 code 沒 bug', 0, 1.55, 2.2);
  sayc('第一：比較 reliable', '只要那一點 code 沒 bug，其他有 bug 無所謂');
  await step(tok);                                   // 11:36 modularised
  const mods = ['file system', 'memory mgr', 'device driver', 'graphics'].map((n, i) => bx(n, JOBC[i], -4.8 + i * 3.2, 0.3, -0.6, 2.6, 2, 0.6, 0.9));
  sayc('第二：modulize 的概念', '每個 subsystem 變成一個 module');
  await step(tok);                                   // 11:49 the kernel only handles messages between modules
  sm('kernel：只負責 module 之間的溝通、interface', 0, 2.95, 2.2);
  sayc('kernel 只負責 module 之間', '怎麼傳輸、handle fail、interface');
  await step(tok);                                   // 12:04 replace e.g. memory management: rewrite one module
  await anim(tok, 700, (u) => { mods[1].position.y = 0.3 + u * 1.6; mods[1].position.z = -0.6 - u * 1.6; });
  const nm = bx('new memory mgr', COL.gold, -1.6, 2.3, -2.4, 2.6, 0, 0.6, 0.9); await slide(tok, nm, -1.6, 0.3, -0.6, 700);
  gone(mods[1]);
  sayc('想換 memory management？', '重寫那個 module、hook 上去就好');
  await step(tok);                                   // 12:44 they live in user space
  hot('OS 元件都在 user space', -4.4, 1.6);
  sayc('嚴謹的定義：kernel 外面的', 'graphics、I/O manager 全在 user space');
  await step(tok);                                   // 12:56 a crash is fine as long as the kernel lives
  remove(relG);
  bad('crash', 4.8, 1.3, -0.6); good('kernel 沒事就好', 0, 1.9, 2.2);
  sayc('像 user program 一樣', '它 crash 沒關係，kernel 不 crash 就好');
  await step(tok);                                   // 13:22 portable, easy to extend
  good('容易 portable、容易 extension', 4.4, 4.2);
  sayc('所以很容易 portable', '非常容易做 extension');
  await step(tok);                                   // 13:37 but performance is even worse
  bad('缺點：效能更差', -4.4, 4.2);
  sayc('缺點很明顯：', '效能比 layered 又更差一點');
  await step(tok);                                   // 14:07 every message between subsystems is a system call
  for (let r = 0; r < 2; r++) { await fly(tok, 'bad', 'system call', V3(-4.8, 0.9, -0.6), V3(0, 0.9, 2.2), 380); await fly(tok, 'bad', 'system call', V3(0, 0.9, 2.2), V3(1.6, 0.9, -0.6), 380); }
  sayc('subsystem 之間每次溝通都經過 kernel', '全部都是 system call，非常慢');
  await step(tok);                                   // 14:21 and message passing → memory copies
  sm('message passing → memory copy', 0, 3.5, 2.2);
  sayc('為了避免 synchronization', '用 message passing，要 memory copy，更慢');
  await step(tok);                                   // 14:49 IoT / embedded systems head this way
  icon('📟', 'IoT / embedded', 5.6, 3.2, 0.8, 'sm');
  sayc('聽說新的 IoT、embedded system', '有些往這個方向走');
  await step(tok);                                   // 15:01 Mac mixes in some microkernel ideas
  sm('Mac：部分採用 microkernel 概念（混合）', 0, 6.0);
  sayc('也有混合的', '像 Mac 有部分 microkernel 的概念');
  void k;
}]);

// 15:31 modular OS 與 loadable kernel module
FRAG.push(['osB-modular', 'Modular OS 與 loadable kernel module', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 2.2, 0]);
  { const l = zone('kernel space', 0, 0, 0, 13.0, 3.0, '#ece4fb').userData.name; l.center.set(1, 0.5); l.position.x = -6.6; }
  await step(tok);                                   // 15:31 the fourth: modular OS (Linux today)
  hot('modular OS（現在的 Linux）', 0, 5.6);
  const core = bx('core kernel', COL.os, 0, 0.35, 0, 2.4, 2, 0.7, 1.2);
  sayc('第四種：modular OS', '現在 Linux 這些基本上都是');
  await step(tok);                                   // 15:45 like OO
  sm('像 OO 的概念', 0, 4.9);
  sayc('就像 OO（物件導向）', '系統也應該用 OO 的概念寫');
  await step(tok);                                   // 16:00 subsystems with well-defined interfaces
  const MP = [[-3.4, 1.3, -1.0], [3.4, 1.3, -1.0], [-3.4, 0.3, 1.0], [3.4, 0.3, 1.0]];
  const mods = ['file system', 'scheduler', 'driver', 'memory'].map((n, i) => bx(n, JOBC[i], MP[i][0], MP[i][1], MP[i][2], 2.4, 2, 0.6, 0.8));
  sayc('變成一堆 subsystem', '每個都 define 好它的 interface');
  await step(tok);                                   // 16:09 unlike microkernel: all in kernel space
  const ksG = good('全部都在 kernel space', 0, 2.4);
  sayc('跟 microkernel 唯一的不同：', '全部都在 kernel space');
  await step(tok);                                   // 16:26 no message passing needed
  const mpG = good('溝通不需要 message passing', 0, 3.0);
  sayc('所以溝通時', '不需要透過 message passing');
  await step(tok);                                   // 16:35 'modular' means loadable
  const lm = bx('new module', COL.gold, 5.6, 3.4, 0, 1.8, 0, 0.6, 0.8); await slide(tok, lm, 6.0, 0.3, 2.2, 800);
  sayc('modular 的意思是 loadable', '可以 load kernel module 進去改變 OS 的 feature');
  await step(tok);                                   // 16:58 you can write one in an hour
  const hourN = note('照步驟，一小時就能寫一個 kernel module', -4.0, 4.1);
  sayc('非常鼓勵大家試試', '照步驟一小時就能寫一個自己的 kernel module');
  await step(tok);                                   // 17:29 the system call table
  gone(...mods, lm, ksG, mpG, hourN);
  const tbl = []; for (let i = 0; i < 5; i++) tbl.push(bx(i < 3 ? ['open', 'read', 'write'][i] : '（空）', i < 3 ? '#e8dcc4' : '#f4efe6', -3.6, 3.2 - i * 0.55, 0, 2.0, 0, 0.45, 0.7));
  hd('system call table', -3.6, 3.9);
  sayc('system call 一樣有一個 table', '（hardware signal 的是 interrupt vector）');
  await step(tok);                                   // 17:34 some entries are reserved, empty
  glow(tbl[3], GOLD); glow(tbl[4], GOLD);
  sayc('跟改 Nachos 一樣', 'table 本來就 reserve 了一些空的 entry');
  await step(tok);                                   // 17:41 insert module = modify an entry (admin)
  const insP = pkt('insmod（要 admin 權限）', 0, 2.4);
  sayc('用 administrator 權限 insert module', '就是去改這個 table 的 entry');
  await step(tok);                                   // 17:48 define new system calls
  txt(tbl[3].userData.lbl, 'my_call'); tint(tbl[3], COL.gold);
  sayc('所以可以定義', '新的 system call');
  await step(tok);                                   // 17:52 most common: replace an existing one (open)
  txt(tbl[0].userData.lbl, 'my_open'); tint(tbl[0], COL.gold);
  sayc('最常見的其實是 replace', '例如 override open 那個 entry');
  await step(tok);                                   // 18:07 print the file name, then call the original
  remove(insP);
  const myo = bx('my_open：print file name', COL.gold, 2.6, 2.6, 0, 3.4, 0, 0.5, 0.8);
  const org = bx('原本的 open', COL.os, 2.6, 1.4, 0, 3.4, 0, 0.5, 0.8);
  arrow(V3(-2.5, 3.2, 0.2), V3(0.8, 2.6, 0.2), 0xa8730f); arrow(V3(2.6, 2.3, 0.4), V3(2.6, 1.7, 0.4), 0xa8730f);
  sayc('第一行偷偷印出 file name', '再 call 原來的 function，不影響系統運作');
  await step(tok);                                   // 18:41 intercept the system call
  hot('攔截 system call', 2.6, 3.4);
  sayc('就能攔截那個 system call', '然後接回去');
  await step(tok);                                   // 18:44 for profiling, debugging…
  good('profiling、debugging…', 2.6, 0.5);
  sayc('拿來做 profiling', 'debugging 或其他事情');
  void core; void myo; void org;
}]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '作業系統・第 1 章',
    title: 'OS 概論',
    color: 'var(--os)',
    modes: [
      { id: 'gen', name: '演進：Batch → Time sharing', enter: enterGen },
      { id: 'intr', name: '中斷與 trap', enter: enterIntr },
      { id: 'dual', name: 'Dual mode', enter: enterDual },
      { id: 'storage', name: '儲存階層', enter: enterStorage },
      { id: 'struct', name: 'OS 結構', enter: enterStruct },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: [
      'batch-idle', 'multiprog-overlap', 'spooling', 'job-cpu-sched', 'time-sharing', 'ts-needs', 'os-generations',
      'realtime-edf', 'hard-soft-rt', 'special-systems',
      'controller-buffer', 'busy-wait', 'interrupt-timeline', 'interrupt-io-flow', 'signal-vs-trap', 'interrupt-vector', 'trap-switch', 'interrupt-mask', 'dma',
      'storage-hierarchy', 'memory-boundary', 'dram-sram',
      'dual-mode', 'nachos-vm', 'nachos-folders', 'nachos-fs-stub',
      'os-services', 'shell-layer', 'syscall-flow', 'ipc-two-models', 'os-structures',
    ].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); modeGen++; },
  };
}
