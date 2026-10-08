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
    fw3: { title: '3 頂點（課本例）', directed: true, names: ['0', '1', '2'],
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
    stepControls('<select id="fwG"><option value="fw3">3 頂點（課本例）</option><option value="fw4">4 頂點</option></select>');
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
