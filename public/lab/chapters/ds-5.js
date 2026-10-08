// 資料結構 第5章：Heap 與 Priority Queue。
// 陣列一律 1-based（Horowitz 與 CLRS／MIT 6.006 相同）：heap[0] 不用，
// parent(i) = ⌊i/2⌋、left(i) = 2i、right(i) = 2i+1。
// 例子取自 MIT 6.006 L4（Heaps and Heap Sort）的板書：
//   16,14,10,8,7,9,3,2,4,1（heap 的陣列表示）、max-heapify(A,2)、build-max-heap、heap sort。
// max-heapify（CLRS／MIT 的名字）＝ Horowitz 課本的 adjust。
import kit from './_kit.js';

export default function (ctx) {
  const { THREE, lab, colorFor, sleep, $, log, clearLog, setState, controls, on, say, beat, block, tile } = ctx;

  const MAXN = 15;                       // 4 層的完全二元樹
  const TW = 13;                         // 樹的寬度（世界單位）
  const LV_Y = [6.8, 5.2, 3.6, 2.0];     // 各層高度
  const CELL_DX = 0.82, CELL_Y = 0.32, CELL_Z = 3.2;
  const EMI = { cur: '#6a5200', cmp: '#1f3a6e', swap: '#6a1414', ok: '#0f5a32' };
  const MIT_HEAP = [16, 14, 10, 8, 7, 9, 3, 2, 4, 1];      // 講義上已經是 max-heap 的陣列
  const MIT_HEAPIFY = [16, 4, 10, 14, 7, 9, 3, 2, 8, 1];   // max-heapify(A, 2) 的例子
  const CLRS_BUILD = [4, 1, 3, 2, 16, 9, 10, 14, 8, 7];    // build-max-heap 的例子（講義 notes）
  const HZ_MINMAX = [7, 70, 40, 30, 9, 10, 15, 45, 50, 30, 20, 12]; // Horowitz 圖 9.1 的 min-max heap

  const level = (i) => Math.floor(Math.log2(i));
  function treePos(i) {
    const d = level(i), cnt = 1 << d, k = i - cnt;
    return new THREE.Vector3(((k + 0.5) / cnt - 0.5) * TW, LV_Y[d], 0);
  }
  function cellPos(i) { return new THREE.Vector3((i - 7.5) * CELL_DX, CELL_Y, CELL_Z); }

  // ───────────────────────── 共用狀態與動畫工具 ─────────────────────────
  const H = { a: [null], t: [null], c: [null], n: 0, size: 0, kind: 'max', mode: 'pq', cmp: 0, sw: 0, op: '' };
  let gen = 0, sceneTok = null, busy = false;
  let edgeObjs = [], linkObjs = [], hlMeshes = [], hlList = [], tiles = [], extraLbls = [], curLbl = null;
  const better = (x, y) => (H.kind === 'max' ? x > y : x < y);
  const KN = () => (H.kind === 'max' ? 'Max' : 'Min');

  async function W(ms) {
    const g = gen;
    if (sceneTok !== null) await beat(sceneTok, ms); else await sleep(ms);
    if (g !== gen) throw new Error('stale');
  }
  function run(fn) {
    return async () => {
      if (busy) { log('動畫還在跑，等它做完再按。', true); return; }
      busy = true;
      const g = gen;
      try { await fn(); } catch (e) { if (e.message !== 'stale') console.error(e); } finally { if (g === gen) busy = false; }
    };
  }

  function setupStage(camera) {
    gen++; busy = false;
    lab.clear();
    H.a = [null]; H.t = [null]; H.c = [null]; H.n = 0; H.size = 0; H.cmp = 0; H.sw = 0; H.op = '';
    edgeObjs = []; linkObjs = []; hlMeshes = []; hlList = []; tiles = []; extraLbls = [];
    lab.frameCamera(camera || [0, 5.2, 15.5], [0, 3.6, 1]);
    for (let i = 0; i <= MAXN; i++) {
      const p = cellPos(i);
      tiles[i] = tile(new THREE.Vector3(p.x, 0.02, p.z), 0.74, 0.9, i === 0 ? '#d6ccbb' : '#e9dcc4');
      const l = lab.label('[' + i + ']', 'idx');
      l.position.set(p.x, 0.05, p.z + 0.8);
      lab.world.add(l);
    }
    const no = lab.label('不用', 'idx'); no.position.copy(cellPos(0)).setY(0.6); lab.world.add(no);
    curLbl = lab.label('', 'ptr alt'); curLbl.visible = false; lab.world.add(curLbl);
    bindPick();
  }
  function addElem(i, v, drop = true, delay = 0) {
    const tm = block(v, [1.0, 0.7, 1.0]);
    const cm = block(v, [0.66, 0.5, 0.7]);
    const tp = treePos(i), cp = cellPos(i);
    tm.position.copy(tp).add(new THREE.Vector3(0, drop ? 3.5 + delay : 0, 0));
    cm.position.copy(cp).add(new THREE.Vector3(0, drop ? 5 + delay : 0, 0));
    const tb = lab.addBody(tm), cb = lab.addBody(cm);
    H.a[i] = v; H.t[i] = tb; H.c[i] = cb;
    if (drop) { lab.dropTo(tb, tp); lab.dropTo(cb, cp); } else { tb.target.copy(tp); cb.target.copy(cp); }
  }
  function setVal(i, v) {
    H.a[i] = v;
    for (const b of [H.t[i], H.c[i]]) {
      if (!b) continue;
      b.obj.material.color.set(colorFor(v));
      const l = b.obj.children.find((o) => o.element);
      if (l) l.element.textContent = String(v);
    }
  }
  function drawEdges() {
    edgeObjs.forEach((o) => lab.world.remove(o)); edgeObjs = [];
    const mat = new THREE.LineBasicMaterial({ color: '#a8946f' });
    for (let i = 2; i <= H.size; i++) {
      const g = new THREE.BufferGeometry().setFromPoints([treePos(i >> 1).setZ(-0.05), treePos(i).setZ(-0.05)]);
      const l = new THREE.Line(g, mat); lab.world.add(l); edgeObjs.push(l);
    }
  }
  // 同一個元素在樹上與陣列裡一起發亮，中間拉一條虛線連起來
  function mark(list) {
    for (const m of hlMeshes) if (m.material.emissive) m.material.emissive.setHex(0);
    hlMeshes = []; hlList = list;
    for (const [i, col] of list) for (const b of [H.t[i], H.c[i]]) if (b) { b.obj.material.emissive.set(col); hlMeshes.push(b.obj); }
    drawLinks();
  }
  function drawLinks() {
    linkObjs.forEach((o) => lab.world.remove(o)); linkObjs = [];
    for (const [i] of hlList) {
      if (!H.t[i] || i > H.size) continue;
      const g = new THREE.BufferGeometry().setFromPoints([treePos(i).add(new THREE.Vector3(0, -0.36, 0)), cellPos(i).add(new THREE.Vector3(0, 0.26, 0))]);
      const line = new THREE.Line(g, new THREE.LineDashedMaterial({ color: '#c08a1f', dashSize: 0.22, gapSize: 0.14 }));
      line.computeLineDistances();
      lab.world.add(line); linkObjs.push(line);
    }
  }
  function pointAt(i, text) {
    if (!i) { curLbl.visible = false; return; }
    curLbl.visible = true;
    curLbl.element.textContent = text;
    curLbl.position.copy(treePos(i)).add(new THREE.Vector3(0, 0.85, 0));
  }
  async function swapAnim(i, j, ms = 650) {
    H.sw++;
    [H.a[i], H.a[j]] = [H.a[j], H.a[i]];
    [H.t[i], H.t[j]] = [H.t[j], H.t[i]];
    [H.c[i], H.c[j]] = [H.c[j], H.c[i]];
    // 走弧線，兩個方塊不要互相穿過
    lab.springTo(H.t[i], treePos(i).add(new THREE.Vector3(0, 0, 0.9)));
    lab.springTo(H.t[j], treePos(j).add(new THREE.Vector3(0, 0, -0.6)));
    lab.springTo(H.c[i], cellPos(i).add(new THREE.Vector3(0, 0.95, 0)));
    lab.springTo(H.c[j], cellPos(j).add(new THREE.Vector3(0, 0.5, 0)));
    mark(hlList.map(([k, c]) => [k === i ? j : k === j ? i : k, c]));
    await W(ms * 0.4);
    lab.springTo(H.t[i], treePos(i)); lab.springTo(H.t[j], treePos(j));
    lab.springTo(H.c[i], cellPos(i)); lab.springTo(H.c[j], cellPos(j));
    await W(ms * 0.6);
  }
  function arrText(from = 1, to = H.n) {
    const out = [];
    for (let i = from; i <= to; i++) out.push(H.a[i]);
    return out.join(', ');
  }
  function loadArray(vals, asHeap) {
    const arr = asHeap ? buildPure(vals, H.kind) : vals.slice(0, MAXN);
    arr.forEach((v, k) => addElem(k + 1, v, true, k * 0.25));
    H.n = H.size = arr.length;
    drawEdges();
  }

  // ── 點方塊：看它的 parent／children（樹和陣列都可以點） ──
  const ray = new THREE.Raycaster();
  let downXY = null;
  function bindPick() {
    const el = $('canvas');
    if (!el) return;
    el.onpointerdown = (e) => { downXY = [e.clientX, e.clientY]; };
    el.onpointerup = (e) => {
      if (!downXY || Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]) > 5) return;
      if (busy || sceneTok !== null || !H.n) return;
      const r = el.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), lab.camera);
      const objs = [], idx = new Map();
      for (let i = 1; i <= H.size; i++) for (const b of [H.t[i], H.c[i]]) if (b) { objs.push(b.obj); idx.set(b.obj, i); }
      const hit = ray.intersectObjects(objs, false)[0];
      if (hit) showRelatives(idx.get(hit.object));
    };
  }
  function showRelatives(i) {
    const p = i >> 1, l = 2 * i, r = 2 * i + 1;
    const list = [[i, EMI.cur]];
    if (p >= 1) list.push([p, EMI.cmp]);
    if (l <= H.size) list.push([l, EMI.ok]);
    if (r <= H.size) list.push([r, EMI.ok]);
    mark(list);
    pointAt(i, 'i = ' + i);
    const f = (k) => (k >= 1 && k <= H.size ? 'heap[' + k + '] = ' + H.a[k] : '[' + k + '] 不存在');
    log('heap[' + i + '] = ' + H.a[i] + '：parent ⌊' + i + '/2⌋ → ' + (p ? f(p) : '沒有（根）') + '；left 2i → ' + f(l) + '；right 2i+1 → ' + f(r));
    H.op = '看 i = ' + i;
    renderState();
    return { p, l, r };
  }

  // ───────────────────────── 純計算（測驗與載入用） ─────────────────────────
  function siftDownPure(a, i, n, kind) {
    const bt = (x, y) => (kind === 'max' ? x > y : x < y);
    while (2 * i <= n) {
      let c = 2 * i;
      if (c + 1 <= n && bt(a[c + 1], a[c])) c++;
      if (!bt(a[c], a[i])) break;
      [a[c], a[i]] = [a[i], a[c]]; i = c;
    }
  }
  function buildPure(vals, kind = 'max') {
    const a = [null, ...vals];
    for (let i = vals.length >> 1; i >= 1; i--) siftDownPure(a, i, vals.length, kind);
    return a.slice(1);
  }
  function insertPure(vals, kind = 'max') {
    const a = [null];
    const bt = (x, y) => (kind === 'max' ? x > y : x < y);
    for (const v of vals) {
      a.push(v);
      let i = a.length - 1;
      while (i > 1 && bt(a[i], a[i >> 1])) { [a[i], a[i >> 1]] = [a[i >> 1], a[i]]; i >>= 1; }
    }
    return a.slice(1);
  }
  function deletePure(heap, kind = 'max') {
    const a = [null, ...heap];
    a[1] = a[a.length - 1]; a.pop();
    siftDownPure(a, 1, a.length - 1, kind);
    return a.slice(1);
  }
  function heightOf(i, n) { let h = 0; while (2 * i <= n) { i *= 2; h++; } return h; }

  // ───────────────────────── 狀態卡 ─────────────────────────
  function renderState() {
    const rootTxt = H.size ? String(H.a[1]) : '—';
    if (H.mode === 'minmax') {
      let mx = '—';
      if (H.n === 1) mx = String(H.a[1]);
      else if (H.n >= 2) mx = String(Math.max(...[2, 3].filter((k) => k <= H.n).map((k) => H.a[k])));
      setState('Min-Max Heap（Horowitz 9.1）', [
        ['n', String(H.n)], ['最小值（根）', rootTxt], ['最大值（第 2 層之一）', mx], ['剛才', H.op || '—'], ['比較 / 交換', H.cmp + ' / ' + H.sw],
      ], '偶數層（根那層）是 min 層：比所有子孫都小<br>奇數層是 max 層：比所有子孫都大<br>insert、delete-min、delete-max 都是 O(log n)');
      return;
    }
    const rows = [
      ['種類', H.kind === 'max' ? 'Max Heap：父 ≥ 子' : 'Min Heap：父 ≤ 子'],
      ['n（heap size）', H.size === H.n ? String(H.n) : H.size + '（已排好 ' + (H.n - H.size) + ' 個）'],
      [(H.kind === 'max' ? '最大' : '最小') + '值 heap[1]', rootTxt],
      ['剛才', H.op || '—'],
      ['比較 / 交換', H.cmp + ' / ' + H.sw],
    ];
    let f = 'heap[1..' + H.n + '] = ' + (H.n ? arrText() : '空') + '<br>parent(i) = ⌊i/2⌋、left(i) = 2i、right(i) = 2i+1（[0] 不用）';
    if (H.mode === 'pq') f += '<br>max O(1)；insert、extract-max、increase-key 都是 O(log n)';
    if (H.mode === 'build') {
      let sumH = 0, sumD = 0;
      for (let i = 1; i <= H.n; i++) { sumH += heightOf(i, H.n); sumD += level(i); }
      f += '<br>bottom-up 最多交換 Σ高度 = <span class="ok">' + sumH + '</span> ≤ n = ' + H.n
        + '<br>逐一 insert 最多交換 Σ深度 = <span class="no">' + sumD + '</span>（Θ(n log n)）';
    }
    if (H.mode === 'sort') f += '<br>build O(n) ＋ (n−1) 次 max-heapify O(log n) → O(n log n)';
    setState(KN() + ' Heap（陣列從 [1] 開始）', rows, f);
  }

  // ───────────────────────── 核心操作（都有動畫） ─────────────────────────
  async function siftUp(i) {
    while (i > 1) {
      const p = i >> 1; H.cmp++;
      mark([[i, EMI.cur], [p, EMI.cmp]]); pointAt(i, 'i = ' + i + '，parent = ' + p);
      const up = better(H.a[i], H.a[p]);
      log('  比較 heap[' + i + '] = ' + H.a[i] + ' 和 parent heap[' + p + '] = ' + H.a[p] + ' → ' + (up ? '要換（往上浮）' : '不用換，停'));
      renderState();
      await W(650);
      if (!up) break;
      await swapAnim(i, p); i = p;
    }
    mark([[i, EMI.ok]]); pointAt(i, '定位在 [' + i + ']');
    renderState();
    return i;
  }
  async function siftDown(i, size, fast) {
    while (2 * i <= size) {
      let c = 2 * i;
      if (c + 1 <= size) { H.cmp++; if (better(H.a[c + 1], H.a[c])) c++; }
      H.cmp++;
      const sib = c ^ 1;
      mark([[i, EMI.cur], [c, EMI.cmp], ...(sib <= size && sib > 1 ? [[sib, '#1a1a1a']] : [])]);
      pointAt(i, H.kind + '-heapify(' + i + ')');
      const down = better(H.a[c], H.a[i]);
      log('  heap[' + i + '] = ' + H.a[i] + '，' + (H.kind === 'max' ? '較大' : '較小') + '的孩子是 heap[' + c + '] = ' + H.a[c] + (down ? ' → 交換，往下沉' : ' → 不用換，停'));
      renderState();
      await W(fast ? 420 : 650);
      if (!down) break;
      await swapAnim(i, c, fast ? 480 : 650); i = c;
    }
    mark([[i, EMI.ok]]);
    renderState();
    return i;
  }
  async function heapInsert(v) {
    if (H.n >= MAXN) { log('示範最多 15 個節點（4 層），先 extract 幾個再插入。', true); return false; }
    if (H.size !== H.n) { log('heap sort 做到一半，先重設。', true); return false; }
    H.cmp = 0; H.sw = 0; H.op = 'insert(' + v + ')';
    const i0 = ++H.n; H.size = H.n;
    addElem(i0, v, true); drawEdges();
    mark([[i0, EMI.cur]]); pointAt(i0, '新的 [' + i0 + ']');
    log('insert(' + v + ')：先放在最後一格 heap[' + i0 + ']，樹的形狀保持完全二元樹');
    renderState();
    await W(800);
    await siftUp(i0);
    log('  完成：比較 ' + H.cmp + ' 次、交換 ' + H.sw + ' 次（最多 ⌊log₂ n⌋ = ' + level(H.n) + ' 次）');
    return true;
  }
  async function extractTop() {
    if (!H.n) { log('heap 是空的，沒有東西可以取。', true); return null; }
    if (H.size !== H.n) { log('heap sort 做到一半，先重設。', true); return null; }
    H.cmp = 0; H.sw = 0;
    const top = H.a[1];
    H.op = 'extract-' + H.kind + '() = ' + top;
    mark([[1, EMI.cur]]); pointAt(1, (H.kind === 'max' ? '最大' : '最小') + ' = ' + top);
    log('extract-' + H.kind + '()：回傳根 heap[1] = ' + top);
    renderState();
    await W(800);
    mark([]); pointAt(0);
    lab.flyAway(H.t[1], new THREE.Vector3(0, 8, 5)); lab.flyAway(H.c[1], new THREE.Vector3(-2, 8, 4));
    const n = H.n;
    if (n === 1) { H.a[1] = H.t[1] = H.c[1] = null; H.n = H.size = 0; drawEdges(); renderState(); return top; }
    await W(500);
    H.a[1] = H.a[n]; H.t[1] = H.t[n]; H.c[1] = H.c[n];
    H.a[n] = H.t[n] = H.c[n] = null;
    H.n--; H.size = H.n;
    log('  把最後一個 heap[' + n + '] = ' + H.a[1] + ' 搬到根，heap size 變 ' + H.n);
    lab.springTo(H.t[1], treePos(1));
    lab.springTo(H.c[1], cellPos(1).add(new THREE.Vector3(0, 1.2, 0)));
    drawEdges(); mark([[1, EMI.cur]]); pointAt(1, '搬上來的 ' + H.a[1]);
    renderState();
    await W(900);
    lab.springTo(H.c[1], cellPos(1));
    await W(300);
    await siftDown(1, H.n);
    log('  完成：比較 ' + H.cmp + ' 次、交換 ' + H.sw + ' 次 → O(log n)');
    return top;
  }
  async function changeKey(i, k) {
    if (!(i >= 1 && i <= H.n)) { log('索引 i 要在 1 到 ' + H.n + ' 之間（陣列從 1 開始）。', true); return; }
    if (H.size !== H.n) { log('heap sort 做到一半，先重設。', true); return; }
    const name = H.kind === 'max' ? 'increase-key' : 'decrease-key';
    if (!(better(k, H.a[i]) || k === H.a[i])) { log(name + '：新 key ' + k + ' 要' + (H.kind === 'max' ? '大於' : '小於') + '原本的 ' + H.a[i] + '，否則要往下沉，不是這個操作。', true); return; }
    H.cmp = 0; H.sw = 0; H.op = name + '(' + i + ', ' + k + ')';
    mark([[i, EMI.cur]]); pointAt(i, 'heap[' + i + ']');
    log(name + '(A, ' + i + ', ' + k + ')：heap[' + i + '] 從 ' + H.a[i] + ' 改成 ' + k + '，只可能違反和 parent 的關係 → 往上浮');
    await W(700);
    setVal(i, k);
    renderState();
    await W(600);
    await siftUp(i);
  }
  async function buildHeap(fast) {
    const n = H.n;
    H.cmp = 0; H.sw = 0; H.op = 'build-' + H.kind + '-heap';
    log('build-' + H.kind + '-heap：i 從 ⌊n/2⌋ = ' + (n >> 1) + ' 往下到 1，每個 i 做一次 max-heapify（Horowitz 叫 adjust）');
    log('  [' + ((n >> 1) + 1) + '..' + n + '] 都是葉子，本身就是 heap，不用做');
    for (let i = n >> 1; i >= 1; i--) {
      log('max-heapify(A, ' + i + ')：左右子樹已經是 heap，最多往下沉 ' + heightOf(i, n) + ' 層');
      await siftDown(i, n, fast);
      await W(fast ? 200 : 400);
    }
    pointAt(0); mark([]);
    log('完成：實際交換 ' + H.sw + ' 次。');
    renderState();
  }
  async function heapSort() {
    if (H.size !== H.n) { log('已經排過了，按「重設」再來一次。', true); return; }
    await buildHeap(true);
    log('第二階段：heap[1] 和 heap[size] 交換 → 最' + (H.kind === 'max' ? '大' : '小') + '值放到尾端，heap size − 1，再 max-heapify(A, 1)');
    for (let i = H.n; i >= 2; i--) {
      mark([[1, EMI.cur], [i, EMI.swap]]); pointAt(1, '最' + (H.kind === 'max' ? '大' : '小') + ' = ' + H.a[1]);
      log('交換 heap[1] = ' + H.a[1] + ' 與 heap[' + i + '] = ' + H.a[i]);
      H.op = '第 ' + (H.n - i + 1) + ' 輪';
      renderState();
      await W(600);
      await swapAnim(1, i);
      H.size = i - 1;
      sortedDown(i);
      drawEdges(); mark([]);
      renderState();
      await W(450);
      await siftDown(1, H.size, true);
    }
    sortedDown(1); H.size = 0; drawEdges(); pointAt(0);
    log('排序完成：' + arrText() + (H.kind === 'max' ? '（Max Heap → 由小到大）' : '（Min Heap → 由大到小）'));
    H.op = '完成';
    renderState();
  }
  // 排好的那一格：樹上的方塊落進陣列尾端，格子變綠
  function sortedDown(i) {
    const b = H.t[i];
    if (b) {
      b.obj.scale.set(0.6, 0.6, 0.6);
      lab.springTo(b, cellPos(i).add(new THREE.Vector3(0, 0.75, 0)), () => { if (H.t[i] === b) { lab.removeBody(b); H.t[i] = null; } });
    }
    tiles[i].material.color.set('#9fd8b8');
  }

  // ── Min-Max Heap（Horowitz 9.1） ──
  const minLevel = (i) => level(i) % 2 === 0;
  async function mmVerify(i, isMax) {
    for (let g = i >> 2; g >= 1; g = i >> 2) {
      H.cmp++;
      mark([[i, EMI.cur], [g, EMI.cmp]]); pointAt(i, '和祖父 [' + g + '] 比');
      const go = isMax ? H.a[i] > H.a[g] : H.a[i] < H.a[g];
      log('  verify-' + (isMax ? 'max' : 'min') + '：heap[' + i + '] = ' + H.a[i] + ' 和祖父 heap[' + g + '] = ' + H.a[g] + (go ? ' → 交換' : ' → 停'));
      await W(650);
      if (!go) break;
      await swapAnim(i, g); i = g;
    }
    mark([[i, EMI.ok]]); pointAt(i, '定位 [' + i + ']');
    return i;
  }
  async function mmInsert(v) {
    if (H.n >= MAXN) { log('示範最多 15 個節點，先 delete-min 幾次。', true); return; }
    H.cmp = 0; H.sw = 0; H.op = 'insert(' + v + ')';
    const i = ++H.n; H.size = H.n;
    addElem(i, v, true); drawEdges();
    mark([[i, EMI.cur]]); pointAt(i, '新的 [' + i + ']');
    log('insert(' + v + ')：放在 heap[' + i + ']，parent 是 [' + (i >> 1) + ']（' + (i > 1 ? (minLevel(i >> 1) ? 'min 層' : 'max 層') : '—') + '）');
    renderState();
    await W(800);
    const p = i >> 1;
    if (!p) { mark([[1, EMI.ok]]); return; }
    H.cmp++;
    mark([[i, EMI.cur], [p, EMI.cmp]]);
    if (minLevel(p)) {
      if (v < H.a[p]) { log('  parent 在 min 層且 ' + v + ' < ' + H.a[p] + ' → 和 parent 交換，再往上檢查 min 層的祖父'); await W(650); await swapAnim(i, p); await mmVerify(p, false); }
      else { log('  parent 在 min 層且 ' + v + ' ≥ ' + H.a[p] + ' → 留在 max 層這一側，往上檢查 max 層的祖父'); await W(650); await mmVerify(i, true); }
    } else if (v > H.a[p]) { log('  parent 在 max 層且 ' + v + ' > ' + H.a[p] + ' → 和 parent 交換，再往上檢查 max 層的祖父'); await W(650); await swapAnim(i, p); await mmVerify(p, true); }
    else { log('  parent 在 max 層且 ' + v + ' ≤ ' + H.a[p] + ' → 往上檢查 min 層的祖父'); await W(650); await mmVerify(i, false); }
    renderState();
  }
  async function mmDeleteMin() {
    if (!H.n) { log('heap 是空的。', true); return; }
    H.cmp = 0; H.sw = 0;
    const res = H.a[1];
    H.op = 'delete-min() = ' + res;
    mark([[1, EMI.cur]]); pointAt(1, '最小 = ' + res);
    log('delete-min()：回傳根 ' + res + '，把最後一個 x = heap[' + H.n + '] 拿出來重新放');
    await W(800);
    mark([]); pointAt(0);
    lab.flyAway(H.t[1], new THREE.Vector3(0, 8, 5)); lab.flyAway(H.c[1], new THREE.Vector3(-2, 8, 4));
    const n0 = H.n;
    if (n0 === 1) { H.a[1] = H.t[1] = H.c[1] = null; H.n = H.size = 0; drawEdges(); renderState(); return; }
    await W(450);
    H.a[1] = H.a[n0]; H.t[1] = H.t[n0]; H.c[1] = H.c[n0]; H.a[n0] = H.t[n0] = H.c[n0] = null;
    H.n--; H.size = H.n;
    lab.springTo(H.t[1], treePos(1)); lab.springTo(H.c[1], cellPos(1));
    drawEdges();
    await W(800);
    const n = H.n;
    let i = 1;
    while (2 * i <= n) {
      const cand = [2 * i, 2 * i + 1, 4 * i, 4 * i + 1, 4 * i + 2, 4 * i + 3].filter((j) => j <= n);
      let k = cand[0];
      for (const j of cand) { H.cmp++; if (H.a[j] < H.a[k]) k = j; }
      mark([[i, EMI.cur], [k, EMI.cmp]]); pointAt(i, 'x = ' + H.a[i]);
      const isChild = k <= 2 * i + 1;
      log('  x = ' + H.a[i] + '；子孫（孩子＋孫子）裡最小的是 heap[' + k + '] = ' + H.a[k] + (isChild ? '（孩子）' : '（孫子）'));
      await W(700);
      if (H.a[i] <= H.a[k]) { log('  x ≤ 它 → x 就放這裡'); break; }
      await swapAnim(i, k);
      if (isChild) { i = k; break; }
      const p = k >> 1;
      H.cmp++;
      if (H.a[k] > H.a[p]) {
        log('  x = ' + H.a[k] + ' 比 max 層的 parent heap[' + p + '] = ' + H.a[p] + ' 大 → 交換，繼續帶著 ' + H.a[p] + ' 往下');
        mark([[k, EMI.cur], [p, EMI.swap]]);
        await W(600);
        await swapAnim(k, p);
      }
      i = k;
    }
    mark([[i, EMI.ok]]); pointAt(i, '定位 [' + i + ']');
    renderState();
  }
  function addLevelTags() {
    extraLbls.forEach((o) => lab.world.remove(o)); extraLbls = [];
    LV_Y.forEach((y, d) => {
      const l = lab.label(d % 2 === 0 ? 'min 層' : 'max 層', d % 2 === 0 ? 'ptr' : 'ptr alt');
      l.position.set(-6.8, y, 0); lab.world.add(l); extraLbls.push(l);
    });
  }
  function addHeightTags() {
    extraLbls.forEach((o) => lab.world.remove(o)); extraLbls = [];
    for (let i = 1; i <= H.n; i++) {
      const l = lab.label('h=' + heightOf(i, H.n), 'idx');
      l.position.copy(treePos(i)).add(new THREE.Vector3(0.72, -0.42, 0));
      lab.world.add(l); extraLbls.push(l);
    }
  }

  // ───────────────────────── 模式 ─────────────────────────
  const parseVals = (s) => (s.match(/-?\d+/g) || []).map(Number).slice(0, MAXN);
  const randVals = (k) => { const s = new Set(); while (s.size < k) s.add(1 + Math.floor(Math.random() * 98)); return [...s]; };
  const kindSelect = (id) => '<select id="' + id + '"><option value="max">Max Heap</option><option value="min">Min Heap</option></select>';
  function bindKind(id, reenter) { $(id).value = H.kind; $(id).onchange = (e) => { H.kind = e.target.value; reenter(); }; }

  // 1) 陣列 ↔ 樹
  function enterMap(vals) {
    H.mode = 'map'; setupStage();
    loadArray(vals || MIT_HEAP, false);
    controls('<label>i = <input id="mI" type="number" min="1" max="15" value="3"></label>'
      + '<button class="primary" id="mShow">看 parent／children</button><button id="mWalk">依 1..n 走一遍</button>'
      + '<button id="mMit">講義的陣列</button><button id="mRand">隨機陣列</button><span class="hint">也可以直接點方塊</span>');
    on('mShow', () => { const i = Number($('mI').value) || 1; if (i < 1 || i > H.n) { log('i 要在 1 到 ' + H.n + ' 之間；陣列從 [1] 開始，[0] 不用。', true); return; } showRelatives(i); });
    on('mWalk', run(walkLevelOrder));
    on('mMit', () => { clearLog(); enterMap(MIT_HEAP); });
    on('mRand', () => { clearLog(); enterMap(randVals(6 + Math.floor(Math.random() * 8))); });
    log('MIT 6.006 板書的陣列：16, 14, 10, 8, 7, 9, 3, 2, 4, 1。陣列從 [1] 開始（Horowitz、CLRS 都一樣）。');
    log('把陣列「看成」一棵幾乎完全的二元樹：[1] 是根，[2][3] 是第二層，[4..7] 第三層。');
    H.op = '—'; renderState();
  }
  async function walkLevelOrder() {
    for (let i = 1; i <= H.n; i++) {
      mark([[i, EMI.cur]]); pointAt(i, 'i = ' + i);
      await W(sceneTok !== null ? 450 : 380);
    }
    mark([]); pointAt(0);
    log('陣列由左到右 = 樹由上到下、由左到右（level order）。');
  }

  // 2) Priority Queue：insert / extract / increase-key
  function enterPQ(vals) {
    H.mode = 'pq'; setupStage();
    loadArray(vals || MIT_HEAP, true);
    controls('<input id="pV" type="number" style="width:64px" value="15">'
      + '<button class="primary" id="pIns">insert</button><button id="pRand">insert 隨機</button>'
      + '<button id="pExt">extract-top</button>'
      + '<label>i <input id="pI" type="number" min="1" max="15" value="9" style="width:48px"></label><label>key <input id="pK" type="number" value="15" style="width:56px"></label><button id="pKey">increase-key</button>'
      + kindSelect('pKind') + '<button id="pReset">重設</button>');
    bindKind('pKind', () => { clearLog(); enterPQ(currentVals()); });
    const insertV = (v) => run(async () => { await heapInsert(v); });
    on('pIns', () => insertV(Number($('pV').value) || 0)());
    on('pRand', () => insertV(1 + Math.floor(Math.random() * 98))());
    on('pExt', run(async () => { await extractTop(); }));
    on('pKey', run(async () => { await changeKey(Number($('pI').value), Number($('pK').value)); }));
    on('pReset', () => { clearLog(); enterPQ(); });
    $('pKey').textContent = H.kind === 'max' ? 'increase-key' : 'decrease-key';
    log('Priority Queue 的四個操作（MIT 講義）：insert、max、extract-max、increase-key。');
    log(H.kind === 'max' ? '目前是 Max Heap：根永遠是最大值，max() 直接看 heap[1]，O(1)。' : '目前是 Min Heap：根永遠是最小值（Dijkstra、Prim 用的就是這種）。');
    H.op = '—'; renderState();
  }
  function currentVals() { const v = []; for (let i = 1; i <= H.n; i++) v.push(H.a[i]); return v.length ? v : null; }

  // 3) Build Heap：bottom-up，O(n)
  function enterBuild(vals) {
    H.mode = 'build'; setupStage();
    loadArray(vals || CLRS_BUILD, false);
    addHeightTags();
    controls('<input id="bV" style="width:210px" value="' + (vals || CLRS_BUILD).join(',') + '">'
      + '<button id="bLoad">放進陣列</button><button class="primary" id="bGo">build-heap（bottom-up）</button>'
      + '<button id="bTop">改用逐一 insert</button><button id="bRand">隨機</button>' + kindSelect('bKind'));
    bindKind('bKind', () => { clearLog(); enterBuild(parseVals($('bV').value)); });
    on('bLoad', () => { const v = parseVals($('bV').value); if (!v.length) { log('請輸入數字，用逗號隔開（最多 15 個）。', true); return; } clearLog(); enterBuild(v); });
    on('bRand', () => { clearLog(); enterBuild(randVals(10 + Math.floor(Math.random() * 6))); });
    on('bGo', run(async () => { if (H.op) { log('已經建過了，按「放進陣列」重來。', true); return; } await buildHeap(); }));
    on('bTop', run(async () => {
      const v = parseVals($('bV').value);
      if (!v.length) { log('請輸入數字，用逗號隔開。', true); return; }
      clearLog(); enterBuild(v); busy = true; H.op = '逐一 insert';
      H.size = 0; const all = currentVals();
      // 清掉、一個一個 insert 回去
      for (let i = 1; i <= H.n; i++) { lab.removeBody(H.t[i]); lab.removeBody(H.c[i]); H.a[i] = H.t[i] = H.c[i] = null; }
      H.n = 0; drawEdges();
      let total = 0;
      for (const x of all) { await heapInsert(x); total += H.sw; }
      H.op = '逐一 insert'; H.sw = total; renderState();
      log('逐一 insert 共交換 ' + total + ' 次；最壞每次都浮到根，總共 Σ深度 = O(n log n)。結果陣列不一定和 bottom-up 一樣，但都是合法的 heap。');
      busy = false;
    }));
    log('講義 notes 的例子：A = 4, 1, 3, 2, 16, 9, 10, 14, 8, 7（CLRS 圖 6.3）。');
    log('h = 這個節點最多往下沉幾層。葉子 h = 0 不用做，越高的節點越少。');
    H.op = ''; renderState();
  }

  // 4) Heap Sort
  function enterSort(vals) {
    H.mode = 'sort'; setupStage();
    loadArray(vals || MIT_HEAP.slice(0, 7), false);
    controls('<input id="sV" style="width:190px" value="' + (vals || MIT_HEAP.slice(0, 7)).join(',') + '">'
      + '<button id="sLoad">重設</button><button class="primary" id="sGo">heap sort</button><button id="sRand">隨機</button>' + kindSelect('sKind'));
    bindKind('sKind', () => { clearLog(); enterSort(parseVals($('sV').value)); });
    on('sLoad', () => { const v = parseVals($('sV').value); if (!v.length) { log('請輸入數字。', true); return; } clearLog(); enterSort(v); });
    on('sRand', () => { clearLog(); enterSort(randVals(7 + Math.floor(Math.random() * 4))); });
    on('sGo', run(heapSort));
    log('MIT 講義的 heap sort：先 build-max-heap，接著重複「heap[1] 和 heap[n] 交換、heap size − 1、max-heapify(A, 1)」。');
    log('排好的元素從樹上掉進陣列尾端（綠格），陣列前半段仍然是 heap。');
    H.op = '—'; renderState();
  }

  // 5) Min-Max Heap
  function enterMinMax(vals) {
    H.mode = 'minmax'; setupStage();
    const v = vals || HZ_MINMAX;
    v.forEach((x, k) => addElem(k + 1, x, true, k * 0.2));
    H.n = H.size = v.length; drawEdges(); addLevelTags();
    controls('<input id="xV" type="number" style="width:64px" value="5"><button class="primary" id="xIns">insert</button>'
      + '<button id="xDel">delete-min</button><button id="xReset">課本圖 9.1</button><span class="hint">試 insert 5 或 80（課本的例子）</span>');
    on('xIns', () => run(() => mmInsert(Number($('xV').value) || 0))());
    on('xDel', run(mmDeleteMin));
    on('xReset', () => { clearLog(); enterMinMax(); });
    log('Min-Max Heap（洪逸／Horowitz 9.1）：一層 min、一層 max 交錯，根在 min 層。');
    log('最小值在根；最大值是第 2 層兩個裡比較大的那個。兩種都能 O(1) 找到。');
    H.op = '—'; renderState();
  }

  // ───────────────────────── 文字頁 ─────────────────────────
  function renderCmp(el) {
    const rows = [
      ['找最大（max）', 'O(n)', 'O(1)', 'O(1)'],
      ['insert', 'O(1)', 'O(n)', 'O(log n)'],
      ['extract-max', 'O(n)', 'O(1)', 'O(log n)'],
      ['increase-key', 'O(1)', 'O(n)', 'O(log n)'],
      ['建立（n 個）', 'O(n)', 'O(n log n)', 'O(n)（bottom-up）'],
    ];
    const cls = (t) => (/^O\(1\)/.test(t) ? 'o1' : /O\(n\)|n log n/.test(t) ? 'on' : '');
    el.innerHTML = '<h2>Priority Queue 的幾種做法</h2>'
      + '<table class="lab-table"><thead><tr><th>操作</th><th>未排序陣列</th><th>排序陣列</th><th>Binary Heap</th></tr></thead><tbody>'
      + rows.map((r) => '<tr>' + r.map((c, i) => (i ? '<td class="' + cls(c) + '">' + c + '</td>' : '<th>' + c + '</th>')).join('') + '</tr>').join('')
      + '</tbody></table>'
      + '<h3>為什麼 build-heap 是 O(n)（MIT 講義的算法）</h3>'
      + '<p>離葉子 1 層的節點約 n/4 個、各做 c；2 層的約 n/8 個、各做 2c；……根只有 1 個、做 c·log n。<br>'
      + '總和 = c·2<sup>k</sup>·Σ (i+1)/2<sup>i</sup>（令 n/4 = 2<sup>k</sup>），這個級數收斂到常數（&lt; 3），所以是 Θ(n)。</p>'
      + '<h3>Heap Sort</h3><p>build O(n) ＋ (n−1) 次 max-heapify，每次 O(log n) → O(n log n)。原地排序（O(1) 額外空間），不 stable。</p>'
      + '<h3>Min-Max Heap（洪逸 9.1）</h3><p>min 層、max 層交錯（根在 min 層）。min 層節點 ≤ 所有子孫，max 層節點 ≥ 所有子孫。'
      + 'insert 先和 parent 比決定走 min 還是 max 那條「祖父鏈」（i → i/4 → …）；delete-min 在孩子＋孫子裡找最小。都是 O(log n)。</p>'
      + '<h3>容易搞混的地方</h3>'
      + '<div class="lab-trap">陣列從 [1] 開始：parent = ⌊i/2⌋、left = 2i、right = 2i+1。若題目說從 [0] 開始，要改成 parent = ⌊(i−1)/2⌋、left = 2i+1、right = 2i+2。</div>'
      + '<div class="lab-trap">「逐一 insert 建 heap」和「bottom-up build-heap」結果陣列可能不同，兩者都是合法的 heap；但前者最壞 O(n log n)，後者 O(n)。</div>'
      + '<div class="lab-trap">max-heapify(A, i) 的前提：i 的左右子樹「已經」是 heap。所以 build-heap 必須從 ⌊n/2⌋ 往回做到 1，不能從 1 往下。</div>'
      + '<div class="lab-trap">heap 找「任意一個值」或找最小值（在 max heap 裡）都是 O(n)：heap 只保證父子關係，不是排序好的。</div>'
      + '<p class="src">MIT 6.006 L4 用 max-heapify／build-max-heap；洪逸／Horowitz 的同一個函式叫 adjust。d-heap（每個節點 d 個孩子）只在部分考題出現：parent = ⌊(i−2)/d⌋+1（1-based），高度 log<sub>d</sub> n。</p>';
  }

  let qs = { score: 0, total: 0 };
  const fmt = (a) => a.join(', ');
  function mkOpts(ans, cands) {
    const s = [ans];
    for (const c of cands) if (s.length < 4 && !s.includes(c)) s.push(c);
    return s;
  }
  function genQ() {
    const t = Math.floor(Math.random() * 6);
    if (t === 0) {
      const v = randVals(6 + Math.floor(Math.random() * 2));
      const ans = fmt(insertPure(v));
      const wrong1 = fmt(buildPure(v));
      const sortedD = fmt([...v].sort((a, b) => b - a));
      const tw = insertPure(v); [tw[tw.length - 1], tw[tw.length - 2]] = [tw[tw.length - 2], tw[tw.length - 1]];
      return { q: '依序 insert ' + v.join(', ') + ' 到空的 Max Heap，最後陣列 heap[1..n] 是？', opts: mkOpts(ans, [wrong1, sortedD, fmt(tw), fmt(v)]), ans,
        why: '每次放在最後一格再往上浮（sift-up）。' + (wrong1 !== ans ? '注意 bottom-up 建堆的結果是 ' + wrong1 + '，不一樣。' : '') };
    }
    if (t === 1) {
      const v = randVals(7 + Math.floor(Math.random() * 3));
      const ans = fmt(buildPure(v));
      const ins = fmt(insertPure(v));
      const onlyRoot = [null, ...v]; siftDownPure(onlyRoot, 1, v.length, 'max');
      const topDown = [null, ...v]; for (let i = 1; i <= v.length >> 1; i++) siftDownPure(topDown, i, v.length, 'max');
      return { q: '陣列 A[1..' + v.length + '] = ' + v.join(', ') + '，用 bottom-up（i = ⌊n/2⌋ 到 1 做 max-heapify）建 Max Heap，結果是？',
        opts: mkOpts(ans, [ins, fmt(topDown.slice(1)), fmt(onlyRoot.slice(1)), fmt([...v].sort((a, b) => b - a))]), ans,
        why: '從 i = ' + (v.length >> 1) + ' 做回 1，每次的左右子樹都已經是 heap。從 1 往下做（top-down）是常見錯誤。' };
    }
    if (t === 2) {
      const h = buildPure(randVals(7 + Math.floor(Math.random() * 4)));
      const ans = fmt(deletePure(h));
      const noSift = h.slice(); noSift[0] = noSift.pop();
      const leftOnly = [null, ...h]; leftOnly[1] = leftOnly.pop();
      { let i = 1; const n = leftOnly.length - 1; while (2 * i <= n && leftOnly[2 * i] > leftOnly[i]) { [leftOnly[i], leftOnly[2 * i]] = [leftOnly[2 * i], leftOnly[i]]; i *= 2; } }
      return { q: 'Max Heap = ' + fmt(h) + '，做一次 extract-max（delete-max）之後陣列是？', opts: mkOpts(ans, [fmt(noSift), fmt(leftOnly.slice(1)), fmt(h.slice(1)), fmt(insertPure(h.slice(1)))]), ans,
        why: '最後一個 ' + h[h.length - 1] + ' 搬到根，再和「較大的」孩子交換往下沉。只看左孩子、或搬上來就不管，都是錯的。' };
    }
    if (t === 3) {
      const i = 2 + Math.floor(Math.random() * 12);
      const which = Math.floor(Math.random() * 3);
      const name = ['parent', 'left child', 'right child'][which];
      const ans = String([i >> 1, 2 * i, 2 * i + 1][which]);
      const zero = String([Math.floor((i - 1) / 2), 2 * i + 1, 2 * i + 2][which]);
      return { q: '陣列從 [1] 開始存 heap（Horowitz／CLRS 慣例），節點 i = ' + i + ' 的 ' + name + ' 索引是？',
        opts: mkOpts(ans, [zero, String(i + 1), String(Math.max(1, i - 1)), String(2 * i - 1)]), ans,
        why: '1-based：parent = ⌊i/2⌋、left = 2i、right = 2i+1。' + zero + ' 是 0-based 的公式算出來的。' };
    }
    if (t === 4) {
      const items = [
        ['bottom-up build-heap（n 個元素）', 'O(n)'], ['heap sort', 'O(n log n)'], ['Max Heap 的 insert', 'O(log n)'],
        ['Max Heap 找最大值', 'O(1)'], ['在 Max Heap 裡找最小值', 'O(n)'], ['逐一 insert n 個元素建 heap（最壞）', 'O(n log n)'], ['max-heapify(A, i)', 'O(log n)'],
      ];
      const [q, ans] = items[Math.floor(Math.random() * items.length)];
      return { q: q + ' 的時間複雜度是？', opts: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], ans,
        why: 'build-heap 用「越高的節點越少」的精算是 O(n)；max heap 的最小值一定在葉子，但葉子有約 n/2 個要全看。' };
    }
    const v = randVals(3 + Math.floor(Math.random() * 6));
    const n = v.length + 6 + Math.floor(Math.random() * 3);
    const leaves = n - (n >> 1);
    return { q: '有 ' + n + ' 個元素的 heap（陣列 1..n），有幾個葉子？build-heap 從哪個 i 開始做？',
      opts: mkOpts(leaves + ' 個；從 i = ' + (n >> 1), [(n >> 1) + ' 個；從 i = ' + leaves, leaves + ' 個；從 i = ' + n, (leaves - 1) + ' 個；從 i = ' + ((n >> 1) + 1)]), ans: leaves + ' 個；從 i = ' + (n >> 1),
      why: 'A[⌊n/2⌋+1 .. n] 都是葉子，共 ⌈n/2⌉ = ' + leaves + ' 個（MIT 講義：leaves are good）。' };
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
        const pick = decodeURIComponent(btn.dataset.o);
        qs.total++; if (pick === p.ans) qs.score++;
        el.querySelectorAll('.lab-quiz-opts button').forEach((b) => {
          const o = decodeURIComponent(b.dataset.o);
          if (o === p.ans) b.classList.add('right'); else if (b === btn) b.classList.add('wrong');
        });
        $('qx').innerHTML = '<div class="lab-quiz-explain">' + (pick === p.ans ? '答對了。' : '答錯了。') + p.why + '</div><button class="lab-next" id="qNext">下一題</button>';
        $('qNext').onclick = () => renderQuiz(el);
      };
    });
  }

  // ───────────────────────── 舞台場景（MIT 6.006 L4 的順序） ─────────────────────────
  const scenes = {
    'heap-as-array': { title: '把陣列看成樹：parent = i/2、left = 2i、right = 2i+1', play: async (tok) => {
      H.kind = 'max'; enterMap(MIT_HEAP);
      say('陣列 16, 14, 10, 8, 7, 9, 3, 2, 4, 1', '[1] 是根，[0] 不用');
      await beat(tok, 2200);
      say('由左到右讀陣列 = 由上到下讀樹', 'level order');
      await walkLevelOrder();
      await beat(tok, 600);
      showRelatives(2);
      say('i = 2：parent 是 1，孩子是 4 和 5', 'parent = ⌊i/2⌋、left = 2i、right = 2i+1');
      await beat(tok, 3000);
      showRelatives(5);
      say('i = 5：只有左孩子 [10]', '2·5 = 10，2·5+1 = 11 > n');
      await beat(tok, 3000);
      mark([[1, EMI.ok], [2, EMI.ok], [3, EMI.ok], [4, EMI.ok], [5, EMI.ok]]);
      say('每個父節點 ≥ 孩子：這是 max-heap', 'max-heap property：key(父) ≥ key(子)');
      await beat(tok, 3000);
    } },
    'max-heapify': { title: 'max-heapify(A, 2)：修正單一個違規', play: async (tok) => {
      H.kind = 'max'; enterMap(MIT_HEAPIFY); H.mode = 'pq';
      say('4 比孩子 14 小：違反 max-heap', 'A = 16, 4, 10, 14, 7, 9, 3, 2, 8, 1');
      mark([[2, EMI.swap]]); pointAt(2, 'i = 2');
      await beat(tok, 2600);
      say('前提：左右子樹已經是 max-heap', 'max-heapify(A, 2)');
      mark([[4, EMI.ok], [8, EMI.ok], [9, EMI.ok], [5, EMI.ok], [10, EMI.ok]]);
      await beat(tok, 2400);
      H.cmp = 0; H.sw = 0;
      say('和「較大的孩子」交換，一路往下', '交換 A[2]↔A[4]，再 A[4]↔A[9]');
      await siftDown(2, H.n);
      say('最多走樹高那麼多層', '<span class="ok">O(log n)</span>');
      await beat(tok, 3000);
    } },
    'build-max-heap': { title: 'build-max-heap：從 n/2 做回 1', play: async (tok) => {
      H.kind = 'max'; enterBuild(CLRS_BUILD);
      say('亂序陣列：4, 1, 3, 2, 16, 9, 10, 14, 8, 7', '葉子 A[6..10] 本來就是 heap');
      for (let i = 6; i <= 10; i++) mark([...hlList, [i, EMI.ok]]);
      await beat(tok, 2600);
      say('i 從 ⌊n/2⌋ = 5 往回做到 1', 'for i = ⌊n/2⌋ downto 1: max-heapify(A, i)');
      await beat(tok, 1600);
      await buildHeap(true);
      say('完成：根是最大值 16', 'A = ' + arrText());
      await beat(tok, 3000);
    } },
    'build-heap-cost': { title: '為什麼 build-max-heap 是 Θ(n)', play: async (tok) => {
      H.kind = 'max'; enterBuild([...CLRS_BUILD, 5, 6, 11, 12, 13]);
      say('粗估：n/2 次，每次 O(log n)', 'O(n log n)——對，但不夠緊');
      await beat(tok, 2800);
      const n = H.n;
      const byH = {};
      for (let i = 1; i <= n; i++) { const h = heightOf(i, n); (byH[h] = byH[h] || []).push(i); }
      const txt = [];
      for (const h of Object.keys(byH).map(Number).sort((a, b) => a - b)) {
        mark(byH[h].map((i) => [i, h === 0 ? EMI.ok : EMI.cur]));
        txt.push(byH[h].length + '×' + h);
        say(h === 0 ? '葉子約 n/2 個：0 工作' : '高度 ' + h + '：' + byH[h].length + ' 個節點，各最多 ' + h + ' 步', '總工作 ≤ ' + txt.join(' + '));
        await beat(tok, 2200);
      }
      const total = Object.keys(byH).reduce((s, h) => s + h * byH[h].length, 0);
      mark([]);
      say('越高的節點越少：總和 ≤ ' + total + ' < n = ' + n, 'n/4·1c + n/8·2c + n/16·3c + … = c·2ᵏ·Σ(i+1)/2ⁱ = <span class="ok">Θ(n)</span>');
      await beat(tok, 4000);
    } },
    'pq-insert': { title: 'Priority Queue：insert 與 increase-key', play: async (tok) => {
      H.kind = 'max'; enterPQ(MIT_HEAP);
      say('increase-key：把 A[9] 的 4 改成 15', '只會和 parent 衝突 → 往上浮');
      await beat(tok, 1800);
      await changeKey(9, 15);
      say('15 浮到 [2]：比 16 小就停', '<span class="ok">O(log n)</span>');
      await beat(tok, 2400);
      say('insert(13)：先放最後一格，再往上浮', '放在 A[11]，parent = A[5]');
      await heapInsert(13);
      await beat(tok, 2600);
    } },
    'extract-max': { title: 'extract-max：最後一個搬到根再往下沉', play: async (tok) => {
      H.kind = 'max'; enterPQ(MIT_HEAP);
      say('取出最大值 16', 'max() 是 O(1)，extract-max 還要修');
      await beat(tok, 1600);
      await extractTop();
      say('1 搬上根後一路沉下去', '<span class="ok">O(log n)</span>');
      await beat(tok, 2200);
      await extractTop();
      say('再取一次：每次都拿到剩下最大的', '一直 extract-max → 由大到小 = 排序');
      await beat(tok, 2800);
    } },
    'heap-sort': { title: 'Heap Sort：A[1] 換到尾端、heap size − 1', play: async (tok) => {
      H.kind = 'max'; enterSort([4, 1, 3, 2, 16, 9, 10]);
      say('第一步：build-max-heap', 'O(n)');
      await beat(tok, 1400);
      await buildHeap(true);
      say('A[1] 和 A[n] 交換，最大值到尾端', 'heap size − 1，再 max-heapify(A, 1)');
      await beat(tok, 1600);
      for (let i = H.n; i >= 2; i--) {
        mark([[1, EMI.cur], [i, EMI.swap]]);
        await beat(tok, 450);
        await swapAnim(1, i, 560);
        H.size = i - 1; sortedDown(i); drawEdges(); mark([]); renderState();
        say('綠色＝已排好，前面仍是 heap', '已排好：' + arrText(i, H.n));
        await beat(tok, 450);
        await siftDown(1, H.size, true);
      }
      sortedDown(1); H.size = 0; drawEdges(); pointAt(0); renderState();
      say('由小到大排好了', 'O(n) + (n−1)·O(log n) = <span class="ok">O(n log n)</span>');
      await beat(tok, 3200);
    } },
    'minmax-heap': { title: 'Min-Max Heap：insert 走祖父鏈（洪逸 9.1）', play: async (tok) => {
      enterMinMax(HZ_MINMAX);
      say('min 層、max 層交錯；根是最小值', '最大值在第 2 層：max(70, 40) = 70');
      await beat(tok, 2600);
      say('insert 5：parent 10 在 min 層，5 更小', '和 parent 換，再沿 min 層祖父往上');
      await mmInsert(5);
      say('5 成為新的根（最小值）', 'i → i/4 → … 只檢查同類層');
      await beat(tok, 2800);
      enterMinMax(HZ_MINMAX);
      say('insert 80：比 parent 10 大', '走 max 層的祖父鏈：80 > 40');
      await beat(tok, 1400);
      await mmInsert(80);
      say('80 停在 max 層 [3]', '<span class="ok">O(log n)</span>');
      await beat(tok, 2800);
    } },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ heapb.js ═══
  {
// ─── B7hVxCmfPtM：MIT 6.006 L4「Heaps and Heap Sort」（priority queue、max-heapify、build-max-heap Θ(n)、heap sort） ───
// 舊場景（heap-as-array、max-heapify、build-max-heap、build-heap-cost）沿用；這裡補其餘段落。陣列 1-based。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, line, ghostBox, GOLD, GREEN, RED, GRAY } = K;
const say = ctx.say, beat = ctx.beat, colorFor = ctx.colorFor;
const BLUE = '#1f3a6e';
const QLY = [6.2, 4.7, 3.2, 1.7];
const QCAM = [0, 6, 15.5], QLOOK = [0, 3.3, 1];
// 一棵 heap：上面是樹、下面是陣列格（同一份資料兩種畫法）
function qTree(vals, o = {}) {
  const W = o.w || 11, X0 = o.x0 || 0, cap = o.cap || vals.length, arr = o.arr !== false;
  const cz = o.cz === undefined ? 3.4 : o.cz, dx = o.dx || 0.9, sz = o.sz || 0.9, min = !!o.min;
  const better = (x, y) => (min ? x < y : x > y);
  const GT = min ? '<' : '>', GE = min ? '≤' : '≥', BIG = min ? '小' : '大';
  const col = (v) => (o.color ? o.color(v) : colorFor(v));
  const S = { a: [null], nd: [null], cl: [null], ed: [null], size: 0, cap };
  S.p = (i) => { const d = Math.floor(Math.log2(i)), c = 1 << d; return V3(X0 + ((i - c + 0.5) / c - 0.5) * W, QLY[d], 0); };
  S.c = (i) => V3(X0 + (i - (cap + 1) / 2) * dx, 0.3, cz);
  if (arr) for (let i = 1; i <= cap; i++) { const c = S.c(i); ctx.tile(V3(c.x, 0.02, c.z), dx * 0.92, 0.9); tag('[' + i + ']', 'idx', c.x, 0.05, c.z + 0.75); }
  S.node = (i, v, drop = 0) => {
    S.a[i] = v; const p = S.p(i);
    if (i > 1 && !S.ed[i]) { const q = S.p(i >> 1); S.ed[i] = line(q.x, q.y, p.x, p.y); }
    S.nd[i] = cube(v, col(v), [sz, sz, sz], p.x, p.y, 0, drop);
  };
  S.cell = (i, v, drop = 0) => { S.a[i] = v; if (!arr) return; const c = S.c(i); S.cl[i] = cube(v, col(v), [dx * 0.72, 0.42, 0.7], c.x, c.y, c.z, drop ? 2 : 0); };
  S.put = (i, v, drop = 0) => { S.node(i, v, drop); S.cell(i, v, drop); S.size = Math.max(S.size, i); };
  vals.forEach((v, k) => { if (v === null || v === undefined) return; if (o.cellsOnly) S.cell(k + 1, v); else S.put(k + 1, v); });
  if (o.cellsOnly) S.size = 0;
  const szl = o.sizeTag && arr ? tag('', 'ptr', 0, 1.15, cz) : null;
  S.setSize = (k) => { S.size = k; if (!szl) return; const c = S.c(Math.max(1, k)); txt(szl, 'heap size = ' + k); szl.position.set(c.x, 1.15, cz); };
  if (szl) S.setSize(S.size);
  S.hl = (list, c) => list.forEach((i) => { if (S.nd[i]) glow(S.nd[i], c); if (S.cl[i]) glow(S.cl[i], c); });
  S.off = () => { for (let i = 1; i <= cap; i++) { if (S.nd[i]) glow(S.nd[i], null); if (S.cl[i]) glow(S.cl[i], null); } };
  S.sw = async (tok, i, j, ms = 800) => {
    const pi = S.p(i), pj = S.p(j);
    if (S.nd[i]) move(S.nd[i], pj.x, pj.y, 0); if (S.nd[j]) move(S.nd[j], pi.x, pi.y, 0);
    if (S.cl[i] && S.cl[j]) { const ci = S.c(i), cj = S.c(j); move(S.cl[i], cj.x, cj.y, cj.z); move(S.cl[j], ci.x, ci.y, ci.z); }
    [S.nd[i], S.nd[j]] = [S.nd[j], S.nd[i]]; [S.cl[i], S.cl[j]] = [S.cl[j], S.cl[i]]; [S.a[i], S.a[j]] = [S.a[j], S.a[i]];
    await beat(tok, ms);
  };
  // 把位置 i 的元素搬到空位 j（樹與陣列一起搬）
  S.mv = (i, j) => {
    const p = S.p(j);
    if (S.nd[i]) move(S.nd[i], p.x, p.y, 0);
    if (S.cl[i]) { const c = S.c(j); move(S.cl[i], c.x, c.y, c.z); }
    S.nd[j] = S.nd[i]; S.cl[j] = S.cl[i]; S.a[j] = S.a[i]; S.nd[i] = null; S.cl[i] = null; S.a[i] = null;
    if (S.ed[i]) { kill(S.ed[i]); S.ed[i] = null; }
    if (j > 1 && !S.ed[j]) { const q = S.p(j >> 1); S.ed[j] = line(q.x, q.y, p.x, p.y); }
  };
  // insert 的調整：由葉子往根（向上）
  S.up = async (tok, i, ms = 900) => {
    while (i > 1) {
      const p = i >> 1; S.off(); S.hl([i], GOLD); S.hl([p], BLUE);
      if (!better(S.a[i], S.a[p])) { say(S.a[i] + ' ' + (min ? '≥' : '≤') + ' parent ' + S.a[p] + '：停', 'parent = ⌊' + i + '/2⌋ = ' + p); await beat(tok, ms); break; }
      say(S.a[i] + ' ' + GT + ' parent ' + S.a[p] + '：往上換', 'parent = ⌊' + i + '/2⌋ = ' + p);
      await beat(tok, ms * 0.6);
      await S.sw(tok, i, p, ms); i = p;
    }
    S.off(); return i;
  };
  // delete／heapify 的調整：由根往葉子（向下），和較大（min-heap 是較小）的孩子換
  S.down = async (tok, i, size, ms = 900) => {
    while (2 * i <= size) {
      const l = 2 * i, r = l + 1; let c = l; if (r <= size && better(S.a[r], S.a[l])) c = r;
      S.off(); S.hl([i], GOLD); S.hl(r <= size ? [l, r] : [l], BLUE);
      say('孩子 ' + (r <= size ? S.a[l] + '、' + S.a[r] : S.a[l]) + '：較' + BIG + '的是 ' + S.a[c], 'left = 2·' + i + ' = ' + l + (r <= size ? '，right = ' + r : ''));
      await beat(tok, ms);
      if (!better(S.a[c], S.a[i])) { say(S.a[i] + ' ' + GE + ' ' + S.a[c] + '：不用換', '停在 [' + i + ']'); await beat(tok, ms); break; }
      say(S.a[c] + ' ' + GT + ' ' + S.a[i] + '：交換', 'A[' + i + '] ↔ A[' + c + ']');
      await S.sw(tok, i, c, ms); i = c;
    }
    S.off(); return i;
  };
  // 刪除根：最後一個補到根，再往下調；keep = 把刪掉的值放進空出來的格子
  S.pop = async (tok, ms = 900, keep = true) => {
    const n = S.size, top = S.a[1];
    S.off(); S.hl([1], RED);
    say('刪除根 ' + top, '只能刪 root（A[1]）');
    await beat(tok, ms);
    fly(S.nd[1]); S.nd[1] = null;
    const topCell = S.cl[1]; S.cl[1] = null;
    if (n > 1) { S.mv(n, 1); if (S.ed[n]) { kill(S.ed[n]); S.ed[n] = null; } }
    if (topCell) {
      if (keep) { const cn = S.c(n); glow(topCell, null); move(topCell, cn.x, cn.y, cn.z); tint(topCell, GRAY); S.cl[n] = topCell; }
      else fly(topCell, V3(0, 6, 5));
    }
    S.a[n] = keep ? top : null;
    S.setSize(n - 1);
    if (n > 1) say('最後一個 ' + S.a[1] + ' 補到根', keep ? top + ' 放進空出來的 [' + n + ']' : 'heap size = ' + (n - 1));
    await beat(tok, ms);
    await S.down(tok, 1, n - 1, ms);
    return top;
  };
  return S;
}
const qGap = (S, list) => list.map((i) => { const c = S.c(i); return tag('空', 'ptr', c.x, 0.95, c.z); });

const HB_HEAP = [16, 14, 10, 8, 7, 9, 3, 2, 4, 1];       // 板書上的 max-heap
const HB_HEAPIFY = [16, 4, 10, 14, 7, 9, 3, 2, 8, 1];    // max-heapify(A, 2) 的例子

// 01:06 priority queue 的操作
FRAG.push(['heapb-pq-ops', 'Priority Queue 的四個操作', async (tok) => {
  fresh([0, 6, 13], [0, 2.8, 0]);
  const C = code(['insert(S, x)', 'max(S)', 'extract_max(S)', 'increase_key(S, x, k)'], 0, 6.6, 0.6);
  const xs = (i) => (i - 2.5) * 1.6;
  const keys = [7, 14, 10, 16, 8];
  const bs = keys.map((v, i) => cube(v, colorFor(v), [1.1, 0.8, 1.1], xs(i), 0.4, 1.2));
  say('集合 S：每個元素有一個 key', '要能很快拿到 key 最大的');
  await beat(tok, 2600);
  C.hl(0); const nx = cube(9, colorFor(9), [1.1, 0.8, 1.1], xs(5), 0.4, 1.2, 5);
  say('insert：把 x 放進 S', 'insert(S, 9)');
  await beat(tok, 2400);
  C.hl(1); glow(bs[3], GOLD);
  say('max：回傳 key 最大的元素', 'max(S) = 16，S 不變');
  await beat(tok, 2600);
  C.hl(2); fly(bs[3]);
  say('extract_max：回傳並從 S 移除', 'extract_max(S) = 16');
  await beat(tok, 2600);
  [bs[4], nx].forEach((b, k) => move(b, xs(3 + k), 0.4, 1.2));
  C.hl(3); glow(bs[0], BLUE);
  say('increase_key：把 x 的 key 改成 k', 'increase_key(S, x, 15)：7 → 15');
  await beat(tok, 1800);
  relabel(bs[0], 15); tint(bs[0], colorFor(15));
  await beat(tok, 2200);
  C.hl(-1); glow(bs[0], null);
  say('今天的 ADT：用 heap 實作', '目標：每個操作 O(log n) 以內');
  await beat(tok, 2800);
}]);

// 10:23 max-heap property
FRAG.push(['heapb-maxheap-check', 'max-heap property：逐一檢查 1–5', async (tok) => {
  fresh(QCAM, QLOOK);
  const S = qTree(HB_HEAP, { cap: 10 });
  say('max-heap：節點的 key ≥ 孩子的 key', '每個節點都要成立');
  await beat(tok, 2600);
  for (let i = 1; i <= 5; i++) {
    const kids = [2 * i, 2 * i + 1].filter((c) => c <= 10);
    S.off(); S.hl([i], GOLD); S.hl(kids, BLUE);
    say('i = ' + i + '：' + S.a[i] + ' ≥ ' + kids.map((c) => S.a[c]).join('、'), kids.length === 1 ? '[5] 只有一個孩子 [10]' : 'children = ' + kids.join('、'));
    await beat(tok, 1700);
  }
  S.off(); S.hl([6, 7, 8, 9, 10], GREEN);
  say('6–10 是葉子：不用檢查', '所以這是 max-heap');
  await beat(tok, 2600);
  S.off();
  say('min-heap：把 ≥ 換成 ≤', 'key(父) ≤ key(子)');
  await beat(tok, 2600);
}]);

// 12:48 max 與 extract_max
FRAG.push(['heapb-max-vs-extract', 'max 很簡單，extract_max 要維持 max-heap', async (tok) => {
  fresh(QCAM, QLOOK);
  const S = qTree(HB_HEAP, { cap: 10, sizeTag: true });
  S.hl([1], GOLD);
  say('max(S)：直接看根 A[1]', '16，heap 不變 → O(1)');
  await beat(tok, 2800);
  S.off(); S.hl([1], RED);
  say('extract_max：拿走 16 之後呢？', 'rep invariant：改完仍要是 max-heap');
  await beat(tok, 2800);
  S.off();
  const out = [];
  for (let k = 0; k < 4; k++) {
    const v = await S.pop(tok, k ? 380 : 750, false);
    out.push(cube(v, colorFor(v), [0.7, 0.5, 0.7], -5.6 + k * 0.95, 0.3, 5.4, 2));
    say('拿出 ' + v, '輸出：' + out.length + ' 個');
    await beat(tok, k ? 500 : 1000);
  }
  say('一直 extract_max：16, 14, 10, 9', '由大到小 → 可以拿來排序');
  await beat(tok, 3000);
}]);

// 14:59 為什麼需要 build-max-heap 與 max-heapify
FRAG.push(['heapb-build-goal', '亂序陣列 → max-heap：需要哪些操作', async (tok) => {
  fresh([0, 6, 13], [0, 3.6, 0.5]);
  const S = qTree([2, 4, 1], { cap: 3, w: 7 });
  say('一般陣列看成 heap，不一定是 max-heap', 'A = 2, 4, 1');
  await beat(tok, 2600);
  S.hl([1, 2], RED);
  say('2 < 4：不是 max-heap', '1 < 2：也不是 min-heap');
  await beat(tok, 2600);
  S.off();
  say('build-max-heap：要把它變成 4, 2, 1', '靠 max-heapify 修正違規');
  await beat(tok, 1600);
  await S.sw(tok, 1, 2, 900);
  S.hl([1], GREEN);
  say('現在是 max-heap', 'A = 4, 2, 1');
  await beat(tok, 2200);
  S.off();
  const C = code(['build_max_heap(A)', 'max_heapify(A, i)', 'insert / extract_max', 'heap_sort(A)'], 0, 8.4, 0.55);
  C.hl(0);
  say('今天要做的 heap 操作', '每個都要維持 max-heap property');
  await beat(tok, 2400);
  C.hl(1);
  say('最基本的是 max-heapify', '其他操作都靠它');
  await beat(tok, 3200);
}]);

// 18:05 max-heapify 的前提
FRAG.push(['heapb-heapify-contract', 'max-heapify 的前提：左右子樹已是 max-heap', async (tok) => {
  fresh(QCAM, QLOOK);
  const S = qTree(HB_HEAPIFY, { cap: 10 });
  say('max_heapify(A, i)', '只修「一個」違規');
  await beat(tok, 2200);
  const box = (i, kids) => {
    const ps = [i, ...kids].map(S.p), xs = ps.map((p) => p.x), ys = ps.map((p) => p.y);
    const w = Math.max(...xs) - Math.min(...xs) + 1.4, h = Math.max(...ys) - Math.min(...ys) + 1.4;
    const g = ghostBox('#2fc092', w, h, 1.4); g.position.set((Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2, 0); return g;
  };
  box(4, [8, 9]); box(5, [10]);
  S.hl([4, 8, 9, 5, 10], GREEN);
  say('前提：left(i)、right(i) 的子樹是 max-heap', 'i = 2：子樹 [4] 與 [5]');
  await beat(tok, 3000);
  S.off(); S.hl([2], RED);
  say('只有根 A[2] = 4 可能違規', '4 < 14');
  await beat(tok, 2600);
  say('前提不成立：不保證結果', '前提成立：回傳修好的 max-heap');
  await beat(tok, 2800);
  S.off(); S.hl([6, 7, 8, 9, 10], GREEN);
  say('葉子本來就是 max-heap', '由下往上：小 heap 合成大 heap');
  await beat(tok, 2800);
  S.off();
  say('heap size = 10', '排序時 heap size 會變小');
  await beat(tok, 2400);
}]);

// 25:44 max-heapify 是 O(log n)
FRAG.push(['heapb-heapify-logn', 'max-heapify 為什麼是 O(log n)', async (tok) => {
  fresh(QCAM, QLOOK);
  const S = qTree([1, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2], { cap: 15, arr: false, sz: 0.8 });
  for (let d = 0; d < 4; d++) tag('level ' + d, 'idx', -6.4, QLY[d], 0);
  say('heap 是 nearly complete binary tree', 'n = 15 時正好是 perfect binary tree');
  await beat(tok, 2600);
  say('高度 ≤ log n', 'h = ⌊log₂ 15⌋ = 3');
  await beat(tok, 2200);
  S.hl([1], RED);
  say('最壞：根要一路沉到葉子', '左右子樹都已是 max-heap');
  await beat(tok, 2200);
  await S.down(tok, 1, 15, 800);
  say('每層最多換一次：3 次', '<span class="ok">O(log n)</span>');
  await beat(tok, 2800);
  say('靠「只有一個違規」這個前提', '沒有前提，就不是只走一條路');
  await beat(tok, 2600);
}]);

// 34:42 build-max-heap 粗估 O(n log n)
FRAG.push(['heapb-build-naive', 'build-max-heap：粗估 O(n log n)', async (tok) => {
  fresh(QCAM, QLOOK);
  const S = qTree([4, 1, 3, 2, 16, 9, 10, 14, 8, 7], { cap: 10 });
  code(['for i = n/2 downto 1:', '    max_heapify(A, i)'], 0, 8.2, 0.55);
  say('呼叫 n/2 = 5 次 max-heapify', '每次最多 O(log n)');
  S.hl([1, 2, 3, 4, 5], GOLD);
  await beat(tok, 2800);
  say('n/2 · O(log n) = O(n log n)', '是對的上界，但不夠緊');
  await beat(tok, 2800);
  S.off();
  S.hl([3, 4, 5], BLUE);
  [3, 4, 5].forEach((i) => { const p = S.p(i); tag('1 步', 'ptr', p.x, p.y + 0.85, 0); });
  say('葉子上一層：各約 1 步', '這種節點最多');
  await beat(tok, 2400);
  S.hl([2], GOLD); { const p = S.p(2); tag('2 步', 'ptr alt', p.x, p.y + 0.85, 0); }
  say('再上一層：最多 2 步', '節點變少');
  await beat(tok, 2200);
  S.hl([1], RED); { const p = S.p(1); tag('3 步', 'ptr alt', p.x - 1.2, p.y, 0); }
  say('根：log n 步，但只有 1 個', '越高越貴，但越少');
  await beat(tok, 2600);
  S.off();
  say('仔細數就會得到 Θ(n)', '同一個演算法，更好的分析');
  await beat(tok, 2800);
}]);

// 42:37 級數收斂
FRAG.push(['heapb-series', 'Σ (i+1)/2ⁱ 收斂到常數 → Θ(n)', async (tok) => {
  fresh([0, 5.5, 14], [0, 2.6, 0]);
  say('令 n/4 = 2ᵏ', 'c·2ᵏ·(1/2⁰ + 2/2¹ + 3/2² + … + (k+1)/2ᵏ)');
  await beat(tok, 3000);
  const SC = 1.2, base = 0.05, sx = 5.2;
  line(sx - 0.9, base + 4 * SC, sx + 0.9, base + 4 * SC, 0, '#6a4a00');
  tag('4', 'ptr alt', sx + 1.3, base + 4 * SC, 0);
  const fr = ['1/1', '2/2', '3/4', '4/8', '5/16', '6/32', '7/64'];
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const t = (i + 1) / Math.pow(2, i), h = Math.max(0.06, t * SC * 1.6), x = -5.4 + i * 1.25;
    cube(fr[i], colorFor(i + 1), [0.9, h, 0.9], x, h / 2, 0, 3);
    tag('i=' + i, 'idx', x, 0.05, 0.9);
    cube(null, colorFor(i + 1), [1.1, Math.max(0.03, t * SC), 1.1], sx, base + (sum + t / 2) * SC, 0, 3);
    sum += t;
    say('第 ' + i + ' 項：(i+1)/2ⁱ = ' + fr[i], '部分和 = ' + (Math.round(sum * 1000) / 1000));
    await beat(tok, 1400);
  }
  say('項越來越小：級數收斂', 'Σ (i+1)/2ⁱ ≤ 4（課堂說「約 2、小於 3」）');
  await beat(tok, 3200);
  say('有界常數 × c × 2ᵏ', 'c·(n/4)·4 = c·n → <span class="ok">Θ(n)</span>');
  await beat(tok, 3200);
}]);

// 47:50 heap sort 虛擬碼
FRAG.push(['heapb-heapsort-code', 'Heap Sort：A[1] ↔ A[n]、heap size − 1、max-heapify', async (tok) => {
  fresh(QCAM, QLOOK);
  const S = qTree(HB_HEAP, { cap: 10, sizeTag: true });
  const C = code(['1 build_max_heap(A)', '2 swap A[1] ↔ A[n]', '3 heap_size − 1', '4 max_heapify(A, 1)', '5 回到第 2 行'], -4.5, 8.6, 0.5);
  C.hl(0);
  say('先 build-max-heap', 'O(n)：已經是 16, 14, 10, …');
  await beat(tok, 2600);
  C.hl(1); S.hl([1, 10], GOLD);
  say('最大值 A[1] 和 A[n] 交換', '16 跑到陣列最後面');
  await beat(tok, 1400);
  await S.sw(tok, 1, 10, 900);
  S.off();
  C.hl(2); tint(S.nd[10], GRAY); tint(S.cl[10], GRAY); S.setSize(9);
  say('heap size − 1：丟掉 node 10', '16 已排好');
  await beat(tok, 2400);
  C.hl(3); S.hl([1], RED);
  say('新的根可能違規，孩子仍是 max-heap', 'max_heapify(A, 1)');
  await beat(tok, 2000);
  await S.down(tok, 1, 9, 750);
  C.hl(4);
  say('根又是最大值 14', '回到第 2 行，重複 n 次');
  await beat(tok, 2800);
}]);

// 50:42 小例子 4, 2, 1
FRAG.push(['heapb-heapsort-421', 'Heap Sort 小例子：4, 2, 1', async (tok) => {
  fresh([0, 6, 13], [0, 3.6, 0.5]);
  const S = qTree([4, 2, 1], { cap: 3, w: 7, sizeTag: true });
  say('4, 2, 1 是 max-heap', 'heap size = 3');
  await beat(tok, 2400);
  S.hl([1, 3], GOLD);
  say('4 和 1 交換', 'A = 1, 2, 4');
  await beat(tok, 1000);
  await S.sw(tok, 1, 3, 900);
  S.off(); tint(S.nd[3], GRAY); tint(S.cl[3], GRAY); S.setSize(2);
  say('丟掉 4：排序結果的第一個', 'heap size = 2');
  await beat(tok, 2400);
  S.hl([1], RED);
  say('1, 2 不是 max-heap', '孩子是 max-heap → max_heapify(A, 1)');
  await beat(tok, 1800);
  await S.down(tok, 1, 2, 850);
  S.hl([1, 2], GOLD);
  say('根 2 是最大：和 A[2] 交換', '丟掉 2，剩 1 個就完成');
  await beat(tok, 1000);
  await S.sw(tok, 1, 2, 900);
  S.off(); tint(S.nd[2], GRAY); tint(S.cl[2], GRAY); S.setSize(1);
  say('排序完成：1, 2, 4', 'build O(n) + n 次 max_heapify O(log n)');
  await beat(tok, 2600);
  say('整體 O(n log n)', '交換、取 max 都是 O(1)');
  await beat(tok, 2600);
}]);
  }

  // ═══ heaphq.js ═══
  {
// ─── HqPJF2L5h9U：Abdul Bari「Heap」（陣列表示、complete binary tree、insert／delete、heap sort、heapify、priority queue） ───
// 只用 K 與 ctx（這個片段也會裝進 ds-8）。陣列一律 1-based。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, line, GOLD, GREEN, RED, GRAY } = K;
const say = ctx.say, beat = ctx.beat, colorFor = ctx.colorFor;
const BLUE = '#1f3a6e';
const QLY = [6.2, 4.7, 3.2, 1.7];
const QCAM = [0, 6, 15.5], QLOOK = [0, 3.3, 1];
// 一棵 heap：上面是樹、下面是陣列格（同一份資料兩種畫法）
function qTree(vals, o = {}) {
  const W = o.w || 11, X0 = o.x0 || 0, cap = o.cap || vals.length, arr = o.arr !== false;
  const cz = o.cz === undefined ? 3.4 : o.cz, dx = o.dx || 0.9, sz = o.sz || 0.9, min = !!o.min;
  const better = (x, y) => (min ? x < y : x > y);
  const GT = min ? '<' : '>', GE = min ? '≤' : '≥', BIG = min ? '小' : '大';
  const col = (v) => (o.color ? o.color(v) : colorFor(v));
  const S = { a: [null], nd: [null], cl: [null], ed: [null], size: 0, cap };
  S.p = (i) => { const d = Math.floor(Math.log2(i)), c = 1 << d; return V3(X0 + ((i - c + 0.5) / c - 0.5) * W, QLY[d], 0); };
  S.c = (i) => V3(X0 + (i - (cap + 1) / 2) * dx, 0.3, cz);
  if (arr) for (let i = 1; i <= cap; i++) { const c = S.c(i); ctx.tile(V3(c.x, 0.02, c.z), dx * 0.92, 0.9); tag('[' + i + ']', 'idx', c.x, 0.05, c.z + 0.75); }
  S.node = (i, v, drop = 0) => {
    S.a[i] = v; const p = S.p(i);
    if (i > 1 && !S.ed[i]) { const q = S.p(i >> 1); S.ed[i] = line(q.x, q.y, p.x, p.y); }
    S.nd[i] = cube(v, col(v), [sz, sz, sz], p.x, p.y, 0, drop);
  };
  S.cell = (i, v, drop = 0) => { S.a[i] = v; if (!arr) return; const c = S.c(i); S.cl[i] = cube(v, col(v), [dx * 0.72, 0.42, 0.7], c.x, c.y, c.z, drop ? 2 : 0); };
  S.put = (i, v, drop = 0) => { S.node(i, v, drop); S.cell(i, v, drop); S.size = Math.max(S.size, i); };
  vals.forEach((v, k) => { if (v === null || v === undefined) return; if (o.cellsOnly) S.cell(k + 1, v); else S.put(k + 1, v); });
  if (o.cellsOnly) S.size = 0;
  const szl = o.sizeTag && arr ? tag('', 'ptr', 0, 1.15, cz) : null;
  S.setSize = (k) => { S.size = k; if (!szl) return; const c = S.c(Math.max(1, k)); txt(szl, 'heap size = ' + k); szl.position.set(c.x, 1.15, cz); };
  if (szl) S.setSize(S.size);
  S.hl = (list, c) => list.forEach((i) => { if (S.nd[i]) glow(S.nd[i], c); if (S.cl[i]) glow(S.cl[i], c); });
  S.off = () => { for (let i = 1; i <= cap; i++) { if (S.nd[i]) glow(S.nd[i], null); if (S.cl[i]) glow(S.cl[i], null); } };
  S.sw = async (tok, i, j, ms = 800) => {
    const pi = S.p(i), pj = S.p(j);
    if (S.nd[i]) move(S.nd[i], pj.x, pj.y, 0); if (S.nd[j]) move(S.nd[j], pi.x, pi.y, 0);
    if (S.cl[i] && S.cl[j]) { const ci = S.c(i), cj = S.c(j); move(S.cl[i], cj.x, cj.y, cj.z); move(S.cl[j], ci.x, ci.y, ci.z); }
    [S.nd[i], S.nd[j]] = [S.nd[j], S.nd[i]]; [S.cl[i], S.cl[j]] = [S.cl[j], S.cl[i]]; [S.a[i], S.a[j]] = [S.a[j], S.a[i]];
    await beat(tok, ms);
  };
  // 把位置 i 的元素搬到空位 j（樹與陣列一起搬）
  S.mv = (i, j) => {
    const p = S.p(j);
    if (S.nd[i]) move(S.nd[i], p.x, p.y, 0);
    if (S.cl[i]) { const c = S.c(j); move(S.cl[i], c.x, c.y, c.z); }
    S.nd[j] = S.nd[i]; S.cl[j] = S.cl[i]; S.a[j] = S.a[i]; S.nd[i] = null; S.cl[i] = null; S.a[i] = null;
    if (S.ed[i]) { kill(S.ed[i]); S.ed[i] = null; }
    if (j > 1 && !S.ed[j]) { const q = S.p(j >> 1); S.ed[j] = line(q.x, q.y, p.x, p.y); }
  };
  // insert 的調整：由葉子往根（向上）
  S.up = async (tok, i, ms = 900) => {
    while (i > 1) {
      const p = i >> 1; S.off(); S.hl([i], GOLD); S.hl([p], BLUE);
      if (!better(S.a[i], S.a[p])) { say(S.a[i] + ' ' + (min ? '≥' : '≤') + ' parent ' + S.a[p] + '：停', 'parent = ⌊' + i + '/2⌋ = ' + p); await beat(tok, ms); break; }
      say(S.a[i] + ' ' + GT + ' parent ' + S.a[p] + '：往上換', 'parent = ⌊' + i + '/2⌋ = ' + p);
      await beat(tok, ms * 0.6);
      await S.sw(tok, i, p, ms); i = p;
    }
    S.off(); return i;
  };
  // delete／heapify 的調整：由根往葉子（向下），和較大（min-heap 是較小）的孩子換
  S.down = async (tok, i, size, ms = 900) => {
    while (2 * i <= size) {
      const l = 2 * i, r = l + 1; let c = l; if (r <= size && better(S.a[r], S.a[l])) c = r;
      S.off(); S.hl([i], GOLD); S.hl(r <= size ? [l, r] : [l], BLUE);
      say('孩子 ' + (r <= size ? S.a[l] + '、' + S.a[r] : S.a[l]) + '：較' + BIG + '的是 ' + S.a[c], 'left = 2·' + i + ' = ' + l + (r <= size ? '，right = ' + r : ''));
      await beat(tok, ms);
      if (!better(S.a[c], S.a[i])) { say(S.a[i] + ' ' + GE + ' ' + S.a[c] + '：不用換', '停在 [' + i + ']'); await beat(tok, ms); break; }
      say(S.a[c] + ' ' + GT + ' ' + S.a[i] + '：交換', 'A[' + i + '] ↔ A[' + c + ']');
      await S.sw(tok, i, c, ms); i = c;
    }
    S.off(); return i;
  };
  // 刪除根：最後一個補到根，再往下調；keep = 把刪掉的值放進空出來的格子
  S.pop = async (tok, ms = 900, keep = true) => {
    const n = S.size, top = S.a[1];
    S.off(); S.hl([1], RED);
    say('刪除根 ' + top, '只能刪 root（A[1]）');
    await beat(tok, ms);
    fly(S.nd[1]); S.nd[1] = null;
    const topCell = S.cl[1]; S.cl[1] = null;
    if (n > 1) { S.mv(n, 1); if (S.ed[n]) { kill(S.ed[n]); S.ed[n] = null; } }
    if (topCell) {
      if (keep) { const cn = S.c(n); glow(topCell, null); move(topCell, cn.x, cn.y, cn.z); tint(topCell, GRAY); S.cl[n] = topCell; }
      else fly(topCell, V3(0, 6, 5));
    }
    S.a[n] = keep ? top : null;
    S.setSize(n - 1);
    if (n > 1) say('最後一個 ' + S.a[1] + ' 補到根', keep ? top + ' 放進空出來的 [' + n + ']' : 'heap size = ' + (n - 1));
    await beat(tok, ms);
    await S.down(tok, 1, n - 1, ms);
    return top;
  };
  return S;
}
const qGap = (S, list) => list.map((i) => { const c = S.c(i); return tag('空', 'ptr', c.x, 0.95, c.z); });
const HQ_MAX = [50, 30, 20, 15, 10, 8, 16];

// 02:29 陣列表示
FRAG.push(['heaphq-array-rep', '用陣列存 Binary Tree：A–G 與三個公式', async (tok) => {
  fresh(QCAM, QLOOK);
  const S = qTree([], { cap: 7, color: () => '#4b9ee2' });
  say('用陣列存樹：元素和父子關係都要存', 'index 從 1 開始（課堂慣例）');
  await beat(tok, 2400);
  for (const [k, v] of ['A', 'B', 'C', 'D', 'E', 'F', 'G'].entries()) { S.put(k + 1, v, 3); say('一層一層、由左到右填：' + v, 'A[' + (k + 1) + '] = ' + v); await beat(tok, 650); }
  S.hl([2], GOLD); S.hl([4], GREEN);
  say('B 在 i = 2：左孩子在 2i', 'left = 2·2 = 4 → D');
  await beat(tok, 2200);
  S.off(); S.hl([2], GOLD); S.hl([5], GREEN);
  say('右孩子在 2i + 1', 'right = 2·2 + 1 = 5 → E');
  await beat(tok, 2200);
  S.off(); S.hl([3], GOLD); S.hl([6, 7], GREEN);
  say('C 在 i = 3：孩子在 6、7', 'left = 6 → F，right = 7 → G');
  await beat(tok, 2400);
  S.off(); S.hl([6], GOLD); S.hl([3], GREEN);
  say('F 在 6：parent = 6/2 = 3', 'parent = ⌊i/2⌋ → C');
  await beat(tok, 2200);
  S.off(); S.hl([7], GOLD); S.hl([3], GREEN);
  say('G 在 7：7/2 = 3.5，取 floor', '⌊7/2⌋ = 3 → C');
  await beat(tok, 2400);
  S.off();
  say('照層序填，公式自動成立', 'left = 2i、right = 2i + 1、parent = ⌊i/2⌋');
  await beat(tok, 2800);
}]);

// 05:38 缺節點要留空格
FRAG.push(['heaphq-array-gaps', '缺少的節點要在陣列留空格', async (tok) => {
  fresh(QCAM, QLOOK);
  let S = qTree([], { cap: 7, color: () => '#4b9ee2' });
  for (const [k, v] of ['A', 'B', 'C', 'D', 'E'].entries()) { S.put(k + 1, v, 3); say('A B C D E 一樣層序填', 'A[' + (k + 1) + '] = ' + v); await beat(tok, 550); }
  say('最後一層不滿也沒關係', '公式照樣成立');
  await beat(tok, 2200);
  fresh(QCAM, QLOOK);
  S = qTree([], { cap: 7, color: () => '#4b9ee2' });
  for (const [k, v] of ['A', 'B', 'C'].entries()) S.put(k + 1, v);
  say('這棵：D 是 C 的左孩子', 'B 沒有孩子');
  await beat(tok, 2200);
  S.put(4, 'D', 3); S.hl([4], RED);
  say('直接接著放 D 到 [4]？', '<span class="no">[4] = 2·2：D 變成 B 的左孩子</span>');
  await beat(tok, 2600);
  S.off(); S.mv(4, 6);
  say('D 要放在 [6] = 2·3', 'C 的左孩子');
  await beat(tok, 1800);
  qGap(S, [4, 5]);
  say('B 的兩個孩子位置要留空', 'A B C _ _ D');
  await beat(tok, 2400);
  S.hl([6], GOLD); S.hl([3], GREEN);
  say('D 的 parent：⌊6/2⌋ = 3 → C', '有缺的節點就留空格，公式才對');
  await beat(tok, 2800);
}]);

// 07:22 full vs complete
FRAG.push(['heaphq-full-complete', 'Full Binary Tree 與 Complete Binary Tree', async (tok) => {
  fresh(QCAM, QLOOK);
  const S = qTree(['A', 'B', 'C', 'D', 'E', 'F', 'G'], { cap: 9, color: () => '#4b9ee2' });
  for (let d = 0; d < 3; d++) tag('h ' + d, 'idx', -6.3, QLY[d], 0);
  say('高度 2：節點數已是最多', 'full：2^(h+1) − 1 = 2³ − 1 = 7');
  await beat(tok, 2800);
  say('再加一個節點，高度就會變 3', 'full binary tree：沒有空位');
  await beat(tok, 2200);
  tag('h 3', 'idx', -6.3, QLY[3], 0);
  S.put(8, 'H', 3); S.put(9, 'I', 3);
  say('Complete：陣列中間沒有空格', 'A … I 連續，後面的空位不算');
  await beat(tok, 2800);
  S.hl([8], RED);
  await beat(tok, 600);
  fly(S.nd[8]); fly(S.cl[8]); kill(S.ed[8]); S.nd[8] = S.cl[8] = S.ed[8] = null;
  const g = qGap(S, [8]);
  say('拿掉 H：[8] 變空格', '<span class="no">中間有空 → 不是 complete</span>');
  await beat(tok, 2800);
  kill(g[0]); S.mv(9, 8); S.hl([8], GREEN);
  say('課本定義：h − 1 層以上是 full', '最後一層由左往右填');
  await beat(tok, 2800);
  S.off();
  say('Full 一定也是 Complete', '（有人把 complete 叫 almost complete）');
  await beat(tok, 2600);
}]);

// 11:33 判斷 complete 的例子
FRAG.push(['heaphq-complete-check', '判斷是不是 Complete：看陣列有沒有空格', async (tok) => {
  const col = () => '#9b7ef4';
  fresh(QCAM, QLOOK);
  let S = qTree([1, 2, 3, 4, 5], { cap: 10, color: col });
  say('一層一層檢查：有沒有缺的', '從左邊開始，不能跳過');
  await beat(tok, 2200);
  say('1、2 個，最後一層從左邊開始', '<span class="ok">complete</span>');
  await beat(tok, 2800);
  fresh(QCAM, QLOOK);
  S = qTree([1, 2, 3, null, null, null, 4], { cap: 10, color: col });
  say('最後一層只有最右邊一個', '陣列：1 2 3 _ _ _ 4');
  await beat(tok, 1800);
  qGap(S, [4, 5, 6]);
  say('中間空了 3 格', '<span class="no">不是 complete</span>');
  await beat(tok, 2800);
  fresh(QCAM, QLOOK);
  S = qTree([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], { cap: 10, color: col });
  say('上面三層滿，最後一層靠左', '<span class="ok">complete</span>（之後沒節點不要緊）');
  await beat(tok, 2800);
  for (let d = 0; d < 4; d++) tag('h ' + d, 'idx', -6.3, QLY[d], 0);
  say('一層沒填滿不會往下長', '高度最小：h = ⌊log₂ n⌋ = ⌊log₂ 10⌋ = 3');
  await beat(tok, 3000);
}]);

// 14:11 max heap／min heap
FRAG.push(['heaphq-max-min', 'Max Heap 與 Min Heap', async (tok) => {
  fresh(QCAM, QLOOK);
  const A = qTree(HQ_MAX, { arr: false, w: 6, x0: -3.4, sz: 0.75 });
  tag('Max Heap', 'ptr alt', -3.4, 7.4, 0);
  say('Heap 先要是 complete binary tree', 'A = 50, 30, 20, 15, 10, 8, 16');
  await beat(tok, 2400);
  A.hl([2], GOLD); A.hl([4, 5], BLUE);
  say('30 ≥ 15、10', '每個節點 ≥ 所有子孫');
  await beat(tok, 1800);
  A.off(); A.hl([3], GOLD); A.hl([6, 7], BLUE);
  say('20 ≥ 8、16', '可以等於：允許重複');
  await beat(tok, 1800);
  A.off(); A.hl([1], GREEN);
  say('根是最大值 50', 'max heap');
  await beat(tok, 2200);
  const B = qTree([10, 30, 20, 35, 40, 32, 25], { arr: false, w: 6, x0: 3.4, sz: 0.75 });
  tag('Min Heap', 'ptr', 3.4, 7.4, 0);
  B.hl([2], GOLD); B.hl([4, 5], BLUE);
  say('35、40 ≥ 30，也 ≥ 10', '每個節點 ≤ 所有子孫');
  await beat(tok, 2200);
  B.off(); B.hl([1], GREEN);
  say('根是最小值 10', 'min heap');
  await beat(tok, 2600);
  say('之後都用 max heap 講', 'min heap 做法相同，方向相反');
  await beat(tok, 2400);
}]);

// 16:18 錯誤的 insert：塞進根
FRAG.push(['heaphq-insert-wrong', '常見錯誤：把 60 直接塞到根', async (tok) => {
  fresh(QCAM, QLOOK);
  const S = qTree(HQ_MAX, { cap: 15, dx: 0.74 });
  say('insert 60：60 最大，最後要在根', 'A = 50, 30, 20, 15, 10, 8, 16');
  await beat(tok, 3000);
  const p1 = S.p(1), n60 = cube(60, colorFor(60), [0.9, 0.9, 0.9], p1.x + 1.6, 7.6, 0);
  glow(n60, RED);
  say('錯誤想法：60 塞進根，其他往下推', '50 → 20 那邊 → 16 再往下');
  await beat(tok, 2200);
  S.mv(7, 15); say('16 被擠到 20 底下', '20 再往下推'); await beat(tok, 1200);
  S.mv(3, 7); say('20 被擠下去', '50 也往右下推'); await beat(tok, 1200);
  S.mv(1, 3); say('50 讓出根', '60 坐上根'); await beat(tok, 1200);
  move(n60, p1.x, p1.y, 0); S.nd[1] = n60; S.a[1] = 60; S.cell(1, 60, 1);
  say('樹往右下長出一條', '16 跑到 [15]');
  await beat(tok, 2800);
  qGap(S, [8, 9, 10, 11, 12, 13, 14]);
  say('陣列 [8]～[14] 全空', '<span class="no">不是 complete，不能這樣插</span>');
  await beat(tok, 3600);
}]);

// 18:02 正確的 insert
FRAG.push(['heaphq-insert-60', 'insert 60：放最後一格，再往上比', async (tok) => {
  fresh(QCAM, QLOOK);
  const S = qTree(HQ_MAX, { cap: 8 });
  say('正確：放在陣列下一個空位', '[8]：2·4 = 8 → 15 的左孩子');
  S.put(8, 60, 3);
  await beat(tok, 2600);
  S.hl([8], RED);
  say('還是 complete，但 60 > 15', '<span class="no">違反 max heap</span>');
  await beat(tok, 2200);
  await S.up(tok, 8, 950);
  S.hl([1], GREEN);
  say('60 到根：比較、交換 3 次', 'A = ' + S.a.slice(1).join(', '));
  await beat(tok, 2800);
  say('交換次數 ≤ 高度 = log n', '插入 6 就 0 次：O(1) ～ O(log n)');
  await beat(tok, 2800);
  S.off();
  say('insert：由葉子往根調整', '方向：向上');
  await beat(tok, 2400);
}]);

// 22:15 delete：只能刪根
FRAG.push(['heaphq-delete-50', 'Delete：刪根、最後一個補上、往下調', async (tok) => {
  fresh(QCAM, QLOOK);
  const S = qTree(HQ_MAX, { cap: 7, sizeTag: true });
  S.hl([1], GOLD);
  say('只能刪根：最大的 50', '像蘋果堆，只拿最上面那顆');
  await beat(tok, 2600);
  S.off(); S.hl([2, 4], RED);
  say('錯誤：30 補上去、15 再補上去', '<span class="no">[4] 空掉 → 不是 complete</span>');
  await beat(tok, 2800);
  S.off();
  await S.pop(tok, 1000, false);
  S.hl([1], GREEN);
  say('又是 max heap：30 在根', 'A = ' + S.a.slice(1, S.size + 1).join(', '));
  await beat(tok, 2600);
  S.off();
  say('delete：由根往葉子調整', '方向：向下，最多 log n 次 → O(log n)');
  await beat(tok, 2600);
}]);

// 27:51 刪掉的值放進空格
FRAG.push(['heaphq-delete-store', '刪除的值放進空出來的格子 → 排好序', async (tok) => {
  fresh(QCAM, QLOOK);
  const S = qTree([30, 16, 20, 15, 10, 8], { cap: 7, sizeTag: true });
  S.cell(7, 50); tint(S.cl[7], GRAY); S.a[7] = 50;
  say('heap size = 6，[7] 已不屬於 heap', '把刪掉的 50 存在 [7]');
  await beat(tok, 2800);
  await S.pop(tok, 900, true);
  say('8 在 [3]：size = 5，沒有孩子', '2·3 = 6 > 5 → 停');
  await beat(tok, 2600);
  say('一直刪：每次拿到剩下最大的', '刪掉的值依序放到尾端');
  await beat(tok, 1800);
  for (let k = 0; k < 4; k++) await S.pop(tok, 420, true);
  for (let i = 1; i <= 7; i++) if (S.cl[i]) tint(S.cl[i], '#2fc092');
  say('從左讀：由小到大排好了', 'A = ' + S.a.slice(1, 8).join(', ') + '：heap sort 的想法');
  await beat(tok, 3200);
}]);

// 30:55 heap sort 第一步：逐一 insert
FRAG.push(['heaphq-sort-build', 'Heap Sort 第一步：10 20 15 30 40 逐一 insert', async (tok) => {
  fresh(QCAM, QLOOK);
  const vals = [10, 20, 15, 30, 40];
  const S = qTree(vals, { cap: 5, cellsOnly: true, sizeTag: true });
  say('要排序：10, 20, 15, 30, 40', '第一步：建 heap；第二步：全部 delete');
  await beat(tok, 2600);
  for (let k = 1; k <= 5; k++) {
    S.node(k, S.a[k], 3); S.setSize(k); S.hl([k], GOLD);
    say(k === 1 ? '10 自己就是 heap' : 'insert ' + S.a[k] + '：放在 [' + k + ']', 'heap size = ' + k);
    await beat(tok, k === 1 ? 1800 : 1000);
    await S.up(tok, k, 700);
  }
  S.hl([1], GREEN);
  say('max heap 建好了', 'A = ' + S.a.slice(1, 6).join(', '));
  await beat(tok, 2600);
  S.off();
  say('n 個元素，每個最多爬 log n', '建 heap：O(n log n)');
  await beat(tok, 2600);
}]);

// 36:07 heap sort 第二步：全部 delete
FRAG.push(['heaphq-sort-delete', 'Heap Sort 第二步：一直 delete，放到空出的位置', async (tok) => {
  fresh(QCAM, QLOOK);
  const S = qTree([40, 30, 15, 10, 20], { cap: 5, sizeTag: true });
  say('從剛建好的 max heap 開始', 'A = 40, 30, 15, 10, 20');
  await beat(tok, 2200);
  for (let k = 0; k < 4; k++) await S.pop(tok, 650, true);
  for (let i = 1; i <= 5; i++) if (S.cl[i]) tint(S.cl[i], '#2fc092');
  say('排好了：10, 15, 20, 30, 40', '每次 delete O(log n)，共 n 次');
  await beat(tok, 2800);
  say('n log n（建）+ n log n（刪）', '2n log n = <span class="ok">O(n log n)</span>');
  await beat(tok, 2800);
}]);

// 41:35 heapify
FRAG.push(['heaphq-heapify', 'Heapify：由右往左掃，往下調整', async (tok) => {
  fresh(QCAM, QLOOK);
  const S = qTree([10, 20, 15, 12, 40, 25, 18], { cap: 7 });
  say('complete，但不是 max heap', 'A = 10, 20, 15, 12, 40, 25, 18');
  await beat(tok, 2400);
  say('從最後一個往前掃（由右往左）', '每個元素往下調整（像 delete 那樣）');
  await beat(tok, 2200);
  for (let i = 7; i >= 4; i--) { S.hl([i], GREEN); say(S.a[i] + ' 沒有孩子：自己就是 heap', 'i = ' + i); await beat(tok, 700); }
  S.off();
  for (let i = 3; i >= 1; i--) {
    S.hl([i], GOLD);
    say('i = ' + i + '：' + S.a[i] + ' 往下看', '它底下的子樹都已是 heap');
    await beat(tok, 1200);
    await S.down(tok, i, 7, 800);
  }
  S.hl([1], GREEN);
  say('max heap 完成', 'A = ' + S.a.slice(1, 8).join(', '));
  await beat(tok, 2600);
  S.off();
  say('heapify：O(n)', '逐一 insert 建 heap：O(n log n) → heapify 較快');
  await beat(tok, 2800);
}]);

// 46:51 priority queue
const HQ_PQ = [8, 6, 3, 10, 9];
const pqX = (i) => (i - 2) * 1.9;
FRAG.push(['heaphq-pq-priority', 'Priority Queue：數字本身就是 priority', async (tok) => {
  fresh([0, 6, 12], [0, 0.8, 0]);
  const bs = HQ_PQ.map((v, i) => cube(v, colorFor(v), [1.2, 0.9, 1.2], pqX(i), 0.45, 0, 4));
  say('Queue 是 FIFO；priority queue 不是', '刪除時拿 priority 最高的');
  await beat(tok, 2600);
  say('這裡數字本身就是 priority', '8 的 priority 是 8，3 的是 3');
  await beat(tok, 2400);
  const ord = [...HQ_PQ.keys()].sort((a, b) => HQ_PQ[a] - HQ_PQ[b]);
  const tags = [];
  say('規則一：數字越小，priority 越高', '先刪 3，再 6，再 8');
  for (let k = 0; k < 3; k++) { glow(bs[ord[k]], GOLD); tags.push(tag('#' + (k + 1), 'ptr', pqX(ord[k]), 1.6, 0)); await beat(tok, 900); }
  await beat(tok, 1400);
  tags.forEach(kill); bs.forEach((b) => glow(b, null)); tags.length = 0;
  say('規則二：數字越大，priority 越高', '先刪 10，再 9，再 8');
  for (let k = 0; k < 3; k++) { const i = ord[4 - k]; glow(bs[i], BLUE); tags.push(tag('#' + (k + 1), 'ptr alt', pqX(i), 1.6, 0)); await beat(tok, 900); }
  await beat(tok, 1400);
  say('兩種規則都可以，事先說好', '小的優先 → min heap；大的優先 → max heap');
  await beat(tok, 3000);
}]);

FRAG.push(['heaphq-pq-array-vs-heap', 'Priority Queue：用陣列 vs 用 Heap', async (tok) => {
  fresh([0, 6, 12], [0, 0.8, 0]);
  const xs = (i) => (i - 2.5) * 1.7;
  const bs = HQ_PQ.map((v, i) => cube(v, colorFor(v), [1.2, 0.9, 1.2], xs(i), 0.45, 0));
  say('用一般陣列：小的優先', 'A = 8, 6, 3, 10, 9');
  await beat(tok, 2200);
  const nx = cube('x', '#d8cfc0', [1.2, 0.9, 1.2], xs(5), 0.45, 0, 4);
  say('insert：直接放尾端', '<span class="ok">O(1)</span>');
  await beat(tok, 2200);
  glow(bs[2], RED);
  say('delete：要先找到 3', '最高 priority 可能在任何位置');
  await beat(tok, 1800);
  fly(bs[2]);
  [bs[3], bs[4], nx].forEach((b, k) => move(b, xs(2 + k), 0.45, 0));
  say('刪掉後後面全部往前移', '<span class="no">O(n)</span>');
  await beat(tok, 2600);
  say('改成保持排序？換 insert 要 O(n)', '總有一個操作是 O(n)');
  await beat(tok, 2600);
  fresh(QCAM, QLOOK);
  const S = qTree([3, 6, 8, 10, 9], { cap: 5, min: true, sizeTag: true });
  say('改用 min heap（同一組數字）', 'A = 3, 6, 8, 10, 9');
  await beat(tok, 2400);
  await S.pop(tok, 750, false);
  say('insert、delete 都只走一條路徑', '<span class="ok">O(log n)</span>');
  await beat(tok, 2600);
  say('heap 最適合實作 priority queue', '小的優先用 min heap，大的優先用 max heap');
  await beat(tok, 2800);
}]);
  }

  // ═══ heaplin.js ═══
  {
// ─── RjvhXL0WTrY：台大林軒田 DSA「Tree traversal / Heap」 ───
// 例子取自影片：expression tree 3 × (5 + 7)（infix / postfix / prefix print）；node = key + data（priority + to-do）；
// 只把最大放 root 的樹 14（6、8、12、5、9）；binary max tree 14 /(9: 4) /(12: 8, 5)，remove 14、remove 12；
// 歪斜的 max tree 50 49 46 44 21 17 5 3；complete binary max tree 14 12 9 4 8 5（5 換成 8.5）；
// remove largest = 最後一個（8.5）上 root 再往下換；insert 17 = 放最後再往上浮；陣列 14 12 9 4 8 8.5。
// 陣列 1-based：left = 2i、right = 2i + 1、parent = ⌊i/2⌋。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, line, arrow, ghostBox, lnode, GOLD, GREEN, RED, GRAY } = K;
const say = ctx.say, beat = ctx.beat;
const BLUE = '#1f3a6e', OPC = '#c9a25a', NODEC = '#4b9ee2';
const col = (v) => (typeof v === 'number' ? ctx.colorFor(Math.round(v * 2)) : OPC);
const CAM = [0, 4.6, 13.5], LOOK = [0, 3, 0.5];

// 用「位置編號」擺的 binary tree：i 的孩子在 2i、2i+1（沒有的位置就空著，不一定 complete）
function HT(o = {}) {
  const W = o.w || 10, X0 = o.x0 || 0, sz = o.sz || 0.85, ly = o.ly || [5.8, 4.3, 2.8, 1.3];
  const S = { v: {}, m: {}, ed: [] };
  S.p = (i) => { const d = Math.floor(Math.log2(i)), c = 1 << d; return V3(X0 + ((i - c + 0.5) / c - 0.5) * W, ly[d], 0); };
  S.edges = () => {
    S.ed.forEach(kill); S.ed = [];
    for (const k of Object.keys(S.m)) { const i = +k; if (i > 1 && S.m[i >> 1]) { const a = S.p(i >> 1), b = S.p(i); S.ed.push(line(a.x, a.y, b.x, b.y)); } }
  };
  S.put = (i, v, drop = 0, c) => { S.v[i] = v; const p = S.p(i); S.m[i] = cube(v, c || (o.color ? o.color(v) : col(v)), [sz, sz, sz], p.x, p.y, 0, drop); S.edges(); return S.m[i]; };
  S.hl = (list, c) => list.forEach((i) => { if (S.m[i]) glow(S.m[i], c); });
  S.off = () => Object.values(S.m).forEach((m) => glow(m, null));
  S.mv = (i, j) => { const p = S.p(j); move(S.m[i], p.x, p.y, 0); S.m[j] = S.m[i]; S.v[j] = S.v[i]; delete S.m[i]; delete S.v[i]; S.edges(); };
  S.sw = (i, j) => {
    const pi = S.p(i), pj = S.p(j); move(S.m[i], pj.x, pj.y, 0); move(S.m[j], pi.x, pi.y, 0);
    [S.m[i], S.m[j]] = [S.m[j], S.m[i]]; [S.v[i], S.v[j]] = [S.v[j], S.v[i]];
  };
  S.rm = (i) => { fly(S.m[i], V3(0, 6, 4)); delete S.m[i]; delete S.v[i]; S.edges(); };
  (o.init || []).forEach(([i, v]) => S.put(i, v));
  return S;
}
// 一排陣列格（1-based）
function ROW(vals, o = {}) {
  const dx = o.dx || 1.3, z = o.z === undefined ? 3 : o.z, X0 = o.x0 || 0, n = o.n || vals.length;
  const R = { m: [null], v: [null] };
  R.X = (i) => X0 + (i - (n + 1) / 2) * dx;
  for (let i = 1; i <= n; i++) { ctx.tile(V3(R.X(i), 0.02, z), dx * 0.9, 0.9); tag('[' + i + ']', 'idx', R.X(i), 0.05, z + 0.75); }
  vals.forEach((v, k) => { R.v[k + 1] = v; R.m[k + 1] = cube(v, col(v), [dx * 0.68, 0.45, 0.7], R.X(k + 1), 0.3, z); });
  R.sw = (i, j) => { move(R.m[i], R.X(j), 0.3, z); move(R.m[j], R.X(i), 0.3, z); [R.m[i], R.m[j]] = [R.m[j], R.m[i]]; [R.v[i], R.v[j]] = [R.v[j], R.v[i]]; };
  R.hl = (list, c) => list.forEach((i) => R.m[i] && glow(R.m[i], c));
  R.off = () => R.m.forEach((m) => m && glow(m, null));
  return R;
}
function cursorAt(c, S, i) { const p = S.p(i); c.position.set(p.x, p.y + 0.75, 0); }
const EXPR = [[1, '×'], [2, 3], [3, '+'], [6, 5], [7, 7]];
const MAXT = [[1, 14], [2, 9], [4, 4], [3, 12], [6, 8], [7, 5]];
const CMAX = [[1, 14], [2, 12], [3, 9], [4, 4], [5, 8], [6, 8.5]];

// 跟著遞迴一步一步印：steps = [node, 印出的字, code 行]
async function trace(tok, S, cd, steps, outTag, sep, name) {
  const cu = tag('▼', 'ptr alt', 0, -5, 0);
  let out = '';
  for (const [i, piece, ln] of steps) {
    S.off(); S.hl([i], GOLD); cursorAt(cu, S, i); cd.hl(ln);
    out += (out && sep ? sep : '') + piece; txt(outTag, out);
    say(name + '(' + S.v[i] + ')：印 ' + piece, '輸出：' + out);
    await beat(tok, 900);
  }
  S.off(); cd.hl(-1); kill(cu);
  return out;
}

// 10:18 複習 tree，expression tree 3 × (5 + 7)
FRAG.push(['heaplin-expr-tree', 'Expression Tree：3 × (5 + 7)', async (tok) => {
  fresh(CAM, LOOK);
  const S = HT({ ly: [5.6, 4.0, 2.4] });
  S.put(1, '×', 3);
  say('tree = root ＋ 一堆 subtree', 'recursive 定義');
  await beat(tok, 2000);
  for (const [i, v] of EXPR.slice(1)) { S.put(i, v, 3); await beat(tok, 450); }
  say('3 × (5 + 7) 的 expression tree', 'internal node = operator，leaf = 數字');
  await beat(tok, 2600);
  S.hl([3, 6, 7], GOLD);
  say('每個 subtree 也是一個 expression', 'subtree：5 + 7');
  await beat(tok, 2200);
  S.rm(6); S.rm(7); relabel(S.m[3], 12); S.v[3] = 12;
  say('先算右邊：5 + 7 = 12', '左右都算完，才做上面的 operator');
  await beat(tok, 2200);
  S.off(); S.hl([2], GOLD);
  say('左邊 subtree 就是 3', '');
  await beat(tok, 1400);
  S.off(); S.rm(2); S.rm(3); relabel(S.m[1], 36); glow(S.m[1], GREEN);
  say('root 的 ×：3 × 12 = 36', 'binary operator → binary tree');
  await beat(tok, 2200);
  tag('infix：3 × (5 + 7)', 'ptr', -3, 1.2, 1);
  tag('postfix：3 5 7 + ×', 'ptr alt', 3, 1.2, 1);
  say('同一棵樹，兩種寫法', 'infix 給人看，postfix 給電腦算');
  await beat(tok, 3000);
}]);

// 16:54 印出一棵樹 = 拜訪每個 node
FRAG.push(['heaplin-visit-all', '印出一棵樹：要拜訪每個 node', async (tok) => {
  fresh(CAM, LOOK);
  const S = HT({ ly: [5.6, 4.0, 2.4], init: EXPR });
  say('給你 expression tree，把它印出來', '要拜訪每個 node，而且照某個順序');
  await beat(tok, 2600);
  const cu = tag('▼', 'ptr alt', 0, -5, 0);
  let k = 0;
  for (const i of [1, 2, 3, 6, 7]) { k++; cursorAt(cu, S, i); S.hl([i], GOLD); say('拜訪 ' + S.v[i], '已拜訪 ' + k + ' 個 node'); await beat(tok, 750); }
  kill(cu);
  const uses = ['兩棵樹一不一樣？', '哪棵 node 比較多？', '樹裡最大的數字？', 'container 的 iterator'];
  for (const [j, u] of uses.entries()) { tag(u, 'ptr', -4.2, 1.6 - j * 0.55, 1.5); say('也要走過每個 node：' + u, ''); await beat(tok, 1500); }
  say('怎麼拜訪每個 node = traversal', '先用 infix / postfix 當切入點');
  await beat(tok, 2800);
}]);

// 21:22 infix print：左、自己、右，外加括號
FRAG.push(['heaplin-infix-print', 'infix print：先左、再自己、再右（in-order）', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3, 0.5]);
  const S = HT({ ly: [5.6, 4.0, 2.4], w: 6, x0: 3.4, init: EXPR });
  const cd = code(['infix(T):', '  if T is leaf: print T.data', '  else:', '    print "("; infix(T.left); print ")"', '    print T.data', '    print "("; infix(T.right); print ")"'], -3.6, 5.6, 0.56);
  const out = tag('', 'ptr', 0, 0.8, 1.5);
  say('stopping：leaf 就印數字', 'recursion：左 → 自己 → 右');
  cd.hl(1);
  await beat(tok, 2600);
  const r = await trace(tok, S, cd, [[1, '(', 3], [2, '3', 1], [1, ')', 3], [1, '×', 4], [1, '(', 5], [3, '(', 3], [6, '5', 1], [3, ')', 3], [3, '+', 4], [3, '(', 5], [7, '7', 1], [3, ')', 5], [1, ')', 5]], out, '', 'infix');
  say('括號很多，但意思對了', r);
  await beat(tok, 2400);
  say('左 → 自己 → 右 = in-order（中序）', 'infix print 就是 in-order traversal');
  await beat(tok, 2800);
}]);

