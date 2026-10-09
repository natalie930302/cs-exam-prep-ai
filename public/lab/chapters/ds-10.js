// 資料結構 第10章：圖演算法（Kruskal、Prim、Dijkstra、Bellman-Ford、Floyd-Warshall）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
//
// 範例來源（跟著本章影片走）：
//  • Dijkstra：影片「Dijkstra Algorithm」(HlFsexTpM4Q) 的 s, a, b, c 範例——
//    explored / unexplored 兩個集合、每個頂點標 D（目前最短距離）與 P（parent），最後沿 parent 回推路徑。
//  • Prim / Kruskal：Abdul Bari「Prim's and Kruskal's Algorithms」的 7 個頂點範例（MST cost = 99；
//    跟洪逸／Horowitz 課本那張圖相同，只是頂點編號從 1 開始）。
//  • Bellman-Ford、Floyd-Warshall：洪逸／Horowitz 的慣例（Floyd 用 A^(−1) = 成本矩陣、A^k 允許經過 0..k）。
import kit from './_kit.js';

export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  let timer = null;
  let epoch = 0;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const INF = Infinity;
  const fmt = (d) => (d === INF ? '∞' : String(d));
  const SET_COLORS = ['#2fc092', '#4b9ee2', '#9b7ef4', '#e55a9b', '#dd8238', '#31aab0', '#c08a1f', '#5c7a4a'];
  const C = { node: '#cbbd9f', edge: '#a8987c', hot: '#e8b02a', ok: '#2fc092', bad: '#d64545', tree: '#2f7fd0', pq: '#e6c36a', dim: '#ddd2bd', explored: '#2fc092', cur: '#c08a1f' };

  // ───────────────────────── 圖 ─────────────────────────
  // pos: [x, z]（地板座標）；edges: [u, v, w]
  const GRAPHS = {
    bari: { title: 'Abdul Bari 範例（7 頂點）', directed: false, names: ['1', '2', '3', '4', '5', '6', '7'],
      pos: [[0, -3.3], [3.7, -1.7], [3.3, 1.9], [0, 3.3], [-3.3, 1.9], [-3.7, -1.7], [0, 0]],
      edges: [[0, 1, 28], [0, 5, 10], [1, 2, 16], [1, 6, 14], [2, 3, 12], [3, 4, 22], [3, 6, 18], [4, 5, 25], [4, 6, 24]] },
    video: { title: '影片範例 s, a, b, c', directed: false, names: ['s', 'a', 'b', 'c'],
      pos: [[-4.5, 0], [-0.5, -2.6], [-0.5, 2.6], [4.2, 0]],
      edges: [[0, 1, 1], [0, 2, 3], [1, 2, 1], [1, 3, 10], [2, 3, 4]] },
    six: { title: '6 頂點有向圖', directed: true, names: ['0', '1', '2', '3', '4', '5'],
      pos: [[-4.6, -1.4], [0, -3.2], [4.6, -1.4], [-3.2, 2.6], [1.4, 2.6], [5, 3]],
      edges: [[0, 1, 50], [0, 2, 45], [0, 3, 10], [1, 2, 10], [1, 3, 15], [2, 4, 30], [3, 0, 20], [3, 4, 15], [4, 1, 20], [4, 2, 35], [5, 4, 3]] },
    neg: { title: '負邊反例', directed: true, names: ['s', 'a', 'b', 'c'],
      pos: [[-4.5, 0], [0, -2.4], [0, 2.4], [4.5, 0]],
      edges: [[0, 1, 2], [0, 2, 4], [2, 1, -3], [1, 3, 1]] },
    bf: { title: '負邊有向圖（7 頂點）', directed: true, names: ['0', '1', '2', '3', '4', '5', '6'],
      pos: [[-5, 0], [-1.8, -2.8], [-1.8, 0], [-1.8, 2.8], [1.8, -2.2], [1.8, 2.2], [5, 0]],
      edges: [[0, 1, 6], [0, 2, 5], [0, 3, 5], [1, 4, -1], [2, 1, -2], [2, 4, 1], [3, 2, -2], [3, 5, -1], [4, 6, 3], [5, 6, 3]] },
    cycle: { title: '含負 cycle', directed: true, names: ['s', 'a', 'b', 'c'],
      pos: [[-4.5, 0], [-0.6, -2.4], [3.8, 0], [-0.6, 2.4]],
      edges: [[0, 1, 1], [1, 2, -1], [2, 3, -1], [3, 1, 1], [0, 3, 4]] },
    fw3: { title: '3 頂點（例）', directed: true, names: ['0', '1', '2'],
      pos: [[-5.6, -1.6], [-2.2, -1.6], [-3.9, 1.7]],
      edges: [[0, 1, 4], [0, 2, 11], [1, 0, 6], [1, 2, 2], [2, 0, 3]] },
    fw4: { title: '4 頂點', directed: true, names: ['0', '1', '2', '3'],
      pos: [[-5.8, -1.8], [-2.2, -1.8], [-2.2, 1.8], [-5.8, 1.8]],
      edges: [[0, 1, 3], [0, 3, 7], [1, 0, 8], [1, 2, 2], [2, 0, 5], [2, 3, 1], [3, 0, 2]] },
  };

  async function wait(tok, ms) {
    const e = epoch;
    if (tok !== undefined) await beat(tok, ms); else await sleep(ms);
    if (e !== epoch) throw new Error('mode changed');
  }
  function drop(o) { if (!o) return; lab.world.remove(o); o.traverse((c) => { if (c.element) c.element.remove(); }); }
  function txt(text, cls, pos) { const l = lab.label(text, cls); l.position.copy(pos); lab.world.add(l); return l; }
  function rod(a, b, color, r = 0.06) {
    const d = b.clone().sub(a);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Math.max(0.001, d.length()), 10), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
    m.castShadow = true;
    lab.world.add(m);
    return m;
  }

  let GR = null; // the graph currently on stage
  function buildGraph(key, xShift = 0) {
    const G = GRAPHS[key];
    const gr = { key, G, n: G.names.length, nodes: [], edges: [] };
    const P = (i) => V(G.pos[i][0] + xShift, 0.12, G.pos[i][1]);
    G.names.forEach((nm, i) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.5, 28), new THREE.MeshStandardMaterial({ color: C.node, roughness: 0.5 }));
      mesh.castShadow = true;
      mesh.add(lab.label(nm, 'val'));
      const tag = lab.label('', 'ptr');
      tag.position.set(0, 0.85, 0);
      tag.element.style.display = 'none';
      mesh.add(tag);
      mesh.position.copy(P(i)).setY(4);
      const b = lab.addBody(mesh);
      lab.dropTo(b, P(i).setY(0.25));
      gr.nodes.push({ b, mesh, tag, home: P(i).setY(0.25) });
    });
    G.edges.forEach(([u, v, w], i) => {
      let a = P(u), c = P(v);
      const dir = c.clone().sub(a).normalize();
      const perp = V(-dir.z, 0, dir.x);
      const anti = G.directed && G.edges.some(([x, y]) => x === v && y === u);
      if (anti) { a.addScaledVector(perp, 0.2); c.addScaledVector(perp, 0.2); }
      const a2 = a.clone().addScaledVector(dir, 0.46), c2 = c.clone().addScaledVector(dir, G.directed ? 0.78 : 0.46);
      const r = rod(a2, c2, C.edge);
      let cone = null;
      if (G.directed) {
        cone = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.36, 14), r.material);
        cone.position.copy(c2).addScaledVector(dir, 0.16);
        cone.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
        lab.world.add(cone);
      }
      const mid = a2.clone().add(c2).multiplyScalar(0.5).addScaledVector(perp, anti ? 0.32 : 0.28).setY(0.35);
      const lbl = txt(String(w), w < 0 ? 'ptr alt' : '', mid);
      gr.edges.push({ i, u, v, w, rod: r, cone, lbl });
    });
    GR = gr;
    return gr;
  }
  function edgeColor(e, color, thick = 1) {
    e.rod.material.color.set(color);
    e.rod.scale.set(thick, 1, thick);
  }
  function nodeColor(i, color, lift = 0) {
    const nd = GR.nodes[i];
    nd.mesh.material.color.set(color);
    lab.springTo(nd.b, nd.home.clone().add(V(0, lift, 0)));
  }
  function tag(i, text, cls) {
    const t = GR.nodes[i].tag;
    t.element.style.display = text ? '' : 'none';
    t.element.textContent = text || '';
    t.element.className = 'lab-label ' + (cls || 'ptr');
  }
  const nm = (i) => GR.G.names[i];
  const eName = (e) => '(' + nm(e.u) + ', ' + nm(e.v) + ')';
  function adj(u) { // outgoing edges of u (both directions if undirected)
    const out = [];
    for (const e of GR.edges) {
      if (e.u === u) out.push({ e, to: e.v });
      else if (!GR.G.directed && e.v === u) out.push({ e, to: e.u });
    }
    return out;
  }

  // queue row (Kruskal 的排序邊 / Prim 的 priority queue)：一排小方塊在圖的後方
  const QROW = { z: -5.4, y: 0.35, gap: 1.32 };
  function qBlock(e) {
    const m = lab.box('#efe3c8', [1.12, 0.5, 0.8]);
    m.add(lab.label(String(e.w), 'val'));
    const l = lab.label(nm(e.u) + '–' + nm(e.v), 'idx');
    l.position.set(0, -0.05, 0.62);
    m.add(l);
    return m;
  }
  function qSlot(k, count) { return V((k - (count - 1) / 2) * QROW.gap, QROW.y, QROW.z); }

  // ───────────────────────── 步進框架（generator） ─────────────────────────
  // 每個演算法是 generator：先改 3D 畫面，再 yield {cap, f, ms, state}。
  const run = { gen: null, mode: '', done: false };
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
    const tick = () => { if (e !== epoch) return; const st = step(); if (st) timer = setTimeout(tick, Math.max(350, (st.ms || 1000) * 0.8)); };
    tick();
  }
  async function playAll(tok) {
    for (;;) {
      const st = step();
      if (!st) break;
      await wait(tok, st.ms || 1000);
    }
  }
  function stepControls(extra) {
    controls((extra || '') + '<button class="primary" id="gStep">下一步</button><button id="gAuto">自動播放</button><button id="gReset">重來</button>');
    on('gStep', () => { clearTimeout(timer); if (!step()) log('已經結束了，按「重來」再跑一次。'); });
    on('gAuto', autoPlay);
  }
  function fresh(cam = [0, 11, 9.8], look = [0, 0, -0.6]) {
    epoch++;
    clearTimeout(timer);
    lab.clear();
    lab.frameCamera(cam, look);
  }

  // ───────────────────────── Kruskal ─────────────────────────
  function* kruskal() {
    const n = GR.n, parent = [...Array(n).keys()];
    const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const order = [...GR.edges].sort((a, b) => a.w - b.w || a.i - b.i);
    const blocks = new Map();
    order.forEach((e, k) => {
      const m = qBlock(e);
      m.position.copy(qSlot(k, order.length)).add(V(0, 5, 0));
      const b = lab.addBody(m);
      lab.dropTo(b, qSlot(k, order.length));
      blocks.set(e, b);
    });
    const recolor = () => { for (let v = 0; v < n; v++) nodeColor(v, SET_COLORS[find(v) % SET_COLORS.length]); };
    recolor();
    const st = (taken, cost, extra) => ['Kruskal（Union-Find）', [
      ['已選邊', taken + ' / ' + (n - 1)], ['cost', String(cost)],
      ['集合', [...new Set([...Array(n).keys()].map(find))].map((r) => '{' + [...Array(n).keys()].filter((v) => find(v) === r).map(nm).join(',') + '}').join(' ')],
    ], (extra || '') + '同色 = 同一個集合（disjoint set）<br>find(u) == find(v) → 加進去會形成 cycle'];
    yield { cap: '每個頂點自成一個集合；邊依權重由小到大排好', f: order.map((e) => e.w).join(' ≤ '), ms: 2200, state: st(0, 0) };
    let taken = 0, cost = 0;
    for (const e of order) {
      if (taken === n - 1) break;
      const b = blocks.get(e);
      lab.springTo(b, b.target.clone().add(V(0, 0.7, 1.2)));
      edgeColor(e, C.hot, 1.6);
      yield { cap: '取下一條最小的邊 ' + eName(e) + ' = ' + e.w, f: 'find(' + nm(e.u) + ') = ' + nm(find(e.u)) + '，find(' + nm(e.v) + ') = ' + nm(find(e.v)), ms: 1200, state: st(taken, cost) };
      const ru = find(e.u), rv = find(e.v);
      if (ru === rv) {
        edgeColor(e, C.bad, 1.8);
        b.obj.traverse((o) => { if (o.material && o.material.color) o.material.color.set(C.bad); });
        yield { cap: nm(e.u) + ' 和 ' + nm(e.v) + ' 已經連通 → 會形成 cycle，丟掉', f: '<span class="no">find(' + nm(e.u) + ') == find(' + nm(e.v) + ')</span>', ms: 1600, warn: true, state: st(taken, cost) };
        lab.flyAway(b, V(0, 8, -3));
        edgeColor(e, C.dim, 0.6);
        continue;
      }
      parent[rv] = ru;
      recolor();
      edgeColor(e, C.tree, 2.2);
      lab.flyAway(b, V(0, 7, 3));
      taken++; cost += e.w;
      yield { cap: '不同集合 → 選 ' + eName(e) + '，兩個集合 union', f: '已選 ' + taken + ' 條，cost = ' + cost, ms: 1300, state: st(taken, cost) };
    }
    for (const [e, b] of blocks) if (lab.bodies.has(b)) b.obj.traverse((o) => { if (o.material && o.material.color) o.material.color.set(C.dim); });
    yield { cap: '選滿 n − 1 = ' + (n - 1) + ' 條，MST 完成', f: '<span class="ok">cost = ' + cost + '</span>（剩下的邊不用看）', ms: 3000, state: st(taken, cost, '<span class="ok">MST cost = ' + cost + '</span><br>') };
  }
  function enterKruskal() {
    fresh();
    buildGraph('bari');
    run.gen = kruskal(); run.done = false;
    stepControls();
    on('gReset', () => { clearLog(); enterKruskal(); });
    log('Kruskal（Abdul Bari 的例子）：永遠挑「整張圖」最小的邊，只要不形成 cycle 就收下。');
    log('判斷 cycle 用 Union-Find：兩端點 find 結果相同 = 已經連通。');
    setState('Kruskal', [['頂點', GR.n], ['邊', GR.edges.length]], '時間：排序 O(E log E) + Union-Find 近乎 O(E)');
  }

  // ───────────────────────── Prim（lazy：priority queue 裝 crossing edges） ─────────────────────────
  const PR = { start: 0 };
  function* prim(start) {
    const n = GR.n, inTree = new Set([start]);
    const pq = [];
    const blocks = new Map();
    const layoutPQ = () => {
      pq.sort((a, b) => a.w - b.w || a.i - b.i);
      pq.forEach((e, k) => {
        let b = blocks.get(e);
        if (!b) {
          const m = qBlock(e);
          m.position.copy(qSlot(k, Math.max(pq.length, 1))).add(V(0, 5, 0));
          b = lab.addBody(m);
          blocks.set(e, b);
          lab.dropTo(b, qSlot(k, pq.length));
        } else lab.springTo(b, qSlot(k, pq.length));
      });
      for (const e of pq) if (!(GR.edges[e.i].rod.scale.x > 2)) edgeColor(e, C.pq, 1.4);
    };
    const push = (v) => { for (const { e, to } of adj(v)) if (!inTree.has(to) && !pq.includes(e)) pq.push(e); };
    for (let v = 0; v < n; v++) nodeColor(v, inTree.has(v) ? C.ok : C.node, inTree.has(v) ? 0.35 : 0);
    push(start); layoutPQ();
    let cost = 0;
    const st = () => ['Prim（從 ' + nm(start) + ' 開始）', [
      ['樹內頂點', [...inTree].map(nm).join(', ')], ['cost', String(cost)],
      ['priority queue', pq.map((e) => e.w).join(', ') || '空'],
    ], '黃色 = 一端在樹內、一端在樹外的 crossing edge<br>每次取最小的 crossing edge（cut property → 一定在某個 MST 裡）'];
    yield { cap: '從頂點 ' + nm(start) + ' 開始：它的邊放進 priority queue', f: 'queue：' + pq.map((e) => e.w).join(', '), ms: 2000, state: st() };
    while (inTree.size < n && pq.length) {
      const e = pq.shift();
      const b = blocks.get(e);
      blocks.delete(e);
      lab.springTo(b, b.target.clone().add(V(0, 0.8, 1.2)));
      edgeColor(e, C.hot, 1.8);
      yield { cap: '取出最小的 crossing edge ' + eName(e) + ' = ' + e.w, f: '只考慮跟目前這棵樹相連的邊', ms: 1200, state: st() };
      const v = inTree.has(e.u) ? e.v : e.u;
      if (inTree.has(e.u) && inTree.has(e.v)) {
        edgeColor(e, C.bad, 1.8);
        lab.flyAway(b, V(0, 8, -3));
        yield { cap: '兩端都已經在樹裡 → 丟掉', f: '<span class="no">會形成 cycle</span>', ms: 1300, warn: true, state: st() };
        edgeColor(e, C.dim, 0.6);
        continue;
      }
      inTree.add(v); cost += e.w;
      edgeColor(e, C.tree, 2.2);
      nodeColor(v, C.ok, 0.35);
      lab.flyAway(b, V(0, 7, 3));
      push(v); layoutPQ();
      yield { cap: '加入頂點 ' + nm(v) + '；把它通往樹外的邊放進 queue', f: '樹：{' + [...inTree].map(nm).join(', ') + '}，cost = ' + cost, ms: 1500, state: st() };
    }
    for (const b of blocks.values()) b.obj.traverse((o) => { if (o.material && o.material.color) o.material.color.set(C.dim); });
    yield { cap: '所有頂點都進樹了，MST 完成', f: '<span class="ok">cost = ' + cost + '</span>' + (GR.key === 'bari' ? '，和 Kruskal 結果一樣' : ''), ms: 3000, state: st() };
  }
  function enterPrim() {
    fresh();
    buildGraph('bari');
    stepControls('<label>起點 <select id="prS">' + GR.G.names.map((x, i) => '<option value="' + i + '">' + x + '</option>').join('') + '</select></label>');
    $('prS').value = String(PR.start);
    $('prS').onchange = (e) => { PR.start = Number(e.target.value); clearLog(); enterPrim(); };
    on('gReset', () => { clearLog(); enterPrim(); });
    run.gen = prim(PR.start); run.done = false;
    log('Prim（Abdul Bari 的例子）：一直維持「一棵樹」，每次挑「跟樹相連」的最小邊。');
    log('Bari 是先選全圖最小邊 (1, 6) = 10 再開始；從頂點 1 出發的第一步剛好就是這條，過程完全一樣。');
    setState('Prim', [['起點', nm(PR.start)]], 'binary heap：O(E log V)；adjacency matrix + 陣列：O(V²)');
  }

  // ───────────────────────── Dijkstra（影片的 explored / unexplored 版本） ─────────────────────────
  const DJ = { key: 'video', src: 0 };
  function bellmanTruth(src) {
    const d = Array(GR.n).fill(INF); d[src] = 0;
    for (let r = 0; r < GR.n - 1; r++) for (const e of GR.edges) {
      if (d[e.u] !== INF && d[e.u] + e.w < d[e.v]) d[e.v] = d[e.u] + e.w;
      if (!GR.G.directed && d[e.v] !== INF && d[e.v] + e.w < d[e.u]) d[e.u] = d[e.v] + e.w;
    }
    return d;
  }
  function* dijkstra(src) {
    const n = GR.n, d = Array(n).fill(INF), p = Array(n).fill(-1), S = new Set();
    const predEdge = Array(n).fill(null);
    d[src] = 0;
    const label = (v) => tag(v, 'D=' + fmt(d[v]) + '  P=' + (p[v] < 0 ? '–' : nm(p[v])), S.has(v) ? 'ptr alt' : 'ptr');
    const st = () => ['Dijkstra（起點 ' + nm(src) + '）', [
      ['explored', '{' + [...S].map(nm).join(', ') + '}'],
      ['unexplored', '{' + [...Array(n).keys()].filter((v) => !S.has(v)).map(nm).join(', ') + '}'],
      ...[...Array(n).keys()].map((v) => [nm(v), 'D=' + fmt(d[v]) + '，P=' + (p[v] < 0 ? '–' : nm(p[v]))]),
    ], 'D = 只經過 explored 頂點時，從起點到它的最短距離<br>P = 那條路上它的前一個頂點（parent）'];
    for (let v = 0; v < n; v++) { label(v); nodeColor(v, C.node); }
    yield { cap: '一開始全部都在 unexplored', f: 'D(' + nm(src) + ') = 0，其他都是 ∞（還沒有路）', ms: 2200, state: st() };
    for (;;) {
      let u = -1;
      for (let v = 0; v < n; v++) if (!S.has(v) && d[v] !== INF && (u < 0 || d[v] < d[u])) u = v;
      if (u < 0) break;
      S.add(u);
      nodeColor(u, C.explored, 0.45);
      label(u);
      yield { cap: 'unexplored 裡 D 最小的是 ' + nm(u) + '（' + d[u] + '）→ 移到 explored', f: '它的 D = ' + d[u] + ' 從此確定', ms: 1600, state: st() };
      for (const { e, to } of adj(u)) {
        edgeColor(e, C.hot, 1.7);
        const nd = d[u] + e.w;
        if (S.has(to)) {
          if (nd < d[to]) {
            tag(to, 'D=' + d[to] + '？ 其實 ' + nd, 'ptr');
            yield { cap: '經過 ' + nm(u) + ' 到 ' + nm(to) + ' 只要 ' + nd + '，比 ' + d[to] + ' 還短！', f: '<span class="no">但 ' + nm(to) + ' 已經 explored，Dijkstra 不會回頭改</span>', ms: 2400, warn: true, state: st() };
            label(to);
          }
          edgeColor(e, predEdge.includes(e) ? C.tree : C.edge, predEdge.includes(e) ? 2 : 1);
          continue;
        }
        if (nd < d[to]) {
          const old = d[to];
          if (predEdge[to]) edgeColor(predEdge[to], C.edge, 1);
          d[to] = nd; p[to] = u; predEdge[to] = e;
          label(to);
          edgeColor(e, C.tree, 2);
          GR.nodes[to].mesh.scale.set(1.18, 1.18, 1.18);
          yield { cap: nm(to) + '：' + d[u] + ' + ' + e.w + ' = ' + nd + (old === INF ? '，比 ∞ 小' : ' < ' + old) + ' → 更新', f: 'D(' + nm(to) + ') = ' + nd + '，P(' + nm(to) + ') = ' + nm(u), ms: 1700, state: st() };
          GR.nodes[to].mesh.scale.set(1, 1, 1);
        } else {
          yield { cap: nm(to) + '：' + d[u] + ' + ' + e.w + ' = ' + nd + ' ≥ ' + fmt(d[to]) + ' → 不更新', f: '只在找到更短的路時才改 D 和 P', ms: 1400, state: st() };
          edgeColor(e, C.edge, 1);
        }
      }
    }
    yield { cap: '全部 explored，演算法結束', f: [...Array(n).keys()].map((v) => nm(v) + '=' + fmt(d[v])).join('  '), ms: 1800, state: st() };
    // 沿 parent 回推路徑（影片最後一段）
    for (let v = 0; v < n; v++) {
      if (v === src || d[v] === INF) continue;
      const path = [];
      for (let x = v; x >= 0; x = p[x]) path.unshift(x);
      GR.edges.forEach((e) => edgeColor(e, predEdge.includes(e) ? C.tree : C.dim, predEdge.includes(e) ? 1.4 : 0.7));
      for (let k = 1; k < path.length; k++) edgeColor(predEdge[path[k]], C.cur, 2.6);
      yield { cap: '終點 ' + nm(v) + '：沿 P 往回走', f: path.map(nm).join(' → ') + '，cost = ' + d[v], ms: 1900, state: st() };
    }
    if (GR.G.edges.some((e) => e[2] < 0)) {
      const t = bellmanTruth(src);
      const wrong = [...Array(n).keys()].filter((v) => t[v] !== d[v]);
      wrong.forEach((v) => { nodeColor(v, C.bad, 0.45); tag(v, 'Dijkstra ' + fmt(d[v]) + '，正解 ' + fmt(t[v]), 'ptr'); });
      yield { cap: wrong.length ? '有負邊：' + wrong.map(nm).join('、') + ' 的答案錯了' : '這次剛好沒錯，但有負邊時不保證', f: '<span class="no">Dijkstra 假設「explored 之後不會再變短」，負邊打破這個假設</span>', ms: 3200, warn: true, state: st() };
    }
  }
  function enterDijkstra() {
    fresh();
    buildGraph(DJ.key);
    if (DJ.src >= GR.n) DJ.src = 0;
    stepControls('<select id="djG"><option value="video">影片範例 s, a, b, c</option><option value="six">6 頂點有向圖</option><option value="neg">負邊反例</option></select>'
      + '<label>起點 <select id="djS">' + GR.G.names.map((x, i) => '<option value="' + i + '">' + x + '</option>').join('') + '</select></label>');
    $('djG').value = DJ.key;
    $('djS').value = String(DJ.src);
    $('djG').onchange = (e) => { DJ.key = e.target.value; DJ.src = 0; clearLog(); enterDijkstra(); };
    $('djS').onchange = (e) => { DJ.src = Number(e.target.value); clearLog(); enterDijkstra(); };
    on('gReset', () => { clearLog(); enterDijkstra(); });
    run.gen = dijkstra(DJ.src); run.done = false;
    log(DJ.key === 'video' ? '影片的例子：s 直接到 b 要 3，經過 a 只要 1 + 1 = 2。看 Dijkstra 怎麼找出來。'
      : DJ.key === 'neg' ? '有一條負邊 b → a = −3。看 Dijkstra 會在哪裡出錯。' : '有向圖：只沿箭頭方向放鬆。');
    log('每個頂點上方的標籤：D = 目前最短距離，P = parent。綠色抬高的是 explored。');
    setState('Dijkstra', [['圖', GR.G.title], ['起點', nm(DJ.src)]], '陣列版 O(V²)；heap 版 O((V + E) log V)<br>限制：<span class="no">不能有負權重的邊</span>');
  }

  // ───────────────────────── Bellman-Ford ─────────────────────────
  const BF = { key: 'bf' };
  function* bellmanFord(src) {
    const n = GR.n, d = Array(n).fill(INF), p = Array(n).fill(-1);
    d[src] = 0;
    const label = () => { for (let v = 0; v < n; v++) tag(v, 'D=' + fmt(d[v])); };
    let round = 0;
    const st = (extra) => ['Bellman-Ford（起點 ' + nm(src) + '）', [
      ['第幾輪', round + ' / ' + (n - 1)],
      ['dist', [...Array(n).keys()].map((v) => nm(v) + ':' + fmt(d[v])).join(' ')],
      ['放鬆順序', '固定的邊順序，每輪全部掃一遍'],
    ], (extra || '') + '第 k 輪結束後：最多用 k 條邊的最短路徑都已正確<br>最短路徑最多 n − 1 條邊 → 跑 n − 1 輪'];
    label();
    for (let v = 0; v < n; v++) nodeColor(v, v === src ? C.explored : C.node, v === src ? 0.35 : 0);
    yield { cap: '起點 D = 0，其他 ∞；每一輪把「所有邊」都放鬆一次', f: '共 n − 1 = ' + (n - 1) + ' 輪', ms: 2000, state: st() };
    for (round = 1; round <= n - 1; round++) {
      let changed = false;
      yield { cap: '第 ' + round + ' 輪', f: '依序放鬆 ' + GR.edges.length + ' 條邊', ms: 900, state: st() };
      for (const e of GR.edges) {
        edgeColor(e, C.hot, 1.8);
        if (d[e.u] !== INF && d[e.u] + e.w < d[e.v]) {
          const old = d[e.v];
          d[e.v] = d[e.u] + e.w; p[e.v] = e.u; changed = true;
          label();
          GR.edges.forEach((x) => { if (x !== e && x.v === e.v && x.rod.scale.x > 1.9) edgeColor(x, C.edge, 1); });
          edgeColor(e, C.tree, 2);
          yield { cap: '放鬆 ' + eName(e) + '：' + d[e.u] + ' + (' + e.w + ') = ' + d[e.v] + ' < ' + fmt(old), f: 'D(' + nm(e.v) + ') 更新為 ' + d[e.v], ms: 900, state: st() };
        } else {
          yield { cap: '放鬆 ' + eName(e) + '：' + (d[e.u] === INF ? nm(e.u) + ' 還是 ∞，跳過' : '沒有變短'), f: '', ms: 420, state: st() };
          const isTree = p[e.v] === e.u;
          edgeColor(e, isTree ? C.tree : C.edge, isTree ? 2 : 1);
        }
      }
      if (!changed) {
        yield { cap: '這一輪完全沒有更新 → 可以提早結束', f: '<span class="ok">再跑也不會變，也就不可能有負 cycle</span>', ms: 2400, state: st('<span class="ok">提早結束</span><br>') };
        yield { cap: '最短距離', f: [...Array(n).keys()].map((v) => nm(v) + '=' + fmt(d[v])).join('  '), ms: 3000, state: st() };
        return;
      }
    }
    round = n - 1;
    yield { cap: n - 1 + ' 輪跑完了。再檢查一輪：還能變短嗎？', f: '能 → 有負 cycle', ms: 1800, state: st() };
    for (const e of GR.edges) {
      if (d[e.u] !== INF && d[e.u] + e.w < d[e.v]) {
        edgeColor(e, C.bad, 2.4);
        nodeColor(e.v, C.bad, 0.4);
        yield { cap: eName(e) + ' 還能放鬆：' + d[e.u] + ' + (' + e.w + ') < ' + d[e.v], f: '<span class="no">有負 cycle：最短路徑無定義（可以一直繞圈變短）</span>', ms: 3400, warn: true, state: st('<span class="no">偵測到負 cycle</span><br>') };
        return;
      }
    }
    yield { cap: '沒有邊能再放鬆 → 沒有負 cycle', f: [...Array(n).keys()].map((v) => nm(v) + '=' + fmt(d[v])).join('  '), ms: 3000, state: st() };
  }
  function enterBF() {
    fresh();
    buildGraph(BF.key);
    stepControls('<select id="bfG"><option value="bf">負邊有向圖（7 頂點）</option><option value="cycle">含負 cycle</option><option value="neg">負邊反例（同 Dijkstra）</option></select>');
    $('bfG').value = BF.key;
    $('bfG').onchange = (e) => { BF.key = e.target.value; clearLog(); enterBF(); };
    on('gReset', () => { clearLog(); enterBF(); });
    run.gen = bellmanFord(0); run.done = false;
    log('Bellman-Ford：不挑頂點，直接把每條邊都放鬆，重複 n − 1 輪。可以處理負邊，還能偵測負 cycle。');
    log('一輪內的結果會受邊的順序影響，但 n − 1 輪後的答案一樣。');
    setState('Bellman-Ford', [['圖', GR.G.title]], '時間 O(VE)，比 Dijkstra 慢，但允許負邊');
  }

  // ───────────────────────── Floyd-Warshall ─────────────────────────
  const FW = { key: 'fw3', cells: [] };
  function* floyd() {
    const n = GR.n;
    const A = [...Array(n)].map((_, i) => [...Array(n)].map((_, j) => (i === j ? 0 : INF)));
    GR.edges.forEach((e) => { A[e.u][e.v] = e.w; });
    const cs = 1.3, x0 = 3.6 - ((n - 1) * cs) / 2, z0 = -((n - 1) * 1.15) / 2;
    const cellPos = (i, j) => V(x0 + j * cs, 0.2, z0 + i * 1.15);
    FW.cells = [];
    for (let i = 0; i < n; i++) {
      FW.cells.push([]);
      txt(nm(i), 'idx', cellPos(i, 0).add(V(-1, 0.1, 0)));
      for (let j = 0; j < n; j++) {
        const m = lab.box(i === j ? '#e2d6bf' : '#f3ead9', [1.18, 0.32, 1.02]);
        const l = lab.label(fmt(A[i][j]), 'val');
        m.add(l);
        m.position.copy(cellPos(i, j));
        lab.world.add(m);
        FW.cells[i].push({ m, l });
      }
    }
    for (let j = 0; j < n; j++) txt(nm(j), 'idx', cellPos(0, j).add(V(0, 0.1, -0.95)));
    const head = txt('A⁻¹', 'ptr', V(x0 + (n - 1) * cs / 2, 0.6, z0 - 1.75));
    const paint = (k, ci, cj, upd) => {
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const c = FW.cells[i][j];
        let col = i === j ? '#e2d6bf' : '#f3ead9';
        if (k >= 0 && (i === k || j === k)) col = '#f1d78f';
        if (i === ci && j === cj) col = upd ? C.ok : '#d9cdb3';
        c.m.material.color.set(col);
        c.m.position.y = i === ci && j === cj ? 0.42 : 0.2;
        c.l.element.textContent = fmt(A[i][j]);
      }
    };
    const sup = (k) => (k < 0 ? '⁻¹' : String(k).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]));
    const st = (k) => ['Floyd-Warshall', [['目前矩陣', 'A' + sup(k)], ['允許的中繼點', k < 0 ? '無（直接的邊）' : '{' + [...Array(k + 1).keys()].map(nm).join(', ') + '}']],
      'A<sup>k</sup>[i][j] = min( A<sup>k−1</sup>[i][j], A<sup>k−1</sup>[i][k] + A<sup>k−1</sup>[k][j] )<br>三層迴圈：O(n³)；k 一定要放在最外層'];
    paint(-1);
    yield { cap: 'A⁻¹ = 成本矩陣：只能走直接的邊', f: '沒有邊 = ∞，對角線 = 0', ms: 2400, state: st(-1) };
    for (let k = 0; k < n; k++) {
      head.element.textContent = 'A' + sup(k);
      for (let v = 0; v < n; v++) nodeColor(v, v === k ? C.cur : v < k ? '#e6d9b8' : C.node, v === k ? 0.4 : 0);
      paint(k);
      yield { cap: 'k = ' + nm(k) + '：多允許經過頂點 ' + nm(k), f: '第 ' + nm(k) + ' 列、第 ' + nm(k) + ' 行不會變', ms: 1700, state: st(k) };
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        if (i === k || j === k || i === j) continue;
        const via = A[i][k] + A[k][j];
        const upd = via < A[i][j];
        const old = A[i][j];
        if (upd) A[i][j] = via;
        paint(k, i, j, upd);
        yield upd
          ? { cap: 'A[' + nm(i) + '][' + nm(j) + ']：經過 ' + nm(k) + ' 更短', f: fmt(A[i][k]) + ' + ' + fmt(A[k][j]) + ' = ' + via + ' < ' + fmt(old) + ' → 更新', ms: 1500, state: st(k) }
          : { cap: 'A[' + nm(i) + '][' + nm(j) + ']：經過 ' + nm(k) + ' 沒比較短', f: fmt(A[i][k]) + ' + ' + fmt(A[k][j]) + ' = ' + fmt(via) + ' ≥ ' + fmt(old), ms: 650, state: st(k) };
      }
    }
    paint(-2);
    for (let v = 0; v < n; v++) nodeColor(v, C.node);
    yield { cap: 'A' + sup(n - 1) + '：所有點對的最短距離', f: '<span class="ok">每一格都是 i 到 j 的最短路徑長</span>', ms: 3200, state: st(n - 1) };
  }
  function enterFloyd() {
    fresh([0, 10, 9], [0, 0, 0]);
    buildGraph(FW.key);
    stepControls('<select id="fwG"><option value="fw3">3 頂點（例）</option><option value="fw4">4 頂點</option></select>');
    $('fwG').value = FW.key;
    $('fwG').onchange = (e) => { FW.key = e.target.value; clearLog(); enterFloyd(); };
    on('gReset', () => { clearLog(); enterFloyd(); });
    run.gen = floyd(); run.done = false;
    log('Floyd-Warshall（洪逸／Horowitz 寫法）：A⁻¹ 是成本矩陣，A^k 代表「中間只能經過 0..k」。');
    step();
  }

  // ───────────────────────── 文字頁 ─────────────────────────
  function renderCmp(el) {
    el.innerHTML = '<h2>圖演算法對照</h2>'
      + '<table class="lab-table"><thead><tr><th>演算法</th><th>解什麼</th><th>策略</th><th>時間</th><th>負邊</th></tr></thead><tbody>'
      + '<tr><th>Kruskal</th><td>MST</td><td>Greedy：全圖最小、不成 cycle</td><td class="on">O(E log E)</td><td>可以（MST 不怕負邊）</td></tr>'
      + '<tr><th>Prim</th><td>MST</td><td>Greedy：跟樹相連的最小邊</td><td class="on">O(V²) 陣列／O(E log V) heap</td><td>可以</td></tr>'
      + '<tr><th>Dijkstra</th><td>單一起點最短路徑</td><td>Greedy：D 最小的先確定</td><td class="on">O(V²) 陣列／O((V+E) log V) heap</td><td><b>不行</b></td></tr>'
      + '<tr><th>Bellman-Ford</th><td>單一起點最短路徑</td><td>DP：n − 1 輪放鬆所有邊</td><td class="on">O(VE)</td><td>可以，還能偵測負 cycle</td></tr>'
      + '<tr><th>Floyd-Warshall</th><td>所有點對最短路徑</td><td>DP：A^k 允許經過 0..k</td><td class="on">O(V³)</td><td>可以（不能有負 cycle）</td></tr>'
      + '</tbody></table>'
      + '<p>Kruskal 和 Prim 都靠同一個性質（cut property）：跨過任何一個 cut 的最小邊，一定可以放進某個 MST。差別只是「cut」怎麼選。</p>'
      + '<h3>容易搞混的地方</h3>'
      + '<div class="lab-trap">MST 的 cost 一定唯一，但 MST 本身不一定唯一：有相同權重的邊時，可能有好幾棵 cost 一樣的 MST（Abdul Bari 影片最後的例子）。邊權重全部不同時 MST 才唯一。</div>'
      + '<div class="lab-trap">Kruskal 用在不連通的圖上會得到每個連通分量各自的 spanning tree（spanning forest）；Prim 從一個頂點出發只會長出那一個分量。</div>'
      + '<div class="lab-trap">Dijkstra 的錯不是「算不出來」，而是算出錯的答案：頂點一旦 explored 就不再更新，後面才發現的負邊捷徑被忽略（看「Dijkstra」模式的負邊反例）。</div>'
      + '<div class="lab-trap">Bellman-Ford 跑完 n − 1 輪後如果還有邊能放鬆，就代表有從起點走得到的負 cycle。</div>';
  }

  let qs = { score: 0, total: 0 };
  const LET = ['A', 'B', 'C', 'D', 'E'];
  function randGraph() {
    for (;;) {
      const ws = [...Array(15).keys()].map((x) => x + 1).sort(() => Math.random() - 0.5);
      const all = [];
      for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) all.push([i, j]);
      all.sort(() => Math.random() - 0.5);
      const edges = all.slice(0, 7).map(([u, v], k) => [u, v, ws[k]]);
      const par = [0, 1, 2, 3, 4];
      const f = (x) => (par[x] === x ? x : (par[x] = f(par[x])));
      edges.forEach(([u, v]) => { par[f(u)] = f(v); });
      if (new Set([0, 1, 2, 3, 4].map(f)).size === 1) return edges;
    }
  }
  function mstOf(edges) {
    const par = [0, 1, 2, 3, 4];
    const f = (x) => (par[x] === x ? x : (par[x] = f(par[x])));
    const picked = [], rejected = [];
    for (const e of [...edges].sort((a, b) => a[2] - b[2])) {
      if (picked.length === 4) break;
      if (f(e[0]) === f(e[1])) { rejected.push(e); continue; }
      par[f(e[0])] = f(e[1]); picked.push(e);
    }
    return { picked, rejected, cost: picked.reduce((s, e) => s + e[2], 0) };
  }
  function spOf(edges, src) {
    const d = [INF, INF, INF, INF, INF]; d[src] = 0;
    const S = new Set();
    for (;;) {
      let u = -1;
      for (let v = 0; v < 5; v++) if (!S.has(v) && d[v] !== INF && (u < 0 || d[v] < d[u])) u = v;
      if (u < 0) break;
      S.add(u);
      for (const [a, b, w] of edges) { if (a === u && d[u] + w < d[b]) d[b] = d[u] + w; if (b === u && d[u] + w < d[a]) d[a] = d[u] + w; }
    }
    return d;
  }
  const es = (e) => LET[e[0]] + '–' + LET[e[1]] + '（' + e[2] + '）';
  function genQ() {
    const t = Math.floor(Math.random() * 5);
    if (t <= 2) {
      const edges = randGraph();
      const desc = '無向圖的邊：' + edges.map(es).join('、');
      const mst = mstOf(edges);
      if (t === 0) {
        const cheap = [...edges].sort((a, b) => a[2] - b[2]).slice(0, 4).reduce((s, e) => s + e[2], 0);
        const sp = spOf(edges, 0);
        const spt = sp.reduce((s, x) => s + x, 0);
        const opts = [...new Set([mst.cost, cheap, mst.cost + 1, spt, mst.cost + 2])].slice(0, 4).map(String);
        return { q: desc + '\n最小生成樹（MST）的總權重是？', opts, ans: String(mst.cost),
          why: 'Kruskal：依序選 ' + mst.picked.map(es).join('、') + (mst.rejected.length ? '；' + mst.rejected.map(es).join('、') + ' 會形成 cycle 被丟掉' : '') + '。總和 ' + mst.cost + '。' + (cheap !== mst.cost ? '直接拿最小的 4 條（' + cheap + '）會形成 cycle。' : '') };
      }
      if (t === 1) {
        const sorted = [...edges].sort((a, b) => a[2] - b[2]);
        if (!mst.rejected.length) {
          const ans = es(mst.picked[2]);
          const opts = [...new Set([ans, es(sorted[2]), es(sorted[3]), es(sorted[4])])].slice(0, 4);
          if (!opts.includes(ans)) opts[0] = ans;
          return { q: desc + '\nKruskal 第 3 條「被選進 MST」的邊是？', opts, ans, why: '依權重排序：' + sorted.map((e) => e[2]).join(' < ') + '，前面都沒有形成 cycle，第 3 條就是第 3 小的 ' + ans + '。' };
        }
        const ans = es(mst.rejected[0]);
        const opts = [...new Set([ans, ...mst.picked.slice(-3).map(es)])].slice(0, 4);
        return { q: desc + '\n執行 Kruskal 時，哪一條邊會因為形成 cycle 被丟掉？', opts, ans, why: '輪到 ' + ans + ' 時，它的兩端已經被前面選的邊連起來（find 相同），加進去就有 cycle。' };
      }
      const sp = spOf(edges, 0);
      const tgt = 1 + Math.floor(Math.random() * 4);
      const direct = edges.find((e) => (e[0] === 0 && e[1] === tgt) || (e[1] === 0 && e[0] === tgt));
      const opts = [...new Set([sp[tgt], direct ? direct[2] : sp[tgt] + 3, sp[tgt] + 1, sp[tgt] + 2])].map(String);
      return { q: desc + '\n從 A 出發做 Dijkstra，A 到 ' + LET[tgt] + ' 的最短距離是？', opts, ans: String(sp[tgt]),
        why: '最短距離 D：' + sp.map((x, i) => LET[i] + '=' + x).join('、') + '。' + (direct && direct[2] !== sp[tgt] ? '直接的邊 ' + direct[2] + ' 不是最短，繞路反而比較近。' : '') };
    }
    const bank = [
      { q: 'Dijkstra 為什麼不能處理負權重的邊？', a: '頂點 explored 後就不再更新，但負邊可能在之後提供更短的路', d: ['負邊會讓演算法無窮迴圈', '負數不能放進 priority queue', 'Dijkstra 只能用在無向圖'] },
      { q: 'Bellman-Ford 要做幾輪「放鬆所有邊」（n 個頂點）？', a: 'n − 1 輪', d: ['n 輪', 'log n 輪', 'E 輪'] },
      { q: 'Bellman-Ford 怎麼偵測負 cycle？', a: '跑完 n − 1 輪後再掃一次，還有邊能放鬆就有負 cycle', d: ['發現任何一條負邊就有負 cycle', '第一輪就有距離變負數', '起點的距離小於 0 才算'] },
      { q: 'Floyd-Warshall 三層迴圈中，哪個變數一定要在最外層？', a: 'k（中繼點）', d: ['i（起點）', 'j（終點）', '哪個都可以'] },
      { q: '用 adjacency matrix + 陣列實作的 Dijkstra 時間複雜度？', a: 'O(V²)', d: ['O(E log V)', 'O(VE)', 'O(V³)'] },
      { q: 'Kruskal 演算法的時間主要花在？', a: '把邊依權重排序 O(E log E)', d: ['找每個頂點的最近鄰居 O(V²)', 'BFS 檢查 cycle O(V + E) 每次', '建 adjacency matrix O(V²)'] },
      { q: '一張連通圖有兩條權重相同的邊，關於 MST 何者正確？', a: 'MST 的 cost 唯一，但 MST 可能不只一棵', d: ['MST 一定唯一', 'MST 的 cost 可能不同', '這時 Kruskal 不能用'] },
      { q: 'Prim 和 Kruskal 在同一張圖上（權重都不同）的結果？', a: '同一棵 MST', d: ['cost 相同但樹不同', 'Prim 的 cost 比較小', '要看起點'] },
    ];
    const b = bank[Math.floor(Math.random() * bank.length)];
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

  // ───────────────────────── 舞台場景 ─────────────────────────
  // 播放 generator，但只停在「有意義」的步驟上（scene 用較短的節奏）
  async function playGen(tok, speed = 1) {
    for (;;) {
      const st = step();
      if (!st) break;
      await wait(tok, (st.ms || 1000) * speed);
    }
  }
  const scenes = {
    'dijkstra-explored-sets': { title: 'Dijkstra：explored／unexplored 與 D、P 標記', play: async (tok) => {
      DJ.key = 'video'; DJ.src = 0; enterDijkstra();
      say('從 s 到 b：直接走要 3，經過 a 只要 1 + 1 = 2', '每個頂點記 D（距離）和 P（parent）');
      await beat(tok, 2600);
      for (;;) {
        const st = step();
        if (!st || /全部 explored/.test(st.cap)) break;
        await wait(tok, st.ms || 1000);
      }
      await beat(tok, 2600);
    } },
    'dijkstra-path-trace': { title: 'Dijkstra：沿 parent 回推最短路徑', play: async (tok) => {
      DJ.key = 'video'; DJ.src = 0; enterDijkstra();
      while (run.gen && !run.done) { const st = step(); if (!st || /全部 explored/.test(st.cap)) break; }
      say('跑完之後：每個頂點都有 D 和 P', 's=0  a=1  b=2  c=6');
      await beat(tok, 2600);
      await playGen(tok);
      say('c ← b ← a ← s：反過來就是最短路徑', 's → a → b → c，cost = 6');
      await beat(tok, 3000);
    } },
    'dijkstra-negative-edge': { title: 'Dijkstra 遇到負邊會出錯', play: async (tok) => {
      DJ.key = 'neg'; DJ.src = 0; enterDijkstra();
      say('同樣的步驟，但 b → a 是 −3', '');
      await beat(tok, 2200);
      await playGen(tok, 0.75);
      await beat(tok, 1200);
    } },
    'prim-connected-min': { title: 'Prim：每次選跟樹相連的最小邊', play: async (tok) => {
      PR.start = 0; enterPrim();
      say('Abdul Bari 的例子：先選最小的 (1, 6) = 10', '之後只看「跟已選頂點相連」的邊');
      await beat(tok, 2600);
      await playGen(tok, 0.8);
      say('cost = 10 + 25 + 22 + 12 + 16 + 14 = 99', '一直維持一棵樹');
      await beat(tok, 2600);
    } },
    'kruskal-reject-cycle': { title: 'Kruskal：全圖最小邊，形成 cycle 就丟掉', play: async (tok) => {
      enterKruskal();
      say('同一張圖，改用 Kruskal：邊先排序', '10, 12, 14, 16, 18, 22, 24, 25, 28');
      await beat(tok, 2600);
      await playGen(tok, 0.8);
      say('18 和 24 會形成 cycle 被丟掉', '<span class="ok">cost 一樣是 99</span>');
      await beat(tok, 2600);
    } },
    'bellman-ford-rounds': { title: 'Bellman-Ford：n − 1 輪放鬆所有邊', play: async (tok) => {
      BF.key = 'bf'; enterBF();
      say('有負邊也沒關係：每輪把每條邊都放鬆一次', 'dist[v] = min(dist[v], dist[u] + w(u, v))');
      await beat(tok, 2600);
      await playGen(tok, 0.55);
    } },
    'bellman-ford-negative-cycle': { title: 'Bellman-Ford 偵測負 cycle', play: async (tok) => {
      BF.key = 'cycle'; enterBF();
      say('a → b → c → a：−1 − 1 + 1 = −1', '繞一圈就變短一點');
      await beat(tok, 2600);
      await playGen(tok, 0.55);
    } },
    'floyd-warshall-ak': { title: 'Floyd-Warshall：A⁻¹ → A⁰ → A¹ → A²', play: async (tok) => {
      FW.key = 'fw3'; enterFloyd();
      await beat(tok, 2400);
      await playGen(tok, 0.8);
    } },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ dijk.js ═══
  {
const { V3, fresh, tag, cube, glow, txt, GOLD, step, buddy, travel, kill, anim } = K;
const say = ctx.say, beat = ctx.beat, T = ctx.THREE;
// ─── HlFsexTpM4Q：Dijkstra Algorithm（s, a, b, c 範例；explored／unexplored、D 與 P）───
// cued：每個 await step(tok) 等講者說到那一句。只用 K 與 ctx：這個片段也會裝進演算法第 7 章。
const DC = { node: '#cbbd9f', edge: '#a8987c', hot: '#e8b02a', tree: '#2f7fd0', exp: '#2fc092', path: '#c0392b', dim: '#e4dccb', guide: '#f4a56a' };
const DPOS = { s: [-4.6, 0], a: [-0.6, -2.6], b: [-0.6, 2.6], c: [4.0, 0] };
const DEDGES = [['s', 'a', 1], ['s', 'b', 3], ['a', 'b', 1], ['a', 'c', 10], ['b', 'c', 4]];
function dCls(l, c) { l.element.className = 'lab-label' + (c ? ' ' + c : ''); }
function dRod(p, q, color) {
  const d = q.clone().sub(p);
  const m = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, Math.max(0.01, d.length()), 8), new T.MeshStandardMaterial({ color, roughness: 0.6 }));
  m.position.copy(p).add(q).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
  ctx.lab.world.add(m); return m;
}
// draws the video's graph; returns nodes, edges, D/P tags, set tags
function dGraph(drop = 3) {
  const N = {}, TG = {}, E = [];
  for (const k of ['s', 'a', 'b', 'c']) {
    const [x, z] = DPOS[k];
    N[k] = cube(k, DC.node, [0.85, 0.6, 0.85], x, 0.3, z, drop);
    TG[k] = tag('', 'ptr', x, 1.25, z);
  }
  for (const [u, v, w] of DEDGES) {
    const [x1, z1] = DPOS[u], [x2, z2] = DPOS[v];
    const L = Math.hypot(x2 - x1, z2 - z1), ux = (x2 - x1) / L, uz = (z2 - z1) / L;
    const rod = dRod(V3(x1 + ux * 0.5, 0.3, z1 + uz * 0.5), V3(x2 - ux * 0.5, 0.3, z2 - uz * 0.5), DC.edge);
    const lbl = tag(String(w), '', (x1 + x2) / 2 - uz * 0.38, 0.45, (z1 + z2) / 2 + ux * 0.38);
    E.push({ u, v, w, rod, lbl, set(c, k = 1) { rod.material.color.set(c); rod.scale.set(k, 1, k); } });
  }
  const ex = tag('explored：{ }', 'ptr alt', -2.6, 0.3, -4.6);
  const un = tag('unexplored：{ s, a, b, c }', 'ptr', 2.6, 0.3, -4.6);
  const e = (u, v) => E.find((x) => (x.u === u && x.v === v) || (x.u === v && x.v === u));
  return { N, TG, E, e, ex, un };
}
const dF = (d) => (d === Infinity ? '∞' : String(d));
function dLabel(G, k, D, P) { txt(G.TG[k], k + '：D=' + dF(D) + ' P=' + (P || '–')); }
function dSets(G, S) {
  const all = ['s', 'a', 'b', 'c'];
  txt(G.ex, 'explored：{ ' + S.join(', ') + ' }');
  txt(G.un, 'unexplored：{ ' + all.filter((k) => !S.includes(k)).join(', ') + ' }');
}
function dExplore(G, k) { const [x, z] = DPOS[k]; G.N[k].material.color.set(DC.exp); K.move(G.N[k], x, 0.6, z); dCls(G.TG[k], 'ptr alt'); }
// 探路小幫手：站在頂點旁邊，跟著講者走
const dAt = (k) => { const [x, z] = DPOS[k]; return V3(x - 1.1, 0, z + 0.9); };
function dGuide(k = 's') { const p = dAt(k); return buddy('小探', '', DC.guide, p.x, 0, p.z, 0.55); }
async function dGo(tok, g, k, ms = 800) { await travel(tok, g.g, g.g.position.clone(), dAt(k), ms); }
// 一個小封包沿著一串頂點走（例如 s → a → b），帶著它算的數字
async function dWalk(tok, text, path, ms = 650) {
  const p = (k) => V3(DPOS[k][0], 1.0, DPOS[k][1]);
  const pk = tag(text, 'pkt', p(path[0]).x, 1.0, p(path[0]).z);
  for (let i = 1; i < path.length; i++) await travel(tok, pk, p(path[i - 1]), p(path[i]), ms);
  return pk;
}

// 00:00 問題：s 到 b 直接 3，經過 a 只要 1 + 1 = 2
FRAG.push(['dijk-problem', 'Dijkstra：s 到 b，直接 3 還是繞 a 只要 2', async (tok) => {
  fresh([0, 10.5, 8.6], [0, 0, -0.2]);
  await step(tok);                                   // 0:01 Dijkstra：找最短路徑
  const g = buddy('小探', '', DC.guide, -5.6, 0, 3.4, 0.7);
  const q = tag('最短的路怎麼走？', 'say', -5.6, 1.9, 3.4);
  say('Dijkstra algorithm', '在加權圖上找最短路徑');
  await step(tok);                                   // 0:17 G 與起點 s
  const G = dGraph();
  G.ex.element.style.visibility = 'hidden'; G.un.element.style.visibility = 'hidden';
  glow(G.N.s, GOLD); txt(G.TG.s, '起點 source'); kill(q);
  say('給加權圖 G 與起點 s', '邊上的數字 = 權重（距離）');
  await step(tok);                                   // 0:36 回傳 s 到其他每個頂點的最短路徑
  for (const k of ['a', 'b', 'c']) txt(G.TG[k], 's → ' + k + '？');
  g.mood('wow');
  say('回傳：s 到其他每個頂點的最短路徑', 'a、b、c 各一條');
  await step(tok);                                   // 1:53 想去 b
  for (const k of ['a', 'c']) txt(G.TG[k], '');
  glow(G.N.s, null); glow(G.N.b, GOLD);
  await travel(tok, g.g, g.g.position.clone(), dAt('s'), 700);
  say('例：從 s 想去 b', '有兩條路');
  await step(tok);                                   // 2:00 直接走 s → b：權重 3
  G.e('s', 'b').set(DC.hot, 2);
  const p1 = await dWalk(tok, '3', ['s', 'b'], 900);
  say('直接走 s → b', '權重 3');
  await step(tok);                                   // 2:06 經過 a：1 + 1 = 2
  kill(p1); G.e('s', 'b').set(DC.dim, 0.7);
  G.e('s', 'a').set(DC.tree, 2); G.e('a', 'b').set(DC.tree, 2);
  const p2 = await dWalk(tok, '1 + 1 = 2', ['s', 'a', 'b'], 700);
  say('經過 a：s → a → b', '1 + 1 = 2');
  await step(tok);                                   // 2:13 最短的是經過 a 的那條
  txt(p2, '2 < 3 ✓'); txt(G.TG.b, 'shortest = 2'); g.mood('happy'); await g.hop(tok);
  say('最短路徑走 a', 'shortest(s, b) = 2');
  await step(tok);                                   // 2:21 每個頂點都要找一條
  kill(p2); glow(G.N.b, null);
  for (const k of ['a', 'b', 'c']) { txt(G.TG[k], s2q(k)); glow(G.N[k], GOLD); }
  g.mood('calm');
  say('除了起點，每個頂點都要找最小權重的路', 'Dijkstra 怎麼做？');
}]);
function s2q(k) { return 's → ' + k + '：最短？'; }

// 02:31 explored／unexplored 兩個集合；D 與 P；初始狀態
FRAG.push(['dijk-init', 'Dijkstra：兩個集合與 D、P 的初始狀態', async (tok) => {
  fresh([0, 10.5, 8.6], [0, 0, -0.2]);
  const G = dGraph(0);
  G.ex.element.style.visibility = 'hidden'; G.un.element.style.visibility = 'hidden';
  const g = dGuide('s');
  await step(tok);                                   // 2:38 兩個集合
  G.ex.element.style.visibility = '';
  say('第一步：把頂點分成兩個集合', '第一個叫 explored（已探索）');
  await step(tok);                                   // 2:43 explored / unexplored
  G.un.element.style.visibility = '';
  say('另一個叫 unexplored（還沒探索）', '');
  await step(tok);                                   // 3:05 一開始全部 unexplored
  for (const k of ['s', 'a', 'b', 'c']) glow(G.N[k], GOLD);
  say('一開始全部都在 unexplored', 's、a、b、c');
  await step(tok);                                   // 3:15 每個頂點寫上 D 與 P
  for (const k of ['s', 'a', 'b', 'c']) { glow(G.N[k], null); txt(G.TG[k], k + '：D=?  P=?'); }
  say('每個頂點寫上 D 與 P', '名字旁邊的兩個小標記');
  await step(tok);                                   // 3:41 D = 從 source 到它的最短距離
  const nD = tag('D = 從 s 到這個頂點的最短距離', 'note', 0, 0.3, 4.4);
  say('D：從 s 到它的最短距離', 'D = distance');
  await step(tok);                                   // 4:08 路徑只能經過 explored 頂點
  txt(nD, 'D 的路：只能經過 explored 的頂點');
  g.look(1);
  say('但有條件：路上只能經過 explored 頂點', '還沒探索的不能借道');
  await step(tok);                                   // 4:50 P = parent
  txt(nD, 'P = 那條路上，它的前一個頂點（parent）');
  say('P：那條路上它的前一個頂點', 'P = parent');
  await step(tok);                                   // 5:18 從 s 開始
  kill(nD); glow(G.N.s, GOLD); g.look(0);
  say('開始！先看 s', 's 到 s 的距離？');
  await step(tok);                                   // 5:29 D(s) = 0，沒有 parent
  dLabel(G, 's', 0, null); g.mood('happy'); await g.hop(tok);
  say('同一個點：D(s) = 0', '沒有 parent');
  await step(tok);                                   // 5:43 a：沒有 explored 頂點可經過
  glow(G.N.s, null); glow(G.N.a, GOLD); g.mood('wow');
  await dGo(tok, g, 'a');
  const blk = tag('沒有 explored 頂點可以借道', 'bad', -0.6, 1.9, -2.6);
  say('再看 a：要找只經過 explored 的路', '可是 explored 還是空的');
  await step(tok);                                   // 6:08 到不了 → ∞
  kill(blk); dLabel(G, 'a', Infinity, null); g.mood('sad');
  say('到不了 a → D(a) = ∞', '沒有路，也就沒有 parent');
  await step(tok);                                   // 6:21 b、c 也是 ∞
  glow(G.N.a, null);
  for (const k of ['b', 'c']) { dLabel(G, k, Infinity, null); glow(G.N[k], GOLD); }
  say('b、c 一樣到不了', 'D(b) = D(c) = ∞');
  await step(tok);                                   // 6:32 初始狀態
  for (const k of ['b', 'c']) glow(G.N[k], null);
  await dGo(tok, g, 's'); g.mood('calm');
  say('這就是初始狀態', 's=0　a=∞　b=∞　c=∞');
}]);

// 07:15 explore s，再 explore a：b 從 3 改成 2、c 變成 11
FRAG.push(['dijk-explore-sa', 'Dijkstra：explore s 與 a，b 從 3 更新成 2', async (tok) => {
  fresh([0, 10.5, 8.6], [0, 0, -0.2]);
  const G = dGraph(0);
  dLabel(G, 's', 0, null); for (const k of ['a', 'b', 'c']) dLabel(G, k, Infinity, null);
  const g = dGuide('s');
  await step(tok);                                   // 7:17 規則：unexplored 裡 D 最小的去 explore
  for (const k of ['s', 'a', 'b', 'c']) dCls(G.TG[k], 'ptr alt');
  say('規則：unexplored 裡 D 最小的', '把它移到 explored');
  await step(tok);                                   // 7:26 最小的是 s
  for (const k of ['a', 'b', 'c']) dCls(G.TG[k], 'ptr');
  glow(G.N.s, GOLD); g.mood('happy'); await g.hop(tok);
  say('D 最小的是 s（0）', 'explore s');
  await step(tok);                                   // 7:41 s 移到 explored
  glow(G.N.s, null); dExplore(G, 's'); dSets(G, ['s']);
  say('s 移到 explored', 'unexplored 剩 a、b、c');
  await step(tok);                                   // 7:53 經過 s 到 a：1
  G.e('s', 'a').set(DC.hot, 1.8); glow(G.N.a, GOLD);
  const p = await dWalk(tok, '0 + 1', ['s', 'a']); kill(p);
  dLabel(G, 'a', 1, 's');
  say('經過 s 可以到 a', 'D(a) = 1，P(a) = s');
  await step(tok);                                   // 8:18 經過 s 到 b：3
  glow(G.N.a, null); G.e('s', 'a').set(DC.tree, 2);
  G.e('s', 'b').set(DC.hot, 1.8); glow(G.N.b, GOLD);
  const p2 = await dWalk(tok, '0 + 3', ['s', 'b']); kill(p2);
  dLabel(G, 'b', 3, 's');
  say('經過 s 可以到 b', 'D(b) = 3，P(b) = s');
  await step(tok);                                   // 8:25 到不了 c
  glow(G.N.b, null); G.e('s', 'b').set(DC.tree, 2); glow(G.N.c, GOLD);
  const nc = tag('只經過 s：到不了', 'bad', 4.0, 1.9, 0);
  say('只經過 s 到不了 c', 'D(c) 還是 ∞');
  await step(tok);                                   // 8:43 再取 D 最小的 a
  kill(nc); glow(G.N.c, null);
  await dGo(tok, g, 'a');
  dExplore(G, 'a'); dSets(G, ['s', 'a']);
  say('unexplored 中 D 最小的是 a（1）', 'a 移到 explored');
  await step(tok);                                   // 9:00 經過 a 到 b：2
  G.e('a', 'b').set(DC.hot, 1.8); glow(G.N.b, GOLD);
  const p3 = await dWalk(tok, '1 + 1 = 2', ['s', 'a', 'b']);
  say('現在可以經過 a 到 b', '1 + 1 = 2');
  await step(tok);                                   // 9:11 2 < 3 → 更新
  kill(p3); G.e('s', 'b').set(DC.dim, 0.7); G.e('a', 'b').set(DC.tree, 2);
  dLabel(G, 'b', 2, 'a'); g.mood('happy'); await g.hop(tok);
  say('2 < 3 → 更新', 'D(b) = 2，P(b) = a');
  await step(tok);                                   // 9:37 比較大就不換
  glow(G.N.b, null);
  const nb = tag('新的路比較長 → 不換', 'note', -0.6, 2.0, 2.6);
  say('只在找到更短的路時才換', '永遠留最小的');
  await step(tok);                                   // 10:07 經過 a 到 c：11
  kill(nb);
  G.e('a', 'c').set(DC.hot, 1.8); glow(G.N.c, GOLD);
  const p4 = await dWalk(tok, '1 + 10 = 11', ['s', 'a', 'c']); kill(p4);
  dLabel(G, 'c', 11, 'a'); G.e('a', 'c').set(DC.tree, 2);
  say('經過 a 到 c：1 + 10 = 11 < ∞', 'D(c) = 11，P(c) = a');
}]);

// 10:27 explore b：c 從 11 改成 2 + 4 = 6；explore c，結束
FRAG.push(['dijk-explore-bc', 'Dijkstra：explore b，c 從 11 更新成 6', async (tok) => {
  fresh([0, 10.5, 8.6], [0, 0, -0.2]);
  const G = dGraph(0);
  dExplore(G, 's'); dExplore(G, 'a'); dSets(G, ['s', 'a']);
  dLabel(G, 's', 0, null); dLabel(G, 'a', 1, 's'); dLabel(G, 'b', 2, 'a'); dLabel(G, 'c', 11, 'a');
  G.e('s', 'a').set(DC.tree, 2); G.e('a', 'b').set(DC.tree, 2); G.e('a', 'c').set(DC.tree, 2); G.e('s', 'b').set(DC.dim, 0.7);
  const g = dGuide('a');
  await step(tok);                                   // 10:27 D 最小的 b 去 explore
  await dGo(tok, g, 'b');
  dExplore(G, 'b'); dSets(G, ['s', 'a', 'b']);
  say('unexplored 中 D 最小的是 b（2）', 'b 移到 explored');
  await step(tok);                                   // 10:46 看 c
  glow(G.N.c, GOLD); g.look(1);
  say('b 進來了，再看 c', '經過 s、a、b 有沒有更短的路？');
  await step(tok);                                   // 10:56 b 到 c 的邊 = 4
  G.e('b', 'c').set(DC.hot, 1.8);
  say('b 到 c 的邊 = 4', '');
  await step(tok);                                   // 11:04 4 + D(b)
  const p = await dWalk(tok, 'D(b) + 4 = 2 + 4', ['b', 'c'], 900);
  say('加上 b 已經算好的 D(b) = 2', '2 + 4');
  await step(tok);                                   // 11:15 = 6 < 11 → 更新
  txt(p, '6 < 11 ✓'); G.e('a', 'c').set(DC.dim, 0.7);
  txt(G.TG.c, 'c：D=6 P=a'); g.mood('happy'); await g.hop(tok);
  say('2 + 4 = 6 < 11', '更新：D(c) = 6');
  await step(tok);                                   // 11:22 parent 是 b
  kill(p); G.e('b', 'c').set(DC.tree, 2); dLabel(G, 'c', 6, 'b');
  say('parent 也一起換', 'P(c) = b');
  await step(tok);                                   // 11:29 更新規則
  glow(G.N.c, null); g.mood('calm');
  const rule = tag('新距離 = D(explored 那端) + 邊的權重', 'note', 0, 0.3, 4.4);
  say('更新規則', 'D(v) = min(D(v), D(u) + w(u, v))');
  await step(tok);                                   // 11:47 我做了什麼：4 加 2
  txt(rule, '剛才：w(b, c) + D(b) = 4 + 2 = 6');
  say('回頭看剛才：4 加上已有的 2', '得到 6');
  await step(tok);                                   // 11:58 最後一個 c 進 explored
  kill(rule);
  await dGo(tok, g, 'c');
  dExplore(G, 'c'); dSets(G, ['s', 'a', 'b', 'c']);
  say('最後把 c 移到 explored', '');
  await step(tok);                                   // 12:15 全部 explored → 結束
  g.mood('happy'); await g.hop(tok);
  say('unexplored 空了', '演算法結束');
}]);

// 12:19 沿 P 回推：a、b、c 的最短路徑
FRAG.push(['dijk-path', 'Dijkstra：沿 parent 回推最短路徑', async (tok) => {
  fresh([0, 10.5, 8.6], [0, 0, -0.2]);
  const G = dGraph(0);
  for (const k of ['s', 'a', 'b', 'c']) dExplore(G, k);
  dSets(G, ['s', 'a', 'b', 'c']);
  dLabel(G, 's', 0, null); dLabel(G, 'a', 1, 's'); dLabel(G, 'b', 2, 'a'); dLabel(G, 'c', 6, 'b');
  for (const e of G.E) e.set(DC.dim, 0.7);
  const g = dGuide('s');
  const reset = () => { for (const [u, v] of [['s', 'a'], ['a', 'b'], ['b', 'c']]) G.e(u, v).set(DC.tree, 1.6); for (const k of ['s', 'a', 'b', 'c']) glow(G.N[k], null); };
  await step(tok);                                   // 12:19 要找出 s 到 a、b、c 的路
  reset();
  say('跑完後每個頂點都有 D 和 P', '要找 s 到 a、b、c 的實際路徑');
  await step(tok);                                   // 12:37 a：P(a) = s
  glow(G.N.a, GOLD); await dGo(tok, g, 'a');
  G.e('s', 'a').set(DC.path, 2.6); glow(G.N.s, GOLD);
  say('終點 a：P(a) = s', '路徑 s → a，cost = 1');
  await step(tok);                                   // 12:46 b：P(b) = a
  reset(); glow(G.N.b, GOLD); await dGo(tok, g, 'b');
  G.e('a', 'b').set(DC.path, 2.6); glow(G.N.a, GOLD);
  say('終點 b：P(b) = a', '先走回 a');
  await step(tok);                                   // 12:54 a 的 parent 是 s
  await dGo(tok, g, 'a');
  G.e('s', 'a').set(DC.path, 2.6); glow(G.N.s, GOLD);
  say('a 的 parent 是 s', 's → a → b');
  await step(tok);                                   // 13:09 cost = D
  const nc = tag('cost = D(b) = 2', 'note', -0.6, 2.0, 2.6);
  say('cost 不用重算', '就是那個頂點的 D：2');
  await step(tok);                                   // 13:16 c：P(c) = b
  kill(nc); reset(); glow(G.N.c, GOLD); await dGo(tok, g, 'c');
  G.e('b', 'c').set(DC.path, 2.6); glow(G.N.b, GOLD);
  await dGo(tok, g, 'b');
  G.e('a', 'b').set(DC.path, 2.6); glow(G.N.a, GOLD);
  say('終點 c：P(c) = b，P(b) = a', '一路往回走');
  await step(tok);                                   // 13:26 a 的 parent 是 s，cost 6
  await dGo(tok, g, 'a');
  G.e('s', 'a').set(DC.path, 2.6); glow(G.N.s, GOLD);
  say('P(a) = s：反過來就是路徑', 's → a → b → c，cost = 6');
  await step(tok);                                   // 13:36 這就是 Dijkstra
  await dGo(tok, g, 's'); g.mood('happy'); await g.hop(tok);
  say('這就是 Dijkstra', '在加權圖上找出最短路徑');
}]);
  }

  // ═══ galgo.js ═══
  {
const { V3, fresh, tag, cube, move, fly, kill, glow, txt, relabel, anim, arrow, ghostBox, line, GOLD, step, buddy, travel } = K;
// cued：每個 await step(tok) 等講者說到那一句；step 之間只有短短的動作。
const T = ctx.THREE;
// ─── 共用：地板上的圖（頂點方塊＋圓柱邊＋權重標籤） ───
const GC = { node: '#cbbd9f', edge: '#a8987c', hot: '#e8b02a', tree: '#2f7fd0', bad: '#d64545', dim: '#e4dccb', ok: '#2fc092', crit: '#c0392b', pq: '#e6c36a' };
function gCls(l, c) { l.element.className = 'lab-label' + (c ? ' ' + c : ''); }
function gN(name, x, z, color, drop = 3) {
  const m = cube(name, color || GC.node, [0.8, 0.6, 0.8], x, 0.3, z, drop);
  m.userData.xz = [x, z]; return m;
}
function gRod(x1, z1, x2, z2, color, r = 0.06) {
  const a = V3(x1, 0.3, z1), b = V3(x2, 0.3, z2), d = b.clone().sub(a);
  const m = new T.Mesh(new T.CylinderGeometry(r, r, Math.max(0.01, d.length()), 8), new T.MeshStandardMaterial({ color, roughness: 0.6 }));
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
  ctx.lab.world.add(m); return m;
}
// o.dir：有向（箭頭）；o.label：權重標籤文字；o.dummy：虛線活動（細、淡）
function gE(A, B, w, o = {}) {
  const [x1, z1] = A.userData.xz, [x2, z2] = B.userData.xz;
  const L = Math.hypot(x2 - x1, z2 - z1), ux = (x2 - x1) / L, uz = (z2 - z1) / L;
  const s = 0.48, e = o.dir ? 0.72 : 0.48;
  const rod = gRod(x1 + ux * s, z1 + uz * s, x2 - ux * e, z2 - uz * e, o.dummy ? '#cfc3a8' : GC.edge, o.dummy ? 0.035 : 0.06);
  let cone = null;
  if (o.dir) {
    cone = new T.Mesh(new T.ConeGeometry(0.15, 0.32, 12), rod.material);
    cone.position.set(x2 - ux * (e - 0.16), 0.3, z2 - uz * (e - 0.16));
    cone.quaternion.setFromUnitVectors(V3(0, 1, 0), V3(ux, 0, uz));
    ctx.lab.world.add(cone);
  }
  const text = o.label !== undefined ? o.label : (w === null || w === undefined ? null : String(w));
  const lbl = text === null ? null : tag(text, o.lcls || '', (x1 + x2) / 2 - uz * 0.36, 0.45, (z1 + z2) / 2 + ux * 0.36);
  const base = o.dummy ? 0.6 : 1;
  return { A, B, w, rod, cone, lbl, set(c, k = 1) { rod.material.color.set(c); rod.scale.set(k * base, 1, k * base); }, hide(h) { rod.visible = !h; if (cone) cone.visible = !h; if (lbl) lbl.element.style.visibility = h ? 'hidden' : ''; } };
}
function gG(nodes, edges, o = {}) {
  const N = {};
  for (const [k, [x, z]] of Object.entries(nodes)) N[k] = gN(k, x, z, o.color, o.drop === undefined ? 3 : o.drop);
  const E = edges.map(([u, v, w, lab, dummy]) => Object.assign(gE(N[u], N[v], w, { dir: o.dir, label: lab, dummy }), { u: String(u), v: String(v) }));
  const e = (u, v) => E.find((x) => (x.u === String(u) && x.v === String(v)) || (!o.dir && x.u === String(v) && x.v === String(u)));
  return { N, E, e };
}
function gTag(m, text, cls, dy = 1.1) { const [x, z] = m.userData.xz; return tag(text, cls || 'ptr', x, dy, z); }
function gUF(keys) { const p = {}; keys.forEach((k) => { p[k] = k; }); const f = (x) => (p[x] === x ? x : (p[x] = f(p[x]))); return { f, u(a, b) { p[f(a)] = f(b); } }; }
// 小幫手：一個會呼吸、會跳的小角色（站在地板上）
function gBud(name, x, z, color = '#f4a56a', size = 0.6) { return buddy(name, '', color, x, 0, z, size); }
// 一個小封包（'pkt'）從 a 走到 b（Vector3）
async function gPkt(tok, text, a, b, ms = 800) { const p = tag(text, 'pkt', a.x, a.y, a.z); await travel(tok, p, a, b, ms); return p; }
const gAt = (m, dy = 1.0) => { const [x, z] = m.userData.xz; return V3(x, dy, z); };

// ════════ Yx0dJFe1VdM：交大彭文志 Lec21 Graph (4/4)：topological order、AOV、AOE、critical path ════════
// 洪逸／Horowitz 的 AOV 例：0→1,2,3；1→4；2→4,5；3→4,5
const TPOS = { 0: [-5, 0], 1: [-2, -2.6], 2: [-2, 0], 3: [-2, 2.6], 4: [2.2, -1.4], 5: [2.2, 2] };
const TEDG = [[0, 1], [0, 2], [0, 3], [1, 4], [2, 4], [2, 5], [3, 4], [3, 5]];
const tSlot = (k) => [-3.3 + k * 1.3, -4.6];
const TSEQ = [0, 3, 2, 5, 1, 4];
// 依序把 sequence 的方塊放到下方的格子
function tSeq(seq, drop = 3) { const S = {}; seq.forEach((v, k) => { const [x, z] = tSlot(k); S[v] = cube(v, '#9b7ef4', [0.9, 0.55, 0.8], x, 0.3, z, drop); }); return S; }

// 00:00 AOV network：頂點 = activity，箭頭 = 順序；修課的例子
FRAG.push(['galgo-aov-course', 'AOV network：課程的先修關係', async (tok) => {
  fresh([0, 9.6, 9.4], [0, 0, -0.4]);
  const b = gBud('小修', 5.6, 3.2, '#7cb8ee');
  let G = null, S = null, C = null;
  await step(tok);                                   // 0:00 AOV：頂點代表 activity
  G = gG(TPOS, TEDG, { dir: true });
  for (const e of G.E) e.hide(true);
  for (const k of Object.keys(TPOS)) glow(G.N[k], GOLD);
  say('AOV：Activity On Vertex', '頂點 = 一件要做的事（activity）');
  await step(tok);                                   // 0:39 箭頭代表順序
  for (const k of Object.keys(TPOS)) glow(G.N[k], null);
  for (const e of G.E) e.hide(false);
  say('edge 的箭頭 = 先後順序', '通常由左往右');
  await step(tok);                                   // 1:01 推出 topological order
  const nt = tag('由順序關係推出：topological order', 'say', 0, 0.3, -3.4);
  say('從 AOV 可以推出', 'topological order');
  await step(tok);                                   // 1:31 輸出是一個 sequence
  kill(nt);
  S = tSeq(TSEQ);
  say('它的輸出是一個 sequence', '一條直線排好的順序（linear order）');
  await step(tok);                                   // 1:39 任兩點的前後關係都保留
  for (const k of [0, 4]) { glow(S[k], GOLD); glow(G.N[k], GOLD); }
  say('圖上任取兩點的前後關係', '在 sequence 裡都會保留（maintain）');
  await step(tok);                                   // 1:57 例子：大學修課系統
  for (const k of [0, 4]) { glow(S[k], null); glow(G.N[k], null); }
  fresh([0, 9.6, 9.4], [0, 0, -0.4]);
  const b2 = gBud('小修', 5.6, 3.2, '#7cb8ee'); b2.mood('wow');
  tag('15 門課，各有先修課程', 'note', 0, 0.3, -3.4);
  say('最生活的例子：大學修課系統', '有些課要先修過別的課才能修');
  await step(tok);                                   // 2:16 修 C10 PL 要先修 C7
  C = gG({ C3: [-4.6, -1.8], C6: [-4.6, 1.8], C7: [-0.6, 0], C10: [3.8, 0] }, [['C3', 'C7'], ['C6', 'C7'], ['C7', 'C10']], { dir: true });
  for (const e of C.E) e.hide(true);
  tag('Programming Language', 'idx', 3.8, 0.2, 0.9); tag('演算法', 'idx', -0.6, 0.2, 0.9);
  glow(C.N.C10, GOLD); glow(C.N.C7, GOLD); C.e('C7', 'C10').hide(false); C.e('C7', 'C10').set(GC.hot, 1.8);
  b2.mood('calm');
  say('要修 C10（Programming Language）', '先修課是 C7（演算法）');
  await step(tok);                                   // 2:22 C7 要先修 C3、C6
  glow(C.N.C10, null); glow(C.N.C3, GOLD); glow(C.N.C6, GOLD);
  for (const [u, v] of [['C3', 'C7'], ['C6', 'C7']]) { C.e(u, v).hide(false); C.e(u, v).set(GC.hot, 1.8); }
  tag('資料結構', 'idx', -4.6, 0.2, -0.9);
  say('C7 又要先修 C3 和 C6', 'C3 = Data Structure');
  await step(tok);                                   // 2:48 畫成 AOV：頂點 = 課程
  for (const k of ['C3', 'C6', 'C7']) glow(C.N[k], null);
  for (const e of C.E) e.set(GC.edge, 1);
  say('畫成圖就是一個 AOV', '頂點 = 課程：修一門課 = 一個 activity');
  await step(tok);                                   // 3:06 箭頭沒有 weight，只有方向
  const seq = ['C3', 'C6', 'C7', 'C10'];
  await anim(tok, 1600, (u) => { const k = Math.ceil(u * 4); for (let i = 0; i < k; i++) { const m = C.N[seq[i]]; m.material.color.set('#9b7ef4'); } });
  b2.mood('happy'); await b2.hop(tok);
  say('箭頭上沒有 weight', '只代表順序：C3、C6 → C7 → C10');
}]);

// 03:27 topological order 的性質：0 3 2 5 1 4，任取兩點順序都保留
FRAG.push(['galgo-topo-order', 'Topological order：0 3 2 5 1 4 保留前後關係', async (tok) => {
  fresh([0, 10, 9], [0, 0, -0.8]);
  const G = gG(TPOS, TEDG, { dir: true, drop: 0 });
  const b = gBud('小修', 5.6, 3.2, '#7cb8ee');
  let S = null;
  const pair = (a, c) => { for (const k of Object.keys(S)) { glow(S[k], null); glow(G.N[k], null); } for (const e of G.E) e.set(GC.edge, 1); for (const k of [a, c]) { glow(S[k], GOLD); glow(G.N[k], GOLD); } G.e(a, c).set(GC.hot, 2); };
  await step(tok);                                   // 3:27 給 AOV，輸出 sequence
  say('給一個 AOV network', 'topological order 的輸出是一個 sequence');
  await step(tok);                                   // 3:37 0 3 2 5 1 4
  S = tSeq(TSEQ);
  say('例如：0 3 2 5 1 4', '');
  await step(tok);                                   // 3:48 3 和 5
  pair(3, 5);
  say('任取 3 和 5：序列裡 3 在 5 前面', '圖上也是 3 → 5');
  await step(tok);                                   // 4:07 3 和 4
  pair(3, 4);
  say('3 和 4 也一樣', '序列裡 3 在前，圖上 3 → 4');
  await step(tok);                                   // 4:16 任兩點都保留
  for (const k of Object.keys(S)) { glow(S[k], null); glow(G.N[k], null); }
  for (const e of G.E) e.set(GC.tree, 1.3);
  b.mood('happy'); await b.hop(tok);
  say('任意兩點的前後關係都被 maintain', 'u → v ⇒ 序列中 u 在 v 之前');
}]);

// 04:25 產生方式：in-degree 0 的輸出 → 更新 in-degree → 重複
FRAG.push(['galgo-topo-steps', 'Topological sort：輸出 in-degree 0、更新、重複', async (tok) => {
  fresh([0, 10, 9], [0, 0, -0.8]);
  const G = gG(TPOS, TEDG, { dir: true, drop: 0 });
  const b = gBud('小修', 5.6, 3.2, '#7cb8ee');
  const indeg = { 0: 0, 1: 1, 2: 1, 3: 1, 4: 3, 5: 2 }, IT = {};
  let k = 0;
  const rules = tag('', 'say', 0, 0.3, 4.3);
  const out = async (v) => { glow(G.N[v], null); kill(IT[v]); const [x, z] = tSlot(k++); move(G.N[v], x, 0.3, z); await anim(tok, 600, () => {}); };
  const upd = (v) => { const outs = G.E.filter((e) => e.u === String(v)); for (const e of outs) { e.set(GC.dim, 0.6); indeg[e.v]--; txt(IT[e.v], 'in=' + indeg[e.v]); glow(G.N[e.v], '#3a2a00'); } return outs.map((e) => e.v); };
  const unglow = () => { for (const v of Object.keys(TPOS)) glow(G.N[v], null); };
  await step(tok);                                   // 4:25 怎麼產生？
  say('怎麼從 AOV 產生 topological order？', '方法很簡單');
  await step(tok);                                   // 4:50 步驟 1：in-degree 0 輸出
  for (const v of Object.keys(TPOS)) IT[v] = gTag(G.N[v], 'in=' + indeg[v], 'idx');
  txt(rules, '1. in-degree = 0 的頂點輸出');
  say('步驟 1：in-degree = 0（沒有人指向它）', '就可以輸出');
  await step(tok);                                   // 5:12 步驟 2：更新 in-degree
  txt(rules, '1. in-degree 0 輸出　2. 它指到的頂點 in-degree −1');
  say('步驟 2：它指到的那些頂點', 'in-degree 要更新（−1）');
  await step(tok);                                   // 5:27 步驟 3：重複
  txt(rules, '1. 輸出 in-degree 0　2. 更新 in-degree　3. 重複 1、2');
  say('步驟 3：重複 1、2', '');
  await step(tok);                                   // 5:43 只有 0 的 in-degree 是 0
  glow(G.N[0], GOLD);
  say('原圖中 in-degree 是 0 的', '只有 0');
  await step(tok);                                   // 5:52 輸出 0
  await out(0);
  say('輸出 0', 'sequence 第一個是 0');
  await step(tok);                                   // 6:05 更新 1、2、3
  upd(0);
  say('0 指到 1、2、3：in-degree 各 −1', '1、2、3 都變成 0');
  await step(tok);                                   // 6:37 回到步驟 1：有三個 0
  unglow(); for (const v of [1, 2, 3]) glow(G.N[v], GOLD);
  say('回到步驟 1', 'in-degree 0 的有三個：1、2、3');
  await step(tok);                                   // 6:45 任取一個：取 3
  for (const v of [1, 2]) glow(G.N[v], null);
  await out(3);
  say('任取一個都可以', '這個例子取 3');
  await step(tok);                                   // 7:02 更新 4、5
  upd(3);
  say('3 指到 4、5', '4、5 的 in-degree −1');
  await step(tok);                                   // 7:19 剩 1、2：取 2
  unglow(); for (const v of [1, 2]) glow(G.N[v], GOLD);
  glow(G.N[1], null);
  await out(2);
  say('in-degree 0 的剩 1 和 2', '取 2 輸出');
  await step(tok);                                   // 7:28 更新 4、5
  upd(2);
  say('2 指到 4、5', '再更新它們的 in-degree');
  await step(tok);                                   // 7:36 依此類推
  unglow();
  for (const v of [5, 1]) { glow(G.N[v], GOLD); await out(v); upd(v); }
  unglow();
  say('依此類推：5、1 輸出', '');
  await step(tok);                                   // 7:51 全部輸出就結束
  await out(4);
  b.mood('happy'); await b.hop(tok);
  txt(rules, 'topological order：0 3 2 5 1 4');
  say('所有頂點都輸出就結束', '0 3 2 5 1 4');
}]);

// 08:00 實作：adjacency list 多一個 count 欄位（= in-degree）
FRAG.push(['galgo-topo-count', 'Topological sort 實作：count 欄位', async (tok) => {
  fresh([0, 10.5, 8.2], [0, 0, -0.3]);
  const LST = { 0: [1, 2, 3], 1: [4], 2: [4, 5], 3: [4, 5], 4: [], 5: [] };
  const cnt = { 0: 0, 1: 1, 2: 1, 3: 1, 4: 3, 5: 2 };
  const C = {}, H = {}, z0 = (v) => -3.4 + v * 1.35;
  const b = gBud('小修', 6.0, 3.9, '#7cb8ee', 0.5);
  const out = [];
  const emit = (v) => { glow(C[v], GOLD); glow(H[v], GOLD); out.push(cube(v, '#9b7ef4', [0.8, 0.5, 0.8], 5.6, 0.25, z0(out.length), 2.5)); };
  const dec = (v) => { for (const u of LST[v]) { cnt[u]--; relabel(C[u], cnt[u]); glow(C[u], '#3a2a00'); } };
  const clr = () => { for (let v = 0; v <= 5; v++) { glow(C[v], null); glow(H[v], null); } };
  await step(tok);                                   // 8:00 adjacency list 多一個欄位
  tag('vertex', 'idx', -4.4, 0.3, -4.5); tag('adjacency list', 'idx', -0.6, 0.3, -4.5);
  for (let v = 0; v <= 5; v++) {
    H[v] = cube(v, '#cbbd9f', [0.8, 0.5, 0.8], -4.4, 0.25, z0(v), 2.5);
    LST[v].forEach((u, k) => { const x = -2.4 + k * 1.7; arrow(V3(x - 1.25, 0.3, z0(v)), V3(x - 0.48, 0.3, z0(v))); cube(u, '#4b9ee2', [0.8, 0.5, 0.8], x, 0.25, z0(v), 2.5); });
  }
  say('實作：在 adjacency list 上', '多加一個欄位');
  await step(tok);                                   // 8:19 count = in-degree
  tag('count', 'idx', -5.8, 0.3, -4.5);
  for (let v = 0; v <= 5; v++) C[v] = cube(cnt[v], '#e6c36a', [0.8, 0.5, 0.8], -5.8, 0.25, z0(v), 2.5);
  say('這個欄位叫 count', 'count = in-degree');
  await step(tok);                                   // 8:35 scan count：0 → 輸出
  tag('output', 'idx', 5.6, 0.3, -4.5);
  emit(0);
  say('scan count 欄位：是 0 的就輸出', '第一個是 vertex 0');
  await step(tok);                                   // 8:56 沿 0 的 list：1、2、3 的 count −1
  dec(0);
  say('沿著 vertex 0 的 list：1、2、3', '它們的 count 各 −1');
  await step(tok);                                   // 9:14 1、2、3 的 count 變 0
  clr(); for (const v of [1, 2, 3]) glow(C[v], GOLD);
  say('1、2、3 的 count 都變 0', '');
  await step(tok);                                   // 9:20 重複
  clr();
  await anim(tok, 2400, (u) => { const want = Math.ceil(u * 5); while (out.length - 1 < want) { const v = [3, 2, 5, 1, 4][out.length - 1]; emit(v); dec(v); } });
  clr();
  say('重複同樣的步驟', '輸出 3、2、5、1、4');
  await step(tok);                                   // 9:26 順序不唯一
  b.mood('wow');
  say('注意：topological order 不唯一', '');
  await step(tok);                                   // 9:42 剛才取 3，也可以取 1 或 2
  for (const v of [1, 2, 3]) glow(H[v], GOLD);
  say('剛才 1、2、3 都是 0 時取了 3', '其實取 1 或 2 也可以');
  await step(tok);                                   // 9:55 0 1 2 3… 也可以
  for (const v of [1, 2, 3]) glow(H[v], null);
  const alt = tag('0 1 2 3 … 也合法', 'note', 3.4, 0.3, -4.5);
  say('例如 0 1 2 3 開頭', '還是符合前後順序');
  await step(tok);                                   // 10:13 只要前後關係保留
  b.mood('happy');
  say('只要前後順序關係保留就可以', 'sequence 不是唯一的');
  await step(tok);                                   // 10:43 inverse adjacency list
  kill(alt); b.mood('calm');
  const inv = tag('inverse adjacency list：記錄「誰指向我」', 'note', 1.0, 0.3, 4.4);
  say('不用 count 也可以', 'inverse adjacency list：記 in-degree 跟誰連');
  await step(tok);                                   // 11:15 這裡用最簡單的：count
  txt(inv, '這裡用最簡單的方法：多一個 count 欄位');
  say('搭配 adjacency list 也能做', '這裡用最簡單的 count 欄位');
}]);

// 洪逸／Horowitz 的 AOE 例（a1..a11）
const APOS = { 0: [-6, 0], 1: [-3.5, -2.6], 2: [-3.5, 0], 3: [-3.5, 2.6], 4: [-0.6, -1.3], 5: [-0.6, 2.6], 6: [2.4, -2.6], 7: [2.4, 1], 8: [5.4, -0.6] };
const AEDG = [[0, 1, 6, 'a1=6'], [0, 2, 4, 'a2=4'], [0, 3, 5, 'a3=5'], [1, 4, 1, 'a4=1'], [2, 4, 1, 'a5=1'], [3, 5, 2, 'a6=2'], [4, 6, 9, 'a7=9'], [4, 7, 7, 'a8=7'], [5, 7, 4, 'a9=4'], [6, 8, 2, 'a10=2'], [7, 8, 4, 'a11=4']];

// 11:32 AOE network：activity 在 edge 上
FRAG.push(['galgo-aoe-net', 'AOE network：activity 在 edge 上', async (tok) => {
  fresh([0, 10.5, 9], [0, 0, -0.3]);
  const b = gBud('小經理', -6.2, 3.6, '#f4a56a', 0.55);
  let G = null;
  await step(tok);                                   // 11:32 AOE：activity on edge
  const q = tag('activity 改放在 edge 上', 'say', -6.2, 1.5, 3.6);
  say('AOE：Activity On Edge', '跟 AOV 不一樣');
  await step(tok);                                   // 11:47 頂點告訴你何時開始、結束
  kill(q);
  say('activity 在 edge 上', '頂點 = 事件：某些 activity 開始或結束的時間點');
  await step(tok);                                   // 12:06 vertex 0 = project 開始
  G = gG(APOS, AEDG, { dir: true });
  for (const e of G.E) if (e.lbl) e.lbl.element.style.visibility = 'hidden';
  glow(G.N[0], GOLD); gTag(G.N[0], 'start');
  say('一個 AOE network', 'vertex 0 = project 開始');
  await step(tok);                                   // 12:16 例：做一個 web 搜尋引擎
  tag('project：開發 web 搜尋引擎', 'note', 0, 0.3, -4.2);
  say('例如：開發一個 web 搜尋引擎', '分成好幾個步驟');
  await step(tok);                                   // 12:31 11 個 activity
  glow(G.N[0], null);
  for (const e of G.E) { if (e.lbl) e.lbl.element.style.visibility = ''; e.set(GC.hot, 1.4); }
  say('這個例子有 11 個 activity', 'a1 ～ a11');
  await step(tok);                                   // 12:41 a1 = 6
  for (const e of G.E) e.set(GC.edge, 1);
  G.E[0].set(GC.hot, 1.9);
  say('a1：0 → 1', '需要 6 個時間單位');
  await step(tok);                                   // 12:56 a2 = 4、a3 = 5
  G.E[1].set(GC.hot, 1.9); G.E[2].set(GC.hot, 1.9);
  say('a2 要 4，a3（0 → 3）要 5', '');
  await step(tok);                                   // 13:15 可以同時進行（teamwork）
  for (const k of [0, 1, 2]) G.E[k].set(GC.ok, 1.9);
  b.mood('happy'); await b.hop(tok);
  say('a1、a2、a3 可以同時進行', '一個 team：有人做 a1、有人做 a2、有人做 a3');
  await step(tok);                                   // 13:34 a4、a5 做完到達 4
  for (const k of [0, 1, 2]) G.E[k].set(GC.edge, 1);
  b.mood('calm');
  G.E[3].set(GC.hot, 1.8); G.E[4].set(GC.hot, 1.8); glow(G.N[4], GOLD);
  say('下一階段：a4、a5 都做完', '才到達事件 4');
  await step(tok);                                   // 13:58 才能啟動 a7、a8
  G.E[3].set(GC.edge, 1); G.E[4].set(GC.edge, 1);
  G.E[6].set(GC.ok, 1.8); G.E[7].set(GC.ok, 1.8);
  say('到達 4 之後', 'a7、a8 才能開始');
  await step(tok);                                   // 14:06 到 8 = finish
  glow(G.N[4], null); G.E[6].set(GC.edge, 1); G.E[7].set(GC.edge, 1);
  glow(G.N[8], GOLD); gTag(G.N[8], 'finish');
  say('一直做到 8', '整個 project 完成（finish）');
  await step(tok);                                   // 14:14 大公司用它控管進度
  const pm = tag('每個人負責哪段、要花多久', 'say', -6.2, 1.5, 3.6);
  say('大公司開發軟體就用這種圖', '控管每個人的計畫與時間');
  await step(tok);                                   // 14:36 有人 delay 就無法如期
  txt(pm, '有人 delay → 整個 project 延誤');
  b.mood('sad');
  say('有一個人 delay', '整個 project 就沒辦法如期完成');
}]);

// 16:02 AOE 的 adjacency list：count + duration
FRAG.push(['galgo-aoe-list', 'AOE 的 adjacency list：count 與 duration', async (tok) => {
  fresh([0, 11.5, 7.6], [0, 0, -0.2]);
  const L = { 0: [[1, 6], [2, 4], [3, 5]], 1: [[4, 1]], 2: [[4, 1]], 3: [[5, 2]], 4: [[6, 9], [7, 7]], 5: [[7, 4]], 6: [[8, 2]], 7: [[8, 4]], 8: [] };
  const cnt = [0, 1, 1, 1, 2, 1, 1, 2, 2], zz = (v) => -4 + v * 0.98;
  const C = [], I = {}, H = [];
  await step(tok);                                   // 16:02 表示法：adjacency list
  tag('vertex', 'idx', -4.6, 0.3, -4.9); tag('list', 'idx', -0.2, 0.3, -4.9);
  for (let v = 0; v <= 8; v++) {
    H.push(cube(v, '#cbbd9f', [0.8, 0.45, 0.75], -4.6, 0.22, zz(v), 2));
    I[v] = L[v].map(([u], k) => { const x = -2.2 + k * 2.2; arrow(V3(x - 1.75, 0.3, zz(v)), V3(x - 0.75, 0.3, zz(v))); return cube(u, '#4b9ee2', [1.4, 0.45, 0.75], x, 0.22, zz(v), 2); });
  }
  say('AOE 的表示法：adjacency list', '');
  await step(tok);                                   // 16:21 count 欄位 = in-degree
  tag('count', 'idx', -5.8, 0.3, -4.9);
  for (let v = 0; v <= 8; v++) C.push(cube(cnt[v], '#e6c36a', [0.8, 0.45, 0.75], -5.8, 0.22, zz(v), 2));
  C.forEach((c) => glow(c, GOLD));
  say('每個頂點前面一樣有 count 欄位', 'count = in-degree：有幾條箭頭指向它');
  await step(tok);                                   // 16:39 vertex 0 → 1、2、3
  C.forEach((c) => glow(c, null));
  glow(H[0], GOLD); I[0].forEach((c) => glow(c, GOLD));
  say('例：vertex 0 連出去', '有 1、2、3 三個 node');
  await step(tok);                                   // 16:51 list node 多一個欄位
  I[0].forEach((c) => glow(c, null)); glow(H[0], null);
  tag('vertex | duration', 'idx', 1.2, 0.3, -4.9);
  say('list 的 node 多一個欄位', 'duration（持續時間）');
  await step(tok);                                   // 17:05 0 → 1：duration 6
  relabel(I[0][0], '1 | 6'); glow(I[0][0], GOLD);
  say('duration = 這條 edge（activity）要花的時間', '0 → 1：6 個時間單位');
  await step(tok);                                   // 17:38 0 → 2：4，0 → 3：5
  glow(I[0][0], null);
  relabel(I[0][1], '2 | 4'); relabel(I[0][2], '3 | 5'); glow(I[0][1], GOLD); glow(I[0][2], GOLD);
  say('0 → 2：duration 4', '0 → 3：duration 5');
  await step(tok);                                   // 17:52 頂點＋duration 都要放
  I[0].forEach((c) => glow(c, null));
  for (let v = 1; v <= 8; v++) L[v].forEach(([u, d], k) => relabel(I[v][k], u + ' | ' + d));
  say('所以 list 除了記頂點', '還要記 duration');
}]);

// 18:11 最早完成時間 ee：topological order + stack
FRAG.push(['galgo-aoe-ee', 'AOE 最早時間 ee：用 stack 做 topological order', async (tok) => {
  fresh([0, 10.5, 9.2], [0, 0, -0.6]);
  const G = gG(APOS, AEDG, { dir: true, drop: 0 });
  const b = gBud('小經理', -6.4, 3.8, '#f4a56a', 0.5);
  const ee = [0, 0, 0, 0, 0, 0, 0, 0, 0], ET = [];
  const st = [];
  const push = (v) => { st.push([v, cube(v, '#9b7ef4', [0.8, 0.5, 0.8], -5 + st.length * 1.0, 0.25, -4.6, 2.5)]); };
  const pop = () => { const [v, m] = st.pop(); fly(m, V3(0, 8, -3)); glow(G.N[v], GOLD); return v; };
  const relax = (u) => {
    const outs = G.E.filter((e) => e.u === String(u)), parts = [];
    for (const e of outs) {
      const v = Number(e.v), nv = ee[u] + e.w;
      e.set(GC.hot, 1.8);
      parts.push(ee[v] > 0 && nv <= ee[v] ? 'ee(' + v + ') 維持 ' + ee[v] : 'ee(' + v + ') = ' + ee[u] + ' + ' + e.w + ' = ' + Math.max(nv, ee[v]));
      if (nv > ee[v]) ee[v] = nv;
      txt(ET[v], 'ee=' + ee[v]);
    }
    return parts.join('　');
  };
  const settle = (u) => { for (const e of G.E) if (e.u === String(u)) e.set(GC.tree, 1.3); glow(G.N[u], null); };
  await step(tok);                                   // 18:11 每個 activity 最早完成時間
  for (let v = 0; v <= 8; v++) ET.push(gTag(G.N[v], v ? 'ee=?' : 'ee=0', 'ptr'));
  say('算每個 activity 最早完成的時間', 'ee（earliest）');
  await step(tok);                                   // 18:48 例：a1；時間從 0 開始
  glow(G.N[0], GOLD); G.E[0].set(GC.hot, 1.8);
  say('例：a1 最早什麼時候完成？', '時間從 0 開始');
  await step(tok);                                   // 19:20 a1 要 6 → 6
  const p = await gPkt(tok, '0 + 6', gAt(G.N[0]), gAt(G.N[1]), 900); kill(p);
  ee[1] = 6; txt(ET[1], 'ee=6');
  say('a1 要 6 天：沒有 delay', '最早第 6 天完成');
  await step(tok);                                   // 20:03 a2 = 4
  G.E[1].set(GC.hot, 1.8);
  const p2 = await gPkt(tok, '0 + 4', gAt(G.N[0]), gAt(G.N[2]), 900); kill(p2);
  ee[2] = 4; txt(ET[2], 'ee=4');
  say('a2 要 4 天', '0 + 4 = 4');
  await step(tok);                                   // 20:24 記在 edge 指到的頂點上
  glow(G.N[1], GOLD);
  say('怎麼記？寫在 edge 指到的頂點上', '頂點 1 = 6：a1 完成的時間');
  await step(tok);                                   // 21:04 用 topological order
  glow(G.N[0], null); glow(G.N[1], null); G.E[0].set(GC.edge, 1); G.E[1].set(GC.edge, 1);
  ee[1] = 0; ee[2] = 0; txt(ET[1], 'ee=?'); txt(ET[2], 'ee=?');
  tag('stack', 'idx', -6.2, 0.3, -4.6);
  say('要有系統地算：用 topological order', '搭配一個 stack');
  await step(tok);                                   // 21:25 in-degree 0 只有 0 → push
  push(0); glow(G.N[0], GOLD);
  say('一開始 in-degree 0 的只有起點 0', 'push 進 stack');
  await step(tok);                                   // 21:52 pop 0
  pop();
  say('pop 出 0', '從它現在的時間 0 出發');
  await step(tok);                                   // 22:16 0 + 6、0 + 4、0 + 5
  say('對它指到的每個頂點算到達時間', relax(0));
  await step(tok);                                   // 23:05 1、2、3 的 count −1
  settle(0);
  for (const k of [1, 2, 3]) glow(G.N[k], '#3a2a00');
  say('0 輸出了：1、2、3 的 count −1', 'count 都變 0');
  await step(tok);                                   // 23:26 push 3 2 1
  for (const k of [1, 2, 3]) glow(G.N[k], null);
  push(1); push(2); push(3);
  say('count 是 0 的 push 進 stack', 'stack：1 2 3（3 在最上面）');
  await step(tok);                                   // 23:48 pop 3
  pop();
  say('pop 出 3', '到達 3 的時間是 5');
  await step(tok);                                   // 24:03 5 + 2 = 7
  say('3 → 5 的 a6 = 2', relax(3));
  await step(tok);                                   // 24:40 5 的 count 變 0 → push
  settle(3); push(5);
  say('5 的 in-degree 變 0', 'push 進 stack');
  await step(tok);                                   // 24:53 一直做到 stack 空
  const rest = [5, 2, 1, 4, 7, 6];
  await anim(tok, 2400, (u) => {
    const want = Math.ceil(u * rest.length);
    while (rest.length > 6 - want) {
      const v = rest.shift();
      if (st.length && st[st.length - 1][0] === v) pop(); relax(v); settle(v);
      if (v === 1) push(4); if (v === 4) { push(6); push(7); }
    }
  });
  while (st.length) pop();
  glow(G.N[8], GOLD);
  b.mood('happy');
  say('一直重複到 stack 空為止', 'ee(8) = 18：project 最早第 18 天完成');
  await step(tok);                                   // 25:02 總結：最早到達時間
  await b.hop(tok);
  say('ee 就是每個 edge 指到的頂點', '最早的到達時間（多條路取最大）');
}]);

// 課堂第二例（另一本課本）：依講解重建的 AOE；6′、7′、10′ 是 sync 點，細線是 0 時間的 dummy
const BPOS = { X: [-6.2, 0], 2: [-4.4, -2.2], 3: [-4.4, 2.2], "6'": [-2.8, 0], 6: [-1.2, 0], 4: [-1.2, -2.8], "7'": [0.6, -1.4], 7: [2.4, -1.4], 5: [-2.6, 3.4], 8: [0.6, 3.4], "10'": [4.3, 0.6], 10: [6.2, 0.6] };
const BEDG = [['X', '2', 3, 'A=3'], ['X', '3', 2, 'B=2'], ['2', "6'", 0, null, 1], ['3', "6'", 0, null, 1], ["6'", '6', 2, 'D=2'], ['2', '4', 3, 'C=3'], ['3', '5', 1, 'E=1'],
  ['4', "7'", 0, null, 1], ['6', "7'", 0, null, 1], ["7'", '7', 3, 'F=3'], ['7', "10'", 0, null, 1], ['5', '8', 0, null, 1], ['8', "10'", 2, 'G=2'], ['5', "10'", 4, 'K=4'], ["10'", '10', 1, 'H=1']];
const BEE = { X: 0, 2: 3, 3: 2, "6'": 3, 6: 5, 4: 6, 5: 3, "7'": 6, 7: 9, 8: 3, "10'": 9, 10: 10 };
const BLE = { X: 0, 2: 3, 3: 4, "6'": 4, 6: 6, 4: 6, 5: 5, "7'": 6, 7: 9, 8: 7, "10'": 9, 10: 10 };
const BCRIT = ['X', '2', '4', "7'", '7', "10'", '10'];
function gAOE2(drop = 3) { return gG(BPOS, BEDG, { dir: true, drop }); }

// 25:27 另一本課本的例子：critical path 是什麼
FRAG.push(['galgo-crit-intro', 'Critical path：不能 delay 的那條路', async (tok) => {
  fresh([0, 10.5, 9.2], [0, 0, 0.2]);
  const b = gBud('小經理', -6.3, 4.2, '#f4a56a', 0.5);
  let G = null;
  await step(tok);                                   // 25:27 另一本教科書的例子
  G = gAOE2();
  say('換另一本教科書的例子', '一樣是 AOE：邊上的字母 = activity 與天數');
  await step(tok);                                   // 25:58 目標：找出 critical path
  const nt = tag('目標：找出 critical path', 'say', 0, 0.3, -4.4);
  say('要從這個 AOE 找出', 'critical path（關鍵路徑）');
  await step(tok);                                   // 26:14 起點到終點，某些點非常重要
  for (let i = 0; i < BCRIT.length; i++) { glow(G.N[BCRIT[i]], '#5a1a00'); if (i) G.e(BCRIT[i - 1], BCRIT[i]).set(GC.crit, 1.8); }
  say('從起點到終點，有一些點特別重要', '它們沒有可以 delay 的空間');
  await step(tok);                                   // 26:31 一般的可以早一天或晚一天
  glow(G.N['5'], GOLD);
  const ok = tag('晚一兩天也沒關係', 'good', -2.6, 1.5, 3.4);
  say('一般的 activity：提早或晚一天也許 OK', '');
  await step(tok);                                   // 26:48 critical 一旦 delay 就毀了
  kill(ok); glow(G.N['5'], null); b.mood('sad');
  tag('晚一天 → 整個 project 晚一天', 'bad', 0.6, 1.5, -1.4);
  say('critical path 上不能有任何 delay', '一 delay，整個 project 就延誤');
  await step(tok);                                   // 26:54 兩個步驟
  b.mood('calm');
  txt(nt, '步驟 1：最早時間 ee　步驟 2：最晚時間 le');
  say('找 critical path 有兩個步驟', '先算最早時間，再算最晚時間');
}]);

// 27:02 ee(w) = max{ee(v) + dur}：sync 點取最大
FRAG.push(['galgo-ee-max', 'ee 往右推：sync 點取 max', async (tok) => {
  fresh([0, 10.5, 9.2], [0, 0, 0.2]);
  const G = gAOE2(0), ET = {};
  const b = gBud('小經理', -6.3, 4.2, '#f4a56a', 0.5);
  let hot = [];
  const show = (ks, es) => { for (const e of hot) e.set(GC.tree, 1.3); hot = es.map(([u, v]) => G.e(u, v)); for (const k of Object.keys(BPOS)) glow(G.N[k], null); for (const [u, v] of es) G.e(u, v).set(GC.hot, 1.8); for (const k of ks) { txt(ET[k], 'ee=' + BEE[k]); glow(G.N[k], GOLD); } };
  await step(tok);                                   // 27:02 步驟 1：算最早時間
  for (const k of Object.keys(BPOS)) ET[k] = gTag(G.N[k], 'ee=?', 'ptr');
  say('步驟 1：每個點最早的時間', '用 topological order 由左往右');
  await step(tok);                                   // 27:21 起點 0；公式
  txt(ET.X, 'ee=0'); glow(G.N.X, GOLD);
  const f = tag('ee(w) = max{ ee(v) + dur(v, w) }', 'note', 0, 0.3, -4.4);
  say('起點設成 0', 'ee(w) = max{ ee(v) + dur(v, w) }，v 指向 w');
  await step(tok);                                   // 28:17 到 2：0 + 3
  show(['2'], [['X', '2']]);
  say('A = 3：到 2 最早是 0 + 3', 'ee(2) = 3');
  await step(tok);                                   // 28:35 到 3：0 + 2
  show(['3'], [['X', '3']]);
  say('B = 2：到 3 是 0 + 2', 'ee(3) = 2');
  await step(tok);                                   // 28:44 6′ 是什麼？
  show([], [['2', "6'"], ['3', "6'"]]); glow(G.N["6'"], GOLD);
  say('為什麼多一個 6′？', '2 和 3 都會指到它');
  await step(tok);                                   // 29:23 sync：A、B 都完成才做 D
  b.mood('wow');
  say('6′ 是 sync（同步點）', 'A 和 B 都做完，才能開始 D');
  await step(tok);                                   // 29:58 max(3, 2) = 3
  txt(ET["6'"], 'ee=3'); b.mood('calm');
  say('取最大值：max(3, 2) = 3', 'D 至少要等第 3 天才能開始');
  await step(tok);                                   // 30:21 D = 2 → 5
  show(['6'], [["6'", '6']]);
  say('第 3 天開始做 D（2 天）', 'ee(6) = 3 + 2 = 5');
  await step(tok);                                   // 30:40 C：3 + 3 = 6
  show(['4'], [['2', '4']]);
  say('C = 3：3 + 3', 'ee(4) = 6');
  await step(tok);                                   // 31:33 E：2 + 1 = 3
  show(['5', '8'], [['3', '5'], ['5', '8']]);
  say('下面 E = 1：2 + 1', 'ee(5) = 3');
  await step(tok);                                   // 31:45 這些就是最早 arrival time
  show([], []);
  say('這些數字就是每個點', '最早的到達時間（arrival time）');
  await step(tok);                                   // 31:54 7′：C、D 都完成才做 F
  show(["7'", '7'], [['4', "7'"], ['6', "7'"], ["7'", '7']]);
  say('7′ 也是 sync：C、D 都完成才能做 F', 'max(6, 5) = 6，ee(7) = 6 + 3 = 9');
  await step(tok);                                   // 32:37 一路推到底：10 天
  show(["10'", '10'], [['7', "10'"], ['5', "10'"], ['8', "10'"], ["10'", '10']]);
  b.mood('happy'); await b.hop(tok);
  say('一直往右推到底', '整個 project 最早第 10 天完成');
  await step(tok);                                   // 33:08 每個點：往前看它的 edge
  show([], [['5', "10'"]]);
  txt(f, '每個點 = 進來的 activity 最早完成的時間');
  say('每個點往前看它的 edge', '例：K 最早第 3 + 4 = 7 天就能完成');
}]);

// 33:40 le(v) = min{le(w) − dur}：反向 topological order 取最小
FRAG.push(['galgo-le-min', 'le 往左推：分岔點取 min', async (tok) => {
  fresh([0, 10.5, 9.2], [0, 0, 0.2]);
  const G = gAOE2(0), LT = {};
  const b = gBud('小經理', -6.3, 4.2, '#f4a56a', 0.5);
  const show = (ks, es) => { for (const e of G.E) if (e.rod.material.color.getHexString() === 'd64545') e.set(GC.pq, 1.3); for (const k of Object.keys(BPOS)) glow(G.N[k], null); for (const [u, v] of es) G.e(u, v).set(GC.bad, 1.8); for (const k of ks) { txt(LT[k], 'le=' + BLE[k]); glow(G.N[k], GOLD); } };
  await step(tok);                                   // 33:40 最晚什麼時候要完成
  for (const k of Object.keys(BPOS)) LT[k] = gTag(G.N[k], 'le=?', 'ptr alt');
  say('也可以算：每個 activity 最晚要多晚完成', 'le（latest）');
  await step(tok);                                   // 34:25 ee 左→右，le 右→左
  const dir = tag('ee：左 → 右　le：右 → 左', 'note', 0, 0.3, -4.4);
  say('ee 由左往右算', 'le 由右往左算');
  await step(tok);                                   // 34:40 10 天是底線
  glow(G.N['10'], GOLD); txt(LT['10'], 'le=10');
  say('project 10 天內一定要完成：這是底線', '從這裡往回推');
  await step(tok);                                   // 35:12 reverse topological order
  txt(dir, 'reverse topological order：改數 out-degree');
  say('用 reverse topological order', 'count 改成算 out-degree');
  await step(tok);                                   // 35:57 從右邊開始
  txt(dir, 'le(v) = min{ le(w) − dur(v, w) }');
  say('從最右邊開始：10 天內完成', '往左走，每次減掉 duration');
  await step(tok);                                   // 36:13 10 − 1 = 9
  show(["10'"], [["10'", '10']]);
  say('H 要 1 天：10 − 1', 'le(10′) = 9');
  await step(tok);                                   // 36:32 9 − 0 = 9
  show(['7'], [['7', "10'"]]);
  say('dummy 是 0 天：9 − 0', 'le(7) = 9');
  await step(tok);                                   // 37:00 9 − 3 = 6
  show(["7'", '8'], [["7'", '7'], ['8', "10'"]]);
  say('F 要 3 天：9 − 3 = 6 → le(7′) = 6', 'G 要 2 天：le(8) = 9 − 2 = 7');
  await step(tok);                                   // 37:23 抉擇點：7 − 0 還是 9 − 4
  show([], [['5', '8'], ['5', "10'"]]); glow(G.N['5'], GOLD);
  b.mood('wow');
  say('抉擇點：5 有兩條路往右', '7 − 0 = 7，還是 9 − 4 = 5？');
  await step(tok);                                   // 37:53 取最小：5
  txt(LT['5'], 'le=5'); b.mood('calm');
  say('準則：取最小值', 'le(5) = min(7, 5) = 5');
  await step(tok);                                   // 38:15 選 7 可以嗎？
  G.e('5', "10'").set(GC.bad, 2.4);
  say('為什麼不能選 7？', '');
  await step(tok);                                   // 38:44 7 + 4 = 11 > 10
  const over = tag('7 + 4 = 11 > 10 ✗', 'bad', 1.6, 1.5, 2.6);
  b.mood('sad');
  say('第 7 天才開始 K（要 4 天）', '7 + 4 = 11，超過 10 天');
  await step(tok);                                   // 39:07 K 最晚第 5 天要啟動
  txt(over, '最晚第 5 天啟動 K：5 + 4 = 9 ✓'); gCls(over, 'good');
  b.mood('happy');
  say('所以 K 最晚第 5 天就要啟動', 'project 才能如期完成');
  await step(tok);                                   // 39:45 其他一直回推
  kill(over); b.mood('calm');
  await anim(tok, 2000, (u) => { const ks = ['4', '6', "6'", '3', '2', 'X']; ks.slice(0, Math.ceil(u * ks.length)).forEach((k) => txt(LT[k], 'le=' + BLE[k])); });
  show([], []);
  say('其他點一樣往左推（影片跳過）', 'le(4) = 6　le(6′) = 4　le(3) = 4　le(2) = 3　le(X) = 0');
}]);

// 40:02 critical path：ee − le = 0 的點連成的路
FRAG.push(['galgo-critical-path', 'Critical path：ee = le、不能 delay', async (tok) => {
  fresh([0, 10.5, 9.2], [0, 0, 0.2]);
  const G = gAOE2(0), TG = {};
  const b = gBud('小經理', -6.3, 4.2, '#f4a56a', 0.5);
  await step(tok);                                   // 40:02 紅色 = 最晚、可以拖多久
  for (const k of Object.keys(BPOS)) TG[k] = gTag(G.N[k], 'le=' + BLE[k], 'ptr alt');
  say('紅色數字 le：每個點最晚要多晚完成', '也就是可以拖多久');
  await step(tok);                                   // 40:20 每個點都有藍、紅兩個數字
  for (const k of Object.keys(BPOS)) { txt(TG[k], BEE[k] + ' / ' + BLE[k]); gCls(TG[k], 'ptr'); }
  tag('ee / le', 'idx', -5.6, 0.3, -4.4);
  say('每個頂點都有兩個數字', '藍 ee（最早）／紅 le（最晚）');
  await step(tok);                                   // 40:28 相減為 0 → critical
  const slackK = Object.keys(BPOS).filter((k) => BLE[k] > BEE[k]);
  for (const k of slackK) gCls(TG[k], 'idx');
  for (const k of BCRIT) glow(G.N[k], GOLD);
  say('ee − le = 0 的點', '最早 = 最晚：一點空間都沒有');
  await step(tok);                                   // 40:46 X → 2 → 4 → 7 → 10′ → 10
  await anim(tok, 1800, (u) => { const n = Math.ceil(u * BCRIT.length); for (let i = 0; i < n; i++) { G.N[BCRIT[i]].material.color.set(GC.crit); gCls(TG[BCRIT[i]], 'ptr alt'); if (i) G.e(BCRIT[i - 1], BCRIT[i]).set(GC.crit, 2.4); } });
  for (const k of BCRIT) glow(G.N[k], null);
  say('連起來：紅色的 critical path', 'X → 2 → 4 → 7 → 10′ → 10');
  await step(tok);                                   // 40:53 不能延誤
  b.mood('sad');
  say('這條路上的點完全不能延誤', '最早和最晚相減是 0');
  await step(tok);                                   // 41:10 一定存在嗎？
  b.mood('wow');
  const q = tag('思考：critical path 一定存在嗎？', 'say', 0, 0.3, -4.4);
  say('想一想：critical path 一定存在嗎？', '（會：起點到終點最長的那條路）');
  await step(tok);                                   // 41:36 怎麼找出所有 critical path？
  txt(q, '思考：怎麼找出所有的 critical path？');
  say('想一想：怎麼找出 critical path？', '算完 ee、le 後，挑相減為 0 的');
  await step(tok);                                   // 42:04 今天的重點
  txt(q, 'topological order → AOV、AOE → critical path');
  b.mood('happy'); await b.hop(tok);
  say('今天的重點：topological order', 'AOV、AOE 怎麼用它推出 critical path');
}]);
// ════════ JR2fneVevbg：Minimum Cost Spanning Tree（Kruskal & Prim 的 greedy 策略）：8 頂點、10 條邊 ════════
const LPOS = { 1: [-4.5, -1.6], 2: [-1.5, -1.6], 3: [1.5, -1.6], 4: [4.5, -1.6], 5: [-4.5, 1.8], 6: [-1.5, 1.8], 7: [1.5, 1.8], 8: [4.5, 1.8] };
const LEDG = [[1, 2, 8], [2, 3, 7], [3, 4, 9], [1, 5, 4], [2, 6, 12], [3, 7, 10], [4, 8, 6], [5, 6, 14], [6, 7, 13], [7, 8, 11, '11?']];
const L8 = (drop) => gG(LPOS, LEDG, { drop });
const LSORT = () => [...LEDG].sort((a, b) => a[2] - b[2]);

// 00:00 定義＋例子：10 條邊，只能留 n − 1 = 7 條
FRAG.push(['galgo-8v-count', 'MST：8 個頂點、10 條邊，只留 7 條', async (tok) => {
  fresh([0, 10, 8.6], [0, 0, 0.3]);
  await step(tok);                                   // 0:00 minimum cost spanning tree（greedy）
  const b = gBud('小樹', -6.0, 3.6);
  const q = tag('用 greedy 找最便宜的樹', 'say', -6.0, 1.6, 3.6);
  say('Minimum cost spanning tree', '用 greedy method 的角度來看');
  await step(tok);                                   // 0:14 weighted connected undirected graph
  const G = L8();
  say('weighted、connected、undirected graph', '有權重、連通、沒有方向');
  await step(tok);                                   // 0:41 cost = 選中的邊相加
  kill(q);
  for (const [u, v] of [[1, 5], [1, 2], [2, 3]]) G.e(u, v).set(GC.tree, 2);
  const nc = tag('cost = 4 + 8 + 7 + …', 'note', 0, 0.3, -3.4);
  say('spanning tree 的 cost', '= 選中的邊 cost 加起來');
  await step(tok);                                   // 1:00 找 cost 最小的
  for (const e of G.E) e.set(GC.edge, 1);
  txt(nc, '目標：cost 最小的 spanning tree');
  b.mood('wow');
  say('目標：找 cost 最小的 spanning tree', '');
  await step(tok);                                   // 1:15 例子：8 個頂點
  kill(nc); b.mood('calm');
  for (let k = 1; k <= 8; k++) glow(G.N[k], GOLD);
  say('例子：8 個頂點的圖', '1、2、…、8');
  await step(tok);                                   // 1:35 權重
  for (let k = 1; k <= 8; k++) glow(G.N[k], null);
  for (const e of G.E) if (e.lbl) gCls(e.lbl, 'note');
  say('權重：8, 7, 9, 4, 12, 10, 6, 14, 13…', '這個 graph 也叫 network');
  await step(tok);                                   // 1:48 數一數：10 條邊
  for (const e of G.E) if (e.lbl) gCls(e.lbl, '');
  const cnt = tag('邊：0', 'ptr alt', 0, 0.3, -3.6);
  await anim(tok, 2200, (u) => { const k = Math.min(10, Math.ceil(u * 10)); G.E.forEach((e, i) => e.set(i < k ? GC.hot : GC.edge, i < k ? 1.5 : 1)); txt(cnt, '邊：' + k); });
  say('數一數：10 條邊', '');
  await step(tok);                                   // 2:07 spanning tree 只有 n − 1 = 7 條
  for (const e of G.E) e.set(GC.edge, 1);
  txt(cnt, 'spanning tree：只能有 7 條');
  say('spanning tree 只有 n − 1 條邊', '這裡是 7 條，但圖有 10 條');
  await step(tok);                                   // 2:26 n = 頂點數：8 − 1
  txt(cnt, 'n = 頂點數 = 8 → 8 − 1 = 7');
  say('n 是頂點個數', '8 − 1 = 7');
  await step(tok);                                   // 2:40 選 7 條或丟 3 條
  for (const [u, v] of [[5, 6], [6, 7], [7, 8]]) G.e(u, v).set(GC.bad, 1.4);
  for (const e of G.E) if (e.rod.material.color.getHexString() !== 'd64545') e.set(GC.tree, 1.8);
  txt(cnt, '選 7 條（藍）＝ 丟 3 條（紅）');
  b.mood('happy'); await b.hop(tok);
  say('兩種做法：select 7 條，或 discard 3 條', '');
}]);

// 03:18 Kruskal：n 個頂點、0 條邊；邊由小到大，不形成 cycle 才選
FRAG.push(['galgo-8v-kruskal', 'Kruskal：邊由小到大，不成 cycle 才選', async (tok) => {
  fresh([0, 10, 8.6], [0, 0, 0.3]);
  const G = L8(0);
  const b = gBud('小樹', -6.0, 3.6);
  await step(tok);                                   // 3:18 edge selection
  say('greedy 第一類：edge selection', '一條一條「選」邊');
  await step(tok);                                   // 3:56 方法一：Kruskal
  const t = tag('方法一：Kruskal', 'say', -6.0, 1.6, 3.6);
  say('方法一：Kruskal', '');
  await step(tok);                                   // 4:07 n 個頂點、0 條邊
  for (const e of G.E) e.hide(true);
  say('先放 n 個頂點、0 條邊', '頂點之間都先不連');
  await step(tok);                                   // 4:40 由小到大
  for (const e of G.E) { e.hide(false); e.set(GC.dim, 0.6); }
  const row = tag('4 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14', 'note', 0, 0.3, -3.6);
  say('邊依 cost 由小到大考慮', 'ascending order');
  await step(tok);                                   // 5:10 不形成 cycle 就選
  const ord = LSORT();
  await anim(tok, 2200, (u) => { const k = Math.ceil(u * 6); ord.slice(0, k).forEach(([x, y]) => G.e(x, y).set(GC.tree, 2.2)); });
  txt(row, '選了 4、6、7、8、9、10');
  say('不會形成 cycle → 選', '4、6、7、8、9、10 都選');
  await step(tok);                                   // 5:26 唯一條件：不能有 cycle
  G.e(7, 8).set(GC.bad, 2);
  for (const [x, y] of [[3, 4], [4, 8], [3, 7]]) G.e(x, y).set(GC.hot, 2.2);
  txt(row, '11：3–4–8–7 會繞成一圈 → 不選');
  b.mood('sad');
  say('下一條 11 會跟 3–4–8 形成 cycle', '不能有 cycle → 丟掉');
  await step(tok);                                   // 5:31 跟已選的邊一起不成 cycle → 選
  for (const [x, y] of [[3, 4], [4, 8], [3, 7]]) G.e(x, y).set(GC.tree, 2.2);
  G.e(7, 8).set(GC.dim, 0.5);
  G.e(2, 6).set(GC.tree, 2.2);
  for (const [x, y] of [[6, 7], [5, 6]]) G.e(x, y).set(GC.dim, 0.5);
  txt(row, '12 選進來：7 條，cost = 56');
  kill(t); b.mood('happy'); await b.hop(tok);
  say('12 跟已選的邊不成 cycle → 選', '滿 7 條：MST');
}]);

// 05:53 Prim：從一個頂點長成 n 個頂點的樹，每次加最小的相連邊
FRAG.push(['galgo-8v-prim', 'Prim：從一個頂點長出一棵樹', async (tok) => {
  fresh([0, 10, 8.6], [0, 0, 0.3]);
  const G = L8(0);
  const b = gBud('小樹', -6.0, 3.6);
  const inT = new Set();
  const cross = () => G.E.filter((e) => inT.has(e.u) !== inT.has(e.v));
  const paint = () => { for (const e of G.E) if (e.rod.scale.x < 2) { const c = cross().includes(e); e.set(c ? GC.pq : GC.edge, c ? 1.5 : 1); } };
  const add = async (u, v) => {
    const e = G.e(u, v), w = inT.has(String(u)) ? String(v) : String(u);
    e.set(GC.tree, 2.2); inT.add(w); G.N[w].material.color.set(GC.ok); move(G.N[w], ...[G.N[w].userData.xz[0], 0.55, G.N[w].userData.xz[1]]);
    await travel(tok, b.g, b.g.position.clone(), V3(G.N[w].userData.xz[0] - 0.9, 0, G.N[w].userData.xz[1] + 0.9), 700);
    paint();
  };
  await step(tok);                                   // 5:54 方法二：Prim
  say('方法二：Prim', '');
  await step(tok);                                   // 6:05 只從 1 個頂點開始
  inT.add('1'); G.N[1].material.color.set(GC.ok);
  await travel(tok, b.g, b.g.position.clone(), V3(-5.4, 0, -0.7), 700);
  say('Kruskal 從 n 個頂點開始', 'Prim 只從 1 個頂點開始');
  await step(tok);                                   // 6:19 長成 n 個頂點的樹
  const goal = tag('目標：長成 8 個頂點的樹', 'say', 0, 0.3, -3.6);
  say('從一個頂點慢慢長大', '長成 n 個頂點的樹');
  await step(tok);                                   // 6:36 每次加一個頂點＋一條邊
  paint();
  await add(1, 5);
  say('每次加一個頂點、一條邊', '加入 5（邊 4）');
  await step(tok);                                   // 6:54 有選擇時加 cost 最小的
  paint(); G.e(1, 2).set(GC.hot, 1.8);
  say('有好幾條可選：8、14', '選 cost 最小的 8');
  await add(1, 2);
  await step(tok);                                   // 7:07 差別：只看跟樹相連的邊
  txt(goal, '黃色 = 跟樹相連的邊（Prim 只看這些）');
  say('Kruskal 看全部的邊', 'Prim 只看跟目前這棵樹相連的邊');
  await step(tok);                                   // 7:23 例：選最小的
  G.e(2, 3).set(GC.hot, 1.8);
  say('相連的邊：7、12、14', '選最小的 7');
  await add(2, 3);
  await step(tok);                                   // 7:42 不選 4、選 3（較小的）
  G.e(3, 4).set(GC.hot, 1.8);
  say('相連的邊：9、10、12、14', '不選大的，選小的 9');
  await add(3, 4);
  await step(tok);                                   // 7:51 這就是 Prim
  txt(goal, '一直重複：直到 8 個頂點都進來');
  b.mood('happy'); await b.hop(tok);
  say('Prim：過程中永遠是一棵樹', '重複到 n 個頂點為止');
}]);

// 08:04 edge rejection：找 cycle 刪最大的邊；或由大到小刪（仍連通才刪）
FRAG.push(['galgo-8v-reject', 'Edge rejection：在 cycle 裡刪掉最貴的邊', async (tok) => {
  fresh([0, 10, 8.6], [0, 0, 0.3]);
  const G = L8(0);
  for (const e of G.E) e.hide(true);
  const b = gBud('小樹', -6.0, 3.6);
  const cut = async (u, v) => { const e = G.e(u, v); e.set(GC.bad, 2); await K.anim(tok, 700, () => {}); e.hide(true); };
  const cyc = async (es, worst) => { for (const e of G.E) if (e.rod.visible) e.set(GC.edge, 1); for (const [u, v] of es) G.e(u, v).set(GC.hot, 1.8); await cut(...worst); };
  await step(tok);                                   // 8:04 edge rejection
  const t = tag('改成「丟」邊', 'say', -6.0, 1.6, 3.6);
  say('greedy 第二類：edge rejection', '一條一條「丟」邊');
  await step(tok);                                   // 8:47 從連通圖開始
  for (const e of G.E) e.hide(false);
  say('方法一：從整張連通圖開始', '10 條邊全部都在');
  await step(tok);                                   // 9:02 找 cycle，刪最貴的
  say('找到 cycle：8、12、14、4', '刪掉最貴的 14');
  await cyc([[1, 2], [2, 6], [5, 6], [1, 5]], [5, 6]);
  await step(tok);                                   // 9:19 一直重複
  say('再找一個 cycle：7、10、13、12', '刪掉最貴的 13');
  await cyc([[2, 3], [3, 7], [6, 7], [2, 6]], [6, 7]);
  await step(tok);                                   // 9:34 沒有 cycle 就停
  say('最後一個 cycle：9、6、11、10', '刪掉 11 → 沒有 cycle，停');
  await cyc([[3, 4], [4, 8], [7, 8], [3, 7]], [7, 8]);
  for (const e of G.E) if (e.rod.visible) e.set(GC.tree, 2);
  b.mood('happy');
  await step(tok);                                   // 9:56 方法二：由大到小
  for (const e of G.E) { e.hide(false); e.set(GC.edge, 1); }
  txt(t, '14 → 13 → 12 → 11 → 10 → 9 …'); b.mood('calm');
  say('方法二：邊依 cost 由大到小考慮', 'descending order');
  await step(tok);                                   // 10:04 刪了還連通才刪
  const desc = [[5, 6, 1], [6, 7, 1], [2, 6, 0], [7, 8, 1], [3, 7, 0], [3, 4, 0]];
  for (const [u, v, del] of desc) { const e = G.e(u, v); e.set(del ? GC.bad : GC.tree, del ? 1.8 : 2); await K.anim(tok, 380, () => {}); if (del) e.hide(true); }
  txt(t, '14、13、11 刪掉；12、10、9 刪了會斷 → 留');
  say('刪掉之後還連通，才刪', '會把圖切斷的邊就留下');
  await step(tok);                                   // 10:17 兩種技巧
  for (const e of G.E) if (e.rod.visible) e.set(GC.tree, 2);
  b.mood('happy'); await b.hop(tok);
  say('兩種丟邊的方法', '剩下 7 條：同一棵 MST');
}]);
// ════════ 4ZlRH0eK-qQ：Abdul Bari〈Prim's and Kruskal's Algorithms〉 ════════
const HEX = {}; for (let k = 1; k <= 6; k++) { const a = (-90 + (k - 1) * 60) * Math.PI / 180; HEX[k] = [+(3.2 * Math.cos(a)).toFixed(2), +(3.2 * Math.sin(a)).toFixed(2)]; }
const HEDG = [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1]];

