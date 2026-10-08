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
// Cued scenes: every `await step(tok)` waits for the sentence it shows; beats are motion only.
// 內建的 heap-as-array／max-heapify／build-max-heap／build-heap-cost 在這裡有逐句版（heapb-as-array、heapb-heapify-2、heapb-build、heapb-build-cost）。陣列 1-based。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, line, arrow, code, ghostBox, travel, buddy, step, GOLD, GREEN, RED, GRAY } = K;
const say = ctx.say, beat = ctx.beat, colorFor = ctx.colorFor;
const BLUE = '#1f3a6e', SORTED = '#2fc092';
const QLY = [6.2, 4.7, 3.2, 1.7];
const QCAM = [0, 6, 15.5], QLOOK = [0, 3.3, 1];
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const bubble = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
// 小幫手：站在左下角，用表情陪你看每一步
const guide = (x = -6.3, z = 1.8) => buddy('', '', '#ffc56b', x, 0, z, 0.72);
// 一棵 heap：上面是樹、下面是陣列格（同一份資料兩種畫法）
function qTree(vals, o = {}) {
  const W = o.w || 11, X0 = o.x0 || 0, cap = o.cap || vals.length, arr = o.arr !== false;
  const cz = o.cz === undefined ? 3.4 : o.cz, dx = o.dx || 0.9, sz = o.sz || 0.9, min = !!o.min;
  const better = (x, y) => (min ? x < y : x > y);
  const GT = min ? '<' : '>', GE = min ? '≤' : '≥', BIG = min ? '小' : '大';
  const col = (v) => (o.color ? o.color(v) : colorFor(v));
  const S = { a: [null], nd: [null], cl: [null], ed: [null], size: 0, cap, better };
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
  S.drop = (i) => { if (S.nd[i]) { kill(S.nd[i]); S.nd[i] = null; } if (S.cl[i]) { kill(S.cl[i]); S.cl[i] = null; } if (S.ed[i]) { kill(S.ed[i]); S.ed[i] = null; } S.a[i] = null; };
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
  // insert 的調整：由葉子往根（向上），整段在同一步裡快速播完
  S.up = async (tok, i, ms = 600) => {
    while (i > 1) {
      const p = i >> 1; S.off(); S.hl([i], GOLD); S.hl([p], BLUE);
      if (!better(S.a[i], S.a[p])) { await beat(tok, ms * 0.5); break; }
      await S.sw(tok, i, p, ms); i = p;
    }
    S.off(); return i;
  };
  // delete／heapify 的調整：由 i 往葉子（向下），和較大（min-heap 是較小）的孩子換
  S.down = async (tok, i, size, ms = 600) => {
    while (2 * i <= size) {
      const l = 2 * i, r = l + 1; let c = l; if (r <= size && better(S.a[r], S.a[l])) c = r;
      S.off(); S.hl([i], GOLD); S.hl(r <= size ? [l, r] : [l], BLUE);
      await beat(tok, ms * 0.5);
      if (!better(S.a[c], S.a[i])) break;
      await S.sw(tok, i, c, ms); i = c;
    }
    S.off(); return i;
  };
  // 刪根：根飛走、最後一個補到根（不往下調）。mode：'keep' 放進 [n]、'park' 先停在 [n] 上方、'fly' 丟掉
  S.popStart = async (tok, mode = 'fly', ms = 700) => {
    const n = S.size, top = S.a[1];
    S.off();
    fly(S.nd[1]); S.nd[1] = null;
    const cell = S.cl[1]; S.cl[1] = null;
    if (n > 1) S.mv(n, 1);
    if (S.ed[n]) { kill(S.ed[n]); S.ed[n] = null; }
    if (cell) {
      glow(cell, null); tint(cell, GRAY);
      const cn = S.c(n);
      if (mode === 'keep') { move(cell, cn.x, cn.y, cn.z); S.cl[n] = cell; }
      else if (mode === 'park') { move(cell, cn.x, 1.3, cn.z + 0.2); S.parked = cell; }
      else fly(cell, V3(0, 6, 5));
    }
    S.a[n] = mode === 'fly' ? null : top;
    S.setSize(n - 1);
    await beat(tok, ms);
    return top;
  };
  // 停在上方的值放進 [i]
  S.store = (i) => { if (!S.parked) return; const c = S.c(i); move(S.parked, c.x, c.y, c.z); S.cl[i] = S.parked; S.parked = null; };
  S.pop = async (tok, mode = 'keep', ms = 500) => { const n = S.size, top = await S.popStart(tok, mode, ms); await S.down(tok, 1, n - 1, ms); return top; };
  S.gaps = (list) => list.map((i) => { const c = S.c(i); return tag('空', 'ptr', c.x, 0.95, c.z); });
  S.lvTags = (k) => { const out = []; for (let d = 0; d < k; d++) out.push(tag('h = ' + d, 'idx', X0 - W / 2 - 0.9, QLY[d], 0)); return out; };
  return S;
}
const HB_HEAP = [16, 14, 10, 8, 7, 9, 3, 2, 4, 1];       // 板書上的 max-heap
const HB_HEAPIFY = [16, 4, 10, 14, 7, 9, 3, 2, 8, 1];    // max-heapify(A, 2) 的例子
const HB_BUILD = [4, 1, 3, 2, 16, 9, 10, 14, 8, 7];      // build-max-heap 的例子（講義 notes）
// 把一組節點框起來（子樹 = 已經是 max-heap 的一塊）
function hbBox(S, list, color = '#2fc092') {
  const ps = list.map(S.p), xs = ps.map((p) => p.x), ys = ps.map((p) => p.y);
  const g = ghostBox(color, Math.max(...xs) - Math.min(...xs) + 1.4, Math.max(...ys) - Math.min(...ys) + 1.4, 1.4);
  g.position.set((Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2, 0); return g;
}

// 00:22 priority queue 的操作（12 步）
FRAG.push(['heapb-pq-ops', 'Priority Queue 的四個操作', async (tok) => {
  fresh([0, 6, 13], [0, 2.8, 0]);
  const pal = guide(-6.2, 1.6);
  const xs = (i) => (i - 2.5) * 1.6;
  const keys = [7, 14, 10, 16, 8];
  let bs = [], kt = [], C, nx, head;
  await step(tok);                                   // 0:22 heap：可愛的資料結構
  head = bubble('今天的主角：heap', 0, 6.4, 0);
  pal.mood('happy');
  say('今天的主角：heap', '用它來實作 priority queue');
  await step(tok);                                   // 0:35 也拿來做 heap sort
  bubble('也能做成 heap sort（和 insertion、merge sort 不一樣）', 0, 5.7, 0);
  say('也會用 heap 做出一個排序法：heap sort', '和 insertion sort、merge sort 很不一樣');
  await step(tok);                                   // 1:11 集合 S
  kill(head);
  zoneS();
  bs = keys.map((v, i) => cube('', '#c9bfae', [1.1, 0.8, 1.1], xs(i), 0.4, 1.2, 3));
  pal.mood('calm');
  say('priority queue：裝著一個集合 S', '裡面有好幾個元素');
  await step(tok);                                   // 1:28 每個元素有 key
  bs.forEach((b, i) => { kill(b); bs[i] = cube(keys[i], colorFor(keys[i]), [1.1, 0.8, 1.1], xs(i), 0.4, 1.2); });
  kt = keys.map((v, i) => tag('key', 'idx', xs(i), 0.05, 2.0));
  say('每個元素都帶一個 key', 'key = 它的 priority（優先程度）');
  await step(tok);                                   // 1:55 要拿最大、刪除、插入、改
  glow(bs[3], GOLD);
  say('想要：拿出 priority 最高的、刪除、插入、改 priority', '');
  await step(tok);                                   // 2:17 都要快
  glow(bs[3], null);
  bubble('快 = O(n)？O(log n)？', 0, 4.2, 0);
  say('這些操作都要快', '用漸近複雜度來衡量：O(n)、O(log n)…');
  await step(tok);                                   // 3:17 操作清單
  C = code(['insert(S, x)', 'max(S)', 'extract_max(S)', 'increase_key(S, x, k)'], 4.4, 6.6, 0.55);
  say('priority queue 要提供的操作', '用 heap 來實作');
  await step(tok);                                   // 3:31 insert
  C.hl(0); nx = cube(9, colorFor(9), [1.1, 0.8, 1.1], xs(5), 0.4, 1.2, 5);
  say('insert(S, x)：把 x 放進 S', 'insert(S, 9)');
  await step(tok);                                   // 3:46 max
  C.hl(1); glow(bs[3], GOLD);
  pal.mood('wow');
  say('max(S)：回傳 key 最大的元素', 'max(S) = 16，S 不變');
  await step(tok);                                   // 4:06 extract_max
  C.hl(2); fly(bs[3]); kill(kt[3]);
  [bs[4], nx].forEach((b, k) => move(b, xs(3 + k), 0.4, 1.2));
  say('extract_max(S)：回傳最大的，並且從 S 拿掉', 'extract_max(S) = 16');
  await step(tok);                                   // 4:56 increase_key
  C.hl(3); glow(bs[0], BLUE);
  await beat(tok, 500);
  relabel(bs[0], 15); tint(bs[0], colorFor(15));
  pal.mood('calm');
  say('increase_key(S, x, k)：把 x 的 key 改成 k', '7 → 15（也可以有 decrease_key）');
  await step(tok);                                   // 5:46 維持 rep invariant
  C.hl(-1); glow(bs[0], null);
  pal.mood('happy'); await pal.hop(tok);
  say('重點：怎麼維持 heap 的 rep invariant', '讓這些操作都有效率');
  function zoneS() { const t = ctx.tile(V3(0.8, 0.0, 1.2), 10.4, 2.2); tag('集合 S', 'ptr', -4.6, 0.1, 0.0); return t; }
}]);

// 06:11 heap：把陣列看成樹（11 步，內建 heap-as-array 的逐句版）
FRAG.push(['heapb-as-array', 'Heap：把陣列看成 nearly complete binary tree', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide(-6.4, 2.2);
  let S, ghosts = [];
  await step(tok);                                   // 6:11 heap 就是一個陣列
  S = qTree([], { cap: 10 });
  say('Heap 是 priority queue 的一種實作', '本質上就是一個陣列');
  await step(tok);                                   // 6:30 看成 nearly complete binary tree
  bubble('把陣列「看成」一棵樹', 0, 7.2, 0);
  say('把這個陣列「看成」nearly complete binary tree', '資料沒變，只是換個方式看');
  await step(tok);                                   // 6:47 10 格
  for (let i = 1; i <= 10; i++) { const c = S.c(i); note(String(i), c.x, 1.0, c.z); }
  say('例子：10 格，index 1 到 10', '[0] 不用');
  await step(tok);                                   // 7:04 元素 16, 14, 10, …
  for (let i = 1; i <= 10; i++) { S.cell(i, HB_HEAP[i - 1], 1); await beat(tok, 120); }
  S.size = 10;
  say('元素：16, 14, 10, 8, 7, 9, 3, 2, 4, 1', '');
  await step(tok);                                   // 7:32 不是 full：要 15 個
  ghosts = [11, 12, 13, 14, 15].map((i) => { const p = S.p(i); return tag('（空）', 'idx', p.x, p.y, 0); });
  say('10 個不夠排滿 4 層（要 15 個）', '所以叫 nearly complete');
  await step(tok);                                   // 7:53 index 1 是根
  ghosts.forEach(kill);
  S.node(1, 16, 2); S.hl([1], GOLD);
  say('index 1 是樹根：16', '');
  await step(tok);                                   // 8:04 2、3 是孩子
  S.off(); S.node(2, 14, 2); S.node(3, 10, 2); S.hl([2, 3], GOLD);
  say('index 2、3 是根的孩子', '');
  await step(tok);                                   // 8:15 4–7
  S.off(); [4, 5, 6, 7].forEach((i) => S.node(i, HB_HEAP[i - 1], 2)); S.hl([4, 5, 6, 7], GOLD);
  say('4、5、6、7 是 2 和 3 的孩子', '');
  await step(tok);                                   // 8:26 8、9、10
  S.off(); [8, 9, 10].forEach((i) => S.node(i, HB_HEAP[i - 1], 2)); S.hl([8, 9, 10], GOLD);
  pal.mood('happy');
  say('8、9、10 是 4 和 5 的孩子', '這就是這堂課要記住的畫面');
  await step(tok);                                   // 9:40 parent(i) = ⌊i/2⌋
  S.off(); S.hl([5], GOLD); S.hl([2], GREEN);
  pal.mood('calm');
  say('parent(i) = ⌊i/2⌋', '例：parent(5) = 2');
  await step(tok);                                   // 9:52 left 2i、right 2i+1
  S.off(); S.hl([2], GOLD); S.hl([4, 5], GREEN);
  say('left(i) = 2i，right(i) = 2i + 1', '例：i = 2 → 孩子 4、5');
}]);

// 10:15 max-heap property（9 步）
FRAG.push(['heapb-maxheap-check', 'max-heap property：逐一檢查 1–5', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide(-6.4, 2.2);
  let S;
  await step(tok);                                   // 10:15 max-heap、min-heap
  S = qTree(HB_HEAP, { cap: 10 });
  say('在 heap 結構上再加條件', '就得到 max-heap 或 min-heap');
  await step(tok);                                   // 10:41 key(node) ≥ key(children)
  bubble('max-heap property：key(父) ≥ key(子)', 0, 7.4, 0);
  S.hl([2], GOLD); S.hl([4, 5], BLUE);
  say('max-heap property：節點的 key ≥ 孩子的 key', '例：14 ≥ 8、7');
  await step(tok);                                   // 11:06 每個節點都要成立
  S.off();
  say('每個節點都要成立（遞迴的）', '');
  await step(tok);                                   // 11:19 葉子自動成立
  S.hl([6, 7, 8, 9, 10], GREEN);
  say('葉子沒有孩子：自動成立', '');
  await step(tok);                                   // 11:51 檢查這個例子
  S.off();
  pal.mood('wow');
  say('這個例子是 max-heap 嗎？', '只要看有孩子的節點');
  await step(tok);                                   // 12:01 看 1–4
  pal.mood('calm');
  for (let i = 1; i <= 4; i++) { S.off(); S.hl([i], GOLD); S.hl([2 * i, 2 * i + 1], BLUE); await beat(tok, 550); }
  say('看 index 1、2、3、4：父 ≥ 兩個孩子', '6、7 以後都沒有孩子，不用看');
  await step(tok);                                   // 12:14 5 只有一個孩子
  S.off(); S.hl([5], GOLD); S.hl([10], BLUE);
  say('index 5 只有一個孩子 [10]', '7 ≥ 1 ✓');
  await step(tok);                                   // 12:30 有 max-heap property
  S.off(); S.hl([1], GREEN);
  pal.mood('happy'); await pal.hop(tok);
  say('全部成立：這是 max-heap', '');
  await step(tok);                                   // 12:36 min-heap：≥ 換成 ≤
  S.off();
  say('min-heap property：把 ≥ 換成 ≤', 'key(父) ≤ key(子)');
}]);

// 13:03 max 與 extract_max（8 步）
FRAG.push(['heapb-max-vs-extract', 'max 很簡單，extract_max 要維持 max-heap', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide(-6.4, 2.2);
  const S = qTree(HB_HEAP, { cap: 10, sizeTag: true });
  const out = [];
  const take = async (ms) => { const v = await S.pop(tok, 'fly', ms); out.push(cube(v, colorFor(v), [0.6, 0.45, 0.6], -5.6 + out.length * 0.8, 0.3, 5.2, 2)); };
  await step(tok);                                   // 13:03 哪個操作最簡單？max
  S.hl([1], GOLD);
  say('max-heap 上哪個操作最簡單？', 'max：直接看根 A[1] = 16');
  await step(tok);                                   // 13:10 extract_max 呢？不簡單
  S.off(); S.hl([1], RED);
  pal.mood('wow');
  say('extract_max 也簡單嗎？不', '拿掉根之後，樹要怎麼辦？');
  await step(tok);                                   // 13:28 max 不改 heap
  S.off(); S.hl([1], GOLD);
  pal.mood('calm');
  say('max 只是回傳，heap 完全不改', '所以仍是 max-heap → O(1)');
  await step(tok);                                   // 13:49 rep invariant
  S.off();
  bubble('rep invariant = max-heap property', 0, 7.4, 0);
  say('rep invariant：資料結構一定要保持的性質', '這裡就是 max-heap property，改前改後都要成立');
  await step(tok);                                   // 14:15 一直 extract_max
  await take(450);
  say('一直做 extract_max：先拿出 16', '拿完要修回 max-heap');
  await step(tok);                                   // 14:21 再拿下一個
  await take(260); await take(260);
  say('再拿下一個最大的：14、10……', '');
  await step(tok);                                   // 14:32 由大到小
  pal.mood('wow');
  say('拿出來的順序：由大到小', '16, 14, 10 → 這就是排序！');
  await step(tok);                                   // 14:51 若 extract_max 很快
  pal.mood('happy'); await pal.hop(tok);
  say('只要 extract_max 夠快', '就得到一個很棒的排序法');
}]);

