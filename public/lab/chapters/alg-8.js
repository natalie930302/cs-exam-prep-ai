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
    for (let l = 0; l < 4; l++) { const deg = 1 + Math.floor(Math.random() * 2); const rs = [0, 1, 2, 3].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]).slice(0, deg); rs.forEach((r) => E.push([l, r])); }
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
      const c = 5 + rnd(10); let f = 1 + rnd(c - 1); if (2 * f === c) f++;
      return { q: '邊 (u, v) 容量 ' + c + '、目前流量 ' + f + '。殘餘網路中 u→v 與 v→u 的殘餘容量分別是？', opts: [(c - f) + ' 和 ' + f, f + ' 和 ' + (c - f), c + ' 和 0', (c - f) + ' 和 0'], ans: (c - f) + ' 和 ' + f, why: '順向還能再推 c − f = ' + (c - f) + '；反向可以把已推的 ' + f + ' 退回。' };
    }
    if (t === 2) {
      const L = 3 + rnd(2), E = [];
      for (let l = 0; l < L; l++) { const rs = [0, 1, 2, 3].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]).slice(0, 1 + rnd(2)); rs.forEach((r) => E.push([l, r])); }
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
const { V3, cube, kill, move, glow, arrow, ghostBox, MONO, step, buddy, travel, remove, anim } = K;
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


// ─── cued playback：每個 await step(tok) 等影片講到那一句才往下（cue 時間在 notes 裡） ───
// step 之間只放短動作（≤ 2.5 s），講完就停住等下一句；不重播、不循環。
const SAY = (t, x, z) => tag(t, 'say', x, 0.3, z);
const NOTE = (t, x, z) => tag(t, 'note', x, 0.3, z);
const GOOD = (t, x, z) => tag(t, 'good', x, 0.3, z);
const BAD = (t, x, z) => tag(t, 'bad', x, 0.3, z);
function at(n) { const p = NG.G.pos[NG.G.names.indexOf(n)]; return V3(p[0], 0.95, p[1]); }
// 一小包水（pkt 標籤）沿著路徑一站一站流過去，到了就消失
async function flPkt(tok, names, text, ms = 1800) {
  const a = at(names[0]);
  const l = tag(text || '水', 'pkt', a.x, a.y, a.z);
  const seg = Math.min(650, ms / (names.length - 1));
  for (let k = 1; k < names.length; k++) await travel(tok, l, at(names[k - 1]), at(names[k]), seg);
  remove(l);
}
// 角落的小計數員：肚子上是目前的總流量
function meter(v, name = '總流量', x = 6.2, z = -3.7) { return buddy(name, v, '#9fd3f0', x, 0, z, 0.75); }
async function cheer(tok, b, v, mood = 'happy') { if (v !== undefined) b.set(v); b.mood(mood); await b.hop(tok); }
// 水龍頭與水桶（Lec20 的比喻）放在 s、t 外側
function tapBucket(sx = -6.5, tx = 6.5, z = -1.9) {
  return { tap: buddy('水龍頭', '', '#8fc6ec', sx, 0, z, 0.7), bucket: buddy('水桶', '', '#f0c987', tx, 0, z, 0.7) };
}

// ════════════════ Iwc3Uj4aaF4：Ford-Fulkerson（英文短片） ════════════════
// 00:09 問題：flow network、capacity、source/sink、兩個限制
FRAG.push(['flow-v1-problem', '短片：flow network 與兩個限制（A → F）', async (tok) => {
  fresh();
  await step(tok);                                   // 9.4 what is the maximum flow problem
  const Q = SAY('問題：從起點最多能送多少「流量」到終點？', 0, -4.3);
  say('Maximum flow problem', '先講問題，再講名詞與演算法');
  await step(tok);                                   // 17.6 a graph that represents a flow network, every edge has a capacity
  buildNet('ffv'); flView();
  say('給一張 flow network', '每條 edge 都有 capacity');
  await step(tok);                                   // 27.2 weighted digraph
  flView(null, new Set([0, 1, 2, 3, 4, 5]));
  const N = NOTE('有方向的加權圖：邊上的數字 = capacity（流量上限）', 0, 4.3);
  say('weighted digraph', '權重 = capacity，flow 不能超過它');
  await step(tok);                                   // 55.5 two vertices: source s and sink t
  flView(); nodeColor(0, C.S, 0.4); nodeTag(0, 'source s'); nodeColor(5, C.T, 0.4); nodeTag(5, 'sink t');
  say('兩個特別的點：source 與 sink', 'flow 從 s 出發、在 t 結束');
  await step(tok);                                   // 77.7 find the maximum possible flow from s to t
  txt(Q, '目標：s 到 t 的最大流量'); await flPkt(tok, ['A', 'C', 'D', 'F'], 'flow');
  say('找 s 到 t 的最大可能 flow', '還要遵守兩個限制');
  await step(tok);                                   // 108.5 constraint 1
  flView(null, new Set([0])); txt(N, '限制 1：A → C 的 flow 只能在 0 到 11 之間');
  say('限制 1：flow 不超過 capacity', 'A → C：0 ≤ f ≤ 11');
  await step(tok);                                   // 124.8 constraint 2: inflow = outflow
  flView(null, new Set([0, 1, 3])); nodeColor(2, C.hot, 0.5); nodeTag(2, '流入 = 流出');
  txt(N, '限制 2：中間的點，流進來多少就流出去多少');
  say('限制 2：inflow = outflow', 'source 與 sink 除外');
  await step(tok);                                   // 141.0 source only out, sink only in
  nodeColor(2, C.white, 0); nodeTag(2, ''); flView(null, new Set([0, 2, 5]));
  nodeTag(0, '只流出'); nodeTag(5, '只流入');
  say('source 只流出、sink 只流入', '所以它們不用守恆');
  await step(tok);                                   // 171.0 this is the network: A is source, F is sink
  flView(); nodeTag(0, 'A = source'); nodeTag(5, 'F = sink');
  txt(N, '影片的例子：A 出發，F 結束');
  say('例子：A 是 source、F 是 sink', '');
  await step(tok);                                   // 188.8 a digraph: head and tail for each edge
  await flPkt(tok, ['C', 'B', 'E'], '→', 1000);
  txt(N, '每條 edge 都有箭頭：只能從尾巴流向箭頭');
  say('每條 edge 都有方向', 'tail → head');
}]);

// 03:18 residual capacity、bottleneck：A → C → D → F 送 9
FRAG.push(['flow-v1-acdf', '短片：A → C → D → F，bottleneck 9', async (tok) => {
  fresh(); buildNet('ffv'); flView();
  const M = meter(0);
  const N = NOTE('', 0, 4.3);
  await step(tok);                                   // 198.8 terminologies: residual graph
  txt(N, 'residual = 剩下的：還能再加多少 flow');
  say('名詞 1：residual graph', '記錄還能再加多少 flow');
  await step(tok);                                   // 210.8 a path source → sink with leftover → can add flow
  flView(null, new Set([0, 1, 2])); await flPkt(tok, ['A', 'C', 'D', 'F'], '還有空間？');
  say('s 到 t 有路、每段都還有剩', '就還能沿這條路加 flow');
  await step(tok);                                   // 235.4 residual capacity = capacity − flow
  flView(); txt(N, 'residual capacity = 原本的 capacity − 目前的 flow');
  say('residual capacity', '= capacity − flow');
  await step(tok);                                   // 251.8 "minimal cut" = bottleneck capacity
  txt(N, 'bottleneck：一條路最多能送多少（影片叫它 minimal cut）');
  say('名詞 2：bottleneck capacity', '決定一條路最多送多少');
  await step(tok);                                   // 273.5 consider path A C D F
  flView(null, new Set([0, 1, 2]));
  say('看路徑 A → C → D → F', '');
  await step(tok);                                   // 287.5 capacities 11, 9, 11
  flView((i, c) => 'c = ' + c, new Set([0, 1, 2]));
  say('三段的 capacity：11、9、11', '');
  await step(tok);                                   // 298.8 max flow on this path is 9
  flPaint(1, C.sat, 2.8); nodeTag(2, '最窄的一段');
  say('最多只能送 9：bottleneck', 'min(11, 9, 11) = 9');
  await step(tok);                                   // 305.6 giving a flow of 9
  nodeTag(2, '');
  await flPkt(tok, ['A', 'C', 'D', 'F'], '+9');
  flSet([9, 9, 9, 0, 0, 0]); renderFlow(new Set([0, 1, 2])); await cheer(tok, M, 9);
  say('沿這條路送 9', '9/11、9/9、9/11');
  await step(tok);                                   // 315.0 residual capacities 2, 0, 2
  flView((i, c, f) => String(c - f), new Set([0, 1, 2]));
  say('residual：11−9=2、9−9=0、11−9=2', '中間那段已經滿了');
  await step(tok);                                   // 340.0 the graph obtained is the residual graph
  flView((i, c, f) => String(c - f));
  txt(N, '每條邊標「還剩多少」的圖 = residual graph');
  say('剩下的容量構成 residual graph', '');
}]);

// 06:00 A → C → B → E → F 再送 2；augmenting path 的兩種邊
FRAG.push(['flow-v1-acbef', '短片：A → C → B → E → F 再送 2，flow = 11', async (tok) => {
  fresh(); buildNet('ffv'); flSet([9, 9, 9, 0, 0, 0]); renderFlow();
  const M = meter(9);
  const N = NOTE('', 0, 4.3);
  await step(tok);                                   // 359.4 still some capacity: path A C B E F
  flView((i, c, f) => String(c - f), new Set([0, 3, 4, 5]));
  say('還有剩：再看 A → C → B → E → F', '');
  await step(tok);                                   // 374.6 residual 2, capacity 10, 9, 2
  txt(N, '沿路還剩：2、10、9、2');
  say('沿路剩下：2、10、9、2', '');
  await step(tok);                                   // 389.5 bottleneck 2
  flPaint(0, C.sat, 2.8); flPaint(5, C.sat, 2.8);
  txt(N, 'bottleneck = min(2, 10, 9, 2) = 2');
  say('這條路的 bottleneck = 2', '');
  await step(tok);                                   // 400.8 make it 11, 2, 2, 2
  await flPkt(tok, ['A', 'C', 'B', 'E', 'F'], '+2');
  flSet([11, 9, 9, 2, 2, 2]); renderFlow(new Set([0, 3, 4, 5])); await cheer(tok, M, 11);
  txt(N, 'flow = 9 + 2 = 11');
  say('再送 2：A → C 變 11/11', '已經很滿了');
  await step(tok);                                   // 415.5 augmenting path can be done in two ways
  renderFlow(); txt(N, 'augmenting path 可以用兩種邊');
  say('augmenting path 有兩種邊', '');
  await step(tok);                                   // 424.4 non-full forward edges
  flSet([9, 9, 9, 0, 0, 0]); renderFlow(new Set([0])); txt(N, '① 沒滿的順向邊：A → C 原本 9/11，還能加');
  say('① non-full forward edges', '順著方向、還沒滿的邊');
  await step(tok);                                   // 434.3 non-empty backward edges
  flSet([11, 9, 9, 2, 2, 2]); renderResidual();
  txt(N, '② 有流量的反向邊（紫色）：可以把流退回去');
  say('② non-empty backward edges', '下一支影片舉例');
}]);

// 07:24 演算法三步驟：flow 0 → 9 → 11
FRAG.push(['flow-v1-algo', '短片：Ford-Fulkerson 三步驟（0 → 9 → 11）', async (tok) => {
  fresh([0, 13.5, 9], [0, 0, 0.8]); buildNet('ffv'); renderFlow();
  const P = flCode(['1. flow ← 0', '2. while 有 augmenting path:', '3.     flow ← flow + path flow', '4. return flow（最大流）'], 0, 3.6);
  const M = meter(0);
  const VT = tag('', 'ptr alt', -5.4, 0.3, -3.6);
  await step(tok);                                   // 444.3 Ford-Fulkerson: three steps
  say('Ford-Fulkerson：三個步驟', '');
  await step(tok);                                   // 456.2 step 1: initial flow 0
  P.hl(0); txt(VT, 'flow = 0');
  say('Step 1：一開始 flow = 0', '');
  await step(tok);                                   // 464.3 then we made a flow of 9
  flSet([9, 9, 9, 0, 0, 0]); renderFlow(new Set([0, 1, 2])); txt(VT, 'flow：0 → 9'); await cheer(tok, M, 9);
  say('剛才先送了 9', '');
  await step(tok);                                   // 468.2 then 2 → 11
  flSet([11, 9, 9, 2, 2, 2]); renderFlow(new Set([0, 3, 4, 5])); txt(VT, 'flow：0 → 9 → 11'); await cheer(tok, M, 11);
  say('再送 2，變成 11', '一路往上加');
  await step(tok);                                   // 483.6 while there is an augmenting path
  P.hl(1); flSet([0, 0, 0, 0, 0, 0]); renderFlow(new Set([0, 1, 2])); M.set(0); M.mood('calm'); txt(VT, 'flow = 0');
  say('Step 2：還有 augmenting path 就做', '例如 A → C → D → F');
  await step(tok);                                   // 492.0 add this path flow to flow: 0 + 9
  P.hl(2); flSet([9, 9, 9, 0, 0, 0]); renderFlow(new Set([0, 1, 2])); txt(VT, 'flow = 0 + 9 = 9'); await cheer(tok, M, 9);
  say('把 path flow 加進 flow', '0 + 9 = 9');
  await step(tok);                                   // 503.1 then 2: 9 + 2 = 11
  flSet([11, 9, 9, 2, 2, 2]); renderFlow(new Set([0, 3, 4, 5])); txt(VT, 'flow = 9 + 2 = 11'); await cheer(tok, M, 11);
  say('再加 2', '9 + 2 = 11');
  await step(tok);                                   // 506.8 until no augmenting path
  P.hl(1); renderFlow(); M.mood('wow');
  say('一直做，直到找不到 augmenting path', '');
  await step(tok);                                   // 518.8 return the current flow = max flow
  P.hl(3); txt(VT, '回傳 11 = 最大流');
  await cheer(tok, M, 11);
  say('回傳目前的 flow', '它就是 maximum flow');
}]);

// ════════════════ lY1SKWSR3pk：江蕙如 Lec20 Network Flow (1/2) ════════════════
// 只把 residual graph 中符合條件的邊標亮
const rhl = (pred) => renderResidual(residualEdges().filter(pred));
function cutLine(x) { return flSeg(x, -3.9, x, 3.9, '#c0392b'); }
const unLine = (l) => { if (l) lab.world.remove(l); };

// 01:37 應用：水管、運輸、電腦網路、電路；1955 蘇聯鐵路 163,000
FRAG.push(['flow-l20-apps', 'Lec20：flow network 的應用與 1955 鐵路問題', async (tok) => {
  fresh();
  const items = [['水管', 'water pipes'], ['運輸', 'transportation'], ['網路', 'packets'], ['電路', 'current']];
  const cs = [];
  const show = (i) => { const x = -4.5 + 3 * i; cs.push(cube(items[i][0], '#cfe0f0', [1.5, 0.8, 1.2], x, 0.4, -2.0, 3)); tag(items[i][1], 'idx', x, 0.3, -0.9); };
  await step(tok);                                   // 97.5 flow network: a special graph
  const T = SAY('flow network：一種特別的 graph', 0, -4.3);
  const ln = flSeg(-4.5, -3.4, 4.5, -3.4, '#8fc6ec');
  say('今天的主角：flow network', '');
  await step(tok);                                   // 116.8 imagine some material flowing in it
  const d = tag('流動的東西', 'pkt', -4.5, 0.6, -3.4);
  await travel(tok, d, V3(-4.5, 0.6, -3.4), V3(4.5, 0.6, -3.4), 1600);
  say('圖裡有東西在流動', '就形成 flow network');
  await step(tok);                                   // 130.8 water pipes
  remove(d); show(0); glow(cs[0], '#6a4a00');
  say('最直覺：水管網路', '管子裡流的是水');
  await step(tok);                                   // 160.8 transportation network
  glow(cs[0], null); show(1); glow(cs[1], '#6a4a00');
  say('transportation network', '交通運輸，運輸管理系很常用');
  await step(tok);                                   // 194.2 computer network: packets
  glow(cs[1], null); show(2); glow(cs[2], '#6a4a00');
  say('computer network', '資料切成 packets 在網路線上流');
  await step(tok);                                   // 216.8 circuit network: current
  glow(cs[2], null); show(3); glow(cs[3], '#6a4a00');
  say('circuit network', '導線裡流的是電流');
  await step(tok);                                   // 254.8 1955: Soviet Union → Eastern Europe
  glow(cs[3], null); txt(T, '1955 年：蘇聯每天要把工人運到東歐');
  cube('蘇聯', '#e9d6b0', [1.4, 0.8, 1.2], -5, 0.4, 2.4, 3); cube('東歐', '#d6e9c8', [1.4, 0.8, 1.2], 5, 0.4, 2.4, 3);
  const w = buddy('工人', '', '#f4a56a', -5, 0.8, 4.2, 0.6);
  say('1955：蘇聯運工人到東歐', '鐵路夠不夠用？');
  await step(tok);                                   // 299.8 a big railway network
  [[-1.6, 1.5], [-1.6, 3.4], [1.6, 1.5], [1.6, 3.4]].forEach(([x, z]) => cube(null, '#bbb', [0.4, 0.4, 0.4], x, 0.2, z, 2));
  [[-5, 2.4, -1.6, 1.5], [-5, 2.4, -1.6, 3.4], [-1.6, 1.5, 1.6, 1.5], [-1.6, 3.4, 1.6, 3.4], [-1.6, 1.5, 1.6, 3.4], [1.6, 1.5, 5, 2.4], [1.6, 3.4, 5, 2.4]]
    .forEach(([a, b, c, e]) => flSeg(a, b, c, e));
  say('鐵路網 = transportation network', '');
  await step(tok);                                   // 321.8 edges have no direction
  NOTE('鐵路沒有方向：可以運去也可以運回', 0, 0.6);
  say('這裡的鐵路沒有方向性', '可以運出去、也可以運回來');
  await step(tok);                                   // 337.8 each segment records how many people it can carry
  NOTE('每段：能運多少人次 = capacity', 0, 4.6);
  say('每段鐵路能運多少人次', '= capacity');
  await step(tok);                                   // 372.8 maximum ≈ 163,000
  tag('最大運輸量 ≈ 163,000（原始研究：每天的噸數）', 'ptr alt', 0, 0.3, 0.3);
  await travel(tok, w.g, V3(-5, 0.8, 4.2), V3(5, 0.8, 4.2), 1600); w.mood('happy');
  say('算出整個網路的最大運輸量', '約 163,000（老師說人次；原研究是噸）');
}]);