// 00:00 spanning tree：全部頂點 + n − 1 條邊、沒有 cycle
FRAG.push(['galgo-bari-st6', 'Spanning tree：6 個頂點取 5 條邊', async (tok) => {
  fresh([0, 10, 8], [0, 0, 0]);
  const b = gBud('小樹', -5.6, 3.2);
  let G = null;
  await step(tok);                                   // 0:00 先了解 spanning tree
  const q = tag('spanning tree 是什麼？', 'say', -5.6, 1.6, 3.2);
  say('Minimum cost spanning tree', '先弄懂：什麼是 spanning tree');
  await step(tok);                                   // 0:12 G = (V, E)，V = {1..6}
  kill(q);
  G = gG(HEX, HEDG);
  for (const e of G.E) e.hide(true);
  say('圖 G = (V, E)', 'V = 頂點集合 {1, 2, 3, 4, 5, 6}');
  await step(tok);                                   // 0:32 E = 邊的集合
  for (const e of G.E) { e.hide(false); e.set(GC.hot, 1.5); }
  say('E = 邊的集合', '(1, 2)、(2, 3)、(3, 4)…');
  await step(tok);                                   // 0:41 spanning tree 是 subgraph
  for (const e of G.E) e.set(GC.edge, 1);
  say('spanning tree 是 G 的 subgraph', '從 G 裡拿一部分出來');
  await step(tok);                                   // 0:58 頂點全拿，邊拿一部分
  for (let k = 1; k <= 6; k++) glow(G.N[k], GOLD);
  say('頂點：全部都要拿', '邊：只拿一部分');
  await step(tok);                                   // 1:12 n = 6 → 5 條邊
  for (let k = 1; k <= 6; k++) glow(G.N[k], null);
  const nt = tag('n = 6 → 只拿 n − 1 = 5 條邊', 'note', 0, 0.3, -4.2);
  say('n = 6 個頂點', '邊只拿 n − 1 = 5 條');
  await step(tok);                                   // 1:35 拿 5 條，不拿 (6, 1)
  G.e(6, 1).hide(true);
  for (const e of G.E) if (e !== G.e(6, 1)) e.set(GC.tree, 2);
  b.mood('happy'); await b.hop(tok);
  say('拿 1、2、3、4、5 號邊，不拿 (6, 1)', '這就是一棵 spanning tree');
  await step(tok);                                   // 1:45 tree 不能有 cycle
  txt(nt, 'tree 沒有 cycle：繞不回原點');
  say('tree 不會有 cycle', '從一點出發繞不回自己');
  await step(tok);                                   // 2:02 換一條不拿
  G.e(6, 1).hide(false); G.e(6, 1).set(GC.tree, 2);
  G.e(1, 2).hide(true);
  txt(nt, '改成不拿 (1, 2)：也是 spanning tree');
  say('拿 (6, 1)、不拿 (1, 2)', '也是一棵 spanning tree');
  await step(tok);                                   // 2:12 選哪幾條是 choice
  G.e(1, 2).hide(false); G.e(1, 2).set(GC.edge, 1);
  txt(nt, '要選哪幾條邊：有好幾種選擇');
  say('選哪幾條邊是一個 choice', '');
  await step(tok);                                   // 2:18 形式定義
  for (const e of G.E) e.set(GC.edge, 1);
  txt(nt, 'S ⊆ G：V(S) = V(G)，|E(S)| = |V| − 1');
  say('形式定義', 'S ⊆ G：V(S) = V(G)，|E(S)| = |V| − 1');
}]);

