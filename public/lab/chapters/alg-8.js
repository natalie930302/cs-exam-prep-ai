// 演算法 第8章：最大流與二分圖匹配（flow network、residual network、Ford-Fulkerson / Edmonds-Karp、
// max-flow min-cut、bipartite matching）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
//
// 本章三支影片目前都還沒有逐字稿，所以場景全部依課本（CLRS 第 26 章，第 3 版）製作：
//  • 圖 26.1：s, v1…v4, t，容量 16、13、4、12、9、14、7、20、4；圖 26.1(b) 的流量 |f| = 19。
//  • 圖 26.4：沿 s → v2 → v3 → t 推 4（用到反向的殘餘邊，抵銷 v3 → v2 的 4），|f| 變 23。
//  • 圖 26.7：容量 10⁶ 的四條邊 + 中間容量 1 的邊，亂選路徑要 2×10⁶ 次，Edmonds-Karp 只要 2 次。
//  • 二分圖匹配：課本做法（加 s、t，容量都是 1）；例子是自訂的 4 × 4 圖。
import kit from './_kit.js';

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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ flow.js ═══
  {
const { V3, cube, kill, move, glow, arrow, ghostBox, MONO } = K;
// ─── Iwc3Uj4aaF4（Ford-Fulkerson 英文短片）、lY1SKWSR3pk（江蕙如 Lec20）、NOYNTuhXDGU（江蕙如 Lec21） ───
// 這個片段直接用本模組的畫圖工具（buildNet / renderFlow / renderResidual / augment …）。
// 影片裡的網路：
//  • ffv：英文短片 A（source）… F（sink），只畫影片口述到的邊：A→C 11、C→D 9、D→F 11、C→B 10、B→E 9、E→F 2。
//  • lsm：Lec20 水管小例子 s→a 2、s→b 1、a→b 3、a→t 1、b→t 2（最大流 3，要用 undo flow）。
//  • kt ：Lec20/21 的課堂例子 s→a 10、s→b 10、a→b 2、a→c 4、a→d 8、b→d 9、d→c 6、c→t 10、d→t 10（最大流 19）。
//  • b100：Lec21 的壞例子，四條 100、中間一條 1（亂選要 200 輪）。
//  • bip5：二分圖匹配示意（5 × 5，最大 4 對；影片原圖看不到，自訂）。
NETS.ffv = { title: '影片例子 A → F', names: ['A', 'B', 'C', 'D', 'E', 'F'], s: 0, t: 5,
  pos: [[-5.4, 0], [-1.8, -2.4], [-1.8, 2.4], [1.8, 2.4], [1.8, -2.4], [5.4, 0]],
  edges: [[0, 2, 11], [2, 3, 9], [3, 5, 11], [2, 1, 10], [1, 4, 9], [4, 5, 2]] };
NETS.lsm = { title: '水管小例子', names: ['s', 'a', 'b', 't'], s: 0, t: 3,
  pos: [[-4.6, 0], [0, -2.6], [0, 2.6], [4.6, 0]], edges: [[0, 1, 2], [0, 2, 1], [1, 2, 3], [1, 3, 1], [2, 3, 2]] };
NETS.lsmh = { title: '小數 capacity', names: ['s', 'a', 'b', 't'], s: 0, t: 3,
  pos: NETS.lsm.pos, edges: [[0, 1, 1], [0, 2, 0.5], [1, 2, 1.5], [1, 3, 0.5], [2, 3, 1]] };
NETS.kt = { title: '課堂例子', names: ['s', 'a', 'b', 'c', 'd', 't'], s: 0, t: 5,
  pos: [[-5.4, 0], [-1.8, -2.4], [-1.8, 2.4], [1.8, -2.4], [1.8, 2.4], [5.4, 0]],
  edges: [[0, 1, 10], [0, 2, 10], [1, 2, 2], [1, 3, 4], [1, 4, 8], [2, 4, 9], [4, 3, 6], [3, 5, 10], [4, 5, 10]] };
NETS.b100 = { title: '壞例子', names: ['s', 'u', 'v', 't'], s: 0, t: 3,
  pos: [[-4.6, 0], [0, -2.6], [0, 2.6], [4.6, 0]], edges: [[0, 1, 100], [0, 2, 100], [1, 2, 1], [1, 3, 100], [2, 3, 100]] };
NETS.cons = { title: 'conservation', names: ['p', 'u', 'v', 'w', 'q'], s: 0, t: 4,
  pos: [[-4.2, -2.2], [-4.2, 2.2], [0, 0], [4.2, -2.2], [4.2, 2.2]], edges: [[0, 2, 5], [1, 2, 4], [2, 3, 6], [2, 4, 3]] };
{
  const L = ['1', '2', '3', '4', '5'], R = ["1'", "2'", "3'", "4'", "5'"];
  NETS.bip5 = { title: '二分圖（示意）', names: ['s', ...L, ...R, 't'], s: 0, t: 11,
    pos: [[-6, 0], ...L.map((_, i) => [-2.4, -3.2 + 1.6 * i]), ...R.map((_, i) => [2.4, -3.2 + 1.6 * i]), [6, 0]],
    edges: [...L.map((_, i) => [0, 1 + i, 1]),
      [1, 6, 1], [1, 7, 1], [2, 7, 1], [3, 8, 1], [3, 9, 1], [4, 8, 1], [5, 9, 1],
      ...R.map((_, i) => [6 + i, 11, 1])] };
}
const KT14 = [8, 6, 0, 0, 8, 6, 6, 6, 8], KT17 = [8, 9, 0, 3, 5, 9, 6, 9, 8], KT19 = [10, 9, 0, 3, 7, 9, 6, 9, 10];
const M3 = new Set([6, 8, 11]), M4 = new Set([5, 7, 8, 11]);

// 只顯示 capacity（或自訂標籤）的流網路
function flView(lab, hl, skip) {
  clearEdges(); NG.view = 'flow';
  NG.G.edges.forEach(([u, v, c], i) => {
    if (skip && skip.has(i)) return;
    const h = hl && hl.has(i);
    addEdge(u, v, lab ? lab(i, c, NG.F[i]) : String(c), 0, h ? C.hot : C.edge, h ? 2.2 : 1);
  });
}
function flPaint(i, color, thick) { const e = GR.edges[i]; if (!e) return; e.color = color; e.thick = thick || 2.2; drawEdge(e); }
function flSet(F) { NG.F = [...F]; NG.val = flowVal(); }
function flPath(names) {
  const idx = names.map((n) => NG.G.names.indexOf(n)), R = residualEdges(), p = [];
  for (let k = 0; k + 1 < idx.length; k++) {
    const c = R.filter((r) => r.u === idx[k] && r.v === idx[k + 1]).sort((a, b) => b.cap - a.cap);
    p.push(c[0]);
  }
  return p;
}
function flCut(S, o = {}) {
  for (let v = 0; v < GR.n; v++) nodeColor(v, S.has(v) ? C.S : C.T, S.has(v) ? 0.2 : 0);
  clearEdges();
  let cap = 0;
  NG.G.edges.forEach(([u, v, c], i) => {
    const st = S.has(u) && !S.has(v), ts = !S.has(u) && S.has(v);
    if (st) cap += c;
    addEdge(u, v, o.flow ? fB(NG.F[i]) + '/' + fB(c) : String(c), 0, st ? C.sat : ts ? C.back : C.edge, st ? 2.4 : ts ? 1.8 : 1);
  });
  return cap;
}
function flUncolor() { for (let v = 0; v < GR.n; v++) nodeColor(v, v === NG.G.s || v === NG.G.t ? '#e6d7b8' : C.white, 0); }
function flVal(text) { return tag(text, 'ptr alt', 0, 0.3, 4.3); }
// 一小滴水沿著路徑移動
async function flDrop(tok, names, color) {
  const idx = names.map((n) => NG.G.names.indexOf(n));
  const p0 = NG.G.pos[idx[0]];
  const d = cube(null, color || C.flow, [0.32, 0.32, 0.32], p0[0], 0.95, p0[1]);
  for (let k = 1; k < idx.length; k++) { const p = NG.G.pos[idx[k]]; move(d, p[0], 0.95, p[1]); await beat(tok, 650); }
  kill(d);
}
// 地面上的程式／公式面板（一行一個標籤，沿 z 排）
function flCode(lines, x, z0, dz = 0.62) {
  const w = Math.max(...lines.map((s) => s.length));
  const ls = lines.map((s, i) => { const l = tag(s.padEnd(w, ' '), '', x, 0.3, z0 + i * dz); Object.assign(l.element.style, MONO); return l; });
  return { ls, hl(i) { ls.forEach((l, k) => { l.element.className = 'lab-label' + (k === i ? ' ptr alt' : ''); }); } };
}
// 地面上的線段（x, z 平面）
function flSeg(x1, z1, x2, z2, color) {
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(x1, 0.25, z1), V3(x2, 0.25, z2)]), new THREE.LineBasicMaterial({ color: color || '#8a7b60' }));
  lab.world.add(l); return l;
}
function flLit(l, on) { l.element.className = 'lab-label ' + (on ? 'ptr alt' : 'ptr'); }
// 二分圖：M = 配對的中間邊；o.st 顯示 s、t；o.res 畫 residual；o.path 標亮
function bipBuild(showST) {
  buildNodes(NETS.bip5);
  NG.G = NETS.bip5; NG.F = NG.G.edges.map(() => 0); NG.val = 0;
  GR.nodes[0].mesh.visible = !!showST; GR.nodes[11].mesh.visible = !!showST;
  tag('男生', 'idx', -2.4, 0.3, -4.3); tag('女生', 'idx', 2.4, 0.3, -4.3);
}
function bipRender(M, o = {}) {
  clearEdges();
  const G = NETS.bip5, mL = new Set(), mR = new Set();
  G.edges.forEach(([u, v], i) => { if (M.has(i)) { mL.add(u); mR.add(v); } });
  G.edges.forEach(([u, v], i) => {
    const mid = u >= 1 && u <= 5;
    if (!mid && !o.st) return;
    const used = mid ? M.has(i) : (u === 0 ? mL.has(v) : mR.has(u));
    const hot = o.path && o.path.includes(i);
    if (o.res) { if (used) addEdge(v, u, '', 0, hot ? C.hot : C.back, hot ? 2.2 : 1.2); else addEdge(u, v, '', 0, hot ? C.hot : C.edge, hot ? 2.2 : 1); }
    else addEdge(u, v, '', 0, hot ? C.hot : used ? C.flow : C.edge, used || hot ? 2.2 : 1);
  });
}

