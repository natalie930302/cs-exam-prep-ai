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
    const opts = [...p.opts].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
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
// ─── RjvhXL0WTrY：台大林軒田 DSA「Tree traversal / Heap」— cued：每個 step(tok) 等老師說到那一句（// @秒數 = cue） ───
// 例子取自影片：expression tree 3 × (5 + 7)（infix / postfix / prefix print）；node = key + data（priority + to-do）；
// 只把最大放 root 的樹 14（6、8、12、5、9）；binary max tree 14 /(9: 4) /(12: 8, 5)，remove 14、remove 12；
// 歪斜的 max tree 50 49 46 44 21 17 5 3；complete binary max tree 14 12 9 4 8 5（5 換成 8.5）；
// remove largest = 最後一個（8.5）上 root 再往下換；insert 17 = 放最後再往上浮；陣列 14 12 9 4 8 8.5。
// 陣列 1-based：left = 2i、right = 2i + 1、parent = ⌊i/2⌋。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, showL, code, line, arrow, ghostBox, lnode, anim, travel, remove, step, buddy, prop, bob, GOLD, GREEN, RED, GRAY } = K;
const say = ctx.say, beat = ctx.beat;
const BLUE = '#1f3a6e', OPC = '#c9a25a', NODEC = '#4b9ee2';
const col = (v) => (typeof v === 'number' ? ctx.colorFor(Math.round(v * 2)) : OPC);
const CAM = [0, 4.6, 13.5], LOOK = [0, 3, 0.5];
const sayT = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
// 小角色走到某一點
const go = (tok, b, to, ms = 700) => { const a = b.g.position.clone(); return anim(tok, ms, (u) => b.g.position.lerpVectors(a, to, u)); };
const bye = (b) => { if (b.g.parent) b.g.parent.remove(b.g); if (b.name) remove(b.name); remove(b.val); };
const hideAll = (cd) => cd.ls.forEach((l) => showL(l, false));
const reveal = (cd, ...ks) => ks.forEach((k) => showL(cd.ls[k], true));

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
  S.at = (i, t, cls = 'note', dy = 0.8) => { const p = S.p(i); return tag(t, cls, p.x, p.y + dy, 0.3); };
  (o.init || []).forEach(([i, v]) => S.put(i, v));
  return S;
}
// 一排陣列格（1-based）
function ROW(vals, o = {}) {
  const dx = o.dx || 1.3, z = o.z === undefined ? 3 : o.z, X0 = o.x0 || 0, n = o.n || vals.length;
  const R = { m: [null], v: [null] };
  R.X = (i) => X0 + (i - (n + 1) / 2) * dx;
  for (let i = 1; i <= n; i++) { ctx.tile(V3(R.X(i), 0.02, z), dx * 0.9, 0.9); tag('[' + i + ']', 'idx', R.X(i), 0.05, z + 0.75); }
  R.set = (i, v, drop = 0) => { R.v[i] = v; R.m[i] = cube(v, col(v), [dx * 0.68, 0.45, 0.7], R.X(i), 0.3, z, drop); };
  vals.forEach((v, k) => { if (v !== null && v !== undefined) R.set(k + 1, v); });
  R.sw = (i, j) => { move(R.m[i], R.X(j), 0.3, z); move(R.m[j], R.X(i), 0.3, z); [R.m[i], R.m[j]] = [R.m[j], R.m[i]]; [R.v[i], R.v[j]] = [R.v[j], R.v[i]]; };
  R.hl = (list, c) => list.forEach((i) => R.m[i] && glow(R.m[i], c));
  R.off = () => R.m.forEach((m) => m && glow(m, null));
  return R;
}
function cursorAt(c, S, i) { const p = S.p(i); c.position.set(p.x, p.y + 0.75, 0); }
const EXPR = [[1, '×'], [2, 3], [3, '+'], [6, 5], [7, 7]];
const MAXT = [[1, 14], [2, 9], [4, 4], [3, 12], [6, 8], [7, 5]];
const CMAX = [[1, 14], [2, 12], [3, 9], [4, 4], [5, 8], [6, 8.5]];
const ELY = [5.6, 4.0, 2.4];

// 跟著遞迴一步一步印：steps = [node, 印出的字, code 行]
async function trace(tok, S, cd, steps, outTag, sep, name, ms = 200) {
  const cu = tag('▼', 'ptr alt', 0, -5, 0);
  let out = '';
  for (const [i, piece, ln] of steps) {
    S.off(); S.hl([i], GOLD); cursorAt(cu, S, i); if (cd) cd.hl(ln);
    out += (out && sep ? sep : '') + piece; txt(outTag, out);
    await beat(tok, ms);
  }
  S.off(); if (cd) cd.hl(-1); kill(cu);
  return out;
}

// 10:26 複習 tree，expression tree 3 × (5 + 7)
FRAG.push(['heaplin-expr-tree', 'Expression Tree：3 × (5 + 7)', async (tok) => {
  fresh(CAM, LOOK);
  await step(tok);                                   // @625.8 tree：root ＋ 一堆 subtree
  const G = HT({ ly: ELY, color: () => NODEC });
  G.put(1, 'root', 2);
  const s1 = ghostBox('#7a6a50', 3.2, 2.2, 1.2); s1.position.set(-2.5, 3.4, 0);
  const s2 = ghostBox('#7a6a50', 3.2, 2.2, 1.2); s2.position.set(2.5, 3.4, 0);
  line(0, 5.6, -2.5, 4.5); line(0, 5.6, 2.5, 4.5);
  const l1 = tag('subtree', 'idx', -2.5, 3.4, 0.7), l2 = tag('subtree', 'idx', 2.5, 3.4, 0.7);
  say('tree：有階層的結構', 'root ＋ 一堆 subtree');
  await step(tok);                                   // @643.8 recursive 定義
  txt(l1, 'subtree = 又一棵 tree'); txt(l2, 'subtree = 又一棵 tree');
  say('subtree 自己也是 tree', 'recursive 地定義下去');
  await step(tok);                                   // @651.8 binary tree：最多兩個孩子，左右有序
  tag('左', 'pkt', -1.5, 5.2, 0.3); tag('右', 'pkt', 1.5, 5.2, 0.3);
  say('binary tree：每個 node 最多兩個孩子', '左、右是不一樣的（有序）');
  await step(tok);                                   // @683.8 上次：高度與 node 數、complete / full
  note('上次：高度 vs node 數、complete / full binary tree', 0, 1.0, 1.0);
  say('上次講過高度跟 node 數的關係', '還有 complete、full binary tree');
  await step(tok);                                   // @733.8 expression tree
  fresh(CAM, LOOK);
  sayT('Expression Tree：用 tree 表示算式', 0, 6.9, 0);
  say('跟作業三有關：expression tree', '這裡只考慮 binary operator');
  const S = HT({ ly: ELY });
  await step(tok);                                   // @774.8 root、internal node 放 operator
  S.put(1, '×', 3);
  say('root、internal node 放 operator', '運算符號');
  await step(tok);                                   // @785.8 3 × (5 + 7)
  for (const [i, v] of EXPR.slice(1)) { S.put(i, v, 3); await beat(tok, 300); }
  say('式子：3 × (5 + 7)', 'leaf 放數字');
  await step(tok);                                   // @798.8 5 先加 7，再跟 3 相乘
  S.hl([3, 6, 7], GOLD); await beat(tok, 900);
  S.hl([1], BLUE);
  say('要表示的是：5 先加 7', '加完再跟 3 相乘');
  await step(tok);                                   // @824.8 每個 subtree 也是一個 expression
  S.off();
  note('3', S.p(2).x, S.p(2).y - 0.9, 0.4); note('5 + 7', S.p(3).x, S.p(3).y - 2.4, 0.4);
  say('每個 subtree 也是一個 expression', 'tree 的自我相似');
  await step(tok);                                   // @837.8 算出 5 + 7 的結果、3 的結果
  S.hl([3], GOLD); S.at(3, '= 12', 'pkt');
  S.hl([2], GOLD); S.at(2, '= 3', 'pkt');
  say('先把兩個 subtree 算出來', '5 + 7 = 12，左邊就是 3');
  await step(tok);                                   // @847.8 左右都算完，才做上面的 operation
  S.off(); S.hl([1], GREEN); S.at(1, '3 × 12 = 36', 'pkt');
  say('左右都算完，再做上面的 ×', '= 36');
  await step(tok);                                   // @858.8 binary operator → binary tree
  say('operator 都是 binary', '所以對應到一棵 binary tree');
  await step(tok);                                   // @883.8 infix
  tag('infix：3 × (5 + 7)', 'ptr', -3.8, 1.0, 1);
  say('第一種寫法：infix', '我們平常習慣的寫法');
  await step(tok);                                   // @909.8 postfix
  tag('postfix：3 5 7 + ×', 'ptr alt', 3.8, 1.0, 1);
  say('第二種：postfix（作業三正在做的）', '先看到數字，再決定做什麼');
  await step(tok);                                   // @929.8 先看到 5 和 7 → 加；再 3 和 12 → 乘
  const toks = ['3', '5', '7', '+', '×'].map((t, k) => tag(t, 'pkt', -2.0 + k * 1.0, 0.2, 2.2));
  toks.forEach((t) => showL(t, false));
  for (let k = 0; k < 5; k++) { showL(toks[k], true); if (k === 3) S.hl([3], GOLD); if (k === 4) S.hl([1], GOLD); await beat(tok, 380); }
  say('看到 5、7 → 決定做加法 = 12', '手上有 3 和 12 → 再做乘法');
  await step(tok);                                   // @956.8 operator 放最後面
  S.off(); toks[4].element.className = 'lab-label bad';
  say('postfix：把要做的事放最後面', 'operator 在後');
  await step(tok);                                   // @986.8 一個給人看、一個給電腦
  const me = buddy('人', '', '#9fd39a', -5.6, 0, 1.6, 0.6); me.mood('happy');
  const c = prop('cpu', 5.8, 0, 1.6, 0.8); bob(c, 0.04);
  say('infix 對人類比較熟悉', 'postfix 對電腦運算比較方便');
}]);

// 16:57 印出一棵樹 = 拜訪每個 node
FRAG.push(['heaplin-visit-all', '印出一棵樹：要拜訪每個 node', async (tok) => {
  fresh(CAM, LOOK);
  let S = null;
  await step(tok);                                   // @1016.8 給你一棵 expression tree
  S = HT({ ly: ELY, init: EXPR });
  sayT('給你一棵 expression tree T', 0, 6.9, 0);
  say('如果我已經給你一棵 expression tree', '3 × (5 + 7)');
  let out = null;
  await step(tok);                                   // @1047.8 把它印出來
  out = tag('輸出：？', 'ptr', 0, 0.8, 1.5);
  say('把這棵 tree 輸出、印出來', '要怎麼做？');
  await step(tok);                                   // @1060.8 印 infix 還是 postfix？
  txt(out, '輸出：infix？還是 postfix？');
  say('expression 有兩種寫法', '先試 infix');
  await step(tok);                                   // @1083.8 為什麼要學？作業早就有 infix
  note('作業裡早就有 infix 了，印它幹嘛？', -3.6, 1.6, 1.5);
  say('乍看之下：印出來好像沒什麼用', '作業是從 infix 建樹，不是反過來');
  await step(tok);                                   // @1122.8 別的演算法建好一棵樹，要把內容表現出來
  sayT('別的演算法建好一棵樹 → 你要告訴別人它長怎樣', 0, 7.6, 0);
  say('未來別的演算法已經建好一棵樹', '怎麼把它的內容表現出來很重要');
  await step(tok);                                   // @1144.8 拜訪每一個 node
  const v = buddy('', '', '#f4c27a', -6, 0, 0.6, 0.45);
  let k = 0;
  for (const i of [1, 2, 3, 6, 7]) { const p = S.p(i); await go(tok, v, V3(p.x, p.y + 0.43, 0.2), 420); S.hl([i], GOLD); k++; }
  v.mood('happy');
  say('要拜訪過每一個 node', '已拜訪 ' + k + ' 個');
  await step(tok);                                   // @1156.8 而且要照特別的順序
  S.off();
  [1, 2, 3, 6, 7].forEach((i, n) => S.at(i, '#' + (n + 1), 'idx', 0.75));
  say('而且要照某個特別的順序拜訪', '才能正確印出來');
  const uses = ['兩棵樹長得一不一樣？', '哪棵 node 比較多？', '樹裡最大的數字？', 'container 的 iterator'];
  const us = (j) => tag(uses[j], 'say', -5.0, 2.0 - j * 0.6, 1.6);
  await step(tok);                                   // @1171.8 比兩棵樹一不一樣
  us(0);
  say('很多演算法都要拜訪每個 node', '例如：兩棵樹一不一樣？');
  await step(tok);                                   // @1188.8 哪棵 node 比較多
  us(1);
  say('哪一棵的 node 比較多？', '也要走過每個 node 才能數');
  await step(tok);                                   // @1196.8 最大的數字
  us(2); S.hl([7], GREEN);
  say('樹裡最大的數字是哪個？', '這裡是 7');
  await step(tok);                                   // @1213.8 像 sequential search
  await go(tok, v, V3(-6, 0, 0.6), 600);
  say('就像 sequential search', '要把每個東西都看過');
  await step(tok);                                   // @1235.8 iterator 要決定拜訪順序
  us(3); S.off();
  say('把 tree 當 container：要一個 iterator', 'iterator 要決定拜訪的順序');
  await step(tok);                                   // @1267.8 怎麼拜訪 = traversal；先用 infix / postfix 切入
  txt(out, '怎麼拜訪每個 node = traversal');
  say('拜訪每個 node 的方式 = traversal', '用熟悉的 infix / postfix 當切入點');
}]);

// 21:26 infix print：左、自己、右，外加括號
FRAG.push(['heaplin-infix-print', 'infix print：先左、再自己、再右（in-order）', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3, 0.5]);
  const S = HT({ ly: ELY, w: 6, x0: 3.4, init: EXPR });
  const cd = code(['infix(T):', '  if T is leaf: print T.data', '  else:', '    infix(T.left)', '    print T.data', '    infix(T.right)'], -3.8, 5.6, 0.56);
  hideAll(cd);
  const out = tag(' ', 'ptr', 0, 0.8, 1.5);
  await step(tok);                                   // @1285.8 目標：infix print
  reveal(cd, 0); txt(out, '輸出：');
  say('目標：infix print', '印出這棵樹代表的 infix expression');
  await step(tok);                                   // @1322.8 operator 放中間
  S.hl([1], GOLD);
  say('infix：operator 放在中間', '左邊算完、右邊算完，再跟 operator 結合');
  await step(tok);                                   // @1345.8 先把左邊印完
  reveal(cd, 3); cd.hl(3); S.off(); S.hl([2], GOLD);
  say('先把左邊整個印完', 'infix(T.left)');
  await step(tok);                                   // @1371.8 印 T 上的 operator
  reveal(cd, 4); cd.hl(4); S.off(); S.hl([1], GOLD);
  say('再印 T 上的 data', '在這裡就是 operator ×');
  await step(tok);                                   // @1380.8 再印右邊
  reveal(cd, 5); cd.hl(5); S.off(); S.hl([3, 6, 7], GOLD);
  say('最後把右邊印出來', '基本形式就這樣，很簡單？');
  await step(tok);                                   // @1408.8 考慮優先順序就不對了
  S.off(); cd.hl(-1);
  const warn = tag('3 × 5 + 7 ≠ 3 × (5 + 7)', 'bad', 3.4, 6.6, 0);
  say('考慮先乘除後加減', '5 + 7 前面沒括號，意思就變了');
  await step(tok);                                   // @1432.8 印 subtree 前後加括號
  kill(warn);
  txt(cd.ls[3], '    print "("; infix(T.left); print ")"'); txt(cd.ls[5], '    print "("; infix(T.right); print ")"');
  cd.hl(3);
  say('印左右 subtree 時，前後各加一組括號', '用括號保護它們，切乾淨');
  await step(tok);                                   // @1486.8 recursive 呼叫有兩個部分
  cd.hl(-1);
  const rc = note('recursion = ① 怎麼呼叫自己 ② 什麼時候停', -3.8, 1.9, 1.0);
  say('這是 recursive 的呼叫', 'recursion 有兩個部分');
  await step(tok);                                   // @1504.8 stopping 和 recursion
  txt(rc, '① recursion（寫好了）  ② stopping（還沒）');
  say('一個是 recursion，一個是 stopping', '剛才只寫了 recursion');
  await step(tok);                                   // @1526.8 遇到 leaf 就只印數字
  kill(rc); reveal(cd, 1, 2); cd.hl(1); S.hl([2, 6, 7], GREEN);
  say('stopping：到了 leaf 就只印數字', '其他情況放進 else');
  await step(tok);                                   // @1566.8 拿這段 code 去跑
  txt(out, '');
  await trace(tok, S, cd, [[1, '(', 3], [2, '3', 1], [1, ')', 3], [1, '×', 4], [1, '(', 5], [3, '(', 3], [6, '5', 1], [3, ')', 3], [3, '+', 4], [3, '(', 5], [7, '7', 1], [3, ')', 5], [1, ')', 5]], out, '', 'infix', 180);
  say('照著 code 在這棵樹上跑', '一步一步印出來');
  await step(tok);                                   // @1579.8 印出 (3)×((5)+(7))
  out.element.className = 'lab-label ptr alt';
  say('印出：(3)×((5)+(7))', '括號很多，但意思是對的');
  await step(tok);                                   // @1610.8 還有修正空間
  note('改進：leaf 外面不加括號、看優先順序決定要不要加', 0, -0.4, 2.2);
  say('還有很多修正空間', '不過這不是這裡的重點');
  await step(tok);                                   // @1650.8 定義了拜訪順序：左 → 自己 → 右
  S.off(); const ord = [2, 1, 6, 3, 7];
  for (let n = 0; n < 5; n++) { S.hl([ord[n]], GOLD); S.at(ord[n], String(n + 1), 'idx', 0.75); await beat(tok, 300); }
  say('它定義了拜訪 node 的順序', '左邊全部 → 自己 → 右邊全部');
  await step(tok);                                   // @1699.8 in-order（中序）
  S.off();
  tag('in-order（中序）：左 → 自己 → 右', 'ptr alt', 3.4, 6.6, 0);
  say('這叫 in-order traversal（中序）', '自己在中間被拜訪');
}]);

