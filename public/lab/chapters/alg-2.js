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
      const all = Array.from({ length: 30 }, (_, i) => i + 1).sort(() => Math.random() - 0.5).slice(0, 8);
      const A = all.slice(0, 4).sort((x, y) => x - y), B = all.slice(4).sort((x, y) => x - y);
      let i = 0, j = 0, c = 0; while (i < 4 && j < 4) { c++; if (A[i] < B[j]) i++; else j++; }
      return { q: '合併 A = [' + A.join(', ') + '] 與 B = [' + B.join(', ') + ']，while 迴圈中做了幾次比較？', opts: uniq4(String(c), ['4', '5', '6', '7', '8']), ans: String(c), why: '每次比較搬一個元素；一邊用完後剩下的直接複製，不再比較。最多 m + n − 1 = 7 次、最少 min(m, n) = 4 次。' };
    }
    if (t < 0.42) {
      const R = [['Binary search', 'T(n) = T(n/2) + 1', 'Θ(log n)'], ['Merge sort', 'T(n) = 2T(n/2) + n', 'Θ(n log n)'], ['Strassen', 'T(n) = 7T(n/2) + n²', 'Θ(n^2.81)'], ['分治矩陣乘法', 'T(n) = 8T(n/2) + n²', 'Θ(n³)'], ['Karatsuba', 'T(n) = 3T(n/2) + n', 'Θ(n^1.58)'], ['Quicksort 最壞', 'T(n) = T(n−1) + n', 'Θ(n²)'], ['分治找最大最小', 'T(n) = 2T(n/2) + 2', 'Θ(n)']];
      const r = pick(R), byRec = Math.random() < 0.5;
      return byRec ? { q: r[0] + ' 的遞迴式是？', opts: uniq4(r[1], R.map((x) => x[1]).sort(() => Math.random() - 0.5)), ans: r[1], why: r[0] + '：' + r[1] + ' → ' + r[2] + '。' }
        : { q: r[1] + ' 的解是？（' + r[0] + '）', opts: uniq4(r[2], R.map((x) => x[2]).sort(() => Math.random() - 0.5)), ans: r[2], why: r[0] + '：' + r[1] + ' → ' + r[2] + '。' };
    }
    if (t < 0.52) {
      const n = ri(5, 200), p = Math.ceil(lg(n));
      return { q: 'Two-way merge sort 排 ' + n + ' 個元素需要幾個 pass？', opts: uniq4(String(p), [String(p + 1), String(p - 1), String(Math.floor(n / 2)), String(Math.round(Math.sqrt(n)))]), ans: String(p), why: '每個 pass 串列長度加倍：⌈log₂ ' + n + '⌉ = ' + p + '。' };
    }
    if (t < 0.64) {
      const n = 5 + ri(0, 3), a = Array.from({ length: n }, () => ri(1, 40));
      const b = a.slice(), x = b[n - 1]; let i = -1; for (let j = 0; j < n - 1; j++) if (b[j] <= x) { i++; [b[i], b[j]] = [b[j], b[i]]; } [b[i + 1], b[n - 1]] = [b[n - 1], b[i + 1]];
      const q = i + 2;
      return { q: 'CLRS PARTITION（pivot = 最後一個）對 [' + a.join(', ') + '] 做一次，pivot ' + x + ' 最後落在第幾個位置（從 1 數）？', opts: uniq4(String(q), Array.from({ length: n }, (_, k) => String(k + 1)).sort(() => Math.random() - 0.5)), ans: String(q), why: '≤ ' + x + ' 的有 ' + (q - 1) + ' 個，pivot 放在它們後面：[' + b.join(', ') + ']。' };
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
    const segs = [[A.slice()]];
    for (let d = 0; d <= 3; d++) {
      const parts = []; for (const s of segs[d]) { if (s.length === 1) { parts.push(s); continue; } parts.push(s.slice(0, s.length / 2), s.slice(s.length / 2)); }
      segs.push(parts);
      let i0 = 0;
      for (const s of segs[d]) { const w = s.length * 1.5 - 0.3; cube(s.join(' '), C.blue, [w, 0.45, 0.8], X(i0) + (s.length - 1) * 0.75, levelY[d], 0, 1.2); i0 += s.length; }
      await beat(tok, 900);
    }
    say('長度 1 已經排好；開始往上 MERGE', '');
    await beat(tok, 1500);
    let cur = A.map((v) => [v]);
    for (let d = 0; d < 3; d++) {
      const nx = []; for (let i = 0; i < cur.length; i += 2) nx.push([...cur[i], ...cur[i + 1]].sort((p, q) => p - q));
      let i0 = 0;
      for (const s of nx) { const w = s.length * 1.5 - 0.3; const m = cube(s.join(' '), C.green, [w, 0.45, 0.8], X(i0) + (s.length - 1) * 0.75, levelY[2 - d] + 0.0, 1.4, 1.2); i0 += s.length; }
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
    fresh([0, 6, 13.5], [0, 2, 0]);
    const vals = [37, 4, 61, 22, 49, 13, 70, 1, 31, 58, 25, 67, 10, 43, 16, 52, 7, 73, 34, 19, 64, 28, 46, 55, 40];
    const groups = []; for (let g = 0; g < 5; g++) groups.push(vals.slice(g * 5, g * 5 + 5));
    const X = (g) => -4.4 + g * 2.2, Z = (r) => -2.4 + r * 1.2;
    let ms = groups.map((G, g) => G.map((v, r) => cube(v, C.blue, [1, 0.5, 0.9], X(g), 0.25, Z(r), 1.5)));
    say('SELECT 第 i 小：先把 n 個數分成 ⌈n/5⌉ 組，每組 5 個', '例：25 個數 → 5 組');
    await beat(tok, 2600);
    groups.forEach((G, g) => { const s = G.map((v, r) => ({ v, m: ms[g][r] })).sort((a, b) => a.v - b.v); s.forEach((o, r) => move(o.m, X(g), 0.25, Z(r))); groups[g] = s.map((o) => o.v); ms[g] = s.map((o) => o.m); });
    say('每組排序（5 個，常數時間），取中位數', '');
    await beat(tok, 1600);
    ms.forEach((col) => { tint(col[2], C.gold); });
    await beat(tok, 1400);
    const order = [0, 1, 2, 3, 4].sort((a, b) => groups[a][2] - groups[b][2]);
    order.forEach((g, pos) => ms[g].forEach((m, r) => move(m, X(pos), 0.25, Z(r))));
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
    const grid = (M, cx, col, nm) => { tag(nm, 'ptr', cx, 1.9, -1.2); return M.map((r, i) => r.map((v, j) => cube(v, col, [0.9, 0.5, 0.9], cx - 0.5 + j, 0.25, -1.7 + i))); };
    const am = grid(A, -4.4, C.blue, 'A'), bm = grid(B, -1.2, C.purple, 'B');
    tag('×', 'val', -2.8, 0.4, -1.2); tag('=', 'val', 0.7, 0.4, -1.2);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) ctx.tile(V3(2 + j, 0.04, -1.7 + i), 0.9, 0.9);
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
      cube(v, C.green, [0.9, 0.5, 0.9], 2 + j, 0.25, -1.7 + i, 2);
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
    tag('MM(A, B, 4)', 'ptr alt', 3.6, 6.4);
    for (let k = 0; k < 8; k++) {
      const x = 2.1 + (k % 4) * 1.05, y = 4.6 - Math.floor(k / 4) * 1.1;
      cube('A' + calls[k][0] + 'B' + calls[k][1], k < 4 ? C.blue : C.purple, [0.98, 0.5, 0.8], x, y, 0, 1.5);
      line(3.6, 6.1, x, y + 0.3);
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
      cube(s.C[q >> 1][q & 1], C.green, [0.9, 0.5, 0.9], 3 + (q & 1), 0.25, -1.6 + (q >> 1), 2);
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
// ─── Abdul Bari 分治系列（2Rr2tW9zvRg、zXhWPrMLXGo、ak-pz7tS5DE、uEUXGcc2VXM）＋ u7YMFRUFqe0 最大子陣列 ───
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, showL, code, line, arrow, ghostBox, lnode, GOLD, GREEN, RED, GRAY } = K;
const { say, beat } = ctx;
const PC = { blue: '#4b9ee2', purple: '#9b7ef4', green: '#2fc092', orange: '#dd8238', pink: '#e55a9b', teal: '#31aab0', gold: '#c08a1f', red: '#d64545', sand: '#c9b48e', brown: '#6e5f49' };
const srt = (a) => a.slice().sort((p, q) => p - q);

// ─── 2Rr2tW9zvRg：解題策略 ───
FRAG.push(['dcbari-strategies', '解題策略：divide and conquer 是其中一種', async (tok) => {
  fresh([0, 5, 13.5], [0, 2.4, 0]);
  say('演算法分析之後：解題策略', 'strategy = 解計算問題的設計方法');
  await beat(tok, 2000);
  const S = ['Divide & Conquer', 'Greedy', 'Dynamic Programming', 'Backtracking', 'Branch & Bound'];
  const ms = S.map((s, i) => { const m = cube(s, i === 0 ? PC.orange : PC.blue, [2.3, 0.6, 1], -4.8 + i * 2.4, 0.3, 0, 3); return m; });
  for (let i = 1; i < 5; i++) { glow(ms[i], GOLD); say('其他策略：' + S[i], ''); await beat(tok, 900); glow(ms[i], null); }
  glow(ms[0], GOLD); move(ms[0], -4.8, 2.4, 0);
  say('這個單元：divide and conquer', '');
  await beat(tok, 2200);
  const p = cube('問題 P', PC.purple, [1.6, 0.6, 1], 2.4, 3.6, 0, 2);
  say('策略適不適用？沒有公式', '靠練習＋幾條 guideline 判斷');
  await beat(tok, 2200);
  tint(p, PC.green); glow(p, GREEN);
  say('適合這個問題，才採用這個策略', '');
  await beat(tok, 2800);
}]);

// ─── zXhWPrMLXGo：merging（A、B 各 4 個 → C） ───
FRAG.push(['dcbari-hmerge', 'Merging：A、B 各 4 個合成 C', async (tok) => {
  fresh([0, 6, 14], [0, 2, 0]);
  const A = [2, 5, 8, 15], B = [4, 7, 10, 12];
  const ax = (i) => -5.6 + i * 1.1, cx = (k) => -1.8 + k * 0.95;
  const ca = A.map((v, i) => cube(v, PC.blue, [0.9, 0.6, 0.9], ax(i), 0.3, -1.6));
  const cb = B.map((v, i) => cube(v, PC.purple, [0.9, 0.6, 0.9], ax(i), 0.3, 1.6));
  tag('A（m = 4）', 'ptr', -6.2, 1.4, -1.6); tag('B（n = 4）', 'ptr', -6.2, 1.4, 1.6); tag('C', 'ptr alt', -1.8, 2.4, 0);
  for (let k = 0; k < 8; k++) ctx.tile(V3(cx(k), 0.04, 0), 0.85, 0.85);
  const cd = code(['while (i < m && j < n)', '  if (A[i] < B[j]) C[k++] = A[i++];', '  else             C[k++] = B[j++];', 'while (i < m) C[k++] = A[i++];', 'while (j < n) C[k++] = B[j++];'], 2.6, 7, 0.46);
  const ip = tag('i', 'ptr', ax(0), 1, -1.6), jp = tag('j', 'ptr', ax(0), 1, 1.6), kp = tag('k', 'ptr alt', cx(0), 1, 0);
  say('兩個已排序串列 → 一個已排序串列', 'i、j、k 指向 A、B、C 的第一格');
  await beat(tok, 2600);
  let i = 0, j = 0, k = 0;
  while (i < 4 && j < 4) {
    glow(ca[i], GOLD); glow(cb[j], GOLD); cd.hl(A[i] < B[j] ? 1 : 2);
    say('比 A[i] = ' + A[i] + ' 與 B[j] = ' + B[j], '小的複製到 C[k]，那邊的索引和 k 前進');
    await beat(tok, k < 2 || k >= 6 ? 1500 : 800);
    glow(ca[i], null); glow(cb[j], null);
    if (A[i] < B[j]) { move(ca[i], cx(k), 0.3, 0); i++; move(ip, ax(Math.min(i, 4)), 1, -1.6); }
    else { move(cb[j], cx(k), 0.3, 0); j++; move(jp, ax(Math.min(j, 4)), 1, 1.6); }
    k++; move(kp, cx(Math.min(k, 7.6)), 1, 0);
    await beat(tok, 500);
  }
  cd.hl(0);
  say('j 跑出 B：B 用完，迴圈停止', 'while (i < m && j < n) 不成立');
  await beat(tok, 2200);
  cd.hl(3);
  say('A 剩下的 15 直接複製到 C', '至少有一邊會剩元素');
  while (i < 4) { move(ca[i], cx(k), 0.3, 0); i++; k++; move(kp, cx(Math.min(k, 7.6)), 1, 0); await beat(tok, 900); }
  cd.hl(-1);
  say('C 也是已排序的', '每個元素搬一次：Θ(m + n)');
  await beat(tok, 3000);
}]);

// ─── zXhWPrMLXGo：四個串列 A B C D 的兩種 merge pattern ───
FRAG.push(['dcbari-habcd', '四個串列 A、B、C、D：不只一種 merge pattern', async (tok) => {
  fresh([0, 5, 14], [0, 2.8, 0]);
  const run = async (x0, steps, title) => {
    tag(title, 'ptr', x0, 7.2);
    const pos = {}; ['A', 'B', 'C', 'D'].forEach((n, q) => { pos[n] = [x0 - 2.1 + q * 1.4, 0.3]; cube(n, PC.blue, [1, 0.55, 0.9], pos[n][0], 0.3, 0, 2); });
    await beat(tok, 900);
    for (const [a, b, c, y] of steps) {
      const x = (pos[a][0] + pos[b][0]) / 2;
      line(pos[a][0], pos[a][1] + 0.3, x, y - 0.3); line(pos[b][0], pos[b][1] + 0.3, x, y - 0.3);
      cube(c, c === 'G' ? PC.green : PC.purple, [1, 0.55, 0.9], x, y, 0, 1.5); pos[c] = [x, y];
      say(title + '：merge ' + a + ' 和 ' + b + ' → ' + c, '');
      await beat(tok, 1600);
    }
  };
  say('四個已排序串列 A、B、C、D', '一次 merge 兩個');
  await beat(tok, 1800);
  await run(-3.4, [['A', 'B', 'E', 2.1], ['C', 'D', 'F', 2.1], ['E', 'F', 'G', 3.9]], '兩兩配對');
  say('4 個 → 3 個 → 2 個 → 1 個', 'G 含有 A、B、C、D 全部元素');
  await beat(tok, 2200);
  await run(3.4, [['A', 'B', 'E', 1.9], ['E', 'C', 'F', 3.5], ['F', 'D', 'G', 5.1]], '一個接一個');
  say('串列多於兩個：合併順序可以不同', 'There can be more than one merge pattern');
  await beat(tok, 3200);
}]);

// ─── zXhWPrMLXGo：8 個單一元素串列 → 7 次 merge ───
FRAG.push(['dcbari-h8lists', '8 個單元素串列：7 次 merge', async (tok) => {
  fresh([0, 5.5, 14.5], [0, 2.8, 0]);
  const a = [8, 3, 7, 5, 9, 2, 6, 4], X = (i) => -5.25 + i * 1.5;
  a.forEach((v, i) => cube(v, PC.blue, [1, 0.55, 0.9], X(i), 0.3, 0, 2));
  const cnt = tag('merge 0 次', 'ptr alt', 0, 7.4);
  say('8 個串列，每個只有 1 個元素', '只有一個元素 → 本來就已排序');
  await beat(tok, 2600);
  let c = 0;
  const lv = [[0, 1], [2, 3], [4, 5], [6, 7]];
  for (const [p, q] of lv) {
    c++; txt(cnt, 'merge ' + c + ' 次');
    const s = srt([a[p], a[q]]);
    line(X(p), 0.6, (X(p) + X(q)) / 2, 1.75); line(X(q), 0.6, (X(p) + X(q)) / 2, 1.75);
    cube(s.join(', '), PC.purple, [2.4, 0.5, 0.9], (X(p) + X(q)) / 2, 2, 0, 1.5);
    say('merge ' + a[p] + ' 和 ' + a[q] + ' → ' + s.join(', '), '');
    await beat(tok, 1100);
  }
  for (const [p, q] of [[0, 3], [4, 7]]) {
    c++; txt(cnt, 'merge ' + c + ' 次');
    const s = srt(a.slice(p, q + 1)), x = (X(p) + X(q)) / 2;
    line((X(p) + X(p + 1)) / 2, 2.25, x, 3.45); line((X(q - 1) + X(q)) / 2, 2.25, x, 3.45);
    cube(s.join(', '), PC.purple, [5.4, 0.5, 0.9], x, 3.7, 0, 1.5);
    say('4 個串列 → 2 個：' + s.join(', '), '');
    await beat(tok, 1500);
  }
  c++; txt(cnt, 'merge ' + c + ' 次');
  line(-3, 3.95, 0, 5.15); line(3, 3.95, 0, 5.15);
  cube(srt(a).join(', '), PC.green, [11, 0.5, 0.9], 0, 5.4, 0, 1.5);
  say('結果放到第三個串列：一個已排序串列', '');
  await beat(tok, 2200);
  say('8 個串列 → 共 7 次 merge', '每次 merge 兩個，串列數少 1');
  await beat(tok, 2600);
  fresh([0, 5.5, 14.5], [0, 2.8, 0]);
  a.forEach((v, i) => cube(v, PC.blue, [1, 0.55, 0.9], X(i), 0.3, 0));
  const cnt2 = tag('merge 0 次', 'ptr alt', 0, 7.4);
  say('換個 pattern：結果一個接一個往下合', '');
  await beat(tok, 1600);
  let px = X(0), py = 0.3, cur = [a[0]];
  for (let i = 1; i < 8; i++) {
    cur = srt([...cur, a[i]]);
    const nx = (px + X(i)) / 2 + 0.2, ny = 0.3 + i * 0.85;
    line(px, py + 0.25, nx, ny - 0.25); line(X(i), 0.55, nx, ny - 0.25);
    cube(cur.join(','), i === 7 ? PC.green : PC.purple, [Math.max(1, cur.length * 0.55), 0.45, 0.9], nx, ny, 0, 1);
    px = nx; py = ny; txt(cnt2, 'merge ' + i + ' 次');
    await beat(tok, 650);
  }
  say('pattern 不同，同樣 7 次 merge', '兩個以上串列：merge pattern 不只一種');
  await beat(tok, 3000);
}]);

// ─── zXhWPrMLXGo：遞迴 merge sort 的 divide 順序 ───
FRAG.push(['dcbari-hmsrec', 'MergeSort(l, h)：一路 divide 到單一元素再 merge', async (tok) => {
  fresh([0, 5, 15], [0, 3.2, 0]);
  const a = [8, 3, 7, 5, 9, 2, 6, 4], X = (i) => -6.2 + i * 1.0;
  const cd = code(['MergeSort(l, h) {', '  if (l < h) {', '    mid = (l + h) / 2;', '    MergeSort(l, mid);', '    MergeSort(mid+1, h);', '    Merge(l, mid, h);', '  }', '}'], 4.2, 6.6, 0.48);
  const cnt = tag('divide 0 次', 'ptr alt', 4.2, 2.2);
  say('l = 1、h = 8：先把陣列在邏輯上切開', '不是真的切開陣列，只是用 l、mid、h 劃範圍');
  const segY = (d) => 6.2 - d * 1.6;
  const segX = (l, h) => (X(l) + X(h)) / 2;
  const segs = {};
  segs['0-7'] = cube(a.join(' '), PC.blue, [7.8, 0.5, 0.8], segX(0, 7), segY(0), 0, 1.2);
  await beat(tok, 2400);
  let dv = 0;
  const rec = async (l, h, d) => {
    if (l === h) return;
    const m = (l + h) >> 1;
    dv++; txt(cnt, 'divide ' + dv + ' 次'); cd.hl(2);
    for (const [p, q] of [[l, m], [m + 1, h]]) {
      segs[p + '-' + q] = cube(a.slice(p, q + 1).join(' '), PC.blue, [(q - p + 1) * 1.0 - 0.15, 0.5, 0.8], segX(p, q), segY(d + 1), 0, 1.2);
      line(segX(l, h), segY(d) - 0.25, segX(p, q), segY(d + 1) + 0.25);
    }
    say('第 ' + dv + ' 次 divide：mid = ⌊(' + (l + 1) + ' + ' + (h + 1) + ')/2⌋ = ' + (m + 1), '左 ' + (l + 1) + '～' + (m + 1) + '、右 ' + (m + 2) + '～' + (h + 1));
    await beat(tok, 1300);
    cd.hl(3); await rec(l, m, d + 1);
    cd.hl(4); await rec(m + 1, h, d + 1);
    cd.hl(5);
    const s = srt(a.slice(l, h + 1)), mm = segs[l + '-' + h];
    relabel(mm, s.join(' ')); tint(mm, PC.green); glow(mm, GREEN);
    say('Merge(' + (l + 1) + ', ' + (m + 1) + ', ' + (h + 1) + ') → ' + s.join(' '), '左右兩半都排好了才 merge');
    await beat(tok, 1300); glow(mm, null);
  };
  await rec(0, 7, 0);
  cd.hl(-1);
  say('7 次 divide、7 次 merge：排好了', '每次都切到 l == h（單一元素）為止');
  await beat(tok, 3000);
}]);

// ─── zXhWPrMLXGo：merge 的結果放在輔助陣列 B ───
FRAG.push(['dcbari-haux', 'Merge 需要輔助陣列 B，再複製回 A', async (tok) => {
  fresh([0, 6.5, 13], [0, 0.6, 0]);
  const X = (i) => -4.9 + i * 1.4;
  let A = [3, 8, 5, 7, 2, 9, 4, 6];
  for (let i = 0; i < 8; i++) { ctx.tile(V3(X(i), 0.04, -1.5), 1.1, 1.1); ctx.tile(V3(X(i), 0.04, 1.5), 1.1, 1.1); }
  tag('A', 'ptr', -6.5, 0.3, -1.5); tag('B（auxiliary）', 'ptr alt', -6.3, 1.2, 1.5);
  let ms = A.map((v, i) => cube(v, PC.blue, [0.95, 0.6, 0.95], X(i), 0.35, -1.5));
  say('兩個串列在同一個陣列 A 裡', 'merge 的結果要放哪裡？');
  await beat(tok, 2400);
  const mergeRange = async (lo, hi, label) => {
    const items = []; for (let i = lo; i <= hi; i++) items.push({ v: A[i], m: ms[i] });
    items.sort((p, q) => p.v - q.v);
    say('merge 結果先寫進 B', label + ' → ' + items.map((o) => o.v).join(' '));
    for (let q = 0; q < items.length; q++) { move(items[q].m, X(lo + q), 0.35, 1.5); await beat(tok, 260); }
    await beat(tok, 900);
    say('再從 B 複製回 A', '');
    items.forEach((o, q) => { move(o.m, X(lo + q), 0.35, -1.5); A[lo + q] = o.v; ms[lo + q] = o.m; });
    await beat(tok, 1200);
  };
  await mergeRange(0, 3, '3 8 + 5 7');
  await mergeRange(4, 7, '2 9 + 4 6');
  await mergeRange(0, 7, '3 5 7 8 + 2 4 6 9');
  ms.forEach((m) => tint(m, PC.green));
  say('需要額外的 auxiliary array', 'merge 要改寫成：A → B，再 B → A');
  await beat(tok, 3000);
}]);

// ─── ak-pz7tS5DE：merge sort 優缺點總覽 ───
FRAG.push(['dcbari-ms-proscons', 'Merge sort 的優點與缺點', async (tok) => {
  fresh([0, 5, 14], [0, 3, 0]);
  const pros = ['適合超大串列', '適合 linked list', '支援 external sorting', 'stable'];
  const cons = ['需要額外空間', '沒有 small problem', '小串列較慢', '遞迴用 stack'];
  tag('Pros', 'ptr', -3.4, 7.2); tag('Cons', 'ptr alt', 3.4, 7.2);
  say('Merge sort 的優點', '');
  for (let i = 0; i < 4; i++) { cube(pros[i], PC.green, [4.4, 0.6, 1], -3.4, 6 - i * 1.3, 0, 2); await beat(tok, 900); }
  await beat(tok, 1400);
  say('Merge sort 的缺點', '');
  for (let i = 0; i < 4; i++) { cube(cons[i], PC.red, [4.4, 0.6, 1], 3.4, 6 - i * 1.3, 0, 2); await beat(tok, 900); }
  say('優點：大量資料、linked list、stable', '缺點：額外空間 n + stack log n');
  await beat(tok, 3200);
}]);

// ─── ak-pz7tS5DE：linked list 的 merge：只改 link ───
FRAG.push(['dcbari-llmerge', 'Linked list merge：只改 link，不用第三個串列', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 0.6, 0]);
  const L1 = [[2, -5.2], [8, -1.4], [12, 4.6]], L2 = [[3, -3.3], [9, 0.6], [11, 2.6]];
  const n1 = L1.map(([v, x]) => lnode(v, x, 0.35, -1.6, PC.blue)), n2 = L2.map(([v, x]) => lnode(v, x, 0.35, 1.6, PC.purple));
  tag('L1', 'ptr', -6.6, 0.4, -1.6); tag('L2', 'ptr', -6.6, 0.4, 1.6);
  const old = [];
  for (let i = 0; i < 2; i++) { old.push(line(L1[i][1] + 0.73, 0.4, L1[i + 1][1] - 0.5, 0.4, -1.6)); old.push(line(L2[i][1] + 0.73, 0.4, L2[i + 1][1] - 0.5, 0.4, 1.6)); }
  say('兩個已排序的 linked list', 'L1：2 → 8 → 12、L2：3 → 9 → 11');
  await beat(tok, 2600);
  old.forEach(kill);
  const all = [[2, n1[0], -1.6], [3, n2[0], 1.6], [8, n1[1], -1.6], [9, n2[1], 1.6], [11, n2[2], 1.6], [12, n1[2], -1.6]];
  const cmp = ['2 vs 3：2 較小 → head', '3 vs 8：3 較小 → 2 指向 3', '8 vs 9：8 較小 → 3 指向 8', '9 vs 12：9 較小 → 8 指向 9', '12 vs 11：11 較小 → 9 指向 11', 'L2 用完：11 指向 12'];
  tag('head', 'ptr alt', -5.2, 1.4, -1.6);
  for (let q = 0; q < 6; q++) {
    glow(all[q][1].userData.data, GOLD);
    if (q > 0) { const p = all[q - 1]; arrow(V3(p[1].position.x + 0.73, 0.75, p[2]), V3(all[q][1].position.x - 0.4, 0.75, all[q][2]), 0xc08a1f); }
    say(cmp[q], '');
    await beat(tok, 1500);
    glow(all[q][1].userData.data, null); tint(all[q][1].userData.data, PC.green);
  }
  say('2 → 3 → 8 → 9 → 11 → 12', '沒有建第三個串列，只改 link');
  await beat(tok, 3200);
}]);

// ─── ak-pz7tS5DE：external sorting ───
FRAG.push(['dcbari-external', 'External merging：檔案比記憶體大', async (tok) => {
  fresh([0, 6, 14], [0, 2, 0]);
  const disk = ghostBox(PC.brown, 5.4, 0.3, 6); disk.position.set(-4, 0.15, 0); tag('Hard disk', 'ptr', -4, 0.4, -3.4);
  const f1 = cube('file 1：5 GB', PC.blue, [2.4, 1.2, 1.6], -4.9, 0.9, -1.4), f2 = cube('file 2：10 GB', PC.purple, [2.4, 1.8, 1.6], -4.9, 1.2, 1.4);
  const ram = ghostBox(PC.green, 4.2, 2.2, 3.4); ram.position.set(2.4, 1.1, 0); tag('RAM 4 GB', 'ptr alt', 2.4, 2.6, -1.9);
  say('兩個大檔要 merge', '資料要先進 main memory 才能 merge');
  await beat(tok, 2600);
  const g1 = cube('5 GB', PC.blue, [1.4, 0.8, 1], -4.9, 0.9, -1.4); move(g1, 1.6, 0.5, -0.8);
  const g2 = cube('10 GB', PC.purple, [1.4, 0.8, 1], -4.9, 1.2, 1.4); move(g2, 3.2, 0.5, 0.8);
  await beat(tok, 900); glow(g1, RED); glow(g2, RED);
  say('15 GB 放不進 4 GB', '整個檔案搬不進記憶體');
  await beat(tok, 2000); fly(g1); fly(g2); await beat(tok, 600);
  const out = cube('', PC.green, [1.4, 0.2, 1.4], -2.6, 0.4, 0); tag('結果', 'idx', -2.6, 0.9, 0);
  say('一次只帶一小塊（run / block）進來', '');
  const b1 = cube('2', PC.blue, [0.8, 0.5, 0.8], -4.9, 1.6, -1.4); move(b1, 1.6, 0.4, -0.8);
  const b2 = cube('3', PC.purple, [0.8, 0.5, 0.8], -4.9, 2.2, 1.4); move(b2, 1.6, 0.4, 0.8);
  await beat(tok, 1600);
  glow(b1, GOLD); glow(b2, GOLD); say('比 2 和 3：2 較小 → 寫出去', ''); await beat(tok, 1400);
  glow(b1, null); glow(b2, null); move(b1, -2.6, 0.75, 0); await beat(tok, 700);
  const b3 = cube('10', PC.blue, [0.8, 0.5, 0.8], -4.9, 1.6, -1.4); move(b3, 1.6, 0.4, -0.8);
  say('file 1 再補下一塊：10', ''); await beat(tok, 1400);
  glow(b3, GOLD); glow(b2, GOLD); say('比 10 和 3：3 寫出去', ''); await beat(tok, 1400);
  glow(b3, null); glow(b2, null); move(b2, -2.6, 1.3, 0); await beat(tok, 800);
  say('只要很小的記憶體就能 merge', 'external merging → external merge sort');
  await beat(tok, 3000);
}]);

// ─── ak-pz7tS5DE：stable ───
FRAG.push(['dcbari-stable', 'Merge sort 是 stable 的', async (tok) => {
  fresh([0, 5.5, 13.5], [0, 1.4, 0]);
  const a = [[6], [8, 'a'], [3], [9], [4], [8, 'b'], [5]], X = (i) => -4.5 + i * 1.5;
  const ms = a.map(([v, t], i) => { const m = cube(v, t === 'a' ? PC.orange : t === 'b' ? PC.pink : PC.blue, t === 'a' ? [0.8, 0.5, 0.8] : t === 'b' ? [1.2, 0.85, 1.2] : [1, 0.6, 1], X(i), 0.3, -1.2); return { v, t, m }; });
  tag('小 8 在前', 'ptr', X(1), 1.4, -1.2); tag('大 8 在後', 'ptr alt', X(5), 1.7, -1.2);
  say('串列裡 8 出現兩次', '小方塊 = 第一個 8、大方塊 = 第二個 8');
  await beat(tok, 2800);
  const s = ms.slice().sort((p, q) => p.v - q.v);
  s.forEach((o, i) => move(o.m, X(i), 0.3, 1.4));
  say('排序後：3 4 5 6 8 8 9', '');
  await beat(tok, 2000);
  glow(s[4].m, GOLD); glow(s[5].m, GOLD);
  say('兩個 8 保持原本的先後順序', '這就是 stable');
  await beat(tok, 2800);
  fresh([0, 5.5, 13.5], [0, 1.4, 0]);
  const r1 = cube('Ravi：8 分', PC.orange, [2.4, 0.6, 1], -2.6, 0.3, -1.2), r2 = cube('Sunil：8 分', PC.pink, [2.4, 0.6, 1], 2.6, 0.3, -1.2);
  say('學生資料已依姓名／學號排好', 'Ravi 在 Sunil 前面，分數都是 8');
  await beat(tok, 2600);
  move(r1, -1.4, 0.3, 1.4); move(r2, 1.4, 0.3, 1.4);
  say('依分數排序：原本的順序不能被打亂', 'Ravi 仍在 Sunil 前面');
  await beat(tok, 3000);
}]);