// ════════════════ Iwc3Uj4aaF4：Ford-Fulkerson（英文短片） ════════════════
// 00:00 問題：flow network、capacity、source/sink、兩個限制
FRAG.push(['flow-v1-problem', '短片：flow network 與兩個限制（A → F）', async (tok) => {
  fresh(); buildNet('ffv'); flView();
  say('有向加權圖：權重 = capacity', 'flow network（weighted digraph）');
  await beat(tok, 3200);
  nodeColor(0, C.S, 0.4); nodeTag(0, 'source'); nodeColor(5, C.T, 0.4); nodeTag(5, 'sink');
  say('A 是 source、F 是 sink', 'flow 從 A 出發、在 F 結束');
  await beat(tok, 3000);
  flView(null, new Set([0]));
  say('限制 1：flow 不超過 capacity', 'A → C：0 ≤ f ≤ 11');
  await beat(tok, 3200);
  flView(null, new Set([0, 1, 3])); nodeColor(2, C.hot, 0.5); nodeTag(2, '流入 = 流出');
  say('限制 2：每個點 inflow = outflow', '除了 source 與 sink');
  await beat(tok, 3400);
  nodeColor(2, C.white, 0); nodeTag(2, ''); flView();
  say('A 只流出、F 只流入', '求 A 到 F 的最大流量');
  await beat(tok, 3000);
}]);

// 03:18 residual capacity、bottleneck：A → C → D → F 送 9
FRAG.push(['flow-v1-acdf', '短片：A → C → D → F，bottleneck 9', async (tok) => {
  fresh(); buildNet('ffv'); flView();
  const VT = flVal('flow = 0');
  await beat(tok, 1200);
  flView(null, new Set([0, 1, 2]));
  say('看路徑 A → C → D → F', 'capacity：11、9、11');
  await beat(tok, 3200);
  flPaint(1, C.sat, 2.8);
  say('最多只能送 9：bottleneck', 'min(11, 9, 11) = 9');
  await beat(tok, 3200);
  await flDrop(tok, ['A', 'C', 'D', 'F']);
  flSet([9, 9, 9, 0, 0, 0]); renderFlow(new Set([0, 1, 2])); txt(VT, 'flow = 9');
  say('沿這條路徑送 9', '9/11、9/9、9/11');
  await beat(tok, 3000);
  flView((i, c, f) => String(c - f), new Set([0, 1, 2]));
  say('residual capacity = c − f', '11 − 9 = 2、9 − 9 = 0、11 − 9 = 2');
  await beat(tok, 3400);
  say('剩下的容量構成 residual graph', '影片把 bottleneck 叫 minimal cut');
  await beat(tok, 3000);
}]);

// 06:00 A → C → B → E → F 再送 2；augmenting path 的兩種邊
FRAG.push(['flow-v1-acbef', '短片：A → C → B → E → F 再送 2，flow = 11', async (tok) => {
  fresh(); buildNet('ffv'); flSet([9, 9, 9, 0, 0, 0]); renderFlow();
  const VT = flVal('flow = 9');
  say('目前 A → C → D → F 有 9', '');
  await beat(tok, 2400);
  flView((i, c, f) => String(c - f), new Set([0, 3, 4, 5]));
  say('再看 A → C → B → E → F', '剩餘：2、10、9、2');
  await beat(tok, 3400);
  flPaint(0, C.sat, 2.8); flPaint(5, C.sat, 2.8);
  say('這條路的 bottleneck = 2', 'min(2, 10, 9, 2) = 2');
  await beat(tok, 3000);
  await flDrop(tok, ['A', 'C', 'B', 'E', 'F']);
  flSet([11, 9, 9, 2, 2, 2]); renderFlow(new Set([0, 3, 4, 5])); txt(VT, 'flow = 9 + 2 = 11');
  say('再送 2：A → C 變 11/11', 'flow = 11');
  await beat(tok, 3200);
  renderFlow();
  say('① 沒滿的 forward edge', 'non-full forward edges');
  await beat(tok, 2800);
  renderResidual();
  say('② 有 flow 的 backward edge', 'non-empty backward edges（紫色）');
  await beat(tok, 3400);
}]);

// 07:24 演算法三步驟：flow 0 → 9 → 11
FRAG.push(['flow-v1-algo', '短片：Ford-Fulkerson 三步驟（0 → 9 → 11）', async (tok) => {
  fresh([0, 13.5, 9], [0, 0, 0.8]); buildNet('ffv'); renderFlow();
  const P = flCode(['1. flow ← 0', '2. while 有 augmenting path:', '3.     flow ← flow + path flow', '4. return flow（最大流）'], 0, 3.6);
  const VT = tag('flow = 0', 'ptr alt', -5.4, 0.3, -3.6);
  P.hl(0);
  say('Step 1：初始 flow = 0', '');
  await beat(tok, 2800);
  P.hl(1); renderFlow(new Set([0, 1, 2]));
  say('Step 2：有 augmenting path 就做', 'A → C → D → F');
  await beat(tok, 2800);
  P.hl(2); flSet([9, 9, 9, 0, 0, 0]); renderFlow(new Set([0, 1, 2])); txt(VT, 'flow = 0 + 9 = 9');
  say('把 path flow 加進 flow', '0 + 9 = 9');
  await beat(tok, 2800);
  P.hl(1); renderFlow(new Set([0, 3, 4, 5]));
  say('還有路：A → C → B → E → F', '');
  await beat(tok, 2600);
  P.hl(2); flSet([11, 9, 9, 2, 2, 2]); renderFlow(new Set([0, 3, 4, 5])); txt(VT, 'flow = 9 + 2 = 11');
  say('再加 2', '9 + 2 = 11');
  await beat(tok, 2800);
  P.hl(3); renderFlow();
  say('沒有 augmenting path 就回傳', '回傳的 flow = 最大流');
  await beat(tok, 3000);
}]);