// 06:49 定義：directed graph、capacity、source 水龍頭、sink 水桶、internal node
FRAG.push(['flow-l20-def', 'Lec20：flow network 的定義（水龍頭與水桶）', async (tok) => {
  fresh();
  const N = NOTE('', 0, 4.3);
  await step(tok);                                   // 408.4 what is a flow network: a graph
  buildNet('lsm'); flView();
  say('Flow network 是一個 graph', '');
  await step(tok);                                   // 420.8 undirected = two opposite edges
  flView(null, null, new Set([2])); addEdge(1, 2, '', 0.16, C.edge, 1.2); addEdge(2, 1, '', 0.16, C.back, 1.2);
  txt(N, '沒有方向的邊 = 兩條相反方向的邊');
  say('沒方向的邊 = 兩條反向的邊', '');
  await step(tok);                                   // 437.7 so a flow network is a directed graph
  flView(); txt(N, 'flow network 是 directed graph（有向圖）');
  say('Flow network 是 directed graph', '');
  await step(tok);                                   // 446.8 plus capacity
  flView((i, c) => 'c = ' + c); txt(N, '多了 capacity：每條邊的流量上限');
  say('比一般有向圖多了 capacity', '');
  await step(tok);                                   // 478.8 each edge is a pipe; too much water bursts it
  flView(null, new Set([2])); const B = BAD('超過 3 就爆管！', 1.5, 0);
  say('每條 edge = 一段水管', 'capacity = 水管粗細');
  await step(tok);                                   // 495.7 two special vertices: source s, sink t
  remove(B); flView();
  nodeColor(0, C.S, 0.4); nodeColor(3, C.T, 0.4); nodeTag(0, 'source s'); nodeTag(3, 'sink t');
  say('兩個特別的點：source s、sink t', '');
  await step(tok);                                   // 513.8 internal nodes
  nodeColor(1, C.hot, 0.4); nodeColor(2, C.hot, 0.4); nodeTag(1, 'internal'); nodeTag(2, 'internal');
  say('中間的點叫 internal node', '');
  await step(tok);                                   // 520.8 source generates flow: a tap
  nodeColor(1, C.white, 0); nodeColor(2, C.white, 0); nodeTag(1, ''); nodeTag(2, '');
  const tb = tapBucket(); tb.tap.mood('happy');
  say('source 產生 flow：水龍頭', '');
  await step(tok);                                   // 536.8 sink only receives: a bucket
  tb.bucket.mood('wow');
  say('sink 只接收：水桶', '');
  await step(tok);                                   // 562.8 water follows the edge direction
  await flPkt(tok, ['s', 'a', 't'], '水');
  txt(N, '水只能順著箭頭方向流');
  say('要順著 edge 的方向推水', '');
  await step(tok);                                   // 572.8 can flow both ways → build both edges
  addEdge(2, 1, '', 0.22, C.back, 1.2);
  txt(N, '可以來回流？那就建兩條反方向的 edge');
  say('可以雙向流就建雙向的 edge', '');
  await step(tok);                                   // 610.8 max total flow through the network?
  flView(); txt(N, '問題：整個網路最多能流過多少水？');
  say('問題：最多能流多少水？', '');
  await step(tok);                                   // 618.8 how far the tap opens = how much the bucket gets
  tb.tap.mood('wow'); tb.bucket.mood('wow'); await tb.tap.hop(tok);
  txt(N, '水龍頭最大能開多大 ＝ 水桶每單位時間最多收多少');
  say('水龍頭開多大 = 水桶收多少', '兩種看法一樣');
}]);

// 10:40 先往上推 2：s → a → b → t（2、3、2）
FRAG.push(['flow-l20-push2', 'Lec20：先沿 s → a → b → t 推 2 單位', async (tok) => {
  fresh(); buildNet('lsm'); flView();
  const tb = tapBucket(); tb.bucket.set(0);
  const N = NOTE('', 0, 4.3);
  await step(tok);                                   // 640.0 at first the tap is closed, pipes are empty
  renderFlow(); txt(N, '每條邊標 flow / capacity，現在全是 0');
  say('一開始水龍頭關緊', '管線全空');
  await step(tok);                                   // 663.8 where can the water go? up or down
  flView(null, new Set([0, 1])); tb.tap.mood('wow');
  say('水從 s 出來，可以往上或往下', '');
  await step(tok);                                   // 679.6 go up: capacities 2, 3, 2
  flView(null, new Set([0, 2, 4]));
  say('往上流：s → a → b → t', 'capacity：2、3、2');
  await step(tok);                                   // 691.5 this chain carries at most 2
  txt(N, '這一串最多推 min(2, 3, 2) = 2');
  say('這一串最多推 2 單位', '');
  await step(tok);                                   // 698.6 push it down
  await flPkt(tok, ['s', 'a', 'b', 't'], '+2');
  flSet([2, 0, 2, 0, 2]); renderFlow(new Set([0, 2, 4])); tb.bucket.set(2);
  say('推 2 單位下去', 's→a 2/2、a→b 2/3、b→t 2/2');
  await step(tok);                                   // 703.8 more would burst
  flPaint(0, C.sat, 2.8); flPaint(4, C.sat, 2.8); txt(N, '再多就爆管：s → a、b → t 滿了');
  say('再多就會爆管', '');
  await step(tok);                                   // 721.9 this network provides 2 units for now
  renderFlow(); await cheer(tok, tb.bucket, 2);
  txt(N, '目前水桶收到 2 單位');
  say('目前可以送 2 單位到水桶', '');
}]);

// 12:08 undo flow：s → b → a → t，a → b 從 2 退成 1，總共 3
FRAG.push(['flow-l20-undo', 'Lec20：undo flow，a → b 退回 1，總量 3', async (tok) => {
  fresh(); buildNet('lsm'); flSet([2, 0, 2, 0, 2]); renderFlow();
  const tb = tapBucket(); tb.bucket.set(2);
  const N = NOTE('', 0, 4.3);
  let X = null;
  await step(tok);                                   // 729.2 can we push more?
  txt(N, '還能再推更多水嗎？');
  say('還能再推更多水嗎？', '大家都點頭');
  await step(tok);                                   // 745.8 student: s → b, …, a → t
  renderFlow(new Set([1, 3]));
  say('同學：從 s 送到 b、a 送到 t', '那 a 的水從哪來？');
  await step(tok);                                   // 796.8 we push along each pipe's direction
  renderFlow(new Set([2]));
  say('每段水管要順著方向灌水', '');
  await step(tok);                                   // 802.6 a → b only from a to b, not back
  X = BAD('b → a 逆流？', 1.4, 0);
  say('a → b 只能由 a 灌到 b', '不能由 b 灌回 a');
  await step(tok);                                   // 828.8 if empty: s → b → a → t?
  flSet([0, 0, 0, 0, 0]); renderFlow(new Set([1, 3])); flPaint(2, C.back, 2.2); tb.bucket.set(0);
  say('如果一開始是空的', '可以 s → b → a → t 嗎？');
  await step(tok);                                   // 840.4 no — but s → b → t is fine
  txt(X, '空管：不能逆流 ✗'); renderFlow(new Set([1, 4]));
  say('空管時不行', '只能順著灌，例如 s → b → t');
  await step(tok);                                   // 849.2 back to our flow: s → b can take 1 unit
  remove(X); X = null; flSet([2, 0, 2, 0, 2]); renderFlow(new Set([1])); tb.bucket.set(2);
  say('回到現在：s → b 還能灌 1', '');
  await step(tok);                                   // 858.8 the trouble: can b → a go backwards?
  flPaint(2, C.back, 2.4); X = NOTE('b → a 能倒過來嗎？', 1.6, 0);
  say('麻煩在 b → a', '能不能倒過來灌？');
  await step(tok);                                   // 877.6 one more unit from below: it works
  remove(X); X = null;
  await flPkt(tok, ['s', 'b', 'a', 't'], '+1');
  say('其實可以：從下面多送 1 單位', 's → b → a → t');
  await step(tok);                                   // 895.2 cancellation: a → b already carries water down
  addEdge(2, 1, '往上 1', 0.25, C.back, 1.6);
  say('a → b 已經有 2 往下流', '往上送 1 會互相抵消');
  await step(tok);                                   // 911.8 undo flow
  X = GOOD('undo flow：把水退回去', 1.8, 0);
  say('這叫 undo flow', '把水退回去');
  await step(tok);                                   // 918.8 down 2, up 1 → only 1 flows down
  flSet([2, 1, 1, 1, 2]); renderFlow(new Set([1, 2, 3])); await cheer(tok, tb.bucket, 3);
  say('往下 2、往上 1', '實際 2 − 1 = 1 往下流');
  await step(tok);                                   // 939.8 legal; allowed in every flow network
  txt(N, '合法！任何 flow network 都允許 undo flow');
  say('這是合法的', '有退水機制就不會卡住');
  await step(tok);                                   // 969.8 precondition: there must be water to undo
  txt(N, '前提：管內原本要有水；沒水就不能送反方向');
  say('前提：管內要有水才能退', '最多退回原本的量');
  await step(tok);                                   // 989.0 maximum network flow: as much as possible
  remove(X); X = null; txt(N, 'maximum network flow：灌的水越多越好');
  say('maximum network flow', '求能灌的最大水量');
  await step(tok);                                   // 1012.8 all full, can't pour more
  renderFlow(); [0, 1, 3, 4].forEach((i) => flPaint(i, C.sat, 2.6));
  say('全部灌滿了', '再也灌不下去');
  await step(tok);                                   // 1029.8 value: source sends 2 + 1 = 3
  renderFlow(); flPaint(0, C.hot, 2.6); flPaint(1, C.hot, 2.6); nodeTag(0, '送出 2 + 1 = 3');
  say('看水龍頭：送出 2 + 1 = 3', '');
  await step(tok);                                   // 1044.8 sink receives 1 + 2 = 3, always equal
  renderFlow(); flPaint(3, C.hot, 2.6); flPaint(4, C.hot, 2.6); nodeTag(0, ''); nodeTag(3, '收到 1 + 2 = 3');
  await cheer(tok, tb.bucket, 3);
  say('看水桶：收到 1 + 2 = 3', '兩邊一定一樣');
}]);

// 17:33 f/c 標示、f : E → ℝ≥0、v(f) = source 送出 = sink 收到
FRAG.push(['flow-l20-value', 'Lec20：f/c 標示與 flow value v(f) = 3', async (tok) => {
  fresh(); buildNet('lsm'); flSet([2, 1, 1, 1, 2]); flView();
  const N = NOTE('', 0, 4.3);
  let VT = null;
  await step(tok);                                   // 1052.8 the pipe picture ↔ its flow network
  renderFlow(); txt(N, '上面的水管圖 ↔ 這張 flow network');
  say('之後都用這種表示法', '');
  await step(tok);                                   // 1064.8 source s, sink t, internal nodes, directed
  nodeTag(0, 'source'); nodeTag(3, 'sink'); nodeTag(1, 'internal'); nodeTag(2, 'internal');
  say('source、sink、internal node', '有向圖');
  await step(tok);                                   // 1074.6 two numbers on every edge
  [0, 1, 2, 3].forEach((v) => nodeTag(v, ''));
  txt(N, '每條邊兩個數字：f / c');
  say('每條 edge 標兩個數字', '');
  await step(tok);                                   // 1077.8 the capacity: given in advance
  flView((i, c) => '□/' + c); txt(N, '後面那個：capacity c（一開始就給定）');
  say('後面是 capacity', '水管的上限，題目給定');
  await step(tok);                                   // 1087.7 the front number: the flow
  renderFlow(); txt(N, '前面那個：flow f（某一刻管裡流的水）');
  say('前面是 flow', '任何時刻管裡的水量');
  await step(tok);                                   // 1111.9 a variable v: value
  VT = flVal('v(f) = ?');
  say('v 代表 value', '這種灌法的總水量');
  await step(tok);                                   // 1133.5 this way of pouring is f, value 3
  txt(VT, 'v(f) = 2 + 1 = 3');
  say('這種灌法叫 f', 'v(f) = 2 + 1 = 3');
  await step(tok);                                   // 1154.8 s-t flow f maps edges to real numbers
  flView((i, c, f) => 'f = ' + f); txt(N, 'f：每條 edge → 一個實數（流量）');
  say('s-t flow f：E → 實數', '');
  await step(tok);                                   // 1172.8 must be ≥ 0
  const B = BAD('f = −1 ✗ 不能是負的', 0, -4.3);
  say('flow 一定 ≥ 0', '頂多不灌，不能是負的');
  await step(tok);                                   // 1188.9 every edge gets a value
  remove(B); flView((i, c, f) => 'f = ' + f, new Set([0, 1, 2, 3, 4]));
  say('每條 edge 都要給值', '完整的 assignment');
  await step(tok);                                   // 1208.4 value of f: what the source sends out
  renderFlow(); flPaint(0, C.hot, 2.6); flPaint(1, C.hot, 2.6); nodeColor(0, C.hot, 0.4);
  txt(VT, 'v(f) = source 送出 = 2 + 1 = 3');
  say('v(f)：source 送出的總和', '2 + 1 = 3');
  await step(tok);                                   // 1233.8 also what the sink receives
  renderFlow(); flUncolor(); flPaint(3, C.hot, 2.6); flPaint(4, C.hot, 2.6); nodeColor(3, C.hot, 0.4);
  txt(VT, 'sink 收到 = 1 + 2 = 3');
  say('也等於 sink 收到的', '1 + 2 = 3');
  await step(tok);                                   // 1247.8 if they differ: a burst or water from nowhere
  renderFlow(); flUncolor(); txt(N, '不相等 ＝ 漏水或無中生有，不合理');
  say('兩個一定相等', '不等就是爆管或無中生有');
}]);

// 22:39 capacity constraint 與 conservation（KCL）
FRAG.push(['flow-l20-constraints', 'Lec20：capacity constraint 與 conservation', async (tok) => {
  fresh(); buildNet('lsm'); flSet([2, 1, 1, 1, 2]); flView();
  const N = NOTE('', 0, 4.3);
  const VT = flVal('');
  await step(tok);                                   // 1362.8 goal: the maximum flow value
  txt(VT, '目標：最大的 v(f)');
  say('目標：找最大 flow 的值', '');
  await step(tok);                                   // 1369.8 every edge's flow and the total
  renderFlow(); txt(VT, '要回報：每條邊的 f，以及總量 v(f) = 3');
  say('也要給出每條 edge 的 flow', '');
  await step(tok);                                   // 1378.6 must satisfy two hard constraints
  txt(N, '兩個 hard constraint：違反就是 illegal（不合法）');
  say('一定要符合兩個 constraint', '違反就不合法');
  await step(tok);                                   // 1394.8 capacity constraint
  renderFlow(new Set([0, 1, 2, 3, 4])); txt(N, '① capacity constraint：f(e) ≤ c(e)');
  say('① capacity constraint', '灌的水不能超過容量');
  await step(tok);                                   // 1412.5 and never negative
  txt(N, '① 0 ≤ f(e) ≤ c(e)：不能爆、也不能是負的');
  say('也不能是負的', '0 ≤ f(e) ≤ c(e)');
  await step(tok);                                   // 1424.8 conservation: like KCL
  renderFlow(); txt(N, '② conservation：像電路學的 KCL（電流守恆）');
  say('② flow conservation', '電路學的 KCL');
  await step(tok);                                   // 1445.8 any internal node; s and t excluded
  nodeColor(0, C.dim, 0); nodeColor(3, C.dim, 0); nodeTag(0, '不算'); nodeTag(3, '不算');
  say('看任何一個 internal node', 'source、sink 不算');
  await step(tok);                                   // 1458.8 inflow = outflow
  nodeColor(1, C.hot, 0.5); nodeTag(1, '進 2 = 出 1 + 1'); nodeColor(2, C.hot, 0.5); nodeTag(2, '進 1 + 1 = 出 2');
  say('流進 = 流出', 'a：2 = 2；b：2 = 2');
  await step(tok);                                   // 1466.6 inflow > outflow: a leak
  flUncolor(); [0, 1, 2, 3].forEach((v) => nodeTag(v, ''));
  nodeColor(1, C.sat, 0.4); nodeTag(1, '進 > 出：漏水！');
  say('流進 > 流出', '水管破了在漏水');
  await step(tok);                                   // 1474.3 inflow < outflow: from nowhere
  nodeColor(2, C.sat, 0.4); nodeTag(2, '進 < 出：無中生有！');
  say('流進 < 流出', '無中生有，都不合法');
}]);