// 15:04 從亂序陣列到 max-heap（8 步）
FRAG.push(['heapb-build-goal', '亂序陣列 → max-heap：需要哪些操作', async (tok) => {
  fresh([0, 6, 13], [0, 3.6, 0.5]);
  const pal = guide(-5.6, 2.0);
  let S, C;
  await step(tok);                                   // 15:04 怎麼維持 max-heap property
  bubble('修改 heap 時，怎麼維持 max-heap？', 0, 7.6, 0);
  say('大問題：修改 heap 時怎麼維持 max-heap property', '');
  await step(tok);                                   // 15:41 一個不是 max-heap 的例子
  S = qTree([2, 4, 1], { cap: 3, w: 7 });
  say('隨便一個陣列看成 heap', 'A = 2, 4, 1');
  await step(tok);                                   // 15:46 不是 max 也不是 min
  S.hl([1, 2], RED);
  pal.mood('sad');
  say('2 < 4：不是 max-heap；1 < 2：也不是 min-heap', '只是「看成 heap」而已');
  await step(tok);                                   // 16:10 要能從亂序陣列建 max-heap
  S.off();
  pal.mood('calm');
  say('所以還需要：把亂序陣列建成 max-heap', '');
  await step(tok);                                   // 16:50 每個操作都要維持 invariant
  C = code(['build_max_heap(A)', 'max_heapify(A, i)', 'insert / extract_max', 'heap_sort(A)'], 4.2, 7.0, 0.5);
  say('接下來每個 heap 操作', '都必須維持 max-heap 這個 invariant');
  await step(tok);                                   // 17:08 build_max_heap
  C.hl(0);
  say('build_max_heap：任意陣列 → max-heap', '例如把它變成 4, 2, 1');
  await step(tok);                                   // 17:24 變成 4, 2, 1
  S.hl([1, 2], GOLD);
  await S.sw(tok, 1, 2, 800);
  S.off(); S.hl([1], GREEN);
  pal.mood('happy');
  say('A = 4, 2, 1：現在是 max-heap', '順序改了（不一定完全排好）');
  await step(tok);                                   // 17:59 先要有 max_heapify
  S.off(); C.hl(1);
  say('要做 build_max_heap，先要有 max_heapify', '最基本的操作');
}]);

// 18:13 max-heapify 的前提（7 步）
FRAG.push(['heapb-heapify-contract', 'max-heapify 的前提：左右子樹已是 max-heap', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide(-6.4, 2.2);
  let S;
  await step(tok);                                   // 18:13 修子樹根上的一個違規
  S = qTree(HB_HEAPIFY, { cap: 10 });
  S.hl([2], RED);
  say('max_heapify：修正「子樹的根」上的一個違規', '');
  await step(tok);                                   // 18:48 最基本、一直會用
  S.off();
  bubble('最基本的操作：會一直用到', 0, 7.4, 0);
  say('max_heapify 是最基本的操作', '後面會一用再用');
  await step(tok);                                   // 19:20 不能隨便的輸入：只能有一個違規
  S.hl([2], RED);
  pal.mood('wow');
  say('輸入不能是任意陣列', '只能有「一個」違規');
  await step(tok);                                   // 20:06 前提：左右子樹已是 max-heap
  hbBox(S, [4, 8, 9]); hbBox(S, [5, 10]);
  S.hl([4, 8, 9, 5, 10], GREEN);
  pal.mood('calm');
  say('前提：left(i)、right(i) 底下的子樹都已是 max-heap', 'i = 2：子樹 [4] 和 [5]');
  await step(tok);                                   // 20:35 max_heapify(A, i)
  code(['max_heapify(A, i)', 'A：陣列　i：index'], 4.6, 7.4, 0.5);
  say('呼叫方式：max_heapify(A, i)', 'A 是陣列，i 是要修的位置');
  await step(tok);                                   // 20:47 前提不成立：可以亂來
  bad('前提不成立 → 不保證任何結果', -2.8, 7.4, 0);
  pal.mood('sad');
  say('前提不成立時，它可以什麼都不保證', '');
  await step(tok);                                   // 20:57 前提成立：交回 max-heap
  good('前提成立 → 交回修好的 max-heap', -2.8, 6.7, 0);
  pal.mood('happy'); await pal.hop(tok);
  say('前提成立，就要交回修好的 max-heap', '這就是它的「合約」（contract）');
}]);

// 21:33 max-heapify(A, 2) 的例子（15 步，內建 max-heapify 的逐句版）
FRAG.push(['heapb-heapify-2', 'max-heapify(A, 2)：修正單一個違規', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide(-6.4, 2.2);
  let S, pi;
  await step(tok);                                   // 21:33 例子 16, 4, 10, …
  S = qTree(HB_HEAPIFY, { cap: 10 });
  say('例子：A = 16, 4, 10, 14, 7, 9, 3, 2, 8, 1', '');
  await step(tok);                                   // 22:13 是 max-heap 嗎？不是
  pal.mood('wow');
  say('這是 max-heap 嗎？不是', '有一個地方出問題');
  await step(tok);                                   // 22:21 4 < 14
  S.hl([2], RED); S.hl([4], BLUE);
  say('4 < 14：在 index 2 違規', '');
  await step(tok);                                   // 22:27 呼叫 max_heapify(A, 2)
  S.off(); S.hl([2], GOLD);
  pi = tag('i = 2', 'pkt', S.p(2).x - 1.1, S.p(2).y + 0.6, 0);
  pal.mood('calm');
  say('呼叫 max_heapify(A, 2)', '只要看 index 2 這棵子樹');
  await step(tok);                                   // 22:47 前提成立
  hbBox(S, [4, 8, 9]); hbBox(S, [5, 10]);
  S.hl([4, 8, 9, 5, 10], GREEN);
  say('前提：[4]、[5] 底下的子樹都是 max-heap', '成立 ✓');
  await step(tok);                                   // 23:02 由下往上；葉子本來就是
  S.off(); S.hl([6, 7, 8, 9, 10], GREEN);
  say('通常是由下往上做：葉子本來就是 max-heap', '不用檢查');
  await step(tok);                                   // 23:15 小 heap 合成大 heap
  S.off();
  bubble('兩個小 max-heap ＋ 一個根 → max_heapify → 大 max-heap', 0, 7.5, 0);
  say('兩個小 heap 接上一個根，用 max_heapify 合成大的', '');
  await step(tok);                                   // 23:45 heap size = 10
  tag('heap size = 10', 'ptr', S.c(10).x, 1.15, S.c(10).z);
  say('記住 heap size：這裡是 10', '排序時 heap size 會變');
  await step(tok);                                   // 23:55 做的事就是交換
  say('max_heapify 做的事：就是交換元素', '');
  await step(tok);                                   // 24:06 看兩個孩子，和較大的換
  S.hl([2], GOLD); S.hl([4, 5], BLUE);
  say('看 4 的兩個孩子 14、7', '和「較大的孩子」交換');
  await step(tok);                                   // 24:16 A[2] ↔ A[4]
  await S.sw(tok, 2, 4, 800); S.off();
  move(pi, S.p(4).x - 1.1, S.p(4).y + 0.6, 0);
  say('交換 A[2] ↔ A[4]：14 上去、4 下來', '第一步完成');
  await step(tok);                                   // 24:43 遞迴 max_heapify(A, 4)
  S.hl([4], RED);
  txt(pi, 'i = 4');
  say('4 到了下一層，又違規了', '遞迴呼叫 max_heapify(A, 4)');
  await step(tok);                                   // 25:12 看兩個孩子
  S.off(); S.hl([4], GOLD); S.hl([8, 9], BLUE);
  say('看 4 的孩子：A[8] = 2、A[9] = 8', '較大的是 A[9] = 8');
  await step(tok);                                   // 25:21 交換
  await S.sw(tok, 4, 9, 800); S.off();
  move(pi, S.p(9).x - 0.9, S.p(9).y + 0.6, 0);
  note('老師說 A[8]，其實是 A[9]', S.p(9).x + 0.2, S.p(9).y - 0.9, 0);
  say('交換：8 上去、4 下來', 'A[4] ↔ A[9]');
  await step(tok);                                   // 25:36 結束
  S.hl([2, 4, 9], GREEN);
  pal.mood('happy'); await pal.hop(tok);
  say('4 到了葉子：沒有更多呼叫，完成', 'A = 16, 14, 10, 8, 7, 9, 3, 2, 4, 1');
}]);

// 25:51 max-heapify 為什麼是 O(log n)（12 步）
FRAG.push(['heapb-heapify-logn', 'max-heapify 為什麼是 O(log n)', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide(-6.4, 2.2);
  let S, q, a1, a2;
  await step(tok);                                   // 25:51 可能要一路換到葉子
  S = qTree([1, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2], { cap: 15, arr: false, sz: 0.8 });
  S.hl([1], RED);
  say('最壞情況：要一路換到葉子', 'heap 很大時，步數會很多嗎？');
  await step(tok);                                   // 26:04 複雜度是？
  q = bubble('max_heapify 的複雜度？', 4.6, 7.4, 0);
  pal.mood('wow');
  say('max_heapify 的時間複雜度是多少？', '');
  await step(tok);                                   // 26:16 有人答 O(n)
  a1 = note('學生 A：O(n)？每個點都可能換', -3.0, 7.4, 0);
  say('有人答 O(n)：可能每個節點都要換', '');
  await step(tok);                                   // 26:29 有人答 log n
  a2 = note('學生 B：O(log n)', -3.0, 6.8, 0);
  say('有人答 O(log n)：為什麼？', '');
  await step(tok);                                   // 27:31 對：log n
  kill(a1); txt(a2, '答案：O(log n) ✓');
  pal.mood('happy');
  say('答案是 log n', '接著看理由');
  await step(tok);                                   // 28:01 理由一：nearly complete
  kill(q); kill(a2); S.off();
  pal.mood('calm');
  say('理由一：heap 是 nearly complete binary tree', '不是歪一邊的樹');
  await step(tok);                                   // 28:18 15 個是 perfect；高度 ≤ log n
  S.lvTags(4);
  bubble('15 個 = perfect binary tree，h = 3', 4.6, 7.4, 0);
  say('15 個元素剛好排滿：高度 ≤ log n', 'h = ⌊log₂ 15⌋ = 3');
  await step(tok);                                   // 28:35 一層一層走
  await S.down(tok, 1, 15, 600);
  say('演算法一層一層往下走', '每層最多換一次 → 3 次');
  await step(tok);                                   // 28:44 理由二：只有一個違規
  S.hl([1, 2, 3], GREEN);
  say('理由二：前提保證只有一個違規', '左右子樹本來就是 max-heap');
  await step(tok);                                   // 28:52 沒有前提就可能 O(n)
  S.off();
  bad('沒有這個前提，O(n) 才可能是對的', 0, 7.4, 0);
  say('如果沒有這個前提，O(n) 才可能是對的', '');
  await step(tok);                                   // 29:25 只要往下走層數那麼多步
  say('有前提：只要沿一條路往下', '步數 = 層數 = O(log n)');
  await step(tok);                                   // 29:40 O(log n)，基本積木
  good('max_heapify：O(log n)', 4.6, 6.7, 0);
  pal.mood('happy'); await pal.hop(tok);
  say('max_heapify 是 O(log n)', '後面所有演算法的基本積木');
}]);

// 30:00 build-max-heap（13 步，內建 build-max-heap 的逐句版）
FRAG.push(['heapb-build', 'build-max-heap：從 n/2 做回 1', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide(-6.4, 2.2);
  let S, C, pi;
  const at = (i) => { if (!pi) pi = tag('', 'pkt', 0, 0, 0); txt(pi, 'i = ' + i); const p = S.p(i); pi.position.set(p.x - 1.0, p.y + 0.6, 0); };
  await step(tok);                                   // 30:00 用 max_heapify 做 build-max-heap
  bubble('用 max_heapify → build_max_heap', 0, 7.4, 0);
  say('用 max_heapify 來做 build_max_heap', '');
  await step(tok);                                   // 30:21 亂序陣列變 max-heap
  S = qTree(HB_BUILD, { cap: 10 });
  say('排序第一步：把亂序陣列變成 max-heap', 'A = 4, 1, 3, 2, 16, 9, 10, 14, 8, 7');
  await step(tok);                                   // 30:37 A[1..n]
  say('把 A[1..n] 轉成 max-heap', '');
  await step(tok);                                   // 30:52 重點是 max
  S.hl([2], RED); S.hl([5], BLUE);
  say('任何陣列都「看得成」heap，重點是「max」-heap', '這裡 1 < 16：還不是 max-heap');
  await step(tok);                                   // 31:31 兩行虛擬碼
  S.off();
  C = code(['for i = ⌊n/2⌋ downto 1:', '    max_heapify(A, i)'], 4.2, 7.4, 0.5);
  say('只有兩行：i 從 ⌊n/2⌋ 倒著做到 1', '每次呼叫 max_heapify(A, i)');
  await step(tok);                                   // 32:05 A[n/2+1..n] 都是葉子
  S.hl([6, 7, 8, 9, 10], GREEN);
  pal.mood('wow');
  say('A[⌊n/2⌋+1 .. n] 全是葉子', 'n = 10：A[6..10]');
  await step(tok);                                   // 32:33 葉子自動是 max-heap
  pal.mood('calm');
  say('葉子自動滿足 max-heap property', '不管 n 是多少都對');
  await step(tok);                                   // 33:04 每次呼叫前提都成立
  S.off();
  say('倒著做：每次呼叫時，前提都成立', '孩子底下已經是 max-heap');
  await step(tok);                                   // 33:23 從 n/2 = 5 開始
  C.hl(0); at(5);
  S.hl([5], GOLD); S.hl([10], BLUE);
  say('從 i = 5 開始：A[5] 只有一個孩子', '那個孩子是葉子 → 是 max-heap');
  await step(tok);                                   // 33:49 接上葉子，可能要換
  C.hl(1);
  say('16 ≥ 7：不用換', '有時要換一次，換完就是小小的 max-heap');
  await step(tok);                                   // 34:04 level 1 的節點
  S.off();
  for (const i of [4, 3]) { at(i); await S.down(tok, i, 10, 500); }
  say('i = 4、3：孩子都是葉子', '2 和 14 換；3 和 10 換');
  await step(tok);                                   // 34:25 level 2
  at(2); await S.down(tok, 2, 10, 500);
  say('i = 2：再上一層', '1 一路往下：和 16 換、再和 7 換');
  await step(tok);                                   // 34:31 一路往上
  at(1); await S.down(tok, 1, 10, 450);
  S.hl([1], GREEN);
  pal.mood('happy');
  say('i = 1：左右孩子都已是 max-heap', 'A = 16, 14, 10, 8, 7, 9, 3, 2, 4, 1');
}]);