// 29:07 postfix print：左、右、自己
FRAG.push(['heaplin-postfix-print', 'postfix print：先左、再右、最後自己（post-order）', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3, 0.5]);
  const S = HT({ ly: ELY, w: 6, x0: 3.4, init: EXPR });
  let cd = null;
  const out = tag(' ', 'ptr', 0, 0.8, 1.5);
  await step(tok);                                   // @1746.8 post print：印 post-order 的結果
  cd = code(['post(T):', '  if T is leaf: print T.data', '  else:', '    print "("; post(T.left); print ")"', '    print T.data', '    print "("; post(T.right); print ")"'], -3.8, 5.6, 0.56);
  say('postfix print：印出 post-order 的結果', '把 infix print 的 code 拷貝過來');
  await step(tok);                                   // @1797.8 不需要括號
  txt(cd.ls[3], '    post(T.left)'); txt(cd.ls[5], '    post(T.right)');
  cd.hl(3);
  say('第一：不需要括號', '把括號的部分拿掉');
  await step(tok);                                   // @1809.8 先左邊再右邊，最後才印自己
  txt(cd.ls[4], '    post(T.right)'); txt(cd.ls[5], '    print T.data');
  cd.hl(5);
  say('第二：先左、再右，最後才印自己', 'operator 放最後面');
  await step(tok);                                   // @1839.8 只是對調了幾行
  cd.hl(-1);
  note('只對調了幾行程式碼', -3.8, 1.9, 1.0);
  say('幾乎只是對調了幾行的順序', '');
  await step(tok);                                   // @1846.8 左邊印完、右邊印完、才換 operator
  txt(out, '');
  await trace(tok, S, cd, [[2, '3', 1], [6, '5', 1], [7, '7', 1], [3, '+', 5], [1, '×', 5]], out, ' ', 'post', 450);
  say('左邊的 postfix 先印完、右邊的再印完', '最後才是自己的 operator：3 5 7 + ×');
  await step(tok);                                   // @1865.8 infix ↔ in-order
  tag('infix print ↔ in-order：左 → 中 → 右', 'idx', -3.8, 1.2, 1.4);
  say('infix 對應 in-order traversal', '左 → 中 → 右');
  await step(tok);                                   // @1889.8 postfix ↔ post-order
  const ord = [2, 6, 7, 3, 1];
  for (let n = 0; n < 5; n++) { S.hl([ord[n]], GOLD); S.at(ord[n], String(n + 1), 'idx', 0.75); await beat(tok, 280); }
  tag('postfix print ↔ post-order：左 → 右 → 自己', 'ptr alt', 3.4, 6.6, 0);
  say('postfix 對應 post-order traversal', '先左、再右、最後自己');
  await step(tok);                                   // @1919.8 以後還會看到它們的用途
  S.off();
  say('這些 traversal 以後還會再看到', '先把 infix、postfix、expression tree 黏在一起');
  await step(tok);                                   // @1956.8 infix → postfix 的 stack 在抽象的樹上運作
  for (let k = 0; k < 3; k++) cube('', '#e6e1d8', [1.0, 0.3, 0.8], -6.0, 0.15 + k * 0.32, 1.6, 1.5);
  tag('stack', 'idx', -6.0, 1.3, 1.6);
  arrow(V3(-5.3, 0.6, 1.6), V3(1.0, 3.6, 0.2), 0xa8730f);
  say('之前 infix → postfix 用的 stack', '其實是在一棵抽象的 expression tree 上運作');
}]);

// 33:11 prefix：operator 在前面 = 函數呼叫，Lisp
FRAG.push(['heaplin-prefix', 'prefix：operator 寫前面，像函數呼叫', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3, 0.5]);
  const S = HT({ ly: ELY, w: 6, x0: 3.4, init: EXPR });
  const out = tag(' ', 'ptr', 0, 0.8, 1.5);
  await step(tok);                                   // @1990.8 prefix expression
  sayT('第三種：prefix', -3.4, 6.4, 0);
  say('除了 infix、postfix', '還有一種叫 prefix');
  await step(tok);                                   // @2001.8 in 在中間、post 在後面、pre 在前面
  tag('in = 中間', 'idx', -3.4, 5.6, 0); tag('post = 後面', 'idx', -3.4, 5.0, 0); tag('pre = 前面', 'ptr alt', -3.4, 4.4, 0);
  say('in 在中間、post 在後面', 'pre 就是在前面');
  await step(tok);                                   // @2018.8 (× 3 (+ 5 7))
  txt(out, '');
  await trace(tok, S, null, [[1, '×', 0], [2, '3', 0], [3, '+', 0], [6, '5', 0], [7, '7', 0]], out, ' ', 'pre', 350);
  txt(out, '(× 3 (+ 5 7))');
  say('3 × (5 + 7) 寫成 prefix', '(× 3 (+ 5 7))');
  await step(tok);                                   // @2039.8 第一個是要做的事，後兩個是運算對象
  S.hl([1, 3], GOLD); S.hl([2, 6, 7], BLUE);
  say('括號裡：第一個是要做的事', '後面兩個是要運算的對象');
  await step(tok);                                   // @2048.8 由內而外：+ 5 7 先做
  S.off(); S.hl([3, 6, 7], GOLD); await beat(tok, 800); S.hl([1, 2], GREEN);
  say('一樣由內而外', '+ 5 7 先做，結果再跟 3 相乘');
  await step(tok);                                   // @2060.8 multiply(3, plus(5, 7))
  S.off();
  const l2 = tag('multiply(3, plus(5, 7))', 'ptr alt', -3.4, 2.8, 1);
  say('換個寫法比較好接受', 'multiply(3, plus(5, 7))');
  await step(tok);                                   // @2073.8 就是函式呼叫
  sayT('函式名稱在前、參數在後', -3.4, 2.1, 1);
  say('這就是習慣的 function call', 'operator 當成函式寫在前面');
  await step(tok);                                   // @2111.8 C++ operator overloading
  const ov = note('C++：a + b 其實是 operator+(a, b)', -3.4, 1.4, 1.4);
  say('C++ 的 operator overloading', '把運算符號當成函式呼叫');
  await step(tok);                                   // @2145.8 多項式的加法
  txt(ov, '想支援多項式的 +：寫一個「多項式加法」函式');
  say('例如想支援多項式的加法', '寫一個函式，告訴編譯器 + 要換成它');
  await step(tok);                                   // @2194.8 prefix 像函式、infix 像四則、postfix 像電腦
  kill(ov); kill(l2);
  tag('prefix ≈ 函式呼叫', 'say', -3.6, 2.8, 1); tag('infix ≈ 小學四則運算', 'say', -3.6, 2.2, 1); tag('postfix ≈ 電腦實際執行', 'say', -3.6, 1.6, 1);
  say('三種寫法各有它的意念', 'prefix 像函式、infix 像四則、postfix 像電腦');
  await step(tok);                                   // @2211.8 在 expression tree 上都很容易看出來
  S.hl([1, 2, 3, 6, 7], BLUE);
  say('三種在 expression tree 上都看得出來', '會寫 infix print，就會寫 prefix print');
  await step(tok);                                   // @2230.8 括號很多 → Lisp
  S.off();
  tag('Lisp：(× 3 (+ 5 7))，括號超多', 'ptr', 0, 0.1, 2.2);
  say('充滿括號的 prefix 寫法', '對應經典語言 Lisp');
}]);

// 39:23 三種 traversal 的用途：比較兩棵樹用 pre-order
FRAG.push(['heaplin-traversal-uses', 'traversal 的用途：比較兩棵樹先看自己', async (tok) => {
  fresh(CAM, LOOK);
  const A = HT({ ly: ELY, w: 5, x0: -3.3, init: EXPR });
  let B = null;
  await step(tok);                                   // @2363.8 traversal 對應很多經典演算法
  sayT('traversal → 很多經典演算法', -3.3, 6.6, 0);
  say('expression tree 的 traversal', '對應到很多經典的事情');
  await step(tok);                                   // @2369.8 post-order = evaluate expression
  A.hl([3], GOLD); A.at(3, '= 12', 'pkt'); await beat(tok, 700);
  A.hl([1], GOLD); A.at(1, '= 36', 'pkt');
  say('post-order 在 expression tree 上', '就是在 evaluate（算出）這個式子');
  await step(tok);                                   // @2380.8 比兩棵 binary tree 一不一樣
  A.off();
  B = HT({ ly: ELY, w: 5, x0: 3.3, init: [[1, '×'], [2, 3], [3, '−'], [6, 5], [7, 7]] });
  say('比較兩棵 binary tree 一不一樣', '右邊這棵是示意');
  await step(tok);                                   // @2388.8 先比 subtree 才發現自己不一樣 → 白做
  note('先比完 subtree 才發現自己不一樣 → 白做', 0, 0.6, 1.4);
  say('如果 subtree 都比完才比自己', '自己一不一樣 → 下面都白做了');
  await step(tok);                                   // @2397.8 用 pre-order：先比自己再比 subtree
  for (const i of [1, 2, 3]) {
    const same = A.v[i] === B.v[i];
    A.hl([i], same ? GREEN : RED); B.hl([i], same ? GREEN : RED);
    await beat(tok, 650);
  }
  say('用 pre-order：先比自己、再比 subtree', '× = ×、3 = 3、+ ≠ −：停！');
  await step(tok);                                   // @2411.8 就能做 same-tree test
  A.hl([6, 7], GRAY); B.hl([6, 7], GRAY);
  say('一發現不同就停', '下面的 5、7 不用再比');
  await step(tok);                                   // @2417.8 in-order 之後對應排序
  sayT('in-order → 之後會對應到排序', 0, 7.4, 0);
  say('樹有特別性質時，in-order', '會對應到排序之類的事（之後講）');
  await step(tok);                                   // @2424.8 三種 traversal 是基本功
  tag('pre-order ・ in-order ・ post-order = 基本功', 'ptr alt', 0, 0.0, 2.0);
  say('pre-order、in-order、post-order', 'binary tree 的基本功');
}]);

// 62:20 node 拆成 key 與 data
FRAG.push(['heaplin-key-data', 'node = key ＋ data ＋ 左右兩張小紙條', async (tok) => {
  fresh([0, 4, 12], [0, 2.2, 0]);
  let d = null, k = null, dd = null;
  await step(tok);                                   // @3739.8 原本的 node：data ＋ 兩張小紙條
  d = cube('data', '#8fb3d9', [2.4, 0.8, 1], 0, 4, 0, 3);
  cube('L', '#d8c29b', [1.1, 0.6, 1], -0.65, 3.3, 0); cube('R', '#d8c29b', [1.1, 0.6, 1], 0.65, 3.3, 0);
  arrow(V3(-0.65, 3.0, 0), V3(-2.4, 1.6, 0)); arrow(V3(0.65, 3.0, 0), V3(2.4, 1.6, 0));
  say('原本想像的 node：裝 data 的地方', '＋ 指向左右的兩張小紙條');
  await step(tok);                                   // @3776.8 上半部要切開
  glow(d, GOLD);
  say('接下來：把上半部切成兩部分', '下半部還是兩張小紙條');
  await step(tok);                                   // @3795.8 KEY 和 DATA
  kill(d);
  k = cube('KEY', '#e2b84b', [1.0, 0.8, 1], -0.7, 4, 0, 2);
  dd = cube('DATA', '#8fb3d9', [1.3, 0.8, 1], 0.6, 4, 0, 2);
  say('第一部分叫 KEY，第二部分還是 DATA', 'key = 檢索鍵');
  await step(tok);                                   // @3818.8 key 扮演關鍵角色
  glow(k, GOLD);
  say('key 扮演關鍵角色', '在 tree 裡找東西、整理資料都靠它');
  await step(tok);                                   // @3851.8 筆記的頁碼
  const box = ghostBox('#7a6a50', 2.2, 1.2, 1.2); box.position.set(4.5, 4, 0);
  const bl = tag('那一頁筆記的內容', 'idx', 4.5, 4.9, 0);
  arrow(V3(1.3, 4, 0), V3(3.3, 4, 0));
  tag('頁碼', 'pkt', -0.7, 5.0, 0.5);
  say('像筆記：每頁的字是 data', '頁碼就像 key');
  await step(tok);                                   // @3864.8 圖書館的書和書的 ID
  txt(bl, '圖書館的那本書');
  say('圖書館：書是 data', '書的 ID 就像 key');
  await step(tok);                                   // @3892.8 只專注在 key，透過 key 去找
  const you = buddy('你', '', '#9fd39a', -4.6, 0, 1.2, 0.7);
  await go(tok, you, V3(-2.4, 0, 1.2), 700); you.look(1); you.mood('happy');
  say('很多操作只看 key', '透過 key 找到要的東西');
  await step(tok);                                   // @3906.8 data 甚至只是一張紙條
  relabel(dd, 'DATA →'); glow(dd, BLUE);
  say('data 甚至可以只是一張小紙條', '連到外面真正存資料的地方');
}]);

// 65:26 待辦事項：找 priority 最大的；mailbox 是 stack；queue 是特例
FRAG.push(['heaplin-todo-pq', 'Priority Queue：每次拿 priority 最大的', async (tok) => {
  fresh([0, 4.4, 13], [0, 2.4, 0]);
  const items = [[8, 'DSA 作業3'], [9, 'Final Project'], [6, '微積分作業']];
  const X = (j) => -4 + j * 4;
  let ms = [];
  await step(tok);                                   // @3925.8 一個具體的 task：一群 node
  for (let j = 0; j < 3; j++) ms.push(cube('?', NODEC, [1.0, 1.0, 1.0], X(j), 3, 0, 3));
  say('來個具體的 task', '一群資料，每筆是一個 node');
  await step(tok);                                   // @3949.8 key = priority，data = to-do
  sayT('key = priority（重要性）、data = to-do（待辦）', 0, 5.4, 0);
  say('key 表示 priority', 'data 表示 to-do');
  await step(tok);                                   // @3984.8 DSA 作業3、Final Project、微積分作業
  ms.forEach((m, j) => { relabel(m, items[j][0]); tint(m, col(items[j][0])); tag(items[j][1], 'idx', X(j), 3.9, 0); });
  say('例如：DSA 作業3、Final Project、微積分作業', '每件前面貼上 priority（數字示意）');
  await step(tok);                                   // @4013.8 重要的事先完成
  ms.forEach((m) => glow(m, BLUE));
  say('合理的做法：重要的事先做', '不重要的往後放');
  await step(tok);                                   // @4054.8 100 件待辦：先做哪件？
  ms.forEach((m) => glow(m, null));
  const pile = note('想像有 100 件待辦…', 0, 1.4, 1.2);
  say('如果有 100 件待辦', '要找出 key 最大、最該先做的那件');
  await step(tok);                                   // @4097.8 很快找到最重要的 → 做掉 → 再找下一件
  kill(pile); glow(ms[1], GREEN); move(ms[1], 0, 5.0, 0);
  await beat(tok, 900);
  fly(ms[1], V3(1, 6, 2));
  say('很快找到最重要的 → 做掉', '再找第二重要的、第三重要的…');
  await step(tok);                                   // @4130.8 老師的待辦 = mailbox
  const tch = buddy('老師', '', '#c9a6e8', 3.4, 0, 2.4, 0.7);
  const mail = [1, 2, 3, 4].map((j) => cube('信' + j, '#c8b89a', [1.4, 0.35, 1], 5.6, 0.2 + j * 0.4, 2.4, 2));
  say('老師的待辦事項 = mailbox', '裡面三百多封信');
  await step(tok);                                   // @4154.8 mailbox 是 stack：最後進來的先處理
  glow(mail[3], GOLD); await beat(tok, 500);
  fly(mail[3], V3(2, 6, 3)); tch.mood('wow');
  say('老師的 mailbox 其實是 stack', '最後進來的信先處理');
  await step(tok);                                   // @4184.8 能輕易找到最重要的 → priority queue
  tch.mood('calm');
  tag('priority queue', 'ptr alt', 0, 6.4, 0);
  say('能很快找到最重要那件的 data structure', '叫做 priority queue');
  await step(tok);                                   // @4195.8 queue 是特例：先進去的 priority 最大
  note('queue = 特例：越早進來 priority 越大', -3.6, 1.4, 1.2);
  say('以前的 queue 只是特別的一種', '先進去的 priority 最大，先出來');
  await step(tok);                                   // @4223.8 放進去時可以指定任何數字當 key
  sayT('放進去：任何數字當 key；拿出來：挑最大的', 0, 0.5, 1.6);
  say('priority queue 更 general', '放進去時隨便指定 key，拿時挑最大');
  await step(tok);                                   // @4237.8 不靠 index、pointer、進入順序
  ms.forEach((m) => m.parent && glow(m, null)); glow(ms[0], GREEN);
  say('拿東西不靠 index、pointer、進來的先後', '而是拿 key 最大的');
}]);

// 71:00 為什麼要做快：作業系統排程
FRAG.push(['heaplin-os-sched', '作業系統排程：等待區就是 priority queue', async (tok) => {
  fresh([0, 4.4, 13], [0, 2.2, 0]);
  const V = [5, 9, 2, 7];
  const X = (j) => -5 + j * 1.6;
  const R = V.map((v, j) => cube(v, col(v), [0.9, 0.9, 0.9], X(j), 0.45, 0));
  await step(tok);                                   // @4260.8 想把這件事做得很快
  sayT('目標：拿出 key 最大的，要很快', -2.6, 2.0, 0);
  say('拿出 key 最大的那個', '而且要做得很快');
  await step(tok);                                   // @4271.8 sequential search：一個一個找
  const cu = tag('▼', 'ptr alt', 0, -5, 0);
  for (let j = 0; j < 4; j++) { cu.position.set(X(j), 1.2, 0); glow(R[j], GOLD); await beat(tok, 350); glow(R[j], null); }
  kill(cu); glow(R[1], GREEN);
  say('sequential search：一個一個慢慢找', '每次都要全部看一遍');
  await step(tok);                                   // @4282.8 ordered array：最大的在最後
  glow(R[1], null);
  const ord = V.map((v, j) => [v, j]).sort((a, b) => a[0] - b[0]);
  ord.forEach(([, j], k) => move(R[j], X(k), 0.45, 0));
  glow(R[1], GREEN);
  say('或用 ordered array', '從小排到大，最大的在最後一格');
  await step(tok);                                   // @4297.8 但排序可能花太大力氣
  tag('排序要花很大的力氣', 'bad', -2.6, 2.8, 0);
  say('但 sorting 可能花太大力氣', '先不考慮');
  await step(tok);                                   // @4308.8 從 tree 的角度切入：自己設計
  sayT('從 tree 的角度：從頭設計一個 data structure', 2.4, 4.6, 0);
  say('從 tree 的角度切入', '帶大家從頭設計一個 data structure');
  await step(tok);                                   // @4359.8 不是只找一次：會多次取用
  say('不是只找一次', '整理好以後要「多次」取用');
  await step(tok);                                   // @4386.8 找最大、拿出來、放新的，同時維持性質
  ['① 找到最大', '② 拿出來', '③ 放新的進去'].forEach((t, k) => tag(t, 'pkt', 3.4, 3.4 - k * 0.6, 0));
  say('① 找最大 ② 拿出來 ③ 放新的', '過程中一直維持某種性質');
  await step(tok);                                   // @4426.8 作業系統：多工
  R.forEach((m) => kill(m));
  const zoneW = K.zone('等待區', -2.6, 0, 1.4, 6.4, 2.0, '#cfe3d4');
  const core = prop('cpu', 4.6, 0, 1.4, 1.3, 'CPU 核心'); bob(core, 0.03);
  const P = [['P1', 5, '#7cb8ee'], ['P2', 9, '#e86a5a'], ['P3', 2, '#9fd39a'], ['P4', 7, '#f4c27a']].map(([n, p, c], j) => buddy(n, p, c, -5 + j * 1.5, 0, 1.4, 0.6));
  say('電腦大多是多工系統', '很多程式「假裝」同時在跑');
  await step(tok);                                   // @4461.8 核心空出來 → 挑最需要 CPU 的
  P[1].glow(GOLD); await go(tok, P[1], V3(4.6, 0.25, 1.4), 900); P[1].mood('happy');
  say('核心空出來了', 'OS 挑一個最需要 CPU 的工作（P2）');
  await step(tok);                                   // @4476.8 時間到還沒做完 → 放回去、重設 priority
  P[1].glow(null); await go(tok, P[1], V3(-3.5, 0, 1.4), 900); P[1].set(3); P[1].mood('calm');
  say('時間到了還沒做完 → 放回等待區', '重新給一個 priority（這裡 3，示意）');
  await step(tok);                                   // @4500.8 等待區就是 priority queue
  tag('等待區 = priority queue', 'ptr alt', -2.6, 2.2, 1.4);
  say('這個等待區就是 priority queue', '每次找出 priority 最大的');
  await step(tok);                                   // @4541.8 等越久 priority 調高，才不會餓死
  P[2].set(6); P[2].mood('happy'); await P[2].hop(tok);
  say('等越久的，priority 要調高一點', '才不會有 process 餓死');
  await step(tok);                                   // @4577.8 老闆要你設計 priority queue
  const boss = buddy('老闆', '!', '#c9a6e8', 5.8, 0, -1.2, 0.7); boss.mood('wow');
  say('想像老闆要你設計一個 priority queue', '回到還沒人設計好的年代，自己來');
}]);