// ─── ak-pz7tS5DE：not in-place ───
FRAG.push(['dcbari-notinplace', '不是 in-place：陣列要額外空間', async (tok) => {
  fresh([0, 6, 13], [0, 1, 0]);
  const a = [6, 3, 9, 4], X = (i) => -2.25 + i * 1.5;
  let ms = a.map((v, i) => cube(v, PC.blue, [1, 0.6, 1], X(i), 0.3, -1.4));
  tag('A', 'ptr', -4, 0.3, -1.4);
  say('In-place：只在同一個陣列裡重新排列', '例：6 3 9 4');
  await beat(tok, 2600);
  say('merge sort 先切成兩半，再 merge', '');
  move(ms[0], X(0) - 0.4, 0.3, -1.4); move(ms[1], X(1) - 0.4, 0.3, -1.4); move(ms[2], X(2) + 0.4, 0.3, -1.4); move(ms[3], X(3) + 0.4, 0.3, -1.4);
  await beat(tok, 1600);
  move(ms[0], X(1) - 0.4, 0.3, -1.4); move(ms[1], X(0) - 0.4, 0.3, -1.4); move(ms[2], X(3) + 0.4, 0.3, -1.4); move(ms[3], X(2) + 0.4, 0.3, -1.4);
  say('兩半：3 6、4 9', '');
  await beat(tok, 1600);
  const B = ghostBox(PC.orange, 6.2, 0.8, 1.3); B.position.set(0, 0.4, 1.6); tag('額外陣列 B', 'ptr alt', -4.2, 0.4, 1.6);
  const order = [[1, 0], [3, 1], [0, 2], [2, 3]];
  for (const [i, k] of order) { move(ms[i], X(k), 0.3, 1.6); await beat(tok, 500); }
  say('merge 的結果不能寫回同一個陣列', '要額外空間 → 不是 in-place');
  await beat(tok, 2800);
  say('只有陣列需要；linked list 改 link 即可', '');
  await beat(tok, 2600);
}]);

// ─── ak-pz7tS5DE：小串列交給 insertion sort ───
FRAG.push(['dcbari-smallinsert', '沒有 small problem：n ≤ 15 交給 insertion sort', async (tok) => {
  fresh([0, 5.5, 14], [0, 2.8, 0]);
  say('merge sort 一路切到單一元素', '沒有定義 small problem');
  const top = cube('n = 60', PC.blue, [12, 0.5, 0.9], 0, 6, 0, 1.5);
  await beat(tok, 2000);
  const h = [-3, 3].map((x) => cube('30', PC.blue, [5.8, 0.5, 0.9], x, 4.4, 0, 1.2));
  await beat(tok, 900);
  const q = [-4.5, -1.5, 1.5, 4.5].map((x) => cube('15', PC.blue, [2.8, 0.5, 0.9], x, 2.8, 0, 1.2));
  await beat(tok, 900);
  say('小串列（≤ 15 個）還要遞迴：反而比較慢', 'insertion O(n²)、merge O(n log n)，但 n 很小時遞迴浪費時間');
  await beat(tok, 3000);
  q.forEach((m) => { tint(m, PC.orange); relabel(m, 'insertion'); });
  say('小串列改用 insertion sort', '');
  await beat(tok, 2400);
  q.forEach((m) => tint(m, PC.green)); await beat(tok, 700);
  h.forEach((m) => tint(m, PC.green)); await beat(tok, 700);
  tint(top, PC.green); glow(top, GREEN);
  say('排好的小串列再用 merge 合起來', '');
  await beat(tok, 2200);
  say('為什麼選 insertion？它也是 stable', 'bubble sort 也 stable、也是 n²，也可以');
  await beat(tok, 3000);
}]);

// ─── ak-pz7tS5DE：空間 n + log n ───
FRAG.push(['dcbari-msspace', 'Merge sort 空間：auxiliary n + stack log n', async (tok) => {
  fresh([0, 5, 14.5], [0, 3.2, 0]);
  const nodes = [[1, 8, 0, -1.6], [1, 4, 1, -4], [5, 8, 1, 0.8], [1, 2, 2, -5.2], [3, 4, 2, -2.8], [1, 1, 3, -5.8], [2, 2, 3, -4.6]];
  const NY = (d) => 6.4 - d * 1.6;
  const nm = {};
  for (const [l, h, d, x] of nodes) {
    nm[l + '-' + h] = cube(l + '～' + h, PC.blue, [1.1, 0.5, 0.8], x, NY(d), 0, 1.2);
    await beat(tok, 300);
  }
  [['1-8', '1-4'], ['1-8', '5-8'], ['1-4', '1-2'], ['1-4', '3-4'], ['1-2', '1-1'], ['1-2', '2-2']].forEach(([p, c]) => line(nm[p].position.x, nm[p].position.y - 0.25, nm[c].position.x, nm[c].position.y + 0.25));
  say('8 個元素的 tracing tree', '');
  await beat(tok, 1800);
  tag('stack', 'ptr alt', 4.6, 4.2);
  const st = [];
  for (const k of ['1-8', '1-4', '1-2', '1-1']) {
    glow(nm[k], GOLD);
    st.push(cube('MS(' + k.replace('-', ', ') + ')', PC.purple, [2.2, 0.45, 1], 4.6, 0.25 + st.length * 0.5, 0, 1.5));
    say('呼叫 MS(' + k.replace('-', ', ') + ')：推進 stack', 'activation record');
    await beat(tok, 1100);
  }
  say('stack 最深 = tracing tree 的高度', 'log n（這裡 log₂8 = 3 層呼叫 + 1）');
  await beat(tok, 2600);
  for (let i = 3; i >= 1; i--) { fly(st[i]); glow(nm[['1-8', '1-4', '1-2', '1-1'][i]], null); await beat(tok, 400); }
  const aux = cube('auxiliary array：n', PC.orange, [5, 0.5, 1], -1.6, 0.25, 2.2, 1.5);
  say('另外還要 auxiliary array：n', '');
  await beat(tok, 2200);
  say('總空間 n + log n = Θ(n)', '');
  await beat(tok, 3000);
}]);

// ─── uEUXGcc2VXM：遞迴版 binary search ───
const BS = [3, 6, 8, 12, 14, 17, 25, 29, 31, 36, 42, 47, 53, 55, 62];
FRAG.push(['dcbari-rbs-code', 'RBinSearch(l, h, key)：遞迴版 binary search', async (tok) => {
  fresh([0, 6, 14.5], [0, 2.8, 0]);
  const X = (i) => -6.3 + (i - 1) * 0.9;
  const cs = BS.map((v, i) => { tag(String(i + 1), 'idx', X(i + 1), 0, 2.4); return cube(v, PC.blue, [0.75, 0.5, 0.75], X(i + 1), 0.25, 1.6); });
  const cd = code(['RBinSearch(l, h, key) {', '  if (l == h) {', '    if (A[l] == key) return l;', '    else return 0;', '  } else {', '    mid = (l + h) / 2;', '    if (key == A[mid]) return mid;', '    if (key < A[mid])', '      return RBinSearch(l, mid−1, key);', '    else', '      return RBinSearch(mid+1, h, key);', '  }', '}'], -2.2, 7.4, 0.42);
  tag('呼叫', 'ptr alt', 4.6, 7.4);
  say('先定義 small problem：只剩一個元素', 'l == h');
  cd.hl(1); await beat(tok, 2600);
  cd.hl(2); say('那一個是 key 就回傳 l，否則回傳 0', ''); await beat(tok, 2200);
  cd.hl(5); say('否則照常算 mid，再遞迴其中一半', 'key = 42'); await beat(tok, 2000);
  let l = 1, h = 15, depth = 0;
  while (true) {
    tag('RBS(' + l + ', ' + h + ')', 'ptr', 4.6, 6.7 - depth * 0.6);
    for (let i = 1; i <= 15; i++) if (i < l || i > h) tint(cs[i - 1], GRAY);
    if (l === h) {
      cd.hl(2); glow(cs[l - 1], GREEN); tint(cs[l - 1], PC.green);
      say('l = h = ' + l + '：small problem', 'A[' + l + '] = ' + BS[l - 1] + ' == key → return ' + l);
      await beat(tok, 2600); break;
    }
    const m = (l + h) >> 1;
    cd.hl(5); glow(cs[m - 1], GOLD);
    say('mid = ⌊(' + l + ' + ' + h + ')/2⌋ = ' + m, 'A[' + m + '] = ' + BS[m - 1]);
    await beat(tok, 1500); glow(cs[m - 1], null);
    if (42 < BS[m - 1]) { cd.hl(8); say('42 < ' + BS[m - 1] + '：遞迴左半', 'RBinSearch(' + l + ', ' + (m - 1) + ', key)'); h = m - 1; }
    else { cd.hl(10); say('42 > ' + BS[m - 1] + '：遞迴右半', 'RBinSearch(' + (m + 1) + ', ' + h + ', key)'); l = m + 1; }
    await beat(tok, 1500); depth++;
  }
  cd.hl(-1);
  say('每次只呼叫自己一次（左或右）', '這是 divide and conquer 的遞迴演算法');
  await beat(tok, 2800);
}]);

FRAG.push(['dcbari-rbs-rec', 'T(n) = T(n/2) + 1 → Θ(log n)', async (tok) => {
  fresh([0, 5, 14], [0, 3, 0]);
  code(['T(n) = 1            , n = 1', 'T(n) = T(n/2) + 1    , n > 1'], -2.6, 7.2, 0.5);
  say('n = 1：一次比較 → 1', '');
  await beat(tok, 2000);
  say('n > 1：算 mid、比較（常數）＋ 呼叫一半', '左右只會呼叫其中一個 → T(n/2)');
  await beat(tok, 2600);
  const sizes = [16, 8, 4, 2, 1];
  for (let d = 0; d < 5; d++) {
    const w = sizes[d] * 0.7;
    cube('n = ' + sizes[d], d === 4 ? PC.green : PC.blue, [Math.max(0.9, w), 0.5, 0.9], -6 + Math.max(0.9, w) / 2, 5.4 - d * 1.2, 0, 1.2);
    tag('+1', 'ptr alt', 5.6, 5.4 - d * 1.2);
    say(d < 4 ? '規模減半：' + sizes[d] + ' → ' + sizes[d + 1] : '到 1 停：共 log₂16 + 1 = 5 層', '每層成本 1');
    await beat(tok, 1100);
  }
  say('Master theorem：a = 1、b = 2、f(n) = 1', 'log_b a = log₂1 = 0 = k → Θ(n⁰ log n)');
  await beat(tok, 3000);
  say('遞迴版一樣是 Θ(log n)', '');
  await beat(tok, 2600);
}]);

// ─── u7YMFRUFqe0：maximum subarray（LeetCode 例 [-2,1,-3,4,-1,2,1,-5,4]） ───
const MS = [-2, 1, -3, 4, -1, 2, 1, -5, 4];
const MX = (i) => -5.6 + i * 1.4;
function msRow(z = 0, y = 0.3) { return MS.map((v, i) => { tag(String(i), 'idx', MX(i), 0, z + 0.9); return cube(v, v >= 0 ? PC.blue : PC.red, [1.1, 0.6, 0.9], MX(i), y, z); }); }
FRAG.push(['dcbari-msub-intro', 'Maximum subarray：連續、總和最大', async (tok) => {
  fresh([0, 5.5, 13.5], [0, 1.4, 0]);
  const ms = msRow();
  say('找總和最大的連續 subarray', '至少含一個數，回傳它的和');
  await beat(tok, 2600);
  for (let i = 3; i <= 6; i++) { glow(ms[i], GOLD); tint(ms[i], PC.green); await beat(tok, 350); }
  const g = ghostBox(PC.green, 4 * 1.4, 1, 1.3); g.position.set((MX(3) + MX(6)) / 2, 0.5, 0);
  say('4 + (−1) + 2 + 1 = 6', '[4, −1, 2, 1] 最大');
  await beat(tok, 2600);
  say('做法一：雙層迴圈（naive）', '補充：枚舉所有 (i, j) → O(n²)');
  await beat(tok, 2600);
  say('做法二：divide and conquer', '做法三、四：greedy、Kadane');
  await beat(tok, 2800);
}]);

FRAG.push(['dcbari-msub-algo', '分治：max(左半, 右半, 跨中點)', async (tok) => {
  fresh([0, 6, 13.5], [0, 1.6, 0]);
  const ms = msRow(0.8);
  const piv = 4;
  tag('pivot', 'ptr alt', MX(piv), 1.4, 0.8);
  say('從中點切成兩半', '左半 0～pivot、右半 pivot+1～end');
  await beat(tok, 2400);
  const gl = ghostBox(PC.blue, 5 * 1.4, 0.9, 1.2); gl.position.set((MX(0) + MX(4)) / 2, 0.45, 0.8);
  const gr = ghostBox(PC.purple, 4 * 1.4, 0.9, 1.2); gr.position.set((MX(5) + MX(8)) / 2, 0.45, 0.8);
  code(['max( maxSub(左半),', '     maxSub(右半),', '     crossSum )'], 0, 6.4, 0.5);
  say('答案 = 三者取最大', '左半、右半、跨過中點');
  await beat(tok, 2600);
  for (let i = piv; i >= 0; i--) { glow(ms[i], GOLD); await beat(tok, 300); }
  say('left subsum：從 pivot 往左累加的最大和', '');
  await beat(tok, 2000);
  for (let i = piv + 1; i < 9; i++) { glow(ms[i], GREEN); await beat(tok, 300); }
  say('right subsum：從 pivot+1 往右的最大和', 'cross sum = left subsum + right subsum');
  await beat(tok, 3000);
}]);

FRAG.push(['dcbari-msub-dc', '分治例子：切到單一元素再往上合', async (tok) => {
  const part = (ctx.params || {}).part;
  fresh([0, 5, 15], [0, 3.2, 0]);
  const Y = (d) => 6.4 - d * 1.5;
  const SX = (l, h) => (MX(l) + MX(h)) / 2;
  const segs = {};
  const mk = (l, h, d, col) => { segs[l + '-' + h] = cube(MS.slice(l, h + 1).join(', '), col || (l === h ? (MS[l] >= 0 ? PC.blue : PC.red) : PC.purple), [(h - l + 1) * 1.4 - 0.2, 0.5, 0.8], SX(l, h), Y(d), 0, part === 'small' ? 0 : 1.2); };
  const tree = [[0, 8, 0], [0, 4, 1], [5, 8, 1], [0, 2, 2], [3, 4, 2], [5, 6, 2], [7, 8, 2], [0, 1, 3], [2, 2, 3], [3, 3, 3], [4, 4, 3], [5, 5, 3], [6, 6, 3], [7, 7, 3], [8, 8, 3], [0, 0, 4], [1, 1, 4]];
  const par = (l, h) => tree.find(([a, b, d]) => a <= l && h <= b && !(a === l && b === h) && tree.some(([c, e, f]) => c === l && e === h && f === d + 1));
  if (part !== 'small') {
    say('pivot = 中點，一直切到單一元素', '左半含 pivot：[0..4]、[5..8]');
    for (let d = 0; d <= 4; d++) {
      for (const [l, h, dd] of tree) if (dd === d) { mk(l, h, d); const p = par(l, h); if (p) line(SX(p[0], p[1]), Y(p[2]) - 0.25, SX(l, h), Y(d) + 0.25); }
      await beat(tok, 1100);
    }
    await beat(tok, 1400);
  } else {
    for (const [l, h, d] of tree) { mk(l, h, d); const p = par(l, h); if (p) line(SX(p[0], p[1]), Y(p[2]) - 0.25, SX(l, h), Y(d) + 0.25); }
  }
  if (part === 'divide') { say('先看左半，往上合併解答', ''); await beat(tok, 2600); return; }
  const s01 = segs['0-1'];
  glow(s01, GOLD);
  say('[−2, 1]：pivot = −2', 'left −2、right 1、cross −2 + 1 = −1');
  await beat(tok, 2800);
  tint(s01, PC.green); relabel(s01, 'max = 1');
  say('max(−2, 1, −1) = 1', '');
  await beat(tok, 2000); glow(s01, null);
  glow(segs['2-2'], GOLD); say('[−3] 只有一個元素：max = −3', ''); await beat(tok, 2000); glow(segs['2-2'], null);
  const s02 = segs['0-2']; glow(s02, GOLD);
  say('[−2, 1, −3]：pivot = 1', 'left subsum：1、1 + (−2) = −1 → 取 1');
  await beat(tok, 3000);
  say('right subsum = −3', 'cross = 1 + (−3) = −2');
  await beat(tok, 2600);
  tint(s02, PC.green); relabel(s02, 'max = 1');
  say('max(1, −3, −2) = 1', '其他子陣列同樣做法');
  await beat(tok, 2600); glow(s02, null);
  for (const [k, v] of [['3-4', 4], ['0-4', 4], ['5-6', 3], ['7-8', 4], ['5-8', 4]]) { tint(segs[k], PC.green); relabel(segs[k], 'max = ' + v); await beat(tok, 600); }
  say('左半 max = 4、右半 max = 4', '最後算整個陣列的 cross sum');
  await beat(tok, 2800);
}]);

FRAG.push(['dcbari-msub-cross', '整個陣列的 cross sum = 6', async (tok) => {
  fresh([0, 6, 13.5], [0, 1.4, 0]);
  const ms = msRow(0.6);
  tag('pivot', 'ptr alt', MX(4), 1.3, 0.6);
  const lt = tag('left subsum', 'ptr', -3, 4.6), rt = tag('right subsum', 'ptr', 3, 4.6);
  say('左半 max = 4、右半 max = 4', '還差跨中點的 cross sum');
  await beat(tok, 2400);
  let s = 0, best = -Infinity, bi = 4;
  for (let i = 4; i >= 0; i--) {
    s += MS[i]; glow(ms[i], GOLD);
    const sm = tag(String(s), 'idx', MX(i), 1.2, -1); if (s > best) { best = s; bi = i; }
    say('從 pivot 往左：累加到 ' + i + ' = ' + s, '目前最大 ' + best);
    await beat(tok, 1100);
  }
  txt(lt, 'left subsum = ' + best + '（' + bi + '～4）');
  for (let i = 0; i < bi; i++) glow(ms[i], null);
  await beat(tok, 1600);
  let s2 = 0, best2 = -Infinity, bj = 5;
  for (let j = 5; j < 9; j++) {
    s2 += MS[j]; glow(ms[j], GREEN);
    tag(String(s2), 'idx', MX(j), 1.2, -1); if (s2 > best2) { best2 = s2; bj = j; }
    say('從 pivot+1 往右：累加到 ' + j + ' = ' + s2, '目前最大 ' + best2);
    await beat(tok, 1100);
  }
  txt(rt, 'right subsum = ' + best2 + '（5～' + bj + '）');
  for (let j = bj + 1; j < 9; j++) glow(ms[j], null);
  await beat(tok, 1600);
  for (let i = bi; i <= bj; i++) tint(ms[i], PC.green);
  say('cross = 3 + 3 = 6', 'max(4, 4, 6) = 6：[4, −1, 2, 1]');
  await beat(tok, 3200);
}]);

FRAG.push(['dcbari-msub-greedy', 'Greedy：current sum 與 max sum', async (tok) => {
  fresh([0, 6, 13], [0, 1.4, 0]);
  const ms = msRow(0.6);
  const cl = tag('current = −2', 'ptr', -2.8, 4.4), ml = tag('max = −2', 'ptr alt', 2.8, 4.4);
  const cur = tag('▼', 'ptr alt', MX(0), 1.5, 0.6);
  say('current、max 都從第一個值開始', 'current = 局部最大、max = 全域最大');
  glow(ms[0], GOLD);
  await beat(tok, 2600); glow(ms[0], null);
  let c = MS[0], b = MS[0];
  for (let i = 1; i < 9; i++) {
    move(cur, MX(i), 1.5, 0.6); glow(ms[i], GOLD);
    const nc = Math.max(c + MS[i], MS[i]);
    say('current = max(' + c + ' + ' + MS[i] + ', ' + MS[i] + ') = ' + nc, 'max = max(' + b + ', ' + nc + ') = ' + Math.max(b, nc));
    c = nc; b = Math.max(b, c); txt(cl, 'current = ' + c); txt(ml, 'max = ' + b);
    await beat(tok, i < 3 ? 2200 : 1300); glow(ms[i], null);
  }
  say('答案 = max sum = 6', '一次掃描：O(n) 時間、O(1) 空間');
  await beat(tok, 3000);
}]);

FRAG.push(['dcbari-msub-kadane', 'Kadane：前一格 > 0 就加上去', async (tok) => {
  fresh([0, 6, 13], [0, 1.4, 0]);
  const ms = msRow(0.6), v = MS.slice();
  const ml = tag('max = −2', 'ptr alt', 0, 4.4);
  code(['for i = 1 .. n−1:', '  if nums[i−1] > 0: nums[i] += nums[i−1]', '  max = max(max, nums[i])'], 0, 6.6, 0.45);
  say('直接改 input array（DP）', 'max 初值 = nums[0] = −2');
  await beat(tok, 2600);
  let b = v[0];
  for (let i = 1; i < 9; i++) {
    glow(ms[i - 1], GOLD); glow(ms[i], GOLD);
    if (v[i - 1] > 0) { v[i] += v[i - 1]; relabel(ms[i], v[i]); tint(ms[i], v[i] >= 0 ? PC.green : PC.red); say('nums[' + (i - 1) + '] = ' + v[i - 1] + ' > 0：加上去', 'nums[' + i + '] = ' + v[i]); }
    else say('nums[' + (i - 1) + '] = ' + v[i - 1] + ' ≤ 0：不加', 'nums[' + i + '] 維持 ' + v[i]);
    b = Math.max(b, v[i]); txt(ml, 'max = ' + b);
    await beat(tok, i < 3 ? 2200 : 1300);
    glow(ms[i - 1], null); glow(ms[i], null);
  }
  say('max sum = 6', '');
  await beat(tok, 2000);
  say('分治 O(n log n)；greedy、Kadane O(n)', '空間：分治 O(log n) stack；另兩者 O(1)');
  await beat(tok, 3200);
}]);
  }

  // ═══ dcjiang.js ═══
  {
// ─── 62uS-MOv0bY / sweW4TVFpbQ：交大江蕙如 Lec15–16 Divide and Conquer（Kleinberg–Tardos 投影片） ───
// 只用 K 與 ctx。老師自己的例子：weak / strong induction、8×8 defective chessboard（L 形磁磚 21 塊）、骨牌；
// binary search 找 55（41 → 72 → 55，旁邊是 68）；merge sort 用 ALGORITHMS（MERGE 時是 AGLOR + HIMST）；
// counting inversion 用 2 4 1 3 5（3 個）與 1 5 4 8 10 2 | 6 9 12 11 3 7（5 + 8 + 9）；closest pair 的 12、21、8。
// 示意值：binary search 陣列中 41、55、68、72 以外的數；棋盤洞的位置；closest pair 各點座標（只對齊 12 / 21 / 8 三個距離）；
// heap vs linked list 的數值；1D closest pair 的點。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, showL, code, anim, line, arrow, ghostBox, lnode, GOLD, GREEN, RED, GRAY } = K;
const say = ctx.say, beat = ctx.beat, colorFor = ctx.colorFor, lab = ctx.lab, THREE = ctx.THREE;
const BLUE = '#1f3a6e', OK = '#2fc092', SAND = '#c9b48e', DIM = '#bfb6a6';
const prm = () => ctx.params || {};
const lc = (ch) => colorFor(String(ch).charCodeAt(0));
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

// 01:02 weak vs strong induction
FRAG.push(['dcjiang-induction', 'Weak vs Strong induction', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 2.2, 0]);
  const xs = (i) => -5.6 + i * 1.6, A = [], B = [];
  tag('Weak：P(k) ⇒ P(k+1)', 'ptr', 0, 5.3);
  tag('Strong：P(1..k) ⇒ P(k+1)', 'ptr alt', 0, 2.0);
  for (let i = 0; i < 8; i++) {
    A.push(cube(i + 1, GRAY, [0.9, 0.9, 0.9], xs(i), 3.9, 0));
    B.push(cube(i + 1, GRAY, [0.9, 0.9, 0.9], xs(i), 0.6, 0));
  }
  say('basic step：最小的 case 成立', 'n = 1 時 statement 為真');
  tint(A[0], OK); tint(B[0], OK); glow(A[0], GREEN); glow(B[0], GREEN);
  await beat(tok, 2400);
  say('Weak：k 對 ⇒ k+1 對', 'hypothesis：n = k 成立');
  for (let k = 0; k < 7; k++) {
    const a = arrow(V3(xs(k), 4.55, 0), V3(xs(k + 1), 4.55, 0), 0x0f5a3a);
    await beat(tok, 450); tint(A[k + 1], OK); await beat(tok, 300); kill(a);
  }
  say('每次只前進一步 → weak', '1 ⇒ 2 ⇒ 3 ⇒ … ⇒ n');
  await beat(tok, 2000);
  say('Strong：≤ k 都對 ⇒ k+1 對', '可一次跳一大步，例如用 P(n/2)');
  for (let t = 1; t < 8; t++) {
    const g = ghostBox('#c08a1f', t * 1.6, 1.1, 1.1); g.position.set((xs(0) + xs(t - 1)) / 2, 0.6, 0);
    const f = Math.floor((t + 1) / 2) - 1;
    const a = arrow(V3(xs(f), 1.25, 0.3), V3(xs(t), 1.25, 0.3), 0x6a4a00);
    await beat(tok, 650); tint(B[t], OK); await beat(tok, 300); kill(a); kill(g);
  }
  say('跟 2ᵏ 有關時常用 strong', '從 2ᵏ 直接推到 2ᵏ⁺¹');
  await beat(tok, 2200);
  say('兩者其實等價，看題目選', 'weak ≡ strong（一樣強）');
  await beat(tok, 2600);
}]);