// 02:51 有幾棵 spanning tree：6C5 = 6；多一條邊後要扣掉含 cycle 的組合
FRAG.push(['galgo-bari-count', '可能的 spanning tree 有幾棵', async (tok) => {
  fresh([0, 10, 8], [0, 0, 0]);
  const G = gG(HEX, HEDG, { drop: 0 });
  const b = gBud('小樹', -5.6, 3.2);
  const nt = tag('', 'note', 0, 0.3, -4.2);
  let ch = null;
  await step(tok);                                   // 2:51 可以有幾棵？
  b.mood('wow');
  say('一張圖可以生出幾棵不同的 spanning tree？', '');
  await step(tok);                                   // 3:01 6 條邊選 5 條
  b.mood('calm');
  for (const e of G.E) e.set(GC.tree, 2);
  txt(nt, '6 條邊選 5 條：6C5');
  say('6 條邊，要選 5 條', '6C5');
  await step(tok);                                   // 3:20 6C5 = 6：每次少一條
  await anim(tok, 2400, (u) => { const k = Math.min(5, Math.floor(u * 6)); G.E.forEach((e, i) => e.hide(i === k)); });
  G.E.forEach((e) => e.hide(false));
  txt(nt, '6C5 = 6 棵');
  say('每次不拿其中一條', '6C5 = 6 棵');
  await step(tok);                                   // 3:50 多一條邊：7 條選 5 條
  ch = gE(G.N[2], G.N[5], null); ch.set(GC.hot, 1.8);
  txt(nt, '多一條 (2, 5)：7 條選 5 條');
  say('再多一條邊 (2, 5)', '7 條邊選 5 條');
  await step(tok);                                   // 3:57 可能性更多
  for (const e of G.E) e.set(GC.dim, 0.6);
  for (const [u, v] of [[1, 2], [3, 4], [4, 5], [5, 6]]) G.e(u, v).set(GC.tree, 2); ch.set(GC.tree, 2);
  say('例如這樣也是一棵', '可能性變多了');
  await step(tok);                                   // 4:12 7C5，但會有 cycle
  for (const e of G.E) e.set(GC.tree, 2); ch.set(GC.hot, 1.8);
  txt(nt, '7C5 = 21，但有些組合含 cycle');
  say('7C5 = 21', '可是 (2, 5) 會造成 cycle');
  await step(tok);                                   // 4:20 兩個 cycle
  for (const [u, v] of [[1, 2], [5, 6], [6, 1]]) G.e(u, v).set(GC.bad, 2);
  ch.set(GC.bad, 2);
  await anim(tok, 1200, () => {});
  for (const [u, v] of [[1, 2], [5, 6], [6, 1]]) G.e(u, v).set(GC.tree, 2);
  for (const [u, v] of [[2, 3], [3, 4], [4, 5]]) G.e(u, v).set(GC.bad, 2);
  say('1-2-5-6 是一個 cycle', '2-3-4-5 是另一個');
  await step(tok);                                   // 4:32 Bari：7C5 − 2
  for (const [u, v] of [[2, 3], [3, 4], [4, 5]]) G.e(u, v).set(GC.tree, 2); ch.set(GC.hot, 1.8);
  txt(nt, 'Bari：7C5 − 2（cycle 個數）');
  say('Bari 的算法：7C5 − 2', '');
  await step(tok);                                   // 4:41 一般式（要更正）
  txt(nt, '正確：21 − 6（含 cycle 的組合）= 15');
  b.mood('wow');
  say('一般式：C(|E|, |V| − 1) − cycle 數', '小心：要扣「含 cycle 的組合」，這裡是 6 → 15 棵');
}]);