// 77:00 第一個想法：最大的放 root，其他亂放
FRAG.push(['heaplin-root-only', '只把最大放 root：拿走後要全部找一遍', async (tok) => {
  fresh(CAM, LOOK);
  const S = HT();
  await step(tok);                                   // @4618.8 需求：最大的 key 要很快找到
  sayT('需求：key 最大的要能很快找到', 0, 7.0, 0);
  say('我們需要：最大 key 的那個', '可以很快找到');
  await step(tok);                                   // @4659.8 tree 裡最先接觸的是 root
  const r = S.put(1, '?', 3, NODEC);
  say('在 tree 裡最先碰到的是什麼？', 'root');
  await step(tok);                                   // @4675.8 最大的放 root，其他不管
  relabel(r, 14); tint(r, col(14)); S.v[1] = 14; glow(r, GOLD);
  say('那就把最大的放在 root', '其他地方放什麼不管');
  await step(tok);                                   // @4742.8 這邊 6、8、12、5、9
  for (const [i, v] of [[2, 6], [3, 8], [4, 12], [5, 5], [7, 9]]) { S.put(i, v, 3); await beat(tok, 280); }
  say('其他位置：6、8、12、5、9', '滿足條件的 binary tree');
  await step(tok);                                   // @4814.8 我真是天才
  const me = buddy('你', '', '#9fd39a', -5.6, 0, 1.6, 0.7); me.mood('happy');
  await me.hop(tok);
  sayT('「我設計出全新的 data structure！」', -3.6, 1.6, 1.6);
  say('興沖沖跟同學說：我真是天才', '最大的永遠在最上面');
  await step(tok);                                   // @4851.8 只是看的話，每次都是 14
  S.at(1, 'top：每次看都是 14', 'pkt', 0.9);
  say('如果只是看最大的', '每次看都是 14，很快');
  await step(tok);                                   // @4867.8 但 14 要被拿掉
  S.hl([1], RED); await beat(tok, 500);
  S.rm(1); me.mood('wow');
  say('可是 priority queue 還要把 14 拿掉', '拿掉的時候 …');
  await step(tok);                                   // @4877.8 群龍無首：要找過其他所有 node
  const cu = tag('▼', 'ptr alt', 0, -5, 0); let best = 0, bi = 0;
  for (const i of [2, 3, 4, 5, 7]) { cursorAt(cu, S, i); S.off(); S.hl([i], GOLD); if (S.v[i] > best) { best = S.v[i]; bi = i; } await beat(tok, 380); }
  kill(cu); S.off();
  say('群龍無首：誰來當新的 root？', '只好把剩下的 node 全部找一遍');
  await step(tok);                                   // @4923.8 躲在最下面的 12 上來
  S.hl([bi], GREEN); S.mv(bi, 1);
  say('找到躲在最下面的 12', '12 上來當新的 root');
  await step(tok);                                   // @4970.8 像 selection sort：每輪重掃
  S.off();
  note('像 selection sort：每一輪都整個重新掃', 0, 0.4, 1.4);
  say('這就像 selection sort', '每一輪都要整個重新掃過');
  await step(tok);                                   // @5006.8 6 筆拿掉 1 筆，剩 5 筆全部找過
  say('6 筆拿掉 1 筆：剩下 5 筆全部找過', 'traversal 很花時間');
  await step(tok);                                   // @5031.8 怎麼很快找到繼承人？
  me.mood('sad');
  sayT('問題：最大的被拿走時，怎麼快速找到繼承人？', 0, 7.0, 1.0);
  say('第二個需求', '最大的缺位時，怎麼很快找到繼承人？');
}]);

// 84:07 再加規則：每個 subtree 的 root 也是最大 → binary max tree
FRAG.push(['heaplin-maxtree-def', 'Binary Max Tree：subtree 的 root 也是最大', async (tok) => {
  fresh(CAM, LOOK);
  const S = HT();
  S.put(1, 14);
  const chair = S.at(1, '黨主席', 'pkt', 0.85);
  await step(tok);                                   // @5046.8 黨主席缺位時，怎麼很快找到繼承人
  S.hl([1], GOLD);
  say('找最大很容易：放 root（黨主席）', '難的是：黨主席辭職時，誰接？');
  await step(tok);                                   // @5068.8 binary tree 還有兩棵 subtree
  S.off();
  const g1 = ghostBox('#7a6a50', 4.4, 3.6, 1.2); g1.position.set(-2.5, 3.0, 0);
  const g2 = ghostBox('#7a6a50', 4.4, 3.6, 1.2); g2.position.set(2.5, 3.0, 0);
  say('largest 之外，還有兩棵 subtree', '不想每次都進去整棵找半天');
  await step(tok);                                   // @5093.8 每棵 subtree 上面放 sub-largest
  S.put(2, 9, 3); S.put(3, 12, 3);
  say('乾脆在每棵 subtree 的最上面', '放它的 sub-largest');
  await step(tok);                                   // @5118.8 兩個副主席各自控制派系
  for (const [i, v] of [[4, 4], [6, 8], [7, 5]]) { S.put(i, v, 3); await beat(tok, 300); }
  S.at(2, '副主席', 'pkt', 0.85); S.at(3, '副主席', 'pkt', 0.85);
  say('像兩個副主席', '各自把下面的派系管得好好的');
  await step(tok);                                   // @5162.8 兩個 sub-largest 打一架
  S.hl([2, 3], GOLD);
  const vs = tag('VS', 'bad', 0, 4.3, 0.4);
  say('largest 缺位時：兩個 sub-largest 打一架', '看誰大，很快就知道誰補上');
  await step(tok);                                   // @5181.8 要求 subtree 的 root 是 sub-largest
  kill(vs); S.off(); S.hl([2, 3], GREEN);
  say('所以不只 root 要最大', 'subtree 的 root 也要是那棵裡最大的');
  await step(tok);                                   // @5259.8 名字：Binary Max Tree
  S.off(); kill(chair);
  tag('Binary Max Tree', 'ptr alt', 0, 7.0, 0);
  say('這個設計有個名字', 'Binary Max Tree');
  const cd = code(['Binary Max Tree:', '1. root.key ≥ 其他所有 node 的 key', '2. 每個 subtree 都是 Binary Max Tree'], -4.2, 1.3, 0.5, 1.5);
  hideAll(cd); reveal(cd, 0);
  await step(tok);                                   // @5274.8 條件一：root 的 key ≥ 其他所有
  reveal(cd, 1); cd.hl(1); S.hl([1], GREEN);
  say('條件一：root 的 key', '≥ 其他所有 node 的 key');
  await step(tok);                                   // @5315.8 條件二：每個 subtree 也是 Binary Max Tree
  reveal(cd, 2); cd.hl(2); S.off(); S.hl([2, 4], GOLD); S.hl([3, 6, 7], BLUE);
  say('條件二：每個 subtree 都是 Binary Max Tree', 'recursive 的定義');
  await step(tok);                                   // @5357.8 停在 single leaf
  cd.hl(-1); S.off(); S.hl([4, 6, 7], GREEN);
  say('recursion 什麼時候停？', '到 single leaf：它本身就是最大');
}]);

// 90:16 檢查 + remove 14、remove 12：較大的 sub-root 補位
FRAG.push(['heaplin-maxtree-remove', 'Max Tree 的 remove largest：較大的 sub-root 補位', async (tok) => {
  fresh(CAM, LOOK);
  const S = HT({ init: MAXT });
  await step(tok);                                   // @5424.8 條件一：14 最大
  S.hl([1], GREEN);
  say('檢查條件一：14 有沒有比其他都大？', '有');
  await step(tok);                                   // @5432.8 左 subtree：9 最大，4 是 single node
  S.off(); S.hl([2, 4], GREEN);
  say('左邊 subtree：9 最大', '4 是 single node，也是 max tree');
  await step(tok);                                   // @5456.8 右 subtree：12 最大
  S.off(); S.hl([3, 6, 7], GREEN);
  say('右邊：12 是三個裡最大的', '整棵都是 Binary Max Tree');
  await step(tok);                                   // @5485.8 找最大：在 root
  S.off(); S.hl([1], GOLD);
  say('找最大：就在 root', '不用去任何其他地方找');
  await step(tok);                                   // @5509.8 remove 14
  S.rm(1);
  say('remove largest：把 14 拿掉', '誰能參選新任黨主席？');
  await step(tok);                                   // @5531.8 9 和 12 打一架：12 贏，補 root
  S.hl([2, 3], GOLD); const vs = tag('VS', 'bad', 0, 4.9, 0.4);
  await beat(tok, 800); kill(vs);
  S.off(); S.mv(3, 1); S.hl([1], GREEN);
  say('兩個 subtree 的開頭：9 和 12 打一架', '12 贏 → 新任黨主席');
  await step(tok);                                   // @5552.8 事情還沒完：12 的位置空了
  S.off(); const hole = S.at(3, '空了', 'bad', 0);
  say('事情還沒完', '12 原本的位置缺位了');
  await step(tok);                                   // @5595.8 8 和 5 打一架，8 補位
  kill(hole); S.hl([6, 7], GOLD); await beat(tok, 700);
  S.off(); S.mv(6, 3);
  say('依樣畫葫蘆：8 和 5 打一架', '8 贏，上去補位；8 原本是 leaf，空了沒關係');
  await step(tok);                                   // @5623.8 8 壓得住 5；12 壓得住 9 那邊
  S.hl([3], GREEN); S.hl([7], BLUE); await beat(tok, 700);
  S.hl([1], GREEN); S.hl([2], BLUE);
  say('8 打贏了，一定壓得住 5', '12 也壓得住 9 那一派');
  await step(tok);                                   // @5680.8 再 remove 12：9 和 8 打一架，9 贏
  S.off(); S.rm(1); await beat(tok, 500);
  S.hl([2, 3], GOLD); await beat(tok, 600);
  S.off(); S.mv(2, 1);
  say('再 remove 12：9 和 8 打一架', '9 贏，上去補位');
  await step(tok);                                   // @5702.8 9 的位置：只有 4，直接上來
  S.hl([4], GOLD); await beat(tok, 500);
  S.off(); S.mv(4, 2);
  say('9 的位置空了：4 沒有對手', '4 就順理成章上來');
  await step(tok);                                   // @5731.8 原則：replace with larger of sub-roots, recursively
  tag('replace with larger of sub-roots, recursively', 'ptr alt', 0, 7.0, 0);
  say('原則：用較大的 sub-root 補位', '再 recursive 地往下做');
  await step(tok);                                   // @5786.8 用 Binary Max Tree 做 priority queue
  S.hl([1], GREEN);
  say('用 Binary Max Tree 做 priority queue', '找最大很快，拿走後補位也很快');
}]);

// 99:46 規則 vs 效率：只走一條 root→leaf 路徑；insert 預告
FRAG.push(['heaplin-rule-path', '只走一條 root→leaf 路徑：時間跟高度有關', async (tok) => {
  fresh(CAM, LOOK);
  const S = HT({ init: MAXT });
  await step(tok);                                   // @5985.8 重點：依 key 加上規則
  sayT('heap 的重點：依照 key 加上規則', 0, 7.0, 0);
  say('重點不在資料多或少', '而是根據 key 加上一些限制');
  await step(tok);                                   // @6011.8 ordered array = 有規則的 array
  tag('array ＋ 規則 = ordered array', 'idx', -3.6, 0.6, 1.5);
  say('array 本來沒限制', '加上「依大小連續排好」= ordered array');
  await step(tok);                                   // @6026.8 binary max tree = 有規則的 tree
  tag('tree ＋ 規則 = binary max tree', 'idx', 3.6, 0.6, 1.5);
  say('tree 加上 key 的規則', '= binary max tree');
  await step(tok);                                   // @6071.8 規則越多越好找，維護越花時間
  const room = note('房間整理得很好：好找，但整理很花時間', 0, -0.2, 2.2);
  say('規則跟效率常常反方向', '像整理房間：整理越多越好找，但越花時間');
  await step(tok);                                   // @6100.8 我們的規則：最大的放最上面
  S.hl([1], GOLD);
  say('我們的規則：最大的在最上面', '找東西變容易了');
  await step(tok);                                   // @6106.8 能不能不花太多時間維護規則？
  S.off();
  say('能不能同時想好怎麼維護規則', '不要在 tree 裡來來回回整理半天？');
  await step(tok);                                   // @6141.8 更新只沿一條 root→leaf 的 path
  kill(room);
  for (const i of [1, 3, 6]) { S.hl([i], GOLD); await beat(tok, 450); }
  say('remove 的更新只沿一條 root → leaf 的路', '14 → 12 → 8：其他 node 都不用看');
  await step(tok);                                   // @6166.8 只跟樹高有關
  tag('時間 ∝ 樹高 h', 'ptr alt', 5.4, 5.8, 0);
  say('處理速度只跟樹的高度有關', '跟 node 數量沒那麼大關係');
  await step(tok);                                   // @6192.8 同學問：insert 怎麼做？
  S.off();
  const st = buddy('同學', '?', '#7cb8ee', -5.8, 0, 1.6, 0.7); st.mood('wow');
  say('同學問：那 insert 怎麼做？', '好問題');
  await step(tok);                                   // @6217.8 成功的領導人從基層做起
  const p = S.p(5);
  const nw = cube('新', '#e2b84b', [0.85, 0.85, 0.85], p.x, p.y, 0, 3);
  const e = line(S.p(2).x, S.p(2).y, p.x, p.y);
  say('成功的領導人都從基層做起', '先把新東西放到 leaf');
  await step(tok);                                   // @6277.8 跟兄弟、爸爸三個打一架
  S.hl([2, 4], BLUE); glow(nw, GOLD);
  say('跟兄弟、爸爸三個打一架', '大的上去，小的下來');
  await step(tok);                                   // @6303.8 一路往上爬
  S.off(); kill(e); kill(nw);
  st.mood('happy');
  say('一路往上爬（小魚逆流而上）', '也只走一條路：O(h)');
}]);

// 117:25 最糟情況：歪斜的 max tree
FRAG.push(['heaplin-skewed', '歪斜的 Max Tree：50 49 46 … 退化成 list', async (tok) => {
  fresh([0, 3.6, 13], [0, 3, 0]);
  let T = HT({ init: MAXT, w: 7, x0: 0 });
  await step(tok);                                   // @7045.8 找最大：去 root
  T.hl([1], GOLD);
  say('Binary Max Tree 做得到兩件事', '一：找最大，去 root 找就好');
  await step(tok);                                   // @7050.8 二：把最大的移掉
  T.hl([1], RED);
  say('二：把最大的移掉', '現在也會做了');
  await step(tok);                                   // @7065.8 打架上去只在一條 root→leaf 路徑
  T.off(); for (const i of [1, 3, 6]) { T.hl([i], GOLD); await beat(tok, 400); }
  say('打架上去、打架上去', '只在一條 root → leaf 的路上做');
  await step(tok);                                   // @7088.8 最多花樹高那麼多時間
  tag('最多 = 樹高 h', 'ptr alt', 4.6, 5.8, 0);
  say('最多最多要花多少時間？', '樹的高度 h 那麼多');
  await step(tok);                                   // @7115.8 運氣不好走最長的路
  say('運氣不好剛好走最長那條', '運氣好可以少一點；最多就是 h');
  await step(tok);                                   // @7155.8 最壞：樹長得歪歪斜斜
  fresh([0, 3.6, 13], [0, 3, 0]);
  const V = [50, 49, 46, 44, 21, 17, 5, 3];
  const P = (k) => V3(-4.2 + k * 1.2, 6.0 - k * 0.72, 0);
  let ms = V.map((v, k) => { const p = P(k); return cube('', NODEC, [0.75, 0.75, 0.75], p.x, p.y, 0); });
  let ed = [];
  const edges = () => { ed.forEach(kill); ed = []; for (let k = 1; k < ms.length; k++) { const a = P(k - 1), b = P(k); ed.push(line(a.x, a.y, b.x, b.y)); } };
  edges();
  say('最壞的情況：樹長得歪歪斜斜', '');
  await step(tok);                                   // @7174.8 跟 linked list 沒兩樣
  tag('= linked list', 'bad', 2.6, 6.0, 0);
  say('跟 linked list 沒什麼兩樣', 'root 走到 leaf：O(n)');
  await step(tok);                                   // @7203.8 50 49 46 44 21 17 5 3
  for (let k = 0; k < V.length; k++) { relabel(ms[k], V[k]); tint(ms[k], col(V[k])); await beat(tok, 150); }
  say('例如：50 49 46 44 21 17 5 3', '也是 binary max tree，但 h = n');
  await step(tok);                                   // @7220.8 50 缺位：不用打架，49 上去
  glow(ms[0], RED); await beat(tok, 400);
  fly(ms[0], V3(-2, 6, 4)); ms = ms.slice(1);
  move(ms[0], P(0).x, P(0).y, 0); glow(ms[0], GOLD);
  say('remove 50：不用打架', '49 直接上去');
  await step(tok);                                   // @7230.8 46、44、21…每個都要移
  for (let k = 1; k < ms.length; k++) { const p = P(k); glow(ms[k], GOLD); move(ms[k], p.x, p.y, 0); await beat(tok, 260); }
  edges();
  say('可是 46、44、21…', '每一個都要往上移一格');
  await step(tok);                                   // @7249.8 像 ordered array 刪掉第一個
  ms.forEach((m) => glow(m, null));
  note('像 ordered array 刪掉第一個：其他全部往前移', 0, 0.2, 1.4);
  say('似曾相似：ordered array 刪掉第一個', '其他東西都要往前移');
  await step(tok);                                   // @7260.8 最糟情況要花很大力氣
  say('最糟情況要花很大的力氣', 'O(n)：這不太好');
}]);