// 34:48 build-max-heap 粗估 O(n log n)（12 步）
FRAG.push(['heapb-build-naive', 'build-max-heap：粗估 O(n log n)', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide(-6.4, 2.2);
  let S, ans;
  await step(tok);                                   // 34:48 直接分析
  S = qTree(HB_BUILD, { cap: 10 });
  code(['for i = ⌊n/2⌋ downto 1:', '    max_heapify(A, i)'], 4.2, 7.4, 0.5);
  say('直接分析：build_max_heap 要多久？', '');
  await step(tok);                                   // 34:54 n log n
  S.hl([1, 2, 3, 4, 5], GOLD);
  ans = note('n/2 次 × O(log n) = O(n log n)', -3.0, 7.4, 0);
  say('n/2 次呼叫，每次 O(log n)', 'O(n log n)');
  await step(tok);                                   // 35:05 能更好嗎？
  S.off();
  pal.mood('wow');
  say('這是簡單的分析：能不能分析得更好？', '');
  await step(tok);                                   // 35:29 不改演算法，只改分析
  say('演算法不改，只改「分析」', '');
  await step(tok);                                   // 35:50 big O：上界
  say('O(n log n) 是對的上界', 'big O 只說「不會超過」');
  await step(tok);                                   // 37:04 其實是 O(n)
  txt(ans, '仔細分析：O(n)！');
  pal.mood('happy');
  say('正確答案：仔細算是 O(n)', '');
  await step(tok);                                   // 37:24 葉子不做事
  S.hl([6, 7, 8, 9, 10], GRAY);
  pal.mood('calm');
  say('直覺：葉子完全不用做事', '迴圈本來就從 n/2 開始');
  await step(tok);                                   // 37:38 葉子上一層：約 1 步
  S.off(); S.hl([3, 4, 5], BLUE);
  [3, 4, 5].forEach((i) => { const p = S.p(i); tag('1 步', 'ptr', p.x, p.y + 0.85, 0); });
  say('葉子上一層：各約 1 步', '這種節點最多');
  await step(tok);                                   // 37:53 再上一層：2 步
  S.hl([2], GOLD); { const p = S.p(2); tag('2 步', 'ptr alt', p.x, p.y + 0.85, 0); }
  say('再上一層：最多 2 步', '');
  await step(tok);                                   // 38:02 越高越少
  say('越往上，步數越多', '但節點越來越少');
  await step(tok);                                   // 38:13 根：log n 步，只有 1 個
  S.hl([1], RED); { const p = S.p(1); tag('log n 步', 'ptr alt', p.x - 1.4, p.y, 0); }
  say('根要 log n 步，但只有 1 個', '');
  await step(tok);                                   // 38:43 仔細數
  S.off();
  say('分析就是「數數」', '只要數得仔細一點');
}]);

// 39:06 逐層計數（8 步，內建 build-heap-cost 的逐句版）
FRAG.push(['heapb-build-cost', '為什麼 build-max-heap 是 Θ(n)：逐層計數', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide(-6.4, 2.2);
  const S = qTree([16, 14, 10, 8, 7, 9, 3, 2, 4, 1, 5, 6, 11, 12, 13], { cap: 15, arr: false, sz: 0.8 });
  const H1 = [4, 5, 6, 7], H2 = [2, 3];
  const F = tag('', 'ptr alt', 0, 0.7, 2.5);
  await step(tok);                                   // 39:06 葉子上一層：常數時間
  S.hl(H1, BLUE);
  say('觀察一：葉子上一層的節點', 'max_heapify 只要常數時間 c');
  await step(tok);                                   // 39:34 上方 L 層：O(L)
  S.hl(H2, GOLD); S.hl([1], RED);
  [['L = 1', QLY[2]], ['L = 2', QLY[1]], ['L = 3', QLY[0]]].forEach(([t, y]) => tag(t, 'idx', -6.4, y, 0));
  say('一般來說：在葉子上方 L 層的節點', '要 O(L) 時間');
  await step(tok);                                   // 40:05 n/4 個在 level 1
  S.off(); S.hl(H1, BLUE);
  txt(F, 'level 1：約 n/4 個');
  say('觀察二：level 1 大約有 n/4 個節點', '（差一兩個不要緊）');
  await step(tok);                                   // 40:27 n/8 個在 level 2
  S.hl(H2, GOLD);
  txt(F, 'level 1：n/4 個，level 2：n/8 個');
  say('level 2 大約 n/8 個', '');
  await step(tok);                                   // 40:36 根：1 個
  S.hl([1], RED);
  txt(F, 'n/4、n/8、…、根只有 1 個（level log n）');
  say('一路往上，最頂的根只有 1 個', '在 level log n');
  await step(tok);                                   // 40:45 工作變多、節點變少
  pal.mood('wow');
  say('每個節點的工作變多時，節點數在變少', '這就是要仔細數的地方');
  await step(tok);                                   // 41:20 總工作 n/4·1c
  S.off(); S.hl(H1, BLUE);
  pal.mood('calm');
  txt(F, '總工作 = n/4 · 1c + …');
  say('把每層加起來：先是 n/4 個 × 1c', '');
  await step(tok);                                   // 42:03 + n/8·2c + …
  S.hl(H2, GOLD); S.hl([1], RED);
  txt(F, 'n/4·1c + n/8·2c + n/16·3c + … + 1·c·log n');
  say('再加 n/8 × 2c、n/16 × 3c……最後 1 × c log n', '');
}]);

// 42:37 級數收斂（9 步）
FRAG.push(['heapb-series', 'Σ (i+1)/2ⁱ 收斂到常數 → Θ(n)', async (tok) => {
  fresh([0, 5.5, 14], [0, 2.6, 0]);
  const pal = guide(-6.3, 2.4);
  const SC = 1.2, sx = 5.2, fr = ['1/1', '2/2', '3/4', '4/8', '5/16', '6/32', '7/64'];
  let sum = 0, F, cap;
  const bar = (i) => {
    const t = (i + 1) / Math.pow(2, i), h = Math.max(0.06, t * SC * 1.6), x = -4.6 + i * 1.2;
    cube(fr[i], colorFor(i + 1), [0.9, h, 0.9], x, h / 2, 0, 3);
    tag('i=' + i, 'idx', x, 0.05, 0.9);
    cube(null, colorFor(i + 1), [1.1, Math.max(0.03, t * SC), 1.1], sx, 0.05 + (sum + t / 2) * SC, 0, 3);
    sum += t;
  };
  await step(tok);                                   // 42:37 令 n/4 = 2ᵏ
  F = tag('令 n/4 = 2ᵏ', 'ptr alt', 0, 6.4, 0);
  say('為了好算：令 n/4 = 2ᵏ', '');
  await step(tok);                                   // 42:50 整理成 c·2ᵏ·(…)
  txt(F, 'c · 2ᵏ · (1/2⁰ + 2/2¹ + 3/2² + … + (k+1)/2ᵏ)');
  for (let i = 0; i < 3; i++) { bar(i); await beat(tok, 350); }
  say('提出 c·2ᵏ，括號裡是 (i+1)/2ⁱ 一項一項加', '前 3 項：1、1、0.75');
  await step(tok);                                   // 43:42 括號裡是多少？
  for (let i = 3; i < 7; i++) { bar(i); await beat(tok, 350); }
  pal.mood('wow');
  say('括號裡的總和是多少？', '部分和 = ' + Math.round(sum * 100) / 100 + '，越加越慢');
  await step(tok);                                   // 44:30 學生：趨近 2
  note('學生：會收斂到 2？', -3.0, 5.6, 0);
  say('有學生說：會收斂到 2', '老師：差不多，反正是常數');
  await step(tok);                                   // 44:49 有界常數
  line(sx - 0.9, 0.05 + 4 * SC, sx + 0.9, 0.05 + 4 * SC, 0, '#6a4a00');
  cap = tag('上限 4', 'ptr alt', sx + 1.3, 0.05 + 4 * SC, 0);
  pal.mood('happy');
  say('收斂級數：不管 k 多大，都被一個常數框住', '精確值：Σ (i+1)/2ⁱ = 4（課堂說「小於 3」）');
  await step(tok);                                   // 45:17 剩下 c·2ᵏ → Θ(n)
  txt(F, 'c · 2ᵏ · (常數) = c · (n/4) · 常數 = Θ(n)');
  say('剩下 c 和 2ᵏ；2ᵏ = n/4', '所以是 <span class="ok">Θ(n)</span>');
  await step(tok);                                   // 46:22 再解釋一次代換
  pal.mood('calm');
  txt(F, 'n/4 · 1c = c · 2ᵏ · 1/2⁰');
  say('再看一次：n/4 換成 2ᵏ，1 寫成 1/2⁰', '每一項都這樣代換');
  await step(tok);                                   // 46:55 Σ 寫法
  txt(F, 'Σᵢ₌₀ᵏ (i+1)/2ⁱ ≤ 常數');
  say('寫成符號：Σ(i = 0..k) (i+1)/2ⁱ', '它有上界');
  await step(tok);                                   // 47:21 同一個演算法更快
  txt(F, 'build_max_heap：O(n)');
  pal.mood('happy'); await pal.hop(tok);
  say('同一個演算法，分析仔細就得到更緊的界', 'build_max_heap 是 <span class="ok">O(n)</span>');
}]);

// 47:53 heap sort 虛擬碼（9 步）
FRAG.push(['heapb-heapsort-code', 'Heap Sort：A[1] ↔ A[n]、heap size − 1、max-heapify', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide(-6.4, 2.2);
  const S = qTree(HB_HEAP, { cap: 10, sizeTag: true });
  let C;
  await step(tok);                                   // 47:53 幾乎就是 heap sort 了
  C = code(['1 build_max_heap(A)', '2 最大值在 A[1]', '3 swap A[1] ↔ A[n]', '4 heap_size − 1', '5 max_heapify(A, 1)', '  回到第 2 行'], -4.0, 7.6, 0.45);
  say('有了 build_max_heap，heap sort 幾乎完成', '');
  await step(tok);                                   // 48:20 build
  C.hl(0);
  say('第 1 步：把亂序陣列 build 成 max-heap', 'O(n)：得到 16, 14, 10, …');
  await step(tok);                                   // 48:33 max 在 A[1]
  C.hl(1); S.hl([1], GOLD);
  say('第 2 步：最大值就在 A[1]', '16');
  await step(tok);                                   // 48:49 swap
  C.hl(2); S.hl([10], GOLD);
  await S.sw(tok, 1, 10, 900); S.off();
  pal.mood('wow');
  say('第 3 步：A[1] 和 A[n] 交換', '最大的 16 跑到陣列最後');
  await step(tok);                                   // 49:16 heap size − 1
  C.hl(3); tint(S.nd[10], GRAY); tint(S.cl[10], GRAY); S.setSize(9);
  pal.mood('calm');
  say('第 4 步：heap size 減 1', '把 node 10 丟出 heap：16 已排好');
  await step(tok);                                   // 49:34 新根可能違規
  C.hl(4); S.hl([1], RED);
  say('新的根 1 可能違規', '但它的孩子都還是 max-heap');
  await step(tok);                                   // 50:01 max_heapify 修好
  await S.down(tok, 1, 9, 550);
  say('剛好符合前提：max_heapify(A, 1) 修好', '1 一路往下沉');
  await step(tok);                                   // 50:10 回到第 2 步
  C.hl(5); S.hl([1], GREEN);
  pal.mood('happy');
  say('根又是最大值 14', '回到第 2 行，重複');
  await step(tok);                                   // 50:28 不用 extract_max，用交換再丟掉
  S.off(); C.hl(-1);
  say('也可以用 extract_max', '這裡用「交換到最後再丟掉」');
}]);