// 25:04 cut 給 upper bound：4 + 8 + 9 = 21、10 + 10 = 20
FRAG.push(['flow-l20-cuts', 'Lec20：切一刀得 upper bound（21、20）', async (tok) => {
  fresh();
  const N = NOTE('', 0, 4.3);
  await step(tok);                                   // 1497.0 step back: maximization
  const g = buddy('flow', '?', '#9fd3f0', 0, 0, 1.6, 0.9);
  txt(N, '最大化問題：flow 越大越好');
  say('先退一步想：最大化問題', '');
  await step(tok);                                   // 1529.0 is there an upper bound?
  const ub = flSeg(-3.5, -1.2, 3.5, -1.2, '#c0392b'); const ut = tag('upper bound（上界）', 'bad', 4.6, 0.3, -1.2);
  g.mood('wow');
  say('它有沒有 upper bound？', '有的話就不會無限長大');
  await step(tok);                                   // 1558.8 the tighter the better
  await anim(tok, 1200, (u) => { ub.position.z = 1.4 * u; ut.position.z = -1.2 + 1.4 * u; });
  g.mood('happy');
  say('upper bound 越緊越好', '越接近最佳值');
  await step(tok);                                   // 1583.8 an example: capacities on the edges
  fresh(); buildNet('kt'); flView();
  txt(tag('', 'note', 0, 0.3, 4.3), '邊上標的是 capacity');
  say('新例子：邊上是 capacity', '想辦法灌越多越好');
  await step(tok);                                   // 1606.8 the inside may be complicated
  flView(null, new Set([2, 3, 4, 5, 6]));
  say('中間的管線可能很複雜', '但不管怎樣……');
  await step(tok);                                   // 1625.8 any flow s → t crosses a cross-section
  flView(); const L = cutLine(0);
  const sc = tag('剪一刀', 'pkt', 0, 0.6, -3.9);
  await travel(tok, sc, V3(0, 0.6, -3.9), V3(0, 0.6, 3.9), 1400); remove(sc);
  say('隨便剪一刀', '水一定會經過這個截面');
  await step(tok);                                   // 1656.8 source on one side, sink on the other
  flCut(new Set([0, 1, 2]));
  say('s 在一側、t 在另一側', '同一側沒有意義');
  await step(tok);                                   // 1691.8 the cut pipes each have a limit
  const N2 = NOTE('截面上的水管：最多灌滿，不能超過', 0, 4.3);
  say('切到的水管都有上限', '最多就是灌滿');
  await step(tok);                                   // 1729.3 4 + 8 + 9 = 21: an upper bound
  txt(N2, '4 + 8 + 9 = 21：flow 不可能超過 21');
  say('切到 4、8、9：最多 21', '21 是一個 upper bound');
  await step(tok);                                   // 1769.8 any cut is an upper bound
  say('任何一刀都形成一個 cut', '每個 cut 都是 upper bound');
  txt(N2, '每一刀都是一個 upper bound，能不能更緊？');
  await step(tok);                                   // 1793.8 cut 10 + 10 = 20
  unLine(L); const L2 = cutLine(-3.6); flCut(new Set([0]));
  txt(N2, '10 + 10 = 20：比 21 更緊');
  say('這樣切：10 + 10 = 20', '比 21 更緊');
  await step(tok);                                   // 1840.8 pick the tightest: minimum capacity
  txt(N2, '在所有 cut 裡挑容量總和最小的：min cut');
  say('挑最緊的那一個', 'capacity 總和最小 = min cut');
  await step(tok);                                   // 1862.8 the smallest upper bound is achievable
  unLine(L2); txt(N2, 'max flow ＝ min cut（下次證明）');
  say('最小的 upper bound 剛好達得到', 'max-flow min-cut theorem');
}]);

// 31:49 斜切：s→a、a→b（反向）、b→d → 10 + 9 = 19
FRAG.push(['flow-l20-cutdiag', 'Lec20：斜切，反向邊不算（10 + 9 = 19）', async (tok) => {
  fresh(); buildNet('kt'); flView();
  const N = NOTE('', 0, 4.3);
  let c = 0;
  await step(tok);                                   // 1930.4 a diagonal cut: s→a, a→b, b→d
  c = flCut(new Set([0, 2]));
  say('斜切：切到 s→a、a→b、b→d', '');
  await step(tok);                                   // 1943.8 earlier cuts: all edges left → right
  txt(N, '剛才的切法：切到的邊都從 s 那側流向 t 那側');
  say('剛才的切法都很順', '邊都從左流到右');
  await step(tok);                                   // 1961.8 in general some edges come back from the sink side
  flPaint(2, C.back, 2.6); nodeTag(1, 'a 在 t 這側');
  txt(N, 'a → b（紫色）是從 t 那側倒流回來的邊');
  say('一般會切到反向的邊', '從 sink 側倒回 source 側');
  await step(tok);                                   // 1975.8 forward edges: fill them
  nodeTag(1, ''); flPaint(0, C.sat, 2.8); flPaint(5, C.sat, 2.8);
  say('順方向（forward）的邊', '希望灌得越滿越好');
  await step(tok);                                   // 1989.8 the backward edge: no water
  flPaint(2, C.dim, 1.2); txt(N, '反方向的邊：希望它不灌水（灌了等於把水送回來）');
  say('反方向的邊希望不要灌水', '');
  await step(tok);                                   // 2004.8 bound = 10 + 9, the 2 doesn't count
  txt(N, '這一刀：10 + 9 = ' + c + '，那條 2 不算');
  say('只算 forward：10 + 9 = ' + c, '2 不要算');
  await step(tok);                                   // 2030.8 the optimum here is 19
  const VT = flVal('最佳解 = 19');
  say('這個例子的最佳解就是 19', '');
}]);

// 34:00 Ford-Fulkerson 的想法：greedy + undo，在 G 與 G_f 之間交替
FRAG.push(['flow-l20-ffidea', 'Lec20：Ford-Fulkerson，在 G 與 G_f 之間交替', async (tok) => {
  fresh(); buildNet('lsm'); flView();
  const T1 = flVal('');
  let fo = null, fu = null;
  await step(tok);                                   // 2040.8 the famous algorithm: Ford-Fulkerson
  fo = buddy('Ford', '', '#8fc6ec', -6.3, 0, -3.6, 0.7); fu = buddy('Fulkerson', '', '#f0c987', 6.3, 0, -3.6, 0.7);
  fo.mood('happy'); fu.mood('happy');
  txt(T1, 'Ford = Bellman-Ford 的那位 Ford');
  say('Ford-Fulkerson 演算法', 'Ford 就是 Bellman-Ford 的 Ford');
  await step(tok);                                   // 2087.5 starting point: greedy along edges
  await flPkt(tok, ['s', 'a', 'b', 't'], '+2');
  flSet([2, 0, 2, 0, 2]); renderFlow(new Set([0, 2, 4])); txt(T1, 'greedy：順著邊把水送出去');
  say('出發點：greedy', '順著 edge 方向送水');
  await step(tok);                                   // 2118.8 plus undo: more possibilities
  addEdge(2, 1, '可退 2', 0.25, C.back, 1.6); await fo.hop(tok);
  txt(T1, '+ 退水（undo flow）：多出灌水的機會');
  say('有水的管子可以退水', 'undo flow 提供更多可能');
  await step(tok);                                   // 2140.0 the original flow network
  renderFlow(); txt(T1, 'G：原來的 flow network');
  say('這是原來的 flow network G', '');
  await step(tok);                                   // 2172.4 build a residual graph
  renderResidual(); txt(T1, 'G_f：residual graph，記錄每條邊還能灌多少');
  await fu.hop(tok);
  say('另外建一張 residual graph', '記錄還剩多少灌水能力');
  await step(tok);                                   // 2210.8 each iteration: pour in G_f, update G
  const p = flPath(['s', 'b', 'a', 't']); renderResidual(p); txt(T1, '在 G_f 上灌水');
  await beat(tok, 900);
  augment(p); renderFlow(new Set([1, 2, 3])); txt(T1, '更新 G → 再建 G_f → …');
  await beat(tok, 900);
  renderResidual();
  say('每一輪：在 G_f 灌水、更新 G', '兩張圖交替操作');
}]);

// 37:08 建 G_f：forward = c − f、backward = f
FRAG.push(['flow-l20-residual', 'Lec20：一條一條建出 residual graph G_f', async (tok) => {
  fresh(); buildNet('lsm'); renderFlow();
  const T1 = flVal('flow network G');
  const N = NOTE('', 0, -4.3);
  const R = () => residualEdges();
  const both = (r) => R().some((q) => q.u === r.v && q.v === r.u);
  const put = (pred) => R().filter(pred).forEach((r) => addEdge(r.u, r.v, fB(r.cap), both(r) ? 0.14 : 0, r.dir > 0 ? C.edge : C.back, 1.8));
  await step(tok);                                   // 2230.0 the same example, empty at first
  say('一樣是剛剛的例子', '這是一開始的 flow network');
  await step(tok);                                   // 2237.8 we poured 2, then 1 that undid water
  await flPkt(tok, ['s', 'a', 'b', 't'], '+2', 1100); flSet([2, 0, 2, 0, 2]); renderFlow(new Set([0, 2, 4]));
  await flPkt(tok, ['s', 'b', 'a', 't'], '+1', 1100); flSet([2, 1, 1, 1, 2]); renderFlow(new Set([1, 2, 3]));
  say('先灌 2，再灌 1（把水退回去）', '');
  await step(tok);                                   // 2256.8 big networks: record systematically
  txt(N, '網路很大時不能用眼睛看：要有系統地記錄所有可能');
  say('網路很大就不能用眼睛看', '要系統化地記錄');
  await step(tok);                                   // 2277.8 now: 2 units in the pipes
  flSet([2, 0, 2, 0, 2]); renderFlow(); txt(N, '現在：已經有 2 單位的水在裡面');
  say('假設現在已經灌了 2 單位', '');
  await step(tok);                                   // 2294.4 three edges carry 2
  renderFlow(new Set([0, 2, 4]));
  say('這三條有水：flow 都是 2', '');
  await step(tok);                                   // 2310.8 the other two carry 0
  renderFlow(new Set([1, 3]));
  say('左下、右上這兩條沒水', 'flow = 0');
  await step(tok);                                   // 2317.2 build a residual graph: remaining ability
  renderFlow(); txt(N, '想建一張圖：記錄現在「還能灌多少」');
  say('建 residual graph', '記錄還有多少灌水能力');
  await step(tok);                                   // 2358.8 a → b: capacity 3, has 2 → 1 more downward
  addEdge(1, 2, '還能 1', 0.25, C.edge, 1.8);
  say('a → b 容量 3、灌了 2', '往下還能再灌 1');
  await step(tok);                                   // 2378.8 water inside → can undo up to 2
  addEdge(2, 1, '可退 2', 0.25, C.back, 1.8);
  say('管裡有水就能退', '最多退 2 單位往上');
  await step(tok);                                   // 2402.8 an imaginary pipe going up, capacity 2
  await flPkt(tok, ['b', 'a'], '退水', 1200);
  say('像一條往上的想像水管', '容量 2；流過去 = 退水');
  await step(tok);                                   // 2463.8 call it G_f
  clearEdges(); txt(T1, 'residual graph G_f');
  txt(N, 'G_f：點不變，邊重新建');
  say('記作 G_f（G sub f）', '點跟原圖一樣');
  await step(tok);                                   // 2478.9 every pipe → up to two edges
  txt(N, '每條水管 → 最多兩條邊：順向（還能灌）＋反向（能退）');
  say('每條水管延伸出兩條 edge', '');
  await step(tok);                                   // 2499.6 s → a full: no forward edge
  const X = BAD('s → a 滿了：沒有順向邊', -2.6, -2.2);
  say('s → a 已經滿了', '順向灌不下：不建');
  await step(tok);                                   // 2513.7 s → b: 1
  remove(X); put((r) => r.dir > 0 && r.i === 1);
  say('s → b 是空的', '順向容量 1');
  await step(tok);                                   // 2525.8 a → b: 3 − 2 = 1
  put((r) => r.dir > 0 && r.i === 2);
  say('a → b：3 − 2 = 1', '');
  await step(tok);                                   // 2543.7 a → t: 1
  put((r) => r.dir > 0 && r.i === 3);
  say('a → t：沒灌水，還剩 1', '');
  await step(tok);                                   // 2555.8 forward = c − f
  txt(N, 'forward edge 的容量 = capacity − flow（剩 0 就不建）');
  say('forward：c − f', '');
  await step(tok);                                   // 2568.3 backward: only pipes with water
  txt(N, 'backward edge：只有裡面有水的管子才有（容量 = 目前的 flow）');
  say('backward：有水的才能退', '沒水還退就違反 capacity');
  await step(tok);                                   // 2601.2 s → a has 2 → a → s, 2
  put((r) => r.dir < 0 && r.i === 0);
  say('s → a 有 2', '建反向 a → s，容量 2');
  await step(tok);                                   // 2616.5 b → a, 2
  put((r) => r.dir < 0 && r.i === 2);
  say('b → a，容量 2', '');
  await step(tok);                                   // 2626.2 t → b, 2
  put((r) => r.dir < 0 && r.i === 4);
  say('t → b，容量 2', '');
  await step(tok);                                   // 2632.9 this is the residual graph
  txt(N, '完成！灰 = forward（還能灌）、紫 = backward（能退）');
  say('這就是 residual graph', '');
}]);

// 44:37 在 G_f 找 s → b → a → t，bottleneck 1，更新 G
FRAG.push(['flow-l20-augment', 'Lec20：G_f 上的 augmenting path s → b → a → t', async (tok) => {
  fresh(); buildNet('lsm'); flSet([2, 0, 2, 0, 2]); renderResidual();
  const VT = flVal('G_f（目前 v(f) = 2）');
  const N = NOTE('', 0, -4.3);
  const p = flPath(['s', 'b', 'a', 't']);
  await step(tok);                                   // 2676.8 residual capacity
  txt(N, 'residual capacity：G_f 上每條邊的容量 = 還能灌多少');
  say('residual capacity', 'G_f 上每條邊的容量');
  await step(tok);                                   // 2716.5 the water we wanted: s b a t
  renderResidual(p);
  say('剛剛想灌的水：s → b → a → t', '');
  await step(tok);                                   // 2733.8 a path source → sink in G_f
  txt(N, 'G_f 上有一條 s 到 t 的路 ⇒ 就能把水灌進去');
  say('在 G_f 找 s 到 t 的 path', '有路就能灌水');
  await step(tok);                                   // 2763.7 how much? 1, 2, 1
  txt(N, '沿路容量：1、2、1');
  say('能灌多少？', '容量 1、2、1');
  await step(tok);                                   // 2775.8 only 1, else it bursts
  txt(N, 'bottleneck = min(1, 2, 1) = 1');
  say('最多只能灌 1', '取路上 residual capacity 的最小值');
  await step(tok);                                   // 2794.4 pour 1 unit
  await flPkt(tok, ['s', 'b', 'a', 't'], '+1');
  say('把 1 單位灌下去', '');
  await step(tok);                                   // 2801.7 summary: G_f → path → bottleneck
  txt(N, '流程：建 G_f → 找 s-t path → 灌 bottleneck');
  say('整理一下流程', '建 G_f、找 path、灌 bottleneck');
  await step(tok);                                   // 2861.8 then update the original flow network
  renderFlow(); txt(VT, 'flow network G（更新中）');
  say('灌下去後更新原來的 flow network', '');
  await step(tok);                                   // 2869.0 s → b gets 1 more
  NG.F[1] = 1; renderFlow(new Set([1]));
  say('s → b 多流 1', '0 → 1');
  await step(tok);                                   // 2876.8 b → a is reversed: 2 → 1
  NG.F[2] = 1; renderFlow(new Set([2])); flPaint(2, C.back, 2.4);
  say('b → a 是反過來：扣掉 1', 'a → b：2 → 1');
  await step(tok);                                   // 2883.8 a → t gets 1 (now full)
  NG.F[3] = 1; NG.val = flowVal(); renderFlow(new Set([3])); txt(VT, 'v(f) = 2 + 1 = 3');
  say('a → t 再灌 1：滿了', 'v(f) = 3');
  await step(tok);                                   // 2890.4 update, then a new G_f, pour again
  renderResidual(); txt(VT, '新的 G_f');
  say('再建 residual graph、再灌水', 'iteratively');
  await step(tok);                                   // 2910.8 this is called an augmenting path
  txt(N, 'augmenting path：找一條路，把水「加在」原本的上面');
  say('這個動作叫 augmenting path', 'augment = 增廣、加上去');
  await step(tok);                                   // 2958.0 repeat until G_f has no s → t path
  const S = reachS(); for (let v = 0; v < GR.n; v++) nodeColor(v, S.has(v) ? C.S : C.T, 0);
  txt(N, '直到 G_f 找不到 s 到 t 的路：停，得到 maximum flow');
  say('反覆做到找不到 path', '就得到 maximum flow');
  await step(tok);                                   // 2992.8 same direction +, opposite −
  flUncolor(); renderFlow(new Set([1, 2, 3])); flPaint(2, C.back, 2.4);
  txt(N, '更新規則：跟原方向相同 → 加；相反 → 減（undo）');
  say('同方向 increase', '反方向 decrease（undo flow）');
}]);

// 50:36 流程回顧：從空的 G 開始，建 G_f、找 path、灌、更新
FRAG.push(['flow-l20-ffrecap', 'Lec20：Ford-Fulkerson 流程回顧', async (tok) => {
  fresh(); buildNet('lsm'); renderFlow();
  const T1 = flVal('flow network G');
  const N = NOTE('', 0, -4.3);
  const R = () => residualEdges();
  const both = (r) => R().some((q) => q.u === r.v && q.v === r.u);
  const put = (pred, col) => R().filter(pred).forEach((r) => addEdge(r.u, r.v, fB(r.cap), both(r) ? 0.14 : 0, col || (r.dir > 0 ? C.edge : C.back), 1.8));
  await step(tok);                                   // 3039.8 at the start: no water, all 0
  txt(N, '一開始：所有邊的 flow 都是 0');
  say('一開始 flow network 是空的', '每條 edge 都是 0');
  await step(tok);                                   // 3045.8 pour in slowly
  await flPkt(tok, ['s', 'a', 'b', 't'], '+2'); flSet([2, 0, 2, 0, 2]); renderFlow(new Set([0, 2, 4]));
  say('慢慢把水灌進去', '');
  await step(tok);                                   // 3053.8 each time: build a residual graph
  clearEdges(); txt(T1, 'residual graph G_f');
  txt(N, 'G_f：capture 所有還能灌水的可能');
  say('每次先建 residual graph', '');
  await step(tok);                                   // 3072.5 along the edges, pipes with spare capacity
  put((r) => r.dir > 0);
  say('第一種：順著邊、還有剩的', 'forward edge');
  await step(tok);                                   // 3114.8 pipes with water: undo
  put((r) => r.dir < 0);
  say('第二種：有水的可以退', 'backward edge');
  await step(tok);                                   // 3127.8 backward capacity = water inside
  clearEdges(); put((r) => r.dir > 0); put((r) => r.dir < 0, C.hot);
  txt(N, 'backward 容量 = 目前管裡的水量（最多全部退掉）');
  say('backward 能退多少？', '= 管裡現在的水量');
  await step(tok);                                   // 3145.0 find a path s → t in G_f (not in G)
  const p = flPath(['s', 'b', 'a', 't']); renderResidual(p);
  txt(N, '在 G_f（不是 flow network）上找 s 到 t 的 path');
  say('在 G_f 上找 s 到 t 的 path', '不是在 flow network 上');
  await step(tok);                                   // 3171.8 bottleneck: the lowest residual capacity
  txt(N, 'bottleneck = 路上最小的 residual capacity = 1');
  say('找路上最低的 residual capacity', 'bottleneck');
  await step(tok);                                   // 3180.3 pour that much
  await flPkt(tok, ['s', 'b', 'a', 't'], '+1');
  say('把這麼多水灌進去', '');
  await step(tok);                                   // 3185.8 update the flow network
  renderFlow(); txt(T1, 'flow network G（更新）');
  say('用它更新原來的 flow network', '');
  await step(tok);                                   // 3208.8 same direction: increase
  NG.F[1] = 1; NG.F[3] = 1; renderFlow(new Set([1, 3]));
  say('跟原方向相同：increase', 's → b、a → t 各 +1');
  await step(tok);                                   // 3217.8 opposite: decrease, 2 − 1 = 1
  NG.F[2] = 1; NG.val = flowVal(); renderFlow(new Set([2])); flPaint(2, C.back, 2.4);
  txt(T1, 'v(f) = 3');
  say('方向相反：decrease（退水）', 'a → b：2 − 1 = 1');
  await step(tok);                                   // 3259.8 new flow network → new G_f → next path
  renderResidual(); txt(T1, '新的 G_f → 再找 augmenting path');
  say('新的 flow network', '再建 G_f、再找 path');
}]);