// 121:14 h = log n：full 的 node 數受限，改用 complete
FRAG.push(['heaplin-full-vs-complete', '想要 h = log n：full 不實際，用 complete', async (tok) => {
  fresh([0, 4.2, 13.5], [0, 3.2, 0]);
  const S = HT({ w: 11, sz: 0.6, color: () => NODEC });
  await step(tok);                                   // @7273.8 讓 h 小，不跟 n 成線性
  sayT('希望：h 不要跟 n 成線性關係', 0, 7.2, 0);
  say('有沒有辦法讓 h 小一點？', '不要是歪歪斜斜的樹');
  await step(tok);                                   // @7297.8 開枝散葉；最好 h = log n
  say('讓樹稍微開枝散葉', '最好的 case：h = log n');
  await step(tok);                                   // @7304.8 15 個 node
  sayT('15 個 node，最矮可以幾層？', 0, 0.3, 1.2);
  say('例如有 15 個 node', '最好最好要幾層？');
  await step(tok);                                   // @7317.8 1 + 2 + 4 + 8
  const cnt = [1, 2, 4, 8]; let i = 1;
  for (let d = 0; d < 4; d++) { for (let k = 0; k < cnt[d]; k++) { S.put(i, '', 1.5); i++; } tag(String(cnt[d]), 'idx', -6.2, [5.8, 4.3, 2.8, 1.3][d], 0); await beat(tok, 450); }
  say('第一層 1、第二層 2、第三層 4、第四層 8', '1 + 2 + 4 + 8 = 15：四層剛好');
  await step(tok);                                   // @7332.8 學過哪些 log n 高度的樹？
  say('我們學過哪些高度大概 log n 的樹？', '');
  await step(tok);                                   // @7341.8 full 與 complete
  tag('full', 'ptr', -4.6, 7.2, 0); tag('complete', 'ptr alt', 4.6, 7.2, 0);
  say('到目前只學過兩種', 'full 和 complete');
  await step(tok);                                   // @7350.8 full：每層長滿；complete：full 的前幾個
  S.hl([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], BLUE);
  say('full：每一層都長得滿滿的', 'complete：像 full 的前幾個 node');
  await step(tok);                                   // @7372.8 full 的 node 數只能 1、3、7、15
  S.off();
  note('full 的 node 數：1、3、7、15…', -4.4, 0.3, 1.2);
  say('full 的 node 數量有限制', '只能是 1、3、7、15…');
  await step(tok);                                   // @7387.8 13 件待辦？沒有
  S.hl([14, 15], RED);
  say('13 件待辦怎麼辦？', '沒有 13 個 node 的 full tree');
  await step(tok);                                   // @7404.8 改用 complete binary tree
  S.rm(15); S.rm(14);
  say('改用 Complete Binary Tree', '13 個也行，高度還是 log n 級');
}]);

// 123:34 complete binary max tree：舊的 remove 會破壞 complete
FRAG.push(['heaplin-complete-break', 'Complete Max Tree：舊的 remove 會留下洞', async (tok) => {
  fresh(CAM, LOOK);
  let S = null;
  await step(tok);                                   // @7413.8 目標：Complete Binary Max Tree
  tag('目標：Complete Binary Max Tree', 'ptr alt', 0, 7.0, 0);
  say('我們要一棵 Complete Binary Max Tree', '結合兩個學過的特性');
  await step(tok);                                   // @7432.8 complete：對樹形的要求
  const G = HT({ color: () => NODEC, sz: 0.7 });
  for (let i = 1; i <= 6; i++) { G.put(i, '', 1.5); await beat(tok, 150); }
  say('complete：對樹的長相的要求', '一層一層、由左到右長');
  await step(tok);                                   // @7469.8 max tree：對 key 的要求
  tag('complete = 形狀　max tree = key', 'say', 0, 0.5, 1.5);
  say('max tree：對 key 的要求', '大的在上面，下面可以小一點');
  await step(tok);                                   // @7494.8 剛才那棵不是 complete
  fresh(CAM, LOOK);
  S = HT({ init: MAXT });
  tag('不是 complete：中間缺了位置', 'bad', 0, 7.0, 0);
  say('剛才那棵 max tree', '不是 complete binary tree');
  await step(tok);                                   // @7539.8 稍微移動，變成 complete
  S.mv(3, 5); await beat(tok, 300); S.mv(2, 3); await beat(tok, 300); S.mv(5, 2); await beat(tok, 300); S.mv(6, 5); await beat(tok, 300); S.mv(7, 6);
  say('一樣的數字，稍微移一下', '14、12、9、4、8、5');
  await step(tok);                                   // @7583.8 檢查：符合 complete
  S.hl([1, 2, 3, 4, 5, 6], GREEN);
  say('幫我檢查一下', '符合 complete binary tree 的性質');
  await step(tok);                                   // @7596.8 用剛才的演算法：14 辭職
  S.off(); S.rm(1);
  say('用剛才的演算法 remove largest', '14 號辭職了');
  await step(tok);                                   // @7604.8 12 和 9 打一架，12 補位
  S.hl([2, 3], GOLD); await beat(tok, 600);
  S.off(); S.mv(2, 1);
  say('12 號跟 9 號打一架', '12 號上來補位');
  await step(tok);                                   // @7612 8 和 4 打一架，8 補位
  S.hl([4, 5], GOLD); await beat(tok, 600);
  S.off(); S.mv(5, 2);
  say('8 號跟 4 號打一架', '8 號上來補位');
  await step(tok);                                   // @7630.8 糟糕：不是 complete 了
  const hole = S.at(5, '洞', 'bad', 0);
  say('跑完以後：糟糕了', '不再是 complete binary tree');
  await step(tok);                                   // @7647.8 把 5 拉過來補洞
  kill(hole); S.hl([6], GOLD); S.mv(6, 5);
  say('想維持 complete：把 5 拉過來補', '5 比 8 小，這次剛好沒事');
  await step(tok);                                   // @7677.8 如果那個數是 8.5？
  relabel(S.m[5], 8.5); S.v[5] = 8.5; tint(S.m[5], col(8.5)); S.off(); S.hl([5], RED);
  say('可是如果被拉過來的是 8.5 呢？', '（原本在 9 底下是好好的）');
  await step(tok);                                   // @7701.8 complete 了卻丟掉 max 性質
  S.hl([2], BLUE);
  say('8 壓不住 8.5', '滿足了 complete，卻丟掉 max 性質');
  await step(tok);                                   // @7722.8 維護很麻煩
  note('remove 不再只走一條路：還要回頭揉捏調整', 0, 0.4, 1.4);
  say('還要再做調整', '維護的力氣變很大，不好做');
}]);

// 130:11 新的 remove largest：最後一個上 root 當代理主席，再往下換
FRAG.push(['heaplin-remove-last', 'Max Heap 的 remove：最後一個上 root，再往下換', async (tok) => {
  fresh(CAM, LOOK);
  const S = HT({ init: CMAX });
  await step(tok);                                   // @7811.8 換個方式：先維持 complete
  sayT('換個想法：先顧 complete', 0, 7.0, 0);
  say('缺位時，乾脆先維持 complete', '14 12 9 4 8 8.5');
  await step(tok);                                   // @7842.8 有 node 要離開時，讓最尾巴的補上來
  S.hl([6], GOLD);
  say('有 node 要離開時', '先讓最尾巴的 node 補上來');
  await step(tok);                                   // @7873.8 最後一個 node 注定要被移掉
  S.hl([1], RED); await beat(tok, 500);
  S.rm(1);
  say('拿走 root 時，complete 的順序裡', '最後那個 node 注定要被移掉');
  await step(tok);                                   // @7887.8 叫它先上去當代理主席
  S.off(); S.mv(6, 1); S.hl([1], GOLD);
  const actg = S.at(1, '代理主席', 'pkt', 0.85);
  say('那就叫它先上去撐著', '8.5 = 代理主席');
  await step(tok);                                   // @7920.8 8.5、12、9：12 最大 → 換
  S.hl([2, 3], BLUE); await beat(tok, 700);
  S.off(); kill(actg); S.sw(1, 2);
  say('8.5、12、9 哪個大？12', '壓不住 → 12 換上來，8.5 下去');
  await step(tok);                                   // @7942.8 12 是三個裡最大的，夠格當領導
  S.hl([1], GREEN);
  say('12 是三個裡最大的', '它壓得住 9 那邊，也壓得住原本的 subtree');
  await step(tok);                                   // @7965.8 8.5 對 4、8：壓得住，停
  S.off(); S.hl([2], GOLD); S.hl([4, 5], BLUE);
  say('8.5 繼續檢查：下面是 4 和 8', '壓得住 → 安安穩穩停在這');
  await step(tok);                                   // @7982.8 remove largest 改成兩步
  S.off();
  const cd = code(['remove largest:', '1. 最後一個放到 root', '2. 壓不住就往下換'], -4.4, 1.6, 0.5, 1.5);
  say('remove largest 改成兩個步驟', '1. last → root　2. 往下換');
  await step(tok);                                   // @8027.8 最多換 h 層；complete 的 h = O(log n)
  for (const i of [1, 2, 4]) { S.hl([i], GOLD); await beat(tok, 350); }
  say('最多往下換幾層？樹有多高就幾層', 'complete tree：h = O(log n)');
  await step(tok);                                   // @8049.8 維持 complete 也維持 max
  S.off(); S.hl([1, 2, 3, 4, 5], GREEN);
  say('第一：維持了 complete', '第二：維持了 max tree');
  await step(tok);                                   // @8105.8 Complete Max Tree = Heap
  S.off(); cd.kill();
  tag('Complete ＋ Max Tree = Max Heap', 'ptr alt', 0, 0.5, 1.5);
  say('Complete Max Tree', '就是大家說的 Heap（Max Heap）');
}]);

// 135:53 insert 17：放最後，再往上浮
FRAG.push(['heaplin-insert-17', 'Max Heap 的 insert 17：放最後，再往上浮', async (tok) => {
  fresh(CAM, LOOK);
  const S = HT({ init: CMAX });
  await step(tok);                                   // @8153.8 那 insertion 怎麼辦？
  const st = buddy('同學', '?', '#7cb8ee', -5.8, 0, 1.6, 0.7); st.mood('wow');
  say('同學：你只講了 removal', '那 insertion 怎麼辦？');
  await step(tok);                                   // @8169.8 比較難維護的是 complete
  sayT('難維護的是 complete → 先顧它', 0, 7.0, 0);
  say('觀念一樣', '比較難維護的是 complete，先顧它');
  await step(tok);                                   // @8189.8 目前的 heap：14 12 9 4 8 8.5
  S.hl([1, 2, 3, 4, 5, 6], BLUE);
  say('目前 heap 的長相', '14 12 9 4 8 8.5');
  await step(tok);                                   // @8202.8 放在下一個位置：17
  S.off();
  S.put(7, 17, 3); S.hl([7], GOLD);
  say('為了 complete，放在下一個空位', 'insert 17：從基層做起');
  await step(tok);                                   // @8220.8 9 壓得住 8.5，壓不住 17
  S.hl([3], BLUE); S.hl([6], GREEN);
  say('檢查 max 性質', '9 壓得住 8.5，壓不住 17');
  await step(tok);                                   // @8231.8 17 上來、9 下去
  S.off(); S.sw(7, 3);
  say('勝者為王', '17 上來、9 下去');
  await step(tok);                                   // @8244.8 9 下去一定壓得住；17 壓得住兩邊
  S.hl([7], GREEN); S.hl([3], GOLD);
  say('9 本來就是那裡最大的，下去一定壓得住', '17 也壓得住左右兩邊');
  await step(tok);                                   // @8262.8 面對 parent 14 的挑戰
  S.off(); S.hl([3], GOLD); S.hl([1], BLUE);
  say('接著挑戰 parent', '14 壓得住 17 嗎？壓不住');
  await step(tok);                                   // @8280.8 17 再浮上去、14 下來
  S.off(); S.sw(3, 1); st.mood('happy');
  say('17 再浮上去', '14 下來');
  await step(tok);                                   // @8289.8 從基層一路浮到適合的位置
  S.hl([1], GREEN);
  say('有能力的人從基層一路浮上去', '浮到 heap 裡適合它的位置');
  await step(tok);                                   // @8299.8 insert at last，再 float up
  S.off();
  code(['insert:', '1. insert at last', '2. float up'], -4.4, 1.6, 0.5, 1.5);
  say('insertion：1. insert at last', '2. float up');
  await step(tok);                                   // @8314.8 要花 h 的力氣
  for (const i of [7, 3, 1]) { S.hl([i], GOLD); await beat(tok, 350); }
  say('一樣要花 h 的力氣', '每一層都打敗，最壞爬到最上面');
  await step(tok);                                   // @8335.8 insert、remove 都跟高度有關：log n
  S.off();
  tag('insert、remove：O(log n)', 'ptr alt', 0, 0.5, 1.5);
  say('insert、remove 都跟樹高有關', 'complete tree 的高度 = log n');
}]);

// 139:27 complete tree 放進 array：partially ordered array
FRAG.push(['heaplin-partial-array', 'Heap = partially ordered array', async (tok) => {
  fresh([0, 4.6, 14], [0, 2.8, 1]);
  const S = HT({ init: CMAX, ly: [6.0, 4.6, 3.2] });
  let R = null;
  await step(tok);                                   // @8366.8 complete binary tree 跟 array 有對應
  sayT('complete binary tree ↔ array', 0, 7.2, 0);
  say('上次講過：complete binary tree', '跟 array 有對應的關係');
  await step(tok);                                   // @8382.8 node 編號 = index
  [1, 2, 3, 4, 5, 6].forEach((i) => S.at(i, String(i), 'idx', 0.7));
  say('每個 node 可以編號', '編號就對應到 array 的 index');
  await step(tok);                                   // @8397.8 不用小紙條
  S.hl([2], GOLD); S.hl([4, 5], BLUE);
  say('不用真的寫小紙條（pointer）', '2 的孩子一定在 4、5');
  await step(tok);                                   // @8414.8 以前的 ordered array
  S.off();
  const oa = note('以前：ordered array = 全部排好', -4.6, 1.8, 1.0);
  say('以前學的 ordered array', '東西通通從小排到大');
  await step(tok);                                   // @8429.8 heap → partially ordered array
  txt(oa, '現在：heap = partially ordered array');
  say('heap 是 complete tree 的特化版', '得到一個 partially ordered array');
  await step(tok);                                   // @8466.8 寫下來：14 12 9 4 8 8.5
  kill(oa);
  R = ROW([], { dx: 1.3, z: 3, n: 6 });
  for (let i = 1; i <= 6; i++) { R.set(i, S.v[i], 1.5); S.hl([i], GOLD); await beat(tok, 300); S.hl([i], null); }
  say('寫下來就是：14 12 9 4 8 8.5', '照編號放進 array');
  await step(tok);                                   // @8487.8 沒有從大排到小
  R.hl([3, 4, 5, 6], RED);
  say('這個 array 看起來沒有排好', '9 4 8 8.5：不是從大到小，也不是從小到大');
  await step(tok);                                   // @8496.8 亂中有序
  R.off(); S.hl([1], GREEN); S.hl([2, 4, 5], GOLD); S.hl([3, 6], BLUE);
  say('亂中有序：畫成 complete tree', '每個 subtree 最大的都在上面');
  await step(tok);                                   // @8505.8 array 裡不一定看得出來
  S.off();
  say('但只看 array', '不一定看得出這個關係');
}]);

// 142:01 selection sort on array vs on heap → heap sort
FRAG.push(['heaplin-selection-vs-heap', 'Selection Sort：在 array 上 vs 在 heap 上', async (tok) => {
  fresh([0, 4.6, 14], [0, 2.6, 1]);
  const R = ROW([9, 4, 14, 8.5, 12, 8], { dx: 1.2, z: 2.6, x0: -3.2 });
  let S = null;
  await step(tok);                                   // @8528 第一個學的 sorting：selection sort
  sayT('selection sort on array', -3.2, 1.4, 2.6);
  say('第一個學的 sorting 是 selection sort', '左：一個亂的 array（示意）');
  await step(tok);                                   // @8538.8 每次找最大的放後面
  R.hl([3], GOLD);
  say('每次去 array 裡找最大的', '放到後面，一直重複');
  await step(tok);                                   // @8568.8 n 輪 × 每輪 n → O(n²)
  R.off();
  const cu = tag('▼', 'ptr alt', 0, -5, 0);
  for (let i = 1; i <= 6; i++) { cu.position.set(R.X(i), 1.0, 2.6); R.off(); R.hl([i], GOLD); await beat(tok, 300); }
  R.off(); kill(cu);
  say('每輪都要全部看過：n', 'n 輪 × n = O(n²)');
  await step(tok);                                   // @8607.8 selection sort on heap
  S = HT({ init: CMAX, w: 4.6, x0: 4.2, sz: 0.65, ly: [5.6, 4.4, 3.2] });
  tag('selection sort on heap', 'ptr alt', 4.2, 6.6, 0);
  say('有了 heap：selection sort on heap', '也就是 partially ordered array');
  await step(tok);                                   // @8626.8 找最大只要 constant
  S.hl([1], GREEN);
  say('找最大很簡單', '看 root：constant 時間');
  await step(tok);                                   // @8649.8 拿走以後要維護：log n
  S.hl([2, 4], GOLD);
  say('但找到還要拿出來，heap 要維護', '剛才的 remove largest：log n');
  await step(tok);                                   // @8673.8 只要 n log n
  S.off();
  say('每找一次變快了', '排序部分：n log n');
  await step(tok);                                   // @8698.8 array 要先有 heap 的長相
  note('前提：array 要先有 heap 的長相', 0, 0.2, 2.6);
  say('注意：array 必須先是 heap', '完全散亂的不行');
  await step(tok);                                   // @8763.8 先建好 heap 要花多少力氣？
  say('剩下一件事：先建好 heap', '這要花多少力氣？');
  await step(tok);                                   // @8799.8 n 次 insertion：n log n
  for (let i = 1; i <= 6; i++) { R.hl([i], BLUE); await beat(tok, 200); }
  R.off();
  say('至少可以用 n 次 insertion', '每次 log n → n log n');
  await step(tok);                                   // @8848.8 兩段合起來 n log n
  tag('build：n log n ＋ sort：n log n', 'pkt', 0, 7.2, 0);
  say('unordered → heap：n log n', 'heap → 排好：n log n，合起來 n log n');
  await step(tok);                                   // @8870.8 這叫 heap sort
  tag('heap sort：從 n² 進步到 n log n', 'ptr alt', 0, 6.5, 0);
  say('先整理成 heap，再做 n 次 remove largest', '這個過程叫 heap sort');
}]);