// 50:44 小例子 4, 2, 1（10 步）
FRAG.push(['heapb-heapsort-421', 'Heap Sort 小例子：4, 2, 1', async (tok) => {
  fresh([0, 6, 13], [0, 3.6, 0.5]);
  const pal = guide(-5.6, 2.0);
  let S, out;
  const gone = (i) => { tint(S.nd[i], GRAY); tint(S.cl[i], GRAY); };
  await step(tok);                                   // 50:44 4, 2, 1 是 max-heap
  S = qTree([4, 2, 1], { cap: 3, w: 7, sizeTag: true });
  say('小例子：4, 2, 1 是 max-heap', 'heap size = 3');
  await step(tok);                                   // 50:55 4 和 1 交換
  S.hl([1, 3], GOLD);
  await S.sw(tok, 1, 3, 900); S.off();
  say('4 和 1 交換', 'A = 1, 2, 4');
  await step(tok);                                   // 51:07 把 4 丟出 heap
  gone(3); S.setSize(2);
  say('4 是最大的：把它從 heap 刪掉', 'heap size = 2');
  await step(tok);                                   // 51:21 4 是排序結果的第一個
  out = good('排好：4', 4.2, 6.6, 0);
  say('4 是排序結果的第一個（從後面放起）', '');
  await step(tok);                                   // 51:24 1, 2 不是 max-heap
  S.hl([1], RED);
  pal.mood('wow');
  say('剩下 1, 2：不是 max-heap', '1 < 2');
  await step(tok);                                   // 51:29 max_heapify → 2, 1
  S.hl([2], BLUE);
  await S.sw(tok, 1, 2, 800); S.off();
  pal.mood('calm');
  say('孩子是 max-heap → 可以用 max_heapify', '變成 2, 1');
  await step(tok);                                   // 51:38 取出 2
  S.hl([1, 2], GOLD);
  await S.sw(tok, 1, 2, 800); S.off();
  gone(2); gone(1); S.setSize(1);
  txt(out, '排好：1, 2, 4');
  pal.mood('happy'); await pal.hop(tok);
  say('根 2 是最大：拿出來，剩 1 個就完成', 'A = 1, 2, 4');
  await step(tok);                                   // 51:47 總共 O(n log n)
  bubble('heap sort：O(n log n)', 4.2, 5.9, 0);
  say('整個 heap sort：O(n log n)', '');
  await step(tok);                                   // 51:53 build O(n)、取 max、交換 O(1)
  bubble('build O(n)；取 max、交換 O(1)', 4.2, 5.2, 0);
  say('build_max_heap O(n)', '取 max、交換都是常數時間');
  await step(tok);                                   // 52:02 max_heapify log n × n 次
  bubble('max_heapify O(log n) × n 次', 4.2, 4.5, 0);
  say('但 max_heapify 每次 O(log n)，要做 n 次', 'n log n');
}]);
  }

  // ═══ heaphq.js ═══
  {
// ─── HqPJF2L5h9U：Abdul Bari「Heap」（陣列表示、complete binary tree、insert／delete、heap sort、heapify、priority queue） ───
// Cued scenes: every `await step(tok)` waits for the sentence it shows; beats are motion only.
// 只用 K 與 ctx。陣列一律 1-based。左下角的小幫手會跟著反應（違規時驚訝、修好時開心）。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, line, arrow, code, travel, buddy, icon, step, GOLD, GREEN, RED, GRAY } = K;
const say = ctx.say, beat = ctx.beat, colorFor = ctx.colorFor;
const BLUE = '#1f3a6e', SORTED = '#2fc092';
const QLY = [6.2, 4.7, 3.2, 1.7];
const QCAM = [0, 6, 15.5], QLOOK = [0, 3.3, 1];
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const bubble = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
// 小幫手：站在左下角，用表情陪你看每一步
const guide = (x = -6.3, z = 1.8) => buddy('', '', '#ffc56b', x, 0, z, 0.72);
// 一棵 heap：上面是樹、下面是陣列格（同一份資料兩種畫法）
function qTree(vals, o = {}) {
  const W = o.w || 11, X0 = o.x0 || 0, cap = o.cap || vals.length, arr = o.arr !== false;
  const cz = o.cz === undefined ? 3.4 : o.cz, dx = o.dx || 0.9, sz = o.sz || 0.9, min = !!o.min;
  const better = (x, y) => (min ? x < y : x > y);
  const GT = min ? '<' : '>', GE = min ? '≤' : '≥', BIG = min ? '小' : '大';
  const col = (v) => (o.color ? o.color(v) : colorFor(v));
  const S = { a: [null], nd: [null], cl: [null], ed: [null], size: 0, cap, better };
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
  S.drop = (i) => { if (S.nd[i]) { kill(S.nd[i]); S.nd[i] = null; } if (S.cl[i]) { kill(S.cl[i]); S.cl[i] = null; } if (S.ed[i]) { kill(S.ed[i]); S.ed[i] = null; } S.a[i] = null; };
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
  // insert 的調整：由葉子往根（向上），整段在同一步裡快速播完
  S.up = async (tok, i, ms = 600) => {
    while (i > 1) {
      const p = i >> 1; S.off(); S.hl([i], GOLD); S.hl([p], BLUE);
      if (!better(S.a[i], S.a[p])) { await beat(tok, ms * 0.5); break; }
      await S.sw(tok, i, p, ms); i = p;
    }
    S.off(); return i;
  };
  // delete／heapify 的調整：由 i 往葉子（向下），和較大（min-heap 是較小）的孩子換
  S.down = async (tok, i, size, ms = 600) => {
    while (2 * i <= size) {
      const l = 2 * i, r = l + 1; let c = l; if (r <= size && better(S.a[r], S.a[l])) c = r;
      S.off(); S.hl([i], GOLD); S.hl(r <= size ? [l, r] : [l], BLUE);
      await beat(tok, ms * 0.5);
      if (!better(S.a[c], S.a[i])) break;
      await S.sw(tok, i, c, ms); i = c;
    }
    S.off(); return i;
  };
  // 刪根：根飛走、最後一個補到根（不往下調）。mode：'keep' 放進 [n]、'park' 先停在 [n] 上方、'fly' 丟掉
  S.popStart = async (tok, mode = 'fly', ms = 700) => {
    const n = S.size, top = S.a[1];
    S.off();
    fly(S.nd[1]); S.nd[1] = null;
    const cell = S.cl[1]; S.cl[1] = null;
    if (n > 1) S.mv(n, 1);
    if (S.ed[n]) { kill(S.ed[n]); S.ed[n] = null; }
    if (cell) {
      glow(cell, null); tint(cell, GRAY);
      const cn = S.c(n);
      if (mode === 'keep') { move(cell, cn.x, cn.y, cn.z); S.cl[n] = cell; }
      else if (mode === 'park') { move(cell, cn.x, 1.3, cn.z + 0.2); S.parked = cell; }
      else fly(cell, V3(0, 6, 5));
    }
    S.a[n] = mode === 'fly' ? null : top;
    S.setSize(n - 1);
    await beat(tok, ms);
    return top;
  };
  // 停在上方的值放進 [i]
  S.store = (i) => { if (!S.parked) return; const c = S.c(i); move(S.parked, c.x, c.y, c.z); S.cl[i] = S.parked; S.parked = null; };
  S.pop = async (tok, mode = 'keep', ms = 500) => { const n = S.size, top = await S.popStart(tok, mode, ms); await S.down(tok, 1, n - 1, ms); return top; };
  S.gaps = (list) => list.map((i) => { const c = S.c(i); return tag('空', 'ptr', c.x, 0.95, c.z); });
  S.lvTags = (k) => { const out = []; for (let d = 0; d < k; d++) out.push(tag('h = ' + d, 'idx', X0 - W / 2 - 0.9, QLY[d], 0)); return out; };
  return S;
}
const HQ_MAX = [50, 30, 20, 15, 10, 8, 16];
const ABC = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const LETTER = () => '#4b9ee2';

// 02:29 陣列表示（11 步）
FRAG.push(['heaphq-array-rep', '用陣列存 Binary Tree：A–G 與三個公式', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide();
  await step(tok);                                   // 2:32 這是一棵 binary tree，要存進陣列
  const S = qTree([], { cap: 7, color: LETTER });
  ABC.forEach((v, k) => S.node(k + 1, v, 2));
  say('一棵 binary tree，要把它存進陣列', '節點用字母 A–G，比較好讀');
  await beat(tok, 900);
  await step(tok);                                   // 2:50 程式從 0 開始，這裡從 1 開始
  const n1 = note('從 [1] 開始', S.c(1).x, 1.25, S.c(1).z);
  say('寫程式陣列從 [0] 開始；課本習慣從 [1] 開始', '[0] 不用，第一個元素放在 [1]');
  await step(tok);                                   // 3:18 要存兩件事
  kill(n1);
  const b1 = bubble('① 所有元素', 5.0, 6.7, 0), b2 = bubble('② 誰是 parent／child', 5.0, 6.0, 0);
  pal.mood('wow');
  say('要存兩件事：元素本身，和彼此的關係', '誰是 parent、誰是 left child、right child');
  await step(tok);                                   // 3:36 一層一層填
  pal.mood('calm');
  for (const [k, v] of ABC.entries()) { S.cell(k + 1, v, 1); S.hl([k + 1], GOLD); await beat(tok, 260); S.off(); }
  S.size = 7;
  say('一層一層、由左到右放進陣列', 'A B C D E F G');
  await step(tok);                                   // 3:51 關係靠公式
  kill(b1); kill(b2);
  const F = code(['left(i)   = 2i    ', 'right(i)  = 2i + 1', 'parent(i) = ⌊i/2⌋ '], 4.9, 6.9, 0.5);
  say('關係靠三個公式維持', '節點在 index i 時：');
  await step(tok);                                   // 4:10 B 在 2，左孩子 D 在 4
  F.hl(0); S.hl([2], GOLD); S.hl([4], GREEN);
  say('B 在 i = 2：左孩子在 2i = 4', 'A[4] = D ✓');
  await step(tok);                                   // 4:24 右孩子 2i+1 = 5
  F.hl(1); S.off(); S.hl([2], GOLD); S.hl([5], GREEN);
  say('右孩子在 2i + 1 = 5', 'A[5] = E ✓');
  await step(tok);                                   // 4:30 C 在 3，孩子 6、7
  S.off(); S.hl([3], GOLD); S.hl([6, 7], GREEN);
  say('C 在 i = 3：孩子在 6 和 7', 'A[6] = F、A[7] = G ✓');
  await step(tok);                                   // 4:49 F 的 parent
  F.hl(2); S.off(); S.hl([6], GOLD); S.hl([3], GREEN);
  say('F 在 6：parent = 6 / 2 = 3', 'A[3] = C ✓');
  await step(tok);                                   // 4:58 G 的 parent：7/2 = 3.5 取 floor
  S.off(); S.hl([7], GOLD); S.hl([3], GREEN);
  const fl = note('7 / 2 = 3.5 → ⌊3.5⌋ = 3', S.p(7).x, S.p(7).y + 1.0, 0);
  say('G 在 7：7 / 2 = 3.5，取 floor 得 3', 'A[3] = C ✓');
  await step(tok);                                   // 5:18 照層序填，公式自動成立
  kill(fl); S.off(); F.hl(-1);
  pal.mood('happy'); await pal.hop(tok);
  say('不用每次套公式：照層序填就自動成立', 'left = 2i、right = 2i + 1、parent = ⌊i/2⌋');
}]);

// 05:38 缺節點要留空格（8 步）
FRAG.push(['heaphq-array-gaps', '缺少的節點要在陣列留空格', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide();
  await step(tok);                                   // 5:39 另一棵：A B C D E
  let S = qTree([], { cap: 7, color: LETTER });
  for (const [k, v] of ['A', 'B', 'C', 'D', 'E'].entries()) { S.put(k + 1, v, 2); await beat(tok, 220); }
  say('少了幾個節點：A B C D E 一樣層序填', '陣列：A B C D E');
  await step(tok);                                   // 5:48 公式照樣成立
  const ok1 = good('公式照樣成立 ✓', 5.0, 6.6, 0);
  S.hl([2], GOLD); S.hl([4, 5], GREEN);
  say('檢查 B：孩子在 4、5，正確', '最後一層不滿沒關係');
  await step(tok);                                   // 5:57 這棵：A B C，D 是 C 的孩子
  fresh(QCAM, QLOOK);
  const pal2 = guide();
  S = qTree([], { cap: 7, color: LETTER });
  for (const [k, v] of ['A', 'B', 'C'].entries()) S.put(k + 1, v);
  S.node(6, 'D', 2);
  say('這棵：D 是 C 的左孩子', 'B 沒有孩子');
  await step(tok);                                   // 6:12 有缺就要留空格
  const ghosts = [4, 5].map((i) => { const p = S.p(i); return tag('（沒有）', 'idx', p.x, p.y, 0); });
  pal2.mood('wow');
  say('層序填時，缺的節點也要佔一格', 'B 的兩個孩子位置：空的');
  await step(tok);                                   // 6:22 A B C _ _ D
  const g = S.gaps([4, 5]);
  S.cell(6, 'D', 1); S.size = 6;
  say('陣列：A B C _ _ D', 'D 放在 [6]');
  await step(tok);                                   // 6:36 D 的 parent：6/2 = 3
  S.hl([6], GOLD); S.hl([3], GREEN);
  pal2.mood('happy');
  say('D 的 parent：⌊6/2⌋ = 3 → C', '關係正確 ✓');
  await step(tok);                                   // 6:45 如果把 D 放在 [4]
  S.off();
  const wrong = cube('D', '#e8a0a0', [0.65, 0.42, 0.7], S.c(4).x, 1.6, S.c(4).z);
  await travel(tok, wrong, V3(S.c(6).x, 1.6, S.c(4).z), V3(S.c(4).x, 0.3, S.c(4).z), 700);
  const ar = arrow(V3(S.p(2).x, S.p(2).y - 0.5, 0), V3(S.p(4).x, S.p(4).y + 0.4, 0), 0xa01010);
  const nb = bad('[4] = 2·2 → 變成 B 的左孩子 ✗', S.p(4).x + 0.4, S.p(4).y - 0.2, 0);
  pal2.mood('sad');
  say('若 D 直接接在 [4]：它就變成 B 的孩子', '<span class="no">關係錯了</span>');
  await step(tok);                                   // 7:01 結論：有缺就留空
  fly(wrong); kill(ar); kill(nb); ghosts.forEach(kill);
  pal2.mood('happy'); await pal2.hop(tok);
  say('不用公式時：缺的節點留空格，公式才會對', '公式管關係，元素照原樣存');
}]);

// 07:22 full vs complete（13 步）
FRAG.push(['heaphq-full-complete', 'Full Binary Tree 與 Complete Binary Tree', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide();
  let S, lv, gp = [], ex = [];
  await step(tok);                                   // 7:32 這棵是 full binary tree
  S = qTree([], { cap: 9, color: LETTER });
  ABC.forEach((v, k) => S.node(k + 1, v, 2));
  say('先看 full binary tree', '就是之前那棵 A–G');
  await step(tok);                                   // 7:42 高度 2，節點數最多
  lv = S.lvTags(3);
  say('高度 h = 2：這個高度能放的節點全放滿了', '0、1、2 三層：1 + 2 + 4 = 7 個');
  await step(tok);                                   // 7:53 再加就會長高
  const gh = S.p(8), ghost = cube('?', '#e4dccb', [0.8, 0.8, 0.8], gh.x, gh.y, 0, 2);
  const gn = note('再加一個 → 高度變 3', gh.x + 0.4, gh.y - 0.9, 0);
  pal.mood('wow');
  say('想再加一個節點，只能放到新的一層', '高度就會增加 → 沒有空位了');
  await step(tok);                                   // 8:13 2^(h+1) − 1
  fly(ghost); kill(gn); pal.mood('calm');
  const fm = bubble('full：2^(h+1) − 1 = 2³ − 1 = 7', 4.6, 6.8, 0);
  say('高度 h 的 full tree：2^(h+1) − 1 個節點', 'h = 2 → 7 個');
  await step(tok);                                   // 8:28 complete：陣列中間沒空格
  kill(fm);
  ABC.forEach((v, k) => S.cell(k + 1, v, 1)); S.size = 7;
  say('complete binary tree：用陣列表示', '第一個到最後一個元素之間，沒有空格');
  await step(tok);                                   // 8:49 有缺的就不是
  S.hl([5], RED);
  await beat(tok, 300);
  S.drop(5); gp = S.gaps([5]);
  pal.mood('sad');
  say('拿掉 E：[5] 變成空格', '<span class="no">中間有空 → 不是 complete</span>');
  await step(tok);                                   // 9:05 定義：中間不能有空
  gp.forEach(kill); S.put(5, 'E', 2);
  pal.mood('happy');
  say('我的定義：陣列從頭到尾中間不能有空格', '<span class="ok">A B C D E F G：complete</span>');
  await step(tok);                                   // 9:22 最後一個之後有空沒關係
  ex = [8, 9].map((i) => good('空 OK', S.c(i).x, 0.95, S.c(i).z));
  say('最後一個元素「之後」有空位沒關係', '重點是「中間」不能有');
  await step(tok);                                   // 9:41 full 也是 complete
  ex.forEach(kill);
  const fc = good('full ⇒ complete', 4.6, 6.8, 0);
  say('這棵既是 full 也是 complete', '每個 full binary tree 都是 complete');
  await step(tok);                                   // 9:46 再加兩個：還是 complete
  kill(fc);
  lv.push(tag('h = 3', 'idx', -6.4, QLY[3], 0));
  S.put(8, 'H', 2); S.put(9, 'I', 2);
  say('最後一層從左邊開始放 H、I', '<span class="ok">一層層看沒有缺：complete</span>');
  await step(tok);                                   // 9:59 拿掉一個就不是
  S.hl([8], RED); await beat(tok, 300);
  S.drop(8); gp = S.gaps([8]);
  pal.mood('sad');
  say('拿掉 H：左邊缺了一個', '<span class="no">中間有空 → 不是 complete</span>');
  await step(tok);                                   // 10:31 課本定義
  gp.forEach(kill); S.put(8, 'H', 2);
  S.hl([1, 2, 3, 4, 5, 6, 7], GREEN); S.hl([8, 9], GOLD);
  pal.mood('happy');
  say('課本定義：h − 1 層以上是 full', '最後一層由左往右填');
  await step(tok);                                   // 11:19 almost complete
  S.off();
  bubble('有人叫它 almost complete', 4.6, 6.8, 0);
  say('有些作者叫它 almost complete binary tree', '多數課本叫 complete（這裡也是）');
}]);