// ════════════════ lY1SKWSR3pk：江蕙如 Lec20 Network Flow (1/2) ════════════════
// 01:29 應用：水管、運輸、電腦網路、電路；1955 蘇聯鐵路 163,000
FRAG.push(['flow-l20-apps', 'Lec20：flow network 的應用與 1955 鐵路問題', async (tok) => {
  fresh();
  const items = [['水管', 'water pipes'], ['運輸', 'transportation'], ['網路', 'packets'], ['電路', 'current']];
  say('圖裡有東西在流動：flow network', '');
  const cs = [];
  for (let i = 0; i < 4; i++) {
    const x = -4.5 + 3 * i;
    cs.push(cube(items[i][0], '#cfe0f0', [1.5, 0.8, 1.2], x, 0.4, -2.2, 4));
    tag(items[i][1], 'idx', x, 0.3, -1.1);
    await beat(tok, 800);
  }
  await beat(tok, 1400);
  glow(cs[0], '#6a4a00');
  say('最直覺：水管網路', '管子 = edge，水 = flow');
  await beat(tok, 3000);
  glow(cs[0], null);
  const ru = cube('蘇聯', '#e9d6b0', [1.4, 0.8, 1.2], -5, 0.4, 2.4, 4), eu = cube('東歐', '#d6e9c8', [1.4, 0.8, 1.2], 5, 0.4, 2.4, 4);
  const mids = [[-1.6, 1.5], [-1.6, 3.4], [1.6, 1.5], [1.6, 3.4]].map(([x, z]) => cube(null, '#bbb', [0.4, 0.4, 0.4], x, 0.2, z, 3));
  [[-5, 2.4, -1.6, 1.5], [-5, 2.4, -1.6, 3.4], [-1.6, 1.5, 1.6, 1.5], [-1.6, 3.4, 1.6, 3.4], [-1.6, 1.5, 1.6, 3.4], [1.6, 1.5, 5, 2.4], [1.6, 3.4, 5, 2.4]]
    .forEach(([a, b, c, d]) => flSeg(a, b, c, d));
  say('1955：蘇聯運工人到東歐', '鐵路網 = transportation network');
  await beat(tok, 3200);
  say('每段鐵路能運多少人次 = capacity', '鐵路沒有方向：可雙向');
  await beat(tok, 3200);
  tag('最大運輸量 ≈ 163,000 人次', 'ptr alt', 0, 0.3, 4.6);
  glow(ru, '#0f5a3a'); glow(eu, '#0f5a3a');
  say('算出整個網路的最大運輸量', '約 163,000 人次');
  await beat(tok, 3200);
  void mids;
}]);

// 06:49 定義：directed graph、capacity、source 水龍頭、sink 水桶、internal node
FRAG.push(['flow-l20-def', 'Lec20：flow network 的定義（水龍頭與水桶）', async (tok) => {
  fresh(); buildNet('lsm'); flView();
  say('Flow network 是 directed graph', '多了 capacity');
  await beat(tok, 3000);
  nodeTag(0, '水龍頭 source'); nodeTag(3, '水桶 sink');
  nodeColor(0, C.S, 0.4); nodeColor(3, C.T, 0.4);
  say('source s 產生 flow、sink t 接收', 's = 水龍頭，t = 水桶');
  await beat(tok, 3200);
  nodeColor(1, C.hot, 0.4); nodeColor(2, C.hot, 0.4); nodeTag(1, 'internal'); nodeTag(2, 'internal');
  say('中間的點叫 internal node', 'a、b');
  await beat(tok, 2600);
  nodeColor(1, C.white, 0); nodeColor(2, C.white, 0); nodeTag(1, ''); nodeTag(2, '');
  flView(null, new Set([2]));
  say('每條 edge 是一段水管', 'capacity = 水管粗細，超過會爆');
  await beat(tok, 3200);
  say('水要順著 edge 方向流', '可雙向就建兩條反向 edge');
  await beat(tok, 3000);
  flView();
  say('問題：最多能流多少水？', '水龍頭開多大 = 水桶收多少');
  await beat(tok, 3000);
}]);

// 10:40 先往上推 2：s → a → b → t（2、3、2）
FRAG.push(['flow-l20-push2', 'Lec20：先沿 s → a → b → t 推 2 單位', async (tok) => {
  fresh(); buildNet('lsm'); flView();
  const VT = flVal('v(f) = 0');
  say('一開始水管全空', '每條 edge 的 flow = 0');
  await beat(tok, 2600);
  flView(null, new Set([0, 2, 4]));
  say('試著往上流：s → a → b → t', 'capacity：2、3、2');
  await beat(tok, 3200);
  say('這一串最多推 2 單位', 'min(2, 3, 2) = 2');
  await beat(tok, 2600);
  await flDrop(tok, ['s', 'a', 'b', 't']);
  flSet([2, 0, 2, 0, 2]); renderFlow(new Set([0, 2, 4])); txt(VT, 'v(f) = 2');
  say('推 2 單位到水桶', 's→a 2/2、a→b 2/3、b→t 2/2');
  await beat(tok, 3200);
  flPaint(0, C.sat, 2.8); flPaint(4, C.sat, 2.8);
  say('再多就會爆管', 's → a、b → t 已經滿了');
  await beat(tok, 2800);
  renderFlow();
  say('還能再推更多水嗎？', '');
  await beat(tok, 2600);
}]);

// 12:08 undo flow：s → b → a → t，a → b 從 2 退成 1，總共 3
FRAG.push(['flow-l20-undo', 'Lec20：undo flow，a → b 退回 1，總量 3', async (tok) => {
  fresh(); buildNet('lsm'); flSet([2, 0, 2, 0, 2]); renderFlow();
  const VT = flVal('v(f) = 2');
  say('同學提議：s → b → a → t', 'b → a 跟水管方向相反');
  renderFlow(new Set([1, 3])); flPaint(2, C.back, 2.4);
  await beat(tok, 3200);
  say('空管時不能逆著流', '只能順著 edge 方向灌');
  await beat(tok, 2800);
  say('但 a → b 已有 2 往下流', '送 1 往上 = 把 1 退回去');
  await beat(tok, 3200);
  await flDrop(tok, ['s', 'b', 'a', 't'], C.back);
  flSet([2, 1, 1, 1, 2]); renderFlow(new Set([1, 2, 3])); txt(VT, 'v(f) = 3');
  say('undo flow：a → b 變 2 − 1 = 1', 's→b 1/1、a→t 1/1');
  await beat(tok, 3400);
  say('前提：管內原本要有水', '最多退回原本的 flow');
  await beat(tok, 3000);
  renderFlow();
  say('全部灌滿，再也灌不下去', 'v(f) = 2 + 1 = 3');
  await beat(tok, 3000);
}]);

// 17:33 f/c 標示、f : E → ℝ≥0、v(f) = source 送出 = sink 收到
FRAG.push(['flow-l20-value', 'Lec20：f/c 標示與 flow value v(f) = 3', async (tok) => {
  fresh(); buildNet('lsm'); flSet([2, 1, 1, 1, 2]); renderFlow();
  const VT = flVal('v(f) = ?');
  say('每條 edge 標兩個數字', 'f / c：flow / capacity');
  await beat(tok, 3000);
  say('f 給每條 edge 一個 ≥ 0 的值', 'f : E → ℝ≥0');
  await beat(tok, 3000);
  flPaint(0, C.hot); flPaint(1, C.hot); nodeColor(0, C.hot, 0.4);
  txt(VT, 'v(f) = 2 + 1 = 3');
  say('v(f)：source 送出的總和', '2 + 1 = 3');
  await beat(tok, 3200);
  renderFlow(); flUncolor();
  flPaint(3, C.hot); flPaint(4, C.hot); nodeColor(3, C.hot, 0.4);
  say('也可以算 sink 收到的', '1 + 2 = 3');
  await beat(tok, 3000);
  renderFlow(); flUncolor();
  say('兩邊一定相等', '不相等 = 漏水或無中生有');
  await beat(tok, 3000);
}]);

