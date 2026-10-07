// 演算法 第2章：分治法 Divide and Conquer（binary search、merge sort、quicksort、Strassen、Karatsuba／Newton、selection、maximum subarray）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 場景依影片段落：Abdul Bari 2.x、MIT 6.006 Rec3 / L12；課本補充場景以 CLRS 為準。
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
    ],
    stop() { stopTimer(); },
  };
}