// 148:24 同一塊記憶體：heap 區與 array 區
FRAG.push(['heaplin-inplace', 'Heap Sort 不用另外蓋樹：同一個 array 分兩區', async (tok) => {
  fresh([0, 3.6, 11], [0, 1, 1]);
  const R = ROW([9, 4, 14, 8.5, 12, 8], { dx: 1.5, z: 1 });
  const n = 6;
  const bar = tag('┃', 'ptr', 0, 0.9, 1);
  const hT = tag('heap 區', 'ptr alt', 0, 1.7, 1), aT = tag('array 區', 'idx', 0, 1.7, 1);
  showL(bar, false); showL(hT, false); showL(aT, false);
  const setBar = (k, sorted) => {
    bar.position.set(R.X(k) + 0.75, 0.9, 1);
    hT.position.set(k ? (R.X(1) + R.X(k)) / 2 : -6, 1.7, 1);
    aT.position.set(k < n ? (R.X(k + 1) + R.X(n)) / 2 : 6, 1.7, 1); txt(aT, sorted ? '排好的 array 區' : 'array 區');
  };
  const sift = async (k, ms) => { let i = k; while (i > 1 && R.v[i] > R.v[i >> 1]) { R.sw(i, i >> 1); await beat(tok, ms); i >>= 1; } };
  const extract = async (end, ms) => {
    R.sw(1, end); await beat(tok, ms); tint(R.m[end], GRAY);
    let i = 1;
    for (;;) { const l = 2 * i, r = l + 1; let c = i; if (l <= end - 1 && R.v[l] > R.v[c]) c = l; if (r <= end - 1 && R.v[r] > R.v[c]) c = r; if (c === i) break; R.sw(i, c); await beat(tok, ms); i = c; }
    setBar(end - 1, true);
  };
  await step(tok);                                   // @8904.8 補充一：build heap 有更快的方法
  note('補充：build heap 有比 n 次 insert 更快的方法（課本）', 0, 3.4, -0.5);
  say('補充一：不用笨笨做 n 次 insertion', '有更快的 build 方法，課本上有');
  await step(tok);                                   // @8933.8 heap 就是 partially ordered array
  say('heap 就是 partially ordered array', '不用另外 build 一個 heap');
  await step(tok);                                   // @8961.8 分成 array 區與 heap 區
  showL(bar, true); showL(hT, true); showL(aT, true); setBar(0, false);
  say('原來的 array 分成兩區', 'heap 區一開始是空的');
  await step(tok);                                   // @8973.8 從 array 區一個一個塞進 heap 區
  for (let k = 1; k <= 3; k++) { setBar(k, false); R.hl([k], GOLD); await beat(tok, 250); await sift(k, 250); R.off(); }
  say('從 array 區一個一個塞入 heap 區', '= n 個 insertion');
  await step(tok);                                   // @8997.8 heap 區變大、array 區變小
  for (let k = 4; k <= n; k++) { setBar(k, false); await beat(tok, 200); await sift(k, 220); }
  say('array 區慢慢變小、heap 區慢慢變大', '最後整段都是 heap');
  await step(tok);                                   // @9015.8 每拿一個出來，heap 區就縮小
  R.hl([1], GREEN);
  say('要排序：每拿一個東西出來', 'heap 區就縮小一格');
  await step(tok);                                   // @9032.8 最大的放到後面沒人用的位置
  R.off(); await extract(n, 350);
  say('從 heap 拿最大的', '放到後面沒有人用的位置');
  await step(tok);                                   // @9039.8 array 區又一路擴大
  for (let end = n - 1; end >= 2; end--) await extract(end, 130);
  tint(R.m[1], GRAY); setBar(0, true);
  say('array 區又一路擴大', '最後得到排好的 array');
  await step(tok);                                   // @9049.8 同一塊記憶體完成
  say('全部在同一塊記憶體完成', '只是把 array 假裝成 complete tree');
  await step(tok);                                   // @9093.8 improved selection sort
  tag('heap sort = improved selection sort', 'ptr alt', 0, 2.6, 1);
  say('兩步都在 n log n 內完成', '可以想成 improved selection sort');
}]);

// 152:59 最後一個 node 在哪：存 node 數就知道
FRAG.push(['heaplin-last-node', '下一個插入點：第 n + 1 格', async (tok) => {
  fresh([0, 4.2, 13.5], [0, 3.2, 0]);
  const S = HT({ w: 11, sz: 0.65, color: () => NODEC });
  for (let i = 1; i <= 10; i++) S.put(i, i);
  await step(tok);                                   // @9180 只有一個孩子也還是 complete
  S.hl([5, 10], GOLD);
  say('有 node 只有一個孩子（像這裡的 5 號），也還是 complete', '重點是：上到下、左到右的順序完整');
  await step(tok);                                   // @9236.8 關鍵步驟都不難
  S.off();
  const rc = note('root 最好找 → 最大放 root → subtree 也一樣 → 限制 complete', 0, 7.2, 0);
  say('今天的關鍵步驟都不難', '我們不一定想不到');
  await step(tok);                                   // @9312.8 insert 時怎麼知道最後一個 node？
  kill(rc);
  const st = buddy('同學', '?', '#7cb8ee', -5.8, 0, 1.6, 0.7); st.mood('wow');
  say('同學問：insert 時', '怎麼知道最後一個節點在哪？');
  await step(tok);                                   // @9332.8 只要記 node 數
  tag('n = 10', 'pkt', -4.6, 6.6, 0);
  say('放在 array 裡的話很簡單', '只要記 tree 裡 node 的數量');
  await step(tok);                                   // @9337.8 已有 10 個 → 放第 11 個
  S.put(11, 11, 3, '#e2b84b'); st.mood('happy');
  say('已經有 10 個 node', '新的資料一定放第 11 個');
  await step(tok);                                   // @9356.8 tree 實作要多一個指標
  note('用 tree 實作：要多維護一個指標', 4.4, 0.4, 1.2);
  say('如果真的用 tree 實作', '要多維護一個「下一個插入點」的指標');
  await step(tok);                                   // @9387.8 兄弟、爸爸都藏在 index 裡
  S.hl([11], GOLD); S.hl([10], BLUE); S.hl([5], GREEN);
  say('兄弟姊妹、爸爸媽媽在哪', '都藏在 index 裡');
  await step(tok);                                   // @9414.8 insertion 要往上走：parent
  const up = S.at(11, '↑ parent = ⌊11/2⌋ = 5', 'pkt', 0.8);
  say('insertion 要往上走，要知道 parent', '往上、往下都只是 index 運算');
  await step(tok);                                   // @9440.8 一直往右丟會退化成 list？不會
  kill(up); S.off();
  say('一直往最右邊丟，會退化成 list 嗎？', '不會：heap 是 complete');
  await step(tok);                                   // @9480.8 node 數轉二進位找路徑
  const bin = tag('11 = 1011₂', 'ptr alt', -4.6, 5.8, 0);
  for (const i of [1, 2, 5, 11]) { S.hl([i], GOLD); await beat(tok, 450); }
  say('也可以把 node 數轉成二進位找路徑', '1 = root，0 → 左，1 → 右，1 → 右');
  await step(tok);                                   // @9511.8 selection on heap：O(1) ＋ O(log n)
  S.off(); kill(bin);
  say('selection sort on heap 每輪', 'O(1) ＋ O(log n)：是加，不是乘');
  await step(tok);                                   // @9544.8 tree 的概念 ＋ array 的結構
  tag('heap = tree 的概念 ＋ array 的結構', 'ptr alt', 0, 0.3, 1.5);
  say('heap：用 tree 的概念理解', '用 array 的結構實作');
}]);

// 160:12 Priority Queue 實作的 trade-off
FRAG.push(['heaplin-pq-tradeoff', 'Priority Queue 的 trade-off：heap vs linked list', async (tok) => {
  fresh([0, 4.2, 13], [0, 2.4, 0]);
  const tb = code(['                insert     remove largest', 'heap            O(log n)   O(log n)', 'max tree        O(h)       O(h)', '無序 list       O(1)       O(n)', '有序 list       O(n)       O(1)'], 0, 5.8, 0.56);
  hideAll(tb);
  const X = (k) => -5.2 + k * 2.0;
  let G = [];
  await step(tok);                                   // @9611.8 新學的 heap 實現 priority queue
  reveal(tb, 0);
  say('新學的 data structure：heap', '用它實現 priority queue');
  await step(tok);                                   // @9619.8 拿最高的、放任意的
  say('拿出最高 priority 的', '放入任意 priority 的');
  await step(tok);                                   // @9639.8 兩種操作的 trade-off
  tb.hl(0);
  say('priority queue 有兩種操作', 'insertion 和 remove largest');
  await step(tok);                                   // @9656.8 heap remove largest：log n
  reveal(tb, 1); tb.hl(1);
  say('heap 的 remove largest：log n', '最後一個叫上來，再滑下去');
  await step(tok);                                   // @9677.8 insertion：放最後，浮上去；都是 log n
  say('insertion：放最後一個位置，再浮上去', '都是 complete，所以都 log n');
  await step(tok);                                   // @9694.8 max tree：O(h)
  reveal(tb, 2); tb.hl(2);
  say('不是 complete 的 max tree', 'log n 變成 O(h)：跟樹高有關');
  await step(tok);                                   // @9723.8 無序 linked list：insert 很簡單
  G = [8, 14, 9, 12].map((v, k) => lnode(v, X(k), 0.4, 0, col(v)));
  G.push(lnode(8.5, X(4), 0.4, 0, col(8.5)));
  reveal(tb, 3); tb.hl(3);
  say('用 linked list、不管順序', 'insert 隨便塞：很簡單');
  await step(tok);                                   // @9757.8 找最大並移掉：O(n)
  const cu = tag('▼', 'ptr alt', 0, -5, 0);
  for (let k = 0; k < G.length; k++) { cu.position.set(X(k), 1.2, 0); glow(G[k].userData.data, GOLD); await beat(tok, 280); glow(G[k].userData.data, null); }
  kill(cu); fly(G[1], V3(-3, 6, 3)); G.splice(1, 1);
  say('可是要找到最大的並移掉', '要看完全部：O(n)');
  await step(tok);                                   // @9779.8 從大到小排：最大在 head
  G.forEach((g) => kill(g));
  G = [12, 9, 8.5, 8].map((v, k) => lnode(v, X(k), 0.4, 0, col(v)));
  tag('head', 'ptr', X(0), 1.3, 0);
  reveal(tb, 4); tb.hl(4);
  say('不然把它從大排到小', 'linked list 的入口是 head：最大的放 head');
  await step(tok);                                   // @9801.8 remove head 容易；insert 要找位置 O(n)
  glow(G[0].userData.data, RED); await beat(tok, 500);
  fly(G[0], V3(-3, 6, 3)); G = G.slice(1);
  const c2 = tag('insert 4：一路找位置', 'pkt', X(1), 1.4, 0);
  await travel(tok, c2, V3(X(1), 1.4, 0), V3(X(3), 1.4, 0), 900);
  lnode(4, X(4), 0.4, 0, col(4));
  say('remove head 很容易', '可是 insert 要找位置：最壞 O(n)');
  await step(tok);                                   // @9820.8 第一次完整看到 trade-off
  kill(c2); tb.hl(-1);
  say('第一次比較完整地看到 trade-off', '哪個操作用得多、哪個用得少？');
  await step(tok);                                   // @9853.8 整理多花一點力氣 → 某些地方比較快
  tb.hl(1);
  say('整理多花一點力氣', '某些地方就會 efficient 一點');
  await step(tok);                                   // @9884.8 課本用 min heap
  tb.hl(-1);
  note('課本：min heap（最小的放上面），觀念相同', 0, 6.8, 0);
  say('課本用的是 min heap', '最小的放最上面，觀念相對應');
  await step(tok);                                   // @9910.8 STL priority_queue = heap on vector
  tag('STL priority_queue = heap on vector', 'ptr alt', 0, 2.2, 1.0);
  say('STL 也有 priority_queue', '實作就是 heap on vector（array）');
}]);
  }

  // ═══ heapur.js ═══
  {
// ─── 4tSdhWBVv6A：Priority Queue, Binary Heap（Lec 24a，Urdu/Hindi）— cued：每個 step(tok) 等講者說到那一句 ───
// 只用 K 與 ctx。陣列 1-based（講者：root 放 index 1，不放 0）。
// 第一棵（非 complete）heap 的形狀依講者唸到的數字 3、7、12、9、15、33、19、32、58、99、88、31、36 重建；
// complete heap 的例子（12、15、17、32、36）同樣依可辨識的數字重建，其他數值為示意。
// (2,x) 的例子：講者移除 (2,0) 後唸出 (2,1)、(2,3)、(2,6)、(2,4)、(2,2)、(2,5)（前序），對應 (2,0)…(2,6) 依序放的 heap。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, line, anim, travel, remove, step, buddy, prop, bob, GOLD, GREEN, RED, GRAY } = K;
const say = ctx.say, beat = ctx.beat, colorFor = ctx.colorFor;
const BLUE = '#1f3a6e';
const UY = [7.0, 5.6, 4.2, 2.8, 1.4];
const UCAM = [0, 5.2, 16], ULOOK = [0, 3.6, 1];
const ulv = (i) => Math.floor(Math.log2(i));
const pLess = (a, b) => (a[0] !== b[0] ? a[0] < b[0] : a[1] < b[1]);
const pShow = (p) => '(' + p[0] + ',' + p[1] + ')';
const PCOL = ['#c94a3a', '#2fc092', '#4b9ee2', '#e0a030', '#8a63c9', '#3fb6b0', '#d0688f'];
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const sayT = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
// 小角色走到 (x, z)
const walk = (tok, b, x, z, ms = 800) => { const a = b.g.position.clone(), e = V3(x, a.y, z); return anim(tok, ms, (u) => b.g.position.lerpVectors(a, e, u)); };
const bye = (b) => { b.g.parent && b.g.parent.remove(b.g); if (b.name) remove(b.name); remove(b.val); };

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
  // 拿走 root（只拿走，不補）
  S.take = (i = 1) => { if (S.nd[i]) fly(S.nd[i]); if (S.cl[i]) fly(S.cl[i], V3(0, 6, 5)); S.nd[i] = null; S.cl[i] = null; S.a[i] = null; };
  const LT = min ? '<' : '>', GE = min ? '≥' : '≤', BIG = min ? '小' : '大';
  S.up = async (tok, i, ms = 700) => {
    let n = 0;
    while (i > 1) {
      const p = i >> 1; S.off(); S.hl([i], GOLD); S.hl([p], BLUE);
      if (!better(S.a[i], S.a[p])) { say(show(S.a[i]) + ' ' + GE + ' ' + show(S.a[p]) + '：停住', 'parent = ⌊' + i + '/2⌋ = ' + p); await beat(tok, ms * 0.6); break; }
      say(show(S.a[i]) + ' ' + LT + ' ' + show(S.a[p]) + '：往上換', 'parent = ⌊' + i + '/2⌋ = ' + p);
      await beat(tok, ms * 0.5);
      await S.sw(tok, i, p, ms); i = p; n++;
    }
    S.off(); return n;
  };
  S.down = async (tok, i, ms = 600) => {
    let n = 0;
    while (S.has(2 * i)) {
      const l = 2 * i, r = l + 1, two = S.has(r); let c = l; if (two && better(S.a[r], S.a[l])) c = r;
      S.off(); S.hl([i], GOLD); S.hl(two ? [l, r] : [l], BLUE);
      if (!better(S.a[c], S.a[i])) { say(show(S.a[i]) + ' 已經比孩子' + BIG + '：停', '停在 [' + i + ']'); await beat(tok, ms * 0.6); break; }
      say(show(S.a[c]) + ' 往上、' + show(S.a[i]) + ' 往下', 'A[' + i + '] ↔ A[' + c + ']');
      await beat(tok, ms * 0.5);
      await S.sw(tok, i, c, ms); i = c; n++;
    }
    S.off(); return n;
  };
  // 非 complete 的舊做法：拿走 root，較小的孩子一路補上來（洞留在底部）— 快速版
  S.promote = async (tok, ms = 200) => {
    S.take(1); let i = 1;
    while (S.has(2 * i) || S.has(2 * i + 1)) {
      const l = 2 * i, r = l + 1; let c;
      if (S.has(l) && S.has(r)) c = better(S.a[r], S.a[l]) ? r : l; else c = S.has(l) ? l : r;
      S.mv(c, i); await beat(tok, ms); i = c;
    }
    return i;
  };
  // complete heap：最後一個搬到 root（不沉）
  S.lastUp = () => { const n = S.size; if (n > 1) { S.mv(n, 1); if (S.ed[n]) { kill(S.ed[n]); S.ed[n] = null; } } S.size = n - 1; };
  return S;
}

// 第一棵 heap（非 complete）：index → 值
const UR_T1 = [];
[[1, 3], [2, 7], [3, 12], [4, 9], [5, 99], [6, 15], [7, 31], [8, 33], [9, 19], [12, 32], [13, 58], [14, 88], [18, 36]].forEach(([i, v]) => { UR_T1[i - 1] = v; });
const UR_C0 = [12, 17, 32, 36, 33, 52, 58];          // complete heap（push 15 之前）
const UR_C1 = [12, 15, 32, 17, 33, 52, 58, 36];      // push 15 之後
const UR_C2 = [15, 17, 32, 36, 33, 52, 58];          // pop 12 之後
const UR_P0 = [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6]];
const urSet = (S) => S.a.filter((v) => v !== null && v !== undefined);
const popPlain = (h) => { const last = h.pop(); if (!h.length) return; h[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let c = l; if (l >= h.length) break; if (r < h.length && pLess(h[r], h[l])) c = r; if (!pLess(h[c], h[i])) break; [h[c], h[i]] = [h[i], h[c]]; i = c; } };

// 00:59 回顧：明確順序 → 加限制 → search tree
FRAG.push(['heapur-recap', '回顧：array/list → stack/queue → search tree', async (tok) => {
  fresh([0, 4.5, 14], [0, 2.4, 0]);
  await step(tok);                                   // 0:59 array、list：explicit linear ordering
  const vals = [10, 20, 30, 40, 50];
  const cs = vals.map((v, k) => cube(v, colorFor(v), [0.9, 0.9, 0.9], -5.6 + k * 1.1, 0.45, 0, 3));
  const lbl = sayT('array / list：一個接一個', -3.4, 1.6, 0);
  say('array、list：明確的線性順序', 'explicit linear ordering');
  await step(tok);                                   // 1:14 加限制，實作不變
  const rule = note('實作不變，只加「規則」', -3.4, 2.4, 0);
  say('在上面加一些限制', '底層還是 array / list');
  await step(tok);                                   // 1:28 stack：只能從 top push / pop
  kill(lbl); kill(rule);
  cs.forEach((c, k) => move(c, -6, 0.45 + k * 0.95, 0));
  tag('top', 'ptr alt', -6, 5.3, 0);
  sayT('stack', -6, -0.2, 0.8);
  say('stack：只能從 top push、pop', '加上限制的 array / list');
  await beat(tok, 900);
  await step(tok);                                   // 1:31 queue：一邊進一邊出；違反就不是它了
  const q = [1, 2, 3].map((v, k) => cube(v, colorFor(v), [0.8, 0.8, 0.8], -4.0 + k * 1.0, 0.4, 0, 2));
  sayT('queue：右邊進、左邊出', -3.0, 1.5, 0);
  const nw = cube(4, colorFor(4), [0.8, 0.8, 0.8], -0.5, 0.4, 0, 2);
  await beat(tok, 700);
  fly(q[0], V3(-6, 3, 2)); q.slice(1).concat([nw]).forEach((c, k) => move(c, -4.0 + k * 1.0, 0.4, 0));
  tag('從中間拿 → 就不是 queue 了', 'bad', -3.0, 2.3, 0);
  say('queue：一邊進、另一邊出', '違反限制 = 沒照它的用途在用');
  await beat(tok, 900);
  await step(tok);                                   // 2:01 tree：順序是隱含的
  const bst = [[30, 3.8, 5.0], [20, 2.5, 3.4], [40, 5.1, 3.4], [10, 1.7, 1.8], [50, 5.9, 1.8]];
  const ns = bst.map(([v, x, y]) => cube(v, colorFor(v), [0.8, 0.8, 0.8], x, y, 0, 2));
  line(3.8, 5.0, 2.5, 3.4); line(3.8, 5.0, 5.1, 3.4); line(2.5, 3.4, 1.7, 1.8); line(5.1, 3.4, 5.9, 1.8);
  sayT('tree：順序藏在「怎麼走」裡', 3.8, 6.2, 0);
  say('tree：順序是隱含的', '看你用哪一種 traversal');
  await step(tok);                                   // 2:31 search tree：log n
  for (const k of [0, 1, 3]) { glow(ns[k], GOLD); await beat(tok, 350); }
  say('search tree：操作是 O(h)，平衡時 O(log n)', '找最小要往左走到底');
  await step(tok);                                   // 2:46 再加限制：拿最優先的變常數時間
  [0, 1].forEach((k) => glow(ns[k], null)); glow(ns[3], GREEN);
  const want = tag('想要：拿「最優先」的只要 O(1)', 'pkt', 3.8, 0.5, 1.2);
  await travel(tok, want, V3(3.8, 0.4, 1.2), V3(3.4, 0.6, 1.2), 500);
  say('整體還是 log n，但拿最優先的 = 常數', '→ priority queue');
}]);