// 08:21 骨牌
FRAG.push(['dcjiang-domino', '數學歸納法＝推倒骨牌', async (tok) => {
  fresh([0, 3.2, 11], [0, 1.2, 0]);
  const N = 8, xs = (i) => -5.6 + i * 1.5, H = 2.2, D = [];
  for (let i = 0; i < N; i++) {
    D.push(cube(null, i === 0 ? OK : SAND, [0.25, H, 1.0], xs(i), H / 2, 0));
    tag(String(i + 1), 'idx', xs(i), -0.2, 0.9);
  }
  const fall = (i, th) => anim(tok, 380, (t) => {
    const a = th * t; const m = D[i];
    m.rotation.z = -a; m.position.set(xs(i) + Math.sin(a) * H / 2, Math.cos(a) * H / 2, 0);
  });
  say('骨牌排好：第 1 張要倒', 'basic step：P(1)');
  await beat(tok, 3000);
  const k = tag('k', 'ptr', xs(0), 3.0);
  await fall(0, 0.72);
  say('第 k 張倒 ⇒ 推倒第 k+1 張', 'inductive step：P(k) ⇒ P(k+1)');
  for (let i = 1; i < N; i++) {
    k.position.set(xs(i), 3.0, 0); tint(D[i], OK);
    await beat(tok, 800);
    await fall(i, i === N - 1 ? 1.45 : 0.72);
  }
  say('1 倒 → 2 倒 → … 全部倒下', '這就是 weak induction');
  await beat(tok, 3000);
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

// 05:13 8×8 defective chessboard
FRAG.push(['dcjiang-tromino-8x8', 'Defective chessboard：63 格、21 塊', async (tok) => {
  fresh([0, 10.5, 5.2], [0, 0, 0.4]);
  const cs = 0.72, HOLE = [1, 5];
  say('8×8 棋盤方格（浴室地板）', '共 64 格');
  const B = board(8, cs, -0.6, 0);
  await beat(tok, 2000);
  const [hx, hz] = B.at(HOLE[0], HOLE[1]);
  cube(null, '#3a2f22', [cs * 0.9, 0.12, cs * 0.9], hx, 0.08, hz, 1.2);
  const ht = tag('排水孔', 'ptr', hx, 0.8, hz - 0.6);
  say('挖一個洞 → defective', '64 − 1 = 63 格；洞在哪都可以');
  await beat(tok, 2600);
  // the L-shaped tile on the side
  const sx = 4.6, sz = -1.2;
  [[0, 0], [1, 0], [1, 1]].forEach(([r, c]) => cube(null, '#dd8238', [cs * 0.86, 0.3, cs * 0.86], sx + c * cs, 0.22, sz + r * cs, 1.2));
  tag('L 形磁磚', 'ptr alt', sx + 0.35, 0.9, sz - 0.7);
  say('用 L 形磁磚貼滿？', '一塊佔 3 格');
  await beat(tok, 2400);
  kill(ht);
  say('隨便貼，運氣好就貼完', '63 ÷ 3 = 21 塊');
  const T = tromTiles(8, HOLE[0], HOLE[1]).map((t, i) => [t, i]);
  for (let i = T.length - 1; i > 0; i--) { const j = (i * 7 + 3) % (i + 1); [T[i], T[j]] = [T[j], T[i]]; }
  let cnt = 0; const ct = tag('0 塊', 'ptr', -0.6, 0.9, -3.6);
  for (const [t, i] of T) { await layTrom(tok, B, t, cs, TC[i % TC.length], 0); cnt++; txt(ct, cnt + ' 塊'); await beat(tok, 260); }
  say('但要不論洞在哪都貼得出來', 'general solution？');
  await beat(tok, 2200);
  say('任意 2ⁿ × 2ⁿ 都貼得滿', '證明方法：數學歸納法');
  await beat(tok, 2800);
}]);

// 09:55 induction proof → algorithm
FRAG.push(['dcjiang-tromino-split', '歸納證明：切四塊、中央放一塊', async (tok) => {
  fresh([0, 10.5, 5.2], [0, 0, 0.4]);
  const holes = [[0, 0], [0, 1], [1, 0], [1, 1]];
  say('Base n = 1：2×2 只有 4 種', '挖掉一格，剩下正好一塊 L');
  const bs = holes.map((h, k) => board(2, 0.9, -4.2 + k * 2.8, 0, h));
  await beat(tok, 1600);
  for (let k = 0; k < 4; k++) { const t = tromTiles(2, holes[k][0], holes[k][1])[0]; await layTrom(tok, bs[k], t, 0.9, TC[k], 350); }
  await beat(tok, 1800);
  fresh([0, 10.5, 5.2], [0, 0, 0.4]);
  const cs = 0.72, HOLE = [1, 5], B = board(8, cs, 0, 0, HOLE);
  say('假設 2ⁿ×2ⁿ 可貼，證 2ⁿ⁺¹', 'inductive step（weak）');
  await beat(tok, 2200);
  const L1 = [bar(-2.95, 0, 2.95, 0, '#6e5f49', 0.08), bar(0, -2.95, 0, 2.95, '#6e5f49', 0.08)];
  say('2ⁿ⁺¹ 是 2ⁿ 的兩倍 → 切四塊', '四塊都是 2ⁿ × 2ⁿ');
  await beat(tok, 2200);
  const T = tromTiles(8, HOLE[0], HOLE[1]);
  const t0 = T.filter((t) => t.lv === 0);
  say('洞在一塊；另三塊靠中央挖一格', '三格正好放一塊 L');
  const c0 = await layTrom(tok, B, t0[0], cs, '#d64545', 400);
  c0.forEach((m) => glow(m, GOLD));
  await beat(tok, 2000);
  c0.forEach((m) => glow(m, null));
  say('四塊都是 defective 2ⁿ×2ⁿ', '由 hypothesis：各自貼得滿');
  const g = [];
  for (const [x, z] of [[-1.44, -1.44], [1.44, -1.44], [-1.44, 1.44], [1.44, 1.44]]) {
    g.push(bar(x - 1.42, z, x + 1.42, z, '#a99470'), bar(x, z - 1.42, x, z + 1.42, '#a99470'));
  }
  await beat(tok, 1200);
  for (const t of T.filter((t) => t.lv === 1)) await layTrom(tok, B, t, cs, '#9b7ef4', 450);
  await beat(tok, 800);
  say('遞迴到 2×2：直接放', '演算法：切四塊 → 中央一塊 → 遞迴');
  let i = 0;
  for (const t of T.filter((t) => t.lv === 2)) { await layTrom(tok, B, t, cs, TC[i++ % TC.length], 220); }
  say('1 + 4 + 16 = 21 塊', '歸納法：給證明，也給演算法');
  await beat(tok, 3000);
}]);

// 16:52 naive search
FRAG.push(['dcjiang-linear-search', 'Searching：一一比對 O(n)', async (tok) => {
  fresh([0, 3.5, 11.5], [0, 1, 0]);
  const R = jRow(BS, { tiles: true, idx: true, y: 0.5 });
  const xt = tag('x = 55', 'ptr alt', -5.2, 3.2);
  say('已排序、互不相同；找 x', '有就輸出位置，沒有回報不存在');
  await beat(tok, 2600);
  say('naive：每個都拿出來比', '從頭到尾比一圈');
  const cur = tag('↓', 'ptr', R.x(0), 1.7);
  let k = 0;
  for (let i = 0; i < R.n; i++) {
    cur.position.set(R.x(i), 1.7, 0); glow(R.m[i], BLUE); k++;
    say('55 和 ' + BS[i] + ' 比', '比較次數 = ' + k);
    await beat(tok, 1150);
    if (BS[i] === 55) { glow(R.m[i], GREEN); break; }
    glow(R.m[i], null);
  }
  say('找到：第 7 個位置', 'worst case 比 n 次 → O(n)');
  await beat(tok, 2600);
  kill(xt);
  say('linear time 對它還不夠快', '一一比對沒用到「已排序」');
  await beat(tok, 3000);
}]);

// 20:13 binary search for 55
FRAG.push(['dcjiang-bsearch-55', 'Binary search：找 55', async (tok) => {
  fresh([0, 3.5, 11.5], [0, 1, 0]);
  const R = jRow(BS, { tiles: true, idx: true, y: 0.5 });
  tag('x = 55', 'ptr alt', -5.2, 3.2);
  const lo = tag('low', 'ptr', R.x(0), -1.2, 0.7), hi = tag('high', 'ptr', R.x(10), -1.2, 0.7), md = tag('mid', 'ptr alt', R.x(5), 1.7);
  const cut = (a, b) => { for (let i = a; i <= b; i++) { tint(R.m[i], DIM); glow(R.m[i], null); move(R.m[i], R.x(i), 0.3, -0.9); } };
  say('先跟正中央的人比', 'mid = ⌊(1 + 11)/2⌋ = 6');
  glow(R.m[5], BLUE); await beat(tok, 2200);
  say('55 > 41：只可能在右側', '左半（含 41）全部砍掉');
  await beat(tok, 1500); cut(0, 5); lo.position.set(R.x(6), -1.2, 0.7);
  await beat(tok, 1800);
  say('右半的中間是 72', 'mid = ⌊(7 + 11)/2⌋ = 9');
  md.position.set(R.x(8), 1.7, 0); glow(R.m[8], BLUE); await beat(tok, 2000);
  say('72 > 55：72 和右邊都砍', '只剩 55、68 兩個');
  await beat(tok, 1300); cut(8, 10); hi.position.set(R.x(7), -1.2, 0.7);
  await beat(tok, 1800);
  say('剩兩個：中間取左取右都行', '取左：mid = ⌊(7 + 8)/2⌋ = 7');
  md.position.set(R.x(6), 1.7, 0); glow(R.m[6], BLUE); await beat(tok, 2200);
  glow(R.m[6], GREEN); tint(R.m[6], OK);
  say('55 = 55：找到！', 'index 一路都知道 → 輸出位置 7');
  await beat(tok, 2400);
  say('若連 68 都不是 → 不存在', '所有人都考慮過才放棄');
  await beat(tok, 2600);
}]);

// 23:16 halving
FRAG.push(['dcjiang-bsearch-halving', '每比一次砍一半：log n 次', async (tok) => {
  fresh([0, 3.5, 11.5], [0, 1.2, 0]);
  const n = 16, R = jRow(Array.from({ length: n }, (_, i) => null), { dx: 0.7 });
  for (let i = 0; i < n; i++) R.m[i] = cube(null, '#4b9ee2', [0.6, 0.6, 0.6], R.x(i), 0.5, 0);
  const st = tag('n = 16', 'ptr', 0, 2.4);
  say('每比一次中間的人', '沒找到也能丟掉一半');
  await beat(tok, 2200);
  let a = 0, b = n - 1, k = 0, size = n;
  while (size > 1) {
    const m = Math.floor((a + b) / 2); glow(R.m[m], GOLD); k++;
    await beat(tok, 700);
    // keep the right half (worst case keeps going)
    for (let i = a; i <= m; i++) { tint(R.m[i], DIM); glow(R.m[i], null); move(R.m[i], R.x(i), 0.3, -1.0); }
    a = m + 1; size = b - a + 1;
    txt(st, 'n/' + (n / size) + ' = ' + size + ' 個'); st.position.set((R.x(a) + R.x(b)) / 2, 2.4, 0);
    say('第 ' + k + ' 次比較後', '剩 n/2^' + k + ' = ' + size + ' 個');
    await beat(tok, 1500);
  }
  glow(R.m[a], GOLD); k++;
  say('worst case：比到最後一個', '比較次數 ≈ log₂16 + 1 = ' + k);
  await beat(tok, 2400);
  say('O(n) → O(log n)', 'n/2ᵏ = 1 ⇒ k = log₂n');
  await beat(tok, 3000);
}]);

// 24:55 / 28:05 divide, conquer, combine（params.bs：用 binary search 看）
FRAG.push(['dcjiang-dc-steps', 'Divide → Conquer → Combine', async (tok) => {
  fresh([0, 3.6, 12.5], [0, 2.6, 0]);
  const bs = !!prm().bs;
  tag('Divide', 'ptr', -5.6, 5.4); tag('Conquer', 'ptr', -5.6, 3.4); tag('Combine', 'ptr', -5.6, 1.2);
  if (!bs) {
    const P = cube('P（size n）', '#4b9ee2', [5, 0.9, 1], 0.6, 5.4, 0);
    say('問題太大不會做', '先切成小問題 → divide');
    await beat(tok, 2800);
    const A = cube('P（n/2）', '#4b9ee2', [2.4, 0.8, 1], -0.75, 5.4, 0), Bm = cube('P（n/2）', '#4b9ee2', [2.4, 0.8, 1], 1.95, 5.4, 0);
    kill(P); move(A, -1.4, 3.4, 0); move(Bm, 2.6, 3.4, 0);
    say('子問題長相跟原問題一樣', '只是 problem size 較小');
    glow(A, GOLD); glow(Bm, GOLD); await beat(tok, 2600); glow(A, null); glow(Bm, null);
    const r1 = tag('↻ recursive', 'ptr alt', -1.4, 4.3), r2 = tag('↻ recursive', 'ptr alt', 2.6, 4.3);
    say('Conquer：recursively 解', '小到一眼可解就直接處理');
    await beat(tok, 2200);
    const s1 = cube('解₁', OK, [1.6, 0.7, 1], -1.4, 1.2, 0, 1.6), s2 = cube('解₂', OK, [1.6, 0.7, 1], 2.6, 1.2, 0, 1.6);
    await beat(tok, 1500); kill(r1); kill(r2);
    say('Combine：子解組回原問題的解', '三步驟缺一不可');
    move(s1, -0.2, 1.2, 0); move(s2, 1.4, 1.2, 0);
    await beat(tok, 1200);
    const S = cube('原問題的解', OK, [3.6, 0.8, 1.1], 0.6, 1.2, 0); kill(s1); kill(s2); glow(S, GOLD);
    await beat(tok, 1600);
    say('通常 combine 最難', '例外：binary search 的 combine 什麼都不做');
    await beat(tok, 3000);
    return;
  }
  const R = jRow(BS, { dx: 0.92, sz: 0.7, y: 5.4, x0: -3.6 });
  say('Divide：跟中間的人比', 'x = 55 vs 41');
  glow(R.m[5], BLUE); await beat(tok, 2800);
  say('已排序：另一側完全不用理', '55 > 41 → 只留右半');
  for (let i = 0; i <= 5; i++) { tint(R.m[i], DIM); glow(R.m[i], null); fly(R.m[i], V3(-2, 3, -3)); }
  await beat(tok, 1600);
  for (let i = 6; i < R.n; i++) move(R.m[i], R.x(i) - 3.2, 3.4, 0);
  say('Conquer：recursively 找右半', 'BS(右半, x)');
  tag('↻ recursive', 'ptr alt', 2.0, 4.3);
  await beat(tok, 2600);
  const yes = cube('yes：位置 7', OK, [2.6, 0.7, 1], 0.9, 1.2, 0, 1.6);
  say('Combine：do nothing', '最後只有 yes / no');
  await beat(tok, 2600); glow(yes, GOLD);
  say('combine 已隱含在 divide 裡', '每次只處理一個人');
  await beat(tok, 3200);
}]);

// 32:17 / 35:49 / Lec16 33:36 template：均分兩半 + linear combine
FRAG.push(['dcjiang-template', 'D&C 範本：均分兩半 ⇒ n log n', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 3, 0]);
  const Y = [5.6, 4.1, 2.6, 1.1], lv = [];
  const W = 9.6;
  say('Divide：切成均勻的兩半', 'divide 在 linear time 內');
  for (let d = 0; d < 4; d++) {
    const k = 1 << d, w = W / k, row = [];
    for (let i = 0; i < k; i++) row.push(cube(d === 0 ? 'n' : 'n/' + k, '#4b9ee2', [w - 0.15, 0.7, 1], -0.6 - W / 2 + (i + 0.5) * w, Y[d], 0, d ? 1.2 : 0));
    lv.push(row);
    await beat(tok, 900);
  }
  say('Conquer：兩半各自 recursive', '同樣的問題、size 減半');
  await beat(tok, 2000);
  say('Combine：兩兩合併回來', 'combine 也做到 linear time');
  for (let d = 3; d >= 0; d--) {
    lv[d].forEach((m) => { tint(m, OK); glow(m, GOLD); });
    tag('cn', 'ptr alt', 5.6, Y[d]);
    await beat(tok, 800);
    lv[d].forEach((m) => glow(m, null));
  }
  say('寫成 recurrence relation', 'T(n) = 2T(n/2) + O(n)');
  await beat(tok, 2400);
  tag('log₂n 層', 'ptr', -6.2, 3.4);
  say('每層 cn × log n 層', '⇒ T(n) = O(n log n)');
  await beat(tok, 2600);
  say('正確性：數學歸納法', '小的對 ⇒ 合起來也對');
  await beat(tok, 2800);
}]);

// 38:03 comparison sort lower bound
FRAG.push(['dcjiang-sort-bound', 'Sorting：只靠比較，下限 n log n', async (tok) => {
  fresh([0, 3.4, 12], [0, 2.4, 0]);
  const items = [[-3.8, 'bubble sort', 'n²', 6.0, '#d64545'], [0, 'heap / merge sort', 'n log n', 2.2, '#4b9ee2'], [3.8, 'linear sorting', 'n', 0.9, '#2fc092']];
  say('Sorting：n 個數由小排到大', '解法很多，有慢有快');
  await beat(tok, 2600);
  for (const [x, name, f, h, c] of items) {
    const m = cube(null, c, [1.6, 1, 1.2], x, 0.01, 0); m.scale.y = 0.01;
    tag(name, 'idx', x, -0.4, 0.8);
    await anim(tok, 900, (t) => { m.scale.y = Math.max(0.01, h * t); m.position.y = h * t / 2; });
    tag(f, 'ptr', x, h + 0.5);
    await beat(tok, 700);
  }
  const lb = line(-5.6, 2.2, 5.6, 2.2, 0.7, '#7a1010');
  tag('Ω(n log n)', 'ptr alt', -5.2, 2.6, 0.7);
  say('只用比大小 → 下限 n log n', 'comparison sort 不可能更快');
  await beat(tok, 2800);
  say('linear sort 要額外資訊', '例如數值範圍、位數');
  await beat(tok, 2400);
  say('merge sort 達到最佳 n log n', 'theoretically optimal');
  await beat(tok, 2800);
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
  const merge = (nd) => {
    const pairs = []; for (let k = nd.lo; k <= nd.hi; k++) pairs.push([arr[k], cur[k]]);
    pairs.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    pairs.forEach(([ch, m], i) => { arr[nd.lo + i] = ch; cur[nd.lo + i] = m; });
    place(nd, nd.d);
  };
  const str = (a, b) => arr.slice(a, b + 1).join('');
  if (mode === 'idea') {
    say('把 ALGORITHMS 由小排到大', 'A 最小、Z 最大');
    await beat(tok, 3000);
    place(root.kids[0], 1); place(root.kids[1], 1);
    say('一次排不會 → 先拆一半', 'divide：ALGOR | ITHMS');
    await beat(tok, 2600);
    say('左右兩半各自排好', 'conquer（先假裝會排）');
    await beat(tok, 1600);
    for (const kd of root.kids) { const p = []; for (let k = kd.lo; k <= kd.hi; k++) p.push([arr[k], cur[k]]); p.sort((a, b) => (a[0] < b[0] ? -1 : 1)); p.forEach(([ch, m], i) => { arr[kd.lo + i] = ch; cur[kd.lo + i] = m; }); place(kd, 1); }
    await beat(tok, 1400);
    say('得到 ' + str(0, 4) + ' 與 ' + str(5, 9), '各自已排序，但還不是答案');
    await beat(tok, 2600);
    merge(root);
    say('combine：重新安排成一列', '→ ' + str(0, 9));
    await beat(tok, 3000);
    return;
  }
  const byDepth = (d) => nodes.filter((nd) => nd.d === d);
  const maxD = Math.max(...nodes.map((nd) => nd.d));
  if (mode === 'split' || mode === 'par') {
    say(mode === 'split' ? '切完左右各 5 個，還是不會' : 'base case 不成立 → 切兩半', 'recursively 繼續切');
    await beat(tok, 2000);
    for (let d = 0; d < maxD; d++) {
      byDepth(d).filter((nd) => nd.lo < nd.hi).forEach((nd) => nd.kids.forEach((kd) => place(kd, d + 1)));
      await beat(tok, 1800);
    }
    say('切到只剩一個：直接 return', 'stop condition：p = r');
    nodes.filter((nd) => nd.lo === nd.hi).forEach((nd) => glow(cur[nd.lo], GREEN));
    await beat(tok, 2600);
    nodes.forEach((nd) => { if (nd.lo === nd.hi) glow(cur[nd.lo], null); });
    if (mode === 'split') {
      say('兩個還要比一下；一個不用', 'base case：1 個已排序');
      await beat(tok, 3000);
      return;
    }
    for (let d = maxD - 1; d >= 0; d--) {
      const ms = byDepth(d).filter((nd) => nd.lo < nd.hi);
      ms.forEach(merge);
      say('第 ' + d + ' 層 merge', ms.map((nd) => str(nd.lo, nd.hi)).join(' | '));
      await beat(tok, 1700);
    }
    say('最後一次 merge 得到答案', str(0, n - 1));
    await beat(tok, 3000);
    return;
  }
  // sequential (real recursion order): left subtree finishes before the right one starts
  say('實際 sequential：先做左側', '一路往左切下去');
  await beat(tok, 2000);
  let g = null;
  const box = (nd) => { if (g) kill(g); g = ghostBox('#c08a1f', (nd.hi - nd.lo + 1) * 0.95 + 0.6, 1.1, 1.2); g.position.set((X(nd.lo, nd.d) + X(nd.hi, nd.d)) / 2, Y(nd.d), 0); };
  async function run(nd) {
    if (nd.lo === nd.hi) { glow(cur[nd.lo], GREEN); await beat(tok, 350); glow(cur[nd.lo], null); return; }
    box(nd);
    nd.kids.forEach((kd) => place(kd, nd.d + 1));
    say('MERGE-SORT：' + str(nd.lo, nd.hi), 'split → ' + str(nd.lo, nd.q) + ' | ' + str(nd.q + 1, nd.hi));
    await beat(tok, 800);
    await run(nd.kids[0]); await run(nd.kids[1]);
    merge(nd); box(nd);
    say('MERGE → ' + str(nd.lo, nd.hi), nd === root ? '左右都好了才最後合併' : '這一段完成，回到上一層');
    await beat(tok, 800);
  }
  await run(root);
  if (g) kill(g);
  say('左半全部做完，才做右半', '結果：' + str(0, n - 1));
  await beat(tok, 3000);
}]);

const MSC = ['MERGE-SORT(A, p, r)', '1  if p < r', '2     q = ⌊(p + r) / 2⌋', '3     MERGE-SORT(A, p, q)', '4     MERGE-SORT(A, q + 1, r)', '5     MERGE(A, p, q, r)'];

// 43:50 MERGE-SORT(A, p, r)
FRAG.push(['dcjiang-ms-code', 'MERGE-SORT(A, p, r) 五行', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 2.8, 0]);
  const C = code(MSC, -1.2, 6.0);
  const R = jRow('ALGORITHMS'.split(''), { dx: 0.95, y: 0.6, sz: 0.72, idx: true, tiles: true, col: lc });
  const tp = tag('p', 'ptr', R.x(0), 1.6), tr = tag('r', 'ptr', R.x(9), 1.6);
  say('A[p..r]：要排序的那一段', 'p = 1, r = 10');
  C.hl(0); await beat(tok, 2400);
  C.hl(1); say('if p < r：至少兩個才做', 'p = r：只剩一個，直接 return');
  await beat(tok, 2600);
  C.hl(2); const tq = tag('q', 'ptr alt', R.x(4), 1.6);
  say('取中點（floor 或 ceiling 皆可）', 'q = ⌊(1 + 10)/2⌋ = 5');
  await beat(tok, 2600);
  C.hl(3); let g = ghostBox('#4b9ee2', 5 * 0.95, 1, 1.1); g.position.set((R.x(0) + R.x(4)) / 2, 0.6, 0);
  say('左半 recursive', 'MERGE-SORT(A, 1, 5)');
  await beat(tok, 2200); kill(g);
  C.hl(4); g = ghostBox('#2fc092', 5 * 0.95, 1, 1.1); g.position.set((R.x(5) + R.x(9)) / 2, 0.6, 0);
  say('右半 recursive', 'MERGE-SORT(A, 6, 10)');
  await beat(tok, 2200); kill(g);
  C.hl(5); g = ghostBox('#c08a1f', 10 * 0.95, 1, 1.1); g.position.set((R.x(0) + R.x(9)) / 2, 0.6, 0);
  say('MERGE：兩段已排序的合併', 'MERGE(A, 1, 5, 10)');
  await beat(tok, 2400);
  C.hl(-1);
  tag('divide', 'ptr', 4.4, 5.2); tag('conquer', 'ptr', 4.4, 4.3); tag('combine', 'ptr', 4.4, 3.5);
  say('1–2 divide、3–4 conquer、5 combine', '程式長相跟 D&C 步驟一樣');
  await beat(tok, 3200);
  [tp, tr, tq].forEach(kill);
}]);

// 52:03 / Lec16 00:16 running time
FRAG.push(['dcjiang-ms-recurrence', 'T(n) = D(n) + 2T(n/2) + C(n)', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 3, 0]);
  const C = code(MSC, -2.6, 5.8);
  say('設 T(n)：n 個數要花的時間', 'T(n) = ?');
  await beat(tok, 2400);
  C.hl(1); await beat(tok, 500); C.hl(2);
  const a = tag('D(n)', 'ptr', 3.6, 4.9);
  say('第 1–2 行：divide', '比 p、r，算中點 → D(n) = O(1)');
  await beat(tok, 2800); txt(a, 'D(n) = O(1)');
  C.hl(3); const b = tag('T(n/2)', 'ptr', 3.6, 4.1); await beat(tok, 1000);
  C.hl(4); const b2 = tag('T(n/2)', 'ptr', 3.6, 3.6);
  say('第 3–4 行：各處理 n/2 個', '同樣的問題 → 2T(n/2)');
  await beat(tok, 2600);
  C.hl(5); const c = tag('C(n)', 'ptr alt', 3.6, 3.0);
  say('第 5 行：combine', 'C(n)：目標做到 O(n)');
  await beat(tok, 2600);
  C.hl(-1);
  const f = tag('T(n) = D(n) + 2T(n/2) + C(n)', 'ptr', 0, 1.6);
  say('用自己定義自己', 'recurrence relation');
  await beat(tok, 2600);
  txt(f, 'T(n) = 2T(n/2) + O(n)'); txt(c, 'C(n) = O(n)');
  say('若 MERGE 是 linear time', '⇒ T(n) = O(n log n)');
  await beat(tok, 3200);
}]);

// ═════════════ Lec16 ═════════════

// 05:26 MERGE with AGLOR / HIMST
FRAG.push(['dcjiang-merge-aglor', 'MERGE：AGLOR + HIMST', async (tok) => {
  fresh([0, 3.2, 12.5], [0, 2, 0]);
  const L = jRow('AGLOR'.split(''), { dx: 1.0, x0: -5.6, y: 3.4, sz: 0.78, col: lc });
  const Rr = jRow('HIMST'.split(''), { dx: 1.0, x0: 1.6, y: 3.4, sz: 0.78, col: lc });
  tag('A[p..q]', 'idx', -3.6, 4.3); tag('A[q+1..r]', 'idx', 3.6, 4.3);
  const out = jRow(Array(10).fill(null), { dx: 1.1, y: 0.5, tiles: true });
  tag('輔助 array', 'idx', -6.2, 0.5, 0.7);
  say('左右兩半都已排好', '另開輔助 array 抄下結果');
  await beat(tok, 2600);
  let i = 0, j = 0, k = 0, cmp = 0;
  const pi = tag('i', 'ptr', L.x(0), 4.6), pj = tag('j', 'ptr', Rr.x(0), 4.6);
  say('第一個放誰？兩邊開頭比', '各自最小值都在第一個');
  await beat(tok, 2000);
  while (i < 5 && j < 5) {
    const a = L.v[i], b = Rr.v[j];
    glow(L.m[i], BLUE); glow(Rr.m[j], BLUE); cmp++;
    say(a + ' vs ' + b + ' → ' + (a < b ? a : b) + ' 下來', '比較次數 = ' + cmp);
    await beat(tok, 900);
    glow(L.m[i], null); glow(Rr.m[j], null);
    if (a < b) { move(L.m[i], out.x(k), 0.5, 0); i++; } else { move(Rr.m[j], out.x(k), 0.5, 0); j++; }
    k++;
    pi.position.set(L.x(Math.min(i, 4)), 4.6, 0); pj.position.set(Rr.x(Math.min(j, 4)), 4.6, 0);
    if (i === 5) showL(pi, false); if (j === 5) showL(pj, false);
    await beat(tok, 600);
  }
  say('左邊用完：剩下直接抄', '最後的人不用比');
  while (j < 5) { move(Rr.m[j], out.x(k), 0.5, 0); j++; k++; await beat(tok, 450); }
  while (i < 5) { move(L.m[i], out.x(k), 0.5, 0); i++; k++; await beat(tok, 450); }
  await beat(tok, 1200);
  say('比較 ' + cmp + ' 次 ≤ n₁ + n₂ − 1 = 9', 'MERGE = O(n₁ + n₂) = O(n)');
  await beat(tok, 3200);
}]);

// 10:20 heap sort vs merge sort
FRAG.push(['dcjiang-heap-vs-merge', 'Heap sort vs Merge sort：array 與 linked list', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 2.2, 0]);
  const vals = [26, 5, 37, 1, 61, 11];
  const A = jRow(vals, { dx: 1.3, y: 4.0, tiles: false, idx: true });
  tag('array', 'ptr', -5.9, 4.0);
  say('heap sort、merge sort 都 n log n', '同等級');
  await beat(tok, 2400);
  const ar = arrow(V3(-5.2, 5.6, 0), V3(A.x(4), 4.6, 0), 0x6a4a00);
  glow(A.m[4], GOLD);
  say('heap 用 index 直接抓', 'A[5]：一步拿到');
  await beat(tok, 2400); kill(ar); glow(A.m[4], null);
  const N = vals.map((v, i) => lnode(v, -5.2 + i * 2.0, 1.0, 0));
  for (let i = 0; i < 5; i++) arrow(V3(-5.2 + i * 2.0 + 0.95, 1.0, 0), V3(-5.2 + (i + 1) * 2.0 - 0.55, 1.0, 0));
  tag('linked list', 'ptr', -5.2, 2.0);
  say('linked list：找第 5 個？', '只能從頭一路走');
  const cur = tag('↓', 'ptr alt', -5.2, 1.9);
  for (let i = 0; i < 5; i++) { cur.position.set(-5.2 + i * 2.0, 1.9, 0); glow(N[i].userData.data, BLUE); await beat(tok, 600); glow(N[i].userData.data, null); }
  glow(N[4].userData.data, GOLD);
  say('heap sort 不適合 linked list', '沒辦法直接 index');
  await beat(tok, 2600);
  say('linked list 用 merge sort 很自然', 'running time 一樣 O(n log n)');
  await beat(tok, 2600);
  const g = ghostBox('#d64545', 7.8, 0.8, 1.0); g.position.set(0, 2.9, -1.2);
  tag('MERGE 的輔助 array', 'ptr alt', 0, 2.9, -1.2);
  say('小缺點：多耗 memory', 'MERGE 要額外開一個 array');
  await beat(tok, 3000);
}]);

// 13:46 setting up the recurrence
FRAG.push(['dcjiang-recurrence-setup', '解 recurrence 前：base case、去掉 big-O', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 3, 0]);
  const t1 = tag('T(n) ≤ c,   n ≤ 2', 'ptr', -2.6, 5.6);
  say('先設 boundary condition', 'n = 1、2 都是 constant time');
  await beat(tok, 2600);
  const t2 = tag('T(n) = 2T(n/2) + O(n)', 'ptr', -2.6, 4.6);
  say('big-O 會干擾精確計算', '最後才 apply big-O');
  await beat(tok, 2600);
  txt(t2, 'T(n) ≤ 2T(n/2) + cn');
  say('O(1) ≤ c、O(n) ≤ cn', 'n 夠大時 by definition');
  await beat(tok, 2600);
  const R = jRow([1, 2, 3, 4, 5, 6, 7], { dx: 0.9, y: 2.2, x0: -0.6, sz: 0.7 });
  const t3 = tag('n = 7', 'ptr alt', 2.1, 3.2);
  say('精確寫：floor 與 ceiling', 'T(⌊n/2⌋) + T(⌈n/2⌉)');
  await beat(tok, 1600);
  for (let i = 0; i < 7; i++) move(R.m[i], R.x(i) + (i < 4 ? -0.5 : 0.5), 2.2, 0);
  txt(t3, '⌊7/2⌋ = 3 ｜ ⌈7/2⌉ = 4');
  await beat(tok, 2600);
  say('差異很小：asymptotic 可忽略', '照樣寫 2T(n/2)');
  await beat(tok, 2600);
  tag('main：MERGE-SORT(A, 1, n)', 'ptr', -2.6, 0.8);
  say('外面只呼叫一次：1 到 n', '裡面自己 recursive');
  await beat(tok, 3000);
}]);

// 19:57 two methods
FRAG.push(['dcjiang-two-methods', '兩招：Unrolling 與 Substitution', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 3, 0]);
  tag('① Unrolling = recursion tree', 'ptr', -3.4, 6.0);
  const r = cube('T(n)', '#4b9ee2', [1.3, 0.6, 0.8], -3.4, 5.0, 0);
  say('第一招：展開成一棵樹', '再把每個 node 的成本加起來');
  await beat(tok, 1200);
  relabel(r, 'cn');
  const k1 = [cube('T(n/2)', '#9b7ef4', [1.3, 0.6, 0.8], -4.6, 3.8, 0, 1), cube('T(n/2)', '#9b7ef4', [1.3, 0.6, 0.8], -2.2, 3.8, 0, 1)];
  line(-3.4, 4.7, -4.6, 4.1); line(-3.4, 4.7, -2.2, 4.1);
  await beat(tok, 2200);
  tag('② Substitution', 'ptr', 3.4, 6.0);
  const g = tag('猜：T(n) = O(n log n)', 'ptr alt', 3.4, 5.0);
  say('第二招：先猜答案', '需要一點靈感');
  await beat(tok, 2200);
  const p = tag('再用數學歸納法證明', 'ptr alt', 3.4, 4.2);
  say('n 小成立、n 大也成立', '⇒ 猜對了');
  await beat(tok, 2400);
  const eq = tag('T(n) ≤ … → 先當成 =', 'ptr', 0, 2.6);
  say('要證的是 upper bound（≤）', '算 recursion tree 時換成 =');
  await beat(tok, 2600);
  const nx = (v) => -5 + (v / 64) * 10;
  line(nx(0), 0.8, nx(64), 0.8, 0, '#6e5f49');
  for (const v of [16, 32, 64]) tag(String(v), 'idx', nx(v), 0.35);
  const m = cube('n = 40', '#dd8238', [1.3, 0.55, 0.6], nx(40), 1.3, 0);
  say('假設 n 是 2 的次方', '避免 floor / ceiling 除不盡');
  await beat(tok, 2400);
  move(m, nx(64), 1.3, 0); glow(m, GOLD);
  say('40 多個？放大成 64', '多算一點，不影響結果');
  await beat(tok, 3000);
}]);

// 22:57 recursion tree for 2T(n/2) + cn
FRAG.push(['dcjiang-recursion-tree', 'Recursion tree：每層 cn，log₂n 層', async (tok) => {
  fresh([0, 3.2, 13], [0, 3, 0]);
  const Y = [5.6, 4.2, 2.8, 1.4], W = 9.6, L = [];
  const pos = (d, i) => -0.4 - W / 2 + (i + 0.5) * W / (1 << d);
  const lab0 = ['cn', 'cn/2', 'cn/4', 'cn/8'], tl = ['T(n)', 'T(n/2)', 'T(n/4)', 'T(n/8)'];
  const mk = (d) => { const row = []; for (let i = 0; i < (1 << d); i++) { row.push(cube(tl[d], '#9b7ef4', [d === 3 ? 1.05 : 1.3, 0.55, 0.7], pos(d, i), Y[d], 0, 1)); if (d) line(pos(d - 1, i >> 1), Y[d - 1] - 0.3, pos(d, i), Y[d] + 0.3); } L.push(row); };
  mk(0);
  say('T(n) = 2T(n/2) + cn', '展開成一棵樹');
  await beat(tok, 2200);
  for (let d = 0; d < 3; d++) {
    L[d].forEach((m) => { relabel(m, lab0[d]); tint(m, '#4b9ee2'); });
    mk(d + 1);
    say(d === 0 ? 'root 是 cn，掛兩棵 T(n/2)' : '再展開：' + (1 << (d + 1)) + ' 棵 ' + tl[d + 1], tl[d] + ' = 2' + tl[d + 1] + ' + ' + lab0[d]);
    await beat(tok, 2200);
  }
  L[3].forEach((m) => { relabel(m, 'cn/8'); tint(m, '#4b9ee2'); });
  await beat(tok, 900);
  say('一層一層加總', 'level by level');
  const sums = ['cn', '2 · cn/2 = cn', '4 · cn/4 = cn', '8 · cn/8 = cn'];
  for (let d = 0; d < 4; d++) {
    L[d].forEach((m) => glow(m, GOLD));
    tag(sums[d], 'ptr alt', 5.5, Y[d]);
    await beat(tok, 1100);
    L[d].forEach((m) => glow(m, null));
  }
  tag('⋮', 'idx', -0.4, 0.4);
  tag('log₂n 層', 'ptr', -6.2, 3.5);
  say('n 除以 2 幾次變 1？', 'log₂n 層，每層 cn');
  await beat(tok, 2600);
  say('總和 cn · log₂n', '⇒ O(n log n)');
  await beat(tok, 3000);
}]);