// 11:42 判斷 complete 的例子（11 步）
FRAG.push(['heaphq-complete-check', '判斷是不是 Complete：看陣列有沒有空格', async (tok) => {
  const col = () => '#9b7ef4';
  let S, pal, verdict;
  const show = (vals, cap = 10) => { fresh(QCAM, QLOOK); pal = guide(); S = qTree(vals, { cap, color: col }); };
  const yes = (t = 'complete') => { pal.mood('happy'); return good(t + ' ✓', 4.6, 6.8, 0); };
  const no = (t = '不是 complete') => { pal.mood('sad'); return bad(t + ' ✗', 4.6, 6.8, 0); };
  await step(tok);                                   // 11:42 一層一層檢查
  show([1, 2, 3, 4, 5]);
  say('一層一層看：1 個、2 個，最後一層從左邊開始', '陣列：1 2 3 4 5');
  await step(tok);                                   // 11:56 沒缺 → complete
  verdict = yes();
  say('左邊沒有缺：是 complete', '陣列中間沒有空格');
  await step(tok);                                   // 12:02 再一棵
  show([1, 2, 3, 4, 5, 6]);
  verdict = yes();
  say('最後一層靠左連續：還是 complete', '陣列：1 2 3 4 5 6');
  await step(tok);                                   // 12:10 缺了左邊兩個
  show([1, 2, 3, null, null, 6]);
  S.gaps([4, 5]); verdict = no();
  say('最後一層：前兩個位置沒有，卻有第三個', '應該先有左邊的才能有右邊的');
  await step(tok);                                   // 12:27 缺三個
  show([1, 2, 3, null, null, null, 4]);
  verdict = no();
  say('只有最右邊一個：前面缺了三個', '節點要由左到右排');
  await step(tok);                                   // 12:45 陣列：1 2 3 _ _ _ 4
  S.gaps([4, 5, 6]);
  say('寫成陣列：1 2 3 _ _ _ 4', '<span class="no">中間 3 個空格</span>');
  await step(tok);                                   // 13:00 第三層沒滿就往下長
  show([1, 2, 3, 4, 5, 6, null, 8]);
  S.gaps([7]); verdict = no();
  say('第三層還沒滿，就長到第四層', '[7] 空著 → 不是 complete');
  await step(tok);                                   // 13:12 第二層就缺
  show([1, 2, null, 4, 5]);
  S.gaps([3]); verdict = no();
  say('第二層就缺了右邊那個', '[3] 空著 → 不是 complete');
  await step(tok);                                   // 13:17 前面全滿、最後一層靠左
  show([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  verdict = yes();
  say('上面三層全滿，最後一層從左邊連續', '之後沒有節點不要緊');
  await step(tok);                                   // 13:37 高度最小 log n
  S.lvTags(4);
  bubble('h = ⌊log₂ 10⌋ = 3', 4.6, 6.0, 0);
  say('complete binary tree 的高度一定最小', 'h ≈ log n');
  await step(tok);                                   // 13:54 沒填滿不會往下一層
  S.hl([8, 9, 10], GOLD);
  await pal.hop(tok);
  say('上一層沒填滿，就不會往下一層長', '所以不會多長出無謂的高度');
}]);

// 14:35 max heap／min heap（9 步）
FRAG.push(['heaphq-max-min', 'Max Heap 與 Min Heap', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide(-6.4, 2.6);
  let A, B;
  await step(tok);                                   // 14:34 heap 先是 complete binary tree
  A = qTree(HQ_MAX, { arr: false, w: 6, x0: -3.4, sz: 0.75 });
  say('Heap 首先必須是 complete binary tree', '50；30、20；15、10、8、16');
  await step(tok);                                   // 14:39 30、20 比 50 小
  A.hl([1], GOLD); A.hl([2, 3], BLUE);
  say('30 和 20 都比 50 小', '');
  await step(tok);                                   // 14:47 15、10 < 30；8、16 < 20
  A.off(); A.hl([2, 3], GOLD); A.hl([4, 5, 6, 7], BLUE);
  say('15、10 比 30 小；8、16 比 20 小', '');
  await step(tok);                                   // 14:53 每個節點大於所有子孫
  A.off(); A.hl([1], GREEN);
  pal.mood('wow');
  say('每個節點都比它所有子孫大', '所以根 50 是最大值');
  await step(tok);                                   // 15:01 這叫 max heap
  tag('Max Heap', 'ptr alt', -3.4, 7.4, 0);
  pal.mood('happy');
  say('這樣排的 heap 叫 max heap', '根 = 最大值');
  await step(tok);                                   // 15:17 大於或等於：可重複
  A.off();
  note('≥：可以相等', -3.4, 1.0, 0);
  say('條件是「大於或等於」', '所以允許重複的值');
  await step(tok);                                   // 15:25 另一棵：10；30、20；…
  B = qTree([10, 30, 20, 35, 40, 32, 25], { arr: false, w: 6, x0: 3.4, sz: 0.75 });
  B.hl([2], GOLD); B.hl([4, 5], BLUE);
  pal.mood('calm');
  say('另一棵：35、40 比 30 大，也比 10 大', '32、25 比 20 大');
  await step(tok);                                   // 15:40 根最小 → min heap
  B.off(); B.hl([1], GREEN);
  tag('Min Heap', 'ptr', 3.4, 7.4, 0);
  say('每個節點 ≤ 所有子孫：根是最小值', '這叫 min heap');
  await step(tok);                                   // 16:05 之後用 max heap 講
  B.off(); A.hl([1], GOLD);
  pal.mood('happy'); await pal.hop(tok);
  say('之後都用 max heap 講', 'min heap 做法一樣，只是方向相反');
}]);

// 16:21 錯誤的 insert：塞進根（7 步）
FRAG.push(['heaphq-insert-wrong', '常見錯誤：把 60 直接塞到根', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide(-6.4, 2.2);
  let S, n60;
  await step(tok);                                   // 16:21 在 max heap 裡 insert
  S = qTree(HQ_MAX, { cap: 15, dx: 0.74 });
  say('在 max heap 裡 insert 一個新元素', 'A = 50, 30, 20, 15, 10, 8, 16');
  await step(tok);                                   // 16:32 樹和陣列是同一份資料
  S.hl([1, 2, 3, 4, 5, 6, 7], GOLD);
  await beat(tok, 700); S.off();
  say('上面是樹的畫法，下面是陣列', '中間沒有空格：complete');
  await step(tok);                                   // 16:54 要插入 60
  n60 = pkt('60', 4.6, 7.0, 0);
  pal.mood('wow');
  say('要插入 60', '');
  await step(tok);                                   // 17:07 60 最大，最後在根
  await travel(tok, n60, V3(4.6, 7.0, 0), V3(1.3, 7.0, 0), 800);
  say('60 比誰都大，最後一定在根', '根放最大值');
  await step(tok);                                   // 17:19 錯誤想法：塞進根，其他往下推
  S.mv(7, 15); await beat(tok, 350);
  S.mv(3, 7); await beat(tok, 350);
  S.mv(1, 3); await beat(tok, 350);
  kill(n60);
  const p1 = S.p(1); S.node(1, 60, 1.5); S.cell(1, 60, 1); S.hl([1], RED);
  say('錯誤想法：60 塞進根，其他一路往下推', '50 → 20 的位置 → 16 被擠到最底');
  await step(tok);                                   // 17:40 還是 complete 嗎？
  S.gaps([8, 9, 10, 11, 12, 13, 14]);
  pal.mood('sad');
  say('樹往右下長出一條：[8]～[14] 全空', '<span class="no">不是 complete binary tree</span>');
  await step(tok);                                   // 17:51 不要從根插入
  bad('✗ 不能從根插入', 4.6, 6.9, 0);
  say('所以不能從根插入', '接下來看正確做法');
}]);

// 18:06 正確的 insert（12 步）
FRAG.push(['heaphq-insert-60', 'insert 60：放最後一格，再往上比', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide(-6.4, 2.2);
  const S = qTree(HQ_MAX, { cap: 8 });
  const swaps = tag('交換 0 次', 'ptr', 4.8, 7.2, 0);
  let k = 0, dir;
  const swapOnce = async (i, p) => { await S.sw(tok, i, p, 750); k++; txt(swaps, '交換 ' + k + ' 次'); };
  await step(tok);                                   // 18:06 放在陣列下一個空位
  const n60 = pkt('60', 4.2, 1.4, S.c(8).z);
  await travel(tok, n60, V3(4.2, 1.4, S.c(8).z), V3(S.c(8).x, 0.95, S.c(8).z), 700);
  kill(n60); S.cell(8, 60, 1); S.size = 8;
  say('正確：60 放在陣列下一個空位 [8]', 'heap 原本到 [7] 為止');
  await step(tok);                                   // 18:18 在樹上是 15 的左孩子
  S.node(8, 60, 2);
  S.hl([4], BLUE); S.hl([8], GOLD);
  say('[8] 在樹上是誰的孩子？8 = 2·4', '→ 15 的左孩子');
  await step(tok);                                   // 18:44 違反 max heap
  S.off(); S.hl([8], RED);
  pal.mood('wow');
  say('還是 complete，但 60 是 15 的孩子', '<span class="no">違反 max heap：parent 要 ≥ 孩子</span>');
  await step(tok);                                   // 19:01 和 parent 比：60 > 15
  S.off(); S.hl([4], BLUE);
  await swapOnce(8, 4);
  say('和 parent 比：60 > 15，往上換', 'parent = ⌊8/2⌋ = 4');
  await step(tok);                                   // 19:10 60 > 30
  S.off(); S.hl([2], BLUE);
  await swapOnce(4, 2);
  say('再和 parent 比：60 > 30，再換', 'parent = ⌊4/2⌋ = 2');
  await step(tok);                                   // 19:12 60 > 50
  S.off(); S.hl([1], BLUE);
  await swapOnce(2, 1);
  say('60 > 50，換到根', 'parent = ⌊2/2⌋ = 1');
  await step(tok);                                   // 19:20 陣列裡的路徑 8 → 4 → 2 → 1
  S.off(); S.hl([1, 2, 4, 8], GOLD);
  const path = [8, 4, 2, 1].map((i) => note(String(i), S.c(i).x, 1.05, S.c(i).z));
  say('在陣列裡看：位置 8 → 4 → 2 → 1', '每次除以 2，就是 parent');
  await step(tok);                                   // 20:05 到根了
  path.forEach(kill); S.off(); S.hl([1], GREEN);
  pal.mood('happy'); await pal.hop(tok);
  say('60 是最大的，一路爬到根', 'A = 60, 50, 20, 30, 10, 8, 16, 15');
  await step(tok);                                   // 20:39 時間 = 交換次數
  S.off(); glow(S.nd[1], null);
  say('花多少時間？就看交換幾次：3 次', '');
  await step(tok);                                   // 20:50 取決於高度 log n
  S.lvTags(4);
  say('最多換到根：次數 ≤ 樹高 = log n', '<span class="ok">insert：O(log n)</span>');
  await step(tok);                                   // 21:12 若插入 6 就不用換
  const n6 = note('若插入的是 6：6 ≤ 15，0 次', S.p(8).x + 1.5, S.p(8).y - 0.9, 0);
  say('如果插入的是 6：比 parent 小，不用換', '最少 O(1)、最多 O(log n)');
  await step(tok);                                   // 21:51 方向：由葉子往根
  kill(n6);
  dir = arrow(V3(5.6, 1.9, 0), V3(5.6, 6.4, 0), 0x0f5a3a);
  tag('insert：向上調整', 'good', 5.6, 7.0, 0);
  say('insert：新元素先當葉子，再往根調整', '方向：向上（leaf → root）');
}]);

// 22:22 delete：只能刪根（14 步）
FRAG.push(['heaphq-delete-50', 'Delete：刪根、最後一個補上、往下調', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide(-6.4, 2.2);
  let S, apples = [];
  await step(tok);                                   // 22:22 7 個元素的 max heap
  S = qTree(HQ_MAX, { cap: 7, sizeTag: true });
  say('max heap，7 個元素', 'A = 50, 30, 20, 15, 10, 8, 16');
  await step(tok);                                   // 22:35 只能刪根
  S.hl([1], GOLD);
  say('只能刪根，不能刪其他元素', '不給選擇：一定刪 A[1]');
  await step(tok);                                   // 22:55 水果攤的蘋果堆
  [[0, 0], [-0.55, -0.9], [0.55, -0.9], [-1.1, -1.8], [0, -1.8], [1.1, -1.8]].forEach(([dx, dy], k) => apples.push(icon('🍎', k ? '' : '最好的', 5.4 + dx, 6.6 + dy, 0, 'sm')));
  pal.mood('happy');
  say('像水果攤堆成金字塔的蘋果', '最上面的那顆是最好的');
  await step(tok);                                   // 23:32 只拿最上面那顆
  await travel(tok, apples[0], V3(5.4, 6.6, 0), V3(6.4, 7.4, 0), 700);
  say('要拿就拿最上面那顆', 'max heap 的「最好」= 最大值 50');
  await step(tok);                                   // 24:00 50 刪掉
  apples.forEach(kill);
  fly(S.nd[1]); S.nd[1] = null; fly(S.cl[1], V3(0, 6, 5)); S.cl[1] = null; S.a[1] = null;
  pal.mood('wow');
  say('刪掉根 50', '根空出來了，誰來補？');
  await step(tok);                                   // 24:07 錯誤：30 上去、15 上去
  S.mv(2, 1); await beat(tok, 450);
  S.mv(4, 2); await beat(tok, 450);
  S.hl([1, 2], RED);
  say('常見錯誤：較大的 30 補上，15 再補上 30 的位置', '');
  await step(tok);                                   // 24:17 不是 complete
  const g = S.gaps([4]);
  pal.mood('sad');
  say('[4] 空掉了', '<span class="no">中間有空 → 不是 complete</span>');
  await step(tok);                                   // 24:25 正確：最後一個 16 補到根
  g.forEach(kill); S.off();
  S.mv(2, 4); S.mv(1, 2); await beat(tok, 500);
  S.mv(7, 1); S.setSize(6);
  pal.mood('calm');
  say('正確：陣列最後一個 16 補到根', '[7] 空出來，仍是 complete');
  await step(tok);                                   // 25:08 complete 但不是 max heap
  S.hl([1], RED);
  say('是 complete，但不是 max heap', '要調整：由根往葉子');
  await step(tok);                                   // 25:33 比較孩子 30、20，30 上來
  S.off(); S.hl([1], GOLD); S.hl([2, 3], BLUE);
  await beat(tok, 500);
  await S.sw(tok, 1, 2, 750);
  say('16 的孩子 30、20：較大的 30 上來', 'children = 2·1、2·1 + 1 = 2、3');
  await step(tok);                                   // 26:26 15、10 都比 16 小
  S.off(); S.hl([2], GOLD); S.hl([4, 5], BLUE);
  say('16 的孩子 15、10：較大的 15 也比 16 小', '不用換：停');
  await step(tok);                                   // 26:56 delete 的步驟
  S.off(); S.hl([1], GREEN);
  pal.mood('happy'); await pal.hop(tok);
  say('刪根 → 最後一個補上 → 往下調', 'A = 30, 16, 20, 15, 10, 8');
  await step(tok);                                   // 27:17 insert 向上、delete 向下
  S.off();
  arrow(V3(5.6, 6.4, 0), V3(5.6, 1.9, 0), 0x7a1010);
  tag('delete：向下調整', 'bad', 5.6, 7.0, 0);
  say('insert 往上調；delete 往下調', '都要調整，只是方向不同');
  await step(tok);                                   // 27:37 時間取決於高度
  say('最多從根走到葉子：樹高 log n', '<span class="ok">delete：O(log n)</span>');
}]);

// 27:56 刪掉的值放進空格（12 步）
FRAG.push(['heaphq-delete-store', '刪除的值放進空出來的格子 → 排好序', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide(-6.4, 2.2);
  let S, n50;
  await step(tok);                                   // 27:56 每刪一次都拿到最大
  S = qTree([30, 16, 20, 15, 10, 8], { cap: 7, sizeTag: true });
  n50 = pkt('50', 5.6, 6.6, 0);
  say('剛才刪掉的 50：當時最大的', '從 max heap 每刪一次，就拿到剩下最大的');
  await step(tok);                                   // 28:07 下一個是 30、再來 20
  S.hl([1], GOLD); S.hl([3], BLUE);
  say('再刪會拿到 30，接著是 20……', 'max heap：由大到小一個個出來');
  await step(tok);                                   // 28:46 heap size = 6
  S.off();
  pal.mood('wow');
  say('陣列大小是 7，但 heap 只剩 6 個', 'heap size = 6');
  await step(tok);                                   // 28:52 [7] 空著，不屬於 heap
  const nn = note('[7] 空著，不屬於 heap', S.c(7).x - 0.6, 1.2, S.c(7).z);
  say('[7] 已經不是 heap 的一部分', '空著也沒關係');
  await step(tok);                                   // 29:06 把 50 放進 [7]
  kill(nn);
  await travel(tok, n50, V3(5.6, 6.6, 0), V3(S.c(7).x, 0.9, S.c(7).z), 800);
  kill(n50); S.cell(7, 50); tint(S.cl[7], GRAY);
  pal.mood('happy');
  say('剛刪的 50 就放進空出來的 [7]', '它在 heap 外面，只是借放');
  await step(tok);                                   // 29:32 再刪：30 刪掉、8 補上
  pal.mood('calm');
  await S.popStart(tok, 'park', 700);
  S.hl([1], RED);
  say('從 6 個裡再刪：30 出去，最後的 8 補到根', 'heap size = 5');
  await step(tok);                                   // 29:41 20 上來、8 下去
  S.off(); S.hl([1], GOLD); S.hl([2, 3], BLUE);
  await beat(tok, 400);
  await S.sw(tok, 1, 3, 750);
  say('孩子 16、20：較大的 20 上來，8 下去', '');
  await step(tok);                                   // 29:48 8 在 [3] 沒有孩子
  S.off(); S.hl([3], GOLD);
  note('2·3 = 6 > 5：沒有孩子', S.p(3).x, S.p(3).y - 1.0, 0);
  say('8 在 [3]：2·3 = 6 > heap size 5，沒有孩子', '停（影片說和 10 換，其實不用）');
  await step(tok);                                   // 29:56 30 放進 [6]
  S.off(); S.store(6);
  say('30 放進下一個空位 [6]', 'A = 20, 16, 8, 15, 10 ｜ 30, 50');
  await step(tok);                                   // 30:08 一直刪下去
  for (let r = 0; r < 4; r++) { const n = S.size; await S.popStart(tok, 'keep', 180); await S.down(tok, 1, n - 1, 170); }
  say('一直刪：20、16、15、10 依序放到尾端', '每次都放進剛空出來的格子');
  await step(tok);                                   // 30:28 從左讀就排好
  for (let i = 1; i <= 7; i++) if (S.cl[i]) { tint(S.cl[i], SORTED); glow(S.cl[i], null); }
  pal.mood('wow');
  say('從左邊讀：由小到大排好了', 'A = 8, 10, 15, 16, 20, 30, 50');
  await step(tok);                                   // 30:37 這就是 heap sort 的想法
  pal.mood('happy'); await pal.hop(tok);
  say('這就是 heap sort 的想法', '建 heap，再一直刪、放到尾端');
}]);