// 29:04 postfix print：左、右、自己
FRAG.push(['heaplin-postfix-print', 'postfix print：先左、再右、最後自己（post-order）', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3, 0.5]);
  const S = HT({ ly: [5.6, 4.0, 2.4], w: 6, x0: 3.4, init: EXPR });
  const cd = code(['post(T):', '  if T is leaf: print T.data', '  else:', '    post(T.left)', '    post(T.right)', '    print T.data'], -3.4, 5.6, 0.56);
  const out = tag('', 'ptr', 0, 0.8, 1.5);
  say('拷貝 infix print，拿掉括號', '再把「印自己」移到最後');
  await beat(tok, 2600);
  const r = await trace(tok, S, cd, [[2, '3', 1], [6, '5', 1], [7, '7', 1], [3, '+', 5], [1, '×', 5]], out, ' ', 'post');
  say('operator 放最後面', r);
  await beat(tok, 2200);
  say('in-order：左 → 自己 → 右', 'post-order：左 → 右 → 自己');
  await beat(tok, 3000);
}]);

// 33:01 prefix：operator 在前面 = 函數呼叫，Lisp
FRAG.push(['heaplin-prefix', 'prefix：operator 寫前面，像函數呼叫', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3, 0.5]);
  const S = HT({ ly: [5.6, 4.0, 2.4], w: 6, x0: 3.4, init: EXPR });
  const cd = code(['pre(T):', '  print T.data', '  pre(T.left)', '  pre(T.right)'], -3.4, 5.6, 0.56);
  const out = tag('', 'ptr', 0, 0.8, 1.5);
  say('pre = 自己先印', '自己 → 左 → 右（pre-order）');
  await beat(tok, 2400);
  await trace(tok, S, cd, [[1, '×', 1], [2, '3', 1], [3, '+', 1], [6, '5', 1], [7, '7', 1]], out, ' ', 'pre');
  const l1 = tag('(× 3 (+ 5 7))', 'ptr alt', -3.4, 2.4, 1);
  say('加上括號：Lisp 的寫法', '第一個是動作，後面兩個是運算對象');
  await beat(tok, 2600);
  const l2 = tag('multiply(3, plus(5, 7))', 'ptr alt', -3.4, 1.7, 1);
  say('就是熟悉的函數呼叫', 'C++ operator overloading 也是這樣看 +');
  await beat(tok, 2800);
  say('prefix 像函數、infix 像四則運算', 'postfix 像電腦實際執行的方式');
  await beat(tok, 3000);
  kill(l1); kill(l2);
}]);