// 22:39 capacity constraint 與 conservation（KCL）
FRAG.push(['flow-l20-constraints', 'Lec20：capacity constraint 與 conservation', async (tok) => {
  fresh(); buildNet('lsm'); flSet([2, 1, 1, 1, 2]); renderFlow();
  say('限制 1：capacity constraint', '0 ≤ f(e) ≤ c(e)');
  for (let i = 0; i < 5; i++) { renderFlow(new Set([i])); await beat(tok, 750); }
  renderFlow();
  await beat(tok, 800);
  say('限制 2：flow conservation', '像電路學的 KCL：流入 = 流出');
  await beat(tok, 3000);
  nodeColor(1, C.hot, 0.5); nodeTag(1, '進 2 = 出 1 + 1'); renderFlow(new Set([0, 2, 3]));
  say('a：流進 2、流出 1 + 1', '2 = 2');
  await beat(tok, 3000);
  nodeColor(1, C.white, 0); nodeTag(1, '');
  nodeColor(2, C.hot, 0.5); nodeTag(2, '進 1 + 1 = 出 2'); renderFlow(new Set([1, 2, 4]));
  say('b：流進 1 + 1、流出 2', '2 = 2');
  await beat(tok, 3000);
  nodeColor(2, C.white, 0); nodeTag(2, ''); renderFlow();
  say('流入 ≠ 流出就不合法', '進 > 出：漏水；進 < 出：無中生有');
  await beat(tok, 3200);
}]);

// 25:04 cut 給 upper bound：4 + 8 + 9 = 21、10 + 10 = 20
FRAG.push(['flow-l20-cuts', 'Lec20：切一刀得 upper bound（21、20）', async (tok) => {
  fresh(); buildNet('kt'); flView();
  say('新例子：邊上標的是 capacity', '先找最大流的 upper bound');
  await beat(tok, 3200);
  say('切一刀：s、t 分在兩側', '水一定要經過這個截面');
  await beat(tok, 2600);
  let c = flCut(new Set([0, 1, 2]));
  say('切到 4、8、9 三條水管', '最多 4 + 8 + 9 = ' + c);
  await beat(tok, 3400);
  say('21 是一個 upper bound', '再多就違反 capacity');
  await beat(tok, 2600);
  c = flCut(new Set([0]));
  say('換一刀：切 10 和 10', '10 + 10 = ' + c + '，更緊');
  await beat(tok, 3200);
  say('每個 cut 都是 upper bound', '找最緊的：min cut');
  await beat(tok, 3000);
}]);

// 31:49 斜切：s→a、a→b（反向）、b→d → 10 + 9 = 19
FRAG.push(['flow-l20-cutdiag', 'Lec20：斜切，反向邊不算（10 + 9 = 19）', async (tok) => {
  fresh(); buildNet('kt'); flView();
  say('斜切：切到 s→a、a→b、b→d', '');
  await beat(tok, 2600);
  const c = flCut(new Set([0, 2]));
  say('a → b 從 sink 側流回來', '紫色 = backward 方向的邊');
  await beat(tok, 3200);
  say('forward 灌滿，backward 不灌水', '這樣的 flow 最大');
  await beat(tok, 3000);
  say('只算 forward 方向的 capacity', '10 + 9 = ' + c + '（2 不算）');
  await beat(tok, 3200);
  say('這個例子的最佳解就是 19', 'min cut = 19');
  await beat(tok, 3000);
}]);

// 34:00 Ford-Fulkerson 的想法：greedy + undo，在 G 與 G_f 之間交替
FRAG.push(['flow-l20-ffidea', 'Lec20：Ford-Fulkerson，在 G 與 G_f 之間交替', async (tok) => {
  fresh(); buildNet('lsm'); flSet([2, 0, 2, 0, 2]); renderFlow();
  const T1 = flVal('flow network G');
  say('Ford-Fulkerson：greedy 順著灌', '再加上退水（undo flow）');
  await beat(tok, 3200);
  renderResidual(); txt(T1, 'residual graph G_f');
  say('建 residual graph G_f', '記錄每條 edge 還能灌多少');
  await beat(tok, 3200);
  const p = flPath(['s', 'b', 'a', 't']); renderResidual(p);
  say('在 G_f 上找 s 到 t 的 path', '灌 bottleneck 那麼多');
  await beat(tok, 3000);
  augment(p); renderFlow(new Set(p.map((r) => r.i))); txt(T1, 'flow network G：v(f) = 3');
  say('更新 flow network G', 'v(f) = 3');
  await beat(tok, 3000);
  renderResidual(); txt(T1, 'residual graph G_f');
  say('再建新的 G_f、再找 path', '兩張圖交替操作');
  await beat(tok, 3000);
  const S = reachS();
  for (let v = 0; v < GR.n; v++) nodeColor(v, S.has(v) ? C.S : C.T, 0);
  say('找不到 s → t path 就停', '此時就是 maximum flow');
  await beat(tok, 3000);
}]);

// 37:08 建 G_f：forward = c − f、backward = f
FRAG.push(['flow-l20-residual', 'Lec20：一條一條建出 residual graph G_f', async (tok) => {
  fresh(); buildNet('lsm'); flSet([2, 0, 2, 0, 2]); renderFlow();
  const T1 = flVal('flow network G');
  say('目前 G：s→a→b→t 各有 2', 's → b、a → t 的 flow = 0');
  await beat(tok, 3000);
  clearEdges(); txt(T1, 'residual graph G_f');
  say('G_f：點不變，邊重新建', '每條水管 → 最多兩條 edge');
  await beat(tok, 2600);
  const R = residualEdges();
  const both = (r) => R.some((q) => q.u === r.v && q.v === r.u);
  say('forward：還能順著灌 c − f', 's→b 1、a→b 3 − 2 = 1、a→t 1');
  for (const r of R.filter((x) => x.dir > 0)) { addEdge(r.u, r.v, fB(r.cap), both(r) ? 0.14 : 0, C.edge, 1.6); await beat(tok, 1000); }
  await beat(tok, 900);
  say('s→a、b→t 滿了：沒有 forward', '剩 0 就不建');
  await beat(tok, 2600);
  say('backward：有水才能退', '容量 = 目前的 flow 2');
  for (const r of R.filter((x) => x.dir < 0)) { addEdge(r.u, r.v, fB(r.cap), both(r) ? 0.14 : 0, C.back, 1.6); await beat(tok, 1000); }
  await beat(tok, 900);
  say('這就是 residual graph', '灰 = forward、紫 = backward');
  await beat(tok, 3000);
}]);

// 44:35 在 G_f 找 s → b → a → t，bottleneck 1，更新 G
FRAG.push(['flow-l20-augment', 'Lec20：G_f 上的 augmenting path s → b → a → t', async (tok) => {
  fresh(); buildNet('lsm'); flSet([2, 0, 2, 0, 2]); renderResidual();
  const VT = flVal('v(f) = 2');
  say('residual capacity：G_f 的邊容量', '= 還能灌多少水');
  await beat(tok, 3000);
  const p = flPath(['s', 'b', 'a', 't']); renderResidual(p);
  say('找 path：s → b → a → t', 'residual capacity：1、2、1');
  await beat(tok, 3200);
  say('bottleneck = path 上最小的', 'min(1, 2, 1) = 1');
  await beat(tok, 2800);
  await flDrop(tok, ['s', 'b', 'a', 't'], C.hot);
  augment(p); renderFlow(new Set([1, 2, 3])); txt(VT, 'v(f) = 2 + 1 = 3');
  say('同向加 b，反向減 b', 's→b +1、a→b 2 − 1 = 1、a→t +1');
  await beat(tok, 3600);
  say('這叫 augmenting path', '反覆做到 G_f 沒有 s → t path');
  await beat(tok, 3000);
}]);

