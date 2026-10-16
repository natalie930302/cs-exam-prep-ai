// 計算機組織 第8章：平行與多核（Amdahl's law、strong/weak scaling、Flynn 分類、hardware multithreading、
// shared-memory multiprocessor、cache coherence（snooping、MSI/MESI）、GPU 基礎）。
// 影片 2dYV_lADfFI（Amdahl's Law）有字幕：場景 amdahl-intro、amdahl-split、amdahl-formula、amdahl-limit、amdahl-fp 依它的順序與數字。
// 兩支影片各有一組逐句同步的場景（cpar-*，在檔案後段）；其餘場景依 Patterson & Hennessy（MIPS 版）第 5、6 章。
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
    const opts = [...p.opts].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ par.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { tint, relabel } = P;
// ─── 計算機組織 第 8 章（r_ZE1XVT8Ao Cache Coherence Problem & Protocols）— cued scenes ───
// 每個 scene = 一串 step 函式；影片講到那一句（notes 的 cue）才執行下一個。
// 四個處理器各自改 A 的值、MSI／MESI／MOESI／MESIF 每次存取後的狀態、write update／invalidate、
// directory 要送幾個訊息，全部由下面的小模擬器計算，再和畫面上的說法比對，顯示 ✓／✘。示意的例子標「示意」。
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
const CAM = [[0, 3.9, 14.2], [0, 3.6, 0]];
function scene(id, title, steps, cam = CAM) {
  FRAG.push([id, title, async (tok) => {
    fresh(cam[0], cam[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
function wire(x1, y1, x2, y2, color = '#b9a98c', th = 0.1) {
  const w = Math.max(th, Math.abs(x2 - x1)), h = Math.max(th, Math.abs(y2 - y1));
  return cube('', color, [w, h, th * 2], (x1 + x2) / 2, (y1 + y2) / 2, 0);
}
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

// ── 小模擬器：n 個 private cache（write-back、write-allocate）＋ main memory，一個變數 A ──
// proto：'none'（沒有協定，各改各的）、'MSI'、'MESI'、'MOESI'、'MESIF'；wmode：'inv'（write invalidate）或 'upd'（write update）
function mkCoh(n, a0, proto = 'MSI', wmode = 'inv', wt_ = 'wb') {
  const C = { n, proto, wmode, wt: wt_, st: Array(n).fill('I'), v: Array(n).fill(null), mem: a0, bus: 0, log: [] };
  C.valid = (i) => C.st[i] !== 'I';
  C.read = (p) => {
    if (C.st[p] !== 'I') { C.log.push('P' + (p + 1) + ' read hit'); return 'hit'; }
    if (proto === 'none') { C.v[p] = C.mem; C.st[p] = 'V'; return 'miss'; }
    C.bus++;
    const others = [...Array(n).keys()].filter((q) => q !== p && C.valid(q));
    let src = 'mem';
    for (const q of others) {
      const s = C.st[q];
      if (s === 'M') { if (proto === 'MOESI') { C.st[q] = 'O'; src = q; } else { C.mem = C.v[q]; C.st[q] = 'S'; src = q; } }
      else if (s === 'O') { src = q; }
      else if (s === 'E') { C.st[q] = proto === 'MESIF' ? 'S' : 'S'; if (proto === 'MESIF') src = q; }
      else if (s === 'F') { C.st[q] = 'S'; src = q; }
    }
    C.v[p] = src === 'mem' ? C.mem : C.v[src];
    if (!others.length) C.st[p] = proto === 'MSI' ? 'S' : 'E';
    else C.st[p] = proto === 'MESIF' ? 'F' : 'S';
    C.log.push('P' + (p + 1) + ' read miss ← ' + (src === 'mem' ? 'memory' : 'P' + (src + 1)));
    return src;
  };
  C.write = (p, val) => {
    if (proto === 'none') { if (C.st[p] === 'I') C.read(p); C.v[p] = val; return; }
    if (C.st[p] === 'I') C.read(p);
    const others = [...Array(n).keys()].filter((q) => q !== p && C.valid(q));
    if (wmode === 'upd') { others.forEach((q) => { C.v[q] = val; }); if (others.length) C.bus++; C.v[p] = val; if (C.wt === 'wt') C.mem = val; return others.length; }
    if (C.st[p] === 'S' || C.st[p] === 'F' || C.st[p] === 'O' || others.length) { C.bus++; others.forEach((q) => { C.st[q] = 'I'; C.v[q] = null; }); }
    C.st[p] = 'M'; C.v[p] = val; if (C.wt === 'wt') C.mem = val;
    return others.length;
  };
  return C;
}
const STC = { M: '#d64545', O: '#e58a3c', E: '#2fc092', S: '#4b9ee2', F: '#9b7ef4', I: '#d8cfc0', V: '#4b9ee2' };
const STN = { M: 'Modified', O: 'Owned', E: 'Exclusive', S: 'Shared', F: 'Forward', I: 'Invalid', V: '' };

// 四個處理器、各一個 private cache、internal bus、system bus、main memory
const PX = [-4.8, -1.6, 1.6, 4.8], PY = 6.35, CY = 5.25, IBY = 4.3, SBY = 2.75, MM = [0, 1.45];
function quad(S, o = {}) {
  S.p = PX.map((x, i) => cube('P' + (i + 1), '#31aab0', [1.5, 0.65, 1.0], x, PY));
  S.c = PX.map((x) => cube('cache：—', '#d8cfc0', [2.7, 0.75, 1.0], x, CY));
  S.ib = cube('', '#c08a1f', [12.0, 0.1, 0.25], 0, IBY); S.ibL = sm('internal bus', -5.6, IBY + 0.3);
  S.sb = cube('', '#b9a98c', [12.0, 0.14, 0.3], 0, SBY); S.sbL = sm('system bus', -5.6, SBY + 0.32);
  S.wv = PX.map((x) => wire(x, SBY, x, CY - 0.38, '#b9a98c', 0.06));
  S.mm = cube('Main memory：A = ' + (o.a ?? 7), '#c9b48e', [4.0, 0.9, 1.1], MM[0], MM[1]);
  S.mw = wire(0, SBY, 0, MM[1] + 0.45, '#b9a98c', 0.08);
}
function showC(S, C, i, withState = true) {
  const s = C.st[i];
  relabel(S.c[i], s === 'I' || C.v[i] === null ? (withState && C.proto !== 'none' ? 'I（Invalid）' : 'cache：—') : (withState && C.proto !== 'none' ? s + '  A = ' + C.v[i] : 'A = ' + C.v[i]));
  tint(S.c[i], s === 'V' ? '#4b9ee2' : STC[s] || '#d8cfc0');
}
const showAll = (S, C, ws = true) => { for (let i = 0; i < C.n; i++) showC(S, C, i, ws); relabel(S.mm, 'Main memory：A = ' + C.mem); };
const up = (i) => [[PX[i], CY], [PX[i], SBY], [MM[0], SBY], [MM[0], MM[1]]];
const down = (i) => up(i).slice().reverse();

// ════════ r_ZE1XVT8Ao（Cache Coherence Problem & Cache Coherency Protocols） ════════
scene('cpar-org', '多核心：private cache 與 shared storage', [
  async (tok, S) => { // @37.2
    S.core = [-3.2, 3.2].map((x, i) => cube('Core ' + i, '#31aab0', [2.2, 0.7, 1.0], x, 6.6));
    S.l1 = [-3.2, 3.2].map((x) => cube('L1', '#9b7ef4', [2.2, 0.55, 1.0], x, 5.75));
    S.l2 = [-3.2, 3.2].map((x) => cube('L2', '#4b9ee2', [2.2, 0.55, 1.0], x, 5.0));
    S.l3 = cube('L3 cache', '#2fc092', [8.6, 0.6, 1.0], 0, 4.0);
    S.t = hd('dual-core processor 的基本結構', 0, 7.5);
    cap('dual-core processor 的結構', '每個 core 都有自己的 cache');
  },
  async (tok, S) => { // @45.9
    S.sb = cube('', '#b9a98c', [10.0, 0.14, 0.3], 0, 2.8); S.sbL = sm('system bus', -5.4, 3.12);
    S.mm = cube('Main memory', '#c9b48e', [4.0, 0.9, 1.1], 0, 1.4);
    S.w = [wire(0, 2.8, 0, 3.7, '#b9a98c', 0.08), wire(0, 1.85, 0, 2.8, '#b9a98c', 0.08)];
    await chip(tok, 'data', [[0, 1.4], [0, 2.8], [0, 4.0]], 900);
    cap('processor 經 system bus', '接到 main memory');
  },
  async (tok, S) => { // @51.1
    [...S.l1, ...S.l2].forEach((m) => glow(m, '#6a4a00'));
    S.pv = [-3.2, 3.2].map((x, i) => hot('Core ' + i + ' 私有（private）', x, 4.55));
    cap('L1、L2 是每個 core 的', 'private storage');
  },
  async (tok, S) => { // @60.2
    [...S.l1, ...S.l2].forEach((m) => glow(m, null)); gone(S.pv);
    glow(S.l3, '#0f5a3a'); glow(S.mm, '#0f5a3a');
    S.sh = good('L3 與 main memory：大家共用（shared）', 3.6, 1.4);
    cap('L3 與 main memory', '是 shared storage');
  },
  async (tok, S) => { // @64.7
    S.n = note('multiprocessor：每個 core 有自己的儲存，也有大家共用的儲存', 0, 0.3);
    cap('每個 core 有獨立的 storage', '也有共用的 storage');
  },
  async (tok, S) => { // @78.8
    gone(S.core, S.l1, S.l2, S.l3, S.sb, S.sbL, S.mm, S.w, S.sh, S.n, S.t);
    S.p = PX.map((x, i) => cube('P' + (i + 1), '#31aab0', [1.5, 0.65, 1.0], x, PY));
    S.c = PX.map((x) => cube('private cache', '#d8cfc0', [2.7, 0.75, 1.0], x, CY));
    S.t = hd('四個處理器 P1–P4，簡化成各有一個 private cache', 0, 7.4);
    cap('四個處理器 P1～P4', '簡化：各只有一個 private cache');
  },
  async (tok, S) => { // @96.4
    S.sb = cube('', '#b9a98c', [12.0, 0.14, 0.3], 0, SBY); S.sbL = sm('system bus', -5.6, SBY + 0.32);
    S.wv = PX.map((x) => wire(x, SBY, x, CY - 0.38, '#b9a98c', 0.06));
    S.mm = cube('Main memory（shared）', '#c9b48e', [4.0, 0.9, 1.1], MM[0], MM[1]);
    S.mw = wire(0, SBY, 0, MM[1] + 0.45, '#b9a98c', 0.08);
    cap('共用的是 main memory', '經 system bus 連接');
  },
  async (tok, S) => { // @103.7
    S.ib = cube('', '#c08a1f', [12.0, 0.1, 0.25], 0, IBY); S.ibL = sm('internal bus', -5.6, IBY + 0.3);
    glow(S.ib, '#6a4a00');
    await chip(tok, '↔', [[PX[0], IBY], [PX[3], IBY]], 1200);
    glow(S.ib, null);
    cap('private cache 之間', '用 internal bus 互相連接');
  },
]);

scene('cpar-incoh', '例子：A = 7，四個處理器各改一次 → 四個不同的值', [
  async (tok, S) => { // @109.5
    quad(S); S.C = mkCoh(4, 7, 'none');
    glow(S.mm, '#6a4a00');
    S.t = hd('main memory 裡有一個 global variable A = 7', 0, 7.4);
    cap('程式裡有 global variable A', '初值 7，放在 main memory');
  },
  async (tok, S) => { // @118.1
    glow(S.mm, null);
    S.n = sm('講者稱 MISD；課本（Flynn）：多核心共享記憶體屬 MIMD', 0, 0.35);
    S.all = PX.map((x) => tag('A', 'pkt', x, PY + 0.65, 0.9));
    cap('四個處理器都在處理同一個 A', 'operate on the same data');
  },
  async (tok, S) => { // @134.3
    gone(S.all);
    S.op = [hot('A + 1', PX[0], PY + 0.75)];
    cap('P1 想做 A + 1', '把 A 加 1');
  },
  async (tok, S) => { // @143.5
    glow(S.c[0], '#7a1010');
    S.miss = bad('P1 的 cache 裡沒有 A：compulsory miss', PX[0] + 0.6, 3.6);
    cap('先找自己的 private cache', '第一次存取 → compulsory miss');
  },
  async (tok, S) => { // @160.0
    gone(S.miss); glow(S.c[0], null);
    await chip(tok, '7', down(0), 1300);
    S.C.read(0); showAll(S, S.C, false);
    cap('去下一層：main memory', '把 A = 7 帶進 P1 的 cache');
  },
  async (tok, S) => { // @175.3
    S.C.write(0, S.C.v[0] + 1); showAll(S, S.C, false); glow(S.c[0], '#6a4a00');
    S.r1 = ok(S.C.v[0] === 8, PX[0], 3.6, 'P1：7 + 1 = 8 ✓');
    cap('P1 把 A 加 1', 'A = 8');
  },
  async (tok, S) => { // @184.0
    glow(S.c[0], null);
    S.op.push(hot('A + 2', PX[1], PY + 0.75));
    await chip(tok, '7', down(1), 1300);
    S.C.read(1); showAll(S, S.C, false);
    S.ex = sm('（假設 write-back：P1 只改了自己的 cache，memory 還是 7）', 0, 0.35); gone(S.n); S.n = S.ex;
    cap('P2 想做 A + 2', 'cache 沒有 → 從 main memory 拿 7');
  },
  async (tok, S) => { // @205.5
    S.C.write(1, S.C.v[1] + 2); showAll(S, S.C, false); glow(S.c[1], '#6a4a00');
    S.r2 = ok(S.C.v[1] === 9, PX[1], 3.6, 'P2：7 + 2 = 9 ✓');
    cap('P2 把 A 加 2', 'A = 9');
  },
  async (tok, S) => { // @217.8
    glow(S.c[1], null);
    S.op.push(hot('A − 1', PX[2], PY + 0.75));
    await chip(tok, '7', down(2), 1100);
    S.C.read(2); S.C.write(2, S.C.v[2] - 1); showAll(S, S.C, false); glow(S.c[2], '#6a4a00');
    S.r3 = ok(S.C.v[2] === 6, PX[2], 3.6, 'P3：7 − 1 = 6 ✓');
    cap('P3 把 A 減 1', '一樣從 memory 拿 7 → 6');
  },
  async (tok, S) => { // @240.0
    glow(S.c[2], null);
    S.op.push(hot('A − 2', PX[3], PY + 0.75));
    await chip(tok, '7', down(3), 1100);
    S.C.read(3); S.C.write(3, S.C.v[3] - 2); showAll(S, S.C, false); glow(S.c[3], '#6a4a00');
    S.r4 = ok(S.C.v[3] === 5, PX[3], 3.6, 'P4：7 − 2 = 5 ✓');
    cap('P4 把 A 減 2', 'A = 5');
  },
  async (tok, S) => { // @257.0
    gone(S.r1, S.r2, S.r3, S.r4, S.op); glow(S.c[3], null);
    S.c.forEach((m) => glow(m, '#7a1010'));
    const vals = S.C.v.slice(); S.distinct = new Set(vals).size;
    S.r = ok(vals.join() === '8,9,6,5' && S.distinct === 4 && S.C.mem === 7, 0, 3.6, '同一個 A：8、9、6、5，memory 還是 7 → 五個地方五個值 ✓');
    cap('同一個 A', '在不同 cache 裡有不同的值');
  },
  async (tok, S) => { // @263.8
    gone(S.t);
    S.t = hot('不一致（inconsistency）= cache coherence problem', 0, 7.4);
    cap('這種不一致', '就叫 cache coherence problem');
  },
]);

scene('cpar-def', 'cache coherence 與 cache coherence problem 的定義', [
  async (tok, S) => { // @270.0
    quad(S); S.C = mkCoh(4, 7, 'none');
    [0, 1, 2, 3].forEach((i) => S.C.read(i)); showAll(S, S.C, false);
    S.c.forEach((m) => glow(m, '#0f5a3a'));
    S.t = hd('cache coherence：多個 local cache 裡的共享資料保持一致（uniformity）', 0, 7.4);
    S.r = ok(new Set(S.C.v).size === 1, 0, 3.6, '四個 cache 的 A 都是 7：一致 ✓');
    cap('cache coherence', '共享資料在各 cache 中保持一致');
  },
  async (tok, S) => { // @285.2
    gone(S.r); S.c.forEach((m) => glow(m, null));
    S.C.write(0, 8); showAll(S, S.C, false); glow(S.c[0], '#6a4a00');
    S.r = bad('P1 更新了自己的副本 → 其他三個還是 7', 0, 3.6);
    cap('問題：某個處理器更新了副本', '其他 cache 怎麼保持同步？');
  },
  async (tok, S) => { // @297.9
    S.lk = [1, 2, 3].map((i) => arrow(V3(PX[0] + 0.9, CY - 0.5, 0.6), V3(PX[i] - 0.5, CY - 0.5, 0.6), 0xc08a1f));
    S.n = note('共享的值放在好幾個 private cache 裡 → 必須同步；難就難在這裡', 0, 0.35);
    cap('多個 cache 裡的共享值', '要一直保持同步');
  },
  async (tok, S) => { // @311.2
    gone(S.lk, S.r); glow(S.c[0], null);
    S.r = good('解法：cache coherency protocols（訂好規則）', 0, 3.6);
    cap('解法：cache coherency protocol', '訂一些 ground rules');
  },
]);

scene('cpar-msi', 'cache line 的狀態：Modified、Shared、Invalid', [
  async (tok, S) => { // @327.9
    S.lines = [0, 1, 2, 3].map((k) => cube('line ' + k, '#efe6d6', [3.2, 0.5, 0.9], -3.2, 6.4 - k * 0.6));
    S.t = hd('cache 邏輯上分成一條條 line（block）', -3.2, 7.4);
    cap('每個 cache 分成 lines（blocks）', '');
  },
  async (tok, S) => { // @334.7
    S.ctl = cube('cache controller', '#31aab0', [2.6, 0.8, 1.0], 2.6, 6.4);
    S.stc = [0, 1, 2, 3].map((k) => cube('狀態 ?', '#d8cfc0', [1.3, 0.45, 0.9], -0.9, 6.4 - k * 0.6));
    S.n = note('cache controller 替每一條 block 記一個「狀態」', 2.6, 5.4);
    cap('cache controller 記錄資訊', '每個 block 都有一個 state');
  },
  async (tok, S) => { // @346.8
    relabel(S.stc[0], 'M'); tint(S.stc[0], STC.M);
    S.dM = bad('M（Modified）：被自己的處理器改過，和 main memory 不一致', 2.6, 4.5);
    cap('Modified', '自己改過、和 memory 不一致');
  },
  async (tok, S) => { // @360.4
    relabel(S.stc[1], 'S'); tint(S.stc[1], STC.S);
    S.dS = hot('S（Shared）：沒被改過，可以出現在一個以上的 cache', 2.6, 3.7);
    cap('Shared', '沒改過，可以在好幾個 cache 中');
  },
  async (tok, S) => { // @374.7
    S.n2 = note('一個 block 要同時出現在多個 cache，只能是 Shared', 2.6, 2.9);
    cap('要出現在多個 cache', '只能是 Shared 狀態');
  },
  async (tok, S) => { // @380.2
    relabel(S.stc[2], 'I'); tint(S.stc[2], STC.I);
    S.dI = sm('I（Invalid）：別的處理器寫了這份資料 → 我的副本作廢', 2.6, 2.2);
    cap('Invalid', '別人寫了 → 我的副本作廢');
  },
  async (tok, S) => { // @393.1
    gone(S.lines, S.stc, S.ctl, S.n, S.n2, S.dM, S.dS, S.dI, S.t);
    quad(S); S.C = mkCoh(4, 7, 'MSI');
    await chip(tok, '7', down(0), 700); S.C.read(0); showAll(S, S.C);
    await chip(tok, '7', down(1), 700); S.C.read(1); showAll(S, S.C);
    S.r = ok(S.C.st.join() === 'S,S,I,I', 0, 3.6, '第一次從 memory 拿：P1、P2 都設成 S ✓');
    S.t = hd('MSI：每次存取後的狀態（A = 7）', 0, 7.4);
    cap('第一次從 memory 拿進來', '狀態設成 Shared');
  },
  async (tok, S) => { // @403.4
    gone(S.r);
    S.C.write(0, 8);
    showC(S, S.C, 0); relabel(S.mm, 'Main memory：A = ' + S.C.mem); glow(S.c[0], '#6a4a00');
    S.inv = tag('invalidate A', 'pkt', PX[0], IBY, 0.9);
    S.r = ok(S.C.st[0] === 'M' && S.C.v[0] === 8 && S.C.mem === 7, 0, 3.6, 'P1 寫 A = 8：S → M（memory 還是 7）✓');
    cap('自己要改這條 line', 'S 升成 Modified');
  },
  async (tok, S) => { // @411.8
    gone(S.r);
    await travel(tok, S.inv, V3(PX[0], IBY, 0.9), V3(PX[1], IBY, 0.9), 900); remove(S.inv);
    showC(S, S.C, 1); glow(S.c[1], '#7a1010');
    S.r = ok(S.C.st[1] === 'I', 0, 3.6, '從 P2 看：別人先改了 → P2 的 S 降成 I ✓');
    cap('別的處理器先改了', '我的 line：S 降成 Invalid');
  },
]);

scene('cpar-eof', '其他狀態：Exclusive、Owned、Forward', [
  async (tok, S) => { // @429.5
    quad(S);
    S.t = hd('除了 M、S、I，還可以有：E（Exclusive）、O（Owned）、F（Forward）', 0, 7.4);
    cap('其他狀態', 'Exclusive、Owned、Forward');
  },
  async (tok, S) => { // @437.9
    S.C = mkCoh(4, 7, 'MESI');
    await chip(tok, '7', down(0), 700); S.C.read(0); showAll(S, S.C);
    S.e1 = S.C.st[0];
    await wt(tok, 300);
    await chip(tok, '7', down(1), 700); S.C.read(1); showAll(S, S.C);
    S.r = ok(S.e1 === 'E' && S.C.st[0] === 'S' && S.C.st[1] === 'S', 0, 3.6, 'P1 獨自讀 → E；P2 也讀 → 兩個都變 S ✓（MESI）');
    cap('Exclusive：只有我有、和 memory 一樣', '別人來讀就變成 Shared');
  },
  async (tok, S) => { // @451.4
    gone(S.r);
    S.C = mkCoh(4, 7, 'MOESI'); S.C.read(0); S.C.write(0, 8); showAll(S, S.C); await wt(tok, 500);
    const src = S.C.read(1);
    await chip(tok, '8', [[PX[0], CY], [PX[0], IBY], [PX[1], IBY], [PX[1], CY]], 1100);
    showAll(S, S.C);
    S.r = ok(S.C.st[0] === 'O' && S.C.st[1] === 'S' && src === 0 && S.C.mem === 7, 0, 3.6, 'P1 改過（M）→ P2 來讀：P1 變 O，由 P1 供應 8 ✓（MOESI）');
    cap('Owned：唯一的擁有者', '負責回應別人的讀取');
  },
  async (tok, S) => { // @464.4
    gone(S.r);
    S.C = mkCoh(4, 7, 'MESIF'); S.C.read(0); S.C.read(1); showAll(S, S.C); await wt(tok, 500);
    const f0 = S.C.st.indexOf('F');
    const src = S.C.read(2);
    await chip(tok, '7', [[PX[f0], CY], [PX[f0], IBY], [PX[2], IBY], [PX[2], CY]], 1100);
    showAll(S, S.C);
    S.r = ok(f0 === 1 && src === 1 && S.C.st[2] === 'F' && S.C.st.filter((s) => s === 'F').length === 1, 0, 3.6, 'F 是特殊的 S：P3 來讀時由 F（P2）轉送，F 交給最新的 P3 ✓（MESIF）');
    cap('Forward：特殊的 Shared', '由它負責轉送資料');
  },
  async (tok, S) => { // @485.3
    gone(S.r);
    S.pl = [['MSI', 'M S I'], ['MESI', '+ E'], ['MOESI', '+ E、O'], ['MESIF', '+ E、F']].map(([a, b], k) => sm(a + '：' + b, -4.5 + k * 3.0, 0.35));
    S.r = note('用哪些狀態，取決於採用的 protocol', 0, 3.6);
    cap('可用的狀態', '取決於用哪一種 protocol');
  },
]);

scene('cpar-swhw', '軟體 scheme vs 硬體 protocol', [
  async (tok, S) => { // @494.8
    S.sw = cube('software-based scheme', '#9b7ef4', [4.2, 0.9, 1.0], -3.2, 5.6);
    S.cp = cube('compiler', '#efe6d6', [1.8, 0.6, 0.9], -4.3, 4.3); S.os = cube('OS', '#efe6d6', [1.8, 0.6, 0.9], -2.1, 4.3);
    S.t = hd('解決 coherence problem 的軟體做法：靠 compiler 與 OS', 0, 7.4);
    cap('software-based scheme', '只靠 compiler 和 OS');
  },
  async (tok, S) => { // @507.3
    S.code = code(['x = shared[i];   // 可能不安全', 'y = local + 1;   // 安全'], -3.2, 3.3, 0.45);
    glow(S.cp, '#6a4a00'); await wt(tok, 700); glow(S.cp, null); glow(S.os, '#6a4a00');
    S.n = note('compiler 分析程式找出「不安全」的資料；OS 在執行時不讓它進 cache（示意）', -3.2, 1.8);
    cap('compiler 找出不安全的資料', 'OS 在執行時不讓它被 cache');
  },
  async (tok, S) => { // @520.4
    glow(S.os, null);
    S.hw = cube('hardware-based protocol', '#31aab0', [4.2, 0.9, 1.0], 3.2, 5.6);
    S.l1 = sm('軟體 → 叫 scheme', -3.2, 6.35); S.l2 = sm('硬體 → 叫 protocol', 3.2, 6.35);
    cap('軟體的叫 scheme', '硬體的才叫 protocol');
  },
  async (tok, S) => { // @530.9
    glow(S.hw, '#0f5a3a');
    S.r = good('COA 課程重點：硬體 protocol，效能比 scheme 好', 3.2, 4.4);
    cap('本課只談硬體 protocol', '效能比軟體 scheme 好');
  },
]);

scene('cpar-snoop', 'Snooping：write update vs write invalidate（× write-through／write-back）', [
  async (tok, S) => { // @543.3
    quad(S);
    S.t = hd('兩類 protocol：① snooping（bus-based） ② directory-based', 0, 7.4);
    cap('protocol 有兩類', '第一類：snooping（bus-based）');
  },
  async (tok, S) => { // @549.6
    S.C = mkCoh(4, 7, 'MSI'); [0, 1, 2, 3].forEach((i) => S.C.read(i)); showAll(S, S.C);
    glow(S.ib, '#6a4a00');
    S.ears = [1, 2, 3].map((i) => tag('監聽 bus', 'pkt', PX[i], IBY + 0.45, 0.9));
    await chip(tok, '廣播：P1 要寫 A', [[PX[0], IBY], [PX[3], IBY]], 1400);
    glow(S.ib, null);
    S.n = note('一個處理器在 bus 上廣播 → 其他 cache controller 都在 snoop（監聽），各自處理自己的副本', 0, 0.35);
    cap('每個 cache 隨時監聽 bus', '收到廣播就處理自己的副本');
  },
  async (tok, S) => { // @567.3
    gone(S.ears);
    S.ap = [hot('write update', -2.6, 3.6), hot('write invalidate', 2.6, 3.6)];
    txt(S.n, 'snooping 主要有兩種做法：write update、write invalidate');
    cap('兩種做法', 'write update 與 write invalidate');
  },
  async (tok, S) => { // @576.5
    gone(S.ap);
    S.U = mkCoh(4, 7, 'MSI', 'upd'); [0, 1, 2, 3].forEach((i) => S.U.read(i));
    const n = S.U.write(0, 8);
    await chip(tok, 'A = 8（更新）', [[PX[0], IBY], [PX[3], IBY]], 1300);
    showAll(S, S.U, false); S.c.forEach((m) => tint(m, '#4b9ee2')); glow(S.c[0], '#6a4a00');
    S.r = ok(n === 3 && S.U.v.every((v) => v === 8), 0, 3.6, 'write update：P1 寫 8 → 其他 3 個副本同時改成 8 ✓');
    txt(S.n, 'write update：寫的那一個 S → M 時，其他共享的副本一起被更新');
    cap('write update', '其他副本一起被更新');
  },
  async (tok, S) => { // @589.1
    gone(S.r); glow(S.c[0], null);
    S.C = mkCoh(4, 7, 'MSI'); [0, 1, 2, 3].forEach((i) => S.C.read(i)); showAll(S, S.C); await wt(tok, 400);
    const n = S.C.write(0, 8);
    await chip(tok, 'invalidate', [[PX[0], IBY], [PX[3], IBY]], 1300);
    showAll(S, S.C);
    S.r = ok(n === 3 && S.C.st.join() === 'M,I,I,I', 0, 3.6, 'write invalidate：P1 → M，其他 3 個 → I ✓');
    txt(S.n, 'write invalidate：其他共享的 cache 把自己的副本作廢');
    cap('write invalidate', '其他副本自己作廢');
  },
  async (tok, S) => { // @598.8
    gone(S.r);
    const WT = mkCoh(4, 7, 'MSI', 'inv', 'wt'); WT.read(0); WT.write(0, 8);
    const WB = mkCoh(4, 7, 'MSI', 'inv', 'wb'); WB.read(0); WB.write(0, 8);
    await chip(tok, '8', up(0), 1100);
    relabel(S.mm, 'memory：write-through 8 ／ write-back 7');
    S.r = ok(WT.mem === 8 && WB.mem === 7, 0, 3.6, 'write-through：memory 立刻變 8；write-back：memory 先維持 7 ✓');
    txt(S.n, '再依寫入策略細分：write-through（同時寫 memory）或 write-back（之後才寫回）');
    cap('每種再依 write strategy 分', 'write-through 或 write-back');
  },
  async (tok, S) => { // @623.1
    gone(S.r);
    S.grid = [['update + write-through', -4.4, 1.95], ['update + write-back', 4.4, 1.95], ['invalidate + write-through', -4.4, 1.35], ['invalidate + write-back', 4.4, 1.35]].map(([t, x, y]) => hot(t, x, y));
    S.r = ok(S.grid.length === 2 * 2, 0, 0.95, '2 種做法 × 2 種寫入策略 = 4 種 ✓');
    txt(S.n, 'snooping 共四種組合');
    cap('snooping 共四種', 'update／invalidate × WT／WB');
  },
]);

scene('cpar-dir', 'Directory-based protocol：點對點，不廣播', [
  async (tok, S) => { // @636.2
    quad(S);
    S.t = hd('第二類：directory-based protocol', 0, 7.4);
    cap('第二類：directory-based', '');
  },
  async (tok, S) => { // @641.4
    S.C = mkCoh(4, 7, 'MSI'); S.C.read(0); S.C.read(2); showAll(S, S.C);
    S.pres = S.C.st.map((s) => (s === 'I' ? 0 : 1));
    S.dir = cube('directory：A → S，在 [' + S.pres.join(' ') + ']', '#e9dcc4', [4.6, 0.7, 1.0], 3.6, MM[1]);
    S.n = note('集中的 directory 記錄每個資料在哪些 cache 裡（示意：P1、P3）', -3.0, 0.35);
    cap('集中的 directory', '記錄每個資料的去向');
  },
  async (tok, S) => { // @646.1
    S.pd = PX.map((x) => sm('私有 dir', x + 1.0, PY + 0.55));
    txt(S.n, '每個處理器也維護自己的 private directory，一起達成一致性');
    cap('每個處理器也有 private directory', '');
  },
  async (tok, S) => { // @652.7
    const others = S.pres.map((b, i) => (b && i !== 0 ? i : -1)).filter((i) => i >= 0);
    await chip(tok, '我要寫 A', [[PX[0], CY], [PX[0], SBY], [3.6, SBY], [3.6, MM[1]]], 900);
    for (const i of others) await chip(tok, 'invalidate', [[3.6, MM[1]], [3.6, SBY], [PX[i], SBY], [PX[i], CY]], 900);
    S.C.write(0, 8); showAll(S, S.C);
    relabel(S.dir, 'directory：A → M，只在 [1 0 0 0]');
    S.r = ok(others.length === 1 && S.C.st.join() === 'M,I,I,I', 0, 3.6, '只送 1 個點對點訊息（給 P3）；snooping 要廣播給其他 3 個 ✓');
    txt(S.n, 'snooping：broadcast、靠 bus；directory：可擴充的網路、point-to-point');
    cap('snooping 用 broadcast + bus', 'directory 用點對點網路');
  },
  async (tok, S) => { // @678.0
    gone(S.r);
    S.r = good('cache coherency protocol = 解決 coherence problem 的硬體做法', 0, 3.6);
    cap('記住：protocol 是硬體解法', '');
  },
]);

// ════════ 2dYV_lADfFI（Amdahl's Law：正規化、speedup 公式、處理器上限、浮點 20% 快 3 倍） ════════
const AMD = (f, s) => 1 / ((1 - f) + f / s);
const r4 = (x) => Math.round(x * 10000) / 10000;
const BX = -4.0, BW = 8.0;  // 正規化的「1」= 8 個單位長
function hb(color, x0, y, w, text = '') { const m = cube(text, color, [1, 0.6, 0.8], x0 + Math.max(0.02, w) / 2, y); m.scale.x = Math.max(0.02, w); return m; }
function setW(m, x0, w) { m.scale.x = Math.max(0.02, w); m.position.x = x0 + Math.max(0.02, w) / 2; }
// 示意長度用 f = 0.2、s = 3（就是影片後面例題的數字），bar 上只寫符號
const FX = 0.2, SX = 3;

scene('cpar-am-intro', "Amdahl's law：CPU 增強之後，整體快多少", [
  async (tok, S) => { // @2.6
    S.cpu = cube('CPU', '#31aab0', [2.2, 1.2, 1.4], 0, 4.6);
    S.t = hd("Amdahl's law：CPU 增強（enhancement）之後，整體 speedup 是多少？", 0, 7.3);
    cap("Amdahl's law", '增強 CPU 後的 overall speedup');
  },
  async (tok, S) => { // @13.6
    await anim(tok, 900, (u) => { S.cpu.position.x = -3.2 * u; }); relabel(S.cpu, 'CPU（原本）');
    S.cpu2 = cube('CPU（增強後）', '#2fc092', [2.4, 1.2, 1.4], 3.2, 4.6);
    S.a = arrow(V3(-1.9, 4.6, 0.5), V3(1.9, 4.6, 0.5), 0xc08a1f);
    S.q = hot('整體快幾倍？', 0, 5.6);
    cap('CPU 加了一些 enhancement', '整體 speedup 是多少？');
  },
  async (tok, S) => { // @22.9
    S.n = note('增強 CPU 的方法有很多種', 0, 0.4);
    cap('enhancement 可以用很多方式做', '');
  },
  async (tok, S) => { // @28.7
    S.w1 = cube('改良 instruction set', '#9b7ef4', [3.2, 0.7, 1.0], -4.0, 2.2, 0, 2.5);
    cap('例如：改良 instruction set', '');
  },
  async (tok, S) => { // @33.8
    S.w2 = cube('pipelining', '#9b7ef4', [3.2, 0.7, 1.0], 0, 2.2, 0, 2.5);
    cap('例如：pipelining', '');
  },
  async (tok, S) => { // @37.0
    S.w3 = cube('multiprocessor system', '#9b7ef4', [3.2, 0.7, 1.0], 4.0, 2.2, 0, 2.5);
    cap('例如：multiprocessor system', '');
  },
  async (tok, S) => { // @55.6
    glow(S.cpu2, '#0f5a3a');
    txt(S.n, "不管用哪一種增強，整體快多少都用 Amdahl's law 算");
    cap('不管哪種增強', "都用 Amdahl's law 算整體效果");
  },
  async (tok, S) => { // @66.3
    glow(S.cpu2, null);
    S.ex = bub('競試一定會考：先弄懂幾個名詞，就能解題', 0, 6.4);
    cap('考試一定會出', '先弄懂幾個名詞');
  },
  async (tok, S) => { // @81.4
    gone(S.ex);
    txt(S.n, "Amdahl's law：說明 CPU 增強之後，整體的 speedup（加速倍數）");
    txt(S.q, 'overall speedup = ?');
    cap("Amdahl's law 說明的是", '增強後 CPU 整體的 speedup');
  },
]);

scene('cpar-am-norm', '正規化：全部指令 = 1，f 被增強、1 − f 不變', [
  async (tok, S) => { // @111.0
    S.old = cube('CPU（原本）', '#31aab0', [2.2, 1.0, 1.2], -4.6, 6.4);
    S.t = hd('先看一個「原本」的 CPU', 0.8, 7.4);
    cap('先看一個原本的 CPU', 'old condition');
  },
  async (tok, S) => { // @117.5
    S.blk = Array.from({ length: 10 }, (_, k) => cube('', '#9aa0a6', [0.76, 0.55, 0.7], BX + 0.4 + k * 0.8, 4.6, 0, 1.5));
    S.nL = sm('n 個 instructions', BX - 0.9, 5.3);
    cap('CPU 要執行 n 個 instructions', '');
  },
  async (tok, S) => { // @126.7
    S.one = hot('正規化（normalized）：當作 1', 0, 5.5);
    cap('用正規化的指令數', '把它當作 1');
  },
  async (tok, S) => { // @132.6
    txt(S.nL, '500 個？1000 個？');
    cap('可能是 500 個', '也可能是 1000 個');
  },
  async (tok, S) => { // @140.6
    const N = 1000, norm = N / N;
    S.c1 = ok(norm === 1, 0, 3.6, '正規化 = 指令數 ÷ 總指令數 = 1000 ÷ 1000 = 1 ✓');
    gone(S.blk); S.all = hb('#9aa0a6', BX, 4.6, BW, '全部指令 = 1');
    cap('normalized = 指令數 ÷ 總指令數', '1000 ÷ 1000 = 1');
  },
  async (tok, S) => { // @149.0
    gone(S.c1);
    S.pc = ['20%', '30%', '50%'].map((p, k) => tag(p, 'pkt', -2.0 + k * 2.0, 3.6, 0.9));
    S.n = note('為什麼要正規化？題目給的增強比例通常是百分比', 0, 0.4);
    cap('題目通常給百分比', '20%、30%、50%');
  },
  async (tok, S) => { // @161.8
    const hard = 0.3 * 1000, easy = 0.3 * 1;
    gone(S.pc);
    S.c1 = ok(Math.abs(hard - 300) < 1e-9 && Math.abs(easy - 0.3) < 1e-12, 0, 3.6, '不用算「30% 是幾個指令（300 個）」：直接寫 0.3 就好 ✓');
    cap('每次換算指令數太麻煩', '總數當 1，直接用比例');
  },
  async (tok, S) => { // @193.0
    gone(S.c1, S.n);
    S.nw = cube('CPU（增強後）', '#2fc092', [2.4, 1.0, 1.2], -4.6, 2.4);
    setW(S.all, BX, (1 - FX) * BW); relabel(S.all, '1 − f（沒有增強）');
    S.n = note('增強後：沒有被增強的部分 = 1 − f', 0, 0.4);
    cap('沒有被增強的部分', '是 1 − f');
  },
  async (tok, S) => { // @196.7
    S.f = hb('#4b9ee2', BX + (1 - FX) * BW, 4.6, FX * BW, 'f');
    txt(S.n, '被增強的部分 = f（一個比例，例如 0.2）');
    cap('被增強的部分是 f', '以比例來增強指令');
  },
  async (tok, S) => { // @216.0
    S.l1 = sm('1 − f：unenhanced', BX + (1 - FX) * BW / 2, 3.85); S.l2 = sm('f：enhanced', BX + (1 - FX / 2) * BW, 3.85);
    S.c1 = ok(Math.abs((1 - FX) + FX - 1) < 1e-12, 0, 3.2, '(1 − f) + f = 1：加起來還是全部 ✓');
    cap('記下來：1 − f 沒增強', 'f 有增強');
  },
  async (tok, S) => { // @225.3
    gone(S.c1);
    S.s = hot('快了 s 倍（scale s）', BX + (1 - FX / 2) * BW, 5.5);
    glow(S.f, '#6a4a00');
    txt(S.n, '題目會告訴你被增強的部分「快了幾倍」：記作 s');
    cap('增強的倍數會給你', '記作 s');
  },
  async (tok, S) => { // @236.0
    glow(S.f, null);
    S.q = hot('那整體 speedup 是多少？', 0, 1.6);
    cap('增強 s 倍之後', '整體 speedup 是多少？');
  },
]);

scene('cpar-am-formula', 'speedup = 舊時間 ÷ 新時間 = 1 / ((1 − f) + f / s)', [
  async (tok, S) => { // @250.6
    S.hO = hd('舊 CPU 的時間', BX - 0.6, 6.3); S.hN = hd('新 CPU 的時間', BX - 0.6, 4.3);
    S.t = hot('overall speedup 取決於「時間的比值」', 0, 7.4);
    cap('speedup 看的是時間比', '舊 CPU 和新 CPU 各要多久');
  },
  async (tok, S) => { // @265.2
    S.o = hb('#9aa0a6', BX, 5.6, BW, '1');
    S.c1 = sm('全部都沒增強：正規化時間 = 1', 0, 4.95);
    cap('舊 CPU：1000 個指令都沒增強', '正規化時間 = 1');
  },
  async (tok, S) => { // @280.0
    gone(S.c1);
    S.qq = hot('?', 0, 3.6);
    cap('新 CPU 要花多少時間？', '');
  },
  async (tok, S) => { // @284.1
    gone(S.qq);
    S.u = hb('#9aa0a6', BX, 3.6, (1 - FX) * BW, '1 − f');
    cap('沒增強的部分', '時間一樣是 1 − f');
  },
  async (tok, S) => { // @299.7
    S.e = hb('#4b9ee2', BX + (1 - FX) * BW, 3.6, FX * BW, 'f');
    await anim(tok, 1200, (u) => setW(S.e, BX + (1 - FX) * BW, FX * BW * (1 - u * (1 - 1 / SX))));
    cap('增強的部分', '花的時間變少了');
  },
  async (tok, S) => { // @310.3
    relabel(S.e, 'f / s');
    S.c1 = sm('（長度示意：f = 0.2、s = 3）', 0, 2.8);
    cap('增強部分的時間', '= f ÷ s');
  },
  async (tok, S) => { // @313.4
    const tOld = 1, tNew = (1 - FX) + FX / SX;
    S.c2 = ok(tNew < tOld, 3.0, 4.3, '新 CPU 比較快：新時間 < 1 ✓');
    cap('新 CPU 花的時間比舊的少', '');
  },
  async (tok, S) => { // @320.9
    gone(S.c2);
    S.o2 = hb('#9aa0a6', BX, 5.6, (1 - FX) * BW, ''); S.o2.position.z = 0.05; glow(S.o2, '#6a4a00'); glow(S.u, '#6a4a00');
    S.c2 = note('沒增強的 1 − f：新舊兩邊花一樣久', 3.0, 4.3);
    cap('沒增強的部分', '兩邊花的時間一樣');
  },
  async (tok, S) => { // @326.6
    glow(S.u, null); gone(S.o2, S.c2);
    S.fm = hot('overall speedup = 舊時間 ÷ 新時間', 0, 1.9);
    cap('overall speedup', '= 舊時間 ÷ 新時間');
  },
  async (tok, S) => { // @340.7
    txt(S.fm, 'overall speedup = 1 ÷ 新時間');
    glow(S.o, '#6a4a00');
    cap('舊時間：正規化 = 1', '');
  },
  async (tok, S) => { // @345.3
    glow(S.o, null); glow(S.u, '#6a4a00'); glow(S.e, '#6a4a00');
    txt(S.fm, 'overall speedup = 1 / ((1 − f) + f / s)');
    cap('新時間 = (1 − f) + f / s', 'speedup = 1 / ((1 − f) + f/s)');
  },
  async (tok, S) => { // @349.6
    glow(S.u, null); glow(S.e, null); gone(S.c1);
    S.l1 = sm('1 − f：unenhanced', BX + (1 - FX) * BW / 2, 2.95); S.l2 = sm('f / s：enhanced', BX + (1 - FX) * BW + 1.0, 2.95);
    const tNew = (1 - FX) + FX / SX;
    S.c3 = ok(Math.abs(1 / tNew - AMD(FX, SX)) < 1e-12, 0, 1.2, '舊 ÷ 新 = 1 / ((1 − f) + f/s)：和公式算出來一樣 ✓');
    cap('記住：1 − f 是沒增強的', 'f / s 是增強後的');
  },
]);

scene('cpar-am-limit', '處理器再多，執行時間也會停在序列部分', [
  async (tok, S) => { // @364.8
    const f = 0.9, sp = AMD(f, 1000);
    S.t = hd('處理器加 1000 倍，CPU 會快 1000 倍嗎？', 0, 7.4);
    S.c = ok(sp < 10 && sp > 9.9, 0, 6.6, '示意 f = 0.9：1000 顆 → speedup = ' + r4(sp) + '，遠小於 1000 ✓');
    cap('處理器加上千倍', 'CPU 不會快上千倍');
  },
  async (tok, S) => { // @376.9
    S.u = hb('#9aa0a6', BX, 5.6, 0.1 * BW, '序列'); S.e = hb('#4b9ee2', BX + 0.1 * BW, 5.6, 0.9 * BW, '可平行 0.9');
    // the parallel part shrinks to a sliver beside the serial part: its name moves under it as a separate label
    // (a label offset inside a bar squeezed to 0.02 wide does not stay put)
    S.e.userData.lbl.element.style.visibility = 'hidden'; S.el = tag('可平行 0.9', 'val', BX + 0.1 * BW + 0.4, 4.55, 0.4);
    await anim(tok, 1200, (u) => setW(S.e, BX + 0.1 * BW, 0.9 * BW * (1 - u * (1 - 1 / 1000))));
    S.n = note('serial（序列）的那段：和舊 CPU 花一樣的時間', 0, 0.4);
    cap('序列的部分', '和舊 CPU 花一樣久');
  },
  async (tok, S) => { // @386.6
    txt(S.n, '不是處理器越多就一直越快：到某個數量後，執行時間變成常數');
    cap('處理器多到某個數量後', '執行時間變成常數');
  },
  async (tok, S) => { // @400.5
    gone(S.c, S.u, S.e, S.el);
    S.ax = [wire(-5.0, 0.9, 5.4, 0.9, '#6e5f49', 0.05), wire(-5.0, 0.9, -5.0, 5.9, '#6e5f49', 0.05)];
    S.yl = sm('執行時間（ms）', -5.0, 6.25); S.xl = sm('處理器數（對數）', 2.6, 0.45);
    S.X = (n) => -5.0 + Math.log2(n) / 10 * 10.2; S.Y = (t) => 0.9 + t * 4.6;
    S.pt = [cube('', '#d64545', [0.3, 0.3, 0.3], S.X(1), S.Y(1))]; S.p1 = sm('1 顆：1 ms', S.X(1) + 1.0, S.Y(1) + 0.3);
    txt(S.n, '例：一個程式在 1 顆 CPU 上要 1 ms（示意：其中 90% 可平行）');
    cap('例：一顆 CPU 跑 1 ms', '');
  },
  async (tok, S) => { // @407.7
    S.ts = {};
    for (const n of [2, 4, 8]) { const t = (1 - 0.9) + 0.9 / n; S.ts[n] = t; S.pt.push(cube('', '#d64545', [0.26, 0.26, 0.26], S.X(n), S.Y(t), 0, 1.0)); await wt(tok, 400); }
    S.c = ok(S.ts[2] > S.ts[4] && S.ts[4] > S.ts[8], 2.4, 5.9, '2、4、8 顆：' + r4(S.ts[2]) + ' → ' + r4(S.ts[4]) + ' → ' + r4(S.ts[8]) + ' ms，一開始下降很快 ✓');
    cap('一開始加處理器', '執行時間下降');
  },
  async (tok, S) => { // @414.9
    gone(S.c);
    for (const n of [64, 256, 1024]) { const t = 0.1 + 0.9 / n; S.ts[n] = t; S.pt.push(cube('', '#d64545', [0.26, 0.26, 0.26], S.X(n), S.Y(t), 0, 1.0)); await wt(tok, 400); }
    S.c = ok(S.ts[64] - S.ts[1024] < 0.015, 2.4, 5.9, '64 → 1024 顆：' + r4(S.ts[64]) + ' → ' + r4(S.ts[1024]) + ' ms，幾乎不動 ✓');
    cap('到某個數量後', '執行時間幾乎不變');
  },
  async (tok, S) => { // @420.3
    S.lim = wire(-5.0, S.Y(0.1), 5.4, S.Y(0.1), '#2fc092', 0.04);
    S.ll = sm('下限 0.1 ms', 4.6, S.Y(0.1) + 0.3);
    txt(S.n, '再多加處理器，執行時間也不會降到 0.1 ms 以下');
    cap('再加處理器', '時間也不會再往下降');
  },
  async (tok, S) => { // @426.0
    gone(S.c);
    S.c = ok(Math.abs((1 - 0.9) * 1 - 0.1) < 1e-12 && S.ts[1024] > 0.1, 2.4, 5.9, '下限 = 沒增強（序列）的 1 − f = 0.1 × 1 ms ✓');
    txt(S.n, '原因：有一段沒有被增強（序列）的部分，它的時間不會變');
    cap('原因：有沒增強的部分', "這就是 Amdahl's law 的意思");
  },
]);

scene('cpar-am-fp', '例題：浮點指令占 20%、快 3 倍 → 3 / 2.6 = 1.1538', [
  async (tok, S) => { // @437.8
    S.cpu = cube('科學計算用處理器', '#31aab0', [3.4, 1.0, 1.2], 0, 6.3);
    S.t = hd('例題', -4.6, 7.4);
    cap('例：科學計算常用的處理器', '');
  },
  async (tok, S) => { // @447.6
    S.blk = Array.from({ length: 10 }, (_, k) => cube(k < 2 ? 'FP' : 'INT', k < 2 ? '#4b9ee2' : '#9aa0a6', [0.76, 0.55, 0.7], BX + 0.4 + k * 0.8, 4.8, 0, 1.5));
    S.l = sm('integer 與 floating point 兩種指令', 0, 4.15);
    cap('有 integer 與 floating point 指令', '');
  },
  async (tok, S) => { // @451.4
    S.blk.slice(0, 2).forEach((m) => glow(m, '#6a4a00'));
    S.x3 = hot('浮點：快 3 倍；整數：沒增強', 0, 5.55);
    cap('浮點指令改良成 3 倍快', '整數指令沒變');
  },
  async (tok, S) => { // @460.0
    S.q = note('程式裡 20% 是浮點指令：整體 speedup？', 0, 0.4);
    cap('浮點指令占 20%', '求 overall speedup');
  },
  async (tok, S) => { // @473.2
    S.f = 2 / 10;
    S.v1 = ok(S.f === 0.2, -2.6, 3.4, 'f = 20% = 0.2（被增強的是浮點）✓');
    cap('被增強的是浮點', 'f = 0.2');
  },
  async (tok, S) => { // @487.1
    S.s = 3;
    S.v2 = hot('s = 3', 2.6, 3.4);
    cap('增強三倍', 's = 3');
  },
  async (tok, S) => { // @493.2
    S.fm = hot('speedup = 1 / ((1 − f) + f / s)', 0, 2.6);
    cap("代入 Amdahl's law", '1 / ((1 − f) + f / s)');
  },
  async (tok, S) => { // @508.7
    const un = r4(1 - S.f);
    S.u = hb('#9aa0a6', BX, 1.6, (1 - S.f) * BW, String(un)); S.e = hb('#4b9ee2', BX + (1 - S.f) * BW, 1.6, S.f * BW, '');
    await anim(tok, 1000, (u) => setW(S.e, BX + (1 - S.f) * BW, S.f * BW * (1 - u * (1 - 1 / S.s))));
    relabel(S.e, '0.2/3');
    txt(S.fm, '= 1 / (' + un + ' + 0.2 / 3)');
    cap('代入數字', '1 / (0.8 + 0.2/3)');
  },
  async (tok, S) => { // @518.4
    gone(S.q);
    S.num = S.s; S.den = r4(S.s * (1 - S.f) + S.f);
    txt(S.fm, '通分（上下乘 3）：= 3 / (3 × 0.8 + 0.2) = 3 / (2.4 + 0.2) = 3 / ' + S.den);
    S.v3 = ok(Math.abs(S.s * (1 - S.f) - 2.4) < 1e-12 && S.den === 2.6, 0, 0.6, '3 × 0.8 = 2.4，2.4 + 0.2 = 2.6 ✓');
    cap('取 LCM：分子變 3', '3 × 0.8 = 2.4，+ 0.2 = 2.6');
  },
  async (tok, S) => { // @526.5
    gone(S.v3);
    S.sp = AMD(S.f, S.s);
    txt(S.fm, 'speedup = 3 / 2.6 = ' + r4(S.sp));
    S.v3 = ok(r4(S.sp) === 1.1538 && Math.abs(S.num / S.den - S.sp) < 1e-12, 0, 0.6, '3 / 2.6 = 1.1538 ✓');
    cap('3 ÷ 2.6', '= 1.1538');
  },
  async (tok, S) => { // @531.5
    gone(S.v3);
    S.cmp = bad('浮點快 3 倍，整體只快約 ' + (Math.round(S.sp * 100) / 100) + ' 倍', 0, 0.6);
    cap('浮點快 3 倍', '整體只快 1.15 倍');
  },
  async (tok, S) => { // @547.7
    const lim = 1 / (1 - S.f); gone(S.x3);
    S.end = note('局部快 s 倍 ≠ 整體快 s 倍（f = 0.2 時，s 再大整體也不到 ' + r4(lim) + ' 倍）', 0, 5.55);
    S.v4 = ok(Math.abs(lim - 1.25) < 1e-12 && AMD(S.f, 1e9) < lim, 3.4, 7.4, '上限 1 / (1 − f) = 1.25 ✓');
    cap('只加速一部分', '整體不會快那麼多倍');
  },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
      'flynn', 'multithreading', 'shared-memory', 'reduction', 'coherence-problem', 'snoop-invalidate', 'mesi', 'mesi-vs-msi', 'false-sharing', 'gpu'].concat(FRAG.map((f) => f[0])),
    _genQ: genQ,
    stop() { stopTimer(); },
  };
}