// 29:21 homework: binary search recursion tree
FRAG.push(['dcjiang-bsearch-rtree', '作業：binary search 的 recursion tree', async (tok) => {
  fresh([0, 3.2, 12], [0, 3, 0]);
  const Y = [5.6, 4.4, 3.2, 2.0, 0.6], L = ['T(n)', 'T(n/2)', 'T(n/4)', 'T(n/8)', 'T(1)'];
  say('binary search：只有一個子問題', 'T(n) = T(n/2) + c');
  await beat(tok, 2400);
  const ms = [];
  for (let d = 0; d < 5; d++) {
    if (d === 4) tag('⋮', 'idx', 0, 1.35);
    ms.push(cube(L[d], '#9b7ef4', [1.3, 0.6, 0.8], 0, Y[d], 0, 1));
    if (d && d < 4) line(0, Y[d - 1] - 0.32, 0, Y[d] + 0.32);
    if (d) relabel(ms[d - 1], 'c');
    await beat(tok, 1000);
  }
  relabel(ms[4], 'c');
  say('degenerate：一直只有一個 node', '不會變胖');
  await beat(tok, 2400);
  for (let d = 0; d < 5; d++) { glow(ms[d], GOLD); tag('c', 'ptr alt', 2.4, Y[d]); await beat(tok, 500); }
  tag('log₂n 層', 'ptr', -2.8, 3.2);
  say('每層 c，共 log₂n 層', 'T(n) = c · log₂n = O(log n)');
  await beat(tok, 3200);
}]);

// 30:04 substitution proof
FRAG.push(['dcjiang-substitution', 'Substitution：猜 cn log₂n，再歸納證明', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 3, 0]);
  const P = ['猜：T(n) ≤ c · n · log₂n   (n ≥ 2)', 'Base：T(2) ≤ c ≤ c · 2 · log₂2 ✓', 'Strong：假設所有 m < n 都成立',
    'T(n/2) ≤ c(n/2) · log₂(n/2)', '       = c(n/2)(log₂n − 1)', 'T(n) ≤ 2T(n/2) + cn', '     ≤ cn(log₂n − 1) + cn',
    '     = cn·log₂n − cn + cn', '     = cn·log₂n   ✓'];
  const C = code(P, -1.4, 6.0);
  C.ls.forEach((l) => showL(l, false));
  const steps = [[0, '由 recursion tree 先猜答案', '不用 big-O 直接加減'], [1, 'Base case：直接帶入', 'n = 2 成立'],
    [2, '每次跳兩倍 → strong induction', '小於 n 的都對'], [3, 'n/2 < n：抄下 hypothesis', 'T(n/2) ≤ c(n/2)log₂(n/2)'],
    [4, 'log₂(n/2) = log₂n − 1', '次方少一次'], [5, '代回 recurrence', 'T(n) ≤ 2T(n/2) + cn'],
    [6, '把剛剛的 bound 帶入', ''], [7, '−cn 與 +cn 抵消', ''], [8, '證完：T(n) = O(n log n)', '猜對了']];
  const n = cube('n', '#4b9ee2', [1, 0.6, 0.8], 5.2, 4.6, 0), h1 = cube('n/2', '#9b7ef4', [0.9, 0.55, 0.8], 4.5, 3.2, 0), h2 = cube('n/2', '#9b7ef4', [0.9, 0.55, 0.8], 5.9, 3.2, 0);
  line(5.2, 4.3, 4.5, 3.5); line(5.2, 4.3, 5.9, 3.5);
  for (const [i, a, b] of steps) {
    showL(C.ls[i], true); C.hl(i);
    if (i === 3) { glow(h1, GOLD); glow(h2, GOLD); }
    if (i === 5) { glow(h1, null); glow(h2, null); glow(n, GOLD); }
    say(a, b || P[i].trim());
    await beat(tok, i === 8 ? 3200 : 2300);
  }
}]);

// counting inversion helpers
const INV12 = [1, 5, 4, 8, 10, 2, 6, 9, 12, 11, 3, 7];
const invPairs = (a, i0, i1, j0, j1) => { const p = []; for (let i = i0; i <= i1; i++) for (let j = Math.max(j0, i + 1); j <= j1; j++) if (a[i] > a[j]) p.push([i, j]); return p; };

// 34:46 / 45:24 songs & crossings
FRAG.push(['dcjiang-inv-songs', 'Counting inversion：連線的 crossing', async (tok) => {
  fresh([0, 3, 11.5], [0, 2.4, 0]);
  const you = [2, 4, 1, 3, 5], dx = 2.0, x = (i) => -4 + i * dx;
  tag('我', 'ptr', -6, 4.2); tag('你', 'ptr', -6, 0.8);
  const top = [1, 2, 3, 4, 5].map((v, i) => { tag('ABCDE'[i], 'idx', x(i), 5.1); return cube(v, colorFor(v), [0.8, 0.8, 0.8], x(i), 4.2, 0); });
  say('五首歌，固定我的排名', '1 2 3 4 5');
  await beat(tok, 2400);
  const bot = you.map((v, i) => cube(v, colorFor(v), [0.8, 0.8, 0.8], x(i), 0.8, 0, 2));
  say('你依喜好也排 1～5 名', '你的順序：2 4 1 3 5');
  await beat(tok, 2400);
  const L = {};
  for (let v = 1; v <= 5; v++) { L[v] = line(x(v - 1), 3.75, x(you.indexOf(v)), 1.25, 0, '#a99470'); await beat(tok, 450); }
  say('相同數字連線', '每一個 crossing ＝ 一個 inversion');
  await beat(tok, 2200);
  let c = 0; const ct = tag('inversion = 0', 'ptr alt', 4.6, 2.5);
  for (const [a, b] of [[1, 2], [1, 4], [3, 4]]) {
    L[a].material.color.set('#d64545'); L[b].material.color.set('#d64545');
    glow(top[a - 1], RED); glow(top[b - 1], RED);
    c++; txt(ct, 'inversion = ' + c);
    say('我 ' + a + ' 在 ' + b + ' 前，你相反', '這一對喜好相反');
    await beat(tok, 1800);
    L[a].material.color.set('#a99470'); L[b].material.color.set('#a99470'); glow(top[a - 1], null); glow(top[b - 1], null);
  }
  say('3 個 crossing = 3 個 inversion', '越多 → 喜好越不像');
  await beat(tok, 3000);
}]);

// 39:17 brute force O(n²)
FRAG.push(['dcjiang-inv-brute', 'Brute force：往後找比較小的', async (tok) => {
  fresh([0, 3, 11], [0, 1.4, 0]);
  const R = jRow([2, 4, 1, 3, 5], { dx: 1.6, tiles: true, idx: true });
  const ct = tag('inversion = 0', 'ptr alt', 0, 3.4), cc = tag('比較 0 次', 'idx', 0, 2.8);
  say('看每個數往後有幾個比它小', '我的排名已預設 1…n');
  await beat(tok, 2400);
  let inv = 0, cmp = 0;
  const cur = tag('i', 'ptr', R.x(0), 1.6);
  for (let i = 0; i < 5; i++) {
    cur.position.set(R.x(i), 1.6, 0); glow(R.m[i], GOLD);
    for (let j = i + 1; j < 5; j++) {
      cmp++; txt(cc, '比較 ' + cmp + ' 次');
      const hit = R.v[j] < R.v[i]; glow(R.m[j], hit ? RED : BLUE);
      if (hit) { inv++; txt(ct, 'inversion = ' + inv); say('(' + R.v[i] + ', ' + R.v[j] + ')：inversion', R.v[j] + ' < ' + R.v[i]); }
      else say(R.v[i] + ' 往後看 ' + R.v[j], R.v[j] + ' > ' + R.v[i] + '：沒事');
      await beat(tok, hit ? 1200 : 600); glow(R.m[j], null);
    }
    glow(R.m[i], null);
  }
  say('共 3 個 inversion', '比較 (n−1)+(n−2)+…+1 = ' + cmp);
  await beat(tok, 2400);
  say('brute force = O(n²)', '用 merge sort 想法 → O(n log n)');
  await beat(tok, 3000);
}]);

// 41:23 / 48:06 D&C on 12 songs: 5 + 8 + 9
FRAG.push(['dcjiang-inv-dc', 'D&C：左內部 + 右內部 + 跨組', async (tok) => {
  fresh([0, 3, 12], [0, 1.6, 0]);
  const R = jRow(INV12, { dx: 0.88, sz: 0.7, y: 0.6 });
  const t = tag('你的排名（12 首）', 'ptr', 0, 2.6);
  say('12 首歌，一次算不會', '我的排名：1, 2, …, 12');
  await beat(tok, 2400);
  for (let i = 0; i < 12; i++) move(R.m[i], R.x(i) + (i < 6 ? -0.5 : 0.5), 0.6, 0);
  const cutL = line(0, -0.2, 0, 1.8, 0, '#6e5f49');
  say('Divide：切成前半、後半', '1 5 4 8 10 2 | 6 9 12 11 3 7');
  await beat(tok, 2400);
  const X = (i) => R.x(i) + (i < 6 ? -0.5 : 0.5);
  const tags = [];
  const run = async (pairs, name, x, col) => {
    let c = 0; const tg = tag(name + ' = 0', 'ptr alt', x, 2.0); tags.push(tg);
    for (const [i, j] of pairs) { glow(R.m[i], col); glow(R.m[j], col); c++; txt(tg, name + ' = ' + c); await beat(tok, 420); glow(R.m[i], null); glow(R.m[j], null); }
    return c;
  };
  kill(t);
  say('Conquer：前半內部（intra）', 'recursively 算');
  const a = await run(invPairs(INV12, 0, 5, 0, 5), '左', X(2.5), BLUE);
  say('後半內部', '前半 ' + a + ' 對');
  const b = await run(invPairs(INV12, 6, 11, 6, 11), '右', X(8.5), GREEN);
  say('Combine：還有跨組的沒算', '左一個、右一個');
  await beat(tok, 1200);
  const c = await run(invPairs(INV12, 0, 5, 6, 11), '跨', 0, RED);
  say('三部分相加', a + ' + ' + b + ' + ' + c + ' = ' + (a + b + c));
  tag('total = ' + (a + b + c), 'ptr', 0, 3.0);
  await beat(tok, 2600);
  say('難的是 combine（跨組）', '目標 linear → O(n log n)');
  await beat(tok, 2800);
  kill(cutL);
}]);

// 51:03 counting cross inversions on unsorted halves
FRAG.push(['dcjiang-inv-cross-brute', '跨組 inversion：沒排序就要一個一個比', async (tok) => {
  fresh([0, 3, 12], [0, 1.6, 0]);
  const R = jRow(INV12, { dx: 0.88, sz: 0.7, y: 0.6 });
  const X = (i) => R.x(i) + (i < 6 ? -0.5 : 0.5);
  for (let i = 0; i < 12; i++) move(R.m[i], X(i), 0.6, 0);
  line(0, -0.2, 0, 1.8, 0, '#6e5f49');
  say('切完後前半順序不整齊', '就是 input 的順序');
  await beat(tok, 2400);
  move(R.m[6], X(6), 2.4, 0); glow(R.m[6], GOLD);
  say('拿 6：前半誰比 6 大？', '沒排序 → 每個都要比');
  await beat(tok, 2000);
  const cur = tag('↓', 'ptr', X(0), 1.6); let c = 0;
  const ct = tag('6 的跨組 = 0', 'ptr alt', 3.2, 3.2);
  for (let i = 0; i < 6; i++) {
    cur.position.set(X(i), 1.6, 0);
    const hit = INV12[i] > 6; glow(R.m[i], hit ? RED : BLUE);
    if (hit) { c++; txt(ct, '6 的跨組 = ' + c); }
    say(INV12[i] + (hit ? ' > 6：inversion' : ' < 6：跳過'), '比較 ' + (i + 1) + ' 次');
    await beat(tok, hit ? 1300 : 750);
    if (!hit) glow(R.m[i], null);
  }
  say('8 和 10 比 6 大 → 2 個', '(8, 6)、(10, 6)');
  await beat(tok, 2400);
  say('右邊每個人都要掃一遍', '(n/2)·(n/2) = O(n²)，太慢');
  await beat(tok, 3000);
}]);

// 54:34 merge-and-count on sorted halves
FRAG.push(['dcjiang-merge-count', 'Merge-and-Count：排好序後一次掃過', async (tok) => {
  fresh([0, 3.2, 12.5], [0, 2, 0]);
  const Lv = [1, 2, 4, 5, 8, 10], Rv = [3, 6, 7, 9, 11, 12];
  const L = jRow(Lv, { dx: 0.92, x0: -5.7, y: 3.4, sz: 0.72 }), Rr = jRow(Rv, { dx: 0.92, x0: 1.1, y: 3.4, sz: 0.72 });
  const out = jRow(Array(12).fill(null), { dx: 0.92, y: 0.5, tiles: true });
  say('內部算完順便由小排到大', '前半 1 2 4 5 8 10｜後半 3 6 7 9 11 12');
  await beat(tok, 2800);
  let i = 0, j = 0, k = 0, inv = 0;
  const pi = tag('i', 'ptr', L.x(0), 4.5), pj = tag('j', 'ptr', Rr.x(0), 4.5);
  const ct = tag('跨組 inversion = 0', 'ptr alt', 0, 5.4);
  while (i < 6 && j < 6) {
    glow(L.m[i], BLUE); glow(Rr.m[j], BLUE);
    await beat(tok, 500);
    glow(L.m[i], null); glow(Rr.m[j], null);
    if (Lv[i] < Rv[j]) {
      say(Lv[i] + ' < ' + Rv[j] + '：跳過，下來', 'index i 只往前走');
      move(L.m[i], out.x(k), 0.5, 0); i++;
    } else {
      const rem = 6 - i; for (let t = i; t < 6; t++) glow(L.m[t], RED);
      inv += rem; txt(ct, '跨組 inversion = ' + inv);
      say(Rv[j] + ' 下來：前半剩 ' + rem + ' 個比它大', 'inv += ' + rem);
      await beat(tok, 1200);
      for (let t = i; t < 6; t++) glow(L.m[t], null);
      move(Rr.m[j], out.x(k), 0.5, 0); j++;
    }
    k++;
    pi.position.set(L.x(Math.min(i, 5)), 4.5, 0); pj.position.set(Rr.x(Math.min(j, 5)), 4.5, 0);
    if (i === 6) showL(pi, false);
    await beat(tok, 750);
  }
  say('前半用完：剩下直接抄', '不再產生 inversion');
  while (j < 6) { move(Rr.m[j], out.x(k), 0.5, 0); j++; k++; await beat(tok, 400); }
  await beat(tok, 900);
  say('4 + 2 + 2 + 1 = 9，同時也 merge 好', 'index 只掃一遍 → combine O(n)');
  await beat(tok, 3200);
}]);

// 59:55 Sort-and-Count
FRAG.push(['dcjiang-sort-count-code', 'Sort-and-Count 程式', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 3, 0]);
  const C = code(['Sort-and-Count(L)', '1  if |L| = 1: return (0, L)', '2  m = ⌊(p + q)/2⌋：切成 A、B', '3  (rA, A) = Sort-and-Count(A)',
    '4  (rB, B) = Sort-and-Count(B)', '5  (r, L) = Merge-and-Count(A, B)', '6  return (rA + rB + r, L)'], -1.8, 5.8);
  const steps = [[0, '跟 merge sort 幾乎一樣', '多 return 一個 inversion 數'], [1, '只有一個：沒有 inversion', 'p = q → return 0'],
    [2, '中間切一刀（取 floor）', 'A = 1 5 4 8 10 2｜B = 6 9 12 11 3 7'], [3, '左半 recursive', 'rA = 5，A 排好'],
    [4, '右半 recursive', 'rB = 8，B 排好'], [5, 'merge + 算跨組', 'r = 9（跟 MERGE 幾乎一模一樣）'], [6, '三部分相加', '5 + 8 + 9 = 22']];
  const side = { 3: 'rA = 5', 4: 'rB = 8', 5: 'r = 9', 6: 'total = 22' };
  for (const [i, a, b] of steps) {
    C.hl(i); say(a, b);
    if (side[i]) tag(side[i], i === 6 ? 'ptr' : 'ptr alt', 5.0, 5.8 - i * 0.56);
    await beat(tok, 2500);
  }
  C.hl(-1);
  say('T(n) = 2T(n/2) + O(n)', '⇒ O(n log n)');
  await beat(tok, 3000);
}]);

// closest pair helpers (top-down view on the floor; world = units × 0.2, y-up → −z)
const CPL = [[-16, 10], [-16, -2], [-4, 0], [-26, -16], [-10, 22], [-8, -20]];
const CPR = [[4, 0], [26, 8], [26, -13], [8, -24], [6, 22]];
const W2 = (p) => [p[0] * 0.2, -p[1] * 0.2];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function cpPoints(list, color) { return list.map((p) => { const [x, z] = W2(p); return cube(null, color, [0.36, 0.36, 0.36], x, 0.2, z); }); }
function cpSeg(a, b, color) { const [x1, z1] = W2(a), [x2, z2] = W2(b); return seg(V3(x1, 0.2, z1), V3(x2, 0.2, z2), color); }

// 63:20 the problem, distances, brute force
FRAG.push(['dcjiang-cp-intro', 'Closest pair：Euclidean 距離、暴力 n²', async (tok) => {
  fresh([0, 10, 6.5], [0, 0, 0.6]);
  const P = [[-5, -2], [-3.5, 2.5], [-2, -3.2], [-1, 0.8], [0.5, 3], [1.2, -1.5], [2.6, 1.0], [3.4, -3.4], [4.8, 2.2], [5.5, -0.6]];
  const M = P.map(([x, z]) => cube(null, '#4b9ee2', [0.36, 0.36, 0.36], x, 0.2, z, 1.5));
  say('平面上撒 n 個點', '找最近的兩個點');
  await beat(tok, 2400);
  const a = P[3], b = P[6];
  glow(M[3], GOLD); glow(M[6], GOLD);
  const e = seg(V3(a[0], 0.2, a[1]), V3(b[0], 0.2, b[1]), '#d64545');
  const et = tag('√(Δx² + Δy²)', 'ptr alt', (a[0] + b[0]) / 2, 0.9, (a[1] + b[1]) / 2 - 0.4);
  say('Euclidean distance：直線距離', 'd = √((x₁−x₂)² + (y₁−y₂)²)');
  await beat(tok, 2800);
  const m1 = seg(V3(a[0], 0.2, a[1]), V3(b[0], 0.2, a[1]), '#1f3a6e'), m2 = seg(V3(b[0], 0.2, a[1]), V3(b[0], 0.2, b[1]), '#1f3a6e');
  const mt = tag('|Δx| + |Δy|', 'ptr', b[0] + 0.9, 0.9, a[1] + 0.3);
  say('Manhattan（rectilinear）：直角', '用在 IC design 繞線；這裡不用');
  await beat(tok, 2800);
  [e, et, m1, m2, mt].forEach(kill); glow(M[3], null); glow(M[6], null);
  say('Brute force：所有 pair 都算', 'n(n−1)/2 = 45 對');
  let best = [0, 1, Infinity], c = 0; const ct = tag('0 對', 'ptr alt', 0, 1.2, -4.4);
  const segs = [];
  for (let i = 0; i < P.length; i++) {
    for (let j = i + 1; j < P.length; j++) { segs.push(seg(V3(P[i][0], 0.15, P[i][1]), V3(P[j][0], 0.15, P[j][1]), '#a99470')); c++; const d = Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]); if (d < best[2]) best = [i, j, d]; }
    txt(ct, c + ' 對'); await beat(tok, 350);
  }
  await beat(tok, 800);
  segs.forEach(kill);
  glow(M[best[0]], RED); glow(M[best[1]], RED);
  seg(V3(P[best[0]][0], 0.2, P[best[0]][1]), V3(P[best[1]][0], 0.2, P[best[1]][1]), '#d64545');
  say('暴力 O(n²)', '目標：D&C 降到 O(n log n)');
  await beat(tok, 3000);
}]);

// 66:28 1D
FRAG.push(['dcjiang-cp-1d', '1D：排序後只看相鄰', async (tok) => {
  fresh([0, 3.2, 11.5], [0, 1.4, 0]);
  const V = [10, 1, 14, 5, 12, 0, 7], px = (v) => -5.6 + v * 0.8;
  line(-6.2, 0.2, 6.2, 0.2, 0, '#6e5f49');
  for (let v = 0; v <= 14; v += 2) tag(String(v), 'idx', px(v), -0.3);
  const R = jRow(V, { dx: 1.1, y: 3.6, sz: 0.65 });
  say('點都落在一條軸上', '輸入順序：10 1 14 5 12 0 7');
  await beat(tok, 2400);
  say('先由小排到大', 'sorting：O(n log n)');
  for (let i = 0; i < V.length; i++) move(R.m[i], px(V[i]), 0.55, 0);
  await beat(tok, 2200);
  const S = V.map((v, i) => [v, R.m[i]]).sort((a, b) => a[0] - b[0]);
  say('最近的點一定在左右相鄰', '更遠的不用算');
  await beat(tok, 2000);
  let best = Infinity, bi = 0; const gaps = [];
  for (let i = 0; i + 1 < S.length; i++) {
    const d = S[i + 1][0] - S[i][0]; glow(S[i][1], BLUE); glow(S[i + 1][1], BLUE);
    gaps.push(tag(String(d), 'ptr alt', (px(S[i][0]) + px(S[i + 1][0])) / 2, 1.5));
    say('相鄰距離 = ' + d, 'min = ' + Math.min(best, d));
    if (d < best) { best = d; bi = i; }
    await beat(tok, 800); glow(S[i][1], null); glow(S[i + 1][1], null);
  }
  glow(S[bi][1], RED); glow(S[bi + 1][1], RED);
  say('掃一次 O(n) 就找到', '但先排序要 O(n log n)');
  await beat(tok, 3000);
}]);

// 67:43 2D divide: 12, 21, 8
FRAG.push(['dcjiang-cp-split', '2D：切兩半，12、21、8 取最小', async (tok) => {
  fresh([0, 10.5, 5], [0, 0, 0.4]);
  const Lm = cpPoints(CPL, '#4b9ee2'), Rm = cpPoints(CPR, '#2fc092');
  say('平面上的點，x 座標都不同', '假設：方便分析');
  await beat(tok, 2400);
  const xs = W2([-4, 0])[0];
  bar(xs, -5.4, xs, 5.4, '#6e5f49', 0.07);
  tag('L', 'ptr', xs, 0.8, -5.6);
  say('一刀切：左右各約 n/2 個點', 'L 通過左半最右邊的點');
  await beat(tok, 2600);
  say('遞迴：左半最近的兩點', 'd = ' + dist(CPL[0], CPL[1]));
  [0, 1].forEach((i) => glow(Lm[i], GOLD)); cpSeg(CPL[0], CPL[1], '#c08a1f');
  const [a1, b1] = W2([-16, 4]); tag('12', 'ptr alt', a1 - 0.5, 0.8, b1);
  await beat(tok, 2400);
  say('遞迴：右半最近的兩點', 'd = ' + dist(CPR[1], CPR[2]));
  [1, 2].forEach((i) => glow(Rm[i], GOLD)); cpSeg(CPR[1], CPR[2], '#c08a1f');
  const [a2, b2] = W2([26, -2.5]); tag('21', 'ptr alt', a2 + 0.5, 0.8, b2);
  await beat(tok, 2400);
  say('中線兩側也可能更近', '一點在左、一點在右');
  glow(Lm[2], RED); glow(Rm[0], RED); cpSeg(CPL[2], CPR[0], '#d64545');
  tag('8', 'ptr', 0, 0.8, 0.6);
  await beat(tok, 2600);
  say('三個候選取最小', 'min(12, 21, 8) = 8');
  await beat(tok, 2600);
  say('難的仍是 combine', '跨中線那一對怎麼快速找？');
  await beat(tok, 2800);
}]);

// 72:04 strip of width 2δ
FRAG.push(['dcjiang-cp-strip', 'Combine：只看中線左右 δ 的帶子', async (tok) => {
  fresh([0, 10.5, 5], [0, 0, 0.4]);
  const Lm = cpPoints(CPL, '#4b9ee2'), Rm = cpPoints(CPR, '#2fc092');
  const xs = W2([-4, 0])[0];
  bar(xs, -5.4, xs, 5.4, '#6e5f49', 0.07);
  tag('x = x*', 'ptr', xs, 0.8, -5.6);
  say('同側的 pair 已經算過', '只找一點在左、一點在右');
  await beat(tok, 2600);
  cpSeg(CPL[0], CPL[1], '#c08a1f'); cpSeg(CPR[1], CPR[2], '#c08a1f');
  say('δ = min(左最近, 右最近)', 'δ = min(12, 21) = 12');
  await beat(tok, 2600);
  const d = 12 * 0.2;
  const g = ghostBox('#e5c23a', 2 * d, 0.3, 10.8); g.position.set(xs, 0.12, 0);
  tag('x* − δ', 'idx', xs - d, 0.6, 5.6); tag('x* + δ', 'idx', xs + d, 0.6, 5.6);
  say('只看帶子：x* ± δ', '帶子外的點不可能更近');
  CPL.forEach((p, i) => { if (Math.abs(p[0] + 4) > 12) tint(Lm[i], DIM); });
  CPR.forEach((p, i) => { if (Math.abs(p[0] + 4) > 12) tint(Rm[i], DIM); });
  await beat(tok, 2800);
  glow(Lm[2], GOLD); glow(Rm[0], GOLD);
  tag('q', 'ptr alt', W2(CPL[2])[0] - 0.4, 0.8, 0.5); tag('r', 'ptr alt', W2(CPR[0])[0] + 0.4, 0.8, 0.5);
  say('q 在左、r 在右', 'q_x ≤ x* ≤ r_x');
  await beat(tok, 2600);
  say('若 d(q, r) < δ', 'x* − q_x ≤ r_x − q_x ≤ d(q, r) < δ');
  await beat(tok, 3000);
  say('r 那側同理', 'r_x − x* < δ ⇒ 都落在帶子裡');
  await beat(tok, 3000);
}]);

// 80:24 δ/2 boxes, 15 neighbours
FRAG.push(['dcjiang-cp-boxes', 'δ/2 小格子：每點只比後面 15 個', async (tok) => {
  fresh([0, 10.5, 5.5], [0, 0, 0.6]);
  const s = 1.2, z0 = -2.4; // δ = 2.4
  for (let c = 0; c <= 4; c++) bar(-2.4 + c * s, z0 - 1.2, -2.4 + c * s, z0 + 6 * s, c === 2 ? '#6e5f49' : '#a99470', c === 2 ? 0.08 : 0.04);
  for (let r = -1; r <= 6; r++) bar(-2.4, z0 + r * s, 2.4, z0 + r * s, '#a99470', 0.04);
  tag('L', 'ptr', 0, 0.8, z0 - 1.6); tag('δ', 'idx', -1.2, 0.5, z0 - 1.4); tag('δ', 'idx', 1.2, 0.5, z0 - 1.4);
  const pts = [[-2.0, z0 + 0.3], [0.5, z0 + 0.9], [-0.6, z0 + 1.7], [1.9, z0 + 2.6], [-1.6, z0 + 3.1], [0.7, z0 + 4.1]];
  const M = pts.map(([x, z], i) => { const m = cube(null, x < 0 ? '#4b9ee2' : '#2fc092', [0.32, 0.32, 0.32], x, 0.2, z, 1.2); tag(String(i + 1), 'idx', x + 0.3, 0.6, z); return m; });
  say('帶子內的點依 y 排序', '由上到下編號 1、2、3…');
  await beat(tok, 2800);
  say('切成 δ/2 × δ/2 的小格子', '帶子寬 2δ → 每列 4 格');
  await beat(tok, 2400);
  const fake = cube(null, '#d64545', [0.32, 0.32, 0.32], -1.3, 0.2, z0 + 0.9, 1.2);
  const fs = seg(V3(-2.0, 0.2, z0 + 0.3), V3(-1.3, 0.2, z0 + 0.9), '#d64545');
  say('同一格兩點：同側且距離 < δ', '≤ δ/√2 < δ：與 δ 的定義矛盾');
  await beat(tok, 3000);
  kill(fs); fly(fake, V3(-3, 6, -2));
  say('所以每格最多一個點', '');
  await beat(tok, 1800);
  glow(M[0], GOLD);
  const gs = [];
  for (let k = 1; k < 16; k++) { const r = Math.floor(k / 4), c = k % 4; const g = ghostBox('#c08a1f', s * 0.94, 0.2, s * 0.94); g.position.set(-2.4 + (c + 0.5) * s, 0.1, z0 + (r + 0.5) * s); gs.push(g); await beat(tok, 110); }
  say('點 1 只要比後面 15 格', '最多 15 個點');
  await beat(tok, 2600);
  const far = cube(null, '#9b7ef4', [0.32, 0.32, 0.32], -1.8, 0.2, z0 + 5.1, 1.2);
  const fs2 = seg(V3(-2.0, 0.2, z0 + 0.3), V3(-1.8, 0.2, z0 + 5.1), '#9b7ef4');
  say('再往下：y 差至少 3·δ/2', '3δ/2 > δ → 不可能是答案');
  await beat(tok, 3000);
  say('15 是 loose bound，仍是常數', '每點比 15 次 → combine O(n)');
  await beat(tok, 3000);
}]);