// 54:37 課堂例子前兩輪：8，再 6 → 14
FRAG.push(['flow-l20-run1', 'Lec20：例子第 1、2 輪（8 → 14）', async (tok) => {
  fresh(); buildNet('kt'); renderFlow();
  const VT = flVal('v(f) = 0');
  say('一開始所有 flow = 0', 'G_f 跟 G 長得一模一樣');
  await beat(tok, 2600);
  const p1 = flPath(['s', 'a', 'd', 't']); renderResidual(p1);
  say('隨便找：s → a → d → t', 'bottleneck = min(10, 8, 10) = 8');
  await beat(tok, 3400);
  augment(p1); renderFlow(new Set([0, 4, 8])); txt(VT, 'v(f) = 8');
  say('灌 8：flow = 8', 'a → d 8/8 飽和');
  await beat(tok, 3000);
  renderResidual();
  say('重建 G_f：只有這三條會變', '滿的 a → d 只剩反向 8');
  await beat(tok, 3200);
  const p2 = flPath(['s', 'b', 'd', 'c', 't']); renderResidual(p2);
  say('第二條：s → b → d → c → t', 'bottleneck = min(10, 9, 6, 10) = 6');
  await beat(tok, 3400);
  augment(p2); renderFlow(new Set([1, 5, 6, 7])); txt(VT, 'v(f) = 8 + 6 = 14');
  say('灌 6：flow = 14', '到目前都是順著 edge 灌');
  await beat(tok, 3000);
}]);

// 60:20 第 3 輪走反向 d → a（8 → 5），17；第 4 輪 2 → 19
FRAG.push(['flow-l20-run2', 'Lec20：例子第 3、4 輪，走反向邊（14 → 19）', async (tok) => {
  fresh(); buildNet('kt'); flSet(KT14); renderFlow();
  const VT = flVal('v(f) = 14');
  renderResidual();
  say('flow = 14，更新 G_f', 'd → c 滿了：只剩反向 6');
  await beat(tok, 3000);
  const p3 = flPath(['s', 'b', 'd', 'a', 'c', 't']); renderResidual(p3);
  say('第三條經過 5 條邊', 'd → a 是反向邊（退 a → d 的水）');
  await beat(tok, 3400);
  say('bottleneck = 3', 'min(4, 3, 8, 4, 4) = 3');
  await beat(tok, 2800);
  augment(p3); renderFlow(new Set([1, 5, 4, 3, 7])); flPaint(4, C.back, 2.4); txt(VT, 'v(f) = 14 + 3 = 17');
  say('b→d 6 + 3 = 9；a→d 8 − 3 = 5', 'flow = 17');
  await beat(tok, 3600);
  const p4 = flPath(['s', 'a', 'd', 't']); renderResidual(p4);
  say('第四條：s → a → d → t', 'bottleneck = min(2, 3, 2) = 2');
  await beat(tok, 3200);
  augment(p4); renderFlow(new Set([0, 4, 8])); txt(VT, 'v(f) = 17 + 2 = 19');
  say('灌 2：flow = 19', '');
  await beat(tok, 3000);
}]);

// 63:49 s 只走得到 b → 停止；cut {s, b}：10 + 9 = 19
FRAG.push(['flow-l20-runcut', 'Lec20：s 只走得到 b，cut 10 + 9 = 19', async (tok) => {
  fresh(); buildNet('kt'); flSet(KT19); renderResidual();
  const VT = flVal('v(f) = 19');
  say('flow = 19，再建 G_f', '找 s 到 t 的 path');
  await beat(tok, 3000);
  nodeColor(0, C.hot, 0.4);
  await beat(tok, 900);
  nodeColor(2, C.hot, 0.4); nodeTag(2, '走不出去');
  say('s 只走得到 b', 'b 再也走不出去');
  await beat(tok, 3200);
  say('G_f 裡 s 到不了 t：停止', '沒有 augmenting path → max flow');
  await beat(tok, 3000);
  nodeTag(2, '');
  const c = flCut(reachS(), { flow: true });
  say('s 走得到的點圍成一個 cut', 'S = {s, b}');
  await beat(tok, 3000);
  txt(VT, 'cut = 10 + 9 = ' + c + ' = v(f)');
  say('cut 容量 10 + 9 = 19', '= 灌進去的 19：min cut = max flow');
  await beat(tok, 3600);
}]);

// 70:23 primal / dual；比較 27、21、19
FRAG.push(['flow-l20-mfmc', 'Lec20：max-flow min-cut（27、21、19）', async (tok) => {
  fresh(); buildNet('kt'); flSet(KT19); renderFlow();
  const VT = flVal('max flow = 19');
  say('primal：max flow；dual：min cut', '兩個問題一起收斂');
  await beat(tok, 3000);
  const tries = [[[0, 1, 2, 3], '10 + 8 + 9 = 27（6 不算）'], [[0, 1, 2], '4 + 8 + 9 = 21'], [[0, 2], '10 + 9 = 19 最小']];
  for (const [S, f] of tries) {
    const c = flCut(new Set(S));
    txt(VT, 'cut = ' + c);
    say('每個 cut 都是 upper bound', f);
    await beat(tok, 3200);
  }
  txt(VT, 'max flow = min cut = 19');
  say('Max-flow min-cut theorem', 'max flow = min cut = 19');
  await beat(tok, 3200);
}]);

// 76:52 Bipartite matching：3 對 vs 最多 4 對
FRAG.push(['flow-l20-bip-problem', 'Lec20：bipartite matching，3 對與最多 4 對', async (tok) => {
  fresh(); bipBuild(false); bipRender(new Set());
  say('Bipartite matching：左右配對', '有 edge = 有機會配對');
  await beat(tok, 3200);
  say('每人最多配一個對象', '同一群之間沒有 edge');
  await beat(tok, 2800);
  bipRender(M3);
  say('這個解配了 3 對', '2 男、2 女落單');
  await beat(tok, 3200);
  bipRender(M4);
  say('最好可以配 4 對', '配不出 5 對');
  await beat(tok, 3200);
  say('maximum bipartite matching', '不管 stable，只求配最多對');
  await beat(tok, 3000);
  say('perfect：每人恰好配一個', 'perfect ≠ stable');
  await beat(tok, 2800);
}]);

// 81:14 建 flow network：加 s、t，左→右，capacity 全部 1；max flow 4
FRAG.push(['flow-l20-bip-reduce', 'Lec20：matching → max flow（capacity 全 1）', async (tok) => {
  fresh(); bipBuild(false); bipRender(new Set());
  say('不寫新演算法：改用 max flow', '難在怎麼建 flow network');
  await beat(tok, 3200);
  GR.nodes[0].mesh.visible = true; GR.nodes[11].mesh.visible = true;
  nodeColor(0, C.S, 0.3); nodeColor(11, C.T, 0.3);
  say('加 source s 與 sink t', '');
  await beat(tok, 2400);
  bipRender(new Set(), { st: true });
  say('邊改成有向：s → 男 → 女 → t', '一律由左到右');
  await beat(tok, 3000);
  tag('capacity 全部 = 1', 'ptr alt', 0, 0.3, 4.6);
  say('所有 capacity 都設 1', '每人最多一單位 = 最多配一人');
  await beat(tok, 3200);
  bipRender(M4, { st: true });
  say('跑 max flow：|f| = 4', '藍色 = 有水流的邊');
  await beat(tok, 3200);
  GR.nodes[0].mesh.visible = false; GR.nodes[11].mesh.visible = false; bipRender(M4);
  say('回到原圖：有水的中間邊 = 配對', "1–1′、2–2′、3–3′、5–4′");
  await beat(tok, 3200);
}]);