// 39:03 三種 traversal 的用途：比較兩棵樹用 pre-order
FRAG.push(['heaplin-traversal-uses', 'traversal 的用途：比較兩棵樹先看自己', async (tok) => {
  fresh(CAM, LOOK);
  const A = HT({ ly: [5.6, 4.0, 2.4], w: 5, x0: -3.3, init: EXPR });
  const B = HT({ ly: [5.6, 4.0, 2.4], w: 5, x0: 3.3, init: [[1, '×'], [2, 3], [3, '−'], [6, 5], [7, 7]] });
  say('post-order：evaluate expression', '先算完左右，才做自己');
  await beat(tok, 2400);
  say('比較兩棵樹：先比自己再比 subtree', 'pre-order（右邊這棵是示意）');
  await beat(tok, 2400);
  for (const i of [1, 2, 3]) {
    A.off(); B.off(); const same = A.v[i] === B.v[i];
    A.hl([i], same ? GREEN : RED); B.hl([i], same ? GREEN : RED);
    say(A.v[i] + ' vs ' + B.v[i] + (same ? '：一樣，繼續' : '：不一樣，停'), same ? '' : '下面的 5、7 不用再比');
    await beat(tok, 1500);
  }
  say('一發現不同就停，省掉白做的工', 'in-order 之後會對應到排序');
  await beat(tok, 3000);
}]);

