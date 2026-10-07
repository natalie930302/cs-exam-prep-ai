// 計算機組織 第8章：平行與多核（Amdahl's law、strong/weak scaling、Flynn 分類、hardware multithreading、
// shared-memory multiprocessor、cache coherence（snooping、MSI/MESI）、GPU 基礎）。
// 影片 2dYV_lADfFI（Amdahl's Law）有字幕：場景 amdahl-intro、amdahl-split、amdahl-formula、amdahl-limit、amdahl-fp 依它的順序與數字。
// Cache Coherence 影片沒有逐字稿；其餘場景依 Patterson & Hennessy（MIPS 版）第 5、6 章。
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
  // 水平的時間條（從 x0 往右長）
  function hbar(color, x0, y, w, d = 0.8, h = 0.6, text = '') { const m = cube(text, color, [1, h, d], x0 + w / 2, y, 0); m.scale.x = Math.max(0.01, w); return m; }
  function setH(m, x0, w) { m.scale.x = Math.max(0.01, w); m.position.x = x0 + Math.max(0.01, w) / 2; }
  function bar(color, w, d, x, z = 0) { const m = lab.box(color, [w, 1, d]); m.scale.y = 0.001; m.position.set(x, 0, z); lab.world.add(m); return m; }
  function growBar(tok, m, h, ms) { const h0 = m.scale.y; return anim(tok, ms, (t) => { const v = Math.max(0.001, h0 + (h - h0) * t); m.scale.y = v; m.position.y = v / 2; }); }
  function polyline(pts, color) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color })); lab.world.add(l); return l; }
  const r2 = (x) => Math.round(x * 100) / 100;
  const r4 = (x) => Math.round(x * 10000) / 10000;
  const amdahl = (f, s) => 1 / ((1 - f) + f / s);

  // ───────────────────────── 模式 1：Amdahl's law ─────────────────────────
  const AM = { f: 0.2, s: 3 };
  const PX0 = -1.2, PW = 7.4, PH = 5.6; // 右側曲線圖：x = log2(N) 0..10，y = speedup / ymax
  function enterAmdahl() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 4, 14.5], [0, 3.2, 0]);
    tag('舊 CPU 時間 = 1', 'ptr', -4.2, 6.6);
    AM.old = hbar('#9aa0a6', -6.2, 5.8, 4, 0.8, 0.6);
    tag('新 CPU 時間', 'ptr alt', -4.2, 4.8);
    AM.un = hbar('#9aa0a6', -6.2, 4.0, 3, 0.8, 0.6); AM.en = hbar('#4b9ee2', -6.2, 4.0, 1, 0.8, 0.6);
    AM.unL = tag('', 'idx', -5, 3.4); AM.enL = tag('', 'idx', -3, 3.4);
    AM.spL = tag('', 'ptr alt', -4.2, 2.2);
    // 曲線圖軸
    polyline([V3(PX0, 0.4), V3(PX0 + PW, 0.4)], '#6e5f49'); polyline([V3(PX0, 0.4), V3(PX0, 0.4 + PH)], '#6e5f49');
    [1, 4, 16, 64, 256, 1024].forEach((n) => tag(String(n), 'idx', PX0 + Math.log2(n) / 10 * PW, 0.05));
    tag('處理器數 N（對數）', 'idx', PX0 + PW / 2, -0.4);
    AM.curve = polyline(Array.from({ length: 101 }, () => V3(0, 0)), '#4b9ee2');
    AM.asym = polyline([V3(0, 0), V3(0, 0)], '#d64545');
    AM.asymL = tag('', 'ptr', PX0 + PW - 1.0, 6.4);
    AM.dot = cube('', '#e55a9b', [0.25, 0.25, 0.25], 0, 0, 0.2);
    controls('<label>可加速比例 f <input id="aF" type="range" min="0" max="100" step="0.1" value="' + Math.round(AM.f * 100) + '" style="width:140px"></label> <b id="aFv"></b>'
      + '<label>加速倍數 s（或處理器數 N）<input id="aS" type="range" min="0" max="10" step="0.1" value="' + Math.log2(AM.s) + '" style="width:140px"></label> <b id="aSv"></b>'
      + '<button id="aEx">影片例：f = 20%、s = 3</button><button id="aEx2">P&H：100 顆要 90 倍</button>');
    $('aF').oninput = (e) => { AM.f = Number(e.target.value) / 100; updAmdahl(); };
    $('aS').oninput = (e) => { AM.s = Math.round(Math.pow(2, Number(e.target.value)) * 10) / 10; updAmdahl(); };
    on('aEx', () => { AM.f = 0.2; AM.s = 3; syncA(); log('影片例題：浮點指令占 20%，變 3 倍快 → 1 / (0.8 + 0.2/3) = 3 / 2.6 = 1.1538'); });
    on('aEx2', () => { AM.f = 0.999; AM.s = 100; syncA(); log('P&H：100 顆處理器想得到 90 倍，序列部分只能占 0.1%（f = 99.9%）'); });
    log('Amdahl\'s law：speedup = 1 / ((1 − f) + f / s)。灰色是沒被加速的 1 − f，藍色是被加速後的 f / s。');
    updAmdahl();
  }
  function syncA() { $('aF').value = String(Math.round(AM.f * 1000) / 10); $('aS').value = String(Math.log2(AM.s)); updAmdahl(); }
  function updAmdahl() {
    const f = AM.f, s = Math.max(1, AM.s), sp = amdahl(f, s);
    if ($('aFv')) { $('aFv').textContent = r2(f * 100) + '%'; $('aSv').textContent = String(s); }
    const W = 4;
    setH(AM.un, -6.2, (1 - f) * W); setH(AM.en, -6.2 + (1 - f) * W, f / s * W);
    AM.unL.position.x = -6.2 + (1 - f) * W / 2; txt(AM.unL, f < 1 ? '1−f = ' + r2(1 - f) : '');
    AM.enL.position.x = -6.2 + (1 - f) * W + f / s * W / 2 + 0.6; txt(AM.enL, 'f/s = ' + r4(f / s));
    txt(AM.spL, 'speedup = ' + r4(sp));
    const lim = f >= 1 ? Infinity : 1 / (1 - f);
    const ymax = Math.min(Math.max(4, Math.min(lim, amdahl(f, 1024)) * 1.15), 1100);
    const pts = []; for (let k = 0; k <= 100; k++) { const n = Math.pow(2, k / 10); pts.push(V3(PX0 + k / 100 * PW, 0.4 + Math.min(amdahl(f, n), ymax) / ymax * PH)); }
    AM.curve.geometry.setFromPoints(pts);
    const ly = isFinite(lim) && lim <= ymax ? 0.4 + lim / ymax * PH : 0.4 + PH;
    AM.asym.geometry.setFromPoints([V3(PX0, ly), V3(PX0 + PW, ly)]);
    AM.asym.visible = isFinite(lim) && lim <= ymax;
    txt(AM.asymL, isFinite(lim) ? '上限 1/(1−f) = ' + r2(lim) : '沒有上限（f = 100%）'); AM.asymL.position.y = Math.min(6.6, ly + 0.35);
    AM.dot.position.set(PX0 + Math.min(10, Math.log2(s)) / 10 * PW, 0.4 + Math.min(sp, ymax) / ymax * PH, 0.2);
    setState('Amdahl\'s law', [['f（被加速的比例）', r2(f * 100) + '%'], ['s（加速倍數）', String(s)], ['新時間', r4(1 - f) + ' + ' + r4(f / s) + ' = ' + r4(1 - f + f / s)], ['極限（s → ∞）', isFinite(lim) ? r2(lim) + ' 倍' : '∞']],
      'speedup = 1 / (' + r4(1 - f) + ' + ' + r4(f / s) + ') = <span class="ok">' + r4(sp) + '</span>');
  }

  // ───────────────────────── 模式 2：Hardware multithreading 的 issue slots ─────────────────────────
  const TH = { A: [3, 'L', 2, 1, 'S', 4, 2, 3, 1, 2, 'L', 3, 2, 1], B: [2, 2, 'S', 1, 3, 'L', 2, 1, 3, 2, 1, 2], C: [1, 'L', 3, 1, 2, 2, 'S', 3, 1, 2, 1, 2] };
  const THC = { A: '#4b9ee2', B: '#dd8238', C: '#2fc092' };
  const STALL = { S: 1, L: 4 };
  // 回傳每個 cycle 的 4 個 slot 內容（thread 名或 null）。
  // 模型：thread 發完一組指令後，若下一項是 stall（S/L），就從下一個 cycle 起被擋住 S=1、L=4 個 cycle。
  function schedule(policy, cycles = 12, width = 4) {
    const names = policy === 'single' ? ['A'] : ['A', 'B', 'C'];
    const st = {}; names.forEach((n) => { st[n] = { pos: 0, left: null, until: 0, long: false }; });
    const item = (n) => { const s = st[n]; if (s.left !== null) return s.left; return TH[n][s.pos % TH[n].length]; };
    const grid = []; let cur = 0, rr = 0;
    for (let c = 0; c < cycles; c++) {
      const row = new Array(width).fill(null);
      const ready = (n) => c >= st[n].until;
      const issue = (n, free) => {
        const s = st[n], it = item(n), k = Math.min(it, free);
        if (k < it) s.left = it - k; else { s.left = null; s.pos++; }
        if (s.left === null) { const nx = TH[n][s.pos % TH[n].length]; if (typeof nx !== 'number') { s.until = c + 1 + STALL[nx]; s.long = nx === 'L'; s.pos++; } }
        return k;
      };
      if (policy === 'single' || policy === 'coarse') {
        const n = names[cur];
        if (!ready(n)) {
          if (policy === 'coarse' && st[n].long) {
            const nx = names.findIndex((m, i) => i !== cur && ready(m));
            if (nx >= 0) { cur = nx; st[n].long = false; } // 換 thread：pipeline 要重新填，這個 cycle 浪費
          }
          grid.push(row); continue;
        }
        const k = issue(n, width);
        for (let j = 0; j < k; j++) row[j] = n;
      } else if (policy === 'fine') {
        for (let t = 0; t < names.length; t++) {
          const n = names[(rr + t) % names.length];
          if (!ready(n)) continue;
          const k = issue(n, width);
          for (let j = 0; j < k; j++) row[j] = n;
          break;
        }
        rr = (rr + 1) % names.length;
      } else {
        let used = 0;
        for (let t = 0; t < names.length && used < width; t++) {
          const n = names[(rr + t) % names.length];
          if (!ready(n)) continue;
          const k = issue(n, width - used);
          for (let j = 0; j < k; j++) row[used + j] = n;
          used += k;
        }
        rr = (rr + 1) % names.length;
      }
      grid.push(row);
    }
    return grid;
  }
  const POL = { single: '單一 thread（superscalar）', coarse: 'Coarse-grained MT', fine: 'Fine-grained MT', smt: 'SMT（simultaneous）' };
  async function drawGrid(tok, policy, xc, animate, ms = 160) {
    const g = schedule(policy);
    const sp = 0.42, rowH = 0.44;
    tag(POL[policy], 'ptr', xc, 6.9);
    let filled = 0;
    for (let c = 0; c < g.length; c++) {
      for (let k = 0; k < 4; k++) {
        const n = g[c][k];
        const x = xc + (k - 1.5) * sp, y = 6.2 - c * rowH;
        cube(n || '', n ? THC[n] : '#efe6d6', [sp * 0.9, rowH * 0.85, 0.4], x, y, 0);
        if (n) filled++;
      }
      if (animate) await wait(tok, ms);
    }
    const pctUsed = Math.round(filled / (g.length * 4) * 100);
    tag('用掉 ' + filled + ' / ' + g.length * 4 + ' 個 slot（' + pctUsed + '%）', 'ptr alt', xc, 6.2 - g.length * rowH - 0.1);
    return { filled, total: g.length * 4, pct: pctUsed };
  }
  const MT = { policy: 'smt' };
  function enterMT() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 3.6, 12], [0, 3.6, 0]);
    controls('<select id="tP">' + Object.keys(POL).map((k) => '<option value="' + k + '">' + POL[k] + '</option>').join('') + '</select><button class="primary" id="tGo">一個 cycle 一個 cycle 跑</button><button id="tAll">四種並排比較</button>');
    $('tP').value = MT.policy;
    $('tP').onchange = (e) => { MT.policy = e.target.value; enterMT(); };
    on('tGo', async () => { lab.clear(); legend(); const r = await drawGrid(undefined, MT.policy, 0, true, 120); mtState(r); });
    on('tAll', async () => { lab.clear(); legend(); for (const [k, x] of [['single', -4.8], ['coarse', -1.6], ['fine', 1.6], ['smt', 4.8]]) await drawGrid(undefined, k, x, false); setState('四種比較', [['單一 thread', '只有 A：stall 時整排空掉'], ['Coarse', '長 stall（L）才換 thread'], ['Fine', '每個 cycle 輪流'], ['SMT', '同一 cycle 混用多個 thread']], 'SMT 填得最滿：同時利用 <span class="ok">TLP 與 ILP</span>'); });
    log('4-wide superscalar，每列是一個 cycle、4 個 issue slot。A/B/C 三個 thread：數字 = 這個 cycle 能發幾個指令（ILP），S = 短 stall 1 cycle，L = 長 stall（cache miss）4 cycles。');
    legend();
    drawGrid(undefined, MT.policy, 0, false).then(mtState);
  }
  function legend() { tag('A', 'ptr', -5.6, 6.2).element.style.background = THC.A; tag('B', 'ptr', -5.6, 5.6).element.style.background = THC.B; tag('C', 'ptr', -5.6, 5.0).element.style.background = THC.C; }
  function mtState(r) {
    const why = { single: '一個 thread 的 ILP 有限、stall 時整個 cycle 浪費', coarse: '只在長 stall 換 thread；換的時候 pipeline 要重新填（浪費 1 cycle），短 stall 照樣浪費', fine: '每個 cycle 換一個 ready 的 thread → 藏住 stall；但每個 cycle 只發一個 thread 的指令', smt: '同一個 cycle 從多個 thread 發指令，把 slot 塞滿' };
    setState(POL[MT.policy], [['用掉的 slot', r.filled + ' / ' + r.total], ['使用率', r.pct + '%']], why[MT.policy]);
  }

  // ───────────────────────── 模式 3：Cache coherence（MSI／MESI，兩個 cache 窺探 bus） ─────────────────────────
  const CO = { proto: 'mesi' };
  const STC = { M: '#d64545', E: '#2fc092', S: '#4b9ee2', I: GRAY };
  const STN = { M: 'Modified', E: 'Exclusive', S: 'Shared', I: 'Invalid' };
  function makeCoh(o = {}) {
    const C = { proto: o.proto || 'mesi', st: ['I', 'I'], val: [null, null], mem: 0, ver: 0, busTx: 0 };
    C.cpu = [cube('P0', '#31aab0', [1.6, 0.8, 1], -3.8, 6.3, 0), cube('P1', '#31aab0', [1.6, 0.8, 1], 3.8, 6.3, 0)];
    C.cache = [cube('', GRAY, [2.6, 0.9, 1.1], -3.8, 4.8, 0), cube('', GRAY, [2.6, 0.9, 1.1], 3.8, 4.8, 0)];
    C.bus = cube('', '#b9a98c', [11.6, 0.14, 0.3], 0, 3.2, 0);
    tag('snooping bus', 'idx', -5.6, 2.8, 0.4);
    C.memM = cube('', '#c9b48e', [2.6, 0.9, 1.1], 0, 1.6, 0);
    C.busL = tag('', 'ptr alt', 0, 3.75);
    C.draw = () => {
      for (let p = 0; p < 2; p++) { tint(C.cache[p], STC[C.st[p]]); relabel(C.cache[p], C.st[p] + '（' + STN[C.st[p]] + '）' + (C.st[p] !== 'I' ? '  X=' + C.val[p] : '')); }
      relabel(C.memM, 'Memory X=' + C.mem);
    };
    async function busMsg(tok, from, text, toMem) {
      C.busTx++;
      txt(C.busL, text);
      glow(C.bus, GOLD);
      const g = cube(text.split('（')[0], '#e55a9b', [1.5, 0.4, 0.6], from === 0 ? -3.8 : 3.8, 4.8, 0.8);
      move(g, 0, 3.2, 0.8); await wait(tok, 450);
      move(g, toMem ? 0 : from === 0 ? 3.8 : -3.8, toMem ? 1.6 : 4.8, 0.8); await wait(tok, 450);
      kill(g); glow(C.bus, null);
    }
    // 回傳一句說明
    C.op = async (p, op, tok) => {
      const q = 1 - p, sp = C.st[p], sq = C.st[q];
      C.cache.forEach((m) => glow(m, null));
      glow(C.cpu[p], GOLD);
      let msg = '';
      if (op === 'R') {
        if (sp !== 'I') { msg = 'P' + p + ' read hit（' + sp + '），不用 bus'; glow(C.cache[p], GREEN); }
        else {
          await busMsg(tok, p, 'BusRd（read miss）', false);
          if (sq === 'M') { await busMsg(tok, q, 'Flush（寫回 X=' + C.val[q] + '）', true); C.mem = C.val[q]; C.st[q] = 'S'; msg = 'P' + q + ' 是 M：送出最新值並寫回記憶體，降為 S；P' + p + ' → S'; C.val[p] = C.val[q]; C.st[p] = 'S'; }
          else if (sq === 'E' || sq === 'S') { C.st[q] = 'S'; C.st[p] = 'S'; C.val[p] = C.mem; msg = '另一個 cache 也有（' + sq + '）→ 兩邊都是 S'; }
          else { C.st[p] = C.proto === 'mesi' ? 'E' : 'S'; C.val[p] = C.mem; msg = C.proto === 'mesi' ? '沒有別人有 → Exclusive（之後寫不用通知別人）' : 'MSI 沒有 E：讀進來就是 S'; }
          glow(C.cache[p], RED);
        }
      } else {
        const v = ++C.ver;
        if (sp === 'M') { msg = 'P' + p + ' write hit（M），不用 bus'; }
        else if (sp === 'E') { msg = 'E → M：只有自己有，不必廣播（MESI 的好處）'; }
        else if (sp === 'S') { await busMsg(tok, p, 'BusUpgr（invalidate）', false); if (sq !== 'I') C.st[q] = 'I'; msg = 'S → M：廣播 invalidate，P' + q + ' 的副本作廢'; }
        else {
          await busMsg(tok, p, 'BusRdX（write miss）', false);
          if (sq === 'M') { await busMsg(tok, q, 'Flush（寫回 X=' + C.val[q] + '）', true); C.mem = C.val[q]; }
          if (sq !== 'I') C.st[q] = 'I';
          msg = 'write miss：讀進來並使其他副本作廢 → M';
        }
        C.st[p] = 'M'; C.val[p] = v;
        glow(C.cache[p], RED);
        if (C.st[q] === 'I') glow(C.cache[q], null);
      }
      C.draw();
      glow(C.cpu[p], null);
      return msg;
    };
    C.draw();
    return C;
  }
  let coh = null, cohBusy = false;
  function enterCoh() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 4, 13.5], [0, 3.6, 0]);
    coh = makeCoh({ proto: CO.proto });
    controls('<select id="cP"><option value="mesi">MESI</option><option value="msi">MSI</option></select>'
      + '<button class="primary" id="c0R">P0 讀 X</button><button id="c0W">P0 寫 X</button><button class="primary" id="c1R">P1 讀 X</button><button id="c1W">P1 寫 X</button><button id="cRun">跑一串：P0讀 P1讀 P0寫 P1讀 P1寫</button><button id="cReset">重設</button>');
    $('cP').value = CO.proto; $('cP').onchange = (e) => { CO.proto = e.target.value; enterCoh(); };
    const go = async (p, op) => { if (cohBusy) return; cohBusy = true; try { const m = await coh.op(p, op); log('P' + p + (op === 'R' ? ' 讀' : ' 寫') + ' X：' + m); cohState(m); } finally { cohBusy = false; } };
    on('c0R', () => go(0, 'R')); on('c0W', () => go(0, 'W')); on('c1R', () => go(1, 'R')); on('c1W', () => go(1, 'W'));
    on('cReset', () => enterCoh());
    on('cRun', async () => { if (cohBusy) return; enterCoh(); for (const [p, op] of [[0, 'R'], [1, 'R'], [0, 'W'], [1, 'R'], [1, 'W']]) { await go(p, op); await sleep(500); } });
    log('Write-invalidate snooping、write-back cache。每個 cache 都監聽 bus：別人要寫，就把自己的副本作廢；別人要讀而自己是 M，就送出最新值。');
    cohState('');
  }
  function cohState(m) {
    setState(CO.proto.toUpperCase() + ' protocol', [['P0 的 X', coh.st[0] + (coh.st[0] !== 'I' ? '，值 ' + coh.val[0] : '')], ['P1 的 X', coh.st[1] + (coh.st[1] !== 'I' ? '，值 ' + coh.val[1] : '')], ['Memory 的 X', String(coh.mem)], ['bus 交易次數', String(coh.busTx)]],
      (m || '按按鈕讀寫 X') + '<br>規則：任一時刻最多一個 M；有 M 時其他都是 I');
  }

  // ───────────────────────── 模式 4：Strong／weak scaling 與負載平衡 ─────────────────────────
  const SC = { scal: 10, n: 10, p: 10, busy: 0 };
  function scCalc(o) {
    const work = o.n * o.n, seq = o.scal + work;
    const share = o.busy > 0 ? Math.max(o.busy / 100 * work, (1 - o.busy / 100) * work / (o.p - 1)) : work / o.p;
    const t = o.scal + share;
    return { seq, t, sp: seq / t, eff: seq / t / o.p };
  }
  function enterScaling() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 4, 13.5], [0, 3, 0]);
    controls('<label>純量加法 <input id="sS" type="number" min="0" max="100" value="' + SC.scal + '" style="width:50px"></label>'
      + '<label>矩陣 n×n，n = <input id="sN" type="number" min="2" max="200" value="' + SC.n + '" style="width:55px"></label>'
      + '<label>處理器 <input id="sP" type="number" min="1" max="1000" value="' + SC.p + '" style="width:60px"></label>'
      + '<label>最忙那顆分到 % <input id="sB" type="number" min="0" max="100" value="' + SC.busy + '" style="width:50px"></label>（0 = 平均分配）'
      + '<button class="primary" id="sGo">計算</button><button id="sEx">P&H 四種組合</button>');
    const rd = () => { const S = Number($('sS').value), N = Number($('sN').value), P = Number($('sP').value), B = Number($('sB').value); if (!(S >= 0 && N >= 2 && P >= 1 && B >= 0 && B <= 100) || (B > 0 && P < 2)) { log('數值不合理：處理器至少 1 顆，指定最忙比例時至少 2 顆。', true); return; } Object.assign(SC, { scal: S, n: N, p: P, busy: B }); drawScaling(); };
    on('sGo', rd);
    on('sEx', async () => { for (const [n, p] of [[10, 10], [10, 100], [100, 10], [100, 100]]) { Object.assign(SC, { scal: 10, n, p, busy: 0 }); $('sN').value = n; $('sP').value = p; $('sB').value = 0; drawScaling(); await sleep(1400); } });
    log('P&H 例：10 個純量相加（只能循序）+ 一個 n×n 矩陣相加（可平行）。一個加法花時間 t。');
    drawScaling();
  }
  function drawScaling() {
    lab.clear();
    const r = scCalc(SC);
    const k = 11 / r.seq;
    tag('1 顆處理器：' + r.seq + 't', 'ptr', -3.4, 6.2);
    hbar('#9aa0a6', -5.6, 5.5, SC.scal * k); hbar('#4b9ee2', -5.6 + SC.scal * k, 5.5, SC.n * SC.n * k);
    tag(SC.p + ' 顆：' + r2(r.t) + 't', 'ptr alt', -3.4, 4.0);
    hbar('#9aa0a6', -5.6, 3.3, SC.scal * k); hbar(SC.busy ? '#d64545' : '#4b9ee2', -5.6 + SC.scal * k, 3.3, (r.t - SC.scal) * k);
    const b = bar('#2fc092', 1.6, 1.2, 3.6); const h = Math.min(4.5, r.eff * 4.5); b.scale.y = Math.max(0.001, h); b.position.y = h / 2;
    tag('效率 ' + Math.round(r.eff * 100) + '%', 'ptr', 3.6, h + 0.5);
    tag('speedup ' + r2(r.sp), 'ptr alt', 0, 1.4);
    setState('Strong／weak scaling', [['循序時間', SC.scal + ' + ' + SC.n * SC.n + ' = ' + r.seq + 't'], ['平行時間', SC.scal + ' + ' + r2(r.t - SC.scal) + ' = ' + r2(r.t) + 't'], ['speedup', r2(r.sp) + '（理想 ' + SC.p + '）'], ['效率', Math.round(r.eff * 100) + '%']],
      'Strong scaling：問題大小固定、加處理器；Weak scaling：問題跟著處理器數一起變大');
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function opts4(ans, cands) {
    const s = new Set([ans]);
    for (const c of cands) { if (s.size >= 4) break; if (c !== undefined && c !== null && String(c) !== '' && !String(c).startsWith('-') && String(c) !== 'NaN' && String(c) !== 'Infinity') s.add(String(c)); }
    let k = 2; while (s.size < 4) { s.add(String(r2(Number.parseFloat(ans) * (1 + k / 10)))); k++; }
    return [...s];
  }
  const CONCEPT = [
    { q: 'MESI 中 Exclusive 狀態的好處？', opts: ['寫入時直接變 M，不必在 bus 上廣播 invalidate', '讓兩個 cache 可以同時寫', '讀 miss 時不用存取記憶體', '讓 memory 永遠是最新值'], ans: '寫入時直接變 M，不必在 bus 上廣播 invalidate', why: 'E 代表只有自己有、而且和記憶體一致；寫入時沒有別人要通知，省一次 bus 交易（MSI 在 S 寫入一定要廣播）。' },
    { q: 'P0 的 X 是 M 狀態，P1 讀 X（MESI，write-back）會發生什麼？', opts: ['P0 送出最新值並寫回記憶體，兩邊都變 S', 'P1 從記憶體讀到舊值，P0 維持 M', 'P0 變 I、P1 變 M', 'P1 變 E、P0 變 S'], ans: 'P0 送出最新值並寫回記憶體，兩邊都變 S', why: 'P0 snoop 到 BusRd，自己有 dirty 的最新值 → flush，降為 S；P1 拿到新值也是 S。' },
    { q: 'SMT（simultaneous multithreading）和 fine-grained MT 最主要的差別？', opts: ['SMT 同一個 cycle 可以發多個 thread 的指令', 'SMT 只在長 stall 時才換 thread', 'Fine-grained 一個 cycle 發多個 thread 的指令', 'SMT 不需要 superscalar'], ans: 'SMT 同一個 cycle 可以發多個 thread 的指令', why: 'fine-grained 每個 cycle 換一個 thread；SMT 建在多發射（superscalar）上，同一 cycle 從多個 thread 填 issue slot，同時利用 TLP 與 ILP。' },
    { q: 'Coarse-grained multithreading 的缺點？', opts: ['只在長 stall 換 thread，短 stall 藏不住，換 thread 還要重新填 pipeline', '每個 cycle 都要換 thread，單一 thread 變很慢', '需要兩倍的記憶體', '無法處理 cache miss'], ans: '只在長 stall 換 thread，短 stall 藏不住，換 thread 還要重新填 pipeline', why: 'P&H：coarse-grained 只在昂貴的 stall（如 L2 miss）才換，pipeline start-up 成本讓它不適合處理短 stall。' },
    { q: 'GPU 主要靠什麼來隱藏記憶體延遲？', opts: ['大量 hardware multithreading：一個 warp 在等，就換另一個', '很大的多層 cache', '亂序執行與分支預測', '把記憶體做成 SRAM'], ans: '大量 hardware multithreading：一個 warp 在等，就換另一個', why: 'P&H：GPU 不依賴大 cache，而是有大量 thread，記憶體等待時切到其他 thread（SIMT）。' },
    { q: '多個處理器執行同一個程式、處理不同資料（SPMD），在 Flynn 分類屬於？', opts: ['MIMD', 'SIMD', 'MISD', 'SISD'], ans: 'MIMD', why: 'SPMD 是在 MIMD 硬體上的常見寫法：每個處理器有自己的指令流（雖然是同一份程式）。SIMD 是同一個指令同時作用在多個資料上。' },
    { q: 'False sharing 指的是？', opts: ['兩個處理器寫同一個 block 裡不同的變數，block 被來回 invalidate', '兩個處理器寫同一個變數', 'cache 存了不該存的資料', 'TLB 裡的錯誤 translation'], ans: '兩個處理器寫同一個 block 裡不同的變數，block 被來回 invalidate', why: 'coherence 以 block 為單位：變數其實不共享，但在同一個 block，仍會互相作廢（ping-pong）。' },
  ];
  function genQ() {
    const p = Math.random();
    if (p < 0.25) {
      const f = pickOne([10, 20, 25, 40, 50, 60, 75, 80, 90, 95]), s = pickOne([2, 3, 4, 5, 8, 10, 20]);
      const sp = r2(amdahl(f / 100, s));
      return { q: '程式有 ' + f + '% 可以被加速 ' + s + ' 倍，整體 speedup？', opts: opts4(String(sp), [r2(1 + f / 100 * (s - 1)), r2(s * f / 100), r2(1 / (1 - f / 100)), r2(amdahl(1 - f / 100, s))].map(String)), ans: String(sp), why: '1 / ((1 − ' + f / 100 + ') + ' + f / 100 + '/' + s + ') = 1 / ' + r4(1 - f / 100 + f / 100 / s) + ' = ' + sp + '。未加速的部分時間不變。' };
    }
    if (p < 0.37) {
      const f = pickOne([50, 75, 80, 90, 95, 99]);
      const lim = r2(1 / (1 - f / 100));
      return { q: '程式 ' + f + '% 可以平行化，處理器無限多時 speedup 最多是？', opts: opts4(String(lim), [String(f), '∞', String(r2(f / 100 * 10)), String(r2(1 / (f / 100)))]), ans: String(lim), why: 's → ∞ 時 f/s → 0，speedup → 1 / (1 − f) = 1 / ' + r2(1 - f / 100) + ' = ' + lim + '。' };
    }
    if (p < 0.47) {
      const N = pickOne([10, 20, 50, 100]), target = pickOne([0.5, 0.8, 0.9]) * N;
      // target = 1/((1-F)+F/N) → F = (1 - 1/target) / (1 - 1/N)
      const F = (1 - 1 / target) / (1 - 1 / N), seq = r2((1 - F) * 100);
      return { q: N + ' 顆處理器想得到 ' + target + ' 倍 speedup，序列（不能平行）部分最多占百分之幾？', opts: opts4(seq + '%', [r2(100 - target) + '%', r2((1 - target / N) * 100) + '%', r2(seq * 10) + '%', r2(seq / 10) + '%']), ans: seq + '%', why: target + ' = 1 / ((1 − F) + F/' + N + ') → F = (1 − 1/' + target + ') / (1 − 1/' + N + ') = ' + r4(F) + '，序列部分 = ' + seq + '%。（P&H：100 顆要 90 倍 → 0.1%）' };
    }
    if (p < 0.6) {
      const n = pickOne([10, 20, 100]), P = pickOne([10, 40, 100]), sc = 10;
      const r = scCalc({ scal: sc, n, p: P, busy: 0 });
      return { q: '10 個純量相加（只能循序）+ ' + n + '×' + n + ' 矩陣相加（可平均分給 ' + P + ' 顆處理器），speedup？', opts: opts4(String(r2(r.sp)), [String(P), String(r2((sc + n * n) / (n * n / P))), String(r2(n * n / (sc + n * n / P))), String(r2(r.sp * 2))]), ans: String(r2(r.sp)), why: '循序 ' + (sc + n * n) + 't；平行 10t + ' + n * n + '/' + P + ' t = ' + r2(r.t) + 't → ' + r2(r.sp) + '。（P&H 的 strong scaling 例題）' };
    }
    if (p < 0.72) {
      const seq = pickOne([['I', 'R', 0], ['I', 'W', 0], ['S', 'W', 0], ['E', 'W', 0], ['M', 'R', 1], ['S', 'R', 1]]);
      const [s0, op, who] = seq;
      // P0 有 s0；P0 或 P1 做 op
      let ans, why;
      if (who === 0) {
        if (op === 'R') { ans = 'E（沒人有）'; why = 'MESI：讀 miss 而且其他 cache 都沒有 → Exclusive。'; }
        else if (s0 === 'I') { ans = 'M，發 BusRdX'; why = 'write miss：BusRdX 讀進並作廢其他副本 → M。'; }
        else if (s0 === 'S') { ans = 'M，發 invalidate'; why = 'S 寫入：要先廣播 invalidate（BusUpgr），其他副本變 I。'; }
        else { ans = 'M，不用 bus'; why = 'E 寫入：只有自己有 → 直接 E → M，不必廣播。'; }
        return { q: 'MESI：P0 的 X 是 ' + s0 + '，P1 沒有 X。P0 ' + (op === 'R' ? '讀' : '寫') + ' X 後，P0 的狀態？', opts: opts4(ans, ['E（沒人有）', 'S（沒人有也是 S）', 'M，發 BusRdX', 'M，發 invalidate', 'M，不用 bus', 'I']), ans, why };
      }
      ans = s0 === 'M' ? 'S，並 flush 最新值' : 'S，不必 flush';
      why = s0 === 'M' ? 'P0 是 dirty 的唯一持有者：snoop 到 BusRd → 送出資料、寫回記憶體、降為 S。' : 'P0 的是 clean 的 S：保持 S，記憶體直接供應資料。';
      return { q: 'MESI：P0 的 X 是 ' + s0 + '，P1 讀 X（read miss）後，P0 的狀態？', opts: opts4(ans, ['S，並 flush 最新值', 'S，不必 flush', 'I', 'M（維持）', 'E']), ans, why };
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

  // ───────────────────────── 場景：2dYV_lADfFI（Amdahl's Law） ─────────────────────────
  async function scAmdahlIntro(tok) {
    fresh([0, 4, 13], [0, 3, 0]);
    const cpu = cube('CPU', '#31aab0', [2.2, 1.4, 1.6], 0, 4.4, 0);
    say('Amdahl\'s law：CPU 增強後，整體快多少？', 'overall speedup after enhancement');
    await beat(tok, 2800);
    const ways = [['指令集增強', -4.2], ['Pipelining', 0], ['Multiprocessor', 4.2]];
    for (const [n, x] of ways) {
      const m = cube(n, '#9b7ef4', [2.8, 0.7, 1], x, 2.0, 0, 3);
      move(m, x, 2.0, 0);
      say('增強方式之一：' + n, '不管哪種，都用同一條定律算整體效果');
      glow(cpu, GOLD); await beat(tok, 1500); glow(cpu, null);
    }
    say('考試一定會出：先弄懂幾個名詞', 'f（被增強的比例）、s（增強倍數）');
    await beat(tok, 2800);
  }
  async function scAmdahlSplit(tok) {
    fresh([0, 4, 13], [0, 3, 0]);
    say('把指令數正規化：總共當作 1', '1000 個指令 ÷ 1000 = 1，題目常給百分比');
    const all = hbar('#9aa0a6', -5, 5, 10, 0.8, 0.7, '全部指令 = 1');
    await beat(tok, 3000);
    say('其中比例 f 被增強，1 − f 沒有', '');
    kill(all);
    const un = hbar('#9aa0a6', -5, 5, 8, 0.8, 0.7, '1 − f（未增強）'), en = hbar('#4b9ee2', 3, 5, 2, 0.8, 0.7, 'f');
    await beat(tok, 2800);
    say('被增強的部分快了 s 倍', '例：s = 3 → 這段時間變 1/3');
    const en2 = hbar('#4b9ee2', 3, 3.2, 2, 0.8, 0.7, '');
    await anim(tok, 1200, (t) => setH(en2, 3, 2 - (2 - 2 / 3) * t));
    relabel(en2, 'f / s');
    await beat(tok, 2600);
    say('未增強的 1 − f：時間完全不變', '');
    const un2 = hbar('#9aa0a6', -5, 3.2, 8, 0.8, 0.7, '1 − f（一樣長）');
    await beat(tok, 2800);
  }
  async function scAmdahlFormula(tok) {
    fresh([0, 4, 13], [0, 3, 0]);
    tag('舊 CPU', 'ptr', -5.6, 5.9);
    hbar('#9aa0a6', -4.6, 5.2, 8, 0.8, 0.7, '1 − f'); hbar('#4b9ee2', 3.4, 5.2, 2, 0.8, 0.7, 'f');
    say('舊 CPU 的時間（正規化）= 1', '');
    await beat(tok, 2400);
    tag('新 CPU', 'ptr alt', -5.6, 3.9);
    hbar('#9aa0a6', -4.6, 3.2, 8, 0.8, 0.7, '1 − f'); const e = hbar('#4b9ee2', 3.4, 3.2, 2, 0.8, 0.7, 'f/s');
    await anim(tok, 1000, (t) => setH(e, 3.4, 2 - (2 - 2 / 3) * t));
    say('新 CPU 的時間 = (1 − f) + f / s', '');
    await beat(tok, 2800);
    tag('speedup = 舊時間 / 新時間 = 1 / ((1 − f) + f / s)', 'ptr alt', 0, 1.5);
    say('overall speedup = 舊時間 ÷ 新時間', '= 1 / ((1 − f) + f / s)');
    await beat(tok, 3400);
  }
  async function scAmdahlLimit(tok) {
    fresh([0, 4, 14], [0, 3.2, 0]);
    say('處理器加到上千顆，會快上千倍嗎？', '');
    await beat(tok, 2200);
    const f = 0.9, k = 10;
    const un = hbar('#9aa0a6', -5.6, 5.4, (1 - f) * k, 0.8, 0.6, '序列'), en = hbar('#4b9ee2', -5.6 + (1 - f) * k, 5.4, f * k, 0.8, 0.6, '');
    const tl = tag('', 'ptr alt', 2.4, 6.3);
    const pts = [];
    const ax = polyline([V3(-5.6, 0.4), V3(5.6, 0.4)], '#6e5f49');
    tag('處理器數（對數）', 'idx', 0, -0.2);
    let line = null;
    for (const n of [1, 2, 4, 8, 16, 64, 256, 1024]) {
      setH(en, -5.6 + (1 - f) * k, f / n * k);
      const t = 1 - f + f / n;
      txt(tl, n + ' 顆：時間 ' + r4(t) + '（以 f = 90% 示範）');
      pts.push(V3(-5.6 + Math.log2(n) / 10 * 11.2, 0.4 + t * 3.6));
      if (line) kill(line); line = polyline(pts.slice(), '#d64545');
      say(n + ' 顆處理器：執行時間 ' + r4(t), n >= 64 ? '再加處理器，時間幾乎不再下降' : '一開始下降得很快');
      await beat(tok, 1100);
    }
    polyline([V3(-5.6, 0.4 + 0.1 * 3.6), V3(5.6, 0.4 + 0.1 * 3.6)], '#9aa0a6');
    tag('只剩序列部分 1 − f', 'idx', 4, 0.95);
    say('時間最後變成常數：序列部分不會變快', '1 ms 的程式，加再多處理器也有下限');
    await beat(tok, 3400);
  }
  async function scAmdahlFp(tok) {
    fresh([0, 4, 13], [0, 3, 0]);
    say('例：科學計算用的處理器，有整數與浮點指令', '浮點指令占 20%，改良後快 3 倍');
    await beat(tok, 3000);
    const ins = [];
    for (let k = 0; k < 10; k++) ins.push(cube(k < 2 ? 'FP' : 'INT', k < 2 ? '#4b9ee2' : '#9aa0a6', [0.9, 0.6, 0.8], -4.5 + k * 1.0, 5.2, 0, 2));
    await beat(tok, 1200);
    say('f = 0.2（浮點）、s = 3', '整數指令沒有增強：1 − f = 0.8');
    await beat(tok, 2600);
    hbar('#9aa0a6', -5, 3.2, 8, 0.8, 0.6, '0.8'); const e = hbar('#4b9ee2', 3, 3.2, 2, 0.8, 0.6, '');
    await anim(tok, 1000, (t) => setH(e, 3, 2 - (4 / 3) * t)); relabel(e, '0.2/3');
    say('新時間 = 0.8 + 0.2 / 3', '通分：(3 × 0.8 + 0.2) / 3 = 2.6 / 3');
    await beat(tok, 3000);
    tag('speedup = 3 / 2.6 = 1.1538', 'ptr alt', 0, 1.6);
    say('speedup = 3 / 2.6 = 1.1538', '浮點快 3 倍，整體只快約 1.15 倍');
    await beat(tok, 3400);
  }

  // ───────────────────────── 場景：P&H（平行化、multithreading、coherence、GPU） ─────────────────────────
  async function scAmdahl90(tok) {
    fresh([0, 4, 13], [0, 3, 0]);
    say('P&H 例：100 顆處理器想快 90 倍', '序列部分最多能占多少？');
    await beat(tok, 2800);
    say('90 = 1 / ((1 − F) + F / 100)', '解出 F = 0.999');
    await beat(tok, 2800);
    const b1 = hbar('#9aa0a6', -5, 4.4, 0.1, 0.8, 0.7, ''), b2 = hbar('#4b9ee2', -4.9, 4.4, 9.9, 0.8, 0.7, 'F = 99.9% 可平行');
    tag('序列只能 0.1%', 'ptr alt', -4.4, 5.4);
    say('只有 0.1% 可以是序列的！', '平行程式要把序列部分壓到極小');
    await beat(tok, 3200);
  }
  async function scScaling(tok) {
    fresh([0, 4, 13.5], [0, 3, 0]);
    say('P&H 例：10 個純量相加 + 矩陣相加', '純量只能循序；矩陣可以平均分給處理器');
    await beat(tok, 3000);
    const rows = [[10, 10, '10×10、10 顆'], [10, 100, '10×10、100 顆'], [100, 10, '100×100、10 顆'], [100, 100, '100×100、100 顆']];
    for (let i = 0; i < rows.length; i++) {
      const [n, p, nm] = rows[i]; const r = scCalc({ scal: 10, n, p, busy: 0 });
      const y = 5.8 - i * 1.4, x = -2.0;
      tag(nm, 'ptr', -4.6, y);
      const w = Math.min(6.5, r.sp / 100 * 6.5);
      const m = hbar(r.eff > 0.8 ? '#2fc092' : '#dd8238', x, y, 0.01, 0.8, 0.6);
      await anim(tok, 600, (t) => setH(m, x, w * t));
      tag('speedup ' + r2(r.sp) + '（' + Math.round(r.eff * 100) + '%）', 'ptr alt', x + w + 1.4 > 6 ? 4.6 : x + w + 1.5, y + 0.5);
      say(nm + '：時間 ' + r2(r.t) + 't', '循序 ' + r.seq + 't → speedup ' + r2(r.sp));
      await beat(tok, 2200);
    }
    say('問題固定加處理器：strong scaling 難', '問題跟著變大：weak scaling 容易');
    await beat(tok, 3200);
  }
  async function scLoadBalance(tok) {
    fresh([0, 4, 13.5], [0, 3, 0]);
    say('P&H 例：100×100 矩陣、100 顆處理器', '平均分：每顆 1% → speedup 91');
    await beat(tok, 2800);
    const bars = [];
    for (let k = 0; k < 20; k++) { const b = bar('#4b9ee2', 0.4, 0.5, -5.2 + k * 0.55); bars.push(b); b.scale.y = 1; b.position.y = 0.5; }
    tag('（畫出 20 顆代表 100 顆）', 'idx', 0, 4.8);
    await beat(tok, 1600);
    tint(bars[0], '#d64545'); await anim(tok, 800, (t) => { bars[0].scale.y = 1 + t; bars[0].position.y = bars[0].scale.y / 2; });
    tag('2%', 'ptr alt', -5.2, 2.5);
    say('一顆分到 2%：大家都要等它', '時間 = 10t + 200t = 210t → speedup 48');
    await beat(tok, 3000);
    await anim(tok, 800, (t) => { bars[0].scale.y = 2 + 3 * t; bars[0].position.y = bars[0].scale.y / 2; });
    tag('5%', 'ptr alt', -5.2, 5.5);
    say('分到 5%：時間 510t → speedup 20', '負載不平衡會讓 speedup 大跌');
    await beat(tok, 3200);
  }
  async function scFlynn(tok) {
    fresh([0, 4.5, 13.5], [0, 3.2, 0]);
    const Q = [['SISD', -3.2, 5.2, 1, 1, '傳統 uniprocessor'], ['SIMD', 3.2, 5.2, 1, 4, 'vector／SSE：一個指令 × 多筆資料'], ['MISD', -3.2, 1.8, 4, 1, '幾乎沒有實際產品'], ['MIMD', 3.2, 1.8, 4, 4, 'multicore、cluster']];
    tag('單一資料流 ← → 多資料流', 'idx', 0, 7.1);
    say('Flynn 分類：指令流 × 資料流', 'Single／Multiple Instruction × Data');
    await beat(tok, 2600);
    for (const [n, x, y, is, ds, cap] of Q) {
      tag(n, 'ptr', x, y + 1.1);
      for (let i = 0; i < is; i++) cube('I', '#9b7ef4', [0.45, 0.4, 0.5], x - 2.2, y + 0.6 - i * 0.45, 0, 2);
      for (let d = 0; d < ds; d++) cube('D', '#2fc092', [0.45, 0.4, 0.5], x - 0.8 + d * 0.6, y + 0.1, 0, 2);
      say(n + '：' + cap, '');
      await beat(tok, 2200);
    }
    say('SPMD：同一份程式跑在 MIMD 的每顆處理器上', 'SIMD 的條件判斷要靠 mask，不同分支輪流執行');
    await beat(tok, 3200);
  }
  async function scMT(tok) {
    fresh([0, 3.6, 12], [0, 3.6, 0]);
    legend();
    say('4-wide superscalar 上跑 A、B、C 三個 thread', '每列一個 cycle、4 個 issue slot；空格 = 浪費');
    await beat(tok, 2800);
    const caps = { single: '只有 A：ILP 不夠、stall 時整列空', coarse: 'Coarse：長 stall 才換 thread', fine: 'Fine：每個 cycle 輪流換 thread', smt: 'SMT：同一 cycle 混用多個 thread' };
    const res = {};
    for (const [k, x] of [['single', -4.8], ['coarse', -1.6], ['fine', 1.6], ['smt', 4.8]]) {
      say(caps[k], k === 'coarse' ? '換 thread 要重新填 pipeline，浪費一個 cycle' : k === 'fine' ? '短 stall 也藏得住；但每列只有一個 thread' : '');
      res[k] = await drawGrid(tok, k, x, true, 110);
      await beat(tok, 1200);
    }
    say('slot 使用率：' + res.single.pct + '% → ' + res.coarse.pct + '% → ' + res.fine.pct + '% → ' + res.smt.pct + '%', 'SMT 同時利用 thread-level 與 instruction-level 平行度');
    await beat(tok, 3400);
  }
  async function scSharedMem(tok) {
    fresh([0, 4.5, 13.5], [0, 3, 0]);
    const ps = [], cs = [];
    for (let k = 0; k < 4; k++) { ps.push(cube('P' + k, '#31aab0', [1.4, 0.7, 1], -4.5 + k * 3, 5.8, 0)); cs.push(cube('cache', '#4b9ee2', [1.4, 0.5, 1], -4.5 + k * 3, 4.8, 0)); }
    const net = cube('', '#b9a98c', [11, 0.14, 0.3], 0, 3.8, 0); tag('bus／interconnect', 'idx', -5.6, 3.4, 0.4);
    const mem = cube('共享的 Memory（單一位址空間）', '#c9b48e', [8, 0.8, 1.2], 0, 2.4, 0);
    say('Shared memory multiprocessor（SMP）', '所有處理器共用一個實體位址空間');
    await beat(tok, 2800);
    say('UMA：存取任何位址都一樣久', 'NUMA：近的記憶體快、遠的慢，但規模可以更大');
    await beat(tok, 3000);
    say('共享變數要同步：lock', '同一時間只有一顆能進 critical section');
    const lock = cube('lock', '#d64545', [1, 0.5, 0.8], 0, 1.2, 0);
    for (let k = 0; k < 4; k++) { move(lock, -4.5 + k * 3, 6.6, 0); glow(ps[k], GOLD); await beat(tok, 700); glow(ps[k], null); }
    say('MIPS 用 ll／sc 做出 atomic 的 swap', '另一類：message passing（各有私有記憶體，用 send/receive）');
    await beat(tok, 3200);
  }
  async function scReduction(tok) {
    fresh([0, 4.5, 13.5], [0, 3, 0]);
    say('P&H：多顆處理器平行加總', '每顆先加自己那一段，再兩兩合併');
    await beat(tok, 2600);
    let vals = [3, 1, 4, 1, 5, 9, 2, 6].map((v) => v * 100);
    let ms = vals.map((v, k) => cube(String(v), '#4b9ee2', [1.1, 0.6, 0.9], -5.25 + k * 1.5, 1.0, 0, 2));
    vals.forEach((v, k) => tag('P' + k, 'idx', -5.25 + k * 1.5, 0.3, 0.8));
    say('第 1 步：8 顆各自加總自己的部分', '各段和寫進 sum[Pn]');
    await beat(tok, 2600);
    let level = 1, step = 1;
    while (ms.length > 1) {
      const half = ms.length / 2;
      say('half = ' + half + '：P0–P' + (half - 1) + ' 加上另一半', 'synch()：等所有人都完成這一輪（barrier）');
      const nxt = [];
      for (let k = 0; k < half; k++) {
        const a = ms[k], b = ms[k + half];
        const v = vals[k] + vals[k + half];
        move(b, a.position.x, 1.0 + level * 1.3, 0); move(a, a.position.x, 1.0 + level * 1.3, 0);
        await beat(tok, 450);
        kill(b); relabel(a, v); tint(a, ['#9b7ef4', '#dd8238', '#2fc092'][level - 1]);
        nxt.push(v);
      }
      vals = nxt; ms = ms.slice(0, half); level++;
      await beat(tok, 1600);
    }
    say('log₂ 8 = 3 輪就得到總和 ' + vals[0], '每輪之間都要 barrier 同步');
    await beat(tok, 3000);
  }
  async function scCohProblem(tok) {
    fresh([0, 4, 13.5], [0, 3.6, 0]);
    const C = makeCoh({ proto: 'msi' });
    // 沒有 coherence 協定：直接改顯示
    const show = (a, b, m) => { relabel(C.cache[0], a === null ? '—' : 'X=' + a); relabel(C.cache[1], b === null ? '—' : 'X=' + b); relabel(C.memM, 'Memory X=' + m); tint(C.cache[0], a === null ? GRAY : '#4b9ee2'); tint(C.cache[1], b === null ? GRAY : '#4b9ee2'); };
    show(null, null, 0);
    say('P&H：兩顆 CPU 各有 cache，共用記憶體 X = 0', '假設 write-through、沒有 coherence 機制');
    await beat(tok, 2800);
    show(0, null, 0); glow(C.cache[0], RED); say('① CPU A 讀 X → A 的 cache = 0', ''); await beat(tok, 2000);
    show(0, 0, 0); glow(C.cache[1], RED); say('② CPU B 讀 X → B 的 cache = 0', ''); await beat(tok, 2000);
    show(1, 0, 1); glow(C.cache[0], GOLD); glow(C.memM, GOLD); say('③ CPU A 寫 X = 1：A 的 cache 與記憶體都是 1', ''); await beat(tok, 2400);
    glow(C.cache[1], RED); tint(C.cache[1], '#d64545');
    say('B 再讀 X，還是舊值 0！', '這就是 cache coherence problem');
    await beat(tok, 3200);
    say('需要：寫入要傳播（propagation）', '而且所有人看到的寫入順序一致（serialization）');
    await beat(tok, 3000);
  }
  async function scSnoopInvalidate(tok) {
    fresh([0, 4, 13.5], [0, 3.6, 0]);
    const C = makeCoh({ proto: 'msi' });
    say('P&H：snooping + write invalidate（write-back）', '每個 cache 都監聽 bus');
    await beat(tok, 2800);
    const steps = [[0, 'R', '① CPU A 讀 X：cache miss'], [1, 'R', '② CPU B 讀 X：cache miss'], [0, 'W', '③ CPU A 寫 X = 1：在 bus 上 invalidate'], [1, 'R', '④ CPU B 讀 X：miss，A 送出 1']];
    for (const [p, op, cap] of steps) {
      say(cap, '');
      const m = await C.op(p, op, tok);
      say(cap, m);
      await beat(tok, 2600);
    }
    say('寫之前先讓別人的副本失效 → 只剩一份可寫', '記憶體也在 B 讀的時候被更新為 1');
    await beat(tok, 3200);
  }
  async function scMesi(tok) {
    fresh([0, 4, 13.5], [0, 3.6, 0]);
    const C = makeCoh({ proto: 'mesi' });
    say('MESI：Modified、Exclusive、Shared、Invalid', '兩個 cache 窺探同一條 bus');
    await beat(tok, 2800);
    const steps = [[0, 'R', 'P0 讀 X'], [1, 'R', 'P1 讀 X'], [0, 'W', 'P0 寫 X'], [1, 'R', 'P1 讀 X'], [1, 'W', 'P1 寫 X'], [0, 'W', 'P0 寫 X']];
    for (const [p, op, cap] of steps) {
      say(cap, '…');
      const m = await C.op(p, op, tok);
      say(cap + ' → P0 ' + C.st[0] + '、P1 ' + C.st[1], m);
      await beat(tok, 2600);
    }
    say('E 的好處：沒人共享時，寫入不必上 bus', '任一時刻最多一個 M；M 存在時其他都是 I');
    await beat(tok, 3200);
  }
  async function scMesiE(tok) {
    fresh([0, 4, 13.5], [0, 3.6, 0]);
    const res = [];
    for (const proto of ['msi', 'mesi']) {
      lab.clear();
      const C = makeCoh({ proto });
      tag(proto.toUpperCase(), 'ptr', 0, 7.2);
      say(proto.toUpperCase() + '：P0 讀 X，再寫 X（P1 從來沒碰 X）', '數 bus 交易');
      await beat(tok, 2200);
      const m1 = await C.op(0, 'R', tok); say('P0 讀 X → ' + C.st[0], m1); await beat(tok, 2000);
      const m2 = await C.op(0, 'W', tok); say('P0 寫 X → ' + C.st[0], m2); await beat(tok, 2200);
      res.push(proto.toUpperCase() + ' ' + C.busTx + ' 次');
    }
    say('bus 交易：' + res.join('、'), '私有資料「先讀後寫」很常見 → E 省掉一次廣播');
    await beat(tok, 3200);
  }
  async function scFalseSharing(tok) {
    fresh([0, 4, 13.5], [0, 3.6, 0]);
    const C = makeCoh({ proto: 'mesi' });
    tag('同一個 block：[ a | b ]', 'ptr', 0, 7.2);
    say('False sharing：P0 只寫 a、P1 只寫 b', '但 a、b 在同一個 cache block');
    await beat(tok, 2800);
    for (let k = 0; k < 4; k++) {
      const p = k % 2;
      const m = await C.op(p, 'W', tok);
      say('P' + p + ' 寫 ' + (p ? 'b' : 'a') + '：整個 block 被搶過來', '另一邊被 invalidate（ping-pong）');
      await beat(tok, 1300);
    }
    say('變數沒共享，卻不停互相 invalidate', '解法：把變數放到不同的 block（padding）');
    await beat(tok, 3000);
  }
  async function scGpu(tok) {
    fresh([0, 4.5, 13.5], [0, 3, 0]);
    tag('CPU：少數大核心', 'ptr', -3.8, 6.7);
    for (let k = 0; k < 4; k++) cube('core', '#31aab0', [1.4, 1.0, 1], -4.6 + (k % 2) * 1.6, 5.6 - Math.floor(k / 2) * 1.2, 0);
    cube('大 cache', '#c9b48e', [3, 0.6, 1], -3.8, 3.2, 0);
    tag('GPU：很多 multithreaded SIMD processor', 'ptr alt', 3.2, 6.7);
    const lanes = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) lanes.push(cube('', '#9b7ef4', [0.38, 0.38, 0.5], 1.2 + c * 0.5, 5.8 - r * 0.6, 0));
    say('GPU：大量簡單的 SIMD lane', '適合資料平行：同一段程式套在大量資料上');
    await beat(tok, 2800);
    const warps = ['#9b7ef4', '#dd8238', '#2fc092', '#e55a9b'];
    say('warp（例：32 個 thread）一起執行同一個指令', 'SIMT：寫起來像 thread，執行起來像 SIMD');
    for (let w = 0; w < 4; w++) { lanes.forEach((m, i) => tint(m, warps[w])); say(w === 0 ? 'warp 0 發出記憶體存取，要等很久' : 'warp ' + (w - 1) + ' 在等 → 換 warp ' + w + ' 執行', '用大量 multithreading 藏住記憶體延遲'); await beat(tok, 1300); }
    say('不靠大 cache 藏延遲，靠切換 thread', '記憶體頻寬高（GDDR），單一 thread 的延遲不重要');
    await beat(tok, 3200);
    say('CUDA：thread → thread block → grid', 'GPU 是 CPU 的加速器，不是取代它');
    await beat(tok, 3000);
  }

  const scenes = {
    'amdahl-intro': { title: 'Amdahl\'s law：增強 CPU 後整體快多少', play: scAmdahlIntro },
    'amdahl-split': { title: '正規化：f 被增強、1 − f 不變、快 s 倍', play: scAmdahlSplit },
    'amdahl-formula': { title: 'speedup = 1 / ((1 − f) + f / s)', play: scAmdahlFormula },
    'amdahl-limit': { title: '處理器再多，時間也會變常數', play: scAmdahlLimit },
    'amdahl-fp': { title: '影片例題：浮點 20% 快 3 倍 → 1.1538', play: scAmdahlFp },
    'amdahl-90': { title: 'P&H 例：100 顆要 90 倍，序列只能 0.1%', play: scAmdahl90 },
    scaling: { title: 'P&H 例：strong vs weak scaling', play: scScaling },
    'load-balance': { title: 'P&H 例：負載不平衡，speedup 91 → 48 → 20', play: scLoadBalance },
    flynn: { title: 'Flynn 分類：SISD、SIMD、MISD、MIMD', play: scFlynn },
    multithreading: { title: 'Coarse／Fine／SMT 的 issue slot', play: scMT },
    'shared-memory': { title: 'Shared memory multiprocessor：UMA、NUMA、lock', play: scSharedMem },
    reduction: { title: '平行加總：每顆先加、再兩兩合併', play: scReduction },
    'coherence-problem': { title: 'P&H 例：cache coherence problem', play: scCohProblem },
    'snoop-invalidate': { title: 'P&H 例：snooping 的 write invalidate', play: scSnoopInvalidate },
    mesi: { title: 'MESI：兩個 cache 的狀態變化', play: scMesi },
    'mesi-vs-msi': { title: 'MSI vs MESI：Exclusive 省下的 bus 交易', play: scMesiE },
    'false-sharing': { title: 'False sharing：同一個 block 互相 invalidate', play: scFalseSharing },
    gpu: { title: 'GPU 基礎：SIMT、warp、用 multithreading 藏延遲', play: scGpu },
  };

  return {
    kicker: '計算機組織・第 8 章',
    title: '平行與多核',
    color: 'var(--ca)',
    modes: [
      { id: 'amdahl', name: 'Amdahl\'s law', enter: enterAmdahl },
      { id: 'mt', name: 'Multithreading', enter: enterMT },
      { id: 'coh', name: 'Cache coherence', enter: enterCoh },
      { id: 'scaling', name: 'Scaling', enter: enterScaling },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['amdahl-intro', 'amdahl-split', 'amdahl-formula', 'amdahl-limit', 'amdahl-fp', 'amdahl-90', 'scaling', 'load-balance',
      'flynn', 'multithreading', 'shared-memory', 'reduction', 'coherence-problem', 'snoop-invalidate', 'mesi', 'mesi-vs-msi', 'false-sharing', 'gpu'],
    _genQ: genQ,
    stop() { stopTimer(); },
  };
}