// 86:16 residual：配到的邊只剩反向；alternating augmenting path 讓配對 +1
FRAG.push(['flow-l20-bip-alt', 'Lec20：alternating augmenting path，3 對 → 4 對', async (tok) => {
  fresh(); bipBuild(true); bipRender(M3, { st: true });
  say('假設跑到一半：已配 3 對', "1–2′、3–3′、5–4′");
  await beat(tok, 3000);
  bipRender(M3, { st: true, res: true });
  say('G_f：配到的邊只剩反向', '紫 = 反向（影片畫虛線）');
  await beat(tok, 3200);
  bipRender(M3, { st: true, res: true, path: [1, 7, 6, 5, 12] });
  say('augmenting path 左右交替', "s → 2 → 2′ ⇢ 1 → 1′ → t");
  await beat(tok, 3600);
  say('順向邊比反向邊多一條', '配對數 +1');
  await beat(tok, 3000);
  bipRender(M4, { st: true });
  say('1 改配 1′、2 配 2′：4 對', '這就是 alternating path');
  await beat(tok, 3200);
}]);

// ════════════════ NOYNTuhXDGU：江蕙如 Lec21 Network Flow (2/2) ════════════════
// 02:12 Ford-Fulkerson 虛擬碼
FRAG.push(['flow-l21-code', 'Lec21：Ford-Fulkerson 虛擬碼逐行看', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const P = flCode([
    '1  foreach e ∈ E: f(e) ← 0',
    '2  G_f ← residual graph',
    '3  while ∃ s-t path P in G_f:',
    '4    b ← bottleneck(P)',
    '5    foreach e ∈ P:',
    '6      if e forward: f(e) ← f(e) + b',
    '7      else:  f(eᴿ) ← f(eᴿ) − b',
    '8    update G_f',
    '9  return f'], 0, -3, 0.68);
  P.hl(0);
  say('初始化：所有 flow = 0', 'f(e) ← 0');
  await beat(tok, 2800);
  P.hl(1);
  say('建 residual graph G_f', '一開始只有 forward edge');
  await beat(tok, 2800);
  P.hl(2);
  say('while：G_f 有 s-t path P', 'P = augmenting path');
  await beat(tok, 2800);
  P.hl(3);
  say('b = 最小的 residual capacity', 'bottleneck');
  await beat(tok, 2600);
  P.hl(5);
  say('forward edge：加 b', '順著再灌 b');
  await beat(tok, 2600);
  P.hl(6);
  say('backward edge：反向那條減 b', 'undo flow');
  await beat(tok, 2600);
  P.hl(7);
  say('更新 G_f，再找下一條', '');
  await beat(tok, 2400);
  P.hl(8);
  say('s 到不了 t 就停，輸出 f', '');
  await beat(tok, 2800);
}]);

// 一條邊的 capacity 長條（c = 10、f = 6）：forward 加 b、backward 減 b
async function flBar(tok, back) {
  fresh([0, 10, 9], [0, 0, 0.9]);
  const X = (k) => -4.5 + k;
  for (let k = 0; k < 10; k++) ghostBox('#7a6a50', 0.86, 0.86, 0.86).position.set(X(k), 0.43, 0);
  const cs = [];
  for (let k = 0; k < 6; k++) cs.push(cube(null, C.flow, [0.8, 0.8, 0.8], X(k), 0.4, 0));
  tag('c = 10', 'idx', 5.6, 0.3, 0);
  const fl = tag('f = 6', 'ptr', -2, 0.3, -1.2);
  const rs = tag(back ? 'residual（反向）= f = 6' : 'residual = c − f = 4', 'ptr', back ? -2 : 3, 0.3, 1.2);
  const lines = [];
  const add = (t) => { lines.push(tag(t, 'ptr alt', 0, 0.3, 2.4 + lines.length * 0.7)); };
  if (!back) {
    say('forward edge：residual = c − f', 'c = 10、f = 6 → 剩 4');
    await beat(tok, 3200);
    add('b ≤ c − f');
    say('b 是最小的 residual', '所以 b ≤ c − f');
    await beat(tok, 2800);
    for (let k = 6; k < 9; k++) { cs.push(cube(null, C.hot, [0.8, 0.8, 0.8], X(k), 0.4, 0, 3)); await beat(tok, 450); }
    txt(fl, 'f′ = 6 + 3 = 9');
    say('灌 b = 3：f′ = f + b', '6 + 3 = 9');
    await beat(tok, 2600);
    add('f′ = f + b ≤ f + (c − f) = c');
    say('上界：f′ ≤ c', '不會爆管');
    await beat(tok, 3200);
    add('f′ ≥ f ≥ 0');
    say('下界：f′ ≥ f ≥ 0', 'capacity constraint 成立');
    await beat(tok, 3000);
  } else {
    say('backward edge：residual = f', '最多把 6 全部退掉');
    await beat(tok, 3200);
    add('b ≤ f');
    say('b 是最小的 residual', '所以 b ≤ f');
    await beat(tok, 2800);
    for (let k = 5; k >= 3; k--) { glow(cs[k], '#7a1010'); await beat(tok, 300); K.fly(cs[k]); await beat(tok, 300); }
    txt(fl, 'f′ = 6 − 3 = 3');
    say('退 b = 3：f′ = f − b', '6 − 3 = 3');
    await beat(tok, 2600);
    add('f′ = f − b ≥ f − f = 0');
    say('下界：f′ ≥ 0', '不會變成負的');
    await beat(tok, 3200);
    add('f′ ≤ f ≤ c');
    say('上界：f′ ≤ f ≤ c', 'backward 也成立');
    await beat(tok, 3000);
  }
  void rs;
}
// 09:00 forward edge：f′ = f + b ≤ c
FRAG.push(['flow-l21-cap-fwd', 'Lec21：forward edge 灌 b 後仍 ≤ c', async (tok) => { await flBar(tok, false); }]);
// 18:32 backward edge：f′ = f − b ≥ 0
FRAG.push(['flow-l21-cap-back', 'Lec21：backward edge 退 b 後仍 ≥ 0', async (tok) => { await flBar(tok, true); }]);

// 21:35 conservation：path 上的點一進一出都多 b
FRAG.push(['flow-l21-conserve', 'Lec21：path 上的點進出都多 b，仍守恆', async (tok) => {
  fresh(); buildNet('cons'); flSet([3, 2, 4, 1]); renderFlow();
  nodeTag(2, '進 5 = 出 5');
  say('檢查 conservation：看點 v', 's、t 不用檢查');
  await beat(tok, 3000);
  say('灌水前 f 合法', '進 3 + 2 = 出 4 + 1');
  await beat(tok, 3000);
  renderFlow(new Set([1, 2]));
  say('path 從一條邊進、一條邊出', 'u → v → w');
  await beat(tok, 2800);
  await flDrop(tok, ['u', 'v', 'w'], C.hot);
  flSet([3, 4, 6, 1]); renderFlow(new Set([1, 2])); nodeTag(2, '進 7 = 出 7');
  say('進來多 b、出去也多 b', 'b = 2');
  await beat(tok, 3200);
  say('等量加法：x = y ⇒ x + b = y + b', '');
  await beat(tok, 3200);
  renderFlow();
  say('所以每輪的 f′ 都是合法 flow', 'capacity + conservation');
  await beat(tok, 3000);
}]);

// 25:25 integer capacity：先 normalize；bottleneck 每次都是整數
FRAG.push(['flow-l21-integer', 'Lec21：capacity 先 normalize 成整數', async (tok) => {
  fresh(); buildNet('lsmh'); flView();
  const VT = flVal('v(f) = 0');
  say('capacity 不是整數怎麼辦？', '0.5、1、1.5 …');
  await beat(tok, 3000);
  say('先 normalize：除以最大公因數', 'gcd = 0.5');
  await beat(tok, 2800);
  NG.G = NETS.lsm; NG.F = NG.G.edges.map(() => 0); NG.val = 0; flView();
  say('全部變成整數', '2、1、3、1、2');
  await beat(tok, 3000);
  const p = flPath(['s', 'a', 'b', 't']); renderResidual(p);
  say('bottleneck = 整數的最小值', 'b = 2');
  await beat(tok, 2800);
  augment(p); renderFlow(new Set([0, 2, 4])); txt(VT, 'v(f) = 2');
  say('flow 與 residual 仍是整數', 'invariant：每輪都是整數');
  await beat(tok, 3000);
  const p2 = flPath(['s', 'b', 'a', 't']); augment(p2); renderFlow(new Set([1, 2, 3])); txt(VT, 'v(f) = 3');
  say('每輪至少 +1', '不會 0.1、0.001 慢慢爬');
  await beat(tok, 3000);
  say('知道上界就知道最多幾輪', '上界 100 → 最多 100 輪');
  await beat(tok, 3000);
}]);