// 54:40 課堂例子前兩輪：8，再 6 → 14
FRAG.push(['flow-l20-run1', 'Lec20：例子第 1、2 輪（8 → 14）', async (tok) => {
  fresh(); buildNet('kt'); flView();
  const M = meter(0);
  const N = NOTE('', 0, 4.3);
  const p1 = () => flPath(['s', 'a', 'd', 't']);
  let p = null;
  await step(tok);                                   // 3279.8 the flow network: capacities
  say('從頭到尾 demo 一次', '邊上是 capacity');
  await step(tok);                                   // 3292.4 initially no water, f = 0
  renderFlow(); txt(N, '一開始：所有水管都沒水，f = 0');
  say('一開始所有 flow = 0', '');
  await step(tok);                                   // 3310.0 build its residual graph: identical
  renderResidual(); txt(N, '建 G_f：跟 flow network 長得一模一樣');
  say('建 residual graph', '跟原圖一模一樣');
  await step(tok);                                   // 3329.0 no water → no undo edges
  txt(N, '沒有水 → 沒有可以退的 → 沒有 backward edge');
  say('沒有水就沒有退水邊', '');
  await step(tok);                                   // 3349.8 find any path s → t
  say('在 G_f 找 s 到 t 的 path', '隨便找都行，結果一樣好');
  await step(tok);                                   // 3391.8 pick this one
  p = p1(); renderResidual(p);
  say('隨便選這一條', 's → a → d → t');
  await step(tok);                                   // 3396.6 bottleneck: 8
  txt(N, 'bottleneck = min(10, 8, 10) = 8');
  say('bottleneck 在這裡：8', '');
  await step(tok);                                   // 3408.4 pour 8 along it
  await flPkt(tok, ['s', 'a', 'd', 't'], '+8');
  say('灌 8 單位', '');
  await step(tok);                                   // 3417.8 update the flow network
  augment(p); renderFlow(new Set([0, 4, 8]));
  say('更新 flow network', '這三條邊的 flow 改變');
  await step(tok);                                   // 3433.5 flow = 8
  await cheer(tok, M, 8);
  say('flow = 8', '');
  await step(tok);                                   // 3441.0 iteration 2: build the residual graph
  renderResidual(); txt(N, '第 2 輪：再建 G_f');
  say('第二個 iteration', '再建 residual graph');
  await step(tok);                                   // 3462.8 water → backward; no water → forward
  rhl((r) => r.dir < 0); txt(N, '有水的邊多了反向邊（可退水）');
  say('有水的邊：多一條 backward', '');
  await step(tok);                                   // 3481.5 s → a: 8 of 10 → 2 left
  rhl((r) => r.i === 0 && r.dir > 0); txt(N, 's → a：10 − 8 = 2，還能灌 2');
  say('s → a 灌了 8、容量 10', '還剩 2');
  await step(tok);                                   // 3503.8 only these three edges changed
  rhl((r) => [0, 4, 8].includes(r.i)); txt(N, '只有剛剛動到的三條需要更新');
  say('其他地方沒動', '只更新這三條');
  await step(tok);                                   // 3523.0 a → d full: only backward 8
  rhl((r) => r.i === 4); txt(N, 'a → d 滿了：只剩反向 8');
  say('a → d 灌滿：沒有 forward', '反向可以退 8');
  await step(tok);                                   // 3540.0 find an augmenting path again
  renderResidual(); txt(N, '再找一條 s 到 t 的 augmenting path');
  say('一樣找 augmenting path', '');
  await step(tok);                                   // 3558.8 bottleneck: 6
  p = flPath(['s', 'b', 'd', 'c', 't']); renderResidual(p);
  txt(N, 'bottleneck = min(10, 9, 6, 10) = 6');
  say('這條的 bottleneck 是 6', '');
  await step(tok);                                   // 3569.8 through 4 edges, pour 6
  await flPkt(tok, ['s', 'b', 'd', 'c', 't'], '+6');
  say('經過 4 條邊，灌 6', '');
  await step(tok);                                   // 3582.8 update the flow network
  augment(p); renderFlow(new Set([1, 5, 6, 7]));
  say('更新這四條的 flow', '');
  await step(tok);                                   // 3601.8 so far all along the edge directions
  txt(N, '到目前為止，都是順著邊的方向灌');
  say('到目前都是順向灌水', '');
  await step(tok);                                   // 3607.7 flow = 8 + 6 = 14
  await cheer(tok, M, 14);
  say('flow = 8 + 6 = 14', '');
}]);

// 60:20 第 3 輪走反向 d → a（8 → 5），17；第 4 輪 2 → 19
FRAG.push(['flow-l20-run2', 'Lec20：例子第 3、4 輪，走反向邊（14 → 19）', async (tok) => {
  fresh(); buildNet('kt'); flSet(KT14); renderFlow();
  const M = meter(14);
  const N = NOTE('', 0, 4.3);
  let p = null;
  await step(tok);                                   // 3620.8 iteration 3
  txt(N, '第 3 輪');
  say('第三個 iteration', '');
  await step(tok);                                   // 3627.0 rebuild G_f: only the four touched edges
  renderResidual(); rhl((r) => [1, 5, 6, 7].includes(r.i));
  say('建 residual graph', '只要更新剛動到的四條');
  await step(tok);                                   // 3653.7 d → c full: only backward 6
  rhl((r) => r.i === 6); txt(N, 'd → c 滿了：只剩反向 6');
  say('d → c 灌滿了', '順向沒有，反向可退 6');
  await step(tok);                                   // 3671.8 find a path: a bit more complex
  p = flPath(['s', 'b', 'd', 'a', 'c', 't']); renderResidual(p);
  txt(N, 's → b → d → a → c → t（d → a 是反向邊）');
  say('這條稍微複雜', '經過反向的 d → a');
  await step(tok);                                   // 3685.8 bottleneck 3
  txt(N, 'bottleneck = min(4, 3, 8, 4, 4) = 3');
  say('bottleneck 是 3', '');
  await step(tok);                                   // 3691.8 five edges, pour 3
  await flPkt(tok, ['s', 'b', 'd', 'a', 'c', 't'], '+3', 2200);
  say('沿 5 條邊灌 3', '');
  await step(tok);                                   // 3700.8 update those five edges
  augment(p); renderFlow(new Set([1, 5, 4, 3, 7]));
  say('更新這五條邊', '');
  await step(tok);                                   // 3717.8 along the direction: 6 + 3 = 9
  renderFlow(new Set([5])); txt(N, 'b → d 順向：6 + 3 = 9');
  say('順向的邊：6 + 3 = 9', '');
  await step(tok);                                   // 3735.8 reversed: undo 3, 8 → 5
  renderFlow(); flPaint(4, C.back, 2.6); txt(N, 'a → d 被反向灌 3 = 退水：8 − 3 = 5');
  say('倒過來灌 3 = 退水', 'a → d：8 − 3 = 5');
  await step(tok);                                   // 3756.7 flow = 14 + 3 = 17
  await cheer(tok, M, 17);
  say('flow = 14 + 3 = 17', '');
  await step(tok);                                   // 3773.2 again: G_f, find a path
  renderResidual(); txt(N, '第 4 輪：再建 G_f、找路');
  say('再建 residual graph', '找 s 到 t 的路');
  await step(tok);                                   // 3791.6 there is one; bottleneck 2
  p = flPath(['s', 'a', 'd', 't']); renderResidual(p);
  txt(N, 's → a → d → t：bottleneck = min(2, 3, 2) = 2');
  say('還有一條：bottleneck 2', '');
  await step(tok);                                   // 3805.0 pour 2 along these three
  await flPkt(tok, ['s', 'a', 'd', 't'], '+2');
  say('沿三條邊多灌 2', '');
  await step(tok);                                   // 3812.2 update: 17 + 2 = 19
  augment(p); renderFlow(new Set([0, 4, 8])); await cheer(tok, M, 19);
  say('更新：flow = 17 + 2 = 19', '');
  await step(tok);                                   // 3829.8 build the residual graph again
  renderResidual(); txt(N, '再建一次 G_f');
  say('再建 residual graph', '');
}]);

// 64:00 s 只走得到 b → 停止；cut {s, b}：10 + 9 = 19
FRAG.push(['flow-l20-runcut', 'Lec20：s 只走得到 b，cut 10 + 9 = 19', async (tok) => {
  fresh(); buildNet('kt'); flSet(KT19); renderResidual();
  const M = meter(19);
  const N = NOTE('', 0, 4.3);
  let L = null;
  await step(tok);                                   // 3840.8 find an augmenting path s → t
  txt(N, '在 G_f 找 s 到 t 的 augmenting path');
  say('找 s 到 t 的 path', '');
  await step(tok);                                   // 3851.0 the source can't get out
  nodeColor(0, C.hot, 0.4);
  say('s 好像走不出去了', '');
  await step(tok);                                   // 3857.6 it reaches b
  rhl((r) => r.u === 0); nodeColor(2, C.hot, 0.4);
  say('s 往外只走得到 b', '');
  await step(tok);                                   // 3862.7 from b, no way out
  rhl((r) => r.u === 2); nodeTag(2, '走不出去');
  say('b 再也走不出去', '只能退回來');
  await step(tok);                                   // 3879.9 no path → stop
  renderResidual(); M.mood('wow'); txt(N, '找不到 s 到 t 的 path：停止');
  say('找不到 augmenting path', '演算法停下來');
  await step(tok);                                   // 3911.9 the current solution is the max flow
  await cheer(tok, M, 19);
  txt(N, '當下的解 = maximum flow = 19');
  say('當下的解就是 max flow', '');
  await step(tok);                                   // 3945.8 like a gap between them
  nodeTag(2, ''); nodeColor(1, C.T, 0); nodeColor(3, C.T, 0); nodeColor(4, C.T, 0); nodeColor(5, C.T, 0);
  say('s、b 和其他點之間', '好像有一道鴻溝');
  await step(tok);                                   // 3959.8 imagine a cut there
  flCut(reachS());
  say('那裡自然形成一個 cut', '所有路都被砍斷');
  await step(tok);                                   // 3976.8 the same cut in the flow network
  flCut(reachS(), { flow: true }); txt(N, '回到原來的 flow network：同樣剪出這個 cut');
  say('對應回原來的 flow network', '');
  await step(tok);                                   // 3989.5 its upper bound: 10 + 9 = 19
  txt(N, '這個 cut 的 upper bound：10 + 9 = 19');
  say('cut 容量：10 + 9 = 19', '');
  await step(tok);                                   // 3995.2 equals the 19 we poured
  txt(N, '19 = 灌進去的 max flow 19：兩個相等！');
  await cheer(tok, M, 19);
  say('剛好等於灌進去的 19', '');
  await step(tok);                                   // 4004.8 min cut, max flow
  txt(N, 'min cut = max flow');
  say('max flow = min cut', '');
  await step(tok);                                   // 4029.8 the cut is at the edge of what s can reach
  txt(N, 'min cut 就在 G_f 中 s 走得到的範圍的邊界');
  say('cut 在 s 可到達範圍的邊界', '找到 max flow 就順便找到 min cut');
}]);

// 67:22 步驟總結：G 與 G_f 輪流
FRAG.push(['flow-l20-ffsum', 'Lec20：Ford-Fulkerson 步驟總結', async (tok) => {
  fresh();
  const P = flCode([
    '0  f(e) ← 0（空的 flow network）',
    '1  依目前的 f 建 G_f',
    '2  在 G_f 找 s-t path P',
    '3  b ← bottleneck(P)',
    '4  沿 P 把 b 灌下去',
    '5  update 原來的 flow network G',
    '6  再 construct 新的 G_f',
    '7  找不到 path → 停'], 0, -2.6, 0.68);
  const g = buddy('G', '', '#8fc6ec', -6.2, 0, 0, 0.75), gf = buddy('G_f', '', '#c9b6f7', 6.2, 0, 0, 0.75);
  const turn = async (b) => { g.mood(b === g ? 'happy' : 'calm'); gf.mood(b === gf ? 'happy' : 'calm'); await b.hop(tok); };
  await step(tok);                                   // 4042.1 summary of Ford-Fulkerson
  say('總結 Ford-Fulkerson', '一直 repeat');
  await step(tok);                                   // 4055.8 initial: an empty flow network
  P.hl(0); g.set('0'); await turn(g);
  say('initial：空的 flow network', '每條 edge flow = 0');
  await step(tok);                                   // 4068.2 each iteration: build its G_f
  P.hl(1); await turn(gf);
  say('每一輪：依目前的 G 建 G_f', '');
  await step(tok);                                   // 4080.0 initially G_f looks the same as G
  gf.set('= G'); gf.mood('wow');
  say('一開始 G_f 跟 G 一模一樣', '');
  await step(tok);                                   // 4091.8 find an s-t path in G_f
  P.hl(2); gf.set('P'); await turn(gf);
  say('在 G_f 上找 s 到 t 的 path', '= augmenting path');
  await step(tok);                                   // 4103.0 its bottleneck
  P.hl(3); gf.set('b');
  say('算 bottleneck', '最多能灌多少');
  await step(tok);                                   // 4115.9 pour it in
  P.hl(4); const w = tag('+b', 'pkt', 5.2, 0.9, 0); await travel(tok, w, V3(5.2, 0.9, 0), V3(-5.2, 0.9, 0), 1400); remove(w);
  say('把 bottleneck 灌進去', '');
  await step(tok);                                   // 4130.5 correction: update the ORIGINAL flow network
  P.hl(5); g.set('f + b'); await turn(g);
  const X = BAD('更新的是原來的 flow network，不是 G_f', 0, 3.5);
  say('更新原來的 flow network', '不是更新 residual graph');
  await step(tok);                                   // 4147.8 then construct the new G_f
  remove(X); P.hl(6); gf.set('新'); await turn(gf);
  say('再 construct 新的 G_f', '然後再找 path、再灌水');
  await step(tok);                                   // 4171.8 until no s-t path: stop
  P.hl(7); gf.set('✕'); gf.mood('sad'); g.mood('happy');
  say('找不到 s 到 t 的 path 就停', '');
  await step(tok);                                   // 4185.8 max flow = min cut is a theorem
  tag('max flow = min cut：是定理，不只是觀察', 'ptr alt', 0, 0.3, 3.4);
  say('max flow = min cut', '是可以證明的定理');
}]);

// 70:29 primal / dual；比較 27、21、19
FRAG.push(['flow-l20-mfmc', 'Lec20：max-flow min-cut（27、21、19）', async (tok) => {
  fresh(); buildNet('kt'); flSet(KT19); renderFlow();
  const N = NOTE('', 0, 4.3);
  const pr = buddy('max flow', '19', '#9fd3f0', -6.3, 0, -3.7, 0.7), du = buddy('min cut', '?', '#f3d2c8', 6.3, 0, -3.7, 0.7);
  let VT = null;
  await step(tok);                                   // 4229.1 primal: max flow; dual: min cut
  txt(N, 'primal（主問題）：max flow；dual（對偶問題）：min cut');
  say('primal：max flow', 'dual：min cut');
  await step(tok);                                   // 4240.6 they alternate and converge
  await anim(tok, 1500, (u) => { pr.g.position.x = -6.3 + 3.2 * u; du.g.position.x = 6.3 - 3.2 * u; });
  du.set('19'); pr.mood('happy'); du.mood('happy');
  say('兩個問題交替操作', '最佳解時剛好收斂在一起');
  await step(tok);                                   // 4281.8 max-flow min-cut theorem
  txt(N, 'Max-flow min-cut theorem：max flow 的值 = min cut 的值');
  say('Max-flow min-cut theorem', '下次證明');
  await step(tok);                                   // 4307.1 a cut separates s and t
  flCut(new Set([0, 1, 2])); txt(N, 'cut：把 s、t 分在兩側');
  say('cut 要把 s、t 分在兩側', '看水流過的截面');
  await step(tok);                                   // 4340.8 every cut is an upper bound
  say('每個 cut 都是 upper bound', '水一定要經過切面');
  await step(tok);                                   // 4363.8 cut pipes give at most their capacity
  txt(N, '切到的水管：最多送 capacity 那麼多');
  say('切到的水管最多送 capacity', '');
  await step(tok);                                   // 4370.8 forward edges count; backward: no water
  txt(N, '只加 forward 方向的 capacity；反方向的叫它不要送水');
  say('只加 forward 邊的 capacity', '反向的不算');
  await step(tok);                                   // 4399.8 find the tightest
  VT = flVal('');
  say('找最緊的 upper bound', '');
  await step(tok);                                   // 4404.8 loose: 10 + 8 + 9 = 27 (6 not counted)
  txt(VT, 'cut = ' + flCut(new Set([0, 1, 2, 3])) + '（10 + 8 + 9，6 不算）');
  say('這刀很鬆：27', '6 是反向，不算');
  await step(tok);                                   // 4423.4 4 + 8 + 9 = 21
  txt(VT, 'cut = ' + flCut(new Set([0, 1, 2])) + '（4 + 8 + 9）');
  say('這刀：4 + 8 + 9 = 21', '');
  await step(tok);                                   // 4429.5 the smallest: 19
  txt(VT, 'cut = ' + flCut(new Set([0, 2])) + '（10 + 9）最小');
  say('最小的是 19', '');
  await step(tok);                                   // 4434.8 the optimum sits on the min cut
  txt(VT, 'max flow = min cut = 19'); await cheer(tok, pr); du.mood('happy');
  say('最佳解出現在 min cut 上', '');
}]);

