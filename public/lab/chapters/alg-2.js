// 演算法 第2章：分治法 Divide and Conquer（binary search、merge sort、quicksort、Strassen、Karatsuba／Newton、selection、maximum subarray）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 場景依影片段落：Abdul Bari 2.x、MIT 6.006 Rec3 / L12；課本補充場景以 CLRS 為準。
import kit from './_kit.js';

export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  let timer = null;
  const stopTimer = () => { clearInterval(timer); timer = null; };

  // ───────────────────────── 共用小工具 ─────────────────────────
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', RED = '#5a1010', GRAY = '#d8cfc0';
  const C = { blue: '#4b9ee2', purple: '#9b7ef4', green: '#2fc092', orange: '#dd8238', pink: '#e55a9b', teal: '#31aab0', gold: '#c08a1f', red: '#d64545', sand: '#c9b48e', brown: '#6e5f49' };
  const MONO = { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '11px', fontWeight: '600' };
  const lg = (x) => Math.log2(x);
  const fmt = (x) => !isFinite(x) ? '∞' : Math.abs(x) >= 1e6 ? x.toExponential(1) : Number.isInteger(x) ? String(x) : (Math.round(x * 100) / 100).toString();
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
  const relabel = (m, t) => { if (m.userData.lbl) txt(m.userData.lbl, String(t)); };
  const showL = (l, on) => { l.element.style.visibility = on ? '' : 'hidden'; };
  const cls = (l, c) => { l.element.className = 'lab-label' + (c ? ' ' + c : ''); };
  function code(lines, x, yTop, dy = 0.5, z = 0) {
    const w = Math.max(...lines.map((s) => s.length));
    const ls = lines.map((s, i) => { const l = tag(s.padEnd(w, ' '), '', x, yTop - i * dy, z); Object.assign(l.element.style, MONO); return l; });
    return { ls, hl(i) { ls.forEach((l, k) => cls(l, k === i ? 'ptr alt' : '')); }, set(i, s) { txt(ls[i], s.padEnd(w, ' ')); }, kill() { ls.forEach(kill); } };
  }
  async function anim(tok, ms, fn) { const steps = 10; for (let k = 1; k <= steps; k++) { fn(k / steps); await beat(tok, ms / steps); } }
  function bar(color, w, d, x, z) { const m = lab.box(color, [w, 1, d]); m.scale.y = 0.001; m.position.set(x, 0, z); lab.world.add(m); return m; }
  function setBar(m, h, y0 = 0) { const v = Math.max(0.001, Math.abs(h)); m.scale.y = v; m.position.y = y0 + (h < 0 ? -v / 2 : v / 2); }
  function growBar(tok, m, h, ms, y0 = 0) { const h0 = m.scale.y; return anim(tok, ms, (t) => setBar(m, h0 + (h - h0) * t, y0)); }
  function line(x1, y1, x2, y2, z = 0, color = '#c9b48e') {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(x1, y1, z), V3(x2, y2, z)]), new THREE.LineBasicMaterial({ color }));
    lab.world.add(l); return l;
  }
  function ghostBox(color, w, h, d) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false }));
    lab.world.add(m); return m;
  }
  function tube(pts, color, r = 0.04) {
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(8, pts.length * 2), r, 6), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
    lab.world.add(m); return m;
  }
  const parseArr = (s, lo = 2, hi = 16) => {
    const a = String(s).split(/[,\s，]+/).filter(Boolean).map(Number);
    if (a.length < lo || a.length > hi || a.some((v) => !Number.isFinite(v) || Math.abs(v) > 999)) return null;
    return a;
  };

  // ───────────────────────── 互動：Merge sort（bottom-up 2-way） ─────────────────────────
  const msr = { arr: [9, 3, 7, 5, 6, 4, 8, 2], cubes: [], width: 1, start: 0, cmp: 0, pass: 0, busy: false };
  const mx = (i, n) => (i - (n - 1) / 2) * Math.min(1.2, 12 / n);
  function enterMerge() {
    fresh([0, 6, 13.5], [0, 1.6, 0]);
    controls('<label>陣列 <input id="msA" value="' + msr.arr.join(',') + '" style="width:200px"></label><button id="msSet">套用</button><button class="primary" id="msStep">合併下一組</button><button id="msAll">跑完</button><button id="msRand">隨機</button>');
    const reset = (a) => { msr.arr = a; msr.width = 1; msr.start = 0; msr.cmp = 0; msr.pass = 1; drawMerge(); };
    on('msSet', () => { const a = parseArr($('msA').value); if (!a) { log('請輸入 2～16 個數字，用逗號分開（絕對值 ≤ 999）。', true); return; } clearLog(); reset(a); log('每個元素先當成長度 1 的已排序串列，相鄰兩個兩兩合併。'); });
    on('msRand', () => { const n = 8 + Math.floor(Math.random() * 5); const a = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 60)); $('msA').value = a.join(','); clearLog(); reset(a); });
    on('msStep', () => mergeStep());
    on('msAll', async () => { for (let g = 0; g < 40 && msr.width < msr.arr.length; g++) { await mergeStep(); await sleep(250); } });
    reset(msr.arr.slice());
    log('Two-way merge sort（迭代版）：每個 pass 把長度 w 的相鄰串列兩兩合併，w = 1, 2, 4, …');
  }
  function drawMerge() {
    lab.clear();
    const n = msr.arr.length, s = Math.min(1, 11 / n);
    msr.cubes = msr.arr.map((v, i) => cube(v, C.blue, [s, 0.7, s], mx(i, n), 0.35, 0));
    msr.arr.forEach((_, i) => tag('[' + (i + 1) + ']', 'idx', mx(i, n), 0, 0.9));
    msr.runs = [];
    for (let i = 0; i < n; i += msr.width) { const w = Math.min(msr.width, n - i), g = ghostBox(C.green, w * Math.min(1.2, 12 / n), 1, 1.3); g.position.set((mx(i, n) + mx(i + w - 1, n)) / 2, 0.5, 0); }
    mergeState();
  }
  function mergeState() {
    const n = msr.arr.length, done = msr.width >= n;
    setState('Two-way merge sort（n = ' + n + '）', [['pass', done ? '完成' : String(msr.pass)], ['串列長度 w', String(Math.min(msr.width, n))], ['比較次數', String(msr.cmp)], ['pass 數上限', '⌈log₂ ' + n + '⌉ = ' + Math.ceil(lg(n))]],
      done ? '<span class="ok">排好了</span>：每個 pass 搬 n 個、共 ⌈log₂ n⌉ 個 pass → Θ(n log n)' : '綠框 = 目前的已排序串列；按「合併下一組」');
  }
  async function mergeStep() {
    const n = msr.arr.length;
    if (msr.busy) return;
    if (msr.width >= n) { log('已經排好了：只剩一個串列。按「隨機」或換陣列再玩。', true); return; }
    msr.busy = true;
    try {
      const lo = msr.start, mid = Math.min(lo + msr.width, n), hi = Math.min(lo + 2 * msr.width, n);
      if (mid >= hi) { log('最後剩 [' + (lo + 1) + '…' + n + '] 落單，直接留到下一個 pass。'); }
      else {
        const L = msr.arr.slice(lo, mid), R = msr.arr.slice(mid, hi), out = [];
        const cl = msr.cubes.slice(lo, mid), cr = msr.cubes.slice(mid, hi), co = [];
        let i = 0, j = 0;
        while (i < L.length && j < R.length) { msr.cmp++; if (L[i] <= R[j]) { out.push(L[i]); co.push(cl[i++]); } else { out.push(R[j]); co.push(cr[j++]); } }
        while (i < L.length) { out.push(L[i]); co.push(cl[i++]); }
        while (j < R.length) { out.push(R[j]); co.push(cr[j++]); }
        co.forEach((m, q) => { move(m, mx(lo + q, n), 1.6, 1.4); });
        await sleep(450);
        co.forEach((m, q) => { move(m, mx(lo + q, n), 0.35, 0); });
        for (let q = 0; q < out.length; q++) { msr.arr[lo + q] = out[q]; msr.cubes[lo + q] = co[q]; }
        log('pass ' + msr.pass + '：合併 [' + L.join(',') + '] 與 [' + R.join(',') + '] → [' + out.join(',') + ']');
        await sleep(350);
      }
      msr.start = hi;
      if (msr.start >= n) { msr.start = 0; msr.width *= 2; msr.pass++; log(msr.width >= n ? '完成！共 ' + (msr.pass - 1) + ' 個 pass、' + msr.cmp + ' 次比較。' : '── pass ' + (msr.pass - 1) + ' 完成，串列長度變成 ' + msr.width); drawMerge(); if (msr.width >= n) msr.cubes.forEach((m) => tint(m, C.green)); }
      mergeState();
    } finally { msr.busy = false; }
  }

  // ───────────────────────── 互動：Binary search ─────────────────────────
  const BARI = [3, 6, 8, 12, 14, 17, 25, 29, 31, 36, 42, 47, 53, 55, 62];
  const bs = { arr: BARI.slice(), key: 42, l: 1, h: 15, cmp: 0, done: false };
  const bx = (i) => -6.3 + (i - 1) * 0.9;
  function enterBSearch() {
    fresh([0, 6, 13.5], [0, 1.4, 0]);
    controls('<label>key = <input id="bsK" type="number" value="' + bs.key + '"></label><button id="bsGo">重新開始</button><button class="primary" id="bsStep">下一步</button><button id="bsRand">隨機陣列</button><button id="bsBari">影片陣列</button>');
    on('bsGo', () => { const k = Number($('bsK').value); if (!Number.isFinite($('bsK').value === '' ? NaN : k)) { log('key 要是數字。', true); return; } bs.key = k; startBS(); });
    on('bsStep', () => stepBS());
    on('bsRand', () => { const s = new Set(); while (s.size < 15) s.add(1 + Math.floor(Math.random() * 90)); bs.arr = [...s].sort((a, b) => a - b); startBS(); });
    on('bsBari', () => { bs.arr = BARI.slice(); startBS(); });
    startBS();
    log('low、high 圍出範圍，mid = ⌊(low + high)/2⌋；索引從 1 開始（影片寫法）。');
  }
  function startBS() {
    lab.clear();
    Object.assign(bs, { l: 1, h: bs.arr.length, cmp: 0, done: false });
    bs.cubes = bs.arr.map((v, i) => { tag(String(i + 1), 'idx', bx(i + 1), 0, 0.85); return cube(v, C.blue, [0.8, 0.6, 0.8], bx(i + 1), 0.3, 0); });
    bs.lp = tag('low', 'ptr', bx(1), 0, 1.6); bs.hp = tag('high', 'ptr', bx(bs.h), 0, 2.2); bs.mp = tag('mid', 'ptr alt', bx(8), 1.3); showL(bs.mp, false);
    bsState('按「下一步」');
  }
  function bsState(f) { setState('Binary search：key = ' + bs.key, [['low', String(bs.l)], ['high', String(bs.h)], ['比較次數', String(bs.cmp)], ['上限', '⌊log₂ n⌋ + 1 = ' + (Math.floor(lg(bs.arr.length)) + 1)]], f); }
  function stepBS() {
    if (bs.done) { log('這次搜尋已經結束了，按「重新開始」。', true); return; }
    if (bs.l > bs.h) { bs.done = true; log('low = ' + bs.l + ' > high = ' + bs.h + '：範圍空了 → 找不到，return 0。'); bsState('<span class="no">找不到</span>：low 越過 high'); return; }
    const m = Math.floor((bs.l + bs.h) / 2), v = bs.arr[m - 1];
    bs.cmp++; showL(bs.mp, true); move(bs.mp, bx(m), 1.3, 0); bs.cubes.forEach((c) => glow(c, null)); glow(bs.cubes[m - 1], GOLD);
    if (v === bs.key) { bs.done = true; tint(bs.cubes[m - 1], C.green); glow(bs.cubes[m - 1], GREEN); log('mid = ' + m + '：A[' + m + '] = ' + v + ' = key → 找到！共 ' + bs.cmp + ' 次比較。'); bsState('<span class="ok">找到了，位置 ' + m + '</span>'); return; }
    if (bs.key < v) { for (let i = m; i <= bs.h; i++) tint(bs.cubes[i - 1], GRAY); bs.h = m - 1; move(bs.hp, bx(Math.max(bs.h, 0.3)), 0, 2.2); log('mid = ' + m + '：key ' + bs.key + ' < ' + v + ' → high = mid − 1 = ' + bs.h); }
    else { for (let i = bs.l; i <= m; i++) tint(bs.cubes[i - 1], GRAY); bs.l = m + 1; move(bs.lp, bx(Math.min(bs.l, 15.7)), 0, 1.6); log('mid = ' + m + '：key ' + bs.key + ' > ' + v + ' → low = mid + 1 = ' + bs.l); }
    bsState('目前範圍 [' + bs.l + ', ' + bs.h + ']');
  }

  // ───────────────────────── 互動：Quicksort ─────────────────────────
  const qk = { arr: [10, 16, 8, 12, 15, 6, 3, 9, 5], pivot: 'first', stack: [], cmp: 0, depth: 0, maxDepth: 0, busy: false };
  const qx = (i, n) => (i - (n - 1) / 2) * Math.min(1.2, 12 / n);
  function enterQuick() {
    fresh([0, 6, 13.5], [0, 1.6, 0]);
    controls('<label>陣列 <input id="qkA" value="' + qk.arr.join(',') + '" style="width:190px"></label><select id="qkP"><option value="first">pivot = 第一個（影片）</option><option value="last">pivot = 最後一個（CLRS Lomuto）</option><option value="mid">pivot = 中間</option><option value="rand">pivot = 隨機</option></select>'
      + '<button id="qkSet">套用</button><button class="primary" id="qkStep">partition 一次</button><button id="qkAll">跑完</button><button id="qkSorted">已排序輸入</button>');
    $('qkP').value = qk.pivot;
    $('qkP').onchange = (e) => { qk.pivot = e.target.value; resetQ(qk.orig || qk.arr); };
    on('qkSet', () => { const a = parseArr($('qkA').value, 2, 14); if (!a) { log('請輸入 2～14 個數字，用逗號分開。', true); return; } clearLog(); resetQ(a); });
    on('qkSorted', () => { const a = Array.from({ length: 10 }, (_, i) => i + 1); $('qkA').value = a.join(','); clearLog(); resetQ(a); log('已排序的輸入：pivot 取第一個時每次都切在最前面 → worst case。'); });
    on('qkStep', () => quickStep());
    on('qkAll', async () => { for (let g = 0; g < 40 && qk.stack.length; g++) { await quickStep(); await sleep(200); } });
    resetQ(qk.arr.slice());
  }
  function resetQ(a) {
    qk.orig = a.slice(); qk.arr = a.slice(); qk.stack = [[0, a.length - 1, 1]]; qk.cmp = 0; qk.maxDepth = 0; qk.parts = 0;
    lab.clear();
    const n = a.length, s = Math.min(1, 11 / n);
    qk.cubes = a.map((v, i) => cube(v, C.blue, [s * 0.92, 0.7, s * 0.92], qx(i, n), 0.35, 0));
    a.forEach((_, i) => tag(String(i + 1), 'idx', qx(i, n), 0, 0.9));
    qState('按「partition 一次」');
  }
  function qState(f) {
    setState('Quicksort（' + { first: '第一個', last: '最後一個', mid: '中間', rand: '隨機' }[qk.pivot] + '當 pivot）', [['比較次數', String(qk.cmp)], ['partition 次數', String(qk.parts)], ['最深遞迴', String(qk.maxDepth)], ['待處理子陣列', String(qk.stack.length)]], f);
  }
  async function quickStep() {
    if (qk.busy) return;
    if (!qk.stack.length) { log('全部排好了。換一組輸入或按「已排序輸入」看最壞情況。', true); return; }
    qk.busy = true;
    try {
      const [p, r, d] = qk.stack.pop(), n = qk.arr.length;
      qk.maxDepth = Math.max(qk.maxDepth, d);
      if (p >= r) { if (p === r) { tint(qk.cubes[p], C.green); } qState('長度 ≤ 1 的子陣列直接完成'); return; }
      let pi = qk.pivot === 'first' ? p : qk.pivot === 'last' ? r : qk.pivot === 'mid' ? Math.floor((p + r) / 2) : p + Math.floor(Math.random() * (r - p + 1));
      // move chosen pivot to the end, then Lomuto partition (same split as the video's scheme for distinct keys)
      const sw = (i, j) => { [qk.arr[i], qk.arr[j]] = [qk.arr[j], qk.arr[i]]; [qk.cubes[i], qk.cubes[j]] = [qk.cubes[j], qk.cubes[i]]; };
      const x = qk.arr[pi]; glow(qk.cubes[pi], GOLD);
      sw(pi, r);
      let i = p - 1;
      for (let j = p; j < r; j++) { qk.cmp++; if (qk.arr[j] <= x) { i++; sw(i, j); } }
      sw(i + 1, r);
      const q = i + 1;
      qk.parts++;
      for (let k = p; k <= r; k++) move(qk.cubes[k], qx(k, n), k === q ? 1.2 : 0.35, k < q ? -0.5 : k > q ? 0.5 : 0);
      await sleep(500);
      for (let k = p; k <= r; k++) { move(qk.cubes[k], qx(k, n), 0.35, 0); glow(qk.cubes[k], null); }
      tint(qk.cubes[q], C.green);
      log('partition A[' + (p + 1) + '…' + (r + 1) + ']，pivot ' + x + ' → 位置 ' + (q + 1) + '；左 ' + (q - p) + ' 個、右 ' + (r - q) + ' 個（比較 ' + (r - p) + ' 次）', (q - p === 0 || r - q === 0) && r - p > 1);
      qk.stack.push([q + 1, r, d + 1]); qk.stack.push([p, q - 1, d + 1]);
      qState(!qk.stack.some(([a, b]) => a < b) ? '<span class="ok">完成</span>：比較 ' + qk.cmp + ' 次（n log n ≈ ' + Math.round(n * lg(n)) + '、n(n−1)/2 = ' + n * (n - 1) / 2 + '）' : '一邊是空的就是最壞的切法');
      if (!qk.stack.some(([a, b]) => a < b)) { qk.cubes.forEach((m) => tint(m, C.green)); qk.stack = []; }
    } finally { qk.busy = false; }
  }

  // ───────────────────────── 互動：矩陣乘法（一般 vs Strassen） ─────────────────────────
  const mm = { A: [[1, 2], [3, 4]], B: [[5, 6], [7, 8]], k: 3 };
  function enterMatrix() {
    fresh([0, 6, 14], [0, 2.4, 0]);
    const inp = (id, v) => '<input id="' + id + '" type="number" value="' + v + '" style="width:44px">';
    controls('A = [' + inp('a11', mm.A[0][0]) + inp('a12', mm.A[0][1]) + ';' + inp('a21', mm.A[1][0]) + inp('a22', mm.A[1][1]) + '] B = [' + inp('b11', mm.B[0][0]) + inp('b12', mm.B[0][1]) + ';' + inp('b21', mm.B[1][0]) + inp('b22', mm.B[1][1]) + ']'
      + '<button class="primary" id="mmGo">用 Strassen 算</button><label>n = 2^<input id="mmK" type="number" min="1" max="10" value="' + mm.k + '"></label><button id="mmCnt">比乘法次數</button>');
    on('mmGo', () => {
      const ids = ['a11', 'a12', 'a21', 'a22', 'b11', 'b12', 'b21', 'b22'], v = ids.map((i) => Number($(i).value));
      if (v.some((x, q) => !Number.isFinite(x) || $(ids[q]).value === '' || Math.abs(x) > 99)) { log('8 格都要填 −99～99 的數字。', true); return; }
      mm.A = [[v[0], v[1]], [v[2], v[3]]]; mm.B = [[v[4], v[5]], [v[6], v[7]]]; drawMatrix();
    });
    on('mmCnt', () => { const k = Number($('mmK').value); if (!Number.isInteger(k) || k < 1 || k > 10) { log('k 要是 1～10 的整數（n = 2 到 1024）。', true); return; } mm.k = k; drawCounts(); });
    drawMatrix();
  }
  function strassen(A, B) {
    const [a11, a12, a21, a22] = [A[0][0], A[0][1], A[1][0], A[1][1]], [b11, b12, b21, b22] = [B[0][0], B[0][1], B[1][0], B[1][1]];
    const P = (a11 + a22) * (b11 + b22), Q = (a21 + a22) * b11, R = a11 * (b12 - b22), S = a22 * (b21 - b11), T = (a11 + a12) * b22, U = (a21 - a11) * (b11 + b12), V = (a12 - a22) * (b21 + b22);
    return { P, Q, R, S, T, U, V, C: [[P + S - T + V, R + T], [Q + S, P + R - Q + U]] };
  }
  function drawMatrix() {
    lab.clear();
    const s = strassen(mm.A, mm.B);
    const direct = [[mm.A[0][0] * mm.B[0][0] + mm.A[0][1] * mm.B[1][0], mm.A[0][0] * mm.B[0][1] + mm.A[0][1] * mm.B[1][1]], [mm.A[1][0] * mm.B[0][0] + mm.A[1][1] * mm.B[1][0], mm.A[1][0] * mm.B[0][1] + mm.A[1][1] * mm.B[1][1]]];
    const grid = (M, cx, col, nm) => { tag(nm, 'ptr', cx, 1.9); M.forEach((r, i) => r.forEach((v, j) => cube(v, col, [0.9, 0.5, 0.9], cx - 0.5 + j * 1, 0.25, -0.5 + i * 1))); };
    grid(mm.A, -4.6, C.blue, 'A'); grid(mm.B, -1.6, C.purple, 'B'); grid(s.C, 2.6, C.green, 'C = AB');
    tag('×', 'val', -3.1, 0.4); tag('=', 'val', 0.5, 0.4);
    ['P', 'Q', 'R', 'S', 'T', 'U', 'V'].forEach((k, q) => cube(k + '=' + s[k], C.orange, [1.5, 0.45, 0.8], -5.4 + q * 1.8, 0.23, 2.6, 2));
    const ok = s.C.every((r, i) => r.every((v, j) => v === direct[i][j]));
    setState('Strassen 2×2', [['P, Q, R, S', [s.P, s.Q, s.R, s.S].join(', ')], ['T, U, V', [s.T, s.U, s.V].join(', ')], ['C11 = P+S−T+V', String(s.C[0][0])], ['C22 = P+R−Q+U', String(s.C[1][1])]],
      (ok ? '<span class="ok">和一般公式結果相同</span>' : '<span class="no">不相同？</span>') + '：一般 8 次乘法、Strassen 7 次（加減 18 次）');
    log('P..V = ' + ['P', 'Q', 'R', 'S', 'T', 'U', 'V'].map((k) => k + ' ' + s[k]).join('、') + ' → C = [' + s.C[0].join(', ') + '; ' + s.C[1].join(', ') + ']');
  }
  function drawCounts() {
    for (const o of [...lab.world.children]) if (o.userData.cnt) kill(o);
    const k = mm.k, n = Math.pow(2, k), m8 = Math.pow(8, k), m7 = Math.pow(7, k);
    const h8 = 0.2 + lg(m8) * 0.17, h7 = 0.2 + lg(m7) * 0.17;
    const b8 = bar(C.red, 1.2, 1.2, 4.6, -2.4), b7 = bar(C.green, 1.2, 1.2, 6.1, -2.4); setBar(b8, h8); setBar(b7, h7); b8.userData.cnt = b7.userData.cnt = true;
    const l1 = tag('8^' + k, 'idx', 4.6, h8 + 0.3, -2.4), l2 = tag('7^' + k, 'idx', 6.1, h7 + 0.3, -2.4); l1.userData.cnt = l2.userData.cnt = true;
    setState('n = ' + n + ' 的純量乘法次數', [['一般分治 8^k = n³', m8.toLocaleString()], ['Strassen 7^k = n^2.81', m7.toLocaleString()], ['比值', fmt(m8 / m7)]], '高度用對數尺度；n 每翻倍，差距再乘 8/7');
    log('n = ' + n + '：8^' + k + ' = ' + m8.toLocaleString() + ' vs 7^' + k + ' = ' + m7.toLocaleString());
  }

  // ───────────────────────── 互動：Maximum subarray ─────────────────────────
  const CLRS_MS = [13, -3, -25, 20, -3, -16, -23, 18, 20, -7, 12, -5, -22, 15, -4, 7];
  const mxs = { arr: CLRS_MS.slice(), busy: false };
  const sx = (i, n) => (i - (n - 1) / 2) * Math.min(0.78, 12.4 / n);
  function bestSub(a, lo, hi) { let best = -Infinity, bi = lo, bj = lo; for (let i = lo; i <= hi; i++) { let s = 0; for (let j = i; j <= hi; j++) { s += a[j]; if (s > best) { best = s; bi = i; bj = j; } } } return [bi, bj, best]; }
  function enterMaxSub() {
    fresh([0, 5, 14], [0, 2.4, 0]);
    controls('<button id="mxClrs">CLRS 範例</button><button id="mxRand">隨機陣列</button><button class="primary" id="mxGo">分治求解</button>');
    on('mxClrs', () => { mxs.arr = CLRS_MS.slice(); drawMax(); });
    on('mxRand', () => { const n = 10 + Math.floor(Math.random() * 7); mxs.arr = Array.from({ length: n }, () => Math.round((Math.random() - 0.55) * 40)); drawMax(); });
    on('mxGo', () => solveMax());
    drawMax();
    log('分成左右兩半：答案要嘛全在左、全在右，要嘛跨過中點（crossing）。');
  }
  function drawMax() {
    lab.clear();
    const a = mxs.arr, n = a.length, w = Math.min(0.7, 11 / n);
    const base = lab.box(C.brown, [12.6, 0.04, 0.9]); base.position.set(0, 2.6, 0); lab.world.add(base);
    mxs.bars = a.map((v, i) => { const m = bar(v >= 0 ? C.blue : C.red, w, 0.8, sx(i, n), 0); setBar(m, v * 0.09, 2.6); tag(String(v), 'idx', sx(i, n), 2.6 + (v >= 0 ? v * 0.09 + 0.3 : 0.3), 0.6); return m; });
    setState('Maximum subarray（n = ' + n + '）', [['陣列', a.join(', ')]], '按「分治求解」');
  }
  async function solveMax() {
    if (mxs.busy) return;
    mxs.busy = true;
    try {
      const a = mxs.arr, n = a.length, mid = Math.floor((n - 1) / 2);
      const L = bestSub(a, 0, mid), R = bestSub(a, mid + 1, n - 1);
      line(sx(mid, n) + (sx(1, n) - sx(0, n)) / 2, 0.2, sx(mid, n) + (sx(1, n) - sx(0, n)) / 2, 5.2, 0, C.brown);
      for (let i = L[0]; i <= L[1]; i++) glow(mxs.bars[i], GOLD);
      log('左半 A[1…' + (mid + 1) + '] 最大：A[' + (L[0] + 1) + '…' + (L[1] + 1) + '] = ' + L[2]); await sleep(700);
      for (let i = 0; i < n; i++) glow(mxs.bars[i], null);
      for (let i = R[0]; i <= R[1]; i++) glow(mxs.bars[i], GOLD);
      log('右半 A[' + (mid + 2) + '…' + n + '] 最大：A[' + (R[0] + 1) + '…' + (R[1] + 1) + '] = ' + R[2]); await sleep(700);
      for (let i = 0; i < n; i++) glow(mxs.bars[i], null);
      let s = 0, ls = -Infinity, li = mid; for (let i = mid; i >= 0; i--) { s += a[i]; if (s > ls) { ls = s; li = i; } }
      s = 0; let rs = -Infinity, rj = mid + 1; for (let j = mid + 1; j < n; j++) { s += a[j]; if (s > rs) { rs = s; rj = j; } }
      for (let i = li; i <= rj; i++) glow(mxs.bars[i], GREEN);
      log('crossing：從中點往左最多 ' + ls + '（到 ' + (li + 1) + '），往右最多 ' + rs + '（到 ' + (rj + 1) + '）→ ' + (ls + rs));
      const best = Math.max(L[2], R[2], ls + rs), which = best === ls + rs ? 'crossing' : best === L[2] ? '左半' : '右半';
      for (let i = 0; i < n; i++) glow(mxs.bars[i], null);
      const [bi, bj] = which === 'crossing' ? [li, rj] : which === '左半' ? [L[0], L[1]] : [R[0], R[1]];
      for (let i = bi; i <= bj; i++) { glow(mxs.bars[i], GREEN); }
      let k = -Infinity, cur = 0; for (const v of a) { cur = Math.max(v, cur + v); k = Math.max(k, cur); }
      setState('Maximum subarray（n = ' + n + '）', [['左半最大', String(L[2])], ['右半最大', String(R[2])], ['跨中點', String(ls + rs)], ['答案', 'A[' + (bi + 1) + '…' + (bj + 1) + '] = ' + best]],
        '<span class="ok">取三者最大：' + which + '</span><br>T(n) = 2T(n/2) + Θ(n) = Θ(n lg n)；Kadane 一次掃描 Θ(n) 也得到 ' + k);
    } finally { mxs.busy = false; }
  }

  // ───────────────────────── 文字頁：小測驗 ─────────────────────────
  let qs = { score: 0, total: 0 };
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr.slice()[Math.floor(Math.random() * arr.length)];
  function uniq4(ans, pool) { const s = [ans]; for (const p of pool) if (!s.includes(p) && s.length < 4) s.push(p); const extra = ['以上皆非', '無法判斷', '視輸入而定']; while (s.length < 4) s.push(extra.shift()); return s; }
  function genQ() {
    const t = Math.random();
    if (t < 0.16) {
      const set = new Set(); while (set.size < 15) set.add(ri(1, 99)); const a = [...set].sort((x, y) => x - y);
      const hit = Math.random() < 0.75, key = hit ? a[ri(0, 14)] : (() => { let k; do k = ri(1, 99); while (set.has(k)); return k; })();
      let l = 1, h = 15, c = 0, path = [];
      while (l <= h) { const m = (l + h) >> 1; c++; path.push(m); if (a[m - 1] === key) break; if (key < a[m - 1]) h = m - 1; else l = m + 1; }
      return { q: '已排序陣列（索引 1～15）：\n' + a.join(', ') + '\n用 binary search（mid = ⌊(low+high)/2⌋）找 ' + key + '，要比較幾次？', opts: uniq4(String(c), ['1', '2', '3', '4', '5']), ans: String(c), why: '依序比較位置 ' + path.join(' → ') + (hit ? '，找到。' : '，low > high 結束，找不到。') + '最多 ⌊log₂15⌋ + 1 = 4 次。' };
    }
    if (t < 0.3) {
      const all = Array.from({ length: 30 }, (_, i) => i + 1).map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]).slice(0, 8);
      const A = all.slice(0, 4).sort((x, y) => x - y), B = all.slice(4).sort((x, y) => x - y);
      let i = 0, j = 0, c = 0; while (i < 4 && j < 4) { c++; if (A[i] < B[j]) i++; else j++; }
      return { q: '合併 A = [' + A.join(', ') + '] 與 B = [' + B.join(', ') + ']，while 迴圈中做了幾次比較？', opts: uniq4(String(c), ['4', '5', '6', '7', '8']), ans: String(c), why: '每次比較搬一個元素；一邊用完後剩下的直接複製，不再比較。最多 m + n − 1 = 7 次、最少 min(m, n) = 4 次。' };
    }
    if (t < 0.42) {
      const R = [['Binary search', 'T(n) = T(n/2) + 1', 'Θ(log n)'], ['Merge sort', 'T(n) = 2T(n/2) + n', 'Θ(n log n)'], ['Strassen', 'T(n) = 7T(n/2) + n²', 'Θ(n^2.81)'], ['分治矩陣乘法', 'T(n) = 8T(n/2) + n²', 'Θ(n³)'], ['Karatsuba', 'T(n) = 3T(n/2) + n', 'Θ(n^1.58)'], ['Quicksort 最壞', 'T(n) = T(n−1) + n', 'Θ(n²)'], ['分治找最大最小', 'T(n) = 2T(n/2) + 2', 'Θ(n)']];
      const r = pick(R), byRec = Math.random() < 0.5;
      return byRec ? { q: r[0] + ' 的遞迴式是？', opts: uniq4(r[1], R.map((x) => x[1]).map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1])), ans: r[1], why: r[0] + '：' + r[1] + ' → ' + r[2] + '。' }
        : { q: r[1] + ' 的解是？（' + r[0] + '）', opts: uniq4(r[2], R.map((x) => x[2]).map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1])), ans: r[2], why: r[0] + '：' + r[1] + ' → ' + r[2] + '。' };
    }
    if (t < 0.52) {
      const n = ri(5, 200), p = Math.ceil(lg(n));
      return { q: 'Two-way merge sort 排 ' + n + ' 個元素需要幾個 pass？', opts: uniq4(String(p), [String(p + 1), String(p - 1), String(Math.floor(n / 2)), String(Math.round(Math.sqrt(n)))]), ans: String(p), why: '每個 pass 串列長度加倍：⌈log₂ ' + n + '⌉ = ' + p + '。' };
    }
    if (t < 0.64) {
      const n = 5 + ri(0, 3), a = Array.from({ length: n }, () => ri(1, 40));
      const b = a.slice(), x = b[n - 1]; let i = -1; for (let j = 0; j < n - 1; j++) if (b[j] <= x) { i++; [b[i], b[j]] = [b[j], b[i]]; } [b[i + 1], b[n - 1]] = [b[n - 1], b[i + 1]];
      const q = i + 2;
      return { q: 'CLRS PARTITION（pivot = 最後一個）對 [' + a.join(', ') + '] 做一次，pivot ' + x + ' 最後落在第幾個位置（從 1 數）？', opts: uniq4(String(q), Array.from({ length: n }, (_, k) => String(k + 1)).map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1])), ans: String(q), why: '≤ ' + x + ' 的有 ' + (q - 1) + ' 個，pivot 放在它們後面：[' + b.join(', ') + ']。' };
    }
    if (t < 0.74) {
      const k = ri(2, 6);
      return { q: 'n = 2^' + k + ' = ' + Math.pow(2, k) + ' 時，Strassen 一路遞迴到 1×1 共做幾次純量乘法？', opts: uniq4(String(Math.pow(7, k)), [String(Math.pow(8, k)), String(7 * k), String(Math.pow(2, 3 * k) - 1), String(Math.pow(7, k - 1))]), ans: String(Math.pow(7, k)), why: '每層 7 個子問題，k 層 → 7^k = n^(log₂7)；一般分治是 8^k = n³。' };
    }
    if (t < 0.86) {
      const n = 8, a = Array.from({ length: n }, () => ri(-15, 15)); if (a.every((v) => v < 0)) a[ri(0, 7)] = ri(1, 9);
      const [, , best] = bestSub(a, 0, n - 1);
      return { q: '[' + a.join(', ') + '] 的 maximum subarray 總和是？', opts: uniq4(String(best), [String(best + ri(1, 5)), String(Math.max(...a)), String(a.reduce((x, y) => x + y, 0)), String(best - ri(1, 5))]), ans: String(best), why: '分左右兩半與跨中點三種取最大（或用 Kadane 掃一次）：' + best + '。' };
    }
    const Q = pick([
      ['Quicksort 選第一個元素當 pivot，輸入已排序時的時間？', 'Θ(n²)', ['Θ(n log n)', 'Θ(n)', 'Θ(log n)'], '每次只切掉 pivot：n + (n−1) + … + 1。'],
      ['Merge sort 的額外空間？', 'Θ(n)', ['Θ(1)', 'Θ(log n)', 'Θ(n²)'], 'merge 要用另一個陣列。'],
      ['Quicksort 的 stack 深度範圍？', 'log n ～ n', ['1 ～ log n', 'n ～ n²', '固定 n'], '= 遞迴樹高度。'],
      ['Median of medians 選擇演算法的最壞時間？', 'Θ(n)', ['Θ(n log n)', 'Θ(n²)', 'Θ(log n)'], 'T(n) ≤ T(n/5) + T(7n/10 + 6) + O(n)，1/5 + 7/10 < 1 → O(n)。'],
      ['分治找 n 個數的最大和最小值（n 為 2 的次方）要比較幾次？', '3n/2 − 2', ['2n − 2', 'n − 1', 'n log n'], 'T(n) = 2T(n/2) + 2、T(2) = 1。'],
      ['兩個已排序、長 L₁、L₂ 的向量做內積，最佳方法？', 'O(L₁ + L₂)（兩指標）', ['O(L₁ log L₂)', 'O(L₁ L₂)', 'O(log L₁ + log L₂)'], '跟 merge 一樣，兩個指標只往前走。'],
    ]);
    return { q: Q[0], opts: [Q[1], ...Q[2]], ans: Q[1], why: Q[3] };
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

  // ─── 2Rr2tW9zvRg：Divide → Conquer → Combine ───
  async function scDCGeneral(tok) {
    fresh([0, 5.5, 14.5], [0, 3, 0]);
    const cd = code(['DAC(P) {', '  if (small(P))', '    return S(P);', '  divide P into P1 … Pk;', '  apply DAC to each Pi;', '  return combine(DAC(P1), …, DAC(Pk));', '}'], -4.3, 7.2, 0.46);
    say('問題 P 太大：切成 k 個子問題', 'Divide');
    cd.hl(3);
    const P = cube('P（n）', C.blue, [4.2, 0.7, 1.2], 2, 6, 0, 2);
    await beat(tok, 1800);
    kill(P);
    const subs = [0, 1, 2].map((i) => cube('P' + (i + 1), C.blue, [1.4, 0.6, 1.1], 0.2 + i * 1.8, 4.4, 0, 1.5));
    [0, 1, 2].forEach((i) => line(2, 5.7, 0.2 + i * 1.8, 4.75));
    await beat(tok, 1600);
    cd.hl(4);
    say('子問題還太大？對它再 divide and conquer', 'P3 → P31、P32');
    kill(subs[2]);
    const s3 = [0, 1].map((i) => cube('P3' + (i + 1), C.purple, [0.8, 0.5, 1], 3.2 + i * 1.2, 2.9, 0, 1.5));
    [0, 1].forEach((i) => line(3.8, 4.1, 3.2 + i * 1.2, 3.2));
    await beat(tok, 1800);
    cd.hl(1);
    say('夠小了就直接解', 'small(P) → S(P)');
    [subs[0], subs[1], ...s3].forEach((m) => { tint(m, C.green); relabel(m, m.userData.lbl.element.textContent.replace('P', 'S')); });
    await beat(tok, 2000);
    cd.hl(5);
    say('把子問題的解 combine 成原問題的解', 'Combine');
    s3.forEach((m) => move(m, 3.8, 4.4, 0)); await beat(tok, 700); s3.forEach(kill);
    const s3m = cube('S3', C.green, [1.4, 0.6, 1.1], 3.8, 4.4, 0);
    await beat(tok, 900);
    [subs[0], subs[1], s3m].forEach((m) => move(m, 2, 6, 0)); await beat(tok, 800);
    [subs[0], subs[1], s3m].forEach(kill);
    cube('S（原問題的解）', C.green, [4.2, 0.7, 1.2], 2, 6, 0);
    await beat(tok, 1600);
    cd.hl(-1);
    say('Divide → Conquer（遞迴）→ Combine', '本單元：binary search、max-min、merge sort、quicksort、Strassen');
    await beat(tok, 3200);
  }

  // ─── 2Rr2tW9zvRg：子問題必須是同一種問題 ───
  async function scDCSameKind(tok) {
    fresh([0, 5, 14], [0, 2.6, 0]);
    say('左：排序 8 個數；右：辦一場研討會', '兩個都「拆成小問題」——哪個是 divide and conquer？');
    const L = cube('sort 8 個數', C.blue, [3.4, 0.7, 1.2], -3.4, 5.6, 0, 2), R = cube('辦研討會', C.orange, [3.4, 0.7, 1.2], 3.4, 5.6, 0, 2);
    await beat(tok, 2400);
    const l2 = [0, 1].map((i) => cube('sort 4 個數', C.blue, [1.8, 0.6, 1.1], -4.4 + i * 2, 4, 0, 1.5));
    const l3 = [0, 1, 2, 3].map((i) => cube('sort 2', C.blue, [0.9, 0.5, 1], -4.9 + i * 1, 2.6, 0, 1.5));
    say('排序拆出來還是排序：同一種問題', '可以遞迴套用同一個演算法 ✓');
    await beat(tok, 2600);
    const rs = ['邀請函', '海報', '邀講者'].map((nm, i) => cube(nm, [C.pink, C.teal, C.gold][i], [1.5, 0.6, 1.1], 1.8 + i * 1.6, 4, 0, 1.5));
    say('研討會拆成邀請函、海報、邀講者', '每一塊都是不同的工作 ✗');
    await beat(tok, 2400);
    rs.forEach((m) => glow(m, RED)); tag('不是 divide and conquer', 'ptr alt', 3.4, 2.6);
    await beat(tok, 2000);
    say('還要能把子問題的解 combine 回去', '排好的兩半 → merge；沒有合併方法就不能用');
    [...l3].forEach((m) => tint(m, C.green)); await beat(tok, 900); l2.forEach((m) => tint(m, C.green)); await beat(tok, 900); tint(L, C.green); glow(L, GREEN);
    await beat(tok, 2600);
  }

  // ─── 課本補充：分治找最大與最小值 3n/2 − 2 ───
  async function scMaxMin(tok) {
    fresh([0, 5.5, 14], [0, 2.8, 0]);
    const A = [22, 13, -5, -8, 15, 60, 17, 31];
    const xs = (i) => -5.25 + i * 1.5;
    A.forEach((v, i) => cube(v, C.blue, [1, 0.6, 0.9], xs(i), 0.3, 0));
    const cnt = tag('比較 0 次', 'ptr alt', 0, 7.2);
    let c = 0;
    say('同時找最大值與最小值：逐一掃描要 2(n − 1) = 14 次', '分治：兩兩一組，再合併');
    await beat(tok, 2600);
    let lvl = [];
    for (let i = 0; i < 8; i += 2) {
      c++; const mxv = Math.max(A[i], A[i + 1]), mnv = Math.min(A[i], A[i + 1]);
      lvl.push({ x: (xs(i) + xs(i + 1)) / 2, mx: mxv, mn: mnv });
      cube(mxv + ' / ' + mnv, C.purple, [1.9, 0.5, 0.9], (xs(i) + xs(i + 1)) / 2, 2.1, 0, 1.5);
      txt(cnt, '比較 ' + c + ' 次'); say('兩個元素：比 1 次就知道 max / min', A[i] + ' vs ' + A[i + 1]);
      await beat(tok, 900);
    }
    let y = 3.9;
    while (lvl.length > 1) {
      const nx = [];
      for (let i = 0; i < lvl.length; i += 2) {
        const a = lvl[i], b = lvl[i + 1]; c += 2;
        const o = { x: (a.x + b.x) / 2, mx: Math.max(a.mx, b.mx), mn: Math.min(a.mn, b.mn) };
        nx.push(o); cube(o.mx + ' / ' + o.mn, nx.length === 1 && lvl.length === 2 ? C.green : C.purple, [2.2, 0.5, 0.9], o.x, y, 0, 1.5);
        txt(cnt, '比較 ' + c + ' 次'); say('合併：max 比 max、min 比 min → 2 次', a.mx + ' vs ' + b.mx + '、' + a.mn + ' vs ' + b.mn);
        await beat(tok, 1300);
      }
      lvl = nx; y += 1.8;
    }
    say('max = 60、min = −8：共 10 次 = 3n/2 − 2', 'T(n) = 2T(n/2) + 2、T(2) = 1');
    await beat(tok, 3400);
  }

  // ─── C2apEw9pgtw：binary search 追蹤（42、12、30） ───
  async function bsTrace(tok, key, intro) {
    fresh([0, 6, 13.5], [0, 1.4, 0]);
    const A = BARI;
    const cs = A.map((v, i) => { tag(String(i + 1), 'idx', bx(i + 1), 0, 0.85); return cube(v, C.blue, [0.8, 0.6, 0.8], bx(i + 1), 0.3, 0); });
    const cd = code(['while (l <= h) {', '  mid = (l + h) / 2;', '  if (key == A[mid]) return mid;', '  if (key < A[mid]) h = mid − 1;', '  else l = mid + 1;', '}', 'return 0;'], 3.2, 6.6, 0.45);
    const lp = tag('low', 'ptr', bx(1), 0, 1.6), hp = tag('high', 'ptr', bx(15), 0, 2.2), mp = tag('mid', 'ptr alt', bx(8), 1.3);
    showL(mp, false);
    if (intro) { say('已排序的 15 個元素，索引 1～15', '前提：一定要先排序'); await beat(tok, 2400); }
    say('找 key = ' + key, 'low = 1、high = 15');
    await beat(tok, 1600);
    let l = 1, h = 15, c = 0;
    while (true) {
      if (l > h) { cd.hl(6); say('low = ' + l + ' > high = ' + h + '：越過了 → 找不到', 'return 0'); await beat(tok, 2600); break; }
      const m = (l + h) >> 1; c++;
      cd.hl(1); showL(mp, true); move(mp, bx(m), 1.3, 0); glow(cs[m - 1], GOLD);
      say('mid = ⌊(' + l + ' + ' + h + ')/2⌋ = ' + m + '，A[' + m + '] = ' + A[m - 1], '第 ' + c + ' 次比較');
      await beat(tok, 1500);
      if (A[m - 1] === key) { cd.hl(2); tint(cs[m - 1], C.green); glow(cs[m - 1], GREEN); say('找到了！' + c + ' 次比較', key === 42 ? 'linear search 要 11 次' : 'return ' + m); await beat(tok, 2600); break; }
      if (key < A[m - 1]) { cd.hl(3); for (let i = m; i <= h; i++) { tint(cs[i - 1], GRAY); glow(cs[i - 1], null); } h = m - 1; move(hp, bx(Math.max(h, 0.4)), 0, 2.2); say(key + ' < ' + A[m - 1] + '：往左找', 'high = mid − 1 = ' + h); }
      else { cd.hl(4); for (let i = l; i <= m; i++) { tint(cs[i - 1], GRAY); glow(cs[i - 1], null); } l = m + 1; move(lp, bx(Math.min(l, 15.6)), 0, 1.6); say(key + ' > ' + A[m - 1] + '：往右找', 'low = mid + 1 = ' + l); }
      await beat(tok, 1500);
    }
  }
  async function scBSearchTrace(tok) {
    const k = (ctx.params || {}).key;
    if (k !== undefined) { await bsTrace(tok, k, true); return; }
    await bsTrace(tok, 42, true);
    await bsTrace(tok, 30, false);
  }

  // ─── C2apEw9pgtw：比較樹 ───
  async function scBSearchTree(tok) {
    fresh([0, 5, 14.5], [0, 3.2, 0]);
    const A = BARI, nodes = {};
    const place = (l, h, d, x0, x1, par) => { if (l > h) return; const m = (l + h) >> 1; nodes[m] = { d, x: (x0 + x1) / 2, y: 6.4 - d * 1.6, par }; place(l, m - 1, d + 1, x0, (x0 + x1) / 2, m); place(m + 1, h, d + 1, (x0 + x1) / 2, x1, m); };
    place(1, 15, 0, -6.2, 5.6, 0);
    say('把每次可能比較的 mid 畫成一棵樹', '1～15 的 mid 永遠是 8');
    const ms = {};
    for (let d = 0; d < 4; d++) {
      for (const [m, nd] of Object.entries(nodes)) if (nd.d === d) {
        ms[m] = cube(m + ':' + A[m - 1], d === 3 ? C.purple : C.blue, [0.78, 0.5, 0.7], nd.x, nd.y, 0, 1.5);
        if (nd.par) line(nodes[nd.par].x, nodes[nd.par].y - 0.3, nd.x, nd.y + 0.3);
      }
      tag('第 ' + (d + 1) + ' 次比較', 'ptr alt', 0, 0, 0).position.set(6.6, 6.4 - d * 1.6, 0);
      say(d === 0 ? '第 1 層：8' : d === 1 ? '第 2 層：4、12' : d === 2 ? '第 3 層：2、6、10、14' : '葉子：1、3、5、…、15', '');
      await beat(tok, 1300);
    }
    const path = async (keys, label, col) => { for (const m of keys) { glow(ms[m], col); await beat(tok, 700); } say(label[0], label[1]); await beat(tok, 2000); keys.forEach((m) => glow(ms[m], null)); };
    await path([8], ['找 29：在根，1 次', 'best case O(1)'], GREEN);
    await path([8, 12, 14], ['找 55：8 → 12 → 14，3 次', ''], GOLD);
    await path([8, 12, 14, 15], ['找 65（不存在）：走到 15 的右邊外部節點，4 次', '找不到也最多 4 次'], RED);
    say('最多比較次數 = 樹高 = ⌊log₂ n⌋ + 1', 'best O(1)、worst O(log n)、average O(log n)');
    await beat(tok, 3200);
  }

  // ─── 6pV2IF0fgKY：merging A = [2,8,15,18]、B = [5,9,12,17] ───
  async function scMergeTwo(tok) {
    fresh([0, 6, 14], [0, 2.2, 0]);
    const A = [2, 8, 15, 18], B = [5, 9, 12, 17];
    const ax = (i) => -5.2 + i * 1.1, bx2 = (i) => -5.2 + i * 1.1, cx = (k) => -1.2 + k * 0.95;
    const ca = A.map((v, i) => cube(v, C.blue, [0.9, 0.6, 0.9], ax(i), 0.3, -1.6));
    const cb = B.map((v, i) => cube(v, C.purple, [0.9, 0.6, 0.9], bx2(i), 0.3, 1.6));
    tag('A', 'ptr', -6.4, 0.3, -1.6); tag('B', 'ptr', -6.4, 0.3, 1.6); tag('C', 'ptr alt', -1.2, 2.7, 0);
    for (let k = 0; k < 8; k++) ctx.tile(V3(cx(k), 0.04, 0), 0.85, 0.85);
    const cd = code(['while (i <= m && j <= n)', '  if (A[i] < B[j]) C[k++] = A[i++];', '  else            C[k++] = B[j++];', 'for (; i <= m; i++) C[k++] = A[i];', 'for (; j <= n; j++) C[k++] = B[j];'], 2.4, 7, 0.46);
    const ip = tag('i', 'ptr', ax(0), 1.1, -1.6), jp = tag('j', 'ptr', bx2(0), 1.1, 1.6), kp = tag('k', 'ptr alt', cx(0), 1.1, 0);
    say('Merging：兩個已排序串列合成一個', 'i、j、k 各指向 A、B、C 的開頭');
    await beat(tok, 2400);
    let i = 0, j = 0, k = 0;
    while (i < 4 && j < 4) {
      glow(ca[i], GOLD); glow(cb[j], GOLD); cd.hl(A[i] < B[j] ? 1 : 2);
      say('比 A[i] = ' + A[i] + ' 與 B[j] = ' + B[j], '小的複製到 C[k]');
      await beat(tok, 1100);
      glow(ca[i], null); glow(cb[j], null);
      if (A[i] < B[j]) { move(ca[i], cx(k), 0.3, 0); i++; move(ip, ax(i), 1.1, -1.6); }
      else { move(cb[j], cx(k), 0.3, 0); j++; move(jp, bx2(j), 1.1, 1.6); }
      k++; move(kp, cx(k), 1.1, 0);
      await beat(tok, 600);
    }
    cd.hl(i < 4 ? 3 : 4);
    say('B 用完了：A 剩下的 18 直接複製', '一邊用完，另一邊整段搬過去');
    while (i < 4) { move(ca[i], cx(k), 0.3, 0); i++; k++; move(kp, cx(k), 1.1, 0); await beat(tok, 700); }
    while (j < 4) { move(cb[j], cx(k), 0.3, 0); j++; k++; await beat(tok, 700); }
    cd.hl(-1);
    say('每個元素只搬一次：Θ(m + n)', '兩個串列已排序 → 結果也已排序');
    await beat(tok, 3200);
  }

  // ─── 6pV2IF0fgKY：4-way merging ───
  async function scMergeFour(tok) {
    fresh([0, 6.5, 13.5], [0, 1.6, 0]);
    const Ls = [[3, 4, 6], [5, 9, 12], [8, 10, 16], [2, 4, 18]], cols = [C.blue, C.purple, C.teal, C.orange];
    const lx = (q) => -5.4 + q * 1.4;
    const ms = Ls.map((L, q) => L.map((v, r) => cube(v, cols[q], [0.9, 0.5, 0.9], lx(q), 0.25, -2.2 + r * 1.1)));
    Ls.forEach((_, q) => tag('L' + (q + 1), 'ptr', lx(q), 0.3, -3.2));
    const ox = (k) => 0.4 + (k % 6) * 1.05, oz = (k) => k < 6 ? -1.2 : 0.2;
    tag('輸出', 'ptr alt', 3, 0.3, -2.2);
    const head = [0, 0, 0, 0];
    say('4 個已排序串列：一次比較 4 個開頭', '4-way merging');
    await beat(tok, 2200);
    for (let k = 0; k < 12; k++) {
      let best = -1;
      for (let q = 0; q < 4; q++) if (head[q] < 3) { glow(ms[q][head[q]], GOLD); if (best < 0 || Ls[q][head[q]] < Ls[best][head[best]]) best = q; }
      const v = Ls[best][head[best]];
      if (k < 4) { say('開頭：' + [0, 1, 2, 3].filter((q) => head[q] < 3).map((q) => Ls[q][head[q]]).join('、') + ' → 最小 ' + v, k === 2 ? '兩個 4 一樣：先拿第一個' : ''); await beat(tok, 1300); }
      else await beat(tok, 450);
      for (let q = 0; q < 4; q++) if (head[q] < 3) glow(ms[q][head[q]], null);
      move(ms[best][head[best]], ox(k), 0.25, oz(k)); head[best]++;
      await beat(tok, 300);
    }
    say('同時合併 m 個串列 = m-way merging', '每拿一個都要比 m 個開頭');
    await beat(tok, 3000);
  }

  // ─── 6pV2IF0fgKY：2-way merging 的合併模式 ───
  async function scMergePatterns(tok) {
    fresh([0, 5.5, 14], [0, 2.6, 0]);
    const Ls = [[3, 4, 6], [5, 9, 12], [8, 10, 16], [2, 4, 18]];
    const run = async (pairs, x0, title) => {
      tag(title, 'ptr', x0, 7.2);
      const items = Ls.map((L, q) => ({ v: L.slice(), x: x0 - 2.4 + q * 1.6, y: 0.3, m: cube(L.join(','), C.blue, [1.4, 0.5, 0.9], x0 - 2.4 + q * 1.6, 0.25, 0, 2) }));
      let moved = 0;
      for (const [a, b] of pairs) {
        const A = items[a], B = items[b];
        const v = [...A.v, ...B.v].sort((p, q) => p - q), x = (A.x + B.x) / 2, y = Math.max(A.y, B.y) + 1.7;
        line(A.x, A.y + 0.3, x, y - 0.3); line(B.x, B.y + 0.3, x, y - 0.3);
        moved += v.length;
        const m = cube(v.join(','), v.length === 12 ? C.green : C.purple, [Math.min(4.6, 0.36 * v.length + 0.4), 0.5, 0.9], x, y, 0, 1.5);
        items.push({ v, x, y, m });
        say(title + '：合併 ' + A.v.length + ' + ' + B.v.length + ' 個', '目前共搬了 ' + moved + ' 個元素');
        await beat(tok, 1700);
      }
      return moved;
    };
    say('2-way merging：一次只合併兩個串列', '4 個串列要 merge 3 次');
    await beat(tok, 2000);
    const m1 = await run([[0, 1], [2, 3], [4, 5]], -3.4, '兩兩配對');
    const m2 = await run([[0, 1], [4, 2], [5, 3]], 3.4, '一個接一個');
    say('同樣 3 次 merge，模式不同：搬動 ' + m1 + ' vs ' + m2 + ' 個', '合併模式有很多種');
    await beat(tok, 3200);
  }

  // ─── 6pV2IF0fgKY：two-way merge sort [9,3,7,5,6,4,8,2] ───
  async function scTwoWayMS(tok) {
    fresh([0, 6, 14], [0, 2.4, 0]);
    let a = [9, 3, 7, 5, 6, 4, 8, 2];
    const X = (i) => -4.9 + i * 1.4;
    let ms = a.map((v, i) => cube(v, C.blue, [1, 0.6, 1], X(i), 0.3, -1.2));
    tag('A', 'ptr', -6.5, 0.3, -1.2); tag('B', 'ptr alt', -6.5, 0.3, 1.6);
    for (let i = 0; i < 8; i++) ctx.tile(V3(X(i), 0.04, 1.6), 1, 1);
    const pc = tag('pass 0', 'ptr alt', 0, 4.6);
    say('把 8 個元素各看成一個長度 1 的已排序串列', '兩兩合併：two-way merge sort（迭代版）');
    await beat(tok, 2600);
    const groups = [];
    for (let w = 1, pass = 1; w < 8; w *= 2, pass++) {
      txt(pc, 'pass ' + pass + '：串列長度 ' + w + ' → ' + 2 * w);
      const nb = [], na = [];
      for (let lo = 0; lo < 8; lo += 2 * w) {
        const L = a.slice(lo, lo + w).map((v, q) => ({ v, m: ms[lo + q] })), R = a.slice(lo + w, lo + 2 * w).map((v, q) => ({ v, m: ms[lo + w + q] }));
        const out = [...L, ...R].sort((p, q) => p.v - q.v);
        out.forEach((o, q) => { move(o.m, X(lo + q), 0.3, 1.6); nb.push(o); });
        say('pass ' + pass + '：相鄰兩個串列合併', '[' + L.map((o) => o.v).join(',') + '] + [' + R.map((o) => o.v).join(',') + '] → [' + out.map((o) => o.v).join(',') + ']；結果先放到另一個陣列 B');
        await beat(tok, pass === 1 ? 900 : 1600);
      }
      say('pass ' + pass + ' 完成：把 B 複製回 A', '每個 pass 搬動全部 n 個元素');
      await beat(tok, 900);
      nb.forEach((o, q) => move(o.m, X(q), 0.3, -1.2));
      a = nb.map((o) => o.v); ms = nb.map((o) => o.m);
      groups.forEach(kill); groups.length = 0;
      for (let lo = 0; lo < 8; lo += 2 * w) { const g = ghostBox(C.green, 2 * w * 1.4 - 0.2, 0.9, 1.3); g.position.set((X(lo) + X(lo + 2 * w - 1)) / 2, 0.45, -1.2); groups.push(g); }
      await beat(tok, 1300);
    }
    ms.forEach((m) => tint(m, C.green));
    say('8 → 4 → 2 → 1 個串列：3 個 pass = log₂ 8', '每個 pass n 個 × log n 個 pass → Θ(n log n)');
    await beat(tok, 3400);
  }

  // ─── 課本補充（CLRS 2.3）：MERGE-SORT 由上而下的遞迴 ───
  async function scMergeTopDown(tok) {
    fresh([0, 5, 15], [0, 3.2, 0]);
    const A = [5, 2, 4, 7, 1, 3, 2, 6];
    const X = (i) => -5.25 + i * 1.5;
    tag('MERGE-SORT(A, p, r)：q = ⌊(p + r)/2⌋，排左、排右、MERGE', 'ptr', 0, 7.6);
    const levelY = [6.4, 4.8, 3.2, 1.6, 0.3];
    say('CLRS 的遞迴版：先一路切到長度 1', 'A = [5, 2, 4, 7, 1, 3, 2, 6]');
    const segs = [[A.slice()]], split = [[], [], [], []];
    for (let d = 0; d <= 3; d++) {
      const parts = []; for (const s of segs[d]) { if (s.length === 1) { parts.push(s); continue; } parts.push(s.slice(0, s.length / 2), s.slice(s.length / 2)); }
      segs.push(parts);
      let i0 = 0;
      for (const s of segs[d]) { const w = s.length * 1.5 - 0.3; split[d].push(cube(s.join(' '), C.blue, [w, 0.45, 0.8], X(i0) + (s.length - 1) * 0.75, levelY[d], 0, 1.2)); i0 += s.length; }
      await beat(tok, 900);
    }
    say('長度 1 已經排好；開始往上 MERGE', '');
    await beat(tok, 1500);
    let cur = A.map((v) => [v]);
    for (let d = 0; d < 3; d++) {
      const nx = []; for (let i = 0; i < cur.length; i += 2) nx.push([...cur[i], ...cur[i + 1]].sort((p, q) => p - q));
      let i0 = 0;
      split[2 - d].forEach(kill); // the merged run takes the place of the unsorted run it came from
      for (const s of nx) { const w = s.length * 1.5 - 0.3; const m = cube(s.join(' '), C.green, [w, 0.45, 0.8], X(i0) + (s.length - 1) * 0.75, levelY[2 - d], 0, 1.2); i0 += s.length; }
      say('第 ' + (d + 1) + ' 輪 MERGE：' + nx.map((s) => '[' + s.join(',') + ']').join(' '), '每一層 merge 的總成本 Θ(n)');
      cur = nx;
      await beat(tok, 1800);
    }
    say('T(n) = 2T(n/2) + Θ(n)', 'lg n 層 × 每層 cn → Θ(n lg n)，不分 best / worst');
    await beat(tok, 3400);
  }

  // ─── 4iXLnF3hExw：count_frequency 逐行成本 ───
  async function scCountFreq(tok) {
    fresh([0, 5.5, 14.5], [0, 3, 0]);
    const cd = code(['def count_frequency(word_list):', '    L = []', '    for new_word in word_list:', '        for entry in L:', '            if new_word == entry[0]:', '                entry[1] = entry[1] + 1', '                break', '        else:', '            L.append([new_word, 1])', '    return L'], -2.2, 7.4, 0.42);
    const costs = ['', '1 × 1', '1 × W', '1 × L·W', 'w̄ × L·W', '1 × (W − L)', '1 × (W − L)', '1 × L', '1 × L', '1 × 1'];
    const cl = costs.map((c, i) => tag('', 'ptr alt', 3.6, 7.4 - i * 0.42));
    const W = ['the', 'fox', 'is', 'in', 'the', 'hat'];
    const wm = W.map((w, i) => cube(w, C.blue, [0.95, 0.45, 0.8], -5.6 + i * 1.05, 0.23, 2.6));
    const Lm = [];
    const cmpL = tag('字串比較 0 次', 'ptr', 3.6, 2.4);
    let cmp = 0;
    say('把字串列變成 [字, 次數] 的串列', 'the fox is in the hat');
    await beat(tok, 2200);
    for (let i = 0; i < W.length; i++) {
      cd.hl(2); glow(wm[i], GOLD);
      let found = -1;
      for (let e = 0; e < Lm.length; e++) {
        cd.hl(4); glow(Lm[e].m, GOLD); cmp++; txt(cmpL, '字串比較 ' + cmp + ' 次');
        await beat(tok, 260);
        glow(Lm[e].m, null);
        if (Lm[e].w === W[i]) { found = e; break; }
      }
      if (found >= 0) { cd.hl(5); Lm[found].c++; relabel(Lm[found].m, Lm[found].w + ':' + Lm[found].c); glow(Lm[found].m, GREEN); say('"' + W[i] + '" 出現過：次數 +1、break', '重複字才會執行 → W − L 次'); }
      else { cd.hl(8); Lm.push({ w: W[i], c: 1, m: cube(W[i] + ':1', C.green, [1.1, 0.45, 0.8], -5.6 + Lm.length * 1.2, 0.23, 0.6, 2) }); say('"' + W[i] + '" 是新字：append [' + W[i] + ', 1]', '新字才會執行 → L 次'); }
      await beat(tok, 1100); glow(wm[i], null); if (found >= 0) glow(Lm[found].m, null);
    }
    cd.hl(-1);
    say('每行：一次的成本 × 執行次數', 'W = 字數、L = 不重複字數、w̄ = 字長');
    for (let i = 0; i < costs.length; i++) { txt(cl[i], costs[i]); await beat(tok, 300); }
    await beat(tok, 1200);
    cd.hl(4); cls(cl[4], 'ptr');
    say('字串比較不是 O(1)：要逐字元比 → w̄', '這行主導：O(W · L · w̄)');
    await beat(tok, 3200);
    say('W − L 是緊的界；說「最多 W 次」也行', '漸近分析用鬆一點的上界，答案一樣');
    await beat(tok, 3000);
  }

  // ─── 4iXLnF3hExw：+ 改成 extend ───
  async function scPlusExtend(tok) {
    fresh([0, 5, 14.5], [0, 2.6, 0]);
    const Z = 8, K = 3;
    code(['word_list = word_list + words_in_line   # 每次複製整個串列', 'word_list.extend(words_in_line)         # 只搬新來的 K 個'], 0, 7.2, 0.5);
    tag('+', 'ptr', -6.6, 0.3, -1.4); tag('extend', 'ptr alt', -6.6, 0.3, 1.4);
    const t1 = tag('', 'ptr', 4.8, 5.4, -1.4), t2 = tag('', 'ptr alt', 4.8, 2, 1.4);
    say('Profiler：看 total time（函數本身），找出瓶頸', 'get_words_from_line_list 的 +');
    await beat(tok, 2600);
    let s1 = 0, s2 = 0;
    for (let z = 1; z <= Z; z++) {
      const c1 = K * z, c2 = K; s1 += c1; s2 += c2;
      const b1 = bar(C.red, 0.8, 0.8, -5.4 + (z - 1) * 1.2, -1.4); await growBar(tok, b1, c1 * 0.2, 200);
      const b2 = bar(C.green, 0.8, 0.8, -5.4 + (z - 1) * 1.2, 1.4); await growBar(tok, b2, c2 * 0.2, 150);
      txt(t1, '累計 ' + s1); txt(t2, '累計 ' + s2);
      say('第 ' + z + ' 行（每行 K = 3 個字）', '+ 複製 ' + c1 + ' 個；extend 搬 ' + c2 + ' 個');
      await beat(tok, 500);
    }
    say('+：K(1 + 2 + … + Z) ≈ W²/(2K) → O(W²)', 'extend：K 次 append × Z 行 = K·Z = W → O(W)');
    await beat(tok, 3200);
    say('改幾個字元，執行時間改善約 30%', 'Python list 是陣列（CLRS array），不是 linked list');
    await beat(tok, 3000);
  }

  // ─── 4iXLnF3hExw：已排序向量的內積：兩指標 ───
  async function scSortedInner(tok) {
    fresh([0, 6, 14], [0, 1.8, 0]);
    const D1 = [[3, 2], [4, 1], [6, 1], [8, 1], [9, 1]], D2 = [[2, 1], [3, 1], [6, 1], [7, 1], [8, 1]];
    const X = (i) => -4.4 + i * 2;
    const m1 = D1.map(([w, c], i) => cube(w + ':' + c, C.blue, [1.4, 0.6, 1], X(i), 0.3, -1.5));
    const m2 = D2.map(([w, c], i) => cube(w + ':' + c, C.purple, [1.4, 0.6, 1], X(i), 0.3, 1.5));
    tag('文件 1', 'ptr', -6.4, 0.3, -1.5); tag('文件 2', 'ptr', -6.4, 0.3, 1.5);
    const p1 = tag('↑', 'ptr alt', X(0), 1, -1.5), p2 = tag('↑', 'ptr alt', X(0), 1, 1.5);
    const sl = tag('內積 = 0・步數 0', 'ptr alt', 0, 4.4);
    say('字換成編號、依編號排序：字編號:次數', '原做法 O(L₁L₂)；排序後可以用 binary search：O(L₁ log L₂)');
    await beat(tok, 3000);
    say('更好：兩個指標，只往前走', '');
    await beat(tok, 1400);
    let i = 0, j = 0, sum = 0, steps = 0;
    while (i < D1.length && j < D2.length) {
      steps++; glow(m1[i], GOLD); glow(m2[j], GOLD);
      const a = D1[i][0], b = D2[j][0];
      if (a === b) { sum += D1[i][1] * D2[j][1]; tint(m1[i], C.green); tint(m2[j], C.green); say(a + ' = ' + b + '：相乘 ' + D1[i][1] + ' × ' + D2[j][1], '兩個指標都前進'); await beat(tok, 1300); glow(m1[i], null); glow(m2[j], null); i++; j++; }
      else if (a < b) { say(a + ' < ' + b + '：' + a + ' 不會在文件 2 的後面出現', '文件 1 的指標前進'); await beat(tok, 1100); glow(m1[i], null); glow(m2[j], null); i++; }
      else { say(a + ' > ' + b + '：文件 2 的指標前進', '找 4 時看到 6 > 4 就停在原地'); await beat(tok, 1100); glow(m1[i], null); glow(m2[j], null); j++; }
      move(p1, X(Math.min(i, 4.4)), 1, -1.5); move(p2, X(Math.min(j, 4.4)), 1, 1.5);
      txt(sl, '內積 = ' + sum + '・步數 ' + steps);
    }
    say('內積 = 2 + 1 + 1 = 4：O(L₁ + L₂)', '指標只會往下走 → 最多 L₁ + L₂ 步');
    await beat(tok, 2800);
    say('改用 binary search 反而慢', '兩個都是 1…N 時要 N log N，兩指標只要 2N；這個技巧就是 merge sort 的 merge');
    await beat(tok, 3200);
  }

  // ─── 課本補充（CLRS 7.1）：PARTITION（Lomuto） ───
  async function scPartition(tok) {
    fresh([0, 6, 13.5], [0, 1.8, 0]);
    const a = [2, 8, 7, 1, 3, 5, 6, 4], X = (i) => -4.9 + i * 1.4;
    let ms = a.map((v, i) => { tag(String(i + 1), 'idx', X(i), 0, 0.9); return cube(v, C.blue, [1, 0.6, 1], X(i), 0.3, 0); });
    const cd = code(['x = A[r]; i = p − 1', 'for j = p to r − 1', '  if A[j] ≤ x', '    i = i + 1; swap A[i], A[j]', 'swap A[i+1], A[r]; return i + 1'], 2.4, 6.6, 0.48);
    const ip = tag('i', 'ptr', X(-0.7), 0, 1.7), jp = tag('j', 'ptr alt', X(0), 1.3);
    tint(ms[7], C.gold);
    say('CLRS 的 PARTITION：pivot x = A[r] = 4', '影片用第一個元素當 pivot；概念相同');
    cd.hl(0); await beat(tok, 2400);
    let i = -1;
    const sw = (p, q) => { if (p === q) return; [a[p], a[q]] = [a[q], a[p]]; [ms[p], ms[q]] = [ms[q], ms[p]]; move(ms[p], X(p), 0.3, 0); move(ms[q], X(q), 0.3, 0); };
    for (let j = 0; j < 7; j++) {
      cd.hl(2); move(jp, X(j), 1.3, 0); glow(ms[j], GOLD);
      await beat(tok, 700);
      if (a[j] <= 4) { i++; cd.hl(3); sw(i, j); move(ip, X(i), 0, 1.7); say('A[' + (j + 1) + '] = ' + a[i] + ' ≤ 4：i 前進並交換', '淺色區 = ≤ x'); tint(ms[i], C.green); }
      else { say('A[' + (j + 1) + '] = ' + a[j] + ' > 4：不動', '深色區 = > x'); tint(ms[j], C.purple); }
      await beat(tok, 900); ms.forEach((m) => glow(m, null));
    }
    cd.hl(4); sw(i + 1, 7);
    say('最後把 pivot 換到 i + 1 = ' + (i + 2), '[' + a.join(', ') + ']');
    await beat(tok, 2400);
    say('左邊都 ≤ 4、右邊都 > 4：4 已在最終位置', '比較 n − 1 次 → Θ(n)');
    await beat(tok, 3000);
  }

  // ─── -qOVVRIZzao：best case：每次切在中間 ───
  async function scQSBest(tok) {
    if ((ctx.params || {}).focus !== 'median') {
      fresh([0, 5, 14.5], [0, 3.2, 0]);
      const W = 12.6, unit = W / 15;
      say('1～15 共 15 個元素，假設每次都切在中間', 'pivot 剛好落在中間位置');
      await beat(tok, 2000);
      const rec = async (l, h, d) => {
        if (l > h || d > 3) return;
        const m = (l + h) >> 1, y = 6.4 - d * 1.6, x0 = -W / 2 + (l - 1) * unit, w = (h - l + 1) * unit;
        cube(l === h ? String(l) : l + '～' + h, d === 3 ? C.purple : C.blue, [w - 0.12, 0.5, 0.8], x0 + w / 2, y, 0, 1.2);
        const pm = cube(m, C.gold, [unit * 0.8, 0.52, 0.85], x0 + (m - l + 0.5) * unit, y, 0.1);
        pm.visible = l !== h;
      };
      for (let d = 0; d < 4; d++) {
        const ranges = []; const walk = (l, h, dd) => { if (l > h) return; if (dd === d) { ranges.push([l, h]); return; } const m = (l + h) >> 1; walk(l, m - 1, dd + 1); walk(m + 1, h, dd + 1); };
        walk(1, 15, 0);
        for (const [l, h] of ranges) await rec(l, h, d);
        tag('≈ n', 'ptr alt', 6.8, 6.4 - d * 1.6);
        say(d === 0 ? '第 1 次 partition 在 8：比較整個串列 ≈ n' : '第 ' + (d + 1) + ' 層：' + ranges.map(([l, h]) => l === h ? l : l + '～' + h).join('、'), '這一層 partition 合計 ≈ n');
        await beat(tok, 1800);
      }
      say('切在中間：高度 log n，每層 n', 'best case Θ(n log n)');
      await beat(tok, 3000);
    }
    fresh([0, 5, 13], [0, 1.6, 0]);
    const S = [1, 2, 3, 4, 5, 6, 7];
    const ms = S.map((v, i) => cube(v, C.blue, [0.9, 0.6, 0.9], -3.6 + i * 1.2, 0.3, 0));
    say('Median：已排序串列的中間元素', '1～7 的 median 是 4');
    await beat(tok, 1600);
    tint(ms[3], C.gold); glow(ms[3], GOLD);
    await beat(tok, 1600);
    say('要每次切在中間，pivot 必須剛好是 median', '但沒排序就不知道 median → 無法保證');
    const shuf = [5, 2, 7, 4, 1, 6, 3];
    shuf.forEach((v, i) => move(ms[v - 1], -3.6 + i * 1.2, 0.3, 0));
    await beat(tok, 2600);
    say('Best case 只能隨機碰到', '補充：CLRS 的 randomized quicksort 期望 Θ(n log n)');
    await beat(tok, 2800);
  }

  // ─── -qOVVRIZzao：worst case：已排序 ───
  async function scQSWorst(tok) {
    fresh([0, 5.5, 14], [0, 3, 0]);
    const n = 7;
    say('輸入已排序：1～7，pivot 取第一個', 'i 找不到更大的、j 一路走回來 → pivot 留在原位');
    await beat(tok, 2600);
    let total = 0;
    for (let d = 0; d < n; d++) {
      const y = 6.6 - d * 0.95, len = n - d;
      for (let k = 0; k < len; k++) cube(d + k + 1, k === 0 ? C.gold : C.blue, [0.75, 0.5, 0.7], -3.6 + (d + k) * 0.95, y, 0, 1.2);
      total += len;
      tag('比較 ≈ ' + len, 'ptr alt', 4.4, y);
      say('pivot ' + (d + 1) + ' 留在最前面：右邊剩 ' + (len - 1) + ' 個', '左邊是空的——最不平衡的切法');
      await beat(tok, d < 2 ? 1500 : 700);
    }
    say('n + (n−1) + … + 1 = n(n+1)/2 = ' + total, 'worst case Θ(n²)');
    await beat(tok, 3000);
    say('遞減排序也一樣：每次切在最後', 'merge sort 一律 n log n；quicksort 平均 n log n、最壞 n²');
    await beat(tok, 3000);
  }

  // ─── -qOVVRIZzao：改善 pivot：取中間 / 隨機 ───
  async function scQSPivot(tok) {
    fresh([0, 5, 14.5], [0, 3, 0]);
    tag('pivot = 第一個', 'ptr', -3.6, 7.2); tag('pivot = 中間', 'ptr alt', 3.6, 7.2);
    say('同一個已排序輸入 1～7', '左：取第一個；右：取中間');
    await beat(tok, 2000);
    for (let d = 0; d < 7; d++) { cube(String(d + 1), C.red, [0.6, 0.45, 0.6], -6 + d * 0.62, 6.3 - d * 0.9, 0, 1.2); await beat(tok, 260); }
    tag('深度 7 = n', 'ptr', -3.6, 0.2, 1.2);
    await beat(tok, 900);
    const nodes = [[4, 0, 3.6], [2, 1, 2.2], [6, 1, 5], [1, 2, 1.5], [3, 2, 2.9], [5, 2, 4.3], [7, 2, 5.7]];
    for (const [v, d, x] of nodes) { cube(String(v), C.green, [0.6, 0.45, 0.6], x, 6.3 - d * 1.5, 0, 1.2); await beat(tok, 300); }
    tag('深度 3 = log n', 'ptr alt', 3.6, 0.2, 1.2);
    say('已排序時「中間」剛好是 median：每次對半', '原本的 worst case 變 best case Θ(n log n)');
    await beat(tok, 3000);
    say('但總有別的排列讓中間 pivot 也很差', '隨機 pivot：期望 n log n，最壞仍是 n²');
    await beat(tok, 3200);
  }

  // ─── -qOVVRIZzao：stack 空間 ───
  async function scQSStack(tok) {
    fresh([0, 5, 14], [0, 3.2, 0]);
    tag('best：切在中間', 'ptr', -3, 7.2); tag('worst：已排序', 'ptr alt', 3, 7.2);
    say('Quicksort 不用額外陣列，但遞迴要用 stack', 'stack 深度 = 遞迴樹高度（n = 15）');
    await beat(tok, 2400);
    const fr = [];
    for (let d = 0; d < 4; d++) { fr.push(cube('QS 第' + (d + 1) + '層', C.blue, [2.6, 0.38, 1.2], -3, 0.2 + d * 0.42, 0, 2)); await beat(tok, 350); }
    for (let d = 0; d < 15; d++) { cube('', C.red, [2.6, 0.38, 1.2], 3, 0.2 + d * 0.42, 0, 2); await beat(tok, 170); }
    tag('log n = 4 層', 'ptr', -3, 2.3); tag('n = 15 層', 'ptr alt', 3, 6.9);
    say('stack 大小：best log n、worst n', '空間 O(log n) ～ O(n)');
    await beat(tok, 3000);
    say('補充：先遞迴較小的一半、較大的用迴圈', '可把 stack 壓到 O(log n)（tail recursion elimination）');
    await beat(tok, 3000);
  }

  // ─── 課本補充（CLRS 9.3）：median of medians 線性時間選擇 ───
  async function scSelectMoM(tok) {
    fresh([0, 4.2, 13.5], [0, 2.3, 0]);
    const vals = [37, 4, 61, 22, 49, 13, 70, 1, 31, 58, 25, 67, 10, 43, 16, 52, 7, 73, 34, 19, 64, 28, 46, 55, 40];
    const groups = []; for (let g = 0; g < 5; g++) groups.push(vals.slice(g * 5, g * 5 + 5));
    // groups stand as columns (smallest on top) so no value hides behind another row
    const X = (g) => -4.4 + g * 2.2, Y = (r) => 0.3 + (4 - r) * 0.9;
    let ms = groups.map((G, g) => G.map((v, r) => cube(v, C.blue, [1, 0.5, 0.9], X(g), Y(r), 0, 1.5)));
    say('SELECT 第 i 小：先把 n 個數分成 ⌈n/5⌉ 組，每組 5 個', '例：25 個數 → 5 組');
    await beat(tok, 2600);
    groups.forEach((G, g) => { const s = G.map((v, r) => ({ v, m: ms[g][r] })).sort((a, b) => a.v - b.v); s.forEach((o, r) => move(o.m, X(g), Y(r), 0)); groups[g] = s.map((o) => o.v); ms[g] = s.map((o) => o.m); });
    say('每組排序（5 個，常數時間），取中位數', '');
    await beat(tok, 1600);
    ms.forEach((col) => { tint(col[2], C.gold); });
    await beat(tok, 1400);
    const order = [0, 1, 2, 3, 4].sort((a, b) => groups[a][2] - groups[b][2]);
    order.forEach((g, pos) => ms[g].forEach((m, r) => move(m, X(pos), Y(r), 0)));
    const G2 = order.map((g) => groups[g]), M2 = order.map((g) => ms[g]);
    say('依中位數把各組排好；遞迴找「中位數的中位數」x', 'x = ' + G2[2][2]);
    await beat(tok, 2200);
    glow(M2[2][2], GREEN); tint(M2[2][2], C.green);
    for (let g = 0; g <= 2; g++) for (let r = 0; r <= 2; r++) if (!(g === 2 && r === 2)) { tint(M2[g][r], C.purple); }
    say('左上角（紫）一定 ≤ x：至少 3n/10 − 6 個', '同理右下角一定 ≥ x');
    await beat(tok, 3000);
    for (let g = 2; g <= 4; g++) for (let r = 2; r <= 4; r++) if (!(g === 2 && r === 2)) tint(M2[g][r], C.orange);
    await beat(tok, 1500);
    say('用 x partition：最多剩 7n/10 + 6 個要遞迴', 'T(n) ≤ T(⌈n/5⌉) + T(7n/10 + 6) + O(n)');
    await beat(tok, 3000);
    say('1/5 + 7/10 < 1 → 每層工作量遞減 → O(n)', '最壞情況也是線性時間');
    await beat(tok, 3000);
  }

  // ─── 課本補充（CLRS 4.1）：maximum subarray ───
  async function scMaxSub(tok) {
    fresh([0, 5, 14], [0, 2.4, 0]);
    const a = CLRS_MS, n = a.length, X = (i) => -6 + i * 0.8;
    const base = lab.box(C.brown, [13, 0.04, 0.9]); base.position.set(0, 2.6, 0); lab.world.add(base);
    const bs = a.map((v, i) => { const m = bar(v >= 0 ? C.blue : C.red, 0.62, 0.8, X(i), 0); setBar(m, v * 0.09, 2.6); tag(String(v), 'idx', X(i), 2.6 + (v >= 0 ? v * 0.09 + 0.3 : 0.3), 0.6); return m; });
    say('股價每日變化：找總和最大的連續區段', 'CLRS 例：16 天');
    await beat(tok, 2400);
    line(X(7) + 0.4, 0.2, X(7) + 0.4, 5.2, 0, C.brown);
    say('從中間切開：答案在左半、右半、或跨過中點', 'Divide');
    await beat(tok, 2200);
    const hl = (i0, j0, c) => { for (let i = i0; i <= j0; i++) glow(bs[i], c); };
    hl(3, 3, GOLD); say('左半遞迴：最大是 A[4] = 20', 'Conquer'); await beat(tok, 2000); hl(3, 3, null);
    hl(8, 10, GOLD); say('右半遞迴：A[9…11] = 20 − 7 + 12 = 25', ''); await beat(tok, 2000); hl(8, 10, null);
    say('跨中點：從中點往左累加、往右累加，各取最大', 'Combine：FIND-MAX-CROSSING-SUBARRAY Θ(n)');
    let s = 0;
    for (let i = 7; i >= 0; i--) { s += a[i]; glow(bs[i], i === 7 ? GREEN : GOLD); await beat(tok, 260); }
    hl(0, 6, null);
    s = 0; for (let j = 8; j < n; j++) { s += a[j]; glow(bs[j], j <= 10 ? GREEN : GOLD); await beat(tok, 260); }
    hl(11, 15, null);
    say('左邊最多 18（只取 A[8]），右邊最多 25（到 A[11]）', '跨中點 = 18 + 25 = 43');
    await beat(tok, 2600);
    say('max(20, 25, 43) = 43：A[8…11]', 'T(n) = 2T(n/2) + Θ(n) = Θ(n lg n)；Kadane 一次掃描 Θ(n)');
    await beat(tok, 3400);
  }

  // ─── 0oJyNmEbS4w：2×2 的四個公式與三層迴圈 ───
  async function scMatMul2(tok) {
    fresh([0, 6, 14], [0, 2.4, 0]);
    const A = [[1, 2], [3, 4]], B = [[5, 6], [7, 8]];
    // matrices stand upright (row i at height RY(i)) so the rows never print over each other
    const RY = (i) => 1.35 - i * 0.9;
    const grid = (M, cx, col, nm) => { tag(nm, 'ptr', cx, 2.3, -1.2); return M.map((r, i) => r.map((v, j) => cube(v, col, [0.9, 0.5, 0.9], cx - 0.5 + j, RY(i), -1.2))); };
    const am = grid(A, -4.4, C.blue, 'A'), bm = grid(B, -1.2, C.purple, 'B');
    tag('×', 'val', -2.8, 0.9, -1.2); tag('=', 'val', 0.7, 0.9, -1.2);
    const cd = code(['for (i = 0; i < n; i++)', '  for (j = 0; j < n; j++) {', '    C[i][j] = 0;', '    for (k = 0; k < n; k++)', '      C[i][j] += A[i][k] * B[k][j];', '  }'], 4.4, 6.8, 0.44);
    const cnt = tag('乘法 0 次', 'ptr alt', 4.4, 3.8);
    say('一般矩陣乘法：C[i][j] = Σ A[i][k]·B[k][j]', '三層迴圈 → n³（n = 2 時 8 次乘法）');
    await beat(tok, 2600);
    const F = ['C11 = A11·B11 + A12·B21', 'C12 = A11·B12 + A12·B22', 'C21 = A21·B11 + A22·B21', 'C22 = A21·B12 + A22·B22'];
    let c = 0;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      cd.hl(4);
      [0, 1].forEach((k) => { glow(am[i][k], GOLD); glow(bm[k][j], GOLD); });
      const v = A[i][0] * B[0][j] + A[i][1] * B[1][j]; c += 2; txt(cnt, '乘法 ' + c + ' 次');
      cube(v, C.green, [0.9, 0.5, 0.9], 2 + j, RY(i), -1.2, 2);
      say(F[i * 2 + j], A[i][0] + '×' + B[0][j] + ' + ' + A[i][1] + '×' + B[1][j] + ' = ' + v);
      await beat(tok, 2200);
      [0, 1].forEach((k) => { glow(am[i][k], null); glow(bm[k][j], null); });
    }
    cd.hl(-1);
    say('2×2 是 small problem：4 個公式、8 次乘法，常數時間', 'n 不是 2 的次方就補 0');
    await beat(tok, 3000);
  }

  // ─── 0oJyNmEbS4w：4×4 切成區塊，8 次遞迴 ───
  async function scMatBlocks(tok) {
    fresh([0, 6.5, 14], [0, 2.2, 0]);
    const cols = [C.blue, C.purple, C.teal, C.orange], nm = ['11', '12', '21', '22'];
    const make = (cx, pre) => { const ms = []; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const q = (i >> 1) * 2 + (j >> 1); ms.push({ q, m: cube('', cols[q], [0.55, 0.35, 0.55], cx - 0.9 + j * 0.6, 0.18, -2.6 + i * 0.6) }); } tag(pre, 'ptr', cx, 0.3, -3.6); return ms; };
    const am = make(-4, 'A（4×4）'), bm = make(-0.6, 'B（4×4）');
    say('4×4 太大：每個矩陣沿列、行對半切', '得到四個 2×2 子矩陣');
    await beat(tok, 2200);
    for (const ms of [am, bm]) ms.forEach((o) => { const p = o.m.position; move(o.m, p.x + ((o.q & 1) ? 0.25 : -0.25), 0.18, p.z + ((o.q >> 1) ? 0.25 : -0.25)); });
    for (let q = 0; q < 4; q++) { tag('A' + nm[q], 'idx', -4 + ((q & 1) ? 0.85 : -0.85), 0.5, -2.6 + ((q >> 1) ? 1.75 : 0.05)); tag('B' + nm[q], 'idx', -0.6 + ((q & 1) ? 0.85 : -0.85), 0.5, -2.6 + ((q >> 1) ? 1.75 : 0.05)); }
    await beat(tok, 2000);
    say('把每個子矩陣當成一個「元素」', '就變成 2×2 乘法：套用同樣四個公式');
    await beat(tok, 2400);
    const calls = [['11', '11'], ['12', '21'], ['11', '12'], ['12', '22'], ['21', '11'], ['22', '21'], ['21', '12'], ['22', '22']];
    tag('MM(A, B, 4)', 'ptr alt', 3.6, 6.9);
    for (let k = 0; k < 8; k++) { // one row per C block: its two calls side by side
      const x = 2.3 + (k % 2) * 2.6, y = 5.6 - Math.floor(k / 2) * 1.05;
      cube('A' + calls[k][0] + 'B' + calls[k][1], k < 4 ? C.blue : C.purple, [1.4, 0.5, 0.8], x, y, 0, 1.5);
      line(3.6, 6.6, x, y + 0.3);
      say('C' + ['11', '11', '12', '12', '21', '21', '22', '22'][k] + ' 需要 MM(A' + calls[k][0] + ', B' + calls[k][1] + ', n/2)', '第 ' + (k + 1) + ' 次遞迴呼叫');
      await beat(tok, 750);
    }
    say('共 8 次遞迴，規模 n/2；+ 是矩陣加法', 'C11 = MM(A11, B11) + MM(A12, B21) …');
    await beat(tok, 3200);
  }

  // ─── 0oJyNmEbS4w：Strassen 的 7 個乘積 ───
  async function scStrassen7(tok) {
    fresh([0, 6, 14.5], [0, 2.6, 0]);
    const A = [[1, 2], [3, 4]], B = [[5, 6], [7, 8]], s = strassen(A, B);
    const F = [['P', '(A11 + A22)(B11 + B22)', '(1+4)(5+8)'], ['Q', '(A21 + A22)·B11', '(3+4)·5'], ['R', 'A11·(B12 − B22)', '1·(6−8)'], ['S', 'A22·(B21 − B11)', '4·(7−5)'], ['T', '(A11 + A12)·B22', '(1+2)·8'], ['U', '(A21 − A11)(B11 + B12)', '(3−1)(5+6)'], ['V', '(A12 − A22)(B21 + B22)', '(2−4)(7+8)']];
    const cd = code(F.map(([k, f]) => k + ' = ' + f), -3.2, 7.2, 0.5);
    const cnt = tag('乘法 0 次', 'ptr alt', 3.6, 7.2);
    say('Strassen：重新組合成 7 個乘積', '加減變多，但乘法從 8 次降到 7 次');
    await beat(tok, 2600);
    const pm = {};
    for (let q = 0; q < 7; q++) {
      const [k, , num] = F[q];
      cd.hl(q); txt(cnt, '乘法 ' + (q + 1) + ' 次');
      pm[k] = cube(k + '=' + s[k], C.orange, [1.4, 0.45, 0.9], -5.4 + q * 1.8, 0.23, 1.6, 2);
      say(k + ' = ' + num + ' = ' + s[k], 'A = [1 2; 3 4]、B = [5 6; 7 8]');
      await beat(tok, 1300);
    }
    cd.hl(-1);
    const G = [['C11 = P + S − T + V', s.P + ' + ' + s.S + ' − ' + s.T + ' + (' + s.V + ') = ' + s.C[0][0], ['P', 'S', 'T', 'V']], ['C12 = R + T', '(' + s.R + ') + ' + s.T + ' = ' + s.C[0][1], ['R', 'T']], ['C21 = Q + S', s.Q + ' + ' + s.S + ' = ' + s.C[1][0], ['Q', 'S']], ['C22 = P + R − Q + U', s.P + ' + (' + s.R + ') − ' + s.Q + ' + ' + s.U + ' = ' + s.C[1][1], ['P', 'R', 'Q', 'U']]];
    for (let q = 0; q < 4; q++) {
      G[q][2].forEach((k) => glow(pm[k], GOLD));
      cube(s.C[q >> 1][q & 1], C.green, [0.9, 0.5, 0.9], 3 + (q & 1), 1.35 - (q >> 1) * 0.9, -1.6, 2); // upright: rows apart
      say(G[q][0], G[q][1]);
      await beat(tok, 2000);
      G[q][2].forEach((k) => glow(pm[k], null));
    }
    say('C = [19 22; 43 50]，和一般公式一樣', '只用了 7 次乘法');
    await beat(tok, 3000);
  }

  // ─── 0oJyNmEbS4w：8T(n/2) + n² vs 7T(n/2) + n² ───
  async function scStrassenRec(tok) {
    fresh([0, 5, 14.5], [0, 3, 0]);
    const only = (ctx.params || {}).a;
    const run = async (a, x0, col) => {
      tag(a === 8 ? '一般分治 8T(n/2) + n²' : 'Strassen 7T(n/2) + n²', a === 8 ? 'ptr' : 'ptr alt', x0, 7.2);
      for (let d = 0; d <= 4; d++) {
        const cnt = Math.pow(a, d), cost = cnt * Math.pow(16 / Math.pow(2, d), 2);
        const m = bar(col, 0.9, 0.9, x0 - 2 + d * 1, 0); await growBar(tok, m, 0.3 + lg(cost) * 0.42, 260);
        tag(cnt + ' 個', 'idx', x0 - 2 + d * 1, 0, 0.8);
        tag(fmt(cost), 'idx', x0 - 2 + d * 1, 0.6 + lg(cost) * 0.42);
      }
    };
    say('遞迴樹每層的總工作量（n = 16，對數高度）', '第 d 層：a^d 個子問題，每個 (n/2^d)²');
    await beat(tok, 2400);
    if (only !== 7) { await run(8, -3.4, C.red); say('a = 8：每層 ×2，越往下越大 → 葉子主導', 'log₂8 = 3 > 2 → Θ(n³)，跟三層迴圈一樣'); await beat(tok, 3000); }
    if (only !== 8) { await run(7, 3.4, C.green); say('a = 7：每層 ×7/4，葉子 7^(log₂n) = n^(log₂7)', 'log₂7 ≈ 2.81 > 2 → Θ(n^2.81)'); await beat(tok, 3000); }
    say('只少一次乘法，指數從 3 降到 2.81', '遞迴要用 stack：空間比三層迴圈差');
    await beat(tok, 3000);
  }

  // ─── 2YeJ-5UAke8：乘法的分治：4、3、5 次 ───
  async function scMultRec(tok) {
    fresh([0, 5, 14.5], [0, 3, 0]);
    const x = cube('12 | 34', C.blue, [2.4, 0.6, 1], -4.4, 6, 0, 1.5), y = cube('56 | 78', C.purple, [2.4, 0.6, 1], -1.6, 6, 0, 1.5);
    say('d 位數拆成高低兩半：x = x₁x₀、y = y₁y₀', '1234 × 5678');
    await beat(tok, 2400);
    const P = [['x₁y₁ = 12×56', 672], ['x₁y₀ = 12×78', 936], ['x₀y₁ = 34×56', 1904], ['x₀y₀ = 34×78', 2652]];
    for (let q = 0; q < 4; q++) { cube(P[q][0] + ' = ' + P[q][1], C.orange, [3.4, 0.45, 0.8], -3, 4.6 - q * 0.6, 0, 1.2); await beat(tok, 600); }
    say('4 次乘法，再移位相加', 'xy = 672·10⁴ + (936 + 1904)·10² + 2652 = 7006652；T(n) = 4T(n/2) + Θ(n) = Θ(n²)');
    await beat(tok, 3200);
    const R = [['4T(n/2) + n', 2, C.red, '小學乘法'], ['3T(n/2) + n', Math.log2(3), C.orange, 'Karatsuba'], ['5T(n/3) + n', Math.log(5) / Math.log(3), C.green, 'Toom-3'], ['n log n log log n', 1.08, C.teal, 'Schönhage-Strassen']];
    for (let q = 0; q < R.length; q++) {
      const [rec, e, col, nm] = R[q], x0 = 1.8 + q * 1.4;
      const m = bar(col, 1, 1, x0, 0); await growBar(tok, m, (e - 0.9) * 4.5, 400);
      tag(nm, 'idx', x0, 0, 1 + (q % 2) * 0.5); tag(q === 3 ? '≈ n' : 'n^' + e.toFixed(3), 'ptr alt', x0, (e - 0.9) * 4.5 + 0.4);
      say(nm + '：' + rec, q === 1 ? '4 次乘法減為 3 次 → n^1.585' : q === 2 ? '拆三段：9 次減為 5 次 → n^(log₃5) ≈ n^1.465' : q === 3 ? '用 FFT，接近線性' : '');
      await beat(tok, 2200);
    }
    say('常數很大：n 要很大時快的才會贏', 'Python 長整數在 n 夠大時才切到 Karatsuba');
    await beat(tok, 3000);
  }

  // ─── 課本補充：Karatsuba 的三次乘法 ───
  async function scKaratsuba(tok) {
    fresh([0, 5.5, 14], [0, 3, 0]);
    const cd = code(['z₂ = x₁·y₁ = 12 × 56 = 672', 'z₀ = x₀·y₀ = 34 × 78 = 2652', 'z₁ = (x₁ + x₀)(y₁ + y₀) − z₂ − z₀', '   = 46 × 134 − 672 − 2652 = 2840', 'xy = z₂·10⁴ + z₁·10² + z₀ = 7006652'], -1.2, 6.6, 0.6);
    const cnt = tag('乘法 0 次', 'ptr alt', 4.6, 7.2);
    say('Karatsuba：中間項不用兩次乘法', 'x₁y₀ + x₀y₁ = (x₁ + x₀)(y₁ + y₀) − x₁y₁ − x₀y₀');
    await beat(tok, 3000);
    const steps = [0, 1, 2];
    for (let q = 0; q < 3; q++) {
      cd.hl(steps[q]); txt(cnt, '乘法 ' + (q + 1) + ' 次');
      cube(['672', '2652', '6164'][q], [C.orange, C.orange, C.gold][q], [1.6, 0.6, 1], -4.4 + q * 2.2, 0.3, 1.8, 2);
      say(['z₂ = 12 × 56 = 672', 'z₀ = 34 × 78 = 2652', '(12 + 34)(56 + 78) = 46 × 134 = 6164'][q], '');
      await beat(tok, 1800);
    }
    cd.hl(3); say('6164 − 672 − 2652 = 2840 = 936 + 1904', '只用減法就拿到中間項');
    await beat(tok, 2600);
    cd.hl(4); say('xy = 7006652：3 次乘法', 'T(n) = 3T(n/2) + Θ(n) = Θ(n^(lg 3)) ≈ Θ(n^1.585)');
    await beat(tok, 3200);
  }

  // ─── 2YeJ-5UAke8：log* n ───
  async function scLogStar(tok) {
    fresh([0, 5, 14], [0, 2.8, 0]);
    const S = [['2⁵⁰', 50], ['50', Math.log2(50)], ['5.64', Math.log2(Math.log2(50))], ['2.50', Math.log2(Math.log2(Math.log2(50)))], ['1.32', Math.log2(Math.log2(Math.log2(Math.log2(50))))], ['0.40', 0]];
    say('log* n：要對 n 連續取幾次 log 才 ≤ 1', 'iterated logarithm');
    await beat(tok, 2400);
    for (let q = 0; q < S.length; q++) {
      const h = [6.2, 4.4, 2.9, 1.9, 1.2, 0.5][q];
      const m = bar(q === S.length - 1 ? C.green : C.blue, 1.3, 1.3, -5 + q * 2, 0); await growBar(tok, m, h, 350);
      tag(S[q][0], 'ptr alt', -5 + q * 2, h + 0.4);
      if (q) tag('log 第 ' + q + ' 次', 'idx', -5 + q * 2, 0, 1.3);
      say(q === 0 ? '從 2⁵⁰ 開始' : '取 log₂：' + S[q][0], q === S.length - 1 ? '≤ 1 了：log*(2⁵⁰) = 5' : '');
      await beat(tok, 1300);
    }
    say('Fürer：n log n · 2^O(log* n)', 'log* n 實務上幾乎是常數；Schönhage-Strassen 用 FFT 是 n log n log log n');
    await beat(tok, 3400);
  }

  // ─── 2YeJ-5UAke8：Newton 求 √2，誤差平方 ───
  async function scNewtonSqrt(tok) {
    fresh([0, 5, 14.5], [0, 3.2, 0]);
    const a = 2, X = (x) => -6 + x * 3.8, Y = (v) => 2.8 + v * 1.0;
    line(X(0), Y(0), X(2.3), Y(0), 0, C.brown); line(X(0), Y(-2.2), X(0), Y(3.4), 0, C.brown);
    const pts = []; for (let q = 0; q <= 60; q++) { const x = 0.2 + q * 2.0 / 60; pts.push(V3(X(x), Y(x * x - a), 0)); }
    tube(pts, C.red); tag('f(x) = x² − 2', 'ptr', X(2.2), Y(2.84) + 0.3);
    tag('√2', 'idx', X(Math.SQRT2), Y(0) - 0.4);
    const xs = [1, 1.5, 17 / 12, 577 / 408, 665857 / 470832];
    const dot = cube('', C.gold, [0.22, 0.22, 0.22], X(1), Y(0), 0);
    say('Newton：x_{i+1} = (x_i + a/x_i)/2，x₀ = 1', '沿切線走到和 x 軸的交點');
    await beat(tok, 2400);
    for (let q = 0; q < 3; q++) {
      const x = xs[q], fx = x * x - a, nx = xs[q + 1];
      line(X(x), Y(0), X(x), Y(fx), 0, C.gold);
      tube([V3(X(x), Y(fx), 0), V3(X(nx), Y(0), 0)], C.green, 0.03);
      move(dot, X(nx), Y(0), 0);
      say('x' + (q + 1) + ' = ' + nx.toFixed(6), '誤差 ε = ' + (nx / Math.SQRT2 - 1).toExponential(2));
      await beat(tok, 2000);
    }
    const eps = xs.map((x) => Math.abs(x / Math.SQRT2 - 1));
    for (let q = 0; q < eps.length; q++) {
      const d = -Math.log10(eps[q]);
      const m = bar(C.purple, 0.7, 0.7, 2.8 + q * 0.95, 2.2); await growBar(tok, m, d * 0.42, 250);
      tag(d.toFixed(1), 'idx', 2.8 + q * 0.95, d * 0.42 + 0.3, 2.2);
    }
    tag('正確位數', 'ptr alt', 4.7, 0.2, 3.2);
    say('正確位數 0.5 → 1.2 → 2.8 → 5.8 → 11.9：每次約翻倍', 'ε_{n+1} = ε_n² / (2(1 + ε_n))');
    await beat(tok, 3200);
    say('d 位精度只要 log d 次迭代', 'quadratic convergence');
    await beat(tok, 2600);
  }

  // ─── 2YeJ-5UAke8：Newton 求 R/b：2¹⁶/5 ───
  async function scNewtonRecip(tok) {
    fresh([0, 5, 14], [0, 3, 0]);
    const cd = code(['f(x) = 1/x − b/R，根在 x = R/b', 'x_{i+1} = 2x_i − b·x_i²/R'], -1, 7.2, 0.55);
    const tgt = 65536 / 5, H = (v) => v / 16384 * 5.6;
    const wl = lab.box(C.green, [10.5, 0.05, 0.05]); wl.position.set(0.2, H(tgt), 0); lab.world.add(wl);
    tag('R/b = 13107.2', 'ptr alt', 5.8, H(tgt) + 0.3);
    say('a/b = a × (1/b)：先算 ⌊R/b⌋，R = 2ᵏ', '除以 R 只是 shift；只需要乘法');
    cd.hl(1); await beat(tok, 2800);
    const xs = [16384, 12288, 13056, 13107];
    const caps = ['x₀ = 2¹⁶/4 = 16384（用 2 的次方猜）', 'x₁ = 2·16384 − 5·16384²/65536 = 12288', 'x₂ = 2·12288 − 5·12288²/65536 = 13056', 'x₃ = 13107'];
    for (let q = 0; q < 4; q++) {
      const m = bar(q === 3 ? C.green : C.blue, 1.4, 1.4, -4.2 + q * 2.4, 0); await growBar(tok, m, H(xs[q]), 500);
      tag(String(xs[q]), 'idx', -4.2 + q * 2.4, H(xs[q]) + 0.35);
      say(caps[q], q ? '和真值差 ' + Math.abs(xs[q] - tgt).toFixed(1) : 'R = 65536、b = 5');
      await beat(tok, 2200);
    }
    say('差距 3277 → 819 → 51 → 0.2：一樣是平方收斂', '每步只有乘法、平方、shift');
    await beat(tok, 3200);
  }

  // ─── 2YeJ-5UAke8：精度加倍 → 成本由最後一次主導 ───
  async function scNewtonCost(tok) {
    fresh([0, 5, 14.5], [0, 3, 0]);
    const al = Math.log2(3), D = [1, 2, 4, 8, 16, 32, 64], c = (d) => Math.pow(d, al), mxv = c(64);
    tag('粗估：每次都做 d 位乘法', 'ptr', -3.2, 6.9, -1.4); tag('精確：位數 1, 2, 4, …, d', 'ptr alt', 3.4, 6.2, 1.4);
    say('除法要 log d 次 Newton 迭代，每次一個乘法 Θ(n^α)', '這裡 α = log₂3（Karatsuba）');
    await beat(tok, 2600);
    let s1 = 0, s2 = 0;
    for (let q = 0; q < D.length; q++) {
      const b1 = bar(C.red, 0.7, 0.7, -5.4 + q * 0.85, -1.4); await growBar(tok, b1, 5.2, 120); s1 += mxv;
      const b2 = bar(C.green, 0.7, 0.7, 0.6 + q * 0.85, 1.4); await growBar(tok, b2, 0.06 + 5.2 * c(D[q]) / mxv, 160); s2 += c(D[q]);
      tag(D[q] + ' 位', 'idx', 0.6 + q * 0.85, 0, 2.2);
      await beat(tok, 300);
    }
    say('粗估：log d × d^α → O(n^α log n)（對，但不緊）', '');
    await beat(tok, 2400);
    say('精確：c·1^α + c·2^α + … + c·d^α < 2c·d^α', '等比級數：最後一項主導 → 除法 = Θ(n^α)');
    await beat(tok, 3200);
    say('開根號 → 呼叫除法 → 呼叫乘法：同樣論證', '√ 的複雜度 = 乘法的複雜度 Θ(n^α)');
    await beat(tok, 3200);
  }

  // ───────────────────────── 場景表 ─────────────────────────
  const scenes = {
    'dc-general': { title: 'Divide → Conquer → Combine：DAC(P)', play: scDCGeneral },
    'dc-same-kind': { title: '子問題必須是同一種問題', play: scDCSameKind },
    'maxmin-dc': { title: '課本：分治找最大最小 3n/2 − 2 次比較', play: scMaxMin },
    'bsearch-trace': { title: 'Binary search 追蹤：找 42、找 30', play: scBSearchTrace },
    'bsearch-tree': { title: 'Binary search 的比較樹：最多 log n 次', play: scBSearchTree },
    'merge-two-lists': { title: 'Merging：A、B 合成 C，Θ(m + n)', play: scMergeTwo },
    'merge-four-way': { title: '4-way merging：一次比 4 個開頭', play: scMergeFour },
    'merge-patterns': { title: '2-way merging 的不同合併模式', play: scMergePatterns },
    'two-way-mergesort': { title: 'Two-way merge sort：log n 個 pass', play: scTwoWayMS },
    'mergesort-topdown': { title: '課本：MERGE-SORT 遞迴版 T(n) = 2T(n/2) + Θ(n)', play: scMergeTopDown },
    'count-frequency-cost': { title: 'count_frequency 逐行成本：W·L·w̄', play: scCountFreq },
    'plus-vs-extend': { title: 'list + 改成 extend：O(W²) → O(W)', play: scPlusExtend },
    'sorted-inner-product': { title: '已排序向量內積：兩指標 O(L₁ + L₂)', play: scSortedInner },
    'quicksort-partition': { title: '課本：CLRS PARTITION（pivot = A[r]）', play: scPartition },
    'qs-best-tree': { title: 'Quicksort best case：切在中間 n log n', play: scQSBest },
    'qs-worst-sorted': { title: 'Quicksort worst case：已排序 n(n+1)/2', play: scQSWorst },
    'qs-pivot-choice': { title: '改用中間或隨機 pivot', play: scQSPivot },
    'qs-stack': { title: 'Quicksort 的 stack：log n ～ n', play: scQSStack },
    'select-mom': { title: '課本：Median of medians 線性時間選擇', play: scSelectMoM },
    'max-subarray': { title: '課本：Maximum subarray 分治（CLRS 4.1）', play: scMaxSub },
    'matmul-2x2': { title: '矩陣乘法：三層迴圈與 2×2 四個公式', play: scMatMul2 },
    'matmul-blocks': { title: '4×4 切成 2×2 區塊：8 次遞迴', play: scMatBlocks },
    'strassen-7': { title: 'Strassen：P、Q、R、S、T、U、V 七次乘法', play: scStrassen7 },
    'strassen-recurrence': { title: '8T(n/2) + n² = n³ vs 7T(n/2) + n² = n^2.81', play: scStrassenRec },
    'mult-recurrences': { title: '大數乘法：4、3（Karatsuba）、5（Toom-3）次', play: scMultRec },
    'karatsuba': { title: '課本：Karatsuba 三次乘法（1234 × 5678）', play: scKaratsuba },
    'log-star': { title: 'log* n：連續取 log 到 ≤ 1', play: scLogStar },
    'newton-sqrt-error': { title: 'Newton 求 √2：誤差每次平方', play: scNewtonSqrt },
    'newton-reciprocal': { title: 'Newton 求 R/b：2¹⁶/5 的迭代', play: scNewtonRecip },
    'newton-cost-geometric': { title: '精度加倍：除法成本 = 乘法成本', play: scNewtonCost },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ dcbari.js ═══
  {
// ─── Abdul Bari 分治系列（2Rr2tW9zvRg、C2apEw9pgtw、uEUXGcc2VXM、6pV2IF0fgKY、ak-pz7tS5DE、zXhWPrMLXGo、-qOVVRIZzao、0oJyNmEbS4w）＋ u7YMFRUFqe0 最大子陣列 ───
// Cued scenes: every `await step(tok)` waits for the sentence it shows; beats are motion only.
// 左下角的小幫手跟著反應：新概念時好奇、答案出來時開心、反例時難過。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, showL, code, line, arrow, ghostBox, lnode, buddy, travel, remove, anim, step, GOLD, GREEN, RED, GRAY } = K;
const { say, beat } = ctx;
const PC = { blue: '#4b9ee2', purple: '#9b7ef4', green: '#2fc092', orange: '#dd8238', pink: '#e55a9b', teal: '#31aab0', gold: '#c08a1f', red: '#d64545', sand: '#c9b48e', brown: '#6e5f49' };
const srt = (a) => a.slice().sort((p, q) => p - q);
const bubble = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const guide = (x = -6.2, z = 1.6, s = 0.7) => buddy('', '', '#ffc56b', x, 0, z, s);

// ═════════ 2Rr2tW9zvRg：Divide and Conquer 介紹 ═════════
// 0:00 解題策略
FRAG.push(['dcbari-strategies', '解題策略：divide and conquer 是其中一種', async (tok) => {
  fresh([0, 5, 13.5], [0, 2.4, 0]);
  const gd = guide(-6.2, 2.2);
  await step(tok);                                   // 0:00 新單元：divide and conquer
  note('上一單元：演算法分析', -3, 6.4);
  bubble('新單元：Divide and Conquer', 2.6, 6.4);
  gd.mood('wow');
  say('新單元：divide and conquer', '上一單元：怎麼寫、怎麼分析演算法');
  await step(tok);                                   // 0:24 它是一種策略，還有別的策略
  const S = ['Divide & Conquer', 'Greedy', 'Dynamic Programming', 'Backtracking', 'Branch & Bound'];
  const ms = S.map((s, i) => cube(s, i === 0 ? PC.orange : PC.blue, [2.3, 0.6, 1], -4.8 + i * 2.4, 0.3, 0, 3));
  gd.mood('calm');
  say('解題的策略不只一種', 'greedy、DP、backtracking、branch and bound');
  await step(tok);                                   // 0:45 strategy = 解題的設計方法
  glow(ms[0], GOLD); move(ms[0], -4.8, 2.4, 0);
  bubble('strategy = 解題的設計方法', -4.4, 3.5);
  say('strategy：解計算問題的一種設計方法', '');
  await step(tok);                                   // 1:00 策略適合問題才採用
  const p = cube('問題 P', PC.purple, [1.6, 0.6, 1], 2.4, 3.6, 0, 2);
  await beat(tok, 900);
  tint(p, PC.green); glow(p, GREEN); gd.mood('happy');
  say('策略適合這個問題，才採用它', '');
  await step(tok);                                   // 1:09 沒有公式，靠練習＋guideline
  note('沒有公式：靠練習＋幾條 guideline', 2.4, 5.2);
  await gd.hop(tok);
  say('哪個問題該用哪個策略？沒有公式', '靠練習，加上幾條 guideline');
}]);

// 1:18 大問題 → 子問題 → 子解 → 合併
FRAG.push(['dcbari-dc-idea', 'Divide → Conquer → Combine', async (tok) => {
  fresh([0, 5.5, 14], [0, 3, 0]);
  const gd = guide(-6.3, 2.2);
  const X = [-4.2, -1.4, 1.4, 4.2], nm = ['P₁', 'P₂', 'P₃', 'P_k'];
  await step(tok);                                   // 1:18 問題 P，大小 n
  cube('P（大小 n）', PC.blue, [4.2, 0.7, 1.2], 0, 6, 0, 2);
  note('n = 輸入的大小', 3.9, 6.9);
  say('一個問題 P，大小是 n', 'n 指的是輸入的大小');
  await step(tok);                                   // 1:32 太大 → 切成 k 個子問題
  const subs = X.map((x, i) => cube(nm[i], PC.blue, [1.6, 0.6, 1.1], x, 4.2, 0, 1.5));
  X.forEach((x) => line(0, 5.65, x, 4.55));
  tag('…', 'val', 2.8, 4.2);
  gd.mood('wow');
  say('P 太大 → 切成 k 個較小的子問題', 'Divide：切幾個由你決定');
  await step(tok);                                   // 2:07 各自解出 S₁…S_k
  const sol = X.map((x, i) => { line(x, 3.9, x, 2.75); return cube(nm[i].replace('P', 'S'), PC.green, [1.6, 0.6, 1.1], x, 2.4, 0, 1.2); });
  gd.mood('calm');
  say('每個子問題各自解出 S₁、S₂、…、S_k', 'Conquer');
  await step(tok);                                   // 2:24 combine 成原問題的解
  sol.forEach((m) => move(m, 0, 0.6, 0)); await beat(tok, 800); sol.forEach(kill);
  const S = cube('S（原問題的解）', PC.green, [4.2, 0.7, 1.2], 0, 0.6, 0); glow(S, GREEN);
  gd.mood('happy');
  say('把子問題的解 combine 起來 → 原問題的解', 'Combine');
  await step(tok);                                   // 2:44 子問題還太大 → 再套用一次
  glow(subs[2], GOLD);
  [0.9, 1.9].forEach((x, i) => { cube('P₃' + (i + 1), PC.purple, [0.85, 0.45, 0.9], x, 3.2, 1.4, 1.2); line(1.4, 3.9, x, 3.45, 1.4); });
  bubble('還太大？再 divide and conquer', 4.3, 3.2);
  gd.mood('wow');
  say('子問題還太大 → 對它再套用 divide and conquer', '切成子子問題，解完再合併');
}]);

// 3:11 子問題要同一種、要能合併
FRAG.push(['dcbari-same-kind', '子問題必須是同一種問題，而且要能合併', async (tok) => {
  fresh([0, 5, 14], [0, 2.6, 0]);
  const gd = guide(-6.3, 2.4);
  await step(tok);                                   // 3:11 排序 → 子問題也是排序
  const L = cube('sort 8 個數', PC.blue, [3.4, 0.7, 1.2], -3.4, 5.6, 0, 2);
  const l2 = [0, 1].map((i) => cube('sort 4 個數', PC.blue, [1.8, 0.6, 1.1], -4.4 + i * 2, 4, 0, 1.5));
  const l3 = [0, 1, 2, 3].map((i) => cube('sort 2', PC.blue, [0.9, 0.5, 1], -4.9 + i * 1, 2.6, 0, 1.5));
  say('子問題要和原問題是同一種問題', '原問題是排序 → 子問題也必須是排序');
  await step(tok);                                   // 3:30 反例：辦研討會
  cube('辦研討會', PC.orange, [3.4, 0.7, 1.2], 3.4, 5.6, 0, 2);
  const rs = ['邀請函', '海報', '邀講者'].map((s, i) => cube(s, [PC.pink, PC.teal, PC.gold][i], [1.5, 0.6, 1.1], 1.8 + i * 1.6, 4, 0, 1.5));
  say('例子：在大學辦一場研討會', '拆成：做邀請函、做海報、邀請講者');
  await step(tok);                                   // 3:57 每項都是不同工作 → 不是
  rs.forEach((m) => glow(m, RED)); bad('不是 divide and conquer', 3.4, 2.6);
  gd.mood('sad');
  say('每一項都是不同的工作', '不是 divide and conquer');
  await step(tok);                                   // 4:16 同一種問題 → 天生遞迴
  [...l2, ...l3].forEach((m) => glow(m, GOLD));
  bubble('同一種問題 → 用同一個演算法 → 遞迴', -3.4, 1.4);
  gd.mood('wow');
  say('子問題跟原問題一樣 → 天生就是遞迴的', '');
  await step(tok);                                   // 4:40 要有方法 combine
  [...l2, ...l3].forEach((m) => glow(m, null));
  l3.forEach((m) => tint(m, PC.green)); await beat(tok, 500);
  l2.forEach((m) => tint(m, PC.green)); await beat(tok, 500);
  tint(L, PC.green); glow(L, GREEN);
  say('還要有方法把子問題的解 combine 回去', '排好的兩半 → 合併成排好的整體');
  await step(tok);                                   // 4:45 不能合併就不能用：這就是 guideline
  good('guideline：① 同一種問題　② 能合併', 0, 0.5, 1.6);
  gd.mood('happy'); await gd.hop(tok);
  say('沒辦法合併就不能用這個策略', '這兩點就是判斷能不能用的 guideline');
}]);

// 5:11 一般方法 DAC(P)
FRAG.push(['dcbari-dac-code', 'Algorithm DAC(P)：一般方法', async (tok) => {
  fresh([0, 5.5, 14.5], [0, 3, 0]);
  const gd = guide(-6.3, 2.6);
  const cd = code(['Algorithm DAC(P) {', '  if (small(P))', '    return S(P);', '  else {', '    divide P into P1, P2, …, Pk;', '    apply DAC to P1, P2, …, Pk;', '    return combine(DAC(P1), …, DAC(Pk));', '  }', '}'], -0.6, 7.3, 0.46);
  await step(tok);                                   // 5:11 一般方法
  cd.hl(0);
  say('Divide and conquer 的一般寫法', 'Algorithm DAC(P)');
  await step(tok);                                   // 5:17 小問題直接解
  cd.hl(2);
  const sp = cube('小的 P', PC.green, [1.4, 0.5, 1], -4.6, 0.3, 0, 1.5);
  pkt('直接解 → S(P)', -4.6, 1.2);
  say('if small(P)：問題夠小就直接解', '小問題一定要有直接的解法');
  await step(tok);                                   // 5:33 大 → 切、對每個呼叫 DAC
  cd.hl(4);
  const bp = cube('大的 P', PC.blue, [3, 0.5, 1], 2.4, 2.2, 0, 1.5);
  await beat(tok, 700);
  cd.hl(5);
  const ps = [1.2, 2.4, 3.6].map((x, i) => { line(2.4, 1.95, x, 0.55); return cube('P' + (i + 1), PC.blue, [0.9, 0.5, 0.9], x, 0.3, 0, 1.2); });
  gd.mood('wow');
  say('否則切成 P1…Pk，對每一個再呼叫 DAC', '這裡就是遞迴');
  await step(tok);                                   // 5:45 combine
  cd.hl(6);
  ps.forEach((m) => tint(m, PC.green)); await beat(tok, 500);
  ps.forEach((m) => { relabel(m, ''); move(m, 2.4, 2.2, 0); }); await beat(tok, 700); ps.forEach(kill); // names off while they merge into P
  tint(bp, PC.green); relabel(bp, 'S（原問題的解）'); glow(bp, GREEN);
  gd.mood('happy');
  say('return combine(DAC(P1), …, DAC(Pk))', '把各個子解合起來');
  await step(tok);                                   // 6:00 遞迴性質
  cd.hl(5);
  bubble('DAC 呼叫 DAC → 遞迴', 4.2, 3.3);
  say('程序是遞迴的，演算法也是遞迴的', '');
  await step(tok);                                   // 6:05 本單元的題目
  kill(sp); kill(bp); cd.hl(-1);
  const T = ['binary search', 'max & min', 'merge sort', 'quick sort', 'Strassen'];
  T.forEach((s, i) => cube(s, PC.orange, [2.1, 0.5, 1], -4.4 + i * 2.2, 0.3, 1.6, 2));
  gd.mood('wow');
  say('這個單元的題目', 'binary search、找最大最小、merge sort、quick sort、Strassen 矩陣乘法');
  await step(tok);                                   // 6:32 遞迴要用 recurrence relation 分析
  note('遞迴演算法的時間 → recurrence relation', 0, 1.6, 1.6);
  gd.mood('calm');
  say('遞迴演算法的時間要用 recurrence relation 分析', '下一支影片開始講');
}]);

// ═════════ C2apEw9pgtw：Binary search（迭代版） ═════════
const BSA = [3, 6, 8, 12, 14, 17, 25, 29, 31, 36, 42, 47, 53, 55, 62];
const bsx = (i) => -6.3 + (i - 1) * 0.9;            // index 1..15
function bsRow(z = 0, drop = 0) { return BSA.map((v, i) => { tag(String(i + 1), 'idx', bsx(i + 1), 0, z + 0.85); return cube(v, PC.blue, [0.8, 0.6, 0.8], bsx(i + 1), 0.3, z, drop); }); }

// 0:01 前提：已排序、low 和 high
FRAG.push(['dcbari-bs-intro', 'Binary search 的前提與 low、high', async (tok) => {
  fresh([0, 6, 13.5], [0, 1.4, 0]);
  const gd = guide(-6.3, 2.9);
  await step(tok);                                   // 0:01 搜尋的兩種方法
  bubble('linear search：從頭一個一個比', -3, 5.4);
  const bn = bubble('binary search', 3, 5.4);
  say('搜尋有兩種方法', 'linear search 與 binary search');
  await step(tok);                                   // 0:14 binary search 用 divide and conquer
  txt(bn, 'binary search：divide and conquer');
  gd.mood('wow');
  say('Binary search 採用 divide and conquer', '問題大就切小、解小的、再合併');
  await step(tok);                                   // 0:33 15 個元素
  const cs = bsRow(0, 1.5);
  gd.mood('calm');
  say('一串 15 個元素，索引 1～15', '');
  await step(tok);                                   // 0:44 一定要先排序
  await anim(tok, 1200, (u) => cs.forEach((m, i) => glow(m, i < u * 15 ? GREEN : null)));
  good('由小到大排好了（prerequisite）', 0, 2.3);
  say('前提：串列一定要先排好序', '沒排序就不能用 binary search');
  await step(tok);                                   // 1:08 兩個索引 low、high
  cs.forEach((m) => glow(m, null));
  const lp = tag('low', 'ptr', bsx(1), 2.4, 1.6), hp = tag('high', 'ptr', bsx(15), 2.4, 1.6);
  await Promise.all([travel(tok, lp, V3(bsx(1), 2.4, 1.6), V3(bsx(1), 0, 1.6), 700), travel(tok, hp, V3(bsx(15), 2.4, 1.6), V3(bsx(15), 0, 1.6), 700)]);
  gd.mood('happy');
  say('需要兩個索引：low 在開頭、high 在結尾', 'low = 1、high = 15');
}]);

// 1:23 起 追蹤：key = 42 / 12 / 30（params.key）
//   開頭 1 步；每一輪：算 mid 1 步、比大小 1 步、移動 low/high 1 步；找到時：算 mid＋找到 2 步；
//   low > high：1 步；最後總結 1 步。
FRAG.push(['dcbari-bs-trace', 'Binary search 追蹤：mid、往左或往右', async (tok) => {
  const key = (ctx.params || {}).key ?? 42;
  fresh([0, 6, 13.5], [0, 1.4, 0]);
  const gd = guide(-6.3, 2.9);
  const cs = bsRow();
  const lp = tag('low', 'ptr', bsx(1), 0, 1.6), hp = tag('high', 'ptr', bsx(15), 0, 2.2), mp = tag('mid', 'ptr alt', bsx(8), 1.3);
  showL(mp, false);
  const cnt = tag('比較 0 次', 'ptr alt', 4.6, 5.6);
  await step(tok);                                   // 開頭：要找的 key
  const kb = pkt('key = ' + key, -4.4, 6.4);
  await travel(tok, kb, V3(-4.4, 6.4, 0), V3(-4.4, 5.6, 0), 600);
  say('要找 key = ' + key, key === 30 ? '30 不在串列裡（29 後面就是 31）' : key === 12 ? 'linear search 要比 4 次' : '42 就在串列裡');
  let l = 1, h = 15, c = 0;
  while (true) {
    if (l > h) {
      await step(tok);                               // low 越過 high
      cs.forEach((m) => glow(m, null));
      bad('low = ' + l + ' > high = ' + h, bsx(l) - 0.4, 2.6);
      gd.mood('sad');
      say('low = ' + l + ' 跑到 high = ' + h + ' 的右邊了', 'low 越過 high');
      break;
    }
    const m = (l + h) >> 1, v = BSA[m - 1]; c++;
    await step(tok);                                 // 算 mid
    showL(mp, true); move(mp, bsx(m), 1.3, 0); glow(cs[m - 1], GOLD);
    txt(cnt, '比較 ' + c + ' 次'); gd.mood('calm');
    say('mid = ⌊(' + l + ' + ' + h + ') / 2⌋ = ' + m, 'A[' + m + '] = ' + v);
    if (v === key) {
      await step(tok);                               // 找到
      tint(cs[m - 1], PC.green); glow(cs[m - 1], GREEN);
      gd.mood('happy'); await gd.hop(tok);
      say('A[' + m + '] = ' + v + ' 就是 key：找到了！', '在索引 ' + m);
      break;
    }
    const right = key > v;
    await step(tok);                                 // 比大小：往哪一邊
    gd.look(right ? 1 : -1); gd.mood('wow');
    for (let i = right ? l : m; i <= (right ? m : h); i++) tint(cs[i - 1], GRAY);
    say(key + (right ? ' > ' : ' < ') + v + '：一定在' + (right ? '右' : '左') + '半邊', '串列已排序，另一半可以整個丟掉');
    await step(tok);                                 // 移動 low 或 high
    glow(cs[m - 1], null);
    if (right) { l = m + 1; move(lp, bsx(Math.min(l, 15.6)), 0, 1.6); say('low = mid + 1 = ' + l, 'high 還是 ' + h); }
    else { h = m - 1; move(hp, bsx(Math.max(h, 0.4)), 0, 2.2); say('high = mid − 1 = ' + h, 'low 還是 ' + l); }
  }
  await step(tok);                                   // 總結
  if (key === 42) { note('binary：4 次　linear：11 次', 0, 4.4); say('只比 4 次就找到索引 11', 'linear search 要比 11 次'); }
  else if (key === 12) { note('binary：2 次　linear：4 次', 0, 4.4); say('只比 2 次就找到', '比較次數比 linear search 少'); }
  else { note('low > high → 找不到', 0, 4.4); say('low 一越過 high，就代表 key 不在串列裡', '搜尋結束（找不到）'); }
  gd.mood(key === 30 ? 'calm' : 'happy');
}]);

// 9:49 迭代版演算法
FRAG.push(['dcbari-bs-code', 'BinSearch(A, n, key)：迭代版', async (tok) => {
  fresh([0, 6, 13.5], [0, 1.6, 0]);
  const gd = guide(-6.3, 2.9);
  const cs = bsRow();
  const cd = code(['int BinSearch(A, n, key) {', '  l = 1;  h = n;', '  while (l <= h) {', '    mid = (l + h) / 2;', '    if (key == A[mid])', '      return mid;', '    if (key < A[mid])', '      h = mid − 1;', '    else', '      l = mid + 1;', '  }', '  return 0;', '}'], 3.2, 7.2, 0.45);
  const lp = tag('l', 'ptr', bsx(1), 0, 1.6), hp = tag('h', 'ptr', bsx(15), 0, 2.2), mp = tag('mid', 'ptr alt', bsx(8), 1.3);
  [lp, hp, mp].forEach((p) => showL(p, false));
  await step(tok);                                   // 9:49 寫成函式：參數 A、n、key
  cd.hl(0);
  pkt('A：陣列', -4.6, 5.6); pkt('n = 15', -2.6, 5.6); pkt('key', -1.0, 5.6);
  say('寫成函式 BinSearch(A, n, key)', '傳入陣列、元素個數、key，回傳找到的索引');
  await step(tok);                                   // 10:22 l = 1、h = n
  cd.hl(1); showL(lp, true); showL(hp, true);
  say('l = 1、h = n', 'l、h 是整數變數');
  await step(tok);                                   // 10:42 mid
  cd.hl(3); showL(mp, true); glow(cs[7], GOLD);
  say('mid = (l + h) / 2', '例：(1 + 15) / 2 = 8');
  await step(tok);                                   // 10:57 相等就回傳 mid
  cd.hl(5); gd.mood('happy');
  bubble('key == A[mid] → 找到，return mid', -3.4, 4.4);
  say('if (key == A[mid]) return mid', '找到了，回傳它的索引');
  await step(tok);                                   // 11:23 key 較小 → h = mid − 1
  cd.hl(7); gd.mood('calm'); gd.look(-1);
  for (let i = 8; i <= 15; i++) tint(cs[i - 1], GRAY);
  move(hp, bsx(7), 0, 2.2);
  say('key < A[mid]：在左半邊 → h = mid − 1', '');
  await step(tok);                                   // 11:55 否則 l = mid + 1
  cd.hl(9); gd.look(1);
  for (let i = 1; i <= 15; i++) tint(cs[i - 1], i <= 8 ? GRAY : PC.blue);
  move(hp, bsx(15), 0, 2.2); move(lp, bsx(9), 0, 1.6);
  say('不相等也不小於 → 一定比較大', 'l = mid + 1');
  await step(tok);                                   // 12:10 一直重複 → 放進迴圈
  cd.hl(2); glow(cs[7], null);
  bubble('重複：算 mid → 比較 → 移 l 或 h', -3.4, 3.6);
  say('這個過程要一直重複，直到找到為止', '所以寫成一個迴圈');
  await step(tok);                                   // 12:24 迴圈條件 l ≤ h
  cd.hl(2); gd.mood('wow');
  say('while (l <= h)', 'l 不能越過 h');
  await step(tok);                                   // 12:48 越過就 return 0
  cd.hl(11);
  bad('l > h → return 0（找不到）', -3.4, 2.8);
  say('l 變得比 h 大，迴圈停止', 'return 0：表示找不到');
  await step(tok);                                   // 12:54 迭代版
  cd.hl(-1); gd.mood('happy');
  good('迭代版（iterative）：用 loop', 0, 0.5, 2.6);
  say('這就是 binary search 的迭代版演算法', '用迴圈重複，不用遞迴');
}]);

// 13:25 比較樹（params.part = 'build' | 'fail'）
FRAG.push(['dcbari-bs-tree', 'Binary search 的比較樹：最多 log n 次', async (tok) => {
  const part = (ctx.params || {}).part || 'build';
  fresh([0, 5, 14.5], [0, 3.2, 0]);
  const gd = guide(-6.4, 2.6);
  const nodes = {}, ms = {};
  const place = (l, h, d, x0, x1, par) => { if (l > h) return; const m = (l + h) >> 1; nodes[m] = { d, x: (x0 + x1) / 2, y: 6.4 - d * 1.6, par }; place(l, m - 1, d + 1, x0, (x0 + x1) / 2, m); place(m + 1, h, d + 1, (x0 + x1) / 2, x1, m); };
  place(1, 15, 0, -6.2, 5.6, 0);
  const add = (m, drop) => { const nd = nodes[m]; ms[m] = cube(m + ':' + BSA[m - 1], nd.d === 3 ? PC.purple : PC.blue, [0.78, 0.5, 0.7], nd.x, nd.y, 0, drop); if (nd.par) line(nodes[nd.par].x, nodes[nd.par].y - 0.3, nd.x, nd.y + 0.3); };
  const path = async (keys, col) => { for (const m of keys) { glow(ms[m], col); await beat(tok, 350); } };
  const clear = () => Object.values(ms).forEach((m) => glow(m, null));
  if (part === 'build') {
    const groups = [[8], [4, 12], [2], [6], [1, 3, 5, 7], [10, 9, 11], [14, 13, 15]];
    const caps = [['用一棵樹來追蹤 mid', '1～15 第一次的 mid 一定是 8'], ['比 8 小 → 1～7 的 mid = 4', '比 8 大 → 9～15 的 mid = 12'], ['1～3 的 mid = 2', ''], ['5～7 的 mid = 6', ''], ['2 的左右是 1、3；6 的左右是 5、7', ''], ['9～11 的 mid = 10，左右是 9、11', ''], ['13～15 的 mid = 14，左右是 13、15', '樹畫好了']];
    for (let g = 0; g < groups.length; g++) {
      await step(tok);                               // 13:25 8 · 13:45 4、12 · 14:01 2 · 14:07 6 · 14:13 1 3 5 7 · 14:28 10 9 11 · 14:42 14 13 15
      groups[g].forEach((m) => add(m, 1.5));
      if (g === 0 || g === 1 || g === 2 || g === 4) tag('第 ' + (nodes[groups[g][0]].d + 1) + ' 次比較', 'ptr alt', 6.7, 6.4 - nodes[groups[g][0]].d * 1.6);
      say(caps[g][0], caps[g][1]);
    }
    await step(tok);                                 // 14:52 找 29：1 次
    await path([8], GREEN); gd.mood('happy');
    say('找 29：在根，1 次比較就找到', '');
    await step(tok);                                 // 15:05 找 47：2 次
    clear(); await path([8, 12], GOLD); gd.mood('calm');
    say('找 47：8 → 12，2 次', '');
    await step(tok);                                 // 15:28 找 55：3 次
    clear(); await path([8, 12, 14], GOLD);
    say('找 55（索引 14）：8 → 12 → 14，3 次', '');
    await step(tok);                                 // 15:53 最多幾次？看樹高
    clear(); await path([8, 4, 6, 7], RED); gd.mood('wow');
    say('最多幾次？取決於樹的高度', '例：找索引 7 的 25 要 4 次');
    await step(tok);                                 // 16:19 1 → 2 → 4 → 8
    clear();
    [['1 個', 0], ['2 個', 1], ['4 個', 2], ['8 個', 3]].forEach(([s, d]) => note(s, -6.9, 6.4 - d * 1.6 + 0.5));
    say('每一層的節點數：1 → 2 → 4 → 8', '每往下一層就乘 2，共 4 層');
    await step(tok);                                 // 16:40 15 + 1 = 16 = 2⁴
    pkt('15 + 1 = 16 = 2⁴', 0, 0.2, 1.4);
    say('15 個元素約 16 個 = 2⁴', 'log₂16 = 4 → 最多 4 次比較');
    await step(tok);                                 // 16:56 時間 log n
    good('binary search 的時間：log n', 0, 0.2, 2.6);
    gd.mood('happy'); await gd.hop(tok);
    say('從這棵樹分析：binary search 花 log n 的時間', '');
    return;
  }
  // part 'fail'：樹已經畫好
  Object.keys(nodes).forEach((m) => add(Number(m), 0));
  await step(tok);                                   // 17:10 找不存在的 65
  pkt('key = 65（不存在）', -4.6, 7.2);
  await path([8, 12, 14, 15], GOLD);
  say('找 65：8 → 12 → 14 → 15', '65 比 62 還大');
  await step(tok);                                   // 17:23 再往右沒有元素 → 停
  const ex = (x, y) => { const b = cube('', '#e9dcc4', [0.42, 0.42, 0.42], x, y, 0, 0.8); return b; };
  const n15 = nodes[15], e1 = ex(n15.x + 0.35, n15.y - 1.2); line(n15.x, n15.y - 0.3, n15.x + 0.35, n15.y - 1.0);
  glow(e1, RED); gd.mood('sad');
  say('想再往右走，可是那裡沒有元素 → 停', '畫成一個方形的 external node');
  await step(tok);                                   // 17:30 55 和 62 之間的值也停在這
  for (const m of [1, 3, 5, 7, 9, 11, 13, 15]) {
    const nd = nodes[m];
    for (const dx of [-0.35, 0.35]) { if (m === 15 && dx > 0) continue; ex(nd.x + dx, nd.y - 1.2); line(nd.x, nd.y - 0.3, nd.x + dx, nd.y - 1.0); }
  }
  gd.mood('calm');
  say('介於 55 和 62 之間的值，停在 15 的左邊', '每個「不存在的範圍」都是一個 external node');
  await step(tok);                                   // 17:45 找不到也最多 4 次
  note('unsuccessful search：最多 4 次', 0, 7.2);
  say('不成功的搜尋：1、2、3、4 次就停', '最多也是 4 次比較');
  await step(tok);                                   // 17:57 最少 1 次：O(1)
  clear(); await path([8], GREEN); gd.mood('happy');
  say('最少：key 剛好在正中間（29）', '1 次比較 → O(1)');
  await step(tok);                                   // 18:08 最多：樹高 log n
  clear(); await path([8, 12, 14, 13], RED); gd.mood('wow');
  say('最多：取決於樹高 = log n', 'O(log n)');
  await step(tok);                                   // 18:20 best / worst
  clear();
  good('best：在中間 → O(1)', -2.6, 0.2, 2.2); bad('worst：在葉子 → O(log n)', 2.6, 0.2, 2.2);
  say('best case：key 在正中間，O(1)', 'worst case：key 在葉子，O(log n)');
  await step(tok);                                   // 18:59 average：全部加起來除以 n
  gd.mood('calm');
  say('average：每個元素的比較次數加起來，再除以 n', '');
  await step(tok);                                   // 19:10 1、2、2、3、3、3、3、4……
  [['1 個 × 1 次', 0], ['2 個 × 2 次', 1], ['4 個 × 3 次', 2], ['8 個 × 4 次', 3]].forEach(([s, d]) => note(s, -6.6, 6.4 - d * 1.6 + 0.5));
  say('第 1 層 1 次、第 2 層 2 次、第 3 層 3 次、葉子 4 次', '');
  await step(tok);                                   // 19:21 average 也是 log n
  pkt('best 1　worst log n　average log n', 0, 7.9, 0);
  gd.mood('happy'); await gd.hop(tok);
  say('average 也是 O(log n)', 'best O(1)、worst O(log n)、average O(log n)');
}]);

// ═════════ uEUXGcc2VXM：遞迴版 binary search ═════════
const RBS_CODE = ['Algorithm RBinSearch(l, h, key) {', '  if (l == h) {', '    if (A[l] == key) return l;', '    else return 0;', '  } else {', '    mid = (l + h) / 2;', '    if (key == A[mid]) return mid;', '    if (key < A[mid])', '      return RBinSearch(l, mid−1, key);', '    else', '      return RBinSearch(mid+1, h, key);', '  }', '}'];
const rbx = (i) => -6.4 + (i - 1) * 0.62;          // small array on the left, index 1..15
function rbRow() { return BSA.map((v, i) => cube(v, PC.blue, [0.55, 0.45, 0.55], rbx(i + 1), 0.25, 1.4)); }

// 0:00 small problem：只剩一個元素
FRAG.push(['dcbari-rbs-small', 'RBinSearch：先定義 small problem', async (tok) => {
  fresh([0, 6, 14], [0, 2.6, 0]);
  const gd = guide(-6.3, 3.2);
  const cd = code(RBS_CODE, 2.6, 7.2, 0.44);
  const cs = rbRow();
  await step(tok);                                   // 0:00 寫成遞迴演算法
  bubble('binary search → 寫成遞迴', -3.4, 5.8);
  say('Binary search 是 divide and conquer', '來寫它的遞迴版');
  await step(tok);                                   // 0:12 參數 l、h、key
  cd.hl(0);
  tag('l', 'ptr', rbx(1), 0.9, 2.2); tag('h', 'ptr', rbx(15), 0.9, 2.2);
  say('RBinSearch(l, h, key)', '參數：low、high、要找的 key');
  await step(tok);                                   // 0:31 large 要切，但要先說什麼是 small
  note('15 個 → large', -3.6, 4.4);
  gd.mood('wow');
  say('問題大就切成子問題', '但要先定義：什麼叫 small problem？');
  await step(tok);                                   // 0:56 只剩一個元素 → small；l == h
  cd.hl(1);
  cs.forEach((m, i) => { if (i !== 10) tint(m, GRAY); });
  glow(cs[10], GOLD);
  note('只剩 1 個 → small（l == h）', -3.6, 3.4);
  gd.mood('calm');
  say('只剩一個元素就是 small problem', 'l == h 表示只有一個元素');
  await step(tok);                                   // 1:08 那一個就是 key → return l
  cd.hl(2);
  tint(cs[10], PC.green); glow(cs[10], GREEN);
  gd.mood('happy');
  say('if (A[l] == key) return l', '那一個就是 key：搜尋成功，回傳索引 l');
  await step(tok);                                   // 1:38 不是 key → return 0
  cd.hl(3);
  tint(cs[10], PC.red); glow(cs[10], RED);
  gd.mood('sad');
  say('不是 key 就 return 0', '0 表示找不到');
}]);

// 2:09 large problem：算 mid、遞迴其中一半
FRAG.push(['dcbari-rbs-large', 'RBinSearch：算 mid、遞迴其中一半', async (tok) => {
  fresh([0, 6, 14], [0, 2.6, 0]);
  const gd = guide(-6.3, 3.2);
  const cd = code(RBS_CODE, 2.6, 7.2, 0.44);
  const cs = rbRow();
  const lp = tag('l', 'ptr', rbx(1), 0.9, 2.2), hp = tag('h', 'ptr', rbx(15), 0.9, 2.2);
  await step(tok);                                   // 2:09 else：照常算 mid
  cd.hl(5);
  const mp = tag('mid', 'ptr alt', rbx(8), 1.2, 1.4); glow(cs[7], GOLD);
  say('large：照常算 mid = (l + h) / 2', '');
  await step(tok);                                   // 2:17 mid 就是 key → return mid
  cd.hl(6); gd.mood('happy');
  bubble('A[mid] == key → return mid', -3.6, 4.6);
  say('if (key == A[mid]) return mid', '中間那個就是 key');
  await step(tok);                                   // 2:45 key 較小 → 左半
  cd.hl(7); gd.mood('wow'); gd.look(-1);
  say('否則看 key 比較小還是比較大', 'key < A[mid] → 在左半邊');
  await step(tok);                                   // 2:56 遞迴左半：l ～ mid − 1
  cd.hl(8);
  for (let i = 8; i <= 15; i++) tint(cs[i - 1], GRAY);
  move(hp, rbx(7), 0.9, 2.2);
  const gl = ghostBox(PC.blue, 7 * 0.62, 0.7, 0.8); gl.position.set((rbx(1) + rbx(7)) / 2, 0.25, 1.4);
  say('return RBinSearch(l, mid − 1, key)', '對左半邊遞迴做 binary search');
  await step(tok);                                   // 3:28 否則一定比較大 → 右半
  cd.hl(10); gd.look(1);
  kill(gl);
  for (let i = 1; i <= 15; i++) tint(cs[i - 1], i <= 8 ? GRAY : PC.blue);
  move(hp, rbx(15), 0.9, 2.2); move(lp, rbx(9), 0.9, 2.2);
  const gr = ghostBox(PC.purple, 7 * 0.62, 0.7, 0.8); gr.position.set((rbx(9) + rbx(15)) / 2, 0.25, 1.4);
  say('不相等、也不比較小 → 一定比較大', 'return RBinSearch(mid + 1, h, key)');
  await step(tok);                                   // 4:10 遞迴的 divide and conquer 演算法
  cd.hl(-1); kill(mp); glow(cs[7], null);
  good('遞迴版 binary search 完成', -3.6, 4.6);
  gd.mood('happy'); await gd.hop(tok);
  say('這就是 binary search 的遞迴演算法', 'divide and conquer：每次只留一半');
}]);

// 4:19 recurrence（params.part = 'rec' | 'master'）
FRAG.push(['dcbari-rbs-rec', 'T(n) = T(n/2) + 1 → Θ(log n)', async (tok) => {
  const part = (ctx.params || {}).part || 'rec';
  fresh([0, 5.5, 14], [0, 3, 0]);
  const gd = guide(-6.3, 2.6);
  const sm = cube('small：n = 1', PC.green, [3.2, 0.6, 1], -3.4, 5.6, 0), lg = cube('large：n > 1', PC.blue, [3.2, 0.6, 1], 2.4, 5.6, 0);
  const eq1 = tag('T(n) = 1　　　　 , n = 1', '', 0, 2.4), eq2 = tag('T(n) = T(n/2) + 1 , n > 1', '', 0, 1.6);
  [eq1, eq2].forEach((l) => { Object.assign(l.element.style, { whiteSpace: 'pre', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '13px', fontWeight: '700' }); });
  if (part === 'rec') {
    [sm, lg].forEach((m) => { m.visible = false; }); showL(eq1, false); showL(eq2, false);
    await step(tok);                                 // 4:19 時間用 recurrence relation
    bubble('divide and conquer 的時間 → recurrence relation', 0, 7.2);
    say('分治演算法的時間，用 recurrence relation 求', '');
    await step(tok);                                 // 4:31 演算法花 T(n)
    pkt('RBinSearch 花 T(n)', 0, 6.6);
    [sm, lg].forEach((m) => { m.visible = true; });
    say('假設這個演算法花 T(n) 的時間', '分成 small 和 large 兩種情況');
    await step(tok);                                 // 4:42 算 mid、最多兩個條件 → 常數
    glow(lg, GOLD);
    note('算 mid＋最多 2 個 if → 常數，記成 1', 2.4, 4.4);
    say('large：算 mid，最多檢查兩個條件', '都是常數時間');
    await step(tok);                                 // 4:56 呼叫一半 → T(n/2)
    note('左或右呼叫一次 → T(n/2)', 2.4, 3.6);
    gd.mood('wow');
    say('再對一半呼叫自己（左或右其中一個）', '規模減半 → T(n/2)');
    await step(tok);                                 // 5:12 small：一次比較
    glow(lg, null); glow(sm, GOLD);
    note('只比 1 次', -3.4, 4.4);
    gd.mood('calm');
    say('small（只有一個元素）：只做一次比較', '');
    await step(tok);                                 // 5:33 T(n) = 1, n = 1
    showL(eq1, true); glow(sm, null);
    say('T(n) = 1，當 n = 1', '');
    await step(tok);                                 // 5:42 T(n) = T(n/2) + 1, n > 1
    showL(eq2, true);
    say('T(n) = T(n/2) + 1，當 n > 1', '常數寫成 1');
    await step(tok);                                 // 6:02 只呼叫一次，不是兩邊都呼叫
    const one = cube('n', PC.blue, [0.9, 0.5, 0.8], -4.6, 0.3, 2.2);
    const half = cube('n/2', PC.green, [0.9, 0.5, 0.8], -3.2, 0.3, 2.2);
    const other = cube('n/2', PC.red, [0.9, 0.5, 0.8], -1.8, 0.3, 2.2); glow(other, RED);
    bad('不會兩邊都呼叫', -1.8, 1.0, 2.2);
    gd.mood('happy');
    say('只呼叫一次：左邊或右邊，不是兩邊都要', '所以只有一個 T(n/2)，不是 2T(n/2)');
    return;
  }
  // part 'master'
  glow(sm, null);
  await step(tok);                                   // 6:10 之前的影片解過
  note('之前的影片解過這個式子', 0, 4.2);
  say('這個 recurrence 你已經看過了', '可以用之前的方法解，也可以用 master theorem');
  await step(tok);                                   // 6:29 master theorem：a = 1、b = 2
  pkt('a = 1', -3, 0.4, 1.6); pkt('b = 2', -1, 0.4, 1.6); pkt('f(n) = 1 = n⁰', 1.6, 0.4, 1.6);
  gd.mood('wow');
  say('套 master theorem：a = 1、b = 2', 'f(n) = 1');
  await step(tok);                                   // 6:45 log₂1 = 0 = k
  note('log₂1 = 0　k = 0　兩者相等', 0, 3.4);
  say('log_b a = log₂1 = 0，f(n) = n⁰ → k = 0', '兩個都是 0 → Θ(n⁰ log n)');
  await step(tok);                                   // 6:57 Θ(log n)
  good('Θ(log n)', 4.4, 2.4);
  gd.mood('happy'); await gd.hop(tok);
  say('時間複雜度 = Θ(log n)', '遞迴版一樣是 log n');
}]);

// ═════════ 6pV2IF0fgKY：Merging 與 two-way merge sort ═════════
const MG_A = [2, 8, 15, 18], MG_B = [5, 9, 12, 17];
const mgAx = (i) => -5.2 + i * 1.1, mgCx = (k) => -1.2 + k * 0.95;
// two sorted lists A (z −1.6), B (z 1.6) and the empty list C (z 0)
function mgSetup() {
  const ca = MG_A.map((v, i) => cube(v, PC.blue, [0.9, 0.6, 0.9], mgAx(i), 0.3, -1.6));
  const cb = MG_B.map((v, i) => cube(v, PC.purple, [0.9, 0.6, 0.9], mgAx(i), 0.3, 1.6));
  return { ca, cb };
}

// 0:00 merging：A、B → C
FRAG.push(['dcbari-merge2', 'Merging：兩個已排序串列合成一個', async (tok) => {
  fresh([0, 6, 14], [0, 2.2, 0]);
  const gd = guide(-6.3, 3.4);
  await step(tok);                                   // 0:00 要懂 merge sort，先懂 merging
  note('merge sort 之前，先懂 merging', 0, 6.4);
  say('主題是 merge sort', '先來看什麼是 merging');
  await step(tok);                                   // 0:12 merging 的定義
  bubble('merging：兩個排好的串列 → 一個排好的串列', 0, 5.4);
  gd.mood('wow');
  say('Merging：把兩個已排序串列合成一個已排序串列', '');
  await step(tok);                                   // 0:19 兩個串列 A、B
  const { ca, cb } = mgSetup();
  tag('A', 'ptr', -6.4, 0.3, -1.6); tag('B', 'ptr', -6.4, 0.3, 1.6);
  gd.mood('calm');
  say('兩個串列 A、B，都已經排好序', '大小可以不一樣，這裡剛好一樣');
  await step(tok);                                   // 0:40 準備第三個串列 C
  for (let k = 0; k < 8; k++) ctx.tile(V3(mgCx(k), 0.04, 0), 0.85, 0.85);
  tag('C', 'ptr alt', -1.2, 2.7, 0);
  note('陣列或 linked list 都可以', 3.6, 3.6);
  say('準備第三個串列 C 放結果', '串列可以是陣列，也可以是 linked list');
  await step(tok);                                   // 1:00 指標 i、j、k
  const ip = tag('i', 'ptr', mgAx(0), 1.1, -1.6), jp = tag('j', 'ptr', mgAx(0), 1.1, 1.6), kp = tag('k', 'ptr alt', mgCx(0), 1.1, 0);
  say('每個串列一個索引：i、j、k', 'k 指著 C 第一個空位');
  let i = 0, j = 0, k = 0;
  for (let s = 0; s < 7; s++) {
    await step(tok);                                 // 1:21 2 · 1:36 5 · 1:52 8 · 2:14 9 · 2:19 12 · 2:24 15 · 2:33 17
    glow(ca[i], GOLD); glow(cb[j], GOLD);
    const fromA = MG_A[i] < MG_B[j], v = fromA ? MG_A[i] : MG_B[j];
    say('比 A[i] = ' + MG_A[i] + ' 和 B[j] = ' + MG_B[j], v + ' 比較小 → 複製到 C，' + (fromA ? 'i' : 'j') + ' 和 k 往前');
    await beat(tok, 700);
    glow(ca[i], null); glow(cb[j], null);
    if (fromA) { move(ca[i], mgCx(k), 0.3, 0); i++; move(ip, mgAx(i), 1.1, -1.6); }
    else { move(cb[j], mgCx(k), 0.3, 0); j++; move(jp, mgAx(j), 1.1, 1.6); }
    k++; move(kp, mgCx(k), 1.1, 0);
    gd.look(fromA ? -1 : 1);
  }
  await step(tok);                                   // 2:48 B 用完：剩下的 18 直接複製
  gd.look(0);
  move(ca[3], mgCx(7), 0.3, 0); move(kp, mgCx(7.6), 1.1, 0);
  say('j 跑出 B 了：B 用完', 'A 剩下的 18 直接複製過去');
  await step(tok);                                   // 3:07 得到排好的第三個串列
  [...ca, ...cb].forEach((m) => tint(m, PC.green));
  good('C：2 5 8 9 12 15 17 18', 2.2, 2.4);
  gd.mood('happy'); await gd.hop(tok);
  say('每次比較兩邊、拿小的 → 得到排好的串列', '這個過程就是 merging');
}]);

// 3:18 性質與時間 Θ(m + n)
FRAG.push(['dcbari-merge-time', 'Merging 的性質與時間 Θ(m + n)', async (tok) => {
  fresh([0, 6, 14], [0, 2.2, 0]);
  const gd = guide(-6.3, 3.4);
  const all = srt([...MG_A, ...MG_B]);
  MG_A.forEach((v, i) => cube(v, PC.blue, [0.9, 0.6, 0.9], mgAx(i), 0.3, -1.6));
  MG_B.forEach((v, i) => cube(v, PC.purple, [0.9, 0.6, 0.9], mgAx(i), 0.3, 1.6));
  tag('A', 'ptr', -6.4, 0.3, -1.6); tag('B', 'ptr', -6.4, 0.3, 1.6);
  for (let k = 0; k < 8; k++) ctx.tile(V3(mgCx(k), 0.04, 0), 0.85, 0.85);
  tag('C', 'ptr alt', -1.2, 2.7, 0);
  await step(tok);                                   // 3:18 兩個都排好 → 結果也排好
  const cc = all.map((v, k) => cube(v, PC.green, [0.85, 0.55, 0.85], mgCx(k), 0.3, 0, 1.2));
  good('輸入排好 → 結果也排好', 2.2, 2.6);
  gd.mood('happy');
  say('性質：兩個串列已排序 → 結果也是排序的', '');
  await step(tok);                                   // 3:34 A 有 m 個、B 有 n 個
  pkt('m 個', -2.2, 0.4, -1.6); pkt('n 個', -2.2, 0.4, 1.6);
  gd.mood('calm');
  say('A 有 m 個元素、B 有 n 個元素', '');
  await step(tok);                                   // 3:49 C 有 m + n 個，每個搬一次
  await anim(tok, 1600, (u) => cc.forEach((m, k) => glow(m, k < u * 8 ? GOLD : null)));
  pkt('m + n 個', mgCx(7) + 0.4, 1.2, 0);
  say('C 裡有 m + n 個元素', '每個元素只被比較、複製一次');
  await step(tok);                                   // 3:59 Θ(m + n)
  cc.forEach((m) => glow(m, null));
  good('merging 的時間：Θ(m + n)', 0, 5.6);
  gd.mood('wow');
  say('搬資料的時間 = Θ(m + n)', '');
  await step(tok);                                   // 4:06 Θ(m + n) 幾乎成了 merging 的代號
  note('看到 Θ(m + n) → 想到 merging', 0, 4.6);
  gd.mood('happy');
  say('一般時間都只用 n 表示，merging 卻寫 m + n', 'Θ(m + n) 幾乎成了 merging 的代號');
}]);

// 4:32 Algorithm Merge(A, B, m, n)
FRAG.push(['dcbari-merge-code', 'Algorithm Merge(A, B, m, n)', async (tok) => {
  fresh([0, 6, 14], [0, 2.4, 0]);
  const gd = guide(-6.4, 3.4);
  const ax = (i) => -5.6 + i * 0.85, cx = (k) => -5.6 + k * 0.78;
  const cd = code(['Algorithm Merge(A, B, m, n) {', '  i = 1;  j = 1;  k = 1;', '  while (i <= m && j <= n) {', '    if (A[i] < B[j])', '      C[k++] = A[i++];', '    else', '      C[k++] = B[j++];', '  }', '  for (; i <= m; i++)', '    C[k++] = A[i];', '  for (; j <= n; j++)', '    C[k++] = B[j];', '}'], 3.4, 7.3, 0.44);
  const ca = MG_A.map((v, i) => cube(v, PC.blue, [0.7, 0.5, 0.7], ax(i), 0.25, -1.8));
  const cb = MG_B.map((v, i) => cube(v, PC.purple, [0.7, 0.5, 0.7], ax(i), 0.25, 1.8));
  for (let k = 0; k < 8; k++) ctx.tile(V3(cx(k), 0.04, 0), 0.7, 0.7);
  tag('A', 'ptr', -6.6, 0.3, -1.8); tag('B', 'ptr', -6.6, 0.3, 1.8); tag('C', 'ptr alt', -6.6, 0.3, 0);
  let i = 0, j = 0, k = 0;
  let ip, jp, kp;
  const take = (fromA) => {
    if (fromA) { move(ca[i], cx(k), 0.25, 0); i++; move(ip, ax(i), 1.0, -1.8); }
    else { move(cb[j], cx(k), 0.25, 0); j++; move(jp, ax(j), 1.0, 1.8); }
    k++; move(kp, cx(k), 1.0, 0);
  };
  await step(tok);                                   // 4:33 Merge(A, B, m, n)
  cd.hl(0);
  say('Algorithm Merge(A, B, m, n)', '兩個串列 A、B，大小 m、n');
  await step(tok);                                   // 5:06 i、j、k 從 1 開始
  cd.hl(1);
  ip = tag('i', 'ptr', ax(0), 1.0, -1.8); jp = tag('j', 'ptr', ax(0), 1.0, 1.8); kp = tag('k', 'ptr alt', cx(0), 1.0, 0);
  note('索引從 1 開始（不是 C 的 0）', -3.4, 4.6);
  say('i、j、k 都放在開頭：i = j = k = 1', '為了簡單，索引從 1 開始');
  await step(tok);                                   // 5:34 A[i] 較小 → 複製 A[i]
  cd.hl(4); glow(ca[0], GOLD); glow(cb[0], GOLD);
  await beat(tok, 500); glow(ca[0], null); glow(cb[0], null); take(true);
  say('if (A[i] < B[j])：C[k++] = A[i++]', '複製 A[i]，i 和 k 都往前');
  await step(tok);                                   // 6:02 否則複製 B[j]
  cd.hl(6); glow(ca[1], GOLD); glow(cb[0], GOLD);
  await beat(tok, 500); glow(ca[1], null); glow(cb[0], null); take(false);
  say('else：C[k++] = B[j++]', 'B[j] 比較小，就複製 B[j]');
  await step(tok);                                   // 6:20 一直做，條件 i ≤ m && j ≤ n
  cd.hl(2);
  while (i < 4 && j < 4) { take(MG_A[i] < MG_B[j]); await beat(tok, 380); }
  say('while (i <= m && j <= n)', '兩邊都還有元素時，一直比、一直複製');
  await step(tok);                                   // 6:45 迴圈結束：一定有一邊剩下
  cd.hl(7); glow(ca[3], GOLD);
  gd.mood('wow');
  say('迴圈結束時，有一個串列還剩元素', '這個例子：A 剩下 18');
  await step(tok);                                   // 7:06 假如 A 剩 18 19 25
  const n1 = note('如果 A 剩：18 19 25 → 從 i 開始全抄', -3.4, 4.6);
  say('不知道會剩在哪一邊', '假如 A 還剩 18、19、25，i 指著的地方開始全部複製');
  await step(tok);                                   // 7:23 或 B 剩 19 25 30
  remove(n1); note('如果 B 剩：19 25 30 → 從 j 開始全抄', -3.4, 4.6);
  gd.mood('calm');
  say('也可能是 B 剩下 19、25、30', '那就從 j 指著的地方開始複製');
  await step(tok);                                   // 7:38 for：A 剩下的
  cd.hl(9); glow(ca[3], null); take(true);
  say('for (; i <= m; i++) C[k++] = A[i]', 'i 不重設，從原本的位置繼續抄');
  await step(tok);                                   // 7:57 for：B 剩下的
  cd.hl(11);
  say('for (; j <= n; j++) C[k++] = B[j]', '這次 B 沒有剩，迴圈一次都不做');
  await step(tok);                                   // 8:12 總結
  cd.hl(-1);
  [...ca, ...cb].forEach((m) => tint(m, PC.green));
  gd.mood('happy'); await gd.hop(tok);
  say('while：比較並複製；兩個 for：抄剩下的', '這就是 merging');
}]);

// 8:43 m-way merging
const M4 = [[3, 4, 6], [5, 9, 12], [8, 10, 16], [2, 4, 18]];
FRAG.push(['dcbari-merge4', 'm-way merging：一次比 4 個開頭', async (tok) => {
  fresh([0, 6.5, 13.5], [0, 1.6, 0]);
  const gd = guide(-6.4, 2.4);
  const cols = [PC.blue, PC.purple, PC.teal, PC.orange], lx = (q) => -5.4 + q * 1.4;
  const ox = (k) => 0.6 + (k % 6) * 1.05, oz = (k) => (k < 6 ? -1.2 : 0.2);
  const head = [0, 0, 0, 0];
  let out = 0;
  const ms = [];
  const takeMin = async (ms0 = 450) => {
    let best = -1;
    for (let q = 0; q < 4; q++) if (head[q] < 3) { glow(ms[q][head[q]], GOLD); if (best < 0 || M4[q][head[q]] < M4[best][head[best]]) best = q; }
    await beat(tok, ms0);
    for (let q = 0; q < 4; q++) if (head[q] < 3) glow(ms[q][head[q]], null);
    move(ms[best][head[best]], ox(out), 0.25, oz(out)); head[best]++; out++;
    return best;
  };
  await step(tok);                                   // 8:43 多於兩個串列
  M4.forEach((L, q) => { ms.push(L.map((v, r) => cube(v, cols[q], [0.9, 0.5, 0.9], lx(q), 0.25, -2.2 + r * 1.1, 1.5))); tag('L' + (q + 1), 'ptr', lx(q), 0.3, -3.2); });
  tag('結果', 'ptr alt', 3.2, 0.3, -2.3);
  say('如果有兩個以上的串列呢？', '這裡有 4 個已排序串列');
  await step(tok);                                   // 8:49 比所有開頭：2 最小
  await takeMin();
  say('比每個串列的第一個：3、5、8、2', '2 最小 → 放進結果');
  await step(tok);                                   // 9:05 下一個：3
  await takeMin();
  say('L4 往下一個；再比：3、5、8、4', '3 最小');
  await step(tok);                                   // 9:10 兩個 4：先拿第一個
  await takeMin();
  gd.mood('wow');
  say('4、5、8、4：兩個 4 一樣小', '先拿第一個（L1 的 4）');
  await step(tok);                                   // 9:23 6、5、8、4
  await takeMin();
  gd.mood('calm');
  say('再比 6、5、8、4', '4 最小');
  await step(tok);                                   // 9:33 一次合併好幾個串列
  while (out < 12) { await takeMin(220); }
  say('每次從每個串列拿一個來比，取最小的', '同時合併好幾個串列');
  await step(tok);                                   // 9:50 4-way → m-way merging
  good('4 個串列 → 4-way merging；m 個 → m-way merging', 0, 4.4);
  gd.mood('happy'); await gd.hop(tok);
  say('一次合併 4 個串列叫 4-way merging', 'm 個串列就叫 m-way merging');
}]);

// 10:18 2-way merging 與 merge pattern
FRAG.push(['dcbari-mpatterns', '2-way merging 與不同的 merge pattern', async (tok) => {
  fresh([0, 5.5, 14], [0, 2.8, 0]);
  const gd = guide(-6.4, 2.4);
  const mk = (x0, title) => { tag(title, 'ptr', x0, 7.2); return M4.map((L, q) => ({ v: L.slice(), x: x0 - 2.4 + q * 1.6, y: 0.25, m: cube(L.join(','), PC.blue, [1.4, 0.5, 0.9], x0 - 2.4 + q * 1.6, 0.25, 0, 1.5) })); };
  const merge = (items, a, b) => {
    const A = items[a], B = items[b], v = srt([...A.v, ...B.v]), x = (A.x + B.x) / 2, y = Math.max(A.y, B.y) + 1.6;
    line(A.x, A.y + 0.3, x, y - 0.3); line(B.x, B.y + 0.3, x, y - 0.3);
    items.push({ v, x, y, m: cube(v.join(' '), v.length === 12 ? PC.green : PC.purple, [Math.min(4.6, 0.3 * v.length + 0.6), 0.5, 0.9], x, y, 0, 1.2) });
  };
  await step(tok);                                   // 10:20 一次只合併兩個 → 2-way
  bubble('一次只合併兩個串列 = 2-way merging', 0, 6.4);
  say('一次只合併兩個串列：two-way merging', '最常用的就是這種');
  const L = mk(-3.4, '兩兩配對');
  await step(tok);                                   // 10:38 L1 + L2
  merge(L, 0, 1);
  say('先合併前兩個：3 4 5 6 9 12', '');
  await step(tok);                                   // 10:52 L3 + L4
  merge(L, 2, 3);
  say('再合併後兩個：2 4 8 10 16 18', '');
  await step(tok);                                   // 11:01 兩個再合併：共 3 次
  merge(L, 4, 5);
  gd.mood('happy');
  say('剩兩個再合併成一個', '4 個串列 → 共 merge 3 次');
  const R = mk(3.4, '一個接一個');
  await step(tok);                                   // 11:26 另一種：A + B
  merge(R, 0, 1); gd.mood('wow');
  say('另一種做法：A、B 先合併成第一個', '');
  await step(tok);                                   // 11:31 再跟 C
  merge(R, 4, 2);
  say('結果再跟 C 合併', '');
  await step(tok);                                   // 11:36 再跟 D
  merge(R, 5, 3);
  say('再跟 D 合併：一樣 3 次', '');
  await step(tok);                                   // 11:49 選擇很多：A 和 D、A 和 C 也行
  note('也可以先 A＋D、或 A＋C……', 0, 0.2, 1.8);
  gd.mood('calm');
  say('還有很多種選擇', '例如先合併 A 和 D，或 A 和 C');
  await step(tok);                                   // 12:10 多個串列可以有不同的 merge pattern
  gd.mood('happy'); await gd.hop(tok);
  say('多個串列可以用不同的 pattern 合併', 'more than one merge pattern');
}]);

// 12:24 two-way merge sort vs merge sort
const TW = [9, 3, 7, 5, 6, 4, 8, 2];
const twX = (i) => -4.9 + i * 1.4;
FRAG.push(['dcbari-2way-intro', 'Two-way merge sort：每個元素都是一個串列', async (tok) => {
  fresh([0, 6, 14], [0, 2.4, 0]);
  const gd = guide(-6.4, 3.2);
  await step(tok);                                   // 12:24 兩種：two-way merge sort 與 merge sort
  const a = bubble('two-way merge sort', -3, 6.2), b = bubble('merge sort', 3, 6.2);
  gd.mood('wow');
  say('兩種排序方法：two-way merge sort 與 merge sort', '很多人會搞混');
  await step(tok);                                   // 12:41 迭代 vs 遞迴
  txt(a, 'two-way merge sort：迭代（loop）'); txt(b, 'merge sort：遞迴');
  gd.mood('calm');
  say('差別：two-way 是迭代（用迴圈）', 'merge sort 是遞迴');
  await step(tok);                                   // 12:55 two-way：一次合併兩個
  note('一次合併兩個串列', -3, 5.2);
  say('Two-way：一次拿兩個串列來合併', '');
  await step(tok);                                   // 13:14 一個 8 個元素的陣列
  const ms = TW.map((v, i) => cube(v, PC.blue, [1.1, 0.6, 1], twX(i) + (i - 3.5) * -0.02, 0.3, 0, 1.5));
  say('一個有 8 個元素的陣列，要用 merging 排序', '');
  await step(tok);                                   // 13:34 merging 要兩個排好的陣列，可是只有一個
  gd.mood('sad');
  say('merging 需要兩個已排序的串列', '可是只有一個陣列，而且還沒排序');
  await step(tok);                                   // 13:39 每個元素當成一個串列
  ms.forEach((m, i) => { move(m, -5.25 + i * 1.5, 0.3, 0); });
  await beat(tok, 700);
  ms.forEach((m) => glow(m, GREEN));
  gd.mood('happy');
  say('把每個元素都當成一個串列：8 個串列', '只有一個元素 → 本來就排好了');
  await step(tok);                                   // 14:15 不一次全合，用 two-way
  ms.forEach((m) => glow(m, null));
  good('兩個兩個合併 → 一個排好的串列', 0, 2.2);
  say('不是 8 個一次合併', '用 two-way merge：兩個兩個合');
}]);

// 14:33 pass 1 與輔助陣列 B
FRAG.push(['dcbari-2way-pass1', 'Pass 1：兩兩合併，結果放在 B', async (tok) => {
  fresh([0, 6, 14], [0, 2.4, 0]);
  const gd = guide(-6.4, 3.4);
  const ms = TW.map((v, i) => cube(v, PC.blue, [1, 0.6, 1], twX(i), 0.3, -1.2));
  tag('A', 'ptr', -6.5, 0.3, -1.2);
  for (let i = 0; i < 8; i++) ctx.tile(V3(twX(i), 0.04, 1.6), 1, 1);
  const pc = tag('pass 1', 'ptr alt', 0, 4.4);
  const pairs = [[0, '3 9'], [2, '5 7'], [4, '4 6'], [6, '2 8']];
  for (const [lo, s] of pairs) {
    await step(tok);                                 // 14:33 9,3 · 14:47 5,7 · 15:01 4,6 · 15:09 2,8
    const L = [lo, lo + 1].map((p) => ({ v: TW[p], m: ms[p] })).sort((p, q) => p.v - q.v);
    glow(ms[lo], GOLD); glow(ms[lo + 1], GOLD);
    await beat(tok, 400);
    L.forEach((o, q) => { move(o.m, twX(lo + q), 0.3, 1.6); glow(o.m, null); tint(o.m, PC.purple); });
    say('合併 ' + TW[lo] + ' 和 ' + TW[lo + 1] + ' → ' + s, '兩個一個元素的串列 → 一個兩個元素的串列');
  }
  await step(tok);                                   // 15:13 8 個 → 4 個串列：pass 1 結束
  for (let lo = 0; lo < 8; lo += 2) { const g = ghostBox(PC.green, 2.6, 0.9, 1.3); g.position.set((twX(lo) + twX(lo + 1)) / 2, 0.45, 1.6); }
  txt(pc, 'pass 1 完成：8 個串列 → 4 個');
  gd.mood('happy');
  say('8 個串列 → 4 個串列', '所有 n 個元素都走過一次 = 一個 pass');
  await step(tok);                                   // 15:28 奇數個：多的那個直接下來
  note('若有第 9 個：沒有配對，直接下來', 0, 5.4);
  gd.mood('calm');
  say('如果有 9 個元素，第 9 個沒人配對', '直接留下來，之後再合併');
  await step(tok);                                   // 15:53 結果不放在同一個陣列：要 B
  const bt = tag('B', 'ptr alt', -6.5, 0.3, 1.6);
  gd.mood('wow');
  say('合併的結果不能放回同一個陣列 A', '需要另一個陣列 B 放結果');
  await step(tok);                                   // 16:17 從 B 複製回 A
  ms.forEach((m) => { const p = m.position; move(m, p.x, 0.3, -1.2); });
  say('想要結果在 A 裡：從 B 複製回 A', '所以串列又都在 A 裡了');
}]);

// 16:47 pass 2、pass 3
FRAG.push(['dcbari-2way-pass23', 'Pass 2、Pass 3：4 個 → 2 個 → 1 個', async (tok) => {
  fresh([0, 6, 14], [0, 2.4, 0]);
  const gd = guide(-6.4, 3.4);
  const P1 = [3, 9, 5, 7, 4, 6, 2, 8];
  const ms = P1.map((v, i) => cube(v, PC.purple, [1, 0.6, 1], twX(i), 0.3, -1.2));
  tag('A', 'ptr', -6.5, 0.3, -1.2);
  const pc = tag('pass 2', 'ptr alt', 0, 4.4);
  const mergeAt = async (lo, w, row) => {
    const L = []; for (let p = lo; p < lo + 2 * w; p++) L.push({ v: row[p], m: ms[p] });
    L.sort((p, q) => p.v - q.v);
    for (let q = 0; q < L.length; q++) { move(L[q].m, twX(lo + q), 1.9 + (w === 4 ? 1.6 : 0), -1.2); tint(L[q].m, w === 4 ? PC.green : PC.teal); await beat(tok, 220); }
    return L.map((o) => o.m);
  };
  await step(tok);                                   // 16:47 3 9 + 5 7 → 3 5 7 9
  const l1 = await mergeAt(0, 2, P1);
  say('pass 2：合併 3 9 和 5 7', '→ 3 5 7 9');
  await step(tok);                                   // 17:05 4 6 + 2 8 → 2 4 6 8
  const l2 = await mergeAt(4, 2, P1);
  say('再合併 4 6 和 2 8', '→ 2 4 6 8');
  await step(tok);                                   // 17:19 兩個 4 元素串列：pass 2 完成
  l1.concat(l2).forEach((m, q) => ms[q] = m);
  txt(pc, 'pass 2 完成：4 個串列 → 2 個');
  gd.mood('happy');
  say('剩兩個串列，各 4 個元素', '又走過全部元素一次：pass 2');
  await step(tok);                                   // 17:32 合成一個：2 3 4 5 6 7 8 9
  txt(pc, 'pass 3');
  await mergeAt(0, 4, [3, 5, 7, 9, 2, 4, 6, 8]);
  gd.mood('wow');
  say('最後合併成一個：2 3 4 5 6 7 8 9', '');
  await step(tok);                                   // 17:47 pass 3：排好了
  txt(pc, 'pass 3 完成：排好了');
  good('用 two-way merging 排好 8 個元素', 0, 6.2);
  gd.mood('happy'); await gd.hop(tok);
  say('第 3 個 pass 結束，全部排好', '結果再放回 A');
}]);

// 18:09 時間：log n 個 pass × n
FRAG.push(['dcbari-2way-time', 'Two-way merge sort 的時間：n log n', async (tok) => {
  fresh([0, 5.5, 14], [0, 3, 0]);
  const gd = guide(-6.4, 2.6);
  const rows = [TW, [3, 9, 5, 7, 4, 6, 2, 8], [3, 5, 7, 9, 2, 4, 6, 8], [2, 3, 4, 5, 6, 7, 8, 9]];
  const cnt = ['8 個串列', '4 個串列', '2 個串列', '1 個串列'];
  const X = (i, g) => -4.3 + i * 0.95 + Math.floor(i / g) * 0.25;
  rows.forEach((r, d) => r.forEach((v, i) => cube(v, d === 3 ? PC.green : PC.blue, [0.8, 0.45, 0.8], X(i, Math.pow(2, d)), 0.4 + d * 1.6, 0)));
  await step(tok);                                   // 18:09 每個 pass 都 merge n 個
  for (let d = 1; d <= 3; d++) pkt('pass ' + d + '：n 個', 5.6, 0.4 + d * 1.6);
  say('每個 pass 都把全部 n 個元素合併一次', '');
  await step(tok);                                   // 18:28 n = 8，做了 3 次
  note('n = 8，做了 3 次', -1, 7.4);
  gd.mood('wow');
  say('這裡 n = 8，一共做了 3 次', '');
  await step(tok);                                   // 18:39 8 → 4 → 2 → 1
  cnt.forEach((s, d) => tag(s, 'idx', -6.1, 0.4 + d * 1.6, 0));
  gd.mood('calm');
  say('串列數：8 → 4 → 2 → 1', '每個 pass 除以 2');
  await step(tok);                                   // 19:00 8 / 2³ = 1
  pkt('8 / 2³ = 1　→　8 = 2³', -1, 6.6);
  say('8 除以 2 三次變成 1', '8 = 2³');
  await step(tok);                                   // 19:20 pass 數 = log₂8 = 3 = log n
  good('pass 數 = log₂ n', 3.2, 7.4);
  say('pass 的數目 = log₂ 8 = 3', '一般來說：log n 個 pass');
  await step(tok);                                   // 19:42 每 pass n、共 log n → n log n
  say('每個 pass n、共 log n 個 pass', '總時間 = n × log n');
  await step(tok);                                   // 20:00 Θ(n log n)
  good('Θ(n log n)', 3.2, 6.6);
  gd.mood('happy'); await gd.hop(tok);
  say('Two-way merge sort 的時間 = Θ(n log n)', '');
}]);

// ═════════ ak-pz7tS5DE：merge sort 的優點與缺點 ═════════
FRAG.push(['dcbari-ms-proscons', 'Merge sort 的優點：適合超大串列', async (tok) => {
  fresh([0, 5, 14], [0, 3, 0]);
  const gd = guide(-6.3, 2.4);
  await step(tok);                                   // 0:00 優缺點，先看優點
  tag('Pros 優點', 'ptr', -3, 7.2); tag('Cons 缺點', 'ptr alt', 3, 7.2);
  say('Merge sort 的優點與缺點', '先看優點');
  await step(tok);                                   // 0:11 適合非常大的串列
  cube('適合超大串列', PC.green, [4.4, 0.6, 1], -3, 6, 0, 2);
  const many = []; for (let i = 0; i < 12; i++) many.push(cube('', PC.blue, [0.35, 0.35, 0.35], -5.2 + (i % 6) * 0.8, 0.2 + Math.floor(i / 6) * 0.45, 1.4, 1 + i * 0.1));
  note('幾百萬個數字、幾百萬筆紀錄', -3, 2.2);
  gd.mood('wow');
  say('適合非常大的串列', '幾百萬個數字或紀錄都能用 merge sort 排');
  await step(tok);                                   // 0:25 其他排序做不到，原因等一下說
  bubble('其他排序撐不了這麼大（原因稍後說）', 1.6, 4.4);
  gd.mood('calm');
  say('其他排序沒辦法處理這麼大的串列', '原因後面會講（external sorting）');
}]);

// 0:33 linked list：只改 link
FRAG.push(['dcbari-llmerge', 'Linked list merge：只改 link，不用第三個串列', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 0.6, 0]);
  const gd = guide(-6.4, 3.2);
  const L1 = [[2, -5.2], [8, -1.4], [12, 4.6]], L2 = [[3, -3.3], [9, 0.6], [11, 2.6]];
  let n1 = [], n2 = [], old = [];
  await step(tok);                                   // 0:33 適合 linked list
  bubble('merge sort 適合 linked list', 0, 4.6);
  say('優點二：merge sort 適合 linked list', '');
  await step(tok);                                   // 0:48 它靠 merging
  note('merge sort 用的是 merging', 0, 3.7);
  gd.mood('wow');
  say('merge sort 是靠 merging 完成的', '懂了 linked list 的 merging，就懂了');
  await step(tok);                                   // 0:56 兩個已排序的 linked list
  n1 = L1.map(([v, x]) => lnode(v, x, 0.35, -1.6, PC.blue)); n2 = L2.map(([v, x]) => lnode(v, x, 0.35, 1.6, PC.purple));
  tag('L1', 'ptr', -6.6, 0.4, -1.6); tag('L2', 'ptr', -6.6, 0.4, 1.6);
  for (let i = 0; i < 2; i++) { old.push(line(L1[i][1] + 0.73, 0.4, L1[i + 1][1] - 0.5, 0.4, -1.6)); old.push(line(L2[i][1] + 0.73, 0.4, L2[i + 1][1] - 0.5, 0.4, 1.6)); }
  gd.mood('calm');
  say('兩個已排序的 linked list', 'L1：2 → 8 → 12、L2：3 → 9 → 11');
  await step(tok);                                   // 1:01 不建第三個串列，只改 link
  old.forEach(kill);
  say('不用建第三個 linked list', '只要改變 link，把節點串成一條');
  const seq = [[2, n1[0], -1.6], [3, n2[0], 1.6], [8, n1[1], -1.6], [9, n2[1], 1.6], [11, n2[2], 1.6], [12, n1[2], -1.6]];
  const cmp = [['2 vs 3：2 比較小', '2 是第一個（head）'], ['下一個：3 比較小', '2 指向 3'], ['3 vs 8：3 比較小，接著 8 vs 9', '3 指向 8'], ['8 vs 9：8 比較小', '8 指向 9'], ['12 vs 11：11 比較小', '9 指向 11'], ['L2 用完了', '11 指向 12']];
  for (let q = 0; q < 6; q++) {
    await step(tok);                                 // 1:16 2 · 1:22 2→3 · 1:28 3→8 · 1:36 8→9 · 1:42 9→11 · 1:48 11→12
    glow(seq[q][1].userData.data, GOLD);
    if (q === 0) tag('head', 'ptr alt', -5.2, 1.4, -1.6);
    else { const p = seq[q - 1]; arrow(V3(p[1].position.x + 0.73, 0.75, p[2]), V3(seq[q][1].position.x - 0.4, 0.75, seq[q][2]), 0xc08a1f); }
    say(cmp[q][0], cmp[q][1]);
    await beat(tok, 600);
    glow(seq[q][1].userData.data, null); tint(seq[q][1].userData.data, PC.green);
  }
  await step(tok);                                   // 1:53 2 3 8 9 11 12
  good('2 → 3 → 8 → 9 → 11 → 12', 0, 3.2);
  gd.mood('happy');
  say('從 head 走：2、3、8、9、11、12', '排好了');
  await step(tok);                                   // 2:00 沒有建立第三個串列
  gd.mood('happy'); await gd.hop(tok);
  say('沒有建立第三個 linked list 就合併好了', 'linked list 也能這樣做 merge sort');
}]);

// 2:07 external sorting
FRAG.push(['dcbari-external', 'External merging：檔案比記憶體大', async (tok) => {
  fresh([0, 6, 14], [0, 2, 0]);
  const gd = guide(-6.4, 3.4);
  let f1, f2, ram, out;
  await step(tok);                                   // 2:07 支援 external sorting
  bubble('merge sort 支援 external sorting', 0, 5.6);
  say('優點三：merge sort 支援 external sorting', '其實是 merging 支援');
  await step(tok);                                   // 2:21 硬碟上兩個檔案
  const disk = ghostBox(PC.brown, 5.4, 0.3, 6); disk.position.set(-3.6, 0.15, 0); tag('Hard disk', 'ptr', -3.6, 0.4, -3.4);
  f1 = cube('file 1', PC.blue, [2.4, 1.2, 1.6], -4.4, 0.9, -1.4, 1.5); f2 = cube('file 2', PC.purple, [2.4, 1.8, 1.6], -4.4, 1.2, 1.4, 1.5);
  say('硬碟上有兩個檔案', '');
  await step(tok);                                   // 2:35 5 GB、10 GB
  relabel(f1, 'file 1：5 GB'); relabel(f2, 'file 2：10 GB');
  gd.mood('wow');
  say('兩個大檔：5 GB 和 10 GB', '想像裡面有幾百萬筆紀錄');
  await step(tok);                                   // 2:50 要 merge → 先搬進主記憶體
  ram = ghostBox(PC.green, 4.2, 2.2, 3.4); ram.position.set(2.6, 1.1, 0); tag('RAM（main memory）', 'ptr alt', 2.6, 2.6, -1.9);
  gd.mood('calm');
  say('要 merge 它們，資料得先搬進 main memory', 'merge 程式在記憶體裡執行');
  await step(tok);                                   // 3:21 RAM 只有 4 GB
  const g1 = cube('5 GB', PC.blue, [1.4, 0.8, 1], -4.4, 0.9, -1.4), g2 = cube('10 GB', PC.purple, [1.4, 0.8, 1], -4.4, 1.2, 1.4);
  move(g1, 1.8, 0.5, -0.8); move(g2, 3.4, 0.5, 0.8);
  await beat(tok, 700); glow(g1, RED); glow(g2, RED); gd.mood('sad');
  await beat(tok, 600); fly(g1); fly(g2);
  say('可是 RAM 只有 4 GB', '15 GB 整個搬不進來');
  await step(tok);                                   // 3:40 一次帶一部分（runs、chunks）
  out = cube('', PC.green, [1.4, 0.2, 1.4], -0.6, 0.15, 0); tag('結果', 'idx', -0.6, 0.7, 0);
  gd.mood('wow');
  say('那就一次只帶一小部分進來', '分成 runs、chunks 一塊一塊搬');
  await step(tok);                                   // 3:54 帶 2 和 3 進來
  const b1 = cube('2', PC.blue, [0.8, 0.5, 0.8], -4.4, 1.7, -1.4), b2 = cube('3', PC.purple, [0.8, 0.5, 0.8], -4.4, 2.3, 1.4);
  move(b1, 1.8, 0.35, -0.8); move(b2, 1.8, 0.35, 0.8);
  gd.mood('calm');
  say('從兩個檔案各帶一塊進來：2 和 3', '');
  await step(tok);                                   // 4:15 比較：2 較小 → 寫出去
  glow(b1, GOLD); glow(b2, GOLD); await beat(tok, 600);
  glow(b1, null); glow(b2, null); move(b1, -0.6, 0.5, 0);
  say('比 2 和 3：2 比較小 → 寫出去', '');
  await step(tok);                                   // 4:21 file 1 補 10；比較 → 3 出去
  const b3 = cube('10', PC.blue, [0.8, 0.5, 0.8], -4.4, 1.7, -1.4); move(b3, 1.8, 0.35, -0.8);
  await beat(tok, 700);
  glow(b3, GOLD); glow(b2, GOLD); await beat(tok, 500); glow(b3, null); glow(b2, null);
  move(b2, -0.6, 1.0, 0);
  say('file 1 補下一個：10', '比 10 和 3：3 寫出去');
  await step(tok);                                   // 4:31 其實是一整塊一整塊
  note('實際上搬的是一整塊紀錄（block）', 2.6, 4.2);
  say('這裡用單一元素示範', '實際上是一群元素、一整塊 block');
  await step(tok);                                   // 4:43 只需要很小的空間
  good('只需要很小的記憶體', 2.6, 5.0);
  gd.mood('happy');
  say('只要很小的記憶體就能 merge', '不需要 15 GB 的空間');
  await step(tok);                                   // 4:49 external merging → external merge sort
  pkt('external merging → external merge sort', 0, 6.6);
  await gd.hop(tok);
  say('這就是 external merging', 'merge sort 用同樣的方法排超大的資料');
}]);

// 4:56 stable
FRAG.push(['dcbari-stable', 'Merge sort 是 stable 的', async (tok) => {
  fresh([0, 5.5, 13.5], [0, 1.4, 0]);
  const gd = guide(-6.4, 2.6);
  const a = [[6], [8, 'a'], [3], [9], [4], [8, 'b'], [5]], X = (i) => -4.5 + i * 1.5;
  let ms = [];
  await step(tok);                                   // 5:02 stable
  bubble('merge sort 是 stable 的', 0, 4.6);
  say('優點四：merge sort 是 stable', 'stable 是什麼意思？');
  await step(tok);                                   // 5:14 8 出現兩次
  ms = a.map(([v, t], i) => ({ v, t, m: cube(v, t === 'a' ? PC.orange : t === 'b' ? PC.pink : PC.blue, t === 'a' ? [0.8, 0.5, 0.8] : t === 'b' ? [1.2, 0.85, 1.2] : [1, 0.6, 1], X(i), 0.3, -1.2, 1.2) }));
  tag('小 8：第一個', 'ptr', X(1), 1.4, -1.2); tag('大 8：第二個', 'ptr alt', X(5), 1.7, -1.2);
  gd.mood('wow');
  say('串列裡 8 出現兩次（duplicate）', '小方塊 = 第一個 8、大方塊 = 第二個 8');
  await step(tok);                                   // 5:25 排好後：3 4 5 6 小8 大8 9
  const s = ms.slice().sort((p, q) => p.v - q.v);
  s.forEach((o, i) => move(o.m, X(i), 0.3, 1.4));
  gd.mood('calm');
  say('排序後：3 4 5 6 8 8 9', '');
  await step(tok);                                   // 5:41 兩個 8 的先後沒變
  glow(s[4].m, GOLD); glow(s[5].m, GOLD);
  good('小 8 還在大 8 前面', 0, 2.4, 1.4);
  gd.mood('happy');
  say('兩個 8 保持原本的先後順序', '沒有變成大 8 在前');
  await step(tok);                                   // 5:59 換成學生紀錄
  fresh([0, 5.5, 13.5], [0, 1.4, 0]);
  const gd2 = guide(-6.4, 2.6);
  const r1 = cube('Ravi：8 分', PC.orange, [2.4, 0.6, 1], -2.6, 0.3, -1.2, 1.2), r2 = cube('Sunil：8 分', PC.pink, [2.4, 0.6, 1], 2.6, 0.3, -1.2, 1.2);
  cube('…：6 分', PC.blue, [2.0, 0.6, 1], 0, 0.3, -1.2, 1.2);
  say('換成紀錄：學生某科的分數（滿分 10）', '數字看不出差別，紀錄就看得出來');
  await step(tok);                                   // 6:15 原本按姓名或學號排好
  note('原本已依姓名／學號排好', 0, 2.2, -1.2);
  gd2.mood('wow');
  say('資料原本已經依姓名或學號排好', '現在要依分數排序，原本的順序不能被打亂');
  await step(tok);                                   // 6:24 Ravi 在 Sunil 前面
  move(r1, 1.2, 0.3, 1.4); move(r2, 3.8, 0.3, 1.4);
  gd2.mood('calm');
  say('同樣 8 分：Ravi 在前、Sunil 在後', '排完分數後還是 Ravi 先');
  await step(tok);                                   // 6:38 這就是 stability
  good('stable：重複的值保持原本的順序', 0, 4.2);
  gd2.mood('happy'); await gd2.hop(tok);
  say('這就是 stability', '已經有順序的資料再排序，重複的值保留原順序');
}]);

// 6:49 缺點一：不是 in-place
FRAG.push(['dcbari-notinplace', '缺點一：不是 in-place，陣列要額外空間', async (tok) => {
  fresh([0, 6, 13], [0, 1, 0]);
  const gd = guide(-6.4, 2.8);
  const a = [6, 3, 9, 4], X = (i) => -2.25 + i * 1.5;
  let ms = [];
  await step(tok);                                   // 6:49 缺點：需要額外空間
  tag('Cons 缺點', 'ptr alt', 0, 5.2);
  bubble('需要額外空間：不是 in-place', 0, 4.3);
  gd.mood('sad');
  say('缺點一：需要額外空間', '不是 in-place 的排序');
  await step(tok);                                   // 7:07 in-place 的意思
  ms = a.map((v, i) => cube(v, PC.blue, [1, 0.6, 1], X(i), 0.3, -1.4, 1.2));
  tag('A', 'ptr', -4, 0.3, -1.4);
  const sw = srt(a);
  await beat(tok, 500);
  ms.forEach((m, i) => move(m, X(sw.indexOf(a[i])), 0.3, -1.4));
  gd.mood('calm');
  say('In-place：只在同一個陣列裡重新排列', '例：6 3 9 4 在 A 裡面排好');
  await step(tok);                                   // 7:31 merge sort 不是 in-place
  ms.forEach((m, i) => move(m, X(i), 0.3, -1.4));
  say('Merge sort 不是 in-place', '');
  await step(tok);                                   // 7:37 先切兩半再 merge
  ms.forEach((m, i) => move(m, X(i) + (i < 2 ? -0.4 : 0.4), 0.3, -1.4));
  say('先把串列切成兩半，再 merge', '兩半：6 3 | 9 4（各自排好 → 3 6、4 9）');
  await step(tok);                                   // 7:47 merge 的結果要放到另一個陣列
  const B = ghostBox(PC.orange, 6.2, 0.8, 1.3); B.position.set(0, 0.4, 1.6); tag('額外陣列 B', 'ptr alt', -4.2, 0.4, 1.6);
  for (const [i, k] of [[1, 0], [3, 1], [0, 2], [2, 3]]) { move(ms[i], X(k), 0.3, 1.6); await beat(tok, 350); }
  gd.mood('sad');
  say('merge 的結果不能寫在同一個陣列裡', '要另一個陣列 → 不是 in-place');
  await step(tok);                                   // 8:00 只有陣列才需要；linked list 不用
  note('只有陣列需要；linked list 改 link 就好', 0, 3.4);
  gd.mood('calm');
  say('額外空間只在陣列時需要', 'linked list 不用（只改 link）');
}]);

// 8:16 缺點二：沒有 small problem → 搭配 insertion sort
FRAG.push(['dcbari-smallinsert', '缺點二：沒有 small problem → 小串列交給 insertion sort', async (tok) => {
  fresh([0, 5.5, 14], [0, 2.8, 0]);
  const gd = guide(-6.4, 2.2);
  let top, h, q, ones = [];
  await step(tok);                                   // 8:16 沒有定義 small problem
  top = cube('n = 60', PC.blue, [12, 0.5, 0.9], 0, 6, 0, 1.5);
  bubble('缺點二：沒有 small problem', 0, 7.2);
  say('Merge sort 的演算法沒有定義 small problem', '大就切成兩半');
  await step(tok);                                   // 8:33 一直切到一個元素，什麼都不做
  h = [-3, 3].map((x) => cube('30', PC.blue, [5.8, 0.5, 0.9], x, 4.4, 0, 1.2));
  await beat(tok, 500);
  q = [-4.5, -1.5, 1.5, 4.5].map((x) => cube('15', PC.blue, [2.8, 0.5, 0.9], x, 2.8, 0, 1.2));
  await beat(tok, 500);
  for (let i = 0; i < 16; i++) ones.push(cube('1', PC.sand, [0.55, 0.4, 0.6], -5.6 + i * 0.75, 1.2, 0, 1));
  say('一直切到只剩一個元素才算小', '單一元素什麼都不用做');
  await step(tok);                                   // 8:44 遞迴 → 小串列反而比較慢
  ones.forEach((m) => glow(m, RED));
  gd.mood('sad');
  say('它是遞迴的：對小串列來說反而比較慢', '');
  await step(tok);                                   // 9:02 insertion n²、merge n log n
  note('insertion：O(n²)　merge：O(n log n)', 3.6, 0.3, 1.6);
  gd.mood('calm');
  say('insertion O(n²)、merge O(n log n)', '一般來說 merge sort 快很多');
  await step(tok);                                   // 9:20 小串列：遞迴浪費時間
  gd.mood('wow');
  say('但串列很小時，merge sort 花很多時間在遞迴上', '實際在電腦上跑，反而比 insertion 慢');
  await step(tok);                                   // 9:37 ≤ 15 個時比較慢
  q.forEach((m) => glow(m, GOLD));
  pkt('≤ 15 個：merge sort 比較慢', -1.5, 3.6);
  say('觀察：15 個以下的串列，merge sort 比較慢', '更大之後 merge sort 才比較快');
  await step(tok);                                   // 9:49 小問題交給 insertion sort
  ones.forEach(kill);
  q.forEach((m) => { glow(m, null); tint(m, PC.orange); relabel(m, 'insertion sort'); });
  gd.mood('happy');
  say('小串列交給 insertion sort', 'insertion sort 變成 merge sort 的一部分');
  await step(tok);                                   // 10:01 結果再 merge
  q.forEach((m) => tint(m, PC.green)); await beat(tok, 500);
  h.forEach((m) => tint(m, PC.green)); await beat(tok, 500);
  tint(top, PC.green); glow(top, GREEN);
  say('排好的小串列再用 merge 合起來', '');
  await step(tok);                                   // 10:15 為什麼是 insertion：stable
  good('insertion sort 也是 stable', -3, 0.4, 1.6);
  say('為什麼選 insertion sort？', '因為它也是 stable');
  await step(tok);                                   // 10:23 bubble sort 也 stable、也 n²
  note('bubble sort：也 stable、也 n²，也可以', 3, 1.3, 1.6);
  gd.mood('calm');
  say('Bubble sort 也是 stable、也是 n²', '也可以拿來代替 insertion sort');
  await step(tok);                                   // 10:44 都適合 linked list
  good('merge sort、insertion sort 都適合 linked list', 0, 7.2);
  gd.mood('happy');
  say('兩者都適合 linked list', '');
}]);

// 11:17 缺點三：遞迴用 stack，空間 n + log n
FRAG.push(['dcbari-msspace', '缺點三：遞迴用 stack，空間 n + log n', async (tok) => {
  fresh([0, 5, 14.5], [0, 3.2, 0]);
  const gd = guide(-6.4, 2.4);
  const nodes = [['1-8', 0, -1.6], ['1-4', 1, -4], ['5-8', 1, 0.8], ['1-2', 2, -5.2], ['3-4', 2, -2.8], ['1-1', 3, -5.8], ['2-2', 3, -4.6]];
  const par = { '1-4': '1-8', '5-8': '1-8', '1-2': '1-4', '3-4': '1-4', '1-1': '1-2', '2-2': '1-2' };
  const NY = (d) => 6.4 - d * 1.6, nm = {};
  const st = [];
  await step(tok);                                   // 11:16 遞迴 → 用 stack
  tag('stack', 'ptr alt', 4.6, 4.4);
  ctx.tile(V3(4.6, 0.04, 0), 2.6, 1.4);
  bubble('遞迴演算法都會用到 stack', 3.4, 6.6);
  gd.mood('sad');
  say('缺點三：遞迴演算法都會用到記憶體裡的 stack', 'merge sort 也是');
  await step(tok);                                   // 11:36 最大 stack = tracing tree 的高度
  say('stack 最大會多大？', '取決於 merge sort 的 tracing tree 有多高');
  gd.mood('wow');
  await step(tok);                                   // 11:49 8 個元素：1-8 → 1-4 → 1-2 → 1-1
  for (const [k, d, x] of nodes) {
    nm[k] = cube(k.replace('-', '～'), PC.blue, [1.1, 0.5, 0.8], x, NY(d), 0, 1.2);
    if (par[k]) line(nm[par[k]].position.x, NY(d - 1) - 0.25, x, NY(d) + 0.25);
  }
  for (const k of ['1-8', '1-4', '1-2', '1-1']) { glow(nm[k], GOLD); st.push(cube('MS(' + k.replace('-', ', ') + ')', PC.purple, [2.2, 0.45, 1], 4.6, 0.25 + st.length * 0.5, 0, 1.5)); await beat(tok, 300); }
  gd.mood('calm');
  say('MS(1,8) → (1,4) → (1,2) → (1,1)', '8 個元素：每次呼叫推一個 activation record');
  await step(tok);                                   // 12:01 高度 log n
  pkt('樹高 = log n', -1.6, 0.4, 1.6);
  say('tracing tree 的高度是 log n', '');
  await step(tok);                                   // 12:11 stack 空間 log n
  note('同時最多 log n 個 activation record', 3.4, 2.6);
  say('stack 同時最多只有 log n 個 activation record', '呼叫很多次，但不會同時都在 stack 裡');
  await step(tok);                                   // 12:24 還有 auxiliary array：n
  for (let i = 3; i >= 1; i--) { fly(st[i]); glow(nm[['1-8', '1-4', '1-2', '1-1'][i]], null); await beat(tok, 250); }
  cube('auxiliary array：n', PC.orange, [5, 0.5, 1], -1.6, 0.25, 2.6, 1.5);
  gd.mood('wow');
  say('另外 merge 還需要 auxiliary array', '大小 n');
  await step(tok);                                   // 12:32 n + log n = Θ(n)
  good('空間 = n + log n = Θ(n)', 0, 7.4);
  gd.mood('calm');
  say('總空間 n + log n', '漸近來看就是 Θ(n)：n 是額外陣列、log n 是 stack');
}]);

// ═════════ zXhWPrMLXGo：Merge sort（印地語，依中譯逐句） ═════════
const HA = [2, 5, 8, 15], HB = [4, 7, 10, 12];
// merging A、B → C（params.part = 'what' | 'steps' | 'rest'）
FRAG.push(['dcbari-hmerge', 'Merging：A、B 各 4 個合成 C', async (tok) => {
  const part = (ctx.params || {}).part || 'what';
  fresh([0, 6, 14], [0, 2, 0]);
  const gd = guide(-6.4, 3.4);
  const ax = (i) => -5.6 + i * 1.1, cx = (k) => -1.8 + k * 0.95;
  let ca = [], cb = [], ip, jp, kp, cd, i = 0, j = 0, k = 0;
  const lists = (drop) => {
    ca = HA.map((v, q) => cube(v, PC.blue, [0.9, 0.6, 0.9], ax(q), 0.3, -1.6, drop));
    cb = HB.map((v, q) => cube(v, PC.purple, [0.9, 0.6, 0.9], ax(q), 0.3, 1.6, drop));
    tag('A（m = 4）', 'ptr', -6.2, 1.4, -1.6); tag('B（n = 4）', 'ptr', -6.2, 1.4, 1.6);
  };
  const cTiles = () => { for (let q = 0; q < 8; q++) ctx.tile(V3(cx(q), 0.04, 0), 0.85, 0.85); tag('C', 'ptr alt', -1.8, 2.4, 0); };
  const ptrs = () => { ip = tag('i', 'ptr', ax(i), 1, -1.6); jp = tag('j', 'ptr', ax(j), 1, 1.6); kp = tag('k', 'ptr alt', cx(k), 1, 0); };
  const codeP = () => code(['while (i < m && j < n)', '  if (A[i] < B[j]) C[k++] = A[i++];', '  else             C[k++] = B[j++];', 'while (i < m) C[k++] = A[i++];', 'while (j < n) C[k++] = B[j++];'], 2.8, 7, 0.46);
  const take = (fromA) => {
    if (fromA) { move(ca[i], cx(k), 0.3, 0); i++; move(ip, ax(Math.min(i, 4)), 1, -1.6); }
    else { move(cb[j], cx(k), 0.3, 0); j++; move(jp, ax(Math.min(j, 4)), 1, 1.6); }
    k++; move(kp, cx(Math.min(k, 7.6)), 1, 0);
  };
  if (part === 'what') {
    await step(tok);                                 // 0:01 merge sort；先懂 merging：拿兩個 list
    note('merge sort 之前：先懂 merging', 0, 6.2);
    say('這部影片講 merge sort', '先理解什麼是 merging');
    await step(tok);                                 // 0:15 A：m = 4 個
    ca = HA.map((v, q) => cube(v, PC.blue, [0.9, 0.6, 0.9], ax(q), 0.3, -1.6, 1.5)); tag('A（m = 4）', 'ptr', -6.2, 1.4, -1.6);
    say('list A 有 m 個元素，也就是 4 個', '');
    await step(tok);                                 // 0:23 B：n = 4 個；都排好了
    cb = HB.map((v, q) => cube(v, PC.purple, [0.9, 0.6, 0.9], ax(q), 0.3, 1.6, 1.5)); tag('B（n = 4）', 'ptr', -6.2, 1.4, 1.6);
    [...ca, ...cb].forEach((m) => glow(m, GREEN));
    gd.mood('wow');
    say('list B 有 n = 4 個元素', 'A 和 B 裡的元素都已經排好序');
    await step(tok);                                 // 0:30 合併成第三個 list C
    [...ca, ...cb].forEach((m) => glow(m, null));
    cTiles();
    gd.mood('calm');
    say('merging：把兩個 list 合起來，做出第三個 list C', '');
    await step(tok);                                 // 0:42 定義
    good('merging：兩個已排序 list → 一個已排序 list', 2.4, 5.4);
    gd.mood('happy');
    say('Merging：combining two sorted lists', 'into a single sorted list');
    return;
  }
  if (part === 'steps') {
    lists(0); cTiles();
    await step(tok);                                 // 0:51 i 指向 A 的第一個
    ip = tag('i', 'ptr', ax(0), 1, -1.6);
    say('在 A 的第一個元素放一個整數指標 i', '');
    await step(tok);                                 // 0:55 j 指向 B 的第一個、k 指向 C
    jp = tag('j', 'ptr', ax(0), 1, 1.6); kp = tag('k', 'ptr alt', cx(0), 1, 0);
    glow(ca[0], GOLD); glow(cb[0], GOLD);
    say('j 放在 B 的第一個、k 放在 C 的第一格', '接著比較 A[i] 和 B[j]');
    await step(tok);                                 // 1:06 A[i] 小 → 放進 C，i、k 前進
    glow(ca[0], null); glow(cb[0], null); take(true);
    say('A[i] = 2 比 B[j] = 4 小 → 2 放進 C', 'i 往前、k 也移到下一個空位');
    await step(tok);                                 // 1:22 這次 B[j] 小 → 複製，j、k 前進
    glow(ca[1], GOLD); glow(cb[0], GOLD); await beat(tok, 500); glow(ca[1], null); glow(cb[0], null);
    take(false); gd.look(1);
    say('再比 A[i] = 5 和 B[j] = 4：B[j] 比較小', '4 複製到 C，j 和 k 往前');
    await step(tok);                                 // 1:39 寫成程式：if A[i] < B[j]
    cd = codeP(); cd.hl(1); gd.look(0);
    say('把剛剛的過程寫成程式碼', 'if (A[i] < B[j]) …');
    await step(tok);                                 // 1:56 C[k] = A[i]，k、i 前進
    cd.hl(1);
    bubble('C[k++] = A[i++]', 2.8, 4.4);
    say('把 A[i] 複製到 C[k]', 'k 往前、i 也往前');
    await step(tok);                                 // 2:09 otherwise C[k] = B[j]
    cd.hl(2);
    say('otherwise（A 不比較小）：C[k] 放 B[j]', '就這樣一個一個複製');
    await step(tok);                                 // 2:29 5、7、8、10 複製
    while (k < 6) { take(HA[i] < HB[j]); await beat(tok, 450); }
    say('這樣 5、7、8、10 依序被複製', '');
    await step(tok);                                 // 2:36 i 停在 15、j 停在 12
    glow(ca[3], GOLD); glow(cb[3], GOLD);
    gd.mood('wow');
    say('i 停在 15、j 停在 12', 'k 在下一個空位');
    await step(tok);                                 // 2:55 15 vs 12：12 放進 C
    glow(ca[3], null); glow(cb[3], null); take(false);
    gd.mood('calm');
    say('比 15 和 12：B[j] 比較小', '12 放進 C，j 往前');
    await step(tok);                                 // 3:03 B 用完，j 跑出去 → 停
    cd.hl(0); bad('j 跑出 B 了', ax(3) + 1.2, 1.6, 1.6);
    say('B 的元素全部用完，j 跑到 list 外面', '這個過程先停下來');
    return;
  }
  // part 'rest'：已複製 2 4 5 7 8 10 12，A 剩 15
  lists(0); cTiles();
  for (const v of [2, 4, 5, 7, 8, 10, 12]) { const fromA = HA.includes(v); const m = fromA ? ca[HA.indexOf(v)] : cb[HB.indexOf(v)]; m.position.set(cx(k), 0.3, 0); k++; }
  i = 3; j = 4; ptrs(); cd = codeP();
  await step(tok);                                   // 3:16 重複到什麼時候？i < m 且 j < n
  cd.hl(0);
  say('這個過程重複執行，直到什麼時候？', '只要 i < m 而且 j < n');
  await step(tok);                                   // 3:39 直到其中一個 list 用完
  bad('B 用完了', ax(3) + 1.2, 1.6, 1.6);
  say('直到其中一個 list 用完為止', '');
  await step(tok);                                   // 3:42 另一個 list 一定剩元素
  glow(ca[3], GOLD); gd.mood('wow');
  say('一個 list 用完時，另一個 list 一定還有剩', '這裡 A 剩下 15');
  await step(tok);                                   // 3:47 假如 B 多一個 17
  const g17 = cube('17', PC.purple, [0.9, 0.6, 0.9], ax(4) + 0.2, 0.3, 1.6, 1.2); tint(g17, PC.pink);
  note('假如 B 還有 17：15 先被複製，剩下 17', -2.6, 3.4);
  gd.mood('calm');
  say('假如 B 多一個 17', '15 會被複製，剩下的就是 17');
  await step(tok);                                   // 4:03 至少剩一個，要複製剩下的
  kill(g17);
  say('至少會剩一個元素', '要把剩下的元素複製過去：可能在 A，也可能在 B');
  await step(tok);                                   // 4:10 while (i < m) C[k++] = A[i++]
  cd.hl(3); glow(ca[3], null); take(true);
  say('while (i < m) C[k++] = A[i++]', 'A 剩下的全部複製到 C');
  await step(tok);                                   // 4:30 B 剩下的也一樣
  cd.hl(4);
  say('while (j < n) C[k++] = B[j++]', 'B 剩下的也一樣複製到 C');
  await step(tok);                                   // 4:39 這就是 merge 的演算法
  cd.hl(-1);
  [...ca, ...cb].forEach((m) => tint(m, PC.green));
  good('A、B 合併，結果放在 C', 2.8, 4.4);
  gd.mood('happy'); await gd.hop(tok);
  say('這就是 merging 的演算法', '給 A、B、C 三個 list：A 和 B 合併，結果放在 C');
}]);

// 5:03 四個 list A、B、C、D：不只一種 merge pattern
FRAG.push(['dcbari-habcd', '四個串列 A、B、C、D：不只一種 merge pattern', async (tok) => {
  fresh([0, 5, 14], [0, 2.8, 0]);
  const gd = guide(-6.4, 2.4);
  const mk = (x0, title) => { tag(title, 'ptr', x0, 7.2); const pos = {}; ['A', 'B', 'C', 'D'].forEach((n, q) => { pos[n] = [x0 - 2.1 + q * 1.4, 0.3]; cube(n, PC.blue, [1, 0.55, 0.9], pos[n][0], 0.3, 0, 2); }); return pos; };
  const mg = (pos, a, b, c, y) => { const x = (pos[a][0] + pos[b][0]) / 2; line(pos[a][0], pos[a][1] + 0.3, x, y - 0.3); line(pos[b][0], pos[b][1] + 0.3, x, y - 0.3); cube(c, c === 'G' ? PC.green : PC.purple, [1, 0.55, 0.9], x, y, 0, 1.5); pos[c] = [x, y]; };
  let L, R;
  await step(tok);                                   // 5:03 四個 list
  L = mk(-3.4, '兩兩配對');
  say('假設有四個 list：A、B、C、D', '要怎麼合併？');
  await step(tok);                                   // 5:21 A + B → E
  mg(L, 'A', 'B', 'E', 2.1);
  say('先合併 A 和 B → 新 list E', '');
  await step(tok);                                   // 5:30 C + D → F
  mg(L, 'C', 'D', 'F', 2.1);
  say('再合併 C 和 D → 新 list F', '');
  await step(tok);                                   // 5:37 現在剩兩個
  note('4 個 → 3 個 → 2 個', -3.4, 3.4);
  gd.mood('wow');
  say('本來 4 個，做出 E 後變 3 個（E、C、D）', '再做出 F 後只剩兩個');
  await step(tok);                                   // 5:51 E + F → G
  mg(L, 'E', 'F', 'G', 3.9);
  gd.mood('happy');
  say('合併 E 和 F → G', 'G 有 A、B、C、D 全部的元素');
  await step(tok);                                   // 6:10 也可以這樣：A + B → E
  R = mk(3.4, '一個接一個');
  mg(R, 'A', 'B', 'E', 1.9);
  gd.mood('wow');
  say('也可以這樣合併：先合併 A 和 B → E', '');
  await step(tok);                                   // 6:19 E + C → F
  mg(R, 'E', 'C', 'F', 3.5);
  say('E 再跟 C 合併 → F', '');
  await step(tok);                                   // 6:27 F + D → G
  mg(R, 'F', 'D', 'G', 5.1);
  gd.mood('calm');
  say('F 再跟 D 合併 → G', '');
  await step(tok);                                   // 6:32 兩個以上的 list：方式不同
  say('兩個以上的 list，可以用不同的方式合併', '');
  await step(tok);                                   // 6:44 more than one merge pattern
  good('There can be more than one merge pattern', 0, 6.4, 1.2);
  gd.mood('happy');
  say('merge pattern 可以不只一種', '');
  await step(tok);                                   // 6:54 非常重要
  await gd.hop(tok);
  say('這一點非常重要', '接下來會再詳細講');
}]);

// 7:06 8 個單元素 list：7 次 merge
FRAG.push(['dcbari-h8lists', '8 個單元素串列：7 次 merge', async (tok) => {
  fresh([0, 5.5, 14.5], [0, 2.8, 0]);
  const gd = guide(-6.6, 2.4);
  const a = [8, 3, 7, 5, 9, 2, 6, 4], X = (i) => -5.25 + i * 1.5;
  let ms = [], bs = [];
  const nums = [];
  const pairBox = (p, q) => { const s = srt([a[p], a[q]]); line(X(p), 0.6, (X(p) + X(q)) / 2, 1.75); line(X(q), 0.6, (X(p) + X(q)) / 2, 1.75); return cube(s.join(', '), PC.purple, [2.4, 0.5, 0.9], (X(p) + X(q)) / 2, 2, 0, 1.5); };
  const quadBox = (p, q) => { const s = srt(a.slice(p, q + 1)), x = (X(p) + X(q)) / 2; line((X(p) + X(p + 1)) / 2, 2.25, x, 3.45); line((X(q - 1) + X(q)) / 2, 2.25, x, 3.45); return cube(s.join(', '), PC.purple, [5.4, 0.5, 0.9], x, 3.7, 0, 1.5); };
  await step(tok);                                   // 7:06 8 個 list
  ms = a.map((v, i) => cube(v, PC.blue, [1, 0.55, 0.9], X(i), 0.3, 0, 2));
  say('下一個例子：8 個 list', '');
  await step(tok);                                   // 7:22 每個只有一個元素 → 已排序
  ms.forEach((m) => glow(m, GREEN));
  gd.mood('wow');
  say('每個 list 只有一個元素', '只有一個元素 → 本來就排好了');
  await step(tok);                                   // 7:31 merge 8 和 3 → 3, 8
  ms.forEach((m) => glow(m, null));
  bs.push(pairBox(0, 1));
  gd.mood('calm');
  say('合併這兩個 → 3、8', '');
  await step(tok);                                   // 7:36 5,7；2,9；4,6
  for (const [p, q] of [[2, 3], [4, 5], [6, 7]]) { bs.push(pairBox(p, q)); await beat(tok, 450); }
  say('再合併：5、7，然後 2、9，然後 4、6', '');
  await step(tok);                                   // 7:48 4 個 list → 3 5 7 8
  bs.push(quadBox(0, 3));
  say('現在有 4 個 list：合併前兩個 → 3、5、7、8', '');
  await step(tok);                                   // 7:56 → 2 4 6 9；剩兩個
  bs.push(quadBox(4, 7));
  say('後兩個 → 2、4、6、9', '現在剩兩個 list');
  await step(tok);                                   // 8:08 結果要寫到第三個 list
  note('合併結果要寫到第三個 list', 3.6, 6.2);
  gd.mood('wow');
  say('注意：合併兩個 list 時', '結果必須寫到第三個 list');
  await step(tok);                                   // 8:24 單一排好的 list
  line(-3, 3.95, 0, 5.15); line(3, 3.95, 0, 5.15);
  bs.push(cube(srt(a).join(', '), PC.green, [11, 0.5, 0.9], 0, 5.4, 0, 1.5));
  gd.mood('happy');
  say('8 個 list 合併成一個', '裡面有全部元素，而且都排好了');
  await step(tok);                                   // 8:35 數一數：1…7
  const lvl = [bs[0], bs[1], bs[2], bs[3], bs[4], bs[5], bs[6]];
  for (let q = 0; q < 7; q++) { nums.push(tag('#' + (q + 1), 'ptr alt', lvl[q].position.x + (q === 6 ? 6 : 0.9), lvl[q].position.y + 0.55, 0)); await beat(tok, 250); }
  gd.mood('calm');
  say('一共合併了幾次？1、2、3、4、5、6、7', '');
  await step(tok);                                   // 8:49 8 個 list → 7 次；也可以換順序
  good('8 個 list → 7 次 merge', -4.4, 6.6);
  say('8 個 list 需要 7 次 merge', '也可以用別的順序合併');
  const order = [0, 1, 4, 2, 3, 5, 6];               // 依「先這兩個、再這兩個、再合結果」重新編號
  await step(tok);                                   // 9:07 先兩個、再兩個、再合結果：1 2 3
  for (let q = 0; q < 3; q++) txt(nums[order[q]], '#' + (q + 1));
  gd.mood('wow');
  say('可以先合併這兩個、再這兩個、再合併它們的結果', '第 1、2、3 次');
  await step(tok);                                   // 9:19 4、5、6
  for (let q = 3; q < 6; q++) txt(nums[order[q]], '#' + (q + 1));
  say('然後第 4、第 5、第 6 次', '');
  await step(tok);                                   // 9:24 7
  txt(nums[order[6]], '#7');
  say('最後兩個合起來是第 7 次', '');
  await step(tok);                                   // 9:33 或者一個接一個
  fresh([0, 5.5, 14.5], [0, 2.8, 0]);
  const gd2 = guide(-6.6, 2.4);
  a.forEach((v, i) => cube(v, PC.blue, [1, 0.55, 0.9], X(i), 0.3, 0));
  let px = X(0), py = 0.3, cur = [a[0]];
  for (let i = 1; i < 8; i++) {
    cur = srt([...cur, a[i]]);
    const nx = (px + X(i)) / 2 + 0.2, ny = 0.3 + i * 0.85;
    line(px, py + 0.25, nx, ny - 0.25); line(X(i), 0.55, nx, ny - 0.25);
    cube(cur.join(','), i === 7 ? PC.green : PC.purple, [Math.max(1, cur.length * 0.55), 0.45, 0.9], nx, ny, 0, 0.8);
    px = nx; py = ny;
    await beat(tok, 280);
  }
  say('或者：先合併兩個，結果再跟下一個合併……', '一樣是 7 次');
  await step(tok);                                   // 9:40 不只一種 pattern
  good('more than one merge pattern', 2.4, 1.2);
  gd2.mood('happy'); await gd2.hop(tok);
  say('兩個以上的 list，合併的 pattern 不只一種', '');
}]);

// 9:46 merge sort：把陣列看成 8 個 list
FRAG.push(['dcbari-h8as', 'Merge sort：把陣列看成 8 個 list', async (tok) => {
  fresh([0, 5.5, 13.5], [0, 1.6, 0]);
  const gd = guide(-6.4, 2.6);
  const a = [8, 3, 7, 5, 9, 2, 6, 4];
  let ms = [];
  await step(tok);                                   // 9:46 一個大小 8 的陣列
  ms = a.map((v, i) => cube(v, PC.blue, [1, 0.6, 1], -3.5 + i * 1.0, 0.3, 0, 1.5));
  tag('大小 8 的陣列', 'ptr', 0, 1.6);
  say('終於來看 merge sort', '一個大小 8 的陣列，有 8 個元素');
  await step(tok);                                   // 10:09 不看成一個陣列，而是 8 個 list
  ms.forEach((m, i) => move(m, -5.25 + i * 1.5, 0.3, 0));
  await beat(tok, 600);
  ms.forEach((m) => glow(m, GREEN));
  gd.mood('wow');
  say('不把它看成一個陣列', '而是 8 個不同的 list');
  await step(tok);                                   // 10:44 merge sort 怎麼運作
  ms.forEach((m) => glow(m, null));
  bubble('給 merge sort 一個陣列…', 0, 3.4);
  gd.mood('calm');
  say('來看 merge sort 怎麼運作', '給它一個陣列要排序');
  await step(tok);                                   // 11:05 每個元素都是一個 list → 8 個
  ms.forEach((m, i) => tag('list ' + (i + 1), 'idx', -5.25 + i * 1.5, 0, 0.9));
  gd.mood('happy');
  say('每個元素本身就是一個 list', '8 個元素 → 8 個 list');
}]);

// 11:11 遞迴 MergeSort(l, h)（params.part = 'a' | 'b'）
FRAG.push(['dcbari-hmsrec', 'MergeSort(l, h)：一路 divide 到單一元素再 merge', async (tok) => {
  const part = (ctx.params || {}).part || 'a';
  fresh([0, 5, 15], [0, 3.2, 0]);
  const gd = guide(-6.6, 2.6);
  const a = [8, 3, 7, 5, 9, 2, 6, 4], X = (i) => -6.0 + i * 0.95;
  const cd = code(['MergeSort(l, h) {', '  if (l < h) {', '    mid = (l + h) / 2;', '    MergeSort(l, mid);', '    MergeSort(mid+1, h);', '    Merge(l, mid, h);', '  }', '}'], 4.4, 6.6, 0.48);
  const cnt = tag('divide 0 次', 'ptr alt', 4.4, 2.2);
  const segY = (d) => 6.2 - d * 1.6, segX = (l, h) => (X(l) + X(h)) / 2;
  const segs = {}, depth = { '0-7': 0 };
  let dv = 0;
  const seg = (l, h, d, drop) => { segs[l + '-' + h] = cube(a.slice(l, h + 1).join(' '), PC.blue, [(h - l + 1) * 0.95 - 0.15, 0.5, 0.8], segX(l, h), segY(d), 0, drop); depth[l + '-' + h] = d; };
  const D = (l, h, drop = 1.2) => {
    const m = (l + h) >> 1, d = depth[l + '-' + h]; dv++; txt(cnt, 'divide ' + dv + ' 次');
    for (const [p, q] of [[l, m], [m + 1, h]]) { seg(p, q, d + 1, drop); line(segX(l, h), segY(d) - 0.25, segX(p, q), segY(d + 1) + 0.25); }
  };
  const M = (l, h) => { const mm = segs[l + '-' + h]; relabel(mm, srt(a.slice(l, h + 1)).join(' ')); tint(mm, PC.green); };
  if (part === 'a') {
    await step(tok);                                 // 11:11 給 merge sort 一個陣列
    seg(0, 7, 0, 1.2);
    say('把陣列交給 merge sort，它會做什麼？', '8 3 7 5 9 2 6 4');
    await step(tok);                                 // 11:17 邏輯上切開
    bubble('不是真的切開：只用 l、mid、h 劃範圍', -1.4, 7.3);
    gd.mood('wow');
    say('它會把陣列切開', '不是實體切開，而是邏輯上切開');
    await step(tok);                                 // 11:24 第一次 divide
    D(0, 7); gd.mood('calm');
    say('第一次切割：左邊一個 list、右邊一個 list', '');
    await step(tok);                                 // 11:29 第二次：再切左邊
    D(0, 3);
    say('拿第一個 list（左邊）再切一次', '第二次切割');
    await step(tok);                                 // 11:42 第三次
    D(0, 1);
    say('再把左邊的 list 切開', '第三次切割');
    await step(tok);                                 // 11:51 左右各剩一個元素
    glow(segs['0-0'], GOLD); glow(segs['1-1'], GOLD);
    say('左邊剩一個元素、右邊剩一個元素', '一直切到只剩單一元素');
    await step(tok);                                 // 12:04 合併 → 3 8
    glow(segs['0-0'], null); glow(segs['1-1'], null); M(0, 1);
    gd.mood('happy');
    say('都是單一元素了 → 合併', '結果 3、8');
    await step(tok);                                 // 12:20 l = 1、h = 8
    cd.hl(0);
    pkt('l = 1', X(0), 7.2); pkt('h = 8', X(7), 7.2);
    gd.mood('calm');
    say('來看程式怎麼做：MergeSort(l = 1, h = 8)', '');
    await step(tok);                                 // 12:40 l < h → mid
    cd.hl(2);
    say('先檢查 l < h（至少兩個元素）', '是的話，算 mid = (l + h) / 2');
    await step(tok);                                 // 12:48 切開後，左半再切
    cd.hl(3);
    say('切開之後，左半邊還要再切', '');
    return;
  }
  // part 'b'：左邊 1～2 已合併成 3 8
  seg(0, 7, 0, 0); D(0, 7, 0); D(0, 3, 0); D(0, 1, 0); M(0, 1);
  await step(tok);                                   // 12:59 MergeSort(low, mid) 一直套用
  cd.hl(3); glow(segs['0-3'], GOLD);
  say('它會一直套用 merge sort', 'MergeSort(low, mid)');
  await step(tok);                                   // 13:07 右邊再切：第四次
  glow(segs['0-3'], null); D(2, 3);
  say('同樣到右邊再切下去', '第四次切割');
  await step(tok);                                   // 13:22 合併 → 5 7
  M(2, 3); gd.mood('happy');
  say('兩個都是單一元素 → 合併', '變成 5、7');
  await step(tok);                                   // 13:31 MergeSort(mid + 1, high)
  cd.hl(4); gd.mood('calm');
  say('也就是在右半邊呼叫 merge sort', 'MergeSort(mid + 1, high)');
  await step(tok);                                   // 13:40 左右合起來：Merge(l, mid, h)
  cd.hl(5); M(0, 3);
  say('左右兩半合起來變成一個 list', 'Merge：low～mid 與 mid+1～high → 3 5 7 8');
  await step(tok);                                   // 14:06 右半：第五次
  cd.hl(4); D(4, 7);
  say('左半邊合併完了，換右半邊', '第五次切割');
  await step(tok);                                   // 14:15 第六次，合併 → 2 9
  D(4, 5); await beat(tok, 600); M(4, 5);
  say('第六次切割，再合併', '得到 2、9');
  await step(tok);                                   // 14:23 第七次，合併 → 4 6
  D(6, 7); await beat(tok, 600); M(6, 7);
  say('第七次切割，再合併', '得到 4、6');
  await step(tok);                                   // 14:37 2 4 6 9，再合成一個
  cd.hl(5); M(4, 7); await beat(tok, 700); M(0, 7); glow(segs['0-7'], GREEN);
  gd.mood('happy'); await gd.hop(tok);
  say('2、4、6、9，最後把兩個 list 合併', '得到一個排好的 list');
  await step(tok);                                   // 14:46 照這個 pattern 合併
  cd.hl(-1);
  say('Merge sort 照著這個 pattern', '把所有元素合併成一個排好的 list');
}]);

// 14:56 merge 的結果放在輔助陣列 B
FRAG.push(['dcbari-haux', 'Merge 需要輔助陣列 B，再複製回 A', async (tok) => {
  fresh([0, 6.5, 13], [0, 0.6, 0]);
  const gd = guide(-6.6, 3.0);
  const X = (i) => -4.9 + i * 1.4;
  const A = [3, 8, 5, 7, 2, 9, 4, 6];
  for (let i = 0; i < 8; i++) ctx.tile(V3(X(i), 0.04, -1.5), 1.1, 1.1);
  tag('A', 'ptr', -6.5, 0.3, -1.5);
  const ms = A.map((v, i) => cube(v, PC.blue, [0.95, 0.6, 0.95], X(i), 0.35, -1.5));
  const toB = async (lo, hi) => { const it = []; for (let i = lo; i <= hi; i++) it.push(ms[i]); it.sort((p, q) => Number(p.userData.lbl.element.textContent) - Number(q.userData.lbl.element.textContent)); for (let q = 0; q < it.length; q++) { move(it[q], X(lo + q), 0.35, 1.5); await beat(tok, 180); } return it; };
  const back = (lo, it) => it.forEach((m, q) => { move(m, X(lo + q), 0.35, -1.5); ms[lo + q] = m; });
  await step(tok);                                   // 14:56 結果要放哪裡？
  bubble('兩個 list 在同一個陣列裡，merge 的結果放哪？', 0, 3.6);
  gd.mood('wow');
  say('問題：兩個 list 合併時', '結果要放在哪裡？');
  await step(tok);                                   // 15:01 需要額外的 auxiliary array
  for (let i = 0; i < 8; i++) ctx.tile(V3(X(i), 0.04, 1.5), 1.1, 1.1);
  tag('B（auxiliary）', 'ptr alt', -6.3, 1.2, 1.5);
  gd.mood('calm');
  say('需要一個額外的輔助陣列（auxiliary array）', '');
  await step(tok);                                   // 15:08 3 5 7 8 放到 B
  const r1 = await toB(0, 3);
  say('merge 的結果放進 B', '3、5、7、8');
  await step(tok);                                   // 15:17 再複製回 A
  back(0, r1);
  say('然後再從 B 複製回 A', '');
  await step(tok);                                   // 15:23 2 4 6 9 也一樣
  const r2 = await toB(4, 7); await beat(tok, 400); back(4, r2);
  say('2、4、6、9 也一樣：先到 B', '再複製回 A');
  await step(tok);                                   // 15:29 兩個 list 合併 → B → A
  const r3 = await toB(0, 7); await beat(tok, 300); back(0, r3);
  ms.forEach((m) => tint(m, PC.green));
  gd.mood('happy');
  say('這兩個 list 合併：結果先到 B', '再從 B 複製回去');
  await step(tok);                                   // 15:43 merge 要改寫：A → B → A
  note('Merge 要改寫：A → B，再 B → A', 0, 3.6);
  say('所以這裡的 merge 演算法要稍微修改', '從 A 複製到 B，再轉回 A');
}]);

// 16:03 總結
FRAG.push(['dcbari-hsum', 'Merge sort：用 merge pattern 排序', async (tok) => {
  fresh([0, 5.5, 13.5], [0, 2.2, 0]);
  const gd = guide(-6.4, 2.6);
  const a = [8, 3, 7, 5, 9, 2, 6, 4];
  let ms = [];
  await step(tok);                                   // 16:05 用 pattern 合併來排序
  bubble('merge sort = 照 pattern 一直合併', 0, 5.4);
  say('Merge sort 用一種 pattern', '一邊合併 list 一邊排序');
  await step(tok);                                   // 16:12 8 個元素 → 8 個單元素 list
  ms = a.map((v, i) => cube(v, PC.blue, [1, 0.6, 1], -5.25 + i * 1.5, 0.3, 0, 1.5));
  gd.mood('wow');
  say('給它 8 個元素的 list', '它看成 8 個各有一個元素的 list');
  await step(tok);                                   // 16:18 套用 merge pattern → 排好
  const s = srt(a);
  ms.forEach((m, i) => { move(m, -5.25 + s.indexOf(a[i]) * 1.5, 0.3, 0); tint(m, PC.green); });
  gd.mood('happy'); await gd.hop(tok);
  say('套用 merge pattern 就排好了', 'merging 的結果本來就是排好的');
}]);

// ═════════ -qOVVRIZzao：Quick sort 的分析 ═════════
// best case：每次都切在中間（params.part = 'build' | 'time'）
FRAG.push(['dcbari-qs-best', 'Quick sort best case：每次切在中間', async (tok) => {
  const part = (ctx.params || {}).part || 'build';
  fresh([0, 5, 14.5], [0, 3.2, 0]);
  const gd = guide(-6.6, 2.4);
  const W = 12, unit = W / 15, x0 = -5.6;
  const segs = {};
  const seg = (l, h, d, drop) => {
    const y = 6.4 - d * 1.6, xl = x0 + (l - 1) * unit, w = (h - l + 1) * unit;
    if (l === h) cube(String(l), PC.purple, [unit * 0.85, 0.5, 0.8], xl + w / 2, y, 0, drop);
    else segs[l + '-' + h] = cube(l + '～' + h, PC.blue, [w - 0.12, 0.5, 0.8], xl + w / 2, y, 0, drop);
  };
  // the pivot lands in the middle of its range, where the range's name was: the bar keeps the colour, the pivot the label
  const piv = (l, h, d) => { const m = (l + h) >> 1; if (segs[l + '-' + h]) relabel(segs[l + '-' + h], ''); cube(m, PC.gold, [unit * 0.8, 0.52, 0.85], x0 + (m - 0.5) * unit, 6.4 - d * 1.6, 0.1); };
  const split = (l, h, d, drop) => { const m = (l + h) >> 1; piv(l, h, d); seg(l, m - 1, d + 1, drop); seg(m + 1, h, d + 1, drop); };
  const leaves = [[1, 3], [5, 7], [9, 11], [13, 15]];
  if (part === 'build') {
    await step(tok);                                 // 0:00 分析 quicksort
    bubble('quick sort：遞迴、divide and conquer', 0, 7.6);
    say('來分析 quick sort 的時間', '它是遞迴的，用 divide and conquer');
    await step(tok);                                 // 0:12 partition 找出 pivot 的位置並切開
    note('partition：找出 pivot 的位置，把串列切開', 0, 0.3, 2.2);
    gd.mood('wow');
    say('用 partition 演算法', '找出 pivot 的位置，把串列切成兩邊');
    await step(tok);                                 // 0:24 1～15，QuickSort(1, 15)
    seg(1, 15, 0, 1.2);
    pkt('QuickSort(1, 15)', -3.6, 7.2);
    gd.mood('calm');
    say('15 個元素：1～15', '呼叫 QuickSort(1, 15)');
    await step(tok);                                 // 0:40 假設切在中間 8
    split(1, 15, 0, 1.2);
    say('假設 partition 剛好切在中間：位置 8', '左邊 1～7、右邊 9～15');
    await step(tok);                                 // 1:22 左邊切在 4
    split(1, 7, 1, 1.2);
    say('一直假設都切在中間：左邊切在 4', '得到 1～3 和 5～7');
    await step(tok);                                 // 1:36 右邊切在 12
    split(9, 15, 1, 1.2);
    say('右邊也切在中間：12', '得到 9～11 和 13～15');
    const caps = ['切在 2：剩 1 和 3', '切在 6：剩 5 和 7', '切在 10：剩 9 和 11', '切在 14：剩 13 和 15'];
    for (let q = 0; q < 4; q++) {
      await step(tok);                               // 1:47 2 · 1:51 6 · 1:59 10 · 2:08 14
      const [l, h] = leaves[q];
      split(l, h, 2, 1.2);
      say(caps[q], '只剩單一元素');
    }
    await step(tok);                                 // 2:19 每次都切在中間的樣子
    good('每次都切在中間', 3.6, 0.3, 2.2);
    gd.mood('happy'); await gd.hop(tok);
    say('如果每次都切在中間', 'quick sort 就是這樣運作');
    return;
  }
  // part 'time'：樹已經畫好
  seg(1, 15, 0, 0); split(1, 15, 0, 0); split(1, 7, 1, 0); split(9, 15, 1, 0); for (const [l, h] of leaves) split(l, h, 2, 0);
  const nt = [];
  await step(tok);                                   // 2:34 partition 走過整個串列 → n
  nt.push(pkt('≈ n', 6.8, 6.4));
  say('partition 比較、交換元素', '要走過整個串列 → 第一層花 n');
  await step(tok);                                   // 2:49 下一層左右合計也約 n
  nt.push(pkt('≈ n', 6.8, 4.8));
  say('下一層：左邊加右邊也約 n', '少了一個元素，但當成 n');
  await step(tok);                                   // 3:01 每一層都是 n
  nt.push(pkt('≈ n', 6.8, 3.2)); nt.push(pkt('≈ n', 6.8, 1.6));
  say('每一層都是 n', '');
  await step(tok);                                   // 3:10 樹多高？每次除以 2
  note('15 → 7 → 3 → 1：每次對半', -3, 0.2, 2.2);
  gd.mood('wow');
  say('樹有多高？每次都對半切', 'n / 2 / 2 / 2 …… 直到剩 1');
  await step(tok);                                   // 3:35 n/2ᵏ = 1 → k = log n
  pkt('n / 2ᵏ = 1 → n = 2ᵏ → k = log₂ n', 2.4, 0.2, 2.2);
  say('n / 2ᵏ = 1 → n = 2ᵏ', 'k = log n：有 log n 層');
  await step(tok);                                   // 3:54 n × log n
  gd.mood('calm');
  say('log n 層 × 每層 n', 'quick sort 的時間 = O(n log n)');
  await step(tok);                                   // 4:16 這是 best case
  good('best case：Θ(n log n)', 0, 7.6);
  gd.mood('happy'); await gd.hop(tok);
  say('前提是每次都切在中間', '這是 best case：n log n');
}]);

// 4:41 best case 做得到嗎？median
FRAG.push(['dcbari-qs-median', 'Best case 需要 pivot 是 median', async (tok) => {
  fresh([0, 5, 13], [0, 1.6, 0]);
  const gd = guide(-6.4, 2.4);
  const S = [1, 2, 3, 4, 5, 6, 7];
  let ms = [];
  await step(tok);                                   // 4:41 best case 可能嗎？
  bubble('best case 做得到嗎？', 0, 4.6);
  gd.mood('wow');
  say('best case 真的做得到嗎？', '先認識 median');
  await step(tok);                                   // 4:46 1～7，中間那個是 median
  ms = S.map((v, i) => cube(v, PC.blue, [0.9, 0.6, 0.9], -3.6 + i * 1.2, 0.3, 0, 1.5));
  await beat(tok, 700);
  tint(ms[3], PC.gold); glow(ms[3], GOLD); tag('median', 'ptr alt', 0, 1.4);
  gd.mood('calm');
  say('1～7 已排序：正中間的 4 叫 median', 'median = 排好序的串列的中間元素');
  await step(tok);                                   // 5:17 要切在中間 → pivot 必須是 median
  note('切在中間 ⇔ pivot 是 median', 0, 3.6);
  say('要每次切在中間', '被選為 pivot 的元素必須是 median');
  await step(tok);                                   // 5:28 沒排序就不知道 median
  [5, 2, 7, 4, 1, 6, 3].forEach((v, i) => move(ms[v - 1], -3.6 + i * 1.2, 0.3, 0));
  gd.mood('sad');
  say('可是沒排序，就不知道誰是 median', '');
  await step(tok);                                   // 5:43 只能隨機碰到
  bad('best case 無法刻意做到（只能碰運氣）', 0, 2.6);
  say('每次都剛好選到 median？不可能控制', 'best case 只可能隨機發生');
}]);

// 5:55 worst case：已排序的串列
FRAG.push(['dcbari-qs-worst', 'Quick sort worst case：已排序 n(n+1)/2', async (tok) => {
  fresh([0, 5.5, 14], [0, 3, 0]);
  const gd = guide(-6.6, 2.4);
  const n = 7, X = (k) => -4.2 + k * 0.95;
  let row = [];
  await step(tok);                                   // 5:55 worst case？
  bubble('worst case 是什麼？', 0, 7.6);
  say('quick sort 的 worst case 是什麼？', '');
  await step(tok);                                   // 6:15 已排序的串列
  row = [];
  for (let k = 0; k < n; k++) row.push(cube(k + 1, PC.blue, [0.75, 0.5, 0.7], X(k), 6.6, 0, 1.2));
  gd.mood('wow');
  say('如果串列已經排好序', '再做 quick sort 會怎樣？');
  await step(tok);                                   // 6:21 pivot = 第一個；i 找大、j 找小
  tint(row[0], PC.gold);
  const ip = tag('i', 'ptr', X(1), 7.3), jp = tag('j', 'ptr alt', X(6), 7.3);
  move(ip, X(1), 7.3, 0); move(jp, X(0), 7.3, 0);
  gd.mood('calm');
  say('partition 選第一個當 pivot', 'i 往右找更大的、j 往左找 ≤ pivot 的');
  await step(tok);                                   // 6:40 j 一路走回來：切在原位置
  kill(ip); kill(jp);
  glow(row[0], GREEN);
  say('j 一路走回 pivot：切在原來的位置', '已排序 → 每次都切在開頭');
  await step(tok);                                   // 7:05 1～7：1 排好，右邊 2～7
  const rows = [row];
  const r2 = []; for (let k = 1; k < n; k++) r2.push(cube(k + 1, k === 1 ? PC.gold : PC.blue, [0.75, 0.5, 0.7], X(k), 5.65, 0, 1.0));
  rows.push(r2); tag('比較 ≈ 7', 'ptr alt', 4.4, 6.6);
  say('1～7：1 排好了，右邊剩 2～7', '左邊是空的');
  await step(tok);                                   // 7:16 2～7 → 3～7 → … → 7
  for (let d = 2; d < n; d++) {
    for (let k = d; k < n; k++) cube(k + 1, k === d ? PC.gold : PC.blue, [0.75, 0.5, 0.7], X(k), 6.6 - d * 0.95, 0, 0.8);
    tag('比較 ≈ ' + (n - d + 1), 'ptr alt', 4.4, 6.6 - (d - 1) * 0.95);
    await beat(tok, 330);
  }
  tag('比較 ≈ 1', 'ptr alt', 4.4, 6.6 - 6 * 0.95);
  say('2 排好 → 3～7 → 4～7 → 5～7 → 6～7 → 7', '每次都只少一個');
  await step(tok);                                   // 7:31 都切在開頭；遞減就切在尾端
  note('遞增：切在開頭　遞減：切在尾端', -2, 0.2, 1.8);
  gd.mood('sad');
  say('每次都切在串列的開頭', '如果是遞減排序，就每次切在尾端');
  await step(tok);                                   // 7:47 n + (n−1) + … + 1
  pkt('n + (n−1) + (n−2) + … + 2 + 1', 2.6, 7.6);
  gd.mood('calm');
  say('比較次數：n、n − 1、n − 2、……、1', '');
  await step(tok);                                   // 7:59 n(n+1)/2 = O(n²)
  bad('= n(n+1)/2 = O(n²)', 4.4, 0.2, 1.8);
  gd.mood('wow');
  say('總和 = n(n+1)/2', 'worst case = O(n²)');
}]);

// 8:14 跟 merge sort 比較
FRAG.push(['dcbari-qs-cmp', 'Quick sort vs merge sort', async (tok) => {
  fresh([0, 5, 13.5], [0, 2.4, 0]);
  const gd = guide(-6.4, 2.4);
  const bar = (h, col, x, label) => { const m = cube('', col, [1.4, 0.01, 1], x, 0, 0); tag(label, 'idx', x, h + 0.4); return anim(tok, 900, (u) => { m.scale.y = Math.max(1, u * h * 100); m.position.y = u * h / 2; }); };
  await step(tok);                                   // 8:14 worst n²、best n log n
  tag('quick sort', 'ptr', -3, 6.6);
  await Promise.all([bar(5.2, PC.red, -3.9, 'worst：n²'), bar(2.4, PC.green, -2.1, 'best：n log n')]);
  say('quick sort：worst n²、best n log n', 'best case 我們做不到');
  await step(tok);                                   // 8:29 已排序時就會發生
  note('輸入已經排好 → 就會 n²', -3, 6.0);
  gd.mood('sad');
  say('worst case 什麼時候發生？', '串列已經排好序的時候');
  await step(tok);                                   // 8:35 merge sort 沒有 best／worst
  tag('merge sort', 'ptr alt', 3, 6.6);
  await bar(2.4, PC.blue, 3, '一律 n log n');
  gd.mood('calm');
  say('merge sort 沒有 best、worst 之分', '一律 n log n');
  await step(tok);                                   // 8:44 quick sort 平均 n log n、最壞 n²
  good('quick sort：平均 n log n，最壞 n²', 0, 7.4);
  gd.mood('wow');
  say('quick sort 平均是 n log n', '但 worst case 是 n²');
  await step(tok);                                   // 8:58 排好的資料常被拿來再排一次
  note('排好的資料常常又被拿來再排一次 → 這個問題很實際', 0, 0.3, 2.0);
  gd.mood('sad');
  say('串列本來就排好、又被拿來再排一次的機會很高', '這時 quick sort 就會花 n²');
}]);

// 9:15 改善：選中間或隨機 pivot
FRAG.push(['dcbari-qs-pivot', '改善：選中間或隨機的 pivot', async (tok) => {
  fresh([0, 5, 14.5], [0, 3, 0]);
  const gd = guide(-6.6, 2.4);
  const S = [1, 2, 3, 4, 5, 6, 7];
  let ms = [];
  await step(tok);                                   // 9:15 不要總選第一個：選中間
  ms = S.map((v, i) => cube(v, PC.blue, [0.8, 0.55, 0.8], -2.4 + i * 0.95, 6.4, 0, 1.2));
  tint(ms[3], PC.gold); glow(ms[3], GOLD);
  bubble('pivot 改選中間的元素', 0, 7.5);
  say('不要總是選第一個元素當 pivot', '改選中間的元素');
  await step(tok);                                   // 9:28 它會落在中間
  ms.forEach((m, i) => move(m, -2.4 + i * 0.95 + (i < 3 ? -0.5 : i > 3 ? 0.5 : 0), 6.4, 0));
  gd.mood('wow');
  say('已排序時，中間的 4 剛好落在中間', '串列切成兩個一樣大的一半');
  await step(tok);                                   // 9:41 每次都對半 → n log n
  const nodes = [[2, 1, -1.9], [6, 1, 1.9], [1, 2, -2.85], [3, 2, -0.95], [5, 2, 0.95], [7, 2, 2.85]];
  for (const [v, d, x] of nodes) { cube(String(v), PC.green, [0.6, 0.45, 0.6], x, 6.4 - d * 1.5, 0, 1.0); await beat(tok, 200); }
  good('worst case → best case：n² → n log n', 0, 2.4);
  gd.mood('happy');
  say('每次都選中間 → 每次都切在中間', '已排序的 worst case 變成 best case：n log n');
  await step(tok);                                   // 9:59 兩個建議：① 中間當 pivot
  note('① 選中間的元素當 pivot', -3.2, 1.4);
  gd.mood('calm');
  say('改善 worst case 的兩個建議', '① 永遠選中間的元素當 pivot');
  await step(tok);                                   // 10:18 但某些排列仍是 n²
  bad('某些排列還是 n²', -3.2, 0.6);
  gd.mood('sad');
  say('但總有某些排列方式', '最大時間還是 n²');
  await step(tok);                                   // 10:24 ② 隨機選 pivot
  note('② 隨機選一個元素當 pivot', 3.2, 1.4);
  gd.mood('calm');
  say('② 隨機選一個元素當 pivot', '');
  await step(tok);                                   // 10:35 可能 n log n，最壞還是 n²
  bad('最壞還是 n²', 3.2, 0.6);
  gd.mood('wow');
  say('可能 n log n，最壞還是 n²', 'quick sort 的 worst case 一定是 n²');
}]);

// 10:50 空間：stack
FRAG.push(['dcbari-qs-stack', 'Quick sort 的 stack：log n ～ n', async (tok) => {
  fresh([0, 5, 14], [0, 3.2, 0]);
  const gd = guide(-6.6, 2.2);
  await step(tok);                                   // 10:50 不用額外陣列，但用 stack
  tag('best：切在中間', 'ptr', -3, 7.2); tag('worst：已排序', 'ptr alt', 3, 7.2);
  bubble('不需要額外的陣列，但遞迴要用 stack', 0, 7.9);
  say('quick sort 是遞迴的，不需要額外空間', '但會用到 stack');
  await step(tok);                                   // 11:02 worst：n
  for (let d = 0; d < 15; d++) { cube('', PC.red, [2.6, 0.38, 1.2], 3, 0.2 + d * 0.42, 0, 1.2); await beat(tok, 120); }
  pkt('n = 15 層', 3, 6.6);
  gd.mood('sad');
  say('worst case：stack 可能到 n', '');
  await step(tok);                                   // 11:07 best：log n
  for (let d = 0; d < 4; d++) { cube('QS 第' + (d + 1) + '層', PC.blue, [2.6, 0.38, 1.2], -3, 0.2 + d * 0.42, 0, 1.2); await beat(tok, 250); }
  pkt('log n = 4 層', -3, 2.3);
  gd.mood('calm');
  say('best case：樹高 log n', 'stack 大小 log n ～ n');
  await step(tok);                                   // 11:15 取決於 tracing tree 的高度
  good('stack 大小 = tracing tree 的高度', 0, 3.8);
  gd.mood('happy');
  say('stack 大小取決於 tracing tree 的高度', 'best：log n、worst：n');
}]);

// ═════════ 0oJyNmEbS4w：Strassen 矩陣乘法 ═════════
// A、B 是 2×2；格子只寫名稱（影片只用符號，不代數字）
// the grids stand upright (row i at MMY(i)) so the two rows never print over each other
const MMY = (i) => 1.5 - i * 1.0;
function mmGrid(pre, cx, col, z0 = -1.2) {
  const g = [];
  for (let i = 0; i < 2; i++) { g.push([]); for (let j = 0; j < 2; j++) g[i].push(cube(pre + (i + 1) + (j + 1), col, [1.05, 0.5, 0.9], cx - 0.6 + j * 1.2, MMY(i), z0)); }
  return g;
}
// 0:00 一般矩陣乘法：三層迴圈
FRAG.push(['dcbari-mm-loops', '一般矩陣乘法：三層迴圈 n³', async (tok) => {
  fresh([0, 6, 14], [0, 2.4, 0]);
  const gd = guide(-6.6, 2.4);
  let am, bm, cd;
  await step(tok);                                   // 0:00 Strassen：divide and conquer
  const intro = bubble('Strassen 矩陣乘法：divide and conquer', 0, 6.6);
  say('主題：Strassen 矩陣乘法', '屬於 divide and conquer');
  await step(tok);                                   // 0:17 三件事
  const plan = ['① 一般的矩陣乘法', '② 用 divide and conquer 做', '③ Strassen 的改進'].map((s, i) => note(s, 0, 5.7 - i * 0.7));
  gd.mood('wow');
  say('分三步看：一般乘法 → 用分治做 → Strassen 怎麼改進', '');
  await step(tok);                                   // 0:35 兩個 2×2 矩陣
  am = mmGrid('a', -4.6, PC.blue); bm = mmGrid('b', -1.6, PC.purple);
  tag('A（2×2）', 'ptr', -4.6, -0.35, -1.2); tag('B（2×2）', 'ptr', -1.6, -0.35, -1.2); // names under the grids: the code goes above
  tag('×', 'val', -3.1, 0.9, -1.2);
  gd.mood('calm');
  say('先拿兩個 2×2 的矩陣 A、B', '');
  await step(tok);                                   // 0:52 A 的行數 = B 的列數；C 也是 2×2
  tag('=', 'val', 0.1, 0.9, -1.2);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) cube('', '#efe6d2', [1.0, 0.5, 0.2], 1.2 + j * 1.2, MMY(i), -1.55);
  tag('C（2×2）', 'ptr alt', 1.8, -0.35, -1.2);
  say('能相乘：A 的行數 = B 的列數', '結果 C 也是 2×2');
  await step(tok);                                   // 1:18 C[i][j] = Σ A[i][k]·B[k][j]
  remove(intro); pkt('C[i][j] = Σ A[i][k] · B[k][j]（k = 1…n）', 0, 7.1);
  [0, 1].forEach((k) => { glow(am[0][k], GOLD); glow(bm[k][0], GOLD); });
  say('C 的每一格：A 的一列 × B 的一行，加起來', 'C[i][j] = Σ A[i][k]·B[k][j]');
  await step(tok);                                   // 2:14 程式：for i、for j
  [0, 1].forEach((k) => { glow(am[0][k], null); glow(bm[k][0], null); });
  cd = code(['for (i = 0; i < n; i++)', '  for (j = 0; j < n; j++) {', '    C[i][j] = 0;', '    for (k = 0; k < n; k++)', '      C[i][j] += A[i][k] * B[k][j];', '  }'], 0.3, 6.45, 0.72);
  cd.ls.forEach((l) => l.center.set(0, 0.5)); plan.forEach(remove); // left-anchored panel where the plan was
  cd.hl(0);
  say('寫成程式：for i、for j', '');
  await step(tok);                                   // 2:35 C[i][j] = 0；for k …
  cd.hl(4);
  say('C[i][j] = 0，再用 for k 累加', 'C[i][j] += A[i][k] * B[k][j]');
  await step(tok);                                   // 3:06 兩層走訪，一層做一列乘一行
  cd.hl(1);
  note('兩層：走過 C 的每一格　第三層：一列乘一行', 0, -1.0, 0.6);
  say('兩層迴圈走過每一格', '第三層把一列和一行相乘再相加');
  await step(tok);                                   // 3:34 三層 n 次 → n³
  cd.hl(-1);
  good('三層迴圈 → O(n³)', -4.0, 2.6, -1.2);
  gd.mood('happy');
  say('最內層的敘述在三層 n 次迴圈裡', '時間 = O(n³)');
}]);

// 3:58 small problem：2×2 的四個公式
const MMF = ['C11 = a11·b11 + a12·b21', 'C12 = a11·b12 + a12·b22', 'C21 = a21·b11 + a22·b21', 'C22 = a21·b12 + a22·b22'];
FRAG.push(['dcbari-mm-small', 'Small problem：2×2 的四個公式', async (tok) => {
  fresh([0, 6, 14], [0, 2.4, 0]);
  const gd = guide(-6.6, 2.4);
  let am, bm, cs = [];
  await step(tok);                                   // 3:59 改用 divide and conquer
  const bb = bubble('用 divide and conquer 做矩陣乘法', 0, 6.6);
  say('來看 divide and conquer 怎麼用在矩陣乘法', '大就切成子問題、解、再合併');
  await step(tok);                                   // 4:23 先定義 small problem
  const nDef = note('先定義：什麼是 small problem？', 0, 5.7);
  gd.mood('wow');
  say('一直切下去，總要有一個「小到直接解」的大小', '先定義 small problem');
  await step(tok);                                   // 4:48 2×2 是 small
  am = mmGrid('a', -4.6, PC.blue); bm = mmGrid('b', -1.6, PC.purple);
  tag('×', 'val', -3.1, 0.9, -1.2); tag('=', 'val', 0.1, 0.9, -1.2);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) cube('', '#efe6d2', [1.0, 0.5, 0.2], 1.2 + j * 1.2, MMY(i), -1.55);
  good('2×2 = small：直接算', -3.1, 2.5, -1.2);
  gd.mood('calm');
  say('兩個 2×2 矩陣相乘 = small problem', '直接解');
  await step(tok);                                   // 5:07 4×4、8×8 → 切
  note('4×4、8×8…… → 切成子問題', -3.1, 3.4, -1.2);
  say('比 2×2 大（4×4、8×8……）', '就用 divide and conquer 切成子問題');
  remove(nDef); const cd = code(MMF, 3.6, 5.8, 0.75); // the four formulas get the space the question had
  for (let q = 0; q < 4; q++) {
    await step(tok);                                 // 5:32 C11 · 5:55 C12 · 6:19 C21 · 6:36 C22
    const i = q >> 1, j = q & 1;
    cd.hl(q);
    [0, 1].forEach((k) => { glow(am[i][k], GOLD); glow(bm[k][j], GOLD); });
    cs.push(cube('C' + (i + 1) + (j + 1), PC.green, [1.0, 0.5, 0.9], 1.2 + j * 1.2, MMY(i), -1.2, 1.5));
    say(MMF[q], '第 ' + (i + 1) + ' 列 × 第 ' + (j + 1) + ' 行');
    await beat(tok, 900);
    [0, 1].forEach((k) => { glow(am[i][k], null); glow(bm[k][j], null); });
  }
  await step(tok);                                   // 6:54 直接用公式，不用三層迴圈
  cd.hl(-1);
  say('2×2 直接用這四個公式', '不用三層迴圈');
  await step(tok);                                   // 7:10 4 個敘述／8 次乘法：常數
  remove(bb); pkt('4 個敘述、8 次乘法 → 常數時間', 0, 6.6);
  gd.mood('happy');
  say('每個公式算一單位時間：共 4，常數', '數乘法也只有 8 次，一樣是常數');
}]);

// 7:33 1×1 與 2 的次方
FRAG.push(['dcbari-mm-unit', 'n ≤ 2 是 small；維度假設是 2 的次方', async (tok) => {
  fresh([0, 6, 14], [0, 2.4, 0]);
  const gd = guide(-6.6, 2.4);
  await step(tok);                                   // 7:33 再小：1×1
  cube('a11', PC.blue, [0.95, 0.5, 0.9], -4, 0.25, -1.2, 1.5); tag('×', 'val', -3, 0.4, -1.2);
  cube('b11', PC.purple, [0.95, 0.5, 0.9], -2, 0.25, -1.2, 1.5);
  say('如果再小一點：1×1 矩陣', '只有一個元素');
  await step(tok);                                   // 8:06 C = a11·b11；n ≤ 2 都是 small
  tag('=', 'val', -1, 0.4, -1.2); cube('a11·b11', PC.green, [1.4, 0.5, 0.9], 0.4, 0.25, -1.2, 1.5);
  good('n ≤ 2 → small problem', -1.6, 1.9, -1.2);
  gd.mood('happy');
  say('C = a11·b11：一次乘法', '所以 n ≤ 2 都算 small problem');
  await step(tok);                                   // 8:21 比 2×2 大就切
  note('n > 2 → 切成子問題', 3.6, 4.6);
  gd.mood('calm');
  say('比 2×2 大，就要切成子問題來解', '');
  await step(tok);                                   // 8:36 假設維度是 2 的次方
  const sz = [2, 4, 8, 16];
  sz.forEach((n, i) => { const s = 0.25 + i * 0.25; cube(n + '×' + n, PC.orange, [s * 2, 0.4, s * 2], -3 + i * 2.4, 0.2, 2.2, 1.5); });
  gd.mood('wow');
  say('假設矩陣的維度都是 2 的次方', '2×2、4×4、8×8、16×16……一直切會到 2×2 或 1×1');
  await step(tok);                                   // 9:04 不是就補 0
  note('不是 2 的次方 → 補 0 變成 2 的次方的方陣', 0, 5.6);
  gd.mood('calm');
  say('不是 2 的次方怎麼辦？', '補 0，變成 2 的次方的方陣');
}]);

// 9:18 4×4 切成 2×2 的區塊
FRAG.push(['dcbari-mm-blocks', '4×4 切成 2×2 的區塊', async (tok) => {
  fresh([0, 6.5, 14], [0, 2.2, 0]);
  const gd = guide(-6.6, 2.6);
  const cols = [PC.blue, PC.purple, PC.teal, PC.orange], nm = ['11', '12', '21', '22'];
  let am = [], bm = [];
  const make = (cx, pre) => { const ms = []; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const q = (i >> 1) * 2 + (j >> 1); ms.push({ q, m: cube('', PC.sand, [0.55, 0.35, 0.55], cx - 0.9 + j * 0.6, 0.18, -2.6 + i * 0.6, 1.2) }); } tag(pre, 'ptr', cx, 0.3, -3.6); return ms; };
  await step(tok);                                   // 9:18 兩個 4×4
  am = make(-4, 'A（4×4）'); bm = make(-0.4, 'B（4×4）'); tag('×', 'val', -2.2, 0.4, -1.7);
  say('兩個 4×4 的矩陣', '');
  await step(tok);                                   // 9:30 這是 large problem
  gd.mood('wow');
  say('4×4 是 large problem', '要切成子問題、解、再合併');
  await step(tok);                                   // 9:44 列 1～4、行 1～4
  for (let i = 0; i < 4; i++) { tag(String(i + 1), 'idx', -5.4, 0.2, -2.6 + i * 0.6); tag(String(i + 1), 'idx', -4.9 + i * 0.6, 0.2, -3.1); }
  gd.mood('calm');
  say('列從 1 到 4、行也從 1 到 4', '');
  await step(tok);                                   // 9:59 對半切 → 四個 2×2
  for (const ms of [am, bm]) ms.forEach((o) => { tint(o.m, cols[o.q]); const p = o.m.position; move(o.m, p.x + ((o.q & 1) ? 0.25 : -0.25), 0.18, p.z + ((o.q >> 1) ? 0.25 : -0.25)); });
  say('維度除以 2：每個矩陣切成四個 2×2', '');
  await step(tok);                                   // 10:21 把子矩陣當成一個元素：A11…
  for (let q = 0; q < 4; q++) tag('A' + nm[q], 'pkt', -4 + ((q & 1) ? 0.85 : -0.85), 0.6, -2.6 + ((q >> 1) ? 1.75 : 0.05));
  gd.mood('wow');
  say('把每個 2×2 子矩陣當成一個「元素」', 'A11、A12、A21、A22');
  await step(tok);                                   // 10:50 B11…B22
  for (let q = 0; q < 4; q++) tag('B' + nm[q], 'pkt', -0.4 + ((q & 1) ? 0.85 : -0.85), 0.6, -2.6 + ((q >> 1) ? 1.75 : 0.05));
  gd.mood('calm');
  say('B 也一樣：B11、B12、B21、B22', '');
  await step(tok);                                   // 11:02 變成 2×2 乘法：直接套公式
  note('C11 = A11·B11 + A12·B21 ……（同樣四個公式）', 2.6, 4.4);
  gd.mood('happy');
  say('把子矩陣當元素，就變成 2×2 乘法', '套用同樣的四個公式');
}]);

// 11:25 Algorithm MM(A, B, n)
FRAG.push(['dcbari-mm-algo', 'Algorithm MM(A, B, n)：8 次遞迴', async (tok) => {
  fresh([0, 6, 14.5], [0, 2.8, 0]);
  const gd = guide(-6.6, 2.6);
  const cd = code(['Algorithm MM(A, B, n) {', '  if (n <= 2)', '    C = 四個公式;', '  else {', '    mid = n / 2;', '    C11 = MM(A11, B11, n/2) + MM(A12, B21, n/2);', '    C12 = MM(A11, B12, n/2) + MM(A12, B22, n/2);', '    C21 = MM(A21, B11, n/2) + MM(A22, B21, n/2);', '    C22 = MM(A21, B12, n/2) + MM(A22, B22, n/2);', '  }', '}'], -1.0, 7.3, 0.46);
  const calls = [['11', '11'], ['12', '21'], ['11', '12'], ['12', '22'], ['21', '11'], ['22', '21'], ['21', '12'], ['22', '22']];
  const callBox = (k) => cube('A' + calls[k][0] + '·B' + calls[k][1], k < 4 ? PC.blue : PC.purple, [1.7, 0.45, 0.8], -5.4 + (k % 4) * 1.9 + (k % 4 > 1 ? 0.4 : 0), 0.25, k < 4 ? 0.6 : 2.0, 1.2);
  await step(tok);                                   // 11:25 MM(A, B, n)
  cd.hl(0);
  say('Algorithm MM(A, B, n)', '只是想法，不是能直接執行的程式');
  await step(tok);                                   // 12:01 n ≤ 2 → 四個公式
  cd.hl(2);
  say('if (n <= 2)：用四個公式直接算 C', '真正的乘法在這裡發生');
  await step(tok);                                   // 12:28 else：切開，mid = n/2
  cd.hl(4);
  gd.mood('wow');
  say('large：把矩陣切開，mid = n / 2', '切開再合併');
  await step(tok);                                   // 12:50 把區塊當元素相乘
  note('區塊當成元素：這兩個乘、那兩個乘、再相加', 3.4, 2.2);
  gd.mood('calm');
  say('切成區塊後，把區塊當成元素相乘', '');
  await step(tok);                                   // 13:07 MM(A11, B11) + MM(A12, B21)
  cd.hl(5); callBox(0); await beat(tok, 300); callBox(1);
  say('MM(A11, B11, n/2) + MM(A12, B21, n/2)', '遞迴呼叫');
  await step(tok);                                   // 13:41 這就是 C11
  pkt('= C11', -5.6, 1.0, 0.6);
  say('C11 = A11·B11 + A12·B21', '把子矩陣當元素，用同一個公式');
  await step(tok);                                   // 14:17 C12
  cd.hl(6); callBox(2); await beat(tok, 300); callBox(3);
  say('C12：第一列 × 第二行', 'MM(A11, B12, n/2) + MM(A12, B22, n/2)');
  await step(tok);                                   // 14:53 C21、C22
  cd.hl(7); for (let k = 4; k < 8; k++) { callBox(k); await beat(tok, 250); }
  cd.hl(8);
  say('剩下的 C21、C22 也一樣', '共 8 次遞迴呼叫');
  await step(tok);                                   // 15:30 4×4 → 2×2 → 直接算
  cd.hl(-1);
  note('4×4 → 切成 2×2 → 用公式', 3.4, 1.2);
  say('例如 4×4 切成 2×2 的小問題', '2×2 再用公式直接乘');
  await step(tok);                                   // 15:57 + 是矩陣加法
  bad('這裡的 + 是矩陣加法，不是數字加法', 3.4, 4.2);
  gd.mood('wow');
  say('注意：這裡的 + 是矩陣加法', '不是一般的純量加法');
}]);

// 16:27 T(n) = 8T(n/2) + n²（params.a = 8）／ 22:25 T(n) = 7T(n/2) + n²（params.a = 7）
FRAG.push(['dcbari-mm-rec', '8T(n/2) + n² = n³ vs 7T(n/2) + n² = n^2.81', async (tok) => {
  const a = (ctx.params || {}).a || 8;
  fresh([0, 5.5, 14], [0, 3, 0]);
  const gd = guide(-6.6, 2.4);
  const eq = (t, y, cls = '') => { const l = tag(t, cls, 0, y); Object.assign(l.element.style, { whiteSpace: 'pre', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '13px', fontWeight: '700' }); return l; };
  if (a === 8) {
    await step(tok);                                 // 16:27 呼叫自己 8 次
    for (let k = 0; k < 8; k++) { cube('MM', PC.blue, [0.75, 0.45, 0.7], -3.5 + k * 1.0, 0.25, 2.0, 1 + k * 0.1); }
    pkt('呼叫自己 8 次', 0, 1.2, 2.0);
    say('這個遞迴演算法呼叫自己幾次？', '1、2、…、8：8 次');
    await step(tok);                                 // 16:35 recurrence：規模 n/2
    const e1 = eq('T(n) = 8 T(n/2)', 6.2);
    gd.mood('wow');
    say('寫 recurrence：每次規模切成 n/2', '維度假設是 2 的次方');
    await step(tok);                                 // 16:53 8 次 → 8T(n/2)
    say('呼叫 8 次 → 8T(n/2)', '');
    await step(tok);                                 // 17:02 合併：矩陣加法 n²
    note('n×n 矩陣相加：n² 個元素逐一相加 → n²', 0, 4.6);
    gd.mood('calm');
    say('合併的工作是矩陣加法', 'n² 個元素逐一相加 → n²');
    await step(tok);                                 // 17:37 完整 recurrence
    txt(e1, 'T(n) = 8 T(n/2) + n²   , n > 2'); eq('T(n) = 1              , n ≤ 2', 5.5);
    say('T(n) = 8T(n/2) + n²（n > 2）', 'n ≤ 2：四個公式，常數 1');
    await step(tok);                                 // 17:59 master theorem：a = 8、b = 2、f = n²
    pkt('a = 8', -3, 3.4); pkt('b = 2', -1, 3.4); pkt('f(n) = n²', 1.4, 3.4);
    gd.mood('wow');
    say('套 master theorem：a = 8、b = 2', 'f(n) = n²');
    await step(tok);                                 // 18:17 log₂8 = 3 > k = 2
    note('log₂8 = 3　>　k = 2 → case 1', 0, 2.6);
    say('log_b a = log₂8 = 3，k = 2', '3 > 2 → case 1');
    await step(tok);                                 // 18:41 Θ(n³)
    bad('Θ(n³)', 3.6, 2.6);
    gd.mood('sad');
    say('時間 = Θ(n³)', '分治版也是 n³，跟三層迴圈一樣');
    await step(tok);                                 // 19:03 遞迴用 stack：空間還比較差
    note('遞迴要用 stack → 空間上三層迴圈比較好', 0, 0.2, 2.6);
    gd.mood('calm');
    say('而且遞迴要用 stack，占額外空間', '空間上反而是三層迴圈比較好');
    return;
  }
  // a = 7：Strassen
  await step(tok);                                   // 22:31 只呼叫自己 7 次
  for (let k = 0; k < 7; k++) cube('MM', PC.green, [0.75, 0.45, 0.7], -3.0 + k * 1.0, 0.25, 2.0, 1 + k * 0.1);
  pkt('只呼叫 7 次（不是 8 次）', 0, 1.2, 2.0);
  gd.mood('wow');
  say('套用分治後，只呼叫自己 7 次', '不是 8 次');
  await step(tok);                                   // 22:45 T(n) = 7T(n/2) + n²
  eq('T(n) = 7 T(n/2) + n²   , n > 2', 6.2);
  gd.mood('calm');
  say('T(n) = 7T(n/2) + n²', 'n > 2 時');
  await step(tok);                                   // 22:57 n ≤ 2 → 1
  eq('T(n) = 1              , n ≤ 2', 5.5);
  say('n ≤ 2 時 T(n) = 1', '');
  await step(tok);                                   // 23:03 log₂7 ≈ 2.81 > 2
  note('log₂7 ≈ 2.81　>　k = 2', 0, 3.6);
  say('log₂7 ≈ 2.81，k = 2', '2.81 比較大');
  await step(tok);                                   // 23:15 Θ(n^2.81)
  good('Θ(n^log₂7) ≈ Θ(n^2.81)', 0, 2.6);
  gd.mood('happy'); await gd.hop(tok);
  say('時間 = O(n^log₂7) = O(n^2.81)', '比 n³ 少一點：Strassen 的改進');
}]);

// 19:21 Strassen：7 次乘法
FRAG.push(['dcbari-strassen7', 'Strassen：P、Q、R、S、T、U、V 七次乘法', async (tok) => {
  fresh([0, 6, 14.5], [0, 2.6, 0]);
  const gd = guide(-6.6, 2.6);
  const F = [['P', '(A11 + A22)(B11 + B22)'], ['Q', '(A21 + A22)·B11'], ['R', 'A11·(B12 − B22)'], ['S', 'A22·(B21 − B11)'], ['T', '(A11 + A12)·B22'], ['U', '(A21 − A11)(B11 + B12)'], ['V', '(A12 − A22)(B21 + B22)']];
  let cd, pm = {};
  await step(tok);                                   // 19:21 n³ 太慢：能更快嗎？
  const b0 = bubble('n³ 太慢了：能不能更快？', 0, 6.6);
  gd.mood('wow');
  say('n³ 比一般的 n²、n log n 慢', '能不能更快？這是個研究題目');
  await step(tok);                                   // 19:56 四個公式、8 次乘法
  const old = code(MMF, -3.4, 5.4, 0.5);
  const p8 = pkt('8 次乘法', -3.4, 3.2);
  gd.mood('calm');
  say('一般的四個公式（遞迴版也是）', '一共 8 次乘法');
  await step(tok);                                   // 20:15 主要的成本是乘法
  const n1 = note('主要的工作是乘法 → 少乘一次就更快', 3.4, 4.6);
  say('矩陣乘法主要的工作就是乘法', '減少乘法的次數，演算法就更快');
  await step(tok);                                   // 20:29 Strassen：7 次乘法的公式
  const n2 = good('Strassen：改用 7 次乘法的公式', 3.4, 3.6);
  gd.mood('wow');
  say('Strassen 給了另一組公式', '只用 7 次乘法，讓時間比 n³ 小一點');
  await step(tok);                                   // 21:11 加減法變多，但比較便宜
  const n3 = note('加減法變多，但加減比乘法便宜', 3.4, 2.6);
  gd.mood('calm');
  say('加法、減法變多了', '但加減法比乘法便宜');
  await step(tok);                                   // 21:40 P、Q、R、S、T、U、V
  old.kill(); [b0, p8, n1, n2, n3].forEach(remove);
  cd = code(F.map(([k, f]) => k + ' = ' + f), -3.0, 7.2, 0.5);
  const cnt = tag('乘法 0 次', 'ptr alt', 3.6, 7.2);
  for (let q = 0; q < 7; q++) { cd.hl(q); txt(cnt, '乘法 ' + (q + 1) + ' 次'); pm[F[q][0]] = cube(F[q][0], PC.orange, [0.9, 0.45, 0.9], -5.4 + q * 1.8, 0.23, 1.6, 1.5); await beat(tok, 300); }
  cd.hl(-1);
  say('P、Q、R、S、T、U、V 七個式子', '每個只有一次乘法：共 7 次');
  await step(tok);                                   // 22:06 再用它們組出 C
  const G = [['C11 = P + S − T + V', ['P', 'S', 'T', 'V']], ['C12 = R + T', ['R', 'T']], ['C21 = Q + S', ['Q', 'S']], ['C22 = P + R − Q + U', ['P', 'R', 'Q', 'U']]];
  G.forEach(([s], q) => tag(s, 'say', 3.6, 5.9 - q * 0.7));
  for (const [, ks] of G) { ks.forEach((k) => glow(pm[k], GOLD)); await beat(tok, 450); ks.forEach((k) => glow(pm[k], null)); }
  say('用這七個結果組出 C11、C12、C21、C22', '取代原本的四個公式');
  await step(tok);                                   // 22:23 公式多了，乘法少了
  good('公式、加減法變多；乘法 8 → 7', 0, 3.2);
  say('公式和加減法都變多了', '但乘法的次數減少了');
}]);

// ═════════ u7YMFRUFqe0：maximum subarray（LeetCode 例 [-2,1,-3,4,-1,2,1,-5,4]） ═════════
const MS = [-2, 1, -3, 4, -1, 2, 1, -5, 4];
const MX = (i) => -5.6 + i * 1.4;
function msRow(z = 0, y = 0.3, drop = 0) { return MS.map((v, i) => { tag(String(i), 'idx', MX(i), 0, z + 0.9); return cube(v, v >= 0 ? PC.blue : PC.red, [1.1, 0.6, 0.9], MX(i), y, z, drop); }); }

FRAG.push(['dcbari-msub-intro', 'Maximum subarray：連續、總和最大', async (tok) => {
  fresh([0, 5.5, 13.5], [0, 1.4, 0]);
  const gd = guide(-6.6, 2.4);
  let ms = [];
  await step(tok);                                   // 0:02 maximum subarray 的幾種解法
  bubble('maximum subarray problem', 0, 4.6);
  say('Maximum subarray：用幾種不同的方法解', '');
  await step(tok);                                   // 0:08 題目
  ms = msRow(0, 0.3, 1.5);
  note('連續的一段、至少一個數、總和最大 → 回傳總和', 0, 3.6);
  gd.mood('wow');
  say('給一個整數陣列 nums', '找總和最大的「連續」subarray（至少一個數），回傳它的和');
  await step(tok);                                   // 0:26 答案 6
  for (let i = 3; i <= 6; i++) { glow(ms[i], GOLD); tint(ms[i], PC.green); await beat(tok, 250); }
  const g = ghostBox(PC.green, 4 * 1.4, 1, 1.3); g.position.set((MX(3) + MX(6)) / 2, 0.5, 0);
  good('4 + (−1) + 2 + 1 = 6', (MX(3) + MX(6)) / 2, 1.6);
  gd.mood('happy');
  say('例子的答案是 6', '[4, −1, 2, 1]');
  await step(tok);                                   // 0:35 做法一：雙層迴圈（自己試）
  pkt('① 雙層迴圈（naive）：自己試試', -3, 5.6);
  gd.mood('calm');
  say('第一種：naive 解法，用雙層 for 迴圈', '留給你自己試');
  await step(tok);                                   // 0:40 做法二：divide and conquer
  pkt('② divide and conquer', 3, 5.6);
  gd.mood('wow');
  say('第二種：divide and conquer', '先從這個開始');
}]);

FRAG.push(['dcbari-msub-algo', '分治：max(左半, 右半, 跨中點)', async (tok) => {
  fresh([0, 6, 13.5], [0, 1.6, 0]);
  const gd = guide(-6.6, 2.8);
  const ms = msRow(0.8);
  const piv = 4;
  await step(tok);                                   // 0:53 分成子問題、解、往回合併
  bubble('切成子問題 → 解 → 往回走時合併', 0, 6.6);
  say('把問題切成子問題、找到子問題的解', '往回走的時候把解合併');
  await step(tok);                                   // 1:05 遞迴：切成兩半
  tag('mid', 'ptr alt', MX(piv), 1.4, 0.8);
  const gl = ghostBox(PC.blue, 5 * 1.4, 0.9, 1.2); gl.position.set((MX(0) + MX(4)) / 2, 0.45, 0.8);
  const gr = ghostBox(PC.purple, 4 * 1.4, 0.9, 1.2); gr.position.set((MX(5) + MX(8)) / 2, 0.45, 0.8);
  say('遞迴：把陣列切成兩半', '');
  await step(tok);                                   // 1:19 回傳三者最大
  const cd = code(['max( 左半的答案,', '     右半的答案,', '     cross sum )'], 0, 5.6, 0.5);
  gd.mood('wow');
  say('回傳三者的最大值', '左半、右半、cross sum（跨過中點）');
  await step(tok);                                   // 1:28 left subsum：從 mid 往左
  cd.hl(2);
  for (let i = piv; i >= 0; i--) { glow(ms[i], GOLD); await beat(tok, 200); }
  pkt('← left subsum', MX(2), 2.4, 0.8);
  gd.mood('calm');
  say('left subsum：從中點開始、往左延伸的最大和', '');
  await step(tok);                                   // 1:48 right subsum：從 mid+1 往右
  for (let i = piv + 1; i < 9; i++) { glow(ms[i], GREEN); await beat(tok, 200); }
  pkt('right subsum →', MX(6.5), 2.4, 0.8);
  say('right subsum：從 mid + 1 開始、往右延伸的最大和', '');
  await step(tok);                                   // 1:55 cross = 兩者相加
  good('cross sum = left subsum + right subsum', 0, 3.4);
  gd.mood('happy');
  say('cross sum = left subsum + right subsum', '');
}]);

FRAG.push(['dcbari-msub-dc', '分治例子：切到單一元素再往上合', async (tok) => {
  const part = (ctx.params || {}).part || 'divide';
  fresh([0, 5, 15], [0, 3.2, 0]);
  const gd = guide(-6.6, 2.4);
  const Y = (d) => 6.4 - d * 1.5, SX = (l, h) => (MX(l) + MX(h)) / 2;
  const segs = {};
  const mk = (l, h, d, drop) => { segs[l + '-' + h] = cube(MS.slice(l, h + 1).join(', '), l === h ? (MS[l] >= 0 ? PC.blue : PC.red) : PC.purple, [(h - l + 1) * 1.4 - 0.2, 0.5, 0.8], SX(l, h), Y(d), 0, drop); };
  const tree = [[0, 8, 0], [0, 4, 1], [5, 8, 1], [0, 2, 2], [3, 4, 2], [5, 6, 2], [7, 8, 2], [0, 1, 3], [2, 2, 3], [3, 3, 3], [4, 4, 3], [5, 5, 3], [6, 6, 3], [7, 7, 3], [8, 8, 3], [0, 0, 4], [1, 1, 4]];
  const par = (l, h, d) => tree.find(([a, b, dd]) => dd === d - 1 && a <= l && h <= b);
  const lvl = (d, drop) => { for (const [l, h, dd] of tree) if (dd === d) { mk(l, h, d, drop); const p = par(l, h, d); if (p) line(SX(p[0], p[1]), Y(p[2]) - 0.25, SX(l, h), Y(d) + 0.25); } };
  if (part === 'divide') {
    await step(tok);                                 // 2:05 輸入陣列，切兩半
    mk(0, 8, 0, 1.2);
    say('用例子來看：輸入陣列', '要把它切成兩半');
    await step(tok);                                 // 2:15 pivot = 中點
    glow(segs['0-8'], GOLD); pkt('pivot = 中點（索引 4）', MX(4), 7.3);
    gd.mood('wow');
    say('切的位置叫 pivot', 'pivot 通常就是陣列的中點');
    await step(tok);                                 // 2:22 左半：開頭 ～ pivot
    glow(segs['0-8'], null);
    mk(0, 4, 1, 1.2); line(SX(0, 8), Y(0) - 0.25, SX(0, 4), Y(1) + 0.25);
    gd.mood('calm');
    say('左半：從開頭到 pivot（含 pivot）', '[−2, 1, −3, 4, −1]');
    await step(tok);                                 // 2:27 右半：pivot+1 ～ 結尾
    mk(5, 8, 1, 1.2); line(SX(0, 8), Y(0) - 0.25, SX(5, 8), Y(1) + 0.25);
    say('右半：從 pivot + 1 到結尾', '[2, 1, −5, 4]');
    await step(tok);                                 // 2:34 一直切到單一元素
    for (let d = 2; d <= 4; d++) { lvl(d, 1.0); await beat(tok, 500); }
    gd.mood('happy');
    say('一樣的方法繼續切', '直到每段只剩單一元素');
    return;
  }
  // part 'small'：樹已經畫好，從左半往上合併
  for (let d = 0; d <= 4; d++) lvl(d, 0);
  const s01 = segs['0-1'], s02 = segs['0-2'];
  await step(tok);                                   // 2:47 先看左半，往上合併
  glow(segs['0-4'], GOLD);
  say('先看左半邊', '從下往上走，把子陣列的解合併');
  await step(tok);                                   // 2:54 [−2, 1]：pivot −2，left −2
  glow(segs['0-4'], null); glow(s01, GOLD);
  pkt('left = −2', SX(0, 1) - 1.2, Y(3) + 0.7);
  gd.mood('wow');
  say('從 [−2, 1] 開始：pivot 是 −2', '左邊只有一個元素 → left sum = −2');
  await step(tok);                                   // 3:09 right 1，cross −1
  pkt('right = 1', SX(0, 1) + 1.2, Y(3) + 0.7);
  gd.mood('calm');
  say('right sum = 1', 'cross sum = −2 + 1 = −1');
  await step(tok);                                   // 3:23 max = 1
  tint(s01, PC.green); relabel(s01, 'max = 1'); glow(s01, null);
  gd.mood('happy');
  say('max(−2, 1, −1) = 1', '如果輸入只有 [−2, 1]，答案就是 1');
  await step(tok);                                   // 3:32 −3 單一元素
  glow(segs['2-2'], GOLD);
  gd.mood('calm');
  say('−3 只有一個元素', '最大值就是 −3');
  await step(tok);                                   // 3:42 往上：[−2, 1, −3]，pivot 1
  glow(segs['2-2'], null); glow(s02, GOLD);
  say('往上一層：[−2, 1, −3]', '左、右的答案已經算過了；pivot 是 1');
  await step(tok);                                   // 4:07 left subsum：1、1 + (−2) → 1
  pkt('1 → 1 + (−2) = −1 → 取 1', SX(0, 2), Y(2) + 0.75);
  say('left subsum：從 pivot 往左', '先是 1，再加左邊的 −2 得 −1 → 取 1');
  await step(tok);                                   // 4:21 right subsum −3
  pkt('right subsum = −3', SX(0, 2) + 2.6, Y(2) + 0.75);
  say('右邊只有 −3 → right subsum = −3', '');
  await step(tok);                                   // 4:30 cross −2，max 1
  tint(s02, PC.green); relabel(s02, 'max = 1'); glow(s02, null);
  gd.mood('happy');
  say('cross sum = 1 + (−3) = −2', 'max(1, −3, −2) = 1');
  await step(tok);                                   // 4:39 右邊的子陣列也一樣
  for (const [k, v] of [['3-4', 4], ['0-4', 4]]) { tint(segs[k], PC.green); relabel(segs[k], 'max = ' + v); await beat(tok, 400); }
  gd.mood('calm');
  say('其他子陣列也用同樣方法算', '');
  await step(tok);                                   // 4:45 自己算一次反白的
  for (const [k, v] of [['5-6', 3], ['7-8', 4], ['5-8', 4]]) { glow(segs[k], GOLD); relabel(segs[k], 'max = ?'); }
  gd.mood('wow');
  say('建議你自己算算看反白的那幾段', '卡住再對照解答');
}]);

FRAG.push(['dcbari-msub-cross', '整個陣列的 cross sum = 6', async (tok) => {
  fresh([0, 6, 13.5], [0, 1.4, 0]);
  const gd = guide(-6.6, 2.6);
  const ms = msRow(0.6);
  tag('pivot', 'ptr alt', MX(4), 1.3, 0.6);
  const sums = [];
  let lt, rt;
  await step(tok);                                   // 4:59 右半也算好：有左、右的答案
  lt = tag('左半 max = 4', 'ptr', -3, 4.6); rt = tag('右半 max = 4', 'ptr', 3, 4.6);
  say('右半用同樣方法解完', '現在有左半的答案 4、右半的答案 4');
  await step(tok);                                   // 5:12 接著算 cross sum
  bubble('還差 cross sum：先自己算算看', 0, 5.6);
  gd.mood('wow');
  say('接下來算整個陣列的 cross sum', '可以先暫停自己算');
  await step(tok);                                   // 5:40 從 pivot 往左，算每一格的累加
  let s = 0;
  for (let i = 4; i >= 0; i--) { s += MS[i]; glow(ms[i], GOLD); sums.push(tag(String(s), 'idx', MX(i), 1.2, -1)); await beat(tok, 300); }
  gd.mood('calm');
  say('從 pivot 開始往左', '每一格的累加：−1、3、0、1、−1');
  await step(tok);                                   // 5:52 取最大 = left subsum 3
  for (let i = 0; i < 3; i++) glow(ms[i], null);
  txt(lt, 'left subsum = 3（索引 3～4）');
  say('取這些累加的最大值', 'left subsum = 3');
  await step(tok);                                   // 6:00 right subsum 自己算
  let s2 = 0;
  for (let j = 5; j < 9; j++) { s2 += MS[j]; glow(ms[j], GREEN); tag(String(s2), 'idx', MX(j), 1.2, -1); await beat(tok, 300); }
  for (let j = 7; j < 9; j++) glow(ms[j], null);
  txt(rt, 'right subsum = 3（索引 5～6）');
  say('right subsum 請你自己算', '往右累加：2、3、−2、2 → 最大 3');
  await step(tok);                                   // 6:05 答案 max(4, 4, 6) = 6
  for (let i = 3; i <= 6; i++) tint(ms[i], PC.green);
  good('cross = 3 + 3 = 6　→　max(4, 4, 6) = 6', 0, 3.4);
  gd.mood('happy'); await gd.hop(tok);
  say('cross sum = 3 + 3 = 6', '最後答案 = max(4, 4, 6) = 6');
}]);

FRAG.push(['dcbari-msub-greedy', 'Greedy：current sum 與 max sum', async (tok) => {
  fresh([0, 6, 13], [0, 1.4, 0]);
  const gd = guide(-6.6, 2.6);
  const ms = msRow(0.6);
  let cd, cl, ml, cur;
  await step(tok);                                   // 6:12 換一種方法
  bubble('第三種方法：greedy', 0, 5.6);
  say('換另一種方法來解', '');
  await step(tok);                                   // 6:19 current、max 都設成第一個值
  cd = code(['current = max = nums[0]', 'for x in nums[1..]:', '  current = max(current + x, x)', '  max = max(max, current)', 'return max'], 2.4, 6.6, 0.45); cd.hl(0);
  say('演算法：current sum、max sum', '都先設成陣列的第一個值');
  await step(tok);                                   // 6:29 current = 局部、max = 全域
  note('current：局部最大　max：全域最大', -3.2, 4.2);
  gd.mood('wow');
  say('current sum 存局部的最大和', 'max sum 存全域的最大和');
  await step(tok);                                   // 6:38 current = max(current + x, x)
  cd.hl(2); gd.mood('calm');
  say('每個元素：current = max(current + x, x)', '接著前面的和，或是從自己重新開始');
  await step(tok);                                   // 6:51 max = max(max, current)
  cd.hl(3);
  say('max = max(max, current)', '最後答案是 max');
  await step(tok);                                   // 7:00 同一個陣列，初始狀態
  cd.hl(0);
  cl = tag('current = −2', 'ptr', -2.8, 3.0); ml = tag('max = −2', 'ptr alt', 2.8, 3.0);
  cur = tag('▼', 'ptr alt', MX(0), 1.5, 0.6); glow(ms[0], GOLD);
  say('同一個輸入陣列', '一開始 current = max = −2');
  let c = MS[0], b = MS[0];
  await step(tok);                                   // 7:07 current = max(−2 + 1, 1) = 1
  glow(ms[0], null); move(cur, MX(1), 1.5, 0.6); glow(ms[1], GOLD); cd.hl(2);
  c = Math.max(c + MS[1], MS[1]); txt(cl, 'current = ' + c);
  say('current = max(−2 + 1, 1)', '= max(−1, 1) = 1');
  await step(tok);                                   // 7:20 max 更新成 1
  cd.hl(3); b = Math.max(b, c); txt(ml, 'max = ' + b);
  gd.mood('happy');
  say('max = max(−2, 1) = 1', '');
  await step(tok);                                   // 7:26 一路走完
  glow(ms[1], null); gd.mood('calm');
  for (let i = 2; i < 9; i++) { move(cur, MX(i), 1.5, 0.6); c = Math.max(c + MS[i], MS[i]); b = Math.max(b, c); txt(cl, 'current = ' + c); txt(ml, 'max = ' + b); glow(ms[i], GOLD); await beat(tok, 300); glow(ms[i], null); }
  say('同樣走過整個陣列', '每一格更新 current 和 max');
  await step(tok);                                   // 7:34 max 就是答案
  cd.hl(4);
  good('答案 = max = 6', 2.8, 4.0);
  gd.mood('happy'); await gd.hop(tok);
  say('最後 max 裡的值就是答案', '6');
}]);

FRAG.push(['dcbari-msub-kadane', 'Kadane：前一格 > 0 就加上去', async (tok) => {
  fresh([0, 6, 13], [0, 1.4, 0]);
  const gd = guide(-6.6, 2.6);
  const ms = msRow(0.6), v = MS.slice();
  let cd, ml;
  await step(tok);                                   // 7:50 更常見：Kadane（dynamic programming）
  bubble('Kadane\'s algorithm（dynamic programming）', 0, 5.8);
  say('更常見的演算法：Kadane', '用 dynamic programming，跟 greedy 很像');
  await step(tok);                                   // 8:01 直接更新 input array
  note('不另存 current：直接改 input array', 0, 4.9);
  gd.mood('wow');
  say('差別：不把 current sum 存在另一個變數', '直接更新輸入陣列');
  await step(tok);                                   // 8:12 max 初值 = nums[0]
  cd = code(['max = nums[0]', 'for i = 1 .. n−1:', '  if nums[i−1] > 0: nums[i] += nums[i−1]', '  max = max(max, nums[i])'], 1.4, 4.0, 0.45); cd.hl(0);
  gd.mood('calm');
  say('max sum 先設成第一個值', 'max 存全域的最大和');
  await step(tok);                                   // 8:24 前一格 > 0 → 加上去
  cd.hl(2);
  say('從索引 1 開始：前一格 > 0', '就把前一格加到目前這一格');
  await step(tok);                                   // 8:33 max = max(max, nums[i])
  cd.hl(3);
  say('max = max(max, nums[i])', '最後答案是 max');
  await step(tok);                                   // 8:38 同一個陣列：max = −2
  cd.hl(0);
  ml = tag('max = −2', 'ptr alt', -4.4, 4.0);
  say('同一個輸入陣列', 'max 初值 = −2');
  let b = v[0];
  await step(tok);                                   // 8:49 i = 1：nums[0] < 0，不更新
  cd.hl(2); glow(ms[0], GOLD); glow(ms[1], GOLD);
  bad('nums[0] = −2 ≤ 0：不加', MX(0), 1.6, -1);
  say('i = 1：nums[0] = −2 < 0', '不符合條件，不更新目前這一格');
  await step(tok);                                   // 9:02 max 更新成 1
  cd.hl(3); b = Math.max(b, v[1]); txt(ml, 'max = ' + b);
  glow(ms[0], null); glow(ms[1], null);
  gd.mood('happy');
  say('max = max(−2, 1) = 1', '');
  await step(tok);                                   // 9:09 一路往後更新
  gd.mood('calm');
  for (let i = 2; i < 9; i++) {
    if (v[i - 1] > 0) { v[i] += v[i - 1]; relabel(ms[i], v[i]); tint(ms[i], v[i] >= 0 ? PC.green : PC.red); }
    b = Math.max(b, v[i]); txt(ml, 'max = ' + b); glow(ms[i], GOLD); await beat(tok, 300); glow(ms[i], null);
  }
  say('同樣的方法往後更新陣列和 max', '陣列變成：−2 1 −2 4 3 5 6 1 5');
  await step(tok);                                   // 9:30 max = 6
  good('max sum = 6', -4.4, 4.8);
  gd.mood('happy'); await gd.hop(tok);
  say('max 裡的值就是答案：6', '');
}]);

FRAG.push(['dcbari-msub-cplx', '複雜度比較', async (tok) => {
  fresh([0, 5.5, 13.5], [0, 2.4, 0]);
  const gd = guide(-6.6, 2.4);
  await step(tok);                                   // 9:35 複雜度分析
  tag('時間', 'ptr', 0.8, 5.4); tag('空間', 'ptr', 3.6, 5.4);
  say('看三種演算法的複雜度', '');
  await step(tok);                                   // 9:40 分治 O(n log n)、O(log n)
  cube('divide and conquer', PC.purple, [3.2, 0.6, 1], -3.4, 4.0, 0, 1.5);
  pkt('O(n log n)', 0.8, 4.0); pkt('O(log n)（stack）', 3.6, 4.0);
  gd.mood('calm');
  say('divide and conquer：時間 O(n log n)', '空間 O(log n)：遞迴的 stack（影片沒唸出來，這是標準答案）');
  await step(tok);                                   // 9:48 greedy、Kadane：O(n)、O(1)
  cube('greedy', PC.blue, [3.2, 0.6, 1], -3.4, 2.6, 0, 1.5); cube('Kadane', PC.green, [3.2, 0.6, 1], -3.4, 1.2, 0, 1.5);
  good('O(n)', 0.8, 1.9); good('O(1)', 3.6, 1.9);
  gd.mood('happy'); await gd.hop(tok);
  say('greedy 和 Kadane：時間 O(n)', '空間 O(1)');
}]);
  }

  // ═══ dcjiang.js ═══
  {
// ─── 62uS-MOv0bY / sweW4TVFpbQ：交大江蕙如 Lec15–16 Divide and Conquer（Kleinberg–Tardos 投影片） ───
// Cued scenes: every `await step(tok)` waits for the sentence it shows (cues in the notes); motion between
// steps is short, nothing loops or replays. Small buddies react to what happens.
// 老師自己的例子：weak / strong induction、8×8 defective chessboard（L 形磁磚 21 塊）、骨牌；
// binary search 找 55（41 → 72 → 55，旁邊是 68）；merge sort 用 ALGORITHMS（MERGE 時是 AGLOR + HIMST）；
// counting inversion 用 2 4 1 3 5（3 個）與 1 5 4 8 10 2 | 6 9 12 11 3 7（5 + 8 + 9）；closest pair 的 12、21、8。
// 示意值：binary search 陣列中 41、55、68、72 以外的數；棋盤洞的位置；closest pair 各點座標（只對齊 12 / 21 / 8 三個距離）；
// heap vs linked list 的數值；1D closest pair 的點；動畫 bar 的數值。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, showL, code, anim, line, arrow, ghostBox, lnode, GOLD, GREEN, RED, GRAY, step, buddy, bob, travel, remove } = K;
const beat = ctx.beat, colorFor = ctx.colorFor, lab = ctx.lab, THREE = ctx.THREE;
const say = (a, b = '') => ctx.say(a, b);
const BLUE = '#1f3a6e', OK = '#2fc092', SAND = '#c9b48e', DIM = '#bfb6a6';
const prm = () => ctx.params || {};
const lc = (ch) => colorFor(String(ch).charCodeAt(0));
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
// a little helper character (no value on its belly)
const pal = (name, x, z = 1.6, color = '#f4a56a', size = 0.75, y = 0) => buddy(name, '', color, x, y, z, size);
const BS = [3, 14, 27, 31, 39, 41, 55, 68, 72, 85, 93];
// a row of value cubes; R.x(i) is slot i's x
function jRow(vals, o = {}) {
  const dx = o.dx || 1.1, y = o.y ?? 0.5, z = o.z || 0, sz = o.sz || 0.8, n = vals.length;
  const x0 = o.x0 ?? -(n - 1) * dx / 2;
  const R = { v: vals.slice(), m: [], n, y, z, dx, x: (i) => x0 + i * dx };
  if (o.tiles) for (let i = 0; i < n; i++) ctx.tile(V3(R.x(i), 0.02, z), dx * 0.9, 1.0);
  if (o.idx) for (let i = 0; i < n; i++) tag(String(i + (o.base ?? 1)), 'idx', R.x(i), y - 0.8, z);
  vals.forEach((v, i) => { R.m[i] = v === null ? null : cube(v, o.col ? o.col(v) : colorFor(v), [sz, sz, sz], R.x(i), y, z, o.drop ? 2 : 0); });
  return R;
}
// a straight segment in 3D (any plane)
function seg(a, b, color = '#6e5f49') {
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color }));
  lab.world.add(l); return l;
}
// a thin bar on the floor from (x1,z1) to (x2,z2)
function bar(x1, z1, x2, z2, color = '#6e5f49', w = 0.06) {
  const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
  const m = cube(null, color, [len, 0.05, w], (x1 + x2) / 2, 0.08, (z1 + z2) / 2);
  m.rotation.y = -Math.atan2(dz, dx); return m;
}

// ═════════════ Lec15 ═════════════

// 00:16 D&C ↔ 數學歸納法；weak vs strong
FRAG.push(['dcjiang-induction', 'Weak vs Strong induction', async (tok) => {
  fresh([0, 3.6, 13], [0, 2.4, 0]);
  const xs = (i) => -4.4 + i * 1.45, A = [], B = [];
  await step(tok);                                   // 16.4 D&C 與數學歸納法
  const me = pal('歸納法', -6.3, 1.4, '#f4a56a', 0.75);
  pkt('Divide & Conquer', -2.2, 5.2); pkt('數學歸納法', 2.6, 5.2);
  const lk = arrow(V3(-0.6, 5.2, 0), V3(1.2, 5.2, 0), 0xa8730f);
  say('D&C 跟數學歸納法關係非常密切', '用歸納法來發展演算法');
  await step(tok);                                   // 63.8 兩大類：weak / strong
  kill(lk);
  tag('Weak', 'ptr', -6.0, 3.9); tag('Strong', 'ptr alt', -6.0, 0.6);
  for (let i = 0; i < 8; i++) {
    A.push(cube(i + 1, GRAY, [0.85, 0.85, 0.85], xs(i), 3.9, 0, 1.2));
    B.push(cube(i + 1, GRAY, [0.85, 0.85, 0.85], xs(i), 0.6, 0, 1.2));
  }
  say('數學歸納法分兩種', 'weak induction、strong induction');
  await step(tok);                                   // 77.8 兩大步驟
  note('① basic step', 3.6, 2.7); note('② inductive step', 3.6, 2.15);
  say('證明都有兩步', 'basic step ＋ inductive step');
  await step(tok);                                   // 84.8 basic step：很小的 problem size
  tint(A[0], OK); tint(B[0], OK); glow(A[0], GREEN); glow(B[0], GREEN);
  me.mood('happy');
  say('basic step：最小的 case 直接證', 'problem size 很小時 statement 為真');
  await step(tok);                                   // 105.8 inductive step：讓它自己運作
  const p = pkt('自動往後推 →', xs(0), 2.3);
  await travel(tok, p, V3(xs(0), 2.3, 0), V3(xs(7), 2.3, 0), 1400);
  remove(p);
  say('inductive step：讓它自己往後推', '後面比較大的 problem size 都會成立');
  await step(tok);                                   // 127.8 weak：n = k 對 ⇒ k+1 對
  say('Weak：假設 n = k 對 ⇒ 推 k+1 也對', '1 ⇒ 2 ⇒ 3 ⇒ … ⇒ 所有 n');
  for (let k = 0; k < 7; k++) {
    const a = arrow(V3(xs(k) + 0.2, 4.55, 0), V3(xs(k + 1) - 0.2, 4.55, 0), 0x0f5a3a);
    await beat(tok, 200); tint(A[k + 1], OK); await beat(tok, 80); kill(a);
  }
  await step(tok);                                   // 167.8 為什麼叫 weak
  note('每次只前進一步', xs(3.5), 5.0);
  me.mood('calm'); await me.hop(tok);
  say('每次只前進一步 → 所以叫 weak');
  await step(tok);                                   // 182.8 strong：一次跳一大步，hypothesis ≤ k
  say('Strong：假設 ≤ k 全都對 ⇒ 推 k+1', '可以一次跳一大步');
  for (let t = 1; t < 8; t++) {
    const g = ghostBox('#c08a1f', t * 1.45, 1.05, 1.05); g.position.set((xs(0) + xs(t - 1)) / 2, 0.6, 0);
    tint(B[t], OK); await beat(tok, 280); kill(g);
  }
  await step(tok);                                   // 215.8 用哪一種看題目
  me.look(1);
  bub('一步一步走？還是跳大步？', 0.2, 2.35);
  say('用哪一種？看問題的特性', '有的適合慢慢走，有的適合跳大步');
  await step(tok);                                   // 231.8 跟 2ᵏ 有關
  [3, 7].forEach((i) => glow(B[i], GOLD));
  arrow(V3(xs(3), 1.25, 0.3), V3(xs(7), 1.25, 0.3), 0x6a4a00);
  note('2ᵏ ⇒ 2ᵏ⁺¹', xs(5), 1.7);
  say('跟 2ᵏ 有關時：從 2ᵏ 直接推到 2ᵏ⁺¹', '例如 4 ⇒ 8，一步跳兩倍');
  await step(tok);                                   // 245.8 兩者等價
  good('weak ≡ strong：一樣強', 0.2, 6.0);
  me.mood('happy'); await me.hop(tok);
  say('看起來 strong 比較厲害，其實兩者等價', '只是依題目選合適的那一種');
}]);

// 08:37 骨牌
FRAG.push(['dcjiang-domino', '數學歸納法＝推倒骨牌', async (tok) => {
  fresh([0, 3.2, 11], [0, 1.2, 0]);
  const N = 8, xs = (i) => -4.6 + i * 1.4, H = 2.2, D = [];
  const fall = (i, th, ms = 320) => anim(tok, ms, (t) => {
    const a = th * t; const m = D[i];
    m.rotation.z = -a; m.position.set(xs(i) + Math.sin(a) * H / 2, Math.cos(a) * H / 2, 0);
  });
  await step(tok);                                   // 520.8 排骨牌、推倒骨牌
  for (let i = 0; i < N; i++) {
    D.push(cube(null, SAND, [0.25, H, 1.0], xs(i), H / 2, 0));
    tag(String(i + 1), 'idx', xs(i), -0.2, 0.9);
  }
  const kid = pal('', -6.1, 0.4, '#7cb8ee', 0.75);
  say('數學歸納法就像推倒骨牌', '先把骨牌排好');
  await step(tok);                                   // 531.8 第一張推倒第二張……
  for (let i = 0; i < N - 1; i++) arrow(V3(xs(i) + 0.2, 2.6, 0), V3(xs(i + 1) - 0.2, 2.6, 0), 0xa99470);
  say('排得好：第 1 張會推倒第 2 張', '第 2 張推倒第 3 張……');
  await step(tok);                                   // 543.8 這就是 weak induction
  note('base：第 1 張要倒', xs(0) + 0.6, 3.5); note('k 倒 ⇒ k+1 倒', xs(5), 3.5);
  say('這就是數學歸納法（weak induction）', '兩件事：第 1 張倒、k 倒會推倒 k+1');
  await step(tok);                                   // 558.8 第 k 張推倒 k+1
  const kk = tag('k', 'ptr', xs(3), 3.0), k1 = tag('k+1', 'ptr alt', xs(4), 3.0);
  glow(D[3], GOLD); glow(D[4], GOLD);
  say('inductive step：第 k 張倒 ⇒ 第 k+1 張一定倒');
  await step(tok);                                   // 565.8 一開始讓第 1 張倒
  kill(kk); kill(k1); glow(D[3], null); glow(D[4], null);
  kid.mood('wow'); await kid.hop(tok);
  tint(D[0], OK); await fall(0, 0.62, 450);
  say('initial：一開始就讓第 1 張倒下', 'P(1) 成立');
  await step(tok);                                   // 572.3 1 成立 ⇒ 2 成立
  tint(D[1], OK); await fall(1, 0.62);
  say('1 倒 ⇒ 2 也要倒', 'k = 1 代進 inductive step');
  await step(tok);                                   // 578.8 2 倒 ⇒ 3 倒
  tint(D[2], OK); await fall(2, 0.62);
  say('2 倒 ⇒ 3 也倒', '依此類推');
  await step(tok);                                   // 587.8 全部倒下
  for (let i = 3; i < N; i++) { tint(D[i], OK); await fall(i, i === N - 1 ? 1.45 : 0.62, 260); }
  kid.mood('happy');
  good('所有骨牌都倒 = 所有 n 都成立', 0.2, 4.4);
  say('直到所有骨牌都倒下', '這就是數學歸納法');
}]);

// defective chessboard tiling: list of {lv, cells}
function tromTiles(n, hr, hc) {
  const out = [];
  (function rec(r0, c0, s, hr, hc, lv) {
    if (s === 1) return;
    const h = s / 2, mr = r0 + h, mc = c0 + h, cells = [], sub = [];
    for (const [qr, qc] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
      const R0 = r0 + qr * h, C0 = c0 + qc * h;
      if (hr >= R0 && hr < R0 + h && hc >= C0 && hc < C0 + h) sub.push([R0, C0, hr, hc]);
      else { const cr = qr ? mr : mr - 1, cc = qc ? mc : mc - 1; cells.push([cr, cc]); sub.push([R0, C0, cr, cc]); }
    }
    out.push({ lv, cells });
    sub.forEach(([R0, C0, a, b]) => rec(R0, C0, h, a, b, lv + 1));
  })(0, 0, n, hr, hc, 0);
  return out;
}
const TC = ['#4b9ee2', '#9b7ef4', '#2fc092', '#dd8238', '#e55a9b', '#31aab0', '#c08a1f'];
function board(n, cs, cx = 0, cz = 0, hole = null) {
  const at = (r, c) => [cx + (c - (n - 1) / 2) * cs, cz + (r - (n - 1) / 2) * cs];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const [x, z] = at(r, c); ctx.tile(V3(x, 0.02, z), cs * 0.94, cs * 0.94, (r + c) % 2 ? '#e9dcc4' : '#d8c6a4'); }
  let hm = null;
  if (hole) { const [x, z] = at(hole[0], hole[1]); hm = cube(null, '#3a2f22', [cs * 0.9, 0.12, cs * 0.9], x, 0.08, z); }
  return { at, hm };
}
async function layTrom(tok, B, t, cs, color, ms = 0) {
  const ms3 = t.cells.map(([r, c]) => { const [x, z] = B.at(r, c); return cube(null, color, [cs * 0.86, 0.3, cs * 0.86], x, 0.22, z, 1.4); });
  if (ms) await beat(tok, ms);
  return ms3;
}

// 04:37 8×8 defective chessboard
FRAG.push(['dcjiang-tromino-8x8', 'Defective chessboard：63 格、21 塊', async (tok) => {
  fresh([0, 10.5, 5.2], [0, 0, 0.4]);
  const cs = 0.72, HOLE = [1, 5];
  await step(tok);                                   // 278.8 歸納法的強處
  const me = pal('歸納法', 4.6, 2.6, '#f4a56a', 0.8);
  bub('想出解答 = 也得到演算法', 4.6, 1.8, 1.4);
  say('數學歸納法強在哪？', '透過它思考，想出解答時就順便得到演算法');
  await step(tok);                                   // 307.8 一個棋盤方格（8×8）
  const B = board(8, cs, -0.9, 0);
  say('看一個常見的小問題：棋盤方格', '先舉 8×8（之後可以往更大推）');
  await step(tok);                                   // 322.8 defective：挖一個洞
  const [hx, hz] = B.at(HOLE[0], HOLE[1]);
  cube(null, '#3a2f22', [cs * 0.9, 0.12, cs * 0.9], hx, 0.08, hz, 1.2);
  const ht = note('排水孔', hx, 0.8, hz - 0.6);
  say('defective：缺一格（浴室的排水孔）', '洞在哪裡都無所謂');
  await step(tok);                                   // 348.8 剩 63 格
  tag('64 − 1 = 63 格', 'ptr', -0.9, 0.9, -3.6);
  say('8 × 8 扣掉排水孔', '只剩 63 格要貼');
  await step(tok);                                   // 362.8 L 形磁磚
  const sx = 3.8, sz = -1.8;
  [[0, 0], [1, 0], [1, 1]].forEach(([r, c]) => cube(null, '#dd8238', [cs * 0.86, 0.3, cs * 0.86], sx + c * cs, 0.22, sz + r * cs, 1.2));
  tag('L 形磁磚：佔 3 格', 'ptr alt', sx + 0.35, 0.9, sz - 0.7);
  say('用 L-shaped 的磁磚貼滿它', '一塊佔 3 格');
  await step(tok);                                   // 378.8 會不會成功？
  me.mood('wow'); await me.hop(tok);
  say('會不會成功？', '成功的話怎麼貼？不成功又是為什麼？');
  await step(tok);                                   // 385.8 隨便亂貼……運氣好就貼完
  kill(ht); me.mood('calm');
  const T = tromTiles(8, HOLE[0], HOLE[1]).map((t, i) => [t, i]);
  for (let i = T.length - 1; i > 0; i--) { const j = (i * 7 + 3) % (i + 1); [T[i], T[j]] = [T[j], T[i]]; }
  let cnt = 0; const ct = tag('0 塊', 'pkt', 3.9, 0.9, 0.6);
  for (const [t, i] of T) { await layTrom(tok, B, t, cs, TC[i % TC.length], 0); cnt++; txt(ct, cnt + ' 塊'); await beat(tok, 105); }
  me.mood('happy');
  say('隨便亂貼一下……運氣好，貼完了！');
  await step(tok);                                   // 410.8 不能每次都靠運氣
  me.mood('sad');
  bad('洞換個地方，還貼得出來嗎？', -0.9, 1.2, 3.4);
  say('但不能每次都靠運氣', '不管排水孔在哪都要貼得出來 → general solution');
  await step(tok);                                   // 440.8 63 ÷ 3 = 21
  txt(ct, '63 ÷ 3 = 21 塊');
  say('每塊佔 3 格：63 ÷ 3 = 21', '剛好需要 21 塊磁磚');
  await step(tok);                                   // 464.8 任意 2ⁿ × 2ⁿ 都貼得滿
  good('任意 2ⁿ × 2ⁿ 都貼得滿', 3.9, 0.9, -3.4);
  me.mood('happy');
  say('不只 8×8：任意 2ⁿ × 2ⁿ 的 defective 棋盤', '都能被 L 形磁磚貼滿');
  await step(tok);                                   // 484.8 D&C，背後是歸納法
  await me.hop(tok);
  say('怎麼做？用 Divide and Conquer', '背後的想法就是數學歸納法');
}]);

// 10:21 induction proof → algorithm
FRAG.push(['dcjiang-tromino-split', '歸納證明：切四塊、中央放一塊', async (tok) => {
  fresh([0, 10.5, 5.2], [0, 0, 0.4]);
  const holes = [[0, 0], [0, 1], [1, 0], [1, 1]];
  await step(tok);                                   // 622.8 最小的 case：2×2
  const bs = holes.map((h, k) => board(2, 0.9, -4.2 + k * 2.8, 0, h));
  say('最小的 case：2¹ × 2¹ 的棋盤', '缺一格');
  await step(tok);                                   // 636.8 只有 4 種，一眼貼得成
  for (let k = 0; k < 4; k++) { const t = tromTiles(2, holes[k][0], holes[k][1])[0]; await layTrom(tok, bs[k], t, 0.9, TC[k], 280); }
  say('只有這 4 種情形', '剩下的正好是一塊 L → n = 1 成立');
  await step(tok);                                   // 649.8 inductive step（weak）
  good('hypothesis：2ⁿ × 2ⁿ 貼得成', 0, 0.9, -2.4);
  note('要證：2ⁿ⁺¹ × 2ⁿ⁺¹ 也貼得成', 0, 0.9, 2.4);
  say('inductive step（weak）', '假設 2ⁿ × 2ⁿ 可以貼 ⇒ 證 2ⁿ⁺¹ × 2ⁿ⁺¹ 也可以');
  await step(tok);                                   // 674.8 一個 2ⁿ⁺¹ 的棋盤，挖一個洞
  fresh([0, 10.5, 5.2], [0, 0, 0.4]);
  const cs = 0.72, HOLE = [1, 5], B = board(8, cs, 0, 0, HOLE);
  const me = pal('', 4.9, 2.8, '#f4a56a', 0.8);
  say('隨便一個 2ⁿ⁺¹ × 2ⁿ⁺¹ 的棋盤', '挖掉一個洞');
  await step(tok);                                   // 691.8 連結大小問題
  me.look(-1);
  bub('大的 ↔ 小的：怎麼連起來？', 4.6, 2.0, 1.4);
  say('歸納法在做的事：', '把比較大的 problem size 跟比較小的連起來');
  await step(tok);                                   // 698.8 差兩倍 → 切成 4 塊
  bar(-2.95, 0, 2.95, 0, '#6e5f49', 0.08); bar(0, -2.95, 0, 2.95, '#6e5f49', 0.08);
  say('2ⁿ⁺¹ 是 2ⁿ 的兩倍', '→ 平均切成 4 塊 2ⁿ × 2ⁿ');
  await step(tok);                                   // 725.8 洞一定落在某一塊
  const [hx, hz] = B.at(HOLE[0], HOLE[1]);
  const gq = ghostBox('#d64545', 2.85, 0.2, 2.85); gq.position.set(1.44, 0.1, -1.44);
  note('洞在這一塊：不要動它', hx, 0.8, hz - 0.7);
  say('原來的洞一定落在某一塊', '那一塊先不要動它');
  await step(tok);                                   // 742.8 其他三塊靠中間挖一格 → 一塊 L
  kill(gq);
  const T = tromTiles(8, HOLE[0], HOLE[1]);
  const c0 = await layTrom(tok, B, T.filter((t) => t.lv === 0)[0], cs, '#d64545', 500);
  c0.forEach((m) => glow(m, GOLD));
  me.mood('wow');
  say('另外三塊：在靠中間的地方各挖一格', '這三格剛好貼一塊磁磚！');
  await step(tok);                                   // 758.8 每塊都是 defective 2ⁿ × 2ⁿ
  c0.forEach((m) => glow(m, null));
  for (const [x, z] of [[-1.44, -1.44], [1.44, -1.44], [-1.44, 1.44], [1.44, 1.44]]) {
    bar(x - 1.42, z, x + 1.42, z, '#a99470'); bar(x, z - 1.42, x, z + 1.42, '#a99470');
  }
  say('單看每一塊：都是 2ⁿ × 2ⁿ 的 defective 棋盤', '由 hypothesis：每塊都貼得出來');
  await step(tok);                                   // 795.8 演算法：切四塊 → 中央一塊 → 其餘照做
  for (const t of T.filter((t) => t.lv === 1)) await layTrom(tok, B, t, cs, '#9b7ef4', 260);
  let i = 0;
  for (const t of T.filter((t) => t.lv === 2)) await layTrom(tok, B, t, cs, TC[i++ % TC.length], 90);
  me.mood('happy');
  say('做法：切四半 → 中央貼一塊 → 其餘照同樣方法貼', '1 + 4 + 16 = 21 塊');
  await step(tok);                                   // 816.8 歸納法給了兩件事：① 證明
  good('① 證明：statement 是對的', 4.4, 1.0, -3.2);
  say('數學歸納法給了我們兩件事', '第一：證明這個 statement 正確');
  await step(tok);                                   // 835.4 ② 方法（演算法）
  good('② 方法：照做就是演算法', 4.4, 1.0, -2.5);
  await me.hop(tok);
  say('第二：告訴你怎麼做到', '照這方法做，演算法自然就形成了');
}]);

// 16:52 naive search
FRAG.push(['dcjiang-linear-search', 'Searching：一一比對 O(n)', async (tok) => {
  fresh([0, 3.5, 11.5], [0, 1, 0]);
  let R = null, me = null;
  await step(tok);                                   // 1011.8 一排由小排到大、互不相同
  R = jRow(BS, { tiles: true, idx: true, y: 0.5 });
  say('Searching：一排由小排到大的數字', '每個都不一樣（distinct）');
  await step(tok);                                   // 1028.8 另給一個 x
  me = buddy('x', 55, '#f4a56a', -5.6, 1.4, 1.6, 0.8);
  say('另外給一個 x = 55', '問：x 在不在這一排裡面？');
  await step(tok);                                   // 1051.8 有就輸出位置，沒有就回報不存在
  good('有 → 輸出它排第幾', 2.6, 3.2); bad('沒有 → return null', 2.6, 2.55);
  say('有的話：output 它在第幾個位置', '不在的話：回報不存在（例如 return null）');
  await step(tok);                                   // 1080.8 naive idea
  me.mood('calm');
  say('最簡單的做法（naive idea）', '沒什麼想法，就一個一個看');
  await step(tok);                                   // 1093.8 每個人拿出來比一下，從頭比一圈
  say('每個數都拿出來跟 x 比一下', '從頭到尾比一圈');
  const cur = tag('↓', 'ptr', R.x(0), 1.7);
  for (let i = 0; i < R.n; i++) {
    cur.position.set(R.x(i), 1.7, 0); glow(R.m[i], BLUE);
    await beat(tok, 280);
    if (BS[i] === 55) { glow(R.m[i], GREEN); break; }
    glow(R.m[i], null);
  }
  me.mood('happy');
  await step(tok);                                   // 1107.8 要 O(n)
  tag('n 個數 → 比 n 次 → O(n)', 'ptr', 0, 2.8);
  say('有 n 個數字：每個人比一下', '要 O(n) 的時間');
  await step(tok);                                   // 1117.8 正確，但 linear 不夠快
  good('正確 ✓', -3.0, 3.6); bad('對這題不夠快', 0.2, 3.6);
  me.mood('sad');
  say('這方法是正確的；linear time 也算快', '但對這個問題，linear 還不夠快');
  await step(tok);                                   // 1148.8 有沒有用到所有條件？
  say('有沒有用到所有的條件？', '一一比對：亂七八糟的數字也能用');
  note('沒用到「已排序」！', -3.0, 4.4);
  await step(tok);                                   // 1172.8 給的是已排序的 → 利用它加速
  for (let i = 0; i < R.n; i++) glow(R.m[i], GOLD);
  await beat(tok, 500);
  for (let i = 0; i < R.n; i++) glow(R.m[i], null);
  me.mood('wow');
  say('這題特殊：數字已經由小排到大', '能不能利用這個特性加速 searching？');
  await step(tok);                                   // 1197.8 卡住時想想條件
  bub('算到一半卡住？想想是不是有條件沒用到', 0.2, 5.1);
  say('考試時算到一半卡住', '通常是有條件沒用到');
}]);

// 20:27 binary search for 55
FRAG.push(['dcjiang-bsearch-55', 'Binary search：找 55', async (tok) => {
  fresh([0, 3.5, 11.5], [0, 1, 0]);
  const R = jRow(BS, { tiles: true, idx: true, y: 0.5 });
  const cut = (a, b) => { for (let i = a; i <= b; i++) { tint(R.m[i], DIM); glow(R.m[i], null); move(R.m[i], R.x(i), 0.3, -0.9); } };
  let me, md, lo, hi;
  await step(tok);                                   // 1226.8 一排排好的數，x = 55
  me = buddy('x', 55, '#f4a56a', -5.8, 1.4, 1.6, 0.8);
  say('一排由小排到大的數字，x = 55', '55 在不在裡面？在的話排第幾？');
  await step(tok);                                   // 1248.8 不一個一個找：先跟正中央比
  md = tag('mid', 'ptr alt', R.x(5), 1.7); glow(R.m[5], BLUE);
  lo = tag('low', 'ptr', R.x(0), -1.2, 0.7); hi = tag('high', 'ptr', R.x(10), -1.2, 0.7);
  say('不一個一個找：先跟排在正中央的人比', '正中央是 41');
  await step(tok);                                   // 1265.8 55 > 41 → 一定在右側
  me.look(1);
  note('55 > 41', R.x(5), 2.6);
  say('55 > 41', '如果 55 在裡面，一定在 41 的右側');
  await step(tok);                                   // 1284.8 砍掉一半
  cut(0, 5); lo.position.set(R.x(6), -1.2, 0.7);
  say('左邊一半（含 41）直接砍掉', '不用再考慮它們');
  await step(tok);                                   // 1291.8 剩下的中間是 72
  md.position.set(R.x(8), 1.7, 0); glow(R.m[8], BLUE);
  note('72 > 55', R.x(8), 2.6);
  say('在剩下一半裡，再跟中間的人比', '中間是 72：72 > 55');
  await step(tok);                                   // 1302.8 72 和右邊都砍
  cut(8, 10); hi.position.set(R.x(7), -1.2, 0.7);
  say('55 只可能在 72 的左側', '右邊兩個砍掉，72 自己也砍掉');
  await step(tok);                                   // 1317.8 剩兩個，中間取哪個？
  me.mood('wow');
  bub('中間是左邊？右邊？都行', R.x(6.5), 2.8);
  say('只剩兩個：中間要取左邊還是右邊？', '取右邊也沒關係，頂多多比一次');
  await step(tok);                                   // 1339.8 取左邊 → 剛好 55
  md.position.set(R.x(6), 1.7, 0); glow(R.m[6], GREEN); tint(R.m[6], OK);
  me.mood('happy'); await me.hop(tok);
  say('中間取左邊那一個：剛好是 55', '找到了！');
  await step(tok);                                   // 1355.8 index 一直都知道 → 輸出位置
  good('輸出：第 7 個', R.x(6), 3.4);
  say('每次都跟中間的人比，中間的 index 一直都知道', '馬上 output 55 的位置');
  await step(tok);                                   // 1369.8 若都不是 → 不存在
  bub('假如 55、68 都不是？', R.x(7.5), 4.2);
  say('如果 55 不是、68 也不是', '所有人都考慮過還找不到 → 不在裡面');
}]);

// 23:21 halving
FRAG.push(['dcjiang-bsearch-halving', '每比一次砍一半：log n 次', async (tok) => {
  fresh([0, 3.5, 11.5], [0, 1.2, 0]);
  const n = 16, R = jRow(Array.from({ length: n }, () => null), { dx: 0.7 });
  for (let i = 0; i < n; i++) R.m[i] = cube(null, '#4b9ee2', [0.6, 0.6, 0.6], R.x(i), 0.5, 0);
  const st = tag('n = 16', 'ptr', 0, 2.4);
  const me = pal('', -6.2, 1.4, '#f4a56a', 0.7);
  let a = 0, b = n - 1, k = 0;
  const half = () => {
    const m = Math.floor((a + b) / 2); k++;
    for (let i = a; i <= m; i++) { tint(R.m[i], DIM); glow(R.m[i], null); move(R.m[i], R.x(i), 0.3, -1.0); }
    a = m + 1; const size = b - a + 1;
    txt(st, '剩 ' + size + ' 個'); st.position.set((R.x(a) + R.x(b)) / 2, 2.4, 0);
    return size;
  };
  await step(tok);                                   // 1401.7 抓中間的人比較，決定往哪邊
  glow(R.m[7], GOLD);
  say('Binary search：每次抓中間的人比', '依結果決定往哪一邊繼續找');
  await step(tok);                                   // 1413.8 worst case：還沒找到
  me.mood('sad');
  say('Worst case：比完還沒找到，要繼續找', '但還是有好消息……');
  await step(tok);                                   // 1427.8 problem size 少一半
  half(); me.mood('happy');
  say('有一半的人不用再考慮了', 'problem size 瞬間少一半');
  await step(tok);                                   // 1434.8 第一次捨去 n/2
  note('第 1 次：捨去 n/2', -2.8, 1.6);
  say('n 個數字：第 1 次比較捨去 n/2 個人');
  await step(tok);                                   // 1444.5 再捨去 n/4
  glow(R.m[Math.floor((a + b) / 2)], GOLD); await beat(tok, 400); half();
  note('第 2 次：再捨去 n/4', 0.8, 1.6);
  say('剩下的一半再跟中間比', '又砍掉 n/4 個');
  await step(tok);                                   // 1451.8 一直砍到最後一個人
  for (let r = 0; r < 2; r++) { glow(R.m[Math.floor((a + b) / 2)], GOLD); await beat(tok, 350); half(); await beat(tok, 300); }
  glow(R.m[a], GOLD);
  say('一半、一半、再一半……', 'worst case：比到最後一個人才分出結果');
  await step(tok);                                   // 1458.8 最多 log n 次
  tag('16 → 8 → 4 → 2 → 1：log₂16 = 4 層', 'ptr alt', 0, 3.2);
  say('最多需要多少次比較？', '每次砍一半 → 最多 log n 次');
  await step(tok);                                   // 1480.8 O(n) → O(log n)
  bad('一一比對：O(n)', -3.0, 4.3); good('binary search：O(log n)', 2.4, 4.3);
  await me.hop(tok);
  say('一一比對要 O(n)', 'binary search 馬上降到 O(log n)');
}]);

// 25:18 divide, conquer, combine（params.bs：用 binary search 看）
FRAG.push(['dcjiang-dc-steps', 'Divide → Conquer → Combine', async (tok) => {
  fresh([0, 3.6, 12.5], [0, 2.6, 0]);
  const bs = !!prm().bs;
  const me = pal('', -6.3, 1.6, '#f4a56a', 0.7);
  if (!bs) {
    let P, A, Bm, s1, s2, S;
    await step(tok);                                   // 1518.3 三個步驟
    tag('① Divide', 'ptr', -4.6, 5.4); tag('② Conquer', 'ptr', -4.6, 3.4); tag('③ Combine', 'ptr', -4.6, 1.2);
    say('Divide and Conquer 分三步', 'Divide、Conquer、Combine');
    await step(tok);                                   // 1532.8 三個搞定，演算法就成型
    good('三步搞定 = 演算法成型', 3.2, 6.2);
    say('三個步驟都搞定', '兜起來就是你的 solution');
    await step(tok);                                   // 1539.8 Divide：太大不會 → 切小
    P = cube('問題 P（size n）', '#4b9ee2', [5, 0.9, 1], 0.9, 5.4, 0, 1.2);
    me.mood('wow');
    say('Divide：問題太大，直接做不會', '先切成小問題');
    await step(tok);                                   // 1561.8 子問題長相一樣、size 較小
    kill(P);
    A = cube('P（n/2）', '#4b9ee2', [2.4, 0.8, 1], -0.5, 5.4, 0); Bm = cube('P（n/2）', '#4b9ee2', [2.4, 0.8, 1], 2.3, 5.4, 0);
    move(A, -1.0, 3.4, 0); move(Bm, 2.8, 3.4, 0);
    glow(A, GOLD); glow(Bm, GOLD);
    note('長相一樣，只是比較小', 0.9, 4.3);
    me.mood('calm');
    say('關鍵：切出來的小問題跟原問題長相一樣', '只是 problem size 比較小');
    await step(tok);                                   // 1592.8 Conquer：recursively
    glow(A, null); glow(Bm, null);
    tag('↻ recursive', 'pkt', -1.0, 2.6); tag('↻ recursive', 'pkt', 2.8, 2.6);
    say('Conquer：通常用 recursive 的方式', '分別往下解小問題');
    await step(tok);                                   // 1602.1 Combine
    s1 = cube('解₁', OK, [1.6, 0.7, 1], -1.0, 1.2, 0, 1.6); s2 = cube('解₂', OK, [1.6, 0.7, 1], 2.8, 1.2, 0, 1.6);
    say('第三步 Combine', '現在手上只有小問題的解');
    await step(tok);                                   // 1627.8 小問題的解 compose 回去
    move(s1, 0.1, 1.2, 0); move(s2, 1.7, 1.2, 0);
    await beat(tok, 700);
    kill(s1); kill(s2);
    S = cube('原問題的解', OK, [3.6, 0.8, 1.1], 0.9, 1.2, 0); glow(S, GOLD);
    say('把小問題的答案慢慢 compose 回來', '還原成原來問題的答案');
    await step(tok);                                   // 1640.8 缺一不可
    me.mood('happy');
    say('這樣才是完整的 D&C 演算法', '三個步驟缺一不可');
    await step(tok);                                   // 1655.8 combine 通常最難
    bad('最難：Combine（名字裡卻沒有它）', 3.2, 1.9);
    me.mood('sad');
    say('三步裡通常最難的是 Combine', '名字裡沒有它，困難度卻最高');
    await step(tok);                                   // 1666.8 特例：binary search
    good('特例：binary search 的 combine = do nothing', 0.9, 0.2, 1.0);
    me.mood('wow');
    say('特例：binary search', '它的 combine 什麼都不用做');
    return;
  }
  tag('① Divide', 'ptr', -4.6, 5.4); tag('② Conquer', 'ptr', -4.6, 3.4); tag('③ Combine', 'ptr', -4.6, 1.2);
  const R = jRow(BS, { dx: 0.82, sz: 0.66, y: 5.4, x0: -3.0 });
  const x = buddy('x', 55, '#f4a56a', 5.4, 4.6, 0.4, 0.6);
  let yes;
  await step(tok);                                   // 1700.8 Divide：跟中間的人比
  glow(R.m[5], BLUE);
  say('Divide：拿中間的人比較', '決定往左還是往右找');
  await step(tok);                                   // 1716.8 分成兩半，問題變小
  const g1 = ghostBox('#4b9ee2', 5 * 0.82, 0.9, 1), g2 = ghostBox('#2fc092', 5 * 0.82, 0.9, 1);
  g1.position.set(R.x(2), 5.4, 0); g2.position.set(R.x(8), 5.4, 0);
  say('整串一次找不會 → 分成兩半', '問題就變小一點');
  await step(tok);                                   // 1731.8 已排序：另一側完全不用理
  kill(g1);
  for (let i = 0; i <= 5; i++) { tint(R.m[i], DIM); glow(R.m[i], null); fly(R.m[i], V3(-2, 3, -3)); }
  x.look(1);
  say('因為已由小排到大：55 > 41', '另一側（左邊）完全不用理');
  await step(tok);                                   // 1752.8 Conquer：recursively 找
  kill(g2);
  for (let i = 6; i < R.n; i++) move(R.m[i], R.x(i) - 3.2, 3.4, 0);
  pkt('↻ 在右半再找一次', 1.6, 4.3);
  say('Conquer：recursively 在右半找 x', '同樣的問題、一半的大小');
  await step(tok);                                   // 1764.8 Combine 很簡單
  say('Combine 反而很簡單', '每次都確定有一半的人不用處理');
  note('每次只處理一個人', 1.6, 2.2);
  await step(tok);                                   // 1778.8 最後只有 yes / no
  yes = cube('yes：第 7 個', OK, [2.6, 0.7, 1], 0.9, 1.2, 0, 1.6);
  x.mood('happy');
  say('最後比的那個人只有 yes / no', '找到或沒找到就結束');
  await step(tok);                                   // 1793.8 隱含在 divide 裡
  glow(yes, GOLD); await x.hop(tok);
  good('combine：do nothing', -2.8, 0.4, 1.0);
  say('combine 不用做任何事', '它在 divide 的時候就順便處理完了');
}]);

// 32:25 / 35:51 / Lec16 33:39 D&C template；params.part = 'three' | 'tpl' | 'flow'
FRAG.push(['dcjiang-template', 'D&C 範本：均分兩半 ⇒ n log n', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 3, 0]);
  const part = prm().part || 'tpl';
  const me = pal('', -6.3, 1.6, '#f4a56a', 0.7);
  if (part === 'three') {
    let P, a, b, kids = [];
    await step(tok);                                 // 1944.8 Divide：切成長相一樣的小塊
    tag('Divide', 'ptr', -4.4, 5.6);
    P = cube('大問題', '#4b9ee2', [4.8, 0.8, 1], 0.6, 5.6, 0, 1);
    await beat(tok, 600); kill(P);
    a = cube('小（一樣的長相）', '#4b9ee2', [2.3, 0.7, 1], -0.6, 5.6, 0); b = cube('小（一樣的長相）', '#4b9ee2', [2.3, 0.7, 1], 1.8, 5.6, 0);
    move(a, -1.0, 4.2, 0); move(b, 2.2, 4.2, 0);
    say('Divide：大問題一次做不會，沒關係', '切成小塊，每塊長相跟原問題一樣');
    await step(tok);                                 // 1959.8 Conquer：recursively
    tag('Conquer', 'ptr', -4.4, 4.2);
    for (const [x0, c] of [[-1.0, '#9b7ef4'], [2.2, '#9b7ef4']]) for (const dx of [-0.6, 0.6]) kids.push(cube(null, c, [1.0, 0.6, 1], x0 + dx, 2.9, 0, 1));
    pkt('↻ recursive', 0.6, 3.55);
    say('Conquer：通常 recursively 分別去解');
    await step(tok);                                 // 1977.8 什麼時候停？夠簡單就直接處理
    kids.forEach((m) => { tint(m, OK); glow(m, GREEN); });
    note('小到一眼看出答案 → 直接處理', 0.6, 2.2);
    say('recursive 到什麼時候停？', '小到眼睛看就知道答案時，直接處理掉');
    await step(tok);                                 // 2002.8 Combine：merge 回原問題的答案
    tag('Combine', 'ptr', -4.4, 1.2);
    kids.forEach((m) => move(m, 0.6, 1.2, 0));
    await beat(tok, 600);
    kids.forEach(kill);
    const S = cube('原問題的答案', OK, [4.0, 0.8, 1.1], 0.6, 1.2, 0); glow(S, GOLD);
    me.mood('happy');
    say('Combine：把小問題的解 merge 回來', '組合成原來問題的答案');
    await step(tok);                                 // 2032.8 implementation：recursive
    const C = code(['solve(P):', '  if P 夠小: 直接解', '  切成 P1, P2', '  solve(P1); solve(P2)', '  合併答案'], 4.0, 5.9, 0.46);
    C.hl(3);
    say('實作上最自然：寫成 recursive', '程式長相跟 procedure 八九不離十');
    await step(tok);                                 // 2079.8 running time → recurrence relation
    C.hl(-1);
    tag('running time：T(n) = 2T(n/2) + …', 'pkt', 4.0, 3.2);
    say('running time 怎麼分析？', '寫成 recurrence relation（也是 recursive 的形式）');
    await step(tok);                                 // 2111.8 correctness：數學歸納法
    good('正確性：數學歸納法（發展方法時就顧到）', 3.2, 2.4);
    await me.hop(tok);
    say('最重要的 correctness：用數學歸納法', '發展方法時就一起照顧到，一舉兩得');
    return;
  }
  if (part === 'flow') {
    const X = [-4.2, -1.4, 1.4, 4.2], names = ['D&C 程序', 'recurrence', 'recursion tree', '歸納法證明'], cards = [];
    const card = (i, c) => { cards[i] = cube(names[i], c, [2.3, 0.9, 1.0], X[i], 3.4, 0, 1.4); if (i) arrow(V3(X[i - 1] + 1.2, 3.4, 0), V3(X[i] - 1.2, 3.4, 0), 0x6e5f49); };
    await step(tok);                                 // 2018.8 以 merge sort 示範 D&C
    card(0, '#4b9ee2');
    say('用 merge sort 當例子', '示範怎麼做 divide and conquer');
    await step(tok);                                 // 2028.8 procedure 是 recursive algorithm
    note('通常是 recursive algorithm', X[0], 4.5);
    say('寫出 procedure 後要分析 running time', '它通常是 recursive algorithm');
    await step(tok);                                 // 2041.8 running time → recurrence relation
    card(1, '#9b7ef4');
    say('所以 running time 自然寫成', 'recurrence relation');
    await step(tok);                                 // 2046.8 unrolling：recursion tree 加總
    card(2, '#dd8238');
    say('用 unrolling：畫 recursion tree', '把樹上所有貢獻加起來就得到結果');
    await step(tok);                                 // 2067.8 怎麼知道是對的？要證明
    me.mood('wow');
    bub('你怎麼知道做的是對的？', 0, 1.8);
    say('還會被問：你怎麼知道是對的？', '要證明它的正確性');
    await step(tok);                                 // 2072.8 數學歸納法
    card(3, OK); me.mood('happy'); await me.hop(tok);
    say('用數學歸納法證明', 'D&C 的 basic idea 就是數學歸納法');
    return;
  }
  const Y = [5.6, 4.1, 2.6, 1.1], lv = [], W = 9.0;
  const row = (d) => { const k = 1 << d, w = W / k, r = []; for (let i = 0; i < k; i++) r.push(cube(d === 0 ? 'n' : 'n/' + k, '#4b9ee2', [w - 0.15, 0.7, 1], -0.2 - W / 2 + (i + 0.5) * w, Y[d], 0, d ? 1.2 : 0)); lv.push(r); };
  await step(tok);                                   // 2154.8 一個範本（不是全部）
  note('一個常用範本（不是所有 D&C 都這樣）', 0.6, 6.5);
  say('介紹一個 template（範本）', '不是所有 D&C 都長這樣');
  await step(tok);                                   // 2161.8 一開始 problem size 很大
  row(0);
  say('給一個 problem', '一開始 problem size 很大');
  await step(tok);                                   // 2181.8 切成均勻的兩半
  row(1);
  say('Divide：整個看不會 → 切成均勻的兩半');
  await step(tok);                                   // 2188.8 兩半各自 recursively 解
  row(2); await beat(tok, 700); row(3);
  pkt('↻ recursive', 5.8, 2.0);
  say('對兩半分別 recursively 去解', '一路往下切');
  await step(tok);                                   // 2197.8 兩兩 combine 回來
  for (let d = 3; d >= 0; d--) { lv[d].forEach((m) => { tint(m, OK); glow(m, GOLD); }); await beat(tok, 450); lv[d].forEach((m) => glow(m, null)); }
  say('求解後慢慢 combine 回來', '每次 combine 兩個子問題的解');
  await step(tok);                                   // 2221.8 divide 與 combine 要快
  me.mood('wow');
  bub('divide、combine 要越快越好', -0.2, 0.2, 1.0);
  say('這個範本的講究：', 'divide 與 combine 要盡量快');
  await step(tok);                                   // 2237.8 linear time 完成
  for (let d = 0; d < 4; d++) tag('cn', 'ptr alt', 5.6, Y[d]);
  say('divide 與 combine 都在 linear time 完成', '每一層加起來都是 cn');
  await step(tok);                                   // 2259.8 ⇒ n log n
  tag('log₂n 層', 'ptr', -6.0, 3.2);
  good('T(n) = O(n log n)', 0.6, 0.2, 1.0);
  me.mood('happy');
  say('做得到的話：problem size 為 n', 'time complexity 只要 O(n log n)');
  await step(tok);                                   // 2271.3 merge sort 就是這個 template
  await me.hop(tok);
  say('Merge sort 就是照這個 template 發展的', '所以它是 n log n');
}]);

// 38:07 comparison sort lower bound
FRAG.push(['dcjiang-sort-bound', 'Sorting：只靠比較，下限 n log n', async (tok) => {
  fresh([0, 3.4, 12], [0, 2.4, 0]);
  const grow = async (x, name, f, h, c) => {
    const m = cube(null, c, [1.6, 1, 1.2], x, 0.01, 0); m.scale.y = 0.01;
    tag(name, 'idx', x, -0.4, 0.8);
    await anim(tok, 800, (t) => { m.scale.y = Math.max(0.01, h * t); m.position.y = h * t / 2; });
    tag(f, 'ptr', x, h + 0.5); return m;
  };
  const me = pal('', -6.2, 1.6, '#f4a56a', 0.7);
  let mm;
  await step(tok);                                   // 2286.8 sorting：n 個數由小排到大
  jRow([5, 2, 8, 1, 9, 3], { dx: 0.8, y: 5.2, sz: 0.6 });
  say('Sorting：給 n 個數字', '請你由小排到大輸出');
  await step(tok);                                   // 2302.8 解法太多了
  me.mood('wow');
  say('有多少種解法？實在太多了');
  await step(tok);                                   // 2317.8 例如 bubble sort
  await grow(-3.8, 'bubble sort', 'n²', 5.4, '#d64545');
  say('例如大一就會寫的 bubble sort', '有些慢、有些快');
  await step(tok);                                   // 2335.8 只用比大小
  me.mood('calm');
  bub('只用「比大小」決定先後', 0, 4.4);
  say('如果只用比較（比大小）', '來決定兩個數字的先後');
  await step(tok);                                   // 2355.6 理論下限 n log n
  mm = await grow(0, 'heap / merge sort', 'n log n', 2.2, '#4b9ee2');
  line(-5.6, 2.2, 5.6, 2.2, 0.7, '#7a1010');
  tag('Ω(n log n)', 'ptr alt', -5.0, 2.6, 0.7);
  say('theoretically 會 bound 在 n log n', '不會再更快了');
  await step(tok);                                   // 2362.8 linear sorting 需要額外資訊
  await grow(3.8, 'linear sorting', 'n', 0.9, '#2fc092');
  note('需要額外的 input 資訊', 3.8, 1.9);
  say('linear sorting 能更快', '但要配合額外的 input information');
  await step(tok);                                   // 2382.8 merge sort 達到最佳
  glow(mm, GOLD); me.mood('happy'); await me.hop(tok);
  say('Merge sort：理論上可以達到最佳速度', 'n log n');
}]);

// merge sort on ALGORITHMS；params.mode = 'idea' | 'split' | 'par' | 'seq'
FRAG.push(['dcjiang-ms-run', 'Merge sort：ALGORITHMS', async (tok) => {
  fresh([0, 3.2, 13.5], [0, 2.4, 0]);
  const mode = prm().mode || 'par';
  const S = 'ALGORITHMS'.split(''), n = S.length;
  const nodes = [];
  (function mk(lo, hi, d) { const nd = { lo, hi, d, q: Math.floor((lo + hi) / 2), kids: [] }; nodes.push(nd); if (lo < hi) nd.kids = [mk(lo, nd.q, d + 1), mk(nd.q + 1, hi, d + 1)]; return nd; })(0, n - 1, 0);
  const root = nodes[0];
  const Y = (d) => 5.2 - d * 1.25;
  const cutsAt = (d) => nodes.filter((nd) => nd.d < d && nd.lo < nd.hi).map((nd) => nd.q);
  const X = (k, d) => { const c = cutsAt(d), off = (kk) => c.filter((q) => q < kk).length * 0.42; return -((n - 1) * 0.95 + off(n - 1)) / 2 + k * 0.95 + off(k); };
  const arr = S.slice(), cur = S.map((ch, k) => cube(ch, lc(ch), [0.78, 0.78, 0.78], X(k, 0), Y(0), 0));
  const place = (nd, d) => { for (let k = nd.lo; k <= nd.hi; k++) move(cur[k], X(k, d), Y(d), 0); };
  const sortIn = (nd, d) => {
    const pairs = []; for (let k = nd.lo; k <= nd.hi; k++) pairs.push([arr[k], cur[k]]);
    pairs.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    pairs.forEach(([ch, m], i) => { arr[nd.lo + i] = ch; cur[nd.lo + i] = m; });
    place(nd, d);
  };
  const merge = (nd) => sortIn(nd, nd.d);
  const str = (a, b) => arr.slice(a, b + 1).join('');
  const byDepth = (d) => nodes.filter((nd) => nd.d === d);
  const splitLv = (d) => byDepth(d).filter((nd) => nd.lo < nd.hi).forEach((nd) => nd.kids.forEach((kd) => place(kd, d + 1)));
  const mergeLv = (d) => { const ms = byDepth(d).filter((nd) => nd.lo < nd.hi); ms.forEach(merge); return ms; };
  const singles = () => nodes.filter((nd) => nd.lo === nd.hi);
  const me = pal('', -6.4, 1.6, '#f4a56a', 0.7);
  if (mode === 'idea') {
    await step(tok);                                 // 2398.8 一串英文字母 ALGORITHMS
    say('例子：ALGORITHMS 這些字母', '請把它們由小排到大');
    await step(tok);                                 // 2415.8 A 小、Z 大
    note('A < B < C < … < Z', 0, 6.3);
    say('什麼叫小？A 小；什麼叫大？Z 大', '照 ABCD 的順序排');
    await step(tok);                                 // 2432.7 一次這麼多不會排 → 先拆一半
    me.mood('wow');
    bub('一次這麼多字母……不會排', -3.6, 6.3);
    say('一次看這麼多字母，不會排', '那就先拆一半再說');
    await step(tok);                                 // 2460.8 拆成均勻的左右兩半
    place(root.kids[0], 1); place(root.kids[1], 1);
    me.mood('calm');
    say('divide：拆成均勻的左右兩半', 'ALGOR ｜ ITHMS');
    await step(tok);                                 // 2469.8 左右各自排好
    sortIn(root.kids[0], 1); sortIn(root.kids[1], 1);
    say('conquer：左右兩半各自排好', str(0, 4) + ' ｜ ' + str(5, 9));
    await step(tok);                                 // 2486.8 combine：重新安排成最後結果
    merge(root); glow(cur[0], GOLD);
    me.mood('happy'); await me.hop(tok);
    say('這還不是最終結果 → combine', '把兩塊已排好的重新安排：' + str(0, 9));
    return;
  }
  if (mode === 'split') {
    await step(tok);                                 // 2517.8 conquer = recursively sort
    splitLv(0);
    say('Conquer 就是 recursively 去 sort');
    await step(tok);                                 // 2524.9 左右各 5 個，還是不會排
    note('5 個', X(2, 1), 6.2); note('5 個', X(7, 1), 6.2);
    me.mood('wow');
    say('切出來左右各 5 個字母', '還是沒辦法直接排出大小');
    await step(tok);                                 // 2538.8 繼續切
    splitLv(1);
    say('recursively 再繼續切', '切成左半邊跟右半邊');
    await step(tok);                                 // 2544.8 一定要寫 stop condition
    me.mood('calm');
    pkt('stop condition！', 4.6, 0.4);
    say('recursive code 最重要的一件事', '一定要寫停止遞迴的 condition');
    await step(tok);                                 // 2554.8 不然停不下來
    bad('沒寫 → 無窮 recursive，停不下來', 4.2, -0.4);
    say('不然它會無窮地 recursive 下去');
    await step(tok);                                 // 2561.8 兩個夠小嗎？
    splitLv(2);
    bub('剩兩個，夠小了嗎？', -3.6, 6.3);
    say('什麼時候 input size 夠小', '可以不考慮任何事直接吐答案？兩個嗎？');
    await step(tok);                                 // 2572.7 兩個還要比；一個什麼都不用做
    splitLv(3);
    say('兩個還要比一下', '只剩一個時，什麼事都不用做');
    await step(tok);                                 // 2605.8 base case：只剩一個人
    singles().forEach((nd) => { tint(cur[nd.lo], OK); glow(cur[nd.lo], GREEN); });
    me.mood('happy');
    say('base case：切到只剩一個人', '它本身就排好了，直接吐答案');
    return;
  }
  if (mode === 'par') {
    await step(tok);                                 // 2910.8 base case 不成立 → 切兩半
    splitLv(0);
    say('一開始 base case 不成立', '認真做：切成左右兩半');
    await step(tok);                                 // 2926.8 左邊還有兩個以上 → 繼續切
    splitLv(1);
    say('左半邊還是很多（≥ 2 個）→ 繼續切', '右邊當然也繼續切');
    await step(tok);                                 // 2934.8 切到只剩一個一個
    splitLv(2); await beat(tok, 700); splitLv(3);
    say('一路切到只剩一個一個為止');
    await step(tok);                                 // 2944.8 夠簡單了
    me.mood('happy');
    say('這時候夠簡單了');
    await step(tok);                                 // 2951.8 第 1 行發現已排好 → return
    singles().forEach((nd) => glow(cur[nd.lo], GREEN));
    pkt('第 1 行：p = r → return', 4.6, 0.3);
    say('第 1 行發現只剩一個：已排好', '直接 return');
    await step(tok);                                 // 2957.8 A、L 已排好 → merge
    singles().forEach((nd) => glow(cur[nd.lo], null));
    const m3 = mergeLv(3);
    say('A 和 L 這兩塊已分別排好 → merge', m3.map((nd) => str(nd.lo, nd.hi)).join(' ｜ '));
    await step(tok);                                 // 2963.8 一樣 merge
    const m2 = mergeLv(2);
    say('先假裝 merge 大家都會做', m2.map((nd) => str(nd.lo, nd.hi)).join(' ｜ '));
    await step(tok);                                 // 2974.0 merge、merge，最後產生結果
    mergeLv(1); await beat(tok, 1000); mergeLv(0);
    await me.hop(tok);
    say('再 merge、merge', '最後產生結果：' + str(0, n - 1));
    return;
  }
  // sequential (real recursion order): left subtree finishes before the right one starts
  let g = null;
  const box = (nd) => { if (g) kill(g); g = ghostBox('#c08a1f', (nd.hi - nd.lo + 1) * 0.95 + 0.6, 1.1, 1.2); g.position.set((X(nd.lo, nd.d) + X(nd.hi, nd.d)) / 2, Y(nd.d), 0); };
  async function run(nd, ms) {
    if (nd.lo === nd.hi) { glow(cur[nd.lo], GREEN); await beat(tok, ms); glow(cur[nd.lo], null); return; }
    box(nd); nd.kids.forEach((kd) => place(kd, nd.d + 1)); await beat(tok, ms);
    await run(nd.kids[0], ms); await run(nd.kids[1], ms);
    merge(nd); box(nd); await beat(tok, ms);
  }
  let hint;
  await step(tok);                                   // 2984.2 圖上左右平行，是為了好理解
  splitLv(0);
  hint = bub('畫成左右同時做：為了好理解', 0, 6.3);
  say('剛剛為了好理解，左右半邊是同時做的', '只有開平行計算才會這樣');
  await step(tok);                                   // 2999.8 沒有平行 → sequential
  txt(hint, '真正執行：sequential，一次一邊');
  for (let k = 5; k < n; k++) tint(cur[k], DIM);
  say('沒有平行計算的話', '它會 sequentially 去做');
  await step(tok);                                   // 3007.8 recursive call 先做左側
  box(root.kids[0]); root.kids[0].kids.forEach((kd) => place(kd, 2));
  say('真正的 recursive call 先做左側', '左側再繼續切');
  await step(tok);                                   // 3019.8 一路往左走，左側全部走完
  await run(root.kids[0].kids[0], 180); await run(root.kids[0].kids[1], 180); merge(root.kids[0]); box(root.kids[0]);
  say('一路往左邊走下去', '先把左側完全走完：' + str(0, 4));
  await step(tok);                                   // 3027.8 才開始往右做
  for (let k = 5; k < n; k++) tint(cur[k], lc(arr[k]));
  await run(root.kids[1], 140);
  merge(root); if (g) kill(g); g = null;
  say('然後才開始往右邊做下去', '最後合併：' + str(0, n - 1));
  // the lecture's animation: x = index, y = value
  const V = [9, 3, 14, 6, 1, 12, 7, 15, 4, 10, 2, 13, 8, 16, 5, 11], m = V.length;
  const bx = (i) => -5.2 + i * 0.7;
  let bars = [], val = [];
  const put = (lo, hi) => { for (let i = lo; i <= hi; i++) move(bars[i], bx(i), val[i] * 0.17, 0); };
  const sortRange = (lo, hi) => { const p = []; for (let i = lo; i <= hi; i++) p.push([val[i], bars[i]]); p.sort((a, b) => a[0] - b[0]); p.forEach(([v, b], k) => { val[lo + k] = v; bars[lo + k] = b; }); put(lo, hi); };
  await step(tok);                                   // 3054.6 動畫：x 軸 index、y 軸數值
  fresh([0, 3.4, 12], [0, 1.8, 0]);
  val = V.slice();
  bars = V.map((v, i) => cube(null, '#4b9ee2', [0.5, v * 0.34, 0.5], bx(i), v * 0.17, 0));
  line(-5.7, 0, 5.7, 0, 0, '#6e5f49'); line(-5.7, 0, -5.7, 5.8, 0, '#6e5f49');
  tag('index →', 'idx', 4.9, -0.45); tag('數值 ↑', 'idx', -6.2, 5.6);
  say('回到動畫：x 軸是 index（第 1 個…第 n 個）', 'y 軸是那個位置的數值大小');
  await step(tok);                                   // 3069.8 一開始亂亂的
  say('一開始亂亂的，沒有排好');
  await step(tok);                                   // 3077.8 排好 = 一條階梯
  const st = seg(V3(bx(0), 0.34, 0.4), V3(bx(m - 1), m * 0.34, 0.4), '#c08a1f');
  note('排好後：像一條往上的階梯', 1.5, 6.2);
  say('從小排到大以後', '會形成一條往上的階梯');
  await step(tok);                                   // 3085.8 sequential 版本：先從最小的部分兜
  for (let w = 2; w <= 8; w *= 2) { for (let lo = 0; lo < 8; lo += w) sortRange(lo, lo + w - 1); await beat(tok, 650); }
  say('這是 sequential 跑的版本', '先從最小的部分慢慢兜出左半');
  await step(tok);                                   // 3092.8 右半也排好，最後一次 merge
  for (let w = 2; w <= 8; w *= 2) { for (let lo = 8; lo < 16; lo += w) sortRange(lo, lo + w - 1); await beat(tok, 450); }
  sortRange(0, m - 1);
  bars.forEach((b) => tint(b, OK));
  say('左右兩半都排好之後', '透過最後一次 merge 呈現結果');
  await step(tok);                                   // 3109.8 左半處理完再處理右半
  kill(st);
  for (let i = 0; i < 8; i++) glow(bars[i], GOLD);
  await beat(tok, 700);
  for (let i = 0; i < 8; i++) glow(bars[i], null);
  for (let i = 8; i < 16; i++) glow(bars[i], GOLD);
  await beat(tok, 700);
  for (let i = 8; i < 16; i++) glow(bars[i], null);
  say('sequential：左半邊都處理完', '再開始處理右半邊');
}]);

const MSC = ['MERGE-SORT(A, p, r)', '1  if p < r', '2     q = ⌊(p + r) / 2⌋', '3     MERGE-SORT(A, p, q)', '4     MERGE-SORT(A, q + 1, r)', '5     MERGE(A, p, q, r)'];

// 43:50 MERGE-SORT(A, p, r)
FRAG.push(['dcjiang-ms-code', 'MERGE-SORT(A, p, r) 五行', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 2.8, 0]);
  let C, R, tp, tr, tq, g;
  const W = 0.95;
  const sortRange = (a, b) => { const p = []; for (let i = a; i <= b; i++) p.push([R.v[i], R.m[i]]); p.sort((u, v) => (u[0] < v[0] ? -1 : 1)); p.forEach(([ch, m], k) => { R.v[a + k] = ch; R.m[a + k] = m; move(m, R.x(a + k), 0.6, 0); }); };
  const gbox = (a, b, c) => { if (g) kill(g); g = ghostBox(c, (b - a + 1) * W, 1, 1.1); g.position.set((R.x(a) + R.x(b)) / 2, 0.6, 0); };
  await step(tok);                                   // 2629.7 array A，排 p 到 r 這一段
  C = code(MSC, -1.2, 6.0); C.hl(0);
  R = jRow('ALGORITHMS'.split(''), { dx: W, y: 0.6, sz: 0.72, idx: true, tiles: true, col: lc });
  tp = tag('p', 'ptr', R.x(0), 1.6); tr = tag('r', 'ptr', R.x(9), 1.6);
  say('input 都放在 array A', '這次要把 index p 到 r 這一段重新排序');
  await step(tok);                                   // 2665.8 一開始亂七八糟
  bub('一開始：亂七八糟、沒排好', 0, 2.5);
  say('initial 的時候，這些人都還沒排好');
  await step(tok);                                   // 2669.8 這 5 行就是 procedure
  note('5 行就是整個 MERGE-SORT', 4.6, 6.0);
  say('1、2、3、4、5 這 5 行', '就是 merge sort 的 procedure');
  await step(tok);                                   // 2676.8 第 1 行：要不要繼續做
  C.hl(1);
  say('第 1 行：判定這段 subsequence', '需不需要繼續做');
  await step(tok);                                   // 2699.8 p < r：至少兩個
  say('if p < r：裡面至少有兩個', '就要繼續做');
  note('p < r ⇒ 至少 2 個', 4.6, 5.4);
  await step(tok);                                   // 2709.8 p = r：只剩一個 → return
  note('p = r ⇒ 只剩 1 個 → return', 4.6, 4.85);
  say('不會讓 p > r，唯一可能是 p = r', '只剩一個數字：本身就排好了，直接 return');
  await step(tok);                                   // 2735.8 第 2 行：找中間的人
  C.hl(2);
  say('兩個以上就好好處理：先拆左右兩半', '第 2 行：把中間那個人找出來');
  await step(tok);                                   // 2743.6 (p + r)/2 有 .5 → floor
  tq = tag('q', 'ptr alt', R.x(4), 1.6);
  note('(1 + 10) / 2 = 5.5 → ⌊5.5⌋ = 5', 4.6, 4.3);
  say('p + r 是奇數時，除以 2 會出現 .5', '這裡取 floor（地板函式）：q = 5');
  await step(tok);                                   // 2787.8 floor / ceiling 都可以
  note('取 ⌈5.5⌉ = 6 也可以', 4.6, 3.75);
  say('中心點取 floor 或 ceiling 都沒關係', '沒有太大差異');
  await step(tok);                                   // 2811.8 第 3 行：左半 recursive
  C.hl(3); gbox(0, 4, '#4b9ee2');
  say('第 3 行：p 到 q 這一段', '繼續 recursive call MERGE-SORT');
  await step(tok);                                   // 2828.8 第 4 行：右半 recursive
  C.hl(4); gbox(5, 9, '#2fc092');
  say('第 4 行：q+1 到 r 這一段', '一樣 MERGE-SORT 排好');
  await step(tok);                                   // 2840.8 左右各自排好了
  kill(g); g = null;
  sortRange(0, 4); sortRange(5, 9);
  say('兩個 recursive call 完成後', '左半、右半分別都排好了：AGLOR ｜ HIMST');
  await step(tok);                                   // 2852.8 第 5 行：MERGE 專門做 combine
  C.hl(5); gbox(0, 9, '#c08a1f');
  sortRange(0, 9);
  say('第 5 行：開一個 procedure 叫 MERGE', '專門把兩段排好的 subsequence 合起來');
  await step(tok);                                   // 2872.8 第 1–2 行：divide
  C.hl(-1); kill(g); [tp, tr, tq].forEach(kill);
  tag('1–2 行：判斷 base case、divide', 'ptr', 4.4, 2.9);
  say('第 1 行判斷是不是 base case', '第 2 行做 divide：找中心點');
  await step(tok);                                   // 2883.8 第 3–4 行：conquer
  tag('3–4 行：conquer', 'ptr', 4.4, 2.35);
  say('第 3、4 行：conquer', 'recursively 解左右兩半');
  await step(tok);                                   // 2890.8 第 5 行：combine
  tag('5 行：combine（MERGE）', 'ptr alt', 4.4, 1.8);
  say('第 5 行：merge，把答案產生出來', '程式長相就是 D&C 的三步');
}]);

// 52:05 / Lec16 00:16 running time；params.v = 2 for the Lec16 review
FRAG.push(['dcjiang-ms-recurrence', 'T(n) = D(n) + 2T(n/2) + C(n)', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 3, 0]);
  const v2 = prm().v === 2;
  const C = code(MSC, -2.8, 5.8);
  const RX = 3.9;
  const me = pal('', -6.4, 1.6, '#f4a56a', 0.7);
  let tT, tD, tA, tB, tC, f;
  const hlSeq = async (ls) => { for (const i of ls) { C.hl(i); await beat(tok, 380); } };
  const showT = () => { tT = tag('T(n)：n 個數要花的時間', 'ptr', RX, 5.6); };
  const showD = () => { tD = tag('第 1–2 行：D(n)', 'ptr', RX, 4.9); };
  const showA = () => { tA = tag('第 3 行：T(n/2)', 'ptr', RX, 4.3); tB = tag('第 4 行：T(n/2)', 'ptr', RX, 3.8); };
  const showC = () => { tC = tag('第 5 行：C(n)', 'ptr alt', RX, 3.2); };
  const showF = () => { f = tag('T(n) = D(n) + 2T(n/2) + C(n)', 'pkt', 0.4, 1.9); };
  if (v2) {
    await step(tok);                                 // 17.1 merge sort：切兩半、recursive sort
    await hlSeq([2, 3, 4]);
    say('上次的 merge sort：divide 切成兩半', 'conquer：recursively 呼叫 merge sort 去 sort 兩半');
    await step(tok);                                 // 45.8 combine：MERGE
    C.hl(5);
    say('combine 要特別做一個功夫', 'MERGE 把兩半合成完整排好的 array');
    await step(tok);                                 // 71.8 標準 recursive code；A、p..r
    C.hl(0);
    say('這是標準的 recursive code', 'A 是 input array，這次要排 index p 到 r');
    await step(tok);                                 // 86.8 第 1、2 行：divide + 判斷 trivial case
    C.hl(1);
    say('第 1、2 行做 divide', '同時判斷是不是最簡單的 trivial case');
    await step(tok);                                 // 91.8 只剩一個 → 已排好，直接結束
    note('只剩 1 個：本身就排好 → 跳開', RX, 6.2);
    say('只剩一個 element：本身就排好了', '不用理它，直接結束');
    await step(tok);                                 // 117.8 第 2 行：算中心點
    C.hl(2);
    say('兩個以上：第 2 行先算出中心點');
    await step(tok);                                 // 121.8 第 3、4 行：左右 recursive
    await hlSeq([3, 4]);
    say('左半 p..q、右半 q+1..r', '都 recursive call merge sort 去排');
    await step(tok);                                 // 143.8 兩段都排好，還要 merge
    C.hl(5);
    say('兩段各自排好了', '還要第 5 行 merge 起來');
    await step(tok);                                 // 158.2 分析 running time → recursion 形式
    C.hl(-1); me.mood('wow');
    say('分析這種 recursive code 的 running time', '一般會寫成 recursion 的形式');
    await step(tok);                                 // 175.8 T(n)
    showT();
    say('假設 input 有 n 個數字', '整個 merge sort 要花 T(n) 的時間');
    await step(tok);                                 // 188.8 D(n)
    C.hl(1); showD();
    say('第 1、2 行在做 divide', '記作 D(n)');
    await step(tok);                                 // 199.8 2T(n/2)
    await hlSeq([3, 4]); showA();
    say('第 3、4 行：左右各剩一半的 input', '各花 T(n/2) → 2T(n/2)');
    await step(tok);                                 // 214.8 C(n)
    C.hl(5); showC();
    say('第 5 行：merge 把左右結果 combine 回來', '假設花 C(n)');
    await step(tok);                                 // 232.6 自己定義自己
    C.hl(-1); showF();
    say('T 的定義來自於自己', '自己定義自己 → recursion（recurrence）的形式');
    await step(tok);                                 // 258.9 D(n) = O(1)
    txt(tD, '第 1–2 行：D(n) = O(1)'); C.hl(1);
    say('第 1、2 行只是簡單的比較和加減', '算中心 index → constant time：O(1)');
    await step(tok);                                 // 275.8 問題是第 5 行 C(n)
    C.hl(5); glow(me.body, null); me.mood('wow');
    bub('MERGE 到底要花多少時間？', RX, 2.5);
    say('現在的問題：第 5 行 C(n)', 'merge 到底要花多少時間？');
    await step(tok);                                 // 293.8 linear ⇒ n log n
    txt(tC, '第 5 行：C(n) = O(n)？'); txt(f, 'T(n) = 2T(n/2) + O(n) ⇒ O(n log n)');
    me.mood('happy'); await me.hop(tok);
    say('如果 combine 能在 linear time 完成', '整體 running time 可以 bound 在 n log n');
    return;
  }
  await step(tok);                                   // 3124.8 MERGE 怎麼做還沒回答
  C.hl(5);
  bub('MERGE 怎麼做？還沒講', RX, 6.2);
  say('還有一個答案沒回答', '第 5 行的 MERGE 怎麼做？');
  await step(tok);                                   // 3153.8 先看整體 running time
  C.hl(-1);
  say('分析 MERGE 之前', '先看 overall 大框架的 running time');
  await step(tok);                                   // 3157.8 目標：MERGE 是 linear time
  note('設計目標：MERGE 在 linear time 完成', RX, 0.6);
  say('等一下的設計目標', '希望 MERGE 在 linear time 完成');
  await step(tok);                                   // 3167.8 經典 recursive 形式
  await hlSeq([2, 3, 4, 5]);
  say('經典的 recursive 形式：拆兩半', '左右分別 recursive call，最後再兜起來');
  await step(tok);                                   // 3189.8 T(n)
  C.hl(-1); showT();
  say('先設一個 function T(n)', 'input 有 n 個數字時，產生 solution 要的時間');
  await step(tok);                                   // 3210.8 第 1、2 行：D(n)
  C.hl(1); showD();
  say('第 1、2 行：divide 要花的時間', '用 D(n) 表示');
  await step(tok);                                   // 3219.8 第 3、4 行：左右各 n/2
  await hlSeq([3, 4]);
  note('左 n/2 個 ｜ 右 n/2 個', -2.0, 2.4);
  say('第 3、4 行：左右 recursive call', '左半邊 n/2 個人、右半邊也 n/2 個');
  await step(tok);                                   // 3248.8 同樣的問題 → 2T(n/2)
  showA();
  say('也是 merge sort，只是 problem size 較小', '各花 T(n/2) → 兩倍的 T(n/2)');
  await step(tok);                                   // 3266.8 第 5 行：C(n)
  C.hl(5); showC();
  say('第 5 行是 combine 的功夫', '用 C(n) 代表');
  await step(tok);                                   // 3278.8 寫出 recurrence relation
  C.hl(-1); showF();
  say('整個 procedure 要花的時間', 'T(n) = D(n) + 2T(n/2) + C(n)');
  await step(tok);                                   // 3319.8 用自己定義自己
  pkt('↻ 用自己定義自己', 0.4, 1.2);
  say('這就是 recurrence relation', '用自己去定義自己的 function');
  await step(tok);                                   // 3342.8 第 1 行：比 p、r → constant
  C.hl(1);
  say('第 1 行：只要比一下 p 和 r 的大小', 'constant time 就完成');
  await step(tok);                                   // 3351.8 第 2 行：簡單加除 → D(n) = O(1)
  C.hl(2); txt(tD, '第 1–2 行：D(n) = O(1)');
  say('第 2 行：找中間點，簡單的加法和除法', '跟 input size 無關 → D(n) = O(1)');
  await step(tok);                                   // 3387.8 C(n) 目標 O(n)
  C.hl(5); txt(tC, '第 5 行：C(n) = O(n)？');
  me.mood('wow');
  say('接下來的問題：第 5 行 C(n) 是多少？', '目標是做到 O(n)');
  await step(tok);                                   // 3397.3 ⇒ n log n
  C.hl(-1); txt(f, 'T(n) = 2T(n/2) + O(n) ⇒ O(n log n)');
  me.mood('happy');
  say('做得到的話（先偷偷預告）', '時間可以 bound 在 n log n');
  await step(tok);                                   // 3419.8 很好的 template
  await me.hop(tok);
  good('均分兩半 + linear combine ⇒ n log n', 0.4, 0.4);
  say('這是非常好的 template', '能均分兩半、combine 是 linear，就保證 n log n');
}]);

// ═════════════ Lec16 ═════════════

// 05:37 MERGE with AGLOR / HIMST
FRAG.push(['dcjiang-merge-aglor', 'MERGE：AGLOR + HIMST', async (tok) => {
  fresh([0, 3.2, 12.5], [0, 2, 0]);
  let L, Rr, out, pi, pj, ct;
  let i = 0, j = 0, k = 0, cmp = 0;
  const pos = () => { pi.position.set(L.x(Math.min(i, 4)), 4.6, 0); pj.position.set(Rr.x(Math.min(j, 4)), 4.6, 0); if (i === 5) showL(pi, false); if (j === 5) showL(pj, false); };
  const cmpGlow = (on) => { if (i < 5) glow(L.m[i], on ? BLUE : null); if (j < 5) glow(Rr.m[j], on ? BLUE : null); };
  const down = (fromLeft, counted = true) => {
    cmpGlow(false);
    if (counted) { cmp++; txt(ct, '比較 ' + cmp + ' 次'); }
    if (fromLeft) { move(L.m[i], out.x(k), 0.5, 0); i++; } else { move(Rr.m[j], out.x(k), 0.5, 0); j++; }
    k++; if (pi) pos();
  };
  const auto = () => down(j >= 5 || (i < 5 && L.v[i] < Rr.v[j]), i < 5 && j < 5);
  const me = pal('', -6.4, 1.8, '#f4a56a', 0.7);
  await step(tok);                                   // 337.8 左半 A[p..q] 已排好
  L = jRow('AGLOR'.split(''), { dx: 1.0, x0: -5.4, y: 3.4, sz: 0.78, col: lc, drop: true });
  tag('A[p..q]：已排好', 'idx', -3.4, 4.3);
  say('左半邊 A[p..q]', '已經由小排到大');
  await step(tok);                                   // 345.8 右半也排好
  Rr = jRow('HIMST'.split(''), { dx: 1.0, x0: 1.4, y: 3.4, sz: 0.78, col: lc, drop: true });
  tag('A[q+1..r]：已排好', 'idx', 3.4, 4.3);
  say('右半邊 A[q+1..r]', '也已經分別排好');
  await step(tok);                                   // 362.8 另外宣告一個輔助 array
  out = jRow(Array(10).fill(null), { dx: 1.05, y: 0.5, tiles: true });
  tag('輔助 array', 'idx', -6.0, 0.5, 0.7);
  say('為了重整這兩塊', '另外宣告一個額外的 array');
  await step(tok);                                   // 370.8 先抄下來，再寫回去
  note('先抄到這裡 → 最後寫回 A', 0, 1.6);
  say('先把合併結果抄下來', '抄完再寫回 A');
  await step(tok);                                   // 387.8 第一個要放誰？
  const q = pkt('第 1 個放誰？', out.x(0), 1.5);
  me.mood('wow');
  say('第一個 element 要放誰？', '兩邊合起來的最小值');
  await step(tok);                                   // 399.8 兩邊最小都在第一個 → 拿出來比
  kill(q); me.mood('calm');
  ct = tag('比較 0 次', 'ptr alt', 5.6, 1.5);
  cmpGlow(true);
  say('左半最小在第一個、右半最小也在第一個', '把這兩個人拿出來比');
  await step(tok);                                   // 406.8 A vs H → A 下來
  down(true);
  say('A 跟 H 比：A 比較小', 'A 先丟下來');
  await step(tok);                                   // 421.8 用 index 記處理到哪
  pi = tag('i', 'ptr', 0, 4.6); pj = tag('j', 'ptr', 0, 4.6); pos();
  say('處理過的就不見了', '用一個 index 記住現在處理到哪');
  await step(tok);                                   // 429.0 G vs H
  cmpGlow(true);
  say('左半現在最小是 G，右半還是 H', '第二個放誰？一樣比當下兩邊的最小');
  await step(tok);                                   // 441.8 G 下來
  down(true);
  say('G 比較小：G 下來', 'index 繼續往右移');
  await step(tok);                                   // 451.8 L vs H → H
  cmpGlow(true); await beat(tok, 500); down(false);
  say('L 跟 H 比：H 比較小', 'H 往下移');
  await step(tok);                                   // 459.8 五個人下來後：O vs M
  cmpGlow(true); await beat(tok, 350); auto();       // L vs I → I
  cmpGlow(true); await beat(tok, 350); auto();       // L vs M → L
  cmpGlow(true);
  say('依此類推……到這一刻五個人都下來了', '接下來比 O 跟 M');
  await step(tok);                                   // 466.8 M 下來
  down(false);
  say('比較小的 M 抄下來');
  await step(tok);                                   // 470.8 右邊也有一個 index
  glow(Rr.m[j], GOLD); await beat(tok, 500); glow(Rr.m[j], null);
  say('右邊也有一個 index', '記住右邊處理到第幾個');
  await step(tok);                                   // 477.8 繼續到全部丟下來
  while (k < 10) { cmpGlow(true); await beat(tok, 260); auto(); await beat(tok, 120); }
  me.mood('happy');
  say('就這樣繼續下去', '直到所有 element 都丟下來');
  await step(tok);                                   // 491.8 每次比當下兩邊的最小
  note('每次：左半最小 vs 右半最小', 0, 1.6);
  say('每處理一個人，都是拿當下左右兩邊的最小來比', '靠比較關係決定排列順序');
  await step(tok);                                   // 507.9 左 n₁、右 n₂ → 要多少時間？
  tag('n₁ = 5', 'ptr', -3.4, 5.3); tag('n₂ = 5', 'ptr', 3.4, 5.3);
  me.mood('wow');
  say('左邊 n₁ 個人、右邊 n₂ 個人', '產生完整結果要花多少時間？');
  await step(tok);                                   // 531.8 比一次產生一個結果
  say('花的是比較的時間：比一次產生一個結果', '總共要產生 n₁ + n₂ 個結果');
  note('比 1 次 → 下來 1 個', 5.6, 2.2);
  await step(tok);                                   // 560.8 最後一個不用比 → n₁ + n₂ − 1
  tag('最多 n₁ + n₂ − 1 = 9 次', 'pkt', 5.4, 0.2, 1.0);
  say('最後一個人不用比（另一半已經結束）', '最多比 n₁ + n₂ − 1 次（這例子只比了 ' + cmp + ' 次）');
  await step(tok);                                   // 588.8 O(n₁ + n₂) = O(n)
  good('MERGE = O(n₁ + n₂) = O(n)', 0, 6.0);
  me.mood('happy'); await me.hop(tok);
  say('用 big-O 看：O(n₁ + n₂)，n₁ + n₂ 就是總人數', 'MERGE 確實是 linear time');
}]);

// 10:21 closed form；heap sort vs merge sort
FRAG.push(['dcjiang-heap-vs-merge', 'Heap sort vs Merge sort：array 與 linked list', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 2.2, 0]);
  const vals = [26, 5, 37, 1, 61, 11];
  let f, H, M, A, N, cur;
  await step(tok);                                   // 621.0 推出 closed form
  f = tag('T(n) = 2T(n/2) + O(n)', 'pkt', 0, 5.6);
  say('MERGE 是 O(n)', '接著推算 total：會得到一個 closed form');
  await step(tok);                                   // 641.8 recursion 形式很好，但要 closed form
  note('看不出 T(n) 到底多大？→ 要推出 closed form：O(n log n)', 0, 4.9);
  say('有 recursion 的形式很好', '但最好給出 closed form，才看得出 T(n) 是什麼');
  await step(tok);                                   // 690.4 附帶一提：merge sort n log n
  kill(f);
  M = buddy('merge sort', 'n log n', '#7cb8ee', 3.6, 0, 1.6, 0.85);
  say('附帶一提：merge sort', 'running time 會 bound 在 n log n');
  await step(tok);                                   // 702.8 heap sort 也是 n log n
  H = buddy('heap sort', 'n log n', '#f4a56a', -3.6, 0, 1.6, 0.85);
  H.look(1); M.look(-1);
  say('之前的 heap sort 也是 n log n', '兩者表現同等級');
  await step(tok);                                   // 721.8 heap：array 形式
  A = jRow(vals, { dx: 1.2, y: 3.6, idx: true, x0: -5.4 });
  tag('array', 'ptr', -6.4, 3.6);
  glow(A.m[4], GOLD);
  say('heap 的 data structure 很單純', '是 array 形式：用 index 直接抓');
  await step(tok);                                   // 735.8 不能直接用 index 的話
  glow(A.m[4], null); H.mood('wow');
  say('如果 input 不是 array 的形式', '不容易用 index 直接抓到單一 element');
  await step(tok);                                   // 749.8 例如 linked list
  N = vals.map((v, i) => lnode(v, -5.0 + i * 1.95, 1.9, -1.2));
  for (let i = 0; i < 5; i++) arrow(V3(-5.0 + i * 1.95 + 0.95, 1.9, -1.2), V3(-5.0 + (i + 1) * 1.95 - 0.55, 1.9, -1.2));
  tag('linked list', 'ptr', -5.0, 2.8, -1.2);
  say('例如所有 input 都是 linked list');
  await step(tok);                                   // 756.8 找第 5 個只能從頭走
  cur = pkt('從頭走 →', -5.0, 2.8, -0.4);
  for (let i = 0; i < 5; i++) { cur.position.set(-5.0 + i * 1.95, 2.8, -0.4); glow(N[i].userData.data, BLUE); await beat(tok, 300); glow(N[i].userData.data, null); }
  glow(N[4].userData.data, GOLD);
  say('要找第 5 個人', 'linked list 只能從頭一路走過去');
  await step(tok);                                   // 769.8 heap sort 不是好選擇
  H.mood('sad');
  bad('heap sort：沒辦法直接 index', -3.6, 1.6, 2.4);
  say('heap sort 就不見得是好選擇', '它沒辦法直接 index 到想要的 element');
  await step(tok);                                   // 777.8 linked list 用 merge sort 很自然
  M.mood('happy'); await M.hop(tok);
  good('merge sort：很自然', 3.6, 1.6, 2.4);
  say('linked list 用 merge sort', '換個角度看就很自然');
  await step(tok);                                   // 795.8 一樣好，但有小缺點
  say('running time 一樣很好', '只有一個額外的小缺點……');
  await step(tok);                                   // 807.8 MERGE 要額外開輔助 array
  const g = ghostBox('#d64545', 7.0, 0.7, 0.9); g.position.set(0, 0.5, 3.0);
  note('MERGE 的輔助 array → 多耗 memory', 0, 1.1, 3.0);
  M.mood('calm');
  say('memory 多少比較耗', 'MERGE 要額外開一個輔助 array');
}]);

// 14:07 setting up the recurrence
FRAG.push(['dcjiang-recurrence-setup', '解 recurrence 前：base case、去掉 big-O', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 3, 0]);
  const me = pal('', -6.4, 1.8, '#f4a56a', 0.7);
  let t1, t2, R, t3;
  await step(tok);                                   // 847.7 先設定 base case
  t1 = tag('base case（boundary condition）', 'ptr', -1.6, 5.8);
  say('解 recurrence relation 第一件事', '先設定 base case，也就是 boundary condition');
  await step(tok);                                   // 868.8 n = 1：第 1 行判定就結束
  note('n = 1：第 1 行判定就結束', 3.8, 5.8);
  say('n 很小的時候，例如 n = 1', '第 1 行判定完就結束，很快');
  await step(tok);                                   // 890.8 n ≤ 2 都是 constant
  txt(t1, 'T(n) ≤ c，n ≤ 2');
  say('兩個也很簡單', 'n ≤ 2 都設成 constant time：T(n) ≤ c');
  await step(tok);                                   // 907.8 解的時候先把 big-O 換掉
  t2 = tag('T(n) = 2T(n/2) + O(n)', 'pkt', -1.6, 4.6);
  me.mood('wow');
  say('解的時候，我們不喜歡式子裡有 big-O', '第一件事：把它換掉');
  await step(tok);                                   // 923.8 big-O 會干擾計算，最後才 apply
  bad('邊算邊 big-O → term 會不見', 3.8, 4.6);
  say('big-O 會干擾精確的計算，term 會不見', 'big-O 一定是算完之後最後才 apply');
  await step(tok);                                   // 951.8 O(1) ≤ c
  me.mood('calm');
  note('O(1) ≤ c', -4.0, 3.6);
  say('by definition：O(1) 是 constant', '可以說 O(1) ≤ 某個常數 c');
  await step(tok);                                   // 959.8 O(n) ≤ cn
  note('O(n) ≤ cn（n 夠大時）', -1.2, 3.6);
  say('O(n)：n 足夠大時', '一定 ≤ 某個係數乘上 n，也就是 cn');
  await step(tok);                                   // 969.8 改寫
  txt(t2, 'T(n) ≤ 2T(n/2) + cn'); glow(me.body, null);
  say('所以 recurrence 改寫成', 'T(n) ≤ 2T(n/2) + cn');
  await step(tok);                                   // 1006.8 吹毛求疵：其實不太精確
  R = jRow([1, 2, 3, 4, 5, 6, 7], { dx: 0.9, y: 2.0, x0: -0.6, sz: 0.7 });
  t3 = tag('n = 7', 'ptr alt', 2.1, 3.0);
  me.mood('wow');
  say('吹毛求疵一下：左右各 n/2 其實不太精確', '中點明明是取下標（floor）');
  await step(tok);                                   // 1049.8 左 ⌊n/2⌋、右 ⌈n/2⌉
  for (let i = 0; i < 7; i++) move(R.m[i], R.x(i) + (i < 3 ? -0.5 : 0.5), 2.0, 0);
  txt(t3, '左 ⌊7/2⌋ = 3 ｜ 右 ⌈7/2⌉ = 4');
  say('精確寫：左半 T(⌊n/2⌋)、右半 T(⌈n/2⌉)', '左邊少一點、右邊多一點');
  await step(tok);                                   // 1062.8 不影響 asymptotic
  me.mood('happy');
  good('差異很小：asymptotic 可以忽略', 2.1, 1.0);
  say('floor 跟 ceiling 不影響 asymptotic analysis', '差異非常小，直接忽略，照寫 2T(n/2)');
  await step(tok);                                   // 1101.8 附帶：外面怎麼呼叫
  say('最後附帶一提（上次忘了講）', 'MERGE-SORT 是一個 recursive 的 subfunction');
  const mn = tag('main：', 'ptr', -4.6, 0.4);
  await step(tok);                                   // 1138.8 先把 input 放進 array A
  const A = jRow(['?', '?', '?', '?', '?'], { dx: 0.7, y: 0.4, x0: -3.2, sz: 0.55 });
  say('外面（例如 main）先準備好所有 input', '都放到一個叫 A 的 array');
  await step(tok);                                   // 1157.8 MERGE-SORT(A, 1, n)
  txt(mn, 'main：MERGE-SORT(A, 1, n)');
  say('呼叫時說：請你 sort A', '從第 1 個 index 到第 n 個 index 全部都要 sort');
  await step(tok);                                   // 1172.8 內部自己 recursive
  pkt('↻ 內部自己 recursive', 1.6, 0.4);
  await me.hop(tok);
  say('外面只呼叫一次，把所有 data 丟進去', '裡面它自己會去 recursive 處理');
}]);

// 19:57 two methods
FRAG.push(['dcjiang-two-methods', '兩招：Unrolling 與 Substitution', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 3, 0]);
  const me = pal('', -6.4, 1.6, '#f4a56a', 0.7);
  let r, g, eq, m;
  await step(tok);                                   // 1204.8 介紹兩招
  say('怎麼解這個 recurrence relation？', '介紹兩招');
  await step(tok);                                   // 1211.8 第一招 unrolling
  tag('① Unrolling', 'ptr', -3.2, 6.0);
  r = cube('T(n)', '#4b9ee2', [1.3, 0.6, 0.8], -3.2, 5.0, 0, 1);
  say('第一招：unrolling（展開）', '非常好用，我們也很常用');
  await step(tok);                                   // 1217.8 又叫 recursion tree
  relabel(r, 'cn');
  [-4.4, -2.0].forEach((x) => { cube('T(n/2)', '#9b7ef4', [1.3, 0.6, 0.8], x, 3.8, 0, 1); line(-3.2, 4.7, x, 4.1); });
  note('= recursion tree：展開就是在畫樹', -3.2, 2.9);
  say('另一個名字叫 recursion tree', '展開過程就是在畫樹，最後把整棵樹加起來');
  await step(tok);                                   // 1232.8 第二招：歸納法 substitution
  tag('② Substitution', 'ptr', 3.4, 6.0);
  say('第二招用數學歸納法：substitution', '這裡有點玄機');
  await step(tok);                                   // 1240.8 先猜答案（靈感）
  g = tag('先猜：T(n) = O(?)', 'pkt', 3.4, 5.0);
  me.mood('wow');
  say('第一件事：先猜一個答案', '這需要靈感');
  await step(tok);                                   // 1250.8 再用歸納法證
  tag('再用數學歸納法證明', 'ptr alt', 3.4, 4.2);
  good('n 小成立、n 大也成立 ⇒ 猜對了', 3.4, 3.5);
  me.mood('happy');
  say('猜了以後用數學歸納法證明', 'n 很小成立、n 很大也成立 → 猜得很對');
  await step(tok);                                   // 1284.8 要證的是 ≤（upper bound）
  me.mood('calm');
  eq = tag('T(n) ≤ 2T(n/2) + cn', 'ptr', 0, 2.3);
  say('剛剛要證的其實是「≤」的式子', '它是 upper bound');
  await step(tok);                                   // 1307.8 先把 ≤ 換成 =
  txt(eq, 'T(n) = 2T(n/2) + cn（≤ 先換成 =）');
  say('畫 recursion tree 時', '先把「≤」換成「=」，算 upper bound 時的長相');
  await step(tok);                                   // 1321.8 假設 n 是 2 的次方
  const nx = (v) => -4.6 + (v / 64) * 9.4;
  line(nx(0), 0.6, nx(64), 0.6, 0, '#6e5f49');
  for (const v of [16, 32, 64]) tag(String(v), 'idx', nx(v), 0.15);
  say('為了好算：假設 input size n', '是 2 的某個次方');
  await step(tok);                                   // 1338.8 避免 floor / ceiling
  note('不用處理 floor、ceiling、除不盡', nx(32), 1.5);
  say('這樣運算過程中', '不用處理 floor、ceiling 或除不盡');
  await step(tok);                                   // 1353.8 不是就放大：40 多個 → 64
  m = cube('n = 40 多', '#dd8238', [1.4, 0.55, 0.6], nx(42), 1.0, 0, 1);
  await beat(tok, 700);
  move(m, nx(64), 1.0, 0); glow(m, GOLD);
  await me.hop(tok);
  say('不是 2 的次方？放大一點', '40 幾個 → 取 64，頂多多算一點，沒太大影響');
}]);

// 23:03 recursion tree for 2T(n/2) + cn
FRAG.push(['dcjiang-recursion-tree', 'Recursion tree：每層 cn，log₂n 層', async (tok) => {
  fresh([0, 3.2, 13], [0, 3, 0]);
  const Y = [5.6, 4.2, 2.8, 1.4], W = 9.6, L = [];
  const pos = (d, i) => -0.2 - W / 2 + (i + 0.5) * W / (1 << d);
  const lab0 = ['cn', 'cn/2', 'cn/4', 'cn/8'], tl = ['T(n)', 'T(n/2)', 'T(n/4)', 'T(n/8)'];
  const mk = (d) => { const row = []; for (let i = 0; i < (1 << d); i++) { row.push(cube(tl[d], '#9b7ef4', [d === 3 ? 1.05 : 1.3, 0.55, 0.7], pos(d, i), Y[d], 0, 1)); if (d) line(pos(d - 1, i >> 1), Y[d - 1] - 0.3, pos(d, i), Y[d] + 0.3); } L.push(row); };
  const open = (d) => { L[d].forEach((m) => { relabel(m, lab0[d]); tint(m, '#4b9ee2'); }); };
  const me = pal('', -6.4, 1.4, '#f4a56a', 0.7);
  const sums = [];
  await step(tok);                                   // 1388.8 先展開幾層
  say('Recursion tree 的 procedure 很簡單', '就是展開：先展開幾層看看');
  await step(tok);                                   // 1394.8 找出規律
  note('① 展開幾層 → ② 找規律 → ③ 全部加起來', 1.0, 6.5);
  say('展開前面幾層', '通常會找出一些規律（pattern）');
  await step(tok);                                   // 1412.8 把所有 level 加起來
  say('找到規律就知道所有 level 的長相', '再把所有 level 加起來就行了');
  await step(tok);                                   // 1435.8 T(n)：一棵大樹
  mk(0);
  say('一開始要處理的是 T(n)', 'T(n) = 2T(n/2) + cn');
  await step(tok);                                   // 1472.8 每個 node 貢獻一些 running time
  bub('每個 node = 一份 running time，最後全部加起來', 1.0, 0.3, 1.0);
  say('想像長出一棵樹，整棵代表 T(n)', '每個 node 貢獻一些 running time');
  await step(tok);                                   // 1528.8 cn 當一個 node，下面兩棵小 tree
  open(0); mk(1);
  say('確定的部分 cn：create 一個 node', '下面掛兩棵小 tree：T(n/2)');
  await step(tok);                                   // 1554.8 就是 T(n) = 2T(n/2) + cn
  me.mood('happy');
  say('這就是 T(n) = 2T(n/2) + cn', '大家都畫得出來');
  await step(tok);                                   // 1574.8 再展開 T(n/2)
  open(1); mk(2);
  say('再展開 T(n/2)：n 換成 n/2 帶進去', 'node 是 cn/2，下面又長兩棵 T(n/4)');
  await step(tok);                                   // 1619.8 四棵小樹，node 是 cn/4
  open(2); mk(3); open(3);
  say('下面有四棵小樹', '每個 node 是 cn/4，再各掛兩棵……');
  await step(tok);                                   // 1646.8 level by level：第一層 cn
  me.mood('calm');
  const add = (d, s) => { L[d].forEach((m) => glow(m, GOLD)); sums.push(tag(s, 'ptr alt', 5.6, Y[d])); };
  add(0, '第 1 層：cn');
  say('最後把整棵樹加起來', 'level by level：第一層貢獻 cn');
  await step(tok);                                   // 1654.8 第二層 2 · cn/2 = cn
  add(1, '2 · cn/2 = cn');
  say('第二層：兩個 cn/2', '貢獻也是 cn');
  await step(tok);                                   // 1668.1 第三層 4 · cn/4 = cn
  add(2, '4 · cn/4 = cn');
  say('第三層：四個 cn/4', '加起來也是 cn');
  await step(tok);                                   // 1676.8 每層都是 cn
  add(3, '8 · cn/8 = cn');
  tag('⋮', 'idx', -0.2, 0.5);
  say('依此類推：8 個 cn/8、16 個 cn/16……', '每一層總和都是 cn');
  await step(tok);                                   // 1686.8 有多深？
  me.mood('wow');
  say('問題是：這棵樹有多深？', '跟 n 有多大有關');
  await step(tok);                                   // 1703.8 n 除以 2 幾次變 1 → log₂n
  tag('log₂n 層', 'pkt', -6.0, 3.5);
  say('n 是 2 的次方：除以 2 幾次會變成 1？', 'log₂n 次 → log₂n 層');
  await step(tok);                                   // 1739.8 總和 cn · log₂n
  good('總和 = cn · log₂n', 1.0, 0.3, 1.2);
  say('每層 cn，共 log₂n 層', '加起來 cn · log₂n');
  await step(tok);                                   // 1748.8 取 big-O → n log n
  me.mood('happy'); await me.hop(tok);
  good('取 big-O：O(n log n)', 1.0, -0.4, 1.2);
  say('取 big-O，c 拿掉', '剩下 n log n');
}]);

// 29:21 homework: binary search recursion tree
FRAG.push(['dcjiang-bsearch-rtree', '作業：binary search 的 recursion tree', async (tok) => {
  fresh([0, 3.2, 12], [0, 3, 0]);
  const Y = [5.6, 4.4, 3.2, 2.0, 0.6], L = ['T(n)', 'T(n/2)', 'T(n/4)', 'T(n/8)', 'T(1)'];
  const me = pal('', -4.6, 1.4, '#f4a56a', 0.75);
  const ms = [];
  await step(tok);                                   // 1761.0 作業：binary search
  pkt('作業', 2.8, 6.2);
  tag('binary search：T(n) = T(n/2) + c', 'ptr', 2.8, 5.6);
  say('回去試做 binary search（作業）', '一定比 merge sort 簡單多');
  await step(tok);                                   // 1776.8 畫 recursion tree：degenerate
  for (let d = 0; d < 5; d++) {
    if (d === 4) tag('⋮', 'idx', 0, 1.35);
    ms.push(cube(L[d], '#9b7ef4', [1.3, 0.6, 0.8], 0, Y[d], 0, 1));
    if (d && d < 4) line(0, Y[d - 1] - 0.32, 0, Y[d] + 0.32);
    await beat(tok, 260);
  }
  say('畫 binary search 的 recursion tree', '它是 degenerate 的：不會變胖');
  await step(tok);                                   // 1783.8 一直小小的
  me.mood('happy');
  note('每層只有一個 node', 2.6, 3.2);
  say('一直都小小的', '每一層只有一個子問題');
  await step(tok);                                   // 1789.8 complexity 有多高？
  ms.forEach((m) => { relabel(m, 'c'); glow(m, GOLD); });
  tag('log₂n 層', 'ptr', -2.0, 3.2);
  me.mood('wow');
  say('用 recursion tree 算它的 complexity', '自己推推看，也可以證明它（提示：每層 c、log₂n 層）');
}]);

// 30:04 substitution proof
FRAG.push(['dcjiang-substitution', 'Substitution：猜 cn log₂n，再歸納證明', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 3, 0]);
  const P = ['猜：T(n) ≤ c · n · log₂n   (n ≥ 2)', 'Base：T(2) ≤ c ≤ c · 2 · log₂2 ✓', 'Strong：假設所有 m < n 都成立',
    'T(n/2) ≤ c(n/2) · log₂(n/2)', '       = c(n/2)(log₂n − 1)', 'T(n) ≤ 2T(n/2) + cn', '     ≤ cn(log₂n − 1) + cn',
    '     = cn·log₂n − cn + cn', '     = cn·log₂n   ✓'];
  const C = code(P, -1.6, 5.4);
  C.ls.forEach((l) => showL(l, false));
  const show = (i) => { showL(C.ls[i], true); C.hl(i); };
  const me = pal('', -6.4, 1.6, '#f4a56a', 0.7);
  let nT, h1, h2;
  await step(tok);                                   // 1803.8 第二招 substitution
  tag('② Substitution', 'ptr', -1.6, 6.3);
  say('第二招：substitution', '其實沒什麼好講');
  await step(tok);                                   // 1811.8 有靈感就猜，再用歸納法證
  me.mood('wow');
  bub('有靈感 → 先猜 → 再用歸納法證', 3.4, 6.3);
  say('有靈感就先猜一個答案', '再用數學歸納法證明它');
  await step(tok);                                   // 1825.8 recursion tree 已偷偷知道答案
  show(0);
  say('剛剛用 recursion tree 已偷偷知道答案', '那就猜 n log₂n');
  await step(tok);                                   // 1853.8 不用 big-O 加減，寫成 exact form
  me.mood('calm');
  note('不拿 big-O 加減：寫成 exact 的式子', 4.4, 0.6);
  say('證明時不直接用 big-O 做加減', '寫成 T(n) ≤ … 的 exact 形式，係數才不會多算少算');
  await step(tok);                                   // 1885.8 找適當的 c，n ≥ 2
  glow(me.body, null);
  say('一定找得到一個適當的 c', '使 T(n) ≤ c · n · log₂n，n ≥ 2 就成立');
  await step(tok);                                   // 1899.8 base case 直接帶入
  show(1);
  say('Base case：直接帶一下', '很容易就算出來');
  await step(tok);                                   // 1916.8 strong induction
  show(2);
  say('Inductive step 用 strong induction', '所有小於 n 都對 ⇒ 推 n 也對');
  await step(tok);                                   // 1926.9 每次跳兩倍
  nT = cube('n', '#4b9ee2', [1, 0.6, 0.8], 5.4, 4.6, 0, 1);
  h1 = cube('n/2', '#9b7ef4', [0.9, 0.55, 0.8], 4.7, 3.2, 0, 1); h2 = cube('n/2', '#9b7ef4', [0.9, 0.55, 0.8], 6.1, 3.2, 0, 1);
  line(5.4, 4.3, 4.7, 3.5); line(5.4, 4.3, 6.1, 3.5);
  say('因為每次都跳兩倍', '所以用 strong induction');
  await step(tok);                                   // 1937.8 n/2 < n → 抄下 hypothesis
  show(3); glow(h1, GOLD); glow(h2, GOLD);
  say('n/2 當然小於 n，所以它也成立', '直接把式子抄下來：T(n/2) ≤ c(n/2)log₂(n/2)');
  await step(tok);                                   // 1950.8 log₂(n/2) = log₂n − 1
  show(4);
  say('log₂(n/2) = log₂n − 1', '次方少一次');
  await step(tok);                                   // 1966.8 處理 T(n) ≤ 2T(n/2) + cn
  show(5); glow(h1, null); glow(h2, null); glow(nT, GOLD);
  say('要處理的是這個式子', 'T(n) ≤ 2T(n/2) + cn');
  await step(tok);                                   // 1975.8 把算好的帶進來
  show(6);
  say('把剛剛算好的 T(n/2) 帶進來', '2 · c(n/2)(log₂n − 1) = cn(log₂n − 1)');
  await step(tok);                                   // 1986.8 −cn 與 +cn
  show(7);
  say('展開：cn·log₂n − cn + cn', '有一個 −cn、一個 +cn');
  await step(tok);                                   // 1997.8 抵消 → 證完
  show(8); me.mood('happy'); await me.hop(tok);
  good('證完：T(n) = O(n log n)', 4.4, 0.6);
  say('抵消，就證完了', '這個例子很好做');
}]);

// counting inversion helpers
const INV12 = [1, 5, 4, 8, 10, 2, 6, 9, 12, 11, 3, 7];
const invPairs = (a, i0, i1, j0, j1) => { const p = []; for (let i = i0; i <= i1; i++) for (let j = Math.max(j0, i + 1); j <= j1; j++) if (a[i] > a[j]) p.push([i, j]); return p; };

// 34:56 / 45:30 songs & crossings；params.mode = 'review'
FRAG.push(['dcjiang-inv-songs', 'Counting inversion：連線的 crossing', async (tok) => {
  fresh([0, 3, 11.5], [0, 2.4, 0]);
  const review = prm().mode === 'review';
  const you = [2, 4, 1, 3, 5], dx = 2.0, x = (i) => -4 + i * dx;
  let top = [], bot = [], L = {}, ct = null;
  const me = buddy('我', '', '#7cb8ee', -6.3, 3.6, 0.8, 0.6), yo = buddy('你', '', '#f4a56a', -6.3, 0.2, 0.8, 0.6);
  const showTop = () => { top = [1, 2, 3, 4, 5].map((v, i) => { tag('ABCDE'[i], 'idx', x(i), 5.1); return cube(v, colorFor(v), [0.8, 0.8, 0.8], x(i), 4.2, 0, 1.2); }); };
  const showBot = () => { bot = you.map((v, i) => cube(v, colorFor(v), [0.8, 0.8, 0.8], x(i), 0.8, 0, 2)); };
  const connect = async (ms) => { for (let v = 1; v <= 5; v++) { L[v] = line(x(v - 1), 3.75, x(you.indexOf(v)), 1.25, 0, '#a99470'); await beat(tok, ms); } };
  const hit = async (pairs, ms) => {
    for (const [a, b] of pairs) {
      L[a].material.color.set('#d64545'); L[b].material.color.set('#d64545');
      glow(top[a - 1], RED); glow(top[b - 1], RED); await beat(tok, ms);
      L[a].material.color.set('#a99470'); L[b].material.color.set('#a99470'); glow(top[a - 1], null); glow(top[b - 1], null);
    }
  };
  const cross = [[1, 2], [1, 4], [3, 4]];
  if (review) {
    await step(tok);                                 // 2730.8 兩個 sequence 有多像
    say('Counting inversion：看兩個 sequence 有多像');
    await step(tok);                                 // 2740.8 先固定第一個為 1 2 3 4 5
    showTop();
    say('先固定第一個 sequence', '標成 1 2 3 4 5 的順序');
    await step(tok);                                 // 2747.8 看另一個 sequence
    showBot();
    say('再看另一個對應的 sequence', '同樣的東西，它排在哪裡？');
    await step(tok);                                 // 2769.8 我最喜歡的五首歌 ABCDE
    me.mood('happy');
    say('例：我最喜歡的五首歌 ABCDE，依序 1 到 5', '你也喜歡這五首，但順序有點不一樣');
    await step(tok);                                 // 2790.8 我最愛的在你那排第三；你最愛的是第二首
    glow(top[0], GOLD); glow(bot[2], GOLD); glow(bot[0], BLUE);
    say('我最喜歡的，在你那裡排第三', '你最喜歡的是第二首');
    await step(tok);                                 // 2810.8 產生一個 inversion
    glow(top[0], null); glow(bot[2], null); glow(bot[0], null);
    yo.mood('wow');
    note('1、2 這對：喜好相反 → 1 個 inversion', 2.0, 2.5);
    say('我比較喜歡第一首、你比較喜歡第二首', '這裡就產生一個 inversion');
    await step(tok);                                 // 2823.8 連線，crossing = inversion
    await connect(200);
    say('把兩個 sequence 對應的數字連線', '一個 crossing 就是一個 inversion 發生的點');
    await step(tok);                                 // 2829.8 這例有 3 個
    ct = tag('inversion = 3', 'pkt', 5.4, 2.5);
    await hit(cross, 450);
    say('這個 case 有 3 個 inversion');
    await step(tok);                                 // 2847.8 真正的 input 只有另一個順序
    for (const m of top) tint(m, DIM);
    bub('真正的 input：只有「你」的順序', 0, -0.3, 1.0);
    say('一開始已固定其中一人的 ranking', '真正的 input 只有另一個順序');
    await step(tok);                                 // 2868.8 兩兩比對 n²
    bad('一一比對：O(n²)', 3.4, 5.6);
    say('認真一一 pairwise 比對', 'complexity 會 bound 在 n²');
    await step(tok);                                 // 2876.8 D&C：n log n
    good('D&C：O(n log n)', 3.4, 6.2);
    me.mood('happy'); yo.mood('happy');
    say('用 divide and conquer', '只需要 n log n');
    return;
  }
  await step(tok);                                   // 2096.8 counting inversion
  pkt('Counting inversion', 0, 6.2);
  say('第二個問題：counting inversion', 'merge sort template 的小小 extension');
  await step(tok);                                   // 2103.8 兩個 sequence 的相似度
  say('它可以算兩個 sequence 的相似度');
  await step(tok);                                   // 2115.8 音樂網站、排行榜
  say('例如網路上的音樂網站', '旁邊都有排行榜');
  note('♪ 音樂網站：排行榜', 3.6, 5.4);
  await step(tok);                                   // 2133.8 分析聽眾喜好有多像
  say('網站可以分析所有聽眾的喜好', '有多像、或有多不像');
  await step(tok);                                   // 2160.8 算的是「不像」的部分
  bub('counting inversion 算的是「不像」', 3.6, 4.7);
  say('看兩人對這些歌的排名', 'counting inversion 算的是不像的部分');
  await step(tok);                                   // 2171.7 兩個人、五首歌
  showTop();
  say('假設兩個人、五首歌', '兩個人都對這五首歌做排名');
  await step(tok);                                   // 2194.8 我：ABCDE 依序 1 2 3 4 5
  me.mood('happy');
  say('先固定我的排名：照順序', 'A B C D E 分別是 1 2 3 4 5');
  await step(tok);                                   // 2202.8 你依喜好評比
  showBot();
  say('你也依喜好評比：最喜歡給第 1 名', '最不喜歡給第 5 名 → 2 4 1 3 5');
  await step(tok);                                   // 2242.8 什麼叫 inversion？
  say('什麼叫一個 inversion？', '我的 rank 是 1 2 3 4 5，你的是 a₁ a₂ … aₙ');
  await step(tok);                                   // 2261.8 我 1 在 2 前，你 2 在 1 前
  glow(top[0], RED); glow(top[1], RED); glow(bot[0], RED); glow(bot[2], RED);
  yo.mood('wow');
  say('我：1 排在 2 前面；你：2 在前、1 在後', '你我對這兩首歌的喜好相反');
  await step(tok);                                   // 2291.8 總和 = 有多不一樣
  [top[0], top[1], bot[0], bot[2]].forEach((m) => glow(m, null));
  ct = tag('inversion 越多 → 越不像', 'pkt', 5.4, 2.5);
  say('這些 inversion 的總和', '代表我和你的喜好有多不一樣');
  await step(tok);                                   // 2310.8 相同數字連線
  await connect(260);
  say('簡單的算法：兩排寫好', '1 和 1 連線、2 和 2 連線……');
  await step(tok);                                   // 2318.8 這三條代表 inversion
  [1, 2, 4].forEach((v) => L[v].material.color.set('#d64545'));
  say('左邊這三條線', '代表我和你之間的 inversion');
  await step(tok);                                   // 2337.8 數 crossing
  [1, 2, 4].forEach((v) => L[v].material.color.set('#a99470'));
  txt(ct, 'inversion = 0');
  let c = 0;
  for (const [a, b] of cross) { await hit([[a, b]], 380); c++; txt(ct, 'inversion = ' + c); }
  me.mood('happy');
  say('看連線裡有幾個叉叉（crossing）', '3 個 crossing = 3 個 inversion');
}]);

// 39:23 brute force O(n²)
FRAG.push(['dcjiang-inv-brute', 'Brute force：往後找比較小的', async (tok) => {
  fresh([0, 3, 11], [0, 1.4, 0]);
  let R, ct, cc, cur, inv = 0, cmp = 0;
  const me = pal('', -5.6, 1.6, '#f4a56a', 0.7);
  const look = async (i, j, ms) => {
    cmp++; txt(cc, '比較 ' + cmp + ' 次');
    const hit = R.v[j] < R.v[i]; glow(R.m[j], hit ? RED : BLUE);
    if (hit) { inv++; txt(ct, 'inversion = ' + inv); }
    await beat(tok, ms); glow(R.m[j], null);
  };
  const scan = async (i, j0, j1, ms) => { cur.position.set(R.x(i), 1.6, 0); glow(R.m[i], GOLD); for (let j = j0; j <= j1; j++) await look(i, j, ms); };
  await step(tok);                                   // 2363.8 我的 rank 不用給
  tag('我：1 2 3 4 5 … n（預設）', 'ptr', 0, 4.4);
  say('給定我的 rank 和另一個人的 rank', '我的其實不用給：預設就是 1 到 n 排好');
  await step(tok);                                   // 2376.8 你的 rank a₁ … aₙ
  R = jRow([2, 4, 1, 3, 5], { dx: 1.6, tiles: true, idx: true, drop: true });
  tag('你：a₁ … aₙ', 'ptr alt', -4.2, 2.6);
  say('要看的是你的 rank a₁ 到 aₙ', '跟我的之間有多少 inversion');
  await step(tok);                                   // 2385.8 brute force
  ct = tag('inversion = 0', 'pkt', 2.4, 3.2); cc = tag('比較 0 次', 'idx', 2.4, 2.6);
  say('Brute force：一一去比', '總是會算出結果');
  await step(tok);                                   // 2408.8 你的 sequence 2 4 1 3 5
  say('我已預設從小排到大，只要看你的 sequence', '例如 2 4 1 3 5');
  await step(tok);                                   // 2413.8 看 2：往後有多少人比它小
  cur = tag('i', 'ptr', R.x(0), 1.6); glow(R.m[0], GOLD);
  me.look(1);
  say('看 2：往後看有多少人比它小', '有幾個就有幾個 inversion');
  await step(tok);                                   // 2420.8 只有 1 比它小
  for (let j = 1; j < 5; j++) await look(0, j, 300);
  glow(R.m[0], null);
  say('2 往後看：只有 1 比它小', '(2, 1) 是一個 inversion');
  await step(tok);                                   // 2428.8 看 4：1 比它小
  await scan(1, 2, 2, 600);
  say('接下來看 4', '1 比它小 → (4, 1) 一個 inversion');
  await step(tok);                                   // 2437.8 3 也比它小；1 往後都比它大
  await scan(1, 3, 4, 400); glow(R.m[1], null);
  await scan(2, 3, 4, 300); glow(R.m[2], null);
  say('3 也比 4 小 → (4, 3)', '1 往後看：所有人都比它大');
  await step(tok);                                   // 2444.8 3 往後 5 比較大 → 沒有
  await scan(3, 4, 4, 500); glow(R.m[3], null);
  me.mood('happy');
  say('3 往後看：5 也比它大，沒有 inversion', '掃過一次：total 3 個');
  await step(tok);                                   // 2456.8 每個人都往後掃一遍
  note('(n−1) + (n−2) + … + 1', 2.4, 4.4);
  say('每個人都要往後掃過一次', '第一個掃 n−1 個、第二個掃 n−2 個……');
  await step(tok);                                   // 2463.8 n² 次比較
  bad('O(n²)', 2.4, 5.0);
  me.mood('sad');
  say('overall 要 n² 這麼多次比較');
  await step(tok);                                   // 2473.7 based on merge sort：n log n
  good('based on merge sort：O(n log n)', -1.6, 5.0);
  me.mood('happy'); await me.hop(tok);
  say('based on 前面 merge sort 的結果', '只需要 n log n 就做得到');
}]);

// 41:33 / 48:18 D&C on 12 songs: 5 + 8 + 9；params.mode = 'review'
FRAG.push(['dcjiang-inv-dc', 'D&C：左內部 + 右內部 + 跨組', async (tok) => {
  fresh([0, 3, 12], [0, 1.6, 0]);
  const review = prm().mode === 'review';
  const X = (i) => (-(11) * 0.88 / 2 + i * 0.88) + (i < 6 ? -0.5 : 0.5);
  let R = null, cutL = null, mine = null;
  const me = pal('', -6.4, 2.2, '#f4a56a', 0.65);
  const mkRow = () => { R = jRow(INV12, { dx: 0.88, sz: 0.7, y: 0.6, drop: true }); };
  const mkMine = () => { mine = tag('我：1 2 3 … 12（照順序）', 'ptr', 0, 2.9); };
  const split = () => { for (let i = 0; i < 12; i++) move(R.m[i], X(i), 0.6, 0); cutL = line(0, -0.2, 0, 1.8, 0, '#6e5f49'); };
  const run = async (pairs, name, x, col, ms) => {
    let c = 0; const tg = tag(name + ' = 0', 'pkt', x, 2.0);
    for (const [i, j] of pairs) { glow(R.m[i], col); glow(R.m[j], col); c++; txt(tg, name + ' = ' + c); await beat(tok, ms); glow(R.m[i], null); glow(R.m[j], null); }
    return c;
  };
  const xl = (X(2) + X(3)) / 2, xr = (X(8) + X(9)) / 2;
  if (review) {
    await step(tok);                                 // 2897.8 只給第二個 sequence
    mkRow();
    say('這邊只給第二個 sequence', '（12 首歌，你的排名）');
    await step(tok);                                 // 2903.8 第一個預設 1 … 12
    mkMine();
    say('第一個 sequence 我已經知道', '預設 1 到 12 依序排好');
    await step(tok);                                 // 2934.8 一刀切成前半、後半
    kill(mine); split();
    me.mood('wow');
    say('一次算整個 sequence 的 inversion 不會', '一刀切下去：平均分成前半段、後半段');
    await step(tok);                                 // 2943.8 divide → conquer → combine
    note('Divide → Conquer → Combine', 0, 3.6);
    say('這是 divide；之後分別 conquer', '最後再 combine');
    await step(tok);                                 // 2964.8 前半內部 5 對
    me.mood('calm');
    await run(invPairs(INV12, 0, 5, 0, 5), '前半內部', xl, BLUE, 420);
    say('區域性先算：前半這一塊', '有 5 對 inversion');
    await step(tok);                                 // 2970.8 後半內部 8 對
    await run(invPairs(INV12, 6, 11, 6, 11), '後半內部', xr, GREEN, 300);
    say('後半這一塊', '有 8 對 inversion');
    await step(tok);                                 // 2982.8 兩組之間還沒算
    bub('前半 ↔ 後半之間的還沒算！', 0, 3.0);
    say('這兩個數字只是各自內部的量', '還有兩個 group 之間的 inversion 沒算');
    await step(tok);                                 // 3002.8 combine 時算跨組
    await run(invPairs(INV12, 0, 5, 6, 11), '跨組', 0, RED, 260);
    say('第三步 combine 的時候', '把兩組之間的 inversion 算出來');
    await step(tok);                                 // 3025.8 5 + 8 + 9
    good('total = 5 + 8 + 9 = 22', 0, 4.4);
    me.mood('happy');
    say('5 + 8 + 9', '就是 total 所有的 inversion');
    await step(tok);                                 // 3052.8 combine：5 + 8 之外再加跨組
    await me.hop(tok);
    say('combine 時：除了 5 + 8', '還要把跨組的 inversion 算出來加進去');
    return;
  }
  await step(tok);                                   // 2492.8 12 首歌：你的排名
  mkRow();
  say('一樣是 divide and conquer', '這邊有 12 首歌，這是你的排名');
  await step(tok);                                   // 2498.8 我的排名照順序
  mkMine();
  say('我的排名當然照順序', '1、2、3……一直到 12');
  await step(tok);                                   // 2506.8 一次算不會 → 拆掉
  me.mood('wow');
  say('一次算這麼多人的 inversion', '不會算 → 一樣把它拆掉');
  await step(tok);                                   // 2514.8 先切一半
  kill(mine); split();
  say('先切一半再說');
  await step(tok);                                   // 2522.8 各自小 group 的 inversion
  me.mood('calm');
  await run(invPairs(INV12, 0, 5, 0, 5), '左內部', xl, BLUE, 300);
  await run(invPairs(INV12, 6, 11, 6, 11), '右內部', xr, GREEN, 220);
  say('分別算切出來的小部分', '各自小 group 內部的 inversion');
  await step(tok);                                   // 2540.8 combine：還有一部分沒算
  say('第三步 combine', '還有一部分 inversion 沒算');
  bub('還少了什麼？', 0, 3.0);
  await step(tok);                                   // 2553.8 跨 group 的 inversion
  await run(invPairs(INV12, 0, 5, 6, 11), '跨組', 0, RED, 250);
  say('剛剛只看前半內部、後半內部', '還有跨 group（左一個、右一個）的 inversion');
  await step(tok);                                   // 2576.8 一樣是 divide, conquer, combine
  note('Divide → Conquer → Combine', 0, 3.6);
  say('basic idea 一樣：', 'divide、conquer、combine');
  await step(tok);                                   // 2587.8 conquer：recursively 算內部
  pkt('↻ recursive', xl, 4.2); pkt('↻ recursive', xr, 4.2);
  say('Divide：均勻分成前後兩部分', 'Conquer：recursively 算各自內部的 inversion');
  await step(tok);                                   // 2601.8 combine：算跨 group
  say('Combine：把跨 group 的 inversion 算出來', '內部的剛剛已經算過了');
  await step(tok);                                   // 2615.8 三個數字相加
  good('左內部 + 右內部 + 跨組 = 全部', 0, 4.9);
  me.mood('happy');
  say('左內部 + 右內部 + 跨組', '三個數字加起來就是全部的 inversion');
  await step(tok);                                   // 2640.8 難在 combine
  me.mood('sad');
  say('切很簡單：正中央一刀', 'conquer 交給 recursive call；難的是 combine');
  await step(tok);                                   // 2663.8 目標 linear → n log n
  me.mood('happy'); await me.hop(tok);
  say('目標：用 linear time 算完跨組 inversion', '做到的話，counting inversion 也是 n log n');
}]);

// 51:03 counting cross inversions on unsorted halves
FRAG.push(['dcjiang-inv-cross-brute', '跨組 inversion：沒排序就要一個一個比', async (tok) => {
  fresh([0, 3, 12], [0, 1.6, 0]);
  const R = jRow(INV12, { dx: 0.88, sz: 0.7, y: 0.6 });
  const X = (i) => R.x(i) + (i < 6 ? -0.5 : 0.5);
  for (let i = 0; i < 12; i++) move(R.m[i], X(i), 0.6, 0);
  line(0, -0.2, 0, 1.8, 0, '#6e5f49');
  const me = pal('', -6.4, 2.4, '#f4a56a', 0.65);
  await step(tok);                                   // 3062.8 怎麼有效率地 combine
  say('問題：怎麼很有效率地做 combine？');
  await step(tok);                                   // 3081.8 recursive 不用擔心；麻煩在 combine
  pkt('↻ 內部：交給 recursive', -2.8, 2.6); pkt('↻ 內部：交給 recursive', 2.8, 2.6);
  say('兩個 group 自己 recursively 去 count', '不用擔心；最麻煩的是 combine');
  await step(tok);                                   // 3103.8 暴力 n²
  bad('跨組暴力算：O(n²)', 0, 3.4);
  me.mood('sad');
  say('跨 group 的 inversion 是最難的部分', '暴力計算的 complexity 是 n²');
  await step(tok);                                   // 3116.8 template：combine linear → n log n
  me.mood('calm');
  good('目標：combine 在 linear time → O(n log n)', 0, 4.1);
  say('merge sort 的 template 告訴我們', 'combine 若 linear time，就保證 n log n');
  await step(tok);                                   // 3141.8 intra 與 inter
  note('intra：內部的', -2.8, 3.3); note('inter：跨組的', 2.8, 3.3);
  say('inversion 分兩塊', 'intra（內部的）與 inter（跨組的）');
  await step(tok);                                   // 3153.8 intra 交給機制，難的是 inter
  say('intra 交給 D&C 機制自己算好', '難算的是跨 group 的 inter');
  await step(tok);                                   // 3168.8 現在只要算跨組
  say('現在目標只要算跨 group 的 inversion', '每個 group 內部的已經不重要了');
  await step(tok);                                   // 3195.8 前半不整齊
  for (let i = 0; i < 6; i++) glow(R.m[i], GOLD);
  await beat(tok, 600);
  for (let i = 0; i < 6; i++) glow(R.m[i], null);
  say('剛剛是直接一刀切下去', '前半段的數字不整齊，就是 input 的順序');
  await step(tok);                                   // 3208.8 拿 6 來看
  move(R.m[6], X(6), 2.4, 0); glow(R.m[6], GOLD);
  say('拿 6 這個數字來看', '它跟前面這個 group 產生多少 inversion？');
  await step(tok);                                   // 3225.8 沒排序 → 一一比對
  const cur = tag('↓', 'ptr', X(0), 1.6);
  for (let i = 0; i < 6; i++) {
    cur.position.set(X(i), 1.6, 0);
    const hit = INV12[i] > 6; glow(R.m[i], hit ? RED : BLUE);
    await beat(tok, 330);
    if (!hit) glow(R.m[i], null);
  }
  say('沒有特別的排列：一一去比對', '看前面有沒有人比 6 大');
  await step(tok);                                   // 3238.8 8 和 10 → 2 個
  tag('(8, 6)、(10, 6)：2 個', 'pkt', 3.2, 3.2);
  say('8 和 10 比 6 大', '(8, 6)、(10, 6) 兩個 inversion');
  await step(tok);                                   // 3262.8 每個人都要掃一遍
  me.mood('sad');
  bad('每個人都掃一遍 → complexity 增加', 0, 4.9);
  say('這樣 brute force：每個人都要掃一遍', 'complexity 就會增加');
}]);

// 54:36 merge-and-count on sorted halves
FRAG.push(['dcjiang-merge-count', 'Merge-and-Count：排好序後一次掃過', async (tok) => {
  fresh([0, 3.2, 12.5], [0, 2, 0]);
  const Lv = [1, 2, 4, 5, 8, 10], Rv = [3, 6, 7, 9, 11, 12];
  let L, Rr, pi, ct, out, inv = 0, i = 0;
  const me = pal('', -6.4, 1.8, '#f4a56a', 0.65);
  const at = (k) => pi.position.set(L.x(Math.min(k, 5)) , 4.5, 0);
  const skip = async (ms) => { glow(L.m[i], BLUE); await beat(tok, ms); glow(L.m[i], null); tint(L.m[i], DIM); i++; at(i); };
  const hold = (r) => { for (let t = i; t < 6; t++) glow(L.m[t], RED); const c = 6 - i; inv += c; txt(ct, '跨組 inversion = ' + inv); glow(Rr.m[r], GOLD); return c; };
  const clear = (r) => { for (let t = 0; t < 6; t++) glow(L.m[t], null); glow(Rr.m[r], null); };
  await step(tok);                                   // 3275.8 若內部算完順便排好
  say('如果算完內部 inversion 的時候', '可以順便從小排到大……');
  await step(tok);                                   // 3296.8 排好的樣子
  L = jRow(Lv, { dx: 0.92, x0: -5.4, y: 3.4, sz: 0.72, drop: true }); Rr = jRow(Rv, { dx: 0.92, x0: 1.0, y: 3.4, sz: 0.72, drop: true });
  tag('前半（排好）', 'idx', -3.1, 4.3, -0.5); tag('後半（排好）', 'idx', 3.3, 4.3, -0.5);
  say('前半、後半都算好內部 inversion', '也都由小排到大了');
  await step(tok);                                   // 3304.8 算 3
  glow(Rr.m[0], GOLD);
  pi = tag('index', 'ptr', L.x(0), 4.5);
  ct = tag('跨組 inversion = 0', 'pkt', 0, 5.6);
  say('來算 3 跟前面 group 有多少 inversion', '目標：前面有多少人比 3 大');
  await step(tok);                                   // 3324.8 1、2 比它小：跳過
  await skip(400); await skip(400);
  say('從第一個開始比：1 比它小，跳過', '2 也比它小，跳過');
  await step(tok);                                   // 3331.8 4 > 3 停下
  glow(L.m[i], RED);
  say('第三個是 4：4 > 3', '在這邊停下來');
  await step(tok);                                   // 3339.8 共 6 個，從第三個起都比較大 → 4
  hold(0);
  say('前面一共 6 個，從第 3 個開始都比 3 大', '3 貢獻 4 個跨組 inversion');
  await step(tok);                                   // 3360.8 接下來看 6
  clear(0); glow(Rr.m[1], GOLD);
  say('接下來看 6', '6 一定排在 3 後面（後半也排好了）');
  await step(tok);                                   // 3378.8 前面兩個比 3 小，當然比 6 小
  note('1、2 < 3 < 6：不用回頭', -3.1, 2.3);
  say('前面兩個人比 3 小', '當然也比 6 小 → 不用理它們');
  await step(tok);                                   // 3385.8 從 4 開始：4、5 skip
  await skip(400); await skip(400);
  say('從 4 開始比：4 比 6 小，skip', '5 也比 6 小，skip');
  await step(tok);                                   // 3392.8 8 > 6 停 → 2 個
  hold(1);
  say('到 8：8 > 6，停下來', '已經 skip 四個 → 6 貢獻 2 個');
  await step(tok);                                   // 3421.8 index 只走一次
  clear(1);
  me.mood('wow');
  bub('index 不來回，只往前走', L.x(4), 5.4, -0.5);
  say('有沒有發現：前面這個 sequence 沒有來回 scan', 'index 只走一次');
  await step(tok);                                   // 3441.8 7：繼續 hold 在 8
  hold(2);
  say('做 7：index 繼續停在 8', '7 貢獻 2 個');
  await step(tok);                                   // 3450.8 9：skip 8，到 10 hold；之後都 0
  clear(2); await skip(350);
  hold(3); await beat(tok, 500); clear(3);
  await skip(350);
  say('9：skip 8，到 10 停下 → 1 個', '10 也 skip 掉，11、12 都是 0：4 + 2 + 2 + 1 = 9');
  await step(tok);                                   // 3461.8 一遍 → O(n)
  me.mood('happy');
  good('從頭到尾只掃一遍：O(n)', 0, 6.3);
  say('從頭到尾只掃過一遍', '就是 O(n)：linear scan');
  await step(tok);                                   // 3513.8 往上一層還要 merge
  for (let t = 0; t < 6; t++) tint(L.m[t], colorFor(Lv[t]));
  out = jRow(Array(12).fill(null), { dx: 0.92, y: 0.5, tiles: true });
  say('再往上一層 combine 之前', '要把前後兩塊重新 merge 成由小排到大');
  await step(tok);                                   // 3526.8 沿用 merge sort：輪流比，小的丟下來
  { const all = Lv.map((v, k) => [v, L.m[k]]).concat(Rv.map((v, k) => [v, Rr.m[k]])).sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < 12; k++) { move(all[k][1], out.x(k), 0.5, 0); await beat(tok, 170); } }
  showL(pi, false);
  say('沿用 merge sort：輪流比大小', '小的丟下來，也是 linear time');
  await step(tok);                                   // 3540.8 兩件事同時做 → linear
  say('排序跟算跨組 inversion', '其實可以同時一起完成：combine 是 linear');
  await step(tok);                                   // 3567.8 配合從中間切 → n log n
  good('combine O(n) + 從正中央切 ⇒ O(n log n)', 0, 5.6);
  await me.hop(tok);
  say('配合每次從正中央切', 'total complexity 就是 n log n');
}]);

// 60:09 Sort-and-Count
FRAG.push(['dcjiang-sort-count-code', 'Sort-and-Count 程式', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 3, 0]);
  const C = code(['Sort-and-Count(L)', '1  if p = q: return (0, L)', '2  m = ⌊(p + q)/2⌋：切成 A、B', '3  (rA, A) = Sort-and-Count(A)',
    '4  (rB, B) = Sort-and-Count(B)', '5  (r, L) = Merge-and-Count(A, B)', '6  return (rA + rB + r, L)'], -1.6, 5.8);
  const me = pal('', -6.4, 1.4, '#f4a56a', 0.7);
  const side = (t, i, cls = 'ptr alt') => tag(t, cls, 5.0, 5.8 - i * 0.56);
  await step(tok);                                   // 3608.8 跟 merge sort 非常類似
  C.hl(0);
  say('procedure 寫起來', '跟 merge sort 非常類似');
  await step(tok);                                   // 3621.8 還要 return inversion 數
  note('多 return 一個數：這段貢獻幾個 inversion', 0.4, 1.6);
  say('merge sort 只要 sorting', '這裡還要 return 這個區間貢獻多少個 inversion');
  await step(tok);                                   // 3648.8 中間切一刀；什麼時候不用做？
  me.mood('wow');
  say('一樣先在中間切一刀', '什麼時候完全不用考慮 inversion？');
  await step(tok);                                   // 3663.1 只有一首歌 → return
  C.hl(1); me.mood('calm');
  side('一首歌：沒有 inversion', 1);
  say('只有一首歌時：沒有別人可以比', '兩個 sequence 一模一樣 → p = q 直接 return');
  await step(tok);                                   // 3690.8 中間切一刀：floor
  C.hl(2);
  side('A = 1 5 4 8 10 2 ｜ B = 6 9 12 11 3 7', 2, 'idx');
  say('兩個以上：中間切一刀，取 floor', '取 ceiling 也沒關係');
  await step(tok);                                   // 3712.8 左半 p..m
  C.hl(3); side('rA = 5', 3);
  say('左半 p 到 m 交給 Sort-and-Count', '它會 report 左半有多少 inversion');
  await step(tok);                                   // 3723.8 右半 m+1..q
  C.hl(4); side('rB = 8', 4);
  say('右半 m+1 到 q 也 Sort-and-Count', '這邊是 recursive call');
  await step(tok);                                   // 3737.8 combine：merge + 跨組
  C.hl(5); side('r = 9', 5);
  say('最重要的 combine：', '兩個 sequence merge 起來，順便算跨組 inversion');
  await step(tok);                                   // 3753.8 total = 三部分
  C.hl(6); side('total = 5 + 8 + 9 = 22', 6, 'pkt');
  say('total = 前半自己的 + 後半自己的', '+ merge 時算的跨組 inversion');
  await step(tok);                                   // 3773.8 Merge-and-Count ≈ MERGE
  C.hl(5);
  bub('Merge-and-Count ≈ MERGE', 3.4, 2.4);
  say('比較難做的是 Merge-and-Count', '它跟 merge sort 的 MERGE 幾乎一模一樣');
  await step(tok);                                   // 3786.8 保證 n log n
  C.hl(-1);
  good('T(n) = 2T(n/2) + O(n) ⇒ O(n log n)', 0.4, 0.9);
  me.mood('happy'); await me.hop(tok);
  say('這樣就 guarantee n log n', '採用的就是 merge sort 的 template');
}]);

// closest pair helpers (top-down view on the floor; world = units × 0.2, y-up → −z)
const CPL = [[-16, 10], [-16, -2], [-4, 0], [-26, -16], [-10, 22], [-8, -20]];
const CPR = [[4, 0], [26, 8], [26, -13], [8, -24], [6, 22]];
const W2 = (p) => [p[0] * 0.2, -p[1] * 0.2];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function cpPoints(list, color) { return list.map((p) => { const [x, z] = W2(p); return cube(null, color, [0.36, 0.36, 0.36], x, 0.2, z); }); }
function cpSeg(a, b, color) { const [x1, z1] = W2(a), [x2, z2] = W2(b); return seg(V3(x1, 0.2, z1), V3(x2, 0.2, z2), color); }

// 63:23 the problem, distances, brute force
FRAG.push(['dcjiang-cp-intro', 'Closest pair：Euclidean 距離、暴力 n²', async (tok) => {
  fresh([0, 10, 6.5], [0, 0, 0.6]);
  const P = [[-5, -2], [-3.5, 2.5], [-2, -3.2], [-1, 0.8], [0.5, 3], [1.2, -1.5], [2.6, 1.0], [3.4, -3.4], [4.8, 2.2], [5.5, -0.6]];
  let M;
  const a = P[3], b = P[6];
  await step(tok);                                   // 3803.0 平面上撒很多點，找最近兩點
  M = P.map(([x, z]) => cube(null, '#4b9ee2', [0.36, 0.36, 0.36], x, 0.2, z, 1.5));
  say('平面上撒很多點', '找出最近的那兩個點');
  await step(tok);                                   // 3809.8 1975 年、幾何經典
  note('1975 年提出：幾何類經典題', 0, 0.8, -4.4);
  say('這個 algorithm 1975 年就被提出', '跟幾何有關的經典代表題');
  await step(tok);                                   // 3834.9 每個點有 (x, y)
  tag('(x, y)', 'ptr', P[8][0], 0.8, P[8][1] - 0.5);
  say('每個點都有 x、y 座標', '找出兩兩之間最近的兩個點');
  await step(tok);                                   // 3850.8 Euclidean distance
  glow(M[3], GOLD); glow(M[6], GOLD);
  const e = seg(V3(a[0], 0.2, a[1]), V3(b[0], 0.2, b[1]), '#d64545');
  say('什麼叫最近？先定義距離', '這裡用 Euclidean distance：直線距離');
  await step(tok);                                   // 3866.8 rectilinear / Manhattan
  const m1 = seg(V3(a[0], 0.2, a[1]), V3(b[0], 0.2, a[1]), '#1f3a6e'), m2 = seg(V3(b[0], 0.2, a[1]), V3(b[0], 0.2, b[1]), '#1f3a6e');
  const mt = tag('|Δx| + |Δy|', 'ptr', b[0] + 0.9, 0.9, a[1] + 0.3);
  say('另一種是直角距離：x 差 + y 差', 'rectilinear（Manhattan）distance');
  await step(tok);                                   // 3886.8 IC design 繞線
  note('Manhattan：IC design 繞線用', b[0] + 0.9, 0.9, a[1] + 1.0);
  say('那種距離多用在 IC design 的繞線', '一般平面幾何就畫兩點之間的直線');
  await step(tok);                                   // 3898.8 Euclidean 公式
  [m1, m2, mt].forEach(kill);
  tag('d = √((x₁−x₂)² + (y₁−y₂)²)', 'pkt', (a[0] + b[0]) / 2, 0.9, (a[1] + b[1]) / 2 - 0.5);
  say('直線距離：x 差的平方加 y 差的平方', '再開根號');
  await step(tok);                                   // 3926.8 不聰明直接算會多糟？
  kill(e); glow(M[3], null); glow(M[6], null);
  bub('不聰明、直接算，會多糟？', 0, 0.9, 4.4);
  say('一開始沒什麼想法', '先看看不聰明地直接算會多糟');
  await step(tok);                                   // 3950.8 所有 pair 都算 → n²
  const ct = tag('0 對', 'pkt', 0, 1.2, -4.4), segs = []; let c = 0, best = [0, 1, Infinity];
  for (let i = 0; i < P.length; i++) {
    for (let j = i + 1; j < P.length; j++) { segs.push(seg(V3(P[i][0], 0.15, P[i][1]), V3(P[j][0], 0.15, P[j][1]), '#a99470')); c++; const d = Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]); if (d < best[2]) best = [i, j, d]; }
    txt(ct, c + ' 對'); await beat(tok, 220);
  }
  say('Brute force：所有可能的 pair 都算距離', 'n(n−1)/2 對 → O(n²)');
  await step(tok);                                   // 3968.1 用 D&C 降到 n log n
  segs.forEach(kill);
  glow(M[best[0]], RED); glow(M[best[1]], RED);
  seg(V3(P[best[0]][0], 0.2, P[best[0]][1]), V3(P[best[1]][0], 0.2, P[best[1]][1]), '#d64545');
  say('我們希望用 divide and conquer', '再降一個 order：n log n');
}]);

// 66:25 1D
FRAG.push(['dcjiang-cp-1d', '1D：排序後只看相鄰', async (tok) => {
  fresh([0, 3.2, 11.5], [0, 1.4, 0]);
  const V = [10, 1, 14, 5, 12, 0, 7], px = (v) => -5.6 + v * 0.8;
  let R, S;
  await step(tok);                                   // 3984.8 簡單版：1D
  pkt('簡單版：1D', 0, 5.0);
  say('介紹 2D 平面之前', '先看簡單版本：1D');
  await step(tok);                                   // 3992.9 都落在一條軸上
  line(-6.2, 0.2, 6.2, 0.2, 0, '#6e5f49');
  for (let v = 0; v <= 14; v += 2) tag(String(v), 'idx', px(v), -0.3);
  R = jRow(V, { dx: 1.1, y: 3.6, sz: 0.65, drop: true });
  say('點不在平面上', '都落在某一條軸上');
  await step(tok);                                   // 4006.8 先由小排到大
  for (let i = 0; i < V.length; i++) move(R.m[i], px(V[i]), 0.55, 0);
  S = V.map((v, i) => [v, R.m[i]]).sort((a, b) => a[0] - b[0]);
  say('先把軸上所有點由小排到大', '從左掃到右');
  await step(tok);                                   // 4012.8 最近的點在左邊或右邊
  glow(S[3][1], GOLD); glow(S[2][1], BLUE); glow(S[4][1], BLUE);
  say('一個點最近的點', '一定在它的左側或右側');
  await step(tok);                                   // 4027.8 只算連續兩點
  [2, 3, 4].forEach((k) => glow(S[k][1], null));
  let best = Infinity, bi = 0;
  for (let i = 0; i + 1 < S.length; i++) {
    const d = S[i + 1][0] - S[i][0];
    tag(String(d), 'ptr alt', (px(S[i][0]) + px(S[i + 1][0])) / 2, 1.5);
    if (d < best) { best = d; bi = i; }
    await beat(tok, 260);
  }
  glow(S[bi][1], RED); glow(S[bi + 1][1], RED);
  say('右邊的右邊一定更遠，不用算', '只算連續兩點的距離，就比得出最近的兩點');
  await step(tok);                                   // 4041.8 掃一次 O(n)
  good('掃一次：O(n)', 3.0, 4.4);
  say('1D 很簡單：掃過一次就算完', 'O(n)');
  await step(tok);                                   // 4048.8 但先排序要 n log n
  bad('先排序：O(n log n)', -2.6, 4.4);
  say('但做之前要先排序：n log n', '排序的時間反而比較久');
}]);

// 67:43 2D divide: 12, 21, 8
FRAG.push(['dcjiang-cp-split', '2D：切兩半，12、21、8 取最小', async (tok) => {
  fresh([0, 10.5, 5], [0, 0, 0.4]);
  let Lm, Rm;
  const xs = W2([-4, 0])[0];
  await step(tok);                                   // 4062.8 2D 沒這麼簡單
  Lm = cpPoints(CPL, '#4b9ee2'); Rm = cpPoints(CPR, '#4b9ee2');
  say('2D 就不能只排在一條軸上', '再連續比較一下就好');
  await step(tok);                                   // 4078.8 D&C；先給一個假設
  say('一樣用 divide and conquer', '做之前先給一個簡單的假設');
  await step(tok);                                   // 4109.8 x 座標都不一樣
  note('假設：所有點的 x 座標都不一樣', 0, 0.8, -5.4);
  say('假設所有點的 x 座標都不一樣', '方便分析；之後小修正就能去掉');
  await step(tok);                                   // 4131.8 跟 merge sort template 一樣：一刀兩段
  bar(xs, -5.4, xs, 5.4, '#6e5f49', 0.07);
  tag('L', 'ptr', xs, 0.8, -4.8);
  say('跟 merge sort 的 template 很像', 'divide 是一刀兩段');
  await step(tok);                                   // 4151.8 左右各 n/2
  Rm.forEach((m) => tint(m, '#2fc092'));
  tag('n/2 個', 'idx', -3.6, 0.6, 4.8); tag('n/2 個', 'idx', 3.6, 0.6, 4.8);
  say('N 個點：切成左半邊、右半邊', '線的兩側各有 n/2 個點');
  await step(tok);                                   // 4179.8 奇數：線穿過點；偶數：取上下 median
  glow(Lm[2], GOLD);
  say('奇數個點：這條線會穿過一個點', '偶數個：取 low median 或 upper median 都可以');
  await step(tok);                                   // 4203.8 算不出全部 → 先看左右各自
  glow(Lm[2], null);
  say('整體最近的兩點算不出來', '先切一半：看左半最近、右半最近');
  await step(tok);                                   // 4219.8 12 與 21
  [0, 1].forEach((i) => glow(Lm[i], GOLD)); cpSeg(CPL[0], CPL[1], '#c08a1f');
  { const [a1, b1] = W2([-16, 4]); tag('12', 'pkt', a1 - 0.5, 0.8, b1); }
  [1, 2].forEach((i) => glow(Rm[i], GOLD)); cpSeg(CPR[1], CPR[2], '#c08a1f');
  { const [a2, b2] = W2([26, -2.5]); tag('21', 'pkt', a2 + 0.5, 0.8, b2); }
  say('示意圖：左半最近兩點距離 12', '右半最近兩點距離 21');
  await step(tok);                                   // 4225.8 線的兩側也可能
  bub('跨過中線的呢？', xs, 0.8, 3.2);
  say('這還不是答案', '線的兩側也有機會產生最近的點');
  await step(tok);                                   // 4253.8 距離 8
  glow(Lm[2], RED); glow(Rm[0], RED); cpSeg(CPL[2], CPR[0], '#d64545');
  tag('8', 'pkt', 0, 0.8, 0.6);
  say('橫越中間 boundary 的部分', '假設找出一對距離 8 的點');
  await step(tok);                                   // 4262.8 12、21、8 → 8
  good('min(12, 21, 8) = 8', 0, 0.8, -3.6);
  say('12、21、8 誰最近？', '這個例子是距離 8 的這兩個點');
  await step(tok);                                   // 4279.0 D&C 三步
  say('簡單的 D&C：先把點分成兩塊', 'conquer：recursively 找左右最近的兩點');
  await step(tok);                                   // 4307.9 combine：結合處 + 三對比較
  say('combine：找出結合處貢獻的最近兩點', '三對比較，最近的那對就是答案');
}]);

// 72:01 strip of width 2δ
FRAG.push(['dcjiang-cp-strip', 'Combine：只看中線左右 δ 的帶子', async (tok) => {
  fresh([0, 10.5, 5], [0, 0, 0.4]);
  const Lm = cpPoints(CPL, '#4b9ee2'), Rm = cpPoints(CPR, '#2fc092');
  const xs = W2([-4, 0])[0], d = 12 * 0.2;
  bar(xs, -5.4, xs, 5.4, '#6e5f49', 0.07);
  const me = pal('', 5.6, 3.6, '#f4a56a', 0.7);
  let xl, dl;
  await step(tok);                                   // 4320.8 最困難的還是 combine
  me.mood('sad');
  say('接下來看怎麼做', '一樣最困難的是 combine');
  await step(tok);                                   // 4337.8 暴力 n²；combine 要 linear
  bad('暴力：n²', -4.4, 0.8, -4.6);
  me.mood('calm');
  say('暴力算是 n²', 'combine 一定要做到 linear time，才保證 n log n');
  await step(tok);                                   // 4349.8 不然不如暴力
  note('combine 做不到 O(n)？那就別 D&C', -1.6, 0.8, -4.0);
  say('combine 做不到 O(n) 的話', '就不要 D&C，不如直接暴力算');
  await step(tok);                                   // 4380.8 結合處：一點在左、一點在右
  glow(Lm[2], GOLD); glow(Rm[0], GOLD);
  say('結合處的最近一對', '一定是一個點在左側、另一個在右側');
  await step(tok);                                   // 4393.8 同側的早就找過
  cpSeg(CPL[0], CPL[1], '#c08a1f'); cpSeg(CPR[1], CPR[2], '#c08a1f');
  say('兩點都在同一側？', '純粹找那一側時就已經 identify 出來了');
  await step(tok);                                   // 4431.8 中線：左半最後一個點的 x → x*
  xl = tag('L：x = x*', 'ptr', xs, 0.8, -5.0);
  say('中線怎麼取？左側剛好 n/2 個點的最後一個點', '它的 x 座標叫 x*：L 就是 x = x*');
  await step(tok);                                   // 4472.8 範圍：左右最近距離取小
  say('結合處要考慮多寬？', '取左側最近、右側最近兩個距離中比較小的');
  await step(tok);                                   // 4479.8 12 < 21 → 開 12
  note('12 < 21 → 左右各開 12', -4.2, 0.8, 4.2);
  say('12 比 21 小', '只要往左右各開出 12 的距離');
  await step(tok);                                   // 4503.8 叫它 δ
  dl = tag('δ = min(12, 21) = 12', 'pkt', 3.6, 0.8, -4.6);
  say('這個 12 叫 δ', 'δ = 左側最近、右側最近兩者較小的距離');
  await step(tok);                                   // 4517.8 黃色帶子
  const g = ghostBox('#e5c23a', 2 * d, 0.3, 10.8); g.position.set(xs, 0.12, 0);
  tag('x* − δ', 'idx', xs - d, 0.6, 5.3); tag('x* + δ', 'idx', xs + d, 0.6, 5.3);
  CPL.forEach((p, i) => { if (Math.abs(p[0] + 4) > 12) tint(Lm[i], DIM); });
  CPR.forEach((p, i) => { if (Math.abs(p[0] + 4) > 12) tint(Rm[i], DIM); });
  say('真正要考慮的：這條黃色帶子', 'L 左右各開 δ；只看帶子裡一左一右的點');
  await step(tok);                                   // 4559.8 命名 Q、R、q0 q1、r0 r1
  tag('Q（左側）', 'idx', -4.6, 0.6, -2.6); tag('R（右側）', 'idx', 4.6, 0.6, -2.6);
  say('為什麼這樣就夠？做一點小數學', '左側叫 Q、右側叫 R；最近的是 q₀q₁、r₀r₁');
  await step(tok);                                   // 4619.8 q 在左、r 在右
  tag('q', 'pkt', W2(CPL[2])[0] - 0.4, 0.8, 0.5); tag('r', 'pkt', W2(CPR[0])[0] + 0.4, 0.8, 0.5);
  say('考慮一點在左、一點在右的那一對', '左邊叫 q (q_x, q_y)、右邊叫 r (r_x, r_y)');
  await step(tok);                                   // 4638.9 q_x ≤ x* ≤ r_x
  note('q_x ≤ x* ≤ r_x', 0, 0.8, 2.4);
  say('q 在左、r 在右：中線一定在它們之間', 'q_x ≤ x* ≤ r_x');
  await step(tok);                                   // 4709.8 x* − q_x ≤ r_x − q_x
  note('x* − q_x ≤ r_x − q_x', 0, 0.8, 3.1);
  say('右邊的不等式兩邊都減掉 q_x', 'x* − q_x ≤ r_x − q_x');
  await step(tok);                                   // 4753.8 ≤ d(q, r) < δ
  note('r_x − q_x ≤ d(q, r) < δ', 0, 0.8, 3.8);
  me.mood('wow');
  say('r_x − q_x 只算 x 的差，比直線距離小', '而我們要找的 d(q, r) < δ');
  await step(tok);                                   // 4778.8 另一邊同理
  note('r_x − x* < δ（同理）', 0, 0.8, 4.5);
  say('r 那一側做類似的推導', 'r_x − x* 也 < δ');
  await step(tok);                                   // 4803.8 帶子左右各開 δ 就夠
  me.mood('happy'); await me.hop(tok);
  say('所以帶子只要往左右各開 δ', '就夠了：要考慮的點都在黃色帶子上');
}]);

// 80:29 δ/2 boxes, 15 neighbours
FRAG.push(['dcjiang-cp-boxes', 'δ/2 小格子：每點只比後面 15 個', async (tok) => {
  fresh([0, 10.5, 5.5], [0, 0, 0.6]);
  const s = 1.2, z0 = -3.0;                         // δ = 2.4, box = δ/2
  const strip = ghostBox('#e5c23a', 4.8, 0.2, 9.0); strip.position.set(0, 0.1, z0 + 3.4);
  bar(0, z0 - 1.2, 0, z0 + 7.8, '#6e5f49', 0.08);
  tag('L', 'pkt', 0, 0.8, z0 - 1.5);
  const pts = [[-2.0, z0 + 0.3], [0.5, z0 + 0.9], [-0.6, z0 + 1.7], [1.9, z0 + 2.6], [-1.6, z0 + 3.1], [0.7, z0 + 4.1], [-0.9, z0 + 5.6]];
  const me = pal('', 4.6, 2.6, '#f4a56a', 0.75);
  let M = [], fake, fs;
  await step(tok);                                   // 4828.8 帶子裡也可能很多點
  M = pts.map(([x, z]) => cube(null, x < 0 ? '#4b9ee2' : '#2fc092', [0.32, 0.32, 0.32], x, 0.2, z, 1.2));
  me.mood('wow');
  say('這樣還不夠', '黃色帶子裡也可能有很多點');
  await step(tok);                                   // 4855.8 依 y 由上到下排、編號
  pts.forEach(([x, z], i) => tag(String(i + 1), 'idx', x + 0.3, 0.6, z));
  say('帶子裡的點依 y 座標排列', '由上到下編號 1、2、3、4、5、6……');
  await step(tok);                                   // 4877.8 每點只往下比 15 個
  glow(M[0], GOLD); me.mood('calm');
  pkt('每點只往下比 15 個', 3.6, 0.8, -1.4);
  say('等一下會算出一個 loose bound', '每個點只要往下比 15 個點');
  await step(tok);                                   // 4920.8 距離超過 δ 就不用算
  say('跟其他人距離超過 δ 就不用算了', '左右兩側最近已經是 δ，我們只找更小的');
  await step(tok);                                   // 4965.8 分成小格子
  for (let c = 0; c <= 4; c++) bar(-2.4 + c * s, z0, -2.4 + c * s, z0 + 4 * s, c === 2 ? '#6e5f49' : '#a99470', c === 2 ? 0.08 : 0.04);
  for (let r = 0; r <= 4; r++) bar(-2.4, z0 + r * s, 2.4, z0 + r * s, '#a99470', 0.04);
  say('把帶子分成一些小格子', '左右各 δ，中間再畫出 δ/2 的線');
  await step(tok);                                   // 4985.8 每格 δ/2 × δ/2 的 square
  tag('δ/2', 'idx', -1.8, 0.5, z0 - 0.4); tag('δ/2', 'idx', -2.8, 0.5, z0 + 0.6);
  say('每一格都是 square', '大小 δ/2 × δ/2');
  await step(tok);                                   // 5001.8 每格最多一個點
  good('每格最多一個點', 3.6, 0.8, 4.2);
  say('claim：每個小格子裡', '最多只會有一個點');
  await step(tok);                                   // 5032.8 s、s′：不同格、15 格內
  glow(M[0], null);
  tag('s', 'pkt', pts[1][0] + 0.4, 0.8, pts[1][1]); tag('s′', 'pkt', pts[3][0] + 0.4, 0.8, pts[3][1]);
  say('要找的那對叫 s、s′', '① 一定在不同格子 ② 不會超過 15 個格子');
  await step(tok);                                   // 5065.8 反證：同一格 → 同側
  fake = cube(null, '#d64545', [0.32, 0.32, 0.32], -1.4, 0.2, z0 + 0.9, 1.2);
  fs = seg(V3(pts[0][0], 0.2, pts[0][1]), V3(-1.4, 0.2, z0 + 0.9), '#d64545');
  me.mood('wow');
  say('反證法：假設兩點落在同一格', '格子不跨中線 → 兩點同屬左側（或右側）');
  await step(tok);                                   // 5104.8 ≤ δ/√2 < δ：矛盾
  bad('對角線 ≤ δ/√2 < δ：矛盾！', -1.2, 0.8, z0 - 1.0);
  say('距離最多是對角線 δ/√2，比 δ 還小', '但同側最近就是 δ → contradiction');
  await step(tok);                                   // 5163.2 左上角：只看後面 15 格
  kill(fs); fly(fake, V3(-3, 6, -2)); me.mood('calm');
  glow(M[0], GOLD);
  for (let k = 1; k < 16; k++) { const r = Math.floor(k / 4), c = k % 4; const g = ghostBox('#c08a1f', s * 0.94, 0.2, s * 0.94); g.position.set(-2.4 + (c + 0.5) * s, 0.12, z0 + (r + 0.5) * s); await beat(tok, 80); }
  say('畫了 16 個格子：一個點落在左上角', '真正要考慮的就是剩下的 15 格');
  await step(tok);                                   // 5176.8 反證：超出 16 格
  glow(M[6], RED);
  const f2 = seg(V3(pts[0][0], 0.2, pts[0][1]), V3(pts[6][0], 0.2, pts[6][1]), '#9b7ef4');
  say('再用反證法：假設要找的超出這 16 格', '那它一定落在更下面的格子');
  await step(tok);                                   // 5256.0 y 差 ≥ 3δ/2 > δ
  note('y 差 ≥ 3 · δ/2 > δ', -3.6, 0.8, z0 + 4.5);
  say('垂直至少隔三個 δ/2', 'y 差超過 3δ/2，已經超過 δ → 不用考慮');
  await step(tok);                                   // 5308.8 loose bound；別本書更少
  note('15：loose bound（別本書更少）', 3.0, 0.8, z0 + 5.6);
  say('這是 loose bound', '別本書會說找更少的點就行了');
  await step(tok);                                   // 5315.8 仍是常數
  me.mood('happy'); await me.hop(tok);
  good('15 是常數 → 每點比 15 次', 3.0, 0.8, z0 + 6.4);
  say('不管怎樣，15 還是 constant', '帶子裡每個點只要往後看 15 個點');
}]);

// 88:50 the procedure and its running time
FRAG.push(['dcjiang-cp-code', 'Closest-Pair 程式與 O(n log n)', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.6, 0]);
  const C = code(['Closest-Pair(P)', '   Px, Py = 依 x、依 y 排序', '   (p0, p1) = CP-Rec(Px, Py)', 'CP-Rec(Px, Py)', ' 1  if |P| ≤ 3：兩兩比', ' 2  x* = 中位數；分成 Q、R',
    ' 3  得到 Qx, Qy, Rx, Ry', ' 4  (q0, q1) = CP-Rec(Qx, Qy)', ' 5  (r0, r1) = CP-Rec(Rx, Ry)', ' 6  δ = min(d(q0,q1), d(r0,r1))', ' 7  S = 離 x* 不超過 δ 的點',
    ' 8  Sy = S 依 y 排序', ' 9-11  每點比後面 15 個 → (s,s′)', '12-14  三對取最近的 return'], -1.6, 7.0, 0.5);
  const cost = (t, i) => tag(t, 'ptr alt', 5.6, 7.0 - i * 0.5);
  const me = pal('', -6.4, 1.6, '#f4a56a', 0.7);
  let tf;
  await step(tok);                                   // 5329.8 看起來很多行，分區塊看
  me.mood('wow');
  say('整個 procedure 寫起來看起來很多行', '分成幾個區塊來看就不複雜');
  await step(tok);                                   // 5358.8 Px、Py
  C.hl(1); me.mood('calm');
  say('外層：input 的所有點 P', '依 x 排成 Px、依 y（上到下）排成 Py');
  await step(tok);                                   // 5392.8 遞迴算出 p0、p1
  C.hl(2);
  say('丟進 recursive code', '它幫我們算出最近的兩點 p₀、p₁');
  await step(tok);                                   // 5421.8 第 1 行：≤ 3 點直接比
  C.hl(4); cost('O(1)', 4);
  say('第 1 行：boundary condition', '3 個點以下直接兩兩比，最多比 3 次');
  await step(tok);                                   // 5462.8 第 2 行：均分、找 x*
  C.hl(5);
  say('第 2 行起：正式的 divide and conquer', '把點均勻切成左右兩半，identify 出 x*');
  await step(tok);                                   // 5476.8 Q、R 四個 sequence
  C.hl(6);
  say('左半叫 Q、右半叫 R', '依 x、y 產生 Qx、Qy、Rx、Ry 四個 sequence');
  await step(tok);                                   // 5492.8 左半 recursive
  C.hl(7); cost('T(n/2)', 7);
  say('左半丟給 recursive code', '算出左半最近的兩點');
  await step(tok);                                   // 5499.8 右半 recursive
  C.hl(8); cost('T(n/2)', 8);
  say('右半也丟進去', '算出右半最近的兩點');
  await step(tok);                                   // 5519.4 第 6 行 δ
  C.hl(9);
  say('6、7、8 行是 combine 的準備', '第 6 行：左右最近距離取比較小的 → δ');
  await step(tok);                                   // 5532.8 第 7 行：黃色帶子 S
  C.hl(10); cost('O(n)', 10);
  say('第 7 行：把黃色帶子開出來', 'x 落在 x* ± δ 之內的點收進 S');
  await step(tok);                                   // 5577.8 第 8 行：依 y 排
  C.hl(11); cost('O(n)', 11);
  say('每點往後看 15 個的先決條件', '第 8 行：S 依 y 從上到下排好');
  await step(tok);                                   // 5595.5 9–11 行：每點比後 15 個
  C.hl(12); cost('O(n)', 12);
  say('第 9–11 行：每個點輪流抓起來', '跟後面 15 個點比距離，找出 (s, s′)');
  await step(tok);                                   // 5633.8 12–14 行：三對比大小
  C.hl(13); cost('O(1)', 13);
  say('第 12–14 行：q 對、r 對、s 對', '三者比大小，output 最近的');
  await step(tok);                                   // 5667.8 預先排序 n log n
  C.hl(1); cost('O(n log n)', 1);
  say('complexity：先把所有點依 x 排序', '才能切出一半 → n log n');
  await step(tok);                                   // 5685.8 T(n) = 2T(n/2) + combine
  C.hl(-1);
  tf = tag('T(n) = 2T(n/2) + ?', 'pkt', 0.4, 0.2);
  say('下面是基本的 D&C', '整體 T(n)，左右各 T(n/2)，再加 combine');
  await step(tok);                                   // 5705.8 combine：15 是常數 → linear
  txt(tf, 'T(n) = 2T(n/2) + O(n)');
  say('combine：每點最多跟 15 個人比', '15 是 constant，最多 n 個點 → O(n)');
  await step(tok);                                   // 5756.8 總共 n log n
  good('排序 n log n + D&C n log n ⇒ O(n log n)', 0.4, -0.5);
  me.mood('happy'); await me.hop(tok);
  say('前面排序 n log n、後面 D&C 也是 n log n', 'closest pair 整體 O(n log n)');
}]);
  }

  // ═══ dcmit.js ═══
  {
// ─── MIT 6.006：Kg4bqzAqRBM（L3 Insertion Sort, Merge Sort）、4iXLnF3hExw（Rec3 Document Distance）、eCaXlAaN2uE（L11 Integer Arithmetic, Karatsuba） ───
// Cued scenes: every `await step(tok)` waits for the sentence it shows (cue time in the // @t comment).
// Numbers are little buddies that hop and react; motion between steps is short; nothing loops.
// 老師的例子：5 2 4 6 1 3、L′ = 2 7 13 20、R′ = 1 9 11 12、三種 f(n)、2.2 n lg n vs 0.01 n²；Rec3 the fox is in the hat、
// K 字 × Z 行、文件 3 4 6 8 9 / 2 3 6 7 8、兩串列 1…10,000；L11 λ、(α)β、C₂ = C₀C₁ + C₁C₀、x₀ = 1、Karatsuba、半兆半徑的大圓。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, anim, line, arrow, step, buddy, prop, bob, travel, remove, zone, GOLD, GREEN, RED, GRAY } = K;
const beat = ctx.beat;
const say = (a, b = '') => ctx.say(a, b);
const DB = '#4b9ee2', DP = '#9b7ef4', DG = '#2fc092', DO = '#dd8238', DY = '#c08a1f', DR = '#d64545', PAPER = '#efe3c8', MINT = '#d4e8da', SKY = '#7fb6e8', LILAC = '#c4b3f7', STU = '#f4a56a', TEA = '#e8cf8a';
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const ok = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const no = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const dBox = (t, x, y, z = 0, w = 2.6, c = PAPER, drop = 0) => cube(t, c, [w, 0.6, 0.8], x, y, z, drop);
// a number buddy standing on the floor
const nb = (v, x, z, c = DB, s = 0.8, name = '') => buddy(name, v, c, x, 0, z, s);
const bcol = (b, c) => b.body.material.color.set(c);
// slide an object (not a spring body) to a point
async function slide(tok, o, x, y, z, ms = 600) { const a = o.position.clone(), b = V3(x, y, z); await anim(tok, ms, (u) => o.position.lerpVectors(a, b, u)); }
// swap two objects along arcs (a jumps over, b ducks forward)
async function gswap(tok, a, b, ms = 500) {
  const pa = a.position.clone(), pb = b.position.clone();
  await anim(tok, ms, (t) => {
    a.position.set(pa.x + (pb.x - pa.x) * t, pa.y + Math.sin(Math.PI * t) * 0.9, pa.z);
    b.position.set(pb.x + (pa.x - pb.x) * t, pb.y, pb.z + Math.sin(Math.PI * t) * 0.8);
  });
}
// vertical bar (static cube scaled in y) and horizontal bar (scaled in x)
function dBar(color, x, z, w = 0.6) { const m = cube('', color, [w, 1, w], x, 0.001, z); m.scale.y = 0.002; return m; }
const dSetBar = (m, h) => { const v = Math.max(0.002, h); m.scale.y = v; m.position.y = v / 2; };
function hBar(color, x0, y, z = 0) { const m = cube('', color, [1, 0.32, 0.45], x0, y, z); m.scale.x = 0.002; m.userData.x0 = x0; return m; }
const hSet = (m, w) => { const v = Math.max(0.002, w); m.scale.x = v; m.position.x = m.userData.x0 + v / 2; };

// ═════════════ L3：Kg4bqzAqRBM ═════════════

// 01:29 為什麼排序：中位數 B[n/2]、binary search
FRAG.push(['dcmit-why-sort', '排好序後：中位數與 binary search', async (tok) => {
  fresh([0, 6.4, 12.5], [0, 1.2, 0]);
  const A = [5, 2, 4, 6, 1, 3], X = (i) => -3.25 + i * 1.3;
  await step(tok); // @89.7 phone book, MP3, spreadsheets
  const book = prop('file', -4.6, 0, -1.6, 1.3, '電話簿：照名字排好'); bob(book, 0.05);
  const n1 = note('MP3 清單', -1.4, 0.5, -1.6), n2 = note('試算表', 1.4, 0.5, -1.6);
  say('排好序，找東西就容易', '電話簿、MP3、試算表');
  await step(tok); // @114.3 problems that become easy once sorted
  const hint = bub('排好之後，有些問題就變簡單了', 0.4, 2.6, -1.6);
  say('有些問題，排好就變簡單', '例如：找中位數');
  await step(tok); // @143.6 A[0..n] unsorted
  kill(book); remove(n1); remove(n2); remove(hint);
  tag('A（沒排序）', 'ptr', -5.6, 0.5, -1.8);
  const bs = A.map((v, i) => nb(v, X(i), -1.8, DB, 0.75));
  say('A[0..n]：n 個數，還沒排序');
  await step(tok); // @164.6 sort into increasing B
  tag('B（排好）', 'ptr alt', -5.6, 0.5, 1.8);
  A.forEach((v, i) => move(bs[i].g, X(v - 1), 0, 1.8));
  A.forEach((_, i) => tag(String(i), 'idx', X(i), 0.02, 2.65));
  bs.forEach((b) => b.mood('happy'));
  say('排序：A 變成遞增的 B', 'B[0] ≤ B[1] ≤ … ≤ B[n−1]');
  await step(tok); // @181.0 comparison function
  const cmp = buddy('比較函數', '≤', TEA, 5.4, 0, -1.6, 0.8); cmp.mood('wow');
  say('元素是「記錄」時：要給一個比較函數', '想成 ≤：能分出誰小就能排');
  const byV = (v) => bs[A.indexOf(v)];
  await step(tok); // @276.4 median = B[n/2]
  byV(4).glow(GOLD);
  const med = note('B[n/2] = 4：中位數', X(3), 1.85, 1.8);
  await byV(4).hop(tok);
  say('中位數：直接看 B[n/2]', '左邊的都比它小、右邊的都比它大');
  await step(tok); // @306.1 constant time if sorted
  const c1 = ok('排好之後只要 Θ(1)', X(3), 2.55, 1.8);
  say('已經排好的話：常數時間');
  await step(tok); // @316.2 binary search: find a specific item
  remove(med); remove(c1); byV(4).glow(null); kill(cmp.g);
  const kT = pkt('要找 k = 2', 5.6, 1.2, 1.8);
  say('Binary search：在陣列裡找一個特定的 k');
  await step(tok); // @343.3 scanning = linear time
  const scan = pkt('一個一個看', X(0), 1.6, 1.8);
  await travel(tok, scan, V3(X(0), 1.6, 1.8), V3(X(5), 1.6, 1.8), 1500);
  say('直接從頭掃到尾：線性時間 Θ(n)');
  await step(tok); // @368.0 compare k with B[n/2]
  remove(scan);
  const mid = tag('mid', 'ptr alt', X(3), 1.55, 1.8); byV(4).glow(GOLD);
  say('排好的話：先拿 k 和 B[n/2] 比', 'B[3] = 4');
  await step(tok); // @383.5 only look at half
  [4, 5, 6].forEach((v) => bcol(byV(v), GRAY)); byV(4).glow(null);
  say('4 > 2：右半一定沒有 2', '只要看左半');
  await step(tok); // @394.0 left half, divide and conquer
  move(mid, X(1), 1.55, 1.8); byV(2).glow(GREEN); byV(2).mood('wow');
  await byV(2).hop(tok);
  say('左半再對半：B[1] = 2', '找到了！每次丟掉一半');
  await step(tok); // @415.6 linear search → logarithmic search
  ok('Θ(n) → Θ(log n)', 0.4, 3.0, 0);
  note('最簡單的 divide and conquer', 0.4, 2.3, 0);
  remove(kT);
  say('線性搜尋變成對數搜尋', '這招今天還會再出現');
}]);

// 07:22 沒那麼明顯的應用：壓縮（排序找重複）、繪圖（前→後 / 後→前）
FRAG.push(['dcmit-sort-apps', '排序的應用：壓縮與繪圖', async (tok) => {
  fresh([0, 6, 13], [0, 1.6, 0]);
  const items = ['a', 'c', 'a', 'b', 'a', 'c'], col = { a: DB, b: DO, c: DP }, X = (i) => -6.0 + i * 0.95;
  await step(tok); // @442.2 data compression
  const f = prop('file', -6.2, 0, -3.0, 0.9, '要壓縮的檔案'); bob(f, 0.05);
  const ms = items.map((v, i) => cube(v, col[v], [0.75, 0.6, 0.75], X(i), 0.3, -1.2, 2));
  say('資料壓縮：檔案是一堆 item');
  await step(tok); // @450.2 sort the items
  [0, 2, 4, 3, 1, 5].forEach((k, p) => move(ms[k], X(p), 0.3, -1.2));
  say('先把 item 排序');
  await step(tok); // @454.8 automatically finds duplicates
  [0, 2, 4].forEach((k) => glow(ms[k], GOLD)); [1, 5].forEach((k) => glow(ms[k], GOLD));
  note('重複的全排在一起', X(2.5), 1.3, -1.2);
  say('排好後，重複的 item 自動擠在一起');
  await step(tok); // @460.6 represent once + frequency
  ms.forEach((m) => glow(m, null));
  [['a × 3', DB, 1], ['b × 1', DO, 3], ['c × 2', DP, 4.5]].forEach(([t, c, p]) => cube(t, c, [1.3, 0.5, 0.8], X(p), 0.25, 1, 1.5));
  say('每種只存一次，再記出現次數', '100 個一樣的 → 存 1 個 + 「100」');
  await step(tok); // @470.8 similar to document distance
  note('就像 document distance 的 (字, 次數)', X(2.5), 1.0, 2.2);
  say('跟 document distance 一樣', '整本莎士比亞 → 一堆 (字, 次數)');
  await step(tok); // @502.9 computer graphics
  const L = [[DR, '不透明'], [DG, '第 2 層'], [DB, '第 3 層']];
  const ls = L.map(([c, t], q) => cube(t, c, [1.6, 1.4, 0.15], 3.6, 1.0, 1.4 - q * 1.4, 1.5));
  const eye = prop('monitor', 3.6, 0, 3.6, 0.7, '鏡頭（我們看的方向）');
  say('電腦繪圖也用排序', '畫面是一層一層的物件');
  await step(tok); // @518.8 front to back
  const rp = pkt('render', 5.2, 2.2, 1.4);
  for (let q = 0; q < 3; q++) { glow(ls[q], GOLD); move(rp, 5.2, 2.2, 1.4 - q * 1.4); await beat(tok, 500); glow(ls[q], null); }
  say('多數時候由前往後 render');
  await step(tok); // @528.6 occluded things need no work
  tint(ls[1], GRAY); tint(ls[2], GRAY);
  no('被擋住的：不用畫', 3.6, 2.4, -1.4);
  say('前面不透明的大物件先畫', '後面被擋住的就省了');
  await step(tok); // @540.9 transparency: back to front
  tint(ls[1], DG); tint(ls[2], DB);
  for (let q = 2; q >= 0; q--) { glow(ls[q], GOLD); move(rp, 5.2, 2.2, 1.4 - q * 1.4); await beat(tok, 500); glow(ls[q], null); }
  say('有透明物件時要由後往前');
  await step(tok); // @545.4 keep both orders
  note('前→後、後→前：兩種排序都要維護', 3.4, 3.2, 0);
  say('兩種順序的排序串列都要維護');
  await step(tok); // @573.9 all sorts of sorts
  ['cocktail sort', 'bitonic sort', '…還有很多'].forEach((t, i) => bub(t, -4.6 + i * 2.2, 3.4, 0));
  say('排序演算法百百種', '各自在某些輸入上會贏');
  await step(tok); // @612.8 insertion sort: analyze complexity
  ok('第一個：insertion sort → 算它跑多快', -2.4, 4.3, 0);
  say('先看 insertion sort', '講它是為了練習算複雜度');
}]);

// 10:30 Insertion sort：5 2 4 6 1 3，pairwise swaps
FRAG.push(['dcmit-insertion-524613', 'Insertion sort：5 2 4 6 1 3', async (tok) => {
  fresh([0, 5.8, 11.5], [0, 1.0, 0]);
  const a = [5, 2, 4, 6, 1, 3], X = (i) => -3.25 + i * 1.3;
  await step(tok); // @630.4 for i = 1..n
  const cd = code(['for i = 1 … n−1:', '  把 A[i] 插到正確位置', '  （用相鄰兩兩交換往左移）'], -0.2, 4.5, 0.5, -1.2);
  cd.hl(0);
  say('Insertion sort：i 從 1 跑到 n − 1');
  await step(tok); // @641.5 insert A[i] in the right position
  cd.hl(1);
  say('每一輪：把 A[i] 插到正確的位置');
  await step(tok); // @652.0 A[0..i-1] already sorted
  const zs = zone('A[0..i−1]：已經排好', -1.95, 0, 0, 5.0, 1.6, MINT);
  const zi = pkt('A[i]', X(4), 1.2, 0);
  say('假設做到一半：A[0..i−1] 已經排好', '再多吸收一個 A[i]');
  await step(tok); // @672.5 pairwise swaps down to the right position
  cd.hl(2);
  const ar = arrow(V3(X(4), 0.6, 0.9), V3(X(2), 0.6, 0.9), 0xa8730f);
  say('做法：跟左邊鄰居兩兩交換', '一路換到對的位置');
  await step(tok); // @704.5 example 5 2 4 6 1 3
  remove(zs); remove(zi); kill(ar); cd.hl(-1);
  const ms = a.map((v, i) => nb(v, X(i), 0, DB, 0.8));
  a.forEach((_, i) => tag(String(i), 'idx', X(i), 0.02, 0.95));
  const cnt = note('交換 0 次', 5.3, 2.2, 0);
  say('例子：5 2 4 6 1 3', '排成遞增');
  let sw = 0;
  const key = pkt('key', X(1), 1.55, 0);
  const swapTo = async (j, ms0 = 500) => { await gswap(tok, ms[j].g, ms[j - 1].g, ms0); [ms[j - 1], ms[j]] = [ms[j], ms[j - 1]]; [a[j - 1], a[j]] = [a[j], a[j - 1]]; sw++; txt(cnt, '交換 ' + sw + ' 次'); };
  showKey(1);
  function showKey(i) { move(key, X(i), 1.55, 0); ms.forEach((m, k) => m.glow(k === i ? GOLD : null)); }
  await step(tok); // @727.6 the key
  ms[0].mood('happy');
  say('key 從第二格開始', '第一格自己一個，本來就算排好');
  await step(tok); // @754.8 5 > 2: swap
  ms[1].mood('wow'); await swapTo(1);
  say('2 < 5：交換一次', a.join(' '));
  await step(tok); // @777.0 key at 4
  showKey(2);
  say('key 移到 4');
  await step(tok); // @783.0 one swap → 2 4 5
  await swapTo(2); ms[1].mood('happy');
  say('4 < 5：換一次就好', a.join(' '));
  await step(tok); // @807.6 key at 6
  showKey(3);
  say('key 移到 6');
  await step(tok); // @823.0 6 > 5, nothing
  ms[3].mood('happy'); await ms[3].hop(tok);
  say('6 > 5：不用換', '前面已排好，直接往右');
  await step(tok); // @842.1 key at 1
  showKey(4); ms[4].mood('wow');
  say('key 移到 1：這次要做很多事');
  await step(tok); // @867.5 four swaps
  for (let j = 4; j > 0; j--) await swapTo(j, 440);
  say('1 一路換到最前面', a.join(' '));
  await step(tok); // @903.5 four swaps, no getting away
  const four = note('4 次：搬 1 到定位，逃不掉', X(1.5), 2.5, 0);
  ms[0].mood('happy');
  say('換了 4 次', '就算改成「整段右移」也是 4 個操作');
  await step(tok); // @936.5 key at 3
  remove(four); showKey(5);
  say('最後：key 移到 3');
  await step(tok); // @958.1 swap with 6, 5, 4
  for (let j = 5; j > 2; j--) await swapTo(j, 500);
  say('3 和 6、5、4 各換一次', a.join(' '));
  await step(tok); // @969.5 3 > 2: done
  ms.forEach((m) => { m.glow(null); bcol(m, DG); m.mood('happy'); });
  kill(key);
  await ms[2].hop(tok);
  say('3 > 2：停下，排好了！', '共 1 + 1 + 0 + 4 + 3 = 9 次交換');
}]);

// 16:46 分析：Θ(n) 個 key 位置 × 每步 Θ(n) → Θ(n²)
FRAG.push(['dcmit-insertion-cost', 'Insertion sort 的成本 Θ(n²)', async (tok) => {
  fresh([0, 5.8, 12.5], [0, 2.0, 0]);
  const a = [6, 5, 4, 3, 2, 1], X = (i) => -5.6 + i * 0.85;
  await step(tok); // @1006.3 theta n steps (key positions)
  a.forEach((v, i) => cube(v, DB, [0.7, 0.6, 0.7], X(i), 0.3, -2));
  const kp = pkt('key', X(1), 1.2, -2);
  for (let i = 1; i < 6; i++) { move(kp, X(i), 1.2, -2); await beat(tok, 300); }
  note('key 走過 n − 1 格 = Θ(n) 步', X(2.5), 2.0, -2);
  say('一步 = key 往右移一格', '共 n − 1 步 → Θ(n) 步');
  await step(tok); // @1030.0 each step may be theta n work
  bub('每一步要做多少工？', 2.6, 4.6, 0);
  say('答案是 n²：因為每一步可能要 Θ(n) 的工作');
  await step(tok); // @1039.5 example: four swaps
  for (let k = 0; k < 4; k++) cube('', DO, [0.7, 0.42, 0.7], -0.9, 0.21 + k * 0.45, 0.6, 1.2);
  note('剛才的 1：換 4 次', -0.9, 2.3, 0.6);
  say('像剛才的 1：一步就換了 4 次');
  await step(tok); // @1051.1 reverse sorted: n/2 swaps on average
  const tot = tag('累計 4', 'ptr alt', 4.4, 4.6, 0);
  let s = 4;
  for (let i = 1; i < 6; i++) {
    if (i === 4) continue;
    for (let k = 0; k < i; k++) cube('', DO, [0.7, 0.42, 0.7], -0.9 + (i - 4) * 1.05, 0.21 + k * 0.45, 0.6, 1.2);
    s += i; txt(tot, '累計 ' + s); await beat(tok, 350);
  }
  for (let i = 1; i < 6; i++) tag('i=' + i, 'idx', -0.9 + (i - 4) * 1.05, 0.02, 1.4);
  say('反序輸入：key 在第 i 格就要換 i 次', '平均每步約 n/2 次');
  await step(tok); // @1065.1 each step theta n swaps (and compares)
  note('每步：Θ(n) 次比較 ＋ 交換', 2.6, 3.4, 0.6);
  say('所以每一步是 Θ(n) 次交換', '也是 Θ(n) 次比較');
  await step(tok); // @1093.3 theta n^2
  ok('1 + 2 + … + (n−1) = n(n−1)/2 = Θ(n²)', 0.6, 5.4, 0);
  say('Θ(n) 步 × 每步 Θ(n) = Θ(n²)');
  await step(tok); // @1110.4 what am I counting? compare + swap
  const c1 = dBox('compare 比較', -4.6, 4.4, 0, 2.2, MINT, 1), c2 = dBox('swap 交換', -2.2, 4.4, 0, 2.2, MINT, 1);
  say('在數什麼？一次比較、一次交換', '先假設兩個一樣貴');
  await step(tok); // @1121.6 x86 / MIPS single instruction
  const cpu = prop('cpu', -3.4, 2.4, 0, 0.8, 'x86、MIPS：各一個指令');
  say('對數字來說確實一樣貴', '比較、交換都是一個機器指令');
  await step(tok); // @1138.0 comparing records may be a method call
  kill(cpu); tint(c1, DR); glow(c1, RED);
  const bigC = note('比較記錄 = 呼叫一個函數 → 很貴', -4.6, 5.2, 0);
  say('排的是記錄時：比較可能是一個函數呼叫');
  await step(tok); // @1150.4 swap just pointers
  glow(c2, GREEN); note('交換只換指標 → 便宜', -2.2, 3.6, 0.5);
  remove(bigC);
  say('交換只是換兩個指標', '這時比較比交換貴得多');
  await step(tok); // @1166.6 we will count comparisons
  bub('之後多半「數比較次數」', -3.4, 6.0, 0);
  say('之後排序演算法多半數比較次數');
  await step(tok); // @1193.6 theta n^2 compares and swaps
  ok('Insertion sort：Θ(n²) 次比較、Θ(n²) 次交換', 0.6, 6.4, 0);
  say('不論哪種情況：insertion sort 都是 Θ(n²)');
}]);

// 20:00 Binary insertion sort：比較 Θ(n log n)，搬移仍 Θ(n²)
FRAG.push(['dcmit-binary-insertion', 'Binary insertion sort', async (tok) => {
  fresh([0, 5.8, 11.5], [0, 1.2, 0]);
  const X = (i) => -3.6 + i * 1.3;
  const a = [2, 4, 5, 6, 1, 3];
  await step(tok); // @1199.5 compares more expensive than swaps?
  const ms = a.map((v, i) => nb(v, X(i), 0, i < 4 ? DG : DB, 0.8));
  const cc = note('比較 0 次', -5.6, 3.0, 0), sc = note('搬移 0 次', 4.6, 3.0, 0);
  bub('如果「比較」比「交換」貴很多…', 0, 4.4, 0);
  say('假設比較比交換貴', '擔心的是 Θ(n²) 次比較');
  await step(tok); // @1228.0 simple fix?
  const stu = buddy('同學', '?', STU, 5.6, 0, 1.8, 0.7); stu.mood('wow');
  say('有什麼簡單的改法，讓比較次數變少？');
  await step(tok); // @1265.3 binary search
  stu.set('binary search！'); stu.mood('happy'); await stu.hop(tok);
  say('答案：binary search');
  await step(tok); // @1281.0 theta n log n compares
  ok('比較：Θ(n log n)', 0, 5.2, 0);
  say('insertion sort 一改就變 Θ(n log n) 次比較');
  await step(tok); // @1302.0 A[0..i-1] already sorted
  const zs = zone('A[0..i−1] 已排好', X(1.5), 0, 0, 5.4, 1.6, MINT);
  ms[4].glow(GOLD);
  const key = pkt('key = 1', X(4), 1.55, 0);
  say('因為 A[0..i−1] 已經排好', '可以在上面做 binary search');
  await step(tok); // @1311.6 binary search on A[0..i-1]
  const mid = tag('mid', 'ptr alt', X(1.5), 1.55, 0);
  const steps = [[1, '1 < 4 → 往左'], [0, '1 < 2 → 插在最前面']];
  for (let q = 0; q < 2; q++) {
    const [m] = steps[q];
    move(mid, X(m), 1.55, 0); ms[m].glow(GOLD); txt(cc, '比較 ' + (q + 1) + ' 次');
    await beat(tok, 700); ms[m].glow(null);
  }
  say('二分找位置：1 < 4、1 < 2', '只比了 2 次');
  await step(tok); // @1323.7 theta log i each → n log n
  remove(mid);
  note('每輪 Θ(log i) 次比較', X(1.5), 2.6, 0);
  say('每一輪 Θ(log i) 次比較', '加起來 Θ(n log n)');
  await step(tok); // @1350.1 does this help the swaps?
  stu.set('?'); stu.mood('wow');
  say('那交換（搬移）有變少嗎？');
  await step(tok); // @1357.6 no: still have to insert
  no('沒有：還是得插進陣列', 4.6, 4.0, 0);
  stu.mood('sad');
  say('沒有：binary search 只告訴你位置', '還是得把 1 插進去');
  await step(tok); // @1387.0 shift things over to the right
  remove(zs);
  await slide(tok, ms[4].g, X(4), 1.2, 1.0, 350);
  for (let k = 3; k >= 0; k--) { await slide(tok, ms[k].g, X(k + 1), 0, 0, 320); txt(sc, '搬移 ' + (4 - k) + ' 次'); }
  await slide(tok, ms[4].g, X(0), 0, 0, 400); move(key, X(0), 1.55, 0); ms[4].glow(null);
  say('插到中間：後面的全部往右挪', '這裡挪了 4 個');
  await step(tok); // @1398.0 worst case theta n
  note('最壞：一輪挪 Θ(n) 個', 0, 3.4, 1.0);
  say('最壞一輪要挪 Θ(n) 個');
  await step(tok); // @1403.0 n log n compares, n^2 swaps
  no('搬移：仍是 Θ(n²)', 0, 4.6, 0.6);
  say('比較 Θ(n log n)，搬移仍是 Θ(n²)');
  await step(tok); // @1423.0 binary insertion sort
  bub('名字：binary insertion sort', -3.8, 4.6, 0.6);
  say('這個版本叫 binary insertion sort');
}]);

// 24:31 Merge sort：A → L、R → L′、R′ → merge 成 A
FRAG.push(['dcmit-mergesort-split', 'Merge sort：切兩半、遞迴、merge', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 3, 0]);
  const A = [20, 13, 7, 2, 12, 11, 9, 1];
  const X = (i, gap = 0) => -3.3 + i * 0.95 + (i >= 4 ? gap : -gap);
  await step(tok); // @1471.0 want theta n log n
  const goal = no('binary insertion：搬移仍 Θ(n²)', 0, 6.9, 0);
  say('還不滿意：想要真正的 Θ(n log n)');
  await step(tok); // @1520.5 recursive, like binary search
  txt(goal, '目標：Θ(n log n)'); goal.element.className = 'lab-label good';
  tag('A（大小 n）', 'ptr', -6.2, 5.8, 0);
  A.forEach((v, i) => cube(v, DB, [0.8, 0.55, 0.8], X(i), 5.8, 0, 1.5));
  say('Merge sort：標準的遞迴演算法', '跟 binary search 一樣是 divide and conquer');
  await step(tok); // @1530.1 split into L and R
  A.forEach((v, i) => cube(v, i < 4 ? DP : DO, [0.8, 0.55, 0.8], X(i, 0.9), 4.3, 0, 1));
  tag('L', 'ptr', X(1.5, 0.9), 5.0, 0); tag('R', 'ptr', X(5.5, 0.9), 5.0, 0);
  say('陣列 A 切成兩半：L 和 R');
  await step(tok); // @1540.4 keep splitting, no real work
  const SX = (i) => X(i, 0.9) + (i % 2 ? 0.18 : -0.18) + (((i >> 1) % 2) ? 0.22 : -0.22);
  const lv = A.map((v, i) => cube(v, i < 4 ? DP : DO, [0.75, 0.5, 0.75], SX(i), 2.6, 0, 1));
  const lt = tag('一直切到一個一個', 'idx', -6.0, 2.6, 0);
  say('切開幾乎不用做事', '一直切、切、切到只剩一個');
  await step(tok); // @1550.0 all the work is in merge, pairs at the leaves
  const PX = (i) => X(i, 0.9) + (((i >> 1) % 2) ? 0.2 : -0.2);
  const pairs = [[1, 0], [3, 2], [5, 4], [7, 6]];   // sorted order of each pair by index
  pairs.forEach((pr, p) => pr.forEach((idx, k) => move(lv[idx], PX(p * 2 + k), 2.6, 0)));
  txt(lt, '兩兩合併');
  say('工作都在最底下的 merge', '先把一對一對合併');
  await step(tok); // @1560.0 merge two pairs → four
  const quads = [[3, 2, 1, 0], [7, 6, 5, 4]];        // 2 7 13 20 | 1 9 11 12
  quads.forEach((q, h) => q.forEach((idx, k) => { move(lv[idx], X(h * 4 + k, 0.9), 2.6, 0); tint(lv[idx], DG); }));
  txt(lt, '再四個一起合併');
  say('兩對合成四個，再往上…');
  await step(tok); // @1570.0 L turns into L′
  tag("L′", 'ptr alt', X(1.5, 0.9), 3.3, 0); tag("R′", 'ptr alt', X(5.5, 0.9), 3.3, 0);
  say('L 變成排好的 L′、R 變成 R′');
  await step(tok); // @1578.7 no explicit sorting code
  note('程式裡沒有「排序」的程式碼：都在 merge 發生', 0, 1.7, 0.8);
  say('看不到把 L 變成 L′ 的程式', '排序其實發生在 merge 裡');
  await step(tok); // @1601.3 sorted array A
  [1, 2, 7, 9, 11, 12, 13, 20].forEach((v, i) => cube(v, DY, [0.8, 0.55, 0.8], X(i), 0.5, 0, 1.2));
  tag('排好的 A', 'ptr alt', -6.2, 0.5, 0);
  say('最後得到排好的陣列 A');
  await step(tok); // @1612.1 merge(L′, R′) → A
  arrow(V3(X(1.5, 0.9), 2.2, 0.5), V3(X(2.5), 0.95, 0.5), 0xa8730f); arrow(V3(X(5.5, 0.9), 2.2, 0.5), V3(X(4.5), 0.95, 0.5), 0xa8730f);
  bub('merge(L′, R′)', 0, 1.6, 1.4);
  say('merge 把 L′、R′ 合成排好的 A');
  await step(tok); // @1636.4 sizes n, n/2, n
  tag('n', 'idx', 4.9, 5.8, 0); tag('n/2 ＋ n/2（已排序）', 'idx', 5.6, 3.3, 0); tag('n（已排序）', 'idx', 4.9, 0.5, 0);
  say('輸入 n → 兩個已排序的 n/2 → 已排序的 n');
  await step(tok); // @1682.3 merge assumes sorted inputs
  ok('merge 的前提：兩邊輸入都已排好', 0, 7.6, 0);
  say('merge 假設兩個輸入已經排好');
}]);

// 28:15 Two-finger merge：L′ = 2 7 13 20、R′ = 1 9 11 12
FRAG.push(['dcmit-merge-twofinger', 'Merge：two-finger 演算法', async (tok) => {
  fresh([0, 6.4, 12.5], [0, 1, 0.4]);
  const L = [2, 7, 13, 20], R = [1, 9, 11, 12], X = (i) => -3.2 + i * 1.3, OX = (k) => -5.0 + k * 1.15;
  await step(tok); // @1694.5 invariant: inputs sorted
  ok('merge 的前提：L′、R′ 都已排好', 0, 3.6, -2.2);
  say('merge 的不變量：輸入已經排好');
  await step(tok); // @1698.8 L′ = 20 13 7 2 (read bottom-up)
  const lm = L.map((v, i) => cube(v, DP, [0.9, 0.6, 0.9], X(i), 0.3, -2.2, 1.2));
  tag("L′", 'ptr', -5.2, 0.3, -2.2);
  say("L′：2 7 13 20", '板書由下往上寫 20 13 7 2');
  await step(tok); // @1707.6 R′ = 12 11 9 1
  const rm = R.map((v, i) => cube(v, DO, [0.9, 0.6, 0.9], X(i), 0.3, -0.4, 1.2));
  tag("R′", 'ptr', -5.2, 0.3, -0.4);
  say("R′：1 9 11 12");
  await step(tok); // @1716.2 two-finger algorithm
  const fl = buddy('左手指', '', TEA, X(0), 0.62, -2.2, 0.45), fr = buddy('右手指', '', TEA, X(0), 0.62, -0.4, 0.45);
  for (let k = 0; k < 8; k++) ctx.tile(V3(OX(k), 0.02, 2.0), 0.95, 0.95);
  tag('A', 'ptr alt', -6.4, 0.3, 2.0);
  say('Two-finger：兩隻手指各指一個串列');
  await step(tok); // @1733.6 compare, take smaller
  fl.look(1); fr.look(-1);
  say('比較兩隻手指指到的值', '小的寫進 A');
  let i = 0, j = 0, k = 0;
  const take = (useL) => { const m = useL ? lm[i] : rm[j]; glow(m, null); move(m, OX(k), 0.3, 2.0); tint(m, DG); k++; if (useL) i++; else j++; };
  const fingers = () => { if (i < 4) move(fl.g, X(i), 0.62, -2.2); if (j < 4) move(fr.g, X(j), 0.62, -0.4); };
  await step(tok); // @1749.6 2 vs 1: 1 smaller
  glow(lm[0], GOLD); glow(rm[0], GOLD); fr.mood('happy');
  say('2 vs 1：1 比較小');
  await step(tok); // @1756.0 write 1 down
  glow(lm[0], null); take(false);
  say('寫下 1', '1 圈起來，用掉了');
  await step(tok); // @1771.0 right finger moves to 9
  fingers(); glow(lm[0], GOLD); glow(rm[1], GOLD); fr.mood('calm');
  say('右手指往前一格：現在是 2 vs 9');
  await step(tok); // @1779.6 2 smaller, finger to 7
  glow(rm[1], null); take(true); fingers(); fl.mood('happy');
  say('2 比較小：寫下 2', '左手指移到 7');
  await step(tok); // @1790.3 the rest of the steps
  while (k < 8) {
    const useL = j >= 4 || (i < 4 && L[i] <= R[j]);
    take(useL); fingers(); await beat(tok, 380);
  }
  kill(fl.g); kill(fr.g);
  say('剩下的照樣走完', 'A = 1 2 7 9 11 12 13 20');
  await step(tok); // @1827.8 splitting A[0..n/2-1]
  note('切：L = A[0 .. n/2 − 1]、R = 後半', 0, 3.6, 0.6);
  say('切陣列很簡單：從中間切開');
  await step(tok); // @1885.2 merge is theta n
  ok('每個元素寫一次 → merge 是 Θ(n)', 0, 3.6, 2.4);
  say('兩個 n/2 的陣列 merge：Θ(n)');
}]);

// 32:00 / 46:08 / 49:31 Recursion tree：f = 'n'（merge sort）、'n2'（cn²）、'1'（c）
FRAG.push(['dcmit-rectree', 'Recursion tree：把每層的工作加起來', async (tok) => {
  const f = ((ctx.params || {}).f) || 'n';
  fresh([0, 4.4, 13.5], [0, 3.2, 0]);
  const LV = [5.6, 4.2, 2.8, 1.0], W = [1.6, 1.3, 1.0, 0.8];
  const nodeL = { n: ['cn', 'cn/2', 'cn/4', 'c'], n2: ['cn²', 'cn²/4', 'cn²/16', 'c'], 1: ['c', 'c', 'c', 'c'] }[f];
  const sums = { n: ['cn', 'cn', 'cn', 'cn'], n2: ['cn²', 'cn²/2', 'cn²/4', 'nc'], 1: ['c', '2c', '4c', 'nc'] }[f];
  const nx = (d, k) => -4.4 + (k + 0.5) * (8.8 / Math.pow(2, d));
  const nodes = [];
  const level = (d) => {
    nodes[d] = [];
    for (let k = 0; k < Math.pow(2, d); k++) {
      if (d) line(nx(d - 1, k >> 1), LV[d - 1] - 0.3, nx(d, k), LV[d] + 0.3, 0);
      nodes[d].push(cube(nodeL[d], d === 3 ? MINT : PAPER, [W[d], 0.55, 0.7], nx(d, k), LV[d], 0, 1));
    }
    if (d === 2) tag('⋮', 'ptr', 0, 1.95, 0);
  };
  const dims = () => { tag('1 + lg n 層', 'ptr alt', -6.1, 3.4, 0); tag('n 片葉子', 'ptr alt', 0, 0.25, 1); };
  const sumT = (d) => tag('= ' + sums[d], 'ptr', 5.9, LV[d], 0);
  const hot = (ds) => ds.forEach((d) => nodes[d].forEach((m) => glow(m, GOLD)));
  if (f === 'n') {
    await step(tok); // @n:1923.0 how do you prove theta n log n?
    const q = bub('Merge sort 是 Θ(n log n)：怎麼證明？', 0, 7.2, 0);
    say('Merge sort 是 Θ(n log n)', '可是要怎麼證明？');
    await step(tok); // @n:1943.0 proof by picture
    txt(q, 'proof by picture：畫出 recursion tree');
    say('用「看圖證明」：recursion tree', '直觀，之後也能寫成正式證明');
    await step(tok); // @n:2006.0 c1 to divide
    remove(q);
    const r0 = tag('T(n) = c₁', 'ptr', -3.6, 7.2, 0);
    say('T(n)：n 個元素的工作量', 'c₁：切陣列的常數時間');
    await step(tok); // @n:2016.1 2T(n/2)
    txt(r0, 'T(n) = c₁ + 2T(n/2)');
    say('兩個大小 n/2 的子問題：2T(n/2)', '這是遞迴的部分');
    await step(tok); // @n:2028.5 cn merge
    txt(r0, 'T(n) = c₁ + 2T(n/2) + cn');
    say('加上 merge：cn', 'c 是常數，cn 就代表 Θ(n)');
    await step(tok); // @n:2106.6 root cn (ignore c1)
    level(0);
    note('c₁ 被 cn 蓋過：忽略', -5.4, 5.6, 0);
    say('展開：根是 cn', '最上層 merge 的工作');
    await step(tok); // @n:2129.5 two subproblems of n/2
    level(1);
    say('下一層：兩個子問題，各 c·n/2');
    await step(tok); // @n:2157.7 cn/4 …
    level(2);
    say('再下一層：四個 c·n/4…');
    await step(tok); // @n:2169.8 n becomes 1: a bunch of c's
    level(3);
    say('n 一直減半到 1', '葉子都是 c');
    await step(tok); // @n:2197.9 levels: 1 + lg n
    tag('1 + lg n 層', 'ptr alt', -6.1, 3.4, 0);
    say('有幾層？1 + lg n');
    await step(tok); // @n:2221.7 n leaves
    tag('n 片葉子', 'ptr alt', 0, 0.25, 1);
    say('葉子幾個？n 個', '大小 1 的陣列本來就排好');
    await step(tok); // @n:2244.6 add up: top level cn
    sumT(0);
    say('每層加起來：最上層 cn');
    await step(tok); // @n:2252.0 every level cn
    for (let d = 1; d < 4; d++) { sumT(d); await beat(tok, 450); }
    say('第二層：cn/2 + cn/2 = cn', '每一層都是 cn！');
    await step(tok); // @n:2291.6 (1 + lg n) cn
    hot([0, 1, 2, 3]);
    ok('T(n) = (1 + lg n) · cn = Θ(n lg n)', 0, 7.9, 0);
    say('(1 + lg n) 層 × 每層 cn', '= Θ(n lg n)');
  } else if (f === 'n2') {
    await step(tok); // @n2:2768.0 same structure, other recurrences
    bub('同一種樹，換別的遞迴式', 0, 7.2, 0);
    say('最後幾分鐘：用同一種樹看別的遞迴式');
    await step(tok); // @n2:2809.1 T(n) = 2T(n/2) + cn²
    tag('T(n) = 2T(n/2) + cn²', 'ptr', -3.6, 6.6, 0);
    say('T(n) = 2T(n/2) + cn²');
    await step(tok); // @n2:2828.1 crummy merge taking n²
    note('merge 寫壞了，要 n²', 3.4, 6.6, 0);
    say('想像 merge 寫爛了：要 cn²');
    await step(tok); // @n2:2847.2 root cn²
    level(0);
    say('樹的形狀一樣：根是 cn²');
    await step(tok); // @n2:2850.7 two cn²/4
    level(1);
    say('下一層：兩個 c(n/2)² = cn²/4');
    await step(tok); // @n2:2855.5 four cn²/16
    level(2);
    say('再下一層：四個 cn²/16');
    await step(tok); // @n2:2867.0 down to 1: c at the leaves
    level(3);
    say('n 減到 1：葉子還是 c');
    await step(tok); // @n2:2873.3 n leaves, 1 + log n levels
    dims();
    say('n 片葉子、1 + lg n 層', '和之前一模一樣');
    await step(tok); // @n2:2898.5 add up each level
    for (let d = 0; d < 4; d++) { sumT(d); await beat(tok, 450); }
    say('每層加總：cn²、cn²/2、cn²/4 … nc', '一層比一層小一半');
    await step(tok); // @n2:2916.0 this dominates, bounded by 2cn²
    note('根以下全部加起來 ≤ cn²', 0.4, 7.4, 0);
    say('根以下全部加起來 ≤ cn²', '總和 ≤ 2cn²');
    await step(tok); // @n2:2942.2 theta n²
    ok('Θ(n²)', 5.4, 7.4, 0);
    say('所以是 Θ(n²)');
    await step(tok); // @n2:2950.2 all the work at the root
    hot([0]);
    say('工作全集中在根（最上層）');
    await step(tok); // @n2:2955.1 merge sort: equal work per level
    bub('merge sort：每層一樣多', -5.0, 0.3, 1.2);
    say('對照：merge sort 是每層工作一樣多');
  } else {
    await step(tok); // @1:2970.4 a recurrence with all work at the leaves
    bub('最後一個：工作都在葉子', 0, 7.2, 0);
    say('最後：工作都在葉子的例子');
    await step(tok); // @1:2980.2 merge in constant time
    tag('T(n) = 2T(n/2) + c', 'ptr', -3.6, 6.6, 0);
    note('merge 神奇地只要常數時間', 3.4, 6.6, 0);
    say('假設 merge 只要常數時間', 'T(n) = 2T(n/2) + c');
    await step(tok); // @1:3001.8 c, c, c …
    for (let d = 0; d < 4; d++) { level(d); await beat(tok, 450); }
    say('每個節點都是 c');
    await step(tok); // @1:3011.0 n leaves as before
    dims();
    say('一樣：n 片葉子、1 + lg n 層');
    await step(tok); // @1:3018.1 c, 2c, 4c … nc
    for (let d = 0; d < 4; d++) { sumT(d); await beat(tok, 450); }
    say('每層加總：c、2c、4c … nc', '一層比一層多一倍');
    await step(tok); // @1:3030.0 bottom dominates: theta n
    ok('總和 ≤ 2nc → Θ(n)', 0, 7.6, 0);
    say('最底層主導：Θ(n)');
    await step(tok); // @1:3050.1 all the work at the leaves
    hot([3]);
    say('工作全集中在葉子');
    await step(tok); // @1:3057.8 a theorem does this mechanically
    note('master theorem 能機械地算；老師更愛畫樹', 0, 0.2, 2.2);
    say('有定理（master theorem）能機械地解', '但畫 recursion tree 更好懂');
  }
}]);

// 39:38 Insertion sort 的優點：in-place（Θ(1) 輔助空間）vs merge sort Θ(n)
FRAG.push(['dcmit-inplace', 'In-place：輔助空間 Θ(1) vs Θ(n)', async (tok) => {
  fresh([0, 6, 13], [0, 1.6, 0]);
  const X = (i) => -6.0 + i * 0.62, M = (i) => 0.9 + i * 0.68;
  await step(tok); // @2378.4 advantage of insertion over merge?
  const ins = buddy('insertion sort', '', DB, -4.4, 0, -3.2, 0.8), mer = buddy('merge sort', '', DO, 3.3, 0, -3.2, 0.8);
  ins.mood('wow'); mer.mood('happy');
  bub('insertion sort 比 merge sort 好在哪？', 0, 3.6, -3.2);
  say('insertion sort 有什麼比 merge sort 好？');
  await step(tok); // @2409.0 in-place: auxiliary space
  note('答案：in-place（跟額外空間有關）', 0, 2.9, -3.2);
  say('in-place 排序', '比的是「要借多少額外空間」');
  await step(tok); // @2419.0 merge sort copies L, R
  const B = [20, 13, 7, 2, 12, 11, 9, 1];
  B.forEach((v, i) => cube(v, DB, [0.6, 0.5, 0.6], M(i), 0.25, -1.2));
  const cp = B.map((v, i) => cube(v, i < 4 ? DP : DO, [0.6, 0.5, 0.6], M(i) + (i < 4 ? -0.25 : 0.25), 0.25, 0.8, 2));
  say('merge sort：L′、R′ 和原本的 L、R 不一樣', '兩半先複製一份出來');
  await step(tok); // @2434.7 dump into A
  arrow(V3(M(1.5), 0.6, 0.5), V3(M(1.5), 0.6, -0.8), 0xa8730f); arrow(V3(M(5.5), 0.6, 0.5), V3(M(5.5), 0.6, -0.8), 0xa8730f);
  say('結果再寫回 A');
  await step(tok); // @2457.7 theta n auxiliary space
  no('多出 n 格：Θ(n) 額外空間', M(3.5), 1.4, 1.6);
  mer.mood('sad');
  say('merge sort 要 Θ(n) 的額外空間');
  await step(tok); // @2477.1 in-place definition
  ok('in-place 的定義：只用 Θ(1) 額外空間', -3, 4.4, 0);
  say('in-place = 額外空間只要常數 Θ(1)');
  await step(tok); // @2484.3 insertion: one temp variable
  const arr = [2, 4, 1].map((v, i) => cube(v, DB, [0.55, 0.5, 0.6], X(i) + 0.6, 0.25, -1.2));
  const tmp = cube('temp', DY, [0.9, 0.5, 0.6], -4.6, 0.25, 0.8, 1.5);
  await beat(tok, 300);
  const pa = arr[1].position.clone(), pb = arr[2].position.clone();
  await slide(tok, arr[1], -4.6, 0.85, 0.8, 450);
  await slide(tok, arr[2], pa.x, pa.y, pa.z, 450);
  await slide(tok, arr[1], pb.x, pb.y, pb.z, 450);
  ins.mood('happy'); await ins.hop(tok);
  ok('只多一個 temp：Θ(1)', -4.4, 1.3, 1.6);
  say('insertion sort 只要一個暫存 temp', '交換時先放一下 → Θ(1)');
  await step(tok); // @2510.7 billions of items: memory matters
  note('資料有十億、一兆筆時，記憶體很要緊', 0, 5.2, 0);
  say('資料量很大時，這個差別很重要');
  await step(tok); // @2527.2 trick: copy only half → n/2
  for (let i = 0; i < 4; i++) fly(cp[i], V3(-1, 6, 3));
  bub('小技巧：只複製一半 → n/2', M(5.5), 2.4, 1.6);
  say('小技巧：只複製一半', '額外空間降到 n/2（常數變小）');
  await step(tok); // @2565.1 in-place merge sort exists
  ok('in-place merge sort：存在！仍 Θ(n lg n)', 0, 6.0, 0);
  say('其實有 in-place 的 merge sort', '超出 006 範圍');
  await step(tok); // @2579.0 impractical constant factors
  no('但常數太大，實務上沒人用', 0, 6.7, 0);
  say('可是常數因子太大', '比普通 merge sort 慢很多');
}]);

// 43:55 常數因子：Python merge 2.2 n lg n μs vs C insertion 0.01 n² μs
FRAG.push(['dcmit-python-vs-c', 'Python merge sort vs C insertion sort', async (tok) => {
  fresh([0, 4.6, 12.5], [0, 2.6, 0]);
  const Ns = [1000, 2000, 4000, 8000], S = 5 / 640000;
  const mp = (n) => 2.2 * n * Math.log2(n), ic = (n) => 0.01 * n * n;
  const bar = async (q) => {
    const x = -4.5 + q * 3, n = Ns[q];
    const b1 = dBar(DB, x - 0.4, 0), b2 = dBar(DO, x + 0.4, 0);
    tag('n = ' + n, 'idx', x, 0.02, 1);
    await anim(tok, 700, (t) => { dSetBar(b1, mp(n) * S * t); dSetBar(b2, ic(n) * S * t); });
    glow(mp(n) < ic(n) ? b1 : b2, GREEN);
  };
  await step(tok); // @2647.1 python merge 2.2 n lg n
  const py = buddy('Python merge', '', DB, -5.8, 0, -2.6, 0.6);
  tag('Python merge：2.2 n lg n μs', 'ptr', -3.4, 6.6, 0);
  say('實測擬合：Python merge sort', '約 2.2 n lg n 微秒');
  await step(tok); // @2672.0 python insertion 0.2 n²
  note('Python insertion：0.2 n² μs', 0, 5.9, 0);
  say('Python 的 insertion sort：約 0.2 n²');
  await step(tok); // @2682.2 C insertion 20× faster
  const cc = buddy('C insertion', '', DO, 5.8, 0, -2.6, 0.6);
  tag('C insertion：0.01 n² μs', 'ptr alt', 3.2, 6.6, 0);
  say('用 C 寫的 insertion sort 快約 20 倍', '0.01 n² 微秒');
  await step(tok); // @2706.5 you can find an n
  await bar(0); await bar(1);
  cc.mood('happy');
  say('n 小的時候：C insertion 比較快', '1000、2000 都是橘色贏');
  await step(tok); // @2719.7 beyond about 4000 merge wins
  await bar(2); await bar(3);
  py.mood('happy'); cc.mood('sad');
  say('n 到幾千以上：Python merge 反超', '4000、8000 藍色贏');
  await step(tok); // @2737.0 asymptotic complexity is important
  ok('漸近複雜度才是關鍵', 0, 7.3, 0);
  say('這就是漸近複雜度重要的原因');
  await step(tok); // @2739.5 factor 20 only keeps n² competitive a bit longer
  note('20 倍的常數，只讓 n² 多撐一下', 0, 5.2, 0);
  say('常數快 20 倍也救不了 n²', '只是多撐一會兒就被追過');
}]);

// ═════════════ Rec3：4iXLnF3hExw ═════════════

// 02:36 document distance 回顧：call graph 與各函數成本
FRAG.push(['dcmit-docdist-recap', 'Document distance：呼叫圖與成本', async (tok) => {
  fresh([0, 5, 13.5], [0, 3.2, 0]);
  const N = {
    main: ['main', 0, 6.4], wff: ['word_frequencies_for_file', -2.9, 4.8], va: ['vector_angle', 3.3, 4.8],
    gw: ['get_words_from_line_list', -4.3, 3], cf: ['count_frequency', -1.2, 3], ip: ['inner_product', 3.3, 3],
  };
  const P = { wff: 'main', va: 'main', gw: 'wff', cf: 'wff', ip: 'va' };
  const M = {};
  const box = (k) => { const [t, x, y] = N[k]; if (P[k]) line(N[P[k]][1], N[P[k]][2] - 0.3, x, y + 0.3, 0); M[k] = dBox(t, x, y, 0, k === 'main' ? 1.4 : 2.9, PAPER, 1); };
  const cost = (k, c, cls = 'ptr alt') => tag(c, cls, N[k][1], N[k][2] - 0.72, 0.5);
  await step(tok); // @156.0 today: look at the code
  const lst = prop('file', -5.6, 0, 1.4, 1.0, '程式碼 listing'); bob(lst, 0.05);
  say('上次講理論，今天看程式碼', '分析執行時間，看理論和實際對不對得上');
  await step(tok); // @194.9 call graph starts at main
  box('main');
  say('Call graph：從 main 開始的樹');
  await step(tok); // @208.5 main calls word_frequencies_for_file
  box('wff');
  say('main 呼叫 word_frequencies_for_file');
  await step(tok); // @219.8 which calls get_words_from_line_list, count_frequency
  box('gw'); box('cf');
  say('它再呼叫 get_words_from_line_list', '和 count_frequency');
  await step(tok); // @231.4 pretend we don't see read_file
  note('read_file：假裝看不到（時間 ∝ 檔案長度）', -3.2, 1.9, 0.6);
  say('read_file 先不算', '當作資料已在記憶體');
  await step(tok); // @254.2 vector_angle
  box('va');
  say('main 還呼叫 vector_angle');
  await step(tok); // @267.8 inner_product
  box('ip');
  say('vector_angle 呼叫 inner_product');
  await step(tok); // @282.8 W words
  kill(lst);
  const cs = tag('W = 文件字數', 'ptr', 0, 0.9, 1.4);
  say('常數：文件有 W 個字');
  await step(tok); // @291.5 L unique words
  txt(cs, 'W = 文件字數　L = 不重複字數');
  say('變成文件向量後有 L 個元素', 'L = 不重複的字數');
  await step(tok); // @309.5 word length bounded
  txt(cs, 'W = 文件字數　L = 不重複字數　w̄ = 字長');
  say('英文字長有上限：5–10 個字元', '字長叫 w̄');
  await step(tok); // @379.7 get_words_from_line_list O(W²)
  glow(M.gw, GOLD); cost('gw', 'O(W²)', 'ptr');
  say('get_words_from_line_list：O(W²)');
  await step(tok); // @413.0 line 5: the plus
  const pl = no('第 5 行：word_list = word_list + …', -4.3, 1.8, 0.6);
  say('元凶：第 5 行的「+」', '每次都把整個串列複製一份');
  await step(tok); // @426.6 count_frequency: cover it now
  glow(M.gw, null); remove(pl); glow(M.cf, GOLD);
  cost('cf', '待會算');
  say('count_frequency 今天補上');
  await step(tok); // @445.9 inner product: L1 L2
  glow(M.cf, null); glow(M.ip, GOLD); cost('ip', 'O(L₁L₂)');
  say('兩個向量長 L₁、L₂', 'inner_product：L₁L₂');
  await step(tok); // @498.5 vector angle: + L1² + L2²
  glow(M.ip, null); glow(M.va, GOLD);
  const vt = cost('va', 'L₁L₂ + L₁² + L₂²');
  say('vector_angle：三次內積', '分母要向量跟自己的內積：L₁²、L₂²');
  await step(tok); // @516.5 L1²+L2² ≥ L1L2 → drop
  txt(vt, 'O(L₁² + L₂²)');
  say('L₁² + L₂² ≥ L₁L₂', '所以 L₁L₂ 可以拿掉');
  await step(tok); // @534.2 count_frequency ≤ W²; wff W²
  glow(M.va, null); glow(M.wff, GOLD); cost('wff', 'O(W²)');
  say('先假設 count_frequency ≤ W²', 'word_frequencies_for_file 就是 W²');
  await step(tok); // @566.8 called twice: W1² + W2²
  glow(M.wff, null); glow(M.main, GOLD);
  const mt = tag('W₁² + W₂² + L₁² + L₂²', 'ptr', 2.6, 6.4, 0);
  say('每份文件各呼叫一次', '第一份 W₁ 個字、第二份 W₂ 個字');
  await step(tok); // @604.1 W ≥ L dominates
  txt(mt, 'O(W₁² + W₂²)'); glow(M.main, GREEN);
  say('W₁ ≥ L₁、W₂ ≥ L₂', 'L 的平方被吃掉：總共 O(W₁² + W₂²)');
}]);

// 10:21 count_frequency 在做什麼、每行跑幾次（原 count-frequency-cost 的逐句版）
FRAG.push(['dcmit-cf-loop', 'count_frequency：每行跑幾次', async (tok) => {
  fresh([0, 5.5, 14.5], [0, 3, 0]);
  const lines = ['1 def count_frequency(word_list):', '2   L = []', '3   for new_word in word_list:', '4     for entry in L:', '5       if new_word == entry[0]:', '6         entry[1] = entry[1] + 1', '7         break', '8     else:', '9       L.append([new_word, 1])', '10  return L'];
  const Y = (i) => 7.4 - i * 0.42;
  const W = ['the', 'fox', 'is', 'in', 'the', 'hat'], WX = (i) => -5.6 + i * 1.05, LX = (k) => -5.6 + k * 1.2;
  await step(tok); // @621.0 count_frequency's cost
  const cd = code(lines, -2.4, 7.4, 0.42);
  say('補上 count_frequency 的成本');
  await step(tok); // @640.4 cost once × times
  tag('一次的成本 × 次數', 'ptr', 3.6, 7.85, 0);
  const cl = lines.map((_, i) => tag('', 'ptr alt', 3.6, Y(i)));
  say('方法：每行「跑一次的成本 × 跑幾次」', '最後全部加起來');
  await step(tok); // @711.8 list of words
  const wm = W.map((w, i) => cube(w, DB, [0.95, 0.45, 0.8], WX(i), 0.23, 2.6, 1.2));
  tag('word_list', 'ptr', -6.6, 0.9, 2.6);
  say('輸入：文件切成的字串列', 'the fox is in the hat');
  await step(tok); // @738.3 output: list of [word, count]
  bub('輸出：[字, 次數] 的串列', 4.8, 3.0, 1);
  say('count_frequency 要回傳 [字, 次數] 的串列');
  await step(tok); // @750.0 the 2, fox 1, is 1, in 1, hat 1
  ['the 2', 'fox 1', 'is 1', 'in 1', 'hat 1'].forEach((t, i) => note(t, 4.8, 2.4 - i * 0.48, 1));
  say('the 出現 2 次，其他各 1 次');
  await step(tok); // @781.7 line 2: L initialized
  cd.hl(1);
  tag('L', 'ptr alt', -6.6, 0.9, 0.6);
  say('第 2 行：L 一開始是空的', '最後把 L 回傳');
  const Lm = [];
  const visit = async (i, ms = 450) => {
    const at = Lm.findIndex((e) => e.w === W[i]);
    glow(wm[i], GOLD);
    if (at >= 0) { Lm[at].c++; relabel(Lm[at].m, Lm[at].w + ':' + Lm[at].c); glow(Lm[at].m, GREEN); }
    else Lm.push({ w: W[i], c: 1, m: cube(W[i] + ':1', DG, [1.1, 0.45, 0.8], LX(Lm.length), 0.23, 0.6, 1.2) });
    await beat(tok, ms); glow(wm[i], null); if (at >= 0) glow(Lm[at].m, null);
  };
  await step(tok); // @793.1 line 3 iterates over the input
  cd.hl(2);
  for (let i = 0; i < 5; i++) await visit(i);
  say('第 3 行：一個字一個字走過輸入', '第二個 the → 次數 +1');
  await step(tok); // @799.2 line 4 scans the list under construction
  cd.hl(3); glow(wm[5], GOLD);
  const sc = pkt('找 hat', LX(0), 1.0, 0.6);
  for (let k = 0; k < Lm.length; k++) { move(sc, LX(k), 1.0, 0.6); glow(Lm[k].m, GOLD); await beat(tok, 300); glow(Lm[k].m, null); }
  say('第 4 行：在建構中的 L 裡找這個字', 'hat 跟每個項目比，都不是');
  await step(tok); // @826.8 not found → new entry
  cd.hl(8); remove(sc); glow(wm[5], null);
  Lm.push({ w: 'hat', c: 1, m: cube('hat:1', DG, [1.1, 0.45, 0.8], LX(Lm.length), 0.23, 0.6, 1.2) });
  say('找不到：新增一筆 [hat, 1]', '第一次看到，次數是 1');
  await step(tok); // @841.4 line 2 cost 1
  cd.hl(1); txt(cl[1], '1 × 1');
  say('第 2 行：成本 1、跑 1 次');
  await step(tok); // @897.0 line 3: W times
  cd.hl(2); txt(cl[2], '1 × W');
  say('第 3 行：word_list 有 W 個字', '跑 W 次');
  await step(tok); // @973.0 line 4 inside the loop: W times at least
  cd.hl(3);
  note('第 4 行在外層迴圈裡：至少跑 W 輪', -2.4, 2.1, 0);
  say('第 4 行在 for 裡面', '外層每一輪都會跑到它');
  await step(tok); // @1112.0 worst case: L grows to L fast
  note('最壞：L 很快長到 L 個，之後每輪都走 L 個', 3.2, 0.3, 2.6);
  say('最壞：前面全是不同的字，L 很快長到 L', '之後每個字都要走過 L 個項目 → L·W 次');
  await step(tok); // @1177.1 English ~250,000 words: L ≪ W
  note('英文約 25 萬字：L 有上限，W 可以十億', -2.4, 1.5, 0);
  say('L 是不重複字數：英文最多約 25 萬', 'W 可能是十億 → 兩個要分開記');
  await step(tok); // @1219.0 one step of iterating: 1
  txt(cl[3], '1 × L·W');
  say('第 4 行每走一步 O(1)', '總共 1 × L·W');
}]);

// 20:43 count_frequency：字串比較 w̄、緊與鬆的上界、哪行主導
FRAG.push(['dcmit-cf-strcmp-bounds', '字串比較 w̄ 與緊／鬆上界', async (tok) => {
  fresh([0, 5.2, 13.5], [0, 3.4, 0]);
  const cd = code(['3 for new_word in word_list:', '4   for entry in L:', '5     if new_word == entry[0]:', '6       entry[1] += 1', '7       break', '8   else:', '9     L.append([new_word, 1])'], -1.6, 6.8, 0.5);
  const cst = ['1 × W', '1 × L·W', '', '', '', '', ''];
  const tg = cst.map((c, i) => tag(c, 'ptr alt', 4.4, 6.8 - i * 0.5, 0));
  const s1 = 'distance', s2 = 'distancy', X = (i) => -6 + i * 0.62;
  await step(tok); // @1243.9 line 5 runs L·W times, cost?
  cd.hl(2); txt(tg[2], '? × L·W');
  say('第 5 行的 if：每次都會跑', '跟第 4 行一樣 L·W 次；一次多少？');
  await step(tok); // @1273.0 depends on word length
  const stu = buddy('同學', '跟字長有關', STU, 5.6, 0, 2.2, 0.6); stu.mood('happy');
  say('一次比較的成本：跟字的長度有關');
  await step(tok); // @1335.2 two long strings differing in the last char
  const a = s1.split('').map((c, i) => cube(c, DB, [0.5, 0.45, 0.5], X(i), 2.2, 1.2, 1));
  const b = s2.split('').map((c, i) => cube(c, DP, [0.5, 0.45, 0.5], X(i), 1.5, 1.2, 1));
  say('兩個長字串，只差最後一個字元');
  await step(tok); // @1339.0 character by character
  const cur = pkt('▲', X(0), 0.9, 1.2), cc = note('比了 0 個字元', -3.8, 3.0, 1.2);
  for (let i = 0; i < 8; i++) {
    move(cur, X(i), 0.9, 1.2); glow(a[i], s1[i] === s2[i] ? GOLD : RED); glow(b[i], s1[i] === s2[i] ? GOLD : RED);
    txt(cc, '比了 ' + (i + 1) + ' 個字元'); await beat(tok, 260);
  }
  say('只能一個字元一個字元比', '比到最後才知道不一樣');
  await step(tok); // @1348.5 proportional to string length → w̄
  txt(tg[2], 'w̄ × L·W');
  say('比較時間 ∝ 字串長度 = w̄', '第 5 行：w̄ × L·W');
  await step(tok); // @1364.2 lines 6 and 7: cost 1
  a.concat(b).forEach((m) => kill(m)); kill(cur); remove(cc);
  cd.hl(3); stu.set('一次 O(1)');
  say('第 6、7 行：跑一次是 O(1)', '難的是：跑幾次？');
  await step(tok); // @1414.7 break exits the inner loop
  cd.hl(4);
  bub('break：跳出第 4–7 行的迴圈', 4.6, 1.2, 0);
  say('break 跳出內層迴圈', '回到第 3 行拿下一個字');
  await step(tok); // @1429.8 else aligned with for
  cd.hl(5);
  note('for…else：跑完沒 break 才執行 else', -1.6, 2.6, 0.6);
  say('else 跟 for 對齊', '迴圈跑完、沒有 break 才執行（常用在「找不到」）');
  await step(tok); // @1484.0 lines 6, 7: W − L times
  cd.hl(3); txt(tg[3], '1 × (W − L)'); txt(tg[4], '1 × (W − L)');
  ok('精確：只有重複字才跑 → W − L', 0, 1.8, 2);
  say('第 6、7 行只在「重複字」跑', 'W 個字、L 個新字 → W − L 次');
  await step(tok); // @1585.9 lazier bound: at most once per outer loop → W
  note('偷懶的界：break 讓它每輪最多一次 → ≤ W', 0, 1.1, 2);
  say('沒想到 W − L 也行', 'break 後就離開 → 每輪外層最多一次，≤ W');
  await step(tok); // @1633.0 else runs at most L times
  cd.hl(5); txt(tg[5], '1 × L');
  say('else：只有新字會跑到', '最多 L 次');
  await step(tok); // @1663.8 line 9 append: constant
  cd.hl(6); txt(tg[6], '1 × L');
  say('第 9 行 append：O(1)，跑 L 次');
  await step(tok); // @1741.8 W also works; L is tighter
  stu.set('else 也可以說 ≤ W？'); stu.mood('wow');
  say('同學：else 也能說最多 W 次', '對！W 是好的界，L 更緊');
  await step(tok); // @1781.3 either bound gives the right running time
  stu.mood('happy');
  ok('漸近分析：緊的、鬆的都會得到對的答案', 0, 0.4, 2);
  say('哪個界都會得到正確的漸近時間', '緊的界代表你看懂了演算法');
  await step(tok); // @1815.5 partial products
  cd.hl(-1); tg.forEach((t) => { t.element.className = 'lab-label ptr alt'; });
  say('把每行的乘積列出來', '1、W、L·W、w̄·L·W、W − L、…、L');
  await step(tok); // @1861.5 line 5 dominates
  cd.hl(2); tg[2].element.className = 'lab-label bad';
  say('最大的是第 5 行：O(W · L · w̄)', '它就是這個函數的時間');
  await step(tok); // @1877.7 w̄ bounded → W·L ≤ W²
  ok('w̄ 有界 → O(W·L) ≤ W²：之前的假設成立', 0.4, 7.5, 0);
  say('英文字長 5–10 個字元：w̄ 當常數', 'W·L ≤ W²，前面的總結不用改');
}]);

// 31:59 Profiler 與 + 改 extend（原 plus-vs-extend 的逐句版）
FRAG.push(['dcmit-profiler', 'Profiler 找瓶頸：+ 改成 extend', async (tok) => {
  fresh([0, 5, 14], [0, 2.8, 0]);
  await step(tok); // @1926.4 1,000 lines by hand doesn't scale
  const pile = [];
  for (let i = 0; i < 10; i++) pile.push(cube('', i % 2 ? '#e6e1d8' : '#d9d4cb', [1.6, 0.12, 1.1], -5.4, 0.06 + i * 0.13, 0, 0.6 + i * 0.1));
  no('上千行程式：逐行手算？不實際', -4.6, 2.2, 0);
  say('一千行的程式，一行一行算？', '不會這樣做');
  await step(tok); // @1937.6 run it through a profiler
  const mon = prop('monitor', -2.2, 0, 0, 0.9, 'profiler：哪裡最花時間');
  say('交給 profiler 跑', '電腦會告訴你哪一行最花時間');
  const rows = [['word_frequencies_for_file', 0.6, 5.0], ['get_words_from_line_list', 3.8, 3.8], ['count_frequency', 2.0, 2.0]];
  const RY = (i) => 6.2 - i * 0.75;
  await step(tok); // @1964.7 total time per function
  tag('total time', 'ptr', 2.0, 7.0, 0); tag('cumulative', 'ptr alt', 5.2, 7.0, 0);
  const tb = rows.map(([n, t], i) => { tag(n, 'idx', -0.6, RY(i), 0); return hBar(DO, 0.6, RY(i), 0); });
  await anim(tok, 700, (u) => tb.forEach((m, i) => hSet(m, rows[i][1] * 0.5 * u)));
  say('total time：函數「自己」花的時間');
  await step(tok); // @1971.7 cumulative: together with children
  const cb = rows.map((_, i) => hBar(DB, 3.6, RY(i), 0));
  await anim(tok, 700, (u) => cb.forEach((m, i) => hSet(m, rows[i][2] * 0.5 * u)));
  say('cumulative：連同它呼叫的子函數', 'word_frequencies_for_file 看起來最大');
  await step(tok); // @2015.8 look at total time: get_words_from_line_list
  glow(tb[1], RED);
  no('瓶頸：get_words_from_line_list', 2.0, 3.6, 0.4);
  say('找瓶頸要看 total time', '最慢的是 get_words_from_line_list');
  await step(tok); // @2024.3 there's a plus, it copies the list
  kill(mon); pile.forEach((m) => kill(m));
  tag('+', 'ptr', -6.3, 0.3, -1.2);
  let s = 0;
  const sumP = note('複製 0 個', -6.0, 2.2, -1.2);
  for (let z = 1; z <= 6; z++) { const b = dBar(DR, -5.4 + (z - 1) * 0.9, -1.2, 0.6); s += 3 * z; txt(sumP, '複製 ' + s + ' 個'); await anim(tok, 220, (u) => dSetBar(b, 3 * z * 0.12 * u)); }
  say('第 5 行有個「+」', '每加一行就把整串複製一次 → 越來越貴');
  await step(tok); // @2040.0 extend: docdist2
  tag('extend', 'ptr alt', -6.6, 0.3, 1.4);
  const sumE = note('搬 0 個', -6.0, 1.3, 1.4);
  let e = 0;
  for (let z = 1; z <= 6; z++) { const b = dBar(DG, -5.4 + (z - 1) * 0.9, 1.4, 0.6); e += 3; txt(sumE, '搬 ' + e + ' 個'); await anim(tok, 180, (u) => dSetBar(b, 3 * 0.12 * u)); }
  say('改用 extend：document distance 2', '只搬新來的幾個字');
  await step(tok); // @2052.3 a few keystrokes, 30% faster
  ok('改 8 個鍵 → 快約 30%', -2.6, 3.4, 0.6);
  say('一個字元換成六個', '執行時間改善約 30%，划算！');
}]);

// 35:30 extend 的成本：每行 K 字、Z 行 → K·Z = W
FRAG.push(['dcmit-extend-kz', 'extend：K 次 append × Z 行 = W', async (tok) => {
  fresh([0, 5.4, 13], [0, 2.6, 0]);
  const K = 3, Z = 4;
  const TX = (i) => -2.4 + i * 0.6;
  await step(tok); // @2132.7 reads lines, breaks into words, combines
  tag('文件', 'ptr', -5.8, 4.3, 0);
  const doc = [];
  for (let z = 0; z < Z; z++) for (let k = 0; k < K; k++) doc.push(cube('', DB, [0.5, 0.4, 0.5], -5.6 + k * 0.6, 3.6 - z * 0.55, 0, 0.8));
  say('get_words_from_line_list：逐行讀', '切成字，再全部接起來');
  await step(tok); // @2142.0 line 4 words of a line, extend combines
  const cd = code(['4  words_in_line = get_words_from_string(line)', '5  word_list.extend(words_in_line)'], -0.2, 6.6, 0.5);
  cd.hl(0);
  say('第 4 行：一行的字串列', '第 5 行：extend 接到大串列後面');
  await step(tok); // @2155.9 K words per line
  const kT = note('K = 每行字數', -5.0, 4.0, 0.6);
  for (let k = 0; k < K; k++) glow(doc[k], GOLD);
  say('K = 每行的字數');
  await step(tok); // @2167.9 Z lines
  for (let k = 0; k < K; k++) glow(doc[k], null);
  tag('Z 行', 'ptr alt', -6.6, 2.8, 0);
  say('Z = 行數', '所以 W = K · Z');
  await step(tok); // @2207.8 K is bounded
  txt(kT, 'K 有上限：一行要塞得進螢幕或紙');
  say('K 不會無限大：一行得放得進螢幕', '但分析時還是用得到');
  await step(tok); // @2254.0 line 4 gives K elements, line 5 appends
  tag('word_list（大串列）', 'ptr alt', 1.0, 0.95, 1.2);
  for (let i = 0; i < K * Z; i++) ctx.tile(V3(TX(i), 0.02, 1.2), 0.55, 0.6);
  cd.hl(1);
  for (let k = 0; k < K; k++) glow(doc[k], GOLD);
  say('第 4 行給 K 個字', '第 5 行把這 K 個接到大串列');
  await step(tok); // @2283.0 if Python lists were linked lists: concat O(1)
  const stu = buddy('同學', 'linked list → O(1)?', STU, 5.2, 0, -1.6, 0.6); stu.mood('wow');
  const chain = [0, 1, 2, 3, 4, 5].map((i) => cube(i ? '' : '頭', '#f3dcc0', [0.55, 0.4, 0.55], -0.4 + i * 0.95, 0.2, -2.4));
  const arrs = [0, 1, 2, 3, 4].map((i) => arrow(V3(-0.1 + i * 0.95, 0.2, -2.4), V3(0.3 + i * 0.95, 0.2, -2.4), 0x6e5f49));
  say('若 Python list 是 linked list', '兩串接起來確實 O(1)');
  await step(tok); // @2300.8 but element 200 takes 200 steps
  const walk = pkt('找第 200 個', -0.4, 0.9, -2.4);
  await travel(tok, walk, V3(-0.4, 0.9, -2.4), V3(4.35, 0.9, -2.4), 1500);
  say('但要拿中間第 200 個', '就得從頭走 200 步');
  await step(tok); // @2319.5 Python list = CLRS array (contiguous)
  remove(walk); chain.forEach((m) => kill(m)); arrs.forEach((m) => kill(m));
  stu.set('原來是 array'); stu.mood('happy');
  ok('Python list = CLRS 的 array（連續存放）', 1.0, 0.3, 2.4);
  say('Python 的 list 其實是陣列', '名字叫 list，可不是 linked list');
  await step(tok); // @2334.5 copying a block still moves every element
  note('整塊複製也得搬每個元素', 4.6, 2.0, 0);
  say('整塊複製也一樣', '1 萬個元素就得搬 1 萬份');
  await step(tok); // @2370.5 extend = sequence of appends
  for (let k = 0; k < K; k++) glow(doc[k], null);
  bub('extend = K 次 append，每次 O(1)', 4.4, 4.6, 0);
  say('extend 就是連續 append', '長度 K → K 次，每次常數');
  await step(tok); // @2391.8 line 5 runs Z times
  const cost = note('成本 0', 5.2, 3.0, 0);
  let c = 0;
  for (let z = 0; z < Z; z++) for (let k = 0; k < K; k++) {
    const m = doc[z * K + k]; move(m, TX(z * K + k), 0.25, 1.2); tint(m, DG);
    c++; txt(cost, '成本 ' + c); await beat(tok, 170);
  }
  say('第 5 行跑 Z 次（每行一次）', '每次 K');
  await step(tok); // @2446.9 K·Z = W
  ok('總共 K · Z = W → O(W)', 4.6, 3.8, 0);
  say('K × Z = W', '從 O(W²) 降到 O(W)');
  await step(tok); // @2464.5 word_frequencies_for_file: W·L
  note('word_frequencies_for_file：O(W·L)', 2.2, 5.6, 0.6);
  say('word_frequencies_for_file 變成 W·L', 'count_frequency 主導');
  await step(tok); // @2505.9 L1² ≤ W1L1, no need to add
  note('L₁² ≤ W₁L₁：不用另外加', 2.2, 5.0, 0.6);
  say('要不要把 L₁² 加回來？', 'L₁² ≤ W₁L₁，已被吃掉（但要想過）');
  await step(tok); // @2522.0 docdist2 improved
  ok('document distance 2：O(W₁L₁ + W₂L₂ + L₁L₂)', 0.4, 7.4, 0);
  say('docdist2：漸近複雜度和實際時間都變好');
}]);

// 42:14 已排序向量的內積：binary search → 兩指標（原 sorted-inner-product 的逐句版）
FRAG.push(['dcmit-sorted-inner', '已排序向量內積：兩指標 O(L₁ + L₂)', async (tok) => {
  fresh([0, 6, 14], [0, 1.8, 0]);
  const D1 = [[3, 2], [4, 1], [6, 1], [8, 1], [9, 1]], D2 = [[2, 1], [3, 1], [6, 1], [7, 1], [8, 1]];
  const X = (i) => -4.4 + i * 2;
  await step(tok); // @2537.2 slowest: count_frequency, inner_product
  const t1 = no('最慢：count_frequency、inner_product', 0, 5.0, 0);
  say('profiler 說：接下來最慢的是', 'count_frequency 和 inner_product');
  await step(tok); // @2548.8 make inner product faster, wff slower
  const t2 = note('先讓 inner_product 變快；代價：word_frequencies_for_file 變慢', 0, 4.3, 0);
  say('先加速 inner_product', '代價是 word_frequencies_for_file 要多做事');
  await step(tok); // @2558.0 requires the words sorted
  const t3 = bub('前提：向量裡的字要排好序', 0, 3.6, 0);
  say('快很多的內積：前提是字已經排好');
  await step(tok); // @2583.5 words in file order → sorted
  const ws = ['the', 'fox', 'is', 'in', 'hat'];
  const wm = ws.map((w, i) => cube(w, DB, [1.0, 0.5, 0.8], -4 + i * 2, 0.25, 0, 1));
  await beat(tok, 400);
  [...ws].sort().forEach((w, p) => move(wm[ws.indexOf(w)], -4 + p * 2, 0.25, 0));
  say('現在的 L：照字在檔案裡出現的順序', '如果改成排好的順序…');
  await step(tok); // @2616.8 numbers instead of words
  remove(t1); remove(t2); remove(t3); wm.forEach((m) => fly(m));
  note('字換成編號：the = 字典第 50 個字 → 50', 0, 4.4, 0);
  say('字換成字典裡的編號', '數字比較好寫');
  await step(tok); // @2633.0 doc 1: 3 4 6 8 9
  const m1 = D1.map(([w, c], i) => cube(w + ':' + c, DB, [1.4, 0.6, 1], X(i), 0.3, -1.5, 1.5));
  tag('文件 1', 'ptr', -6.4, 0.3, -1.5);
  say('文件 1：字 3、4、6、8、9', '次數 2、1、1、1、1');
  await step(tok); // @2648.5 doc 2: 2 3 6 7 8
  const m2 = D2.map(([w, c], i) => cube(w + ':' + c, DP, [1.4, 0.6, 1], X(i), 0.3, 1.5, 1.5));
  tag('文件 2', 'ptr', -6.4, 0.3, 1.5);
  say('文件 2：字 2、3、6、7、8', '各出現一次');
  await step(tok); // @2673.5 old algorithm: find same word, multiply
  glow(m1[0], GOLD);
  const sc = pkt('找 3', X(0), 1.1, 1.5);
  await travel(tok, sc, V3(X(0), 1.1, 1.5), V3(X(1), 1.1, 1.5), 600);
  glow(m2[1], GOLD);
  const prod = note('2 × 1 = 2', X(1), 1.9, 0);
  say('舊做法：拿文件 1 的 3，到文件 2 找 3', '找到就把次數相乘：2 × 1');
  await step(tok); // @2713.2 step one won't get faster; lookup can
  remove(prod); glow(m1[0], null); glow(m2[1], null); remove(sc);
  note('① 走過每個元素：不會變快　② 在另一邊找：可以加速', 0, 3.6, 0);
  say('走過文件 1 的每一項，省不掉', '「在文件 2 找」這步可以加速');
  await step(tok); // @2727.5 sorted → binary search
  glow(m1[0], GOLD);
  const mid = tag('mid', 'ptr alt', X(2), 1.1, 1.5);
  for (const k of [2, 0, 1]) { move(mid, X(k), 1.1, 1.5); glow(m2[k], GOLD); await beat(tok, 450); glow(m2[k], null); }
  glow(m2[1], GREEN);
  say('文件 2 排好了：用 binary search 找 3');
  await step(tok); // @2751.4 L1 binary searches: L1 log L2 < L1 L2
  remove(mid); glow(m1[0], null); glow(m2[1], null);
  ok('L₁ 次 × log L₂：比 L₁L₂ 快', 0, 2.6, 0);
  say('每次 log L₂，做 L₁ 次', '已經比 L₁L₂ 快，值得排序');
  await step(tok); // @2766.3 class algorithm: L1 + L2
  ok('上課的做法更好：L₁ + L₂', 0, 2.0, 0);
  say('上課講的做法：只要 L₁ + L₂');
  await step(tok); // @2794.0 both sorted: 4 can't be before 3
  glow(m1[1], GOLD); tint(m2[0], GRAY); tint(m2[1], GRAY);
  say('兩邊都排好了', '在 3 找到之後，4 不可能出現在 3 前面');
  await step(tok); // @2827.0 a pointer remembers where we were
  tint(m2[0], DP); tint(m2[1], DP); glow(m1[1], null);
  const p1 = pkt('↑', X(0), 1.1, -1.5), p2 = pkt('↑', X(0), 1.1, 1.5);
  const sl = tag('內積 = 0', 'ptr alt', 5.6, 3.0, 0);
  say('用一個指標記住：上次看到哪裡');
  await step(tok); // @2839.6 3: look at 2 (smaller), then 3: found
  glow(m1[0], GOLD); glow(m2[0], GOLD); await beat(tok, 500); glow(m2[0], null);
  move(p2, X(1), 1.1, 1.5); glow(m2[1], GREEN); tint(m1[0], DG); tint(m2[1], DG); txt(sl, '內積 = 2');
  say('找 3：先看到 2（較小），再看到 3', '找到！2 × 1 = 2');
  await step(tok); // @2850.0 4: look at 6 > 4, stop, keep pointer
  glow(m1[0], null); glow(m2[1], null);
  move(p1, X(1), 1.1, -1.5); move(p2, X(2), 1.1, 1.5); glow(m1[1], GOLD); glow(m2[2], GOLD);
  say('找 4：看到 6 > 4', '後面不可能有 4 → 指標停在 6');
  await step(tok); // @2862.0 6 matches
  glow(m1[1], null);
  move(p1, X(2), 1.1, -1.5); glow(m1[2], GOLD); tint(m1[2], DG); tint(m2[2], DG); txt(sl, '內積 = 3');
  say('找 6：從 6 開始看，對上了', '1 × 1，累加');
  await step(tok); // @2872.0 8: 6 < 8, 7 < 8, 8 = 8
  glow(m1[2], null); glow(m2[2], null);
  move(p1, X(3), 1.1, -1.5); glow(m1[3], GOLD);
  move(p2, X(3), 1.1, 1.5); glow(m2[3], GOLD); await beat(tok, 500); glow(m2[3], null);
  move(p2, X(4), 1.1, 1.5); tint(m1[3], DG); tint(m2[4], DG); txt(sl, '內積 = 4');
  say('找 8：7 < 8，往下；8 = 8', '找到，再乘一次');
  await step(tok); // @2888.2 9: keep looking down, hit the end
  glow(m1[3], null); move(p1, X(4), 1.1, -1.5); glow(m1[4], GOLD);
  move(p2, X(4.8), 1.1, 1.5);
  say('找 9：往下走，走到底了');
  await step(tok); // @2905.0 the rest can't be there: stop
  glow(m1[4], null);
  ok('內積 = 4：指標只往下走 → O(L₁ + L₂)', 0, 4.4, 0);
  say('後面的都不可能在了：停', '兩個指標都只往前 → L₁ + L₂ 步');
}]);

// 48:40 為何兩指標不改 binary search；最壞 L₁ + L₂
FRAG.push(['dcmit-ptr-vs-bsearch', '兩指標 vs binary search：L₁ + L₂', async (tok) => {
  fresh([0, 6, 13], [0, 1.6, 0]);
  const X = (i) => -4.2 + i * 1.2;
  const LBL = [1, 2, 3, 4, 5, 6, 7, 'N'];
  await step(tok); // @2933.8 pointer goes down one at a time (+1)
  const bot = LBL.map((v, i) => cube(v, DP, [0.9, 0.55, 0.9], X(i), 0.3, 0.6));
  tag('L₂', 'ptr', -5.9, 0.3, 0.6);
  const p = pkt('↑', X(0), 1.0, 0.6);
  for (let i = 1; i < 4; i++) { move(p, X(i), 1.0, 0.6); await beat(tok, 350); }
  note('指標一次往下一格（+1）', X(2), 2.2, 0.6);
  say('指標一次只往下走一格', '直到找到，或走過頭就停');
  await step(tok); // @2950.4 why not binary search?
  const stu = buddy('同學', '為什麼不 binary search？', STU, 5.6, 0, -2.6, 0.6); stu.mood('wow');
  say('同學問：為什麼不用 binary search 找？');
  await step(tok); // @2960.2 one step at a time is optimal
  bub('一格一格走，才是最佳', -2.0, 3.0, -2); stu.set(''); // answered: the question bubble goes before list L₁ arrives beside it
  say('因為那樣分析就不快了', '一格一格走反而是最佳');
  await step(tok); // @2968.5 example: both lists 1 … 10,000
  move(p, X(0), 1.0, 0.6);
  const top = LBL.map((v, i) => cube(v, DB, [0.9, 0.55, 0.9], X(i), 0.3, -2, 1.2));
  tag('L₁', 'ptr', -5.9, 0.3, -2);
  note('N = 10,000', 5.6, 1.3, -0.7);
  say('例子：兩個串列都是 1, 2, …, 10,000');
  await step(tok); // @2982.7 binary search for 1, 2, 3 … each ≈ log N
  const c1 = tag('binary search：0 步', 'ptr', -3, 4.2, 0);
  let s = 0;
  for (let i = 0; i < 3; i++) {
    glow(top[i], GOLD);
    let lo = 0, hi = 7;
    while (lo <= hi) { const m = (lo + hi) >> 1; glow(bot[m], GOLD); s++; txt(c1, 'binary search：' + s + ' 步'); await beat(tok, 120); glow(bot[m], null); if (m === i) break; if (m < i) lo = m + 1; else hi = m - 1; }
    glow(top[i], null);
  }
  say('找 1：log N 步；找 2：又差不多 log N…', '每個都要 log N');
  await step(tok); // @3009.2 two pointers: 10,000 + 10,000
  const c2 = tag('兩指標：0 步', 'ptr alt', 3, 4.2, 0);
  const p1 = pkt('↑', X(0), 1.0, -2);
  let t = 0;
  for (let i = 0; i < 8; i++) { glow(top[i], GREEN); glow(bot[i], GREEN); t += 2; txt(c2, '兩指標：' + t + ' 步'); move(p1, X(Math.min(i + 1, 7.4)), 1.0, -2); move(p, X(Math.min(i + 1, 7.4)), 1.0, 0.6); await beat(tok, 220); }
  say('兩指標：10,000 + 10,000 步', '就算兩串完全一樣也只要 2N');
  await step(tok); // @3019.2 binary search: N log N
  txt(c1, 'binary search：≈ N log N');
  say('binary search 卻要 ≈ 10,000 × log 10,000');
  await step(tok); // @3029.7 bound: first half alone > (N/2) log(N/2)
  top.forEach((m, i) => { glow(m, i < 4 ? GOLD : null); }); bot.forEach((m) => glow(m, null));
  note('光前一半：> (N/2) · log(N/2)', -1.8, 2.0, -2);
  say('怎麼證明？只看前一半的 5,000 個', '每個都要 ≈ log(N/2) 步 → 已經 > (N/2) log(N/2)');
  await step(tok); // @3086.5 how many times does this pointer advance? L2
  top.forEach((m) => glow(m, null));
  stu.set('下面的指標：L₂ 次'); stu.mood('happy');
  say('下面的指標總共前進幾次？', '只往下走 → 最多 L₂ 次');
  await step(tok); // @3108.3 the other pointer: L1
  stu.set('上面的：L₁ 次');
  say('上面的指標：最多 L₁ 次');
  await step(tok); // @3177.4 worst case: short list's values at the end
  top.forEach((m, i) => { if (i < 5) fly(m, V3(-2, 6, -3)); else { relabel(m, i + 1); tint(m, DY); glow(m, null); } });
  bot.forEach((m) => glow(m, null));
  move(p, X(0), 1.0, 0.6);
  for (let i = 0; i < 8; i++) { move(p, X(i), 1.0, 0.6); await beat(tok, 200); }
  say('最壞：短串列的值都在長串列尾端', '下面的指標得走完整條');
  await step(tok); // @3184.0 worst case L1 + L2
  ok('最壞：L₁ + L₂', 0, 3.0, 0.6);
  say('所以上界是 O(L₁ + L₂)');
  await step(tok); // @3198.5 homework: insertion sort matches the textbook
  kill(stu.g);
  note('回家：對照課本讀 insertion sort 的程式，確認 N²', 0, 5.0, 0);
  say('回家：insertion sort 對照課本', '一行一行標成本，確認是 N²');
  await step(tok); // @3228.7 merge = this pointer trick
  ok('merge sort 的 merge = 這個兩指標技巧', 0, 5.7, 0);
  say('merge sort 的 merge 跟這個內積一模一樣', '就是這個指標魔法');
}]);

// ═════════════ L11：eCaXlAaN2uE ═════════════

// 00:37 動機：64 位元不夠
FRAG.push(['dcmit-bigint-why', '高精度：比 64 位元長得多的數', async (tok) => {
  fresh([0, 5, 12.5], [0, 2, 0]);
  await step(tok); // @45.0 irrationals, recreational math
  bub('今天：休閒數學 —— 無理數', 0, 5.6, 0);
  say('今天是輕鬆的「休閒數學」', '主題：無理數');
  await step(tok); // @57.8 numbers much longer than 64 bits
  const w = cube('8 bits', DB, [0.6, 0.7, 0.9], -4.2, 4.2, 0, 2);
  tag('一個機器字', 'ptr', -6.0, 4.9, 0);
  say('有時要算比 64 位元長得多的數', '64 位元 = 現在電腦一個字的長度');
  await step(tok); // @69.8 8 → 32 → 64 bits
  for (const [b, sx] of [[32, 1.4 / 0.6], [64, 2.4 / 0.6]]) { const s0 = w.scale.x; await anim(tok, 600, (u) => { w.scale.x = s0 + (sx - s0) * u; }); relabel(w, b + ' bits'); }
  say('以前 8 位元，後來 32，現在 64');
  await step(tok); // @83.0 64 bits ain't near enough
  no('64 位元根本不夠', -0.4, 4.2, 0);
  say('可是 64 位元遠遠不夠');
  await step(tok); // @96.8 high precision: ~100 decimal digits
  const row = cube('3.14159265358979323846264338327950288419716939937510…（100 位）', PAPER, [9.4, 0.5, 0.7], 0, 2.9, 0, 1.5);
  note('物理學家：100 位十進位精度', 4.0, 3.6, 0);
  say('高精度計算：例如 100 位十進位', '比 64 位元多太多');
  await step(tok); // @109.3 √2 to a million digits, π to 10 million
  kill(row);
  const d = cube('√2 到百萬位', DY, [2.6, 0.6, 0.9], -2.2, 2.9, 0, 1.5), p = cube('π 到千萬位', DY, [2.6, 0.6, 0.9], 1.8, 2.9, 0, 1.5);
  say('√2 算到百萬位、π 算到千萬位', '電腦要怎麼做？');
  await step(tok); // @123.0 this module: numerics, Newton's method
  glow(d, GOLD); glow(p, GOLD);
  ok("這個單元：Newton's method 算到任意精度", 0, 1.9, 0);
  say("這個單元：用 Newton's method", '把無理數算到任意精度');
  await step(tok); // @144.2 RSA: primes thousands of bits
  const lock = prop('lock', 5.4, 0, 1.6, 1.3); bob(lock, 0.05);
  for (let i = 0; i < 16; i++) cube('', i % 2 ? DB : SKY, [0.55, 0.45, 0.6], -5.0 + i * 0.58, 0.25, 1.6, 1.2);
  tag('1024 位元 = 16 個 64 位元字', 'idx', -0.6, 0.9, 1.6);
  say('作業：RSA 加密', '質數有上千位元');
  await step(tok); // @163.0 multiply and divide thousands of bits
  bub('上千位元的 × 和 ÷ 怎麼做？', 0, 1.1, 2.8);
  say('上千位元的數要怎麼乘、怎麼除？', '這就是這個單元要解決的');
}]);

// 02:58 Pythagoras：對角線與邊不可公度；√2 的位數
FRAG.push(['dcmit-sqrt2-diagonal', '√2：正方形的對角線', async (tok) => {
  fresh([0, 5, 12], [0, 2.4, 0]);
  const x0 = -5.4, y0 = 0.6, s = 3.0;
  await step(tok); // @178.0 irrationals
  bub('無理數', x0 + 1.5, 5.2, 0);
  say('先來談無理數');
  await step(tok); // @184.7 Pythagoras
  const py = buddy('Pythagoras', '', TEA, 4.8, 0, 1.4, 0.8);
  line(x0, y0, x0 + s, y0); line(x0 + s, y0, x0 + s, y0 + s); line(x0 + s, y0 + s, x0, y0 + s); line(x0, y0 + s, x0, y0);
  tag('1', 'idx', x0 + s / 2, y0 - 0.3, 0); tag('1', 'idx', x0 - 0.3, y0 + s / 2, 0);
  say('Pythagoras（畢達哥拉斯）', '邊長 1 的正方形');
  await step(tok); // @192.1 diagonal and side
  line(x0, y0, x0 + s, y0 + s, 0, '#d64545');
  tag('對角線', 'ptr alt', x0 + s / 2 + 0.5, y0 + s / 2 - 0.3, 0);
  say('他發現：正方形的對角線和邊…');
  await step(tok); // @199.4 incommensurable
  note('不可公度：找不到共同的量尺', x0 + 1.5, 4.4, 0);
  say('「不可公度」', '沒有一把尺能同時量盡兩者');
  await step(tok); // @202.9 ratio not a ratio of integers
  no('對角線 : 邊 = p : q ？ ✗', 0.4, 3.3, 0);
  say('比值不能寫成整數比', '也就是無理數 √2');
  await step(tok); // @211.6 Babylonians and Indians knew earlier
  note('巴比倫人、印度人更早就知道', 0.4, 2.6, 0);
  say('其實巴比倫人和印度人更早就知道', '但名字記在畢達哥拉斯身上');
  await step(tok); // @227.4 "all is number"
  py.set('萬物皆數'); py.mood('happy'); await py.hop(tok);
  say('他的哲學：萬物皆數');
  await step(tok); // @255.8 numbers = 1, 2, 3 …
  [1, 2, 3].forEach((v, i) => nb(v, 2.6 + i * 1.0, 3.2, DB, 0.55));
  py.mood('sad');
  say('他心中的「數」是 1、2、3…', '√2 寫不成這種數');
  await step(tok); // @268.0 "speechless"
  py.set('無以言說…');
  say('他把這個比值叫「無以言說」');
  await step(tok); // @278.6 a threat: measuring gives different answers
  const m = pkt('量：1.41', 0.4, 1.6, 1.2);
  await travel(tok, m, V3(0.4, 1.6, 1.2), V3(2.4, 1.6, 1.2), 500); txt(m, '再量：1.414');
  await travel(tok, m, V3(2.4, 1.6, 1.2), V3(4.0, 1.6, 1.2), 500); txt(m, '又是：1.4142…');
  say('信徒們視無理數為威脅', '每次量得更準，答案就又不一樣');
  await step(tok); // @304.8 they tried to find patterns
  remove(m);
  no('想找規律：沒找到', 2.6, 1.0, 1.2);
  say('他們拚命找規律', '當然沒找到');
  await step(tok); // @324.6 motivation: find patterns in irrationals
  ok('高精度的另一個動機：在位數裡找規律', 0, 5.9, 0);
  say('另一個高精度的動機', '算到幾百萬、幾兆位，說不定有規律？');
  const dg = ['1.414', '213', '562', '373', '095', '048', '…'];
  await step(tok); // @368.4 1.414
  cube(dg[0], DY, [1.3, 0.55, 0.8], -1.0, 1.6, 2.4, 1.5);
  say('√2 = 1.414…', '這大家都知道');
  await step(tok); // @372.2 213 562 373 095 048
  for (let q = 1; q < dg.length; q++) { cube(dg[q], PAPER, [0.9, 0.55, 0.8], -0.6 + q * 1.0, 1.6, 2.4, 1.5); await beat(tok, 280); }
  say('接下來 213 562 373 095 048…');
  await step(tok); // @385.4 no pattern
  py.set('看不出規律'); py.mood('sad');
  say('看不出規律', '只看到幾個 0');
  await step(tok); // @394.5 one program generates, another looks for patterns
  prop('monitor', -4.6, 0, 3.4, 0.6, '程式 1：產生 √2');
  prop('monitor', -2.2, 0, 3.4, 0.6, '程式 2：找規律');
  say('寫一個程式產生 √2', '再寫一個程式在裡面找規律');
}]);

// 06:57 Catalan：平衡括號字串集合 P 的兩條規則
FRAG.push(['dcmit-catalan-rules', 'Catalan：平衡括號的兩條規則', async (tok) => {
  fresh([0, 5, 12.5], [0, 2.6, 0]);
  const P = (s, x, y, c = PAPER, drop = 1) => s.split('').map((ch, i) => cube(ch, c, [0.5, 0.6, 0.6], x + i * 0.55, y, 0, drop));
  await step(tok); // @420.8 Catalan numbers: favorite
  const cat = buddy('Catalan 數', '♥', '#f2a7c3', 5.2, 0, 1.6, 0.8); cat.mood('happy');
  say('題外話：Catalan numbers', '老師最喜歡的數');
  await step(tok); // @433.4 show up all over the place
  await cat.hop(tok);
  bub('到處都會出現', 5.2, 2.6, 1.6);
  say('它們到處都會冒出來');
  await step(tok); // @451.0 cardinality of set P of balanced parentheses
  zone('P：平衡括號字串的集合', -1.2, 0, -1.2, 8.4, 2.2, MINT);
  say('看成：平衡括號字串的集合 P', 'Catalan 數 = P 有幾個元素');
  await step(tok); // @469.6 rule 1: λ ∈ P
  tag('規則 1：λ ∈ P（空字串）', 'ptr', -3.2, 6.3, 0);
  const e = cube('λ', MINT, [0.6, 0.6, 0.6], -4.8, 0.3, -1.2, 1.5);
  say('規則 1：空字串 λ 在 P 裡');
  await step(tok); // @494.7 rule 2: (α)β
  tag('規則 2：α, β ∈ P ⇒ (α)β ∈ P', 'ptr alt', 2.4, 6.3, 0);
  const tpl = P('(α)β', -1.2, 4.9, LILAC, 1);
  say('規則 2：α、β 都在 P 裡', '就把 α 用括號包起來，後面接 β');
  await step(tok); // @510.2 apply over and over
  note('反覆套用 → 越來越多平衡字串', -1.0, 5.6, 0);
  say('一直重複套用規則', '就會產生越來越多平衡字串');
  await step(tok); // @516.8 balanced vs not balanced
  const good = P('(())', -1.6, 3.6, MINT); good.forEach((m) => glow(m, GREEN));
  const bad1 = P(')(', 1.4, 3.6, '#f2c5c5'), bad2 = P('(()', 3.0, 3.6, '#f2c5c5');
  bad1.concat(bad2).forEach((m) => glow(m, RED));
  say('(()) 平衡；)( 和 (() 不平衡', '不平衡的永遠產生不出來');
  await step(tok); // @538.8 unique (α, β) pair
  bad1.concat(bad2, good).forEach((m) => fly(m));
  ok('每個非空平衡字串：恰好一組 (α, β)', 0, 2.6, 0);
  say('好性質：每個非空平衡字串', '都由唯一一組 (α, β) 用規則 2 產生');
  await step(tok); // @570.2 example (())()
  tpl.forEach((m) => kill(m));
  const s = P('(())()', -1.6, 4.0, PAPER);
  say('例子：(())()', '比剛才的都複雜一點');
  await step(tok); // @580.2 α inside brackets, β after
  [1, 2].forEach((i) => tint(s[i], DB)); [4, 5].forEach((i) => tint(s[i], DO));
  [0, 3].forEach((i) => glow(s[i], GOLD));
  tag('α = ()', 'ptr', -0.7, 3.1, 0.4); tag('β = ()', 'ptr', 1.4, 3.1, 0.4);
  say('α = ()，外面包一層括號', '後面接 β = ()');
  await step(tok); // @599.0 α, β generated before
  note('α、β 都是之前產生過的', 3.6, 4.6, 0);
  say('α 和 β 都是先前產生過的字串');
  await step(tok); // @603.0 α = β = λ → ()
  const pp = P('()', -5.2, 1.5, MINT);
  glow(e, GOLD);
  tag('α = β = λ', 'idx', -4.9, 0.9, 0.4);
  say('α = β = λ 套規則 2', '得到 ()');
  await step(tok); // @613.2 α = λ, β = () → ()()
  glow(e, null);
  P('()()', -2.6, 1.5, MINT);
  tag('α = λ、β = ()', 'idx', -1.9, 0.9, 0.4);
  say('α = λ、β = () → ()()', '就這樣一直做下去');
  await step(tok); // @624.5 strings longer, set larger: Catalan numbers
  cat.set('|P| 越來越大'); await cat.hop(tok);
  say('字串越來越長，集合越來越大', '它的大小就是 Catalan 數');
  await step(tok); // @640.8 enumerate: an analytical form?
  bub('問題：數得出來嗎？有公式嗎？', 0, 6.9, 0);
  say('不簡單的問題：怎麼算出集合有多大？');
}]);

// 10:55 Catalan 遞迴：C₀ = 1、C₂ = C₀C₁ + C₁C₀、C_{n+1} = Σ C_k C_{n−k}
FRAG.push(['dcmit-catalan-recur', 'Catalan 遞迴：C_{n+1} = Σ C_k C_{n−k}', async (tok) => {
  fresh([0, 5, 13], [0, 2.8, 0]);
  await step(tok); // @655.0 C_n = # strings with n pairs
  tag('C_n = 恰有 n 對括號的平衡字串個數', 'ptr', 0, 6.6, 0);
  say('C_n：恰好 n 對括號的平衡字串有幾個');
  await step(tok); // @682.0 C0 = 1
  const r0 = dBox('C₀ = 1：λ', -4.6, 5.6, 0, 2.4, MINT, 1);
  say('C₀ = 1：空字串也算一個', 'base case');
  await step(tok); // @697.0 want an equation for C_{n+1}
  const q = bub('C_{n+1} 怎麼用比較小的 C 算？', 2.6, 5.6, 0);
  say('想要 C_{n+1} 的式子', '用之前產生過的字串，唯一地組出來');
  await step(tok); // @774.0 C1 = 1
  dBox('C₁ = 1：()', -4.6, 4.9, 0, 2.4, MINT, 1);
  say('C₁ = 1', '只有 () 一種');
  await step(tok); // @792.3 C2 in terms of C0, C1?
  const stu = buddy('同學', 'C₀ + C₁？', STU, 5.6, 0, 1.8, 0.6); stu.mood('wow');
  say('C₂ 怎麼用 C₀、C₁ 表示？', '同學猜 C₀ + C₁：數字對，式子不對');
  await step(tok); // @860.4 C2 = C0C1 + C1C0
  remove(q);
  stu.set('C₀C₁ + C₁C₀'); stu.mood('happy'); await stu.hop(tok);
  tag('C₂ = C₀C₁ + C₁C₀', 'ptr alt', 2.4, 5.6, 0);
  say('C₂ = C₀C₁ + C₁C₀');
  await step(tok); // @867.0 choose α, then β
  cube('α = λ、β = () → ()()', PAPER, [3.4, 0.5, 0.7], 2.4, 4.8, 0, 1);
  cube('α = ()、β = λ → (())', PAPER, [3.4, 0.5, 0.7], 2.4, 4.1, 0, 1);
  say('先選 α，再選 β', 'α 可以是 λ 或 ()：兩種');
  await step(tok); // @896.6 the number is 2
  ok('C₂ = 2', 5.2, 4.45, 0);
  say('答案都是 2', '但這個式子才是對的');
  await step(tok); // @949.0 general: Σ C_k C_{n-k}
  kill(stu.g);
  tag('C_{n+1} = Σ_{k=0..n} C_k · C_{n−k}（n ≥ 0）', 'ptr', 0, 3.3, 0);
  say('一般式：α 有 k 對、β 有 n − k 對', 'C_{n+1} = Σ C_k C_{n−k}');
  await step(tok); // @992.0 the Catalan numbers on the board
  const Cs = [1, 1, 2, 5, 14, 42, 132, 429, 1430, 4862], bars = [];
  for (let n = 0; n < Cs.length; n++) {
    const x = -5.4 + n * 1.2, h = 0.3 + Math.log10(Cs[n]) * 0.6;
    const b = dBar(n === 5 || n === 9 ? DY : DB, x, 1.4, 0.7); bars.push(b);
    dSetBar(b, h);
    tag(String(Cs[n]), 'idx', x, h + 0.3, 1.4); tag('C' + n, 'idx', x, 0.02, 2.2);
    await beat(tok, 150);
  }
  say('板書上的 Catalan 數', '1, 1, 2, 5, 14, 42, 132, 429, 1430, 4862');
  await step(tok); // @1014.0 license plate 4862
  glow(bars[9], GOLD);
  const plate = cube('4862', '#f5f1e6', [1.6, 0.8, 0.12], 5.2, 3.4, 1.4); glow(plate, GOLD);
  say('看到車牌 4862', '轉頭跟爸媽說：那是 C₉！');
  await step(tok); // @1033.8 bumper sticker C17
  note('C₁₇ = 129,644,790：做成保險桿貼紙', 3.4, 4.6, 1.4);
  say('C₁₇ 太長上不了車牌', '可以做成保險桿貼紙');
  await step(tok); // @1047.0 42 is on the list
  glow(bars[5], GOLD);
  ok('42 也在！（C₅）', -0.6, 2.4, 1.4);
  say('42 也在名單上', '42 是所有問題的答案（笑）');
}]);

// 18:16 Newton 法：切線 y = f(xᵢ) + f′(xᵢ)(x − xᵢ)，f(x) = x² − a
FRAG.push(['dcmit-newton-tangent', 'Newton 法：沿切線走到 x 軸', async (tok) => {
  fresh([0, 3.6, 12.5], [0, 2.8, 0]);
  const X = (x) => -5 + x * 4.4, Y = (y) => 2.8 + y * 1.0, f = (x) => x * x - 2;
  await step(tok); // @1096.3 Newton's method
  bub("回到無理數：Newton's method", -1.0, 6.9, 0);
  say("回到 √2：用 Newton's method");
  await step(tok); // @1116.6 y = f(x), axes
  line(X(0), Y(0), X(2.25), Y(0), 0, '#6e5f49'); tag('x', 'idx', X(2.3), Y(0), 0);
  line(X(0), Y(-2.1), X(0), Y(3.2), 0, '#6e5f49'); tag('y', 'idx', X(0), Y(3.4), 0);
  say('有一個函數 y = f(x)', '橫軸 x、縱軸 y');
  await step(tok); // @1128.0 root of f(x) = 0 by successive approximation
  note('目標：f(x) = 0 的根（一步步逼近）', 3.0, 5.8, 0);
  say('目標：找 f(x) = 0 的根', '用逐步逼近');
  await step(tok); // @1150.7 f(x) = x² − a
  for (let k = 0; k < 24; k++) { const a = 0.05 + k * 0.09, b = a + 0.09; line(X(a), Y(f(a)), X(b), Y(f(b)), 0, '#d64545'); await beat(tok, 40); }
  tag('f(x) = x² − a', 'ptr', X(1.9), Y(f(2.1)) + 0.4, 0);
  say('例：f(x) = x² − a');
  await step(tok); // @1158.1 a = 2 → root √2
  const r = cube('', DG, [0.22, 0.22, 0.22], X(Math.SQRT2), Y(0), 0); glow(r, GREEN);
  tag('√2', 'ptr alt', X(Math.SQRT2), Y(0) - 0.45, 0);
  say('a = 2：根就是 √2', '（另一個是 −√2）');
  await step(tok); // @1177.4 geometrically: tangents
  note('做法：一直畫切線', 3.0, 5.2, 0);
  say('幾何上：Newton 法就是一直畫切線');
  await step(tok); // @1197.0 x_i
  const dot = cube('', DY, [0.25, 0.25, 0.25], X(1), Y(f(1)), 0);
  tag('xᵢ', 'ptr alt', X(1), Y(0) + 0.35, 0);
  line(X(1), Y(0), X(1), Y(f(1)), 0, '#a99470');
  say('目前猜到 xᵢ', '在曲線上找到 (xᵢ, f(xᵢ))');
  await step(tok); // @1208.5 tangent → x-intercept = x_{i+1}
  const t0 = 0.85, t1 = 1.75;
  line(X(t0), Y(f(1) + 2 * (t0 - 1)), X(t1), Y(f(1) + 2 * (t1 - 1)), 0, '#1f3a6e');
  await anim(tok, 900, (t) => dot.position.set(X(1 + 0.5 * t), Y(f(1) * (1 - t)), 0));
  tag('xᵢ₊₁', 'ptr alt', X(1.5), Y(0) - 0.45, 0);
  say('沿切線滑到 x 軸', '交點就是下一個 xᵢ₊₁');
  await step(tok); // @1225.4 tangent equation? derivative
  const stu = buddy('同學', '導數！', STU, 5.6, 0, 1.4, 0.6); stu.mood('happy');
  say('切線方程式怎麼寫？', '要用導數（derivative）');
  await step(tok); // @1341.0 y = f(xi) + f′(xi)(x − xi)
  ok('切線：y = f(xᵢ) + f′(xᵢ)(x − xᵢ)', 2.2, 6.7, 0);
  say('切線：y = f(xᵢ) + f′(xᵢ)(x − xᵢ)', 'f′(xᵢ) 是 xᵢ 那點的斜率');
  await step(tok); // @1365.0 x_{i+1} = xi − f(xi)/f′(xi)
  kill(stu.g);
  const fm = tag('xᵢ₊₁ = xᵢ − f(xᵢ) / f′(xᵢ)', 'ptr', 3.4, 4.4, 0);
  say('令 y = 0 解出 x', 'xᵢ₊₁ = xᵢ − f(xᵢ)/f′(xᵢ)');
  await step(tok); // @1386.0 plug f = x² − a
  txt(fm, 'xᵢ₊₁ = xᵢ − (xᵢ² − a) / (2xᵢ)');
  say('f(x) = x² − a、f′(x) = 2x 代進去');
  await step(tok); // @1411.7 (xi + a/xi)/2
  txt(fm, 'xᵢ₊₁ = (xᵢ + a/xᵢ) / 2');
  glow(dot, GOLD);
  say('化簡：xᵢ₊₁ = (xᵢ + a/xᵢ)/2', '很直接');
  await step(tok); // @1426.0 but a division is needed
  no('a/xᵢ：要做除法！', 3.4, 3.6, 0);
  say('a 很小（例如 2）', '可是 a/xᵢ 要做除法');
  await step(tok); // @1440.7 x_i have millions of digits
  cube('xᵢ = 1.41421356237309504880168872420969807856967187537694…', PAPER, [9.0, 0.45, 0.6], 0, 0.3, 1.6, 1.2);
  say('xᵢ 可能有上百萬位', '百萬位的除法怎麼做？');
}]);

// 24:11 Newton 求 √2：正確位數每次翻倍（原 newton-sqrt-error 的逐句版）
FRAG.push(['dcmit-newton-digits', 'Newton 求 √2：正確位數每次翻倍', async (tok) => {
  fresh([0, 5, 13.5], [0, 3.0, 0]);
  const xs = [1, 1.5, 17 / 12, 577 / 408, 665857 / 470832];
  const str = ['1.000000000', '1.500000000', '1.416666666', '1.414215686', '1.414213562'];
  const good = [1, 1, 3, 6, 10];   // leading digits that agree with √2 = 1.414213562
  const RY = (i) => 6.2 - i * 0.9;
  const rows = [];
  const row = (i) => {
    tag('x' + '₀₁₂₃₄'[i], 'ptr', -6.2, RY(i), 0);
    const cs = str[i].split('').map((c, k) => cube(c, k < good[i] + (good[i] > 1 ? 1 : 0) ? MINT : PAPER, [0.42, 0.45, 0.5], -5.2 + k * 0.46, RY(i), 0, 1));
    rows.push(cs);
  };
  await step(tok); // @1451.4 simulate Newton on a = 2
  tag('xᵢ₊₁ = (xᵢ + 2/xᵢ) / 2', 'ptr alt', 3.2, 7.2, 0);
  say('a = 2：模擬 Newton 迭代', '先不管怎麼實作');
  await step(tok); // @1473.0 x0 = 1.000…
  row(0);
  say('x₀ = 1，後面一堆 0');
  await step(tok); // @1479.7 x1 = 1.5
  row(1);
  say('x₁ = 1.5');
  await step(tok); // @1487.1 x2 = 1.41666…
  row(2);
  say('x₂ = 1.41666…');
  await step(tok); // @1506.0 d digits of precision, d maybe a million
  note('其實每個 x 都是 d 位的整數（d 可以是百萬）', 2.6, 1.6, 1);
  say('不是分數：是固定 d 位精度的數', 'd 可能是一百萬');
  await step(tok); // @1530.1 x3 = 1.414215686
  row(3);
  say('下一個：1.414215686');
  await step(tok); // @1542.5 x4 = 1.414213562
  row(4);
  say('再下一個：1.414213562', '和 √2 前 10 位一樣了');
  await step(tok); // @1554.3 quadratic convergence
  ok('quadratic convergence（二次收斂）', 3.2, 6.2, 0);
  say('Newton 法：二次收斂');
  await step(tok); // @1573.5 linear = one extra digit per iteration
  note('線性收斂：每次只多 1 位', 3.2, 5.4, 0);
  say('線性收斂：每迭代一次多一位');
  await step(tok); // @1595.7 correct digits double
  const bars = good.map((g, i) => { const b = hBar(DG, 0.4, RY(i), 0.9); return [b, g]; });
  await anim(tok, 900, (u) => bars.forEach(([b, g]) => hSet(b, g * 0.32 * u)));
  say('二次收斂：正確位數每次約翻倍', '綠條 = 對的位數');
  await step(tok); // @1612.0 1 digit … 8 digits
  note('1 位 → 3 位 → 6 位 → 10 位…', 3.2, 4.6, 0);
  say('從約 1 位，到 4 位、8 位…', '越來越快');
  await step(tok); // @1659.8 only a logarithmic number of iterations
  ok('d 位精度只要約 log d 次迭代', 3.2, 1.0, 1);
  say('算到百萬位也不可怕', '只要對數次迭代');
  await step(tok); // @1665.8 2, 4, 8, 16: geometric
  const dbl = pkt('2', -3, 0.3, 2.2);
  for (const v of ['4', '8', '16', '…']) { await travel(tok, dbl, dbl.position.clone(), V3(dbl.position.x + 1.4, 0.3, 2.2), 380); txt(dbl, v); }
  say('2、4、8、16…', '等比級數幫了大忙');
}]);

// 28:01 a/xᵢ 需要除法 → 先做乘法；精度用整數 ⌊10^d √2⌋
FRAG.push(['dcmit-int-precision', '除法靠乘法；精度用整數表示', async (tok) => {
  fresh([0, 5, 12.5], [0, 2.4, 0]);
  await step(tok); // @1681.2 the important part: a/xi
  const tgt = tag('xᵢ₊₁ = (xᵢ + a/xᵢ) / 2', 'ptr', 0, 6.6, 0);
  no('最關鍵：a/xᵢ 怎麼算？', 0, 5.9, 0);
  say('最重要的一步：a/xᵢ 還沒講怎麼算');
  await step(tok); // @1687.1 additions: just one carry
  const n1 = '7 5 8 2 9 4 6'.split(' '), n2 = '3 4 1 7 0 5 8'.split(' ');
  n1.forEach((c, i) => cube(c, DB, [0.45, 0.45, 0.5], -5.6 + i * 0.5, 4.8, 0));
  n2.forEach((c, i) => cube(c, DB, [0.45, 0.45, 0.5], -5.6 + i * 0.5, 4.2, 0));
  const carry = pkt('進位', -2.6, 5.4, 0);
  await travel(tok, carry, V3(-2.6, 5.4, 0), V3(-5.6, 5.4, 0), 1400);
  ok('加法：Θ(n)', -4.1, 3.5, 0);
  say('這邊其實只有加法', '長數字加法只要處理進位 → Θ(n)');
  await step(tok); // @1703.0 multiplying hundreds of digits by hand?
  remove(carry);
  const me = buddy('手算的我', '× ?', STU, 4.6, 0, 1.6, 0.7); me.mood('wow');
  dBox('乘法：百位數 × 百位數', 1.2, 4.8, 0, 3.6, PAPER, 1);
  say('百位數乘百位數，你手算過嗎？', '太痛苦 → 要靠電腦');
  await step(tok); // @1727.0 divide 100-digit by 50-digit
  dBox('除法：100 位 ÷ 50 位', 1.2, 4.1, 0, 3.6, PAPER, 1);
  me.set('÷ ??'); me.mood('sad');
  say('100 位除以 50 位？更不可能');
  await step(tok); // @1745.6 next: high precision multiplication
  bub('先搞定：高精度乘法', 1.2, 3.3, 0);
  say('所以先只做高精度乘法');
  await step(tok); // @1754.0 reciprocal times a
  const rc = dBox('a/xᵢ = a × (1/xᵢ)', -3.0, 2.2, 0, 3.4, DY, 1);
  say('除法的做法：先求倒數 1/xᵢ', '再乘上 a');
  await step(tok); // @1774.0 division uses multiplication as a subroutine
  note('實用的除法演算法：都拿乘法當子程序', 1.6, 2.2, 0);
  say('實際的除法演算法', '都把乘法當子程序 → 先學乘法');
  await step(tok); // @1825.0 vanilla n-bit multiplication: n²
  me.set('n²'); me.mood('calm');
  const cost = tag('一般乘法：n 位 → Θ(n²)', 'ptr alt', -3.0, 1.2, 0);
  say('一般的 n 位乘法：n²');
  await step(tok); // @1834.0 FFT does better (6.046)
  note('更快：FFT（6.046 才教）', 1.6, 1.2, 0);
  say('可以更快，例如 FFT', '那是 6.046 的內容');
  await step(tok); // @1845.4 today: one algorithm better than n²
  ok('今天：一個比 n² 好的演算法', 1.6, 0.5, 0);
  say('今天會教一個比 n² 好的');
  await step(tok); // @1869.2 we know digits of precision up front
  [tgt].forEach(remove);
  const dT = tag('事先知道精度 d', 'ptr', -3.4, 6.6, 0);
  say('006 裡假設事先知道要幾位精度 d');
  await step(tok); // @1882.5 d = 42, 125, RSA 1024 / 2048
  txt(dT, '事先知道 d：42？125？RSA 1024、2048 位元');
  say('d 可能是 42、125', 'RSA 作業是 1024 或 2048 位元');
  await step(tok); // @1903.1 integer ⌊10^d √2⌋
  kill(me.g); // the hand-calculator is done; the digits take its place
  const digs = '1414213562'.split('').map((c, i) => cube(c, DB, [0.42, 0.42, 0.5], 2.2 + i * 0.46, 0.25, 1.8, 1));
  tag('d = 9：⌊10⁹ · √2⌋ = 1414213562', 'ptr alt', 4.3, 1.0, 1.8);
  say('要的是整數 ⌊10^d · √2⌋', '小數點往右移 d 位，再取整');
  await step(tok); // @1908.5 = ⌊√(2·10^(2d))⌋
  tag('= ⌊√(2 · 10^(2d))⌋', 'ptr', 4.3, 1.6, 1.8);
  say('等於 ⌊√(2 · 10^(2d))⌋');
  await step(tok); // @1919.0 all integers, Newton works on integers
  digs.forEach((m) => tint(m, DG));
  ok('全部當整數：不用管小數點，Newton 照用', 0, 7.3, 0);
  say('全部都是整數', '不用管小數點，Newton 法一樣能用');
}]);

// 33:08 分治：x = x₁·r^(n/2) + x₀；4 次 n/2 位乘法 → Θ(n²)
FRAG.push(['dcmit-split-4mult', '大數乘法：拆半要 4 次乘法', async (tok) => {
  fresh([0, 5, 13], [0, 2.8, 0]);
  await step(tok); // @1988.6 two n-digit numbers
  const xb = cube('x（n 位）', DB, [3.2, 0.6, 0.8], -3.8, 6, 0, 1), yb = cube('y（n 位）', DP, [3.2, 0.6, 0.8], -3.8, 5.1, 0, 1);
  say('兩個 n 位數 x、y');
  await step(tok); // @2002.4 radix r, 0 ≤ x, y < r^n
  note('基底 r（2 或 10 都行）：0 ≤ x, y < rⁿ', -3.8, 6.8, 0);
  say('基底 r 可以是 2、10', '0 ≤ x, y < rⁿ');
  await step(tok); // @2026.8 divide and conquer: n/2-digit multiplications
  bub('分治：拆成 n/2 位數的乘法', 2.6, 6.6, 0);
  say('用最愛的 divide and conquer', '拆成 n/2 位數的乘法');
  await step(tok); // @2040.8 down to 64 bits: one machine instruction
  const cpu = prop('cpu', 5.2, 0, 1.6, 1.0, '64 位元 × 64 位元：一個指令'); bob(cpu, 0.05);
  say('拆到 64 位元就停', '機器一個指令就算好（結果 128 位元）');
  await step(tok); // @2064.8 x = x1 r^(n/2) + x0
  kill(xb);
  const x1 = cube('x₁', DB, [1.6, 0.6, 0.8], -4.6, 6, 0), x0 = cube('x₀', SKY, [1.6, 0.6, 0.8], -3.0, 6, 0);
  tag('x', 'ptr', -6, 6, 0); tag('高半', 'idx', -4.6, 6.5, 0.4); tag('低半', 'idx', -3, 6.5, 0.4);
  const fx = tag('x = x₁ · r^(n/2) + x₀', 'ptr alt', 2.6, 5.8, 0);
  say('x 切兩半：x₁ 是高半、x₀ 是低半', 'x = x₁ · r^(n/2) + x₀');
  await step(tok); // @2081.2 same for y
  kill(yb);
  const y1 = cube('y₁', DP, [1.6, 0.6, 0.8], -4.6, 5.1, 0), y0 = cube('y₀', LILAC, [1.6, 0.6, 0.8], -3.0, 5.1, 0);
  tag('y', 'ptr', -6, 5.1, 0);
  txt(fx, 'y = y₁ · r^(n/2) + y₀　（每半 n/2 位）');
  say('y 也一樣', '每一半只有 n/2 位');
  const cnt = tag('乘法 0 次', 'ptr alt', 4.6, 4.4, 0);
  const pr = (a, b, t, q) => { glow(a, GOLD); glow(b, GOLD); cube(t, DO, [2.2, 0.5, 0.8], 1.6, 4.4 - q * 0.65, 0, 1.2); txt(cnt, '乘法 ' + (q + 1) + ' 次'); };
  const off = (...ms) => ms.forEach((m) => glow(m, null));
  await step(tok); // @2130.3 recursive multiply: z0 = x0 y0
  pr(x0, y0, 'z₀ = x₀y₀', 0);
  say('遞迴乘法：z₀ = x₀ · y₀');
  await step(tok); // @2150.0 z2 = x1 y1, z1 = x0y1 + x1y0
  off(x0, y0); pr(x1, y1, 'z₂ = x₁y₁', 1); await beat(tok, 700); off(x1, y1);
  pr(x0, y1, 'x₀y₁', 2); await beat(tok, 500); off(x0, y1);
  pr(x1, y0, 'x₁y₀', 3); await beat(tok, 500); off(x1, y0);
  note('z₁ = x₀y₁ + x₁y₀', 4.6, 3.1, 0);
  say('z₂ = x₁y₁（老師口誤說 x₂y₂）', 'z₁ = x₀y₁ + x₁y₀');
  await step(tok); // @2172.3 xy = z2 r^n + z1 r^(n/2) + z0
  tag('rⁿ', 'idx', -4, 1.8, 0); tag('r^(n/2)', 'idx', -1.5, 1.8, 0); tag('1', 'idx', 1, 1.8, 0);
  cube('z₂', DO, [2.2, 0.5, 0.8], -4, 1.1, 0, 1.5); cube('z₁', DO, [2.2, 0.5, 0.8], -1.5, 0.6, 0, 1.5); cube('z₀', DO, [2.2, 0.5, 0.8], 1, 0.3, 0, 1.5);
  tag('xy = z₂ · rⁿ + z₁ · r^(n/2) + z₀', 'ptr', 0, 2.5, 0);
  say('xy = z₂ · rⁿ + z₁ · r^(n/2) + z₀', '移位後相加');
  await step(tok); // @2202.5 four multiplications
  no('4 次 n/2 位乘法', 4.6, 5.1, 0);
  say('數一數：1、2、3、4', '要 4 次 n/2 位的乘法');
  await step(tok); // @2231.0 T(n) = 4T(n/2) + Θ(n)
  tag('T(n) = 4T(n/2) + Θ(n)', 'ptr alt', 4.2, 1.2, 1);
  say('T(n) = 4T(n/2) + Θ(n)', '加法是線性時間');
  await step(tok); // @2268.4 theta n²: not happy
  no('= Θ(n²)：沒變快！', 4.2, 0.5, 1);
  say('解出來還是 Θ(n²)', '跟手算一樣，不滿意');
}]);

// 38:03 Karatsuba：z₁ = (x₀ + x₁)(y₀ + y₁) − z₀ − z₂ → 3 次乘法
FRAG.push(['dcmit-karatsuba-3', 'Karatsuba：3 次乘法 n^(lg 3)', async (tok) => {
  fresh([0, 5, 13], [0, 2.8, 0]);
  await step(tok); // @2283.1 ways of doing better
  bub('想比 Θ(n²) 更好', 0, 6.9, 0);
  say('怎麼做得更好？方法很多');
  await step(tok); // @2287.0 Karatsuba
  const ka = buddy('Karatsuba', '', TEA, 5.4, 0, 1.4, 0.8); ka.mood('happy');
  say('最簡單、又降很多的：Karatsuba');
  const cnt = tag('乘法 0 次', 'ptr alt', 4.6, 6.2, 0);
  await step(tok); // @2322.1 z0 = x0 y0
  const z0 = cube('z₀ = x₀y₀', DO, [2.4, 0.5, 0.8], -4, 5.6, 0, 1.2); txt(cnt, '乘法 1 次');
  say('先乘：z₀ = x₀ · y₀');
  await step(tok); // @2326.6 z2 = x1 y1
  const z2 = cube('z₂ = x₁y₁', DO, [2.4, 0.5, 0.8], -4, 4.9, 0, 1.2); txt(cnt, '乘法 2 次');
  say('再乘：z₂ = x₁ · y₁');
  await step(tok); // @2333.8 z1 = (x0 + x1)(y0 + y1) − z0 − z2
  cube('(x₀ + x₁)(y₀ + y₁)', DY, [3.4, 0.5, 0.8], 1.2, 5.25, 0, 1.2); txt(cnt, '乘法 3 次');
  glow(z0, RED); glow(z2, RED);
  const z1 = cube('z₁ = (x₀+x₁)(y₀+y₁) − z₀ − z₂', DG, [5.6, 0.5, 0.8], -0.6, 3.8, 0, 1.5);
  say('z₁ = (x₀ + x₁)(y₀ + y₁) − z₀ − z₂', '展開：x₀y₀ + x₀y₁ + x₁y₀ + x₁y₁，減掉頭尾');
  await step(tok); // @2345.1 compute z0, z2 first, then use them
  glow(z0, null); glow(z2, null); glow(z1, GREEN);
  note('z₀、z₂ 先算好，再拿來湊 z₁', -0.6, 3.1, 0.4);
  say('先算 z₀、z₂', '再用它們湊出 z₁');
  await step(tok); // @2391.8 n^(log2 3)
  const stu = buddy('同學', 'n^(log₂3)', STU, -5.6, 0, 1.4, 0.6); stu.mood('happy'); await stu.hop(tok);
  say('為什麼更快？同學答：n^(log₂ 3)');
  await step(tok); // @2401.0 only 3 multiplications, additions are easy
  ok('只做 3 次乘法（不是 4 次）；加減法便宜', -0.4, 2.4, 0);
  say('關鍵：乘法只做 3 次', '加減法是線性時間，很便宜');
  await step(tok); // @2415.7 T(n) = 3T(n/2) + Θ(n)
  tag('T(n) = 3T(n/2) + Θ(n)', 'ptr', -0.4, 1.7, 0);
  say('T(n) = 3T(n/2) + Θ(n)');
  await step(tok); // @2443.7 theta n^(log2 3) ≈ n^1.58
  const b4 = dBar(DR, 2.6, 2.2, 0.8), b3 = dBar(DG, 4.0, 2.2, 0.8);
  tag('4 次：n²', 'idx', 2.6, 0.02, 3.0); tag('3 次：n^1.58', 'idx', 4.0, 0.02, 3.0);
  await anim(tok, 800, (t) => { dSetBar(b4, 2 * 1.1 * t); dSetBar(b3, 1.585 * 1.1 * t); });
  ka.mood('wow'); await ka.hop(tok);
  say('= Θ(n^(log₂ 3)) ≈ Θ(n^1.58)', '比 n² 小');
  await step(tok); // @2479.0 1.5849… also irrational
  note('log₂3 = 1.58496…（也是無理數！）', -0.4, 1.0, 0.6);
  say('log₂ 3 = 1.58496…', '它自己也是無理數');
  await step(tok); // @2504.5 split into thirds
  kill(stu.g);
  ['x 的上 1/3', '中 1/3', '下 1/3'].forEach((t, i) => cube(t, [DB, SKY, '#a9cff2'][i], [1.6, 0.5, 0.7], -4.4 + i * 1.7, 0.3, 2.6, 1.2));
  say('下回預告：拆成三段呢？', '上、中、下三分之一');
  await step(tok); // @2522.2 the original would take 9 multiplications
  bub('直接做要 3 × 3 = 9 次：能更少，指數就更小', -2.7, 1.2, 2.6);
  say('直接乘要 9 次（老師口誤說 8）', '能用更少次，1.58 還能再降');
}]);

// 42:14 Demo：半徑 5×10¹¹ 的大圓，AD = R − √(R² − 1) 的位數裡藏著 Catalan 數
FRAG.push(['dcmit-catalan-circle', 'Demo：大圓裡的 Catalan 數', async (tok) => {
  fresh([0, 4, 13], [0, 3, 0]);
  const cx = -3.2, cy = 3.5, r = 3;
  const bx = cx + 1.2, by = cy - Math.sqrt(r * r - 1.44);
  await step(tok); // @2534.2 demo of Victor's code
  const mon = prop('monitor', 4.6, 0, -1.2, 1.0, 'Victor 的程式：算到上千位'); bob(mon, 0.04);
  say('Demo：一個無理數算到上千位', '助教 Victor 寫的程式');
  await step(tok); // @2574.3 high school geometry
  bub('複習高中幾何', cx, 7.2, 0);
  say('√2 太無聊了：來點高中幾何');
  await step(tok); // @2589.2 a circle
  for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2, b = (k + 1) / 48 * Math.PI * 2; line(cx + r * Math.cos(a), cy + r * Math.sin(a), cx + r * Math.cos(b), cy + r * Math.sin(b), 0, '#6e5f49'); if (k % 4 === 3) await beat(tok, 60); }
  say('畫一個圓');
  await step(tok); // @2597.0 a trillion units
  note('超大的圓：直徑一兆單位', cx, 0.0, 0.6);
  say('這個圓超級大', '直徑一兆單位');
  await step(tok); // @2607.4 center C
  tag('C', 'ptr', cx - 0.3, cy, 0);
  say('圓心叫 C');
  await step(tok); // @2615.2 radii: B and A
  line(cx, cy, cx, cy - r, 0, '#1f3a6e'); line(cx, cy, bx, by, 0, '#1f3a6e');
  tag('A', 'ptr', cx - 0.3, cy - r - 0.15, 0); tag('B', 'ptr', bx + 0.3, by, 0);
  say('CB、CA 都是半徑');
  await step(tok); // @2630.0 perpendicular one unit high
  line(bx, by, cx, by, 0, '#d64545'); tag('1', 'idx', cx + 0.6, by + 0.2, 0);
  say('從 B 作垂線到 CA', '高度只有 1 單位（圖上放大）');
  await step(tok); // @2648.6 CB = CA = half a trillion
  tag('CA = CB = 5 × 10¹¹', 'ptr alt', 2.6, 6.4, 0);
  say('CB、CA = 半兆 = 5 × 10¹¹');
  await step(tok); // @2660.7 call this D; AD = ?
  tag('D', 'ptr', cx - 0.35, by + 0.15, 0);
  const ad = cube('', DY, [0.18, Math.max(0.15, by - (cy - r)), 0.18], cx, (by + cy - r) / 2, 0); glow(ad, GOLD);
  const stu = buddy('同學', 'AD = ?', STU, 0.6, 0, 1.6, 0.6); stu.mood('wow');
  say('垂足叫 D', 'AD 有多長？');
  await step(tok); // @2694.0 AD = AC − CD = R − √(R² − 1)
  stu.set('R − √(R² − 1)'); stu.mood('happy'); await stu.hop(tok);
  ok('AD = AC − CD = R − √(R² − 1)', 2.6, 5.6, 0);
  say('AD = AC − CD', 'CD 用畢氏定理：√(R² − 1)');
  await step(tok); // @2756.3 not a perfect square: irrational
  note('R² − 1 不是完全平方數 → AD 是無理數', 2.6, 4.8, 0);
  say('完全平方數減 1，不再是完全平方', 'AD 是無理數，位數無窮無盡');
  const blk = ['0.000000000001', '…000000000001', '…000000000002', '…000000000005', '…000000000014', '…000000000042', '…000000000132'];
  const bm = [];
  await step(tok); // @2768.4 let's see the digits
  kill(stu.g);
  bm.push(cube(blk[0], MINT, [3.2, 0.45, 0.7], 3.0, 3.9, 0, 1));
  say('看看算出來的位數…', '每 24 位一組排好');
  await step(tok); // @2798.6 looking pretty good
  for (let q = 1; q < blk.length; q++) { bm.push(cube(blk[q], PAPER, [3.2, 0.45, 0.7], 3.0, 3.9 - q * 0.55, 0, 1)); await beat(tok, 300); }
  say('一組一組跑出來', '1、1、2、5、14、42、132…');
  await step(tok); // @2807.2 seen these numbers before? Catalan!
  bm.forEach((m) => glow(m, GOLD));
  ok('正是 Catalan 數！', 3.0, 0.2, 0.6);
  say('20 分鐘前才看過：Catalan 數！', '想知道為什麼？去上 recitation');
}]);
  }

  // ═══ dcmit2.js ═══
  {
// ─── MIT 6.006：2YeJ-5UAke8（L12 Square Roots, Newton's Method）、JRgIXyEPnbA（Rec12 Karatsuba, Newton） ───
// Cued scenes: every `await step(tok)` waits until the lecturer says that sentence; the motion after it is
// short (≤ 2.5 s) and then the picture holds. The comment on each step gives its cue time (seconds).
// 老師的例子：L12 ε_n 誤差分析（ε = 0.01）、x₁x₀·y₁y₀ 的 4 次／3 次、Toom-3 九次 → 五次、2⁵⁰ 的 log*、
// R = 2ᵏ 的 shift、72/100 = 0.72、f(x) = 1/x − b/R、2¹⁶/5、c·1^α + … + c·d^α < 2c·d^α、√ → ÷ → × 兩層 Newton；
// Rec12 1234 × 5678 直式、A B C D、Python list 補零／slice、x − R/b 行不通、∛(10^{3d}·a)、ε 0.1 → 0.01 → 0.0001。
// 老師沒給數字的地方（∛ 的 a、函數圖形）用「示意」資料並在畫面上標明。
const { V3, fresh, tag, cube, kill, glow, tint, txt, code, anim, line, arrow, GOLD, GREEN, RED, step, buddy, prop, bob, travel, remove } = K;
const say = (a, b = '') => ctx.say(a, b);
const B1 = '#4b9ee2', B2 = '#7fb6e8', P1 = '#9b7ef4', P2 = '#c4b3f7', OR = '#dd8238', YE = '#c08a1f', GR = '#2fc092', RD = '#d64545', TE = '#31aab0', PAPER = '#efe3c8', MINT = '#d4e8da', BROWN = '#6e5f49', SKY = '#a9cdf0', PEACH = '#f4a56a', BUTTER = '#f2d37a';
const box = (t, x, y, z = 0, w = 2.6, c = PAPER, drop = 0) => cube(t, c, [w, 0.6, 0.8], x, y, z, drop);
const dig = (t, x, y, z = 0, c = PAPER, drop = 0, s = 0.5) => cube(t, c, [s * 0.92, s * 0.92, s], x, y, z, drop);
function bar(color, x, z, w = 0.6) { const m = cube('', color, [w, 1, w], x, 0.001, z); m.scale.y = 0.002; return m; }
const setBar = (m, h) => { const v = Math.max(0.002, h); m.scale.y = v; m.position.y = v / 2; };
const grow = (tok, m, h, ms = 450) => anim(tok, ms, (u) => setBar(m, h * u));
function curve(f, x0, x1, X, Y, color = RD, n = 40) {
  for (let k = 0; k < n; k++) { const a = x0 + (x1 - x0) * k / n, b = x0 + (x1 - x0) * (k + 1) / n; line(X(a), Y(f(a)), X(b), Y(f(b)), 0, color); }
}
// a label spot that replaces itself, so an old line never lingers
function board(x, y, z = 0, cls = 'say') { let l = null; return (t) => { if (l) remove(l); l = t ? tag(t, cls, x, y, z) : null; return l; }; }
// a little packet that travels from a to b and stays there
async function pkt(tok, t, a, b, ms = 800, cls = 'pkt') { const l = tag(t, cls, a.x, a.y, a.z); await travel(tok, l, a, b, ms); return l; }
// a buddy walks to (x, z) along the floor it stands on
async function walk(tok, bd, x, z, ms = 700) { const a = bd.g.position.clone(), b = V3(x, a.y, z); await anim(tok, ms, (u) => bd.g.position.lerpVectors(a, b, u)); }
const strike = (l) => { l.element.style.textDecoration = 'line-through'; l.element.style.opacity = '0.6'; };

// ═════════════ L12：2YeJ-5UAke8 ═════════════

// 00:28 本講目標：√ 呼叫 ÷，÷ 呼叫 × → 兩層計算，總複雜度？
FRAG.push(['dcmit2-nested-q', '本講目標：√ → ÷ → × 兩層計算', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.2, 0]);
  await step(tok);                                   // 28.6 last time: millionth digit of √2
  const me = buddy('你', '√2', B2, -5.2, 0, 1.6, 0.9); me.mood('wow');
  tag('√2 = 1.41421356…  第 1,000,000 位是？', 'say', 0.4, 7.0, 0);
  say('上次的問題：√2 的第一百萬位');
  await step(tok);                                   // 47.2 high-precision arithmetic + Newton
  const s = box('√a：Newton 迭代', -1.2, 5.6, 0, 3.6, B1, 1.2);
  say('用高精度運算 + Newton 法開根號', 'x_{i+1} = (x_i + a/x_i)/2');
  await step(tok);                                   // 61.9 we don't know division yet
  arrow(V3(-1.2, 5.2, 0), V3(-1.2, 4.4, 0));
  const d = box('÷：怎麼做？', -1.2, 3.9, 0, 3.6, P1, 1.2);
  tag('還沒教！', 'bad', 1.8, 3.9, 0.5);
  me.mood('sad');
  say('Newton 每一步都要做除法 a/x_i', '可是除法還沒教');
  await step(tok);                                   // 77.1 multiplication: naive n², Karatsuba n^1.58
  arrow(V3(-1.2, 3.5, 0), V3(-1.2, 2.7, 0));
  const m = box('×：已經會了', -1.2, 2.2, 0, 3.6, OR, 1.2);
  tag('naive Θ(n²)', 'good', 2.4, 2.6, 0.5); tag('Karatsuba ≈ n^1.58', 'good', 2.4, 1.8, 0.5);
  me.mood('happy');
  say('乘法已經會兩種', 'naive n²、Karatsuba ≈ n^1.58');
  await step(tok);                                   // 91.1 how many times is multiplication called?
  const q = tag('乘法會被呼叫幾次？', 'say', -5.2, 2.6, 1.6);
  me.mood('wow');
  say('算 √ 的時候，乘法被呼叫幾次？');
  await step(tok);                                   // 103.8 two levels of computation
  const p = tag('呼叫', 'pkt', 0.9, 5.6, 0.8);
  await travel(tok, p, V3(0.9, 5.6, 0.8), V3(0.9, 3.9, 0.8), 700);
  await travel(tok, p, V3(0.9, 3.9, 0.8), V3(0.9, 2.2, 0.8), 700);
  tag('兩層', 'ptr alt', -4, 4.7, 0);
  say('√ 呼叫 ÷，÷ 又呼叫 ×', '兩層計算，要打開來仔細看');
  await step(tok);                                   // 114.8 the meat of today's lecture
  remove(q); glow(s, GOLD); glow(d, GOLD); glow(m, GOLD);
  tag('√ 的總複雜度 = ？', 'ptr', 3.6, 5.6, 0);
  me.mood('calm');
  say('今天的重點：開根號的總複雜度');
}]);

// 02:18 回顧：⌊√(2·10^{2d})⌋、x₀ = 1、(x_i + a/x_i)/2、位數 1 → 2 → 4 → 8
FRAG.push(['dcmit2-sqrt-review', '回顧：Newton 求 √2，位數翻倍', async (tok) => {
  fresh([0, 4.8, 14], [0, 3.2, 0]);
  const X = (x) => -5.2 + x * 3.4, Y = (v) => 2.2 + v * 0.95, f = (x) => x * x - 2;
  await step(tok);                                   // 138.2 the millionth digit of √2
  tag('目標：√2 的第一百萬位', 'say', -1.5, 7.2, 0);
  say('目標：√2 的第一百萬位');
  await step(tok);                                   // 146.1 integers: floor of √(2·10^{2d})
  box('⌊√(2·10^{2d})⌋', -3.4, 6.2, 0, 3.4, MINT, 1);
  tag('例 d = 3：⌊√2000000⌋ = 1414 → 1.414', 'note', 2.6, 6.2, 0);
  say('全部用整數：算 ⌊√(2·10^{2d})⌋', 'd = 想要的精度位數');
  await step(tok);                                   // 212.0 start with x0 = 1
  line(X(0.3), Y(0), X(2.2), Y(0), 0, BROWN);
  curve(f, 0.75, 2.15, X, Y);
  tag('f(x) = x² − 2', 'ptr', X(2.0), Y(f(2.15)) + 0.3);
  tag('√2', 'idx', X(Math.SQRT2), Y(0) - 0.45);
  const g = buddy('x', '1', BUTTER, X(1), Y(0), 0.4, 0.45);
  say('從 x₀ = 1 出發', 'Newton：一步一步改進猜測');
  await step(tok);                                   // 219.2 x_{i+1} = (x_i + a/x_i)/2
  tag('x_{i+1} = (x_i + a/x_i) / 2', 'ptr alt', 3.6, 4.6, 0);
  say('迭代式：x_{i+1} = (x_i + a/x_i)/2');
  await step(tok);                                   // 230.7 this requires division
  tag('a/x_i 要做除法！', 'bad', 3.6, 3.9, 0);
  g.mood('wow');
  say('注意：a/x_i 需要除法', '這是外層的 Newton');
  await step(tok);                                   // 244.8 quadratic rate of convergence
  const xs = [1, 1.5, 17 / 12, 577 / 408];
  for (let k = 0; k < 3; k++) {
    const x = xs[k], nx = xs[k + 1];
    line(X(x), Y(0), X(x), Y(f(x)), 0, '#a99470');
    line(X(x), Y(f(x)), X(nx), Y(0), 0, '#1f3a6e');
    await walk(tok, g, X(nx), 0.4, 600); g.set(nx.toFixed(k + 2));
  }
  g.mood('happy');
  say('quadratic convergence', 'x：1 → 1.5 → 1.417 → 1.4142');
  await step(tok);                                   // 262.4 one digit → 2 → 4 → 8
  const D = [1, 2, 4, 8];
  for (let k = 0; k < 4; k++) { const b = bar(GR, 3.4 + k * 0.9, 1.8, 0.6); await grow(tok, b, 0.35 * D[k], 300); tag(D[k] + ' 位', 'idx', 3.4 + k * 0.9, 0, 2.6); }
  say('正確位數每次翻倍', '1 → 2 → 4 → 8：等比成長');
  await step(tok);                                   // 270.1 logarithmic number of iterations
  tag('d 位只要 log d 次迭代', 'ptr alt', 4.8, 3.2, 1.8);
  say('所以只要對數次迭代', 'd 位精度 → log d 次');
  await step(tok);                                   // 285.1 an example, but no proof yet
  tag('只舉了例子，還沒證明', 'note', -3.2, 0.4, 2);
  g.mood('calm');
  say('上次只舉例，還沒證明收斂速度', '→ 接下來證明');
}]);

// 05:10 誤差分析：x_n = √a(1 + ε_n) → ε_{n+1} = ε_n² / (2(1 + ε_n))
FRAG.push(['dcmit2-eps-derive', '誤差分析：ε_{n+1} ≈ ε_n²', async (tok) => {
  fresh([0, 4.6, 13], [0, 3.0, 0]);
  const NX = (e) => e * 14;   // ε → x on the number line
  await step(tok);                                   // 309.8 error analysis of Newton's method
  line(-6, 0.6, 6, 0.6, 0, BROWN);
  const tgt = cube('', GR, [0.12, 0.9, 0.12], 0, 1.05, 0.2); glow(tgt, GREEN);
  tag('√a（正確答案）', 'good', 0, 1.9, 0.2);
  say('對 Newton 法做誤差分析', 'error analysis');
  await step(tok);                                   // 326.1 x_n = √a (1 + ε_n)
  const cd = code(['x_n = √a (1 + ε_n)', 'x_{n+1} = (x_n + a/x_n) / 2', '  = √a [(1 + ε_n) + 1/(1 + ε_n)] / 2', '  = √a [1 + ε_n² / (2(1 + ε_n))]', 'ε_{n+1} = ε_n² / (2(1 + ε_n))'], -2.4, 6.8, 0.55);
  cd.hl(0);
  const g = buddy('x_n', '', BUTTER, NX(0.3), 0.6, 0.6, 0.55);
  const eps = tag('ε_n', 'pkt', NX(0.15), 0.3, 1.3);
  say('設 x_n = √a (1 + ε_n)', 'ε_n：和正確答案差的比例');
  await step(tok);                                   // 334.1 ε may be positive or negative
  await walk(tok, g, NX(-0.25), 0.6, 800); eps.position.x = NX(-0.12); txt(eps, 'ε_n < 0');
  await walk(tok, g, NX(0.3), 0.6, 800); eps.position.x = NX(0.15); txt(eps, 'ε_n > 0');
  say('ε_n 可正可負', '猜大了 ε > 0，猜小了 ε < 0');
  await step(tok);                                   // 356.4 want ε_n → 0; how fast?
  arrow(V3(NX(0.3) - 0.5, 1.6, 0.6), V3(0.4, 1.6, 0.6), 0x0f5a3a);
  tag('ε_n → 0？多快？', 'say', NX(0.18), 2.6, 0.6);
  g.mood('wow');
  say('要證明 ε_n → 0', '而且要知道有多快');
  await step(tok);                                   // 366.3 plug this into that
  cd.hl(1);
  say('把 x_n 代進迭代式');
  await step(tok);                                   // 407.7 pull out √a
  cd.hl(2);
  say('提出 √a', '剩下 (1 + ε_n) 和 1/(1 + ε_n)');
  await step(tok);                                   // 444.4 x_{n+1} = √a[1 + ε²/(2(1+ε))]
  cd.hl(3);
  say('化簡：多出一項 ε_n² / (2(1 + ε_n))', '（老師跳過一步代數）');
  await step(tok);                                   // 481.8 ε_{n+1} vs ε_n
  cd.hl(4);
  say('ε_{n+1} = ε_n² / (2(1 + ε_n))', '新誤差 ≈ 舊誤差的平方');
  await step(tok);                                   // 504.0 this part is essentially 1
  tag('ε_n 很小時 1 + ε_n ≈ 1', 'note', 4.2, 4.4, 0);
  await walk(tok, g, NX(0.08), 0.6, 900); g.mood('happy');
  say('ε_n 越來越小，分母 ≈ 1', '誤差每一步被平方');
  await step(tok);                                   // 519.9 0.01 → 0.0001
  tag('ε = 0.01', 'ptr alt', 4.2, 3.5, 0);
  await pkt(tok, '平方', V3(4.2, 3.2, 0.3), V3(4.2, 2.6, 0.3), 600);
  tag('ε² = 0.0001', 'ptr alt', 4.2, 2.3, 0);
  await walk(tok, g, NX(0.03), 0.6, 600);
  say('0.01 → 0.0001', '小數點後的 0 翻倍');
  await step(tok);                                   // 556.6 d digits → log d iterations
  tag('d 位精度 → log d 次迭代', 'ptr', -4.2, 3.1, 0.5);
  say('quadratic convergence', 'd 位精度只要 log d 次');
  await step(tok);                                   // 597.8 now: complexity of division
  box('÷ 的複雜度？', -4.2, 2.1, 0.5, 2.6, P1, 1);
  g.mood('calm');
  say('剩下：除法的複雜度', '知道它就知道開根號的複雜度');
}]);

// 10:36 乘法回顧：x₁x₀ × y₁y₀，4 次 → n²；Karatsuba 3 次 → n^1.58
FRAG.push(['dcmit2-mult-recap', '乘法回顧：4 次 vs 3 次', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.4, 0]);
  const kids = (cx, k, sp, col) => { const o = []; for (let i = 0; i < k; i++) { const x = cx + (i - (k - 1) / 2) * sp * k; line(cx, 4.4, x, 3.5); o.push(cube('n/2', col, [0.55, 0.32, 0.45], x, 3.3, 0, 0.8)); } return o; };
  const grand = (cx, k, sp, col) => { for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) { const px = cx + (i - (k - 1) / 2) * sp * k, x = px + (j - (k - 1) / 2) * sp; line(px, 3.1, x, 2.3); cube('', col, [0.28, 0.25, 0.3], x, 2.1, 0, 0.6); } };
  await step(tok);                                   // 636.0 revisit multiplication
  const bx = box('x：d 位', -1.4, 6.6, 0, 2.6, B1, 1), by = box('y：d 位', 1.4, 6.6, 0, 2.6, P1, 1);
  tag('×', 'ptr', 0, 6.6, 0.6);
  say('回顧乘法：兩個 d 位數相乘');
  await step(tok);                                   // 670.4 x1 x0 ; y1 y0
  kill(bx); kill(by);
  cube('x₁', B1, [1.3, 0.55, 0.7], -2.0, 6.6, 0, 1); cube('x₀', B2, [1.3, 0.55, 0.7], -0.7, 6.6, 0, 1);
  cube('y₁', P1, [1.3, 0.55, 0.7], 0.9, 6.6, 0, 1); cube('y₀', P2, [1.3, 0.55, 0.7], 2.2, 6.6, 0, 1);
  tag('x₁ = 高位那一半', 'note', -4.6, 6.6, 0);
  say('divide and conquer：各拆兩半', 'x₁ 是 x 的高位一半');
  await step(tok);                                   // 690.7 each has d/2 digits
  tag('每段 d/2 位', 'idx', 4.4, 6.6, 0);
  say('每一半有 d/2 位');
  await step(tok);                                   // 699.8 T(n) = 4T(n/2) + Θ(n)
  cube('n', RD, [0.7, 0.4, 0.5], -3.6, 4.6, 0, 1);
  const L = kids(-3.6, 4, 0.36, RD);
  tag('T(n) = 4T(n/2) + Θ(n)', 'ptr', -3.6, 1.3, 0.6);
  say('直接做：T(n) = 4T(n/2) + Θ(n)');
  await step(tok);                                   // 712.7 x1y1, x1y0, …
  const P = ['x₁y₁', 'x₁y₀', 'x₀y₁', 'x₀y₀'];
  for (let k = 0; k < 4; k++) { glow(L[k], GOLD); tag(P[k], 'pkt', L[k].position.x, 3.85, 0.4); await ctx.beat(tok, 250); }
  say('4 次乘法', 'x₁y₁、x₁y₀、x₀y₁、x₀y₀');
  await step(tok);                                   // 731.8 four multiplications → n²
  grand(-3.6, 4, 0.36, RD);
  tag('= Θ(n²)', 'bad', -3.6, 0.7, 0.6);
  say('每層都拆成 4 個：結果還是 Θ(n²)');
  await step(tok);                                   // 736.4 Karatsuba: three multiplications
  cube('n', GR, [0.7, 0.4, 0.5], 3.6, 4.6, 0, 1);
  kids(3.6, 3, 0.6, GR);
  tag('Karatsuba：3 次', 'good', 3.6, 5.3, 0);
  say('Karatsuba：數學技巧減為 3 次乘法');
  await step(tok);                                   // 752.1 a few more additions, Θ(n)
  tag('多幾次加法 Θ(n)', 'note', 5.6, 3.3, 0.6);
  say('多做幾次加法', '加法只要 Θ(n)，很便宜');
  await step(tok);                                   // 760.6 T(n) = 3T(n/2) + Θ(n) → n^1.58
  grand(3.6, 3, 0.6, GR);
  tag('T(n) = 3T(n/2) + Θ(n)', 'ptr alt', 3.6, 1.3, 0.6); tag('= Θ(n^1.58…)', 'good', 3.6, 0.7, 0.6);
  say('T(n) = 3T(n/2) + Θ(n)', '= Θ(n^(log₂3)) ≈ n^1.58');
}]);

// 13:03 Toom-Cook 3：拆三段，直接 9 次 → 技巧後 5 次 → n^(log₃5)
FRAG.push(['dcmit2-toom3', 'Toom-3：九次乘法減為五次', async (tok) => {
  fresh([0, 5, 13], [0, 3, 0]);
  await step(tok);                                   // 782.8 no reason to stop at two parts
  const k2 = box('拆 2 段：Karatsuba', -3.4, 6.6, 0, 3.4, B2, 1);
  tag('為什麼只拆 2 段？', 'say', 2.2, 6.6, 0);
  say('沒理由只拆成兩段');
  await step(tok);                                   // 797.9 Toom and Cook: k parts
  const tc = buddy('Toom & Cook', 'k 段', PEACH, 5.4, 0, 1.6, 0.8); tc.mood('happy');
  say('Toom 和 Cook 把 Karatsuba 推廣', '拆成 k 段（k ≥ 2）');
  await step(tok);                                   // 811.8 Toom-2 = Karatsuba, Toom 3, Toom 4…
  txt(k2.userData.lbl, 'Toom-2 = Karatsuba');
  tag('Toom-3、Toom-4…（不用背細節）', 'note', 2.2, 5.8, 0);
  say('Toom-2 就是 Karatsuba', '還有 Toom-3、Toom-4…');
  await step(tok);                                   // 834.9 Toom-3: three parts, d/3 digits each
  kill(k2);
  const xs = [], ys = [];
  for (let i = 0; i < 3; i++) xs.push(cube('x' + '₂₁₀'[i], [B1, B2, SKY][i], [1, 0.5, 0.7], -3.6 + i * 1.2, 6.3, 0, 1));
  for (let j = 0; j < 3; j++) ys.push(cube('y' + '₂₁₀'[j], [P1, P2, '#ddd2fb'][j], [1, 0.5, 0.7], -5.4, 5.2 - j * 0.8, 0, 1));
  say('Toom-3：每個數拆成三段', '每段 d/3 位');
  await step(tok);                                   // 867.6 how many d/3 × d/3 multiplications?
  const cnt = tag('乘法 ? 次', 'ptr alt', 3.0, 6.3, 0);
  const cells = [];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const c = cube('x' + '₂₁₀'[i] + 'y' + '₂₁₀'[j], PAPER, [1, 0.5, 0.7], -3.6 + i * 1.2, 5.2 - j * 0.8, 0, 0.8); c.userData.s = (2 - i) + (2 - j); cells.push(c);
    await ctx.beat(tok, 160);
  }
  say('不用技巧，要幾次 d/3 × d/3？');
  await step(tok);                                   // 884.4 nine
  txt(cnt, '乘法 9 次');
  tc.mood('wow');
  say('9 次', '能少於 9 次，就是更好的分治');
  await step(tok);                                   // 893.7 Toom-3 plays arithmetic games
  const COL = [RD, OR, YE, GR, TE];
  cells.forEach((c) => tint(c, COL[c.userData.s]));
  for (let s = 0; s < 5; s++) tag('第 ' + s + ' 項', 'idx', 0.4, 3.2 + s * 0.55, 0);
  say('結果只有 5 個係數（同色相加）', '算術技巧：5 點求值再內插');
  await step(tok);                                   // 913.3 nine → five
  txt(cnt, '乘法 5 次'); tc.mood('happy');
  tag('T(n) = 5T(n/3) + Θ(n)', 'ptr', 3.0, 5.6, 0);
  say('9 次減為 5 次', 'T(n) = 5T(n/3) + Θ(n)');
  await step(tok);                                   // 933.0 log base 3 of 5
  tag('= Θ(n^(log₃5))', 'ptr alt', 3.0, 4.9, 0);
  say('= Θ(n^(log₃5))', '以 3 為底的 log 5');
  await step(tok);                                   // 942.9 n^1.465 — you won
  const R = [['naive', 2, RD], ['Karatsuba', Math.log2(3), OR], ['Toom-3', Math.log(5) / Math.log(3), GR]];
  for (let k = 0; k < 3; k++) { const b = bar(R[k][2], 2.4 + k * 1.4, 1.8, 0.8); await grow(tok, b, (R[k][1] - 1) * 3, 350); tag(R[k][0] + ' ' + R[k][1].toFixed(3), 'idx', 2.4 + k * 1.4, 0, 2.6 + (k % 2) * 0.4); }
  say('n^1.465：贏了', '指數 2 → 1.585 → 1.465');
}]);

// 16:09 常數因子：n 要很大快的才贏；Schönhage-Strassen；Python 在 n 大時才切到 Karatsuba
FRAG.push(['dcmit2-crossover', '常數因子：n 夠大才划算', async (tok) => {
  fresh([0, 4, 13], [0, 3, 0]);
  const X = (L) => -5.5 + L * 0.62, Y = (v) => 0.4 + v * 0.17;
  const fN = (L) => 2 * L, fK = (L) => 4 + Math.log2(3) * L, Lc = 4 / (2 - Math.log2(3));
  await step(tok);                                   // 969.2 this is correct: n^1.46 < n^1.58 < n²
  line(X(0), Y(0), X(16.5), Y(0), 0, BROWN); line(X(0), Y(0), X(0), Y(33), 0, BROWN);
  tag('log₂ n', 'idx', X(16), Y(0) - 0.4); tag('log₂ 時間', 'idx', X(0) + 0.6, Y(33));
  tag('n^1.46 < n^1.58 < n²', 'ptr alt', 0.4, 6.8, 0);
  say('漸進來看：n^1.46 < n^1.58 < n²', '這是對的');
  await step(tok);                                   // 979.8 how big does n have to be?
  let pa = 0;
  await anim(tok, 1800, (t) => { const L = 16 * t; line(X(pa), Y(fN(pa)), X(L), Y(fN(L)), 0, RD); line(X(pa), Y(fK(pa)), X(L), Y(fK(L)), 0, GR); pa = L; });
  tag('naive n²', 'ptr', X(14.2), Y(fN(16)) + 0.2); tag('Karatsuba c·n^1.58', 'ptr alt', X(12.6), Y(fK(16)) - 0.7);
  const dot = cube('', YE, [0.25, 0.25, 0.25], X(Lc), Y(fN(Lc)), 0); glow(dot, GOLD);
  tag('交叉點', 'idx', X(Lc), Y(fN(Lc)) + 0.5);
  say('n 要多大，快的演算法才會贏？', '交叉點左邊 naive 反而快（示意）');
  await step(tok);                                   // 994.8 n must be really large in Python
  tag('用 Python 寫：n 要非常大', 'note', X(Lc) + 1.6, Y(fN(Lc)) - 0.8, 0.5);
  say('用 Python 實作，n 要非常非常大', '作業很難設計出看得到差別的題目');
  await step(tok);                                   // 1021.8 people did even better
  const bd = buddy('研究者', '', PEACH, 5.6, 0, 2.2, 0.7); bd.mood('happy');
  tag('乘法是所有計算的基本零件', 'say', 4.2, 1.6, 2.2);
  say('乘法太重要了，大家一直改進');
  await step(tok);                                   // 1036.0 FFT and other techniques
  box('FFT（快速傅立葉轉換）', 2.6, 4.4, 1.6, 4.2, MINT, 1);
  say('用 FFT 等技巧加速乘法', 'fast Fourier transform');
  await step(tok);                                   // 1058.3 Schönhage-Strassen: n log n log log n
  box('Schönhage-Strassen', 2.6, 5.2, 1.6, 4.2, PAPER, 1);
  tag('n log n log log n：幾乎線性', 'good', 2.6, 5.9, 1.6);
  say('Schönhage-Strassen 用 FFT', 'Θ(n log n log log n)，幾乎線性');
  await step(tok);                                   // 1079.1 play with all of these in gmpy
  box('gmpy：naive、Karatsuba、Toom-3…', -2.4, 6.6, 1.6, 4.6, SKY, 1);
  say('Python 的 gmpy 套件都能玩', '看 n 多大時誰贏誰');
  await step(tok);                                   // 1109.5 Eric: Python long ints use Karatsuba
  const er = buddy('Eric（助教）', '', B2, -6.2, 0, 2.2, 0.7); er.mood('wow');
  tag('Python 長整數用 Karatsuba！', 'say', -4.6, 1.6, 2.2);
  say('助教 Eric：Python 長整數用 Karatsuba');
  await step(tok);                                   // 1124.0 small n naive, large n Karatsuba
  tag('n 小：naive', 'pkt', X(Lc) - 1.6, Y(0) + 0.5, 0.5); tag('n 大：Karatsuba', 'pkt', X(Lc) + 2.0, Y(0) + 0.5, 0.5);
  er.mood('happy');
  say('Python：n 小用 naive，n 大才切換', 'Karatsuba');
  await step(tok);                                   // 1133.0 your own adaptive scheme
  tag('自己寫：adaptive 切換', 'note', X(Lc), Y(0) + 1.3, 0.5);
  say('自己寫也能做 adaptive 切換', '依 n 的大小選演算法');
}]);

// 19:17 Fürer：n log n · 2^{O(log* n)}；log*(2⁵⁰) = 5
FRAG.push(['dcmit2-logstar', 'log* n：連續取 log 到 ≤ 1', async (tok) => {
  fresh([0, 5, 14], [0, 2.8, 0]);
  const S = [['2⁵⁰', 6.2], ['50', 4.4], ['5.64', 2.9], ['2.50', 1.9], ['1.32', 1.2], ['0.40', 0.5]];
  const put = async (q) => { const m = bar(q === 5 ? GR : B1, -5 + q * 2, 0, 1.3); await grow(tok, m, S[q][1], 400); tag(S[q][0], 'ptr alt', -5 + q * 2, S[q][1] + 0.4); if (q) tag('log 第 ' + q + ' 次', 'idx', -5 + q * 2, 0, 1.3); };
  await step(tok);                                   // 1153.8 breakthrough: Fürer
  const fu = buddy('Fürer', '', PEACH, 6.2, 0, 2.4, 0.8); fu.mood('happy');
  tag('理論上的突破', 'say', 6.2, 1.9, 2.4);
  say('理論突破：Fürer 的演算法');
  await step(tok);                                   // 1164.3 n log n · 2^{O(log* n)}
  const fm = tag('n log n · 2^{O(log* n)}', 'ptr', 0, 7.6, 0);
  say('時間：n log n · 2^{O(log* n)}', 'O 是上界');
  await step(tok);                                   // 1187.0 n log n is like sorting
  tag('n log n：跟排序一樣', 'note', -4.2, 7.0, 0);
  say('n log n 這部分像排序');
  await step(tok);                                   // 1198.0 log* n: iterated logarithm
  tag('log* n = iterated logarithm', 'ptr alt', 3.6, 7.0, 0);
  say('log* n 叫 iterated logarithm', '「重複取 log」');
  await step(tok);                                   // 1214.0 how many times until ≤ 1
  tag('要連續取幾次 log，才會 ≤ 1？', 'say', 0, 6.3, 1.5);
  say('定義：連續取 log 幾次才 ≤ 1', '數的是「次數」，不是 log 的值');
  await step(tok);                                   // 1246.1 e.g. 2^50
  await put(0);
  say('例：從 2⁵⁰ 開始（以 2 為底）');
  await step(tok);                                   // 1255.8 first iteration: 50
  await put(1);
  say('第一次 log₂：剩 50');
  await step(tok);                                   // 1258.8 log of 50 → "about 7"
  await put(2);
  tag('老師說約 7，其實 log₂50 ≈ 5.64', 'note', -1, 4.0, 1.5);
  say('再取 log：log₂50 ≈ 5.64', '（影片說約 7）');
  await step(tok);                                   // 1264.3 then less than 3
  await put(3);
  say('再取 log：2.50，小於 3');
  await step(tok);                                   // 1271.0 four or five iterations → ≤ 1
  await put(4); await put(5);
  tag('log*(2⁵⁰) = 5', 'good', 5, 2.0, 1.3);
  say('取 5 次就 ≤ 1', 'log*(2⁵⁰) = 5');
  await step(tok);                                   // 1300.7 2 raised to a pretty small number
  tag('2^{O(log* n)} 幾乎是常數', 'ptr alt', 0, 6.3, -1.5);
  say('log* n 很小，2^{O(log* n)} 幾乎是常數', '2¹⁰ 也才 1000');
  await step(tok);                                   // 1313.2 asymptotically the winner
  fu.mood('wow'); await fu.hop(tok);
  tag('理論冠軍', 'good', 6.2, 2.6, 2.4);
  say('漸進複雜度來看：Fürer 最好');
  await step(tok);                                   // 1318.1 practically: Schönhage-Strassen
  const ss = buddy('S-S', '', B2, -6.2, 0, 2.4, 0.7); ss.mood('happy');
  tag('實務：n 到幾十億位用它', 'say', -6.2, 1.9, 2.4);
  say('實務上 n 很大時用 Schönhage-Strassen', 'n 到幾十億位');
  await step(tok);                                   // 1329.3 gmpy does not have Fürer
  tag('gmpy 目前沒有 Fürer', 'note', 6.2, 3.3, 2.4);
  fu.mood('sad');
  say('gmpy 套件還沒實作 Fürer', '用 gmpy 的話就停在 S-S');
  void fm;
}]);

// 22:34 高精度除法：a/b = a·(1/b)，先算 ⌊R/b⌋，R = 2ᵏ → 除以 R 只是 shift
FRAG.push(['dcmit2-shift-div', '除以 R = 2ᵏ：只是 shift', async (tok) => {
  fresh([0, 4, 12.5], [0, 3, 0]);
  const S = 0.5, X0 = -4.2;
  const bits = '11001100110011'.split('');
  await step(tok);                                   // 1353.8 given multiplication, how long is division?
  box('×：Θ(n^α) 已知', -3.4, 6.6, 0, 3.2, OR, 1); const dq = box('÷：要多久？', 1.8, 6.6, 0, 3.2, P1, 1);
  say('假設乘法的複雜度已知', '除法要花多久？');
  await step(tok);                                   // 1368.2 haven't said how to do division (a/x_i)
  tag('Newton 每步都要 a/x_i', 'note', 4.8, 6.0, 0);
  say('一講半了，還沒說除法怎麼做', 'Newton 的 a/x_i 就是除法');
  await step(tok);                                   // 1399.1 high-precision division
  txt(dq.userData.lbl, '高精度除法'); glow(dq, GOLD);
  say('終於：高精度除法');
  await step(tok);                                   // 1410.5 high-precision rep of a/b
  box('a / b', -3.6, 5.4, 0, 1.8, PAPER, 1);
  say('要 a/b 的高精度表示', '很多很多位');
  await step(tok);                                   // 1422.4 first compute 1/b
  box('= a × (1/b)', -1.2, 5.4, 0, 2.4, MINT, 1);
  say('先算 1/b 的高精度表示', '再拿去乘 a');
  await step(tok);                                   // 1432.2 compute ⌊R/b⌋, R really large
  box('1/b ≈ ⌊R/b⌋ / R', 2.4, 5.4, 0, 3.2, MINT, 1);
  tag('R 很大', 'note', 4.8, 4.8, 0);
  say('實際算 ⌊R/b⌋，R 是很大的數');
  await step(tok);                                   // 1467.9 easy to divide by R: R = 2^k
  tag('例：⌊2¹⁶/5⌋ = 13107 =', 'ptr alt', -2.6, 3.9, 0);
  bits.forEach((b, i) => dig(b, X0 + (i + 2) * S, 3.0, 0, b === '1' ? B2 : PAPER, 1));
  say('選 R = 2ᵏ：在二進位裡好除', '例：R = 2¹⁶、b = 5');
  await step(tok);                                   // 1474.5 divide through a shift operator
  const pt = tag('.', 'ptr', X0 + 15.75 * S, 2.75, 0.3);
  tag('小數點', 'idx', X0 + 15.75 * S, 2.2, 0.3);
  say('除以 2ᵏ = shift', '把小數點往左移 k 位');
  await step(tok);                                   // 1497.8 shift → 1 over b
  await anim(tok, 1800, (t) => { pt.position.x = X0 + (15.75 - 16 * t) * S; });
  dig('0', X0, 3.0, 0, PAPER, 1); dig('0', X0 + S, 3.0, 0, PAPER, 1);
  tag('0.0011001100110011₂ ≈ 0.2 = 1/5', 'good', 1.8, 2.0, 0);
  say('shift 完就是 1/b', '0.0011…₂ ≈ 0.2 = 1/5');
  await step(tok);                                   // 1508.5 then multiply by a
  await pkt(tok, '× a', V3(4.6, 2.0, 0.4), V3(4.6, 1.2, 0.4), 700);
  say('拿 1/b 去乘 a，就得到 a/b', 'Newton 迭代就能繼續');
  await step(tok);                                   // 1523.7 shift right: smaller number
  tag('往右 shift：位數變少、數變小', 'note', -2.6, 1.2, 0.5);
  say('除以 R：所有位元往右移', '數變小');
  await step(tok);                                   // 1555.3 72 ÷ 100 = 0.72
  const t72 = box('72 ÷ 100 = 0.72', 2.6, 0.4, 1.4, 3.4, BUTTER, 1);
  say('十進位也一樣：72 ÷ 100 = 0.72', '只是移動小數點');
  await step(tok);                                   // 1572.1 still: how to compute R/b?
  tag('R/b 怎麼算？', 'say', -3.6, 0.4, 1.4);
  say('剩下的問題：R/b 要怎麼算？');
  await step(tok);                                   // 1589.6 use Newton's method again
  const nw = buddy('Newton', '', B2, -6.2, 0, 2.4, 0.7); nw.mood('happy'); await nw.hop(tok);
  say('答案：再用一次 Newton 法');
  void t72;
}]);

// 26:36 f(x) = 1/x − b/R → x_{i+1} = 2x_i − b·x_i²/R：只要乘法
FRAG.push(['dcmit2-recip-derive', 'Newton 求 R/b：只剩乘法', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.0, 0]);
  const f = (x) => 1 / x - 0.5, X = (x) => 1.2 + x * 1.25, Y = (v) => 1.6 + v * 1.3;
  const cd = code(['f(x) = 1/x − b/R', 'f′(x) = −1/x²', 'x_{i+1} = x_i − f(x_i)/f′(x_i)', '  = x_i − (1/x_i − b/R)/(−1/x_i²)', '  = x_i + x_i²(1/x_i − b/R)', '  = 2x_i − b·x_i²/R'], -3.0, 6.9, 0.52);
  cd.ls.forEach((l) => { l.element.style.visibility = 'hidden'; });
  const show = (i) => { cd.ls[i].element.style.visibility = ''; cd.hl(i); };
  await step(tok);                                   // 1595.8 Newton again (1/x is nonlinear)
  const nw = buddy('Newton', '', B2, -6.2, 0, 2.4, 0.7); nw.mood('happy');
  say('再用一次 Newton 法', '要算的 R/b 跟 1/x 有關（非線性）');
  await step(tok);                                   // 1619.1 f(x) = 1/x − b/R
  show(0);
  line(X(0.5), Y(0), X(4.6), Y(0), 0, BROWN);
  curve(f, 0.62, 4.5, X, Y);
  tag('f(x) = 1/x − b/R（示意 b/R = 1/2）', 'idx', X(3.2), Y(1.2), 0);
  say('設 f(x) = 1/x − b/R');
  await step(tok);                                   // 1634.3 zero at x = R/b
  const rt = cube('', GR, [0.25, 0.25, 0.25], X(2), Y(0), 0); glow(rt, GREEN);
  tag('根：x = R/b', 'good', X(2), Y(0) - 0.5, 0);
  say('它的根正好在 x = R/b', '1/x = b/R  ⇔  x = R/b');
  await step(tok);                                   // 1650.8 decent guess → R/b → shift → 1/b
  tag('找到根 → ⌊R/b⌋ → shift → 1/b', 'note', 3.6, 5.6, 0);
  say('從不錯的猜測出發 → 收斂到 R/b', '整數版就是 ⌊R/b⌋，再 shift 得 1/b');
  await step(tok);                                   // 1663.6 what is the derivative?
  const q = tag('f′(x) = ？', 'say', -6.2, 1.8, 2.4);
  say('Newton 要用導數：f′(x) 是多少？');
  await step(tok);                                   // 1688.3 audience: −1/x², gets a cushion
  remove(q);
  const st = buddy('同學', '', PEACH, -3.6, 0, 3.4, 0.6); st.mood('happy');
  tag('−1/x²！', 'say', -3.6, 1.5, 3.4);
  await pkt(tok, '丟坐墊', V3(-6.2, 1.2, 2.4), V3(-3.6, 0.9, 3.4), 900);
  say('同學答：−1/x²', '老師丟坐墊當獎品');
  await step(tok);                                   // 1724.2 derivative is −1/x²
  show(1);
  say('f′(x) = −1/x²');
  await step(tok);                                   // 1742.5 tangent → x-intercept
  const x0 = 1, fx = f(x0), sl = -1 / (x0 * x0), nx = x0 - fx / sl;
  line(X(x0), Y(0), X(x0), Y(fx), 0, '#a99470');
  line(X(x0 - 0.3), Y(fx - sl * 0.3), X(nx + 0.4), Y(fx + sl * (nx + 0.4 - x0)), 0, '#1f3a6e');
  const gd = cube('', YE, [0.22, 0.22, 0.22], X(x0), Y(fx), 0); glow(gd, GOLD);
  await anim(tok, 900, (u) => { gd.position.set(X(x0 + (nx - x0) * u), Y(fx * (1 - u)), 0); });
  say('畫切線，交 x 軸的點 = 下一個 x', '和上一講一樣');
  await step(tok);                                   // 1756.3 x_{i+1} = x_i − f/f′
  show(2);
  say('Newton：x_{i+1} = x_i − f(x_i)/f′(x_i)');
  await step(tok);                                   // 1781.8 plug in f and f′
  show(3);
  say('把 f 和 f′ 代進去');
  await step(tok);                                   // 1801.3 = x_i + x_i²(1/x_i − b/R)
  show(4);
  say('除以 −1/x_i² = 乘上 −x_i²', '負負得正');
  await step(tok);                                   // 1815.8 = 2x_i − b x_i²/R — key
  show(5);
  tag('關鍵！', 'good', 1.6, 4.3, 0);
  nw.mood('wow');
  say('x_{i+1} = 2x_i − b·x_i²/R', '這一行是關鍵');
  await step(tok);                                   // 1836.8 2 times: doesn't scare us
  const ops = [['2x_i：乘 2', MINT], ['x_i²：乘法', OR], ['÷R：shift', MINT]];
  const ob = [];
  ob.push(box(ops[0][0], -5.2, 2.5, 1, 2.3, ops[0][1], 1.2));
  say('2·x_i：乘 2，二進位裡超簡單');
  await step(tok);                                   // 1848.8 square = multiply
  ob.push(box(ops[1][0], -2.7, 2.5, 1, 2.3, ops[1][1], 1.2));
  say('x_i²：平方（不是開根號）', '平方就是自己乘自己 → 乘法');
  await step(tok);                                   // 1860.8 R chosen as an easy division
  ob.push(box(ops[2][0], -0.2, 2.5, 1, 2.3, ops[2][1], 1.2));
  say('÷R：R 選成好除的數 → shift');
  await step(tok);                                   // 1866.3 all easy or a multiply
  ob.forEach((b) => glow(b, GREEN)); nw.mood('happy'); await nw.hop(tok);
  say('每個運算不是很簡單，就是乘法', '除法 → 只靠乘法就能做');
}]);

// shared drawing for the two-level picture: √ (outer Newton) → ÷ (inner Newton) → ×
function nestBoxes() {
  return {
    s: () => box('√a：外層 Newton', -2.4, 5.8, 0, 3.6, B1, 1.2),
    d: () => box('÷：內層 Newton 求倒數', -2.4, 4.0, 0, 3.6, P1, 1.2),
    m: () => box('×：Θ(n^α)', -2.4, 2.2, 0, 3.6, OR, 1.2),
  };
}

// 31:18 兩層 Newton 的結構（第一次出現）
FRAG.push(['dcmit2-nested-mid', '兩層 Newton：√ 叫 ÷，÷ 叫 ×', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.2, 0]);
  const N = nestBoxes();
  await step(tok);                                   // 1880.3 the overall structure for √a
  tag('開根號的整體結構', 'say', 0, 7.0, 0);
  say('先看整體結構：怎麼算 √a');
  await step(tok);                                   // 1888.7 Newton for √a, iteratively
  const s = N.s(); tag('迭代 x_i → x_{i+1}', 'idx', 1.6, 5.8, 0);
  say('外層：用 Newton 迭代算 √a');
  await step(tok);                                   // 1899.7 each iteration needs a reciprocal 1/x_i
  arrow(V3(-2.4, 5.4, 0), V3(-2.4, 4.5, 0));
  const d = N.d();
  await pkt(tok, '1/x_i？', V3(1.0, 5.6, 0.6), V3(1.0, 4.0, 0.6), 800);
  say('每一次迭代都要算倒數 1/x_i');
  await step(tok);                                   // 1911.8 Newton again for 1/x_i
  tag('又一個 Newton', 'ptr alt', 3.6, 4.0, 0);
  say('算 1/x_i 又是一個 Newton 迭代');
  await step(tok);                                   // 1922.8 second level iteration = multiplication
  arrow(V3(-2.4, 3.6, 0), V3(-2.4, 2.7, 0));
  const m = N.m();
  say('第二層的迭代只做乘法', '2x_i − b·x_i²/R');
  await step(tok);                                   // 1936.6 x_{i+1}, x_{i+2}, x_{i+3}, …
  for (const t of ['x_{i+1}', 'x_{i+2}', 'x_{i+3}']) { const p = tag(t, 'pkt', 1.0, 3.8, 0.6); await travel(tok, p, V3(1.0, 3.8, 0.6), V3(1.0, 2.3, 0.6), 500); remove(p); }
  glow(m, GOLD);
  say('一次又一次做乘法', 'x_{i+1}、x_{i+2}、x_{i+3}…');
  await step(tok);                                   // 1943.8 the complete picture later
  tag('講完除法的複雜度再回來', 'note', 3.6, 2.2, 0);
  say('完整的圖等講完除法複雜度再看');
  void s; void d;
}]);

// 32:37 例子：2¹⁶/5，x₀ = 16384 → 12288 → 13056 → 13107
FRAG.push(['dcmit2-recip-example', 'Newton 求 R/b：2¹⁶/5 的迭代', async (tok) => {
  fresh([0, 5, 14], [0, 3, 0]);
  const tgt = 65536 / 5, H = (v) => v / 16384 * 4.6;
  const xb = buddy('x_i', '', BUTTER, -6.2, 0, 1.6, 0.6);
  await step(tok);                                   // 1956.8 convergence of this scheme
  tag('x_{i+1} = 2x_i − b·x_i²/R', 'ptr alt', -1, 7.0, 0);
  say('這個除法 Newton 收斂得多快？');
  await step(tok);                                   // 1962.1 an example first
  tag('先看例子，再談證明', 'note', 4.0, 7.0, 0);
  say('先看例子');
  await step(tok);                                   // 1980.7 R/b = 2^16 / 5
  const wl = cube('', GR, [10, 0.05, 0.05], 0.4, H(tgt), 0);
  tag('R/b = 2¹⁶/5 = 13107.2', 'good', 5.6, H(tgt) + 0.35);
  say('例：R/b = 2¹⁶/5', 'R = 65536、b = 5');
  await step(tok);                                   // 1994.4 R = 2^k for easy division
  tag('R = 2ᵏ：好除', 'note', 4.0, 6.3, 0);
  say('R 選 2 的次方，除以 R 很容易');
  await step(tok);                                   // 2011.3 initial guess 2^16/4
  tag('猜：2¹⁶/4（除以 2 的次方很簡單）', 'say', -3, 6.3, 0);
  xb.mood('wow');
  say('初始猜測：2¹⁶/4', '用 4 代替 5，因為 4 是 2 的次方');
  const xs = [16384, 12288, 13056, 13107];
  const put = async (q) => { const m = bar(q === 3 ? GR : B1, -4.2 + q * 2.4, 0, 1.4); await grow(tok, m, H(xs[q]), 500); tag(String(xs[q]), 'idx', -4.2 + q * 2.4, H(xs[q]) + 0.35); tag('x' + '₀₁₂₃'[q], 'ptr', -4.2 + q * 2.4, 0, 1.3); xb.set(xs[q]); };
  await step(tok);                                   // 2028.7 = 2^14 = 16384 = x0
  await put(0);
  say('x₀ = 2¹⁴ = 16384');
  await step(tok);                                   // 2042.8 x1 = 2·16384 − 5·16384²/65536
  const fb = board(0, 5.6, 1.2, 'pkt');
  fb('x₁ = 2·16384 − 5·16384² / 65536');
  say('x₁ = 2·16384 − 5·16384²/65536', '平方一個不小的數');
  await step(tok);                                   // 2066.6 = 12288
  await put(1);
  say('x₁ = 12288');
  await step(tok);                                   // 2075.6 one digit of precision
  tag('只有 1 位對', 'note', -1.8, H(12288) + 0.9, 0);
  xb.mood('calm');
  say('大概只有一位數正確');
  await step(tok);                                   // 2078.7 x2 = 2·12288 − 5·12288²/65536
  fb('x₂ = 2·12288 − 5·12288² / 65536');
  say('x₂ = 2·12288 − 5·12288²/65536', '除以 65536 只是 shift');
  await step(tok);                                   // 2094.9 = 13056
  await put(2);
  say('x₂ = 13056');
  await step(tok);                                   // 2100.8 next: 13107
  fb('');
  await put(3);
  xb.mood('happy');
  say('再一次：x₃ = 13107');
  await step(tok);                                   // 2106.8 rapid convergence
  tag('差距 3277 → 819 → 51 → 0.2', 'ptr alt', 0, 6.3, 1.2);
  await xb.hop(tok);
  say('收斂得很快', '和真值差：3277 → 819 → 51 → 0.2');
  await step(tok);                                   // 2111.2 similar ε analysis → quadratic
  tag('一樣是平方收斂（證明見講義）', 'note', 3.4, 2.4, 1.4);
  say('類似 ε 的分析：除法 Newton 也是平方收斂', '證明在講義裡');
  await step(tok);                                   // 2149.4 we're in business
  tag('可以實作了！', 'good', -6.2, 1.6, 1.6);
  say('可以真的實作了');
  void wl;
}]);

// 36:00 除法複雜度粗估：log d 次 × 每次 n^α → O(n^α log n)，對但不緊
FRAG.push(['dcmit2-div-naive', '除法粗估：log n · n^α', async (tok) => {
  fresh([0, 4.2, 13], [0, 3, 0]);
  const bars = [];
  await step(tok);                                   // 2160.1 complexity — a subtlety
  tag('除法的複雜度', 'say', 0, 7.0, 0);
  tag('有個細節（subtlety）', 'note', 4.2, 7.0, 0);
  say('來談除法的複雜度', '有一個 subtlety');
  await step(tok);                                   // 2182.9 division: quadratic convergence
  tag('除法：quadratic convergence', 'ptr alt', -3, 6.3, 0);
  say('除法的 Newton：平方收斂');
  await step(tok);                                   // 2194.7 digits double each step
  for (let k = 0; k < 4; k++) { tag(String(2 ** k), 'pkt', -5 + k * 1.1, 5.6, 0); await ctx.beat(tok, 250); }
  say('正確位數每一步翻倍', '1 → 2 → 4 → 8');
  await step(tok);                                   // 2204.5 d digits → log d iterations
  tag('d 位 → log d 次', 'ptr alt', -1, 5.6, 0);
  say('d 位精度 → log d 次迭代');
  await step(tok);                                   // 2233.2 multiplication Θ(n^α), α ≥ 1
  tag('乘法 Θ(n^α)，α ≥ 1', 'ptr', 3.4, 6.3, 0);
  say('把乘法寫成 Θ(n^α)，α ≥ 1', '不管用哪個乘法演算法都適用');
  await step(tok);                                   // 2254.9 α = 1.46 for Toom-3, etc.
  tag('Toom-3：α = 1.465', 'note', 3.4, 5.6, 0);
  say('例：Toom-3 時 α ≈ 1.465', 'S-S、Fürer 也適用同樣論證');
  await step(tok);                                   // 2278.0 easy question: complexity of division?
  const st = buddy('你', '', B2, 6.0, 0, 2.2, 0.7); st.mood('wow');
  tag('除法 = ？', 'say', 6.0, 1.6, 2.2);
  say('簡單的問題：n 位除法要多久？');
  await step(tok);                                   // 2297.3 how many hard multiplies? log n
  for (let k = 0; k < 6; k++) { const b = bar(RD, -4.5 + k * 0.9, 0, 0.7); bars.push(b); await grow(tok, b, 3.6, 220); tag('n^α', 'idx', -4.5 + k * 0.9, 4.0, 0); }
  tag('log n 次', 'idx', -2.25, 0, 1.2);
  say('要做幾次「困難的」乘法？', 'log n 次，每次 n^α');
  await step(tok);                                   // 2309.8 division = Θ(log n · n^α)
  const th = tag('除法 = Θ(log n · n^α)', 'ptr', 2.8, 4.4, 0);
  st.mood('happy');
  say('所以除法 = Θ(log n · n^α)？');
  await step(tok);                                   // 2344.7 big O — I'm hedging my bets
  strike(th);
  tag('除法 = O(log n · n^α)', 'ptr alt', 2.8, 3.7, 0);
  st.mood('calm');
  say('老師改口：只說 big O', 'big O 是上界，寫大一點也不算錯');
  await step(tok);                                   // 2398.2 each iteration bounded by n^α
  bars.forEach((b) => glow(b, RED));
  say('每次乘法最多 n^α，共 log n 次', '上界正確');
  await step(tok);                                   // 2416.1 can you do a better analysis?
  tag('能分析得更緊嗎？', 'say', 2.8, 2.8, 0.5);
  say('big O 對，但能不能更緊？');
  await step(tok);                                   // 2429.0 like build max-heap: n log n → Θ(n)
  box('build max-heap：n log n → Θ(n)', 2.8, 1.8, 1.2, 4.6, PAPER, 1);
  say('像 build max-heap', '粗估 n log n，細算是 Θ(n)');
  await step(tok);                                   // 2448.7 turn into bank accountants
  tag('當一次「會計師」：仔細加總', 'note', 2.8, 0.6, 1.8);
  say('再當一次會計師：一筆一筆加', '看數字的大小');
}]);

// 40:57 細算：精度 1, 2, 4, …, d → c·1^α + … + c·d^α < 2c·d^α
FRAG.push(['dcmit2-cost-geo', '精度加倍：除法成本 = 乘法成本', async (tok) => {
  fresh([0, 5, 14.5], [0, 3, 0]);
  const al = Math.log2(3), D = [1, 2, 4, 8, 16, 32, 64], c = (d) => Math.pow(d, al), mx = c(64), HM = 4.6;
  const red = [], grn = [];
  await step(tok);                                   // 2456.8 an observation about the size of the numbers
  tag('觀察：這些數字有多大？', 'say', 0, 7.2, 0);
  say('有個觀察：迭代中數字的大小');
  await step(tok);                                   // 2498.4 what do you start with?
  const g = buddy('x₀', '', BUTTER, -6.4, 0, 2.6, 0.6); g.mood('wow');
  say('Newton 一開始手上有什麼？');
  await step(tok);                                   // 2515.6 one digit of precision
  g.set('1 位'); g.mood('happy');
  tag('只有 1 位精度', 'note', -6.4, 1.4, 2.6);
  say('一開始只有 1 位精度', '最後才有 d 位（例如一百萬位）');
  await step(tok);                                   // 2562.0 digits double each step
  tag('位數每步翻倍', 'ptr alt', -3.2, 6.5, 0);
  say('位數每一步翻倍');
  await step(tok);                                   // 2565.5 d-digit multiplies every iteration?
  for (let q = 0; q < D.length; q++) { const b = bar(RD, -5.4 + q * 0.85, -1.4, 0.7); red.push(b); setBar(b, 0.002); }
  await anim(tok, 900, (u) => red.forEach((b) => setBar(b, HM * u)));
  tag('粗估：每次都做 d 位乘法？', 'ptr', -2.8, 5.4, -1.4);
  say('需要每一次都做 d 位乘法嗎？');
  await step(tok);                                   // 2581.4 no: early multiplies are trivial
  red.forEach((b) => { b.material.transparent = true; b.material.opacity = 0.3; });
  tag('不用！前面的乘法很小', 'good', -2.8, 0.6, 1.2);
  say('同學：不用，前面的乘法很簡單', '最後才接近 d^α');
  await step(tok);                                   // 2628.8 precision 1, 2, 4, …, d
  for (let q = 0; q < D.length; q++) { const b = bar(GR, 0.6 + q * 0.85, 1.4, 0.7); grn.push(b); tag(q === D.length - 1 ? 'd' : D[q] + '', 'idx', 0.6 + q * 0.85, 0, 2.2); }
  tag('精度：1, 2, 4, …, d', 'ptr alt', 3.2, 5.4, 1.4);
  say('精度：1, 2, 4, …, d');
  await step(tok);                                   // 2632.5 log d iterations
  tag('共 log d 次', 'idx', 3.2, -0.5, 2.6);
  say('一共 log d 次迭代');
  await step(tok);                                   // 2636.7 initial multiplies easy: constant work
  for (let q = 0; q < 3; q++) await grow(tok, grn[q], 0.06 + HM * c(D[q]) / mx, 300);
  say('前面的乘法很便宜', '數字很小，常數時間');
  await step(tok);                                   // 2651.6 towards the end, a lot more work
  for (let q = 3; q < D.length; q++) await grow(tok, grn[q], 0.06 + HM * c(D[q]) / mx, 300);
  glow(grn[D.length - 1], GOLD);
  say('越到後面，工作量越大');
  await step(tok);                                   // 2672.7 use constants, not thetas
  tag('用常數 c 來加，不要加 Θ', 'note', -2.8, 7.2, 0);
  say('用常數 c 寫，才能放心相加');
  const sb = board(3.2, 6.3, 1.4, 'pkt');
  await step(tok);                                   // 2691.8 c·1^α
  sb('c·1^α');
  say('第一次：c·1^α');
  await step(tok);                                   // 2697.9 c·2^α + c·4^α
  sb('c·1^α + c·2^α + c·4^α + …');
  say('接著 c·2^α、c·4^α…');
  await step(tok);                                   // 2712.5 … + c(d/2)^α + c·d^α
  sb('c·1^α + c·2^α + … + c·(d/2)^α + c·d^α');
  say('最後 c·(d/4)^α + c·(d/2)^α + c·d^α', '總和的上界是多少？');
  await step(tok);                                   // 2749.4 convergent geometric series
  tag('等比級數：每項是前一項的 2^α 倍', 'note', 3.2, 6.9, 1.4);
  say('想想收斂的等比級數');
  await step(tok);                                   // 2766.8 < 2c·d^α
  const tot = bar(TE, 6.6, 1.4, 0.7); await grow(tok, tot, 2 * HM, 700);
  tag('< 2c·d^α', 'good', 6.6, 2 * HM + 0.4, 1.4);
  say('總和 < 2c·d^α', '最後一項主導');
  await step(tok);                                   // 2778.2 better complexity without changing code
  g.mood('happy'); await g.hop(tok);
  say('程式沒改，只是算得更仔細', '複雜度就變好了');
  await step(tok);                                   // 2812.6 division = multiplication
  tag('除法 = Θ(n^α) = 乘法', 'good', -2.8, 5.4, 1.4);
  say('除法的複雜度 = 乘法的複雜度', 'Θ(n^α)');
  await step(tok);                                   // 2844.7 log iterations, but the work is at the end
  say('迭代雖然有 log 次', '大部分工作都在最後幾次');
}]);

// 47:40 開根號的複雜度：兩層 Newton，同樣論證 → Θ(n^α)
FRAG.push(['dcmit2-nested-end', '開根號 = 除法 = 乘法：Θ(n^α)', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.2, 0]);
  const N = nestBoxes();
  let s, d, m;
  await step(tok);                                   // 2859.9 complexity of computing square roots
  tag('最後：開根號的複雜度', 'say', 0, 7.1, 0);
  say('最後談開根號的複雜度');
  await step(tok);                                   // 2870.8 two nested Newton, same argument
  tag('兩層 Newton，同樣的論證', 'note', 3.8, 6.4, 0);
  say('雖然有兩層 Newton', '可以用同樣的論證');
  await step(tok);                                   // 2883.8 we want √a
  s = N.s();
  say('我們要算 √a');
  await step(tok);                                   // 2891.8 10^{2d}·a, run Newton on it
  tag('算 √(10^{2d}·a)', 'idx', 1.8, 5.8, 0);
  say('實際算 √(10^{2d}·a)：外層 Newton');
  await step(tok);                                   // 2906.4 x_{i+1} = (x_i + a/x_i)/2
  tag('x_{i+1} = (x_i + a/x_i)/2', 'ptr alt', 1.8, 5.1, 0);
  tag('黑板漏了 /2', 'note', 4.8, 5.1, 0);
  say('外層迭代：x_{i+1} = (x_i + a/x_i)/2', '（黑板少寫了 /2）');
  await step(tok);                                   // 2924.7 each iteration calls a division
  arrow(V3(-2.4, 5.4, 0), V3(-2.4, 4.5, 0)); d = N.d();
  for (let k = 0; k < 2; k++) { const p = tag('呼叫 ÷', 'pkt', 0.4, 5.6, 0.6); await travel(tok, p, V3(0.4, 5.6, 0.6), V3(0.4, 4.0, 0.6), 500); remove(p); }
  say('外層每一次迭代都呼叫一次除法');
  await step(tok);                                   // 2943.7 each division: Newton, 2x − b x²/R
  arrow(V3(-2.4, 3.6, 0), V3(-2.4, 2.7, 0)); m = N.m();
  tag('2x_i − b·x_i²/R：一串乘法', 'idx', 1.8, 3.1, 0);
  say('每次除法又是 Newton：一串乘法');
  await step(tok);                                   // 2968.3 division = multiplication (numbers grow)
  glow(d, GREEN); glow(m, GREEN);
  tag('÷ = ×：數字由小長大', 'good', 1.8, 2.3, 0);
  say('剛才證過：除法 = 乘法', '因為數字從小長到大');
  await step(tok);                                   // 2989.1 same argument for this level
  say('外層用完全一樣的論證');
  await step(tok);                                   // 2996.8 √2: start guessing 1.5
  const g = buddy('x₀', '1.5', BUTTER, 4.6, 0, 2.6, 0.6); g.mood('calm');
  say('√2 一開始猜 1.5', '只有很少的精度位數');
  await step(tok);                                   // 3007.0 eventually a million digits
  const DD = [1, 2, 4, 8, 16, 32];
  for (let k = 0; k < DD.length; k++) { const b = bar(GR, 1.4 + k * 0.75, 1.4, 0.5); await grow(tok, b, 0.12 + 2.4 * DD[k] / 32, 200); }
  g.set('百萬位'); g.mood('wow');
  say('最後長到一百萬位');
  await step(tok);                                   // 3014.6 √ = ÷ = ×
  glow(s, GREEN); g.mood('happy');
  tag('√ = ÷ = ×', 'good', -5.6, 4.0, 0);
  say('開根號 = 除法 = 乘法的複雜度');
  await step(tok);                                   // 3034.5 code: two nested loops
  tag('程式：兩層巢狀迴圈', 'note', -5.6, 6.2, 0);
  say('程式比較複雜：兩層巢狀迴圈', '× 被 ÷ 叫很多次，÷ 被 √ 叫很多次');
  await step(tok);                                   // 3051.6 most work at millions of digits
  say('但數字由小長大', '大部分工作在百萬位的時候');
  await step(tok);                                   // 3058.8 Θ(n^α)
  tag('n 位開根號 = Θ(n^α)', 'ptr', 0, 0.6, 2.4);
  await g.hop(tok);
  say('乘法 Θ(n^α) → 開根號 Θ(n^α)', 'n 位精度');
}]);

// ═════════════ Rec12：JRgIXyEPnbA ═════════════

// 01:19 小學乘法：1234 × 5678，n 個部分積、每個 n 位 → n²
FRAG.push(['dcmit2-gradeschool', '小學直式乘法：1234 × 5678', async (tok) => {
  fresh([0, 4.2, 12], [0, 3.6, 0]);
  const S = 0.55, R0 = 3.4, put = (s, y, col, drop = 0, z = 0) => s.split('').map((c, i, a) => dig(c, R0 - (a.length - 1 - i) * S, y, 0, i >= a.length - z ? MINT : col, drop));
  const kid = buddy('小學的你', '', PEACH, -5.2, 0, 1.8, 0.8);
  const rows = [['9872', 0, 8], ['8638', 1, 7], ['7404', 2, 6], ['6170', 3, 5]], R = [];
  await step(tok);                                   // 83.8 multiply two numbers the elementary-school way
  put('1234', 6.6, B2, 1); const m = put('5678', 6.0, P2, 1); tag('×', 'ptr', R0 - 4.5 * S, 6.0);
  line(R0 - 7 * S, 5.6, R0 + 0.4, 5.6);
  kid.mood('happy');
  say('假設不會 Karatsuba：小學怎麼乘？', '1234 × 5678');
  await step(tok);                                   // 98.8 take one digit of the second number
  glow(m[3], GOLD);
  say('一次拿第二個數的一位', '從最右邊的 8 開始');
  for (let k = 0; k < 4; k++) {
    await step(tok);                                 // 113.8 ×8 / 118.8 ×7 / 126.8 ×6 / 131.8 ×5
    const [p, z, d] = rows[k]; m.forEach((c) => glow(c, null)); glow(m[3 - k], GOLD);
    R.push(put(p + '0'.repeat(z), 5.1 - k * 0.6, PAPER, 1, z));
    say('1234 × ' + d + ' = ' + p + (z ? '，後面補 ' + z + ' 個 0' : ''), z ? '往左移 ' + z + ' 位' : '寫在下面');
  }
  await step(tok);                                   // 138.8 add these up
  m.forEach((c) => glow(c, null));
  line(R0 - 7 * S, 2.6, R0 + 0.4, 2.6);
  put('7006652', 2.2, GR, 1);
  say('部分積加起來 = 7006652');
  await step(tok);                                   // 144.8 running time? why n²?
  tag('為什麼是 n²？', 'say', -5.2, 2.0, 1.8); kid.mood('wow');
  say('執行時間是多少？為什麼是 n²？');
  await step(tok);                                   // 167.8 as many partial products as digits
  R.forEach((r) => r.forEach((c) => glow(c, GOLD)));
  tag('n 個部分積', 'ptr alt', -2.2, 4.2, 0);
  say('第二個數有 n 位 → n 個部分積');
  await step(tok);                                   // 175.8 each partial product ~n digits (2n)
  tag('每個約 n 位（最長 2n）', 'ptr alt', -2.2, 3.5, 0);
  say('每個部分積約 n 位', '最長到 2n 位，常數不重要');
  await step(tok);                                   // 192.8 add n numbers of O(n) → n²
  tag('n × O(n) = Θ(n²)', 'bad', -2.2, 2.2, 0); kid.mood('calm');
  say('加 n 個 O(n) 位的數', 'n × O(n) = Θ(n²)');
}]);

// 03:23 Karatsuba：n 位拆成兩個 n/2，3 次乘法 + 加法 → n^(log₂3)
FRAG.push(['dcmit2-karat-split', 'Karatsuba：拆半、3 次乘法', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.2, 0]);
  const ka = buddy('Karatsuba', '', TE, -5.6, 0, 2.0, 0.8);
  await step(tok);                                   // 202.8 why is Karatsuba better?
  tag('Karatsuba 為什麼比較好？', 'say', 0, 7.0, 0);
  say('Karatsuba 為什麼比較好？');
  await step(tok);                                   // 224.8 faster (not simpler)
  tag('比較快 ✓', 'good', -1.6, 6.3, 0); tag('比較簡單 ✗', 'bad', 1.6, 6.3, 0);
  ka.mood('happy');
  say('因為比較快', '不是比較簡單');
  await step(tok);                                   // 241.8 n^(log₂3): between 1.5 and 2
  line(-5, 1.0, 5, 1.0, 0, BROWN);
  for (const [v, s] of [[1, '1'], [1.5, '1.5'], [2, '2']]) tag(s, 'idx', -5 + (v - 1) * 10, 0.6);
  const d = cube('', GR, [0.3, 0.3, 0.3], -5 + (Math.log2(3) - 1) * 10, 1.0, 0); glow(d, GREEN);
  tag('log₂3 ≈ 1.585', 'ptr alt', -5 + (Math.log2(3) - 1) * 10, 1.6);
  say('時間 n^(log₂3)：指數在 1.5 和 2 之間', '沒有革命性，但比 n² 好');
  await step(tok);                                   // 252.8 how do we get this? the recurrence
  const rb = board(3.8, 4.6, 0, 'pkt'); rb('T(n) = ？');
  say('怎麼得到的？看遞迴式');
  await step(tok);                                   // 274.8 two numbers with n digits
  const x = box('n 位', -3.2, 5.4, 0, 3.6, B1, 1), y = box('n 位', 1.0, 5.4, 0, 3.6, P1, 1);
  say('兩個 n 位數');
  await step(tok);                                   // 287.8 split into n/2 and n/2
  kill(x); kill(y);
  box('n/2', -4.1, 5.4, 0, 1.75, B1); box('n/2', -2.3, 5.4, 0, 1.75, B2);
  box('n/2', 0.1, 5.4, 0, 1.75, P1); box('n/2', 1.9, 5.4, 0, 1.75, P2);
  say('各拆成兩個 n/2 位');
  await step(tok);                                   // 298.8 only three multiplications + additions
  for (let k = 0; k < 3; k++) box('n/2 × n/2', -3.8 + k * 2.8, 3.8, 0, 2.5, OR, 1.2);
  rb('T(n) = 3T(n/2) + O(n)');
  say('只用 3 次 n/2 位乘法 + 一些加法', 'T(n) = 3T(n/2) + O(n)');
  await step(tok);                                   // 304.8 multiplications expensive, additions cheap
  tag('乘法：貴', 'bad', -1.0, 2.9, 0.6); tag('加法：便宜 O(n)', 'good', 2.2, 2.9, 0.6);
  say('乘法貴、加法便宜');
  await step(tok);                                   // 334.8 details in the notes — remember for the exam
  tag('哪 3 次乘法：看講義、考前記熟', 'note', 3.6, 2.0, 1.4); ka.mood('wow');
  say('3 次乘法的細節在講義', '考前記得');
}]);

// 06:01 A B C D：(10^{n/2}A + B)(10^{n/2}C + D) 有 4 個乘法；乘 10ⁿ 只是補 0
FRAG.push(['dcmit2-abcd', 'A B C D：硬算要 4 次乘法', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.2, 0]);
  await step(tok);                                   // 360.8 label the halves A, B, C, D
  const A = box('A', -4, 6.4, 0, 1.6, B1, 1), B = box('B', -2.4, 6.4, 0, 1.6, B2, 1), C = box('C', 1.2, 6.4, 0, 1.6, P1, 1), D = box('D', 2.8, 6.4, 0, 1.6, P2, 1);
  tag('×', 'ptr', -0.6, 6.4);
  const cnt = tag('乘法 0 次', 'ptr alt', 5.4, 4.6);
  say('兩半分別叫 A、B 和 C、D');
  await step(tok);                                   // 380.8 (10^{n/2}A + B)(10^{n/2}C + D)
  tag('(10^{n/2}·A + B) · (10^{n/2}·C + D)', 'pkt', -0.6, 5.6);
  say('硬算：(10^{n/2}·A + B)(10^{n/2}·C + D)', '以 10 為基底');
  await step(tok);                                   // 400.8 = 10ⁿAC + 10^{n/2}(AD + BC) + BD
  tag('= 10ⁿ·AC + 10^{n/2}·(AD + BC) + BD', 'ptr alt', -0.6, 4.9);
  say('展開', '10ⁿ·AC + 10^{n/2}·(AD + BC) + BD');
  await step(tok);                                   // 416.8 multiplication × 4
  const P = [[A, C, 'AC'], [A, D, 'AD'], [B, C, 'BC'], [B, D, 'BD']], pb = [];
  for (let k = 0; k < 4; k++) { const [p, q, t] = P[k]; glow(p, GOLD); glow(q, GOLD); pb.push(box(t, -4.5 + k * 1.9, 3.9, 0, 1.6, OR, 1)); txt(cnt, '乘法 ' + (k + 1) + ' 次'); await ctx.beat(tok, 450); glow(p, null); glow(q, null); }
  say('乘法、乘法、乘法、乘法');
  await step(tok);                                   // 427.8 four n/2 multiplications for one n
  tag('4 次 n/2 位 → 1 次 n 位', 'note', 5.4, 3.9);
  say('用 4 次 n/2 位乘法', '換 1 次 n 位乘法');
  await step(tok);                                   // 433.8 T(n) = 4T(n/2) + O(n)
  tag('T(n) = 4T(n/2) + O(n)', 'ptr', -0.6, 3.1);
  say('遞迴式：T(n) = 4T(n/2) + O(n)');
  await step(tok);                                   // 444.8 T_bad: recursion tree → n²
  tag('T_bad = Θ(n²)：沒加速', 'bad', -0.6, 2.5);
  say('這是 T_bad', 'recursion tree 算出來還是 n²');
  await step(tok);                                   // 463.8 Karatsuba did it with three
  const ka = buddy('Karatsuba', '3', TE, 6.0, 0, 2.2, 0.7); ka.mood('happy');
  say('Karatsuba 想出只用 3 次的方法');
  await step(tok);                                   // 483.8 this isn't an actual multiplication (10ⁿ)
  tag('乘 10ⁿ 不是真的乘法', 'say', -4.2, 1.7, 1.0);
  say('乘 10ⁿ 不是真的乘法');
  await step(tok);                                   // 485.8 number stored in a Python list
  '1234'.split('').forEach((c, i) => dig(c, -4.8 + i * 0.55, 0.9, 1.0, B2, 1));
  tag('Python list', 'idx', -5.6, 0.3, 1.0);
  say('數字存在 Python list 裡', '一格一個 digit');
  await step(tok);                                   // 495.8 append n zeros
  for (let k = 0; k < 4; k++) { dig('0', -2.6 + k * 0.55, 0.9, 1.0, MINT, 1); await ctx.beat(tok, 250); }
  say('乘 10ⁿ = 在後面 append n 個 0');
  await step(tok);                                   // 513.8 O(n): counts as an addition — free
  tag('O(n)：算加法等級，免費', 'good', -1.4, 0.2, 1.4);
  pb.forEach((b) => glow(b, RED));
  say('補 0 是 O(n)：免費', '貴的是那 4 次乘法');
  await step(tok);                                   // 558.8 10^{n/2} shifts left by n/2 digits
  tag('10^{n/2}·A：A 往左移 n/2 位', 'note', 2.6, 1.5, 1.4);
  say('10^{n/2}·A：把 A 往左移 n/2 位', '再加上 B');
  await step(tok);                                   // 565.8 left half, right half — same number
  glow(A, GOLD); glow(B, GOLD);
  say('只是在說：A 是左半、B 是右半', '還是同一個數');
  await step(tok);                                   // 583.8 not three of these four
  glow(A, null); glow(B, null);
  tag('不是這 4 個裡的其中 3 個', 'note', 6.0, 1.5, 2.2);
  say('Karatsuba 的 3 次不是從這 4 個挑 3 個', '要再想一下（講義有）');
  await step(tok);                                   // 608.8 the difference between 4 and 3 matters
  txt(cnt, '4 → 3'); await ka.hop(tok);
  say('4 和 3 的差別很重要', 'n² → n^1.58');
  void C; void D;
}]);

// 10:26 Newton：找 f 的根；初始猜測 → 切線 → 和 x 軸交點 → 再來一次
FRAG.push(['dcmit2-tangent-walk', 'Newton：切線一路逼近根', async (tok) => {
  fresh([0, 3.6, 12.5], [0, 2.8, 0]);
  const f = (x) => x * x / 2 - 2, df = (x) => x, X = (x) => -5.5 + x * 2.5, Y = (y) => 1.6 + y * 0.6;
  let x = 4;
  await step(tok);                                   // 626.8 Newton — the hard stuff
  const nw = buddy('Newton', '', B2, -6.0, 0, 2.6, 0.7);
  tag('難的部分來了', 'say', -6.0, 1.6, 2.6);
  say('換 Newton：這才是難的部分');
  await step(tok);                                   // 643.8 lets you compute square roots
  box('√ 開根號', 3.2, 7.0, 0, 2.4, B1, 1);
  say('用途一：開根號');
  await step(tok);                                   // 658.8 division, definitely
  box('÷ 除法', 5.8, 7.0, 0, 2.2, P1, 1);
  say('用途二：除法', '乘法用 Newton 大概不會更快');
  await step(tok);                                   // 677.8 a function that looks like this
  line(X(0), Y(0), X(4.6), Y(0), 0, BROWN); tag('x', 'idx', X(4.7), Y(0));
  curve(f, 0.3, 4.3, X, Y);
  tag('f(x)（示意）', 'ptr', X(4.2), Y(f(4.2)) + 0.4);
  say('有一個函數 f');
  await step(tok);                                   // 683.8 find a root x0: f(x0) = 0
  const r = cube('', GR, [0.22, 0.22, 0.22], X(2), Y(0), 0); glow(r, GREEN);
  tag('根 x₀：f(x₀) = 0', 'good', X(2), Y(0) - 0.45);
  say('Newton 幫我們找函數的根', 'f(x₀) = 0');
  await step(tok);                                   // 697.8 set up f so that the answer is a root
  tag('先把「答案」設計成某個 f 的根', 'note', 1.6, 6.2, 0);
  say('要用 Newton：先把答案設計成 f 的根');
  await step(tok);                                   // 735.8 initial guess
  const g = buddy('x', String(x), BUTTER, X(x), Y(0), 0.4, 0.45);
  tag('initial guess', 'ptr alt', X(x), Y(0) - 0.45, 0.4);
  say('從一個初始猜測出發', 'initial guess');
  await step(tok);                                   // 743.8 too far off → may not converge
  tag('差太遠：可能不收斂、或收斂太慢', 'bad', 1.6, 5.5, 0);
  g.mood('wow');
  say('猜得太遠：可能不收斂', '或收斂得不夠快');
  await step(tok);                                   // 751.8 start somewhere pretty close
  g.mood('calm');
  say('假設從這裡出發：不太遠');
  await step(tok);                                   // 767.8 best line: the tangent
  const t0 = 2.3, t1 = 4.4;
  line(X(t0), Y(f(x) + df(x) * (t0 - x)), X(t1), Y(f(x) + df(x) * (t1 - x)), 0, '#1f3a6e');
  line(X(x), Y(0), X(x), Y(f(x)), 0, '#a99470');
  say('用直線近似函數：最好的直線是切線');
  await step(tok);                                   // 776.8 if f were linear: one step
  tag('f 是直線的話：一步到位', 'note', 4.2, 4.8, 0.5);
  say('如果函數本身是直線', '一步就到答案');
  await step(tok);                                   // 795.8 root of the tangent: hits the x-axis
  let nx = x - f(x) / df(x);
  await walk(tok, g, X(nx), 0.4, 800); g.set(nx);
  say('找切線的根：和 x 軸的交點', 'x = ' + nx);
  await step(tok);                                   // 809.8 next guess; iterate
  x = nx;
  for (let k = 0; k < 2; k++) {
    nx = x - f(x) / df(x);
    line(X(x), Y(0), X(x), Y(f(x)), 0, '#a99470');
    line(X(nx), Y(0), X(x), Y(f(x)), 0, '#1f3a6e');
    await walk(tok, g, X(nx), 0.4, 700); g.set(nx.toFixed(3)); x = nx;
  }
  say('交點就是下一個猜測：再畫切線', '4 → 2.5 → 2.05 → 2.0006');
  await step(tok);                                   // 820.8 get there pretty fast
  g.mood('happy'); await g.hop(tok); nw.mood('happy');
  say('很快就到根了');
}]);

// 13:52 推導：tan α = f(x)/(x − x′) = f′(x) → x′ = x − f(x)/f′(x)
FRAG.push(['dcmit2-triangle', '切線三角形：x′ = x − f(x)/f′(x)', async (tok) => {
  fresh([0, 3.6, 12], [0, 2.8, 0]);
  const f = (x) => x * x / 2 - 2, X = (x) => -5.5 + x * 2.6, Y = (y) => 1.2 + y * 0.72;
  const x = 4, xp = 2.5;
  await step(tok);                                   // 831.8 turn the drawing into an equation
  line(X(0.8), Y(0), X(4.6), Y(0), 0, BROWN);
  curve(f, 1.2, 4.4, X, Y);
  line(X(xp), Y(0), X(x), Y(f(x)), 0, '#1f3a6e');
  tag('圖 → 可以寫進 Python 的式子', 'say', 2.0, 6.9, 0);
  say('把圖變成可以寫進 Python 的式子');
  await step(tok);                                   // 842.8 current guess x, next guess x′
  tag('x（目前）', 'ptr alt', X(x), Y(0) - 0.45); tag("x′（下一個）", 'ptr alt', X(xp), Y(0) - 0.45);
  say('目前的猜測叫 x，下一個叫 x′');
  await step(tok);                                   // 847.8 this line: the base
  const h = cube('', B1, [X(x) - X(xp), 0.08, 0.08], (X(x) + X(xp)) / 2, Y(0), 0); glow(h, GOLD);
  tag("底 = x − x′", 'ptr', (X(x) + X(xp)) / 2, Y(0) + 0.45);
  say("底邊：x 和 x′ 的距離");
  await step(tok);                                   // 858.8 f(x)
  const v = cube('', RD, [0.08, Y(f(x)) - Y(0), 0.08], X(x), (Y(0) + Y(f(x))) / 2, 0); glow(v, RED);
  tag('高 = f(x)', 'ptr', X(x) + 0.8, (Y(0) + Y(f(x))) / 2);
  say('高：f(x)');
  await step(tok);                                   // 868.8 this angle
  tag('α', 'pkt', X(xp) + 0.6, Y(0) + 0.25);
  say('還有這個角 α', '直角三角形');
  await step(tok);                                   // 889.8 the tangent of α?
  const q = tag('tan α = ？', 'say', -3.6, 5.4, 0);
  say('角 α 的 tan 是多少？');
  await step(tok);                                   // 939.8 tangent at a point = derivative
  tag('切線斜率 = 導數 f′(x)', 'good', -3.6, 4.7, 0);
  say('函數在某點的切線斜率 = 導數 f′(x)');
  await step(tok);                                   // 961.8 right triangle: f(x) / (x − x′)
  txt(q, "tan α = f(x) / (x − x′)");
  say("直角三角形：tan α = 高 / 底", "= f(x) / (x − x′)");
  await step(tok);                                   // 968.8 … = f′(x)
  const cd = code(["f′(x) = f(x) / (x − x′)", "x − x′ = f(x) / f′(x)", "x′ = x − f(x) / f′(x)"], 2.8, 6.0, 0.6);
  cd.ls.forEach((l, i) => { if (i) l.element.style.visibility = 'hidden'; }); cd.hl(0);
  say("兩個都是斜率：f′(x) = f(x)/(x − x′)");
  await step(tok);                                   // 997.8 solve for x′
  say("解出 x′：給一個猜測，算下一個", '越來越接近根');
  await step(tok);                                   // 1023.8 writes x′ − x = f′/f (wrong)
  const w = tag("x′ − x = f′(x)/f(x) ？", 'bad', 2.8, 4.2, 0);
  say('老師寫成 f′/f', '分子分母放反了');
  await step(tok);                                   // 1083.8 student: f over f′
  strike(w);
  tag('同學：是 f/f′！', 'say', 5.6, 3.6, 0);
  say('同學糾正：是 f(x)/f′(x)', '不是 f′/f');
  await step(tok);                                   // 1126.8 the guess is to the right: x − x′
  cd.ls[1].element.style.visibility = ''; cd.hl(1);
  say("x 在右邊，所以底是 x − x′", '另一個錯：正負號');
  await step(tok);                                   // 1141.8 walk against the derivative
  arrow(V3(X(x), Y(0) + 0.9, 0.4), V3(X(xp) + 0.2, Y(0) + 0.9, 0.4), 0x0f5a3a);
  tag('逆著導數走 ✓', 'good', (X(x) + X(xp)) / 2, Y(0) + 1.35, 0.4);
  say('記法：逆著導數走');
  await step(tok);                                   // 1156.8 with the derivative: away from the root
  arrow(V3(X(x), Y(0) + 0.9, 0.4), V3(X(4.5), Y(0) + 0.9, 0.4), 0x7a1010);
  tag('順著走：越來越遠 ✗', 'bad', X(4.5) + 0.4, Y(0) + 1.35, 0.4);
  say('順著導數走', '會離解越來越遠');
  await step(tok);                                   // 1191.8 two ways to remember
  tag('記法 ②：從 x 減掉一個量', 'note', -3.6, 3.9, 0);
  say('兩種記法：逆著導數走', '或：從猜測減掉一個量');
  await step(tok);                                   // 1214.8 this is how you iterate
  cd.ls[2].element.style.visibility = ''; cd.hl(2);
  say("Newton 迭代：x′ = x − f(x)/f′(x)");
  void v; void h;
}]);

// 20:38 用 Newton 算 a/b：需要什麼；先改成 1/b；R = 10^d，Python list 補 0 = 乘 R、slice = 除 R
FRAG.push(['dcmit2-list-shift', 'R = 10^d：補 0 與 slice', async (tok) => {
  fresh([0, 4.2, 12.5], [0, 3.2, 0]);
  const nw = buddy('Newton', '', B2, -6.2, 0, 2.4, 0.7);
  const zs = [];
  await step(tok);                                   // 1237.8 what do we need for Newton?
  tag('用 Newton 需要什麼？', 'say', 0, 7.0, 0);
  say('要用 Newton，需要什麼？');
  await step(tok);                                   // 1247.8 evaluate f/f′ for any x, fast
  box('能快速算出 f(x)/f′(x)', -3, 6.2, 0, 3.6, PAPER, 1);
  tag('Newton 把它當黑盒子', 'note', -3, 5.6, 0);
  say('對任何 x 都要能算 f(x)/f′(x)', '而且要夠快');
  await step(tok);                                   // 1274.8 compute a/b — what do we need?
  tag('目標：a/b', 'ptr alt', 2.6, 6.2, 0);
  say('例：用 Newton 算 a/b，需要什麼？');
  await step(tok);                                   // 1318.8 we need the function
  tag('f = ？', 'say', 2.6, 5.5, 0);
  say('要先想出函數 f');
  await step(tok);                                   // 1346.8 f(a/b) = 0
  box('① f(a/b) = 0', 2.6, 4.8, 0, 3.0, MINT, 1);
  say('條件一：f(a/b) = 0', 'Newton 找到的根就是答案');
  await step(tok);                                   // 1356.8 f/f′ without division
  box('② f/f′ 不能用到除法', 2.6, 4.0, 0, 3.4, MINT, 1);
  nw.mood('wow');
  say('條件二：算 f/f′ 不能用除法', '否則用除法算除法，沒意義');
  await step(tok);                                   // 1372.8 simplify to 1/b
  box('先算 1/b', -3, 4.6, 0, 2.4, BUTTER, 1);
  say('簡化：先算 1/b');
  await step(tok);                                   // 1379.8 then multiply by a
  tag('× a → a/b', 'pkt', -3, 3.9, 0);
  say('有了 1/b，乘上 a 就是 a/b');
  await step(tok);                                   // 1392.8 integers only, no floating point
  tag('只用整數，不碰浮點數', 'note', -3, 3.3, 0);
  say('只想用整數，不想碰浮點數');
  await step(tok);                                   // 1411.8 1/b = 0.xxx — not an integer
  tag('1/b = 0.xxxx… 不是整數', 'bad', 0.6, 3.0, 0.5);
  say('1/b 長得像 0.xxx', '不是整數');
  await step(tok);                                   // 1421.8 d digits: shift the point right by d
  tag('要 d 位 → 小數點右移 d 位', 'ptr alt', 0.6, 2.4, 0.5);
  say('要 d 位精度：把小數點往右移 d 位');
  await step(tok);                                   // 1434.8 multiply by 10^d: compute R/b
  tag('R/b，R = 10^d', 'good', 4.6, 2.4, 0.5);
  say('乘上 10^d：改算 R/b', 'R = 10^d');
  await step(tok);                                   // 1457.8 (R/b)·a, then everything / R
  tag('a/b = (R/b) · a / R', 'ptr', 4.6, 3.0, 0.5);
  say('a/b = (R/b) · a / R');
  await step(tok);                                   // 1472.8 multiply by R: append d zeros; divide?
  const ds = '1234'.split('').map((c, i) => dig(c, -4.4 + i * 0.6, 1.0, 1.2, B2, 1));
  tag('Python list', 'idx', -5.4, 0.3, 1.2);
  for (let k = 0; k < 3; k++) { zs.push(dig('0', -2 + k * 0.6, 1.0, 1.2, MINT, 1)); await ctx.beat(tok, 250); }
  tag('append d 個 0 = × R', 'good', -0.8, 1.9, 1.2);
  say('乘 R：後面補 d 個 0', '那除以 R 呢？');
  await step(tok);                                   // 1486.8 Python list: slice off the last d digits
  for (let k = 0; k < 3; k++) { kill(zs[k]); await ctx.beat(tok, 200); }
  for (let k = 1; k < 4; k++) { kill(ds[k]); await ctx.beat(tok, 200); }
  tag('slice 掉最後 d 位 = ÷ R', 'good', 2.6, 1.0, 1.2);
  say('除以 R：slice 掉最後 d 位', '1234 → 1（÷ 10³）');
  await step(tok);                                   // 1495.8 add digits = multiply, slice = divide
  say('補 0 = 乘法，slice = 除法', '兩個都只要 O(d)');
  await step(tok);                                   // 1507.8 easy division / easy multiplication
  nw.mood('happy'); await nw.hop(tok);
  say('這種除法、乘法都很簡單');
}]);

// 25:26 選函數：x − R/b 行不通；1/x − b/R → x′ = 2x − b·x²/R
FRAG.push(['dcmit2-two-funcs', '選 f：x − R/b 不行，1/x − b/R 可以', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.2, 0]);
  const c1 = code(['f(x) = x − R/b', 'f′(x) = 1', 'f/f′ = x − R/b'], -3.6, 6.4, 0.6);
  const c2 = code(['f(x) = 1/x − b/R', 'f′(x) = −1/x²', 'f/f′ = −x + b·x²/R', "x′ = x − f/f′ = 2x − b·x²/R"], 2.4, 6.4, 0.6);
  const hideAll = (c) => c.ls.forEach((l) => { l.element.style.visibility = 'hidden'; });
  const show = (c, i) => { c.ls[i].element.style.visibility = ''; c.hl(i); };
  hideAll(c1); hideAll(c2);
  const st = buddy('同學', '', PEACH, -6.0, 0, 2.2, 0.7);
  await step(tok);                                   // 1525.8 can I use x − R/b?
  show(c1, 0);
  say('能不能用 f(x) = x − R/b？', '根確實是 R/b');
  await step(tok);                                   // 1543.8 f′(x) = 1
  show(c1, 1);
  say("f′(x) = 1");
  await step(tok);                                   // 1564.8 f/f′ = x − R/b
  show(c1, 2);
  say('f/f′ = x − R/b');
  await step(tok);                                   // 1571.8 to evaluate it you need R/b already
  tag('要先知道 R/b 才算得出來！', 'say', -3.6, 4.4, 0);
  st.mood('wow');
  say('要算它，就得先知道 R/b', '知道的話，答案早就有了');
  await step(tok);                                   // 1597.8 can't use this function
  const bad = box('✗ 不能用', -3.6, 3.5, 0, 2.6, RD, 1); glow(bad, RED);
  say('這個簡單的函數不能用');
  await step(tok);                                   // 1636.8 try 1/x − b/R
  show(c2, 0);
  say('改試 f(x) = 1/x − b/R');
  await step(tok);                                   // 1645.8 b/R is an easy division (shift)
  tag('b/R：除以 R = shift，好算', 'good', 2.4, 4.0, 0);
  say('b/R 是好算的除法', '除以 R 只是 shift');
  await step(tok);                                   // 1698.8 f/f′ = ?
  show(c2, 1); show(c2, 2);
  tag('影片說 x + x²b/R，正確是 −x + b·x²/R', 'note', 2.4, 3.3, 0.5);
  say('f′ = −1/x²，f/f′ = −x + b·x²/R');
  await step(tok);                                   // 1735.8 x′ = x − f/f′
  show(c2, 3);
  say("x′ = x − f/f′ = 2x − b·x²/R");
  await step(tok);                                   // 1780.8 one division: a shift
  const ok = box('唯一的除法：÷R = shift', 2.4, 2.4, 0.5, 4.2, GR, 1); glow(ok, GREEN);
  say('剩下幾個除法？只有 ÷R', 'R = 10^d，就是 shift');
  await step(tok);                                   // 1793.8 multiplication: Karatsuba
  box('乘法：用剛學的 Karatsuba', 2.4, 1.6, 0.8, 4.2, OR, 1);
  say('乘法用剛學的 Karatsuba');
  await step(tok);                                   // 1797.8 solving division by division doesn't work
  st.mood('happy');
  tag('用除法算除法：行不通', 'bad', -3.6, 2.6, 0);
  say('用除法去解除法，是行不通的', '所以要把除法換成乘法');
  await step(tok);                                   // 1815.8 error formulas in the notes; remember the trick
  tag('記住這招：讓 f/f′ 只剩會的運算', 'note', 0, 0.6, 1.6);
  say('誤差公式在講義', '要記的是這個技巧');
}]);

// 30:27 ∛a 到 d 位：算 ∛(10^{3d}·a)；f = x³ − a → x′ = (2/3)x + (1/3)·a/x²
FRAG.push(['dcmit2-cuberoot', '∛a：f(x) = x³ − a', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.2, 0]);
  const cd = code(['f(x) = x³ − a', 'f′(x) = 3x²', "x′ = x − (x³ − a)/(3x²)", '   = (3x³ − x³ + a)/(3x²)', '   = (2x³ + a)/(3x²)', '   = (2/3)·x + (1/3)·a/x²'], -1.4, 4.9, 0.52);
  cd.ls.forEach((l) => { l.element.style.visibility = 'hidden'; });
  const show = (i) => { cd.ls[i].element.style.visibility = ''; cd.hl(i); };
  const nw = buddy('Newton', '', B2, -6.2, 0, 2.4, 0.7);
  await step(tok);                                   // 1826.8 new example: cube root
  box('∛a', -4.4, 6.6, 0, 1.6, PAPER, 1);
  say('新例子：用 Newton 算 ∛a', '三次方根，不是平方根');
  await step(tok);                                   // 1867.8 first step: we need f
  tag('第一步：找 f', 'say', -1.6, 6.6, 0);
  say('第一步：需要一個函數 f');
  await step(tok);                                   // 1886.8 d digits; ∛2 gives fractions
  tag('∛2 = 1.2599…：有小數', 'note', 2.6, 6.6, 0);
  say('要 d 位精度', '∛2 有小數，不想處理分數');
  await step(tok);                                   // 1910.8 10^d shifts the point
  const t = box('10^d · ∛a', -4.4, 5.8, 0, 2.6, MINT, 1);
  say('乘上 10^d：小數點右移 d 位');
  await step(tok);                                   // 1926.8 10^d inside the root: 10^{3d}·a
  txt(t.userData.lbl, '10^d · ∛a = ∛(10^{3d} · a)');
  say('把 10^d 搬進根號', '變成 ∛(10^{3d} · a)');
  await step(tok);                                   // 1932.8 don't forget this 3
  glow(t, GOLD); tag('別忘了這個 3！', 'bad', -1.2, 5.8, 0);
  say('別忘了這個 3', '漏掉就算錯東西');
  await step(tok);                                   // 1948.8 integers, then shift right by d
  tag('整數算完 → 右移 d 位 → d 位精度', 'note', 2.6, 1.2, 1);
  say('整數裡算完，再右移 d 位', '就有 d 位精度');
  await step(tok);                                   // 1974.8 f(x) = x³ − a
  show(0);
  say('f(x) = x³ − a');
  await step(tok);                                   // 1982.8 10^{3d}·a becomes the new a
  tag('a ← 10^{3d}·a（整數）', 'pkt', 3.8, 4.9, 0);
  say('把 10^{3d}·a 當成新的 a', '它是整數，不用再除 R');
  await step(tok);                                   // 2003.8 f′(x) = 3x²
  show(1);
  say("f′(x) = 3x²");
  await step(tok);                                   // 2022.8 x′ = x − f/f′
  show(2); nw.mood('wow');
  say("代進 x′ = x − f(x)/f′(x)");
  await step(tok);                                   // 2038.8 (x³ − a)/(3x²)
  say('減掉 (x³ − a)/(3x²)');
  await step(tok);                                   // 2055.8 common denominator → (2x³ + a)/(3x²)
  show(3); await ctx.beat(tok, 700); show(4);
  say('通分：(3x³ − x³ + a)/(3x²)', '= (2x³ + a)/(3x²)');
  await step(tok);                                   // 2073.8 (2/3)x + (1/3)·a/x²
  show(5);
  tag('影片一度寫成 1/3 − a/x²', 'note', 3.8, 2.3, 0);
  say("x′ = (2/3)·x + (1/3)·a/x²");
  await step(tok);                                   // 2087.8 a/x² needs division — have it ready
  tag('a/x²：要用除法（前面做好了）', 'good', 3.8, 3.0, 0);
  say('a/x² 需要除法', '還好前面已經會做除法了');
  await step(tok);                                   // 2101.8 now we have the iteration
  nw.mood('happy'); await nw.hop(tok);
  say('迭代式完成了', '接下來需要初始猜測');
}]);

// 35:22 初始猜測：n 位的 a → 根約 n/3 位，先猜 1·10^{n/3}；第一位查表
FRAG.push(['dcmit2-init-mag', '初始猜測：數量級', async (tok) => {
  fresh([0, 4.2, 13], [0, 3.2, 0]);
  const g = buddy('x₀', '?', BUTTER, -6.0, 0, 2.2, 0.7); g.mood('wow');
  await step(tok);                                   // 2122.8 can't start without the first x
  tag('需要初始猜測 x₀', 'say', 0, 7.0, 0);
  say('沒有第一個 x，迭代就開始不了');
  await step(tok);                                   // 2130.8 the better it is, the faster
  tag('猜得越好 → 收斂越快', 'note', 4.2, 7.0, 0);
  say('猜得越好，收斂越快', '但不想花太多力氣');
  await step(tok);                                   // 2146.8 a is an n-digit number d1 d2 … dn
  const ds = '2000000000'.split('').map((c, i) => dig(c, -4.6 + i * 0.6, 6.0, 0, i ? PAPER : B2, 1));
  tag('a = d₁ d₂ … dₙ（示意 a = 2·10⁹，n = 10）', 'idx', 0.8, 5.3, 0);
  say('a 是 n 位數：d₁ d₂ … dₙ');
  await step(tok);                                   // 2163.8 first approximation?
  say('最粗略的近似是什麼？');
  await step(tok);                                   // 2171.8 a third as many digits
  tag('∛a 的位數 ≈ n/3', 'ptr alt', -2.6, 4.4, 0);
  say('立方根的位數約是 n/3');
  await step(tok);                                   // 2174.8 something × 10^{n/3}
  tag('∛a ≈ ? · 10^{n/3}', 'ptr alt', 2.6, 4.4, 0);
  say('所以 ∛a ≈ 某數 × 10^{n/3}');
  await step(tok);                                   // 2185.8 say that something is 1
  g.set('1·10^{n/3}'); g.mood('happy');
  tag('數量級對了', 'good', -6.0, 1.6, 2.2);
  say('先猜 1 · 10^{n/3}', '數量級正確');
  await step(tok);                                   // 2209.8 order of magnitude + maybe the first digit
  glow(ds[0], GOLD);
  tag('再拿到第一位更好', 'note', 0, 3.6, 0);
  say('好的近似：數量級 + 第一位');
  await step(tok);                                   // 2221.8 how to get the first digit?
  tag('第一位怎麼來？', 'say', 3.8, 3.0, 0);
  say('第一位怎麼拿到？');
  await step(tok);                                   // 2242.8 a table
  const tb = []; for (let d = 1; d <= 9; d++) tb.push(box(d + '³ = ' + d ** 3, -4.8 + ((d - 1) % 5) * 2.1, 2.2 - Math.floor((d - 1) / 5) * 0.75, 1.2, 1.9, MINT, 1));
  say('同學：事先算好一張表', '只有幾個 digit，查表就好');
  await step(tok);                                   // 2252.8 a digit is small: 10, 256, 2^16
  tag('一位 = 0～9、0～255、0～2¹⁶…', 'note', 3.6, 0.6, 1.2);
  say('一位數很小', '基底 10、256、2¹⁶ 或 2³²');
  await step(tok);                                   // 2267.8 fancy algorithms: great for big, awful for small
  tag('複雜的快演算法：大數很棒，小數慢 10～100 倍', 'bad', 0, 0.0, 2.4);
  say('漸進快的演算法只適合大數', '對小數字反而慢 10～100 倍');
  await step(tok);                                   // 2286.8 a tank to hammer a nail
  tag('開坦克去釘釘子', 'say', -6.0, 1.0, 3.2);
  say('像開坦克去釘釘子', '不是對的工具');
  await step(tok);                                   // 2292.8 precomputed list: I like that
  tb.forEach((b) => glow(b, GREEN)); await g.hop(tok);
  say('事先算好的表：好方法');
}]);

// 38:38 初始猜測：基底 2¹⁶ 時對第一位做 binary search（猜³ 比大小）
FRAG.push(['dcmit2-init-bsearch', '初始猜測：對第一位 binary search', async (tok) => {
  fresh([0, 4.2, 13], [0, 3.2, 0]);
  const g = buddy('x₀', '1·10^{n/3}', BUTTER, -6.0, 0, 2.2, 0.7);
  const cs = [];
  await step(tok);                                   // 2317.8 base 10: a table is great
  tag('基底 10：查表就好', 'good', -2.4, 7.0, 0);
  say('基底是 10 的話，查表很好');
  await step(tok);                                   // 2360.8 do it the CS way
  tag('d₁/3 之類的數學近似…', 'note', 2.8, 7.0, 0);
  say('數學上有近似法', '來用 CS 的方法做得更好');
  await step(tok);                                   // 2365.8 guess a digit between 0 and 2^16
  for (let d = 0; d <= 9; d++) cs.push(dig(String(d), -4.4 + d * 0.95, 4.6, 0, PAPER, 1, 0.7));
  tag('一位：0 ～ 2¹⁶（示意：0 ～ 9）', 'idx', 0, 3.9, 0);
  say('基底 2¹⁶：要在 0～2¹⁶ 之間猜一位', '這裡用 0～9 示意');
  await step(tok);                                   // 2392.8 random guessing: terrible
  tag('亂猜？ 不要！', 'bad', 3.8, 5.6, 0);
  say('亂猜：只有「機率上」快', '這種程式很糟');
  await step(tok);                                   // 2424.8 CPU has no cube-root instruction
  prop('cpu', 5.6, 0, 2.4, 0.9, '沒有開根號指令');
  say('CPU 沒有開根號指令', '但有乘法、比較');
  await step(tok);                                   // 2437.8 start in the middle: binary search
  const ptr = tag('猜', 'pkt', -4.4 + 4 * 0.95, 5.4, 0);
  glow(cs[4], GOLD);
  say('binary search：從中間開始猜');
  await step(tok);                                   // 2447.8 too small, too big or just right?
  say('每次要能判斷', '太小、太大、還是剛好');
  await step(tok);                                   // 2450.8 cube the guess, compare with a
  const T = [[4, '4000³ = 6.4·10¹⁰ > a：太大', false], [1, '1000³ = 10⁹ ≤ a：可以', true], [2, '2000³ = 8·10⁹ > a：太大', false]];
  tag('a = 2·10⁹（示意）', 'idx', -3, 3.2, 0);
  for (const [d, s, ok] of T) {
    cs.forEach((c) => glow(c, null)); glow(cs[d], GOLD);
    await travel(tok, ptr, ptr.position.clone(), V3(-4.4 + d * 0.95, 5.4, 0), 350);
    say('猜 ' + d + '：自乘三次，和 a 比', s);
    if (ok) { for (let e = 0; e < d; e++) tint(cs[e], '#bbbbbb'); }
    else { for (let e = d; e <= 9; e++) tint(cs[e], '#bbbbbb'); }
    await ctx.beat(tok, 450);
  }
  tint(cs[1], GR);
  await step(tok);                                   // 2471.8 first digit + order of magnitude
  g.set('1000'); g.mood('happy');
  say('有了第一位和數量級', 'x₀ = 1000');
  await step(tok);                                   // 2482.8 a pretty good guess
  tag('物理題這樣答就滿分了', 'say', -6.0, 1.6, 2.2);
  say('很好的初始猜測');
  await step(tok);                                   // 2520.8 feed it to Newton
  const nw = buddy('Newton', '', B2, 1.0, 0, 2.4, 0.7);
  await pkt(tok, 'x₀ = 1000', V3(-6.0, 1.0, 2.2), V3(1.0, 1.2, 2.4), 900);
  nw.mood('happy');
  say('交給 Newton', 'Newton 收斂快得多');
  await step(tok);                                   // 2529.8 binary search on everything: slower
  tag('整個答案都 binary search：比 Newton 慢', 'note', 3.8, 3.0, 0);
  say('整個答案都用 binary search', '會比 Newton 慢');
  await step(tok);                                   // 2534.8 Q: where did f come from?
  const st = buddy('同學', '', PEACH, 5.4, 0, 0.4, 0.6); st.mood('wow');
  tag('f 是怎麼來的？', 'say', 5.4, 1.4, 0.4);
  say('同學問：f(x) = x³ − a 怎麼想到的？');
  await step(tok);                                   // 2560.8 f/f′ uses only division & multiplication
  tag('試試看：f/f′ 只用會的運算 → 合理', 'good', 0.6, 2.2, 0.5);
  say('試一個 f，算出 f/f′', '只用到會的除法、乘法 → 可以用');
  await step(tok);                                   // 2578.8 computing sin x: don't use sin x
  tag('算 sin x 時，f/f′ 不能有 sin x', 'note', 0.6, 1.5, 0.8);
  st.mood('happy');
  say('算 sin x，f/f′ 裡就不能有 sin x', '道理和除法一樣');
  await step(tok);                                   // 2607.8 binary search is fine for the first approx
  say('binary search 用來拿第一個近似', '這樣沒問題');
  await step(tok);                                   // 2617.8 just a decent guess for Newton
  await nw.hop(tok);
  say('只是給 Newton 一個不錯的起點', '之後全交給 Newton');
}]);

// 43:58 什麼時候停：整數迭代到 x 不再改變
FRAG.push(['dcmit2-cube-iter', '整數迭代：x 不變就停', async (tok) => {
  fresh([0, 4, 12.5], [0, 3, 0]);
  const xs = [1000, 1333, 1263, 1259, 1259], H = (v) => (v - 900) / 450 * 4.2;
  const g = buddy('x', '', BUTTER, -6.4, 0, 1.8, 0.6);
  const put = async (k) => { const b = bar(k === 4 ? GR : k === 3 ? YE : B1, -4.2 + k * 2.1, 0, 1.0); await grow(tok, b, H(xs[k]), 350); tag('x' + '₀₁₂₃₄'[k] + ' = ' + xs[k], 'idx', -4.2 + k * 2.1, H(xs[k]) + 0.35); g.set(xs[k]); };
  await step(tok);                                   // 2637.8 errors: start with an initial guess
  tag("x′ = ⌊(2x + ⌊a/x²⌋) / 3⌋　a = 2·10⁹（示意）", 'ptr alt', 0, 6.6);
  await put(0);
  say('談誤差：從初始猜測出發');
  await step(tok);                                   // 2649.8 better, better, better
  await put(1); await put(2);
  say('一次比一次好');
  await step(tok);                                   // 2657.8 when do we stop?
  tag('什麼時候停？', 'say', -6.4, 1.3, 1.8); g.mood('wow');
  say('什麼時候可以停？');
  await step(tok);                                   // 2679.8 iterate again and nothing changes
  await put(3);
  say('答案：再迭代一次，數字不變', '就停');
  await step(tok);                                   // 2693.8 we compute ∛(10^{3d}·a) with integers
  tag('算的是 ∛(10^{3d}·a)：只用整數', 'note', 3.6, 5.8, 0);
  say('算 ∛(10^{3d}·a)，只用整數');
  await step(tok);                                   // 2707.8 only d digits; the rest discarded
  tag('多的位數自動丟掉', 'note', 3.6, 5.2, 0);
  say('整數只有 d 位精度', '後面的位數自動被丟掉');
  await step(tok);                                   // 2713.8 x6 = x5: no point running
  await put(4);
  tag('x₄ = x₃ → 停！', 'good', 4.2, H(1259) + 1.0);
  g.mood('happy');
  say('兩次的 x 一樣：再跑也不會變', '影片的例子是 x₆ = x₅');
  await step(tok);                                   // 2724.8 done: d digits of precision
  box('1259 → 右移 3 位 → ∛2 ≈ 1.259', 0, 4.6, 1.5, 4.8, MINT, 1);
  await g.hop(tok);
  say('完成：已經有 d 位精度的答案');
}]);

// 45:38 誤差：x_i = x(1 + ε_i)，ε_{i+1} ≈ ε_i²；0 的個數每步翻倍 → log d 步
FRAG.push(['dcmit2-eps-zeros', 'ε 平方：0 的個數每步翻倍', async (tok) => {
  fresh([0, 4.2, 13], [0, 3.2, 0]);
  const E = ['0.1', '0.01', '0.0001', '0.00000001'];
  const row = (k) => { const y = 3.6 - k * 0.7, s = E[k].split(''); tag('step ' + k, 'idx', -6.2, y); s.forEach((c, i) => dig(c, -5.1 + i * 0.42, y, 0, c === '1' ? OR : c === '.' ? '#ffffff' : MINT, 0.8, 0.42)); };
  await step(tok);                                   // 2737.8 x1 = x(1 + ε1)
  tag('x₁ = x(1 + ε₁)', 'ptr', -3.6, 6.8);
  tag('x：真正的答案', 'note', 0.6, 6.8);
  say('x₁ = x(1 + ε₁)', 'x 是真正的答案，ε 是誤差');
  await step(tok);                                   // 2746.8 x2 = x(1 + ε2), …
  tag('x₂ = x(1 + ε₂)、x₃ = x(1 + ε₃)…', 'ptr', -3.6, 6.2);
  say('每一步都寫成 x(1 + ε_i)');
  await step(tok);                                   // 2762.8 eight lines of math in the notes
  prop('file', 5.6, 0, 1.6, 0.9, '講義：八行推導');
  say('推導有八行，在講義裡');
  await step(tok);                                   // 2768.8 x_{i+1} = x(1 + c·ε_i²)
  tag('x_{i+1} = x(1 + c·ε_i²)', 'ptr alt', 2.4, 6.2);
  say('結果：x_{i+1} = x(1 + 常數 · ε_i²)');
  await step(tok);                                   // 2799.8 ε_{i+1} ≈ ε_i²
  tag('ε_{i+1} ≈ ε_i²', 'good', 2.4, 5.5);
  say('所以 ε_{i+1} ≈ ε_i²');
  await step(tok);                                   // 2811.8 quadratic convergence
  say('這就是 quadratic convergence', '平方收斂');
  await step(tok);                                   // 2838.8 want (1 + ε) → 1, ε → 0
  tag('要 1 + ε → 1，也就是 ε → 0', 'say', -2.8, 5.4, 0);
  say('要讓 1 + ε 變成 1', '也就是 ε → 0');
  await step(tok);                                   // 2857.8 ε < 1 → ε² < ε
  tag('ε < 1 時：ε² < ε', 'note', -2.8, 4.7, 0);
  say('ε 小於 1 時，ε² 比 ε 更小');
  await step(tok);                                   // 2869.8 start with 0.1, square → 0.01
  row(0); row(1);
  say('例：ε₀ = 0.1 → 平方 0.01');
  await step(tok);                                   // 2877.8 0.0001
  row(2);
  say('再平方：0.0001');
  await step(tok);                                   // 2881.8 0.00000001
  row(3);
  say('再平方：0.00000001', '好多 0');
  await step(tok);                                   // 2897.8 step i: 2^i digits
  tag('第 i 步 ≈ 2^i 位正確', 'good', -1.4, 1.0, 0.6);
  say('第 i 步大約有 2^i 位正確', '1 → 2 → 4 → 8');
  await step(tok);                                   // 2966.8 x_{i+1} − x_i = x(ε_{i+1} − ε_i)
  tag('x_{i+1} − x_i = x(ε_{i+1} − ε_i)', 'ptr', 3.2, 4.4);
  say('相鄰兩次的差', 'x_{i+1} − x_i = x(ε_{i+1} − ε_i)');
  await step(tok);                                   // 3003.8 floor → 0: done
  tag('整數取 floor：差變 0 就停', 'note', 3.2, 3.8);
  say('整數取 floor 後，差變成 0 就結束');
  await step(tok);                                   // 3022.8 x has d digits
  const d = []; for (let k = 0; k < 8; k++) d.push(dig('d', 1.4 + k * 0.5, 2.8, 0, B2, 1));
  tag('x 有 d 位', 'idx', 3.2, 2.2);
  say('x 有 d 位（d 位精度）');
  await step(tok);                                   // 3036.8 the zeros in ε cancel x's digits
  for (let k = 0; k < 8; k++) { tint(d[k], '#bbbbbb'); await ctx.beat(tok, 180); }
  say('ε 裡的很多 0', '會把 x 的位數抵掉');
  await step(tok);                                   // 3057.8 zeros double each step → log d steps
  tag('0 每步翻倍 → 約 log d 步', 'good', 3.2, 1.4, 0.6);
  say('0 的個數每步翻倍', '約 log d 步就夠');
  await step(tok);                                   // 3082.8 good initial guess + this factor
  tag('初始猜測夠好 + ε² 這個因子 = 收斂快', 'say', 0, 0.2, 1.8);
  say('要有好的初始猜測', '再證明 ε_{i+1} ≈ ε_i²');
}]);

// 51:50 問答：對整個答案 binary search 要 log(10^d) ≈ d 步；Newton 只要 log d 步
FRAG.push(['dcmit2-bs-vs-newton', 'Binary search 整個答案 vs Newton', async (tok) => {
  fresh([0, 4, 12.5], [0, 2.8, 0]);
  const st = buddy('同學', '', PEACH, -6.0, 0, 2.0, 0.7); st.mood('wow');
  await step(tok);                                   // 3109.8 binary search also takes log?
  tag('binary search 不也是 log 步？', 'say', -6.0, 1.7, 2.0);
  say('同學：binary search 不也是 log 步嗎？');
  await step(tok);                                   // 3126.8 whole thing: log of the whole number = Θ(d)
  tag('整個答案：log(整個數) = Θ(d) 步', 'ptr', 0, 6.2);
  say('對整個答案 binary search', '是 log(整個數) ≈ Θ(d) 步');
  await step(tok);                                   // 3155.8 log(10^d)
  tag('d 位的數 ≈ 10^d → log₂(10^d) ≈ 3.3d', 'note', 0, 5.6);
  say('d 位的數大約是 10^d', 'log₂(10^d) ≈ 3.3d 步');
  await step(tok);                                   // 3167.8 d is the number of digits
  const D = [10, 100, 1000];
  for (let k = 0; k < 3; k++) {
    const bs = D[k] * Math.log2(10), nw = Math.log2(D[k]), x = -2.4 + k * 3.2;
    const b1 = bar(RD, x - 0.5, 0, 0.8), b2 = bar(GR, x + 0.5, 0, 0.8);
    await grow(tok, b1, Math.log10(bs) * 1.4, 250); setBar(b2, Math.log10(nw) * 1.4 + 0.1);
    tag(String(Math.round(bs)), 'idx', x - 0.5, Math.log10(bs) * 1.4 + 0.35); tag(nw.toFixed(1), 'idx', x + 0.5, Math.log10(nw) * 1.4 + 0.45);
    tag('d = ' + D[k], 'ptr', x, 0, 1.3);
  }
  tag('紅：binary search ≈ 3.3d　綠：Newton ≈ log₂ d（對數刻度）', 'idx', 0.8, 5.0);
  say('d 是位數，不是數字本身');
  await step(tok);                                   // 3174.8 in terms of the number N: log log N
  tag('以數字 N 來看：Newton ≈ log log N', 'good', 0.8, 4.4);
  say('以數字 N 來看', 'Newton 約 log log N 步');
  await step(tok);                                   // 3179.8 so Newton is faster
  st.mood('happy'); await st.hop(tok);
  say('所以 Newton 比較快');
}]);
  }

  // ═══ sortbari.js ═══
  {
const { V3, fresh, tag, cube, move, kill, glow, tint, txt, code, ghostBox, travel, remove, buddy, anim, step, GOLD, GREEN, GRAY } = K;
const colorFor = ctx.colorFor;
// ─── mB5HXBb_HY8：Abdul Bari〈Merge Sort〉、7h1s2SojIRw：Abdul Bari〈Quick Sort〉 ───
// Cued scenes: every `await step(tok)` waits for the sentence it shows; beats are motion only.
// Merge sort 的例子：索引 1..8 = 9 3 7 5 6 4 8 2（mid = ⌊(l+h)/2⌋，7 次 merge 依 post-order 編號）。
// Quick sort 的例子：10 16 8 12 15 6 3 9 5，尾端放 ∞；pivot = A[l]，i 找 > pivot、j 找 ≤ pivot，
// 交錯後 A[l] ↔ A[j]（第一次 partition → 6 5 8 9 3 10 15 12 16），之後 QuickSort(l, j)、QuickSort(j+1, h)。
// 左下角的小幫手跟著反應：切開時好奇、合併好了開心。
const SB_M = [9, 3, 7, 5, 6, 4, 8, 2];
const SB_Q = [10, 16, 8, 12, 15, 6, 3, 9, 5, Infinity];
const sbS = (v) => (v === Infinity ? '∞' : String(v));
const bubble = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const guide = (x = -6.2, z = 1.6, s = 0.7) => buddy('', '', '#ffc56b', x, 0, z, s);
// merge-sort tree (upright, z = 0): a node of size g sits at height SB_Y[g]; groups are separated by a gap
const SB_Y = { 1: 1.4, 2: 3.0, 4: 4.6, 8: 6.2 }, SB_GAP = { 1: 0.5, 2: 0.7, 4: 0.9, 8: 0 };
const sbX = (k, g) => (k - 3.5) * 0.62 + (Math.floor(k / g) - (8 / g - 1) / 2) * SB_GAP[g];
function sbCube(v, k, g, drop = 0) { const m = cube(v, colorFor(v), [0.52, 0.52, 0.52], sbX(k, g), SB_Y[g], 0, drop); m.userData.v = v; return m; }
// merge two sorted runs of meshes into slots lo.. of size-g level (ties take the left run → stable)
async function sbMerge(tok, A, B, lo, g, ms) {
  const out = []; let i = 0, j = 0;
  while (i < A.length || j < B.length) {
    let m;
    if (i < A.length && j < B.length) {
      glow(A[i], GOLD); glow(B[j], GOLD); await beat(tok, ms * 0.3);
      glow(A[i], null); glow(B[j], null);
      m = A[i].userData.v <= B[j].userData.v ? A[i++] : B[j++];
    } else m = i < A.length ? A[i++] : B[j++];
    move(m, sbX(lo + out.length, g), SB_Y[g], 0); out.push(m);
    await beat(tok, ms * 0.3);
  }
  return out;
}
// the top-down recursion on [0..7] as a list of events:
//   L = make the left half, R = make the right half, leaf = one element, M = merge
function sbEvents() {
  const E = [];
  (function rec(l, h) {
    if (l === h) { E.push({ t: 'leaf', l, h }); return; }
    const m = (l + h) >> 1;
    E.push({ t: 'L', l, m, h }); rec(l, m);
    E.push({ t: 'R', l, m, h }); rec(m + 1, h);
    E.push({ t: 'M', l, m, h });
  })(0, 7);
  return E;
}
// a merge-sort trace that the scene advances one event (or a few) per sentence
function sbTracer(mode) {
  const idx = mode === 'idx', vals = SB_M.slice(), E = sbEvents();
  const nodes = {}, res = {}; let e = 0, merges = 0;
  const rng = (l, h, g) => { if (idx) tag('(' + (l + 1) + ',' + (h + 1) + ')', 'idx', (sbX(l, g) + sbX(h, g)) / 2, SB_Y[g] - 0.55, 0); };
  const make = (l, h, g) => { const a = []; for (let k = l; k <= h; k++) a.push(sbCube(vals[k], k, g, 0.8)); nodes[l + ',' + h] = a; rng(l, h, g); return a; };
  const T = {
    root() { nodes['0,7'] = vals.map((v, k) => sbCube(v, k, 8, 1.2)); rng(0, 7, 8); },
    // play events until event index `upto` (exclusive)
    async to(tok, upto, ms = 500) {
      while (e < upto) {
        const ev = E[e++], g = ev.h - ev.l + 1;
        if (ev.t === 'L') {
          (nodes[ev.l + ',' + ev.h] || []).forEach((n) => tint(n, GRAY));
          make(ev.l, ev.m, g / 2);
          say(idx ? 'MergeSort(' + (ev.l + 1) + ', ' + (ev.m + 1) + ')：先做左半' : '左半：' + vals.slice(ev.l, ev.m + 1).join(' '),
            idx ? 'mid = (' + (ev.l + 1) + ' + ' + (ev.h + 1) + ') / 2 = ' + (ev.m + 1) : '右半等一下再做');
          await beat(tok, ms * 0.6);
        } else if (ev.t === 'R') {
          make(ev.m + 1, ev.h, g / 2);
          say(idx ? 'MergeSort(' + (ev.m + 2) + ', ' + (ev.h + 1) + ')：換右半' : '右半：' + vals.slice(ev.m + 1, ev.h + 1).join(' '), '左半已經排好了');
          await beat(tok, ms * 0.6);
        } else if (ev.t === 'leaf') {
          const n = nodes[ev.l + ',' + ev.l][0]; glow(n, GREEN); res[ev.l + ',' + ev.l] = [n];
          say(idx ? '(' + (ev.l + 1) + ',' + (ev.l + 1) + ')：l = h，只有一個元素' : vals[ev.l] + '：只剩一個元素', '一個元素本身就是排好的');
          await beat(tok, ms * 0.4); glow(n, null);
        } else {
          merges++;
          (nodes[ev.l + ',' + ev.h] || []).forEach(kill);
          const Ls = res[ev.l + ',' + ev.m], Rs = res[(ev.m + 1) + ',' + ev.h];
          const sorted = Ls.concat(Rs).map((x) => x.userData.v).sort((a, b) => a - b);
          say('第 ' + merges + ' 次 merge → ' + sorted.join(' '), idx ? 'Merge(' + (ev.l + 1) + ', ' + (ev.m + 1) + ', ' + (ev.h + 1) + ')' : '左、右都排好了，才合併');
          res[ev.l + ',' + ev.h] = await sbMerge(tok, Ls, Rs, ev.l, g, ms);
          tag('#' + merges, 'ptr alt', (sbX(ev.l, g) + sbX(ev.h, g)) / 2, SB_Y[g] + 0.55, 0);
          await beat(tok, ms * 0.3);
        }
      }
    },
    final: () => res['0,7'] || [],
  };
  return T;
}

// ── Merge Sort ──
// 0:00 divide and conquer：大問題拆開，一個元素就是「小問題」
FRAG.push(['sortbari-merge-dc', 'Divide and Conquer：拆到只剩一個元素', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  const gd = guide();
  await step(tok);                                   // 0:00 we have seen merging (two-way, m-way)
  const a = note('3 9', -2.4, 5.6, 0), b = note('5 7', 2.4, 5.6, 0);
  say('上一集：merging', '兩個排好的串列合併成一個');
  await Promise.all([travel(tok, a, V3(-2.4, 5.6, 0), V3(-0.5, 5.6, 0), 900), travel(tok, b, V3(2.4, 5.6, 0), V3(0.5, 5.6, 0), 900)]);
  remove(a); remove(b); note('3 5 7 9', 0, 5.6, 0);
  await step(tok);                                   // 0:20 merge sort: recursive, divide and conquer
  bubble('Merge sort：recursive、divide and conquer', 0, 4.6, 0);
  gd.mood('wow');
  say('Merge sort：遞迴 + divide and conquer');
  await step(tok);                                   // 0:30 large → subproblems, small → solve, combine
  bubble('問題大 → 拆成子問題', -3.6, 3.6, 0); await beat(tok, 300);
  bubble('問題小 → 直接解', 0, 3.6, 0); await beat(tok, 300);
  bubble('把小解合併成大解', 3.6, 3.6, 0);
  say('divide and conquer 三步', '拆開 → 解小的 → 合併');
  await step(tok);                                   // 0:47 the problem is to sort these elements
  const ms = SB_M.map((v, k) => sbCube(v, k, 8, 1.2));
  gd.mood('calm'); gd.look(1);
  say('問題：把這 8 個元素排好', '8 個元素 → 大問題');
  await step(tok);                                   // 0:55 small = a single element
  glow(ms[0], GOLD);
  const n1 = note('只有 1 個 → 不用排', sbX(0, 8), 7.0, 0);
  say('什麼叫「小問題」？', '只有一個元素：不用排序');
  await step(tok);                                   // 1:07 even two elements is a large problem → split
  glow(ms[0], null); remove(n1);
  for (const g of [4, 2, 1]) { ms.forEach((m, k) => move(m, sbX(k, g), SB_Y[g], 0)); await beat(tok, 700); }
  say('兩個元素也算大問題 → 再拆', '一直拆到每段只剩一個元素');
  await step(tok);                                   // 1:17 single element = small problem
  ms.forEach((m) => glow(m, GREEN));
  gd.mood('happy'); await gd.hop(tok);
  say('一個元素 = 小問題，本身就排好了', '<span class="ok">接下來只要合併</span>');
}]);

// 1:25 演算法 MergeSort(l, h)
FRAG.push(['sortbari-merge-code', 'MergeSort(l, h) 演算法', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  const gd = guide();
  const X = (k) => 0.9 + k * 0.72;
  await step(tok);                                   // 1:25 let me write the algorithm
  const C = code(['Algorithm MergeSort(l, h)', '{', '  if (l < h)', '  {', '    mid = (l + h) / 2;', '    MergeSort(l, mid);', '    MergeSort(mid + 1, h);', '    Merge(l, mid, h);', '  }', '}'], -3.4, 6.0, 0.5);
  const row = SB_M.map((v, k) => cube(v, colorFor(v), [0.55, 0.55, 0.55], X(k), 3.0, 0, 1.2));
  SB_M.forEach((v, k) => tag(String(k + 1), 'idx', X(k), 2.4, 0));
  C.hl(0);
  say('先寫出演算法，再來追蹤');
  await step(tok);                                   // 1:46 two parameters: low and high
  const lt = tag('l', 'ptr', X(0), 3.8, 0), ht = tag('h', 'ptr', X(7), 3.8, 0);
  say('參數：串列的開頭 l、結尾 h', 'l = low　h = high');
  await step(tok);                                   // 2:09 if (l < h): at least two elements
  C.hl(2); gd.mood('wow');
  say('l < h：至少兩個元素 → 大問題', 'l = h 表示只有一個元素，不用做');
  await step(tok);                                   // 2:21 mid = (l + h) / 2 = 4
  C.hl(4); gd.mood('calm');
  const md = tag('mid', 'ptr alt', X(3), 4.4, 0); glow(row[3], GOLD);
  say('mid = (1 + 8) / 2 = 9 / 2 = 4', '整數除法，小數捨去');
  await step(tok);                                   // 2:49 merge sort the left half recursively
  C.hl(5);
  const z = ghostBox('#4b9ee2', 4 * 0.72, 0.9, 0.9); z.position.set((X(0) + X(3)) / 2, 3.0, 0);
  say('左半 1～4：遞迴做 merge sort', 'MergeSort(l, mid) = MergeSort(1, 4)');
  await step(tok);                                   // 3:07 and from mid + 1 to high
  C.hl(6);
  const z2 = ghostBox('#dd8238', 4 * 0.72, 0.9, 0.9); z2.position.set((X(4) + X(7)) / 2, 3.0, 0);
  say('右半 5～8：遞迴做 merge sort', 'MergeSort(mid + 1, h) = MergeSort(5, 8)');
  await step(tok);                                   // 3:26 when both are sorted, merge them
  C.hl(7); glow(row[3], null);
  gd.mood('happy'); await gd.hop(tok);
  say('兩半都排好 → 合併', 'Merge(l, mid, h) = Merge(1, 4, 8)');
  await step(tok);                                   // 3:52 a single array is broken into two lists
  C.hl(-1); kill(lt); kill(ht); kill(md);
  bubble('串列 1：[l..mid]', (X(0) + X(3)) / 2, 4.2, 0); bubble('串列 2：[mid+1..h]', (X(4) + X(7)) / 2, 4.2, 0);
  say('一個陣列裡放著兩個串列', '[l..mid] 與 [mid+1..h]');
  await step(tok);                                   // 4:07 a single array can have many lists
  for (let k = 0; k < 8; k += 2) { const q = ghostBox('#9b7ef4', 2 * 0.72 - 0.08, 1.0, 1.0); q.position.set((X(k) + X(k + 1)) / 2, 3.0, 0); }
  say('一個陣列也可以放很多個串列', '只要記住每段的開頭與結尾');
}]);

// 4:19 追蹤（索引版）：7 次 merge
FRAG.push(['sortbari-merge-trace-idx', '追蹤 MergeSort(1, 8)：遞迴樹與 7 次 merge', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  const gd = guide(), T = sbTracer('idx');
  await step(tok);                                   // 4:19 initially low = 1, high = 8
  T.root();
  say('MergeSort(1, 8)：9 3 7 5 6 4 8 2', 'low = 1、high = 8');
  const plan = [[1, 'wow'], [2], [6, 'wow'], [7, 'happy'], [12], [13, 'happy'], [14], [16, 'wow'], [20], [21, 'happy'], [26], [27], [28], [29, 'happy']];
  for (const [upto, mood] of plan) {
    await step(tok);                                 // 4:30 (1,4) · 5:13 (1,2) · 5:28 (1,1)(2,2) · 6:25 #1 · 6:40 (3,3)(4,4) · 6:57 #2 · 7:14 #3 · 7:41 (5,8)(5,6) · 7:57 (5,5)(6,6) · 8:04 #4 · 8:10 (7,7)(8,8) · 8:24 #5 · 8:33 #6 · 8:42 #7
    if (mood) gd.mood(mood);
    await T.to(tok, upto);
  }
  await step(tok);                                   // 9:00 split until one element, then merge
  T.final().forEach((m) => glow(m, GREEN));
  gd.mood('happy'); await gd.hop(tok);
  say('一路切到一個元素，再一路 merge 回來', '<span class="ok">2 3 4 5 6 7 8 9</span>　共 7 次 merge');
}]);

// 9:25 和 two-way merge sort 比較
FRAG.push(['sortbari-merge-twoway', 'Two-way merge sort vs merge sort', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  const gd = guide();
  let cur = SB_M.map((v, k) => sbCube(v, k, 1, 1.0));
  await step(tok);                                   // 9:25 two-way: first two, next two, next two…
  tag('two-way（迭代）', 'ptr', -5.6, 6.6, 0);
  for (const g of [2, 4, 8]) {
    const next = [];
    for (let lo = 0; lo < 8; lo += g) next.push(...await sbMerge(tok, cur.slice(lo, lo + g / 2), cur.slice(lo + g / 2, lo + g), lo, g, 180));
    cur = next;
  }
  say('two-way merge sort：一輪一輪合併', '前兩個、下兩個、再下兩個……');
  await step(tok);                                   // 9:31 merge sort: divide and divide, then merge
  bubble('merge sort：遞迴，先切到 1 個再合併', 1.0, 7.2, 0);
  gd.mood('wow');
  say('merge sort：divide and conquer、遞迴', '一直切到一個元素才開始合併');
  await step(tok);                                   // 9:46 only the pattern changes, result is sorted
  cur.forEach((m) => glow(m, GREEN));
  gd.mood('happy');
  say('不同的只有切法（pattern）', '<span class="ok">結果一樣是排好的</span>');
  await step(tok);                                   // 9:54 also merging two lists at a time
  good('一次合併兩個串列 → 也是 two-way', 0, 0.4, 0);
  say('一樣一次合併兩個串列', '因為是遞迴版，另外叫它 merge sort');
}]);

// 10:06 時間：每層 n 個、共 log n 層
FRAG.push(['sortbari-merge-levels', 'Merge sort 的時間：n × log n', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  const gd = guide();
  const rows = { 1: SB_M, 2: [3, 9, 5, 7, 4, 6, 2, 8], 4: [3, 5, 7, 9, 2, 4, 6, 8], 8: [2, 3, 4, 5, 6, 7, 8, 9] };
  await step(tok);                                   // 10:06 from the recursion tree
  rows[1].forEach((v, k) => sbCube(v, k, 1, 0.8));
  say('從追蹤畫出的遞迴樹看時間', '最下面：一個一個的元素');
  let lv = 0;
  for (const g of [2, 4, 8]) {
    await step(tok);                                 // 10:24 two, two… eight merged · 10:41 again eight · 10:46 again eight: n each time
    lv++;
    rows[g].forEach((v, k) => sbCube(v, k, g, 1.0));
    tag('8 個 = n', 'ptr alt', 5.6, SB_Y[g], 0);
    say(lv === 1 ? '這一層：2 個、2 個……共 8 個被 merge' : '這一層又 merge 了 8 個', '每一層 merge 的總量 = n');
  }
  await step(tok);                                   // 10:53 total levels: one, two, three
  for (const g of [2, 4, 8]) { tag('第 ' + Math.log2(g) + ' 層', 'idx', -5.6, SB_Y[g], 0); await beat(tok, 300); }
  say('數一數：一共 3 層');
  await step(tok);                                   // 11:00 three = log 8 (1, 2, 4, 8)
  bubble('1 → 2 → 4 → 8：每層加倍', 0, 7.4, 0);
  gd.mood('wow');
  say('8 個元素 → 3 層 = log₂ 8', '每層的串列長度加倍');
  await step(tok);                                   // 11:23 not passes: recursive, left first
  note('不是一輪一輪的 pass：先做完左邊再做右邊', 0, 0.5, 1.2);
  say('嚴格說不是 pass（遞迴先左後右）', '但層數一樣是 log n');
  await step(tok);                                   // 11:41 n, log n times
  say('每層 n，共 log n 層', 'n × log n');
  gd.mood('calm');
  await step(tok);                                   // 11:48 Θ(n log n)
  good('Θ(n log n)', 5.6, 7.2, 0);
  gd.mood('happy'); await gd.hop(tok);
  say('Merge sort 的時間', '<span class="ok">Θ(n log n)</span>');
}]);

// 11:59 追蹤（數字版）：merge 在 post-order
FRAG.push(['sortbari-merge-trace-num', '用數字追蹤：merge 發生在 post-order', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  const gd = guide(), T = sbTracer('num');
  await step(tok);                                   // 11:59 taking these numbers: low 1, high 8
  T.root();
  say('用數字再追一次：low 1、high 8', '9 3 7 5 6 4 8 2');
  const plan = [[1, 'wow'], [2], [6], [7, 'happy'], [12], [13], [14, 'happy'], [15], [16], [20], [21, 'happy'], [22], [26], [27, 'happy'], [28], [29, 'happy']];
  for (const [upto, mood] of plan) {
    await step(tok);                                 // 12:18 9 3 7 5 · 12:48 9 3 · 13:04 9 | 3 · 13:22 3 9 · 13:36 7 | 5 · 13:46 5 7 · 13:59 3 5 7 9 · 14:20 6 4 8 2 · 14:37 6 4 · 14:50 6 | 4 · 15:11 4 6 · 15:29 8 2 · 15:38 8 | 2 · 15:51 2 8 · 16:09 2 4 6 8 · 16:19 2…9
    if (mood) gd.mood(mood);
    await T.to(tok, upto);
  }
  await step(tok);                                   // 16:52 calls itself twice → like a binary tree
  T.final().forEach((m) => glow(m, GREEN));
  bubble('每次呼叫自己兩次 → 追蹤樹像 binary tree', 0, 7.4, 0);
  gd.mood('wow');
  say('呼叫自己兩次 → 追蹤樹是 binary tree');
  await step(tok);                                   // 17:04 merging is done in post-order
  good('左 → 右 → 根（merge）＝ post-order', 0, 0.4, 1.0);
  gd.mood('happy'); await gd.hop(tok);
  say('merge 的順序 = post-order', '先左、再右，最後才在根 merge');
}]);

// 17:28 遞迴式與 master theorem
FRAG.push(['sortbari-merge-recurrence', 'T(n) = 2T(n/2) + n → Θ(n log n)', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  const gd = guide();
  const full = ['MergeSort(l, h)          T(n)', '{ if (l < h)', '  { mid = (l + h) / 2;     1', '    MergeSort(l, mid);     T(n/2)', '    MergeSort(mid + 1, h); T(n/2)', '    Merge(l, mid, h);      n', '  }', '}'];
  const w = Math.max(...full.map((s) => s.length));
  const bare = full.map((s) => s.replace(/\s{2,}(T\(n\)|1|T\(n\/2\)|n)$/, '').padEnd(w, ' '));
  await step(tok);                                   // 17:28 time complexity by recurrence relation
  const C = code(full, -3.0, 5.8, 0.55);
  C.ls.forEach((l, i) => txt(l, bare[i]));
  say('用 recurrence relation 求時間', '遞迴演算法的老方法');
  const show = (i) => txt(C.ls[i], full[i].padEnd(w, ' '));
  await step(tok);                                   // 17:45 the algorithm takes T(n); mid is a constant
  C.hl(0); show(0); show(2);
  say('假設整個演算法花 T(n)', '算 mid 只是常數，可以忽略');
  await step(tok);                                   // 17:59 calls itself on half the list, twice
  C.hl(3); show(3); await beat(tok, 500); C.hl(4); show(4);
  gd.mood('wow');
  say('左右各處理一半：T(n/2) + T(n/2)');
  await step(tok);                                   // 18:07 merging two lists, n elements in all
  C.hl(5); show(5);
  say('merge 兩個串列：一共 n 個元素', 'Merge 花 n');
  await step(tok);                                   // 18:21 T(n) = 2T(n/2) + n
  C.hl(-1);
  const f = tag('T(n) = 2T(n/2) + n', 'ptr alt', 3.6, 6.2, 0);
  gd.mood('calm');
  say('全部加起來：T(n) = 2T(n/2) + n');
  await step(tok);                                   // 18:39 when n > 1; when n = 1 write 1
  txt(f, 'T(n) = 2T(n/2) + n（n > 1）');
  note('n = 1：什麼都不做 → 寫 1', 3.6, 5.3, 0);
  say('n > 1 才遞迴', 'n = 1 時寫一個常數 1');
  await step(tok);                                   // 19:06 master theorem: a = 2, b = 2, f(n) = n
  bubble('a = 2、b = 2、f(n) = n', 3.6, 4.3, 0);
  say('Master theorem：a = 2、b = 2', 'f(n) = n = nᵏ，k = 1');
  await step(tok);                                   // 19:27 log₂ 2 = 1 = k → case 2
  bubble('log_b a = log₂ 2 = 1 = k', 3.6, 3.5, 0);
  gd.mood('wow');
  say('log₂ 2 = 1，和 k 相等 → case 2');
  await step(tok);                                   // 19:38 case 2: f(n) times log n
  bubble('case 2：f(n) × log n', 3.6, 2.7, 0);
  say('case 2：f(n) 原樣寫下，再乘 log n', 'n × log n');
  await step(tok);                                   // 20:16 Θ(n log n)
  good('Θ(n log n)', 3.6, 1.8, 0);
  gd.mood('happy'); await gd.hop(tok);
  say('Merge sort 的時間', '<span class="ok">Θ(n log n)</span>');
}]);

// ── Quick Sort ──
// a floor row of value cubes with i / j / l / h pointers
function sbRow(vals, o = {}) {
  const dx = o.dx || 1.1, z = o.z || 0, y = 0.5, n = vals.length, x0 = -(n - 1) * dx / 2;
  const R = { v: vals.slice(), m: [], dx, z, y };
  R.x = (i) => x0 + i * dx;
  for (let i = 0; i < n; i++) ctx.tile(V3(R.x(i), 0.02, z), dx * 0.9, 1.0);
  vals.forEach((v, i) => { R.m[i] = v === null ? null : cube(sbS(v), v === Infinity ? '#d8cfc0' : colorFor(v), [0.8, 0.8, 0.8], R.x(i), y, z, o.drop ? 2.2 : 0); });
  R.ptr = (text, cls, i, dy) => tag(text, cls, R.x(i), y + dy, z);
  R.at = (l, i, dy) => l.position.set(R.x(i), y + dy, z);
  R.swap = async (tok, i, j, ms = 800) => {
    const a = R.m[i], b = R.m[j], h = y + 1.1;
    if (i !== j) {
      move(a, R.x(i), h, z); move(b, R.x(j), h + 0.9, z); await beat(tok, ms * 0.3);
      move(a, R.x(j), h, z); move(b, R.x(i), h + 0.9, z); await beat(tok, ms * 0.4);
      move(a, R.x(j), y, z); move(b, R.x(i), y, z); await beat(tok, ms * 0.3);
    } else await beat(tok, ms * 0.4);
    [R.m[i], R.m[j]] = [R.m[j], R.m[i]]; [R.v[i], R.v[j]] = [R.v[j], R.v[i]];
  };
  R.str = () => R.v.map(sbS).join(' ');
  return R;
}
// Bari's partition(l, h) as a list of events the scene plays one sentence at a time
// (h is the sentinel slot: ∞ or an earlier pivot). Events: init, i, j, swap, cross, final, done.
function sbPartition(R, l, h, o = {}) {
  const p = R.v[l], v = R.v.slice(), E = [['init']];
  {
    let i = l, j = h;
    while (i < j) {
      do i++; while (v[i] <= p); E.push(['i', i]);
      do j--; while (v[j] > p); E.push(['j', j]);
      if (i < j) { E.push(['swap', i, j]); [v[i], v[j]] = [v[j], v[i]]; } else E.push(['cross', i, j]);
    }
    E.push(['final', j]); E.push(['done', j]);
  }
  const ms = o.ms || 800, hl = (k) => { if (o.code) o.code.hl(k); };
  let it = null, jt = null, pt = null, ci = l, cj = h, e = 0, xt = null;
  return {
    E, p,
    async to(tok, upto) {
      while (e < upto) {
        const ev = E[e++];
        if (ev[0] === 'init') {
          hl(1); glow(R.m[l], GOLD);
          pt = R.ptr('pivot', 'ptr alt', l, 2.6); it = R.ptr('i', 'ptr', l, 1.3); jt = R.ptr('j', 'ptr', h, 1.9);
          say('pivot = ' + p + '；i 從 pivot、j 從尾端出發', R.str());
          await beat(tok, ms * 0.4);
        } else if (ev[0] === 'i') {
          hl(3);
          while (ci < ev[1]) { ci++; R.at(it, ci, 1.3); glow(R.m[ci], '#1f3a6e'); await beat(tok, ms * 0.3); if (ci < ev[1]) glow(R.m[ci], null); }
          say('i 停在 ' + sbS(R.v[ci]) + '（> ' + p + '）', 'i 找比 pivot 大的');
          await beat(tok, ms * 0.2);
        } else if (ev[0] === 'j') {
          hl(4);
          while (cj > ev[1]) { cj--; R.at(jt, cj, 1.9); if (cj !== l) glow(R.m[cj], '#8a1f5a'); await beat(tok, ms * 0.3); if (cj > ev[1] && cj !== l) glow(R.m[cj], null); }
          say('j 停在 ' + sbS(R.v[cj]) + '（≤ ' + p + '）', 'j 找比 pivot 小（或相等）的');
          await beat(tok, ms * 0.2);
        } else if (ev[0] === 'swap') {
          hl(5);
          say('i < j：交換 ' + sbS(R.v[ev[1]]) + ' 和 ' + sbS(R.v[ev[2]]));
          glow(R.m[ev[1]], null); glow(R.m[ev[2]], null);
          await R.swap(tok, ev[1], ev[2], ms);
          say('交換後', R.str());
        } else if (ev[0] === 'cross') {
          hl(2); glow(R.m[ev[1]], null); if (ev[2] !== l) glow(R.m[ev[2]], null);
          xt = tag('i > j：交錯了', 'bad', (R.x(ev[1]) + R.x(ev[2])) / 2, R.y + 3.4, R.z);
          say('i 跑到 j 的右邊 → 不交換', '迴圈結束');
          await beat(tok, ms * 0.3);
        } else if (ev[0] === 'final') {
          hl(7); if (xt) { kill(xt); xt = null; }
          say('A[l] 和 A[j] 交換：' + p + ' ↔ ' + sbS(R.v[ev[1]]));
          await R.swap(tok, l, ev[1], ms);
          say(p + ' 換到 j 的位置', R.str());
        } else {
          hl(8); glow(R.m[ev[1]], null); tint(R.m[ev[1]], GREEN);
          kill(pt); kill(it); kill(jt);
          say(p + ' 歸位：return j', R.str());
          await beat(tok, ms * 0.3);
        }
      }
    },
  };
}
// a student walks (a little character whose size is their height)
async function sbWalk(tok, b, x, z, ms = 900) {
  const a = b.g.position.clone(), t = V3(x, a.y, z);
  await anim(tok, ms, (u) => b.g.position.lerpVectors(a, t, u));
}

// 0:00 想法：學生依身高自己找位置
FRAG.push(['sortbari-quick-students', 'Quick sort 的想法：學生自己找位置', async (tok) => {
  fresh([0, 4, 11], [0, 1.2, 0]);
  const H = [0.85, 1.15, 0.6, 1.0, 1.35, 0.7, 0.95], C = ['#4b9ee2', '#e55a9b', '#2fc092', '#dd8238', '#9b7ef4', '#31aab0', '#c08a1f'];
  const X = (i) => -4.8 + i * 1.6;
  await step(tok);                                   // 0:00 the idea behind quick sort
  bubble('Quick sort 的想法是什麼？', 0, 3.6, 0);
  say('先看 quick sort 背後的想法');
  await step(tok);                                   // 0:12 students arrange by increasing height
  let line = H.map((h, i) => { const b = buddy('', '', C[i], X(i), 0, 0, h); b.h = h; return b; });
  say('一班學生要依身高排成一排', '由矮到高');
  await step(tok);                                   // 0:23 option 1: the teacher shows each place
  const t = buddy('老師', '', '#f3d36b', 0, 0, -2.6, 1.3);
  const n1 = note('做法一：老師一個一個指定位置', -2.6, 2.6, -2.6);
  t.look(-1); line.forEach((b) => b.mood('wow'));
  say('做法一：老師指定每個人的位置');
  await step(tok);                                   // 0:37 option 2: students arrange themselves
  note('做法二：學生自己找位置', 2.6, 2.6, -2.6); t.look(0);
  say('做法二：讓學生自己找位置');
  await step(tok);                                   // 0:41 finding their own place is quicker
  line.forEach((b) => b.mood('happy')); remove(n1);
  good('自己找位置比較快 → quick sort', 0, 3.6, 1.0);
  say('每個人自己找到排序後的位置 → 比較快', '這就是 quick sort 的想法');
  const place = async (moving) => {
    await Promise.all(moving.map((b) => sbWalk(tok, b, b.g.position.x, 1.8, 500)));
    await Promise.all(line.map((b) => sbWalk(tok, b, X(line.indexOf(b)), moving.includes(b) ? 1.8 : 0, 900)));
    await Promise.all(moving.map((b) => sbWalk(tok, b, X(line.indexOf(b)), 0, 500)));
  };
  await step(tok);                                   // 0:56 the shortest goes to the beginning
  const short = line[2]; short.glow(GOLD); short.mood('happy');
  line = [short].concat(line.filter((b) => b !== short)); await place([short]);
  short.glow(null);
  say('最矮的：自己走到最前面', '不需要別人幫忙');
  await step(tok);                                   // 1:17 the tallest goes to the back
  const tall = line.find((b) => b.h === 1.35); tall.glow(GOLD);
  line = line.filter((b) => b !== tall).concat([tall]); await place([tall]);
  tall.glow(null);
  say('最高的：自己走到最後面');
  await step(tok);                                   // 1:39 "taller: go back; shorter: come front"
  const me = line.find((b) => b.h === 0.95); me.glow(GOLD); me.mood('wow');
  const lo = line.filter((b) => b !== me && b.h < 0.95), hi = line.filter((b) => b !== me && b.h > 0.95);
  const movers = line.filter((b, i) => b !== me && (b.h < 0.95) !== (i < line.indexOf(me)));
  line = lo.concat([me], hi); await place(movers);
  bubble('比我高的往後、比我矮的往前', me.g.position.x, 2.2, 0);
  say('其他人：比我高的往後站、比我矮的往前站');
  await step(tok);                                   // 2:04 and I find my place
  me.glow(GREEN); me.mood('happy'); await me.hop(tok);
  say('我就站在自己的排序位置了', '前面都比我矮、後面都比我高');
}]);

// 2:14 什麼叫「在排序位置」
FRAG.push(['sortbari-quick-sorted-pos', '在排序位置：左邊都小、右邊都大', async (tok) => {
  fresh([0, 7, 10.5], [0, 0.4, 0]);
  const gd = guide(-6.2, 2.2, 0.6);
  await step(tok);                                   // 2:14 10 80 90 60 30 20: which one is sorted?
  const A = sbRow([10, 80, 90, 60, 30, 20], { z: -2.4, dx: 1.05, drop: true });
  gd.mood('wow');
  say('10 80 90 60 30 20', '哪一個一眼就知道已經排好了？');
  await step(tok);                                   // 2:27 this one (10: smallest, in front)
  glow(A.m[0], GOLD); good('最小又在最前面', A.x(0), 1.6, -2.4);
  gd.mood('happy');
  say('10：最小、又在最前面', '<span class="ok">10 已經在排序位置</span>');
  await step(tok);                                   // 2:37 another list: the largest is at the back
  const Bq = sbRow([null, null, null, null, null, null, null], { z: -0.2, dx: 1.05 });
  for (let i = 0; i < 7; i++) Bq.m[i] = cube(i === 6 ? '最大' : '?', i === 6 ? '#e8c770' : '#cfc6b6', [0.8, 0.8, 0.8], Bq.x(i), 0.5, -0.2, 1.5);
  glow(Bq.m[6], GOLD);
  say('另一串：最大的在最後面', '它也在排序位置，其他的還不知道');
  await step(tok);                                   // 2:53 4 6 7 10 16 12 13 14
  const B = sbRow([4, 6, 7, 10, 16, 12, 13, 14], { z: 2.0, dx: 1.05, drop: true });
  gd.mood('wow');
  say('4 6 7 10 16 12 13 14', '哪一個在自己的排序位置？');
  await step(tok);                                   // 3:06 this element (10)
  glow(B.m[3], GOLD); gd.mood('calm');
  say('看 10');
  await step(tok);                                   // 3:13 everything before it is smaller
  const gl = ghostBox('#2fc092', 3 * 1.05, 1.0, 1.1); gl.position.set(B.x(1), 0.5, 2.0);
  say('10 前面的 4 6 7 都比 10 小');
  await step(tok);                                   // 3:18 everything after it is greater
  const gr = ghostBox('#dd8238', 4 * 1.05, 1.0, 1.1); gr.position.set((B.x(4) + B.x(7)) / 2, 0.5, 2.0);
  tint(B.m[3], GREEN); gd.mood('happy');
  say('10 後面的 16 12 13 14 都比 10 大', '<span class="ok">10 在排序位置</span>');
  await step(tok);                                   // 3:22 quick sort works on this idea
  bubble('左邊都比它小、右邊都比它大 → 它在排序位置', 0, 2.6, 0);
  say('quick sort 的根據', '左小右大的元素，就站在排序後的位置');
  await step(tok);                                   // 3:39 the rest may or may not be sorted
  note('16 12 13 14 自己還沒排好', B.x(5.5), 1.6, 2.0);
  say('其他元素可能還沒排好');
  await step(tok);                                   // 3:45 that's how the name "quick" comes
  say('名字叫 quick：像學生自己很快排好');
  await step(tok);                                   // 3:53 but not the fastest method
  bad('名字叫 quick，但不是最快的排序', 0, 3.4, 0);
  gd.mood('wow');
  say('但它不是最快的排序法', '只是名字叫 quick');
}]);

// 4:02 初始設定：l、h、∞、pivot、i、j
FRAG.push(['sortbari-quick-setup', 'Partition 的準備：∞、pivot、i、j', async (tok) => {
  fresh([0, 6, 12], [0, 1.2, 0]);
  const gd = guide(-6.0, 2.4, 0.6);
  await step(tok);                                   // 4:02 quick sort: divide and conquer
  bubble('Quick sort：divide and conquer', 0, 3.8, 0);
  say('quick sort 也是 divide and conquer', '把問題拆成子問題再解');
  await step(tok);                                   // 4:19 initial setup: nine elements
  const R = sbRow(SB_Q.slice(0, 9).concat([null]), { drop: true });
  say('初始設定：9 個元素', '10 16 8 12 15 6 3 9 5');
  await step(tok);                                   // 4:25 l = low, h = high
  R.ptr('l', 'idx', 0, -0.6); R.ptr('h', 'idx', 9, -0.6);
  say('l = low 開頭，h = high 尾端', '尾端多留一格');
  await step(tok);                                   // 4:31 add infinity at the empty place
  R.m[9] = cube('∞', '#d8cfc0', [0.8, 0.8, 0.8], R.x(9), 0.5, 0, 2.2);
  gd.mood('wow');
  say('空格放 ∞', '比所有數都大');
  await step(tok);                                   // 4:42 a maximum integer: end-of-list marker
  note('像字串結尾的 \\0', R.x(9), 1.6, 0);
  say('電腦沒有 ∞：用最大整數', '當作 end-of-list 標記');
  await step(tok);                                   // 5:04 the first element is the pivot: 10
  glow(R.m[0], GOLD); R.ptr('pivot', 'ptr alt', 0, 2.6);
  gd.mood('calm');
  say('第一個元素當 pivot = 10', '目標：找到 10 的排序位置');
  await step(tok);                                   // 5:25 smaller to the left, greater to the right
  const gl = ghostBox('#2fc092', 4.4, 1.0, 1.1); gl.position.set(R.x(1.5), 0.5, 0);
  const gr = ghostBox('#dd8238', 4.4, 1.0, 1.1); gr.position.set(R.x(6.5), 0.5, 0);
  say('比 10 小的都到左邊', '比 10 大的都到右邊');
  await step(tok);                                   // 5:35 greater here → send there; smaller there → bring here
  kill(gl); kill(gr);
  const p1 = pkt('大的 →', R.x(2), 1.6, 0), p2 = pkt('← 小的', R.x(7), 1.6, 0);
  await Promise.all([travel(tok, p1, V3(R.x(2), 1.6, 0), V3(R.x(6), 1.6, 0), 900), travel(tok, p2, V3(R.x(7), 1.6, 0), V3(R.x(3), 1.6, 0), 900)]);
  remove(p1); remove(p2);
  say('左邊的大數送到右邊，右邊的小數帶到左邊');
  await step(tok);                                   // 5:44 i starts at the pivot, j at infinity
  R.ptr('i', 'ptr', 0, 1.3); R.ptr('j', 'ptr', 9, 1.9);
  say('i 從 pivot 出發，j 從 ∞ 出發');
  await step(tok);                                   // 5:57 i looks for > pivot, j for ≤ pivot → exchange
  bubble('i 找 > 10、j 找 ≤ 10 → 交換', 0, 3.4, 0);
  say('i 找比 pivot 大的、j 找比 pivot 小的', '找到就交換');
  await step(tok);                                   // 6:08 i stops at ∞ at most, j at the pivot
  glow(R.m[9], GOLD);
  gd.mood('happy');
  say('i 最遠停在 ∞，j 最遠停在 pivot', '所以不會跑出陣列');
}]);

// 6:30 partition 過程：16↔5、12↔9、15↔3，10↔6
FRAG.push(['sortbari-quick-partition', 'Partition：10 16 8 12 15 6 3 9 5', async (tok) => {
  fresh([0, 6, 12], [0, 1.2, 0]);
  const gd = guide(-6.0, 2.4, 0.6);
  const R = sbRow(SB_Q), P = sbPartition(R, 0, 9, { ms: 900 });
  // 6:30 partitioning · 6:41 i → 16 · 6:48 j → 5 · 6:53 swap · 7:00 i → 12 · 7:17 j → 9 · 7:24 swap
  // 7:36 i → 15, j → 3 · 7:44 swap · 7:52 i → 15, j → 6 · 7:57 crossed
  const plan = [[1, 'calm'], [2], [3], [4, 'happy'], [5], [6], [7, 'happy'], [9], [10, 'happy'], [12], [13, 'wow']];
  for (const [upto, mood] of plan) {
    await step(tok);
    if (mood) gd.mood(mood);
    await P.to(tok, upto);
    if (upto === 1) say('partitioning procedure', '先手做一次，再寫成演算法');
  }
  await step(tok);                                   // 8:09 wherever j points is the pivot's position
  const jp = tag('pivot 的位置', 'good', R.x(5), 3.2, 0);
  say('j 指著的地方，就是 pivot 的位置');
  await step(tok);                                   // 8:14 send that element here, take 10 there
  kill(jp);
  await P.to(tok, P.E.length);
  gd.mood('happy'); await gd.hop(tok);
  await step(tok);                                   // 8:24 these lists are not yet sorted
  const gl = ghostBox('#2fc092', 5 * R.dx, 1.0, 1.1); gl.position.set((R.x(0) + R.x(4)) / 2, 0.5, 0);
  const gr = ghostBox('#dd8238', 3 * R.dx, 1.0, 1.1); gr.position.set((R.x(6) + R.x(8)) / 2, 0.5, 0);
  note('還沒排好', R.x(2), 1.7, 0); note('還沒排好', R.x(7), 1.7, 0);
  gd.mood('calm');
  say('左右兩邊都還沒排好');
  await step(tok);                                   // 8:32 left side < 10, right side > 10
  say('但左邊都 < 10、右邊都 > 10', '6 5 8 9 3 │ 10 │ 15 12 16');
  await step(tok);                                   // 8:44 10 is sorted: the partitioning position
  good('10 已排好：partitioning position', R.x(5), 2.6, 0);
  gd.mood('happy');
  say('pivot 10 已經排好了', '這個位置叫 partitioning position');
  await step(tok);                                   // 9:04 perform quick sort recursively on either side
  bubble('左右兩邊再各自 quick sort', 0, 3.6, 0);
  say('接著對兩邊遞迴做 quick sort');
}]);

// 9:19 partition 的程式碼
FRAG.push(['sortbari-quick-code', 'partition(l, h) 演算法', async (tok) => {
  fresh([0, 6, 12], [0, 2.4, 0]);
  const gd = guide(-6.0, 2.8, 0.6);
  await step(tok);                                   // 9:19 partition takes low and high
  const C = code(['partition(l, h)', '{ pivot = A[l]; i = l; j = h;', '  while (i < j)', '  { do { i++; } while (A[i] <= pivot);', '    do { j--; } while (A[j] > pivot);', '    if (i < j) swap(A[i], A[j]);', '  }', '  swap(A[l], A[j]);', '  return j;', '}'], 0, 6.4, 0.46, -2.5);
  const R = sbRow(SB_Q, { z: 1.8 }), P = sbPartition(R, 0, 9, { ms: 700, code: C });
  C.hl(0);
  say('把剛才的步驟寫成 partition(l, h)', '參數：low、high');
  await step(tok);                                   // 9:32 pivot = A[low]
  C.hl(1); glow(R.m[0], GOLD);
  say('第一個元素當 pivot：pivot = A[l]');
  await step(tok);                                   // 9:39 i at low, j at high
  await P.to(tok, 1);
  say('i = l、j = h');
  // 9:52 do i++ while A[i] ≤ pivot · 10:09 do j-- while A[j] > pivot · 10:46 if (i < j) swap
  // 11:08 repeat: increment i, decrement j, swap · 11:20 put it all in while (i < j) · 11:31 i > j → stop
  // 11:41 swap A[l] with A[j] · 11:50 return j
  const plan = [[2, 'wow'], [3], [4, 'happy'], [7], [10], [13, 'wow'], [14], [15, 'happy']];
  for (const [upto, mood] of plan) {
    await step(tok);
    if (mood) gd.mood(mood);
    await P.to(tok, upto);
    if (upto === 7) say('同樣的事再做一次：i 往右、j 往左、交換');
    if (upto === 10) { C.hl(2); say('整段放進 while (i < j) 迴圈', '一直重複到 i、j 交錯'); }
  }
  say('return j：pivot 的位置', 'partitioning position　' + R.str());
}]);

// 12:04 QuickSort(l, h)：遞迴，pivot 當左半邊的 ∞
FRAG.push(['sortbari-quick-recursive', 'QuickSort(l, h)：左邊用 pivot 當 ∞', async (tok) => {
  fresh([0, 6, 12], [0, 2.4, 0]);
  const gd = guide(-6.0, 2.8, 0.6);
  await step(tok);                                   // 12:04 QuickSort takes low and high
  const C = code(['QuickSort(l, h)', '{ if (l < h)', '  { j = partition(l, h);', '    QuickSort(l, j);', '    QuickSort(j + 1, h);', '  }', '}'], 0, 6.2, 0.5, -2.5);
  const R = sbRow(SB_Q, { z: 1.8 });
  C.hl(0);
  say('QuickSort(l, h)', '一樣傳 low、high');
  await step(tok);                                   // 12:12 if l < h: at least two elements
  C.hl(1);
  say('l < h：至少兩個元素', '才需要排序');
  await step(tok);                                   // 12:19 call partition with low and high
  C.hl(2);
  const P = sbPartition(R, 0, 9, { ms: 150 });
  await P.to(tok, P.E.length);
  say('呼叫 partition(l, h)', R.str());
  await step(tok);                                   // 12:27 it returns j, where partitioning is done
  const jt = R.ptr('j', 'ptr alt', 5, 1.4);
  gd.mood('happy');
  say('partition 回傳 j：10 歸位的位置', R.str());
  await step(tok);                                   // 12:39 quick sort on the left: low to j
  C.hl(3);
  const zl = ghostBox('#2fc092', 6 * R.dx, 1.0, 1.1); zl.position.set((R.x(0) + R.x(5)) / 2, 0.5, 1.8);
  gd.mood('calm');
  say('左邊：QuickSort(l, j)', '從 low 到 j');
  await step(tok);                                   // 12:46 and on the right: j + 1 to high
  C.hl(4);
  const zr = ghostBox('#dd8238', 4 * R.dx, 1.0, 1.1); zr.position.set((R.x(6) + R.x(9)) / 2, 0.5, 1.8);
  say('右邊：QuickSort(j + 1, h)', '從 j + 1 到 high');
  await step(tok);                                   // 13:07 this is already sorted — why include j?
  C.hl(3); glow(R.m[5], GOLD);
  gd.mood('wow');
  say('10 已經排好了，左邊為什麼還包含 j？');
  await step(tok);                                   // 13:13 the right list has ∞; where is ∞ for the left?
  glow(R.m[9], GOLD);
  note('右邊的 ∞', R.x(9), 1.6, 1.8);
  say('右邊的串列尾端有 ∞', '左邊的 ∞ 在哪裡？');
  await step(tok);                                   // 13:18 the sorted element acts as ∞ for the first list
  glow(R.m[9], null); kill(jt);
  note('左邊的 ∞ = 10', R.x(5), 1.6, 1.8);
  gd.mood('happy'); await gd.hop(tok);
  say('排好的 10 就當左邊串列的 ∞', '所以左邊寫 QuickSort(l, j)');
}]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '演算法・第 2 章',
    title: '分治法 Divide and Conquer',
    color: 'var(--alg)',
    modes: [
      { id: 'merge', name: 'Merge Sort', enter: () => { clearLog(); enterMerge(); } },
      { id: 'bsearch', name: 'Binary Search', enter: () => { clearLog(); enterBSearch(); } },
      { id: 'quick', name: 'Quicksort', enter: () => { clearLog(); enterQuick(); } },
      { id: 'matrix', name: 'Strassen', enter: () => { clearLog(); enterMatrix(); } },
      { id: 'maxsub', name: '最大子陣列', enter: () => { clearLog(); enterMaxSub(); } },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: [
      'dc-general', 'dc-same-kind', 'maxmin-dc',
      'bsearch-trace', 'bsearch-tree',
      'merge-two-lists', 'merge-four-way', 'merge-patterns', 'two-way-mergesort', 'mergesort-topdown',
      'count-frequency-cost', 'plus-vs-extend', 'sorted-inner-product',
      'quicksort-partition', 'qs-best-tree', 'qs-worst-sorted', 'qs-pivot-choice', 'qs-stack',
      'select-mom', 'max-subarray',
      'matmul-2x2', 'matmul-blocks', 'strassen-7', 'strassen-recurrence',
      'mult-recurrences', 'karatsuba', 'log-star', 'newton-sqrt-error', 'newton-reciprocal', 'newton-cost-geometric',
    ].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); },
  };
}