// 29:45 flow 嚴格遞增：第一條邊一定是 forward
FRAG.push(['flow-l21-increase', 'Lec21：每輪 v(f) 嚴格增加 b', async (tok) => {
  fresh(); buildNet('lsm'); renderFlow();
  const VT = flVal('v(f) = 0');
  const p = flPath(['s', 'a', 'b', 't']); renderResidual(p);
  say('path 是 simple：不會回到 s', '從 s 一路走到 t');
  await beat(tok, 3000);
  nodeColor(0, C.hot, 0.4); nodeTag(0, '只有 outgoing');
  say('s 沒有 incoming edge', '第一條邊一定是 forward');
  await beat(tok, 3000);
  augment(p); renderFlow(new Set([0, 2, 4])); txt(VT, 'v(f) = 0 + 2 = 2');
  say('第一條邊多灌 b', 'v(f′) = v(f) + b');
  await beat(tok, 3000);
  const p2 = flPath(['s', 'b', 'a', 't']); renderResidual(p2);
  say('中間可以走 backward', '但離開 s 的仍是 forward');
  await beat(tok, 3000);
  augment(p2); renderFlow(new Set([1, 2, 3])); txt(VT, 'v(f) = 2 + 1 = 3');
  say('b > 0：flow 嚴格遞增', 'b = 0 時早就停了');
  await beat(tok, 3000);
}]);

// 33:43 running time：C = s 出邊 capacity 總和；≤ C 輪，每輪 O(m)
FRAG.push(['flow-l21-runtime', 'Lec21：最多 C 輪、每輪 O(m) → O(mC)', async (tok) => {
  fresh(); buildNet('kt'); flView();
  const c = flCut(new Set([0]));
  const VT = flVal('C = 10 + 10 = ' + c);
  say('最簡單的 upper bound：s 的出邊', 'C = 10 + 10 = 20');
  await beat(tok, 3200);
  say('max flow ≤ C', 'C 不一定是 min cut');
  await beat(tok, 2800);
  txt(VT, 'iterations ≤ C = 20');
  say('整數 capacity：每輪至少 +1', '最多 C 輪一定停');
  await beat(tok, 3000);
  txt(VT, '每輪：建 G_f、找 path、灌水 = O(m)');
  say('每輪的工作都是 O(m)', 'm = edge 數（BFS／DFS 找路）');
  await beat(tok, 3200);
  txt(VT, '總時間 O(m · C)');
  say('總時間 O(m·C)', '');
  await beat(tok, 2800);
}]);

// 38:42 壞例子：每輪只 +1，要 200 輪；好的選法 2 輪
FRAG.push(['flow-l21-bad', 'Lec21：壞例子要 200 輪，好路徑 2 輪', async (tok) => {
  fresh(); buildNet('b100'); flView();
  const VT = flVal('第 0 輪：|f| = 0');
  say('四條 100，中間一條細管 1', '最佳解：上下各送 100 = 200');
  await beat(tok, 3200);
  for (let k = 1; k <= 4; k++) {
    const p = flPath(k % 2 ? ['s', 'u', 'v', 't'] : ['s', 'v', 'u', 't']);
    renderResidual(p);
    say(k % 2 ? '運氣差：path 經過中間' : '下一條走反向，又只推 1', 'bottleneck = 1');
    await beat(tok, 1700);
    augment(p); renderFlow(new Set(p.map((r) => r.i)));
    txt(VT, '第 ' + k + ' 輪：|f| = ' + NG.val);
    await beat(tok, 1300);
  }
  say('上下兩個 Z 輪流，每輪 +1', 'C = 100 + 100 = 200 輪');
  await beat(tok, 3200);
  flSet([0, 0, 0, 0, 0]); flView();
  for (const [k, ps] of [[1, ['s', 'u', 't']], [2, ['s', 'v', 't']]]) {
    const p = flPath(ps); renderResidual(p);
    augment(p); renderFlow(new Set(p.map((r) => r.i)));
    txt(VT, '第 ' + k + ' 輪：|f| = ' + NG.val);
    say('好的 path：上面、下面各一條', '一次 100');
    await beat(tok, 2400);
  }
  say('只要 2 輪就結束', '路徑挑得好差很多');
  await beat(tok, 3000);
}]);

// 41:08 pseudo-polynomial：m 是 input size，C 是數值
FRAG.push(['flow-l21-pseudo', 'Lec21：O(mC) 是 pseudo-polynomial', async (tok) => {
  fresh([0, 10, 10], [0, 1.6, 0.8]);
  say('O(m·C) 是 polynomial 嗎？', '不是！');
  await beat(tok, 2800);
  const ms = [];
  for (let k = 0; k < 5; k++) { ms.push(cube('e', '#cfe0f0', [0.8, 0.8, 0.8], -5 + k, 0.4, 0, 3)); await beat(tok, 250); }
  tag('m = 邊數（input size）', 'ptr', -3, 0.3, 1.4);
  ms.forEach((m) => glow(m, '#0f5a3a'));
  say('m 是 input size', '告訴你有幾條 edge');
  await beat(tok, 2600);
  for (let k = 0; k < 7; k++) { cube(k === 6 ? '10⁶' : null, '#f3d2c8', [1.2, 0.8, 1.2], 3.5, 0.4 + 0.82 * k, 0, 3); await beat(tok, 250); }
  tag('C = capacity 的「數值」', 'ptr', 3.5, 0.3, 1.4);
  say('C 是 capacity 的數值', 'edge 很少、capacity 可以很大');
  await beat(tok, 3200);
  say('這叫 pseudo-polynomial time', 'C 一大，iteration 就爆炸');
  await beat(tok, 3000);
  tag('Knapsack／Subset sum：O(nW)', 'ptr alt', 0, 0.3, 3.2);
  say('之前看過：Knapsack 的 O(nW)', 'W = 背包容量，也是數值');
  await beat(tok, 3200);
}]);

// 44:03 挑好 augmenting path：最大 bottleneck、最少邊（BFS）、Δ-scaling
FRAG.push(['flow-l21-strategies', 'Lec21：挑好路徑的三種策略', async (tok) => {
  fresh(); buildNet('b100'); flView();
  const VT = flVal('');
  say('複雜度取決於怎麼挑 path', '');
  await beat(tok, 2600);
  const p = flPath(['s', 'u', 't']); renderResidual(p);
  txt(VT, '策略 1：最大 bottleneck');
  say('策略 1：挑 bottleneck 最大的', 's → u → t 一次 100');
  await beat(tok, 3000);
  txt(VT, '策略 2：最少 edge（BFS）');
  say('策略 2：挑 edge 最少的', 'BFS 找 2 條邊的 path');
  await beat(tok, 3000);
  txt(VT, '策略 3：Δ-scaling，Δ = 64');
  flView(null, null, new Set([2]));
  say('策略 3：Δ-scaling', '只看 capacity ≥ Δ 的水管');
  await beat(tok, 3000);
  flSet([100, 100, 0, 100, 100]);
  renderFlow(); clearEdges(); NG.G.edges.forEach(([u, v, c], i) => { if (i !== 2) addEdge(u, v, fB(NG.F[i]) + '/' + c, 0, C.sat, 2.4); });
  say('先用大水管灌', '|f| = 200');
  await beat(tok, 3000);
  txt(VT, 'Δ = 32 → 16 → … → 1');
  renderFlow();
  say('Δ 減半，慢慢開放小水管', '避免一開始就走細水管');
  await beat(tok, 3200);
}]);

