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
    tag('↑ volatile（斷電就沒了）', 'ptr', 4.6, tierY(2) - 0.2, 0.8);
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
      move(c, 2.5 - (2 - i) * 1.2, tierY(i), 1);
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
    const n = cube('notify!', COL.bad, [1.2, 0.4, 0.4], 4.4, 2.2, 0.8); move(n, -4.2, 2.2, 0.8);
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
    for (const [n, x, d, c] of C) {
      cube(n, c, [2.8, 1.2, 1], x, 0.6, 0, 4);
      tag(d, 'idx', x, 1.6 + (x < 0 ? 0 : 0.5));
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
      const hw = k === 'hw', x = hw ? -4.6 + (nh % 2) * 2.4 : 2.2 + (ns % 2) * 2.4, z = hw ? -0.8 + Math.floor(nh / 2) * 1.1 : -0.8 + Math.floor(ns / 2) * 1.1;
      cube(n, hw ? COL.cpu : COL.io, [2.2, 0.5, 0.8], x, 0.3, z, 4);
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
    tag('interrupt vector：array of function pointers', 'ptr', 1.6, 6.3);
    const V = ['divide error', 'timer', 'keyboard', 'mouse', 'disk'].map((n, i) => { tag('[' + i + ']', 'idx', -0.6, 5.6 - i * 0.55); return cube('→ ' + n + '_handler（4 bytes）', '#e9dcc4', [3.6, 0.45, 0.8], 1.6, 5.6 - i * 0.55, 0); });
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
    move(sig, -0.6, 5.6 - 3 * 0.55, 1.2); glow(V[3], GOLD);
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
    const r = cube('open', COL.cpu, [0.9, 0.4, 0.5], -3.6, 5.6, 0.8);
    move(r, -3.6, 4.4, 0.8); say('API 函式幫你準備參數、放 system call number', '可移植：換平台不用改程式'); await W(tok, 2200);
    move(r, 0, 3.0, 0.8); txt(mode, 'mode bit = 0'); say('trap 進 kernel：system call interface', 'mode bit 1 → 0'); await W(tok, 2200);
    glow(tbl[3], GOLD); move(r, 2.6 + 3 * 0.65, 2.1, 0.8); say('用 number i 查 system call table', ''); await W(tok, 1800);
    move(r, 3.9, 0.9, 0.8); glow(impl, GOLD); say('執行 kernel 裡的 open()', '參數：放 register、放 memory block 傳位址、或 push stack'); await W(tok, 2600);
    glow(impl, null); glow(tbl[3], null);
    move(r, -3.6, 5.6, 0.8); txt(mode, 'mode bit = 1'); say('回傳 status / fd，mode bit 回到 1', 'API ≠ system call'); await W(tok, 3000);
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
  A(note('C', -5.2, 4.6)); A(note('物件導向（OO）', -3.2, 4.6));
  say('Nachos 是用 C++ 寫的', '');
  await step(tok);                                   // 593 C background + OO idea = C++
  const plus = A(tag('＋', '', -4.4, 4.6));
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
  pkt('printf', 3.2, 1.6);
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
  const mem = A(blk('memory', '#efe6d6', -1, 1.1, 0, 2.2, 2.2, 1.2));
  const os = A(blk('OS', COL.os, -1, 0.35, 0.65, 2.0, 0.5, 0.2));
  const cpu = A(prop('cpu', 2.2, 0, 0, 1.1, 'CPU'));
  say('最早的電腦系統：batch', '這個字到現在還很常用');
  await step(tok);                                   // 44 one job at a time
  const J = [1, 2, 3].map((k) => A(pal('Job ' + k, '', JOBC[k - 1], -6.2 + (k - 1) * 0.9, 1.6 - (k - 1) * 0.9, 0.6)));
  J[1].mood('sad'); J[2].mood('sad');
  say('Batch：一次只處理一個 job', '後面的 job 只能排隊');
  await step(tok);                                   // 52 OS barely does anything: load the program into memory
  await slide(tok, J[0].g, -1, 0, 1.6, 700);
  J[0].mood('happy');
  say('OS 幾乎不用做事', '把程式 load 進 memory，讓 CPU 執行');
  void mem; void os; void cpu;
  await step(tok);                                   // 68 read the cards in, print the output
  const pr = A(prop('printer', 5, 0, 0, 1, 'printer'));
  await send(tok, '卡片（input）', 'pkt', V3(-5.6, 3.6, 0), V3(-1, 2.6, 0), 700);
  await send(tok, '結果（output）', 'pkt', V3(-1, 2.6, 0), V3(5, 1.4, 0), 700);
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
  const cpu = prop('cpu', 4.8, 0, 1.6, 1.1, 'CPU');
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
  bub('永遠有人要用 CPU', 4.8, 2.6, 1.6);
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
  await travel(tok, f, V3(4.4, 1.6, 0), V3(0.4, 1.6, -1.4), 2200);
  say('例：從 disk 搬 1 GB 的檔案到 memory', '搬很久，這段時間 CPU 去做自己的事');
  await step(tok);                                   // 403 notify the CPU when done
  await send(tok, 'notify！', 'bad', V3(4.4, 2.6, 0), V3(-4.4, 2.6, 0), 800, true);
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
  zone('memory', 0, 0, 0, 3.6, 3.2, '#f3e6c8');
  blk('OS', COL.os, 0, 0.3, -1, 3, 0.5, 0.8);
  const inMem = [0, 1, 2, 3].map((k) => blk('Job ' + (k + 1), JOBC[k], -0.9 + (k % 2) * 1.8, 0.3, 0.1 + Math.floor(k / 2) * 0.8, 1.5, 0.5, 0.7, 2));
  say('memory 裡除了 OS，還有 Job 1、2、3、4', '');
  await step(tok);                                   // 512 the CPU can only read memory
  zone('CPU cores', 4.8, 0, 0, 2.8, 3.2, '#d6e6f6');
  prop('cpu', 4.8, 0.05, 1.0, 0.8);
  arrow(V3(1.9, 1.2, 0), V3(3.5, 1.2, 0), 0x6e5f49);
  say('CPU 只能讀 memory', '要執行，得先 load 進 memory');
  await step(tok);                                   // 539 programs start on disk
  zone('disk', -4.8, 0, 0, 2.8, 3.2, '#d8e6cf');
  const onDisk = [];
  for (let k = 0; k < 6; k++) onDisk.push(blk('P' + (k + 5), JOBC[(k + 4) % 5], -5.5 + (k % 2) * 1.4, 0.3, -1 + Math.floor(k / 2) * 0.8, 1.2, 0.5, 0.6));
  say('寫好、compile 好的程式，一開始在 disk', '');
  await step(tok);                                   // 555 which programs to load? memory is limited
  bub('memory 有限：先 load 誰？', -4.8, 2.4);
  say('第一個決定：load 哪些 program 進 memory', '早期、embedded 裝置的 memory 有限');
  await step(tok);                                   // 592 how much memory for each job → memory management
  inMem.forEach((m, k) => { m.scale.x = [0.7, 1, 0.8, 0.6][k]; });
  hot('memory management', 0, 2.6);
  say('每個 job 分多少 memory？還會動態配置', '→ memory management');
  await step(tok);                                   // 615 CPU cores are even fewer (64 is a lot)
  note('core 更少：64 個就很了不起', 4.8, 3.4);
  say('CPU core 的數量更有限', 'memory 裡卻可能有幾百個 job');
  await step(tok);                                   // 641 which job runs on a core → CPU scheduling
  await slide(tok, inMem[0], 4.8, 0.9, -0.6, 600);
  hot('CPU scheduling', 4.8, 2.6);
  say('挑哪個 job 上 CPU：CPU scheduling', '作業三會實作基本的演算法');
  await step(tok);                                   // 660 disk → memory: job scheduling
  await slide(tok, onDisk[0], -0.9, 0.85, 0.9, 600);
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
  bub('I/O 裝置上的小 chip 幫忙', -4.8, 1.4, 2.2);
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
  const os = pal('RT OS', '⏱', COL.os, -5, 0, 1);
  say('第一種：real-time 的 OS 或電腦系統', '非常非常重要');
  await step(tok);                                   // 74.2 people think: real-time = very fast
  const q = A(talk(os, '要很快、很即時？'));
  os.mood('wow');
  say('大家可能以為 real-time = 很快、很即時', '');
  await step(tok);                                   // 84.2 definition is the opposite: slow is fine, finish before the deadline
  A.clear();
  A(bad('越快越好 ✗', -2.2, 4.8)); A(good('在 deadline 前做完 ✓', 2.2, 4.8));
  os.mood('happy');
  say('定義其實相反：多慢都沒關係', '但要在 deadline 之前做完');
  void q;
  await step(tok);                                   // 94.6 each job has a deadline
  const unit = 0.85, x0 = -3.4;
  const T = [['作業 A', 3, 9], ['作業 B', 2, 4], ['作業 C', 2, 6]];
  for (const [n, , dl] of T) { line(x0 + dl * unit, 0.6, 0, x0 + dl * unit, 3.6, 0, '#d64545'); idx(n.slice(-1) + ' 的 deadline', x0 + dl * unit, 3.9); }
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
  note('直覺、有效，但不保證不 miss', 0, 5.4);
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
  bad('死背名詞 ✗', -3, 5.2); good('懂設計考量、和一般系統的差別 ✓', 2.4, 5.2);
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
  const tri = T.map(([n, v, c, x]) => pal(n, v, c, x, 2.6, 0.85));
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
  hot('Protection / Security', 4.8, 1.4);
  say('後面的 part，例如 protection、security', '有興趣可以自己看');
  await step(tok);                                   // 420 a system without security = a house anyone breaks into
  const house = prop('warehouse', 3.6, 0, 2.6, 1);
  const thief = pal('入侵者', '', '#5d6b7a', 6.2, 2.6, 0.6);
  thief.mood('happy');
  await slide(tok, thief.g, 4.9, 0, 2.6, 800);
  bad('沒有 security → 誰都能 break in', 3.6, 2.5, 2.6);
  say('把系統想成一個家', '沒有 security，別人可以隨便闖進來');
  void house;
}]);