// 74:46 應用：資源分配 → model 成 flow network（例子自訂：3 個人、2 個資源，∞ 表示沒有上限）
NETS.ra = { title: '資源分配', names: ['s', '甲', '乙', '丙', 'R1', 'R2', 't'], s: 0, t: 6,
  pos: [[-6.0, 0], [-2.6, -2.6], [-2.6, 0], [-2.6, 2.6], [1.6, -1.4], [1.6, 1.6], [5.6, 0]],
  edges: [[0, 1, 2], [0, 2, 3], [0, 3, 2], [1, 4, 99], [2, 4, 99], [2, 5, 99], [3, 5, 99], [4, 6, 3], [5, 6, 2]] };
const RA_F = [2, 1, 2, 2, 1, 0, 2, 3, 2];
const raCap = (c) => (c === 99 ? '∞' : String(c));
FRAG.push(['flow-l20-resource', 'Lec20：資源分配 → model 成 flow network', async (tok) => {
  fresh();
  await step(tok);                                   // 4486 max flow is used most for resource allocation
  const T = SAY('資源分配：很多人要用有限的資源', 0, -4.3);
  buildNet('ra'); flView((i, c) => raCap(c));
  say('Max flow 最常用來處理資源分配', '');
  await step(tok);                                   // 4491.7 the pipes are resources, each with a limit
  flView((i, c) => raCap(c), new Set([7, 8]));
  nodeTag(4, 'R1：最多 3'); nodeTag(5, 'R2：最多 2');
  say('管子就是資源，每個資源都有上限', 'capacity：最多就只能用這麼多');
  await step(tok);                                   // 4504 many people (objects) want to use them
  flView((i, c) => raCap(c), new Set([0, 1, 2, 3, 4, 5, 6]));
  nodeTag(1, '要 2'); nodeTag(2, '要 3'); nodeTag(3, '要 2');
  const N = NOTE('s → 人：每人要多少；人 → 資源：誰能用哪個資源', 0, 4.3);
  say('很多人都要用這些資源', '要怎麼分配？');
  await step(tok);                                   // 4516.2 allocate with network flow
  for (const p of [['s', '甲', 'R1', 't'], ['s', '乙', 'R1', 't'], ['s', '丙', 'R2', 't']]) await flPkt(tok, p, '用', 1200);
  flSet(RA_F);
  flView((i, c, f) => f + '/' + raCap(c), new Set(RA_F.map((f, i) => (f > 0 ? i : -1)).filter((i) => i >= 0)));
  txt(T, '跑 max flow：最多分出 5 單位（R1 3 + R2 2 都用滿）');
  say('用 network flow 來分配', '甲 2、乙 1、丙 2，總共 5');
  await step(tok);                                   // 4545.6 almost every allocation problem gets a network flow solution
  txt(N, '資源分配問題，幾乎都有人用 network flow 解');
  say('資源分配問題非常常見', '幾乎都找得到 network flow 的解法');
  await step(tok);                                   // 4600.9 the key: model the problem as a flow network
  txt(N, '關鍵：把問題 model 成 flow network，剩下交給 max flow');
  say('應用的關鍵在 modeling', '能 model 成 flow network，就能用 network flow 求解');
}]);

// 76:52 Bipartite matching：3 對 vs 最多 4 對
FRAG.push(['flow-l20-bip-problem', 'Lec20：bipartite matching，3 對與最多 4 對', async (tok) => {
  fresh();
  const N = NOTE('', 0, 4.5);
  await step(tok);                                   // 4612.0 a famous application: bipartite matching
  const T = SAY('應用：bipartite matching', 0, -4.6);
  say('有名的應用：bipartite matching', '跟 stable matching 是兄弟');
  await step(tok);                                   // 4636.8 stable matching: no cheating
  txt(N, 'stable matching：男女配對，配完後沒人想劈腿');
  say('還記得 stable matching？', '希望配完不要有劈腿');
  await step(tok);                                   // 4663.0 now: as many pairs as possible
  txt(N, '今天：不管穩不穩定，只求配出越多對越好');
  say('maximum bipartite matching', '只求配越多對越好');
  await step(tok);                                   // 4690.8 two groups: men and women
  bipBuild(false); txt(N, '點分成兩群：男生、女生');
  say('點分成兩群', '男生、女生');
  await step(tok);                                   // 4710.8 edges between, none inside a group
  bipRender(new Set());
  say('中間有 edge 相連', '同一群之間沒有 edge');
  await step(tok);                                   // 4725.8 an edge = a chance to be friends
  txt(N, '有 edge ＝ 有機會配對；沒 edge ＝ 差太遠');
  say('有 edge = 有機會做朋友', '');
  await step(tok);                                   // 4763.4 at most one partner each
  txt(N, '每個人最多只能配一個對象');
  say('一男最多配一女', '一女最多配一男');
  await step(tok);                                   // 4774.7 perfect matching: everyone exactly one
  txt(N, 'perfect matching：每個人都恰好配到一個');
  say('perfect matching', '每人恰好配到一個');
  await step(tok);                                   // 4792.1 perfect ≠ stable
  txt(N, 'perfect 不一定 stable：一個講數量，一個講穩定');
  say('perfect ≠ stable', '');
  await step(tok);                                   // 4814.5 this solution: 3 pairs
  bipRender(M3); txt(N, '這個解配了 3 對：2 男 2 女落單');
  say('這個解配出 3 對', '');
  await step(tok);                                   // 4833.9 best: 4 pairs
  bipRender(M4); txt(N, '最好可以配到 4 對');
  say('最好可以配 4 對', '');
  await step(tok);                                   // 4841.8 5 pairs impossible
  BAD('5 對？做不到', 0, -3.8);
  say('配不出 5 對', '');
}]);

// 81:16 建 flow network：加 s、t，左→右，capacity 全部 1；max flow 4
FRAG.push(['flow-l20-bip-reduce', 'Lec20：matching → max flow（capacity 全 1）', async (tok) => {
  fresh(); bipBuild(false); bipRender(new Set());
  const N = NOTE('', 0, 4.5);
  const MID = [5, 6, 7, 8, 9, 10, 11];
  await step(tok);                                   // 4875.8 not a dedicated algorithm
  txt(N, '不另外設計專屬的演算法');
  say('不寫新的演算法', '');
  await step(tok);                                   // 4886.8 reuse what we know: max flow
  txt(N, '用手上已知的方法：max flow');
  say('改用已知的 max flow 來解', '');
  await step(tok);                                   // 4907.8 men, women, possible pairs: how to model?
  say('有男生、女生、配對的可能', '怎麼 model 成 flow network？');
  await step(tok);                                   // 4925.8 a resource allocation problem
  txt(N, '這其實是資源分配問題：每人最多分到一個');
  say('這是資源分配問題', '');
  await step(tok);                                   // 4957.8 building the network is the hard part
  txt(N, '最難的是：建出合理的 flow network');
  say('怎麼建 flow network 最難', '建好了解就出來了');
  await step(tok);                                   // 4973.6 add source s and sink t
  GR.nodes[0].mesh.visible = true; GR.nodes[11].mesh.visible = true; nodeColor(0, C.S, 0.3); nodeColor(11, C.T, 0.3);
  say('加 source s 與 sink t', '');
  await step(tok);                                   // 4996.8 the pair edges: forced left → right
  bipRender(new Set(), { path: MID });
  say('配對的 edge 強制改成左 → 右', '');
  await step(tok);                                   // 5029.9 s → every man, every woman → t
  bipRender(new Set(), { st: true });
  say('s 連到所有男生', '所有女生連到 t');
  await step(tok);                                   // 5052.7 capacity: one man, at most one woman → 1
  txt(N, '中間的邊 capacity = 1');
  say('一個男生最多配一個女生', '中間的 capacity 給 1');
  await step(tok);                                   // 5076.8 s → man 1, woman → t 1
  txt(N, 's → 男生：1；女生 → t：1');
  say('s → 男生、女生 → t 也給 1', '每人最多一單位');
  await step(tok);                                   // 5101.8 2 would allow two partners
  txt(N, '如果給 2：就能配兩個對象');
  say('給 2 就能配兩個', '');
  await step(tok);                                   // 5114.4 all capacities 1
  txt(N, '所有 capacity 都設成 1');
  say('所有 capacity 都是 1', 'flow network 完成');
  await step(tok);                                   // 5124.1 run max flow: 4
  bipRender(M4, { st: true }); const VT = tag('max flow = 4', 'ptr alt', 0, 0.3, -4.6);
  say('跑 max flow：4', '代表找到 4 對');
  await step(tok);                                   // 5147.8 back to the original graph
  GR.nodes[0].mesh.visible = false; GR.nodes[11].mesh.visible = false; bipRender(M4);
  txt(VT, '有水（1 單位）的中間邊 = 配對');
  say('回到原圖：有水的邊就是配對', "1–1′、2–2′、3–3′、5–4′");
}]);

// 86:28 residual：配到的邊只剩反向；alternating augmenting path 讓配對 +1
FRAG.push(['flow-l20-bip-alt', 'Lec20：alternating augmenting path，3 對 → 4 對', async (tok) => {
  fresh(); bipBuild(true); bipRender(new Set(), { st: true });
  const N = NOTE('', 0, 4.5);
  const P = [1, 7, 6, 5, 12];
  await step(tok);                                   // 5188.8 start empty, build G_f, pour
  txt(N, '一樣從空的 flow network 開始：建 G_f、灌水');
  say('從沒水的 flow network 開始', '');
  await step(tok);                                   // 5205.8 capacity 1: poured or not — binary
  txt(N, 'capacity 都是 1：每條邊只有「有水／沒水」兩種');
  say('capacity 都是 1', '像 binary 一樣');
  await step(tok);                                   // 5247.2 suppose halfway: 3 pairs
  bipRender(M3, { st: true }); txt(N, "跑到一半：已配 1–2′、3–3′、5–4′");
  say('假設跑到一半：已配 3 對', '');
  await step(tok);                                   // 5259.8 G_f: matched edges only reversed
  bipRender(M3, { st: true, res: true }); txt(N, '配到的邊在 G_f 只剩反向（紫，影片畫虛線）');
  say('配到的邊只剩反向', '');
  await step(tok);                                   // 5293.7 unmatched edges stay forward
  txt(N, '沒配到的邊：順向（灰，影片畫實線）');
  say('沒配到的：順向 edge', '');
  await step(tok);                                   // 5304.8 from s, find a way to t
  nodeColor(0, C.hot, 0.4);
  say('從 s 出發，想辦法走到 t', '');
  await step(tok);                                   // 5321.8 here is an augmenting path
  bipRender(M3, { st: true, res: true, path: P });
  say('找到一條 augmenting path', '');
  await step(tok);                                   // 5345.8 it starts: s → some man
  bipRender(M3, { st: true, res: true, path: [1] });
  say('先從 s 順著走到某個男生', 's → 2');
  await step(tok);                                   // 5355.8 then alternates right, left, right …
  bipRender(M3, { st: true, res: true, path: [1, 7, 6, 5] });
  say('然後右、左、右……交替', "2 → 2′ ⇢ 1 → 1′");
  await step(tok);                                   // 5380.8 finally into the sink
  bipRender(M3, { st: true, res: true, path: P });
  say('最後灌進 sink', "1′ → t");
  await step(tok);                                   // 5397.8 one more solid than dashed → +1 pair
  bipRender(M4, { st: true }); txt(N, '順向（實線）比反向（虛線）多一條 → 配對 +1');
  say('實線比虛線多一條', '多配到一對：4 對');
  await step(tok);                                   // 5435.8 = the alternating path of direct methods
  txt(N, '直接解 bipartite matching 的方法，找的也是這種 alternating path');
  say('這就是 alternating path', '順、反、順、反');
}]);

// ════════════════ NOYNTuhXDGU：江蕙如 Lec21 Network Flow (2/2) ════════════════
// 00:16 回顧：flow network、capacity、v(f) 從 source 或 sink 量
FRAG.push(['flow-l21-recap', 'Lec21：回顧 flow network 與 flow value', async (tok) => {
  fresh();
  const N = NOTE('', 0, 4.3);
  let tb = null, VT = null;
  await step(tok);                                   // 16.8 today: the max-flow min-cut theorem
  const T = SAY('今天：max-flow min-cut theorem', 0, -4.4);
  say('Network flow 最後一個單元', 'max-flow min-cut theorem');
  await step(tok);                                   // 28.8 review Ford-Fulkerson: iterative
  txt(T, '先複習 Ford-Fulkerson：一輪一輪做（iterative）');
  say('先快速 review Ford-Fulkerson', 'iterative algorithm');
  await step(tok);                                   // 47.8 a flow network: a directed graph
  buildNet('lsm'); flView();
  say('一開始有一個 flow network', '它是 directed graph');
  await step(tok);                                   // 56.8 source generates, sink absorbs
  nodeColor(0, C.S, 0.4); nodeColor(3, C.T, 0.4); nodeTag(0, 'source'); nodeTag(3, 'sink');
  tb = tapBucket();
  say('source 產生 flow', 'sink 吸收 flow');
  await step(tok);                                   // 68.8 internal nodes in between
  nodeTag(1, 'internal'); nodeTag(2, 'internal');
  say('中間是 internal node', '');
  await step(tok);                                   // 73.8 edges with a capacity: the upper limit
  [0, 1, 2, 3].forEach((v) => nodeTag(v, '')); flView((i, c) => 'c = ' + c, new Set([0, 1, 2, 3, 4]));
  txt(N, '每條邊的 capacity：flow 的上限');
  say('edge 上有 capacity', 'flow 不能超過它');
  await step(tok);                                   // 93.3 find the largest flow
  flSet([2, 1, 1, 1, 2]); renderFlow(); txt(N, '目標：灌出最大的 flow');
  say('maximum network flow', '找能灌出的最大 flow');
  await step(tok);                                   // 106.8 measure it at the source
  VT = flVal('source 送出：2 + 1 = 3'); flPaint(0, C.hot, 2.6); flPaint(1, C.hot, 2.6); await tb.tap.hop(tok);
  say('by definition 從 source 量', '送出 2 + 1 = 3');
  await step(tok);                                   // 117.0 or at the sink
  renderFlow(); flPaint(3, C.hot, 2.6); flPaint(4, C.hot, 2.6); txt(VT, 'sink 收到：1 + 2 = 3'); await cheer(tok, tb.bucket, 3);
  say('也可以從 sink 量', '收到 1 + 2 = 3');
}]);

// 02:24 Ford-Fulkerson 虛擬碼逐行看
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
    '9  return f'], -1.4, -3.2, 0.68);
  const g = buddy('G', '', '#8fc6ec', 5.8, 0, -2.4, 0.7), gf = buddy('G_f', '', '#c9b6f7', 5.8, 0, 1.4, 0.7);
  const N = NOTE('', 0, 4.4);
  await step(tok);                                   // 143.8 lines 1–2: initialization, all 0
  P.hl(0); g.set('0'); await g.hop(tok);
  say('initialization：flow 全部清成 0', '');
  await step(tok);                                   // 151.8 build the residual graph
  P.hl(1); gf.set('建'); await gf.hop(tok);
  say('依目前的 flow 建 residual graph', 'capture 所有灌水的能力');
  await step(tok);                                   // 168.8 forward: how much more along the edge
  txt(N, 'forward edge：順著邊，還能灌多少（c − f）');
  say('forward edge', '順著邊還能灌多少');
  await step(tok);                                   // 184.8 backward: how much can be undone
  txt(N, 'backward edge：管裡有水，最多能退多少（= f）');
  say('backward edge', '能退多少 = 目前的水量');
  await step(tok);                                   // 212.1 at first only forward edges
  txt(N, '一開始沒水：第一個 G_f 只有 forward edge'); gf.set('= G');
  say('一開始只有 forward edge', 'backward 容量都是 0');
  await step(tok);                                   // 233.9 lines 4–9: a big while loop
  P.hl(2); gf.mood('wow');
  say('while loop：每一輪', '');
  await step(tok);                                   // 249.8 find an augmenting path s → t
  gf.set('P'); await gf.hop(tok); txt(N, '在 G_f 找 s 到 t 的 path P = augmenting path');
  say('在 G_f 找 augmenting path', '找得到就能灌水');
  await step(tok);                                   // 274.8 how much: the bottleneck
  P.hl(3); gf.set('b');
  say('能灌多少？bottleneck', '');
  await step(tok);                                   // 285.7 = the minimum residual capacity
  txt(N, 'b = path 上 residual capacity 的最小值（最緊的那段）');
  say('b = 最小的 residual capacity', '');
  await step(tok);                                   // 314.8 pour along P back into the flow network
  P.hl(4); const w = tag('+b', 'pkt', 5.8, 0.9, 1.4); await travel(tok, w, V3(5.8, 0.9, 1.4), V3(5.8, 0.9, -2.4), 1000); remove(w);
  say('沿著 path 灌回 flow network', '每條邊看是 forward 還是 backward');
  await step(tok);                                   // 344.6 forward: add b
  P.hl(5); g.set('f + b'); await cheer(tok, g);
  say('forward edge：加 b', '順著方向多灌 b');
  await step(tok);                                   // 366.8 backward: subtract b from the reverse edge
  P.hl(6); g.set('f − b'); g.mood('wow');
  say('backward edge：反向那條減 b', 'undo flow，把水退回去');
  await step(tok);                                   // 403.8 update the residual graph
  P.hl(7); gf.set('新'); await gf.hop(tok);
  say('update residual graph', '根據新的 flow');
  await step(tok);                                   // 417.8 until no path: s can't reach t
  P.hl(2); gf.set('✕'); gf.mood('sad');
  say('找不到 path 就停', 's 到不了 t');
  await step(tok);                                   // 440.8 output the flow
  P.hl(8); g.mood('happy'); await g.hop(tok);
  say('輸出當下的 flow', '結束');
}]);

