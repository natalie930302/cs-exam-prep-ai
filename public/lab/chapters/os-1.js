// 作業系統 第1章：OS 概論（演進 batch → multiprogramming → time sharing、中斷與 trap、
// 儲存階層、dual mode、System Call、OS 結構、Nachos）。
// 場景依清大周志遠《作業系統》第 1A、2A、2D、4A、4B、5A、5B 講的段落與例子；課本＝恐龍書（Silberschatz）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
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
    ],
    stop() { stopTimer(); modeGen++; },
  };
}