// 03:24 priority queue：不是先來先服務
FRAG.push(['heapur-pq-line', 'Priority Queue：數字越小越優先', async (tok) => {
  fresh([0, 4, 12.5], [0, 1.2, 0]);
  const X = (k) => -5 + k * 1.45;
  const cols = ['#7cb8ee', '#9fd39a', '#f4c27a', '#c9a6e8'];
  const ppl = cols.map((c, k) => ({ b: buddy('', '', c, X(k), 0, 0, 0.8), p: [2, 3, 1, 3][k] }));
  tag('front', 'ptr', X(0), 2.2, 0);
  say('排隊：先來先服務', 'FIFO');
  await step(tok);                                   // 3:24 有人像王子一樣插到前面
  const prince = buddy('王子', '', '#e8cf8a', 6, 0, 0, 0.8);
  await Promise.all([walk(tok, prince, X(0), 1.4, 900), ...ppl.map((e) => { e.b.mood('sad'); return Promise.resolve(); })]);
  const unfair = tag('插隊！大家不開心', 'bad', X(0), 2.9, 1.4);
  say('有人直接插到最前面', '平常這是不公平的');
  await step(tok);                                   // 3:52 但有些情況真的需要 priority
  kill(unfair); await walk(tok, prince, 7, 1.4, 700); bye(prince);
  ppl.forEach((e) => e.b.mood('calm'));
  sayT('可是有時候，真的需要「優先」', 0, 3.0, 0);
  say('但有些情況確實需要 priority', '優先權');
  await step(tok);                                   // 4:03 救護車來了
  const amb = buddy('救護車', '', '#e86a5a', 6.2, 0, 0, 0.8);
  await walk(tok, amb, 5.0, 0, 600);
  amb.mood('wow');
  say('一排車塞住，救護車來了', '大家會讓它先過');
  await step(tok);                                   // 4:14 人道考量：讓它先過
  await Promise.all([walk(tok, amb, X(0), 1.4, 1000), ...ppl.map((e, k) => walk(tok, e.b, X(k + 1), 0, 1000))]);
  await walk(tok, amb, X(0), 0, 400);
  ppl.forEach((e) => e.b.mood('happy'));
  tag('讓它先過 ✓', 'good', X(0), 2.4, 0);
  say('出於人道：讓救護車先走', '這時候插隊是應該的');
  const all = [{ b: amb, p: 0 }, ...ppl];
  await step(tok);                                   // 4:32 給每個東西加上權重
  const qs = all.map((e, k) => note('權重？', X(k), 1.75, 0));
  say('做法：幫每個元素加上權重', 'weight = priority');
  await step(tok);                                   // 5:26 用數字表示：0 最高、1、2、3…
  qs.forEach((l, k) => txt(l, 'P' + all[k].p));
  all.forEach((e) => e.b.set(e.p));
  say('一種慣例：用數字表示 priority', '0 最高，1 次之，2、3 再低');
  await step(tok);                                   // 5:41 數字越大、優先權越低
  sayT('數字越大 → 越不急', 2.5, 3.2, 0);
  say('higher the number, lower the priority', '也可以反過來設計，看你怎麼定');
  await step(tok);                                   // 5:51 這就是 priority queue：照 priority 站
  qs.forEach((l) => remove(l));
  const sorted = all.slice().sort((a, b) => a.p - b.p);
  // whoever moves forward in the line walks in front of the others (z = 1.5), then steps back in: nobody walks through anybody
  const lane = sorted.map((e, k) => (e.b.g.position.x > X(k) + 0.1 ? 1.5 : 0));
  await Promise.all(sorted.map((e, k) => walk(tok, e.b, X(k), lane[k], 900)));
  await Promise.all(sorted.map((e, k) => (lane[k] ? walk(tok, e.b, X(k), 0, 300) : Promise.resolve())));
  say('照 priority 排好的 queue', '= priority queue');
  await step(tok);                                   // 5:56 top 不是最先來的，是最優先的
  sorted[0].b.glow(GOLD); await sorted[0].b.hop(tok);
  tag('top = 最優先的（不是最早來的）', 'pkt', X(0), 2.4, 0);
  say('top：priority 最高的那個', '依序往下是 priority 較低的');
  await step(tok);                                   // 6:05 插入也照 priority，不是排最後
  const nb = buddy('新來的', 1, '#8fd6cf', 6.4, 0, 0, 0.8);
  await walk(tok, nb, 4.4, 0, 500);
  const pos = sorted.findIndex((e) => e.p > 1);
  await Promise.all(sorted.slice(pos).map((e, k) => walk(tok, e.b, X(pos + k + 1), 0, 900)));
  await walk(tok, nb, X(pos), 0, 900); nb.mood('happy');
  say('插入時也照 priority 放', 'P1 站到 P1 後面，不是排到最後');
}]);

// 06:39 ordered pair：先比第一個，相同再比第二個
FRAG.push(['heapur-pairs', '多層 priority：(5,19) (13,1) (13,24) (15,0)', async (tok) => {
  fresh([0, 3.5, 12], [0, 1.2, 0]);
  const P = [[5, 19], [13, 1], [13, 24], [15, 0]];
  const xs = P.map((p, k) => -4.2 + k * 2.8);
  await step(tok);                                   // 6:39 投影片：一對一對的數字
  const ms = P.map((p, k) => cube(pShow(p), PCOL[k], [1.6, 0.9, 0.9], xs[k], 0.45, 0, 3));
  say('每個元素是一對數字', '(5,19)、(13,1)、(13,24)、(15,0)');
  await step(tok);                                   // 6:54 第一個：人的編號；第二個：priority
  sayT('(第一層, 第二層)', 0, 2.1, 0);
  say('可以想成：(某個人, 他的 priority)', '兩個數都是權重');
  await step(tok);                                   // 7:01 長者裡面生病的再更優先
  const old = buddy('長者', '', '#c9a6e8', -5.5, 0, 2.2, 0.7);
  const sick = buddy('長者＋生病', '', '#e86a5a', -3.2, 0, 2.2, 0.7); sick.mood('sad');
  await walk(tok, sick, -4.2, 2.2, 600);
  say('先看是不是長者，長者裡生病的再優先', '一層一層加上去');
  await step(tok);                                   // 7:37 原則：數字越小越優先
  bye(old); bye(sick);
  say('原則：數字越小 → priority 越高', '小 = 急');
  await step(tok);                                   // 7:48 先比第一個
  glow(ms[0], GOLD); glow(ms[1], BLUE);
  tag('5 < 13', 'pkt', (xs[0] + xs[1]) / 2, 1.5, 0);
  say('先比第一個：5 < 13', '(5,19) 優先，19 根本不用看');
  await step(tok);                                   // 7:53 第一個相等，再比第二個
  glow(ms[0], null); glow(ms[1], GOLD); glow(ms[2], BLUE);
  tag('13 = 13 → 比 1 < 24', 'pkt', (xs[1] + xs[2]) / 2, 2.6, 0);
  say('第一個相同：13 = 13', '再比第二個：1 < 24');
  await step(tok);                                   // 8:03 可以有很多層
  ms.forEach((m) => glow(m, null));
  P.forEach((p, k) => tag('#' + (k + 1), 'idx', xs[k], 1.3, 0));
  say('這樣排出來：#1 到 #4', '要幾層都可以一直加');
}]);

// 08:08 OS：系統工作 vs 使用者工作，單核 time slicing
FRAG.push(['heapur-cpu-sched', '單核 CPU：高 priority 的工作先做', async (tok) => {
  fresh([0, 4.2, 13], [0, 1.4, 0]);
  await step(tok);                                   // 8:08 real-time：task 有不同 priority 層級
  const cpu = prop('cpu', 4.2, 0, 0, 1.4, 'CPU'); bob(cpu, 0.03);
  sayT('即時系統：task 可以有不同 priority', -1.5, 3.4, 0);
  say('task 可以設定不同的 priority 層級', 'realtime、high、normal、low…');
  await step(tok);                                   // 8:42 system task 的 priority 很高
  K.zone('系統工作（你看不到）', -4.4, 0, -1.4, 4.2, 1.8, '#f3dcc0');
  K.zone('使用者工作（你看得到）', -4.4, 0, 1.4, 4.2, 1.8, '#cfe3d4');
  say('有一些 system task', 'priority 很高');
  await step(tok);                                   // 8:46 系統 clock 要 refresh
  const clock = buddy('更新時鐘', 'P0', '#e86a5a', -5.2, 0, -1.4, 0.75);
  say('例如：更新系統 clock', 'priority 0');
  await step(tok);                                   // 8:53 比滑鼠點擊的反應還高
  const mouse = buddy('滑鼠點擊', 'P2', '#7cb8ee', -5.2, 0, 1.4, 0.75);
  say('比「點滑鼠後的反應」還高', '滑鼠：priority 2');
  await step(tok);                                   // 8:57 先處理 clock
  await walk(tok, clock, 4.2, 0, 1100); clock.mood('happy'); mouse.mood('sad');
  say('CPU 先處理 clock', '滑鼠的反應晚一點');
  await step(tok);                                   // 8:59 處理器數量有限
  note('處理器只有 1、2、4 個 core', 4.2, 2.9, 0);
  say('需要 priority：因為處理器有限', '工作很多，core 很少');
  await step(tok);                                   // 9:07 假設單核
  tag('single core：一次只做一件', 'idx', 4.2, 2.2, 0);
  say('簡化：只有一個單核處理器', 'single-core');
  await step(tok);                                   // 9:12 看起來平行，其實不是
  tag('看起來同時在跑？其實沒有', 'bad', 0, 3.6, 0);
  say('感覺所有事同時在跑', '其實不是');
  await step(tok);                                   // 9:19 time slicing
  for (let k = 0; k < 2; k++) {
    await Promise.all([walk(tok, clock, 2.6, -1.4, 450), walk(tok, mouse, 4.2, 0, 450)]);
    await Promise.all([walk(tok, mouse, 2.6, 1.4, 450), walk(tok, clock, 4.2, 0, 450)]);
  }
  mouse.mood('calm');
  say('time slicing：一點時間給這個、一點給那個', '切換得很快，所以感覺不出來');
  await step(tok);                                   // 9:49 看不到的工作 priority 比較高；按鍵盤
  prop('keyboard', -5.6, 0, 2.6, 0.8);
  const menu = buddy('開始選單', 'P2', '#9fd39a', -3.4, 0, 1.4, 0.75);
  say('看不到的系統工作 priority 比較高', '你按鍵盤想叫出開始選單');
  await step(tok);                                   // 9:57 refresh 先跑，你的工作被往後推
  menu.mood('sad'); await walk(tok, menu, -2.4, 2.6, 700);
  tag('被往後推', 'note', -2.4, 1.6, 2.6);
  say('refresh 對系統比較 critical，先跑', '開始選單晚一點才出現');
  await step(tok);                                   // 10:32 就像有關係的人插隊
  sayT('就像排隊時有人「有關係」先走', 0, 4.4, 0);
  say('處理器裡是類似的概念', '→ 需要 priority queue 來排程');
}]);

// 11:08 多個 queue：每個 priority 一條
FRAG.push(['heapur-mqueues', 'M 個 priority → M 條 queue', async (tok) => {
  fresh([0, 4.5, 13], [0, 2, 0]);
  const names = ['< 10 歲', '10–20 歲', '20–30 歲', '> 30 歲'];
  const ys = [4.2, 3.0, 1.8, 0.6];
  const qs = [[], [], [], []];
  const QX = (k, n) => -3.4 + n * 1.0;
  const heads = [];
  await step(tok);                                   // 11:08 4 種 priority → 4 條 queue
  ys.forEach((y, k) => { heads.push(cube('[' + k + ']', GRAY, [0.8, 0.8, 0.8], -5, y, 0, 2)); line(-4.6, y, 4.0, y, 0, '#cfc4b0'); });
  say('有 4 種 priority', '就開 4 條 queue');
  await step(tok);                                   // 11:13 層級可以是年齡、生病、性別…
  const kinds = sayT('層級可以看：年齡、有沒有生病、…', 0.2, 5.4, 0);
  say('priority 可以依年齡、生病與否…分層', '層數多了 queue 就多');
  await step(tok);                                   // 11:44 小於 10、10–20、20–30、30 以上
  kill(kinds);
  names.forEach((nm, k) => tag(nm, 'idx', -6.4, ys[k], 0));
  say('按年齡分四條', '< 10、10–20、20–30、> 30');
  const enter = async (k, nm, c) => { const b = buddy(nm, '', c, 6.2, ys[k] - 0.35, 0, 0.55); qs[k].push(b); await walk(tok, b, QX(k, qs[k].length - 1), 0, 700); return b; };
  await step(tok);                                   // 12:14 10–20 的依序進來
  await enter(1, 'A', '#9fd39a'); await enter(1, 'B', '#7cb8ee'); await enter(1, 'C', '#f4c27a');
  say('10–20 歲的依序進來', '先 A、再 B、再 C');
  await step(tok);                                   // 12:38 有人小於 10 歲
  const e = await enter(0, 'E', '#e86a5a'); e.mood('wow');
  say('來了一個小於 10 歲的', '排進第 0 條');
  await step(tok);                                   // 12:44 從最高的 queue 先拿
  e.glow(GOLD); await walk(tok, e, 6.6, 0, 800); bye(e); qs[0].shift();
  say('pop：先從 priority 最高的 queue 拿', '第 0 條有人 → E 先出');
  await step(tok);                                   // 12:57 空了就換下一個層級
  const pk = tag('第 0 條空了 → 看下一條', 'pkt', -5, ys[0] + 0.7, 0);
  await travel(tok, pk, V3(-5, ys[0] + 0.7, 0), V3(-5, ys[1] + 0.7, 0), 600);
  const a = qs[1].shift(); a.glow(GOLD); await walk(tok, a, 6.6, 0, 700); bye(a);
  await Promise.all(qs[1].map((b, n) => walk(tok, b, QX(1, n), 0, 500)));
  say('最高那條空了，就換下一個層級', 'A 出去，B、C 往前');
  await step(tok);                                   // 13:14 M 種 priority → M 個 queue 的 array
  remove(pk);
  heads.forEach((h) => glow(h, BLUE));
  sayT('array of pointers：每格指向一條 queue', -5, 5.5, 0);
  say('M 種 priority → M 個 queue 的 array', 'array of pointers');
  await step(tok);                                   // 13:44 runtime 是多少？
  heads.forEach((h) => glow(h, null));
  sayT('成本呢？', 3.0, 5.3, 0);
  say('這種做法的 runtime 是多少？', 'push？top？pop？');
  await step(tok);                                   // 13:53 push：接到那條的尾巴
  await enter(2, 'D', '#c9a6e8');
  say('push：接到自己那條的尾巴', 'Θ(1)');
  await step(tok);                                   // 14:06 最差要找 M 條
  const sc = tag('一條一條找', 'pkt', -5, ys[0] + 0.7, 0);
  await travel(tok, sc, V3(-5, ys[0] + 0.7, 0), V3(-5, ys[3] + 0.7, 0), 1200);
  say('top / pop：最差要看過 M 條 queue', 'O(M)');
  await step(tok);                                   // 14:18 記憶體 M + n
  remove(sc);
  note('記憶體 = M 個 queue + n 個元素', 1.0, -0.4, 1.6);
  say('memory：Θ(M + n)', 'queue 數量 + item 數量');
  await step(tok);                                   // 14:28 priority 範圍要事先固定
  tag('priority 只能用事先定好的那幾種', 'bad', 1.0, 6.2, 0);
  say('缺點：priority 的範圍被限制住', '只能用事先定義好的');
}]);

