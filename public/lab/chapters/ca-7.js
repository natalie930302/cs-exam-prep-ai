// 計算機組織 第7章：I/O 與中斷（programmed I/O／polling、interrupt-initiated I/O、DMA；
// MIPS 的 exception／interrupt 處理：EPC、Cause；polling／interrupt／DMA 的 CPU 負擔；bus、handshake、bus arbitration；磁碟存取時間）。
// 影片 E82x-cug9YE（Modes of Transfer）有字幕：場景 three-modes、programmed-io、interrupt-io、pio-limits、dma、dma-pros-cons 依它的順序與內容。
// Bus Arbitration 影片沒有逐字稿；其餘場景依 Patterson & Hennessy（MIPS 版）。
export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  let timer = null;
  const stopTimer = () => { clearInterval(timer); timer = null; };

  // ───────────────────────── 共用小工具 ─────────────────────────
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', RED = '#5a1010', GRAY = '#d8cfc0';
  const MONO = { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '11px', fontWeight: '600' };
  function fresh(pos, look) { stopTimer(); lab.clear(); controls(''); lab.frameCamera(pos, look); }
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
    for (const b of lab.bodies) if (b.obj === o) { lab.removeBody(b); return; }
    lab.world.remove(o); o.traverse((c) => { if (c.element) c.element.remove(); });
  }
  const glow = (m, c) => { m.material.emissive = new THREE.Color(c || '#000000'); };
  const tint = (m, c) => { m.material.color.set(c); };
  const txt = (l, t) => { l.element.textContent = t; };
  const relabel = (m, t) => { if (m.userData.lbl) txt(m.userData.lbl, String(t)); else { m.userData.lbl = lab.label(String(t), 'val'); m.add(m.userData.lbl); } };
  const wait = (tok, ms) => (tok !== undefined ? beat(tok, ms) : sleep(ms));
  async function anim(tok, ms, fn) { const steps = 10; for (let k = 1; k <= steps; k++) { fn(k / steps); await wait(tok, ms / steps); } }
  function code(lines, x, yTop, dy = 0.5, z = 0) {
    const w = Math.max(...lines.map((s) => s.length));
    const ls = lines.map((s, i) => { const l = tag(s.padEnd(w, ' '), '', x, yTop - i * dy, z); Object.assign(l.element.style, MONO); return l; });
    return { ls, hl(i) { ls.forEach((l, k) => { l.element.className = 'lab-label' + (k === i ? ' ptr alt' : ''); }); } };
  }
  function seg(color, x0, x1, y, h = 0.5, d = 0.8, text = '') { const w = Math.max(0.04, x1 - x0); return cube(text, color, [w, h, d], x0 + w / 2, y, 0); }
  function bar(color, w, d, x, z = 0) { const m = lab.box(color, [w, 1, d]); m.scale.y = 0.001; m.position.set(x, 0, z); lab.world.add(m); return m; }
  function growBar(tok, m, h, ms) { const h0 = m.scale.y; return anim(tok, ms, (t) => { const v = Math.max(0.001, h0 + (h - h0) * t); m.scale.y = v; m.position.y = v / 2; }); }
  function setBar(m, h) { const v = Math.max(0.001, h); m.scale.y = v; m.position.y = v / 2; }
  const r2 = (x) => Math.round(x * 100) / 100;
  const pct = (x) => (x >= 1 ? r2(x) : x >= 0.01 ? r2(x) : +x.toPrecision(2)) + '%';

  // 一台 CPU、Memory、I/O 裝置的小舞台（三種傳輸方式的場景共用）
  function rig() {
    const R = {};
    R.cpu = cube('CPU', '#31aab0', [1.8, 1.2, 1.4], -4.6, 4.6, 0);
    R.mem = cube('Memory', '#c9b48e', [1.8, 1.6, 1.4], 4.6, 4.6, 0);
    R.io = cube('I/O 裝置', '#9b7ef4', [1.8, 1.2, 1.4], 4.6, 1.2, 0);
    R.bus = cube('', '#b9a98c', [11.4, 0.12, 0.3], 0, 2.9, 0);
    tag('bus', 'idx', -5.6, 2.9, 0.4);
    return R;
  }
  async function hop(tok, text, color, path, ms = 420) {
    const [x0, y0] = path[0];
    const g = cube(text, color, [0.7, 0.45, 0.6], x0, y0, 0.9);
    for (const [x, y] of path.slice(1)) { move(g, x, y, 0.9); await wait(tok, ms); }
    kill(g);
  }

  // ───────────────────────── 模式 1：三種方式的時間軸 ─────────────────────────
  // 裝置每 D cycles 準備好一個 word。PIO：CPU 一直 polling，搬一個 word 花 2 cycles。
  // Interrupt：每個 word 一次中斷，ISR 花 I cycles。DMA：設定 S cycles、每個 word 偷 1 個 bus cycle、結束時一次中斷 I。
  const CP = { n: 8, D: 20, I: 6, S: 10 };
  function timeline(o) {
    const T = o.n * o.D + 2;
    const pio = [], intr = [], dma = [];
    for (let k = 0; k < o.n; k++) { const t = (k + 1) * o.D; pio.push([k * o.D, t, 'poll'], [t, t + 2, 'xfer']); }
    for (let k = 0; k < o.n; k++) { const t = (k + 1) * o.D; intr.push([t, t + o.I, 'isr']); }
    const useI = T + o.I - o.n * o.I;
    dma.push([0, o.S, 'setup']);
    for (let k = 0; k < o.n; k++) dma.push([(k + 1) * o.D, (k + 1) * o.D + 1, 'steal']);
    dma.push([o.n * o.D + 1, o.n * o.D + 1 + o.I, 'isr']);
    const useD = T + o.I - o.S - o.n - o.I;
    return { T: T + o.I, pio, intr, dma, uP: 0, uI: useI / (T + o.I), uD: useD / (T + o.I) };
  }
  const SEGC = { poll: '#d64545', xfer: '#dd8238', isr: '#e55a9b', setup: '#9b7ef4', steal: '#c08a1f', work: '#2fc092' };
  async function drawTimeline(tok, o, animate) {
    const r = timeline(o), k = 11.4 / r.T, x0 = -5.2;
    const lanes = [['Programmed I/O（polling）', 5.4, r.pio, r.uP], ['Interrupt-initiated I/O', 3.4, r.intr, r.uI], ['DMA', 1.4, r.dma, r.uD]];
    const cur = cube('', '#3a3a3a', [0.05, 5.6, 0.05], x0, 3.4, 0.6);
    for (const [n, y, segs, u] of lanes) {
      tag(n, 'ptr', -3.6, y + 0.75);
      seg(SEGC.work, x0, x0 + r.T * k, y, 0.18, 0.6);
    }
    const all = [];
    lanes.forEach(([, y, segs], li) => segs.forEach(([a, b, t]) => all.push([a, b, t, y])));
    all.sort((p, q) => p[0] - q[0]);
    for (const [a, b, t, y] of all) {
      seg(SEGC[t], x0 + a * k, x0 + b * k, y + 0.12, 0.5, 0.8);
      if (animate) { cur.position.x = x0 + b * k; await wait(tok, 60); }
    }
    cur.position.x = x0 + r.T * k;
    lanes.forEach(([n, y, , u]) => tag('CPU 可做別的事 ' + Math.round(u * 100) + '%', 'ptr alt', 3.6, y + 0.75));
    return r;
  }
  function enterCompare() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 4, 14], [0, 3.2, 0]);
    controls('<label>傳幾個 word <input id="mN" type="number" min="2" max="16" value="' + CP.n + '" style="width:50px"></label>'
      + '<label>裝置每幾 cycles 一個 word <input id="mD" type="number" min="4" max="60" value="' + CP.D + '" style="width:55px"></label>'
      + '<label>ISR cycles <input id="mI" type="number" min="1" max="30" value="' + CP.I + '" style="width:50px"></label>'
      + '<label>DMA 設定 cycles <input id="mS" type="number" min="1" max="60" value="' + CP.S + '" style="width:50px"></label><button class="primary" id="mGo">播放時間軸</button>');
    on('mGo', async () => {
      const n = (id, lo, hi) => Number($(id).value);
      const v = { n: n('mN'), D: n('mD'), I: n('mI'), S: n('mS') };
      if (!(v.n >= 2 && v.n <= 16 && v.D >= 4 && v.D <= 60 && v.I >= 1 && v.I <= 30 && v.S >= 1 && v.S <= 60)) { log('數值超出範圍：word 2–16、裝置 4–60、ISR 1–30、DMA 設定 1–60。', true); return; }
      if (v.I >= v.D) { log('ISR 比裝置產生一個 word 還慢：中斷會塞車（CPU 被中斷淹沒）。', true); }
      Object.assign(CP, v); lab.clear(); const r = await drawTimeline(undefined, CP, true); cmpState(r);
    });
    log('綠色細條 = CPU 可以拿去做別的工作；紅 = polling 空等；橘 = CPU 搬資料；粉 = 中斷服務程式；紫 = 設定 DMA；金 = DMA 偷用 bus 的 cycle。');
    drawTimeline(undefined, CP, false).then(cmpState);
  }
  function cmpState(r) {
    setState('三種 I/O 方式：CPU 的時間花在哪', [['Programmed I/O', 'CPU 一直 polling：' + Math.round(r.uP * 100) + '% 可用'], ['Interrupt', CP.n + ' 次中斷 × ' + CP.I + ' cycles：' + Math.round(r.uI * 100) + '%'], ['DMA', '設定 ' + CP.S + ' + 偷 ' + CP.n + ' 個 cycle + 1 次中斷：' + Math.round(r.uD * 100) + '%']],
      'DMA 只在開頭與結尾打擾 CPU → <span class="ok">大量資料最划算</span>');
  }

  // ───────────────────────── 模式 2：CPU 負擔計算（P&H 例題） ─────────────────────────
  const OV = { mhz: 500, rate: 4000, unit: 16, poll: 400, intr: 500, active: 5, setup: 1000, blk: 8 };
  function ovCalc(o) {
    const clk = o.mhz * 1e6, bytesPerSec = o.rate * 1000;
    const per = bytesPerSec / o.unit;
    const poll = per * o.poll / clk * 100;
    const intr = per * o.intr / clk * 100 * o.active / 100;
    const xfers = bytesPerSec / (o.blk * 1000);
    const dma = xfers * (o.setup + o.intr) / clk * 100 * o.active / 100;
    return { per, poll, intr, xfers, dma };
  }
  function enterOverhead() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 4, 13], [0, 3, 0]);
    OV.bars = [bar('#d64545', 1.8, 1.4, -3.6), bar('#e55a9b', 1.8, 1.4, 0), bar('#9b7ef4', 1.8, 1.4, 3.6)];
    OV.lb = [tag('', 'ptr alt', -3.6, 1), tag('', 'ptr alt', 0, 1), tag('', 'ptr alt', 3.6, 1)];
    tag('Polling', 'ptr', -3.6, 0, 1.4); tag('Interrupt', 'ptr', 0, 0, 1.4); tag('DMA', 'ptr', 3.6, 0, 1.4);
    tag('高度 = log 尺度的 CPU 時間比例', 'idx', 0, 6.8);
    const F = [['oMhz', 'clock MHz', 'mhz'], ['oRate', '資料率 KB/s', 'rate'], ['oUnit', '每次傳 bytes', 'unit'], ['oPoll', 'polling cycles', 'poll'], ['oIntr', '中斷 cycles', 'intr'], ['oAct', '裝置忙碌 %', 'active'], ['oSet', 'DMA 設定 cycles', 'setup'], ['oBlk', 'DMA 一次 KB', 'blk']];
    controls(F.map(([id, n, k]) => '<label>' + n + ' <input id="' + id + '" type="number" value="' + OV[k] + '" style="width:64px"></label>').join('')
      + '<button class="primary" id="oGo">計算</button><button id="oMouse">滑鼠</button><button id="oFloppy">軟碟</button><button id="oDisk">硬碟</button>');
    const rd = () => { for (const [id, , k] of F) { const v = Number($(id).value); if (!(v > 0)) { log(id + ' 要是正數。', true); return; } OV[k] = v; } updOv(); };
    const preset = (o, msg) => { Object.assign(OV, o); for (const [id, , k] of F) $(id).value = String(OV[k]); updOv(); log(msg); };
    on('oGo', rd);
    on('oMouse', () => preset({ rate: 0.06, unit: 2, active: 100 }, 'P&H：滑鼠每秒要被 poll 30 次（這裡用 60 B/s ÷ 2 B = 30 次）→ 30 × 400 = 12,000 cycles/s ≈ 0.002%'));
    on('oFloppy', () => preset({ rate: 50, unit: 2, active: 100 }, 'P&H：軟碟 50 KB/s、每次 2 bytes → 25K 次 × 400 = 10M cycles/s = 2%'));
    on('oDisk', () => preset({ rate: 4000, unit: 16, active: 5 }, 'P&H：硬碟 4 MB/s、每次 16 bytes → polling 20%；中斷 500 cycles、忙碌 5% → 1.25%；DMA 設定 1000 + 完成中斷 500、每次 8 KB → 0.0075%（一直忙也只有 0.15%）'));
    log('P&H 經典例題：500 MHz 處理器，polling 一次 400 cycles。polling 不管裝置忙不忙都要一直 poll；中斷與 DMA 只在裝置真的在傳時才花時間。');
    updOv();
  }
  function updOv() {
    const r = ovCalc(OV);
    [r.poll, r.intr, r.dma].forEach((v, i) => { const h = Math.max(0.05, (Math.log10(Math.max(v, 1e-4)) + 4) * 1.1); setBar(OV.bars[i], h); OV.lb[i].position.set(-3.6 + i * 3.6, h + 0.5, 0); txt(OV.lb[i], pct(v)); });
    setState('CPU 花在 I/O 的比例', [['每秒傳輸次數', Math.round(r.per).toLocaleString()], ['Polling', Math.round(r.per).toLocaleString() + ' × ' + OV.poll + ' / ' + OV.mhz + 'M = ' + pct(r.poll)], ['Interrupt', '× ' + OV.intr + ' cycles × 忙碌 ' + OV.active + '% = ' + pct(r.intr)], ['DMA', r2(r.xfers) + ' 次/秒 × (' + OV.setup + ' + ' + OV.intr + ') × ' + OV.active + '% = ' + pct(r.dma)]],
      r.poll > 100 ? '<span class="no">polling 超過 100%：CPU 根本來不及</span>' : 'DMA 把「每個單位一次」變成「每個大 block 一次」');
  }

  // ───────────────────────── 模式 3：MIPS 的例外與中斷 ─────────────────────────
  const PROG = [[0x00400000, 'lw   $t0, 0($a0)'], [0x00400004, 'add  $t1, $t0, $t0'], [0x00400008, 'add  $t2, $t1, $s0'], [0x0040000C, 'sw   $t2, 4($a0)'], [0x00400010, 'j    0x00400000']];
  const HANDLER = [[0x80000180, 'mfc0 $k0, $13   # 讀 Cause'], [0x80000184, 'mfc0 $k1, $14   # 讀 EPC'], [0x80000188, '…依 Cause 處理…'], [0x8000018C, 'eret            # 回到 EPC']];
  const IR = { pc: 0x00400000, epc: null, cause: '—', ie: true, inH: false, pending: false, ovNext: false };
  const hx = (v) => '0x' + v.toString(16).toUpperCase().padStart(8, '0');
  function enterInterrupt() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 3.6, 13.5], [0, 3.2, 0]);
    Object.assign(IR, { pc: 0x00400000, epc: null, cause: '—', ie: true, inH: false, pending: false, ovNext: false });
    tag('使用者程式', 'ptr', -3.2, 6.9); tag('Exception handler（0x80000180）', 'ptr', 3.0, 6.9);
    IR.prog = code(PROG.map(([a, s]) => hx(a).slice(4) + '  ' + s), -3.2, 6.2);
    IR.hand = code(HANDLER.map(([a, s]) => hx(a).slice(4) + '  ' + s), 3.0, 6.2);
    IR.regs = { pc: cube('PC', '#31aab0', [2.6, 0.6, 0.9], -4.2, 1.6, 0), epc: cube('EPC', '#dd8238', [2.6, 0.6, 0.9], -1.3, 1.6, 0), cause: cube('Cause', '#e55a9b', [2.6, 0.6, 0.9], 1.6, 1.6, 0), st: cube('Status', '#9b7ef4', [2.0, 0.6, 0.9], 4.5, 1.6, 0) };
    IR.dev = cube('I/O 裝置', '#9b7ef4', [1.6, 0.8, 1.0], 5.6, 3.4, 0);
    controls('<button class="primary" id="iStep">執行一步</button><button id="iIrq">裝置發出中斷</button><button id="iOv">讓下一個 add overflow</button><button id="iMask">開／關中斷（Status.IE）</button><button id="iReset">重設</button>');
    on('iStep', () => irStep());
    on('iIrq', () => { IR.pending = true; glow(IR.dev, GOLD); log('裝置發出 interrupt request；CPU 會在目前這個指令做完後檢查。' + (IR.ie ? '' : '（中斷目前被 mask 住，會一直等）'), !IR.ie); irDraw(); });
    on('iOv', () => { IR.ovNext = true; log('下一個 add 會發生 arithmetic overflow（MIPS 的 add 會觸發例外，addu 不會）。'); });
    on('iMask', () => { IR.ie = !IR.ie; log('Status.IE = ' + (IR.ie ? 1 : 0) + (IR.ie ? '：允許中斷' : '：關閉中斷（進 handler 時硬體也會自動關掉）')); irDraw(); });
    on('iReset', () => enterInterrupt());
    log('MIPS：發生例外時硬體把出事指令的位址存進 EPC、原因寫進 Cause，然後跳到 0x80000180；handler 用 eret 回去。');
    irDraw();
  }
  function irDraw() {
    const inP = PROG.findIndex(([a]) => a === IR.pc), inH = HANDLER.findIndex(([a]) => a === IR.pc);
    IR.prog.hl(inP); IR.hand.hl(inH);
    relabel(IR.regs.pc, 'PC ' + hx(IR.pc)); relabel(IR.regs.epc, 'EPC ' + (IR.epc === null ? '—' : hx(IR.epc))); relabel(IR.regs.cause, 'Cause ' + IR.cause); relabel(IR.regs.st, 'IE = ' + (IR.ie ? 1 : 0));
    setState('MIPS exception／interrupt', [['PC', hx(IR.pc)], ['EPC', IR.epc === null ? '—' : hx(IR.epc)], ['Cause', IR.cause], ['Status.IE', IR.ie ? '1（允許）' : '0（關閉）'], ['待處理中斷', IR.pending ? '有' : '無']],
      'Exception：CPU 內部（overflow、undefined instruction）；Interrupt：外部 I/O 裝置');
  }
  async function irStep() {
    [IR.regs.pc, IR.regs.epc, IR.regs.cause].forEach((m) => glow(m, null));
    const inP = PROG.findIndex(([a]) => a === IR.pc), inH = HANDLER.findIndex(([a]) => a === IR.pc);
    if (inH >= 0) {
      if (inH === HANDLER.length - 1) { IR.pc = IR.epc; IR.inH = false; IR.ie = true; log('eret：PC ← EPC = ' + hx(IR.epc) + '，重新開啟中斷'); glow(IR.regs.pc, GREEN); }
      else { IR.pc += 4; log('handler：' + HANDLER[inH][1]); }
      irDraw(); return;
    }
    const [a, s] = PROG[inP];
    if (IR.ovNext && s.startsWith('add')) {
      IR.ovNext = false; IR.epc = a; IR.cause = '12（Ov 溢位）'; IR.pc = 0x80000180; IR.inH = true; IR.ie = false;
      glow(IR.regs.epc, GOLD); glow(IR.regs.cause, GOLD);
      log('執行 ' + s + ' 時 overflow：這個指令不能寫回 → EPC ← ' + hx(a) + '（出事的指令）、Cause = 12，跳到 handler', true);
      irDraw(); return;
    }
    log('執行 ' + hx(a) + '：' + s);
    IR.pc = s.startsWith('j ') ? 0x00400000 : a + 4;
    if (IR.pending && IR.ie) {
      IR.pending = false; glow(IR.dev, null);
      IR.epc = IR.pc; IR.cause = '0（Int 外部中斷）'; IR.pc = 0x80000180; IR.inH = true; IR.ie = false;
      glow(IR.regs.epc, GOLD); glow(IR.regs.cause, GOLD);
      log('做完這個指令後發現中斷：EPC ← ' + hx(IR.epc) + '（回來要繼續的指令）、Cause = 0，跳到 handler、關中斷');
    }
    irDraw();
  }

  // ───────────────────────── 模式 4：Bus arbitration ─────────────────────────
  const AR = { scheme: 'daisy', req: [false, true, false, true], last: -1 };
  function enterArb() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 4.5, 13], [0, 2.8, 0]);
    AR.arb = cube('Arbiter', '#31aab0', [1.6, 1.0, 1.2], -5.6, 2.4, 0);
    AR.dev = []; AR.lab = [];
    for (let d = 0; d < 4; d++) { AR.dev.push(cube('Device ' + d, '#c9b48e', [1.7, 1.0, 1.2], -2.6 + d * 2.6, 2.4, 0)); AR.lab.push(tag('', 'idx', -2.6 + d * 2.6, 1.4, 0.8)); }
    AR.grant = cube('Grant', '#2fc092', [0.8, 0.4, 0.5], -5.6, 3.5, 0.6);
    AR.res = tag('', 'ptr alt', 0, 5.6);
    controls('<select id="aS"><option value="daisy">Daisy chain（序列優先）</option><option value="parallel">Centralized parallel（輪流 round-robin）</option></select>'
      + [0, 1, 2, 3].map((d) => '<button id="aR' + d + '">Device ' + d + ' 請求</button>').join('') + '<button class="primary" id="aGo">仲裁一次</button>');
    $('aS').value = AR.scheme; $('aS').onchange = (e) => { AR.scheme = e.target.value; AR.last = -1; arbDraw(); log(AR.scheme === 'daisy' ? 'Daisy chain：grant 從 arbiter 一路傳下去，第一個有請求的裝置攔下來 → 越靠近 arbiter 優先權越高。' : 'Centralized parallel：每個裝置各有一條 request 線，arbiter 一次看全部，可用 round-robin 公平輪流。'); };
    [0, 1, 2, 3].forEach((d) => on('aR' + d, () => { AR.req[d] = !AR.req[d]; arbDraw(); }));
    on('aGo', () => arbitrate());
    log('多個裝置想用 bus 時，由 arbitration 決定誰先用。按「Device k 請求」切換請求，再按「仲裁一次」。');
    arbDraw();
  }
  function arbDraw() {
    AR.dev.forEach((m, d) => { tint(m, AR.req[d] ? '#dd8238' : '#c9b48e'); glow(m, null); txt(AR.lab[d], AR.req[d] ? 'request' : ''); });
    setState('Bus arbitration', [['方式', AR.scheme === 'daisy' ? 'Daisy chain' : 'Centralized parallel（round-robin）'], ['有請求', AR.req.map((r, d) => (r ? 'D' + d : '')).filter(Boolean).join('、') || '無'], ['上次拿到', AR.last < 0 ? '—' : 'D' + AR.last]],
      AR.scheme === 'daisy' ? '簡單、線少；但遠端裝置可能 <span class="no">starvation</span>，且速度受鏈長限制' : '公平、快；但每個裝置要自己的 request／grant 線');
  }
  async function arbitrate(tok) {
    const any = AR.req.some(Boolean);
    if (!any) { log('沒有裝置在請求 bus。', true); return; }
    let win = -1;
    if (AR.scheme === 'daisy') {
      move(AR.grant, -5.6, 3.5, 0.6); await wait(tok, 300);
      for (let d = 0; d < 4; d++) {
        move(AR.grant, -2.6 + d * 2.6, 3.5, 0.6); glow(AR.dev[d], GOLD); await wait(tok, 450);
        if (AR.req[d]) { win = d; break; }
        glow(AR.dev[d], null);
        log('Device ' + d + ' 沒有請求：把 grant 往下傳');
      }
    } else {
      for (let k = 1; k <= 4; k++) { const d = (AR.last + k + 4) % 4; if (AR.req[d]) { win = d; break; } }
      move(AR.grant, -2.6 + win * 2.6, 3.5, 0.6); await wait(tok, 500);
    }
    glow(AR.dev[win], GREEN);
    txt(AR.res, 'Device ' + win + ' 拿到 bus');
    log('Device ' + win + ' 拿到 bus，用完後釋放（這次的請求清除）');
    AR.last = win; AR.req[win] = false;
    await wait(tok, 600);
    arbDraw(); glow(AR.dev[win], GREEN);
    return win;
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function opts4(ans, cands) {
    const s = new Set([ans]);
    for (const c of cands) { if (s.size >= 4) break; if (c !== undefined && c !== null && String(c) !== '' && !String(c).startsWith('-')) s.add(String(c)); }
    let k = 2; while (s.size < 4) { s.add(String(r2(Number.parseFloat(ans) * k)) + (ans.endsWith('%') ? '%' : ans.endsWith(' ms') ? ' ms' : '')); k++; }
    return [...s];
  }
  const CONCEPT = [
    { q: 'Programmed I/O 最主要的缺點？', opts: ['CPU busy waiting，一直 polling 浪費時間', '需要 DMA controller，成本高', '會造成 cache coherence 問題', '一定要有中斷優先權電路'], ans: 'CPU busy waiting，一直 polling 浪費時間', why: '影片：CPU 持續監看裝置是否 ready，這段時間什麼都不能做；優點是簡單、硬體少。' },
    { q: 'Interrupt-initiated I/O 中，是誰持續監看裝置？', opts: ['I/O interface（裝置介面）', 'CPU', 'DMA controller', 'Memory controller'], ans: 'I/O interface（裝置介面）', why: '介面監看裝置，裝置 ready 時發 interrupt request；CPU 平常做別的事，收到中斷才停下來服務、再回原工作。' },
    { q: 'DMA 傳輸期間，CPU 與 bus 的關係？', opts: ['DMA controller 掌控 bus，CPU 只是延後自己的記憶體存取', 'CPU 逐一搬每個 word', 'CPU 一直 polling DMA controller', 'CPU 和 DMA 同時寫同一個位址'], ans: 'DMA controller 掌控 bus，CPU 只是延後自己的記憶體存取', why: 'CPU 只在開頭給起始位址、長度等，之後 DMA 直接在記憶體與裝置間傳（cycle stealing），結束時再中斷 CPU。' },
    { q: 'Programmed I/O 與 interrupt I/O 共同的缺點（影片）？', opts: ['每筆資料都要 CPU 執行指令搬，傳輸率受限於 CPU', '需要額外的 DMA controller', '無法處理鍵盤', '會讓 cache 永遠 miss'], ans: '每筆資料都要 CPU 執行指令搬，傳輸率受限於 CPU', why: '兩者資料都經過 CPU；DMA 才讓裝置直接和記憶體傳。' },
    { q: 'DMA 的缺點（影片）？', opts: ['需要 DMA controller，系統成本增加，且可能有 cache coherence 問題', 'CPU 必須 busy waiting', '每個 word 都要中斷一次', '傳輸率受 CPU 速度限制'], ans: '需要 DMA controller，系統成本增加，且可能有 cache coherence 問題', why: 'DMA 直接改記憶體，cache 裡可能還留著舊資料；輸出時記憶體也可能還沒拿到 write-back cache 的新值。' },
    { q: 'MIPS 發生 arithmetic overflow 例外時，EPC 存的是？', opts: ['發生 overflow 的那個指令的位址', '下一個指令的位址 PC + 4', 'handler 的位址 0x80000180', 'Cause register 的值'], ans: '發生 overflow 的那個指令的位址', why: 'P&H：EPC 記錄受影響（出事）的指令位址，Cause 記錄原因，然後跳到 0x80000180 的 handler。' },
    { q: 'P&H 的術語中，exception 與 interrupt 的差別？', opts: ['Interrupt 來自處理器外部（例如 I/O）；exception 泛指控制流程的意外改變（含內部的 overflow）', '兩者完全相同', 'Exception 只來自 I/O 裝置', 'Interrupt 只來自未定義指令'], ans: 'Interrupt 來自處理器外部（例如 I/O）；exception 泛指控制流程的意外改變（含內部的 overflow）', why: 'MIPS 慣例：exception 指任何意外的控制流程改變，interrupt 專指外部事件造成的。處理流程要分開記。' },
    { q: 'Daisy chain bus arbitration 的特性？', opts: ['越靠近 arbiter 的裝置優先權越高，遠端可能 starvation', '所有裝置完全公平輪流', '每個裝置都有獨立的 grant 線', '不需要 arbiter'], ans: '越靠近 arbiter 的裝置優先權越高，遠端可能 starvation', why: 'grant 依序往下傳，第一個有請求的裝置會攔下來。' },
  ];
  function genQ() {
    const p = Math.random();
    if (p < 0.2) {
      const mhz = pickOne([250, 500, 1000]), cyc = pickOne([100, 200, 400]), rate = pickOne([50, 100, 500, 2000, 4000]), unit = pickOne([2, 4, 16]);
      const v = rate * 1000 / unit * cyc / (mhz * 1e6) * 100;
      return { q: mhz + ' MHz 處理器，poll 一次 ' + cyc + ' cycles。裝置 ' + rate + ' KB/s、每次傳 ' + unit + ' bytes，不能漏資料。polling 占 CPU 時間？', opts: opts4(pct(v), [pct(v * unit), pct(v / 10), pct(v * 2), pct(rate * 1000 * cyc / (mhz * 1e6) * 100)]), ans: pct(v), why: '每秒要 poll ' + rate + 'K / ' + unit + ' = ' + (rate * 1000 / unit).toLocaleString() + ' 次 × ' + cyc + ' = ' + (rate * 1000 / unit * cyc).toLocaleString() + ' cycles，÷ ' + mhz + 'M = ' + pct(v) + '。' };
    }
    if (p < 0.36) {
      const intr = pickOne([200, 500, 600]), rate = pickOne([2000, 4000, 8000]), unit = 16, act = pickOne([5, 10, 20]);
      const v = rate * 1000 / unit * intr / 500e6 * 100 * act / 100;
      return { q: '500 MHz、中斷一次 ' + intr + ' cycles；磁碟 ' + rate / 1000 + ' MB/s、每次 16 bytes，磁碟只有 ' + act + '% 時間在傳。中斷方式占 CPU？', opts: opts4(pct(v), [pct(v * 100 / act), pct(v * 400 / intr), pct(v / 16), pct(v * 2)]), ans: pct(v), why: '傳輸時：' + (rate * 1000 / unit).toLocaleString() + ' 次/秒 × ' + intr + ' = ' + pct(v * 100 / act) + '；只有 ' + act + '% 時間在傳 → ' + pct(v) + '。（polling 不管忙不忙都要一直 poll。）' };
    }
    if (p < 0.5) {
      const setup = pickOne([1000, 2000]), done = 500, blk = pickOne([4, 8, 16]), rate = pickOne([4, 8, 40]);
      const xf = rate * 1000 / blk, v = xf * (setup + done) / 500e6 * 100;
      return { q: '500 MHz；DMA 每次設定 ' + setup + ' cycles、完成中斷 ' + done + ' cycles，一次傳 ' + blk + ' KB。磁碟一直以 ' + rate + ' MB/s 傳，CPU 負擔？', opts: opts4(pct(v), [pct(v * blk), pct(xf * setup / 500e6 * 100), pct(v * 1000 / 1024 * 4), pct(v * 10)]), ans: pct(v), why: '每秒 ' + rate + ' MB / ' + blk + ' KB = ' + xf + ' 次 DMA × (' + setup + ' + ' + done + ') = ' + (xf * (setup + done)).toLocaleString() + ' cycles → ' + pct(v) + '（以 1 MB = 1000 KB 計，同 P&H）。' };
    }
    if (p < 0.64) {
      const rpm = pickOne([5400, 7200, 10000, 15000]), seek = pickOne([4, 6, 8, 9]), mbps = pickOne([50, 100]), ovh = pickOne([0, 0.1, 0.2]);
      const rot = 0.5 / (rpm / 60) * 1000, xfer = 512 / (mbps * 1e6) * 1000;
      const tot = r2(seek + rot + xfer + ovh);
      return { q: '讀一個 512 B sector：平均 seek ' + seek + ' ms、' + rpm + ' RPM、傳輸 ' + mbps + ' MB/s、controller overhead ' + ovh + ' ms，平均時間？', opts: opts4(r2(tot) + ' ms', [r2(seek + 2 * rot + xfer + ovh) + ' ms', r2(seek + xfer + ovh) + ' ms', r2(seek + rot) + ' ms', r2(tot + seek) + ' ms']), ans: r2(tot) + ' ms', why: '平均 rotational latency = 半圈 = 0.5 / (' + rpm + '/60) = ' + r2(rot) + ' ms；傳輸 512 B / ' + mbps + ' MB/s = ' + r2(xfer * 1000) / 1000 + ' ms。合計 ' + seek + ' + ' + r2(rot) + ' + ' + r2(xfer) + ' + ' + ovh + ' ≈ ' + tot + ' ms。' };
    }
    if (p < 0.72) {
      const n = rnd(2, 4), req = Array.from({ length: 4 }, () => Math.random() < 0.5); req[rnd(1, 3)] = true;
      const win = req.findIndex(Boolean);
      return { q: 'Daisy chain，Device 0 最靠近 arbiter。目前有請求的裝置：' + req.map((r, d) => (r ? 'D' + d : '')).filter(Boolean).join('、') + '。誰拿到 bus？', opts: ['D0', 'D1', 'D2', 'D3'], ans: 'D' + win, why: 'grant 從 D0 開始往下傳，第一個有請求的 D' + win + ' 攔下來。' };
    }
    return { ...pickOne(CONCEPT) };
  }
  let qs = { score: 0, total: 0 };
  function renderQuiz(el) {
    const p = genQ();
    const opts = [...p.opts].sort(() => Math.random() - 0.5);
    el.innerHTML = '<h2>小測驗</h2><div class="lab-quiz-score">答對 ' + qs.score + ' / ' + qs.total + '</div>'
      + '<div class="lab-quiz-q" style="white-space:pre-wrap">' + p.q + '</div><div class="lab-quiz-opts">'
      + opts.map((o) => '<button data-o="' + encodeURIComponent(o) + '">' + o + '</button>').join('') + '</div><div id="qx"></div>';
    el.querySelectorAll('.lab-quiz-opts button').forEach((btn) => {
      btn.onclick = () => {
        if (el.querySelector('.right')) return;
        const pick = decodeURIComponent(btn.dataset.o);
        qs.total++; if (pick === p.ans) qs.score++;
        el.querySelectorAll('.lab-quiz-opts button').forEach((b) => { const o = decodeURIComponent(b.dataset.o); if (o === p.ans) b.classList.add('right'); else if (b === btn) b.classList.add('wrong'); });
        $('qx').innerHTML = '<div class="lab-quiz-explain">' + (pick === p.ans ? '答對了。' : '答錯了。') + p.why + '</div><button class="lab-next" id="qNext">下一題</button>';
        $('qNext').onclick = () => renderQuiz(el);
      };
    });
  }

  // ───────────────────────── 場景：E82x-cug9YE（Modes of Transfer） ─────────────────────────
  async function scThreeModes(tok) {
    fresh([0, 4, 13.5], [0, 3, 0]);
    const R = rig();
    say('外部裝置的資料最後都存進記憶體', '記憶體才是傳輸的 source 與 target');
    await hop(tok, 'data', '#e55a9b', [[4.6, 1.2], [0, 2.9], [4.6, 4.6]], 600);
    await beat(tok, 1400);
    say('CPU 只是處理資訊、居中搬運', '');
    await hop(tok, 'data', '#e55a9b', [[4.6, 4.6], [0, 2.9], [-4.6, 4.6], [0, 2.9], [4.6, 1.2]], 450);
    await beat(tok, 1000);
    const ms = ['① Programmed I/O', '② Interrupt-initiated I/O', '③ Direct memory access（DMA）'].map((s, k) => tag(s, 'ptr alt', 0, 6.9 - k * 0.6));
    say('三種傳輸方式', '前兩種要經過 CPU；DMA 直接在記憶體與 I/O 之間');
    await beat(tok, 3200);
  }
  async function scProgrammedIO(tok) {
    fresh([0, 4, 13.5], [0, 3, 0]);
    const R = rig();
    const cd = code(['loop: lw   $t0, STATUS', '      beq  $t0, $0, loop   # 還沒 ready', '      lw   $t1, DATA', '      sw   $t1, 0($a0)'], -1.2, 7.0, 0.45);
    say('Programmed I/O：每件事都由 CPU 做', 'I/O 指令寫在程式裡，每筆資料由一個指令發動');
    await beat(tok, 2800);
    for (let k = 0; k < 5; k++) {
      cd.hl(k % 2); glow(R.cpu, RED); glow(R.io, GOLD);
      say('CPU：裝置 ready 了嗎？還沒…', '持續監看（polling）：busy waiting');
      await hop(tok, '?', '#d64545', [[-4.6, 4.6], [0, 2.9], [4.6, 1.2]], 260);
      await beat(tok, 200);
    }
    glow(R.io, GREEN); cd.hl(2);
    say('ready！CPU 把資料讀進暫存器', '');
    await hop(tok, 'data', '#e55a9b', [[4.6, 1.2], [0, 2.9], [-4.6, 4.6]], 450);
    cd.hl(3);
    say('再由 CPU 寫進記憶體', '通常是 CPU 暫存器 ↔ 記憶體');
    await hop(tok, 'data', '#e55a9b', [[-4.6, 4.6], [0, 2.9], [4.6, 4.6]], 450);
    glow(R.cpu, null);
    say('優點：簡單、硬體很少', '缺點：CPU 長時間空等，無法做別的事');
    await beat(tok, 3200);
  }
  async function scInterruptIO(tok) {
    fresh([0, 4, 13.5], [0, 3, 0]);
    const R = rig();
    const work = tag('', 'ptr alt', -4.6, 6.0);
    say('Interrupt-initiated I/O：CPU 不必一直盯著', 'interface 監看裝置，ready 時發 interrupt request');
    await beat(tok, 2800);
    glow(R.cpu, GREEN);
    for (let k = 1; k <= 4; k++) { txt(work, '做別的工作 ' + k); say('CPU 照常執行其他程式', '裝置還在準備資料'); await beat(tok, 600); }
    glow(R.io, GOLD);
    say('裝置 ready：interface 送出中斷請求', 'interrupt request');
    await hop(tok, 'IRQ', '#dd8238', [[4.6, 1.2], [0, 2.9], [-4.6, 4.6]], 450);
    glow(R.cpu, GOLD); txt(work, '暫停原工作');
    say('CPU 停下目前的工作，去服務這個請求', '');
    await beat(tok, 1600);
    await hop(tok, 'data', '#e55a9b', [[4.6, 1.2], [0, 2.9], [-4.6, 4.6], [0, 2.9], [4.6, 4.6]], 380);
    glow(R.io, null); glow(R.cpu, GREEN); txt(work, '回到原工作 5');
    say('服務完，回到原本的工作繼續', 'interrupt → 處理 → resume');
    await beat(tok, 3000);
  }
  async function scPioLimits(tok) {
    fresh([0, 4, 13.5], [0, 3, 0]);
    const R = rig();
    say('前兩種方式共同的兩個缺點', '');
    await beat(tok, 1800);
    say('① 每筆傳輸都由處理器管理', '每個 I/O 都要執行好幾個指令');
    for (let k = 0; k < 4; k++) { glow(R.cpu, GOLD); await hop(tok, 'w' + k, '#e55a9b', [[4.6, 1.2], [-4.6, 4.6], [4.6, 4.6]], 300); glow(R.cpu, null); }
    await beat(tok, 800);
    say('② 傳輸率受限於 CPU 處理的速度', '資料一定要經過 CPU');
    await beat(tok, 2600);
    say('→ 由第三種方式 DMA 解決', '');
    await beat(tok, 2200);
  }
  async function scDma(tok) {
    fresh([0, 4, 13.5], [0, 3, 0]);
    const R = rig();
    const dmac = cube('DMA controller', '#2fc092', [2.2, 1, 1.2], 0, 1.2, 0);
    say('DMA：資料直接在記憶體與 I/O 之間傳', '不必每次都經過 CPU');
    await beat(tok, 2600);
    say('CPU 先設定：起始位址、字數、方向', 'CPU initiates the transfer');
    await hop(tok, 'addr,n', '#9b7ef4', [[-4.6, 4.6], [0, 2.9], [0, 1.2]], 500);
    await beat(tok, 1200);
    say('DMA 向 bus 要記憶體 cycle，被允許後直接傳', 'bus request → bus grant');
    glow(R.cpu, '#333333');
    for (let k = 0; k < 4; k++) {
      glow(R.bus, GOLD);
      await hop(tok, 'w' + k, '#e55a9b', [[4.6, 1.2], [0, 2.9], [4.6, 4.6]], 280);
      glow(R.bus, null);
    }
    say('傳輸時 CPU 不能用 bus：記憶體存取延後一下', 'DMA 掌控 bus，CPU 暫停記憶體存取（cycle stealing）');
    await beat(tok, 2800);
    glow(R.cpu, null);
    await hop(tok, 'done', '#dd8238', [[0, 1.2], [0, 2.9], [-4.6, 4.6]], 450);
    say('全部傳完，DMA 發中斷通知 CPU', '');
    await beat(tok, 2400);
  }
  async function scDmaPros(tok) {
    fresh([0, 4, 13.5], [0, 3, 0]);
    const R = rig();
    const dmac = cube('DMA', '#2fc092', [1.6, 1, 1.2], 0, 1.2, 0);
    tag('優點', 'ptr', -4, 6.7); tag('缺點', 'ptr alt', 3.6, 6.7);
    const g = tag('', 'idx', -4, 6.1), b = tag('', 'idx', 3.6, 6.1);
    say('優點：周邊直接讀寫記憶體，不經 CPU', '');
    txt(g, '周邊直接存取記憶體');
    await hop(tok, 'w', '#e55a9b', [[4.6, 1.2], [0, 2.9], [4.6, 4.6]], 400);
    await beat(tok, 1400);
    say('傳輸時處理器可以做別的事 → 更快', '');
    txt(g, '周邊直接存取記憶體 · CPU 可做別的事'); glow(R.cpu, GREEN);
    await beat(tok, 2400);
    say('缺點：需要 DMA controller，系統成本增加', '');
    txt(b, '要 DMA controller（成本）'); glow(dmac, GOLD);
    await beat(tok, 2400);
    say('還可能有 cache coherence 問題', 'DMA 改了記憶體，cache 裡可能還是舊值');
    txt(b, '要 DMA controller · cache coherence');
    const c = cube('cache：舊值', '#d64545', [1.8, 0.5, 0.9], -4.6, 6.0, 0);
    await beat(tok, 3200);
  }

  // ───────────────────────── 場景：P&H（MIPS 例外、I/O 負擔、bus、磁碟） ─────────────────────────
  async function scExceptionEpc(tok) {
    fresh([0, 3.6, 13.5], [0, 3.2, 0]);
    const prog = code(['0x00400010  lw   $t0, 0($a0)', '0x00400014  add  $t1, $t0, $t0', '0x00400018  sw   $t1, 4($a0)'], -3.2, 6.2);
    const hand = code(['0x80000180  mfc0 $k0, $13  # Cause', '0x80000184  mfc0 $k1, $14  # EPC', '0x80000188  …處理…', '0x8000018C  eret'], 3.0, 6.2);
    const epc = cube('EPC —', '#dd8238', [2.8, 0.6, 0.9], -3.0, 1.8, 0), cause = cube('Cause —', '#e55a9b', [2.8, 0.6, 0.9], 0.5, 1.8, 0), pc = cube('PC 0x00400010', '#31aab0', [3.0, 0.6, 0.9], 4.0, 1.8, 0);
    say('MIPS：出事時硬體做兩件事', '存 EPC、寫 Cause，再跳到固定位址');
    prog.hl(0); await beat(tok, 2400);
    prog.hl(1); relabel(pc, 'PC 0x00400014');
    say('add 發生 arithmetic overflow', 'P&H：另一種是 undefined instruction');
    await beat(tok, 2200);
    relabel(epc, 'EPC 0x00400014'); glow(epc, GOLD);
    say('EPC ← 出事指令的位址', 'Exception Program Counter');
    await beat(tok, 2200);
    relabel(cause, 'Cause 12（Ov）'); glow(cause, GOLD);
    say('Cause ← 原因代碼', 'undefined instruction = 10、overflow = 12');
    await beat(tok, 2200);
    prog.hl(-1); hand.hl(0); relabel(pc, 'PC 0x80000180'); glow(pc, GOLD);
    say('PC ← 0x80000180：進入作業系統的 handler', '另一種做法：vectored interrupt，依原因跳不同位址');
    await beat(tok, 2600);
    for (let k = 1; k < 4; k++) { hand.hl(k); await beat(tok, 800); }
    say('handler 讀 Cause 決定怎麼處理', '可以終止程式，或修正後用 eret 回到 EPC');
    await beat(tok, 3000);
  }
  async function scExcVsInt(tok) {
    fresh([0, 4, 13.5], [0, 3, 0]);
    tag('Exception（處理器內部）', 'ptr', -3.4, 6.6); tag('Interrupt（外部 I/O）', 'ptr alt', 3.4, 6.6);
    const L = ['overflow、undefined instruction', '出事的指令不能完成', 'EPC = 出事指令的位址', 'Cause：Ov / RI…'];
    const R = ['I/O 裝置請求服務', '當前指令可以先做完', 'EPC = 下一個要執行的指令', 'Cause：Int（外部中斷）'];
    say('兩種流程要分開記', 'P&H：exception 泛指意外的控制流程改變');
    await beat(tok, 2600);
    for (let k = 0; k < 4; k++) {
      cube(L[k], '#4b9ee2', [5.4, 0.55, 0.9], -3.4, 5.6 - k * 0.9, 0, 2);
      cube(R[k], '#dd8238', [5.4, 0.55, 0.9], 3.4, 5.6 - k * 0.9, 0, 2);
      say(k === 0 ? '來源不同' : k === 1 ? '時機不同：exception 與指令同步' : k === 2 ? '回來的位置不同' : '用 Cause 區分', '');
      await beat(tok, 2000);
    }
    cube('共同：存 EPC、Cause → 跳 handler → eret', '#2fc092', [9.6, 0.55, 0.9], 0, 1.4, 0, 2);
    say('共同部分：存狀態、跳 handler、回去', '');
    await beat(tok, 3000);
  }
  async function scInterruptFlow(tok) {
    fresh([0, 4, 13.5], [0, 3, 0]);
    const steps = ['① 裝置發出 interrupt request', '② CPU 做完目前的指令後檢查', '③ 存 EPC、Cause，關閉中斷', '④ 跳到 handler：存暫存器、找出裝置', '⑤ 服務裝置（搬資料）', '⑥ 還原暫存器，eret 回原程式'];
    const ls = steps.map((s, k) => cube(s, '#efe6d6', [6.4, 0.55, 0.9], 0, 6.2 - k * 0.85, 0));
    say('Interrupt 的處理流程', '');
    await beat(tok, 1800);
    for (let k = 0; k < 6; k++) {
      tint(ls[k], '#4b9ee2'); glow(ls[k], GOLD);
      say(steps[k].slice(2), k === 2 ? '避免 handler 還沒存好狀態就又被中斷' : k === 3 ? '高優先權的中斷可以在這之後再打開' : '');
      await beat(tok, 1900); glow(ls[k], null);
    }
    say('多個裝置同時請求：依 priority 處理', 'Status 的 interrupt mask 可以擋掉低優先權');
    await beat(tok, 3000);
  }
  async function scPollingCost(tok) {
    fresh([0, 4, 13], [0, 3, 0]);
    say('P&H 例：500 MHz，poll 一次 400 cycles', '三種裝置要 poll 得夠快，才不會漏資料');
    await beat(tok, 2800);
    const D = [['滑鼠：30 次/秒', 0.0024, '12,000 cycles → 0.002%'], ['軟碟：50 KB/s ÷ 2 B', 2, '25K 次 → 10M cycles → 2%'], ['硬碟：4 MB/s ÷ 16 B', 20, '250K 次 → 100M cycles → 20%']];
    for (let k = 0; k < 3; k++) {
      const [n, v, f] = D[k], x = -3.8 + k * 3.8;
      const b = bar('#d64545', 1.8, 1.4, x);
      tag(n, 'ptr', x, 0, 1.4);
      await growBar(tok, b, Math.max(0.05, v * 0.28), 700);
      tag(v + '%', 'ptr alt', x, Math.max(0.05, v * 0.28) + 0.5);
      say(n, f);
      await beat(tok, 2600);
    }
    say('硬碟用 polling 要吃掉 20% 的 CPU', '而且磁碟不傳資料時也照樣得 poll');
    await beat(tok, 3000);
  }
  async function scInterruptCost(tok) {
    fresh([0, 4, 13], [0, 3, 0]);
    say('P&H 例：同一個硬碟改用中斷', '每次中斷（含進出 handler）500 cycles');
    await beat(tok, 2600);
    const b1 = bar('#e55a9b', 1.8, 1.4, -3), b2 = bar('#e55a9b', 1.8, 1.4, 3);
    tag('磁碟在傳時', 'ptr', -3, 0, 1.4); tag('磁碟只有 5% 時間在傳', 'ptr', 3, 0, 1.4);
    await growBar(tok, b1, 25 * 0.2, 700);
    tag('25%', 'ptr alt', -3, 5.5);
    say('傳輸中：250K 次 × 500 = 125M cycles/秒', '125M / 500M = 25%');
    await beat(tok, 2800);
    await growBar(tok, b2, 1.25 * 0.2, 700);
    tag('1.25%', 'ptr alt', 3, 0.8);
    say('磁碟只有 5% 時間在傳：25% × 5% = 1.25%', '沒有傳輸時，中斷方式不花 CPU');
    await beat(tok, 3200);
  }
  async function scDmaCost(tok) {
    fresh([0, 4, 13], [0, 3, 0]);
    say('P&H 例：改用 DMA', '設定 1000 cycles、完成中斷 500 cycles、一次 8 KB');
    await beat(tok, 2800);
    say('4 MB/s ÷ 8 KB = 500 次 DMA/秒', '500 × (1000 + 500) = 750,000 cycles/秒');
    const items = []; for (let k = 0; k < 10; k++) { items.push(cube('8KB', '#2fc092', [0.9, 0.5, 0.8], -4.5 + k * 1.0, 4.6, 0, 2)); await beat(tok, 120); }
    tag('每個 8 KB 只打擾 CPU 兩次（開始、結束）', 'idx', 0, 5.6);
    await beat(tok, 2200);
    const bars = [[-3.6, 20, 'Polling 20%', '#d64545'], [0, 1.25, '中斷 1.25%', '#e55a9b'], [3.6, 0.15, 'DMA 0.15%', '#2fc092']];
    for (const [x, v, n, c] of bars) { const b = bar(c, 1.8, 1.2, x); await growBar(tok, b, Math.max(0.06, v * 0.15), 500); tag(n, 'ptr alt', x, Math.max(0.06, v * 0.15) + 0.5); }
    say('750K / 500M = 0.15%（磁碟一直在傳時）', '只有 5% 時間在傳 → 0.0075%');
    await beat(tok, 3400);
  }
  async function scBusTypes(tok) {
    fresh([0, 4.5, 13.5], [0, 3, 0]);
    const cpu = cube('CPU', '#31aab0', [1.6, 1, 1.2], -4.8, 5.4, 0), mem = cube('Memory', '#c9b48e', [1.6, 1, 1.2], 4.8, 5.4, 0);
    const pm = cube('', '#4b9ee2', [11, 0.14, 0.3], 0, 4.6, 0); tag('processor-memory bus：短、快、同步', 'ptr', 0, 4.05);
    const br = cube('bridge', '#9b7ef4', [1.4, 0.7, 1], 0, 3.2, 0);
    const io = cube('', '#dd8238', [11, 0.14, 0.3], 0, 1.8, 0); tag('I/O bus：長、可接多種裝置、常非同步', 'ptr alt', 0, 1.25);
    ['Disk', 'Network', 'USB'].forEach((n, k) => cube(n, '#efe6d6', [1.4, 0.7, 1], -3.6 + k * 3.6, 0.5, 0));
    say('Bus：一組共用的線（控制線 + 資料線）', '優點：便宜、好擴充；缺點：頻寬是瓶頸');
    await beat(tok, 3000);
    say('Processor-memory bus：專門連 CPU 與記憶體', '設計成又短又快');
    glow(pm, GOLD); await beat(tok, 2400); glow(pm, null);
    say('I/O bus 透過 bridge 接上來', '長、慢，要能接各種速度的裝置');
    glow(io, GOLD); await beat(tok, 2400); glow(io, null);
    say('Synchronous：大家看同一個 clock', '快，但線不能太長（clock skew）');
    for (let k = 0; k < 4; k++) { glow(pm, k % 2 ? null : GOLD); await beat(tok, 300); }
    say('Asynchronous：沒有 clock，用 handshaking', '能配合不同速度的裝置');
    await beat(tok, 2800);
  }
  async function scHandshake(tok) {
    fresh([0, 4, 13.5], [0, 3, 0]);
    ['ReadReq', 'DataRdy', 'Ack', 'Data'].forEach((n, k) => tag(n, 'ptr', -5.9, 5.8 - k * 1.2));
    const x0 = -4.6, k = 1.3;
    const lvl = (row, a, b, color, text) => { const w = (b - a) * k; return cube(text || '', color, [w, 0.4, 0.6], x0 + a * k + w / 2, 5.8 - row * 1.2, 0); };
    // 高電位區間 [row, 開始步驟, 結束步驟, 顏色, 文字]
    const HI = [[0, 0, 2, '#4b9ee2'], [3, 0, 2, '#9b7ef4', 'address'], [2, 1, 3, '#2fc092'], [1, 4, 6, '#dd8238'], [3, 4, 6, '#e55a9b', 'data'], [2, 5, 7, '#2fc092']];
    const CAP = ['device 拉高 ReadReq，位址放上 data 線', '① memory 看到 ReadReq：讀位址、拉高 Ack', '② device 看到 Ack：放下 ReadReq、釋放 data 線', '③ memory 看到 ReadReq 放下：放下 Ack',
      '④ 資料備好：放上 data 線、拉高 DataRdy', '⑤ device 看到 DataRdy：讀資料、拉高 Ack', '⑥ memory 看到 Ack：放下 DataRdy、釋放 data 線', '⑦ device 看到 DataRdy 放下：放下 Ack'];
    say('P&H：非同步 bus 的 handshaking', 'device 從 memory 讀一個 word');
    await beat(tok, 2600);
    const cur = cube('', '#3a3a3a', [0.05, 5.0, 0.05], x0, 3.9, 0.5);
    for (let st = 0; st < CAP.length; st++) {
      HI.filter((h) => h[1] === st).forEach(([row, a, b, c, t]) => lvl(row, a, b, c, t));
      cur.position.x = x0 + st * k;
      say(CAP[st], '每一步都等對方的訊號才進行');
      await beat(tok, 2200);
    }
    say('不需要共同的 clock，能配合不同速度的裝置', '代價：每次傳輸要來回好幾趟訊號');
    await beat(tok, 2800);
  }
  async function scArbitration(tok) {
    fresh([0, 4.5, 13], [0, 2.8, 0]);
    AR.req = [false, true, false, true]; AR.scheme = 'daisy'; AR.last = -1;
    AR.arb = cube('Arbiter', '#31aab0', [1.6, 1.0, 1.2], -5.6, 2.4, 0);
    AR.dev = []; AR.lab = [];
    for (let d = 0; d < 4; d++) { AR.dev.push(cube('Device ' + d, '#c9b48e', [1.7, 1.0, 1.2], -2.6 + d * 2.6, 2.4, 0)); AR.lab.push(tag('', 'idx', -2.6 + d * 2.6, 1.4, 0.8)); }
    AR.grant = cube('Grant', '#2fc092', [0.8, 0.4, 0.5], -5.6, 3.5, 0.6);
    AR.res = tag('', 'ptr alt', 0, 5.6);
    arbDraw();
    say('多個裝置搶 bus：誰先用？', 'bus master 才能發動傳輸');
    await beat(tok, 2400);
    say('Daisy chain：grant 從 arbiter 依序往下傳', 'D1、D3 都在請求');
    await beat(tok, 1600);
    let w = await arbitrate(tok);
    say('D1 先攔下 grant → D1 拿到 bus', '越靠近 arbiter 優先權越高');
    await beat(tok, 2400);
    w = await arbitrate(tok);
    say('D1 用完，D3 才輪得到', 'D1 一直請求的話，D3 可能 starvation');
    await beat(tok, 2600);
    say('Centralized parallel：各有 request 線', 'arbiter 一次看全部，可公平輪流');
    await beat(tok, 2600);
    say('Distributed：裝置自己決定（self-selection）', '例如偵測碰撞後重試（collision detection）');
    await beat(tok, 2800);
  }
  async function scDiskTime(tok) {
    fresh([0, 5, 12], [0, 1.6, 0]);
    const disk = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.2, 48), new THREE.MeshStandardMaterial({ color: '#c9b48e' }));
    disk.position.set(-2.4, 0.5, 0); lab.world.add(disk);
    const trackM = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.05, 8, 48), new THREE.MeshStandardMaterial({ color: '#9b7ef4' }));
    trackM.rotation.x = Math.PI / 2; trackM.position.set(-2.4, 0.62, 0); lab.world.add(trackM);
    const sector = cube('', '#e55a9b', [0.5, 0.12, 0.3], -2.4 + 1.8, 0.66, 0);
    const arm = cube('', '#31aab0', [3.2, 0.15, 0.3], 1.4, 0.9, 0);
    const parts = tag('', 'ptr alt', 3.4, 4.4);
    say('P&H 例：讀一個 512 B sector', '15,000 RPM、平均 seek 4 ms、100 MB/s、controller 0.2 ms');
    await beat(tok, 3000);
    say('① Seek：讀寫頭移到正確的 track', '平均 4 ms');
    await anim(tok, 900, (t) => { arm.position.x = 1.4 - t * 2.2; });
    txt(parts, '4');
    await beat(tok, 1200);
    say('② Rotational latency：等 sector 轉過來', '平均半圈 = 0.5 / (15000/60) = 2 ms');
    await anim(tok, 1400, (t) => { const a = t * Math.PI; sector.position.set(-2.4 + 1.8 * Math.cos(a), 0.66, 1.8 * Math.sin(a)); disk.rotation.y = -a; });
    txt(parts, '4 + 2');
    await beat(tok, 1200);
    say('③ Transfer：512 B / 100 MB/s = 0.005 ms', '④ Controller overhead 0.2 ms');
    txt(parts, '4 + 2 + 0.005 + 0.2');
    await beat(tok, 2600);
    txt(parts, '= 6.2 ms');
    say('平均讀取時間 ≈ 6.2 ms', '若 seek 實際只有 1/3：1.3 + 2 + 0.005 + 0.2 ≈ 3.5 ms');
    await beat(tok, 3400);
  }
  async function scMemMappedIO(tok) {
    fresh([0, 4, 13.5], [0, 3, 0]);
    const bar1 = []; for (let k = 0; k < 8; k++) bar1.push(cube(k < 6 ? 'RAM' : 'I/O', k < 6 ? '#c9b48e' : '#9b7ef4', [1.3, 0.55, 0.9], -4.6 + k * 1.3, 4.4, 0));
    tag('位址空間', 'ptr', 0, 5.4);
    say('Memory-mapped I/O：一部分位址分給 I/O 裝置', 'P&H：MIPS 用這種方式');
    await beat(tok, 2800);
    const cd = code(['lw  $t0, 0xFFFF0000   # 讀 status', 'sw  $t1, 0xFFFF000C   # 寫 data'], 0, 2.6);
    glow(bar1[6], GOLD); glow(bar1[7], GOLD);
    say('用一般的 lw／sw 讀寫裝置的暫存器', 'status 暫存器：ready 位元；data 暫存器：資料');
    await beat(tok, 3000);
    say('另一種：專用的 I/O 指令（例如 x86 的 in／out）', '兩種都要讓使用者程式不能直接碰 I/O');
    await beat(tok, 3000);
  }

  const scenes = {
    'three-modes': { title: '三種傳輸方式：記憶體才是 source 與 target', play: scThreeModes },
    'programmed-io': { title: 'Programmed I/O：CPU 一直 polling', play: scProgrammedIO },
    'interrupt-io': { title: 'Interrupt-initiated I/O：ready 才中斷 CPU', play: scInterruptIO },
    'pio-limits': { title: '前兩種的共同缺點：每筆都經過 CPU', play: scPioLimits },
    dma: { title: 'DMA：CPU 設定後，記憶體與 I/O 直接傳', play: scDma },
    'dma-pros-cons': { title: 'DMA 的優缺點：成本、cache coherence', play: scDmaPros },
    'mem-mapped-io': { title: 'Memory-mapped I/O 與 I/O 指令', play: scMemMappedIO },
    'exception-epc': { title: 'MIPS 例外：EPC、Cause、0x80000180', play: scExceptionEpc },
    'exc-vs-int': { title: 'Exception 與 Interrupt：流程分開記', play: scExcVsInt },
    'interrupt-flow': { title: 'Interrupt 處理流程與優先權', play: scInterruptFlow },
    'polling-cost': { title: 'P&H 例：polling 的 CPU 負擔（0.002%／2%／20%）', play: scPollingCost },
    'interrupt-cost': { title: 'P&H 例：中斷方式 25% → 1.25%', play: scInterruptCost },
    'dma-cost': { title: 'P&H 例：DMA 只要 0.15%', play: scDmaCost },
    'bus-types': { title: 'Bus：processor-memory bus、I/O bus、同步／非同步', play: scBusTypes },
    handshake: { title: '非同步 bus 的 7 步 handshaking', play: scHandshake },
    arbitration: { title: 'Bus arbitration：daisy chain、parallel、distributed', play: scArbitration },
    'disk-time': { title: 'P&H 例：磁碟讀一個 sector 約 6.2 ms', play: scDiskTime },
  };

  return {
    kicker: '計算機組織・第 7 章',
    title: 'I/O 與中斷',
    color: 'var(--ca)',
    modes: [
      { id: 'compare', name: '三種方式時間軸', enter: enterCompare },
      { id: 'overhead', name: 'CPU 負擔計算', enter: enterOverhead },
      { id: 'interrupt', name: '例外與中斷（MIPS）', enter: enterInterrupt },
      { id: 'arb', name: 'Bus arbitration', enter: enterArb },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['three-modes', 'programmed-io', 'interrupt-io', 'pio-limits', 'dma', 'dma-pros-cons',
      'mem-mapped-io', 'exception-epc', 'exc-vs-int', 'interrupt-flow', 'polling-cost', 'interrupt-cost', 'dma-cost', 'bus-types', 'handshake', 'arbitration', 'disk-time'],
    _genQ: genQ,
    stop() { stopTimer(); },
  };
}