// 05:06 weighted graph：不同 spanning tree 的 cost 不同（14、13、9）
FRAG.push(['galgo-bari-costs', '不同 spanning tree 的 cost：14、13、9', async (tok) => {
  fresh([0, 9.5, 7.6], [0, 0, 0]);
  const b = gBud('小樹', -5.2, 2.8);
  let G = null;
  const total = tag('', 'ptr alt', 0, 0.3, -3.5);
  const show = (es, s) => { for (const e of G.E) e.set(GC.dim, 0.6); for (const [u, v] of es) G.e(u, v).set(GC.tree, 2.2); txt(total, 'cost = ' + s); };
  await step(tok);                                   // 5:06 weighted graph
  G = gG({ 1: [-2.6, -2], 2: [2.6, -2], 3: [2.6, 2], 4: [-2.6, 2] }, [[1, 2, 5], [2, 3, 3], [3, 4, 6], [4, 1, 4], [1, 3, 2]]);
  say('邊上有權重：weighted graph', '');
  await step(tok);                                   // 5:22 4 個頂點 → 3 條邊
  say('畫幾棵 spanning tree 看看', '4 個頂點 → 每棵 3 條邊');
  await step(tok);                                   // 5:34 第一棵：14
  show([[1, 2], [2, 3], [3, 4]], '5 + 3 + 6 = 14');
  say('第一棵', 'cost = 5 + 3 + 6 = 14');
  await step(tok);                                   // 5:47 第二棵：13
  show([[4, 1], [3, 4], [2, 3]], '4 + 6 + 3 = 13');
  say('第二棵', 'cost = 4 + 6 + 3 = 13');
  await step(tok);                                   // 6:04 第三棵：9
  show([[4, 1], [1, 3], [2, 3]], '4 + 2 + 3 = 9');
  b.mood('happy'); await b.hop(tok);
  say('第三棵', 'cost = 4 + 2 + 3 = 9');
  await step(tok);                                   // 6:24 cost 會不一樣
  say('觀察：不同的 spanning tree', 'cost 會不一樣');
  await step(tok);                                   // 6:42 找最小的
  txt(total, '找 cost 最小的：minimum cost spanning tree');
  say('問題：cost 最小的是哪一棵？', 'minimum cost spanning tree');
  await step(tok);                                   // 6:57 全部試一遍
  b.mood('sad');
  say('方法一：全部試一遍，挑最小', '可以，但太花時間');
  await step(tok);                                   // 7:07 greedy：Prim、Kruskal
  b.mood('happy'); await b.hop(tok);
  txt(total, 'greedy：Prim、Kruskal');
  say('有 greedy 方法', 'Prim 和 Kruskal');
}]);