// 14:37 binary min-heap 的定義
FRAG.push(['heapur-minheap-def', 'Binary min-heap：root 比左右子樹都小', async (tok) => {
  fresh(UCAM, ULOOK);
  await step(tok);                                   // 14:37 另一種做法：heap
  const t1 = sayT('另一種做法：heap', 0, 7.6, 0);
  say('另一種做法：用 heap', '拿最高 priority 的元素很快');
  await step(tok);                                   // 14:52 只講 binary heap
  txt(t1, 'heap 有很多種 → 這裡只講 binary heap');
  say('沒有 multiple queue 的限制', '這門課只碰 binary heap');
  await step(tok);                                   // 16:00 dequeue 想要常數時間
  txt(t1, 'dequeue：想拿最急的，最好是常數時間');
  say('dequeue 時想先處理權重高的', '希望是常數或接近常數');
  await step(tok);                                   // 18:01 定義：root 比左右子樹都小，遞迴
  remove(t1);
  const S = uHeap([], { sz: 0.7 });
  for (let d = 0; d < 5; d++) { UR_T1.forEach((v, k) => { if (v !== undefined && ulv(k + 1) === d) S.put(k + 1, v, 2); }); await beat(tok, 300); }
  S.hl([1], GOLD);
  say('min-heap：root 的 key 比左右子樹都小', '左右子樹本身也是 min-heap（遞迴）');
  await step(tok);                                   // 18:31 子樹裡不可能有比它小的
  S.hl([2, 4, 5, 8, 9, 18], GREEN); S.hl([3, 6, 7, 12, 13, 14], BLUE);
  say('左右子樹裡，不會有比 root 小的', '這是重點');
  await step(tok);                                   // 18:39 只有一個 node 也是 heap
  S.off(); S.hl([18], GOLD);
  const one = note('自己一個 = 也是 min-heap', S.p(18).x, S.p(18).y - 0.9, 0.4);
  say('只有一個 node：它就是最小的', '也是 min-heap');
  await step(tok);                                   // 18:47 除此之外沒有任何其他關係
  kill(one); S.off();
  tag('除了「parent 比孩子小」，沒有別的規則！', 'bad', 0, 8.2, 0);
  say('除此之外，子樹之間沒有任何關係', '大家最常犯的錯');
  await step(tok);                                   // 19:21 不像 BST：左右沒有順序
  S.hl([4], GOLD); S.hl([5], BLUE);
  say('不像 BST：右邊不一定比較大', '9 在左、99 在右，換過來也可以');
  await step(tok);                                   // 19:35 3 比 7、12 小；12 比 15 小
  S.off(); S.hl([1], GOLD); S.hl([2, 3], GREEN);
  await beat(tok, 800);
  S.off(); S.hl([3], GOLD); S.hl([6], GREEN);
  say('3 比 7、12 小', '12 比 15 小');
  await step(tok);                                   // 19:49 7 比它兩個孩子小，9 也是
  S.off(); S.hl([2], GOLD); S.hl([4, 5], GREEN);
  await beat(tok, 800);
  S.off(); S.hl([4], GOLD); S.hl([8, 9], GREEN);
  say('7 比 9、99 小；9 比 33、19 小', 'parent < children');
  await step(tok);                                   // 19:55 看這一層：33、19、32、58
  S.off(); S.hl([8, 9, 12, 13], BLUE);
  say('看同一層：33、19、32、58', '它們誰大誰小？');
  await step(tok);                                   // 20:00 同一層之間沒有關係
  tag('同一層：沒有規定', 'note', 0, UY[3] - 0.9, 0.6);
  say('同一層裡，彼此沒有任何關係', '33 比 19 大也沒關係');
  await step(tok);                                   // 20:05 關係只在上下層之間
  S.off(); S.hl([4], GOLD); S.hl([8, 9], GREEN);
  say('關係只存在不同層之間', '上面的比下面的小');
  await step(tok);                                   // 20:13 root 是最小值
  S.off(); S.hl([1], GREEN);
  say('min-heap 的 root：最小值', '3 永遠在最上面');
  await step(tok);                                   // 20:17 數字越小越優先 → 最優先的在最上面
  tag('最高 priority', 'pkt', S.p(1).x + 1.9, S.p(1).y, 0);
  say('數字越小 priority 越高', '所以最優先的就在 root');
  await step(tok);                                   // 20:27 處理器只在乎最上面的是誰
  const cpu = prop('cpu', -5.2, 6.4, 0, 1.0, 'CPU：只看最上面'); bob(cpu, 0.04);
  const pk = tag('拿 3', 'pkt', -4.2, 7.0, 0);
  await travel(tok, pk, V3(-4.2, 7.0, 0), V3(-0.8, 7.0, 0), 800);
  say('處理器只在乎最上面那個', '最緊急的拿去做，再拿下一個');
}]);

// 24:55 top 與 pop（舊做法：孩子一路補上來）
FRAG.push(['heapur-pop-hole', 'top O(1)；pop：較小的孩子一層層補上', async (tok) => {
  fresh(UCAM, ULOOK);
  const S = uHeap(UR_T1, { sz: 0.7 });
  const at = (i, t, cls = 'note') => { const p = S.p(i); return tag(t, cls, p.x, p.y + 0.85, 0.3); };
  await step(tok);                                   // 24:55 3 比左右子樹都小
  S.hl([1], GOLD);
  say('這棵樹裡：3 比左右子樹都小', '它就在 root');
  await step(tok);                                   // 25:33 top：直接拿，常數時間
  const tp = at(1, 'top：看一眼就好', 'pkt');
  say('top：root 就是答案，直接看', 'O(1)，跟 size 無關');
  await step(tok);                                   // 25:52 pop：把它移除
  kill(tp); S.take(1);
  const hole = at(1, '空了');
  say('pop：把 3 真的拿走', 'top 只看、pop 要移除');
  await step(tok);                                   // 26:05 看誰比較小
  S.hl([2, 3], BLUE);
  say('誰來補？看兩個孩子誰比較小', '7 和 12');
  await step(tok);                                   // 26:12 7 往上，7 的位置空了
  S.off(); S.mv(2, 1); kill(hole);
  const h2 = at(2, '空了');
  say('7 比較小 → 7 往上', '7 原本的位置空了');
  await step(tok);                                   // 26:22 9 往上
  S.mv(4, 2); kill(h2);
  const h3 = at(4, '空了');
  say('9 比 99 小 → 9 往上', '9 的位置又空了');
  await step(tok);                                   // 26:51 規則：兩個孩子誰小誰上
  S.hl([8, 9], BLUE);
  say('規則：看空位底下兩個孩子', '比較小的那個往上');
  await step(tok);                                   // 27:31 為什麼不是這邊：19 比較小
  S.off(); S.mv(9, 4); kill(h3);
  const h4 = at(9, '空了');
  say('33、19 裡 19 比較小', '所以 19 往上，不是 33');
  await step(tok);                                   // 27:58 一次一層，像 Mario
  S.mv(18, 9); kill(h4);
  const mario = tag('一次跳一層', 'pkt', S.p(9).x + 1.4, S.p(9).y, 0.3);
  say('一次只往上一層', '像 Mario 一樣跳上一層');
  await step(tok);                                   // 28:15 不跨好幾層，很簡單
  kill(mario);
  say('只比相鄰兩層，不跨好幾層', '洞最後跑到最底下');
  await step(tok);                                   // 28:45 再拿走 7：一個一個往上
  S.take(1); await beat(tok, 300);
  S.hl([2, 3], BLUE); await beat(tok, 500);
  S.off(); S.mv(2, 1); await beat(tok, 500);
  S.mv(4, 2); await beat(tok, 500);
  S.mv(8, 4);
  say('再 pop 7：9 上、19 上、33 上', '每次都是較小的孩子往上');
  await step(tok);                                   // 29:15 36 沒有理由上去
  S.hl([9], GREEN);
  at(9, '36 不用動');
  say('19 底下的 33、36：33 比較小，33 上去', '36 沒有理由往上，留在原地');
}]);

// 29:28 push 17：放在葉子，往上浮
FRAG.push(['heapur-push-17', 'push 17：放在葉子，往上浮', async (tok) => {
  fresh(UCAM, ULOOK);
  const S = uHeap(UR_T1, { sz: 0.7 });
  await step(tok);                                   // 29:28 push 怎麼做？
  say('剛才是 remove，那 push 呢？', 'push 有兩種做法');
  await step(tok);                                   // 29:47 在 leaf 這裡 push
  const p = S.p(28);
  const g = tag('放這裡（leaf）', 'note', p.x, p.y + 0.8, 0.3);
  say('先放在一個葉子（leaf）', '這裡放在 88 底下');
  await step(tok);                                   // 29:50 插入 17
  kill(g); S.put(28, 17, 3); S.hl([28], GOLD);
  await beat(tok, 700);
  await S.up(tok, 28, 600);
  say('插入 17：比 parent 小就往上', '17 < 88 → 換');
  await step(tok);                                   // 30:17 經過 31，停在 12 底下
  S.hl([7], GOLD); S.hl([3], BLUE);
  say('17 < 31 也換；17 ≥ 12：停', '停在 12 底下');
  await step(tok);                                   // 30:49 percolation：輕的往上，重的往下
  S.off(); S.hl([7], GREEN); S.hl([14, 28], BLUE);
  say('percolation：輕的往上浮', '被擠到的往下移');
}]);

// 31:03 一直 pop 會讓樹變歪 → 改用 complete tree
FRAG.push(['heapur-why-complete', '樹會變歪 → 改用 complete tree', async (tok) => {
  fresh(UCAM, ULOOK);
  let S = uHeap(UR_T1, { sz: 0.7 });
  await step(tok);                                   // 31:03 這種做法會讓 balance 變差
  await S.promote(tok, 220);
  await S.promote(tok, 220);
  say('照剛才的做法一直 pop', '洞都留在底下，balance 變差');
  await step(tok);                                   // 32:16 一棵子樹 perfect，另一棵不是
  S.hl([3, 6, 7, 12, 13, 14], GREEN); S.hl([2, 4, 5], RED);
  say('一邊滿、一邊缺', '一棵子樹 perfect，另一棵不是');
  await step(tok);                                   // 32:32 同一個 heap 改存成 complete tree
  fresh(UCAM, ULOOK);
  S = uHeap([], { sz: 0.7 });
  for (let i = 1; i <= 10; i++) { S.put(i, i * 3, 2); await beat(tok, 160); }
  const p = S.p(11); tag('下一個只能放這', 'ptr alt', p.x, p.y, 0);
  say('改成 complete tree：上到下、左到右填', '高度維持 ⌊log₂ n⌋');
  await step(tok);                                   // 33:02 合 AVL 的高度要求，但不是 search tree
  tag('高度像 AVL 一樣好，但不是 search tree', 'note', 0, 8.0, 0);
  say('高度完全符合 AVL 的要求', '但要注意：它不是 search tree');
}]);

// 33:32 complete heap 的 push：最後一格 → 往上
FRAG.push(['heapur-cpush-15', 'complete heap 的 push 15', async (tok) => {
  fresh(UCAM, ULOOK);
  const S = uHeap(UR_C0, { arr: true, cap: 8 });
  await step(tok);                                   // 33:32 由左到右填，位置唯一
  const p = S.p(8); const g = tag('下一格：唯一', 'ptr alt', p.x, p.y, 0);
  say('complete：由左到右填', '下一個位置是唯一的 = [size + 1]');
  await step(tok);                                   // 33:48 push 15 放進去
  kill(g); S.put(8, 15, 3); S.hl([8], GOLD);
  say('push 15：先放在 [8]', '再跟 parent 比');
  await step(tok);                                   // 34:04 比 parent 小就往上，停住就完成
  await S.up(tok, 8, 600);
  S.hl([2], GREEN);
  say('15 停在 [2]，17 被換下來', '仍然 complete，沒有洞');
}]);

// 34:36 complete heap 的 pop：最後一個上 root，往下沉
FRAG.push(['heapur-cpop', 'complete heap 的 pop：最後一個搬到 root', async (tok) => {
  fresh(UCAM, ULOOK);
  const S = uHeap(UR_C1, { arr: true, cap: 8 });
  await step(tok);                                   // 34:36 舊做法：洞可能出現在任何地方
  S.hl([2, 3], BLUE);
  note('舊做法：小的孩子補上 → 洞會到處跑', 0, 8.1, 0);
  say('照舊演算法：較小的孩子補上來', '問題：洞可能出現在任何地方');
  await step(tok);                                   // 35:07 從上面把 12 移除
  S.off(); S.take(1);
  say('把 root 的 12 移除', 'root 空了');
  await step(tok);                                   // 35:41 想保持 complete，高度平衡
  sayT('目標：還是 complete（高度平衡）', 5.0, 6.6, 0);
  say('min-heap 還要保持 complete', '這樣 height 才會平衡');
  await step(tok);                                   // 35:58 產生洞，樹會變怪
  const hp = S.p(4); const hz = tag('洞？', 'bad', hp.x, hp.y + 0.9, 0.3);
  say('照舊做法會留下洞，樹變很怪', '要怎麼避免？');
  await step(tok);                                   // 36:04 學生：把 36 拿上去？
  kill(hz); S.hl([8], GOLD);
  say('同學：把 36 拿上去？', '先記住這個想法');
  await step(tok);                                   // 36:50 先 balance 嗎？不，最優先的要在上面
  S.off();
  say('不是先 balance', '最重要：priority 最高的要在最上面');
  await step(tok);                                   // 37:25 移到旁邊？程式裡沒有「旁邊」
  const side = note('「移到旁邊」？程式裡沒有「旁邊」', -3.5, 7.4, 0);
  say('看圖說「移到旁邊」很簡單', '寫成演算法就不行');
  await step(tok);                                   // 38:06 拿最後一個 entry 放到上面
  kill(side); S.hl([8], GOLD);
  say('好方法：拿最後一個 entry', '放到上面，再往下調整');
  await step(tok);                                   // 38:36 36 拿上去
  S.lastUp(); S.hl([1], GOLD);
  say('36 搬到 root', 'A[1] ← A[8]，size = 7');
  await step(tok);                                   // 38:50 標準演算法往下：比較小的孩子上來
  await S.down(tok, 1, 600);
  say('較小的孩子上來：15、17', '剛好填滿，沒有洞');
}]);

// 39:23 同層沒有順序；跟 search tree 比 find-min
FRAG.push(['heapur-floors-cost', '每層像樓層；find-min：heap O(1) vs BST O(log n)', async (tok) => {
  fresh(UCAM, ULOOK);
  const S = uHeap(UR_C2, { w: 9 });
  await step(tok);                                   // 39:23 重點要記住
  say('重點要記住', 'pop 12 之後的 heap');
  await step(tok);                                   // 39:30 上下層之間有關係
  S.hl([1], GOLD); S.hl([2, 3], GREEN);
  say('這一層和下一層之間：有關係', '上 ≤ 下');
  await step(tok);                                   // 40:12 同一層沒有關係；像樓層
  S.off(); S.hl([4, 5, 6, 7], BLUE);
  ['頂樓（最小）', '2 樓', '3 樓'].forEach((t, d) => tag(t, 'idx', -6, UY[d], 0));
  say('像樓層：頂樓最小，往下越來越大', '同一層彼此沒有關係');
  await step(tok);                                   // 40:42 一年級在上，二年級在下
  const g1 = sayT('第一學期', 5.6, UY[1], 0), g2 = sayT('第二學期', 5.6, UY[2], 0);
  say('像第一學期排在上面、第二學期在下面', '跨學期才有先後');
  await step(tok);                                   // 40:50 二年級裡有大有小
  S.hl([4, 5], GOLD);
  say('第二學期裡面有人大、有人小', '36 在 33 左邊也沒關係');
  await step(tok);                                   // 40:54 最大的錯誤；剛才那叫 percolate down
  S.off(); kill(g1); kill(g2);
  tag('最大的錯：以為同層有順序', 'bad', 0, 8.1, 0);
  say('跨層有關係，同層沒有', '36 拿上去再往下 = percolate down');
  await step(tok);                                   // 41:27 BST / AVL 沒有「最小在 root」
  fresh(UCAM, ULOOK);
  const B = uHeap([33, 17, 52, 15, 32, 36, 58], { w: 9 });
  tag('BST / AVL', 'ptr', -5.5, 7.2, 0);
  say('binary search tree：root 不是最小', '同樣 7 個數');
  await step(tok);                                   // 41:32 要找最小的
  for (const i of [1, 2, 4]) { B.off(); B.hl([i], GOLD); await beat(tok, 500); }
  B.hl([4], GREEN);
  say('要找最小：一路往左走到底', '33 → 17 → 15');
  await step(tok);                                   // 41:36 要 log n 次 = height；heap 是常數
  tag('走了一個 height：O(log n)', 'note', -2.2, 1.6, 0.4);
  say('BST：find-min 要走一個高度（平衡時 log n）', 'heap：最小的就在 root，O(1)');
  await step(tok);                                   // 42:13 我只要最上面那個
  B.off(); B.hl([4], GREEN);
  sayT('heap 只回答一件事：「誰最急？」', 0, 8.2, 0);
  say('我只要最小的那個', '其他的怎麼排都不管');
}]);

// 42:53 再 pop 一次：移除 15
FRAG.push(['heapur-cpop2', '再 pop 一次：15 移除，58 上來往下沉', async (tok) => {
  fresh(UCAM, ULOOK);
  const S = uHeap(UR_C2, { arr: true, cap: 7 });
  await step(tok);                                   // 42:53 再看一次：pop 15
  S.hl([1], RED);
  say('再看一次：pop 15', 'root 又要空了');
  await step(tok);                                   // 43:08 拿走 15，最後一個上去
  S.take(1); await beat(tok, 500);
  S.lastUp(); S.hl([1], GOLD);
  say('把最後一個 entry 拿上去', '58 → root');
  await step(tok);                                   // 43:23 照正規流程往下
  await S.down(tok, 1, 600);
  say('照正規流程往下沉', '落在 [5]');
  await step(tok);                                   // 43:53 很簡單的演算法
  say('這就是 pop：很簡單的演算法', '陣列：' + urSet(S).join(', '));
}]);

// 44:17 heap 的實作：node 或 array；root 在 1，left 2i，right 2i+1，parent ⌊i/2⌋
FRAG.push(['heapur-array-index', '陣列存 heap：left 2i、right 2i+1、parent ⌊i/2⌋', async (tok) => {
  fresh(UCAM, ULOOK);
  let S = uHeap(UR_C0, { w: 8 });
  await step(tok);                                   // 44:17 node 的形式（linked）
  sayT('一種：node + 指標（linked）', 0, 8.1, 0);
  say('heap 可以用 node 實作', '就像之前的 linked tree');
  await step(tok);                                   // 44:40 實作方式不影響（像 stack）
  note('怎麼實作，不影響 heap 的觀念', 0, 0.4, 1.2);
  say('就像講 stack 時那樣', '實作方式不影響它是什麼');
  await step(tok);                                   // 45:04 為什麼叫 stack：一個一個堆起來
  for (let k = 0; k < 4; k++) cube('', '#e6e1d8', [1.3, 0.22, 1.0], -6.2, 0.11 + k * 0.24, 0, 1.5);
  sayT('stack = 一疊', -6.2, 1.6, 0);
  say('為什麼叫 stack？', '把東西一個一個疊起來');
  await step(tok);                                   // 45:09 heap：一堆土
  [[0, 0, 4], [0.25, 1, 3], [0.5, 2, 2], [0.75, 3, 1]].forEach(([y, k, n]) => { for (let j = 0; j < n; j++) cube('', '#c9a27a', [0.45, 0.25, 0.45], 6.2 - (n - 1) * 0.25 + j * 0.5, 0.13 + y, 0, 1.5); });
  sayT('heap = 一堆（像小土堆）', 6.0, 1.6, 0);
  say('heap 也是：一堆東西', '像一個小土堆');
  await step(tok);                                   // 46:09 node 裡放 data item
  S.hl([1], GOLD);
  note('node 裡放 data item（一個 byte 或整個 struct）', 0, 7.9, 0.4);
  say('node 裡可以放 item', '可以是一個 byte，也可以是整個 structure');
  await step(tok);                                   // 46:25 complete → 直接用 array
  fresh(UCAM, ULOOK);
  S = uHeap(UR_C0, { arr: true, cap: 7 });
  say('知道樹是 complete 的', '就能直接存 array，位置用算的');
  await step(tok);                                   // 46:43 root 放 index 1，不放 0
  S.hl([1], GOLD);
  const z0 = S.c(0); tag('[0] 不用', 'bad', z0.x, 0.6, z0.z);
  say('root 不放 0，放 index 1', 'A[1] = 12');
  await step(tok);                                   // 46:47 left child 在 2 倍 index
  S.hl([2], GREEN);
  say('left child：在 2 × index', 'left = 2i');
  await step(tok);                                   // 46:51 right child 在 2i + 1
  S.hl([3], BLUE);
  say('right child：在 2 × index + 1', 'right = 2i + 1');
  await step(tok);                                   // 47:10 i = 1（root）→ left 在 2
  S.off(); S.hl([1], GOLD); S.hl([2], GREEN);
  say('parent 在 i = 1（root）', 'left child 應該在 2');
  await step(tok);                                   // 47:17 17 在 2，32 在 3
  S.hl([3], GREEN);
  const pk = tag('17 → [2]', 'pkt', S.p(2).x, S.p(2).y + 0.6, 0);
  await travel(tok, pk, V3(S.p(2).x, S.p(2).y + 0.6, 0), V3(S.c(2).x, 1.2, S.c(2).z), 900);
  say('17 在 [2]，32 在 [3]', '依此類推');
  await step(tok);                                   // 47:24 任何 index 都能唯一定位孩子
  remove(pk); S.off(); S.hl([3], GOLD); S.hl([6, 7], GREEN);
  say('任何 index：乘 2、或乘 2 加 1', 'i = 3 → [6] = 52、[7] = 58');
  await step(tok);                                   // 47:30 空格的記號：不能用 0
  S.off();
  note('空格用 0 當記號？不行，0 也可能是資料', 0, -0.3, 4.6);
  say('還要一個「這格是空的」記號', '0 不行：0 本身也是一個數字');
  await step(tok);                                   // 48:02 反過來找 parent
  S.hl([7], GOLD); S.hl([3], BLUE);
  const up = tag('找 parent', 'pkt', S.p(7).x, S.p(7).y + 0.6, 0);
  await travel(tok, up, V3(S.p(7).x, S.p(7).y + 0.6, 0), V3(S.p(3).x, S.p(3).y + 0.6, 0), 800);
  say('反過來：給 index 找 parent', '解剛才的式子');
  await step(tok);                                   // 48:32 用 mod 看奇數偶數？
  remove(up);
  say('可以用 mod 看是奇數還是偶數', '7 mod 2 = 1 → 是 right child');
  await step(tok);                                   // 49:05 奇數就先減 1 再除以 2
  say('i 是奇數：先減 1 再除以 2', '(7 − 1) / 2 = 3');
  await step(tok);                                   // 49:37 整數除法直接捨去 0.5
  S.off(); S.hl([6, 7], GOLD); S.hl([3], BLUE);
  say('其實直接整數除法就好', '7 / 2 = 3.5 → 3；6 / 2 = 3，不用分奇偶');
}]);