// 31:08 heap sort 第一步：逐一 insert（14 步）
FRAG.push(['heaphq-sort-build', 'Heap Sort 第一步：10 20 15 30 40 逐一 insert', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide(-6.4, 2.2);
  const C = code(['① 建 heap：一個一個 insert', '② 全部 delete'], 4.4, 7.2, 0.5);
  let S;
  const add = (k) => { S.node(k, S.a[k], 2); S.setSize(k); S.off(); S.hl([k], GOLD); };
  await step(tok);                                   // 31:08 兩步驟
  C.hl(0);
  say('Heap sort 有兩步', '第一步：把元素一個一個 insert，建成 heap');
  await step(tok);                                   // 31:15 再全部 delete
  C.hl(1);
  say('第二步：把 heap 裡的元素一個一個刪掉', '刪完就排好了');
  await step(tok);                                   // 31:32 要排的陣列
  C.hl(0);
  S = qTree([10, 20, 15, 30, 40], { cap: 5, cellsOnly: true, sizeTag: true });
  say('要排序的陣列：10, 20, 15, 30, 40', '還沒排好');
  await step(tok);                                   // 32:00 第一個自己就是 heap
  add(1);
  say('第一個元素 10：自己就是 heap', '只有一個，算 max 也算 min');
  await step(tok);                                   // 32:14 insert 20
  add(2);
  say('insert 20：放在下一個空位 [2]', 'heap size = 2');
  await step(tok);                                   // 32:37 20 > 10，往上換
  S.hl([1], BLUE); await S.sw(tok, 2, 1, 750); S.off();
  say('和 parent 比：20 > 10，往上換', 'parent = ⌊2/2⌋ = 1');
  await step(tok);                                   // 33:09 insert 15
  add(3);
  say('insert 15：放在 [3]', 'heap size = 3');
  await step(tok);                                   // 33:30 15 < 20 不用動
  S.hl([1], BLUE);
  say('parent = ⌊3/2⌋ = 1：15 < 20', '不用動');
  await step(tok);                                   // 33:41 insert 30
  add(4);
  say('insert 30：放在 [4]', 'heap size = 4');
  await step(tok);                                   // 34:01 30 > 10、30 > 20
  await S.up(tok, 4, 650);
  pal.mood('wow');
  say('30 > 10、再 > 20：一路換到根', '4 → 2 → 1');
  await step(tok);                                   // 34:30 insert 40
  pal.mood('calm');
  add(5);
  say('最後 insert 40：放在 [5]', 'heap size = 5');
  await step(tok);                                   // 34:52 40 > 20、40 > 30
  await S.up(tok, 5, 650);
  say('40 > 20、再 > 30：換到根', '5 → 2 → 1');
  await step(tok);                                   // 35:20 max heap 完成
  S.hl([1], GREEN);
  pal.mood('happy'); await pal.hop(tok);
  say('max heap 建好了', 'A = 40, 30, 15, 10, 20');
  await step(tok);                                   // 35:39 n log n
  S.off();
  say('n 個元素，每個最多爬 log n', '建 heap：<span class="ok">O(n log n)</span>');
}]);

// 36:23 heap sort 第二步：全部 delete（16 步）
FRAG.push(['heaphq-sort-delete', 'Heap Sort 第二步：一直 delete，放到空出的位置', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide(-6.4, 2.2);
  let S;
  const done = () => { for (let i = 1; i <= 5; i++) if (S.cl[i] && i > S.size) tint(S.cl[i], SORTED); };
  await step(tok);                                   // 36:23 從剛建好的 heap
  S = qTree([40, 30, 15, 10, 20], { cap: 5, sizeTag: true });
  say('第二步：從剛建好的 max heap 開始刪', 'A = 40, 30, 15, 10, 20');
  await step(tok);                                   // 36:32 刪 40、20 補到根
  await S.popStart(tok, 'park', 700); S.hl([1], RED);
  say('刪 40：最後的 20 補到根', 'heap size = 4');
  await step(tok);                                   // 36:57 30 較大，換上去
  S.off(); S.hl([1], GOLD); S.hl([2, 3], BLUE); await beat(tok, 400);
  await S.sw(tok, 1, 2, 750);
  say('往下調：孩子 30、15，較大的 30 上來', '');
  await step(tok);                                   // 37:15 和 10 比：不用換
  S.off(); S.hl([2], GOLD); S.hl([4], BLUE);
  say('20 再和孩子 10 比：20 較大', '不用換：又是 max heap');
  await step(tok);                                   // 37:35 40 放到空格
  S.off(); S.store(5); done();
  say('40 放進空出來的最後一格 [5]', 'heap：30, 20, 15, 10');
  await step(tok);                                   // 37:47 刪 30、10 補到根
  await S.popStart(tok, 'park', 700); S.hl([1], RED);
  say('刪 30：最後的 10 補到根', 'heap size = 3');
  await step(tok);                                   // 38:03 20 上來
  S.off(); S.hl([1], GOLD); S.hl([2, 3], BLUE); await beat(tok, 400);
  await S.sw(tok, 1, 2, 750); S.off();
  say('孩子 20、15：20 較大，20 上來', '10 下去');
  await step(tok);                                   // 38:26 30 放進 [4]
  S.store(4); done();
  say('30 放進空出來的 [4]', 'heap：20, 10, 15');
  await step(tok);                                   // 38:46 刪 20、15 補上
  await S.popStart(tok, 'park', 700); S.hl([1], RED);
  say('刪 20：最後的 15 補到根', 'heap size = 2');
  await step(tok);                                   // 39:04 15 已最大
  S.off(); S.hl([1], GOLD); S.hl([2], BLUE);
  say('15 和孩子 10 比：15 較大', '不用換');
  await step(tok);                                   // 39:25 20 放進 [3]
  S.off(); S.store(3); done();
  say('20 放進 [3]', '已經有 40、30、20 在後面');
  await step(tok);                                   // 39:44 刪 15、10 補上
  await S.popStart(tok, 'park', 700);
  say('刪 15：10 補到根', '只剩一個：不用調');
  await step(tok);                                   // 40:04 15 放進 [2]，排好了
  S.store(2); S.setSize(1); tint(S.cl[1], SORTED); done();
  pal.mood('happy'); await pal.hop(tok);
  say('15 放進 [2]：排好了！', 'A = 10, 15, 20, 30, 40');
  await step(tok);                                   // 40:53 建 heap n log n
  bubble('建 heap：n log n', 4.6, 7.0, 0);
  say('分析：建 heap 是 n log n', 'n 次 insert，每次 log n');
  await step(tok);                                   // 41:03 刪除 n log n
  bubble('全部刪除：n log n', 4.6, 6.3, 0);
  say('刪除也是：n 次，每次 log n', 'n log n');
  await step(tok);                                   // 41:12 總共 2n log n
  good('2n log n = O(n log n)', 4.6, 5.6, 0);
  say('加起來 2n log n', 'heap sort：<span class="ok">O(n log n)</span>');
}]);

// 41:43 heapify（16 步）
FRAG.push(['heaphq-heapify', 'Heapify：由右往左掃，往下調整', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide(-6.4, 2.2);
  let S, hint, ar;
  const sc = (i) => S.c(i);
  await step(tok);                                   // 41:43 heapify 也是建 heap
  hint = bubble('Heapify：另一種建 heap 的方法', 0, 7.2, 0);
  say('Heapify：也是建 heap 的方法', '和剛才哪裡不同？');
  await step(tok);                                   // 41:50 剛才：葉子往根
  ar = arrow(V3(5.6, 1.9, 0), V3(5.6, 6.4, 0), 0x0f5a3a);
  const up = tag('剛才：insert 往上調', 'good', 5.6, 7.0, 0);
  say('剛才建 heap：每次插在葉子，往根調整', '方向：向上');
  await step(tok);                                   // 42:34 這個陣列
  kill(hint); kill(ar); kill(up);
  S = qTree([10, 20, 15, 12, 40, 25, 18], { cap: 7 });
  pal.mood('wow');
  say('這個陣列：是 complete，但不是 max heap', 'A = 10, 20, 15, 12, 40, 25, 18');
  await step(tok);                                   // 42:50 剛才是由左往右 insert
  pal.mood('calm');
  ar = arrow(V3(sc(1).x, 1.2, sc(1).z), V3(sc(7).x, 1.2, sc(7).z), 0x5c4a33);
  say('剛才的做法：由左往右，一個一個 insert', '');
  await step(tok);                                   // 43:16 改成由右往左
  kill(ar);
  ar = arrow(V3(sc(7).x, 1.2, sc(7).z), V3(sc(1).x, 1.2, sc(1).z), 0xa8730f);
  say('換個方向：由右往左掃', '');
  await step(tok);                                   // 43:25 往下調（像 delete）
  const dn = tag('每個元素往下調（像 delete）', 'bad', 0, 7.2, 0);
  say('每個元素往「下」調整', '用的是 delete 時的方法');
  await step(tok);                                   // 43:40 18：沒有孩子
  kill(ar); kill(dn);
  S.hl([7], GREEN);
  say('從最後一個 18 開始：往下看，沒有孩子', '自己就是 heap');
  await step(tok);                                   // 43:55 25、40：也是
  S.hl([6, 5], GREEN);
  say('25、40：也沒有孩子', '都是 heap');
  await step(tok);                                   // 44:09 12
  S.hl([4], GREEN);
  say('12：沒有孩子', '葉子都不用動');
  await step(tok);                                   // 44:17 15：25 較大，25 上去
  S.off(); S.hl([3], GOLD); S.hl([6, 7], BLUE); await beat(tok, 400);
  await S.sw(tok, 3, 6, 750); S.off();
  say('15：孩子 25、18，較大的 25 上去，15 下來', '這一小塊 25, 15, 18 是 heap');
  await step(tok);                                   // 44:53 20：40 較大
  S.hl([2], GOLD); S.hl([4, 5], BLUE); await beat(tok, 400);
  await S.sw(tok, 2, 5, 750); S.off();
  say('20：孩子 12、40，較大的 40 上去', '20 下來');
  await step(tok);                                   // 45:18 10：和 40 換
  S.hl([1], GOLD); S.hl([2, 3], BLUE); await beat(tok, 400);
  await S.sw(tok, 1, 2, 750); S.off();
  say('最後是 10：孩子 40、25，40 上去', '10 到了 [2]');
  await step(tok);                                   // 45:29 再和 20 換
  S.hl([2], GOLD); S.hl([4, 5], BLUE); await beat(tok, 400);
  await S.sw(tok, 2, 5, 750); S.off();
  say('10 再看孩子 12、20：20 上去', '10 到了 [5]');
  await step(tok);                                   // 45:44 完成
  S.hl([1], GREEN);
  pal.mood('happy'); await pal.hop(tok);
  say('完成：由右往左、每個往下調', 'A = 40, 20, 25, 12, 10, 15, 18');
  await step(tok);                                   // 46:11 heapify O(n)
  S.off();
  good('heapify：O(n)', 4.6, 7.0, 0);
  say('heapify 的時間：O(n)', '');
  await step(tok);                                   // 46:28 比 n log n 快
  bubble('逐一 insert：O(n log n)', 4.6, 6.3, 0);
  say('逐一 insert 建 heap 要 O(n log n)', 'heapify 比較快');
}]);

// 47:02 priority queue（8 步）
const HQ_PQ = [8, 6, 3, 10, 9];
const pqX = (i) => (i - 2) * 1.9;
FRAG.push(['heaphq-pq-priority', 'Priority Queue：數字本身就是 priority', async (tok) => {
  fresh([0, 6, 12], [0, 0.8, 0]);
  let bs = [], tags = [];
  await step(tok);                                   // 47:02 queue 是 FIFO
  bs = HQ_PQ.map((v, i) => buddy('', v, colorFor(v), pqX(i), 0, 0, 0.9));
  const door = tag('出口 →', 'ptr', 5.6, 0.6, 0);
  say('一般 queue：先來先出（FIFO）', '排隊：排在最前面的先出去');
  await step(tok);                                   // 47:07 priority queue 不是
  kill(door);
  bs.forEach((b) => b.mood('wow'));
  say('priority queue 不照先來後到', '依 priority 插入、刪除');
  await step(tok);                                   // 47:19 刪 priority 最高的
  bs.forEach((b) => b.mood('calm'));
  say('刪除時，一定拿 priority 最高的', '');
  await step(tok);                                   // 47:36 數字本身就是 priority
  tags = HQ_PQ.map((v, i) => tag('priority ' + v, 'idx', pqX(i), 1.6, 0));
  say('這裡：數字本身就是 priority', '8 的 priority 是 8，3 的是 3');
  await step(tok);                                   // 47:47 和 OS 的不同
  const os = note('（和作業系統的 priority queue 不同）', 0, 3.0, 0);
  say('作業系統也有 priority queue，但概念不同', '這裡的用在演算法');
  await step(tok);                                   // 48:09 小的優先
  kill(os); tags.forEach(kill); tags = [];
  const ord = [...HQ_PQ.keys()].sort((a, b) => HQ_PQ[a] - HQ_PQ[b]);
  ord.slice(0, 3).forEach((i, k) => tags.push(tag('#' + (k + 1), 'pkt', pqX(i), 1.9, 0)));
  bs[ord[0]].mood('happy'); await bs[ord[0]].hop(tok);
  say('規則一：數字越小，priority 越高', '先刪 3，再 6，再 8');
  await step(tok);                                   // 48:28 大的優先
  tags.forEach(kill); tags = []; bs[ord[0]].mood('calm');
  ord.slice(2).reverse().forEach((i, k) => tags.push(tag('#' + (k + 1), 'pkt', pqX(i), 1.9, 0)));
  bs[ord[4]].mood('happy'); await bs[ord[4]].hop(tok);
  say('規則二：數字越大，priority 越高', '先刪 10，再 9，再 8');
  await step(tok);                                   // 48:42 兩種都可以
  tags.forEach(kill);
  bubble('小的優先 或 大的優先：先說好', 0, 3.0, 0);
  say('兩種給 priority 的方法', '小的優先、或大的優先');
}]);

