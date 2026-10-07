// 資料結構 第3章：樹（基礎）— Binary Tree、走訪、完全二元樹。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 慣例（洪逸／Horowitz）：root 在 level 1；深度 k 的完滿二元樹（full）有 2^k − 1 個節點；
// 陣列表示法用 1-based：parent(i) = ⌊i/2⌋、left(i) = 2i、right(i) = 2i+1，[0] 不用。
export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat, block } = ctx;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const rnd = (n) => Math.floor(Math.random() * n);
  let timer = null, epoch = 0;
  const stopTimer = () => { clearInterval(timer); timer = null; };
  function fresh() { stopTimer(); epoch++; lab.clear(); }
  function auto(stepFn, ms) { stopTimer(); timer = setInterval(() => { if (!stepFn()) stopTimer(); }, ms); }

  // ───────────────────────── 共用：樹、版面、連線、游標 ─────────────────────────
  const T = (label, left = null, right = null) => ({ label, left, right });
  const NODE = [0.8, 0.6, 0.8];
  const DEPTH_COLORS = ['#2fc092', '#4b9ee2', '#9b7ef4', '#e55a9b', '#dd8238'];
  const depthColor = (d) => DEPTH_COLORS[d % DEPTH_COLORS.length];

  function walkPre(n, f) { if (!n) return; f(n); walkPre(n.left, f); walkPre(n.right, f); }
  const preorder = (r) => { const o = []; walkPre(r, (n) => o.push(n)); return o; };
  const inorder = (r, o = []) => { if (r) { inorder(r.left, o); o.push(r); inorder(r.right, o); } return o; };
  const postorder = (r, o = []) => { if (r) { postorder(r.left, o); postorder(r.right, o); o.push(r); } return o; };
  function levelorder(r) { const out = [], q = r ? [r] : []; while (q.length) { const n = q.shift(); out.push(n); if (n.left) q.push(n.left); if (n.right) q.push(n.right); } return out; }
  const str = (arr) => arr.map((n) => n.label).join(' ');

  // 隨機形狀（最多 4 層），再依 level order 標上 A、B、C…
  function randomShape(n) {
    const root = T(null); root.d = 0;
    const all = [root];
    while (all.length < n) {
      const cand = all.filter((x) => x.d < 3 && (!x.left || !x.right));
      const p = cand[rnd(cand.length)];
      const sides = ['left', 'right'].filter((s) => !p[s]);
      const c = T(null); c.d = p.d + 1;
      p[sides[rnd(sides.length)]] = c;
      all.push(c);
    }
    return root;
  }
  function labelLevel(root, shuffle) {
    const nodes = levelorder(root);
    const letters = 'ABCDEFGHIJKLMNO'.slice(0, nodes.length).split('');
    if (shuffle) letters.sort(() => Math.random() - 0.5);
    nodes.forEach((n, i) => { n.label = letters[i]; });
    return root;
  }

  const TREES = {
    expr: { name: '運算式樹 A/B*C*D+E（課本例）', make: () => T('+', T('*', T('*', T('/', T('A'), T('B')), T('C')), T('D')), T('E')) },
    sample: { name: '一般二元樹（9 個節點）', make: () => T('A', T('B', T('D'), T('E', T('G'))), T('C', null, T('F', T('H'), T('I')))) },
    random: { name: '隨機樹', make: () => labelLevel(randomShape(6 + rnd(4))) },
  };

  // 中序位置決定 x、深度決定 y：任兩個中序相鄰的節點一定不同層，所以不會重疊。
  const TREE_O = { cx: 0, width: 11.6, topY: 6.6, minY: 1.7, maxStep: 1.45, maxSp: 1.3 };
  function layoutTree(root, o = TREE_O) {
    const order = []; let maxD = 0;
    (function w(n, d) { if (!n) return; w(n.left, d + 1); n.depth = d; order.push(n); if (d > maxD) maxD = d; w(n.right, d + 1); })(root, 0);
    const cnt = order.length;
    const sp = cnt > 1 ? Math.min(o.maxSp, o.width / (cnt - 1)) : 0;
    const step = maxD ? Math.min(o.maxStep, (o.topY - o.minY) / maxD) : 0;
    order.forEach((n, i) => { n.inIdx = i; n.pos = V(o.cx + (i - (cnt - 1) / 2) * sp, o.topY - n.depth * step, 0); });
    return { order, maxD };
  }
  function nodeBody(n) {
    const b = lab.addBody(block(n.label, NODE, depthColor(n.depth || 0)));
    n.body = b;
    return b;
  }
  function spawnTree(root) {
    layoutTree(root);
    levelorder(root).forEach((n) => { nodeBody(n).obj.position.copy(n.pos); n.body.target.copy(n.pos); });
  }
  // 連線跟著方塊的實際位置走（方塊在彈簧移動時線也跟著動）
  function edgeLines(pairs, hh = NODE[1] / 2) {
    const MAX = 48;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 6), 3));
    const ls = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#7a6a52' }));
    ls.frustumCulled = false;
    ls.onBeforeRender = () => {
      const a = geo.attributes.position.array; let k = 0;
      for (const [P, C] of pairs()) {
        if (k >= MAX * 6) break;
        a[k++] = P.x; a[k++] = P.y - hh; a[k++] = P.z;
        a[k++] = C.x; a[k++] = C.y + hh; a[k++] = C.z;
      }
      geo.setDrawRange(0, k / 3);
      geo.attributes.position.needsUpdate = true;
    };
    lab.world.add(ls);
    return ls;
  }
  function treePairs(root) {
    const out = [];
    walkPre(root, (n) => { if (!n.body) return; for (const c of [n.left, n.right]) if (c && c.body) out.push([n.body.obj.position, c.body.obj.position]); });
    return out;
  }
  function makeCursor() {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.06, 10, 40), new THREE.MeshBasicMaterial({ color: '#c08a1f' }));
    m.rotation.x = Math.PI / 2;
    m.visible = false;
    return lab.addBody(m);
  }
  function cursorTo(cur, pos) {
    if (!cur.obj.visible) { cur.obj.position.copy(pos); cur.obj.visible = true; }
    lab.springTo(cur, pos.clone());
  }
  function glow(n, color = '#3d2c00') { if (n.body) n.body.obj.material.emissive.set(color); }
  function rowLabel(text, z) { const l = lab.label(text, 'ptr'); l.position.set(-6.6, 0.35, z); lab.world.add(l); return l; }
  const ROW_X0 = -5.6, ROW_DX = 0.8;
  const rowPos = (i, z) => V(ROW_X0 + i * ROW_DX, 0.3, z);
  const SMALL = [0.64, 0.5, 0.64];

  // ───────────────────────── 走訪：Preorder / Inorder / Postorder ─────────────────────────
  const KIND = {
    pre: { name: 'Preorder（前序）', rule: 'V L R：先印自己，再左、再右', pass: 1 },
    in: { name: 'Inorder（中序）', rule: 'L V R：先左、印自己、再右', pass: 2 },
    post: { name: 'Postorder（後序）', rule: 'L R V：先左、再右、最後印自己', pass: 3 },
  };
  // 把遞迴展開成「游標停留」的步驟：每個節點最多經過 3 次（進入、從左回來、從右回來），
  // 前序在第 1 次印、中序第 2 次、後序第 3 次。
  function travSteps(root, kind) {
    const steps = [], stack = [], out = [];
    const emitPass = KIND[kind].pass;
    function st(n, pass, why) {
      const emit = pass === emitPass;
      if (emit) out.push(n.label);
      steps.push({ n, pass, emit, why: why + (emit ? ' → 輸出 ' + n.label : ''), stack: stack.map((x) => x.label), out: [...out] });
    }
    (function go(n) {
      stack.push(n);
      st(n, 1, '第 1 次到 ' + n.label + '（剛呼叫）');
      if (n.left) go(n.left);
      if (n.left || emitPass === 2) st(n, 2, n.left ? '左子樹做完，回到 ' + n.label + '（第 2 次）' : n.label + ' 沒有左子，第 2 次經過');
      if (n.right) go(n.right);
      if (n.right || emitPass === 3) st(n, 3, n.right ? '右子樹做完，回到 ' + n.label + '（第 3 次）' : n.label + ' 沒有右子，第 3 次經過');
      stack.pop();
    })(root);
    return steps;
  }
  const tv = { tree: 'expr', kind: 'in', root: null, steps: [], i: -1, outs: [], cur: null };
  function enterTrav() {
    fresh();
    lab.frameCamera([0, 5, 13.5], [0, 3.2, 0.8]);
    tv.root = TREES[tv.tree].make();
    spawnTree(tv.root);
    edgeLines(() => treePairs(tv.root));
    tv.cur = makeCursor();
    rowLabel('輸出', 2.4);
    tv.steps = travSteps(tv.root, tv.kind); tv.i = -1; tv.outs = [];
    controls(
      '<select id="tvTree">' + Object.keys(TREES).map((k) => '<option value="' + k + '">' + TREES[k].name + '</option>').join('') + '</select>'
      + '<select id="tvKind"><option value="pre">Preorder</option><option value="in">Inorder</option><option value="post">Postorder</option></select>'
      + '<button class="primary" id="tvNext">下一步</button><button id="tvAuto">自動播放</button><button id="tvReset">重來</button>'
    );
    $('tvTree').value = tv.tree; $('tvKind').value = tv.kind;
    $('tvTree').onchange = (e) => { tv.tree = e.target.value; clearLog(); enterTrav(); };
    $('tvKind').onchange = (e) => { tv.kind = e.target.value; clearLog(); enterTrav(); };
    on('tvNext', () => { stopTimer(); if (!travStep()) log('已經走完了，按「重來」或換一種走訪。'); });
    on('tvAuto', () => auto(travStep, 650));
    on('tvReset', () => { clearLog(); enterTrav(); });
    log(KIND[tv.kind].name + '：' + KIND[tv.kind].rule + '。金色圈 = 目前遞迴停在哪個節點。');
    renderTrav();
  }
  function travStep() {
    if (tv.i >= tv.steps.length - 1) return false;
    const s = tv.steps[++tv.i];
    cursorTo(tv.cur, s.n.pos);
    if (s.emit) {
      const b = lab.addBody(block(s.n.label, SMALL, depthColor(s.n.depth)));
      b.obj.position.copy(s.n.pos);
      lab.springTo(b, rowPos(tv.outs.length, 2.4));
      tv.outs.push(b);
      glow(s.n);
    }
    log(s.why);
    renderTrav();
    return true;
  }
  function renderTrav() {
    const s = tv.steps[tv.i];
    const done = tv.i === tv.steps.length - 1;
    const K = KIND[tv.kind];
    let extra = '';
    if (done && tv.tree === 'expr') extra = '<br>運算式樹的' + { pre: '前序 = prefix', in: '中序 = infix', post: '後序 = postfix' }[tv.kind];
    setState(K.name, [
      ['規則', K.rule.split('：')[0]],
      ['步驟', (tv.i + 1) + ' / ' + tv.steps.length],
      ['遞迴堆疊（底→頂）', s && s.stack.length ? s.stack.join(' ') : '空'],
      ['輸出', s && s.out.length ? s.out.join(' ') : '—'],
    ], '沿著樹的外圍繞一圈：第 1 次經過就印 = 前序、第 2 次 = 中序、第 3 次 = 後序'
      + (done ? '<br><span class="ok">完成：' + (s ? s.out.join('') : '') + '</span>' + extra : ''));
  }

  // ───────────────────────── Level-order（BFS，用 Queue） ─────────────────────────
  const lv = { tree: 'sample', root: null, q: [], outs: [], started: false, cur: null };
  const Q_Z = 3.8, OUT_Z = 2.3;
  function enterLevel() {
    fresh();
    lab.frameCamera([0, 5.2, 13.5], [0, 3.1, 1]);
    lv.root = TREES[lv.tree].make();
    spawnTree(lv.root);
    edgeLines(() => treePairs(lv.root));
    lv.cur = makeCursor();
    lv.q = []; lv.outs = []; lv.started = false;
    rowLabel('Queue', Q_Z);
    rowLabel('輸出', OUT_Z);
    const fl = lab.label('front', 'idx'); fl.position.set(ROW_X0, 0.95, Q_Z); lab.world.add(fl);
    controls(
      '<select id="lvTree">' + Object.keys(TREES).map((k) => '<option value="' + k + '">' + TREES[k].name + '</option>').join('') + '</select>'
      + '<button class="primary" id="lvNext">下一步</button><button id="lvAuto">自動播放</button><button id="lvReset">重來</button>'
    );
    $('lvTree').value = lv.tree;
    $('lvTree').onchange = (e) => { lv.tree = e.target.value; clearLog(); enterLevel(); };
    on('lvNext', () => { stopTimer(); if (!lvStep()) log('Queue 已經空了，走訪結束。'); });
    on('lvAuto', () => auto(lvStep, 1000));
    on('lvReset', () => { clearLog(); enterLevel(); });
    log('Level-order：一層一層、由左到右。做法：root 先進 Queue；之後每次 dequeue 一個印出來，再把它的左、右子 enqueue。');
    renderLevel();
  }
  function lvEnqueue(n) {
    const b = lab.addBody(block(n.label, SMALL, depthColor(n.depth)));
    b.obj.position.copy(n.pos);
    lab.springTo(b, rowPos(lv.q.length, Q_Z));
    lv.q.push({ n, b });
  }
  function lvStep() {
    if (!lv.started) {
      lv.started = true;
      lvEnqueue(lv.root);
      cursorTo(lv.cur, lv.root.pos);
      log('enqueue(' + lv.root.label + ')：先把 root 放進 Queue');
      renderLevel();
      return true;
    }
    if (!lv.q.length) return false;
    const { n, b } = lv.q.shift();
    lv.q.forEach((e, k) => lab.springTo(e.b, rowPos(k, Q_Z)));
    lab.springTo(b, rowPos(lv.outs.length, OUT_Z));
    lv.outs.push(n);
    cursorTo(lv.cur, n.pos);
    glow(n);
    const kids = [n.left, n.right].filter(Boolean);
    kids.forEach(lvEnqueue);
    log('dequeue → 輸出 ' + n.label + (kids.length ? '；enqueue 它的子節點 ' + kids.map((c) => c.label).join('、') : '（葉子，沒有子節點要放）'));
    renderLevel();
    return true;
  }
  function renderLevel() {
    const done = lv.started && !lv.q.length;
    setState('Level-order（BFS）', [
      ['Queue（front→rear）', lv.q.length ? lv.q.map((e) => e.n.label).join(' ') : '空'],
      ['已輸出', lv.outs.length ? lv.outs.map((n) => n.label).join(' ') : '—'],
    ], '迴圈：while Queue 不空 { x = dequeue；印 x；enqueue(x.left)；enqueue(x.right) }<br>'
      + '用 Queue（先進先出）才會一層一層；換成 Stack 就變成另一種順序'
      + (done ? '<br><span class="ok">完成：' + lv.outs.map((n) => n.label).join('') + '</span>' : ''));
  }

  // ───────────────────────── 完全 vs 完滿（用編號 1..15 表示位置） ─────────────────────────
  const HEAP_SETS = {
    full: { name: '完滿（full，深度 4）', set: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
    complete: { name: '完全（complete，10 個）', set: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    hole: { name: '有洞（不是 complete）', set: [1, 2, 3, 4, 5, 7, 8, 9] },
    strict: { name: '每個節點 0 或 2 子，但不是 complete', set: [1, 2, 3, 6, 7, 12, 13] },
  };
  function heapPos(i, topY = 6.6, step = 1.5, width = 11.6) {
    const d = Math.floor(Math.log2(i)), p = i - (1 << d);
    return V(((p + 0.5) / (1 << d) - 0.5) * width, topY - d * step, 0);
  }
  const hdepth = (i) => Math.floor(Math.log2(i));
  const hp = { preset: 'complete', set: new Set(), bodies: new Map() };
  function heapChecks(set) {
    const n = set.size;
    const maxI = n ? Math.max(...set) : 0;
    const k = n ? hdepth(maxI) + 1 : 0;
    const full = n > 0 && n === (1 << k) - 1;
    const complete = maxI === n;
    let strict = true;
    for (const i of set) if (set.has(2 * i) !== set.has(2 * i + 1)) strict = false;
    return { n, maxI, k, full, complete, strict };
  }
  function enterHeap() {
    fresh();
    lab.frameCamera([0, 4.8, 13.5], [0, 4.1, 0]);
    hp.set = new Set(); hp.bodies = new Map();
    for (let i = 1; i <= 15; i++) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(...NODE), new THREE.MeshBasicMaterial({ color: '#c9b48e', wireframe: true, transparent: true, opacity: 0.35 }));
      g.position.copy(heapPos(i));
      lab.world.add(g);
    }
    for (let d = 0; d < 4; d++) { const l = lab.label('level ' + (d + 1), 'idx'); l.position.set(-6.7, 6.6 - d * 1.5, 0); lab.world.add(l); }
    edgeLines(() => { const out = []; for (const [i, b] of hp.bodies) for (const c of [2 * i, 2 * i + 1]) if (hp.bodies.has(c)) out.push([b.obj.position, hp.bodies.get(c).obj.position]); return out; });
    HEAP_SETS[hp.preset].set.forEach((i) => heapAdd(i, true));
    controls(
      '<select id="hpPre">' + Object.keys(HEAP_SETS).map((k) => '<option value="' + k + '">' + HEAP_SETS[k].name + '</option>').join('') + '</select>'
      + '<label>編號 i = <input id="hpI" type="number" min="1" max="15" value="11"></label>'
      + '<button class="primary" id="hpAdd">加入 i</button><button id="hpDel">移除 i（連子樹）</button>'
      + '<button id="hpNext">補下一個編號</button><button id="hpLast">移除最大編號</button>'
    );
    $('hpPre').value = hp.preset;
    $('hpPre').onchange = (e) => { hp.preset = e.target.value; clearLog(); enterHeap(); };
    on('hpAdd', () => heapAdd(Number($('hpI').value)));
    on('hpDel', () => heapRemove(Number($('hpI').value)));
    on('hpNext', () => { for (let i = 1; i <= 15; i++) if (!hp.set.has(i) && (i === 1 || hp.set.has(i >> 1))) { heapAdd(i); return; } log('15 個位置都滿了（深度 4 的完滿二元樹）。', true); });
    on('hpLast', () => { if (!hp.set.size) { log('樹已經是空的。', true); return; } heapRemove(Math.max(...hp.set)); });
    log('每個位置照 level order 編號：root = 1，往下一層、由左到右。灰色框 = 深度 4 的完滿二元樹所有位置。');
    log('定義（洪逸／Horowitz）：完滿 full = 深度 k 剛好 2^k − 1 個節點；完全 complete = n 個節點剛好佔住編號 1..n。');
    renderHeap();
  }
  function heapAdd(i, instant) {
    if (!Number.isInteger(i) || i < 1 || i > 15) { log('編號要在 1..15（這裡只畫到深度 4）。', true); return false; }
    if (hp.set.has(i)) { log('編號 ' + i + ' 已經有節點了。', true); return false; }
    if (i > 1 && !hp.set.has(i >> 1)) { log('編號 ' + i + ' 的 parent 是 ⌊' + i + '/2⌋ = ' + (i >> 1) + '，它不存在，節點不能懸空。', true); return false; }
    const b = lab.addBody(block(i, NODE, depthColor(hdepth(i))));
    const p = heapPos(i);
    b.obj.position.copy(p);
    if (!instant) { b.obj.position.y += 5; lab.dropTo(b, p); log('加入編號 ' + i + '（parent = ' + (i >> 1 || '無') + '）'); }
    else b.target.copy(p);
    hp.set.add(i); hp.bodies.set(i, b);
    if (!instant) renderHeap();
    return true;
  }
  function heapRemove(i) {
    if (!hp.set.has(i)) { log('編號 ' + i + ' 沒有節點。', true); return; }
    const gone = [];
    (function rm(j) { if (!hp.set.has(j)) return; rm(2 * j); rm(2 * j + 1); hp.set.delete(j); lab.flyAway(hp.bodies.get(j), V(0, 8, 5)); hp.bodies.delete(j); gone.push(j); })(i);
    log('移除編號 ' + gone.sort((a, b) => a - b).join('、') + (gone.length > 1 ? '（子樹一起拿掉）' : ''));
    renderHeap();
  }
  function renderHeap() {
    const c = heapChecks(hp.set);
    const yes = (b) => '<span class="' + (b ? 'ok' : 'no') + '">' + (b ? '是' : '否') + '</span>';
    setState('完全 vs 完滿二元樹', [
      ['節點數 n', String(c.n)], ['深度 k（層數）', String(c.k)], ['2^k − 1', c.k ? String((1 << c.k) - 1) : '—'], ['最大編號', String(c.maxI || '—')],
    ], '完滿 full：n == 2^k − 1 → ' + yes(c.full) + '<br>'
      + '完全 complete：編號 1..n 連續沒有洞（最大編號 == n）→ ' + yes(c.complete) + '<br>'
      + '每個節點 0 或 2 子（strict）→ ' + yes(c.strict) + '<br>'
      + '完滿一定完全，完全不一定完滿');
    return c;
  }

  // ───────────────────────── 陣列表示法（1-based） ─────────────────────────
  const LETTERS = 'ABCDEFGHIJKLMNO';
  const AR_SETS = {
    complete: { name: '完全二元樹（n 可調）' },
    skewR: { name: '右偏斜樹（深度 4）', set: [1, 3, 7, 15] },
    skewL: { name: '左偏斜樹（深度 4）', set: [1, 2, 4, 8] },
    hole: { name: '一般二元樹（有洞）', set: [1, 2, 3, 5, 6, 11] },
  };
  const ar = { preset: 'complete', n: 10, set: new Set(), bodies: new Map(), cells: new Map(), tiles: [], temp: [] };
  const AR_TREE = (i) => heapPos(i, 6.9, 1.45, 11.2);
  const tilePos = (i) => V(-6 + i * 0.8, 0.04, 2.8);
  const TILE_BASE = '#e9dcc4';
  function enterArray() {
    fresh();
    lab.frameCamera([0, 5.2, 13.5], [0, 3.5, 1]);
    ar.set = new Set(ar.preset === 'complete' ? Array.from({ length: ar.n }, (_, k) => k + 1) : AR_SETS[ar.preset].set);
    ar.bodies = new Map(); ar.cells = new Map(); ar.tiles = []; ar.temp = [];
    const maxI = Math.max(15, ...ar.set);
    for (let i = 0; i <= maxI; i++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.9), new THREE.MeshStandardMaterial({ color: i === 0 ? '#cbbd9f' : TILE_BASE, roughness: 1 }));
      t.position.copy(tilePos(i)); t.receiveShadow = true; lab.world.add(t); ar.tiles.push(t);
      const l = lab.label(i === 0 ? '[0] 不用' : '[' + i + ']', 'idx'); l.position.copy(tilePos(i)).add(V(0, 0, 0.75)); lab.world.add(l);
    }
    for (const i of [...ar.set].sort((a, b) => a - b)) {
      const b = lab.addBody(block(LETTERS[i - 1], NODE, depthColor(hdepth(i))));
      b.obj.position.copy(AR_TREE(i)); b.target.copy(AR_TREE(i));
      const il = lab.label(String(i), 'idx'); il.position.set(0.62, -0.3, 0); b.obj.add(il);
      ar.bodies.set(i, b);
      const c = lab.addBody(block(LETTERS[i - 1], [0.56, 0.45, 0.56], depthColor(hdepth(i))));
      c.obj.position.copy(tilePos(i)).setY(0.3); c.target.copy(c.obj.position);
      ar.cells.set(i, c);
    }
    edgeLines(() => { const out = []; for (const [i, b] of ar.bodies) for (const c of [2 * i, 2 * i + 1]) if (ar.bodies.has(c)) out.push([b.obj.position, ar.bodies.get(c).obj.position]); return out; });
    controls(
      '<select id="arPre">' + Object.keys(AR_SETS).map((k) => '<option value="' + k + '">' + AR_SETS[k].name + '</option>').join('') + '</select>'
      + '<label>n = <input id="arN" type="number" min="1" max="15" value="' + ar.n + '"></label>'
      + '<label>i = <input id="arI" type="number" min="1" max="15" value="2"></label>'
      + '<button class="primary" id="arQ">查 parent / 子節點</button>'
    );
    $('arPre').value = ar.preset;
    $('arPre').onchange = (e) => { ar.preset = e.target.value; clearLog(); enterArray(); };
    $('arN').onchange = (e) => { ar.n = Math.max(1, Math.min(15, Number(e.target.value) || 10)); ar.preset = 'complete'; clearLog(); enterArray(); };
    on('arQ', () => arQuery(Number($('arI').value)));
    log('採洪逸／Horowitz 的 1-based：root 放 [1]，[0] 不用。節點編號 i 就是陣列索引。');
    renderArray();
  }
  function arClear() {
    ar.temp.forEach((l) => lab.world.remove(l)); ar.temp = [];
    ar.tiles.forEach((t, i) => t.material.color.set(i === 0 ? '#cbbd9f' : ar.set.has(i) ? TILE_BASE : '#f4d9d0'));
    ar.bodies.forEach((b) => b.obj.material.emissive.set('#000'));
  }
  function arTag(i, text, color, cls) {
    if (i < ar.tiles.length) {
      ar.tiles[i].material.color.set(color);
      const l = lab.label(text, cls); l.position.copy(tilePos(i)).setY(1.05); lab.world.add(l); ar.temp.push(l);
    }
    if (ar.bodies.has(i)) ar.bodies.get(i).obj.material.emissive.set(cls === 'ptr alt' ? '#4a3600' : '#163a2a');
  }
  function arQuery(i) {
    arClear();
    if (!ar.set.has(i)) { log('索引 ' + i + ' 沒有節點（' + (i < 1 ? '1-based 從 1 開始' : '這格是空的') + '）。', true); renderArray(); return null; }
    const p = i >> 1, l = 2 * i, r = 2 * i + 1;
    arTag(i, 'i = ' + i, '#f2c46d', 'ptr alt');
    const res = { i, p: i > 1 ? p : null, l: ar.set.has(l) ? l : null, r: ar.set.has(r) ? r : null };
    if (res.p) arTag(p, 'parent', '#cfe0f5', 'ptr');
    if (res.l) arTag(l, 'left', '#cfe8dc', 'ptr');
    if (res.r) arTag(r, 'right', '#cfe8dc', 'ptr');
    log(LETTERS[i - 1] + ' 在 [' + i + ']：parent = ⌊' + i + '/2⌋ = ' + (res.p ? p + '（' + LETTERS[p - 1] + '）' : '無（root）')
      + '，left = 2i = ' + l + (res.l ? '（' + LETTERS[l - 1] + '）' : '（空）')
      + '，right = 2i+1 = ' + r + (res.r ? '（' + LETTERS[r - 1] + '）' : '（空）'));
    renderArray(res);
    return res;
  }
  function renderArray(res) {
    const n = ar.set.size, maxI = Math.max(...ar.set);
    setState('陣列表示法（1-based）', [
      ['節點數 n', String(n)], ['用到的最大索引', String(maxI)], ['浪費的格子', String(maxI - n)],
      ['查詢', res ? 'i = ' + res.i + '：p=' + (res.p || '—') + '，L=' + (res.l || '—') + '，R=' + (res.r || '—') : '—'],
    ], 'parent(i) = ⌊i/2⌋、left(i) = 2i、right(i) = 2i+1<br>'
      + '若改用 0-based：parent = ⌊(i−1)/2⌋、left = 2i+1、right = 2i+2<br>'
      + (maxI === n ? '<span class="ok">完全二元樹：一格都不浪費</span>' : '<span class="no">不是完全二元樹：粉紅色格子是空著的</span>（偏斜樹深度 k 要 2^k − 1 格）'));
  }

  // ───────────────────────── 由 Inorder + Preorder／Postorder 重建 ─────────────────────────
  const rb = { kind: 'pre', seq: 'ABDEGCFHI', ino: 'DBGEACHFI', root: null, steps: [], i: -1, inTiles: [], seqBodies: [], xs: [] };
  function planRebuild(seq, ino, kind) {
    const s = seq.toUpperCase().replace(/[^A-Z0-9]/g, ''), m = ino.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!s.length || s.length > 12) return { err: '序列長度要 1..12。' };
    if (s.length !== m.length) return { err: '兩個序列長度不一樣（' + s.length + ' vs ' + m.length + '）。' };
    if (new Set(s).size !== s.length || new Set(m).size !== m.length) return { err: '節點名稱不能重複。' };
    if ([...s].sort().join('') !== [...m].sort().join('')) return { err: '兩個序列的字母集合不一樣。' };
    const steps = [];
    let idx = kind === 'pre' ? 0 : s.length - 1;
    function build(l, r) {
      if (l > r) return null;
      const si = idx;
      const ch = s[kind === 'pre' ? idx++ : idx--];
      const k = m.indexOf(ch);
      if (k < l || k > r) throw new Error(ch);
      const n = T(ch);
      steps.push({ n, l, r, k, si });
      if (kind === 'pre') { n.left = build(l, k - 1); n.right = build(k + 1, r); }
      else { n.right = build(k + 1, r); n.left = build(l, k - 1); }
      return n;
    }
    try { const root = build(0, m.length - 1); return { root, steps, s, m }; }
    catch (e) { return { err: '「' + e.message + '」不在它該在的 inorder 區段裡：這兩個序列不可能來自同一棵二元樹。' }; }
  }
  function enterRebuild() {
    fresh();
    lab.frameCamera([0, 5.2, 13.5], [0, 3.2, 1]);
    controls(
      '<select id="rbKind"><option value="pre">Preorder + Inorder</option><option value="post">Postorder + Inorder</option></select>'
      + '<label><span id="rbSeqName">' + (rb.kind === 'pre' ? 'pre' : 'post') + '</span> <input id="rbSeq" style="width:120px" value="' + rb.seq + '"></label>'
      + '<label>in <input id="rbIn" style="width:120px" value="' + rb.ino + '"></label>'
      + '<button id="rbGo">套用</button><button class="primary" id="rbNext">下一步</button><button id="rbAuto">自動播放</button>'
    );
    $('rbKind').value = rb.kind;
    $('rbKind').onchange = (e) => {
      rb.kind = e.target.value;
      // 換成同一棵範例樹的另一種序列
      const cur = planRebuild(rb.seq, rb.ino, rb.kind === 'pre' ? 'post' : 'pre');
      if (!cur.err) rb.seq = (rb.kind === 'pre' ? preorder(cur.root) : postorder(cur.root)).map((n) => n.label).join('');
      clearLog(); enterRebuild();
    };
    on('rbGo', () => { rb.seq = $('rbSeq').value; rb.ino = $('rbIn').value; clearLog(); enterRebuild(); });
    on('rbNext', () => { stopTimer(); if (!rebuildStep()) log('已經重建完成。'); });
    on('rbAuto', () => auto(rebuildStep, 1300));
    const plan = planRebuild(rb.seq, rb.ino, rb.kind);
    rb.steps = []; rb.i = -1; rb.root = null; rb.inTiles = []; rb.seqBodies = [];
    if (plan.err) { log(plan.err, true); setState('重建二元樹', [['狀態', '輸入有誤']], plan.err); return; }
    rb.root = plan.root; rb.steps = plan.steps; rb.s = plan.s; rb.m = plan.m;
    const { order } = layoutTree(rb.root);
    rb.xs = order.map((n) => n.pos.x);
    edgeLines(() => treePairs(rb.root));
    // inorder 列（地上，含底下的格子）與 pre/post 列
    rowLabel('in', 2.3);
    rowLabel(rb.kind === 'pre' ? 'pre' : 'post', 3.8);
    [...rb.m].forEach((ch, k) => {
      const t = new THREE.Mesh(new THREE.BoxGeometry(Math.min(1.1, (rb.xs[1] - rb.xs[0]) || 1.1) * 0.92, 0.08, 0.9), new THREE.MeshStandardMaterial({ color: TILE_BASE, roughness: 1 }));
      t.position.set(rb.xs[k], 0.04, 2.3); t.receiveShadow = true; lab.world.add(t); rb.inTiles.push(t);
      const b = lab.addBody(block(ch, SMALL, '#8fa3b8')); b.obj.position.set(rb.xs[k], 0.33, 2.3); b.target.copy(b.obj.position);
    });
    [...rb.s].forEach((ch, j) => {
      const b = lab.addBody(block(ch, SMALL, '#b9a582')); b.obj.position.set(rb.xs[j], 0.33, 3.8); b.target.copy(b.obj.position);
      rb.seqBodies.push(b);
    });
    log(rb.kind === 'pre'
      ? 'Preorder 的第一個一定是 root；在 Inorder 找到它，左邊就是左子樹、右邊就是右子樹，再遞迴。'
      : 'Postorder 的最後一個一定是 root；從後面往前取，所以要先建右子樹、再建左子樹。');
    log('注意：只有 Preorder + Postorder 無法唯一決定一棵二元樹（只有一個子節點時分不出左右）。');
    renderRebuild();
  }
  function rebuildStep() {
    if (rb.i >= rb.steps.length - 1) return false;
    const s = rb.steps[++rb.i];
    rb.seqBodies.forEach((b, j) => b.obj.material.emissive.set(j === s.si ? '#4a3600' : '#000'));
    lab.springTo(rb.seqBodies[s.si], V(rb.xs[s.si], 0.75, 3.8));
    if (rb.i > 0) { const prev = rb.steps[rb.i - 1]; lab.springTo(rb.seqBodies[prev.si], V(rb.xs[prev.si], 0.33, 3.8)); }
    rb.inTiles.forEach((t, k) => t.material.color.set(k < s.l || k > s.r ? TILE_BASE : k < s.k ? '#cfe0f5' : k === s.k ? '#f2c46d' : '#cfe8dc'));
    const b = nodeBody(s.n);
    b.obj.position.copy(s.n.pos).add(V(0, 5, 0));
    lab.dropTo(b, s.n.pos);
    const left = rb.m.slice(s.l, s.k), right = rb.m.slice(s.k + 1, s.r + 1);
    log((rb.kind === 'pre' ? 'Preorder 下一個' : 'Postorder 從後面數下一個') + ' = ' + s.n.label + ' → 當這段的 root；inorder 切成 左「' + (left || '空') + '」、右「' + (right || '空') + '」');
    renderRebuild();
    return true;
  }
  function renderRebuild() {
    const s = rb.steps[rb.i];
    const done = rb.steps.length && rb.i === rb.steps.length - 1;
    const other = rb.root ? (rb.kind === 'pre' ? 'Postorder = ' + str(postorder(rb.root)) : 'Preorder = ' + str(preorder(rb.root))) : '';
    setState('Inorder + ' + (rb.kind === 'pre' ? 'Preorder' : 'Postorder') + ' 重建', [
      [rb.kind === 'pre' ? 'Preorder' : 'Postorder', rb.s || '—'], ['Inorder', rb.m || '—'],
      ['步驟', (rb.i + 1) + ' / ' + rb.steps.length],
      ['目前 root', s ? s.n.label + '（inorder 區段 ' + rb.m.slice(s.l, s.r + 1) + '）' : '—'],
    ], '藍色格 = 左子樹、金色 = root、綠色 = 右子樹' + (done ? '<br><span class="ok">重建完成</span>：' + other : ''));
  }

  // ───────────────────────── 文字頁：小測驗 ─────────────────────────
  function svgTree(root) {
    const { order, maxD } = layoutTree(root, { cx: 0, width: 10, topY: 0, minY: -10, maxStep: 1, maxSp: 1.4 });
    const W = 340, H = 40 + maxD * 52;
    const X = (n) => W / 2 + n.pos.x * 26, Y = (n) => 22 - n.pos.y * 52;
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" style="display:block;margin:6px 0;max-width:100%">';
    order.forEach((n) => [n.left, n.right].forEach((c) => { if (c) s += '<line x1="' + X(n) + '" y1="' + Y(n) + '" x2="' + X(c) + '" y2="' + Y(c) + '" stroke="var(--mt)" stroke-width="1.5"/>'; }));
    order.forEach((n) => { s += '<circle cx="' + X(n) + '" cy="' + Y(n) + '" r="14" fill="var(--surf2)" stroke="var(--mt)" stroke-width="1.5"/><text x="' + X(n) + '" y="' + (Y(n) + 5) + '" text-anchor="middle" font-size="14" font-weight="700" fill="var(--tx)">' + n.label + '</text>'; });
    return s + '</svg>';
  }
  function fill(opts, ans, extra) {
    const set = [...new Set([ans, ...opts])];
    for (const e of extra) { if (set.length >= 4) break; if (!set.includes(e)) set.push(e); }
    return set.slice(0, 4);
  }
  function genQ() {
    const kind = rnd(6);
    if (kind === 0 || kind === 1) {
      const root = labelLevel(randomShape(5 + rnd(4)), true);
      const seqs = { pre: str(preorder(root)), in: str(inorder(root)), post: str(postorder(root)), level: str(levelorder(root)) };
      const names = { pre: 'Preorder', in: 'Inorder', post: 'Postorder', level: 'Level-order' };
      if (kind === 0) {
        const k = ['pre', 'in', 'post', 'level'][rnd(4)];
        return { q: '這棵二元樹的 ' + names[k] + ' 是？' + svgTree(root), ans: seqs[k],
          opts: fill(Object.values(seqs), seqs[k], [seqs[k].split(' ').reverse().join(' ')]),
          why: names[k] + ' 規則：' + { pre: 'V L R', in: 'L V R', post: 'L R V', level: '用 Queue 一層一層、由左到右' }[k] + '。其他選項：前序 ' + seqs.pre + '、中序 ' + seqs.in + '、後序 ' + seqs.post + '。' };
      }
      return { q: '一棵二元樹的 Preorder = ' + seqs.pre.replace(/ /g, '') + '，Inorder = ' + seqs.in.replace(/ /g, '') + '。它的 Postorder 是？', ans: seqs.post,
        opts: fill([seqs.level, seqs.pre.split(' ').reverse().join(' '), seqs.in.split(' ').reverse().join(' ')], seqs.post, [seqs.pre]),
        why: 'Preorder 第一個 ' + root.label + ' 是 root，在 Inorder 切開左右子樹再遞迴，畫出樹之後照 L R V 走。' + svgTree(root) };
    }
    if (kind === 2) {
      const i = 2 + rnd(9);
      const f = (p, l, r) => 'parent = ' + p + '，left = ' + l + '，right = ' + r;
      const ans = f(i >> 1, 2 * i, 2 * i + 1);
      return { q: '完全二元樹用陣列存（1-based，root 在 [1]）。索引 ' + i + ' 的節點：', ans,
        opts: fill([f((i - 1) >> 1, 2 * i + 1, 2 * i + 2), f(i >> 1, 2 * i - 1, 2 * i), f(i - 1, 2 * i, 2 * i + 1)], ans, [f(i + 1 >> 1, 2 * i + 1, 2 * i + 2)]),
        why: '1-based：parent = ⌊i/2⌋、left = 2i、right = 2i+1。(i−1)/2、2i+1、2i+2 是 0-based 的公式，常被混用。' };
    }
    if (kind === 3) {
      const n = 5 + rnd(40);
      const ans = Math.ceil(Math.log2(n + 1));
      return { q: '有 ' + n + ' 個節點的完全二元樹，深度（層數，root 在 level 1）是多少？', ans: String(ans),
        opts: fill([String(Math.floor(Math.log2(n))), String(ans + 1), String(ans - 1)], String(ans), [String(ans + 2)]),
        why: '深度 k 最多 2^k − 1 個節點，所以 k = ⌈log₂(n+1)⌉ = ⌈log₂ ' + (n + 1) + '⌉ = ' + ans + '。（等價於 ⌊log₂ n⌋ + 1）' };
    }
    if (kind === 4) {
      const n2 = 2 + rnd(10), n1 = rnd(6);
      return { q: '一棵二元樹有 ' + n2 + ' 個 degree 2 的節點、' + n1 + ' 個 degree 1 的節點。葉節點有幾個？', ans: String(n2 + 1),
        opts: fill([String(n2), String(n2 + n1), String(n2 - 1)], String(n2 + 1), [String(n2 + n1 + 1)]),
        why: 'n₀ = n₂ + 1，跟 n₁ 無關。（邊數 = n − 1 = n₁ + 2n₂，n = n₀ + n₁ + n₂，相減得到）' };
    }
    const k = 3 + rnd(5);
    const ans = String((1 << k) - 1);
    return { q: '深度 k = ' + k + ' 的完滿二元樹（full binary tree，root 在 level 1）共有幾個節點？', ans,
      opts: fill([String(1 << k), String(1 << (k - 1)), String((1 << (k + 1)) - 1)], ans, []),
      why: '1 + 2 + 4 + … + 2^(k−1) = 2^k − 1 = ' + ans + '；其中葉子有 2^(k−1) = ' + (1 << (k - 1)) + ' 個。' };
  }
  const qs = { score: 0, total: 0 };
  function renderQuiz(el) {
    const p = genQ();
    const opts = [...p.opts].sort(() => Math.random() - 0.5);
    el.innerHTML = '<h2>小測驗</h2><div class="lab-quiz-score">答對 ' + qs.score + ' / ' + qs.total + '</div>'
      + '<div class="lab-quiz-q">' + p.q + '</div><div class="lab-quiz-opts">'
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

  // ───────────────────────── 舞台場景 ─────────────────────────
  async function travScene(tok, kind) {
    tv.tree = (ctx.params || {}).tree || 'expr'; tv.kind = kind; enterTrav();
    const K = KIND[kind];
    say(K.name + '：' + K.rule.split('：')[1], K.rule.split('：')[0]);
    await beat(tok, 1800);
    while (travStep()) {
      const s = tv.steps[tv.i];
      say(s.emit ? '第 ' + s.pass + ' 次經過 ' + s.n.label + ' → 輸出' : s.why, '輸出：' + (s.out.join(' ') || '—'));
      await beat(tok, s.emit ? 900 : 550);
    }
    const out = tv.steps[tv.steps.length - 1].out.join('');
    say(tv.tree === 'expr' ? { pre: '運算式樹的前序 = prefix 運算式', in: '中序 = 我們平常寫的 infix', post: '後序 = postfix，可以直接用 stack 計算' }[kind] : K.name + ' 完成', '<span class="ok">' + out + '</span>');
    await beat(tok, 3000);
  }
  const scenes = {
    'tree-terms': { title: '二元樹的名詞：root、leaf、degree、level', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5, 13.5], [0, 3.6, 0]);
      const root = TREES.sample.make();
      layoutTree(root);
      edgeLines(() => treePairs(root));
      say('二元樹：每個節點最多兩個子節點', '');
      for (const n of levelorder(root)) { const b = nodeBody(n); b.obj.position.copy(n.pos).add(V(0, 5, 0)); lab.dropTo(b, n.pos); await beat(tok, 420); }
      await beat(tok, 800);
      glow(root, '#4a3600'); say('最上面的 A 是 root，沒有 parent', 'root 在 level 1（洪逸慣例）');
      await beat(tok, 2400); glow(root, '#000');
      const leaves = levelorder(root).filter((n) => !n.left && !n.right);
      leaves.forEach((n) => glow(n, '#4a3600'));
      say('沒有子節點的叫 leaf（degree 0）', 'leaf：' + leaves.map((n) => n.label).join('、'));
      await beat(tok, 2600); leaves.forEach((n) => glow(n, '#000'));
      for (let d = 0; d < 4; d++) { const l = lab.label('level ' + (d + 1), 'idx'); l.position.set(-6.8, 6.6 - d * 1.45, 0); lab.world.add(l); }
      say('level：root 是 1，往下每層 +1', '深度（depth）= 最大 level = 4');
      await beat(tok, 2600);
      const n2 = levelorder(root).filter((n) => n.left && n.right);
      n2.forEach((n) => glow(n, '#163a2a')); leaves.forEach((n) => glow(n, '#4a3600'));
      say('degree 2 有 ' + n2.length + ' 個，leaf 有 ' + leaves.length + ' 個', '<span class="ok">n₀ = n₂ + 1</span> 對所有二元樹都成立');
      await beat(tok, 3200);
    } },
    'preorder': { title: 'Preorder 走訪（V L R）', play: (tok) => travScene(tok, 'pre') },
    'inorder': { title: 'Inorder 走訪（L V R）', play: (tok) => travScene(tok, 'in') },
    'postorder': { title: 'Postorder 走訪（L R V）', play: (tok) => travScene(tok, 'post') },
    'level-order': { title: 'Level-order：用 Queue 一層一層走', play: async (tok) => {
      lv.tree = (ctx.params || {}).tree || 'sample'; enterLevel();
      say('Level-order：一層一層、由左到右', '工具：Queue（先進先出）');
      await beat(tok, 1800);
      while (lvStep()) {
        const last = lv.outs[lv.outs.length - 1];
        say(lv.outs.length ? 'dequeue ' + last.label + ' 印出，子節點 enqueue' : 'root 先 enqueue', 'Queue：' + (lv.q.map((e) => e.n.label).join(' ') || '空'));
        await beat(tok, 1150);
      }
      say('Queue 空了就結束', '<span class="ok">' + lv.outs.map((n) => n.label).join(' ') + '</span>');
      await beat(tok, 3000);
    } },
    'complete-vs-full': { title: '完全二元樹 vs 完滿二元樹', play: async (tok) => {
      hp.preset = 'full'; enterHeap();
      say('完滿（full）：深度 4，每層都滿', 'n = 2⁴ − 1 = 15');
      await beat(tok, 2800);
      for (const i of [15, 14, 13, 12, 11]) { heapRemove(i); say('從最大編號往回拿掉', 'n = ' + hp.set.size + '，編號 1..' + hp.set.size + ' 連續'); await beat(tok, 900); }
      say('完全（complete）：編號 1..n 連續、沒有洞', '<span class="ok">complete</span>，但 <span class="no">不是 full</span>');
      await beat(tok, 3000);
      heapRemove(5);
      const c = heapChecks(hp.set);
      say('拿掉 5（連同 10）：中間出現洞', '最大編號 ' + c.maxI + ' ≠ n = ' + c.n + ' → <span class="no">不是 complete</span>');
      await beat(tok, 3200);
      heapAdd(5); await beat(tok, 500); heapAdd(10);
      say('補回去又變成 complete', '完滿一定完全，完全不一定完滿');
      await beat(tok, 2800);
    } },
    'array-rep': { title: '完全二元樹的陣列表示法（1-based）', play: async (tok) => {
      ar.preset = 'complete'; ar.n = 10; enterArray();
      say('照 level order 編號，編號就是陣列索引', 'root 放 [1]，[0] 不用（洪逸慣例）');
      await beat(tok, 2600);
      for (const i of [2, 3, 5]) {
        const r = arQuery(i);
        say('索引 ' + i + '：parent ⌊' + i + '/2⌋，子節點 2i、2i+1', 'parent = ' + (r.p || '—') + '，left = ' + 2 * i + (r.l ? '' : '（空）') + '，right = ' + (2 * i + 1) + (r.r ? '' : '（空）'));
        await beat(tok, 3000);
      }
      ar.preset = 'skewR'; enterArray();
      say('偏斜樹也用這套編號：4 個節點要 15 格', '<span class="no">浪費 11 格</span>：陣列表示只適合完全二元樹');
      await beat(tok, 3600);
    } },
    'rebuild': { title: '由 Preorder + Inorder 重建二元樹', play: async (tok) => {
      rb.kind = 'pre'; rb.seq = 'ABDEGCFHI'; rb.ino = 'DBGEACHFI'; enterRebuild();
      say('Preorder 第一個是 root；在 Inorder 找它切左右', 'pre = ABDEGCFHI，in = DBGEACHFI');
      await beat(tok, 2600);
      while (rebuildStep()) {
        const s = rb.steps[rb.i];
        say(s.n.label + ' 當 root：左「' + (rb.m.slice(s.l, s.k) || '空') + '」右「' + (rb.m.slice(s.k + 1, s.r + 1) || '空') + '」', '在 inorder 區段 ' + rb.m.slice(s.l, s.r + 1) + ' 裡切開');
        await beat(tok, 1700);
      }
      say('重建完成，可以驗算後序', 'Postorder = <span class="ok">' + str(postorder(rb.root)).replace(/ /g, '') + '</span>');
      await beat(tok, 3000);
    } },
  };

  return {
    kicker: '資料結構・第 3 章',
    title: '樹（基礎）：Binary Tree、走訪、完全二元樹',
    color: 'var(--ds)',
    modes: [
      { id: 'trav', name: '前中後序走訪', enter: enterTrav },
      { id: 'level', name: 'Level-order', enter: enterLevel },
      { id: 'heap', name: '完全 vs 完滿', enter: enterHeap },
      { id: 'array', name: '陣列表示法', enter: enterArray },
      { id: 'rebuild', name: '重建二元樹', enter: enterRebuild },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['tree-terms', 'preorder', 'inorder', 'postorder', 'level-order', 'complete-vs-full', 'array-rep', 'rebuild'],
    stop() { stopTimer(); epoch++; },
  };
}