// 88:57 the procedure and its running time
FRAG.push(['dcjiang-cp-code', 'Closest-Pair 程式與 O(n log n)', async (tok) => {
  fresh([0, 3.6, 13], [0, 3.6, 0]);
  const C = code(['Closest-Pair(P)', '   Px, Py = 依 x、依 y 排序', '   (p0, p1) = CP-Rec(Px, Py)', 'CP-Rec(Px, Py)', ' 1  if |P| ≤ 3：兩兩比', ' 2  x* = 中位數；分成 Q、R',
    ' 3  得到 Qx, Qy, Rx, Ry', ' 4  (q0, q1) = CP-Rec(Qx, Qy)', ' 5  (r0, r1) = CP-Rec(Rx, Ry)', ' 6  δ = min(d(q0,q1), d(r0,r1))', ' 7  S = 離 x* 不超過 δ 的點',
    ' 8  Sy = S 依 y 排序', ' 9-11  每點比後面 15 個 → (s,s′)', '12-14  三對取最近的 return'], -1.6, 7.0, 0.5);
  const steps = [[1, '先依 x、依 y 各排一次', 'O(n log n)', 'O(n log n)'], [4, 'base：≤ 3 個點直接比', '最多比 3 次', 'O(1)'], [5, 'divide：依 x* 切成 Q、R', '左右各 n/2', ''],
    [7, 'conquer：左半遞迴', 'T(n/2)', 'T(n/2)'], [8, 'conquer：右半遞迴', 'T(n/2)', 'T(n/2)'], [9, 'combine 準備：δ', '左右最近取較小', ''], [10, '開出黃色帶子 S', 'x* − δ ≤ x ≤ x* + δ', 'O(n)'],
    [11, 'S 依 y 由上往下排', '從已排好的 Py 篩出 → O(n)', 'O(n)'], [12, '每點只比後面 15 個', '15 是常數 → O(n)', 'O(n)'], [13, '三對比大小', 'q 對、r 對、s 對', 'O(1)']];
  for (const [i, a, b, c] of steps) {
    C.hl(i); say(a, b);
    if (c) tag(c, 'ptr alt', 5.6, 7.0 - i * 0.5);
    await beat(tok, 2100);
  }
  C.hl(-1);
  say('T(n) = 2T(n/2) + O(n)', '跟 merge sort 同一個 template');
  await beat(tok, 2600);
  say('排序 n log n + D&C n log n', '總共 O(n log n)');
  await beat(tok, 3000);
}]);
  }

  // ═══ dcmit.js ═══
  {
// ─── MIT 6.006：Kg4bqzAqRBM（L3 Insertion Sort, Merge Sort）、4iXLnF3hExw（Rec3 Document Distance）、eCaXlAaN2uE（L11 Integer Arithmetic, Karatsuba） ───
// 只用 K 與 ctx。老師的例子：L3 insertion sort 5 2 4 6 1 3（交換 1、1、0、4、3 次）、merge 的 L′ = 2 7 13 20、R′ = 1 9 11 12，
// recursion tree 三種 f(n)（cn、cn²、c），Python merge 2.2 n lg n μs / C insertion 0.01 n² μs；Rec3 count_frequency、
// + → extend（K 字 × Z 行）、兩串列 1…10,000；L11 Catalan（λ、(α)β、C₂ = C₀C₁ + C₁C₀）、Newton x₀ = 1、x = x₁·r^(n/2) + x₀、
// Karatsuba z₁ = (x₀ + x₁)(y₀ + y₁) − z₀ − z₂、半徑 5×10¹¹ 的大圓 demo。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, anim, line, arrow, GOLD, GREEN, RED, GRAY } = K;
const say = ctx.say, beat = ctx.beat;
const DB = '#4b9ee2', DP = '#9b7ef4', DG = '#2fc092', DO = '#dd8238', DY = '#c08a1f', DR = '#d64545', PAPER = '#efe3c8', MINT = '#d4e8da', INK = '#3a3328';
const dBox = (t, x, y, z = 0, w = 2.6, c = PAPER, drop = 0) => cube(t, c, [w, 0.6, 0.8], x, y, z, drop);
// swap two static cubes along arcs (a ends at xb, b ends at xa)
async function dSwap(tok, a, xa, b, xb, y, z, ms = 600) {
  await anim(tok, ms, (t) => {
    a.position.set(xa + (xb - xa) * t, y + Math.sin(Math.PI * t) * 0.9, z);
    b.position.set(xb + (xa - xb) * t, y, z + Math.sin(Math.PI * t) * 0.9);
  });
}
// a growing bar (static cube scaled in y)
function dBar(color, x, z, w = 0.6) { const m = cube('', color, [w, 1, w], x, 0.001, z); m.scale.y = 0.002; return m; }
const dSetBar = (m, h) => { const v = Math.max(0.002, h); m.scale.y = v; m.position.y = v / 2; };

// ═════════════ L3：Kg4bqzAqRBM ═════════════

// 01:24 為什麼排序：中位數 B[n/2]、binary search
FRAG.push(['dcmit-why-sort', '排好序後：中位數與 binary search', async (tok) => {
  fresh([0, 6.2, 12.5], [0, 1.4, 0]);
  const A = [5, 2, 4, 6, 1, 3], B = [1, 2, 3, 4, 5, 6], X = (i) => -3.25 + i * 1.3;
  tag('A', 'ptr', -5.2, 0.4, -1.8);
  const ms = A.map((v, i) => cube(v, DB, [0.9, 0.7, 0.9], X(i), 0.35, -1.8));
  say('A：n 個未排序的數', '只要有比較函數 ≤ 就能排序');
  await beat(tok, 2800);
  tag('B', 'ptr alt', -5.2, 0.4, 1.8);
  B.forEach((_, i) => tag(String(i), 'idx', X(i), 0.02, 2.65));
  ms.forEach((m, i) => move(m, X(B.indexOf(A[i])), 0.35, 1.8));
  say('排序：A 變成遞增的 B', 'B[0] ≤ B[1] ≤ … ≤ B[n−1]');
  await beat(tok, 2800);
  const byV = (v) => ms[A.indexOf(v)];
  glow(byV(4), GOLD);
  const med = tag('B[n/2] = 4', 'ptr alt', X(3), 1.6, 1.8);
  say('中位數：直接看 B[n/2]', '排好之後 Θ(1)（n 奇偶略有差別）');
  await beat(tok, 3000);
  glow(byV(4), null); kill(med);
  tag('找 k = 5', 'ptr', 5.2, 1.6, 1.8);
  const mid = tag('mid', 'ptr alt', X(3), 1.3, 1.8);
  say('Binary search：k 先和 B[n/2] 比', 'B[3] = 4 < 5 → 只看右半');
  glow(byV(4), GOLD); await beat(tok, 2200);
  [1, 2, 3, 4].forEach((v) => tint(byV(v), GRAY)); glow(byV(4), null);
  move(mid, X(5), 1.3, 1.8); glow(byV(6), GOLD);
  say('B[5] = 6 > 5 → 只看左半', '每次丟掉一半');
  await beat(tok, 2000);
  tint(byV(6), GRAY); glow(byV(6), null);
  move(mid, X(4), 1.3, 1.8); glow(byV(5), GREEN);
  say('B[4] = 5：找到了', '線性掃描 Θ(n) → binary search Θ(log n)');
  await beat(tok, 3200);
}]);

// 07:10 沒那麼明顯的應用：壓縮（排序找重複）、繪圖（前→後 / 後→前）
FRAG.push(['dcmit-sort-apps', '排序的應用：壓縮與繪圖', async (tok) => {
  fresh([0, 6, 13], [0, 1.8, 0]);
  const items = ['a', 'c', 'a', 'b', 'a', 'c'], col = { a: DB, b: DO, c: DP }, X = (i) => -5.6 + i * 0.95;
  const ms = items.map((v, i) => cube(v, col[v], [0.75, 0.6, 0.75], X(i), 0.3, -1.2, 2));
  say('壓縮：先把 item 排序', '排好後重複的 item 會排在一起');
  await beat(tok, 2900);
  const order = [0, 2, 4, 3, 1, 5];
  order.forEach((k, p) => move(ms[k], X(p), 0.3, -1.2));
  await beat(tok, 1600);
  const out = [['a × 3', DB, 0], ['b × 1', DO, 3], ['c × 2', DP, 4]];
  out.forEach(([t, c, p]) => cube(t, c, [1.3, 0.5, 0.8], X(p) + 0.5, 0.25, 1, 1.5));
  say('存一次 item ＋ 出現次數', '和 document distance 的 (字, 次數) 一樣');
  await beat(tok, 3600);
  const L = [[DR, 'opaque'], [DG, 'layer 2'], [DB, 'layer 3']];
  const ls = L.map(([c, t], q) => cube(t, c, [1.6, 1.4, 0.15], 3.8, 1.2, -1.6 + q * 1.4));
  tag('鏡頭', 'ptr', 3.8, 1.2, 3.2);
  say('繪圖：多數時候由前往後 render', '前面不透明的擋住後面，省工');
  for (let q = 0; q < 3; q++) { glow(ls[2 - q], GOLD); await beat(tok, 700); glow(ls[2 - q], null); }
  say('有透明物件時要由後往前', '兩種順序的已排序串列都要維護');
  for (let q = 0; q < 3; q++) { glow(ls[q], GOLD); await beat(tok, 700); glow(ls[q], null); }
  await beat(tok, 2900);
}]);

// 09:55 Insertion sort：5 2 4 6 1 3，pairwise swaps
FRAG.push(['dcmit-insertion-524613', 'Insertion sort：5 2 4 6 1 3', async (tok) => {
  fresh([0, 5.6, 11.5], [0, 1.2, 0]);
  const a = [5, 2, 4, 6, 1, 3], X = (i) => -3.25 + i * 1.3, Y = 0.4;
  const ms = a.map((v, i) => cube(v, DB, [0.9, 0.8, 0.9], X(i), Y, 0));
  a.forEach((_, i) => tag(String(i), 'idx', X(i), 0.02, 0.9));
  const keyT = tag('key', 'ptr alt', X(1), 1.6, 0);
  const cnt = tag('swap 0 次', 'ptr', 5, 3, 0);
  say('for i = 1 … n−1：把 A[i] 插到對的位置', 'A[0..i−1] 已排好；用相鄰交換往左移');
  await beat(tok, 3000);
  let sw = 0;
  for (let i = 1; i < a.length; i++) {
    move(keyT, X(i), 1.6, 0); glow(ms[i], GOLD);
    say('key = ' + a[i], 'A[0..' + (i - 1) + '] = ' + a.slice(0, i).join(' '));
    await beat(tok, 1300);
    let j = i, s = 0;
    while (j > 0 && a[j - 1] > a[j]) {
      await dSwap(tok, ms[j], X(j), ms[j - 1], X(j - 1), Y, 0, 520);
      [a[j - 1], a[j]] = [a[j], a[j - 1]]; [ms[j - 1], ms[j]] = [ms[j], ms[j - 1]];
      s++; sw++; txt(cnt, 'swap ' + sw + ' 次'); j--;
    }
    glow(ms[j], null);
    if (s === 0) say(a[i] + ' > ' + a[i - 1] + '：不用換', a.join(' '));
    else say(a[j] + ' 交換 ' + s + ' 次', a.join(' '));
    await beat(tok, 1500);
  }
  ms.forEach((m) => tint(m, DG));
  say('排好了：共 9 次交換', '1 要換 4 次：搬到正確位置的代價逃不掉');
  await beat(tok, 3000);
}]);

// 16:21 分析：Θ(n) 個 key 位置 × 每步 Θ(n) → Θ(n²)
FRAG.push(['dcmit-insertion-cost', 'Insertion sort 的成本 Θ(n²)', async (tok) => {
  fresh([0, 5.8, 12.5], [0, 2.2, 0]);
  const a = [6, 5, 4, 3, 2, 1], X = (i) => -5.4 + i * 0.85;
  a.forEach((v, i) => cube(v, DB, [0.7, 0.6, 0.7], X(i), 0.3, -2));
  say('最壞：反序 6 5 4 3 2 1', 'key 走過 n − 1 個位置 = Θ(n) 步');
  await beat(tok, 2800);
  const tot = tag('累計 0', 'ptr alt', 3.6, 5.6, 0);
  let s = 0;
  for (let i = 1; i < 6; i++) {
    for (let k = 0; k < i; k++) cube('', DO, [0.7, 0.42, 0.7], -1 + (i - 1) * 1.05, 0.21 + k * 0.45, 0.6, 1.2);
    s += i; txt(tot, '累計 ' + s);
    tag('i=' + i, 'idx', -1 + (i - 1) * 1.05, 0.02, 1.4);
    say('key 在第 ' + i + ' 格：要換 ' + i + ' 次', '每一步最多 Θ(n) 次比較＋交換');
    await beat(tok, 1100);
  }
  say('1 + 2 + … + (n−1) = n(n−1)/2', 'Θ(n) 步 × 每步 Θ(n) = Θ(n²)');
  await beat(tok, 3200);
  const c1 = dBox('compare', -3, 5, 0, 2, MINT), c2 = dBox('swap', -0.6, 5, 0, 2, MINT);
  say('數字：compare 與 swap 一樣便宜', '各一個指令（x86、MIPS）');
  await beat(tok, 2800);
  tint(c1, DR); glow(c1, RED);
  say('記錄：比較可能是一個函數呼叫', 'swap 只換指標 → 比較貴得多');
  await beat(tok, 3000);
}]);

// 19:58 Binary insertion sort：比較 Θ(n log n)，交換仍 Θ(n²)
FRAG.push(['dcmit-binary-insertion', 'Binary insertion sort', async (tok) => {
  fresh([0, 5.6, 11.5], [0, 1.2, 0]);
  const X = (i) => -3.25 + i * 1.3, Y = 0.4;
  const a = [2, 4, 5, 6, 1, 3];
  const ms = a.map((v, i) => cube(v, i < 4 ? DG : DB, [0.9, 0.8, 0.9], X(i), Y, 0));
  tag('已排好 A[0..i−1]', 'idx', X(1.5), 0.02, 1);
  const keyT = tag('key', 'ptr alt', X(4), 1.6, 0);
  const cc = tag('比較 0 次', 'ptr', -5.4, 3, 0), sc = tag('搬移 0 次', 'ptr', 5, 3, 0);
  say('比較比交換貴：改用 binary search', '在已排好的 A[0..i−1] 裡找位置');
  await beat(tok, 3600);
  glow(ms[4], GOLD);
  const steps = [[2, '1 < 5 → 往左'], [1, '1 < 4 → 往左'], [0, '1 < 2 → 位置 0']];
  const mid = tag('mid', 'ptr', X(2), 1.6, 0);
  for (let q = 0; q < 3; q++) {
    const [m, t] = steps[q];
    move(mid, X(m), 1.6, 0); glow(ms[m], GOLD);
    txt(cc, '比較 ' + (q + 1) + ' 次');
    say(t, 'Θ(log i) 次比較');
    await beat(tok, 1300); glow(ms[m], null);
  }
  kill(mid);
  say('但陣列要把 4 個元素往右挪', '插到中間 → 最壞 Θ(n) 次搬移');
  await anim(tok, 400, (t) => { ms[4].position.set(X(4), Y + 1.2 * t, 0.9 * t); });
  for (let k = 3; k >= 0; k--) {
    move(ms[k], X(k + 1), Y, 0); txt(sc, '搬移 ' + (4 - k) + ' 次');
    await beat(tok, 500);
  }
  move(ms[4], X(0), Y, 0); move(keyT, X(0), 1.6, 0); glow(ms[4], null);
  await beat(tok, 1600);
  say('比較：Θ(n log n)', '交換／搬移：仍是 Θ(n²)');
  await beat(tok, 3800);
}]);

// 24:31 Merge sort：A → L、R → L′、R′ → merge 成 A
FRAG.push(['dcmit-mergesort-split', 'Merge sort：切兩半、遞迴、merge', async (tok) => {
  fresh([0, 4.6, 13], [0, 3, 0]);
  const A = [20, 13, 7, 2, 12, 11, 9, 1], Lp = [2, 7, 13, 20], Rp = [1, 9, 11, 12];
  const X = (i, gap = 0) => -3.5 + i * 0.95 + (i >= 4 ? gap : -gap);
  tag('A（大小 n）', 'ptr', -6, 5.8, 0);
  A.forEach((v, i) => cube(v, DB, [0.8, 0.55, 0.8], X(i), 5.8, 0, 1.5));
  say('Merge sort：和 binary search 一樣是遞迴', '陣列 A 切成兩半 L、R');
  await beat(tok, 3100);
  A.forEach((v, i) => cube(v, i < 4 ? DP : DO, [0.8, 0.55, 0.8], X(i, 0.9), 4.2, 0, 1));
  tag('L', 'ptr', X(1.5, 0.9), 4.95, 0); tag('R', 'ptr', X(5.5, 0.9), 4.95, 0);
  say('切開幾乎不用做事', '兩個大小 n/2 的子問題');
  await beat(tok, 3100);
  say('遞迴：L → L′、R → R′', '程式裡看不到「排序」，工作都在 merge');
  Lp.forEach((v, i) => cube(v, DG, [0.8, 0.55, 0.8], X(i, 0.9), 2.6, 0, 1));
  Rp.forEach((v, i) => cube(v, DG, [0.8, 0.55, 0.8], X(i + 4, 0.9), 2.6, 0, 1));
  tag("L′", 'ptr alt', X(1.5, 0.9), 3.35, 0); tag("R′", 'ptr alt', X(5.5, 0.9), 3.35, 0);
  await beat(tok, 3600);
  const S = [1, 2, 7, 9, 11, 12, 13, 20];
  S.forEach((v, i) => cube(v, DY, [0.8, 0.55, 0.8], X(i), 0.8, 0, 1.2));
  tag('排好的 A', 'ptr alt', -6, 0.8, 0);
  say('merge(L′, R′) → 排好的 A', '葉子先兩兩合併，再 4 個、8 個…往上');
  await beat(tok, 3800);
  say('輸入 n → 兩個已排序的 n/2 → 已排序的 n', 'merge 假設兩邊輸入已排好');
  await beat(tok, 3400);
}]);

// 28:15 Two-finger merge：L′ = 2 7 13 20、R′ = 1 9 11 12
FRAG.push(['dcmit-merge-twofinger', 'Merge：two-finger 演算法', async (tok) => {
  fresh([0, 6.2, 12.5], [0, 1, 0.4]);
  const L = [2, 7, 13, 20], R = [1, 9, 11, 12], X = (i) => -4.2 + i * 1.2, OX = (k) => -4.2 + k * 1.2;
  const lm = L.map((v, i) => cube(v, DP, [0.9, 0.6, 0.9], X(i), 0.3, -2.2));
  const rm = R.map((v, i) => cube(v, DO, [0.9, 0.6, 0.9], X(i), 0.3, -0.4));
  tag("L′", 'ptr', -5.8, 0.3, -2.2); tag("R′", 'ptr', -5.8, 0.3, -0.4); tag('A', 'ptr alt', -5.8, 0.3, 2.2);
  for (let k = 0; k < 8; k++) ctx.tile(V3(OX(k) * 0.7 - 1.2, 0.02, 2.2), 0.8, 0.9);
  const fl = tag('左手指', 'ptr alt', X(0), 1.2, -2.2), fr = tag('右手指', 'ptr alt', X(0), 1.2, -0.4);
  say('兩隻手指各指一個已排序串列', '比較兩個指到的值，小的寫進 A');
  await beat(tok, 2800);
  let i = 0, j = 0;
  for (let k = 0; k < 8; k++) {
    const useL = j >= 4 || (i < 4 && L[i] <= R[j]);
    if (i < 4) glow(lm[i], GOLD); if (j < 4) glow(rm[j], GOLD);
    const v = useL ? L[i] : R[j], m = useL ? lm[i] : rm[j];
    if (k < 2) say(L[i] + ' vs ' + R[j] + '：' + v + ' 較小', '寫下 ' + v + '，那隻手指往前一格');
    else if (i >= 4 || j >= 4) say((i >= 4 ? 'L′' : 'R′') + ' 用完：直接搬 ' + v, '');
    else say(L[i] + ' vs ' + R[j] + ' → ' + v, '');
    await beat(tok, k < 2 ? 1700 : 900);
    if (i < 4) glow(lm[i], null); if (j < 4) glow(rm[j], null);
    move(m, OX(k) * 0.7 - 1.2, 0.3, 2.2); tint(m, DG);
    if (useL) i++; else j++;
    move(fl, X(Math.min(i, 3.6)), 1.2, -2.2); move(fr, X(Math.min(j, 3.6)), 1.2, -0.4);
    await beat(tok, k < 2 ? 900 : 500);
  }
  say('A = 1 2 7 9 11 12 13 20', '每個元素只寫一次：merge 是 Θ(n)');
  await beat(tok, 3200);
}]);

// 32:00 / 46:49 / 49:26 Recursion tree：f = 'n'（merge sort）、'n2'（cn²）、'1'（c）
FRAG.push(['dcmit-rectree', 'Recursion tree：把每層的工作加起來', async (tok) => {
  const f = ((ctx.params || {}).f) || 'n';
  fresh([0, 4.4, 13.5], [0, 3.2, 0]);
  const LV = [5.9, 4.4, 2.9, 1.0], W = [1.6, 1.3, 1.0, 0.8];
  const nodeL = { n: ['cn', 'cn/2', 'cn/4', 'c'], n2: ['cn²', 'cn²/4', 'cn²/16', 'c'], 1: ['c', 'c', 'c', 'c'] }[f];
  const sums = { n: ['cn', 'cn', 'cn', 'cn'], n2: ['cn²', 'cn²/2', 'cn²/4', 'nc'], 1: ['c', '2c', '4c', 'nc'] }[f];
  const rec = { n: 'T(n) = c₁ + 2T(n/2) + cn', n2: 'T(n) = 2T(n/2) + cn²', 1: 'T(n) = 2T(n/2) + c' }[f];
  const intro = { n: 'Merge sort 的遞迴式', n2: '假設 merge 寫爛了：cn²', 1: '假設 merge 只要常數時間' }[f];
  const nx = (d, k) => -4.6 + (k + 0.5) * (9.2 / Math.pow(2, d));
  tag(rec, 'ptr', -3.6, 7, 0);
  say(intro, rec + (f === 'n' ? '（c₁ 是切開的常數，忽略）' : ''));
  await beat(tok, 2600);
  const nodes = [];
  for (let d = 0; d < 4; d++) {
    nodes[d] = [];
    for (let k = 0; k < Math.pow(2, d); k++) {
      if (d) line(nx(d - 1, k >> 1), LV[d - 1] - 0.3, nx(d, k), LV[d] + 0.3, 0);
      nodes[d].push(cube(nodeL[d], d === 3 ? MINT : PAPER, [W[d], 0.55, 0.7], nx(d, k), LV[d], 0, 1));
    }
    if (d === 2) tag('⋮', 'ptr', 0, 1.95, 0);
    say(d === 3 ? 'n 變成 1：葉子都是 c' : '第 ' + d + ' 層：' + Math.pow(2, d) + ' 個 ' + nodeL[d], d === 0 ? '根：最上層 merge 的工作' : '子問題大小 n/' + Math.pow(2, d));
    await beat(tok, 1400);
  }
  tag('1 + lg n 層', 'ptr alt', -6.2, 3.5, 0);
  tag('n 片葉子', 'ptr alt', 0, 0.2, 1);
  say('層數 1 + lg n、葉子 n 個', '三種遞迴式的樹形完全一樣');
  await beat(tok, 2600);
  for (let d = 0; d < 4; d++) { tag('= ' + sums[d], 'ptr', 6.1, LV[d], 0); await beat(tok, 700); }
  const hot = f === 'n' ? [0, 1, 2, 3] : f === 'n2' ? [0] : [3];
  hot.forEach((d) => nodes[d].forEach((m) => glow(m, GOLD)));
  if (f === 'n') { say('每一層都是 cn', '(1 + lg n) · cn = Θ(n lg n)'); }
  else if (f === 'n2') { say('根最大：下面加起來 ≤ cn²', '總和 ≤ 2cn² → Θ(n²)；工作在根'); }
  else { say('葉子最大：c + 2c + … + nc', '≤ 2nc → Θ(n)；工作在葉子'); }
  await beat(tok, 3600);
}]);

// 39:38 Insertion sort 的優點：in-place（Θ(1) 輔助空間）vs merge sort Θ(n)
FRAG.push(['dcmit-inplace', 'In-place：輔助空間 Θ(1) vs Θ(n)', async (tok) => {
  fresh([0, 6, 13], [0, 1.8, 0]);
  const X = (i) => -6.2 + i * 0.62;
  tag('insertion sort', 'ptr', -4.2, 3.6, -1.5); tag('merge sort', 'ptr', 3, 3.6, -1.5);
  [2, 4, 5, 6, 1, 3].forEach((v, i) => cube(v, DB, [0.55, 0.5, 0.6], X(i) + 0.6, 0.25, -1.5));
  const tmp = cube('temp', DY, [0.9, 0.5, 0.6], -4.2, 0.25, 0.8, 2);
  say('Insertion sort 只多一個 temp', '交換用的暫存 → Θ(1) 輔助空間 = in-place');
  await beat(tok, 3800);
  glow(tmp, GOLD);
  const B = [20, 13, 7, 2, 12, 11, 9, 1], M = (i) => 0.6 + i * 0.68;
  B.forEach((v, i) => cube(v, DB, [0.6, 0.5, 0.6], M(i), 0.25, -1.5));
  say('Merge sort 要複製出 L、R', '再把結果寫回 A');
  await beat(tok, 2400);
  const cp = B.map((v, i) => cube(v, i < 4 ? DP : DO, [0.6, 0.5, 0.6], M(i) + (i < 4 ? -0.25 : 0.25), 0.25, 0.8, 2));
  say('多出 n 個格子：Θ(n) 輔助空間', '十億筆資料時記憶體就是問題');
  await beat(tok, 3800);
  for (let i = 0; i < 4; i++) fly(cp[i], V3(-1, 6, 3));
  say('技巧：只複製一半 → n/2', '常數變小，仍是 Θ(n)');
  await beat(tok, 3600);
  say('In-place merge sort 存在', '仍 Θ(n lg n)，但常數太大，實務上少用');
  await beat(tok, 3600);
}]);

// 43:45 常數因子：Python merge 2.2 n lg n μs vs C insertion 0.01 n² μs
FRAG.push(['dcmit-python-vs-c', 'Python merge sort vs C insertion sort', async (tok) => {
  fresh([0, 4.6, 12.5], [0, 2.6, 0]);
  const Ns = [1000, 2000, 4000, 8000], S = 5 / 640000;
  const mp = (n) => 2.2 * n * Math.log2(n), ic = (n) => 0.01 * n * n;
  tag('Python merge：2.2 n lg n μs', 'ptr', -3.4, 6.6, 0);
  tag('C insertion：0.01 n² μs', 'ptr alt', 3.2, 6.6, 0);
  say('實測曲線擬合：時間（μs）', 'Python insertion 約 0.2 n²；C 快約 20 倍');
  await beat(tok, 3000);
  for (let q = 0; q < 4; q++) {
    const x = -4.5 + q * 3, n = Ns[q];
    const b1 = dBar(DB, x - 0.4, 0), b2 = dBar(DO, x + 0.4, 0);
    tag('n = ' + n, 'idx', x, 0.02, 1);
    await anim(tok, 700, (t) => { dSetBar(b1, mp(n) * S * t); dSetBar(b2, ic(n) * S * t); });
    const win = mp(n) < ic(n);
    glow(win ? b1 : b2, GREEN);
    say('n = ' + n + '：' + (win ? 'Python merge 較快' : 'C insertion 較快'), Math.round(mp(n) / 1000) + 'k vs ' + Math.round(ic(n) / 1000) + 'k μs');
    await beat(tok, 1700);
  }
  say('n 到幾千以上，Python merge 就贏', '常數 20 倍救不了 n² → 漸近複雜度才是關鍵');
  await beat(tok, 3600);
}]);

// ═════════════ Rec3：4iXLnF3hExw ═════════════

// 02:17 document distance 回顧：call graph 與各函數成本
FRAG.push(['dcmit-docdist-recap', 'Document distance：呼叫圖與成本', async (tok) => {
  fresh([0, 5, 13.5], [0, 3.2, 0]);
  const N = {
    main: ['main', 0, 6.4], wff: ['word_frequencies_for_file', -2.9, 4.8], va: ['vector_angle', 3.3, 4.8],
    gw: ['get_words_from_line_list', -4.3, 3], cf: ['count_frequency', -1.2, 3], ip: ['inner_product', 3.3, 3],
  };
  const SH = { gw: 'get_words', cf: 'count_frequency', ip: 'inner_product', va: 'vector_angle', wff: 'word_freq_for_file' };
  const P = { wff: 'main', va: 'main', gw: 'wff', cf: 'wff', ip: 'va' };
  const M = {};
  for (const k of Object.keys(N)) {
    const [t, x, y] = N[k];
    if (P[k]) line(N[P[k]][1], N[P[k]][2] - 0.3, x, y + 0.3, 0);
    M[k] = dBox(t, x, y, 0, k === 'main' ? 1.4 : 2.9, PAPER, 1);
    await beat(tok, 350);
  }
  say('Call graph：main 往下呼叫', 'read_file 當作 Θ(檔案長度)，不計');
  await beat(tok, 2600);
  tag('W = 字數　L = 不重複字數　w̄ = 字長', 'ptr', 0, 0.6, 1);
  say('三個常數：W、L、w̄', '英文字長 5–10 字元 → w̄ 有界');
  await beat(tok, 2800);
  const C = [['gw', 'O(W²)', '元凶：word_list + …'], ['ip', 'O(L₁L₂)', '兩個向量逐一比對'], ['va', 'L₁L₂ + L₁² + L₂²', 'L₁² + L₂² ≥ L₁L₂ → 去掉 L₁L₂'], ['cf', '≤ W²（待算）', '先假設不超過 W²'], ['wff', 'O(W²)', '每份文件各呼叫一次']];
  for (const [k, c, why] of C) {
    glow(M[k], GOLD);
    tag(c, k === 'gw' ? 'ptr' : 'ptr alt', N[k][1], N[k][2] - 0.75, 0.5);
    say(SH[k] + '：' + c, why);
    await beat(tok, 2000);
    glow(M[k], null);
  }
  glow(M.main, GREEN);
  tag('O(W₁² + W₂²)', 'ptr alt', 2.4, 6.4, 0);
  say('全部：W₁² + W₂²', 'W ≥ L，所以 L₁²、L₂² 被吃掉');
  await beat(tok, 3400);
}]);

// 20:31 count_frequency：字串比較 w̄、緊與鬆的上界、哪行主導
FRAG.push(['dcmit-cf-strcmp-bounds', '字串比較 w̄ 與緊／鬆上界', async (tok) => {
  fresh([0, 5.2, 13.5], [0, 3.4, 0]);
  const s1 = 'distance', s2 = 'distancy', X = (i) => -6 + i * 0.62;
  const a = s1.split('').map((c, i) => cube(c, DB, [0.5, 0.45, 0.5], X(i), 5.6, 0));
  const b = s2.split('').map((c, i) => cube(c, DP, [0.5, 0.45, 0.5], X(i), 4.9, 0));
  const cur = tag('▲', 'ptr alt', X(0), 4.35, 0), cc = tag('比了 0 個字元', 'ptr', -3.8, 6.5, 0);
  say('兩字串只差最後一個字元', '要一個一個比到最後');
  await beat(tok, 2000);
  for (let i = 0; i < 8; i++) {
    move(cur, X(i), 4.35, 0); glow(a[i], s1[i] === s2[i] ? GOLD : RED); glow(b[i], s1[i] === s2[i] ? GOLD : RED);
    txt(cc, '比了 ' + (i + 1) + ' 個字元'); await beat(tok, 330);
  }
  say('字串比較 = Θ(字長) = w̄', 'if new_word == entry[0]：成本 w̄ × L·W 次');
  await beat(tok, 3000);
  const cd = code(['3 for new_word in word_list:', '4   for entry in L:', '5     if new_word == entry[0]:', '6       entry[1] += 1', '7       break', '8   else:', '9     L.append([new_word, 1])'], 0.8, 6.4, 0.5);
  const cst = ['1 × W', '1 × L·W', 'w̄ × L·W', '', '1 × (W − L)', '1 × L', '1 × L'];
  const tg = cst.map((c, i) => tag(c, 'ptr alt', 5.6, 6.4 - i * 0.5, 0));
  cd.hl(4);
  say('6、7 行：只有重複字才跑', '緊：W − L 次；鬆：每輪最多 break 一次 → W');
  await beat(tok, 3200);
  cd.hl(6);
  say('else：for 沒 break 才跑', '緊：只有新字 → L；鬆：W');
  await beat(tok, 3000);
  say('哪個上界都給出對的漸近答案', '緊的界代表你真的看懂了演算法');
  await beat(tok, 2600);
  cd.hl(2); tg[2].element.className = 'lab-label ptr';
  say('第 5 行最大：O(W · L · w̄)', 'w̄ 有界 → W·L ≤ W²，先前的假設成立');
  await beat(tok, 3400);
}]);

// 35:22 extend 的成本：每行 K 字、Z 行 → K·Z = W
FRAG.push(['dcmit-extend-kz', 'extend：K 次 append × Z 行 = W', async (tok) => {
  fresh([0, 5.4, 13], [0, 2.6, 0]);
  const K = 3, Z = 4;
  code(['4  words_in_line = get_words_from_string(line)', '5  word_list.extend(words_in_line)'], -0.4, 6.6, 0.5);
  tag('文件', 'ptr', -5.8, 4.2, 0);
  const doc = [];
  for (let z = 0; z < Z; z++) for (let k = 0; k < K; k++) doc.push(cube('', DB, [0.5, 0.4, 0.5], -5.6 + k * 0.6, 3.6 - z * 0.55, 0));
  say('K = 每行字數、Z = 行數', 'K 有界（一行要放得進螢幕）；W = K·Z');
  await beat(tok, 2800);
  tag('word_list（陣列，連續存放）', 'ptr alt', 1.4, 0.95, 1.2);
  for (let i = 0; i < K * Z; i++) ctx.tile(V3(-2.4 + i * 0.6, 0.02, 1.2), 0.55, 0.6);
  const cost = tag('成本 0', 'ptr', 5.2, 3.4, 0);
  let c = 0;
  for (let z = 0; z < Z; z++) {
    say('第 ' + (z + 1) + ' 行：取出 K = 3 個字', 'extend = 3 次 append，每次 O(1)');
    for (let k = 0; k < K; k++) {
      const m = doc[z * K + k]; move(m, -2.4 + (z * K + k) * 0.6, 0.25, 1.2); tint(m, DG);
      c++; txt(cost, '成本 ' + c); await beat(tok, 320);
    }
    await beat(tok, 700);
  }
  say('總共 K · Z = W', 'get_words_from_line_list：O(W²) → O(W)');
  await beat(tok, 3000);
  say('Python list = CLRS 的 array', 'linked list 串接 O(1)，但取第 200 個要走 200 步');
  await beat(tok, 3200);
  say('docdist2：O(W₁L₁ + W₂L₂ + L₁L₂)', 'L₁² ≤ W₁L₁，所以不用另外加');
  await beat(tok, 3000);
}]);

// 48:40 為何兩指標不改 binary search；最壞 L₁ + L₂
FRAG.push(['dcmit-ptr-vs-bsearch', '兩指標 vs binary search：L₁ + L₂', async (tok) => {
  fresh([0, 6, 13], [0, 1.6, 0]);
  const X = (i) => -4.2 + i * 1.2;
  const top = [1, 2, 3, 4, 5, 6, 7, 8].map((v, i) => cube(v, DB, [0.9, 0.55, 0.9], X(i), 0.3, -2));
  const bot = [1, 2, 3, 4, 5, 6, 7, 8].map((v, i) => cube(v, DP, [0.9, 0.55, 0.9], X(i), 0.3, 0.6));
  tag('L₁', 'ptr', -5.9, 0.3, -2); tag('L₂', 'ptr', -5.9, 0.3, 0.6);
  const c1 = tag('binary search：0 步', 'ptr', -3, 4.4, 0), c2 = tag('兩指標：0 步', 'ptr alt', 3, 4.4, 0);
  say('兩串列都是 1 … N（N = 10,000）', '每個都做 binary search 會怎樣？');
  await beat(tok, 2600);
  let s = 0;
  for (let i = 0; i < 8; i++) {
    glow(top[i], GOLD);
    let lo = 0, hi = 7;
    while (lo <= hi) { const m = (lo + hi) >> 1; glow(bot[m], GOLD); s++; txt(c1, 'binary search：' + s + ' 步'); await beat(tok, 110); glow(bot[m], null); if (m === i) break; if (m < i) lo = m + 1; else hi = m - 1; }
    glow(top[i], null);
    if (i === 0) { say('每個元素各 ≈ log N 步', '總共 ≈ N log N'); await beat(tok, 900); }
  }
  say('binary search：≈ N log N', '前一半就有 (N/2)·log(N/2)');
  await beat(tok, 2200);
  const p1 = tag('↑', 'ptr alt', X(0), 1, -2), p2 = tag('↑', 'ptr alt', X(0), 1, 0.6);
  s = 0;
  for (let i = 0; i < 8; i++) {
    glow(top[i], GREEN); glow(bot[i], GREEN); s += 2; txt(c2, '兩指標：' + s + ' 步');
    move(p1, X(Math.min(i + 1, 7.4)), 1, -2); move(p2, X(Math.min(i + 1, 7.4)), 1, 0.6);
    await beat(tok, 220);
  }
  say('兩指標：N + N = 2N', '指標只往下走，從不回頭');
  await beat(tok, 2800);
  top.forEach((m, i) => { if (i > 2) fly(m, V3(-2, 6, -3)); else { relabel(m, 6 + i); tint(m, DY); glow(m, null); } });
  bot.forEach((m) => glow(m, null));
  say('最壞：短串列的值都在長串列尾端', 'L₁ = 6 7 8：L₂ 的指標得走完整條 → L₁ + L₂');
  move(p2, X(0), 1, 0.6);
  for (let i = 0; i < 8; i++) { move(p2, X(i), 1, 0.6); glow(bot[i], GOLD); await beat(tok, 200); glow(bot[i], null); }
  await beat(tok, 1000);
  say('上界：O(L₁ + L₂)', 'docdist 的這個指標技巧＝merge sort 的 merge');
  await beat(tok, 3000);
}]);

// ═════════════ L11：eCaXlAaN2uE ═════════════

// 00:37 動機：64 位元不夠
FRAG.push(['dcmit-bigint-why', '高精度：比 64 位元長得多的數', async (tok) => {
  fresh([0, 5, 12.5], [0, 2, 0]);
  const w = cube('64-bit word', DB, [2.4, 0.7, 0.9], -4.2, 4.6, 0, 2);
  say('一個機器字只有 64 位元', '8 → 32 → 64 位元');
  await beat(tok, 3400);
  tag('1024-bit RSA 數字', 'ptr', -1, 3.2, 0);
  for (let i = 0; i < 16; i++) { cube('', i % 2 ? DB : '#7fb6e8', [0.7, 0.6, 0.8], -5.25 + i * 0.7, 2.2, 0, 1.5); await beat(tok, 90); }
  say('RSA：數千位元的質數', '1024 位元 = 16 個 64 位元字');
  await beat(tok, 3400);
  const d = cube('√2 到百萬位', DY, [2.6, 0.6, 0.9], 2.2, 0.3, 1.2, 2), p = cube('π 到千萬位', DY, [2.6, 0.6, 0.9], -2.2, 0.3, 1.2, 2);
  say('√2 算到百萬位怎麼做？', '要多位數的乘法與除法');
  await beat(tok, 3900);
  glow(d, GOLD); glow(p, GOLD); glow(w, GOLD);
  say('這個單元：Newton 法 ＋ 大數乘除', '把長數字拆成機器字來算');
  await beat(tok, 3900);
}]);

// 02:58 Pythagoras：對角線與邊不可公度；√2 的位數
FRAG.push(['dcmit-sqrt2-diagonal', '√2：正方形的對角線', async (tok) => {
  fresh([0, 5, 12], [0, 2.4, 0]);
  const x0 = -5, y0 = 0.6, s = 3.2;
  line(x0, y0, x0 + s, y0); line(x0 + s, y0, x0 + s, y0 + s); line(x0 + s, y0 + s, x0, y0 + s); line(x0, y0 + s, x0, y0);
  tag('1', 'idx', x0 + s / 2, y0 - 0.3, 0); tag('1', 'idx', x0 - 0.3, y0 + s / 2, 0);
  say('邊長 1 的正方形', '對角線多長？');
  await beat(tok, 2500);
  await beat(tok, 600);
  line(x0, y0, x0 + s, y0 + s, 0, '#d64545');
  tag('√2', 'ptr alt', x0 + s / 2 + 0.4, y0 + s / 2 - 0.3, 0);
  say('對角線與邊「不可公度」', '比值不是整數比 → 無理數');
  await beat(tok, 3400);
  const dg = ['1.414', '213', '562', '373', '095', '048', '…'];
  for (let q = 0; q < dg.length; q++) { cube(dg[q], q ? PAPER : DY, [q ? 0.9 : 1.3, 0.55, 0.8], -0.2 + q * 1.05 + (q ? 0.2 : 0), 1.6, 0, 1.5); await beat(tok, 450); }
  say('√2 = 1.414213562373095048…', '看不出規律');
  await beat(tok, 3400);
  say('畢氏學派視無理數為威脅', '算到幾百萬位，能找到規律嗎？');
  await beat(tok, 3200);
}]);

// 07:00 Catalan：平衡括號字串集合 P 的兩條規則
FRAG.push(['dcmit-catalan-rules', 'Catalan：平衡括號的兩條規則', async (tok) => {
  fresh([0, 5, 12.5], [0, 2.6, 0]);
  const P = (s, x, y, c = PAPER, drop = 1) => s.split('').map((ch, i) => cube(ch, c, [0.5, 0.6, 0.6], x + i * 0.55, y, 0, drop));
  tag('規則 1：λ ∈ P（空字串）', 'ptr', -3.2, 6.3, 0);
  tag('規則 2：α, β ∈ P ⇒ (α)β ∈ P', 'ptr alt', 2.8, 6.3, 0);
  say('P = 平衡括號字串的集合', 'C_n = 恰有 n 對括號的字串個數');
  await beat(tok, 3000);
  const e = cube('λ', MINT, [0.6, 0.6, 0.6], -5, 4.6, 0, 1.5);
  say('規則 1：空字串 λ 在 P 裡', '');
  await beat(tok, 1800);
  P('()', -3.2, 4.6, MINT);
  tag('α = λ, β = λ', 'idx', -2.9, 4.0, 0.4);
  say('α = β = λ 套規則 2 → ()', '');
  await beat(tok, 2400);
  const bad1 = P(')(', 1.6, 4.6, '#f2c5c5'), bad2 = P('(()', 3.6, 4.6, '#f2c5c5');
  bad1.concat(bad2).forEach((m) => glow(m, RED));
  say(')(、(() 不平衡，產生不出來', '');
  await beat(tok, 2400);
  bad1.concat(bad2).forEach((m) => fly(m));
  const s = P('(())()', -1.6, 2.2, PAPER);
  say('例：(())()', '每個非空平衡字串只有一種 (α)β 拆法');
  await beat(tok, 2600);
  [1, 2].forEach((i) => tint(s[i], DB)); [4, 5].forEach((i) => tint(s[i], DO));
  [0, 3].forEach((i) => glow(s[i], GOLD));
  tag('α = ()', 'ptr', -0.8, 1.2, 0.4); tag('β = ()', 'ptr', 1.4, 1.2, 0.4);
  say('外層括號包住 α，後面接 β', 'α、β 都是先前產生過的字串');
  await beat(tok, 3400);
}]);

// 10:55 Catalan 遞迴：C₀ = 1、C₂ = C₀C₁ + C₁C₀、C_{n+1} = Σ C_k C_{n−k}
FRAG.push(['dcmit-catalan-recur', 'Catalan 遞迴：C_{n+1} = Σ C_k C_{n−k}', async (tok) => {
  fresh([0, 5, 13], [0, 2.8, 0]);
  say('C₀ = 1（空字串）、C₁ = 1：()', 'C_n = n 對括號的平衡字串數');
  await beat(tok, 2600);
  cube('α = λ、β = () → ()()', MINT, [3.2, 0.5, 0.7], -3.6, 5.6, 0, 1);
  cube('α = ()、β = λ → (())', MINT, [3.2, 0.5, 0.7], -3.6, 4.9, 0, 1);
  say('C₂：α 可以是 λ 或 ()', 'C₂ = C₀C₁ + C₁C₀ = 2');
  await beat(tok, 3000);
  tag('C_{n+1} = Σ_{k=0..n} C_k · C_{n−k}', 'ptr alt', 2.8, 5.6, 0);
  say('一般式：α 有 k 對、β 有 n − k 對', 'C_{n+1} = Σ C_k C_{n−k}，n ≥ 0');
  await beat(tok, 3200);
  const Cs = [1, 1, 2, 5, 14, 42, 132, 429, 1430, 4862], bars = [];
  for (let n = 0; n < Cs.length; n++) {
    const x = -5.4 + n * 1.2, h = 0.3 + Math.log10(Cs[n]) * 0.8;
    const b = dBar(n === 5 || n === 9 ? DY : DB, x, 1.2, 0.7); bars.push(b);
    await anim(tok, 240, (t) => dSetBar(b, h * t));
    tag(String(Cs[n]), 'idx', x, h + 0.3, 1.2); tag('C' + n, 'idx', x, 0.02, 2);
  }
  say('1, 1, 2, 5, 14, 42, 132, 429, 1430, 4862', '高度用 log 刻度');
  await beat(tok, 2600);
  glow(bars[9], GOLD); glow(bars[5], GOLD);
  say('車牌 4862？那是 C₉', '42 也在名單上（C₅）');
  await beat(tok, 3000);
}]);

// 18:16 Newton 法：切線 y = f(xᵢ) + f′(xᵢ)(x − xᵢ)，f(x) = x² − a
FRAG.push(['dcmit-newton-tangent', 'Newton 法：沿切線走到 x 軸', async (tok) => {
  fresh([0, 3.6, 12.5], [0, 2.8, 0]);
  const X = (x) => -5 + x * 4.4, Y = (y) => 2.8 + y * 1.0, f = (x) => x * x - 2;
  line(X(0), Y(0), X(2.25), Y(0), 0, '#6e5f49'); tag('x', 'idx', X(2.3), Y(0), 0);
  for (let k = 0; k < 24; k++) { const a = 0.05 + k * 0.09, b = a + 0.09; line(X(a), Y(f(a)), X(b), Y(f(b)), 0, '#d64545'); }
  tag('f(x) = x² − a（a = 2）', 'ptr', X(1.9), Y(f(2.1)) + 0.4, 0);
  say('求 f(x) = 0 的根：逐步逼近', 'a = 2 → 根是 √2');
  await beat(tok, 2800);
  const dot = cube('', DY, [0.25, 0.25, 0.25], X(1), Y(f(1)), 0);
  tag('xᵢ', 'ptr alt', X(1), Y(0) + 0.35, 0);
  line(X(1), Y(0), X(1), Y(f(1)), 0, '#a99470');
  say('從 xᵢ 出發，在曲線上畫切線', 'y = f(xᵢ) + f′(xᵢ)(x − xᵢ)');
  await beat(tok, 3000);
  const t0 = 0.85, t1 = 1.75;
  line(X(t0), Y(f(1) + 2 * (t0 - 1)), X(t1), Y(f(1) + 2 * (t1 - 1)), 0, '#1f3a6e');
  await anim(tok, 900, (t) => dot.position.set(X(1 + 0.5 * t), Y(f(1) * (1 - t)), 0));
  tag('xᵢ₊₁', 'ptr alt', X(1.5), Y(0) - 0.4, 0);
  say('切線和 x 軸的交點 = xᵢ₊₁', 'xᵢ₊₁ = xᵢ − f(xᵢ)/f′(xᵢ)');
  await beat(tok, 3200);
  say('f′(x) = 2x 代進去', 'xᵢ₊₁ = xᵢ − (xᵢ² − a)/(2xᵢ)');
  await beat(tok, 2800);
  say('化簡：xᵢ₊₁ = (xᵢ + a/xᵢ)/2', 'x₀ = 1 → x₁ = 1.5');
  await beat(tok, 2800);
  glow(dot, GOLD);
  say('只有加法，但 a/xᵢ 要做除法', 'xᵢ 可能有百萬位');
  await beat(tok, 3000);
}]);

// 28:01 a/xᵢ 需要除法 → 先做乘法；精度用整數 ⌊10^d √2⌋
FRAG.push(['dcmit-int-precision', '除法靠乘法；精度用整數表示', async (tok) => {
  fresh([0, 5, 12.5], [0, 2.4, 0]);
  const b1 = dBox('加法：一次一個進位', -3.4, 5.2, 0, 3.6, MINT, 1);
  say('長數字加法：手算也不難', '只要處理進位，Θ(n)');
  await beat(tok, 2900);
  const b2 = dBox('乘法：百位數 × 百位數', -3.4, 4.3, 0, 3.6, PAPER, 1);
  const b3 = dBox('除法：100 位 ÷ 50 位', -3.4, 3.4, 0, 3.6, PAPER, 1);
  say('乘、除就要靠電腦', '');
  await beat(tok, 2900);
  arrow(V3(-1.4, 3.4, 0), V3(1.2, 3.4, 0));
  dBox('a/xᵢ = a × (1/xᵢ)', 3.2, 3.4, 0, 3.2, DY, 1);
  say('除法：先求倒數，再乘 a', '實用的除法演算法都以乘法為子程序');
  await beat(tok, 3600);
  glow(b2, GOLD);
  say('所以先學高精度乘法', '一般做法：n 位 × n 位 = Θ(n²)');
  await beat(tok, 3100);
  const dg = '1414213562'.split('');
  tag('d = 9：⌊10⁹ · √2⌋', 'ptr alt', -2.6, 1.5, 0.8);
  dg.forEach((c, i) => cube(c, DB, [0.45, 0.45, 0.5], 0 + i * 0.5, 0.25, 0.8, 1));
  say('事先決定精度 d，全部用整數', '⌊10^d √2⌋ = ⌊√(2 · 10^(2d))⌋');
  await beat(tok, 4100);
}]);

// 33:08 分治：x = x₁·r^(n/2) + x₀；4 次 n/2 位乘法 → Θ(n²)
FRAG.push(['dcmit-split-4mult', '大數乘法：拆半要 4 次乘法', async (tok) => {
  fresh([0, 5, 13], [0, 2.8, 0]);
  const x1 = cube('x₁', DB, [1.6, 0.6, 0.8], -4.6, 6, 0, 1), x0 = cube('x₀', '#7fb6e8', [1.6, 0.6, 0.8], -3, 6, 0, 1);
  const y1 = cube('y₁', DP, [1.6, 0.6, 0.8], -4.6, 5.1, 0, 1), y0 = cube('y₀', '#c4b3f7', [1.6, 0.6, 0.8], -3, 5.1, 0, 1);
  tag('x', 'ptr', -6, 6, 0); tag('y', 'ptr', -6, 5.1, 0);
  say('x、y 都是 n 位數（基底 r）', '0 ≤ x, y < rⁿ');
  await beat(tok, 2600);
  tag('高半', 'idx', -4.6, 6.55, 0.4); tag('低半', 'idx', -3, 6.55, 0.4);
  say('x = x₁ · r^(n/2) + x₀', 'y = y₁ · r^(n/2) + y₀；每半 n/2 位');
  await beat(tok, 3000);
  const cnt = tag('乘法 0 次', 'ptr alt', 4.6, 6.4, 0);
  const pr = [[x1, y1, 'z₂ = x₁y₁'], [x0, y1, 'x₀y₁'], [x1, y0, 'x₁y₀'], [x0, y0, 'z₀ = x₀y₀']];
  for (let q = 0; q < 4; q++) {
    const [a, b, t] = pr[q]; glow(a, GOLD); glow(b, GOLD);
    cube(t, DO, [2.2, 0.5, 0.8], 2.6, 5 - q * 0.7, 0, 1.2);
    txt(cnt, '乘法 ' + (q + 1) + ' 次'); say('第 ' + (q + 1) + ' 次：' + t, 'n/2 位 × n/2 位');
    await beat(tok, 1300); glow(a, null); glow(b, null);
  }
  say('z₁ = x₀y₁ + x₁y₀', 'xy = z₂ · rⁿ + z₁ · r^(n/2) + z₀');
  await beat(tok, 3000);
  tag('rⁿ', 'idx', -4, 1.8, 0); tag('r^(n/2)', 'idx', -1.5, 1.8, 0); tag('1', 'idx', 1, 1.8, 0);
  cube('z₂', DO, [2.2, 0.5, 0.8], -4, 1.1, 0, 1.5); cube('z₁', DO, [2.2, 0.5, 0.8], -1.5, 0.6, 0, 1.5); cube('z₀', DO, [2.2, 0.5, 0.8], 1, 0.3, 0, 1.5);
  say('移位後相加：加法 Θ(n)', 'T(n) = 4T(n/2) + Θ(n) = Θ(n²)');
  await beat(tok, 3600);
}]);

// 38:03 Karatsuba：z₁ = (x₀ + x₁)(y₀ + y₁) − z₀ − z₂ → 3 次乘法
FRAG.push(['dcmit-karatsuba-3', 'Karatsuba：3 次乘法 n^(lg 3)', async (tok) => {
  fresh([0, 5, 13], [0, 2.8, 0]);
  const cnt = tag('乘法 0 次', 'ptr alt', 4.6, 6.4, 0);
  say('Karatsuba：先算 z₀、z₂', '再用它們湊出 z₁');
  await beat(tok, 2400);
  const z0 = cube('z₀ = x₀y₀', DO, [2.4, 0.5, 0.8], -4, 5.6, 0, 1.2); txt(cnt, '乘法 1 次'); await beat(tok, 1000);
  const z2 = cube('z₂ = x₁y₁', DO, [2.4, 0.5, 0.8], -4, 4.9, 0, 1.2); txt(cnt, '乘法 2 次'); await beat(tok, 1000);
  const s = cube('(x₀ + x₁)(y₀ + y₁)', DY, [3.4, 0.5, 0.8], 1.2, 5.25, 0, 1.2); txt(cnt, '乘法 3 次');
  say('第 3 次：兩個和相乘', '= x₀y₀ + x₀y₁ + x₁y₀ + x₁y₁');
  await beat(tok, 3000);
  glow(z0, RED); glow(z2, RED);
  const z1 = cube('z₁ = (x₀+x₁)(y₀+y₁) − z₀ − z₂', DG, [5.6, 0.5, 0.8], -0.6, 3.6, 0, 1.5);
  say('減掉 z₀、z₂ 就是 z₁', '加減法便宜，乘法只剩 3 次');
  await beat(tok, 3200);
  glow(z0, null); glow(z2, null); glow(z1, GREEN);
  say('T(n) = 3T(n/2) + Θ(n)', '= Θ(n^(log₂3)) ≈ Θ(n^1.585)');
  await beat(tok, 3000);
  const b4 = dBar(DR, -2, 1.2, 0.9), b3 = dBar(DG, 0, 1.2, 0.9);
  tag('4 次：n²', 'idx', -2, 0.02, 2); tag('3 次：n^1.585', 'idx', 0, 0.02, 2);
  await anim(tok, 800, (t) => { dSetBar(b4, 2 * 1.2 * t); dSetBar(b3, 1.585 * 1.2 * t); });
  say('下回預告：拆成三段', '直接做 9 次乘法，能更少就更快');
  await beat(tok, 3000);
}]);

// 42:56 Demo：半徑 5×10¹¹ 的大圓，AD = R − √(R² − 1) 的位數裡藏著 Catalan 數
FRAG.push(['dcmit-catalan-circle', 'Demo：大圓裡的 Catalan 數', async (tok) => {
  fresh([0, 4, 13], [0, 3, 0]);
  const cx = -3.2, cy = 3.5, r = 3;
  for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2, b = (k + 1) / 48 * Math.PI * 2; line(cx + r * Math.cos(a), cy + r * Math.sin(a), cx + r * Math.cos(b), cy + r * Math.sin(b), 0, '#6e5f49'); }
  tag('C', 'ptr', cx - 0.3, cy, 0);
  const bx = cx + 1.2, by = cy - Math.sqrt(r * r - 1.44);
  line(cx, cy, cx, cy - r, 0, '#1f3a6e'); line(cx, cy, bx, by, 0, '#1f3a6e');
  tag('A', 'ptr', cx - 0.3, cy - r - 0.15, 0); tag('B', 'ptr', bx + 0.3, by, 0);
  say('直徑一兆單位的大圓，圓心 C', 'CA = CB = 半徑 = 5 × 10¹¹');
  await beat(tok, 3200);
  line(bx, by, cx, by, 0, '#d64545'); tag('D', 'ptr', cx - 0.35, by + 0.15, 0); tag('1', 'idx', cx + 0.6, by + 0.2, 0);
  say('從 B 作垂線到 CA，高 1 單位', 'D 是垂足（圖上放大）');
  await beat(tok, 3000);
  const ad = cube('', DY, [0.18, Math.max(0.15, by - (cy - r)), 0.18], cx, (by + cy - r) / 2, 0);
  glow(ad, GOLD);
  tag('AD = R − √(R² − 1)', 'ptr alt', 3, 6.4, 0);
  say('AD = AC − CD', 'R = 5 × 10¹¹ 時 = R − √(R² − 1)');
  await beat(tok, 3200);
  say('R² − 1 不是完全平方數', '→ AD 是無理數，算到幾千位看看');
  await beat(tok, 2400);
  const blk = ['0.000000000001', '…0001', '…0002', '…0005', '…0014', '…0042', '…0132'];
  for (let q = 0; q < blk.length; q++) { cube(blk[q], q ? PAPER : MINT, [q ? 1.5 : 3, 0.5, 0.7], q ? 3.8 : 3, 5.5 - q * 0.65, 0, 1); await beat(tok, 450); }
  say('每 24 位一組：1, 1, 2, 5, 14, 42…', '正是 Catalan 數！');
  await beat(tok, 3600);
}]);
  }

  // ═══ dcmit2.js ═══
  {
// ─── MIT 6.006：2YeJ-5UAke8（L12 Square Roots, Newton's Method）、JRgIXyEPnbA（Rec12 Karatsuba, Newton） ───
// 只用 K 與 ctx。老師的例子：L12 ε_n 誤差分析（ε = 0.01）、x₁x₀·y₁y₀ 的 4 次／3 次、Toom-3 九次 → 五次、2⁵⁰ 的 log*、
// R = 2ᵏ 的 shift、72/100 = 0.72、f(x) = 1/x − b/R、2¹⁶/5、c·1^α + … + c·d^α < 2c·d^α、√ → ÷ → × 兩層 Newton；
// Rec12 1234 × 5678 直式、A B C D、Python list 補零／slice、x − R/b 行不通、∛(10^{3d}·a)、ε 0.1 → 0.01 → 0.0001。
const { V3, fresh, tag, cube, move, kill, glow, tint, txt, code, anim, line, arrow, GOLD, GREEN, RED } = K;
const say = ctx.say, beat = ctx.beat;
const B1 = '#4b9ee2', B2 = '#7fb6e8', P1 = '#9b7ef4', P2 = '#c4b3f7', OR = '#dd8238', YE = '#c08a1f', GR = '#2fc092', RD = '#d64545', TE = '#31aab0', PAPER = '#efe3c8', MINT = '#d4e8da', BROWN = '#6e5f49';
const box = (t, x, y, z = 0, w = 2.6, c = PAPER, drop = 0) => cube(t, c, [w, 0.6, 0.8], x, y, z, drop);
const dig = (t, x, y, z = 0, c = PAPER, drop = 0, s = 0.5) => cube(t, c, [s * 0.92, s * 0.92, s], x, y, z, drop);
function bar(color, x, z, w = 0.6) { const m = cube('', color, [w, 1, w], x, 0.001, z); m.scale.y = 0.002; return m; }
const setBar = (m, h) => { const v = Math.max(0.002, h); m.scale.y = v; m.position.y = v / 2; };
function curve(f, x0, x1, X, Y, color = RD, n = 40) {
  for (let k = 0; k < n; k++) { const a = x0 + (x1 - x0) * k / n, b = x0 + (x1 - x0) * (k + 1) / n; line(X(a), Y(f(a)), X(b), Y(f(b)), 0, color); }
}

// ═════════════ L12：2YeJ-5UAke8 ═════════════

// 01:28 / 47:51 √a → 除法 → 乘法：兩層 Newton（params.q：只提出問題）
FRAG.push(['dcmit2-nested', '開根號 → 除法 → 乘法：兩層計算', async (tok) => {
  const q = (ctx.params || {}).q;
  fresh([0, 4.4, 13], [0, 3.2, 0]);
  const s = box('√a：Newton', -2.2, 5.8, 0, 3.4, B1, 1.2);
  tag('log d 次', 'idx', 0.8, 5.8, 0.6);
  say('開根號：Newton 迭代', 'x_{i+1} = (x_i + a/x_i)/2');
  await beat(tok, 2600);
  arrow(V3(-2.2, 5.4, 0), V3(-2.2, 4.5, 0));
  const d = box('÷：Newton 求倒數', -2.2, 4.0, 0, 3.4, P1, 1.2);
  tag('log d 次', 'idx', 0.8, 4.0, 0.6);
  say('每一步都要做除法 a/x_i', q ? '除法要怎麼做？上次沒講' : 'x_{i+1} = 2x_i − b·x_i²/R');
  await beat(tok, 2800);
  arrow(V3(-2.2, 3.6, 0), V3(-2.2, 2.7, 0));
  const m = box('×：Θ(n^α)', -2.2, 2.2, 0, 3.4, OR, 1.2);
  say('除法裡面又呼叫乘法', 'naive n²、Karatsuba ≈ n^1.58');
  await beat(tok, 2800);
  if (q) {
    tag('乘法被呼叫幾次？', 'ptr alt', 3.6, 4.0, 0);
    say('兩層計算：總複雜度是多少？', '這就是今天的主題');
    await beat(tok, 3400);
    return;
  }
  const D = [1, 2, 4, 8, 16, 32];
  for (let k = 0; k < D.length; k++) { const b = bar(GR, 1.6 + k * 0.8, 1.2, 0.55); setBar(b, 0.15 + 3.6 * D[k] / 32); tag(String(D[k]), 'idx', 1.6 + k * 0.8, 0, 2); await beat(tok, 260); }
  tag('每次迭代的位數', 'ptr', 3.6, 4.5, 1.2);
  say('位數從小長到大', '√2 先猜 1.5，最後才到百萬位');
  await beat(tok, 3000);
  glow(s, GREEN); glow(d, GREEN); glow(m, GREEN);
  say('工作集中在最後幾次', '√ 的複雜度 = ÷ = × = Θ(n^α)');
  await beat(tok, 3400);
}]);

// 05:10 誤差分析：x_n = √a(1 + ε_n) → ε_{n+1} = ε_n² / (2(1 + ε_n))
FRAG.push(['dcmit2-eps-derive', '誤差分析：ε_{n+1} ≈ ε_n²', async (tok) => {
  fresh([0, 4.6, 13], [0, 3.2, 0]);
  const cd = code(['x_n = √a (1 + ε_n)', 'x_{n+1} = (x_n + a/x_n) / 2', '  = √a [(1 + ε_n) + 1/(1 + ε_n)] / 2', '  = √a [1 + ε_n² / (2(1 + ε_n))]', 'ε_{n+1} = ε_n² / (2(1 + ε_n))'], -2.2, 6.6, 0.6);
  cd.hl(0); say('設 x_n 和 √a 差一個比例 ε_n', 'ε_n 可正可負，要證它很快趨近 0');
  await beat(tok, 3000);
  cd.hl(1); say('代進 Newton 迭代式', '');
  await beat(tok, 2400);
  cd.hl(2); say('提出 √a', '');
  await beat(tok, 2400);
  cd.hl(3); say('化簡後多了一項 ε_n²', '');
  await beat(tok, 2800);
  cd.hl(4); say('n 變大時 1 + ε_n ≈ 1', '誤差每次被平方：quadratic convergence');
  await beat(tok, 3000);
  const E = [['ε = 10⁻²', 2], ['ε² = 10⁻⁴', 4], ['ε⁴ = 10⁻⁸', 8]];
  for (let k = 0; k < E.length; k++) {
    tag(E[k][0], 'ptr alt', -5.2, 2.2 - k * 0.75, 1.5);
    for (let j = 0; j < E[k][1]; j++) dig('0', -3.6 + j * 0.55, 2.2 - k * 0.75, 1.5, k ? MINT : PAPER, 0.8);
    await beat(tok, 1200);
  }
  say('0.01 → 0.0001：小數點後的 0 翻倍', '正確位數 1 → 2 → 4 → 8');
  await beat(tok, 3000);
  say('d 位精度只要 log d 次迭代', '');
  await beat(tok, 2600);
}]);

// 10:36 乘法回顧：x₁x₀ × y₁y₀，4 次 → n²；Karatsuba 3 次 → n^1.58
FRAG.push(['dcmit2-mult-recap', '乘法回顧：4 次 vs 3 次', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.4, 0]);
  cube('x₁', B1, [1.3, 0.55, 0.7], -0.7, 6.6, 0, 1); cube('x₀', B2, [1.3, 0.55, 0.7], 0.7, 6.6, 0, 1);
  cube('y₁', P1, [1.3, 0.55, 0.7], -0.7, 5.9, 0, 1); cube('y₀', P2, [1.3, 0.55, 0.7], 0.7, 5.9, 0, 1);
  tag('x₁ = 高半，各 d/2 位', 'idx', 3.6, 6.6, 0);
  say('d 位數 x、y 各拆成兩半', 'x₁y₁、x₁y₀、x₀y₁、x₀y₀');
  await beat(tok, 3000);
  const tree = async (cx, k, sp, col) => {
    const r = cube('n', col, [0.7, 0.4, 0.5], cx, 4.6, 0, 1); const L1 = [];
    await beat(tok, 300);
    for (let i = 0; i < k; i++) { const x = cx + (i - (k - 1) / 2) * sp * k; line(cx, 4.4, x, 3.5); L1.push(cube('n/2', col, [0.55, 0.32, 0.45], x, 3.3, 0, 0.8)); }
    await beat(tok, 500);
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) { const px = cx + (i - (k - 1) / 2) * sp * k, x = px + (j - (k - 1) / 2) * sp; line(px, 3.1, x, 2.3); cube('', col, [0.28, 0.25, 0.3], x, 2.1, 0, 0.6); }
    return r;
  };
  await tree(-3.6, 4, 0.36, RD);
  tag('4T(n/2) + Θ(n)', 'ptr', -3.6, 1.3, 0.6); tag('每層 n、2n、4n…', 'idx', -3.6, 0.7, 0.6);
  say('直接做：4 次乘法', 'T(n) = 4T(n/2) + Θ(n) = Θ(n²)');
  await beat(tok, 3200);
  await tree(3.6, 3, 0.6, GR);
  tag('3T(n/2) + Θ(n)', 'ptr alt', 3.6, 1.3, 0.6); tag('多幾次加法 Θ(n)', 'idx', 3.6, 0.7, 0.6);
  say('Karatsuba：代數技巧只要 3 次', 'T(n) = 3T(n/2) + Θ(n) = Θ(n^(log₂3)) ≈ n^1.58');
  await beat(tok, 3400);
  say('子問題少一個，整棵樹小很多', '');
  await beat(tok, 2400);
}]);