// 62:15 node 拆成 key 與 data
FRAG.push(['heaplin-key-data', 'node = key ＋ data ＋ 左右兩張小紙條', async (tok) => {
  fresh([0, 4, 12], [0, 2.2, 0]);
  say('原本的 node：data ＋ 兩張紙條', '');
  const d = cube('data', '#8fb3d9', [2.4, 0.8, 1], 0, 4, 0, 3);
  cube('L', '#d8c29b', [1.1, 0.6, 1], -0.65, 3.3, 0); cube('R', '#d8c29b', [1.1, 0.6, 1], 0.65, 3.3, 0);
  arrow(V3(-0.65, 3.0, 0), V3(-2.4, 1.6, 0)); arrow(V3(0.65, 3.0, 0), V3(2.4, 1.6, 0));
  await beat(tok, 2200);
  kill(d);
  const k = cube('KEY', '#e2b84b', [1.0, 0.8, 1], -0.7, 4, 0, 2);
  const dd = cube('DATA', '#8fb3d9', [1.3, 0.8, 1], 0.6, 4, 0, 2);
  say('上半部切兩塊：key 和 data', 'key（檢索鍵）負責找、排、比');
  await beat(tok, 2600);
  const box = ghostBox('#7a6a50', 2.2, 1.2, 1.2); box.position.set(4.5, 4, 0);
  const bl = tag('筆記第 12 頁的內容', 'idx', 4.5, 4.9, 0);
  arrow(V3(1.3, 4, 0), V3(3.3, 4, 0));
  say('key 像頁碼，data 是那頁筆記', '找的時候只看 key');
  await beat(tok, 2600);
  txt(bl, '圖書館的那本書');
  say('key 像書的 ID，data 是書本身', 'data 甚至可以只是一張紙條');
  await beat(tok, 2600);
  relabel(k, 'priority'); relabel(dd, 'to-do');
  txt(bl, '要做的事');
  say('今天：key = priority，data = to-do', '');
  await beat(tok, 3000);
}]);