// Bari 的 7 頂點圖（與本章互動模式同一張）
const BARI7 = { 1: [0, -3.3], 2: [3.7, -1.7], 3: [3.3, 1.9], 4: [0, 3.3], 5: [-3.3, 1.9], 6: [-3.7, -1.7], 7: [0, 0] };
const BARI7E = [[1, 2, 28], [1, 6, 10], [2, 3, 16], [2, 7, 14], [3, 4, 12], [4, 5, 22], [4, 7, 18], [5, 6, 25], [5, 7, 24]];
const bari7 = (drop) => gG(BARI7, BARI7E, { drop });

// 07:42 Prim（cued 版的 prim-connected-min）：先選最小邊，之後只選相連的最小邊
FRAG.push(['galgo-bari-prim', 'Prim：每次選跟樹相連的最小邊', async (tok) => {
  fresh([0, 11, 9.4], [0, 0, -0.2]);
  const b = gBud('小樹', -6.2, 3.6);
  let G = null; const inT = new Set();
  const cost = tag('cost = 0', 'ptr alt', 5.6, 0.3, -3.8);
  let c = 0;
  const cross = () => G.E.filter((e) => inT.has(e.u) !== inT.has(e.v));
  const paint = () => { for (const e of G.E) if (e.rod.scale.x < 2) { const k = cross().includes(e); e.set(k ? GC.pq : GC.edge, k ? 1.5 : 1); } };
  const take = async (u, v) => {
    const e = G.e(u, v); e.set(GC.tree, 2.2);
    for (const k of [String(u), String(v)]) if (!inT.has(k)) { inT.add(k); G.N[k].material.color.set(GC.ok); }
    c += e.w; txt(cost, 'cost = ' + c);
    const [x, z] = G.N[v].userData.xz; await travel(tok, b.g, b.g.position.clone(), V3(x - 0.9, 0, z + 0.9), 700);
    paint();
  };
  await step(tok);                                   // 7:42 用 Prim 找 MST
  G = bari7();
  say('兩個演算法：先看 Prim', '在這張 weighted graph 上找 MST');
  await step(tok);                                   // 7:56 先選全圖最小的邊
  G.e(1, 6).set(GC.hot, 2);
  say('第一步：選整張圖最小的邊', '(1, 6) = 10');
  await take(1, 6);
  await step(tok);                                   // 8:09 之後要連到已選的頂點
  say('之後：一樣選最小的邊', '但一定要連到已選的頂點（黃色）');
  await step(tok);                                   // 8:22 (3, 4) = 12 不能選
  G.e(3, 4).set(GC.bad, 1.8); b.mood('sad');
  const no = tag('12 沒連到 1 或 6 → 不選', 'bad', 1.65, 1.4, 2.6);
  say('下一小的是 (3, 4) = 12', '沒有連到 1 或 6 → 不能選');
  await step(tok);                                   // 8:34 一直維持一棵樹
  kill(no); paint(); b.mood('calm');
  say('Prim 的想法：一直維持一棵樹', '選遠處的邊，最後可能接不成樹');
  await step(tok);                                   // 8:58 相連的 25、28 → 25
  G.e(5, 6).set(GC.hot, 2);
  say('跟 1、6 相連的：25、28', '選 25 → 加入 5');
  await take(6, 5);
  await step(tok);                                   // 9:09 22、24、28 → 22
  G.e(4, 5).set(GC.hot, 2);
  say('相連的：28、24、22', '選 22 → 加入 4');
  await take(5, 4);
  await step(tok);                                   // 9:26 24、18、12 → 12
  G.e(3, 4).set(GC.hot, 2);
  say('相連的：28、24、18、12', '選 12 → 加入 3');
  await take(4, 3);
  await step(tok);                                   // 9:33 24、18、16 → 16
  G.e(2, 3).set(GC.hot, 2);
  say('相連的：28、24、18、16', '選 16 → 加入 2');
  await take(3, 2);
  await step(tok);                                   // 9:51 2 → 7：14
  G.e(2, 7).set(GC.hot, 2);
  say('相連的最小：(2, 7) = 14', '加入 7');
  await take(2, 7);
  await step(tok);                                   // 9:57 7 個頂點、6 條邊
  for (const e of G.E) if (e.rod.scale.x < 2) e.set(GC.dim, 0.6);
  b.mood('happy'); await b.hop(tok);
  say('7 個頂點都進來了：6 條邊', 'minimum cost spanning tree');
  await step(tok);                                   // 10:20 cost = 99
  say('cost = 10 + 25 + 22 + 12 + 16 + 14', '= 99');
  await step(tok);                                   // 10:31 Prim 的作法
  txt(cost, 'Prim：先選最小，再一直選「相連的」最小');
  say('Prim：先選最小的邊', '之後一直選跟樹相連的最小邊');
}]);

// 10:42 Prim 遇到不連通的圖：只會長出起點那一塊
FRAG.push(['galgo-prim-disconn', 'Prim 遇到不連通的圖', async (tok) => {
  fresh([0, 10, 8.4], [0, 0, 0]);
  const b = gBud('小樹', -5.4, 3.6);
  let G = null;
  await step(tok);                                   // 10:42 7 個頂點、兩塊
  G = gG({ 1: [-5, -1.6], 2: [-2.4, -2.2], 3: [-2.4, 1.4], 4: [-5, 1.8], 5: [1.6, -1.8], 6: [4.8, -1.2], 7: [3.2, 2] },
    [[1, 2], [2, 3], [3, 4], [4, 1], [1, 3], [5, 6], [6, 7], [7, 5]]);
  say('7 個頂點，但分成兩塊', 'not connected');
  await step(tok);                                   // 11:03 沒有演算法找得到
  b.mood('sad');
  say('Prim 找得到它的 MST 嗎？', '不行，任何演算法都不行');
  await step(tok);                                   // 11:17 spanning tree 一定要連通
  tag('spanning tree 必須連通', 'bad', 0, 0.3, -3.6);
  say('spanning tree 一定要連通', '不連通的圖根本沒有 spanning tree');
  await step(tok);                                   // 11:21 從 1 跑 Prim：只得到一塊
  b.mood('calm');
  G.N[1].material.color.set(GC.ok);
  await anim(tok, 1800, (u) => { const k = Math.ceil(u * 3); [[1, 2], [2, 3], [3, 4]].slice(0, k).forEach(([x, y]) => { G.e(x, y).set(GC.tree, 2.2); G.N[y].material.color.set(GC.ok); }); });
  for (const k of [5, 6, 7]) glow(G.N[k], '#3a0000');
  say('從頂點 1 跑 Prim', '只得到 1 那一塊的 spanning tree；5、6、7 接不上');
}]);

// 11:31 Kruskal（cued 版的 kruskal-reject-cycle）：全圖最小邊，形成 cycle 就丟
FRAG.push(['galgo-bari-kruskal', 'Kruskal：全圖最小邊，形成 cycle 就丟掉', async (tok) => {
  fresh([0, 11, 9.4], [0, 0, -0.2]);
  const G = bari7(0);
  const b = gBud('小樹', -6.2, 3.6);
  const cost = tag('cost = 0', 'ptr alt', 5.6, 0.3, -3.8);
  const row = tag('10 → 12 → 14 → 16 → 18 → 22 → 24 → 25 → 28', 'note', 0, 0.3, -4.6);
  let c = 0;
  const pick = (u, v) => { const e = G.e(u, v); e.set(GC.tree, 2.2); G.N[u].material.color.set(GC.ok); G.N[v].material.color.set(GC.ok); c += e.w; txt(cost, 'cost = ' + c); };
  const drop = (u, v) => { G.e(u, v).set(GC.bad, 2); };
  await step(tok);                                   // 11:31 Kruskal：也是 greedy
  say('另一個方法：Kruskal', '也是 greedy，不用試所有 spanning tree');
  await step(tok);                                   // 11:47 永遠選最小的邊
  say('規則：永遠選 cost 最小的邊', '從整張圖挑');
  await step(tok);                                   // 11:59 (1, 6) = 10
  pick(1, 6); say('最小：(1, 6) = 10', '選');
  await step(tok);                                   // 12:05 (3, 4) = 12
  pick(3, 4); say('下一小：(3, 4) = 12', '不用跟前面相連，照選');
  await step(tok);                                   // 12:13 (2, 7) = 14
  pick(2, 7); say('(2, 7) = 14', '選');
  await step(tok);                                   // 12:23 (2, 3) = 16
  pick(2, 3); say('(2, 3) = 16', '選'); await b.hop(tok);
  await step(tok);                                   // 12:29 (4, 7) = 18 → cycle
  drop(4, 7); b.mood('wow');
  for (const [u, v] of [[3, 4], [2, 3], [2, 7]]) G.e(u, v).set(GC.hot, 2.2);
  say('下一條 (4, 7) = 18', '4–3–2–7 已經連通 → 會形成 cycle');
  await step(tok);                                   // 12:37 形成 cycle 就丟
  for (const [u, v] of [[3, 4], [2, 3], [2, 7]]) G.e(u, v).set(GC.tree, 2.2);
  G.e(4, 7).set(GC.dim, 0.5); b.mood('calm');
  say('形成 cycle 的邊：丟掉，不放進答案', '');
  await step(tok);                                   // 12:57 (4, 5) = 22
  pick(4, 5); say('(4, 5) = 22', '不會成 cycle → 選');
  await step(tok);                                   // 13:04 (5, 7) = 24 → cycle
  drop(5, 7); await anim(tok, 900, () => {}); G.e(5, 7).set(GC.dim, 0.5);
  say('(5, 7) = 24', '會形成 cycle → 丟掉');
  await step(tok);                                   // 13:09 (5, 6) = 25
  pick(5, 6); G.e(1, 2).set(GC.dim, 0.5);
  say('(5, 6) = 25', '選滿 6 條');
  await step(tok);                                   // 13:15 cost 99，和 Prim 一樣
  b.mood('happy'); await b.hop(tok);
  txt(row, 'Prim、Kruskal：同一個結果');
  say('cost = 99', '跟 Prim 的結果一樣');
}]);

// 13:32 Kruskal 的時間：每次找最小 Θ(E)，做 V − 1 次；用 min Heap 改成 log
FRAG.push(['galgo-kruskal-heap', 'Kruskal 的時間：用 min Heap 找最小邊', async (tok) => {
  fresh([0, 3.2, 13.5], [0, 2.4, 0]);
  const W = [28, 10, 16, 14, 12, 22, 18, 25, 24];
  let row = null, cur = null;
  await step(tok);                                   // 13:32 Kruskal 要花多少時間？
  row = W.map((w, i) => cube(w, '#efe3c8', [1.0, 0.6, 0.6], -5.6 + i * 1.4, 0.4, 0, 2.5));
  say('Kruskal 要花多少時間？', '9 條邊的 cost');
  await step(tok);                                   // 13:38 每次從 E 條邊找最小
  cur = tag('scan', 'pkt', -5.6, 1.3, 0);
  await anim(tok, 2200, (t) => { cur.position.x = -5.6 + t * 11.2; });
  glow(row[1], GOLD);
  say('每次都要從 E 條邊裡找最小的', '一個一個掃：Θ(E)');
  await step(tok);                                   // 13:48 要選 V − 1 次
  const nt = tag('要選 V − 1 次（7 個頂點 → 6 條）', 'note', 0, 2.6, 0);
  say('要選幾次？', 'V − 1 次');
  await step(tok);                                   // 14:08 Θ(V · E)
  txt(nt, '總時間 Θ(V · E)');
  say('總共 Θ(V · E)', 'V = 頂點數，E = 邊數');
  await step(tok);                                   // 14:24 都當成 n → n²
  txt(nt, '都當成 n → Θ(n²)');
  say('兩個都當成 n', 'Θ(n²)');
  await step(tok);                                   // 14:37 可以改進
  kill(nt);
  say('可以更快嗎？', '有一種資料結構，隨時給你最小值');
  await step(tok);                                   // 14:50 min Heap
  row.forEach((m) => kill(m)); kill(cur);
  const H = [10, 12, 14, 16, 18, 22, 24, 25, 28];
  const P = (i) => { const L = Math.floor(Math.log2(i + 1)), p = i - (2 ** L - 1); return [(p + 0.5) * (12 / 2 ** L) - 6, 5.4 - L * 1.4]; };
  const nodes = [];
  H.forEach((w, i) => { const [x, y] = P(i); const par = i ? nodes[(i - 1) >> 1] : null; nodes.push(K.tnode(w, x, y, 0, par, '#efe3c8')); });
  glow(nodes[0], GOLD);
  say('min Heap', 'root 永遠是最小值');
  await step(tok);                                   // 14:59 delete 就拿到下一個最小邊
  const [rx, ry] = P(0);
  const out = cube(10, '#e6c36a', [0.9, 0.9, 0.9], rx, ry, 0.6);
  fly(out, V3(4, 8, 2));
  kill(nodes[8].userData.edge); kill(nodes[8]); nodes.length = 8;
  relabel(nodes[0], 28);
  const A = [28, 12, 14, 16, 18, 22, 24, 25];
  let i = 0;
  for (;;) {
    const l = 2 * i + 1, r = l + 1;
    if (l >= A.length) break;
    const c = r < A.length && A[r] < A[l] ? r : l;
    if (A[c] >= A[i]) break;
    [A[i], A[c]] = [A[c], A[i]];
    await anim(tok, 500, () => {});
    relabel(nodes[i], A[i]); relabel(nodes[c], A[c]);
    i = c;
  }
  glow(nodes[0], GOLD);
  say('所有邊放進 min Heap', 'delete 一次 → 拿到最小的 10，下一個 12 浮上來');
  await step(tok);                                   // 15:10 delete 花 log n
  for (const k of [0, 1, 3, 7]) glow(nodes[k], GOLD);   // 28 剛才往下走的那條路
  say('每次 delete 只走一條樹高的路', 'O(log n)');
  await step(tok);                                   // 15:21 n 次 → n log n
  say('做 n 次（V − 1 次）', 'Kruskal：O(n log n)');
}]);

// 15:32 Kruskal 跑在不連通的圖：得到每一塊各自的 spanning tree
FRAG.push(['galgo-kruskal-forest', 'Kruskal 跑在不連通的圖上', async (tok) => {
  fresh([0, 10, 8.4], [0, 0, 0]);
  const G = gG({ 1: [-5.6, -1.6], 2: [-3, -2.2], 3: [-3, 1.6], 4: [-5.6, 2], 5: [0.4, -1.8], 6: [3.2, -2.6], 7: [5.6, -0.6], 8: [4.6, 2.4], 9: [1.2, 2] },
    [[1, 2], [2, 3], [3, 4], [4, 1], [5, 6], [6, 7], [7, 8], [8, 9], [9, 5], [6, 8]]);
  const b = gBud('小樹', -6.2, 3.8, '#f4a56a', 0.5);
  await step(tok);                                   // 15:32 兩塊：4 + 5 個頂點
  say('不連通的圖', '一塊 4 個頂點、一塊 5 個頂點');
  await step(tok);                                   // 15:43 沒有 spanning tree
  b.mood('sad');
  say('不連通 → 沒有 spanning tree', '');
  await step(tok);                                   // 15:52 Kruskal 想選 8 條
  b.mood('calm');
  const nt = tag('Kruskal 想選 9 − 1 = 8 條', 'note', 0, 0.3, -3.8);
  say('跑 Kruskal 會怎樣？', '它會想選 9 − 1 = 8 條邊');
  await step(tok);                                   // 16:08 兩塊輪流被選到
  const picks = [[1, 2], [5, 6], [2, 3], [7, 8], [9, 5], [3, 4], [6, 7]];
  await anim(tok, 2400, (u) => { picks.slice(0, Math.ceil(u * picks.length)).forEach(([x, y]) => G.e(x, y).set(GC.tree, 2.2)); });
  for (const [u, v] of [[4, 1], [8, 9], [6, 8]]) G.e(u, v).set(GC.dim, 0.6);
  txt(nt, '只選得到 3 + 4 = 7 條');
  say('從兩塊裡輪流選到最小的邊', '剩下的都會形成 cycle');
  await step(tok);                                   // 16:28 每一塊各自的 spanning tree
  b.mood('happy'); await b.hop(tok);
  txt(nt, '每一塊各自一棵：spanning forest');
  say('得到每一塊各自的 spanning tree', '不是整張圖的');
}]);

// 16:42 考題：缺權重的邊，最小可能是多少？
FRAG.push(['galgo-missing-w', '考題：沒被選的邊，權重至少多少', async (tok) => {
  fresh([0, 10, 8.4], [0, 0, 0]);
  const b = gBud('小樹', -5.8, 3.4);
  let G = null;
  await step(tok);                                   // 16:42 題目
  G = gG({ 1: [-5, -1.6], 2: [-2.2, -2.8], 3: [-2.6, 0.8], 4: [0.8, -0.8], 5: [1.4, 2.8], 6: [4.6, 0.4] },
    [[1, 2, 2], [1, 3, 3], [2, 3, 0, '?₁'], [3, 4, 4], [4, 6, 4], [4, 5, 5], [5, 6, 0, '?₂']]);
  for (const [u, v] of [[1, 2], [1, 3], [3, 4], [4, 6], [4, 5]]) G.e(u, v).set(GC.tree, 2);
  say('考題：兩條邊沒有權重', '有權重的 5 條剛好是 MST');
  await step(tok);                                   // 17:03 最小可能是多少？
  b.mood('wow');
  say('?₁、?₂ 最小可能是多少？', '');
  await step(tok);                                   // 17:12 先選 2、再選 3
  b.mood('calm');
  G.e(1, 2).set(GC.hot, 2.2); await anim(tok, 600, () => {}); G.e(1, 3).set(GC.hot, 2.2);
  say('用 Kruskal 想：2 被選、3 被選', '');
  await step(tok);                                   // 17:21 ?₁ 會形成 cycle
  G.e(2, 3).set(GC.bad, 2);
  say('?₁ 沒被選', '因為它會跟 2、3 形成 cycle');
  await step(tok);                                   // 17:31 排在 2、3 之後 → 4
  const n1 = tag('?₁ = 4', 'note', -2.4, 1.2, -1.0);
  say('它在 2、3 之後才輪到', 'Bari：?₁ 最小是 4');
  await step(tok);                                   // 17:41 比 4 小就會先被選
  say('如果比 4 小（例如 1）', '它會比 3 早被考慮 → 就會被選進去');
  await step(tok);                                   // 17:50 4、4、5 被選
  G.e(1, 2).set(GC.tree, 2); G.e(1, 3).set(GC.tree, 2);
  await anim(tok, 1500, (u) => { [[3, 4], [4, 6], [4, 5]].slice(0, Math.ceil(u * 3)).forEach(([x, y]) => G.e(x, y).set(GC.hot, 2.2)); });
  say('接著 4、4、5 都被選', '');
  await step(tok);                                   // 17:58 ?₂ 最後剩下 → 6
  G.e(5, 6).set(GC.bad, 2);
  tag('?₂ = 6', 'note', 3.0, 1.2, 1.6);
  b.mood('happy'); await b.hop(tok);
  say('?₂ 最後才被考慮、還形成 cycle', '比 5 大 → 最小是 6');
  await step(tok);                                   // 18:07 考試常見
  kill(n1);
  say('考試常見：懂 Kruskal 就能反推', '缺的權重：4 和 6');
}]);

// 18:16 MST 的 cost 唯一，但 MST 不一定唯一
FRAG.push(['galgo-two-msts', 'MST cost 唯一，但樹可以不只一棵', async (tok) => {
  fresh([0, 10, 8], [0, 0, 0]);
  const b = gBud('小樹', -5.6, 3.2);
  let G = null;
  const nt = tag('', 'ptr alt', 0, 0.3, -3.8);
  await step(tok);                                   // 18:16 再找一張圖的 MST
  G = gG({ A: [-3.6, -1.6], B: [0, -2.6], C: [3.6, -1.6], D: [-2, 2], E: [2, 2] }, [['A', 'B', 2], ['B', 'C', 3], ['A', 'D', 3], ['D', 'E', 4], ['C', 'E', 4]]);
  say('再用 Kruskal 找一張圖的 MST', '5 個頂點 → 4 條邊');
  await step(tok);                                   // 18:26 先選最小的 2
  G.e('A', 'B').set(GC.tree, 2.2);
  say('先選最小的 2', '');
  await step(tok);                                   // 18:31 兩條 3：任選
  G.e('B', 'C').set(GC.tree, 2.2);
  say('接著兩條 3：哪條先都可以', '先選 B–C');
  await step(tok);                                   // 18:37 另一條 3 也不成 cycle
  G.e('A', 'D').set(GC.tree, 2.2);
  say('另一條 3（A–D）', '不會形成 cycle → 也選');
  await step(tok);                                   // 18:41 兩條 4：任選一條
  G.e('D', 'E').set(GC.tree, 2.2); G.e('C', 'E').set(GC.dim, 0.6);
  say('兩條 4 也是任選一條', '選 D–E，不會形成 cycle');
  await step(tok);                                   // 18:51 4 條邊、5 個頂點
  b.mood('happy'); await b.hop(tok);
  say('5 個頂點、4 條邊', '得到一棵 spanning tree');
  await step(tok);                                   // 19:02 cost = 12
  txt(nt, 'cost = 2 + 3 + 3 + 4 = 12');
  say('cost = 2 + 3 + 3 + 4', '= 12');
  await step(tok);                                   // 19:14 最佳解只有一個？
  b.mood('wow');
  say('最小化問題只有一個最佳答案', '那 MST 也只有一棵嗎？（等一下更正）');
  await step(tok);                                   // 19:29 改選另一條 4
  G.e('D', 'E').set(GC.dim, 0.6); G.e('C', 'E').set(GC.tree, 2.2);
  say('不選 D–E，改選 C–E', '也是一棵 spanning tree');
  await step(tok);                                   // 19:44 cost 一樣是 12
  txt(nt, 'cost = 2 + 3 + 3 + 4 = 12（一樣）');
  b.mood('calm');
  say('cost 還是 12', '最佳的「值」只有一個');
  await step(tok);                                   // 20:00 兩棵 MST
  G.e('D', 'E').set(GC.tree, 1.6);
  txt(nt, 'MST 有 2 棵，最小 cost 都是 12');
  b.mood('happy'); await b.hop(tok);
  say('MST 可以有 2 棵', '但最小 cost 只有一個：12');
}]);
// ════════ wU6udHRIkcc：Abdul Bari〈Disjoint Sets〉（find、union、cycle 偵測、weighted union、collapsing find） ════════
const DPOS8 = { 1: [-5.4, -1.6], 2: [-2.8, -1.6], 3: [-5.4, 1.6], 4: [-2.8, 1.6], 5: [-0.2, -1.6], 6: [2.4, -1.6], 7: [-0.2, 1.6], 8: [2.4, 1.6] };
const DSE = [[1, 2], [3, 4], [5, 6], [7, 8], [2, 4], [2, 5], [1, 3], [6, 8], [5, 7]];
// 兩個 component 的集合框
function dsBoxes() {
  const b1 = ghostBox('#4b9ee2', 3.8, 0.9, 4.4); b1.position.set(-4.1, 0.3, 0);
  const b2 = ghostBox('#9b7ef4', 3.8, 0.9, 4.4); b2.position.set(1.1, 0.3, 0);
  return { b1, b2 };
}