// 13:03 Toom-Cook 3：拆三段，直接 9 次 → 技巧後 5 次 → n^(log₃5)
FRAG.push(['dcmit2-toom3', 'Toom-3：九次乘法減為五次', async (tok) => {
  fresh([0, 5, 13], [0, 3, 0]);
  const xs = [], ys = [];
  for (let i = 0; i < 3; i++) xs.push(cube('x' + '₂₁₀'[i], [B1, B2, '#a9cdf0'][i], [1, 0.5, 0.7], -3.6 + i * 1.2, 6.3, 0, 1));
  for (let j = 0; j < 3; j++) ys.push(cube('y' + '₂₁₀'[j], [P1, P2, '#ddd2fb'][j], [1, 0.5, 0.7], -5.4, 5.2 - j * 0.8, 0, 1));
  say('Toom-Cook 3：每個數拆成三段', '每段 d/3 位；Toom-2 就是 Karatsuba');
  await beat(tok, 3000);
  const cnt = tag('乘法 0 次', 'ptr alt', 3.6, 6.3, 0);
  const cells = [];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    glow(xs[i], GOLD); glow(ys[j], GOLD);
    const c = cube('x' + '₂₁₀'[i] + 'y' + '₂₁₀'[j], PAPER, [1, 0.5, 0.7], -3.6 + i * 1.2, 5.2 - j * 0.8, 0, 0.8); c.userData.s = (2 - i) + (2 - j); cells.push(c);
    txt(cnt, '乘法 ' + cells.length + ' 次'); await beat(tok, 380); glow(xs[i], null); glow(ys[j], null);
  }
  say('不用技巧：d/3 × d/3 要 9 次', '');
  await beat(tok, 2600);
  const COL = [RD, OR, YE, GR, TE];
  cells.forEach((c) => tint(c, COL[c.userData.s]));
  for (let s = 0; s < 5; s++) tag('×10^' + s + 'k', 'idx', 1.4, 3.0 + s * 0.6, 0);
  say('結果只有 5 個係數（同色相加）', '在 5 個點求值再內插 → 5 次乘法');
  await beat(tok, 3400);
  txt(cnt, '乘法 5 次');
  say('T(n) = 5T(n/3) + Θ(n)', '= Θ(n^(log₃5)) ≈ Θ(n^1.465)');
  await beat(tok, 3000);
  const R = [['naive', 2, RD], ['Karatsuba', Math.log2(3), OR], ['Toom-3', Math.log(5) / Math.log(3), GR]];
  for (let k = 0; k < 3; k++) { const b = bar(R[k][2], 3 + k * 1.3, 1.6, 0.8); setBar(b, (R[k][1] - 1) * 3); tag(R[k][0] + ' ' + R[k][1].toFixed(3), 'idx', 3 + k * 1.3, 0, 2.5 + (k % 2) * 0.4); await beat(tok, 500); }
  say('指數 2 → 1.585 → 1.465', '拆越多段，指數越小');
  await beat(tok, 2800);
}]);