// 67:17 待辦事項：找 priority 最大的；mailbox 是 stack；queue 是特例
FRAG.push(['heaplin-todo-pq', 'Priority Queue：每次拿 priority 最大的', async (tok) => {
  fresh([0, 4.4, 13], [0, 2.4, 0]);
  const items = [[8, 'DSA 作業3'], [9, 'Final Project'], [6, '微積分作業']];
  const ms = items.map(([p, t], j) => { const x = -4 + j * 4; tag(t, 'idx', x, 3.9, 0); return cube(p, col(p), [1.0, 1.0, 1.0], x, 3, 0, 3); });
  say('每件待辦貼上 priority（數字示意）', 'key = priority，data = to-do');
  await beat(tok, 2600);
  ms.forEach((m) => glow(m, BLUE));
  say('要做事時：拿最重要的那件', '不是靠 index、pointer 或進來的先後');
  await beat(tok, 2400);
  ms.forEach((m) => glow(m, null)); glow(ms[1], GREEN); move(ms[1], 0, 5.4, 0);
  say('拿出 key 最大的：9', 'priority queue：要很快找到最大');
  await beat(tok, 2400);
  const mail = [1, 2, 3, 4].map((j) => cube('信' + j, '#c8b89a', [1.4, 0.35, 1], 4.6, 0.3 + j * 0.42, 2, 2));
  say('老師的 mailbox 其實是 stack', '最後進來的信先處理（LIFO）');
  await beat(tok, 2400);
  fly(mail[3], V3(2, 6, 3));
  say('拿最上面的，不是最重要的', '');
  await beat(tok, 2000);
  say('queue 也只是一種 priority queue', '先進去的 priority 最大');
  await beat(tok, 3000);
}]);