// 07:41 回顧例子：min cut 只算 forward 邊
FRAG.push(['flow-l21-mincut', 'Lec21：回顧例子，min cut = 19', async (tok) => {
  fresh(); buildNet('kt'); flSet(KT19); renderFlow();
  const M = meter(19);
  const N = NOTE('', 0, 4.3);
  await step(tok);                                   // 460.8 provably Ford-Fulkerson reaches the max flow
  txt(N, '可以證明：Ford-Fulkerson 最後得到的就是 max flow');
  say('Ford-Fulkerson 會得到 max flow', '這可以證明');
  await step(tok);                                   // 467.9 and max flow = min cut
  txt(N, '而且 max flow = 所有 cut 容量的最小值（min cut）');
  say('max flow = min cut', '');
  await step(tok);                                   // 491.7 the example from last time, finished
  await cheer(tok, M, 19);
  say('上次的例子跑完', 'max flow = 19');
  await step(tok);                                   // 501.7 these edges are completely full
  flPaint(0, C.sat, 2.8); flPaint(5, C.sat, 2.8);
  say('這些邊全部灌滿', '');
  await step(tok);                                   // 507.3 the min cut is here
  flCut(new Set([0, 2]), { flow: true });
  say('min cut 在這裡', 'A = {s, b}');
  await step(tok);                                   // 513.9 add forward capacities: 10 + 9
  const VT = flVal('min cut = 10 + 9 = 19');
  say('加 forward 方向的 capacity', '10 + 9 = 19');
  await step(tok);                                   // 523.4 backward edges don't count
  flPaint(2, C.back, 2.6); txt(N, 'a → b（紫）是反方向：不算');
  say('backward 方向不算', '');
  await step(tok);                                   // 529.1 it can carry no water; in fact it has none
  txt(N, '它可以不灌水；實際上這裡也是 0/2，沒有水');
  say('可以讓它不灌水', '實際上它也沒有水');
}]);

// 一條邊的 capacity 長條（c = 10、f = 6）
function flBarSetup() {
  const X = (k) => -4.5 + k;
  for (let k = 0; k < 10; k++) ghostBox('#7a6a50', 0.86, 0.86, 0.86).position.set(X(k), 0.43, 0);
  const cs = [];
  for (let k = 0; k < 6; k++) cs.push(cube(null, C.flow, [0.8, 0.8, 0.8], X(k), 0.4, 0, 2));
  tag('c = 10', 'idx', 5.6, 0.3, 0);
  const fl = tag('f = 6', 'ptr', -2, 0.3, -1.2);
  const lines = [];
  const add = (t) => { lines.push(tag(t, 'ptr alt', 0, 0.3, 1.8 + lines.length * 0.7)); };
  return { X, cs, fl, add };
}
// 09:18 正確性 (1)：f′ 合法嗎？forward edge 灌 b 後仍 ≤ c
FRAG.push(['flow-l21-cap-fwd', 'Lec21：forward edge 灌 b 後仍 ≤ c', async (tok) => {
  fresh([0, 10, 9], [0, 0, 0.6]);
  const N = NOTE('', 0, -4.0);
  const ff = buddy('Ford-Fulkerson', '', '#8fc6ec', -5.6, 0, -2.6, 0.7);
  let bar = null;
  await step(tok);                                   // 558.8 properties: is it correct?
  txt(N, 'Ford-Fulkerson 正確嗎？'); ff.mood('wow');
  say('探討 Ford-Fulkerson 的性質', '先看正確性');
  await step(tok);                                   // 566.8 two levels: a legal flow? the best?
  txt(N, '① 吐出來的是合法的 flow 嗎？　② 是最佳解嗎？');
  say('正確性分兩層', '先看合法（feasible），再看最佳');
  await step(tok);                                   // 598.9 every iteration produces a new flow
  const fa = tag('f（灌水前）', 'ptr', -1.6, 0.3, -2.6), fb = tag('f′（灌水後）', 'ptr', 2.4, 0.3, -2.6);
  arrow(V3(-0.2, 0.3, -2.6), V3(1.0, 0.3, -2.6), 0x2f7fd0);
  say('每一輪灌完水', '產生一個新的 flow');
  await step(tok);                                   // 619.4 call it f′, the one before f
  txt(N, '這一輪開始時叫 f，augmenting path 灌完叫 f′');
  say('灌水前叫 f、灌水後叫 f′', 'f′ 正確嗎？');
  await step(tok);                                   // 645.8 feasible: two constraints
  txt(N, '合法 = 滿足兩個 constraint：capacity、conservation');
  say('檢查兩個 constraint', 'capacity 與 conservation');
  await step(tok);                                   // 803.9 only edges on P change
  txt(N, 'f 和 f′ 只差在 augmenting path P 經過的邊上');
  say('只有 path P 上的邊有改變', '其他邊還是原來的 f');
  await step(tok);                                   // 829.8 the initial all-zero flow is legal
  txt(N, '一開始 f 全是 0：很差，但合法（feasible）'); ff.mood('happy');
  say('initial 全部是 0：合法', '');
  await step(tok);                                   // 857.0 only check P: forward or backward edges
  txt(N, '只要檢查 P 上的邊：分 forward、backward 兩種');
  say('只需檢查 path 上的差異', 'forward 或 backward 兩種');
  await step(tok);                                   // 875.0 forward edge: residual = c − f
  remove(fa); remove(fb); txt(N, '先看 forward edge');
  bar = flBarSetup(); tag('residual = c − f = 4', 'ptr', 3, 0.3, -1.2);
  say('forward edge 的 residual', '= c − f = 10 − 6 = 4');
  await step(tok);                                   // 927.8 we pour the bottleneck: b ≤ every residual
  bar.add('b ≤ c − f');
  say('灌的是 bottleneck b', 'b 是最小值：b ≤ c − f');
  await step(tok);                                   // 965.5 f′ = f + b
  for (let k = 6; k < 9; k++) { bar.cs.push(cube(null, C.hot, [0.8, 0.8, 0.8], bar.X(k), 0.4, 0, 2)); await beat(tok, 300); }
  txt(bar.fl, 'f′ = 6 + 3 = 9');
  say('f′ = f + b', '例如 b = 3：6 + 3 = 9');
  await step(tok);                                   // 995.8 use the bound b ≤ c − f
  bar.add('f′ = f + b ≤ f + (c − f)');
  say('把 b ≤ c − f 代進去', '');
  await step(tok);                                   // 1033.1 = c: f′ ≤ c
  bar.add('= c　所以 f′ ≤ c');
  say('f 消掉：f′ ≤ c', '沒有超過 capacity');
  await step(tok);                                   // 1062.8 f′ ≥ f ≥ 0
  bar.add('f′ = f + b ≥ f ≥ 0');
  say('也不會是負的', 'f′ ≥ f ≥ 0');
  await step(tok);                                   // 1093.3 0 ≤ f′ ≤ c: capacity constraint
  GOOD('forward edge：0 ≤ f′ ≤ c ✓', 0, -2.6); await cheer(tok, ff);
  say('0 ≤ f′ ≤ c', 'forward edge 符合 capacity constraint');
}]);

// 18:32 正確性 (2)：backward edge 退 b 後仍 ≥ 0
FRAG.push(['flow-l21-cap-back', 'Lec21：backward edge 退 b 後仍 ≥ 0', async (tok) => {
  fresh([0, 10, 9], [0, 0, 0.6]);
  const N = NOTE('', 0, -4.0);
  const bar = flBarSetup();
  const ff = buddy('Ford-Fulkerson', '', '#8fc6ec', -5.6, 0, -2.6, 0.7);
  await step(tok);                                   // 1112.1 now check backward edges
  txt(N, '接著檢查 backward edge');
  say('檢查 backward edge', '');
  await step(tok);                                   // 1124.8 residual = the current flow f
  tag('residual（反向）= f = 6', 'ptr', 3, 0.3, -1.2);
  say('backward 的 residual = f', '最多只能退這麼多水');
  await step(tok);                                   // 1136.5 u → v on P is v → u in G
  const t1 = tag('P 上：u → v', 'note', -3.2, 0.3, -2.6), t2 = tag('原圖 G 裡：v → u', 'note', 2.2, 0.3, -2.6);
  say('P 上的 u → v 是 backward', '代表原圖的邊是 v → u');
  await step(tok);                                   // 1169.8 before pouring f is legal: f ≤ c
  remove(t1); remove(t2); bar.add('灌水前合法：0 ≤ f ≤ c');
  say('灌水前 f 是合法的', 'f ≤ c');
  await step(tok);                                   // 1197.8 decrease: f′ = f − b
  for (let k = 5; k >= 3; k--) { glow(bar.cs[k], '#7a1010'); await beat(tok, 200); K.fly(bar.cs[k]); await beat(tok, 200); }
  txt(bar.fl, 'f′ = 6 − 3 = 3');
  say('decrease：f′ = f − b', '例如 b = 3：6 − 3 = 3');
  await step(tok);                                   // 1206.5 smaller than before: f′ ≤ f ≤ c
  bar.add('f′ ≤ f ≤ c');
  say('比原來小', 'f′ ≤ f ≤ c');
  await step(tok);                                   // 1228.8 b ≤ residual = f
  bar.add('b ≤ residual = f');
  say('b 是最小的 residual', '所以 b ≤ f');
  await step(tok);                                   // 1257.8 f′ = f − b ≥ f − f = 0
  bar.add('f′ = f − b ≥ f − f = 0');
  say('f′ ≥ f − f = 0', '不會變成負的');
  await step(tok);                                   // 1286.8 both kinds OK: capacity constraint passes
  GOOD('forward ✓　backward ✓　capacity constraint 通過', 0, -2.6); await cheer(tok, ff);
  say('forward、backward 都正常', 'capacity constraint 過關');
}]);

// 21:34 正確性 (3)：conservation — path 上的點進出都多 b
FRAG.push(['flow-l21-conserve', 'Lec21：path 上的點進出都多 b，仍守恆', async (tok) => {
  fresh(); buildNet('cons'); flView();
  const N = NOTE('', 0, 4.3);
  await step(tok);                                   // 1294.2 the conservation condition
  txt(N, '第二塊：conservation condition');
  say('接著看 conservation', '');
  await step(tok);                                   // 1300.8 every internal node: in = out
  txt(N, '更新後，每個 internal node 仍要「流入 = 流出」');
  say('任何 internal node', '流入的總量 = 流出的總量');
  await step(tok);                                   // 1315.8 only nodes on P change; s, t not checked
  txt(N, '只有 augmenting path 上的點會變；s、t 不檢查');
  say('只看 path 上的 internal node', 's、t 一個只生、一個只收');
  await step(tok);                                   // 1349.4 before: f is feasible, all balanced
  flSet([3, 2, 4, 1]); renderFlow(); nodeTag(2, '進 5 = 出 5');
  say('這一輪開始前 f 合法', '每個點都守恆');
  await step(tok);                                   // 1369.8 a small picture: v on the path
  nodeColor(2, C.hot, 0.5);
  say('畫個小圖：v 是 path 上的點', '');
  await step(tok);                                   // 1389.8 inflow = outflow according to f
  txt(N, '灌水前：進 3 + 2 = 出 4 + 1');
  say('原本進來的 = 出去的', '3 + 2 = 4 + 1');
  await step(tok);                                   // 1406.8 after: one incoming edge, one outgoing edge
  renderFlow(new Set([1, 2]));
  say('path 從一條邊進、一條邊出', 'u → v → w');
  await step(tok);                                   // 1432.8 the incoming one gets b more
  await flPkt(tok, ['u', 'v'], '+b', 900);
  NG.F[1] = 4; renderFlow(new Set([1, 2])); nodeTag(2, '進 7、出 5？');
  say('進來的邊多了 b', 'b = 2：2 → 4');
  await step(tok);                                   // 1443.8 the outgoing one also gets b more
  await flPkt(tok, ['v', 'w'], '+b', 900);
  NG.F[2] = 6; renderFlow(new Set([1, 2])); nodeTag(2, '進 7 = 出 7');
  say('出去的邊也多了 b', '4 → 6');
  await step(tok);                                   // 1476.7 equal addition: x = y ⇒ x + b = y + b
  txt(N, '等量加法：x = y ⇒ x + b = y + b');
  say('等量加法原理', 'x = y ⇒ x + b = y + b');
  await step(tok);                                   // 1494.8 every iteration's f′ is a legal flow
  renderFlow(); GOOD('每一輪的 f′ 都是合法的 flow ✓', 0, -4.2);
  say('每輪結束的 f′ 都合法', 'capacity + conservation');
}]);

// 25:28 integer capacity：先 normalize；bottleneck 每次都是整數
FRAG.push(['flow-l21-integer', 'Lec21：capacity 先 normalize 成整數', async (tok) => {
  fresh();
  const N = NOTE('', 0, 4.3);
  let M = null;
  await step(tok);                                   // 1527.8 a very important property
  txt(N, '一個常被忽略、但很重要的性質');
  say('一個非常重要的性質', '');
  await step(tok);                                   // 1538.5 assume all capacities are integers
  buildNet('lsm'); flView(); M = meter(0);
  txt(N, '假設：所有 capacity 都是整數');
  say('假設 capacity 都是 integer', '');
  await step(tok);                                   // 1546.9 they could be real numbers, 0.x
  NG.G = NETS.lsmh; NG.F = NG.G.edges.map(() => 0); flView();
  say('capacity 也可能是小數', '0.5、1.5 ……');
  await step(tok);                                   // 1561.8 normalize: divide by the gcd
  txt(N, 'normalization：全部除以最大公因數（這裡是 0.5）');
  say('先 normalize', '除以最大公因數');
  await step(tok);                                   // 1574.4 everyone becomes an integer
  NG.G = NETS.lsm; NG.F = NG.G.edges.map(() => 0); NG.val = 0; flView();
  say('每個都變成整數', '2、1、3、1、2');
  await step(tok);                                   // 1581.8 every bottleneck is a multiple of the gcd
  const p = flPath(['s', 'a', 'b', 't']); renderResidual(p);
  txt(N, '每次的 bottleneck 都是最大公因數的整數倍（1 倍、2 倍…不會 0.5 倍）');
  say('bottleneck 一定是 gcd 的倍數', '取最小、做加減都一樣');
  await step(tok);                                   // 1645.8 with decimals: +0.1, +0.0001 … unknown
  const B = BAD('小數：+0.1、+0.001、+0.0001……要幾輪？', 0, -4.3);
  say('小數的話', '可能每次只加 0.1、0.0001');
  await step(tok);                                   // 1670.8 integers: at least +1 each time
  remove(B); augment(p); renderFlow(new Set([0, 2, 4])); await cheer(tok, M, 2);
  say('整數：每次至少增加 1', '');
  await step(tok);                                   // 1683.8 upper bound 100 → at most 100 runs
  txt(N, 'upper bound 是 100 ⇒ 最多跑 100 輪一定結束');
  say('上界 100 → 最多 100 次', '');
  await step(tok);                                   // 1734.8 invariant: flow and residual stay integers
  renderResidual(); txt(N, 'invariant：每輪的 flow 和 residual capacity 都是整數');
  say('invariant property', 'flow 與 residual capacity 都是整數');
  await step(tok);                                   // 1763.8 each increase is an integer
  const p2 = flPath(['s', 'b', 'a', 't']); augment(p2); renderFlow(new Set([1, 2, 3])); await cheer(tok, M, 3);
  say('每次增加的水量都是整數', '');
}]);

// 29:44 flow 嚴格遞增：第一條邊一定是 forward
FRAG.push(['flow-l21-increase', 'Lec21：每輪 v(f) 嚴格增加 b', async (tok) => {
  fresh(); buildNet('lsm'); renderFlow();
  const M = meter(0);
  const N = NOTE('', 0, 4.3);
  const p = flPath(['s', 'a', 'b', 't']);
  let p2 = null;
  await step(tok);                                   // 1784.8 each iteration: an augmenting path, pour
  renderResidual(p);
  say('每一輪：找 augmenting path、灌水', '');
  await step(tok);                                   // 1795.0 initially f = 0
  renderFlow(); txt(N, '一開始 v(f) = 0');
  say('一開始 flow 是 0', '');
  await step(tok);                                   // 1802.5 pour bottlenecks: strictly increasing
  augment(p); renderFlow(new Set([0, 2, 4])); await cheer(tok, M, 2);
  say('一直灌 bottleneck', 'flow 嚴格遞增');
  await step(tok);                                   // 1826.8 v(f′) = v(f) + b
  txt(N, 'v(f′) = v(f) + b');
  say('v(f′) = v(f) + b', '');
  await step(tok);                                   // 1843.1 b > 0 (if 0, it already stopped)
  txt(N, 'b 一定 > 0；如果是 0，演算法早就停了');
  say('b 一定大於 0', '');
  await step(tok);                                   // 1893.8 just check the source
  nodeColor(0, C.hot, 0.4); nodeTag(0, 'v(f) = s 送出的總量');
  say('證明：只要看 source', '');
  await step(tok);                                   // 1924.9 P is simple: never back to s
  p2 = flPath(['s', 'b', 'a', 't']); renderResidual(p2);
  txt(N, 'path 是 simple：不繞圈，不會回到 s');
  say('path 是 simple', '從 s 出發一路走到 t');
  await step(tok);                                   // 1949.0 s has no incoming edge
  nodeTag(0, '只有 outgoing edge');
  say('s 沒有 incoming edge', '只會流出去');
  await step(tok);                                   // 1993.8 the first edge is a forward edge
  rhl((r) => r.i === 1 && r.dir > 0); txt(N, 'path 的第一條邊一定是 forward edge');
  say('第一條 edge 一定是 forward', '');
  await step(tok);                                   // 2004.8 so v(f) grows by b > 0
  augment(p2); renderFlow(new Set([1, 2, 3])); await cheer(tok, M, 3);
  txt(N, 's 送出的量多了 b：v(f) 嚴格增加');
  say('s 送出的量多了 b', '2 + 1 = 3');
}]);

