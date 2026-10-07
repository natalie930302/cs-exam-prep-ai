// 演算法 第8章：最大流與二分圖匹配（flow network、residual network、Ford-Fulkerson / Edmonds-Karp、
// max-flow min-cut、bipartite matching）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
//
// 本章三支影片目前都還沒有逐字稿，所以場景全部依課本（CLRS 第 26 章，第 3 版）製作：
//  • 圖 26.1：s, v1…v4, t，容量 16、13、4、12、9、14、7、20、4；圖 26.1(b) 的流量 |f| = 19。
//  • 圖 26.4：沿 s → v2 → v3 → t 推 4（用到反向的殘餘邊，抵銷 v3 → v2 的 4），|f| 變 23。
//  • 圖 26.7：容量 10⁶ 的四條邊 + 中間容量 1 的邊，亂選路徑要 2×10⁶ 次，Edmonds-Karp 只要 2 次。
//  • 二分圖匹配：課本做法（加 s、t，容量都是 1）；例子是自訂的 4 × 4 圖。
export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  let timer = null, epoch = 0;
  const C = { white: '#f4efe4', edge: '#a8987c', hot: '#e8b02a', flow: '#2f7fd0', sat: '#d64545', back: '#9b7ef4', dim: '#ddd2bd', ok: '#2fc092', q: '#efe3c8', S: '#bfe8d6', T: '#f3d2c8' };
  const fB = (x) => (x >= 1000 ? (x === 1e6 ? '10⁶' : '10⁶' + (x > 1e6 ? '+' : '−') + Math.abs(x - 1e6)) : String(x));

  // ───────────────────────── 網路 ─────────────────────────
  const NETS = {
    clrs: { title: '課本 CLRS 圖 26.1', names: ['s', 'v1', 'v2', 'v3', 'v4', 't'], s: 0, t: 5,
      pos: [[-5.4, 0], [-1.8, -2.4], [-1.8, 2.4], [1.8, -2.4], [1.8, 2.4], [5.4, 0]],
      edges: [[0, 1, 16], [0, 2, 13], [2, 1, 4], [1, 3, 12], [3, 2, 9], [2, 4, 14], [4, 3, 7], [3, 5, 20], [4, 5, 4]] },
    bad: { title: '課本 CLRS 圖 26.7（壞情況）', names: ['s', 'u', 'v', 't'], s: 0, t: 3,
      pos: [[-4.6, 0], [0, -2.6], [0, 2.6], [4.6, 0]], edges: [[0, 1, 1e6], [0, 2, 1e6], [1, 2, 1], [1, 3, 1e6], [2, 3, 1e6]] },
    bip: { title: '二分圖匹配（自訂 4 × 4）', names: ['s', 'A', 'B', 'C', 'D', '1', '2', '3', '4', 't'], s: 0, t: 9,
      pos: [[-5.6, 0], [-2.4, -2.7], [-2.4, -0.9], [-2.4, 0.9], [-2.4, 2.7], [2.4, -2.7], [2.4, -0.9], [2.4, 0.9], [2.4, 2.7], [5.6, 0]],
      edges: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1], [1, 5, 1], [1, 6, 1], [2, 5, 1], [3, 6, 1], [3, 7, 1], [4, 7, 1], [4, 8, 1], [5, 9, 1], [6, 9, 1], [7, 9, 1], [8, 9, 1]] },
  };
  const CLRS_F19 = [11, 8, 1, 12, 4, 11, 7, 15, 4];

  // ───────────────────────── 共用小工具 ─────────────────────────
  async function wait(tok, ms) {
    const e = epoch;
    if (tok !== undefined) await beat(tok, ms); else await sleep(ms);
    if (e !== epoch) throw new Error('mode changed');
  }
  function fresh(cam = [0, 12.5, 8], look = [0, 0, -0.3]) {
    epoch++; clearTimeout(timer); run.gen = null; run.done = false;
    lab.clear(); controls(''); lab.frameCamera(cam, look);
  }
  function tag(text, cls, x, y, z) { const l = lab.label(text, cls || ''); l.position.set(x, y, z); lab.world.add(l); return l; }
  const txt = (l, t) => { l.element.textContent = t; };
  function selectHtml(id, pairs, val) { return '<select id="' + id + '">' + pairs.map(([v, t]) => '<option value="' + v + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>'; }

  // ───────────────────────── 畫圖 ─────────────────────────
  const NR = 0.42;
  let GR = null;
  const nm = (i) => GR.G.names[i];
  function buildNodes(G, o = {}) {
    const gr = { G, n: G.names.length, nodes: [], edges: [], directed: true, ns: 1 };
    GR = gr;
    G.names.forEach((name, i) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(NR, NR, 0.5, 28), new THREE.MeshStandardMaterial({ color: i === G.s || i === G.t ? '#e6d7b8' : C.white, roughness: 0.5 }));
      mesh.castShadow = true;
      mesh.add(lab.label(name, 'val'));
      const top = lab.label('', 'ptr'); top.position.set(0, 0.95, 0); top.element.style.display = 'none'; mesh.add(top);
      const home = V(G.pos[i][0], 0.25, G.pos[i][1]);
      mesh.position.copy(home);
      if (!o.noDrop) mesh.position.y = 4 + Math.random();
      const b = lab.addBody(mesh);
      if (!o.noDrop) lab.dropTo(b, home);
      gr.nodes.push({ mesh, b, top, home });
    });
    return gr;
  }
  function addEdge(u, v, text, bend, color, thick) {
    const e = { u, v, bend: bend || 0, color: color || C.edge, thick: thick || 1, group: null, lbl: text ? tag(text, '', 0, 0.4, 0) : null };
    GR.edges.push(e);
    drawEdge(e);
    return e;
  }
  function drawEdge(e) {
    if (e.group) { lab.world.remove(e.group); e.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: e.color, roughness: 0.6 });
    const r = 0.045 * e.thick;
    const a = GR.nodes[e.u].mesh.position, b = GR.nodes[e.v].mesh.position;
    const A = V(a.x, 0.3, a.z), B = V(b.x, 0.3, b.z);
    const len = Math.max(0.01, A.distanceTo(B));
    const dir = B.clone().sub(A).normalize(), perp = V(-dir.z, 0, dir.x);
    const ctrl = A.clone().add(B).multiplyScalar(0.5).addScaledVector(perp, e.bend * len);
    const curve = new THREE.QuadraticBezierCurve3(A, ctrl, B);
    const t0 = Math.min(0.45, (NR + 0.04) / len), t1 = 1 - Math.min(0.45, (NR + 0.3) / len);
    const pts = [];
    for (let k = 0; k <= 16; k++) pts.push(curve.getPoint(t0 + (t1 - t0) * k / 16));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 6, false), mat));
    const tan = curve.getTangent(t1).normalize();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.13 + r, 0.32, 14), mat);
    cone.position.copy(curve.getPoint(t1)).addScaledVector(tan, 0.15);
    cone.quaternion.setFromUnitVectors(V(0, 1, 0), tan);
    g.add(cone);
    e.group = g; e.mat = mat;
    lab.world.add(g);
    if (e.lbl) e.lbl.position.copy(curve.getPoint(0.5).addScaledVector(perp, e.bend >= 0 ? 0.34 : -0.34).setY(0.42));
  }
  function clearEdges() {
    GR.edges.forEach((e) => { if (e.group) lab.world.remove(e.group); if (e.lbl) { lab.world.remove(e.lbl); e.lbl.element.remove(); } });
    GR.edges = [];
  }
  function nodeColor(i, color, lift = 0) { const nd = GR.nodes[i]; nd.mesh.material.color.set(color); lab.springTo(nd.b, nd.home.clone().add(V(0, lift, 0))); }
  function nodeTag(i, text, cls) { const t = GR.nodes[i].top; t.element.style.display = text ? '' : 'none'; t.element.textContent = text || ''; t.element.className = 'lab-label ' + (cls || 'ptr'); }

  // ───────────────────────── 流量狀態 ─────────────────────────
  const NG = { G: null, F: [], val: 0, view: 'flow' };
  function buildNet(key, o = {}) {
    NG.G = NETS[key]; NG.F = NG.G.edges.map(() => 0); NG.val = 0;
    buildNodes(NG.G, o);
    renderFlow();
  }
  const capOf = (i) => NG.G.edges[i][2];
  const flowVal = () => NG.G.edges.reduce((s, [u, v], i) => s + (u === NG.G.s ? NG.F[i] : 0) - (v === NG.G.s ? NG.F[i] : 0), 0);
  function renderFlow(hl) {
    clearEdges();
    NG.view = 'flow';
    NG.G.edges.forEach(([u, v, c], i) => {
      const f = NG.F[i];
      const col = hl && hl.has(i) ? C.hot : f === c ? C.sat : f > 0 ? C.flow : C.edge;
      addEdge(u, v, fB(f) + '/' + fB(c), 0, col, f > 0 ? 1 + 1.4 * f / c : 1);
    });
  }
  function residualEdges() {
    const R = [];
    NG.G.edges.forEach(([u, v, c], i) => {
      if (c - NG.F[i] > 0) R.push({ u, v, cap: c - NG.F[i], i, dir: 1 });
      if (NG.F[i] > 0) R.push({ u: v, v: u, cap: NG.F[i], i, dir: -1 });
    });
    return R;
  }
  function renderResidual(path) {
    clearEdges();
    NG.view = 'res';
    const R = residualEdges();
    const on = new Set(path || []);
    R.forEach((r) => {
      const both = R.some((q) => q.u === r.v && q.v === r.u);
      const hot = [...on].some((p) => p.i === r.i && p.dir === r.dir);
      addEdge(r.u, r.v, fB(r.cap), both ? 0.14 : 0, hot ? C.hot : r.dir > 0 ? C.edge : C.back, hot ? 2.2 : 1);
    });
    return R;
  }
  function findPath(choice) {
    const R = residualEdges(), n = GR.n, s = NG.G.s, t = NG.G.t;
    const adj = [...Array(n)].map(() => []);
    R.forEach((r) => adj[r.u].push(r));
    adj.forEach((l) => l.sort((a, b) => a.v - b.v));
    if (choice === 'bfs') {
      const pe = Array(n).fill(null), seen = Array(n).fill(false); seen[s] = true;
      const Q = [s];
      while (Q.length) { const u = Q.shift(); for (const r of adj[u]) if (!seen[r.v]) { seen[r.v] = true; pe[r.v] = r; Q.push(r.v); } }
      if (!seen[t]) return null;
      const p = []; for (let v = t; v !== s; v = pe[v].u) p.unshift(pe[v]);
      return p;
    }
    const all = [];
    const seen = Array(n).fill(false);
    const dfs = (u, acc) => {
      if (u === t) { all.push([...acc]); return choice === 'dfs'; }
      seen[u] = true;
      for (const r of adj[u]) if (!seen[r.v]) { acc.push(r); if (dfs(r.v, acc) && choice === 'dfs') return true; acc.pop(); }
      seen[u] = false;
      return false;
    };
    dfs(s, []);
    if (!all.length) return null;
    if (choice === 'dfs') return all[0];
    // 'worst'：瓶頸最小的路徑（同樣小就挑比較長的）——示範亂選路徑有多慢
    const bott = (p) => Math.min(...p.map((r) => r.cap));
    all.sort((a, b) => bott(a) - bott(b) || b.length - a.length);
    return all[0];
  }
  function augment(p) {
    const cf = Math.min(...p.map((r) => r.cap));
    p.forEach((r) => { NG.F[r.i] += r.dir * cf; });
    NG.val = flowVal();
    return cf;
  }
  const pathStr = (p) => [nm(p[0].u), ...p.map((r) => nm(r.v))].join(' → ');
  function reachS() {
    const R = residualEdges(), seen = new Set([NG.G.s]), st = [NG.G.s];
    while (st.length) { const u = st.pop(); R.forEach((r) => { if (r.u === u && !seen.has(r.v)) { seen.add(r.v); st.push(r.v); } }); }
    return seen;
  }

  // ───────────────────────── 步進框架 ─────────────────────────
  const run = { gen: null, done: false };
  function show(st) {
    if (!st) return;
    if (st.cap) { say(st.cap, st.f || ''); log(st.cap + (st.f ? '（' + String(st.f).replace(/<[^>]+>/g, '') + '）' : ''), !!st.warn); }
    if (st.state) setState(...st.state);
  }
  function step() {
    if (!run.gen || run.done) return false;
    const r = run.gen.next();
    if (r.done) { run.done = true; return false; }
    show(r.value);
    return r.value;
  }
  function autoPlay() {
    clearTimeout(timer);
    const e = epoch;
    const tick = () => { if (e !== epoch) return; const st = step(); if (st) timer = setTimeout(tick, Math.max(350, (st.ms || 1000) * 0.85)); };
    tick();
  }
  async function playGen(tok, speed = 1) { for (;;) { const st = step(); if (!st) break; await wait(tok, (st.ms || 1000) * speed); } }
  function stepControls(extra, reset) {
    controls((extra || '') + '<button class="primary" id="gStep">下一步</button><button id="gAuto">自動播放</button><button id="gReset">重來</button>');
    on('gStep', () => { clearTimeout(timer); if (!step()) log('已經結束了，按「重來」再跑一次。', true); });
    on('gAuto', autoPlay);
    on('gReset', () => { clearLog(); reset(); });
  }
  const fState = (title, extra) => [title, [['|f|', fB(NG.val)], ...NG.G.edges.map(([u, v, c], i) => [nm(u) + '→' + nm(v), fB(NG.F[i]) + ' / ' + fB(c)])], extra || ''];

  // ───────────────────────── Ford-Fulkerson ─────────────────────────
  const RULE = { bfs: 'Edmonds-Karp（BFS 最短路徑）', dfs: 'DFS 找到哪條用哪條', worst: '故意挑瓶頸最小的' };
  function* ffGen(choice, o = {}) {
    const k = o.k || 1, maxIt = o.maxIt || 50;
    let it = 0;
    yield { cap: '一開始 f = 0：每條邊流量 0', f: '規則：' + RULE[choice], ms: 1800 * k, state: fState('Ford-Fulkerson', RULE[choice]) };
    for (;;) {
      const p = findPath(choice);
      renderResidual(p);
      if (!p) {
        yield { cap: '殘餘網路裡 s 走不到 t：沒有 augmenting path', f: '最大流 |f| = ' + fB(NG.val), ms: 2200 * k, state: fState('Ford-Fulkerson', '<span class="ok">完成</span>') };
        break;
      }
      it++;
      const cf = Math.min(...p.map((r) => r.cap));
      yield { cap: '第 ' + it + ' 條 augmenting path：' + pathStr(p), f: 'c_f(p) = min(' + p.map((r) => fB(r.cap)).join(', ') + ') = ' + fB(cf) + (p.some((r) => r.dir < 0) ? '（紫色 = 反向邊，會抵銷原本的流）' : ''), ms: 2000 * k, state: fState('Ford-Fulkerson', RULE[choice]) };
      augment(p);
      renderFlow(new Set(p.map((r) => r.i)));
      yield { cap: '沿路徑推 ' + fB(cf) + ' 單位 → |f| = ' + fB(NG.val), f: p.some((r) => r.dir < 0) ? '反向邊：把原本那條邊的流量減少' : '', ms: 1600 * k, state: fState('Ford-Fulkerson', RULE[choice]) };
      renderFlow();
      if (it >= maxIt) { yield { cap: '照這樣下去還要很多次……', f: o.moreF || '', ms: 2600, warn: true, state: fState('Ford-Fulkerson', RULE[choice]) }; return; }
    }
    if (o.cut !== false) {
      const S = reachS();
      for (let v = 0; v < GR.n; v++) nodeColor(v, S.has(v) ? C.S : C.T, 0);
      renderFlow();
      const cutE = NG.G.edges.map((e, i) => i).filter((i) => S.has(NG.G.edges[i][0]) && !S.has(NG.G.edges[i][1]));
      cutE.forEach((i) => { const e = GR.edges[i]; e.color = C.sat; e.thick = 2.6; drawEdge(e); });
      const cap = cutE.reduce((s, i) => s + capOf(i), 0);
      yield { cap: 'S = 殘餘網路中 s 走得到的 {' + [...S].sort((a, b) => a - b).map(nm).join(', ') + '}', f: 'cut (S, T) 的容量 = ' + cutE.map((i) => fB(capOf(i))).join(' + ') + ' = ' + fB(cap) + ' = |f|', ms: 3200, state: fState('Max-flow min-cut', '<span class="ok">max flow = min cut = ' + fB(cap) + '</span>') };
    }
  }

  // ───────────────────────── 互動模式 ─────────────────────────
  const M = { ffKey: 'clrs', ffRule: 'bfs' };
  function enterFF() {
    fresh();
    buildNet(M.ffKey);
    run.gen = ffGen(M.ffRule, { maxIt: M.ffKey === 'bad' && M.ffRule === 'worst' ? 6 : 50, moreF: '每次只推 1：共要 2 × 10⁶ 次' }); run.done = false;
    stepControls(selectHtml('fG', [['clrs', 'CLRS 26.1'], ['bad', 'CLRS 26.7 壞情況'], ['bip', '二分圖匹配']], M.ffKey)
      + selectHtml('fR', [['bfs', 'Edmonds-Karp（BFS）'], ['dfs', 'DFS'], ['worst', '故意挑最小瓶頸']], M.ffRule), enterFF);
    $('fG').onchange = (e) => { M.ffKey = e.target.value; clearLog(); enterFF(); };
    $('fR').onchange = (e) => { M.ffRule = e.target.value; clearLog(); enterFF(); };
    log('Ford-Fulkerson：在殘餘網路找 s 到 t 的路徑，沿它推瓶頸那麼多的流，直到找不到為止。');
    log('標籤 f/c：流量 / 容量；紅色 = 飽和（f = c）；殘餘網路裡紫色 = 反向邊（可以退回的流量）。');
    setState('Ford-Fulkerson', [['網路', NG.G.title], ['規則', RULE[M.ffRule]]], '按「下一步」開始');
  }
  // 自己找 augmenting path
  function enterManual() {
    fresh();
    buildNet('clrs');
    renderResidual();
    controls('<label>路徑 <input id="mP" type="text" value="s v1 v3 t" style="width:150px"></label><button class="primary" id="mPush">沿這條推流</button><button id="mView">切換：殘餘網路／流量</button><button id="mCut">找最小割</button><button id="mReset">重來</button>');
    on('mPush', manualPush);
    on('mView', () => { if (NG.view === 'res') renderFlow(); else renderResidual(); log(NG.view === 'res' ? '現在看的是殘餘網路 G_f：數字是還能推多少。' : '現在看的是流量：f / c。'); });
    on('mCut', () => {
      const S = reachS();
      if (S.has(NG.G.t)) { log('殘餘網路裡 s 還走得到 t：還有 augmenting path，現在的流不是最大流，割不會相等。', true); return; }
      for (let v = 0; v < GR.n; v++) nodeColor(v, S.has(v) ? C.S : C.T, 0);
      const cut = NG.G.edges.reduce((sum, [u, v, c]) => sum + (S.has(u) && !S.has(v) ? c : 0), 0);
      log('S = {' + [...S].map(nm).join(', ') + '}：cut 容量 = ' + cut + ' = |f| = ' + NG.val + '。最大流 = 最小割。');
    });
    on('mReset', () => { clearLog(); enterManual(); });
    log('在殘餘網路上自己找 s 到 t 的路徑，用空白隔開頂點名稱（例如 s v2 v4 t），按「沿這條推流」。');
    log('可以走紫色的反向邊：代表把原本的流退回去。');
    setState(...fState('自己找 augmenting path', '找不到路徑時就是最大流（答案 23）'));
  }
  function manualPush() {
    const names = String($('mP').value || '').trim().split(/[\s,→>-]+/).filter(Boolean);
    const idx = names.map((x) => NG.G.names.indexOf(x));
    if (idx.some((i) => i < 0)) { log('看不懂的頂點：' + names.filter((x, k) => idx[k] < 0).join('、') + '。可用的名稱：' + NG.G.names.join(' '), true); return; }
    if (idx[0] !== NG.G.s || idx[idx.length - 1] !== NG.G.t) { log('augmenting path 要從 s 出發、到 t 結束。', true); return; }
    if (new Set(idx).size !== idx.length) { log('路徑不能重複經過同一個頂點（要是 simple path）。', true); return; }
    const R = residualEdges(), p = [];
    for (let k = 0; k + 1 < idx.length; k++) {
      const cand = R.filter((r) => r.u === idx[k] && r.v === idx[k + 1]).sort((a, b) => b.cap - a.cap);
      if (!cand.length) { log(names[k] + ' → ' + names[k + 1] + ' 在殘餘網路裡沒有邊（原本沒有這條邊，或已經飽和、也沒有可退回的流）。', true); return; }
      p.push(cand[0]);
    }
    const cf = augment(p);
    renderFlow(new Set(p.map((r) => r.i)));
    log('沿 ' + pathStr(p) + ' 推 ' + cf + ' 單位' + (p.some((r) => r.dir < 0) ? '（用到反向邊：抵銷了原本的流）' : '') + ' → |f| = ' + NG.val);
    setState(...fState('自己找 augmenting path', NG.val === 23 ? '<span class="ok">23 = 最大流</span>' : '最大流是 23，繼續找'));
    if (!findPath('bfs')) log('殘餘網路裡已經找不到 s 到 t 的路徑：這就是最大流。', false);
  }
  // 最小割
  const CUT = { S: new Set([0]) };
  function enterCut() {
    fresh();
    buildNet('clrs');
    CUT.S = new Set([0]);
    controls(selectHtml('cV', NG.G.names.map((x, i) => [i, x]).slice(1, -1), 1) + '<button class="primary" id="cT">加入／移出 S</button><button id="cBest">顯示最小割</button><button id="cReset">重來</button>');
    on('cT', () => {
      const v = Number($('cV').value);
      if (v === NG.G.s || v === NG.G.t) { log('s 一定在 S、t 一定在 T，不能移動。', true); return; }
      if (CUT.S.has(v)) CUT.S.delete(v); else CUT.S.add(v);
      cutUpdate();
    });
    on('cBest', () => { CUT.S = new Set([0, 1, 2, 4]); cutUpdate(); log('最小割 S = {s, v1, v2, v4}：12 + 7 + 4 = 23 = 最大流。'); });
    on('cReset', () => { clearLog(); enterCut(); });
    log('cut (S, T)：s ∈ S、t ∈ T。容量只算 S → T 的邊；T → S 的邊不算。');
    log('任何流 |f| ≤ 任何 cut 的容量；最大流 = 最小割（Max-flow min-cut theorem）。');
    cutUpdate();
  }
  function cutUpdate() {
    for (let v = 0; v < GR.n; v++) nodeColor(v, CUT.S.has(v) ? C.S : C.T, CUT.S.has(v) ? 0.25 : 0);
    clearEdges();
    let cap = 0;
    const fw = [], bw = [];
    NG.G.edges.forEach(([u, v, c]) => {
      const st = CUT.S.has(u) && !CUT.S.has(v), ts = !CUT.S.has(u) && CUT.S.has(v);
      if (st) { cap += c; fw.push(nm(u) + '→' + nm(v) + ' ' + c); }
      if (ts) bw.push(nm(u) + '→' + nm(v));
      addEdge(u, v, String(c), 0, st ? C.sat : ts ? C.back : C.edge, st ? 2.4 : 1);
    });
    say('cut 容量 = ' + cap, cap === 23 ? '<span class="ok">這就是最小割 = 最大流 23</span>' : '最小割是 23');
    setState('最小割', [['S', '{' + [...CUT.S].sort((a, b) => a - b).map(nm).join(', ') + '}'], ['S → T（算）', fw.join('、') || '—'], ['T → S（不算）', bw.join('、') || '—'], ['容量', String(cap)]], '紅 = S → T 的邊；紫 = T → S 的邊');
  }
  // 二分圖匹配（隨機）
  const BM = { E: [] };
  function randBip() {
    const E = [];
    for (let l = 0; l < 4; l++) { const deg = 1 + Math.floor(Math.random() * 2); const rs = [0, 1, 2, 3].sort(() => Math.random() - 0.5).slice(0, deg); rs.forEach((r) => E.push([l, r])); }
    return E;
  }
  function enterMatch(keep) {
    fresh();
    if (!keep || !BM.E.length) BM.E = randBip();
    NETS.rand = { title: '隨機二分圖', names: ['s', 'A', 'B', 'C', 'D', '1', '2', '3', '4', 't'], s: 0, t: 9, pos: NETS.bip.pos,
      edges: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1], ...BM.E.map(([l, r]) => [1 + l, 5 + r, 1]), [5, 9, 1], [6, 9, 1], [7, 9, 1], [8, 9, 1]] };
    buildNet('rand');
    run.gen = (function* () {
      yield* ffGen('bfs', { cut: false });
      const M2 = NG.G.edges.map((e, i) => i).filter((i) => NG.G.edges[i][0] >= 1 && NG.G.edges[i][0] <= 4 && NG.F[i] === 1);
      yield { cap: '最大匹配 = ' + M2.length + '：' + M2.map((i) => nm(NG.G.edges[i][0]) + '–' + nm(NG.G.edges[i][1])).join('、'), f: '中間有流量 1 的邊就是配對（整數流 → 每點最多配一次）', ms: 3000, state: fState('二分圖匹配', '|M| = |f| = ' + M2.length) };
    })();
    run.done = false;
    stepControls('<button id="bNew">換一張圖</button>', () => enterMatch(true));
    on('bNew', () => { clearLog(); enterMatch(false); });
    log('二分圖匹配 → 最大流：加 s 連到左邊、右邊連到 t，所有容量都是 1。');
    setState('二分圖匹配', [['左', 'A B C D'], ['右', '1 2 3 4'], ['邊', BM.E.map(([l, r]) => 'ABCD'[l] + '–' + (r + 1)).join(' ')]], '按「下一步」開始');
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  let qs = { score: 0, total: 0 };
  const rnd = (n) => Math.floor(Math.random() * n);
  function maxflow(n, E, s, t) {
    const F = E.map(() => 0);
    let val = 0;
    for (;;) {
      const pe = Array(n).fill(null), seen = Array(n).fill(false); seen[s] = true; const Q = [s];
      while (Q.length) { const u = Q.shift(); E.forEach(([a, b, c], i) => { if (a === u && !seen[b] && c - F[i] > 0) { seen[b] = true; pe[b] = [i, 1]; Q.push(b); } if (b === u && !seen[a] && F[i] > 0) { seen[a] = true; pe[a] = [i, -1]; Q.push(a); } }); }
      if (!seen[t]) break;
      let cf = Infinity;
      for (let v = t; v !== s;) { const [i, d] = pe[v]; cf = Math.min(cf, d > 0 ? E[i][2] - F[i] : F[i]); v = d > 0 ? E[i][0] : E[i][1]; }
      for (let v = t; v !== s;) { const [i, d] = pe[v]; F[i] += d * cf; v = d > 0 ? E[i][0] : E[i][1]; }
      val += cf;
    }
    return { val, F };
  }
  function genQ() {
    const t = rnd(5);
    const N = ['s', 'a', 'b', 't'];
    if (t === 0) {
      const E = [[0, 1, 2 + rnd(8)], [0, 2, 2 + rnd(8)], [1, 2, 1 + rnd(5)], [1, 3, 2 + rnd(8)], [2, 3, 2 + rnd(8)]];
      const { val } = maxflow(4, E, 0, 3);
      const opts = [...new Set([val, val + 1, val - 1, E[0][2] + E[1][2], E[3][2] + E[4][2]])].filter((x) => x > 0).slice(0, 4).map(String);
      if (!opts.includes(String(val))) opts[0] = String(val);
      return { q: '網路：' + E.map(([u, v, c]) => N[u] + '→' + N[v] + '(' + c + ')').join('、') + '\n最大流是多少？', opts, ans: String(val), why: '最大流 = 最小割；兩個明顯的割：s 的出邊 ' + (E[0][2] + E[1][2]) + '、t 的入邊 ' + (E[3][2] + E[4][2]) + '，還要考慮經過 a→b 的割。答案 ' + val + '。' };
    }
    if (t === 1) {
      const c = 5 + rnd(10), f = 1 + rnd(c - 1);
      return { q: '邊 (u, v) 容量 ' + c + '、目前流量 ' + f + '。殘餘網路中 u→v 與 v→u 的殘餘容量分別是？', opts: [(c - f) + ' 和 ' + f, f + ' 和 ' + (c - f), c + ' 和 0', (c - f) + ' 和 0'], ans: (c - f) + ' 和 ' + f, why: '順向還能再推 c − f = ' + (c - f) + '；反向可以把已推的 ' + f + ' 退回。' };
    }
    if (t === 2) {
      const L = 3 + rnd(2), E = [];
      for (let l = 0; l < L; l++) { const rs = [0, 1, 2, 3].sort(() => Math.random() - 0.5).slice(0, 1 + rnd(2)); rs.forEach((r) => E.push([l, r])); }
      const n = L + 6, s = 0, tt = n - 1;
      const net = [...[...Array(L).keys()].map((l) => [s, 1 + l, 1]), ...E.map(([l, r]) => [1 + l, 1 + L + r, 1]), ...[0, 1, 2, 3].map((r) => [1 + L + r, tt, 1])];
      const { val } = maxflow(n, net, s, tt);
      const opts = [...new Set([val, val + 1, Math.max(1, val - 1), L, E.length])].slice(0, 4).map(String);
      if (!opts.includes(String(val))) opts[0] = String(val);
      return { q: '二分圖：' + E.map(([l, r]) => 'ABCD'[l] + '–' + (r + 1)).join('、') + '\n最大匹配有幾對？', opts, ans: String(val), why: '轉成容量 1 的流網路求最大流 = ' + val + '；注意可能要用 augmenting path 改配。' };
    }
    const bank = [
      { q: 'Edmonds-Karp 的時間複雜度？', a: 'O(VE²)', d: ['O(E·|f*|)', 'O(V²E)', 'O(VE)'] },
      { q: '整數容量時，一般 Ford-Fulkerson 的時間上界？', a: 'O(E·|f*|)，|f*| 是最大流值', d: ['O(VE²)', 'O(V³)', 'O(E log V)'] },
      { q: 'Max-flow min-cut theorem 的三個等價敘述不包括？', a: '每條邊都飽和', d: ['f 是最大流', '殘餘網路沒有 augmenting path', '存在某個 cut 使 |f| = c(S, T)'] },
      { q: 'cut (S, T) 的容量怎麼算？', a: '只加 S → T 的邊容量', d: ['S → T 減 T → S', 'S → T 加 T → S', '只加 S → T 邊上的流量'] },
      { q: '殘餘網路中的反向邊代表？', a: '可以把原本推過去的流退回來', d: ['原圖中的反向邊', '容量為負的邊', '飽和的邊'] },
      { q: '用最大流解二分圖匹配，容量設多少？', a: '所有邊容量都是 1', d: ['左右之間的邊容量 ∞', '依度數決定', 's 的出邊容量 |R|'] },
      { q: '跑完 Ford-Fulkerson 後，最小割的 S 怎麼找？', a: '殘餘網路中從 s 走得到的頂點', d: ['流量 > 0 的邊的起點', 'BFS 第一層', '所有飽和邊的起點'] },
      { q: '流守恆（flow conservation）是指？', a: '除了 s、t，每個頂點流入 = 流出', d: ['每條邊 f ≤ c', 's 的流出 = t 的流入，其他沒限制', '每條邊 f = c'] },
    ];
    const b = bank[rnd(bank.length)];
    return { q: b.q, opts: [b.a, ...b.d], ans: b.a, why: '答案：' + b.a + '。' };
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

  // ───────────────────────── 課本場景（CLRS 第 26 章） ─────────────────────────
  async function scNetwork(tok) {
    fresh();
    buildNet('clrs');
    say('Flow network：有向圖，每條邊有容量 c(u, v)', '源點 s、匯點 t（課本 Lucky Puck 例子）');
    await wait(tok, 3200);
    NG.F = [...CLRS_F19]; NG.val = flowVal();
    renderFlow();
    say('一個流 f：每條邊標 f / c', '|f| = 從 s 流出的總量 = 11 + 8 = 19');
    await wait(tok, 3200);
    say('容量限制：0 ≤ f(u, v) ≤ c(u, v)', '紅色 = 飽和（f = c）');
    await wait(tok, 2800);
    const cons = [[1, '進 11 + 1 = 出 12'], [2, '進 8 + 4 = 出 1 + 11'], [3, '進 12 + 7 = 出 4 + 15'], [4, '進 11 = 出 7 + 4']];
    for (const [v, s2] of cons) {
      nodeColor(v, C.hot, 0.5); nodeTag(v, s2);
      say('流守恆：' + nm(v) + ' 流進 = 流出', s2);
      await wait(tok, 1800);
      nodeColor(v, C.white, 0);
    }
    say('除了 s 和 t，每個頂點流入 = 流出', '最大流問題：讓 |f| 最大');
    await wait(tok, 3000);
  }
  async function scResidual(tok) {
    fresh();
    buildNet('clrs');
    NG.F = [...CLRS_F19]; NG.val = flowVal(); renderFlow();
    say('從 |f| = 19 的流出發', '殘餘網路 G_f：還能怎麼改這個流？');
    await wait(tok, 2800);
    const ex = [[0, 's→v1：16 − 11 = 5 還能推；反向 11 可以退回'], [3, 'v1→v3：12 − 12 = 0 飽和；只剩反向 12'], [2, 'v2→v1：4 − 1 = 3；反向 1']];
    for (const [i, cap] of ex) {
      renderFlow(new Set([i]));
      say(cap, 'c_f(u, v) = c − f，c_f(v, u) = f');
      await wait(tok, 2600);
    }
    renderResidual();
    say('殘餘網路：灰 = 還能推的、紫 = 可以退回的', '邊數最多 2|E|');
    await wait(tok, 3400);
  }
  async function scAugmentCancel(tok) {
    fresh();
    buildNet('clrs');
    NG.F = [...CLRS_F19]; NG.val = flowVal();
    const R = renderResidual();
    say('在殘餘網路找 s 到 t 的路徑：augmenting path', '');
    await wait(tok, 2400);
    const p = [R.find((r) => r.i === 1 && r.dir > 0), R.find((r) => r.i === 4 && r.dir < 0), R.find((r) => r.i === 7 && r.dir > 0)];
    renderResidual(p);
    say('s → v2 → v3 → t：v2 → v3 是反向邊！', 'c_f(p) = min(5, 4, 5) = 4');
    await wait(tok, 3400);
    augment(p);
    renderFlow(new Set([1, 4, 7]));
    say('推 4：v3 → v2 原本的 4 被抵銷成 0', '|f| = 19 + 4 = 23');
    await wait(tok, 3400);
    renderResidual();
    const S = reachS();
    for (let v = 0; v < GR.n; v++) nodeColor(v, S.has(v) ? C.S : C.T, 0);
    say('現在殘餘網路裡 s 到不了 t', '沒有 augmenting path → 23 就是最大流');
    await wait(tok, 3200);
  }
  async function scFF(tok) {
    fresh();
    buildNet('clrs');
    say('Ford-Fulkerson：從 f = 0 開始', '一直找 augmenting path、推瓶頸，直到找不到');
    await wait(tok, 3000);
    run.gen = ffGen('bfs', { k: 0.8 });
    await playGen(tok);
  }
  async function scBadCase(tok) {
    fresh();
    buildNet('bad');
    say('四條容量 10⁶ 的邊，中間一條容量 1', '如果每次都挑經過中間那條的路徑……');
    await wait(tok, 3000);
    run.gen = ffGen('worst', { k: 0.55, maxIt: 4, moreF: '每次只推 1：共要 2 × 10⁶ 次（時間 O(E·|f*|)）' });
    await playGen(tok);
    fresh();
    buildNet('bad', { noDrop: true });
    say('Edmonds-Karp：每次用 BFS 找「邊數最少」的路徑', '');
    await wait(tok, 2200);
    run.gen = ffGen('bfs', { k: 0.6, cut: false });
    await playGen(tok);
    say('只要 2 次！Edmonds-Karp 保證 O(VE²)', '和容量大小無關');
    await wait(tok, 3200);
  }
  async function scMinCut(tok) {
    fresh();
    buildNet('clrs');
    say('Cut (S, T)：把頂點分兩邊，s ∈ S、t ∈ T', '容量 c(S, T) 只算 S → T 的邊');
    await wait(tok, 3000);
    const tries = [[[0], '只有 s：16 + 13 = 29'], [[0, 1, 2], 'S = {s, v1, v2}：12 + 14 = 26'], [[0, 1, 2, 4], 'S = {s, v1, v2, v4}：12 + 7 + 4 = 23']];
    for (const [S, cap] of tries) {
      CUT.S = new Set(S);
      cutUpdate();
      say(cap, S.length === 3 ? 'v3 → v2 是 T → S，不算' : S.length === 4 ? '<span class="ok">最小割 = 23</span>' : '');
      await wait(tok, 3200);
    }
    say('任何流 ≤ 任何割：|f| ≤ c(S, T)', '所以 |f| = 23 時它一定是最大流');
    await wait(tok, 3200);
  }
  async function scTheorem(tok) {
    fresh();
    buildNet('clrs');
    NG.F = [...CLRS_F19]; augment([{ i: 1, dir: 1, cap: 5 }, { i: 4, dir: -1, cap: 4 }, { i: 7, dir: 1, cap: 5 }].map((r) => ({ ...r, cap: 4 })));
    renderFlow();
    const items = ['① f 是最大流', '② 殘餘網路沒有 augmenting path', '③ 存在 cut 使 |f| = c(S, T)'];
    items.forEach((s2, i) => tag(s2, 'ptr', -3.6 + i * 3.6, 0.3, 4.1));
    say('Max-flow min-cut theorem：三件事等價', '');
    await wait(tok, 3000);
    say('①⇒②：有 augmenting path 就能再推，矛盾', '');
    renderResidual();
    await wait(tok, 3200);
    const S = reachS();
    for (let v = 0; v < GR.n; v++) nodeColor(v, S.has(v) ? C.S : C.T, 0);
    say('②⇒③：S = 從 s 走得到的點', 'S → T 的邊都飽和、T → S 的邊流量 0 → |f| = c(S, T)');
    await wait(tok, 3800);
    renderFlow();
    say('③⇒①：|f| ≤ 任何割，已經碰到上界', '最大流 = 最小割 = 23');
    await wait(tok, 3400);
  }
  async function scMatching(tok) {
    fresh();
    buildNodes(NETS.bip);
    NG.G = NETS.bip; NG.F = NG.G.edges.map(() => 0); NG.val = 0;
    NG.G.edges.forEach(([u, v], i) => { if (u >= 1 && u <= 4 && v >= 5 && v <= 8) addEdge(u, v, '', 0); });
    say('二分圖匹配：左右配對，每個點最多配一次', '左 A～D、右 1～4（例子自訂）');
    await wait(tok, 3000);
    renderFlow();
    say('加 s 連到左邊、右邊連到 t，容量全部 1', '最大匹配 = 這個網路的最大流');
    await wait(tok, 3000);
    run.gen = ffGen('bfs', { k: 0.75, cut: false });
    await playGen(tok);
    say('A–2、B–1、C–3、D–4：完美匹配', '最後一條路徑走反向邊，把舊配對改掉');
    await wait(tok, 3400);
  }
  async function scSuperSource(tok) {
    fresh();
    const G = { title: '多個源點與匯點', names: ['s1', 's2', 'a', 'b', 't1', 't2', 'S', 'T'], s: 6, t: 7,
      pos: [[-3.4, -2.2], [-3.4, 2.2], [-0.4, -1.4], [-0.4, 1.4], [2.8, -2.2], [2.8, 2.2], [-5.8, 0], [5.6, 0]],
      edges: [[0, 2, 8], [1, 3, 6], [2, 3, 3], [2, 4, 5], [3, 5, 9], [3, 4, 2]] };
    NETS.multi = G;
    NG.G = G; NG.F = G.edges.map(() => 0); NG.val = 0;
    buildNodes(G);
    GR.nodes[6].mesh.visible = false; GR.nodes[7].mesh.visible = false;
    renderFlow();
    say('有好幾個工廠 s1、s2 和倉庫 t1、t2？', '課本作法：加 supersource 與 supersink');
    await wait(tok, 3200);
    GR.nodes[6].mesh.visible = true; GR.nodes[7].mesh.visible = true;
    G.edges.push([6, 0, 1e6], [6, 1, 1e6], [4, 7, 1e6], [5, 7, 1e6]);
    NG.F = G.edges.map(() => 0);
    renderFlow();
    say('S → 每個 sᵢ、每個 tⱼ → T，容量 ∞', '變回單一源點、單一匯點的最大流');
    await wait(tok, 3400);
    run.gen = ffGen('bfs', { k: 0.55, cut: false });
    await playGen(tok);
    G.edges.splice(6);
  }

  const scenes = {
    'flow-network': { title: '課本：flow network、容量限制與流守恆', play: scNetwork },
    'residual-graph': { title: '課本：殘餘網路 c_f = c − f 與反向邊', play: scResidual },
    'augment-cancel': { title: '課本：augmenting path 用反向邊抵銷流（19 → 23）', play: scAugmentCancel },
    'ford-fulkerson': { title: '課本：Ford-Fulkerson（Edmonds-Karp）從 0 推到 23', play: scFF },
    'ff-bad-case': { title: '課本：亂選路徑要 2×10⁶ 次，Edmonds-Karp 只要 2 次', play: scBadCase },
    'min-cut': { title: '課本：cut 的容量與最小割', play: scMinCut },
    'maxflow-mincut': { title: '課本：Max-flow min-cut theorem', play: scTheorem },
    'bipartite-matching': { title: '課本：二分圖匹配 = 容量 1 的最大流', play: scMatching },
    'super-source': { title: '課本：多源多匯 → supersource / supersink', play: scSuperSource },
  };

  return {
    kicker: '演算法・第 8 章',
    title: '最大流與二分圖匹配',
    color: 'var(--alg)',
    modes: [
      { id: 'ff', name: 'Ford-Fulkerson', enter: enterFF },
      { id: 'manual', name: '自己找增廣路徑', enter: enterManual },
      { id: 'cut', name: '最小割', enter: enterCut },
      { id: 'match', name: '二分圖匹配', enter: () => enterMatch(false) },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['flow-network', 'residual-graph', 'augment-cancel', 'ford-fulkerson', 'ff-bad-case', 'min-cut', 'maxflow-mincut', 'super-source', 'bipartite-matching'],
    stop() { clearTimeout(timer); epoch++; },
  };
}