// 71:12 為什麼要做快：作業系統排程
FRAG.push(['heaplin-os-sched', '作業系統排程：等待區就是 priority queue', async (tok) => {
  fresh([0, 4.4, 13], [0, 2.2, 0]);
  say('sequential search：每次都全部看', 'ordered array：排序花太大力氣');
  await beat(tok, 2600);
  const P = [['P1', 5], ['P2', 9], ['P3', 2], ['P4', 7]];
  const X = (j) => -5 + j * 1.9;
  const ms = P.map(([n, p], j) => { tag(n, 'idx', X(j), 2.0, 0); return cube(p, col(p), [1, 1, 1], X(j), 1.2, 0, 3); });
  const core = ghostBox('#3a6e4a', 2.2, 1.6, 1.6); core.position.set(4.6, 1.3, 0);
  tag('CPU 核心', 'ptr', 4.6, 2.6, 0);
  say('多工：很多 process 在等待區', '核心空出來 → 挑 priority 最大的');
  await beat(tok, 2600);
  ms.forEach((m) => glow(m, BLUE)); await beat(tok, 800);
  ms.forEach((m) => glow(m, null)); glow(ms[1], GREEN); move(ms[1], 4.6, 1.3, 0);
  say('P2（9）拿去執行一段時間', 'remove largest');
  await beat(tok, 2400);
  glow(ms[1], null); relabel(ms[1], 3); move(ms[1], X(1), 1.2, 0);
  say('時間到還沒做完 → 放回去', 'insert，重新給 priority = 3（示意）');
  await beat(tok, 2400);
  [[0, 6], [2, 3], [3, 8]].forEach(([j, v]) => relabel(ms[j], v));
  say('等越久的 priority 調高', '才不會有 process 餓死');
  await beat(tok, 2400);
  glow(ms[3], GREEN); move(ms[3], 4.6, 1.3, 0);
  say('下一個：P4（8）', 'find max、remove、insert 一直重複');
  await beat(tok, 3000);
}]);

