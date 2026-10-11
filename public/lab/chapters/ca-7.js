// 計算機組織 第7章：I/O 與中斷（programmed I/O／polling、interrupt-initiated I/O、DMA；
// MIPS 的 exception／interrupt 處理：EPC、Cause；polling／interrupt／DMA 的 CPU 負擔；bus、handshake、bus arbitration；磁碟存取時間）。
// 影片 E82x-cug9YE（Modes of Transfer）有字幕：場景 three-modes、programmed-io、interrupt-io、pio-limits、dma、dma-pros-cons 依它的順序與內容。
// Bus Arbitration 影片沒有逐字稿；其餘場景依 Patterson & Hennessy（MIPS 版）。
import kit from './_kit.js';

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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ io.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { tint, relabel } = P;
// ─── 計算機組織 第 7 章（E82x-cug9YE Modes of Transfer、Yp_3OrDhUkQ Bus Arbitration）— cued scenes ───
// 每個 scene = 一串 step 函式；影片講到那一句（notes 的 cue）才執行下一個。
// CPU 忙碌時間（示意模型）、DMA 搬了幾個 word、daisy chain／polling／independent request 誰拿到 bus、
// 線路數量，全部由程式模擬計算，再和畫面上的說法比對，顯示 ✓／✘。講者沒有給數字的例子標「示意」。
const WD = (ch) => (ch.charCodeAt(0) < 256 ? 0.55 : 1);
function brk(t, max = 34) {
  t = String(t); let tot = 0; for (const c of t) tot += WD(c); if (tot <= max + 4) return t;
  const out = []; let ln = '', len = 0;
  for (const c of t) { ln += c; len += WD(c); if ((len >= max && /[，；：、。）)→]/.test(c)) || (len >= max + 6 && c === ' ') || len >= max + 10) { out.push(ln.trim()); ln = ''; len = 0; } }
  if (ln.trim()) out.push(ln.trim()); return out.join('\n');
}
const wrapL = (l) => { if (l.element.textContent.includes('\n')) Object.assign(l.element.style, { whiteSpace: 'pre-line', textAlign: 'center', fontSize: '11.5px', lineHeight: '1.3' }); return l; };
const txt = (l, t) => { l.element.textContent = brk(t); wrapL(l); };
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => wrapL(tag(brk(t), 'ptr', x, y, z));
const hot = (t, x, y, z = 0) => wrapL(tag(brk(t), 'ptr alt', x, y, z));
const sm = (t, x, y, z = 0) => wrapL(tag(brk(t), 'idx', x, y, z));
const note = (t, x, y, z = 0) => wrapL(tag(brk(t), 'note', x, y, z));
const good = (t, x, y, z = 0) => wrapL(tag(brk(t), 'good', x, y, z));
const bad = (t, x, y, z = 0) => wrapL(tag(brk(t), 'bad', x, y, z));
const bub = (t, x, y, z = 0) => wrapL(tag(brk(t), 'say', x, y, z));
const ok = (b, x, y, t) => { if (!b) log('CHECK FAILED: ' + t, true); return b ? good(t, x, y) : bad(t.replace(/✓/g, '✘'), x, y); };
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.ls && typeof o.kill === 'function') return o.kill(); if (typeof o.all === 'function') return gone(o.all()); if (o.element) remove(o); else kill(o); });
const wt = (tok, ms) => ctx.beat(tok, ms);
const CAM = [[0, 3.9, 14.2], [0, 3.4, 0]];
function scene(id, title, steps, cam = CAM) {
  FRAG.push([id, title, async (tok) => {
    fresh(cam[0], cam[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
// a straight wire (horizontal or vertical) drawn as a thin box, so it can glow
function wire(x1, y1, x2, y2, color = '#b9a98c', th = 0.1) {
  const w = Math.max(th, Math.abs(x2 - x1)), h = Math.max(th, Math.abs(y2 - y1));
  return cube('', color, [w, h, th * 2], (x1 + x2) / 2, (y1 + y2) / 2, 0);
}
// a signal / data chip (label) travelling along a path of [x, y] points
async function go(tok, l, pts, ms = 900) {
  const ps = pts.map(([x, y]) => V3(x, y, 0.9));
  let tot = 0; const d = []; for (let i = 1; i < ps.length; i++) { d.push(ps[i].distanceTo(ps[i - 1])); tot += d[i - 1]; }
  for (let i = 1; i < ps.length; i++) await travel(tok, l, ps[i - 1], ps[i], Math.max(60, ms * d[i - 1] / tot));
}
async function chip(tok, text, pts, ms = 900, keep = false) {
  const l = tag(text, 'pkt', pts[0][0], pts[0][1], 0.9);
  await go(tok, l, pts, ms);
  if (!keep) remove(l);
  return l;
}

// ════════ E82x-cug9YE（Modes of Transfer：programmed I/O、interrupt-initiated I/O、DMA） ════════
// 小舞台：CPU、Memory 在上面，memory bus 在中間，I/O interface（或 DMA controller）與周邊裝置在下面
const CPU = [-4.6, 4.9], MEM = [4.6, 4.9], ITF = [0.6, 1.5], DEV = [4.6, 1.5], BY = 3.2;
const PATH = {
  devMem: [DEV, ITF, [ITF[0], BY], [MEM[0], BY], MEM],
  devCpu: [DEV, ITF, [ITF[0], BY], [CPU[0], BY], CPU],
  cpuMem: [CPU, [CPU[0], BY], [MEM[0], BY], MEM],
  memCpu: [MEM, [MEM[0], BY], [CPU[0], BY], CPU],
  cpuDev: [CPU, [CPU[0], BY], [ITF[0], BY], ITF, DEV],
  cpuItf: [CPU, [CPU[0], BY], [ITF[0], BY], ITF],
  itfCpu: [ITF, [ITF[0], BY], [CPU[0], BY], CPU],
  memDev: [MEM, [MEM[0], BY], [ITF[0], BY], ITF, DEV],
};
function rig(S, itfName = 'I/O interface') {
  S.cpu = cube('CPU', '#31aab0', [1.9, 1.1, 1.2], CPU[0], CPU[1]);
  S.mem = cube('Memory', '#c9b48e', [1.9, 1.3, 1.2], MEM[0], MEM[1]);
  S.bus = cube('', '#b9a98c', [12.2, 0.14, 0.3], 0, BY);
  S.busL = sm('memory bus', -5.4, BY + 0.38);
  S.itf = cube(itfName, itfName.startsWith('DMA') ? '#2fc092' : '#9b7ef4', [2.2, 0.9, 1.0], ITF[0], ITF[1]);
  S.dev = cube('周邊裝置', '#efe6d6', [1.8, 0.9, 1.0], DEV[0], DEV[1]);
  S.wires = [wire(CPU[0], BY, CPU[0], CPU[1] - 0.55), wire(MEM[0], BY, MEM[0], MEM[1] - 0.65), wire(ITF[0], ITF[1] + 0.45, ITF[0], BY), wire(ITF[0] + 1.1, ITF[1], DEV[0] - 0.9, DEV[1])];
}
// CPU 時間條（示意模型）：8 個 word，裝置每 20 cycles 準備好一個（t = 10, 30, …, 150），觀察 160 cycles
const TLN = 8, TLD = 20, TLT = 160, ISR = 6, SETUP = 10;
const READY = Array.from({ length: TLN }, (_, k) => 10 + TLD * k);
function cpuModel(mode) {
  const seg = [];
  if (mode === 'pio') { let t0 = 0; for (const t of READY) { seg.push([t0, t, 'poll'], [t, t + 2, 'xfer']); t0 = t + 2; } seg.push([t0, TLT, 'poll']); }
  if (mode === 'intr') for (const t of READY) seg.push([t, t + ISR, 'isr']);
  if (mode === 'dma') { seg.push([0, SETUP, 'setup']); for (const t of READY) seg.push([t, t + 1, 'steal']); seg.push([READY[TLN - 1] + 1, READY[TLN - 1] + 1 + ISR, 'isr']); }
  seg.sort((a, b) => a[0] - b[0]);
  let busy = 0, overlap = false, end = 0;
  for (const [a, b] of seg) { if (a < end) overlap = true; busy += b - a; end = Math.max(end, b); }
  return { seg, busy, free: TLT - busy, overlap, pct: Math.round((TLT - busy) / TLT * 100) };
}
const SEGC = { poll: '#d64545', xfer: '#dd8238', isr: '#e55a9b', setup: '#9b7ef4', steal: '#c08a1f' };
const SEGN = { poll: 'polling', xfer: '搬資料', isr: '中斷服務', setup: '設定 DMA', steal: '被偷的 cycle' };
function mkStrip(y = 7.0, x0 = -3.6, W = 7.2) {
  const k = W / TLT, st = { parts: [], k, x0, y }; st.all = () => st.parts;
  st.parts.push(cube('', '#2fc092', [W, 0.12, 0.5], x0 + W / 2, y - 0.12));
  st.parts.push(sm('CPU 的時間（示意：' + TLT + ' cycles）', x0 - 1.9, y));
  st.seg = (a, b, kind) => { const w = Math.max(0.03, (b - a) * k); const m = cube('', SEGC[kind], [w, 0.38, 0.55], x0 + a * k + w / 2, y); st.parts.push(m); return m; };
  st.draw = async (tok, model, ms = 1600) => { const n = model.seg.length; for (let i = 0; i < n; i++) { const [a, b, kd] = model.seg[i]; st.seg(a, b, kd); if (i % Math.max(1, Math.round(n / 12)) === 0) await wt(tok, ms / Math.min(12, n)); } };
  return st;
}

scene('cio-three', 'Modes of transfer：memory 才是 source 與 target', [
  async (tok, S) => { // @32.2
    rig(S);
    S.bits = tag('0101', 'pkt', DEV[0], DEV[1] + 0.8, 0.9);
    S.t = hd('電腦處理的是 binary 資訊（0 與 1）', 0, 7.2);
    cap('電腦處理的是 binary 資訊', '外部裝置送來的也是 0 與 1');
  },
  async (tok, S) => { // @46.0
    await go(tok, S.bits, PATH.devMem, 1800);
    glow(S.mem, '#6a4a00');
    S.n1 = note('外部裝置送來的每一筆資料 → 最後都存進 memory', 0, 0.2);
    cap('外部裝置的資料最後存進 memory', '以 binary 的形式存');
  },
  async (tok, S) => { // @57.7
    gone(S.n1); glow(S.mem, null);
    await chip(tok, '0110', [...PATH.memCpu, [CPU[0], BY], [ITF[0], BY], ITF, DEV], 2400);
    S.n1 = note('CPU 送到外部裝置的資料 → 也是從 memory 出發', 0, 0.2);
    cap('CPU 送出去的資料也來自 memory', '');
  },
  async (tok, S) => { // @67.4
    glow(S.cpu, '#6a4a00');
    S.c1 = bub('CPU 只是處理、居中轉手', CPU[0], CPU[1] + 1.1);
    cap('CPU 只負責處理資訊', '');
  },
  async (tok, S) => { // @74.5
    glow(S.cpu, null); gone(S.n1);
    glow(S.mem, '#0f5a3a');
    S.m1 = hot('source 與 target 永遠是 memory', MEM[0], MEM[1] + 1.1);
    cap('真正的 source 與 target 是 memory', 'memory unit is the source and target');
  },
  async (tok, S) => { // @84.2
    gone(S.t, S.c1, S.bits); glow(S.mem, null);
    S.t = hd('CPU ↔ I/O 的資料傳輸：有不同的 mode', 0, 7.2);
    cap('CPU 與 I/O 的資料傳輸', '可以用不同的 mode 來做');
  },
  async (tok, S) => { // @93.4
    S.n1 = note('有的 mode：CPU 是中間路徑', -2.6, 0.2);
    glow(S.cpu, '#6a4a00');
    await chip(tok, 'data', [...PATH.devCpu, [CPU[0], BY], [MEM[0], BY], MEM], 2200);
    glow(S.cpu, null);
    cap('有的 mode：資料經過 CPU', 'CPU 是 intermediate path');
  },
  async (tok, S) => { // @96.5
    S.n2 = note('有的 mode：memory ↔ I/O 直接傳', 3.0, 0.2);
    await chip(tok, 'data', PATH.devMem, 1500);
    cap('有的 mode：memory 與 I/O 直接傳', '不經過 CPU');
  },
  async (tok, S) => { // @110.8
    gone(S.n1, S.n2, S.m1);
    S.list = ['① Programmed I/O', '② Interrupt-initiated I/O', '③ Direct Memory Access（DMA）'].map((s, k) => hot(s, 0, 6.4 - k * 0.62));
    cap('三種方式', 'programmed I/O、interrupt I/O、DMA');
  },
]);

scene('cio-pio', 'Programmed I/O：CPU 一直 polling（busy waiting）', [
  async (tok, S) => { // @129.2
    rig(S);
    S.t = hd('① Programmed I/O：最簡單的 I/O 方式', 0, 7.5);
    cap('第一種：Programmed I/O', '最簡單的 input-output 方式');
  },
  async (tok, S) => { // @137.1
    glow(S.cpu, '#6a4a00');
    S.c1 = bub('所有工作都由 CPU 做', CPU[0], CPU[1] + 1.1);
    cap('CPU 要做所有的事', 'every work is done by the CPU');
  },
  async (tok, S) => { // @154.1
    glow(S.cpu, null);
    await chip(tok, 'data', PATH.devCpu, 1600);
    S.n1 = note('processor ↔ I/O module：資料一定經過 CPU', 0, 0.2);
    cap('processor 與 I/O module 之間傳資料', 'transfer is via CPU only');
  },
  async (tok, S) => { // @170.2
    gone(S.c1, S.n1);
    S.code = code(['loop: lw  $t0, STATUS   # 讀狀態', '      beq $t0, $0, loop  # 還沒 ready', '      lw  $t1, DATA     # 讀資料', '      sw  $t1, 0($a0)   # 存進 memory'], -0.6, 6.85, 0.44);
    S.cn = sm('程式裡的 I/O 指令（示意，MIPS 風格）', -0.6, 5.0);
    cap('I/O 指令寫在程式裡', '程式執行到它們才傳資料');
  },
  async (tok, S) => { // @181.7
    S.code.hl(2); glow(S.cpu, '#6a4a00');
    S.reg = tag('$t1', 'pkt', CPU[0] - 0.4, CPU[1] - 1.0, 0.9);
    await chip(tok, 'data', PATH.devCpu, 1300);
    S.n1 = note('每一筆資料，都要由程式裡的一個指令發動', 0, 0.2);
    cap('每一筆資料都由一個指令發動', 'lw 把資料讀進 CPU 暫存器');
  },
  async (tok, S) => { // @190.3
    S.code.hl(3); remove(S.reg);
    await chip(tok, '$t1', PATH.cpuMem, 1500);
    glow(S.cpu, null);
    txt(S.n1, '通常是：CPU 暫存器 ↔ memory');
    cap('通常是 CPU 暫存器與 memory 之間', 'sw 把暫存器存進 memory');
  },
  async (tok, S) => { // @198.4
    gone(S.n1);
    S.code.hl(0); S.polls = 1; glow(S.cpu, '#7a1010');
    await chip(tok, 'ready?', PATH.cpuItf, 900);
    await chip(tok, 'status = 0', PATH.itfCpu, 900);
    S.code.hl(1);
    S.pc = bad('polling 第 1 次：還沒 ready', CPU[0], 6.05);
    cap('CPU 必須一直監看周邊裝置', 'constant monitoring by the CPU');
  },
  async (tok, S) => { // @209.8
    for (let k = 0; k < 2; k++) {
      S.code.hl(0); await chip(tok, 'ready?', PATH.cpuItf, 600);
      await chip(tok, 'status = 0', PATH.itfCpu, 600); S.code.hl(1); S.polls++;
      txt(S.pc, 'polling 第 ' + S.polls + ' 次：還沒 ready');
    }
    cap('一直問：裝置 ready 了沒？', 'ready for data transfer or not');
  },
  async (tok, S) => { // @218.4
    gone(S.code, S.cn);
    S.m = cpuModel('pio'); S.st = mkStrip(7.0);
    await S.st.draw(tok, S.m, 1800);
    S.n1 = note('CPU 一直忙著 polling（紅）與搬資料（橘）', 1.2, 6.3);
    cap('CPU 一直處在忙碌狀態', '忙著監看裝置');
  },
  async (tok, S) => { // @227.5
    S.other = bad('其他程式：等不到 CPU', CPU[0], 6.6);
    cap('這段時間 CPU 不能做別的事', '只有在監看');
  },
  async (tok, S) => { // @235.0
    gone(S.n1);
    S.c2 = ok(S.m.busy === TLT && S.m.free === 0 && !S.m.overlap, 1.2, 6.3, 'CPU 可以做別的事：' + S.m.free + ' / ' + TLT + ' cycles = ' + S.m.pct + '% ✓');
    cap('所以非常耗時間', 'CPU 白白忙著監看');
  },
  async (tok, S) => { // @246.0
    gone(S.pc);
    S.pro = good('優點：簡單、硬體很少', -2.6, 0.2);
    cap('優點：容易實作', '需要的硬體很少');
  },
  async (tok, S) => { // @253.0
    S.con = bad('缺點：busy waiting（一直空等）', 2.8, 0.2);
    S.code0 = await chip(tok, 'ready?', PATH.cpuItf, 700);
    cap('缺點：busy waiting', 'CPU 一直監看周邊 ready 了沒');
  },
  async (tok, S) => { // @266.6
    glow(S.cpu, '#7a1010');
    S.n2 = note('把 CPU 綁住很久，卻沒做有用的事', 0, 1.0);
    cap('CPU 被綁住很久', '卻沒有做有用的事');
  },
]);

scene('cio-intr', 'Interrupt-initiated I/O：ready 才發 interrupt request', [
  async (tok, S) => { // @275.8
    rig(S);
    S.t = hd('② Interrupt-initiated I/O', 0, 7.5);
    S.work = hot('CPU：主程式 執行中', CPU[0], 6.3);
    cap('第二種：Interrupt-initiated I/O', '');
  },
  async (tok, S) => { // @282.5
    glow(S.cpu, '#6a4a00');
    txt(S.work, 'CPU：主程式（被打斷、暫停）');
    cap('interrupt：正在做的事被打斷', 'some task is stopped');
  },
  async (tok, S) => { // @291.3
    txt(S.work, 'CPU：先處理別的事'); await wt(tok, 900);
    txt(S.work, 'CPU：回到主程式（resume）'); glow(S.cpu, null);
    cap('先處理別的事', '再 resume 原本的工作');
  },
  async (tok, S) => { // @298.1
    S.n1 = bad('programmed I/O 的限制：CPU 一直 polling', -1.6, 0.2);
    await chip(tok, 'ready?', PATH.cpuItf, 800);
    S.n2 = good('這種方式把它解決了', 3.6, 0.2);
    cap('解決 programmed I/O 的限制', 'CPU 不再一直監看');
  },
  async (tok, S) => { // @314.9
    gone(S.n1, S.n2);
    glow(S.cpu, '#0f5a3a');
    S.n1 = note('CPU 不必一直忙：靠 interrupt 機制', 0, 0.2);
    cap('CPU 不用一直忙', '用的是 interrupt 的概念');
  },
  async (tok, S) => { // @329.7
    await chip(tok, 'command', PATH.cpuItf, 1300);
    glow(S.itf, '#6a4a00');
    txt(S.n1, 'CPU 先送特別的 command 給 interface：資料好了就發 interrupt request');
    cap('special command 送到 interface', '讓 interface 能發 interrupt request');
  },
  async (tok, S) => { // @345.3
    glow(S.itf, null);
    S.dv = sm('資料準備中…', DEV[0], DEV[1] - 0.85);
    txt(S.n1, '什麼時候發？裝置的資料 available（ready）的時候');
    cap('為什麼要 interrupt request？', '資料好了時才發');
  },
  async (tok, S) => { // @356.4
    for (let k = 1; k <= 3; k++) { txt(S.work, 'CPU：執行其他程式 第 ' + k + ' 段'); await wt(tok, 600); }
    txt(S.n1, '同時，CPU 繼續執行其他程式');
    cap('在這段期間', 'CPU 可以繼續執行別的程式');
  },
  async (tok, S) => { // @360.9
    glow(S.itf, '#6a4a00');
    for (let k = 0; k < 2; k++) { await chip(tok, '?', [ITF, DEV], 450); await chip(tok, '還沒', [DEV, ITF], 450); }
    txt(S.n1, '一直監看裝置的是 interface，不是 CPU');
    cap('interface 持續監看裝置', 'the interface monitors the device');
  },
  async (tok, S) => { // @370.2
    glow(S.itf, null); glow(S.dev, '#0f5a3a'); txt(S.dv, '資料 ready！');
    await chip(tok, 'IRQ', PATH.itfCpu, 1500);
    glow(S.cpu, '#6a4a00');
    txt(S.n1, '裝置 ready 時，interface 才送出 interrupt request（IRQ）');
    cap('裝置 ready 才發 IRQ', 'interrupt request signal');
  },
  async (tok, S) => { // @387.7
    txt(S.work, 'CPU：主程式（暫停）');
    txt(S.n1, 'CPU 看到訊號 → 停下目前正在執行的工作');
    cap('CPU 看到 IRQ', '停下目前正在做的工作');
  },
  async (tok, S) => { // @399.1
    txt(S.work, 'CPU：服務這個 request');
    await chip(tok, 'data', [...PATH.devCpu, [CPU[0], BY], [MEM[0], BY], MEM], 2200);
    glow(S.dev, null); txt(S.dv, '');
    txt(S.n1, '去處理這個 request：把資料搬好');
    cap('去執行這個 request', '把資料搬走');
  },
  async (tok, S) => { // @403.7
    glow(S.cpu, '#0f5a3a');
    txt(S.work, 'CPU：回到主程式，把它做完');
    txt(S.n1, '做完後回到原本的工作，繼續完成');
    cap('處理完回到原本的工作', '把它完成');
  },
  async (tok, S) => { // @414.5
    gone(S.work, S.t);
    S.m = cpuModel('intr'); S.st = mkStrip(7.0);
    await S.st.draw(tok, S.m, 1600);
    S.c = ok(S.m.free === TLT - TLN * ISR && !S.m.overlap, 0, 6.3, '只在 8 次中斷時忙：可做別的事 ' + S.m.free + ' / ' + TLT + ' = ' + S.m.pct + '% ✓');
    txt(S.n1, '不必一直監看；裝置 ready 時 interface 才發 IRQ');
    cap('不必一直監看周邊', 'ready 時才由 interface 發 IRQ');
  },
]);

scene('cio-limits', '前兩種的共同缺點：每筆都靠處理器', [
  async (tok, S) => { // @429.4
    rig(S);
    S.a = hot('Programmed I/O', -2.4, 7.3); S.b = hot('Interrupt-initiated I/O', 2.4, 7.3);
    cap('回顧兩種方式', 'programmed I/O 與 interrupt I/O');
  },
  async (tok, S) => { // @440.3
    S.t = hd('兩者都有兩個大缺點', 0, 6.6);
    cap('兩者都有兩個主要缺點', '');
  },
  async (tok, S) => { // @443.5
    S.ins = 0; S.cnt = bad('', CPU[0], 6.0);
    for (let w = 0; w < 4; w++) {
      glow(S.cpu, '#6a4a00');
      await chip(tok, 'w' + w, [...PATH.devCpu, [CPU[0], BY], [MEM[0], BY], MEM], 560);
      S.ins += 2; txt(S.cnt, 'CPU 執行的搬運指令：' + S.ins);
    }
    glow(S.cpu, null);
    S.c = ok(S.ins === 4 * 2, 0, 0.2, '① 每筆傳輸都由處理器管：4 個 word × 2 個指令 = 8 個指令 ✓（示意）');
    cap('① 每筆 I/O 都由處理器管理', '每次都要執行好幾個指令');
  },
  async (tok, S) => { // @453.8
    gone(S.c);
    glow(S.cpu, '#7a1010');
    S.q = ['w4', 'w5', 'w6'].map((w, k) => tag(w, 'pkt', ITF[0] - 0.9 + k * 0.9, ITF[1] + 0.85, 0.9));
    S.c = note('② 傳輸率受限於處理器的速度：資料排隊等 CPU', 0, 0.2);
    cap('② I/O 傳輸率受限於處理器速度', '資料一定要等 CPU 搬');
  },
  async (tok, S) => { // @465.9
    gone(S.q, S.c); glow(S.cpu, null);
    relabel(S.itf, 'DMA controller'); tint(S.itf, '#2fc092');
    await chip(tok, 'data', PATH.devMem, 1500);
    S.c = good('③ DMA：資料直接進 memory，兩個缺點都解決', 0, 0.2);
    cap('這兩個缺點', '由第三種方式 DMA 解決');
  },
]);

scene('cio-dma', 'DMA：CPU 只發動，bus request／grant 後直接傳（cycle stealing）', [
  async (tok, S) => { // @475.5
    rig(S, 'DMA controller');
    S.t = hd('③ DMA：interface 經 memory bus 直接搬進／搬出 memory', 0, 7.5);
    await chip(tok, 'data', PATH.devMem, 1700);
    cap('Direct memory access', 'interface 經 memory bus 直接搬資料');
  },
  async (tok, S) => { // @484.7
    glow(S.cpu, '#0f5a3a');
    S.work = hot('CPU：做自己的事', CPU[0], 6.3);
    S.n1 = note('資料在 memory 與 I/O 之間傳，不用每次都找 CPU', 0, 0.2);
    cap('memory 與 I/O 之間直接傳', '不必每次都動用 CPU');
  },
  async (tok, S) => { // @492.8
    await chip(tok, '起始位址 A000、4 個 word', PATH.cpuItf, 1600);
    S.reg = { addr: 0xA000, cnt: 4 };
    S.rl = sm('DMA 暫存器：位址 A000、剩 4 個（示意）', -2.4, 2.45);
    txt(S.n1, 'CPU 只負責「發動」：把起始位址等資訊交給 interface');
    cap('CPU initiates the transfer', '提供起始位址給 interface');
  },
  async (tok, S) => { // @495.8
    relabel(S.dev, '磁碟／磁帶'); glow(S.dev, '#6a4a00');
    txt(S.n1, '適合快速的儲存裝置（magnetic disk、tape）和 memory 之間傳');
    cap('快速儲存裝置 ↔ memory', 'magnetic disk、magnetic tape');
  },
  async (tok, S) => { // @521.0
    glow(S.dev, null);
    S.a1 = arrow(V3(DEV[0] - 0.2, DEV[1] + 0.5, 0.5), V3(MEM[0] - 0.2, MEM[1] - 0.7, 0.5), 0x2fc092);
    txt(S.n1, '周邊裝置經由 memory 直接交換資料');
    cap('周邊經由 memory 直接溝通', '這就是 DMA');
  },
  async (tok, S) => { // @540.5
    gone(S.a1);
    await chip(tok, 'bus request', [ITF, [ITF[0], BY], [CPU[0], BY], CPU], 1400);
    txt(S.n1, '要傳時，DMA 先經 memory bus 要一個 memory cycle（bus request）');
    cap('DMA 要求 memory cycle', 'request through the memory bus');
  },
  async (tok, S) => { // @547.3
    await chip(tok, 'bus grant', PATH.itfCpu.slice().reverse(), 1000);
    tint(S.bus, '#2fc092');
    await chip(tok, 'w0', PATH.devMem, 1100);
    S.reg.addr++; S.reg.cnt--; S.got = ['w0'];
    txt(S.rl, 'DMA 暫存器：下一個位址 A00' + (S.reg.addr - 0xA000) + '、剩 ' + S.reg.cnt + ' 個');
    txt(S.n1, '被允許（grant）後，DMA 直接把資料寫進 memory');
    cap('request 被 grant', 'DMA 直接把資料寫進 memory');
  },
  async (tok, S) => { // @557.6
    tint(S.bus, '#b9a98c');
    S.st = mkStrip(7.0); S.st.seg(0, SETUP, 'setup'); S.st.seg(READY[0], READY[0] + 1, 'steal');
    txt(S.work, 'CPU：要讀 memory → 等 1 個 cycle');
    S.n2 = sm('課本稱 cycle stealing：DMA 偷用一個 bus cycle', 3.2, 2.45);
    txt(S.n1, 'CPU 只是把自己的 memory 存取延後一下');
    cap('CPU 只延後自己的 memory 存取', '課本：cycle stealing');
  },
  async (tok, S) => { // @569.4
    for (let w = 1; w < 4; w++) {
      tint(S.bus, '#2fc092');
      await chip(tok, 'w' + w, PATH.devMem, 600);
      tint(S.bus, '#b9a98c');
      S.st.seg(READY[w], READY[w] + 1, 'steal');
      S.reg.addr++; S.reg.cnt--; S.got.push('w' + w);
      txt(S.rl, 'DMA 暫存器：下一個位址 A00' + (S.reg.addr - 0xA000) + '、剩 ' + S.reg.cnt + ' 個');
    }
    S.c = ok(S.reg.cnt === 0 && S.got.join() === 'w0,w1,w2,w3' && S.reg.addr === 0xA004, 1.4, 6.3, '4 個 word 寫進 A000–A003，每個只偷 1 個 cycle ✓');
    txt(S.work, 'CPU：每次只等一下下');
    cap('只是延遲一下', '每個 word 偷一個 cycle');
  },
  async (tok, S) => { // @574.3
    gone(S.c, S.n2);
    tint(S.bus, '#2fc092'); glow(S.cpu, '#555555');
    txt(S.work, 'CPU：此刻沒有 bus 控制權');
    txt(S.n1, 'DMA 傳輸期間：bus 由 DMA controller 掌控，CPU 不能用 memory bus');
    cap('DMA 期間 CPU 沒有 bus 控制權', 'it has no control over the memory bus');
  },
  async (tok, S) => { // @583.0
    glow(S.cpu, '#0f5a3a'); tint(S.bus, '#b9a98c'); gone(S.st);
    S.m = cpuModel('dma'); S.st = mkStrip(7.0);
    await S.st.draw(tok, S.m, 1400);
    S.c = ok(S.m.busy === SETUP + TLN + ISR && !S.m.overlap, 1.4, 6.3, '8 個 word：設定 10 + 偷 8 + 結束中斷 6 = 24 cycles → 可做別的事 ' + S.m.pct + '% ✓');
    S.n2 = sm('課本：傳完一整塊才發一次 interrupt；另有 burst mode（一次佔住 bus 傳整塊）', 3.2, 2.45);
    txt(S.n1, 'DMA controller 掌控 bus、直接傳 → 很有利，是首選');
    cap('DMA controller 掌控 bus', '直接傳，很划算');
  },
]);

scene('cio-dmapc', 'DMA 的優缺點：成本、cache coherence', [
  async (tok, S) => { // @596.7
    rig(S, 'DMA controller');
    S.pro = hd('優點', -3.4, 7.4); S.con = hd('缺點', 3.4, 7.4);
    await chip(tok, 'data', PATH.devMem, 1500);
    S.p1 = good('周邊直接讀寫 memory，不經 CPU', -3.4, 6.7);
    cap('優點：周邊直接讀寫 memory', '不需要 CPU 參與');
  },
  async (tok, S) => { // @604.1
    glow(S.cpu, '#0f5a3a');
    S.w = hot('CPU：同時在算別的', CPU[0], 3.75);
    for (let k = 0; k < 2; k++) await chip(tok, 'w' + k, PATH.devMem, 700);
    S.p2 = good('傳輸時 CPU 能做別的事 → 處理更快', -3.4, 6.1);
    cap('優點：處理更快', '傳輸時 processor 可以做別的事');
  },
  async (tok, S) => { // @617.3
    gone(S.w); glow(S.cpu, null); glow(S.itf, '#6a4a00');
    S.c1 = bad('需要 DMA controller → 系統成本增加', 3.4, 6.7);
    cap('缺點：需要 DMA controller', '系統成本增加');
  },
  async (tok, S) => { // @632.1
    glow(S.itf, null);
    S.cache = cube('cache：X = 5', '#4b9ee2', [2.0, 0.55, 0.9], -2.2, 4.9);
    relabel(S.mem, 'Memory X = 5');
    const x = { cache: 5, mem: 5 };
    await chip(tok, 'X = 9', PATH.devMem, 1300);
    x.mem = 9; relabel(S.mem, 'Memory X = 9'); glow(S.mem, '#6a4a00'); tint(S.cache, '#d64545');
    S.c2 = ok(x.cache !== x.mem, 3.4, 6.1, 'DMA 改了 memory，cache 還是舊值 5 ≠ 9 → cache coherence 問題 ✓（示意）');
    cap('缺點：可能有 cache coherence 問題', 'cache 裡還是舊的值');
  },
  async (tok, S) => { // @639.5
    glow(S.mem, null);
    S.sum = note('DMA：快、CPU 自由；代價是 controller 成本與 coherence 問題', 0, 0.2);
    cap('這就是 DMA 的優缺點', '');
  },
]);

// ════════ Yp_3OrDhUkQ（Bus Arbitration：daisy chain、polling、independent request） ════════
const MST = [-5.0, 2.6], DX = [-1.6, 1.5, 4.6], DY = 2.6, YBR = 4.7, YBUSY = 4.05;
function arbRig(S, o = {}) {
  S.mst = cube('Bus master', '#31aab0', [1.9, 1.5, 1.2], MST[0], MST[1]);
  S.dev = DX.map((x, i) => cube('D' + (i + 1), '#c9b48e', [1.5, 1.0, 1.0], x, DY));
  S.pri = DX.map((x, i) => sm(o.noPri ? '' : ['最高優先', '中', '最低優先'][i], x, DY - 0.85));
  S.wires = [];
  if (o.br !== false) { S.br = wire(MST[0] + 0.95, YBR, 5.6, YBR, '#b9a98c', 0.08); S.wires.push(S.br, ...DX.map((x) => wire(x - 0.3, DY + 0.5, x - 0.3, YBR, '#b9a98c', 0.06))); S.brL = sm('BR（bus request）', -3.0, YBR + 0.32); }
  if (o.busy !== false) { S.busy = wire(MST[0] + 0.95, YBUSY, 5.6, YBUSY, '#b9a98c', 0.08); S.wires.push(S.busy, ...DX.map((x) => wire(x + 0.3, DY + 0.5, x + 0.3, YBUSY, '#b9a98c', 0.06))); S.busyL = sm('BUSY', -3.0, YBUSY + 0.3); }
  S.reqL = DX.map((x) => tag('', 'pkt', x, DY + 1.0, 0.9)); S.reqL.forEach((l) => (l.element.style.visibility = 'hidden'));
  S.req = [false, false, false];
  S.setReq = (i, on) => { S.req[i] = on; S.reqL[i].element.textContent = 'req'; S.reqL[i].element.style.visibility = on ? '' : 'hidden'; tint(S.dev[i], on ? '#dd8238' : '#c9b48e'); };
  S.own = -1;
  S.take = (i) => { S.own = i; S.dev.forEach((m, k) => glow(m, k === i ? '#0f5a3a' : null)); if (S.busy) tint(S.busy, i >= 0 ? '#d64545' : '#b9a98c'); if (i >= 0) S.setReq(i, false); };
}
// daisy chain：grant 從 master 出發，依序經過 D1、D2、D3；第一個有請求的攔下來
function daisy(req) { for (let i = 0; i < req.length; i++) if (req[i]) return { win: i, hops: i + 1 }; return { win: -1, hops: req.length }; }
// polling：master 從 start 開始依序把 device ID 放上 poll lines，第一個有請求且 ID 相符的拿到 bus
function pollFrom(req, start) { const seq = []; for (let k = 0; k < req.length; k++) { const i = (start + k) % req.length; seq.push(i); if (req[i]) return { win: i, seq }; } return { win: -1, seq }; }
// independent request：固定優先權（D1 最高）的 arbiter；bus 忙時大家等
function prio(req, order = [0, 1, 2]) { for (const i of order) if (req[i]) return i; return -1; }
const POLLBITS = (n) => Math.ceil(Math.log2(n + 1));  // ID 1..n 要幾條 poll line（0 保留給「沒人」）

scene('cio-arbwhy', 'Bus arbitration：誰先用 bus？priority 與 fairness', [
  async (tok, S) => { // @13.1
    S.b = [['data bus', '#4b9ee2'], ['address bus', '#9b7ef4'], ['control bus', '#dd8238']].map(([n, c], k) => [cube('', c, [10.4, 0.14, 0.3], 0.6, 6.4 - k * 0.5), sm(n, -5.6, 6.4 - k * 0.5)]);
    S.t = hd('system bus = data bus + address bus + control bus', 0.6, 7.5);
    cap('system bus 由三種 bus 組成', 'data、address、control bus');
  },
  async (tok, S) => { // @23.6
    S.mst = cube('arbitration', '#31aab0', [2.0, 1.2, 1.1], -5.0, 3.0);
    S.n = note('arbitration：決定誰可以使用 bus 來讀或寫', 0.6, 0.2);
    cap('arbitration：決定誰能用 bus', 'for reading or writing');
  },
  async (tok, S) => { // @37.6
    S.dev = DX.map((x, i) => cube('D' + (i + 1), '#dd8238', [1.5, 1.0, 1.0], x, 3.0));
    S.rq = DX.map((x) => tag('我要用 bus！', 'pkt', x, 4.0, 0.9));
    txt(S.n, '為什麼需要？好幾個裝置可能在同一時間都要用 bus');
    cap('多個裝置可能同時要用 bus', 'at the same time');
  },
  async (tok, S) => { // @62.2
    S.conn = DX.map((x) => wire(x, 3.5, x, 5.4, '#b9a98c', 0.06));
    S.qm = hot('先給誰？', -5.0, 4.2);
    txt(S.n, 'bus 接著很多裝置 → 必須決定先把 bus 交給哪一個');
    cap('必須決定先交給哪個裝置', '');
  },
  async (tok, S) => { // @81.1
    gone(S.qm); glow(S.mst, '#6a4a00');
    S.qm = hot('由 master 決定', -5.0, 4.2);
    txt(S.n, 'bus arbitration 就像一個 master：決定哪個裝置先用');
    cap('arbitration 就是 master', '決定誰先存取');
  },
  async (tok, S) => { // @92.0
    glow(S.mst, null);
    const w = 0; glow(S.dev[w], '#0f5a3a'); remove(S.rq[w]);
    S.d = tag('D1 的資料', 'pkt', DX[0], 5.4, 0.9);
    await travel(tok, S.d, V3(DX[0], 5.4, 0.9), V3(4.0, 6.4, 0.9), 1200);
    [1, 2].forEach((i) => { S.rq[i].element.textContent = '等一下'; });
    S.one = ok(S.dev.filter((m, i) => i === w).length === 1, 0.6, 1.2, '同一時間只服務 1 個裝置，其他人等 ✓');
    cap('一次只能服務一個裝置', '其他人要等');
  },
  async (tok, S) => { // @100.6
    gone(S.d, S.one, S.rq, S.conn, S.b, S.t); S.dev.forEach((m) => glow(m, null));
    S.t = hd('arbitration scheme：在 priority 與 fairness 之間取得平衡', 0.6, 7.3);
    S.beam = cube('', '#6e5f49', [6.0, 0.12, 0.4], 0.6, 5.7); S.piv = cube('', '#6e5f49', [0.3, 0.8, 0.3], 0.6, 5.25);
    S.L = hot('priority', -1.9, 6.15); S.R = hot('fairness', 3.1, 6.15);
    cap('平衡 bus priority 與 fairness', '');
  },
  async (tok, S) => { // @140.2
    S.order = [0, 1, 2];
    S.pr = S.order.map((i, k) => sm((k + 1) + '. D' + (i + 1), DX[i], 1.9));
    S.dev.forEach((m, i) => relabel(m, 'D' + (i + 1) + (i === 0 ? '（高）' : i === 2 ? '（低）' : '')));
    txt(S.n, 'priority：優先權最高的先服務，再輪到低的');
    cap('priority：最高優先的先服務', '之後才輪到低的');
  },
  async (tok, S) => { // @149.5
    S.ck = DX.map((x) => good('有被服務 ✓', x, 4.0));
    txt(S.n, 'fairness：是不是每個裝置都能被服務到');
    cap('fairness：每個裝置都有機會', '');
  },
  async (tok, S) => { // @166.0
    gone(S.ck, S.pr, S.beam, S.piv, S.L, S.R, S.t);
    S.t = hd('三種 arbitration mechanism', 0.6, 7.3);
    txt(S.n, '有三種機制可以決定把 bus 交給哪個裝置');
    cap('三種 arbitration mechanism', '');
  },
  async (tok, S) => { // @190.7
    S.m3 = ['① Daisy chain', '② Polling', '③ Independent request'].map((s, k) => hot(s, -2.6 + k * 3.6, 6.4));
    cap('daisy chain、polling', 'independent request');
  },
  async (tok, S) => { // @212.2
    S.lines = ['BR、BG、BUSY', 'BR、BUSY、poll lines', 'R/G 各一對、BUSY'].map((s, k) => sm(s, -2.6 + k * 3.6, 5.8));
    txt(S.n, '每一種都要用一些特別的 control lines');
    cap('每一種都用特別的 control lines', '');
  },
  async (tok, S) => { // @225.2
    txt(S.n, '目標都一樣：依 priority 服務裝置；只是各有各的規則');
    cap('目標：依 priority 服務裝置', '但各有自己的規則');
  },
]);

scene('cio-daisy', 'Daisy chain：grant 一個傳一個，近的優先', [
  async (tok, S) => { // @244.3
    S.t = hd('① Daisy chain arbitration', 0, 7.4);
    cap('第一種：daisy chain', '');
  },
  async (tok, S) => { // @261.3
    S.mst = cube('Bus master', '#31aab0', [1.9, 1.5, 1.2], MST[0], MST[1]);
    S.n = note('做決定的只有一個：bus master', 0, 0.2);
    cap('只有 master 能決定', '整個系統只有一個 bus master');
  },
  async (tok, S) => { // @295.5
    kill(S.mst); arbRig(S, { br: false, busy: false });
    txt(S.n, '接上三個裝置 D1、D2、D3');
    cap('三個裝置 D1、D2、D3', '');
  },
  async (tok, S) => { // @309.7
    gone(S.mst, S.dev, S.pri, S.reqL, S.wires); arbRig(S, {});
    // BG 串起來：master → D1 → D2 → D3
    S.bg = [wire(MST[0] + 0.95, DY, DX[0] - 0.75, DY, '#2fc092', 0.08), wire(DX[0] + 0.75, DY, DX[1] - 0.75, DY, '#2fc092', 0.08), wire(DX[1] + 0.75, DY, DX[2] - 0.75, DY, '#2fc092', 0.08)];
    S.bgL = sm('BG（bus grant）：一個串一個', -3.3, DY - 0.35);
    txt(S.n, '三條線：bus request（共用）、bus busy（共用）、bus grant（串成一條鏈）');
    cap('三條線：BR、BUSY、BG', 'BG 從 master 串過每個裝置');
  },
  async (tok, S) => { // @332.6
    [0, 1, 2].forEach((i) => S.setReq(i, true));
    tint(S.br, '#dd8238');
    const l = tag('BR', 'pkt', DX[2], YBR, 0.9); await travel(tok, l, V3(DX[2], YBR, 0.9), V3(MST[0] + 1.0, YBR, 0.9), 1200); remove(l);
    txt(S.n, '要用 bus 的裝置拉起 BR，送給 bus master（這裡三台都要，示意）');
    cap('裝置把 bus request 送給 master', '');
  },
  async (tok, S) => { // @340.8
    glow(S.mst, '#6a4a00');
    S.chk = hot('BUSY = 0：bus 空著', -3.0, YBUSY - 0.35);
    txt(S.n, 'master 先確認 bus 是空的（沒有人在用）');
    cap('master 先看 bus 是否空閒', '沒有裝置在傳資料');
  },
  async (tok, S) => { // @356.8
    gone(S.chk); glow(S.mst, null);
    S.pri.forEach((l, i) => { l.element.className = 'lab-label ' + (i === 0 ? 'ptr alt' : 'ptr'); });
    txt(S.n, '優先權由位置決定：離 master 最近的 D1 最高，D3 最低');
    cap('D1 優先權最高', 'D3 最低');
  },
  async (tok, S) => { // @369.5
    S.r = daisy(S.req);
    S.g = tag('BG', 'pkt', MST[0] + 1.0, DY + 0.45, 0.9);
    await travel(tok, S.g, V3(MST[0] + 1.0, DY + 0.45, 0.9), V3(DX[0], DY + 0.45, 0.9), 900);
    S.c = ok(S.r.win === 0, 0, 1.0, 'grant 先到 D1：D1 有請求 → 攔下來 ✓');
    cap('master 先把 grant 給 D1', '');
  },
  async (tok, S) => { // @380.3
    gone(S.c); remove(S.g); S.take(0); S.served = [0];
    S.c = sm('D1 拉起 BUSY：其他裝置不能再要 bus', 0, 1.0);
    txt(S.n, 'D1 拿到 bus，送出 busy 訊號');
    cap('D1 拿走 bus、送出 BUSY', '別人就不能再要 bus');
  },
  async (tok, S) => { // @394.3
    gone(S.c); S.take(-1);
    S.r = daisy(S.req);
    S.g = tag('BG', 'pkt', MST[0] + 1.0, DY + 0.45, 0.9);
    await travel(tok, S.g, V3(MST[0] + 1.0, DY + 0.45, 0.9), V3(DX[0], DY + 0.45, 0.9), 700);
    S.c = sm('D1 用完、釋放 bus；D1 不再請求 → grant 往下傳', 0, 1.0);
    await travel(tok, S.g, V3(DX[0], DY + 0.45, 0.9), V3(DX[1], DY + 0.45, 0.9), 800);
    txt(S.n, 'D1 做完就釋放 bus；下一次 grant 經過 D1 時，它不攔、往下一台傳（課本）');
    cap('D1 用完就釋放 bus', 'grant 傳給下一台');
  },
  async (tok, S) => { // @404.0
    gone(S.c); remove(S.g); S.take(S.r.win); S.served.push(S.r.win);
    S.c = ok(S.r.win === 1, 0, 1.0, 'D2 是下一個有請求的 → D2 拿到 bus ✓');
    cap('D2 接著拿到 bus', '');
  },
  async (tok, S) => { // @414.5
    gone(S.c); S.take(-1);
    S.r = daisy(S.req);
    S.g = tag('BG', 'pkt', MST[0] + 1.0, DY + 0.45, 0.9);
    await travel(tok, S.g, V3(MST[0] + 1.0, DY + 0.45, 0.9), V3(DX[2], DY + 0.45, 0.9), 1500);
    remove(S.g); S.take(S.r.win); S.served.push(S.r.win);
    S.c = ok(S.served.join() === '0,1,2', 0, 1.0, '服務順序 D1 → D2 → D3 ✓');
    cap('最後輪到 D3', '一個接一個，像一條鏈');
  },
  async (tok, S) => { // @424.5
    gone(S.c); S.take(-1);
    S.p = good('優點：構造很簡單', -2.6, 6.6);
    cap('優點：很簡單', '');
  },
  async (tok, S) => { // @436.7
    S.q = bad('缺點：不能保證 fairness', 2.6, 6.6);
    txt(S.n, '低優先權的裝置可能被無限期擋在外面（locked out）');
    cap('缺點：不能保證 fairness', '低優先權可能一直等');
  },
  async (tok, S) => { // @453.0
    // 示意：D3 一直請求，D1、D2 輪流又插隊請求
    S.setReq(2, true);
    const wins = [];
    for (const again of [0, 1, 0, 1]) {
      S.setReq(again, true);
      const r = daisy(S.req); wins.push(r.win); S.take(r.win); await wt(tok, 500); S.take(-1);
    }
    S.setReq(2, true);
    S.c = ok(!wins.includes(2) && wins.join() === '0,1,0,1', 0, 1.0, '4 輪都被 D1、D2 拿走，D3 一次都沒輪到 → starvation ✓（示意）');
    cap('高優先權一直插進來', 'D3 可能永遠等不到');
  },
  async (tok, S) => { // @484.7
    gone(S.c, S.p, S.q); [0, 1, 2].forEach((i) => S.setReq(i, false)); S.setReq(2, true);
    const r = daisy(S.req);
    S.g = tag('BG', 'pkt', MST[0] + 1.0, DY + 0.45, 0.9);
    for (let i = 0; i <= r.win; i++) { await travel(tok, S.g, S.g.position.clone(), V3(DX[i], DY + 0.45, 0.9), 450); glow(S.dev[i], '#6a4a00'); }
    S.c = ok(r.hops === 3, 0, 1.0, 'grant 要一台一台經過：到 D3 要過 ' + r.hops + ' 站 → 比較慢 ✓');
    txt(S.n, '另一個缺點：grant 要沿著鏈一路傳，限制了 bus 速度');
    cap('缺點：比較慢', 'grant 信號限制了 bus 速度');
  },
]);

scene('cio-poll', 'Polling：master 把 device ID 放上 poll lines', [
  async (tok, S) => { // @497.7
    S.t = hd('② Polling arbitration', 0, 7.4);
    cap('第二種：polling', '');
  },
  async (tok, S) => { // @509.0
    S.mst = cube('Bus master', '#31aab0', [1.9, 1.5, 1.2], MST[0], MST[1]);
    S.n = note('像 daisy chain，但沒有一路串下去的 bus grant：由 master 決定先服務誰', 0, 0.2);
    cap('像 daisy chain，但沒有串接的 grant', 'master 決定先服務誰');
  },
  async (tok, S) => { // @525.3
    kill(S.mst); arbRig(S, { noPri: true });
    S.dev.forEach((m, i) => relabel(m, 'D' + (i + 1)));
    txt(S.n, '一樣接三個裝置 D1、D2、D3，和幾條線');
    cap('裝置 D1、D2、D3', '');
  },
  async (tok, S) => { // @539.1
    S.nb = POLLBITS(3);
    S.pl = Array.from({ length: S.nb }, (_, k) => wire(MST[0] + 0.95, 1.5 - k * 0.3, 5.6, 1.5 - k * 0.3, '#9b7ef4', 0.07));
    S.plL = sm('poll lines', -3.2, 1.75);
    S.drop = DX.map((x) => wire(x, DY - 0.5, x, 1.5 - (S.nb - 1) * 0.3, '#9b7ef4', 0.05));
    txt(S.n, '三種線：poll lines、bus request、bus busy（用的時候送 busy）');
    cap('poll lines、BR、BUSY', '');
  },
  async (tok, S) => { // @560.6
    S.c = ok(S.nb === 2 && (1 << S.nb) - 1 >= 3, 0, 0.85, '3 台裝置用 ID 1–3：' + S.nb + ' 條 poll line 就能編碼 ✓（示意）');
    txt(S.n, '原本的 grant 改成「一組 poll lines」：上面放的是 device ID');
    cap('grant 改成一組 poll lines', '');
  },
  async (tok, S) => { // @584.9
    gone(S.c);
    S.setReq(1, true); S.setReq(2, true);
    tint(S.br, '#dd8238');
    const l = tag('BR', 'pkt', DX[1], YBR, 0.9); await travel(tok, l, V3(DX[1], YBR, 0.9), V3(MST[0] + 1.0, YBR, 0.9), 1000); remove(l);
    txt(S.n, '步驟 1：bus 沒在忙 → 裝置向 master 發 bus request（這裡 D2、D3，示意）');
    cap('1. bus 不忙 → 發 bus request', '');
  },
  async (tok, S) => { // @605.4
    S.r = pollFrom(S.req, 0); S.idL = hot('', -3.2, 1.0);
    for (const i of S.r.seq) {
      txt(S.idL, 'poll lines 上的 ID = ' + (i + 1) + '（' + (i + 1).toString(2).padStart(S.nb, '0') + '）');
      glow(S.dev[i], '#6a4a00'); await wt(tok, 900); glow(S.dev[i], null);
    }
    S.c = ok(S.r.seq.join() === '0,1' && S.r.win === 1, 0, 6.6, 'ID 1：D1 沒請求；ID 2：D2 有請求 → D2 回應 ✓');
    txt(S.n, '步驟 2：master 一個一個把 device ID 放上 poll lines，檢查誰有請求');
    cap('2. master 依序放 device ID', '一台一台檢查');
  },
  async (tok, S) => { // @644.9
    S.idTags = DX.map((x, i) => sm('ID ' + (i + 1), x, DY - 0.85));
    txt(S.n, '每個裝置都有自己的 ID；由 master 依 ID 決定先服務誰');
    cap('每個裝置有一個 ID', 'master 依 ID 決定');
  },
  async (tok, S) => { // @664.9
    gone(S.c); S.take(S.r.win); tint(S.br, '#b9a98c');
    S.c = sm('D2 拿到 bus → 拉起 BUSY', 0, 6.6);
    txt(S.n, '步驟 3：裝置拿到 bus grant → 標示 bus busy');
    cap('3. 拿到 grant → 標 bus busy', '');
  },
  async (tok, S) => { // @692.9
    gone(S.c);
    S.p = good('優點：沒有 daisy chain 的缺點', -2.6, 6.6);
    cap('優點：沒有 daisy chain 的缺點', '');
  },
  async (tok, S) => { // @709.6
    S.q0 = sm('daisy chain：沒有 fairness、比較慢；低優先權可能一直等', -2.6, 6.0);
    cap('daisy chain 的問題', '不公平、比較慢');
  },
  async (tok, S) => { // @733.6
    S.take(-1); S.setReq(1, true);  // D2 又想用
    S.r2 = pollFrom(S.req, (S.r.win + 1) % 3);
    for (const i of S.r2.seq) { txt(S.idL, 'poll lines 上的 ID = ' + (i + 1) + '（' + (i + 1).toString(2).padStart(S.nb, '0') + '）'); glow(S.dev[i], '#6a4a00'); await wt(tok, 700); glow(S.dev[i], null); }
    S.take(S.r2.win);
    S.c = ok(S.r2.win === 2, 2.6, 1.0, '這次從 ID 3 開始 poll → D3 先被服務，不會無限等 ✓（示意）');
    txt(S.n, '每台都有 ID：master 可以安排 poll 的順序，裝置不會無限期等下去');
    cap('每台有 ID → 不會無限期等待', 'master 決定服務順序');
  },
  async (tok, S) => { // @749.3
    gone(S.c);
    S.q = bad('缺點：要多幾條 poll lines（daisy chain 只要 1 條 grant）', 2.6, 6.6);
    S.pl.forEach((m) => glow(m, '#6a4a00'));
    cap('缺點：需要額外的 poll lines', 'daisy chain 只要一條 grant 線');
  },
  async (tok, S) => { // @766.2
    S.pl.forEach((m) => glow(m, null));
    S.c = bad('polling 一台一台問也要時間：和 grant 一樣有 delay', 0, 1.0);
    cap('polling 也有延遲', '就像 bus grant 一樣');
  },
]);

scene('cio-indep', 'Independent request：每台各有 request／grant，2N 條線', [
  async (tok, S) => { // @772.8
    S.t = hd('③ Independent request', 0, 7.4);
    S.n = note('名字就說明了：每個裝置彼此獨立地提出請求', 0, 0.2);
    cap('第三種：independent request', '每個裝置各自獨立');
  },
  async (tok, S) => { // @790.2
    arbRig(S, { br: false, noPri: true });
    S.dev.forEach((m, i) => relabel(m, 'D' + (i + 1)));
    // 每台一對獨立的 R_i（上）與 G_i（下）
    S.R = DX.map((x, i) => wire(MST[0] + 0.95, 5.3 + i * 0.32, x - 0.25, 5.3 + i * 0.32, '#dd8238', 0.06));
    S.Rv = DX.map((x, i) => wire(x - 0.25, DY + 0.5, x - 0.25, 5.3 + i * 0.32, '#dd8238', 0.05));
    S.G = DX.map((x, i) => wire(MST[0] + 0.95, 1.4 - i * 0.3, x + 0.25, 1.4 - i * 0.3, '#2fc092', 0.06));
    S.Gv = DX.map((x, i) => wire(x + 0.25, DY - 0.5, x + 0.25, 1.4 - i * 0.3, '#2fc092', 0.05));
    S.RL = sm('R1–R3（request）', -3.2, 6.35); S.GL = sm('G1–G3（grant）', -5.0, 1.1);
    txt(S.n, 'bus master 和 D1、D2、D3：每台都有自己的 request 線與 grant 線');
    cap('每台有自己的 R 線與 G 線', '');
  },
  async (tok, S) => { // @805.1
    S.setReq(0, true); glow(S.R[0], '#6a4a00');
    const l = tag('R1', 'pkt', DX[0], 5.3, 0.9); await travel(tok, l, V3(DX[0] - 0.25, 5.3, 0.9), V3(MST[0] + 1.0, 5.3, 0.9), 800); remove(l);
    S.w = prio(S.req); glow(S.R[0], null);
    const g = tag('G1', 'pkt', MST[0] + 1.0, 1.4, 0.9); await travel(tok, g, V3(MST[0] + 1.0, 1.4, 0.9), V3(DX[0] + 0.25, 1.4, 0.9), 800); remove(g);
    S.take(S.w); S.log = ['D1'];
    S.c = ok(S.w === 0, 0, 6.85, 'bus 空著：R1 → G1，D1 拿到 bus ✓');
    cap('D1 送 R1', 'master 回 G1');
  },
  async (tok, S) => { // @816.0
    gone(S.c);
    S.setReq(1, true);
    const l = tag('R2', 'pkt', DX[1], 5.62, 0.9); await travel(tok, l, V3(DX[1] - 0.25, 5.62, 0.9), V3(MST[0] + 1.0, 5.62, 0.9), 800); remove(l);
    S.c = sm('bus 正被 D1 使用 → D2 先等', 0, 6.85); await wt(tok, 500);
    S.take(-1); S.w = prio(S.req);
    const g = tag('G2', 'pkt', MST[0] + 1.0, 1.1, 0.9); await travel(tok, g, V3(MST[0] + 1.0, 1.1, 0.9), V3(DX[1] + 0.25, 1.1, 0.9), 800); remove(g);
    S.take(S.w); S.log.push('D' + (S.w + 1));
    gone(S.c); S.c = ok(S.w === 1, 0, 6.85, 'D1 釋放後 bus 空了 → G2 ✓');
    cap('D2 送 R2', 'bus 空了才給 G2');
  },
  async (tok, S) => { // @822.1
    gone(S.c);
    S.setReq(2, true);
    const l = tag('R3', 'pkt', DX[2], 5.94, 0.9); await travel(tok, l, V3(DX[2] - 0.25, 5.94, 0.9), V3(MST[0] + 1.0, 5.94, 0.9), 800); remove(l);
    S.take(-1); S.w = prio(S.req);
    const g = tag('G3', 'pkt', MST[0] + 1.0, 0.8, 0.9); await travel(tok, g, V3(MST[0] + 1.0, 0.8, 0.9), V3(DX[2] + 0.25, 0.8, 0.9), 800); remove(g);
    S.take(S.w); S.log.push('D' + (S.w + 1));
    S.c = ok(S.w === 2, 0, 6.85, 'D3 送 R3 → master 給 G3 ✓');
    cap('D3 送 R3', 'master 給 G3');
  },
  async (tok, S) => { // @835.0
    gone(S.c); glow(S.busy, '#6a4a00');
    S.c = sm('BUSY 線：大家共用，用 bus 的那台把它拉起來', 0, 6.85);
    cap('還有一條共用的 bus busy', '');
  },
  async (tok, S) => { // @851.4
    glow(S.busy, null); gone(S.c);
    S.setReq(0, true);
    S.c = sm('D3 還在用（BUSY）→ D1 必須等', 0, 6.85); await wt(tok, 900);
    S.take(-1); S.w = prio(S.req);
    const g = tag('G1', 'pkt', MST[0] + 1.0, 1.4, 0.9); await travel(tok, g, V3(MST[0] + 1.0, 1.4, 0.9), V3(DX[0] + 0.25, 1.4, 0.9), 800); remove(g);
    S.take(S.w); S.log.push('D' + (S.w + 1));
    gone(S.c); S.c = ok(S.w === 0, 0, 6.85, 'D3 釋放 bus 後，master 才送 G1 給 D1 ✓');
    cap('bus 忙時要等', '釋放後 master 才送 grant');
  },
  async (tok, S) => { // @864.7
    gone(S.c); S.take(-1);
    [0, 1, 2].forEach((i) => S.setReq(i, true));
    S.w = prio(S.req);
    await wt(tok, 500);
    S.take(S.w); S.log.push('D' + (S.w + 1));
    S.c = ok(S.w === 0, 0, 6.85, '三台同時請求 → 依 priority 給 D1（D1 最高，示意）✓');
    cap('bus 空了才送 grant', '還是依 priority 決定');
  },
  async (tok, S) => { // @885.9
    gone(S.c, S.t);
    S.steps = ['1. bus 不忙 → 送 bus request', '2. master 決定給誰：經 grant 線', '3. 拿到 grant → 標 bus busy', '4. 用完 → bus release'].map((s, k) => sm(s, 2.4, 7.4 - k * 0.42));
    await wt(tok, 400); S.take(-1);
    cap('步驟：request → grant', '→ busy → release');
  },
  async (tok, S) => { // @916.8
    gone(S.steps);
    S.p = good('優點：快、可以做 dynamic priority', -2.4, 7.2);
    S.order = [2, 0, 1];  // 示意：把 D3 調成最高
    S.dev.forEach((m, i) => relabel(m, 'D' + (i + 1) + '（第 ' + (S.order.indexOf(i) + 1) + '）'));
    S.w = prio(S.req, S.order); S.take(S.w);
    S.c = ok(S.w === 2, 2.6, 7.2, '把 D3 調成最高 → 這次給 D3 ✓（示意）');
    cap('優點：快、dynamic priority', 'priority 可以隨時調整');
  },
  async (tok, S) => { // @932.6
    gone(S.c); S.take(-1);
    const N = 3, rg = S.R.length + S.G.length;
    [...S.R, ...S.G].forEach((m) => glow(m, '#6a4a00'));
    S.q = ok(rg === 2 * N, 2.6, 7.2, '缺點：N 台要 2N 條線：3 台 → ' + rg + ' 條 ✓');
    cap('缺點：N 個裝置要 2N 條線', 'request 與 grant 各一條');
  },
  async (tok, S) => { // @952.5
    [...S.R, ...S.G].forEach((m) => glow(m, null)); gone(S.p, S.q);
    const N = 3;
    S.sum = [['Daisy chain', 'BR、BG、BUSY：3 條（與 N 無關）'], ['Polling', 'BR、BUSY + ' + POLLBITS(N) + ' 條 poll lines'], ['Independent', '2N = ' + 2 * N + ' 條 + BUSY']].map(([a, b], k) => sm(a + '：' + b, 2.0, 7.3 - k * 0.42));
    cap('三種：daisy chain、polling', 'independent request');
  },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
      'mem-mapped-io', 'exception-epc', 'exc-vs-int', 'interrupt-flow', 'polling-cost', 'interrupt-cost', 'dma-cost', 'bus-types', 'handshake', 'arbitration', 'disk-time'].concat(FRAG.map((f) => f[0])),
    _genQ: genQ,
    stop() { stopTimer(); },
  };
}