// 01:12 兩個不相交的集合
FRAG.push(['galgo-ds-sets', 'Disjoint sets：S1 ∩ S2 = ∅', async (tok) => {
  fresh([0, 9.5, 8.6], [-0.8, 0, 0]);
  const bd = gBud('小集', 5.4, 2.6, '#9fd3a8');
  await step(tok);                                   // 1:12 不連通的無向圖：兩個 component
  const G = gG(DPOS8, [[1, 2], [3, 4], [2, 4], [5, 6], [7, 8], [6, 8]]);
  say('不連通、無向的圖', '兩個 component（兩塊）');
  await step(tok);                                   // 1:19 S1 = {1, 2, 3, 4}
  const B = dsBoxes(); B.b2.visible = false;
  tag('S1 = {1, 2, 3, 4}', 'ptr', -4.1, 0.3, -3);
  say('每個 component 當成一個集合', 'S1 = {1, 2, 3, 4}');
  await step(tok);                                   // 1:27 S2 = {5, 6, 7, 8}
  B.b2.visible = true;
  tag('S2 = {5, 6, 7, 8}', 'ptr', 1.1, 0.3, -3);
  say('第二塊', 'S2 = {5, 6, 7, 8}');
  await step(tok);                                   // 1:39 沒有共同的頂點
  for (const k of [1, 2, 3, 4, 5, 6, 7, 8]) glow(G.N[k], GOLD);
  bd.look(-1);
  say('沒有任何頂點同時在兩邊', '');
  await step(tok);                                   // 1:46 交集是空集合
  for (const k of [1, 2, 3, 4, 5, 6, 7, 8]) glow(G.N[k], null);
  tag('S1 ∩ S2 = ∅', 'note', -1.5, 1.6, 2.8);
  bd.mood('happy'); await bd.hop(tok);
  say('S1 ∩ S2 = ∅', '沒有共同元素 → disjoint');
}]);

// 02:00 find、union；edge (4, 8) → union；edge (1, 5) → 同集合 = cycle
FRAG.push(['galgo-ds-find-union', 'find 與 union：同一集合就有 cycle', async (tok) => {
  fresh([0, 9.5, 8.6], [-0.8, 0, 0]);
  const G = gG(DPOS8, [[1, 2], [3, 4], [2, 4], [5, 6], [7, 8], [6, 8]], { drop: 0 });
  const { b1, b2 } = dsBoxes();
  const t1 = tag('S1', 'ptr', -4.1, 0.3, -3), t2 = tag('S2', 'ptr', 1.1, 0.3, -3);
  const bd = gBud('小集', 5.4, 2.6, '#9fd3a8');
  const ask = async (v, s) => {
    const p = await gPkt(tok, 'find(' + v + ')', V3(5.4, 1.6, 2.6), gAt(G.N[v], 1.2), 800);
    txt(p, 'find(' + v + ') = ' + s); glow(G.N[v], GOLD); return p;
  };
  await step(tok);                                   // 2:00 兩種操作：find、union
  const op = tag('操作：find、union', 'say', 5.4, 1.7, 2.6);
  say('只做兩種操作', 'find 和 union');
  await step(tok);                                   // 2:15 find(5)
  kill(op);
  let p = await ask(5, 'S2');
  say('find(5)：5 在哪個集合？', 'find(5) = S2');
  await step(tok);                                   // 2:25 find = membership
  say('find 就是查「是哪個集合的成員」', 'set membership');
  await step(tok);                                   // 2:39 find(7)
  kill(p); glow(G.N[5], null);
  p = await ask(7, 'S2');
  say('find(7)', '= S2');
  await step(tok);                                   // 2:46 find(3)
  kill(p); glow(G.N[7], null);
  p = await ask(3, 'S1');
  say('find(3)', '= S1');
  await step(tok);                                   // 3:05 加一條邊 (4, 8)
  kill(p); glow(G.N[3], null);
  const e48 = gE(G.N[4], G.N[8], null); e48.set(GC.hot, 1.8);
  say('union：先加一條邊 (4, 8)', '');
  await step(tok);                                   // 3:25 find(4) = S1
  p = await ask(4, 'S1');
  say('find(4)', '= S1');
  await step(tok);                                   // 3:35 find(8) = S2
  const p8 = await ask(8, 'S2');
  say('find(8)', '= S2');
  await step(tok);                                   // 3:44 不同集合 → union
  kill(p); kill(p8); glow(G.N[4], null); glow(G.N[8], null);
  kill(b1); kill(b2); kill(t1); kill(t2);
  const b3 = ghostBox('#2fc092', 9, 0.9, 4.6); b3.position.set(-1.5, 0.3, 0);
  tag('S3 = S1 ∪ S2 = {1..8}', 'ptr', -1.5, 0.3, -3.1);
  e48.set(GC.tree, 2); bd.mood('happy'); await bd.hop(tok);
  say('兩個不同集合 → union', 'S1 ∪ S2 = {1, 2, …, 8}');
  await step(tok);                                   // 4:02 union 的目的
  const why = tag('邊 (u, v)：find(u) ≠ find(v) → union', 'note', -1.5, 1.6, 3.2);
  bd.mood('calm');
  say('union 的目的', '邊兩端在不同集合 → 合併');
  await step(tok);                                   // 4:19 再加 (1, 5)
  kill(why);
  const e15 = gE(G.N[1], G.N[5], null); e15.set(GC.hot, 1.8);
  say('再加一條邊 (1, 5)', '');
  await step(tok);                                   // 4:42 find(1)、find(5) 同集合
  glow(G.N[1], GOLD); glow(G.N[5], GOLD);
  say('find(1) = S3，find(5) = S3', '同一個集合');
  await step(tok);                                   // 4:53 → cycle
  e15.set(GC.bad, 2); bd.mood('wow');
  tag('同一集合 → 有 cycle！', 'bad', -2.8, 1.6, -1.6);
  say('兩端在同一集合 → 有 cycle', '這就是偵測 cycle 的方法');
}]);

// 05:25 從頭把 9 條邊依序加入：維護集合、偵測 cycle（就是 Kruskal）
FRAG.push(['galgo-ds-cycle-sets', '用集合偵測 cycle：9 條邊依序加入', async (tok) => {
  fresh([0.6, 10, 8.4], [0.6, 0, 0]);
  const bd = gBud('小集', 5.6, 3.4, '#9fd3a8', 0.5);
  let G = null;
  let sets = [], next = 1, rows = [], U = [1, 2, 3, 4, 5, 6, 7, 8];
  const draw = () => {
    rows.forEach(kill);
    rows = [tag('U = {' + U.join(',') + '}', 'idx', 5.4, 0.3, -3.2)].concat(sets.map((s, r) => tag('S' + s.id + ' = {' + s.m.join(',') + '}', 'ptr', 5.4, 0.3, -2.2 + r * 1.0)));
  };
  const where = (v) => sets.find((s) => s.m.includes(v));
  const nm = (s) => (s ? 'S' + s.id : 'U');
  const look = (i) => { const [u, v] = DSE[i]; for (const e of G.E) if (e.rod.scale.x < 1.9) e.set(GC.dim, 0.6); G.E[i].set(GC.hot, 1.8); glow(G.N[u], GOLD); glow(G.N[v], GOLD); };
  const unite = (i) => {
    const [u, v] = DSE[i], su = where(u), sv = where(v);
    const m = [...(su ? su.m : [u]), ...(sv ? sv.m : [v])].sort((a, b) => a - b);
    sets = sets.filter((s) => s !== su && s !== sv); U = U.filter((x) => x !== u && x !== v);
    sets.push({ id: next++, m }); draw(); G.E[i].set(GC.tree, 2); glow(G.N[u], null); glow(G.N[v], null);
    return 'union → S' + (next - 1) + ' = {' + m.join(',') + '}';
  };
  await step(tok);                                   // 5:25 一張例圖，從頭開始
  G = gG(DPOS8, DSE.map(([u, v], i) => [u, v, i + 1, '#' + (i + 1)]));
  say('一張例圖：從頭開始偵測 cycle', '邊一條一條加進來');
  await step(tok);                                   // 5:58 邊的編號 = 加入順序
  for (const e of G.E) { e.set(GC.dim, 0.6); if (e.lbl) gCls(e.lbl, 'note'); }
  say('邊上的編號 = 加入的順序', '像 Kruskal 由小到大');
  await step(tok);                                   // 6:11 universal set
  for (const e of G.E) if (e.lbl) gCls(e.lbl, '');
  draw();
  say('8 個頂點先放在 universal set', '每個元素自己算一個集合');
  await step(tok);                                   // 6:33 邊 1：(1, 2) find
  look(0);
  say('邊 1：(1, 2)', 'find(1)、find(2)：都在 U');
  await step(tok);                                   // 6:49 union → S1
  say('從 U 拿出來，union', unite(0)); await bd.hop(tok);
  await step(tok);                                   // 6:57 邊 2：(3, 4)
  look(1); say('邊 2：(3, 4) 都在 U', unite(1));
  await step(tok);                                   // 7:24 邊 3：(5, 6)
  look(2); say('邊 3：(5, 6) 都在 U', unite(2));
  await step(tok);                                   // 7:34 邊 4：(7, 8)
  look(3); say('邊 4：(7, 8) 都在 U', unite(3));
  await step(tok);                                   // 7:47 邊 5：(2, 4)
  look(4); say('邊 5：(2, 4)', 'find(2) = ' + nm(where(2)) + '，find(4) = ' + nm(where(4)));
  await step(tok);                                   // 8:07 不同集合 → union
  say('不同集合 → union', unite(4)); await bd.hop(tok);
  await step(tok);                                   // 8:28 邊 6：(2, 5)
  look(5); say('邊 6：(2, 5)', 'find(2) = ' + nm(where(2)) + '，find(5) = ' + nm(where(5)));
  await step(tok);                                   // 8:38 union → S6
  say('不同集合 → union', unite(5));
  await step(tok);                                   // 9:04 邊 7：(1, 3)
  look(6); say('邊 7：(1, 3)', 'find(1) = ' + nm(where(1)) + '，find(3) = ?');
  await step(tok);                                   // 9:21 同集合 → cycle
  G.E[6].set(GC.bad, 2); bd.mood('wow');
  say('find(3) 也是 ' + nm(where(3)), '同一個集合 → 有 cycle');
  await step(tok);                                   // 9:34 已選的邊＋這條 = 一圈
  for (const i of [0, 1, 4]) G.E[i].set(GC.hot, 2.2);
  say('1–2–4–3 已經連通', '再加 (1, 3) 就繞一圈 → 不加');
  await step(tok);                                   // 9:53 邊 8：(6, 8)
  for (const i of [0, 1, 4]) G.E[i].set(GC.tree, 2);
  G.E[6].set(GC.dim, 0.5); glow(G.N[1], null); glow(G.N[3], null); bd.mood('calm');
  look(7); say('邊 8：(6, 8)', 'find(6) = ' + nm(where(6)) + '，find(8) = ' + nm(where(8)));
  await step(tok);                                   // 10:09 union → S7
  say('不同集合 → union', unite(7));
  await step(tok);                                   // 10:26 邊 9：(5, 7)
  look(8); say('邊 9：(5, 7)', 'find(5)、find(7)');
  await step(tok);                                   // 10:37 都在 S7 → cycle
  G.E[8].set(GC.bad, 2); bd.mood('wow');
  say('都在 ' + nm(where(5)), '同一個集合 → cycle');
  await step(tok);                                   // 10:43 Kruskal 就是這樣做
  G.E[8].set(GC.dim, 0.5); glow(G.N[5], null); glow(G.N[7], null);
  bd.mood('happy'); await bd.hop(tok);
  say('Kruskal 就是這樣判斷要不要選', '同一集合 = 會形成 cycle');
}]);

// 森林畫法：par[v] < 0 → root（−size），否則 par[v] = parent
function gForest(par) {
  const ids = Object.keys(par).map(Number), ch = {};
  ids.forEach((v) => { ch[v] = ids.filter((c) => par[c] === v); });
  const width = (v) => Math.max(1, ch[v].reduce((s, c) => s + width(c), 0));
  const roots = ids.filter((v) => par[v] < 0), U = 1.35, pos = {};
  let left = -roots.reduce((s, r) => s + width(r), 0) * U / 2;
  const place = (v, l, d) => { const w = width(v) * U; pos[v] = [l + w / 2, 5.2 - d * 1.4]; let x = l; for (const c of ch[v]) { place(c, x, d + 1); x += width(c) * U; } };
  for (const r of roots) { place(r, left, 0); left += width(r) * U; }
  return pos;
}
function gForestDraw(F, par) {
  const pos = gForest(par);
  F.lines.forEach(kill); F.lines = [];
  for (const v of Object.keys(par).map(Number)) {
    const [x, y] = pos[v];
    move(F.N[v], x, y, 0);
    if (par[v] > 0) { const [px, py] = pos[par[v]]; F.lines.push(line(px, py - 0.4, x, y + 0.4, 0)); }
  }
}
function gForestNew(par) {
  const F = { N: {}, lines: [] }, pos = gForest(par);
  for (const v of Object.keys(par).map(Number)) { const [x, y] = pos[v]; F.N[v] = cube(v, '#4b9ee2', [0.8, 0.8, 0.8], x, y, 0, 2); }
  gForestDraw(F, par);
  return F;
}
// find 的小手：從 v 沿 parent 一格一格往上走（不改樹）
async function gClimb(tok, F, par, v, ms = 450) {
  const at = (k) => V3(F.N[k].position.x, F.N[k].position.y + 0.85, 0.5);
  const p = tag('find(' + v + ')', 'pkt', at(v).x, at(v).y, 0.5);
  glow(F.N[v], GOLD);
  let k = v;
  while (par[k] > 0) { const nx = par[k]; await travel(tok, p, at(k), at(nx), ms); glow(F.N[nx], GOLD); k = nx; }
  return { p, root: k };
}
const gUnglow = (F) => { for (const k of Object.keys(F.N)) glow(F.N[k], null); };

// 11:09 圖形表示：每個集合是一棵樹，root 當代表；weighted union
FRAG.push(['galgo-ds-trees', 'Disjoint set 畫成樹：root 是代表', async (tok) => {
  fresh([0, 3.6, 12.5], [0, 3.2, 0]);
  const par = { 1: -1, 2: -1, 3: -1, 4: -1, 5: -1, 6: -1, 7: -1, 8: -1 };
  const bd = gBud('小集', -6.2, 1.6, '#9fd3a8', 0.6);
  let F = null, p = null, q = null;
  const link = (c, r, size) => { par[c] = r; par[r] = -size; gForestDraw(F, par); };
  await step(tok);                                   // 11:09 用圖形表示集合
  F = gForestNew(par);
  say('用圖形表示集合', '8 個頂點，一開始各自一個');
  await step(tok);                                   // 11:55 不要集合名稱，只要一個代表
  const nt = tag('一個集合 = 一棵樹，root 當代表', 'note', 0, 6.4, 0);
  say('不需要集合名稱', '只要一個「代表」：樹的 root');
  await step(tok);                                   // 12:02 (1, 2)：1 當 parent
  link(2, 1, 2);
  say('(1, 2)：1 當 parent、2 當 child', '反過來也可以');
  await step(tok);                                   // 12:11 (3, 4)
  link(4, 3, 2);
  say('(3, 4)：3 當 parent', '');
  await step(tok);                                   // 12:26 (5, 6)、(7, 8)
  link(6, 5, 2); await K.anim(tok, 400, () => {}); link(8, 7, 2);
  say('(5, 6)、(7, 8) 一樣', '四個集合，各 2 個點');
  await step(tok);                                   // 12:42 (2, 4)：parent 是 1 和 3
  kill(nt);
  p = await gClimb(tok, F, par, 2); q = await gClimb(tok, F, par, 4);
  say('(2, 4)：2 的 parent 是 1，4 的 parent 是 3', '不同 root → 不同集合');
  await step(tok);                                   // 13:07 union：3 掛到 1 底下
  kill(p.p); kill(q.p); gUnglow(F);
  link(3, 1, 4); bd.mood('happy'); await bd.hop(tok);
  say('union：一棵的 root 掛到另一棵的 root 下面', '3 變成 1 的 child');
  await step(tok);                                   // 13:23 一樣大：誰當 parent 都可以
  bd.mood('calm');
  say('為什麼不選 3 當 parent？', '兩棵一樣大：誰都可以');
  await step(tok);                                   // 13:33 (2, 5)
  p = await gClimb(tok, F, par, 2); q = await gClimb(tok, F, par, 5);
  say('(2, 5)：root 是 1 和 5', '不同集合 → union');
  await step(tok);                                   // 14:03 誰當 parent？比點數
  kill(p.p); kill(q.p);
  const w1 = tag('4 個點', 'note', F.N[1].position.x, 6.5, 0), w5 = tag('2 個點', 'note', F.N[5].position.x, 6.5, 0);
  say('為什麼不選 5 當 parent？', 'root 1 有 4 個點，root 5 只有 2 個');
  await step(tok);                                   // 14:17 點多的當 parent：weighted union
  kill(w1); kill(w5); gUnglow(F);
  link(5, 1, 6); bd.mood('happy'); await bd.hop(tok);
  say('點多（weight 大）的當 parent', '5 掛到 1 → weighted union');
  await step(tok);                                   // 14:47 (1, 3)：同一個 root → cycle
  bd.mood('wow');
  p = await gClimb(tok, F, par, 1); q = await gClimb(tok, F, par, 3);
  tag('root 都是 1 → cycle', 'bad', 0, 6.4, 0);
  say('(1, 3)：parent 都是 1', '同一集合 → cycle');
}]);

// 15:18 用陣列：parent[]，負數 = root 且 |值| = 點數
FRAG.push(['galgo-ds-array', 'Disjoint set 的陣列：parent[ ]', async (tok) => {
  fresh([0, 3.4, 13.5], [0, 2.6, 0]);
  const par = { 1: -1, 2: -1, 3: -1, 4: -1, 5: -1, 6: -1, 7: -1, 8: -1 };
  let F = null; const cell = {};
  const bd = gBud('小集', -6.5, 1.8, '#9fd3a8', 0.5);
  const setc = (v, x) => { par[v] = x; relabel(cell[v], x); glow(cell[v], GOLD); };
  const clr = () => { for (let k = 1; k <= 8; k++) glow(cell[k], null); gUnglow(F); };
  // find 走一遍：樹上的小手＋陣列格子一起亮
  const find = async (v) => { const r = await gClimb(tok, F, par, v, 380); let k = v; glow(cell[k], GOLD); while (par[k] > 0) { k = par[k]; glow(cell[k], GOLD); } return r; };
  const pk = [];
  const unite = (small, big) => { const size = par[small] + par[big]; setc(small, big); setc(big, size); gForestDraw(F, par); };
  await step(tok);                                   // 15:18 圖形＋陣列一起看
  F = gForestNew(par);
  say('同一件事，改用陣列做', '上面是圖形，下面是陣列');
  await step(tok);                                   // 15:46 parent 陣列，全部 −1
  for (let v = 1; v <= 8; v++) { const x = -5.25 + (v - 1) * 1.5; cell[v] = cube(-1, '#efe3c8', [1.2, 0.6, 0.6], x, 0.3, 0, 2); tag(String(v), 'idx', x, -0.35, 0.4); }
  tag('parent', 'ptr', -6.6, 0.9, 0);
  say('一個陣列 parent：index = 頂點', '−1：自己就是一個集合');
  await step(tok);                                   // 16:16 (1, 2)：find 都是 −1，常數時間
  pk.push((await find(1)).p, (await find(2)).p);
  say('(1, 2)：parent[1] = −1、parent[2] = −1', '各自是 root，看一格就知道：常數時間');
  await step(tok);                                   // 16:44 union：parent[2] = 1
  pk.splice(0).forEach(kill); clr();
  par[2] = 1; relabel(cell[2], 1); glow(cell[2], GOLD); gForestDraw(F, par);
  say('union：1 當 parent', 'parent[2] = 1');
  await step(tok);                                   // 17:03 parent[1] = −2
  setc(1, -2); bd.mood('wow');
  say('root 不只寫 −1：寫 −(點數)', 'parent[1] = −2：負號 = root，2 = 兩個點');
  await step(tok);                                   // 17:22 (3, 4)
  clr(); bd.mood('calm'); unite(4, 3);
  say('(3, 4)：parent[4] = 3', 'parent[3] = −2');
  await step(tok);                                   // 17:47 (5, 6)
  clr(); unite(6, 5);
  say('(5, 6)：parent[6] = 5', 'parent[5] = −2');
  await step(tok);                                   // 17:57 (7, 8)
  clr(); unite(8, 7);
  say('(7, 8)：parent[8] = 7', 'parent[7] = −2');
  await step(tok);                                   // 18:14 (2, 4)：2 → 1、4 → 3
  clr();
  pk.push((await find(2)).p, (await find(4)).p);
  say('(2, 4)：find(2) = 1，find(4) = 3', 'root 不同 → union');
  await step(tok);                                   // 18:44 parent[3] = 1，parent[1] = −4
  pk.splice(0).forEach(kill); clr(); unite(3, 1);
  say('3 掛到 1：parent[3] = 1', 'parent[1] = −2 + (−2) = −4');
  await step(tok);                                   // 19:13 (2, 5)
  clr();
  pk.push((await find(2)).p, (await find(5)).p);
  say('(2, 5)：find(2) = 1（−4），find(5) = 5（−2）', '一步就到：當成常數時間');
  await step(tok);                                   // 19:48 點數多的當 parent
  pk.splice(0).forEach(kill); clr(); unite(5, 1);
  bd.mood('happy'); await bd.hop(tok);
  say('|−4| > |−2|：1 的 rank 大，當 parent', 'parent[5] = 1，parent[1] = −6');
  await step(tok);                                   // 20:37 (1, 3) → cycle
  clr(); bd.mood('wow');
  pk.push((await find(1)).p, (await find(3)).p);
  say('(1, 3)：root 都是 1', '同一集合 → cycle，不加');
  await step(tok);                                   // 21:36 (6, 8)：6 → 5 → 1、8 → 7
  pk.splice(0).forEach(kill); clr(); bd.mood('calm');
  pk.push((await find(6)).p, (await find(8)).p);
  say('(6, 8)：6 → 5 → 1，8 → 7', 'root 1 和 7');
  await step(tok);                                   // 22:01 parent[7] = 1，parent[1] = −8
  pk.splice(0).forEach(kill); clr(); unite(7, 1);
  say('1 的點數多（6 > 2）：parent[7] = 1', 'parent[1] = −8：8 個點都在一起');
  await step(tok);                                   // 22:27 (5, 7) → cycle
  clr(); bd.mood('wow');
  pk.push((await find(5)).p, (await find(7)).p);
  say('(5, 7)：root 都是 1 → cycle', '一個簡單的陣列就夠用了');
}]);

// 23:00 collapsing find：找到 root 後直接把自己掛到 root
FRAG.push(['galgo-ds-collapse', 'Collapsing find：找到 root 就直接掛上去', async (tok) => {
  fresh([0, 3.4, 13.5], [0, 2.6, 0]);
  const par = { 1: -8, 2: 1, 3: 1, 4: 3, 5: 1, 6: 5, 7: 1, 8: 7 };
  const F = gForestNew(par);
  const cell = {};
  for (let v = 1; v <= 8; v++) { const x = -5.25 + (v - 1) * 1.5; cell[v] = cube(par[v], '#efe3c8', [1.2, 0.6, 0.6], x, 0.3, 0, 2); tag(String(v), 'idx', x, -0.35, 0.4); }
  const bd = gBud('小集', -6.5, 1.8, '#9fd3a8', 0.5);
  const clr = () => { for (let v = 1; v <= 8; v++) { glow(F.N[v], null); glow(cell[v], null); } };
  let ps = [];
  const walk = async (v) => { const r = await gClimb(tok, F, par, v, 500); let k = v; glow(cell[k], GOLD); while (par[k] > 0) { k = par[k]; glow(cell[k], GOLD); } ps.push(r.p); return r; };
  const reset = () => { ps.forEach(kill); ps = []; clr(); };
  await step(tok);                                   // 23:00 weighted union
  const nt = tag('依點數（weight）合併 = weighted union', 'note', 0, 6.4, 0);
  say('剛才 union 時比點數（rank）', '這叫 weighted union');
  await step(tok);                                   // 23:14 collapsing find
  txt(nt, '再來一招：collapsing find');
  say('另一個技巧', 'collapsing find');
  await step(tok);                                   // 23:19 find(2)、find(3)：兩步
  kill(nt);
  await walk(2); await walk(3);
  say('find(2)、find(3)：一下就到 root', '只要兩步');
  await step(tok);                                   // 23:37 find(4)：4 → 3 → 1
  reset(); bd.mood('sad');
  await walk(4);
  say('find(4)：4 → 3 → 1', '要沿著 parent 一直往上走，比較久');
  await step(tok);                                   // 23:56 find(6)：6 → 5 → 1
  reset(); bd.mood('calm');
  await walk(6);
  say('find(6)：6 的 parent 是 5，5 的 parent 是 1', 'root 是 1');
  await step(tok);                                   // 24:12 直接把 6 掛到 1
  reset();
  par[6] = 1; relabel(cell[6], 1); glow(cell[6], GOLD); gForestDraw(F, par);
  bd.mood('happy'); await bd.hop(tok);
  say('找到了就直接改：parent[6] = 1', '6 直接掛到 root 底下');
  await step(tok);                                   // 24:30 下次 find(6) 一步到
  clr(); await walk(6);
  say('下次 find(6)：一步就到', '常數時間');
  await step(tok);                                   // 24:45 這叫 collapsing find
  reset();
  say('直接連到 root：collapsing find', '第一次多花一點，之後都快');
  await step(tok);                                   // 25:02 find(8)：8 → 7 → 1
  await walk(8);
  say('find(8)：8 → 7 → 1', '');
  await step(tok);                                   // 25:15 parent[8] = 1
  reset();
  par[8] = 1; relabel(cell[8], 1); glow(cell[8], GOLD); gForestDraw(F, par);
  await bd.hop(tok);
  say('一樣直接掛到 1', 'parent[8] = 1');
  await step(tok);                                   // 25:30 linked list 也可以
  clr();
  tag('linked list：node = 值 ＋ 指向 parent 的指標', 'note', 0, 6.4, 0);
  say('也可以用 linked list 實作', 'node 存值＋指向 parent 的指標');
}]);
  }

  // ═══ gpeng20.js ═══
  {
const { V3, fresh, tag, cube, move, kill, glow, tint, txt, relabel, showL, code, arrow, GOLD, GREEN, RED, GRAY } = K;
// ─── Wnpsh1O1OMo：交大彭文志 Lec20 Graph (3/4) ───
// 例子都取自講者投影片（洪逸／Horowitz 第 6 章的圖）：8 頂點 DFS/BFS 圖、7 頂點 MST 圖（cost 99）、
// 10 頂點 articulation point 圖（DFS 從 3 出發）、6 頂點 / Boston 8 城市 Dijkstra、7 頂點 Bellman-Ford、
// 3 頂點 Floyd、AOV 0..5（topological order 0 3 2 5 1 4）。
const T = ctx.THREE;
const PC = { node: '#cbbd9f', edge: '#a8987c', hot: '#e8b02a', tree: '#2f7fd0', ok: '#2fc092', bad: '#d64545', dim: '#e4dccb', pq: '#efe3c8' };
const SETC = ['#2fc092', '#4b9ee2', '#9b7ef4', '#e55a9b', '#dd8238', '#31aab0'];
const INFT = '∞';
function gp(spec, i) { return V3(spec.pos[i][0] + (spec.dx || 0), 0.3, spec.pos[i][1] + (spec.dz || 0)); }
// 圖：cube 頂點＋rod（無向）或 arrow（有向）邊，權重標在邊旁
function mkG(spec, opt = {}) {
  const sz = opt.size || 0.7;
  const nodes = spec.names.map((n, i) => { const p = gp(spec, i); return cube(n, opt.color || PC.node, [sz, 0.55, sz], p.x, 0.3, p.z, opt.drop === false ? 0 : 3); });
  const edges = (spec.edges || []).map(([u, v, w]) => {
    const a = gp(spec, u), b = gp(spec, v);
    const d = b.clone().sub(a).normalize(), perp = V3(-d.z, 0, d.x);
    const anti = spec.dir && spec.edges.some(([x, y]) => x === v && y === u);
    if (anti) { a.addScaledVector(perp, 0.18); b.addScaledVector(perp, 0.18); }
    const r = sz * 0.7;
    const obj = spec.dir ? arrow(a.clone().addScaledVector(d, r), b.clone().addScaledVector(d, -r), 0x9c8b70) : rod(a.clone().addScaledVector(d, r), b.clone().addScaledVector(d, -r), PC.edge, 0.05);
    let lbl = null;
    if (w !== undefined && w !== null && !opt.noW) { const m = a.clone().add(b).multiplyScalar(0.5).addScaledVector(perp, 0.32); lbl = tag(String(w), w < 0 ? 'ptr alt' : 'idx', m.x, 0.55, m.z); }
    return { u, v, w, obj, lbl };
  });
  const E = (u, v) => edges.find((e) => (e.u === u && e.v === v) || (!spec.dir && e.u === v && e.v === u));
  return { spec, nodes, edges, E };
}
function ecol(e, c, th) { if (!e) return; if (e.obj.setColor) e.obj.setColor(new T.Color(c)); else { e.obj.material.color.set(c); const s = th || 1; e.obj.scale.set(s, 1, s); } }
function evis(e, on) { e.obj.visible = on; if (e.lbl) showL(e.lbl, on); }
function above(spec, i, text, cls, dy = 0.95) { const p = gp(spec, i); return tag(text, cls || 'ptr', p.x, dy, p.z - 0.55); }
function dash(pts, color = '#c0392b') {
  const l = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineDashedMaterial({ color, dashSize: 0.22, gapSize: 0.14 }));
  l.computeLineDistances(); ctx.lab.world.add(l); return l;
}

// ───────── 8 頂點圖（DFS / BFS） ─────────
const G8 = { names: ['0', '1', '2', '3', '4', '5', '6', '7'], pos: [[0, -3], [-2.4, -1.3], [2.4, -1.3], [-3.6, 0.8], [-1.2, 0.8], [1.2, 0.8], [3.6, 0.8], [0, 3]],
  edges: [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6], [3, 7], [4, 7], [5, 7], [6, 7]], dx: -2.3 };

// 00:00 DFS 用 visited[]＋遞迴；BFS level by level 用 queue
FRAG.push(['gpeng20-dfs-bfs-recap', 'DFS：visited[]＋遞迴；BFS：queue', async (tok) => {
  fresh([0, 9.5, 9.5], [0, 0, 0.2]);
  const g = mkG(G8, { noW: true });
  const vis = G8.names.map((n, i) => cube(0, GRAY, [0.5, 0.35, 0.5], 2.5 + i * 0.6, 0.2, -2.8));
  G8.names.forEach((n, i) => tag(n, 'idx', 2.5 + i * 0.6, 0.2, -3.5));
  tag('visited[]', 'idx', 4.6, 0.3, -2.0);
  const out = tag('DFS：', 'ptr', 4.6, 0.4, 2.6);
  say('DFS：visited[] 記錄哪些點拜訪過', 'dfs(v)：visit v，對 adj(v) 中未拜訪的 w 遞迴 dfs(w)');
  await beat(tok, 2800);
  const cur = above(G8, 0, 'dfs', 'ptr alt', 1.4);
  const order = [[0, -1], [1, 0], [3, 1], [7, 3], [4, 7], [5, 7], [2, 5], [6, 2]];
  const seq = [];
  for (const [v, p] of order) {
    const q = gp(G8, v); cur.position.set(q.x, 1.4, q.z - 0.55);
    tint(g.nodes[v], PC.ok); relabel(vis[v], 1); tint(vis[v], PC.ok);
    if (p >= 0) ecol(g.E(p, v), PC.tree, 2);
    seq.push(v); txt(out, 'DFS：' + seq.join(' '));
    say(p < 0 ? '從 0 出發：印出、標記' : '走到 ' + v + '：沒拜訪過 → visit', 'visited[' + v + '] = 1');
    await beat(tok, 1100);
  }
  say('全部拜訪過 → 一路 return', 'DFS 順序：0 1 3 7 4 5 2 6');
  await beat(tok, 2400);
  kill(cur);
  g.nodes.forEach((m) => tint(m, PC.node)); g.edges.forEach((e) => ecol(e, PC.edge, 1)); vis.forEach((c) => { relabel(c, 0); tint(c, GRAY); });
  const out2 = tag('BFS：', 'ptr', 4.6, 0.4, 3.4);
  say('BFS：level by level，用 queue', '取出 queue 前端，把它沒拜訪的鄰居放到尾端');
  await beat(tok, 2400);
  const ADJ = [[1, 2], [0, 3, 4], [0, 5, 6], [1, 7], [1, 7], [2, 7], [2, 7], [3, 4, 5, 6]];
  let qcubes = [];
  const lay = () => qcubes.forEach(([c], k) => move(c, 2.6 + k * 0.85, 0.3, 0.6));
  const push = (v) => { const c = cube(v, '#efe3c8', [0.6, 0.45, 0.6], 2.6 + qcubes.length * 0.85, 0.3, 0.6, 2.5); qcubes.push([c, v]); };
  tag('queue', 'idx', 2.0, 0.3, 0.6);
  const seen = new Set([0]); const bseq = [];
  push(0); tint(g.nodes[0], PC.hot);
  await beat(tok, 900);
  while (qcubes.length) {
    const [c, v] = qcubes.shift(); kill(c); lay();
    tint(g.nodes[v], PC.ok); bseq.push(v); txt(out2, 'BFS：' + bseq.join(' '));
    for (const w of ADJ[v]) if (!seen.has(w)) { seen.add(w); push(w); tint(g.nodes[w], PC.hot); ecol(g.E(v, w), PC.tree, 2); }
    say('取出 ' + v + '，鄰居進 queue', 'queue：' + (qcubes.map(([, x]) => x).join(' ') || '空'));
    await beat(tok, 1000);
  }
  say('BFS 順序：一層一層', '0 │ 1 2 │ 3 4 5 6 │ 7');
  await beat(tok, 2800);
}]);