// 33:46 running time：C = s 出邊 capacity 總和；≤ C 輪，每輪 O(m)
FRAG.push(['flow-l21-runtime', 'Lec21：最多 C 輪、每輪 O(m) → O(mC)', async (tok) => {
  fresh(); buildNet('kt'); flView();
  const VT = flVal('');
  const N = NOTE('', 0, -4.4);
  const it = buddy('iteration', '0', '#f3d2c8', 6.2, 0, -3.7, 0.7);
  await step(tok);                                   // 2026.8 how long until it ends?
  txt(VT, '多久會結束？');
  say('要花多久才會結束？', '');
  await step(tok);                                   // 2033.8 integer input → flow and G_f integers
  txt(N, 'capacity 是整數 ⇒ flow、G_f 全部是整數');
  say('input 是整數', 'flow 與 residual graph 都是整數');
  await step(tok);                                   // 2079.8 when does it stop? an upper bound
  say('什麼時候停？', '先找一個 upper bound');
  await step(tok);                                   // 2095.8 every cut is a bound; simplest: cut off s
  const L = cutLine(-3.6); flCut(new Set([0]));
  say('所有 cut 都是 upper bound', '最簡單：把 source 單獨切出來');
  await step(tok);                                   // 2124.7 C = sum of capacities out of s
  txt(VT, 'C = 10 + 10 = 20');
  say('C = s 出邊 capacity 總和', '10 + 10 = 20');
  await step(tok);                                   // 2139.9 C ≥ max flow, not necessarily the min cut
  txt(N, 'C ≥ max flow，但 C 不一定是 min cut');
  say('C ≥ max flow', '不一定是最小的');
  await step(tok);                                   // 2175.4 worst case: +1 per iteration
  unLine(L); flView();
  for (let k = 1; k <= 3; k++) { it.set(k); await beat(tok, 450); }
  say('worst case：每輪只加 1', '1、2、3、4 ……');
  await step(tok);                                   // 2187.8 at most C iterations
  it.set('≤ C'); it.mood('wow'); txt(VT, '最多 C = 20 輪一定停');
  say('最多 C 個 iteration', '一定會停');
  await step(tok);                                   // 2211.6 each iteration: construct G_f
  txt(N, '每輪①：construct residual graph — 跟邊數 m 有關');
  say('每輪要做什麼？', '先建 residual graph');
  await step(tok);                                   // 2232.3 find a path: any algorithm, linear in m
  txt(N, '每輪②：找 augmenting path — 用 BFS 或 DFS 就是 O(m)');
  say('找 augmenting path', '找路演算法跟邊數成線性');
  await step(tok);                                   // 2269.6 pour along it: at most all edges
  txt(N, '每輪③：沿路灌水 — 最多走過所有邊');
  say('沿路灌水', '也被邊數 bound 住');
  await step(tok);                                   // 2282.0 each iteration O(m)
  txt(VT, '每輪 O(m)，m = 邊數');
  say('每個 iteration：O(m)', '');
  await step(tok);                                   // 2289.0 C iterations → O(m·C)
  txt(VT, '總時間 O(m · C)'); it.mood('happy');
  say('C 輪 × O(m)', '= O(m·C)');
}]);

// 38:42 壞例子：每輪只 +1，要 200 輪；好的選法 2 輪
FRAG.push(['flow-l21-bad', 'Lec21：壞例子要 200 輪，好路徑 2 輪', async (tok) => {
  fresh();
  const N = NOTE('', 0, 4.3);
  let M = null, p = null;
  await step(tok);                                   // 2322.0 if C is huge, it may crawl: the paper's counterexample
  txt(N, 'C 很大時，怕每次只增加一點點：論文裡特別設計的反例');
  say('C 太大時要小心', '這是論文裡的反例');
  await step(tok);                                   // 2342.8 four nodes, symmetric, a thin pipe of 1
  buildNet('b100'); flView(); M = meter(0, '|f|');
  say('四個點、上下對稱', '中間一條細管 capacity 1');
  await step(tok);                                   // 2357.8 the flow network and its initial G_f
  renderResidual();
  say('initial 的 residual graph', '');
  await step(tok);                                   // 2369.4 unlucky: a path through the middle
  p = flPath(['s', 'u', 'v', 't']); renderResidual(p);
  say('運氣不好：path 經過中間', 's → u → v → t');
  await step(tok);                                   // 2373.6 bottleneck 1: +1
  txt(N, 'bottleneck = 1：只增加 1');
  say('bottleneck 在中間：1', '');
  await step(tok);                                   // 2380.4 update the flow network
  augment(p); renderFlow(new Set(p.map((r) => r.i))); await cheer(tok, M, 1, 'sad');
  say('update flow network', '|f| = 1');
  await step(tok);                                   // 2387.3 again a bad path
  p = flPath(['s', 'v', 'u', 't']); renderResidual(p);
  say('再找一條，一樣運氣很差', 's → v → u → t（退回中間那 1）');
  await step(tok);                                   // 2396.1 bottleneck 1 again
  augment(p); renderFlow(new Set(p.map((r) => r.i))); await cheer(tok, M, 2, 'sad');
  say('bottleneck 又是 1', '|f| = 2');
  await step(tok);                                   // 2407.2 upper Z, lower Z, alternating: +1 each
  for (let k = 3; k <= 4; k++) {
    p = flPath(k % 2 ? ['s', 'u', 'v', 't'] : ['s', 'v', 'u', 't']); augment(p); renderFlow(new Set(p.map((r) => r.i))); M.set(k);
    await beat(tok, 700);
  }
  say('上面的 Z、下面的 Z 輪流找', '每次只加 1');
  await step(tok);                                   // 2424.2 C = 100 + 100 = 200 iterations
  txt(N, 'C = 100 + 100 = 200 ⇒ worst case 要 200 輪');
  say('C = 100 + 100 = 200', 'worst case 跑 200 個 iteration');
  await step(tok);                                   // 2433.6 optimum 200: top 100, bottom 100 — 2 rounds
  flSet([0, 0, 0, 0, 0]); M.set(0);
  for (const ps of [['s', 'u', 't'], ['s', 'v', 't']]) { p = flPath(ps); augment(p); renderFlow(new Set(p.map((r) => r.i))); M.set(NG.val); await beat(tok, 800); }
  await cheer(tok, M, 200);
  say('好的灌法：上 100、下 100', '兩個 iteration 就結束');
  await step(tok);                                   // 2441.7 unlucky: 200 iterations
  txt(N, '運氣差：200 輪；運氣好：2 輪 ⇒ 直接 run 不見得是好做法');
  say('運氣差就要 200 輪', '');
}]);

// 41:12 pseudo-polynomial：m 是 input size，C 是數值
FRAG.push(['flow-l21-pseudo', 'Lec21：O(mC) 是 pseudo-polynomial', async (tok) => {
  fresh([0, 10, 10], [0, 1.6, 0.8]);
  const N = NOTE('', 0, 4.2);
  const ms = [], tw = [];
  await step(tok);                                   // 2471.8 running time
  const VT = tag('running time = ?', 'ptr alt', 0, 0.3, -2.6);
  say('running time 是多少？', '');
  await step(tok);                                   // 2479.8 worst case: +1 each → C iterations
  txt(VT, 'worst case：C 個 iteration');
  say('worst case 每次加 1', '要 C 個 iteration');
  await step(tok);                                   // 2490.9 each O(m) → m × C
  txt(VT, 'C 輪 × 每輪 O(m) = O(m · C)');
  say('每輪 O(m)', '總共 O(m·C)');
  await step(tok);                                   // 2518.8 is it polynomial time? no
  const B = BAD('polynomial time？ ✗', 0, -1.4);
  say('這是 polynomial time 嗎？', '不是！');
  await step(tok);                                   // 2539.6 m is the input size: how many edges
  for (let k = 0; k < 5; k++) { ms.push(cube('e', '#cfe0f0', [0.8, 0.8, 0.8], -5 + k, 0.4, 0.6, 2)); await beat(tok, 200); }
  tag('m = 邊數（input size）', 'ptr', -3, 0.3, 1.9);
  say('m 是 input size', '告訴你有幾條 edge');
  await step(tok);                                   // 2551.6 C is a parameter: few edges, huge capacity
  for (let k = 0; k < 4; k++) { tw.push(cube(null, '#f3d2c8', [1.2, 0.8, 1.2], 3.5, 0.4 + 0.82 * k, 0.6, 2)); await beat(tok, 200); }
  tag('C = capacity 的「數值」', 'ptr', 3.5, 0.3, 1.9);
  say('C 是一個參數', 'edge 很少、capacity 可以很大');
  await step(tok);                                   // 2565.9 huge C → very many iterations
  for (let k = 4; k < 7; k++) { tw.push(cube(k === 6 ? '10⁶' : null, '#f3d2c8', [1.2, 0.8, 1.2], 3.5, 0.4 + 0.82 * k, 0.6, 2)); await beat(tok, 200); }
  say('C 很大時', 'worst case 要非常多 iteration');
  await step(tok);                                   // 2576.0 looks polynomial, but isn't
  txt(N, '看起來像兩個一次方相乘，但 C 跟 input size 無關');
  say('看起來很像 polynomial', '但其實不是');
  await step(tok);                                   // 2594.8 pseudo-polynomial time
  remove(B); txt(VT, 'O(m · C)：pseudo-polynomial time');
  say('這叫 pseudo-polynomial time', '');
  await step(tok);                                   // 2597.8 seen before: knapsack, subset sum
  const K2 = tag('之前：Knapsack、Subset sum', 'ptr alt', 0, 0.3, 3.2);
  say('之前也遇過', 'Knapsack 與 Subset sum（DP）');
  await step(tok);                                   // 2615.8 O(nW): n items, W the bag's capacity
  txt(K2, 'Knapsack：O(n · W)，W = 背包容量（也是數值）');
  say('O(n·W)', 'n 是物品數、W 是背包容量');
  await step(tok);                                   // 2634.8 the DP table can be huge
  txt(N, '物品很少、背包很大 ⇒ 表格超大，一樣不是好做法');
  say('W 一大，表格就超大', '同樣的問題');
}]);

// 44:03 挑好 augmenting path：最大 bottleneck、最少邊（BFS）、Δ-scaling
FRAG.push(['flow-l21-strategies', 'Lec21：挑好路徑的三種策略', async (tok) => {
  fresh(); buildNet('b100'); flView();
  const VT = flVal('');
  const N = NOTE('', 0, -4.4);
  const M = meter(0, '|f|');
  await step(tok);                                   // 2643.8 last topic: finding good augmenting paths
  txt(VT, '最後的議題：找好的 augmenting path');
  say('怎麼找好的 augmenting path？', '');
  await step(tok);                                   // 2649.8 unlucky = slow; good = 2 iterations
  txt(N, '運氣差就很慢；找得好，兩個 iteration 就結束');
  say('找得好就很快', '');
  await step(tok);                                   // 2667.8 good: the top and the bottom
  for (const ps of [['s', 'u', 't'], ['s', 'v', 't']]) { const p = flPath(ps); augment(p); renderFlow(new Set(p.map((r) => r.i))); M.set(NG.val); await beat(tok, 800); }
  await cheer(tok, M, 200);
  say('好的 path：上面、下面', '兩個 iteration 結束');
  await step(tok);                                   // 2678.0 complexity depends on how you pick
  flSet([0, 0, 0, 0, 0]); flView(); M.set(0); M.mood('calm');
  txt(N, '複雜度取決於：每次怎麼挑 augmenting path');
  say('複雜度決定於怎麼挑 path', '');
  await step(tok);                                   // 2697.8 a few strategies
  txt(VT, '幾個策略（知道概念就好）');
  say('有幾個 strategies', '');
  await step(tok);                                   // 2715.8 1: the largest bottleneck
  const p = flPath(['s', 'u', 't']); renderResidual(p); txt(VT, '策略 1：挑 bottleneck 最大的');
  say('策略 1：bottleneck 大的', '當輪灌比較多');
  await step(tok);                                   // 2726.1 2: the fewest edges
  txt(VT, '策略 2：挑 edge 最少的');
  say('策略 2：edge 最少的 path', '');
  await step(tok);                                   // 2736.8 with BFS
  txt(N, '用 BFS：最快找到兩點間「經過最少邊」的路（2 條邊）');
  say('配合 BFS 就做得到', '');
  await step(tok);                                   // 2751.8 3: Δ-scaling
  flView(); txt(VT, '策略 3：Δ-scaling');
  say('策略 3：Δ-scaling', '控制 bottleneck 的大小');
  await step(tok);                                   // 2774.8 start high: ignore edges below Δ
  flView(null, null, new Set([2])); txt(N, '先設很大的門檻 Δ：容量 < Δ 的水管先假裝不存在');
  say('先卡一個大門檻 Δ', '小水管先不管');
  await step(tok);                                   // 2791.8 pour with the big pipes first
  flSet([100, 100, 0, 100, 100]); clearEdges(); NG.G.edges.forEach(([u, v, c], i) => { if (i !== 2) addEdge(u, v, fB(NG.F[i]) + '/' + c, 0, C.sat, 2.4); });
  await cheer(tok, M, 200);
  say('先用大水管灌水', '');
  await step(tok);                                   // 2799.8 then relax Δ, open the small pipes
  renderFlow(); txt(VT, 'Δ 慢慢放寬：再開放小水管');
  say('再慢慢放寬 Δ', '把小水管開放出來');
  await step(tok);                                   // 2830.8 avoids thin pipes early
  txt(N, '好處：一開始就不會走到細水管，bottleneck 不會太小');
  say('避免一開始走細水管', '加快整個速度');
}]);

// 48:03 定理：三個敘述互推
FRAG.push(['flow-l21-three', 'Lec21：max-flow min-cut 的三個敘述', async (tok) => {
  fresh();
  let s1 = null, s2 = null, s3 = null;
  await step(tok);                                   // 2881.8 a very important theorem
  const T = SAY('Max-flow min-cut theorem', 0, -4.4);
  say('Max-flow min-cut theorem', '講 network flow 一定會提到');
  await step(tok);                                   // 2898.7 max flow value = min cut capacity
  txt(T, 'max flow 的值 ＝ min cut 的 capacity');
  say('max flow = min cut', '兩個值相等');
  await step(tok);                                   // 2918.8 proven via three statements
  NOTE('證法：① ⇒ ② ⇒ ③ ⇒ ①', 0, 4.4);
  say('透過三個 statement 證明', '1 推 2、2 推 3、3 推回 1');
  await step(tok);                                   // 2935.1 (1) there is a cut with v(f) = cap
  s1 = tag('① 存在 cut (A, B)：v(f) = cap(A, B)', 'ptr', 0, 0.3, -3.0); flLit(s1, true);
  say('① 存在一個 cut', 'flow 剛好等於它的 capacity');
  await step(tok);                                   // 2948.8 (2) f is a maximum flow
  flLit(s1, false); s2 = tag('② f 是 maximum flow', 'ptr', 3.8, 0.3, 2.4); flLit(s2, true);
  say('② f 是 maximum flow', '');
  await step(tok);                                   // 2952.2 (3) no augmenting path for f
  flLit(s2, false); s3 = tag('③ G_f 找不到 augmenting path', 'ptr', -3.8, 0.3, 2.4); flLit(s3, true);
  say('③ 找不到 augmenting path', '');
  await step(tok);                                   // 2962.8 and back again
  flLit(s3, false);
  arrow(V3(1.2, 0.3, -2.4), V3(3.2, 0.3, 1.7), 0x2f7fd0);
  arrow(V3(2, 0.3, 2.4), V3(-1.6, 0.3, 2.4), 0x2f7fd0);
  arrow(V3(-3.2, 0.3, 1.7), V3(-1.2, 0.3, -2.4), 0x2f7fd0);
  say('看起來都很自然', '再從 ③ 推回 ①');
}]);