// 47:46 定理：三個敘述互推
FRAG.push(['flow-l21-three', 'Lec21：max-flow min-cut 的三個敘述', async (tok) => {
  fresh();
  const s1 = tag('① 存在 cut (A, B)：v(f) = cap(A, B)', 'ptr', 0, 0.3, -3.2);
  const s2 = tag('② f 是 maximum flow', 'ptr', 3.8, 0.3, 2.6);
  const s3 = tag('③ G_f 沒有 augmenting path', 'ptr', -3.8, 0.3, 2.6);
  say('Max-flow min-cut theorem', 'max flow 的值 = min cut 的 capacity');
  await beat(tok, 3200);
  say('cut 的 capacity 只算 A → B', 'B → A 的邊不算');
  await beat(tok, 3000);
  say('用三個敘述互推來證明', '① ⇒ ② ⇒ ③ ⇒ ①');
  await beat(tok, 2600);
  flLit(s1, true); arrow(V3(1.2, 0.3, -2.6), V3(3.2, 0.3, 1.9), 0x2f7fd0); flLit(s2, true);
  say('① ⇒ ②：weak duality', '');
  await beat(tok, 2400);
  arrow(V3(2, 0.3, 2.6), V3(-1.6, 0.3, 2.6), 0x2f7fd0); flLit(s3, true);
  say('② ⇒ ③：反證法', '');
  await beat(tok, 2400);
  arrow(V3(-3.2, 0.3, 1.9), V3(-1.2, 0.3, -2.6), 0x2f7fd0);
  say('③ ⇒ ①：s 可到達的點', '');
  await beat(tok, 2400);
  say('三個都成立 → 定理得證', '');
  await beat(tok, 2800);
}]);

// 54:03 ② ⇒ ③：有 augmenting path 就能再推，矛盾
FRAG.push(['flow-l21-2to3', 'Lec21：② ⇒ ③，用反證法', async (tok) => {
  fresh(); buildNet('lsm'); flSet([2, 0, 2, 0, 2]); renderFlow();
  const VT = flVal('v(f) = 2');
  say('② ⇒ ③：f 最大 → 沒有 path', '用反證法');
  await beat(tok, 3000);
  const p = flPath(['s', 'b', 'a', 't']); renderResidual(p);
  say('假設 f 最大，但 G_f 有 path', 'P = s → b → a → t');
  await beat(tok, 3200);
  augment(p); renderFlow(new Set([1, 2, 3])); txt(VT, 'v(f) = 2 + 1 = 3');
  say('沿 P 推 bottleneck b > 0', 'flow 變成 2 + 1 = 3');
  await beat(tok, 3000);
  say('flow 變大了：矛盾！', '和「f 是 max flow」衝突');
  await beat(tok, 3200);
  renderResidual();
  const S = reachS();
  for (let v = 0; v < GR.n; v++) nodeColor(v, S.has(v) ? C.S : C.T, 0);
  say('所以 max flow 的 G_f 走不到 t', 'f 最大 ⇒ 沒有 augmenting path');
  await beat(tok, 3200);
}]);

// 56:22 weak duality 推導：A 內部的邊互相抵消
FRAG.push(['flow-l21-weak', 'Lec21：weak duality，內部的邊一加一減', async (tok) => {
  fresh(); buildNet('kt'); flSet(KT17); renderFlow();
  const VT = flVal('v(f) = 17');
  say('任何 flow、任何 cut', 'v(f) ≤ cap(A, B)');
  await beat(tok, 3000);
  const S = new Set([0, 1, 3]);
  flCut(S, { flow: true });
  say('任取一個 cut：A = {s, a, c}', 's ∈ A、t ∈ B');
  await beat(tok, 3000);
  nodeTag(0, '出 − 進');
  say('v(f) = s 的出 − 進（進 = 0）', '8 + 9 − 0 = 17');
  await beat(tok, 3000);
  nodeTag(1, '出 − 進 = 0'); nodeTag(3, '出 − 進 = 0');
  say('再加 A 內其他點的 出 − 進', '守恆：每一項都是 0');
  await beat(tok, 3200);
  flPaint(0, C.hot, 2.6); flPaint(3, C.hot, 2.6);
  say('A 內部的邊一加一減', 's → a、a → c 互相抵消');
  await beat(tok, 2600);
  flPaint(0, C.dim, 0.6); flPaint(3, C.dim, 0.6);
  nodeTag(0, ''); nodeTag(1, ''); nodeTag(3, '');
  say('只剩跨過 cut 的邊', 'v(f) = f_out(A) − f_in(A)');
  await beat(tok, 3000);
  txt(VT, '9 + 0 + 5 + 9 − 6 = 17');
  say('出 A：9 + 0 + 5 + 9；進 A：6', '23 − 6 = 17');
  await beat(tok, 3400);
}]);

// 64:36 不等式：v(f) ≤ f_out(A) ≤ cap(A, B)；① ⇒ ②
FRAG.push(['flow-l21-weakbound', 'Lec21：v(f) ≤ cap(A, B)，推出 ① ⇒ ②', async (tok) => {
  fresh(); buildNet('kt'); flSet(KT17);
  const S = new Set([0, 1, 3]);
  flCut(S, { flow: true });
  const VT = flVal('v(f) = 23 − 6 = 17');
  say('v(f) = f_out(A) − f_in(A)', '23 − 6');
  await beat(tok, 2800);
  txt(VT, 'v(f) ≤ f_out(A) = 23');
  say('f_in(A) ≥ 0：減掉只會變小', 'v(f) ≤ f_out(A) = 23');
  await beat(tok, 3200);
  const c = flCut(S);
  txt(VT, '23 ≤ 10 + 2 + 8 + 10 = ' + c);
  say('每條邊 f ≤ c', 'f_out(A) ≤ cap(A, B) = 30');
  await beat(tok, 3200);
  txt(VT, 'v(f) = 17 ≤ 30 = cap(A, B)');
  say('任何 flow ≤ 任何 cut', 'weak duality');
  await beat(tok, 2800);
  flSet(KT19); flUncolor();
  flCut(new Set([0, 2]), { flow: true });
  txt(VT, 'v(f) = 19 = cap(A, B)');
  say('① ⇒ ②：若 v(f) 等於某個 cut', '已碰到上界 → 一定是 max flow');
  await beat(tok, 3600);
}]);

// 67:59 ③ ⇒ ①：A = G_f 中 s 走得到的點；A→B 滿、B→A 為 0
FRAG.push(['flow-l21-3to1', 'Lec21：③ ⇒ ①，s 可到達的點形成 cut', async (tok) => {
  fresh(); buildNet('kt'); flSet(KT19); renderResidual();
  const VT = flVal('v(f) = 19');
  say('③ ⇒ ①：G_f 沒有 augmenting path', 's 走不到 t');
  await beat(tok, 3000);
  const S = reachS();
  for (let v = 0; v < GR.n; v++) nodeColor(v, S.has(v) ? C.S : C.T, S.has(v) ? 0.3 : 0);
  say('A = G_f 裡 s 走得到的點', 'A = {s, b}，t ∉ A');
  await beat(tok, 3200);
  flCut(S, { flow: true });
  flPaint(2, C.back, 2.6);
  say('B → A 的邊 flow 一定是 0', '否則 G_f 有退水邊可走出去');
  await beat(tok, 3400);
  flPaint(0, C.hot, 2.8); flPaint(5, C.hot, 2.8);
  say('A → B 的邊一定灌滿', '否則 G_f 有 forward edge 可走');
  await beat(tok, 3400);
  txt(VT, 'v(f) = 10 + 9 − 0 = 19 = cap(A, B)');
  say('v(f) = cap(A, B)', '10 + 9 = 19');
  await beat(tok, 3000);
  say('三個敘述互推：定理得證', 'max flow = min cut');
  await beat(tok, 3000);
}]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
    sceneOrder: ['flow-network', 'residual-graph', 'augment-cancel', 'ford-fulkerson', 'ff-bad-case', 'min-cut', 'maxflow-mincut', 'super-source', 'bipartite-matching'].concat(FRAG.map((f) => f[0])),
    stop() { clearTimeout(timer); epoch++; },
  };
}