// 77:00 第一個想法：最大的放 root，其他亂放
FRAG.push(['heaplin-root-only', '只把最大放 root：拿走後要全部找一遍', async (tok) => {
  fresh(CAM, LOOK);
  const S = HT();
  S.put(1, 14, 3);
  say('tree 最快碰到的是 root', '最大的 14 就放 root');
  await beat(tok, 2200);
  for (const [i, v] of [[2, 6], [3, 8], [4, 12], [5, 5], [7, 9]]) { S.put(i, v, 3); await beat(tok, 350); }
  say('其他地方放什麼不管', '找最大：看 root 就好');
  await beat(tok, 2400);
  S.hl([1], RED);
  say('可是 14 被拿去做了…', 'remove largest');
  await beat(tok, 1600);
  S.rm(1);
  const cu = tag('▼', 'ptr alt', 0, -5, 0); let best = 0, bi = 0, k = 0;
  for (const i of [2, 3, 4, 5, 7]) {
    k++; cursorAt(cu, S, i); S.off(); S.hl([i], GOLD);
    if (S.v[i] > best) { best = S.v[i]; bi = i; }
    say('群龍無首：一個一個找，看 ' + S.v[i], '目前最大 ' + best + '（看了 ' + k + ' 個）');
    await beat(tok, 900);
  }
  kill(cu); S.off(); S.hl([bi], GREEN); S.mv(bi, 1);
  say('躲在最下面的 12 上來當 root', '剩下 5 個全看過：像 selection sort');
  await beat(tok, 3000);
}]);

// 84:25 再加規則：每個 subtree 的 root 也是最大 → binary max tree
FRAG.push(['heaplin-maxtree-def', 'Binary Max Tree：subtree 的 root 也是最大', async (tok) => {
  fresh(CAM, LOOK);
  const S = HT();
  S.put(1, 14, 3); await beat(tok, 600);
  S.put(2, 9, 3); S.put(3, 12, 3);
  say('root 之外還有兩棵 subtree', '每棵 subtree 的 root 放 sub-largest');
  await beat(tok, 2400);
  for (const [i, v] of [[4, 4], [6, 8], [7, 5]]) { S.put(i, v, 3); await beat(tok, 350); }
  S.hl([2, 3], GOLD);
  say('14 缺位：只要 9 和 12 打一架', '不用進 subtree 裡找半天');
  await beat(tok, 2600);
  S.off();
  const cd = code(['Binary Max Tree:', '1. root.key ≥ 其他所有 node 的 key', '2. 每個 subtree 都是 Binary Max Tree'], -4.2, 1.3, 0.5, 1.5);
  cd.hl(1); S.hl([1], GREEN);
  say('條件一：root 最大', '');
  await beat(tok, 2200);
  cd.hl(2); S.off(); S.hl([2, 4], GOLD); S.hl([3, 6, 7], BLUE);
  say('條件二：recursive 地套到 subtree', '');
  await beat(tok, 2400);
  S.off(); S.hl([4, 6, 7], GREEN);
  say('停在 single leaf：本身就最大', 'recursion 的 stopping');
  await beat(tok, 3000);
}]);

// 89:54 檢查 + remove 14、remove 12：較大的 sub-root 補位
FRAG.push(['heaplin-maxtree-remove', 'Max Tree 的 remove largest：較大的 sub-root 補位', async (tok) => {
  fresh(CAM, LOOK);
  const S = HT({ init: MAXT });
  S.hl([1], GREEN);
  say('14 比其他都大；9 壓 4、12 壓 8 和 5', '整棵是 binary max tree');
  await beat(tok, 2600);
  S.off(); S.hl([1], RED);
  say('remove largest：14 走了', '找最大：看 root，O(1)');
  await beat(tok, 1600);
  S.rm(1); S.hl([2, 3], GOLD);
  say('9 和 12 打一架：12 贏', '');
  await beat(tok, 1800);
  S.off(); S.mv(3, 1);
  say('12 補上 root', '12 壓得住 9 那邊，也壓得住 8、5');
  await beat(tok, 2000);
  S.hl([6, 7], GOLD);
  say('12 的位置缺了：8 和 5 打一架', '');
  await beat(tok, 1800);
  S.off(); S.mv(6, 3);
  say('8 贏，上去補位', '8 原本的位置是 leaf，空了沒關係');
  await beat(tok, 2200);
  S.hl([1], RED);
  say('再 remove 12', '');
  await beat(tok, 1400);
  S.rm(1); S.hl([2, 3], GOLD);
  say('9 和 8 打一架：9 贏', '');
  await beat(tok, 1600);
  S.off(); S.mv(2, 1);
  await beat(tok, 1000);
  S.hl([4], GOLD);
  say('9 的位置：只有 4，直接上來', '');
  await beat(tok, 1600);
  S.off(); S.mv(4, 2);
  say('replace with larger of sub-roots', 'recursively');
  await beat(tok, 3000);
}]);

// 99:43 規則 vs 效率：只走一條 root→leaf 路徑；insert 預告
FRAG.push(['heaplin-rule-path', '只走一條 root→leaf 路徑：時間跟高度有關', async (tok) => {
  fresh(CAM, LOOK);
  const S = HT({ init: MAXT });
  tag('array → ordered array', 'idx', -3.6, 0.6, 1.5);
  tag('tree → binary max tree', 'idx', 3.6, 0.6, 1.5);
  say('有規則的 tree，像有規則的 array', '規則越多越好找，但維護越花力氣');
  await beat(tok, 2800);
  for (const i of [1, 3, 6]) { S.hl([i], GOLD); await beat(tok, 600); }
  say('remove 14 的更新只沿這條路', '14 → 12 → 8：其他 node 都不用看');
  await beat(tok, 2600);
  say('花的時間跟樹高 h 有關', '跟 node 數量 n 沒那麼大關係');
  await beat(tok, 2600);
  S.off();
  const p = S.p(5);
  const nw = cube('新', '#e2b84b', [0.85, 0.85, 0.85], p.x, p.y, 0, 3);
  const e = line(S.p(2).x, S.p(2).y, p.x, p.y);
  say('insert 預告：先放到基層（leaf）', '');
  await beat(tok, 2000);
  S.hl([2, 4], BLUE);
  say('跟兄弟、爸爸三個打一架', '贏了就往上爬');
  await beat(tok, 2600);
  S.off(); kill(e); kill(nw);
  say('往上爬也只走一條路', 'insert 也是 O(h)');
  await beat(tok, 2600);
}]);

