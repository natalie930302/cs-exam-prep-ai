// 資料結構 第3章：樹（基礎）— Binary Tree、走訪、完全二元樹。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 慣例（洪逸／Horowitz）：root 在 level 1；深度 k 的完滿二元樹（full）有 2^k − 1 個節點；
// 陣列表示法用 1-based：parent(i) = ⌊i/2⌋、left(i) = 2i、right(i) = 2i+1，[0] 不用。
import kit from './_kit.js';

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
    if (shuffle) letters.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
    nodes.forEach((n, i) => { n.label = letters[i]; });
    return root;
  }

  const TREES = {
    expr: { name: '運算式樹 A/B*C*D+E（例）', make: () => T('+', T('*', T('*', T('/', T('A'), T('B')), T('C')), T('D')), T('E')) },
    sample: { name: '一般二元樹（9 個節點）', make: () => T('A', T('B', T('D'), T('E', T('G'))), T('C', null, T('F', T('H'), T('I')))) },
    random: { name: '隨機樹', make: () => labelLevel(randomShape(6 + rnd(4))) },
    hindi: { name: '影片例 A(B(,D),C(E(G,),F(H,I)))', make: () => parseTree('A(B(,D),C(E(G,),F(H,I)))') },
    bari: { name: 'Abdul Bari 例 3(6(5,2),4(9,8))', make: () => parseTree('3(6(5,2),4(9,8))') },
  };
  // 樹的文字表示：X(左,右)，空子樹留白，例如 A(B(,D),C)；X(Y) = 只有左子
  function parseTree(src) {
    let i = 0;
    const s = String(src).replace(/\s+/g, '');
    function node() {
      let lab = '';
      while (i < s.length && !'(),'.includes(s[i])) lab += s[i++];
      if (!lab) return null;
      const n = T(lab);
      if (s[i] === '(') {
        i++;
        n.left = node();
        if (s[i] === ',') { i++; n.right = node(); }
        if (s[i] === ')') i++;
      }
      return n;
    }
    return node();
  }
  const makeTree = (key) => (TREES[key] ? TREES[key].make() : parseTree(key));

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
    tv.root = makeTree(tv.tree);
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
    if (TREES[tv.tree]) $('tvTree').value = tv.tree; $('tvKind').value = tv.kind;
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
    lv.root = makeTree(lv.tree);
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
    if (TREES[lv.tree]) $('lvTree').value = lv.tree;
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
    const opts = [...p.opts].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
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
    const out = tv.steps[tv.steps.length - 1].out.join(' ');
    say(tv.tree === 'expr' ? { pre: '運算式樹的前序 = prefix 運算式', in: '中序 = 我們平常寫的 infix', post: '後序 = postfix，可以直接用 stack 計算' }[kind] : K.name + ' 完成', '<span class="ok">' + out + '</span>');
    await beat(tok, 3000);
  }
  // ───────────────────────── 講師例子用的小工具 ─────────────────────────
  const GOLD = '#4a3600', GREEN = '#163a2a', RED = '#4a1010', OFF = '#000';
  function tag(text, cls, x, y, z = 0) { const l = lab.label(text, cls); l.position.set(x, y, z); lab.world.add(l); return l; }
  function setTag(l, text) { l.element.textContent = text; }
  function seg(a, b, color = '#c08a1f') {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const ln = new THREE.Line(g, new THREE.LineBasicMaterial({ color }));
    lab.world.add(ln);
    return ln;
  }
  function cube(v, color, size, x, y, z = 0, drop = 0) {
    const b = lab.addBody(block(v, size || NODE, color));
    b.obj.position.set(x, y + drop, z);
    if (drop) lab.dropTo(b, V(x, y, z)); else b.target.set(x, y, z);
    return b;
  }
  const lit = (b, c) => b.obj.material.emissive.set(c || OFF);
  // 依講師的樹畫出來（中序決定 x、深度決定 y），回傳 root；opts 可改版面
  function showTree(src, opts, dropMs) {
    const root = typeof src === 'string' ? makeTree(src) : src;
    layoutTree(root, Object.assign({}, TREE_O, opts || {}));
    levelorder(root).forEach((n) => { nodeBody(n).obj.position.copy(n.pos); n.body.target.copy(n.pos); });
    edgeLines(() => treePairs(root));
    return root;
  }
  async function dropTree(tok, src, opts, ms = 300) {
    const root = typeof src === 'string' ? makeTree(src) : src;
    layoutTree(root, Object.assign({}, TREE_O, opts || {}));
    edgeLines(() => treePairs(root));
    for (const n of levelorder(root)) { const b = nodeBody(n); b.obj.position.copy(n.pos).add(V(0, 4, 0)); lab.dropTo(b, n.pos.clone()); await beat(tok, ms); }
    return root;
  }
  const allNodes = (root) => levelorder(root);
  const find = (root, label) => allNodes(root).find((n) => n.label === label);

  // 三種走訪的規則：V L R／L V R／L R V（小樹 root + 左右子）
  async function scTravRules(tok) {
    fresh();
    lab.frameCamera([0, 4.6, 13], [0, 3.2, 0]);
    const kinds = [['pre', 'Preorder', ['V', 'L', 'R']], ['in', 'Inorder', ['L', 'V', 'R']], ['post', 'Postorder', ['L', 'R', 'V']]];
    const minis = kinds.map(([k, name], j) => {
      const cx = -4.4 + j * 4.4;
      const r = cube('root', '#2fc092', [1.1, 0.6, 0.8], cx, 4.8), l = cube('L', '#4b9ee2', [0.8, 0.6, 0.8], cx - 1.3, 3.1), rr = cube('R', '#9b7ef4', [0.8, 0.6, 0.8], cx + 1.3, 3.1);
      seg(V(cx, 4.5, 0), V(cx - 1.3, 3.4, 0), '#7a6a52'); seg(V(cx, 4.5, 0), V(cx + 1.3, 3.4, 0), '#7a6a52');
      tag(name, 'ptr', cx, 6.1);
      return { k, cx, map: { V: r, L: l, R: rr } };
    });
    say('走訪 = 每個節點拜訪剛好一次', '三種差別只在 root 什麼時候印');
    await beat(tok, 2600);
    for (let j = 0; j < 3; j++) {
      const [k, name, ord] = kinds[j], m = minis[j];
      say(name + '：' + ord.map((x) => (x === 'V' ? 'root' : x === 'L' ? 'left' : 'right')).join(' → '), ord.join(' ') + (k === 'pre' ? '（root 最先）' : k === 'in' ? '（root 在中間）' : '（root 最後）'));
      for (let s = 0; s < 3; s++) {
        const b = m.map[ord[s]];
        lit(b, GOLD);
        tag(String(s + 1), 'ptr alt', b.obj.position.x, b.obj.position.y - 0.85);
        await beat(tok, 900);
        lit(b);
      }
      await beat(tok, 1200);
    }
    say('pre／in／post 指的是 root 的位置', '左一定在右前面');
    await beat(tok, 3000);
  }

  // Abdul Bari 的畫線法：從每個節點的左邊／正下方／右邊拉線到底線，由左往右讀
  async function scTravFlags(tok) {
    const P = ctx.params || {};
    const kind = P.kind || 'pre';
    fresh();
    lab.frameCamera([0, 4.4, 13.5], [0, 3.4, 0]);
    const root = showTree(P.tree || 'bari', { topY: 6.4, minY: 3.0 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(12, 0.06, 0.12), new THREE.MeshStandardMaterial({ color: '#7a6a52' }));
    base.position.set(0, 0.9, 0); lab.world.add(base);
    const where = { pre: '左邊', in: '正下方', post: '右邊' }[kind];
    const name = KIND[kind].name;
    say(name + '：從每個節點的「' + where + '」拉一條線到底線', '線不能交叉，然後由左往右讀');
    const cur = makeCursor();
    await beat(tok, 2600);
    const steps = travSteps(root, kind);
    const n = allNodes(root).length;
    const bx = (k) => -5.4 + k * (10.8 / Math.max(1, n - 1));
    const out = [];
    const off = [null, V(-0.62, 0, 0), V(0, -0.5, 0), V(0.62, 0, 0)];
    for (const s of steps) {
      const p = s.n.pos.clone().add(off[s.pass]);
      cursorTo(cur, p);
      if (s.emit) {
        const k = out.length;
        out.push(s.n.label);
        glow(s.n, GOLD);
        seg(p, V(bx(k), 0.95, 0));
        const b = cube(s.n.label, depthColor(s.n.depth), SMALL, bx(k), 0.33, 0.9, 2);
        say('沿著樹的外圍走，碰到 ' + s.n.label + ' 的' + where + ' → 落到底線', out.join(' '));
        await beat(tok, 1000);
      } else await beat(tok, 380);
    }
    cur.obj.visible = false;
    say(name + '（由左往右讀底線）', '<span class="ok">' + out.join(' ') + '</span>');
    await beat(tok, 3200);
  }

  const LECT = {};
  // @@LECT@@
  // ═════════════════════ 講師例子場景（逐段對齊影片） ═════════════════════
  const MONO = { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '11px', fontWeight: '600' };
  function kill(o) {
    if (!o) return;
    for (const b of lab.bodies) if (b.obj === o || b === o) { lab.removeBody(b); return; }
    lab.world.remove(o); o.traverse((c) => { if (c.element) c.element.remove(); });
  }
  // 程式碼面板：每行一個 label，hl(i) 讓第 i 行變金色
  function code(lines, x, yTop, dy = 0.5, z = 0) {
    const w = Math.max(...lines.map((s) => s.length));
    const ls = lines.map((s, i) => { const l = tag(s.padEnd(w, ' '), '', x, yTop - i * dy, z); Object.assign(l.element.style, MONO); return l; });
    return { ls, hl(i) { ls.forEach((l, k) => { l.element.className = 'lab-label' + (k === i ? ' ptr alt' : ''); }); }, kill() { ls.forEach(kill); } };
  }
  function arrow(a, b, color = '#7a6a52', dashed = false) {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const m = dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.18, gapSize: 0.12 }) : new THREE.LineBasicMaterial({ color });
    const ln = new THREE.Line(g, m);
    if (dashed) ln.computeLineDistances();
    const dir = b.clone().sub(a).normalize();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 10), new THREE.MeshBasicMaterial({ color }));
    cone.position.copy(b).addScaledVector(dir, -0.13);
    cone.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
    ln.add(cone);
    lab.world.add(ln);
    return ln;
  }
  // 半透明框：圈出 subtree／區塊
  function ghost(color, x, y, w, h, z = 0, d = 1.1) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false }));
    m.position.set(x, y, z); lab.world.add(m); return m;
  }
  const W = (s) => Math.max(0.8, 0.26 * [...String(s)].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 2 : 1), 0) + 0.3);
  async function anim(tok, ms, fn) { const steps = 12; for (let k = 1; k <= steps; k++) { fn(k / steps); await beat(tok, ms / steps); } }

  // ── 一般樹（多個子節點）：G 記法 A(B,C(D))，葉子等距排、parent 置中 ──
  function parseG(src) {
    let i = 0; const s = String(src).replace(/\s+/g, '');
    function node() {
      let lab2 = ''; while (i < s.length && !'(),'.includes(s[i])) lab2 += s[i++];
      const n = { label: lab2, kids: [] };
      if (s[i] === '(') { i++; for (;;) { n.kids.push(node()); if (s[i] === ',') { i++; continue; } if (s[i] === ')') i++; break; } }
      return n;
    }
    return node();
  }
  function gAll(r, out = []) { out.push(r); r.kids.forEach((k) => gAll(k, out)); return out; }
  function layoutG(root, o = {}) {
    const O = Object.assign({ cx: 0, width: 11, topY: 6.4, step: 1.6, z: 0 }, o);
    const leaves = []; (function w(n, d) { n.depth = d; if (!n.kids.length) leaves.push(n); n.kids.forEach((k) => w(k, d + 1)); })(root, 0);
    const sp = leaves.length > 1 ? O.width / (leaves.length - 1) : 0;
    leaves.forEach((n, k) => { n.x = O.cx + (k - (leaves.length - 1) / 2) * sp; });
    (function px(n) { if (n.kids.length) { n.kids.forEach(px); n.x = (n.kids[0].x + n.kids[n.kids.length - 1].x) / 2; } })(root);
    gAll(root).forEach((n) => { n.pos = V(n.x, O.topY - n.depth * O.step, O.z); });
    return root;
  }
  function spawnG(root, o = {}, opt = {}) {
    layoutG(root, o);
    const size = opt.size || ((n) => [W(n.label), 0.6, 0.8]);
    for (const n of gAll(root)) {
      const b = lab.addBody(block(n.label, size(n), opt.color ? opt.color(n) : depthColor(n.depth)));
      b.obj.position.copy(n.pos); b.target.copy(n.pos); n.body = b;
    }
    edgeLines(() => { const out = []; for (const n of gAll(root)) for (const k of n.kids) if (n.body && k.body) out.push([n.body.obj.position, k.body.obj.position]); return out; });
    return root;
  }
  const gFind = (root, l) => gAll(root).find((n) => n.label === l);
  const gLit = (n, c) => n && n.body && n.body.obj.material.emissive.set(c || OFF);

  // ─── XkNIHYd9Ruc（台大林軒田 DSA：Tree，前半 07:15–93:12） ───
  {
    const NTU = 'NTU(理學院(數學系,物理系),工學院(土木系),社科院,電資學院(資訊系,電機系))';
    const TERMS = 'A(B(E(K,L),F),C(G),D(H(M),I,J))';
    const BLUE = '#10304a';
    const SIB = '#4b9ee2', KID = '#c08a1f';
    const gBox = (n) => [W(n.label), 0.6, 0.8];
    // 逐步長出一般樹：先算版面，節點建立後才畫線
    function growG(src, o) {
      const root = layoutG(parseG(src), o);
      edgeLines(() => { const out = []; for (const n of gAll(root)) for (const k of n.kids) if (n.body && k.body) out.push([n.body.obj.position, k.body.obj.position]); return out; });
      return root;
    }
    function addG(n, drop = 0) {
      const b = lab.addBody(block(n.label, gBox(n), depthColor(n.depth)));
      if (drop) { b.obj.position.copy(n.pos).add(V(0, drop, 0)); lab.dropTo(b, n.pos.clone()); }
      else { b.obj.position.copy(n.pos); b.target.copy(n.pos); }
      n.body = b; return b;
    }
    // 圈出一棵 subtree 的半透明框
    function boxSub(n, color) {
      const all = gAll(n);
      const x0 = Math.min(...all.map((m) => m.pos.x - W(m.label) / 2)) - 0.12, x1 = Math.max(...all.map((m) => m.pos.x + W(m.label) / 2)) + 0.12;
      const y0 = Math.min(...all.map((m) => m.pos.y)) - 0.45, y1 = n.pos.y + 0.45;
      return ghost(color, (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0);
    }
    // 依中心連線（線段跟著方塊走），pairs() 回傳 [[posA, posB], …]
    function dynLines(pairs, color) {
      const MAX = 24, geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 6), 3));
      const ls = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color }));
      ls.frustumCulled = false;
      ls.onBeforeRender = () => {
        const a = geo.attributes.position.array; let k = 0;
        for (const [P, C] of pairs()) { a[k++] = P.x; a[k++] = P.y; a[k++] = P.z - 0.05; a[k++] = C.x; a[k++] = C.y; a[k++] = C.z - 0.05; }
        geo.setDrawRange(0, k / 3); geo.attributes.position.needsUpdate = true;
      };
      lab.world.add(ls); return ls;
    }

    // 1. 平的 vs 有階層的
    LECT['lina-hierarchy'] = { title: 'Vector／list 是平的，tree 有階層', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.6, 13.5], [0, 3.6, 0]);
      const items = ['NTU', '理', '工', '電資', '數學', '資訊', '電機'];
      const S = [1.3, 0.6, 0.8];
      say('Vector：資料攤平排成一列', '示意：拿台大組織的 7 筆資料來排');
      const bs = [], tmp = [];
      for (let i = 0; i < items.length; i++) {
        bs.push(cube(items[i], '#4b9ee2', S, -4.8 + i * 1.6, 1.0, 0, 3));
        tmp.push(tag('[' + i + ']', 'idx', -4.8 + i * 1.6, 0.25));
        await beat(tok, 380);
      }
      await beat(tok, 2200);
      say('Linked list：一個接一個串起來', '還是一條線，沒有上下關係');
      for (let i = 0; i + 1 < items.length; i++) { tmp.push(arrow(V(-4.8 + i * 1.6 + 0.66, 1.0, 0), V(-4.8 + (i + 1) * 1.6 - 0.66, 1.0, 0), KID)); await beat(tok, 250); }
      await beat(tok, 2400);
      say('可是學校 → 學院 → 系所有上下關係', 'vector／list 表達不出 hierarchical 關係');
      await beat(tok, 2600);
      tmp.forEach(kill);
      const P = [[0, 6.3], [-4, 4.6], [0, 4.6], [4, 4.6], [-4, 2.9], [2.9, 2.9], [5.1, 2.9]];
      const C = ['#2fc092', '#4b9ee2', '#4b9ee2', '#4b9ee2', '#9b7ef4', '#9b7ef4', '#9b7ef4'];
      bs.forEach((b, i) => { lab.springTo(b, V(P[i][0], P[i][1], 0)); b.obj.material.color.set(C[i]); });
      const E = [[0, 1], [0, 2], [0, 3], [1, 4], [3, 5], [3, 6]];
      edgeLines(() => E.map(([a, c]) => [bs[a].obj.position, bs[c].obj.position]));
      say('把上下關係畫出來：就是一棵 tree', '學校 → 學院 → 系所');
      await beat(tok, 3000);
      tag('階層 1：學校', 'idx', -6.2, 6.3); tag('階層 2：學院', 'idx', -6.2, 4.6 + 0.7); tag('階層 3：系所', 'idx', -6.2, 2.9 - 0.7);
      say('Tree：表達 hierarchical 關係的資料結構', '<span class="ok">有上下（階層）關係</span>，不只是排成一列');
      await beat(tok, 3200);
    } };

    // 2. 台大組織圖、檔案目錄
    LECT['lina-ntu-org'] = { title: '例子：台大組織圖與檔案目錄', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.6, 13.5], [0, 3.9, 0]);
      const root = growG(NTU, { width: 11, topY: 6.4, step: 1.9 });
      say('台大的組織架構', '每個單位都是一筆資料');
      addG(root, 3); await beat(tok, 1200);
      const lv = tag('學校', 'ptr', -6.3, 6.4);
      for (const k of root.kids) { addG(k, 3); await beat(tok, 500); }
      tag('學院', 'ptr', -6.3, 4.5);
      say('學校之下有各學院', '理學院、工學院、社會科學院、電機資訊學院');
      await beat(tok, 2200);
      for (const k of root.kids) for (const g of k.kids) { addG(g, 3); await beat(tok, 450); }
      tag('系所', 'ptr', -6.3, 2.0);
      say('學院之下有各系', '理：數學、物理；工：土木；電資：資訊、電機');
      await beat(tok, 2600);
      for (const d of [0, 1, 2]) { gAll(root).filter((n) => n.depth === d).forEach((n) => gLit(n, GOLD)); await beat(tok, 700); gAll(root).filter((n) => n.depth === d).forEach((n) => gLit(n)); }
      say('一層一層往下：這就是階層', '把資料和上下關係一起存 → tree');
      await beat(tok, 2600);
      gAll(root).forEach((n) => lab.flyAway(n.body, V((Math.random() - 0.5) * 4, 7, 3)));
      for (const n of gAll(root)) n.body = null;
      kill(lv);
      await beat(tok, 900);
      const dir = growG('/(home(user(hw2.c,notes.txt)),usr(bin))', { width: 7, topY: 6.4, step: 1.4, cx: 0.6 });
      say('另一個例子：電腦的檔案目錄', '示意：目錄 → 子目錄 → 檔案');
      for (const n of gAll(dir)) { addG(n, 3); await beat(tok, 350); }
      await beat(tok, 2000);
      gAll(dir).filter((n) => !n.kids.length).forEach((n) => gLit(n, GREEN));
      say('目錄裡有子目錄，最底下是檔案', '<span class="ok">檔案目錄也是 tree</span>');
      await beat(tok, 3000);
    } };

    // 3. 定義：root + subtrees；遞迴與終止條件
    LECT['lina-tree-def'] = { title: 'Tree = root + subtrees（遞迴定義）', play: async (tok) => {
      const rec = (ctx.params || {}).phase === 'rec';
      fresh();
      lab.frameCamera([0, 4.6, 13.5], [0, 3.9, 0]);
      const root = growG(NTU, { width: 11, topY: 6.4, step: 1.9 });
      gAll(root).forEach((n) => addG(n));
      say(rec ? '定義：T = root + T1 … Tn' : '樹有一個階層最高的地方', rec ? '接著把 T1 也照樣拆開' : '台大的組織圖');
      await beat(tok, rec ? 1800 : 2200);
      gLit(root, GOLD);
      const rt = tag('root', 'ptr alt', 0, 7.3);
      if (!rec) { say('階層最高的 node 叫 root', 'CS 的樹 root 在最上面（跟真的樹相反）'); await beat(tok, 2800); }
      const boxes = [], names = [];
      const cols = ['#4b9ee2', '#e55a9b', '#9b7ef4', '#dd8238'];
      for (let i = 0; i < root.kids.length; i++) {
        const k = root.kids[i];
        boxes.push(boxSub(k, cols[i]));
        names.push(tag('T' + (i + 1), 'ptr', k.pos.x, k.pos.y + 0.75));
        if (!rec) { say('學院連同底下的系：也是樹 → subtree', 'T' + (i + 1) + ' = ' + k.label + ' 這棵 subtree'); await beat(tok, 1300); }
      }
      if (!rec) {
        say('T = root + subtrees T1, T2, …, Tn', 'root 裝「國立台灣大學」，這裡 n = 4');
        await beat(tok, 3400);
        say('四個學院 = 四棵 subtree', '<span class="ok">T = NTU + { T1, T2, T3, T4 }</span>');
        await beat(tok, 3000);
        return;
      }
      await beat(tok, 1600);
      const t1 = root.kids[0];
      boxes.slice(1).forEach(kill); names.slice(1).forEach(kill);
      gLit(root); gLit(t1, GOLD); setTag(rt, 'root');
      say('T1 也是一棵樹：subroot + 更小的樹', 'T1 = 理學院 + { T1-1, T1-2 }');
      const sr = tag('subroot', 'ptr alt', t1.pos.x - 1.6, t1.pos.y);
      const sub = t1.kids.map((g, j) => { gLit(g, GREEN); return [boxSub(g, '#2fc092'), tag('T1-' + (j + 1), 'ptr', g.pos.x, g.pos.y - 0.85)]; });
      await beat(tok, 3400);
      say('大樹拆成小樹，小樹再拆成更小的樹', '這是 recursive definition');
      await beat(tok, 3000);
      say('只寫遞迴式還不夠：要能停下來', '還需要 termination condition');
      await beat(tok, 2800);
      const leaf = t1.kids[0];
      sub.forEach(([g]) => kill(g)); t1.kids.forEach((g) => gLit(g)); gLit(leaf, RED); kill(sr);
      const x = tag('✕ 沒有 subtree', 'ptr', leaf.pos.x + 0.6, leaf.pos.y - 1.3);
      say('T1-1 = 數學系：只有 root，下面什麼都沒有', '沒有任何 subtree → 遞迴停止');
      await beat(tok, 3200);
      gLit(root.kids[2], RED);
      tag('✕', 'ptr', root.kids[2].pos.x, root.kids[2].pos.y - 1.0);
      say('只有 root 的樹 = 終止情形', '<span class="ok">遞迴式 + 終止條件</span> 才完整');
      await beat(tok, 3000);
      kill(x);
    } };

    // 4. subtrees 有沒有順序
    LECT['lina-ordered'] = { title: 'Subtrees：unordered（set）vs ordered（sequence）', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.4, 13.5], [0, 3.8, 0]);
      const root = growG('NTU(理學院,工學院,社科院,電資學院)', { width: 9.6, topY: 6.2, step: 2.6 });
      gAll(root).forEach((n) => addG(n));
      const ks = root.kids, xs = ks.map((k) => k.pos.x), y = ks[0].pos.y;
      say('定義裡沒規定 subtrees 要不要排順序', 'T = root + { T1, T2, T3, T4 }');
      await beat(tok, 2600);
      say('學院彼此平等：只要知道都屬於台大', '示意：換一換位置');
      const mv = async (perm) => { perm.forEach((p, i) => lab.springTo(ks[i].body, V(xs[p], y, 0))); await beat(tok, 1500); };
      await mv([2, 0, 3, 1]); await mv([3, 2, 1, 0]);
      say('不需要順序：subtrees 只是一個 set', '<span class="ok">換位置還是同一棵樹</span>（unordered）');
      await beat(tok, 2800);
      const nums = [20, 50, 30, 90];
      const tags = ks.map((k, i) => { const t = tag('編號 ' + nums[i], 'ptr alt', k.body.obj.position.x, y - 0.9); return t; });
      say('但學院有編號，例如電資學院 90', '示意編號：理 20、工 50、社科 30、電資 90');
      await beat(tok, 2800);
      const order = [0, 2, 1, 3];
      order.forEach((ki, slot) => { lab.springTo(ks[ki].body, V(xs[slot], y, 0)); tags[ki].position.set(xs[slot], y - 0.9, 0); });
      say('要依編號處理 → 順序有意義', '(T1, T2, T3, T4) 是 sequence → ordered tree');
      await beat(tok, 3000);
      lit(ks[0].body, RED); lit(ks[1].body, RED);
      say('ordered tree：T1、T2 對調就是不同的樹', 'unordered：set　ordered：sequence');
      await beat(tok, 3000);
    } };

    // 5. 名詞（老師的 13 節點樹）
    LECT['lina-terms'] = { title: '樹的名詞：level、leaf、族譜、height、degree', play: async (tok) => {
      const f = (ctx.params || {}).focus || 'level';
      fresh();
      lab.frameCamera([0, 4.4, 13.5], [0, 3.9, 0]);
      const root = growG(TERMS, { width: 10.6, cx: 0.4, topY: 6.5, step: 1.55 });
      const N = (l) => gFind(root, l);
      const byD = (d) => gAll(root).filter((n) => n.depth === d);
      const dTag = (d, txt) => tag(txt, 'idx', -6.4, 6.5 - d * 1.55);
      if (f === 'level') {
        say('樹裡的每一筆資料叫 node', '最上面的 node A 是 root');
        addG(root, 3); gLit(root, GOLD); dTag(0, 'level 0');
        await beat(tok, 2600);
        for (const n of byD(1)) { addG(n, 3); await beat(tok, 400); }
        dTag(1, 'level 1');
        say('root 在 level 0，下一層 level 1', '老師照 C 語言從 0 開始（課本 root = level 1）');
        await beat(tok, 3200);
        say('level 又叫 depth（深度）', '越往下，depth 越大');
        await beat(tok, 2400);
        for (const n of byD(2)) { addG(n, 3); await beat(tok, 380); }
        dTag(2, 'depth 2');
        say('再往下的 E、F、G、H、I、J', '都在 depth 2');
        await beat(tok, 2800);
        for (const n of byD(3)) { addG(n, 3); await beat(tok, 380); }
        dTag(3, 'depth 3');
        say('最下面 K、L、M 在 depth 3', '之後多講 depth（樹多深、多高）');
        await beat(tok, 3000);
        return;
      }
      gAll(root).forEach((n) => addG(n));
      if (f === 'leaf') {
        say('從 root 一路長，長到不能再長', '沒有任何 subtree 的 node');
        await beat(tok, 2400);
        for (const l of ['K', 'L', 'F', 'G', 'M', 'I', 'J']) { gLit(N(l), GREEN); await beat(tok, 450); }
        tag('leaf = external node', 'ptr', 0.4, 0.75);
        say('這些叫 leaf（樹葉）', '正式說法：external node（在樹的最外圍）');
        await beat(tok, 3200);
        gLit(root, GOLD);
        for (const l of ['B', 'C', 'D', 'E', 'H']) { gLit(N(l), BLUE); await beat(tok, 400); }
        say('不是 root、也不是 leaf：internal node', 'internal：B、C、D、E、H');
        await beat(tok, 3000);
        say('node 分三種：root、leaf、internal', '金 = root　綠 = leaf　藍 = internal');
        await beat(tok, 3000);
        say('有的書把 root 也算 internal', '課本：degree ≠ 0 的都叫 nonterminal');
        await beat(tok, 2800);
        return;
      }
      if (f === 'family') {
        say('把 tree 想成族譜', 'root A 是共同祖先，level 1 是第一代');
        gLit(root, GOLD);
        await beat(tok, 2800);
        const A = N('A').pos, C = N('C').pos;
        const up = arrow(C.clone().add(V(0.15, 0.35, 0)), A.clone().add(V(0.15, -0.35, 0)), KID);
        gLit(N('C'), GREEN);
        say('A 是 C 的 parent（家長）', '往上一代 = parent');
        await beat(tok, 2800);
        kill(up);
        arrow(A.clone().add(V(-0.15, -0.35, 0)), C.clone().add(V(-0.15, 0.35, 0)), SIB);
        say('反過來，C 是 A 的 child', '往下一代 = child');
        await beat(tok, 2800);
        gLit(root); gLit(N('C'));
        gLit(N('E'), GREEN); gLit(N('F'), GREEN); gLit(N('B'), GOLD);
        tag('siblings', 'ptr', (N('E').pos.x + N('F').pos.x) / 2, N('E').pos.y - 0.85);
        say('E、F 有同一個 parent B', 'E、F 互為 sibling（兄弟姐妹）');
        await beat(tok, 3000);
        gLit(N('E')); gLit(N('F')); gLit(N('B'));
        const g = boxSub(N('B'), '#2fc092');
        say('B 以下的子子孫孫：descendants', '示意：B 的 descendants = E、F、K、L');
        await beat(tok, 3000);
        kill(g);
        const cur = makeCursor();
        say('M 往上：爸爸、阿公、阿祖…', '示意：M 的 ancestors');
        for (const l of ['M', 'H', 'D', 'A']) { cursorTo(cur, N(l).pos); if (l !== 'M') gLit(N(l), GOLD); await beat(tok, 900); }
        say('一路到 root 都是 ancestor', 'M 的 ancestors = H、D、A');
        await beat(tok, 3000);
        return;
      }
      if (f === 'uncle') {
        say('同學問：D 和 G 是什麼關係？', 'G 的 parent 是 C');
        gLit(N('G'), GREEN);
        await beat(tok, 2600);
        arrow(N('G').pos.clone().add(V(0, 0.35, 0)), N('C').pos.clone().add(V(0, -0.35, 0)), KID);
        gLit(N('C'), GOLD);
        say('先往上找到 parent：C', 'C 是 G 的 parent');
        await beat(tok, 2800);
        gLit(N('D'), GOLD);
        tag('siblings', 'ptr', (N('C').pos.x + N('D').pos.x) / 2, N('C').pos.y + 0.75);
        say('C 和 D 都是 A 的小孩 → siblings', 'C、D 有同一個 parent A');
        await beat(tok, 3000);
        tag('uncle', 'ptr alt', N('D').pos.x + 0.9, N('D').pos.y - 0.8);
        say('D 是 G 的 parent 的 sibling', '<span class="ok">D 可稱為 G 的 uncle</span>');
        await beat(tok, 3000);
        say('uncle 只是族譜比喻', '課本正式術語：parent、child、sibling、ancestor');
        await beat(tok, 2800);
        return;
      }
      // height / degree
      ['depth 0', 'depth 1', 'depth 2', 'depth 3'].forEach((t, d) => dTag(d, t));
      say('每個 node 在第幾層：depth', 'root A 在 depth 0（老師的慣例）');
      await beat(tok, 2600);
      for (const d of [0, 1, 2]) { byD(d).forEach((n) => gLit(n, BLUE)); await beat(tok, 600); byD(d).forEach((n) => gLit(n)); }
      byD(3).forEach((n) => gLit(n, GOLD));
      say('最深的是 K、L、M，在 depth 3', '樹最深到 3 → height = 3');
      await beat(tok, 3200);
      say('課本 root 在 level 1', '同一棵樹：課本 height（depth）= 4');
      await beat(tok, 2800);
      byD(3).forEach((n) => gLit(n));
      for (const n of gAll(root)) { tag(String(n.kids.length), n.kids.length === 3 ? 'ptr alt' : 'idx', n.pos.x + W(n.label) / 2 + 0.2, n.pos.y - 0.3); }
      gLit(N('D'), GOLD);
      say('node 的 degree = 小孩數', 'D 有 3 個小孩 → degree 3；B 有 2 個');
      await beat(tok, 3200);
      gLit(N('A'), GOLD);
      say('tree 的 degree = 最大的 node degree', 'max(3, 2, 1, 3, 2, 1, 0…) = <span class="ok">3</span>');
      await beat(tok, 3200);
    } };

    // 6. 表示法：container、child link、parent link
    LECT['lina-links'] = { title: '表示 tree：child link 與 parent link', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.4, 13], [0, 4.1, 0]);
      say('tree = root + 一堆 subtree', '要在程式裡表示出來');
      const r = cube('root', '#2fc092', [1.4, 0.6, 0.8], 0, 6.4, 0, 3);
      await beat(tok, 2000);
      const bar = lab.box('#e9dcc4', [10, 0.2, 1.0]); bar.position.set(0, 3.25, 0); lab.world.add(bar);
      tag('container', 'idx', -5.6, 3.25 + 0.45);
      const xs = [-3.6, -1.2, 1.2, 3.6], nm = ['T1', 'T2', '…', 'Tn'];
      const ts = [];
      for (let i = 0; i < 4; i++) { ts.push(cube(nm[i], i === 2 ? '#c9b48e' : '#4b9ee2', [1.6, 0.6, 0.8], xs[i], 3.65, 0, 3)); await beat(tok, 450); }
      say('把 subtrees 裝進一個 container', '每棵 subtree 佔 container 的一部分');
      await beat(tok, 2600);
      const note = cube('', '#f2c46d', [0.4, 0.4, 0.5], 1.05, 6.4, 0, 2);
      tag('小紙片', 'idx', 1.05, 7.0);
      const ch = arrow(V(1.05, 6.18, 0), V(1.05, 4.05, 0), KID);
      const chT = tag('child link', 'ptr alt', 2.4, 5.1);
      say('root 存資料，旁邊附一張小紙片', 'pointer 指到 subtrees 的 container');
      await beat(tok, 3000);
      const ups = [];
      for (const i of [0, 1, 3]) { ups.push(arrow(V(xs[i], 4.0, 0), V(-0.35 + i * 0.12, 6.08, 0), SIB, true)); await beat(tok, 500); }
      const upT = tag('parent link', 'ptr', -3.3, 5.3);
      say('小孩也要找得到爸爸媽媽', '每棵 subtree 都有一條 link 指回 root');
      await beat(tok, 3000);
      say('往下找小孩：child link', '往上找家長：parent link（虛線）');
      await beat(tok, 3000);
      [bar, ch, chT, upT, ...ups].forEach(kill); kill(note);
      ts.forEach((b, i) => lab.springTo(b, V(xs[i], 3.0, 0)));
      say('另一種做法：root 有很多條 link', '每條 link 各指向一個小孩');
      await beat(tok, 900);
      for (let i = 0; i < 4; i++) { arrow(V(-0.3 + i * 0.2, 6.08, 0), V(xs[i], 3.35, 0), KID); await beat(tok, 450); }
      await beat(tok, 2800);
      lit(r, GOLD);
      say('兩種都能表示 root 和它的 subtrees', 'container + 一條 link，或 每個小孩一條 link');
      await beat(tok, 2600);
    } };

    // 7. vector 當 container
    LECT['lina-vector'] = { title: '用 vector 當 container', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.4, 13.5], [0, 4.2, 0]);
      const CW = 1.2, S = [1.18, 0.6, 0.8];
      const vec = (labels, x0, y, color) => labels.map((l, i) => { const b = cube(l, color, S, x0 + i * CW, y, 0, 3); tag('[' + i + ']', 'idx', x0 + i * CW, y - 0.55); return b; });
      say('範例樹：root 有三個小孩 T1、T2、T3', 'T1 有 2 個小孩、T2 沒有、T3 有 3 個');
      vec(['root'], 0, 6.6, '#2fc092');
      await beat(tok, 2600);
      const top = vec(['T1', 'T2', 'T3'], -CW, 4.6, '#4b9ee2');
      tag('vector', 'idx', -2.6, 4.6);
      arrow(V(0, 6.28, 0), V(0, 4.95, 0), KID);
      say('T1、T2、T3 各佔 vector 的一格', 'root 用 child link 連到這個 vector');
      await beat(tok, 3000);
      vec(['粉1', '粉2'], -4.6, 2.4, '#e55a9b');
      arrow(V(-CW, 4.28, 0), V(-4.0, 2.75, 0), KID);
      say('T1 用一條 link 指向裝 2 個小孩的 vector', '粉紅 1 號、粉紅 2 號');
      await beat(tok, 3000);
      vec(['橘1', '橘2', '橘3'], 2.4, 2.4, '#dd8238');
      arrow(V(CW, 4.28, 0), V(3.6, 2.75, 0), KID);
      say('T3 指向裝 3 個小孩的 vector', '橘子三兄弟');
      await beat(tok, 2800);
      arrow(V(0, 4.28, 0), V(0, 3.15, 0), RED);
      tag('null（或空 array）', 'ptr', 0, 2.8);
      lit(top[1], RED);
      say('T2 沒有小孩', '用空 array 或 null pointer 表示');
      await beat(tok, 3000);
      lit(top[1]);
      arrow(V(0.35, 4.95, 0), V(0.35, 6.28, 0), SIB, true);
      arrow(V(-3.0, 2.75, 0), V(-1.45, 4.28, 0), SIB, true);
      arrow(V(4.4, 2.75, 0), V(1.45, 4.28, 0), SIB, true);
      tag('parent link', 'ptr', 5.0, 5.0);
      say('再加上指回 parent 的虛線', '像 doubly linked list：上下都找得到');
      await beat(tok, 3200);
    } };

    // 8 & 9 共用：linked list 版的版面
    const LIST_POS = { root: [-4.5, 6.6], T1: [-4.5, 4.7], T2: [-1.0, 4.7], T3: [2.5, 4.7], '粉1': [-5.6, 2.6], '粉2': [-3.8, 2.6], '橘1': [1.4, 2.6], '橘2': [3.1, 2.6], '橘3': [4.8, 2.6] };
    const LIST_COL = { root: '#2fc092', T1: '#4b9ee2', T2: '#4b9ee2', T3: '#4b9ee2', '粉1': '#e55a9b', '粉2': '#e55a9b', '橘1': '#dd8238', '橘2': '#dd8238', '橘3': '#dd8238' };
    const KID_E = [['root', 'T1'], ['T1', '粉1'], ['T3', '橘1']];
    const SIB_E = [['T1', 'T2'], ['T2', 'T3'], ['粉1', '粉2'], ['橘1', '橘2'], ['橘2', '橘3']];
    const NULLS = [['T3', 6.2, 4.7, 'sib'], ['粉2', -2.3, 2.6, 'sib'], ['橘3', 6.3, 2.6, 'sib'], ['T2', -1.0, 3.2, 'kid']];
    function listNodes(drop) {
      const B = {};
      for (const k of Object.keys(LIST_POS)) { const [x, y] = LIST_POS[k]; B[k] = cube(k, LIST_COL[k], [W(k), 0.6, 0.8], x, y, 0, drop); }
      return B;
    }

    // 8. linked list 當 container
    LECT['lina-list'] = { title: '用 linked list 當 container', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.4, 13.5], [0, 4.4, 0]);
      const B = listNodes(3);
      const at = (k) => B[k].obj.position;
      say('同一棵樹，改用 linked list 當 container', 'root(T1(粉1,粉2), T2, T3(橘1,橘2,橘3))');
      await beat(tok, 2600);
      const sib = [], kid = [];
      dynLines(() => sib.map(([a, c]) => [at(a), at(c)]), SIB);
      dynLines(() => kid.map(([a, c]) => [at(a), at(c)]), KID);
      const nul = (i) => { const [, x, y] = NULLS[i]; return tag('null', 'idx', x, y); };
      sib.push(['T1', 'T2']); await beat(tok, 500); sib.push(['T2', 'T3']); nul(0);
      say('T1 → T2 → T3 串成一條 list', '最後指向 null');
      await beat(tok, 2600);
      kid.push(['root', 'T1']); lit(B.root, GOLD);
      say('root 用一條 link 找到第一個小孩', 'root → T1');
      await beat(tok, 2600);
      lit(B.root);
      kid.push(['T1', '粉1']); sib.push(['粉1', '粉2']); nul(1);
      say('T1 往下指到兩個粉紅小孩的 list', '粉1 → 粉2 → null');
      await beat(tok, 2600);
      kid.push(['T3', '橘1']); sib.push(['橘1', '橘2'], ['橘2', '橘3']); nul(2);
      say('T3 往下指到三個 node 的 list', '橘1 → 橘2 → 橘3 → null');
      await beat(tok, 2600);
      arrow(V(-1.0, 4.38, 0), V(-1.0, 3.45, 0), KID);
      nul(3);
      say('T2 沒有小孩：child 直接指向 null', 'vector 版是連續區塊；list 版用比較多小紙條');
      await beat(tok, 3000);
      tag('橫的 = sibling', 'ptr', 3.0, 6.4); tag('往下 = child', 'ptr alt', 3.0, 5.8);
      say('小紙條只有兩種', '橫的指兄弟姐妹、往下的指小孩');
      await beat(tok, 2800);
      lit(B.T1, GOLD);
      say('每個 node 最多兩張小紙條', 'T1：一張往下（粉1）、一張往右（T2）');
      await beat(tok, 3000);
    } };

    // 9. 重畫成 left-child right-sibling
    LECT['lina-lcrs'] = { title: '重畫：child 往左下、sibling 往右下', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.2, 13.5], [0, 3.9, 0]);
      const B = listNodes(0);
      const at = (k) => B[k].obj.position;
      dynLines(() => SIB_E.map(([a, c]) => [at(a), at(c)]), SIB);
      dynLines(() => KID_E.map(([a, c]) => [at(a), at(c)]), KID);
      const nulls = NULLS.map(([, x, y]) => tag('null', 'idx', x, y));
      say('上一張圖：只有兩種小紙條', '金 = child（往下）　藍 = sibling（橫的）');
      await beat(tok, 2800);
      nulls.forEach(kill);
      const t = parseTree('root(T1(粉1(,粉2),T2(,T3(橘1(,橘2(,橘3)),))),)');
      layoutTree(t, Object.assign({}, TREE_O, { topY: 6.7, minY: 1.0 }));
      const P = {}; levelorder(t).forEach((n) => { P[n.label] = n.pos.clone(); });
      const go = (k) => lab.springTo(B[k], P[k]);
      const steps = [
        [['root', 'T1'], 'root 的 child 紙條往左下畫', 'root ↙ T1'],
        [['粉1'], 'T1 的 child 再往左下', 'T1 ↙ 粉紅 1 號'],
        [['T2'], 'T1 的 sibling 紙條改往右下', 'T1 ↘ T2'],
        [['粉2'], '粉紅 2 號是粉紅 1 號的同輩', '粉1 ↘ 粉2（粉1 沒小孩，左邊空）'],
        [['T3'], 'T2 沒小孩，右下接 T3', 'T2 ↘ T3'],
        [['橘1', '橘2', '橘3'], 'T3 的三個小孩：左下再一路右下', 'T3 ↙ 橘1 ↘ 橘2 ↘ 橘3'],
      ];
      for (const [ks, cap, fm] of steps) {
        ks.forEach(go); ks.forEach((k) => lit(B[k], GOLD));
        say(cap, fm);
        await beat(tok, 2600);
        ks.forEach((k) => lit(B[k]));
      }
      tag('↙ 左 = child', 'ptr alt', -5.2, 2.0); tag('↘ 右 = sibling', 'ptr', -5.2, 1.3);
      say('child 變左下斜線，sibling 變右下斜線', '每個 node 最多兩條連接');
      await beat(tok, 3000);
      lit(B.T1, GOLD);
      const boxOf = (ks, color) => {
        const x0 = Math.min(...ks.map((k) => P[k].x - W(k) / 2)) - 0.1, x1 = Math.max(...ks.map((k) => P[k].x + W(k) / 2)) + 0.1;
        const y0 = Math.min(...ks.map((k) => P[k].y)) - 0.4, y1 = Math.max(...ks.map((k) => P[k].y)) + 0.4;
        return ghost(color, (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0);
      };
      const l = boxOf(['粉1', '粉2'], '#e55a9b');
      const r = boxOf(['T2', 'T3', '橘1', '橘2', '橘3'], '#4b9ee2');
      say('T1 的兩棵 subtree', '左：T1 的小孩　右：T1 原本的兄弟姐妹');
      await beat(tok, 3200);
      kill(l); kill(r); lit(B.T1);
      lit(B.root, GOLD);
      tag('右邊空', 'ptr', P.root.x + 1.2, P.root.y - 0.9);
      say('root 原本有 3 個小孩，現在只連 T1', 'root 沒有 sibling → 右邊一定空');
      await beat(tok, 3000);
    } };
  }

  // ─── XkNIHYd9Ruc（台大林軒田 DSA：Tree）後半 93:12–176:04 ───
  {
    const PRM = () => ctx.params || {};
    const PINK = '#e55a9b', ORANGE = '#dd8238', CHILD_C = '#1f8a5a', SIB_C = '#c08a1f';
    const relab = (b, t) => b.obj.children.forEach((c) => { if (c.element) c.element.textContent = String(t); });
    const tgt = (b, dx = 0, dy = 0) => b.target.clone().add(V(dx, dy, 0));
    // 會跟著方塊移動的連線（list 可變動）
    function links(list) { return edgeLines(() => list.filter((e) => e[0] && e[1]).map(([a, b]) => [a.obj.position, b.obj.position])); }
    function tileAt(x, z, w = 0.8, d = 0.9, color = '#e9dcc4', y = 0.04) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
      t.position.set(x, y, z); lab.world.add(t); return t;
    }
    // 拱形箭頭（陣列格之間的跳躍）
    function arc(a, b, color = SIB_C, h) {
      const peak = V((a.x + b.x) / 2, Math.max(a.y, b.y) + (h === undefined ? 0.3 + 0.22 * Math.abs(b.x - a.x) : h), (a.z + b.z) / 2);
      return [seg(a, peak, color), arrow(peak, b, color)];
    }
    const killAll = (arr) => { arr.forEach((o) => kill(o)); arr.length = 0; };

    // ── LCRS 的例子：root(T1(P1,P2), T2, T3(O1,O2,O3)) ──
    const LCRS_G = 'R(T1(P1,P2),T2,T3(O1,O2,O3))';
    const LCRS_B = { R: [0, 0], T1: [-1, 1], P1: [-2, 2], T2: [0, 2], P2: [-1, 3], T3: [1, 3], O1: [0, 4], O2: [1, 5], O3: [2, 6] };
    const LCRS_E = [['R', 'T1', 'L'], ['T1', 'P1', 'L'], ['T1', 'T2', 'R'], ['P1', 'P2', 'R'], ['T2', 'T3', 'R'], ['T3', 'O1', 'L'], ['O1', 'O2', 'R'], ['O2', 'O3', 'R']];
    const lcrsPos = (l, cx = 0, top = 6.6, dx = 1.3, dy = 0.92) => V(cx + LCRS_B[l][0] * dx, top - LCRS_B[l][1] * dy, 0);
    const lcrsColor = (l) => (l[0] === 'P' ? PINK : l[0] === 'O' ? ORANGE : l === 'R' ? '#2fc092' : '#4b9ee2');
    function lcrsArrows(B) {
      return LCRS_E.map(([p, c, s]) => arrow(tgt(B[p], s === 'L' ? -0.25 : 0.25, -0.3), tgt(B[c], 0, 0.32), s === 'L' ? CHILD_C : SIB_C));
    }
    async function spawnLCRS(tok, ms = 220, o = {}) {
      const B = {};
      for (const l of Object.keys(LCRS_B)) {
        const p = lcrsPos(l, o.cx, o.top);
        B[l] = cube(l, lcrsColor(l), NODE, p.x, p.y, 0, 3);
        if (ms) await beat(tok, ms);
      }
      return B;
    }
    function lcrsLegend(x = -5.2, y = 1.4) {
      const a = tag('↙ left = first child', 'ptr', x, y); a.element.style.color = CHILD_C;
      const b = tag('↘ right = next sibling', 'ptr alt', x, y - 0.6);
      return [a, b];
    }

    LECT['linb-lcrs'] = { title: 'Left-Child Right-Sibling：general tree → binary tree', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.6, 13.5], [0, 3.6, 0]);
      const g = parseG(LCRS_G);
      layoutG(g, { width: 10, topY: 6.2, step: 2.0 });
      const B = {};
      say('原本的 general tree（有順序）', 'root 的小孩依序是 T1、T2、T3');
      for (const n of gAll(g)) { B[n.label] = cube(n.label, lcrsColor(n.label), NODE, n.pos.x, n.pos.y, 0, 3); await beat(tok, 200); }
      const E = [];
      for (const n of gAll(g)) for (const k of n.kids) E.push([B[n.label], B[k.label]]);
      links(E);
      tag('粉紅 1、2 號', 'idx', -4, 1.3); tag('橘子三兄弟', 'idx', 3, 1.3);
      await beat(tok, 2000);
      // 只留兩張小紙條：first child、next sibling
      E.length = 0;
      const tmp = [];
      for (const n of gAll(g)) {
        if (n.kids.length) tmp.push(arrow(tgt(B[n.label], 0, -0.3), tgt(B[n.kids[0].label], 0, 0.32), CHILD_C));
        for (let k = 0; k + 1 < n.kids.length; k++) tmp.push(arrow(tgt(B[n.kids[k].label], 0.42, 0), tgt(B[n.kids[k + 1].label], -0.42, 0), SIB_C, true));
      }
      say('每個 node 只要兩張小紙條', '↓ first child（綠）、→ next sibling（金）');
      await beat(tok, 3200);
      killAll(tmp);
      say('child 往左下畫、sibling 往右下畫', '整張圖像是轉了 45°');
      for (const l of Object.keys(LCRS_B)) lab.springTo(B[l], lcrsPos(l));
      await beat(tok, 1600);
      lcrsArrows(B);
      lcrsLegend();
      await beat(tok, 2400);
      say('每個 node 最多 2 條連結', 'maximum number of children = 2 → binary tree');
      lit(B.T1, GOLD); lit(B.T2, GOLD); lit(B.O1, GOLD); lit(B.O2, GOLD);
      await beat(tok, 3000);
      [B.T1, B.T2, B.O1, B.O2].forEach((b) => lit(b));
      const z = tag('∅', 'ptr alt', 0.7, 5.9);
      lit(B.R, GOLD);
      say('root 沒有 sibling：右邊一定是空', '左右有差別：要 ordered tree（T1、T2、T3 有順序）');
      await beat(tok, 3200);
      lit(B.R); kill(z);
      say('Left-Child Right-Sibling', '<span class="ok">任何 ordered tree 都能存成 binary tree</span>');
      await beat(tok, 3000);
    } };

    LECT['linb-null-links'] = { title: 'Binary tree 的條件與 NULL link', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.6, 13.5], [0, 3.6, 0]);
      say('剛才轉出來的 binary tree', 'left = child、right = sibling');
      const B = await spawnLCRS(tok, 200);
      lcrsArrows(B);
      await beat(tok, 1400);
      tag('binary tree 條件', 'ptr', -5.2, 6.4);
      const c1 = tag('1. degree ≤ 2', 'ptr alt', -5.2, 5.8);
      say('條件一：tree 的 degree 最多為 2', '老師先寫「= 2」，再改成「≤ 2」');
      await beat(tok, 2600);
      c1.element.className = 'lab-label ptr'; tag('2. ordered：左右有差', 'ptr alt', -5.2, 5.2);
      say('條件二：左小孩、右小孩有差別', '只有一個小孩時，也要分是左還是右');
      await beat(tok, 2600);
      say('把指向空的小紙條畫出來', 'NULL link：沒有存任何資料');
      const nulls = [];
      const has = {}; LCRS_E.forEach(([p, , s]) => { has[p + s] = true; });
      for (const l of Object.keys(LCRS_B)) for (const s of ['L', 'R']) {
        if (has[l + s]) continue;
        const a = tgt(B[l], s === 'L' ? -0.25 : 0.25, -0.3), b = tgt(B[l], s === 'L' ? -0.6 : 0.6, -0.72);
        nulls.push(seg(a, b, '#b04040'));
        nulls.push(tag('∅', 'idx', b.x + (s === 'L' ? -0.12 : 0.12), b.y - 0.15));
        await beat(tok, 260);
      }
      await beat(tok, 1200);
      Object.values(B).forEach((b) => lit(b, GREEN));
      say('算進 NULL：每個 node 都剛好 2 條', 'degree = 2，只是其中可能指向空');
      await beat(tok, 2800);
      Object.values(B).forEach((b) => lit(b));
      say('9 個 node：18 條連結、8 條真的', '補充：n 個 node 的 binary tree 有 n + 1 條 NULL link');
      await beat(tok, 3000);
      killAll(nulls);
      say('以後畫圖不畫 NULL，需要時自己腦補', '<span class="ok">每個 node 都有左右兩邊，某一邊可能為空</span>');
      await beat(tok, 3000);
    } };

    LECT['linb-vector-pack'] = { title: 'Q&A：把 tree 塞進一個大 vector？', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 6.5, 11.5], [0, 1.6, 0]);
      const X = (i) => -4.5 + i * 1.0;
      const order = ['R', 'T1', 'T2', 'T3', 'P1', 'P2', 'O1', 'O2', 'O3'];
      for (let i = 0; i < 10; i++) { tileAt(X(i), 0); tag('[' + i + ']', 'idx', X(i), 0.1, 0.8); }
      tag('一個緊密的 vector（示意排法：一層一層放）', 'ptr', 0, 2.6);
      say('同學問：node 全放進一個大 vector？', '這是實作上的選擇');
      const cells = [];
      for (let i = 0; i < order.length; i++) { cells.push(cube(order[i], lcrsColor(order[i]), [0.7, 0.55, 0.7], X(i), 0.36, 0, 2.5)); await beat(tok, 200); }
      say('全擠在一起：access、allocate 很方便', '整塊記憶體連續');
      await beat(tok, 2400);
      say('T1 多一個小孩 P3：要插在 P2 後面', '後面的人通通要往後擠');
      for (let i = order.length - 1; i >= 6; i--) { lab.springTo(cells[i], V(X(i + 1), 0.36, 0)); lit(cells[i], RED); await beat(tok, 450); }
      const p3 = cube('P3', PINK, [0.7, 0.55, 0.7], X(6), 0.36, 0, 3);
      await beat(tok, 900);
      cells.forEach((c) => lit(c));
      say('insertion／removal 都要搬動元素', '<span class="no">彈性差</span>：這就是為什麼常用小紙條（link）');
      await beat(tok, 3000);
      killAll(cells); kill(p3);
      say('另一個問題：root 只有一個小孩？', 'LCRS 中 root 沒有 sibling');
      await beat(tok, 1600);
      for (const [l, x] of [['R', 3.6], ['T1', 2.4]]) cube(l, lcrsColor(l), NODE, x, l === 'R' ? 5.4 : 4.2, -1.5, 2);
      arrow(V(3.4, 5.1, -1.5), V(2.5, 4.52, -1.5), CHILD_C);
      seg(V(3.85, 5.1, -1.5), V(4.3, 4.6, -1.5), '#b04040'); tag('∅', 'idx', 4.45, 4.35, -1.5);
      await beat(tok, 1000);
      say('轉成 binary tree：root 只有左小孩', '<span class="ok">binary tree 的 node 只有一個實際小孩是可能的</span>');
      await beat(tok, 3200);
    } };

    // ── 遞迴建樹（示意資料 [5,3,8,1,4]）──
    LECT['linb-construct'] = { title: '用 recursion 建構 tree', play: async (tok) => {
      const term = PRM().phase === 'term';
      fresh();
      lab.frameCamera([0, 4.4, 13.5], [0, 3.4, 0]);
      const lines = term
        ? ['ConstructTree(data):', '  if data empty: return NULL', '  else:', '    create root node from data[0]', '    partition data into n sets', '    T_i = ConstructTree(i-th set)', '    link root to T_i', '    return address of root node']
        : ['ConstructTree(data):', '  create root node from data[0]', '  partition data into n sets', '  for each i:', '    T_i = ConstructTree(i-th set)', '    link root to T_i'];
      const L = term ? { empty: 1, create: 3, part: 4, rec: 5, link: 6, ret: 7 } : { create: 1, part: 2, rec: 4, link: 5 };
      const cp = code(lines, -3.9, 6.6, 0.5);
      const data = [5, 3, 8, 1, 4];
      const row = data.map((v, k) => cube(v, '#b9a582', SMALL, -2.2 + k * 0.8, 0.3, 2.2, 2));
      row.forEach((b, k) => { b.v = data[k]; });
      tag('data（示意）', 'idx', -2.2, 0.3, 3.1);
      say(term ? '補上終止條件的完整版' : '建 tree 的 pseudo code（不是 C）', '資料 [5, 3, 8, 1, 4] 是示意；規則：小的放左、大的放右');
      await beat(tok, 2600);
      const E = []; links(E);
      const DX = [1.6, 0.8, 0.5];
      async function build(items, pos, depth, parent) {
        if (!items.length) {
          if (term) {
            cp.hl(L.empty);
            tag('NULL', 'idx', pos.x, pos.y + 0.2);
            say('data 是空的 → return NULL', '不再往下建任何東西');
            await beat(tok, 750);
          }
          return null;
        }
        const r = items[0];
        cp.hl(L.create);
        lab.springTo(r, pos.clone());
        lit(r, GOLD);
        say('create root：data[0] = ' + r.v, '其餘 ' + (items.length - 1) + ' 筆要分給 subtree');
        await beat(tok, 1300);
        lit(r);
        const rest = items.slice(1);
        const sm = rest.filter((b) => b.v < r.v), bg = rest.filter((b) => b.v > r.v);
        const cpos = [V(pos.x - DX[depth], pos.y - 1.6, 0), V(pos.x + DX[depth], pos.y - 1.6, 0)];
        if (rest.length) {
          cp.hl(L.part);
          [[sm, cpos[0], '#4b9ee2'], [bg, cpos[1], ORANGE]].forEach(([set, cp2, col]) => set.forEach((b, k) => {
            b.obj.material.color.set(col);
            lab.springTo(b, V(cp2.x + (k - (set.length - 1) / 2) * 0.68, cp2.y - 0.7, 0));
          }));
          say('partition：比 ' + r.v + ' 小放左、大放右', '小：{' + sm.map((b) => b.v).join(', ') + '}　大：{' + bg.map((b) => b.v).join(', ') + '}');
          await beat(tok, 1400);
        }
        for (const [set, cp2] of [[sm, cpos[0]], [bg, cpos[1]]]) {
          if (!set.length && !term) continue;
          cp.hl(L.rec);
          const sub = await build(set, cp2, depth + 1, r);
          if (sub) {
            cp.hl(L.link);
            E.push([r, sub]);
            say('link root to T_i', r.v + ' → ' + sub.v);
            await beat(tok, 650);
          }
        }
        if (term) { cp.hl(L.ret); say('return address of root node', '回傳 ' + r.v + ' 的位址 = 代表整棵 subtree'); await beat(tok, 700); }
        return r;
      }
      await build(row, V(3.4, 6.2, 0), 0, null);
      cp.hl(-1);
      if (term) say('遞迴式 + 終止條件才完整', 'recursive formula + termination condition；' + '<span class="ok">用 NULL pointer 表示「不再遞迴建構」</span>');
      else say('問題：沒有說什麼時候停！', '下一段補上 termination condition（補充：這就是 BST 的雛形）');
      await beat(tok, 3000);
    } };

    // ── 樹高與 node 數（本課 root = level 0）──
    function mini(list, color = '#4b9ee2', size = [0.6, 0.5, 0.6]) {
      const objs = list.map(([x, y]) => cube('', color, size, x, y, 0, 2));
      list.forEach(([x, y, p]) => { if (p !== undefined) { const [px, py] = list[p]; objs.push(seg(V(px, py - 0.25, 0), V(x, y + 0.25, 0), '#7a6a52')); } });
      return objs;
    }
    LECT['linb-height-nodes'] = { title: '樹高 h 與 node 數：h = 0、1、2', play: async (tok) => {
      const two = PRM().upto === 2;
      fresh();
      lab.frameCamera([0, 4.4, 13.5], [0, 3.8, 0]);
      tag('h │ 最少 n │ 最多 n', 'ptr', -5, 6.6);
      const rows = [0, 1, 2].map((h) => tag('h = ' + h + '：?', 'idx', -5, 6.0 - h * 0.6));
      const fillRow = (h, a, b) => { setTag(rows[h], 'h = ' + h + '：' + a + ' ≤ n ≤ ' + b); rows[h].element.className = 'lab-label ptr alt'; };
      if (!two) {
        say('本課：只有 root 時 h = 0', 'root 在 level 0（洪逸是 level 1，數值差 1）');
        await beat(tok, 2600);
        mini([[-1, 5.8]], '#2fc092');
        say('h = 0：root 孤單一人', '最少 = 最多 = 1 個 node');
        fillRow(0, 1, 1);
        await beat(tok, 2800);
        mini([[2, 5.8], [1.2, 4.4, 0]], '#4b9ee2');
        say('h = 1：root 至少要有一個小孩', '最少 2 個 node');
        await beat(tok, 2800);
        mini([[5, 5.8], [4.2, 4.4, 0], [5.8, 4.4, 0]], '#9b7ef4');
        say('root 有兩個小孩：最多 3 個', '<span class="ok">h = 1：2 ≤ n ≤ 3</span>');
        fillRow(1, 2, 3);
        await beat(tok, 3000);
        say('塞 10 萬筆資料，樹最矮、最高差多少？', '先看 node 數和高度的關係');
        await beat(tok, 3400);
        return;
      }
      fillRow(0, 1, 1); fillRow(1, 2, 3);
      say('續上表：h = 2', '本課 root = level 0');
      await beat(tok, 2000);
      const full = [[2.5, 6.2], [1.0, 4.8, 0], [4.0, 4.8, 0], [0.25, 3.4, 1], [1.75, 3.4, 1], [3.25, 3.4, 2], [4.75, 3.4, 2]];
      const objs = [];
      objs.push(...mini(full.slice(0, 1), '#2fc092')); await beat(tok, 500);
      objs.push(...mini(full.slice(1, 3).map((p) => [p[0], p[1]]), '#4b9ee2')); await beat(tok, 500);
      objs.push(...mini(full.slice(3).map((p) => [p[0], p[1]]), '#9b7ef4'));
      full.slice(1).forEach(([x, y, p]) => objs.push(seg(V(full[p][0], full[p][1] - 0.25, 0), V(x, y + 0.25, 0), '#7a6a52')));
      say('最多：每個人都生兩個小孩', '1 + 2 + 4 = 7 個 node');
      await beat(tok, 2800);
      killAll(objs);
      const a = mini([[0.8, 6.2], [0, 4.8, 0], [-0.8, 3.4, 1]], '#dd8238');
      const b = mini([[4.6, 6.2], [3.8, 4.8, 0], [4.6, 3.4, 1]], '#dd8238');
      say('最少：代代單傳，3 個 node', '有人生左、有人生右都算（binary tree 分左右）');
      fillRow(2, 3, 7);
      await beat(tok, 3000);
      tag('skewed tree', 'ptr alt', 0, 2.4);
      say('只偏一邊長：skewed tree（歪斜樹）', '長得像 linked list：退化的樹，我們不喜歡');
      a.forEach((o) => { if (o.obj) lit(o, RED); });
      await beat(tok, 3000);
      say('h = 2：3 ≤ n ≤ 7', '<span class="ok">再推廣到一般的 h</span>');
      await beat(tok, 3200);
      void b;
    } };

    LECT['linb-height-formula'] = { title: '一般高度 h：h+1 ≤ n ≤ 2^(h+1) − 1', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.6, 13.5], [0, 3.4, 0.6]);
      const H = 3;
      tag('最少（示意 h = 3）', 'ptr', -5.4, 7.0);
      const chain = [];
      for (let i = 0; i <= H; i++) { chain.push(cube('', '#dd8238', [0.55, 0.45, 0.55], -5.4, 6.2 - i * 1.2, 0, 2)); tag('第 ' + i + ' 代', 'idx', -4.4, 6.2 - i * 1.2); await beat(tok, 300); }
      for (let i = 0; i < H; i++) seg(V(-5.4, 5.97 - i * 1.2, 0), V(-5.4, 5.23 - i * 1.2, 0), '#7a6a52');
      say('最少：每代只有 1 個', '<span class="ok">n_min = h + 1</span>（示意 h = 3 → 4）');
      await beat(tok, 2600);
      tag('最多：每個人生兩個', 'ptr', 1.2, 7.0);
      const bits = [];
      const BX = (i) => 5.2 - i * 0.9;
      for (let i = 0; i <= H; i++) {
        const k = 1 << i;
        for (let j = 0; j < k; j++) cube('', '#4b9ee2', [0.42, 0.38, 0.42], 1.2 + (j - (k - 1) / 2) * 0.55, 6.2 - i * 1.2, 0, 1.5);
        tag('2^' + i + ' = ' + k, 'idx', 4.2, 6.2 - i * 1.2);
        say('第 ' + i + ' 層：' + k + ' 個', '1 + 2 + 4 + 8 + … 等比級數');
        await beat(tok, 750);
      }
      say('用二進位看：每一層是一個 bit', '第 0 位到第 h 位都是 1');
      for (let i = 0; i <= H; i++) {
        bits[i] = cube('1', '#2fc092', [0.6, 0.5, 0.6], BX(i), 0.3, 2.2, 2);
        tag('2' + '⁰¹²³⁴'[i], 'idx', BX(i), 0.3, 3.0);
        await beat(tok, 450);
      }
      tag('2⁴', 'idx', BX(4), 0.3, 3.0);
      say('1111₂ = 1 + 2 + 4 + 8 = 15', '(h+1) 個 1');
      await beat(tok, 2200);
      const one = cube('+1', '#f2c46d', [0.6, 0.5, 0.6], BX(0), 1.1, 2.2, 2);
      await beat(tok, 900);
      kill(one);
      for (let i = 0; i <= H; i++) { relab(bits[i], 0); bits[i].obj.material.color.set('#b9a582'); await beat(tok, 350); }
      bits[4] = cube('1', '#2fc092', [0.6, 0.5, 0.6], BX(4), 0.3, 2.2, 2);
      say('再加 1：一路進位變成 10000₂', '1111₂ + 1 = 2⁴ → 1111₂ = 2⁴ − 1');
      await beat(tok, 2800);
      say('所以 n 有上下界', '<span class="ok">h + 1 ≤ n ≤ 2^(h+1) − 1</span>');
      await beat(tok, 3000);
      say('反過來：給 n，h 的範圍', 'lg(n+1) − 1 ≤ h ≤ n − 1（lg = log₂）');
      await beat(tok, 3200);
      say('洪逸（root = level 1，depth k）', 'depth k 最多 2^k − 1 個 node；第 i 層最多 2^(i−1) 個');
      await beat(tok, 2800);
    } };

    LECT['linb-search-height'] = { title: '為什麼在意樹高：搜尋成本 ≈ h', play: async (tok) => {
      const cmp = PRM().focus === 'compare';
      fresh();
      lab.frameCamera([0, 4.4, 13.5], [0, 3.6, 0.6]);
      const L = showTree('4(2(1,3),6(5,7))', { cx: -3.4, width: 5.6, topY: 6.4, minY: 3.4, maxStep: 1.5, maxSp: 0.95 });
      const R = showTree('1(,2(,3(,4(,5(,6(,7))))))', { cx: 3.6, width: 5.4, topY: 6.6, minY: 0.8, maxStep: 1.0, maxSp: 0.9 });
      const cL = tag('拜訪 0 次', 'ptr alt', -3.4, 2.4), cR = tag('拜訪 0 次', 'ptr alt', 5.2, 6.6);
      tag('n = 7（示意）', 'idx', -3.4, 7.3);
      say('tree 是階層式 access：從 root 往下找', '示意：兩棵 n = 7 的 binary tree，找 7');
      await beat(tok, 2600);
      const curL = makeCursor(), curR = makeCursor();
      async function walk(root, cur, cnt, target, ms, cap) {
        let n = root, k = 0;
        while (n) {
          cursorTo(cur, n.pos); glow(n, GOLD); k++; setTag(cnt, '拜訪 ' + k + ' 次');
          if (cap) say(n.label === target ? '找到 ' + target + '！' : target + ' > ' + n.label + '：往右', '每層只拜訪一個 node');
          await beat(tok, ms);
          if (String(target) === n.label) break;
          n = Number(target) < Number(n.label) ? n.left : n.right;
        }
        return k;
      }
      if (!cmp) {
        await walk(L, curL, cL, '7', 1100, true);
        say('最多找「樹的高度」那麼多層', '矮樹：h = 2（root = level 0），3 次');
        await beat(tok, 2600);
        const xs = [-6, -5.1, -4.2, -3.3, -2.4, -1.5, -0.6];
        const arr = xs.map((x, k) => cube(k + 1, '#b9a582', SMALL, x, 0.3, 2.2, 1.5));
        say('就像 ordered array 上的 binary search', '每次丟掉一半 candidate');
        await beat(tok, 1600);
        for (const [mid, drop] of [[3, [0, 1, 2, 3]], [5, [4, 5]], [6, []]]) {
          lit(arr[mid], GOLD); await beat(tok, 800);
          drop.forEach((k) => { arr[k].obj.material.color.set('#d8cfc0'); lit(arr[k]); });
          await beat(tok, 600);
        }
        say('比較次數 ≈ lg（資料數量）', '<span class="ok">tree 上 search 的成本跟 h 有關</span>');
        await beat(tok, 3000);
        return;
      }
      say('Best case：矮樹', '找 7：4 → 6 → 7');
      await walk(L, curL, cL, '7', 800, false);
      tag('h ≈ lg n：好', 'ptr alt', -3.4, 1.7);
      say('h ≈ lg n：花 log n 次就找到', '類似 binary search');
      await beat(tok, 2200);
      say('Worst case：skewed tree', '找 7：一路往右走到底');
      await walk(R, curR, cR, '7', 600, false);
      tag('h = n − 1：壞', 'ptr', 3.4, 0.1);
      say('h = n − 1：要花 linear 的力氣', '跟 linked list 的 sequential search 一樣');
      await beat(tok, 2800);
      arrow(V(0.4, 1.2, 0), V(-1.6, 2.4, 0), '#1f8a5a');
      say('設計 tree 的 DS／演算法：壓低樹高', '要退化成 linked list，不如直接用 list');
      await beat(tok, 3000);
      say('同一層多塞 node 對我們有利', '<span class="ok">矮胖好，瘦高（退化）不好</span>');
      await beat(tok, 2800);
    } };

    LECT['linb-html-tree'] = { title: 'Q&A：網站是 tree 嗎？HTML parse tree', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.6, 13.5], [0, 3.6, 0]);
      const pg = { home: [-5, 6], cv: [-2.4, 6], blog: [-5, 4], post: [-2.4, 4] };
      const B = {};
      for (const k of Object.keys(pg)) B[k] = cube(k, '#8fa3b8', [1.2, 0.55, 0.7], pg[k][0], pg[k][1], 0, 2);
      await beat(tok, 600);
      const A = (a, b, dy = 0) => arrow(V(pg[a][0] + (pg[b][0] > pg[a][0] ? 0.62 : pg[b][0] < pg[a][0] ? -0.62 : 0.2), pg[a][1] + dy + (pg[b][1] < pg[a][1] ? -0.3 : pg[b][1] > pg[a][1] ? 0.3 : 0), 0),
        V(pg[b][0] + (pg[b][0] > pg[a][0] ? -0.62 : pg[b][0] < pg[a][0] ? 0.62 : 0.2), pg[b][1] + dy + (pg[b][1] < pg[a][1] ? 0.3 : pg[b][1] > pg[a][1] ? -0.3 : 0), 0), SIB_C);
      A('home', 'cv', 0.12); A('cv', 'home', -0.12); A('home', 'blog'); A('blog', 'post', 0); A('post', 'home');
      tag('hyperlink（示意）', 'idx', -3.7, 7.0);
      say('網頁之間的 hyperlink 沒有父子關係', '可以互連、有環 → graph structure，比 tree 複雜');
      await beat(tok, 3400);
      say('檔案放在 directory 裡', 'directory 本身可看成 tree structure');
      await beat(tok, 2400);
      const html = ['<html>', '  <head>…</head>', '  <body>', '    <a href=…>', '      <img src=…>', '    </a>', '    <p>…</p>', '  </body>', '</html>'];
      const cp = code(html, -3.8, 2.8, 0.36);
      say('HTML：HyperText Markup Language', '結構化的文字（老師的網頁原始碼，示意）');
      await beat(tok, 2600);
      const g = spawnG(parseG('html(head,body(a(img),p))'), { cx: 3.2, width: 5, topY: 6.4, step: 1.5 });
      const gb = (l) => gFind(g, l);
      cp.hl(3); gLit(gb('a'), GOLD); gLit(gb('img'), GOLD);
      const box = ghost('#c08a1f', 2.0, 2.65, 1.6, 2.4);
      say('<a> 裡面包著 <img>：一棵 subtree', '每個標記結構都可看成 subtree');
      await beat(tok, 3200);
      cp.hl(-1); gLit(gb('a')); gLit(gb('img')); kill(box);
      say('整頁表示成 tree：parse tree', '跟作業三的 expression tree 一樣描述文法架構');
      await beat(tok, 3000);
    } };

    // ── full binary tree 1..7 與 path code ──
    const PC_POS = (i) => heapPos(i, 6.4, 1.9, 8);
    const bin = (i) => i.toString(2);
    LECT['linb-path-code'] = { title: 'Full binary tree 的編號、二進位與 path code', play: async (tok) => {
      const path = PRM().phase === 'path';
      fresh();
      lab.frameCamera([0, 4.4, 13.5], [0, 3.8, 0]);
      const N = {}, bt = {};
      const E = []; links(E);
      if (!path) say('同一高度塞最多 node：full binary tree', '三層（level 0..2）→ 1 + 2 + 4 = 7 個');
      for (let i = 1; i <= 7; i++) {
        const p = PC_POS(i);
        N[i] = cube(i, depthColor(hdepth(i)), NODE, p.x, p.y, 0, path ? 0 : 3);
        if (i > 1) E.push([N[i >> 1], N[i]]);
        if (path) { bt[i] = tag(bin(i), 'ptr alt', p.x + 0.85, p.y + 0.15); } else await beat(tok, 380);
      }
      if (!path) {
        await beat(tok, 1600);
        say('編號：由上到下、同層由左到右', '就是 level order：1 到 7');
        for (let i = 1; i <= 7; i++) { lit(N[i], GOLD); await beat(tok, 300); lit(N[i]); }
        await beat(tok, 600);
        say('把編號寫成二進位', '1, 10, 11, 100, 101, 110, 111');
        for (let i = 1; i <= 7; i++) { const p = PC_POS(i); bt[i] = tag(bin(i), 'ptr alt', p.x + 0.85, p.y + 0.15); await beat(tok, 500); }
        await beat(tok, 1600);
        say('金字 = 編號的二進位（老師用紅字）', 'node number 的 binary representation');
        await beat(tok, 2600);
        say('第 k 層（level k）的編號都是 k+1 位', '<span class="ok">看看路徑跟這些 bits 的關係</span>');
        await beat(tok, 2600);
        return;
      }
      for (let i = 2; i <= 7; i++) {
        const a = PC_POS(i >> 1), b = PC_POS(i), m = a.clone().add(b).multiplyScalar(0.5);
        const l = tag(i % 2 ? '1' : '0', 'ptr', m.x + (i % 2 ? 0.35 : -0.35), m.y + 0.2);
        if (i % 2 === 0) l.element.style.color = CHILD_C;
      }
      say('往左的 link 寫 0、往右寫 1', '從 root 出發，沿路收集 bits');
      await beat(tok, 2600);
      const cur = makeCursor();
      const pathTag = tag('', 'ptr alt', 0, 0.6, 1.5);
      const walk = [[1, '1', '從 root 1 出發', 'code = 1'], [2, '1·0', '往左接 0：10₂ = 2', '1 → 10'], [4, '1·00', '再往左：100₂ = 4', '10 → 100'],
        [1, '1', '回到 root', 'code = 1'], [3, '1·1', '往右接 1：11₂ = 3', '1 → 11'], [6, '1·10', '3 往左接 0：110₂ = 6', '11 → 110'],
        [3, '1·1', '回到 3', 'code = 11'], [7, '1·11', '再往右：111₂ = 7', '11 → 111']];
      for (const [i, code2, cap, f] of walk) {
        cursorTo(cur, PC_POS(i)); lit(N[i], GOLD);
        setTag(pathTag, 'path code：' + code2 + ' = ' + i);
        say(cap, f);
        await beat(tok, 1300);
        lit(N[i]);
      }
      cur.obj.visible = false;
      say('編號 = 先放 1，後面接路徑 bits', 'node 6：1 + 「右 1、左 0」→ 110₂');
      await beat(tok, 2800);
      say('接 0 = 左移一位 = ×2', '110₂ = 6 → 1100₂ = 12');
      await beat(tok, 2600);
      say('接 1 = 左移再加 1 = ×2 + 1', '2 = 1×2、3 = 1×2+1；4 = 2×2、5 = 2×2+1');
      for (const [p, a, b] of [[1, 2, 3], [2, 4, 5]]) { lit(N[p], GOLD); lit(N[a], GREEN); lit(N[b], GREEN); await beat(tok, 1300); [p, a, b].forEach((k) => lit(N[k])); }
      await beat(tok, 2400);
    } };

    // ── 用 vector 存 full binary tree ──
    const VX = (i) => -4.2 + (i - 1) * 1.3;
    function vecTiles(n, z = 1.5) {
      const t = [];
      for (let i = 1; i <= n; i++) { t[i] = tileAt(VX(i), z, 1.0, 1.0); tag('[' + i + ']', 'idx', VX(i), 0.1, z + 0.75); }
      return t;
    }
    LECT['linb-vector'] = { title: '用 vector 存 full binary tree：不需要指標', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5.2, 12.5], [0, 3.0, 0.8]);
      const P = (i) => heapPos(i, 6.8, 1.2, 7);
      const N = {}, C = {}, E = []; links(E);
      for (let i = 1; i <= 7; i++) { N[i] = cube(i, depthColor(hdepth(i)), [0.7, 0.55, 0.7], P(i).x, P(i).y); if (i > 1) E.push([N[i >> 1], N[i]]); }
      const tiles = vecTiles(7);
      say('最喜歡用編號的 data structure：vector', '7 格，編號 1 到 7');
      await beat(tok, 2200);
      for (let i = 1; i <= 7; i++) {
        C[i] = cube(i, depthColor(hdepth(i)), [0.7, 0.55, 0.7], P(i).x, P(i).y);
        lab.springTo(C[i], V(VX(i), 0.35, 1.5));
        await beat(tok, 320);
      }
      await beat(tok, 600);
      const arcs = [];
      for (const i of [1, 2, 3]) {
        lit(C[i], GOLD); lit(N[i], GOLD);
        say('第 ' + i + ' 格：左小孩 ' + i + '×2 = ' + 2 * i, '右小孩 ' + i + '×2+1 = ' + (2 * i + 1));
        arcs.push(...arc(V(VX(i), 0.7, 1.5), V(VX(2 * i), 0.7, 1.5), CHILD_C));
        await beat(tok, 900);
        arcs.push(...arc(V(VX(i), 0.7, 1.5), V(VX(2 * i + 1), 0.7, 1.5), SIB_C));
        await beat(tok, 1500);
        lit(C[i]); lit(N[i]);
      }
      say('完全不用存 left／right 小紙條', '省空間；×2、×2+1 是很快的 bit shift');
      await beat(tok, 3000);
      killAll(arcs);
      for (const i of [5, 6]) {
        lab.flyAway(N[i], V(i === 5 ? -3 : 3, 8, 3)); lab.flyAway(C[i], V(0, 8, 4));
        const k = E.findIndex((e) => e[1] === N[i]); if (k >= 0) E.splice(k, 1);
        tiles[i].material.color.set('#f4d9d0');
      }
      say('一般 binary tree = full 砍掉一些 node', '示意：砍掉 5、6 → vector 留空格');
      await beat(tok, 3200);
      say('任何 binary tree 都能用 vector 表示', '<span class="ok">不需要任何 link</span>');
      await beat(tok, 2800);
    } };

    LECT['linb-complete'] = { title: '空間浪費、complete binary tree 與找爸爸', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5.0, 13.5], [0, 3.4, 0.8]);
      async function waste(set, levels, cap, f) {
        const total = (1 << levels) - 1;
        const sp = 12.6 / total, P = (i) => heapPos(i, 6.8, levels === 4 ? 1.35 : 1.15, levels === 4 ? 11 : 12.4);
        const objs = [], M = {};
        for (let i = 1; i <= total; i++) {
          const x = -6.3 + (i - 0.5) * sp;
          objs.push(tileAt(x, 2.6, sp * 0.86, 0.8, set.includes(i) ? '#e9dcc4' : '#f4d9d0'));
          if (set.includes(i)) {
            const p = P(i);
            M[i] = cube(levels === 4 ? i : '', depthColor(hdepth(i)), levels === 4 ? [0.55, 0.45, 0.55] : [0.42, 0.38, 0.42], p.x, p.y, 0, 2);
            objs.push(M[i]);
            objs.push(cube('', depthColor(hdepth(i)), [sp * 0.6, 0.3, 0.5], x, 0.25, 2.6));
          }
        }
        const E = [];
        for (const i of set) if (i > 1) E.push([M[i >> 1], M[i]]);
        objs.push(links(E));
        say(cap, f);
        await beat(tok, 3600);
        killAll(objs);
      }
      await waste([1, 2, 3, 4, 5, 6, 7, 9, 12, 15], 4, '4 層的樹只裝 10 個 node（示意）', 'vector 要 1+2+4+8 = 15 格，粉紅 = 空格');
      await waste([1, 2, 3, 5, 6, 10, 11, 13, 26, 27], 5, '5 層的樹也只裝 10 個', '要配置 31 格 → 浪費 21 格');
      const P = (i) => heapPos(i, 6.4, 1.6, 8);
      const N = {}, C = {}, E = []; links(E);
      const tiles = [];
      for (let i = 1; i <= 7; i++) {
        N[i] = cube(i, depthColor(hdepth(i)), NODE, P(i).x, P(i).y, 0, 2);
        if (i > 1) E.push([N[i >> 1], N[i]]);
        tiles[i] = tileAt(VX(i), 1.5, 1.0, 1.0); tag('[' + i + ']', 'idx', VX(i), 0.1, 2.25);
        C[i] = cube(i, depthColor(hdepth(i)), [0.7, 0.55, 0.7], VX(i), 0.35, 1.5);
      }
      say('越接近 full binary tree 越不浪費', 'full：7 個 node 剛好 7 格');
      await beat(tok, 2600);
      for (const i of [7, 6, 5]) {
        lab.flyAway(N[i], V(4, 8, 3)); lab.flyAway(C[i], V(4, 8, 4)); kill(tiles[i]);
        const k = E.findIndex((e) => e[1] === N[i]); if (k >= 0) E.splice(k, 1);
        await beat(tok, 500);
      }
      say('只留 full tree 的前 4 個 node', '這種叫 complete binary tree');
      await beat(tok, 2600);
      say('編號 1..n ↔ size n 的 array', '連接關係仍由 ×2、×2+1 決定');
      await beat(tok, 2400);
      const arcs = [];
      for (const [c, p] of [[4, 2], [3, 1], [2, 1]]) {
        lit(C[c], GOLD); lit(N[c], GOLD); lit(C[p], GREEN); lit(N[p], GREEN);
        arcs.push(...arc(V(VX(c), 0.7, 1.5), V(VX(p), 0.7, 1.5), '#4b9ee2'));
        say('由小孩找爸爸：' + c + ' / 2 = ' + p, c === 4 ? '5 / 2 = 2 也一樣（整數除法）' : '編號除以 2，捨去小數');
        await beat(tok, 1700);
        [c, p].forEach((k) => { lit(C[k]); lit(N[k]); });
      }
      say('小孩：×2、×2+1；爸爸：÷2', '<span class="ok">parent(i) = ⌊i/2⌋</span>（老師口誤說「乘以 2」）');
      await beat(tok, 3000);
    } };

    LECT['linb-level-def'] = { title: 'Q&A：五層的樹高度是 5 還是 4？', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.4, 13.5], [0, 3.8, 0]);
      const set = [1, 2, 3, 4, 5, 6, 7, 8, 9, 16];
      const P = (i) => heapPos(i, 6.6, 1.3, 9);
      const M = {}, E = []; links(E);
      for (const i of set) { M[i] = cube('', depthColor(hdepth(i)), [0.6, 0.5, 0.6], P(i).x, P(i).y, 0, 2); if (i > 1) E.push([M[i >> 1], M[i]]); await beat(tok, 150); }
      say('同學問：五層的樹，高度是 5 還是 4？', '不同書說法不一樣，沒有完全公定');
      await beat(tok, 2800);
      const a = [];
      for (let d = 0; d < 5; d++) { a.push(tag('第 ' + d + ' 層', 'ptr', -5.6, 6.6 - d * 1.3)); await beat(tok, 300); }
      say('本課：root 是第 0 層', '最深是第 4 層 → <span class="ok">height = 4</span>');
      lit(M[16], GOLD);
      await beat(tok, 2800);
      for (let d = 0; d < 5; d++) { tag('level ' + (d + 1), 'ptr alt', 5.6, 6.6 - d * 1.3); await beat(tok, 300); }
      say('洪逸／Horowitz：root 在 level 1', '五層 → depth（height）= 5');
      await beat(tok, 2800);
      say('寫題前先確認題目用哪種定義', '同一棵樹，兩種慣例差 1');
      await beat(tok, 2800);
    } };

    LECT['linb-huffman'] = { title: '延伸：Huffman tree 與 path code 解碼', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.4, 13.5], [0, 3.6, 0.6]);
      const root = T('•', T('A'), T('•', T('B'), T('•', T('C'), T('D'))));
      showTree(root, { topY: 6.6, minY: 2.4 });
      walkPre(root, (n) => { for (const [c, b] of [[n.left, '0'], [n.right, '1']]) if (c) { const m = n.pos.clone().add(c.pos).multiplyScalar(0.5); const l = tag(b, 'ptr', m.x + (b === '1' ? 0.3 : -0.3), m.y + 0.2); if (b === '0') l.element.style.color = CHILD_C; } });
      say('Huffman tree：資料壓縮用的 binary tree', '示意：A = 0、B = 10、C = 110、D = 111');
      await beat(tok, 3000);
      const bits = '010110111'.split('');
      const bt = bits.map((b, k) => tag(b, 'idx', -4 + k * 0.7, 0.9, 1.6));
      tag('壓縮資料', 'ptr', -5.8, 0.9, 1.6);
      tag('解出', 'ptr', -5.8, 0.3, 3.0);
      say('解壓縮：順著 bit 沿 path 走', '走到 leaf 就 decode 出一個符號');
      await beat(tok, 2200);
      const cur = makeCursor();
      let n = root, outN = 0;
      cursorTo(cur, root.pos);
      for (let k = 0; k < bits.length; k++) {
        bt[k].element.className = 'lab-label ptr alt';
        n = bits[k] === '0' ? n.left : n.right;
        cursorTo(cur, n.pos);
        await beat(tok, 700);
        if (!n.left && !n.right) {
          glow(n, GOLD);
          cube(n.label, depthColor(n.depth), SMALL, -4 + outN * 0.9, 0.3, 3.0, 2);
          outN++;
          say('走到 leaf：解出 ' + n.label, '回到 root 繼續');
          await beat(tok, 900);
          glow(n, OFF);
          n = root; cursorTo(cur, root.pos);
          await beat(tok, 300);
        }
      }
      say('每個符號都要從 root 走到 leaf', '一張 JPEG 要走非常非常多次');
      await beat(tok, 3000);
    } };

    LECT['linb-cache'] = { title: '經驗談：node 四散 vs 壓進 vector', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 7.5, 11], [0, 0.8, 0.6]);
      const X = (i) => -6.0 + i * 0.86;
      const scat = [6, 1, 12, 0, 9, 4, 13];
      tag('記憶體：node 四散', 'ptr', -4.6, 1.4, -2.2);
      for (let i = 0; i < 15; i++) tileAt(X(i), -1.5, 0.78, 0.8);
      const A = {};
      for (let i = 1; i <= 7; i++) A[i] = cube(i, depthColor(hdepth(i)), [0.6, 0.5, 0.6], X(scat[i - 1]), 0.3, -1.5, 2);
      await beat(tok, 900);
      say('用指標串起來：node 四散在記憶體各處', '沿指標跳來跳去，cache 幫不上忙');
      const ar = [];
      for (const i of [1, 2, 3]) for (const c of [2 * i, 2 * i + 1]) { ar.push(...arc(V(X(scat[i - 1]), 0.6, -1.5), V(X(scat[c - 1]), 0.6, -1.5), '#b04040', 0.5 + 0.12 * Math.abs(scat[c - 1] - scat[i - 1]))); await beat(tok, 450); }
      await beat(tok, 1600);
      tag('vector：位置相近', 'ptr alt', -4.6, 1.4, 1.2);
      for (let i = 1; i <= 7; i++) { tileAt(X(i + 3), 2.4, 0.78, 0.8); cube(i, depthColor(hdepth(i)), [0.6, 0.5, 0.6], X(i + 3), 0.3, 2.4, 2); }
      await beat(tok, 700);
      say('像 full binary tree 壓進 vector', 'node 位置相近 + 找小孩只要 ×2、×2+1');
      for (const i of [1, 2, 3]) for (const c of [2 * i, 2 * i + 1]) { arc(V(X(i + 3), 0.6, 2.4), V(X(c + 3), 0.6, 2.4), CHILD_C, 0.4 + 0.1 * (c - i)); await beat(tok, 350); }
      await beat(tok, 1600);
      say('MPEG-2 decoder ≈ 每秒 30 次 JPEG 解碼', '記憶體配置決定程式夠不夠快');
      await beat(tok, 3000);
      say('full tree、vector、path code 都相關', '<span class="ok">未來學 Huffman tree、JPEG 會用到</span>');
      await beat(tok, 2800);
    } };

    // ── Expression tree：×(+(3,5), −(2, +(7,4))) ──
    LECT['linb-expr-tree'] = { title: 'Expression tree：運算子、運算元與括號', play: async (tok) => {
      const paren = PRM().phase === 'paren';
      fresh();
      lab.frameCamera([0, 4.4, 13.5], [0, 3.4, 0.6]);
      const src = '×(+(3,5),−(2,+(7,4)))';
      const opts = { topY: 6.4, minY: 2.6 };
      const root = paren ? showTree(src, opts) : await dropTree(tok, src, opts, 260);
      const internal = postorder(root).filter((n) => n.left);
      const leaves = allNodes(root).filter((n) => !n.left && !n.right);
      if (!paren) {
        say('把 tree 和作業三連起來：expression tree', '老師畫的：×(3+5, 2−(7+4))');
        await beat(tok, 2200);
        internal.forEach((n) => glow(n, GOLD));
        say('root、internal node 放運算子', '×、+、−、+');
        await beat(tok, 2400);
        leaves.forEach((n) => glow(n, GREEN));
        say('leaf 放要計算的數字', '3、5、2、7、4');
        await beat(tok, 2400);
        say('全是 binary operator → binary tree', 'unary operator 或多參數 function call → 不一定');
        await beat(tok, 2600);
        allNodes(root).forEach((n) => glow(n, OFF));
        const cur = makeCursor();
        const val = new Map(leaves.map((n) => [n, Number(n.label)]));
        const op = { '+': (a, b) => a + b, '−': (a, b) => a - b, '×': (a, b) => a * b };
        for (const n of internal) {
          if (n === root.right) { cursorTo(cur, n.left.pos); glow(n.left, GREEN); say('右 subtree：2 是 leaf，就是 2', '再算 7 + 4'); await beat(tok, 1400); }
          const a = val.get(n.left), b = val.get(n.right), v = op[n.label](a, b);
          val.set(n, v);
          cursorTo(cur, n.pos); glow(n, GOLD);
          tag('= ' + v, 'ptr alt', n.pos.x + 0.75, n.pos.y - 0.45);
          say('左右 subtree 算完，再做 root', a + ' ' + n.label + ' ' + (b < 0 ? '(' + b + ')' : b) + ' = ' + v);
          await beat(tok, 1700);
        }
        say('結果 −72（老師沒算到，補充）', '<span class="ok">(3+5) × (2 − (7+4)) = −72</span>');
        await beat(tok, 3000);
        return;
      }
      const ino = inorder(root);
      const toks = ino.map((n) => cube(n.label, n.left ? '#f2c46d' : '#2fc092', SMALL, n.pos.x, 0.3, 1.6, 2));
      say('subtree 先算，root 後算', '照 x 位置讀下來：3 + 5 × 2 − 7 + 4（還沒加括號）');
      await beat(tok, 3000);
      const closeCnt = new Map();
      const box = (n) => { const s = inorder(n), d = postorder(n); const xs = s.map((k) => k.pos.x), ys = d.map((k) => k.pos.y); return ghost('#c08a1f', (Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, Math.max(...xs) - Math.min(...xs) + 1.1, Math.max(...ys) - Math.min(...ys) + 0.9); };
      const steps = [[root.left, '左 subtree 加括號：(3+5)', '加括號 = 要先算'], [root.right.right, '最裡面：(7+4)', 'subtree 加括號、root 放中間'],
        [root.right, '右 subtree：(2 − (7+4))', '遞迴做同一件事']];
      for (const [n, cap, f] of steps) {
        const s = inorder(n), i0 = ino.indexOf(s[0]), i1 = ino.indexOf(s[s.length - 1]);
        const c = closeCnt.get(i1) || 0; closeCnt.set(i1, c + 1);
        const g = box(n);
        tag('(', 'ptr', ino[i0].pos.x - 0.55, 0.35, 1.6); tag(')', 'ptr', ino[i1].pos.x + 0.55 + c * 0.4, 0.35, 1.6);
        say(cap, f);
        await beat(tok, 2600);
        kill(g);
      }
      glow(root.right.left, GREEN);
      say('leaf（如 2）本身不用加括號', '2 就是 2');
      await beat(tok, 2200);
      glow(root.right.left, OFF);
      say('寫回算式：(3+5) × (2 − (7+4))', '<span class="ok">root × 放在中間</span>');
      glow(root, GOLD);
      await beat(tok, 2600);
      say('internal node 放 operator', 'external node（leaf）放 operand');
      await beat(tok, 2400);
      say('subtree 代表 parentheses', '補充：= inorder 加括號；postfix 為 3 5 + 2 7 4 + − ×');
      await beat(tok, 3000);
      void toks;
    } };
  }

  // ─── VwQeypxlevE：交大彭文志 Lec12 Trees（1/6）───
  {
    const HT = 'A(B(E(K,L),F),C(G),D(H,I,J))';          // 課本 Fig 5.2 的一般樹
    const HT_BIN = 'A(B(E(K(,L),F),C(G,D(H(,I(,J))))))'; // 它的 LCRS → binary tree
    const CT = 'A(B(D(H,I),E),C(F,G))';                  // 講師的 complete binary tree（9 個 node）
    const PP = () => ctx.params || {};
    const BLU = '#4b9ee2', ORG = '#dd8238', PUR = '#9b7ef4', GRN = '#2fc092', SAND = '#c9b48e', DIM = '#d8cfc0';
    const topP = (p, h = 0.3) => V(p.x, p.y + h, p.z + 0.02), botP = (p, h = 0.3) => V(p.x, p.y - h, p.z + 0.02);
    const hide = (l, on) => { l.element.style.visibility = on ? '' : 'hidden'; };
    const flyB = (b) => b && lab.flyAway(b, V((Math.random() - 0.5) * 6, 8, 4));
    const hiEdge = (a, b, color = '#c08a1f') => seg(botP(a.pos), topP(b.pos), color);

    // 一般樹一個一個掉下來
    async function dropG(tok, src, o, ms = 200, opt = {}) {
      const root = typeof src === 'string' ? parseG(src) : src;
      layoutG(root, o);
      const size = opt.size || ((n) => [W(n.label), 0.6, 0.8]);
      edgeLines(() => { const out = []; for (const n of gAll(root)) for (const k of n.kids) if (n.body && k.body) out.push([n.body.obj.position, k.body.obj.position]); return out; });
      const q = [root];
      while (q.length) {
        const n = q.shift();
        const b = lab.addBody(block(n.label, size(n), opt.color ? opt.color(n) : depthColor(n.depth)));
        b.obj.position.copy(n.pos).add(V(0, 3, 0)); lab.dropTo(b, n.pos.clone()); n.body = b;
        q.push(...n.kids);
        if (ms) await beat(tok, ms);
      }
      return root;
    }
    // 深度 4 的位置框（編號 1..15）
    const HP = (i) => heapPos(i, 6.6, 1.5, 11.6);
    function slots(n, posFn = HP, withIdx = false) {
      const out = [];
      for (let i = 1; i <= n; i++) {
        const g = new THREE.Mesh(new THREE.BoxGeometry(...NODE), new THREE.MeshBasicMaterial({ color: SAND, wireframe: true, transparent: true, opacity: 0.35 }));
        g.position.copy(posFn(i)); lab.world.add(g); out.push(g);
        if (withIdx) { const p = posFn(i); tag(String(i), 'idx', p.x, p.y - 0.55); }
      }
      return out;
    }
    function idxCube(v, i, color, pos) {
      const b = lab.addBody(block(v, NODE, color));
      b.obj.position.copy(pos); b.target.copy(pos);
      const il = lab.label(String(i), 'idx'); il.position.set(0.6, -0.32, 0); b.obj.add(il);
      b.il = il;
      return b;
    }

    // ── 1. Tree 的遞迴定義 ──
    LECT['p12-def'] = { title: 'Tree 的遞迴定義：root + T1…Tk', play: async (tok) => {
      fresh(); lab.frameCamera([0, 5, 13.5], [0, 3.6, 0]);
      say('Tree 長得像族譜（示意）', '上面是祖先，下面是 child');
      const fam = await dropG(tok, '祖先(拉丁人(義大利人,法國人),日耳曼人(德國人,荷蘭人),斯拉夫人)', { width: 11, topY: 6.4, step: 1.9 }, 260);
      await beat(tok, 1400);
      const leaves = gAll(fam).filter((n) => !n.kids.length);
      leaves.forEach((n) => gLit(n, GOLD));
      say('最底下沒有 child 的叫 leaf node', 'leaf：沒有再往下長');
      await beat(tok, 2600);
      gAll(fam).forEach((n) => flyB(n.body));
      await beat(tok, 800);
      fresh(); lab.frameCamera([0, 5, 13.5], [0, 3.6, 0]);
      say('定義：a collection of nodes', '有一個特殊 node 叫 root（一定要有）');
      const r = cube('root', GRN, [1.2, 0.6, 0.8], 0, 6.4, 0, 3);
      await beat(tok, 2200);
      const subs = [['T1', -4.4, 2], ['T2', 0, 1], ['Tk', 4.4, 3]].map(([nm, cx, k], j) => {
        const g = ghost([BLU, PUR, ORG][j], cx, 3.3, 3.4, 2.9);
        const lb = tag(nm, 'ptr', cx, 5.0);
        const sr = cube('r' + (j === 2 ? 'k' : j + 1), BLU, [0.8, 0.5, 0.7], cx, 4.15, 0, 2);
        const kids = [];
        for (let i = 0; i < k; i++) {
          const x = cx + (i - (k - 1) / 2) * 1.05;
          kids.push(cube('', PUR, [0.6, 0.45, 0.6], x, 2.55, 0, 2));
          seg(V(cx, 3.9, 0), V(x, 2.78, 0), '#7a6a52');
        }
        arrow(V(0, 6.1, 0), V(cx, 4.45, 0));
        return { g, lb, sr, kids };
      });
      tag('…', 'ptr', 2.2, 3.3);
      say('root 底下接 k 棵 subtree：T1 … Tk', '彼此不相交（disjoint）');
      await beat(tok, 3000);
      lit(subs[0].sr, GOLD);
      say('每棵 subtree 又有自己的 root', '→ 定義是 recursive（遞迴）的');
      await beat(tok, 3000);
      lit(subs[0].sr);
      subs.forEach((s) => s.kids.forEach((b) => lit(b, GOLD)));
      say('最底下沒有 child 的是 leaf node', 'subtree 的 subtree… 最後停在 leaf');
      await beat(tok, 2600);
      subs.forEach((s) => s.kids.forEach((b) => lit(b)));
      lit(r, GOLD);
      say('一個 node 可以分幾枝，可以自己定', '分枝數 k 依需求定義（k = 2 → binary）');
      await beat(tok, 3000);
    } };

    // ── 2/3/5. 範例樹：level、degree、parent／child、sibling、ancestor ──
    async function sampleBase(tok) {
      fresh(); lab.frameCamera([0, 5, 13.5], [0, 3.8, 0]);
      const root = await dropG(tok, HT, { width: 10, topY: 6.6, step: 1.6 }, 140);
      return { root, N: (l) => gFind(root, l) };
    }
    async function scLevels(tok) {
      const { root, N } = await sampleBase(tok);
      say('範例樹：A 是 root', 'A(B(E(K,L),F), C(G), D(H,I,J))');
      await beat(tok, 2000);
      const all = gAll(root);
      for (let d = 0; d < 4; d++) {
        tag('level ' + (d + 1), 'idx', -6.4, 6.6 - d * 1.6);
        const ns = all.filter((n) => n.depth === d);
        ns.forEach((n) => gLit(n, GOLD));
        say('level ' + (d + 1) + '：' + ns.map((n) => n.label).join(' '), d ? '往下一層 +1' : 'root 的 level 是 1');
        await beat(tok, 1300);
        ns.forEach((n) => gLit(n));
      }
      say('高度（深度）= 最大的 level', 'height = 4（root 算 level 1）');
      await beat(tok, 2400);
      const A = N('A'), C = N('C');
      gLit(A, GOLD);
      const ea = A.kids.map((k) => hiEdge(A, k));
      const ta = tag('degree(A) = 3', 'ptr alt', A.pos.x + 2.2, A.pos.y + 0.3);
      say('degree = 指出去的 child 數', 'A 指出去 3 條 → degree(A) = 3');
      await beat(tok, 3000);
      gLit(A); ea.forEach(kill); kill(ta);
      gLit(C, GOLD);
      const up = hiEdge(A, C, '#d04040'), dn = hiEdge(C, N('G'));
      tag('✗ 不算', 'ptr', (A.pos.x + C.pos.x) / 2 + 0.7, (A.pos.y + C.pos.y) / 2);
      tag('degree(C) = 1', 'ptr alt', C.pos.x + 1.6, C.pos.y + 0.2);
      say('別人指到它的邊不算', '只算往下指的：degree(C) = 1');
      await beat(tok, 3200);
      say('Tree 是一種特殊的 graph', 'graph 的 degree 再分 in／out-degree（第 6 章）');
      await beat(tok, 2800);
      void up; void dn;
    }
    async function scParent(tok) {
      const { N } = await sampleBase(tok);
      const A = N('A'), B = N('B');
      gLit(A, GOLD);
      tag('root：最原始的祖先', 'ptr alt', A.pos.x, A.pos.y + 0.8);
      say('A 是整棵 tree 最原始的祖先', 'root = A');
      await beat(tok, 2600);
      gLit(A);
      const sub = ['B', 'E', 'F', 'K', 'L'].map(N);
      sub.forEach((n) => lab.springTo(n.body, n.pos.clone().setZ(1.6)));
      const xs = sub.map((n) => n.pos.x);
      ghost(BLU, (Math.min(...xs) + Math.max(...xs)) / 2, 3.4, Math.max(...xs) - Math.min(...xs) + 1.4, 4.0, 1.6);
      tag('B 的 subtree', 'ptr', Math.min(...xs) - 0.2, 5.8, 1.6);
      gLit(B, GOLD);
      say('把 subtree 拉出來：祖先是 B', 'B 是這棵 subtree 的 root／parent');
      await beat(tok, 3000);
      ['E', 'F'].forEach((l) => { gLit(N(l), GREEN); tag('child', 'ptr', N(l).pos.x, N(l).pos.y - 0.6, 1.6); });
      say('B link 出去的 node 是它的 child', 'child(B) = E、F');
      await beat(tok, 2800);
      ['K', 'L'].forEach((l) => { gLit(N(l), RED); });
      tag('E 的 child', 'ptr', N('E').pos.x, N('K').pos.y - 0.7, 1.6);
      say('K、L 是 E 的 child，不是 B 的', 'K、L 對 B 而言是 descendant（孫輩）');
      await beat(tok, 3200);
      gLit(N('E'), GOLD);
      say('parent／child 是相對的關係', 'E 是 B 的 child，也是 K、L 的 parent');
      await beat(tok, 3000);
    }
    async function scSibling(tok) {
      const { N } = await sampleBase(tok);
      const sibs = ['B', 'C', 'D'].map(N);
      sibs.forEach((n) => gLit(n, GREEN));
      tag('sibling', 'ptr', 6.0, sibs[0].pos.y);
      say('同一個 parent 的 node 互為 sibling', 'B、C、D 的 parent 都是 A');
      await beat(tok, 2800);
      sibs.forEach((n) => gLit(n));
      ['K', 'L'].forEach((l) => gLit(N(l), GREEN));
      say('K、L 也是 sibling', 'parent 都是 E');
      await beat(tok, 2200);
      ['K', 'L'].forEach((l) => gLit(N(l)));
      ['E', 'G'].forEach((l) => gLit(N(l), RED));
      say('E、G 同一層，但 parent 不同', '不是 sibling（補充：叫 cousin）');
      await beat(tok, 2600);
      ['E', 'G'].forEach((l) => gLit(N(l)));
      const cur = makeCursor();
      const path = ['A', 'B', 'E', 'K'].map(N);
      for (let i = 0; i < path.length; i++) {
        cursorTo(cur, path[i].pos);
        if (i) hiEdge(path[i - 1], path[i]);
        say('從 root 往下走到 K：形成一條 path', path.slice(0, i + 1).map((n) => n.label).join(' → '));
        await beat(tok, 1000);
      }
      path.slice(0, 3).forEach((n) => { gLit(n, GOLD); tag('ancestor', 'ptr alt', n.pos.x + 1.25, n.pos.y + 0.1); });
      say('path 上經過的 node 是 K 的 ancestors', 'ancestors(K) = A、B、E');
      await beat(tok, 3200);
    }
    LECT['p12-sample'] = { title: '範例樹：level、degree、parent、sibling', play: (tok) => {
      const f = PP().focus;
      return f === 'parent' ? scParent(tok) : f === 'sibling' ? scSibling(tok) : scLevels(tok);
    } };

    // ── 6. list 表示法 ──
    LECT['p12-list'] = { title: 'Tree 的 list 表示法', play: async (tok) => {
      fresh(); lab.frameCamera([0, 5, 13.5], [0, 3.8, 0.4]);
      const root = await dropG(tok, HT, { width: 10, topY: 6.8, step: 1.4 }, 120);
      const N = (l) => gFind(root, l);
      const str = tag('', '', 0, 0.9, 1.2); Object.assign(str.element.style, MONO, { fontSize: '14px' });
      say('Tree 不只一種表示法', '括號代表從屬關係（list）');
      await beat(tok, 2200);
      const box = (ls, color, pad = 0.55) => {
        const ns = ls.map(N), xs = ns.map((n) => n.pos.x), ys = ns.map((n) => n.pos.y);
        return ghost(color, (Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, Math.max(...xs) - Math.min(...xs) + 2 * pad + 0.4, Math.max(...ys) - Math.min(...ys) + 1.0);
      };
      const steps = [
        [['K', 'L'], BLU, 'E(K,L)', 'K、L 括在一起：共同 parent 是 E', '(K,L) 前面接 E'],
        [['E', 'F', 'K', 'L'], PUR, 'B(E(K,L),F)', 'E、F 括在一起：parent 是 B', '(E(K,L),F) 前面接 B'],
        [['G'], ORG, 'B(E(K,L),F),C(G),D(H,I,J)', '依此類推：C(G)、D(H,I,J)', 'B、C、D 的 parent 是 A'],
      ];
      const gs = [];
      for (const [ls, c, s, cap, f] of steps) {
        gs.push(box(ls, c));
        if (ls[0] === 'G') gs.push(box(['H', 'I', 'J'], ORG));
        str.element.textContent = s;
        say(cap, f);
        await beat(tok, 2800);
      }
      str.element.textContent = '(A(B(E(K,L),F),C(G),D(H,I,J)))';
      gLit(N('A'), GOLD);
      say('整棵 tree 寫成一個 list', '(A(B(E(K,L),F),C(G),D(H,I,J)))');
      await beat(tok, 2600);
      gAll(root).forEach((n) => flyB(n.body)); gs.forEach(kill);
      await beat(tok, 800);
      // 每一層括號 = 一條 linked list（• = 指向子 list）
      const L = {};
      const cell = (k, v, x, y, color) => { L[k] = cube(v, color, [0.8, 0.6, 0.8], x, y, 0, 2.5); return L[k]; };
      const nxt = (a, b) => arrow(V(L[a].target.x + 0.42, L[a].target.y, 0), V(L[b].target.x - 0.42, L[b].target.y, 0));
      const dn = (a, b) => arrow(V(L[a].target.x, L[a].target.y - 0.3, 0), V(L[b].target.x, L[b].target.y + 0.32, 0), BLU);
      const rows = [
        ['A 的 list：A 後面三個分支', '每個 • 指向一條子 list', [['A', 'A', -5.5, 6.2, GRN], ['a1', '•', -4.0, 6.2, SAND], ['a2', '•', -2.5, 6.2, SAND], ['a3', '•', -1.0, 6.2, SAND]], [['A', 'a1'], ['a1', 'a2'], ['a2', 'a3']], []],
        ['B 的子 list：B → •(E…) → F', '(E(K,L),F) 前面接 B', [['B', 'B', -4.0, 4.5, BLU], ['b1', '•', -2.5, 4.5, SAND], ['F', 'F', -1.0, 4.5, PUR]], [['B', 'b1'], ['b1', 'F']], [['a1', 'B']]],
        ['E 的子 list：E → K → L', '(K,L) 前面接 E', [['E', 'E', -2.5, 2.8, PUR], ['K', 'K', -1.0, 2.8, '#e55a9b'], ['L', 'L', 0.5, 2.8, '#e55a9b']], [['E', 'K'], ['K', 'L']], [['b1', 'E']]],
        ['C、D 的子 list', 'C(G)、D(H,I,J)', [['C', 'C', 1.5, 4.5, BLU], ['G', 'G', 3.0, 4.5, PUR], ['D', 'D', 1.9, 2.8, BLU], ['H', 'H', 3.3, 2.8, PUR], ['I', 'I', 4.7, 2.8, PUR], ['J', 'J', 6.1, 2.8, PUR]], [['C', 'G'], ['D', 'H'], ['H', 'I'], ['I', 'J']], [['a2', 'C'], ['a3', 'D']]],
      ];
      const s2 = tag('(A(B(E(K,L),F),C(G),D(H,I,J)))', '', 0, 7.5); Object.assign(s2.element.style, MONO, { fontSize: '13px' });
      for (const [cap, f, cs, ns, ds] of rows) {
        say(cap, f);
        for (const [k, v, x, y, c] of cs) { cell(k, v, x, y, c); await beat(tok, 260); }
        ns.forEach(([a, b]) => nxt(a, b)); ds.forEach(([a, b]) => dn(a, b));
        await beat(tok, 1800);
      }
      say('每一層括號都是一條 linked list', 'Tree 是高層次的 DS，看你怎麼 implement');
      await beat(tok, 3000);
    } };

    // ── 7. k-ary tree 的 null pointer ──
    LECT['p12-kary'] = { title: 'k-ary tree：固定 k 個 pointer 很浪費', play: async (tok) => {
      fresh(); lab.frameCamera([0, 5, 13.5], [0, 3.6, 0]);
      const labs = ['data', '1', '2', '3', '4', '5', '…', 'k'];
      let x = -4.4;
      const cs = labs.map((v, i) => { const w = i ? 0.8 : 1.6; const b = cube(v, i ? BLU : GRN, [w, 0.8, 0.9], x + w / 2, 4.2, 0, 2.5); x += w + 0.08; return b; });
      tag('k-ary tree 的 node', 'ptr', 0, 5.4);
      say('k-ary tree：每個 node 最多指 k 個', 'degree ≤ k');
      await beat(tok, 2600);
      cs.slice(1).forEach((b) => lit(b, GOLD));
      say('每個 node 都開 data + k 個 pointer', '不管實際有幾個 child，欄位數固定');
      await beat(tok, 2600);
      cs.forEach(flyB);
      await beat(tok, 700);
      fresh(); lab.frameCamera([0, 5, 13.5], [0, 3.6, 0]);
      const root = await dropG(tok, HT, { width: 10, topY: 6.6, step: 1.6 }, 90);
      const K = 3;
      const sl = new Map();
      for (const n of gAll(root)) {
        sl.set(n, [0, 1, 2].map((j) => cube('', DIM, [0.22, 0.16, 0.3], n.pos.x + (j - 1) * 0.27, n.pos.y - 0.48, 0)));
      }
      const cnt = tag('', 'ptr alt', 4.6, 7.5);
      setTag(cnt, 'pointer 共 n·k = 12 × 3 = 36');
      say('以課本樹示意：n = 12、k = 3', '總 pointer 數 = n·k = 36');
      await beat(tok, 2800);
      let used = 0;
      for (const n of gAll(root)) n.kids.forEach((c, j) => { sl.get(n)[j].obj.material.color.set(GRN); used++; });
      for (const n of gAll(root)) if (n.kids.length) { for (let j = 0; j < n.kids.length; j++) { lit(sl.get(n)[j], GREEN); } }
      say('除了 root，每個 node 恰被一個指到', '用到的 pointer = n − 1 = ' + used);
      await beat(tok, 3000);
      for (const n of gAll(root)) sl.get(n).forEach((b, j) => { if (j >= n.kids.length) b.obj.material.color.set('#e06666'); });
      setTag(cnt, 'null = 36 − 11 = 25');
      say('紅色都是 null（浪費）', 'nk − (n−1) = 36 − 11 = 25');
      await beat(tok, 3000);
      say('一般式：n(k−1) + 1 個 null', 'k = 2：n + 1；k = 3：2n + 1 → k 越大越浪費');
      await beat(tok, 3000);
      say('B-tree、B+ tree 也是 k-ary tree', '實務上看資料型態決定');
      await beat(tok, 2600);
    } };

    // ── 8/9. Left Child–Right Sibling，再轉成 binary tree ──
    LECT['p12-lcrs'] = { title: 'Left Child–Right Sibling 表示法', play: async (tok) => {
      const bin = PP().focus === 'bin';
      fresh(); lab.frameCamera([0, 5, 13.5], [0, 3.8, 0]);
      const g = layoutG(parseG(HT), { width: 10, topY: 6.6, step: 1.6 });
      const B = {}, P = {};
      for (const n of gAll(g)) { B[n.label] = cube(n.label, depthColor(n.depth), NODE, n.pos.x, n.pos.y, 0, bin ? 0 : 2); P[n.label] = n.pos; if (!bin) await beat(tok, 70); }
      const orig = [];
      for (const n of gAll(g)) for (const k of n.kids) orig.push(seg(botP(n.pos), topP(k.pos), DIM));
      const st = tag('node = [ data | left child | right sibling ]', 'ptr', 2.6, 7.6);
      const links = [['A', 'B', 'L'], ['A', null, 'S'], ['B', 'E', 'L'], ['B', 'C', 'S'], ['C', 'D', 'S'], ['C', 'G', 'L'], ['E', 'K', 'L'], ['E', 'F', 'S'], ['K', 'L', 'S'], ['D', 'H', 'L'], ['H', 'I', 'S'], ['I', 'J', 'S']];
      const arrs = [];
      const draw = (a, b, k) => {
        if (!b) return tag('sibling = null', 'idx', P[a].x + 1.5, P[a].y + 0.1);
        return k === 'L' ? arrow(botP(P[a]), topP(P[b], 0.32), BLU) : arrow(V(P[a].x + 0.42, P[a].y, 0.02), V(P[b].x - 0.42, P[b].y, 0.02), ORG);
      };
      if (!bin) {
        say('LCRS：每個 node 只有兩個 pointer', '藍 = left child（最左的 child），橘 = right sibling');
        await beat(tok, 2800);
        for (const [a, b, k] of links) {
          lit(B[a], GOLD);
          arrs.push(draw(a, b, k));
          say(b ? a + '.' + (k === 'L' ? 'leftChild' : 'rightSibling') + ' = ' + b : 'A 是 root：沒有 sibling', k === 'L' ? '指向最左邊的 child' : b ? '把右邊的兄弟串起來' : 'rightSibling = null');
          await beat(tok, 1150);
          lit(B[a]);
        }
        say('實作只要三個欄位', 'data、left child、right sibling → 不浪費 pointer');
        await beat(tok, 3200);
        return;
      }
      for (const [a, b, k] of links) arrs.push(draw(a, b, k));
      say('延續 LCRS：每個 node 兩個 pointer', '把兩個 pointer 看成兩個分支');
      await beat(tok, 3600);
      arrs.forEach(kill); orig.forEach(kill); kill(st);
      const br = parseTree(HT_BIN);
      layoutTree(br, Object.assign({}, TREE_O, { topY: 6.8, minY: 1.4 }));
      for (const n of levelorder(br)) { n.body = B[n.label]; lab.springTo(n.body, n.pos.clone()); }
      edgeLines(() => treePairs(br));
      say('right sibling 改當 right child', '（課本：LCRS 順時針轉 45°）');
      await beat(tok, 4200);
      const A = levelorder(br)[0];
      lit(B.A, GOLD);
      tag('right = 空', 'ptr alt', A.pos.x + 1.3, A.pos.y - 0.6);
      say('得到 degree 2 的 tree = binary tree', 'root 沒有 sibling → right child 一定空');
      await beat(tok, 3000);
      lit(B.A);
      tag('k 個 child 欄位（最直覺）', 'ptr', -4.2, 0.4, 1.4); tag('list（括號）', 'ptr', 0, 0.4, 1.4); tag('LCRS', 'ptr', 3.6, 0.4, 1.4);
      say('表示法小結：三種都可以', 'k-ary tree 的 k = 2 就是 binary tree');
      await beat(tok, 4400);
    } };

    // ── 10. Binary tree 定義 vs Tree ──
    LECT['p12-bt-def'] = { title: 'Binary tree 定義：和一般 tree 的差別', play: async (tok) => {
      fresh(); lab.frameCamera([0, 5, 13.5], [0, 4, 0]);
      const e = ghost(SAND, 0, 5.0, 3.2, 1.8);
      const et = tag('∅  empty binary tree', 'ptr alt', 0, 5.0);
      say('Binary tree：a finite set of nodes', '是 set → 可以是 empty（合法）');
      await beat(tok, 3000);
      kill(e); kill(et);
      const r = cube('root', GRN, [1.2, 0.6, 0.8], 0, 6.4, 0, 3);
      const gl = ghost(BLU, -2.4, 4.0, 3.0, 2.2), gr = ghost(PUR, 2.4, 4.0, 3.0, 2.2);
      const tl = tag('left subtree', 'ptr', -2.4, 4.0), tr = tag('right subtree', 'ptr', 2.4, 4.0);
      const a1 = arrow(V(-0.3, 6.1, 0), V(-2.0, 5.15, 0)), a2 = arrow(V(0.3, 6.1, 0), V(2.0, 5.15, 0));
      say('非空：root + left + right subtree', '左右 subtree 本身也是 binary tree（可空）');
      await beat(tok, 3200);
      [gl, gr, tl, tr, a1, a2].forEach(kill); flyB(r);
      await beat(tok, 600);
      tag('Binary tree', 'ptr alt', 0.6, 7.2); tag('Tree', 'ptr', 4.4, 7.2);
      const rows = [
        ['允許 0 個 node', '✓ 可以', '✗ 不行', '一般 tree 不允許 0 個 node', 'tree 至少要有 root'],
        ['左右順序', '有區分', '不區分', 'binary tree 的左右子樹有差別', 'tree 不管 child 的順序'],
        ['degree', '≤ 2', 'no limit', '比較表：degree', 'binary ≤ 2，tree 沒有限制'],
      ];
      for (let k = 0; k < rows.length; k++) {
        const [nm, a, b, cap, f] = rows[k], y = 5.8 - k * 1.5;
        tag(nm, 'ptr', -4.4, y);
        cube(a, k === 0 ? GRN : BLU, [2.6, 0.7, 0.8], 0.6, y, 0, 2.5);
        await beat(tok, 300);
        cube(b, k === 0 ? '#e06666' : SAND, [2.6, 0.7, 0.8], 4.4, y, 0, 2.5);
        say(cap, f);
        await beat(tok, 2800);
      }
      say('A 只有左 child ≠ A 只有右 child', '在 binary tree 是兩棵不同的樹（補充）');
      await beat(tok, 3000);
    } };

    // ── 11. Binary tree 範例 ──
    LECT['p12-bt-examples'] = { title: 'Binary tree 範例：左右有別、skewed、complete', play: async (tok) => {
      fresh(); lab.frameCamera([0, 5, 13.5], [0, 4, 0]);
      const t1 = await dropG(tok, 'A(B)', { cx: -5.4, topY: 6.2, step: 1.6 }, 200);
      const t2 = await dropG(tok, 'A(B,C)', { cx: -2.3, width: 1.8, topY: 6.2, step: 1.6 }, 200);
      tag('tree：AB', 'ptr', -5.4, 7.2); tag('tree：ABC', 'ptr', -2.3, 7.2);
      void t1; void t2;
      // 中間：LCRS 實作
      const i1a = cube('A', GRN, NODE, 1.6, 6.2, 0, 2), i1b = cube('B', BLU, NODE, 1.6, 4.6, 0, 2);
      arrow(V(1.6, 5.9, 0), V(1.6, 4.92, 0), BLU);
      const i2a = cube('A', GRN, NODE, 4.4, 6.2, 0, 2), i2b = cube('B', BLU, NODE, 4.4, 4.6, 0, 2), i2c = cube('C', BLU, NODE, 6.0, 4.6, 0, 2);
      arrow(V(4.4, 5.9, 0), V(4.4, 4.92, 0), BLU); arrow(V(4.82, 4.6, 0), V(5.58, 4.6, 0), ORG);
      tag('LCRS 實作的長相', 'ptr alt', 3.8, 7.2);
      void i1a; void i1b; void i2a; void i2b;
      say('AB、ABC 都是 tree；右邊是 LCRS 實作', '藍 = left child，橘 = right sibling');
      await beat(tok, 3000);
      lit(i2c, GOLD);
      say('程式裡的長相 ≠ 實際 tree 的長相', 'C 在實作裡是 B 的 sibling');
      await beat(tok, 2800);
      fresh(); lab.frameCamera([0, 5, 13.5], [0, 4, 0]);
      await dropTree(tok, 'A(B)', { cx: -3, width: 2, topY: 6.0, minY: 4.4 }, 250);
      await dropTree(tok, 'A(,B)', { cx: 3, width: 2, topY: 6.0, minY: 4.4 }, 250);
      tag('≠', 'ptr alt', 0, 5.2);
      tag('A 的 left child = B', 'ptr', -3, 3.4); tag('A 的 right child = B', 'ptr', 3, 3.4);
      say('左 child B ≠ 右 child B', '當作一般 tree 卻是同一棵');
      await beat(tok, 3400);
      fresh(); lab.frameCamera([0, 5, 13.5], [0, 4, 0]);
      tag('skewed binary tree', 'ptr', -3.6, 7.4);
      await dropTree(tok, 'A(B(C(D(E))))', { cx: -3.8, width: 4.4, topY: 6.6, minY: 1.8 }, 250);
      say('全部歪向同一邊：skewed binary tree', '長得就像 linked list');
      await beat(tok, 2600);
      tag('complete binary tree', 'ptr alt', 3.4, 7.4);
      await dropTree(tok, CT, { cx: 3.4, width: 6.8, topY: 6.6, minY: 2.4 }, 180);
      say('排得很整齊的：complete binary tree', 'A(B(D(H,I),E),C(F,G))，9 個 node');
      await beat(tok, 2600);
      say('complete 不只是「很平衡」', '補充：要剛好佔滿層序編號 1..n');
      await beat(tok, 3000);
    } };

    // ── 12/16. Lemma 5.2 與 full binary tree ──
    LECT['p12-max-nodes'] = { title: '每層最多 2^(i−1)、深度 k 最多 2^k − 1', play: async (tok) => {
      const full = PP().focus === 'full';
      fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 4.1, 0]);
      slots(15);
      for (let d = 0; d < 4; d++) tag('level ' + (d + 1), 'idx', -6.7, 6.6 - d * 1.5);
      if (!full) {
        say('Binary tree 第 i 層最多幾個 node？', 'root 在 level 1');
        await beat(tok, 2400);
        let sum = 0;
        for (let d = 0; d < 4; d++) {
          const c = 1 << d; sum += c;
          for (let i = c; i < 2 * c; i++) { cube('', depthColor(d), NODE, HP(i).x, HP(i).y, 0, 2.5); await beat(tok, 90); }
          tag('2^' + d + ' = ' + c, 'ptr alt', 6.6, 6.6 - d * 1.5);
          say('level ' + (d + 1) + '：最多 2^(' + (d + 1) + '−1) = ' + c + ' 個', d < 3 ? '每往下一層 ×2' : '第 i 層最多 2^(i−1)');
          await beat(tok, 1800);
        }
        say('深度 k 最多幾個 node？每層加起來', 'Σ_{i=1..k} 2^(i−1) = 2^k − 1');
        await beat(tok, 3200);
        say('k = 4：1 + 2 + 4 + 8 = 15', '= 2⁴ − 1 ✓');
        await beat(tok, 3000);
        return;
      }
      say('Full binary tree：深度 k 全滿', '有 2^k − 1 個 node');
      await beat(tok, 2600);
      const bs = [];
      for (let i = 1; i <= 15; i++) { const b = cube(String(i), depthColor(hdepth(i)), NODE, HP(i).x, HP(i).y, 0, 2.5); bs.push(b); await beat(tok, 260); }
      say('一層一層、由左到右編號 1..15', '深度 4：2⁴ − 1 = 15 個，全滿');
      await beat(tok, 3000);
      bs.forEach((b) => lit(b, GOLD));
      say('深度允許的範圍內，node 數最多', '就是 Lemma 5.2 的最大值');
      await beat(tok, 2800);
      bs.forEach((b) => lit(b));
      say('Full 和 complete 不一樣', '補充：有些英文書的 full = 每個 node 0 或 2 child');
      await beat(tok, 3000);
    } };

    // ── 13/14. n0 = n2 + 1 ──
    LECT['p12-n0n2'] = { title: 'Lemma 5.3：n0 = n2 + 1', play: async (tok) => {
      const proof = PP().focus === 'proof';
      fresh(); lab.frameCamera([0, 5, 13.5], [0, 3.8, 0]);
      const opts = proof ? { cx: -3.8, width: 4.6, topY: 6.4, minY: 3.0 } : { width: 7, topY: 6.4, minY: 3.0 };
      const root = await dropTree(tok, 'A(B(D,E),C(,F))', opts, 200);
      const N = (l) => find(root, l);
      const deg = (n) => (n.left ? 1 : 0) + (n.right ? 1 : 0);
      const all = allNodes(root);
      const COL = [GREEN, RED, GOLD];
      if (!proof) {
        say('任一棵非空 binary tree（示意）', '數 degree 0、1、2 的 node 各幾個');
        await beat(tok, 2400);
        const grp = [[0, 'n0 = degree 0（leaf）', 'n0 = 3：D、E、F'], [2, 'n2 = degree 2 的 node 數', 'n2 = 2：A、B'], [1, 'n1 = degree 1 的 node 數', 'n1 = 1：C']];
        for (const [d, cap, f] of grp) {
          all.filter((n) => deg(n) === d).forEach((n) => { glow(n, COL[d]); tag('deg ' + d, 'idx', n.pos.x + 0.75, n.pos.y - 0.3); });
          say(cap, f);
          await beat(tok, 2600);
        }
        say('性質：n0 = n2 + 1', '<span class="ok">3 = 2 + 1</span>，跟 n1 無關');
        await beat(tok, 3000);
        all.forEach((n) => [n.left, n.right].forEach((c) => c && hiEdge(n, c)));
        say('證明要用的符號：n、B', 'n = 6 個 node，B = branch（pointer）= 5');
        await beat(tok, 3000);
        return;
      }
      const cd = code(['(1) n = n0 + n1 + n2', '(2) B = n − 1   → n = B + 1', '(3) B = n1 + 2·n2', '(4) n = n1 + 2·n2 + 1', '(5) n0+n1+n2 = n1+2·n2+1', '(6) n0 = n2 + 1'], 3.4, 6.6, 0.8);
      cd.ls.forEach((l) => hide(l, false));
      const show = (i) => { hide(cd.ls[i], true); cd.hl(i); };
      show(0); all.forEach((n) => glow(n, COL[deg(n)]));
      say('總 node 數 = 三種 degree 加起來', 'n = 3 + 1 + 2 = 6');
      await beat(tok, 3000);
      all.forEach((n) => glow(n));
      show(1);
      say('除了 root，每個 node 被一個 branch 指到', 'B = n − 1');
      let b = 0;
      for (const n of all) for (const c of [n.left, n.right]) if (c) { hiEdge(n, c); glow(c, GREEN); b++; await beat(tok, 450); }
      say('B = ' + b + ' = 6 − 1', '所以 n = B + 1');
      await beat(tok, 2200);
      all.forEach((n) => glow(n));
      show(2);
      all.filter((n) => deg(n)).forEach((n) => { glow(n, COL[deg(n)]); tag('×' + deg(n), 'ptr alt', n.pos.x + 0.75, n.pos.y); });
      say('從指出去的角度數 branch', 'B = 1·n1 + 2·n2 = 1 + 4 = 5');
      await beat(tok, 3000);
      show(3);
      say('把 (3) 代入 (2)', 'n = n1 + 2n2 + 1');
      await beat(tok, 2400);
      show(4);
      say('再用 (1) 代換 n', 'n0 + n1 + n2 = n1 + 2n2 + 1');
      await beat(tok, 2400);
      show(5);
      say('兩邊消去 n1、n2', '<span class="ok">n0 = n2 + 1</span>');
      await beat(tok, 3000);
    } };

    // ── 17. Complete binary tree 與層序編號 ──
    LECT['p12-complete'] = { title: 'Complete binary tree：佔滿編號 1..n', play: async (tok) => {
      fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 4.1, 0]);
      const gs = slots(15, HP, true);
      for (let d = 0; d < 4; d++) tag('level ' + (d + 1), 'idx', -6.7, 6.6 - d * 1.5);
      say('對照深度 4 的 full tree（15 格）', '編號：由上到下、由左到右');
      await beat(tok, 2400);
      const bs = {};
      'ABCDEFGHI'.split('').forEach((c, k) => { bs[c] = cube(c, depthColor(hdepth(k + 1)), NODE, HP(k + 1).x, HP(k + 1).y, 0, 2.5); });
      for (let k = 0; k < 9; k++) {
        const c = 'ABCDEFGHI'[k];
        lit(bs[c], GOLD);
        say(c + ' 的編號 = ' + (k + 1), '一層一層、從左到右');
        await beat(tok, 420);
        lit(bs[c]);
      }
      const hole = [];
      for (let i = 10; i <= 15; i++) hole.push(ghost(SAND, HP(i).x, HP(i).y, 0.9, 0.7, 0, 0.9));
      say('9 個 node：佔編號 1..9，10..15 空著', '其他位置都跟 full 一樣 → complete');
      await beat(tok, 3000);
      say('編號是為了用 array 表示', '位置可以直接算出來');
      await beat(tok, 2400);
      hole.forEach(kill);
      say('思考題：H、I 移到 G 底下呢？', '考試可能考');
      lab.springTo(bs.H, HP(14)); lab.springTo(bs.I, HP(15));
      await beat(tok, 2200);
      for (let i = 8; i <= 13; i++) hole.push(ghost('#e06666', HP(i).x, HP(i).y, 0.9, 0.7, 0, 0.9));
      gs.forEach((g, i) => { if (i + 1 >= 8 && i + 1 <= 13) g.material.color.set('#e06666'); });
      say('H、I 佔 14、15，8–13 是空的', '<span class="no">不是 complete</span>（老師沒公布答案，補充）');
      await beat(tok, 3400);
    } };

    // ── 18/19. Array 表示法 ──
    LECT['p12-array'] = { title: 'Array 表示法：2i、2i+1、⌊i/2⌋', play: async (tok) => {
      const skew = PP().focus === 'skew';
      fresh(); lab.frameCamera([0, 5.2, 13.5], [0, 3.5, 1]);
      if (!skew) {
        const TP = (i) => heapPos(i, 7.0, 1.3, 9);
        const XP = (i) => -4.6 + i * 1.0;
        const tiles = [];
        for (let i = 0; i <= 9; i++) {
          const t = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.9), new THREE.MeshStandardMaterial({ color: i ? '#e9dcc4' : '#cbbd9f' }));
          t.position.set(XP(i), 0.04, 2.8); lab.world.add(t); tiles.push(t);
          tag(i ? '[' + i + ']' : '[0] 不用', 'idx', XP(i), 0, 3.6);
        }
        const L = 'ABCDEFGHI';
        const nb = [];
        for (let i = 1; i <= 9; i++) { nb[i] = idxCube(L[i - 1], i, depthColor(hdepth(i)), TP(i)); }
        edgeLines(() => { const out = []; for (let i = 1; i <= 9; i++) for (const c of [2 * i, 2 * i + 1]) if (c <= 9) out.push([nb[i].obj.position, nb[c].obj.position]); return out; });
        say('Array 也能表示 binary tree', '每個 node 有固定該放的位置');
        await beat(tok, 2400);
        const cells = [];
        for (let i = 1; i <= 9; i++) {
          const c = lab.addBody(block(L[i - 1], [0.6, 0.45, 0.6], depthColor(hdepth(i))));
          c.obj.position.copy(TP(i)); lab.springTo(c, V(XP(i), 0.32, 2.8)); cells[i] = c;
          say(i === 1 ? 'A 放在 array 的位置 1' : '照編號放進 index ' + i, '從上到下、從左到右 → index');
          await beat(tok, i === 1 ? 1200 : 320);
        }
        await beat(tok, 900);
        const tmp = [];
        const clr = () => { tmp.splice(0).forEach(kill); cells.forEach((c) => c && lit(c)); nb.forEach((b) => b && lit(b)); };
        const mark = (i, t, col) => { lit(cells[i], col); lit(nb[i], col); tmp.push(tag(t, col === GOLD ? 'ptr alt' : 'ptr', XP(i), 1.15, 2.8)); };
        for (const i of [1, 2]) {
          mark(i, 'i=' + i, GOLD); mark(2 * i, 'left', GREEN); mark(2 * i + 1, 'right', GREEN);
          say('位置 i：left = 2i、right = 2i+1', L[i - 1] + '(' + i + ')：left ' + L[2 * i - 1] + ' = ' + 2 * i + '，right ' + L[2 * i] + ' = ' + (2 * i + 1));
          await beat(tok, 3000);
          clr();
        }
        for (const i of [4, 5]) {
          mark(i, 'i=' + i, GOLD); mark(2, 'parent', GREEN);
          tmp.push(arrow(V(XP(i), 1.5, 2.8), V(XP(2) + 0.2, 1.5, 2.8), '#c08a1f'));
          say('parent 在 ⌊i/2⌋', i === 4 ? 'D(4)：4/2 = 2 → B' : 'E(5)：⌊5/2⌋ = ⌊2.5⌋ = 2 → B');
          await beat(tok, 2800);
          clr();
        }
        mark(1, 'root', GOLD);
        say('i = 1 是 root，沒有 parent', '1-based：[0] 不用（0-based 公式不同）');
        await beat(tok, 3000);
        return;
      }
      // 左歪斜 A(B(C(D(E))))：A→1, B→2, C→4, D→8, E→16
      const XP = (i) => -6.6 + i * 0.42;
      const tiles = [];
      for (let i = 1; i <= 31; i++) {
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.8), new THREE.MeshStandardMaterial({ color: '#e9dcc4' }));
        t.position.set(XP(i), 0.04, 2.8); lab.world.add(t); tiles.push(t);
        if ([1, 2, 4, 8, 16, 31].includes(i)) tag(String(i), 'idx', XP(i), 0, 3.5);
      }
      const idx = [1, 2, 4, 8, 16];
      const TP = (d) => V(-0.6 - d * 1.1, 7.0 - d * 1.2, 0);
      const nb = 'ABCDE'.split('').map((c, d) => idxCube(c, idx[d], depthColor(d), TP(d)));
      edgeLines(() => nb.slice(1).map((b, d) => [nb[d].obj.position, b.obj.position]));
      say('Skewed tree A、B、C、D、E 放進 array', '一樣用 left = 2i');
      await beat(tok, 2400);
      const capF = ['A 仍在位置 1', 'B 是 A 的 left：2×1 = 2', 'C 是 B 的 left：2×2 = 4', 'D 是 C 的 left：2×4 = 8', 'E 是 D 的 left：2×8 = 16'];
      for (let d = 0; d < 5; d++) {
        const c = lab.addBody(block('ABCDE'[d], [0.36, 0.4, 0.5], depthColor(d)));
        c.obj.position.copy(TP(d)); lab.springTo(c, V(XP(idx[d]), 0.3, 2.8));
        lit(nb[d], GOLD);
        say(capF[d], 'index = ' + idx[d]);
        await beat(tok, 1500);
        lit(nb[d]);
      }
      tiles.forEach((t, k) => { if (!idx.includes(k + 1)) t.material.color.set('#f4b8a8'); });
      say('深度 5 要 31 格，只用到 5 格', '<span class="no">26 格空著沒用</span>');
      await beat(tok, 3000);
      say('優點：找 parent／child 只要算術', '⌊i/2⌋、2i、2i+1，一步到位');
      await beat(tok, 2600);
      say('缺點：不夠 complete 就浪費空間', '深度 k 的 skewed tree 要 2^k − 1 格');
      await beat(tok, 3000);
    } };

    // ── 20. Linked 表示：找 parent 難 ──
    LECT['p12-linked-parent'] = { title: 'Linked 表示：找 child 易、找 parent 難', play: async (tok) => {
      fresh(); lab.frameCamera([0, 5, 13.5], [0, 3.6, 0.5]);
      const root = await dropTree(tok, CT, { topY: 6.4, minY: 2.2, width: 9 }, 150);
      const N = (l) => find(root, l);
      tag('node = [ leftChild | data | rightChild ]', 'ptr', 0, 7.6);
      say('問：D 的 parent 是誰？', 'linked node 只有往下的 pointer');
      await beat(tok, 2600);
      const cur = makeCursor(), prev = makeCursor();
      prev.obj.material = new THREE.MeshBasicMaterial({ color: BLU }); prev.obj.scale.set(1.25, 1.25, 1.25);
      const tc = tag('cur', 'ptr alt', 0, 0), tp = tag('prev', 'ptr', 0, 0);
      const path = ['A', 'B', 'D'].map(N);
      for (let i = 0; i < 3; i++) {
        cursorTo(cur, path[i].pos); tc.position.copy(path[i].pos).add(V(-1.0, 0.1, 0));
        if (i) { cursorTo(prev, path[i - 1].pos); tp.position.copy(path[i - 1].pos).add(V(1.1, 0.1, 0)); }
        say(i ? 'cur 往下走，prev 跟在上一層' : '從 root 往下找 D', 'cur = ' + path[i].label + '，prev = ' + (i ? path[i - 1].label : 'null'));
        await beat(tok, 1600);
      }
      glow(N('B'), GOLD);
      say('找到 D 時，prev 就是 parent', 'parent(D) = B');
      await beat(tok, 2800);
      const D = N('D');
      ['H', 'I'].forEach((l) => { glow(N(l), GREEN); hiEdge(D, N(l)); });
      say('問 child 很簡單：直接看左右 pointer', 'D.leftChild = H，D.rightChild = I');
      await beat(tok, 2800);
      say('Linked 中，找 parent 比找 child 難', '補充：常要找 parent 就多一個 parent 欄位');
      await beat(tok, 2800);
      fresh(); lab.frameCamera([0, 5, 13.5], [0, 3.6, 0.5]);
      tag('full binary tree', 'ptr', -3.4, 7.4); tag('skewed binary tree', 'ptr', 3.4, 7.4);
      await dropTree(tok, 'A(B(D,E),C(F,G))', { cx: -3.4, width: 5, topY: 6.4, minY: 3.4 }, 120);
      await dropTree(tok, 'A(,B(,C(,D)))', { cx: 3.4, width: 4, topY: 6.4, minY: 2.4 }, 200);
      say('skewed 用 linked 表示就像 linked list', '每個 node 只用到一個 pointer');
      await beat(tok, 3200);
    } };

    // ── 22. TreeNode 類別、array vs linked 比較表 ──
    LECT['p12-class-table'] = { title: 'TreeNode 類別；array vs linked 比較', play: async (tok) => {
      fresh(); lab.frameCamera([0, 5, 13.5], [0, 4, 0]);
      const tr = cube('Tree：root', GRN, [2.4, 0.7, 0.9], -4.4, 6.2, 0, 2.5);
      tag('class Tree { private: TreeNode *root; }', 'ptr', -2.6, 7.4);
      const f = [['leftChild', -0.2], ['data', 1.6], ['rightChild', 3.4]].map(([t, x]) => cube(t, t === 'data' ? GRN : BLU, [1.75, 0.7, 0.9], x, 6.2, 0, 2.5));
      arrow(V(-3.2, 6.2, 0), V(-1.1, 6.2, 0), '#c08a1f');
      tag('TreeNode', 'ptr alt', 1.6, 7.0);
      say('TreeNode：leftChild、data、rightChild', 'class Tree 只有一個 pointer：root');
      await beat(tok, 3000);
      const k1 = cube('TreeNode', BLU, [1.6, 0.6, 0.8], -1.4, 4.2, 0, 2), k2 = cube('TreeNode', BLU, [1.6, 0.6, 0.8], 4.6, 4.2, 0, 2);
      const a1 = arrow(V(-0.2, 5.85, 0), V(-1.2, 4.55, 0), BLU), a2 = arrow(V(3.4, 5.85, 0), V(4.4, 4.55, 0), BLU);
      say('從 root 開始 traverse', '每個 node 再指向左右 child');
      await beat(tok, 2600);
      [tr, ...f, k1, k2].forEach(flyB); [a1, a2].forEach(kill);
      await beat(tok, 700);
      fresh(); lab.frameCamera([0, 5, 13.5], [0, 4, 0]);
      tag('Array', 'ptr alt', 0.4, 7.3); tag('Linked', 'ptr alt', 4.2, 7.3);
      const rows = [
        ['決定 parent／child', ['index 算：易', GRN], ['parent 難', '#e06666'], '決定 parent：array 簡單，link 不簡單', 'array 算 ⌊i/2⌋；link 要從 root 找'],
        ['space overhead', ['整個先宣告', '#e06666'], ['用多少開多少', GRN], 'Space：array 要宣告整個 array', 'link：用多少 node 就 create 多少'],
        ['insert／delete', ['要搬資料：難', '#e06666'], ['改 pointer：易', GRN], 'Array insert/delete 要搬資料', 'link 只要 pointer assignment'],
      ];
      for (let k = 0; k < rows.length; k++) {
        const [nm, a, b, cap, fm] = rows[k], y = 6.0 - k * 1.3;
        tag(nm, 'ptr', -4.4, y);
        cube(a[0], a[1], [3.2, 0.7, 0.8], 0.4, y, 0, 2.5); cube(b[0], b[1], [3.2, 0.7, 0.8], 4.2, y, 0, 2.5);
        say(cap, fm);
        await beat(tok, 2800);
      }
      // array 插入示意：後面整串往後搬
      const xs = (i) => -2.4 + i * 0.95;
      const arr = 'ABCDE'.split('').map((c, i) => cube(c, SAND, [0.8, 0.5, 0.8], xs(i), 0.3, 2.2));
      tag('array（示意）', 'idx', -4.2, 0.3, 2.2);
      say('在 C 的位置插入 X（示意）', '後面整串都要搬一格');
      await beat(tok, 1400);
      for (let i = 4; i >= 2; i--) { lab.springTo(arr[i], V(xs(i + 1), 0.3, 2.2)); await beat(tok, 380); }
      cube('X', '#f2c46d', [0.8, 0.5, 0.8], xs(2), 0.3, 2.2, 2.5);
      await beat(tok, 1600);
      say('沒有絕對的好壞', '建好不再改 → array；常 insert/delete → linked');
      await beat(tok, 3200);
    } };

    // ── 23/32. 為什麼要 traversal；Equal／Copy ──
    function rowOf(labels, cx, z, y = 0.3) {
      return labels.map((c, k) => cube(c, SAND, SMALL, cx - (labels.length - 1) * 0.4 + k * 0.8, y, z, 2));
    }
    LECT['p12-trav'] = { title: '為什麼需要 traversal：判斷相同、複製', play: async (tok) => {
      const apps = PP().focus === 'apps';
      fresh(); lab.frameCamera([0, 5, 13.5], [0, 3.6, 0.8]);
      const O1 = { cx: -3.4, width: 4, topY: 6.4, minY: 3.4 }, O2 = { cx: 3.4, width: 4, topY: 6.4, minY: 3.4 };
      tag('T1', 'ptr alt', -6.0, 6.4); tag('T2', 'ptr alt', 0.8, 6.4);
      if (!apps) {
        const t1 = await dropTree(tok, 'A(B(D),C)', O1, 180), t2 = await dropTree(tok, 'A(B(,D),C)', O2, 180);
        say('Traversal：拜訪每個 node（順便印出）', '問題：T1、T2 一樣嗎？（示意）');
        await beat(tok, 2800);
        const c1 = makeCursor(), c2 = makeCursor();
        for (const l of ['A', 'B']) {
          cursorTo(c1, find(t1, l).pos); cursorTo(c2, find(t2, l).pos);
          glow(find(t1, l), GREEN); glow(find(t2, l), GREEN);
          say('方法一：兩個 pointer 同步往下比', l + ' = ' + l + ' ✓');
          await beat(tok, 1400);
        }
        const B1 = find(t1, 'B'), B2 = find(t2, 'B');
        cursorTo(c1, B1.left.pos); cursorTo(c2, B2.pos.clone().add(V(-0.6, -1.2, 0)));
        glow(B1.left, RED); ghost('#e06666', B2.pos.x - 0.6, B2.pos.y - 1.2, 0.7, 0.6, 0, 0.7);
        say('B 的 left：D vs null', '<span class="no">不一樣</span> → 人眼一看就知道，電腦要一步步比');
        await beat(tok, 3000);
        c1.obj.visible = false; c2.obj.visible = false;
        rowLabel('pre', 2.0); rowLabel('in', 3.2);
        rowOf(['A', 'B', 'D', 'C'], -3.4, 2.0); rowOf(['A', 'B', 'D', 'C'], 3.4, 2.0);
        say('方法二：traverse 成字串再比', 'preorder 都是 ABDC！');
        await beat(tok, 3000);
        const i1 = rowOf(['D', 'B', 'A', 'C'], -3.4, 3.2), i2 = rowOf(['B', 'D', 'A', 'C'], 3.4, 3.2);
        [0, 1].forEach((k) => { lit(i1[k], RED); lit(i2[k], RED); });
        say('只比一種 traversal 不夠（補充）', 'inorder：DBAC ≠ BDAC → 要兩種，或記下 null');
        await beat(tok, 3200);
        say('Traversal 的目的：掌握 tree 的 structure', '不只是為了考試');
        await beat(tok, 2600);
        return;
      }
      const src = 'A(B(D,E),C(,F))';
      const t1 = await dropTree(tok, src, O1, 150);
      const t2 = makeTree(src); layoutTree(t2, Object.assign({}, TREE_O, O2));
      edgeLines(() => treePairs(t2));
      say('Copy(T1)：traverse T1，邊走邊建 T2', '用 preorder：先建自己，再左、再右（示意）');
      await beat(tok, 2400);
      const c1 = makeCursor();
      const p1 = preorder(t1), p2 = preorder(t2);
      for (let k = 0; k < p1.length; k++) {
        cursorTo(c1, p1[k].pos);
        const b = nodeBody(p2[k]); b.obj.position.copy(p2[k].pos).add(V(0, 3, 0)); lab.dropTo(b, p2[k].pos.clone());
        say('拜訪 ' + p1[k].label + ' → 在 T2 建一個 ' + p1[k].label, 'Copy：' + p1.slice(0, k + 1).map((n) => n.label).join(' '));
        await beat(tok, 950);
      }
      await beat(tok, 800);
      const c2 = makeCursor();
      for (let k = 0; k < p1.length; k++) {
        cursorTo(c1, p1[k].pos); cursorTo(c2, p2[k].pos);
        glow(p1[k], GREEN); glow(p2[k], GREEN);
        say('Equal(T1, T2)：同時 traverse 逐一比', p1[k].label + ' = ' + p2[k].label + ' ✓（左右結構也要一樣）');
        await beat(tok, 750);
      }
      say('全部相同 → Equal 回傳 true', 'Equal、Copy 都是 traversal 的應用（下次細講）');
      await beat(tok, 3000);
    } };

    // ── 24. L、V、R ──
    LECT['p12-lvr'] = { title: 'L、V、R 三個動作 → 三種 traversal', play: async (tok) => {
      fresh(); lab.frameCamera([0, 5, 13.5], [0, 3.8, 0.6]);
      const l = cube('left', BLU, [1.5, 0.8, 0.9], -1.7, 6.4, 0, 2.5), d = cube('data', GRN, [1.5, 0.8, 0.9], 0, 6.4, 0, 2.5), r = cube('right', PUR, [1.5, 0.8, 0.9], 1.7, 6.4, 0, 2.5);
      say('node 只有 left、data、right', '對應三個動作');
      await beat(tok, 2400);
      lit(l, GOLD); arrow(V(-2.2, 6.0, 0), V(-3.8, 4.9, 0), BLU); tag('L：先往左走', 'ptr', -4.6, 4.6);
      say('L：看到 node 先不印，往左走', 'L = go left');
      await beat(tok, 2200); lit(l);
      lit(d, GOLD); tag('V：印出 data', 'ptr alt', 0, 7.3);
      say('V：visit，把資料印出來', 'V = visit / print');
      await beat(tok, 2200); lit(d);
      lit(r, GOLD); arrow(V(2.2, 6.0, 0), V(3.8, 4.9, 0), PUR); tag('R：往右走', 'ptr', 4.6, 4.6);
      say('R：往右邊走', 'R = go right');
      await beat(tok, 2200); lit(r);
      const perms = ['LVR', 'LRV', 'VLR', 'VRL', 'RVL', 'RLV'];
      const C = { L: BLU, V: GRN, R: PUR };
      const rows = perms.map((p, k) => {
        const cx = k < 3 ? -2.8 : 2.8, y = 3.4 - (k % 3) * 1.0;
        return p.split('').map((ch, j) => cube(ch, C[ch], [0.6, 0.5, 0.6], cx - 0.7 + j * 0.7, y, 1.2, 2.5));
      });
      say('三個動作有 3! = 6 種排列', 'LVR LRV VLR VRL RVL RLV');
      await beat(tok, 2800);
      rows.slice(3).forEach((row) => row.forEach((b) => lit(b, RED)));
      say('R 在 L 前面的三種只是左右對稱', '只保留「先左後右」');
      await beat(tok, 2600);
      rows.slice(3).forEach((row) => row.forEach(flyB));
      await beat(tok, 600);
      const nm = [['inorder', 'LVR = inorder'], ['postorder', 'LRV = postorder'], ['preorder', 'VLR = preorder']];
      for (let k = 0; k < 3; k++) {
        rows[k].forEach((b) => lit(b, GOLD));
        tag(nm[k][0], 'ptr alt', 0.6, 3.4 - k * 1.0, 1.2);
        say(nm[k][1], 'V 的位置決定 pre／in／post');
        await beat(tok, 1600);
        rows[k].forEach((b) => lit(b));
      }
      await beat(tok, 2000);
    } };

    // ── 25. 運算式樹的四種輸出 ──
    LECT['p12-expr4'] = { title: '運算式樹 A/B*C*D+E：四種 traversal', play: async (tok) => {
      fresh(); lab.frameCamera([0, 5.4, 13.5], [0, 3.2, 1.2]);
      const root = await dropTree(tok, 'expr', { topY: 6.8, minY: 3.4 }, 120);
      for (const n of allNodes(root)) if (!n.left && !n.right) [-0.38, 0.38].forEach((dx) => cube('', BLU, [0.22, 0.22, 0.22], n.pos.x + dx, n.pos.y - 0.6, 0));
      say('A/B*C*D+E 的 expression tree', 'leaf 底下藍色的是 null 指標');
      await beat(tok, 2800);
      const cur = makeCursor();
      const ords = [
        ['in', 'Inorder（LVR）→ infix', 'infix', inorder(root)],
        ['pre', 'Preorder（VLR）→ prefix', 'prefix', preorder(root)],
        ['post', 'Postorder（LRV）→ postfix', 'postfix', postorder(root)],
        ['level', 'Level order：一層一層', 'level', levelorder(root)],
      ];
      for (let k = 0; k < 4; k++) {
        // the four rows are stacked as shelves (y), not in depth: seen from the front, depth rows print over each other
        const [nm, cap, tg, seq] = ords[k], z = 1.8, y = 0.3 + (3 - k) * 0.7;
        rowLabel(nm, z).position.y = y + 0.05;
        say(cap, '…');
        for (let i = 0; i < seq.length; i++) {
          const n = seq[i];
          cursorTo(cur, n.pos);
          const b = lab.addBody(block(n.label, SMALL, depthColor(n.depth)));
          b.obj.position.copy(n.pos); lab.springTo(b, V(ROW_X0 + i * ROW_DX, y, z));
          say(cap, seq.slice(0, i + 1).map((x) => x.label).join(''));
          await beat(tok, 260);
        }
        tag(tg, 'ptr alt', 2.0, y + 0.05, z);
        await beat(tok, 1300);
      }
      cur.obj.visible = false;
      say('同一棵樹，四種輸出', 'A/B*C*D+E｜+**/ABCDE｜AB/C*D*E+｜+*E*D/CAB');
      await beat(tok, 3200);
    } };

    // ── 26/28/29. 遞迴 Inorder／Preorder／Postorder 程式 ──
    LECT['p12-rec-code'] = { title: '遞迴 traversal 程式：三行換順序', play: async (tok) => {
      const kind = ['pre', 'post'].includes(PP().kind) ? PP().kind : 'in';
      const nm = { in: 'Inorder', pre: 'Preorder', post: 'Postorder' }[kind];
      const ORD = { in: ['L', 'V', 'R'], pre: ['V', 'L', 'R'], post: ['L', 'R', 'V'] }[kind];
      const TXT = { L: '    ' + nm + '(cur->leftChild);   // L', V: '    cout << cur->data;   // V', R: '    ' + nm + '(cur->rightChild);  // R' };
      fresh(); lab.frameCamera([0, 5.2, 13.5], [0, 3.6, 1]);
      const cd = code(['void Tree::' + nm + '() { ' + nm + '(root); }', 'void Tree::' + nm + '(TreeNode *cur) {', '  if (cur) {', ...ORD.map((a) => TXT[a]), '  }', '}'], -3.4, 7.2, 0.5);
      const root = showTree('expr', { cx: 3.6, width: 6.2, topY: 6.6, minY: 2.8, maxSp: 0.85 });
      rowLabel('輸出', 2.6);
      const cur = makeCursor();
      const out = [];
      cd.hl(0);
      say(kind === 'in' ? '把 tree 的 root 傳進 Inorder' : nm + '：copy Inorder，改名、換三行順序', ORD.join(' ') + (kind === 'pre' ? '：先印，再左、再右' : kind === 'post' ? '：最後才印' : '：三行分別是 L、V、R'));
      await beat(tok, 2800);
      if (kind === 'in') { cd.hl(2); say('if (cur)：遞迴的終止條件', 'cur 是 null 就直接 return'); await beat(tok, 2400); }
      async function call(n, from, side) {
        if (!n) {
          const p = from.clone().add(V(side * 0.4, -0.8, 0));
          const g = ghost('#e06666', p.x, p.y, 0.4, 0.35, 0, 0.4);
          cd.hl(2); say('null → if 不成立，return', '輸出：' + (out.join(' ') || '—'));
          await beat(tok, 330); kill(g); return;
        }
        cursorTo(cur, n.pos); cd.hl(2);
        say('呼叫 ' + nm + '(' + n.label + ')', '輸出：' + (out.join(' ') || '—'));
        await beat(tok, 330);
        for (let j = 0; j < 3; j++) {
          const a = ORD[j];
          cd.hl(3 + j);
          if (a === 'V') {
            out.push(n.label); glow(n, GOLD);
            const b = lab.addBody(block(n.label, SMALL, depthColor(n.depth)));
            b.obj.position.copy(n.pos); lab.springTo(b, rowPos(out.length - 1, 2.6));
            say('V：印出 ' + n.label, '輸出：' + out.join(' '));
            await beat(tok, 620);
          } else {
            await beat(tok, 180);
            await call(a === 'L' ? n.left : n.right, n.pos, a === 'L' ? -1 : 1);
            cursorTo(cur, n.pos); cd.hl(3 + j);
          }
        }
      }
      await call(root, root.pos, 0);
      cd.hl(-1); cur.obj.visible = false;
      say(nm + ' 完成', '<span class="ok">' + out.join('') + '</span>');
      await beat(tok, 3000);
    } };

    // ── 30. 非遞迴 inorder（stack） ──
    LECT['p12-iter-inorder'] = { title: '非遞迴 Inorder：用 stack', play: async (tok) => {
      fresh(); lab.frameCamera([0, 5.2, 13.5], [0, 3.6, 1]);
      const cd = code(['void Tree::NonrecInorder() {', '  Stack<TreeNode*> s; cur = root;', '  while (1) {', '    while (cur) { s.Push(cur);', '      cur = cur->leftChild; }', '    if (s.IsEmpty()) return;', '    cur = s.Top(); s.Pop();', '    cout << cur->data;', '    cur = cur->rightChild;', '  }', '}'], -3.5, 7.4, 0.45);
      const root = showTree('expr', { cx: 3.6, width: 6.2, topY: 6.6, minY: 2.8, maxSp: 0.85 });
      rowLabel('stack', 2.2); rowLabel('輸出', 3.4);
      tag('底 → 頂', 'idx', -5.6, 0.95, 2.2);
      const c = makeCursor();
      const st = [], out = [];
      let cur = root;
      cd.hl(1);
      say('不用遞迴：改用 stack（LIFO）', '一開始 cur = root');
      await beat(tok, 2600);
      for (;;) {
        while (cur) {
          cd.hl(3); cursorTo(c, cur.pos);
          const b = lab.addBody(block(cur.label, SMALL, depthColor(cur.depth)));
          b.obj.position.copy(cur.pos); lab.springTo(b, rowPos(st.length, 2.2));
          st.push({ n: cur, b });
          say('push ' + cur.label + '，往 leftChild 走', 'stack：' + st.map((e) => e.n.label).join(' '));
          await beat(tok, 650);
          cd.hl(4);
          if (!cur.left) { say(cur.label + ' 的 leftChild 是 null', '跳出內層 while'); await beat(tok, 450); }
          cur = cur.left;
        }
        cd.hl(5);
        if (!st.length) { say('stack 空了 → return', '輸出：' + out.join(' ')); await beat(tok, 1200); break; }
        await beat(tok, 200);
        const { n, b } = st.pop();
        cd.hl(6); cursorTo(c, n.pos);
        lab.springTo(b, rowPos(out.length, 3.4));
        out.push(n.label); glow(n, GOLD);
        cd.hl(7);
        say('pop ' + n.label + ' 並印出', '輸出：' + out.join(' '));
        await beat(tok, 750);
        cd.hl(8);
        cur = n.right;
        say('cur = ' + n.label + '.rightChild', cur ? '= ' + cur.label + '，回外層迴圈' : '= null，下一輪直接 pop');
        await beat(tok, 450);
      }
      cd.hl(-1); c.obj.visible = false;
      say('非遞迴 inorder 完成', '<span class="ok">' + out.join('') + '</span>；思考：pre／post 怎麼寫？');
      await beat(tok, 3000);
    } };
  }

  // ─── UO0B1SQOAgk：交大彭文志 Lec13 Trees 2/6（走訪程式、stack／queue 走訪、copy、equal、SAT） ───
  {
    const padL = (lines) => { const w = Math.max(...lines.map((s) => s.length)); return lines.map((s) => s.padEnd(w, ' ')); };
    const OUT_SZ = [0.5, 0.42, 0.5];
    // 從節點位置飛出一顆小方塊到 pos（輸出列、stack、queue 用）
    function emit(n, pos, size = OUT_SZ) {
      const b = lab.addBody(block(n.label, size, depthColor(n.depth || 0)));
      b.obj.position.copy(n.pos); lab.springTo(b, pos.clone()); return b;
    }
    const allOff = (root) => levelorder(root).forEach((n) => glow(n, OFF));

    // 1) 三種走訪的遞迴程式碼：只差 cout 那一行的位置
    const TCODE = {
      in: ['void Inorder(TreeNode* cur) {', '  if (cur) {', '    Inorder(cur->leftChild);   // L', '    cout << cur->data;         // V', '    Inorder(cur->rightChild);  // R', '  }', '}'],
      pre: ['void Preorder(TreeNode* cur) {', '  if (cur) {', '    cout << cur->data;         // V', '    Preorder(cur->leftChild);  // L', '    Preorder(cur->rightChild); // R', '  }', '}'],
      post: ['void Postorder(TreeNode* cur) {', '  if (cur) {', '    Postorder(cur->leftChild);  // L', '    Postorder(cur->rightChild); // R', '    cout << cur->data;          // V', '  }', '}'],
    };
    LECT['p13-trav-code'] = { title: '三種走訪的遞迴程式碼', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.8, 13.5], [0, 3.9, 0]);
      const cls = code(['class Tree {', '  TreeNode* root;', '};'], -3.8, 7.6, 0.45);
      cls.hl(1);
      say('recursive code 幾行就搞定', 'class Tree 只有一個 data member：root');
      await beat(tok, 2600);
      cls.hl(-1);
      const w = Math.max(...Object.values(TCODE).flat().map((s) => s.length));
      const cd = code(TCODE.in.map((s) => s.padEnd(w, ' ')), -3.8, 5.8, 0.5);
      const root = showTree('expr', { cx: 3.7, width: 5.6, topY: 6.6, minY: 2.6, maxSp: 0.7 });
      tag('輸出', 'ptr', 0.5, 0.35, 2.2);
      const cur = makeCursor();
      let outs = [];
      const NAME = { in: 'Inorder', pre: 'Preorder', post: 'Postorder' };
      const ORD = { in: inorder, pre: preorder, post: postorder };
      const RULE = { in: 'L V R', pre: 'V L R', post: 'L R V' };
      for (const k of ['in', 'pre', 'post']) {
        outs.forEach((b) => lab.flyAway(b, V(0, 8, 4))); outs = [];
        allOff(root);
        TCODE[k].forEach((s, i) => setTag(cd.ls[i], s.padEnd(w, ' ')));
        const vLine = TCODE[k].findIndex((s) => s.includes('cout'));
        if (k === 'in') {
          say('Inorder：cur 不為空才做', 'L → V → R');
          for (const i of [1, 2, 3, 4]) { cd.hl(i); await beat(tok, 650); }
        } else {
          cd.hl(vLine);
          say('改成 ' + NAME[k] + '：只搬動 cout 那行', RULE[k] + '（cout 在第 ' + (vLine - 1) + ' 行）');
          await beat(tok, 2300);
        }
        cd.hl(vLine);
        const order = ORD[k](root);
        for (let i = 0; i < order.length; i++) {
          const n = order[i];
          cursorTo(cur, n.pos); glow(n, GOLD);
          outs.push(emit(n, V(1.2 + i * 0.6, 0.35, 2.2)));
          await beat(tok, 420);
        }
        say(NAME[k] + ' 的輸出', '<span class="ok">' + str(order) + '</span>');
        await beat(tok, 1700);
      }
      cd.hl(-1);
      say('三個版本只差 cout 的位置', 'pre：V L R ｜ in：L V R ｜ post：L R V');
      await beat(tok, 3000);
    } };

    // 2) 非遞迴 inorder：自己用 stack
    LECT['p13-iter-inorder'] = { title: '非遞迴 Inorder：用 Stack', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.8, 13.5], [0, 3.6, 0.6]);
      const root = showTree('expr', { cx: -1.6, width: 7.4, topY: 6.8, minY: 2.6, maxSp: 0.92 });
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 1.0), new THREE.MeshStandardMaterial({ color: '#7a6a52' }));
      base.position.set(5.4, 0.04, 0); lab.world.add(base);
      tag('Stack', 'ptr', 5.4, 6.4);
      tag('輸出', 'ptr', -6.3, 0.35, 2.4);
      const cur = makeCursor();
      const steps = []; const st = []; let c = root;
      for (;;) {
        while (c) { steps.push({ op: 'push', n: c }); st.push(c); c = c.left; }
        if (!st.length) break;
        const n = st.pop(); steps.push({ op: 'pop', n }); c = n.right; steps.push({ op: 'right', n, to: c });
      }
      say('不用遞迴：自己用一個 stack 存 node', '往左 push → 走不下去 pop 印出 → 往右');
      await beat(tok, 2800);
      const stack = []; const out = [];
      for (const s of steps) {
        if (s.op === 'push') {
          cursorTo(cur, s.n.pos);
          stack.push({ n: s.n, b: emit(s.n, V(5.4, 0.35 + stack.length * 0.5, 0), SMALL) });
          say('往左走：' + s.n.label + ' 先不印，push', 'stack（底→頂）：' + stack.map((e) => e.n.label).join(' '));
          await beat(tok, 800);
        } else if (s.op === 'pop') {
          const b = stack.pop().b;
          cursorTo(cur, s.n.pos); glow(s.n, GOLD);
          lab.springTo(b, V(-5.4 + out.length * 0.7, 0.35, 2.4));
          out.push(s.n.label);
          say('走不下去 → pop ' + s.n.label + ' 印出', '輸出：' + out.join(' '));
          await beat(tok, 1000);
        } else if (s.to) {
          cursorTo(cur, s.to.pos);
          say('往 ' + s.n.label + ' 的右子樹走：' + s.to.label, 'cur = cur->rightChild');
          await beat(tok, 600);
        } else await beat(tok, 350);
      }
      cur.obj.visible = false;
      say('stack 空且 cur 為 null → 結束', '<span class="ok">' + out.join(' ') + '</span>（與遞迴版相同）');
      await beat(tok, 3000);
    } };

    // 3) Level order：用 queue（Horowitz LevelOrder），再示範先放右孩子會怎樣
    const LCODE = ['void LevelOrder() {', '  Queue<TreeNode*> q;', '  TreeNode* cur = root;', '  while (cur) {', '    cout << cur->data;', '    if (cur->leftChild)', '      q.Push(cur->leftChild);', '    if (cur->rightChild)', '      q.Push(cur->rightChild);', '    if (q.IsEmpty()) return;', '    cur = q.Front(); q.Pop();', '  }', '}'];
    LECT['p13-level-queue'] = { title: 'Level order：用 Queue', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.8, 13.5], [0, 3.6, 0.8]);
      const w = Math.max(...LCODE.map((s) => s.length)) + 2;
      const cd = code(LCODE.map((s) => s.padEnd(w, ' ')), -4.0, 7.6, 0.47);
      const root = showTree('expr', { cx: 3.4, width: 5.8, topY: 7.0, minY: 3.4, maxSp: 0.72 });
      tag('queue', 'ptr', 0.2, 0.35, 2.0);
      tag('輸出', 'ptr', 0.2, 0.35, 3.3);
      const cur = makeCursor();
      const qPos = (i) => V(1.3 + i * 0.62, 0.35, 2.0);
      const oPos = (i) => V(1.3 + i * 0.62, 0.35, 3.3);
      async function run(rightFirst, ms) {
        const q = []; const out = [];
        let n = root, b = null;
        for (;;) {
          cursorTo(cur, n.pos); glow(n, GOLD);
          cd.hl(4);
          if (b) lab.springTo(b, oPos(out.length)); else b = emit(n, oPos(0));
          out.push({ n, b });
          q.forEach((e, i) => lab.springTo(e.b, qPos(i)));
          if (ms > 400) say('cout ' + n.label, 'queue：' + (q.map((e) => e.n.label).join(' ') || '空'));
          await beat(tok, ms);
          const kids = rightFirst ? [n.right, n.left] : [n.left, n.right];
          for (let j = 0; j < 2; j++) {
            const k = kids[j];
            const isL = (j === 0) !== rightFirst;
            cd.hl(isL ? 6 : 8);
            if (!k) continue;
            q.push({ n: k, b: emit(k, qPos(q.length)) });
            if (ms > 400) say(n.label + ' 的' + (isL ? ' left' : ' right') + ' child ' + k.label + ' 放進 queue', 'queue：' + q.map((e) => e.n.label).join(' '));
            await beat(tok, ms * 0.7);
          }
          if (!q.length) { cd.hl(9); await beat(tok, ms * 0.5); break; }
          cd.hl(10);
          const f = q.shift(); n = f.n; b = f.b;
          await beat(tok, ms * 0.5);
        }
        return out;
      }
      cd.hl(2);
      say('Level order：queue 的架構，幾行就好', 'cur 一開始 = root');
      await beat(tok, 2600);
      const o1 = await run(false, 900);
      say('先左後右 → 每層由左到右', '<span class="ok">' + o1.map((e) => e.n.label).join(' ') + '</span>');
      await beat(tok, 2600);
      o1.forEach((e) => lab.flyAway(e.b, V(0, 8, 4)));
      allOff(root);
      [['    if (cur->rightChild)', 5], ['      q.Push(cur->rightChild);', 6], ['    if (cur->leftChild)', 7], ['      q.Push(cur->leftChild);', 8]].forEach(([s, i]) => setTag(cd.ls[i], s.padEnd(w, ' ')));
      say('若先放 right child？queue 是 FIFO', '順序顛倒 → 每層變成由右到左');
      await beat(tok, 2400);
      const o2 = await run(true, 260);
      cd.hl(-1);
      say('先放右邊：level order 變由右到左', '<span class="no">' + o2.map((e) => e.n.label).join(' ') + '</span>');
      await beat(tok, 3000);
    } };

    // 4) 相似？A(B,C) vs A(C,B)；轉成 string 比較、LCS
    LECT['p13-similar'] = { title: '兩棵 tree 相似嗎？轉成 string 比較', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.6, 13], [0, 3.6, 0.6]);
      const t1 = showTree('A(B,C)', { cx: -3.6, width: 2.6, topY: 6.4, minY: 4.8, maxSp: 1.3 });
      const t2 = showTree('A(C,B)', { cx: 3.6, width: 2.6, topY: 6.4, minY: 4.8, maxSp: 1.3 });
      tag('T1', 'ptr', -3.6, 7.4); tag('T2', 'ptr', 3.6, 7.4);
      say('A(B,C) 與 A(C,B) 相似嗎？', 'root 相同，兩個孩子左右對調');
      await beat(tok, 2800);
      const g1 = ghost('#2fc092', -3.6, 5.6, 3.6, 2.4), g2 = ghost('#2fc092', 3.6, 5.6, 3.6, 2.4);
      say('只看形狀：root 下面兩個 child', '只看 structure → 長得一樣');
      await beat(tok, 2800);
      kill(g1); kill(g2);
      glow(t1.left, RED); glow(t2.left, RED);
      say('位置對位置比資料：B ≠ C', '左右也要一樣 → 不相同（看定義）');
      await beat(tok, 3000);
      glow(t1.left, OFF); glow(t2.left, OFF);
      say('快速方法：traversal 轉成 string 再比', 'preorder 與 inorder');
      tag('preorder', 'idx', 0, 0.35, 2.0); tag('inorder', 'idx', 0, 0.35, 3.2);
      const rows = {};
      for (const [k, f, z] of [['pre', preorder, 2.0], ['in', inorder, 3.2]]) {
        rows[k] = [];
        for (const [t, x0] of [[t1, -4.6], [t2, 2.6]]) {
          const seq = f(t); const bs = [];
          for (let i = 0; i < seq.length; i++) { bs.push(emit(seq[i], V(x0 + i * 0.75, 0.35, z), SMALL)); await beat(tok, 380); }
          rows[k].push(bs);
        }
        say(k === 'pre' ? 'preorder：ABC vs ACB' : 'inorder：BAC vs CAB', '字串不同 → 左右不一樣');
        await beat(tok, 1600);
      }
      // LCS(ABC, ACB) = 2：A、B 共同出現且順序相同
      [rows.pre[0][0], rows.pre[0][1], rows.pre[1][0], rows.pre[1][2]].forEach((b) => lit(b, GOLD));
      say('再用 LCS 比共同出現的字與順序', 'LCS(ABC, ACB) = AB（或 AC），長度 2');
      await beat(tok, 3200);
      say('similar 的判定依定義而不同', '課本：結構相同即 similar；資料也同才 equal');
      await beat(tok, 2800);
    } };

    // 5) Copy：V、L、R 遞迴複製；錯誤版只做 pointer assignment
    const CCODE = ['TreeNode* Copy(TreeNode* orig) {', '  if (!orig) return 0;', '  TreeNode* temp = new TreeNode;', '  temp->data = orig->data;      // V', '  temp->leftChild =', '    Copy(orig->leftChild);      // L', '  temp->rightChild =', '    Copy(orig->rightChild);     // R', '  return temp;', '}'];
    LECT['p13-copy'] = { title: '複製一棵 tree（Copy）', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.6, 13.5], [0, 4.0, 0]);
      const w = Math.max(...CCODE.map((s) => s.length)) + 6;
      const cd = code(CCODE.map((s) => s.padEnd(w, ' ')), -3.9, 7.4, 0.48);
      const SRC = 'A(B(D,E),C)';
      const src = showTree(SRC, { cx: 3.4, width: 3.6, topY: 7.2, minY: 5.0, maxSp: 0.95 });
      const dst = parseTree(SRC);
      layoutTree(dst, Object.assign({}, TREE_O, { cx: 3.4, width: 3.6, topY: 3.6, minY: 1.4, maxSp: 0.95 }));
      edgeLines(() => treePairs(dst));
      tag('原 tree（示意）', 'ptr', 0.6, 7.2);
      tag('copy', 'ptr alt', 0.6, 3.6);
      const cur = makeCursor();
      cd.hl(0);
      say('有了走訪就能 copy：傳入原 tree 的 root', '示意例：A(B(D,E),C)');
      await beat(tok, 2600);
      async function go(s, d) {
        cd.hl(1);
        if (!s) { await beat(tok, 330); return; }
        cursorTo(cur, s.pos);
        say('orig = ' + s.label + ' 不是 empty', 'if (!orig) return 0 不成立');
        await beat(tok, 450);
        cd.hl(2);
        const b = lab.addBody(block(s.label, NODE, depthColor(d.depth)));
        b.obj.position.copy(s.pos); lab.springTo(b, d.pos.clone()); d.body = b;
        say('new TreeNode，複製 data ' + s.label, 'V：temp->data = orig->data');
        await beat(tok, 950);
        cd.hl(5);
        if (s.left) { say('遞迴 Copy ' + s.label + ' 的左子樹', 'L：temp->leftChild = Copy(…)'); await beat(tok, 450); }
        await go(s.left, d.left);
        cd.hl(7);
        if (s.right) { say('遞迴 Copy ' + s.label + ' 的右子樹', 'R：temp->rightChild = Copy(…)'); await beat(tok, 450); }
        await go(s.right, d.right);
        cd.hl(8);
        await beat(tok, 250);
      }
      await go(src, dst);
      cur.obj.visible = false;
      say('左右子樹都遞迴複製 → 完整的一份', '<span class="ok">copy 完成：5 個新 node</span>');
      await beat(tok, 2400);
      // 錯誤寫法：只有 pointer assignment
      for (const n of [dst.left.left, dst.left.right, dst.left, dst.right]) { lab.flyAway(n.body, V(0, 8, 4)); n.body = null; }
      setTag(cd.ls[4], '  temp->leftChild = orig->leftChild;'.padEnd(w, ' '));
      setTag(cd.ls[5], '    // ✗ 沒有呼叫 Copy'.padEnd(w, ' '));
      setTag(cd.ls[6], '  temp->rightChild = orig->rightChild;'.padEnd(w, ' '));
      setTag(cd.ls[7], '    // ✗ 沒有呼叫 Copy'.padEnd(w, ' '));
      cd.hl(4);
      say('錯誤寫法：直接指定 pointer', '不是 assignment 就能複製子樹');
      await beat(tok, 2200);
      const r = dst.pos;
      arrow(V(r.x - 0.2, r.y + 0.3, 0.3), V(src.left.pos.x, src.left.pos.y - 0.32, 0.3), '#c0392b', true);
      arrow(V(r.x + 0.2, r.y + 0.3, 0.3), V(src.right.pos.x, src.right.pos.y - 0.32, 0.3), '#c0392b', true);
      glow(src.left, RED); glow(src.right, RED); glow(src.left.left, RED); glow(src.left.right, RED);
      say('只複製了 root，子樹跟原 tree 共用', '<span class="no">改原 tree，copy 也跟著變</span>');
      await beat(tok, 3200);
      say('思考：用 preorder／postorder 也能 copy 嗎？', '可以，關鍵是左右都遞迴 Copy');
      await beat(tok, 2600);
    } };

    // 6) operator== → Equal(a, b)
    const ECODE = ['bool operator==(s, t)', '  { return Equal(s.root, t.root); }', 'bool Equal(TreeNode* a, TreeNode* b) {', '  if (!a && !b) return true;', '  return (a && b', '    && a->data == b->data', '    && Equal(a->leftChild, b->leftChild)', '    && Equal(a->rightChild, b->rightChild));', '}'];
    LECT['p13-equal'] = { title: '判斷兩棵 tree 相等（Equal）', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.4, 13.5], [0, 3.8, 0]);
      const cd = code(padL(ECODE), 0, 7.7, 0.48);
      const s = showTree('A(B(D,),C)', { cx: -3.4, width: 2.8, topY: 3.3, minY: 1.1, maxSp: 0.95 });
      let t = showTree('A(B(D,),C)', { cx: 3.4, width: 2.8, topY: 3.3, minY: 1.1, maxSp: 0.95 });
      tag('s（示意）', 'ptr', -5.9, 3.3); tag('t', 'ptr', 5.9, 3.3);
      const ca = makeCursor(), cb = makeCursor();
      cd.hl(0);
      say('operator==：把兩個 root 交給 Equal', 'Equal(a, b)：兩個 TreeNode pointer');
      await beat(tok, 2800);
      async function eq(a, b, fast) {
        if (!a && !b) { cd.hl(3); await beat(tok, fast ? 200 : 380); return true; }
        cd.hl(4);
        if (!a || !b) return false;
        cursorTo(ca, a.pos); cursorTo(cb, b.pos);
        glow(a, GOLD); glow(b, GOLD);
        cd.hl(5);
        if (a.label !== b.label) {
          glow(a, RED); glow(b, RED);
          say(a.label + ' ≠ ' + b.label + ' → false', '&& 短路：後面的都不用比');
          await beat(tok, 2200);
          return false;
        }
        say('比 ' + a.label + ' 與 ' + b.label + '：data 相同', '再 recursive 比左、右子樹');
        await beat(tok, fast ? 500 : 900);
        glow(a, GREEN); glow(b, GREEN);
        cd.hl(6);
        if (!(await eq(a.left, b.left, fast))) return false;
        cd.hl(7);
        return eq(a.right, b.right, fast);
      }
      const r1 = await eq(s, t, false);
      cd.hl(-1);
      say('每一層都相同 → s == t', '<span class="ok">' + r1 + '</span>（兩邊 empty 也回傳 true）');
      await beat(tok, 2600);
      allOff(s); allOff(t);
      const D = t.left.left;
      lab.flyAway(D.body, V(3, 8, 3));
      const E = T('E'); E.depth = D.depth; E.pos = D.pos.clone();
      t.left.left = E;
      const eb = nodeBody(E); eb.obj.position.copy(E.pos).add(V(0, 4, 0)); lab.dropTo(eb, E.pos.clone());
      say('把 t 最底下的 D 換成 E', '只比一層看不出來，要遞迴到底');
      await beat(tok, 2200);
      const r2 = await eq(s, t, true);
      cd.hl(-1);
      say('深層不同也會被抓到', '<span class="no">s == t 為 ' + r2 + '</span>');
      await beat(tok, 2800);
    } };

    // 7) 只給一個 inorder，決定不了唯一的 tree
    LECT['p13-same-inorder'] = { title: '一個走訪 string 決定不了唯一的 tree', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.4, 13.5], [0, 3.6, 0.8]);
      const xs = [-4.4, 0, 4.4];
      const trees = ['B(A,C)', 'A(,B(,C))', 'C(B(A,),)'].map((src, j) => showTree(src, { cx: xs[j], width: 2.4, topY: 6.6, minY: 3.6, maxSp: 1.1 }));
      say('示意：三棵結構不同的 tree', '只給 inorder，能決定唯一的 tree 嗎？');
      await beat(tok, 2800);
      tag('inorder', 'idx', -6.6, 0.35, 2.0); tag('preorder', 'idx', -6.6, 0.35, 3.3);
      const cur = makeCursor();
      for (let j = 0; j < 3; j++) {
        const seq = inorder(trees[j]);
        for (let i = 0; i < 3; i++) { cursorTo(cur, seq[i].pos); glow(seq[i], GOLD); emit(seq[i], V(xs[j] - 0.75 + i * 0.75, 0.35, 2.0), SMALL); await beat(tok, 480); }
        say('第 ' + (j + 1) + ' 棵的 inorder：A B C', 'L V R');
        await beat(tok, 700);
      }
      cur.obj.visible = false;
      say('三棵的 inorder 全是 A B C', '<span class="no">單一走訪 → 不唯一</span>');
      await beat(tok, 3000);
      trees.forEach(allOff);
      for (let j = 0; j < 3; j++) {
        const seq = preorder(trees[j]);
        for (let i = 0; i < 3; i++) { emit(seq[i], V(xs[j] - 0.75 + i * 0.75, 0.35, 3.3), SMALL); await beat(tok, 300); }
      }
      say('加上 preorder 就分得開：BAC／ABC／CBA', '<span class="ok">inorder + preorder（或 postorder）→ 唯一</span>');
      await beat(tok, 3400);
    } };

    // ── SAT：課本例 (x1 ∧ ¬x2) ∨ (¬x1 ∧ x3) ∨ ¬x3 ──
    const SAT_SRC = '∨(∨(∧(x1,¬(,x2)),∧(¬(,x1),x3)),¬(,x3))';
    const SAT_F = '(x1 ∧ ¬x2) ∨ (¬x1 ∧ x3) ∨ ¬x3';
    const COMBOS = ['TTT', 'TTF', 'TFT', 'TFF', 'FTT', 'FTF', 'FFT', 'FFF'];
    function satVal(n, asg) {
      if (n.label === '¬') return !satVal(n.right, asg);
      if (n.label === '∧') return satVal(n.left, asg) && satVal(n.right, asg);
      if (n.label === '∨') return satVal(n.left, asg) || satVal(n.right, asg);
      return asg[Number(n.label.slice(1)) - 1] === 'T';
    }

    // 8) SAT 問題：式子 → tree，窮舉 2^3 種組合
    LECT['p13-sat-tree'] = { title: 'Satisfiability：式子、tree、2^n 種組合', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.6, 13.5], [0, 4.0, 0]);
      tag(SAT_F, 'ptr', -2.0, 7.6);
      say('運算子：¬ not、∧ and、∨ or', '變數 x1、x2、x3 只能是 T（1）或 F（0）');
      await beat(tok, 2600);
      say('這個式子可以用 tree 表示（例）', '¬ 是一元運算子：只有右孩子');
      const root = await dropTree(tok, SAT_SRC, { cx: -2.0, width: 8.4, topY: 6.6, minY: 2.2, maxSp: 0.78 }, 200);
      await beat(tok, 1400);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 16), new THREE.MeshStandardMaterial({ color: '#d8cfc0', emissive: '#000' }));
      lamp.position.set(5.6, 0.7, 1.6); lab.world.add(lamp);
      tag('燈', 'idx', 5.6, 0.1, 2.4);
      say('SAT：有沒有一組 assignment 讓式子為 true？', '像開燈電路：有沒有組合讓燈亮（輸出 1）');
      await beat(tok, 2800);
      tag('x1 x2 x3 → 值', 'idx', 4.6, 7.0);
      const rows = COMBOS.map((c, k) => tag(c.split('').join('  ') + '  → ?', '', 4.6, 6.4 - k * 0.6));
      say('3 個變數 → 2^3 = 8 種組合', '用迴圈把每一組代進去');
      await beat(tok, 2200);
      let first = null;
      for (let k = 0; k < 8; k++) {
        const v = satVal(root, COMBOS[k]);
        setTag(rows[k], COMBOS[k].split('').join('  ') + '  → ' + (v ? 'T' : 'F'));
        rows[k].element.className = 'lab-label ' + (v ? 'ptr alt' : 'idx');
        lamp.material.emissive.set(v ? '#e0a800' : '#000');
        if (v && !first) first = COMBOS[k];
        say('代入 ' + COMBOS[k] + '：式子為 ' + (v ? 'true，燈亮' : 'false'), '第 ' + (k + 1) + ' / 8 組');
        await beat(tok, 900);
      }
      say('8 組裡只有 TTT 不成立', '<span class="ok">satisfiable</span>：例如 ' + first);
      await beat(tok, 3000);
    } };

    // 9) 兩階段 stack 求值 vs. 建好 tree 做一次 postorder
    LECT['p13-eval-compare'] = { title: '求值：兩階段 stack vs. postorder', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.6, 13.5], [0, 3.9, 0]);
      tag('Stack 法：兩個 phase', 'ptr', -3.6, 7.6);
      tag('Tree 法：一次 postorder', 'ptr alt', 3.6, 7.6);
      const tok2 = ['2', '+', '3', '*', '4'];
      const inB = tok2.map((s, i) => cube(s, '#4b9ee2', SMALL, -5.6 + i * 0.75, 6.7));
      tag('infix', 'idx', -6.6, 6.7);
      say('之前 stack 章節的 expression：2 + 3 * 4', '先回想兩個 phase 的做法');
      await beat(tok, 2600);
      // phase 1：infix → postfix（operator 進 stack）
      tag('postfix', 'idx', -6.6, 5.4);
      tag('op stack', 'idx', -1.0, 3.7);
      const ops = []; let k = 0;
      const toOut = (s, from) => { const b = cube(s, '#2fc092', SMALL, from.x, from.y); lab.springTo(b, V(-5.6 + k * 0.75, 5.4, 0)); k++; };
      say('Phase 1：infix → postfix', 'operand 直接輸出，operator 進 stack');
      for (let i = 0; i < 5; i++) {
        lit(inB[i], GOLD);
        const p = inB[i].obj.position;
        if ('+*'.includes(tok2[i])) {
          const b = cube(tok2[i], '#dd8238', SMALL, p.x, p.y); lab.springTo(b, V(-1.0, 4.3 + ops.length * 0.55, 0)); ops.push(b);
        } else toOut(tok2[i], p);
        await beat(tok, 750);
        lit(inB[i]);
      }
      while (ops.length) { const b = ops.pop(); lab.springTo(b, V(-5.6 + k * 0.75, 5.4, 0)); k++; await beat(tok, 650); }
      say('postfix：2 3 4 * +', 'phase 1 完成');
      await beat(tok, 1300);
      // phase 2：postfix 求值
      say('Phase 2：依 postfix 求值', '數字 push；operator pop 兩個、算完 push 回去');
      tag('eval stack', 'idx', -4.0, 3.2);
      const st = [];
      const pushV = (v) => { const b = cube(String(v), '#9b7ef4', SMALL, -4.0, 0.4 + st.length * 0.55, 0, 2.5); st.push({ v, b }); };
      for (const s of ['2', '3', '4', '*', '+']) {
        if (s === '*' || s === '+') {
          const y = st.pop(), x = st.pop();
          lab.flyAway(y.b, V(2, 7, 3)); lab.flyAway(x.b, V(-2, 7, 3));
          pushV(s === '*' ? x.v * y.v : x.v + y.v);
          say('pop ' + x.v + '、' + y.v + ' → ' + x.v + ' ' + s + ' ' + y.v + ' = ' + st[st.length - 1].v + '，push', 'stack：' + st.map((e) => e.v).join(' '));
        } else { pushV(Number(s)); say('看到 ' + s + ' → push', 'stack：' + st.map((e) => e.v).join(' ')); }
        await beat(tok, 900);
      }
      say('stack 法：兩個 phase 算出 14', '<span class="ok">2 + 3 * 4 = 14</span>');
      await beat(tok, 1600);
      // tree 法
      const root = showTree('+(2,*(3,4))', { cx: 3.6, width: 3.0, topY: 6.4, minY: 3.4, maxSp: 1.0 });
      say('Tree 法：建好 tree，做一次 postorder', '走訪完答案就在 root');
      await beat(tok, 1600);
      const val = (n) => (n.label === '+' ? val(n.left) + val(n.right) : n.label === '*' ? val(n.left) * val(n.right) : Number(n.label));
      const cur = makeCursor();
      for (const n of postorder(root)) {
        cursorTo(cur, n.pos); glow(n, GOLD);
        tag('= ' + val(n), 'ptr alt', n.pos.x + 0.85, n.pos.y);
        say('postorder 到 ' + n.label + '：value = ' + val(n), n.left ? '左右孩子的值先算好了' : 'leaf 的值就是自己');
        await beat(tok, 850);
      }
      say('一個 phase 就完成，但要先建好 tree', '<span class="ok">root = 14</span>');
      await beat(tok, 2200);
      say('換成布林式：+ − × ÷ → ¬ ∧ ∨', '變數的值只有 0 和 1');
      await beat(tok, 2800);
    } };

    // 10) SAT 用的 node：四個欄位；窮舉演算法
    const ACODE = ['for (each of the 2^n combinations) {', '  generate the next combination;', '  replace variables by their values;', '  PostOrderEval(formula);   // 走訪 tree', '  if (formula.value) {', '    cout << combination; return; }', '}', 'cout << "No satisfiable combination";'];
    LECT['p13-sat-node'] = { title: 'SAT 的 node 設計與窮舉演算法', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.4, 13.5], [0, 4.0, 0]);
      tag('一般 TreeNode：3 個欄位', 'ptr', -1.0, 7.6);
      const three = ['leftChild', 'data', 'rightChild'].map((s, i) => cube(s, '#c9b48e', [1.9, 0.55, 0.7], -3.0 + i * 1.95, 6.8));
      say('原本的 tree node 只有三個欄位', 'leftChild ｜ data ｜ rightChild');
      await beat(tok, 2400);
      tag('SAT 用的 node：4 個欄位', 'ptr alt', 0, 5.9);
      const four = [];
      for (const [i, s, c] of [[0, 'leftChild', '#4b9ee2'], [1, 'data', '#2fc092'], [2, 'value', '#dd8238'], [3, 'rightChild', '#9b7ef4']]) {
        four.push(cube(s, c, [1.9, 0.55, 0.7], -2.92 + i * 1.95, 5.1, 0, 2.5));
        await beat(tok, 450);
      }
      say('要用 postorder 求值：每個 node 四個欄位', '多了一個 value');
      await beat(tok, 2000);
      lit(four[1], GOLD);
      const t1 = tag('not／and／or／true／false', 'idx', -0.97, 4.45);
      say('data：operator，或變數被設定的 T／F', '自己本身的資料');
      await beat(tok, 2600);
      lit(four[1]); lit(four[2], GOLD);
      const t2 = tag('左右子樹運算後的結果', 'idx', 1.0, 4.45);
      say('value：對左右子樹做完 operation 的結果', 'bool value');
      await beat(tok, 2600);
      lit(four[2]); kill(t1); kill(t2);
      const cd = code(padL(ACODE), -1.0, 3.7, 0.44);
      const cnt = tag('', 'ptr alt', 5.6, 2.2);
      say('演算法：n 個變數 → 2^n 種組合', '每一組都走訪一次 tree');
      await beat(tok, 1800);
      for (let k = 0; k < 2; k++) {
        const c = COMBOS[k];
        setTag(cnt, '第 ' + (k + 1) + ' 組：' + c);
        for (const i of [0, 1, 2, 3]) { cd.hl(i); await beat(tok, k ? 380 : 650); }
        cd.hl(4);
        const v = k === 1;
        say('組合 ' + c + '：formula.value = ' + (v ? 'true' : 'false'), v ? '成立 → 印出這組並結束' : '不成立 → 換下一組');
        await beat(tok, 1500);
        if (v) { cd.hl(5); setTag(cnt, '輸出 ' + c); await beat(tok, 1600); }
      }
      cd.hl(-1);
      say('最多試 2^n 組，每組走訪整棵 tree', '時間 O(g · 2^n)：指數時間');
      await beat(tok, 3000);
    } };

    // 11) PostOrderEval：在 SAT tree 上算出每個 node 的 value
    const PCODE = ['void PostOrderEval(TreeNode* x) {', '  if (!x) return;', '  PostOrderEval(x->leftChild);', '  PostOrderEval(x->rightChild);', '  switch (x->data) {', '  case NOT: v = !R.value;', '  case AND: v = L.value && R.value;', '  case OR:  v = L.value || R.value;', '  case TRUE:  v = true;', '  case FALSE: v = false;', '  }  // v = x->value', '}'];
    LECT['p13-postorder-eval'] = { title: 'PostOrderEval 求布林式的值', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.6, 13.5], [0, 4.0, 0]);
      const cd = code(padL(PCODE), -3.9, 7.5, 0.46);
      const root = showTree(SAT_SRC, { cx: 3.3, width: 6.6, topY: 7.0, minY: 2.8, maxSp: 0.62 });
      const asgTag = tag('', 'ptr alt', 3.3, 1.7, 1.2);
      const vt = new Map();
      const cur = makeCursor();
      say('PostOrderEval：先左、再右、最後處理自己', 'L R V：子樹的值先算好');
      cd.hl(2);
      await beat(tok, 2600);
      async function run(asg, ms) {
        setTag(asgTag, '(x1, x2, x3) = (' + asg.split('').join(', ') + ')');
        for (const n of postorder(root)) {
          const v = satVal(n, asg) ? 'T' : 'F';
          cursorTo(cur, n.pos);
          const line = n.label === '¬' ? 5 : n.label === '∧' ? 6 : n.label === '∨' ? 7 : v === 'T' ? 8 : 9;
          cd.hl(line);
          if (!vt.has(n)) vt.set(n, tag('', 'ptr alt', n.pos.x, n.pos.y - 0.55, 0.3));
          setTag(vt.get(n), v);
          glow(n, v === 'T' ? GREEN : RED);
          if (ms > 500) {
            const L = n.left && (satVal(n.left, asg) ? 'T' : 'F'), R = n.right && (satVal(n.right, asg) ? 'T' : 'F');
            const f = n.label === '¬' ? '!' + R + ' = ' + v : n.label === '∧' ? L + ' and ' + R + ' = ' + v : n.label === '∨' ? L + ' or ' + R + ' = ' + v : '變數設為 ' + v;
            say(n.label + '：value = ' + v, f);
          }
          await beat(tok, ms);
        }
      }
      await run('TTT', 950);
      cur.obj.visible = false;
      cd.hl(-1);
      say('結果在 root 的 value：false', 'TTT 不滿足 → 換下一組');
      await beat(tok, 2200);
      allOff(root);
      say('下一組 TTF 再走一次 postorder', '只有 x3 改成 F');
      await beat(tok, 1200);
      await run('TTF', 330);
      cur.obj.visible = false;
      cd.hl(-1);
      say('root.value = true → 印出這組', '<span class="ok">(x1, x2, x3) = (T, T, F)</span>');
      await beat(tok, 3000);
    } };
  }

  // ─── pPMMUa8guTE：交大彭文志 Lec14（Satisfiability、Threaded tree、Huffman、Priority queue、Heap） ───
  {
    const P = () => ctx.params || {};
    const ORANGE = '#dd8238', TAN = '#c9b48e', BLUE = '#4b9ee2', PURP = '#9b7ef4', TEAL = '#31aab0', GRAYB = '#8a7a62';
    const setV = (b, t) => { const c = b.obj.children.find((o) => o.element); if (c) c.element.textContent = String(t); };
    const under = (n, text, cls = 'ptr alt') => tag(text, cls, n.pos.x, n.pos.y - 0.66, 0.35);
    // 圓柱：Huffman 的內部節點（課本畫成圓圈）
    function disc(text, color, x, y, z = 0, drop = 0) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.6, 28), new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 }));
      m.castShadow = true; m.receiveShadow = true;
      m.add(lab.label(String(text), 'val'));
      const b = lab.addBody(m);
      m.position.set(x, y + drop, z);
      if (drop) lab.dropTo(b, V(x, y, z)); else b.target.set(x, y, z);
      return b;
    }
    // 虛線曲線（thread）：從 a 彎向鏡頭再到 b，b 端有箭頭
    function arc(a, b, color = '#c08a1f', lift = V(0, -0.3, 1.2)) {
      const mid = a.clone().add(b).multiplyScalar(0.5).add(lift);
      const pts = new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(28);
      const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color, dashSize: 0.16, gapSize: 0.1 }));
      ln.computeLineDistances();
      const dir = pts[28].clone().sub(pts[25]).normalize();
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.24, 10), new THREE.MeshBasicMaterial({ color }));
      cone.position.copy(b).addScaledVector(dir, -0.12);
      cone.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
      ln.add(cone);
      lab.world.add(ln);
      return ln;
    }
    // node 的 left（side=-1）或 right（side=+1）thread 指向 target（節點或座標）
    const TH_L = '#4b9ee2', TH_R = '#c08a1f';
    function threadTo(from, side, target) {
      const tp = target.pos || target;
      return arc(from.clone().add(V(side * 0.32, -0.3, 0.2)), tp.clone().add(V(0, -0.32, 0.3)), side < 0 ? TH_L : TH_R);
    }
    function floorTile(x, z, w = 0.78, d = 0.9) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), new THREE.MeshStandardMaterial({ color: '#e9dcc4', roughness: 1 }));
      t.position.set(x, 0.04, z); t.receiveShadow = true; lab.world.add(t); return t;
    }
    const bitTag = (p, c, bit) => tag(bit, 'ptr alt', (p.pos.x + c.pos.x) / 2 + (bit === '0' ? -0.28 : 0.28), (p.pos.y + c.pos.y) / 2 + 0.12, 0.3);

    // ════════ 1. Satisfiability：運算式樹 ════════
    const SAT_SRC = '∨(∨(∧(x1,¬(,x2)),∧(¬(,x1),x3)),¬(,x3))';
    const SAT_EXPR = '(x1 ∧ ¬x2) ∨ (¬x1 ∧ x3) ∨ ¬x3';
    const satVal = (a, b, c) => (a && !b) || (!a && c) || !c;
    LECT['p14-sat-tree'] = { title: 'Satisfiability：運算式樹與 8 種組合', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5, 14], [0, 3.8, 0]);
      tag(SAT_EXPR, 'ptr', -2.8, 7.6);
      say('哪組 x1、x2、x3 讓式子為 true？', SAT_EXPR + '（例）');
      await beat(tok, 2800);
      say('優先序：¬ > ∧ > ∨', '變數只有 true / false 兩種值');
      await beat(tok, 2200);
      const root = await dropTree(tok, SAT_SRC, { cx: -2.8, width: 7.2, topY: 6.6, minY: 2.2 }, 200);
      await beat(tok, 600);
      const andL = root.left.left, notX2 = andL.right;
      glow(notX2, GOLD);
      say('括號 x1 ∧ ¬x2：先做 ¬x2', '¬ 只有一個運算元（放在右子）');
      await beat(tok, 2200);
      glow(andL, GOLD);
      say('再跟 x1 做 ∧', 'x1 ∧ (¬x2)');
      await beat(tok, 2000);
      glow(notX2, OFF); glow(andL, OFF);
      say('3 個變數：2³ = 8 種組合', '順序 x1 x2 x3；T = true、F = false');
      tag('x1 x2 x3 → 值', 'ptr', 4.4, 6.9);
      const rows = [];
      for (let k = 0; k < 8; k++) {
        const a = !!(k & 4), b = !!(k & 2), c = !!(k & 1), v = satVal(a, b, c);
        rows.push([tag([a, b, c].map((t) => (t ? 'T' : 'F')).join('  ') + '  →  ' + (v ? 'T' : 'F'), 'idx', 4.4, 6.3 - k * 0.55), v]);
        await beat(tok, 420);
      }
      await beat(tok, 800);
      rows.forEach(([l, v]) => { if (v) l.element.className = 'lab-label ptr alt'; });
      say('true 的組合可能不只一組：全部印出', '這裡 7 組為 true，只有 (T,T,T) 為 false');
      await beat(tok, 3200);
      glow(root, GREEN);
      say('有了樹：postorder 走一次就算出值', 'n 個變數 → 2ⁿ 種組合，每種走一次樹');
      await beat(tok, 3000);
    } };

    // ════════ 2. PostOrderEval ════════
    LECT['p14-sat-eval'] = { title: 'PostOrderEval：LRV 邊走邊算 value', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5, 14], [0, 3.6, 0.6]);
      const root = showTree(SAT_SRC, { cx: -3.7, width: 5.8, topY: 6.6, minY: 2.6 });
      const FN = [['leftChild', 'L'], ['data', '∧'], ['value', '?'], ['rightChild', 'R']];
      const fb = FN.map(([nm, v], k) => {
        const x = -5.6 + k * 1.2;
        tag(nm, 'idx', x, 1.25, 2.5);
        return cube(v, k === 1 ? PURP : k === 2 ? ORANGE : TAN, [1.05, 0.5, 0.7], x, 0.3, 2.5, 3);
      });
      say('節點四個欄位：left、data、value、right', 'data = 變數或運算子；value = 算出的結果');
      await beat(tok, 3200);
      const cd = code([
        'PostOrderEval(Node *s) {',
        ' if (s) {',
        '  PostOrderEval(s->leftChild);',
        '  PostOrderEval(s->rightChild);',
        '  switch (s->data) {',
        '   Not: v = !R->value;',
        '   And: v = L->value && R->value;',
        '   Or:  v = L->value || R->value;',
        '   True:  v = true;',
        '   False: v = false;',
        ' } } }',
      ], 3.9, 7.0, 0.48);
      say('架構就是 postorder：L R V', 'V 從「印出」改成依 data 做 switch');
      for (const i of [2, 3, 4]) { cd.hl(i); await beat(tok, 1300); }
      say('取一組設定：x1 = T, x2 = F, x3 = T', 'v = s->value；L、R = 左、右子節點（共 5 個 case）');
      await beat(tok, 2600);
      const asg = { x1: true, x2: false, x3: true };
      const cur = makeCursor();
      const val = new Map();
      const TF = (b) => (b ? 'T' : 'F');
      for (const n of postorder(root)) {
        cursorTo(cur, n.pos);
        let v, line, why, f;
        if (n.label === '¬') { v = !val.get(n.right); line = 5; why = '¬：對右子的 value 取 not'; f = '!' + TF(val.get(n.right)) + ' = ' + TF(v); }
        else if (n.label === '∧') { v = val.get(n.left) && val.get(n.right); line = 6; why = '∧：左子 value 且 右子 value'; f = TF(val.get(n.left)) + ' && ' + TF(val.get(n.right)) + ' = ' + TF(v); }
        else if (n.label === '∨') { v = val.get(n.left) || val.get(n.right); line = 7; why = '∨：左子 value 或 右子 value'; f = TF(val.get(n.left)) + ' || ' + TF(val.get(n.right)) + ' = ' + TF(v); }
        else { v = asg[n.label]; line = v ? 8 : 9; why = '變數 ' + n.label + ' = ' + TF(v) + ' → case ' + (v ? 'True' : 'False'); f = '葉節點：value 直接設成 ' + (v ? 'true' : 'false'); }
        val.set(n, v);
        cd.hl(line);
        glow(n, v ? GOLD : RED);
        under(n, TF(v), v ? 'ptr alt' : 'ptr');
        setV(fb[1], n.label); setV(fb[2], TF(v));
        say(why, f + (n.left || n.right ? '（用子節點的 value，不是 data）' : ''));
        await beat(tok, 1000);
      }
      cd.hl(-1);
      say('root 的 value = T：這組設定成立', '<span class="ok">x1 = T, x2 = F, x3 = T → true</span>');
      await beat(tok, 3000);
    } };

    // ════════ 3. 延伸：算術運算式 ════════
    LECT['p14-arith-eval'] = { title: '延伸：用樹計算算術運算式', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5, 14], [0, 3.6, 0.5]);
      say('思考題：PostOrderEval 改算算術式', '例：2 + 3 * 4');
      tag('x1 = 2, x2 = 3, x3 = 4', 'idx', -4.3, 7.5);
      const r = await dropTree(tok, '+(2,*(3,4))', { cx: -4.3, width: 3.4, topY: 6.6, minY: 4.0 }, 300);
      await beat(tok, 1000);
      const cur = makeCursor();
      const val = new Map();
      for (const n of postorder(r)) {
        cursorTo(cur, n.pos);
        let v;
        if (!n.left) { v = Number(n.label); say('葉子：value = ' + v, 'switch 換成 +、−、*、/'); }
        else { const a = val.get(n.left), b = val.get(n.right); v = n.label === '+' ? a + b : a * b; say(n.label + '：左 value ' + n.label + ' 右 value', a + ' ' + n.label + ' ' + b + ' = ' + v); }
        val.set(n, v); glow(n, GOLD); under(n, String(v));
        await beat(tok, n.left ? 1700 : 900);
      }
      cur.obj.visible = false;
      tag('stack：infix → postfix → EVAL', 'ptr', 2.6, 7.4);
      tag('tree：infix → 建樹 → postorder', 'ptr alt', 2.6, 6.7);
      say('stack 作法要兩支程式；tree 只要走訪', '前提：先把 infix 轉成一棵樹');
      await beat(tok, 3400);
      const r2 = await dropTree(tok, '-(+(-(/(A,B),C),*(D,E)),*(A,C))', { cx: 2.5, width: 7, topY: 5.6, minY: 1.0 }, 160);
      say('第三章例：A/B−C+D*E−A*C 建成樹', '代入變數值，postorder 一次求值（可能會考）');
      await beat(tok, 2000);
      const cur2 = makeCursor();
      const out = [];
      for (const n of postorder(r2)) { cursorTo(cur2, n.pos); glow(n, GOLD); out.push(n.label); say('postorder 走訪', out.join(' ')); await beat(tok, 420); }
      say('樹的 postorder 正是 postfix', '<span class="ok">' + out.join(' ') + '</span>');
      await beat(tok, 3000);
    } };

    // ════════ 4. n+1 個空 link ════════
    const F520 = 'A(B(D(H,I),E),C(F,G))';
    LECT['p14-null-links'] = { title: 'Threaded tree 動機：n+1 個空 link', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5, 13.5], [0, 3.6, 0.5]);
      say('n 個節點，每個有 2 個 pointer', 'n = 9 → 共 2n = 18 個 link 欄位（Fig 5.20 的樹）');
      const r = await dropTree(tok, F520, { topY: 6.6, minY: 2.5 }, 200);
      await beat(tok, 1400);
      say('除了 root，每個節點恰被一條 link 指到', '用到的 link = n − 1 = 8');
      let k = 0;
      for (const n of levelorder(r)) for (const c of [n.left, n.right]) if (c) {
        k++; glow(c, GREEN);
        tag(String(k), 'ptr', (n.pos.x + c.pos.x) / 2 + (c === n.left ? -0.3 : 0.3), (n.pos.y + c.pos.y) / 2 + 0.1, 0.2);
        await beat(tok, 380);
      }
      await beat(tok, 1200);
      say('沒用到的 link 都是 null', '2n − (n − 1) = n + 1');
      let m = 0;
      for (const n of inorder(r)) for (const side of [-1, 1]) {
        if (side < 0 ? n.left : n.right) continue;
        m++;
        const a = V(n.pos.x + side * 0.3, n.pos.y - 0.3, 0), b = V(n.pos.x + side * 0.62, n.pos.y - 0.9, 0);
        seg(a, b, '#b04040');
        tag('null', 'idx', b.x, b.y - 0.22, 0.2);
        say('空 link 第 ' + m + ' 個', '2n − (n − 1) = n + 1 = ' + (m === 10 ? '<span class="ok">10</span>' : '…'));
        await beat(tok, 420);
      }
      await beat(tok, 1600);
      say('Thread：把空 link 指向 inorder 鄰居', 'left 空 → inorder predecessor；right 空 → inorder successor');
      await beat(tok, 3200);
    } };

    // ════════ 5. Fig 5.20 的 thread ════════
    LECT['p14-thread-fig'] = { title: 'Threaded tree：虛線 = thread', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5, 14], [0, 3.4, 1]);
      const r = showTree(F520, { topY: 6.6, minY: 2.8 });
      const N = (l) => find(r, l);
      say('實線 = 原本的 link；虛線 = thread', '藍 = left thread，金 = right thread');
      await beat(tok, 2600);
      rowLabel('inorder', 1.9);
      const ib = new Map();
      for (const n of inorder(r)) { ib.set(n.label, cube(n.label, depthColor(n.depth), SMALL, n.pos.x, 0.3, 1.9, 2)); await beat(tok, 230); }
      say('inorder：H D I B E A F C G', '每個節點正下方就是它在 inorder 的位置');
      await beat(tok, 2000);
      glow(N('E'), GOLD);
      say('E 是 leaf：兩個 link 本來都是 null', '充分利用它們');
      await beat(tok, 2200);
      threadTo(N('E').pos, -1, N('B')); lit(ib.get('B'), GOLD);
      say('E.left → inorder 前一個 B', 'predecessor');
      await beat(tok, 2200);
      threadTo(N('E').pos, 1, N('A')); lit(ib.get('B')); lit(ib.get('A'), GOLD);
      say('E.right → inorder 後一個 A', 'successor');
      await beat(tok, 2200);
      lit(ib.get('A')); glow(N('E'), OFF); glow(N('I'), GOLD);
      threadTo(N('I').pos, -1, N('D')); threadTo(N('I').pos, 1, N('B'));
      say('I：left → D，right → B', 'inorder … D I B …');
      await beat(tok, 2600);
      glow(N('I'), OFF); glow(N('H'), RED); glow(N('G'), RED);
      const hp = N('H').pos, gp = N('G').pos;
      arc(hp.clone().add(V(-0.32, -0.3, 0.2)), hp.clone().add(V(-0.9, 0.7, 0.3)), TH_L, V(-0.3, 0, 0.6));
      arc(gp.clone().add(V(0.32, -0.3, 0.2)), gp.clone().add(V(0.9, 0.7, 0.3)), TH_R, V(0.3, 0, 0.6));
      tag('?', 'ptr', hp.x - 0.95, hp.y + 0.95, 0.3); tag('?', 'ptr', gp.x + 0.95, gp.y + 0.95, 0.3);
      say('H 沒有前一個、G 沒有後一個', '這兩條懸空 → 老師：可指到 root；課本：指向 head node');
      await beat(tok, 3200);
      glow(N('H'), OFF); glow(N('G'), OFF);
      for (const [l, side, t] of [['H', 1, 'D'], ['F', -1, 'A'], ['F', 1, 'C'], ['G', -1, 'C']]) {
        threadTo(N(l).pos, side, N(t));
        say(l + '.' + (side < 0 ? 'left' : 'right') + ' → ' + t, side < 0 ? 'inorder 前一個' : 'inorder 後一個');
        await beat(tok, 900);
      }
      say('所有空 link 都變成 thread', 'n + 1 = 10 條（含 H、G 兩條指向 head）');
      await beat(tok, 3000);
    } };

    // ════════ 6. leftThread / rightThread 與 head node ════════
    function buildThreaded(o) {
      const r = showTree(F520, o);
      const A = find(r, 'A');
      const head = { label: 'head', pos: V(A.pos.x - 1.5, o.topY + 1.25, 0) };
      return { r, A, head };
    }
    function threadInfo(root, head) {
      const ino = inorder(root), info = new Map();
      info.set(head, { lc: root, rc: head, lt: false, rt: false });
      ino.forEach((n, k) => info.set(n, { lc: n.left || ino[k - 1] || head, lt: !n.left, rc: n.right || ino[k + 1] || head, rt: !n.right }));
      return info;
    }
    function drawThreads(root, head, skipHead) {
      const info = threadInfo(root, head);
      for (const n of inorder(root)) {
        const f = info.get(n);
        if (f.lt && !(skipHead && f.lc === head)) threadTo(n.pos, -1, f.lc === head ? head.pos.clone().add(V(-0.2, 0, 0)) : f.lc);
        if (f.rt && !(skipHead && f.rc === head)) threadTo(n.pos, 1, f.rc === head ? head.pos.clone().add(V(0.2, 0, 0)) : f.rc);
      }
      return info;
    }
    function showHead(head, A, drop) {
      head.body = cube('head', GRAYB, [1.1, 0.6, 0.8], head.pos.x, head.pos.y, 0, drop ? 3 : 0);
      arrow(head.pos.clone().add(V(0.25, -0.3, 0)), A.pos.clone().add(V(-0.2, 0.32, 0)), '#7a6a52');
      const h = head.pos;
      arc(h.clone().add(V(0.55, 0, 0)), h.clone().add(V(0.25, 0.32, 0)), TH_R, V(0.75, 0.55, 0.4));
    }
    LECT['p14-thread-fields'] = { title: 'leftThread / rightThread 與 head node', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5.2, 14], [0, 3.4, 0.8]);
      const { r, A, head } = buildThreaded({ topY: 5.0, minY: 1.8, width: 10.4 });
      drawThreads(r, head, true);
      say('每條 link 都會指到某個節點', '分得出：真的子節點，還是 thread？');
      await beat(tok, 2800);
      const NM = ['leftThread', 'leftChild', 'data', 'rightChild', 'rightThread'];
      const fb = NM.map((nm, k) => {
        const x = -3 + k * 1.5;
        tag(nm, 'idx', x, k % 2 ? 1.35 : 0.95, 2.9);
        return cube('', k === 2 ? PURP : k % 4 === 0 ? ORANGE : TAN, [1.2, 0.5, 0.7], x, 0.3, 2.9, 3);
      });
      const I = find(r, 'I');
      glow(I, GOLD);
      ['t', '→D', 'I', '→B', 't'].forEach((v, k) => setV(fb[k], v));
      say('I 的 left、right 出去都是虛線', '兩條都是 thread → leftThread = rightThread = true');
      await beat(tok, 3000);
      say('多兩個 Boolean 欄位', 'leftThread = true：leftChild 是 thread；false：一般子節點 pointer');
      await beat(tok, 3000);
      glow(I, OFF);
      const B = find(r, 'B');
      glow(B, GOLD);
      ['f', '→D', 'B', '→E', 'f'].forEach((v, k) => setV(fb[k], v));
      say('B 的兩條 link 指向真的子節點', 'leftThread = rightThread = false');
      await beat(tok, 2800);
      glow(B, OFF);
      showHead(head, A, true);
      const info = threadInfo(r, head);
      threadTo(find(r, 'H').pos, -1, head.pos.clone().add(V(-0.2, 0, 0)));
      threadTo(find(r, 'G').pos, 1, head.pos.clone().add(V(0.2, 0, 0)));
      say('加 head node：H、G 不再懸空', 'head.leftChild → 真正的 root A（leftThread = false）');
      await beat(tok, 3200);
      ['f', '→A', '—', '→head', 'f'].forEach((v, k) => setV(fb[k], v));
      say('head.rightChild 指回自己', '空樹：head.leftThread = true，leftChild 也指回 head');
      await beat(tok, 3000);
      for (const n of inorder(r)) { const f = info.get(n); under(n, (f.lt ? 't' : 'f') + ' ' + (f.rt ? 't' : 'f'), f.lt ? 'ptr alt' : 'ptr'); }
      say('看 thread 欄位就知道 link 指向誰', '節點下方：leftThread rightThread（t / f）');
      await beat(tok, 3200);
    } };

    // ════════ 7. InorderSucc ════════
    LECT['p14-inorder-succ'] = { title: '用 thread 找 inorder successor', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5.2, 14], [0, 3.6, 0.8]);
      const { r, A, head } = buildThreaded({ cx: -1.8, width: 8, topY: 5.0, minY: 1.6 });
      showHead(head, A, false);
      const info = drawThreads(r, head, false);
      const cd = code([
        'T* InorderSucc(x) {',
        ' temp = x->rightChild;',
        ' if (!x->rightThread)',
        '  while (!temp->leftThread)',
        '   temp = temp->leftChild;',
        ' return temp; }',
      ], 4.9, 7.4, 0.45);
      rowLabel('inorder', 2.6);
      say('有 thread：很快找到 inorder 下一個', '不需 stack、不需遞迴（程式老師跳過，此為課本版）');
      await beat(tok, 3000);
      const cur = makeCursor();
      let x = head, k = 0;
      for (let guard = 0; guard < 12; guard++) {
        const fx = info.get(x);
        cursorTo(cur, x.pos); cd.hl(1);
        let t = fx.rc;
        await beat(tok, guard === 0 ? 900 : 450);
        if (fx.rt) {
          cd.hl(5); cursorTo(cur, t.pos);
          say(x.label + '.rightThread = t → 直接跳到 ' + t.label, 'right thread 就是 successor');
          await beat(tok, guard < 6 ? 1200 : 700);
        } else {
          cd.hl(2); cursorTo(cur, t.pos);
          say(x.label === 'head' ? '從 head 開始：往右（指回自己）' : x.label + ' 有右子：先往右到 ' + t.label, '再沿 leftChild 一路往左');
          await beat(tok, 800);
          while (!info.get(t).lt) { t = info.get(t).lc; cd.hl(4); cursorTo(cur, t.pos); await beat(tok, 500); }
          cd.hl(5);
          say('走到 leftThread = t 的 ' + t.label + ' 停', '得到 successor = ' + t.label);
          await beat(tok, 1000);
        }
        if (t === head) break;
        glow(t, GOLD);
        const ob = cube(t.label, depthColor(t.depth), SMALL, t.pos.x, t.pos.y, 0);
        lab.springTo(ob, rowPos(k++, 2.6));
        x = t;
      }
      cd.hl(-1);
      say('回到 head 就結束', '<span class="ok">H D I B E A F C G</span>，O(n)');
      await beat(tok, 2400);
      say('代價：多 2 個 Boolean 欄位', 'insert / delete 時還要調整 thread（實務少用）');
      await beat(tok, 3000);
    } };

    // ════════ 8. InsertRight ════════
    LECT['p14-insert-right'] = { title: 'Threaded tree：把 R 插成 X 的右子', play: async (tok) => {
      const CODE = [
        'r->rightChild = s->rightChild;',
        'r->rightThread = s->rightThread;',
        'r->leftChild = s;',
        'r->leftThread = true;',
        's->rightChild = r;',
        's->rightThread = false;',
        'if (!r->rightThread)',
        '  InorderSucc(r)->leftChild = r;',
      ];
      function setup() {
        fresh();
        lab.frameCamera([0, 5, 14], [0, 3.8, 0.5]);
        const cd = code(CODE, -3.7, 6.6, 0.5);
        tag('s = X，r = R（課本 InsertRight）', 'idx', -3.7, 7.4);
        const E = [];
        edgeLines(() => E.map(([a, b]) => [a.body.obj.position, b.body.obj.position]));
        const mk = (l, x, y, color, drop = 0) => { const n = { label: l, pos: V(x, y, 0) }; n.body = cube(l, color, NODE, x, y, 0, drop); return n; };
        const move = (n, x, y) => { n.pos = V(x, y, 0); lab.springTo(n.body, n.pos.clone()); };
        return { cd, E, mk, move };
      }
      // Case 1
      let S = setup();
      const A = S.mk('A', 4.4, 6.4, '#2fc092'), X = S.mk('X', 2.4, 5.0, BLUE);
      S.E.push([A, X]);
      let xr = threadTo(X.pos, 1, A);
      say('Case 1：X 沒有右子樹', 'X.rightChild 是 thread → 上方的 inorder successor A');
      await beat(tok, 2800);
      const R = S.mk('R', 3.4, 3.6, ORANGE, 3);
      S.cd.hl(0);
      say('新節點 R 先接手 X 的 right thread', 'R.rightChild = A，R.rightThread = true');
      await beat(tok, 900); S.cd.hl(1);
      threadTo(R.pos, 1, A);
      await beat(tok, 1400);
      S.cd.hl(2);
      say('R.leftChild = X（thread）', 'R.leftThread = true：R 的 inorder 前一個就是 X');
      await beat(tok, 900); S.cd.hl(3);
      threadTo(R.pos, -1, X);
      await beat(tok, 1400);
      S.cd.hl(4);
      kill(xr); S.E.push([X, R]);
      say('X.rightChild = R', 'X.rightThread = false（指向真的子節點；老師口誤說 true）');
      await beat(tok, 900); S.cd.hl(5);
      await beat(tok, 1800);
      S.cd.hl(6);
      say('R 沒有右子樹 → 不用再修', 'inorder：X R A');
      await beat(tok, 2000);
      // Case 2
      S = setup();
      const A2 = S.mk('A', 5.6, 6.6, '#2fc092'), X2 = S.mk('X', 1.4, 5.4, BLUE), Y = S.mk('Y', 4.4, 4.2, PURP), Wn = S.mk('W', 3.4, 3.0, PURP);
      S.E.push([A2, X2], [X2, Y], [Y, Wn]);
      let wl = threadTo(Wn.pos, -1, X2), yr = threadTo(Y.pos, 1, A2), wr = threadTo(Wn.pos, 1, Y);
      say('Case 2：X 已有右子樹（Y、W）', 'inorder：X W Y A → W 的 left thread 指向 X');
      await beat(tok, 3000);
      S.cd.hl(0);
      kill(wl); kill(yr); kill(wr);
      S.move(Y, 4.4, 3.0); S.move(Wn, 3.4, 1.8);
      const R2 = S.mk('R', 2.4, 4.2, ORANGE, 3);
      S.E.splice(1, 1, [R2, Y]);
      say('整棵右子樹往下移，成為 R 的右子樹', 'R.rightChild = Y，R.rightThread = false');
      await beat(tok, 900); S.cd.hl(1);
      await beat(tok, 1300);
      yr = threadTo(V(4.4, 3.0, 0), 1, A2); wr = threadTo(V(3.4, 1.8, 0), 1, Y);
      wl = threadTo(V(3.4, 1.8, 0), -1, X2);
      S.cd.hl(2);
      threadTo(R2.pos, -1, X2);
      say('R.leftChild = X（thread）', 'R.leftThread = true');
      await beat(tok, 900); S.cd.hl(3);
      await beat(tok, 1100);
      S.cd.hl(4); S.E.push([X2, R2]);
      say('X.rightChild = R', 'X.rightThread = false');
      await beat(tok, 900); S.cd.hl(5);
      await beat(tok, 1100);
      S.cd.hl(6);
      lit(Wn.body, GOLD);
      say('W 原本的 left thread 還指著 X', 'W = R 右子樹的 inorder 第一個 = InorderSucc(R)');
      await beat(tok, 2400);
      S.cd.hl(7);
      kill(wl); threadTo(V(3.4, 1.8, 0), -1, R2);
      say('W.leftChild 改指向 R', 'inorder：X R W Y A，W 的前一個變成 R');
      await beat(tok, 2600);
      lit(Wn.body);
      S.cd.hl(-1);
      say('插入成左子同理', '也分「原本無左子樹」與「有左子樹」兩種 case');
      await beat(tok, 3000);
    } };

    // ════════ 10. Huffman 概念 ════════
    LECT['p14-huff-concept'] = { title: 'Huffman code：頻率高的字用短碼', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5, 14], [0, 3.2, 0.6]);
      const WORDS = ['the', 'I', 'you', 'data'], CNT = [0, 0, 0, 0];
      const SEQ = [0, 1, 0, 2, 0, 1, 0, 3, 1, 0, 2, 1, 0];
      WORDS.forEach((w, j) => tag(w, 'ptr', -5.4 + j * 1.3, 0, 1.0));
      const art = tag('', 'idx', -3.4, 7.3);
      say('一篇文章：統計每個字（message）出現次數', 'M1 … Mn 想成文章裡的 word（示意資料）');
      const txt = [];
      for (const j of SEQ) {
        txt.push(WORDS[j]); setTag(art, '文章：' + txt.join(' '));
        cube('', [ORANGE, BLUE, PURP, TEAL][j], [0.8, 0.4, 0.8], -5.4 + j * 1.3, 0.2 + CNT[j]++ * 0.42, 0, 3);
        await beat(tok, 300);
      }
      CNT.forEach((c, j) => tag(c + ' 次', 'idx', -5.4 + j * 1.3, 0.4 + c * 0.42 + 0.3, 0.2));
      await beat(tok, 1600);
      tag('codebook（示意）', 'ptr', 3.8, 6.6);
      const CODEB = ['0', '10', '110', '111'];
      say('codebook：碼 ↔ 明文 的對照表', '最常出現的字配最短的碼');
      for (let j = 0; j < 4; j++) { tag(WORDS[j] + ' → ' + CODEB[j], j === 0 ? 'ptr alt' : 'ptr', 3.8, 5.8 - j * 0.7); await beat(tok, 700); }
      await beat(tok, 1400);
      tag('傳送端', 'ptr', 0.6, 1.2, 2.6); tag('接收端', 'ptr', 5.6, 1.2, 2.6);
      arrow(V(1.6, 0.9, 2.6), V(4.6, 0.9, 2.6), '#c08a1f');
      tag('the I the → 0 10 0', 'idx', 3.1, 0.45, 2.6);
      say('傳送端編碼、接收端用同一份 codebook 解碼', '碼越長，傳輸與解碼越花時間');
      await beat(tok, 3200);
      say('目標：整份文件編碼後總長度最小', '6·1 + 4·2 + 2·3 + 1·3 = 23 bits（固定 2 bits：26）');
      await beat(tok, 3200);
    } };

    // ════════ 11. M1..M4 的 codebook 樹 ════════
    // 依講師的樹畫出來；內部節點換成圓柱、葉子為橘色方塊
    function huffTree(src, opts) {
      const root = showTree(src, opts);
      for (const n of allNodes(root)) {
        if (n.left || n.right) { kill(n.body); n.body = disc(n.label, TAN, n.pos.x, n.pos.y); }
        else n.body.obj.material.color.set(ORANGE);
      }
      return root;
    }
    function allBits(root) { for (const n of allNodes(root)) { if (n.left) bitTag(n, n.left, '0'); if (n.right) bitTag(n, n.right, '1'); } }
    async function readPath(tok, root, leaf, cur, ms) {
      const path = []; (function f(n, acc) { if (!n) return false; if (n === leaf) { path.push(...acc, n); return true; } return f(n.left, [...acc, n]) || f(n.right, [...acc, n]); })(root, []);
      let bits = '';
      cursorTo(cur, root.pos);
      for (let k = 1; k < path.length; k++) { bits += path[k] === path[k - 1].left ? '0' : '1'; cursorTo(cur, path[k].pos); glow(path[k], GOLD); await beat(tok, ms); }
      return bits;
    }
    LECT['p14-codebook4'] = { title: 'Codebook 長成一棵樹：M1～M4', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5, 13.5], [0, 3.8, 0.4]);
      const root = huffTree('•(•(•(M1,M2),M3),M4)', { cx: -1.6, width: 6.4, topY: 6.6, minY: 2.4 });
      say('四個 message：M1、M2、M3、M4', '每個碼 = 從 root 走到該 leaf 的路徑');
      await beat(tok, 2600);
      allBits(root);
      say('往左記 0、往右記 1', 'codebook 就是這棵樹');
      await beat(tok, 2200);
      tag('codebook', 'ptr', 4.8, 6.6);
      const cur = makeCursor();
      let k = 0;
      for (const l of ['M1', 'M2', 'M3', 'M4']) {
        const leaf = find(root, l);
        const bits = await readPath(tok, root, leaf, cur, 450);
        under(leaf, bits);
        tag(l + ' = ' + bits, 'ptr alt', 4.8, 5.9 - k++ * 0.65);
        say(l + ' 的碼 = ' + bits, '長度 ' + bits.length + ' bits');
        await beat(tok, 1300);
        allNodes(root).forEach((n) => glow(n, OFF));
      }
      cur.obj.visible = false;
      say('樹可以有不同長法（例如 M4 放左邊）', '但要符合 objective function');
      await beat(tok, 2600);
      say('目標：頻率越高碼越短，總長最小', 'min Σ qᵢ × dᵢ（qᵢ = 頻率，dᵢ = 碼長 3, 3, 2, 1）');
      await beat(tok, 3200);
    } };

    // ════════ 12/16. Huffman 建樹（forest：queue 中的每棵樹並排，root 對齊） ════════
    function forest(ws, o) {
      const O = Object.assign({ cx: 0, topY: 6.4, step: 1.15, spc: 1.0, gap: 0.6, tie: 'first' }, o);
      const F = { trees: ws.map((w) => ({ w, leaf: true, left: null, right: null })) };
      F.all = [...F.trees];
      F.q = () => F.trees.map((t) => t.w).join(', ');
      F.layout = () => {
        let x = 0;
        for (const t of F.trees) { (function w(n, d) { if (!n) return; w(n.left, d + 1); n.depth = d; n.lx = x; x += O.spc; w(n.right, d + 1); })(t, 0); x += O.gap; }
        const span = x - O.gap - O.spc;
        for (const n of F.all) n.pos = V(O.cx + n.lx - span / 2, O.topY - n.depth * O.step, 0);
      };
      F.spawn = () => {
        F.layout();
        for (const n of F.all) n.body = n.leaf ? cube(n.w, ORANGE, NODE, n.pos.x, n.pos.y, 0) : disc(n.w, TAN, n.pos.x, n.pos.y);
        edgeLines(() => { const out = []; for (const n of F.all) for (const c of [n.left, n.right]) if (c && n.body && c.body) out.push([n.body.obj.position, c.body.obj.position]); return out; });
      };
      F.merge = () => {
        const a = F.trees.shift(), b = F.trees.shift();
        const t = { w: a.w + b.w, leaf: false, left: a, right: b };
        let k = F.trees.findIndex((u) => (O.tie === 'first' ? u.w >= t.w : u.w > t.w));
        if (k < 0) k = F.trees.length;
        F.trees.splice(k, 0, t); F.all.push(t);
        t.body = disc(t.w, TAN, (a.pos.x + b.pos.x) / 2, O.topY, 0, 1.2);
        F.layout();
        for (const n of F.all) lab.springTo(n.body, n.pos.clone());
        return t;
      };
      return F;
    }
    LECT['p14-huff-build'] = { title: 'Huffman 建樹：每次合併最小的兩個', play: async (tok) => {
      const bu = P().phase === 'bottomup';
      fresh();
      lab.frameCamera([0, 4.8, 14], [0, 3.8, 0]);
      const F = forest([2, 3, 5, 7, 9, 13], { topY: 6.4 });
      F.spawn();
      say(bu ? 'Bottom-up：頻率最少的先合併' : '方塊 = leaf（message），數字 = 頻率', 'queue：' + F.q());
      await beat(tok, 2800);
      const slowN = bu ? 2 : 5;
      for (let s = 0; s < 5; s++) {
        const slow = s < slowN;
        const [a, b] = F.trees;
        lit(a.body, GOLD); lit(b.body, GOLD);
        say('取最小的兩個：' + a.w + ' 和 ' + b.w, 'queue：' + F.q());
        await beat(tok, slow ? 1800 : 500);
        const t = F.merge();
        lit(a.body); lit(b.body);
        if (bu && s === 0) say('2 + 3 → 圓圈 5：虛擬的合併字', '內部節點的數字 = subtree 頻率總和');
        else if (bu && s === 1) say('5 + 5 → 10：整棵 subtree 當一個字', 'queue：' + F.q());
        else say('merge：' + a.w + ' + ' + b.w + ' = ' + t.w + '，放回 queue', 'queue：' + F.q());
        await beat(tok, slow ? 2400 : 700);
      }
      if (bu) {
        const r = F.trees[0], n23 = r.right, n10 = n23.left, n5 = n10.left;
        bitTag(r, n23, '1'); bitTag(n23, n10, '0'); bitTag(n10, n5, '0'); bitTag(n5, n5.left, '0'); bitTag(n5, n5.right, '1');
        lit(n5.body, GOLD);
        say('到圓圈 5 的碼 = 100：2、3 共用', '下一層才分支：2 = 1000、3 = 1001');
        await beat(tok, 3400);
      } else {
        say('queue 只剩一棵：Huffman tree 完成', 'n = 6 個 message → merge n − 1 = 5 次');
        await beat(tok, 3000);
      }
    } };

    // ════════ 13. Huffman 程式 ════════
    LECT['p14-huff-code'] = { title: 'Huffman 程式：DeleteMinWeight + merge', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5, 14], [0, 3.8, 0.6]);
      const cd = code([
        'BinaryTree(bt1, bt2) {',
        '  root->leftChild = bt1.root;',
        '  root->rightChild = bt2.root;',
        '  root->weight = bt1.root->weight',
        '               + bt2.root->weight; }',
        'Huffman(List<BinaryTree> l, n) {',
        '  for (i = 0; i < n-1; i++) {',
        '    first = l.DeleteMinWeight();',
        '    second = l.DeleteMinWeight();',
        '    bt = new BinaryTree(first, second);',
        '    l.Insert(*bt); } }',
      ], -3.5, 7.3, 0.46);
      tag('queue l', 'ptr', 1.0, 1.25, 2.4);
      tag('first', 'idx', 2.5, 4.4); tag('second', 'idx', 5.3, 4.4);
      const iTag = tag('i = 0', 'ptr alt', 3.9, 7.5);
      const qx = (k) => V(1.0 + k * 1.05, 0.35, 2.4);
      const q = [2, 3, 5, 7, 9, 13].map((w, k) => ({ w, leaf: true, body: cube(w, ORANGE, NODE, qx(k).x, 0.35, 2.4, 2) }));
      const restack = () => q.forEach((e, k) => lab.springTo(e.body, qx(k)));
      say('一開始：n 個 message 各是一棵單節點樹', 'queue l：2, 3, 5, 7, 9, 13');
      await beat(tok, 2800);
      for (let i = 0; i < 5; i++) {
        const slow = i === 0, ms = slow ? 1500 : 480;
        setTag(iTag, 'i = ' + i + '（共 n − 1 = 5 次）');
        cd.hl(6); await beat(tok, slow ? 1000 : 300);
        cd.hl(7);
        const a = q.shift(); restack(); lab.springTo(a.body, V(2.5, 5.0, 0)); lit(a.body, GOLD);
        if (slow) say('DeleteMinWeight：取出最小的 first = ' + a.w, '不是取最前面的，而是 weight 最小的');
        await beat(tok, ms);
        cd.hl(8);
        const b = q.shift(); restack(); lab.springTo(b.body, V(5.3, 5.0, 0)); lit(b.body, GOLD);
        if (slow) say('再取一次：second = ' + b.w, 'queue：' + q.map((e) => e.w).join(', '));
        await beat(tok, ms);
        cd.hl(9);
        const t = { w: a.w + b.w, leaf: false, body: disc(a.w + b.w, TAN, 3.9, 6.2, 0, 1.2) };
        const s1 = seg(V(3.9, 5.9, 0), V(2.5, 5.3, 0), '#7a6a52'), s2 = seg(V(3.9, 5.9, 0), V(5.3, 5.3, 0), '#7a6a52');
        if (slow) {
          for (const l of [1, 2]) { cd.hl(l); await beat(tok, 700); }
          cd.hl(3);
          say('new BinaryTree(first, second)', 'first、second 成為左右子樹；weight = ' + a.w + ' + ' + b.w + ' = ' + t.w);
          await beat(tok, 2200);
        } else { say('merge ' + a.w + ' + ' + b.w + ' = ' + t.w, 'queue：' + q.map((e) => e.w).join(', ')); await beat(tok, ms); }
        cd.hl(10);
        kill(s1); kill(s2); kill(a.body); kill(b.body);
        let k = q.findIndex((u) => u.w >= t.w); if (k < 0) k = q.length;
        q.splice(k, 0, t); restack();
        if (slow) say('l.Insert(*bt)：新樹整棵放回 queue', 'queue：' + q.map((e) => e.w).join(', '));
        await beat(tok, slow ? 2000 : 700);
      }
      cd.hl(-1);
      say('queue 只剩一棵：root weight = 39', '也可改成「queue 只剩一棵就停」，不必數 n − 1 次');
      await beat(tok, 3000);
    } };

    // ════════ 15. 讀碼 ════════
    const HUFF6 = '39(16(7,9),23(10(5(2,3),5),13))';
    LECT['p14-huff-read'] = { title: 'Huffman tree 讀碼：左 0 右 1', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5, 13.5], [0, 3.8, 0.4]);
      const root = huffTree(HUFF6, { topY: 6.6, minY: 2.2 });
      const leaves = allNodes(root).filter((n) => !n.left);
      const L = (w) => leaves.find((n) => n.label === String(w));
      say('最後得到的就是 Huffman tree', '方塊 = message（字），圓 = 合併出的節點');
      await beat(tok, 2600);
      glow(L(13), GOLD); glow(L(2), RED); glow(L(3), RED);
      say('字是什麼不重要，頻率才重要', '頻率高（13）靠近 root；頻率低（2、3）離 root 遠');
      await beat(tok, 3000);
      allNodes(root).forEach((n) => glow(n, OFF));
      allBits(root);
      say('讀碼：往左走記 0、往右走記 1', '從 root 走到 leaf 的路徑');
      await beat(tok, 2200);
      const cur = makeCursor();
      for (const w of [2, 3]) {
        const b = await readPath(tok, root, L(w), cur, 600);
        under(L(w), b);
        say('頻率 ' + w + ' 的字：碼 = ' + b, '右、左、左、' + (w === 2 ? '左' : '右'));
        await beat(tok, 1800);
        allNodes(root).forEach((n) => glow(n, OFF));
      }
      cur.obj.visible = false;
      const CODES = { 7: '00', 9: '01', 5: '101', 13: '11' };
      for (const w of [7, 9, 5, 13]) under(L(w), CODES[w]);
      say('其餘：7=00、9=01、5=101、13=11', '頻率 13 只要 2 bits；2、3 要 4 bits');
      await beat(tok, 3000);
      say('總長 = Σ 頻率 × 碼長', '7·2 + 9·2 + 2·4 + 3·4 + 5·3 + 13·2 = 93 bits');
      await beat(tok, 3000);
    } };

    // ════════ 17. Huffman tree 唯一嗎？→ priority queue ════════
    LECT['p14-huff-tie'] = { title: 'Huffman tree 不唯一；DeleteMin 引出 priority queue', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5, 14], [0, 3.6, 0.6]);
      const FA = forest([1, 1, 2, 2], { cx: -3.4, topY: 6.4, step: 1.2, spc: 0.75, gap: 0.45, tie: 'first' });
      const FB = forest([1, 1, 2, 2], { cx: 3.4, topY: 6.4, step: 1.2, spc: 0.75, gap: 0.45, tie: 'last' });
      FA.spawn(); FB.spawn();
      tag('樹 A', 'ptr', -3.4, 7.6); tag('樹 B', 'ptr', 3.4, 7.6);
      say('同樣的頻率，Huffman tree 唯一嗎？', '示意：頻率 1, 1, 2, 2');
      await beat(tok, 2800);
      FA.merge(); FB.merge();
      say('先合併 1 + 1 = 2', 'queue 裡出現三個 2：同分！');
      await beat(tok, 2600);
      [FA.trees[0], FA.trees[1]].forEach((t) => lit(t.body, GOLD));
      [FB.trees[0], FB.trees[1]].forEach((t) => lit(t.body, GOLD));
      say('同分時選哪兩個？', 'A：新的 2 + 原本的 2；B：兩個原本的 2');
      await beat(tok, 2800);
      FA.all.forEach((n) => lit(n.body)); FB.all.forEach((n) => lit(n.body));
      FA.merge(); FB.merge();
      await beat(tok, 1600);
      FA.merge(); FB.merge();
      say('兩棵形狀不同的 Huffman tree', 'A 碼長 3, 3, 2, 1；B 碼長 2, 2, 2, 2');
      await beat(tok, 2600);
      tag('Σ = 1·3 + 1·3 + 2·2 + 2·1 = 12', 'ptr alt', -3.4, 2.4, 0.4);
      tag('Σ = 1·2 + 1·2 + 2·2 + 2·2 = 12', 'ptr alt', 3.4, 2.4, 0.4);
      say('不唯一，但總長 Σ qᵢdᵢ 一樣是最小', '左右對調也會得到不同的樹');
      await beat(tok, 3000);
      tag('queue', 'ptr', -5.4, 0.5, 3.0);
      const vals = [5, 2, 9, 3];
      const qb = vals.map((v, k) => cube(v, BLUE, SMALL, -3.8 + k * 1.0, 0.3, 3.0, 2));
      tag('front', 'idx', -3.8, 0.95, 3.0);
      say('DeleteMinWeight：刪最小的，不是最前面的', 'queue（示意）：5, 2, 9, 3');
      await beat(tok, 2200);
      lit(qb[1], GOLD); await beat(tok, 900);
      lab.flyAway(qb[1], V(0, 8, 3));
      say('取出 2：不是 FIFO，而是依 priority', '這種 queue 就是 priority queue');
      await beat(tok, 3000);
    } };

    // ════════ 18. Priority queue：max / min ════════
    LECT['p14-pq'] = { title: 'Priority queue：max PQ 與 min PQ', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5, 14], [0, 2.8, 0.6]);
      const BX = [-3.3, 3.3];
      BX.forEach((x, j) => { ghost(j ? TEAL : PURP, x, 1.1, 3.4, 2.2, 0, 2.2); tag(j ? 'min priority queue' : 'max priority queue', 'ptr', x, 2.7); });
      say('Priority queue 也有 add 和 delete', '每個元素有自己的 priority');
      await beat(tok, 2600);
      const IN = [100, 1, 37, 8];
      const boxes = [new Map(), new Map()];
      for (let k = 0; k < IN.length; k++) {
        BX.forEach((x, j) => boxes[j].set(IN[k], cube(IN[k], j ? TEAL : PURP, NODE, x - 1.05 + k * 0.7, 0.3 + (k % 2) * 0.7, (k % 2) * 0.5 - 0.3, 3)));
        say('add ' + IN[k], '加入兩個 queue（示意資料）');
        await beat(tok, 750);
      }
      const outs = [[], []];
      async function del(j, v, cap, f) {
        const b = boxes[j].get(v); lit(b, GOLD);
        say(cap, f);
        await beat(tok, 900);
        lab.springTo(b, V(BX[j] - 0.9 + outs[j].length * 1.0, 4.4, 0)); outs[j].push(v);
        await beat(tok, 1600);
      }
      await del(0, 100, 'max PQ：delete 回傳目前最大的', 'delete → 100');
      await del(1, 1, 'min PQ：delete 回傳目前最小的', 'delete → 1');
      await del(0, 37, '再 delete 一次', 'max PQ → 37');
      await del(1, 8, '再 delete 一次', 'min PQ → 8');
      tag('Huffman：每次取頻率最小 → min PQ', 'idx', 0, 0.2, 3.2);
      tag('machine service：所需時間最短的 job 先做 → min PQ', 'idx', 0, 0.2, 3.9);
      say('應用：Huffman、machine service', '都是 min priority queue');
      await beat(tok, 3000);
      say('實作 priority queue 最常用 heap', '嚴格說：PQ 是 ADT，heap 是實作它的資料結構');
      await beat(tok, 3000);
    } };

    // ════════ 19. 實作方式比較 ════════
    LECT['p14-pq-impl'] = { title: 'Priority queue 的實作方式比較', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5, 14.5], [0, 3.6, 0.4]);
      const ROWS = [['unordered linked list', 6.6], ['unordered array', 5.2], ['sorted linked list', 3.8], ['sorted array', 2.4]];
      ROWS.forEach(([nm, y]) => tag(nm, 'ptr', -4.6, y));
      const NX = [-1.4, 0.6];
      say('插入 100、再插入 1：四種存法', '（老師的例子；課本以 max PQ 比較）');
      await beat(tok, 2400);
      // unordered linked list
      let y = 6.6;
      cube(100, PURP, [0.9, 0.5, 0.6], NX[0], y, 0, 2); await beat(tok, 600);
      cube(1, PURP, [0.9, 0.5, 0.6], NX[1], y, 0, 2); arrow(V(NX[0] + 0.5, y, 0), V(NX[1] - 0.5, y, 0));
      say('unordered list：來一個塞一個', '100 → 1');
      await beat(tok, 1800);
      // unordered array
      y = 5.2;
      NX.forEach((x, k) => { tag('a[' + k + ']', 'idx', x, y - 0.55, 0.4); });
      cube(100, BLUE, [0.9, 0.5, 0.6], NX[0], y, 0, 2); await beat(tok, 600);
      cube(1, BLUE, [0.9, 0.5, 0.6], NX[1], y, 0, 2);
      say('unordered array：依序放入', '100 放 a[0]、1 放 a[1]');
      await beat(tok, 1800);
      // sorted linked list
      y = 3.8;
      cube(100, TEAL, [0.9, 0.5, 0.6], NX[1], y, 0, 2); await beat(tok, 600);
      cube(1, TEAL, [0.9, 0.5, 0.6], NX[0], y, 0, 2); arrow(V(NX[0] + 0.5, y, 0), V(NX[1] - 0.5, y, 0), '#c08a1f');
      say('sorted list：insert 時就排好 → 1、100', '只要改 pointer（pointer assignment）');
      await beat(tok, 2200);
      // sorted array
      y = 2.4;
      NX.forEach((x, k) => { tag('a[' + k + ']', 'idx', x, y - 0.55, 0.4); });
      const big = cube(100, ORANGE, [0.9, 0.5, 0.6], NX[0], y, 0, 2); await beat(tok, 800);
      lab.springTo(big, V(NX[1], y, 0)); await beat(tok, 700);
      cube(1, ORANGE, [0.9, 0.5, 0.6], NX[0], y, 0, 2);
      say('sorted array：100 要往後搬', 'data movement，再把 1 放進 a[0]');
      await beat(tok, 2200);
      const C = [['Insert Θ(1)｜Delete Θ(n)', 6.6], ['Insert Θ(1)｜Delete Θ(n)', 5.2], ['Insert O(n)｜Delete Θ(1)', 3.8], ['Insert O(n)｜Delete Θ(1)', 2.4]];
      for (const [t, yy] of C.slice(0, 2)) tag(t, 'ptr alt', 4.4, yy);
      say('unordered：insert 快，delete 要掃全部', '先甘後苦');
      await beat(tok, 2800);
      for (const [t, yy] of C.slice(2)) tag(t, 'ptr alt', 4.4, yy);
      say('sorted：insert 要找位置，delete 很快', '先苦後甘');
      await beat(tok, 2800);
      tag('max heap', 'ptr', -4.6, 1.0);
      cube(100, '#2fc092', [0.8, 0.5, 0.6], -0.4, 1.3, 0, 2); cube(1, '#2fc092', [0.8, 0.5, 0.6], -1.2, 0.35, 0, 2);
      seg(V(-0.5, 1.05, 0), V(-1.1, 0.6, 0), '#7a6a52');
      tag('Insert O(log n)｜Delete O(log n)', 'ptr alt', 4.4, 1.0);
      say('max heap：兩者都是 O(log n)', 'heap 是樹，操作只沿樹高走 → log n');
      await beat(tok, 3200);
    } };

    // ════════ 20–23. Heap ════════
    function heapSet(vals, o) {
      const O = Object.assign({ cx: 0, topY: 6.4, step: 1.4, width: 7, ax: -2.2, adx: 0.9, cells: 6, color: BLUE, drop: 0, ms: 0 }, o);
      const pos = (i) => heapPos(i, O.topY, O.step, O.width).add(V(O.cx, 0, 0));
      const cellP = (i) => V(O.ax + (i - 1) * O.adx, 0.35, 2.4);
      const H = [null], A = [null];
      for (let i = 1; i <= O.cells; i++) { floorTile(cellP(i).x, 2.4); tag('[' + i + ']', 'idx', cellP(i).x, 0, 3.05); const p = pos(i); tag(String(i), 'idx', p.x + 0.58, p.y - 0.32, 0.3); }
      edgeLines(() => { const out = []; for (let i = 2; i < H.length; i++) if (H[i] && H[i >> 1]) out.push([H[i >> 1].obj.position, H[i].obj.position]); return out; });
      const S = { O, pos, cellP, H, A,
        put(i, v, color, drop) {
          const p = pos(i), c = cellP(i);
          H[i] = cube(v, color || O.color, NODE, p.x, p.y, 0, drop || 0); H[i].v = v;
          A[i] = cube(v, color || O.color, SMALL, c.x, 0.35, 2.4, drop || 0); A[i].v = v;
        },
        async fill(tok) { for (let k = 0; k < vals.length; k++) { S.put(k + 1, vals[k], null, O.drop); if (O.ms) await beat(tok, O.ms); } },
        // 交換 i、j 兩格（樹與陣列）
        swap(i, j) {
          [H[i], H[j]] = [H[j], H[i]]; [A[i], A[j]] = [A[j], A[i]];
          lab.springTo(H[i], pos(i)); lab.springTo(H[j], pos(j));
          lab.springTo(A[i], cellP(i)); lab.springTo(A[j], cellP(j));
        },
      };
      return S;
    }
    const arrStr = (S) => '[' + S.H.slice(1).filter(Boolean).map((b) => b.v).join(', ') + ']';
    LECT['p14-heap-def'] = { title: 'Max heap / Min heap 與陣列表示', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5, 14], [0, 3.6, 0.8]);
      tag('max heap', 'ptr', -3.4, 7.4); tag('min heap', 'ptr', 3.4, 7.4);
      const MX = heapSet([14, 12, 7, 10, 8, 6], { cx: -3.4, width: 5.4, topY: 6.4, step: 1.35, ax: -5.6, adx: 0.8, color: BLUE, drop: 3, ms: 350 });
      say('Max heap：root 是所有數中最大的', 'complete binary tree，且每個節點 ≥ 其子節點');
      await MX.fill(tok);
      await beat(tok, 1200);
      for (const [p, cs] of [[1, [2, 3]], [2, [4, 5]], [3, [6]]]) {
        [p, ...cs].forEach((i) => lit(MX.H[i], GREEN));
        say('每個 subtree 也都是 max heap', MX.H[p].v + ' ≥ ' + cs.map((i) => MX.H[i].v).join('、'));
        await beat(tok, 1300);
        [p, ...cs].forEach((i) => lit(MX.H[i]));
      }
      for (let i = 1; i <= 4; i++) { lit(MX.A[i], GOLD); lit(MX.H[i], GOLD); await beat(tok, 450); }
      say('節點旁的編號 = 陣列索引', '1 放 14、2 放 12、3 放 7、4 放 10（[0] 不用）');
      await beat(tok, 2200);
      for (let i = 1; i <= 4; i++) { lit(MX.A[i]); lit(MX.H[i]); }
      const MN = heapSet([2, 7, 4, 10, 8, 6], { cx: 3.4, width: 5.4, topY: 6.4, step: 1.35, ax: 1.4, adx: 0.8, color: TEAL, drop: 3, ms: 300 });
      say('Min heap：root 最小，下面沒有更小的', '2 ≤ 7、4；7 ≤ 10、8；4 ≤ 6');
      await MN.fill(tok);
      await beat(tok, 1600);
      lit(MX.H[2], GOLD); lit(MX.H[3], GOLD); lit(MN.H[2], GOLD); lit(MN.H[3], GOLD);
      say('左右子之間沒有大小規定', 'max：左 12 > 右 7；min：左 7 > 右 4，都合法');
      await beat(tok, 3000);
      say('不要和 BST（左小右大）搞混', 'heap 只管上下，不管左右；一定是 complete binary tree');
      await beat(tok, 3000);
    } };

    LECT['p14-heap-insert'] = { title: 'Max heap insert：1、5、21', play: async (tok) => {
      const BASE = [20, 15, 2, 14, 10];
      async function demo(v, intro) {
        fresh();
        lab.frameCamera([0, 5, 13.5], [0, 3.6, 0.8]);
        const S = heapSet(BASE, { cx: 0, width: 7, topY: 6.4, step: 1.45, ax: -2.2, adx: 0.9 });
        await S.fill(tok);
        const g = ghost('#c08a1f', S.pos(6).x, S.pos(6).y, 0.9, 0.7, 0, 0.9);
        tag('insert ' + v, 'ptr alt', 4.6, 7.2);
        say(intro[0], intro[1]);
        await beat(tok, 2200);
        kill(g);
        S.put(6, v, ORANGE, 3);
        say('先放在最後一個位置：6（2 的左子）', '維持 complete binary tree');
        await beat(tok, 1600);
        let i = 6;
        while (i > 1) {
          const p = i >> 1, pv = S.H[p].v;
          lit(S.H[i], GOLD); lit(S.H[p], GOLD);
          if (v > pv) {
            say('跟 parent ' + pv + ' 比：' + v + ' > ' + pv, '往上換：' + pv + ' 掉下來，' + v + ' 上去');
            await beat(tok, 1400);
            lit(S.H[i]); lit(S.H[p]);
            S.swap(i, p); i = p;
            await beat(tok, 900);
          } else {
            say('跟 parent ' + pv + ' 比：' + v + ' < ' + pv + ' → 停', 'insert 結束');
            await beat(tok, 1500);
            lit(S.H[i]); lit(S.H[p]);
            break;
          }
        }
        if (i === 1) { say(v + ' 成為新的 root', '一直往上檢查，到 root 為止'); await beat(tok, 1400); }
        say('結果', '<span class="ok">' + arrStr(S) + '</span>');
        await beat(tok, 1600);
      }
      await demo(1, ['insert 1', '原 heap [20, 15, 2, 14, 10]；下一個位置一定是 6，不能放別處']);
      await demo(5, ['同一個原 heap：insert 5', '比 parent 大就往上']);
      await demo(21, ['同一個原 heap：insert 21', '比 root 還大會一路換到頂']);
      await beat(tok, 1200);
    } };

    LECT['p14-heap-insert-code'] = { title: 'Max heap insert 程式：parent 往下搬', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5, 14], [0, 3.6, 0.8]);
      const cd = code([
        'insert_max_heap(item, *n) {',
        '  if (HEAP_FULL(*n)) exit(1);',
        '  i = ++(*n);',
        '  while (i != 1 &&',
        '     item.key > heap[i/2].key) {',
        '    heap[i] = heap[i/2];',
        '    i /= 2;',
        '  }',
        '  heap[i] = item;',
        '}',
      ], -3.9, 7.2, 0.48);
      const S = heapSet([20, 15, 2, 14, 10], { cx: 3.4, width: 5.2, topY: 6.4, step: 1.4, ax: 0.6, adx: 0.85 });
      await S.fill(tok);
      const nT = tag('n = 5', 'ptr', 6.3, 2.0, 2.4);
      const iT = tag('', 'ptr alt', 0, 1.2, 2.4);
      const showI = (i) => { const c = S.cellP(i); iT.position.set(c.x, 1.2, 2.4); setTag(iT, 'i = ' + i); };
      say('heap 存在陣列 heap[1..n]', 'n = 最後一個元素的 index = 5（老師先說 6 後更正）');
      await beat(tok, 2800);
      cd.hl(1);
      say('先檢查 heap 滿了沒', 'HEAP_FULL：n == MAX_ELEMENTS − 1');
      await beat(tok, 1800);
      const item = cube(21, ORANGE, NODE, 6.4, 7.4, 0, 2);
      tag('item', 'idx', 6.4, 8.0);
      cd.hl(2); setTag(nT, 'n = 6'); showI(6);
      const g = ghost('#c08a1f', S.pos(6).x, S.pos(6).y, 0.9, 0.7, 0, 0.9);
      say('i = ++(*n)：n 變 6，從位置 6 開始', '位置 i 的 parent 在 i/2');
      await beat(tok, 2400);
      let i = 6;
      while (true) {
        cd.hl(3);
        if (i === 1) { say('i == 1（root）→ 迴圈結束', ''); await beat(tok, 1500); break; }
        const p = i >> 1;
        cd.hl(4); lit(S.H[p], GOLD); lit(item, GOLD);
        say('parent = heap[' + i + '/2] = heap[' + p + '] = ' + S.H[p].v, '21 > ' + S.H[p].v + ' → 繼續');
        await beat(tok, 1800);
        lit(S.H[p]); lit(item);
        cd.hl(5);
        S.H[i] = S.H[p]; S.A[i] = S.A[p]; S.H[p] = null; S.A[p] = null;
        lab.springTo(S.H[i], S.pos(i)); lab.springTo(S.A[i], S.cellP(i));
        if (i === 6) kill(g);
        say('heap[' + i + '] = heap[' + p + ']：parent ' + S.H[i].v + ' 往下搬', '不是 swap：21 還沒放進去');
        await beat(tok, 2000);
        cd.hl(6); i = p; showI(i);
        say('i /= 2 → i = ' + i, '往上一層');
        await beat(tok, 1100);
      }
      cd.hl(8);
      S.H[1] = item; item.v = 21; lab.springTo(item, S.pos(1));
      S.A[1] = cube(21, ORANGE, SMALL, S.cellP(1).x, 0.35, 2.4, 2); S.A[1].v = 21;
      say('heap[1] = item：最後一次放好', '<span class="ok">' + arrStr(S) + '</span>');
      await beat(tok, 2200);
      cd.hl(-1);
      say('每層搬一次：O(log n)', '老師口說 swap；程式其實只搬 parent，省一半的搬移');
      await beat(tok, 3000);
    } };

    LECT['p14-heap-delete'] = { title: 'Max heap delete：笨方法 vs 課本作法', play: async (tok) => {
      const BASE = [20, 15, 2, 14, 10];
      async function setup(cap) {
        fresh();
        lab.frameCamera([0, 5, 13.5], [0, 3.6, 0.8]);
        const S = heapSet(BASE, { cx: 0, width: 7, topY: 6.4, step: 1.45, ax: -2.2, adx: 0.9, cells: 5 });
        await S.fill(tok);
        tag(cap, 'ptr', 0, 7.6);
        return S;
      }
      let S = await setup('老師的直覺作法');
      say('Delete max：root 的 20 被拿走', '[20, 15, 2, 14, 10]');
      await beat(tok, 1800);
      lab.flyAway(S.H[1], V(0, 8, 4)); lab.flyAway(S.A[1], V(0, 8, 4)); S.H[1] = S.A[1] = null;
      await beat(tok, 1200);
      [2, 3, 4, 5].forEach((i) => lit(S.H[i], GOLD));
      say('笨方法：在 15、2、14、10 找最大', '15 最大 → 移上 root');
      await beat(tok, 1800);
      [2, 3, 4, 5].forEach((i) => lit(S.H[i]));
      const mv = (from, to) => { S.H[to] = S.H[from]; S.A[to] = S.A[from]; S.H[from] = S.A[from] = null; lab.springTo(S.H[to], S.pos(to)); lab.springTo(S.A[to], S.cellP(to)); };
      mv(2, 1);
      await beat(tok, 1400);
      lit(S.H[4], GOLD); lit(S.H[5], GOLD);
      say('15 的位置空了：從下面 14、10 挑大的', '14 補上位置 2');
      await beat(tok, 1800);
      lit(S.H[4]); lit(S.H[5]);
      mv(4, 2);
      await beat(tok, 1400);
      ghost('#d64545', S.pos(4).x, S.pos(4).y, 0.9, 0.7, 0, 0.9);
      ghost('#d64545', S.cellP(4).x, 0.35, 0.8, 0.5, 2.4, 0.8);
      say('位置 4 空了，10 還在位置 5', '中間有洞 → 不是 complete binary tree');
      await beat(tok, 2800);
      say('老師：這不是最後的解法，下次再講', '補充：課本的作法如下');
      await beat(tok, 2200);
      S = await setup('補充：課本作法（trickle down）');
      lab.flyAway(S.H[1], V(0, 8, 4)); lab.flyAway(S.A[1], V(0, 8, 4)); S.H[1] = S.A[1] = null;
      say('同樣拿走 20', '把最後一個元素 10 移到 root，n 變 4');
      await beat(tok, 1400);
      mv(5, 1);
      await beat(tok, 1600);
      lit(S.H[1], GOLD); lit(S.H[2], GOLD);
      say('10 跟較大的子 15 比：15 較大', '交換：15 上移');
      await beat(tok, 1600);
      lit(S.H[1]); lit(S.H[2]); S.swap(1, 2);
      await beat(tok, 1200);
      lit(S.H[2], GOLD); lit(S.H[4], GOLD);
      say('10 跟子 14 比：14 較大', '交換：14 上移');
      await beat(tok, 1600);
      lit(S.H[2]); lit(S.H[4]); S.swap(2, 4);
      await beat(tok, 1200);
      say('結果仍是 complete binary tree', '<span class="ok">' + arrStr(S) + '</span>，O(log n)');
      await beat(tok, 3000);
    } };
  }

  // ─── ubLbvuWFDqM：交大彭文志 Lec15（Max heap insert／delete、heap sort、Huffman 入門） ───
  {
    const TB = '#e9dcc4', PINK = '#f4d9d0', TGOLD = '#f2c46d', TGREEN = '#cfe8dc';
    const BLUE = '#4b9ee2', ORANGE = '#dd8238', PURPLE = '#9b7ef4', STALE = '#c9bfae', KCOL = '#e55a9b';
    // 1-based heap 視圖：上面是樹、前面是 array（每個值 = 樹上方塊 n + 陣列格方塊 c）
    function HView(vals, o = {}) {
      const P = Object.assign({ cx: 0, top: 6.2, step: 1.35, width: 7, ax: 0, az: 2.6, dx: 0.9, cells: 6, col: BLUE }, o);
      const H = { P, slot: new Map(), tiles: [] };
      H.tp = (i) => heapPos(i, P.top, P.step, P.width).add(V(P.cx, 0, 0));
      H.cp = (i) => V(P.ax + (i - (P.cells + 1) / 2) * P.dx, 0.3, P.az);
      for (let i = 1; i <= P.cells; i++) {
        const t = new THREE.Mesh(new THREE.BoxGeometry(P.dx * 0.88, 0.08, 0.9), new THREE.MeshStandardMaterial({ color: TB, roughness: 1 }));
        t.position.copy(H.cp(i)).setY(0.04); t.receiveShadow = true; lab.world.add(t); H.tiles[i] = t;
        tag('[' + i + ']', 'idx', H.cp(i).x, 0, P.az + 0.75);
      }
      edgeLines(() => {
        const out = [];
        for (const [i, p] of H.slot) for (const c of [2 * i, 2 * i + 1]) { const q = H.slot.get(c); if (q && p.n && q.n) out.push([p.n.obj.position, q.n.obj.position]); }
        return out;
      });
      H.mk = (i, v, color = P.col, drop = 0) => {
        const n = lab.addBody(block(v, NODE, color)), c = lab.addBody(block(v, SMALL, color));
        const a = H.tp(i), b = H.cp(i);
        if (drop) { n.obj.position.copy(a).add(V(0, drop, 0)); lab.dropTo(n, a); c.obj.position.copy(b).add(V(0, drop, 0)); lab.dropTo(c, b); }
        else { n.obj.position.copy(a); n.target.copy(a); c.obj.position.copy(b); c.target.copy(b); }
        const p = { v, n, c, color }; H.slot.set(i, p); return p;
      };
      H.at = (i) => H.slot.get(i);
      H.mv = (p, i) => { lab.springTo(p.n, H.tp(i)); if (p.c) lab.springTo(p.c, H.cp(i)); };
      H.swap = (i, j) => { const p = H.at(i), q = H.at(j); H.mv(p, j); H.mv(q, i); H.slot.set(i, q); H.slot.set(j, p); };
      H.lit = (i, c) => { const p = H.at(i); if (p) { lit(p.n, c); if (p.c) lit(p.c, c); } };
      H.off = () => { for (const p of H.slot.values()) { lit(p.n); if (p.c) lit(p.c); } };
      H.tile = (i, c) => { if (H.tiles[i]) H.tiles[i].material.color.set(c || TB); };
      H.gone = (i, dir = V(0, 8, -3)) => { const p = H.at(i); if (!p) return; lab.flyAway(p.n, dir); if (p.c) lab.flyAway(p.c, dir); H.slot.delete(i); };
      H.drop = (p) => { kill(p.n); if (p.c) kill(p.c); };
      // copy 語意：heap[to] = heap[from]（from 保留，變灰表示「舊值，之後會被蓋掉」）
      H.copy = (from, to) => {
        const s = H.at(from), old = H.at(to);
        if (old) H.drop(old);
        const n = lab.addBody(block(s.v, NODE, s.color)), c = lab.addBody(block(s.v, SMALL, s.color));
        n.obj.position.copy(H.tp(from)); c.obj.position.copy(H.cp(from));
        const p = { v: s.v, n, c, color: s.color }; H.slot.set(to, p); H.mv(p, to);
        s.n.obj.material.color.set(STALE); s.c.obj.material.color.set(STALE);
        return p;
      };
      // 一個只在樹上方的自由方塊（x、k、item 用）
      H.free = (v, color, pos, drop = 0) => {
        const n = lab.addBody(block(v, NODE, color));
        n.obj.position.copy(pos).add(V(0, drop, 0)); if (drop) lab.dropTo(n, pos.clone()); else n.target.copy(pos);
        return { v, n, c: null, color };
      };
      // 自由方塊放進 slot i：樹上那顆移過去，array 格掉進一顆
      H.place = (p, i) => {
        const old = H.at(i); if (old) H.drop(old);
        lab.springTo(p.n, H.tp(i));
        p.c = lab.addBody(block(p.v, SMALL, p.color)); p.c.obj.position.copy(H.cp(i)).add(V(0, 2.5, 0)); lab.dropTo(p.c, H.cp(i));
        H.slot.set(i, p);
      };
      H.arr = (n) => { const a = []; for (let i = 1; i <= n; i++) a.push(H.at(i) ? H.at(i).v : '_'); return '[' + a.join(', ') + ']'; };
      vals.forEach((v, k) => { if (v !== null && v !== undefined) H.mk(k + 1, v, Array.isArray(o.colors) ? o.colors[k] : P.col); });
      return H;
    }
    function wire(pos) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(...NODE), new THREE.MeshBasicMaterial({ color: '#b08a4a', wireframe: true, transparent: true, opacity: 0.6 }));
      g.position.copy(pos); lab.world.add(g); return g;
    }
    function bar(color, w, d, x, z) { const m = lab.box(color, [w, 1, d]); m.scale.y = 0.001; m.position.set(x, 0, z); lab.world.add(m); return m; }
    function growBar(tok, m, h, ms) { const h0 = m.scale.y; return anim(tok, ms, (t) => { const v = h0 + (h - h0) * t; m.scale.y = v; m.position.y = v / 2; }); }
    const BASE = [20, 15, 2, 14, 10];

    // ── 1. Priority queue 各種實作比較 ──
    LECT['p15-pq-compare'] = { title: 'Priority queue 實作比較：insert vs delete', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.6, 13.5], [0, 2.2, 0]);
      const H = { '1': 0.5, 'log': 1.7, 'n': 3.8 };
      const rows = [
        ['unsorted array', '1', 'n', 'Θ(1)', 'Θ(n)'], ['unsorted list', '1', 'n', 'Θ(1)', 'Θ(n)'],
        ['sorted array', 'n', '1', 'O(n)', 'Θ(1)'], ['sorted list', 'n', '1', 'O(n)', 'Θ(1)'], ['max heap', 'log', 'log', 'O(log n)', 'O(log n)'],
      ];
      tag('藍 = insert', 'ptr', -3, 6.6); tag('橘 = delete max', 'ptr alt', 3, 6.6);
      const bs = rows.map((r, k) => {
        const x = -5.2 + k * 2.6;
        tag(r[0], 'ptr', x, 0, 1.3);
        return { x, bi: bar(BLUE, 0.8, 0.8, x - 0.45, 0), bd: bar(ORANGE, 0.8, 0.8, x + 0.45, 0) };
      });
      say('Priority queue：插入任意值、刪最大', '比較 5 種實作的 insert／delete cost');
      await beat(tok, 2600);
      const show = async (k) => {
        const r = rows[k], b = bs[k];
        await growBar(tok, b.bi, H[r[1]], 500); tag(r[3], 'idx', b.x - 0.45, H[r[1]] + 0.4);
        await growBar(tok, b.bd, H[r[2]], 500); tag(r[4], 'idx', b.x + 0.45, H[r[2]] + 0.4);
      };
      say('Sorted：insert 要維持排序 → 貴', '但最大值在一端，delete 很快');
      await show(2); await show(3);
      await beat(tok, 2600);
      say('Unsorted：看到就丟進去，insert 快', 'delete 要掃整個 array／list 找最大 → Θ(n)');
      await show(0); await show(1);
      await beat(tok, 2600);
      say('Max heap：兩種操作都不錯', 'insert、delete 皆 O(log n)（樹高）');
      await show(4);
      bs[4].bi.material.emissive.set(GOLD); bs[4].bd.material.emissive.set(GOLD);
      await beat(tok, 2800);
      say('沒有一種 list 能兩邊都快，heap 取得平衡', '<span class="ok">max heap：O(log n) / O(log n)</span>');
      await beat(tok, 3000);
    } };

    // ── 2. Max heap 定義與 array 表示 ──
    LECT['p15-maxheap-array'] = { title: 'Max heap：root 最大，用 array 存', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5, 13.5], [0, 3.4, 1]);
      const vals = [14, 12, 7, 10, 8, 6];
      const H = HView([], { width: 7.5, cells: 6 });
      say('Max heap 是 complete binary tree', '示意：課本 max heap 例（root 14）');
      for (let i = 1; i <= 6; i++) { H.mk(i, vals[i - 1], depthColor(Math.floor(Math.log2(i))), 4); await beat(tok, 380); }
      await beat(tok, 1200);
      H.lit(1, GOLD); H.tile(1, TGOLD);
      say('root 永遠放整棵樹最大的 element', 'root 14 ≥ 樹中所有值');
      await beat(tok, 2600);
      H.off(); H.tile(1);
      say('旁邊的 array：root 放 index 1', '依 level order 放 [1]..[6]，[0] 不用');
      for (let i = 1; i <= 6; i++) { H.lit(i, GOLD); await beat(tok, 300); H.lit(i); }
      await beat(tok, 900);
      for (const i of [5, 6]) {
        const p = i >> 1;
        H.lit(i, GOLD); H.tile(i, TGOLD); H.lit(p, GREEN); H.tile(p, TGREEN);
        const a = arrow(H.cp(i).clone().add(V(0, 0.5, 0)), H.cp(p).clone().add(V(0, 0.5, 0)), '#c08a1f');
        say('用 array 存：parent 一算就有', 'parent(' + i + ') = ⌊' + i + '/2⌋ = ' + p + '（' + H.at(i).v + ' 的 parent 是 ' + H.at(p).v + '）');
        await beat(tok, 2600);
        H.off(); H.tile(i); H.tile(p); kill(a);
      }
      const a2 = arrow(H.tp(5).clone().add(V(0.25, 0.35, 0)), H.tp(2).clone().add(V(0.35, -0.35, 0)), '#b04a4a', true);
      tag('parent 指標？', 'ptr', H.tp(5).x + 1.3, H.tp(5).y + 0.8);
      say('改用 node＋left／right pointer 也行', '但 insert／delete 要找 parent，需額外成本');
      await beat(tok, 3000);
      kill(a2);
      say('所以 heap 常用 array 實作', '<span class="ok">parent = ⌊i/2⌋，children = 2i、2i+1</span>');
      await beat(tok, 2800);
    } };

    // ── 3. Max heap insert：bottom-up ──
    async function insertDemo(tok, H, x, lead) {
      H.tile(6, TGOLD);
      say('insert ' + x + '：先放在最後一個位置後面', lead);
      H.mk(6, x, ORANGE, 4);
      await beat(tok, 1500);
      H.tile(6);
      let i = 6;
      while (i > 1) {
        const p = i >> 1, a = H.at(i).v, b = H.at(p).v;
        H.lit(i, GOLD); H.lit(p, GOLD);
        if (a > b) {
          say(a + ' 比 parent ' + b + ' 大 → 往上爬', 'swap：' + a + ' 上去、' + b + ' 下來');
          await beat(tok, 1500);
          H.off(); H.swap(i, p); i = p;
          await beat(tok, 1000);
        } else {
          say('parent ' + b + ' 比 ' + a + ' 大 → 停', '');
          await beat(tok, 1500);
          break;
        }
      }
      H.off(); H.lit(i, GREEN);
      say(i === 1 ? x + ' 到達 root → 停' : '完成 insert ' + x, '<span class="ok">' + H.arr(6) + '</span>');
      await beat(tok, 2200);
    }
    LECT['p15-heap-insert'] = { title: 'Max heap insert：放最後、往上爬', play: async (tok) => {
      const setup = () => { fresh(); lab.frameCamera([0, 5, 13.5], [0, 3.4, 1]); return HView(BASE, { width: 7.5, cells: 6 }); };
      let H = setup();
      say('Max heap [20, 15, 2, 14, 10]', '1..5 已用，新元素放 6 號位置');
      await beat(tok, 2600);
      await insertDemo(tok, H, 1, '6 號 = 2 的 left child');
      H = setup(); await insertDemo(tok, H, 5, '每次都從原本的 heap 開始');
      H = setup(); await insertDemo(tok, H, 21, '一路跟 parent 比（bottom-up）');
      say('insert：放 heap 最後一個位置，再跟 parent 比', '比較次數 ≤ 樹高 → O(log n)');
      await beat(tok, 2800);
    } };

    // ── 4. Insert 程式碼（copy 而不是 swap）──
    LECT['p15-heap-insert-code'] = { title: 'insert 程式碼：parent 往下 copy', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.8, 13.5], [0, 3.4, 0.8]);
      const cd = code([
        'void insert(element x) {',
        '  if (n == MAX_SIZE-1) {',
        '    heap is full; exit; }',
        '  for (i = ++n; i != 1; i /= 2) {',
        '    if (x.key <= heap[i/2].key) break;',
        '    heap[i] = heap[i/2];',
        '  }',
        '  heap[i] = x;',
        '}'], -3.5, 6.6, 0.5);
      const H = HView(BASE, { cx: 3.6, width: 5, ax: 3.5, dx: 0.72, cells: 6, top: 6.3 });
      const iT = tag('', 'ptr alt', 0, 1.0, 2.6);
      const setI = (i) => { iT.position.copy(H.cp(i)).setY(1.0); setTag(iT, 'i = ' + i); };
      const xPos = (i) => H.tp(i).clone().add(V(0.95, 0.35, 0));
      cd.hl(1);
      say('Array 有大小上限：滿了就 heap is full', 'n = 5，還沒滿');
      await beat(tok, 2400);
      cd.hl(3); setI(6); H.tile(6, TGOLD);
      const ghostSlot = wire(H.tp(6));
      const x = H.free(21, ORANGE, xPos(6), 3);
      const xT = tag('x', 'ptr alt', xPos(6).x, xPos(6).y + 0.7);
      const moveX = (i) => { lab.springTo(x.n, xPos(i)); xT.position.copy(xPos(i)).add(V(0, 0.7, 0)); };
      say('i = ++n = 6：新的最後位置', 'n 記錄 heap 目前有幾個元素');
      await beat(tok, 2400);
      cd.hl(4); H.lit(3, GOLD); lit(x.n, GOLD);
      say('x.key 21 > heap[3] = 2', '沒有 break');
      await beat(tok, 2000);
      cd.hl(5); H.off(); lit(x.n); kill(ghostSlot); H.tile(6);
      H.copy(3, 6);
      say('heap[6] = heap[3]：parent 2 copy 下來', H.arr(6));
      await beat(tok, 2200);
      cd.hl(3); setI(3); moveX(3);
      say('i /= 2 → i = 3：往上爬一層', '');
      await beat(tok, 1600);
      cd.hl(4); H.lit(1, GOLD); lit(x.n, GOLD);
      say('x.key 21 > heap[1] = 20', '還是沒有 break');
      await beat(tok, 1900);
      cd.hl(5); H.off(); lit(x.n);
      H.copy(1, 3);
      say('heap[3] = heap[1]：20 copy 下來', H.arr(6));
      await beat(tok, 2200);
      cd.hl(3); setI(1); moveX(1);
      say('i = 1：已到 root，跳出迴圈', 'i != 1 不成立');
      await beat(tok, 1800);
      cd.hl(7);
      kill(xT); H.place(x, 1);
      say('heap[1] = x：最後才把 x 放進去', '<span class="ok">' + H.arr(6) + '</span>');
      await beat(tok, 2200);
      cd.hl(-1);
      say('不是每層 swap：parent 往下 copy，x 只寫一次', '字幕的「heap 2i = heap i」應為 heap[i] = heap[i/2]');
      await beat(tok, 3000);
    } };

    // ── 5. Delete（概念 / 逐步）──
    LECT['p15-heap-delete'] = { title: 'Max heap delete：最後元素暫存 k，往下落', play: async (tok) => {
      const steps = ((ctx.params || {}).phase) === 'steps';
      fresh();
      lab.frameCamera([0, 5, 13.5], [0, 3.4, 1]);
      const H = HView(BASE, { width: 7.5, cells: 5 });
      const kPos = V(-5.2, 5.6, 0);
      const kTag = tag('暫存 k', 'ptr', kPos.x, kPos.y + 0.75);
      let k, hole;
      if (!steps) {
        say('Max heap [20, 15, 2, 14, 10]', '分別存在 array[1]..[5]');
        await beat(tok, 2600);
        H.lit(1, GOLD);
        say('deleteMax：把最大的 root 20 丟出來', 'root 位置變空');
        await beat(tok, 1600);
        H.gone(1, V(3, 9, -2)); hole = wire(H.tp(1));
        await beat(tok, 1600);
        const up = arrow(V(-4.2, 2.2, 0), V(-4.2, 5.4, 0), BLUE), dn = arrow(V(4.2, 5.4, 0), V(4.2, 2.2, 0), ORANGE);
        const t1 = tag('insert：bottom-up', 'ptr', -4.2, 1.7), t2 = tag('delete：top-down', 'ptr alt', 4.2, 1.7);
        say('insert 往上爬，delete 往下落', 'insert：bottom-up；delete：top-down');
        await beat(tok, 2600);
        kill(up); kill(dn); kill(t1); kill(t2);
        H.tile(5, PINK);
        say('剩 4 個元素，只需要 array[1]..[4]', '最後一格 [5] 要收回');
        await beat(tok, 2400);
        const p5 = H.at(5); H.slot.delete(5); kill(p5.c); p5.c = null;
        lab.springTo(p5.n, kPos); k = p5; lit(k.n, GOLD);
        say('把最後的 10 拿出來：k = 10', '像打彈珠一樣從 root 往下走');
        await beat(tok, 2600);
        lit(k.n);
        say('先暫存在 k，不直接放進 root', '下面可能有比 10 大的 child');
        await beat(tok, 3000);
        return;
      }
      // phase: steps —— 從「root 空、k = 10、n = 4」開始
      H.gone(1, V(3, 9, -2)); hole = wire(H.tp(1));
      const p5 = H.at(5); H.slot.delete(5); kill(p5.c); p5.c = null; lab.springTo(p5.n, kPos); k = p5; k.n.obj.material.color.set(KCOL);
      H.tile(5, PINK);
      say('root 空了，k = 10，n = 4', '從 root 開始往下決定 k 的位置');
      await beat(tok, 2600);
      H.lit(2, GOLD); H.lit(3, GOLD);
      say('root 的 child：15 和 2', '先挑較大的 child：15');
      await beat(tok, 2200);
      H.lit(3); lit(k.n, GOLD);
      say('較大的 child 15 跟 k = 10 比', '15 > 10 → 15 往上搬到 root');
      await beat(tok, 2200);
      H.off(); lit(k.n);
      const a = H.at(2); H.slot.delete(2); H.mv(a, 1); H.slot.set(1, a); hole.position.copy(H.tp(2));
      await beat(tok, 1600);
      H.lit(4, GOLD); lit(k.n, GOLD);
      say('洞落到 [2]：它只有一個 child 14', '14 > 10 → 14 往上爬');
      await beat(tok, 2400);
      H.off(); lit(k.n);
      const b = H.at(4); H.slot.delete(4); H.mv(b, 2); H.slot.set(2, b); hole.position.copy(H.tp(4));
      await beat(tok, 1600);
      say('洞落到 [4]：沒有 child 了', '10 就放在這裡');
      await beat(tok, 1600);
      kill(hole); kill(kTag); H.place(k, 4);
      await beat(tok, 1400);
      H.lit(4, GREEN);
      say('結果：1 放 15、2 放 14、3 放 2、4 放 10', '<span class="ok">' + H.arr(4) + '</span>');
      await beat(tok, 2600);
      say('top-down 何時停？', '到 leaf，或 k ≥ 較大的 child');
      await beat(tok, 2800);
    } };

    // ── 6. deleteMax 程式碼（解說 / trace）──
    LECT['p15-heap-delete-code'] = { title: 'deleteMax 程式碼與 trace', play: async (tok) => {
      const trace = ((ctx.params || {}).phase) === 'trace';
      fresh();
      lab.frameCamera([0, 4.8, 13.5], [0, 3.4, 0.8]);
      const cd = code([
        'element delete_max() {',
        '  if (!n) { heap is empty; exit; }',
        '  item = heap[1];',
        '  k = heap[n--];',
        '  for (i = 1, j = 2; j <= n; ) {',
        '    if (j<n && heap[j].key<heap[j+1].key) j++;',
        '    if (k.key >= heap[j].key) break;',
        '    heap[i] = heap[j];',
        '    i = j; j *= 2;',
        '  }',
        '  heap[i] = k;',
        '  return item;',
        '}'], -3.4, 6.9, 0.48);
      const H = HView(BASE, { cx: 3.9, width: 4.6, ax: 3.9, dx: 0.72, cells: 5, top: 6.1 });
      const kPos = V(1.5, 6.5, 0), itPos = V(6.2, 6.6, 0);
      const iT = tag('', 'ptr alt', 0, 1.0, 2.6), jT = tag('', 'ptr', 0, 1.0, 2.6);
      const showIJ = (i, j, n) => {
        for (let s = 1; s <= 5; s++) H.tile(s, s > n ? PINK : s === i ? TGOLD : s === j || s === j + 1 ? TGREEN : TB);
        iT.position.copy(H.cp(i)).setY(1.05); setTag(iT, 'i=' + i);
        if (j <= 5) { jT.visible = true; jT.position.copy(H.cp(j)).setY(1.55); setTag(jT, 'j=' + j); } else jT.visible = false;
      };
      const slow = trace ? 0.75 : 1;
      cd.hl(1);
      say('先檢查 n：n == 0 表示 heap is empty', 'n = 5，不是 empty');
      await beat(tok, 2200 * slow);
      cd.hl(2);
      H.free('20', PURPLE, itPos, 0); tag('item', 'ptr', itPos.x, itPos.y + 0.75); H.at(1).n.obj.material.color.set(STALE); H.at(1).c.obj.material.color.set(STALE);
      say('item = heap[1]：要 return 的最大值', 'max heap 的 array[1] 最大');
      await beat(tok, 2400 * slow);
      cd.hl(3);
      const p5 = H.at(5); H.slot.delete(5); kill(p5.c); p5.c = null; lab.springTo(p5.n, kPos); p5.n.obj.material.color.set(KCOL);
      tag('k', 'ptr', kPos.x, kPos.y + 0.75);
      H.tile(5, PINK);
      say('k = heap[n--]：k = 10，n 從 5 變 4', 'array 只剩 [1]..[4]');
      await beat(tok, 2600 * slow);
      let i = 1, j = 2; const n = 4;
      cd.hl(4); showIJ(i, j, n);
      say('i 是待決定的位置，j、j+1 是 children', 'i = 1，j = 2（j+1 = 3），條件 j <= n');
      await beat(tok, 2600 * slow);
      let round = 0;
      while (j <= n) {
        round++;
        cd.hl(5);
        const hasR = j < n, r = hasR && H.at(j).v < H.at(j + 1).v;
        H.lit(j, GOLD); if (hasR) H.lit(j + 1, GOLD);
        const why = !hasR ? 'j == n：只有一個 child ' + H.at(j).v : r ? '右 child 較大 → j++' : 'heap[' + j + '] = ' + H.at(j).v + ' ≥ heap[' + (j + 1) + '] = ' + H.at(j + 1).v + ' → j 不動';
        if (r) j++;
        say(why,
          trace ? '第 ' + round + ' 輪：i = ' + i + '，j = ' + j : 'j 要指向較大的 child（必須先確認 j < n）');
        await beat(tok, 2400 * slow);
        H.off(); showIJ(i, j, n);
        cd.hl(6); H.lit(j, GOLD); lit(p5.n, GOLD);
        say('k = 10 ≥ ' + H.at(j).v + '？ 不是 → 不 break', '若 k 比最大的 child 大就停止');
        await beat(tok, 2200 * slow);
        H.off(); lit(p5.n);
        cd.hl(7);
        H.copy(j, i);
        say('heap[' + i + '] = heap[' + j + ']：child 往上 copy', H.arr(4) + (trace ? '' : '（' + j + ' 號暫時是舊值）'));
        await beat(tok, 2600 * slow);
        cd.hl(8); i = j; j *= 2; showIJ(i, j, n);
        say('i = j、j *= 2：往下一層', 'i = ' + i + '，j = ' + j);
        await beat(tok, 2000 * slow);
        if (!trace) break;
      }
      if (!trace) {
        cd.hl(-1);
        say('同樣的步驟重複，直到 j > n 或 break', 'i 是要填的洞，j 是它較大的 child');
        await beat(tok, 3000);
        return;
      }
      cd.hl(4);
      say('j = ' + j + ' > n = 4 → 迴圈結束', '');
      await beat(tok, 1800);
      cd.hl(10); H.place(p5, i); lit(p5.n, GREEN);
      say('heap[' + i + '] = k', '<span class="ok">' + H.arr(4) + '</span>');
      await beat(tok, 2200);
      cd.hl(11);
      say('return item（20）', 'root 拿掉、最後元素從上往下找位置');
      await beat(tok, 2800);
    } };

    // ── 7. Heap 操作的複雜度 ──
    LECT['p15-heap-cost'] = { title: 'Heap 的 cost：deleteMax vs 刪任意元素', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5, 13.5], [0, 3.4, 1]);
      const H = HView(BASE, { width: 6.5, cells: 5, cx: -1.2, ax: -1.2 });
      say('deleteMax：拿掉 root 後調整 tree', '最多走一條 root 到 leaf 的路徑');
      await beat(tok, 2200);
      for (const i of [1, 2, 4]) { H.lit(i, GOLD); await beat(tok, 600); }
      const hT = tag('樹高 ≈ log₂ n', 'ptr alt', -5.4, 4.8);
      say('cost = 樹的高度', '<span class="ok">deleteMax：O(log n)</span>');
      await beat(tok, 2400);
      H.off(); kill(hT);
      say('那要刪除（或找）任意元素，例如 10 呢？', 'heap 只保證 root 最大，其他位置沒有順序');
      await beat(tok, 2600);
      const cur = makeCursor(); cur.obj.scale.set(0.7, 0.7, 0.7);
      for (let i = 1; i <= 5; i++) {
        cursorTo(cur, H.cp(i).clone().setY(0.62)); H.lit(i, i === 5 ? GREEN : GOLD); H.tile(i, i === 5 ? TGREEN : TGOLD);
        say('scan array：第 ' + i + ' 格 = ' + H.at(i).v, i === 5 ? '找到 10' : '不是 10，繼續');
        await beat(tok, 750);
        if (i < 5) H.lit(i);
      }
      say('只能 scan 整個 array', '找到：最壞 O(n)');
      await beat(tok, 2200);
      cur.obj.visible = false;
      const b1 = bar(ORANGE, 0.9, 0.9, 4.6, 0.5), b2 = bar(BLUE, 0.9, 0.9, 5.9, 0.5);
      await growBar(tok, b1, 4.2, 600); tag('scan n', 'idx', 4.6, 4.7, 0.5);
      await growBar(tok, b2, 1.2, 400); tag('調整 log n', 'idx', 5.9, 1.7, 0.5);
      say('刪任意元素 = 先找 O(n) + 再調整 O(log n)', 'n + log n');
      await beat(tok, 2600);
      b1.material.emissive.set(GOLD);
      say('bottleneck 在 scan 那段', '<span class="ok">n + log n = O(n)</span>（老師口誤說 log n dominate）');
      await beat(tok, 3000);
    } };

    // ── 8. Heap sort 概念（min heap：insert n 次、delete n 次）──
    LECT['p15-heap-sort'] = { title: 'Heap sort：建 min heap，再 delete n 次', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5, 13.5], [0, 3.2, 1.4]);
      const H = HView([], { width: 7, cells: 5, col: PURPLE, top: 6.3 });
      const nums = [5, 3, 8, 1, 4];
      const inT = tag('待排序：' + nums.join(' '), 'ptr', -4.8, 7.2);
      tag('輸出', 'ptr', -5.2, 0.35, 4.2);
      say('Phase 1：n 個數字逐一 insert 進 min heap', '示意資料 [5, 3, 8, 1, 4]');
      await beat(tok, 2200);
      let n = 0;
      for (const v of nums) {
        n++; H.mk(n, v, PURPLE, 3.5);
        await beat(tok, 650);
        let i = n;
        while (i > 1 && H.at(i).v < H.at(i >> 1).v) { H.swap(i, i >> 1); i >>= 1; await beat(tok, 550); }
        say('insert ' + v + '：bottom-up，小的往上', H.arr(n));
        await beat(tok, 500);
      }
      setTag(inT, 'min heap 建好（insert n 次）');
      say('min heap：root 最小', H.arr(5));
      await beat(tok, 2000);
      say('Phase 2：delete n 次，輸出由小到大', '每次拿 root，最後元素放上去再 top-down');
      await beat(tok, 1600);
      const out = [];
      for (let m = 5; m >= 1; m--) {
        const r = H.at(1); H.slot.delete(1);
        out.push(r.v);
        lab.springTo(r.n, V(-3.6 + (out.length - 1) * 1.0, 0.35, 4.2)); kill(r.c);
        if (m > 1) {
          const last = H.at(m); H.slot.delete(m); H.slot.set(1, last); H.mv(last, 1);
          H.tile(m, PINK);
          await beat(tok, 600);
          let i = 1;
          for (;;) {
            let c = 2 * i; if (c > m - 1) break;
            if (c + 1 <= m - 1 && H.at(c + 1).v < H.at(c).v) c++;
            if (H.at(i).v <= H.at(c).v) break;
            H.swap(i, c); i = c; await beat(tok, 550);
          }
        } else H.tile(1, PINK);
        say('delete → 輸出 ' + r.v, '輸出：' + out.join(' '));
        await beat(tok, 700);
      }
      say('insert n 次＋delete n 次', '每次 O(log n) → <span class="ok">總共 O(n log n)</span>');
      await beat(tok, 2600);
      say('Heap 三原則', 'root 最大（max）／最小（min）；insert 放最後 bottom-up；delete 最後元素提到 root 再 top-down');
      await beat(tok, 3200);
    } };

    // ── 9. ASCII（fixed length）與 Huffman 的頻率概念 ──
    const SENT = 'Eerie eyes seen near lake.';
    LECT['p15-huffman-freq'] = { title: 'Huffman：出現越多、碼越短', play: async (tok) => {
      const ascii = ((ctx.params || {}).phase) === 'ascii';
      fresh();
      lab.frameCamera([0, 4.6, 13.5], [0, 3, 0.6]);
      if (ascii) {
        const w = 'Eerie';
        const cs = [...w].map((ch, k) => {
          const x = -4 + k * 2;
          const b = cube(ch, ch === 'E' ? ORANGE : BLUE, NODE, x, 5.2, 0, 3);
          const bits = ch.charCodeAt(0).toString(2).padStart(8, '0');
          const l = tag(bits, 'idx', x, 4.3); Object.assign(l.element.style, MONO);
          return { b, l };
        });
        say('ASCII：每個字元對到一個固定的 code', 'fixed length coding');
        await beat(tok, 3400);
        lit(cs[0].b, GOLD); lit(cs[1].b, GOLD);
        say('大寫 E 和小寫 e：code 不同', 'E = 01000101，e = 01100101');
        await beat(tok, 2800);
        lit(cs[0].b); lit(cs[1].b);
        say('但 code length 都一樣：8 bits', '不管字元出現幾次，長度都相同');
        await beat(tok, 3200);
        ghost('#4b9ee2', -3, 1.9, 4.2, 2.6); ghost('#dd8238', 3, 1.9, 4.2, 2.6);
        tag('binary tree', 'ptr', -3, 3.5); tag('priority queue（heap）', 'ptr alt', 3, 3.5);
        cube('', '#2fc092', SMALL, -3, 2.6); cube('', '#4b9ee2', SMALL, -3.9, 1.3); cube('', '#4b9ee2', SMALL, -2.1, 1.3);
        seg(V(-3, 2.35, 0), V(-3.9, 1.55, 0), '#7a6a52'); seg(V(-3, 2.35, 0), V(-2.1, 1.55, 0), '#7a6a52');
        [1, 2, 2, 4].forEach((v, k) => cube(v, PURPLE, SMALL, 1.8 + k * 0.8, 1.3, 0, 2));
        say('Huffman code 會用到兩個技巧', '建一棵 binary tree ＋ 用 priority queue（heap）');
        await beat(tok, 3200);
        say('作業：Huffman 的編碼與解碼', '下週公布');
        await beat(tok, 3000);
        return;
      }
      const freq = new Map(); for (const ch of SENT) freq.set(ch, (freq.get(ch) || 0) + 1);
      const keys = [...freq.keys()].sort((a, b) => freq.get(b) - freq.get(a) || SENT.indexOf(a) - SENT.indexOf(b));
      const colX = (ch) => -5.5 + keys.indexOf(ch) * 1.0;
      const show = (ch) => (ch === ' ' ? '␣' : ch);
      say('1952 年 David Huffman：碼長最少', '例句（推測）：' + SENT + '（26 個字元）');
      const bs = [...SENT].map((ch, k) => cube(show(ch), ch === 'e' ? ORANGE : ch === ' ' ? PURPLE : BLUE, [0.42, 0.42, 0.42], -6.25 + k * 0.5, 6.6, 0, 1.5));
      await beat(tok, 2800);
      keys.forEach((ch) => tag(show(ch), 'ptr', colX(ch), 0, 1.0));
      say('統計每個「字元」出現幾次', '不是單字；空白和句點也要算');
      const cnt = new Map();
      for (let k = 0; k < bs.length; k++) {
        const ch = SENT[k], c = cnt.get(ch) || 0; cnt.set(ch, c + 1);
        lab.springTo(bs[k], V(colX(ch), 0.25 + c * 0.45, 0));
        await beat(tok, 200);
      }
      keys.forEach((ch) => tag(String(freq.get(ch)), 'idx', colX(ch), 0.25 + freq.get(ch) * 0.45 + 0.1));
      await beat(tok, 1200);
      bs.forEach((b, k) => SENT[k] === 'e' && lit(b, GOLD));
      say('小寫 e 出現最多：8 次', '大寫 E 只有 1 次（不同字元）');
      await beat(tok, 2600);
      bs.forEach((b, k) => lit(b, SENT[k] === ' ' ? GOLD : null));
      say('空白（space）出現 4 次，也要編碼', '句點也要編碼');
      await beat(tok, 2600);
      bs.forEach((b) => lit(b));
      say('ASCII：不管出現幾次，每字都 8 bits', 'Huffman：frequency 越高 → 編碼越短');
      await beat(tok, 3000);
    } };

    // ── 10. Code table、編碼解碼與壓縮比 ──
    LECT['p15-huffman-compress'] = { title: 'Huffman tree、code table 與 208 → 73 bits', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.4, 13.5], [0, 3.6, 0]);
      const freq = new Map(); for (const ch of SENT) freq.set(ch, (freq.get(ch) || 0) + 1);
      let id = 0;
      const pq = [...freq.keys()].sort((a, b) => freq.get(a) - freq.get(b) || SENT.indexOf(a) - SENT.indexOf(b))
        .map((ch) => ({ label: ch === ' ' ? '␣' : ch, ch, w: freq.get(ch), kids: [], id: id++ }));
      while (pq.length > 1) {
        pq.sort((a, b) => a.w - b.w || a.id - b.id);
        const a = pq.shift(), b = pq.shift();
        pq.push({ label: String(a.w + b.w), w: a.w + b.w, kids: [a, b], id: id++ });
      }
      const root = pq[0];
      const codes = new Map();
      (function walk(n, s) { if (!n.kids.length) { codes.set(n.ch, s || '0'); n.code = s; return; } walk(n.kids[0], s + '0'); walk(n.kids[1], s + '1'); })(root, '');
      let maxD = 0; (function d(n, k) { maxD = Math.max(maxD, k); n.kids.forEach((c) => d(c, k + 1)); })(root, 0);
      const step = Math.min(1.1, 5.2 / maxD);
      layoutG(root, { width: 11, topY: 6.8, step });
      const order = []; (function lv() { const q = [root]; while (q.length) { const n = q.shift(); order.push(n); q.push(...n.kids); } })();
      edgeLines(() => { const out = []; for (const n of gAll(root)) for (const k of n.kids) if (n.body && k.body) out.push([n.body.obj.position, k.body.obj.position]); return out; }, 0.22);
      say('依 frequency 建出 Huffman tree', '葉子 = 字元，內部節點 = 次數和');
      for (const n of order) {
        const b = lab.addBody(block(n.label, [0.62, 0.44, 0.6], n.kids.length ? '#c9b48e' : n.ch === 'e' ? ORANGE : BLUE));
        b.obj.position.copy(n.pos).add(V(0, 3, 0)); lab.dropTo(b, n.pos.clone()); n.body = b;
        await beat(tok, 150);
      }
      await beat(tok, 1200);
      say('左 0、右 1：root 到葉子的路徑就是 code', 'code table（碼書）');
      const cT = [];
      for (const n of gAll(root)) if (!n.kids.length) { const l = tag(n.code, 'idx', n.pos.x, n.pos.y - 0.5); Object.assign(l.element.style, { fontSize: '10px' }); cT.push(l); }
      await beat(tok, 2600);
      const leaf = (ch) => gAll(root).find((n) => n.ch === ch);
      lit(leaf('e').body, GOLD);
      say('e 出現 8 次 → code 最短：' + codes.get('e'), '出現 1 次的字元 → code 最長');
      await beat(tok, 2400);
      lit(leaf('e').body);
      const word = 'Eerie';
      const enc = [...word].map((c) => codes.get(c)).join(' ');
      const eT = tag('', 'ptr alt', 0, 0.3, 2.6); Object.assign(eT.element.style, MONO);
      for (let k = 1; k <= word.length; k++) {
        lit(leaf(word[k - 1]).body, GOLD);
        setTag(eT, word.slice(0, k) + ' → ' + [...word.slice(0, k)].map((c) => codes.get(c)).join(' '));
        say('編碼：照 code table 把字元換成 bits', '前 5 個字元示範');
        await beat(tok, 650);
        lit(leaf(word[k - 1]).body);
      }
      await beat(tok, 1000);
      const cur = makeCursor(); cur.obj.scale.set(0.7, 0.7, 0.7);
      const bitsE = codes.get('E');
      say('解碼：從 root 依 bit 走到葉子', bitsE + ' → E，再回到 root 繼續');
      let n = root; cursorTo(cur, n.pos);
      await beat(tok, 700);
      for (const b of bitsE) { n = n.kids[Number(b)]; cursorTo(cur, n.pos); await beat(tok, 550); }
      lit(n.body, GREEN);
      await beat(tok, 1200);
      cur.obj.visible = false;
      for (const x of gAll(root)) lab.flyAway(x.body, V(0, 8, -4));
      kill(eT); cT.forEach(kill);
      await beat(tok, 800);
      const b1 = bar('#8fa3b8', 1.4, 1.2, -1.6, 0), b2 = bar(ORANGE, 1.4, 1.2, 1.6, 0);
      tag('ASCII', 'ptr', -1.6, 0, 1.3); tag('Huffman', 'ptr alt', 1.6, 0, 1.3);
      say('整句 26 個字元，每字 8 bits', 'ASCII：26 × 8 = 208 bits');
      await growBar(tok, b1, 208 / 36, 900); tag('208 bits', 'idx', -1.6, 208 / 36 + 0.4);
      await beat(tok, 1400);
      say('用 Huffman code（投影片數字）', '只要 73 bits');
      await growBar(tok, b2, 73 / 36, 700); tag('73 bits', 'idx', 1.6, 73 / 36 + 0.4);
      await beat(tok, 2000);
      say('208 → 73 bits：達成 compression', '註：依此頻率表重算最佳為 84 bits，仍遠小於 208');
      await beat(tok, 3000);
    } };
  }

  // ─── Rk3aap_HZHU：交大彭文志 Lec16（Huffman 2/2、BST、winner/loser tree、forest、disjoint sets） ───
  {
    // ── Huffman：課本例句 "Eerie eyes seen near lake."（␣ = space） ──
    const HF = { E: 1, e: 8, r: 2, i: 1, '␣': 4, y: 1, s: 2, n: 2, a: 2, l: 1, k: 1, '.': 1 };
    const HORDER = ['E', 'e', 'r', 'i', '␣', 'y', 's', 'n', 'a', 'l', 'k', '.'];
    const SENT = [...'Eerie eyes seen near lake.'.replace(/ /g, '␣')];
    const LEAFC = '#2fc092', INC = '#c9a86a', TOKC = '#8fa3b8';
    const LSZ = [0.72, 0.55, 0.72];
    const tl = (n) => (n.ch ? n.ch + n.f : String(n.f));
    // 依 freq 由小到大的 priority queue（同 freq 時新節點排在後面），回傳每一次合併
    function huffRun(order) {
      let pq = order.map((c) => ({ ch: c, f: HF[c], label: c, kids: [] })).sort((a, b) => a.f - b.f);
      const merges = [];
      while (pq.length > 1) {
        const a = pq.shift(), b = pq.shift();
        const z = { f: a.f + b.f, label: String(a.f + b.f), kids: [a, b] };
        let i = pq.findIndex((x) => x.f > z.f); if (i < 0) i = pq.length;
        pq.splice(i, 0, z);
        merges.push({ a, b, z, pq: pq.slice() });
      }
      return { root: pq[0], merges };
    }
    function huffCodes(root) { const m = {}; (function w(n, p) { n.code = p; if (!n.kids.length) m[n.ch] = p; else { w(n.kids[0], p + '0'); w(n.kids[1], p + '1'); } })(root, ''); return m; }
    // 整棵 Huffman tree：葉子綠、內部節點金；可標 0/1
    function hufShow(root, o, bits) {
      layoutG(root, Object.assign({ width: 11.2, topY: 6.8, step: 1.32 }, o || {}));
      for (const n of gAll(root)) {
        const b = lab.addBody(block(n.ch ? n.ch : n.label, LSZ, n.ch ? LEAFC : INC));
        b.obj.position.copy(n.pos); b.target.copy(n.pos); n.body = b;
        if (n.ch) tag(String(n.f), 'idx', n.pos.x, n.pos.y - 0.5, 0.4);
      }
      edgeLines(() => { const out = []; for (const n of gAll(root)) for (const k of n.kids) if (n.body && k.body) out.push([n.body.obj.position, k.body.obj.position]); return out; }, 0.27);
      if (bits) for (const n of gAll(root)) n.kids.forEach((k, j) => tag(String(j), 'ptr', (n.pos.x + k.pos.x) / 2 + (j ? 0.22 : -0.22), (n.pos.y + k.pos.y) / 2 + 0.1, 0.2));
      return root;
    }
    const cursorAt = (cur, p) => cursorTo(cur, p.clone().add(V(0, -0.02, 0)));

    // #0 統計頻率
    LECT['p16-huff-freq'] = { title: 'Huffman：先統計字元頻率', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5.4, 13.5], [0, 3.0, 0]);
      tag('"Eerie eyes seen near lake."（含 space、句點共 26 字元）', 'ptr', 0, 7.2);
      const sx = (k) => -5.6 + k * 0.45;
      const cs = SENT.map((c, k) => cube(c, TOKC, [0.4, 0.42, 0.4], sx(k), 6.3));
      const cx = (c) => -5.2 + HORDER.indexOf(c) * 0.95;
      const cnt = {}, ct = {};
      HORDER.forEach((c) => { cnt[c] = 0; tag(c === '␣' ? 'sp' : c, 'ptr', cx(c), 0.05, 1.7); ct[c] = tag('0', 'idx', cx(c), 0.05, 2.5); });
      say('Huffman：binary tree + PQ 的應用', 'phase 1：開檔、scan 每個字元、統計 frequency');
      await beat(tok, 2600);
      say('逐字 scan：每看到一次就 +1', 'space、句點也要算（存檔時一樣要編碼）');
      for (let k = 0; k < SENT.length; k++) {
        const c = SENT[k];
        lit(cs[k], GOLD); cs[k].obj.position.y = 6.55;
        const b = lab.addBody(block('', [0.5, 0.26, 0.5], c === 'e' ? '#e55a9b' : c === 'E' ? '#4b9ee2' : LEAFC));
        b.obj.position.set(sx(k), 6.0, 0);
        lab.springTo(b, V(cx(c), 0.15 + cnt[c] * 0.28, 0.6));
        cnt[c]++; setTag(ct[c], String(cnt[c]));
        await beat(tok, 430);
        lit(cs[k]); cs[k].obj.position.y = 6.3;
      }
      say('小寫 e 出現 8 次、大寫 E 只有 1 次', 'E1 e8 r2 i1 sp4 y1 s2 n2 a2 l1 k1 .1 → 合計 26');
      await beat(tok, 3400);
      say('frequency 越高的字元，碼要越短', '下一步（phase 2）：用 min heap 建 Huffman tree');
      await beat(tok, 3000);
    } };

    // #1 Huffman node 與 bottom-up 原則
    LECT['p16-huff-node'] = { title: 'Huffman node 與 bottom-up 合併', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5.2, 13.5], [0, 3.2, 0.6]);
      const F = ['ch', 'freq', 'left', 'right'], FV = ['E', '1', 'NULL', 'NULL'];
      tag('HuffmanNode', 'ptr alt', -4.2, 7.3);
      const fc = F.map((f, j) => { tag(f, 'idx', -5.6 + j * 1.0, 6.9); return cube(FV[j], j < 2 ? LEAFC : '#b9a582', [0.95, 0.55, 0.7], -5.6 + j * 1.0, 6.3); });
      say('Huffman node：字元、frequency、左右指標', 'ch | freq | leftChild | rightChild');
      await beat(tok, 3000);
      const toks = HORDER.slice().sort((a, b) => HF[a] - HF[b]).map((c) => ({ n: { ch: c, f: HF[c] } }));
      const px = (k) => -5.2 + k * 0.95;
      tag('MyQueue（min heap，依 freq 排）', 'ptr', 0, 0.05, 3.2);
      toks.forEach((t, k) => { t.b = cube(tl(t.n), TOKC, [0.8, 0.5, 0.7], px(k), 0.3, 2.2, 3); });
      await beat(tok, 900);
      say('priority queue 用 min heap：最小的在最前面', '每次 DeleteMin 都拿到目前 frequency 最小者');
      await beat(tok, 2800);
      const MX = [-1.2, 1.6, 4.4];
      for (let m = 0; m < 3; m++) {
        const a = toks.shift(), b = toks.shift();
        lit(a.b, GOLD); lit(b.b, GOLD);
        say('取出最小的兩個：' + a.n.ch + '、' + b.n.ch, a.n.ch + '.freq + ' + b.n.ch + '.freq = ' + (a.n.f + b.n.f));
        await beat(tok, 900);
        lab.springTo(a.b, V(MX[m] - 0.6, 2.4, 0)); lab.springTo(b.b, V(MX[m] + 0.6, 2.4, 0));
        toks.forEach((t, k) => lab.springTo(t.b, V(px(k), 0.3, 2.2)));
        await beat(tok, 700);
        const z = cube(String(a.n.f + b.n.f), INC, [0.8, 0.55, 0.7], MX[m], 3.8, 0, 3);
        seg(V(MX[m], 3.5, 0), V(MX[m] - 0.6, 2.7, 0), '#7a6a52'); seg(V(MX[m], 3.5, 0), V(MX[m] + 0.6, 2.7, 0), '#7a6a52');
        lit(a.b); lit(b.b);
        if (m === 0) { fc.forEach((c, j) => lit(c, j ? GOLD : OFF)); say('新 node：left = 先取出的、right = 後取出的', 'z.freq = 1 + 1 = 2，再 insert 回 queue'); await beat(tok, 2400); fc.forEach((c) => lit(c)); }
        await beat(tok, 900);
      }
      arrow(V(-5.6, 2.0, 0), V(-5.6, 5.2, 0), '#c08a1f');
      tag('bottom-up', 'ptr alt', -5.6, 5.6);
      say('樹是由下往上長（bottom-up），不是 top-down', '頻率最小的最先合併 → 落在樹的最底層');
      await beat(tok, 3600);
    } };

    // #2 把頻率表 insert 成 min heap（陣列）
    LECT['p16-huff-heap'] = { title: '頻率表 insert 成 min heap', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5.2, 13.5], [0, 3.6, 1]);
      const P = (i) => heapPos(i, 6.7, 1.45, 11.6);
      const TX = (i) => V(-5.9 + (i - 1) * 0.98, 0.3, 2.7);
      for (let i = 1; i <= 12; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.08, 0.8), new THREE.MeshStandardMaterial({ color: '#e9dcc4', roughness: 1 })); t.position.copy(TX(i)).setY(0.04); lab.world.add(t); tag('[' + i + ']', 'idx', TX(i).x, 0.05, 3.4); }
      const H = [null], Hb = [null], Hc = [null];
      edgeLines(() => { const o = []; for (let i = 2; i < Hb.length; i++) o.push([Hb[i >> 1].obj.position, Hb[i].obj.position]); return o; });
      say('PQ 用 array 實作成 min heap', '依 frequency 表逐一 insert：E1、e8、r2、i1…');
      await beat(tok, 2600);
      for (const c of HORDER) {
        let i = H.length;
        H.push(c);
        const b = lab.addBody(block(c + HF[c], [0.9, 0.55, 0.7], LEAFC)); b.obj.position.copy(P(i)).add(V(0, 3, 0)); lab.dropTo(b, P(i)); Hb.push(b);
        const cc = lab.addBody(block(c + HF[c], [0.78, 0.45, 0.6], TOKC)); cc.obj.position.copy(TX(i)).add(V(0, 2, 0)); lab.dropTo(cc, TX(i)); Hc.push(cc);
        say('Insert ' + c + '（freq ' + HF[c] + '）放到 [' + i + ']', '再往上和 parent 比，比較小就交換');
        await beat(tok, 750);
        while (i > 1 && HF[H[i]] < HF[H[i >> 1]]) {
          const p = i >> 1;
          lit(Hb[i], GOLD); lit(Hb[p], GOLD);
          say(c + HF[c] + ' < parent ' + H[p] + HF[H[p]] + ' → 交換', '[' + i + '] ↔ [' + p + ']');
          [H[i], H[p]] = [H[p], H[i]]; [Hb[i], Hb[p]] = [Hb[p], Hb[i]]; [Hc[i], Hc[p]] = [Hc[p], Hc[i]];
          lab.springTo(Hb[i], P(i)); lab.springTo(Hb[p], P(p)); lab.springTo(Hc[i], TX(i)); lab.springTo(Hc[p], TX(p));
          await beat(tok, 700);
          lit(Hb[i]); lit(Hb[p]);
          i = p;
        }
      }
      lit(Hb[1], GOLD); lit(Hc[1], GOLD);
      say('min heap 建好：[1] 一定是 frequency 最小者', 'heap = ' + H.slice(1).map((c) => c + HF[c]).join(' '));
      await beat(tok, 3400);
      say('同 freq 不交換；insert / delete 都要會寫', '投影片的初始排列未口述，這裡依字元出現順序 insert（示意）');
      await beat(tok, 3000);
    } };

    // PQ 列：依 freq 排好的 token
    function pqRow(z, x0 = -5.3, dx = 0.92) {
      const R = { list: [], x: (k) => x0 + k * dx, z,
        lay() { R.list.forEach((t, k) => lab.springTo(t.b, V(R.x(k), 0.3, z))); },
        add(n, from, color) { const b = lab.addBody(block(tl(n), [0.78, 0.5, 0.66], color || (n.ch ? TOKC : INC))); b.obj.position.copy(from); const t = { n, b }; let i = R.list.findIndex((x) => x.n.f > n.f); if (i < 0) i = R.list.length; R.list.splice(i, 0, t); R.lay(); return t; } };
      tag('PQ', 'ptr', x0 - 0.95, 0.3, z);
      return R;
    }

    // #3 演算法主迴圈
    LECT['p16-huff-algo'] = { title: 'Huffman 演算法主迴圈', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5.2, 13.5], [0, 3.4, 0.8]);
      const cd = code(['while (heap 內 element 數 >= 2) {', '  z = new HuffmanNode;', '  z->left  = heap.DeleteMin();', '  z->right = heap.DeleteMin();', '  z->freq  = z->left->freq + z->right->freq;', '  heap.Insert(z);', '}', 'root = heap.DeleteMin();  // 只剩 1 個'], -2.4, 7.2, 0.5);
      const R = pqRow(2.4);
      const { merges } = huffRun(HORDER);
      HORDER.slice().sort((a, b) => HF[a] - HF[b]).forEach((c) => R.add({ ch: c, f: HF[c], kids: [] }, V(0, 4, 2.4)));
      R.list.forEach((t) => { t.b.obj.position.copy(V(R.x(R.list.indexOf(t)), 0.3, 2.4)); });
      say('不斷合併最小的兩個，直到只剩一個', 'heap 內有 12 個單一字元 node');
      await beat(tok, 2600);
      const MX = [2.2, 4.3];
      for (let m = 0; m < 2; m++) {
        const g = merges[m]; const x = MX[m];
        cd.hl(0); say('element 數 ' + R.list.length + ' ≥ 2 → 進迴圈', 'while 條件成立'); await beat(tok, 1300);
        cd.hl(1); const z = lab.addBody(block('?', [0.8, 0.55, 0.7], INC)); z.obj.position.set(x, 4.2, 0); z.target.set(x, 4.2, 0);
        say('步驟一：產生新的 Huffman node z', ''); await beat(tok, m ? 700 : 1300);
        const A = R.list.shift(); cd.hl(2); lit(A.b, GOLD); lab.springTo(A.b, V(x - 0.6, 2.9, 0)); R.lay();
        const l1 = seg(V(x, 3.9, 0), V(x - 0.6, 3.15, 0), '#7a6a52');
        say('DeleteMin → ' + tl(A.n) + ' 當 left child', '第一次取出最小'); await beat(tok, m ? 900 : 1500);
        const B = R.list.shift(); cd.hl(3); lit(B.b, GOLD); lab.springTo(B.b, V(x + 0.6, 2.9, 0)); R.lay();
        seg(V(x, 3.9, 0), V(x + 0.6, 3.15, 0), '#7a6a52');
        say('再 DeleteMin → ' + tl(B.n) + ' 當 right child', '刪掉後原本第二小的變成最小'); await beat(tok, m ? 900 : 1500);
        cd.hl(4); z.obj.children.forEach((c) => { if (c.element) c.element.textContent = String(g.z.f); });
        say('z.freq = ' + A.n.f + ' + ' + B.n.f + ' = ' + g.z.f, ''); await beat(tok, m ? 800 : 1300);
        cd.hl(5); const t = R.add(g.z, V(x, 4.2, 0)); lit(t.b, GOLD);
        say('把 z insert 回 heap（要調整位置）', 'PQ：' + R.list.map((q) => tl(q.n)).join(' ')); await beat(tok, m ? 1100 : 1700);
        lit(t.b); lit(A.b); lit(B.b);
      }
      cd.hl(0);
      say('…重複，直到 heap 只剩 1 個 element', '共做 n − 1 = 11 次合併');
      await beat(tok, 2400);
      cd.hl(7);
      say('最後剩下的那一個就是 Huffman tree 的 root', 'root.freq = 26 = 全部字元數');
      await beat(tok, 3000);
    } };

    // #4 完整建樹動畫
    LECT['p16-huff-build'] = { title: 'Huffman tree 建構實例', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5.0, 14], [0, 3.4, 0.8]);
      const { root, merges } = huffRun(HORDER);
      layoutG(root, { width: 11.2, topY: 6.8, step: 1.32 });
      const R = pqRow(2.8, -5.0, 0.95);
      HORDER.slice().sort((a, b) => HF[a] - HF[b]).forEach((c) => { const n = gAll(root).find((q) => q.ch === c); n.tok = R.add(n, V(0, 2, 2.8)); });
      R.list.forEach((t, k) => t.b.obj.position.set(R.x(k), 0.3, 2.8));
      edgeLines(() => { const out = []; for (const n of gAll(root)) if (n.placed) for (const k of n.kids) if (k.placed) out.push([n.body.obj.position, k.body.obj.position]); return out; }, 0.27);
      say('12 種字元依 freq 放進 PQ', '每輪：DeleteMin 兩次 → 合併 → Insert');
      await beat(tok, 2800);
      const NAR = ['E 與 i 最小，先被取出', '接著取出 y 與 l', '再取出 k 與句點'];
      for (let m = 0; m < merges.length; m++) {
        const { a, b, z } = merges[m];
        const slow = m < 3 || m >= merges.length - 2;
        for (const n of [a, b]) { lit(n.tok.b, GOLD); if (n.body) gLit(n, GOLD); }
        say(m < 3 ? NAR[m] : m === merges.length - 1 ? 'heap 只剩 10 與 16 → 合併' : '取出 ' + tl(a) + '、' + tl(b), tl(a) + ' + ' + tl(b) + ' = ' + z.f + '（left = 先取出的）');
        await beat(tok, slow ? 1000 : 600);
        const dead = [];
        R.list.splice(R.list.indexOf(a.tok), 1); R.list.splice(R.list.indexOf(b.tok), 1); R.lay();
        for (const n of [a, b]) {
          if (n.ch) { n.body = n.tok.b; lit(n.body); lab.springTo(n.body, n.pos.clone()); tag(String(n.f), 'idx', n.pos.x, n.pos.y - 0.5, 0.4); }
          else { lab.springTo(n.tok.b, n.pos.clone()); dead.push(n.tok.b); gLit(n); }
          n.placed = true;
        }
        await beat(tok, slow ? 800 : 500);
        dead.forEach(kill);
        z.body = lab.addBody(block(z.label, LSZ, INC)); z.body.obj.position.copy(z.pos).add(V(0, 2.5, 0)); lab.dropTo(z.body, z.pos.clone()); z.placed = true;
        z.tok = R.add(z, z.pos.clone());
        await beat(tok, slow ? 1100 : 700);
      }
      kill(root.tok.b);
      gLit(root, GOLD);
      say('root = 26：Huffman tree 完成', '每次 delete、insert 之後 heap 都要調整');
      await beat(tok, 3200);
      say('E、i 等低頻字元在最下層，e 只在第 2 層', '同 freq 的取法依範例');
      await beat(tok, 2600);
    } };

    // #5 編碼：左 0 右 1
    LECT['p16-huff-encode'] = { title: 'Huffman 編碼：左 0、右 1', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.8, 14], [0, 3.6, 0.5]);
      const { root } = huffRun(HORDER);
      hufShow(root, null, true);
      const codes = huffCodes(root);
      const cur = makeCursor();
      say('編碼規則：往左走記 0，往右走記 1', '從 root 走到 leaf 的路徑 = 該字元的碼');
      await beat(tok, 2600);
      for (const c of ['E', 'i']) {
        let n = root, p = '';
        cursorAt(cur, n.pos); gLit(n, GOLD);
        await beat(tok, 700);
        for (const bit of codes[c]) {
          n = n.kids[+bit]; p += bit; cursorAt(cur, n.pos); gLit(n, GOLD);
          say('走向 ' + (n.ch || n.label) + '：' + (bit === '0' ? '往左 → 0' : '往右 → 1'), c + ' 的碼：' + p);
          await beat(tok, c === 'E' ? 900 : 600);
        }
        say('大寫 ' + c + ' = ' + codes[c] + (c === 'i' ? '（和 E 只差最後一個 bit）' : ''), c === 'E' ? '26→10→4→2→E 共 4 步（老師口說 000，實為 0000）' : 'i = 0001');
        await beat(tok, 2200);
        gAll(root).forEach((q) => gLit(q));
      }
      cur.obj.visible = false;
      say('每個字元都在 leaf → code table', 'prefix-free：沒有一個碼是另一個碼的前綴');
      for (const n of gAll(root)) if (n.ch) { const l = tag(codes[n.ch], 'ptr alt', n.pos.x, n.pos.y - 0.95, 0.4); await beat(tok, 260); }
      await beat(tok, 1200);
      say('高頻 e = 10（2 bits），低頻 E = 0000', 'space = 011、r = 1100 …');
      await beat(tok, 3200);
    } };

    // #6 Huffman tree 不唯一
    LECT['p16-huff-tie'] = { title: 'Huffman tree 不唯一', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.6, 13], [0, 3.4, 0]);
      const ONES = ['E', 'i', 'y', 'l', 'k', '.'];
      const sides = [{ order: ONES, cx: -3.3, name: '先取 E、i' }, { order: ['l', 'k', 'E', 'i', 'y', '.'], cx: 3.3, name: '先取 l、k' }];
      say('Huffman tree 唯一嗎？', '頻率 1 的字元有 6 個：E i y l k .（示意：只看這 6 個）');
      await beat(tok, 3000);
      const res = [];
      for (const S of sides) {
        const { root, merges } = huffRun(S.order);
        layoutG(root, { cx: S.cx, width: 4.6, topY: 6.4, step: 1.5 });
        tag(S.name, 'ptr', S.cx, 7.5);
        edgeLines(() => { const o = []; for (const n of gAll(root)) for (const k of n.kids) if (n.body && k.body) o.push([n.body.obj.position, k.body.obj.position]); return o; }, 0.27);
        say(S.name + '：同樣不違反 heap 性質', 'freq 一樣時，誰先出來都可以');
        for (const n of gAll(root).filter((q) => q.ch)) { n.body = lab.addBody(block(n.ch, LSZ, LEAFC)); n.body.obj.position.copy(n.pos).add(V(0, 3, 0)); lab.dropTo(n.body, n.pos.clone()); }
        await beat(tok, 800);
        for (const { z } of merges) { z.body = lab.addBody(block(z.label, LSZ, INC)); z.body.obj.position.copy(z.pos).add(V(0, 2, 0)); lab.dropTo(z.body, z.pos.clone()); await beat(tok, 650); }
        res.push(huffCodes(root));
        await beat(tok, 800);
      }
      say('取出順序不同 → 樹形不同 → 碼不同', 'E：' + res[0].E + ' vs ' + res[1].E + '；l：' + res[0].l + ' vs ' + res[1].l);
      await beat(tok, 3400);
      const tot = (m) => ONES.reduce((s, c) => s + m[c].length, 0);
      tag('總長 ' + tot(res[0]) + ' bits', 'ptr alt', -3.3, 0.4, 1); tag('總長 ' + tot(res[1]) + ' bits', 'ptr alt', 3.3, 0.4, 1);
      say('Huffman tree / code 都不唯一', '但總編碼長度相同（都是最小）：' + tot(res[0]) + ' = ' + tot(res[1]));
      await beat(tok, 3600);
    } };

    // #8 壓縮效益
    LECT['p16-huff-ratio'] = { title: '壓縮效益與 overhead', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.6, 13], [0, 3.0, 0]);
      const bars = [];
      async function bar(x, bits, color, name, ms) {
        const m = lab.box(color, [1.6, 1, 1.2]); m.scale.y = 0.001; m.position.set(x, 0, 0); lab.world.add(m);
        const h = bits / 40;
        await anim(tok, ms, (t) => { m.scale.y = h * t; m.position.y = h * t / 2; });
        tag(bits + ' bits', 'ptr', x, h + 0.4); tag(name, 'idx', x, 0.05, 1.2);
        bars.push(m); return h;
      }
      say('例句共 26 個字元（含 space、句點）', '比較 ASCII 與 Huffman 要幾個 bit');
      await beat(tok, 2400);
      say('ASCII：每字元 8 bits', '26 × 8 = 208 bits');
      await bar(-4.2, 208, '#4b9ee2', 'ASCII', 1200);
      await beat(tok, 1800);
      say('老師假設每個 Huffman code 都 4 bits', '26 × 4 = 104 bits，省一半');
      const h = await bar(0, 104, '#dd8238', '假設 4 bits', 1000);
      await beat(tok, 1800);
      const g = ghost('#c0392b', 0, h + 0.5, 1.6, 1.0, 0, 1.2);
      tag('+ X（存 Huffman tree）', 'ptr alt', 0, h + 1.5);
      say('但有 overhead：header 要存 Huffman tree', '檔案大小 = 104 + X');
      await beat(tok, 3000);
      say('實際照 code table：Σ freq × 碼長', 'e 8×2 + sp 4×3 + 其餘 14×4 = 16+12+56 = 84');
      await bar(4.2, 84, '#2fc092', '實際（此樹）', 1000);
      await beat(tok, 3000);
      say('高頻字元碼短 → 壓得更多', '84 bits ≈ ASCII 的 40%（還要加 X）');
      await beat(tok, 3000);
    } };

    // #9 解碼
    LECT['p16-huff-decode'] = { title: 'Huffman 解碼：0 左 1 右走到 leaf', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.6, 14], [0, 3.4, 0.8]);
      const { root } = huffRun(HORDER);
      hufShow(root, null, true);
      const BITS = '100010101101';
      const bx = (k) => -3.0 + k * 0.5;
      const bc = [...BITS].map((b, k) => cube(b, '#b9a582', [0.42, 0.42, 0.42], bx(k), 0.25, 2.6));
      tag('bits', 'ptr', -4.0, 0.25, 2.6);
      const outT = tag('解出：', 'ptr alt', 4.6, 0.3, 2.6);
      const cur = makeCursor();
      say('從頭 scan bit：0 往左、1 往右', '一定會走到 leaf');
      await beat(tok, 2400);
      let n = root, out = '';
      cursorAt(cur, n.pos);
      for (let k = 0; k < BITS.length; k++) {
        const bit = BITS[k];
        lit(bc[k], GOLD);
        n = n.kids[+bit]; cursorAt(cur, n.pos); gLit(n, GOLD);
        say('讀到 ' + bit + ' → ' + (bit === '0' ? '往左' : '往右') + '到 ' + (n.ch || n.label), out ? '解出：' + out : (k === 0 ? '先讀 1 → 走到右邊的 16' : '再讀 0 → 往左'));
        await beat(tok, out ? 550 : 1100);
        lit(bc[k]); bc[k].obj.material.color.set('#d8cfc0');
        if (n.ch) {
          out += n.ch; setTag(outT, '解出：' + out);
          say('到 leaf ' + n.ch + ' → 輸出，回到 root', out === 'e' ? '老師的例子：10 → 小寫 e' : '解出：' + out);
          await beat(tok, out === 'e' ? 1900 : 900);
          gAll(root).forEach((q) => gLit(q));
          n = root; cursorAt(cur, n.pos);
          await beat(tok, 300);
        }
      }
      say('不需要分隔符號（prefix-free）', '10 0010 10 1101 → ' + out + '（後段為示意）');
      await beat(tok, 3400);
    } };

    // ── BST ──
    function bstShow(src, o) { return showTree(src, Object.assign({ topY: 6.4, minY: 2.4, maxSp: 1.5 }, o || {})); }
    const LS = { 30: 3, 5: 2, 2: 1, 40: 2, 32: 1, 45: 1 };
    // #11 判斷是否為 BST
    LECT['p16-bst-check'] = { title: '判斷是不是 BST', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.6, 13], [0, 3.6, 0]);
      const L = bstShow('20(15(12,18),25(,22))', { cx: -3.3, width: 5, minY: 3.0 });
      const R = bstShow('30(5(2,),40)', { cx: 3.3, width: 4, minY: 3.0 });
      tag('樹 1', 'ptr', -3.3, 7.4); tag('樹 2', 'ptr', 3.3, 7.4);
      say('BST：左子樹 < root < 右子樹', '每個 node 都要成立（洪逸：key 不重複）');
      await beat(tok, 3200);
      say('哪一棵是 binary search tree？', '常考：給兩棵樹判斷');
      await beat(tok, 2200);
      const n25 = find(L, '25'), n22 = find(L, '22');
      glow(n25, GOLD); glow(n22, RED);
      tag('22 < 25 卻在右邊', 'ptr alt', n22.pos.x, n22.pos.y - 0.8);
      say('樹 1：22 比 25 小，卻在 25 的右邊', '<span class="no">不是 BST</span>');
      await beat(tok, 3400);
      for (const n of allNodes(R)) { glow(n, GREEN); await beat(tok, 350); }
      say('樹 2：每個 node 都符合', '2 < 5 < 30 < 40 → <span class="ok">是 BST</span>');
      await beat(tok, 3000);
      say('要和整棵子樹比，不只看直接 parent', '樹 1 其餘數字為示意，22／25 為老師所指');
      await beat(tok, 2800);
    } };

    // #12 search：recursive 與 iterative
    LECT['p16-bst-search'] = { title: 'BST search：recursive 與 iterative', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.8, 13.5], [0, 3.6, 0]);
      const root = bstShow('30(5(2,),40(32,45))', { cx: 3.4, width: 5, topY: 6.4, minY: 3.0 });
      const cur = makeCursor();
      const rec = code(['TreeNode* Search(TreeNode* b, int x) {', '  if (!b) return 0;', '  if (x == b->data) return b;', '  if (x < b->data)', '    return Search(b->leftChild, x);', '  return Search(b->rightChild, x);', '}'], -3.0, 7.0, 0.5);
      say('Search(root, x)：x 在不在 BST 裡？', '比 root 小往左、比 root 大往右');
      await beat(tok, 2600);
      async function run(x, panel, L) {
        let n = root;
        const xt = tag('x = ' + x, 'ptr alt', 3.4, 7.5);
        while (true) {
          panel.hl(n ? L.top : L.nul);
          if (!n) { say('走到 NULL → return 0', 'x = ' + x + ' 找不到'); await beat(tok, 1800); break; }
          cursorTo(cur, n.pos); glow(n, GOLD);
          await beat(tok, 700);
          panel.hl(L.eq);
          if (x === +n.label) { glow(n, GREEN); say(x + ' == ' + n.label + ' → 回傳這個 node', '找到了'); await beat(tok, 1800); break; }
          const left = x < +n.label;
          panel.hl(left ? L.lt : L.gt);
          say(x + (left ? ' < ' : ' > ') + n.label + ' → 往' + (left ? '左' : '右'), panel === rec ? '遞迴呼叫 Search(' + (left ? 'leftChild' : 'rightChild') + ', x)' : 't = t->' + (left ? 'leftChild' : 'rightChild'));
          await beat(tok, 1300);
          glow(n, OFF);
          n = left ? n.left : n.right;
        }
        allNodes(root).forEach((q) => glow(q, OFF)); kill(xt);
      }
      await run(32, rec, { top: 1, nul: 1, eq: 2, lt: 4, gt: 5 });
      rec.kill();
      const it = code(['for (TreeNode* t = root; t; ) {', '  if (x == t->data) return t;', '  if (x < t->data) t = t->leftChild;', '  else t = t->rightChild;', '}', 'return 0;'], -3.0, 7.0, 0.5);
      say('iterative 版：for 迴圈直到 t == NULL', '結果一樣，不用遞迴堆疊');
      await beat(tok, 2000);
      await run(35, it, { top: 0, nul: 5, eq: 1, lt: 2, gt: 3 });
      say('時間 O(h)：h = 樹高', '平衡 ≈ O(log n)，歪斜退化 O(n)（搜尋值為示意）');
      await beat(tok, 3000);
    } };

    // #13 第 k 個：naive（max heap）與 leftSize 欄位
    LECT['p16-bst-kth'] = { title: '找第 k 個：naive 作法與 leftSize', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.8, 13.5], [0, 3.4, 0.6]);
      const root = bstShow('60(,70(65,80))', { cx: -3.0, width: 3.6, topY: 6.2, minY: 3.2 });
      const cur = makeCursor();
      say('search by rank：BST 60、70、65、80', '問：第 2 大的數字是？');
      await beat(tok, 2800);
      say('最笨的方法：traverse 全部丟進 max heap', '');
      const HP = (i) => heapPos(i, 6.2, 1.4, 5.0).add(V(3.4, 0, 0));
      const TX = (i) => V(1.6 + i * 0.95, 0.3, 2.4);
      for (let i = 1; i <= 4; i++) tag('[' + i + ']', 'idx', TX(i).x, 0.05, 3.1);
      tag('max heap', 'ptr', 3.4, 7.3);
      const H = [null], Hb = [null], Hc = [null];
      edgeLines(() => { const o = []; for (let i = 2; i < Hb.length; i++) o.push([Hb[i >> 1].obj.position, Hb[i].obj.position]); return o; });
      for (const n of preorder(root)) {
        cursorTo(cur, n.pos); glow(n, GOLD);
        let i = H.length; H.push(+n.label);
        const b = lab.addBody(block(n.label, NODE, '#e55a9b')); b.obj.position.copy(n.pos); lab.springTo(b, HP(i)); Hb.push(b);
        const c = lab.addBody(block(n.label, SMALL, TOKC)); c.obj.position.copy(n.pos); lab.springTo(c, TX(i)); Hc.push(c);
        say('看到 ' + n.label + ' → insert 進 max heap', 'heap：' + H.slice(1).join(' '));
        await beat(tok, 1000);
        while (i > 1 && H[i] > H[i >> 1]) {
          const p = i >> 1;
          [H[i], H[p]] = [H[p], H[i]]; [Hb[i], Hb[p]] = [Hb[p], Hb[i]]; [Hc[i], Hc[p]] = [Hc[p], Hc[i]];
          lab.springTo(Hb[i], HP(i)); lab.springTo(Hb[p], HP(p)); lab.springTo(Hc[i], TX(i)); lab.springTo(Hc[p], TX(p));
          say('比 parent 大 → 往上換', 'heap：' + H.slice(1).join(' '));
          await beat(tok, 800); i = p;
        }
        glow(n, OFF);
      }
      cur.obj.visible = false;
      lit(Hb[1], GOLD);
      say('DeleteMax 兩次：80、70 → 第 2 大 = 70', '老師說 array[2] 是第二大：此例剛好成立，一般要 delete k 次');
      await beat(tok, 3600);
      const lsz = { 60: 1, 70: 2, 65: 1, 80: 1 };
      say('課本作法：node 多一個欄位 leftSize', 'leftSize = left subtree 的 node 數 + 1（自己）');
      for (const n of allNodes(root)) { tag('leftSize ' + lsz[n.label], 'ptr alt', n.pos.x, n.pos.y + 0.65); glow(n, GREEN); await beat(tok, 700); }
      await beat(tok, 2400);
      say('其實 inorder 走一遍就是由小到大', 'O(n)；有 leftSize 可做到 O(h)');
      await beat(tok, 2800);
    } };

    // #14–16 leftSize、Rank 搜尋、程式碼（params.phase = size | rank | code）
    LECT['p16-bst-rank'] = { title: 'leftSize 與 search by rank', play: async (tok) => {
      const phase = (ctx.params || {}).phase || 'size';
      fresh();
      lab.frameCamera([0, 4.8, 13.5], [0, 3.6, 0.6]);
      const root = bstShow('30(5(2,),40(32,45))', phase === 'code' ? { cx: 3.4, width: 5, topY: 6.2, minY: 3.0 } : { cx: 0, width: 7, topY: 6.4, minY: 3.0 });
      const lt = {};
      const setLS = (n) => { lt[n.label] = tag('leftSize ' + LS[n.label], 'ptr alt', n.pos.x, n.pos.y + 0.65); };
      if (phase === 'size') {
        say('node 上方的數字 = leftSize', 'leftSize = left subtree 的 node 數 + 1');
        await beat(tok, 2600);
        const NAR = { 5: '5 的 left subtree 只有 2', 2: '2 沒有 left subtree', 30: 'root 30 的 left subtree 有 5、2', 40: '40 的 left subtree 只有 32', 32: '32 是 leaf', 45: '45 是 leaf' };
        for (const lbl of ['5', '2', '30', '40', '32', '45']) {
          const n = find(root, lbl);
          glow(n, GOLD);
          const sub = n.left ? allNodes(n.left) : [];
          let g = null;
          if (sub.length) { const xs = sub.map((q) => q.pos.x), ys = sub.map((q) => q.pos.y); g = ghost('#4b9ee2', (Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, Math.max(...xs) - Math.min(...xs) + 1.2, Math.max(...ys) - Math.min(...ys) + 1.0); sub.forEach((q) => glow(q, GREEN)); }
          say(NAR[lbl], 'leftSize(' + lbl + ') = ' + sub.length + ' + 1 = ' + LS[lbl]);
          await beat(tok, 900);
          setLS(n);
          await beat(tok, +lbl === 32 || +lbl === 45 ? 900 : 2100);
          if (g) kill(g);
          allNodes(root).forEach((q) => glow(q, OFF));
        }
        const n40 = find(root, '40'); glow(n40, GOLD);
        say('以 40 自己為 root 看它的 left subtree', '不要把祖先 30 左邊的 node 算進來');
        await beat(tok, 3200);
        return;
      }
      allNodes(root).forEach(setLS);
      const cur = makeCursor();
      if (phase === 'rank') {
        const SORT = [2, 5, 30, 32, 40, 45];
        const rx = (k) => -3.75 + k * 1.5;
        const rc = SORT.map((v, k) => { tag('第 ' + (k + 1) + ' 個', 'idx', rx(k), 0.05, 3.2); return cube(v, TOKC, SMALL, rx(k), 0.3, 2.4); });
        say('找 k = 5：由小到大第 5 個（老師更正）', '一開始說成第 k 大，34:09 更正為由小到大');
        await beat(tok, 3000);
        lit(rc[4], GOLD);
        say('排序後 2 5 30 32 40 45，第 5 個是 40', '用 leftSize 不必排序就能找到');
        await beat(tok, 2800);
        let n = root, k = 5;
        const kt = tag('k = 5', 'ptr alt', -5.6, 6.6);
        cursorTo(cur, n.pos); glow(n, GOLD);
        say('在 30：leftSize 3 只涵蓋前 3 個', 'k = 5 > 3 → 第 5 個不在左邊');
        await beat(tok, 3000);
        rc.slice(0, 3).forEach((c) => lit(c, GREEN));
        say('往右走，k 要減掉 leftSize', 'k = 5 − 3 = 2');
        k -= LS[n.label]; setTag(kt, 'k = ' + k);
        glow(n, OFF); n = n.right; cursorTo(cur, n.pos); glow(n, GOLD);
        await beat(tok, 2800);
        say('在 40：k = 2 == leftSize 2', '→ 回傳 40');
        glow(n, GREEN);
        await beat(tok, 2600);
        say('第 5 小 = 40', '往右才減、往左不減');
        await beat(tok, 2800);
        return;
      }
      const cd = code(['TreeNode* RankGet(int k) {', '  TreeNode* t = root;', '  while (t) {', '    if (k == t->leftSize) return t;', '    if (k < t->leftSize)', '      t = t->leftChild;', '    else { k -= t->leftSize;', '           t = t->rightChild; }', '  }', '  return 0;', '}'], -3.0, 7.2, 0.46);
      const kt = tag('', 'ptr alt', 3.4, 7.5);
      say('Rank：輸入 k，找由小到大第 k 個', '從 root 開始');
      await beat(tok, 2400);
      for (const k0 of [5, 3, 1]) {
        let k = k0, n = root;
        cd.hl(1); setTag(kt, 'k = ' + k); cursorTo(cur, n.pos);
        await beat(tok, 900);
        while (n) {
          glow(n, GOLD); cd.hl(3);
          const s = LS[n.label];
          if (k === s) { glow(n, GREEN); say('k = ' + k + ' == leftSize ' + s + ' → 回傳 ' + n.label, '找第 ' + k0 + ' 個 = ' + n.label); await beat(tok, 2000); break; }
          await beat(tok, 700);
          cd.hl(4);
          if (k < s) { cd.hl(5); say('k = ' + k + ' < leftSize ' + s + ' → 往左', '往左不用減'); await beat(tok, 1500); glow(n, OFF); n = n.left; }
          else { cd.hl(6); say('k = ' + k + ' > leftSize ' + s + ' → 往右', 'k −= ' + s + ' → ' + (k - s)); k -= s; setTag(kt, 'k = ' + k); await beat(tok, 1500); cd.hl(7); glow(n, OFF); n = n.right; }
          if (n) cursorTo(cur, n.pos);
        }
        allNodes(root).forEach((q) => glow(q, OFF));
      }
      cd.hl(-1);
      say('思考題：leftSize 怎麼維護？', 'insert 時沿路往左經過的 node，leftSize + 1');
      await beat(tok, 3200);
    } };

    // #17 insert
    LECT['p16-bst-insert'] = { title: 'BST insert：先 search 再放', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.6, 13], [0, 3.8, 0]);
      const root = makeTree('30(5(2,),40(35,80))');
      layoutTree(root, Object.assign({}, TREE_O, { width: 7, topY: 6.4, minY: 2.6, maxSp: 1.5 }));
      for (const n of allNodes(root)) if (n.label !== '80' && n.label !== '35') { nodeBody(n).obj.position.copy(n.pos); n.body.target.copy(n.pos); }
      edgeLines(() => treePairs(root));
      const cur = makeCursor();
      say('insert／delete 都不能破壞 BST 特性', '左 < parent < 右');
      await beat(tok, 2600);
      for (const x of [80, 35]) {
        const xb = cube(x, '#e55a9b', NODE, -5.2, 6.4, 0, 2);
        say('insert ' + x + '：先找它該待的位置', '');
        await beat(tok, 1200);
        let n = root, path = [];
        while (true) {
          cursorTo(cur, n.pos); glow(n, GOLD);
          const right = x > +n.label;
          say(x + (right ? ' > ' : ' < ') + n.label + ' → 往' + (right ? '右' : '左'), path.concat(n.label).join(' → '));
          path.push(n.label);
          await beat(tok, 1400);
          glow(n, OFF);
          const nx = right ? n.right : n.left;
          if (!nx || !nx.body) {
            const t = nx; lab.removeBody(xb); nodeBody(t); t.body.obj.position.copy(t.pos).add(V(0, 3.5, 0)); lab.dropTo(t.body, t.pos.clone());
            cursorTo(cur, t.pos); glow(t, GREEN);
            say('剛好是空的 → 放在 ' + n.label + ' 的 ' + (right ? 'right' : 'left') + ' child', '30(5(2,),40(' + (x === 35 ? '35' : '') + ',80))');
            await beat(tok, 2200); glow(t, OFF);
            break;
          }
          n = nx;
        }
      }
      cur.obj.visible = false;
      say('會 search 就會 insert：同樣的比較邏輯', '找到相同 key 就不插入（key 不重複）');
      await beat(tok, 3000);
    } };

    // #18 delete
    LECT['p16-bst-delete'] = { title: 'BST delete：單子樹與雙子樹', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.6, 13], [0, 3.6, 0]);
      const mk = (txt, c, x, y) => { const b = lab.addBody(block(txt, [W(txt), 0.6, 0.8], c)); b.obj.position.set(x, y, 0); b.target.set(x, y, 0); return b; };
      const n1 = mk('node1', '#2fc092', -1, 6.2), n2 = mk('node2', '#4b9ee2', 1.4, 4.6);
      const T1 = mk('T1', '#c9b48e', -3.0, 4.6), T2 = mk('T2', '#c9b48e', 3.0, 3.0);
      let n2alive = true;
      edgeLines(() => n2alive ? [[n1.obj.position, T1.obj.position], [n1.obj.position, n2.obj.position], [n2.obj.position, T2.obj.position]] : [[n1.obj.position, T1.obj.position], [n1.obj.position, T2.obj.position]]);
      say('最高準則：delete 後仍是 BST', '情況一：node2 只有 right subtree T2');
      await beat(tok, 3000);
      lit(n2, RED);
      say('delete node2', '');
      await beat(tok, 1000);
      n2alive = false; lab.flyAway(n2, V(1, 8, 4));
      lab.springTo(T2, V(1.4, 4.6, 0));
      say('把 T2 整個接上來取代 node2', 'T2 都比 node1 大 → 仍是 BST');
      await beat(tok, 3200);
      fresh();
      lab.frameCamera([0, 4.6, 13], [0, 3.6, 0]);
      const O = { width: 10, topY: 6.6, minY: 1.8 };
      let cur0 = makeTree('40(20(10,30),60(50(45,55(52,)),70))');
      layoutTree(cur0, Object.assign({}, TREE_O, O));
      allNodes(cur0).forEach((n) => { nodeBody(n).obj.position.copy(n.pos); n.body.target.copy(n.pos); });
      let rootRef = cur0;
      edgeLines(() => treePairs(rootRef));
      say('情況二：delete 60（有兩棵 subtree）', 'left：以 50 為 root；right：70');
      const n60 = find(cur0, '60'); glow(n60, RED);
      await beat(tok, 3000);
      const cur = makeCursor();
      for (const l of ['50', '55']) { const n = find(cur0, l); cursorTo(cur, n.pos); glow(n, l === '55' ? GOLD : RED); say(l === '50' ? '紅線：進 left subtree' : '一路往右 → 最大值 55', 'left subtree 的最大值'); await beat(tok, 1500); }
      const res = makeTree('40(20(10,30),55(50(45,52),70))');
      layoutTree(res, Object.assign({}, TREE_O, O));
      const old = {}; allNodes(cur0).forEach((n) => { old[n.label] = n; });
      lab.flyAway(n60.body, V(0, 8, 5));
      allNodes(res).forEach((n) => { n.body = old[n.label].body; lab.springTo(n.body, n.pos.clone()); });
      rootRef = res; cur.obj.visible = false;
      say('55 拉上來取代 60，52 遞補 55 的位置', '40(20(10,30),55(50(45,52),70))');
      await beat(tok, 3400);
      allNodes(res).forEach((n) => glow(n, OFF));
      say('一般化：取 left 最大或 right 最小都可以', 'T2 最大（predecessor）或 T3 最小（successor）');
      await beat(tok, 3000);
    } };

    // #19 插入順序 → skewed tree
    LECT['p16-bst-skewed'] = { title: '插入順序造成 skewed BST', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.6, 13], [0, 3.8, 0]);
      const P = (i) => V(-5 + i * 1.1, 7.0 - i * 0.68, 0);
      const bs = [];
      edgeLines(() => bs.slice(1).map((b, k) => [bs[k].obj.position, b.obj.position]));
      say('BST 從 empty 開始，數字依序 insert', '順序 1, 2, 3, …, 10（已排好）');
      await beat(tok, 2400);
      for (let i = 0; i < 10; i++) {
        bs.push(cube(i + 1, depthColor(i), NODE, P(i).x, P(i).y, 0, 2.5));
        say(i ? (i + 1) + ' 比前面都大 → 一路往右' : '1 先當 root', '高度 = ' + (i + 1));
        await beat(tok, 650);
      }
      say('得到往右歪斜的 skewed tree', '高度 = n = 10，search 跟 linked list 一樣 O(n)');
      await beat(tok, 3400);
      bs.splice(0).forEach((b) => lab.flyAway(b, V(rnd(4) - 2, 8, 4)));
      await beat(tok, 800);
      const root = makeTree('5(3(2(1,),4),8(7(6,),9(,10)))');
      layoutTree(root, Object.assign({}, TREE_O, { width: 9, topY: 6.6, minY: 2.4 }));
      edgeLines(() => treePairs(root));
      say('同樣 10 個數換個順序 insert（示意）', '5, 3, 8, 2, 4, 7, 9, 1, 6, 10');
      for (const v of [5, 3, 8, 2, 4, 7, 9, 1, 6, 10]) { const n = find(root, String(v)); nodeBody(n).obj.position.copy(n.pos).add(V(0, 3, 0)); lab.dropTo(n.body, n.pos.clone()); await beat(tok, 380); }
      await beat(tok, 900);
      say('高度只有 4 → search 約 O(log n)', 'insert 順序決定 BST 的形狀');
      await beat(tok, 3000);
      say('AVL tree：每次 insert 後調整', '左右子樹高度差 ≤ 1 → 高度保證 O(log n)');
      await beat(tok, 3000);
    } };

    // ── Selection tree（Horowitz Fig 5.32–5.34，k = 8） ──
    const RUNS = [[10, 15, 16], [9, 20, 38], [20, 20, 30], [6, 15, 25, 28], [8, 15, 50], [9, 11, 16], [90, 95, 99], [17, 18, 20]];
    function selBase(topY, step, withNode0) {
      const P = (i) => (i === 0 ? V(0, topY + step * 0.95, 0) : heapPos(i, topY, step, 11.4));
      const node = {}, val = {}, runs = RUNS.map((r) => r.slice());
      const pairs = [];
      for (let i = withNode0 ? 1 : 2; i <= 15; i++) pairs.push(i === 1 ? [0, 1] : [i >> 1, i]);
      edgeLines(() => pairs.filter(([a, b]) => node[a] && node[b]).map(([a, b]) => [node[a].obj.position, node[b].obj.position]));
      for (let i = withNode0 ? 0 : 1; i <= 15; i++) tag(String(i), 'idx', P(i).x + 0.55, P(i).y - 0.3, 0.3);
      const runB = runs.map((r, j) => { const x = P(8 + j).x; tag('run' + (j + 1), 'idx', x, 0.05, 0.9); return r.slice(1).map((v, k) => cube(v, '#d8cfc0', [0.6, 0.38, 0.55], x, P(8).y - 0.85 - k * 0.5)); });
      const put = (i, v, color, from) => { if (node[i]) kill(node[i]); const b = lab.addBody(block(v, NODE, color)); b.obj.position.copy(from || P(i)); lab.springTo(b, P(i)); node[i] = b; val[i] = v; return b; };
      return { P, node, val, runs, runB, put };
    }
    // 一個 run 送出隊首、下一個上到 leaf
    async function nextFromRun(tok, S, leaf) {
      const j = leaf - 8; S.runs[j].shift();
      const nb = S.runB[j].shift();
      lab.flyAway(S.node[leaf], V(0, 6, 5));
      S.node[leaf] = nb; S.val[leaf] = S.runs[j][0];
      lab.springTo(nb, S.P(leaf)); nb.obj.material.color.set(LEAFC);
      S.runB[j].forEach((b, k) => lab.springTo(b, V(S.P(leaf).x, S.P(8).y - 0.85 - k * 0.5, 0)));
      await beat(tok, 900);
    }
    LECT['p16-winner'] = { title: 'Winner tree（k = 8）', play: async (tok) => {
      const phase = (ctx.params || {}).phase || 'build';
      fresh();
      lab.frameCamera([0, 4.6, 13.5], [0, 3.6, 0]);
      const S = selBase(7.0, 1.3, false);
      for (let j = 0; j < 8; j++) { S.put(8 + j, RUNS[j][0], LEAFC); if (phase === 'build') { S.node[8 + j].obj.position.y += 3; lab.dropTo(S.node[8 + j], S.P(8 + j)); } }
      const win = (i) => Math.min(S.val[2 * i], S.val[2 * i + 1]);
      if (phase === 'build') {
        say('8 個 run，每個 run 已由小到大排好', '每個 leaf = 一個 run（queue）的第一個數');
        await beat(tok, 3000);
        say('像賽程表：兩兩比較，小的勝出往上', 'winner tree 是 complete binary tree');
        await beat(tok, 2400);
        for (let i = 7; i >= 1; i--) {
          const a = S.node[2 * i], b = S.node[2 * i + 1];
          lit(a, GOLD); lit(b, GOLD);
          const w = win(i), wi = S.val[2 * i] === w ? 2 * i : 2 * i + 1;
          say('node' + i + '：' + S.val[2 * i] + ' vs ' + S.val[2 * i + 1] + ' → ' + w + ' 勝', '小者為勝，往上一層');
          await beat(tok, i === 1 ? 1000 : 700);
          S.put(i, w, i === 1 ? '#c08a1f' : '#4b9ee2', S.P(wi).clone());
          await beat(tok, i >= 4 ? 800 : 1200);
          lit(a); lit(b);
        }
        lit(S.node[1], GOLD);
        say('root = 6：所有 run 的最小值', 'leaf：10 9 20 6 8 9 90 17（run 的其餘數字依課本）');
        await beat(tok, 3400);
        return;
      }
      for (let i = 7; i >= 1; i--) S.put(i, win(i), i === 1 ? '#c08a1f' : '#4b9ee2');
      const outT = tag('輸出：', 'ptr alt', -5.2, 7.5);
      say('winner tree 建好：root = 6', '拿來做排序（merge k 個 run）');
      await beat(tok, 2400);
      lit(S.node[1], GOLD);
      say('輸出 6，run4 的下一個 15 上來', 'leaf node11：6 → 15');
      setTag(outT, '輸出：6');
      await nextFromRun(tok, S, 11);
      lit(S.node[1]);
      const steps = [[5, 11, 10, '15 vs 旁邊的 20 → 15 往上'], [2, 5, 4, '到 node5，再和 node4 的 9 比 → 9 勝'], [1, 2, 3, '9 再和 node3 的 8 比 → 8 勝']];
      for (const [i, me, sib, cap] of steps) {
        lit(S.node[me], GOLD); lit(S.node[sib], GOLD);
        const w = Math.min(S.val[me], S.val[sib]);
        say(cap, 'node' + i + ' = ' + w);
        await beat(tok, 1300);
        S.put(i, w, i === 1 ? '#c08a1f' : '#4b9ee2', S.P(S.val[me] === w ? me : sib).clone());
        await beat(tok, 1100);
        lit(S.node[me]); lit(S.node[sib]);
      }
      lit(S.node[1], GOLD);
      say('新的 winner = 8：只重賽一條路徑', '每次重建 O(log k)');
      await beat(tok, 2800);
      tag('k = run 數、n = record 數', 'ptr', 4.0, 8.0);
      say('setup O(k)；每輸出一筆重賽 O(log k)', '共 n 筆 → merge 全部 O(n log k)');
      await beat(tok, 3600);
    } };

    LECT['p16-loser'] = { title: 'Loser tree：node 存輸家', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.8, 13.5], [0, 3.8, 0]);
      const S = selBase(6.6, 1.2, true);
      for (let j = 0; j < 8; j++) S.put(8 + j, RUNS[j][0], LEAFC);
      say('loser tree：winner tree 的小修改', 'internal node 存比賽的「輸家」（較大的數）');
      await beat(tok, 3000);
      const W2 = {}; for (let j = 8; j <= 15; j++) W2[j] = S.val[j];
      const wt = {};
      for (let i = 7; i >= 1; i--) {
        const a = W2[2 * i], b = W2[2 * i + 1], w = Math.min(a, b), l = Math.max(a, b);
        [2 * i, 2 * i + 1].forEach((c) => { if (wt[c]) lit(wt[c], GOLD); else lit(S.node[c], GOLD); });
        await beat(tok, 600);
        S.put(i, l, '#e55a9b', S.P(a === l ? 2 * i : 2 * i + 1).clone().add(V(0, 0.4, 0)));
        say('node' + i + '：' + a + ' vs ' + b + ' → 存輸家 ' + l, '贏家 ' + w + ' 繼續往上比');
        [2 * i, 2 * i + 1].forEach((c) => { if (wt[c]) { kill(wt[c]); delete wt[c]; } else lit(S.node[c]); });
        const p = S.P(i);
        wt[i] = cube(w, '#c08a1f', [0.5, 0.4, 0.5], p.x + 0.62, p.y + 0.45, 0.2, 0.6);
        W2[i] = w;
        await beat(tok, i >= 4 ? 1100 : 1500);
      }
      kill(wt[1]);
      S.put(0, W2[1], '#c08a1f', S.P(1).clone());
      lit(S.node[0], GOLD);
      say('最上面多一個 node0：存整體 winner 6', 'node1 存的是決賽輸家 8');
      await beat(tok, 3200);
      lit(S.node[0]);
      say('輸出 6，run4 的 15 上到 node11', '重賽：只跟路徑上 parent 存的 loser 比');
      await nextFromRun(tok, S, 11);
      let cw = 15, cwFrom = 11;
      for (const i of [5, 2, 1]) {
        lit(S.node[i], GOLD);
        const st = S.val[i], w = Math.min(cw, st), l = Math.max(cw, st);
        say('和 node' + i + ' 存的 ' + st + ' 比 → ' + w + ' 勝', 'node' + i + ' 存輸家 ' + l + '（不必找兄弟）');
        await beat(tok, 1400);
        if (l !== st) S.put(i, l, '#e55a9b', S.P(cwFrom).clone());
        lit(S.node[i]);
        cw = w; cwFrom = i;
        await beat(tok, 900);
      }
      S.put(0, cw, '#c08a1f', S.P(1).clone()); lit(S.node[0], GOLD);
      say('node0 = 新 winner 8', 'loser tree 重賽讀的 node 比較少（數值依課本）');
      await beat(tok, 3200);
    } };

    // #23 external sort
    LECT['p16-external'] = { title: '為什麼要 winner tree：external sort', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 5.0, 13.5], [0, 3.2, 0.5]);
      const COLS = ['#2fc092', '#4b9ee2', '#9b7ef4', '#e55a9b', '#dd8238', '#31aab0', '#c08a1f', '#5c7a4a'];
      const parts = COLS.map((c, j) => cube('', c, [1.32, 0.5, 0.9], -4.9 + j * 1.4, 0.25, -1.6));
      tag('大量資料（memory 放不下）', 'ptr', 0, 0.9, -1.6);
      const mem = ghost('#4b9ee2', 0, 3.4, 2.4, 1.4, -1.6, 1.4);
      tag('memory', 'ptr alt', 0, 4.5, -1.6);
      say('數字很多、memory 放不下怎麼辦？', '只有十幾個數字的話直接 sort 就好');
      await beat(tok, 3000);
      say('切成 8 個 partition，每個放得進 memory', '');
      for (let j = 0; j < 8; j++) {
        const b = parts[j], slow = j < 2;
        lab.springTo(b, V(0, 3.4, -1.6)); await beat(tok, slow ? 800 : 320);
        lit(b, GOLD);
        if (slow) say('第 ' + (j + 1) + ' 塊進 memory 排序', '排好 → 成為 run ' + (j + 1));
        await beat(tok, slow ? 900 : 260);
        lit(b);
        const P = heapPos(8 + j, 6.6, 1.0, 11.2);
        b.obj.scale.set(0.6, 1.0, 0.7);
        lab.springTo(b, V(P.x, 3.6, 0)); tag('run' + (j + 1), 'idx', P.x, 3.0, 0.4);
        await beat(tok, slow ? 800 : 300);
      }
      kill(mem);
      say('再用 k = 8 的 winner tree 合併 8 個 run', '這棵樹本身用不到多少 memory');
      const nodes = [];
      for (let i = 7; i >= 1; i--) { const P = heapPos(i, 6.6, 1.0, 11.2); nodes.push(cube('', '#d8cfc0', [0.6, 0.45, 0.6], P.x, P.y, 0, 2)); await beat(tok, 220); }
      await beat(tok, 900);
      const outs = [];
      for (let k = 0; k < 8; k++) {
        const c = cube('', COLS[(k * 3) % 8], [0.5, 0.4, 0.5], 0, 7.2, 0);
        lab.springTo(c, V(-4.2 + k * 0.6, 0.25, 2.6));
        outs.push(c); await beat(tok, 300);
      }
      tag('整體排序結果（由小到大輸出）', 'ptr', 0, 0.9, 2.6);
      say('k-way merge：每次輸出最小者', 'partition + winner tree = 大量資料的排序');
      await beat(tok, 2600);
      say('sorting 分 internal 與 external', 'external sort：資料放不下 memory 時使用');
      await beat(tok, 3000);
    } };

    // #25 forest → binary tree、forest traversal
    LECT['p16-forest'] = { title: 'Forest 轉 binary tree 與 traversal', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.8, 13.5], [0, 3.4, 0.6]);
      const Ts = [['A(B,C,D)', -3.8, 2.6], ['E(F)', 0.2, 0], ['G(H,I)', 3.4, 1.6]].map(([s, cx, w]) => { const r = parseG(s); layoutG(r, { cx, width: w, topY: 6.0, step: 1.7 }); return r; });
      const body = {};
      let mode = 'forest';
      Ts.forEach((r) => gAll(r).forEach((n) => { const b = cube(n.label, depthColor(n.depth), NODE, n.pos.x, n.pos.y, 0, 2.5); body[n.label] = b; }));
      const bt = makeTree('A(B(,C(,D)),E(F,G(H(,I))))');
      layoutTree(bt, Object.assign({}, TREE_O, { width: 8.4, topY: 6.6, minY: 1.8 }));
      edgeLines(() => {
        const o = [];
        if (mode === 'forest') Ts.forEach((r) => gAll(r).forEach((n) => n.kids.forEach((k) => o.push([body[n.label].obj.position, body[k.label].obj.position]))));
        else allNodes(bt).forEach((n) => [n.left, n.right].forEach((c) => { if (c) o.push([body[n.label].obj.position, body[c.label].obj.position]); }));
        return o;
      });
      say('forest：a set of disjoint trees', '這個 forest 有三棵樹 T1、T2、T3');
      await beat(tok, 3000);
      say('用 left child–right sibling 轉換', 'A 的 left = B；B→C→D 用 right sibling 串');
      await beat(tok, 2600);
      mode = 'bt';
      allNodes(bt).forEach((n) => lab.springTo(body[n.label], n.pos.clone()));
      await beat(tok, 1000);
      say('各棵樹的 root A、E、G 也當 sibling 串起來', 'A(B(,C(,D)),E(F,G(H(,I))))');
      await beat(tok, 3000);
      const cur = makeCursor();
      for (const [kind, name, seq] of [['pre', 'forest preorder', preorder(bt)], ['in', 'forest inorder', inorder(bt)]]) {
        const row = [];
        say(kind === 'pre' ? 'forest preorder：走 binary tree 前序' : 'forest inorder：走 binary tree 中序', '= 各棵樹的 ' + kind + 'order 依序接起來');
        for (let k = 0; k < seq.length; k++) {
          const n = seq[k]; cursorTo(cur, n.pos); lit(body[n.label], GOLD);
          const b = lab.addBody(block(n.label, SMALL, depthColor(n.depth))); b.obj.position.copy(n.pos); lab.springTo(b, rowPos(k, kind === 'pre' ? 3.6 : 2.4)); row.push(b);
          await beat(tok, 420);
          lit(body[n.label]);
        }
        rowLabel(kind === 'pre' ? 'pre' : 'in', kind === 'pre' ? 3.6 : 2.4);
        say(name + '：' + seq.map((n) => n.label).join(' '), '');
        await beat(tok, 1800);
      }
      cur.obj.visible = false;
      say('不必為 forest 另外發展理論', 'forest postorder 和 binary tree postorder 沒有自然對應');
      await beat(tok, 3000);
    } };

    // ── Disjoint sets（Horowitz Fig 5.36–5.40） ──
    const SETS = [['S1', '0(6,7,8)'], ['S2', '4(1,9)'], ['S3', '2(3,5)']];
    function dsDraw(lay, opt = {}) {
      const nodes = {};
      const trees = SETS.map(([nm, s], j) => { const r = parseG(s); layoutG(r, lay[j]); gAll(r).forEach((n) => { n.body = cube(n.label, ['#2fc092', '#4b9ee2', '#9b7ef4'][j], NODE, n.pos.x, n.pos.y, 0, opt.drop ? 2.5 : 0); nodes[n.label] = n; n.set = nm; }); return r; });
      trees.forEach((r) => gAll(r).forEach((n) => n.kids.forEach((k) => { k.parent = n; arrow(k.pos.clone().add(V(0, 0.32, 0)), n.pos.clone().add(V(0, -0.32, 0)), '#7a6a52'); })));
      return { trees, nodes };
    }
    LECT['p16-dsets'] = { title: '用 tree 表示 disjoint sets', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.4, 13], [0, 3.4, 0]);
      say('三個 set，每個 set 是一堆數字', '可用 linked list、array…這裡用 tree');
      await beat(tok, 2600);
      const D = dsDraw([{ cx: -3.6, width: 2.6, topY: 5.6, step: 2 }, { cx: 0.6, width: 1.6, topY: 5.6, step: 2 }, { cx: 4.4, width: 1.6, topY: 5.6, step: 2 }], { drop: true });
      ['S1 = {0, 6, 7, 8}', 'S2 = {1, 4, 9}', 'S3 = {2, 3, 5}'].forEach((t, j) => tag(t, 'ptr', [-3.6, 0.6, 4.4][j], 7.0));
      const caps = [['S1：root 0，6、7、8 指到 0', '指標由 child 指向 parent'], ['S2 = {1, 4, 9}：以 4 為 root', '不一定是 binary tree'], ['S3 = {2, 3, 5}：root 2', '同樣的表示法']];
      for (let j = 0; j < 3; j++) {
        const r = D.trees[j];
        gAll(r).forEach((n) => lit(n.body, j ? GREEN : GOLD));
        say(caps[j][0], caps[j][1]);
        await beat(tok, 2800);
        gAll(r).forEach((n) => lit(n.body));
      }
      tag('Si ∩ Sj = ∅（i ≠ j）', 'ptr alt', 0, 1.5, 1);
      say('這些 set 是 disjoint', '任兩個 set 交集為空集合');
      await beat(tok, 3200);
      say('常用運算：Union 與 Find', '下一步：怎麼用這種 tree 做');
      await beat(tok, 2600);
    } };

    LECT['p16-dfind'] = { title: 'Find：往上找到 root 再對 set name', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.6, 13.5], [0, 3.6, 0]);
      const LAY = [{ cx: -2.0, width: 2.4, topY: 5.6, step: 2 }, { cx: 1.9, width: 1.4, topY: 5.6, step: 2 }, { cx: 4.9, width: 1.4, topY: 5.6, step: 2 }];
      const D = dsDraw(LAY);
      const names = SETS.map(([nm], j) => cube(nm, '#c08a1f', NODE, -5.6, 6.8 - j * 1.4));
      tag('set name', 'idx', -5.6, 7.6);
      say('兩種運算：Union（合併）與 Find（屬於哪個 set）', '');
      await beat(tok, 3000);
      say('每個 set name 有 pointer 指向它的 root', 'S1 → 0、S2 → 4、S3 → 2');
      SETS.forEach((s, j) => { const r = D.trees[j]; arrow(V(-5.1, 6.8 - j * 1.4, 0), r.pos.clone().add(V(-0.45, 0.1, 0)), '#c08a1f', true); });
      await beat(tok, 3000);
      const cur = makeCursor();
      for (const x of ['3', '8']) {
        let n = D.nodes[x];
        cursorTo(cur, n.pos); lit(n.body, GOLD);
        say('Find(' + x + ')：從 ' + x + ' 出發往上', '');
        await beat(tok, 1300);
        while (n.parent) { n = n.parent; cursorTo(cur, n.pos); lit(n.body, GOLD); say('到 parent ' + n.label + (n.parent ? '' : '（root）'), ''); await beat(tok, 1200); }
        const j = SETS.findIndex(([nm]) => nm === n.set);
        lit(names[j], GREEN);
        say('root ' + n.label + ' → ' + n.set + '：' + x + ' ∈ ' + n.set, x === '8' ? '老師口誤說 S2；S1 = {0,6,7,8}，8 ∈ S1' : '3 屬於第三個 set');
        await beat(tok, 2800);
        Object.values(D.nodes).forEach((q) => lit(q.body)); lit(names[j]);
      }
      cur.obj.visible = false;
      say('find(i)：往上到 root 對 set name', '路徑越長，find 越慢');
      await beat(tok, 2800);
    } };

    LECT['p16-dunion'] = { title: 'Union 的兩種接法', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.6, 13.5], [0, 3.6, 0]);
      const body = {}, par = {};
      const all = ['0', '6', '7', '8', '4', '1', '9'];
      all.forEach((l, k) => { body[l] = lab.addBody(block(l, NODE, k < 4 ? '#2fc092' : '#4b9ee2')); });
      edgeLines(() => Object.keys(par).filter((c) => par[c]).map((c) => [body[par[c]].obj.position, body[c].obj.position]));
      function arrange(srcs) {
        for (const [s, o] of srcs) { const r = parseG(s); layoutG(r, o); gAll(r).forEach((n) => { lab.springTo(body[n.label], n.pos.clone()); par[n.label] = null; n.kids.forEach((k) => { par[k.label] = n.label; }); }); }
      }
      arrange([['0(6,7,8)', { cx: -3, width: 2.6, topY: 5.8, step: 2 }], ['4(1,9)', { cx: 3, width: 1.6, topY: 5.8, step: 2 }]]);
      Object.values(body).forEach((b) => { b.obj.position.copy(b.target); });
      const lt = tag('S1', 'ptr', -3, 7.0), rt = tag('S2', 'ptr', 3, 7.0);
      say('Union(S1, S2)：合成一個更大的 set', '只要改一個 root 的 parent 指標');
      await beat(tok, 2800);
      const cur = makeCursor();
      async function findPath(x, hopsCap) {
        let n = x, hops = 0; cursorTo(cur, body[n].target); lit(body[n], GOLD); await beat(tok, 700);
        while (par[n]) { n = par[n]; hops++; cursorTo(cur, body[n].target); lit(body[n], GOLD); await beat(tok, 800); }
        say(hopsCap, 'find(' + x + ')：' + hops + ' 個 hop 到 root ' + n);
        await beat(tok, 2400);
        all.forEach((l) => lit(body[l]));
        return hops;
      }
      kill(lt); kill(rt);
      arrange([['0(6,7,8,4(1,9))', { cx: 0, width: 6, topY: 6.2, step: 1.8 }]]);
      say('第一種：S2 成為 S1 的 child（4 接到 0 底下）', '0(6, 7, 8, 4(1, 9))');
      await beat(tok, 2800);
      await findPath('1', '常 find(1)、find(9)：要先到 4 再到 0');
      arrange([['4(1,9,0(6,7,8))', { cx: 0, width: 6, topY: 6.2, step: 1.8 }]]);
      say('第二種：S1 成為 S2 的 child（0 接到 4 底下）', '4(1, 9, 0(6, 7, 8))');
      await beat(tok, 2800);
      await findPath('1', '同樣 find(1)：一個 hop 就到 root 4');
      cur.obj.visible = false;
      say('哪種好？看之後哪些元素常被 find', '課本後續：weighting rule，node 少的樹接到多的下面');
      await beat(tok, 3200);
    } };

    LECT['p16-darray'] = { title: 'Disjoint set 的 parent 陣列', play: async (tok) => {
      fresh();
      lab.frameCamera([0, 4.6, 13.5], [0, 3.4, 1]);
      const D = dsDraw([{ cx: -3.6, width: 2.6, topY: 6.6, step: 1.6 }, { cx: 0.6, width: 1.6, topY: 6.6, step: 1.6 }, { cx: 4.4, width: 1.6, topY: 6.6, step: 1.6 }]);
      const TX = (i) => V(-5.4 + i * 1.2, 0.04, 2.4);
      const tiles = [];
      for (let i = 0; i <= 9; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.08, 0.9), new THREE.MeshStandardMaterial({ color: '#e9dcc4', roughness: 1 })); t.position.copy(TX(i)); lab.world.add(t); tiles.push(t); tag('[' + i + ']', 'idx', TX(i).x, 0.05, 3.1); }
      rowLabel('parent', 2.4);
      say('剛才的 tree 可以直接用 array 表示', 'index = 元素數字，內容 = 它的 parent');
      await beat(tok, 3000);
      const cells = {};
      for (let i = 0; i <= 9; i++) {
        const n = D.nodes[String(i)];
        const pv = n.parent ? +n.parent.label : -1;
        lit(n.body, GOLD); tiles[i].material.color.set('#f2c46d');
        cells[i] = lab.addBody(block(pv, SMALL, pv < 0 ? '#e55a9b' : '#8fa3b8'));
        cells[i].obj.position.copy(n.pos); lab.springTo(cells[i], TX(i).clone().setY(0.33));
        const slow = i === 9 || i === 4;
        say(i + (pv < 0 ? ' 是 root' : ' 的 parent 是 ' + pv), 'parent[' + i + '] = ' + pv);
        await beat(tok, slow ? 1600 : 750);
        lit(n.body); tiles[i].material.color.set('#e9dcc4');
      }
      for (const [i, cap, f] of [[9, '9 的 parent 是 4', 'parent[9] = 4'], [4, '4 是 root', 'parent[4] = −1']]) {
        lit(D.nodes[String(i)].body, GOLD); lit(cells[i], GOLD);
        say(cap, f);
        await beat(tok, 2200);
        lit(D.nodes[String(i)].body); lit(cells[i]);
      }
      say('root 的 parent 一律 −1', 'parent = [−1, 4, −1, 2, −1, 2, 0, 0, 0, 4]');
      await beat(tok, 3200);
      say('看起來像 tree，實作只要一個 array', 'WeightedUnion 時 root 改存 −(node 數)');
      await beat(tok, 2800);
    } };
  }

  // ─── 4HDjWNV09QY 彭文志 Lec17：disjoint set（union／find）、equivalence class、inorder 不唯一 ───
  {
    const SETC = ['#2fc092', '#4b9ee2', '#9b7ef4', '#e55a9b', '#dd8238', '#31aab0', '#c08a1f', '#5c7a4a', '#8fa3b8', '#b9a582', '#2fc092', '#4b9ee2'];
    // 森林：par[i] = parent（root 為 -1），kids 保留插入順序；layout 時 root 由左到右排
    function forest(elems, o = {}) {
      const O = Object.assign({ cx: 0, width: 11, topY: 6.2, step: 1.35, maxSp: 1.25, size: [0.75, 0.55, 0.75] }, o);
      const F = { par: {}, kids: {}, body: {}, order: [], O };
      elems.forEach((e) => { F.par[e] = -1; F.kids[e] = []; F.order.push(e); });
      F.link = (c, p) => {
        const old = F.par[c];
        if (old !== -1) F.kids[old] = F.kids[old].filter((x) => x !== c);
        else F.order = F.order.filter((x) => x !== c);
        F.par[c] = p; F.kids[p].push(c);
      };
      F.root = (x) => { while (F.par[x] !== -1) x = F.par[x]; return x; };
      F.count = (r) => 1 + F.kids[r].reduce((a, k) => a + F.count(k), 0);
      F.pos = () => {
        const mk = (e) => ({ label: e, kids: F.kids[e].map(mk) });
        const top = { label: '', kids: F.order.map(mk) };
        let L = 0; (function c(n) { if (!n.kids.length) L++; n.kids.forEach(c); })(top);
        layoutG(top, { cx: O.cx, width: Math.min(O.width, Math.max(0, L - 1) * O.maxSp), topY: O.topY + O.step, step: O.step });
        const P = {}; gAll(top).forEach((n) => { if (n !== top) P[n.label] = n.pos; });
        return P;
      };
      F.spawn = (color) => {
        const P = F.pos();
        elems.forEach((e, k) => { F.body[e] = cube(e, color ? color(e, k) : SETC[k % SETC.length], O.size, P[e].x, P[e].y, 0); });
        const pool = [];
        for (let k = 0; k < 16; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 8), new THREE.MeshBasicMaterial({ color: '#7a6a52' })); c.visible = false; lab.world.add(c); pool.push(c); }
        F.up = o.down ? false : true;
        const ls = edgeLines(() => { const out = []; for (const e of elems) if (F.par[e] !== -1) out.push([F.body[F.par[e]].obj.position, F.body[e].obj.position]); return out; });
        const hh = O.size[1] / 2;
        ls.onAfterRender = () => {
          let k = 0;
          for (const e of elems) {
            if (F.par[e] === -1 || k >= pool.length) continue;
            const p = F.body[F.par[e]].obj.position, c = F.body[e].obj.position;
            const a = V(p.x, p.y - hh, p.z), b = V(c.x, c.y + hh, c.z);
            const dir = F.up ? a.clone().sub(b).normalize() : b.clone().sub(a).normalize();
            const tip = F.up ? a : b;
            pool[k].position.copy(tip).addScaledVector(dir, -0.14);
            pool[k].quaternion.setFromUnitVectors(V(0, 1, 0), dir);
            pool[k].visible = true; k++;
          }
          for (; k < pool.length; k++) pool[k].visible = false;
        };
        return F;
      };
      F.relayout = () => { const P = F.pos(); for (const e of elems) lab.springTo(F.body[e], P[e].clone()); };
      return F;
    }
    // parent array 列（index 在下、值在格子上）
    function parRow(F, elems, z = 2.7, x0 = -5.4, dx = 1.2) {
      const R = { cells: {}, tiles: {} };
      tag('index', 'idx', x0 - 1.05, 0.1, z + 0.6); tag('parent', 'ptr', x0 - 1.15, 0.4, z);
      elems.forEach((e, k) => {
        const x = x0 + k * dx;
        R.tiles[e] = tile(V(x, 0.04, z), dx * 0.9, 0.9);
        tag('[' + e + ']', 'idx', x, 0.1, z + 0.62);
        R.cells[e] = tag(String(F.par[e]), 'val', x, 0.4, z);
      });
      R.set = (e) => setTag(R.cells[e], String(F.par[e]));
      R.hl = (e, c) => R.tiles[e].material.color.set(c || '#e9dcc4');
      return R;
    }
    const tile = (pos, w, d) => ctx.tile(pos, w, d);

    // 1) 三個 set 的 tree 表示、find(7)、union 兩種結果、pointer 方向
    LECT['p17-set-forest'] = { title: 'Set 的 tree 表示：find(7)、union 接 root', play: async (tok) => {
      const phase = (ctx.params || {}).phase || 'union';
      fresh(); lab.frameCamera([0, 5, 13.5], [0, 3.6, 0.5]);
      const F = forest([0, 6, 7, 8, 4, 1, 9, 2, 3, 5], { cx: 1.2, width: 9, maxSp: 1.3 });
      [6, 7, 8].forEach((c) => F.link(c, 0)); [1, 9].forEach((c) => F.link(c, 4)); [3, 5].forEach((c) => F.link(c, 2));
      F.spawn((e) => ({ 0: '#2fc092', 6: '#2fc092', 7: '#2fc092', 8: '#2fc092', 4: '#4b9ee2', 1: '#4b9ee2', 9: '#4b9ee2', 2: '#9b7ef4', 3: '#9b7ef4', 5: '#9b7ef4' })[e]);
      const tb = [['S1', 0], ['S2', 4], ['S3', 2]].map(([nm, r], k) => { const b = cube(nm, '#b9a582', [0.8, 0.5, 0.7], -6, 6 - k * 1.1); tag('→ root ' + r, 'idx', -4.9, 6 - k * 1.1); return b; });
      tag('set name 表', 'ptr', -6, 7);
      if (phase === 'dir') {
        say('Set 也是 tree：只是 pointer 往上指 parent', 'child → parent（一般 tree 是 parent → child）');
        await beat(tok, 4000);
        F.up = false;
        say('箭頭改成往下（root → element）也可以', '方向顛倒仍是 tree 的範疇');
        await beat(tok, 4000);
        F.up = true;
        say('用 array 表示 root／parent 關係最方便', 'parent[i] = i 的 parent，root = −1');
        await beat(tok, 4500);
        return;
      }
      say('每個 set 用一棵 tree 表示', 'S1={0,6,7,8}、S2={4,1,9}、S3={2,3,5}');
      await beat(tok, 3200);
      say('pointer 由 child 指向 parent（往上）', 'root 就是 set 裡的某個 element');
      await beat(tok, 2800);
      const cur = makeCursor();
      for (const e of [7, 0]) { cursorTo(cur, F.body[e].obj.position.clone()); lit(F.body[e], GOLD); say('find(7)：從 7 往上走', e === 7 ? '7' : '7 → 0（root）'); await beat(tok, 1300); }
      lit(tb[0], GOLD); say('root 0 反查 set name 表', 'find(7) = <span class="ok">S1</span>');
      await beat(tok, 2600); cur.obj.visible = false; lit(F.body[7]); lit(F.body[0]); lit(tb[0]);
      F.link(4, 0); F.relayout();
      say('union(S1, S2)：把 4 這個 root 接到 0 底下', '只動一個 root 的 pointer');
      await beat(tok, 3400);
      F.kids[0] = F.kids[0].filter((x) => x !== 4); F.par[4] = -1; F.order = [0, 4, 2]; F.link(0, 4); F.relayout();
      say('反過來把 0 接到 4 底下也合法', 'S1 ∪ S2 的 root 可以是 0 或 4');
      await beat(tok, 3600);
    } };

    // 2) parent array：find(7)；union(0,4) 後 find(1)
    LECT['p17-parent-array'] = { title: 'Parent array：parent[i] 存 parent，root = −1', play: async (tok) => {
      const phase = (ctx.params || {}).phase || 'find';
      fresh(); lab.frameCamera([0, 5.4, 13.5], [0, 3.2, 1.2]);
      const E = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      const F = forest(E, { cx: 0.8, width: 8, topY: 6.3, maxSp: 1.2 });
      F.order = [0, 4, 2];
      [6, 7, 8].forEach((c) => F.link(c, 0)); [1, 9].forEach((c) => F.link(c, 4)); [3, 5].forEach((c) => F.link(c, 2));
      F.order = [0, 4, 2];
      F.spawn((e) => (F.root(e) === 0 ? '#2fc092' : F.root(e) === 4 ? '#4b9ee2' : '#9b7ef4'));
      const R = parRow(F, E);
      [['S1', 0], ['S2', 4], ['S3', 2]].forEach(([nm, r], k) => tag(nm + ' → ' + r, 'idx', -6.2, 6.2 - k * 0.6));
      async function findWalk(x, why) {
        const path = [x]; while (F.par[path[path.length - 1]] !== -1) path.push(F.par[path[path.length - 1]]);
        const cur = makeCursor();
        for (let k = 0; k < path.length; k++) {
          const e = path[k];
          R.hl(e, '#f2c46d'); cursorTo(cur, F.body[e].obj.position.clone());
          say(why + '：看 parent[' + e + '] = ' + F.par[e], F.par[e] === -1 ? e + ' 是 root → 查 set name' : '往上到 ' + F.par[e]);
          await beat(tok, 1700);
        }
        E.forEach((e) => R.hl(e)); cur.obj.visible = false;
        return path;
      }
      if (phase === 'find') {
        say('index 是 element，值是它的 parent', 'root 存 −1');
        await beat(tok, 3200);
        [6, 7, 8].forEach((e) => R.hl(e, '#cfe8dc')); R.hl(0, '#cfe0f5');
        say('parent[6]、[7]、[8] 都是 0', '6、7、8 都掛在 root 0 底下');
        await beat(tok, 3200); E.forEach((e) => R.hl(e));
        const p = await findWalk(7, 'find(7)');
        say('find(7) 走過 ' + p.join(' → '), 'root 0 → <span class="ok">S1</span>');
        await beat(tok, 3000);
      } else {
        say('union(0, 4)：讓 4 接到 0 底下', '只要改一個數值');
        await beat(tok, 2600);
        R.hl(4, '#f2c46d'); F.link(4, 0); F.relayout(); R.set(4);
        say('parent[4]：−1 → 0', '其他 element 都不用動');
        await beat(tok, 3200); R.hl(4);
        const p = await findWalk(1, 'find(1)');
        say('find(1) 走過 ' + p.join(' → '), '一路走到值為 −1 的 root 0');
        await beat(tok, 3000);
      }
    } };

    // 3) simple union 退化成直線；find 總成本 O(n²)
    LECT['p17-degenerate'] = { title: 'union(0,1)…union(n−2,n−1)：退化成一條直線', play: async (tok) => {
      fresh(); lab.frameCamera([0, 4.6, 13.5], [0, 3.4, 0.5]);
      const n = 6, E = [0, 1, 2, 3, 4, 5];
      tag('示意 n = 6', 'idx', -6, 7.2);
      const pos = {};
      E.forEach((e, k) => { pos[e] = V(-6 + k * 1.5, 0.6, 0); });
      const B = {}; E.forEach((e) => { B[e] = cube(e, SETC[e], [0.75, 0.55, 0.75], pos[e].x, pos[e].y, 0, 3); });
      const par = {}; E.forEach((e) => { par[e] = -1; });
      edgeLines(() => E.filter((e) => par[e] !== -1).map((e) => [B[par[e]].obj.position, B[e].obj.position]));
      say('一開始每個數字各自是一個 set', '0, 1, …, n−1');
      await beat(tok, 2600);
      // 直線：root n−1 在最上面，0 在最下面
      const chainPos = (e) => V(4.5, 6.6 - (n - 1 - e) * 1.15, 0);
      for (let k = 0; k < n - 1; k++) {
        par[k] = k + 1;
        for (let j = 0; j <= k + 1; j++) lab.springTo(B[j], chainPos(j));
        say('union(' + k + ', ' + (k + 1) + ')：' + k + ' 接到 ' + (k + 1) + ' 底下', '每次 union O(1)');
        await beat(tok, 1300);
      }
      say('結果是一條直線：0 在最下、root ' + (n - 1) + ' 在最上', 'n − 1 次 union 共 O(n)');
      await beat(tok, 2800);
      const cur = makeCursor(); const cnt = tag('find 成本 0', 'ptr alt', -3, 5.5);
      let total = 0;
      for (const x of [0, 1, 2]) {
        let e = x, steps = 1; cursorTo(cur, B[e].obj.position.clone());
        await beat(tok, 350);
        while (par[e] !== -1) { e = par[e]; steps++; cursorTo(cur, B[e].obj.position.clone()); await beat(tok, 280); }
        total += steps; setTag(cnt, 'find 成本 ' + total);
        say('find(' + x + ')：從 ' + x + ' 一路走到 root', '走了 ' + steps + ' 個 node');
        await beat(tok, 900);
      }
      cursorTo(cur, B[n - 1].obj.position.clone());
      say('find(' + (n - 1) + ')：自己就是 root，一步', '越往下的 find 越貴');
      await beat(tok, 2000);
      say('find(0)…find(n−1) 總成本', '<span class="no">Σ_{i=2}^{n} i = O(n²)</span>');
      await beat(tok, 3200);
    } };

    // 4) weighting rule：同一串 union 變扁平
    LECT['p17-weighted-flat'] = { title: 'Weighting rule：node 少的接到 node 多的', play: async (tok) => {
      fresh(); lab.frameCamera([0, 4.6, 13.5], [0, 3.4, 0.5]);
      const E = [0, 1, 2, 3, 4, 5];
      tag('示意 n = 6', 'idx', -6, 7.2);
      const F = forest(E, { cx: 0, width: 10, topY: 5.6, step: 1.7, maxSp: 2 });
      F.spawn((e) => SETC[e]);
      const cnts = {}; E.forEach((e) => { cnts[e] = tag('1 個', 'idx', 0, 0, 0); F.body[e].obj.add(cnts[e]); cnts[e].position.set(0, 0.6, 0); });
      say('union(i, j)：比兩棵 tree 的 node 數', 'weighting rule：count(i) < count(j) → j 當 root；否則 i');
      await beat(tok, 3600);
      for (let k = 0; k < 5; k++) {
        const ri = F.root(k), rj = F.root(k + 1);
        const ci = F.count(ri), cj = F.count(rj);
        lit(F.body[ri], GOLD); lit(F.body[rj], GOLD);
        const [r, c] = ci < cj ? [rj, ri] : [ri, rj];
        say('union(' + k + ',' + (k + 1) + ')：' + ci + ' 個 vs ' + cj + ' 個', 'root ' + ri + ' vs root ' + rj + ' → ' + c + ' 接到 ' + r + ' 底下' + (ci === cj ? '（一樣多，選 i）' : ''));
        await beat(tok, 1500);
        F.link(c, r); F.relayout(); lit(F.body[ri]); lit(F.body[rj]);
        E.forEach((e) => setTag(cnts[e], F.par[e] === -1 ? F.count(e) + ' 個' : ''));
        await beat(tok, 1100);
      }
      say('不再是一條直線：root 0 底下直接掛所有 node', '<span class="ok">tree 被打平，find 很快</span>');
      await beat(tok, 3200);
    } };

    // 5) 8 個 node 的最差情況：兩兩合併三輪，高度 4 = log₂8 + 1
    LECT['p17-weighted-worst'] = { title: 'Weighted union 最差情況：8 個 node 高度 4', play: async (tok) => {
      fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.6, 0.5]);
      const E = [0, 1, 2, 3, 4, 5, 6, 7];
      const F = forest(E, { cx: 0, width: 10.5, topY: 6.6, step: 1.45, maxSp: 1.5 });
      F.spawn((e) => SETC[e]);
      const hT = tag('高度 1', 'ptr alt', -5.6, 7.4);
      const height = () => { let h = 0; for (const e of E) { let d = 1, x = e; while (F.par[x] !== -1) { x = F.par[x]; d++; } h = Math.max(h, d); } return h; };
      say('一開始 0..7 各自是一個 set', 'n = 8');
      await beat(tok, 2400);
      const rounds = [[[0, 1], [2, 3], [4, 5], [6, 7]], [[0, 2], [4, 6]], [[0, 4]]];
      for (let r = 0; r < 3; r++) {
        for (const [i, j] of rounds[r]) { lit(F.body[i], GOLD); lit(F.body[j], GOLD); F.link(j, i); }
        say('第 ' + (r + 1) + ' 輪：同樣大小兩兩 union', rounds[r].map(([i, j]) => 'union(' + i + ',' + j + ')').join('、') + '：一樣多 → 前者當 root');
        await beat(tok, 1500);
        F.relayout(); E.forEach((e) => lit(F.body[e])); setTag(hT, '高度 ' + height());
        await beat(tok, 2200);
      }
      say('每次都是同樣大小合併 → 高度剛好到上界', '高度 4 = ⌊log₂8⌋ + 1');
      await beat(tok, 3200);
      say('Lemma：高度 ≤ ⌊log₂m⌋ + 1', 'm 個 node；find 只走樹高 → O(log m)');
      await beat(tok, 3200);
    } };

    // 6) collapsing rule：連做 8 次 find(7)
    LECT['p17-collapsing'] = { title: 'Collapsing rule：8 次 find(7) 從 24 步降到 10 步', play: async (tok) => {
      fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.6, 0.5]);
      const E = [0, 1, 2, 3, 4, 5, 6, 7];
      const F = forest(E, { cx: 0.8, width: 9, topY: 6.6, step: 1.45, maxSp: 1.6 });
      F.order = [0];
      [[1, 0], [2, 0], [3, 2], [4, 0], [5, 4], [6, 4], [7, 6]].forEach(([c, p]) => F.link(c, p));
      F.spawn((e) => SETC[e]); F.relayout();
      const cA = tag('不調整：0 步', 'ptr', -5.4, 7.3), cB = tag('collapsing：0 步', 'ptr alt', -5.4, 6.6);
      const cur = makeCursor();
      async function walk(fast) { let x = 7, s = 0; cursorTo(cur, F.body[7].obj.position.clone()); await beat(tok, fast); while (F.par[x] !== -1) { x = F.par[x]; s++; cursorTo(cur, F.body[x].obj.position.clone()); await beat(tok, fast); } return s; }
      say('大家常做 find(7)：總共 8 次', '7 → 6 → 4 → 0，每次 3 步');
      await beat(tok, 2600);
      let a = 0;
      for (let k = 0; k < 8; k++) { a += await walk(k < 1 ? 600 : 130); setTag(cA, '不調整：' + a + ' 步'); }
      say('不調整：8 × 3 = 24 步', '<span class="no">每次都走同一條長路</span>');
      await beat(tok, 2400);
      let b = await walk(500); setTag(cB, 'collapsing：' + b + ' 步');
      say('第一次走 3 步，再把 7、6 改接 root', 'collapsing：路徑上的 node 直接指向 root');
      await beat(tok, 1500);
      F.link(6, 0); F.link(7, 0); F.relayout();
      await beat(tok, 2200);
      for (let k = 0; k < 7; k++) { b += await walk(160); setTag(cB, 'collapsing：' + b + ' 步'); }
      cur.obj.visible = false;
      say('之後 7 次各 1 步：3 + 7 = 10 步', '<span class="ok">24 → 10</span>（課本另計重設 link 的成本）');
      await beat(tok, 3400);
    } };

    // 7) 依 query 機率建 tree（延伸思考）
    LECT['p17-query-freq'] = { title: '延伸：依 query 機率讓常查的 node 靠近 root', play: async (tok) => {
      fresh(); lab.frameCamera([0, 4.6, 13.5], [0, 3, 0.5]);
      const data = [['1', 0.9], ['2', 0.05], ['其他', 0.05]];
      tag('30 天的 find 統計（老師舉例）', 'ptr', -3.6, 7.2);
      const bars = data.map(([nm, p], k) => { const m = lab.box(SETC[k], [0.9, 1, 0.9]); m.scale.y = 0.001; m.position.set(-5.4 + k * 1.6, 0, 0); lab.world.add(m); tag(nm, 'idx', -5.4 + k * 1.6, 0.1, 0.9); return { m, p }; });
      say('每個數字都有自己的 query 頻率', '例：1 佔 90%、2 佔 5%…');
      await anim(tok, 1500, (t) => bars.forEach(({ m, p }) => { m.scale.y = 0.001 + p * 5 * t; m.position.y = m.scale.y / 2; }));
      bars.forEach(({ p }, k) => tag(Math.round(p * 100) + '%', 'val', -5.4 + k * 1.6, p * 5 + 0.4));
      await beat(tok, 2400);
      const F = forest(['r', '1', '2', 'x', 'y'], { cx: 3.4, width: 4, topY: 5.8, step: 1.4, maxSp: 1.3 });
      F.order = ['r']; F.link('1', 'r'); F.link('2', 'r'); F.link('x', '2'); F.link('y', '2');
      F.spawn((e) => (e === '1' ? '#2fc092' : '#8fa3b8')); F.relayout();
      lit(F.body['1'], GOLD);
      say('目標：期望 cost 最小的 tree', 'input：數字與 query 機率；常查的 1 離 root 最近');
      await beat(tok, 4200);
      say('事後看 log 才知道；online 要預測', '類比：熱門內容多複製到使用者附近');
      await beat(tok, 4600);
    } };

    // 8) equivalence class：逐對 union
    LECT['p17-equivalence'] = { title: 'Equivalence class：每對 i ≡ j 做一次 union', play: async (tok) => {
      const focus = (ctx.params || {}).focus || 'all';
      fresh(); lab.frameCamera([0, 5.6, 13.5], [0, 3.4, 0.5]);
      const E = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      const F = forest(E, { cx: 0, width: 12, topY: 6.4, step: 1.5, maxSp: 1.05, size: [0.7, 0.5, 0.7] });
      F.spawn((e) => SETC[e]);
      const pairs = [[0, 4], [3, 1], [6, 10], [8, 9], [7, 4], [6, 8], [3, 5], [2, 11], [11, 0]];
      const pl = tag('', 'ptr alt', -5.4, 7.5);
      say('i ≡ j ⇒ 屬於同一個 set → union', 'n = 12；pairs 依課本例');
      await beat(tok, 2600);
      const fastMs = focus === 'find' ? 700 : 1000;
      for (let k = 0; k < pairs.length; k++) {
        const [i, j] = pairs[k];
        const ri = F.root(i), rj = F.root(j);
        setTag(pl, i + ' ≡ ' + j);
        lit(F.body[i], GOLD); lit(F.body[j], GOLD);
        const ci = F.count(ri), cj = F.count(rj);
        const [r, c] = ci < cj ? [rj, ri] : [ri, rj];
        say(i + ' ≡ ' + j + '：先 find root（' + ri + '、' + rj + '）', (ri !== i || rj !== j ? '要查 root 再 union；' : '') + c + ' 接到 ' + r);
        await beat(tok, fastMs);
        F.link(c, r); F.relayout(); lit(F.body[i]); lit(F.body[j]);
        await beat(tok, fastMs);
      }
      setTag(pl, '完成');
      say('剩下的 set 就是 equivalence class', '<span class="ok">{0,2,4,7,11}、{1,3,5}、{6,8,9,10}</span>');
      await beat(tok, 3200);
      if (focus === 'find') { say('用 array 查 root，比 linked list 快', '遞移關係由 union 自動處理'); await beat(tok, 3000); }
    } };

    // 9) 只給 inorder 不唯一
    LECT['p17-inorder-not-unique'] = { title: '只給 inorder BCAEDGHFI：tree 不唯一', play: async (tok) => {
      fresh(); lab.frameCamera([0, 5, 13.5], [0, 3.3, 1]);
      const seq = 'BCAEDGHFI'.split('');
      const xs = (k) => -5.6 + k * 1.4;
      const cells = seq.map((c, k) => cube(c, '#8fa3b8', SMALL, xs(k), 0.33, 2.6));
      rowLabel('in', 2.6);
      const paint = (l, k, r) => cells.forEach((b, j) => b.obj.material.color.set(j === k ? '#f2c46d' : j < k && j >= l ? '#4b9ee2' : j > k && j <= r ? '#2fc092' : '#8fa3b8'));
      say('只給 inorder：B C A E D G H F I', '能決定唯一的 binary tree 嗎？');
      await beat(tok, 2800);
      paint(0, 2, 8);
      say('挑 A 當 root：左子樹 BC、右子樹 EDGHFI', '');
      await beat(tok, 2600);
      const t1 = showTree('A(B(,C),D(E,F(G(,H),I)))', { cx: -3.3, width: 5.2, topY: 7, minY: 3.6, maxSp: 0.7 });
      tag('其中一棵', 'idx', -3.3, 7.8);
      await beat(tok, 2400);
      paint(0, 4, 8);
      say('也可以挑 D 當 root：左 BCAE、右 GHFI', '');
      await beat(tok, 2600);
      const t2 = showTree('D(A(B(,C),E),F(G(,H),I))', { cx: 3.4, width: 5.2, topY: 7, minY: 3.6, maxSp: 0.7 });
      tag('另一棵', 'idx', 3.4, 7.8);
      say('兩棵形狀不同，inorder 都是 BCAEDGHFI', '<span class="no">只給 inorder → 不唯一</span>');
      await beat(tok, 3600);
      say('再加上 preorder（或 postorder）才唯一', '例：preorder ABCDEFGHI → 左邊那棵');
      await beat(tok, 3200);
    } };

    // 10) 3 個 node、preorder 1 2 3 的 5 棵 distinct binary tree
    LECT['p17-distinct-3'] = { title: 'Preorder 1 2 3 的 5 棵 distinct binary tree', play: async (tok) => {
      fresh(); lab.frameCamera([0, 4.4, 13.5], [0, 3.4, 0]);
      const shapes = ['1(2(3,),)', '1(2(,3),)', '1(2,3)', '1(,2(3,))', '1(,2(,3))'];
      say('3 個 node、preorder 固定 1 2 3', '形狀不同就是不同的 binary tree');
      await beat(tok, 2600);
      for (let k = 0; k < 5; k++) {
        const cx = -5.4 + k * 2.7;
        const r = showTree(shapes[k], { cx, width: 1.6, topY: 6, minY: 3.4, maxSp: 0.8 });
        const ino = str(inorder(r));
        tag('in: ' + ino, 'ptr alt', cx, 1.9);
        say('第 ' + (k + 1) + ' 棵：inorder = ' + ino, 'preorder 都是 1 2 3');
        await beat(tok, 2200);
      }
      say('5 棵的 inorder 全部不同', 'preorder + inorder → 唯一決定（C₃ = 5）');
      await beat(tok, 3400);
    } };

    // 11) Tree 章節重點整理
    LECT['p17-summary'] = { title: 'Tree 章節重點：heap／BST、traversal 與應用', play: async (tok) => {
      fresh(); lab.frameCamera([0, 4.6, 13.5], [0, 3.2, 0.5]);
      const boxes = [['Heap、BST：insert、delete', -4.2], ['Traversal：pre／in／post／level', 0], ['應用：copy、equal、運算式求值', 4.2]];
      const gs = boxes.map(([t, x]) => { const g = ghost('#c08a1f', x, 3.4, 3.9, 4.6, 0, 0.4); tag(t, 'ptr', x, 6.2); return g; });
      const h = showTree('20(15(14,10),2)', { cx: -4.2, width: 2.6, topY: 5.2, minY: 2.4, maxSp: 0.9 });
      const t = showTree('+(*(A,B),C)', { cx: 0, width: 2.6, topY: 5.2, minY: 2.4, maxSp: 0.9 });
      const c1 = showTree('A(B,C)', { cx: 3.3, width: 1.2, topY: 4.6, minY: 2.6, maxSp: 0.6 });
      const c2 = showTree('A(B,C)', { cx: 5.1, width: 1.2, topY: 4.6, minY: 2.6, maxSp: 0.6 });
      say('Tree 章節結束：heap 也是一種 tree', '要知道各種 tree 的特質');
      await beat(tok, 2800);
      const caps = [['Heap、BST 會考 insert、delete', 'max heap root 最大；BST 左小右大'], ['第二個重點：traversal', 'inorder A*B+C 等'], ['traversal 的應用', 'copy、判斷相等、expression evaluation']];
      for (let k = 0; k < 3; k++) {
        gs.forEach((g, j) => { g.material.opacity = j === k ? 0.32 : 0.1; });
        say(caps[k][0], caps[k][1]);
        await beat(tok, 3200);
      }
      await beat(tok, 1000);
    } };
  }

  // @@END@@

  const scenes = {
    'trav-rules': { title: '三種走訪規則：root 在前／中／後', play: scTravRules },
    'trav-flags': { title: '畫線法：左邊＝前序、下方＝中序、右邊＝後序', play: scTravFlags },
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

  Object.assign(scenes, LECT);


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ treea.js ═══
  {
// ─── treea.js：-b2lciNd2L4（三種走訪手算）、xo41NfT8218（Abdul Bari 畫線法）、XkNIHYd9Ruc（林軒田 Tree）───
// Cued scenes: every `await step(tok)` waits for the sentence it shows; motion between steps is short.
// Nodes are little characters (buddy) holding their label; a 'pkt' tag is the visiting cursor.
const { step, buddy, travel, bob, prop, icon } = K;
const KA = K.anim;
// every step replaces both caption lines, so an old formula never lingers
const say = (a, b = '') => ctx.say(a, b);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const okT = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const noT = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const cam = (p, l) => { fresh(); if (controls) controls(''); lab.frameCamera(p, l); };
const EDGE = '#7a6a52', KIDC = '#c08a1f', SIBC = '#4b9ee2', CHILD_C = '#1f8a5a', PINK = '#e55a9b', ORANGE = '#dd8238', BLUE = '#10304a';
const killAll = (arr) => { arr.forEach((o) => kill(o)); arr.length = 0; };
const kb = (b) => kill(b.g);

// ── buddy trees ──
// binary tree (X(左,右) notation): every node n gets a buddy n.bd centred on n.pos
function bTree(src, o = {}, size = 0.62, colorOf) {
  const root = typeof src === 'string' ? parseTree(src) : src;
  layoutTree(root, Object.assign({}, TREE_O, o));
  levelorder(root).forEach((n) => { n.sz = size; n.bd = buddy(null, n.label, colorOf ? colorOf(n) : depthColor(n.depth), n.pos.x, n.pos.y - size / 2, 0, size); });
  return root;
}
function bEdges(root, color = EDGE) {
  const ls = [];
  walkPre(root, (n) => { for (const c of [n.left, n.right]) if (c && n.bd && c.bd) ls.push(K.line(n.pos.x, n.pos.y - n.sz / 2, c.pos.x, c.pos.y + c.sz / 2, -0.05, color)); });
  return ls;
}
// general tree A(B,C(D)) of buddies: layout first, show nodes when the lecturer names them
function gTree(src, o, size = 0.6) { const root = layoutG(parseG(src), o); gAll(root).forEach((n) => { n.sz = size; }); return root; }
function gShow(n, color) { n.bd = buddy(null, n.label, color || depthColor(n.depth), n.pos.x, n.pos.y - n.sz / 2, 0, n.sz); return n.bd; }
function gLines(root) { for (const n of gAll(root)) for (const k of n.kids) if (!k.ln && n.bd && k.bd) k.ln = K.line(n.pos.x, n.pos.y - n.sz / 2, k.pos.x, k.pos.y + k.sz / 2, -0.05, EDGE); }
const gN = (root, l) => gAll(root).find((n) => n.label === l);
const nodeOf = (r, l) => levelorder(r).find((n) => n.label === l);
// buddies fall in from above
async function dropIn(tok, bds, ms = 700, h = 2.5) {
  const ys = bds.map((b) => b.g.position.y);
  bds.forEach((b, i) => { b.g.position.y = ys[i] + h; });
  await KA(tok, ms, (u) => bds.forEach((b, i) => { b.g.position.y = ys[i] + h * (1 - u); }));
}
// a cursor tag that walks to a node
const above = (n, dy = 0.85) => V(n.pos.x, n.pos.y + dy, 0.3);
async function walkTo(tok, cur, n, ms = 800) { await travel(tok, cur, cur.position.clone(), above(n), ms); }
// a printed node: a small copy flies to the output row, the buddy cheers
async function emit(tok, row, n) {
  const b = cube(n.label, depthColor(n.depth), SMALL, n.pos.x, n.pos.y, 0);
  lab.springTo(b, rowPos(row.n++, row.z));
  n.bd.mood('happy'); n.bd.glow(GOLD);
  await n.bd.hop(tok);
}
// a box around a general-tree subtree (cube nodes or buddies)
function boxG(n, color, pad = 0.12) {
  const all = gAll(n), hw = (m) => (m.bd ? m.sz * 0.6 : W(m.label) / 2);
  const x0 = Math.min(...all.map((m) => m.pos.x - hw(m))) - pad, x1 = Math.max(...all.map((m) => m.pos.x + hw(m))) + pad;
  const y0 = Math.min(...all.map((m) => m.pos.y)) - 0.45, y1 = n.pos.y + 0.45;
  return ghost(color, (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0);
}
// cube nodes of a general tree (wide Chinese labels)
function cNode(n, drop = 0, color) { n.body = cube(n.label, color || depthColor(n.depth), [W(n.label), 0.6, 0.8], n.pos.x, n.pos.y, 0, drop); return n.body; }
function cEdges(root) { return edgeLines(() => { const out = []; for (const n of gAll(root)) for (const k of n.kids) if (n.body && k.body) out.push([n.body.obj.position, k.body.obj.position]); return out; }); }
// lines that follow moving cube bodies: pairs() → [[posA, posB], …]
function dynLines(pairs, color) {
  const MAX = 24, geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 6), 3));
  const ls = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color }));
  ls.frustumCulled = false;
  ls.onBeforeRender = () => {
    const a = geo.attributes.position.array; let k = 0;
    for (const [P, C] of pairs()) { if (k >= MAX * 6) break; a[k++] = P.x; a[k++] = P.y; a[k++] = P.z - 0.05; a[k++] = C.x; a[k++] = C.y; a[k++] = C.z - 0.05; }
    geo.setDrawRange(0, k / 3); geo.attributes.position.needsUpdate = true;
  };
  lab.world.add(ls); return ls;
}
const relab = (b, t) => b.obj.children.forEach((c) => { if (c.element) c.element.textContent = String(t); });

// ═════════ -b2lciNd2L4：Binary Tree Traversals（印度老師手算三種走訪）═════════
const HIN = 'A(B(,D),C(E(G,),F(H,I)))';
// the walking helpers shared by the three traversal scenes
function hSetup(rule) {
  cam([0, 5, 13.5], [0, 3.2, 0.8]);
  const r = bTree(HIN, { topY: 6.4, minY: 2.6 });
  bEdges(r);
  rowLabel('輸出', 2.4);
  bub(rule, 0, 7.5);
  return { r, row: { z: 2.4, n: 0 } };
}
function hKit(tok, r, row) {
  const N = (l) => nodeOf(r, l); let cur = null; const notes = [], outs = [];
  return {
    N,
    async go(l, ms = 800) {
      const n = N(l);
      if (!cur) { cur = pkt('走到這', n.pos.x, n.pos.y + 0.85, 0.3); return; }
      await walkTo(tok, cur, n, ms);
    },
    async out(l) { outs.push(l); await emit(tok, row, N(l)); },
    hold(l, t = '先不印') { const n = N(l); n.bd.mood('wow'); notes.push(note(t, n.pos.x + 1.0, n.pos.y + 0.15)); },
    none(l, side) { const n = N(l); notes.push(tag('∅ 沒東西', 'idx', n.pos.x + (side === 'L' ? -0.85 : 0.85), n.pos.y - 0.85)); },
    clr() { killAll(notes); },
    seq() { return '輸出：' + (outs.join(' ') || '—'); },
    mark(l, t, cls = 'note') { const n = N(l); notes.push(tag(t, cls, n.pos.x, n.pos.y - 0.95)); },
  };
}

// 0:14 三種走訪的定義
FRAG.push(['treea-h-rules', '三種走訪：root 在前、中、後', async (tok) => {
  cam([0, 4.6, 13.5], [0, 3.6, 0]);
  await step(tok);                                   // 0:14 this one is the tree
  const r = bTree(HIN, { cx: -3.6, width: 5.6, topY: 6.4, minY: 2.4, maxSp: 0.7 }, 0.52);
  await dropIn(tok, levelorder(r).map((n) => n.bd), 700);
  bEdges(r);
  bub('要找出三種 traversal', -3.6, 7.3);
  say('例子：一棵 binary tree', '要找出 inorder、preorder、postorder');
  const minis = {};
  async function mini(key, name, cx) {
    const R = buddy(null, '根', '#2fc092', cx, 4.05, 0, 0.5), L = buddy(null, '左', '#4b9ee2', cx - 0.7, 2.65, 0, 0.5), Rr = buddy(null, '右', '#9b7ef4', cx + 0.7, 2.65, 0, 0.5);
    K.line(cx, 4.05, cx - 0.7, 3.15, -0.05, EDGE); K.line(cx, 4.05, cx + 0.7, 3.15, -0.05, EDGE);
    tag(name, 'ptr', cx, 5.2);
    await dropIn(tok, [R, L, Rr], 600);
    minis[key] = { cx, map: { V: R, L, R: Rr }, pos: { V: [cx, 4.3], L: [cx - 0.7, 2.9], R: [cx + 0.7, 2.9] } };
  }
  async function number(key, ord) {
    const m = minis[key];
    const c = pkt('👆', m.cx, 5.0, 0.3);
    for (let s = 0; s < 3; s++) {
      const [x, y] = m.pos[ord[s]];
      await travel(tok, c, c.position.clone(), V(x, y + 0.55, 0.3), 380);
      tag(String(s + 1), 'ptr alt', x, y - 0.62);
    }
    kill(c);
  }
  await step(tok);                                   // 0:25 in order means left root right
  await mini('in', 'Inorder', 1.2);
  say('Inorder：left → root → right', '左、根、右');
  await step(tok);                                   // 0:43 first left, then root, then right
  await number('in', ['L', 'V', 'R']);
  say('先走左邊，再印 root，最後右邊', 'Inorder = L V R');
  await step(tok);                                   // 0:50 in = 中間
  minis.in.map.V.glow(GOLD); minis.in.map.V.mood('happy');
  bub('in = 中間', 1.2, 6.0);
  say('in 的意思是「中間」', 'root 夾在左右中間');
  await step(tok);                                   // 0:58 preorder: root then left then
  await mini('pre', 'Preorder', 3.4);
  await number('pre', ['V', 'L', 'R']);
  minis.pre.map.V.glow(GOLD);
  say('Preorder：root → left → right', 'pre = 前：root 最先');
  await step(tok);                                   // 1:07 postorder: left, right, root
  await mini('post', 'Postorder', 5.6);
  await number('post', ['L', 'R', 'V']);
  minis.post.map.V.glow(GOLD);
  say('Postorder：left → right → root', 'post = 後：root 最後');
  await step(tok);                                   // 1:22 recap: in = between, pre = before
  okT('root 在中間', 1.2, 1.7); okT('root 在最前', 3.4, 1.4); okT('root 在最後', 5.6, 1.7);
  for (const k of ['in', 'pre', 'post']) minis[k].map.V.mood('happy');
  await minis.pre.map.V.hop(tok);
  say('名字 = root 的位置', 'pre 前、in 中、post 後；左一定在右前面');
}]);

// 1:39 Inorder：B D A G E C H F I
FRAG.push(['treea-h-in', 'Inorder（L V R）：B D A G E C H F I', async (tok) => {
  const { r, row } = hSetup('Inorder：左 → 根 → 右');
  const h = hKit(tok, r, row);
  await step(tok);                                   // 1:39 inorder traversal of this tree
  say('Inorder：left → root → right', '先把左邊全部做完，才輪到 root');
  await step(tok);                                   // 1:49 start from the root
  await h.go('A');
  say('從 root A 開始', h.seq());
  await step(tok);                                   // 2:03 don't write the root first
  h.hold('A', 'A 先不印：左邊還沒做');
  say('A 是 root：先不寫', '要先寫它的左邊');
  await step(tok);                                   // 2:09 go left — B is also a root
  await h.go('B');
  h.hold('B', 'B 也是 root！');
  say('往左走到 B', 'B 是左邊，但它自己也是 root');
  await step(tok);                                   // 2:17 don't write B, go to its left
  say('B 也先不寫', '先往 B 的左邊看');
  await step(tok);                                   // 2:23 left is null
  h.none('B', 'L');
  say('B 的左邊什麼都沒有（null）', '左邊做完了');
  await step(tok);                                   // 2:29 print B
  h.clr(); h.hold('A', 'A 還在等');
  await h.out('B');
  say('左邊做完 → 印 root：B', h.seq());
  await step(tok);                                   // 2:36 right is D, print D
  await h.go('D');
  await h.out('D');
  say('B 的右邊是 D：D 沒有小孩，直接印', h.seq());
  await step(tok);                                   // 2:47 back to A: left part done
  await h.go('B', 500); await h.go('A', 600);
  h.clr();
  await h.out('A');
  say('回到 A：左子樹做完，印 A', h.seq());
  await step(tok);                                   // 2:55 now go to the right part
  await h.go('C');
  say('換右半部：走到 C', h.seq());
  await step(tok);                                   // 3:13 this right part is a subtree
  h.hold('C', 'C 是 subtree 的 root');
  say('C 是一棵 subtree 的 root', '不能直接寫：先處理它的左邊');
  await step(tok);                                   // 3:23 go left — E is a root too
  await h.go('E');
  h.hold('E', 'E 也是 root');
  say('往左到 E：E 也是 root', '還是不能寫，再往左');
  await step(tok);                                   // 3:32 left is G; nothing on G's left
  await h.go('G');
  h.none('G', 'L');
  say('到 G：G 的左邊沒東西', '左邊做完了');
  await step(tok);                                   // 3:37 print G
  await h.out('G');
  say('印 G', h.seq());
  await step(tok);                                   // 3:45 backtrack, print root E
  await h.go('E', 600);
  await h.out('E');
  say('回到 E：左邊做完，印 E', h.seq());
  await step(tok);                                   // 3:50 E's right: nothing
  h.none('E', 'R');
  await h.go('C', 600);
  say('E 的右邊沒東西 → 回到 C', 'C 的左半部完成');
  await step(tok);                                   // 4:04 print root C
  h.clr();
  await h.out('C');
  say('C 的左邊做完 → 印 C', h.seq());
  await step(tok);                                   // 4:12 right part F — F is a root
  await h.go('F');
  h.hold('F', 'F 有 H、I 兩個小孩');
  say('右邊是 F，但 F 是 H、I 的 root', '不能直接印 F');
  await step(tok);                                   // 4:20 go left to H
  await h.go('H');
  say('先往左：H', 'H 的左邊沒東西');
  await step(tok);                                   // 4:29 print H
  await h.out('H');
  say('印 H', h.seq());
  await step(tok);                                   // 4:42 back to F, then I
  await h.go('F', 500);
  h.clr();
  await h.out('F');
  await h.go('I', 500);
  await h.out('I');
  say('回到 F 印 F，最後右邊的 I', h.seq());
  await step(tok);                                   // 4:51 this is the inorder traversal
  okT('Inorder = B D A G E C H F I', 0, 1.3, 2.4);
  say('Inorder 完成', '<span class="ok">B D A G E C H F I</span>');
}]);

// 5:05 Preorder：A B D C E G F H I
FRAG.push(['treea-h-pre', 'Preorder（V L R）：A B D C E G F H I', async (tok) => {
  const { r, row } = hSetup('Preorder：根 → 左 → 右');
  const h = hKit(tok, r, row);
  await step(tok);                                   // 5:05 pre = first: root printed first
  say('Preorder：root 先印', '然後左、再右');
  await step(tok);                                   // 5:14 root is printed: A
  await h.go('A');
  await h.out('A');
  say('從 root 開始：A 直接印', h.seq());
  await step(tok);                                   // 5:23 go to the left part
  await h.go('B');
  say('往左邊走到 B', h.seq());
  await step(tok);                                   // 5:29 B is a root too → print B
  await h.out('B');
  say('B 也是 root：root 一到就印', h.seq());
  await step(tok);                                   // 5:41 B's left: nothing
  h.none('B', 'L');
  say('B 的左邊沒東西', '接著看右邊');
  await step(tok);                                   // 5:46 right is D: print D
  await h.go('D');
  await h.out('D');
  say('右邊是 D：印 D', h.seq());
  await step(tok);                                   // 5:52 back to B, back to A
  await h.go('B', 500); await h.go('A', 600);
  h.clr();
  say('回到 B、再回到 A', 'A 的左半部完成');
  await step(tok);                                   // 6:02 right part: C
  await h.go('C');
  await h.out('C');
  say('右半部：C 是 root → 先印 C', '（這段錄音不清楚，依 V L R 規則）');
  await step(tok);                                   // 6:07 E
  await h.go('E');
  await h.out('E');
  say('往左到 E：E 是 root → 印 E', h.seq());
  await step(tok);                                   // 6:20 G
  await h.go('G');
  await h.out('G');
  say('再往左到 G：印 G', h.seq());
  await step(tok);                                   // 6:54 go to the right part: F with H and I
  await h.go('E', 400); await h.go('C', 400); await h.go('F', 600);
  say('C 的左邊做完 → 右邊 F', 'F 有 H、I 兩個小孩');
  await step(tok);                                   // 7:01 F is root → print F
  await h.out('F');
  say('F 是 root：先印 F', h.seq());
  await step(tok);                                   // 7:11 then left: H
  await h.go('H');
  await h.out('H');
  say('然後左邊：H', h.seq());
  await step(tok);                                   // 7:17 then right: I
  await h.go('I');
  await h.out('I');
  okT('Preorder = A B D C E G F H I', 0, 1.3, 2.4);
  say('最後右邊：I', '<span class="ok">A B D C E G F H I</span>');
}]);

// 7:24 Postorder：D B G E H I F C A
FRAG.push(['treea-h-post', 'Postorder（L R V）：D B G E H I F C A', async (tok) => {
  const { r, row } = hSetup('Postorder：左 → 右 → 根');
  const h = hKit(tok, r, row);
  await step(tok);                                   // 7:32 post = after: root last
  say('Postorder：left → right → root', 'post = 之後：root 最後才印');
  await step(tok);                                   // 7:40 start here, don't print root
  await h.go('A');
  h.hold('A', 'A 最後才印');
  say('從 A 開始，但 A 要最後印', '先往左走');
  await step(tok);                                   // 7:46 B has its own subtree
  await h.go('B');
  h.hold('B', 'B 是 D 的 root');
  say('到 B：B 有小孩 D', 'B 是 root → 也要最後印');
  await step(tok);                                   // 8:03 left: nothing; go to B's right
  h.none('B', 'L');
  say('B 的左邊沒東西', '接著去 B 的右邊');
  await step(tok);                                   // 8:09 right is D: print D, then root B
  await h.go('D');
  await h.out('D');
  await h.go('B', 500);
  await h.out('B');
  say('印 D，左右都做完 → 印 B', h.seq());
  await step(tok);                                   // 8:19 A's left part is printed
  h.clr(); h.hold('A', 'A 還在等');
  await h.go('A', 600);
  say('回到 A：左半部印完了', 'A 還不能印：右邊還沒做');
  await step(tok);                                   // 8:33 go to the right part
  await h.go('C');
  say('往右半部走：C', h.seq());
  await step(tok);                                   // 8:43 C is a root: can't print
  h.hold('C', 'C 是 root → 最後印');
  say('C、E、F 這一塊：C 是 root', 'root 最後印，先處理左邊');
  await step(tok);                                   // 8:53 C's left: E — still a root (of G)
  await h.go('E');
  h.hold('E', 'E 是 G 的 root');
  say('往 C 的左邊到 E', 'E 是 G 的 root → 還不能印');
  await step(tok);                                   // 9:03 go to G: G's left is nothing
  await h.go('G');
  h.none('G', 'L');
  say('再往左到 G：G 左邊沒東西', 'G 的右邊也沒東西');
  await step(tok);                                   // 9:08 print G
  await h.out('G');
  say('印 G', h.seq());
  await step(tok);                                   // 9:20 E's right is nothing → print E
  await h.go('E', 600);
  h.none('E', 'R');
  await h.out('E');
  say('E 的右邊沒東西 → 印 root E', h.seq());
  await step(tok);                                   // 9:30 backtrack to C, C not printed
  await h.go('C', 600);
  say('回到 C：左半部印完', 'C 還不能印：右半部還沒做');
  await step(tok);                                   // 9:36 right part F: root of H and I
  await h.go('F');
  h.hold('F', 'F 是 H、I 的 root');
  say('到 C 的右半部：F', 'F 是 H、I 的 root → 最後印');
  await step(tok);                                   // 9:52 go left: print H
  await h.go('H');
  await h.out('H');
  say('先左：印 H', h.seq());
  await step(tok);                                   // 9:58 then right: I
  await h.go('I');
  await h.out('I');
  say('再右：印 I', h.seq());
  await step(tok);                                   // 10:06 then root F
  await h.go('F', 600);
  await h.out('F');
  say('左右都做完 → 印 root F', h.seq());
  await step(tok);                                   // 10:20 left and right of C done → C
  await h.go('C', 600);
  await h.out('C');
  say('C 的左、右都印好 → 印 C', h.seq());
  await step(tok);                                   // 10:30 back to A: both sides printed
  await h.go('A', 700);
  say('回到 A：左半部、右半部都印好了', '最後才是 root');
  await step(tok);                                   // 10:35 A would be printed
  h.clr();
  await h.out('A');
  okT('Postorder = D B G E H I F C A', 0, 1.3, 2.4);
  say('最後印 root：A', '<span class="ok">D B G E H I F C A</span>');
}]);

// ═════════ xo41NfT8218：Abdul Bari〈Tree Traversal〉畫線法 ═════════
FRAG.push(['treea-b-rules', '三種走訪與 3 個節點的小樹', async (tok) => {
  cam([0, 4.6, 13.5], [0, 3.6, 0]);
  const rows = { pre: 5.6, in: 4.1, post: 2.6 };
  const names = { pre: 'Pre-order', in: 'In-order', post: 'Post-order' };
  const B = {};
  async function row(k, ord) {
    const lbl = { V: '根', L: '左', R: '右' }, col = { V: '#2fc092', L: '#4b9ee2', R: '#9b7ef4' };
    B[k] = ord.map((c, i) => { const b = buddy(null, lbl[c], col[c], -4.2 + i * 1.2, rows[k] - 0.27, 0, 0.55); b.kind = c; return b; });
    await dropIn(tok, B[k], 600);
  }
  await step(tok);                                   // 0:01 pre-order, in-order and post-order
  for (const k of ['pre', 'in', 'post']) tag(names[k], 'ptr', -6.1, rows[k]);
  say('最常用的三種走訪', 'pre-order、in-order、post-order');
  await step(tok);                                   // 0:10 pre: root, left, right; in: root in between
  await row('pre', ['V', 'L', 'R']);
  await row('in', ['L', 'V', 'R']);
  say('pre：root、left、right', 'in：left、root、right（root 夾中間）');
  await step(tok);                                   // 0:33 post: left, right, then root
  await row('post', ['L', 'R', 'V']);
  say('post：先 left、再 right、最後 root', '左一定在右的前面');
  await step(tok);                                   // 0:42 root first, middle, last
  for (const k of ['pre', 'in', 'post']) B[k].forEach((b) => { if (b.kind === 'V') { b.glow(GOLD); b.mood('happy'); } });
  okT('最前', -0.4, rows.pre); okT('中間', -0.4, rows.in); okT('最後', -0.4, rows.post);
  say('觀察 root 的位置', 'pre 最前、in 中間、post 最後');
  await step(tok);                                   // 0:51 traversing = visiting every node once
  bub('走訪 = 每個 node 拜訪剛好一次', 3.4, 7.0);
  say('traversal：每個 node 都拜訪一次', '三種只差在「什麼順序」');
  await step(tok);                                   // 1:03 take a small tree
  const A = buddy(null, 'A', '#2fc092', 3.4, 5.4 - 0.3, 0, 0.6), Bn = buddy(null, 'B', '#4b9ee2', 2.2, 3.9 - 0.3, 0, 0.6), C = buddy(null, 'C', '#4b9ee2', 4.6, 3.9 - 0.3, 0, 0.6);
  await dropIn(tok, [A, Bn, C], 600);
  K.line(3.4, 5.1, 2.2, 4.2, -0.05, EDGE); K.line(3.4, 5.1, 4.6, 4.2, -0.05, EDGE);
  note('示意：3 個 node、高度 1', 3.4, 6.2);
  say('拿一棵小樹來試', 'root A，左 B、右 C（示意）');
  const P = { A: [3.4, 5.4, A], B: [2.2, 3.9, Bn], C: [4.6, 3.9, C] };
  const cur = pkt('👆', 3.4, 6.6, 0.3); cur.element.style.visibility = 'hidden';
  async function run(seq, name, y) {
    cur.element.style.visibility = '';
    const t = tag(name + '：', 'ptr', 3.4, y); let s = name + '：';
    for (const l of seq) {
      const [x, yy, b] = P[l];
      await travel(tok, cur, cur.position.clone(), V(x, yy + 0.7, 0.3), 420);
      s += ' ' + l; t.element.textContent = s; b.glow(GOLD);
    }
    [A, Bn, C].forEach((b) => b.glow());
  }
  await step(tok);                                   // 1:09 pre-order: root, left child, right child
  await run(['A', 'B', 'C'], 'pre', 2.6);
  say('pre-order：root → 左 → 右', 'A B C');
  await step(tok);                                   // 1:25 in-order: left child, root, right child
  await run(['B', 'A', 'C'], 'in', 2.0);
  say('in-order：左 → root → 右', 'B A C');
  await step(tok);                                   // 1:38 post-order: left, right, then root
  await run(['B', 'C', 'A'], 'post', 1.4);
  A.mood('happy'); await A.hop(tok);
  say('post-order：左 → 右 → root', 'B C A；接下來看大一點的樹');
}]);

// Bari 的畫線法：從每個 node 的左邊／正下方／右邊拉線到底線，由左往右讀
const BARI = '3(6(5,2),4(9,8))';
const BARI_AT = { pre: [-0.45, 0], in: [0, -0.36], post: [0.45, 0] };
const BX = (k) => -4.8 + k * 1.6, BASE_Y = 1.2;
function bariTree() { const r = bTree(BARI, { topY: 6.4, minY: 3.4 }, 0.62); return r; }
const bariOrder = (r, kind) => travSteps(r, kind).filter((s) => s.emit).map((s) => s.n);
function baseLine() { const l = K.line(-6.2, BASE_Y, 6.2, BASE_Y, 0, '#5a4a32'); tag('底線', 'idx', -6.3, BASE_Y + 0.35); return l; }
function flag(n, kind, k) { const [dx, dy] = BARI_AT[kind]; return K.line(n.pos.x + dx, n.pos.y + dy, BX(k), BASE_Y, 0.1, '#c08a1f'); }
async function bariLabels(tok, ord) {
  const out = [];
  for (let k = 0; k < ord.length; k++) { out.push(cube(ord[k].label, depthColor(ord[k].depth), SMALL, BX(k), BASE_Y - 0.6, 0.2, 1.5)); await beat(tok, 220); }
  return out;
}
async function bariRead(tok, ord, labels) {
  const c = pkt('讀 →', BX(0) - 0.9, BASE_Y - 1.3, 0.4);
  for (let k = 0; k < ord.length; k++) { await travel(tok, c, c.position.clone(), V(BX(k), BASE_Y - 1.3, 0.4), 300); lit(labels[k], GOLD); }
}
async function bariFlagScene(tok, kind, name, res) {
  cam([0, 4.4, 13.5], [0, 3.4, 0]);
  const r = bariTree(); bEdges(r);
  const ord = bariOrder(r, kind), where = { pre: '左邊', in: '正下方', post: '右邊' }[kind];
  tag(name, 'ptr', -5.6, 6.6);
  await step(tok);                                   // same tree; draw a line at the bottom
  baseLine();
  say(name + '：一樣在樹的底下畫一條線', '同一棵樹 3(6(5,2),4(9,8))');
  await step(tok);                                   // from every node, from its <where>
  for (let k = 0; k < ord.length; k++) { flag(ord[k], kind, k); ord[k].bd.glow(GOLD); await beat(tok, 260); }
  say('從每個 node 的「' + where + '」拉線到底線', '一個 node 一條線');
  await step(tok);                                   // make sure they are not intersecting
  okT('線彼此不交叉 ✓', 4.6, 2.3);
  levelorder(r).forEach((n) => { n.bd.glow(); n.bd.mood('happy'); });
  say('注意：線彼此不能交叉', '交叉的話，讀出的順序就錯了');
  await step(tok);                                   // the nodes we are getting
  const labels = await bariLabels(tok, ord);
  say('每條線落到底線的位置', ord.map((n) => n.label).join(' '));
  await step(tok);                                   // read from left to right
  await bariRead(tok, ord, labels);
  say('由左往右讀底線', ord.map((n) => n.label).join(' '));
  await step(tok);                                   // that is the <kind> traversal
  okT(name + ' = ' + res, 0, 0.0, 0.4);
  say(name + ' 完成', '<span class="ok">' + res + '</span>');
}

// 1:54 畫線法求 Pre-order
FRAG.push(['treea-b-pre', '畫線法求 Pre-order：3 6 5 2 4 9 8', async (tok) => {
  cam([0, 4.4, 13.5], [0, 3.4, 0]);
  await step(tok);                                   // 1:54 traversals for this particular tree
  const r = bariTree();
  await dropIn(tok, levelorder(r).map((n) => n.bd), 700);
  bEdges(r);
  const ord = bariOrder(r, 'pre');
  say('大一點的例子', 'root 3；左 6（5、2），右 4（9、8）');
  await step(tok);                                   // 2:18 an easy method — first pre-order
  tag('Pre-order', 'ptr', -5.6, 6.6);
  bub('簡單方法：畫線法', 4.8, 6.8);
  say('教你一個簡單的方法：先做 pre-order', '');
  await step(tok);                                   // 2:32 a straight line at the bottom
  baseLine();
  say('在樹的底部畫一條直線', '');
  await step(tok);                                   // 2:41 from the left-hand side of a node
  flag(ord[0], 'pre', 0); ord[0].bd.glow(GOLD);
  say('從 node 的「左邊」拉一條線', '接到底線上（先畫 3 的）');
  await step(tok);                                   // 2:49 for every node, from the left
  for (let k = 1; k < ord.length; k++) { flag(ord[k], 'pre', k); ord[k].bd.glow(GOLD); await beat(tok, 260); }
  levelorder(r).forEach((n) => { n.bd.glow(); });
  say('每個 node 都從左邊拉一條線', '線彼此不交叉');
  await step(tok);                                   // 3:09 this is for 3, 6, 5, 2, 4, 9, 8
  const labels = await bariLabels(tok, ord);
  say('每條線屬於哪個 node', '3、6、5、2、4、9、8');
  await step(tok);                                   // 3:25 left to right: 3 6 5 2 4 9 8
  await bariRead(tok, ord, labels);
  say('由左往右讀', '3 6 5 2 4 9 8');
  await step(tok);                                   // 3:36 this is the pre-order of a tree
  okT('Pre-order = 3 6 5 2 4 9 8', 0, 0.0, 0.4);
  ord[0].bd.mood('happy'); await ord[0].bd.hop(tok);
  say('這就是 pre-order', '<span class="ok">3 6 5 2 4 9 8</span>');
}]);
FRAG.push(['treea-b-in', '畫線法求 In-order：5 6 2 3 9 4 8', (tok) => bariFlagScene(tok, 'in', 'In-order', '5 6 2 3 9 4 8')]);
FRAG.push(['treea-b-post', '畫線法求 Post-order：5 2 6 9 8 4 3', (tok) => bariFlagScene(tok, 'post', 'Post-order', '5 2 6 9 8 4 3')]);

// ═════════ XkNIHYd9Ruc：台大林軒田 DSA〈Tree〉═════════
const NTU = 'NTU(理學院(數學系,物理系),工學院(土木系),社科院,電資學院(資訊系,電機系))';
const NTU_O = { width: 11, topY: 6.4, step: 1.9 };
const TERMS = 'A(B(E(K,L),F),C(G),D(H(M),I,J))';
const TERMS_O = { width: 10.6, cx: 0.4, topY: 6.5, step: 1.55 };
function ntuTree(drop = 0) { const root = layoutG(parseG(NTU), NTU_O); cEdges(root); gAll(root).forEach((n) => cNode(n, drop)); return root; }
// the lecturer's 13-node tree, as buddies; upTo = deepest depth shown
function termsTree(upTo = 3) { const root = gTree(TERMS, TERMS_O, 0.6); gAll(root).filter((n) => n.depth <= upTo).forEach((n) => gShow(n)); gLines(root); return root; }
const dTagX = -6.4;

// 26:47 Tree：有階層關係（vector／list 是平的）
FRAG.push(['treea-lin-hier', 'Vector／list 是平的，tree 有階層', async (tok) => {
  cam([0, 4.6, 13.5], [0, 3.6, 0]);
  await step(tok);                                   // 26:47 今天要講的東西叫做 tree
  const tr = icon('🌳', 'tree', 0, 5.6, 0, 'lg');
  say('今天的新資料結構：tree（樹）', '資訊系的樹，跟園藝系的樹有點不一樣');
  await step(tok);                                   // 27:06 compare with vector 或 list
  kill(tr);
  const items = ['NTU', '理', '工', '電資', '數學', '資訊', '電機'];
  const bs = [], tmp = [];
  for (let i = 0; i < items.length; i++) { bs.push(cube(items[i], '#4b9ee2', [1.3, 0.6, 0.8], -4.8 + i * 1.6, 1.0, 0, 3)); tmp.push(tag('[' + i + ']', 'idx', -4.8 + i * 1.6, 0.25)); await beat(tok, 150); }
  say('先回想 vector：資料攤成一排', '示意：拿台大組織的 7 筆資料來排');
  await step(tok);                                   // 27:24 hierarchical
  const hb = bub('tree 想表達：hierarchical（階層）', 0, 5.6);
  say('tree 要做到的是 hierarchical', '有上下、有階層的關係');
  await step(tok);                                   // 27:57 vector、linked list 是平平的
  for (let i = 0; i + 1 < items.length; i++) tmp.push(arrow(V(-4.8 + i * 1.6 + 0.66, 1.0, 0), V(-4.8 + (i + 1) * 1.6 - 0.66, 1.0, 0), KIDC));
  tmp.push(note('平平的：一大塊攤平，或一串人排隊', 0, 2.3));
  say('vector／linked list：平平的', '攤成一塊，或排成一串');
  await step(tok);                                   // 28:11 沒有上下關係 — 什麼叫有階層？
  tmp.push(noT('誰管誰？看不出來', 0, 3.2));
  say('排成一列：看不出上下關係', '那「有階層」的資料長什麼樣？');
  await step(tok);                                   // 28:28 舉例：台大的組織架構
  killAll(tmp); kill(hb);
  const P = [[0, 6.3], [-4, 4.6], [0, 4.6], [4, 4.6], [-4, 2.9], [2.9, 2.9], [5.1, 2.9]];
  const C = ['#2fc092', '#4b9ee2', '#4b9ee2', '#4b9ee2', '#9b7ef4', '#9b7ef4', '#9b7ef4'];
  bs.forEach((b, i) => { lab.springTo(b, V(P[i][0], P[i][1], 0)); b.obj.material.color.set(C[i]); });
  const E = [[0, 1], [0, 2], [0, 3], [1, 4], [3, 5], [3, 6]];
  edgeLines(() => E.map(([a, c]) => [bs[a].obj.position, bs[c].obj.position]));
  tag('學校', 'idx', -6.3, 6.3); tag('學院', 'idx', -6.3, 4.6); tag('系', 'idx', -6.3, 2.9);
  say('例如台大的組織：有上有下', '學校 → 學院 → 系');
}]);

// 29:17 例子：台大組織架構與檔案目錄
FRAG.push(['treea-lin-ntu', '例子：台大組織圖與檔案目錄', async (tok) => {
  cam([0, 4.6, 13.5], [0, 3.9, 0]);
  const root = layoutG(parseG(NTU), NTU_O); cEdges(root);
  const N = (l) => gFind(root, l);
  await step(tok);                                   // 29:17 台大之下：例如理學院
  cNode(root, 3); cNode(N('理學院'), 3);
  tag('學校', 'ptr', -6.3, 6.4);
  say('台大之下有哪些組織？', '例如：理學院');
  await step(tok);                                   // 29:29 工學院、社會科學院
  cNode(N('工學院'), 3); await beat(tok, 300); cNode(N('社科院'), 3);
  say('還有工學院、社會科學院', '');
  await step(tok);                                   // 29:43 電機資訊學院 — 上到下的階層
  cNode(N('電資學院'), 3);
  tag('學院', 'ptr', -6.3, 4.5);
  say('還有電機資訊學院', '學校 → 學院：上到下的階層');
  await step(tok);                                   // 30:03 每一個都當作一筆資料
  for (const l of ['NTU', '電資學院', '理學院']) lit(N(l).body, GOLD);
  const t1 = note('每個單位 = 一筆資料', 3.6, 7.1);
  say('台大、電資、理學院：都是一筆資料', '這些資料彼此有上下關聯');
  await step(tok);                                   // 30:16 理學院：數學系、物理系
  for (const l of ['NTU', '電資學院', '理學院']) lit(N(l).body);
  kill(t1);
  cNode(N('數學系'), 3); await beat(tok, 250); cNode(N('物理系'), 3);
  tag('系', 'ptr', -6.3, 2.6);
  say('學院裡面有系：理學院有數學系、物理系', '');
  await step(tok);                                   // 30:22 工學院：土木系
  cNode(N('土木系'), 3);
  say('工學院有土木系', '');
  await step(tok);                                   // 30:34 電資學院：資訊系、電機系
  cNode(N('資訊系'), 3); await beat(tok, 250); cNode(N('電機系'), 3);
  say('電資學院有資訊系、電機系', '（老師玩笑：資訊系要寫在前面）');
  await step(tok);                                   // 32:13 學校 → 學院 → 系所
  for (const d of [0, 1, 2]) { gAll(root).filter((n) => n.depth === d).forEach((n) => lit(n.body, GOLD)); await beat(tok, 550); gAll(root).filter((n) => n.depth === d).forEach((n) => lit(n.body)); }
  say('一層一層往下：這就是階層', '學校 → 學院 → 系所');
  await step(tok);                                   // 32:34 這樣的 data structure 就叫做 tree
  okT('資料 + 上下關係 = tree', 0, 7.3);
  say('把資料和它們的關係一起存', '這樣的 data structure 叫 tree');
  await step(tok);                                   // 32:51 著重階層、從屬關係
  const e = N('電資學院');
  arrow(V(e.pos.x - 0.3, e.pos.y + 0.35, 0.5), V(-0.4, 6.05, 0.5), KIDC);
  arrow(V(e.pos.x + 0.3, e.pos.y - 0.35, 0.5), V(N('電機系').pos.x, N('電機系').pos.y + 0.35, 0.5), SIBC);
  note('往上看：屬於誰', e.pos.x - 2.1, 5.3); note('往下看：管哪些', e.pos.x + 1.4, 3.4);
  say('tree 著重：階層、從屬的關係', '往上看屬於誰，往下看管哪些');
  await step(tok);                                   // 33:22 電腦裡的目錄
  gAll(root).forEach((n) => { lab.flyAway(n.body, V((Math.random() - 0.5) * 4, 7, 3)); n.body = null; });
  await beat(tok, 500);
  cam([0, 4.6, 13.5], [0, 3.9, 0]);
  const dir = layoutG(parseG('/(home(user(hw2.c,notes.txt)),usr(bin))'), { width: 7, topY: 6.4, step: 1.4, cx: 0.6 });
  cEdges(dir);
  for (const n of gAll(dir).filter((m) => m.kids.length)) cNode(n, 3, '#e2b13c');
  prop('file', -4.6, 3.4, 0, 1.2, '你的電腦');
  say('另一個常見例子：電腦裡的目錄', '目錄 → 子目錄 → 再下一層子目錄');
  await step(tok);                                   // 33:32 最後到一個檔案
  for (const n of gAll(dir).filter((m) => !m.kids.length)) { cNode(n, 3, '#2fc092'); await beat(tok, 250); }
  okT('檔案系統也是 tree', 0.6, 0.6);
  say('最底下是一個一個檔案', 'Windows、Mac、Linux 的檔案系統都是 tree');
}]);

// 34:49 Tree 的定義：root + subtrees
FRAG.push(['treea-lin-def', 'Tree = root + subtrees', async (tok) => {
  cam([0, 4.6, 13.5], [0, 3.9, 0]);
  await step(tok);                                   // 34:49 有一個最高最高的地方
  const root = ntuTree(2);
  say('看這棵樹：有一個最高的地方', '階層裡最高的那一個');
  await step(tok);                                   // 35:07 叫做 root
  lit(root.body, GOLD);
  tag('root', 'ptr alt', 1.5, 6.4);
  say('最高的 node 叫 root', 'root = 樹根');
  await step(tok);                                   // 35:15 園藝系的樹根長在下面
  const t = icon('🌳', '園藝：根在下面', 5.3, 1.0, 0, 'sm');
  note('資訊系：root 畫在最上面', 4.8, 7.2);
  say('園藝系的樹根在下面', '資訊系的樹：root 畫在最上面（倒過來）');
  await step(tok);                                   // 35:48 root 之下也是階層狀的東西
  kill(t);
  const cols = ['#4b9ee2', '#e55a9b', '#9b7ef4', '#dd8238'];
  const boxes = root.kids.map((k, i) => boxG(k, cols[i]));
  say('root 之下：學院連同它的系', '也都是一小棵樹');
  await step(tok);                                   // 36:18 也是樹：sub trees
  root.kids.forEach((k, i) => tag('T' + (i + 1), 'ptr', k.pos.x, k.pos.y + 0.8));
  say('大樹裡的小樹叫 subtree', 'T1、T2、T3、T4');
  await step(tok);                                   // 36:40 一棵樹 T 由兩個部分組成
  bub('T = root + { T1, T2, …, Tn }', -3.6, 7.3);
  say('定義：樹 T = root + n 棵 subtree', 'root 能把大家「納進來」');
  await step(tok);                                   // 37:25 四個學院 → 四棵 subtree
  root.kids.forEach((k) => lit(k.body, GOLD));
  say('對應台大：4 個學院 = 4 棵 subtree', 'root 裝的是「國立台灣大學」，n = 4');
  void boxes;
}]);

// 37:48 遞迴定義與終止條件
FRAG.push(['treea-lin-rec', '遞迴定義：大樹拆小樹，還要終止條件', async (tok) => {
  cam([0, 4.6, 13.5], [0, 3.9, 0]);
  const root = ntuTree(0);
  const cols = ['#4b9ee2', '#e55a9b', '#9b7ef4', '#dd8238'];
  const boxes = root.kids.map((k, i) => boxG(k, cols[i]));
  const names = root.kids.map((k, i) => tag('T' + (i + 1), 'ptr', k.pos.x, k.pos.y + 0.8));
  lit(root.body, GOLD);
  await step(tok);                                   // 37:48 recursive definition
  bub('recursive definition（遞迴定義）', 0, 7.4);
  say('注意：這是遞迴的定義', '用「樹」來定義「樹」');
  await step(tok);                                   // 38:36 把 recursion 用在定義樹上
  for (const b of boxes) { b.material.opacity = 0.32; await beat(tok, 250); b.material.opacity = 0.16; }
  say('recursion：呼叫同樣的東西解決一小部分', '樹 = root + 一堆（也是樹的）subtree');
  await step(tok);                                   // 38:50 T1 一樣畫葫蘆：subroot + T1-1…
  boxes.slice(1).forEach(kill); names.slice(1).forEach(kill); lit(root.body);
  const t1 = root.kids[0];
  lit(t1.body, GOLD);
  tag('subroot', 'ptr alt', t1.pos.x - 1.7, t1.pos.y);
  const sub = t1.kids.map((g, j) => [boxG(g, '#2fc092'), tag('T1-' + (j + 1), 'ptr', g.pos.x, g.pos.y - 0.85)]);
  say('T1 也照樣拆：subroot + 更小的樹', 'T1 = 理學院 + { T1-1, T1-2 }');
  await step(tok);                                   // 39:13 大樹拆小樹，小樹拆更小
  for (const [g] of sub) { g.material.opacity = 0.35; await beat(tok, 350); g.material.opacity = 0.16; }
  say('大樹 → 小樹 → 更小的樹', '一路遞迴下去');
  await step(tok);                                   // 40:13 只寫遞迴式，程式不會停
  const loop = noT('🔁 拆、拆、拆… 停不下來？', 3.4, 7.3);
  say('只寫遞迴式：程式還沒寫完', '不保證會停下來');
  await step(tok);                                   // 40:30 termination condition 一樣重要
  kill(loop);
  okT('遞迴式 + termination condition', 3.4, 7.3);
  say('跟遞迴式一樣重要：終止條件', 'termination condition：什麼時候小到不能再小');
  await step(tok);                                   // 41:20 只有它的 root
  sub.forEach(([g]) => kill(g));
  const leaf = t1.kids[0];
  lit(leaf.body, RED);
  const x = tag('✕ 下面沒有 subtree', 'ptr', leaf.pos.x + 0.4, leaf.pos.y - 1.25);
  say('終止的 node：只有 root', '數學系下面什麼都沒有');
  await step(tok);                                   // 41:38 沒有任何 subtree → 停下來
  gAll(root).filter((n) => !n.kids.length).forEach((n) => lit(n.body, RED));
  say('沒有 subtree 可以再展開 → 遞迴停止', '<span class="ok">遞迴式 + 終止條件 才完整</span>');
  void x;
}]);

// 42:24 Subtree 要不要有順序
FRAG.push(['treea-lin-ordered', 'Subtrees：set（無序）vs sequence（有序）', async (tok) => {
  cam([0, 4.4, 13.5], [0, 3.8, 0]);
  const root = layoutG(parseG('NTU(理學院,工學院,社科院,電資學院)'), { width: 9.6, topY: 6.2, step: 2.6 });
  cEdges(root); gAll(root).forEach((n) => cNode(n));
  const ks = root.kids, xs = ks.map((k) => k.pos.x), y = ks[0].pos.y;
  await step(tok);                                   // 42:24 沒講 subtree 要不要 order
  const q = bub('T1, T2, T3, T4 要排順序嗎？', 0, 7.2);
  say('定義裡沒說 subtree 要不要有順序', '');
  await step(tok);                                   // 42:49 學院某種角度是平等的
  const mv = async (perm) => { perm.forEach((p, i) => lab.springTo(ks[i].body, V(xs[p], y, 0))); await beat(tok, 1100); };
  await mv([2, 0, 3, 1]); await mv([0, 1, 2, 3]);
  say('學院彼此平等：只要知道都屬於台大', '換個位置，還是同一棵樹');
  await step(tok);                                   // 43:03 學院有編號，例如電資學院 90
  kill(q);
  const nums = [20, 50, 30, 90];
  const tags = ks.map((k, i) => tag('編號 ' + nums[i], 'ptr alt', xs[i], y - 0.9));
  say('但學院有編號：電資學院是 90', '其他編號是示意');
  await step(tok);                                   // 43:21 依編號處理 → 有序
  const order = [0, 2, 1, 3];
  order.forEach((ki, slot) => { lab.springTo(ks[ki].body, V(xs[slot], y, 0)); tags[ki].position.set(xs[slot], y - 0.9, 0); });
  say('要依編號處理 → 順序就有意義', '依編號排好');
  await step(tok);                                   // 43:40 加上 order：sequence
  okT('需要順序：subtrees 是 sequence（ordered）', 0, 1.6);
  say('需要順序：subtrees 是 sequence', '(T1, T2, T3, T4)：ordered tree');
  await step(tok);                                   // 43:53 不需要 order：只是一個 set
  note('不需要順序：subtrees 只是 set，共用同一個 root', 0, 0.9);
  lit(root.body, GOLD);
  say('不需要順序：subtrees 只是一個 set', '{T1, T2, T3, T4} 都屬於同一個 root');
}]);

// 44:43 名詞：root、node、level、depth
FRAG.push(['treea-lin-level', '名詞：root、node、level、depth', async (tok) => {
  cam([0, 4.4, 13.5], [0, 3.9, 0]);
  const root = gTree(TERMS, TERMS_O, 0.6);
  const byD = (d) => gAll(root).filter((n) => n.depth === d);
  await step(tok);                                   // 44:43 先介紹一些名詞
  const card = note('📖 樹的名詞小辭典', 4.6, 7.2);
  say('先學幾個名詞', '之後上課會順口用到');
  await step(tok);                                   // 45:13 先畫出一棵樹
  await dropIn(tok, [gShow(root)], 600);
  say('先畫一棵樹', '');
  await step(tok);                                   // 45:44 最頂端叫 root
  root.bd.glow(GOLD); root.bd.mood('happy');
  tag('root', 'ptr alt', root.pos.x + 1.0, root.pos.y + 0.2);
  say('最頂端的叫 root', '');
  await step(tok);                                   // 45:57 每一筆資料叫 node
  note('每一筆資料 = 一個 node（節點）', -3.6, 7.2);
  say('樹裡的每一筆資料叫 node', '剛才的 NTU、EECS、CSIE 都是 node');
  await step(tok);                                   // 46:13 node A，下面有 B、C、D
  const l1 = byD(1).map((n) => gShow(n));
  await dropIn(tok, l1, 600); gLines(root);
  say('例如 node A，下面有 B、C、D', '');
  await step(tok);                                   // 46:42 root 在 level 0，下一層 level 1
  const d0 = tag('level 0', 'idx', dTagX, 6.5), d1 = tag('level 1', 'idx', dTagX, 6.5 - 1.55);
  say('root 在 level 0，下一層是 level 1', '階層的編號');
  await step(tok);                                   // 46:56 跟 C 語言一樣從零開始
  note('像 C 語言：從 0 開始數', -4.8, 7.3);
  say('老師的習慣：跟 C 語言一樣從 0 開始', '（洪逸課本 root 是 level 1）');
  await step(tok);                                   // 47:17 也叫做深度
  d0.element.textContent = 'depth 0'; d1.element.textContent = 'depth 1';
  say('level 又叫 depth（深度）', 'root 最不深；越往下 depth 越大');
  await step(tok);                                   // 47:49 再往下連：新的 node 在 depth 2
  const l2 = byD(2).map((n) => gShow(n));
  await dropIn(tok, l2, 600); gLines(root);
  tag('depth 2', 'idx', dTagX, 6.5 - 3.1);
  say('再往下：E、F、G、H、I、J', '都在 depth 2');
  await step(tok);                                   // 48:13 depth 比 level 常用
  kill(card);
  okT('之後常說 depth：樹有多深、多高', 3.6, 7.2);
  say('之後比較常講 depth', '樹有多深、多高很重要');
}]);

// 49:05 名詞：leaf（external）與 internal node
FRAG.push(['treea-lin-leaf', '名詞：leaf（external node）與 internal node', async (tok) => {
  cam([0, 4.4, 13.5], [0, 3.9, 0]);
  const root = termsTree(2);
  const N = (l) => gN(root, l);
  ['depth 0', 'depth 1', 'depth 2', 'depth 3'].forEach((t, d) => tag(t, 'idx', dTagX, 6.5 - d * 1.55));
  await step(tok);                                   // 49:05 再多長一些 node
  const l3 = gAll(root).filter((n) => n.depth === 3).map((n) => gShow(n));
  await dropIn(tok, l3, 600); gLines(root);
  say('再多長一些 node：K、L、M', '這就是我們的樹');
  await step(tok);                                   // 49:21 從 root 一路長，長到樹的尾巴
  const cur = pkt('一路長下去', root.pos.x, root.pos.y + 0.85, 0.3);
  for (const l of ['B', 'E', 'K']) await walkTo(tok, cur, N(l), 550);
  say('從 root 一路長，長到樹的尾巴', '長到不能再長的地方');
  await step(tok);                                   // 49:43 這裡沒有再長下去…
  kill(cur);
  for (const l of ['K', 'L', 'F', 'G', 'M', 'I', 'J']) { N(l).bd.glow(GREEN); await beat(tok, 220); }
  say('這些都沒有再長下去', '沒有任何 subtree');
  await step(tok);                                   // 49:50 叫做樹葉
  for (const l of ['K', 'L', 'F', 'G', 'M', 'I', 'J']) N(l).bd.mood('happy');
  tag('🍃 leaf（樹葉）', 'ptr', 0.4, 0.7);
  say('這種 node 叫 leaf（樹葉）', '');
  await step(tok);                                   // 49:57 也叫 external node
  tag('= external node（在最外圍）', 'ptr alt', 0.4, 0.1);
  say('正式說法：external node', '在樹的最外圍');
  await step(tok);                                   // 50:35 不是 root、也還沒長到尾巴
  for (const l of ['B', 'C', 'D', 'E', 'H']) { N(l).bd.glow(BLUE); await beat(tok, 220); }
  say('不是 root、也還沒到尾巴的 node', '像長在樹幹、枝枒上');
  await step(tok);                                   // 50:51 叫 internal node
  note('internal node = 不是 root、也不是 leaf', 4.0, 7.2);
  say('這些叫 internal node', 'non-root 且 non-leaf');
  await step(tok);                                   // 51:01 node 有三種
  root.bd.glow(GOLD);
  tag('金 = root　綠 = leaf　藍 = internal', 'say', -3.6, 7.3);
  say('node 分三種', 'root、leaf、internal');
  await step(tok);                                   // 51:22 有的書把 root 算 internal
  note('⚠ 有的書把 root 也算 internal', 4.0, 6.5);
  say('不同書定義略有不同', '有的書 root 也算 internal');
  await step(tok);                                   // 51:39 H 也是 internal
  N('H').bd.mood('wow'); await N('H').bd.hop(tok);
  tag('H：internal', 'ptr', N('H').pos.x + 0.95, N('H').pos.y + 0.3);
  say('H 下面還有 M', '所以 H 也是 internal');
}]);

// 51:59 族譜：parent、child、sibling、descendant、ancestor
FRAG.push(['treea-lin-family', '族譜：parent、child、sibling、ancestor、descendant', async (tok) => {
  cam([0, 4.4, 13.5], [0, 3.9, 0]);
  const root = termsTree(3);
  const N = (l) => gN(root, l);
  await step(tok);                                   // 51:59 把樹想成族譜
  bub('把 tree 想成族譜 👪', 3.6, 7.3);
  say('把樹想成族譜', '用家族關係來描述 node');
  await step(tok);                                   // 52:08 共同的祖先 A
  root.bd.glow(GOLD); root.bd.mood('happy'); await root.bd.hop(tok);
  tag('共同祖先', 'ptr alt', root.pos.x + 1.1, root.pos.y + 0.2);
  say('大家共同的祖先：A', '');
  await step(tok);                                   // 52:29 level 1 第一代、level 2 第二代
  tag('第一代', 'idx', dTagX, 6.5 - 1.55); tag('第二代', 'idx', dTagX, 6.5 - 3.1); tag('第三代', 'idx', dTagX, 6.5 - 4.65);
  say('level 1 = 第一代，level 2 = 第二代', 'root 是祖先');
  await step(tok);                                   // 53:17 往上的連結叫 parent
  root.bd.glow();
  say('往上的連結叫 parent（家長）', '');
  await step(tok);                                   // 53:27 A 是 C 的 parent
  const A = N('A').pos, C = N('C').pos;
  const up = arrow(V(C.x + 0.15, C.y + 0.35, 0.4), V(A.x + 0.15, A.y - 0.35, 0.4), KIDC);
  N('C').bd.glow(GREEN); N('A').bd.glow(GOLD);
  tag('parent', 'ptr alt', (A.x + C.x) / 2 + 0.7, (A.y + C.y) / 2 + 0.3);
  say('A 是 C 的 parent', 'C 往上一代就是 A');
  await step(tok);                                   // 53:59 C 是 A 的 child
  kill(up);
  arrow(V(A.x - 0.15, A.y - 0.35, 0.4), V(C.x - 0.15, C.y + 0.35, 0.4), SIBC);
  tag('child', 'ptr', (A.x + C.x) / 2 - 0.6, (A.y + C.y) / 2 - 0.2);
  N('C').bd.mood('happy');
  say('反過來，C 是 A 的 child（小孩）', '');
  await step(tok);                                   // 54:51 E、F 同一個家長 → sibling
  N('A').bd.glow(); N('C').bd.glow();
  N('E').bd.glow(GREEN); N('F').bd.glow(GREEN); N('B').bd.glow(GOLD);
  tag('siblings', 'ptr', (N('E').pos.x + N('F').pos.x) / 2, N('E').pos.y - 0.95);
  say('E、F 有同一個家長 B', 'E、F 互為 sibling（兄弟姐妹）');
  await step(tok);                                   // 55:11 descendant：子子孫孫
  N('E').bd.glow(); N('F').bd.glow();
  const g = boxG(N('B'), '#2fc092');
  say('子子孫孫叫 descendant', 'B 的 descendants：E、F、K、L');
  await step(tok);                                   // 55:32 ancestor：爸爸、阿公、阿祖…
  kill(g); N('B').bd.glow();
  const cur = pkt('往上找祖先', N('M').pos.x, N('M').pos.y + 0.85, 0.3);
  for (const l of ['H', 'D', 'A']) { await walkTo(tok, cur, N(l), 600); N(l).bd.glow(GOLD); }
  say('爸爸、阿公、阿祖…一路到 root', 'M 的 ancestors：H、D、A');
  await step(tok);                                   // 55:58 兩種語言混在一起
  kill(cur);
  note('🌱 園藝：root、leaf', -4.2, 0.8); note('👪 族譜：parent、child、sibling、ancestor、descendant', 2.0, 0.8);
  say('樹的名詞混了兩種語言', '園藝的 + 家族的');
}]);

// 56:42 Height 與 degree
FRAG.push(['treea-lin-height', 'Height（樹高）與 degree', async (tok) => {
  cam([0, 4.4, 13.5], [0, 3.9, 0]);
  const root = termsTree(3);
  const N = (l) => gN(root, l);
  const byD = (d) => gAll(root).filter((n) => n.depth === d);
  await step(tok);                                   // 56:42 level 像是第幾代
  ['depth 0', 'depth 1', 'depth 2', 'depth 3'].forEach((t, d) => tag(t, 'idx', dTagX, 6.5 - d * 1.55));
  say('level 比較像「第幾代」', '');
  await step(tok);                                   // 57:15 depth：樹有多深、多高
  for (const d of [0, 1, 2]) { byD(d).forEach((n) => n.bd.glow(BLUE)); await beat(tok, 450); byD(d).forEach((n) => n.bd.glow()); }
  say('depth：想知道樹有多深、有多高', '');
  await step(tok);                                   // 57:29 深度是 3 的 node：K、L、M
  byD(3).forEach((n) => { n.bd.glow(GOLD); n.bd.mood('wow'); });
  say('最深的 node：K、L、M', '在 depth 3');
  await step(tok);                                   // 57:38 最深就到 3 → 樹的高度
  okT('height = 3', -5.6, 1.0);
  say('樹最深到 3：這叫樹的 height（高度）', '<span class="ok">height = 3</span>');
  await step(tok);                                   // 58:27 D 有三個小孩
  byD(3).forEach((n) => { n.bd.glow(); n.bd.mood('calm'); });
  const D = N('D');
  D.bd.glow(GOLD); D.bd.mood('happy'); await D.bd.hop(tok);
  tag('3 個小孩', 'ptr alt', D.pos.x + 1.0, D.pos.y + 0.2);
  say('D 比較多產：有 3 個小孩', '');
  await step(tok);                                   // 58:36 每個 node 小孩數量不一樣
  for (const n of gAll(root)) if (n !== D) tag(String(n.kids.length), 'idx', n.pos.x + 0.55, n.pos.y - 0.4);
  say('每個 node 的小孩數不一樣', 'B 有 2 個、C 有 1 個、leaf 有 0 個');
  await step(tok);                                   // 59:03 最會生的那個有幾個 → tree 的 degree
  bub('最會生的那個：有幾個小孩？', 3.6, 7.3);
  say('全家最會生的那個有幾個小孩', '這叫 tree 的 degree');
  await step(tok);                                   // 59:36 用在 node 上：生了幾個小孩
  note('node 的 degree = 小孩數：degree(D) = 3', -3.0, 0.8);
  say('degree 用在 node 上 = 小孩數', 'degree(D) = 3');
  await step(tok);                                   // 59:51 用在 tree 上：maximum node degree
  okT('tree 的 degree = max node degree = 3', 3.0, 0.8);
  say('degree 用在 tree 上 = 最大的 node degree', '<span class="ok">這棵樹 degree = 3</span>');
}]);

// 63:56 Q&A：D 和 G 是什麼關係（uncle）
FRAG.push(['treea-lin-uncle', 'Q&A：D 和 G 的關係（uncle）', async (tok) => {
  cam([0, 4.4, 13.5], [0, 3.9, 0]);
  const root = termsTree(3);
  const N = (l) => gN(root, l);
  await step(tok);                                   // 63:57 D 對 G 有什麼關係
  N('G').bd.glow(GREEN); N('D').bd.glow(GREEN);
  bub('同學問：D 和 G 是什麼關係？', 3.6, 7.3);
  say('同學問：D 和 G 是什麼關係？', '');
  await step(tok);                                   // 64:10 D 是 G 的叔叔
  N('D').bd.mood('happy');
  tag('uncle（叔叔）', 'ptr alt', N('D').pos.x + 1.1, N('D').pos.y - 0.6);
  say('有些場合會說：D 是 G 的叔叔', 'uncle');
  await step(tok);                                   // 64:17 D 是 G 的爸爸的兄弟姐妹
  const G = N('G').pos, C = N('C').pos, D = N('D').pos;
  arrow(V(G.x, G.y + 0.35, 0.4), V(C.x, C.y - 0.35, 0.4), KIDC);
  N('C').bd.glow(GOLD);
  tag('C、D：siblings', 'ptr', (C.x + D.x) / 2, C.y + 0.85);
  say('G 的 parent 是 C；C 和 D 是 siblings', 'D = G 的 parent 的 sibling');
  await step(tok);                                   // 64:25 不見得每個場合都會用到
  note('不常用，課本正式術語是 parent、child、sibling…', 0.4, 0.7);
  say('uncle 不是每個場合都會用', '以後需要時再講');
}]);

// 76:50 表示 tree：child link 與 parent link
FRAG.push(['treea-lin-links', '程式裡怎麼表示 tree：child link 與 parent link', async (tok) => {
  cam([0, 4.4, 13], [0, 4.1, 0]);
  await step(tok);                                   // 76:50 剛才講了抽象的 tree
  const rec = [note('✔ tree 長什麼樣', -4.0, 6.6), note('✔ 用 recursion 定義', -4.0, 5.9), note('✔ node 之間的關係', -4.0, 5.2)];
  say('回顧：抽象的 tree、遞迴定義、node 關係', '');
  await step(tok);                                   // 77:19 寫程式時要怎麼表示（represent）
  const pf = prop('file', 3.6, 4.4, 0, 1.3, '程式碼'); bob(pf, 0.05);
  say('接下來：寫程式時要怎麼 represent？', 'array 是連續記憶體，list 用小紙條');
  await step(tok);                                   // 77:49 tree 就是 root 和一堆 subtree
  killAll(rec); kill(pf);
  const r = cube('root', '#2fc092', [1.4, 0.6, 0.8], 0, 6.4, 0, 3);
  say('回到定義：tree = root + 一堆 subtree', '');
  await step(tok);                                   // 78:17 把 subtree 裝進 container
  const bar = K.zone('container（裝資料的容器）', 0, 3.0, 0, 10, 1.2, '#e9dcc4');
  const xs = [-3.6, -1.2, 1.2, 3.6], nm = ['T1', 'T2', '…', 'Tn'];
  const ts = [];
  for (let i = 0; i < 4; i++) { ts.push(cube(nm[i], i === 2 ? '#c9b48e' : '#4b9ee2', [1.6, 0.6, 0.8], xs[i], 3.4, 0, 3)); await beat(tok, 200); }
  say('把 subtrees 裝進一個 container', '像廚房的保鮮盒、碗；每棵 subtree 佔一部分');
  await step(tok);                                   // 79:07 root 旁附一張小紙片
  const paper = cube('', '#f2c46d', [0.4, 0.4, 0.5], 1.05, 6.4, 0, 2);
  const nt = tag('小紙片', 'idx', 1.05, 7.0);
  const ch = arrow(V(1.05, 6.18, 0), V(1.05, 3.8, 0), KIDC);
  const chT = tag('child link', 'ptr alt', 2.4, 5.1);
  say('root 旁邊附一張小紙片（pointer）', '指到裝 subtrees 的 container');
  await step(tok);                                   // 80:16 從小孩找爸爸媽媽
  bub('有時要從小孩找爸爸媽媽', -3.6, 7.3);
  say('有時候反過來：從小孩找爸爸媽媽', '例如：資訊系 → 屬於哪個學院？');
  await step(tok);                                   // 81:03 每個 subtree 都有一條 link 回 root
  const ups = [];
  for (const i of [0, 1, 3]) { ups.push(arrow(V(xs[i], 3.75, 0), V(-0.35 + i * 0.12, 6.08, 0), SIBC, true)); await beat(tok, 300); }
  say('每棵 subtree 都有一條 link 指回 root', '（虛線）');
  await step(tok);                                   // 81:19 parent link / child link
  const upT = tag('parent link', 'ptr', -3.3, 5.3);
  say('往上找家長：parent link', '往下找小孩：child link');
  await step(tok);                                   // 81:30 root 有很多個 link，各指一個小孩
  [ch, chT, upT, nt, ...ups].forEach(kill); kill(paper); K.remove(bar);
  ts.forEach((b, i) => lab.springTo(b, V(xs[i], 3.0, 0)));
  for (let i = 0; i < 4; i++) { arrow(V(-0.3 + i * 0.2, 6.08, 0), V(xs[i], 3.35, 0), KIDC); await beat(tok, 200); }
  lit(r, GOLD);
  say('另一種做法：root 有很多條 link', '每條各指向一個小孩');
}]);

// 82:10 vector 當 container
FRAG.push(['treea-lin-vector', '用 vector 當 container', async (tok) => {
  cam([0, 4.4, 13.5], [0, 4.2, 0]);
  const CW = 1.2, S = [1.18, 0.6, 0.8];
  const vec = (labels, x0, y, color) => labels.map((l, i) => { const b = cube(l, color, S, x0 + i * CW, y, 0, 3); tag('[' + i + ']', 'idx', x0 + i * CW, y - 0.55); return b; });
  await step(tok);                                   // 82:10 使用 vector 當作 container
  bub('vector：用 index 拿任何一格', -3.6, 7.3);
  say('上一講的 vector：可以用 index 存取', '拿它來當 container');
  await step(tok);                                   // 82:35 root，T1、T2、T3 裝在 vector 裡
  vec(['root'], 0, 6.6, '#2fc092');
  const top = vec(['T1', 'T2', 'T3'], -CW, 4.6, '#4b9ee2');
  say('例子：root 有三個小孩 T1、T2、T3', '它們被裝在一個 vector 裡');
  await step(tok);                                   // 83:10 各佔 vector 的一格
  tag('vector', 'idx', -2.6, 4.6);
  top.forEach((b) => lit(b, GOLD));
  say('T1、T2、T3（的 root）各佔一格', 'root 自己也可想成放在一個 vector');
  await step(tok);                                   // 83:25 兩個 vector 之間有 child link
  top.forEach((b) => lit(b));
  arrow(V(0, 6.28, 0), V(0, 4.95, 0), KIDC);
  tag('child link', 'ptr alt', 1.1, 5.6);
  say('兩個 vector 之間用 child link 連起來', '');
  await step(tok);                                   // 83:34 T1 有兩個粉紅色的小孩
  const pk = vec(['粉1', '粉2'], -4.6, 2.4, PINK);
  say('T1 有兩個粉紅色的小孩', '粉紅 1 號、粉紅 2 號');
  await step(tok);                                   // 83:51 T1 一條連結找小孩；T3 有三個
  arrow(V(-CW, 4.28, 0), V(-4.0, 2.75, 0), KIDC);
  vec(['橘1', '橘2', '橘3'], 2.4, 2.4, ORANGE);
  arrow(V(CW, 4.28, 0), V(3.6, 2.75, 0), KIDC);
  say('T1 用一條 link 找兩個小孩', 'T3 有三個小孩，也用一條 link');
  await step(tok);                                   // 84:01 T2 沒有小孩：空 array 或 null
  arrow(V(0, 4.28, 0), V(0, 3.15, 0), RED);
  tag('null（或空 array）', 'ptr', 0, 2.8);
  lit(top[1], RED);
  say('T2 沒有小孩', '用空的 array 或 null pointer 表示');
  await step(tok);                                   // 84:37 虛線連回去 → 像 doubly linked list
  lit(top[1]);
  arrow(V(0.35, 4.95, 0), V(0.35, 6.28, 0), SIBC, true);
  arrow(V(-3.0, 2.75, 0), V(-1.45, 4.28, 0), SIBC, true);
  arrow(V(4.4, 2.75, 0), V(1.45, 4.28, 0), SIBC, true);
  tag('parent link', 'ptr', 5.0, 5.0);
  say('再加上指回 parent 的虛線', '像 doubly linked list：爸爸找小孩、小孩也找爸爸');
  void pk;
}]);

// linked list 版的版面（兩段共用）
const LIST_POS = { root: [-4.5, 6.6], T1: [-4.5, 4.7], T2: [-1.0, 4.7], T3: [2.5, 4.7], '粉1': [-5.6, 2.6], '粉2': [-3.8, 2.6], '橘1': [1.4, 2.6], '橘2': [3.1, 2.6], '橘3': [4.8, 2.6] };
const LIST_COL = { root: '#2fc092', T1: '#4b9ee2', T2: '#4b9ee2', T3: '#4b9ee2', '粉1': PINK, '粉2': PINK, '橘1': ORANGE, '橘2': ORANGE, '橘3': ORANGE };
const KID_E = [['root', 'T1'], ['T1', '粉1'], ['T3', '橘1']];
const SIB_E = [['T1', 'T2'], ['T2', 'T3'], ['粉1', '粉2'], ['橘1', '橘2'], ['橘2', '橘3']];
function listNodes(keys, drop) { const B = {}; for (const k of keys) { const [x, y] = LIST_POS[k]; B[k] = cube(k, LIST_COL[k], [W(k), 0.6, 0.8], x, y, 0, drop); } return B; }

// 85:09 linked list 當 container
FRAG.push(['treea-lin-list', '用 linked list 當 container', async (tok) => {
  cam([0, 4.4, 13.5], [0, 4.4, 0]);
  const B = {}; const at = (k) => B[k].obj.position;
  const sib = [], kid = [];
  dynLines(() => sib.filter(([a, c]) => B[a] && B[c]).map(([a, c]) => [at(a), at(c)]), SIBC);
  dynLines(() => kid.filter(([a, c]) => B[a] && B[c]).map(([a, c]) => [at(a), at(c)]), KIDC);
  const nul = (x, y) => tag('null', 'idx', x, y);
  await step(tok);                                   // 85:09 用 linked list 作為 container
  Object.assign(B, listNodes(['root'], 3));
  say('改用 linked list 當 container', '同一棵樹：root(T1(粉1,粉2), T2, T3(橘1,橘2,橘3))');
  await step(tok);                                   // 85:26 T1、T2、T3 在 linked list 裡
  Object.assign(B, listNodes(['T1', 'T2', 'T3'], 3));
  sib.push(['T1', 'T2'], ['T2', 'T3']);
  say('T1 → T2 → T3 串成一條 list', '');
  await step(tok);                                   // 85:45 到 end 了：null
  nul(6.2, 4.7);
  say('list 的結尾：指向 null', '已經到底，不再連下去');
  await step(tok);                                   // 85:55 root 有一個 link 找到它的小孩
  kid.push(['root', 'T1']); lit(B.root, GOLD);
  say('root 用一條 link 找到它的（第一個）小孩', 'root → T1');
  await step(tok);                                   // 86:05 T1 的兩個粉紅小孩也是 linked list
  lit(B.root);
  Object.assign(B, listNodes(['粉1', '粉2'], 3));
  kid.push(['T1', '粉1']); sib.push(['粉1', '粉2']); nul(-2.3, 2.6);
  say('T1 的兩個粉紅小孩：也是一條 list', 'T1 → 粉1 → 粉2 → null');
  await step(tok);                                   // 86:23 T3 三個 node；T2 沒有小孩
  Object.assign(B, listNodes(['橘1', '橘2', '橘3'], 3));
  kid.push(['T3', '橘1']); sib.push(['橘1', '橘2'], ['橘2', '橘3']); nul(6.3, 2.6);
  arrow(V(-1.0, 4.38, 0), V(-1.0, 3.45, 0), KIDC); nul(-1.0, 3.2);
  say('T3 → 三個橘子；T2 沒有小孩', 'T2 的 child link 直接指向 null');
  await step(tok);                                   // 87:08 vector：連續區塊；list：小紙條
  note('vector 版：記憶體裡相對連續的一塊', 3.6, 7.2); note('list 版：用很多小紙條（pointer）連', 3.6, 6.5);
  say('vector 版像連續的一塊記憶體', 'linked list 版用比較多小紙條');
  await step(tok);                                   // 87:37 兩種小紙條：橫的 = 兄弟姐妹
  tag('橫的 = sibling（兄弟姐妹）', 'ptr', 3.0, 1.4);
  say('小紙條有兩種：橫的指向兄弟姐妹', 'T1、T2、T3 是 sibling；兩個粉紅也是');
  await step(tok);                                   // 88:09 從上往下：找 child
  tag('往下 = child（小孩）', 'ptr alt', 3.0, 0.8);
  say('另一種：從上往下，找小孩', '');
  await step(tok);                                   // 88:31 每個 node 最多兩種小紙條
  lit(B.T1, GOLD);
  say('每個 node 最多兩張小紙條', 'T1：一張往下（粉1）、一張往右（T2）');
  await step(tok);                                   // 88:58 也可能一張或零張，不會有三張
  lit(B.T1); lit(B.T2, GOLD); lit(B['粉2'], GOLD);
  say('也可能只有一張、或零張', 'T2 只有 sibling；粉2 兩張都沒有；不會有三張');
}]);

// 89:16 重畫：child 往左下、sibling 往右下
FRAG.push(['treea-lin-lcrs', '重畫：child 往左下、sibling 往右下', async (tok) => {
  cam([0, 4.2, 13.5], [0, 3.9, 0]);
  const keys = Object.keys(LIST_POS);
  const B = listNodes(keys, 0); const at = (k) => B[k].obj.position;
  dynLines(() => SIB_E.map(([a, c]) => [at(a), at(c)]), SIBC);
  dynLines(() => KID_E.map(([a, c]) => [at(a), at(c)]), KIDC);
  const t = parseTree('root(T1(粉1(,粉2),T2(,T3(橘1(,橘2(,橘3)),))),)');
  layoutTree(t, Object.assign({}, TREE_O, { topY: 6.7, minY: 1.0 }));
  const P = {}; levelorder(t).forEach((n) => { P[n.label] = n.pos.clone(); });
  const go = (ks) => { ks.forEach((k) => { lab.springTo(B[k], P[k]); lit(B[k], GOLD); }); };
  const off = (ks) => ks.forEach((k) => lit(B[k]));
  await step(tok);                                   // 89:26 把它畫成另外一種形式
  tag('金 = child（往下）　藍 = sibling（橫的）', 'say', 0, 7.5);
  say('只有兩種小紙條的樹：換一種畫法', '');
  await step(tok);                                   // 89:44 root 的 child 紙條往左下 → T1
  go(['root', 'T1']);
  say('root 的 child 紙條往左下畫', 'root ↙ T1');
  await step(tok);                                   // 90:02 T1 的 child → 粉紅 1 號
  off(['root', 'T1']); go(['粉1']);
  say('T1 的 child 紙條再往左下', 'T1 ↙ 粉紅 1 號');
  await step(tok);                                   // 90:22 T1 的 sibling 紙條改往右下 → T2
  off(['粉1']); go(['T2']);
  say('T1 的 sibling 紙條：轉成往右下', 'T1 ↘ T2');
  await step(tok);                                   // 90:48 粉紅 2 號是粉紅 1 號的同輩
  off(['T2']); go(['粉2']);
  say('粉紅 2 號是粉紅 1 號的同輩', '粉1 ↘ 粉2（粉1 沒小孩：左邊空）');
  await step(tok);                                   // 91:07 T2 沒小孩；同輩 T3
  off(['粉2']); go(['T3']);
  say('T2 沒小孩；它的下一個同輩是 T3', 'T2 ↘ T3');
  await step(tok);                                   // 91:25 T3 有三個小孩：橘子三兄弟
  off(['T3']); go(['橘1', '橘2', '橘3']);
  say('T3 的三個小孩：橘子三兄弟', 'T3 ↙ 橘1 ↘ 橘2 ↘ 橘3');
  await step(tok);                                   // 92:02 橫的變右下，直的變左下
  off(['橘1', '橘2', '橘3']);
  tag('↙ 左下 = child', 'ptr alt', -5.2, 2.0); tag('↘ 右下 = sibling', 'ptr', -5.2, 1.3);
  say('橫的 sibling 連結 → 右下斜線', '往下的 child 連結 → 左下斜線');
  await step(tok);                                   // 92:30 root 現在只有一個小孩
  lit(B.root, GOLD);
  tag('只連 T1', 'ptr', P.root.x + 1.3, P.root.y - 0.4);
  say('root 原本有三個小孩，現在只連 T1', 'T1、T2、T3 好像併成一家');
  await step(tok);                                   // 92:58 T1 的兩棵 subtree
  lit(B.root); lit(B.T1, GOLD);
  const boxOf = (ks, color) => {
    const x0 = Math.min(...ks.map((k) => P[k].x - W(k) / 2)) - 0.1, x1 = Math.max(...ks.map((k) => P[k].x + W(k) / 2)) + 0.1;
    const y0 = Math.min(...ks.map((k) => P[k].y)) - 0.4, y1 = Math.max(...ks.map((k) => P[k].y)) + 0.4;
    return ghost(color, (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0);
  };
  boxOf(['粉1', '粉2'], PINK); boxOf(['T2', 'T3', '橘1', '橘2', '橘3'], '#4b9ee2');
  say('T1 底下有兩棵 subtree', '左：T1 的小孩；右：T1 原本的兄弟姐妹');
}]);

// ── LCRS 版面：R(T1(粉1,粉2),T2,T3(橘1,橘2,橘3)) 轉成 binary tree ──
const LCRS_B = { root: [0, 0], T1: [-1, 1], '粉1': [-2, 2], T2: [0, 2], '粉2': [-1, 3], T3: [1, 3], '橘1': [0, 4], '橘2': [1, 5], '橘3': [2, 6] };
const LCRS_E = [['root', 'T1', 'L'], ['T1', '粉1', 'L'], ['T1', 'T2', 'R'], ['粉1', '粉2', 'R'], ['T2', 'T3', 'R'], ['T3', '橘1', 'L'], ['橘1', '橘2', 'R'], ['橘2', '橘3', 'R']];
const lcrsPos = (l, cx = 0, top = 6.6, dx = 1.3, dy = 0.92) => V(cx + LCRS_B[l][0] * dx, top - LCRS_B[l][1] * dy, 0);
function lcrsTree(cx = 0) {
  const B = {};
  for (const l of Object.keys(LCRS_B)) { const p = lcrsPos(l, cx); B[l] = cube(l, LIST_COL[l], [W(l), 0.55, 0.8], p.x, p.y, 0); }
  const ar = LCRS_E.map(([p, c, s]) => { const a = lcrsPos(p, cx), b = lcrsPos(c, cx); return arrow(V(a.x + (s === 'L' ? -0.25 : 0.25), a.y - 0.3, 0), V(b.x, b.y + 0.3, 0), s === 'L' ? CHILD_C : KIDC); });
  return { B, ar };
}

// 93:12 Left-Child Right-Sibling → binary tree
FRAG.push(['treea-lin-bin', 'Left-Child Right-Sibling：general tree → binary tree', async (tok) => {
  cam([0, 4.6, 13.5], [0, 3.6, 0]);
  const { B } = lcrsTree();
  await step(tok);                                   // 93:18 最多最多的連線數量是兩個
  for (const l of ['T1', '粉1', 'T2', 'T3', '橘1', '橘2']) lit(B[l], GOLD);
  note('每個 node 最多 2 條連線', -4.6, 6.6);
  say('重畫後：每個 node 最多兩條連線', 'maximum number of children = 2');
  await step(tok);                                   // 93:30 它還是一棵 tree
  Object.values(B).forEach((b) => lit(b));
  lit(B.root, GOLD);
  say('它還是一棵 tree', 'root 拆成 subtree，subtree 又有自己的 root…');
  await step(tok);                                   // 94:03 degree 2 的樹：binary tree
  lit(B.root);
  bub('degree ≤ 2 → binary tree', -4.4, 7.3);
  say('最多兩個小孩（degree 2）的樹', '叫做 binary tree（二元樹）');
  await step(tok);                                   // 94:20 每個人最多兩個小孩
  const bd = buddy('老師', '2', '#f3d36b', 5.4, 5.4, 0, 0.7); bd.mood('happy'); await bd.hop(tok);
  say('不是一般的樹了：最多兩個小孩', '老師戲稱「二胎化」');
  await step(tok);                                   // 94:35 左邊小孩跟右邊小孩意思不一樣
  const tl = tag('左', 'ptr alt', -0.95, 6.0), tr = tag('右', 'ptr', 1.95, 4.15);
  tl.element.style.color = CHILD_C;
  say('左小孩、右小孩代表的意思不一樣', '要分清楚左右（有位置關係）');
  await step(tok);                                   // 94:51 Left-Child Right-Sibling
  okT('Left-Child Right-Sibling representation', 0, 0.0);
  say('這種表示法叫 Left-Child Right-Sibling', '');
  await step(tok);                                   // 95:14 左 = 原樹的小孩，右 = 平輩
  tag('↙ left = 原來的 child', 'ptr', -5.2, 1.4).element.style.color = CHILD_C;
  tag('↘ right = 原來的 sibling', 'ptr alt', -5.2, 0.8);
  say('左連結 = 原樹的 child 關係', '右連結 = 原樹的 sibling（平輩）關係');
  await step(tok);                                   // 95:43 任何一棵 ordered tree
  for (const [l, k] of [['T1', 1], ['T2', 2], ['T3', 3]]) { lit(B[l], GOLD); tag('#' + k, 'idx', lcrsPos(l).x + 0.7, lcrsPos(l).y + 0.35); await beat(tok, 300); }
  say('可以表示任何一棵 ordered tree', 'T1、T2、T3 之間要有順序');
  await step(tok);                                   // 96:20 每個 node 只有兩張小紙條
  ['T1', 'T2', 'T3'].forEach((l) => lit(B[l]));
  bd.mood('wow'); kill(tl); kill(tr);
  okT('任何 general tree 都能存成 binary tree', 4.0, 0.6);
  say('實作時每個 node 就是兩張小紙條', '所以 binary tree 足以表示 general tree');
  void bd;
}]);

// 96:45 Binary tree 的條件與空的小紙條
FRAG.push(['treea-lin-null', 'Binary tree 的條件與 NULL link', async (tok) => {
  cam([0, 4.6, 13.5], [0, 3.6, 0]);
  const { B } = lcrsTree();
  await step(tok);                                   // 96:46 未來好幾講都鎖定 binary tree
  bub('接下來好幾講：先搞懂 binary tree', -3.8, 7.3);
  say('接下來好幾講：先鎖定 binary tree', '有的結果可以再推廣到 general tree');
  await step(tok);                                   // 97:31 條件一：degree 最多是 2
  tag('binary tree 的條件', 'ptr', -5.2, 6.2);
  tag('① degree ≤ 2', 'ptr alt', -5.2, 5.6);
  say('條件一：tree 的 degree 最多是 2', '老師先寫「= 2」，再改成「≤ 2」');
  await step(tok);                                   // 97:48 條件二：左右有差別
  tag('② 有順序：左右不一樣', 'ptr alt', -5.2, 5.0);
  say('條件二：要有 order', '左邊、右邊是有差別的');
  await step(tok);                                   // 98:17 剛才畫了空的小紙條
  const nulls = [];
  const has = {}; LCRS_E.forEach(([p, , s]) => { has[p + s] = true; });
  for (const l of Object.keys(LCRS_B)) for (const s of ['L', 'R']) {
    if (has[l + s]) continue;
    const p = lcrsPos(l);
    const a = V(p.x + (s === 'L' ? -0.25 : 0.25), p.y - 0.3, 0), b = V(p.x + (s === 'L' ? -0.6 : 0.6), p.y - 0.72, 0);
    nulls.push(seg(a, b, '#b04040'), tag('∅', 'idx', b.x + (s === 'L' ? -0.12 : 0.12), b.y - 0.15));
  }
  say('畫出那些「指向空」的小紙條', '長到尾巴、不再長的地方');
  await step(tok);                                   // 98:25 沒存資料 → 以後不畫
  nulls.forEach((o) => { if (o.material) { o.material.transparent = true; o.material.opacity = 0.3; } else if (o.element) o.element.style.opacity = '0.35'; });
  note('沒存資料 → 以後畫圖不畫（自行腦補）', 3.6, 7.3);
  say('它們沒有真的存資料', '以後畫圖不畫；需要時自己腦補');
  await step(tok);                                   // 98:57 算進空紙條：每個 degree = 2
  nulls.forEach((o) => { if (o.material) o.material.opacity = 1; else if (o.element) o.element.style.opacity = ''; });
  Object.values(B).forEach((b) => lit(b, GREEN));
  say('把空紙條也算進去', '每個 node 的 degree 都剛好 = 2');
  await step(tok);                                   // 99:32 每個 node 左右兩邊，一邊可能空
  Object.values(B).forEach((b) => lit(b));
  okT('每個 node 都有左、右兩邊，只是某邊可能是空的', 0, 0.0);
  say('binary tree：每個 node 都有左右兩邊', '只是某一邊可能是空的');
}]);

// 100:00 Q&A：一個大 vector？root 只有一個小孩
FRAG.push(['treea-lin-pack', 'Q&A：把 tree 塞進一個大 vector？', async (tok) => {
  cam([0, 6.5, 11.5], [0, 1.6, 0]);
  const X = (i) => -4.5 + i * 1.0;
  const order = ['root', 'T1', 'T2', 'T3', '粉1', '粉2', '橘1', '橘2', '橘3'];
  await step(tok);                                   // 100:00 藍色跟粉紅色之間要連續嗎
  bub('同學問：藍色和粉紅色要連續放嗎？', 0, 4.4);
  say('同學問：這些 vector 要連在一起嗎？', '這是實作時可以選擇的事');
  await step(tok);                                   // 100:30 整個 tree 弄成一個大大的 vector
  for (let i = 0; i < 10; i++) { K.zone('', X(i), 0, 0, 0.92, 0.9, '#e9dcc4'); tag('[' + i + ']', 'idx', X(i), 0.1, 0.8); }
  const cells = [];
  for (let i = 0; i < order.length; i++) { cells.push(cube(order[i], LIST_COL[order[i]], [0.8, 0.55, 0.7], X(i), 0.36, 0, 2.5)); await beat(tok, 150); }
  say('全部塞進一個大大的 vector', '再另外設計 link 在格子間跳來跳去');
  await step(tok);                                   // 101:02 塞得很緊密：喪失彈性
  const bad1 = noT('太緊密 → 塞東西的彈性變差', 0, 2.6);
  say('塞得很緊密的壞處', '像把 linked list 塞進 vector：不好插東西');
  await step(tok);                                   // 101:25 T1 多生一個小孩：擠開
  for (let i = order.length - 1; i >= 6; i--) { lab.springTo(cells[i], V(X(i + 1), 0.36, 0)); lit(cells[i], RED); }
  await beat(tok, 500);
  cells.push(cube('粉3', PINK, [0.8, 0.55, 0.7], X(6), 0.36, 0, 3));
  say('T1 多生一個小孩：粉3', '後面的人通通要被擠開');
  await step(tok);                                   // 101:42 access、allocate 方便；insert/remove 受限
  kill(bad1); cells.forEach((c) => lit(c));
  okT('memory access、allocate 方便', -2.6, 2.6); noT('insertion、removal 限制多', 2.6, 2.6);
  say('一個大 vector：取用、配置方便', '但插入、刪除時限制更多（trade-off）');
  await step(tok);                                   // 102:26 只有一個小孩：原來的 root
  cube('root', '#2fc092', [1.0, 0.55, 0.7], 3.6, 5.0, -1.5, 2);
  cube('T1', '#4b9ee2', [0.8, 0.55, 0.7], 2.4, 3.8, -1.5, 2);
  arrow(V(3.4, 4.7, -1.5), V(2.5, 4.12, -1.5), CHILD_C);
  say('另一個問題：只有一個小孩？', '有：原來的 root');
  await step(tok);                                   // 102:43 轉成 binary tree 只有一個小孩
  seg(V(3.85, 4.7, -1.5), V(4.3, 4.2, -1.5), '#b04040'); tag('∅ 沒有 sibling', 'idx', 4.8, 3.9, -1.5);
  say('root 沒有 sibling → 只有左小孩', '<span class="ok">binary tree 的 node 只有一個小孩是可能的</span>');
}]);

// 遞迴建樹：示意資料 [5, 3, 8, 1, 4]，規則「小的放左、大的放右」
const BUILD_DATA = [5, 3, 8, 1, 4];
const BUILD_POS = { 5: [3.4, 6.2], 3: [1.8, 4.6], 8: [5.0, 4.6], 1: [1.0, 3.0], 4: [2.6, 3.0] };
const BUILD_E = [[5, 3], [5, 8], [3, 1], [3, 4]];
function dataRow() { const row = {}; BUILD_DATA.forEach((v, k) => { row[v] = cube(v, '#b9a582', SMALL, -2.2 + k * 0.8, 0.3, 2.2, 2); }); tag('data（示意）', 'idx', -2.2, 0.3, 3.1); return row; }

// 103:23 用 recursion 建構 tree
FRAG.push(['treea-lin-build', '用 recursion 建構 tree（pseudo code）', async (tok) => {
  cam([0, 4.4, 13.5], [0, 3.4, 0]);
  const lines = ['ConstructTree(data):', '  create root node from data[0]', '  partition data into n sets', '  for each i:', '    T_i = ConstructTree(i-th set)', '    link root to T_i'];
  let cp = null, row = null;
  await step(tok);                                   // 103:23 打一小段 pseudo code
  cp = code(lines, -3.9, 6.6, 0.5);
  cp.ls.slice(1).forEach((l) => { l.element.style.visibility = 'hidden'; });
  row = dataRow();
  say('建樹的 pseudo code（不是 C）', '資料 [5, 3, 8, 1, 4] 是示意');
  await step(tok);                                   // 103:56 第一筆資料當 root，其他分到 subtree
  lit(row[5], GOLD);
  say('想法：第一筆資料當 root', '其他資料分到各個 subtree');
  await step(tok);                                   // 104:19 create root node from data[0]
  lit(row[5]);
  cp.ls[1].element.style.visibility = ''; cp.hl(1);
  lab.springTo(row[5], V(...BUILD_POS[5], 0));
  row[5].obj.material.color.set('#2fc092');
  say('第一步：用 data[0] 建 root', 'root = 5');
  await step(tok);                                   // 104:40 要建 n 棵 subtree
  cp.ls[3].element.style.visibility = ''; cp.hl(3);
  const nt = note('要建 n 棵 subtree（這裡 n = 2）', 4.4, 7.3);
  say('第二步：要建 n 棵 subtree', '');
  await step(tok);                                   // 104:48 partition data into n sets
  cp.ls[2].element.style.visibility = ''; cp.hl(2);
  const gl = ghost('#4b9ee2', 1.8, 3.9, 2.6, 1.0, 0), gr = ghost(ORANGE, 5.0, 3.9, 2.6, 1.0, 0);
  say('所以要把資料分成 n 份', 'partition：照某種規則分');
  await step(tok);                                   // 105:19 比 data[0] 小放左邊，大放右邊
  kill(nt);
  [[3, 1.2], [1, 1.9], [4, 2.6]].forEach(([v, x]) => { row[v].obj.material.color.set('#4b9ee2'); lab.springTo(row[v], V(x, 3.9, 0)); });
  row[8].obj.material.color.set(ORANGE); lab.springTo(row[8], V(5.0, 3.9, 0));
  say('最簡單的規則：比 5 小的放左、比 5 大的放右', '小：{3, 1, 4}　大：{8}');
  await step(tok);                                   // 105:59 T_i = ConstructTree(第 i 份)
  cp.ls[4].element.style.visibility = ''; cp.hl(4);
  kill(gl); kill(gr);
  for (const v of [3, 8, 1, 4]) { lab.springTo(row[v], V(...BUILD_POS[v], 0)); await beat(tok, 300); }
  lit(row[3], GOLD); lit(row[8], GOLD);
  say('對每一份資料再呼叫 ConstructTree', '左份：3 當 root，1 放左、4 放右；右份：8');
  await step(tok);                                   // 106:16 reuse 同樣的函式
  bub('ConstructTree 呼叫 ConstructTree：遞迴！', 3.4, 7.3);
  say('同一個函式拿來 reuse', '這就是 recursion');
  await step(tok);                                   // 106:22 link root to T_i
  lit(row[3]); lit(row[8]);
  cp.ls[5].element.style.visibility = ''; cp.hl(5);
  const E = BUILD_E.map(([a, b]) => [row[a], row[b]]);
  edgeLines(() => E.map(([a, b]) => [a.obj.position, b.obj.position]));
  say('最後：link root to T_i', '把箭頭設定好，一棵樹就建好了（補充：這是 BST 的雛形）');
}]);

// 106:46 終止條件
FRAG.push(['treea-lin-term', '遞迴建樹的終止條件：return NULL', async (tok) => {
  cam([0, 4.4, 13.5], [0, 3.4, 0]);
  const lines = ['ConstructTree(data):', '  if data empty: return NULL', '  else:', '    create root node from data[0]', '    partition data into n sets', '    T_i = ConstructTree(i-th set)', '    link root to T_i', '    return address of root node'];
  const cp = code(lines, -3.9, 6.6, 0.5);
  [1, 2, 7].forEach((i) => { cp.ls[i].element.style.visibility = 'hidden'; });
  const row = dataRow();
  await step(tok);                                   // 106:46 沒有 termination condition
  const calls = [];
  for (let i = 0; i < 3; i++) { calls.push(noT('ConstructTree({ })…', 3.6 + i * 0.4, 6.4 - i * 0.8)); await beat(tok, 300); }
  say('剛才的遞迴：沒說什麼時候停', '空的資料還一直往下呼叫？');
  await step(tok);                                   // 107:00 if data empty → return NULL
  killAll(calls);
  cp.ls[1].element.style.visibility = ''; cp.hl(1);
  say('終止條件：沒有資料要裝了', 'if data empty：return NULL');
  await step(tok);                                   // 107:16 else … return address of root node
  cp.ls[2].element.style.visibility = ''; cp.ls[7].element.style.visibility = ''; cp.hl(7);
  say('否則：建 root、link 完', 'return address of root node：代表整棵樹');
  await step(tok);                                   // 107:24 跑這個 pseudo code 就能建出一棵 tree
  cp.hl(-1);
  for (const v of BUILD_DATA) { lab.springTo(row[v], V(...BUILD_POS[v], 0)); await beat(tok, 200); }
  const E = BUILD_E.map(([a, b]) => [row[a], row[b]]);
  edgeLines(() => E.map(([a, b]) => [a.obj.position, b.obj.position]));
  const NL = [[8, -0.45], [8, 0.45], [1, -0.45], [1, 0.45], [4, -0.45], [4, 0.45]].map(([v, dx]) => tag('NULL', 'idx', BUILD_POS[v][0] + dx, BUILD_POS[v][1] - 0.8));
  say('照著跑，就能真的建出一棵 tree', '空的那些地方：回傳 NULL');
  await step(tok);                                   // 108:29 重新講解：data[0] 當 root，切 n 份
  lit(row[5], GOLD);
  [3, 1, 4].forEach((v) => lit(row[v], '#10304a')); lit(row[8], '#3a1a00');
  say('再講一次：data[0] 當 root', '其他用某個方法切成 n 份（小的左、大的右）');
  await step(tok);                                   // 108:59 recursive formula + termination condition
  BUILD_DATA.forEach((v) => lit(row[v]));
  okT('遞迴式（else 那段）＋ 終止條件（if 那行）', 3.6, 7.3);
  say('完整的 recursion', 'recursive formula + termination condition');
  await step(tok);                                   // 109:18 null pointer 代表不再遞迴
  NL.forEach((l) => { l.element.className = 'lab-label ptr alt'; });
  say('NULL pointer：這裡不再遞迴建任何東西', '<span class="ok">遞迴在這裡停下來</span>');
}]);

// ── 樹高與 node 數（本課 root = level 0）──
function hnTable() {
  tag('h │ 最少 n │ 最多 n', 'ptr', -5, 6.6);
  const rows = [0, 1, 2].map((h) => tag('h = ' + h + '：?', 'idx', -5, 6.0 - h * 0.6));
  const fill = (h, a, b) => { rows[h].element.textContent = 'h = ' + h + '：' + a + ' ≤ n ≤ ' + b; rows[h].element.className = 'lab-label ptr alt'; };
  return fill;
}
// a little tree of buddies from [[x, y, parentIndex], …]
function budMini(list, color, size = 0.5) {
  const bs = list.map(([x, y]) => buddy(null, '', color, x, y - size / 2, 0, size));
  list.forEach(([x, y, p]) => { if (p !== undefined) { const [px, py] = list[p]; bs.push({ g: K.line(px, py - size / 2, x, y + size / 2, -0.05, EDGE) }); } });
  return bs;
}

// 110:08 樹高與 node 數：h = 0、1
FRAG.push(['treea-lin-hn', '樹高 h 與 node 數：h = 0、h = 1', async (tok) => {
  cam([0, 4.4, 13.5], [0, 3.8, 0]);
  let fill = null;
  await step(tok);                                   // 110:08 每個 node 最多兩個真的小孩
  const ex = budMini([[2.6, 6.0], [1.6, 4.7, 0], [3.6, 4.7, 0], [2.9, 3.4, 2]], '#4b9ee2');
  tag('∅', 'idx', 4.3, 3.4);
  say('binary tree：每個 node 最多兩個真的小孩', '也可能只有一個（另一個是 NULL）');
  await step(tok);                                   // 110:31 高度跟能裝的 node 數有什麼關係
  ex.forEach((b) => kill(b.g));
  fill = hnTable();
  say('樹的高度和能裝的 node 數有什麼關係？', 'node 是真正裝資料的地方');
  await step(tok);                                   // 111:34 塞 10 萬筆，最矮跟最高差多少
  const q = bub('塞 10 萬筆資料：樹最矮、最高差多少？', 2.4, 7.3);
  say('例如要塞 10 萬筆資料', '樹最矮、最高差多少？');
  await step(tok);                                   // 111:54 高度是 0：root 孤單一人
  kill(q);
  const [r0] = budMini([[-1, 5.8]], '#2fc092', 0.6);
  r0.mood('sad');
  say('h = 0：只有 root，孤單一人', '沒有任何小孩');
  await step(tok);                                   // 112:22 最少、最多都是一個
  fill(0, 1, 1);
  say('h = 0：最少 1 個、最多也是 1 個', '');
  await step(tok);                                   // 112:40 h = 1：root 至少要有一個小孩
  budMini([[2, 5.8], [1.2, 4.4, 0]], '#4b9ee2');
  say('h = 1：root 至少要生一個小孩', '才長得出高度 → 最少 2 個');
  await step(tok);                                   // 112:56 兩個小孩 → 3 個
  const m3 = budMini([[5, 5.8], [4.2, 4.4, 0], [5.8, 4.4, 0]], '#9b7ef4');
  m3[0].mood('happy');
  say('root 生兩個小孩：3 個 node', '');
  await step(tok);                                   // 113:07 h = 1：2 ≤ n ≤ 3
  fill(1, 2, 3);
  say('高度 1 的 binary tree', '<span class="ok">2 ≤ n ≤ 3</span>');
}]);

// 113:19 h = 2 的最多／最少與 skewed tree
FRAG.push(['treea-lin-h2', 'h = 2 的最多、最少與 skewed tree', async (tok) => {
  cam([0, 4.4, 13.5], [0, 3.8, 0]);
  const fill = hnTable(); fill(0, 1, 1); fill(1, 2, 3);
  const full = [[2.5, 6.2], [1.0, 4.8, 0], [4.0, 4.8, 0], [0.25, 3.4, 1], [1.75, 3.4, 1], [3.25, 3.4, 2], [4.75, 3.4, 2]];
  let objs = [];
  await step(tok);                                   // 113:19 h = 2 最多：每個人都生兩個
  objs = budMini(full, '#4b9ee2');
  await dropIn(tok, objs.filter((b) => b.mood), 600);
  say('h = 2 最多：每個人都生兩個小孩', '');
  await step(tok);                                   // 113:27 1 + 2 + 4 = 7
  tag('1', 'idx', 5.8, 6.2); tag('+2', 'idx', 5.8, 4.8); tag('+4 = 7', 'idx', 5.8, 3.4);
  say('第一代 1、第二代 2、第三代 4', '1 + 2 + 4 = 7 個');
  await step(tok);                                   // 113:36 最小：代代單傳
  objs.forEach((b) => kill(b.g)); objs = [];
  const a = budMini([[0.8, 6.2], [0, 4.8, 0], [-0.8, 3.4, 1]], ORANGE);
  say('最少：代代單傳', '每一代只生一個（這裡都生左小孩）');
  await step(tok);                                   // 113:54 binary tree 左右有差
  const b = budMini([[4.6, 6.2], [3.8, 4.8, 0], [4.6, 3.4, 1]], ORANGE);
  say('binary tree 左右有差', '有人生左小孩、有人生右小孩，也是單傳');
  await step(tok);                                   // 114:18 最少也能裝 3 筆
  fill(2, 3, 7);
  say('h = 2：最少 3 個、最多 7 個', '<span class="ok">3 ≤ n ≤ 7</span>');
  await step(tok);                                   // 114:27 只偏一邊長：歪斜樹 skewed
  a.forEach((o) => { if (o.mood) o.glow(RED); });
  tag('skewed tree（歪斜樹）', 'ptr alt', 0, 2.4);
  say('只偏一邊長的樹：skewed tree', '（歪斜樹）');
  await step(tok);                                   // 115:00 長得像 linked list
  arrow(V(1.3, 6.0, 0.4), V(0.4, 4.9, 0.4), KIDC); arrow(V(0.5, 4.6, 0.4), V(-0.4, 3.5, 0.4), KIDC);
  note('一點也不像樹，像 linked list', 0.3, 1.7);
  say('skewed tree 一點也不像樹', '反而像 linked list');
  await step(tok);                                   // 115:10 退化的樹，我們不喜歡
  a.forEach((o) => { if (o.mood) o.mood('sad'); }); b.forEach((o) => { if (o.mood) o.mood('sad'); });
  noT('退化的樹：限制、缺點都跟 linked list 一樣', 2.4, 1.0);
  say('它是一棵退化的樹', '我們不喜歡這種歪歪的樹');
}]);

// 115:45 一般高度 h
FRAG.push(['treea-lin-hf', '一般高度 h：h+1 ≤ n ≤ 2^(h+1) − 1', async (tok) => {
  cam([0, 4.6, 13.5], [0, 3.4, 0.6]);
  const H = 3, BXX = (i) => 5.2 - i * 0.9;
  await step(tok);                                   // 115:45 一般的 h：最少？
  tag('最少（示意 h = 3）', 'ptr', -5.4, 7.0);
  say('一般的高度 h：最少有幾個 node？', '每一代都單傳');
  await step(tok);                                   // 115:53 每一代至少一個人 → h + 1
  for (let i = 0; i <= H; i++) { buddy(null, '', ORANGE, -5.4, 6.2 - i * 1.2 - 0.22, 0, 0.45); tag('第 ' + i + ' 代', 'idx', -4.4, 6.2 - i * 1.2); }
  for (let i = 0; i < H; i++) K.line(-5.4, 5.98 - i * 1.2, -5.4, 5.22 - i * 1.2, -0.05, EDGE);
  okT('n 最少 = h + 1', -5.0, 1.1);
  say('第 0 代到第 h 代，每代至少 1 個', '<span class="ok">最少 h + 1 個</span>');
  await step(tok);                                   // 116:07 最多：每個人都生兩個
  tag('最多：每個人生兩個', 'ptr', 1.2, 7.0);
  const lay = [];
  for (let i = 0; i <= H; i++) { const k = 1 << i; for (let j = 0; j < k; j++) lay.push(cube('', '#4b9ee2', [0.42, 0.38, 0.42], 1.2 + (j - (k - 1) / 2) * 0.55, 6.2 - i * 1.2, 0, 1.5)); await beat(tok, 300); }
  say('最多：每個人都生兩個小孩', '');
  await step(tok);                                   // 116:15 1 + 2 + 4 + 8 + …
  for (let i = 0; i <= H; i++) tag('2^' + i + ' = ' + (1 << i), 'idx', 4.2, 6.2 - i * 1.2);
  say('每一層：1、2、4、8…', '要算 1 + 2 + 4 + 8 + …');
  await step(tok);                                   // 116:24 等比級數 → 用二進位看
  bub('等比級數：用二進位來看！', 1.2, 7.6);
  say('高中學過的等比級數', '換個角度：用二進位看');
  await step(tok);                                   // 116:31 每個 digit 都是 1
  const bits = [];
  for (let i = 0; i <= H; i++) { bits[i] = cube('1', '#2fc092', [0.6, 0.5, 0.6], BXX(i), 0.3, 2.2, 2); tag('2' + '⁰¹²³⁴'[i], 'idx', BXX(i), 0.3, 3.0); await beat(tok, 250); }
  say('每一層是一個 bit，都是 1', '1111₂ = 1 + 2 + 4 + 8 = 15');
  await step(tok);                                   // 116:45 總共 2^(h+1) − 1
  okT('n 最多 = 2^(h+1) − 1', 3.4, 1.4);
  say('第 0 位到第 h 位都是 1', '<span class="ok">總數 = 2^(h+1) − 1</span>');
  await step(tok);                                   // 117:01 一串 1 = 下一位的 2 的冪次再減 1
  const one = cube('+1', '#f2c46d', [0.6, 0.5, 0.6], BXX(0), 1.1, 2.2, 2);
  await beat(tok, 500); kill(one);
  for (let i = 0; i <= H; i++) { relab(bits[i], 0); bits[i].obj.material.color.set('#b9a582'); await beat(tok, 200); }
  cube('1', '#2fc092', [0.6, 0.5, 0.6], BXX(4), 0.3, 2.2, 2); tag('2⁴', 'idx', BXX(4), 0.3, 3.0);
  say('一串 1 再加 1：一路進位', '1111₂ + 1 = 10000₂ = 2⁴ → 1111₂ = 2⁴ − 1');
  await step(tok);                                   // 117:52 node 數介於兩者之間
  bub('h + 1 ≤ n ≤ 2^(h+1) − 1', -0.6, 0.6, 1.2);
  say('node 數 n 的範圍', '<span class="ok">h + 1 ≤ n ≤ 2^(h+1) − 1</span>');
  await step(tok);                                   // 118:07 反過來：給 n，看 h
  say('反過來：給定 n（要裝的資料數）', 'h 的範圍是多少？');
  await step(tok);                                   // 118:40 h 最多 n − 1
  okT('h ≤ n − 1', -2.4, 0.0, 1.2);
  say('h 最多：n − 1', '（每代單傳）');
  await step(tok);                                   // 118:58 lg(n+1) − 1；lg = log₂
  okT('h ≥ lg(n+1) − 1', 1.6, 0.0, 1.2);
  say('h 最少：lg(n + 1) − 1', 'lg = 以 2 為底的 log');
  void lay;
}]);

// ── 為什麼在意樹高 ──
const GOOD_T = '4(2(1,3),6(5,7))', SKEW_T = '1(,2(,3(,4(,5(,6(,7))))))';
function twoTrees() {
  const L = bTree(GOOD_T, { cx: -3.4, width: 5.6, topY: 6.4, minY: 3.4, maxStep: 1.5, maxSp: 0.95 }, 0.5);
  const R = bTree(SKEW_T, { cx: 3.6, width: 5.4, topY: 6.6, minY: 0.8, maxStep: 0.95, maxSp: 0.85 }, 0.45);
  bEdges(L); bEdges(R);
  tag('n = 7（示意）', 'idx', -3.4, 7.3);
  return { L, R };
}
async function searchWalk(tok, root, cur, cnt, target, ms) {
  let n = root, k = 0;
  while (n) {
    await walkTo(tok, cur, n, ms); n.bd.glow(GOLD); k++; cnt.element.textContent = '拜訪 ' + k + ' 次';
    if (String(target) === n.label) { n.bd.mood('happy'); break; }
    n = Number(target) < Number(n.label) ? n.left : n.right;
  }
  return k;
}

// 119:18 為什麼在意樹高
FRAG.push(['treea-lin-search', '為什麼在意樹高：搜尋次數 ≈ h', async (tok) => {
  cam([0, 4.4, 13.5], [0, 3.6, 0.6]);
  let T = null, cur = null; const cL = tag('', 'ptr alt', -3.4, 2.5);
  await step(tok);                                   // 119:18 為什麼這件事重要
  T = twoTrees();
  say('為什麼在意 h 和 n 的關係？', '示意：兩棵都是 7 個 node 的 binary tree');
  await step(tok);                                   // 119:28 階層式 access：從 root 出發
  cur = pkt('找 7', T.L.pos.x, T.L.pos.y + 0.85, 0.3);
  T.L.bd.glow(GOLD);
  say('tree 是階層式 access', '常常從 root 出發往下找');
  await step(tok);                                   // 119:50 每一層只找一次
  await searchWalk(tok, T.L, cur, cL, '7', 600);
  say('每一層只找一次', '4 → 6 → 7');
  await step(tok);                                   // 120:02 最多找樹的高度那麼多次
  note('最多找「樹高」那麼多層', -3.4, 1.8);
  say('最多就找樹的高度那麼多次', '（這棵 h = 2：3 層）');
  await step(tok);                                   // 120:09 像以前的 sequential／binary search
  bub('像以前分析 sequential／binary search：看拜訪幾個 node', 1.0, 7.4);
  say('像以前分析 sequential、binary search', '數拜訪了幾個 node');
  await step(tok);                                   // 120:32 兩個極端：跟 log 有關
  note('一個極端：≈ log n', -3.4, 1.2); note('另一個極端：≈ n', 3.6, 0.2);
  say('這裡有兩個極端', '一個跟 log（node 數）有關');
  await step(tok);                                   // 120:45 binary search 每次丟掉一半
  const xs = [-6, -5.1, -4.2, -3.3, -2.4, -1.5, -0.6];
  const arr = xs.map((x, k) => cube(k + 1, '#b9a582', SMALL, x, 0.3, 2.6, 1.5));
  for (const [mid, drop] of [[3, [0, 1, 2, 3]], [5, [4, 5]], [6, []]]) {
    lit(arr[mid], GOLD); await beat(tok, 350);
    drop.forEach((k) => { arr[k].obj.material.color.set('#d8cfc0'); lit(arr[k]); });
  }
  say('binary search：ordered array 每次丟掉一半', '找 7：4 → 6 → 7');
  await step(tok);                                   // 121:01 次數大約 log(資料數量)
  okT('比較次數 ≈ lg n', -3.3, 1.2, 2.6);
  say('最多比較 ≈ log（資料數量）次', '<span class="ok">tree 的搜尋成本跟 h 有關</span>');
}]);

// 121:07 Best vs worst
FRAG.push(['treea-lin-best', 'Best case 矮樹 vs worst case 退化樹', async (tok) => {
  cam([0, 4.4, 13.5], [0, 3.6, 0.6]);
  const T = twoTrees();
  const cL = tag('', 'ptr alt', -3.4, 2.5), cR = tag('', 'ptr alt', 5.6, 6.6);
  await step(tok);                                   // 121:09 樹很矮，接近 log n
  okT('矮：h ≈ log n 👍', -3.4, 1.6);
  levelorder(T.L).forEach((n) => n.bd.mood('happy'));
  say('樹很矮、接近 log n', '只要花 log n 次就找到');
  await step(tok);                                   // 121:15 當 search structure：矮矮的就找到
  const curL = pkt('找 7', T.L.pos.x, T.L.pos.y + 0.85, 0.3);
  await searchWalk(tok, T.L, curL, cL, '7', 550);
  say('binary tree 當成 search structure', '矮矮的：3 次就找到');
  await step(tok);                                   // 121:26 像 linked list 那棵：高度 n − 1
  const curR = pkt('找 7', T.R.pos.x, T.R.pos.y + 0.75, 0.3);
  await searchWalk(tok, T.R, curR, cR, '7', 300);
  say('退化成 linked list 的樹', '高度 n − 1：找 7 要走到底');
  await step(tok);                                   // 121:33 linear 力氣 ≈ sequential search
  levelorder(T.R).forEach((n) => n.bd.mood('sad'));
  noT('h = n − 1：linear 👎', 3.4, 0.0);
  say('要花 linear 的力氣', '跟 linked list 上的 sequential search 差不多');
  await step(tok);                                   // 121:47 未來：努力壓低樹高
  arrow(V(0.6, 1.4, 0), V(-1.4, 2.6, 0), CHILD_C);
  bub('目標：把樹高壓低！', -0.4, 7.5);
  say('設計 tree 的資料結構和演算法時', '要努力壓低樹的高度');
  await step(tok);                                   // 122:21 不想要退化樹
  note('要退化，不如乖乖用 linked list', 3.6, 7.3);
  say('我們不想要退化樹', '要退化，不如直接用 linked list');
  await step(tok);                                   // 122:54 同一層多塞東西比較好
  for (const n of levelorder(T.L).filter((m) => m.depth === 2)) { n.bd.glow(GREEN); await n.bd.hop(tok); }
  say('同一層多塞一點 node 對我們有利', '<span class="ok">矮胖好，瘦高（退化）不好</span>');
}]);

// 134:01 Q&A：網站是 tree 嗎？HTML 與 parse tree
FRAG.push(['treea-lin-html', 'Q&A：網站是 tree 嗎？HTML parse tree', async (tok) => {
  cam([0, 4.6, 13.5], [0, 3.6, 0]);
  let dir = null;
  await step(tok);                                   // 134:01 網站上的架構是 tree 嗎
  bub('同學問：網站的架構是 tree 嗎？', 0, 7.4);
  say('同學問：網站是 tree data structure 嗎？', '分幾個角度來看');
  await step(tok);                                   // 134:20 放在 directory structure 裡
  dir = layoutG(parseG('site(index.html,blog(post.html),img(a.png))'), { cx: -3.8, width: 4.6, topY: 6.2, step: 1.4 });
  cEdges(dir); gAll(dir).forEach((n) => cNode(n, 2, n.kids.length ? '#e2b13c' : '#8fa3b8'));
  say('網頁檔案放在 directory 裡', 'directory 可以看成 tree structure');
  await step(tok);                                   // 134:51 網頁之間的 hyperlink 未必是 tree
  gAll(dir).forEach((n) => { kill(n.body); n.body = null; });
  const pg = { home: [-5, 6], cv: [-2.4, 6], blog: [-5, 4], post: [-2.4, 4] };
  for (const k of Object.keys(pg)) cube(k, '#8fa3b8', [1.2, 0.55, 0.7], pg[k][0], pg[k][1], 0, 2);
  const A = (a, b, dy = 0) => arrow(V(pg[a][0] + (pg[b][0] > pg[a][0] ? 0.62 : pg[b][0] < pg[a][0] ? -0.62 : 0.2), pg[a][1] + dy + (pg[b][1] < pg[a][1] ? -0.3 : pg[b][1] > pg[a][1] ? 0.3 : 0), 0),
    V(pg[b][0] + (pg[b][0] > pg[a][0] ? -0.62 : pg[b][0] < pg[a][0] ? 0.62 : 0.2), pg[b][1] + dy + (pg[b][1] < pg[a][1] ? 0.3 : pg[b][1] > pg[a][1] ? -0.3 : 0), 0), KIDC);
  A('home', 'cv', 0.12); A('cv', 'home', -0.12); A('home', 'blog'); A('blog', 'post', 0); A('post', 'home');
  note('hyperlink：我連到你，不代表我是你爸爸', -3.7, 2.9);
  say('網頁之間用 hyperlink 互相連', '連結沒有「爸爸、小孩」的意思');
  await step(tok);                                   // 135:19 graph structure
  noT('可以互連、繞圈 → graph structure', -3.7, 2.2);
  say('hyperlink 的關係比 tree 更複雜', '叫做 graph structure');
  await step(tok);                                   // 135:28 網站用 html 寫
  const html = ['<html>', '  <head>…</head>', '  <body>', '    <a href=…>', '      <img src=…>', '    </a>', '    <p>…</p>', '  </body>', '</html>'];
  const cp = code(html, -0.6, 6.4, 0.42);
  say('另一個角度：網頁是用 HTML 寫的', '老師的網頁原始碼（示意）');
  await step(tok);                                   // 135:39 HyperText Markup Language
  tag('HTML = HyperText Markup Language', 'ptr alt', 1.8, 7.4);
  say('HTML：HyperText Markup Language', '（不是 machine learning 啦）');
  await step(tok);                                   // 135:55 結構化的文字
  for (const i of [0, 2, 3, 6]) { cp.hl(i); await beat(tok, 350); }
  cp.hl(-1);
  say('用文字標記出結構', '一種結構化的文字');
  await step(tok);                                   // 136:26 外面是連結，裡面是圖片
  cp.hl(3);
  cp.ls[4].element.className = 'lab-label ptr alt';
  say('例如：外面是一個連結 <a>', '裡面包著一張圖片 <img>');
  await step(tok);                                   // 136:41 每個結構想成一個 subtree
  const g = layoutG(parseG('html(head,body(a(img),p))'), { cx: 4.6, width: 3.6, topY: 6.0, step: 1.4 });
  cEdges(g);
  for (const l of ['a', 'img']) cNode(gFind(g, l), 2, '#f3d36b');
  const bx = ghost(KIDC, gFind(g, 'a').pos.x, (gFind(g, 'a').pos.y + gFind(g, 'img').pos.y) / 2, 1.6, 2.4);
  say('每個標記結構都可以看成一棵 subtree', '<a> 是 root，<img> 是它的小孩');
  await step(tok);                                   // 136:57 整頁表示成 tree structure
  kill(bx); cp.hl(-1); cp.ls[4].element.className = 'lab-label';
  for (const n of gAll(g)) if (!n.body) { cNode(n, 2); await beat(tok, 150); }
  say('一層一層包起來', '整個網頁就是一棵 tree');
  await step(tok);                                   // 137:22 parse tree；像作業三的 expression tree
  okT('網頁的 parse tree', 4.6, 1.2);
  note('跟作業三的 expression tree 很像：都在描述文法結構', 0, 0.5);
  say('這叫網頁的 parse tree', '跟作業三的 expression tree 很像');
}]);

// ── full binary tree 1..7 ──
const PC_POS = (i) => heapPos(i, 6.4, 1.9, 8);
const bin = (i) => i.toString(2);
function fullBuddies(withNum = true) {
  const N = {};
  for (let i = 1; i <= 7; i++) { const p = PC_POS(i); N[i] = buddy(null, withNum ? i : '', depthColor(hdepth(i)), p.x, p.y - 0.3, 0, 0.6); }
  for (let i = 2; i <= 7; i++) { const a = PC_POS(i >> 1), b = PC_POS(i); K.line(a.x, a.y - 0.3, b.x, b.y + 0.3, -0.05, EDGE); }
  return N;
}

// 139:37 Full binary tree 的編號與二進位
FRAG.push(['treea-lin-num', 'Full binary tree 的編號與二進位', async (tok) => {
  cam([0, 4.4, 13.5], [0, 3.8, 0]);
  let N = null;
  await step(tok);                                   // 139:37 同樣高度塞最多 node 的情形
  say('同樣的高度：最多能塞幾個 node？', '從「最多」的情形講下去');
  await step(tok);                                   // 139:53 三層，每個都有兩個小孩
  N = fullBuddies(false);
  await dropIn(tok, Object.values(N), 700);
  say('三層，每個 node 都有兩個小孩', '塞得滿滿的：1 + 2 + 4 = 7 個');
  await step(tok);                                   // 140:10 full binary tree
  okT('full binary tree', 0, 7.4);
  say('這種樹叫 full binary tree', '非常完整，每個位置都有 node');
  await step(tok);                                   // 140:23 給每個 node 一個編號
  say('給每個 node 一個編號', '');
  await step(tok);                                   // 140:30 由上到下、由左到右：1 到 7
  for (let i = 1; i <= 7; i++) { N[i].set(i); N[i].glow(GOLD); await beat(tok, 200); N[i].glow(); }
  say('由上到下、同層由左到右編號', '1、2、3、4、5、6、7');
  await step(tok);                                   // 140:49 跟二進位表示法寫在一起
  bub('把編號寫成二進位', 0, 7.4);
  say('把編號跟它的二進位寫在一起', '');
  await step(tok);                                   // 141:06 1、10、11、100、101、110、111
  for (let i = 1; i <= 7; i++) { const p = PC_POS(i); tag(bin(i), 'ptr alt', p.x + 0.85, p.y + 0.15); await beat(tok, 250); }
  say('1、10、11、100、101、110、111', '');
  await step(tok);                                   // 141:19 binary representation of node number
  note('金字 = node 編號的 binary representation（老師用紅字）', 0, 1.0);
  say('node number 的 binary representation', '仔細看，會發現有趣的規則');
}]);

// 141:35 Path code
FRAG.push(['treea-lin-path', 'Path code：往左接 0、往右接 1', async (tok) => {
  cam([0, 4.4, 13.5], [0, 3.8, 0]);
  const N = fullBuddies(true);
  for (let i = 1; i <= 7; i++) { const p = PC_POS(i); tag(bin(i), 'ptr alt', p.x + 0.85, p.y + 0.15); }
  const linkLbl = (i) => { const a = PC_POS(i >> 1), b = PC_POS(i), m = a.clone().add(b).multiplyScalar(0.5); const l = tag(i % 2 ? '1' : '0', 'ptr', m.x + (i % 2 ? 0.35 : -0.35), m.y + 0.2); if (i % 2 === 0) l.element.style.color = CHILD_C; return l; };
  const pathT = tag('', 'ptr alt', 0, 0.6, 1.5);
  const cur = pkt('從這出發', PC_POS(1).x, PC_POS(1).y + 0.75, 0.3);
  const go = async (i, code2) => { await travel(tok, cur, cur.position.clone(), V(PC_POS(i).x, PC_POS(i).y + 0.75, 0.3), 600); N[i].glow(GOLD); pathT.element.textContent = 'path code：' + code2 + ' = ' + i; };
  const off = () => { for (let i = 1; i <= 7; i++) N[i].glow(); };
  await step(tok);                                   // 141:35 為什麼寫這個給大家看
  bub('為什麼要寫二進位？仔細看…', 0, 7.4);
  say('為什麼要寫二進位？', '');
  await step(tok);                                   // 142:08 往左的 link 寫 0
  [2, 4, 6].forEach(linkLbl);
  say('在每條往左的 link 上寫 0（綠色）', '');
  await step(tok);                                   // 142:19 1 往左接 0 → 10 = 2
  await go(2, '1·0');
  say('從 1 往左：接上 0 → 10₂', '就是 2 號');
  await step(tok);                                   // 142:26 再往左 → 100 = 4
  await go(4, '1·00');
  say('再往左：再接 0 → 100₂', '就是 4 號');
  await step(tok);                                   // 142:34 3 = 11 往左 → 110 = 6
  off(); cur.position.copy(V(PC_POS(3).x, PC_POS(3).y + 0.75, 0.3)); N[3].glow(GOLD);
  await go(6, '1·10');
  say('3 是 11₂，往左接 0 → 110₂', '就是 6 號');
  await step(tok);                                   // 142:50 往右走就是 1
  off();
  [3, 5, 7].forEach(linkLbl);
  say('往右的 link 寫 1', '');
  await step(tok);                                   // 142:59 1 → 11 = 3 → 111 = 7
  cur.position.copy(V(PC_POS(1).x, PC_POS(1).y + 0.75, 0.3));
  await go(3, '1·1'); await go(7, '1·11');
  say('從 1 一路往右：11₂ = 3，111₂ = 7', '');
  await step(tok);                                   // 143:27 前面先放 1，後面接路徑
  off();
  okT('編號 = 1 後面接上路徑的 0／1（看成二進位）', 0, 0.0, 1.5);
  say('規則：先放一個 1', '後面接上沿路的 0、1，當成二進位數');
  await step(tok);                                   // 143:58 後面加 0 = ×2
  note('接 0 = 左移一位 = ×2', -4.4, 7.3);
  say('二進位後面接一個 0', '= 左移一位（shift）= ×2');
  await step(tok);                                   // 144:06 110 = 6 → 1100 = 12
  tag('110₂ = 6 → 1100₂ = 12', 'ptr', -4.4, 6.6);
  say('例：110₂ = 6，接 0 → 1100₂ = 12', '');
  await step(tok);                                   // 144:36 接 1 = shift 再加 1
  note('接 1 = ×2 + 1', 4.4, 7.3);
  say('接一個 1', '= shift 之後再加 1 = ×2 + 1');
  await step(tok);                                   // 144:45 2、3 跟 1；4、5 跟 2
  for (const [p, a, b] of [[1, 2, 3], [2, 4, 5]]) { N[p].glow(GOLD); N[a].glow(GREEN); N[b].glow(GREEN); await beat(tok, 900); [p, a, b].forEach((k) => N[k].glow()); }
  N[2].glow(GREEN); N[3].glow(GREEN);
  say('2 = 1×2、3 = 1×2+1', '4 = 2×2、5 = 2×2+1');
}]);

// ── 用 vector 存 full binary tree ──
const VX = (i) => -4.2 + (i - 1) * 1.3;
function vecTiles(n, z = 1.5) { const t = []; for (let i = 1; i <= n; i++) { t[i] = K.zone('', VX(i), 0, z, 1.0, 1.0, '#e9dcc4'); tag('[' + i + ']', 'idx', VX(i), 0.1, z + 0.75); } return t; }
function arc2(a, b, color, h) {
  const peak = V((a.x + b.x) / 2, Math.max(a.y, b.y) + (h === undefined ? 0.3 + 0.22 * Math.abs(b.x - a.x) : h), (a.z + b.z) / 2);
  return [seg(a, peak, color), arrow(peak, b, color)];
}

// 145:07 用 vector 存 full binary tree
FRAG.push(['treea-lin-vec', '用 vector 存 full binary tree：不需要指標', async (tok) => {
  cam([0, 5.2, 12.5], [0, 3.0, 0.8]);
  const P = (i) => heapPos(i, 6.8, 1.2, 7);
  const N = {}, C = {}, E = [];
  edgeLines(() => E.map(([a, b]) => [a.obj.position, b.obj.position]));
  for (let i = 1; i <= 7; i++) { N[i] = cube(i, depthColor(hdepth(i)), [0.7, 0.55, 0.7], P(i).x, P(i).y); if (i > 1) E.push([N[i >> 1], N[i]]); }
  let tiles = null; const arcs = [];
  await step(tok);                                   // 145:07 最喜歡用編號的是哪個？
  const guesses = [noT('stack？', -5.2, 6.8), noT('queue？', -5.2, 6.1), noT('linked list？', -5.2, 5.4)];
  say('哪個 data structure 最喜歡用編號？', 'stack？queue？linked list？都不是');
  await step(tok);                                   // 145:21 就是 vector
  killAll(guesses);
  okT('vector！', -5.2, 6.4);
  say('最喜歡用編號的：vector', '');
  await step(tok);                                   // 145:40 vector 有 7 格，編號 1 到 7
  tiles = vecTiles(7);
  for (let i = 1; i <= 7; i++) { C[i] = cube(i, depthColor(hdepth(i)), [0.7, 0.55, 0.7], P(i).x, P(i).y); lab.springTo(C[i], V(VX(i), 0.35, 1.5)); await beat(tok, 200); }
  say('建一個 7 格的 vector，編號 1 到 7', '整棵 full binary tree 就塞進去了');
  await step(tok);                                   // 146:04 1 號格找左小孩：乘以 2
  lit(C[1], GOLD); lit(N[1], GOLD);
  arcs.push(...arc2(V(VX(1), 0.7, 1.5), V(VX(2), 0.7, 1.5), CHILD_C));
  say('在 1 號格找左小孩：編號 ×2', '1 × 2 = 2');
  await step(tok);                                   // 146:14 乘以 2 加 1：右小孩
  arcs.push(...arc2(V(VX(1), 0.7, 1.5), V(VX(3), 0.7, 1.5), KIDC));
  say('找右小孩：編號 ×2 + 1', '1 × 2 + 1 = 3');
  await step(tok);                                   // 146:25 2 號格也一樣
  lit(C[1]); lit(N[1]); lit(C[2], GOLD); lit(N[2], GOLD);
  arcs.push(...arc2(V(VX(2), 0.7, 1.5), V(VX(4), 0.7, 1.5), CHILD_C), ...arc2(V(VX(2), 0.7, 1.5), V(VX(5), 0.7, 1.5), KIDC));
  await beat(tok, 500);
  lit(C[2]); lit(N[2]); lit(C[3], GOLD); lit(N[3], GOLD);
  arcs.push(...arc2(V(VX(3), 0.7, 1.5), V(VX(6), 0.7, 1.5), CHILD_C), ...arc2(V(VX(3), 0.7, 1.5), V(VX(7), 0.7, 1.5), KIDC));
  say('2 號格：4 是左小孩、5 是右小孩', '3 號格：6、7');
  await step(tok);                                   // 146:42 根本不用另外加連線
  lit(C[3]); lit(N[3]);
  E.length = 0;
  say('根本不用另外存連線（小紙條）', '找小孩：算編號就好');
  await step(tok);                                   // 147:16 很快的位元運算
  note('×2 = 左移 1 bit（i << 1）；×2+1 = (i << 1) | 1', 0, 7.4);
  say('×2、×2+1 是很快的位元運算', '往往比沿著小紙條在記憶體跳來跳去快');
  await step(tok);                                   // 147:53 不需要存小紙條 → 節省空間
  okT('不存小紙條 → 省下一大塊空間', 3.6, 6.4);
  say('不需要存小紙條', '省下一大部分空間');
  await step(tok);                                   // 148:12 每棵 binary tree = full 砍掉一些 node
  killAll(arcs);
  for (const i of [5, 6]) { lab.flyAway(N[i], V(i === 5 ? -3 : 3, 8, 3)); lab.flyAway(C[i], V(0, 8, 4)); }
  say('任何 binary tree = full 砍掉一些 node', '示意：砍掉 5、6');
  await step(tok);                                   // 148:32 vector 留一些空格
  for (const i of [5, 6]) tiles[i].material.color.set('#f4d9d0');
  noT('空格', VX(5.5), 1.1, 1.5);
  say('同樣的 vector，留一些空格', '像櫃子有幾格沒用');
  await step(tok);                                   // 148:48 任何 binary tree，不用任何 link
  okT('任何 binary tree 都能用 vector 表示，不用 link', 0, 7.4);
  say('用 vector 表示任何一棵 binary tree', '<span class="ok">不需要任何 link</span>');
}]);

// 149:24 空間浪費與 complete binary tree
FRAG.push(['treea-lin-complete', '空間浪費、complete binary tree 與找爸爸', async (tok) => {
  cam([0, 5.0, 13.5], [0, 3.4, 0.8]);
  let objs = [];
  function waste(set, levels) {
    const total = (1 << levels) - 1, sp = 12.6 / total, P = (i) => heapPos(i, 6.8, levels === 4 ? 1.35 : 1.15, levels === 4 ? 11 : 12.4);
    const out = [], M = {};
    for (let i = 1; i <= total; i++) {
      const x = -6.3 + (i - 0.5) * sp;
      out.push(K.zone('', x, 0, 2.6, sp * 0.86, 0.8, set.includes(i) ? '#e9dcc4' : '#f4d9d0'));
      if (set.includes(i)) {
        const p = P(i);
        M[i] = cube(levels === 4 ? i : '', depthColor(hdepth(i)), levels === 4 ? [0.55, 0.45, 0.55] : [0.42, 0.38, 0.42], p.x, p.y, 0, 2);
        out.push(M[i], cube('', depthColor(hdepth(i)), [sp * 0.6, 0.3, 0.5], x, 0.25, 2.6));
      }
    }
    const E = []; for (const i of set) if (i > 1) E.push([M[i >> 1], M[i]]);
    out.push(edgeLines(() => E.map(([a, b]) => [a.obj.position, b.obj.position])));
    return out;
  }
  function full7(drop) {
    const P = (i) => heapPos(i, 6.4, 1.6, 8);
    const N = {}, C = {}, T = [], E = [];
    edgeLines(() => E.filter(([a, b]) => a.obj.parent && b.obj.parent).map(([a, b]) => [a.obj.position, b.obj.position]));
    for (let i = 1; i <= 7; i++) {
      N[i] = cube(i, depthColor(hdepth(i)), NODE, P(i).x, P(i).y, 0, drop);
      if (i > 1) E.push([N[i >> 1], N[i]]);
      T[i] = [K.zone('', VX(i), 0, 1.5, 1.0, 1.0, '#e9dcc4'), tag('[' + i + ']', 'idx', VX(i), 0.1, 2.25)];
      C[i] = cube(i, depthColor(hdepth(i)), [0.7, 0.55, 0.7], VX(i), 0.35, 1.5);
    }
    return { N, C, T };
  }
  await step(tok);                                   // 149:24 越接近 full 越不浪費
  let F = full7(2);
  say('越接近 full binary tree', 'vector 表示法越不浪費空間：7 個 node 剛好 7 格');
  await step(tok);                                   // 149:32 四層的樹只裝 10 個 node
  cam([0, 5.0, 13.5], [0, 3.4, 0.8]);
  objs = waste([1, 2, 3, 4, 5, 6, 7, 9, 12, 15], 4);
  say('四層的樹只裝 10 個 node（示意）', 'vector 要 1+2+4+8 = 15 格；粉紅 = 空格');
  await step(tok);                                   // 149:47 五層的樹，要 31 格
  cam([0, 5.0, 13.5], [0, 3.4, 0.8]);
  objs = waste([1, 2, 3, 5, 6, 10, 11, 13, 26, 27], 5);
  say('五層的樹也只裝 10 個', '要配置 31 格 → 浪費 21 格');
  await step(tok);                                   // 150:04 越來越浪費
  noT('越不像 full，浪費越多', 0, 7.5);
  say('樹越「空」，浪費越多', '這是 vector 表示法的代價');
  await step(tok);                                   // 150:34 很接近 full、但不完全是
  cam([0, 5.0, 13.5], [0, 3.4, 0.8]);
  F = full7(0);
  say('有一種很接近 full 的 binary tree', '很快就會用到');
  await step(tok);                                   // 150:49 只有 full 的前面幾個 node
  for (const i of [7, 6, 5]) { lab.flyAway(F.N[i], V(4, 8, 3)); lab.flyAway(F.C[i], V(4, 8, 4)); F.T[i].forEach((o) => K.remove(o)); await beat(tok, 300); }
  say('只留 full binary tree 的前面幾個 node', '這裡：前 4 個');
  await step(tok);                                   // 151:14 complete binary tree
  okT('complete binary tree', 0, 7.4);
  say('這種叫 complete binary tree', 'node 編號 1、2、…、n');
  await step(tok);                                   // 151:27 對應到 size n 的 array
  for (let i = 1; i <= 4; i++) lit(F.C[i], GREEN);
  say('剛好對應 size n 的 array', '這裡 n = 4：用 4 格');
  await step(tok);                                   // 151:38 連線關係由 ×2、×2+1 決定
  for (let i = 1; i <= 4; i++) lit(F.C[i]);
  const arcs = [...arc2(V(VX(1), 0.7, 1.5), V(VX(2), 0.7, 1.5), CHILD_C), ...arc2(V(VX(1), 0.7, 1.5), V(VX(3), 0.7, 1.5), KIDC), ...arc2(V(VX(2), 0.7, 1.5), V(VX(4), 0.7, 1.5), CHILD_C)];
  say('連接關係還是由規則決定', '小孩 = ×2、×2+1');
  await step(tok);                                   // 152:11 4 號：4 ÷ 2 = 2，就是爸爸
  killAll(arcs);
  lit(F.C[4], GOLD); lit(F.N[4], GOLD); lit(F.C[2], GREEN); lit(F.N[2], GREEN);
  arcs.push(...arc2(V(VX(4), 0.7, 1.5), V(VX(2), 0.7, 1.5), '#4b9ee2'));
  say('從小孩找爸爸：4 ÷ 2 = 2', '2 號就是 4 號的爸爸');
  await step(tok);                                   // 152:18 5 ÷ 2 = 2（整數除法）
  note('5 ÷ 2 = 2.5 → 捨去小數 = 2', 3.6, 7.4);
  say('5 ÷ 2 用整數除法 = 2', '所以 5 號的爸爸也是 2 號');
  await step(tok);                                   // 152:27 小孩 ×2、×2+1；爸爸 ÷2
  [4, 2].forEach((k) => { lit(F.C[k]); lit(F.N[k]); });
  okT('小孩：×2、×2+1　爸爸：÷2（取整數）', 0, 0.2, 2.4);
  say('找小孩 ×2、×2+1；找爸爸 ÷2', '<span class="ok">parent(i) = ⌊i / 2⌋</span>（老師口誤說「乘以 2」）');
  void objs;
}]);

// 153:45 Q&A：五層的樹高度是 5 還是 4
FRAG.push(['treea-lin-leveldef', 'Q&A：五層的樹高度是 5 還是 4？', async (tok) => {
  cam([0, 4.4, 13.5], [0, 3.8, 0]);
  const set = [1, 2, 3, 4, 5, 6, 7, 8, 9, 16];
  const P = (i) => heapPos(i, 6.6, 1.3, 9);
  const M = {};
  await step(tok);                                   // 153:45 五層的高度是 5 還是 4
  for (const i of set) { M[i] = buddy(null, '', depthColor(hdepth(i)), P(i).x, P(i).y - 0.25, 0, 0.5); }
  for (const i of set) if (i > 1) { const a = P(i >> 1), b = P(i); K.line(a.x, a.y - 0.25, b.x, b.y + 0.25, -0.05, EDGE); }
  await dropIn(tok, set.map((i) => M[i]), 700);
  bub('五層的樹：高度是 5 還是 4？', 0, 7.5);
  say('同學問：五層的樹，高度是 5 還是 4？', '');
  await step(tok);                                   // 153:56 不同書說法不一樣
  note('不同的書，說法不一樣', 4.4, 6.8);
  say('不同書的說法不一樣', '沒有完全公定的定義');
  await step(tok);                                   // 154:17 root 是第 0 層
  M[1].glow(GOLD);
  tag('第 0 層', 'ptr', -5.6, 6.6);
  say('本課（也是很多書）：root 是第 0 層', '');
  await step(tok);                                   // 154:24 下面第 1、2、3、4 層
  for (let d = 1; d < 5; d++) { tag('第 ' + d + ' 層', 'ptr', -5.6, 6.6 - d * 1.3); await beat(tok, 250); }
  say('往下是第 1、2、3、4 層', '');
  await step(tok);                                   // 154:31 最高的層數 = 高度 4
  M[16].glow(GOLD); M[16].mood('happy'); await M[16].hop(tok);
  okT('本課：height = 4', -3.6, 0.3);
  say('最深是第 4 層 → 高度 4', '<span class="ok">本課：height = 4</span>');
  await step(tok);                                   // 154:38 不同書用法不太一樣
  for (let d = 0; d < 5; d++) tag('level ' + (d + 1), 'ptr alt', 5.6, 6.6 - d * 1.3);
  note('洪逸／Horowitz：root = level 1 → 五層 depth = 5', 3.4, 0.3);
  say('洪逸課本：root 在 level 1', '同一棵樹 depth = 5；寫題前先看定義');
}]);

// 154:52 延伸：Huffman tree 與 path code
FRAG.push(['treea-lin-huff', '延伸：Huffman tree 與 path code 解碼', async (tok) => {
  cam([0, 4.4, 13.5], [0, 3.6, 0.6]);
  let root = null, cur = null, bt = [], outN = 0;
  const bits = '0110' + '10' + '111';
  async function decode(from, to) {
    let n = root;
    for (let k = from; k < to; k++) {
      bt[k].element.className = 'lab-label ptr alt';
      n = bits[k] === '0' ? n.left : n.right;
      await walkTo(tok, cur, n, 280);
    }
    n.bd.glow(GOLD); n.bd.mood('happy');
    cube(n.label, depthColor(n.depth), SMALL, -4 + outN * 0.9, 0.3, 3.0, 2); outN++;
    await n.bd.hop(tok);
    n.bd.glow(); cur.position.copy(above(root));
  }
  await step(tok);                                   // 154:52 full binary tree 的 vector 表示：二進位
  bub('二進位 ↔ binary tree：老師很喜歡的一段', 0, 7.4);
  say('full binary tree 的 vector 表示', '利用了二進位和 binary tree 的關係');
  await step(tok);                                   // 155:59 寫一個 JPEG decoder
  const jp = prop('file', 4.8, 4.6, 0, 1.3, 'JPEG 照片'); bob(jp, 0.05);
  say('老師修過的課：作業是寫 JPEG decoder', '');
  await step(tok);                                   // 156:15 Huffman tree
  kill(jp);
  root = T('•', T('A'), T('•', T('B'), T('•', T('C'), T('D'))));
  bTree(root, { topY: 6.6, minY: 2.4 }, 0.55, (n) => (n.label === '•' ? '#d8cfc0' : depthColor(n.depth)));
  bEdges(root);
  walkPre(root, (n) => { for (const [c, b] of [[n.left, '0'], [n.right, '1']]) if (c) { const m = n.pos.clone().add(c.pos).multiplyScalar(0.5); const l = tag(b, 'ptr', m.x + (b === '1' ? 0.3 : -0.3), m.y + 0.2); if (b === '0') l.element.style.color = CHILD_C; } });
  say('Huffman tree：資料壓縮用的 binary tree', '示意：A = 0、B = 10、C = 110、D = 111');
  await step(tok);                                   // 156:37 path 就像剛才的 path code
  note('左 = 0、右 = 1：就是剛才的 path code', 4.2, 6.8);
  say('它的 path 就像剛才的 path code', '往左 0、往右 1');
  await step(tok);                                   // 156:50 壓縮的資料
  bt = bits.split('').map((b, k) => tag(b, 'idx', -4 + k * 0.7, 0.9, 1.6));
  tag('壓縮資料', 'ptr', -5.8, 0.9, 1.6); tag('解出', 'ptr', -5.8, 0.3, 3.0);
  say('壓縮後的資料：一串 bit', '要把它解回原來的資料');
  await step(tok);                                   // 156:58 順著 bit 走 path，走到 leaf → A
  cur = pkt('照 bit 走', root.pos.x, root.pos.y + 0.85, 0.3);
  await decode(0, 1);
  say('順著 bit 沿 path 走：0 → 走到 leaf A', '走到 leaf 就 decode 出一個 A');
  await step(tok);                                   // 157:09 走到 leaf 是 C → decode C
  await decode(1, 4);
  say('1、1、0 → 走到 leaf C', 'decode 出 C；再回到 root');
  await step(tok);                                   // 157:37 非常非常多次從 root 走到 leaf
  await decode(4, 6); await decode(6, 9);
  say('一張 JPEG 要從 root 走到 leaf', '非常、非常、非常多次');
}]);

// 158:18 經驗談：MPEG-2 與記憶體配置
FRAG.push(['treea-lin-cache', '經驗談：node 四散 vs 壓進 vector', async (tok) => {
  cam([0, 7.0, 11.5], [0, 1.2, 0.6]);
  const X = (i) => -6.0 + i * 0.86;
  await step(tok);                                   // 158:18 MPEG-2
  const mon = prop('monitor', 4.6, 2.2, -2.6, 1.2, 'MPEG-2 影片');
  say('期末作業：MPEG-2 decoder', '當年 Video CD 的影像格式');
  await step(tok);                                   // 158:50 每秒要做 30 次 JPEG decoding
  const fps = tag('1 秒 30 張 JPEG', 'pkt', 4.6, 4.6, -2.6);
  say('影像部分 ≈ 每秒做 30 次 JPEG 解碼', '做不到，影片就會卡');
  await step(tok);                                   // 159:37 node 四散在各方
  tag('記憶體：node 四散', 'ptr', -4.6, 1.4, -2.2);
  for (let i = 0; i < 15; i++) K.zone('', X(i), 0, -1.5, 0.78, 0.8, '#e9dcc4');
  const scat = [6, 1, 12, 0, 9, 4, 13];
  for (let i = 1; i <= 7; i++) cube(i, depthColor(hdepth(i)), [0.6, 0.5, 0.6], X(scat[i - 1]), 0.3, -1.5, 2);
  for (const i of [1, 2, 3]) for (const c of [2 * i, 2 * i + 1]) arc2(V(X(scat[i - 1]), 0.6, -1.5), V(X(scat[c - 1]), 0.6, -1.5), '#b04040', 0.5 + 0.12 * Math.abs(scat[c - 1] - scat[i - 1]));
  say('tree 的 node 四散在記憶體各處', '用指標跳來跳去');
  await step(tok);                                   // 159:46 沒辦法用到快取
  const wh = prop('warehouse', -5.4, 2.6, -2.6, 0.8, '很遠的倉庫'); bob(wh, 0.04);
  noT('用不到快取（cache）', -2.0, 2.6, -2.2);
  say('記憶體四散：用不到快取', '像一直跑去很遠的倉庫搬東西');
  await step(tok);                                   // 160:11 像 full binary tree 壓在 vector 裡
  tag('vector：位置相近', 'ptr alt', -4.6, 1.4, 1.2);
  for (let i = 1; i <= 7; i++) { K.zone('', X(i + 3), 0, 2.4, 0.78, 0.8, '#e9dcc4'); cube(i, depthColor(hdepth(i)), [0.6, 0.5, 0.6], X(i + 3), 0.3, 2.4, 2); }
  say('像把 full binary tree 壓進 vector', 'node 放在記憶體相近的位置');
  await step(tok);                                   // 160:20 找小孩：×2、×2+1 簡單計算
  for (const i of [1, 2, 3]) for (const c of [2 * i, 2 * i + 1]) { arc2(V(X(i + 3), 0.6, 2.4), V(X(c + 3), 0.6, 2.4), CHILD_C, 0.4 + 0.1 * (c - i)); await beat(tok, 200); }
  say('找小孩只要 ×2、×2+1', '簡單的計算');
  await step(tok);                                   // 160:33 不然 1 秒只能解 1 張
  fps.element.textContent = '寫不好：1 秒只有 1 張 😵';
  say('不然：人家 1 秒 30 張，你 1 秒 1 張', '影片嚴重延遲（老師的痛苦經驗）');
  await step(tok);                                   // 162:46 full binary tree、vector、path code
  fps.element.textContent = '1 秒 30 張 ✓';
  okT('full binary tree × vector × path code：未來學 Huffman、JPEG 用得到', 0, 4.4, -2.6);
  say('所以補充 full binary tree 和 vector、path code', '<span class="ok">未來學 Huffman tree、JPEG 可能用到</span>');
  void mon;
}]);

// ── Expression tree：×(+(3,5), −(2, +(7,4))) ──
const EXPR = '×(+(3,5),−(2,+(7,4)))';
const isOp = (n) => !!n.left;

// 164:27 Expression tree：運算子、運算元
FRAG.push(['treea-lin-expr', 'Expression tree：internal 放運算子、leaf 放數字', async (tok) => {
  cam([0, 4.4, 13.5], [0, 3.4, 0.6]);
  let root = null, all = [];
  await step(tok);                                   // 164:27 expression tree 的世界
  const sb = prop('parcel', -5.2, 4.6, 0, 0.9, '作業三：stack 解析運算式'); bob(sb, 0.05);
  say('把今天的 tree 和作業三連起來', '作業三：用 stack 做 expression parsing');
  await step(tok);                                   // 164:57 長得像這樣的 tree
  root = bTree(EXPR, { topY: 6.4, minY: 2.6 }, 0.6, (n) => (isOp(n) ? '#f2c46d' : '#2fc092'));
  all = levelorder(root);
  await dropIn(tok, all.map((n) => n.bd), 700);
  bEdges(root);
  say('它們的關聯：一棵長這樣的 tree', '');
  await step(tok);                                   // 165:07 root 和 internal node 放運算符號
  all.filter(isOp).forEach((n) => n.bd.glow(GOLD));
  say('root 和 internal node 上放運算子', '×、+、−、+');
  await step(tok);                                   // 165:27 leaf 放要計算的數字
  all.filter((n) => !isOp(n)).forEach((n) => { n.bd.glow(GREEN); n.bd.mood('happy'); });
  say('leaf node 上放要計算的數字', '3、5、2、7、4');
  await step(tok);                                   // 165:41 叫做 expression tree
  okT('expression tree', 0, 7.4);
  all.forEach((n) => n.bd.glow());
  say('這樣的 tree 叫 expression tree', '');
  await step(tok);                                   // 165:54 binary 運算子 → binary tree
  note('都是 binary 運算子（吃兩個數）→ binary tree', 4.2, 1.6);
  say('這裡都是 binary 運算子', '每個運算子吃兩個數 → binary tree');
  await step(tok);                                   // 166:14 unary 就不一定有兩個連結
  note('unary（例如負號 −x）：只有一個小孩', 4.2, 1.0);
  say('有 unary 運算子時', '那個 node 只有一個小孩');
  await step(tok);                                   // 166:28 多個 argument 的 function call → general tree
  note('function call f(a, b, c)：三個小孩 → general tree', 4.2, 0.4);
  say('有多個 argument 的 function call', '就可能變成 general tree');
  await step(tok);                                   // 166:58 先算完左右 subtree，再做 root
  ghost('#4b9ee2', root.left.pos.x, (root.left.pos.y + root.left.left.pos.y) / 2, 2.0, 2.2);
  ghost(ORANGE, root.right.pos.x + 0.6, (root.right.pos.y + root.right.right.left.pos.y) / 2, 3.6, 3.4);
  root.bd.glow(GOLD);
  say('意思：先把左、右 subtree 算完', '再做 root 的運算（這裡是乘法）');
  await step(tok);                                   // 167:10 3 + 5 算完
  root.bd.glow();
  root.left.bd.set('8'); root.left.bd.mood('happy'); await root.left.bd.hop(tok);
  tag('3 + 5 = 8', 'ptr alt', root.left.pos.x - 1.0, root.left.pos.y + 0.5);
  say('左 subtree：3 + 5 = 8', '');
  await step(tok);                                   // 167:18 右邊：2 算完就是 2
  const two = root.right.left;
  two.bd.glow(GREEN); await two.bd.hop(tok);
  say('右 subtree 先算它的左邊：2', '2 是 leaf，算完就是 2');
  await step(tok);                                   // 167:31 7 + 4，再做減法
  const p = root.right.right;
  p.bd.set('11'); p.bd.mood('happy'); await p.bd.hop(tok);
  root.right.bd.set('−9'); root.right.bd.mood('wow');
  tag('7 + 4 = 11；2 − 11 = −9', 'ptr alt', root.right.pos.x + 1.6, root.right.pos.y + 0.5);
  note('補充：最後 root：8 × (−9) = −72', 0, 1.4);
  say('7 + 4 = 11，再做減法：2 − 11 = −9', '（補充）最後做 root：8 × (−9) = −72');
}]);

// 167:39 Subtree = 括號
FRAG.push(['treea-lin-paren', 'Subtree = 括號：從 expression tree 寫回算式', async (tok) => {
  cam([0, 4.4, 13.5], [0, 3.4, 0.6]);
  const root = bTree(EXPR, { topY: 6.4, minY: 2.6 }, 0.6, (n) => (isOp(n) ? '#f2c46d' : '#2fc092'));
  bEdges(root);
  const ino = inorder(root);
  const box = (n) => { const s = inorder(n), d = postorder(n); const xs = s.map((k) => k.pos.x), ys = d.map((k) => k.pos.y); return ghost(KIDC, (Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, Math.max(...xs) - Math.min(...xs) + 1.1, Math.max(...ys) - Math.min(...ys) + 1.0); };
  const paren = (n, c = 0) => { const s = inorder(n); tag('(', 'ptr', s[0].pos.x - 0.5, 0.35, 1.6); tag(')', 'ptr', s[s.length - 1].pos.x + 0.5 + c * 0.35, 0.35, 1.6); };
  let toks = [];
  await step(tok);                                   // 167:39 什麼先算、什麼後算
  note('subtree 裡的先算，算完才算 root', 0, 7.4);
  say('這棵 tree 藏著：什麼先算、什麼後算', 'subtree 先算，root 後算');
  await step(tok);                                   // 167:56 把對應的 expression 寫下來
  toks = ino.map((n) => cube(n.label, isOp(n) ? '#f2c46d' : '#2fc092', SMALL, n.pos.x, 0.3, 1.6, 2));
  say('把它表示的算式寫下來', '照位置讀：3 + 5 × 2 − 7 + 4（還沒加括號）');
  await step(tok);                                   // 168:04 3 + 5 要先算 → 加括號
  const g1 = box(root.left); paren(root.left);
  say('左 subtree：3 + 5 要先算', '加括號：(3 + 5)');
  await step(tok);                                   // 168:15 右邊：2 − 某棵 subtree
  kill(g1);
  const g2 = box(root.right);
  root.right.bd.glow(GOLD);
  say('右 subtree：2 − 某棵 subtree', '');
  await step(tok);                                   // 168:20 那棵 subtree：7 + 4 → 加括號
  kill(g2); root.right.bd.glow();
  const g3 = box(root.right.right); paren(root.right.right);
  say('那棵 subtree 是 7 + 4', '加括號：(7 + 4)');
  await step(tok);                                   // 168:30 再加個括號，然後做乘法
  kill(g3);
  paren(root.right, 1);
  root.bd.glow(GOLD); root.bd.mood('happy');
  say('右邊整個再加括號，然後做乘號', '(3 + 5) × (2 − (7 + 4))');
  await step(tok);                                   // 168:50 subtree 加括號、root 放中間、遞迴
  root.bd.glow();
  bub('subtree 加括號 → root 放中間 → 遞迴下去', 0, 7.4);
  say('規則：subtree 加括號、root 放中間', '然後遞迴地做同一件事');
  await step(tok);                                   // 169:07 leaf 就不加括號了
  root.right.left.bd.glow(GREEN); await root.right.left.bd.hop(tok);
  say('照理 2 也是 subtree，但它是 leaf', 'leaf 就不加括號了');
  await step(tok);                                   // 169:56 下次：evaluation、印 postfix／infix
  root.right.left.bd.glow();
  note('下次：在 expression tree 上做 evaluation、印出 postfix／infix', 0, 1.2);
  say('下次：在 expression tree 上跑演算法', 'evaluation、印出 postfix／infix');
  await step(tok);                                   // 170:39 internal 放 operator
  levelorder(root).filter(isOp).forEach((n) => n.bd.glow(GOLD));
  tag('internal node → operator', 'ptr alt', -5.0, 6.9);
  say('總結：internal node 放 operator', '');
  await step(tok);                                   // 170:46 external 放 operand
  levelorder(root).filter((n) => !isOp(n)).forEach((n) => n.bd.glow(GREEN));
  tag('external node → operand', 'ptr', -5.0, 6.3);
  say('external node（leaf）放 operand', '');
  await step(tok);                                   // 170:58 subtree 放 parentheses
  tag('subtree → parentheses', 'ptr alt', -5.0, 5.7);
  okT('(3 + 5) × (2 − (7 + 4))', 0, -0.4, 1.6);
  say('subtree 代表 parentheses', '<span class="ok">tree 合理地表示了計算的意念</span>');
  void toks;
}]);
  }

  // ═══ treeb.js ═══
  {
// ─── 交大彭文志 Lec12–14 Trees（VwQeypxlevE、UO0B1SQOAgk、pPMMUa8guTE）— cued scenes ───
// 每個 await step(tok) 等影片講到那一句才動；step 之間只放短動作（≤ 2.5 s），講完就停住。
// 小幫手「小樹」（buddy）在角落跟著反應；樹的節點沿用本章的方塊與連線。
const P = kit(ctx);
const { step, buddy, remove } = P;
const anim = P.anim;
const BLU = '#4b9ee2', ORG = '#dd8238', PUR = '#9b7ef4', GRN = '#2fc092', SAND = '#c9b48e', DIM = '#d8cfc0', TEAL = '#31aab0', GRAYB = '#8a7a62';
const HT = 'A(B(E(K,L),F),C(G),D(H,I,J))';          // 課本 Fig 5.2 的一般樹
const HT_BIN = 'A(B(E(K(,L),F),C(G,D(H(,I(,J))))))'; // 它的 LCRS → binary tree
const CT = 'A(B(D(H,I),E),C(F,G))';                  // 講師的 complete binary tree
const go = (tok, ms = 200) => beat(tok, ms);
const topP = (p, h = 0.3) => V(p.x, p.y + h, p.z + 0.02), botP = (p, h = 0.3) => V(p.x, p.y - h, p.z + 0.02);
const hide = (l, on) => { l.element.style.visibility = on ? '' : 'hidden'; };
const flyB = (b) => b && lab.flyAway(b, V((Math.random() - 0.5) * 6, 8, 4));
const hiEdge = (a, b, color = '#c08a1f') => seg(botP(a.pos), topP(b.pos), color);
const padL = (lines) => { const w = Math.max(...lines.map((s) => s.length)); return lines.map((s) => s.padEnd(w, ' ')); };
const OUT_SZ = [0.5, 0.42, 0.5];
function emit(n, pos, size = OUT_SZ) {
  const b = lab.addBody(block(n.label, size, depthColor(n.depth || 0)));
  b.obj.position.copy(n.pos); lab.springTo(b, pos.clone()); return b;
}
const allOff = (root) => levelorder(root).forEach((n) => glow(n, OFF));
// 小幫手：一個會呼吸、眨眼的小方塊，旁邊冒出對話泡泡
function pal(x = 6.2, z = 2.6, color = '#f6c35b', s = 0.55) { const b = buddy('小樹', '', color, x, 0, z, s); b.x = x; b.z = z; b.s = s; return b; }
function talk(b, text, mood) { if (!b) return; if (b.bub) remove(b.bub); b.bub = text ? tag(text, 'say', b.x, b.s + 1.25, b.z) : null; if (mood) b.mood(mood); }
function stage(pos, look, at) { fresh(); lab.frameCamera(pos, look); return at === false ? null : pal(...(at || [])); }
// 一般樹一個一個掉下來（ms × 節點數要小）
async function dropG(tok, src, o, ms = 120, opt = {}) {
  const root = typeof src === 'string' ? parseG(src) : src;
  layoutG(root, o);
  const size = opt.size || ((n) => [W(n.label), 0.6, 0.8]);
  edgeLines(() => { const out = []; for (const n of gAll(root)) for (const k of n.kids) if (n.body && k.body) out.push([n.body.obj.position, k.body.obj.position]); return out; });
  const q = [root];
  while (q.length) {
    const n = q.shift();
    const b = lab.addBody(block(n.label, size(n), opt.color ? opt.color(n) : depthColor(n.depth)));
    b.obj.position.copy(n.pos).add(V(0, 3, 0)); lab.dropTo(b, n.pos.clone()); n.body = b;
    q.push(...n.kids);
    if (ms) await beat(tok, ms);
  }
  return root;
}
const HP = (i) => heapPos(i, 6.6, 1.5, 11.6);
function slots(n, posFn = HP, withIdx = false) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(...NODE), new THREE.MeshBasicMaterial({ color: SAND, wireframe: true, transparent: true, opacity: 0.35 }));
    g.position.copy(posFn(i)); lab.world.add(g); out.push(g);
    if (withIdx) { const p = posFn(i); tag(String(i), 'idx', p.x, p.y - 0.55); }
  }
  return out;
}
function idxCube(v, i, color, pos) {
  const b = lab.addBody(block(v, NODE, color));
  b.obj.position.copy(pos); b.target.copy(pos);
  const il = lab.label(String(i), 'idx'); il.position.set(0.6, -0.32, 0); b.obj.add(il);
  return b;
}
function rowOf(labels, cx, z, y = 0.3) {
  return labels.map((c, k) => cube(c, SAND, SMALL, cx - (labels.length - 1) * 0.4 + k * 0.8, y, z, 2));
}

// ═════════════════ VwQeypxlevE：Lec12 Trees (1/6) ═════════════════

// 1:06 Tree 的遞迴定義
FRAG.push(['treeb-def', 'Tree 的遞迴定義：root + T1…Tk', async (tok) => {
  let g = stage([0, 5, 13.5], [0, 3.6, 0]);
  await step(tok);                                   // 65.8 tree 的架構：不同的人種
  const fam = await dropG(tok, '祖先(拉丁人(義大利人,法國人),日耳曼人(德國人,荷蘭人),斯拉夫人)', { width: 10.4, topY: 6.4, step: 1.9 }, 140);
  say('Tree 長得像族譜（課本的示意圖）', '同一個祖先，往下分出不同民族');
  talk(g, '像家族樹耶！', 'wow');
  await step(tok);                                   // 88.7 祖先，下面有 child
  gLit(fam, GOLD); fam.kids.forEach((k) => gLit(k, GREEN));
  say('上面是祖先，下面是它的 child', 'child 還會再往下長');
  talk(g, '上面祖先、下面孩子', 'happy');
  await step(tok);                                   // 95.8 最下面是 leaf node
  gAll(fam).forEach((n) => gLit(n));
  gAll(fam).filter((n) => !n.kids.length).forEach((n) => gLit(n, GOLD));
  say('最底下沒有 child 的叫 leaf node', 'leaf（葉子）：不再往下長');
  talk(g, '最底下＝葉子 🍃');
  await step(tok);                                   // 111.7 a collection of nodes
  gAll(fam).forEach((n) => flyB(n.body));
  await go(tok, 600);
  g = stage([0, 5, 13.5], [0, 3.6, 0]);
  const dots = [[-3, 5.6], [-1.2, 6.4], [0.8, 5.2], [2.6, 6.2], [-2.2, 3.8], [0.2, 3.4], [2.4, 4.0], [4.0, 4.9]].map(([x, y]) => cube('', BLU, [0.6, 0.5, 0.6], x, y, 0, 2));
  say('正式定義：a collection of nodes', 'tree = 一群 node 的集合');
  talk(g, '一堆 node');
  await step(tok);                                   // 115.8 特殊的 node 叫 root
  dots.forEach((b) => flyB(b));
  const r = cube('root', GRN, [1.2, 0.6, 0.8], 0, 6.4, 0, 3);
  say('其中有一個特殊的 node：root', 'tree 一定要有 root（最原始的祖先）');
  talk(g, '最上面的老祖宗', 'happy');
  await step(tok);                                   // 128.8 root 下面有很多 subtree：T1…Tk
  const subs = [['T1', -4.4, 2], ['T2', 0, 1], ['Tk', 4.4, 3]].map(([nm, cx, k], j) => {
    ghost([BLU, PUR, ORG][j], cx, 3.3, 3.4, 2.9);
    tag(nm, 'ptr', cx, 5.0);
    const sr = cube('r' + (j === 2 ? 'k' : j + 1), BLU, [0.8, 0.5, 0.7], cx, 4.15, 0, 2);
    const kids = [];
    for (let i = 0; i < k; i++) {
      const x = cx + (i - (k - 1) / 2) * 1.05;
      kids.push(cube('', PUR, [0.6, 0.45, 0.6], x, 2.55, 0, 2));
      seg(V(cx, 3.9, 0), V(x, 2.78, 0), '#7a6a52');
    }
    arrow(V(0, 6.1, 0), V(cx, 4.45, 0));
    return { sr, kids };
  });
  tag('…', 'ptr', 2.2, 3.3);
  say('root 底下接著 subtree：T1、T2 … Tk', '每一塊都是一棵小 tree');
  await step(tok);                                   // 141.8 每棵 subtree 也有自己的祖先 → recursive
  subs.forEach((s) => lit(s.sr, GOLD));
  say('每棵 subtree 也有自己的 root（祖先）', '定義裡又用到 tree → recursive（遞迴）');
  talk(g, '樹裡面還有樹！', 'wow');
  await g.hop(tok);
  await step(tok);                                   // 149.0 分枝數可以自己定義
  subs.forEach((s) => { lit(s.sr); s.kids.forEach((b) => lit(b, GOLD)); });
  lit(r, GOLD);
  tag('分枝數 k：可以自己定（k = 2 → binary tree）', 'ptr alt', 0, 1.4, 0.4);
  say('一個 node 可以 link 出去幾個 child？', '可以依需求定義');
  talk(g, '要分幾枝自己決定', 'happy');
}]);

// 2:48 Level、高度與 degree
FRAG.push(['treeb-levels', 'Level、高度與 node 的 degree', async (tok) => {
  const g = stage([0, 5, 13.5], [0, 3.8, 0]);
  await step(tok);                                   // 167.6 另一個 tree 的例子
  const root = await dropG(tok, HT, { width: 10, topY: 6.6, step: 1.6 }, 110);
  const N = (l) => gFind(root, l), all = gAll(root);
  say('換一棵課本的例子樹', 'A(B(E(K,L),F), C(G), D(H,I,J))');
  talk(g, '換一棵來看');
  await step(tok);                                   // 181.8 level 1、2、3、4
  for (let d = 0; d < 4; d++) {
    tag('level ' + (d + 1), 'idx', -6.4, 6.6 - d * 1.6);
    all.filter((n) => n.depth === d).forEach((n) => gLit(n, d % 2 ? GOLD : GREEN));
    await go(tok, 380);
  }
  say('最上面 root 是 level 1', '往下依序 level 2、3、4');
  await step(tok);                                   // 191.8 高度 = 最大 level
  all.forEach((n) => gLit(n));
  tag('height = 4', 'ptr alt', -5.4, 7.6);
  say('tree 的高度（深度）= 最大的 level', '這棵樹高度 = 4');
  talk(g, '高度 4！', 'happy');
  await step(tok);                                   // 215.5 degree
  say('還有一個定義：degree', 'degree = node 的 pointer 個數');
  talk(g, 'degree 是什麼？', 'wow');
  await step(tok);                                   // 227.2 以 A 為例
  const A = N('A'), C = N('C');
  gLit(A, GOLD);
  say('先看第一個 node：A', '數它往下指出去幾條');
  await step(tok);                                   // 234.8 1、2、3 → degree(A) = 3
  const tmp = [];
  for (let k = 0; k < A.kids.length; k++) {
    const c = A.kids[k];
    tmp.push(hiEdge(A, c), tag(String(k + 1), 'ptr alt', (A.pos.x + c.pos.x) / 2, (A.pos.y + c.pos.y) / 2 + 0.25, 0.3));
    await go(tok, 320);
  }
  tmp.push(tag('degree(A) = 3', 'ptr alt', A.pos.x + 2.2, A.pos.y + 0.3));
  say('A 指出去 1、2、3 條', 'degree(A) = 3');
  talk(g, 'A 有 3 個孩子', 'happy');
  await step(tok);                                   // 244.8 C 的 degree？
  tmp.forEach(kill); gLit(A); gLit(C, GOLD);
  say('那 C 的 degree 是多少？', 'C 身上連著兩條邊');
  talk(g, '兩條邊…是 2 嗎？', 'wow');
  await step(tok);                                   // 256.8 別人指到他的不算
  hiEdge(A, C, '#d04040');
  tag('✗ 別人指進來，不算', 'bad', (A.pos.x + C.pos.x) / 2 + 1.2, (A.pos.y + C.pos.y) / 2);
  say('別人指到它的那條不算', '只算 point out（指出去）的');
  await step(tok);                                   // 266.8 只往下指到 G → 1
  hiEdge(C, N('G'));
  tag('degree(C) = 1', 'ptr alt', C.pos.x + 1.6, C.pos.y - 0.6);
  say('C 只往下指到 G', 'degree(C) = 1');
  talk(g, '原來是 1！', 'happy');
  await step(tok);                                   // 274.8 第六章 graph：in / out degree
  tag('graph：in-degree ／ out-degree（第 6 章）', 'note', 0.6, 0.6, 1.2);
  say('第 6 章的 graph 也有 degree', '分成 in-degree、out-degree');
  await step(tok);                                   // 290.8 tree 是特殊的 graph
  tag('tree = 特殊的 graph', 'good', 0.6, 1.4, 1.2);
  say('tree 其實是一種特殊的 graph', 'tree 裡的 degree 只算指出去的');
  talk(g, '記住：只算往下', 'happy');
}]);

// 5:07 parent 與 child
FRAG.push(['treeb-parent', 'Parent 與 child', async (tok) => {
  const g = stage([0, 5, 13.5], [0, 3.8, 0]);
  const root = await dropG(tok, HT, { width: 10, topY: 6.6, step: 1.6 }, 0);
  const N = (l) => gFind(root, l);
  await step(tok);                                   // 306.8 A 是最原始的祖先
  const A = N('A'), B = N('B');
  gLit(A, GOLD);
  tag('root：最原始的祖先', 'ptr alt', A.pos.x, A.pos.y + 0.8);
  say('A 是整棵 tree 最原始的祖先', 'root = A');
  talk(g, 'A 是老祖宗');
  await step(tok);                                   // 318.8 subtree 拉出來，祖先是 B → parent
  gLit(A);
  const sub = ['B', 'E', 'F', 'K', 'L'].map(N);
  sub.forEach((n) => lab.springTo(n.body, n.pos.clone().setZ(1.6)));
  const xs = sub.map((n) => n.pos.x);
  ghost(BLU, (Math.min(...xs) + Math.max(...xs)) / 2, 3.4, Math.max(...xs) - Math.min(...xs) + 1.4, 4.0, 1.6);
  tag('B 的 subtree', 'ptr', Math.min(...xs) - 0.2, 5.8, 1.6);
  gLit(B, GOLD);
  say('把 B 這棵 subtree 拉出來看', '它的祖先是 B → B 是 parent');
  talk(g, '拉出來看', 'wow');
  await step(tok);                                   // 326.8 下面連出去的是 child
  ['E', 'F'].forEach((l) => { gLit(N(l), GREEN); tag('child', 'ptr', N(l).pos.x, N(l).pos.y - 0.6, 1.6); });
  say('B 直接 link 出去的是它的 child', 'child(B) = E、F');
  await step(tok);                                   // 331.8 老師：E F K L 都是 child（更正）
  ['K', 'L'].forEach((l) => gLit(N(l), RED));
  tag('K、L 是 E 的 child（B 的孫輩）', 'note', N('E').pos.x, N('K').pos.y - 0.75, 1.6);
  say('老師說 K、L 也是 child → 更正', 'K、L 是 E 的 child，對 B 是 descendant');
  talk(g, '小心：孫子不是孩子', 'wow');
}]);

// 12:04 sibling、path、ancestors
FRAG.push(['treeb-sibling', 'Sibling 與 ancestors', async (tok) => {
  const g = stage([0, 5, 13.5], [0, 3.8, 0]);
  const root = await dropG(tok, HT, { width: 10, topY: 6.6, step: 1.6 }, 0);
  const N = (l) => gFind(root, l);
  await step(tok);                                   // 723.8 同一個 level
  const sibs = ['B', 'C', 'D'].map(N);
  sibs.forEach((n) => gLit(n, GOLD));
  say('先看同一個 level 的 B、C、D', '它們的 parent 都是 A');
  await step(tok);                                   // 730.8 相同父母 → sibling
  sibs.forEach((n) => gLit(n, GREEN));
  tag('sibling', 'ptr alt', 6.0, sibs[0].pos.y);
  ['K', 'L'].forEach((l) => gLit(N(l), GREEN));
  tag('sibling', 'ptr alt', N('L').pos.x + 1.0, N('L').pos.y);
  say('同一個 parent 的 node 互為 sibling', '兄弟姊妹：B、C、D；K、L 也是');
  talk(g, '同一對爸媽', 'happy');
  await step(tok);                                   // 737.8 某一個 node 的祖先們
  [...sibs, N('K'), N('L')].forEach((n) => gLit(n));
  gLit(N('K'), GOLD);
  say('那 K 的祖先們是誰？', '');
  talk(g, 'K 的祖先？', 'wow');
  await step(tok);                                   // 741.8 從 root 往那個 node traverse → path
  const cur = makeCursor();
  const path = ['A', 'B', 'E', 'K'].map(N);
  for (let i = 0; i < path.length; i++) { cursorTo(cur, path[i].pos); if (i) hiEdge(path[i - 1], path[i]); await go(tok, 450); }
  say('從 root 往 K 走：形成一條 path', 'A → B → E → K');
  await step(tok);                                   // 755.8 經過的 node 都是祖先
  path.slice(0, 3).forEach((n) => { gLit(n, GOLD); tag('ancestor', 'ptr alt', n.pos.x + 1.25, n.pos.y + 0.1); });
  say('path 上經過的 node 都是 K 的 ancestors', 'ancestors(K) = A、B、E');
  talk(g, '祖先一路排上去', 'happy');
}]);

// 12:45 list 表示法
FRAG.push(['treeb-list', 'Tree 的 list 表示法', async (tok) => {
  let g = stage([0, 5, 13.5], [0, 3.8, 0.4]);
  let root, N, str;
  const gs = [];
  const box = (ls, color, pad = 0.55) => {
    const ns = ls.map(N), xs = ns.map((n) => n.pos.x), ys = ns.map((n) => n.pos.y);
    return ghost(color, (Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, Math.max(...xs) - Math.min(...xs) + 2 * pad + 0.4, Math.max(...ys) - Math.min(...ys) + 1.0);
  };
  await step(tok);                                   // 764.8 這棵 tree 怎麼表示？
  root = await dropG(tok, HT, { width: 10, topY: 6.8, step: 1.4 }, 100);
  N = (l) => gFind(root, l);
  say('有這棵 tree，要怎麼表示它？', '方法不只一種');
  talk(g, '怎麼存起來？', 'wow');
  await step(tok);                                   // 784.8 可以用 linked list
  str = tag('( … )', '', 0, 0.9, 1.2); Object.assign(str.element.style, MONO, { fontSize: '14px' });
  say('可以用 linked list 來表示', '括號代表從屬關係');
  await step(tok);                                   // 805.8 K、L 括在一起
  gs.push(box(['K', 'L'], BLU));
  str.element.textContent = 'E(K,L)';
  say('K、L 括在一起：共同的 parent 是 E', '(K,L) 前面接 E');
  await step(tok);                                   // 829.8 E、F 括在一起：祖先是 B
  gs.push(box(['E', 'F', 'K', 'L'], PUR));
  str.element.textContent = 'B(E(K,L),F)';
  say('E、F 括在一起：parent 是 B', '(E(K,L),F) 前面接 B');
  await step(tok);                                   // 843.6 依此類推
  gs.push(box(['G'], ORG), box(['H', 'I', 'J'], ORG));
  str.element.textContent = '(A(B(E(K,L),F),C(G),D(H,I,J)))';
  gLit(N('A'), GOLD);
  say('依此類推：C(G)、D(H,I,J)', '整棵 tree 寫成一個 list');
  talk(g, '一串括號就是一棵樹', 'happy');
  await step(tok);                                   // 852.8 長成這樣：A 下面有一個 B
  gAll(root).forEach((n) => flyB(n.body)); gs.forEach(kill);
  await go(tok, 500);
  g = stage([0, 5, 13.5], [0, 3.8, 0.4]);
  const s2 = tag('(A(B(E(K,L),F),C(G),D(H,I,J)))', '', 0, 7.5); Object.assign(s2.element.style, MONO, { fontSize: '13px' });
  const L = {};
  const cell = (k, v, x, y, color) => { L[k] = cube(v, color, [0.8, 0.6, 0.8], x, y, 0, 2.5); return L[k]; };
  const nxt = (a, b) => arrow(V(L[a].target.x + 0.42, L[a].target.y, 0), V(L[b].target.x - 0.42, L[b].target.y, 0));
  const dn = (a, b) => arrow(V(L[a].target.x, L[a].target.y - 0.3, 0), V(L[b].target.x, L[b].target.y + 0.32, 0), BLU);
  const rows = [
    [[['A', 'A', -5.5, 6.2, GRN], ['a1', '•', -4.0, 6.2, SAND], ['a2', '•', -2.5, 6.2, SAND], ['a3', '•', -1.0, 6.2, SAND]], [['A', 'a1'], ['a1', 'a2'], ['a2', 'a3']], []],
    [[['B', 'B', -4.0, 4.5, BLU], ['b1', '•', -2.5, 4.5, SAND], ['F', 'F', -1.0, 4.5, PUR]], [['B', 'b1'], ['b1', 'F']], [['a1', 'B']]],
    [[['E', 'E', -2.5, 2.8, PUR], ['K', 'K', -1.0, 2.8, '#e55a9b'], ['L', 'L', 0.5, 2.8, '#e55a9b']], [['E', 'K'], ['K', 'L']], [['b1', 'E']]],
    [[['C', 'C', 1.5, 4.5, BLU], ['G', 'G', 3.0, 4.5, PUR], ['D', 'D', 1.9, 2.8, BLU], ['H', 'H', 3.3, 2.8, PUR], ['I', 'I', 4.7, 2.8, PUR], ['J', 'J', 6.1, 2.8, PUR]], [['C', 'G'], ['D', 'H'], ['H', 'I'], ['I', 'J']], [['a2', 'C'], ['a3', 'D']]],
  ];
  const doRow = async ([cs, ns, ds]) => { for (const [k, v, x, y, c] of cs) { cell(k, v, x, y, c); await go(tok, 160); } ns.forEach(([a, b]) => nxt(a, b)); ds.forEach(([a, b]) => dn(a, b)); };
  await doRow(rows[0]);
  say('A 的 list：A 後面接三個分支', '每個 • 指向一條子 list');
  await step(tok);                                   // 862.8 B 的分支：E、F
  await doRow(rows[1]);
  say('B 有兩個分支：一個指向 E，一個是 F', 'B → •(E…) → F');
  await step(tok);                                   // 872.8 E 下面又有 K、L
  await doRow(rows[2]);
  say('E 下面又有它的子孫 K、L', 'E → K → L');
  talk(g, '一層一層往下串', 'happy');
  await step(tok);                                   // 879.8 A 三個分支：每個都是一條 linked list
  await doRow(rows[3]);
  say('A 有三個分支，每條都是 linked list', 'C(G)、D(H,I,J)');
  await step(tok);                                   // 901.6 tree 也可以用 linked list 表示
  tag('tree 不只一種長相：linked list 也能表示', 'note', 1.0, 1.2, 1.2);
  say('不要以為 tree 只能長成樹的樣子', '學過的 linked list 也能表示 tree');
  talk(g, '換個存法而已', 'wow');
  await step(tok);                                   // 917.8 看你怎麼 implement
  tag('tree = 高層次的 data structure', 'good', 1.0, 0.4, 1.2);
  say('tree 是較高層次的 data structure', '看你怎麼去 implement 它');
  talk(g, '概念 vs. 實作', 'happy');
}]);

// 15:26 k-ary tree 的 null pointer
FRAG.push(['treeb-kary', 'k-ary tree：固定 k 個 pointer 很浪費', async (tok) => {
  let g = stage([0, 5, 13.5], [0, 3.6, 0]);
  await step(tok);                                   // 925.6 k-ary tree
  tag('k-ary tree', 'ptr alt', 0, 7.2);
  const nd = cube('node', GRN, [1.2, 0.7, 0.9], 0, 6.0, 0, 2.5);
  say('假設有一棵 k-ary tree', '什麼叫 k-ary？');
  talk(g, 'k-ary 是什麼？', 'wow');
  await step(tok);                                   // 935.8 每個 node 可以指到 k 個 node
  const kids = [];
  for (let j = 0; j < 5; j++) { const x = -3 + j * 1.5; kids.push(cube(j === 3 ? '…' : '', BLU, [0.6, 0.5, 0.6], x, 4.2, 0, 2)); arrow(V(0, 5.65, 0), V(x, 4.5, 0)); await go(tok, 150); }
  say('每個 node 最多可以指到 k 個 node', '也就是 degree ≤ k');
  await step(tok);                                   // 945.8 n 個 node，用幾個 pointer？
  tag('n 個 node → 共用多少 pointer？', 'note', 0, 2.8);
  say('整棵 tree 有 n 個 node', '問：一共會用多少個 pointer？');
  await step(tok);                                   // 960.1 每個 node：data + k 個 pointer
  flyB(nd); kids.forEach(flyB);
  await go(tok, 400);
  g = stage([0, 5, 13.5], [0, 3.6, 0]);
  const labs = ['data', '1', '2', '3', '4', '5', '…', 'k'];
  let x = -4.4;
  const cs = labs.map((v, i) => { const w = i ? 0.8 : 1.6; const b = cube(v, i ? BLU : GRN, [w, 0.8, 0.9], x + w / 2, 4.2, 0, 2.5); x += w + 0.08; return b; });
  tag('k-ary tree 的 node', 'ptr', 0, 5.4);
  cs.slice(1).forEach((b) => lit(b, GOLD));
  say('每個 node：data + k 個 pointer', '不管真的有幾個 child，欄位數固定');
  await step(tok);                                   // 979.8 總共 n × k 個 pointer
  cs.forEach(flyB);
  await go(tok, 400);
  g = stage([0, 5, 13.5], [0, 3.6, 0]);
  const root = await dropG(tok, HT, { width: 10, topY: 6.6, step: 1.6 }, 60);
  const sl = new Map();
  for (const n of gAll(root)) sl.set(n, [0, 1, 2].map((j) => cube('', DIM, [0.22, 0.16, 0.3], n.pos.x + (j - 1) * 0.27, n.pos.y - 0.48, 0)));
  const cnt = tag('pointer 共 n·k = 12 × 3 = 36', 'ptr alt', 4.6, 7.5);
  say('以課本樹示意：n = 12、k = 3', '總 pointer 數 = n·k = 36');
  await step(tok);                                   // 990.8 除了 root 沒人指到它
  gLit(root, GOLD);
  tag('沒人指到 root', 'note', root.pos.x + 1.8, root.pos.y + 0.4);
  say('除了 root 以外……', 'root 沒有人指到它');
  await step(tok);                                   // 1000.9 其他 node 恰被一個指到 → n − 1
  let used = 0;
  for (const n of gAll(root)) n.kids.forEach((c, j) => { sl.get(n)[j].obj.material.color.set(GRN); lit(sl.get(n)[j], GREEN); used++; });
  setTag(cnt, '用到 n − 1 = ' + used);
  say('其他每個 node 恰好被一個 pointer 指到', '用到的 pointer = n − 1 = 11');
  talk(g, '只用了 11 個', 'wow');
  await step(tok);                                   // 1020.8 浪費 nk − (n − 1)
  for (const n of gAll(root)) sl.get(n).forEach((b, j) => { if (j >= n.kids.length) b.obj.material.color.set('#e06666'); });
  setTag(cnt, 'null = 36 − 11 = 25');
  say('紅色都是沒用到的 null（浪費）', 'nk − (n − 1) = 36 − 11 = 25');
  talk(g, '浪費 25 個！', 'sad');
  await step(tok);                                   // 1033.2 k 越大浪費越多
  tag('null = n(k − 1) + 1：k 越大越浪費', 'note', 0, 1.0, 1.0);
  say('k 越大，浪費越多', '一般式：n(k − 1) + 1 個 null');
  await step(tok);                                   // 1052.8 B-tree、B+ tree 也是 k-ary
  tag('B-tree、B+ tree 也是 k-ary tree', 'ptr', 0, 0.3, 1.6);
  say('進階 DS 的 B-tree、B+ tree', '也都是 k-ary tree');
  talk(g, '那它們也浪費？');
  await step(tok);                                   // 1065.6 看資料型態
  say('實務上看資料型態決定', 'k 不會大到太誇張；這只是示意');
  talk(g, '看情況用', 'happy');
}]);

// 18:11 Left Child–Right Sibling
FRAG.push(['treeb-lcrs', 'Left Child–Right Sibling 表示法', async (tok) => {
  const g = stage([0, 5, 13.5], [0, 3.8, 0], [6.3, 2.8]);
  const gl = layoutG(parseG(HT), { width: 10, topY: 6.6, step: 1.6 });
  const B = {}, Pp = {};
  for (const n of gAll(gl)) { B[n.label] = cube(n.label, depthColor(n.depth), NODE, n.pos.x, n.pos.y, 0); Pp[n.label] = n.pos; }
  for (const n of gAll(gl)) for (const k of n.kids) seg(botP(n.pos), topP(k.pos), DIM);
  const draw = (a, b, k) => {
    if (!b) return tag('sibling = null', 'idx', Pp[a].x + 1.5, Pp[a].y + 0.1);
    return k === 'L' ? arrow(botP(Pp[a]), topP(Pp[b], 0.32), BLU) : arrow(V(Pp[a].x + 0.42, Pp[a].y, 0.02), V(Pp[b].x - 0.42, Pp[b].y, 0.02), ORG);
  };
  await step(tok);                                   // 1090.8 Left Child Right Sibling
  tag('Left Child – Right Sibling（LCRS）', 'ptr alt', 0, 7.6);
  say('另一種表示法：Left Child–Right Sibling', '同一棵樹，換一種接法');
  talk(g, '新方法！', 'wow');
  await step(tok);                                   // 1097.8 每個 node 只有兩個 pointer
  const f = [['data', GRN], ['left child', BLU], ['right sibling', ORG]].map(([t, c], i) => cube(t, c, [1.7, 0.55, 0.7], -5.6 + i * 1.8, 0.4, 2.0, 2));
  say('每個 node 只有兩個 pointer', '[ data | left child | right sibling ]');
  await step(tok);                                   // 1103.8 一個指向最左邊的 child
  lit(f[1], GOLD);
  say('一個 pointer 指向最左邊的 child', '藍色箭頭 = left child');
  await step(tok);                                   // 1112.8 另一個指向 sibling
  lit(f[1]); lit(f[2], GOLD);
  say('另一個指向它的 sibling（兄弟）', '橘色箭頭 = right sibling');
  await step(tok);                                   // 1120.8 A 的 left child → B
  lit(f[2]); lit(B.A, GOLD);
  draw('A', 'B', 'L');
  say('A.leftChild = B', 'A 最左邊的 child 是 B');
  await step(tok);                                   // 1129.8 A 是 root，沒有 sibling
  draw('A', null, 'S');
  say('A 是 root：沒有 sibling', 'A.rightSibling = null');
  await step(tok);                                   // 1136.8 B 的 left child → E
  lit(B.A); lit(B.B, GOLD);
  draw('B', 'E', 'L');
  say('B 也有兩個指標：left child → E', 'B.leftChild = E');
  await step(tok);                                   // 1154.5 right sibling → C、D 串起來
  draw('B', 'C', 'S'); await go(tok, 300); draw('C', 'D', 'S');
  say('B 的 right sibling → C → D', '同一層的兄弟串成一串');
  talk(g, '兄弟手牽手', 'happy');
  await step(tok);                                   // 1176.8 C 只有一個 child → G
  lit(B.B); lit(B.C, GOLD);
  draw('C', 'G', 'L');
  say('C 只有一個 child：left child → G', 'C.leftChild = G');
  await step(tok);                                   // 1184.8 其他依此類推
  lit(B.C);
  for (const [a, b, k] of [['E', 'K', 'L'], ['E', 'F', 'S'], ['K', 'L', 'S'], ['D', 'H', 'L'], ['H', 'I', 'S'], ['I', 'J', 'S']]) { draw(a, b, k); await go(tok, 220); }
  say('其他 node 都照同樣規則接', '一樣能表示整棵 tree');
  await step(tok);                                   // 1206.8 只有三個欄位，避免浪費
  f.forEach((b) => lit(b, GOLD));
  say('實作只要三個欄位', 'data、left child、right sibling → 不浪費 pointer');
  talk(g, '省空間！', 'happy');
  await g.hop(tok);
}]);

// 20:25 Degree-two tree、binary tree、表示法小結
FRAG.push(['treeb-lcrs-bin', 'LCRS → degree 2 → binary tree', async (tok) => {
  const g = stage([0, 5, 13.5], [0, 3.8, 0], [6.3, 2.8]);
  const gl = layoutG(parseG(HT), { width: 10, topY: 6.6, step: 1.6 });
  const B = {}, Pp = {};
  for (const n of gAll(gl)) { B[n.label] = cube(n.label, depthColor(n.depth), NODE, n.pos.x, n.pos.y, 0); Pp[n.label] = n.pos; }
  const orig = [];
  for (const n of gAll(gl)) for (const k of n.kids) orig.push(seg(botP(n.pos), topP(k.pos), DIM));
  const arrs = [];
  for (const [a, b, k] of [['A', 'B', 'L'], ['B', 'E', 'L'], ['B', 'C', 'S'], ['C', 'D', 'S'], ['C', 'G', 'L'], ['E', 'K', 'L'], ['E', 'F', 'S'], ['K', 'L', 'S'], ['D', 'H', 'L'], ['H', 'I', 'S'], ['I', 'J', 'S']]) {
    arrs.push(k === 'L' ? arrow(botP(Pp[a]), topP(Pp[b], 0.32), BLU) : arrow(V(Pp[a].x + 0.42, Pp[a].y, 0.02), V(Pp[b].x - 0.42, Pp[b].y, 0.02), ORG));
  }
  await step(tok);                                   // 1225.1 有了這種表示法 → 衍生出來
  say('有了 LCRS，就衍生出另一種想法', '每個 node 剛好兩個 pointer');
  talk(g, '兩個 pointer…', 'wow');
  await step(tok);                                   // 1233.8 只有兩個 pointer → degree 2
  arrs.forEach(kill); orig.forEach(kill);
  const br = parseTree(HT_BIN);
  layoutTree(br, Object.assign({}, TREE_O, { topY: 6.8, minY: 1.4 }));
  for (const n of levelorder(br)) { n.body = B[n.label]; lab.springTo(n.body, n.pos.clone()); }
  edgeLines(() => treePairs(br));
  say('把兩個 pointer 看成兩個分支', '（補充：right sibling 改當 right child，轉 45°）');
  await step(tok);                                   // 1247.5 binary tree
  lit(B.A, GOLD);
  tag('right = 空', 'ptr alt', levelorder(br)[0].pos.x + 1.3, levelorder(br)[0].pos.y - 0.6);
  say('指出去最多兩個 → binary tree', 'root 沒有 sibling，所以 right 一定空');
  talk(g, '變成二元樹了！', 'happy');
  await g.hop(tok);
  await step(tok);                                   // 1267.8 總結：tree 像家族表
  lit(B.A);
  say('小結：tree 看起來就像家族表', '但表示的方法有很多種');
  await step(tok);                                   // 1274.8 linked list、LCRS
  tag('list（括號）', 'ptr', -3.4, 0.4, 1.4); tag('LCRS', 'ptr', 0, 0.4, 1.4);
  say('可以用 linked list 表示', '也可以用 left child–right sibling');
  await step(tok);                                   // 1284.8 最直覺的方法：k 個 child 欄位
  tag('k 個 child 欄位（最直覺）', 'ptr', 3.8, 0.4, 1.4);
  say('還有最直覺的方法', '看 degree 多少，就開多少個 child 欄位');
  await step(tok);                                   // 1303.8 k = 2 → binary tree
  tag('k-ary tree 的 k = 2 → binary tree', 'good', 0, 1.2, 1.4);
  say('k-ary tree 的 k = 2', '就是 binary tree');
  talk(g, 'k = 2 ✓', 'happy');
}]);

// 21:57 Binary tree 定義 vs tree
FRAG.push(['treeb-btdef', 'Binary tree 定義：與一般 tree 的比較', async (tok) => {
  const g = stage([0, 5, 13.5], [0, 4, 0], [6.3, 2.8]);
  await step(tok);                                   // 1317.1 binary tree vs binary search tree
  tag('Binary Tree', 'ptr alt', -2.2, 6.6); tag('≠', 'ptr', 0, 6.6); tag('Binary Search Tree', 'ptr', 2.6, 6.6);
  say('先記一個作業：BT 和 BST 差在哪？', '只差一個字 search，後面會講');
  talk(g, '回家查！');
  await step(tok);                                   // 1350.5 a finite set of nodes
  const e = ghost(SAND, 0, 4.6, 3.6, 2.0);
  const nodes = [[-0.9, 4.9], [0.5, 5.1], [-0.3, 4.2], [0.9, 4.1]].map(([x, y]) => cube('', BLU, [0.45, 0.4, 0.45], x, y, 0, 2));
  tag('finite set of nodes', 'ptr', 0, 3.3);
  say('Binary tree：a finite set of nodes', '由 node 構成的有限集合');
  await step(tok);                                   // 1365.8 empty 算不算？算
  nodes.forEach(flyB);
  const et = tag('∅  empty binary tree', 'ptr alt', 0, 4.6);
  say('既然是 set，可以是 empty 嗎？', '可以！empty binary tree 是合法的');
  talk(g, '空的也算！', 'wow');
  await step(tok);                                   // 1401.8 非空：root + left / right subtree
  kill(e); kill(et);
  const r = cube('root', GRN, [1.2, 0.6, 0.8], 0, 5.6, 0, 3);
  const parts = [ghost(BLU, -2.4, 3.4, 3.0, 2.0), ghost(PUR, 2.4, 3.4, 3.0, 2.0), tag('left subtree', 'ptr', -2.4, 3.4), tag('right subtree', 'ptr', 2.4, 3.4), arrow(V(-0.3, 5.3, 0), V(-2.0, 4.45, 0)), arrow(V(0.3, 5.3, 0), V(2.0, 4.45, 0))];
  say('不是空的話：一個 root', '再分出 left subtree、right subtree');
  await step(tok);                                   // 1416.8 一般 tree 不允許 0 個 node
  parts.forEach(kill); flyB(r);
  await go(tok, 300);
  tag('Binary tree', 'ptr alt', 0.6, 7.2); tag('Tree', 'ptr', 4.4, 7.2);
  const rows = [
    ['允許 0 個 node', '✓ 可以', '✗ 不行', '一般 tree 不允許 0 個 node', 'tree 是 a collection of nodes，至少要有 root'],
    ['左右順序', '有區分', '不區分', 'binary tree 的左、右子樹有差別', 'tree 不管 child 的順序'],
    ['degree', '≤ 2', 'no limit', '比較表：degree', 'binary ≤ 2，tree 沒有限制'],
  ];
  const row = (k) => {
    const [nm, a, b, cap, fm] = rows[k], y = 5.8 - k * 1.5;
    tag(nm, 'ptr', -4.4, y);
    cube(a, k === 0 ? GRN : BLU, [2.6, 0.7, 0.8], 0.6, y, 0, 2.5);
    cube(b, k === 0 ? '#e06666' : SAND, [2.6, 0.7, 0.8], 4.4, y, 0, 2.5);
    say(cap, fm);
  };
  row(0);
  talk(g, '一般 tree 不能空', 'sad');
  await step(tok);                                   // 1456.8 左右有差別
  row(1);
  talk(g, '左右不能亂換', 'wow');
  await step(tok);                                   // 1465.0 degree ≤ 2 vs no limit
  row(2);
  talk(g);
  await step(tok);                                   // 1480.8 整理比較表
  tag('補充：A 只有左 child ≠ A 只有右 child（binary tree 中）', 'note', 0.6, 0.9, 1.0);
  say('比較表整理完：順序、0 個 node、degree', '左右有別，是 binary tree 的關鍵');
  talk(g, '三個差別記住了', 'happy');
}]);

// 25:13 Binary tree 範例
FRAG.push(['treeb-btex', 'Binary tree 範例：左右有別、skewed、complete', async (tok) => {
  let g = stage([0, 5, 13.5], [0, 4, 0], [6.4, 2.8]);
  await step(tok);                                   // 1513.3 AB、ABC 都是 tree
  await dropG(tok, 'A(B)', { cx: -5.4, topY: 6.2, step: 1.6 }, 150);
  await dropG(tok, 'A(B,C)', { cx: -2.3, width: 1.8, topY: 6.2, step: 1.6 }, 150);
  tag('tree：AB', 'ptr', -5.4, 7.2); tag('tree：ABC', 'ptr', -2.3, 7.2);
  say('AB 是一棵 tree，ABC 也是', '先看它們真正的長相');
  await step(tok);                                   // 1521.8 用 LCRS implement
  cube('A', GRN, NODE, 1.6, 6.2, 0, 2); cube('B', BLU, NODE, 1.6, 4.6, 0, 2);
  arrow(V(1.6, 5.9, 0), V(1.6, 4.92, 0), BLU);
  cube('A', GRN, NODE, 4.4, 6.2, 0, 2); cube('B', BLU, NODE, 4.4, 4.6, 0, 2);
  const c = cube('C', BLU, NODE, 6.0, 4.6, 0, 2);
  arrow(V(4.4, 5.9, 0), V(4.4, 4.92, 0), BLU); arrow(V(4.82, 4.6, 0), V(5.58, 4.6, 0), ORG);
  tag('LCRS 實作的長相', 'ptr alt', 3.8, 7.2);
  say('用 LCRS 去 implement，會長成右邊這樣', '藍 = left child，橘 = right sibling');
  await step(tok);                                   // 1535.8 程式裡長這樣，但實際的 tree 還是那樣
  lit(c, GOLD);
  say('程式裡的長相 ≠ 實際 tree 的長相', 'C 在實作裡是 B 的 sibling');
  talk(g, '要分清楚！', 'wow');
  await step(tok);                                   // 1584.8 AB 與 AB 有差別
  g = stage([0, 5, 13.5], [0, 4, 0], [6.4, 2.8]);
  const t1 = await dropTree(tok, 'A(B)', { cx: -3, width: 2, topY: 6.0, minY: 4.4 }, 150);
  const t2 = await dropTree(tok, 'A(,B)', { cx: 3, width: 2, topY: 6.0, minY: 4.4 }, 150);
  glow(t1.left, GOLD);
  tag('A 的 left child = B', 'ptr', -3, 3.4);
  say('binary tree：A 的 left child 是 B', '和下一棵比比看');
  await step(tok);                                   // 1592.8 A 的 right child 是 B
  glow(t1.left, OFF); glow(t2.right, GOLD);
  tag('A 的 right child = B', 'ptr', 3, 3.4); tag('≠', 'ptr alt', 0, 5.2);
  say('這棵：A 的 right child 是 B', '兩棵是不同的 binary tree');
  talk(g, '左右不一樣喔', 'wow');
  await step(tok);                                   // 1599.8 skewed
  g = stage([0, 5, 13.5], [0, 4, 0], [6.4, 2.8]);
  tag('skewed binary tree', 'ptr', -3.6, 7.4);
  await dropTree(tok, 'A(B(C(D(E))))', { cx: -3.8, width: 4.4, topY: 6.6, minY: 1.8 }, 150);
  say('全部歪向同一邊：skewed binary tree', '一路往左斜下去');
  await step(tok);                                   // 1609.8 就像 linked list
  tag('就像 linked list', 'note', -1.2, 1.6, 0.4);
  say('skewed binary tree 就像 linked list', '每個 node 只用一個 pointer');
  talk(g, '歪成一條線', 'sad');
  await step(tok);                                   // 1617.8 complete binary tree
  tag('complete binary tree', 'ptr alt', 3.4, 7.4);
  await dropTree(tok, CT, { cx: 3.4, width: 6.0, topY: 6.6, minY: 2.4 }, 120);
  say('排得很整齊的：complete binary tree', '補充：要剛好佔滿層序編號 1..n');
  talk(g, '整整齊齊', 'happy');
}]);

// 27:18 Lemma 5.2：每層最多 2^(i−1)
FRAG.push(['treeb-lemma', 'Lemma 5.2：每層與整棵樹的最大 node 數', async (tok) => {
  const g = stage([0, 4.8, 13.5], [0, 4.1, 0], [6.6, 2.8]);
  await step(tok);                                   // 1637.8 推導特質：level i 最多幾個 node？
  slots(15);
  for (let d = 0; d < 4; d++) tag('level ' + (d + 1), 'idx', -6.7, 6.6 - d * 1.5);
  say('Binary tree 第 i 層最多幾個 node？', 'root 在 level 1');
  talk(g, '每層最多幾個？', 'wow');
  const lv = async (d) => {
    const c = 1 << d;
    for (let i = c; i < 2 * c; i++) { cube('', depthColor(d), NODE, HP(i).x, HP(i).y, 0, 2.5); await go(tok, 90); }
    tag('2^' + d + ' = ' + c, 'ptr alt', 6.6, 6.6 - d * 1.5);
  };
  await step(tok);                                   // 1657.8 第 1 層只有 root：2^(1−1) = 1
  await lv(0);
  say('level 1 就是 root：只有 1 個', '2^(1−1) = 1');
  await step(tok);                                   // 1669.8 第 2 層兩個
  await lv(1);
  say('level 2：最多 2 個', '2^(2−1) = 2');
  await step(tok);                                   // 1686.6 第 3 層 4 個
  await lv(2);
  say('level 3：最多 4 個', '每往下一層 ×2');
  talk(g, '一直翻倍', 'happy');
  await step(tok);                                   // 1697.0 深度 k 最多幾個？
  await lv(3);
  say('第 i 層最多 2^(i−1) 個', '那深度 k 的 tree 最多幾個 node？');
  await step(tok);                                   // 1714.3 2^k − 1
  tag('max nodes = 2^k − 1', 'good', 0, 0.6, 1.0);
  say('答案：2^k − 1', '');
  await step(tok);                                   // 1726.8 summation
  tag('Σ_{i=1..k} 2^(i−1)', 'note', 0, 1.4, 1.0);
  say('就是每層的最大值加起來', 'Σ_{i=1..k} 2^(i−1)');
  await step(tok);                                   // 1748.7 加起來 = 2^k − 1
  tag('k = 4：1 + 2 + 4 + 8 = 15 = 2⁴ − 1', 'ptr alt', 0, 2.2, 1.0);
  say('加起來就是 2^k − 1', 'k = 4：1 + 2 + 4 + 8 = 15');
  talk(g, '等比級數！', 'happy');
  await g.hop(tok);
}]);

// 31:48 Lemma 5.3 的敘述：n0 = n2 + 1
const N02 = 'A(B(D,E),C(,F))';
const deg2 = (n) => (n.left ? 1 : 0) + (n.right ? 1 : 0);
FRAG.push(['treeb-n0n2', 'Lemma 5.3：n0 = n2 + 1 的敘述', async (tok) => {
  const g = stage([0, 5, 13.5], [0, 3.8, 0], [6.2, 2.8]);
  const COL = [GREEN, RED, GOLD];
  let root, all;
  await step(tok);                                   // 1907.8 Lemma 5-3
  root = await dropTree(tok, N02, { width: 7, topY: 6.4, minY: 3.0 }, 150);
  all = allNodes(root);
  tag('Lemma 5.3', 'ptr alt', -5.2, 7.4);
  say('Lemma 5.3：binary tree 的另一個特質', '示意樹：A(B(D,E), C(, F))');
  await step(tok);                                   // 1924.8 non-empty binary tree T
  tag('T：非空的 binary tree', 'ptr', -5.2, 6.7);
  say('任一棵非空的 binary tree T', '');
  await step(tok);                                   // 1930.8 n0 = degree 0（leaf）的個數
  all.filter((n) => deg2(n) === 0).forEach((n) => { glow(n, COL[0]); tag('deg 0', 'idx', n.pos.x + 0.75, n.pos.y - 0.3); });
  tag('n0 = 3', 'ptr alt', 4.6, 6.6);
  say('n0 = degree 0 的 node 數（leaf）', 'D、E、F → n0 = 3');
  await step(tok);                                   // 1941.8 n2 = degree 2 的個數
  all.filter((n) => deg2(n) === 2).forEach((n) => { glow(n, COL[2]); tag('deg 2', 'idx', n.pos.x + 0.75, n.pos.y - 0.3); });
  tag('n2 = 2', 'ptr alt', 4.6, 5.9);
  say('n2 = degree 2 的 node 數', 'A、B → n2 = 2');
  await step(tok);                                   // 1949.8 n1 = degree 1
  all.filter((n) => deg2(n) === 1).forEach((n) => { glow(n, COL[1]); tag('deg 1', 'idx', n.pos.x + 0.75, n.pos.y - 0.3); });
  tag('n1 = 1', 'ptr alt', 4.6, 5.2);
  say('n1 = degree 1 的 node 數', 'C → n1 = 1（證明時才用到）');
  await step(tok);                                   // 1958.8 n0 = n2 + 1
  tag('n0 = n2 + 1', 'good', 0, 1.6, 1.0);
  say('性質：n0 = n2 + 1', '3 = 2 + 1，跟 n1 無關');
  talk(g, '好神奇！', 'wow');
  await g.hop(tok);
  await step(tok);                                   // 1980.8 degree 0 在最下面
  all.filter((n) => deg2(n) === 0).forEach((n) => glow(n, GOLD));
  say('degree 0 的 node 在最下面', '因為它沒有再指出去 → 就是 leaf');
  await step(tok);                                   // 2005.8 證明：只是符號置換
  all.forEach((n) => glow(n, OFF));
  tag('證明：只做符號代換，不用微積分', 'note', 0, 0.8, 1.0);
  say('證明很簡單：只是把式子做代換', '不會用到微積分');
  talk(g, '不怕不怕', 'happy');
  await step(tok);                                   // 2024.8 n = total number of nodes
  all.forEach((n) => glow(n, '#10304a'));
  tag('n = 6', 'ptr alt', -5.2, 5.6);
  say('n = total number of nodes', '這棵 n = 6');
  await step(tok);                                   // 2028.6 B = branch = pointer
  all.forEach((n) => glow(n, OFF));
  all.forEach((n) => [n.left, n.right].forEach((c) => c && hiEdge(n, c)));
  tag('B = 5', 'ptr alt', -5.2, 4.9);
  say('B = branch，也就是 pointer 的個數', '金色的邊共 5 條');
}]);

// 34:27 證明 n0 = n2 + 1
FRAG.push(['treeb-proof', '證明 n0 = n2 + 1', async (tok) => {
  const g = stage([0, 5, 13.5], [0, 3.8, 0], [-6.2, 2.8]);
  const root = await dropTree(tok, N02, { cx: -3.8, width: 4.6, topY: 6.4, minY: 3.0 }, 0);
  const all = allNodes(root);
  const COL = [GREEN, RED, GOLD];
  const cd = code(['(1) n = n0 + n1 + n2', '(2) B = n − 1   → n = B + 1', '(3) B = n1 + 2·n2', '(4) n = n1 + 2·n2 + 1', '(5) n0+n1+n2 = n1+2·n2+1', '(6) n0 = n2 + 1'], 3.4, 6.6, 0.8);
  cd.ls.forEach((l) => hide(l, false));
  const show = (i) => { hide(cd.ls[i], true); cd.hl(i); };
  await step(tok);                                   // 2061.6 n = n0 + n1 + n2
  show(0); all.forEach((n) => glow(n, COL[deg2(n)]));
  say('總 node 數 = 三種 degree 的個數相加', 'n = 3 + 1 + 2 = 6');
  talk(g, '全部加起來');
  await step(tok);                                   // 2102.6 B + 1 = n，為什麼？
  all.forEach((n) => glow(n, OFF));
  show(1);
  say('第二個式子：B + 1 = n', '為什麼？看 pointer 怎麼數');
  talk(g, '為什麼？', 'wow');
  await step(tok);                                   // 2112.6 除了 root，每個 node 被一個指到
  let b = 0;
  for (const n of all) for (const c of [n.left, n.right]) if (c) { hiEdge(n, c); glow(c, GREEN); b++; await go(tok, 300); }
  say('除了 root，每個 node 剛好被一個 pointer 指到', 'B = n − 1 = 5 → n = B + 1');
  await step(tok);                                   // 2157.1 從 degree 1 的角度數
  all.forEach((n) => glow(n, OFF));
  show(2);
  all.filter((n) => deg2(n) === 1).forEach((n) => { glow(n, COL[1]); tag('×1', 'ptr alt', n.pos.x + 0.75, n.pos.y); });
  say('換個角度：從「指出去」來數', 'degree 1 的 node 各貢獻 1 條：1·n1');
  await step(tok);                                   // 2177.1 degree 2 → 2·n2
  all.filter((n) => deg2(n) === 2).forEach((n) => { glow(n, COL[2]); tag('×2', 'ptr alt', n.pos.x + 0.75, n.pos.y); });
  say('degree 2 的 node 各貢獻 2 條：2·n2', 'B = n1 + 2·n2 = 1 + 4 = 5');
  talk(g, '兩種數法一樣多', 'happy');
  await step(tok);                                   // 2229.2 把 B 代入：n1 + 2n2 + 1 = n
  show(3);
  say('把 (3) 的 B 代進 B + 1 = n', 'n = n1 + 2·n2 + 1');
  await step(tok);                                   // 2254.8 n 又等於 n0 + n1 + n2
  show(4);
  say('再用 (1) 把 n 換掉', 'n0 + n1 + n2 = n1 + 2·n2 + 1');
  await step(tok);                                   // 2267.9 左右消去 → n0 = n2 + 1
  show(5);
  say('兩邊消去 n1 和一個 n2', 'n0 = n2 + 1 ✓');
  talk(g, '證完了！', 'happy');
  await g.hop(tok);
}]);

// 41:20 Full binary tree
FRAG.push(['treeb-full', 'Full binary tree', async (tok) => {
  const g = stage([0, 4.8, 13.5], [0, 4.1, 0], [6.6, 2.8]);
  slots(15);
  for (let d = 0; d < 4; d++) tag('level ' + (d + 1), 'idx', -6.7, 6.6 - d * 1.5);
  const bs = [];
  await step(tok);                                   // 2479.4 什麼是 full binary tree
  tag('full binary tree？', 'ptr alt', 0, 7.6);
  say('第三個定義：full binary tree', '');
  talk(g, 'full 是滿的意思？', 'wow');
  await step(tok);                                   // 2485.1 full 和 complete 不一樣
  tag('full ≠ complete', 'note', 4.6, 7.6);
  say('注意：full 和 complete 不一樣', '');
  await step(tok);                                   // 2496.8 深度 k 有 2^k − 1 個 node
  for (let i = 1; i <= 15; i++) { bs.push(cube(String(i), depthColor(hdepth(i)), NODE, HP(i).x, HP(i).y, 0, 2.5)); await go(tok, 120); }
  say('深度 k 的 full binary tree', '擁有 2^k − 1 個 node');
  await step(tok);                                   // 2507.8 最大數量的 node（Lemma 5.2）
  bs.forEach((b) => lit(b, GOLD));
  say('在深度允許的範圍內，node 數最多', '就是 Lemma 5.2 的最大值');
  await step(tok);                                   // 2556.8 高度 4 的例子
  bs.forEach((b) => lit(b));
  tag('height = 4', 'ptr alt', -5.6, 7.6);
  say('這就是一棵 full binary tree', 'level 1、2、3、4：高度 4');
  await step(tok);                                   // 2568.0 2^4 − 1 = 15 個全滿
  tag('2⁴ − 1 = 15 個，全滿', 'good', 0, 0.6, 1.0);
  say('2⁴ − 1 = 15 個 node', '每個位置都滿了');
  talk(g, '一格都不缺', 'happy');
  await g.hop(tok);
}]);

// 43:01 Complete binary tree 與層序編號
FRAG.push(['treeb-complete', 'Complete binary tree 與層序編號', async (tok) => {
  const g = stage([0, 4.8, 13.5], [0, 4.1, 0], [6.6, 2.8]);
  const gs = slots(15, HP, true);
  for (let d = 0; d < 4; d++) tag('level ' + (d + 1), 'idx', -6.7, 6.6 - d * 1.5);
  const bs = {}; const hole = [];
  await step(tok);                                   // 2580.8 這棵沒有到全滿
  'ABCDEFGHI'.split('').forEach((c, k) => { bs[c] = cube(c, depthColor(hdepth(k + 1)), NODE, HP(k + 1).x, HP(k + 1).y, 0, 2.5); });
  say('這棵樹沒有到全滿', '只有 9 個 node');
  await step(tok);                                   // 2589.8 後面這一串是空的
  for (let i = 10; i <= 15; i++) hole.push(ghost(SAND, HP(i).x, HP(i).y, 0.9, 0.7, 0, 0.9));
  say('後面這一串位置是空的', '10 ～ 15 號');
  await step(tok);                                   // 2600.8 其他都跟 full 一樣 → complete
  tag('complete binary tree', 'ptr alt', 0, 7.6);
  say('除了後面空掉，其他都跟 full 一樣', '這叫 complete binary tree');
  talk(g, '前面都排滿', 'happy');
  await step(tok);                                   // 2608.8 complete 和 full 不一樣
  tag('full：每個位置都佔滿', 'note', -4.4, 0.4, 1.0); tag('complete：後面可以空', 'note', 3.4, 0.4, 1.0);
  say('full 是全部裝滿', 'complete 是後面還剩一些空位');
  await step(tok);                                   // 2623.8 通常給它編號
  for (let k = 0; k < 9; k++) { const c = 'ABCDEFGHI'[k]; lit(bs[c], GOLD); await go(tok, 200); lit(bs[c]); }
  say('通常會給 node 編號', '一層一層、從上到下、從左到右：A=1…I=9');
  await step(tok);                                   // 2637.8 為什麼要編號：等一下用 array
  tag('編號 = 等一下 array 的位置', 'good', 0, 1.2, 1.0);
  say('為什麼要編號？', '等一下用 array 表示時，位置馬上算得出來');
  talk(g, '編號有用！', 'wow');
  await step(tok);                                   // 2698.8 H、I 移到 G 底下還是 complete 嗎？
  hole.forEach(kill);
  lab.springTo(bs.H, HP(14)); lab.springTo(bs.I, HP(15));
  say('思考題：H、I 移到 G 底下呢？', '還是 complete 嗎？考試可能考');
  talk(g, '嗯……？', 'wow');
  await step(tok);                                   // 2712.7 回去想想看
  for (let i = 8; i <= 13; i++) hole.push(ghost('#e06666', HP(i).x, HP(i).y, 0.9, 0.7, 0, 0.9));
  gs.forEach((m, i) => { if (i + 1 >= 8 && i + 1 <= 13) m.material.color.set('#e06666'); });
  say('補充答案：H、I 佔 14、15，8～13 空著', '中間有洞 → 不是 complete');
  talk(g, '中間不能有洞', 'sad');
}]);

// 45:35 Array 表示法：2i、2i+1、⌊i/2⌋
FRAG.push(['treeb-array', 'Array 表示法：2i、2i+1、⌊i/2⌋', async (tok) => {
  const g = stage([0, 5.2, 13.5], [0, 3.5, 1], [6.4, 1.2]);
  const TP = (i) => heapPos(i, 7.0, 1.3, 9);
  const XP = (i) => -4.6 + i * 1.0;
  const L = 'ABCDEFGHI';
  const nb = [], cells = [], tmp = [];
  const clr = () => { tmp.splice(0).forEach(kill); cells.forEach((c) => c && lit(c)); nb.forEach((b) => b && lit(b)); };
  const mark = (i, t, col) => { lit(cells[i], col); lit(nb[i], col); tmp.push(tag(t, col === GOLD ? 'ptr alt' : 'ptr', XP(i), 1.15, 2.8)); };
  await step(tok);                                   // 2744.8 array 可以表示 tree
  for (let i = 0; i <= 9; i++) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.9), new THREE.MeshStandardMaterial({ color: i ? '#e9dcc4' : '#cbbd9f' }));
    t.position.set(XP(i), 0.04, 2.8); lab.world.add(t);
    tag(i ? '[' + i + ']' : '[0] 不用', 'idx', XP(i), 0, 3.6);
  }
  for (let i = 1; i <= 9; i++) nb[i] = idxCube(L[i - 1], i, depthColor(hdepth(i)), TP(i));
  edgeLines(() => { const out = []; for (let i = 1; i <= 9; i++) for (const c of [2 * i, 2 * i + 1]) if (c <= 9) out.push([nb[i].obj.position, nb[c].obj.position]); return out; });
  say('Array 也能表示 binary tree', '底下這排格子就是 array');
  talk(g, 'array 也行？', 'wow');
  await step(tok);                                   // 2751.7 規則可循：固定該放的位置
  say('因為每個 node 有固定該放的位置', '有規則可循');
  await step(tok);                                   // 2788.8 A 放在位置 1
  const put = (i) => { const c = lab.addBody(block(L[i - 1], [0.6, 0.45, 0.6], depthColor(hdepth(i)))); c.obj.position.copy(TP(i)); lab.springTo(c, V(XP(i), 0.32, 2.8)); cells[i] = c; };
  put(1);
  say('A 放在 array 的位置 1', '編號 1 → index 1');
  await step(tok);                                   // 2811.9 從上到下、從左到右 → index
  for (let i = 2; i <= 9; i++) { put(i); await go(tok, 200); }
  say('依編號直接 map 到 array 的 index', '從上到下、從左到右');
  await step(tok);                                   // 2845.8 A 的 left、right child 在哪？
  mark(1, 'i=1', GOLD); mark(2, 'left', GREEN); mark(3, 'right', GREEN);
  say('A 在 1：left child B 在 2，right child C 在 3', '');
  await step(tok);                                   // 2871.3 left child = 2i
  tag('left child = 2i', 'good', -1.8, 1.9, 2.8);
  say('位置 i 的 left child 在 2i', '');
  await step(tok);                                   // 2895.8 right child = 2i + 1
  tag('right child = 2i + 1', 'good', 1.6, 1.9, 2.8);
  say('right child 在 2i + 1', '');
  talk(g, '乘 2 就到孩子', 'happy');
  await step(tok);                                   // 2904.3 B 在 2：left child D 在 4
  clr(); mark(2, 'i=2', GOLD); mark(4, 'left', GREEN);
  say('B 在 2：left child 是 2×2 = 4', '位置 4 正好是 D');
  await step(tok);                                   // 2928.0 right child：2×2+1 = 5
  mark(5, 'right', GREEN);
  say('B 的 right child：2×2 + 1 = 5', '位置 5 是 E');
  await step(tok);                                   // 2976.0 child 在 i → parent 在 i/2
  clr(); mark(4, 'i=4', GOLD); mark(2, 'parent', GREEN);
  tmp.push(arrow(V(XP(4), 1.5, 2.8), V(XP(2) + 0.2, 1.5, 2.8), '#c08a1f'));
  say('反過來：child 在 i，parent 在 i / 2', 'D 在 4：4 / 2 = 2 → B');
  await step(tok);                                   // 2995.8 5 / 2 = 2.5 → 無條件捨去
  clr(); mark(5, 'i=5', GOLD); mark(2, 'parent', GREEN);
  tmp.push(arrow(V(XP(5), 1.5, 2.8), V(XP(2) + 0.2, 1.5, 2.8), '#c08a1f'));
  say('E 在 5：5 / 2 = 2.5，無條件捨去', 'parent = ⌊5/2⌋ = 2 → B');
  talk(g, '捨去小數', 'happy');
  await step(tok);                                   // 3027.0 i = 1 是 root，沒有 parent
  clr(); mark(1, 'root', GOLD);
  say('i = 1 是 root，沒有 parent', '公式：parent ⌊i/2⌋，left 2i，right 2i+1');
}]);

// 51:08 Skewed tree 的空間浪費
FRAG.push(['treeb-skew', 'Array 表示 skewed tree 的空間浪費', async (tok) => {
  const g = stage([0, 5.2, 13.5], [0, 3.5, 1], [6.4, 1.0]);
  const XP = (i) => -6.6 + i * 0.42;
  const tiles = [];
  for (let i = 1; i <= 31; i++) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.8), new THREE.MeshStandardMaterial({ color: '#e9dcc4' }));
    t.position.set(XP(i), 0.04, 2.8); lab.world.add(t); tiles.push(t);
    if ([1, 2, 4, 8, 16, 31].includes(i)) tag(String(i), 'idx', XP(i), 0, 3.5);
  }
  const idx = [1, 2, 4, 8, 16];
  const TP = (d) => V(-0.6 - d * 1.1, 7.0 - d * 1.2, 0);
  const nb = 'ABCDE'.split('').map((c, d) => idxCube(c, idx[d], depthColor(d), TP(d)));
  edgeLines(() => nb.slice(1).map((b, d) => [nb[d].obj.position, b.obj.position]));
  const put = (d) => { const c = lab.addBody(block('ABCDE'[d], [0.36, 0.4, 0.5], depthColor(d))); c.obj.position.copy(TP(d)); lab.springTo(c, V(XP(idx[d]), 0.3, 2.8)); nb.forEach((b) => lit(b)); lit(nb[d], GOLD); };
  await step(tok);                                   // 3067.6 skewed tree A B C D E
  say('一棵 skewed tree：A、B、C、D、E', '用 array 表示會怎樣？');
  talk(g, '歪的也放得進去？', 'wow');
  await step(tok);                                   // 3075.8 A 在 1，B 在 2
  put(0); await go(tok, 300); put(1);
  say('A 還是在位置 1，B 在位置 2', 'B 是 A 的 left child：2×1 = 2');
  await step(tok);                                   // 3088.7 C：2×2 = 4
  put(2);
  say('C 是 B 的 left child', '2 × 2 = 4');
  await step(tok);                                   // 3099.8 D：2×4 = 8
  put(3);
  say('D 是 C 的 left child', '2 × 4 = 8');
  await step(tok);                                   // 3104.0 E：2×8 = 16
  put(4);
  say('E 是 D 的 left child', '2 × 8 = 16');
  await step(tok);                                   // 3117.8 很多空間空著沒用
  tiles.forEach((t, k) => { if (!idx.includes(k + 1)) t.material.color.set('#f4b8a8'); });
  say('很多空間空在那邊沒用到', '補充：深度 5 要 31 格，只用 5 格');
  talk(g, '好浪費…', 'sad');
  await step(tok);                                   // 3129.8 好處：找 parent / child 一步到
  tag('優點：⌊i/2⌋、2i、2i+1 一步到位', 'good', 0, 1.3, 2.8);
  say('好處：找 parent 和 child 很容易', '做一下加減乘除，一步就到');
  talk(g, '算一下就到', 'happy');
  await step(tok);                                   // 3139.6 壞處：不夠 complete 就浪費
  tag('缺點：不夠 complete 就浪費空間', 'bad', 0, 2.0, 2.8);
  say('壞處：tree 不夠 complete 時', '很多空間被浪費掉');
}]);

// 52:40 Linked 表示：找 child 易、找 parent 難
FRAG.push(['treeb-linked', 'Linked 表示：找 child 容易、找 parent 困難', async (tok) => {
  let g = stage([0, 5, 13.5], [0, 3.6, 0.5], [6.4, 2.8]);
  let root, N;
  await step(tok);                                   // 3159.6 不浪費空間：宣告 node，三個欄位
  const f = [['left', BLU], ['data', GRN], ['right', BLU]].map(([t, c], i) => cube(t, c, [1.3, 0.6, 0.8], -1.4 + i * 1.4, 6.6, 0, 2.5));
  arrow(V(-1.6, 6.25, 0), V(-2.6, 5.4, 0), BLU); arrow(V(1.6, 6.25, 0), V(2.6, 5.4, 0), BLU);
  say('不想浪費空間：宣告一個 node', '三個欄位：data + 左右兩個 pointer');
  talk(g, '用多少開多少', 'happy');
  await step(tok);                                   // 3200.9 array 或 left/right child 宣告
  f.forEach(flyB);
  await go(tok, 300);
  g = stage([0, 5, 13.5], [0, 3.6, 0.5], [6.4, 2.8]);
  root = await dropTree(tok, CT, { topY: 6.4, minY: 2.2, width: 9 }, 100);
  N = (l) => find(root, l);
  tag('node = [ leftChild | data | rightChild ]', 'ptr', 0, 7.6);
  say('binary tree：可以用 array，也可以用 node', '兩種的優缺點要知道');
  await step(tok);                                   // 3230.6 D 的 parent 是誰？
  glow(N('D'), GOLD);
  say('問：用 node 表示時，D 的 parent 是誰？', 'node 裡只有往下的 pointer');
  talk(g, '往上沒有箭頭！', 'wow');
  await step(tok);                                   // 3241.1 先從 root 往下找到 D
  glow(N('D'), OFF);
  const cur = makeCursor(), prev = makeCursor();
  prev.obj.material = new THREE.MeshBasicMaterial({ color: BLU }); prev.obj.scale.set(1.25, 1.25, 1.25);
  const tc = tag('cur', 'ptr alt', 0, 0), tp = tag('prev', 'ptr', 0, 0);
  hide(tp, false);
  const path = ['A', 'B', 'D'].map(N);
  for (let i = 0; i < 3; i++) { cursorTo(cur, path[i].pos); tc.position.copy(path[i].pos).add(V(-1.0, 0.1, 0)); await go(tok, 500); }
  say('得先從 root 開始往下，找到 D', 'A → B → D');
  await step(tok);                                   // 3251.1 兩個 pointer：一個往下，一個跟在上一層
  hide(tp, true);
  cursorTo(prev, N('B').pos); tp.position.copy(N('B').pos).add(V(1.1, 0.1, 0));
  glow(N('B'), GOLD);
  say('用兩個 pointer：cur 往下，prev 跟在上一層', '找到 D 時 prev = B → parent(D) = B');
  talk(g, '跟屁蟲 pointer', 'happy');
  await step(tok);                                   // 3284.5 找 child 很簡單
  const D = N('D');
  ['H', 'I'].forEach((l) => { glow(N(l), GREEN); hiEdge(D, N(l)); });
  say('問 child 很簡單：找到 D 直接看左右', 'D.leftChild = H，D.rightChild = I');
  await step(tok);                                   // 3292.0 找 parent 比較難
  tag('linked：找 parent 難、找 child 易', 'note', 0, 1.2, 1.0);
  say('在 linked binary tree 中', '找 parent 比找 child 難');
  await step(tok);                                   // 3300.0 同樣這顆 full binary tree
  g = stage([0, 5, 13.5], [0, 3.6, 0.5], [6.4, 2.8]);
  tag('full binary tree', 'ptr', -3.4, 7.4); tag('skewed binary tree', 'ptr', 3.4, 7.4);
  await dropTree(tok, 'A(B(D,E),C(F,G))', { cx: -3.4, width: 5, topY: 6.4, minY: 3.4 }, 100);
  say('左邊是一棵 full binary tree', '用 node 表示，pointer 都用得到');
  await step(tok);                                   // 3316.8 skewed 就像 linked list
  await dropTree(tok, 'A(,B(,C(,D)))', { cx: 3.4, width: 4, topY: 6.4, minY: 2.4 }, 150);
  say('skewed tree 用 node 表示', '看起來就像 linked list');
  talk(g, '一條鏈子', 'wow');
}]);

// 56:33 TreeNode 類別與 array vs linked 比較
FRAG.push(['treeb-class', 'TreeNode 類別；array vs linked 比較', async (tok) => {
  let g = stage([0, 5, 13.5], [0, 4, 0], [6.4, 2.8]);
  let fs = [], tr = null, kids = [];
  await step(tok);                                   // 3400.8 node 宣告成 TreeNode：三個欄位
  fs = [['leftChild', -0.2], ['data', 1.6], ['rightChild', 3.4]].map(([t, x]) => cube(t, t === 'data' ? GRN : BLU, [1.75, 0.7, 0.9], x, 6.2, 0, 2.5));
  tag('TreeNode', 'ptr alt', 1.6, 7.0);
  say('linked 表示：node 宣告成 TreeNode', 'leftChild、data、rightChild 三個欄位');
  await step(tok);                                   // 3416.8 Tree 只有一個 pointer：root
  tr = cube('Tree：root', GRN, [2.4, 0.7, 0.9], -4.4, 6.2, 0, 2.5);
  tag('class Tree { TreeNode *root; }', 'ptr', -3.6, 7.4);
  arrow(V(-3.2, 6.2, 0), V(-1.1, 6.2, 0), '#c08a1f');
  say('Tree 這個 class 很簡單', '只有一個 pointer：root');
  talk(g, '只要記住 root', 'happy');
  await step(tok);                                   // 3430.8 透過 root 去 traverse
  kids = [cube('TreeNode', BLU, [1.6, 0.6, 0.8], -1.4, 4.2, 0, 2), cube('TreeNode', BLU, [1.6, 0.6, 0.8], 4.6, 4.2, 0, 2)];
  arrow(V(-0.2, 5.85, 0), V(-1.2, 4.55, 0), BLU); arrow(V(3.4, 5.85, 0), V(4.4, 4.55, 0), BLU);
  say('有了 root，就能從它開始 traverse', '每個 node 再指向左右 child');
  await step(tok);                                   // 3443.5 決定 parent：array 簡單
  [tr, ...fs, ...kids].forEach(flyB);
  await go(tok, 400);
  g = stage([0, 5, 13.5], [0, 4, 0], [6.4, 0.6]);
  tag('Array', 'ptr alt', 0.4, 7.3); tag('Linked', 'ptr alt', 4.2, 7.3);
  const rows = [
    ['決定 parent', ['算 ⌊i/2⌋：易', GRN], ['parent 難', '#e06666'], '找 parent：array 簡單，link 不簡單', 'array 算一下；link 要從 root 找'],
    ['space overhead', ['整個先宣告', '#e06666'], ['用多少開多少', GRN], 'Space：array 要先宣告整個空間', 'link：用多少 node 就 create 多少'],
    ['insert／delete', ['要搬資料：難', '#e06666'], ['改 pointer：易', GRN], 'insert／delete：array 很 difficult', '因為牽涉到資料移動'],
  ];
  const cellsL = [];
  const row = (k) => { const [nm, a, b, cap, fm] = rows[k], y = 6.0 - k * 1.3; tag(nm, 'ptr', -4.4, y); cube(a[0], a[1], [3.2, 0.7, 0.8], 0.4, y, 0, 2.5); cellsL.push(cube(b[0], b[1], [3.2, 0.7, 0.8], 4.2, y, 0, 2.5)); say(cap, fm); };
  row(0);
  await step(tok);                                   // 3466.4 space overhead
  row(1);
  await step(tok);                                   // 3486.0 insert 和 delete
  row(2);
  talk(g, 'array 要搬家', 'sad');
  await step(tok);                                   // 3503.8 例：在 C 的位置 insert
  const xs = (i) => -2.4 + i * 0.95;
  const arr = 'ABCDE'.split('').map((c, i) => cube(c, SAND, [0.8, 0.5, 0.8], xs(i), 0.3, 2.2));
  tag('array（示意）', 'idx', -4.2, 0.3, 2.2);
  for (let i = 4; i >= 2; i--) { lab.springTo(arr[i], V(xs(i + 1), 0.3, 2.2)); await go(tok, 260); }
  cube('X', '#f2c46d', [0.8, 0.5, 0.8], xs(2), 0.3, 2.2, 2.5);
  say('在 C 的位置插一個 node 進來（示意）', '後面整串資料都要 move');
  await step(tok);                                   // 3532.8 link：pointer assignment 就好
  lit(cellsL[2], GOLD);
  say('link 的 insert／delete 比較簡單', '只要 pointer assignment 就完成');
  talk(g, '改箭頭就好', 'happy');
  await step(tok);                                   // 3552.9 誰比較好？沒有絕對
  say('有沒有說誰比較好？', '三個層面各有好壞，沒有絕對標準');
  talk(g, '看需求', 'wow');
  await step(tok);                                   // 3580.3 建好不改用 array；常改用 linked
  tag('建好不再改 → array；常 insert／delete → linked', 'good', 0.6, 1.3, 2.2);
  say('建好後不再 insert／delete → 用 array', '常常 insert／delete → 不要用 array');
}]);

// 1:00:14 為什麼需要 traversal
FRAG.push(['treeb-why', '為什麼需要 tree traversal', async (tok) => {
  const g = stage([0, 5, 13.5], [0, 3.6, 0.8], [6.4, 2.8]);
  const O1 = { cx: -3.4, width: 4, topY: 6.4, minY: 3.4 }, O2 = { cx: 3.4, width: 4, topY: 6.4, minY: 3.4 };
  let t1, t2;
  const c1 = makeCursor(), c2 = makeCursor();
  await step(tok);                                   // 3613.7 binary tree traversal
  tag('Binary Tree Traversal', 'ptr alt', 0, 7.6);
  t1 = await dropTree(tok, 'A(B(D),C)', O1, 120);
  tag('T1', 'ptr alt', -6.0, 6.4);
  say('接下來：binary tree traversal', '');
  talk(g, 'traversal？', 'wow');
  await step(tok);                                   // 3627.6 拜訪每個 node，順便印出
  for (const n of preorder(t1)) { cursorTo(c1, n.pos); glow(n, GOLD); await go(tok, 380); }
  c1.obj.visible = false;
  say('就是去拜訪 tree 的每個 node', '順便把它印出來');
  await step(tok);                                   // 3654.1 兩棵 tree 一不一樣？
  allOff(t1);
  t2 = await dropTree(tok, 'A(B(,D),C)', O2, 120);
  tag('T2', 'ptr alt', 0.8, 6.4); tag('一樣嗎？', 'ptr', 0, 4.6);
  say('給你兩棵 binary tree：T1、T2', '問：這兩棵一不一樣？（示意）');
  await step(tok);                                   // 3673.8 人眼一看就知道；電腦呢？
  say('人眼一看就知道', '可是要怎麼讓很笨的電腦也能判斷？');
  talk(g, '電腦只會一步步比', 'wow');
  await step(tok);                                   // 3683.0 兩個 pointer 逐一往下檢查
  for (const l of ['A', 'B']) { cursorTo(c1, find(t1, l).pos); cursorTo(c2, find(t2, l).pos); glow(find(t1, l), GREEN); glow(find(t2, l), GREEN); await go(tok, 500); }
  const B1 = find(t1, 'B'), B2 = find(t2, 'B');
  cursorTo(c1, B1.left.pos); cursorTo(c2, B2.pos.clone().add(V(-0.6, -1.2, 0)));
  glow(B1.left, RED); ghost('#e06666', B2.pos.x - 0.6, B2.pos.y - 1.2, 0.7, 0.6, 0, 0.7);
  say('方法一：兩個 pointer 從第一個 node 一起往下比', 'A=A、B=B，B 的 left：D vs 空 → 不同');
  await step(tok);                                   // 3701.9 方法二：traversal → string
  c1.obj.visible = false; c2.obj.visible = false;
  rowLabel('pre', 2.0);
  rowOf(['A', 'B', 'D', 'C'], -3.4, 2.0); rowOf(['A', 'B', 'D', 'C'], 3.4, 2.0);
  say('方法二：traversal 把 tree 變成 string', 'preorder 都是 ABDC');
  await step(tok);                                   // 3709.8 string 比對
  rowLabel('in', 3.2);
  const i1 = rowOf(['D', 'B', 'A', 'C'], -3.4, 3.2), i2 = rowOf(['B', 'D', 'A', 'C'], 3.4, 3.2);
  [0, 1].forEach((k) => { lit(i1[k], RED); lit(i2[k], RED); });
  say('比對 string 就能判斷一不一樣', '補充：只比一種不夠，inorder DBAC ≠ BDAC');
  talk(g, '多比一種才保險', 'happy');
  await step(tok);                                   // 3731.8 目的：快速掌握 structure
  tag('traversal 的目的：快速掌握 tree 的 structure', 'good', 0, 1.2, 1.0);
  say('traversal 不是為了考試', '是為了快速掌握 tree 長什麼樣子');
}]);

// 1:02:27 L、V、R
FRAG.push(['treeb-lvr', 'L、V、R 三種動作與三種 traversal', async (tok) => {
  const g = stage([0, 5, 13.5], [0, 3.8, 0.6], [6.4, 2.8]);
  let l, d, r, rows;
  await step(tok);                                   // 3746.8 node 只有 data、left、right
  l = cube('left', BLU, [1.5, 0.8, 0.9], -1.7, 6.4, 0, 2.5); d = cube('data', GRN, [1.5, 0.8, 0.9], 0, 6.4, 0, 2.5); r = cube('right', PUR, [1.5, 0.8, 0.9], 1.7, 6.4, 0, 2.5);
  say('node 只有三個欄位：left、data、right', '所以走訪也有三個動作');
  await step(tok);                                   // 3767.8 L：先不印，往左走
  lit(l, GOLD); arrow(V(-2.2, 6.0, 0), V(-3.8, 4.9, 0), BLU); tag('L：先往左走', 'ptr', -4.6, 4.6);
  say('L：看到 node 先不印，往左邊走', '');
  talk(g, '左轉！');
  await step(tok);                                   // 3784.7 V：印出來
  lit(l); lit(d, GOLD); tag('V：印出 data', 'ptr alt', 0, 7.3);
  say('V（visit）：看到 node 就把資料印出來', '');
  talk(g, '印！', 'happy');
  await step(tok);                                   // 3796.9 R：往右走
  lit(d); lit(r, GOLD); arrow(V(2.2, 6.0, 0), V(3.8, 4.9, 0), PUR); tag('R：往右走', 'ptr', 4.6, 4.6);
  say('R：不往左、也不印，先往右邊走', '');
  talk(g, '右轉！');
  await step(tok);                                   // 3825.8 三個動作有幾種組合？六種
  lit(r);
  const perms = ['LVR', 'LRV', 'VLR', 'VRL', 'RVL', 'RLV'];
  const C = { L: BLU, V: GRN, R: PUR };
  rows = [];
  for (let k = 0; k < 6; k++) {
    const p = perms[k], cx = k < 3 ? -2.8 : 2.8, y = 3.4 - (k % 3) * 1.0;
    rows.push(p.split('').map((ch, j) => cube(ch, C[ch], [0.6, 0.5, 0.6], cx - 0.7 + j * 0.7, y, 1.2, 2.5)));
    await go(tok, 180);
  }
  say('三個動作排列：3! = 6 種', 'LVR LRV VLR VRL RVL RLV');
  talk(g, '六種？', 'wow');
  await step(tok);                                   // 3846.8 有幾種是倒過來 → 歸成三種
  rows.slice(3).forEach((row) => row.forEach((b) => lit(b, RED)));
  await go(tok, 500);
  rows.slice(3).forEach((row) => row.forEach(flyB));
  say('右邊三種只是左右對調', '實際上歸類成三種（都先左後右）');
  await step(tok);                                   // 3911.8 LVR → inorder
  rows[0].forEach((b) => lit(b, GOLD));
  tag('inorder', 'ptr alt', 0.6, 3.4, 1.2);
  say('LVR 對應到 inorder', '');
  await step(tok);                                   // 3923.8 LRV → postorder，VLR → preorder
  rows[0].forEach((b) => lit(b));
  rows[1].forEach((b) => lit(b, GOLD)); tag('postorder', 'ptr alt', 0.6, 2.4, 1.2);
  rows[2].forEach((b) => lit(b, GOLD)); tag('preorder', 'ptr alt', 0.6, 1.4, 1.2);
  say('LRV → postorder，VLR → preorder', 'V 的位置決定 pre／in／post');
  talk(g, 'V 在哪就叫什麼', 'happy');
}]);

// 1:05:38 運算式樹四種輸出
FRAG.push(['treeb-expr4', '運算式樹 A/B*C*D+E：四種 traversal', async (tok) => {
  const g = stage([0, 5.4, 13.5], [0, 3.2, 1.2], [6.4, 0.8]);
  let root;
  const cur = makeCursor();
  const runRow = async (k, nm, seq, tg) => {
    // rows stacked as shelves (y), not in depth: seen from the front, depth rows print over each other
    const z = 1.8, y = 0.3 + (3 - k) * 0.7;
    rowLabel(nm, z).position.y = y + 0.05;
    for (let i = 0; i < seq.length; i++) {
      const n = seq[i];
      cursorTo(cur, n.pos);
      const b = lab.addBody(block(n.label, SMALL, depthColor(n.depth)));
      b.obj.position.copy(n.pos); lab.springTo(b, V(ROW_X0 + i * ROW_DX, y, z));
      await go(tok, 200);
    }
    tag(tg, 'ptr alt', 2.0, y + 0.05, z);
  };
  await step(tok);                                   // 3946.4 以 A/B*C*D+E 為例
  tag('A / B * C * D + E', 'ptr alt', 0, 7.8);
  say('以 A/B*C*D+E 為例', 'stack 那章做過 infix 轉換和 evaluate');
  talk(g, '老朋友！', 'happy');
  await step(tok);                                   // 3979.8 用 tree 表示
  root = await dropTree(tok, 'expr', { topY: 6.8, minY: 3.4 }, 100);
  say('這個 expression 可以用 tree 表示', 'operator 在上，operand 在 leaf');
  await step(tok);                                   // 3989.8 藍色的是 null 指標
  for (const n of allNodes(root)) if (!n.left && !n.right) [-0.38, 0.38].forEach((dx) => cube('', BLU, [0.22, 0.22, 0.22], n.pos.x + dx, n.pos.y - 0.6, 0));
  say('leaf 底下藍色的小方塊', '代表指不下去的 null 指標');
  await step(tok);                                   // 4009.8 inorder → infix
  await runRow(0, 'in', inorder(root), 'infix');
  say('Inorder（LVR）→ infix', 'A / B * C * D + E');
  await step(tok);                                   // 4017.2 preorder → prefix
  await runRow(1, 'pre', preorder(root), 'prefix');
  say('Preorder（VLR）→ prefix', '+ * * / A B C D E');
  await step(tok);                                   // 4025.6 postorder → postfix
  await runRow(2, 'post', postorder(root), 'postfix');
  say('Postorder（LRV）→ postfix', 'A B / C * D * E +');
  talk(g, '就是 postfix！', 'wow');
  await step(tok);                                   // 4034.7 level order：從上面一層一層
  await runRow(3, 'level', levelorder(root), 'level');
  cur.obj.visible = false;
  say('Level order：從最上面一層一層輸出', '+ * E * D / C A B');
  talk(g, '同一棵樹，四種輸出', 'happy');
}]);

// 遞迴走訪程式：三行 L／V／R
const RLINE = (nm) => ({ L: '    ' + nm + '(cur->leftChild);   // L', V: '    cout << cur->data;      // V', R: '    ' + nm + '(cur->rightChild);  // R' });
const RORD = { in: ['L', 'V', 'R'], pre: ['V', 'L', 'R'], post: ['L', 'R', 'V'] };
const RNAME = { in: 'Inorder', pre: 'Preorder', post: 'Postorder' };
function recLines(kind, nm = RNAME[kind]) { const T = RLINE(nm); return padL(['void Tree::' + nm + '() { ' + nm + '(root); }', 'void Tree::' + nm + '(TreeNode *cur) {', '  if (cur) {', ...RORD[kind].map((a) => T[a]), '  }', '}'].map((s) => s + '  ')); }
function recSetup(kind) {
  const cd = code(recLines(kind), -3.4, 7.2, 0.5);
  const root = showTree('expr', { cx: 3.6, width: 6.2, topY: 6.6, minY: 2.8, maxSp: 0.85 });
  rowLabel('輸出', 2.6);
  return { cd, root, cur: makeCursor(), out: [] };
}
function recRename(cd, kind, nm) { recLines(kind, nm).forEach((s, i) => setTag(cd.ls[i], s)); }
async function recRun(tok, S, order, ms = 200) {
  for (const n of order) {
    cursorTo(S.cur, n.pos); glow(n, GOLD);
    const b = lab.addBody(block(n.label, SMALL, depthColor(n.depth)));
    b.obj.position.copy(n.pos); lab.springTo(b, rowPos(S.out.length, 2.6)); S.out.push(n.label);
    await go(tok, ms);
  }
}

// 1:07:55 遞迴 Inorder 程式
FRAG.push(['treeb-recin', '遞迴 Inorder 程式：L、V、R 三行', async (tok) => {
  const g = stage([0, 5.2, 13.5], [0, 3.6, 1], [6.6, 2.6]);
  let S;
  await step(tok);                                   // 4074.5 程式怎麼寫
  S = recSetup('in');
  say('怎麼對 tree 做 inorder？程式長這樣', '');
  await step(tok);                                   // 4090.8 procedure Inorder(root)
  S.cd.hl(0);
  say('寫一個 procedure 叫 Inorder', '把 Tree 的 private member root 傳進去');
  await step(tok);                                   // 4130.8 它是 recursive
  S.cd.hl(1);
  tag('自己呼叫自己 → recursive', 'note', -3.4, 3.6);
  say('Inorder 裡面又呼叫 Inorder', '是一個 recursive function');
  talk(g, '自己叫自己', 'wow');
  await step(tok);                                   // 4152.4 一定要會停止
  tag('一定要會停：不能無限迴圈', 'bad', -3.4, 3.0);
  say('recursive function 一定要會停止', '不能一直跑下去');
  await step(tok);                                   // 4173.8 current node 不是 null 才做
  S.cd.hl(2);
  say('if (cur)：cur 不是 null 才往下做', '是 null 就直接 return → 這就是停止條件');
  talk(g, '空的就停', 'happy');
  await step(tok);                                   // 4195.6 三行 = L V R
  [3, 4, 5].forEach((i, k) => tag(['L', 'V', 'R'][k], 'ptr alt', 0.2, 7.2 - i * 0.5));
  say('這三行分別是 L、V、R', '往左、印出、往右');
  await step(tok);                                   // 4212.9 左邊有 child 就一直往左
  S.cd.hl(3);
  for (const n of [S.root, S.root.left, S.root.left.left, S.root.left.left.left, S.root.left.left.left.left]) { cursorTo(S.cur, n.pos); await go(tok, 380); }
  say('左邊有 child 就一直往左走', '+ → * → * → / → A');
  talk(g, '一路往左', 'wow');
  await step(tok);                                   // 4258.6 走到 null → 跳回來印出（V）
  const A = S.root.left.left.left.left;
  const gh = ghost('#e06666', A.pos.x - 0.4, A.pos.y - 0.8, 0.4, 0.35, 0, 0.4);
  await go(tok, 500); kill(gh);
  S.cd.hl(4);
  await recRun(tok, S, [A]);
  say('A 的左邊是 null → 跳回來', 'V：印出 A');
  await step(tok);                                   // 4286.2 再往右邊走（R）
  S.cd.hl(5);
  const gh2 = ghost('#e06666', A.pos.x + 0.4, A.pos.y - 0.8, 0.4, 0.35, 0, 0.4);
  await go(tok, 500); kill(gh2);
  say('印完往右走（R）：右邊也是 null', '右邊如果有 node，也一樣先往它的左邊走');
  await step(tok);                                   // 4314.7 所有 node 拜訪完才停止
  await recRun(tok, S, inorder(S.root).slice(1), 220);
  S.cd.hl(-1); S.cur.obj.visible = false;
  say('所有 node 都拜訪過就停止', 'inorder：A / B * C * D + E');
  talk(g, 'LVR 記住了', 'happy');
}]);

// 1:12:37 追蹤 inorder 的遞迴呼叫
FRAG.push(['treeb-trace', '追蹤 Inorder 的遞迴呼叫', async (tok) => {
  const g = stage([0, 5, 13.5], [0, 3.4, 0.8], [6.4, 2.8]);
  const root = showTree('expr', { topY: 6.6, minY: 2.8 });
  rowLabel('輸出', 2.4);
  const cur = makeCursor();
  const stackT = tag('', 'ptr', 0, 7.7); Object.assign(stackT.element.style, MONO);
  const calls = [];
  const out = [];
  const showCalls = () => setTag(stackT, '呼叫中：' + (calls.join(' → ') || '—'));
  let k = 0;
  const call = async (n, label) => { k++; calls.push(label || n.label); showCalls(); if (n) { cursorTo(cur, n.pos); glow(n, GOLD); } const t = tag('#' + k, 'ptr alt', n ? n.pos.x - 0.75 : 0, n ? n.pos.y + 0.55 : 0, 0.3); if (!n) hide(t, false); await go(tok, 300); };
  const print = (n) => { const b = lab.addBody(block(n.label, SMALL, depthColor(n.depth))); b.obj.position.copy(n.pos); lab.springTo(b, rowPos(out.length, 2.4)); out.push(n.label); glow(n, GREEN); };
  const [m1, m2, d, A] = [root.left, root.left.left, root.left.left.left, root.left.left.left.left];
  showCalls();
  await step(tok);                                   // 4356.8 trace 給你看
  say('一步一步 trace 遞迴呼叫', '#k = 第 k 次呼叫 Inorder');
  talk(g, '跟著走！', 'wow');
  await step(tok);                                   // 4392.4 第一個 call：+
  await call(root);
  say('第 1 次呼叫：root「+」', '+ 不是 null → 先往左（L）');
  await step(tok);                                   // 4430.6 left child 是 * → 第 2 次
  await call(m1);
  say('+ 的 left child 是 *，不是空的', '第 2 次呼叫');
  await step(tok);                                   // 4459.8 第 3 次：下層的 *
  await call(m2);
  say('* 的 left child 還是 *', '第 3 次呼叫');
  await step(tok);                                   // 4472.2 / → 第 4 次
  await call(d);
  say('再往左是 /', '第 4 次呼叫');
  await step(tok);                                   // 4487.8 A → 第 5 次
  await call(A);
  say('/ 的 left child 是 A', '第 5 次呼叫');
  await step(tok);                                   // 4497.0 第 6 次：null
  const nl = ghost('#e06666', A.pos.x - 0.4, A.pos.y - 0.8, 0.4, 0.35, 0, 0.4);
  await call(null, 'null');
  say('A 的 left 是 null：第 6 次呼叫', '發現是空的 → return');
  talk(g, '空的！回頭', 'sad');
  await step(tok);                                   // 4507.8 return 回來 cout A
  kill(nl); calls.pop(); showCalls();
  print(A);
  say('return 回到 A：cout 印出 A', '輸出：A');
  talk(g, '印出 A', 'happy');
  await step(tok);                                   // 4522.6 往右邊走：又是 null
  const nr = ghost('#e06666', A.pos.x + 0.4, A.pos.y - 0.8, 0.4, 0.35, 0, 0.4);
  await call(null, 'null');
  await go(tok, 300);
  kill(nr); calls.pop(); calls.pop(); showCalls(); cursorTo(cur, d.pos);
  say('A 往右走：第 7 次呼叫，也是 null', 'back 回去，A 這次呼叫結束');
  await step(tok);                                   // 4541.8 回到 /，印出 /
  print(d);
  say('回到 /：它的左子樹做完了', '印出 /（第 4 次呼叫的 V）');
  await step(tok);                                   // 4569.1 盡量往左，走不下去就印，再往右
  for (const n of inorder(root).slice(2)) { cursorTo(cur, n.pos); print(n); await go(tok, 260); }
  calls.length = 0; showCalls();
  say('盡量往左；走不下去就印，再檢查右邊', '依此遞迴下去');
  await step(tok);                                   // 4598.2 一定要會
  cur.obj.visible = false;
  say('inorder 一定要會', '輸出：A / B * C * D + E');
  talk(g, '我會了！', 'happy');
  await g.hop(tok);
}]);

// 1:16:49 Preorder 程式
FRAG.push(['treeb-pre', 'Preorder 程式（VLR）', async (tok) => {
  const g = stage([0, 5.2, 13.5], [0, 3.6, 1], [6.6, 2.6]);
  const S = recSetup('in');
  await step(tok);                                   // 4608.8 會寫 inorder，preorder 只要 copy
  say('會寫 inorder，preorder 就簡單了', '程式 copy 一份，改一下');
  talk(g, 'copy paste！', 'happy');
  await step(tok);                                   // 4626.8 改名 Preorder
  recRename(S.cd, 'in', 'Preorder');
  S.cd.hl(1);
  say('procedure 改名叫 Preorder', '');
  await step(tok);                                   // 4630.8 最重要的是這三行
  S.cd.hl(4);
  [3, 4, 5].forEach((i) => tag('←', 'ptr alt', 0.6, 7.2 - i * 0.5));
  say('最重要的是這三行的順序', '');
  await step(tok);                                   // 4636.3 先印、再左、再右 → VLR
  recRename(S.cd, 'pre');
  S.cd.hl(3);
  say('preorder：先把值印出來，再往左、再往右', 'V L R');
  talk(g, 'V 搬到最前面', 'wow');
  await step(tok);                                   // 4647.8 三行：V、L、R
  await recRun(tok, S, preorder(S.root), 220);
  S.cd.hl(-1); S.cur.obj.visible = false;
  say('照 V L R 跑一次', 'preorder：+ * * / A B C D E');
}]);

// 1:17:46 Postorder 程式
FRAG.push(['treeb-post', 'Postorder 程式（LRV）', async (tok) => {
  const g = stage([0, 5.2, 13.5], [0, 3.6, 1], [6.6, 2.6]);
  const S = recSetup('pre');
  await step(tok);                                   // 4666.5 copy paste，改成 Postorder
  recRename(S.cd, 'pre', 'Postorder');
  S.cd.hl(1);
  say('postorder 也一樣：copy 一下改名', 'Preorder → Postorder');
  await step(tok);                                   // 4674.5 post = 最後才印
  recRename(S.cd, 'post');
  S.cd.hl(5);
  say('post 就是「最後」才印出來', 'cout 搬到最後一行');
  talk(g, 'V 搬到最後', 'wow');
  await step(tok);                                   // 4685.8 三行：L、R、V
  await recRun(tok, S, postorder(S.root), 220);
  S.cd.hl(-1); S.cur.obj.visible = false;
  say('三行依序是 L、R、V', 'postorder：A B / C * D * E +');
  await step(tok);                                   // 4720.0 都是 recursive function，很簡單
  tag('三種 traversal = 同一個 recursive 程式，只換 cout 的位置', 'good', 0, 1.4, 1.2);
  say('三種 traversal 都用 recursive function', '程式寫起來很簡單');
  talk(g, '送分題！', 'happy');
}]);

// 1:18:45 非遞迴 Inorder：stack
FRAG.push(['treeb-iter', '非遞迴 Inorder：用 stack', async (tok) => {
  const g = stage([0, 5.2, 13.5], [0, 3.6, 1], [6.6, 3.4]);
  let cd, root, c;
  const st = [], out = [];
  const push = (n) => { const b = lab.addBody(block(n.label, SMALL, depthColor(n.depth))); b.obj.position.copy(n.pos); lab.springTo(b, rowPos(st.length, 2.2)); st.push({ n, b }); cursorTo(c, n.pos); };
  const pop = () => { const { n, b } = st.pop(); cursorTo(c, n.pos); lab.springTo(b, rowPos(out.length, 3.4)); out.push(n.label); glow(n, GOLD); return n; };
  await step(tok);                                   // 4724.8 不用遞迴：用 stack
  cd = code(['void Tree::NonrecInorder() {', '  Stack<TreeNode*> s; cur = root;', '  while (1) {', '    while (cur) { s.Push(cur);', '      cur = cur->leftChild; }', '    if (s.IsEmpty()) return;', '    cur = s.Top(); s.Pop();', '    cout << cur->data;', '    cur = cur->rightChild;', '  }', '}'], -3.5, 7.4, 0.45);
  root = showTree('expr', { cx: 3.6, width: 6.2, topY: 6.6, minY: 2.8, maxSp: 0.85 });
  rowLabel('stack', 2.2); rowLabel('輸出', 3.4);
  tag('底 → 頂', 'idx', -5.6, 0.95, 2.2);
  c = makeCursor();
  say('不想用 recursive？改用 stack', '');
  await step(tok);                                   // 4742.8 stack：last in first out
  tag('stack：last in, first out', 'note', -1.8, 1.3, 2.2);
  say('stack 的特性：last in first out', '最後放進去的最先拿出來');
  await step(tok);                                   // 4753.8 左邊有東西 → 自己先放進 stack
  cd.hl(3);
  say('inorder：左邊還有東西就先往左', '所以自己這個 node 要先放進 stack 記著');
  talk(g, '先記下來', 'happy');
  await step(tok);                                   // 4781.8 一開始 cur = root
  cd.hl(1); cursorTo(c, root.pos);
  say('一開始 cur = root', '');
  await step(tok);                                   // 4803.8 cur 不是空的 → push
  cd.hl(3); push(root);
  say('cur 不是空的：把它 push 進 stack', 'stack：+');
  await step(tok);                                   // 4815.8 往左走，直到走不下去
  cd.hl(4);
  for (let n = root.left; n; n = n.left) { push(n); await go(tok, 380); }
  say('cur = cur->leftChild：一路往左、一路 push', 'stack：+ * * / A');
  talk(g, '疊起來了', 'wow');
  await step(tok);                                   // 4842.8 跳出內層 while，檢查 stack 空嗎
  cd.hl(5);
  say('A 的左邊是 null：跳出內層 while', '檢查 stack 是不是空的 → 不是');
  await step(tok);                                   // 4853.2 pop 出最後放進去的 → 印出
  cd.hl(6); const a = pop(); cd.hl(7);
  say('pop 出最後放進去的 ' + a.label + '，印出來', '輸出：A');
  talk(g, '印出 A', 'happy');
  await step(tok);                                   // 4875.8 cur 改成 rightChild
  cd.hl(8);
  say('cur = A 的 rightChild', '= null，回到外層迴圈');
  await step(tok);                                   // 4899.8 往右邊走：右邊也從 left 一路往下
  let cur = null;
  for (;;) {
    while (cur) { cd.hl(3); push(cur); await go(tok, 160); cur = cur.left; }
    if (!st.length) break;
    cd.hl(7); const n = pop(); await go(tok, 160);
    cur = n.right;
  }
  cd.hl(5); c.obj.visible = false;
  say('之後一樣：右邊的 child 再一路往左', '輸出：A / B * C * D + E（和遞迴版相同）');
  await step(tok);                                   // 4939.2 preorder、postorder 不用遞迴？
  cd.hl(-1);
  tag('作業思考：非遞迴的 preorder、postorder？', 'note', 0, 0.6, 1.0);
  say('那 preorder、postorder 不用遞迴怎麼寫？', '請回去想一想');
  talk(g, '想想看…', 'wow');
}]);

// 1:22:51 Level order：用 queue
FRAG.push(['treeb-level', 'Level order：用 queue', async (tok) => {
  const g = stage([0, 5.2, 13.5], [0, 3.1, 1], [6.6, 2.8]);
  const QZ = 3.8, OZ = 2.3;
  let root, cur;
  const q = [], outs = [];
  const enq = (n) => { const b = lab.addBody(block(n.label, SMALL, depthColor(n.depth))); b.obj.position.copy(n.pos); lab.springTo(b, rowPos(q.length, QZ)); q.push({ n, b }); };
  const out = (e) => { lab.springTo(e.b, rowPos(outs.length, OZ)); outs.push(e.n); cursorTo(cur, e.n.pos); glow(e.n, GOLD); q.forEach((x, k) => lab.springTo(x.b, rowPos(k, QZ))); };
  const deq = () => { const e = q.shift(); out(e); return e.n; };
  await step(tok);                                   // 4970.8 level order
  root = showTree('expr', { topY: 6.6, minY: 2.8 });
  cur = makeCursor();
  rowLabel('Queue', QZ); rowLabel('輸出', OZ);
  say('Level order：從上到下、由左到右', '剛才 pre／post 非遞迴用 stack');
  await step(tok);                                   // 4993.4 level order 用 queue
  tag('level order → 用 Queue', 'ptr alt', -2.2, 1.2, QZ);
  say('level order 要 implement 的話', '直接用 Queue');
  talk(g, '排隊！', 'happy');
  await step(tok);                                   // 5009.9 一開始看到 + 就印出
  const rb = lab.addBody(block(root.label, SMALL, depthColor(0))); rb.obj.position.copy(root.pos);
  out({ n: root, b: rb });
  say('一開始看到 +，就把它印出來', '輸出：+');
  await step(tok);                                   // 5017.2 * 和 E 放進 queue
  enq(root.left); await go(tok, 300); enq(root.right);
  say('+ 下面兩個 child：* 和 E', '放進 Queue');
  await step(tok);                                   // 5023.8 queue：first in first out
  tag('front', 'idx', ROW_X0, 0.95, QZ);
  say('Queue 的特性：first in, first out', '先進去的 * 會先出來');
  await step(tok);                                   // 5033.8 * 抓出來，它的 * 和 D 放進 queue
  const m = deq(); await go(tok, 300);
  enq(m.left); await go(tok, 250); enq(m.right);
  say('* 被抓出來印出', '它下面的 * 和 D 丟進 Queue → E * D');
  await step(tok);                                   // 5049.8 E 出來，沒東西放進去
  deq();
  say('接著 E 出來印出', 'E 下面沒有 child，不用放東西');
  talk(g, 'E 沒孩子', 'happy');
  await step(tok);                                   // 5068.8 有 child 就丟進 queue……
  while (q.length) { const n = deq(); await go(tok, 220); for (const k of [n.left, n.right]) if (k) { enq(k); await go(tok, 150); } }
  say('反正就是：有 child 就丟進 Queue', '再從 Queue 抓出來印出');
  await step(tok);                                   // 5093.8 queue 空了就結束
  cur.obj.visible = false;
  say('直到 Queue 是空的就結束', 'level order：+ * E * D / C A B');
  talk(g, '一層一層 ✓', 'happy');
}]);

// 1:25:17 traversal 的應用：比較、複製（下次續講）
FRAG.push(['treeb-apps', 'Traversal 的應用：判斷相同與複製', async (tok) => {
  const g = stage([0, 5, 13.5], [0, 3.6, 0.8], [6.4, 2.8]);
  const O1 = { cx: -3.4, width: 4, topY: 6.4, minY: 3.4 }, O2 = { cx: 3.4, width: 4, topY: 6.4, minY: 3.4 };
  const src = 'A(B(D,E),C(,F))';
  let t1, t2;
  await step(tok);                                   // 5124.6 有了 in／pre／post order
  t1 = await dropTree(tok, src, O1, 100);
  tag('T1', 'ptr alt', -6.0, 6.4);
  say('有了 inorder、preorder、postorder', '可以拿來做什麼？（示意樹）');
  await step(tok);                                   // 5130.8 比較兩棵 tree 是不是一模一樣
  t2 = await dropTree(tok, src, O2, 80);
  tag('T2', 'ptr alt', 0.8, 6.4);
  const c1 = makeCursor(), c2 = makeCursor();
  const p1 = preorder(t1), p2 = preorder(t2);
  for (let k = 0; k < p1.length; k++) { cursorTo(c1, p1[k].pos); cursorTo(c2, p2[k].pos); glow(p1[k], GREEN); glow(p2[k], GREEN); await go(tok, 200); }
  say('同時 traverse 兩棵，逐一比較', '全部相同 → 一模一樣');
  talk(g, '一模一樣 ✓', 'happy');
  await step(tok);                                   // 5136.8 copy：給 T1 複製出 T2
  c2.obj.visible = false;
  allNodes(t2).forEach((n) => flyB(n.body));
  await go(tok, 300);
  const t3 = makeTree(src); layoutTree(t3, Object.assign({}, TREE_O, O2));
  edgeLines(() => treePairs(t3));
  const p3 = preorder(t3);
  for (let k = 0; k < p1.length; k++) { cursorTo(c1, p1[k].pos); const b = nodeBody(p3[k]); b.obj.position.copy(p3[k].pos).add(V(0, 3, 0)); lab.dropTo(b, p3[k].pos.clone()); await go(tok, 220); }
  c1.obj.visible = false;
  say('也可以 copy：走訪 T1，邊走邊建出 T2', '');
  talk(g, '複製一棵！', 'wow');
  await step(tok);                                   // 5153.1 下次再講
  tag('Equal、Copy：下一講細講', 'note', 0, 1.4, 1.0);
  say('比較（Equal）和複製（Copy）', '這部分下次再講');
}]);

// ═════════════════ UO0B1SQOAgk：Lec13 Trees (2/6) ═════════════════

// 0:39 回顧 inorder：運算式樹逐步追蹤
FRAG.push(['treeb2-inrev', '中序走訪回顧：運算式樹逐步追蹤', async (tok) => {
  const g = stage([0, 5, 13.5], [0, 3.4, 0.8], [6.4, 2.8]);
  const root = showTree('expr', { topY: 6.6, minY: 2.8 });
  rowLabel('輸出', 2.4);
  const cur = makeCursor();
  const out = [];
  const print = (n) => { const b = lab.addBody(block(n.label, SMALL, depthColor(n.depth))); b.obj.position.copy(n.pos); lab.springTo(b, rowPos(out.length, 2.4)); out.push(n.label); glow(n, GREEN); };
  const nul = async (n, side) => { const gh = ghost('#e06666', n.pos.x + side * 0.4, n.pos.y - 0.8, 0.4, 0.35, 0, 0.4); await go(tok, 600); kill(gh); };
  const [m1, m2, d] = [root.left, root.left.left, root.left.left.left];
  const A = d.left, B = d.right;
  await step(tok);                                   // 38.8 三種：in、post、pre
  tag('LVR = inorder｜VLR = preorder｜LRV = postorder', 'ptr', 0, 7.6);
  say('三個動作 L、V、R → 三種走訪', '先左後右：inorder、preorder、postorder');
  talk(g, '複習一下', 'happy');
  await step(tok);                                   // 60.8 inorder = LVR，給一個 root
  cursorTo(cur, root.pos);
  say('inorder 是 L V R', '給你一個 root「+」');
  await step(tok);                                   // 68.8 往左走，走到不能走
  for (const n of [m1, m2, d, A]) { cursorTo(cur, n.pos); await go(tok, 380); }
  say('L：一直往左走，走到不能再走為止', '+ → * → * → / → A');
  await step(tok);                                   // 80.8 遇到 null 走不下去
  await nul(A, -1);
  say('A 的左邊是 null（藍色的空指標）', '走不下去了');
  talk(g, '撞牆了', 'wow');
  await step(tok);                                   // 90.8 做 V：印出 A
  print(A);
  say('接著做 V：把 A 印出來', '輸出：A');
  await step(tok);                                   // 105.5 第三個動作：往右走
  await nul(A, 1);
  say('再做 R：往右走', '右邊也是 null，走不下去');
  await step(tok);                                   // 121.5 return 到上一層（/）
  cursorTo(cur, d.pos);
  say('A 做完了 → return 到上一層', '是誰呼叫 A 的？是 /');
  await step(tok);                                   // 161.8 V：印出 /
  print(d);
  say('/ 的左子樹拜訪完了 → 印出 /', '輸出：A /');
  await step(tok);                                   // 170.6 R：往右走到 B
  cursorTo(cur, B.pos);
  say('/ 往右走：看到 B', 'B 也先往左走');
  await step(tok);                                   // 185.8 左邊空 → 回來印出 B
  await nul(B, -1);
  print(B);
  say('B 的左邊是空的 → 回來印出 B', '輸出：A / B');
  await step(tok);                                   // 201.8 / 的左右子樹都拜訪完
  await nul(B, 1);
  cursorTo(cur, d.pos);
  ghost('#2fc092', d.pos.x, d.pos.y - 0.7, 2.0, 2.0, 0, 0.6);
  say('B 的右邊也是 null → 回到 /', '/ 的左、右子樹都拜訪完了');
  await step(tok);                                   // 224.8 return 給呼叫它的 *
  cursorTo(cur, m2.pos);
  say('/ return 給呼叫它的「*」', '這就是 recursive 的概念');
  talk(g, '一層層回去', 'happy');
  await step(tok);                                   // 235.8 印出 *，依此類推
  for (const n of inorder(root).slice(3)) { cursorTo(cur, n.pos); print(n); await go(tok, 280); }
  cur.obj.visible = false;
  say('印出 *，再依此類推', 'inorder：A / B * C * D + E');
  await step(tok);                                   // 246.8 preorder VLR、postorder LRV、level order
  tag('preorder：+ * * / A B C D E', 'ptr alt', -2.6, 1.3, 1.2);
  tag('postorder：A B / C * D * E +', 'ptr alt', 2.8, 1.3, 1.2);
  say('preorder 是 VLR，postorder 是 LRV', 'level order：一層一層往下');
}]);

// 4:24 三種走訪的遞迴程式碼
const TCODE = {
  in: ['void Inorder(TreeNode* cur) {', '  if (cur) {', '    Inorder(cur->leftChild);   // L', '    cout << cur->data;         // V', '    Inorder(cur->rightChild);  // R', '  }', '}'],
  pre: ['void Preorder(TreeNode* cur) {', '  if (cur) {', '    cout << cur->data;         // V', '    Preorder(cur->leftChild);  // L', '    Preorder(cur->rightChild); // R', '  }', '}'],
  post: ['void Postorder(TreeNode* cur) {', '  if (cur) {', '    Postorder(cur->leftChild);  // L', '    Postorder(cur->rightChild); // R', '    cout << cur->data;          // V', '  }', '}'],
};
FRAG.push(['treeb2-code', '三種走訪的遞迴程式碼', async (tok) => {
  const g = stage([0, 4.8, 13.5], [0, 3.9, 0], [6.6, 2.6]);
  const w = Math.max(...Object.values(TCODE).flat().map((s) => s.length));
  let cls, cd, root, cur;
  let outs = [];
  const run = async (k) => {
    outs.forEach((b) => lab.flyAway(b, V(0, 8, 4))); outs = []; allOff(root);
    const order = { in: inorder, pre: preorder, post: postorder }[k](root);
    for (let i = 0; i < order.length; i++) { const n = order[i]; cursorTo(cur, n.pos); glow(n, GOLD); outs.push(emit(n, V(1.2 + i * 0.6, 0.35, 2.2))); await go(tok, 220); }
  };
  await step(tok);                                   // 263.8 inorder 是 tree 的 member function
  cls = code(['class Tree {', '  TreeNode* root;', '};'], -3.8, 7.6, 0.45);
  root = showTree('expr', { cx: 3.7, width: 5.6, topY: 6.6, minY: 2.6, maxSp: 0.7 });
  tag('輸出', 'ptr', 0.5, 0.35, 2.2);
  cur = makeCursor();
  say('實作很簡單：一段 recursive code', 'inorder 是 Tree 的 member function');
  await step(tok);                                   // 278.8 class Tree 只有一個 pointer：root
  cls.hl(1);
  say('class Tree 裡面只有一個 pointer', '就是 root');
  talk(g, '只有 root', 'happy');
  await step(tok);                                   // 289.8 自己呼叫自己；三行指令
  cls.hl(-1);
  cd = code(TCODE.in.map((s) => s.padEnd(w, ' ')), -3.8, 5.8, 0.5);
  cd.hl(1);
  say('丟進來的 node 叫 current node', '照著三行指令的順序做');
  await step(tok);                                   // 305.9 有值就呼叫 Inorder 拜訪左子樹（L）
  cd.hl(2);
  for (const n of [root, root.left, root.left.left, root.left.left.left, root.left.left.left.left]) { cursorTo(cur, n.pos); await go(tok, 300); }
  say('cur 有值：呼叫 Inorder 拜訪左子樹', '這就是 L');
  await step(tok);                                   // 320.8 印出自己，再 R
  cd.hl(3);
  await run('in');
  say('呼叫到不能呼叫，就印出自己的值，再做 R', 'inorder：A / B * C * D + E');
  await step(tok);                                   // 330.8 改 preorder：三行順序置換
  TCODE.pre.forEach((s, i) => setTag(cd.ls[i], s.padEnd(w, ' ')));
  cd.hl(2);
  say('改成 preorder：只要把三行順序換一下', 'cout 變成第一行');
  talk(g, '換位置就好', 'wow');
  await step(tok);                                   // 340.5 先印，再左、右子樹
  await run('pre');
  say('preorder：先印出來，再左、再右', '+ * * / A B C D E');
  await step(tok);                                   // 374.8 postorder 也一樣
  TCODE.post.forEach((s, i) => setTag(cd.ls[i], s.padEnd(w, ' ')));
  cd.hl(4);
  await run('post');
  cur.obj.visible = false;
  say('postorder 也一樣：cout 放最後', 'A B / C * D * E +');
  talk(g, '真的很簡單', 'happy');
}]);

// 6:29 非遞迴 inorder：stack
FRAG.push(['treeb2-iter', '非遞迴 Inorder：用 stack', async (tok) => {
  const g = stage([0, 4.8, 13.5], [0, 3.6, 0.6], [6.6, 3.0]);
  const root = showTree('expr', { cx: -1.6, width: 7.4, topY: 6.8, minY: 2.6, maxSp: 0.92 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 1.0), new THREE.MeshStandardMaterial({ color: '#7a6a52' }));
  base.position.set(5.0, 0.04, 0); lab.world.add(base);
  tag('輸出', 'ptr', -6.3, 0.35, 2.4);
  const cur = makeCursor();
  const stack = [], out = [];
  const push = (n) => { cursorTo(cur, n.pos); stack.push({ n, b: emit(n, V(5.0, 0.35 + stack.length * 0.5, 0), SMALL) }); };
  const pop = () => { const { n, b } = stack.pop(); cursorTo(cur, n.pos); glow(n, GOLD); lab.springTo(b, V(-5.4 + out.length * 0.7, 0.35, 2.4)); out.push(n.label); return n; };
  await step(tok);                                   // 389.0 不要 recursive code 的話
  say('如果不要用 recursive code 呢？', '');
  talk(g, '那怎麼辦？', 'wow');
  await step(tok);                                   // 392.8 用一個 stack 存放
  tag('Stack', 'ptr alt', 5.0, 4.2);
  say('就要自己用一個 stack 來存放 node', '');
  await step(tok);                                   // 410.8 左邊還有 node → push
  for (let n = root; n; n = n.left) { push(n); await go(tok, 380); }
  say('往左走：看到左邊還有 node，先不印', '把自己 push 進 stack');
  talk(g, '先疊著', 'happy');
  await step(tok);                                   // 417.8 走不下去 → pop 出來印出
  pop();
  say('走不下去了：pop 出來，把資料印出來', '輸出：A');
  await step(tok);                                   // 426.8 印完往右邊走
  let c = null;
  for (;;) {
    while (c) { push(c); await go(tok, 160); c = c.left; }
    if (!stack.length) break;
    const n = pop(); await go(tok, 170); c = n.right;
  }
  cur.obj.visible = false;
  say('印完往右走，重複同樣的動作', 'A / B * C * D + E（和遞迴版相同）');
}]);

// 7:18 Level order：queue
const LCODE = ['void LevelOrder() {', '  Queue<TreeNode*> q;', '  TreeNode* cur = root;', '  while (cur) {', '    cout << cur->data;', '    if (cur->leftChild)', '      q.Push(cur->leftChild);', '    if (cur->rightChild)', '      q.Push(cur->rightChild);', '    if (q.IsEmpty()) return;', '    cur = q.Front(); q.Pop();', '  }', '}'];
FRAG.push(['treeb2-levelq', 'Level order：用 Queue', async (tok) => {
  const g = stage([0, 4.8, 13.5], [0, 3.6, 0.8], [6.6, 3.4]);
  const w = Math.max(...LCODE.map((s) => s.length)) + 2;
  let cd, root, cur;
  const q = [], out = [];
  const qPos = (i) => V(1.3 + i * 0.62, 0.35, 2.0), oPos = (i) => V(1.3 + i * 0.62, 0.35, 3.3);
  const restack = () => q.forEach((e, i) => lab.springTo(e.b, qPos(i)));
  const enq = (n) => q.push({ n, b: emit(n, qPos(q.length)) });
  const visit = (e) => { cursorTo(cur, e.n.pos); glow(e.n, GOLD); lab.springTo(e.b, oPos(out.length)); out.push(e.n); };
  const deq = () => { const e = q.shift(); restack(); visit(e); return e.n; };
  await step(tok);                                   // 438.0 level order 用 queue 的架構
  cd = code(LCODE.map((s) => s.padEnd(w, ' ')), -4.0, 7.6, 0.47);
  root = showTree('expr', { cx: 3.4, width: 5.8, topY: 7.0, minY: 3.4, maxSp: 0.72 });
  tag('queue', 'ptr', 0.2, 0.35, 2.0); tag('輸出', 'ptr', 0.2, 0.35, 3.3);
  cur = makeCursor();
  say('Level order 用 queue 的架構', '程式只要幾行');
  await step(tok);                                   // 452.8 一開始 cur = root
  cd.hl(2); cursorTo(cur, root.pos);
  say('一開始 current node 就是 root', 'cur = +');
  await step(tok);                                   // 457.8 不是空的 → cout
  cd.hl(4);
  visit({ n: root, b: emit(root, oPos(0)) });
  say('cur 不是空的：把值印出來（cout）', '輸出：+');
  await step(tok);                                   // 469.8 left child 有值 → 放進 queue
  cd.hl(6); enq(root.left);
  say('它的 left child 有值 → 加到 queue', 'queue：*');
  await step(tok);                                   // 493.8 再看 right child
  cd.hl(8); enq(root.right);
  say('先看左邊、再看右邊', 'queue：* E');
  talk(g, '先左後右', 'happy');
  await step(tok);                                   // 507.5 可不可以顛倒？
  tag('先放右邊可以嗎？', 'note', 3.4, 2.4);
  say('這兩個 if 可以顛倒嗎？', '');
  talk(g, '可以嗎？', 'wow');
  await step(tok);                                   // 520.8 不行：queue 是 FIFO → 變成由右到左
  tag('✗ 會變成 + E * D * C / B A（由右到左）', 'bad', 3.4, 1.7);
  say('不行！queue 是 first in first out', '先放右邊 → level order 變成由右到左');
  talk(g, '順序會反', 'sad');
  await step(tok);                                   // 546.8 取出 queue 第一個當下一個 cur
  cd.hl(10);
  say('左右都放進 queue 後', '把 queue 的第一個抓出來當下一個 cur');
  await step(tok);                                   // 561.8 例子：cur 是 +，queue 有 * 和 E
  glow(q[0].n, GREEN); glow(q[1].n, GREEN);
  say('例子：第一個 cur 是 +', 'queue 裡有 * 和 E');
  await step(tok);                                   // 570.8 * 丟出來
  glow(root.right, OFF);
  cd.hl(4); const m = deq();
  say('queue 第一個元素是 *：丟出來印出', '輸出：+ *');
  await step(tok);                                   // 578.1 * 下面的 * 和 D 放進 queue
  cd.hl(6); enq(m.left); await go(tok, 250); cd.hl(8); enq(m.right);
  say('* 下面的 * 和 D 放進 queue', '');
  await step(tok);                                   // 585.8 queue 順序：E、*、D
  tag('front', 'idx', qPos(0).x, 0.95, 2.0);
  say('queue 的順序：E、*、D', '（字幕把 D 聽成 B）');
  await step(tok);                                   // 600.8 E 出來，沒有 child
  cd.hl(4); deq();
  say('取出 E 印出', 'E 沒有 left、right child → queue 剩 *、D');
  await step(tok);                                   // 616.8 * 丟出來，看到 / 和 C
  const m2 = deq(); await go(tok, 250);
  enq(m2.left); await go(tok, 200); enq(m2.right);
  say('* 丟出來，放進它的 / 和 C', 'queue：D / C');
  await step(tok);                                   // 623.1 一直推下去
  while (q.length) { const n = deq(); await go(tok, 200); for (const k of [n.left, n.right]) if (k) { enq(k); await go(tok, 140); } }
  cd.hl(9); cur.obj.visible = false;
  say('就這樣一直推下去，queue 空了就結束', '+ * E * D / C A B');
  talk(g, '有不有趣？', 'happy');
}]);

// 12:10 走訪順序的用途：相等與相似
FRAG.push(['treeb2-similar', '為何要知道走訪順序：相等與相似', async (tok) => {
  const g = stage([0, 4.6, 13], [0, 3.6, 0.6], [6.2, 3.0]);
  let t1, t2;
  await step(tok);                                   // 729.9 為什麼要知道 traversal 順序？
  say('看完 in／post／pre order', '為什麼要知道走訪順序？');
  talk(g, '為什麼？', 'wow');
  await step(tok);                                   // 741.8 為了知道 tree 的 structure
  tag('掌握 tree 的 structure（結構）', 'ptr alt', 0, 7.6);
  say('因為要知道 tree 的 structure', '');
  await step(tok);                                   // 756.8 兩棵 tree 是否相等
  t1 = showTree('A(B,C)', { cx: -3.6, width: 2.6, topY: 6.4, minY: 4.8, maxSp: 1.3 });
  t2 = showTree('A(C,B)', { cx: 3.6, width: 2.6, topY: 6.4, minY: 4.8, maxSp: 1.3 });
  tag('T1', 'ptr', -3.6, 7.0); tag('T2', 'ptr', 3.6, 7.0);
  say('常見問題：兩棵 tree 是否相等（equal）', '這個很簡單，等一下看');
  await step(tok);                                   // 771.8 是否相似 similar
  tag('similar？', 'ptr alt', 0, 5.6);
  say('也可以問：兩棵 tree 是否相似（similar）', '');
  await step(tok);                                   // 780.3 A(B,C) vs A(C,B)
  glow(t1, GOLD); glow(t2, GOLD);
  say('A 下面 B、C；另一棵 A 下面 C、B', 'root 一樣，child 順序不同');
  talk(g, '算相似嗎？', 'wow');
  await step(tok);                                   // 813.8 只看結構：很相似
  glow(t1, OFF); glow(t2, OFF);
  const gg = [ghost('#2fc092', -3.6, 5.6, 3.6, 2.4), ghost('#2fc092', 3.6, 5.6, 3.6, 2.4)];
  say('從結構看：root 下面兩個 child', '很相似');
  await step(tok);                                   // 825.8 更嚴格：左右也要一樣 → 不相似
  gg.forEach(kill);
  glow(t1.left, RED); glow(t2.left, RED); glow(t1.right, RED); glow(t2.right, RED);
  say('更嚴格：左右都要一樣', '那就不相似 → 要看定義');
  talk(g, '看定義！', 'happy');
  await step(tok);                                   // 856.6 traversal 轉成 string 比較
  allOff(t1); allOff(t2);
  tag('preorder', 'idx', 0, 0.35, 2.0);
  const rows = [];
  for (const [t, x0] of [[t1, -4.6], [t2, 2.6]]) { const seq = preorder(t); rows.push(seq.map((n, i) => emit(n, V(x0 + i * 0.75, 0.35, 2.0), SMALL))); await go(tok, 300); }
  say('快速方法：traverse 把 tree 轉成 string', 'ABC vs ACB → 做 string comparison');
  await step(tok);                                   // 874.8 LCS
  [rows[0][0], rows[0][1], rows[1][0], rows[1][2]].forEach((b) => lit(b, GOLD));
  say('還可以用 Longest Common Subsequence', 'LCS(ABC, ACB) = AB：共同的字和順序');
  talk(g, 'LCS 也能用', 'wow');
}]);

// 15:13 複製一棵 tree（Copy）
const CCODE = ['TreeNode* Copy(TreeNode* orig) {', '  if (!orig) return 0;', '  TreeNode* temp = new TreeNode;', '  temp->data = orig->data;      // V', '  temp->leftChild =', '    Copy(orig->leftChild);      // L', '  temp->rightChild =', '    Copy(orig->rightChild);     // R', '  return temp;', '}'];
FRAG.push(['treeb2-copy', '複製一棵 tree（Copy）', async (tok) => {
  const g = stage([0, 4.6, 13.5], [0, 4.0, 0], [6.6, 3.0]);
  const w = Math.max(...CCODE.map((s) => s.length)) + 6;
  const SRC = 'A(B(D,E),C)';
  let cd, src, dst, cur;
  const mk = (s, d) => { const b = lab.addBody(block(s.label, NODE, depthColor(d.depth))); b.obj.position.copy(s.pos); lab.springTo(b, d.pos.clone()); d.body = b; };
  await step(tok);                                   // 912.8 兩個基本 operation
  src = showTree(SRC, { cx: 3.4, width: 3.6, topY: 7.2, minY: 5.0, maxSp: 0.95 });
  tag('原 tree（示意）', 'ptr', 0.6, 7.2);
  say('tree 的兩個基本 operation', '第一個：copy');
  await step(tok);                                   // 918.8 procedure Copy
  cd = code(CCODE.map((s) => s.padEnd(w, ' ')), -3.9, 7.4, 0.48);
  dst = parseTree(SRC);
  layoutTree(dst, Object.assign({}, TREE_O, { cx: 3.4, width: 3.6, topY: 3.6, minY: 1.4, maxSp: 0.95 }));
  edgeLines(() => treePairs(dst));
  tag('copy', 'ptr alt', 0.6, 3.6);
  cd.hl(0);
  say('有了走訪，很容易做出 tree 的 copy', 'procedure 叫 Copy');
  await step(tok);                                   // 934.9 傳進 tree 的 root
  cur = makeCursor(); cursorTo(cur, src.pos);
  say('把原 tree 的 root 丟給 Copy', 'orig = A');
  await step(tok);                                   // 959.8 root 是不是 empty？
  cd.hl(1);
  say('先判斷 root 是不是 empty', 'binary tree 可以是空的 → 空就直接 return');
  talk(g, '空的就不用抄', 'happy');
  await step(tok);                                   // 1019.8 new 一個 TreeNode 給 temp
  cd.hl(2);
  const tmpT = tag('temp：新 node', 'ptr alt', dst.pos.x + 1.4, dst.pos.y + 0.5);
  ghost('#c08a1f', dst.pos.x, dst.pos.y, 0.9, 0.7, 0, 0.9);
  say('不是空的：向系統 new 一個 TreeNode', '給 temp');
  await step(tok);                                   // 1031.0 data 複製一份
  cd.hl(3); mk(src, dst);
  say('把原 node 的 data 複製到 temp->data', 'V：temp->data = orig->data');
  await step(tok);                                   // 1045.4 Copy 左子樹 → temp 的 leftChild
  cd.hl(5); kill(tmpT);
  cursorTo(cur, src.left.pos);
  say('呼叫 Copy 複製左邊的 child', '結果設給 temp->leftChild');
  await step(tok);                                   // 1079.8 一路 recursive 往下複製
  for (const [s, d] of [[src.left, dst.left], [src.left.left, dst.left.left], [src.left.right, dst.left.right], [src.right, dst.right]]) { cursorTo(cur, s.pos); mk(s, d); await go(tok, 420); }
  cur.obj.visible = false;
  say('recursive 下去：有值就 new node、copy data', '再往它的子孫繼續 copy');
  talk(g, '一路抄到底', 'wow');
  await step(tok);                                   // 1119.7 不是 pointer assignment
  for (const n of [dst.left.left, dst.left.right, dst.left, dst.right]) { lab.flyAway(n.body, V(0, 8, 4)); n.body = null; }
  setTag(cd.ls[4], '  temp->leftChild = orig->leftChild;'.padEnd(w, ' '));
  setTag(cd.ls[5], '    // ✗ 沒有呼叫 Copy'.padEnd(w, ' '));
  setTag(cd.ls[6], '  temp->rightChild = orig->rightChild;'.padEnd(w, ' '));
  setTag(cd.ls[7], '    // ✗ 沒有呼叫 Copy'.padEnd(w, ' '));
  cd.hl(4);
  say('如果直接寫 pointer assignment 呢？', 'temp->leftChild = orig->leftChild');
  await step(tok);                                   // 1134.0 只能 copy 到 root
  const r = dst.pos;
  arrow(V(r.x - 0.2, r.y + 0.3, 0.3), V(src.left.pos.x, src.left.pos.y - 0.32, 0.3), '#c0392b', true);
  arrow(V(r.x + 0.2, r.y + 0.3, 0.3), V(src.right.pos.x, src.right.pos.y - 0.32, 0.3), '#c0392b', true);
  [src.left, src.right, src.left.left, src.left.right].forEach((n) => glow(n, RED));
  say('那只 copy 到 root', '下面的子樹跟原 tree 共用，沒有真的複製');
  talk(g, '偷用別人的！', 'sad');
  await step(tok);                                   // 1144.8 要 recursive 才能左右都複製
  CCODE.slice(4, 8).forEach((s, i) => setTag(cd.ls[4 + i], s.padEnd(w, ' ')));
  cd.hl(5); allOff(src);
  tag('左右都要呼叫 Copy（recursive）', 'good', -3.9, 2.4);
  say('left、right 都要用 recursive procedure', '才能把左右 subtree 完整複製一份');
  await step(tok);                                   // 1168.5 跟 in order 很像：V、L、R
  [3, 5, 7].forEach((i, k) => tag(['V', 'L', 'R'][k], 'ptr alt', 0.8, 7.4 - i * 0.48));
  say('這段程式：V、L、R', '老師說像 inorder；順序其實是 VLR');
  await step(tok);                                   // 1185.8 能用 pre／post order 嗎？
  tag('思考：用 preorder／postorder 也能 copy 嗎？', 'note', -3.9, 1.6);
  say('回去想：能不能用 preorder 或 postorder 做 copy？', '補充：可以，關鍵是左右都遞迴 Copy');
  talk(g, '都可以！', 'happy');
}]);

// 20:06 判斷兩棵 tree 相等
const ECODE = ['bool operator==(s, t)', '  { return Equal(s.root, t.root); }', 'bool Equal(TreeNode* a, TreeNode* b) {', '  if (!a && !b) return true;', '  return (a && b', '    && a->data == b->data', '    && Equal(a->leftChild, b->leftChild)', '    && Equal(a->rightChild, b->rightChild));', '}'];
FRAG.push(['treeb2-equal', '判斷兩棵 tree 相等（operator==）', async (tok) => {
  const g = stage([0, 4.4, 13.5], [0, 3.8, 0], [6.6, 3.4]);
  const cd = code(padL(ECODE), 0, 7.7, 0.48);
  const s = showTree('A(B(D,),C)', { cx: -3.4, width: 2.8, topY: 3.3, minY: 1.1, maxSp: 0.95 });
  const t = showTree('A(B(D,),C)', { cx: 3.4, width: 2.8, topY: 3.3, minY: 1.1, maxSp: 0.95 });
  tag('s（示意）', 'ptr', -5.9, 3.3); tag('t', 'ptr', 5.9, 3.3);
  const ca = makeCursor(), cb = makeCursor();
  const pair = (a, b, col = GOLD) => { cursorTo(ca, a.pos); cursorTo(cb, b.pos); glow(a, col); glow(b, col); };
  await step(tok);                                   // 1205.7 接下來看相等
  say('接下來：兩棵 tree 相不相等', '');
  await step(tok);                                   // 1212.8 operator overloading
  cd.hl(0);
  say('用 operator overloading 定義 ==', '看到 s == t 就執行這段');
  await step(tok);                                   // 1230.8 把兩個 root 丟給 Equal
  cd.hl(1);
  say('把兩棵 tree 的 root 傳給 Equal', '');
  await step(tok);                                   // 1247.6 a、b 都是 TreeNode pointer
  cd.hl(2); pair(s, t);
  say('Equal(a, b)：兩個 TreeNode pointer', 'a = s 的 root，b = t 的 root');
  await step(tok);                                   // 1268.8 兩個都是 empty → true
  cd.hl(3);
  say('a、b 都是 empty binary tree', '直接 return true，不用再 traverse');
  talk(g, '兩個都空 = 相等', 'happy');
  await step(tok);                                   // 1289.8 if：a 和 b 都要有值
  cd.hl(4);
  say('否則：一連串 and', '先要 a 和 b 都有值');
  await step(tok);                                   // 1313.8 a 的 data 等於 b 的 data
  cd.hl(5); pair(s, t, GREEN);
  say('and：a 的 data 要等於 b 的 data', 'A = A ✓');
  await step(tok);                                   // 1335.0 再 and Equal(左子樹) → recursive
  cd.hl(6);
  pair(s.left, t.left, GREEN); await go(tok, 600); pair(s.left.left, t.left.left, GREEN);
  say('再 and Equal(a 的 left, b 的 left)', '是 recursive：整棵左子樹一路比到底');
  talk(g, '不只比一層', 'wow');
  await step(tok);                                   // 1372.2 再檢查右子樹
  cd.hl(7); pair(s.right, t.right, GREEN);
  say('最後 and Equal(右子樹)', 'C = C ✓');
  await step(tok);                                   // 1393.3 全部成立 → true
  cd.hl(-1);
  tag('s == t → true', 'good', 0, 0.4, 1.0);
  say('四個條件都成立，才回傳 true', '');
  talk(g, '相等！', 'happy');
  await step(tok);                                   // 1417.1 equal 就這麼簡單（補充：深層不同）
  allOff(s); allOff(t);
  const D = t.left.left;
  lab.flyAway(D.body, V(3, 8, 3));
  const E = T('E'); E.depth = D.depth; E.pos = D.pos.clone(); t.left.left = E;
  const eb = nodeBody(E); eb.obj.position.copy(E.pos).add(V(0, 4, 0)); lab.dropTo(eb, E.pos.clone());
  await go(tok, 500);
  pair(s, t, GREEN); await go(tok, 300); pair(s.left, t.left, GREEN); await go(tok, 300); pair(s.left.left, E, RED);
  say('一個 if 就搞定（補充：把最底下 D 換成 E）', 'D ≠ E → false，&& 短路，後面不用比');
}]);

// 24:02 單一走訪 string 決定不了唯一的 tree
FRAG.push(['treeb2-sameino', '單一走訪能否決定唯一 tree', async (tok) => {
  const g = stage([0, 4.4, 13.5], [0, 3.6, 0.8], [6.6, 3.8]);
  const xs = [-4.4, 0, 4.4];
  let trees;
  await step(tok);                                   // 1442.3 similar 難多了
  say('equal 很簡單；similar 難得多', '');
  talk(g, 'similar 好難', 'sad');
  await step(tok);                                   // 1453.8 把 output 變成一個 string
  say('一種做法：把走訪的 output 變成 string', '');
  await step(tok);                                   // 1476.8 inorder／preorder／postorder 的 string
  tag('inorder string ｜ preorder string ｜ postorder string', 'ptr', 0, 7.6);
  say('可得到 in、pre、postorder 三種 string', '');
  await step(tok);                                   // 1487.6 只給 inorder，能決定唯一的 tree 嗎？
  trees = ['B(A,C)', 'A(,B(,C))', 'C(B(A,),)'].map((src, j) => showTree(src, { cx: xs[j], width: 2.4, topY: 6.6, minY: 3.6, maxSp: 1.1 }));
  say('預告：只給一個 inorder string', '能不能決定唯一的 tree？');
  talk(g, '能嗎？', 'wow');
  await step(tok);                                   // 1515.8 結構不同、inorder 相同？
  tag('inorder', 'idx', -6.6, 0.35, 2.0);
  for (let j = 0; j < 3; j++) { const seq = inorder(trees[j]); for (let i = 0; i < 3; i++) emit(seq[i], V(xs[j] - 0.75 + i * 0.75, 0.35, 2.0), SMALL); await go(tok, 500); }
  say('這三棵結構都不一樣', 'inorder 卻全是 A B C！');
  await step(tok);                                   // 1538.9 不能只靠一種
  tag('preorder', 'idx', -6.6, 0.35, 3.3);
  for (let j = 0; j < 3; j++) { const seq = preorder(trees[j]); for (let i = 0; i < 3; i++) emit(seq[i], V(xs[j] - 0.75 + i * 0.75, 0.35, 3.3), SMALL); await go(tok, 400); }
  say('要決定唯一的 tree，不能只靠一種', '補充：inorder + preorder → BAC／ABC／CBA 分得開');
  talk(g, '要兩種才夠', 'happy');
}]);

// 26:03 Satisfiability 與 2^n 組合
const SAT_SRC = '∨(∨(∧(x1,¬(,x2)),∧(¬(,x1),x3)),¬(,x3))';
const SAT_F = '(x1 ∧ ¬x2) ∨ (¬x1 ∧ x3) ∨ ¬x3';
const COMBOS = ['TTT', 'TTF', 'TFT', 'TFF', 'FTT', 'FTF', 'FFT', 'FFF'];
function satValT(n, asg) {
  if (n.label === '¬') return !satValT(n.right, asg);
  if (n.label === '∧') return satValT(n.left, asg) && satValT(n.right, asg);
  if (n.label === '∨') return satValT(n.left, asg) || satValT(n.right, asg);
  return asg[Number(n.label.slice(1)) - 1] === 'T';
}
FRAG.push(['treeb2-sat', 'Satisfiability 問題與窮舉 2^n 組合', async (tok) => {
  const g = stage([0, 4.6, 13.5], [0, 4.0, 0], [6.6, 3.4]);
  let root, lamp, rows;
  await step(tok);                                   // 1563.8 calculus 的 expression
  tag(SAT_F, 'ptr', -2.0, 7.6);
  say('propositional calculus expression', '做一些邏輯判斷（課本例）');
  await step(tok);                                   // 1569.8 not、and、or
  tag('¬ not　∧ and　∨ or', 'ptr alt', -2.0, 7.0);
  say('運算子有三個：not、and、or', '');
  await step(tok);                                   // 1589.8 x1、x2、x3 只能 true／false
  tag('x1, x2, x3 ∈ {T, F}', 'note', 4.6, 7.4);
  say('x1、x2、x3 只能是 true 或 false', '也就是 1 或 0');
  await step(tok);                                   // 1609.8 有沒有 assignment 使式子為 true？
  say('問題：有沒有一組 assignment', '能讓整個式子為 true？');
  talk(g, '有沒有解？', 'wow');
  await step(tok);                                   // 1633.8 開燈電路
  lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 16), new THREE.MeshStandardMaterial({ color: '#d8cfc0', emissive: '#000' }));
  lamp.position.set(5.6, 0.7, 1.6); lab.world.add(lamp);
  tag('燈', 'idx', 5.6, 0.1, 2.4);
  say('像設計開燈電路：式子是 1 燈才會亮', '寫不好的話，燈可能永遠不亮');
  await step(tok);                                   // 1687.8 左半邊：tree 的表示方法
  root = await dropTree(tok, SAT_SRC, { cx: -2.0, width: 8.4, topY: 6.4, minY: 2.2, maxSp: 0.78 }, 120);
  say('這個式子可以用 tree 表示', '從式子變成 tree：請自己讀課本');
  await step(tok);                                   // 1729.8 每個變數 T／F → 2^3 = 8 種
  tag('x1 x2 x3 → 值', 'idx', 4.6, 6.6);
  rows = COMBOS.map((c, k) => tag(c.split('').join('  ') + '  → ?', '', 4.6, 6.0 - k * 0.55));
  say('3 個變數，每個 T 或 F', '2³ = 8 種組合');
  await step(tok);                                   // 1746.1 每一種組合代進去試
  for (let k = 0; k < 8; k++) {
    const v = satValT(root, COMBOS[k]);
    setTag(rows[k], COMBOS[k].split('').join('  ') + '  → ' + (v ? 'T' : 'F'));
    rows[k].element.className = 'lab-label ' + (v ? 'ptr alt' : 'idx');
    lamp.material.emissive.set(v ? '#e0a800' : '#000');
    await go(tok, 280);
  }
  say('用迴圈把每一組（例如 TTT）代進去', '8 組中只有 TTT 不成立');
  talk(g, '燈亮了！', 'happy');
}]);

// 29:32 怎麼讓電腦算：兩階段 stack vs. postorder
FRAG.push(['treeb2-evalcmp', '求值：兩階段 stack vs. 一次 postorder', async (tok) => {
  const g = stage([0, 4.6, 13.5], [0, 3.9, 0], [6.6, 3.2]);
  let inB, k = 0;
  const ops = [], st = [];
  await step(tok);                                   // 1772.0 怎麼讓電腦自動判斷？
  say('輸入 TTT，電腦怎麼自動算出式子的值？', '');
  talk(g, '電腦怎麼算？', 'wow');
  await step(tok);                                   // 1811.3 提示：2 + 3 * 4
  tag('Stack 法：兩個 phase', 'ptr', -3.6, 7.6);
  const tok2 = ['2', '+', '3', '*', '4'];
  inB = tok2.map((s, i) => cube(s, BLU, SMALL, -5.6 + i * 0.75, 6.7));
  tag('infix', 'idx', -6.6, 6.7);
  say('提示：stack 章節的 2 + 3 * 4', 'expression evaluation');
  await step(tok);                                   // 1839.1 一不一樣？很像
  say('布林式求值跟它一不一樣？', '很像！');
  await step(tok);                                   // 1849.9 運算子換成 not／and／or，值只有 0、1
  tag('+ − × ÷ → ¬ ∧ ∨；值只有 0、1', 'note', -3.0, 5.9);
  say('差別只是 operator 換成 not、and、or', '變數的值只有 0 和 1');
  await step(tok);                                   // 1883.8 stack：兩個 phase
  tag('postfix', 'idx', -6.6, 5.2); tag('op stack', 'idx', -1.0, 3.7);
  say('用 stack 的話，要兩個 phase', '');
  await step(tok);                                   // 1913.8 phase 1：infix → postfix
  const toOut = (s, from) => { const b = cube(s, GRN, SMALL, from.x, from.y); lab.springTo(b, V(-5.6 + k * 0.75, 5.2, 0)); k++; };
  for (let i = 0; i < 5; i++) {
    const p = inB[i].obj.position;
    if ('+*'.includes(tok2[i])) { const b = cube(tok2[i], ORG, SMALL, p.x, p.y); lab.springTo(b, V(-1.0, 4.3 + ops.length * 0.55, 0)); ops.push(b); }
    else toOut(tok2[i], p);
    await go(tok, 300);
  }
  while (ops.length) { const b = ops.pop(); lab.springTo(b, V(-5.6 + k * 0.75, 5.2, 0)); k++; await go(tok, 300); }
  say('Phase 1：infix 轉成 postfix', '2 3 4 * +');
  await step(tok);                                   // 1926.7 phase 2：依 postfix 求值
  tag('eval stack', 'idx', -4.0, 3.0);
  const pushV = (v) => { const b = cube(String(v), PUR, SMALL, -4.0, 0.4 + st.length * 0.55, 0, 2.5); st.push({ v, b }); };
  for (const s of ['2', '3', '4', '*', '+']) {
    if (s === '*' || s === '+') { const y = st.pop(), x = st.pop(); lab.flyAway(y.b, V(2, 7, 3)); lab.flyAway(x.b, V(-2, 7, 3)); pushV(s === '*' ? x.v * y.v : x.v + y.v); }
    else pushV(Number(s));
    await go(tok, 350);
  }
  say('Phase 2：數字 push；operator pop 兩個算完再 push', '2 + 3 * 4 = 14');
  await step(tok);                                   // 1968.8 更快：建成 tree 做 postorder
  tag('Tree 法：一次 postorder', 'ptr alt', 3.6, 7.6);
  const root = showTree('+(2,*(3,4))', { cx: 3.6, width: 3.0, topY: 6.4, minY: 3.4, maxSp: 1.0 });
  say('更快的方法：把式子變成一棵 tree', '直接對 tree 做 postorder');
  talk(g, '更快？', 'wow');
  await step(tok);                                   // 1982.8 postorder 過程中順便 evaluate
  const val = (n) => (n.label === '+' ? val(n.left) + val(n.right) : n.label === '*' ? val(n.left) * val(n.right) : Number(n.label));
  const cur = makeCursor();
  for (const n of postorder(root)) { cursorTo(cur, n.pos); glow(n, GOLD); tag('= ' + val(n), 'ptr alt', n.pos.x + 0.85, n.pos.y); await go(tok, 400); }
  cur.obj.visible = false;
  say('在 postorder 的過程中順便 evaluate', '走訪完，答案 14 就在 root');
  await step(tok);                                   // 1996.5 只有一個 phase；代價：要先建 tree
  tag('只要 1 個 phase；代價：先建好 tree', 'good', 3.6, 2.4);
  say('只有一個 phase 而已', '代價：還是要先建一棵 tree，避不掉');
  talk(g, '各有代價', 'happy');
}]);

// 33:41 SAT 的 node 設計與窮舉演算法
const ACODE = ['for (each of the 2^n combinations) {', '  generate the next combination;', '  replace variables by their values;', '  PostOrderEval(formula);   // 走訪 tree', '  if (formula.value) {', '    cout << combination; return; }', '}', 'cout << "No satisfiable combination";'];
FRAG.push(['treeb2-satnode', 'SAT 的 node 設計（四個欄位）與窮舉演算法', async (tok) => {
  const g = stage([0, 4.4, 13.5], [0, 4.0, 0], [6.6, 3.2]);
  let three, four = [], cd, cnt;
  three = ['leftChild', 'data', 'rightChild'].map((s, i) => cube(s, SAND, [1.9, 0.55, 0.7], -3.0 + i * 1.95, 6.8));
  tag('一般 TreeNode：3 個欄位', 'ptr', -1.0, 7.6);
  await step(tok);                                   // 2020.8 用 postorder 解
  say('另一種解法：透過 tree traversal', '用 postorder');
  await step(tok);                                   // 2026.8 tree 要設計：四個欄位
  tag('SAT 用的 node：4 個欄位', 'ptr alt', 0, 5.9);
  for (const [i, s, c] of [[0, 'leftChild', BLU], [1, 'data', GRN], [2, 'value', ORG], [3, 'rightChild', PUR]]) { four.push(cube(s, c, [1.9, 0.55, 0.7], -2.92 + i * 1.95, 5.1, 0, 2.5)); await go(tok, 300); }
  say('這棵 tree 要特別設計', '每個 node 有四個欄位');
  await step(tok);                                   // 2036.8 leftChild；data 是自己
  lit(four[0], GOLD); lit(four[1], GOLD);
  tag('operator，或變數設的 T／F', 'idx', -0.97, 4.45);
  say('leftChild 指向左邊；data 是自己本身', '例：x1 = true，data 就是 true');
  await step(tok);                                   // 2046.7 value：運算結果
  lit(four[0]); lit(four[1]); lit(four[2], GOLD);
  tag('左右子樹做完運算的結果', 'idx', 1.9, 4.45);
  say('value：對左右子樹做完 operation', '結果放在 value');
  talk(g, 'value 放答案', 'happy');
  await step(tok);                                   // 2060.8 rightChild
  lit(four[2]); lit(four[3], GOLD);
  say('rightChild 指向右邊的子樹', '總共四個欄位');
  await step(tok);                                   // 2067.3 原本只有三個欄位
  lit(four[3]); three.forEach((b) => lit(b, GOLD));
  say('原本的 tree node 只有三個欄位', '這裡多了一個 value');
  await step(tok);                                   // 2081.9 演算法：2^n 種組合
  three.forEach((b) => lit(b));
  cd = code(padL(ACODE), -1.0, 3.7, 0.44);
  cnt = tag('', 'ptr alt', 5.6, 2.2);
  cd.hl(0);
  say('演算法：n 個參數 → 產生 2^n 種組合', '');
  await step(tok);                                   // 2097.8 每一種組合去 traverse 那棵 tree
  setTag(cnt, '第 1 組：TTT');
  for (const i of [1, 2, 3]) { cd.hl(i); await go(tok, 450); }
  say('對每一種組合，traverse 那棵 tree', 'TTT → value = false → 下一組');
  await step(tok);                                   // 2103.8 結果為真 → output 這組
  setTag(cnt, '第 2 組：TTF');
  for (const i of [1, 2, 3, 4]) { cd.hl(i); await go(tok, 300); }
  cd.hl(5); setTag(cnt, '輸出 TTF');
  say('如果結果是 true', '就把這組組合 output 出來');
  talk(g, '找到了！', 'happy');
  await step(tok);                                   // 2111.8 八種組合：一個 for loop
  cd.hl(-1);
  tag('最多 2^n 組 × 每組走訪整棵樹 → O(g·2^n)', 'note', -1.0, 0.2, 1.0);
  say('像剛才 8 種組合：一個 for loop', '補充：時間 O(g · 2^n)，指數時間');
}]);

// 35:38 PostOrderEval 程式與求值範例
const PCODE = ['void PostOrderEval(TreeNode* x) {', '  if (!x) return;', '  PostOrderEval(x->leftChild);', '  PostOrderEval(x->rightChild);', '  switch (x->data) {', '  case NOT: v = !R.value;', '  case AND: v = L.value && R.value;', '  case OR:  v = L.value || R.value;', '  case TRUE:  v = true;', '  case FALSE: v = false;', '  }  // v = x->value', '}'];
FRAG.push(['treeb2-poeval', 'PostOrderEval 程式與求值範例', async (tok) => {
  const g = stage([0, 4.6, 13.5], [0, 4.0, 0], [-6.6, 3.0]);
  let cd, root, cur, asgTag;
  const vt = new Map();
  const evalN = (n, asg) => {
    const v = satValT(n, asg) ? 'T' : 'F';
    cursorTo(cur, n.pos);
    cd.hl(n.label === '¬' ? 5 : n.label === '∧' ? 6 : n.label === '∨' ? 7 : v === 'T' ? 8 : 9);
    if (!vt.has(n)) vt.set(n, tag('', 'ptr alt', n.pos.x, n.pos.y - 0.55, 0.3));
    setTag(vt.get(n), v); glow(n, v === 'T' ? GREEN : RED);
  };
  await step(tok);                                   // 2138.4 到底怎麼寫？
  cd = code(padL(PCODE), -3.9, 7.5, 0.46);
  root = showTree(SAT_SRC, { cx: 3.3, width: 6.6, topY: 7.0, minY: 2.8, maxSp: 0.62 });
  asgTag = tag('', 'ptr alt', 3.3, 1.7, 1.2);
  cur = makeCursor();
  say('寫法就這麼簡單', '比 stack 那章簡單多了');
  await step(tok);                                   // 2153.8 PostOrderEval，傳入 root
  cd.hl(0);
  say('procedure 叫 PostOrderEval', '傳進去的引數是 root');
  await step(tok);                                   // 2172.8 x 是空的就不用做
  cd.hl(1);
  say('先判斷 x 是不是空的', '空的就跳出來，連做都不用做');
  await step(tok);                                   // 2188.8 postorder：LRV
  cd.hl(2); await go(tok, 500); cd.hl(3);
  say('依照 postorder（L R V）', '先走左邊、再走右邊');
  talk(g, '先左再右', 'happy');
  await step(tok);                                   // 2221.8 看 data：幾種 case
  cd.hl(4);
  say('走到最下面，看這個 node 的 data', '分成幾種 case');
  await step(tok);                                   // 2253.8 引數：true／false
  cd.hl(8);
  say('如果是變數：設成 true，value 就是 true', '設成 false，value 就是 false');
  await step(tok);                                   // 2275.8 not：right child 的 value 取 not
  cd.hl(5);
  say('not：把 right child 的 value 取 not', '¬ 只有右邊的孩子');
  await step(tok);                                   // 2305.2 and：左右 value 做 and
  cd.hl(6);
  say('and：left 和 right child 的 value', '做 and，結果放進自己的 value');
  await step(tok);                                   // 2326.9 or
  cd.hl(7);
  say('or：左右子樹的 value 做 or', '');
  await step(tok);                                   // 2363.8 最後結果在 root 的 value
  cd.hl(-1); glow(root, GOLD);
  tag('答案在這裡', 'ptr alt', root.pos.x + 1.4, root.pos.y + 0.3);
  say('最後的結果放在哪裡？', 'postorder 最後才處理 root → 在 root 的 value');
  talk(g, '答案在 root', 'wow');
  await step(tok);                                   // 2401.8 例：x1 是 true
  glow(root, OFF);
  setTag(asgTag, '(x1, x2, x3) = (T, T, T)');
  const order = postorder(root);
  evalN(order[0], 'TTT');
  say('例子：走到最下面，x1 是 true', 'value = T');
  await step(tok);                                   // 2420.8 x2 true → ¬x2 false
  evalN(order[1], 'TTT'); await go(tok, 600); evalN(order[2], 'TTT');
  say('x2 是 true，所以 ¬x2 是 false', '');
  await step(tok);                                   // 2431.0 true and false → false，遞迴往上
  evalN(order[3], 'TTT'); await go(tok, 500);
  for (const n of order.slice(4)) { evalN(n, 'TTT'); await go(tok, 200); }
  say('true and false = false', '依此遞迴往上求值 → root = F');
  await step(tok);                                   // 2444.8 root value 為 true 就印出組合
  setTag(asgTag, '(x1, x2, x3) = (T, T, F)');
  for (const n of order) { evalN(n, 'TTF'); await go(tok, 140); }
  cd.hl(-1); cur.obj.visible = false;
  say('root 的 value 是 true，就印出這組', '例：TTF → true');
  talk(g, '印出 TTF', 'happy');
  await step(tok);                                   // 2465.0 改成第二章的 expression evaluation？
  tag('思考：改成算術式的 expression evaluation？', 'note', -3.9, 1.4);
  say('回去想：這程式怎麼改成算術式求值？', '');
}]);

// ═════════════════ pPMMUa8guTE：Lec14 Trees (3/6) ═════════════════
const setV = (b, t) => { const c = b.obj.children.find((o) => o.element); if (c) c.element.textContent = String(t); };
const under = (n, text, cls = 'ptr alt') => tag(text, cls, n.pos.x, n.pos.y - 0.66, 0.35);
function disc(text, color, x, y, z = 0, drop = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.6, 28), new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 }));
  m.castShadow = true; m.receiveShadow = true;
  m.add(lab.label(String(text), 'val'));
  const b = lab.addBody(m);
  m.position.set(x, y + drop, z);
  if (drop) lab.dropTo(b, V(x, y, z)); else b.target.set(x, y, z);
  return b;
}
function arc(a, b, color = '#c08a1f', lift = V(0, -0.3, 1.2)) {
  const mid = a.clone().add(b).multiplyScalar(0.5).add(lift);
  const pts = new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(28);
  const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color, dashSize: 0.16, gapSize: 0.1 }));
  ln.computeLineDistances();
  const dir = pts[28].clone().sub(pts[25]).normalize();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.24, 10), new THREE.MeshBasicMaterial({ color }));
  cone.position.copy(b).addScaledVector(dir, -0.12);
  cone.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
  ln.add(cone);
  lab.world.add(ln);
  return ln;
}
const TH_L = '#4b9ee2', TH_R = '#c08a1f';
function threadTo(from, side, target) {
  const tp = target.pos || target;
  return arc(from.clone().add(V(side * 0.32, -0.3, 0.2)), tp.clone().add(V(0, -0.32, 0.3)), side < 0 ? TH_L : TH_R);
}
function floorTile(x, z, w = 0.78, d = 0.9) {
  const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), new THREE.MeshStandardMaterial({ color: '#e9dcc4', roughness: 1 }));
  t.position.set(x, 0.04, z); t.receiveShadow = true; lab.world.add(t); return t;
}
const bitTag = (p, c, bit) => tag(bit, 'ptr alt', (p.pos.x + c.pos.x) / 2 + (bit === '0' ? -0.28 : 0.28), (p.pos.y + c.pos.y) / 2 + 0.12, 0.3);
const SAT_EXPR = '(x1 ∧ ¬x2) ∨ (¬x1 ∧ x3) ∨ ¬x3';
const satVal3 = (a, b, c) => (a && !b) || (!a && c) || !c;

// 0:00 複習 Satisfiability
FRAG.push(['treeb3-sat', '複習：Satisfiability 問題與運算式樹', async (tok) => {
  const g = stage([0, 5, 14], [0, 3.8, 0], [6.6, 3.0]);
  let root, rows = [];
  await step(tok);                                   // 0.5 複習：只含 and、or、not、true／false
  tag(SAT_EXPR, 'ptr', -2.8, 7.6);
  say('複習：calculus 的 expression', '只有 true／false 變數和 and、or、not（課本例）');
  talk(g, '複習一下', 'happy');
  await step(tok);                                   // 37.8 優先序 not > and > or
  tag('優先序：¬ > ∧ > ∨', 'ptr alt', -2.8, 7.0);
  say('它有優先序：not 比 and 高，and 比 or 高', '');
  await step(tok);                                   // 58.8 x1、x2、x3 設成什麼時式子為 true？
  tag('x1、x2、x3 = ? → 整個式子為 true', 'note', 4.4, 7.6);
  say('問題：x1、x2、x3 設成什麼值', '會讓整個 expression 為 true？');
  talk(g, '怎麼設？', 'wow');
  await step(tok);                                   // 85.8 一長串，有括號
  root = await dropTree(tok, SAT_SRC, { cx: -2.8, width: 7.2, topY: 6.4, minY: 2.2 }, 120);
  say('這是一長串的大 expression，裡面有括號', '畫成 tree 比較好看');
  await step(tok);                                   // 91.8 小括號：x1 and not x2
  const andL = root.left.left, notX2 = andL.right;
  ghost('#c08a1f', andL.pos.x, andL.pos.y - 1.0, 2.2, 2.4, 0, 0.6);
  say('看這個小括號：x1 ∧ ¬x2', '');
  await step(tok);                                   // 97.8 先做 not x2，再和 x1 做 and
  glow(notX2, GOLD); await go(tok, 700); glow(andL, GOLD);
  say('先做 ¬x2，再跟 x1 做 and', 'not 的優先序比較高');
  await step(tok);                                   // 114.8 3 個變數：8 種組合
  glow(notX2, OFF); glow(andL, OFF);
  tag('x1 x2 x3 → 值', 'ptr', 4.4, 6.9);
  for (let k = 0; k < 8; k++) {
    const a = !!(k & 4), b = !!(k & 2), c = !!(k & 1), v = satVal3(a, b, c);
    rows.push([tag([a, b, c].map((t) => (t ? 'T' : 'F')).join('  ') + '  →  ' + (v ? 'T' : 'F'), 'idx', 4.4, 6.3 - k * 0.55), v]);
    await go(tok, 220);
  }
  say('三個變數 → 8 種組合', '第一個值代表 x1、第二個 x2、第三個 x3');
  await step(tok);                                   // 134.8 不一定只有一組 true → 都要印
  rows.forEach(([l, v]) => { if (v) l.element.className = 'lab-label ptr alt'; });
  say('不一定只有一組是 true', '每一組 true 都要印出來（這裡 7 組）');
  talk(g, '全部印出來', 'happy');
  await step(tok);                                   // 225.8 expression 可以表示成 tree
  glow(root, GREEN);
  say('這個 expression 可以表示成這棵 tree', '怎麼建樹：請自己看課本');
  await step(tok);                                   // 253.8 postorder 中順便 evaluate
  const cur = makeCursor();
  for (const n of postorder(root)) { cursorTo(cur, n.pos); await go(tok, 160); }
  cur.obj.visible = false;
  say('有了 tree：做 postorder traversal', '走訪的過程中順便 evaluate');
}]);

// 4:36 PostOrderEval：節點結構與 switch
FRAG.push(['treeb3-eval', 'PostOrderEval：節點四個欄位與 switch', async (tok) => {
  const g = stage([0, 5, 14], [0, 3.6, 0.6], [6.6, 3.0]);
  const root = showTree(SAT_SRC, { cx: -3.7, width: 5.8, topY: 6.6, minY: 2.6 });
  let fb, cd;
  await step(tok);                                   // 276.3 程式的部分
  say('看程式的部分', '');
  await step(tok);                                   // 283.8 四個欄位
  const FN = [['leftChild', 'L'], ['data', '∧'], ['value', '?'], ['rightChild', 'R']];
  fb = FN.map(([nm, v], k) => { const x = -5.6 + k * 1.2; tag(nm, 'idx', x, 1.25, 2.5); return cube(v, k === 1 ? PUR : k === 2 ? ORG : SAND, [1.05, 0.5, 0.7], x, 0.3, 2.5, 3); });
  say('node 有四個欄位', 'leftChild、rightChild、data、value');
  await step(tok);                                   // 289.8 value：左右運算的結果
  lit(fb[2], GOLD);
  say('value：用左右子樹的值運算後的結果', '');
  await step(tok);                                   // 298.8 data：變數（設的真假）或 operator
  lit(fb[2]); lit(fb[1], GOLD);
  say('data：這個 node 是變數還是 operator', '例：x2 設成 true，data 就是 true');
  talk(g, 'data ≠ value', 'wow');
  await step(tok);                                   // 326.8 n 個變數的所有組合，每種 traverse 一次
  lit(fb[1]);
  tag('2ⁿ 種組合 × 每種走訪一次', 'note', -3.7, 7.6);
  say('解法：列出 n 個變數所有組合', '每一種都 traverse 一次這棵 tree');
  await step(tok);                                   // 352.8 post-order：recursive function
  cd = code(['PostOrderEval(Node *s) {', ' if (s) {', '  PostOrderEval(s->leftChild);', '  PostOrderEval(s->rightChild);', '  switch (s->data) {', '   Not: v = !R->value;', '   And: v = L->value && R->value;', '   Or:  v = L->value || R->value;', '   True:  v = true;', '   False: v = false;', ' } } }'], 3.9, 7.0, 0.48);
  cd.hl(0);
  say('架構跟 postorder 很像', '寫成 recursive function：PostOrderEval');
  await step(tok);                                   // 378.8 先往左、再往右（LRV）
  cd.hl(2); await go(tok, 500); cd.hl(3);
  say('postorder 的代號：L R V', '有左邊先往左，走不下去再往右');
  await step(tok);                                   // 402.8 V：依 operator 做運算
  cd.hl(4);
  say('V 原本是印出來', '現在改成：根據左右的資料做 operation');
  talk(g, 'V 換工作了', 'happy');
  await step(tok);                                   // 429.1 依 data 屬性分 case：not
  cd.hl(5);
  say('依 data 的屬性分 case', '第一個 case：not');
  await step(tok);                                   // 456.8 not：右子的 value，不是 data
  tag('對子節點的 value 運算，不是 data！', 'bad', 3.9, 1.6);
  say('not：取 right child 的 value 做 not', '注意：是 value，不是 data');
  talk(g, '是 value！', 'wow');
  await step(tok);                                   // 505.8 and／or：左右 value
  cd.hl(6); await go(tok, 500); cd.hl(7);
  say('and：left 的 value 和 right 的 value 做 and', 'or 同理');
  await step(tok);                                   // 519.8 變數 x2 設成 true → value = true
  cd.hl(8);
  say('data 是變數：x2 設成 true', '這個 node 的 value 就設成 true；false 同理');
  await step(tok);                                   // 549.6 postorder + switch 就算出來
  const asg = { x1: true, x2: false, x3: true };
  const cur = makeCursor(); const val = new Map(); const TF = (b) => (b ? 'T' : 'F');
  tag('示意：x1 = T, x2 = F, x3 = T', 'ptr', -3.7, 7.0);
  for (const n of postorder(root)) {
    cursorTo(cur, n.pos);
    let v;
    if (n.label === '¬') { v = !val.get(n.right); cd.hl(5); }
    else if (n.label === '∧') { v = val.get(n.left) && val.get(n.right); cd.hl(6); }
    else if (n.label === '∨') { v = val.get(n.left) || val.get(n.right); cd.hl(7); }
    else { v = asg[n.label]; cd.hl(v ? 8 : 9); }
    val.set(n, v); glow(n, v ? GOLD : RED); under(n, TF(v), v ? 'ptr alt' : 'ptr');
    setV(fb[1], n.label); setV(fb[2], TF(v));
    await go(tok, 190);
  }
  cur.obj.visible = false; cd.hl(-1);
  say('postorder 加上一個 switch', '就算出整個 expression 的 value（root = T）');
  await step(tok);                                   // 566.8 node 分成 data 和 value
  lit(fb[1], GOLD); lit(fb[2], GOLD);
  say('重點：node 分成 data 和 value 兩部分', 'data 存自己是誰，value 存算出來的結果');
  talk(g, '懂了！', 'happy');
}]);

// 9:42 延伸：用樹算算術式
FRAG.push(['treeb3-arith', '延伸思考：用樹計算算術運算式', async (tok) => {
  const g = stage([0, 5, 14], [0, 3.6, 0.5], [6.6, 3.2]);
  let r, r2;
  await step(tok);                                   // 588.0 之前的 expression 要怎麼改？
  say('回去想：如果是之前的算術 expression', 'PostOrderEval 要怎麼改？');
  talk(g, '想想看', 'wow');
  await step(tok);                                   // 609.8 2 + 3 * 4：2、3、4 對應 x1、x2、x3
  tag('x1 = 2, x2 = 3, x3 = 4', 'idx', -4.3, 7.5);
  r = await dropTree(tok, '+(2,*(3,4))', { cx: -4.3, width: 3.4, topY: 6.6, minY: 4.0 }, 200);
  say('例：2 + 3 * 4', '把 2、3、4 當成 x1、x2、x3 的值');
  await step(tok);                                   // 635.8 一樣算得出來
  const cur = makeCursor(); const val = new Map();
  for (const n of postorder(r)) {
    cursorTo(cur, n.pos);
    const v = !n.left ? Number(n.label) : (n.label === '+' ? val.get(n.left) + val.get(n.right) : val.get(n.left) * val.get(n.right));
    val.set(n, v); glow(n, GOLD); under(n, String(v));
    await go(tok, 400);
  }
  cur.obj.visible = false;
  say('一樣做 postorder 就算出來', '2 + 3 * 4 = 14');
  await step(tok);                                   // 642.8 考題：不用 stack，用 tree
  tag('考題：不用 stack，改用 tree 寫 evaluation', 'note', 2.6, 7.6);
  say('可能出的題目：不要用 stack', '改用 tree 把程式寫出來');
  talk(g, '要考！', 'wow');
  await step(tok);                                   // 660.8 stack：兩支程式
  tag('stack：infix → postfix → EVAL（兩支程式）', 'ptr', 2.6, 6.9);
  say('stack 作法很麻煩：要寫兩支程式', '先轉 postfix，再交給 EVAL');
  await step(tok);                                   // 679.8 tree：traverse 就好
  tag('tree：建樹 → postorder（只要 traverse）', 'ptr alt', 2.6, 6.2);
  say('tree 作法：對 tree 做 traverse 就可以了', '程式更簡單');
  await step(tok);                                   // 688.3 前提：要先變成 tree
  tag('前提：infix 要先變成一棵 tree', 'bad', 2.6, 5.5);
  say('但有一個前提條件', '2 + 3 * 4 總是要先變成 tree');
  await step(tok);                                   // 707.8 A/B−C+D*E−A*C
  r2 = await dropTree(tok, '-(+(-(/(A,B),C),*(D,E)),*(A,C))', { cx: 2.5, width: 7, topY: 4.8, minY: 0.9 }, 100);
  say('例：A / B − C + D * E − A * C', '先建成對應的 tree');
  await step(tok);                                   // 724.3 給變數值，用 traversal 算答案
  const cur2 = makeCursor();
  for (const n of postorder(r2)) { cursorTo(cur2, n.pos); glow(n, GOLD); await go(tok, 200); }
  cur2.obj.visible = false;
  say('設好 A、B、C、D、E 的值', '透過 tree traversal 就把答案算出來');
  await step(tok);                                   // 747.7 下週考試可能出
  say('怎麼設計？請回去想', '下週考試可能就出來了');
  talk(g, '回家練習', 'happy');
}]);

// 12:55 Threaded tree 動機：n + 1 個空 link
const F520 = 'A(B(D(H,I),E),C(F,G))';
FRAG.push(['treeb3-null', 'Threaded binary tree 動機：n+1 個空 link', async (tok) => {
  const g = stage([0, 5, 13.5], [0, 3.6, 0.5], [6.6, 3.0]);
  let r;
  await step(tok);                                   // 774.8 threaded binary tree
  tag('Threaded Binary Tree', 'ptr alt', 0, 7.6);
  say('新 topic：threaded binary tree', '');
  await step(tok);                                   // 783.8 把沒用到的 link 充分利用
  r = await dropTree(tok, F520, { topY: 6.6, minY: 2.5 }, 120);
  say('用意：binary tree 裡沒用到的 link', '把它們充分利用（Fig 5.20 的樹）');
  talk(g, '廢物利用？', 'wow');
  await step(tok);                                   // 800.8 n 個 node 有多少 link？
  tag('n = 9 個 node × 2 = 18 個 link', 'ptr', -4.6, 7.0);
  say('n 個 node，每個有 2 個 pointer', '共 2n 個 link（這裡 18 個）');
  await step(tok);                                   // 822.8 除了 root，沒人指向它
  let k = 0;
  for (const n of levelorder(r)) for (const c of [n.left, n.right]) if (c) { k++; glow(c, GREEN); tag(String(k), 'ptr', (n.pos.x + c.pos.x) / 2 + (c === n.left ? -0.3 : 0.3), (n.pos.y + c.pos.y) / 2 + 0.1, 0.2); await go(tok, 220); }
  say('除了 root，每個 node 被一條 link 指到', '實際用到 n − 1 = 8 條（老師口誤說 node）');
  await step(tok);                                   // 838.0 空的有 2n − (n − 1) 個
  for (const n of inorder(r)) for (const side of [-1, 1]) {
    if (side < 0 ? n.left : n.right) continue;
    const a = V(n.pos.x + side * 0.3, n.pos.y - 0.3, 0), b = V(n.pos.x + side * 0.62, n.pos.y - 0.9, 0);
    seg(a, b, '#b04040'); tag('null', 'idx', b.x, b.y - 0.22, 0.2);
    await go(tok, 180);
  }
  say('空的 null 有幾個？', '2n − (n − 1)');
  await step(tok);                                   // 853.0 = n + 1
  tag('2n − (n − 1) = n + 1 = 10', 'good', 0, 1.0, 1.0);
  say('= n + 1 個', '這棵樹 10 個空 link');
  talk(g, '空了 10 個！', 'sad');
  await step(tok);                                   // 870.8 thread 的概念
  say('反正 node 都產生了，link 也在', '不如充分利用：thread 的概念');
  await step(tok);                                   // 897.6 指向 inorder 的前一個或後一個
  rowLabel('inorder', 1.9);
  for (const n of inorder(r)) { cube(n.label, depthColor(n.depth), SMALL, n.pos.x, 0.3, 1.9, 2); await go(tok, 150); }
  say('讓空的 link 指向 inorder 的前一個或後一個', 'inorder：H D I B E A F C G');
  await step(tok);                                   // 918.8 leftChild 空 → predecessor
  tag('leftChild 空 → 指向 inorder 前一個（predecessor）', 'ptr alt', 0, 7.0);
  say('ptr->leftChild 是空的', '改指向 ptr 在 inorder 的前一個');
  await step(tok);                                   // 934.8 rightChild 空 → successor
  tag('rightChild 空 → 指向 inorder 後一個（successor）', 'ptr alt', 0, 0.9, 2.6);
  say('ptr->rightChild 是空的', '改指向 inorder 的後一個（後繼者）');
  talk(g, '前後鄰居', 'happy');
}]);

// 16:04 Fig 5.20：虛線 thread
FRAG.push(['treeb3-fig', 'Thread 範例：Fig 5.20 的虛線', async (tok) => {
  const g = stage([0, 5, 14], [0, 3.4, 1], [6.6, 3.2]);
  const r = showTree(F520, { topY: 6.6, minY: 2.8 });
  const N = (l) => find(r, l);
  const ib = new Map();
  await step(tok);                                   // 963.8 曲線（虛線）= thread，實線 = 原本的 link
  tag('實線 = 原本的 link；虛線 = thread', 'ptr', 0, 7.6);
  say('實線是原本 tree 的 link', '曲線（虛線）是 thread');
  await step(tok);                                   // 980.4 inorder：H D I B E A F C G
  rowLabel('inorder', 1.9);
  for (const n of inorder(r)) { ib.set(n.label, cube(n.label, depthColor(n.depth), SMALL, n.pos.x, 0.3, 1.9, 2)); await go(tok, 180); }
  say('這棵樹的 inorder：H D I B E A F C G', '');
  await step(tok);                                   // 1003.7 E 是 leaf，兩個 pointer 都空
  glow(N('E'), GOLD);
  say('先看 E：它是 leaf node', '兩個 pointer 本來都指向 null');
  talk(g, 'E 有兩個空位', 'wow');
  await step(tok);                                   // 1019.5 E.left → B
  threadTo(N('E').pos, -1, N('B')); lit(ib.get('B'), GOLD);
  say('E 的 left 指向 inorder 前一個：B', '');
  await step(tok);                                   // 1029.8 E.right → A
  threadTo(N('E').pos, 1, N('A')); lit(ib.get('B')); lit(ib.get('A'), GOLD);
  say('E 的 right 指向 inorder 後一個：A', '');
  talk(g, '左前右後', 'happy');
  await step(tok);                                   // 1040.1 I 的前一個是 D
  lit(ib.get('A')); glow(N('E'), OFF); glow(N('I'), GOLD);
  threadTo(N('I').pos, -1, N('D'));
  say('I：inorder 前一個是 D', 'I 的 left thread → D');
  await step(tok);                                   // 1057.3 I 的後一個是 B
  threadTo(N('I').pos, 1, N('B'));
  say('I 的後一個是 B', 'I 的 right thread → B');
  await step(tok);                                   // 1067.6 H 沒有前一個、G 沒有後一個
  glow(N('I'), OFF); glow(N('H'), RED); glow(N('G'), RED);
  const hp = N('H').pos, gp = N('G').pos;
  arc(hp.clone().add(V(-0.32, -0.3, 0.2)), hp.clone().add(V(-0.9, 0.7, 0.3)), TH_L, V(-0.3, 0, 0.6));
  arc(gp.clone().add(V(0.32, -0.3, 0.2)), gp.clone().add(V(0.9, 0.7, 0.3)), TH_R, V(0.3, 0, 0.6));
  tag('?', 'ptr', hp.x - 0.95, hp.y + 0.95, 0.3); tag('?', 'ptr', gp.x + 0.95, gp.y + 0.95, 0.3);
  say('H 沒有前一個，G 也沒有後一個', '這兩條會懸空');
  talk(g, '指去哪？', 'wow');
  await step(tok);                                   // 1075.8 可以指到 root
  glow(N('H'), OFF); glow(N('G'), OFF);
  for (const [l, side, t] of [['H', 1, 'D'], ['F', -1, 'A'], ['F', 1, 'C'], ['G', -1, 'C']]) { threadTo(N(l).pos, side, N(t)); await go(tok, 300); }
  say('老師：可以讓它們指到 root', '補充：課本是指向 head node');
}]);

// 18:29 leftThread / rightThread 與 head node
function buildThreaded(o) {
  const r = showTree(F520, o);
  const A = find(r, 'A');
  const head = { label: 'head', pos: V(A.pos.x - 1.5, o.topY + 1.25, 0) };
  return { r, A, head };
}
function threadInfo(root, head) {
  const ino = inorder(root), info = new Map();
  info.set(head, { lc: root, rc: head, lt: false, rt: false });
  ino.forEach((n, k) => info.set(n, { lc: n.left || ino[k - 1] || head, lt: !n.left, rc: n.right || ino[k + 1] || head, rt: !n.right }));
  return info;
}
function drawThreads(root, head, skipHead) {
  const info = threadInfo(root, head);
  for (const n of inorder(root)) {
    const f = info.get(n);
    if (f.lt && !(skipHead && f.lc === head)) threadTo(n.pos, -1, f.lc === head ? head.pos.clone().add(V(-0.2, 0, 0)) : f.lc);
    if (f.rt && !(skipHead && f.rc === head)) threadTo(n.pos, 1, f.rc === head ? head.pos.clone().add(V(0.2, 0, 0)) : f.rc);
  }
  return info;
}
function showHead(head, A, drop) {
  head.body = cube('head', GRAYB, [1.1, 0.6, 0.8], head.pos.x, head.pos.y, 0, drop ? 3 : 0);
  const a = arrow(head.pos.clone().add(V(0.25, -0.3, 0)), A.pos.clone().add(V(-0.2, 0.32, 0)), '#7a6a52');
  const h = head.pos;
  arc(h.clone().add(V(0.55, 0, 0)), h.clone().add(V(0.25, 0.32, 0)), TH_R, V(0.75, 0.55, 0.4));
  return a;
}
FRAG.push(['treeb3-fields', 'LeftThread／RightThread 欄位與 head node', async (tok) => {
  const g = stage([0, 5.2, 14], [0, 3.4, 0.8], [6.6, 3.4]);
  const { r, A, head } = buildThreaded({ topY: 5.0, minY: 1.8, width: 10.4 });
  drawThreads(r, head, true);
  let fb;
  const I = find(r, 'I'), B = find(r, 'B');
  await step(tok);                                   // 1108.8 每條 link 都指到某個 node
  say('現在每條 link 都會指到一個 node', 'tree 要做什麼修改？');
  await step(tok);                                   // 1126.8 判別：真的 tree node 還是 thread？
  tag('真的 child？還是 thread？', 'note', 0, 6.9);
  say('要能判別：這條 link 指的是', '真正的 tree node，還是 thread？');
  talk(g, '分得出來嗎？', 'wow');
  await step(tok);                                   // 1144.8 I 的 left、right 都是虛線 → 都是 thread
  glow(I, GOLD);
  say('例：I 的 left、right 出去都是虛線', '兩條都是 thread');
  await step(tok);                                   // 1173.8 多兩個 Boolean 欄位
  const NM = ['leftThread', 'leftChild', 'data', 'rightChild', 'rightThread'];
  fb = NM.map((nm, k) => { const x = -3 + k * 1.5; tag(nm, 'idx', x, k % 2 ? 1.35 : 0.95, 2.9); return cube('', k === 2 ? PUR : k % 4 === 0 ? ORG : SAND, [1.2, 0.5, 0.7], x, 0.3, 2.9, 3); });
  say('所以 node 多兩個 Boolean 欄位', 'leftThread、rightThread');
  await step(tok);                                   // 1189.8 leftThread = true → leftChild 是 thread
  ['t', '→D', 'I', '→B', 't'].forEach((v, k) => setV(fb[k], v));
  lit(fb[0], GOLD); lit(fb[4], GOLD);
  say('leftThread = true', '代表 leftChild 是 thread（I 的兩邊都是 t）');
  await step(tok);                                   // 1203.4 false → 一般 pointer
  glow(I, OFF); lit(fb[0]); lit(fb[4]); glow(B, GOLD);
  ['f', '→D', 'B', '→E', 'f'].forEach((v, k) => setV(fb[k], v));
  say('leftThread = false', 'leftChild 就是普通的 pointer（例：B）');
  talk(g, 't／f 一看就懂', 'happy');
  await step(tok);                                   // 1263.8 head node：自己指到自己
  glow(B, OFF);
  showHead(head, A, true);
  say('還會有一個 head node', '可以想成它自己指到自己（右邊那條）');
  await step(tok);                                   // 1288.8 避免 dangling：H、G 指向 head
  threadTo(find(r, 'H').pos, -1, head.pos.clone().add(V(-0.2, 0, 0)));
  threadTo(find(r, 'G').pos, 1, head.pos.clone().add(V(0.2, 0, 0)));
  say('Fig 5.20：為了避免 dangling', 'H、G 那兩條改指向 head node');
  await step(tok);                                   // 1319.8 head 指到的才是真正的 root
  glow(A, GOLD);
  ['f', '→A', '—', '→head', 'f'].forEach((v, k) => setV(fb[k], v));
  say('像 linked list 的 head node', 'head 指到的 A 才是真正的 root');
  talk(g, 'head 帶路', 'happy');
  await step(tok);                                   // 1333.5 看 true／false 就知道指向誰
  glow(A, OFF);
  const info = threadInfo(r, head);
  for (const n of inorder(r)) { const f = info.get(n); under(n, (f.lt ? 't' : 'f') + ' ' + (f.rt ? 't' : 'f'), f.lt ? 'ptr alt' : 'ptr'); }
  say('看 thread 欄位的 true／false', '就知道 link 是不是指向真正的子節點');
}]);

// 22:58 Thread 的用途與代價
FRAG.push(['treeb3-succ', 'Thread 的用途與代價', async (tok) => {
  const g = stage([0, 5.2, 14], [0, 3.6, 0.8], [6.6, 1.4]);
  const { r, A, head } = buildThreaded({ cx: -1.8, width: 8, topY: 5.0, minY: 1.6 });
  showHead(head, A, false);
  const info = drawThreads(r, head, false);
  const cd = code(['T* InorderSucc(x) {', ' temp = x->rightChild;', ' if (!x->rightThread)', '  while (!temp->leftThread)', '   temp = temp->leftChild;', ' return temp; }'], 4.9, 7.4, 0.45);
  rowLabel('inorder', 2.6);
  const cur = makeCursor();
  await step(tok);                                   // 1378.2 有了 thread 能幫你什麼？
  say('有了 thread，可以幫你做什麼？', '');
  talk(g, '有什麼用？', 'wow');
  await step(tok);                                   // 1389.0 很快找到 inorder 下一個／上一個
  const E = find(r, 'E');
  cursorTo(cur, E.pos); await go(tok, 600); cd.hl(5); cursorTo(cur, A.pos); glow(A, GOLD);
  say('很快找到某 node 在 inorder 的下一個', '例：E 的 right thread 直接到 A（上一個也行）');
  await step(tok);                                   // 1411.8 依 thread 狀態做 inorder traversal
  glow(A, OFF);
  let x = head, k = 0;
  for (let guard = 0; guard < 12; guard++) {
    const fx = info.get(x); let t = fx.rc;
    if (!fx.rt) { cd.hl(3); while (!info.get(t).lt) t = info.get(t).lc; }
    else cd.hl(5);
    if (t === head) break;
    cursorTo(cur, t.pos); glow(t, GOLD);
    const ob = cube(t.label, depthColor(t.depth), SMALL, t.pos.x, t.pos.y, 0);
    lab.springTo(ob, rowPos(k++, 2.6));
    x = t;
    await go(tok, 230);
  }
  cur.obj.visible = false;
  say('依 thread 是 true／false', '就能輕鬆做完 inorder traversal（不用 stack）');
  await step(tok);                                   // 1428.0 程式跳過
  cd.hl(-1);
  say('這段程式老師跳過', '因為蠻簡單的（畫面是課本版）');
  await step(tok);                                   // 1453.8 threaded tree 真的有用嗎？
  say('老師：threaded tree 真的有用嗎？', '自己寫程式還沒用過');
  talk(g, '真的有用嗎？', 'wow');
  await step(tok);                                   // 1465.6 演進的過程
  tag('研究演進：為了不浪費空間而出現', 'note', -1.8, 7.4);
  say('它是 binary tree 研究演進的過程', '有人想不浪費空間，就被納入課本');
  await step(tok);                                   // 1532.8 代價一：多兩個欄位
  tag('代價 ①：多 2 個 Boolean 欄位', 'bad', -1.8, 6.8);
  say('代價一：多了兩個欄位', 'leftThread、rightThread（Boolean）');
  await step(tok);                                   // 1547.9 代價二：insert／delete 要改更多 pointer
  tag('代價 ②：insert／delete 要多改 thread', 'bad', -1.8, 6.2);
  say('代價二：insert、delete 時', '還要調整 thread link，做更多 pointer assignment');
  talk(g, '比較麻煩', 'sad');
}]);

// 26:15 在 threaded tree 插入 R 為 X 的右子
const ICODE = ['r->rightChild = s->rightChild;', 'r->rightThread = s->rightThread;', 'r->leftChild = s;', 'r->leftThread = true;', 's->rightChild = r;', 's->rightThread = false;', 'if (!r->rightThread)', '  InorderSucc(r)->leftChild = r;'];
function insSetup() {
  fresh();
  lab.frameCamera([0, 5, 14], [0, 3.8, 0.5]);
  const cd = code(ICODE, -3.7, 6.6, 0.5);
  tag('s = X，r = R（課本 InsertRight）', 'idx', -3.7, 7.4);
  const E = [];
  edgeLines(() => E.map(([a, b]) => [a.body.obj.position, b.body.obj.position]));
  const mk = (l, x, y, color, drop = 0) => { const n = { label: l, pos: V(x, y, 0) }; n.body = cube(l, color, NODE, x, y, 0, drop); return n; };
  const mv = (n, x, y) => { n.pos = V(x, y, 0); lab.springTo(n.body, n.pos.clone()); };
  return { cd, E, mk, mv, g: pal(6.6, 3.0) };
}
FRAG.push(['treeb3-insert', 'Threaded tree：把 R 插成 X 的右子', async (tok) => {
  let S = insSetup();
  const A = S.mk('A', 4.4, 6.4, GRN), X = S.mk('X', 2.4, 5.0, BLU);
  S.E.push([A, X]);
  const xr = threadTo(X.pos, 1, A);
  let R;
  await step(tok);                                   // 1582.8 insert R 到 X 的右邊
  R = S.mk('R', 3.4, 3.6, ORG, 3);
  say('要把 R 這個 node 插到 X 的右邊', '有 thread 的話怎麼做？');
  talk(S.g, '插進去！', 'wow');
  await step(tok);                                   // 1604.8 X 本來是 thread，指向上面
  lit(X.body, GOLD);
  say('Case 1：X 的 right 本來是 thread', '指向上面的 inorder successor A');
  await step(tok);                                   // 1615.7 X 的 right link 改指 R
  S.cd.hl(4); kill(xr); S.E.push([X, R]);
  say('X 的 right link 改指向 R', 'X.rightChild = R');
  await step(tok);                                   // 1622.8 X 的 thread 欄位（口誤 true → 應為 false）
  S.cd.hl(5); lit(X.body);
  tag('X.rightThread = false', 'ptr alt', 2.4, 5.9);
  say('X 的 rightThread 欄位也要改', '應設成 false（老師口誤說 true）');
  await step(tok);                                   // 1629.8 R 的 left、right 兩個 link 與欄位
  S.cd.hl(0); threadTo(R.pos, 1, A); await go(tok, 500);
  S.cd.hl(2); threadTo(R.pos, -1, X);
  say('R 的 left、right 和兩個欄位都要設定', 'R.right → A、R.left → X（都是 thread）');
  await step(tok);                                   // 1679.8 X 本來沒有右子樹：很簡單
  S.cd.hl(-1);
  tag('Case 1 完成：inorder X R A', 'good', 3.4, 2.2);
  say('這個 case 很簡單', '因為 X 本來沒有 right child');
  talk(S.g, '簡單！', 'happy');
  await step(tok);                                   // 1692.7 Case 2：X 已有右子樹
  S = insSetup();
  const A2 = S.mk('A', 5.6, 6.6, GRN), X2 = S.mk('X', 1.4, 5.4, BLU), Y = S.mk('Y', 4.4, 4.2, PUR), Wn = S.mk('W', 3.4, 3.0, PUR);
  S.E.push([A2, X2], [X2, Y], [Y, Wn]);
  let wl = threadTo(Wn.pos, -1, X2), yr = threadTo(Y.pos, 1, A2), wr = threadTo(Wn.pos, 1, Y);
  say('Case 2：X 已經有右子樹（Y、W）', 'inorder：X W Y A');
  await step(tok);                                   // 1703.8 整個右子樹往下移一層
  kill(wl); kill(yr); kill(wr);
  S.mv(Y, 4.4, 3.0); S.mv(Wn, 3.4, 1.8);
  const R2 = S.mk('R', 2.4, 4.2, ORG, 3);
  S.E.splice(1, 1, [R2, Y]);
  S.cd.hl(0);
  await go(tok, 800);
  yr = threadTo(V(4.4, 3.0, 0), 1, A2); wr = threadTo(V(3.4, 1.8, 0), 1, Y); wl = threadTo(V(3.4, 1.8, 0), -1, X2);
  say('R 插進來：整個右子樹往下移一層', '變成 R 的右子樹，很多 link 要調整');
  talk(S.g, '整串下移', 'wow');
  await step(tok);                                   // 1722.8 X 的 right child 指向 R
  S.cd.hl(4); S.E.push([X2, R2]);
  threadTo(R2.pos, -1, X2);
  say('X 的 rightChild 指向 R', 'R 的 left thread 指回 X');
  await step(tok);                                   // 1744.0 本來指向 X 的那條改指 R
  S.cd.hl(7); lit(Wn.body, GOLD);
  kill(wl); threadTo(V(3.4, 1.8, 0), -1, R2);
  say('W 本來的 left thread 指向 X', '現在要改指向 R');
  await step(tok);                                   // 1753.8 inorder 中它的前一個變成 R
  lit(Wn.body);
  tag('inorder：X R W Y A', 'good', 3.4, 0.6, 1.0);
  say('因為 inorder 裡 W 的前一個變成 R', '它的後一個還是 Y、A');
  await step(tok);                                   // 1787.8 插在左邊也是兩個 case
  S.cd.hl(-1);
  say('插到 X 的左邊也一樣', '分「沒有左子樹」和「有左子樹」兩個 case');
  talk(S.g, '對稱的', 'happy');
}]);

// 31:40 Huffman code 概念
FRAG.push(['treeb3-huffc', 'Huffman code 概念：依頻率編碼', async (tok) => {
  const g = stage([0, 5, 14], [0, 3.2, 0.6], [6.6, 3.2]);
  const WORDS = ['the', 'I', 'you', 'data'], CNT = [0, 0, 0, 0];
  const SEQ = [0, 1, 0, 2, 0, 1, 0, 3, 1, 0, 2, 1, 0];
  let art;
  await step(tok);                                   // 1908.3 Huffman code：一種編碼
  tag('Huffman code', 'ptr alt', 0, 7.8);
  say('Huffman code 是一種編碼', '把東西換成一串 0 和 1');
  talk(g, '作業二！', 'wow');
  await step(tok);                                   // 1923.2 依使用頻率決定碼
  WORDS.forEach((w, j) => tag(w, 'ptr', -5.4 + j * 1.3, 0, 1.0));
  art = tag('', 'idx', -3.4, 7.2);
  const txt = [];
  for (const j of SEQ) { txt.push(WORDS[j]); setTag(art, '文章：' + txt.join(' ')); cube('', [ORG, BLU, PUR, TEAL][j], [0.8, 0.4, 0.8], -5.4 + j * 1.3, 0.2 + CNT[j]++ * 0.42, 0, 3); await go(tok, 150); }
  CNT.forEach((c, j) => tag(c + ' 次', 'idx', -5.4 + j * 1.3, 0.4 + c * 0.42 + 0.3, 0.2));
  say('依 message 的使用頻率', '決定它用怎樣的碼（示意資料）');
  await step(tok);                                   // 1940.8 M1～Mn 想成 word
  say('M1 ～ Mn 這些 message', '可以想成文章裡的 word（字）');
  await step(tok);                                   // 1969.0 每個 word 有代號：codebook
  tag('codebook（示意）', 'ptr', 3.8, 6.6);
  const CODEB = ['0', '10', '110', '111'];
  for (let j = 0; j < 4; j++) { tag(WORDS[j] + ' → ' + CODEB[j], j === 0 ? 'ptr alt' : 'ptr', 3.8, 5.8 - j * 0.7); await go(tok, 300); }
  say('每個 word 都有一個代號', 'codebook = 碼和明文的對照表');
  await step(tok);                                   // 2011.8 最頻繁的字用最少的單位
  tag('出現最多 → 碼最短', 'good', 3.8, 2.8);
  say('出現最頻繁的字（top 1 frequency）', '用最少的 bit 來表示');
  talk(g, 'the 最短！', 'happy');
  await step(tok);                                   // 2051.8 對方用 codebook 解碼
  tag('傳送端', 'ptr', 0.6, 1.2, 2.6); tag('接收端', 'ptr', 5.6, 1.2, 2.6);
  arrow(V(1.6, 0.9, 2.6), V(4.6, 0.9, 2.6), '#c08a1f');
  const pk = tag('0 10 0', 'pkt', 1.6, 1.6, 2.6);
  await P.travel(tok, pk, V(1.6, 1.6, 2.6), V(4.6, 1.6, 2.6), 1200);
  say('文章傳給對方，對方也有一份 codebook', '照著碼解回原文');
  await step(tok);                                   // 2068.8 碼越長，解碼越花時間
  say('code size 越長', '解碼就要花越多時間');
  await step(tok);                                   // 2077.8 頻繁的 word 碼短一點
  tag('目標：整份編碼後的總長度最小', 'note', 0, 0.3, 3.4);
  say('所以讓頻繁出現的 word', 'code size 小一點');
  talk(g, '常用的短', 'happy');
}]);

// 35:00 Codebook 樹：M1～M4
function huffTree(src, opts) {
  const root = showTree(src, opts);
  for (const n of allNodes(root)) {
    if (n.left || n.right) { kill(n.body); n.body = disc(n.label, SAND, n.pos.x, n.pos.y); }
    else n.body.obj.material.color.set(ORG);
  }
  return root;
}
function allBits(root) { for (const n of allNodes(root)) { if (n.left) bitTag(n, n.left, '0'); if (n.right) bitTag(n, n.right, '1'); } }
async function readPath(tok, root, leaf, cur, ms) {
  const path = []; (function f(n, acc) { if (!n) return false; if (n === leaf) { path.push(...acc, n); return true; } return f(n.left, [...acc, n]) || f(n.right, [...acc, n]); })(root, []);
  let bits = '';
  cursorTo(cur, root.pos);
  for (let k = 1; k < path.length; k++) { bits += path[k] === path[k - 1].left ? '0' : '1'; cursorTo(cur, path[k].pos); glow(path[k], GOLD); await go(tok, ms); }
  return bits;
}
FRAG.push(['treeb3-codebook', 'Codebook 樹：M1～M4 的碼與目標函數', async (tok) => {
  const g = stage([0, 5, 13.5], [0, 3.8, 0.4], [6.6, 3.0]);
  const root = huffTree('•(•(•(M1,M2),M3),M4)', { cx: -1.6, width: 6.4, topY: 6.6, minY: 2.4 });
  const cur = makeCursor();
  let k = 0;
  const read = async (l, ms) => { const leaf = find(root, l); const bits = await readPath(tok, root, leaf, cur, ms); under(leaf, bits); tag(l + ' = ' + bits, 'ptr alt', 4.8, 5.9 - k++ * 0.65); allNodes(root).forEach((n) => glow(n, OFF)); return bits; };
  await step(tok);                                   // 2099.8 這就是一份 codebook
  tag('codebook', 'ptr', 4.8, 6.6);
  say('這就是一份 codebook', '四個 message：M1、M2、M3、M4（想成四個 word）');
  await step(tok);                                   // 2112.2 M1 = 000：從 root 走到 leaf
  allBits(root);
  await read('M1', 400);
  say('M1 的 Huffman code 是 000', '從 root 往下走到 leaf 的路徑（左 0 右 1）');
  talk(g, '路徑就是碼', 'wow');
  await step(tok);                                   // 2144.8 M2 = 001、M3 = 01、M4 = 1
  await read('M2', 200); await read('M3', 200); await read('M4', 200);
  cur.obj.visible = false;
  say('001 是 M2、01 是 M3', '只有一個 1 就是 M4');
  await step(tok);                                   // 2156.8 codebook 長成一棵 tree
  glow(root, GOLD);
  say('這份 codebook 就長成一棵 tree', '');
  await step(tok);                                   // 2175.8 不同長法：M4 也可以在左邊
  glow(root, OFF);
  tag('也可以把 M4 放左邊…', 'note', -1.6, 1.4, 0.6);
  say('樹可以有不同的長法', '例如 M4 放在左邊也可以');
  await step(tok);                                   // 2190.8 objective function：頻率
  tag('minimize Σ 頻率 × 碼長', 'good', 4.8, 2.4);
  say('但要符合一個 objective function', '每個 message 有它的 frequency');
  await step(tok);                                   // 2216.8 整份編碼的 code size 最小
  say('頻率越高 → 碼越短', '讓整份編碼後檔案的 code size 最小');
  talk(g, '越常用越短', 'happy');
}]);

// 38:05 Huffman 建樹：2, 3, 5, 7, 9, 13
function forest(ws, o) {
  const O = Object.assign({ cx: 0, topY: 6.4, step: 1.15, spc: 1.0, gap: 0.6, tie: 'first' }, o);
  const F = { trees: ws.map((w) => ({ w, leaf: true, left: null, right: null })) };
  F.all = [...F.trees];
  F.q = () => F.trees.map((t) => t.w).join(', ');
  F.layout = () => {
    let x = 0;
    for (const t of F.trees) { (function w(n, d) { if (!n) return; w(n.left, d + 1); n.depth = d; n.lx = x; x += O.spc; w(n.right, d + 1); })(t, 0); x += O.gap; }
    const span = x - O.gap - O.spc;
    for (const n of F.all) n.pos = V(O.cx + n.lx - span / 2, O.topY - n.depth * O.step, 0);
  };
  F.spawn = () => {
    F.layout();
    for (const n of F.all) n.body = n.leaf ? cube(n.w, ORG, NODE, n.pos.x, n.pos.y, 0) : disc(n.w, SAND, n.pos.x, n.pos.y);
    edgeLines(() => { const out = []; for (const n of F.all) for (const c of [n.left, n.right]) if (c && n.body && c.body) out.push([n.body.obj.position, c.body.obj.position]); return out; });
  };
  F.merge = () => {
    const a = F.trees.shift(), b = F.trees.shift();
    const t = { w: a.w + b.w, leaf: false, left: a, right: b };
    let k = F.trees.findIndex((u) => (O.tie === 'first' ? u.w >= t.w : u.w > t.w));
    if (k < 0) k = F.trees.length;
    F.trees.splice(k, 0, t); F.all.push(t);
    t.body = disc(t.w, SAND, (a.pos.x + b.pos.x) / 2, O.topY, 0, 1.2);
    F.layout();
    for (const n of F.all) lab.springTo(n.body, n.pos.clone());
    return t;
  };
  return F;
}
FRAG.push(['treeb3-build', 'Huffman 建樹：每次合併最小的兩個', async (tok) => {
  const g = stage([0, 4.8, 14], [0, 3.8, 0], [6.6, 3.0]);
  let F, t;
  const qt = tag('', 'ptr', 0, 7.7);
  const showQ = () => setTag(qt, 'queue：' + F.q());
  await step(tok);                                   // 2284.8 先看例子
  F = forest([2, 3, 5, 7, 9, 13], { topY: 6.4 }); F.spawn(); showQ();
  say('先不看程式，看例子怎麼 run', '');
  await step(tok);                                   // 2296.8 方塊 = message（leaf）
  F.trees.forEach((u) => lit(u.body, GOLD));
  say('方塊是 leaf node，代表 message', '方塊裡的數字 = 它的 frequency');
  await step(tok);                                   // 2312.8 六個 message
  F.trees.forEach((u) => lit(u.body));
  say('這個例子有六個 message', '頻率分別是 2、3、5、7、9、13');
  await step(tok);                                   // 2349.8 選兩個 frequency 最小的 merge
  lit(F.trees[0].body, GOLD); lit(F.trees[1].body, GOLD);
  say('每次選兩個 frequency 最小的', '把它們 merge');
  talk(g, '最小的兩個', 'wow');
  await step(tok);                                   // 2367.8 2 和 3 最小 → merge 成 subtree
  lit(F.trees[0].body); lit(F.trees[1].body);
  t = F.merge(); showQ();
  say('2 和 3 最小 → merge 成一棵 subtree', '');
  await step(tok);                                   // 2400.8 這棵 tree = 更大的 message，頻率 5
  lit(t.body, GOLD);
  say('這棵 subtree 變成一個更大的 message', '出現次數 = 2 + 3 = 5');
  talk(g, '合體！', 'happy');
  await step(tok);                                   // 2423.8 剩五個：5 5 7 9 13
  lit(t.body);
  say('現在剩五個 message', '5、5、7、9、13');
  await step(tok);                                   // 2448.8 5 和 5 → 10
  lit(F.trees[0].body, GOLD); lit(F.trees[1].body, GOLD);
  await go(tok, 500);
  lit(F.trees[0].body); lit(F.trees[1].body);
  t = F.merge(); showQ();
  say('再取最小的 5 和 5 merge', '長出 frequency 10 的更大 tree');
  await step(tok);                                   // 2469.6 整棵 tree 視為一個 message 丟回 queue
  lit(t.body, GOLD);
  say('整棵 tree 視為一個 message', '再丟回 queue 裡');
  await step(tok);                                   // 2491.4 7 和 9 → 16
  lit(t.body);
  t = F.merge(); showQ();
  say('接著 7 和 9 被挑出來', '合成 16');
  await step(tok);                                   // 2502.0 依此類推：最後兩個 merge
  F.merge(); showQ(); await go(tok, 1100);
  t = F.merge(); showQ();
  say('依此類推：10 + 13 = 23', '最後兩個 16 + 23 = 39 → 一棵 tree');
  await step(tok);                                   // 2527.0 演算法很簡單
  lit(t.body, GOLD);
  say('queue 剩一棵：Huffman tree 完成', '6 個 message → merge 5 次（n − 1）');
  talk(g, '蠻簡單的！', 'happy');
}]);

// 42:30 Huffman 程式
FRAG.push(['treeb3-hcode', 'Huffman 程式：BinaryTree merge 與主迴圈', async (tok) => {
  const g = stage([0, 5, 14], [0, 3.8, 0.6], [6.8, 3.6]);
  const cd = code(['BinaryTree(bt1, bt2) {', '  root->leftChild = bt1.root;', '  root->rightChild = bt2.root;', '  root->weight = bt1.root->weight', '               + bt2.root->weight; }', 'Huffman(List<BinaryTree> l, n) {', '  for (i = 0; i < n-1; i++) {', '    first = l.DeleteMinWeight();', '    second = l.DeleteMinWeight();', '    bt = new BinaryTree(first, second);', '    l.Insert(*bt); } }'], -3.5, 7.3, 0.46);
  tag('queue l', 'ptr', 1.0, 1.25, 2.4);
  tag('first', 'idx', 2.5, 4.4); tag('second', 'idx', 5.3, 4.4);
  const iTag = tag('', 'ptr alt', 3.9, 7.5);
  const qx = (k) => V(1.0 + k * 1.05, 0.35, 2.4);
  const q = [2, 3, 5, 7, 9, 13].map((w, k) => ({ w, body: cube(w, ORG, NODE, qx(k).x, 0.35, 2.4, 2) }));
  const restack = () => q.forEach((e, k) => lab.springTo(e.body, qx(k)));
  let a, b, t, s1, s2;
  const take = (to) => { const e = q.shift(); restack(); lab.springTo(e.body, V(to, 5.0, 0)); lit(e.body, GOLD); return e; };
  const mergeAB = () => { t = { w: a.w + b.w, body: disc(a.w + b.w, SAND, 3.9, 6.2, 0, 1.2) }; s1 = seg(V(3.9, 5.9, 0), V(2.5, 5.3, 0), '#7a6a52'); s2 = seg(V(3.9, 5.9, 0), V(5.3, 5.3, 0), '#7a6a52'); };
  const insertT = () => { kill(s1); kill(s2); kill(a.body); kill(b.body); let k = q.findIndex((u) => u.w >= t.w); if (k < 0) k = q.length; q.splice(k, 0, t); restack(); };
  await step(tok);                                   // 2549.8 BinaryTree 宣告
  say('先看 BinaryTree 的宣告', '');
  await step(tok);                                   // 2557.8 private 部分有 root
  cd.hl(0);
  say('BinaryTree 的 private 部分有個 root', '');
  await step(tok);                                   // 2563.8 merge：bt1、bt2
  cd.hl(1); await go(tok, 500); cd.hl(2);
  say('這個建構子在做 merge', 'bt1、bt2 變成新 root 的左右子樹');
  await step(tok);                                   // 2586.8 weight = 兩邊加總
  cd.hl(3);
  say('每個 node 都有 weight（頻率）', '新 root 的 weight = bt1 + bt2 的 weight');
  talk(g, '頻率相加', 'happy');
  await step(tok);                                   // 2617.5 Huffman 函式
  cd.hl(5);
  say('接著看 Huffman 這個 function', '');
  await step(tok);                                   // 2631.8 n 個 message 丟進 queue
  q.forEach((e) => lit(e.body, GOLD)); await go(tok, 600); q.forEach((e) => lit(e.body));
  say('n 個 node = n 個要 encode 的 message', '全部丟進 queue');
  await step(tok);                                   // 2650.8 做 n − 1 次 merge
  cd.hl(6); setTag(iTag, 'i = 0（共 n − 1 = 5 次）');
  say('做 n − 1 次 merge', 'for loop');
  await step(tok);                                   // 2660.8 抓最小的兩個：first、second
  cd.hl(7); a = take(2.5); await go(tok, 500);
  cd.hl(8); b = take(5.3);
  say('從 queue 抓最小的兩個', 'first = 2，second = 3');
  await step(tok);                                   // 2678.8 new BinaryTree(first, second)
  cd.hl(9); mergeAB();
  say('new BinaryTree(first, second)', '一開始只是兩個 node → merge 成 5');
  talk(g, '2 + 3 = 5', 'wow');
  await step(tok);                                   // 2707.8 丟回 queue
  cd.hl(10); insertT();
  say('merge 出來的 tree 丟回 queue', 'l.Insert(*bt)');
  await step(tok);                                   // 2718.2 loop n − 1 次
  for (let i = 1; i < 5; i++) {
    setTag(iTag, 'i = ' + i);
    cd.hl(7); a = take(2.5); cd.hl(8); b = take(5.3); await go(tok, 220);
    cd.hl(9); mergeAB(); await go(tok, 220);
    cd.hl(10); insertT(); await go(tok, 120);
  }
  say('for loop 跑 n − 1 次', 'queue 最後只剩一棵：weight 39');
  await step(tok);                                   // 2724.0 或檢查 queue 是否只剩一棵
  cd.hl(-1);
  say('也可以不數 n − 1 次', '改成檢查 queue 只剩一棵就停');
  talk(g, '兩種都行', 'happy');
}]);

// 48:18 Huffman tree 讀碼
const HUFF6 = '39(16(7,9),23(10(5(2,3),5),13))';
FRAG.push(['treeb3-read', 'Huffman tree 讀碼：左 0 右 1', async (tok) => {
  const g = stage([0, 5, 13.5], [0, 3.8, 0.4], [6.6, 3.0]);
  const root = huffTree(HUFF6, { topY: 6.6, minY: 2.2 });
  const leaves = allNodes(root).filter((n) => !n.left);
  const L = (w) => leaves.find((n) => n.label === String(w));
  const cur = makeCursor();
  await step(tok);                                   // 2909.8 最後的 Huffman tree
  say('最後得到的就是 Huffman tree', '');
  await step(tok);                                   // 2916.4 leaf：方形 = message
  leaves.forEach((n) => glow(n, GOLD));
  say('leaf node（方形）就是 message', '共 6 個');
  await step(tok);                                   // 2931.8 message 想成 word：I、the、you
  leaves.forEach((n) => glow(n, OFF));
  [['the', 13], ['I', 9], ['you', 7]].forEach(([w, f]) => tag(w, 'note', L(f).pos.x, L(f).pos.y + 0.75, 0.3));
  say('message 就想成 word', '例如 I、the、you（示意）');
  await step(tok);                                   // 2947.8 頻率才重要
  say('字是什麼不重要', '方框裡的數字（頻率）才重要');
  talk(g, '只看次數', 'happy');
  await step(tok);                                   // 2983.8 頻率高 → 靠近 root
  glow(L(13), GOLD);
  say('出現頻率很高的字', '讓它越靠近 root 越好');
  await step(tok);                                   // 2993.8 很少出現 → 離 root 遠
  glow(L(2), RED); glow(L(3), RED);
  say('很少出現的 2、3', '離 root 越遠越好，用比較長的碼');
  await step(tok);                                   // 3030.8 左 0 右 1
  allNodes(root).forEach((n) => glow(n, OFF));
  allBits(root);
  say('碼怎麼讀：往左記 0，往右記 1', '');
  talk(g, '左 0 右 1', 'wow');
  await step(tok);                                   // 3039.6 2 的碼 1000
  const b2 = await readPath(tok, root, L(2), cur, 380);
  under(L(2), b2);
  say('頻率 2 的字：右、左、左、左', '碼 = 1000');
  await step(tok);                                   // 3053.9 3 的碼 1001
  allNodes(root).forEach((n) => glow(n, OFF));
  const b3 = await readPath(tok, root, L(3), cur, 380);
  under(L(3), b3);
  cur.obj.visible = false;
  say('頻率 3 的字', '碼 = 1001');
  talk(g, '長一點沒關係', 'happy');
}]);

// 51:25 Bottom-up 合併與虛擬字
FRAG.push(['treeb3-bottom', 'Bottom-up 合併與虛擬的字', async (tok) => {
  const g = stage([0, 4.8, 14], [0, 3.8, 0], [6.6, 3.0]);
  const F = forest([2, 3, 5, 7, 9, 13], { topY: 6.4 });
  F.spawn();
  let t5, t10;
  await step(tok);                                   // 3085.2 關鍵字：bottom-up
  tag('bottom-up', 'ptr alt', 0, 7.7);
  say('建 Huffman tree 的關鍵字：bottom-up', '由下往上蓋');
  talk(g, '從下面蓋', 'wow');
  await step(tok);                                   // 3093.8 頻率少的先 merge
  say('頻率比較少的字', '先 merge 成一棵 subtree');
  await step(tok);                                   // 3106.8 2、3 出現最少
  lit(F.trees[0].body, GOLD); lit(F.trees[1].body, GOLD);
  say('六個字 2、3、5、7、9、13', '出現次數最少的是 2 和 3');
  await step(tok);                                   // 3122.8 merge 起來
  lit(F.trees[0].body); lit(F.trees[1].body);
  t5 = F.merge();
  say('把 2 和 3 merge 起來', '');
  await step(tok);                                   // 3134.6 圓圈 5：虛擬的合併字
  lit(t5.body, GOLD);
  tag('虛擬的字（virtual）', 'note', t5.pos.x, t5.pos.y + 0.9, 0.3);
  say('圓圈 5：一個虛擬的、合起來的字', '它的頻率是 5');
  await step(tok);                                   // 3166.8 到這個 subtree 也有碼 100
  tag('到這裡的碼 100，2、3 共用', 'pkt', t5.pos.x, t5.pos.y - 1.8, 0.4);
  say('整棵蓋好後，到圓圈 5 的碼是 100', '2、3 共用 100，下一層才分支（老師說成 0100）');
  await step(tok);                                   // 3226.8 內部節點 = subtree 頻率總和
  lit(t5.body);
  say('過渡時期產生的 tree node', '上面的數字 = subtree 頻率的總和');
  await step(tok);                                   // 3248.8 五個 message：5 5 7 9 13
  tag('queue：5, 5, 7, 9, 13', 'ptr', 0, 0.6, 1.0);
  say('本來六個字，2、3 合成一個', '現在五個：5、5、7、9、13');
  await step(tok);                                   // 3263.8 5 和 5 → 10
  t10 = F.merge();
  lit(t10.body, GOLD);
  say('最小的 5 和 5 抓出來合併', '變成 10：整棵 subtree 當一個虛擬的字');
  talk(g, '再合體', 'happy');
  await step(tok);                                   // 3307.8 每次從 queue 抓最小兩個
  lit(t10.body);
  F.merge(); await go(tok, 600); F.merge(); await go(tok, 600);
  const r = F.merge(); await go(tok, 400);
  const n23 = r.right, n10 = n23.left, n5 = n10.left;
  bitTag(r, n23, '1'); bitTag(n23, n10, '0'); bitTag(n10, n5, '0'); bitTag(n5, n5.left, '0'); bitTag(n5, n5.right, '1');
  say('每次都從 queue 抓頻率最小的兩個合併', '最後得到 Huffman tree（2 = 1000、3 = 1001）');
}]);

// 55:37 Huffman tree 是否唯一 → priority queue
FRAG.push(['treeb3-tie', 'Huffman tree 是否唯一；引出 priority queue', async (tok) => {
  const g = stage([0, 5, 14], [0, 3.6, 0.6], [6.6, 3.2]);
  const FA = forest([1, 1, 2, 2], { cx: -3.4, topY: 6.4, step: 1.2, spc: 0.75, gap: 0.45, tie: 'first' });
  const FB = forest([1, 1, 2, 2], { cx: 3.4, topY: 6.4, step: 1.2, spc: 0.75, gap: 0.45, tie: 'last' });
  let qb;
  await step(tok);                                   // 3337.8 Huffman tree 唯一嗎？
  FA.spawn(); FB.spawn();
  tag('樹 A', 'ptr', -3.4, 7.6); tag('樹 B', 'ptr', 3.4, 7.6);
  say('問題：Huffman tree 是唯一的嗎？', '示意：頻率 1, 1, 2, 2');
  talk(g, '唯一嗎？', 'wow');
  await step(tok);                                   // 3361.8 同分的時候怎麼辦？
  FA.merge(); FB.merge();
  await go(tok, 600);
  [FA.trees[0], FA.trees[1]].forEach((u) => lit(u.body, GOLD));
  [FB.trees[0], FB.trees[1]].forEach((u) => lit(u.body, GOLD));
  say('不一定！看同分的時候怎麼選', '1 + 1 = 2 之後有三個 2：A、B 選的不同');
  await step(tok);                                   // 3370.5 不見得是唯一的
  FA.all.forEach((n) => lit(n.body)); FB.all.forEach((n) => lit(n.body));
  FA.merge(); FB.merge(); await go(tok, 600); FA.merge(); FB.merge();
  tag('Σ = 12', 'ptr alt', -3.4, 2.4, 0.4); tag('Σ = 12', 'ptr alt', 3.4, 2.4, 0.4);
  say('得到兩棵形狀不同的 Huffman tree', '不唯一，但總長 Σ 頻率 × 碼長 一樣（補充）');
  await step(tok);                                   // 3391.8 DeleteMinWeight
  tag('queue', 'ptr', -5.4, 0.5, 3.0);
  qb = [5, 2, 9, 3].map((v, k) => cube(v, BLU, SMALL, -3.8 + k * 1.0, 0.3, 3.0, 2));
  tag('front', 'idx', -3.8, 0.95, 3.0);
  say('Huffman function 裡有個動作', 'DeleteMinWeight（queue 示意：5, 2, 9, 3）');
  await step(tok);                                   // 3399.8 選第一小、再選第二小
  lit(qb[1], GOLD); await go(tok, 500); lab.flyAway(qb[1], V(0, 8, 3));
  await go(tok, 600);
  lit(qb[3], GOLD); await go(tok, 500); lab.flyAway(qb[3], V(0, 8, 3));
  say('delete 一次選出 first（最小 2）', '再 delete 一次選 second（第二小 3）');
  await step(tok);                                   // 3417.7 不是 FIFO → priority queue
  tag('不是 first in first out，而是看 priority → priority queue', 'good', 0, 1.6, 3.0);
  say('這種 delete 不遵守 first in first out', '而是依 priority → priority queue');
  talk(g, '插隊佇列！', 'happy');
}]);

// 57:36 Priority queue：max / min
FRAG.push(['treeb3-pq', 'Priority Queue：max／min 與 heap', async (tok) => {
  const g = stage([0, 5, 14], [0, 2.8, 0.6], [6.6, 3.6]);
  const BX = [-3.3, 3.3];
  const boxes = [new Map(), new Map()], outs = [[], []];
  const del = async (j, v) => { const b = boxes[j].get(v); lit(b, GOLD); await go(tok, 500); lab.springTo(b, V(BX[j] - 0.9 + outs[j].length * 1.0, 4.4, 0)); outs[j].push(v); };
  await step(tok);                                   // 3456.3 Priority Queue 是什麼
  BX.forEach((x, j) => { ghost(j ? TEAL : PUR, x, 1.1, 3.4, 2.2, 0, 2.2); });
  say('Priority queue：顧名思義也是 queue', '');
  await step(tok);                                   // 3466.6 add：放進去
  const IN = [100, 1, 37, 8];
  for (let k = 0; k < IN.length; k++) { BX.forEach((x, j) => boxes[j].set(IN[k], cube(IN[k], j ? TEAL : PUR, NODE, x - 1.05 + k * 0.7, 0.3 + (k % 2) * 0.7, (k % 2) * 0.5 - 0.3, 3))); await go(tok, 300); }
  say('Add：把 element 放進 queue', '看不出裡面在搞什麼（示意：100, 1, 37, 8）');
  await step(tok);                                   // 3487.8 delete 時動手腳：priority
  say('重點在 delete', '每個元素都有自己的 priority');
  talk(g, '看誰優先', 'wow');
  await step(tok);                                   // 3501.8 兩種：max、min
  tag('max priority queue', 'ptr', BX[0], 2.7); tag('min priority queue', 'ptr', BX[1], 2.7);
  say('分兩種', 'max priority queue、min priority queue');
  await step(tok);                                   // 3519.8 max：delete 回傳最大
  await del(0, 100);
  say('max priority queue', '每次 delete 回傳目前最大的：100');
  await step(tok);                                   // 3539.8 min：回傳最小
  await del(1, 1);
  say('min priority queue', 'delete 回傳最小的：1');
  await step(tok);                                   // 3557.8 Huffman 用 priority queue
  tag('Huffman：每次取最小 → min PQ', 'idx', 0, 0.2, 3.2);
  say('剛才的 Huffman 就用了 priority queue', '');
  await step(tok);                                   // 3564.8 machine service
  tag('machine service：最短的 job 先做 → min PQ', 'idx', 0, 0.2, 3.9);
  say('machine service：每個 job 要花的時間', '最短的先做 → min priority queue');
  await step(tok);                                   // 3593.8 heap ＝ priority queue
  tag('heap', 'good', 0, 5.6);
  say('priority queue 還有個常聽到的名字：heap', '補充：嚴格說 heap 是實作 PQ 的資料結構');
  talk(g, 'heap！', 'happy');
}]);

// 1:00:28 Priority queue 實作方式比較
FRAG.push(['treeb3-pqimpl', 'Priority queue 實作方式比較', async (tok) => {
  const g = stage([0, 5, 14.5], [0, 3.6, 0.4], [6.8, 3.6]);
  const NX = [-1.4, 0.6];
  await step(tok);                                   // 3628.8 unordered linked list
  [['unordered linked list', 6.6], ['unordered array', 5.2], ['sorted linked list', 3.8], ['sorted array', 2.4]].forEach(([nm, y]) => tag(nm, 'ptr', -4.6, y));
  say('一堆數字，可以怎麼存？', '第一種：unordered linked list');
  await step(tok);                                   // 3643.8 100 塞進去，再塞 1
  let y = 6.6;
  cube(100, PUR, [0.9, 0.5, 0.6], NX[0], y, 0, 2); await go(tok, 500);
  cube(1, PUR, [0.9, 0.5, 0.6], NX[1], y, 0, 2); arrow(V(NX[0] + 0.5, y, 0), V(NX[1] - 0.5, y, 0));
  say('沒有順序：給我 100 就塞進去，再給 1 也塞', 'list：100 → 1');
  await step(tok);                                   // 3664.6 unordered array
  y = 5.2;
  NX.forEach((x, k) => tag('a[' + k + ']', 'idx', x, y - 0.55, 0.4));
  cube(100, BLU, [0.9, 0.5, 0.6], NX[0], y, 0, 2); await go(tok, 500);
  cube(1, BLU, [0.9, 0.5, 0.6], NX[1], y, 0, 2);
  say('unordered array 也一樣', '100 放 a[0]，1 放 a[1]');
  await step(tok);                                   // 3690.8 sorted linked list：1、100
  y = 3.8;
  const s100 = cube(100, TEAL, [0.9, 0.5, 0.6], NX[0], y, 0, 2); await go(tok, 500);
  lab.springTo(s100, V(NX[1], y, 0)); cube(1, TEAL, [0.9, 0.5, 0.6], NX[0], y, 0, 2); arrow(V(NX[0] + 0.5, y, 0), V(NX[1] - 0.5, y, 0), '#c08a1f');
  say('sorted linked list：每次 insert 都排序', '先放 1，再放 100');
  await step(tok);                                   // 3728.0 sorted array
  y = 2.4;
  NX.forEach((x, k) => tag('a[' + k + ']', 'idx', x, y - 0.55, 0.4));
  const big = cube(100, ORG, [0.9, 0.5, 0.6], NX[0], y, 0, 2); await go(tok, 500);
  lab.springTo(big, V(NX[1], y, 0)); await go(tok, 500);
  cube(1, ORG, [0.9, 0.5, 0.6], NX[0], y, 0, 2);
  say('sorted array 也一樣排序', '100 往後搬，1 放 a[0]');
  await step(tok);                                   // 3742.8 list：pointer assignment；array：data movement
  tag('pointer assignment', 'idx', 2.2, 3.8); tag('data movement', 'idx', 2.2, 2.4);
  say('差別：list 排序靠 pointer assignment', 'array 排序要 data movement（搬資料）');
  await step(tok);                                   // 3801.8 unordered：insert 快、delete 要 scan
  tag('Insert Θ(1)｜Delete Θ(n)', 'ptr alt', 4.6, 6.6); tag('Insert Θ(1)｜Delete Θ(n)', 'ptr alt', 4.6, 5.2);
  say('unordered：insert 直接丟進來，很快', 'delete 最大／最小要 scan 全部 → 先甘後苦');
  talk(g, '先甘後苦', 'wow');
  await step(tok);                                   // 3839.0 sorted：insert 慢、delete 快
  tag('Insert O(n)｜Delete Θ(1)', 'ptr alt', 4.6, 3.8); tag('Insert O(n)｜Delete Θ(1)', 'ptr alt', 4.6, 2.4);
  say('sorted 剛好相反：insert 要比較 O(n)', '但 delete 很快 → 先苦後甘');
  await step(tok);                                   // 3879.5 max heap：都是 log n
  tag('max heap', 'ptr', -4.6, 1.0);
  cube(100, GRN, [0.8, 0.5, 0.6], -0.4, 1.3, 0, 2); cube(1, GRN, [0.8, 0.5, 0.6], -1.2, 0.35, 0, 2);
  seg(V(-0.5, 1.05, 0), V(-1.1, 0.6, 0), '#7a6a52');
  tag('Insert O(log n)｜Delete O(log n)', 'good', 4.6, 1.0);
  say('max heap：不管 insert 或 delete', '都是 O(log n)');
  talk(g, '兩邊都快', 'happy');
  await step(tok);                                   // 3920.8 log n：heap 用 tree 表示，看高度
  say('log n 隱含什麼？', 'heap 用 tree 表示，操作只沿著樹的高度走');
}]);

// 1:05:57 Max／Min heap 定義與陣列表示
function heapSet(vals, o) {
  const O = Object.assign({ cx: 0, topY: 6.4, step: 1.4, width: 7, ax: -2.2, adx: 0.9, cells: 6, color: BLU, drop: 0, ms: 0 }, o);
  const pos = (i) => heapPos(i, O.topY, O.step, O.width).add(V(O.cx, 0, 0));
  const cellP = (i) => V(O.ax + (i - 1) * O.adx, 0.35, 2.4);
  const H = [null], A = [null];
  for (let i = 1; i <= O.cells; i++) { floorTile(cellP(i).x, 2.4); tag('[' + i + ']', 'idx', cellP(i).x, 0, 3.05); const p = pos(i); tag(String(i), 'idx', p.x + 0.58, p.y - 0.32, 0.3); }
  edgeLines(() => { const out = []; for (let i = 2; i < H.length; i++) if (H[i] && H[i >> 1]) out.push([H[i >> 1].obj.position, H[i].obj.position]); return out; });
  const S = { O, pos, cellP, H, A,
    put(i, v, color, drop) { const p = pos(i), c = cellP(i); H[i] = cube(v, color || O.color, NODE, p.x, p.y, 0, drop || 0); H[i].v = v; A[i] = cube(v, color || O.color, SMALL, c.x, 0.35, 2.4, drop || 0); A[i].v = v; },
    async fill(tok) { for (let k = 0; k < vals.length; k++) { S.put(k + 1, vals[k], null, O.drop); if (O.ms) await beat(tok, O.ms); } },
    swap(i, j) { [H[i], H[j]] = [H[j], H[i]]; [A[i], A[j]] = [A[j], A[i]]; lab.springTo(H[i], pos(i)); lab.springTo(H[j], pos(j)); lab.springTo(A[i], cellP(i)); lab.springTo(A[j], cellP(j)); },
  };
  return S;
}
FRAG.push(['treeb3-heapdef', 'Max／Min heap 定義與陣列表示', async (tok) => {
  const g = stage([0, 5, 14], [0, 3.6, 0.8], [6.8, 3.6]);
  tag('max heap', 'ptr', -3.4, 7.4);
  let MX, MN;
  await step(tok);                                   // 3956.8 heap 是一棵 tree，root 很重要
  MX = heapSet([14, 12, 7, 10, 8, 6], { cx: -3.4, width: 5.4, topY: 6.4, step: 1.35, ax: -5.6, adx: 0.8, color: BLU, drop: 3, ms: 200 });
  await MX.fill(tok);
  say('heap 是一棵 tree', '這棵 tree 的 root 很重要');
  await step(tok);                                   // 3975.6 max heap：root 永遠最大
  lit(MX.H[1], GOLD);
  say('max heap：root 永遠是最大的', '所有數字裡最大的 14 放在 root');
  talk(g, '老大在上', 'happy');
  await step(tok);                                   // 3984.8 下面沒有人比它大
  lit(MX.H[1]);
  for (const [p, cs] of [[1, [2, 3]], [2, [4, 5]], [3, [6]]]) { [p, ...cs].forEach((i) => lit(MX.H[i], GREEN)); await go(tok, 500); [p, ...cs].forEach((i) => lit(MX.H[i])); }
  say('下面的 subtree 沒有一個比它大', '補充：每個 subtree 自己也是 max heap');
  await step(tok);                                   // 3991.8 min heap：最小的在 root
  tag('min heap', 'ptr', 3.4, 7.4);
  MN = heapSet([2, 7, 4, 10, 8, 6], { cx: 3.4, width: 5.4, topY: 6.4, step: 1.35, ax: 1.4, adx: 0.8, color: TEAL, drop: 3, ms: 200 });
  await MN.fill(tok);
  say('min heap：最小的放在 root', '下面沒有比它更小的');
  await step(tok);                                   // 3999.3 一定是 complete binary tree
  tag('一定是 complete binary tree', 'good', 0, 7.9);
  say('不管 max 或 min heap', '都一定是 complete binary tree');
  await step(tok);                                   // 4014.7 左右沒有大小規定
  lit(MX.H[2], GOLD); lit(MX.H[3], GOLD); lit(MN.H[2], GOLD); lit(MN.H[3], GOLD);
  say('有沒有規定左邊一定比右邊大？', '沒有！max：12 > 7；min：7 > 4，都合法');
  talk(g, '左右不管', 'wow');
  await step(tok);                                   // 4049.8 旁邊的編號 1～6
  [2, 3].forEach((i) => { lit(MX.H[i]); lit(MN.H[i]); });
  say('例：max heap 14、12、7、10、8、6', '節點旁邊的編號 1～6 是什麼？');
  await step(tok);                                   // 4069.8 用 array 表示：1 放 14、2 放 12…
  for (let i = 1; i <= 4; i++) { lit(MX.A[i], GOLD); lit(MX.H[i], GOLD); await go(tok, 350); }
  say('這棵 tree 用 array 表示', '1 放 14、2 放 12、3 放 7、4 放 10');
  await step(tok);                                   // 4148.8 跟 BST 區分
  for (let i = 1; i <= 4; i++) { lit(MX.A[i]); lit(MX.H[i]); }
  tag('BST：左小右大 ≠ heap', 'bad', 0, 1.4, 2.4);
  say('要特別強調：等一下的 Binary Search Tree', '才有「左邊小、右邊大」；heap 只管 root');
  await step(tok);                                   // 4179.8 min heap 示意圖
  lit(MN.H[1], GOLD); lit(MN.A[1], GOLD);
  say('min heap 示意圖：最小的放在 root', 'array：2 放 [1]、7 放 [2]……');
  talk(g, '小的在上', 'happy');
}]);

// 1:10:16 Max heap insert：1、5、21
FRAG.push(['treeb3-hins', 'Max heap insert 範例：1、5、21', async (tok) => {
  const BASE = [20, 15, 2, 14, 10];
  let S, g, tg;
  const base = (v) => {
    g = stage([0, 5, 13.5], [0, 3.6, 0.8], [6.6, 3.6]);
    S = heapSet(BASE, { cx: 0, width: 7, topY: 6.4, step: 1.45, ax: -2.2, adx: 0.9 });
    BASE.forEach((x, k) => S.put(k + 1, x));
    if (v) tg = tag('insert ' + v, 'ptr alt', 4.6, 7.2);
  };
  const cmp = (i, p) => { lit(S.H[i], GOLD); lit(S.H[p], GOLD); };
  const off = (i, p) => { lit(S.H[i]); lit(S.H[p]); };
  base();
  await step(tok);                                   // 4215.8 insert 會發生什麼事？
  say('max heap：[20, 15, 2, 14, 10]', 'insert 會發生什麼事？');
  talk(g, 'insert！', 'wow');
  await step(tok);                                   // 4237.8 可能要調整：比 root 還大
  tag('比老大還大 → 要調整', 'note', 4.6, 6.4);
  say('insert 進來可能要調整', '例如新值比 root 還大');
  await step(tok);                                   // 4255.5 insert 1
  tg = tag('insert 1', 'ptr alt', 4.6, 7.2);
  S.put(6, 1, ORG, 3);
  say('insert 1：放在 2 的下面', '位置 6（2 的左子）');
  await step(tok);                                   // 4276.8 1 沒有比 parent 大 → 結束
  cmp(6, 3);
  say('1 跟 parent 2 比：沒有比較大', '乖乖待在原地，insert 結束（老師說成和 20 比）');
  await step(tok);                                   // 4286.0 可以放右邊子樹嗎？
  off(6, 3);
  const gh = ghost('#e06666', S.pos(7).x, S.pos(7).y, 0.9, 0.7, 0, 0.9);
  tag('✗', 'bad', S.pos(7).x, S.pos(7).y + 0.6);
  say('可不可以放在右邊的位置？', '不行！');
  talk(g, '搖頭', 'sad');
  await step(tok);                                   // 4302.8 heap 是 complete binary tree
  kill(gh);
  tag('complete：先填滿左邊再填右邊', 'good', 0, 1.4, 2.4);
  say('因為 heap 是 complete binary tree', '要依序填位置，只能放在 6');
  await step(tok);                                   // 4319.0 insert 5
  base(5);
  S.put(6, 5, ORG, 3);
  say('同一個原 heap：insert 5', '5 先放在下面的位置 6');
  await step(tok);                                   // 4374.8 兩步驟 ①：放在最末端
  tag('① 放在最後一個位置', 'ptr', -4.6, 6.4);
  say('其實只要做兩件事', '① 新元素先放在 heap 最末端，維持 complete');
  await step(tok);                                   // 4410.8 ② 跟 parent 比，大就往上
  tag('② 跟 parent 比，大就往上爬', 'ptr', -4.6, 5.7);
  say('② 跟你的 parent 比', '比 parent 大就上去，一直檢查到不能爬為止');
  talk(g, '往上爬！', 'happy');
  await step(tok);                                   // 4442.0 5 和 2 比：2 掉下來
  cmp(6, 3); await go(tok, 600); off(6, 3); S.swap(6, 3);
  say('5 和 2 比：2 比較小', '2 掉下來，5 上去');
  await step(tok);                                   // 4462.0 5 和 20 比：停
  cmp(3, 1);
  say('5 再和 20 比：5 比較小', 'stop，insert 結束 → [20, 15, 5, 14, 10, 2]');
  await step(tok);                                   // 4485.0 insert 21
  base(21);
  S.put(6, 21, ORG, 3);
  say('insert 21：遵照同樣原則', '先放在 2 的下面');
  await step(tok);                                   // 4498.0 21 比 2 大 → 往上
  cmp(6, 3); await go(tok, 500); off(6, 3); S.swap(6, 3);
  say('21 跟 parent 2 比：21 比較大', '21 往上爬，2 往下掉');
  await step(tok);                                   // 4505.0 21 比 20 大 → swap 到 root
  cmp(3, 1); await go(tok, 500); off(3, 1); S.swap(3, 1);
  say('21 再跟 20 比：還是比較大', 'swap → 21 成為新的 root');
  talk(g, '新老大！', 'wow');
  await g.hop(tok);
}]);

// 1:15:57 Max heap insert 程式（陣列）
FRAG.push(['treeb3-hcode2', 'Max heap insert 程式（陣列實作）', async (tok) => {
  const g = stage([0, 5, 14], [0, 3.6, 0.8], [-6.6, 3.0]);
  const cd = code(['insert_max_heap(item, *n) {', '  if (HEAP_FULL(*n)) exit(1);', '  i = ++(*n);', '  while (i != 1 &&', '     item.key > heap[i/2].key) {', '    heap[i] = heap[i/2];', '    i /= 2;', '  }', '  heap[i] = item;', '}'], -3.9, 7.2, 0.48);
  const S = heapSet([20, 15, 2, 14, 10], { cx: 3.4, width: 5.2, topY: 6.4, step: 1.4, ax: 0.6, adx: 0.85 });
  [20, 15, 2, 14, 10].forEach((x, k) => S.put(k + 1, x));
  const nT = tag('', 'ptr', 6.3, 2.0, 2.4);
  const iT = tag('', 'ptr alt', 0, 1.2, 2.4);
  const showI = (i) => { const c = S.cellP(i); iT.position.set(c.x, 1.2, 2.4); setTag(iT, 'i = ' + i); };
  let item, gh;
  const moveDown = (i, p) => { S.H[i] = S.H[p]; S.A[i] = S.A[p]; S.H[p] = null; S.A[p] = null; lab.springTo(S.H[i], S.pos(i)); lab.springTo(S.A[i], S.cellP(i)); };
  await step(tok);                                   // 4556.8 heap 用 array 實作
  say('heap 用 array 來 implement', '');
  await step(tok);                                   // 4574.8 array 大小 MaxSize
  cd.hl(0);
  tag('array 大小 = MAX_SIZE', 'idx', 3.4, 0.6, 3.4);
  say('array 配置的空間大小是 MaxSize', '');
  await step(tok);                                   // 4583.0 n == MaxSize → 滿了
  cd.hl(1);
  say('如果 n 剛好等於 MaxSize', '代表 heap 滿了，放不下');
  await step(tok);                                   // 4603.0 n 記錄最後一個元素的 index
  setTag(nT, 'n = ?');
  say('n 記錄 heap 最後一個元素', '在 array 裡的 index');
  await step(tok);                                   // 4644.0 n = 5（老師先說 6 後更正）
  setTag(nT, 'n = 5');
  say('這裡放在 1～5，所以 n = 5', '老師先說 6，後來更正');
  talk(g, 'n = 5', 'happy');
  await step(tok);                                   // 4677.8 n++ → 6，21 放到位置 6
  cd.hl(2); setTag(nT, 'n = 6'); showI(6);
  gh = ghost('#c08a1f', S.pos(6).x, S.pos(6).y, 0.9, 0.7, 0, 0.9);
  item = cube(21, ORG, NODE, 6.4, 7.4, 0, 2); tag('item', 'idx', 6.4, 8.0);
  say('沒超過 MaxSize：n++，5 變成 6', '新的 21 從位置 6 開始');
  await step(tok);                                   // 4699.5 parent 在 n / 2
  lit(S.H[3], GOLD);
  say('位置 n 的 parent 在 n / 2', '6 / 2 = 3 → heap[3] = 2');
  await step(tok);                                   // 4753.9 i 從 n 開始，到 1 就停
  lit(S.H[3]); cd.hl(3);
  say('迴圈：i 一開始 = n', 'i 到 1（root）就停止');
  await step(tok);                                   // 4775.8 比 parent 大 → parent 往下搬
  cd.hl(4); lit(item, GOLD); lit(S.H[3], GOLD); await go(tok, 500); lit(S.H[3]); lit(item);
  cd.hl(5); kill(gh); moveDown(6, 3);
  say('21 > parent 2 → 把 parent 往下搬', 'heap[6] = heap[3]（老師口說 swap）');
  await step(tok);                                   // 4791.6 i 每次除以 2
  cd.hl(6); showI(3); await go(tok, 600);
  cd.hl(4); lit(S.H[1], GOLD); await go(tok, 500); lit(S.H[1]);
  cd.hl(5); moveDown(3, 1); await go(tok, 300); cd.hl(6); showI(1);
  say('i /= 2 → i = 3，21 > 20 再搬一次', 'i /= 2 → i = 1');
  await step(tok);                                   // 4809.8 到 root 就跳出
  cd.hl(8);
  S.H[1] = item; item.v = 21; lab.springTo(item, S.pos(1));
  S.A[1] = cube(21, ORG, SMALL, S.cellP(1).x, 0.35, 2.4, 2);
  say('i == 1 到達 root → 跳出迴圈', 'heap[1] = item → [21, 15, 20, 14, 10, 2]');
  talk(g, '只搬 parent', 'happy');
}]);

// 1:20:37 Max heap delete：直覺作法（未完待續）
FRAG.push(['treeb3-hdel', 'Max heap delete：直覺作法', async (tok) => {
  const g = stage([0, 5, 13.5], [0, 3.6, 0.8], [6.6, 3.6]);
  const S = heapSet([20, 15, 2, 14, 10], { cx: 0, width: 7, topY: 6.4, step: 1.45, ax: -2.2, adx: 0.9, cells: 5 });
  [20, 15, 2, 14, 10].forEach((x, k) => S.put(k + 1, x));
  const mv = (from, to) => { S.H[to] = S.H[from]; S.A[to] = S.A[from]; S.H[from] = S.A[from] = null; lab.springTo(S.H[to], S.pos(to)); lab.springTo(S.A[to], S.cellP(to)); };
  await step(tok);                                   // 4837.1 delete 怎麼做？先看例子
  tag('老師的直覺作法', 'ptr', 0, 7.6);
  say('delete 更複雜', '先看例子，不看程式');
  talk(g, 'delete 呢？', 'wow');
  await step(tok);                                   // 4847.4 20 被拿掉，空了
  lab.flyAway(S.H[1], V(0, 8, 4)); lab.flyAway(S.A[1], V(0, 8, 4)); S.H[1] = S.A[1] = null;
  say('delete：root 的 20 就空掉了', '');
  await step(tok);                                   // 4863.0 從剩下的找最大
  [2, 3, 4, 5].forEach((i) => lit(S.H[i], GOLD));
  say('要從剩下的數字裡找最大的補上', '15、2、14、10');
  await step(tok);                                   // 4882.8 15 最大 → 移上來
  [2, 3, 4, 5].forEach((i) => lit(S.H[i]));
  mv(2, 1);
  say('笨方法：檢查一遍，15 最大', '把 15 移上來');
  await step(tok);                                   // 4892.8 15 的位置空了 → 放 14
  lit(S.H[4], GOLD); lit(S.H[5], GOLD); await go(tok, 500); lit(S.H[4]); lit(S.H[5]);
  mv(4, 2);
  say('15 原來的位置又空了：放 14 還是 2？', '當然放 14，它跳上來');
  await step(tok);                                   // 4923.6 最笨的方法：一路補洞
  ghost('#d64545', S.pos(4).x, S.pos(4).y, 0.9, 0.7, 0, 0.9);
  ghost('#d64545', S.cellP(4).x, 0.35, 0.8, 0.5, 2.4, 0.8);
  say('最笨的方法：挑最大的補洞，再往下補', '補充：這樣中間會有洞，不再是 complete');
  talk(g, '有洞了…', 'sad');
  await step(tok);                                   // 4943.6 不是最後的 solution，下次講
  tag('正解（下次講）：最後一個移到 root，再往下換', 'good', 0, 1.4, 2.4);
  say('這顯然不是最後的 solution', '下次再講（補充：課本 O(log n) 作法）');
}]);
  }

  // ═══ treec.js ═══
  {
// ─── treec：交大彭文志 Lec15–17（heap、Huffman、BST、selection tree、disjoint set）— cued scenes ───
// 每個 await step(tok) 等老師講到那句話才動；step 之間只留短短的移動。
// 數值是方塊；「暫存的變數」（k、item、x）是小角色 buddy；資料流動用 pkt 標籤 travel 過去。
const KT = kit(ctx);
const { step, buddy, prop, bob, travel, zone, remove } = KT;
const TB = '#e9dcc4', PINK = '#f4d9d0', TGOLD = '#f2c46d', TGREEN = '#cfe8dc';
const BLUE = '#4b9ee2', ORANGE = '#dd8238', PURPLE = '#9b7ef4', STALE = '#c9bfae', KCOL = '#e55a9b';
const LEAFC = '#2fc092', INC = '#c9a86a', GRAYC = '#8fa3b8', YEL = '#f2c46d';
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const sayT = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const okT = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const noT = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const mono = (l) => { Object.assign(l.element.style, MONO); return l; };
const wait = (tok, ms) => beat(tok, ms);
// 一個 pkt 標籤從 a 飛到 b（飛完就消失）
async function fling(tok, text, a, b, ms = 900) { const l = pkt(text, a.x, a.y, a.z); await travel(tok, l, a, b, ms); remove(l); }
function bar(color, w, d, x, z) { const m = lab.box(color, [w, 1, d]); m.scale.y = 0.001; m.position.set(x, 0, z); lab.world.add(m); return m; }
function growBar(tok, m, h, ms) { const h0 = m.scale.y; return anim(tok, ms, (t) => { const v = h0 + (h - h0) * t; m.scale.y = v; m.position.y = v / 2; }); }
function wire(pos) {
  const g = new THREE.Mesh(new THREE.BoxGeometry(...NODE), new THREE.MeshBasicMaterial({ color: '#b08a4a', wireframe: true, transparent: true, opacity: 0.6 }));
  g.position.copy(pos); lab.world.add(g); return g;
}
// ── 1-based heap 視圖：上面是樹、前面是 array（每個值 = 樹上方塊 n + 陣列格方塊 c） ──
function HV(vals, o = {}) {
  const Q = Object.assign({ cx: 0, top: 6.2, step: 1.35, width: 7, ax: 0, az: 2.6, dx: 0.9, cells: 6, col: BLUE, arr: true }, o);
  const H = { Q, slot: new Map(), tiles: [], hasArr: false };
  H.tp = (i) => heapPos(i, Q.top, Q.step, Q.width).add(V(Q.cx, 0, 0));
  H.cp = (i) => V(Q.ax + (i - (Q.cells + 1) / 2) * Q.dx, 0.3, Q.az);
  const cellOf = (i, v, color, drop) => { const c = lab.addBody(block(v, SMALL, color)); const b = H.cp(i); if (drop) { c.obj.position.copy(b).add(V(0, drop, 0)); lab.dropTo(c, b); } else { c.obj.position.copy(b); c.target.copy(b); } return c; };
  H.addArr = (drop = 0) => {
    for (let i = 1; i <= Q.cells; i++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(Q.dx * 0.88, 0.08, 0.9), new THREE.MeshStandardMaterial({ color: TB, roughness: 1 }));
      t.position.copy(H.cp(i)).setY(0.04); lab.world.add(t); H.tiles[i] = t;
      tag('[' + i + ']', 'idx', H.cp(i).x, 0, Q.az + 0.75);
    }
    for (const [i, p] of H.slot) if (!p.c) p.c = cellOf(i, p.v, p.color, drop);
    H.hasArr = true;
  };
  edgeLines(() => {
    const out = [];
    for (const [i, p] of H.slot) for (const c of [2 * i, 2 * i + 1]) { const q = H.slot.get(c); if (q && p.n && q.n) out.push([p.n.obj.position, q.n.obj.position]); }
    return out;
  });
  H.mk = (i, v, color = Q.col, drop = 0) => {
    const n = lab.addBody(block(v, NODE, color)); const a = H.tp(i);
    if (drop) { n.obj.position.copy(a).add(V(0, drop, 0)); lab.dropTo(n, a); } else { n.obj.position.copy(a); n.target.copy(a); }
    const p = { v, n, c: H.hasArr ? cellOf(i, v, color, drop) : null, color }; H.slot.set(i, p); return p;
  };
  H.at = (i) => H.slot.get(i);
  H.mv = (p, i) => { lab.springTo(p.n, H.tp(i)); if (p.c) lab.springTo(p.c, H.cp(i)); };
  H.swap = (i, j) => { const p = H.at(i), q = H.at(j); H.mv(p, j); H.mv(q, i); H.slot.set(i, q); H.slot.set(j, p); };
  H.lit = (i, c) => { const p = H.at(i); if (p) { lit(p.n, c); if (p.c) lit(p.c, c); } };
  H.off = () => { for (const p of H.slot.values()) { lit(p.n); if (p.c) lit(p.c); } };
  H.tile = (i, c) => { if (H.tiles[i]) H.tiles[i].material.color.set(c || TB); };
  H.gone = (i, dir = V(0, 8, -3)) => { const p = H.at(i); if (!p) return; lab.flyAway(p.n, dir); if (p.c) lab.flyAway(p.c, dir); H.slot.delete(i); };
  H.drop = (p) => { kill(p.n); if (p.c) kill(p.c); };
  // 把某格搬到另一格（slot 也跟著改）
  H.moveTo = (from, to) => { const p = H.at(from); H.slot.delete(from); H.mv(p, to); H.slot.set(to, p); return p; };
  // copy 語意：heap[to] = heap[from]（from 保留，變灰表示「舊值，之後會被蓋掉」）
  H.copy = (from, to) => {
    const s = H.at(from), old = H.at(to);
    if (old) H.drop(old);
    const n = lab.addBody(block(s.v, NODE, s.color)); n.obj.position.copy(H.tp(from));
    let c = null; if (H.hasArr) { c = lab.addBody(block(s.v, SMALL, s.color)); c.obj.position.copy(H.cp(from)); }
    const p = { v: s.v, n, c, color: s.color }; H.slot.set(to, p); H.mv(p, to);
    s.n.obj.material.color.set(STALE); if (s.c) s.c.obj.material.color.set(STALE);
    return p;
  };
  // 一個只在樹上方的自由方塊
  H.free = (v, color, pos, drop = 0) => {
    const n = lab.addBody(block(v, NODE, color));
    n.obj.position.copy(pos).add(V(0, drop, 0)); if (drop) lab.dropTo(n, pos.clone()); else n.target.copy(pos);
    return { v, n, c: null, color };
  };
  // 自由方塊放進 slot i：樹上那顆移過去，array 格掉進一顆
  H.place = (p, i) => {
    const old = H.at(i); if (old) H.drop(old);
    lab.springTo(p.n, H.tp(i));
    if (H.hasArr) p.c = cellOf(i, p.v, p.color, 2.5);
    H.slot.set(i, p);
  };
  H.arr = (n) => { const a = []; for (let i = 1; i <= n; i++) a.push(H.at(i) ? H.at(i).v : '_'); return '[' + a.join(', ') + ']'; };
  if (Q.arr) H.addArr();
  vals.forEach((v, k) => { if (v !== null && v !== undefined) H.mk(k + 1, v, Array.isArray(o.colors) ? o.colors[k] : Q.col); });
  return H;
}
// ── 一般樹的 forest（disjoint set 用）：每棵樹各自排版，union 後重排並滑過去 ──
function FV(o = {}) {
  const F = { O: Object.assign({ topY: 5.6, step: 1.45, sp: 1.15, gap: 0.45, z: 0, color: () => BLUE }, o), nodes: new Map(), roots: [] };
  F.n = (l) => F.nodes.get(String(l));
  F.add = (label, parent = null, color) => {
    const n = { label: String(label), kids: [], par: null, color: color || F.O.color(label) };
    F.nodes.set(n.label, n);
    if (parent !== null) { const p = F.n(parent); p.kids.push(n); n.par = p; } else F.roots.push(n);
    return n;
  };
  // roots 的 x 中心由 cxs 指定（或自動平均分配）
  F.layout = (cxs) => {
    const xs = cxs || F.auto();
    F.roots.forEach((r, k) => layoutG(r, { cx: xs[k], width: Math.max(0, (leafCount(r) - 1) * F.O.sp), topY: F.O.topY, step: F.O.step, z: F.O.z }));
  };
  const leafCount = (r) => (r.kids.length ? r.kids.reduce((a, k) => a + leafCount(k), 0) : 1);
  // roots 依各自寬度由左到右排開、整體置中
  F.auto = (gap = F.O.gap) => { const ws = F.roots.map((r) => leafCount(r) * F.O.sp + gap); let x = -ws.reduce((a, b) => a + b, 0) / 2; return ws.map((w) => { const c = x + w / 2; x += w; return c; }); };
  F.size = (l) => gAll(F.root(l)).length;
  F.spawn = (cxs, drop = 0) => {
    F.layout(cxs);
    for (const n of F.nodes.values()) {
      const b = lab.addBody(block(n.label, NODE, n.color)); n.body = b;
      if (drop) { b.obj.position.copy(n.pos).add(V(0, drop, 0)); lab.dropTo(b, n.pos.clone()); } else { b.obj.position.copy(n.pos); b.target.copy(n.pos); }
    }
    edgeLines(() => { const out = []; for (const n of F.nodes.values()) for (const k of n.kids) if (n.body && k.body) out.push([n.body.obj.position, k.body.obj.position]); return out; });
    return F;
  };
  F.slide = (cxs) => { F.layout(cxs); for (const n of F.nodes.values()) if (n.body) lab.springTo(n.body, n.pos.clone()); };
  F.link = (child, parent) => {
    const c = F.n(child), p = F.n(parent);
    if (c.par) c.par.kids.splice(c.par.kids.indexOf(c), 1); else F.roots.splice(F.roots.indexOf(c), 1);
    p.kids.push(c); c.par = p;
  };
  F.unlink = (l) => { const c = F.n(l); if (!c.par) return; c.par.kids.splice(c.par.kids.indexOf(c), 1); c.par = null; F.roots.push(c); };
  F.root = (l) => { let n = F.n(l); while (n.par) n = n.par; return n; };
  F.path = (l) => { const out = []; let n = F.n(l); while (n) { out.push(n); n = n.par; } return out; };
  F.lit = (l, c) => { const n = F.n(l); if (n && n.body) lit(n.body, c); };
  F.off = () => { for (const n of F.nodes.values()) if (n.body) lit(n.body); };
  return F;
}
// parent array 的一排格子：index 在下、值在格子上
function PArr(vals, o = {}) {
  const A = { O: Object.assign({ x0: -4.5, dx: 1.0, y: 0.3, z: 2.8 }, o), cells: [] };
  A.pos = (i) => V(A.O.x0 + i * A.O.dx, A.O.y, A.O.z);
  vals.forEach((v, i) => {
    const t = new THREE.Mesh(new THREE.BoxGeometry(A.O.dx * 0.9, 0.08, 0.9), new THREE.MeshStandardMaterial({ color: TB, roughness: 1 }));
    t.position.copy(A.pos(i)).setY(0.04); lab.world.add(t);
    tag(String(i), 'idx', A.pos(i).x, 0, A.O.z + 0.75);
    A.cells[i] = { t, b: v === null ? null : cube(String(v), v === -1 ? KCOL : GRAYC, SMALL, A.pos(i).x, A.O.y, A.O.z), v };
  });
  A.set = (i, v) => { const c = A.cells[i]; if (c.b) kill(c.b); c.v = v; c.b = cube(String(v), v === -1 ? KCOL : GOLD_C, SMALL, A.pos(i).x, A.O.y, A.O.z, 2); };
  A.hi = (i, c) => { A.cells[i].t.material.color.set(c || TB); };
  A.off = () => A.cells.forEach((c) => c.t.material.color.set(TB));
  return A;
}
const GOLD_C = '#e0b04a';
// ── Huffman：課本例句 "Eerie eyes seen near lake."（␣ = space） ──
const HF = { E: 1, e: 8, r: 2, i: 1, '␣': 4, y: 1, s: 2, n: 2, a: 2, l: 1, k: 1, '.': 1 };
const HORDER = ['E', 'e', 'r', 'i', '␣', 'y', 's', 'n', 'a', 'l', 'k', '.'];
const SENT = [...'Eerie eyes seen near lake.'.replace(/ /g, '␣')];
function huffRun() {
  let pq = HORDER.map((c) => ({ ch: c, f: HF[c], label: c, kids: [] })).sort((a, b) => a.f - b.f);
  const merges = [];
  while (pq.length > 1) {
    const a = pq.shift(), b = pq.shift();
    const z = { f: a.f + b.f, label: String(a.f + b.f), kids: [a, b] };
    let i = pq.findIndex((x) => x.f > z.f); if (i < 0) i = pq.length;
    pq.splice(i, 0, z);
    merges.push({ a, b, z, pq: pq.slice() });
  }
  return { root: pq[0], merges };
}
function huffCodes(root) { const m = {}; (function w(n, p) { n.code = p; if (!n.kids.length) m[n.ch] = p; else { w(n.kids[0], p + '0'); w(n.kids[1], p + '1'); } })(root, ''); return m; }
const LSZ = [0.66, 0.5, 0.66];
// 整棵 Huffman tree：葉子綠（下面標次數）、內部節點金；bits = 在邊上標 0/1
function hufShow(root, o, bits, drop = 0) {
  layoutG(root, Object.assign({ width: 11, topY: 6.8, step: 1.3 }, o || {}));
  for (const n of gAll(root)) {
    const b = lab.addBody(block(n.ch ? n.ch : n.label, LSZ, n.ch ? LEAFC : INC));
    if (drop) { b.obj.position.copy(n.pos).add(V(0, drop, 0)); lab.dropTo(b, n.pos.clone()); } else { b.obj.position.copy(n.pos); b.target.copy(n.pos); }
    n.body = b;
    if (n.ch) tag(String(n.f), 'idx', n.pos.x, n.pos.y - 0.5, 0.4);
  }
  edgeLines(() => { const out = []; for (const n of gAll(root)) for (const k of n.kids) if (n.body && k.body) out.push([n.body.obj.position, k.body.obj.position]); return out; }, 0.25);
  if (bits) hufBits(root);
  return root;
}
function hufBits(root) { for (const n of gAll(root)) n.kids.forEach((k, j) => tag(String(j), 'ptr', (n.pos.x + k.pos.x) / 2 + (j ? 0.24 : -0.24), (n.pos.y + k.pos.y) / 2 + 0.1, 0.2)); }
const hLeaf = (root, ch) => gAll(root).find((n) => n.ch === ch);

// ═══════════ ubLbvuWFDqM：Lec15（priority queue、max heap insert／delete、heap sort、Huffman 入門） ═══════════
const BASE = [20, 15, 2, 14, 10];

// 0:26 priority queue 五種實作
FRAG.push(['treec-pq', 'Priority queue：五種實作比一比', async (tok) => {
  fresh(); lab.frameCamera([0, 4.6, 13.5], [0, 2.2, 0]);
  const HT = { '1': 0.5, log: 1.7, n: 3.8 };
  const rows = [['unsorted array', '1', 'n', 'O(1)', 'O(n)'], ['unsorted list', '1', 'n', 'O(1)', 'O(n)'],
    ['sorted array', 'n', '1', 'O(n)', 'O(1)'], ['sorted list', 'n', '1', 'O(n)', 'O(1)'], ['max heap', 'log', 'log', 'O(log n)', 'O(log n)']];
  const pq = buddy('priority queue', '?', '#f4a56a', -6.3, 0, -1.6, 0.8);
  await step(tok);                                   // 0:26 priority queue 的比較
  tag('藍 = insert', 'ptr', -2.6, 6.4); tag('橘 = delete 最大', 'ptr alt', 2.6, 6.4);
  const bs = rows.map((r, k) => { const x = -4.6 + k * 2.4; tag(r[0], 'ptr', x, 0, 1.3); return { x, bi: bar(BLUE, 0.75, 0.8, x - 0.42, 0), bd: bar(ORANGE, 0.75, 0.8, x + 0.42, 0) }; });
  const show = async (k, which) => { const r = rows[k], b = bs[k]; if (which === 'i') { await growBar(tok, b.bi, HT[r[1]], 500); tag(r[3], 'idx', b.x - 0.42, HT[r[1]] + 0.4); } else { await growBar(tok, b.bd, HT[r[2]], 500); tag(r[4], 'idx', b.x + 0.42, HT[r[2]] + 0.4); } };
  say('比一比：priority queue 可以用哪些東西做？', '要做兩件事：放進去（insert）、拿出最大的（delete）');
  await step(tok);                                   // 0:53 sorted 的 insertion 花比較多
  await show(2, 'i'); await show(3, 'i');
  say('sorted（排好序）：每放一個都要找位置插進去', 'insert 比較貴：O(n)');
  await step(tok);                                   // 0:58 deletion 比較快
  await show(2, 'd'); await show(3, 'd'); pq.mood('happy');
  say('但最大的就在一端，直接拿走', 'delete 很快：O(1)');
  await step(tok);                                   // 1:03 unsorted：看到就丟進去
  await show(0, 'i'); await show(1, 'i');
  say('unsorted（沒排序）：看到就丟到最後', 'insert 很快：O(1)');
  await step(tok);                                   // 1:10 deletion 要整個掃
  await show(0, 'd'); await show(1, 'd'); pq.mood('sad');
  say('要找最大的，只好整個掃一遍', 'delete 很慢：O(n)');
  await step(tok);                                   // 1:17 max heap 兩邊都不錯
  await show(4, 'i'); await show(4, 'd');
  bs[4].bi.material.emissive.set(GOLD); bs[4].bd.material.emissive.set(GOLD);
  pq.set('heap'); pq.mood('happy'); await pq.hop(tok);
  say('max heap：insert、delete 都是 O(log n)', '兩邊都不差 → priority queue 常用 heap 做');
}]);

// 1:25 max heap 定義與 array
FRAG.push(['treec-maxheap', 'Max heap：root 最大，用 array 存', async (tok) => {
  fresh(); lab.frameCamera([0, 5, 13.5], [0, 3.4, 1]);
  const vals = [14, 12, 7, 10, 8, 6];
  const H = HV([], { width: 7.5, cells: 6, arr: false });
  await step(tok);                                   // 1:25 max heap 是一種 data structure
  for (let i = 1; i <= 6; i++) { H.mk(i, vals[i - 1], depthColor(Math.floor(Math.log2(i))), 4); await wait(tok, 250); }
  say('Max heap：一種長得像樹的資料結構', '形狀是 complete binary tree（由上到下、由左到右排滿）');
  await step(tok);                                   // 1:34 root 永遠放最大
  H.lit(1, GOLD); const r = sayT('root = 全部裡最大的', 0, 7.2);
  say('max heap：root 永遠放最大的 element', '14 比樹裡所有數字都大');
  await step(tok);                                   // 1:50 旁邊用 array 存這棵樹
  H.lit(1); kill(r); H.addArr(3);
  say('旁邊這排 array 就是這棵樹本身', '用 array 來 implement 這棵樹');
  await step(tok);                                   // 1:56 14 放在 1 號，其他依序
  for (let i = 1; i <= 6; i++) { H.lit(i, GOLD); H.tile(i, TGOLD); await wait(tok, 260); H.lit(i); H.tile(i); }
  say('14 放在 [1]，其他照「一層一層、由左到右」放', '[0] 不用，從 1 開始編號');
  await step(tok);                                   // 2:04 用 array 為了很快找到 parent
  H.lit(5, GOLD); H.tile(5, TGOLD); H.lit(2, GREEN); H.tile(2, TGREEN);
  arrow(H.cp(5).clone().add(V(0, 0.5, 0)), H.cp(2).clone().add(V(0, 0.5, 0)), '#c08a1f');
  note('parent(i) = ⌊i/2⌋', 0, 1.3, 2.6);
  say('為什麼用 array？找 parent 只要算一下', '[5] 的 parent 是 [5/2] = [2]：8 的 parent 是 12');
  await step(tok);                                   // 2:20 也可以用 node + pointer
  H.off(); H.tile(5); H.tile(2);
  const who = buddy('你', '?', '#7cb8ee', 5.8, 0, 0.5, 0.7); who.look(-1);
  arrow(H.tp(5).clone().add(V(0.2, 0.4, 0)), H.tp(2).clone().add(V(0.3, -0.35, 0)), '#b04a4a', true);
  say('也可以用 node + left／right pointer 做', '可以，但……');
  await step(tok);                                   // 2:34 要找 parent 比較麻煩
  noT('pointer 只往下指，要往上找 parent 很麻煩', 4.4, 5.6); who.mood('sad');
  say('insert／delete 都要一直找 parent', '用 pointer 就要多付成本，所以 heap 通常用 array');
}]);

// 2:49 max heap insert：放最後、往上爬（insert 1、5、21）
FRAG.push(['treec-hinsert', 'Max heap insert：放最後、往上爬', async (tok) => {
  const setup = () => { fresh(); lab.frameCamera([0, 5, 13.5], [0, 3.4, 1]); return HV(BASE, { width: 7.5, cells: 6 }); };
  let H = setup();
  const newcomer = (x) => { const l = pkt('新來的 ' + x, -5.6, 6.2); return l; };
  let nl = newcomer(1);
  say('heap：[20, 15, 2, 14, 10]', '要 insert 1 進來，怎麼做？');
  await step(tok);                                   // 2:49 insert 一個 1 進來
  await travel(tok, nl, V(-5.6, 6.2, 0), V(-4.2, 4.5, 0), 700);
  say('insert 1：先想它要放哪裡', '');
  await step(tok);                                   // 3:02 先放在 heap 最後一個 element
  H.tile(6, TGOLD); const w6 = wire(H.tp(6));
  say('新數字一律先放在最後一個 element 的後面', 'array 裡最後那格的下一格');
  await step(tok);                                   // 3:25 1..5 用掉了，放 6 號
  for (let i = 1; i <= 5; i++) { H.tile(i, TGREEN); await wait(tok, 160); }
  kill(w6); remove(nl); H.mk(6, 1, ORANGE, 3);
  say('[1]..[5] 都用了 → 放進 6 號', '樹上就是 2 的 left child');
  await step(tok);                                   // 3:58 跟 parent 比
  for (let i = 1; i <= 6; i++) H.tile(i);
  H.lit(6, GOLD); H.lit(3, GOLD);
  say('放好後要調整：跟它的 parent 比', '6 號的 parent = ⌊6/2⌋ = 3 號');
  await step(tok);                                   // 4:06 bottom up：往上爬
  const up = arrow(H.tp(6).clone().add(V(0.7, 0, 0)), H.tp(1).clone().add(V(0.9, 0, 0)), ORANGE);
  say('bottom-up：比 parent 大就往上爬', '爬到 parent 比它大，或到 root 為止');
  await step(tok);                                   // 4:42 1 跟 2 比：2 比較大，停
  kill(up); H.off(); H.lit(6, GREEN); okT('2 > 1 → 停在這', 2.9, 3.0);
  say('1 跟 2 比：2 比較大', '1 不用動，insert 完成');
  await step(tok);                                   // 4:51 改成 insert 5
  H = setup(); H.mk(6, 5, ORANGE, 3);
  say('換一個：原來的 heap，insert 5', '一樣先放 6 號（2 的 left child）');
  await step(tok);                                   // 5:09 5 比 2 大：5 上去 2 下來
  H.lit(6, GOLD); H.lit(3, GOLD); await wait(tok, 500); H.off(); H.swap(6, 3);
  say('5 比 2 大 → 5 上去、2 下來', H.arr(6));
  await step(tok);                                   // 5:20 5 和 20 比：20 大，停
  H.lit(3, GOLD); H.lit(1, GOLD); await wait(tok, 500); H.off(); H.lit(3, GREEN);
  say('5 再跟 parent 20 比：20 比較大', '停在這裡：' + H.arr(6));
  await step(tok);                                   // 5:29 insert 21
  H = setup(); H.mk(6, 21, ORANGE, 3);
  say('再換：insert 21', '同樣放在 2 的 left child');
  await step(tok);                                   // 5:50 2 拉下來、21 上去
  H.lit(6, GOLD); H.lit(3, GOLD); await wait(tok, 500); H.off(); H.swap(6, 3);
  say('21 比 2 大 → 21 上去、2 下來', H.arr(6));
  await step(tok);                                   // 5:57 21 再跟 20 比 → root
  H.lit(3, GOLD); H.lit(1, GOLD); await wait(tok, 500); H.off(); H.swap(3, 1);
  await wait(tok, 600); H.lit(1, GREEN);
  say('21 比 parent 20 還大 → 21 到 root，20 往下', H.arr(6));
  await step(tok);                                   // 6:07 記住：放最後、跟 parent 比
  sayT('insert：放最後一格 → 一路跟 parent 比', 0, 7.3);
  say('記住 insert 的概念', '放在最後一個位置，往上跟 parent 比（最多爬樹高 → O(log n)）');
}]);

// 6:44 insert 程式碼（以 insert 21 走一次）
FRAG.push(['treec-hinscode', 'Insert 程式碼：parent 往下 copy', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.4, 0.8]);
  const cd = code(['void insert(element x) {', '  if (n == MAX_SIZE-1) {', '    heap is full; exit; }', '  for (i = ++n; i != 1; i /= 2) {', '    if (x.key <= heap[i/2].key) break;', '    heap[i] = heap[i/2];', '  }', '  heap[i] = x;', '}'], -3.5, 6.6, 0.5);
  const H = HV(BASE, { cx: 3.6, width: 5, ax: 3.5, dx: 0.72, cells: 6, top: 6.3 });
  const iT = tag('', 'ptr alt', 0, 1.0, 2.6); iT.visible = false;
  const setI = (i) => { iT.visible = true; iT.position.copy(H.cp(i)).setY(1.0); setTag(iT, 'i = ' + i); };
  const xPos = (i) => H.tp(i).clone().add(V(0.95, 0.35, 0));
  const nT = note('n = 5', 6.4, 1.3, 2.6);
  await step(tok);                                   // 6:44 array 有 MAX size，滿了就 full
  cd.hl(1);
  say('array 有大小上限 MAX_SIZE', '滿了就回報 heap is full；現在 n = 5，還沒滿');
  await step(tok);                                   // 7:06 沒滿：放在 n++ 的位置
  cd.hl(3); H.tile(6, TGOLD); setTag(nT, 'n = 6');
  const x = H.free(21, ORANGE, xPos(6), 3); const xT = tag('x', 'ptr alt', xPos(6).x, xPos(6).y + 0.7);
  const moveX = (i) => { lab.springTo(x.n, xPos(i)); xT.position.copy(xPos(i)).add(V(0, 0.7, 0)); };
  say('要放的 x = 21：位置是 ++n = 6', 'n 記錄 heap 現在有幾個元素（也就是最後位置）');
  await step(tok);                                   // 7:22 for 迴圈：i 從 n 開始
  setI(6);
  say('for 迴圈：i 從 n（最後位置）開始比', 'i 代表「x 現在要試放的位置」');
  await step(tok);                                   // 7:48 i 等於 1 就到 root，跳出
  H.tile(1, TGREEN); const rt = note('i == 1 → 到 root，迴圈結束', 3.6, 7.5);
  say('i != 1 才繼續；i 到 1 就是到 root 了', '');
  await step(tok);                                   // 7:56 if：x.key 跟 parent 比
  H.tile(1); remove(rt); cd.hl(4); H.lit(3, GOLD); lit(x.n, GOLD);
  say('if：x.key 有沒有比 parent heap[i/2] 大？', '21 跟 heap[3] = 2 比');
  await step(tok);                                   // 8:26 沒有比 parent 大就 break
  const bk = note('若 x ≤ parent → break 停止', -3.5, 1.4);
  say('如果沒有比 parent 大，就 break 停下來', '這裡 21 > 2，所以不 break');
  await step(tok);                                   // 8:33 parent copy 下來到 heap[i]
  remove(bk); cd.hl(5); H.off(); lit(x.n); H.tile(6); H.copy(3, 6);
  say('heap[i] = heap[i/2]：把 parent 的 2 copy 下來', '不是 swap：x 還拿在手上');
  await step(tok);                                   // 8:40 i /= 2 往上爬一層
  cd.hl(3); setI(3); moveX(3);
  say('i /= 2 → i = 3：往上爬一層', '');
  await step(tok);                                   // 8:54 再跟 parent 比
  cd.hl(4); H.lit(1, GOLD); lit(x.n, GOLD); await wait(tok, 700);
  cd.hl(5); H.off(); lit(x.n); H.copy(1, 3); await wait(tok, 700);
  cd.hl(3); setI(1); moveX(1);
  say('21 > heap[1] = 20：20 copy 下來，i = 1', H.arr(6));
  await step(tok);                                   // 9:00 到 root（或 parent 比較大）→ 放入 x
  cd.hl(7); kill(xT); H.place(x, 1);
  say('迴圈結束：最後才 heap[i] = x', '<span class="ok">' + H.arr(6) + '</span>');
}]);

// 9:18 考試檢討：heap 改用 pointer、expression tree 兩步驟、trace code
FRAG.push(['treec-exam', '考試檢討：expression tree 要先建樹再 postorder', async (tok) => {
  fresh(); lab.frameCamera([0, 5, 13.5], [0, 3.2, 0.6]);
  const stu = buddy('你', '', '#7cb8ee', -6.2, 0, 1.8, 0.8);
  await step(tok);                                   // 9:20 考題：不用 array，用 node 改寫 insert
  const a = cube('20', BLUE, NODE, -3.6, 5.4), b = cube('15', BLUE, NODE, -4.8, 3.8), c = cube('2', BLUE, NODE, -2.4, 3.8);
  arrow(V(-3.8, 5.1, 0), V(-4.6, 4.15, 0), '#7a6a52'); arrow(V(-3.4, 5.1, 0), V(-2.6, 4.15, 0), '#7a6a52');
  note('left / right pointer', -3.6, 6.4); noT('parent 在哪？', -3.6, 2.6);
  stu.mood('wow');
  say('考題：heap 改用 node + pointer 做', 'insert 的程式要怎麼改寫？');
  await step(tok);                                   // 11:01 expression tree：2 加 3 乘 4
  const ex = sayT('2 + 3 * 4', 2.8, 7.0);
  stu.mood('calm'); stu.look(1);
  say('另一題：用 tree 表示 expression 2 + 3 * 4', '然後算出它等於多少');
  await step(tok);                                   // 11:18 第一步：expression 變成 tree
  const root = showTree('+(2,*(3,4))', { cx: 2.8, width: 3.2, topY: 6.0, minY: 3.0 });
  okT('① 先建 tree', 5.6, 6.2);
  say('步驟一：先把 expression 建成一棵 tree', '* 比 + 先算，所以 3 * 4 在下面');
  await step(tok);                                   // 11:24 第二步：postorder
  const out = ['2', '3', '4', '*', '+'];
  for (let k = 0; k < 5; k++) { const n = find(root, out[k]); lit(n.body, GOLD); cube(out[k], ORANGE, SMALL, 0.8 + k * 0.9, 0.35, 2.4, 2); await wait(tok, 380); lit(n.body); }
  okT('② 再 postorder', 5.6, 1.4);
  say('步驟二：用 postorder 走這棵樹', '2 3 4 * +');
  await step(tok);                                   // 11:40 只寫 postorder 不算解完
  note('3 * 4 = 12 → 2 + 12 = 14', 2.8, 1.6, 2.4); stu.mood('happy');
  say('兩步都要寫：先建樹、再 postorder 求值', '只寫 postorder 不算解完；答案 14');
  await step(tok);                                   // 12:19 trace code 要自己做
  for (const n of levelorder(root)) kill(n.body); remove(ex);
  const cd = code(['for (i = ++n; i != 1; i /= 2) {', '  if (x.key <= heap[i/2].key) break;', '  heap[i] = heap[i/2];', '}'], 1.2, 6.2, 0.55);
  cd.hl(0); stu.look(1);
  say('老師叫你 trace code，就要自己一行一行追', '不要直接問助教「這段在幹嘛」');
  await step(tok);                                   // 13:31 不會 trace 就用 debugger step by step
  const mon = prop('monitor', -3.2, 0, 0.4, 0.9, 'debugger：step by step'); bob(mon, 0.04);
  for (let k = 0; k < 4; k++) { cd.hl(k); await wait(tok, 450); }
  stu.mood('happy'); await stu.hop(tok);
  say('真的不會？把 code 放進 C/C++/Java', '用 debugger 一步一步執行，看變數怎麼變');
}]);

// 15:49 delete 概念：root 丟出、最後元素暫存 k
FRAG.push(['treec-hdel', 'Max heap delete：最後元素暫存 k', async (tok) => {
  fresh(); lab.frameCamera([0, 5, 13.5], [0, 3.4, 1]);
  const H = HV(BASE, { width: 7.5, cells: 5 });
  const kb = buddy('k', '', KCOL, -5.6, 3.6, 0, 0.8);
  let hole;
  await step(tok);                                   // 16:02 20 15 2 14 10 這個 heap
  for (let i = 1; i <= 5; i++) { H.lit(i, GOLD); await wait(tok, 180); H.lit(i); }
  say('一個 max heap：20、15、2、14、10', '接下來看 delete');
  await step(tok);                                   // 16:10 delete：把 root 20 丟出來
  H.lit(1, GOLD);
  say('max heap 的 delete：把最大的 root 丟出來', '20 被拿走（output）');
  await step(tok);                                   // 16:43 這個位置就空了
  H.gone(1, V(3, 9, -2)); hole = wire(H.tp(1));
  say('20 拿走後，root 的位置空了', '要決定誰來補這個洞');
  await step(tok);                                   // 16:53 insert bottom-up，delete top-down
  const up = arrow(V(-4.2, 2.2, 0), V(-4.2, 5.2, 0), BLUE), dn = arrow(V(4.6, 5.4, 0), V(4.6, 2.4, 0), ORANGE);
  const t1 = tag('insert：bottom-up', 'ptr', -4.2, 1.7), t2 = tag('delete：top-down', 'ptr alt', 4.6, 1.9);
  say('insert 從下往上爬；delete 從上往下調', 'insert = bottom-up，delete = top-down');
  await step(tok);                                   // 17:16 原本五個元素在 array 1~5
  kill(up); kill(dn); kill(t1); kill(t2);
  for (let i = 2; i <= 5; i++) { H.tile(i, TGOLD); await wait(tok, 200); H.tile(i); }
  say('原本 5 個元素：array[1]..[5]', '20 在 1、15 在 2、2 在 3、14 在 4、10 在 5');
  await step(tok);                                   // 17:31 delete 後只剩四個空間
  H.tile(5, PINK); noT('只剩 4 個 → [5] 用不到了', 2.6, 1.3, 2.6);
  say('刪掉一個，只剩 4 個數字', '只需要 array[1]..[4]');
  await step(tok);                                   // 18:17 最後元素的空間要收回
  const p5 = H.at(5); H.slot.delete(5); lab.flyAway(p5.c, V(2, 6, 4)); p5.c = null;
  lit(p5.n, GOLD);
  say('最後那格（[5] 的 10）要收回來', '那 10 要放到哪裡？');
  await step(tok);                                   // 18:29 把 10 丟到 root，像打彈珠
  lab.springTo(p5.n, H.tp(1).clone().add(V(0, 0.9, 0)));
  say('把 10 丟到 root 那裡開始比大小', '像打彈珠：打上去再往下落到該停的地方');
  await step(tok);                                   // 19:33 10 暫存在變數 k
  lab.springTo(p5.n, V(-5.6, 5.4, 0)); await wait(tok, 700);
  kill(p5.n); kb.set(10); kb.mood('wow'); await kb.hop(tok);
  say('其實 10 是先暫存在變數 k 裡', 'k = 10');
  await step(tok);                                   // 19:45 為什麼不直接放 root
  H.lit(2, GOLD); kb.look(1);
  note('下面的 15 比 10 大！', 0, 7.4);
  say('為什麼不直接把 10 放進 root？', '下面可能有比它大的 child（例如 15）');
}]);

// 20:13 delete 逐步：與較大的 child 比、往下落
FRAG.push(['treec-hdel2', 'Delete 逐步：較大的 child 往上，k 往下落', async (tok) => {
  fresh(); lab.frameCamera([0, 5, 13.5], [0, 3.4, 1]);
  const H = HV(BASE, { width: 7.5, cells: 5 });
  H.gone(1, V(3, 9, -2)); const hole = wire(H.tp(1));
  const p5 = H.at(5); H.slot.delete(5); kill(p5.n); kill(p5.c); H.tile(5, PINK);
  const kb = buddy('k', 10, KCOL, -5.6, 3.6, 0, 0.8);
  const fall = pkt('k 試放這裡', H.tp(1).x, H.tp(1).y + 0.85);
  say('root 空了，k = 10，n = 4', '從 root 往下，決定 10 要放哪');
  await step(tok);                                   // 20:13 root 下面有兩個 child
  H.lit(2, GOLD); H.lit(3, GOLD);
  say('root 下面有兩個 child：15 和 2', '');
  await step(tok);                                   // 20:22 15 比較大
  H.lit(3); H.lit(2, GREEN);
  say('哪個比較大？15', '較大的 child 才有資格當 root');
  await step(tok);                                   // 20:36 最大的 child 跟 k 比
  kb.look(1); kb.mood('wow');
  say('把最大的 child 15 跟 k = 10 比', '');
  await step(tok);                                   // 20:59 15 比 10 大
  noT('15 > 10：10 不能當 root', -2.4, 7.2);
  say('15 比 10 大', '所以 root 應該是 15，不是 10');
  await step(tok);                                   // 21:08 15 往上搬到 root
  H.off(); H.moveTo(2, 1);
  say('15 往上搬到 root', '');
  await step(tok);                                   // 21:19 15 原來的空間空了，10 往下走
  hole.position.copy(H.tp(2)); fall.position.copy(H.tp(2)).add(V(0, 0.85, 0));
  say('15 原本的位置空了', '10 往下落一格，試放在這裡');
  await step(tok);                                   // 21:49 這下面只有一個 child：14
  H.lit(4, GOLD);
  say('這個位置的 child 只有一個：14', '');
  await step(tok);                                   // 21:58 14 比 10 大，14 往上爬
  H.off(); H.moveTo(4, 2); hole.position.copy(H.tp(4)); fall.position.copy(H.tp(4)).add(V(0, 0.85, 0));
  say('14 又比 10 大 → 14 往上爬', '10 再往下落一格');
  await step(tok);                                   // 22:18 沒有 child → 10 放這裡
  kill(hole); remove(fall);
  await fling(tok, '10', V(-5.6, 4.9, 0), H.tp(4).clone().add(V(0, 0.6, 0)), 800);
  H.mk(4, 10, KCOL, 1); kb.set(''); kb.mood('happy');
  say('這個位置下面沒有 child 了', '10 就放在這裡');
  await step(tok);                                   // 22:29 最後 array：15 14 2 10
  H.lit(4, GREEN); okT(H.arr(4), 0, 1.4, 2.6);
  say('最後 array：1 放 15、2 放 14、3 放 2、4 放 10', '<span class="ok">' + H.arr(4) + '</span>');
  await step(tok);                                   // 23:48 top-down
  arrow(V(4.6, 6.0, 0), V(4.6, 3.0, 0), ORANGE); tag('top-down', 'ptr alt', 4.6, 2.5);
  say('delete 是 top-down：從 root 一路往下比', '');
  await step(tok);                                   // 23:57 走到 leaf，或比 child 大就停
  sayT('停：到 leaf，或 k ≥ 較大的 child', 0, 7.6);
  say('什麼時候停？', '走到 leaf，或 k 比較大的 child 還大');
}]);

// deleteMax 程式碼：共用版面
function delCodeSetup() {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.4, 0.8]);
  const cd = code(['element delete_max() {', '  if (!n) { heap is empty; exit; }', '  item = heap[1];', '  k = heap[n--];', '  for (i = 1, j = 2; j <= n; ) {', '    if (j<n && heap[j].key<heap[j+1].key) j++;', '    if (k.key >= heap[j].key) break;', '    heap[i] = heap[j];', '    i = j; j *= 2;', '  }', '  heap[i] = k;', '  return item;', '}'], -3.6, 6.9, 0.48);
  const H = HV(BASE, { cx: 3.9, width: 4.6, ax: 3.9, dx: 0.72, cells: 5, top: 6.1 });
  const iT = tag('', 'ptr alt', 0, 1.0, 2.6), jT = tag('', 'ptr', 0, 1.0, 2.6); iT.visible = jT.visible = false;
  const showIJ = (i, j, n) => {
    for (let s = 1; s <= 5; s++) H.tile(s, s > n ? PINK : s === i ? TGOLD : s === j || s === j + 1 ? TGREEN : TB);
    iT.visible = true; iT.position.copy(H.cp(i)).setY(1.05); setTag(iT, 'i=' + i);
    if (j <= 5) { jT.visible = true; jT.position.copy(H.cp(j)).setY(1.55); setTag(jT, 'j=' + j); } else jT.visible = false;
  };
  return { cd, H, showIJ };
}

// 24:17 deleteMax 程式碼解說
FRAG.push(['treec-hdelcode', 'deleteMax 程式碼：一行一行看', async (tok) => {
  const { cd, H, showIJ } = delCodeSetup();
  const item = buddy('item', '', PURPLE, 6.6, 4.6, -1.2, 0.7), kb = buddy('k', '', KCOL, 1.3, 5.2, -1.2, 0.7);
  const nT = note('n = 5', 6.6, 1.3, 2.6);
  await step(tok);                                   // 24:17 先檢查 n
  cd.hl(1);
  say('第一行：先檢查 n', '');
  await step(tok);                                   // 24:35 n == 0 → empty
  noT('n == 0 → heap is empty', -3.0, 7.6);
  say('n == 0 代表 heap 裡沒有任何元素', '那就回報 heap is empty；現在 n = 5');
  await step(tok);                                   // 24:55 item = heap[1]
  cd.hl(2);
  await fling(tok, '20', H.tp(1).clone().add(V(0, 0.6, 0)), V(6.6, 5.9, -1.2), 900);
  item.set(20); item.mood('happy'); H.at(1).n.obj.material.color.set(STALE); H.at(1).c.obj.material.color.set(STALE);
  say('item = heap[1]：要 return 的是第一格', 'max heap 的 array[1] 最大 → item = 20');
  await step(tok);                                   // 25:11 最後一個元素 heap[n] 指定給 k
  cd.hl(3);
  const p5 = H.at(5); H.slot.delete(5);
  await fling(tok, '10', H.tp(5).clone().add(V(0, 0.6, 0)), V(1.3, 6.5, -1.2), 900);
  kill(p5.n); lab.flyAway(p5.c, V(2, 6, 4)); kb.set(10); kb.mood('wow');
  say('k = heap[n]：最後一個元素存到 k', '例子裡 k = 10');
  await step(tok);                                   // 25:31 n--
  H.tile(5, PINK); setTag(nT, 'n = 4');
  say('同一行還做 n--：n 從 5 變 4', '刪掉一個，heap 剩 4 個');
  await step(tok);                                   // 25:47 for：i = 1, j = 2, j <= n
  cd.hl(4); showIJ(1, 2, 4);
  say('for：i = 1、j = 2，條件 j <= n', 'i 是「要決定放誰的位置」，一開始是 root');
  await step(tok);                                   // 26:25 j 和 j+1 是 root 的 child
  H.lit(2, GOLD); H.lit(3, GOLD);
  say('j 和 j+1 是 i 的兩個 child', 'root 的 child 在 [2]、[3]');
  await step(tok);                                   // 26:49 j 要指向最大的 child
  cd.hl(5);
  say('這行讓 j 指向比較大的那個 child', '');
  await step(tok);                                   // 27:19 heap[j] < heap[j+1] 就 j++ 走右邊
  note('右邊比較大 → j++（走 right subtree）', 3.9, 7.6);
  say('如果 heap[j] < heap[j+1]，右邊較大 → j++', '這裡 15 > 2，j 不動（j < n 確保右 child 存在）');
  await step(tok);                                   // 27:45 k 跟最大的 child 比
  cd.hl(6); H.off(); H.lit(2, GOLD); kb.look(1);
  say('再比：k 有沒有比最大的 child 大？', 'k = 10 vs heap[2] = 15');
  await step(tok);                                   // 27:59 比 child 大就停
  note('k ≥ child → break，k 就放在 i', -3.0, 0.9);
  say('k 比最大的 child 還大 → break 停止', '這裡 10 < 15，不停');
  await step(tok);                                   // 28:12 否則 child 往上搬
  cd.hl(7); H.off(); H.copy(2, 1);
  say('否則 heap[i] = heap[j]：child 往上搬', '15 copy 到 root（[2] 先留舊值）');
  await step(tok);                                   // 28:22 i = j、j *= 2
  cd.hl(8); showIJ(2, 4, 4);
  say('i = j、j *= 2：往較大的 child 那邊下去一層', 'i = 2、j = 4，繼續同樣的比較');
}]);

// 28:54 deleteMax 程式 trace
FRAG.push(['treec-hdeltrace', 'deleteMax trace：i、j 一輪一輪走', async (tok) => {
  const { cd, H, showIJ } = delCodeSetup();
  H.at(1).n.obj.material.color.set(STALE); H.at(1).c.obj.material.color.set(STALE);
  const kb = buddy('k', 10, KCOL, 1.3, 5.2, -1.2, 0.7);
  const p5 = H.at(5); H.slot.delete(5); kill(p5.n); kill(p5.c);
  const st = note('', 6.6, 1.3, 2.6); mono(st);
  await step(tok);                                   // 28:55 i = 1, j = 2, n = 4
  cd.hl(4); showIJ(1, 2, 4); setTag(st, 'i=1 j=2 n=4');
  say('一開始：i = 1、j = 2、n = 4', '');
  await step(tok);                                   // 29:02 要決定 [1] 給誰
  H.lit(1, GOLD);
  say('現在要決定：[1] 這格給誰？', '原本的 20 已經被拿走');
  await step(tok);                                   // 29:13 k = 10，array 剩 1..4
  H.lit(1); await kb.hop(tok);
  say('k = 10；array 只剩 [1]..[4]', '[5] 的 10 已經抓出來放在 k');
  await step(tok);                                   // 29:31 j 指這、j+1 指那
  H.lit(2, GOLD); H.lit(3, GOLD);
  say('j 指 [2]、j+1 指 [3]', '');
  await step(tok);                                   // 29:41 15 和 2：最大 child 是 15
  cd.hl(5); H.lit(3); H.lit(2, GREEN);
  say('比較 15 和 2：最大的 child 是 15', 'j 維持 2');
  await step(tok);                                   // 29:51 15 和 10 比：15 大
  cd.hl(6); kb.look(1);
  say('15 跟 k = 10 比：15 比較大', '不 break');
  await step(tok);                                   // 29:59 copy 到 root
  cd.hl(7); H.off(); H.copy(2, 1);
  say('heap[1] = heap[2]：15 copy 到 root', '');
  await step(tok);                                   // 30:06 1 放 15、2 也放 15、3 放 2、4 放 14
  okT('[15, 15, 2, 14]', 6.6, 0.6, 2.6);
  say('現在 array：1 放 15、2 也放 15、3 放 2、4 放 14', '[2] 的 15 是舊值，下一輪會被蓋掉');
  await step(tok);                                   // 30:26 下一輪 i = 2
  cd.hl(8); showIJ(2, 4, 4); setTag(st, 'i=2 j=4 n=4');
  say('i = j = 2、j *= 2 = 4：第二輪', '');
  await step(tok);                                   // 30:34 決定 [2] 放 10 還是下面的 14
  cd.hl(5); H.lit(4, GOLD); await wait(tok, 600);
  cd.hl(6); await wait(tok, 600); cd.hl(7); H.off(); H.copy(4, 2); await wait(tok, 600);
  cd.hl(8); showIJ(4, 8, 4); setTag(st, 'i=4 j=8 n=4');
  say('[2] 給誰？只有一個 child 14，14 > 10 → 14 上來', 'i = 4、j = 8');
  await step(tok);                                   // 30:58 第三輪：應該停了
  cd.hl(4);
  say('第三輪：檢查 j <= n', 'j = 8，n = 4（老師口誤說 j 等於 4）');
  await step(tok);                                   // 31:10 j > n 結束，k 放進 i
  cd.hl(10); H.place(H.free(10, KCOL, V(1.3, 5.6, -1.2)), 4); kb.set(''); kb.mood('happy');
  say('j > n，迴圈結束 → heap[i] = k', '<span class="ok">' + H.arr(4) + '</span>');
  await step(tok);                                   // 31:24 概念：root 拿掉、最後元素提上來、從上往下
  cd.hl(11);
  say('概念：root 拿掉，最後一個元素提上來', '從上往下替它找位置，最後 return item（20）');
}]);

// 31:51 heap 的 cost
FRAG.push(['treec-hcost', 'Heap 的 cost：deleteMax vs 刪任意元素', async (tok) => {
  fresh(); lab.frameCamera([0, 5, 13.5], [0, 3.4, 1]);
  const H = HV(BASE, { width: 6.5, cells: 5, cx: -1.2, ax: -1.2 });
  await step(tok);                                   // 31:55 max/min heap delete：root 丟出
  H.lit(1, GOLD);
  say('max／min heap 做 delete：把 root 丟出來', '');
  await step(tok);                                   // 32:11 調整 tree，cost = log n
  for (const i of [1, 2, 4]) { H.lit(i, GOLD); await wait(tok, 350); }
  tag('樹高 ≈ log₂ n', 'ptr alt', -5.6, 4.6);
  say('接著調整 tree，最多走一條 root 到 leaf 的路', 'cost = 樹的高度 = <span class="ok">O(log n)</span>');
  await step(tok);                                   // 32:32 delete 任意元素，例如 10
  H.off(); H.lit(5, KCOL);
  say('如果要 delete（或找）heap 裡「任意」一個元素？', '例如刪掉 10');
  await step(tok);                                   // 32:43 O(n)：heap 是 array
  noT('heap 只保證 root 最大，其他沒順序', -1.2, 7.4);
  say('要 O(n)：heap 用 array 存，沒有順序可以找', '');
  await step(tok);                                   // 32:59 scan 整個 array
  const cur = makeCursor(); cur.obj.scale.set(0.7, 0.7, 0.7);
  for (let i = 1; i <= 5; i++) { cursorTo(cur, H.cp(i).clone().setY(0.62)); H.tile(i, i === 5 ? TGREEN : TGOLD); await wait(tok, 380); }
  say('最笨也最直接：從頭 scan 整個 array', '找到 10 → O(n)；search 也是 O(n)');
  await step(tok);                                   // 34:09 delete 兩個動作：先 scan
  cur.obj.visible = false; for (let i = 1; i <= 5; i++) H.tile(i);
  const b1 = bar(ORANGE, 0.9, 0.9, 4.6, 0.5); await growBar(tok, b1, 4.2, 600); tag('① scan：n', 'idx', 4.6, 4.7, 0.5);
  say('刪任意元素有兩個動作：① scan 找到它', 'O(n)');
  await step(tok);                                   // 34:26 刪掉留下空洞，要調整
  const b2 = bar(BLUE, 0.9, 0.9, 5.9, 0.5); await growBar(tok, b2, 1.2, 500); tag('② 調整：log n', 'idx', 5.9, 1.7, 0.5);
  say('② 刪掉後留下空洞，往 subtree 調整', '也是樹高 → O(log n)');
  await step(tok);                                   // 35:17 total：n + log n
  say('總共 n + log n', '');
  await step(tok);                                   // 35:36 bottleneck 在 n
  b1.material.emissive.set(GOLD);
  say('bottleneck 在 scan 那段', '<span class="ok">n + log n = O(n)</span>（老師一度口誤說 log n dominate）');
}]);

// 35:55 heap sort
FRAG.push(['treec-hsort', 'Heap sort：建 min heap，再 delete n 次', async (tok) => {
  fresh(); lab.frameCamera([0, 5, 13.5], [0, 3.2, 1.4]);
  const H = HV([], { width: 7, cells: 5, col: PURPLE, top: 6.3 });
  const nums = [5, 3, 8, 1, 4];
  tag('輸出', 'ptr', -5.4, 0.35, 4.2);
  const ins = async (v, n) => { H.mk(n, v, PURPLE, 3); await wait(tok, 380); let i = n; while (i > 1 && H.at(i).v < H.at(i >> 1).v) { H.swap(i, i >> 1); i >>= 1; await wait(tok, 330); } };
  await step(tok);                                   // 36:02 heap 可以拿來 sort 嗎？
  say('heap 可以拿來 sort 嗎？', '有聽過 heap sort 嗎？');
  await step(tok);                                   // 36:12 一堆數字從小到大
  const src = nums.map((v, k) => cube(v, GRAYC, SMALL, -1.6 + k * 0.8, 7.4, 0, 1.5));
  say('一堆數字，要排成從小到大', '示意數字：5 3 8 1 4');
  await step(tok);                                   // 36:25 建成 min heap
  sayT('Phase 1：建 min heap', -5.0, 6.4);
  say('想法：先把它們建成一個 min heap', 'min heap：root 永遠最小');
  await step(tok);                                   // 36:47 delete n 次
  sayT('Phase 2：delete n 次', 5.0, 6.4);
  say('第二步：對 min heap delete n 次', '');
  await step(tok);                                   // 36:53 出來就是從小到大
  say('每次 delete 都拿到目前最小的', '所以輸出就是從小到大 → heap sort');
  await step(tok);                                   // 37:34 逐一 insert 到 empty heap
  for (let k = 0; k < 2; k++) { kill(src[k]); await ins(nums[k], k + 1); }
  say('Phase 1 怎麼建？一個一個 insert 進空的 heap', H.arr(2));
  await step(tok);                                   // 37:52 insert n 次
  for (let k = 2; k < 5; k++) { kill(src[k]); await ins(nums[k], k + 1); }
  say('第三個、第四個……共 insert n 次', H.arr(5));
  await step(tok);                                   // 38:00 Phase 2：delete n 次
  const out = [];
  for (let m = 5; m >= 1; m--) {
    const r = H.at(1); H.slot.delete(1); out.push(r.v);
    lab.springTo(r.n, V(-4.2 + (out.length - 1) * 1.0, 0.35, 4.2)); kill(r.c);
    if (m > 1) {
      const last = H.at(m); H.slot.delete(m); H.slot.set(1, last); H.mv(last, 1); H.tile(m, PINK);
      let i = 1; for (;;) { let c = 2 * i; if (c > m - 1) break; if (c + 1 <= m - 1 && H.at(c + 1).v < H.at(c).v) c++; if (H.at(i).v <= H.at(c).v) break; H.swap(i, c); i = c; }
    } else H.tile(1, PINK);
    await wait(tok, 480);
  }
  say('Phase 2：delete 5 次', '輸出：<span class="ok">' + out.join(' ') + '</span>');
  await step(tok);                                   // 38:41 insert 每次 log n
  note('insert：n 次 × O(log n)', -4.6, 5.6);
  say('每次 insert 要 bottom-up 比：O(log n)', 'insert 做 n 次');
  await step(tok);                                   // 38:51 delete 也 log n → n log n
  note('delete：n 次 × O(log n)', 4.6, 5.6);
  say('每次 delete 也是 O(log n)，做 n 次', '總共 <span class="ok">O(n log n)</span>');
  await step(tok);                                   // 39:21 三原則①
  sayT('① max heap root 最大／min heap root 最小', 0, 8.0);
  say('heap 的三個原則', '① root 放最大（max）或最小（min）');
  await step(tok);                                   // 39:35 ② insert bottom-up
  sayT('② insert：放最後，bottom-up 跟 parent 比', 0, 7.4);
  say('② insert：放 heap 最後的位置，往 parent 比', 'bottom-up');
  await step(tok);                                   // 39:42 ③ delete：最後元素提到 root，top-down
  sayT('③ delete：最後元素提到 root，top-down', 0, 6.8);
  say('③ delete：把最後位置的元素提到 root', '再 top-down 找它該放的位置');
}]);

// 41:18 Huffman 會用到的兩個技巧、ASCII
FRAG.push(['treec-huf2', 'Huffman 的兩個技巧、ASCII 是 fixed length', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3, 0.6]);
  await step(tok);                                   // 41:18 技巧一：binary tree
  ghost(BLUE, -3.2, 2.2, 4.2, 2.8);
  sayT('① binary tree', -3.2, 4.0);
  cube('', LEAFC, SMALL, -3.2, 3.0); cube('', BLUE, SMALL, -4.1, 1.6); cube('', BLUE, SMALL, -2.3, 1.6);
  seg(V(-3.2, 2.75, 0), V(-4.1, 1.85, 0), '#7a6a52'); seg(V(-3.2, 2.75, 0), V(-2.3, 1.85, 0), '#7a6a52');
  say('Huffman code 會用到兩個技巧', '① 建一棵 binary tree');
  await step(tok);                                   // 41:24 技巧二：priority queue
  ghost(ORANGE, 3.2, 2.2, 4.2, 2.8);
  sayT('② priority queue', 3.2, 4.0);
  [1, 1, 2, 4].forEach((v, k) => cube(v, PURPLE, SMALL, 2.0 + k * 0.8, 1.6, 0, 2));
  say('② 建一個 priority queue', '每次拿出「最小的」');
  await step(tok);                                   // 41:36 priority queue 就是 heap
  okT('= heap！', 3.2, 4.8);
  say('priority queue 用什麼做？就是剛剛的 heap', '');
  await step(tok);                                   // 41:45 編碼後傳給對方
  const tx = prop('monitor', -5.4, 0, 3.0, 0.7, '傳送端'), rx = prop('monitor', 5.4, 0, 3.0, 0.7, '接收端');
  await fling(tok, '0110…', V(-4.6, 1.2, 3.0), V(4.6, 1.2, 3.0), 1300);
  say('Huffman 要做 encode：把字變成 bits 傳出去', '像以前的傳真機');
  await step(tok);                                   // 41:53 對方根據 code 解碼
  pkt('解碼 → 文字', 5.4, 2.4, 3.0);
  say('對方收到 bits，照 code 解回原本的字', 'decode');
  await step(tok);                                   // 42:02 ASCII
  const w = 'Eerie';
  const cs = [...w].map((ch, k) => { const x = -3.6 + k * 1.8; const b = cube(ch, ch === 'E' ? ORANGE : BLUE, NODE, x, 6.6, 0, 2); const l = mono(tag(ch.charCodeAt(0).toString(2).padStart(8, '0'), 'idx', x, 5.8)); return { b, l }; });
  say('先想想 ASCII：每個字元對到一個標準 code', '');
  await step(tok);                                   // 42:10 大寫 A 和小寫 a 不一樣
  lit(cs[0].b, GOLD); lit(cs[1].b, GOLD);
  say('大寫和小寫的 code 不一樣', 'E = 01000101，e = 01100101');
  await step(tok);                                   // 42:32 fixed length coding
  lit(cs[0].b); lit(cs[1].b); sayT('每個字都 8 bits：fixed length', 0, 7.6);
  say('ASCII 是 fixed length coding', '每個字元的 code 長度都一樣');
}]);

// 42:53 Huffman 概念：頻率越高碼越短
FRAG.push(['treec-hfreq', 'Huffman：出現越多、碼越短', async (tok) => {
  fresh(); lab.frameCamera([0, 4.6, 13.5], [0, 3, 0.6]);
  const huff = buddy('David Huffman', '1952', '#f4a56a', -6.2, 0, 2.6, 0.75);
  const freq = new Map(); for (const ch of SENT) freq.set(ch, (freq.get(ch) || 0) + 1);
  const keys = [...freq.keys()].sort((a, b) => freq.get(b) - freq.get(a) || SENT.indexOf(a) - SENT.indexOf(b));
  const colX = (ch) => -5.5 + keys.indexOf(ch) * 1.0;
  let bs = [];
  await step(tok);                                   // 42:53 1952 年 David Huffman
  await huff.hop(tok);
  say('1952 年，David Huffman 發明了 Huffman code', '');
  await step(tok);                                   // 43:07 用最少的 code length 編碼
  huff.mood('happy');
  say('目標：用最少的 code length 來編碼', '同一段文字，bits 越少越好');
  await step(tok);                                   // 43:29 這一行字
  bs = SENT.map((ch, k) => cube(ch, ch === 'e' ? ORANGE : ch === '␣' ? PURPLE : BLUE, [0.42, 0.42, 0.42], -6.25 + k * 0.5, 6.6, 0, 1.5));
  say('看這一行字（推測是 "Eerie eyes seen near lake."）', '用 ASCII 存，每個字元一個 code');
  await step(tok);                                   // 43:42 E 和 e 的 code 長度差不多
  lit(bs[0], GOLD); lit(bs[1], GOLD);
  say('大寫 E、小寫 e 各有 ASCII code', '它們用的 code length 一樣');
  await step(tok);                                   // 43:59 哪個字母出現最多次？
  lit(bs[0]); lit(bs[1]); huff.look(1);
  say('哪一個字母出現最多次？', '大寫 E 還是小寫 e？');
  await step(tok);                                   // 44:18 小寫 e 最多
  bs.forEach((b, k) => SENT[k] === 'e' && lit(b, GOLD));
  say('小寫 e 出現最多次（8 次）', '它出現這麼多，能不能用最少的 bit 表示它？');
  await step(tok);                                   // 44:33 ASCII 不管幾次都一樣長
  bs.forEach((b) => lit(b));
  say('傳統 ASCII：不管出現幾次，長度都一樣', '每個字母 8 bits');
  await step(tok);                                   // 45:02 Huffman：次數越高，碼越短
  sayT('出現越多 → 碼越短', 0, 7.6); huff.mood('happy');
  say('Huffman：依每個字元出現的 frequency 編碼', '出現次數越高，編碼長度越短');
  await step(tok);                                   // 45:47 對字母做統計
  keys.forEach((ch) => tag(ch, 'ptr', colX(ch), 0, 1.0));
  const cnt = new Map();
  bs.forEach((b, k) => { const ch = SENT[k], c = cnt.get(ch) || 0; cnt.set(ch, c + 1); lab.springTo(b, V(colX(ch), 0.25 + c * 0.45, 0)); });
  await wait(tok, 1200);
  keys.forEach((ch) => tag(String(freq.get(ch)), 'idx', colX(ch), 0.25 + freq.get(ch) * 0.45 + 0.1));
  say('統計的是「字元」不是單字', '每個字元出現幾次');
  await step(tok);                                   // 46:04 空白 4 次也要編碼，句點也要
  bs.forEach((b, k) => (SENT[k] === '␣' || SENT[k] === '.') && lit(b, GOLD));
  say('空白（space）出現 4 次，也要編碼', '句點也要編碼：電腦很笨，每個字元都要存');
  await step(tok);                                   // 46:16 作業：scan 檔案找 frequency
  bs.forEach((b) => lit(b)); prop('file', 6.2, 0, 2.4, 0.9, '作業的檔案');
  say('作業：scan 整個檔案，每一行', '把每個字元的 frequency 找出來');
}]);

// 46:37 Huffman tree、code table、編碼解碼、208 vs 73
FRAG.push(['treec-hcomp', 'Huffman tree、code table 與壓縮', async (tok) => {
  fresh(); lab.frameCamera([0, 4.4, 13.5], [0, 3.6, 0]);
  const { root } = huffRun(); const codes = huffCodes(root);
  let ct = [];
  await step(tok);                                   // 46:37 最後建出的 Huffman tree
  hufShow(root, { topY: 6.8, step: 1.25 }, false, 3);
  say('根據頻率建出來的 Huffman tree 長這樣', '葉子 = 字元（下面是次數），中間 = 次數加總');
  await step(tok);                                   // 47:00 code table
  hufBits(root);
  for (const n of gAll(root)) if (!n.kids.length) { const l = mono(tag(n.code, 'idx', n.pos.x, n.pos.y - 0.95, 0.4)); l.element.style.fontSize = '10px'; ct.push(l); }
  say('左 0、右 1：每個字元得到一個 code', '整理成 code table（碼書）');
  await step(tok);                                   // 47:12 依 code table 寫出這一行
  const word = 'Eerie'; const eT = mono(tag('', 'ptr alt', 0, 0.3, 2.6));
  for (let k = 1; k <= 5; k++) { const lf = hLeaf(root, word[k - 1]); lit(lf.body, GOLD); setTag(eT, word.slice(0, k) + ' → ' + [...word.slice(0, k)].map((c) => codes[c]).join(' ')); await wait(tok, 420); lit(lf.body); }
  say('編碼：照 code table 把每個字換成 bits', '前 5 個字元示範');
  await step(tok);                                   // 47:29 解碼
  const cur = makeCursor(); cur.obj.scale.set(0.7, 0.7, 0.7); cursorTo(cur, root.pos);
  say('解碼：給你一串 bits，用 code table 還原', '');
  await step(tok);                                   // 47:38 例如 1010…
  let n = root; for (const b of '10') { n = n.kids[Number(b)]; cursorTo(cur, n.pos); await wait(tok, 500); }
  lit(n.body, GREEN); setTag(eT, '10 → e');
  say('例如讀到 1、0：右、左 → 走到 e', '到葉子就解出一個字，再回 root');
  await step(tok);                                   // 48:08 26 個字元，73 bits
  cur.obj.visible = false; for (const x of gAll(root)) lab.flyAway(x.body, V(0, 8, -4)); kill(eT); ct.forEach(kill);
  const b1 = bar(GRAYC, 1.4, 1.2, -1.6, 0), b2 = bar(ORANGE, 1.4, 1.2, 1.6, 0);
  tag('ASCII', 'ptr', -1.6, 0, 1.3); tag('Huffman', 'ptr alt', 1.6, 0, 1.3);
  await growBar(tok, b2, 73 / 36, 700); tag('73 bits', 'idx', 1.6, 73 / 36 + 0.4);
  say('這一行共 26 個字元', '投影片：用 Huffman 只要 73 bits');
  await step(tok);                                   // 48:18 ASCII 每字 8 bits
  note('每字 8 bits', -1.6, 6.8);
  say('如果用 ASCII，每個字母都要 8 bits', '');
  await step(tok);                                   // 48:28 26 × 8 = 208
  await growBar(tok, b1, 208 / 36, 900); tag('208 bits', 'idx', -1.6, 208 / 36 + 0.4);
  say('26 × 8 = 208 bits', '');
  await step(tok);                                   // 48:50 compression
  okT('208 → 73：壓縮！', 0, 7.4);
  say('從 208 bits 降到 73 bits：compression（壓縮）', '註：照這張頻率表重算最佳是 84 bits，一樣遠小於 208');
}]);

// ═══════════ Rk3aap_HZHU：Lec16（Huffman 2/2、BST、winner/loser tree、forest、disjoint sets） ═══════════
const tl = (n) => (n.ch ? n.ch + n.f : String(n.f));
// 一行字 → 字元方塊，再依字元疊成次數柱
function sentBlocks(y = 6.6, drop = 1.5) { return SENT.map((ch, k) => cube(ch, ch === 'e' ? ORANGE : ch === '␣' ? PURPLE : BLUE, [0.42, 0.42, 0.42], -6.25 + k * 0.5, y, 0, drop)); }
function freqCols(bs) {
  const freq = new Map(); for (const ch of SENT) freq.set(ch, (freq.get(ch) || 0) + 1);
  const keys = [...freq.keys()].sort((a, b) => freq.get(b) - freq.get(a) || SENT.indexOf(a) - SENT.indexOf(b));
  const colX = (ch) => -5.5 + keys.indexOf(ch) * 1.0;
  keys.forEach((ch) => tag(ch, 'ptr', colX(ch), 0, 1.0));
  const cnt = new Map();
  bs.forEach((b, k) => { const ch = SENT[k], c = cnt.get(ch) || 0; cnt.set(ch, c + 1); lab.springTo(b, V(colX(ch), 0.25 + c * 0.45, 0)); });
  return { freq, keys, colX, num: () => keys.forEach((ch) => tag(String(freq.get(ch)), 'idx', colX(ch), 0.25 + freq.get(ch) * 0.45 + 0.1)) };
}

// 0:00 Huffman：binary tree + priority queue；統計字元頻率
FRAG.push(['treec-p16freq', 'Huffman：先統計每個字元出現幾次', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.0, 0.4]);
  let bs, fc;
  await step(tok);                                   // 0:00 應用：binary tree + priority queue（= heap）
  sayT('Huffman code = binary tree + priority queue', 0, 7.6); note('priority queue → 想到 heap', 0, 6.9);
  say('Huffman coding 是一個應用', '會用到 binary tree 和 priority queue（就是 heap）');
  await step(tok);                                   // 0:40 假設看到一個句子
  bs = sentBlocks(5.6);
  say('假設有一個句子', '"Eerie eyes seen near lake."（26 個字元）');
  await step(tok);                                   // 0:47 對每個字母做統計
  fc = freqCols(bs); await wait(tok, 1200); fc.num();
  say('對句子裡的每個字母做統計', '每個字元出現幾次，就疊幾塊');
  await step(tok);                                   // 0:54 目的：知道誰最頻繁
  say('統計的目的：知道哪些字母最常出現', '');
  await step(tok);                                   // 1:02 小寫 e 出現 8 次
  bs.forEach((b, k) => SENT[k] === 'e' && lit(b, GOLD));
  say('統計結果：小寫 e 出現 8 次', '');
  await step(tok);                                   // 1:09 大寫 E 只出現一次
  bs.forEach((b) => lit(b)); bs.forEach((b, k) => SENT[k] === 'E' && lit(b, GOLD));
  say('大寫 E 只出現 1 次', '大小寫是不同字元，分開統計');
  await step(tok);                                   // 1:15 space、句點、冒號、引號也要統計
  bs.forEach((b, k) => lit(b, SENT[k] === '␣' || SENT[k] === '.' ? GOLD : null));
  say('space、句點、冒號、引號這些也要統計', '存句子時它們一樣要存');
  await step(tok);                                   // 1:38 每個字母和標點都做 frequency 統計
  bs.forEach((b) => lit(b)); okT('frequency 表完成', 0, 4.6);
  say('每個字母、標點都要有 frequency', '');
  await step(tok);                                   // 1:54 phase 1：開檔、scan、統計
  const f = prop('file', 6.0, 0, 2.4, 0.9, 'phase 1：開檔 → scan → 統計'); bob(f, 0.04);
  say('作業 phase 1：開檔、scan 所有字元', '把每個字元出現的次數統計出來');
}]);

// 2:04 phase 2：Huffman tree 的建法（min heap、bottom-up）與 Huffman node
FRAG.push(['treec-p16node', 'Huffman tree：用 min heap、bottom-up 合併', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.2, 0.4]);
  const pqZ = zone('priority queue（min heap）', -3.6, 0, 1.6, 6.0, 2.4, '#e8e0f4');
  await step(tok);                                   // 2:04 phase 2
  sayT('phase 2：建 Huffman tree', 0, 7.6);
  say('統計完，進入 phase 2', '');
  await step(tok);                                   // 2:10 Huffman tree 是 binary tree
  const r = cube('?', INC, LSZ, 3.4, 6.0), a = cube('', LEAFC, LSZ, 2.6, 4.8), b = cube('', LEAFC, LSZ, 4.2, 4.8);
  seg(V(3.4, 5.75, 0), V(2.6, 5.05, 0), '#7a6a52'); seg(V(3.4, 5.75, 0), V(4.2, 5.05, 0), '#7a6a52');
  say('Huffman tree 是一棵 binary tree', '');
  await step(tok);                                   // 2:26 建的時候靠 priority queue
  const items = [['E', 1], ['i', 1], ['y', 1], ['r', 2], ['␣', 4], ['e', 8]].map(([c, f], k) => ({ c, f, b: cube(c + f, LEAFC, LSZ, -5.8 + k * 0.9, 0.4, 1.6, 2) }));
  say('建樹要靠一個 priority queue', '把統計結果放進去');
  await step(tok);                                   // 2:42 是 minimum heap
  okT('min heap：最小的在最前面', -3.6, 2.4, 1.6);
  say('用的是 minimum heap', '為了每次都能很快拿到 frequency 最小的');
  await step(tok);                                   // 3:00 最少的先抓出來 merge
  lab.springTo(items[0].b, V(-1.0, 3.0, 1.6)); lab.springTo(items[1].b, V(0.0, 3.0, 1.6));
  await wait(tok, 700);
  const z = cube('2', INC, LSZ, -0.5, 4.1, 1.6, 1.5);
  seg(V(-0.5, 3.85, 1.6), V(-1.0, 3.25, 1.6), '#7a6a52'); seg(V(-0.5, 3.85, 1.6), V(0.0, 3.25, 1.6), '#7a6a52');
  say('每次把出現最少的兩個抓出來 merge（合併）', 'E1 + i1 → 新 node 2');
  await step(tok);                                   // 3:09 merge 完再丟回 queue
  await fling(tok, '2 丟回去', V(-0.5, 4.8, 1.6), V(-3.6, 1.4, 1.6), 900);
  say('合併好的再丟回 priority queue', '繼續 merge');
  await step(tok);                                   // 3:17 建立是 bottom-up
  arrow(V(5.8, 3.0, 0), V(5.8, 6.4, 0), ORANGE); tag('bottom-up', 'ptr alt', 5.8, 2.5);
  say('所以 Huffman tree 是 bottom-up 長出來的', '不是 top-down');
  await step(tok);                                   // 3:32 最小的在最下面
  lit(a, GOLD); lit(b, GOLD);
  say('frequency 最小的，本來就該在樹的最下面', '所以先抓出來合併');
  await step(tok);                                   // 3:54 Huffman node：字元
  const card = [['字元 ch', '#9fd3f0'], ['freq', '#f2c46d'], ['left', '#d8c29b'], ['right', '#d8c29b']];
  const cb = card.map(([t, c], k) => cube(t, c, [1.15, 0.55, 0.7], 1.6 + k * 1.2, 1.2, 2.2, 2));
  [1, 2, 3].forEach((k) => cb[k].obj.visible = false);
  sayT('Huffman node', 3.4, 2.2, 2.2);
  say('程式裡的 Huffman node：第一個欄位是字元', '');
  await step(tok);                                   // 4:02 frequency
  cb[1].obj.visible = true;
  say('第二個欄位：frequency（出現次數）', '');
  await step(tok);                                   // 4:16 兩個 pointer
  cb[2].obj.visible = true; cb[3].obj.visible = true;
  say('還有兩個 pointer：left、right', '指向左右兩個 child');
  await step(tok);                                   // 4:29 MyQueue = priority queue = heap
  tag('MyQueue', 'ptr', -3.6, 3.0, 1.6);
  say('程式裡的 priority queue 叫 MyQueue', '它其實就是一個 heap');
}]);

// 4:57 統計表 insert 成 min heap
FRAG.push(['treec-p16heap', '頻率表一個一個 insert 成 min heap', async (tok) => {
  fresh(); lab.frameCamera([0, 5.2, 13.5], [0, 3.2, 1.2]);
  const H = HV([], { width: 10.4, cells: 12, dx: 0.88, top: 6.4, step: 1.25, col: LEAFC });
  const order = HORDER.map((c) => ({ c, f: HF[c] }));
  const cards = order.map((o, k) => cube(o.c + o.f, GRAYC, LSZ, -5.5 + k * 1.0, 7.7, 0));
  let n = 0;
  const ins = async (k, ms = 300) => {
    const o = order[k]; kill(cards[k]); n++; const p = H.mk(n, o.c + o.f, LEAFC, 2); p.f = o.f; await wait(tok, ms);
    let i = n; while (i > 1 && H.at(i).f < H.at(i >> 1).f) { H.swap(i, i >> 1); i >>= 1; await wait(tok, ms); }
  };
  await step(tok);                                   // 4:57 一開始只有單一字元和 frequency
  cards.forEach((c, k) => { lit(c, GOLD); });
  say('一開始只有單一的字元（字母、空白、標點）', '每個都帶著自己的 frequency');
  await step(tok);                                   // 5:16 insert 進 array 實作的 queue
  cards.forEach((c) => lit(c));
  for (let i = 1; i <= 12; i++) H.tile(i, PINK);
  say('把它們 insert 進那個用 array 做的 priority queue', '');
  await step(tok);                                   // 5:30 min PQ：第一個位置最小
  for (let i = 2; i <= 12; i++) H.tile(i); H.tile(1, TGOLD);
  note('[1] 永遠是 frequency 最小的', -4.6, 1.3, 2.6);
  say('它是 minimum priority queue', '第一個位置放 frequency 最小的');
  await step(tok);                                   // 6:02 統計表進來 → 建 min heap
  H.tile(1);
  say('phase 1 的統計表，要拿來建出 min heap', '');
  await step(tok);                                   // 6:20 先丟 E（1），再丟 e（8）
  await ins(0); await ins(1);
  say('例如先丟 E（次數 1），再丟 e（次數 8）', H.arr(2));
  await step(tok);                                   // 6:31 每次 insert 都要調整
  await ins(2, 260); await ins(3, 260);
  say('每次 insert 完都要調整（bottom-up）', 'i1 比 e8 小 → 往上換');
  await step(tok);                                   // 6:38 root 永遠最小；insert／delete 都要會
  H.lit(1, GOLD);
  say('調整後要符合 min heap：root 永遠最小', 'heap 的 insert、delete 都要自己實作');
  await step(tok);                                   // 6:50 全部丟進去後長這樣
  H.lit(1); for (let k = 4; k < 12; k++) await ins(k, 90);
  say('全部 insert 完，heap 大概長這樣', '（同 frequency 不交換；確切排列為示意）');
}]);

// 7:03 Huffman 演算法主迴圈
FRAG.push(['treec-p16algo', 'Huffman 演算法：while 迴圈五步', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.2, 0.6]);
  const cd = code(['while (heap 裡有 ≥ 2 個) {', '  z = new HuffmanNode;', '  z.left  = deleteMin();', '  z.right = deleteMin();', '  z.freq = z.left.freq + z.right.freq;', '  insert(z);', '}'], -3.4, 7.0, 0.55);
  const row = [['E', 1], ['i', 1], ['y', 1], ['l', 1], ['r', 2], ['␣', 4], ['e', 8]];
  const rb = row.map(([c, f], k) => cube(c + f, LEAFC, LSZ, -5.6 + k * 0.95, 0.4, 2.4));
  tag('min heap（依 frequency 排）', 'ptr', -2.8, 0.4, 3.6);
  let z;
  await step(tok);                                   // 7:03 while：heap 裡有兩個以上
  cd.hl(0);
  say('while：heap 裡還有兩個（或以上）element', '就繼續做');
  await step(tok);                                   // 7:12 第一步：產生新的 Huffman node
  cd.hl(1); const w = wire(V(3.6, 5.6, 0));
  say('第一步：產生一個新的 Huffman node z', '');
  await step(tok);                                   // 7:37 從 min heap 把最小的兩個 delete 出來
  cd.hl(2); lit(rb[0], GOLD); lit(rb[1], GOLD);
  say('從 min heap 把最小的兩個 delete 出來', '要 delete 兩次');
  await step(tok);                                   // 7:47 第一次拿最小
  lab.springTo(rb[0], V(2.8, 4.2, 0));
  say('第一次 delete：拿到最小的 E1', '');
  await step(tok);                                   // 8:00 第二次：原本第二小變最小
  cd.hl(3); lab.springTo(rb[1], V(4.4, 4.2, 0));
  for (let k = 2; k < rb.length; k++) lab.springTo(rb[k], V(-5.6 + (k - 2) * 0.95, 0.4, 2.4));
  say('第二次 delete：原本第二小的 i1 變成最小，被拿出來', '');
  await step(tok);                                   // 8:06 第一個 = left child
  cd.hl(2); seg(V(3.4, 5.35, 0), V(2.9, 4.45, 0), '#7a6a52'); tag('left', 'ptr', 2.2, 4.9);
  say('第一個拿出來的當 z 的 left child', '');
  await step(tok);                                   // 8:25 第二個 = right child
  cd.hl(3); seg(V(3.8, 5.35, 0), V(4.3, 4.45, 0), '#7a6a52'); tag('right', 'ptr', 5.0, 4.9);
  say('第二個拿出來的當 right child', '');
  await step(tok);                                   // 8:32 freq = 左 + 右
  cd.hl(4); kill(w); z = cube('2', INC, LSZ, 3.6, 5.6, 0, 1.5);
  say('z.freq = left 的 freq + right 的 freq', '1 + 1 = 2');
  await step(tok);                                   // 8:47 新 node insert 回 queue
  cd.hl(5);
  // 2 goes in after r2: ␣4 and e8 step aside so it gets its own place in the queue
  lab.springTo(rb[5], V(-5.6 + 4 * 0.95, 0.4, 2.4)); lab.springTo(rb[6], V(-5.6 + 5 * 0.95, 0.4, 2.4));
  await fling(tok, 'z (2)', V(3.6, 6.3, 0), V(-2.75, 1.2, 2.4), 900);
  cube('2', INC, LSZ, -5.6 + 3 * 0.95, 0.4, 2.4, 1.5);
  say('最後把 z insert 回 priority queue', '它代表一棵小 subtree');
  await step(tok);                                   // 8:56 直到 while 不成立
  cd.hl(0);
  say('一直重複，直到 heap 剩一個', '那一個就是整棵 Huffman tree 的 root');
}]);

// 9:04 實例：Eerie eyes seen near lake.
FRAG.push(['treec-p16build', 'Huffman tree 建構實例：一次合併兩個最小', async (tok) => {
  fresh(); lab.frameCamera([0, 5.0, 13.8], [0, 3.6, 0.2]);
  let pq = HORDER.map((c) => ({ ch: c, f: HF[c], label: c, kids: [] })).sort((a, b) => a.f - b.f);
  let held = [];
  const SR = { label: '', kids: pq };
  const lay = () => { SR.kids = pq; layoutG(SR, { width: 11, topY: 7.5, step: 1.2 }); };
  const all = () => { const o = []; for (const r of [...pq, ...held]) gAll(r, o); return o; };
  const spawn = (n, drop = 0) => { const b = lab.addBody(block(tl(n), LSZ, n.ch ? LEAFC : INC)); b.obj.position.copy(n.pos).add(V(0, drop, 0)); if (drop) lab.dropTo(b, n.pos.clone()); else b.target.copy(n.pos); n.body = b; };
  edgeLines(() => { const out = []; for (const n of all()) for (const k of n.kids) if (n.body && k.body) out.push([n.body.obj.position, k.body.obj.position]); return out; }, 0.25);
  lay(); pq.forEach((n) => spawn(n));
  const slide = () => { lay(); for (const n of gAll(SR).slice(1)) if (n.body) lab.springTo(n.body, n.pos.clone()); };
  const merge = (ms) => {
    const a = pq.shift(), b = pq.shift(); const z = { f: a.f + b.f, label: String(a.f + b.f), kids: [a, b] };
    let i = pq.findIndex((x) => x.f > z.f); if (i < 0) i = pq.length; pq.splice(i, 0, z);
    lay(); spawn(z, 1.2); slide(); return wait(tok, ms);
  };
  const qT = tag('priority queue 由小到大 →', 'ptr', -4.6, 7.7);
  let a, b;
  await step(tok);                                   // 9:04 一開始 queue 裡有這些
  say('一開始 queue 裡有這 12 個字元', '依 frequency 由小到大');
  await step(tok);                                   // 9:11 最小的兩個：E 和 i
  a = pq.shift(); b = pq.shift(); held = [a, b];
  lit(a.body, GOLD); lit(b.body, GOLD);
  lab.springTo(a.body, V(-5.6, 8.3, 0)); lab.springTo(b.body, V(-4.4, 8.3, 0));
  say('最小的兩個是 E 和 i：把它們 delete 出來', '');
  await step(tok);                                   // 9:20 delete 後 min heap 要調整
  slide();
  say('delete 之後，min heap 要調整', '剩下的重新排好，最小的又在最前面');
  await step(tok);                                   // 9:41 第一個拿出 E，第二個拿出 i
  const t1 = tag('第 1 個', 'idx', -5.6, 9.0), t2 = tag('第 2 個', 'idx', -4.4, 9.0);
  say('第一個拿出來的是 E，第二個是 i', '');
  await step(tok);                                   // 9:49 新 node 的 left、right
  remove(t1); remove(t2);
  lab.springTo(a.body, V(-5.5, 7.6, 0)); lab.springTo(b.body, V(-4.5, 7.6, 0));
  const w = wire(V(-5.0, 8.7, 0));
  say('它們分別當新 node 的 left child 和 right child', 'E 在左、i 在右');
  await step(tok);                                   // 9:59 frequency = 1 + 1
  kill(w); const z = { f: 2, label: '2', kids: [a, b] }; z.pos = V(-5.0, 8.7, 0); spawn(z); held = [z];
  lit(a.body); lit(b.body);
  say('新 node 的 frequency = 1 + 1 = 2', '');
  await step(tok);                                   // 10:05 insert 回 queue（要調整位置）
  let i = pq.findIndex((x) => x.f > z.f); if (i < 0) i = pq.length; pq.splice(i, 0, z); held = []; slide();
  say('這個新 node insert 回 queue', 'insert 也要調整它在 heap 裡的位置');
  await step(tok);                                   // 10:57 再抓 y 和 l
  await merge(900);
  say('queue 還有很多：再抓最小的兩個 y、l', '合併成 2，再放回去');
  await step(tok);                                   // 11:24 k 和句點
  await merge(900);
  say('接著抓 k 和句點', 'frequency 2，再丟回去');
  await step(tok);                                   // 11:48 iteration 一直做
  for (let k = 0; k < 5; k++) await merge(480);
  say('依此類推，一輪一輪做下去', '');
  await step(tok);                                   // 12:07 做到 heap 只剩兩個
  await merge(700); await merge(700);
  say('做到 heap 裡只剩兩個 element', '');
  await step(tok);                                   // 12:17 每個是一棵 subtree：10 和 16
  lit(pq[0].body, GOLD); lit(pq[1].body, GOLD);
  say('每個 element 都是一棵 subtree', 'frequency 10 和 16（各自 subtree 的總和）');
  await step(tok);                                   // 12:42 最後合併：root 26
  lit(pq[0].body); lit(pq[1].body); await merge(900); lit(pq[0].body, GREEN); remove(qT);
  say('最後一輪：兩個合併，root 的 frequency = 26', '');
  await step(tok);                                   // 12:49 這就是最後的 Huffman tree
  okT('Huffman tree 完成（26 = 全部字元數）', 0, 8.6);
  say('這就是最後的 Huffman tree', '葉子是字元，越常出現越靠近 root');
}]);

// 13:29 編碼：左 0 右 1
FRAG.push(['treec-p16enc', 'Huffman 編碼：左 0、右 1', async (tok) => {
  fresh(); lab.frameCamera([0, 4.6, 13.5], [0, 3.8, 0]);
  const { root } = huffRun(); const codes = huffCodes(root);
  hufShow(root, { topY: 7.0, step: 1.25 });
  const cur = makeCursor(); cur.obj.scale.set(0.7, 0.7, 0.7);
  await step(tok);                                   // 13:29 建好樹後編碼；左 0 右 1
  hufBits(root);
  say('樹建好後，下一步是編碼', '規則：往左走記 0，往右走記 1');
  await step(tok);                                   // 13:38 例：編大寫 E
  lit(hLeaf(root, 'E').body, GOLD);
  say('例如要編大寫 E', '從 root 26 出發');
  await step(tok);                                   // 13:56 26→10、10→4、4→2 都往左
  const path = []; let n = root; for (const bit of codes.E) { path.push(n); n = n.kids[Number(bit)]; }
  const bitsT = mono(tag('', 'ptr alt', -4.8, 0.6, 1.8));
  cursorTo(cur, root.pos);
  for (let k = 1; k < 4; k++) { await wait(tok, 380); cursorTo(cur, path[k].pos); setTag(bitsT, 'E：' + '0'.repeat(k)); }
  say('26 → 10 是 0，10 → 4 是 0，4 → 2 也是 0', '');
  await step(tok);                                   // 14:08 2 → E 是 0；每個字母都在 leaf
  cursorTo(cur, n.pos); setTag(bitsT, 'E：' + codes.E);
  say('2 → E 也是 0：E 的 code = ' + codes.E, '每個字母都在 leaf');
  await step(tok);                                   // 14:18 code = root 到 leaf 的路
  say('Huffman code 就是從 root 走到那個 leaf 的路徑', '');
  await step(tok);                                   // 14:25 每個字母都這樣 → code table
  cur.obj.visible = false;
  for (const lf of gAll(root)) if (!lf.kids.length) { const l = mono(tag(lf.code, 'idx', lf.pos.x, lf.pos.y - 0.95, 0.4)); l.element.style.fontSize = '10px'; }
  say('每個 leaf 都走一次，就得到 code table', 'e 只要 2 bits，最常出現所以最短');
  await step(tok);                                   // 14:36 E 和 i 只差最後一個 bit
  lit(hLeaf(root, 'i').body, GOLD); setTag(bitsT, 'E：' + codes.E + '　i：' + codes.i);
  say('E = ' + codes.E + '、i = ' + codes.i + '：只差最後一個 bit', '（老師口頭說 000／001，少算一層）');
}]);

// 14:53 Huffman tree 唯一嗎？
FRAG.push(['treec-p16tie', 'Huffman tree 唯一嗎？', async (tok) => {
  fresh(); lab.frameCamera([0, 4.6, 13.5], [0, 3.2, 0.6]);
  const ones = ['E', 'i', 'y', 'l', 'k', '.'];
  const qx = (k) => -5.0 + k * 0.95;
  const ob = ones.map((c, k) => cube(c + '1', LEAFC, LSZ, qx(k), 0.4, 2.2));
  [['r', 2], ['s', 2], ['n', 2], ['a', 2], ['␣', 4], ['e', 8]].forEach(([c, f], k) => cube(c + f, LEAFC, LSZ, qx(6 + k), 0.4, 2.2));
  const stu = buddy('同學', '?', '#7cb8ee', -5.6, 0, -1.6, 0.75);
  await step(tok);                                   // 14:53 Huffman tree 是唯一的嗎？
  say('問題：Huffman tree 是唯一的嗎？', '');
  await step(tok);                                   // 15:04 Huffman code 唯一嗎？
  stu.mood('wow');
  say('Huffman code 是唯一的嗎？', '有人搖頭……');
  await step(tok);                                   // 15:20 input：各字元的 frequency
  sayT('input：每個字元的 frequency', 0, 1.6, 2.2);
  say('input 是每個字元的 frequency', '');
  await step(tok);                                   // 15:26 output：一棵 Huffman tree
  const r = cube('26', INC, LSZ, 0.5, 6.4), a = cube('10', INC, LSZ, -1.0, 5.2), b = cube('16', INC, LSZ, 2.0, 5.2);
  seg(V(0.5, 6.15, 0), V(-1.0, 5.45, 0), '#7a6a52'); seg(V(0.5, 6.15, 0), V(2.0, 5.45, 0), '#7a6a52');
  sayT('output：一棵 Huffman tree', 0.5, 7.4);
  say('output 是一棵 Huffman tree', '這棵樹只會長成一種樣子嗎？');
  await step(tok);                                   // 15:44 那麼多 1，為什麼 E 放前面？
  ob.forEach((c) => lit(c, GOLD));
  say('frequency 1 的有好多個', '為什麼是大寫 E 排前面？也可以 l 或 k 排前面');
  await step(tok);                                   // 15:52 只要不違反 heap 特質
  ob.forEach((c) => lit(c));
  const ord = ['l', 'k', 'E', 'i', 'y', '.'];
  ord.forEach((c, k) => lab.springTo(ob[ones.indexOf(c)], V(qx(k), 0.4, 2.2)));
  okT('同樣是 1，誰先都不違反 min heap', -0.5, 3.0, 2.2);
  say('只要不違反 heap 的特質就好', '同 frequency 的順序可以換');
  await step(tok);                                   // 15:58 順序一改，樹就不一樣
  lit(ob[ones.indexOf('l')], GOLD); lit(ob[ones.indexOf('k')], GOLD);
  noT('第一次就變成合併 l、k → 樹不同', 4.0, 4.0);
  stu.mood('happy');
  say('順序一改變，合併的對象就變，樹也就不同', 'Huffman tree／code 不唯一（但總 bit 數一樣少）');
}]);

// 18:04 壓縮效益與 overhead
FRAG.push(['treec-p16ratio', '壓縮效益：208 → 104 + 存樹的 overhead', async (tok) => {
  fresh(); lab.frameCamera([0, 4.6, 13.5], [0, 2.8, 0]);
  let bs;
  await step(tok);                                   // 18:04 用 ASCII 存剛才的句子
  bs = sentBlocks(6.6);
  say('來算一算：用 ASCII 存剛才那個句子', '');
  await step(tok);                                   // 18:15 26 個字元（含句點、空白）
  bs.forEach((b, k) => (SENT[k] === '␣' || SENT[k] === '.') && lit(b, GOLD));
  say('句子總共 26 個字元', '空白和句點也算');
  await step(tok);                                   // 18:26 每字 8 bit：208
  bs.forEach((b) => lit(b));
  const b1 = bar(GRAYC, 1.4, 1.2, -2.4, 0); tag('ASCII', 'ptr', -2.4, 0, 1.3);
  await growBar(tok, b1, 208 / 50, 800); tag('8 × 26 = 208 bits', 'idx', -2.4, 208 / 50 + 0.4);
  say('ASCII 每個字母 8 bits', '8 × 26 = 208 bits');
  await step(tok);                                   // 18:35 假設 Huffman 每個 4 bits：104
  const b2 = bar(ORANGE, 1.4, 1.2, 0.2, 0); tag('Huffman', 'ptr alt', 0.2, 0, 1.3);
  await growBar(tok, b2, 104 / 50, 700); tag('4 × 26 = 104 bits', 'idx', 0.2, 104 / 50 + 0.4);
  say('老師假設 Huffman code 每個都 4 bits', '4 × 26 = 104 bits（簡化假設）');
  await step(tok);                                   // 18:47 省下空間
  okT('208 → 104：省一半', -1.1, 5.6);
  say('本來 208 bits，現在只要 104 bits', '省下空間');
  await step(tok);                                   // 19:09 overhead：要存 Huffman tree
  const tr = prop('file', 3.6, 0, 0, 1.0, 'header：存 Huffman tree'); bob(tr, 0.04);
  say('但有 overhead（額外成本）', '要把 Huffman tree 也存起來，不然沒辦法解碼');
  await step(tok);                                   // 19:19 檔案 = 104 + X
  const b3 = lab.box(PURPLE, [1.4, 0.5, 1.2]); b3.position.set(0.2, 104 / 50 + 0.25, 0); lab.world.add(b3);
  tag('+ X（樹）', 'idx', 1.5, 104 / 50 + 0.5);
  say('實際檔案大小 = 104 + X', 'X 是存那棵樹的空間');
}]);

// 19:42 解碼
FRAG.push(['treec-p16dec', 'Huffman 解碼：讀 bit，0 左 1 右走到 leaf', async (tok) => {
  fresh(); lab.frameCamera([0, 4.6, 13.5], [0, 3.8, 0]);
  const { root } = huffRun(); huffCodes(root);
  hufShow(root, { topY: 7.0, step: 1.25 }, true);
  const cur = makeCursor(); cur.obj.scale.set(0.7, 0.7, 0.7);
  const bits = '10'; const bT = mono(tag('', 'ptr alt', -4.6, 0.5, 2.0)); const outT = mono(tag('', 'ptr', 3.6, 0.5, 2.0));
  await step(tok);                                   // 19:42 收到用 Huffman 編碼的檔案
  setTag(bT, '收到：1 0 1 1 0 1 …');
  const f = prop('file', -6.2, 0, 1.2, 0.8, '編碼後的檔案'); bob(f, 0.04);
  say('收到一個用 Huffman 編碼的檔案', '要把它解碼，還原每個字母');
  await step(tok);                                   // 20:00 解碼很簡單
  say('解碼其實很簡單', '手上要有那棵 Huffman tree');
  await step(tok);                                   // 20:08 從頭 scan bit，traverse 樹
  cursorTo(cur, root.pos);
  say('從頭一個 bit 一個 bit 讀', '每讀一個 bit，就在樹上走一步');
  await step(tok);                                   // 20:18 0 往左、1 往右
  say('讀到 0 往左走，讀到 1 往右走', '');
  await step(tok);                                   // 20:26 一定會走到 leaf → 字
  note('走到 leaf 就是一個字', 0, 8.0);
  say('一定會走到某個 leaf', 'leaf 上的字元就是解出來的字');
  await step(tok);                                   // 20:34 讀到 1 → 右邊的 16
  let n = root.kids[1]; cursorTo(cur, n.pos); setTag(bT, '讀：1');
  say('例如先讀到 1 → 往右走到 16', '');
  await step(tok);                                   // 20:45 再讀 0 → 左 → e
  n = n.kids[0]; cursorTo(cur, n.pos); setTag(bT, '讀：1 0'); lit(n.body, GREEN); setTag(outT, '解出：e');
  say('再讀到 0 → 往左，走到小寫 e', '10 → e');
  await step(tok);                                   // 20:56 走到 leaf 就輸出，回 root 繼續
  await wait(tok, 300); cursorTo(cur, root.pos);
  say('走到 leaf、不能再往下：輸出這個字母', '然後回到 root，繼續讀下一個 bit');
  await step(tok);                                   // 21:16 作業：編碼＋解碼
  okT('作業：編碼 + 解碼都要做', 0, 8.6);
  say('作業要做編碼也要做解碼', '助教會給編碼後的文字，請你解出明文');
}]);

// ── BST ──
const RK = '30(5(2,),40(32,45))';
const RKO = { cx: 3.4, width: 5.2, topY: 6.4, minY: 3.0 };
const LS = { '30': 3, '5': 2, '2': 1, '40': 2, '32': 1, '45': 1 };
// 樹上每個 node 上方標 leftSize
function lsTag(n, cls = 'ptr alt') { return tag(String(LS[n.label]), cls, n.pos.x, n.pos.y + 0.62, 0); }

// 22:27 BST 定義與判斷
FRAG.push(['treec-p16bstchk', 'BST：左邊小、右邊大；哪一棵是 BST？', async (tok) => {
  fresh(); lab.frameCamera([0, 4.6, 13], [0, 3.6, 0]);
  let L, R;
  await step(tok);                                   // 22:27 binary search tree
  R = showTree('30(5(2,),40)', { cx: 3.3, width: 4, minY: 3.0 });
  sayT('Binary Search Tree（BST）', 3.3, 7.6);
  say('接著講 binary search tree（BST）', '它是一種有特別規則的 binary tree');
  await step(tok);                                   // 22:35 left subtree 都比 root 小
  ghost(BLUE, find(R, '5').pos.x - 0.3, 3.9, 2.4, 2.6);
  for (const l of ['5', '2']) lit(find(R, l).body, GREEN);
  say('規則一：left subtree 的 node 都比 root 小', '5、2 都 < 30');
  await step(tok);                                   // 22:43 right subtree 都比 root 大
  lit(find(R, '40').body, GOLD);
  say('規則二：right subtree 的 node 都比 root 大', '40 > 30');
  await step(tok);                                   // 22:52 常考：分辨哪一棵是
  for (const n of levelorder(R)) lit(n.body);
  L = showTree('20(15(12,18),25(,22))', { cx: -3.3, width: 5, minY: 3.0 });
  tag('左邊這棵', 'ptr', -3.3, 7.4); tag('右邊這棵', 'ptr', 3.3, 6.8);
  say('常考題：給兩棵樹，哪一棵是 BST？', '');
  await step(tok);                                   // 23:08 左邊這棵不是
  noT('不是 BST', -3.3, 1.9);
  say('左邊這棵不是 BST', '為什麼？');
  await step(tok);                                   // 23:19 22 比 25 小卻在右邊
  lit(find(L, '25').body, GOLD); lit(find(L, '22').body, RED);
  tag('22 < 25 卻在右邊', 'ptr alt', find(L, '22').pos.x, find(L, '22').pos.y - 0.8);
  say('22 比 25 小，卻放在 25 的右邊', '違反「右邊都比較大」');
  await step(tok);                                   // 23:25 右邊這棵符合
  for (const n of levelorder(R)) { lit(n.body, GREEN); await wait(tok, 250); }
  okT('是 BST ✓', 3.3, 1.9);
  say('右邊這棵每個 node 都符合', '它是 BST');
  await step(tok);                                   // 23:41 再複習特質
  say('整理：左子樹全部 < root < 右子樹全部', '每個 node 都要成立，而且是跟整棵子樹比');
}]);

// 23:59 BST search：recursive 與 iterative
FRAG.push(['treec-p16bstsrch', 'BST search：比大小，往左或往右', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.6, 0]);
  const T = showTree(RK, RKO);
  const cur = makeCursor();
  const xb = buddy('x', 32, ORANGE, 6.4, 0, 3.0, 0.7);
  let cd;
  await step(tok);                                   // 23:59 給一個數字，問存不存在
  say('search：給你一個數字 x', '問它在不在這棵 BST 裡（老師沒給數字，用 32 示範）');
  await step(tok);                                   // 24:21 先跟 root 比
  cursorTo(cur, find(T, '30').pos);
  say('先跟 root 比：比 root 小還是大？', '32 vs 30');
  await step(tok);                                   // 24:33 小往左、大往右
  cursorTo(cur, find(T, '40').pos);
  say('比 root 小往左走，比 root 大往右走', '32 > 30 → 往右');
  await step(tok);                                   // 24:42 往下一層後 recursive 地重複
  await wait(tok, 400); cursorTo(cur, find(T, '32').pos); lit(find(T, '32').body, GREEN); xb.mood('happy');
  say('到下一層，再做同樣的比較', '32 < 40 → 往左 → 找到 32！');
  await step(tok);                                   // 24:59 search 是 recursive function
  arrow(V(5.2, 5.2, 0), V(4.4, 3.8, 0), ORANGE, true); tag('自己呼叫自己', 'ptr alt', 5.8, 5.6);
  say('每一層做的事都一樣', '所以 search 寫成 recursive function（自己呼叫自己）');
  await step(tok);                                   // 25:16 member function Search(x)
  lit(find(T, '32').body);
  cd = code(['TreeNode* Search(TreeNode* b, int x) {', '  if (!b) return 0;', '  if (x == b->data) return b;', '  if (x < b->data)', '    return Search(b->leftChild, x);', '  return Search(b->rightChild, x);', '}'], -3.4, 6.6, 0.55);
  cd.hl(0);
  say('BST 有一個 member function：Search', '參數是要找的 x，從 root 開始呼叫');
  await step(tok);                                   // 25:49 pointer 是空的 → return 0
  cd.hl(1); xb.set(35); xb.mood('calm');
  for (const l of ['30', '40', '32']) { cursorTo(cur, find(T, l).pos); await wait(tok, 400); }
  cursorTo(cur, find(T, '32').pos.clone().add(V(0.6, -1.2, 0))); noT('null → 找不到', 3.6, 1.8); xb.mood('sad');
  say('如果 pointer 是空的（空樹，或走到 null）', 'return 0：找不到（例：找 35）');
  await step(tok);                                   // 26:14 等於 data → return 這個 node
  cd.hl(2); cursorTo(cur, find(T, '30').pos);
  say('如果 x 等於這個 node 的 data', '就 return 這個 tree node');
  await step(tok);                                   // 26:30 比較小 → 往 left child
  cd.hl(4);
  say('如果 x 比較小', '往 left child 繼續 Search');
  await step(tok);                                   // 26:52 比較大 → 往 right child
  cd.hl(5);
  say('否則比較大', '往 right child 繼續 Search');
  await step(tok);                                   // 27:14 iterative：for 迴圈
  cd.kill();
  cd = code(['for (t = root; t; ) {', '  if (x == t->data) return t;', '  if (x < t->data) t = t->leftChild;', '  else t = t->rightChild;', '}', 'return 0;'], -3.4, 6.6, 0.55);
  cd.hl(0);
  say('不用 recursive 也可以：用 for 迴圈（iterative）', '');
  await step(tok);                                   // 27:37 相等回傳、小往左、否則往右，直到 null
  for (const [l, h] of [['30', 2], ['40', 2], ['32', 3]]) { cursorTo(cur, find(T, l).pos); cd.hl(h); await wait(tok, 600); }
  cd.hl(4);
  say('相等就回傳；比較小往左，否則往右', '直到 pointer 變成 null 為止');
  await step(tok);                                   // 28:10 回去看程式
  cd.hl(-1); cur.obj.visible = false;
  say('這兩段程式回去都要看', 'search 的時間 = 走的層數（樹高）');
}]);

// 28:30 第 k 個：naive 作法與 leftSize
FRAG.push(['treec-p16kth', '找第 k 個：笨方法與 leftSize 欄位', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.6, 0.6]);
  let T, H;
  await step(tok);                                   // 28:30 找第五大
  const row = [2, 5, 30, 32, 40, 45].map((v, k) => cube(v, GRAYC, SMALL, -2.5 + k * 1.0, 7.6, 0, 1.5));
  say('除了找某個數字，也可以問：第 5 大的是誰？', '有點像排序後取第幾名');
  await step(tok);                                   // 28:46 kth largest
  sayT('kth largest：老大、老二、老三……', 0, 8.4);
  say('排過之後的老大、老二……第 k 名', '叫 kth largest');
  await step(tok);                                   // 29:00 search by rank
  say('這種問題叫 search by rank（依名次搜尋）', '');
  await step(tok);                                   // 29:08 例：60 70 65 80
  row.forEach(kill);
  T = showTree('60(,70(65,80))', { cx: -3.0, width: 4.4, topY: 6.4, minY: 3.4 });
  say('例：一棵 BST，裡面是 60、70、65、80', '');
  await step(tok);                                   // 29:19 第二大是誰？
  say('問：第二大的數字是誰？', '你會怎麼做？');
  await step(tok);                                   // 29:37 最笨：traverse，丟進 max heap
  H = HV([], { cx: 3.4, width: 3.6, cells: 4, ax: 3.4, dx: 0.8, top: 6.0, col: PURPLE });
  const seq = [60, 70, 65, 80]; let n = 0;
  for (const v of seq) { lit(find(T, String(v)).body, GOLD); n++; H.mk(n, v, PURPLE, 2); await wait(tok, 300); let i = n; while (i > 1 && H.at(i).v > H.at(i >> 1).v) { H.swap(i, i >> 1); i >>= 1; await wait(tok, 260); } lit(find(T, String(v)).body); }
  say('最笨的方法：traverse 整棵樹', '看到一個就丟進 max heap');
  await step(tok);                                   // 30:02 heap 的 array[2] 就是第二大
  H.lit(2, GREEN); H.tile(2, TGREEN);
  say('heap 的 array[2] = 70 就是第二大', '（只在這例成立；一般要 deleteMax k 次）');
  await step(tok);                                   // 30:26 課本：新增欄位 leftSize
  for (const v of [60, 70, 65, 80]) kill(find(T, String(v)).body);
  for (const p of H.slot.values()) H.drop(p);
  const card = [['leftChild', '#d8c29b'], ['data', '#9fd3f0'], ['leftSize', '#f2c46d'], ['rightChild', '#d8c29b']];
  const cb = card.map(([t, c], k) => cube(t, c, [1.5, 0.6, 0.8], -2.4 + k * 1.6, 4.4, 0, 2));
  sayT('BST node 多一個欄位', 0, 5.6);
  say('課本的作法：在 node 裡新增一個欄位 leftSize', '');
  await step(tok);                                   // 30:50 leftSize 記左邊的 element 個數
  lit(cb[2], GOLD);
  say('leftSize 記錄：left subtree 有幾個 element', '');
  await step(tok);                                   // 31:02 再加 1（自己）
  okT('leftSize = left subtree 個數 + 1', 0.0, 3.2);
  say('再加 1，也就是加上它自己', 'leftSize = 左子樹個數 + 1');
}]);

// 31:11 leftSize 實例
FRAG.push(['treec-p16lsize', 'leftSize：以自己為 root 數左邊', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.6, 0]);
  const T = showTree(RK, { cx: 0, width: 7, topY: 6.4, minY: 2.8 });
  const g = (l) => find(T, l);
  await step(tok);                                   // 31:11 上面的數字是 leftSize
  say('每個 node 上方的數字就是它的 leftSize', '一個一個算');
  await step(tok);                                   // 31:19 5：left subtree 只有一個 → 2
  const gh = ghost(BLUE, g('2').pos.x, g('2').pos.y, 1.2, 1.0); lit(g('5').body, GOLD); lsTag(g('5'));
  say('5 的 left subtree 只有一個 node（2）', 'leftSize = 1 + 1 = 2');
  await step(tok);                                   // 31:36 2：沒有 left subtree → 1
  kill(gh); lit(g('5').body); lit(g('2').body, GOLD); lsTag(g('2'));
  say('2 沒有 left subtree', 'leftSize = 0 + 1 = 1');
  await step(tok);                                   // 31:43 30：左邊 2 個 → 3
  lit(g('2').body); lit(g('30').body, GOLD);
  const g2 = ghost(BLUE, (g('5').pos.x + g('2').pos.x) / 2, (g('5').pos.y + g('2').pos.y) / 2, 2.4, 2.4); lsTag(g('30'));
  say('root 30 的 left subtree 有 2 個 node（5、2）', 'leftSize = 2 + 1 = 3');
  await step(tok);                                   // 31:56 40：左邊只有 32 → 2
  kill(g2); lit(g('30').body); lit(g('40').body, GOLD); const g3 = ghost(BLUE, g('32').pos.x, g('32').pos.y, 1.2, 1.0); lsTag(g('40'));
  say('40 的 left subtree 只有 32', 'leftSize = 1 + 1 = 2');
  await step(tok);                                   // 32:07 別把祖先的左邊算進來
  noT('不是看 30 的左邊！', -2.6, 7.6);
  say('注意：以 40 自己當 root，只看它下面的左邊', '不要把 30 那一邊的 node 算進來');
  await step(tok);                                   // 32:26 這就是 leftSize 的設定
  kill(g3); lit(g('40').body); lsTag(g('32')); lsTag(g('45'));
  say('沒有左小孩的 32、45：leftSize 都是 1', '全部設好了');
}]);

// 33:20 用 leftSize 找第 k 個（k = 5）
FRAG.push(['treec-p16rank', '用 leftSize 找第 5 小', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.6, 0.6]);
  const T = showTree(RK, { cx: 0, width: 7, topY: 6.4, minY: 2.8 });
  for (const n of levelorder(T)) lsTag(n);
  const cur = makeCursor();
  const kb = buddy('k', '', ORANGE, -6.0, 0, 1.6, 0.8);
  await step(tok);                                   // 33:23 k=1 最大、k=2 第二大（老師一開始的說法）
  say('第 k 大：k = 1 最大、k = 2 第二大……', '老師一開始這樣說，等等會更正');
  await step(tok);                                   // 33:59 找 k = 5
  kb.set(5); await kb.hop(tok);
  say('例：找 k = 5', '');
  await step(tok);                                   // 34:10 更正：由小到大
  noT('更正：由小到大排，第 k 個', 0, 8.2);
  say('老師更正：應該是「由小到大」排序後的第 k 個', '也就是第 k 小');
  await step(tok);                                   // 34:47 2 5 30 32 40 45：第 5 是 40
  const ord = ['2', '5', '30', '32', '40', '45'];
  ord.forEach((l, k) => { cube(l, l === '40' ? ORANGE : GRAYC, SMALL, -2.5 + k * 1.0, 0.35, 2.6, 1.5); tag(String(k + 1), 'idx', -2.5 + k * 1.0, 0, 3.3); });
  say('由小到大：2、5、30、32、40、45', '第 5 個是 40');
  await step(tok);                                   // 35:42 30 的左邊只有 3 個
  cursorTo(cur, find(T, '30').pos);
  say('從 root 30 開始：它的 leftSize = 3', '左邊數到 30 為止只有 3 個數字');
  await step(tok);                                   // 35:55 一定不在左邊
  ghost(RED, -2.8, 4.2, 2.4, 2.4);
  say('要找的是第 5 個', '絕對不會在左邊');
  await step(tok);                                   // 36:12 k = 5 > leftSize → 往右
  cursorTo(cur, find(T, '40').pos);
  say('k = 5 > root 的 leftSize 3', '往右邊走');
  await step(tok);                                   // 36:26 往右走 k 要做減法
  kb.mood('wow');
  say('注意：往右走時，k 要做減法', '');
  await step(tok);                                   // 36:53 k = 5 − 3 = 2
  kb.set(2); kb.mood('happy');
  say('k = 5 − 3 = 2', '扣掉 root 左邊那 3 個（含 30 自己）');
  await step(tok);                                   // 37:13 在以 40 為 root 的子樹找第 2 個
  ghost(GREEN, 2.1, 4.2, 3.6, 2.6);
  say('現在變成：在以 40 為 root 的子樹裡找第 2 個', '');
  await step(tok);                                   // 37:31 leftSize 剛好等於 2 → 40
  lit(find(T, '40').body, GREEN);
  say('40 的 leftSize 剛好 = 2', 'return 40 ✓');
  await step(tok);                                   // 37:47 只要往右走就減
  okT('往右走 → k -= leftSize', 0, 8.2);
  say('重點：只要往右走，k 就要減掉 leftSize', '');
}]);

// 38:02 rank 的程式碼
FRAG.push(['treec-p16rcode', 'Rank(k) 程式碼：往右才減', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.6, 0.6]);
  const T = showTree(RK, RKO);
  for (const n of levelorder(T)) lsTag(n);
  const cd = code(['TreeNode* Rank(int k) {', '  t = root;', '  while (t) {', '    if (k == t->leftSize) return t;', '    if (k < t->leftSize) t = t->leftChild;', '    else { k -= t->leftSize;', '           t = t->rightChild; }', '  }', '  return 0;', '}'], -3.4, 6.8, 0.52);
  const cur = makeCursor();
  const kb = buddy('k', '', ORANGE, -6.2, 0, 2.4, 0.7);
  await step(tok);                                   // 38:02 輸入 k：由小到大第 k 個
  cd.hl(0);
  say('輸入 k：要找由小到大的第 k 個', '');
  await step(tok);                                   // 38:12 從 root 開始
  cd.hl(1); cursorTo(cur, find(T, '30').pos);
  say('一開始 t 指向 root', '');
  await step(tok);                                   // 38:22 k == leftSize → return
  cd.hl(3); kb.set(3); lit(find(T, '30').body, GREEN);
  say('k 等於 t 的 leftSize 就 return t', '例：找第 3 個，root 30 就是第 3');
  await step(tok);                                   // 38:36 k < leftSize → 往左
  cd.hl(4); lit(find(T, '30').body); kb.set(1); await wait(tok, 400); cursorTo(cur, find(T, '5').pos);
  say('k 比 leftSize 小：往 left subtree 走', '例：找第 1 個');
  await step(tok);                                   // 38:43 往左不用減
  okT('往左：k 不變', -0.4, 1.2);
  say('往左走時，k 不用做減法', 'k 還是 1');
  await step(tok);                                   // 39:00 否則 k -= leftSize
  cd.hl(5); cursorTo(cur, find(T, '30').pos); kb.set(5); await wait(tok, 500); kb.set(2);
  say('否則：k -= t->leftSize', '例：找第 5 個 → 5 − 3 = 2');
  await step(tok);                                   // 39:08 t = rightChild；往右就要減
  cd.hl(6); cursorTo(cur, find(T, '40').pos);
  say('然後 t = t->rightChild 往右走', '準則：往右走就要做減法');
  await step(tok);                                   // 39:23 思考題：leftSize 怎麼決定？
  cd.hl(-1); cur.obj.visible = false;
  const q = buddy('?', '', '#7cb8ee', 0.6, 0, 2.6, 0.7); q.mood('wow');
  sayT('leftSize 要怎麼算出來？', 0.6, 2.2, 2.6);
  say('思考題：每個 node 的 leftSize 要怎麼決定？', '');
  await step(tok);                                   // 39:50 期末考：寫出程式
  noT('期末考可能要你寫程式', 0.6, 1.6, 2.6);
  say('期末考可能會要你寫出決定 leftSize 的程式碼', '回去想想看');
}]);

// 40:20 BST insert
FRAG.push(['treec-p16bins', 'BST insert：先 search，空的地方放進去', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13], [0, 3.6, 0]);
  const T = makeTree('30(5(2,),40(35,80))');
  layoutTree(T, Object.assign({}, TREE_O, { cx: 0, width: 7, topY: 6.4, minY: 2.8 }));
  for (const n of levelorder(T)) if (n.label !== '35' && n.label !== '80') { nodeBody(n).obj.position.copy(n.pos); n.body.target.copy(n.pos); }
  edgeLines(() => treePairs(T));
  const cur = makeCursor();
  let xb = null;
  await step(tok);                                   // 40:20 BST 怎麼 insert
  say('BST 要怎麼 insert 一個 node？', '');
  await step(tok);                                   // 40:32 insert／delete 都要維持 BST 特質
  sayT('左邊 < parent < 右邊', 0, 7.6);
  say('不管 insert 或 delete，都要維持 BST 的特質', '');
  await step(tok);                                   // 40:46 insert 80：先找它該待的位置
  xb = buddy('要 insert', 80, ORANGE, -5.6, 0, 1.6, 0.7);
  cursorTo(cur, find(T, '30').pos);
  say('例：insert 80', '先找出 80 應該待在哪裡（跟 search 一樣比大小）');
  await step(tok);                                   // 41:06 80 > 30 → 右半邊
  cursorTo(cur, find(T, '40').pos);
  say('80 比 root 30 大 → 放在 30 的右半邊', '（老師口誤說「往左」）');
  await step(tok);                                   // 41:19 80 > 40 → 右邊空的 → 放進去
  const n80 = find(T, '80'); cursorTo(cur, n80.pos); await wait(tok, 500);
  nodeBody(n80).obj.position.copy(n80.pos).add(V(0, 2, 0)); lab.dropTo(n80.body, n80.pos.clone()); xb.set(35);
  say('80 比 40 大 → 往右，剛好是空的', 'insert 在這裡');
  await step(tok);                                   // 41:26 insert 35：比 30 大往右
  cursorTo(cur, find(T, '30').pos); await wait(tok, 500); cursorTo(cur, find(T, '40').pos);
  say('再 insert 35：35 比 30 大 → 往右', '');
  await step(tok);                                   // 41:36 35 比 40 小 → 40 的 left child
  const n35 = find(T, '35'); cursorTo(cur, n35.pos); await wait(tok, 500);
  nodeBody(n35).obj.position.copy(n35.pos).add(V(0, 2, 0)); lab.dropTo(n35.body, n35.pos.clone()); xb.set(''); xb.mood('happy');
  say('35 比 40 小 → 往左，放到 40 的 left child', '');
  await step(tok);                                   // 41:48 會 search 就會 insert
  cur.obj.visible = false;
  okT('insert = search 找到 null 的地方再放', 0, 1.6);
  say('會 search 就會 insert', '呼叫的是相同的比較邏輯，時間也是 O(樹高)');
}]);

// 42:05 BST delete
FRAG.push(['treec-p16bdel', 'BST delete：單子樹直接接上、雙子樹找左邊最大', async (tok) => {
  fresh(); lab.frameCamera([0, 4.6, 13], [0, 3.6, 0]);
  const mk = (txt, c, x, y) => { const b = lab.addBody(block(txt, [W(txt), 0.6, 0.8], c)); b.obj.position.set(x, y, 0); b.target.set(x, y, 0); return b; };
  let n1, n2, T1, T2, alive = true, T = null;
  await step(tok);                                   // 42:05 最高準則：不破壞 BST
  sayT('delete 最高準則：刪完還是 BST', 0, 7.6);
  say('delete 的最高準則：不要破壞 BST 的特質', '');
  await step(tok);                                   // 42:09 node1、node2 與它們的 subtree
  n1 = mk('node1', LEAFC, -1, 6.2); n2 = mk('node2', BLUE, 1.4, 4.6); T1 = mk('T1', INC, -3.0, 4.6); T2 = mk('T2', INC, 3.0, 3.0);
  edgeLines(() => (T ? [] : alive ? [[n1.obj.position, T1.obj.position], [n1.obj.position, n2.obj.position], [n2.obj.position, T2.obj.position]] : [[n1.obj.position, T1.obj.position], [n1.obj.position, T2.obj.position]]));
  say('情況一：node2 是 node1 的右小孩', 'node2 只有 right subtree T2');
  await step(tok);                                   // 42:23 delete node2
  lit(n2, RED);
  say('要把 node2 delete 掉', '');
  await step(tok);                                   // 42:35 把下面的 subtree 整個接上來
  alive = false; lab.flyAway(n2, V(1, 8, 4)); lab.springTo(T2, V(1.4, 4.6, 0));
  say('最直接：把 node2 下面的 subtree 整個接上來', '');
  await step(tok);                                   // 42:45 T2 的 node 一定比 node1 大
  lit(T2, GREEN); okT('T2 全部 > node1 ✓', 3.4, 5.4);
  say('還是 BST：T2 本來就在 node1 的右邊', '所以 T2 的每個 node 都比 node1 大');
  await step(tok);                                   // 43:06 如果有兩個 subtree？
  noT('node2 左右都有 subtree 怎麼辦？', 0, 2.0);
  say('剛才 node2 只有 right subtree', '如果左右兩邊都有 subtree 呢？');
  await step(tok);                                   // 43:26 例：delete 60
  for (const b of [n1, T1, T2]) kill(b); T = showTree('40(20(10,30),60(50(45,55(52,)),70))', { width: 10, topY: 6.6, minY: 1.8 });
  const g = (l) => find(T, l); lit(g('60').body, RED);
  say('例：delete 60', '它下面有兩棵 subtree：以 50 為 root 的、和 70');
  await step(tok);                                   // 43:44 往 left subtree 找最大：55
  const path = ['50', '55']; for (const l of path) { lit(g(l).body, GOLD); await wait(tok, 450); }
  say('準則：往 left subtree 一路往右，找最大的', '這裡是 55');
  await step(tok);                                   // 43:57 把 55 拉上來取代 60
  const n60 = g('60'), n55 = g('55'), n52 = g('52');
  lab.flyAway(n60.body, V(0, 8, 4)); n60.body = n55.body; lab.springTo(n60.body, n60.pos.clone()); n55.body = null;
  say('把 55 拉上來，取代 60', '');
  await step(tok);                                   // 44:09 52 遞補 55 的位置
  n55.body = n52.body; n55.left = null; lab.springTo(n55.body, n55.pos.clone());
  for (const n of levelorder(T)) if (n.body) lit(n.body);
  say('55 原本的 child 52，遞補 55 的位置', '調整完成，還是 BST');
  await step(tok);                                   // 44:31 一般化：T2 最大或 T3 最小
  tag('T2（左子樹）找最大', 'ptr', -2.8, 7.6); tag('或 T3（右子樹）找最小', 'ptr alt', 3.0, 7.6);
  say('一般化：取左子樹 T2 的最大，或右子樹 T3 的最小', '兩種都可以；這例取 T2 的最大');
}]);

// 45:18 插入順序造成 skewed tree
FRAG.push(['treec-p16skew', '插入順序：1 到 10 依序 insert 變 skewed', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 4.0, 0]);
  const P = (k) => V(-5.0 + k * 0.95, 7.6 - k * 0.6, 0);
  const nodes = [];
  const add = (k) => { const b = cube(String(k + 1), depthColor(k), SMALL, P(k).x, P(k).y, 0, 2); if (k) nodes.push(seg(P(k - 1).clone().add(V(0.2, -0.2, 0)), P(k).clone().add(V(-0.2, 0.2, 0)), '#7a6a52')); nodes.push(b); };
  let row;
  await step(tok);                                   // 45:18 BST 一開始是 empty
  const e = noT('empty', -5.0, 7.6);
  say('BST 一開始是空的（empty）', '一堆數字依序 insert 進來');
  await step(tok);                                   // 45:27 insert 的順序會影響形狀
  say('insert 的順序，會影響 BST 長出來的樣子', '');
  await step(tok);                                   // 45:46 十個數字由小排到大
  row = [...Array(10)].map((_, k) => cube(String(k + 1), GRAYC, SMALL, 1.0 + (k % 5) * 0.8, 1.2 - Math.floor(k / 5) * 0.7, 2.6, 1.2));
  say('例：十個數字，由小排到大', '1 2 3 … 10');
  await step(tok);                                   // 46:00 照這個順序 insert
  say('照這個由小到大的順序 insert', '長出來的樹會長什麼樣？');
  await step(tok);                                   // 46:39 1 當 root
  remove(e); kill(row[0]); add(0);
  say('一開始樹是空的，1 就當 root', '');
  await step(tok);                                   // 46:46 2 比 1 大 → 右邊
  kill(row[1]); add(1);
  say('insert 2：2 比 1 大 → 放 1 的右邊', '');
  await step(tok);                                   // 46:56 3 又更大 → 繼續往右
  for (let k = 2; k < 10; k++) { kill(row[k]); add(k); await wait(tok, 280); }
  say('3 比 1、2 都大 → 又在右邊……一直往右', '');
  await step(tok);                                   // 47:03 skewed binary tree
  noT('往右歪斜：skewed tree', 2.4, 6.6);
  say('長出一棵往右歪的 skewed binary tree', '高度 = 10');
  await step(tok);                                   // 47:10 search 跟 linked list 沒差
  const cur = makeCursor(); cur.obj.scale.set(0.6, 0.6, 0.6);
  for (let k = 0; k < 10; k++) { cursorTo(cur, P(k)); await wait(tok, 200); }
  say('在 skewed tree 上 search，跟 linked list 一樣', '一個一個往下走 → O(n)');
  await step(tok);                                   // 47:29 希望比較 balanced
  cur.obj.visible = false;
  for (const o of nodes) kill(o);
  const B = showTree('5(3(2(1,),4),8(7(6,),9(,10)))', { cx: 0, width: 8, topY: 7.2, minY: 3.0 });
  okT('balanced：高度只有 4', 4.6, 7.4);
  say('想讓 BST 發揮作用，希望樹比較 balanced', '同樣 10 個數字，換個順序插入（示意）');
  await step(tok);                                   // 47:34 AVL tree：左右高度差 ≤ 1
  sayT('AVL tree：每次 insert 後調整，左右高度差 ≤ 1', 0, 1.6);
  say('第 8、9 章的 AVL tree', '每 insert 一個就調整，讓左右子樹高度最多差 1');
}]);

// ── selection tree（k = 8，Horowitz Fig 5.32 的 run） ──
const RUNS = [[10, 15, 16], [9, 20, 38], [20, 20, 30], [6, 15, 25, 28], [8, 15, 50], [9, 11, 16], [90, 95, 99], [17, 18, 20]];
function selB(topY, step0, withNode0) {
  const P = (i) => (i === 0 ? V(0, topY + step0 * 0.95, 0) : heapPos(i, topY, step0, 11.4));
  const node = {}, val = {}, runs = RUNS.map((r) => r.slice());
  const pairs = [];
  for (let i = withNode0 ? 1 : 2; i <= 15; i++) pairs.push(i === 1 ? [0, 1] : [i >> 1, i]);
  edgeLines(() => pairs.filter(([a, b]) => node[a] && node[b]).map(([a, b]) => [node[a].obj.position, node[b].obj.position]));
  for (let i = withNode0 ? 0 : 1; i <= 15; i++) tag(String(i), 'idx', P(i).x + 0.55, P(i).y - 0.3, 0.3);
  const runB = runs.map((r, j) => { const x = P(8 + j).x; tag('run' + (j + 1), 'idx', x, 0.05, 0.9); return r.slice(1).map((v, k) => cube(v, '#d8cfc0', [0.6, 0.38, 0.55], x, P(8).y - 0.85 - k * 0.5)); });
  const put = (i, v, color, from) => { if (node[i]) kill(node[i]); const b = lab.addBody(block(v, NODE, color)); b.obj.position.copy(from || P(i)); lab.springTo(b, P(i)); node[i] = b; val[i] = v; return b; };
  return { P, node, val, runs, runB, put };
}
// 一個 run 送出隊首、下一個上到 leaf
function nextRun(S, leaf) {
  const j = leaf - 8; S.runs[j].shift();
  const nb = S.runB[j].shift();
  lab.flyAway(S.node[leaf], V(0, 6, 5));
  S.node[leaf] = nb; S.val[leaf] = S.runs[j][0];
  lab.springTo(nb, S.P(leaf)); nb.obj.material.color.set(LEAFC);
  S.runB[j].forEach((b, k) => lab.springTo(b, V(S.P(leaf).x, S.P(8).y - 0.85 - k * 0.5, 0)));
}
const winOf = (S, i) => Math.min(S.val[2 * i], S.val[2 * i + 1]);
function winnerFull(S) { for (let j = 0; j < 8; j++) S.put(8 + j, RUNS[j][0], LEAFC); for (let i = 7; i >= 1; i--) S.put(i, winOf(S, i), i === 1 ? '#c08a1f' : BLUE); }

// 48:37 selection tree：winner tree
FRAG.push(['treec-p16win', 'Winner tree：像賽程表，小的勝出', async (tok) => {
  fresh(); lab.frameCamera([0, 4.6, 13.5], [0, 3.6, 0]);
  let S;
  await step(tok);                                   // 48:25 selection tree
  sayT('selection tree', 0, 8.4);
  say('接下來是一種很好玩的 tree：selection tree', '');
  await step(tok);                                   // 48:34 winner tree 和 loser tree
  tag('① winner tree', 'ptr', -2.4, 7.8); tag('② loser tree', 'ptr alt', 2.4, 7.8);
  say('有兩種：winner tree 和 loser tree', '先看 winner tree');
  await step(tok);                                   // 48:41 8 個 queue：run1..run8
  S = selB(7.0, 1.3, false);
  for (let j = 0; j < 8; j++) { S.put(8 + j, RUNS[j][0], LEAFC, S.P(8 + j).clone().add(V(0, 3, 0))); }
  say('現在有 8 個 queue：run1、run2……run8', '每個 leaf 放那個 run 的第一個數');
  await step(tok);                                   // 48:50 可以想成 8 個隊伍
  for (let j = 0; j < 8; j++) lit(S.node[8 + j], GOLD);
  say('可以把它們想成 8 個隊伍', '');
  await step(tok);                                   // 48:58 每個隊伍都由小排到大
  for (let j = 0; j < 8; j++) { lit(S.node[8 + j]); S.runB[j].forEach((b) => lit(b, GOLD)); }
  say('每個隊伍（run）裡的數字都已經由小排到大', '下面灰色的是排隊等著上場的');
  await step(tok);                                   // 49:07 賽程表：兩兩比較
  S.runB.forEach((r) => r.forEach((b) => lit(b)));
  for (let i = 7; i >= 4; i--) { const w = winOf(S, i); S.put(i, w, BLUE, S.P(S.val[2 * i] === w ? 2 * i : 2 * i + 1).clone()); }
  say('上面像比賽的賽程表：兩兩比較', '10 vs 9 → 9、20 vs 6 → 6、8 vs 9 → 8、90 vs 17 → 17');
  await step(tok);                                   // 49:19 complete binary tree
  sayT('complete binary tree', -4.8, 6.6);
  say('這個賽程表是一棵 complete binary tree', '');
  await step(tok);                                   // 49:25 勝者再跟勝者比
  for (let i = 3; i >= 2; i--) { const w = winOf(S, i); S.put(i, w, BLUE, S.P(S.val[2 * i] === w ? 2 * i : 2 * i + 1).clone()); }
  say('勝者再跟其他勝者比', '9 vs 6 → 6、8 vs 17 → 8');
  await step(tok);                                   // 49:32 root 是所有數字裡最小
  S.put(1, winOf(S, 1), '#c08a1f', S.P(5).clone()); lit(S.node[1], GOLD);
  say('最後的 root = 6', '是所有 run 裡最小的數字');
  await step(tok);                                   // 49:42 比較小的就是勝利者
  for (const i of [11, 5, 2, 1]) { lit(S.node[i], GREEN); await wait(tok, 250); }
  say('規則：比較小的就是贏家', '可以一路往 root 前進');
  await step(tok);                                   // 49:59 每個 leaf 對應一個 queue
  for (const i of [11, 5, 2, 1]) lit(S.node[i]);
  S.runB[3].forEach((b) => lit(b, GOLD)); lit(S.node[11], GOLD);
  say('每個 leaf node 對應到一個 queue', 'queue 裡放一堆排好的數字');
}]);

// 50:10 winner tree 重新比賽與複雜度
FRAG.push(['treec-p16win2', 'Winner tree：輸出 6，15 上來重新比', async (tok) => {
  fresh(); lab.frameCamera([0, 4.6, 13.5], [0, 3.6, 0]);
  const S = selB(7.0, 1.3, false); winnerFull(S);
  const outs = []; const outAt = (k) => V(-6.4, 7.6 - k * 0.7, 0);
  await step(tok);                                   // 50:10 透過 winner tree 很容易排序
  tag('輸出', 'ptr', -6.4, 8.4);
  say('透過 winner tree 也可以很容易地排序', '');
  await step(tok);                                   // 50:16 6 最小，被抓出來
  const o6 = cube('6', '#c08a1f', SMALL, S.P(1).x, S.P(1).y, 0); lab.springTo(o6, outAt(0)); outs.push(o6);
  say('6 是所有數字裡最小的 → output', '');
  await step(tok);                                   // 50:23 同一個 queue 的 15 上來
  nextRun(S, 11);
  say('6 出去後，它那個 queue（run4）的下一個 15 上來', '');
  await step(tok);                                   // 51:10 15 跟旁邊 queue 的 20 比
  lit(S.node[10], GOLD); lit(S.node[11], GOLD);
  say('15 跟旁邊那個 queue 的 20 比', '');
  await step(tok);                                   // 51:17 15 小 → 到 node5；再跟 node4 的 9 比
  lit(S.node[10]); lit(S.node[11]); S.put(5, 15, BLUE, S.P(11).clone());
  await wait(tok, 600); lit(S.node[4], GOLD); lit(S.node[5], GOLD);
  say('15 比較小 → 走到 node5', '再跟 node4 的 9 比');
  await step(tok);                                   // 51:28 9 比較小
  lit(S.node[4]); lit(S.node[5]); S.put(2, 9, BLUE, S.P(4).clone());
  say('9 比較小 → 9 勝出，到 node2', '');
  await step(tok);                                   // 51:36 9 再跟 8 比 → 8 是新的 winner
  lit(S.node[2], GOLD); lit(S.node[3], GOLD); await wait(tok, 500);
  lit(S.node[2]); lit(S.node[3]); S.put(1, 8, '#c08a1f', S.P(3).clone()); lit(S.node[1], GOLD);
  say('9 再跟 8 比：8 比較小', '8 成為新的 winner（下一個輸出）');
  await step(tok);                                   // 51:54 k = 8：幾個隊伍
  lit(S.node[1]); sayT('k = run 的數目 = 8', 3.6, 8.4);
  say('k 代表下面有幾個隊伍（run）', '這裡 k = 8');
  await step(tok);                                   // 52:21 n 個 record；建樹 O(k)
  note('setup（建整棵賽程表）：O(k)', -3.0, 0.2, 2.4);
  say('n = 全部 record（數字）的個數', '一開始建好 winner tree：O(k)');
  await step(tok);                                   // 52:35 每次重賽 O(log k)
  for (const i of [11, 5, 2, 1]) { lit(S.node[i], GOLD); await wait(tok, 200); }
  note('每次重賽：只走一條路 → O(log k)', 3.0, 0.2, 2.4);
  say('每輸出一個，只要沿一條路重賽', '樹高 log k → O(log k)');
  await step(tok);                                   // 53:03 n 筆 → O(n log k)
  for (const i of [11, 5, 2, 1]) lit(S.node[i]);
  okT('merge 全部：O(n log k)', 0, 8.4);
  say('n 筆 record 都要輸出一次', '總共 <span class="ok">O(n log k)</span>');
}]);

// 53:22 loser tree
FRAG.push(['treec-p16lose', 'Loser tree：node 存輸家，只跟 parent 比', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.8, 0]);
  const S = selB(6.6, 1.25, true); winnerFull(S);
  const LOS = { 1: 8, 2: 9, 3: 17, 4: 10, 5: 20, 6: 9, 7: 90 };
  await step(tok);                                   // 53:22 小修改
  say('loser tree：winner tree 的小修改', '');
  await step(tok);                                   // 53:31 winner tree 的 node 放 winner
  for (let i = 1; i <= 7; i++) lit(S.node[i], GOLD);
  say('原本 winner tree 的 node 放的是 winner', '也就是比較小的數');
  await step(tok);                                   // 53:40 loser tree 放 loser
  for (let i = 1; i <= 7; i++) { lit(S.node[i]); S.put(i, LOS[i], PURPLE); }
  S.put(0, 6, '#c08a1f', S.P(1).clone());
  say('loser tree 的 node 放的是比賽的 loser（輸家）', '');
  await step(tok);                                   // 53:51 輸的是數字大的，佔住 parent node
  lit(S.node[4], GOLD); lit(S.node[8], GOLD); lit(S.node[9], GOLD);
  say('這裡輸的人 = 數字大的人，留在 parent node 上', '例：10 vs 9，10 輸了 → node4 放 10');
  await step(tok);                                   // 54:09 重賽只跟 parent 比
  for (const i of [4, 8, 9]) lit(S.node[i]);
  lab.flyAway(S.node[0], V(0, 6, 5)); delete S.node[0];
  nextRun(S, 11); await wait(tok, 500);
  lit(S.node[5], GOLD); await wait(tok, 450); lit(S.node[5]);            // 15 vs 20：15 贏，20 留著
  lit(S.node[2], GOLD); await wait(tok, 450); S.put(2, 15, PURPLE); lit(S.node[2]);   // 15 vs 9：9 贏，15 留下
  lit(S.node[1], GOLD); await wait(tok, 450); S.put(1, 9, PURPLE); lit(S.node[1]);    // 9 vs 8：8 贏，9 留下
  say('6 輸出後 15 上來：一路只跟 parent 存的 loser 比', '20 → 9 → 8，不用再找兄弟節點');
  await step(tok);                                   // 54:25 最上面 node 0 是 winner
  S.put(0, 8, '#c08a1f', S.P(1).clone()); lit(S.node[0], GOLD);
  say('最上面的 node 0 存整體的 winner', '現在是 8');
  await step(tok);                                   // 54:34 loser tree 是 winner tree 的變形
  lit(S.node[0]);
  say('loser tree 就是 winner tree 的變形', '');
}]);

// 54:45 為什麼要 winner tree：external sort
FRAG.push(['treec-p16ext', '為什麼要 winner tree：記憶體放不下的排序', async (tok) => {
  fresh(); lab.frameCamera([0, 5.0, 13.5], [0, 2.6, 0.6]);
  const stu = buddy('同學', '?', '#7cb8ee', -6.0, 0, 2.2, 0.75);
  const mem = zone('memory（記憶體）', -1.0, 0, 0, 5.8, 2.6, '#cfe3d4');
  let cs = [];
  await step(tok);                                   // 54:45 為什麼要 winner tree？
  say('想一想：為什麼要 winner tree？', '');
  await step(tok);                                   // 55:09 直接 sort 不就好了？
  stu.mood('wow');
  say('把數字從小排到大，直接 sort 不就好了？', '');
  await step(tok);                                   // 55:18 全部 run 的數字拿去 sort
  cs = [...Array(16)].map((_, k) => cube(String((k * 7) % 23), GRAYC, [0.5, 0.5, 0.5], -3.31 + (k % 8) * 0.66, 0.3 + Math.floor(k / 8) * 0.62, 0, 2));
  say('上面那些 run 頂多十幾個數字', '全部放進 memory 排一排就好了');
  await step(tok);                                   // 56:24 memory 放不下怎麼辦
  const big = prop('disk', 4.6, 0, 0, 1.6, '超多數字（memory 放不下）'); bob(big, 0.04);
  noT('memory 放不下！', -1.0, 2.2);
  say('但如果數字多到 memory 放不下呢？', '');
  await step(tok);                                   // 56:50 切成 8 個 partition
  cs.forEach(kill);
  const parts = [...Array(8)].map((_, k) => prop('file', -5.6 + k * 1.6, 0, -2.6, 0.7));
  say('把資料切成 8 個 partition', '怎麼切不重要');
  await step(tok);                                   // 57:04 每個 partition 自己 sort
  for (const p of parts) { p.position.y = 0.4; await wait(tok, 150); p.position.y = 0; }
  okT('每份都小到放得進 memory → 各自 sort', 0, 1.6, -2.6);
  say('每個 partition 自己 sort', '每一份都保證放得進 memory');
  await step(tok);                                   // 57:12 建 winner tree，不用多少 memory
  const tr = [V(-1.0, 1.9, 0), V(-1.8, 1.1, 0), V(-0.2, 1.1, 0)].map((p, k) => cube(k ? '' : 'win', k ? BLUE : '#c08a1f', SMALL, p.x, p.y, p.z, 1.5));
  seg(V(-1.0, 1.65, 0), V(-1.8, 1.35, 0), '#7a6a52'); seg(V(-1.0, 1.65, 0), V(-0.2, 1.35, 0), '#7a6a52');
  say('再建一棵 winner tree', '樹本身很小，用不到多少 memory');
  await step(tok);                                   // 57:27 partition + winner tree → 大量排序
  for (let k = 0; k < 4; k++) await fling(tok, String(k + 1), V(-5.6 + k * 3.2, 1.0, -2.6), V(-1.0, 2.4, 0), 500);
  await fling(tok, '1 2 3 4 …', V(-1.0, 2.4, 0), V(4.6, 2.4, 2.4), 700);
  stu.mood('happy');
  say('partition + winner tree', '就能排序大規模的數字');
  await step(tok);                                   // 57:55 external sort：internal vs external
  tag('internal sort：全部放得進 memory', 'ptr', -3.2, 3.6, 2.4); tag('external sort：放不下', 'ptr alt', 3.2, 3.6, 2.4);
  say('這對應到 external sort', 'sorting 分成 internal sort 和 external sort');
  await step(tok);                                   // 58:08 memory 放不下就用 external；分散式 node
  [-2, 0, 2].forEach((x) => prop('monitor', x + 3.2, 0, 3.6, 0.5));
  say('memory 放不下全部資料時，就用 external sort', '也可以讓很多台電腦（node）各算一點');
}]);

// 61:29 Forest
FRAG.push(['treec-p16forest', 'Forest：轉成 binary tree 與 traversal', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.4, 0.6]);
  const Ts = [['A(B,C,D)', -3.8, 2.6], ['E(F)', 0.2, 0], ['G(H,I)', 3.4, 1.6]].map(([s, cx, w]) => { const r = parseG(s); layoutG(r, { cx, width: w, topY: 6.0, step: 1.7 }); return r; });
  const body = {};
  let mode = 'forest';
  const bt = makeTree('A(B(,C(,D)),E(F,G(H(,I))))');
  layoutTree(bt, Object.assign({}, TREE_O, { width: 8.4, topY: 6.6, minY: 1.8 }));
  edgeLines(() => {
    const o = [];
    if (mode === 'forest') Ts.forEach((r) => gAll(r).forEach((n) => n.kids.forEach((k) => { if (body[n.label] && body[k.label]) o.push([body[n.label].obj.position, body[k.label].obj.position]); })));
    else levelorder(bt).forEach((n) => [n.left, n.right].forEach((c) => { if (c) o.push([body[n.label].obj.position, body[c.label].obj.position]); }));
    return o;
  });
  const cur = makeCursor();
  await step(tok);                                   // 61:29 forest：很多樹
  Ts.forEach((r) => gAll(r).forEach((n) => { body[n.label] = cube(n.label, depthColor(n.depth), NODE, n.pos.x, n.pos.y, 0, 2.5); }));
  say('tree 是一棵樹；forest（森林）就是很多樹', '');
  await step(tok);                                   // 61:49 a set of disjoint trees：三棵
  ['T1', 'T2', 'T3'].forEach((t, k) => tag(t, 'ptr', [-3.8, 0.2, 3.4][k], 7.2));
  say('forest = a set of disjoint trees', '這個 forest 有三棵 tree，彼此不相連');
  await step(tok);                                   // 61:59 都可以表示成 binary tree
  say('這三棵樹都可以表示成一棵 binary tree', '');
  await step(tok);                                   // 62:17 跟 left child–right sibling 很像
  sayT('left child – right sibling', 0, 8.0);
  say('方法跟前面學的 left child–right sibling 一樣', '左邊連「第一個小孩」，右邊連「下一個兄弟」');
  await step(tok);                                   // 62:25 A 是 root，連到 B
  lit(body.A, GOLD); lit(body.B, GOLD);
  say('A 是 root，left child 連到它的第一個小孩 B', '');
  await step(tok);                                   // 62:32 sibling C、D 串起來
  lit(body.A); lit(body.B); lit(body.C, GOLD); lit(body.D, GOLD);
  say('B 的兄弟 C、D，用 right 一個接一個串起來', 'B → C → D');
  await step(tok);                                   // 62:40 E、F、G 也一樣
  lit(body.C); lit(body.D);
  mode = 'bt'; levelorder(bt).forEach((n) => lab.springTo(body[n.label], n.pos.clone()));
  say('E、F 和 G 也一樣；三棵樹的 root A、E、G 也當兄弟串起來', '整個 forest 變成一棵 binary tree');
  await step(tok);                                   // 62:58 為什麼要轉？
  say('為什麼要轉？', '不用為 forest 另外發展理論，用 binary tree 的技巧就好');
  await step(tok);                                   // 63:28 forest traversal
  say('轉換不是重點，跳過；接著看 forest traversal', '');
  await step(tok);                                   // 64:00 preorder：每棵樹的 preorder 接起來
  const pre = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
  for (let k = 0; k < 9; k++) { cursorTo(cur, find(bt, pre[k]).pos); cube(pre[k], ORANGE, SMALL, -3.2 + k * 0.8, 1.05, 2.6, 1.5); await wait(tok, 220); }
  say('forest 的 preorder = 每棵樹的 preorder 依序接起來', 'A B C D | E F | G H I');
  await step(tok);                                   // 64:10 inorder 也一樣
  const ino = ['B', 'C', 'D', 'A', 'F', 'E', 'H', 'I', 'G'];
  for (let k = 0; k < 9; k++) { cursorTo(cur, find(bt, ino[k]).pos); cube(ino[k], PURPLE, SMALL, -3.2 + k * 0.8, 0.35, 2.6, 1.5); await wait(tok, 220); }
  cur.obj.visible = false;
  say('inorder 也一樣，是各棵樹 inorder 的組合', 'B C D A | F E | H I G');
}]);

// ── disjoint sets：S1 = {0,6,7,8}（root 0）、S2 = {1,4,9}（root 4）、S3 = {2,3,5}（root 2） ──
const SC = { '0': BLUE, '6': BLUE, '7': BLUE, '8': BLUE, '4': ORANGE, '1': ORANGE, '9': ORANGE, '2': PURPLE, '3': PURPLE, '5': PURPLE };
function sets3(o = {}, which = [1, 2, 3]) {
  const F = FV(Object.assign({ color: (l) => SC[l] }, o));
  if (which.includes(1)) { F.add('0'); ['6', '7', '8'].forEach((l) => F.add(l, '0')); }
  if (which.includes(2)) { F.add('4'); ['1', '9'].forEach((l) => F.add(l, '4')); }
  if (which.includes(3)) { F.add('2'); ['3', '5'].forEach((l) => F.add(l, '2')); }
  return F;
}
// child → parent 的小箭頭（disjoint set 的 pointer 往上指）
function upArrows(F, labels) { return labels.map((l) => { const n = F.n(l), p = n.par; const a = n.pos.clone().add(V(0, 0.35, 0)), b = p.pos.clone().add(V(0, -0.35, 0)); return arrow(a.clone().lerp(b, 0.15), a.clone().lerp(b, 0.85), '#c08a1f'); }); }

// 64:29 用 tree 表示 set
FRAG.push(['treec-p16dsets', 'Disjoint sets：一個 set 用一棵樹表示', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.4, 0.6]);
  let tmp = [];
  await step(tok);                                   // 64:29 三個 set，每個是一堆數字
  [['S1 = {0, 6, 7, 8}', -3.8], ['S2 = {1, 4, 9}', 0], ['S3 = {2, 3, 5}', 3.8]].forEach(([t, x]) => tag(t, 'say', x, 7.8));
  say('假設有三個 set，每個 set 是一堆數字', '要怎麼在程式裡表示一個 set？');
  await step(tok);                                   // 64:48 用 linked list
  tmp = ['0', '6', '7', '8'].map((v, k) => cube(v, BLUE, SMALL, -4.6 + k * 1.1, 0.35, 2.6, 1.5));
  for (let k = 0; k < 3; k++) tmp.push(arrow(V(-4.25 + k * 1.1, 0.35, 2.6), V(-3.85 + k * 1.1, 0.35, 2.6), '#7a6a52'));
  say('可以每個 set 用一個 linked list', '可行');
  await step(tok);                                   // 64:55 用三個 array
  tmp.push(note('也可以：三個 array', 1.6, 0.4, 2.6));
  say('也可以用三個 array', '都是可行的方法');
  await step(tok);                                   // 65:06 另一種：用 tree；S1 = 0 6 7 8
  tmp.forEach(kill);
  const F1 = sets3({}, [1]).spawn([-3.8], 2);
  say('這裡介紹另一種方法：用一棵 tree 表示一個 set', 'S1 = {0, 6, 7, 8}');
  await step(tok);                                   // 65:20 root 0；6 7 8 指到 0（不一定是 binary）
  F1.lit('0', GOLD); upArrows(F1, ['6', '7', '8']);
  say('root 是 0，6、7、8 都「指到」root 0', '注意：它不一定是 binary tree（0 有 3 個小孩）');
  await step(tok);                                   // 65:27 S2 = 1 4 9，root 4
  F1.lit('0'); sets3({}, [2]).spawn([0], 2).lit('4', GOLD);
  say('S2 = {1, 4, 9}，用 4 當 root', '');
  await step(tok);                                   // 65:38 S3 = 2 3 5
  sets3({}, [3]).spawn([3.8], 2);
  say('S3 = {2, 3, 5} 也用同樣的方式', '');
  await step(tok);                                   // 65:55 disjoint：交集為空
  okT('任兩個 set 交集都是空的：disjoint', 0, 1.6);
  say('這些 set 是 disjoint 的', '任兩個 Si、Sj 的交集都是空集合');
}]);

// 66:08 union / find 與 set name
FRAG.push(['treec-p16dfind', 'Union 與 find：find(i) 往上找 root 再查 set name', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.4, 1.0]);
  const F = sets3({ topY: 5.8 }).spawn([-3.8, 0, 3.8]);
  const cur = makeCursor();
  let names = [];
  await step(tok);                                   // 66:08 union：兩個 set 合起來
  sayT('① union：兩個 set 合成更大的 set', -2.6, 7.6);
  say('常用的運算一：union', '把兩個 set 合成一個更大的 set（等等講怎麼做）');
  await step(tok);                                   // 66:24 find：給一個數字，屬於哪個 set
  sayT('② find：這個數字屬於哪個 set？', 2.6, 7.0);
  say('運算二：find', '給你一個數字，問它屬於哪一個 set');
  await step(tok);                                   // 66:40 3 屬於 S3
  F.lit('3', GOLD); okT('3 → S3', 3.8, 1.2);
  say('例：3 屬於第三個 set S3', '');
  await step(tok);                                   // 66:46 8 屬於？
  F.lit('3'); F.lit('8', GOLD); okT('8 → S1', -3.8, 1.2);
  say('那 8 呢？8 屬於 S1', '（老師口誤說 S2；S1 = {0, 6, 7, 8}）');
  await step(tok);                                   // 67:24 set name 欄位
  F.lit('8');
  names = [['S1', -3.8], ['S2', 0], ['S3', 3.8]].map(([t, x]) => cube(t, '#f2c46d', [0.9, 0.5, 0.7], x, 0.35, 2.8, 2));
  tag('set name', 'ptr', -6.0, 0.35, 2.8);
  say('每個 set 有一個名字：一個 set name 欄位', 'S1、S2、S3');
  await step(tok);                                   // 67:32 pointer 指到 root，雙向
  [['0', -3.8], ['4', 0], ['2', 3.8]].forEach(([l, x]) => { arrow(V(x, 0.7, 2.6), F.n(l).pos.clone().add(V(0, -0.4, 0.2)), '#c08a1f', true); arrow(F.n(l).pos.clone().add(V(0.25, -0.4, 0.2)), V(x + 0.25, 0.7, 2.6), '#c08a1f', true); });
  say('set name 旁邊有 pointer 指到該 set 的 root', 'root 也指回 set name：雙向連結');
  await step(tok);                                   // 68:04 find(3)：先往上找 root
  cursorTo(cur, F.n('3').pos); await wait(tok, 600); cursorTo(cur, F.n('2').pos); F.lit('2', GOLD);
  say('find(3)：找到 3，再往上走到它的 root', 'root 是 2');
  await step(tok);                                   // 68:26 root 的 pointer → set name
  lit(names[2], GOLD); cur.obj.visible = false;
  say('透過 root 的 pointer 對應到 set name', 'find(3) = S3');
}]);

// 69:00 union 的兩種接法
FRAG.push(['treec-p16dunion', 'Union S1、S2：誰接到誰底下？', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.4, 0.6]);
  const A = sets3({ topY: 6.4, sp: 0.95 }, [1, 2]).spawn([-4.6, -2.0]);
  const B = sets3({ topY: 6.4, sp: 0.95 }, [1, 2]).spawn([2.0, 4.6]);
  const cur = makeCursor(); cur.obj.scale.set(0.7, 0.7, 0.7);
  await step(tok);                                   // 69:00 union S1 和 S2
  say('union：把 S1 和 S2 合起來', '有兩種接法');
  await step(tok);                                   // 69:00 第一種：S2 變成 S1 的 child
  A.link('4', '0'); A.slide([-3.4]); A.lit('4', GOLD);
  tag('第一種：4 接到 0 底下', 'ptr', -3.4, 7.8);
  say('第一種：S2 變成 S1 的一個 child', 'S2 的 root 4 接到 S1 的 root 0 底下');
  await step(tok);                                   // 69:20 第二種：S1 變成 S2 的 child
  B.link('0', '4'); B.slide([3.4]); B.lit('0', GOLD);
  tag('第二種：0 接到 4 底下', 'ptr alt', 3.4, 7.8);
  say('第二種：S1 變成 S2 的 child', '0 接到 4 底下');
  await step(tok);                                   // 69:30 哪一種比較好？
  A.off(); B.off();
  const q = buddy('?', '', '#7cb8ee', 0, 0, 2.4, 0.7); q.mood('wow');
  say('這兩種，哪一種比較好？', '');
  await step(tok);                                   // 70:02 看之後做的 operation
  say('目前都可以；好壞要看之後做的 operation', '也就是 find 或 union');
  await step(tok);                                   // 70:33 常 find(1)、find(9)：第一種兩個 hop
  for (const l of ['1', '4', '0']) { cursorTo(cur, A.n(l).pos); A.lit(l, GOLD); await wait(tok, 450); }
  noT('find(1)：1 → 4 → 0，兩個 hop', -3.4, 1.0);
  say('如果大家常 find(1)、find(9)', '第一種要先到 4、再到 0：走兩個 hop，比較差');
  await step(tok);                                   // 71:09 第二種一個 hop
  for (const l of ['1', '4']) { cursorTo(cur, B.n(l).pos); B.lit(l, GOLD); await wait(tok, 450); }
  okT('find(1)：1 → 4，一個 hop', 3.4, 1.0); q.mood('happy');
  say('第二種只要一個 hop 就到 root 4', '馬上查到 set name');
  await step(tok);                                   // 71:19 看 find 的頻率
  cur.obj.visible = false;
  say('所以沒有絕對誰好誰壞', '要看每個元素被 find 的頻率');
}]);

// 71:35 parent array
FRAG.push(['treec-p16darr', 'Disjoint set 用 array：parent[i]', async (tok) => {
  fresh(); lab.frameCamera([0, 5.0, 13.5], [0, 3.0, 1.2]);
  const F = sets3({ topY: 6.4 }).spawn([-3.6, 0, 3.6]);
  let A;
  const PAR = [-1, 4, -1, 2, -1, 2, 0, 0, 0, 4];
  await step(tok);                                   // 71:35 可以用 array 表示
  A = PArr(PAR.map(() => null), { x0: -4.5, dx: 1.0, z: 2.8 });
  say('剛才畫成 tree 的 set，可以用 array 表示', '');
  await step(tok);                                   // 71:51 index 就是數字
  for (let i = 0; i < 10; i++) { A.hi(i, TGOLD); await wait(tok, 120); A.hi(i); }
  say('array 的 index 就是元素的數字 0～9', '');
  await step(tok);                                   // 72:00 存的欄位是 parent
  tag('parent', 'ptr', -6.0, 0.35, 2.8);
  say('array 裡存的是 parent：它的 parent 是誰', '');
  await step(tok);                                   // 72:09 9 的 parent 是 4
  F.lit('9', GOLD); F.lit('4', GREEN);
  await fling(tok, '4', F.n('4').pos.clone(), A.pos(9).clone().add(V(0, 0.6, 0)), 900);
  A.set(9, 4);
  say('例：9 的 parent 是 4', '所以 parent[9] = 4');
  await step(tok);                                   // 72:30 4 的 parent 是誰？
  F.off(); F.lit('4', GOLD);
  say('那 4 的 parent 是誰？', '4 已經是 root，沒有 parent 了');
  await step(tok);                                   // 72:36 -1 代表 root
  A.set(4, -1);
  say('root 的 parent 記成 -1', 'parent[4] = -1');
  await step(tok);                                   // 73:03 0～9 都填好
  F.off();
  for (let i = 0; i < 10; i++) if (i !== 9 && i !== 4) { A.set(i, PAR[i]); await wait(tok, 140); }
  say('index 0～9 代表數字，內容是它的 parent', '[-1, 4, -1, 2, -1, 2, 0, 0, 0, 4]');
  await step(tok);                                   // 73:17 root = -1；看起來像 tree，其實是 array
  for (const i of [0, 2, 4]) { A.hi(i, PINK); F.lit(String(i), GOLD); }
  say('三個 root（0、4、2）的 parent 都是 -1', '看起來像 tree，實作上一個 array 就夠了');
}]);

// ═══════════ 4HDjWNV09QY：Lec17（disjoint set：array、union、weighting／collapsing rule、equivalence、traversal 唯一性） ═══════════
const PAR3 = [-1, 4, -1, 2, -1, 2, 0, 0, 0, 4];
function nameTable(xs, z = 2.9) { return [['S1', xs[0]], ['S2', xs[1]], ['S3', xs[2]]].map(([t, x]) => cube(t, '#f2c46d', [0.9, 0.5, 0.7], x, 0.35, z)); }
// 一排各自獨立的數字（每個都是自己的 set）
function singles(n, o = {}) { const F = FV(Object.assign({ color: () => BLUE, sp: 0.9, step: 1.0, topY: 6.6 }, o)); for (let i = 0; i < n; i++) F.add(String(i)); return F; }
function sizeTags(F, on) { if (F._st) F._st.forEach(remove); F._st = on ? F.roots.map((r) => tag('×' + gAll(r).length, 'idx', r.pos.x + 0.6, r.pos.y + 0.55)) : []; }

// 0:39 set 的 tree 表示：find 與 union
FRAG.push(['treec-p17set', 'Set 用 tree：find 往上找 root，union 接 root', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.4, 1.0]);
  const F = sets3({ topY: 5.8 }).spawn([-3.8, 0, 3.8]);
  const cur = makeCursor(); let names;
  await step(tok);                                   // 0:39 每個 set 的 root 是其中一個 element
  for (const l of ['0', '4', '2']) F.lit(l, GOLD);
  say('三個 set，各用一棵 tree 表示', '每棵樹的 root 就是那個 set 裡的某一個 element');
  await step(tok);                                   // 0:51 operation 一：union
  F.off(); sayT('① union：兩個 set 合併', -3.0, 7.6);
  say('兩個主要 operation：第一個是 union', '把兩個 set 合起來');
  await step(tok);                                   // 0:57 operation 二：find
  sayT('② find(i)：i 屬於哪個 set？', 3.0, 7.0);
  say('第二個是 find：給你一個數字', '回答它屬於哪一個 set');
  await step(tok);                                   // 1:21 table：set name + 指向 root 的 pointer
  names = nameTable([-3.8, 0, 3.8]); tag('set name', 'ptr', -6.0, 0.35, 2.9);
  [['0', -3.8], ['4', 0], ['2', 3.8]].forEach(([l, x]) => arrow(V(x, 0.7, 2.7), F.n(l).pos.clone().add(V(0, -0.4, 0.2)), '#c08a1f', true));
  say('另外有一張 table：set name 和一個 pointer', 'pointer 是雙向的，指到那個 set 的 root');
  await step(tok);                                   // 1:34 find(7)
  const xb = buddy('find', 7, ORANGE, -6.2, 0, 0.6, 0.7);
  say('例：find(7)，7 屬於哪一個 set？', '');
  await step(tok);                                   // 1:44 找到 7 → root 0 → 反查 S1
  cursorTo(cur, F.n('7').pos); await wait(tok, 600); cursorTo(cur, F.n('0').pos); F.lit('0', GOLD); await wait(tok, 600); lit(names[0], GOLD); xb.set('S1'); xb.mood('happy');
  say('找到 7 → 看它的 root 是 0 → 反查 set name', 'find(7) = S1');
  await step(tok);                                   // 2:13 pointer 做法要對所有 set 做 matching
  cur.obj.visible = false; F.off(); lit(names[0]);
  note('用 pointer：要先在所有 set 裡找到 7 在哪', 0, 7.6);
  say('用 pointer 實作時，要先對所有 set 做 matching', '找出 7 在哪一棵樹裡');
  await step(tok);                                   // 2:21 union 的結果
  say('再看 union：例如 S1 和 S2 合併', '');
  await step(tok);                                   // 2:37 把一個 set 的 root 連到另一個 root
  F.link('4', '0'); F.slide([-2.2, 3.8]); F.lit('4', GOLD);
  say('union：把某個 set 的 root 直接連到另一個 set 的 root', 'S2 的 root 4 接到 S1 的 root 0 底下');
  await step(tok);                                   // 2:49 反過來以 4 為 root 也可以
  F.unlink('4'); F.link('0', '4'); F.slide([-2.2, 3.8]); F.off(); F.lit('0', GOLD);
  say('反過來，0 接到 4 底下、以 4 當 root', '兩種都是合法的 union 結果');
}]);

// 3:16 用 parent array 表示 set、find
FRAG.push(['treec-p17arr', 'Parent array：parent[i] 存 parent，root 是 −1', async (tok) => {
  fresh(); lab.frameCamera([0, 5.0, 13.5], [0, 3.0, 1.2]);
  const F = sets3({ topY: 6.4 }).spawn([-3.6, 0, 3.6]);
  const A = PArr(PAR3.map(() => null), { x0: -4.5, dx: 1.0, z: 2.8 });
  tag('parent', 'ptr', -6.1, 0.35, 2.8);
  const cur = makeCursor(); cur.obj.scale.set(0.7, 0.7, 0.7);
  await step(tok);                                   // 3:16 除了 pointer，也能用 array
  say('set 除了用 pointer，也可以用 array 表示', '');
  await step(tok);                                   // 3:21 0 到 9
  for (let i = 0; i < 10; i++) { A.hi(i, TGOLD); await wait(tok, 100); A.hi(i); }
  say('array 的 index 0～9 代表這些數字', '');
  await step(tok);                                   // 3:28 值代表它的 parent
  say('array 裡的值，代表它的 parent 是誰', '');
  await step(tok);                                   // 3:35 -1 代表 root
  note('-1 = root（沒有 parent）', 0, 8.0);
  say('只要看到 -1，就代表它是 root', '');
  await step(tok);                                   // 3:42 0 是 root
  F.lit('0', GOLD); A.set(0, -1);
  say('對照剛才的圖：0 是 root', 'parent[0] = -1');
  await step(tok);                                   // 3:52 6 7 8 指向 0
  F.lit('0'); for (const i of [6, 7, 8]) { F.lit(String(i), GOLD); A.set(i, 0); await wait(tok, 250); }
  say('6、7、8 都指向 0', 'parent[6] = parent[7] = parent[8] = 0');
  await step(tok);                                   // 4:10 不是 -1 就是它連到的那個 node
  F.off(); for (const i of [1, 2, 3, 4, 5, 9]) { A.set(i, PAR3[i]); await wait(tok, 150); }
  say('不是 -1 的，就是它往上連到的那個 node', '（1、2、3、4、5、9 依課本圖補上）');
  await step(tok);                                   // 4:30 兩種表示法，優缺點自己比
  sayT('node + pointer  vs  array：優缺點？', 0, 8.6);
  say('兩種表示法：node + pointer，或 array', '優缺點請自己比較，期末考可能會問');
  await step(tok);                                   // 4:58 find(7)：array[7] = 0
  A.hi(7, TGOLD); cursorTo(cur, A.pos(7).clone().setY(0.7));
  await wait(tok, 500); A.hi(0, TGOLD); cursorTo(cur, A.pos(0).clone().setY(0.7));
  say('用 array 做 find(7)：看 array[7]，是 0', '再去 0 這格看');
  await step(tok);                                   // 5:05 array[0] = -1 → 到 root
  okT('parent[0] = -1 → 0 是 root', -4.5, 1.6, 2.8);
  say('array[0] = -1，表示到達 root 了', '');
  await step(tok);                                   // 5:48 另一張 table：root → set name
  cur.obj.visible = false;
  const nm = nameTable([-3.6, 0, 3.6], 4.4); lit(nm[0], GOLD);
  say('要回答 S1、S2、S3，還需要另一張 table', '存每個 root 對應的 set name：0 → S1');
}]);

// 6:02 array 上的 union 與 find(1)
FRAG.push(['treec-p17aun', 'Array 上的 union：只改一格', async (tok) => {
  fresh(); lab.frameCamera([0, 5.0, 13.5], [0, 3.0, 1.2]);
  const F = sets3({ topY: 6.4 }).spawn([-3.6, 0, 3.6]);
  const A = PArr(PAR3, { x0: -4.5, dx: 1.0, z: 2.8 });
  tag('parent', 'ptr', -6.1, 0.35, 2.8);
  const cur = makeCursor(); cur.obj.scale.set(0.7, 0.7, 0.7);
  await step(tok);                                   // 6:02 在 array 上做 union
  say('如果在 array 上做 union，要怎麼做？', '');
  await step(tok);                                   // 6:10 union 0 和 4：4 接到 0
  F.link('4', '0'); F.slide([-2.4, 3.6]); F.lit('4', GOLD);
  say('例：union 0 和 4，讓 4 接到 0 底下', '');
  await step(tok);                                   // 6:18 只要動一個數值
  say('用 array 表示的話，只要動到一個數值', '是哪一格？');
  await step(tok);                                   // 6:32 4 那格：-1 → 0
  A.hi(4, TGOLD); A.set(4, 0);
  say('4 這格：本來是 -1（root），現在改成 0', 'parent[4] = 0');
  await step(tok);                                   // 7:01 只有被合併的 root 要改，其他不用動
  A.hi(4); for (const i of [1, 9]) A.hi(i, TGREEN);
  okT('1、9 還是指 4：不用改', 4.0, 1.6, 2.8);
  say('只有被合併那棵樹的 root 要改', '其他 element（像 1、9）都不用動');
  await step(tok);                                   // 7:22 find(1)
  A.off(); F.off();
  say('union 完之後，find(1)：1 屬於哪個 set？', '');
  await step(tok);                                   // 7:30 array[1] = 4 → array[4] = 0
  for (const i of [1, 4]) { A.hi(i, TGOLD); cursorTo(cur, A.pos(i).clone().setY(0.7)); F.lit(String(i), GOLD); await wait(tok, 600); }
  say('看 array[1] 是 4，再看 array[4] 是 0', '');
  await step(tok);                                   // 7:42 0 是 -1 → 查 table
  A.hi(0, TGOLD); cursorTo(cur, A.pos(0).clone().setY(0.7)); F.lit('0', GOLD);
  okT('array[0] = -1 → root 0 → S1', -4.0, 1.6, 2.8);
  say('array[0] = -1，到 root 了', '再去查 set name 的 table：S1');
  await step(tok);                                   // 7:59 好處：只改數值，pointer 不用指來指去
  cur.obj.visible = false;
  say('好處：只要改 array 裡的數值', '不必讓 pointer 指來指去');
  await step(tok);                                   // 8:15 缺點？自己想
  const q = buddy('缺點？', '', '#7cb8ee', 6.2, 0, 0.6, 0.7); q.mood('wow');
  say('缺點是什麼？', '老師留給同學自己想：沒有完美的表示法');
}]);

// 8:47 退化：union 成一直線，find 變 O(n²)
FRAG.push(['treec-p17line', 'union(0,1)…union(n−2,n−1)：變成一直線', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 4.0, 0]);
  const F = singles(6, { step: 1.0, topY: 7.6 }).spawn(null, 2);
  const cur = makeCursor(); cur.obj.scale.set(0.7, 0.7, 0.7);
  const lineT = tag('', 'ptr alt', 4.4, 7.2);
  await step(tok);                                   // 8:47 一開始每個數字各是一個 set
  say('0 到 n−1，一開始每個數字各自是一個 set', '（動畫用 n = 6）');
  await step(tok);                                   // 9:00 union(0,1)
  F.link('0', '1'); F.slide();
  say('union(0, 1)：0 接到 1 底下', '');
  await step(tok);                                   // 9:09 union(1,2)
  F.link('1', '2'); F.slide();
  say('union(1, 2)：1 那棵接到 2 底下', '');
  await step(tok);                                   // 9:17 union(2,3)…union(n−2,n−1)
  for (const i of [2, 3, 4]) { F.link(String(i), String(i + 1)); F.slide(); await wait(tok, 600); }
  say('union(2, 3)……一直做到 union(n−2, n−1)', '');
  await step(tok);                                   // 9:28 結果一條直線：底是 0，root 是 n−1
  F.lit('0', GOLD); F.lit('5', GREEN);
  say('結果是一條直線', '最下面是 0，最上面（root）是 n−1');
  await step(tok);                                   // 9:46 find(0)：從最底一路往上
  for (let i = 0; i <= 5; i++) { cursorTo(cur, F.n(String(i)).pos); await wait(tok, 300); }
  setTag(lineT, 'find(0)：走 n 步');
  say('再做 find(0)：要從最底部一路往上找 root', '');
  await step(tok);                                   // 10:04 find(1)…find(n−1) 越來越短
  cursorTo(cur, F.n('5').pos);
  setTag(lineT, 'find(1)：n−1 步 … find(n−1)：1 步');
  say('find(1) 也差不多長；find(n−1) 一步就到', '它自己就是 root（array 裡是 -1）');
  await step(tok);                                   // 10:26 union 共 O(n)
  cur.obj.visible = false;
  note('n−1 次 union，每次 O(1) → O(n)', -4.0, 2.4);
  say('這串 union：每次只是把兩堆串起來', 'n−1 次 → O(n)');
  await step(tok);                                   // 10:53 find 串：O(n²)
  noT('n 次 find → O(n²)', 4.0, 2.4);
  say('但這串 find 的總時間是 O(n²)', '');
  await step(tok);                                   // 11:12 Σ i（i = 2..n）
  sayT('2 + 3 + … + n = Σ i ≈ n²/2', 0, 1.4);
  say('find(0) 走 n、find(1) 走 n−1……加起來是 Σ i', '所以是 O(n²)');
  await step(tok);                                   // 11:44 find 的 cost 太高
  say('照這樣做，find 的 cost 太高了', '要想辦法讓樹不要長成一直線');
}]);

// 11:53 weighting rule
FRAG.push(['treec-p17wflat', 'Weighting rule：node 少的接到 node 多的', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.6, 0.6]);
  const cd = code(['union(i, j):', '  if (count(i) < count(j))', '       j 當 root（i 接到 j 底下）', '  else  i 當 root（j 接到 i 底下）'], -3.2, 7.6, 0.5);
  let F = null;
  await step(tok);                                   // 11:53 weighting rule
  say('為了降低 find 的成本：weighting rule', '');
  await step(tok);                                   // 11:58 union(i, j)
  cd.hl(0);
  say('要把 i、j 兩個 set union 起來', '');
  await step(tok);                                   // 12:11 i 的 node 數 < j 的 → j 當 root
  cd.hl(1); await wait(tok, 500); cd.hl(2);
  say('如果以 i 為 root 的樹 node 比較少', '就讓 j 當 root');
  await step(tok);                                   // 12:41 otherwise i；少的歸到多的
  cd.hl(3);
  say('否則讓 i 當 root', '簡單說：node 少的，歸到 node 多的那一邊');
  await step(tok);                                   // 13:06 union(0,1)：都只有一個，沒差
  cd.hl(-1);
  F = singles(6, { topY: 5.4, step: 1.1 }).spawn(null, 2); sizeTags(F, true);
  F.link('1', '0'); F.slide(); await wait(tok, 600); sizeTags(F, true);
  say('同樣的 union(0,1)：一開始大家都只有一個 node', '沒差，選 0 當 root');
  await step(tok);                                   // 13:31 union(1,2)：1 的 root 0 有 2 個
  F.lit('1', GOLD); F.lit('0', GREEN); F.lit('2', GOLD);
  say('union(1, 2)：1 的 root 是 0，那棵有 2 個 node', '2 那棵只有 1 個');
  await step(tok);                                   // 13:51 2 接到 0
  F.off(); F.link('2', '0'); F.slide(); await wait(tok, 600); sizeTags(F, true);
  say('node 少的 {2} 歸到 node 多的 → 2 接到 0', '');
  await step(tok);                                   // 14:01 union(2,3)：3 也接到 0
  F.link('3', '0'); F.slide(); await wait(tok, 600); sizeTags(F, true);
  say('union(2, 3)：2 的 root 0 那棵比較大', '3 也接到 0 底下');
  await step(tok);                                   // 14:26 打平，不會一直線
  F.link('4', '0'); F.slide(); await wait(tok, 500); F.link('5', '0'); F.slide(); await wait(tok, 500); sizeTags(F, true);
  okT('打平了：每個 find 只要 1 步', 0, 1.4);
  say('最後不會變成一直線，而是被「打平」', 'root 0 底下直接掛所有 node');
}]);

// 14:44 weighted union 的高度上界
FRAG.push(['treec-p17lemma', 'Lemma：weighted union 的樹高 ≤ ⌊log₂m⌋ + 1', async (tok) => {
  fresh(); lab.frameCamera([0, 4.6, 13.5], [0, 3.4, 0.4]);
  const L = singles(6, { topY: 7.0, step: 0.95 });
  for (let i = 0; i < 5; i++) L.link(String(i), String(i + 1));
  L.spawn([-3.8]); tag('沒有 weighting', 'ptr', -3.8, 0.6);
  const R = singles(6, { topY: 5.0, step: 1.2 });
  for (let i = 1; i < 6; i++) R.link(String(i), '0');
  R.spawn([2.8]); tag('有 weighting', 'ptr alt', 2.8, 0.6);
  await step(tok);                                   // 14:44 lemma
  say('weighting rule 有一個 lemma（定理）', '說的是樹的高度');
  await step(tok);                                   // 14:57 union 總時間還是 O(n)
  note('union：一樣 O(n)', -3.8, 8.0);
  say('用 weighting rule 做 union，union 的時間沒差', '還是要一個一個合，O(n)');
  await step(tok);                                   // 15:14 但 find 改進了
  okT('find 改進了！', 2.8, 6.6);
  say('但是 find 有改進', '');
  await step(tok);                                   // 15:30 高度 ≤ ⌊log₂m⌋ + 1
  sayT('m 個 node 的樹：高度 ≤ ⌊log₂m⌋ + 1', 0, 8.6);
  say('可以證明：m 個 node 的樹，高度不超過 ⌊log₂m⌋ + 1', '證明請自己看課本');
  await step(tok);                                   // 15:41 find 只走樹高
  const cur = makeCursor(); cur.obj.scale.set(0.7, 0.7, 0.7); cursorTo(cur, R.n('3').pos); await wait(tok, 500); cursorTo(cur, R.n('0').pos);
  say('find 只要走樹的高度', '不用走那一長串 → O(log m)');
}]);

// 15:54 最差情況：8 個 node 兩兩合併
FRAG.push(['treec-p17worst', 'Weighted union 最差情況：同樣大的兩兩合併', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.8, 0.4]);
  const F = singles(8, { topY: 7.0, step: 1.25, sp: 0.95 }).spawn(null, 2);
  await step(tok);                                   // 16:11 一開始每個都是一個 set
  say('另一種情況：一開始 0～7 每個都是一個 set', '');
  await step(tok);                                   // 16:21 union(0,1)(2,3)(4,5)(6,7)
  for (const [c, p] of [['1', '0'], ['3', '2'], ['5', '4'], ['7', '6']]) F.link(c, p);
  F.slide(); sizeTags(F, false);
  say('先兩兩 union：(0,1)、(2,3)、(4,5)、(6,7)', '');
  await step(tok);                                   // 16:43 node 數一樣，隨便選一個
  for (const l of ['0', '2', '4', '6']) F.lit(l, GOLD);
  say('兩邊 node 數一樣，隨便選一個當 root', '這裡選左邊的');
  await step(tok);                                   // 17:11 再兩兩合併
  F.off();
  say('再兩兩合併：{0,1} 和 {2,3}、{4,5} 和 {6,7}', '');
  await step(tok);                                   // 17:33 2 接到 0、6 接到 4
  F.link('2', '0'); F.link('6', '4'); F.slide();
  say('{0,1,2,3} 以 0 為 root（2 接到 0）', '{4,5,6,7} 以 4 為 root');
  await step(tok);                                   // 17:59 最後 union 0 和 4
  F.lit('0', GOLD); F.lit('4', GOLD);
  say('最後把 0 和 4 union 起來', '');
  await step(tok);                                   // 18:08 合併後的樹
  F.off(); F.link('4', '0'); F.slide();
  say('合併成一棵 8 個 node 的樹', '最深的 7：7 → 6 → 4 → 0');
  await step(tok);                                   // 18:19 worst case bound
  for (const l of ['7', '6', '4', '0']) F.lit(l, GOLD);
  sayT('高度 4 = ⌊log₂8⌋ + 1：剛好碰到上界', 0, 8.4);
  say('每次都是「一樣大的兩棵」合併，高度最高', '正好是 lemma 的 worst case bound');
}]);

// 18:29 collapsing rule：8 次 find(7)
const CTREE = [['0', null], ['1', '0'], ['2', '0'], ['3', '2'], ['4', '0'], ['5', '4'], ['6', '4'], ['7', '6']];
function ctree(o = {}) { const F = FV(Object.assign({ color: () => BLUE, topY: 6.6, step: 1.3, sp: 1.0 }, o)); CTREE.forEach(([l, p]) => F.add(l, p)); return F; }
FRAG.push(['treec-p17coll', 'Collapsing：8 次 find(7) 從 24 步降到 10 步', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.6, 0.6]);
  const F = ctree().spawn([-2.2]);
  const cur = makeCursor(); cur.obj.scale.set(0.7, 0.7, 0.7);
  const cnt = mono(tag('', 'ptr alt', 4.4, 7.2));
  await step(tok);                                   // 18:29 weighting 只看 node 數，沒考慮 operation
  say('weighting rule 只依 node 個數合併', '沒有考慮之後的 operation（find / query）');
  await step(tok);                                   // 18:42 這棵樹上做 find(7)
  F.lit('7', GOLD);
  say('例：在這棵樹上做 find(7)', '');
  await step(tok);                                   // 19:07 做了 8 次 find(7)
  const fs = [...Array(8)].map((_, k) => cube('find 7', ORANGE, [1.0, 0.36, 0.5], 4.6, 0.3 + k * 0.42, 1.2, 1.2));
  say('統計發現：大家常做 find(7)', '總共做了 8 次');
  await step(tok);                                   // 19:31 7→6→4→0：三步
  for (const l of ['7', '6', '4', '0']) { cursorTo(cur, F.n(l).pos); await wait(tok, 450); }
  setTag(cnt, '一次 = 3 步');
  say('每次 find(7)：7 → 6 → 4 → 0', '往上走 3 步，再查 table');
  await step(tok);                                   // 19:49 8 × 3
  setTag(cnt, '8 × 3');
  say('query 8 次 find(7)', '要走 8 × 3 步');
  await step(tok);                                   // 20:00 24 步
  setTag(cnt, '8 × 3 = 24 步');
  say('= 24 步', '這是不調整的 cost');
  await step(tok);                                   // 20:21 把 7 拉到 root 底下
  cur.obj.visible = false; F.off();
  F.link('7', '0'); F.link('6', '0'); F.slide([-2.2]); F.lit('7', GREEN); F.lit('6', GREEN);
  say('改法：把 7（和路上的 6）直接拉到 root 底下', '');
  await step(tok);                                   // 20:41 第一次還是 3 步
  lit(fs[0], GOLD); setTag(cnt, '第 1 次：3 步');
  say('第一次 find(7) 還是照原本的樹走 3 步', '走完順便把 7 拉上去');
  await step(tok);                                   // 21:18 之後 7 次各 1 步：3 + 7 = 10
  for (let k = 1; k < 8; k++) { lit(fs[k], GREEN); await wait(tok, 160); }
  setTag(cnt, '3 + 7 × 1 = 10 步');
  say('第 2～8 次：7 → 0 一步就到', '3 + 7 = 10 步');
  await step(tok);                                   // 21:37 cost 降了一半以上
  okT('24 → 10：降一半以上', 4.4, 6.4);
  say('從 24 步降到 10 步', 'cost 降了一半以上');
  await step(tok);                                   // 21:50 collapse
  sayT('collapsing：find 時把路上的 node 直接接到 root', 0, 8.4);
  say('這就叫 collapse（collapsing rule）', '把路徑上的 node（6、7）直接接到 root');
}]);

// 22:30 事後諸葛亮與 online 預測
FRAG.push(['treec-p17hind', '事後諸葛亮：online 時能預測 query 嗎？', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.6, 0.6]);
  const F = ctree().spawn([-2.6]);
  const me = buddy('系統', '', '#7cb8ee', 4.4, 0, 1.6, 0.8);
  let log;
  await step(tok);                                   // 22:30 依 weight 建的樹不考慮查詢
  say('依 weighting rule 建的樹', '只看 node 個數，不考慮查詢');
  await step(tok);                                   // 22:51 這棵樹沒有不好，但可以更好
  say('這棵樹本身沒有不好', '但可以更好');
  await step(tok);                                   // 23:03 依 find operation 結構性調整
  F.link('7', '0'); F.link('6', '0'); F.slide([-2.6]); F.lit('7', GREEN);
  say('可以根據使用者的 find operation', '結構性地調整這棵樹，讓 cost 變低');
  await step(tok);                                   // 23:34 事後諸葛亮
  me.mood('wow'); sayT('事後諸葛亮', 4.4, 2.8);
  say('但這有點像「事後諸葛亮」', '');
  await step(tok);                                   // 23:47 看了 query log 才知道
  log = prop('file', 6.2, 0, -0.8, 0.9, 'query log：find(7) × 8'); bob(log, 0.04);
  say('是看了 query log，才知道 find(7) 會做 8 次', '早知道就該把 7 拉上去');
  await step(tok);                                   // 24:15 online：第一次 find(7) 出現
  me.mood('calm'); pkt('find(7) ← 第 1 次', 4.4, 3.6);
  say('online（即時）的時候：第一次 find(7) 進來', '');
  await step(tok);                                   // 24:33 能保證後面還有 7 次嗎？
  noT('後面還會有 7 次嗎？不知道！', 2.4, 1.2, 2.4); me.mood('sad');
  say('你怎麼保證後面還會有 7 次？', '也許做完就沒了');
  await step(tok);                                   // 25:07 難處：要 predict
  me.mood('wow');
  say('難的地方：要在 online 時 predict（預測）未來的 query', '');
  await step(tok);                                   // 25:55 統計過去一個月的 log
  me.mood('happy');
  say('例如統計過去一個月的 log', '看 find(7) 出現後，通常還會跟著幾次');
}]);

// 26:28 依 query 機率建 cost 最小的樹（延伸）
FRAG.push(['treec-p17qf', '延伸：依 query 機率讓常查的 node 靠近 root', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.2, 0.6]);
  await step(tok);                                   // 26:32 有一個 probability，不見得 100%
  sayT('find(7) 後面跟 7 次：機率 p（不一定 100%）', 0, 7.6);
  say('「find(7) 之後常跟著 7 次」有一個 probability', '不見得是 100%');
  await step(tok);                                   // 27:02 每個數字都有自己的統計
  const nums = ['1', '2', '3', '4', '5'].map((v, k) => cube(v, BLUE, NODE, -4.0 + k * 2.0, 0.4, 2.4, 1.5));
  say('每一個數字都有自己的 find 統計資料', '');
  await step(tok);                                   // 27:39 造出 cost 最小的 tree
  say('問題變成：給每個數字和它的 query 頻率', '造出一棵 cost 最小的 tree（期末考可能出）');
  await step(tok);                                   // 28:14 30 天：1 佔 90%、2 佔 5%
  const ps = [0.9, 0.05, 0.03, 0.01, 0.01];
  for (let k = 0; k < 5; k++) { const b = bar(k ? GRAYC : ORANGE, 0.7, 0.7, -4.0 + k * 2.0, 0.4); await growBar(tok, b, 0.4 + ps[k] * 4, 300); tag(Math.round(ps[k] * 100) + '%', 'idx', -4.0 + k * 2.0, 0.9 + ps[k] * 4, 0.4); }
  say('例：觀察 30 天，1 佔了 90% 的 query', '2 大約 5%……');
  await step(tok);                                   // 28:35 input 與 output
  nums.forEach((b, k) => lab.springTo(b, k ? V(-2.0 + (k - 1) * 1.3, 4.6, 0) : V(0, 6.2, 0)));
  okT('常被查的放 root 附近 → 期望 cost 最小', 3.8, 6.8);
  say('input：數字集合 + 各自被查的機率', 'output：期望 cost 最小的 tree');
  await step(tok);                                   // 29:06 例子：看電影
  const tw = prop('monitor', -5.2, 0, -1.4, 0.8, '台大的 node：熱門電影'); bob(tw, 0.03);
  say('很像網路看電影', '熱門電影常常被看 = 常常被 query');
  await step(tok);                                   // 29:39 多複製幾份到使用者旁邊
  const cp = prop('monitor', 5.0, 0, -1.4, 0.8, '交大的 node：複製一份');
  await fling(tok, '複製電影', V(-4.4, 1.6, -1.4), V(4.4, 1.6, -1.4), 1200);
  say('把熱門電影多複製幾份', '放到看的人旁邊');
  await step(tok);                                   // 29:54 本來三個 hop，現在一個 hop
  note('本來：跑去台大 3 個 hop → 現在：1 個 hop', 0, 2.6, -1.4);
  say('交大的人常看，就在交大放一個 node', '不用跑三個 hop 去台大拿');
  await step(tok);                                   // 30:25 P2P 本質一樣
  sayT('P2P 複製熱門內容 ≈ 把常查的 node 拉近 root', 0, 8.3);
  say('P2P 複製熱門內容、調整 tree 結構', '問題的本質很像');
}]);

// 30:55 union-find 求 equivalence class
const EQP = [['0', '4'], ['3', '1'], ['6', '10'], ['8', '9'], ['7', '4'], ['6', '8'], ['3', '5'], ['2', '11'], ['11', '0']];
function eqUnion(F, a, b) { const ra = F.root(a), rb = F.root(b); if (ra === rb) return; const sa = gAll(ra).length, sb = gAll(rb).length; if (sb > sa) F.link(ra.label, rb.label); else F.link(rb.label, ra.label); }
FRAG.push(['treec-p17eq', 'Equivalence class：每對 i ≡ j 做一次 union', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.6, 0.6]);
  const F = singles(12, { topY: 6.0, step: 1.25, sp: 0.75, gap: 0.2 });
  const pairs = EQP.map(([a, b], k) => tag(a + '≡' + b, 'idx', -5.6 + k * 1.4, 7.8));
  pairs.forEach((p) => p.visible = false);
  const done = (k) => { pairs[k].element.className = 'lab-label good'; };
  const U = (k) => { eqUnion(F, EQP[k][0], EQP[k][1]); done(k); };
  await step(tok);                                   // 31:05 set operation 可以求 equivalence class
  say('set operation 可以拿來求 equivalence class', '等價類：彼此有關係的分成一組');
  await step(tok);                                   // 31:13 i ≡ j → 同一個 set → union
  sayT('i ≡ j → i、j 在同一個 set → union(i, j)', 0, 8.6);
  say('i ≡ j 就代表 i、j 屬於同一個 set', '把它們 union 起來');
  await step(tok);                                   // 31:24 給定 pair
  pairs.forEach((p) => p.visible = true);
  say('給定這些 pair：0≡4、3≡1、6≡10、8≡9……', '');
  await step(tok);                                   // 31:56 每個數字先各自一個 set
  F.spawn(null, 2);
  say('做法：每個數字先各自當一個 set', '0～11 共 12 個');
  await step(tok);                                   // 32:33 0≡4：union
  U(0); F.slide();
  say('0 和 4 有關係 → union', '');
  await step(tok);                                   // 32:46 1≡3 union（6≡10、8≡9 也一樣）
  U(1); F.slide(); await wait(tok, 600); U(2); U(3); F.slide();
  say('1 和 3 有關係 → union', '6≡10、8≡9 也一樣');
  await step(tok);                                   // 32:54 7≡4：先找 4 的 root
  F.lit('4', GOLD); F.lit('0', GREEN); await wait(tok, 700); U(4); F.slide(); F.off();
  say('7≡4：要先找到 4 屬於哪個 set（root 是 0）', '再 union：7 接進來');
  await step(tok);                                   // 33:03 6≡8
  U(5); F.slide();
  say('6 和 8 有關係 → 兩個 set union 起來', '');
  await step(tok);                                   // 33:18 3≡5
  U(6); F.slide();
  say('3 和 5 有關係 → union', '');
  await step(tok);                                   // 33:27 不斷 union，直到 pair 處理完
  U(7); F.slide(); await wait(tok, 600); U(8); F.slide();
  say('不斷 union，直到所有 pair 都處理完', '2≡11、11≡0');
  await step(tok);                                   // 33:36 剩下的 set 就是答案
  F.roots.forEach((r, k) => gAll(r).forEach((n) => lit(n.body, [GOLD, GREEN, '#3a1a4a'][k % 3])));
  okT('{0,2,4,7,11}　{1,3,5}　{6,8,9,10}', 0, 1.0);
  say('最後剩下的每個 set，就是一個 equivalence class', '共三個');
}]);

// 34:05 array 實作的方便與兩種解法比較
FRAG.push(['treec-p17eqarr', 'Array 查 root 很快；兩種解法比一比', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.4, 0.8]);
  const par = [-1, 3, -1, -1, 0, -1, -1, -1, -1, -1, -1, -1];
  const A = PArr(par, { x0: -5.5, dx: 0.95, z: 2.4 });
  tag('parent', 'ptr', -6.6, 0.35, 3.3);
  const cur = makeCursor(); cur.obj.scale.set(0.6, 0.6, 0.6);
  await step(tok);                                   // 34:05 7≡4：要先知道 4 的 root；array 方便
  pkt('7 ≡ 4：4 的 root 是誰？', 0, 2.2, 2.4);
  say('實作時，像 7≡4 要先知道 4 的 root', '用 array 會很方便');
  await step(tok);                                   // 34:14 查表：parent[4] = 0 → -1
  A.hi(4, TGOLD); cursorTo(cur, A.pos(4).clone().setY(0.6)); await wait(tok, 600); A.hi(0, TGOLD); cursorTo(cur, A.pos(0).clone().setY(0.6));
  await wait(tok, 500); A.set(7, 0);
  say('查表：parent[4] = 0、parent[0] = -1', 'root 是 0 → 再把 parent[7] 設成 0');
  await step(tok);                                   // 34:28 比 linked list 查詢快
  cur.obj.visible = false; A.off();
  say('比之前用 linked list 一個個找要快', '');
  await step(tok);                                   // 34:51 同樣問題，不同解法
  tag('第 4 章：linked list + stack', 'ptr', -3.2, 7.2); tag('今天：union-find', 'ptr alt', 3.2, 7.2);
  say('同樣的問題（給 pair，輸出 equivalence class）', '有不同解法，要會比較優缺點與 complexity');
  await step(tok);                                   // 35:24 第 4 章：phase 1 建 linked list
  for (let k = 0; k < 4; k++) cube('', BLUE, SMALL, -4.6 + k * 0.9, 5.8, 0, 1.5);
  note('phase 1：每個數字一條 linked list', -3.2, 6.6);
  say('第 4 章的解法要兩個 phase', 'phase 1：每個數字建一條 linked list');
  await step(tok);                                   // 35:39 phase 2：stack 找 transitive
  for (let k = 0; k < 3; k++) cube('', PURPLE, SMALL, -3.2, 3.6 + k * 0.55, 0, 1.5);
  note('phase 2：用 stack 找出遞移關係', -3.2, 3.0);
  say('phase 2：用 stack 把 transitive（遞移）的關係找出來', '1≡2、2≡3 ⇒ 1≡3');
  await step(tok);                                   // 36:00 union-find：掃 pair 做 union，複雜度低
  okT('掃過每個 pair 做 union 就好', 3.2, 6.0);
  say('union-find 只要掃過所有 pair 做 union', '複雜度很低（課本：近乎線性）');
}]);

// 36:23 set 的表示為什麼仍是 tree
FRAG.push(['treec-p17dir', 'Set 的 pointer 往上指，還是 tree', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.4, 0.6]);
  const F = sets3({ topY: 5.8 }, [1]).spawn([-3.0]);
  const A = PArr([-1, null, null, null, null, null, 0, 0, 0, null], { x0: -4.5, dx: 1.0, z: 2.8 });
  let ups, downs = [];
  await step(tok);                                   // 36:23 今天用 array：root 與 parent 很好表示
  say('set operation 今天用 array 表示', '因為 root 和 parent 的關係很容易表示');
  await step(tok);                                   // 36:38 另一種：tree node
  ups = upArrows(F, ['6', '7', '8']);
  say('另一種表示法是用 tree node', '你會想：這跟 tree 有什麼關係？');
  await step(tok);                                   // 36:50 也有 root，只是 pointer 方向往上
  F.lit('0', GOLD);
  say('它也有 root，只是 pointer 的方向不一樣', '一般的 tree 往下指，這裡是 child 往上指 parent');
  await step(tok);                                   // 37:07 pointer 改成往下也可以
  ups.forEach(kill);
  downs = ['6', '7', '8'].map((l) => { const a = F.n('0').pos.clone().add(V(0, -0.35, 0)), b = F.n(l).pos.clone().add(V(0, 0.35, 0)); return arrow(a.clone().lerp(b, 0.15), a.clone().lerp(b, 0.85), GREEN); });
  say('讓 pointer 往下（root 指向 set 裡的 element）', '基本上也可以');
  await step(tok);                                   // 37:34 方向顛倒，仍是 tree
  okT('箭頭方向顛倒，還是 tree', 3.0, 5.6);
  say('箭頭方向顛倒也做得到', '所以它仍然屬於 tree 的範疇');
}]);

// 37:42 只給 inorder：binary tree 不唯一
FRAG.push(['treec-p17inord', '只給 inorder BCAEDGHFI：樹不唯一', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.6, 0.6]);
  const seq = 'BCAEDGHFI'.split('');
  const row = seq.map((c, k) => cube(c, GRAYC, SMALL, -3.2 + k * 0.8, 0.35, 2.6));
  let T1, T2;
  await step(tok);                                   // 37:42 回顧 traversal
  say('回顧三種 traversal', 'preorder、inorder、postorder');
  await step(tok);                                   // 37:58 給 inorder：BCAEDGHFI
  row.forEach((b) => lit(b, GOLD)); await wait(tok, 500); row.forEach((b) => lit(b));
  say('只給你 inorder 的順序：B C A E D G H F I', '');
  await step(tok);                                   // 38:13 對應的 binary tree 唯一嗎？
  say('它對應的 binary tree 是唯一的嗎？', '當然不是，來試試看');
  await step(tok);                                   // 38:28 選 A 當 root
  lit(row[2], GOLD);
  say('可以在 inorder 裡挑 A 當 root', '');
  await step(tok);                                   // 38:35 BC 在左、其他在右
  row.slice(0, 2).forEach((b) => lit(b, '#10304a')); row.slice(3).forEach((b) => lit(b, '#3a1a00'));
  say('inorder 是「左、根、右」', 'A 左邊的 B、C 是 left subtree，右邊其他的是 right subtree');
  await step(tok);                                   // 38:53 長出來
  T1 = showTree('A(B(,C),D(E,F(G(,H),I)))', { cx: -3.2, width: 5.0, topY: 7.0, minY: 3.0 });
  tag('A 當 root', 'ptr', -3.2, 7.8);
  say('照 inorder 繼續往下長，得到一棵樹', '');
  await step(tok);                                   // 39:11 也可以選 D
  row.forEach((b) => lit(b)); lit(row[4], GOLD);
  say('但也可以改挑 D 當 root', '');
  await step(tok);                                   // 39:33 左 BCAE、右 GHFI
  T2 = showTree('D(A(B(,C),E),F(G(,H),I))', { cx: 3.4, width: 5.0, topY: 7.0, minY: 3.0 });
  tag('D 當 root', 'ptr alt', 3.4, 7.8);
  say('左邊 B C A E 構成 left subtree', '右邊 G H F I 構成 right subtree');
  await step(tok);                                   // 39:47 不唯一
  noT('兩棵的 inorder 都是 BCAEDGHFI → 不唯一', 0, 1.5);
  say('兩棵不同的樹，inorder 一模一樣', '所以只給 inorder，binary tree 不唯一');
}]);

// 40:05 inorder + preorder 才唯一；distinct binary trees
FRAG.push(['treec-p17dist', 'Inorder + preorder 才唯一；3 個 node 的 distinct trees', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.4, 0.6]);
  await step(tok);                                   // 40:05 inorder 再加 preorder
  sayT('inorder + preorder → 唯一', 0, 7.6);
  say('要讓 binary tree 唯一', '除了 inorder，還要再加上 preorder');
  await step(tok);                                   // 40:24 課本習題：自己證明
  const pen = prop('note', -5.6, 0, 1.6, 1.4); note('習題：證明它', -5.6, 0.8, 1.6);
  say('這是課本的習題', '要自己證明');
  await step(tok);                                   // 40:44 搭配起來才唯一
  note('preorder 第一個 = root；在 inorder 找到 root → 分左右', 0, 6.9);
  say('inorder + preorder 建出的樹才唯一', 'preorder 告訴你誰是 root，inorder 告訴你左右怎麼分');
  await step(tok);                                   // 40:59 distinct binary tree：1 2 3
  say('什麼是 distinct binary tree？', '形狀不一樣，就算不同的 binary tree');
  await step(tok);                                   // 41:07 這幾棵都不一樣
  const ts = ['1(2(3,),)', '1(2(,3),)', '1(2,3)', '1(,2(3,))', '1(,2(,3))'];
  const ino = ['3 2 1', '2 3 1', '2 1 3', '1 3 2', '1 2 3'];
  ts.forEach((s, k) => { showTree(s, { cx: -5.0 + k * 2.5, width: 1.6, topY: 5.6, minY: 2.6, maxSp: 0.8 }); tag('in: ' + ino[k], 'idx', -5.0 + k * 2.5, 1.7); });
  say('用 1、2、3 三個 node（preorder 都是 1 2 3）', '可以畫出 5 棵不同的 binary tree');
  await step(tok);                                   // 41:26 提示：preorder 與 inorder 的關係
  okT('preorder 一樣，inorder 都不一樣', 0, 1.0);
  say('提示：preorder 都是 1 2 3，但 inorder 各不相同', '用這個關係判斷是不是 distinct');
  await step(tok);                                   // 41:34 P109 習題
  say('課本 P109 的習題', '回去自己證明');
}]);

// 42:52 Tree 章節結語
FRAG.push(['treec-p17sum', 'Tree 章節重點', async (tok) => {
  fresh(); lab.frameCamera([0, 4.8, 13.5], [0, 3.2, 0.6]);
  const t = buddy('Tree 章', '✓', LEAFC, -5.8, 0, 1.8, 0.8);
  await step(tok);                                   // 42:52 heap 也是一種 tree
  sayT('heap 也是一種 tree', -2.6, 7.2);
  say('Tree 這章結束：heap 也是一種 tree', '各種 tree 的特質都要知道');
  await step(tok);                                   // 43:07 heap 與 BST 的特質
  tag('heap：root 最大／最小', 'ptr', -2.6, 6.4); tag('BST：左 < root < 右', 'ptr alt', 2.6, 6.4);
  say('重點一：heap 和 binary search tree', '它們的特質是什麼');
  await step(tok);                                   // 43:20 insert、delete
  note('會考 insert、delete', 0, 5.6);
  say('針對 heap 和 BST，會考 insert、delete', '');
  await step(tok);                                   // 43:58 traversal
  sayT('重點二：traversal（pre／in／post／level）', 0, 4.4);
  say('第二個重點：tree 的 traversal 方式', '');
  await step(tok);                                   // 44:25 應用：copy 一棵樹
  tag('copy 一棵 tree', 'idx', -3.0, 3.4);
  say('traversal 的應用：copy 一棵 tree、判斷兩棵是否相等', '');
  await step(tok);                                   // 44:30 expression evaluation
  tag('expression evaluation（postorder 求值）', 'idx', 2.4, 3.4);
  say('還有 expression evaluation', '例如用 postorder 算運算式');
  await step(tok);                                   // 44:39 兩個重點
  t.mood('happy'); await t.hop(tok);
  say('兩個重點：各種 tree 的 insert／delete', '和 traversal 與它的應用');
}]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
    sceneOrder: ['trav-rules', 'trav-flags', 'tree-terms', 'preorder', 'inorder', 'postorder', 'level-order', 'complete-vs-full', 'array-rep', 'rebuild', ...Object.keys(LECT)].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); epoch++; },
  };
}