// 01:45 network = edge 有 weight 的 graph；connected component ≈ community
FRAG.push(['gpeng20-network-community', 'Social network：connected component 就是社群', async (tok) => {
  fresh([0, 9, 9.5], [0, 0, 0]);
  const S = { names: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], pos: [[-5, -1.6], [-2.6, -2.4], [-3.4, 0.6], [-5.4, 2.0], [2.4, -1.8], [4.8, -0.6], [3.0, 1.8]],
    edges: [[0, 1, 5], [0, 2, 12], [1, 2, 3], [2, 3, 7], [4, 5, 2], [4, 6, 9], [5, 6, 4]] };
  say('Line 用戶 = vertex', '傳訊息 / 打電話 = edge');
  const g = mkG(S, { noW: true });
  await beat(tok, 2600);
  S.edges.forEach(([u, v, w], k) => { const a = gp(S, u), b = gp(S, v); g.edges[k].lbl = tag(String(w), 'idx', (a.x + b.x) / 2, 0.55, (a.z + b.z) / 2 + 0.3); });
  say('edge 上有 weight（傳了幾次）', 'graph ＋ edge weight = network（數字為示意）');
  await beat(tok, 3000);
  [0, 1, 2, 3].forEach((i) => tint(g.nodes[i], SETC[0])); g.edges.slice(0, 4).forEach((e) => ecol(e, SETC[0], 1.6));
  [4, 5, 6].forEach((i) => tint(g.nodes[i], SETC[1])); g.edges.slice(4).forEach((e) => ecol(e, SETC[1], 1.6));
  tag('community 1', 'ptr', -4.0, 1.3, -3.4); tag('community 2', 'ptr', 3.6, 1.3, -3.2);
  say('彼此連得到的一群 = connected component', 'social network 裡叫 community（社群）');
  await beat(tok, 3400);
  glow(g.nodes[2], GOLD); above(S, 2, 'leader', 'ptr alt', 1.3);
  say('C 連最多、最重的邊 → 這群的 leader', '找誰是 seed、誰有影響力');
  await beat(tok, 3000);
  for (const i of [0, 1, 3]) { glow(g.nodes[i], '#3a2a00'); await beat(tok, 600); }
  say('從 seed 往外擴散 → social influence', '社群行銷：先找有影響力的人');
  await beat(tok, 3000);
}]);

// 06:37 PageRank：網頁 = vertex、hyperlink = edge，random walk 停留越久越重要
FRAG.push(['gpeng20-pagerank-walk', 'PageRank：在網頁 graph 上 random walk', async (tok) => {
  fresh([0, 9, 9], [0, 0, 0]);
  const S = { names: ['P1', 'P2', 'P3', 'P4'], pos: [[-3.4, -2.2], [2.6, -2.4], [0, 1.6], [-4.4, 2.6]], edges: [[0, 1], [0, 2], [1, 2], [2, 0], [3, 2]], dir: true };
  const g = mkG(S, { noW: true, size: 0.9 });
  say('一個網頁 = 一個 vertex', 'hyperlink <a href> = 有向 edge');
  await beat(tok, 3000);
  const cnt = [0, 0, 0, 0];
  const tags = S.names.map((n, i) => above(S, i, '0 次', 'idx', 1.2));
  const walker = cube('', '#e8b02a', [0.35, 0.35, 0.35], gp(S, 3).x, 1.0, gp(S, 3).z);
  say('人瀏覽網頁 = 在 graph 上 random walk', '每一步沿一條 hyperlink 走');
  await beat(tok, 2200);
  const path = [3, 2, 0, 1, 2, 0, 2, 0, 1, 2];
  for (const v of path) {
    const p = gp(S, v); move(walker, p.x, 1.0, p.z);
    cnt[v]++; txt(tags[v], cnt[v] + ' 次'); glow(g.nodes[v], GOLD);
    await beat(tok, 750); glow(g.nodes[v], null);
  }
  glow(g.nodes[2], GOLD); tint(g.nodes[2], PC.ok);
  say('P3 被走到最多 → 最重要', '停留機率高 = PageRank 高（走法為示意）');
  await beat(tok, 3400);
}]);

// 08:17 spanning tree：V(G') = V(G)、用最少 n − 1 條邊連起來
FRAG.push(['gpeng20-k4-spanning', 'Spanning tree：完全圖 K4 的三棵 spanning tree', async (tok) => {
  fresh([0, 9, 9], [0, 0, 0]);
  const sq = (dx, s) => ({ names: ['0', '1', '2', '3'], pos: [[-s, -s], [s, -s], [-s, s], [s, s]], dx });
  const K4 = sq(-4.4, 1.4); K4.edges = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
  const g = mkG(K4, { noW: true });
  tag('G（complete graph）', 'ptr', -4.4, 0.6, -2.8);
  say('原來的 graph G：4 個頂點兩兩相連', '|V| = 4，|E| = 6');
  await beat(tok, 3000);
  const trees = [[[0, 1], [1, 3], [3, 2]], [[0, 1], [0, 2], [0, 3]], [[0, 2], [2, 1], [1, 3]]];
  for (let t = 0; t < 3; t++) {
    const S = sq(-0.3 + t * 2.9, 0.9); S.edges = trees[t];
    const h = mkG(S, { noW: true, size: 0.5 });
    h.edges.forEach((e) => ecol(e, PC.tree, 1.6));
    tag('G′' + (t + 1), 'idx', -0.3 + t * 2.9, 0.4, -1.8);
    say('spanning tree：頂點跟 G 一樣', 'V(G′) = V(G)，E(G′) ⊆ E(G)');
    await beat(tok, 2200);
  }
  say('用最少的邊把所有頂點連起來', 'n 個頂點 → n − 1 = 3 條邊，沒有 cycle');
  await beat(tok, 3200);
  say('edge 有 weight：總和最小的那棵', '= minimum cost spanning tree（MCST）');
  await beat(tok, 3000);
}]);

// 11:15 DFS / BFS spanning tree（從 0 出發）
FRAG.push(['gpeng20-dfs-bfs-tree', 'DFS／BFS spanning tree', async (tok) => {
  fresh([0, 9.5, 9.5], [0, 0, 0.2]);
  const g = mkG(G8, { noW: true });
  say('DFS 從 0 出發：照拜訪順序連邊', '長出來的就是 DFS spanning tree');
  await beat(tok, 2600);
  tint(g.nodes[0], PC.ok);
  const steps = [[0, 1], [1, 3], [3, 7], [7, 4], [7, 5], [5, 2], [2, 6]];
  for (const [p, v] of steps) {
    ecol(g.E(p, v), PC.tree, 2.2); tint(g.nodes[v], PC.ok);
    say(p + ' → ' + v + '：連起來', 'tree edge (' + p + ', ' + v + ')');
    await beat(tok, 1100);
    if (v === 4) {
      ecol(g.E(1, 4), PC.bad, 2);
      say('4 要不要連 1？不行', '1 已拜訪過，連了會形成 cycle');
      await beat(tok, 2200);
      ecol(g.E(1, 4), PC.dim, 0.6);
    }
  }
  [[0, 2], [6, 7]].forEach(([a, b]) => ecol(g.E(a, b), PC.dim, 0.6));
  say('DFS spanning tree 完成', '7 條 tree edge = n − 1');
  await beat(tok, 2400);
  g.nodes.forEach((m) => tint(m, PC.node)); g.edges.forEach((e) => ecol(e, PC.edge, 1));
  say('BFS：level by level，更像一棵樹', '');
  await beat(tok, 1600);
  tint(g.nodes[0], PC.ok);
  const lv = [[[0, 1], [0, 2]], [[1, 3], [1, 4], [2, 5], [2, 6]], [[3, 7]]];
  for (const L of lv) {
    L.forEach(([p, v]) => { ecol(g.E(p, v), PC.tree, 2.2); tint(g.nodes[v], PC.ok); });
    say('下一層：' + L.map(([, v]) => v).join('、'), L.map(([p, v]) => '(' + p + ',' + v + ')').join(' '));
    await beat(tok, 1500);
  }
  [[4, 7], [5, 7], [6, 7]].forEach(([a, b]) => ecol(g.E(a, b), PC.dim, 0.6));
  say('DFS、BFS、起點不同 → 樹不同', 'spanning tree 不是唯一的');
  await beat(tok, 3000);
}]);

// ───────── 7 頂點 MST 圖（Horowitz：cost 99） ─────────
const GM = { names: ['0', '1', '2', '3', '4', '5', '6'], pos: [[0, -3.1], [2.9, -1.6], [2.5, 1.7], [0, 3.0], [-2.5, 1.7], [-2.9, -1.6], [0, 0]],
  edges: [[0, 1, 28], [0, 5, 10], [1, 2, 16], [1, 6, 14], [2, 3, 12], [3, 4, 22], [3, 6, 18], [4, 5, 25], [4, 6, 24]], dx: -2.4 };

// 13:50 Kruskal：邊排序，一次選最小，形成 cycle 就跳過
FRAG.push(['gpeng20-kruskal', 'Kruskal：邊由小到大，有 cycle 就跳過', async (tok) => {
  fresh([0, 9.5, 9.5], [0.4, 0, 0.2]);
  const g = mkG(GM);
  const sorted = [...GM.edges].sort((a, b) => a[2] - b[2]);
  const L = (e, m) => (e[2] + ' (' + e[0] + ',' + e[1] + ')' + (m || '')).padEnd(18, ' ');
  const panel = code(['依 cost 排序', ...sorted.map((e) => L(e))], 4.2, 3.6, 0.5, -1.2);
  say('MCST：edge cost 總和最小的 spanning tree', 'Kruskal：greedy，每次選最小的邊');
  await beat(tok, 3000);
  const par = [0, 1, 2, 3, 4, 5, 6]; const f = (x) => (par[x] === x ? x : (par[x] = f(par[x])));
  const recolor = () => g.nodes.forEach((m, v) => tint(m, SETC[f(v) % SETC.length]));
  recolor();
  let n = 0, cost = 0;
  for (let k = 0; k < sorted.length && n < 6; k++) {
    const [u, v, w] = sorted[k], e = g.E(u, v);
    panel.hl(k + 1); ecol(e, PC.hot, 2);
    if (f(u) === f(v)) {
      ecol(e, PC.bad, 2); txt(panel.ls[k + 1], L(sorted[k], ' ✗ cycle'));
      say(w + '：' + u + '、' + v + ' 已連通 → 跳過', '加進來會形成 cycle');
      await beat(tok, 2200); ecol(e, PC.dim, 0.6);
    } else {
      par[f(v)] = f(u); recolor(); ecol(e, PC.tree, 2.4); n++; cost += w;
      txt(panel.ls[k + 1], L(sorted[k], ' ✓'));
      say('選 ' + w + '：(' + u + ', ' + v + ')', '已選 ' + n + ' 條，cost = ' + cost);
      await beat(tok, 1700);
    }
  }
  panel.hl(-1);
  say('選滿 n − 1 = 6 條，全部連通 → 停', 'MCST cost = 10+12+14+16+22+25 = 99');
  await beat(tok, 3200);
}]);

// 18:16 Prim：從最小邊 10 開始，tree 往外長，每次選往外最小的邊
const PRIM_STEPS = [[[0, 5]], [[0, 1], [5, 4]], [[0, 1], [4, 6], [4, 3]], [[0, 1], [4, 6], [3, 6], [3, 2]], [[0, 1], [4, 6], [3, 6], [2, 1]], [[4, 6], [3, 6], [1, 6]]];
const PRIM_PICK = [[0, 5], [5, 4], [4, 3], [3, 2], [2, 1], [1, 6]];
FRAG.push(['gpeng20-prim', 'Prim：一棵 tree 慢慢往外長', async (tok) => {
  fresh([0, 9.5, 9.5], [-1.2, 0, 0.2]);
  const g = mkG(GM);
  say('Prim：以頂點的角度，一棵 tree 往外長', '先選最小的邊 10 = (0, 5)');
  await beat(tok, 2800);
  const inT = new Set(); let cost = 0;
  const info = tag('', 'ptr', 2.6, 0.4, 3.6);
  for (let s = 0; s < PRIM_PICK.length; s++) {
    const cand = s === 0 ? [] : PRIM_STEPS[s];
    cand.forEach(([a, b]) => ecol(g.E(a, b), PC.hot, 1.6));
    if (cand.length) {
      say('往外的邊：' + cand.map(([a, b]) => g.E(a, b).w).join('、'), '選最小的 ' + g.E(...PRIM_PICK[s]).w);
      await beat(tok, 1900);
    }
    cand.forEach(([a, b]) => ecol(g.E(a, b), PC.edge, 1));
    const [a, b] = PRIM_PICK[s], e = g.E(a, b);
    ecol(e, PC.tree, 2.4); [a, b].forEach((v) => { inT.add(v); tint(g.nodes[v], PC.ok); });
    cost += e.w;
    txt(info, 'tree：{' + [...inT].join(',') + '}');
    say('加入 ' + (s === 0 ? '0、5' : b) + '，cost = ' + cost, s === 0 ? 'tree = {0, 5}' : '從新的頂點再往外看');
    await beat(tok, 1500);
  }
  say('所有頂點都進來了', 'cost = 10+25+22+12+16+14 = 99，跟 Kruskal 一樣');
  await beat(tok, 3200);
}]);

// 21:44 Prim 的 data structure：min priority queue（heap），取出後還要檢查 loop
FRAG.push(['gpeng20-prim-pq', 'Prim 用 min priority queue，取出還要檢查 loop', async (tok) => {
  fresh([0, 9.5, 9.5], [-0.4, 0, 0]);
  const g = mkG(GM);
  tag('min priority queue', 'idx', 4.4, 0.4, -3.4);
  say('tree 長出去的邊放進哪裡？', 'min priority queue（heap），不用每次排序');
  await beat(tok, 2800);
  const pq = []; const inT = new Set([0, 5]);
  [0, 5].forEach((v) => tint(g.nodes[v], PC.ok)); ecol(g.E(0, 5), PC.tree, 2.4);
  const lay = () => { pq.sort((a, b) => a.w - b.w); pq.forEach((it, k) => { move(it.c, 3.9, 0.25, -2.5 + k * 0.95); it.l.position.set(5.3, 0.3, -2.5 + k * 0.95); }); };
  const push = (u, v) => { const e = g.E(u, v); const it = { w: e.w, u, v, c: cube(e.w, PC.pq, [1.0, 0.45, 0.7], 3.9, 0.25, -2.5 + pq.length * 0.95, 3), l: tag('(' + u + ',' + v + ')', 'idx', 5.3, 0.3, -2.5 + pq.length * 0.95) }; pq.push(it); ecol(e, PC.hot, 1.4); };
  const PUSH = [[[0, 1], [5, 4]], [[4, 3], [4, 6]], [[3, 2], [3, 6]], [[2, 1]], [[1, 6]], []];
  for (let s = 0; s < PUSH.length; s++) {
    PUSH[s].forEach(([u, v]) => push(u, v)); lay();
    if (PUSH[s].length) { say('新頂點的邊 insert 進 queue', 'queue：' + pq.map((x) => x.w).join(', ')); await beat(tok, 1700); }
    if (s === PUSH.length - 1) break;
    const it = pq.shift(); kill(it.c); kill(it.l); lay();
    const nv = inT.has(it.u) ? it.v : it.u; inT.add(nv);
    ecol(g.E(it.u, it.v), PC.tree, 2.4); tint(g.nodes[nv], PC.ok);
    say('delete-min：' + it.w + ' (' + it.u + ',' + it.v + ')', '加入頂點 ' + nv);
    await beat(tok, 1500);
  }
  const it = pq[0]; glow(it.c, RED); ecol(g.E(it.u, it.v), PC.bad, 2);
  say('若再取出 18 (3,6)：兩端都在 tree', '會構成 loop → 丟掉；取出後一定要檢查');
  await beat(tok, 3400);
}]);

// 24:12 Sollin：每個頂點同時選自己最小的邊，再把各棵 tree 用最小邊接起來
FRAG.push(['gpeng20-sollin', 'Sollin：每個頂點一次選最小邊', async (tok) => {
  fresh([0, 9.5, 9.5], [-1.2, 0, 0.2]);
  const g = mkG(GM);
  say('Sollin：一次可以選很多條邊', '第 1 回合：每個頂點選自己最小的邊');
  await beat(tok, 2800);
  const MIN = [[0, 5], [1, 6], [2, 3], [3, 2], [4, 3], [5, 0], [6, 1]];
  for (const [v, w] of MIN) {
    const e = g.E(v, w); glow(g.nodes[v], GOLD); ecol(e, PC.hot, 2);
    say('頂點 ' + v + ' 最小的邊：' + e.w, '(' + v + ', ' + w + ')');
    await beat(tok, 1100);
    glow(g.nodes[v], null); ecol(e, PC.tree, 2.4);
  }
  const comps = [[0, 5], [1, 6], [2, 3, 4]];
  comps.forEach((c, k) => c.forEach((v) => tint(g.nodes[v], SETC[k])));
  say('第 1 回合後：三棵 tree', '{0,5}　{1,6}　{2,3,4}');
  await beat(tok, 2600);
  const st2 = [[[0, 5], [5, 4], 25, '28、25'], [[1, 6], [1, 2], 16, '16、18、24、28'], [[2, 3, 4], [1, 2], 16, '16、18、24、25']];
  for (const [c, [a, b], w, list] of st2) {
    c.forEach((v) => glow(g.nodes[v], GOLD));
    ecol(g.E(a, b), PC.hot, 2);
    say('{' + c.join(',') + '} 往外最小：' + w, '候選 ' + list);
    await beat(tok, 1900);
    c.forEach((v) => glow(g.nodes[v], null)); ecol(g.E(a, b), PC.tree, 2.4);
  }
  g.nodes.forEach((m) => tint(m, PC.ok));
  say('第 2 回合選 16、25 → 全部連通', 'cost = 10+14+12+22+16+25 = 99');
  await beat(tok, 3200);
}]);

// 29:00 三個 greedy 演算法比較；相同 weight 的邊 → MCST 可能不一樣
FRAG.push(['gpeng20-mst-compare', 'Kruskal／Prim／Sollin 比較；相同 weight 時樹可能不同', async (tok) => {
  fresh([0, 9.5, 9.5], [0.4, 0, 0.2]);
  const g = mkG(GM);
  [[0, 5], [2, 3], [1, 6], [1, 2], [3, 4], [4, 5]].forEach(([a, b]) => ecol(g.E(a, b), PC.tree, 2.4));
  const p = code(['Kruskal：10 12 14 16 22 25', 'Prim   ：10 25 22 12 16 14', 'Sollin ：10 14 12 22 │ 16 25'], 3.8, 2.6, 0.6, -1.4);
  say('三個演算法，這個例子結果一樣', 'cost 都是 99');
  for (let i = 0; i < 3; i++) { p.hl(i); await beat(tok, 1600); }
  p.hl(-1);
  say('Kruskal 看邊；Prim 看頂點往外長', 'Sollin：每個頂點選邊，再把 tree 合併');
  await beat(tok, 3000);
  fresh([0, 9, 9], [0, 0, 0]);
  const TRI = { names: ['a', 'b', 'c'], pos: [[0, -2.4], [-2.4, 1.6], [2.4, 1.6]], edges: [[0, 1, 10], [0, 2, 10], [1, 2, 10]], dx: -2.8 };
  const h = mkG(TRI);
  say('如果有好幾條相同 weight 的邊…', '三條邊 cost 都是 10（示意）');
  await beat(tok, 2400);
  const opts = [[[0, 1], [0, 2]], [[0, 1], [1, 2]], [[0, 2], [1, 2]]];
  for (const o of opts) {
    h.edges.forEach((e) => ecol(e, PC.dim, 0.7)); o.forEach(([a, b]) => ecol(h.E(a, b), PC.tree, 2.4));
    say('選法不同 → 樹不同', o.map(([a, b]) => '(' + TRI.names[a] + ',' + TRI.names[b] + ')').join(' ') + '，cost = 20');
    await beat(tok, 1700);
  }
  tag('MCST 不唯一，cost 一樣', 'ptr alt', 3.0, 0.6, 0);
  say('考試答案長得不一樣不一定錯', 'MCST 可以不唯一，但最小 cost 一定相同');
  await beat(tok, 3200);
}]);

// ───────── 10 頂點 articulation point 圖（Horowitz） ─────────
const GAP = { names: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
  pos: [[-5.6, -2.2], [-4.2, -0.6], [-4.4, 1.9], [-2.0, -0.6], [-2.2, 1.9], [0.4, -0.6], [1.8, 1.7], [2.8, -0.6], [5.0, -1.9], [5.0, 0.9]],
  edges: [[0, 1], [1, 2], [1, 3], [2, 4], [3, 4], [3, 5], [5, 6], [5, 7], [6, 7], [7, 8], [7, 9]], dx: 0.3 };
const AP_ADJ = (() => { const a = GAP.names.map(() => []); GAP.edges.forEach(([u, v]) => { a[u].push(v); a[v].push(u); }); return a; })();
function compsWithout(x) {
  const id = Array(10).fill(-1); let c = 0;
  for (let s = 0; s < 10; s++) {
    if (s === x || id[s] >= 0) continue;
    const st = [s]; id[s] = c;
    while (st.length) { const u = st.pop(); for (const w of AP_ADJ[u]) if (w !== x && id[w] < 0) { id[w] = c; st.push(w); } }
    c++;
  }
  return id;
}

// 31:00 articulation point：拿掉後圖變成 ≥ 2 個 connected component
FRAG.push(['gpeng20-articulation', 'Articulation point：拿掉就斷線的點', async (tok) => {
  fresh([0, 9, 9.5], [0, 0, 0]);
  const g = mkG(GAP, { noW: true });
  say('connected graph：任兩點都連得到', 'articulation point：拿掉它 → 至少 2 個 component');
  await beat(tok, 3000);
  for (const x of [1, 3]) {
    const p = gp(GAP, x);
    move(g.nodes[x], p.x, 2.2, p.z); tint(g.nodes[x], PC.bad);
    g.edges.forEach((e) => { if (e.u === x || e.v === x) evis(e, false); });
    const id = compsWithout(x);
    id.forEach((c, v) => { if (v !== x) tint(g.nodes[v], SETC[c]); });
    say('拿掉 ' + x + '：圖斷成兩塊', x === 1 ? '{0} 和 {2,3,…,9}' : '{0,1,2,4} 和 {5,6,7,8,9}');
    await beat(tok, 3000);
    move(g.nodes[x], p.x, 0.3, p.z);
    g.edges.forEach((e) => evis(e, true)); g.nodes.forEach((m) => tint(m, PC.node));
    await beat(tok, 900);
  }
  for (const x of [1, 3, 5, 7]) { tint(g.nodes[x], PC.bad); above(GAP, x, 'AP', 'ptr alt', 1.1); await beat(tok, 500); }
  say('articulation point：1、3、5、7', '像學校網路的 router：一壞就斷線');
  await beat(tok, 3400);
}]);

// 34:40 biconnected graph、maximal biconnected component（共 6 個）、共用的點就是 AP
const BCC = [[[0, 1]], [[1, 2], [1, 3], [2, 4], [3, 4]], [[3, 5]], [[5, 6], [5, 7], [6, 7]], [[7, 8]], [[7, 9]]];
FRAG.push(['gpeng20-bicomponents', 'Biconnected components：6 塊，共用點是 AP', async (tok) => {
  fresh([0, 9, 9.5], [0, 0, 0]);
  const g = mkG(GAP, { noW: true });
  say('biconnected：沒有任何 articulation point', 'maximal：不被更大的 biconnected subgraph 包含');
  await beat(tok, 3200);
  for (let k = 0; k < BCC.length; k++) {
    const vs = new Set(); BCC[k].forEach(([a, b]) => { ecol(g.E(a, b), SETC[k], 2.4); vs.add(a); vs.add(b); });
    const c = [...vs].map((v) => gp(GAP, v)).reduce((s, p) => s.add(p), V3(0, 0, 0)).multiplyScalar(1 / vs.size);
    tag('B' + (k + 1), 'ptr', c.x, 0.9, c.z + 0.7);
    say('第 ' + (k + 1) + ' 個 biconnected component', '{' + [...vs].sort((a, b) => a - b).join(',') + '}');
    await beat(tok, 1300);
  }
  [1, 3, 5, 7].forEach((v) => tint(g.nodes[v], PC.bad));
  say('一共 6 個 maximal biconnected component', '每條 edge 只屬於其中一個（edge 的 partition）');
  await beat(tok, 3000);
  glow(g.nodes[3], GOLD);
  say('B2、B3 共用頂點 3', '兩個 BCC 最多共用 1 個點 = articulation point');
  await beat(tok, 3200);
}]);

// ── DFS spanning tree（從 3 出發）的 dfn / low ──
const TPOS = { 3: [0, -3.4], 4: [-2.4, -1.8], 5: [2.4, -1.8], 2: [-2.4, -0.2], 6: [2.4, -0.2], 1: [-2.4, 1.4], 7: [2.4, 1.4], 0: [-2.4, 3.0], 9: [1.3, 3.0], 8: [3.5, 3.0] };
const DFN = [5, 4, 3, 1, 2, 6, 7, 8, 10, 9], LOW = [5, 1, 1, 1, 1, 6, 6, 6, 10, 9];
const TREE_E = [[3, 4], [4, 2], [2, 1], [1, 0], [3, 5], [5, 6], [6, 7], [7, 9], [7, 8]];
const DFS_ORDER = [[3, -1], [4, 3], [2, 4], [1, 2], [0, 1], [5, 3], [6, 5], [7, 6], [9, 7], [8, 7]];
const tp = (v, dx) => V3(TPOS[v][0] + dx, 0.3, TPOS[v][1]);
function treeEdges(dx) {
  const rods = TREE_E.map(([a, b]) => { const p = tp(a, dx), q = tp(b, dx); const d = q.clone().sub(p).normalize(); return rod(p.clone().addScaledVector(d, 0.45), q.clone().addScaledVector(d, -0.45), PC.tree, 0.05); });
  const b13 = dash([tp(1, dx), V3(-0.9 + dx, 0.3, -0.9), tp(3, dx)]);
  const b75 = dash([tp(7, dx), V3(3.7 + dx, 0.3, -0.2), tp(5, dx)]);
  return { rods, back: [b13, b75] };
}
// 直接在樹的位置畫出 DFS spanning tree（dfn 標在上方，low 標在右邊）
function apTree(dx, opt = {}) {
  const nodes = [], dfn = [], low = [];
  for (let v = 0; v < 10; v++) {
    const p = tp(v, dx);
    nodes[v] = cube(v, PC.node, [0.7, 0.55, 0.7], p.x, 0.3, p.z, opt.drop === false ? 0 : 2.5);
    dfn[v] = tag('dfn ' + DFN[v], 'idx', p.x, 0.9, p.z - 0.6);
    low[v] = tag(opt.low ? 'low ' + LOW[v] : '', 'ptr', p.x + 0.95, 0.6, p.z + 0.1);
    if (!opt.low) showL(low[v], false);
  }
  const ed = treeEdges(dx);
  return { nodes, dfn, low, ed };
}
const setLow = (t, v, val) => { txt(t.low[v], 'low ' + val); showL(t.low[v], true); };
const rowL = (v, low) => (' ' + v + '  ' + String(DFN[v]).padStart(3) + '  ' + (low == null ? '  -' : String(low).padStart(3)));
function lowTable(x, known) { return code(['  v  dfn  low', ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((v) => rowL(v, known && known.includes(v) ? LOW[v] : null))], x, 4.2, 0.38, -1.2); }

// 圖 → DFS（從 3）標 dfn → 拉起 root 變成樹＋back edge 虛線
async function graphToTree(tok, g, dx, slow) {
  const dt = [];
  for (const [v, p] of DFS_ORDER) {
    if (p >= 0) ecol(g.E(p, v), PC.tree, 2.2);
    tint(g.nodes[v], PC.ok); dt[v] = above(g.spec, v, 'dfn ' + DFN[v], 'idx', 0.9);
    if (slow) { say(p < 0 ? '從 3 出發：dfn(3) = 1' : (p === 3 && v === 4 ? 'adjacency list 裡 4 在 5 前面 → 先走 4' : '走到 ' + v + '：dfn(' + v + ') = ' + DFN[v]), 'dfn = DFS 拜訪順序'); await beat(tok, v === 4 ? 1900 : 1000); }
  }
  if (!slow) await beat(tok, 1000);
  if (slow) { say('1–3、5–7 這兩條沒走到', '它們不是 tree edge'); await beat(tok, 2200); }
  g.edges.forEach((e) => kill(e.obj)); dt.forEach(kill);
  for (let v = 0; v < 10; v++) { const p = tp(v, dx); move(g.nodes[v], p.x, 0.3, p.z); }
  say('把 root 3 拎起來（像提布偶）', '越靠近 root，dfn 越小');
  await beat(tok, 1600);
  const ed = treeEdges(dx);
  const tags = []; for (let v = 0; v < 10; v++) { const p = tp(v, dx); tags[v] = tag('dfn ' + DFN[v], 'idx', p.x, 0.9, p.z - 0.6); }
  return { ed, tags };
}

// 39:05 / 51:20 用 DFS spanning tree 找 biconnected component：dfn、拉起來、back edge
FRAG.push(['gpeng20-dfn-tree', 'DFS spanning tree（從 3）：dfn 與 back edge', async (tok) => {
  fresh([0, 9.5, 9.5], [0, 0, 0]);
  const g = mkG(GAP, { noW: true });
  say('第一步：對 graph 做 DFS，從 3 出發', '');
  await beat(tok, 2000);
  await graphToTree(tok, g, 0, true);
  say('虛線 = back edge：原圖有、樹上沒有', '(1, 3)、(7, 5)：跳回祖先，加上去會成 cycle');
  await beat(tok, 3400);
  say('root 3 有兩個 child：4 和 5', '');
  await beat(tok, 2600);
}]);

// 44:18 / 56:10 low(w) 的定義與 0、1、2 的例子
FRAG.push(['gpeng20-low-def', 'low(w)：往下走再用一條 back edge 能到的最小 dfn', async (tok) => {
  fresh([0, 9.5, 9.5], [0, 0.4, 0]);
  const t = apTree(1.6);
  const tb = lowTable(-5.0, []);
  say('low(w)：從 w 往子孫走，最多用一條 back edge', 'low(w) = min{ dfn(w), low(x) x 是 child, dfn(x) (w,x) 是 back edge }');
  await beat(tok, 4200);
  glow(t.nodes[0], GOLD); tb.hl(1);
  say('0：沒有 child，也沒有 back edge', 'low(0) = dfn(0) = 5');
  setLow(t, 0, 5); txt(tb.ls[1], rowL(0, 5));
  await beat(tok, 3000); glow(t.nodes[0], null);
  glow(t.nodes[1], GOLD); tb.hl(2); t.ed.back[0].material.color.set('#e8b02a');
  say('1：有 back edge (1, 3) 直達天聽', 'low(1) = min(4, low(0)=5, dfn(3)=1) = 1');
  setLow(t, 1, 1); txt(tb.ls[2], rowL(1, 1));
  await beat(tok, 3600); glow(t.nodes[1], null);
  glow(t.nodes[2], GOLD); tb.hl(3);
  say('2：透過 child 1 的 back edge 也能到 3', 'low(2) = min(3, low(1)=1) = 1');
  setLow(t, 2, 1); txt(tb.ls[3], rowL(2, 1));
  await beat(tok, 3600); glow(t.nodes[2], null); tb.hl(-1);
  say('三個來源取最小', '自己的 dfn、child 的 low、back edge 那端的 dfn');
  await beat(tok, 2800);
}]);

// 58:20 low(5)、low(7)、low(6) = 6
FRAG.push(['gpeng20-low-567', 'low(7)、low(6)、low(5) 都是 6', async (tok) => {
  fresh([0, 9.5, 9.5], [0, 0.4, 0]);
  const t = apTree(1.6);
  const tb = lowTable(-5.0, [0, 1, 2, 8, 9]);
  [0, 1, 2, 8, 9].forEach((v) => setLow(t, v, LOW[v]));
  say('右半邊：5 → 6 → 7 → 8、9', '8、9 是 leaf：low = 自己的 dfn');
  await beat(tok, 2800);
  glow(t.nodes[7], GOLD); tb.hl(8); t.ed.back[1].material.color.set('#e8b02a');
  say('7：dfn 8、child 9 與 8、back edge 到 5', 'low(7) = min(8, low(9)=9, low(8)=10, dfn(5)=6) = 6');
  setLow(t, 7, 6); txt(tb.ls[8], rowL(7, 6));
  await beat(tok, 4200); glow(t.nodes[7], null);
  glow(t.nodes[6], GOLD); tb.hl(7);
  say('6：dfn 7，child 7 的 low 是 6', 'low(6) = min(7, low(7)=6) = 6');
  setLow(t, 6, 6); txt(tb.ls[7], rowL(6, 6));
  await beat(tok, 3600); glow(t.nodes[6], null);
  glow(t.nodes[5], GOLD); tb.hl(6);
  say('5：dfn 6，child 6 的 low 是 6', 'low(5) = min(6, low(6)=6) = 6');
  setLow(t, 5, 6); txt(tb.ls[6], rowL(5, 6));
  await beat(tok, 3600); glow(t.nodes[5], null); tb.hl(-1);
  say('往下走只會遇到更大的 dfn', '要先算 child，才能算 parent');
  await beat(tok, 2800);
}]);