// 49:44 重新錄影：定理重述（量測、cut、三個敘述）
FRAG.push(['flow-l21-three2', 'Lec21：定理重述與 cut 的定義', async (tok) => {
  fresh();
  const T = SAY('', 0, -4.4);
  let N = null, VT = null, s1 = null, s2 = null, s3 = null;
  await step(tok);                                   // 2985.8 (re-recorded) the theorem
  txt(T, 'Max-flow min-cut theorem');
  say('今天的主角', 'max-flow min-cut theorem');
  await step(tok);                                   // 2996.8 why Ford-Fulkerson is correct
  txt(T, '為什麼 Ford-Fulkerson 跑完是對的？');
  say('Ford-Fulkerson 為什麼正確', '它最後會找到 max flow');
  await step(tok);                                   // 3017.8 max flow value = min cut value
  txt(T, 'max flow 的總值 ＝ min cut 上的 value');
  say('max flow = min cut', '');
  await step(tok);                                   // 3027.1 measure the flow at the source
  buildNet('kt'); flSet(KT19); renderFlow(); flPaint(0, C.hot, 2.6); flPaint(1, C.hot, 2.6);
  VT = flVal('v(f) = source 送出 = 10 + 9 = 19');
  say('flow 從 source 端量', 'source 只會 generate flow');
  await step(tok);                                   // 3055.0 a cut: any partition with s ∈ A, t ∈ B
  flCut(new Set([0, 2]), { flow: true }); N = NOTE('cut：把點分成兩半，s ∈ A、t ∈ B', 0, 4.3);
  say('cut：任何一種分成兩半的 partition', 's、t 在不同側');
  await step(tok);                                   // 3077.0 its value: capacities of the cut edges
  txt(VT, 'cut 的值：切到的邊的 capacity 總和');
  say('cut 的值', '切到的 edge 的 capacity 總和');
  await step(tok);                                   // 3083.0 only A → B edges count
  flPaint(0, C.sat, 2.8); flPaint(5, C.sat, 2.8); txt(VT, '只算 A → B：10 + 9');
  say('只算從 A 流向 B 的邊', '');
  await step(tok);                                   // 3094.0 backward edges B → A don't count
  flPaint(2, C.back, 2.6); txt(N, 'B → A（從 sink 側倒流回來）的邊不計：可以讓它不流水');
  say('倒流回來的 backward 邊不計', '');
  await step(tok);                                   // 3128.0 at the optimum they are equal
  txt(VT, 'optimal 時：v(f) = 19 = cap(A, B) = 19');
  say('到 optimal solution 時', '兩個值相等');
  await step(tok);                                   // 3136.0 prove three statements imply each other
  fresh();
  const T2 = SAY('證明：三個 statement 互相推導', 0, -4.4);
  say('要證三個 statement', '互相推導到對方');
  await step(tok);                                   // 3146.0 (1) a cut with v(f) = its capacity
  s1 = tag('① 存在 cut (A, B)：v(f) = cap(A, B)', 'ptr', 0, 0.3, -3.0); flLit(s1, true);
  say('① 可以找到一個 cut', 'flow 的值 = 這個 cut 的 capacity');
  await step(tok);                                   // 3180.9 (2) then the flow is maximum
  flLit(s1, false); s2 = tag('② f 是 maximum flow', 'ptr', 3.8, 0.3, 2.4); flLit(s2, true);
  say('② 這時的 flow 是 maximum', '');
  await step(tok);                                   // 3191.0 (3) no augmenting path
  flLit(s2, false); s3 = tag('③ 不存在 augmenting path', 'ptr', -3.8, 0.3, 2.4); flLit(s3, true);
  say('③ 找不到 augmenting path', '');
  await step(tok);                                   // 3205.2 1 ⇒ 2, 2 ⇒ 3, 3 ⇒ 1
  flLit(s3, false);
  arrow(V3(1.2, 0.3, -2.4), V3(3.2, 0.3, 1.7), 0x2f7fd0);
  arrow(V3(2, 0.3, 2.4), V3(-1.6, 0.3, 2.4), 0x2f7fd0);
  arrow(V3(-3.2, 0.3, 1.7), V3(-1.2, 0.3, -2.4), 0x2f7fd0);
  say('1 推 2、2 推 3、3 推回 1', '三個都成立就證完');
  await step(tok);                                   // 3222.0 the point: such a flow exists and is max
  flLit(s1, true); flLit(s2, true);
  txt(T2, '重點：找得到 flow = cut，而且那個 flow 就是 max flow');
  say('重點：flow 剛好等於某個 cut', '而它就是 max flow');
}]);

// 54:06 ② ⇒ ③：有 augmenting path 就能再推，矛盾
FRAG.push(['flow-l21-2to3', 'Lec21：② ⇒ ③，用反證法', async (tok) => {
  fresh(); buildNet('lsm'); flSet([2, 0, 2, 0, 2]); renderFlow();
  const M = meter(2, 'v(f)');
  const VT = flVal('');
  const N = NOTE('', 0, -4.4);
  const p = flPath(['s', 'b', 'a', 't']);
  await step(tok);                                   // 3246.0 the easiest: 2 ⇒ 3
  txt(VT, '先證最簡單的：② ⇒ ③');
  say('從 2 推到 3 開始', '最容易');
  await step(tok);                                   // 3254.0 by contradiction
  txt(N, '用反證法：假設結論不成立，推出矛盾');
  say('用反證法', '');
  await step(tok);                                   // 3259.0 goal: f max ⇒ no augmenting path
  txt(VT, '要證：f 是 max flow ⇒ 找不到 augmenting path');
  say('若 f 是 max flow', '就找不到 augmenting path');
  await step(tok);                                   // 3286.0 suppose f has an augmenting path
  renderResidual(p); M.mood('wow');
  txt(VT, '假設：f 是 max flow，但 G_f 有 augmenting path');
  say('假設相反的情況', 'f 有一條 augmenting path');
  await step(tok);                                   // 3309.0 then we can send more flow along it
  await flPkt(tok, ['s', 'b', 'a', 't'], '+b');
  say('沿這條 path 可以送更多 flow', '');
  await step(tok);                                   // 3334.0 bottleneck > 0: increase
  augment(p); renderFlow(new Set([1, 2, 3])); await cheer(tok, M, 3);
  say('bottleneck > 0：flow 增加', '2 → 3');
  await step(tok);                                   // 3345.0 then f wasn't maximum: contradiction
  BAD('flow 還能變大 ⇒ f 不是最大：矛盾！', 0, 4.3);
  say('那 f 就不是最大的', 'contradiction');
  await step(tok);                                   // 3358.0 proved: ② ⇒ ③
  renderResidual(); const S = reachS(); for (let v = 0; v < GR.n; v++) nodeColor(v, S.has(v) ? C.S : C.T, 0);
  txt(VT, '得證：f 是 max flow ⇒ G_f 中 s 走不到 t');
  say('證完：2 推到 3', '');
}]);

// 56:22 weak duality 推導：A 內部的邊互相抵消
FRAG.push(['flow-l21-weak', 'Lec21：weak duality，內部的邊一加一減', async (tok) => {
  fresh(); buildNet('kt'); flSet(KT17); renderFlow();
  const VT = flVal('');
  const N = NOTE('', 0, -4.4);
  const S = new Set([0, 1, 3]);
  await step(tok);                                   // 3386.0 first prove weak duality
  txt(VT, '證 ① ⇒ ② 之前：先證 weak duality');
  say('先證 weak duality', '比較弱一點的敘述');
  await step(tok);                                   // 3413.7 any flow f, any cut: cap ≥ v(f)
  txt(VT, '任何 flow f、任何 cut (A, B)：cap(A, B) ≥ v(f)');
  say('任何 cut 的 capacity', '都 ≥ 目前的 flow 值');
  await step(tok);                                   // 3444.8 we observed it: any cut is an upper bound
  txt(N, '之前用觀察的：隨便一刀都是 upper bound；現在用推導');
  say('之前是用體會的', '現在用推導');
  await step(tok);                                   // 3468.0 start from the definition of v(f)
  txt(N, 'by definition：v(f) 從 source 端量');
  say('從 flow 的定義開始', '');
  await step(tok);                                   // 3503.1 sum of s's outgoing flows
  renderFlow(new Set([0, 1])); nodeTag(0, '出 8 + 9 = 17');
  txt(VT, 'v(f) = Σ s 出去的 flow = 17');
  say('s 出去的邊上 flow 加起來', '8 + 9 = 17');
  await step(tok);                                   // 3537.0 subtract a 0: s has no incoming edge
  nodeTag(0, '出 − 進（進 = 0）');
  txt(VT, 'v(f) = Σ 出 − Σ 進（s 的進 = 0）');
  say('減一個 0', 's 沒有 incoming edge');
  await step(tok);                                   // 3584.7 bring in the cut: s ∈ A, t ∈ B
  flCut(S, { flow: true }); txt(N, '任取一個 cut：A = {s, a, c}，B = {b, d, t}');
  say('把 cut 拉進來', 's ∈ A、t ∈ B');
  await step(tok);                                   // 3605.0 add more 0s: each other node in A
  nodeTag(1, '出 − 進 = 0'); nodeTag(3, '出 − 進 = 0');
  say('再加一些 0 的項', 'A 中其他點：出 − 進 = 0（守恆）');
  await step(tok);                                   // 3662.0 expand
  txt(VT, 'v(f) = Σ over v ∈ A（v 的出 − v 的進）');
  say('展開這個 summation', '');
  await step(tok);                                   // 3686.1 = every node in A: out − in
  [0, 1, 3].forEach((v) => nodeColor(v, C.hot, 0.3));
  say('算的是 A 這側每個點', '出去的 − 進來的');
  await step(tok);                                   // 3718.0 by edges: + at the tail, − at the head
  [0, 1, 3].forEach((v) => nodeColor(v, C.S, 0.2));
  txt(N, '換成 edge 的角度：每條邊在出發點算 +，在到達點算 −');
  say('改用 edge 的觀點', '出發端 +、到達端 −');
  await step(tok);                                   // 3771.3 inside A: + and − cancel
  [0, 1, 3].forEach((v) => nodeTag(v, '')); flPaint(0, C.dim, 0.6); flPaint(3, C.dim, 0.6);
  txt(N, 'A 內部的邊（s → a、a → c）一加一減，互相抵消');
  say('A 內部的邊一加一減', '就不見了');
  await step(tok);                                   // 3814.0 who isn't cancelled? the cut edges
  [1, 2, 4, 6, 7].forEach((i) => flPaint(i, C.hot, 2.4));
  say('誰沒被抵消？', '跨過 cut 的邊');
  await step(tok);                                   // 3844.0 outgoing: +; incoming (backward): −
  flPaint(6, C.back, 2.6); txt(N, '出 A 的邊貢獻 +；進 A 的 backward 邊（d → c）貢獻 −');
  say('出 A：+', '進 A（backward）：−');
  await step(tok);                                   // 3860.5 v(f) = Σ out of A − Σ into A
  txt(VT, 'v(f) = 9 + 0 + 5 + 9 − 6 = 17');
  say('v(f) = Σ 出 A − Σ 進 A', '23 − 6 = 17');
}]);

// 64:36 不等式：v(f) ≤ f_out(A) ≤ cap(A, B)；① ⇒ ②
FRAG.push(['flow-l21-weakbound', 'Lec21：v(f) ≤ cap(A, B)，推出 ① ⇒ ②', async (tok) => {
  fresh(); buildNet('kt'); flSet(KT17);
  const S = new Set([0, 1, 3]);
  flCut(S, { flow: true });
  const VT = flVal('v(f) = 23 − 6 = 17');
  const N = NOTE('', 0, -4.4);
  await step(tok);                                   // 3875.7 every edge's flow is ≥ 0
  txt(N, '每條邊的 flow ≥ 0（capacity condition）');
  say('任何 edge 上的 flow ≥ 0', '');
  await step(tok);                                   // 3903.9 subtracting ≥ 0 only makes it smaller
  flPaint(6, C.dim, 0.6); txt(VT, 'v(f) ≤ Σ 出 A 的 flow = 23');
  say('減掉 ≥ 0 的數只會變小', 'v(f) ≤ 第一項 = 23');
  await step(tok);                                   // 3928.4 that resembles the cut capacity
  txt(N, 'cut (A, B) 的 capacity：A → B 的邊的 capacity 總和（backward 不算）');
  say('cut 的 capacity 怎麼算？', '只算 A 流向 B 的邊');
  await step(tok);                                   // 3960.0 each flow ≤ its capacity
  flCut(S); txt(VT, '每條邊 f ≤ c：把 flow 換成 capacity');
  say('每條邊 flow ≤ capacity', '換成 upper bound');
  await step(tok);                                   // 3977.2 the sum = cap(A, B)
  txt(VT, '23 ≤ 10 + 2 + 8 + 10 = 30 = cap(A, B)');
  say('加起來就是 cut 的 capacity', '30');
  await step(tok);                                   // 3990.1 any flow ≤ any cut
  txt(VT, 'v(f) = 17 ≤ 30 = cap(A, B)');
  txt(N, '對任何 flow、任何 cut 都成立：weak duality');
  say('任何 flow ≤ 任何 cut', 'weak duality');
  await step(tok);                                   // 4012.4 then ① ⇒ ② is a direct corollary
  txt(N, '有了這個不等式，① ⇒ ② 就是直接推論');
  say('① ⇒ ② 是直接推論', '');
  await step(tok);                                   // 4028.0 (1): a flow equals some cut
  flSet(KT19); flUncolor(); flCut(new Set([0, 2]), { flow: true });
  txt(VT, '①：v(f) = 19 = cap(A, B)');
  say('若某個 flow 剛好等於某個 cut', '');
  await step(tok);                                   // 4058.0 it already hit the ceiling: max
  txt(VT, '已經碰到上限 ⇒ 不可能再大 ⇒ ② max flow');
  say('flow 已經漲到最高', '所以它就是 max flow');
}]);

// 67:59 ③ ⇒ ①：A = G_f 中 s 走得到的點；A→B 滿、B→A 為 0
FRAG.push(['flow-l21-3to1', 'Lec21：③ ⇒ ①，s 可到達的點形成 cut', async (tok) => {
  fresh(); buildNet('kt'); flSet(KT19); renderResidual();
  const VT = flVal('');
  const N = NOTE('', 0, -4.4);
  let S = null;
  await step(tok);                                   // 4079.3 the last one: 3 ⇒ 1
  txt(VT, '最後一個：③ ⇒ ①');
  say('最後證 3 推回 1', '');
  await step(tok);                                   // 4105.0 (3) no augmenting path ⇒ (1) equals some cut
  txt(VT, '沒有 augmenting path ⇒ flow 剛好等於某個 cut');
  say('沒有 augmenting path', '就有一個 cut 等於 flow');
  await step(tok);                                   // 4127.0 meaning: in G_f, s cannot reach t
  txt(N, '沒有 augmenting path ＝ G_f 裡 s 走不到 t');
  say('在 G_f 上 s 走不到 t', '');
  await step(tok);                                   // 4174.0 it may reach some nodes, then gets stuck
  nodeColor(0, C.hot, 0.4);
  say('s 可能走出去一些', '然後就 stuck 了');
  await step(tok);                                   // 4183.5 like before: s only reaches b
  rhl((r) => r.u === 0 || r.u === 2); nodeColor(2, C.hot, 0.4);
  say('像之前的例子', 's 只能走到 b');
  await step(tok);                                   // 4202.0 gather what s reaches: call it A
  S = reachS(); for (let v = 0; v < GR.n; v++) nodeColor(v, S.has(v) ? C.S : C.T, S.has(v) ? 0.3 : 0);
  say('把 s 能 reach 的點包起來', '叫做 A');
  await step(tok);                                   // 4242.0 s ∈ A
  nodeTag(0, 's ∈ A');
  say('s 當然屬於 A', '');
  await step(tok);                                   // 4250.0 s can't reach t: t ∈ B
  nodeTag(5, 't ∈ B');
  say('s 走不到 t：t 在 B', '自然分成兩半');
  await step(tok);                                   // 4269.0 compute the flow: what s sends out
  nodeTag(0, ''); nodeTag(5, ''); renderFlow(new Set([0, 1]));
  txt(VT, 'v(f) = source 送出的總和');
  say('算一下這個 flow', '從 source 送出的總和');
  await step(tok);                                   // 4291.0 like weak duality: out of A − into A
  flCut(S, { flow: true }); txt(VT, 'v(f) = Σ A → B 的 flow − Σ B → A 的 flow');
  say('跟 weak duality 一樣推', '出 A − 進 A');
  await step(tok);                                   // 4366.0 the second sum is 0: B → A edges carry nothing
  flPaint(2, C.back, 2.6); txt(N, 'B → A 的邊（a → b）：flow 一定是 0');
  say('第二項是 0', 'B → A 的邊沒有 flow');
  await step(tok);                                   // 4434.3 otherwise G_f would have an undo edge out of A
  txt(N, '如果它有水，G_f 會多一條往外的退水邊，s 就能再走出去：矛盾');
  say('有 flow 就有退水邊', 's 就能走出去，矛盾');
  await step(tok);                                   // 4520.9 the first sum: those edges are full
  flPaint(0, C.sat, 2.8); flPaint(5, C.sat, 2.8);
  txt(N, 'A → B 的邊都流滿（不然 G_f 有 forward edge 可走）');
  say('A → B 的邊都流到滿', 'flow = capacity');
  await step(tok);                                   // 4541.0 = cap(A, B)
  txt(VT, 'v(f) = 10 + 9 − 0 = 19 = cap(A, B)');
  say('v(f) = cap(A, B)', '10 + 9 = 19');
}]);

// 75:47 總結：三個敘述完成；min cut 只算 forward
FRAG.push(['flow-l21-summary', 'Lec21：定理得證與總結', async (tok) => {
  fresh();
  const s1 = tag('① v(f) = cap(A, B)', 'ptr', 0, 0.3, -3.0), s2 = tag('② max flow', 'ptr', 3.8, 0.3, 2.4), s3 = tag('③ 沒有 augmenting path', 'ptr', -3.8, 0.3, 2.4);
  await step(tok);                                   // 4547.0 done: 1 ⇒ 2, 2 ⇒ 3, 3 ⇒ 1
  arrow(V3(1.2, 0.3, -2.4), V3(3.2, 0.3, 1.7), 0x2f7fd0);
  arrow(V3(2, 0.3, 2.4), V3(-1.6, 0.3, 2.4), 0x2f7fd0);
  arrow(V3(-3.2, 0.3, 1.7), V3(-1.2, 0.3, -2.4), 0x2f7fd0);
  [s1, s2, s3].forEach((s) => flLit(s, true));
  say('1 推 2、2 推 3、3 推回 1', '全部完成');
  await step(tok);                                   // 4552.0 we get the max-flow min-cut theorem
  const T = SAY('Max-flow min-cut theorem 得證', 0, -4.4);
  say('得到 max-flow min-cut theorem', '');
  await step(tok);                                   // 4558.0 finding the max flow finds a min cut
  fresh(); buildNet('kt'); flSet(KT19); flCut(new Set([0, 2]), { flow: true });
  const VT = flVal('max flow = 19 = min cut');
  say('找到 max flow', '也同時找到 min cut');
  await step(tok);                                   // 4569.5 the min cut: only forward edges count
  flPaint(0, C.sat, 2.8); flPaint(5, C.sat, 2.8); flPaint(2, C.back, 2.4);
  txt(VT, 'min cut 只算 forward：10 + 9 = 19');
  say('min cut 只算 forward 方向', 'source 側流向 sink 側');
  await step(tok);                                   // 4586.1 a famous, beautiful theorem
  const a = buddy('max flow', '19', '#9fd3f0', -6.2, 0, -3.7, 0.7), b = buddy('min cut', '19', '#f3d2c8', 6.2, 0, -3.7, 0.7);
  a.mood('happy'); b.mood('happy'); await a.hop(tok);
  say('定理漂亮、演算法又乾淨', '所以大家都喜歡 network flow');
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
    quiz: genQ,
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['flow-network', 'residual-graph', 'augment-cancel', 'ford-fulkerson', 'ff-bad-case', 'min-cut', 'maxflow-mincut', 'super-source', 'bipartite-matching'].concat(FRAG.map((f) => f[0])),
    stop() { clearTimeout(timer); epoch++; },
  };
}