// 16:09 常數因子：n 要很大快的才贏；Schönhage-Strassen；Python 在 n 大時才切到 Karatsuba
FRAG.push(['dcmit2-crossover', '常數因子：n 夠大才划算', async (tok) => {
  fresh([0, 4, 13], [0, 3, 0]);
  const X = (L) => -5.5 + L * 0.7, Y = (v) => 0.4 + v * 0.18;
  line(X(0), Y(0), X(16.5), Y(0), 0, BROWN); line(X(0), Y(0), X(0), Y(33), 0, BROWN);
  tag('log₂ n', 'idx', X(16), Y(0) - 0.4); tag('log₂ 時間', 'idx', X(0) + 0.6, Y(33));
  say('漸進比較快 ≠ 小 n 比較快', 'Karatsuba 多了加減法，常數比較大（示意）');
  await beat(tok, 2800);
  const fN = (L) => 2 * L, fK = (L) => 4 + Math.log2(3) * L;
  let pa = 0;
  await anim(tok, 1800, (t) => { const L = 16 * t; line(X(pa), Y(fN(pa)), X(L), Y(fN(L)), 0, RD); line(X(pa), Y(fK(pa)), X(L), Y(fK(L)), 0, GR); pa = L; });
  tag('naive n²', 'ptr', X(14.2), Y(fN(16)) + 0.2); tag('Karatsuba c·n^1.58', 'ptr alt', X(12.8), Y(fK(16)) - 0.7);
  const Lc = 4 / (2 - Math.log2(3));
  const dot = cube('', YE, [0.25, 0.25, 0.25], X(Lc), Y(fN(Lc)), 0); glow(dot, GOLD);
  tag('交叉點', 'idx', X(Lc), Y(fN(Lc)) + 0.5);
  say('交叉點左邊 naive 反而快', '用 Python 實作，n 要非常大才贏');
  await beat(tok, 3200);
  box('Python：n 小用 naive，n 大切 Karatsuba', 2.2, 1.6, 1.5, 5.4, MINT, 1);
  say('Python 長整數：n 夠大才換演算法', '自己寫也可以做 adaptive 切換');
  await beat(tok, 3000);
  box('Schönhage-Strassen：FFT', 2.2, 2.4, 1.5, 5.4, PAPER, 1);
  say('Schönhage-Strassen 用 FFT', 'Θ(n log n log log n)，幾乎線性');
  await beat(tok, 3000);
  say('GMPY 套件裡都有實作', 'naive、Karatsuba、Toom-3、FFT');
  await beat(tok, 2600);
}]);

// 23:19 高精度除法：a/b = a·(1/b)，先算 ⌊R/b⌋，R = 2ᵏ → 除以 R 只是 shift
FRAG.push(['dcmit2-shift-div', '除以 R = 2ᵏ：只是 shift', async (tok) => {
  fresh([0, 4, 12.5], [0, 3, 0]);
  box('a / b = a × (1/b)', -2.6, 6, 0, 3.6, PAPER, 1);
  box('1/b ≈ ⌊R/b⌋ / R', 2.2, 6, 0, 3.2, MINT, 1);
  say('先求倒數，再乘 a', 'R 很大，而且很好除');
  await beat(tok, 3000);
  const bits = '11001100110011'.split('');
  tag('⌊2¹⁶/5⌋ = 13107 =', 'ptr alt', -2.6, 4.6, 0);
  const cs = bits.map((b, i) => dig(b, -3.1 + (i + 2) * 0.55, 3.6, 0, b === '1' ? B2 : PAPER, 1));
  say('R = 2ᵏ：例如 R = 2¹⁶、b = 5', '13107 寫成二進位');
  await beat(tok, 2800);
  const pt = tag('.', 'ptr', -3.1 + 15.75 * 0.55, 3.35, 0.3);
  say('除以 2¹⁶ = 小數點左移 16 位', '');
  await anim(tok, 2000, (t) => { pt.position.x = -3.1 + (15.75 - 16 * t) * 0.55; });
  dig('0', -3.1, 3.6, 0, PAPER, 1); dig('0', -3.1 + 0.55, 3.6, 0, PAPER, 1);
  tag('0.0011001100110011₂ ≈ 0.2 = 1/5', 'ptr alt', 0.6, 2.6, 0);
  say('shift 就得到 1/b 的高精度表示', '不需要真的做除法');
  await beat(tok, 3200);
  box('72 ÷ 100 = 0.72', 0, 1.2, 1.2, 3.4, PAPER, 1);
  say('十進位也一樣：除以 10ᵏ', '只是移動小數點');
  await beat(tok, 2600);
  say('剩下的問題：怎麼算 R/b？', '→ 再用一次 Newton');
  await beat(tok, 2400);
  void cs;
}]);

// 26:59 f(x) = 1/x − b/R → x_{i+1} = 2x_i − b·x_i²/R：只要乘法
FRAG.push(['dcmit2-recip-derive', 'Newton 求 R/b：只剩乘法', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.2, 0]);
  const cd = code(['f(x) = 1/x − b/R     根在 x = R/b', 'f′(x) = −1/x²', 'x_{i+1} = x_i − f(x_i)/f′(x_i)', '  = x_i + x_i²(1/x_i − b/R)', '  = 2x_i − b·x_i²/R'], -1.8, 6.6, 0.6);
  cd.hl(0); say('設計 f：根正好是 R/b', 'f(x) = 1/x − b/R');
  await beat(tok, 3000);
  cd.hl(1); say('微分：f′(x) = −1/x²', '');
  await beat(tok, 2400);
  cd.hl(2); say('切線和 x 軸交點 = 下一個猜測', 'x_{i+1} = x_i − f(x_i)/f′(x_i)');
  await beat(tok, 2800);
  cd.hl(3); say('代入化簡', '');
  await beat(tok, 2200);
  cd.hl(4); say('結果：2x_i − b·x_i²/R', '這行是關鍵');
  await beat(tok, 2800);
  const ops = [['2x_i：乘 2（shift）', MINT], ['x_i²：乘法', OR], ['b·(…)：乘法', OR], ['÷R：shift', MINT]];
  for (let k = 0; k < ops.length; k++) { box(ops[k][0], -4.2 + k * 2.8, 1.6, 1, 2.6, ops[k][1], 1.2); await beat(tok, 700); }
  say('每一步不是很簡單，就是乘法', '除法 = 反覆做乘法的迭代');
  await beat(tok, 3400);
}]);

// 36:00 除法複雜度粗估：log d 次 × 每次 n^α → O(n^α log n)，對但不緊
FRAG.push(['dcmit2-div-naive', '除法粗估：log n · n^α', async (tok) => {
  fresh([0, 4.2, 13], [0, 3, 0]);
  tag('除法：quadratic convergence', 'ptr alt', -2.5, 6.6, 0);
  say('除法也是平方收斂', '位數每步翻倍 → d 位要 log d 次');
  await beat(tok, 2800);
  tag('乘法 Θ(n^α)，α ≥ 1', 'ptr', 2.8, 6.6, 0);
  say('乘法寫成 Θ(n^α)', 'Toom-3 時 α = 1.465');
  await beat(tok, 2600);
  for (let k = 0; k < 6; k++) { const b = bar(RD, -4.5 + k * 0.9, 0, 0.7); setBar(b, 4.2); tag('n^α', 'idx', -4.5 + k * 0.9, 4.6, 0); await beat(tok, 260); }
  tag('log n 次迭代', 'idx', -2.25, 0, 1.2);
  say('每次都當 n 位乘法來算', '除法 = O(log n · n^α)');
  await beat(tok, 3000);
  say('Big O 是對的，但不夠緊', '');
  await beat(tok, 2400);
  box('build max heap：n log n → Θ(n)', 3.4, 3.6, 0, 4.4, PAPER, 1);
  say('像 build max heap：細算更緊', '當一次「bank accountant」');
  await beat(tok, 3000);
  box('初始猜測只有 1 位精度', 3.4, 2.4, 0, 4.4, MINT, 1);
  say('關鍵：一開始只有 1 位精度', '前面的乘法根本不用 d 位');
  await beat(tok, 3000);
}]);

// ═════════════ Rec12：JRgIXyEPnbA ═════════════

// 01:26 小學乘法：1234 × 5678，n 個部分積、每個 n 位 → n²
FRAG.push(['dcmit2-gradeschool', '小學直式乘法：1234 × 5678', async (tok) => {
  fresh([0, 4.2, 12], [0, 3.6, 0]);
  const S = 0.55, R0 = 3.4, put = (s, y, col, drop = 0, z = 0) => s.split('').map((c, i, a) => dig(c, R0 - (a.length - 1 - i) * S, y, 0, i >= a.length - z ? MINT : col, drop));
  put('1234', 6.6, B2); const m = put('5678', 6.0, P2); tag('×', 'ptr', R0 - 4.5 * S, 6.0);
  line(R0 - 7 * S, 5.6, R0 + 0.4, 5.6);
  say('小學乘法：1234 × 5678', '一次拿第二個數的一位去乘');
  await beat(tok, 2600);
  const rows = [['9872', 0, 8], ['8638', 1, 7], ['7404', 2, 6], ['6170', 3, 5]];
  for (let k = 0; k < 4; k++) {
    const [p, z, d] = rows[k]; glow(m[3 - k], GOLD);
    const y = 5.1 - k * 0.6; put(p + '0'.repeat(z), y, PAPER, 1, z);
    say('1234 × ' + d + ' = ' + p + (z ? '，補 ' + z + ' 個 0' : ''), '');
    await beat(tok, 1700); glow(m[3 - k], null);
  }
  line(R0 - 7 * S, 2.6, R0 + 0.4, 2.6);
  put('7006652', 2.2, GR, 1);
  say('部分積加起來 = 7006652', '');
  await beat(tok, 2600);
  tag('n 個部分積 × 每個 n 位', 'ptr alt', -4, 4.2, 0);
  say('n 位 × n 位：n 個部分積', '加 n 個 O(n) 位的數 → Θ(n²)');
  await beat(tok, 3400);
}]);

// 04:35 Karatsuba：n 位拆成兩個 n/2，3 次乘法 + 加法 → n^(log₂3)
FRAG.push(['dcmit2-karat-split', 'Karatsuba：拆半、3 次乘法', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.2, 0]);
  const x = box('n 位', -3, 6.2, 0, 3.6, B1, 1), y = box('n 位', 2.2, 6.2, 0, 3.6, P1, 1);
  say('兩個 n 位數相乘', '');
  await beat(tok, 2200);
  kill(x); kill(y);
  box('n/2', -3.9, 6.2, 0, 1.75, B1); box('n/2', -2.1, 6.2, 0, 1.75, B2);
  box('n/2', 1.3, 6.2, 0, 1.75, P1); box('n/2', 3.1, 6.2, 0, 1.75, P2);
  say('各拆成兩個 n/2 位', '');
  await beat(tok, 2400);
  for (let k = 0; k < 3; k++) { box('n/2 × n/2', -3.6 + k * 3.6, 4.6, 0, 2.6, OR, 1.2); await beat(tok, 600); }
  box('+ − 幾次加減法：O(n)', 0, 3.6, 0, 4.6, MINT, 1);
  say('只用 3 次乘法 + 一些加法', '乘法貴、加法便宜');
  await beat(tok, 3000);
  say('T(n) = 3T(n/2) + O(n)', '= Θ(n^(log₂3))');
  await beat(tok, 2800);
  line(-5, 1.6, 5, 1.6, 0, BROWN);
  for (const [v, s] of [[1, '1'], [1.5, '1.5'], [2, '2']]) tag(s, 'idx', -5 + (v - 1) * 10, 1.2);
  const d = cube('', GR, [0.3, 0.3, 0.3], -5 + (Math.log2(3) - 1) * 10, 1.6, 0); glow(d, GREEN);
  tag('log₂3 ≈ 1.585', 'ptr alt', -5 + (Math.log2(3) - 1) * 10, 2.2);
  say('log₂3 介於 1.5 和 2 之間', '不是革命性的，但比 n² 快');
  await beat(tok, 3200);
}]);

// 06:01 A B C D：(10^{n/2}A + B)(10^{n/2}C + D) 有 4 個乘法；乘 10ⁿ 只是補 0
FRAG.push(['dcmit2-abcd', 'A B C D：硬算要 4 次乘法', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.2, 0]);
  const A = box('A', -4, 6.4, 0, 1.6, B1, 1), B = box('B', -2.4, 6.4, 0, 1.6, B2, 1), C = box('C', 1.2, 6.4, 0, 1.6, P1, 1), D = box('D', 2.8, 6.4, 0, 1.6, P2, 1);
  tag('×', 'ptr', -0.6, 6.4);
  say('左半 A、右半 B；左半 C、右半 D', 'x = 10^(n/2)·A + B');
  await beat(tok, 3000);
  tag('xy = 10ⁿ·AC + 10^(n/2)·(AD + BC) + BD', 'ptr alt', -0.4, 5.3);
  say('展開（以 10 為基底）', '');
  await beat(tok, 2600);
  const cnt = tag('乘法 0 次', 'ptr alt', 4.8, 4.4);
  const P = [[A, C, 'AC'], [A, D, 'AD'], [B, C, 'BC'], [B, D, 'BD']];
  for (let k = 0; k < 4; k++) {
    const [p, q, t] = P[k]; glow(p, GOLD); glow(q, GOLD);
    box(t, -4.5 + k * 1.9, 4.2, 0, 1.6, OR, 1); txt(cnt, '乘法 ' + (k + 1) + ' 次');
    await beat(tok, 900); glow(p, null); glow(q, null);
  }
  say('4 次 n/2 位乘法', 'T_bad(n) = 4T(n/2) + O(n) = Θ(n²)');
  await beat(tok, 3000);
  const ds = '1234'.split('').map((c, i) => dig(c, -3 + i * 0.55, 2.4, 0.8, B2));
  say('乘 10ⁿ 不是真的乘法', 'Python list 後面 append n 個 0');
  await beat(tok, 2000);
  for (let k = 0; k < 4; k++) { dig('0', -0.8 + k * 0.55, 2.4, 0.8, MINT, 1); await beat(tok, 300); }
  tag('O(n)：算加法等級', 'idx', 1.8, 1.7, 0.8);
  say('補 0 是 O(n)：免費', '貴的只有那 4 次乘法');
  await beat(tok, 2800);
  tag('Karatsuba：3 次（不是這裡的其中 3 個）', 'ptr', 0, 0.8, 1);
  say('Karatsuba 找到只要 3 次的做法', '4 和 3 的差別很重要');
  await beat(tok, 3000);
  void ds;
}]);

// 11:18 Newton：找 f 的根；初始猜測 → 切線 → 和 x 軸交點 → 再來一次
FRAG.push(['dcmit2-tangent-walk', 'Newton：切線一路逼近根', async (tok) => {
  fresh([0, 3.6, 12.5], [0, 2.8, 0]);
  const f = (x) => x * x / 2 - 2, df = (x) => x, X = (x) => -5.5 + x * 2.6, Y = (y) => 1.6 + y * 0.62;
  line(X(0), Y(0), X(4.5), Y(0), 0, BROWN); tag('x', 'idx', X(4.6), Y(0));
  curve(f, 0.3, 4.3, X, Y);
  tag('f(x)', 'ptr', X(4.2), Y(f(4.2)) + 0.4);
  tag('根 x₀：f(x₀) = 0', 'idx', X(2), Y(0) - 0.45);
  say('Newton：找函數的根', '先把答案設計成某個 f 的根');
  await beat(tok, 3000);
  let x = 4; const dot = cube('', YE, [0.25, 0.25, 0.25], X(x), Y(0), 0); glow(dot, GOLD);
  tag('初始猜測', 'ptr alt', X(x), Y(0) - 0.45);
  say('從初始猜測出發', '不用準，但不能差太遠');
  await beat(tok, 2600);
  for (let k = 0; k < 3; k++) {
    const nx = x - f(x) / df(x);
    line(X(x), Y(0), X(x), Y(f(x)), 0, '#a99470');
    move(dot, X(x), Y(f(x)), 0);
    await beat(tok, 700);
    const t0 = nx - 0.25, t1 = Math.min(4.4, x + 0.3);
    line(X(t0), Y(f(x) + df(x) * (t0 - x)), X(t1), Y(f(x) + df(x) * (t1 - x)), 0, '#1f3a6e');
    say(k ? '再畫切線、再找交點' : '用切線近似函數', k ? '' : '函數若是直線，一步就到');
    await beat(tok, 1200);
    move(dot, X(nx), Y(0), 0);
    say('切線和 x 軸交點 = 下一個猜測', 'x = ' + nx.toFixed(4));
    await beat(tok, 1600);
    x = nx;
  }
  say('一次比一次接近根', '而且接近得很快');
  await beat(tok, 2800);
}]);

// 13:56 推導：tan α = f(x)/(x − x′) = f′(x) → x′ = x − f(x)/f′(x)
FRAG.push(['dcmit2-triangle', '切線三角形：x′ = x − f(x)/f′(x)', async (tok) => {
  fresh([0, 3.6, 12], [0, 2.8, 0]);
  const f = (x) => x * x / 2 - 2, X = (x) => -5.5 + x * 2.6, Y = (y) => 1.2 + y * 0.72;
  line(X(0.8), Y(0), X(4.6), Y(0), 0, BROWN);
  curve(f, 1.2, 4.4, X, Y);
  const x = 4, xp = 2.5;
  line(X(xp), Y(0), X(x), Y(f(x)), 0, '#1f3a6e');
  const v = cube('', RD, [0.08, Y(f(x)) - Y(0), 0.08], X(x), (Y(0) + Y(f(x))) / 2, 0);
  const h = cube('', B1, [X(x) - X(xp), 0.08, 0.08], (X(x) + X(xp)) / 2, Y(0), 0);
  tag('x', 'ptr alt', X(x), Y(0) - 0.45); tag("x′", 'ptr alt', X(xp), Y(0) - 0.45);
  say('目前猜 x，下一個猜 x′', '');
  await beat(tok, 2600);
  glow(v, RED); tag('f(x)', 'ptr', X(x) + 0.7, (Y(0) + Y(f(x))) / 2);
  say('直角三角形：高 = f(x)', '');
  await beat(tok, 2200);
  glow(h, GOLD); tag("x − x′", 'ptr', (X(x) + X(xp)) / 2, Y(0) + 0.45);
  say("底 = x − x′", '');
  await beat(tok, 2200);
  tag('α', 'idx', X(xp) + 0.6, Y(0) + 0.25);
  say('tan α = 切線斜率 = f′(x)', "tan α = f(x) / (x − x′)");
  await beat(tok, 3000);
  const cd = code(["f′(x) = f(x) / (x − x′)", "x′ = x − f(x) / f′(x)"], -3.2, 6.6, 0.6);
  cd.hl(1); say('解出 x′', "x′ = x − f(x)/f′(x)");
  await beat(tok, 3000);
  const w = tag("✗ x′ = x + f(x)/f′(x)", 'ptr', 3.2, 6.6); w.element.style.textDecoration = 'line-through';
  say('老師一度寫錯符號', '順著導數走會離解越來越遠');
  await beat(tok, 3000);
  arrow(V3(X(x), Y(0) + 0.9, 0.4), V3(X(xp) + 0.2, Y(0) + 0.9, 0.4), 0x0f5a3a);
  say('記法：逆著導數走', '從 x 減掉一個量');
  await beat(tok, 2800);
}]);

// 20:38 用 Newton 算 a/b：先改成 1/b；R = 10^d，Python list 補 0 = 乘 R、slice = 除 R
FRAG.push(['dcmit2-list-shift', 'R = 10^d：補 0 與 slice', async (tok) => {
  fresh([0, 4.2, 12.5], [0, 3.2, 0]);
  box('需要：f(a/b) = 0', -3, 6.4, 0, 3.4, PAPER, 1); box('f/f′ 不能用到除法', 2.2, 6.4, 0, 3.4, PAPER, 1);
  say('用 Newton 算 a/b 的兩個條件', '答案是根；f/f′ 不靠除法算得出來');
  await beat(tok, 3200);
  box('a/b = a × (1/b)', -0.4, 5.3, 0, 3.6, MINT, 1);
  say('先簡化成算 1/b，再乘 a', '');
  await beat(tok, 2400);
  tag('1/b = 0.xxxx… 不是整數', 'ptr', -3, 4.3);
  tag('R/b = 10^d / b：小數點右移 d 位', 'ptr alt', 2.4, 4.3);
  say('只用整數：乘上 R = 10^d', 'a/b = (R/b) · a / R');
  await beat(tok, 3200);
  const ds = '1234'.split('').map((c, i) => dig(c, -4.4 + i * 0.6, 2.8, 0, B2, 1));
  tag('Python list', 'idx', -5.4, 2.1);
  say('數字存成一串 digit', '');
  await beat(tok, 1800);
  const zs = [];
  for (let k = 0; k < 3; k++) { zs.push(dig('0', -2 + k * 0.6, 2.8, 0, MINT, 1)); await beat(tok, 350); }
  tag('append d 個 0 = × 10^d', 'ptr alt', -1.4, 1.9);
  say('append d 個 0 = 乘 R', '');
  await beat(tok, 2400);
  for (let k = 0; k < 3; k++) { kill(zs[k]); await beat(tok, 250); }
  for (let k = 1; k < 4; k++) { kill(ds[k]); await beat(tok, 250); }
  tag('slice 掉最後 d 位 = ÷ 10^d', 'ptr', 3, 1.1);
  say('slice 掉最後 d 位 = 除 R', '1234 → 1（÷ 10³）');
  await beat(tok, 3000);
  say('乘 R、除 R 都很便宜', '');
  await beat(tok, 2200);
}]);

// 25:24 選函數：x − R/b 行不通；1/x − b/R → x′ = 2x − b·x²/R
FRAG.push(['dcmit2-two-funcs', '選 f：x − R/b 不行，1/x − b/R 可以', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.2, 0]);
  const c1 = code(['f(x) = x − R/b', 'f′(x) = 1', 'f/f′ = x − R/b'], -3.6, 6.4, 0.6);
  say('先試 f(x) = x − R/b', '根確實是 R/b');
  await beat(tok, 2800);
  c1.hl(2); say('可是 f/f′ 要先知道 R/b', '能算它就已經有答案了');
  await beat(tok, 3000);
  const bad = box('✗ 不能用', -3.6, 4.2, 0, 2.6, RD, 1); glow(bad, RED);
  await beat(tok, 1600);
  const c2 = code(['f(x) = 1/x − b/R', 'f′(x) = −1/x²', 'f/f′ = −x + b·x²/R', "x′ = x − f/f′ = 2x − b·x²/R"], 2.4, 6.4, 0.6);
  say('改試 f(x) = 1/x − b/R', 'b/R 是好算的除法');
  await beat(tok, 3000);
  c2.hl(2); say('f/f′ = −x + b·x²/R', '');
  await beat(tok, 2600);
  c2.hl(3); say("x′ = 2x − b·x²/R", '');
  await beat(tok, 2800);
  const ok = box('✓ 唯一的除法是 ÷R = shift', 2.4, 3.4, 0, 4.4, GR, 1); glow(ok, GREEN);
  say('剩下的只有乘法（Karatsuba）', '用除法解除法行不通');
  await beat(tok, 3200);
}]);

// 30:27 ∛a 到 d 位：算 ∛(10^{3d}·a)；f = x³ − a → x′ = (2/3)x + (1/3)·a/x²
FRAG.push(['dcmit2-cuberoot', '∛a：f(x) = x³ − a', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.2, 0]);
  box('∛a 到 d 位精度', -3, 6.4, 0, 3.2, PAPER, 1);
  say('換個例子：三次方根', '∛2 會小於 2，有小數');
  await beat(tok, 2600);
  const t = box('10^d · ∛a = ∛(10^{3d} · a)', 2, 6.4, 0, 4.6, MINT, 1); glow(t, GOLD);
  say('10^d 搬進根號要變 10^{3d}', '別忘了這個 3');
  await beat(tok, 3200);
  const cd = code(['f(x) = x³ − a', 'f′(x) = 3x²', "x′ = x − (x³ − a)/(3x²)", '   = (2x³ + a)/(3x²)', '   = (2/3)·x + (1/3)·a/x²'], -1.6, 4.8, 0.6);
  cd.hl(0); say('把 10^{3d}·a 當新的 a（整數）', 'f(x) = x³ − a');
  await beat(tok, 2800);
  cd.hl(1); say("f′(x) = 3x²", '');
  await beat(tok, 2000);
  cd.hl(2); say('代進 Newton', '');
  await beat(tok, 2200);
  cd.hl(3); say('通分', '');
  await beat(tok, 2200);
  cd.hl(4); say('a/x² 要除法', '前面已經做好除法了，可以用');
  await beat(tok, 3000);
  box('整數結果右移 d 位 → d 位精度', 0, 1.0, 1, 5, PAPER, 1);
  await beat(tok, 2600);
}]);

// 35:22 初始猜測：n 位的 a → 根約 n/3 位；第一位用查表或對一位做 binary search
FRAG.push(['dcmit2-init-guess', '初始猜測：位數 + 第一位', async (tok) => {
  fresh([0, 4.2, 13], [0, 3.2, 0]);
  const ds = '2000000000'.split('').map((c, i) => dig(c, -4.6 + i * 0.6, 6.4, 0, i ? PAPER : B2, 1));
  tag('a = 2·10⁹（n = 10 位，示意）', 'ptr', 2.6, 5.7);
  say('a 有 n 位：d₁ d₂ … dₙ', '');
  await beat(tok, 2600);
  tag('∛a ≈ 1 · 10^{n/3}：位數約 n/3', 'ptr alt', -1.5, 4.9);
  say('立方根的位數約 n/3', '先猜 1·10^{n/3}：數量級對了');
  await beat(tok, 3200);
  const cs = []; for (let d = 0; d <= 9; d++) cs.push(dig(String(d), -4.4 + d * 0.9, 3.3, 0, PAPER, 1, 0.7));
  say('再猜第一位：小基底可以查表', '基底 2¹⁶ 就對一位做 binary search');
  await beat(tok, 3000);
  const ptr = tag('猜', 'ptr alt', -4.4, 4.0);
  const T = [[5, '5000³ = 1.25·10¹¹ > a，太大'], [2, '2000³ = 8·10⁹ > a，太大'], [1, '1000³ = 10⁹ ≤ a ✓']];
  for (const [d, s] of T) {
    ptr.position.x = -4.4 + d * 0.9; glow(cs[d], GOLD);
    say('猜 ' + d + '：自乘三次比大小', s);
    await beat(tok, 2200);
    if (d !== 1) { glow(cs[d], null); tint(cs[d], RD); for (let e = d; e <= 9; e++) if (e > d) tint(cs[e], '#bbb'); }
    else tint(cs[d], GR);
  }
  box('初始猜測 x = 1000', 0, 1.6, 1, 3.6, MINT, 1);
  say('有了數量級和第一位', '交給 Newton，收斂快得多');
  await beat(tok, 3000);
  say('小數字別用複雜演算法', '像開坦克去釘釘子');
  await beat(tok, 2600);
  void ds;
}]);

