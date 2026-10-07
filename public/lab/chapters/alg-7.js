// 演算法 第7章：最短路徑（relaxation、Dijkstra、Bellman-Ford、DAG、Floyd-Warshall、Johnson）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
//
// 例子來源（跟著本章影片走）：
//  • 「Dijkstra Algorithm」(HlFsexTpM4Q)：s–a 1、s–b 3、a–b 1、a–c 10、b–c 4，explored / unexplored 與 D、P。
//  • MIT 6.006 L15：S、A～F 手動降 d（C 從 6 降到 5，經 S→B→D→C）；4,4,2,2,1,1 的鏈狀圖（指數多條路徑、壞的 relax 順序）；
//    負 cycle −6 + 2 + 3 = −1。（白板上完整的邊沒有出現在逐字稿，E、F 附近的邊是依描述補的示意。）
//  • MIT 6.006 L16：s→a 1、s→b 3、a→b 1；DAG 例子 5,3,2,6,7,4,2,−1,−2,1（= CLRS 圖 24.5）；
//    掛球示範 G–P 7、P–B 5、G–Y 19（其餘繩長為示意）；5 頂點 Dijkstra（0,10,3,∞,∞ → 0,7,3,11,5）；PQ 三種實作。
//  • MIT 6.006 L18：找到 t 就停；雙向搜尋反例 s→u→u′→t（3,3,3）vs s→w→t（5,5）；位能改權重。
//  • Abdul Bari 4.4：7 頂點 10 條邊（0,1,3,5,0,4,3）；4 頂點倒序邊（−2,8,5）；加 (2,4)=5 形成負 cycle −2。
//  • 「Bellman Ford Algorithm」(FrLWd1tJ_Wc，印地語自動字幕，只取能確定的部分)：cycle 2 + 3 − 6 = −1。
// 課本（CLRS 第 24、25 章）補充：Floyd-Warshall（圖 25.4）、Johnson 重新加權（圖 25.6）、Dijkstra 正確性。
export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const INF = Infinity;
  let timer = null, epoch = 0;
  const C = { white: '#f4efe4', gray: '#b9b2a6', black: '#55504a', edge: '#a8987c', hot: '#e8b02a', tree: '#2f7fd0', back: '#d64545', dim: '#ddd2bd', ok: '#2fc092', q: '#efe3c8', pq: '#e6c36a', purple: '#9b7ef4' };
  const MONO = { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '11px', fontWeight: '600' };
  const fmt = (x) => (x === INF ? '∞' : x === -INF ? '−∞' : x < 0 ? '−' + Math.abs(x) : String(x));

  // ───────────────────────── 圖 ─────────────────────────
  // edges: [u, v, w, bend?]
  const GRAPHS = {
    video: { title: '影片：s, a, b, c（無向）', directed: false, names: ['s', 'a', 'b', 'c'],
      pos: [[-4.5, 0], [-0.5, -2.6], [-0.5, 2.6], [4.2, 0]], edges: [[0, 1, 1], [0, 2, 3], [1, 2, 1], [1, 3, 10], [2, 3, 4]] },
    l15: { title: 'L15：S、A～F', directed: true, names: ['S', 'A', 'B', 'C', 'D', 'E', 'F'],
      pos: [[-5, 0], [-2.2, -2.3], [-2.2, 2.3], [0.8, 0], [0.8, 2.6], [1.8, -2.8], [4.8, 0.2]],
      edges: [[0, 1, 1], [0, 2, 2], [1, 3, 5], [1, 5, 2], [2, 4, 1], [4, 3, 2], [3, 5, 1], [4, 6, 5], [5, 6, 3]] },
    tri: { title: 'L16：s, a, b', directed: true, names: ['s', 'a', 'b'], pos: [[-4, 0], [0, -2.4], [3.6, 0.6]], edges: [[0, 1, 1], [0, 2, 3], [1, 2, 1]] },
    dag: { title: 'L16 DAG（CLRS 圖 24.5）', directed: true, names: ['r', 's', 't', 'x', 'y', 'z'],
      pos: [[-5.5, 0], [-3.3, 0], [-1.1, 0], [1.1, 0], [3.3, 0], [5.5, 0]],
      edges: [[0, 1, 5], [0, 2, 3, 0.3], [1, 2, 2], [1, 3, 6, -0.3], [2, 3, 7], [2, 4, 4, 0.3], [2, 5, 2, -0.26], [3, 4, -1], [3, 5, 1, 0.42], [4, 5, -2]] },
    clrs5: { title: 'L16：A～E（5 頂點）', directed: true, names: ['A', 'B', 'C', 'D', 'E'],
      pos: [[-5, 0], [-1.5, -2.4], [-1.5, 2.4], [3, -2.4], [3, 2.4]],
      edges: [[0, 1, 10], [0, 2, 3], [1, 2, 1], [1, 3, 2], [2, 1, 4], [2, 3, 8], [2, 4, 2], [3, 4, 7], [4, 3, 9]] },
    neg: { title: '負邊反例', directed: true, names: ['s', 'a', 'b', 'c'],
      pos: [[-4.5, 0], [0, -2.4], [0, 2.4], [4.5, -1.2]], edges: [[0, 1, 2], [0, 2, 3], [2, 1, -2], [1, 3, 1]] },
    bari7: { title: 'Abdul Bari：7 頂點', directed: true, names: ['1', '2', '3', '4', '5', '6', '7'],
      pos: [[-5, 0], [-1.8, -2.8], [-1.8, 0], [-1.8, 2.8], [1.8, -2.2], [1.8, 2.2], [5, 0]],
      edges: [[0, 1, 6], [0, 2, 5], [0, 3, 5], [1, 4, -1], [2, 1, -2], [2, 4, 1], [3, 2, -2], [3, 5, -1], [4, 6, 3], [5, 6, 3]] },
    bari4: { title: 'Abdul Bari：4 頂點（倒序邊）', directed: true, names: ['1', '2', '3', '4'],
      pos: [[-4.5, 0], [0, -2.6], [4.5, 0], [0, 2.6]], edges: [[2, 1, -10], [3, 2, 3], [0, 3, 5], [0, 1, 4]] },
    bari4c: { title: 'Abdul Bari：加 (2,4) = 5', directed: true, names: ['1', '2', '3', '4'],
      pos: [[-4.5, 0], [0, -2.6], [4.5, 0], [0, 2.6]], edges: [[2, 1, -10], [3, 2, 3], [0, 3, 5], [0, 1, 4], [1, 3, 5]] },
    l15neg: { title: 'L15：負 cycle（示意）', directed: true, names: ['S', 'A', 'B', 'C', 'D', 'E', 'F'],
      pos: [[-5.2, 0], [-2.6, 0], [0.2, -1.6], [3.2, -2.8], [2.8, 0.6], [5.3, 2.0], [-1.0, 2.7]],
      edges: [[0, 1, 2], [1, 2, 2], [2, 3, -6], [3, 4, 2], [4, 2, 3], [4, 5, 1], [1, 6, -2]] },
    chain: { title: 'L15：4,4,2,2,1,1 鏈狀圖', directed: true, names: ['v0', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6'],
      pos: [[-5.4, 1.0], [-3.6, -1.2], [-1.8, 1.0], [0, -1.2], [1.8, 1.0], [3.6, -1.2], [5.4, 1.0]],
      edges: [[0, 1, 4], [1, 2, 4], [2, 3, 2], [3, 4, 2], [4, 5, 1], [5, 6, 1], [0, 2, 4], [2, 4, 2], [4, 6, 1]] },
    bidir: { title: 'L18：雙向搜尋反例', directed: true, names: ['s', 'u', 'u′', 't', 'w'],
      pos: [[-5, 0], [-1.8, -2.4], [1.8, -2.4], [5, 0], [0, 2.4]], edges: [[0, 1, 3], [1, 2, 3], [2, 3, 3], [0, 4, 5], [4, 3, 5]] },
    clrs25: { title: '課本 CLRS 圖 25.4', directed: true, names: ['1', '2', '3', '4', '5'],
      pos: [[-4.6, -0.6], [-0.6, -2.8], [3.6, -0.6], [2, 2.6], [-2.6, 2.6]],
      edges: [[0, 1, 3], [0, 2, 8], [0, 4, -4], [1, 3, 1], [1, 4, 7], [2, 1, 4], [3, 0, 2], [3, 2, -5], [4, 3, 6]] },
  };

  // ───────────────────────── 共用小工具 ─────────────────────────
  async function wait(tok, ms) {
    const e = epoch;
    if (tok !== undefined) await beat(tok, ms); else await sleep(ms);
    if (e !== epoch) throw new Error('mode changed');
  }
  function fresh(cam = [0, 12.5, 8], look = [0, 0, -0.3]) {
    epoch++; clearTimeout(timer); run.gen = null; run.done = false; run.result = null;
    lab.clear(); controls(''); lab.frameCamera(cam, look);
  }
  function tag(text, cls, x, y, z) { const l = lab.label(text, cls || ''); l.position.set(x, y, z); lab.world.add(l); return l; }
  const txt = (l, t) => { l.element.textContent = t; };
  function code(lines, x, zTop, dz = 0.5) {
    const w = Math.max(...lines.map((s) => s.length));
    const ls = lines.map((s, i) => { const l = tag(s.padEnd(w, ' '), '', x, 0.3, zTop + i * dz); Object.assign(l.element.style, MONO); return l; });
    return { ls, hl(i) { ls.forEach((l, k) => { l.element.className = 'lab-label' + (k === i ? ' ptr alt' : ''); }); } };
  }
  function selectHtml(id, pairs, val) { return '<select id="' + id + '">' + pairs.map(([v, t]) => '<option value="' + v + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>'; }
  async function anim(tok, ms, fn) { const steps = Math.max(10, Math.round(ms / 70)); for (let k = 1; k <= steps; k++) { fn(k / steps); await wait(tok, ms / steps); } }

  // ───────────────────────── 畫圖 ─────────────────────────
  const NR = 0.42;
  let GR = null;
  const nm = (i) => GR.G.names[i];
  function buildGraph(G, o = {}) {
    const sc = o.scale || 1, dx = o.dx || 0, dz = o.dz || 0, ns = o.ns || 1;
    const gr = { G, n: G.names.length, nodes: [], edges: [], directed: !!G.directed, ns };
    GR = gr;
    G.names.forEach((name, i) => {
      const r = NR * ns;
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.5, 28), new THREE.MeshStandardMaterial({ color: C.white, roughness: 0.5 }));
      mesh.castShadow = true;
      mesh.add(lab.label(name, 'val'));
      const top = lab.label('', 'ptr'); top.position.set(0, 0.95, 0); top.element.style.display = 'none'; mesh.add(top);
      const bot = lab.label('', 'idx'); bot.position.set(0, 0, 0.78 * ns + 0.1); bot.element.style.display = 'none'; mesh.add(bot);
      const home = V(G.pos[i][0] * sc + dx, 0.25, G.pos[i][1] * sc + dz);
      mesh.position.copy(home);
      if (!o.noDrop) mesh.position.y = 4 + Math.random();
      const b = lab.addBody(mesh);
      if (!o.noDrop) lab.dropTo(b, home);
      gr.nodes.push({ mesh, b, top, bot, home });
    });
    G.edges.forEach(([u, v, w, bend]) => addEdge(gr, u, v, w, bend));
    computeAdj(gr);
    return gr;
  }
  function addEdge(gr, u, v, w, bend) {
    const anti = gr.directed && u !== v && gr.G.edges.some(([x, y]) => x === v && y === u);
    const e = { u, v, w, bend: bend !== undefined ? bend : anti ? 0.12 : 0, color: C.edge, thick: 1, group: null, lbl: null };
    if (w !== undefined && w !== null) e.lbl = tag(fmt(w), w < 0 ? 'ptr alt' : '', 0, 0.4, 0);
    gr.edges.push(e);
    drawEdge(gr, e);
    return e;
  }
  function drawEdge(gr, e) {
    if (e.group) { lab.world.remove(e.group); e.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: e.color, roughness: 0.6 });
    const r = 0.05 * e.thick;
    const a = gr.nodes[e.u].mesh.position, b = gr.nodes[e.v].mesh.position;
    const nr = NR * gr.ns;
    const A = V(a.x, 0.3, a.z), B = V(b.x, 0.3, b.z);
    const len = Math.max(0.01, A.distanceTo(B));
    const dir = B.clone().sub(A).normalize(), perp = V(-dir.z, 0, dir.x);
    const ctrl = A.clone().add(B).multiplyScalar(0.5).addScaledVector(perp, e.bend * len);
    const curve = new THREE.QuadraticBezierCurve3(A, ctrl, B);
    const t0 = Math.min(0.45, (nr + 0.04) / len), t1 = 1 - Math.min(0.45, (nr + (gr.directed ? 0.3 : 0.04)) / len);
    const pts = [];
    for (let k = 0; k <= 16; k++) pts.push(curve.getPoint(t0 + (t1 - t0) * k / 16));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 6, false), mat);
    tube.castShadow = true; g.add(tube);
    if (gr.directed) {
      const tan = curve.getTangent(t1).normalize();
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.13 + r, 0.32, 14), mat);
      cone.position.copy(curve.getPoint(t1)).addScaledVector(tan, 0.15);
      cone.quaternion.setFromUnitVectors(V(0, 1, 0), tan);
      g.add(cone);
    }
    const mid = curve.getPoint(0.5).addScaledVector(perp, e.bend >= 0 ? 0.32 : -0.32).setY(0.42);
    e.group = g; e.mat = mat;
    lab.world.add(g);
    if (e.lbl) e.lbl.position.copy(mid);
  }
  function computeAdj(gr) {
    gr.adj = [...Array(gr.n)].map(() => []);
    for (const e of gr.edges) {
      gr.adj[e.u].push({ e, to: e.v });
      if (!gr.directed) gr.adj[e.v].push({ e, to: e.u });
    }
    gr.adj.forEach((l) => l.sort((p, q) => p.to - q.to));
  }
  const adjOf = (u) => GR.adj[u];
  const findEdge = (u, v) => GR.edges.find((e) => (e.u === u && e.v === v) || (!GR.directed && e.u === v && e.v === u));
  function edgeColor(e, color, thick = 1) { if (!e) return; e.color = color; if (e.thick !== thick) { e.thick = thick; drawEdge(GR, e); } else e.mat.color.set(color); }
  function setW(e, w) { e.w = w; if (e.lbl) { txt(e.lbl, fmt(w)); e.lbl.element.className = 'lab-label' + (w < 0 ? ' ptr alt' : ''); } }
  function nodeColor(i, color, lift = 0) {
    const nd = GR.nodes[i];
    nd.mesh.material.color.set(color);
    lab.springTo(nd.b, nd.home.clone().add(V(0, lift, 0)));
  }
  function nodeTag(i, text, cls) {
    const t = GR.nodes[i].top;
    t.element.style.display = text ? '' : 'none';
    t.element.textContent = text || '';
    t.element.className = 'lab-label ' + (cls || 'ptr');
  }
  function nodeNote(i, text) { const t = GR.nodes[i].bot; t.element.style.display = text ? '' : 'none'; t.element.textContent = text || ''; }
  function makeStrip(x0, z, title, gap = 1.05) {
    const st = { items: new Map() };
    if (title) tag(title, 'idx', x0 - 0.95, 0.3, z);
    st.set = (list) => {
      const keep = new Set(list.map((it) => it.key));
      for (const [k, b] of st.items) if (!keep.has(k)) { lab.flyAway(b, V(0, 6, -2)); st.items.delete(k); }
      list.forEach((it, i) => {
        const pos = V(x0 + i * gap, 0.3, z);
        let b = st.items.get(it.key);
        if (!b) {
          const m = lab.box(it.color || C.q, [gap * 0.9, 0.5, 0.72]);
          m.userData.l = lab.label(it.text, 'val'); m.add(m.userData.l);
          m.position.copy(pos).setY(3.5);
          b = lab.addBody(m); lab.dropTo(b, pos); st.items.set(it.key, b);
        } else {
          lab.springTo(b, pos);
          b.obj.userData.l.element.textContent = it.text;
          if (it.color) b.obj.material.color.set(it.color);
        }
      });
    };
    return st;
  }

  // ───────────────────────── 步進框架 ─────────────────────────
  const run = { gen: null, done: false, result: null };
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
    const tick = () => { if (e !== epoch) return; const st = step(); if (st) timer = setTimeout(tick, Math.max(300, (st.ms || 1000) * 0.85)); };
    tick();
  }
  async function playGen(tok, speed = 1) { for (;;) { const st = step(); if (!st) break; await wait(tok, (st.ms || 1000) * speed); } }
  function stepControls(extra, reset) {
    controls((extra || '') + '<button class="primary" id="gStep">下一步</button><button id="gAuto">自動播放</button><button id="gReset">重來</button>');
    on('gStep', () => { clearTimeout(timer); if (!step()) log('已經結束了，按「重來」再跑一次。', true); });
    on('gAuto', autoPlay);
    on('gReset', () => { clearLog(); reset(); });
  }
  const dState = (title, d, par, extra) => [title, [...Array(GR.n).keys()].map((v) => [nm(v), fmt(d[v]) + (par && par[v] >= 0 ? '，π = ' + nm(par[v]) : '')]), extra || ''];

  // ───────────────────────── Dijkstra ─────────────────────────
  function* dijkstraGen(s, o = {}) {
    const n = GR.n, k = o.k || 1, vid = !!o.video;
    const d = Array(n).fill(INF), par = Array(n).fill(-1), inS = Array(n).fill(false), Sl = [];
    d[s] = 0;
    const D = vid ? 'D' : 'd', P = vid ? 'P' : 'π';
    const pq = makeStrip(-4.6, -4.4, vid ? 'unexplored' : 'Q');
    const ex = makeStrip(-4.6, 4.1, vid ? 'explored' : 'S');
    const tagD = (v) => { nodeTag(v, D + ' ' + fmt(d[v]), inS[v] ? 'ptr' : 'ptr alt'); nodeNote(v, par[v] >= 0 ? P + ' = ' + nm(par[v]) : ''); };
    const upd = () => {
      pq.set([...Array(n).keys()].filter((v) => !inS[v]).sort((a, b) => d[a] - d[b] || a - b).map((v) => ({ key: 'q' + v, text: nm(v) + ' ' + fmt(d[v]) })));
      ex.set(Sl.map((v) => ({ key: 's' + v, text: nm(v) + ' ' + fmt(d[v]), color: '#bfe8d6' })));
    };
    const st = (extra) => dState('Dijkstra（起點 ' + nm(s) + '）', d, par, (extra || '') + '綠 = 已確定（' + (vid ? 'explored' : 'S') + '）<br>每次取 ' + (vid ? 'unexplored' : 'Q') + ' 中 ' + D + ' 最小的');
    for (let v = 0; v < n; v++) tagD(v);
    upd();
    yield { cap: vid ? '一開始全部 unexplored：D(s) = 0，其他 ∞' : 'Initialize：d(' + nm(s) + ') = 0，其他 ∞', f: vid ? '沒有 explored 頂點，走不到 → ∞' : 'S = ∅，Q = V', ms: 1800 * k, state: st() };
    for (;;) {
      let u = -1;
      for (let v = 0; v < n; v++) if (!inS[v] && (u < 0 || d[v] < d[u])) u = v;
      if (u < 0) break;
      if (d[u] === INF) {
        yield { cap: '剩下的頂點 d = ∞：從 ' + nm(s) + ' 走不到', f: '', ms: 1500 * k, state: st() };
        break;
      }
      inS[u] = true; Sl.push(u); nodeColor(u, C.ok, 0.3); tagD(u); upd();
      if (par[u] >= 0) edgeColor(findEdge(par[u], u), C.tree, 2.2);
      yield { cap: (vid ? 'explore ' : 'Extract-Min：') + nm(u) + '（' + D + ' = ' + fmt(d[u]) + '）', f: vid ? '把 ' + D + ' 最小的移到 explored' : 'S = {' + Sl.map(nm).join(', ') + '}', ms: 1300 * k, state: st() };
      if (o.target === u) {
        yield { cap: '取出的就是目標 ' + nm(u) + ' → 直接停', f: 'δ(' + nm(s) + ', ' + nm(u) + ') = ' + fmt(d[u]) + '；其他頂點不用再處理', ms: 2600, state: st('<span class="ok">提早結束</span><br>') };
        run.result = { d, par };
        return;
      }
      for (const { e, to: v } of adjOf(u)) {
        if (inS[v] && d[u] + e.w >= d[v]) continue;
        edgeColor(e, C.hot, 1.6);
        const nd = d[u] + e.w, old = d[v];
        if (nd < old) {
          if (inS[v]) {
            d[v] = nd; tagD(v); edgeColor(e, C.back, 1.8);
            yield { cap: 'relax ' + nm(u) + '→' + nm(v) + '：' + fmt(old) + ' → ' + fmt(nd) + '，但 ' + nm(v) + ' 早已確定', f: '<span class="no">' + nm(v) + ' 不會再被取出，它的出邊不會重新 relax</span>', ms: 2400 * k, warn: true, state: st() };
            continue;
          }
          if (par[v] >= 0) { const pe = findEdge(par[v], v); if (pe && pe !== e) edgeColor(pe, C.edge, 1); }
          d[v] = nd; par[v] = u; tagD(v); upd();
          edgeColor(e, C.pq, 1.6);
          yield { cap: (vid ? '' : 'relax ') + nm(u) + ' → ' + nm(v) + '：' + fmt(d[u]) + ' + ' + fmt(e.w) + ' = ' + fmt(nd) + ' < ' + fmt(old), f: D + '(' + nm(v) + ') = ' + fmt(nd) + '，' + P + '(' + nm(v) + ') = ' + nm(u), ms: 1400 * k, state: st() };
        } else {
          yield { cap: nm(u) + ' → ' + nm(v) + '：' + fmt(d[u]) + ' + ' + fmt(e.w) + ' = ' + fmt(nd) + ' ≥ ' + fmt(old) + ' → 不更新', f: '只有更小才換', ms: 1000 * k, state: st() };
          edgeColor(e, (par[v] >= 0 && findEdge(par[v], v) === e) ? C.pq : C.edge, (par[v] >= 0 && findEdge(par[v], v) === e) ? 1.6 : 1);
        }
      }
    }
    run.result = { d, par };
    yield { cap: o.endCap || 'Q 空了：藍色邊是 shortest-path tree', f: o.endF || [...Array(n).keys()].map((v) => nm(v) + ' ' + fmt(d[v])).join('、'), ms: 2800, state: st('<span class="ok">完成</span><br>') };
  }
  function* pathTrace(t) {
    const { d, par } = run.result;
    const path = [t];
    while (par[path[0]] >= 0) path.unshift(par[path[0]]);
    for (let i = path.length - 1; i > 0; i--) {
      nodeColor(path[i], C.hot, 0.6);
      yield { cap: '沿 parent 回推：' + nm(path[i]) + ' ← ' + nm(path[i - 1]), f: '', ms: 1000 };
    }
    nodeColor(path[0], C.hot, 0.6);
    yield { cap: '最短路徑 ' + path.map(nm).join(' → '), f: 'cost = ' + fmt(d[t]), ms: 2400 };
    path.forEach((v) => nodeColor(v, C.ok, 0.3));
  }

  // ───────────────────────── Bellman-Ford ─────────────────────────
  function* bfGen(s, o = {}) {
    const n = GR.n, k = o.k || 1, E = GR.edges;
    const d = Array(n).fill(INF), par = Array(n).fill(-1);
    d[s] = 0;
    const gap = Math.min(1.15, 11.4 / E.length);
    const blocks = E.map((e, i) => {
      const m = lab.box(C.q, [gap * 0.9, 0.45, 0.7]);
      m.add(lab.label(fmt(e.w), 'val'));
      const l = lab.label('(' + nm(e.u) + ',' + nm(e.v) + ')', 'idx'); l.position.set(0, 0, 0.62); m.add(l);
      m.position.set(-5.7 + gap / 2 + i * gap, 0.23, -4.5); lab.world.add(m);
      return m;
    });
    const pass = tag('第 0 輪', 'ptr alt', -5.6, 0.3, 4.2);
    const tagD = (v) => nodeTag(v, fmt(d[v]), d[v] === -INF ? 'ptr alt' : 'ptr');
    for (let v = 0; v < n; v++) tagD(v);
    nodeColor(s, C.ok, 0.3);
    const st = (extra) => dState('Bellman-Ford（起點 ' + nm(s) + '）', d, par, (extra || '') + '每輪依序 relax 全部 ' + E.length + ' 條邊，共 V − 1 = ' + (n - 1) + ' 輪');
    yield { cap: '起點 ' + nm(s) + ' = 0，其他 ∞；邊的順序如後方所列', f: 'V = ' + n + ' → 做 ' + (n - 1) + ' 輪', ms: 2000 * k, state: st() };
    let converged = false;
    for (let i = 1; i <= n - 1; i++) {
      txt(pass, '第 ' + i + ' 輪');
      let changed = false;
      for (let j = 0; j < E.length; j++) {
        const e = E[j];
        blocks[j].material.color.set(C.hot); edgeColor(e, C.hot, 1.6);
        if (d[e.u] !== INF && d[e.u] + e.w < d[e.v]) {
          const old = d[e.v];
          if (par[e.v] >= 0) { const pe = findEdge(par[e.v], e.v); if (pe !== e) edgeColor(pe, C.edge, 1); }
          d[e.v] = d[e.u] + e.w; par[e.v] = e.u; changed = true; tagD(e.v);
          nodeColor(e.v, C.pq, 0.35);
          yield { cap: '第 ' + i + ' 輪 (' + nm(e.u) + ',' + nm(e.v) + ')：' + fmt(d[e.u]) + ' + ' + fmt(e.w) + ' = ' + fmt(d[e.v]) + ' < ' + fmt(old), f: '更新 ' + nm(e.v) + ' = ' + fmt(d[e.v]), ms: 1300 * k, state: st() };
          nodeColor(e.v, C.white, 0);
          edgeColor(e, C.tree, 2);
        } else {
          yield { cap: '第 ' + i + ' 輪 (' + nm(e.u) + ',' + nm(e.v) + ')：' + (d[e.u] === INF ? nm(e.u) + ' 還是 ∞ → 不變' : fmt(d[e.u]) + ' + ' + fmt(e.w) + ' = ' + fmt(d[e.u] + e.w) + ' ≥ ' + fmt(d[e.v])), f: '', ms: 420 * k, state: st() };
          edgeColor(e, par[e.v] === e.u && findEdge(e.u, e.v) === e ? C.tree : C.edge, par[e.v] === e.u && findEdge(e.u, e.v) === e ? 2 : 1);
        }
        blocks[j].material.color.set(C.q);
      }
      if (!changed) {
        converged = true;
        yield { cap: '第 ' + i + ' 輪沒有任何更新 → 已收斂', f: '之後的輪也不會變（程式照樣跑滿 V − 1 輪）', ms: 2200 * k, state: st() };
        break;
      }
    }
    if (converged) {
      run.result = { d, par, neg: false };
      yield { cap: '結果：' + [...Array(n).keys()].map((v) => nm(v) + '→' + fmt(d[v])).join('、'), f: 'O(VE)；有負邊也正確', ms: 3000, state: st('<span class="ok">完成，沒有負 cycle</span><br>') };
      return;
    }
    txt(pass, '檢查輪');
    yield { cap: '做完 V − 1 輪；再把全部邊檢查一次', f: '還能 relax → 有負權重 cycle', ms: 1800 * k, state: st() };
    const bad = [];
    for (let j = 0; j < E.length; j++) {
      const e = E[j];
      blocks[j].material.color.set(C.hot);
      if (d[e.u] !== INF && d[e.u] + e.w < d[e.v]) {
        bad.push(e); edgeColor(e, C.back, 2.4); blocks[j].material.color.set(C.back);
        yield { cap: '(' + nm(e.u) + ',' + nm(e.v) + ')：' + fmt(d[e.u]) + ' + ' + fmt(e.w) + ' = ' + fmt(d[e.u] + e.w) + ' < ' + fmt(d[e.v]) + ' 還在變！', f: '<span class="no">有負權重 cycle</span>', ms: 2000 * k, warn: true, state: st() };
      } else {
        blocks[j].material.color.set(C.q);
        yield { cap: '(' + nm(e.u) + ',' + nm(e.v) + ')：不能 relax', f: '', ms: 380 * k, state: st() };
      }
    }
    if (!bad.length) {
      run.result = { d, par, neg: false };
      yield { cap: '檢查輪沒有變化 → 沒有負 cycle', f: '結果：' + [...Array(n).keys()].map((v) => nm(v) + '→' + fmt(d[v])).join('、'), ms: 3000, state: st('<span class="ok">完成</span><br>') };
      return;
    }
    if (o.markInf) {
      const seen = new Set(bad.map((e) => e.v)), stk = [...seen];
      while (stk.length) { const u = stk.pop(); for (const { to } of adjOf(u)) if (!seen.has(to)) { seen.add(to); stk.push(to); } }
      for (const v of seen) { d[v] = -INF; tagD(v); nodeColor(v, C.back, 0.3); }
      run.result = { d, par, neg: true };
      yield { cap: '走得到那個 cycle 的頂點：δ = −∞', f: '其他頂點的 δ 照樣有定義', ms: 3200, state: st('<span class="no">有負 cycle</span><br>') };
      return;
    }
    run.result = { d, par, neg: true };
    yield { cap: 'Bellman-Ford 回報：有負權重 cycle，無解', f: '但它能偵測出來', ms: 3000, state: st('<span class="no">有負 cycle</span><br>') };
  }

  // ───────────────────────── DAG shortest paths ─────────────────────────
  function* dagGen(s, o = {}) {
    const n = GR.n, k = o.k || 1;
    const d = Array(n).fill(INF), par = Array(n).fill(-1);
    d[s] = 0;
    const tagD = (v) => nodeTag(v, fmt(d[v]), 'ptr');
    for (let v = 0; v < n; v++) tagD(v);
    const st = (extra) => dState('DAG shortest paths（起點 ' + nm(s) + '）', d, par, (extra || '') + '已依 topological 順序由左到右排好<br>每個頂點只處理一次 → Θ(V + E)');
    yield { cap: '已經 topological sort：由左到右', f: '起點 ' + nm(s) + ' = 0，其他 ∞', ms: 2000 * k, state: st() };
    for (let u = 0; u < n; u++) {
      nodeColor(u, C.hot, 0.4);
      if (d[u] === INF) {
        yield { cap: nm(u) + '：d = ∞（在起點左邊，走不到）→ 跳過', f: '', ms: 1300 * k, state: st() };
        nodeColor(u, C.dim, 0); continue;
      }
      yield { cap: '處理 ' + nm(u) + '（d = ' + fmt(d[u]) + '）：relax 它的每條出邊', f: '', ms: 1100 * k, state: st() };
      for (const { e, to: v } of adjOf(u)) {
        edgeColor(e, C.hot, 1.6);
        const nd = d[u] + e.w;
        if (nd < d[v]) {
          const old = d[v];
          if (par[v] >= 0) edgeColor(findEdge(par[v], v), C.edge, 1);
          d[v] = nd; par[v] = u; tagD(v); edgeColor(e, C.tree, 2);
          yield { cap: nm(u) + ' → ' + nm(v) + '：' + fmt(d[u]) + ' + ' + fmt(e.w) + ' = ' + fmt(nd) + ' < ' + fmt(old), f: '更新', ms: 1300 * k, state: st() };
        } else {
          yield { cap: nm(u) + ' → ' + nm(v) + '：' + fmt(nd) + ' ≥ ' + fmt(d[v]) + ' → 不更新', f: '', ms: 1000 * k, state: st() };
          edgeColor(e, C.edge, 1);
        }
      }
      nodeColor(u, C.ok, 0);
    }
    run.result = { d, par };
    yield { cap: '最終：' + [...Array(n).keys()].map((v) => nm(v) + ' ' + fmt(d[v])).join('、'), f: '可有負邊（不能有 cycle）；DP 的最簡單例子', ms: 3000, state: st('<span class="ok">完成</span><br>') };
  }

  // ───────────────────────── Floyd-Warshall ─────────────────────────
  function* floydGen(o = {}) {
    const n = GR.n, k0 = o.k || 1;
    const D = [...Array(n)].map((_, i) => [...Array(n)].map((_, j) => (i === j ? 0 : INF)));
    GR.edges.forEach((e) => { D[e.u][e.v] = e.w; });
    const mx = (j) => 1.4 + j * 1.0, mz = (i) => -2.6 + i * 0.95;
    for (let i = 0; i < n; i++) { tag(nm(i), 'idx', 0.6, 0.3, mz(i)); tag(nm(i), 'idx', mx(i), 0.3, -3.5); }
    const kl = tag('D⁽⁰⁾', 'ptr alt', 3.4, 0.3, -4.4);
    const cells = D.map((row, i) => row.map((v, j) => {
      const m = lab.box('#efe6d2', [0.9, 0.18, 0.85]); m.position.set(mx(j), 0.09, mz(i)); m.userData.l = lab.label(fmt(v), 'val'); m.add(m.userData.l); lab.world.add(m); return m;
    }));
    const paint = (kk) => cells.forEach((row, i) => row.forEach((m, j) => m.material.color.set(i === kk || j === kk ? '#f3dfa8' : '#efe6d2')));
    const st = (kk) => ['Floyd-Warshall', [['目前', kk < 0 ? 'D⁽⁰⁾ = 權重矩陣' : 'k = ' + nm(kk) + '：允許經過 ' + GR.G.names.slice(0, kk + 1).join(', ')]], 'd⁽ᵏ⁾ᵢⱼ = min(d⁽ᵏ⁻¹⁾ᵢⱼ, d⁽ᵏ⁻¹⁾ᵢₖ + d⁽ᵏ⁻¹⁾ₖⱼ)<br>三層迴圈、k 在最外層：Θ(V³)'];
    yield { cap: 'D⁽⁰⁾：直接相連的權重，沒有邊就是 ∞', f: '對角線 = 0', ms: 2200 * k0, state: st(-1) };
    for (let kk = 0; kk < n; kk++) {
      txt(kl, 'D⁽' + (kk + 1) + '⁾'); paint(kk); nodeColor(kk, C.hot, 0.5);
      yield { cap: 'k = ' + nm(kk) + '：多允許經過頂點 ' + nm(kk), f: '第 ' + nm(kk) + ' 列、第 ' + nm(kk) + ' 行不會變', ms: 1500 * k0, state: st(kk) };
      let ch = 0;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        if (i === kk || j === kk || i === j) continue;
        const via = D[i][kk] + D[kk][j];
        if (via < D[i][j]) {
          const old = D[i][j]; D[i][j] = via; ch++;
          const m = cells[i][j]; m.material.color.set(C.ok); txt(m.userData.l, fmt(via));
          yield { cap: nm(i) + '→' + nm(j) + '：經過 ' + nm(kk) + ' = ' + fmt(D[i][kk]) + ' + ' + fmt(D[kk][j]) + ' = ' + fmt(via) + ' < ' + fmt(old), f: 'd' + nm(i) + nm(j) + ' 更新為 ' + fmt(via), ms: 1150 * k0, state: st(kk) };
        }
      }
      if (!ch) yield { cap: 'k = ' + nm(kk) + '：沒有任何格子變小', f: '', ms: 1000 * k0, state: st(kk) };
      nodeColor(kk, C.white, 0);
    }
    paint(-1);
    run.result = { D };
    yield { cap: 'D⁽' + n + '⁾ 就是所有點對的最短距離', f: '有負邊可以；對角線出現負數 → 有負 cycle', ms: 3200, state: st(n - 1) };
  }

  // ───────────────────────── 互動模式 ─────────────────────────
  const M = { djKey: 'clrs5', djSrc: 0, djTgt: -1, bfKey: 'bari7', dagSrc: 1, fwKey: 'clrs25' };
  function enterDijkstra() {
    fresh();
    const G = GRAPHS[M.djKey];
    if (M.djSrc >= G.names.length) M.djSrc = 0;
    if (M.djTgt >= G.names.length) M.djTgt = -1;
    buildGraph(G);
    run.gen = (function* () {
      yield* dijkstraGen(M.djSrc, { video: M.djKey === 'video', target: M.djTgt >= 0 ? M.djTgt : undefined });
      if (M.djTgt >= 0 && run.result) yield* pathTrace(M.djTgt);
    })();
    run.done = false;
    stepControls(selectHtml('jG', [['clrs5', 'L16 A～E'], ['video', '影片 s,a,b,c'], ['l15', 'L15 S～F'], ['neg', '負邊反例']], M.djKey)
      + '起點 ' + selectHtml('jS', G.names.map((x, i) => [i, x]), M.djSrc)
      + '目標 ' + selectHtml('jT', [[-1, '全部'], ...G.names.map((x, i) => [i, x])], M.djTgt), enterDijkstra);
    $('jG').onchange = (e) => { M.djKey = e.target.value; M.djSrc = 0; M.djTgt = -1; clearLog(); enterDijkstra(); };
    $('jS').onchange = (e) => { M.djSrc = Number(e.target.value); clearLog(); enterDijkstra(); };
    $('jT').onchange = (e) => {
      const t = Number(e.target.value);
      if (t === M.djSrc) { log('目標不能等於起點：距離就是 0，不用跑。', true); e.target.value = String(M.djTgt); return; }
      M.djTgt = t; clearLog(); enterDijkstra();
    };
    log('Dijkstra：每次從 Q 取出 d 最小的頂點（它的距離已確定），relax 它的出邊。權重必須 ≥ 0。');
    if (M.djKey === 'neg') log('這張圖有負邊 b → a = −2：看看 Dijkstra 哪裡出錯。', true);
    setState('Dijkstra', [['圖', G.title], ['起點', G.names[M.djSrc]], ['目標', M.djTgt >= 0 ? G.names[M.djTgt] : '全部']], '按「下一步」開始');
  }
  function enterBF() {
    fresh();
    const G = GRAPHS[M.bfKey];
    buildGraph(G);
    run.gen = bfGen(0, { markInf: M.bfKey === 'l15neg' }); run.done = false;
    stepControls(selectHtml('fG', [['bari7', 'Bari 7 頂點'], ['bari4', 'Bari 4 頂點'], ['bari4c', 'Bari 4 頂點 + (2,4)'], ['l15neg', 'L15 負 cycle'], ['clrs25', 'CLRS 25.4']], M.bfKey), enterBF);
    $('fG').onchange = (e) => { M.bfKey = e.target.value; clearLog(); enterBF(); };
    log('Bellman-Ford：把全部邊依固定順序 relax，做 V − 1 輪；再檢查一輪偵測負 cycle。');
    setState('Bellman-Ford', [['圖', G.title], ['V, E', G.names.length + ', ' + G.edges.length]], '按「下一步」開始');
  }
  function enterDAG() {
    fresh();
    buildGraph(GRAPHS.dag);
    run.gen = dagGen(M.dagSrc); run.done = false;
    stepControls('起點 ' + selectHtml('aS', GRAPHS.dag.names.map((x, i) => [i, x]), M.dagSrc), enterDAG);
    $('aS').onchange = (e) => { M.dagSrc = Number(e.target.value); clearLog(); enterDAG(); };
    log('DAG：先 topological sort，再由左到右 relax 每個頂點的出邊。負邊沒問題。');
    setState('DAG shortest paths', [['圖', GRAPHS.dag.title], ['起點', GRAPHS.dag.names[M.dagSrc]]], '按「下一步」開始');
  }
  function enterFloyd() {
    fresh([0, 12.5, 8], [0.2, 0, -0.3]);
    buildGraph(GRAPHS[M.fwKey], { scale: 0.6, dx: -3.4, dz: 0.4 });
    run.gen = floydGen(); run.done = false;
    stepControls(selectHtml('wG', [['clrs25', 'CLRS 25.4（有負邊）'], ['clrs5', 'L16 A～E']], M.fwKey), enterFloyd);
    $('wG').onchange = (e) => { M.fwKey = e.target.value; clearLog(); enterFloyd(); };
    log('Floyd-Warshall：all-pairs；第 k 輪允許路徑經過前 k 個頂點。k 一定在最外層迴圈。');
    setState('Floyd-Warshall', [['圖', GRAPHS[M.fwKey].title]], '按「下一步」開始');
  }
  // relax 實驗：L15 的鏈狀圖，自己挑邊 relax
  const RX = { d: [], cnt: 0 };
  function enterRelax() {
    fresh();
    buildGraph(GRAPHS.chain);
    RX.d = Array(GR.n).fill(INF); RX.d[0] = 0; RX.cnt = 0; RX.par = Array(GR.n).fill(-1);
    for (let v = 0; v < GR.n; v++) nodeTag(v, fmt(RX.d[v]));
    controls(selectHtml('xE', GR.edges.map((e, i) => [i, nm(e.u) + '→' + nm(e.v) + '（' + e.w + '）']), 0)
      + '<button class="primary" id="xR">relax 這條邊</button><button id="xBad">壞順序走一步</button><button id="xTopo">依 topological 順序全部 relax</button><button id="xReset">重來</button>');
    on('xR', () => relaxEdge(Number($('xE').value)));
    on('xBad', () => {
      const cand = GR.edges.map((e, i) => i).filter((i) => { const e = GR.edges[i]; return RX.d[e.u] !== INF && RX.d[e.u] + e.w < RX.d[e.v]; });
      if (!cand.length) { log('已經沒有任何邊能 relax：全部 d = δ。', true); return; }
      // 壞順序：先 relax 最靠後面的邊，讓後面的頂點一次只降一點點
      cand.sort((a, b) => GR.edges[b].v - GR.edges[a].v || GR.edges[b].u - GR.edges[a].u);
      relaxEdge(cand[0]);
    });
    on('xTopo', () => { for (let u = 0; u < GR.n; u++) adjOf(u).forEach(({ e }) => relaxEdge(GR.edges.indexOf(e), true)); log('依 topological 順序每條邊只 relax 一次就全部正確（這是 DAG）。'); });
    on('xReset', () => { clearLog(); enterRelax(); });
    log('L15 的鏈狀圖：每個頂點都有「兩條路二選一」。先按「壞順序走一步」數次，看 v6 怎麼一點一點降。');
    relaxState();
  }
  function relaxEdge(i, quiet) {
    const e = GR.edges[i];
    if (RX.d[e.u] === INF) { if (!quiet) log(nm(e.u) + ' 的 d 還是 ∞：沒有路可以延伸，relax 不會改變任何東西。', true); return; }
    const nd = RX.d[e.u] + e.w;
    if (nd >= RX.d[e.v]) { if (!quiet) log(nm(e.u) + '→' + nm(e.v) + '：' + RX.d[e.u] + ' + ' + e.w + ' = ' + nd + ' ≥ ' + fmt(RX.d[e.v])+ '，不會更新。', true); return; }
    const old = RX.d[e.v];
    RX.d[e.v] = nd; RX.cnt++;
    if (RX.par[e.v] >= 0) edgeColor(findEdge(RX.par[e.v], e.v), C.edge, 1);
    RX.par[e.v] = e.u; edgeColor(e, C.tree, 2);
    nodeTag(e.v, fmt(nd)); nodeColor(e.v, C.pq, 0.35); const ep = epoch; setTimeout(() => { if (ep === epoch) nodeColor(e.v, C.white, 0); }, 500);
    log('relax ' + nm(e.u) + '→' + nm(e.v) + '：' + fmt(old) + ' → ' + nd);
    relaxState();
  }
  function relaxState() {
    setState('Relax 實驗', [['relax 次數', String(RX.cnt)], ...RX.d.map((x, v) => [nm(v), fmt(x)])], '正確答案：v6 = 7<br>壞的順序：v6 一點一點降；n 個頂點時可能要 2^(n/2) 次');
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  let qs = { score: 0, total: 0 };
  const rnd = (n) => Math.floor(Math.random() * n);
  const LET = 'ABCDEF';
  function randW(n, m, neg) {
    const E = []; let g = 0;
    while (E.length < m && g++ < 300) {
      const u = rnd(n), v = rnd(n);
      if (u === v || E.some(([a, b]) => (a === u && b === v) || (a === v && b === u))) continue;
      const lo = neg && u < v ? -3 : 1;
      E.push(neg ? (u < v ? [u, v, lo + rnd(9)] : [v, u, 1 + rnd(8)]) : [u, v, 1 + rnd(9)]);
    }
    return E;
  }
  function sp(n, E, s) { const d = Array(n).fill(INF); d[s] = 0; for (let i = 0; i < n - 1; i++) E.forEach(([u, v, w]) => { if (d[u] + w < d[v]) d[v] = d[u] + w; }); return d; }
  const es = (E) => E.map(([u, v, w]) => LET[u] + '→' + LET[v] + '(' + fmt(w) + ')').join('、');
  function genQ() {
    const t = rnd(6);
    if (t === 0) {
      const n = 5, E = randW(n, 7, false), d = sp(n, E, 0);
      const tg = 1 + rnd(n - 1); if (d[tg] === INF) return genQ();
      const direct = E.find(([u, v]) => u === 0 && v === tg);
      const opts = [...new Set([d[tg], direct ? direct[2] : d[tg] + 2, d[tg] + 1, d[tg] + 3, d[tg] + 4])].filter((x) => x !== INF).slice(0, 4).map(fmt);
      return { q: '有向圖：' + es(E) + '\nDijkstra 從 A 出發，δ(A, ' + LET[tg] + ') = ？', opts, ans: fmt(d[tg]), why: '最短距離：' + d.map((x, i) => LET[i] + '=' + fmt(x)).join('、') + '。' };
    }
    if (t === 1) {
      const n = 4, E = randW(n, 5, true);
      const d = Array(n).fill(INF); d[0] = 0;
      E.forEach(([u, v, w]) => { if (d[u] + w < d[v]) d[v] = d[u] + w; });
      const tg = 1 + rnd(n - 1);
      const final = sp(n, E, 0)[tg];
      const opts = [...new Set([fmt(d[tg]), fmt(final), '∞', fmt(final === INF ? 0 : final + 1), '0'])].slice(0, 4);
      if (!opts.includes(fmt(d[tg]))) opts[0] = fmt(d[tg]);
      return { q: '邊依序為：' + es(E) + '\nBellman-Ford 從 A 出發，第 1 輪（依上面順序各 relax 一次）結束後 d(' + LET[tg] + ') = ？', opts, ans: fmt(d[tg]), why: '第 1 輪後：' + d.map((x, i) => LET[i] + '=' + fmt(x)).join('、') + '；邊的順序會影響每輪的中間結果（最後答案 ' + fmt(final) + '）。' };
    }
    if (t === 2) {
      const n = 3, W = [...Array(n)].map((_, i) => [...Array(n)].map((_, j) => (i === j ? 0 : rnd(4) ? 1 + rnd(9) : INF)));
      const D1 = W.map((r, i) => r.map((v, j) => Math.min(v, W[i][0] + W[0][j])));
      const i = 1, j = 2;
      const opts = [...new Set([fmt(D1[i][j]), fmt(W[i][j]), fmt(W[i][0] + W[0][j]), fmt(D1[i][j] + 1), '∞'])].slice(0, 4);
      if (!opts.includes(fmt(D1[i][j]))) opts[0] = fmt(D1[i][j]);
      return { q: 'Floyd-Warshall，D⁽⁰⁾（列 = 起點 1,2,3）：\n' + W.map((r) => r.map(fmt).join('  ')).join('\n') + '\n允許經過頂點 1 之後，d⁽¹⁾₂₃ = ？', opts, ans: fmt(D1[i][j]), why: 'min(d₂₃, d₂₁ + d₁₃) = min(' + fmt(W[1][2]) + ', ' + fmt(W[1][0]) + ' + ' + fmt(W[0][2]) + ') = ' + fmt(D1[i][j]) + '。' };
    }
    if (t === 3) {
      const a = 1 + rnd(5), b = 1 + rnd(5), c = -(a + b) + rnd(5) - 2;
      const s = a + b + c;
      return { q: '一個 cycle 的三條邊權重是 ' + a + '、' + b + '、' + fmt(c) + '。它是負權重 cycle 嗎？', opts: ['是，總和 ' + fmt(s), '不是，總和 ' + fmt(s), '是，因為有負邊', '不是，cycle 不影響最短路徑'], ans: (s < 0 ? '是，總和 ' : '不是，總和 ') + fmt(s), why: '看整圈總和：' + a + ' + ' + b + ' + (' + fmt(c) + ') = ' + fmt(s) + '；有負邊不代表有負 cycle。' };
    }
    const bank = [
      { q: '用 binary heap 的 Dijkstra 時間？', a: 'O((V + E) log V)', d: ['O(V²)', 'O(VE)', 'O(V log V + E)'] },
      { q: '用 Fibonacci heap 的 Dijkstra 時間？', a: 'O(V log V + E)', d: ['O((V + E) log V)', 'O(V²)', 'O(E log E)'] },
      { q: 'DAG 上的單源最短路徑時間？', a: 'Θ(V + E)', d: ['Θ(V log V + E)', 'Θ(VE)', 'Θ(V³)'] },
      { q: 'Dijkstra 為什麼不能有負權重邊？', a: '頂點取出後就不再處理，負邊可能之後才讓它變短', d: ['負數不能放進 heap', '會形成無窮迴圈', '只能用在無向圖'] },
      { q: 'Johnson 演算法重新加權 ŵ(u,v) = w(u,v) + h(u) − h(v)，h 是？', a: '新增起點 s（到每點權重 0）跑 Bellman-Ford 得到的 δ(s, v)', d: ['每個頂點的 out-degree', '隨便選的常數', 'Dijkstra 從頂點 1 算出的距離'] },
      { q: 'Relaxation 的安全性引理保證？', a: '任何時候 d(v) ≥ δ(s, v)', d: ['每條邊只 relax 一次', 'd(v) 每次都會變小', '一定 V 輪內結束'] },
      { q: '雙向 Dijkstra 在某頂點兩邊都被取出時停止，最短距離是？', a: 'min over x of d_f(x) + d_b(x)', d: ['d_f(w) + d_b(w)，w 是停止的那個頂點', 'd_f(t)', 'd_b(s)'] },
      { q: 'Floyd-Warshall 的時間與空間？', a: 'Θ(V³) 時間、Θ(V²) 空間', d: ['Θ(V²) 時間、Θ(V) 空間', 'Θ(VE) 時間', 'Θ(V³) 時間、Θ(V³) 空間（一定要存每一層）'] },
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

  // ───────────────────────── 跟著影片的場景 ─────────────────────────
  // ─── HlFsexTpM4Q：Dijkstra（explored / unexplored） ───
  async function scDijVideoSets(tok) {
    fresh();
    buildGraph(GRAPHS.video);
    say('s 到 b：直接走 3，經過 a 只要 1 + 1 = 2', '每個頂點記 D（距離）與 P（parent）');
    await wait(tok, 3000);
    run.gen = dijkstraGen(0, { video: true, k: 0.9, endCap: '全部 explored：演算法結束', endF: 's 0、a 1、b 2、c 6' });
    await playGen(tok);
  }
  async function scDijVideoPath(tok) {
    fresh();
    buildGraph(GRAPHS.video, { noDrop: true });
    run.gen = dijkstraGen(0, { video: true });
    while (step()) { /* 快轉到結束 */ }
    say('跑完之後每個頂點都有 D 和 P', 's 0、a 1、b 2、c 6');
    await wait(tok, 2400);
    for (const t of [1, 2, 3]) {
      run.gen = pathTrace(t); run.done = false;
      await playGen(tok, 0.9);
      GR.nodes.forEach((_, v) => nodeColor(v, C.ok, 0.3));
    }
    say('c ← b ← a ← s：反過來就是最短路徑', 's → a → b → c，cost 6');
    await wait(tok, 3000);
  }

  // ─── Aa2sqUhIn-E：MIT L15 ───
  async function scCompare(tok) {
    fresh([0, 9, 11], [0, 0.6, -0.6]);
    const R = [
      ['BFS', '權重都相同（邊數）', 'O(V + E)', '#9a9a9a'],
      ['DAG + topo', '無 cycle，可有負邊', 'O(V + E)', '#2fc092'],
      ['Dijkstra', '權重 ≥ 0', 'O(V log V + E)', '#4b9ee2'],
      ['Bellman-Ford', '可有負邊、偵測負 cycle', 'O(VE)', '#dd8238'],
      ['Floyd-Warshall', 'all pairs，可有負邊', 'O(V³)', '#9b7ef4'],
      ['Johnson', 'all pairs、稀疏圖', 'O(VE + V² log V)', '#e55a9b'],
    ];
    say('最短路徑：依圖的條件挑演算法', '');
    await wait(tok, 1800);
    for (let i = 0; i < R.length; i++) {
      const [a, b, c, col] = R[i];
      const z = -3.6 + i * 1.3;
      const m = lab.box(col, [3.2, 0.5, 1.0]); m.add(lab.label(a, 'val'));
      m.position.set(-3.8, 4, z); lab.dropTo(lab.addBody(m), V(-3.8, 0.25, z));
      tag(b, 'ptr', 0.6, 0.3, z); tag(c, 'ptr alt', 4.6, 0.3, z);
      say(a + '：' + b, c);
      await wait(tok, 1700);
    }
    say('能用 Dijkstra 就用；有負邊才用 Bellman-Ford', '複雜度都不含權重大小 W');
    await wait(tok, 3400);
  }
  async function scExpPaths(tok) {
    fresh();
    buildGraph(GRAPHS.chain);
    say('一個 path 是一串相連的邊，權重 = 邊權重總和', '每一段都有兩條路可選');
    await wait(tok, 2600);
    const cnt = [1, 1, 2, 2, 4, 4, 8];
    for (let v = 0; v < GR.n; v++) { nodeTag(v, cnt[v] + ' 條'); nodeColor(v, C.pq, 0.3); await wait(tok, 600); nodeColor(v, C.white, 0); }
    say('到 v6 已經有 8 條路徑', '每多一段 ×2：指數多條');
    // 逐一亮出 8 條 v0 → v6 的路徑
    const paths = [];
    const rec = (u, acc) => { if (u === 6) { paths.push(acc); return; } adjOf(u).forEach(({ e, to }) => rec(to, [...acc, e])); };
    rec(0, []);
    for (const p of paths) {
      p.forEach((e) => edgeColor(e, C.hot, 2));
      const w = p.reduce((s, e) => s + e.w, 0);
      say('路徑權重 = ' + p.map((e) => e.w).join(' + ') + ' = ' + w, '');
      await wait(tok, 900);
      p.forEach((e) => edgeColor(e, C.edge, 1));
    }
    say('不能一條一條列舉：要靠 optimal substructure', '複雜度不含權重值 W（W 可以大到 2⁶⁴）');
    await wait(tok, 3200);
  }
  async function scRelaxSAF(tok) {
    fresh();
    buildGraph(GRAPHS.l15);
    for (let v = 0; v < GR.n; v++) nodeTag(v, v ? '∞' : '0');
    say('δ(u, v)：所有 u→v 路徑的最小權重；沒路就是 ∞', '一開始 d(S) = 0，其他 ∞');
    await wait(tok, 3000);
    const d = [0, INF, INF, INF, INF, INF, INF], par = Array(7).fill(-1);
    const rx = async (u, v, cap, f) => {
      const e = findEdge(u, v);
      edgeColor(e, C.hot, 1.8);
      await wait(tok, 600);
      if (par[v] >= 0) edgeColor(findEdge(par[v], v), C.dim, 1);
      d[v] = d[u] + e.w; par[v] = u; nodeTag(v, String(d[v])); nodeNote(v, 'π = ' + nm(u)); nodeColor(v, C.pq, 0.35);
      edgeColor(e, C.tree, 2.2);
      say(cap, f); await wait(tok, 1800); nodeColor(v, C.white, 0);
    };
    await rx(0, 1, '從 S 出發：A 標 1', 'π(A) = S');
    await rx(0, 2, 'B 標 2', '');
    await rx(1, 3, '從 A 出發：C 標 1 + 5 = 6', '');
    await rx(2, 4, '從 B 出發：D 標 2 + 1 = 3', '');
    say('δ(S, C) 真的是 6 嗎？', '');
    await wait(tok, 1800);
    await rx(4, 3, 'S → B → D → C 只要 5！', '邊數多的路，權重反而小');
    await rx(1, 5, '從 A 到 E：1 + 2 = 3', 'π(E) = A，π(A) = S');
    await rx(5, 6, 'F = 3 + 3 = 6', '');
    say('沿 π 回推就是路徑：E ← A ← S', 'd 會一路降到 δ');
    await wait(tok, 3000);
  }
  async function scNegCycle(tok) {
    fresh();
    buildGraph(GRAPHS.l15neg);
    say('負權重 cycle：B → C → D → B', '−6 + 2 + 3 = −1，每繞一圈少 1');
    for (const [u, v] of [[2, 3], [3, 4], [4, 2]]) edgeColor(findEdge(u, v), C.back, 2);
    await wait(tok, 3200);
    for (const [u, v] of [[2, 3], [3, 4], [4, 2]]) edgeColor(findEdge(u, v), C.edge, 1);
    run.gen = bfGen(0, { markInf: true, k: 0.42 });
    await playGen(tok);
    say('δ(S, A) = 2、δ(S, F) = 0 照樣有定義', '麻煩的是負 cycle，不是負邊（A → F 是 −2）');
    await wait(tok, 3400);
  }
  async function scGenericRelax(tok) {
    fresh([0, 12.5, 8], [0.5, 0, -0.3]);
    buildGraph(GRAPHS.l15, { scale: 0.68, dx: 2.6, dz: -0.6 });
    const cd = code(['Initialize：d(v) = ∞, π(v) = NIL', '          d(s) = 0', 'repeat', '  挑一條邊 (u, v)', '  Relax(u, v, w):', '    if d(v) > d(u) + w(u, v):', '      d(v) = d(u) + w(u, v)', '      π(v) = u', 'until 沒有邊能 relax'], -3.8, -3.0, 0.62);
    const d = Array(GR.n).fill(INF); d[0] = 0;
    for (let v = 0; v < GR.n; v++) nodeTag(v, fmt(d[v]));
    cd.hl(0);
    say('通用結構：初始化，然後一直挑邊 relax', '怎麼挑邊 = 哪一個演算法');
    await wait(tok, 2800);
    const order = [[0, 1], [1, 3], [0, 2], [2, 4], [4, 3], [1, 5], [3, 5], [4, 6], [5, 6]];
    let cnt = 0;
    for (const [u, v] of order) {
      const e = findEdge(u, v);
      cd.hl(3); edgeColor(e, C.hot, 1.8);
      await wait(tok, 500);
      cd.hl(5);
      const nd = d[u] + e.w;
      if (nd < d[v]) {
        const old = d[v]; d[v] = nd; cnt++;
        cd.hl(6); nodeTag(v, fmt(nd)); nodeNote(v, 'π = ' + nm(u)); edgeColor(e, C.tree, 2);
        say('Relax ' + nm(u) + '→' + nm(v) + '：' + fmt(old) + ' > ' + d[u] + ' + ' + e.w + ' → ' + nd, (u === 4 && v === 3) ? 'd(C) = 6 > d(D) + 2 = 5：改成 5，π(C) = D' : 'π(' + nm(v) + ') = ' + nm(u));
        await wait(tok, 1700);
      } else {
        say(nm(u) + '→' + nm(v) + '：' + fmt(d[v]) + ' ≤ ' + d[u] + ' + ' + e.w + '，不用改', '');
        edgeColor(e, C.edge, 1);
        await wait(tok, 1100);
      }
    }
    cd.hl(8);
    say('所有邊都滿足 d(v) ≤ d(u) + w(u, v) → 停', '這個順序剛好不錯；亂挑可能很慢');
    await wait(tok, 3200);
  }
  async function scBadOrder(tok) {
    fresh();
    buildGraph(GRAPHS.chain);
    const d = Array(GR.n).fill(INF); d[0] = 0;
    const cnt = tag('relax 0 次', 'ptr alt', -5.4, 0.3, 4.0);
    let c = 0;
    const show6 = tag('v6：', 'ptr', 3.8, 0.3, 4.0);
    const hist = [];
    for (let v = 0; v < GR.n; v++) nodeTag(v, fmt(d[v]));
    const rx = async (e, ms) => {
      d[e.v] = d[e.u] + e.w; c++; nodeTag(e.v, fmt(d[e.v])); edgeColor(e, C.hot, 2); nodeColor(e.v, C.pq, 0.35);
      txt(cnt, 'relax ' + c + ' 次');
      if (e.v === 6) { hist.push(d[6]); txt(show6, 'v6：' + hist.join(' → ')); }
      await wait(tok, ms); edgeColor(e, C.edge, 1); nodeColor(e.v, C.white, 0);
    };
    say('先沿著鏈走：0, 4, 8, 10, 12, 13, 14', '');
    await wait(tok, 1600);
    for (let i = 0; i < 6; i++) await rx(GR.edges[i], 800);
    say('之後故意挑「最後面」能 relax 的邊', '捷徑的權重和兩段之一相同');
    await wait(tok, 2200);
    for (;;) {
      const cand = GR.edges.filter((e) => d[e.u] !== INF && d[e.u] + e.w < d[e.v]);
      if (!cand.length) break;
      cand.sort((a, b) => b.v - a.v || b.u - a.u);
      const e = cand[0];
      say('relax ' + nm(e.u) + '→' + nm(e.v) + '：' + fmt(d[e.v]) + ' → ' + (d[e.u] + e.w), '');
      await rx(e, 1100);
    }
    say('v6 一點一點降到 7；鏈越長越糟', 'n 個頂點、權重到 2^(n/2) → relax 次數可達指數級');
    await wait(tok, 3600);
  }
  async function scOptimalSub(tok) {
    fresh();
    buildGraph({ directed: true, names: ['v0', 'v1', 'v2', 'v3'], pos: [[-5, 0.6], [-1.7, -1.4], [1.7, -1.4], [5, 0.6]], edges: [[0, 1, 4], [1, 2, 3], [2, 3, 2]] });
    GR.edges.forEach((e) => edgeColor(e, C.tree, 2.2));
    say('最短路徑 v0 → v1 → v2 → v3 = 9', '它的每一段子路徑也都是最短路徑');
    await wait(tok, 3000);
    const alt = addEdge(GR, 0, 1, 2, 0.45);
    edgeColor(alt, C.back, 1.6);
    say('假設 v0 → v1 有一條更短的（2 < 4）', '換上去整條就變 7 < 9：矛盾');
    await wait(tok, 3400);
    lab.world.remove(alt.group); alt.lbl.element.remove(); lab.world.remove(alt.lbl); GR.edges.pop();
    say('三角不等式：δ(v0, v2) ≤ δ(v0, v1) + δ(v1, v2)', '講的是最短路徑，不是單一條邊');
    edgeColor(GR.edges[0], C.hot, 2.4); edgeColor(GR.edges[1], C.hot, 2.4);
    nodeTag(2, 'δ(v0,v2) ≤ 4 + 3');
    await wait(tok, 3400);
    say('這兩個性質讓演算法不必列舉指數多條路徑', 'Dijkstra、Bellman-Ford 都靠它們');
    await wait(tok, 3000);
  }

  // ─── 2E7MmKv0Y24：MIT L16 ───
  async function scRelaxSafe(tok) {
    fresh();
    buildGraph(GRAPHS.tri);
    const dl = [0, INF, INF], dt = [0, 1, 2];
    const tagN = (v) => { nodeTag(v, 'd ' + fmt(dl[v])); nodeNote(v, 'δ = ' + dt[v]); };
    [0, 1, 2].forEach(tagN);
    say('d(v)：目前找到的；δ(s, v)：真正最短的', '一開始 d(s) = 0、其他 ∞');
    await wait(tok, 2800);
    const rx = async (u, v, cap) => { const e = findEdge(u, v); edgeColor(e, C.hot, 2); await wait(tok, 500); dl[v] = dl[u] + e.w; tagN(v); edgeColor(e, C.tree, 2); say(cap, 'd(' + nm(v) + ') = ' + dl[v] + ' ≥ δ = ' + dt[v]); await wait(tok, 2000); };
    await rx(0, 1, 'relax s → a：∞ → 1');
    await rx(0, 2, 'relax s → b：∞ → 3');
    edgeColor(findEdge(0, 2), C.dim, 1);
    await rx(1, 2, 'relax a → b：3 → 2');
    say('引理：不論 relax 的順序，永遠 d(v) ≥ δ(s, v)', '從上面收斂，不會降過頭');
    await wait(tok, 3200);
    say('δ(s,v) ≤ δ(s,u) + δ(u,v) ≤ d(u) + w(u,v)', '= relax 之後的 d(v)（歸納法）');
    await wait(tok, 3400);
    say('s → b 這條邊 3 比 s → a → b 的 2 大，不矛盾', '三角不等式講的是最短路徑');
    await wait(tok, 3000);
  }
  async function scDagSP(tok) {
    fresh();
    buildGraph(GRAPHS.dag);
    say('DAG：先 topological sort，排成一列', '權重：5, 3, 2, 6, 7, 4, 2, −1, 1, −2');
    await wait(tok, 3000);
    run.gen = dagGen(1, { k: 0.8 });
    await playGen(tok);
    say('最終：∞、0、2、6、5、3', 'O(V + E)；可有負邊，只要沒有 cycle');
    await wait(tok, 2600);
  }
  async function scBallDemo(tok) {
    fresh([0, 4.2, 14], [0, 3.2, 0]);
    // 繩長：G–P 7、P–B 5、G–Y 19 出自影片；B–Y 4、Y–R 6、B–R 13 為示意
    const names = ['G', 'P', 'B', 'Y', 'R'], cols = ['#2fc092', '#9b7ef4', '#4b9ee2', '#e8c22a', '#d64545'];
    const xs = [-4.8, -2.4, 0, 2.4, 4.8];
    const ropes = [[0, 1, 7], [1, 2, 5], [0, 3, 19], [2, 3, 4], [3, 4, 6], [2, 4, 13]];
    const balls = names.map((n2, i) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), new THREE.MeshStandardMaterial({ color: cols[i], roughness: 0.4 }));
      m.castShadow = true; m.add(lab.label(n2, 'val')); m.position.set(xs[i], 0.42, 0); lab.world.add(m); return m;
    });
    const dl = names.map(() => tag('', 'ptr', 0, 0, 0));
    let lines = [];
    const SC = 0.27;
    const draw = (dist, tight) => {
      lines.forEach((l) => lab.world.remove(l)); lines = [];
      for (const [a, b, len] of ropes) {
        const A = balls[a].position, B = balls[b].position;
        const isT = tight(a, b, len);
        const gap = A.distanceTo(B), sag = Math.max(0, len * SC - gap) * 0.45;
        const mid = A.clone().add(B).multiplyScalar(0.5); mid.y -= sag;
        const curve = new THREE.QuadraticBezierCurve3(A.clone(), mid, B.clone());
        const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(16)), new THREE.LineBasicMaterial({ color: isT ? '#2f7fd0' : '#a8987c' }));
        lab.world.add(l); lines.push(l);
      }
      balls.forEach((b, i) => { dl[i].position.set(b.position.x, b.position.y + 0.9, 0); });
    };
    const lift = async (src, dist, ms) => {
      const order = names.map((_, i) => i).sort((a, b) => dist[a] - dist[b]);
      const top = 6.6;
      await anim(tok, ms, (t) => {
        const h = 0.42 + (top - 0.42) * t;
        balls.forEach((b, i) => { b.position.y = Math.max(0.42, h - dist[i] * SC); });
        draw(dist, (a, b, len) => Math.abs(Math.abs(dist[a] - dist[b]) - len) < 1e-9 && balls[a].position.y > 0.43 && balls[b].position.y > 0.43);
      });
      return order;
    };
    say('球 = 頂點、繩長 = 邊的權重', '把起點的球提起來，其他球會依序離開地面');
    draw([0, 0, 0, 0, 0], () => false);
    await wait(tok, 3000);
    const dG = [0, 7, 12, 16, 22];
    say('提起綠球 G', 'gravity 也是 greedy');
    const ord = await lift(0, dG, 4200);
    dG.forEach((x, i) => txt(dl[i], String(x)));
    say('依序離地：' + ord.map((i) => names[i]).join('、'), 'G 0、P 7、B 7 + 5 = 12、Y、R');
    await wait(tok, 3000);
    say('拉緊的繩子（藍）就是 predecessor π', '鬆的繩子不在最短路徑上');
    await wait(tok, 3000);
    balls.forEach((b) => { b.position.y = 0.42; }); draw([0, 0, 0, 0, 0], () => false); dl.forEach((l) => txt(l, ''));
    await wait(tok, 800);
    const dR = [22, 15, 10, 6, 0];
    say('改提紅球 R', '');
    const ord2 = await lift(4, dR, 4200);
    dR.forEach((x, i) => txt(dl[i], String(x)));
    say('順序：' + ord2.map((i) => names[i]).join('、'), 'Dijkstra 就是在算這個穩定狀態');
    await wait(tok, 3400);
  }
  async function scDijClrs5(tok) {
    fresh();
    buildGraph(GRAPHS.clrs5);
    say('5 個頂點的有向圖，起點 A', 'Q 是 priority queue，key = d 值');
    await wait(tok, 2600);
    run.gen = dijkstraGen(0, { k: 0.85 });
    await playGen(tok);
  }
  async function scDijComplexity(tok) {
    fresh([0, 5, 14], [0, 3, 0]);
    const H = (x) => 0.2 + Math.log10(x) * 0.6;
    const cases = [['稀疏 V = 10⁴, E = 4·10⁴', 1e4, 4e4, -3.4], ['稠密 V = 10⁴, E = 10⁸', 1e4, 1e8, 3.4]];
    tag('高度：對數尺度', 'idx', 0, 0, 2.2);
    say('Θ(V) insert、Θ(V) Extract-Min、Θ(E) Decrease-Key', '總時間看 priority queue 怎麼做');
    await wait(tok, 3000);
    const kinds = [['Array', '#dd8238', (v, e) => v * v + e], ['Binary heap', '#4b9ee2', (v, e) => (v + e) * Math.log2(v)], ['Fibonacci heap', '#2fc092', (v, e) => v * Math.log2(v) + e]];
    for (const [nm2, v, e, cx] of cases) {
      tag(nm2, 'ptr', cx, 0, 1.4);
      for (let i = 0; i < 3; i++) {
        const [kn, col, f] = kinds[i];
        const x = cx + (i - 1) * 1.6, h = H(f(v, e));
        const m = lab.box(col, [1.2, 1, 1]); m.scale.y = 0.01; m.position.set(x, 0, 0); lab.world.add(m);
        await anim(tok, 700, (t) => { m.scale.y = h * t; m.position.y = h * t / 2; });
        tag(kn, 'idx', x, h + 0.35, 0);
        say(nm2 + '：' + kn, ['Θ(V² + E) = Θ(V²)', 'Θ((V + E) log V)', 'Θ(V log V + E)'][i]);
        await wait(tok, 1200);
      }
    }
    say('稀疏圖用 heap；稠密圖 binary heap 反而比 array 慢', 'Fibonacci heap（攤銷）兩邊都最好');
    await wait(tok, 3600);
  }
  async function scDijProof(tok) {
    fresh();
    buildGraph(GRAPHS.clrs5);
    run.gen = dijkstraGen(0, {});
    let st;
    while ((st = step()) && !/Extract-Min：E/.test(st.cap)) { /* 快轉到 S = {A, C, E} */ }
    say('課本證明：u 被取出時 d(u) = δ(s, u)', '假設 u 是第一個取出時 d(u) ≠ δ 的頂點');
    await wait(tok, 3400);
    say('看 s 到 u 的最短路徑上第一個不在 S 的頂點 y', 'y 的前一個 x 在 S 裡，(x, y) 早已 relax → d(y) = δ(y)');
    await wait(tok, 3800);
    say('權重 ≥ 0：δ(y) ≤ δ(u) ≤ d(u)', 'u 是 Q 中最小的：d(u) ≤ d(y)');
    await wait(tok, 3600);
    say('所以 d(u) = d(y) = δ(y) = δ(u)：矛盾', '這裡用到「權重非負」→ 負邊時失效');
    await wait(tok, 3600);
  }

  // ─── CHvQ3q_gJ7E：MIT L18 ───
  async function scEarlyStop(tok) {
    fresh();
    buildGraph(GRAPHS.l15);
    say('只想要 S 到 C：取出 C 時就停', 'if u == t: stop（只多一行）');
    nodeColor(3, C.purple, 0); nodeNote(3, '目標 t');
    await wait(tok, 2800);
    run.gen = dijkstraGen(0, { target: 3, k: 0.8 });
    await playGen(tok);
    say('F 沒有被取出：省下的工作', 't 剛好最後一個時也不會比較慢');
    await wait(tok, 3000);
  }
  function bidirSetup() {
    buildGraph(GRAPHS.bidir);
    tag('上 = d_f（forward）、下 = d_b（backward）', 'idx', 0, 0.3, 4.2);
  }
  async function scBidirWrong(tok) {
    fresh();
    bidirSetup();
    const df = [0, INF, INF, INF, INF], db = [INF, INF, INF, 0, INF];
    const sh = () => { for (let v = 0; v < 5; v++) { nodeTag(v, 'f ' + fmt(df[v])); nodeNote(v, 'b ' + fmt(db[v])); } };
    sh();
    say('上面 3 + 3 + 3 = 9，下面 5 + 5 = 10', '從 s 往前、從 t 沿反向邊往回，交替做');
    await wait(tok, 3200);
    const S = [
      [0, 'f', [[0, 1], [0, 4]], 'forward 取 s：d_f(u) = 3、d_f(w) = 5'],
      [3, 'b', [[2, 3], [4, 3]], 'backward 取 t：d_b(u′) = 3、d_b(w) = 5'],
      [1, 'f', [[1, 2]], 'forward 取 u（3 最小）：d_f(u′) = 6'],
      [2, 'b', [[1, 2]], 'backward 取 u′：d_b(u) = 6'],
      [4, 'f', [[4, 3]], 'forward 取 w（5 < 6）：d_f(t) = 10'],
      [4, 'b', [[0, 4]], 'backward 取 w：w 兩邊都被取出 → 停！'],
    ];
    const doneF = new Set(), doneB = new Set();
    for (const [u, dir, es2, cap] of S) {
      (dir === 'f' ? doneF : doneB).add(u);
      nodeColor(u, doneF.has(u) && doneB.has(u) ? C.back : dir === 'f' ? '#bfe8d6' : '#cfe0f5', 0.3);
      for (const [a, b] of es2) {
        const e = findEdge(a, b); edgeColor(e, dir === 'f' ? C.ok : C.tree, 2);
        if (dir === 'f') df[b] = Math.min(df[b], df[a] + e.w); else db[a] = Math.min(db[a], db[b] + e.w);
      }
      sh();
      say(cap, dir === 'f' ? 'Q_f 取 min' : 'Q_b 取 min');
      await wait(tok, 2400);
    }
    say('用 w 接起來：d_f(w) + d_b(w) = 10', '<span class="no">但最短是 9！w 不在最短路徑上</span>');
    await wait(tok, 3400);
    say('交替搜尋會在「邊數最少」的路徑相遇', '這裡邊數最少的不是權重最小的');
    await wait(tok, 3200);
  }
  async function scBidirFix(tok) {
    fresh();
    bidirSetup();
    const df = [0, 3, 6, 10, 5], db = [10, 6, 3, 0, 5];
    for (let v = 0; v < 5; v++) { nodeTag(v, 'f ' + fmt(df[v])); nodeNote(v, 'b ' + fmt(db[v])); }
    say('終止條件沒錯；停下後要再掃一次', '找 d_f(x) + d_b(x) 最小的 x');
    await wait(tok, 3000);
    let best = -1;
    for (const x of [4, 1, 2]) {
      nodeColor(x, C.hot, 0.5);
      say(nm(x) + '：' + df[x] + ' + ' + db[x] + ' = ' + (df[x] + db[x]), '');
      await wait(tok, 1800);
      if (best < 0 || df[x] + db[x] < df[best] + db[best]) best = x;
      nodeColor(x, C.white, 0);
    }
    nodeColor(best, C.ok, 0.5);
    [[0, 1], [1, 2], [2, 3]].forEach(([a, b]) => edgeColor(findEdge(a, b), C.tree, 2.4));
    say('x = ' + nm(best) + '：用 π_f 接到 s、用 π_b 接到 t', '最短路徑 s → u → u′ → t = 9');
    await wait(tok, 3600);
  }
  async function scPotential(tok) {
    fresh();
    buildGraph(GRAPHS.bidir);
    say('位能 λ：w̄(u, v) = w(u, v) − λ(u) + λ(v)', '讓搜尋往 t「下坡」走');
    await wait(tok, 3000);
    const lam = [9, 6, 3, 0, 5];
    for (let v = 0; v < 5; v++) nodeNote(v, 'λ = ' + lam[v]);
    say('這裡取 λ(v) = 到 t 的距離（landmark 給的是它的下界）', '');
    await wait(tok, 2800);
    for (const e of GR.edges) {
      const nw = e.w - lam[e.u] + lam[e.v];
      edgeColor(e, C.hot, 1.8);
      say(nm(e.u) + '→' + nm(e.v) + '：' + e.w + ' − ' + lam[e.u] + ' + ' + lam[e.v] + ' = ' + nw, '');
      await wait(tok, 1300);
      setW(e, nw); edgeColor(e, nw === 0 ? C.ok : C.edge, nw === 0 ? 2 : 1);
    }
    say('上面那條路變成 0 + 0 + 0 = 0、下面 1 + 0 = 1', '每條 s→t 路徑都減了 λ(s) − λ(t) = 9');
    await wait(tok, 3400);
    say('最短路徑不變，但 Dijkstra 會先往權重 0 的方向走', '同樣的想法：Johnson 演算法');
    await wait(tok, 3000);
  }

  // ─── FrLWd1tJ_Wc / FtN3BYH2Zes：Bellman-Ford ───
  async function scDijNegFail(tok) {
    fresh();
    buildGraph(GRAPHS.neg);
    say('有負權重邊 b → a = −2 時，Dijkstra 會怎樣？', '真正答案：a = 1、c = 2');
    await wait(tok, 3000);
    run.gen = dijkstraGen(0, { k: 0.85, endCap: 'Dijkstra 說 c = 3，但 s → b → a → c = 2', endF: '<span class="no">負邊讓 greedy 的假設失效</span>' });
    await playGen(tok);
    say('有負邊：改用 Bellman-Ford（O(VE)）', '它會確認答案正確，或回報負 cycle');
    await wait(tok, 3000);
  }
  async function scCycleSign(tok) {
    fresh();
    buildGraph({ directed: true, names: ['x', 'y', 'z'], pos: [[-2.6, 1.6], [0, -2.4], [2.6, 1.6]], edges: [[0, 1, 2], [1, 2, 3], [2, 0, -3]] });
    const sum = tag('', 'ptr alt', 0, 0.3, 3.4);
    const tok3 = lab.box('#e8b02a', [0.4, 0.4, 0.4]); tok3.position.set(-2.6, 0.9, 1.6); lab.world.add(tok3);
    const P = GR.nodes.map((nd) => nd.home);
    const loop = async (laps, perLap) => {
      let total = 0;
      for (let l = 0; l < laps; l++) for (let i = 0; i < 3; i++) {
        const a = P[i], b = P[(i + 1) % 3], w = GR.edges[i].w;
        await anim(tok, 520, (t) => tok3.position.set(a.x + (b.x - a.x) * t, 0.9, a.z + (b.z - a.z) * t));
        total += w; txt(sum, '走過的總權重 = ' + fmt(total));
      }
      return total;
    };
    say('cycle 2 + 3 + (−3) = 2：不是負 cycle', '雖然有負邊，繞一圈總和是正的');
    await loop(1);
    await wait(tok, 2200);
    setW(GR.edges[2], -6); edgeColor(GR.edges[2], C.back, 1.8);
    say('把 −3 換成 −6：2 + 3 − 6 = −1', '每多繞一圈就再少 1');
    txt(sum, '');
    await loop(3);
    say('永遠找不到最小值：最短路徑沒有定義', '這就是 negative weight cycle');
    await wait(tok, 3200);
  }
  async function scBari7(tok) {
    fresh();
    buildGraph(GRAPHS.bari7);
    say('7 個頂點 → relax 6 輪；先列出全部 10 條邊', 'relax：d[u] + c(u,v) < d[v] 就更新');
    await wait(tok, 3000);
    run.gen = bfGen(0, { k: 0.62 });
    await playGen(tok);
  }
  async function scBari4(tok) {
    fresh();
    buildGraph(GRAPHS.bari4);
    say('邊故意倒過來排：(3,2)、(4,3)、(1,4)、(1,2)', '4 個頂點 → 3 輪');
    await wait(tok, 3000);
    run.gen = bfGen(0, { k: 0.8 });
    await playGen(tok);
  }
  async function scDetectCycle(tok) {
    fresh();
    buildGraph(GRAPHS.bari4c);
    say('同一張圖加一條 (2,4) = 5', 'cycle 2 → 4 → 3 → 2：5 + 3 − 10 = −2');
    await wait(tok, 3200);
    run.gen = bfGen(0, { k: 0.7 });
    await playGen(tok);
    say('V − 1 輪後還在變 → 有負權重 cycle', 'Bellman-Ford 解不出來，但偵測得到');
    await wait(tok, 3000);
  }

  // ─── 課本補充：Floyd-Warshall、Johnson ───
  async function scFloyd(tok) {
    fresh([0, 12.5, 8], [0.2, 0, -0.3]);
    buildGraph(GRAPHS.clrs25, { scale: 0.6, dx: -3.4, dz: 0.4 });
    say('All-pairs：Floyd-Warshall（課本 CLRS 圖 25.4）', 'D⁽ᵏ⁾：只允許經過頂點 1…k');
    await wait(tok, 2800);
    run.gen = floydGen({ k: 0.55 });
    await playGen(tok);
  }
  async function scJohnson(tok) {
    fresh();
    buildGraph(GRAPHS.clrs25, { scale: 0.85, dx: 0.6 });
    say('Johnson：讓所有權重 ≥ 0，就能每個起點跑 Dijkstra', '課本 CLRS 圖 25.6');
    await wait(tok, 3000);
    const s = { mesh: null };
    const sm = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 28), new THREE.MeshStandardMaterial({ color: C.purple }));
    sm.add(lab.label('s', 'val')); sm.position.set(-5.8, 0.25, -3.2); lab.world.add(sm); s.mesh = sm;
    const ls = GR.nodes.map((nd) => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(-5.8, 0.3, -3.2), V(nd.home.x, 0.3, nd.home.z)]), new THREE.LineBasicMaterial({ color: '#9b7ef4' })); lab.world.add(l); return l; });
    say('加一個新頂點 s，連到每個頂點、權重 0', '從 s 跑 Bellman-Ford（也順便偵測負 cycle）');
    await wait(tok, 3200);
    const h = [0, -1, -5, 0, -4];
    for (let v = 0; v < 5; v++) { nodeTag(v, 'h = ' + fmt(h[v]), 'ptr alt'); await wait(tok, 500); }
    say('h(v) = δ(s, v)：0, −1, −5, 0, −4', '');
    await wait(tok, 2600);
    ls.forEach((l) => lab.world.remove(l));
    for (const e of GR.edges) {
      const nw = e.w + h[e.u] - h[e.v];
      edgeColor(e, C.hot, 1.8);
      say('ŵ(' + nm(e.u) + ',' + nm(e.v) + ') = ' + fmt(e.w) + ' + (' + fmt(h[e.u]) + ') − (' + fmt(h[e.v]) + ') = ' + nw, '三角不等式保證 ≥ 0');
      await wait(tok, 1150);
      setW(e, nw); edgeColor(e, nw === 0 ? C.ok : C.edge, 1);
    }
    say('全部 ≥ 0；每條 u→v 路徑都只差 h(u) − h(v)', '最短路徑不變');
    await wait(tok, 3200);
    say('每個起點跑一次 Dijkstra，再換回：δ = δ̂ − h(u) + h(v)', 'O(VE + V² log V)（Fibonacci heap）；稀疏圖比 Floyd 好');
    await wait(tok, 3600);
  }

  const scenes = {
    'dij-video-sets': { title: 'Dijkstra：explored / unexplored 與 D、P', play: scDijVideoSets },
    'dij-video-path': { title: 'Dijkstra：沿 P 回推最短路徑', play: scDijVideoPath },
    'sp-compare': { title: '最短路徑演算法怎麼選', play: scCompare },
    'sp-exp-paths': { title: '路徑權重與指數多條路徑', play: scExpPaths },
    'sp-relax-s-af': { title: 'L15：S～F 手動降 d（C：6 → 5）', play: scRelaxSAF },
    'sp-negative-cycle': { title: '負權重 cycle：哪些頂點是 −∞', play: scNegCycle },
    'sp-generic-relax': { title: '通用結構：一直挑邊 Relax', play: scGenericRelax },
    'sp-bad-order': { title: '壞的 relax 順序：v6 一點一點降', play: scBadOrder },
    'sp-optimal-substructure': { title: 'Optimal substructure 與三角不等式', play: scOptimalSub },
    'relax-safe': { title: 'Relaxation 是安全的：d(v) ≥ δ(s, v)', play: scRelaxSafe },
    'dag-sp': { title: 'DAG 最短路徑：topo 順序 relax 一次', play: scDagSP },
    'dij-ball-demo': { title: '掛球示範：提起起點，球依距離離地', play: scBallDemo },
    'dij-clrs5': { title: 'Dijkstra：5 頂點例子（Extract-Min、relax）', play: scDijClrs5 },
    'dij-complexity': { title: 'Dijkstra 複雜度：array / binary heap / Fibonacci heap', play: scDijComplexity },
    'dij-proof': { title: '課本：Dijkstra 正確性（為什麼要非負）', play: scDijProof },
    'dij-early-stop': { title: '單一目標：取出 t 就停', play: scEarlyStop },
    'bidir-wrong-w': { title: '雙向搜尋：在 w 停下，但 w 不在最短路徑上', play: scBidirWrong },
    'bidir-fix-x': { title: '雙向搜尋修正：min d_f(x) + d_b(x)', play: scBidirFix },
    'potential-reweight': { title: '位能改權重：w − λ(u) + λ(v)', play: scPotential },
    'dij-neg-fail': { title: '負邊讓 Dijkstra 出錯', play: scDijNegFail },
    'bf-cycle-sign': { title: '負 cycle：2 + 3 − 6 = −1', play: scCycleSign },
    'bf-bari7': { title: 'Bellman-Ford：7 頂點逐輪 relax', play: scBari7 },
    'bf-bari4': { title: 'Bellman-Ford：倒序的邊要到第 3 輪才收斂', play: scBari4 },
    'bf-detect-cycle': { title: 'Bellman-Ford 偵測負 cycle：多做一輪還在變', play: scDetectCycle },
    'floyd-warshall': { title: '課本：Floyd-Warshall（D⁽⁰⁾ → D⁽⁵⁾）', play: scFloyd },
    'johnson-reweight': { title: '課本：Johnson 重新加權', play: scJohnson },
  };

  return {
    kicker: '演算法・第 7 章',
    title: '最短路徑：Dijkstra、Bellman-Ford、Floyd-Warshall',
    color: 'var(--alg)',
    modes: [
      { id: 'dijkstra', name: 'Dijkstra', enter: enterDijkstra },
      { id: 'bf', name: 'Bellman-Ford', enter: enterBF },
      { id: 'dag', name: 'DAG 最短路徑', enter: enterDAG },
      { id: 'floyd', name: 'Floyd-Warshall', enter: enterFloyd },
      { id: 'relax', name: 'Relax 實驗', enter: enterRelax },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: [
      'dij-video-sets', 'dij-video-path',
      'sp-compare', 'sp-exp-paths', 'sp-relax-s-af', 'sp-negative-cycle', 'sp-generic-relax', 'sp-bad-order', 'sp-optimal-substructure',
      'relax-safe', 'dag-sp', 'dij-ball-demo', 'dij-clrs5', 'dij-complexity', 'dij-proof',
      'dij-neg-fail', 'bf-cycle-sign', 'bf-bari7', 'bf-bari4', 'bf-detect-cycle',
      'dij-early-stop', 'bidir-wrong-w', 'bidir-fix-x', 'potential-reweight',
      'floyd-warshall', 'johnson-reweight',
    ],
    stop() { clearTimeout(timer); epoch++; },
  };
}