// 50:13 在陣列上 push：放在 size 的位置，跟 parent 比，swap
FRAG.push(['heapur-arrpush', '在陣列上 push：放最後一格，跟 parent 比、swap', async (tok) => {
  fresh(UCAM, ULOOK);
  const S = uHeap(UR_C0, { arr: true, cap: 8 });
  await step(tok);                                   // 50:13 放在最後一個 entry
  S.put(8, 15, 3); S.hl([8], GOLD);
  say('push：放在陣列最後', 'A[size + 1] = A[8] = 15');
  await step(tok);                                   // 50:30 跟 parent 比
  S.hl([4], BLUE);
  say('跟它的 parent 比', 'parent = ⌊8/2⌋ = 4 → 36');
  await step(tok);                                   // 50:43 swap，一直 swap 到條件滿足
  await S.up(tok, 8, 600);
  say('比 parent 小就 swap，一直做到停', '15 停在 [2]');
  await step(tok);                                   // 51:14 就是：跟 parent 比、swap
  sayT('while A[i] < A[⌊i/2⌋]：swap，i = ⌊i/2⌋', 0, 8.1, 0);
  say('也可以寫成遞迴', '只是實作細節，觀念跟樹上一樣');
}]);

// 51:27 成本曲線：理想常數、log n、線性
FRAG.push(['heapur-cost-curves', '成本：常數 vs log n vs 線性', async (tok) => {
  fresh([0, 3.5, 13], [0, 2.8, 0]);
  const X = (t) => -5.5 + t * 11, N = 40;
  const draw = async (f, color, lbl) => {
    let px = X(0), py = f(0);
    for (let k = 1; k <= N; k++) { const t = k / N, y = f(t); line(px, py, X(t), y, 0, color); px = X(t); py = y; if (k % 8 === 0) await beat(tok, 120); }
    tag(lbl, 'ptr', 5.4, py + 0.3, 0);
  };
  await step(tok);                                   // 51:27 看幾個例子的 runtime
  line(-5.5, 0.3, 5.5, 0.3, 0, '#6e5f49'); line(-5.5, 0.3, -5.5, 6.2, 0, '#6e5f49');
  tag('n（資料量）', 'idx', 5.4, -0.1, 0); tag('cost', 'idx', -5.5, 6.6, 0);
  say('看圖：資料越多，要花多少', 'runtime 的例子');
  await step(tok);                                   // 52:33 常數成本（理想）
  await draw(() => 0.8, '#b8b0a0', 'Θ(1)');
  say('白色：常數成本（理想）', '不管多少資料都一樣快');
  await step(tok);                                   // 52:37 藍色：log n
  await draw((t) => 0.8 + Math.log2(1 + t * 63) * 0.55, '#4b9ee2', 'Θ(log n)');
  say('藍色：log n 的成本', '幾乎跟常數一樣平');
  await step(tok);                                   // 52:44 線性成本
  await draw((t) => 0.8 + t * 5.2, RED, 'Θ(n)');
  say('這些是線性成本', 'heap 的 push / pop 走 log n 那條');
}]);

// 52:51 max-heap：條件反過來
FRAG.push(['heapur-maxheap', 'Max-heap：最大的在最上面', async (tok) => {
  fresh(UCAM, ULOOK);
  let S = null;
  await step(tok);                                   // 52:51 也可以有 max-heap
  S = uHeap([58, 36, 52, 17, 33, 32, 15], { min: false });
  say('剛才是 binary min-heap', '也可以做 max-heap');
  await step(tok);                                   // 53:01 最大的在最上面
  S.hl([1], GOLD);
  say('max-heap：最大的在最上面', 'root = 58');
  await step(tok);                                   // 53:19 條件反過來
  for (const [p, cs] of [[1, [2, 3]], [2, [4, 5]], [3, [6, 7]]]) { S.off(); S.hl([p], GOLD); S.hl(cs, GREEN); await beat(tok, 650); }
  S.off();
  say('min-heap 是「小於」，這裡是「大於」', 'parent ≥ children，演算法完全一樣');
  await step(tok);                                   // 53:31 投影片小錯
  note('老師：投影片上的 23 應該是 25', 0, 8.1, 0);
  say('投影片有個數字寫錯', '23 應該是 25，不影響觀念');
}]);

// 54:03 第二層 priority：(2,0)…(2,6) 一個一個 pop
FRAG.push(['heapur-pairs-heap', '(2,x) 的 min-heap：一個個 pop', async (tok) => {
  fresh(UCAM, ULOOK);
  let S = null;
  await step(tok);                                   // 54:03 為什麼要學 heap？
  sayT('為什麼要學 heap？', 0, 7.6, 0);
  say('heap 講完了', '是什麼把我們帶到這裡的？');
  await step(tok);                                   // 54:16 priority queue 可以用 heap 實作
  S = uHeap(UR_P0, { arr: true, cap: 7, less: pLess, show: () => '2', color: (p) => PCOL[p[1] % 7], sz: 1.0, dx: 1.3 });
  say('是 priority queue', 'priority queue 可以用 heap 來實作');
  await step(tok);                                   // 54:34 第二個層級：全部都是 2
  S.hl([1, 2, 3, 4, 5, 6, 7], BLUE);
  say('如果第一層全都是 2', '只看數字分不出誰先');
  await step(tok);                                   // 55:04 沒有顏色 → 再加一個 index
  S.off();
  for (let i = 1; i <= 7; i++) { tint(S.nd[i], GRAY); tint(S.cl[i], GRAY); }
  say('如果沒有顏色可以看', '就再加一個 index');
  await step(tok);                                   // 55:14 在 2 旁邊加一個資訊
  for (let i = 1; i <= 7; i++) { relabel(S.nd[i], pShow(S.a[i])); relabel(S.cl[i], pShow(S.a[i])); }
  say('在 2 旁邊加上第二層', '(2, x)');
  await step(tok);                                   // 55:21 同一層 2，裡面依顏色區分
  for (let i = 1; i <= 7; i++) { tint(S.nd[i], PCOL[S.a[i][1]]); tint(S.cl[i], PCOL[S.a[i][1]]); }
  say('都在第 2 層，裡面再用顏色分', '顏色 = 第二層的 priority');
  await step(tok);                                   // 55:26 紅色是 0，綠色 1，藍色 2…
  [[1, '紅 = 0'], [2, '綠 = 1'], [3, '藍 = 2']].forEach(([i, t]) => { const p = S.p(i); tag(t, 'idx', p.x + 1.1, p.y + 0.5, 0); });
  say('紅色給 0，綠色 1，藍色 2…', '一個一個清空，怎麼做？');
  await step(tok);                                   // 55:55 (2,0) 被移除
  S.take(1);
  say('跟剛才一樣：(2,0) 先被移除', 'root 空了');
  await step(tok);                                   // 56:07 維持 complete：最後一個拿到 top
  S.hl([7], GOLD);
  say('要維持 complete', '最後一個 (2,6) 拿到 top');
  await step(tok);                                   // 57:03 最後一個 entry 拿到這裡
  S.lastUp(); S.hl([1], GOLD);
  say('最後一個 entry 拿到空出來的位置', 'A[1] ← (2,6)');
  await step(tok);                                   // 57:15 跑 percolation down
  S.hl([2, 3], BLUE);
  say('跑 percolation down', '看兩個孩子誰比較小');
  await step(tok);                                   // 57:31 (2,1) 取代它，(2,6) 下來
  S.off(); await S.sw(tok, 1, 2, 700);
  say('(2,1) 比較小 → 它上去', '(2,6) 下來');
  await step(tok);                                   // 57:36 再比一次：(2,3) 上去
  S.hl([2], GOLD); S.hl([4, 5], BLUE); await beat(tok, 500);
  S.off(); await S.sw(tok, 2, 4, 700);
  say('再看這兩個：(2,3) 比較小', '(2,3) 上去，(2,6) 下來');
  await step(tok);                                   // 57:40 選擇是唯一的；考試會要你清空
  note('每一步的選擇都是唯一的', 0, 8.1, 0);
  say('不是隨便選，選擇是唯一的', '考試：給一個 heap，一個一個清空');
  await step(tok);                                   // 58:10 誰會上到 top？
  S.hl([1], GOLD);
  say('現在誰在 top？', '(2,1)');
  await step(tok);                                   // 58:16 只移除 top 那一個
  say('每次只移除 top 那一個', '依 priority，最上面的先走');
  await step(tok);                                   // 59:13 原本是 (2,1)、(2,3)、(2,6)、(2,4)、(2,2)、(2,5)，移除它
  for (const i of [1, 2, 4, 5, 3, 6]) { S.off(); S.hl([i], BLUE); await beat(tok, 280); }
  S.off(); S.take(1);
  say('樹上：(2,1)、(2,3)、(2,6)、(2,4)、(2,2)、(2,5)', '移除 (2,1)');
  await step(tok);                                   // 59:32 最後一個上來；比較大，較小的孩子上來
  S.lastUp(); await beat(tok, 500);
  await S.down(tok, 1, 600);
  say('最後一個 (2,5) 上去，但它比較大', '兩個孩子較小的 (2,2) 上來');
}]);

// 59:47 Q&A：為什麼不用 AVL tree？
FRAG.push(['heapur-avl-qa', 'Q&A：AVL tree 也能做，但 heap 拿最小是 O(1)', async (tok) => {
  fresh(UCAM, ULOOK);
  await step(tok);                                   // 59:47 multiway / AVL？蘋果跟橘子
  const st = buddy('同學', '?', '#7cb8ee', -5.6, 0.2, 2.4, 0.8); st.mood('wow');
  sayT('「可以用 multiway tree 或 AVL 嗎？」', -3.2, 2.2, 2.4);
  say('同學問：能不能用別的 tree？', '老師：multiway 是拿蘋果比橘子');
  await step(tok);                                   // 1:00:58 用 AVL 也可以
  const B = uHeap([33, 17, 52, 15, 32, 36, 58], { w: 5.5 });
  B.nd.forEach((m) => { if (m) move(m, m.position.x - 3.2, m.position.y, 0); });
  B.ed.forEach((l) => { if (l) l.position.x -= 3.2; });
  tag('AVL', 'ptr', -3.2, 7.9, 0);
  const H = uHeap([15, 17, 32, 36, 33, 52, 58], { w: 5.5 });
  H.nd.forEach((m) => { if (m) move(m, m.position.x + 3.4, m.position.y, 0); });
  H.ed.forEach((l) => { if (l) l.position.x += 3.4; });
  tag('heap', 'ptr', 3.4, 7.9, 0);
  st.mood('happy');
  say('用 AVL tree 也可以', '元素一樣能插入、刪除');
  await step(tok);                                   // 1:01:03 東西會一直進來
  const tk = tag('新 task 一直進來', 'pkt', 6.8, 7.4, 0);
  await travel(tok, tk, V3(6.8, 7.4, 0), V3(5.0, 7.4, 0), 700);
  say('期間一直有新 task 進來', '有插入、也有移除');
  await step(tok);                                   // 1:01:45 用在處理器上會浪費 cycle
  remove(tk);
  say('用在處理器上：每次都要找最小', '在 AVL 上會浪費一些 cycle');
  await step(tok);                                   // 1:02:12 要走這個分支、那個分支
  for (const i of [1, 2, 4]) { B.off(); B.hl([i], GOLD); await beat(tok, 450); }
  B.hl([4], GREEN); H.hl([1], GREEN);
  say('AVL：一層一層走分支才找到最小', 'heap：最小的就在 root，O(1)');
}]);

// 1:02:32 (2,3) 移除：最後一個上去，往 (2,4) 那邊沉
FRAG.push(['heapur-pairs-pop3', '再 pop (2,3)：往較小的 (2,4) 那邊沉', async (tok) => {
  const h = UR_P0.map((p) => p.slice());
  for (let k = 0; k < 3; k++) popPlain(h);
  fresh(UCAM, ULOOK);
  const S = uHeap(h, { arr: true, cap: 7, less: pLess, show: pShow, color: (p) => PCOL[p[1] % 7], sz: 1.0, dx: 1.3 });
  await step(tok);                                   // 1:02:32 (2,3) 移除，最後一個到 top
  S.take(1); await beat(tok, 500);
  S.lastUp(); S.hl([1], GOLD);
  say('(2,3) 移除時：最後一個到 top', '(2,6) 上去');
  await step(tok);                                   // 1:02:48 往 (2,4) 那邊
  await S.down(tok, 1, 600);
  say('(2,4) 是兩個孩子裡較小的', '所以 (2,4) 上來，(2,6) 往那邊下去');
}]);

// 1:03:05 push 平均 O(1)、最差 O(log n)；pop 幾乎都沉到底
FRAG.push(['heapur-push-worst', 'push 最好 O(1)、最差 O(log n)', async (tok) => {
  fresh(UCAM, ULOOK);
  const S = uHeap([12, 15, 32, 17, 33, 52, 58], { arr: true, cap: 9 });
  await step(tok);                                   // 1:03:05 push 是常數時間嗎？
  sayT('push 是常數時間嗎？', 0, 8.1, 0);
  say('同學：push 是常數時間', '老師：為什麼？');
  await step(tok);                                   // 1:03:38 放在最後，但很小就要往上
  S.put(8, 5, 3); S.hl([8], GOLD);
  say('放在最後沒錯', '但如果它很小（5），還是要往上');
  await step(tok);                                   // 1:03:55 最多到 root
  const n = await S.up(tok, 8, 500);
  S.hl([1], GOLD);
  say('最多一路到 root：換了 ' + n + ' 次', '= 樹的高度 → O(log n)');
  await step(tok);                                   // 1:04:08 比較大：只做一次就停
  S.off(); S.put(9, 60, 3); S.hl([9], GOLD);
  await beat(tok, 500);
  await S.up(tok, 9, 500);
  say('如果它比較大（60）', '比一次就停：O(1)');
  await step(tok);                                   // 1:04:14 不然就 swap 幾次（array 裡也是 swap）
  say('不然就要做幾次 swap', '在 array 裡就是交換兩格');
  await step(tok);                                   // 1:04:30 pop：搬上去的通常很大，沉到底
  S.take(1); await beat(tok, 300);
  S.lastUp();
  await S.down(tok, 1, 380);
  say('pop：搬上去的是最後一個，通常很大', '幾乎都沉到底：Θ(log n)');
  await step(tok);                                   // 1:04:49 平均常數、worst case log n
  sayT('push：平均 ≈ O(1)，最差 O(log n)；pop：O(log n)', 0, 8.1, 1.0);
  say('push 平均常數，worst case log n', 'pop：log n');
}]);
  }
  // ═══ qa-ds5.js（課堂 Q&A 段落的場景） ═══
  {
const { fresh, tag, cube, kill, glow, line, step, GOLD } = K;
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
// RjvhXL0WTrY：建樹用 prefix 還是 postfix
FRAG.push(['qa-tree-build-order', '遞迴建樹：先建自己（prefix）或先建左右（postfix）', async (tok) => {
  fresh([0, 3.6, 12], [0, 2.4, 0]);
  const P = { A: [0, 4.4], B: [-2.2, 3.1], C: [2.2, 3.1], D: [-3.3, 1.8], E: [-1.1, 1.8] };
  const E = [['A', 'B'], ['A', 'C'], ['B', 'D'], ['B', 'E']];
  let S = [];
  async function build(order, color) {
    S.forEach(kill); S = [];
    E.forEach(([a, b]) => S.push(line(P[a][0], P[a][1] - 0.3, P[b][0], P[b][1] + 0.3)));
    for (let i = 0; i < order.length; i++) {
      const [x, y] = P[order[i]];
      const m = cube(order[i], color, [0.7, 0.6, 0.6], x, y, 0, 1.5); S.push(m);
      S.push(tag('第 ' + (i + 1) + ' 個', 'idx', x + 0.95, y));
      await beat(tok, 650);
    }
  }
  await step(tok);                                   // prefix：先建自己再建左右
  say('prefix：先把這裡的 node 建好', '再遞迴去建左 subtree、右 subtree');
  await build(['A', 'B', 'D', 'E', 'C'], '#4b9ee2');
  S.push(note('prefix：A B D E C', 0, 0.6));
  await step(tok);                                   // postfix：先建左右再接上自己
  say('postfix：先把左右兩邊建好', '最後再跟自己連起來');
  await build(['D', 'E', 'B', 'C', 'A'], '#2fc092');
  S.push(note('postfix：D E B C A', 0, 0.6));
  await step(tok);                                   // 跟 tree traversal 有關
  S.forEach((o) => { if (o.material && o.userData && o.userData.lbl && o.userData.lbl.element.textContent === 'A') glow(o, GOLD); });
  S.push(tag('兩種都常見，正好對應 preorder / postorder traversal', 'ptr', 0, -0.2));
  say('兩種寫法都會看到', '作業四會練到各種 tree traversal');
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
    quiz: genQ,
    pages: [
      { id: 'cmp', name: '複雜度與重點', render: renderCmp },
      { id: 'quiz', name: '小測驗', render: renderQuiz },
    ],
    scenes: Object.fromEntries(Object.entries(scenes).map(([id, s]) => [id, { title: s.title, play: async (tok) => { sceneTok = tok; await s.play(tok); } }])),
    sceneOrder: ['heap-as-array', 'max-heapify', 'build-max-heap', 'build-heap-cost', 'pq-insert', 'extract-max', 'heap-sort', 'minmax-heap'].concat(FRAG.map((f) => f[0])),
    stop() { gen++; busy = false; sceneTok = null; },
  };
}