// 63:20 low 要 bottom-up 算：0 8 9 → 1 7 → 2 6 → 4 5 → 3
FRAG.push(['gpeng20-low-bottomup', 'low 值要由下往上（bottom-up）算', async (tok) => {
  fresh([0, 9.5, 9.5], [0, 0.4, 0]);
  const t = apTree(1.6);
  const tb = lowTable(-5.0, []);
  say('一開始 low 欄位全是空的', '公式會用到 child 的 low → 先算下面');
  await beat(tok, 3000);
  const levels = [[0, 9, 8], [1, 7], [2, 6], [4, 5], [3]];
  for (const L of levels) {
    L.forEach((v) => { glow(t.nodes[v], GOLD); setLow(t, v, LOW[v]); txt(tb.ls[v + 1], rowL(v, LOW[v])); });
    say('算 ' + L.join('、') + ' 的 low', L.map((v) => 'low(' + v + ')=' + LOW[v]).join('  '));
    await beat(tok, 2400);
    L.forEach((v) => glow(t.nodes[v], null));
  }
  say('順序：leaf 先算，一層一層往上', 'bottom-up（其實就是 DFS 的後序）');
  await beat(tok, 3000);
}]);

// 64:28 判斷 articulation point：root 有 ≥ 2 個 child；非 root 的 u 有 child w 使 low(w) ≥ dfn(u)
FRAG.push(['gpeng20-ap-test', '判斷 AP：low(w) ≥ dfn(u)', async (tok) => {
  fresh([0, 9.5, 9.5], [0, 0.4, 0]);
  const t = apTree(1.6, { low: true });
  const tb = lowTable(-5.0, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  say('u 不是 root：有 child w 使 low(w) ≥ dfn(u)', 'w 底下的點都跳不過 u → u 是 articulation point');
  await beat(tok, 3600);
  const checks = [[1, 0, true], [4, 2, false], [2, 1, false], [5, 6, true], [6, 7, false], [7, 9, true]];
  for (const [u, w, ok] of checks) {
    glow(t.nodes[u], GOLD); glow(t.nodes[w], '#3a2a00');
    say('u = ' + u + '，child w = ' + w, 'low(' + w + ') = ' + LOW[w] + (ok ? ' ≥ ' : ' < ') + 'dfn(' + u + ') = ' + DFN[u] + (ok ? ' → 是 AP' : ' → 不是'));
    if (ok) tint(t.nodes[u], PC.bad);
    await beat(tok, ok ? 2600 : 1900);
    glow(t.nodes[u], null); glow(t.nodes[w], null);
  }
  tint(t.nodes[3], PC.bad); glow(t.nodes[3], GOLD);
  say('root 3 有兩個 child（4、5）→ 是 AP', 'root：child ≥ 2 才是');
  await beat(tok, 2600);
  say('articulation point = 1、3、5、7', '');
  await beat(tok, 2600);
}]);

// 67:46 四個步驟總結
FRAG.push(['gpeng20-ap-steps', '找 articulation point 的四個步驟', async (tok) => {
  fresh([0, 9.5, 9.5], [0, 0.4, 0]);
  const steps = code(['1. DFS → 每個點的 dfn', '2. 拉成樹，畫 back edge', '3. bottom-up 算 low', '4. root ≥2 child；', '   low(w) ≥ dfn(u)'], -5.2, 4.0, 0.5, -1.6);
  const g = mkG(Object.assign({}, GAP, { dx: 1.3 }), { noW: true });
  steps.hl(0); say('步驟 1：DFS traversal（從 3）', '記下 dfn');
  await beat(tok, 1400);
  steps.hl(1);
  const { tags } = await graphToTree(tok, g, 1.3, false);
  say('步驟 2：拉起來，back edge 畫虛線', '(1,3)、(7,5)');
  await beat(tok, 2400);
  steps.hl(2);
  const low = [];
  for (const L of [[0, 9, 8], [1, 7], [2, 6], [4, 5], [3]]) { L.forEach((v) => { const p = tp(v, 1.3); low[v] = tag('low ' + LOW[v], 'ptr', p.x + 0.95, 0.6, p.z + 0.1); }); await beat(tok, 700); }
  say('步驟 3：算每個點的 low', '先 leaf 再往上');
  await beat(tok, 2000);
  steps.hl(3);
  [3, 1, 5, 7].forEach((v) => tint(g.nodes[v], PC.bad));
  say('步驟 4：判斷 → 1、3、5、7', 'root 3 兩個 child；其餘看 low(w) ≥ dfn(u)');
  await beat(tok, 3200);
  steps.hl(-1);
  say('有了 AP 再找 biconnected component', '（留給同學看書）');
  await beat(tok, 2600);
}]);

// ───────── 最短路徑 ─────────
const G6 = { names: ['0', '1', '2', '3', '4', '5'], pos: [[-4.6, -1.4], [0, -3.2], [4.6, -1.4], [-3.2, 2.6], [1.4, 2.6], [5, 3]],
  edges: [[0, 1, 50], [0, 2, 45], [0, 3, 10], [1, 2, 10], [1, 3, 15], [2, 4, 30], [3, 0, 20], [3, 4, 15], [4, 1, 20], [4, 2, 35], [5, 4, 3]], dir: true };

// 73:03 single source all destinations；Dijkstra 的想法（像 Prim 往外長）
FRAG.push(['gpeng20-sssp-problem', 'Single source 最短路徑：0 到每個點', async (tok) => {
  fresh([0, 9.5, 9.5], [0.2, 0, 0]);
  const g = mkG(G6);
  glow(g.nodes[0], GOLD);
  say('給一個 network 和起點 0', '找 0 到每個 destination 的最短路徑');
  await beat(tok, 3000);
  ecol(g.E(0, 1), PC.bad); ecol(g.E(1, 3), PC.bad);
  say('0 → 1 → 3：繞路', 'cost = 50 + 15 = 65');
  await beat(tok, 2600);
  ecol(g.E(0, 1), '#9c8b70'); ecol(g.E(1, 3), '#9c8b70'); ecol(g.E(0, 3), PC.tree);
  say('0 → 3 直接走', 'cost = 10，最短');
  await beat(tok, 2400);
  ecol(g.E(3, 4), PC.tree); glow(g.nodes[4], GOLD);
  say('0 到 4：0 → 3 → 4', 'cost = 10 + 15 = 25');
  await beat(tok, 2800);
  g.edges.forEach((e) => ecol(e, '#9c8b70')); glow(g.nodes[4], null);
  say('Dijkstra：edge cost 不能是負的', '想法像 Prim：從已確定的點往外長');
  await beat(tok, 2800);
  tint(g.nodes[0], PC.ok);
  [[0, 3], [0, 2], [0, 1]].forEach(([a, b]) => ecol(g.E(a, b), PC.hot));
  say('先看起點直接到得了的點', '最近的是 3（10）→ 確定');
  await beat(tok, 2400);
  tint(g.nodes[3], PC.ok); ecol(g.E(0, 3), PC.tree);
  ecol(g.E(3, 4), PC.hot);
  say('再從確定的點往外延伸', '一次確定一個點，直到全部拜訪');
  await beat(tok, 3000);
}]);

// Boston 8 城市（Horowitz）：4 = Boston 起點
const GB = { names: ['0', '1', '2', '3', '4', '5', '6', '7'], city: ['LA', 'SF', 'Denver', 'Chicago', 'Boston', 'NY', 'Miami', 'N.Orleans'],
  pos: [[-5.4, 1.4], [-5.6, -2.0], [-2.6, -0.9], [0.4, -2.4], [4.9, -2.6], [4.0, -0.2], [3.6, 2.6], [0.0, 2.3]], dz: -0.4,
  edges: [[1, 0, 300], [2, 0, 1000], [2, 1, 800], [3, 2, 1200], [4, 3, 1500], [4, 5, 250], [5, 3, 1000], [5, 6, 900], [5, 7, 1400], [6, 7, 1000], [7, 0, 1700]], dir: true };
const BOS = { init: [Infinity, Infinity, Infinity, 1500, 0, 250, Infinity, Infinity],
  it: [[5, [Infinity, Infinity, Infinity, 1250, 0, 250, 1150, 1650]], [6, [Infinity, Infinity, Infinity, 1250, 0, 250, 1150, 1650]], [3, [Infinity, Infinity, 2450, 1250, 0, 250, 1150, 1650]],
    [7, [3350, Infinity, 2450, 1250, 0, 250, 1150, 1650]], [2, [3350, 3250, 2450, 1250, 0, 250, 1150, 1650]], [1, [3350, 3250, 2450, 1250, 0, 250, 1150, 1650]]] };
const f8 = (d) => (d === Infinity ? INFT : String(d));
function bosBoard() {
  const g = mkG(GB, { size: 0.8 });
  GB.city.forEach((c, i) => { const p = gp(GB, i); tag(c, 'idx', p.x, 0.1, p.z + 0.65); });
  const D = GB.names.map((n, i) => above(GB, i, '', 'ptr', 1.0));
  const head = '     ' + ['LA', 'SF', 'DEN', 'CHI', 'BOS', 'NY', 'MIA', 'NO'].map((s) => s.padStart(5)).join('');
  const tb = code([head, ''], 0, 0.5, 0.42, 4.5);
  const show = (lbl, d, S) => { d.forEach((x, i) => { txt(D[i], 'D=' + f8(x)); D[i].element.className = 'lab-label ' + (S && S.has(i) ? 'ptr alt' : 'ptr'); }); txt(tb.ls[1], lbl.padEnd(5) + d.map((x) => f8(x).padStart(5)).join('')); };
  return { g, D, tb, show };
}

// 77:33 Boston 例：cost adjacency matrix、初始化、選 5（NY）
FRAG.push(['gpeng20-boston-init', 'Dijkstra 例：Boston 出發，初始化', async (tok) => {
  fresh([0, 10, 9.8], [0, 0, 0.4]);
  const b = bosBoard();
  say('8 個城市，起點 4 = Boston', 'edge cost = 航程（有向圖，存成 cost matrix）');
  await beat(tok, 3200);
  glow(b.g.nodes[4], GOLD);
  b.show('init', BOS.init, new Set());
  say('初始化：Boston 直接到得了的才有值', 'NY 250、Chicago 1500，其他 ∞');
  await beat(tok, 3400);
  ecol(b.g.E(4, 5), PC.tree); ecol(b.g.E(4, 3), PC.hot);
  say('起點 4 先放進 S', 'S = {4}');
  tint(b.g.nodes[4], PC.ok);
  await beat(tok, 2400);
  glow(b.g.nodes[5], GOLD);
  say('S 外面最小的是 250', 'vertex selected = 5（NY）');
  await beat(tok, 2600);
  tint(b.g.nodes[5], PC.ok); glow(b.g.nodes[5], null);
  b.show('init', BOS.init, new Set([4, 5]));
  say('5 的距離 250 確定了', 'S = {4, 5}');
  await beat(tok, 3800);
}]);

// 82:50 每選一點就更新鄰居；依序選 5 6 3 7 2 1
FRAG.push(['gpeng20-boston-run', 'Dijkstra 例：依序選 5、6、3、7、2、1', async (tok) => {
  fresh([0, 10, 9.8], [0, 0, 0.4]);
  const b = bosBoard();
  const S = new Set([4]);
  tint(b.g.nodes[4], PC.ok); b.show('init', BOS.init, S);
  say('從 S = {4} 開始', 'init：NY 250、Chicago 1500');
  await beat(tok, 2000);
  const why = {
    5: ['加入 NY：Chicago、Miami、N.Orleans 變短', '250+1000=1250 < 1500，250+900=1150，250+1400=1650'],
    6: ['加入 Miami：只能到 N.Orleans', '1150+1000=2150 > 1650 → 不變'],
    3: ['加入 Chicago：Denver 有值了', '1250+1200 = 2450'],
    7: ['加入 N.Orleans：LA 有值了', '1650+1700 = 3350'],
    2: ['加入 Denver：SF 有值了', '2450+800 = 3250（到 LA 3450 > 3350）'],
    1: ['加入 SF：沒有變短的', '3250+300 = 3550 > 3350'],
  };
  const upd = { 5: [[5, 3], [5, 6], [5, 7]], 6: [], 3: [[3, 2]], 7: [[7, 0]], 2: [[2, 1]], 1: [] };
  let k = 0;
  for (const [v, d] of BOS.it) {
    k++;
    glow(b.g.nodes[v], GOLD); tint(b.g.nodes[v], PC.ok); S.add(v);
    upd[v].forEach(([x, y]) => ecol(b.g.E(x, y), PC.tree));
    b.show(String(k), d, S);
    say(why[v][0], why[v][1]);
    await beat(tok, 3000);
    glow(b.g.nodes[v], null);
  }
  say('所有點都選完：最後一列就是答案', 'LA 3350　SF 3250　Denver 2450　Chicago 1250');
  await beat(tok, 3200);
}]);

// 86:43 要知道路徑就要多記資訊（從哪個點更新來的）；greedy：選進 S 就定住
FRAG.push(['gpeng20-dijkstra-path', 'Dijkstra：多記 parent 才知道路徑', async (tok) => {
  fresh([0, 10, 9.8], [0, 0, 0.4]);
  const b = bosBoard();
  b.show('6', BOS.it[5][1], new Set([0, 1, 2, 3, 4, 5, 6, 7]));
  b.g.nodes.forEach((m) => tint(m, PC.ok));
  say('表格只告訴你最短 cost', '想知道怎麼走 → 要多記資訊');
  await beat(tok, 3000);
  const PAR = [7, 2, 3, 5, -1, 4, 5, 5];
  const pt = PAR.map((p, i) => { const q = gp(GB, i); return tag(p < 0 ? '' : 'from ' + p, 'idx', q.x + 1.0, 0.5, q.z); });
  say('每次更新時記下「是誰讓它變短」', 'parent：SF←2、Denver←3、Chicago←5…');
  await beat(tok, 3200);
  for (const [dst, path] of [[1, [4, 5, 3, 2, 1]], [0, [4, 5, 7, 0]]]) {
    b.g.edges.forEach((e) => ecol(e, '#9c8b70'));
    for (let i = 1; i < path.length; i++) { ecol(b.g.E(path[i - 1], path[i]), PC.hot); await beat(tok, 500); }
    say('到 ' + GB.city[dst] + '：沿 parent 往回推', path.map((v) => GB.city[v]).join(' → '));
    await beat(tok, 2600);
  }
  pt.forEach((l) => showL(l, true));
  say('greedy：每回合選最小，選進 S 就定住', '之後不會再改');
  await beat(tok, 3000);
}]);

// 89:19 負邊：0→1 = 7、0→2 = 5、1→2 = −5，Dijkstra 給出錯的 5
FRAG.push(['gpeng20-dijkstra-neg', 'Dijkstra 遇到負邊：0 到 2 算錯', async (tok) => {
  fresh([0, 8, 8], [0, 0, 0]);
  const S3 = { names: ['0', '1', '2'], pos: [[-3.4, 0], [1.4, -2.4], [1.4, 2.4]], edges: [[0, 1, 7], [0, 2, 5], [1, 2, -5]], dir: true };
  const g = mkG(S3, { size: 0.9 });
  const D = [0, 1, 2].map((i) => above(S3, i, '', 'ptr', 1.1));
  const show = (d) => d.forEach((x, i) => txt(D[i], 'D=' + x));
  say('如果有負的 edge：1 → 2 是 −5', '還能用 Dijkstra 嗎？');
  show(['0', '7', '5']);
  await beat(tok, 3000);
  tint(g.nodes[0], PC.ok);
  glow(g.nodes[2], GOLD);
  say('7 和 5 選最小 → 選 2', 'D(2) = 5，從此定住');
  await beat(tok, 2600);
  tint(g.nodes[2], PC.ok); glow(g.nodes[2], null);
  tint(g.nodes[1], PC.ok);
  say('再選 1：D(1) = 7', '全部選完，演算法說 0 到 2 是 5');
  await beat(tok, 2600);
  ecol(g.E(0, 1), PC.hot); ecol(g.E(1, 2), PC.hot);
  say('其實 0 → 1 → 2 = 7 + (−5) = 2', '比 5 還短！');
  await beat(tok, 3000);
  tint(g.nodes[2], PC.bad); txt(D[2], 'D=5？正解 2');
  say('2 已經被選走，cost 不會再改', '有負邊不能用 Dijkstra');
  await beat(tok, 3000);
  say('有負 cycle 更糟：繞一圈就更小', '最短路徑沒有定義');
  await beat(tok, 2600);
}]);

// Bellman-Ford 7 頂點（Horowitz）
const GBF = { names: ['0', '1', '2', '3', '4', '5', '6'], pos: [[-5, 0], [-1.8, -2.8], [-1.8, 0], [-1.8, 2.8], [1.8, -2.2], [1.8, 2.2], [5, 0]].map(([x, z]) => [x * 0.66, z * 0.95]), dx: -3.0,
  edges: [[0, 1, 6], [0, 2, 5], [0, 3, 5], [1, 4, -1], [2, 1, -2], [2, 4, 1], [3, 2, -2], [3, 5, -1], [4, 6, 3], [5, 6, 3]], dir: true };
const BFROWS = [[0, 6, 5, 5, Infinity, Infinity, Infinity], [0, 3, 3, 5, 5, 4, Infinity], [0, 1, 3, 5, 2, 4, 7], [0, 1, 3, 5, 0, 4, 5], [0, 1, 3, 5, 0, 4, 3], [0, 1, 3, 5, 0, 4, 3]];
const bfRow = (k, r) => ' ' + k + ' │' + r.map((x) => f8(x).padStart(3)).join('');

// 92:17 Bellman-Ford：dist^k[u] = 最多 k 條邊的最短距離
FRAG.push(['gpeng20-bf-formula', 'Bellman-Ford：dist^k[u] 最多走 k 條邊', async (tok) => {
  fresh([0, 9.5, 9.5], [0, 0, 0]);
  const g = mkG(GBF);
  glow(g.nodes[0], GOLD);
  say('edge 可以是負的：Bellman-Ford', 'dist^k[u]：source 到 u 最多走 k 條邊的最短距離');
  await beat(tok, 3600);
  const D = GBF.names.map((n, i) => above(GBF, i, 'k=1：' + f8(BFROWS[0][i]), 'ptr', 1.0));
  say('k = 1：只能走一條邊', '0 → 1、2、3 = 6、5、5，其他 ∞');
  await beat(tok, 3000);
  const p = code(['dist^k[u] = min {', '  dist^(k-1)[u],', '  min_i dist^(k-1)[i] + length[i][u] }'], 3.8, 3.4, 0.5, -1.0);
  p.hl(1); glow(g.nodes[1], GOLD);
  say('情況一：多走一條邊也沒變小', '沿用上一回合 dist^1[1] = 6');
  await beat(tok, 3000);
  p.hl(2); ecol(g.E(2, 1), PC.hot); glow(g.nodes[2], '#3a2a00');
  say('情況二：找中繼站 i，i → u 有邊', 'i = 2：dist^1[2] + (−2) = 5 − 2 = 3');
  await beat(tok, 3400);
  ecol(g.E(0, 1), PC.hot);
  say('i = 0：0 + 6 = 6', '取最小 → dist^2[1] = 3');
  txt(D[1], 'k=2：3'); tint(g.nodes[1], PC.ok);
  await beat(tok, 3000);
  p.hl(-1);
  say('每回合把 k 加 1 再算一次', '最多 n − 1 = 6 回合');
  await beat(tok, 2600);
}]);

// 96:58 dist^k 表格 k = 1..6
FRAG.push(['gpeng20-bf-table', 'Bellman-Ford 表格：k = 1 到 6', async (tok) => {
  fresh([0, 9.5, 9.5], [0, 0, 0]);
  const g = mkG(GBF);
  glow(g.nodes[0], GOLD);
  const tb = code([' k │  0  1  2  3  4  5  6', ...BFROWS.map(() => ' '.repeat(24))], 4.0, 3.8, 0.46, -1.0);
  const fill = (k) => txt(tb.ls[k], bfRow(k, BFROWS[k - 1]).padEnd(24));
  fill(1); tb.hl(1);
  say('k = 1：0 直接走到 1、2、3', '6、5、5，4/5/6 至少要兩條邊 → ∞');
  await beat(tok, 3200);
  fill(2); tb.hl(2);
  ecol(g.E(0, 2), PC.hot); ecol(g.E(2, 1), PC.hot);
  say('k = 2：0→2→1 = 5 − 2 = 3 < 6', 'dist^2[1] = 3');
  await beat(tok, 3000);
  g.edges.forEach((e) => ecol(e, '#9c8b70'));
  ecol(g.E(0, 3), PC.hot); ecol(g.E(3, 2), PC.hot);
  say('0→3→2 = 5 − 2 = 3 < 5', 'dist^2[2] = 3');
  await beat(tok, 3000);
  g.edges.forEach((e) => ecol(e, '#9c8b70'));
  fill(3); tb.hl(3);
  ecol(g.E(0, 3), PC.hot); ecol(g.E(3, 2), PC.hot); ecol(g.E(2, 1), PC.hot);
  say('k = 3：到 2 的最佳 3，再走 2→1', 'dist^3[1] = 3 + (−2) = 1');
  await beat(tok, 3400);
  g.edges.forEach((e) => ecol(e, '#9c8b70'));
  for (const k of [4, 5, 6]) { fill(k); tb.hl(k); say('k = ' + k + '：依此類推', 'dist^' + k + ' = ' + BFROWS[k - 1].map(f8).join(' ')); await beat(tok, 1800); }
  tb.hl(-1);
  say('k = 允許最多走幾條邊', '答案：0 1 3 5 0 4 3');
  await beat(tok, 3000);
}]);

// Floyd 用的 3 頂點圖（Horowitz：0→1 4、0→2 11、1→0 6、1→2 2、2→0 3）
const GF = { names: ['0', '1', '2'], pos: [[-5.4, -1.8], [-1.8, -1.8], [-3.6, 1.8]], edges: [[0, 1, 4], [0, 2, 11], [1, 0, 6], [1, 2, 2], [2, 0, 3]], dir: true };

// 103:30 all-pairs：每個點當 source 跑 n 次；或 A^k
FRAG.push(['gpeng20-allpairs-def', 'All-pairs shortest path：A^(−1) 到 A^(n−1)', async (tok) => {
  fresh([0, 9, 9], [0, 0, 0]);
  const g = mkG(GF, { size: 0.9 });
  say('all pairs：任兩點的最短路徑', '');
  await beat(tok, 2200);
  for (let s = 0; s < 3; s++) {
    g.nodes.forEach((m) => glow(m, null)); glow(g.nodes[s], GOLD);
    say('笨方法：source = ' + s + '，跑一次 single source', '每個點都當一次起點 → n 次');
    await beat(tok, 1700);
  }
  g.nodes.forEach((m) => glow(m, null));
  const M = code(['A^(-1)   0   1   2', '   0     0   4  11', '   1     6   0   2', '   2     3   ∞   0'], 2.8, 2.4, 0.55, -0.6);
  say('另一種：A^(−1)[i][j] = length[i][j]', '初始值：只能走直接的邊');
  await beat(tok, 3200);
  M.hl(3);
  say('A^k[i][j]：中間經過的頂點編號 ≤ k', '最後 A^(n−1) = 答案');
  await beat(tok, 3400);
  M.hl(-1);
  say('n 個點 → A⁰、A¹ … A^(n−1)', '這裡 n = 3：算到 A²');
  await beat(tok, 2800);
}]);

// 106:38 A^k 遞迴式；Floyd 的 k ≠ Bellman-Ford 的 k
FRAG.push(['gpeng20-ak-formula', 'A^k[i][j] = min(不經過 k, 經過 k)', async (tok) => {
  fresh([0, 9, 9], [0, 0, 0]);
  const I = cube('i', PC.node, [0.9, 0.55, 0.9], -5, 0.3, 1.6, 3), Kc = cube('k', PC.hot, [0.9, 0.55, 0.9], -2.6, 0.3, -2.0, 3), J = cube('j', PC.node, [0.9, 0.55, 0.9], -0.2, 0.3, 1.6, 3);
  const d0 = rod(V3(-4.4, 0.3, 1.6), V3(-0.8, 0.3, 1.6), PC.edge, 0.06);
  tag('A^(k−1)[i][j]', 'idx', -2.6, 0.5, 2.3);
  say('情況一：沒經過 k 也一樣好', '= A^(k−1)[i][j]');
  await beat(tok, 3000);
  rod(V3(-4.6, 0.3, 1.1), V3(-2.9, 0.3, -1.5), PC.hot, 0.06); rod(V3(-2.3, 0.3, -1.5), V3(-0.6, 0.3, 1.1), PC.hot, 0.06);
  tag('A^(k−1)[i][k]', 'idx', -4.6, 0.5, -0.6); tag('A^(k−1)[k][j]', 'idx', -0.6, 0.5, -0.6);
  say('情況二：i → k → j', '兩段中間都只經過編號 ≤ k−1 的點');
  await beat(tok, 3200);
  const f = code(['A^k[i][j] = min(', '  A^(k-1)[i][j],', '  A^(k-1)[i][k] + A^(k-1)[k][j] )'], 3.6, 2.4, 0.5, -0.8);
  say('兩者取最小', 'k 從 0 跑到 n − 1');
  await beat(tok, 3000);
  f.hl(2);
  say('例：A⁰[2][1] = min(∞, 3 + 4) = 7', '2 → 0 → 1');
  await beat(tok, 3000);
  f.hl(-1);
  say('注意：兩個 k 意義不同', 'Bellman-Ford：最多 k 條邊；Floyd：中繼點編號 ≤ k');
  await beat(tok, 3600);
}]);

// 113:12 transitive closure：A⁺（長度 > 0 的路徑）、A*（含自己到自己）
FRAG.push(['gpeng20-closure', 'Transitive closure：A⁺ 與 A*', async (tok) => {
  fresh([0, 9.5, 9.5], [0, 0, 0]);
  const S = { names: ['0', '1', '2', '3', '4'], pos: [[-6.2, 0], [-4.8, 0], [-3.4, 0], [-2.2, -1.8], [-2.2, 1.8]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 2]], dir: true };
  mkG(S, { noW: true, size: 0.6 });
  const A = [[0, 1, 0, 0, 0], [0, 0, 1, 0, 0], [0, 0, 0, 1, 0], [0, 0, 0, 0, 1], [0, 0, 1, 0, 0]];
  const AP = [[0, 1, 1, 1, 1], [0, 0, 1, 1, 1], [0, 0, 1, 1, 1], [0, 0, 1, 1, 1], [0, 0, 1, 1, 1]];
  const x0 = 0.6, z0 = -2.2, d = 1.05;
  for (let i = 0; i < 5; i++) { tag(String(i), 'idx', x0 - 0.9, 0.2, z0 + i * d); tag(String(i), 'idx', x0 + i * d, 0.2, z0 - 0.9); }
  const cells = A.map((r, i) => r.map((v, j) => cube(v, v ? '#4b9ee2' : '#efe5d3', [0.8, 0.3, 0.8], x0 + j * d, 0.15, z0 + i * d, 2)));
  const title = tag('A（adjacency）', 'ptr', 2.7, 0.5, 3.4);
  say('A 可以到 B、B 可以到 C → A 到得了 C？', 'adjacency matrix：1 = 有邊');
  await beat(tok, 3200);
  txt(title, 'A⁺');
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if (AP[i][j] !== A[i][j]) { relabel(cells[i][j], 1); tint(cells[i][j], '#e8b02a'); }
  say('A⁺[i][j] = 1：有長度 > 0 的路徑', '跑 all-pairs，路徑長 > 0 就填 1');
  await beat(tok, 3600);
  glow(cells[2][2], GOLD);
  say('2 → 3 → 4 → 2：繞回自己', 'A⁺[2][2] = 1');
  await beat(tok, 2800);
  glow(cells[2][2], null);
  txt(title, 'A*');
  for (const i of [0, 1]) { relabel(cells[i][i], 1); tint(cells[i][i], PC.ok); }
  say('A*：再把對角線（自己到自己）設成 1', '長度 0 的路徑也算');
  await beat(tok, 3200);
  say('A* 和 A⁺ 只差在對角線', '都可以用 all-pairs 的結果得到');
  await beat(tok, 3000);
}]);

// 115:09 本堂總結
FRAG.push(['gpeng20-recap', '最短路徑總結：Dijkstra、Bellman-Ford、all-pairs', async (tok) => {
  fresh([0, 8, 9], [0, 0.6, 0]);
  const cols = [['Dijkstra', 'single source', 'cost ≥ 0', -4.2, '#2fc092'], ['Bellman-Ford', 'single source', '可以有負邊', 0, '#4b9ee2'], ['All-pairs', 'A^k，O(n³)', '暴力：經過所有點', 4.2, '#9b7ef4']];
  for (const [name, a, b, x, c] of cols) {
    cube('', c, [2.2, 1.6, 1.4], x, 0.8, 0, 3);
    tag(name, 'ptr', x, 2.2, 0); tag(a, 'idx', x, 1.0, 0.9); tag(b, 'ptr alt', x, 0.4, 0.9);
    say(name + '：' + a, b);
    await beat(tok, 3600);
  }
  say('single source 兩個演算法都要會 run', '再加上 all-pairs shortest path');
  await beat(tok, 4200);
}]);

// 116:16 AOV network：vertex = activity，edge = 先後關係（擋修）
FRAG.push(['gpeng20-aov', 'AOV network：擋修關係圖', async (tok) => {
  fresh([0, 8.5, 9], [0, 0, 0]);
  const S = { names: ['C1', 'C2', 'C3'], pos: [[-4.2, -1.8], [-4.2, 1.8], [0.6, 0]], edges: [[0, 2], [1, 2]], dir: true };
  const g = mkG(S, { noW: true, size: 1.0 });
  tag('程式設計（一）', 'idx', -4.2, 0.2, -0.9); tag('離散數學', 'idx', -4.2, 0.2, 2.7); tag('資料結構', 'idx', 0.6, 0.2, 0.9);
  say('AOV：Activity On Vertex', 'vertex = activity（一門課）');
  await beat(tok, 3000);
  say('edge = 先後關係', '要先修 C1、C2 才能修資料結構');
  await beat(tok, 3000);
  tint(g.nodes[2], PC.bad);
  say('前面的 activity 還沒完成…', '後面的不能開始');
  await beat(tok, 2600);
  tint(g.nodes[0], PC.ok); await beat(tok, 900);
  tint(g.nodes[1], PC.ok); await beat(tok, 900);
  tint(g.nodes[2], PC.ok);
  say('C1、C2 都修完 → C3 才能修', '系上的課程地圖就是一張 AOV');
  await beat(tok, 4800);
}]);

// 119:05 topological order：一直輸出 in-degree = 0 的點（0 3 2 5 1 4）
FRAG.push(['gpeng20-topo-sort', 'Topological order：輸出 in-degree 0 的點', async (tok) => {
  fresh([0, 9.5, 9.5], [0, 0, 0.4]);
  const S = { names: ['0', '1', '2', '3', '4', '5'], pos: [[-5.2, 0], [-1.8, -2.6], [-1.8, 0], [-1.8, 2.6], [1.8, -1.3], [1.8, 1.6]], dx: 0.6, dz: -0.6,
    edges: [[0, 1], [0, 2], [0, 3], [1, 4], [2, 4], [2, 5], [3, 4], [3, 5]], dir: true };
  const g = mkG(S, { noW: true });
  const indeg = [0, 1, 1, 1, 3, 2];
  const it = S.names.map((n, i) => above(S, i, 'in ' + indeg[i], 'idx', 1.0));
  say('topological order：先後關係都保持的序列', '例：0 3 2 5 1 4（0 一定在 4 前面）');
  await beat(tok, 3400);
  const order = [0, 3, 2, 5, 1, 4];
  const why = { 0: '只有 0 的 in-degree 是 0', 3: '1、2、3 都是 0，隨便挑：選 3', 2: '剩 1、2 是 0：選 2', 5: '1、5 是 0：選 5', 1: '輸出 1', 4: '最後 4' };
  const out = [];
  for (const v of order) {
    glow(g.nodes[v], GOLD);
    say(why[v], 'output ' + v + '，刪掉它指出去的 edge');
    await beat(tok, 1700);
    g.edges.forEach((e) => { if (e.u === v && e.obj.visible) { evis(e, false); indeg[e.v]--; txt(it[e.v], 'in ' + indeg[e.v]); } });
    kill(it[v]); glow(g.nodes[v], null); tint(g.nodes[v], PC.ok);
    out.push(v);
    move(g.nodes[v], -4.5 + (out.length - 1) * 1.3, 0.3, 4.2);
    await beat(tok, 1100);
  }
  say('topological order：0 3 2 5 1 4', '每次輸出 in-degree = 0 的點');
  await beat(tok, 3000);
}]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '資料結構・第 10 章',
    title: '圖演算法：MST 與最短路徑',
    color: 'var(--ds)',
    modes: [
      { id: 'kruskal', name: 'Kruskal', enter: enterKruskal },
      { id: 'prim', name: 'Prim', enter: enterPrim },
      { id: 'dijkstra', name: 'Dijkstra', enter: enterDijkstra },
      { id: 'bellman', name: 'Bellman-Ford', enter: enterBF },
      { id: 'floyd', name: 'Floyd-Warshall', enter: enterFloyd },
    ],
    pages: [
      { id: 'cmp', name: '演算法對照', render: renderCmp },
      { id: 'quiz', name: '小測驗', render: renderQuiz },
    ],
    scenes,
    sceneOrder: ['dijkstra-explored-sets', 'dijkstra-path-trace', 'dijkstra-negative-edge', 'prim-connected-min', 'kruskal-reject-cycle', 'bellman-ford-rounds', 'bellman-ford-negative-cycle', 'floyd-warshall-ak'].concat(FRAG.map((f) => f[0])),
    stop() { clearTimeout(timer); epoch++; },
  };
}