// 7:23 distributed and special-purpose systems; chapter 0
FRAG.push(['osA-dist', '分散式系統與 special-purpose 系統', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 2.2, 0]);
  const A = bag();
  await step(tok);                                   // 443 distributed systems
  hd('分散式系統（distributed system）', 0, 6.2);
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
  A(bad('沒有作業：跑一次 ≠ 證明正確', -3, 1.6));
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
  const memL = blk('memory', '#efe6d6', 2.6, 1.4, 0, 2.4, 2.8, 1.2);
  void memL;
  await send(tok, '程式', 'pkt', V3(-4.6, 0.92, 0.6), V3(2.6, 0.9, 0.7), 800, true);
  say('Load 卡：把 compile 好的程式 load 進 memory', 'CPU 讀不到硬碟，只能 access memory');
  await step(tok);                                   // 980 run; input arrives as more cards
  showCard(3);
  say('開始執行；input 也是一疊卡片', '就像現在在 keyboard 上打字');
  await step(tok);                                   // 996 the result comes out as another card
  await send(tok, '結果卡', 'pkt', V3(2.6, 2.4, 0.7), V3(5.8, 3.6, 0.7), 700, true);
  say('結束時 output 另一張卡片：結果', '架構跟現在的電腦一樣');
  await step(tok);                                   // 1015 memory split in two: OS on top, user below
  blk('OS', COL.os, 2.6, 2.4, 0.66, 2.2, 0.7, 0.1);
  blk('user 的空間', COL.user, 2.6, 1.0, 0.66, 2.2, 1.6, 0.1);
  say('memory 只拆兩塊：上面 OS、下面 user', 'OS 本身也是程式，也要佔 memory');
  await step(tok);                                   // 1045 done → flush, next user
  bad('用完整個清掉，換下一個人', 2.6, 3.6);
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
  good('①③ → Multiprogramming：塞很多 program', -2.4, 2.6, 1.2);
  say('第一、第三個問題 → multiprogramming', '塞很多 program，讓 CPU 不 idle');
  await step(tok);                                   // 1363.9 interaction → time sharing: switch very fast
  good('② → Time sharing：很快很快地切換', 2.4, 2.6, 1.2);
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
  bub('點了要等好幾秒？不滿意！', 2.6, 2.4, 0.8);
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
  A(idx('原因二：當初沒想到 Internet', 3.6, 1.6, 1.6));
  say('最主要原因：當初的 PC 沒想到 Internet', '只要使用者不破壞自己的電腦就好');
  await step(tok);                                   // 332 now everything is online: unexpected outside users
  const bad1 = pal('外來者', '', '#5d6b7a', 5.8, 2.4, 0.6);
  await slide(tok, bad1.g, 3.6, 0, 2.4, 900);
  glow(pc.children[1], RED);
  say('現在都連網：沒授權、你沒預期的使用者', '也能透過網路修改你的東西');
  await step(tok);                                   // 350 news: Taiwan's ATMs got malware and spat out cash
  A(note('新聞：ATM 被植入病毒，自動吐鈔', 0, -0.6, 1.4));
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
  const v = pkt('x = 5', -2, 1.1, 0.7);
  say('所有 core 上的程式', '都看到相同的 memory content');
  await step(tok);                                   // 488 modify at the same time → synchronization
  await send(tok, 'x = 6', 'bad', V3(-3.6, 3, 0.6), V3(-2.4, 1.3, 0.7), 500);
  await send(tok, 'x = 7', 'bad', V3(3.6, 3, 0.6), V3(-1.6, 1.3, 0.7), 500);
  txt(v, 'x = ?'); glow(mem, RED);
  say('同時去修改', '就造成 synchronization 的問題');
  await step(tok);                                   // 507 even a single CPU chip is multi-core
  glow(mem, null); txt(v, 'x = 5');
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
  idx('一顆 CPU chip', -3.2, 1.1, 1.4);
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
  const cp = xs.map((x) => pkt('x = 5', x, 2.2, 0.6));
  for (let k = 0; k < 2; k++) await travel(tok, cp[k], V3(0, 0.6, 2.6), V3(xs[k], 2.2, 0.6), 500);
  say('資料會被 copy 到不同 core 的 cache', '');
  await step(tok);                                   // 999 copies should hold the same content
  good('只是複製：內容應該相同', 0, 3.4);
  say('它只是複製', '所以內容應該要相同');
  await step(tok);                                   // 1007 core 0 writes: only its own cache changes
  txt(cp[0], 'x = 9'); glow(L[0], RED);
  bad('Core 0 只改到自己的 cache', -2.2, 4.2);
  say('Core 0 改寫內容時，可能只改到自己的 cache', '不同 copy 的內容就不一樣了');
  await step(tok);                                   // 1033 hardware keeps them consistent: reflect to memory / other caches
  await send(tok, 'x = 9', 'good', V3(-2.2, 2.2, 0.6), V3(0, 0.6, 2.6), 500);
  if (mem.userData.lbl) txt(mem.userData.lbl, 'memory：x = 9');
  await send(tok, 'x = 9', 'good', V3(-2.2, 2.2, 0.6), V3(2.2, 2.2, 0.6), 500);
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
  idx('核心數到幾百的等級（示意）', 0, -0.4, 1.4);
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
  hot('SIMD：Single Instruction, Multiple Data', 0, 5.6);
  say('它是 SIMD 的 processor', 'Single Instruction Multiple Data');
  await step(tok);                                   // 1256 700 processors — only one instruction at a time
  const ins = pkt('instruction：× 2', 0, 4.4);
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
  idx('hardware design 重新做過、指令處理方式不同', 0, -0.6, 2);
  say('能塞這麼多，代表 hardware design', '和指令處理方式都和傳統 CPU 不同');
  await step(tok);                                   // 215 very new and varied: GPU, Xeon Phi, Tile64
  ['GPU', 'Xeon Phi', 'Tile64'].forEach((t, k) => pkt(t, -3 + k * 3, 6.0));
  say('很新、型態多樣', 'GPU、Intel 的 Xeon Phi、Tile64');
  await step(tok);                                   // 240 Tile64: plain CPUs, but a big effort on the on-chip network
  const T = [];
  for (let k = 0; k < 4; k++) T.push(pal('', '', COL.cpu, -1.2 + k * 1.2, 2.6, 0.5));
  line(-1.2, 0.25, 2.6, 2.4, 0.25, 2.6, '#a8730f');
  idx('chip 上的 interconnect（network）', 0.6, -0.1, 3.4);
  say('Tile64 放的是傳統 CPU', '功夫下在 chip 上的 interconnect（network）');
  await step(tok);                                   // 263 otherwise congestion: you wait for me → like a single CPU
  T.forEach((b) => b.mood('sad'));
  bad('塞車：你等我、我等你 → 64 個像 1 個', 0.6, 1.6, 2.6);
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
  pkt('UMA', -2, 5.6); pkt('NUMA', 2, 5.6);
  say('multiprocessor 在 memory 這邊分兩大類', 'UMA 和 NUMA');
  await step(tok);                                   // 360.8 many CPUs must share memory
  const C = [-4.5, -1.5, 1.5, 4.5].map((x) => A(prop('cpu', x, 2.6, 0, 0.8)));
  const mem = A(blk('memory', COL.mem, 0, 0.4, 0, 6, 0.6, 1.2));
  say('一定有多個 CPU，memory 也要 share', 'CPU 越來越多時，怎麼 share？');
  void mem;
  await step(tok);                                   // 377.8 uniform: everyone plugs in the same way
  for (const x of [-4.5, -1.5, 1.5, 4.5]) A(line(x, 2.6, 0, x * 0.4, 0.7, 0, '#a8730f'));
  hot('UMA：Uniform Memory Access', 0, 4.4);
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
  ['A', 'B', 'C', 'D'].forEach((t, k) => idx('區域 ' + t, R[k][0], 1.6, R[k][1]));
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
  hot('高效能、大 scale 的電腦多半是 NUMA', 0, 6.3);
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
  A(bad('server 沒了 → 整個系統不能動', 0, 5.4));
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
  bub('大家都是 peer（同僚），角色相同', 0, 3.2);
  say('每個人都是 peer：同僚的意思', '像同修一門課的同學，沒有 master / slave');
  await step(tok);                                   // 1221 they communicate by following a protocol
  for (let k = 0; k < pos.length; k++) { const a = pos[k], b = pos[(k + 1) % pos.length]; line(a[0], 0.4, a[1], b[0], 0.4, b[1], '#a8730f'); }
  note('大家 follow 同一套 protocol', 0, 4.2);
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
  bub('魔鬼終結者的 SkyNet 就像 Internet', -3.6, 4.4);
  say('魔鬼終結者的敵人 SkyNet', '其實就是 Internet');
  await step(tok);                                   // 1357 nobody owns it and it never breaks
  note('沒有任何國家、組織在管：永遠不會 break', 3.4, 4.4);
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
  await send(tok, 'data（不經 CPU）', 'good', V3(-3, 1.5, 0.8), V3(3, 1.5, 0.8), 1200);
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
  bub('system call ＝ 使用 OS 服務的 interface', 0, 1.6);
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
  note('需要資源時才發出，暫時進 kernel mode', -3.4, 2.6);
  say('system call 在程式需要存取資源時發出', 'user mode 的程式暫時切到 kernel mode');
  await step(tok);                                   // 217.3 definition: a programmatic way to request a kernel service
  good('定義：程式向 OS kernel 請求服務的方式', 0, -0.9, 1.6);
  os.mood('happy');
  say('定義：程式向 OS 的 kernel', '請求 service 的 programmatic 方式');
  await step(tok);                                   // 239.2 usually available as routines in C / C++
  code(['open()', 'read()', 'write()'], 0.2, 2.4, 0.42, 0.6);
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
  const C = code(CPY, -2.6, 6.4, 0.38);
  C.ls.forEach((l) => { l.element.style.opacity = '0.25'; });
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
  await send(tok, '我要轉彎', 'say', V3(-5.6, 2.3, 1.2), V3(4.4, 2.3, 1.2), 900);
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
  hot('原因二：絕對不能壞、不能有 bug', 0, 5.4);
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
  A(note('Wintel ＝ Windows ＋ Intel', 0, -0.6, 1.4));
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
  zone('x86 PC', -4.2, 0, 0, 3.6, 3, '#d6e6f6');
  pkt('Windows', -5, 1.4); pkt('Linux', -3.4, 1.4);
  say('早期 x86：不外乎 Windows', '還有歷史最久的 Linux');
  await step(tok);                                   // 1946.1 users like Windows; big important systems choose Linux (open source)
  idx('一般使用者：Windows　大型重要系統：Linux', -4.2, 2.6);
  say('一般使用者喜歡 Windows', '大型、重要的系統多選 Linux：跟 open source 很有關');
  await step(tok);                                   // 1958 Apple does its own
  pkt('Apple（macOS）', -4.2, 0.6, 1);
  say('Apple 自己來', '它的作業系統比較不一樣');
  await step(tok);                                   // 1966.1 phones: Android, iOS; Windows 10 Mobile
  zone('手機', 0.2, 0, 0, 3, 3, '#e6f3df');
  pkt('Android', -0.4, 1.4); pkt('iOS', 1, 1.4); pkt('Windows 10 Mobile', 0.2, 0.6, 1);
  say('時代改變有了手機：Android、iOS', 'Windows 也改出 Windows 10 Mobile');
  await step(tok);                                   // 1987 Ubuntu has different versions too
  idx('Ubuntu 也有不同版本', 0.2, 2.6);
  say('像 Ubuntu，也會有不同版本去調整', '');
  await step(tok);                                   // 1993 embedded: very broad — the IoT era
  zone('Embedded', 4.4, 0, 0, 3.2, 3, '#f6e3d6');
  ['💡', '⌚', '🚗'].forEach((t, k) => tag(t, 'val', 3.6 + k * 0.8, 1.2));
  say('Embedded 更廣：任何嵌入式系統', '物聯網世代，什麼 device 都有');
  await step(tok);                                   // 2016.7 its OS must be flexible: drop unneeded parts quickly
  good('OS 要很 flexible：不要的拿掉', 4.4, 2.6);
  say('上面的 OS 要很 flexible', '新產品馬上裝得上，不要的部分拿掉');
  await step(tok);                                   // 2036.8 phones are embedded too, but more general
  idx('手機也算 embedded，但更 general', 0.2, -0.4, 1.6);
  say('手機也算一種 embedded', '只是更 general 一些');
  await step(tok);                                   // 2047.3 OSes bound to hardware: Xbox, PS3, PS4
  pkt('Xbox・PS3・PS4：embedded OS', 4.4, 0.4, 1.6);
  say('有些 OS 綁在 hardware 上', '像 Xbox、PS3、PS4 都有 embedded OS');
  await step(tok);                                   // 2066.3 Raspberry Pi: a board with its own OS for prototypes
  const rp = blk('Raspberry Pi', '#2fc092', 0, 0.2, 3.2, 2.6, 0.2, 1.6);
  void rp;
  note('板子 ＋ Raspberry Pi OS → 開發嵌入式雛形', 0, 1.2, 3.2);
  say('Raspberry Pi：一塊小板子，上面有它的 OS', '拿來開發各種嵌入式系統的雛形');
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