// 48:56 用陣列 vs heap（8 步）
FRAG.push(['heaphq-pq-array-vs-heap', 'Priority Queue：用陣列 vs 用 Heap', async (tok) => {
  fresh([0, 6, 12], [0, 0.8, 0]);
  const xs = (i) => (i - 2.5) * 1.7;
  let bs, nx, S;
  await step(tok);                                   // 48:56 陣列 insert 放尾端
  bs = HQ_PQ.map((v, i) => cube(v, colorFor(v), [1.2, 0.9, 1.2], xs(i), 0.45, 0));
  nx = cube(7, colorFor(7), [1.2, 0.9, 1.2], xs(5), 0.45, 0, 4);
  say('用一般陣列：insert 直接放尾端', '<span class="ok">很快</span>');
  await step(tok);                                   // 49:01 要刪 3
  glow(bs[2], RED);
  say('delete（小的優先）：要拿 3', '先找到它');
  await step(tok);                                   // 49:11 後面都要往前移
  fly(bs[2]);
  [bs[3], bs[4], nx].forEach((b, k) => move(b, xs(2 + k), 0.45, 0));
  await beat(tok, 600);
  say('刪掉 3 之後，後面全部往前移', '<span class="no">O(n)</span>');
  await step(tok);                                   // 49:29 保持排序也一樣
  bad('保持排序？insert 就要 O(n)', 0, 2.6, 0);
  say('改成一直保持排序？換 insert 要 O(n)', '總有一個操作是 O(n)');
  await step(tok);                                   // 49:41 用 heap：log n
  fresh([0, 6, 15.5], [0, 3.3, 1]);
  S = qTree([3, 6, 8, 10, 9], { cap: 6, min: true, sizeTag: true });
  say('更好的方法：heap', 'insert、delete 都是 <span class="ok">O(log n)</span>');
  await step(tok);                                   // 49:52 小的優先用 min heap
  tag('Min Heap', 'ptr', 0, 7.2, 0);
  S.hl([1], GREEN);
  say('小的優先 → min heap；大的優先 → max heap', '同一組數字建成 min heap');
  await step(tok);                                   // 50:07 insert／delete 都 log n
  S.off();
  await S.pop(tok, 'fly', 450);
  say('刪 3：只沿一條路往下調', 'insert 也只走一條路：O(log n)');
  await step(tok);                                   // 50:30 heap 最適合
  S.hl([1], GREEN);
  good('heap：實作 priority queue 最好的資料結構', 0, 7.2, 1.2);
  say('陣列總有一個操作 O(n)；heap 兩個都 log n', '最適合實作 priority queue');
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

  // ═══ heapur.js ═══
  {
// ─── 4tSdhWBVv6A：Priority Queue, Binary Heap（Lec 24a，Urdu/Hindi） ───
// 只用 K 與 ctx。陣列 1-based（講者：root 放 index 1，不放 0）。
// 第一棵（非 complete）heap 的形狀依講者唸到的數字 3、7、12、9、15、33、19、32、58、99、88、31、36 重建；
// complete heap 的例子（12、15、17、32、36）同樣依可辨識的數字重建，其他數值為示意。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, line, GOLD, GREEN, RED, GRAY } = K;
const say = ctx.say, beat = ctx.beat, colorFor = ctx.colorFor;
const BLUE = '#1f3a6e';
const UY = [7.0, 5.6, 4.2, 2.8, 1.4];
const UCAM = [0, 5.2, 16], ULOOK = [0, 3.6, 1];
const ulv = (i) => Math.floor(Math.log2(i));
const pLess = (a, b) => (a[0] !== b[0] ? a[0] < b[0] : a[1] < b[1]);
const pShow = (p) => '(' + p[0] + ',' + p[1] + ')';
const PCOL = ['#c94a3a', '#2fc092', '#4b9ee2', '#e0a030', '#8a63c9', '#3fb6b0', '#d0688f'];

function uHeap(vals, o = {}) {
  const W = o.w || 12, min = o.min !== false, arr = !!o.arr, cap = o.cap || vals.length;
  const less = o.less || ((a, b) => a < b);
  const better = (a, b) => (min ? less(a, b) : less(b, a));
  const show = o.show || ((v) => String(v));
  const col = (v) => (o.color ? o.color(v) : colorFor(v));
  const sz = o.sz || 0.8, dx = o.dx || 1.05, cz = 3.4;
  const S = { a: [null], nd: [null], cl: [null], ed: [null], size: 0, better, show, min };
  S.p = (i) => { const d = ulv(i), c = 1 << d; return V3(((i - c + 0.5) / c - 0.5) * W, UY[d], 0); };
  S.c = (i) => V3((i - (cap + 1) / 2) * dx, 0.3, cz);
  if (arr) for (let i = 1; i <= cap; i++) { const c = S.c(i); ctx.tile(V3(c.x, 0.02, c.z), dx * 0.92, 0.9); tag('[' + i + ']', 'idx', c.x, 0.05, c.z + 0.75); }
  S.node = (i, v, drop = 0) => {
    S.a[i] = v; const p = S.p(i);
    if (i > 1 && !S.ed[i]) { const q = S.p(i >> 1); S.ed[i] = line(q.x, q.y, p.x, p.y); }
    S.nd[i] = cube(show(v), col(v), [sz, sz, sz], p.x, p.y, 0, drop);
  };
  S.cell = (i, v, drop = 0) => { if (!arr) return; const c = S.c(i); S.cl[i] = cube(show(v), col(v), [dx * 0.8, 0.42, 0.7], c.x, c.y, c.z, drop ? 2 : 0); };
  S.put = (i, v, drop = 0) => { S.node(i, v, drop); S.cell(i, v, drop); S.size = Math.max(S.size, i); };
  vals.forEach((v, k) => { if (v !== null && v !== undefined) S.put(k + 1, v); });
  S.has = (i) => i < S.a.length && S.a[i] !== null && S.a[i] !== undefined;
  S.hl = (list, c) => list.forEach((i) => { if (S.nd[i]) glow(S.nd[i], c); if (S.cl[i]) glow(S.cl[i], c); });
  S.off = () => { for (let i = 1; i < S.nd.length; i++) { if (S.nd[i]) glow(S.nd[i], null); if (S.cl[i]) glow(S.cl[i], null); } };
  S.sw = async (tok, i, j, ms = 800) => {
    const pi = S.p(i), pj = S.p(j);
    if (S.nd[i]) move(S.nd[i], pj.x, pj.y, 0); if (S.nd[j]) move(S.nd[j], pi.x, pi.y, 0);
    if (S.cl[i] && S.cl[j]) { const ci = S.c(i), cj = S.c(j); move(S.cl[i], cj.x, cj.y, cj.z); move(S.cl[j], ci.x, ci.y, ci.z); }
    [S.nd[i], S.nd[j]] = [S.nd[j], S.nd[i]]; [S.cl[i], S.cl[j]] = [S.cl[j], S.cl[i]]; [S.a[i], S.a[j]] = [S.a[j], S.a[i]];
    await beat(tok, ms);
  };
  // 位置 i 的元素搬到空位 j
  S.mv = (i, j) => {
    const p = S.p(j);
    if (S.nd[i]) move(S.nd[i], p.x, p.y, 0);
    if (S.cl[i]) { const c = S.c(j); move(S.cl[i], c.x, c.y, c.z); }
    S.nd[j] = S.nd[i]; S.cl[j] = S.cl[i]; S.a[j] = S.a[i]; S.nd[i] = null; S.cl[i] = null; S.a[i] = null;
    if (S.ed[i]) { kill(S.ed[i]); S.ed[i] = null; }
    if (j > 1 && !S.ed[j]) { const q = S.p(j >> 1); S.ed[j] = line(q.x, q.y, p.x, p.y); }
  };
  const LT = min ? '<' : '>', GE = min ? '≥' : '≤', BIG = min ? '小' : '大';
  S.up = async (tok, i, ms = 900) => {
    let n = 0;
    while (i > 1) {
      const p = i >> 1; S.off(); S.hl([i], GOLD); S.hl([p], BLUE);
      if (!better(S.a[i], S.a[p])) { say(show(S.a[i]) + ' ' + GE + ' ' + show(S.a[p]) + '：停住', 'parent = ⌊' + i + '/2⌋ = ' + p); await beat(tok, ms); break; }
      say(show(S.a[i]) + ' ' + LT + ' ' + show(S.a[p]) + '：往上換', 'parent = ⌊' + i + '/2⌋ = ' + p);
      await beat(tok, ms * 0.6);
      await S.sw(tok, i, p, ms); i = p; n++;
    }
    S.off(); return n;
  };
  S.down = async (tok, i, ms = 900) => {
    let n = 0;
    while (S.has(2 * i)) {
      const l = 2 * i, r = l + 1, two = S.has(r); let c = l; if (two && better(S.a[r], S.a[l])) c = r;
      S.off(); S.hl([i], GOLD); S.hl(two ? [l, r] : [l], BLUE);
      say('孩子' + (two ? '中較' + BIG + '的' : '') + '是 ' + show(S.a[c]), 'left = 2·' + i + ' = ' + l + (two ? '，right = ' + r : ''));
      await beat(tok, ms);
      if (!better(S.a[c], S.a[i])) { say(show(S.a[i]) + ' 已經比孩子' + BIG + '：停', '停在 [' + i + ']'); await beat(tok, ms); break; }
      say(show(S.a[c]) + ' 往上、' + show(S.a[i]) + ' 往下', 'A[' + i + '] ↔ A[' + c + ']');
      await S.sw(tok, i, c, ms); i = c; n++;
    }
    S.off(); return n;
  };
  // 非 complete 的舊做法：拿走 root，較小的孩子一路補上來（洞留在底部）
  S.promote = async (tok, ms = 900) => {
    S.off(); S.hl([1], RED);
    say('pop：拿走 root ' + show(S.a[1]), 'top 只看、pop 要移除');
    await beat(tok, ms);
    fly(S.nd[1]); S.nd[1] = null; S.a[1] = null;
    let i = 1;
    while (S.has(2 * i) || S.has(2 * i + 1)) {
      const l = 2 * i, r = l + 1; let c;
      if (S.has(l) && S.has(r)) c = better(S.a[r], S.a[l]) ? r : l; else c = S.has(l) ? l : r;
      S.off(); S.hl([l, r].filter(S.has), BLUE); S.hl([c], GOLD);
      say((S.has(l) && S.has(r) ? '兩個孩子較小的 ' : '只剩一個孩子 ') + show(S.a[c]), show(S.a[c]) + ' 往上補空位');
      await beat(tok, ms * 0.8);
      S.mv(c, i); await beat(tok, ms); i = c;
    }
    S.off(); return i;
  };
  // complete heap 的 pop：最後一個搬到 root，再往下沉
  S.cpop = async (tok, ms = 900) => {
    const n = S.size, top = S.a[1];
    S.off(); S.hl([1], RED);
    say('pop：移除 root ' + show(top), 'A[1]');
    await beat(tok, ms);
    fly(S.nd[1]); S.nd[1] = null; if (S.cl[1]) { fly(S.cl[1], V3(0, 6, 5)); S.cl[1] = null; } S.a[1] = null;
    if (n > 1) {
      S.hl([n], GOLD);
      say('最後一個 ' + show(S.a[n]) + ' 搬到 root', 'A[1] ← A[' + n + ']，size = ' + (n - 1));
      await beat(tok, ms * 0.6);
      S.mv(n, 1); if (S.ed[n]) { kill(S.ed[n]); S.ed[n] = null; }
      await beat(tok, ms);
    }
    S.size = n - 1;
    await S.down(tok, 1, ms);
    return top;
  };
  return S;
}

// 第一棵 heap（非 complete）：index → 值
const UR_T1 = [];
[[1, 3], [2, 7], [3, 12], [4, 9], [5, 99], [6, 15], [7, 31], [8, 33], [9, 19], [12, 32], [13, 58], [14, 88], [18, 36]].forEach(([i, v]) => { UR_T1[i - 1] = v; });
const UR_C0 = [12, 17, 32, 36, 33, 52, 58];          // complete heap（push 15 之前）
const UR_C1 = [12, 15, 32, 17, 33, 52, 58, 36];      // push 15 之後
const UR_P0 = [[2, 0], [2, 1], [2, 3], [2, 4], [2, 2], [2, 5], [2, 6]];
const urSet = (S) => S.a.filter((v) => v !== null && v !== undefined);

// 00:47 回顧：明確順序 → 加限制 → search tree
FRAG.push(['heapur-recap', '回顧：array/list → stack/queue → search tree', async (tok) => {
  fresh([0, 4, 14], [0, 2.4, 0]);
  const vals = [10, 20, 30, 40, 50];
  const cs = vals.map((v, k) => cube(v, colorFor(v), [0.9, 0.9, 0.9], -5 + k * 1.1, 0.45, 0, 3));
  tag('array / list', 'ptr', -2.8, 1.6, 0);
  say('array、list：明確的線性順序', 'explicit linear ordering');
  await beat(tok, 2800);
  cs.forEach((c, k) => move(c, -5, 0.45 + k * 0.95, 0));
  tag('top', 'ptr alt', -3.6, 4.4, 0);
  say('stack：只能從 top push／pop', '加上限制，實作還是 array/list');
  await beat(tok, 3000);
  const bst = [[30, 2.5, 5.0], [20, 1.2, 3.4], [40, 3.8, 3.4], [10, 0.4, 1.8], [50, 4.6, 1.8]];
  const ns = [];
  bst.forEach(([v, x, y], k) => { ns.push(cube(v, colorFor(v), [0.8, 0.8, 0.8], x, y, 0, 2)); });
  line(2.5, 5.0, 1.2, 3.4); line(2.5, 5.0, 3.8, 3.4); line(1.2, 3.4, 0.4, 1.8); line(3.8, 3.4, 4.6, 1.8);
  say('tree：順序是隱含的（看走訪）', 'implicit ordering');
  await beat(tok, 2800);
  [0, 1, 3].forEach((k) => glow(ns[k], GOLD));
  say('search tree：操作 O(log n)', 'find-min 要往左走到底');
  await beat(tok, 3000);
  [0, 1, 3].forEach((k) => glow(ns[k], null)); glow(ns[3], GREEN);
  say('想要：拿最高 priority 只要 O(1)', '→ priority queue');
  await beat(tok, 3000);
}]);

// 03:20 priority queue：不是先來先服務
FRAG.push(['heapur-pq-line', 'Priority Queue：數字越小越優先', async (tok) => {
  fresh([0, 3.5, 12], [0, 1.2, 0]);
  const q = [];
  const pr = [2, 3, 1, 3];
  for (let k = 0; k < pr.length; k++) { q.push({ p: pr[k], m: cube('P' + pr[k], colorFor(pr[k]), [0.9, 0.9, 0.9], -3 + k * 1.2, 0.45, 0, 3) }); await beat(tok, 450); }
  tag('front', 'ptr', -3, 1.6, 0);
  say('一般 queue：先來先服務', 'FIFO');
  await beat(tok, 2600);
  say('慣例：0 最高，數字越大越低', 'higher number → lower priority');
  await beat(tok, 2800);
  const amb = cube('P0', RED, [0.9, 0.9, 0.9], 4.5, 0.45, 0, 3);
  say('救護車 P0 來了', 'push(P0)');
  await beat(tok, 2000);
  q.sort((a, b) => a.p - b.p);
  q.unshift({ p: 0, m: amb });
  q.forEach((e, k) => move(e.m, -3 + k * 1.2, 0.45, 0));
  say('照 priority 插入，不是排到最後', '依 priority 排：P0 P1 P2 P3 P3');
  await beat(tok, 3000);
  glow(amb, GOLD);
  say('top／pop：priority 最高的先出', 'pop → P0');
  await beat(tok, 1600);
  fly(amb); q.shift();
  q.forEach((e, k) => move(e.m, -3 + k * 1.2, 0.45, 0));
  await beat(tok, 1600);
  say('下一個是 P1', 'top = P1');
  glow(q[0].m, GOLD);
  await beat(tok, 2600);
}]);

// 06:39 ordered pair：先比第一個，相同再比第二個
FRAG.push(['heapur-pairs', '多層 priority：(5,19) (13,1) (13,24) (15,0)', async (tok) => {
  fresh([0, 3.5, 12], [0, 1.2, 0]);
  const P = [[5, 19], [13, 1], [13, 24], [15, 0]];
  const ms = P.map((p, k) => cube(pShow(p), PCOL[k], [1.6, 0.9, 0.9], -4.2 + k * 2.8, 0.45, 0, 3));
  say('每個元素是一對數字', '(第一層, 第二層)');
  await beat(tok, 2600);
  const cmp = async (i, j, cap, f) => { ms.forEach((m) => glow(m, null)); glow(ms[i], GOLD); glow(ms[j], BLUE); say(cap, f); await beat(tok, 3000); };
  await cmp(0, 1, '先比第一個：5 < 13', '(5,19) 優先，19 不用看');
  await cmp(1, 2, '第一個相同：13 = 13', '再比第二個：1 < 24');
  await cmp(2, 3, '13 < 15 就決定了', '(13,24) 比 (15,0) 優先');
  ms.forEach((m) => glow(m, null));
  ms.forEach((m, k) => { tag('#' + (k + 1), 'idx', -4.2 + k * 2.8, 1.3, 0); });
  say('小的數字＝高 priority', '可以一直加更多層');
  await beat(tok, 3000);
}]);

// 08:38 OS：系統工作 vs 使用者工作，單核 time slicing
FRAG.push(['heapur-cpu-sched', '單核 CPU：高 priority 的工作先做', async (tok) => {
  fresh([0, 4, 13], [0, 1.6, 0]);
  const cpu = cube('CPU', '#6e5f49', [1.8, 1.4, 1.4], 4, 0.7, 0);
  tag('single core', 'idx', 4, 1.8, 0);
  const mouse = cube('mouse', '#4b9ee2', [1.5, 0.8, 0.9], -2, 0.4, 0, 3);
  tag('P2', 'idx', -2, 1.1, 0);
  say('滑鼠點擊：使用者工作', 'priority 2');
  await beat(tok, 2400);
  const clock = cube('clock', RED, [1.5, 0.8, 0.9], -4.5, 0.4, 0, 3);
  tag('P0', 'idx', -4.5, 1.1, 0);
  say('系統時鐘要更新：priority 較高', 'priority 0');
  await beat(tok, 2600);
  glow(clock, GOLD);
  move(clock, 4, 1.9, 0);
  say('CPU 先處理 clock', '你的工作被往後推');
  await beat(tok, 2800);
  fly(clock); glow(clock, null);
  move(mouse, 4, 1.9, 0);
  say('一次只能做一件：time slicing', '切得很快，看起來像同時');
  await beat(tok, 2800);
  glow(cpu, GREEN);
  say('誰先做 → priority queue', 'scheduling');
  await beat(tok, 2600);
}]);

// 11:04 多個 queue：每個 priority 一條
FRAG.push(['heapur-mqueues', 'M 個 priority → M 條 queue', async (tok) => {
  fresh([0, 4.5, 13], [0, 2, 0]);
  const names = ['< 10', '10–20', '20–30', '> 30'];
  const ys = [4.2, 3.0, 1.8, 0.6];
  const qs = [[], [], [], []];
  names.forEach((nm, k) => { cube('[' + k + ']', GRAY, [0.8, 0.8, 0.8], -5, ys[k], 0); tag(nm, 'idx', -6.2, ys[k], 0); });
  say('array of pointers：一個 priority 一條 queue', 'M = 4');
  await beat(tok, 2800);
  const push = async (k, v, cap) => { const x = -3.5 + qs[k].length * 1.1; const m = cube(v, colorFor(qs[k].length + k), [0.8, 0.8, 0.8], x, ys[k], 0, 3); qs[k].push(m); say(cap, 'push 到第 ' + k + ' 條的尾端：Θ(1)'); await beat(tok, 1500); };
  await push(1, 'A', '10–20 歲的人依序來');
  await push(1, 'B', '10–20 歲的人依序來');
  await push(1, 'C', '10–20 歲的人依序來');
  await push(2, 'D', '20–30 歲的進第 2 條');
  await push(0, 'E', '後來一個 10 歲以下的');
  say('pop：從最高的 queue 開始找', '第 0 條非空 → 先出 E');
  glow(qs[0][0], GOLD);
  await beat(tok, 2600);
  fly(qs[0].shift());
  await beat(tok, 1200);
  say('第 0 條空了 → 換下一條', '最差要看 M 條：O(M)');
  glow(qs[1][0], GOLD);
  await beat(tok, 2600);
  fly(qs[1].shift()); qs[1].forEach((m, i) => move(m, -3.5 + i * 1.1, ys[1], 0));
  await beat(tok, 1200);
  say('記憶體 Θ(M + n)', 'priority 的範圍要事先固定');
  await beat(tok, 3000);
}]);

// 14:37 binary min-heap 的定義
FRAG.push(['heapur-minheap-def', 'Binary min-heap：root 比左右子樹都小', async (tok) => {
  fresh(UCAM, ULOOK);
  const S = uHeap([], { sz: 0.7 });
  for (let d = 0; d < 5; d++) { UR_T1.forEach((v, k) => { if (v !== undefined && ulv(k + 1) === d) S.put(k + 1, v, 2); }); await beat(tok, 500); }
  say('min-heap：root ≤ 左右子樹的每個 key', '左右子樹本身也是 min-heap');
  await beat(tok, 3000);
  const chk = [[1, [2, 3]], [2, [4, 5]], [3, [6, 7]], [4, [8, 9]], [6, [12, 13]]];
  for (const [p, cs] of chk) {
    S.off(); S.hl([p], GOLD); S.hl(cs, GREEN);
    say(S.a[p] + ' 比 ' + cs.map((c) => S.a[c]).join('、') + ' 都小', 'parent < children');
    await beat(tok, 1500);
  }
  S.off(); S.hl([8, 9, 12, 13], BLUE);
  say('同一層 33、19、32、58：沒有關係', '只有跨層（上下）才有大小');
  await beat(tok, 3200);
  S.off(); S.hl([4, 5], BLUE);
  say('左右也沒有順序：9 在左、99 在右', '不是 search tree');
  await beat(tok, 2800);
  S.off(); S.hl([1], GREEN);
  say('最小的 3 永遠在 root', '最高 priority 在最上面');
  await beat(tok, 3000);
}]);

// 24:55 top 與 pop（舊做法：孩子一路補上來）
FRAG.push(['heapur-pop-hole', 'top O(1)；pop：較小的孩子一層層補上', async (tok) => {
  fresh(UCAM, ULOOK);
  const S = uHeap(UR_T1, { sz: 0.7 });
  S.hl([1], GOLD);
  say('top：root 就是最小，直接看', 'O(1)，跟 size 無關');
  await beat(tok, 3000);
  await S.promote(tok, 1100);
  S.off();
  say('一層一層：誰小誰上去', '路徑 7 → 9 → 19 → 36');
  await beat(tok, 2600);
  say('空出來的位置在最底下', '樹的形狀不受控制');
  await beat(tok, 2800);
}]);

// 29:28 push 17：放在葉子，往上浮
FRAG.push(['heapur-push-17', 'push 17：放在葉子，往上浮', async (tok) => {
  fresh(UCAM, ULOOK);
  const S = uHeap(UR_T1, { sz: 0.7 });
  say('push：先放在一個葉子', '這裡放在 88 底下');
  await beat(tok, 2400);
  S.put(28, 17, 3); S.hl([28], GOLD);
  await beat(tok, 1600);
  await S.up(tok, 28, 1100);
  S.hl([7], GREEN);
  say('17 ≥ 12：停在 12 底下', '經過 88、31，停在 12');
  await beat(tok, 2800);
  S.off();
  say('percolate up：輕的往上浮', '重的往下沉');
  await beat(tok, 2600);
}]);

// 31:03 一直 pop 會讓樹變歪 → 改用 complete tree
FRAG.push(['heapur-why-complete', '樹會變歪 → 改用 complete tree', async (tok) => {
  fresh(UCAM, ULOOK);
  let S = uHeap(UR_T1, { sz: 0.7 });
  say('連續 pop：洞都留在底部', '高度不再是 log n');
  await beat(tok, 2000);
  await S.promote(tok, 500);
  await S.promote(tok, 500);
  S.off();
  say('一邊滿、一邊空：不平衡', 'balance 被破壞');
  await beat(tok, 3000);
  fresh(UCAM, ULOOK);
  S = uHeap([], { sz: 0.7 });
  for (let i = 1; i <= 10; i++) { S.put(i, i, 2); await beat(tok, 350); }
  say('complete tree：上到下、左到右填', '第 n 個一定在位置 n');
  await beat(tok, 3000);
  S.hl([11], GOLD);
  const p = S.p(11); const g = tag('下一個', 'ptr alt', p.x, p.y, 0);
  say('下一個位置唯一確定', '高度 = ⌊log₂ n⌋');
  await beat(tok, 3000);
  kill(g);
}]);

// 33:32 complete heap 的 push：最後一格 → 往上
FRAG.push(['heapur-cpush-15', 'complete heap 的 push 15', async (tok) => {
  fresh(UCAM, ULOOK);
  const S = uHeap(UR_C0, { arr: true, cap: 8 });
  say('complete min-heap，存在陣列裡', 'size = 7');
  await beat(tok, 2600);
  say('push 15：只能放下一格', '位置 size + 1 = 8');
  await beat(tok, 2000);
  S.put(8, 15, 3); S.hl([8], GOLD);
  await beat(tok, 1600);
  await S.up(tok, 8, 1100);
  S.hl([2], GREEN);
  say('15 停在 [2]，17 被換下來', '仍是 complete，沒有洞');
  await beat(tok, 3000);
}]);

// 34:36 complete heap 的 pop：最後一個上 root，往下沉（params.a 換例子）
FRAG.push(['heapur-cpop', 'complete heap 的 pop：最後一個搬到 root', async (tok) => {
  const a = (ctx.params || {}).a || UR_C1;
  fresh(UCAM, ULOOK);
  const S = uHeap(a, { arr: true, cap: Math.max(8, a.length) });
  say('不能讓孩子直接補：會留洞', '要保持 complete');
  await beat(tok, 2800);
  await S.cpop(tok, 1100);
  say('最小 ' + S.a[1] + ' 回到 root，沒有洞', '陣列：' + urSet(S).join(', '));
  await beat(tok, 3200);
}]);

// 39:23 同層沒有順序；跟 search tree 比 find-min
FRAG.push(['heapur-floors-cost', '每層像樓層；find-min：heap O(1) vs BST O(log n)', async (tok) => {
  fresh(UCAM, ULOOK);
  const S = uHeap([15, 17, 32, 36, 33, 52, 58], { w: 9 });
  ['頂樓（最小）', '第 2 層', '第 3 層'].forEach((t, d) => tag(t, 'idx', -6, UY[d], 0));
  S.hl([4, 5, 6, 7], BLUE);
  say('同一層：36 在 33 左邊也可以', '層內沒有大小順序');
  await beat(tok, 3200);
  S.off(); S.hl([1], GOLD); S.hl([2, 3], GREEN);
  say('只保證：上層 ≤ 下層', '常見錯誤：以為同層有順序');
  await beat(tok, 3000);
  fresh(UCAM, ULOOK);
  const B = uHeap([33, 17, 52, 15, 32, 36, 58], { w: 9 });
  tag('BST / AVL', 'ptr', -5.5, 7.2, 0);
  say('同樣 7 個數放進 BST/AVL', 'min 在最左邊');
  await beat(tok, 2400);
  for (const i of [1, 2, 4]) { B.off(); B.hl([i], GOLD); say('往左走：' + B.a[i], 'find-min = O(log n)'); await beat(tok, 1200); }
  B.off(); B.hl([4], GREEN);
  say('heap：min 就在 root', 'top = O(1)');
  await beat(tok, 3000);
}]);

// 46:13 陣列表示：root 在 1，left 2i，right 2i+1
FRAG.push(['heapur-array-index', '陣列存 heap：left 2i、right 2i+1、parent ⌊i/2⌋', async (tok) => {
  fresh(UCAM, ULOOK);
  const S = uHeap(UR_C0, { arr: true, cap: 7 });
  S.hl([1], GOLD);
  say('complete 才能直接放陣列', 'root 放 [1]，不用 [0]');
  await beat(tok, 3000);
  S.off(); S.hl([1], GOLD); S.hl([2], GREEN);
  say('left child 在 2i', 'i = 1 → [2] = 17');
  await beat(tok, 2600);
  S.off(); S.hl([1], GOLD); S.hl([3], GREEN);
  say('right child 在 2i + 1', 'i = 1 → [3] = 32');
  await beat(tok, 2600);
  S.off(); S.hl([3], GOLD); S.hl([6, 7], GREEN);
  say('i = 3 的孩子：[6]、[7]', '52、58');
  await beat(tok, 2600);
  S.off(); S.hl([7], GOLD); S.hl([3], BLUE);
  say('parent：i 是奇數也一樣', '⌊7/2⌋ = 3（整數除法）');
  await beat(tok, 2800);
  S.off(); S.hl([6], GOLD); S.hl([3], BLUE);
  say('i 是偶數', '6/2 = 3');
  await beat(tok, 2400);
  S.off();
  say('空格不能用 0 當記號', '0 自己也可能是一個值');
  await beat(tok, 3000);
}]);

// 52:33 成本曲線：理想常數、log n、線性
FRAG.push(['heapur-cost-curves', '成本：常數 vs log n vs 線性', async (tok) => {
  fresh([0, 3.5, 13], [0, 2.8, 0]);
  line(-5.5, 0.3, 5.5, 0.3, 0, '#6e5f49'); line(-5.5, 0.3, -5.5, 6.2, 0, '#6e5f49');
  tag('n', 'idx', 5.8, 0.3, 0); tag('cost', 'idx', -5.5, 6.6, 0);
  const X = (t) => -5.5 + t * 11, N = 40;
  const draw = async (f, color, lbl, cap, form) => {
    let px = X(0), py = f(0);
    for (let k = 1; k <= N; k++) { const t = k / N, y = f(t); line(px, py, X(t), y, 0, color); px = X(t); py = y; if (k % 8 === 0) await beat(tok, 120); }
    tag(lbl, 'ptr', 5.4, py + 0.3, 0); say(cap, form); await beat(tok, 2600);
  };
  await draw(() => 0.8, '#b8b0a0', 'Θ(1)', '理想：常數時間（top）', 'Θ(1)');
  await draw((t) => 0.8 + Math.log2(1 + t * 63) * 0.55, '#4b9ee2', 'Θ(log n)', 'push／pop：Θ(log n)', '最多走一個高度');
  await draw((t) => 0.8 + t * 5.2, RED, 'Θ(n)', '線性：例如沒排序的 list', 'Θ(n)');
  say('heap：top 常數，push/pop log n', 'log n 幾乎跟常數一樣平');
  await beat(tok, 3000);
}]);

// 52:51 max-heap：條件反過來
FRAG.push(['heapur-maxheap', 'Max-heap：最大的在最上面', async (tok) => {
  fresh(UCAM, ULOOK);
  const S = uHeap([58, 36, 52, 17, 33, 32, 15], { min: false });
  say('max-heap：parent ≥ children', '把 < 改成 >');
  await beat(tok, 2800);
  for (const [p, cs] of [[1, [2, 3]], [2, [4, 5]], [3, [6, 7]]]) {
    S.off(); S.hl([p], GOLD); S.hl(cs, GREEN);
    say(S.a[p] + ' ≥ ' + cs.map((c) => S.a[c]).join('、'), 'parent ≥ children');
    await beat(tok, 1600);
  }
  S.off();
  await S.cpop(tok, 1000);
  say('演算法完全一樣，只是比較反過來', 'root = 最大');
  await beat(tok, 3000);
}]);

// 54:03 第二層 priority：(2,0)…(2,6) 一個一個 pop（params.pre = 先 pop 幾個，params.n = 演幾個）
FRAG.push(['heapur-pairs-heap', '(2,x) 的 min-heap：一個個 pop', async (tok) => {
  const prm = ctx.params || {}, pre = prm.pre || 0, cnt = prm.n || 2;
  const h = UR_P0.map((p) => p.slice());
  const popPlain = () => { const last = h.pop(); if (!h.length) return; h[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let c = l; if (l >= h.length) break; if (r < h.length && pLess(h[r], h[l])) c = r; if (!pLess(h[c], h[i])) break; [h[c], h[i]] = [h[i], h[c]]; i = c; } };
  for (let k = 0; k < pre; k++) popPlain();
  fresh(UCAM, ULOOK);
  const S = uHeap(h, { arr: true, cap: 7, less: pLess, show: pShow, color: (p) => PCOL[p[1] % 7], sz: 1.0, dx: 1.3 });
  say(pre ? '已經 pop 掉 ' + pre + ' 個' : '第一層都是 2：比第二層', 'root = ' + pShow(h[0]) + ' 最優先');
  await beat(tok, 2800);
  for (let k = 0; k < cnt && S.size > 0; k++) await S.cpop(tok, 1000);
  say('每一步的選擇都是唯一的', 'root = ' + pShow(S.a[1]));
  await beat(tok, 3000);
}]);

// 63:05 push 平均 O(1)、最差 O(log n)；pop 幾乎都沉到底
FRAG.push(['heapur-push-worst', 'push 最好 O(1)、最差 O(log n)', async (tok) => {
  fresh(UCAM, ULOOK);
  const S = uHeap([12, 15, 32, 17, 33, 52, 58], { arr: true, cap: 9 });
  say('push 60：比 parent 大', '比一次就停：O(1)');
  S.put(8, 60, 3);
  await beat(tok, 1600);
  await S.up(tok, 8, 900);
  say('大部分新元素都偏大', '平均 push ≈ O(1)');
  await beat(tok, 2600);
  say('push 5：比誰都小', '一路浮到 root');
  S.put(9, 5, 3);
  await beat(tok, 1600);
  const n = await S.up(tok, 9, 900);
  S.hl([1], GOLD);
  say('換了 ' + n + ' 次 = 高度', '最差 O(log n)');
  await beat(tok, 3000);
  S.off();
  say('pop：最後一個通常很大', '幾乎沉到底：Θ(log n)');
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