// 43:58 什麼時候停：整數迭代到 x 不再改變
FRAG.push(['dcmit2-cube-iter', '整數迭代：x 不變就停', async (tok) => {
  fresh([0, 4, 12.5], [0, 3, 0]);
  tag("x′ = ⌊(2x + ⌊a/x²⌋) / 3⌋", 'ptr alt', 0, 6.6);
  tag('a = 2·10⁹（∛2，d = 3）', 'idx', 0, 6.0);
  say('只用整數做 Newton', '多出來的位數自動被丟掉');
  await beat(tok, 2800);
  const xs = [1000, 1333, 1263, 1259, 1259], H = (v) => (v - 900) / 450 * 4.4;
  for (let k = 0; k < xs.length; k++) {
    const b = bar(k === 4 ? GR : k === 3 ? YE : B1, -4.4 + k * 2.2, 0, 1.1); setBar(b, H(xs[k]));
    tag('x' + '₀₁₂₃₄'[k] + ' = ' + xs[k], 'idx', -4.4 + k * 2.2, H(xs[k]) + 0.35);
    say(k ? 'x' + '₀₁₂₃₄'[k] + ' = ' + xs[k] : '初始猜測 x₀ = 1000', k === 4 ? 'x₄ = x₃：不會再變了' : '');
    await beat(tok, 1700);
  }
  say('x 不再改變 → 停', '已經有 d 位精度');
  await beat(tok, 2800);
  box('1259 → 右移 3 位 → 1.259', 0, 5.2, 1, 4.6, MINT, 1);
  say('∛2 ≈ 1.259', '');
  await beat(tok, 2600);
}]);

// 45:34 誤差：x_i = x(1 + ε_i)，ε_{i+1} ≈ ε_i²；0 的個數每步翻倍 → log d 步
FRAG.push(['dcmit2-eps-zeros', 'ε 平方：0 的個數每步翻倍', async (tok) => {
  fresh([0, 4.2, 13], [0, 3.2, 0]);
  tag('x_i = x(1 + ε_i)', 'ptr', -3.4, 6.6); tag('ε_{i+1} ≈ ε_i²', 'ptr alt', 2.6, 6.6);
  say('x 是真正答案，ε_i 是誤差', '要讓 1 + ε_i → 1');
  await beat(tok, 3000);
  const E = ['0.1', '0.01', '0.0001', '0.00000001'];
  for (let k = 0; k < 4; k++) {
    const y = 5.4 - k * 0.8, s = E[k].split('');
    tag('step ' + k, 'idx', -6, y);
    s.forEach((c, i) => dig(c, -4.8 + i * 0.5, y, 0, c === '1' ? OR : c === '.' ? '#fff' : MINT, 0.8));
    say(k ? '再平方：' + E[k] : 'ε₀ = 0.1', '小數點後 ' + Math.pow(2, k) + ' 位');
    await beat(tok, 1600);
  }
  say('第 i 步約有 2^i 位正確', '');
  await beat(tok, 2600);
  tag('x_{i+1} − x_i = x(ε_{i+1} − ε_i)', 'ptr', 2.8, 4.4);
  say('相鄰兩次的差', '整數取 floor 變 0 就停');
  await beat(tok, 3000);
  const d = []; for (let k = 0; k < 8; k++) d.push(dig('d', 1.2 + k * 0.5, 2.8, 0, B2));
  tag('x 有 d 位', 'idx', 3, 2.2);
  say('ε 的 0 夠多就抵掉 x 的 d 位', '0 每步翻倍 → 約 log d 步');
  for (let k = 0; k < 8; k++) { tint(d[k], '#bbb'); await beat(tok, 260); }
  await beat(tok, 2600);
}]);

// 51:50 問答：對整個答案 binary search 要 log(10^d) ≈ d 步；Newton 只要 log d 步
FRAG.push(['dcmit2-bs-vs-newton', 'Binary search 整個答案 vs Newton', async (tok) => {
  fresh([0, 4, 12.5], [0, 2.8, 0]);
  say('對整個 d 位答案做 binary search？', 'log(10^d) = Θ(d) 步');
  await beat(tok, 3000);
  const D = [10, 100, 1000];
  for (let k = 0; k < 3; k++) {
    const bs = D[k] * Math.log2(10), nw = Math.log2(D[k]), x = -4 + k * 3.6;
    const b1 = bar(RD, x - 0.5, 0, 0.8), b2 = bar(GR, x + 0.5, 0, 0.8);
    setBar(b1, Math.log10(bs) * 1.5); setBar(b2, Math.log10(nw) * 1.5 + 0.1);
    tag(String(Math.round(bs)), 'idx', x - 0.5, Math.log10(bs) * 1.5 + 0.35); tag(nw.toFixed(1), 'idx', x + 0.5, Math.log10(nw) * 1.5 + 0.45);
    tag('d = ' + D[k], 'ptr', x, 0, 1.3);
    await beat(tok, 900);
  }
  tag('紅：binary search ≈ 3.3d　綠：Newton ≈ log₂ d（對數刻度）', 'idx', 0, 5.6);
  say('d 是位數，不是數字本身', '數字 N：Newton 約 log log N 步');
  await beat(tok, 3400);
  say('binary search 只用來猜第一位', '之後交給 Newton');
  await beat(tok, 2800);
}]);
  }

  // ═══ sortbari.js ═══
  {
// ds-8 unpacks colorFor from ctx at module level; alg-2 does not, so take it here.
const colorFor = ctx.colorFor;
const { V3, fresh, tag, cube, move, kill, glow, tint, code, ghostBox, GOLD, GREEN, GRAY } = K;
// ─── mB5HXBb_HY8：Abdul Bari〈Merge Sort〉、7h1s2SojIRw：Abdul Bari〈Quick Sort〉 ───
// Merge sort 的例子：索引 1..8 = 9 3 7 5 6 4 8 2（mid = ⌊(l+h)/2⌋，7 次 merge 依 post-order 編號）。
// Quick sort 的例子：10 16 8 12 15 6 3 9 5，尾端放 ∞；pivot = A[l]，i 找 > pivot、j 找 ≤ pivot，
// 交錯後 A[l] ↔ A[j]（第一次 partition → 6 5 8 9 3 10 15 12 16），之後 QuickSort(l, j)、QuickSort(j+1, h)。
const SB_M = [9, 3, 7, 5, 6, 4, 8, 2];
const SB_Q = [10, 16, 8, 12, 15, 6, 3, 9, 5, Infinity];
const sbS = (v) => (v === Infinity ? '∞' : String(v));
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
// top-down merge sort trace on 9 3 7 5 6 4 8 2; mode 'idx' shows (low, high) of every call
async function sbTrace(tok, mode, ms) {
  const vals = SB_M.slice(); let merges = 0;
  const idx = mode === 'idx';
  const rng = (l, h, g) => { if (idx) tag('(' + (l + 1) + ',' + (h + 1) + ')', 'idx', (sbX(l, g) + sbX(h, g)) / 2, SB_Y[g] - 0.55, 0); };
  const root = vals.map((v, k) => sbCube(v, k, 8)); rng(0, 7, 8);
  async function rec(l, h, nodes) {
    const g = h - l + 1;
    if (g === 1) {
      glow(nodes[0], GREEN);
      say(idx ? '(' + (l + 1) + ',' + (l + 1) + ')：l = h，一個元素' : vals[l] + '：只剩一個元素', '一個元素就是排好的串列');
      await beat(tok, ms * 0.6); glow(nodes[0], null);
      return nodes;
    }
    const m = (l + h) >> 1;
    nodes.forEach((n) => tint(n, GRAY));
    say(idx ? 'MergeSort(' + (l + 1) + ', ' + (h + 1) + ')：mid = ' + (m + 1) : '切開：' + vals.slice(l, m + 1).join(' ') + ' | ' + vals.slice(m + 1, h + 1).join(' '),
      idx ? 'mid = (' + (l + 1) + ' + ' + (h + 1) + ') / 2 = ' + (m + 1) + '：先做左半，右半等一下' : '先處理左半，右半等一下');
    await beat(tok, ms);
    const L = []; for (let k = l; k <= m; k++) L.push(sbCube(vals[k], k, g / 2, 0.8)); rng(l, m, g / 2);
    await beat(tok, ms * 0.5);
    const Ls = await rec(l, m, L);
    const R = []; for (let k = m + 1; k <= h; k++) R.push(sbCube(vals[k], k, g / 2, 0.8)); rng(m + 1, h, g / 2);
    say(idx ? '左半完成，換右半 (' + (m + 2) + ',' + (h + 1) + ')' : '左半排好了，換右半', '');
    await beat(tok, ms * 0.6);
    const Rs = await rec(m + 1, h, R);
    merges++;
    nodes.forEach(kill);
    const res = Ls.concat(Rs).map((x) => x.userData.v).sort((a, b) => a - b);
    say('第 ' + merges + ' 次 merge → ' + res.join(' '), idx ? 'Merge(' + (l + 1) + ', ' + (m + 1) + ', ' + (h + 1) + ')' : 'post-order：左、右都好了才 merge（根）');
    const out = await sbMerge(tok, Ls, Rs, l, g, ms);
    tag('#' + merges, 'ptr alt', (sbX(l, g) + sbX(h, g)) / 2, SB_Y[g] + 0.55, 0);
    await beat(tok, ms * 0.5);
    return out;
  }
  return rec(0, 7, root);
}

// ── Merge Sort ──
// 00:00 divide and conquer：大問題拆開，一個元素就是「小問題」
FRAG.push(['sortbari-merge-dc', 'Divide and Conquer：拆到只剩一個元素', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  const ms = SB_M.map((v, k) => sbCube(v, k, 8, 1.2));
  say('Merge sort：recursive、divide and conquer', '問題大 → 拆成子問題；小 → 直接解；再合併');
  await beat(tok, 3200);
  say('問題：把 8 個元素排好', '8 個元素 → 大問題');
  await beat(tok, 2200);
  for (const g of [4, 2, 1]) {
    ms.forEach((m, k) => move(m, sbX(k, g), SB_Y[g], 0));
    say(g > 1 ? '還是大問題 → 再拆' : '拆到只剩一個元素', g > 1 ? '每段 ' + g + ' 個元素（兩個也算大）' : '一個元素 = 小問題，不用排');
    await beat(tok, 2200);
  }
  ms.forEach((m) => glow(m, GREEN));
  say('小問題的解，合併成大問題的解', '<span class="ok">一個元素本身就是排好的</span>');
  await beat(tok, 3000);
}]);

// 01:25 演算法 MergeSort(l, h)
FRAG.push(['sortbari-merge-code', 'MergeSort(l, h) 演算法', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  const C = code(['Algorithm MergeSort(l, h)', '{', '  if (l < h)', '  {', '    mid = (l + h) / 2;', '    MergeSort(l, mid);', '    MergeSort(mid + 1, h);', '    Merge(l, mid, h);', '  }', '}'], -3.4, 6.0, 0.5);
  const X = (k) => 0.9 + k * 0.72;
  const row = SB_M.map((v, k) => cube(v, colorFor(v), [0.55, 0.55, 0.55], X(k), 3.0, 0, 1.2));
  SB_M.forEach((v, k) => tag(String(k + 1), 'idx', X(k), 2.4, 0));
  C.hl(0);
  say('參數：串列的開頭 l、結尾 h', 'l = low　h = high');
  const lt = tag('l', 'ptr', X(0), 3.8, 0), ht = tag('h', 'ptr', X(7), 3.8, 0);
  await beat(tok, 3000);
  C.hl(2);
  say('l < h：至少兩個元素 → 大問題', 'l = h 表示只有一個元素，不用做');
  await beat(tok, 3200);
  C.hl(4);
  tag('mid', 'ptr alt', X(3), 4.4, 0); glow(row[3], GOLD);
  say('找中間：mid = (1 + 8) / 2 = 4', '整數除法：9 / 2 = 4');
  await beat(tok, 3000);
  C.hl(5);
  let z = ghostBox('#4b9ee2', 4 * 0.72, 0.9, 0.9); z.position.set((X(0) + X(3)) / 2, 3.0, 0);
  say('左半 1～4：遞迴 merge sort', 'MergeSort(1, 4)');
  await beat(tok, 2800);
  C.hl(6);
  const z2 = ghostBox('#dd8238', 4 * 0.72, 0.9, 0.9); z2.position.set((X(4) + X(7)) / 2, 3.0, 0);
  say('右半 5～8：遞迴 merge sort', 'MergeSort(5, 8)');
  await beat(tok, 2800);
  C.hl(7); glow(row[3], null);
  say('兩半都排好 → 合併', 'Merge(l, mid, h) = Merge(1, 4, 8)');
  await beat(tok, 3000);
  kill(lt); kill(ht);
  say('一個陣列裡同時放兩個串列', '[l..mid] 與 [mid+1..h]');
  await beat(tok, 3200);
}]);

// 04:19 追蹤（索引版）：7 次 merge
FRAG.push(['sortbari-merge-trace-idx', '追蹤 MergeSort(1, 8)：遞迴樹與 7 次 merge', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  say('MergeSort(1, 8)：9 3 7 5 6 4 8 2', 'low = 1、high = 8');
  await beat(tok, 2400);
  const out = await sbTrace(tok, 'idx', 620);
  out.forEach((m) => glow(m, GREEN));
  say('一路切到一個元素，再一路 merge', '<span class="ok">2 3 4 5 6 7 8 9</span>　共 7 次 merge');
  await beat(tok, 3200);
}]);

// 09:00 和 two-way merge sort 比較
FRAG.push(['sortbari-merge-twoway', 'Two-way merge sort vs merge sort', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  let cur = SB_M.map((v, k) => sbCube(v, k, 1, 1.0));
  tag('two-way（迭代）', 'ptr', -5.6, 6.6, 0);
  say('two-way merge sort：一輪一輪', '前兩個、下兩個、再下兩個……');
  await beat(tok, 2600);
  let pass = 0;
  for (const g of [2, 4, 8]) {
    pass++;
    const next = [];
    for (let lo = 0; lo < 8; lo += g) {
      const A = cur.slice(lo, lo + g / 2), B = cur.slice(lo + g / 2, lo + g);
      next.push(...await sbMerge(tok, A, B, lo, g, 360));
    }
    cur = next;
    say('第 ' + pass + ' 輪：每段 ' + g + ' 個', cur.map((m) => m.userData.v).join(' '));
    await beat(tok, 1800);
  }
  say('merge sort：遞迴，先左半、再右半', 'pattern 不同，合併方式一樣');
  await beat(tok, 3200);
  say('一樣一次合併兩個串列 → 也是 two-way', '因為是遞迴版，另外叫 merge sort');
  await beat(tok, 3200);
}]);

// 10:06 時間：每層 n 個、共 log n 層
FRAG.push(['sortbari-merge-levels', 'Merge sort 的時間：n × log n', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  const rows = { 1: SB_M, 2: [3, 9, 5, 7, 4, 6, 2, 8], 4: [3, 5, 7, 9, 2, 4, 6, 8], 8: [2, 3, 4, 5, 6, 7, 8, 9] };
  rows[1].forEach((v, k) => sbCube(v, k, 1, 0.8));
  say('從遞迴樹最下面開始 merge', '一個一個的元素');
  await beat(tok, 2600);
  let lv = 0;
  for (const g of [2, 4, 8]) {
    lv++;
    rows[g].forEach((v, k) => sbCube(v, k, g, 1.0));
    tag('8 個 = n', 'ptr alt', 5.6, SB_Y[g], 0);
    tag('第 ' + lv + ' 層', 'idx', -5.6, SB_Y[g], 0);
    say('這一層 merge 了 8 個元素', '每層 merge 的總量 = n');
    await beat(tok, 2600);
  }
  say('8 個元素 → 3 層 = log₂ 8', '1 → 2 → 4 → 8：每層加倍');
  await beat(tok, 3200);
  say('遞迴先左後右，不是一輪輪 pass', '但層數一樣是 log n');
  await beat(tok, 3000);
  say('n × log n', '<span class="ok">Θ(n log n)</span>');
  await beat(tok, 3000);
}]);

// 11:59 追蹤（數字版）：merge 在 post-order
FRAG.push(['sortbari-merge-trace-num', '用數字追蹤：merge 發生在 post-order', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  say('用數字再追一次：low 1、high 8', '9 3 7 5 6 4 8 2');
  await beat(tok, 2400);
  const out = await sbTrace(tok, 'num', 620);
  out.forEach((m) => glow(m, GREEN));
  say('呼叫自己兩次 → 追蹤樹是 binary tree', '<span class="ok">merge 的順序 = post-order</span>（左、右、根）');
  await beat(tok, 3400);
}]);

// 17:28 遞迴式與 master theorem
FRAG.push(['sortbari-merge-recurrence', 'T(n) = 2T(n/2) + n → Θ(n log n)', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  const C = code(['MergeSort(l, h)          T(n)', '{ if (l < h)', '  { mid = (l + h) / 2;     1', '    MergeSort(l, mid);     T(n/2)', '    MergeSort(mid + 1, h); T(n/2)', '    Merge(l, mid, h);      n', '  }', '}'], -3.0, 5.8, 0.55);
  C.hl(0);
  say('假設整個演算法花 T(n)', '用 recurrence relation 求時間');
  await beat(tok, 2800);
  C.hl(4);
  say('左右各一半：T(n/2) + T(n/2)', 'mid 只是常數，忽略');
  await beat(tok, 2800);
  C.hl(5);
  say('merge 兩個串列：共 n 個元素', 'Merge = n');
  await beat(tok, 2600);
  C.hl(-1);
  say('T(n) = 2T(n/2) + n（n > 1）', 'n = 1 時什麼都不做，寫常數 1');
  await beat(tok, 3000);
  const W = 4.4;
  for (let d = 0; d < 4; d++) {
    const cnt = 1 << d, w = W / cnt;
    for (let c = 0; c < cnt; c++) cube(null, '#4b9ee2', [w - 0.1, 0.35, 0.5], 4.0 - W / 2 + w * (c + 0.5), 5.4 - d * 1.0, 0, 0.6);
    tag('n', 'ptr alt', 6.6, 5.4 - d * 1.0, 0);
    await beat(tok, 500);
  }
  tag('log n 層', 'idx', 4.0, 1.6, 0);
  say('Master theorem：a = 2、b = 2', 'f(n) = n = n^k，k = 1');
  await beat(tok, 3000);
  say('log_b a = log₂ 2 = 1 = k → case 2', 'case 2：f(n) 乘上 log n');
  await beat(tok, 3200);
  say('Merge sort 的時間', '<span class="ok">Θ(n log n)</span>');
  await beat(tok, 3000);
}]);

// ── Quick Sort ──
// a floor row of value cubes with i / j / l / h pointers
function sbRow(vals, o = {}) {
  const dx = o.dx || 1.1, z = o.z || 0, y = 0.5, n = vals.length, x0 = -(n - 1) * dx / 2;
  const R = { v: vals.slice(), m: [], dx, z, y };
  R.x = (i) => x0 + i * dx;
  for (let i = 0; i < n; i++) ctx.tile(V3(R.x(i), 0.02, z), dx * 0.9, 1.0);
  vals.forEach((v, i) => { R.m[i] = cube(sbS(v), v === Infinity ? '#d8cfc0' : colorFor(v), [0.8, 0.8, 0.8], R.x(i), y, z, o.drop ? 2.2 : 0); });
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
// Bari's partition(l, h): h is the sentinel slot (∞ or an earlier pivot); returns j
async function sbPart(tok, R, l, h, o = {}) {
  const ms = o.ms || 800, hl = o.code ? (k) => o.code.hl(k) : () => {}, p = R.v[l];
  let i = l, j = h;
  glow(R.m[l], GOLD);
  const pt = R.ptr('pivot', 'ptr alt', l, 2.6), it = R.ptr('i', 'ptr', i, 1.3), jt = R.ptr('j', 'ptr', j, 1.9);
  hl(1); say('pivot = A[l] = ' + p, 'i = l、j = h　' + R.str());
  await beat(tok, ms);
  while (i < j) {
    hl(2); hl(3);
    do { i++; R.at(it, i, 1.3); glow(R.m[i], '#1f3a6e'); await beat(tok, ms * 0.35); glow(R.m[i], null); } while (R.v[i] <= p);
    say('i 停在 ' + sbS(R.v[i]) + '（> ' + p + '）', R.str());
    await beat(tok, ms * 0.5);
    hl(4);
    do { j--; R.at(jt, j, 1.9); glow(R.m[j], '#8a1f5a'); await beat(tok, ms * 0.35); glow(R.m[j], null); } while (R.v[j] > p);
    say('j 停在 ' + sbS(R.v[j]) + '（≤ ' + p + '）', R.str());
    await beat(tok, ms * 0.5);
    hl(5);
    if (i < j) {
      say('i < j：交換 ' + sbS(R.v[i]) + ' 和 ' + sbS(R.v[j]), R.str());
      await R.swap(tok, i, j, ms);
      say('交換後', R.str());
      await beat(tok, ms * 0.3);
    } else {
      say('i > j：交錯了，不交換', 'j 停的地方就是 pivot 的位置');
      await beat(tok, ms * 0.8);
    }
  }
  hl(7);
  say('A[l] 和 A[j] 交換：' + p + ' ↔ ' + R.v[j], R.str());
  await R.swap(tok, l, j, ms);
  glow(R.m[j], null); tint(R.m[j], GREEN);
  hl(8);
  say(p + ' 歸位：return j', R.str());
  await beat(tok, ms);
  kill(pt); kill(it); kill(jt);
  return j;
}

// 00:00 想法：學生依身高自己找位置
FRAG.push(['sortbari-quick-students', 'Quick sort 的想法：學生自己找位置', async (tok) => {
  fresh([0, 4, 11], [0, 1.4, 0]);
  const H = [1.6, 2.4, 1.0, 2.0, 3.0, 1.3, 1.8], C = ['#4b9ee2', '#e55a9b', '#2fc092', '#dd8238', '#9b7ef4', '#31aab0', '#c08a1f'];
  const X = (i) => -4.5 + i * 1.5;
  let line = H.map((h, i) => { const m = cube('', C[i], [0.7, h, 0.7], X(i), h / 2, 0, 1.0); m.userData.h = h; return m; });
  const place = async (moving, ms = 1600) => {
    for (const m of moving) move(m, m.position.x, m.userData.h / 2, 1.8);
    await beat(tok, ms * 0.35);
    line.forEach((m, i) => move(m, X(i), m.userData.h / 2, moving.includes(m) ? 1.8 : 0));
    await beat(tok, ms * 0.35);
    for (const m of moving) move(m, X(line.indexOf(m)), m.userData.h / 2, 0);
    await beat(tok, ms * 0.3);
  };
  say('依身高排隊：老師指定位置？', '還是學生自己找位置？');
  await beat(tok, 3000);
  say('自己找位置比較快 → quick sort', '每個人找到自己在排序後的位置');
  await beat(tok, 2600);
  const short = line[2]; glow(short, GOLD);
  say('最矮的：自己走到最前面', '不需要別人幫忙');
  line = [short].concat(line.filter((m) => m !== short)); await place([short]);
  glow(short, null);
  const tall = line.find((m) => m.userData.h === 3.0); glow(tall, GOLD);
  say('最高的：自己走到最後面', '');
  line = line.filter((m) => m !== tall).concat([tall]); await place([tall]);
  glow(tall, null);
  const me = line.find((m) => m.userData.h === 1.8); glow(me, GOLD);
  say('其他人：比我高的往後站', '比我矮的往前站');
  await beat(tok, 2000);
  const lo = line.filter((m) => m !== me && m.userData.h < 1.8), hi = line.filter((m) => m !== me && m.userData.h > 1.8);
  const movers = line.filter((m, i) => m !== me && (m.userData.h < 1.8) !== (i < line.indexOf(me)));
  line = lo.concat([me], hi); await place(movers);
  tint(me, GREEN);
  say('我就站在自己的排序位置了', '前面都比我矮、後面都比我高');
  await beat(tok, 3000);
}]);

// 02:13 什麼叫「在排序位置」
FRAG.push(['sortbari-quick-sorted-pos', '在排序位置：左邊都小、右邊都大', async (tok) => {
  fresh([0, 7, 10], [0, 0.4, 0]);
  const A = sbRow([10, 80, 90, 60, 30, 20], { z: -2.0, dx: 1.05, drop: true });
  say('10 80 90 60 30 20', '哪一個一眼就知道排好了？');
  await beat(tok, 2600);
  glow(A.m[0], GOLD);
  say('10：最小、又在最前面', '<span class="ok">10 已經在排序位置</span>');
  await beat(tok, 2800);
  say('同理：最大的在最後面也是', '其他元素還不知道');
  await beat(tok, 2400);
  const B = sbRow([4, 6, 7, 10, 16, 12, 13, 14], { z: 1.6, dx: 1.05, drop: true });
  say('4 6 7 10 16 12 13 14', '哪一個在排序位置？');
  await beat(tok, 2600);
  glow(B.m[3], GOLD);
  const gl = ghostBox('#2fc092', 3 * 1.05, 1.0, 1.1); gl.position.set(B.x(1), 0.5, 1.6);
  say('10：左邊 4 6 7 都比 10 小', '');
  await beat(tok, 2400);
  const gr = ghostBox('#dd8238', 4 * 1.05, 1.0, 1.1); gr.position.set((B.x(4) + B.x(7)) / 2, 0.5, 1.6);
  say('右邊 16 12 13 14 都比 10 大', '<span class="ok">10 在排序位置</span>，右邊自己還沒排好');
  await beat(tok, 3200);
  say('quick sort：讓元素找到排序位置', '名字叫 quick，但不是最快的排序');
  await beat(tok, 3000);
}]);

// 03:58 初始設定：l、h、∞、pivot、i、j
FRAG.push(['sortbari-quick-setup', 'Partition 的準備：∞、pivot、i、j', async (tok) => {
  fresh([0, 6, 12], [0, 1.2, 0]);
  const R = sbRow(SB_Q.slice(0, 9).concat([Infinity]), { drop: true });
  kill(R.m[9]); R.m[9] = null;
  say('quick sort：divide and conquer', '9 個元素：10 16 8 12 15 6 3 9 5');
  await beat(tok, 2600);
  R.ptr('l', 'idx', 0, -0.6); R.ptr('h', 'idx', 9, -0.6);
  say('l = low 開頭，h = high 尾端', '尾端多一格');
  await beat(tok, 2400);
  R.m[9] = cube('∞', '#d8cfc0', [0.8, 0.8, 0.8], R.x(9), 0.5, 0, 2.2);
  say('尾端放 ∞：end-of-list 標記', '像字串的 \\0；實作用最大整數');
  await beat(tok, 3000);
  glow(R.m[0], GOLD); R.ptr('pivot', 'ptr alt', 0, 2.6);
  say('第一個元素當 pivot = 10', '目標：找到 10 的排序位置');
  await beat(tok, 2800);
  const gl = ghostBox('#2fc092', 4.4, 1.0, 1.1); gl.position.set(R.x(1.5), 0.5, 0);
  const gr = ghostBox('#dd8238', 4.4, 1.0, 1.1); gr.position.set(R.x(6.5), 0.5, 0);
  say('比 10 小的到左邊，大的到右邊', '');
  await beat(tok, 2600);
  kill(gl); kill(gr);
  R.ptr('i', 'ptr', 0, 1.3); R.ptr('j', 'ptr', 9, 1.9);
  say('i 從 pivot 出發，找 > pivot', 'j 從 ∞ 出發，找 ≤ pivot → 兩個交換');
  await beat(tok, 3200);
  say('i 最遠停在 ∞，j 最遠停在 pivot', '所以不會跑出陣列');
  await beat(tok, 3000);
}]);

// 06:30 partition 過程：16↔5、12↔9、15↔3，10↔6
FRAG.push(['sortbari-quick-partition', 'Partition：10 16 8 12 15 6 3 9 5', async (tok) => {
  fresh([0, 6, 12], [0, 1.2, 0]);
  const R = sbRow(SB_Q);
  say('partitioning procedure', 'i 找 > 10、j 找 ≤ 10，找到就交換');
  await beat(tok, 2400);
  const j = await sbPart(tok, R, 0, 9, { ms: 1000 });
  const gl = ghostBox('#2fc092', j * R.dx, 1.0, 1.1); gl.position.set((R.x(0) + R.x(j - 1)) / 2, 0.5, 0);
  const gr = ghostBox('#dd8238', (8 - j) * R.dx, 1.0, 1.1); gr.position.set((R.x(j + 1) + R.x(8)) / 2, 0.5, 0);
  say('左邊都 < 10、右邊都 > 10', '兩邊還沒排好 → 各自遞迴 quick sort');
  await beat(tok, 3400);
}]);

// 09:17 partition 的程式碼
FRAG.push(['sortbari-quick-code', 'partition(l, h) 演算法', async (tok) => {
  fresh([0, 6, 12], [0, 2.4, 0]);
  const C = code(['partition(l, h)', '{ pivot = A[l]; i = l; j = h;', '  while (i < j)', '  { do { i++; } while (A[i] <= pivot);', '    do { j--; } while (A[j] > pivot);', '    if (i < j) swap(A[i], A[j]);', '  }', '  swap(A[l], A[j]);', '  return j;', '}'], 0, 6.4, 0.46, -2.5);
  const R = sbRow(SB_Q, { z: 1.8 });
  C.hl(0);
  say('把剛才的步驟寫成 partition', '參數 l、h');
  await beat(tok, 2400);
  await sbPart(tok, R, 0, 9, { ms: 640, code: C });
  C.hl(-1);
  say('i 往右、j 往左，交錯就停', 'return j = pivot 的位置');
  await beat(tok, 3000);
}]);

// 11:57 QuickSort(l, h)：遞迴，pivot 當左半邊的 ∞
FRAG.push(['sortbari-quick-recursive', 'QuickSort(l, h)：左邊用 pivot 當 ∞', async (tok) => {
  fresh([0, 6, 12], [0, 2.4, 0]);
  const C = code(['QuickSort(l, h)', '{ if (l < h)', '  { j = partition(l, h);', '    QuickSort(l, j);', '    QuickSort(j + 1, h);', '  }', '}'], 0, 6.2, 0.5, -2.5);
  const R = sbRow([6, 5, 8, 9, 3, 10, 15, 12, 16, Infinity], { z: 1.8 });
  tint(R.m[5], GREEN);
  C.hl(1);
  say('l < h：還有東西要排', '');
  await beat(tok, 2200);
  C.hl(2);
  say('partition 回傳 j：10 已歸位', R.str());
  await beat(tok, 2600);
  C.hl(3);
  let z = ghostBox('#2fc092', 6 * R.dx, 1.0, 1.1); z.position.set((R.x(0) + R.x(5)) / 2, 0.5, 1.8);
  say('左邊 QuickSort(l, j)：包含 j', '已排好的 10 當左半邊的 ∞');
  await beat(tok, 3200);
  await sbPart(tok, R, 0, 5, { ms: 340 });
  say('3 5 已就位；再 partition 9 8', '右邊的 10 當 ∞　' + R.str());
  await beat(tok, 1600);
  await sbPart(tok, R, 3, 5, { ms: 340 });
  kill(z);
  C.hl(4);
  z = ghostBox('#dd8238', 4 * R.dx, 1.0, 1.1); z.position.set((R.x(6) + R.x(9)) / 2, 0.5, 1.8);
  say('右邊 QuickSort(j + 1, h)', '尾端本來就有 ∞');
  await beat(tok, 2600);
  await sbPart(tok, R, 6, 9, { ms: 340 });
  kill(z);
  C.hl(-1);
  for (let k = 0; k < 9; k++) tint(R.m[k], GREEN);
  say('每個 pivot 都歸位 → 排好了', R.str());
  await beat(tok, 3000);
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