// 116:43 最糟情況：歪斜的 max tree
FRAG.push(['heaplin-skewed', '歪斜的 Max Tree：50 49 46 … 退化成 list', async (tok) => {
  fresh([0, 3.6, 13], [0, 3, 0]);
  const V = [50, 49, 46, 44, 21, 17, 5, 3];
  const P = (k) => V3(-4.2 + k * 1.2, 6.0 - k * 0.72, 0);
  let ms = V.map((v, k) => { const p = P(k); return cube(v, col(v), [0.75, 0.75, 0.75], p.x, p.y, 0); });
  let ed = [];
  const edges = () => { ed.forEach(kill); ed = []; for (let k = 1; k < ms.length; k++) { const a = P(k - 1), b = P(k); ed.push(line(a.x, a.y, b.x, b.y)); } };
  edges();
  say('也是 binary max tree', '但長得跟 linked list 一樣：h = n');
  await beat(tok, 2800);
  glow(ms[0], RED);
  say('remove 50：不用打架，49 上去', '');
  await beat(tok, 1600);
  fly(ms[0], V3(-2, 6, 4)); ms = ms.slice(1);
  for (let k = 0; k < ms.length; k++) { const p = P(k); glow(ms[k], GOLD); move(ms[k], p.x, p.y, 0); say(V[k + 1] + ' 往上移一格', '要移 ' + (k + 1) + ' 個'); await beat(tok, 600); glow(ms[k], null); }
  edges();
  say('每個都要移：像 ordered array 刪頭', '最糟 O(n)');
  await beat(tok, 2600);
  say('希望 h 小：最好 h = log n', '讓樹開枝散葉');
  await beat(tok, 2800);
}]);

// 121:14 h = log n：full 的 node 數受限，改用 complete
FRAG.push(['heaplin-full-vs-complete', '想要 h = log n：full 不實際，用 complete', async (tok) => {
  fresh([0, 4.2, 13.5], [0, 3.2, 0]);
  const S = HT({ w: 11, sz: 0.6, color: () => NODEC });
  const cnt = [1, 2, 4, 8];
  let i = 1;
  for (let d = 0; d < 4; d++) {
    for (let k = 0; k < cnt[d]; k++) { S.put(i, '', 2); i++; }
    tag(String(cnt[d]), 'idx', -6.2, [5.8, 4.3, 2.8, 1.3][d], 0);
    say('第 ' + (d + 1) + ' 層放 ' + cnt[d] + ' 個', '1 + 2 + 4 + 8 = 15');
    await beat(tok, 900);
  }
  say('15 個 node，高度只要 4', 'h = log n 是最好的情況');
  await beat(tok, 2400);
  say('full：每一層都滿', 'node 數只能是 1、3、7、15…');
  await beat(tok, 2400);
  S.hl([14, 15], RED);
  say('13 件待辦？沒有 13 個 node 的 full', '');
  await beat(tok, 2000);
  S.rm(15); S.rm(14);
  say('complete：一層一層、由左到右長', '13 個也行，高度還是 log n 級');
  await beat(tok, 3000);
}]);

// 123:53 complete binary max tree：舊的 remove 會破壞 complete
FRAG.push(['heaplin-complete-break', 'Complete Max Tree：舊的 remove 會留下洞', async (tok) => {
  fresh(CAM, LOOK);
  const S = HT({ init: [[1, 14], [2, 12], [3, 9], [4, 4], [5, 8], [6, 5]] });
  say('一樣的數字，排成 complete', 'complete binary tree ＋ max tree');
  await beat(tok, 2600);
  S.hl([1], RED);
  say('用剛才的演算法 remove 14', '');
  await beat(tok, 1400);
  S.rm(1); S.hl([2, 3], GOLD);
  say('12 和 9 打一架：12 補位', '');
  await beat(tok, 1600);
  S.off(); S.mv(2, 1); await beat(tok, 900);
  S.hl([4, 5], GOLD);
  say('8 和 4 打一架：8 補位', '');
  await beat(tok, 1600);
  S.off(); S.mv(5, 2);
  const p5 = S.p(5); const hole = tag('空', 'ptr', p5.x, p5.y, 0);
  say('中間空了一格：不再是 complete', '');
  await beat(tok, 2400);
  kill(hole); S.hl([6], GOLD); S.mv(6, 5);
  say('把最後的 5 拉過來補？', '5 < 8，這次剛好沒事');
  await beat(tok, 2400);
  relabel(S.m[5], 8.5); S.v[5] = 8.5; tint(S.m[5], col(8.5)); S.off(); S.hl([5], RED); S.hl([2], BLUE);
  say('如果它是 8.5：8 壓不住 8.5', 'complete 了，max 性質卻壞了');
  await beat(tok, 2600);
  say('還要再調整：維護很麻煩', '先顧 max，complete 就顧不到');
  await beat(tok, 3000);
}]);

// 129:38 新的 remove largest：最後一個上 root 當代理主席，再往下換
FRAG.push(['heaplin-remove-last', 'Max Heap 的 remove：最後一個上 root，再往下換', async (tok) => {
  fresh(CAM, LOOK);
  const S = HT({ init: CMAX });
  say('換個想法：先顧 complete', '14 12 9 4 8 8.5');
  await beat(tok, 2400);
  S.hl([1], RED);
  say('remove 14', '');
  await beat(tok, 1200);
  S.rm(1); S.hl([6], GOLD);
  say('最後一個 node 注定要消失', '那就讓 8.5 先上去當代理主席');
  await beat(tok, 2200);
  S.off(); S.mv(6, 1);
  await beat(tok, 1000);
  S.hl([1], GOLD); S.hl([2, 3], BLUE);
  say('8.5、12、9：12 最大', '壓不住 → 跟 12 換');
  await beat(tok, 2200);
  S.off(); S.sw(1, 2);
  await beat(tok, 1200);
  S.hl([2], GOLD); S.hl([4, 5], BLUE);
  say('8.5 對 4、8：壓得住，停', '');
  await beat(tok, 2200);
  S.off(); S.hl([1, 2, 3, 4, 5], GREEN);
  say('1. last → root  2. 往下換', '最多換 h 層 = O(log n)');
  await beat(tok, 2600);
  S.off();
  say('complete ＋ max tree = max heap', '');
  await beat(tok, 2600);
}]);

// 135:53 insert 17：放最後，再往上浮
FRAG.push(['heaplin-insert-17', 'Max Heap 的 insert 17：放最後，再往上浮', async (tok) => {
  fresh(CAM, LOOK);
  const S = HT({ init: CMAX });
  say('先顧 complete：放在下一個空位', '14 12 9 4 8 8.5，下一格是 [7]');
  await beat(tok, 2400);
  S.put(7, 17, 3);
  say('insert 17：從基層做起', '');
  await beat(tok, 1600);
  S.hl([7], GOLD); S.hl([3], BLUE); S.hl([6], BLUE);
  say('9 壓得住 8.5，壓不住 17', '17 > 9 → 往上換');
  await beat(tok, 2200);
  S.off(); S.sw(7, 3);
  await beat(tok, 1200);
  S.hl([3], GOLD); S.hl([1], BLUE);
  say('爸爸 14 壓不住 17', '17 > 14 → 再往上');
  await beat(tok, 2200);
  S.off(); S.sw(3, 1);
  await beat(tok, 1200);
  S.hl([1], GREEN);
  say('17 到 root：停', '');
  await beat(tok, 1800);
  S.off();
  say('insert at last → float up', '最多爬 h 層 = O(log n)');
  await beat(tok, 3000);
}]);

// 139:24 complete tree 放進 array：partially ordered array
FRAG.push(['heaplin-partial-array', 'Heap = partially ordered array', async (tok) => {
  fresh([0, 4.6, 14], [0, 2.8, 1]);
  const S = HT({ init: CMAX, ly: [6.0, 4.6, 3.2] });
  say('complete tree 可以照編號放進 array', '不用小紙條（pointer）');
  await beat(tok, 2200);
  const R = ROW(CMAX.map(([, v]) => v), { dx: 1.3, z: 3 });
  await beat(tok, 1200);
  say('array：14 12 9 4 8 8.5', '');
  await beat(tok, 1800);
  S.hl([2], GOLD); R.hl([2], GOLD); S.hl([4, 5], BLUE); R.hl([4, 5], BLUE);
  say('12 在 [2]：孩子在 [4]、[5]', 'left = 2i，right = 2i + 1');
  await beat(tok, 2400);
  S.off(); R.off(); S.hl([6], GOLD); R.hl([6], GOLD); S.hl([3], BLUE); R.hl([3], BLUE);
  say('8.5 在 [6]：爸爸在 [3]', 'parent = ⌊6/2⌋ = 3');
  await beat(tok, 2400);
  S.off(); R.off();
  say('array 看起來沒有排好序', '不是由大到小，也不是由小到大');
  await beat(tok, 2400);
  say('亂中有序：partially ordered array', '每個 subtree 最大在上面');
  await beat(tok, 3000);
}]);

// 141:54 selection sort on array vs on heap → heap sort
FRAG.push(['heaplin-selection-vs-heap', 'Selection Sort：在 array 上 vs 在 heap 上', async (tok) => {
  fresh([0, 4.6, 14], [0, 2.6, 1]);
  const R = ROW([9, 4, 14, 8.5, 12, 8], { dx: 1.2, z: 2.6, x0: -3.2 });
  const S = HT({ init: CMAX, w: 4.6, x0: 4.2, sz: 0.65, ly: [5.6, 4.4, 3.2] });
  say('selection sort：每輪選最大放後面', '左：亂的 array（示意）');
  await beat(tok, 2400);
  const cu = tag('▼', 'ptr alt', 0, -5, 0);
  for (let i = 1; i <= 6; i++) { cu.position.set(R.X(i), 1.0, 2.6); R.off(); R.hl([i], GOLD); say('每輪都要整個看過：看 ' + R.v[i], '一輪 O(n)'); await beat(tok, 500); }
  R.off(); kill(cu);
  say('n 輪 × 每輪 n', 'selection sort on array：O(n²)');
  await beat(tok, 2400);
  S.hl([1], GREEN);
  say('右：heap 上找最大 O(1)', '');
  await beat(tok, 1800);
  S.hl([2, 4], GOLD);
  say('拿走後維護：一條路 O(log n)', '每輪 O(1) ＋ O(log n)');
  await beat(tok, 2400);
  S.off();
  say('先建 heap：n 次 insert', 'O(n log n)');
  await beat(tok, 2200);
  say('再 n 次 remove largest', 'O(n log n)');
  await beat(tok, 2200);
  say('合起來 = heap sort：O(n log n)', '從 n² 進步到 n log n');
  await beat(tok, 3000);
}]);

// 148:17 同一塊記憶體：heap 區與 array 區
FRAG.push(['heaplin-inplace', 'Heap Sort 不用另外蓋樹：同一個 array 分兩區', async (tok) => {
  fresh([0, 3.6, 11], [0, 1, 1]);
  const R = ROW([9, 4, 14, 8.5, 12, 8], { dx: 1.5, z: 1 });
  const n = 6;
  const bar = tag('┃', 'ptr', 0, 0.9, 1);
  const hT = tag('heap 區', 'ptr alt', 0, 1.7, 1), aT = tag('array 區', 'idx', 0, 1.7, 1);
  const setBar = (k, sorted) => {
    const bx = R.X(k) + 0.75; bar.position.set(bx, 0.9, 1);
    hT.position.set(k ? (R.X(1) + R.X(k)) / 2 : -6, 1.7, 1); showRange(k, sorted);
  };
  function showRange(k, sorted) { aT.position.set(k < n ? (R.X(k + 1) + R.X(n)) / 2 : 6, 1.7, 1); txt(aT, sorted ? '排好的 array 區' : 'array 區'); }
  setBar(0, false);
  say('一開始：全部是 array 區（示意資料）', 'heap 區是空的');
  await beat(tok, 2400);
  for (let k = 1; k <= n; k++) {
    setBar(k, false); R.off(); R.hl([k], GOLD);
    say('insert ' + R.v[k] + ' 進 heap 區', 'heap 區長到 ' + k + ' 格');
    await beat(tok, 900);
    let i = k;
    while (i > 1 && R.v[i] > R.v[i >> 1]) { R.hl([i >> 1], BLUE); say(R.v[i] + ' > 爸爸 ' + R.v[i >> 1] + '：往上換', 'parent = ⌊' + i + '/2⌋'); await beat(tok, 700); R.sw(i, i >> 1); await beat(tok, 700); R.off(); i >>= 1; }
  }
  R.off();
  say('整段都變成 heap', '再從 heap 一直拿最大');
  await beat(tok, 2000);
  for (let end = n; end >= 2; end--) {
    R.hl([1], GREEN);
    say('最大 ' + R.v[1] + ' 放到 heap 區最後面', 'A[1] ↔ A[' + end + ']');
    await beat(tok, 700);
    R.sw(1, end); await beat(tok, 600); glow(R.m[end], null); tint(R.m[end], GRAY);
    setBar(end - 1, true);
    let i = 1;
    for (;;) {
      const l = 2 * i, r = l + 1; let c = i;
      if (l <= end - 1 && R.v[l] > R.v[c]) c = l;
      if (r <= end - 1 && R.v[r] > R.v[c]) c = r;
      if (c === i) break;
      R.sw(i, c); await beat(tok, 500); i = c;
    }
  }
  tint(R.m[1], GRAY); setBar(0, true);
  say('同一塊記憶體排好了', 'heap 只是把 array 假裝成 complete tree');
  await beat(tok, 3000);
}]);

// 152:28 最後一個 node 在哪：存 node 數就知道
FRAG.push(['heaplin-last-node', '下一個插入點：第 n + 1 格', async (tok) => {
  fresh([0, 4.2, 13.5], [0, 3.2, 0]);
  const S = HT({ w: 11, sz: 0.65, color: () => NODEC });
  for (let i = 1; i <= 10; i++) S.put(i, i);
  say('heap 裡已經有 10 個 node', '只要記 node 數 n = 10');
  await beat(tok, 2400);
  S.put(11, 11, 3, '#e2b84b');
  say('新資料一定放第 11 格', '位置是確定的，不會退化成 list');
  await beat(tok, 2400);
  S.hl([5], BLUE);
  say('爸爸在哪？', 'parent = ⌊11/2⌋ = 5');
  await beat(tok, 2200);
  S.off();
  const bin = tag('11 = 1011₂', 'ptr alt', -4.6, 6.4, 0);
  for (const [i, s] of [[1, '開頭的 1 = root'], [2, '0 → 往左'], [5, '1 → 往右'], [11, '1 → 往右']]) { S.hl([i], GOLD); say('用樹實作：照二進位走', s); await beat(tok, 1100); }
  say('array 實作：上下走 = index 運算', 'tree 實作：要多存指標');
  await beat(tok, 2600);
  S.off(); kill(bin);
  say('selection on heap 每輪', 'O(1) ＋ O(log n)（是加，不是乘）');
  await beat(tok, 3000);
}]);

// 159:42 Priority Queue 實作的 trade-off
FRAG.push(['heaplin-pq-tradeoff', 'Priority Queue 的 trade-off：heap vs linked list', async (tok) => {
  fresh([0, 4.2, 13], [0, 2.4, 0]);
  const V = [14, 12, 9, 8.5, 8];
  const X = (k) => -5.2 + k * 2.0;
  let G = V.map((v, k) => lnode(v, X(k), 0.4, 0, col(v)));
  say('排好序的 linked list：最大在 head', '');
  await beat(tok, 2200);
  glow(G[0].userData.data, RED);
  say('remove largest = remove head', 'O(1)');
  await beat(tok, 1600);
  fly(G[0], V3(-3, 6, 3)); G = G.slice(1);
  await beat(tok, 900);
  const cu = tag('▼', 'ptr alt', 0, -5, 0);
  for (let k = 0; k < G.length; k++) { cu.position.set(X(k + 1), 1.2, 0); glow(G[k].userData.data, GOLD); say('insert 4：一路找位置', '最糟走到最後'); await beat(tok, 550); glow(G[k].userData.data, null); }
  kill(cu);
  lnode(4, X(5), 0.4, 0, col(4));
  say('insert 要找位置：O(n)', '');
  await beat(tok, 2000);
  const cd = code(['                insert     remove largest', 'heap            O(log n)   O(log n)', 'max tree        O(h)       O(h)', '無序 list       O(1)       O(n)', '有序 list       O(n)       O(1)'], 0, 5.6, 0.56);
  cd.hl(1);
  say('heap：兩邊都是 O(log n)', '');
  await beat(tok, 2200);
  cd.hl(3);
  say('不整理：塞得快，找最大慢', '');
  await beat(tok, 2000);
  cd.hl(4);
  say('整理好：拿得快，插入慢', '這就是 trade-off');
  await beat(tok, 2400);
  cd.hl(-1);
  say('課本用 min heap，觀念相同', 'STL priority_queue = heap on vector');
  await beat(tok, 3000);
}]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '資料結構・第 5 章',
    title: 'Heap 與 Priority Queue',
    color: 'var(--ds)',
    modes: [
      { id: 'map', name: '陣列 ↔ 樹', enter: () => enterMap() },
      { id: 'pq', name: 'Priority Queue', enter: () => enterPQ() },
      { id: 'build', name: 'Build Heap O(n)', enter: () => enterBuild() },
      { id: 'sort', name: 'Heap Sort', enter: () => enterSort() },
      { id: 'minmax', name: 'Min-Max Heap', enter: () => enterMinMax() },
    ],
    pages: [
      { id: 'cmp', name: '複雜度與重點', render: renderCmp },
      { id: 'quiz', name: '小測驗', render: renderQuiz },
    ],
    scenes: Object.fromEntries(Object.entries(scenes).map(([id, s]) => [id, { title: s.title, play: async (tok) => { sceneTok = tok; await s.play(tok); } }])),
    sceneOrder: ['heap-as-array', 'max-heapify', 'build-max-heap', 'build-heap-cost', 'pq-insert', 'extract-max', 'heap-sort', 'minmax-heap'].concat(FRAG.map((f) => f[0])),
    stop() { gen++; busy = false; sceneTok = null; },
  };
}
