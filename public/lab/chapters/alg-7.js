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
import kit from './_kit.js';

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
    say('總時間看 priority queue 怎麼做', 'V 次 insert、V 次 Extract-Min、E 次 Decrease-Key');
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
    say('每個起點跑一次 Dijkstra 再換回', 'δ = δ̂ − h(u) + h(v)；O(VE + V² log V)，稀疏圖比 Floyd 好');
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

  // ═══ spbari.js ═══
  {
const { cube, glow, kill, GOLD, RED, step, buddy, travel } = K;
const kanim = K.anim;
// ─── Abdul Bari 3.6 Dijkstra（XB4MIexjvY0）、TechDose Bellman-Ford（FrLWd1tJ_Wc）、Abdul Bari 4.4 Bellman-Ford（FtN3BYH2Zes）、
//     Abdul Bari 4.2 Floyd-Warshall（oNI0rf2P9gE）、Abdul Bari Shortest Path Algorithms（2raV0H9KqY8）───
// cued：每個 await step(tok) 等講者說到那一句（notes 的 cues）。step 之間只放短動作。
// 用本章模組的畫圖工具（buildGraph、nodeTag、edgeColor…）；fresh / tag / code 是模組自己的版本。
// 4.4 的 7 頂點、4 頂點、負 cycle 例子做成 cued 版本 spbari-bf-bari7 / spbari-bf-bari4 / spbari-bf-cycle4。
const SB = {
  // 3.6：起點 1，1→2 = 2、2→3 = 4
  d3: { title: '1, 2, 3', directed: true, names: ['1', '2', '3'], pos: [[-4.4, 0.8], [0, -2.0], [4.2, 0.8]], edges: [[0, 1, 2], [1, 2, 4]] },
  // 3.6：6 頂點（d = 0, 2, 3, 8, 6, 9）
  d6: { title: 'Bari 6 頂點', directed: true, names: ['1', '2', '3', '4', '5', '6'],
    pos: [[-5, 0], [-1.8, -2.4], [-1.8, 2.4], [1.8, -2.4], [1.8, 2.4], [5, 0]],
    edges: [[0, 1, 2], [0, 2, 4], [1, 2, 1], [1, 3, 7], [2, 4, 3], [4, 3, 2], [3, 5, 1], [4, 5, 5]] },
  // 3.6：課本有向圖（逐字稿沒唸到的 2→4 15、4→1 20、5→3 35、6→5 3 依 Horowitz／Sahni 原圖）
  hs: { title: '課本有向圖', directed: true, names: ['1', '2', '3', '4', '5', '6'],
    pos: [[-5, -1.2], [-1.4, -2.7], [2.8, -2.0], [-3.2, 2.2], [0.8, 2.2], [5, 2.2]],
    edges: [[0, 1, 50], [0, 2, 45, 0.22], [0, 3, 10], [1, 2, 10], [1, 3, 15], [2, 4, 30], [3, 0, 20], [3, 4, 15], [4, 1, 20], [4, 2, 35], [5, 4, 3]] },
  // 2raV0H9KqY8
  tuv: { title: 't, u, v', directed: true, names: ['t', 'u', 'v'], pos: [[-4.4, 0.8], [0, -2.0], [4.2, 0.8]], edges: [[0, 1, 5], [1, 2, 3]] },
  pq: { title: 'P～U', directed: true, names: ['P', 'Q', 'R', 'S', 'T', 'U'],
    pos: [[-5, 0], [-2, -2.3], [1.6, -2.3], [1.6, 0.9], [-0.6, 3.0], [5, -2.3]],
    edges: [[0, 1, 1], [0, 4, 7], [0, 3, 6], [1, 2, 1], [1, 3, 4], [2, 5, 1], [2, 3, 2], [3, 4, 3]] },
  af: { title: 'A～F', directed: true, names: ['A', 'B', 'C', 'D', 'E', 'F'],
    pos: [[-5, 0], [-1.8, -2.4], [-1.8, 2.4], [1.8, -2.4], [1.8, 2.4], [5, 0]],
    edges: [[0, 1, 1], [0, 2, 2], [1, 2, 1], [1, 3, 3], [1, 4, 2, 0.14], [2, 4, 2], [2, 3, 1, 0.14], [3, 5, 3], [3, 4, 4], [4, 5, 3]] },
};
const sbNeg = (w) => ({ title: '負邊', directed: true, names: ['1', '2', '3', '4'], pos: [[-4.6, 0], [0, -2.4], [4.4, 0], [0, 2.4]], edges: [[0, 1, 3], [0, 3, 5], [3, 2, 2], [2, 1, w]] });
// 2raV0H9KqY8：1→2 = 2、2→3 = 3、3→4 = −6，1→4 = w14
const sbNeg2 = (w14) => ({ title: '負邊', directed: true, names: ['1', '2', '3', '4'], pos: [[-4.6, 0], [0, -2.4], [4.4, 0], [0, 2.4]], edges: [[0, 1, 2], [0, 3, w14], [1, 2, 3], [2, 3, -6]] });
// 2raV0H9KqY8 Bellman-Ford：邊的順序 D→B、C→D、A→C、A→B（再加 B→C = 1 形成負 cycle）
const sbAbcd = (extra) => ({ title: 'A～D', directed: true, names: ['A', 'B', 'C', 'D'], pos: [[-4.6, 0], [0, -2.4], [0, 2.4], [4.4, 0]],
  edges: [[3, 1, -6], [2, 3, 3], [0, 2, 2], [0, 1, 1]].concat(extra ? [[1, 2, 1]] : []) });
// TechDose：0～4（0→1 1、0→2 4、1→2 −2、1→3 2、2→3 3、3→4 4、4→1 −3）與 3 頂點 cycle
const SBT5 = { title: 'TechDose 5 頂點', directed: true, names: ['0', '1', '2', '3', '4'],
  pos: [[-5, 0.2], [-1.6, -2.4], [-1.6, 2.4], [2.0, 1.2], [5, -1.4]],
  edges: [[0, 1, 1], [0, 2, 4], [1, 2, -2], [1, 3, 2], [2, 3, 3], [3, 4, 4], [4, 1, -3, -0.12]] };
const sbTri = (w) => ({ title: '0, 1, 2', directed: true, names: ['0', '1', '2'], pos: [[-2.8, 1.4], [0, -2.4], [2.8, 1.4]], edges: [[0, 1, 2], [1, 2, 3], [2, 0, w]] });
const sbE = (u, v) => findEdge(u, v);
const sbPath = (vs, color, k = 2.2) => { for (let i = 0; i + 1 < vs.length; i++) edgeColor(sbE(vs[i], vs[i + 1]), color, k); };
const sbD = (arr) => arr.forEach((v, i) => nodeTag(i, v === null ? '' : fmt(v), 'ptr'));
const sbSum = (a, w) => fmt(a) + (w < 0 ? ' − ' + fmt(-w) : ' + ' + fmt(w));
const sbCls = (l, c) => { l.element.className = 'lab-label' + (c ? ' ' + c : ''); };

// ── 小幫手：會走、會說話的小方塊（buddy）與沿著邊跑的封包（pkt） ──
const sbHome = (i) => GR.nodes[i].home;
const sbAt = (i) => V(sbHome(i).x - 0.95, 0, sbHome(i).z + 0.15);
function sbBuddy(x, z, s = 0.5, color = '#f4a56a', name = '') {
  const b = buddy(name, '', color, x, 0, z, s);
  const sp = lab.label(' ', 'say'); sp.position.set(0, s + (name ? 0.85 : 0.45), 0); b.g.add(sp);
  b.talk = (t) => { sp.element.style.display = t ? '' : 'none'; sp.element.textContent = t || ''; };
  b.talk('');
  return b;
}
async function sbGo(tok, b, p, ms = 700) { await travel(tok, b.g, b.g.position.clone(), p, ms); }
async function sbPkt(tok, text, u, v, ms = 800) {
  const a = sbHome(u), c = sbHome(v);
  const l = tag(text, 'pkt', a.x, 1.0, a.z);
  await travel(tok, l, V(a.x, 1.0, a.z), V(c.x, 1.0, c.z), ms);
  return l;
}
// 一個封包沿著一串頂點走
async function sbWalk(tok, text, path, ms = 600) {
  const p = (k) => V(sbHome(k).x, 1.0, sbHome(k).z);
  const l = tag(text, 'pkt', p(path[0]).x, 1.0, p(path[0]).z);
  for (let i = 0; i + 1 < path.length; i++) await travel(tok, l, p(path[i]), p(path[i + 1]), ms);
  return l;
}
// 同時從一個頂點送封包到好幾個頂點
async function sbFan(tok, from, tos, ms = 900) {
  const a = sbHome(from);
  const ls = tos.map((v) => ({ l: tag(nm(from) + '→' + nm(v), 'pkt', a.x, 1.0, a.z), b: sbHome(v) }));
  await kanim(tok, ms, (u) => ls.forEach(({ l, b }) => l.position.set(a.x + (b.x - a.x) * u, 1.0, a.z + (b.z - a.z) * u)));
  return ls.map((x) => x.l);
}
// 一顆小方塊沿著 cycle 走一圈；回傳總和
async function sbLoop(tok, pts, ws, sumTag, start = 0, ms = 480) {
  const m = lab.box('#e8b02a', [0.4, 0.4, 0.4]); m.position.set(pts[0].x, 0.9, pts[0].z); lab.world.add(m);
  let total = start;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    await kanim(tok, ms, (t) => m.position.set(a.x + (b.x - a.x) * t, 0.9, a.z + (b.z - a.z) * t));
    total += ws[i]; txt(sumTag, '走過的總權重 = ' + fmt(total));
  }
  kill(m);
  return total;
}
// 跟著講者：groups 每一項是一句話 — 數字 n = 播下 n 個事件；函式 = 執行這段畫面
async function sbRun(tok, evs, groups, show) {
  const need = groups.reduce((a, g) => a + (typeof g === 'number' ? g : 0), 0);
  if (need !== evs.length) log('groups ' + need + ' ≠ events ' + evs.length + '：' + evs.map((e) => e.t + (e.e ? '(' + nm(e.e.u) + nm(e.e.v) + ')' : e.u !== undefined ? nm(e.u) : '')).join(' '), true);
  let k = 0;
  for (const g of groups) {
    await step(tok);
    if (typeof g === 'function') { await g(); continue; }
    const ms = Math.min(850, Math.floor(2400 / Math.max(1, g)));
    for (let i = 0; i < g && k < evs.length; i++) await show(evs[k++], ms);
  }
}

// ── Dijkstra：先算好事件，再一句一句播 ──
const sbOut = (u) => GR.edges.filter((e) => e.u === u || (!GR.directed && e.v === u)).map((e) => ({ e, v: e.u === u ? e.v : e.u }));
function sbDijEv(s, o = {}) {
  const n = GR.n, d = Array(n).fill(INF), par = Array(n).fill(-1), done = Array(n).fill(false), ev = [];
  d[s] = 0;
  if (o.direct) { done[s] = true; for (const { e, v } of sbOut(s)) if (e.w < d[v]) { d[v] = e.w; par[v] = s; } }
  ev.push({ t: 'init', d: d.slice(), par: par.slice() });
  for (;;) {
    let u = -1;
    for (let v = 0; v < n; v++) if (!done[v] && (u < 0 || d[v] < d[u])) u = v;
    if (u < 0) break;
    if (d[u] === INF) { ev.push({ t: 'unreach', vs: [...Array(n).keys()].filter((v) => !done[v]) }); break; }
    done[u] = true; ev.push({ t: 'pick', u, du: d[u], pe: par[u] });
    for (const { e, v } of sbOut(u)) {
      const nd = d[u] + e.w;
      if (done[v]) {
        if (nd < d[v]) ev.push({ t: 'late', u, v, e, du: d[u], nd, old: d[v] });
        else if ((o.check || []).includes(u + '-' + v)) ev.push({ t: 'doneKeep', u, v, e, du: d[u], nd, old: d[v] });
        continue;
      }
      if (nd < d[v]) { ev.push({ t: 'upd', u, v, e, du: d[u], nd, old: d[v], ope: par[v] }); d[v] = nd; par[v] = u; }
      else ev.push({ t: 'keep', u, v, e, du: d[u], nd, old: d[v] });
    }
  }
  ev.push({ t: 'end', d: d.slice() });
  return ev;
}
function sbDijShow(tok, s, o = {}) {
  const b = sbBuddy(sbAt(s).x, sbAt(s).z, 0.48);
  let pk = null, tb = null;
  const setD = (v, val, cls) => { nodeTag(v, fmt(val), cls); if (tb && tb[v]) txt(tb[v].userData.l, nm(v) + '：' + fmt(val)); };
  const show = async (ev, ms) => {
    if (pk) { kill(pk); pk = null; }
    if (ev.t === 'init') {
      for (let v = 0; v < GR.n; v++) setD(v, ev.d[v], v === s ? 'ptr' : 'ptr alt');
      nodeColor(s, C.ok, 0.3);
      for (let v = 0; v < GR.n; v++) if (ev.par[v] === s) edgeColor(findEdge(s, v), C.pq, 1.6);
      b.talk('先看直接邊'); await b.hop(tok);
      say('起點 ' + nm(s) + ' = 0：直接邊先填上', '沒有直接邊 → ∞');
    } else if (ev.t === 'pick') {
      b.talk('選 ' + nm(ev.u) + '！'); b.mood('calm');
      await sbGo(tok, b, sbAt(ev.u), Math.min(ms, 800));
      nodeColor(ev.u, C.ok, 0.3); setD(ev.u, ev.du, 'ptr');
      if (ev.pe >= 0) edgeColor(findEdge(ev.pe, ev.u), C.tree, 2.2);
      if (tb && tb[ev.u]) tb[ev.u].material.color.set('#bfe8d6');
      say('選 ' + nm(ev.u) + '（距離 ' + fmt(ev.du) + '）', '還沒選的頂點裡最小的 → 定案');
    } else if (ev.t === 'upd') {
      edgeColor(ev.e, C.hot, 1.8);
      pk = await sbPkt(tok, sbSum(ev.du, ev.e.w) + ' = ' + fmt(ev.nd), ev.u, ev.v, ms);
      setD(ev.v, ev.nd, 'ptr alt');
      if (ev.ope >= 0 && ev.ope !== ev.u) edgeColor(findEdge(ev.ope, ev.v), C.edge, 1);
      edgeColor(ev.e, C.pq, 1.6);
      txt(pk, fmt(ev.nd) + ' < ' + fmt(ev.old)); b.mood('happy'); b.talk('改成 ' + fmt(ev.nd));
      say(nm(ev.u) + ' → ' + nm(ev.v) + '：' + sbSum(ev.du, ev.e.w) + ' = ' + fmt(ev.nd) + ' < ' + fmt(ev.old), 'relax：' + nm(ev.v) + ' 改成 ' + fmt(ev.nd));
    } else if (ev.t === 'keep' || ev.t === 'doneKeep') {
      edgeColor(ev.e, C.hot, 1.8);
      pk = await sbPkt(tok, sbSum(ev.du, ev.e.w) + ' = ' + fmt(ev.nd), ev.u, ev.v, ms);
      txt(pk, fmt(ev.nd) + ' ≥ ' + fmt(ev.old)); sbCls(pk, 'bad');
      edgeColor(ev.e, C.edge, 1); b.mood('calm'); b.talk('不用換');
      say(nm(ev.u) + ' → ' + nm(ev.v) + '：' + sbSum(ev.du, ev.e.w) + ' = ' + fmt(ev.nd) + ' ≥ ' + fmt(ev.old), ev.t === 'doneKeep' ? nm(ev.v) + ' 已經選過了，也不會更好' : '沒有比較短 → 不更新');
    } else if (ev.t === 'late') {
      edgeColor(ev.e, C.back, 2);
      pk = await sbPkt(tok, sbSum(ev.du, ev.e.w) + ' = ' + fmt(ev.nd), ev.u, ev.v, ms);
      nodeTag(ev.v, fmt(ev.old) + ' → ' + fmt(ev.nd) + '？', 'ptr alt'); b.mood('wow'); b.talk('它早就定案了…');
      say(nm(ev.v) + ' 早已定為 ' + fmt(ev.old), '可是 ' + sbSum(ev.du, ev.e.w) + ' = ' + fmt(ev.nd) + ' 更小');
    } else if (ev.t === 'unreach') {
      ev.vs.forEach((v) => { nodeColor(v, C.dim, 0); nodeTag(v, '∞', 'ptr'); });
      b.mood('sad'); b.talk('走不到');
      say('剩下的頂點還是 ∞', '沒有邊走得到 → 一直是 ∞');
    } else if (ev.t === 'end') {
      b.mood(o.endSad ? 'sad' : 'happy'); b.talk(o.endTalk || '完成！');
      say(o.endCap || [...Array(GR.n).keys()].filter((v) => v !== s).map((v) => nm(v) + ' ' + fmt(ev.d[v])).join('、'), o.endF || '');
      await b.hop(tok);
    }
  };
  show.b = b;
  show.mkTable = () => {
    tb = {};
    tag('距離表', 'idx', -5.3, 0.3, -4.5);
    [...Array(GR.n).keys()].filter((v) => v !== s).forEach((v, i) => {
      const m = lab.box(C.q, [1.3, 0.4, 0.7]); m.position.set(-3.8 + i * 1.6, 0.2, -4.5);
      m.userData.l = lab.label(nm(v) + '：', 'val'); m.add(m.userData.l); lab.world.add(m); tb[v] = m;
    });
  };
  return show;
}

// ── Bellman-Ford：事件與畫面 ──
function sbBFEv(s, o = {}) {
  const n = GR.n, E = GR.edges, R = o.rounds || n - 1, X = o.extra || 0;
  const d = Array(n).fill(INF); d[s] = 0;
  const ev = [{ t: 'cards' }, { t: 'init' }];
  let neg = false;
  for (let r = 1; r <= R + X; r++) {
    const chk = r > R ? r - R : 0;
    if (chk) ev.push({ t: 'chk', r: chk });
    let ch = false;
    for (let j = 0; j < E.length; j++) {
      const e = E[j], du = d[e.u], dv = d[e.v];
      if (du === INF) { ev.push({ t: 'inf', r, j, e, old: dv, chk }); continue; }
      const nd = du + e.w;
      if (nd < dv) {
        d[e.v] = nd; ch = true; if (chk) neg = true;
        ev.push({ t: 'upd', r, j, e, du, nd, old: dv, chk });
        if (chk && o.stopOnDetect === chk) { ev.push({ t: 'end', d: d.slice(), neg: true }); return ev; }
      } else ev.push({ t: 'keep', r, j, e, du, nd, old: dv, chk });
    }
    if (o.sum && !chk) ev.push({ t: 'sum', r, d: d.slice() });
    if (!ch && !chk && o.stable) { ev.push({ t: 'stable', r }); break; }
  }
  ev.push({ t: 'end', d: d.slice(), neg });
  return ev;
}
function sbBFShow(tok, s, o = {}) {
  const E = GR.edges, gap = Math.min(1.15, 11.4 / E.length);
  const cards = [], cc = E.map(() => C.q);
  const rt = tag('', 'ptr alt', -4.2, 0.3, 4.55);
  const b = sbBuddy(-5.7, 4.0, 0.48);
  const par = Array(GR.n).fill(null);
  let pk = null, cur = -1;
  const ename = (e) => '(' + nm(e.u) + ',' + nm(e.v) + ')';
  const show = async (ev, ms) => {
    if (pk) { kill(pk); pk = null; }
    if (cur >= 0 && cards[cur]) { cards[cur].material.color.set(cc[cur]); cur = -1; }
    if (ev.t === 'cards') {
      E.forEach((e, i) => {
        const m = lab.box(C.q, [gap * 0.9, 0.45, 0.7]);
        m.add(lab.label(fmt(e.w), 'val'));
        const l = lab.label(ename(e), 'idx'); l.position.set(0, 0, 0.62); m.add(l);
        m.position.set(-5.7 + gap / 2 + i * gap, 2.6, -4.5); lab.world.add(m); cards.push(m);
      });
      await kanim(tok, Math.min(700, ms), (u) => cards.forEach((m) => { m.position.y = 2.6 + (0.23 - 2.6) * u; }));
      b.talk('先列出所有邊');
      say('列出所有邊（照這個順序 relax）', E.map(ename).join('、'));
    } else if (ev.t === 'init') {
      for (let v = 0; v < GR.n; v++) nodeTag(v, v === s ? '0' : '∞', 'ptr');
      nodeColor(s, C.ok, 0.3); txt(rt, '第 0 輪');
      b.talk('起點 0，其他 ∞'); await b.hop(tok);
      say('起點 ' + nm(s) + ' = 0，其他全部 ∞', GR.n + ' 個頂點 → 做 ' + (GR.n - 1) + ' 輪');
    } else if (ev.t === 'chk') {
      txt(rt, '多做的第 ' + ev.r + ' 輪'); b.mood('wow'); b.talk('再檢查一次');
      say('V − 1 輪做完了，再 relax 一輪', '還會變 → 有負權重 cycle');
    } else if (ev.t === 'inf' || ev.t === 'upd' || ev.t === 'keep') {
      const e = ev.e;
      txt(rt, ev.chk ? '多做的第 ' + ev.chk + ' 輪' : '第 ' + ev.r + ' 輪');
      cur = ev.j; cards[cur].material.color.set(C.hot); edgeColor(e, C.hot, 1.8);
      const ex = ev.t === 'inf' ? sbSum(INF, e.w) + ' = ∞' : sbSum(ev.du, e.w) + ' = ' + fmt(ev.nd);
      pk = await sbPkt(tok, ex, e.u, e.v, ms);
      if (ev.t === 'upd') {
        nodeTag(e.v, fmt(ev.nd), ev.chk ? 'ptr alt' : 'ptr');
        if (par[e.v] && par[e.v] !== e) edgeColor(par[e.v], C.edge, 1);
        par[e.v] = e; edgeColor(e, ev.chk ? C.back : C.tree, 2);
        if (ev.chk) cc[ev.j] = C.back;
        txt(pk, fmt(ev.nd) + ' < ' + fmt(ev.old));
        b.mood(ev.chk ? 'wow' : 'happy'); b.talk(ev.chk ? '還在變！' : nm(e.v) + ' 改成 ' + fmt(ev.nd));
        say(ename(e) + '：' + ex + ' < ' + fmt(ev.old), ev.chk ? 'V − 1 輪後還能變小 → 有負 cycle' : '更新 ' + nm(e.v) + ' = ' + fmt(ev.nd));
      } else {
        sbCls(pk, 'bad');
        txt(pk, ev.t === 'inf' ? '∞ → 不變' : fmt(ev.nd) + ' ≥ ' + fmt(ev.old));
        edgeColor(e, par[e.v] === e ? C.tree : C.edge, par[e.v] === e ? 2 : 1);
        b.mood('calm'); b.talk('不變');
        say(ename(e) + '：' + (ev.t === 'inf' ? nm(e.u) + ' 還是 ∞ → 不變' : ex + ' ≥ ' + fmt(ev.old) + ' → 不變'), '');
      }
    } else if (ev.t === 'sum') {
      b.talk(ev.d.map(fmt).join('、'));
      say('第 ' + ev.r + ' 輪結束', [...Array(GR.n).keys()].map((v) => nm(v) + ' = ' + fmt(ev.d[v])).join('、'));
    } else if (ev.t === 'stable') {
      b.mood('happy'); b.talk('跟上一輪一樣 → 停');
      say('第 ' + ev.r + ' 輪沒有任何更新', '已經收斂，可以停');
    } else if (ev.t === 'end') {
      if (ev.neg) { b.mood('sad'); b.talk('有負 cycle！'); } else { b.mood('happy'); b.talk('完成！'); }
      say(o.endCap || ('結果：' + [...Array(GR.n).keys()].map((v) => nm(v) + ' = ' + fmt(ev.d[v])).join('、')), o.endF || '');
      await b.hop(tok);
    }
  };
  show.b = b; show.rt = rt;
  return show;
}

// ══════════ Abdul Bari 3.6 Dijkstra（XB4MIexjvY0）══════════
// 00:00 單一起點最短路徑；minimization → optimization → greedy
FRAG.push(['spbari-dij-problem', 'Dijkstra：單一起點最短路徑（greedy）', async (tok) => {
  fresh();
  buildGraph(SB.d6);
  const b = sbBuddy(-5.6, 3.6, 0.55);
  const bd = tag('', 'note', 2.6, 0.3, 3.7); bd.element.style.display = 'none';
  const board = (t) => { bd.element.style.display = ''; txt(bd, t); };
  await step(tok); // single source shortest path
  for (let v = 1; v < 6; v++) nodeTag(v, '?', 'ptr alt');
  b.talk('最短的路怎麼走？'); await b.hop(tok);
  say('single source shortest path', '從一個起點，到其他每個頂點的最短路徑');
  await step(tok); // 起點選 1
  nodeColor(0, C.ok, 0.3); nodeTag(0, '起點', 'ptr');
  await sbGo(tok, b, sbAt(0), 800); b.talk('起點選 1');
  say('起點選 1', '起點可以任選');
  await step(tok); // direct path or via other vertices
  edgeColor(sbE(0, 2), C.hot, 1.8);
  let p = await sbPkt(tok, '直接：4', 0, 2, 800);
  edgeColor(sbE(0, 2), C.edge, 1); kill(p); sbPath([0, 1, 2], C.tree);
  p = await sbWalk(tok, '2 + 1 = 3', [0, 1, 2], 600);
  say('可以直接走，也可以經過別的頂點', '1 → 3 = 4；1 → 2 → 3 = 3');
  await step(tok); // minimization → optimization
  kill(p); sbPath([0, 1, 2], C.edge, 1);
  board('求最短 = minimization → optimization problem');
  say('求最短：minimization problem', '屬於 optimization problem');
  await step(tok); // greedy method
  const st = ['階段 1', '階段 2', '階段 3'].map((s, i) => cube(s, '#efe3c8', [1.6, 0.4, 0.8], -3.0 + i * 2.0, 0.2, 4.6, 3));
  board('optimization problem → greedy method');
  say('optimization problem 可以用 greedy method', '');
  await step(tok); // stages, one input at a time
  for (const m of st) { glow(m, GOLD); await kanim(tok, 500, () => {}); glow(m, null); }
  b.talk('一次一步');
  say('greedy：分階段，一次只考慮一個輸入', '照固定的程序做，得到最佳解');
  await step(tok); // Dijkstra gives a procedure
  st.forEach(kill);
  board('Dijkstra = 一套 greedy 程序 → 最短路徑');
  say('Dijkstra 就是這樣一套程序', '結果是最短路徑');
  await step(tok); // directed and non-directed
  board('有向圖、無向圖都能用');
  say('Dijkstra 有向、無向圖都能用', '');
  await step(tok); // drawback
  b.mood('wow'); b.talk('也有缺點喔');
  say('影片最後也會示範它的缺點', '');
}]);

// 01:47 小例子：先選最近的 2，再 relax 3：2 + 4 = 6；relaxation 的定義
FRAG.push(['spbari-dij-relax', 'Dijkstra 的想法：選最近的，再 relax', async (tok) => {
  fresh();
  buildGraph(SB.d3);
  const b = sbBuddy(sbAt(0).x, sbAt(0).z, 0.5);
  const bd = tag('', 'note', 0, 0.3, 3.4); bd.element.style.display = 'none';
  const board = (t) => { bd.element.style.display = ''; txt(bd, t); };
  let pk = null;
  await step(tok); // 起點 1，找 2、3
  nodeColor(0, C.ok, 0.3); nodeTag(0, '0', 'ptr'); b.talk('從 1 出發'); await b.hop(tok);
  say('起點 1：要找到 2、到 3 的最短路徑', '');
  await step(tok); // direct path to 2 = 2
  edgeColor(sbE(0, 1), C.hot, 1.8);
  pk = await sbPkt(tok, '2', 0, 1, 800); nodeTag(1, '2', 'ptr alt'); edgeColor(sbE(0, 1), C.pq, 1.6);
  say('1 → 2 有直接邊：2', '');
  await step(tok); // no direct path to 3
  kill(pk); nodeTag(2, '∞', 'ptr alt'); b.talk('3 呢？');
  say('1 → 3 沒有直接邊 → 先記 ∞', '還不知道路');
  await step(tok); // select the shortest: 2
  b.talk('2 < ∞，選 2'); await sbGo(tok, b, sbAt(1), 800);
  nodeColor(1, C.ok, 0.3); nodeTag(1, '2', 'ptr'); edgeColor(sbE(0, 1), C.tree, 2.2);
  say('先選距離最小的頂點：2', '2 < ∞');
  await step(tok); // from 2 go to 3: 2 + 4 = 6
  edgeColor(sbE(1, 2), C.hot, 1.8);
  pk = await sbPkt(tok, '2 + 4 = 6', 1, 2, 900);
  say('從 2 可以到 3：2 + 4 = 6', '');
  await step(tok); // infinity changed to 6
  nodeTag(2, '6', 'ptr alt'); txt(pk, '6 < ∞'); b.mood('happy'); b.talk('改成 6！');
  say('6 < ∞ → 把 3 改成 6', '');
  await step(tok); // path 1-2-3 of distance 6
  kill(pk); sbPath([0, 1, 2], C.tree);
  pk = await sbWalk(tok, '1 → 2 → 3 = 6', [0, 1, 2], 600);
  say('找到 1 → 2 → 3，長度 6', '不是直接邊，是經過 2');
  await step(tok); // always select shortest then update
  kill(pk); board('選最短的頂點 → 更新其他頂點的距離');
  say('Dijkstra：每次選距離最短的頂點', '再更新其他頂點的距離');
  await step(tok); // relaxation
  board('這個「更新」叫 relaxation'); b.talk('relaxation！'); await b.hop(tok);
  say('這種更新叫 relaxation', '');
  await step(tok); // u, v, d[u], d[v], c(u,v)
  nodeNote(1, 'u'); nodeNote(2, 'v'); nodeTag(1, 'd[u]', 'ptr'); nodeTag(2, 'd[v]', 'ptr alt'); edgeColor(sbE(1, 2), C.hot, 1.8);
  say('把 2 叫 u、3 叫 v', 'd[u]、d[v]，邊的成本 c(u, v)');
  await step(tok); // if d[u] + c(u,v) < d[v]
  board('if d[u] + c(u, v) < d[v]');
  say('relaxation：if d[u] + c(u, v) < d[v]', '');
  await step(tok); // 2 + 4 < ∞
  nodeTag(1, '2', 'ptr'); nodeTag(2, '∞', 'ptr alt');
  pk = await sbPkt(tok, '2 + 4 < ∞', 1, 2, 900);
  say('代進去：d[u] = 2、c = 4、d[v] = ∞', '2 + 4 < ∞ 成立');
  await step(tok); // d[v] = d[u] + c(u,v)
  kill(pk); board('then d[v] = d[u] + c(u, v)'); nodeTag(2, '6', 'ptr alt'); b.mood('happy');
  say('成立就改：d[v] = d[u] + c(u, v)', 'd[3] = 6');
  await step(tok); // relax whenever a vertex is selected
  board('每選一個頂點，就 relax 它連到的頂點'); b.talk('接下來照做！');
  say('每選定一個頂點，就 relax 它連出去的頂點', '');
}]);

// 04:24 6 頂點例子：d = 2, 3, 8, 6, 9
FRAG.push(['spbari-dij-g6', 'Dijkstra：6 頂點例子（2, 3, 8, 6, 9）', async (tok) => {
  fresh();
  buildGraph(SB.d6);
  const ev = sbDijEv(0, { direct: true });
  const show = sbDijShow(tok, 0, { endCap: '1 到 2～6：2, 3, 8, 6, 9', endF: '藍色邊 = 最短路徑' });
  await sbRun(tok, ev, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], show);
}]);

// 07:48 時間複雜度：n 個頂點 × 每次最多 relax n 個 = Θ(n²)（2raV0H9KqY8 用 params.rb 多講 red-black tree）
FRAG.push(['spbari-dij-n2', 'Dijkstra 複雜度：n × n = Θ(n²)', async (tok) => {
  const p = ctx.params || {};
  fresh();
  buildGraph(SB.d6, { scale: 0.55, dx: -3.6, dz: 0 });
  const b = sbBuddy(-5.8, 3.4, 0.45);
  const bd = tag('', 'note', 3.4, 0.3, 4.0); bd.element.style.display = 'none';
  const board = (t) => { bd.element.style.display = ''; txt(bd, t); };
  const cs = [];
  await step(tok); // n vertices
  for (let i = 0; i < 6; i++) {
    nodeColor(i, C.ok, 0.3);
    cs.push(cube(String(i + 1), '#bfe8d6', [0.7, 0.35, 0.7], 0.6, 0.18, -2.6 + i * 1.0, 2));
    await kanim(tok, 300, () => {});
  }
  board('n 個頂點：每個都要選一次');
  say('n 個頂點：每個都要找一次最短路徑', '外層做 n 次');
  if (!p.rb) {
    await step(tok); // example: on 3 relaxed 5; on 2 relaxed 3, 4
    edgeColor(sbE(2, 4), C.hot, 1.8); await kanim(tok, 700, () => {});
    edgeColor(sbE(1, 2), C.hot, 1.8); edgeColor(sbE(1, 3), C.hot, 1.8);
    b.talk('relax 幾個要看圖');
    say('每選一個就 relax 相連的頂點', '例：選 3 只 relax 5；選 2 relax 3、4');
  }
  await step(tok); // at most n
  GR.edges.forEach((e) => edgeColor(e, C.edge, 1));
  for (let j = 0; j < 6; j++) { cs.push(cube('', '#efe3c8', [0.62, 0.3, 0.62], 1.6 + j * 0.85, 0.15, -2.6, 1.5)); await kanim(tok, 200, () => {}); }
  board('每選一個，最多 relax n 個');
  say('最多可能要檢查全部 n 個頂點', '');
  await step(tok); // n × n
  for (let i = 1; i < 6; i++) {
    for (let j = 0; j < 6; j++) cs.push(cube('', '#efe3c8', [0.62, 0.3, 0.62], 1.6 + j * 0.85, 0.15, -2.6 + i * 1.0, 1.5));
    await kanim(tok, 300, () => {});
  }
  board('n × n');
  say('n 個頂點 × 每次 n 個 = n × n', '');
  if (!p.rb) {
    await step(tok); // complete graph
    board('complete graph：每個頂點都相連 → 真的 n × n');
    say('完全圖：每對頂點都有邊', '這時就是 n × n');
  }
  await step(tok); // Θ(n²)
  board('worst case：Θ(n²) = Θ(V²)'); b.talk('n²！'); await b.hop(tok);
  say('worst case 時間：Θ(n²)', '也寫成 Θ(V²)');
  if (p.rb) {
    await step(tok); // red-black tree
    board('用 red-black tree：約 n log n（影片沒講細節）');
    say('用 red-black tree 可以更快：約 n log n', '課本常用 binary heap：O((V + E) log V)');
  }
}]);

// 09:23 課本有向圖：寫成表格；6 沒有進來的邊 → ∞
FRAG.push(['spbari-dij-table', 'Dijkstra：課本有向圖（50, 45, 10…）', async (tok) => {
  fresh();
  buildGraph(SB.hs, { scale: 0.95 });
  const ev = sbDijEv(0, { direct: true, check: ['2-4'] });
  const show = sbDijShow(tok, 0, { endCap: '2→45、3→45、4→10、5→25、6→∞', endF: '6 沒有進來的邊 → 一直 ∞' });
  await step(tok); // textbook graph
  GR.edges.forEach((e) => edgeColor(e, C.hot, 1.4)); await kanim(tok, 900, () => {});
  GR.edges.forEach((e) => edgeColor(e, C.edge, 1));
  show.b.talk('課本的圖');
  say('課本常見的加權有向圖', '起點 1');
  await step(tok); // write in a table
  show.mkTable(); show.b.talk('距離寫在表格裡');
  say('距離改寫在表格裡', '不寫在頂點上');
  await sbRun(tok, ev, [1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1], show);
}]);

// 13:05 無向圖：一條邊 = 兩條反向、同權重的有向邊
FRAG.push(['spbari-dij-undirected', '無向邊拆成兩條有向邊', async (tok) => {
  fresh();
  const b = sbBuddy(-0.3, 2.8, 0.55);
  await step(tok); // works on non-directed graph
  buildGraph({ title: '無向', directed: false, names: ['a', 'b'], pos: [[-5.2, 0], [-1.6, 0]], edges: [[0, 1, 3]] });
  b.talk('無向圖也行嗎？');
  say('Dijkstra 也能用在無向圖', '無向邊：兩個方向都能走');
  await step(tok); // convert by adding parallel edges
  buildGraph({ title: '有向', directed: true, names: ['a', 'b'], pos: [[1.6, 0], [5.2, 0]], edges: [[0, 1, 3], [1, 0, 3]] });
  edgeColor(sbE(0, 1), C.hot, 1.8); edgeColor(sbE(1, 0), C.hot, 1.8);
  say('換成兩條平行、方向相反的有向邊', '');
  await step(tok); // this is 3 and this is also 3
  let p = await sbPkt(tok, '3', 0, 1, 800); kill(p);
  p = await sbPkt(tok, '3', 1, 0, 800);
  say('兩條的權重都是 3', 'a → b = 3，b → a = 3');
  await step(tok); // becomes a directed graph
  kill(p); b.mood('happy'); b.talk('兩種都能用！'); await b.hop(tok);
  say('無向圖就變成有向圖', '所以 Dijkstra 有向、無向都能用');
}]);

// 13:45 缺點：負邊 −3 時剛好對，改成 −10 就錯
FRAG.push(['spbari-dij-neg', 'Dijkstra 的缺點：負權重邊', async (tok) => {
  fresh();
  buildGraph(sbNeg(-3));
  let bd = tag('', 'note', 0, 0.3, 4.2); bd.element.style.display = 'none';
  const board = (t) => { bd.element.style.display = ''; txt(bd, t); };
  await step(tok); // negative weighted edge
  edgeColor(sbE(2, 1), C.back, 1.8);
  say('這張小圖有一條負權重的邊', '3 → 2 = −3');
  await step(tok); // not distance
  board('權重不一定是用尺量的距離');
  say('權重怎麼會是負的？', '它不是用尺量的距離，是某種數值');
  await step(tok); // Dijkstra has not considered
  board('Dijkstra 沒有考慮負邊的情況');
  say('Dijkstra 沒有考慮過負邊', '照他的程序做做看');
  let show = sbDijShow(tok, 0, { endCap: '這次答案剛好正確', endF: '檢查 3 → 2：7 − 3 = 4 ≥ 3', endTalk: '答案對耶' });
  await sbRun(tok, sbDijEv(0, { direct: true, check: ['2-1'] }), [1, 1, 1, 1, 1, 1, 1], show);
  await step(tok); // change to −10
  fresh();
  buildGraph(sbNeg(-10));
  edgeColor(sbE(2, 1), C.back, 1.8);
  bd = tag('', 'note', 0, 0.3, 4.2); bd.element.style.display = 'none';
  say('把 −3 改成 −10，重新做一次', '');
  show = sbDijShow(tok, 0, { endCap: 'Dijkstra 給的答案：2 = 3', endF: '其實有更短的路', endTalk: '糟糕…', endSad: true });
  await sbRun(tok, sbDijEv(0, { direct: true }), [1, 1, 1, 1, 1, 2], show);
  await step(tok); // in a hurry
  sbPath([0, 3, 2, 1], C.back, 2.2);
  const p = await sbWalk(tok, '5 + 2 − 10 = −3', [0, 3, 2, 1], 600);
  board('太急著把 2 定成 3');
  say('太急著把 2 定案成 3', '走 1 → 4 → 3 → 2 只要 −3');
  await step(tok); // correct answer −3
  kill(p); nodeTag(1, '−3 才對', 'ptr alt');
  board('正確答案 −3，Dijkstra 給了 3 → 錯');
  say('正確答案是 −3', 'Dijkstra 給出錯的答案');
  await step(tok); // negative edge → may or may not
  board('有負邊：Dijkstra 可能對、可能錯');
  say('原因是負邊', '有負邊時 Dijkstra 可能對、也可能錯');
  await step(tok); // greedy doesn't try all
  board('greedy：沒試過所有可能就做決定');
  show.b.talk('我沒全部試過…');
  say('greedy 不會試所有可能', '看到目前最小的就選定');
  await step(tok); // Bellman-Ford
  board('另一個解法：Bellman-Ford（dynamic programming）');
  say('另一個解法：Bellman-Ford', '之後在 dynamic programming 講');
}]);

// ══════════ TechDose Bellman-Ford（FrLWd1tJ_Wc）══════════
// 00:00 Dijkstra vs Bellman-Ford：誰能偵測負 cycle
FRAG.push(['spbari-td-compare', 'Dijkstra vs Bellman-Ford：能否偵測負 cycle', async (tok) => {
  fresh([0, 11, 9], [0, 0, 0]);
  const dj = sbBuddy(-3.2, -2.2, 0.9, '#4b9ee2', 'Dijkstra');
  const bf = sbBuddy(3.2, -2.2, 0.9, '#dd8238', 'Bellman-Ford');
  await step(tok); // compare
  await dj.hop(tok); await bf.hop(tok);
  say('先比較 Dijkstra 和 Bellman-Ford', '兩個都是 single source shortest path');
  await step(tok); // neither finds shortest path with negative cycle
  dj.mood('sad'); bf.mood('sad');
  tag('有負權重 cycle → 兩個都找不到最短路徑', 'bad', 0, 0.3, 2.8);
  say('有負權重 cycle：兩個都找不到最短路徑', '');
  await step(tok); // Dijkstra cannot detect
  dj.talk('我看不出來'); tag('偵測不到負 cycle', 'ptr', -3.2, 0.3, 0.6);
  say('差別：Dijkstra 偵測不到負 cycle', '');
  await step(tok); // BF can detect
  bf.mood('happy'); bf.talk('我偵測得到！'); await bf.hop(tok);
  tag('偵測得到負 cycle', 'ptr alt', 3.2, 0.3, 0.6);
  say('Bellman-Ford 偵測得到', '');
  await step(tok); // BF says it has negative cycle
  bf.glow(GOLD); bf.talk('這張圖有負 cycle！');
  say('有負 cycle → Bellman-Ford 會直接回報', '');
  await step(tok); // otherwise shortest paths
  bf.glow(null); bf.talk('沒有？最短路徑給你');
  say('沒有負 cycle → 給出起點到每個點的最短路徑', '');
  await step(tok); // Dijkstra still gives an answer, may be wrong
  dj.mood('wow'); dj.talk('答案…（可能是錯的）');
  say('Dijkstra 遇到負 cycle 照樣給答案', '那個答案可能是錯的');
  await step(tok); // higher complexity
  tag('O(E log V)', 'idx', -3.2, 0.3, 1.6); tag('O(VE)', 'idx', 3.2, 0.3, 1.6);
  bf.mood('calm'); bf.talk('但我比較慢'); dj.mood('happy'); dj.talk('我比較快');
  say('代價：Bellman-Ford 的複雜度比較高', '影片最後再比');
}]);

// 01:38 負權重 cycle：2 + 3 − 6 = −1；換成 −3 → 2
FRAG.push(['spbari-td-cycle', '負 cycle：2 + 3 − 6 = −1', async (tok) => {
  fresh();
  buildGraph(sbTri(-6));
  const sum = tag('', 'note', 0, 0.3, 3.6);
  const b = sbBuddy(-5.2, 3.0, 0.5);
  const P = GR.nodes.map((nd) => nd.home);
  await step(tok); // 0 1 2 with 2 3 −6
  edgeColor(sbE(2, 0), C.back, 1.8); await b.hop(tok);
  say('三個頂點 0、1、2', '邊的權重 2、3、−6');
  await step(tok); // start from 0 and come back to 0
  await sbLoop(tok, P, [2, 3, -6], sum);
  say('從 0 出發，繞一圈回到 0', '');
  await step(tok); // 2 + 3 − 6 = −1
  txt(sum, '2 + 3 + (−6) = −1');
  say('成本 = 2 + 3 + (−6) = −1', '');
  await step(tok); // getting benefit of one unit
  b.mood('happy'); b.talk('沒花錢還賺 1！');
  say('總和是負的：沒花成本，反而賺 1', '');
  await step(tok); // negative edge weight cycle
  const nc = tag('negative edge weight cycle', 'bad', 0, 0.3, -3.6);
  say('這就是負權重 cycle', 'negative edge weight cycle');
  await step(tok); // −6 → −3
  kill(nc); setW(sbE(2, 0), -3); txt(sum, ''); b.mood('calm'); b.talk('換成 −3 呢？');
  say('如果 −6 換成 −3', '');
  await step(tok); // 2 + 3 − 3 = 2
  await sbLoop(tok, P, [2, 3, -3], sum);
  txt(sum, '2 + 3 + (−3) = 2 > 0');
  say('總和 2 是正的 → 不是負 cycle', '');
  await step(tok); // negative edge ≠ negative cycle
  b.talk('有負邊 ≠ 有負 cycle');
  say('只有負邊，不代表有負 cycle', '');
  await step(tok); // both correct
  tag('−3：Dijkstra ✓　Bellman-Ford ✓', 'ptr', 0, 0.3, -3.6);
  say('−3 時：兩個演算法都給出正確答案', '');
  await step(tok); // −6: BF reports, Dijkstra wrong
  setW(sbE(2, 0), -6); txt(sum, '2 + 3 − 6 = −1');
  tag('−6：Bellman-Ford 回報負 cycle；Dijkstra 給錯答案', 'bad', 0, 0.3, 4.5);
  b.mood('wow');
  say('換回 −6：Bellman-Ford 會說有負 cycle', 'Dijkstra 則給出錯的答案');
}]);

// 03:16 無向圖有負邊 → 一定有負 cycle
FRAG.push(['spbari-td-undirected', '無向圖有負邊 = 一定有負 cycle', async (tok) => {
  fresh();
  const bd = tag('', 'note', 0, 0.3, 3.8);
  const b = sbBuddy(-5.4, 2.6, 0.5);
  let pk = null;
  await step(tok); // special case
  txt(bd, '無向圖：有負邊 → 一定有負 cycle'); await b.hop(tok);
  say('無向圖的特殊情況', '只要有一條負邊，就一定有負 cycle');
  await step(tok); // two nodes
  buildGraph({ title: '無向', directed: false, names: ['0', '1'], pos: [[-5.4, 0], [-2.0, 0]], edges: [[0, 1, -2]] });
  say('假設圖只有 0、1 兩個頂點', '一條無向邊');
  await step(tok); // = 0→1 and 1→0
  buildGraph({ title: '有向', directed: true, names: ['0', '1'], pos: [[1.4, 0], [5.2, 0]], edges: [[0, 1, -2], [1, 0, -2]] });
  say('無向邊 = 0 → 1 加上 1 → 0', '');
  await step(tok); // both −2
  edgeColor(sbE(0, 1), C.back, 1.8); edgeColor(sbE(1, 0), C.back, 1.8);
  say('權重 −2：兩個方向都是 −2', '');
  await step(tok); // source 0: 0; to 1: −2
  nodeTag(0, '0', 'ptr');
  pk = await sbPkt(tok, '0 − 2 = −2', 0, 1, 800); nodeTag(1, '−2', 'ptr alt');
  say('起點 0 成本 0；到 1 是 −2', '');
  await step(tok); // 1 to 0: −4
  kill(pk); pk = await sbPkt(tok, '−2 − 2 = −4', 1, 0, 800); nodeTag(0, '−4', 'ptr alt');
  say('從 1 回到 0：−2 + (−2) = −4', '');
  await step(tok); // again 0 to 1: −6
  kill(pk); pk = await sbPkt(tok, '−4 − 2 = −6', 0, 1, 800); nodeTag(1, '−6', 'ptr alt');
  say('再到 1：−4 + (−2) = −6', '比 −2 小 → 取代');
  await step(tok); // infinite loop
  kill(pk); pk = await sbPkt(tok, '−8', 1, 0, 550); nodeTag(0, '−8', 'ptr alt');
  kill(pk); pk = await sbPkt(tok, '−10', 0, 1, 550); nodeTag(1, '−10', 'ptr alt');
  b.mood('wow'); b.talk('停不下來！');
  say('越來越小，變成無限迴圈', '');
  await step(tok); // surely negative cycle
  kill(pk); txt(bd, '無向圖 + 負邊 = 負 cycle');
  say('無向圖有負邊，一定有負權重 cycle', '');
  await step(tok); // both fail
  tag('Dijkstra ✗　Bellman-Ford ✗', 'bad', 0, 0.3, -3.2);
  b.mood('sad');
  say('Dijkstra 和 Bellman-Ford 都會失敗', '');
  await step(tok); // check for negative edge first
  txt(bd, '先掃一遍：有負邊 → 不能用最短路徑演算法');
  b.mood('calm'); b.talk('先檢查！');
  say('無向圖先檢查有沒有負邊', '有 → 不能用最短路徑演算法');
  await step(tok); // all positive → can apply
  txt(bd, '全部是正的 → 可以用');
  b.mood('happy');
  say('所有邊都是正的', '才能用最短路徑演算法');
}]);

// 05:31 Bellman-Ford 三步驟；為什麼是 V − 1 次
FRAG.push(['spbari-td-steps', 'Bellman-Ford 三步驟', async (tok) => {
  fresh();
  buildGraph({ title: '0, 1, 2', directed: true, names: ['0', '1', '2'], pos: [[-5.4, -1.4], [-3.6, 1.6], [-1.6, -1.4]], edges: [[0, 1, 1], [1, 2, 1]] });
  const cd = code([
    '1. d[src] = 0，其他 = ∞',
    '2. 重複 V − 1 次：',
    '     每條邊 (u, v) 都 relax',
    '     if d[u] + c(u,v) < d[v]:',
    '         d[v] = d[u] + c(u,v)',
    '3. 再 relax 一次：',
    '     還會變 → 有負 cycle',
  ], 2.6, -2.8, 0.75);
  const nt = tag('', 'note', -3.6, 0.3, 3.6); nt.element.style.display = 'none';
  const note = (t) => { nt.element.style.display = ''; txt(nt, t); };
  let pk = null;
  await step(tok); // step 1 init
  cd.hl(0); sbD([0, INF, INF]); nodeColor(0, C.ok, 0.3);
  say('第 1 步：起點 0，其他 ∞', '起點到自己的成本 = 0');
  await step(tok); // step 2 V−1 times
  cd.hl(1);
  say('第 2 步：relax 重複 V − 1 次', '');
  await step(tok); // relax all adjacent from source
  cd.hl(2); edgeColor(sbE(0, 1), C.hot, 1.8);
  pk = await sbPkt(tok, 'relax', 0, 1, 800); edgeColor(sbE(0, 1), C.edge, 1);
  say('從起點開始，relax 相鄰的邊', '');
  await step(tok); // why V−1: 3 nodes need 2 edges
  kill(pk); sbPath([0, 1, 2], C.hot, 2);
  pk = await sbWalk(tok, '2 條邊', [0, 1, 2], 600);
  say('3 個頂點：從頭走到尾最少要 2 條邊', '= V − 1');
  await step(tok); // V vertices → V−1 edges
  kill(pk); note('V 個頂點 → 要 V − 1 條邊 → relax V − 1 次');
  say('V 個頂點要 V − 1 條邊才能全部走到', '所以重複 V − 1 次');
  await step(tok); // u → v
  sbPath([0, 1, 2], C.edge, 1); sbD([null, null, null]);
  nodeNote(0, 'u'); nodeNote(1, 'v'); edgeColor(sbE(0, 1), C.hot, 1.8);
  say('relax：在 u，有一條邊 (u, v) 到 v', '');
  await step(tok); // d[u] and cost(u,v)
  nodeTag(0, 'd[u]', 'ptr');
  pk = await sbPkt(tok, 'd[u] + c(u,v)', 0, 1, 900);
  say('到 u 的成本 d[u]，加上邊的權重 c(u, v)', '');
  await step(tok); // d[v] via other path
  nodeTag(1, 'd[v]', 'ptr alt');
  say('v 原本也有成本 d[v]', '可能是從別條路來的');
  await step(tok); // new path lower → replace
  cd.hl(3); await kanim(tok, 700, () => {}); cd.hl(4);
  nodeTag(1, 'd[u] + c(u,v)', 'ptr alt'); txt(pk, '比較便宜 → 換');
  say('新路比較便宜 → 換掉舊路', 'd[v] = d[u] + c(u, v)');
  await step(tok); // greater → skip
  cd.hl(3); txt(pk, '比較貴 → 跳過'); sbCls(pk, 'bad');
  say('d[u] + c(u, v) 比 d[v] 大', '跳過，不更新');
  await step(tok); // step 3 relax once more
  kill(pk); cd.hl(5); edgeColor(sbE(0, 1), C.edge, 1);
  say('第 3 步：V − 1 輪後，再全部 relax 一次', '');
  await step(tok); // new shorter → negative cycle
  cd.hl(6);
  say('還找得到更短的 → 有負權重 cycle', '沒有 → 直接回傳答案');
}]);

// 08:37 Dry run：5 頂點，第 2 輪沒變化就停
FRAG.push(['spbari-td-dryrun', 'Bellman-Ford：TechDose 5 頂點 dry run', async (tok) => {
  fresh();
  buildGraph(SBT5);
  const ev = sbBFEv(0, { sum: true, stable: true });
  const show = sbBFShow(tok, 0, { endCap: '0 → 3 = 2、0 → 4 = 6', endF: '不用做滿 4 輪' });
  const fnV = async () => { show.b.talk('V = 5 → 最多 4 輪'); await show.b.hop(tok); say('V = 5（0～4）', 'V − 1 = 4 輪'); };
  await sbRun(tok, ev, [2, fnV, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], show);
}]);

// 12:59 提早停止；O(VE) vs Dijkstra O(E log V)
FRAG.push(['spbari-td-complexity', 'Bellman-Ford：提早停止與 O(VE)', async (tok) => {
  fresh([0, 11, 9], [0, 0, 0]);
  const b = sbBuddy(5.4, -2.2, 0.55);
  const bd = tag('', 'note', 2.6, 0.3, 3.6); bd.element.style.display = 'none';
  const board = (t) => { bd.element.style.display = ''; txt(bd, t); };
  const row = (r, col) => { tag('第 ' + (r + 1) + ' 輪', 'idx', -5.6, 0.3, -2.8 + r * 1.2); const cs = []; for (let j = 0; j < 7; j++) cs.push(cube('', col, [0.7, 0.3, 0.7], -4.2 + j * 0.95, 0.15, -2.8 + r * 1.2, 1.5)); return cs; };
  await step(tok); // a step updated → do next
  const r1 = row(0, '#efe3c8'); r1[0].material.color.set(C.ok); r1[2].material.color.set(C.ok);
  b.talk('有更新 → 再做一輪');
  say('某一輪至少有一個頂點更新', '就一定要做下一輪');
  await step(tok); // a step with no update
  row(1, '#d8cfc0');
  b.talk('這輪完全沒更新');
  say('如果某一輪完全沒有更新', '');
  await step(tok); // next will be the same → break
  row(2, '#ece6da'); row(3, '#ece6da');
  tag('不用做 → break', 'bad', 2.6, 0.3, 0.4);
  b.mood('happy'); b.talk('提早停！');
  say('下一輪 relax 一樣的邊，也不會有更新', '可以直接 break');
  await step(tok); // O(VE)
  board('Bellman-Ford：E 條邊 × (V − 1) 輪 = O(VE)'); b.mood('calm');
  say('時間複雜度 O(VE)', 'E 條邊、做 V − 1 輪');
  await step(tok); // Dijkstra E log V much faster
  tag('Dijkstra：O(E log V) → 快很多', 'ptr alt', 2.6, 0.3, 2.6);
  say('比 Dijkstra 的 O(E log V) 慢很多', '');
  await step(tok); // sure no negative edge → Dijkstra
  board('確定沒有負邊 → 用 Dijkstra');
  say('確定沒有負邊：用 Dijkstra', '');
  await step(tok); // not sure → BF
  board('不確定有沒有負邊 → 用 Bellman-Ford');
  say('不確定：用 Bellman-Ford', '');
  await step(tok); // undirected: scan edges
  board('無向圖：先掃邊；有負邊 → 都不能用；全正 → Dijkstra');
  b.talk('先掃一遍邊');
  say('無向圖可以先掃一遍所有邊', '有負邊兩個都不行；全是正的就用 Dijkstra');
}]);

// 15:03 偵測負 cycle：relax 2 輪後再一輪，0→1 又變小
FRAG.push(['spbari-td-detect', 'Bellman-Ford：多 relax 一輪偵測負 cycle', async (tok) => {
  fresh();
  buildGraph(sbTri(-6));
  const ev = sbBFEv(0, { rounds: 2, extra: 1, stopOnDetect: 1 });
  const show = sbBFShow(tok, 0, { endCap: '第 V 輪還找到更短的路', endF: '→ 確定有負權重 cycle' });
  const sum = tag('', 'note', 3.2, 0.3, 3.6); sum.element.style.display = 'none';
  const P = GR.nodes.map((nd) => nd.home);
  const fnDone = async () => { show.b.talk('V − 1 = 2 輪做完'); say('做完 V − 1 = 2 輪', '應該已經找到所有最短路徑'); await show.b.hop(tok); };
  const fnLoop1 = async () => { sum.element.style.display = ''; sbPath([0, 1, 2, 0], C.back, 2); await sbLoop(tok, P, [2, 3, -6], sum); txt(sum, '2 + 3 − 6 = −1'); say('這個 cycle：2 + 3 + (−6) = −1', '負權重 cycle'); };
  const fnLoop2 = async () => { await sbLoop(tok, P, [2, 3, -6], sum, -1); txt(sum, '再繞一圈：−2'); say('每繞一圈總和就少 1', '−1、−2、…'); };
  const fnEnd = async () => { show.b.mood('sad'); show.b.talk('永遠找不到最小'); say('有負 cycle 時', 'Dijkstra、Bellman-Ford 都求不出最短路徑'); };
  await sbRun(tok, ev, [2, 1, 1, 1, 1, 1, 1, fnDone, 1, 1, 1, fnLoop1, fnLoop2, fnEnd], show);
}]);

// ══════════ Abdul Bari 4.4 Bellman-Ford（FtN3BYH2Zes）══════════
// 00:00 為什麼需要：Dijkstra 遇負邊不保證對；BF 是 DP
FRAG.push(['spbari-bf-why', '為什麼要 Bellman-Ford：DP 試遍所有可能', async (tok) => {
  fresh();
  buildGraph(GRAPHS.bari7);
  const b = sbBuddy(-5.6, 3.6, 0.5);
  const bd = tag('', 'note', 1.6, 0.3, 4.2); bd.element.style.display = 'none';
  const board = (t) => { bd.element.style.display = ''; txt(bd, t); };
  await step(tok); // topic
  await b.hop(tok); b.talk('最短路徑！');
  say('single source shortest path', '這支影片：Bellman-Ford 怎麼做、缺點是什麼');
  await step(tok); // directed weighted graph, source 1
  nodeColor(0, C.ok, 0.3); nodeTag(0, '起點', 'ptr');
  await sbGo(tok, b, sbAt(0), 800);
  say('有向加權圖，起點選 1', '找 1 到其他每個頂點的最短路徑');
  await step(tok); // Dijkstra exists
  board('已經有 Dijkstra 了…');
  say('已經有 Dijkstra 可以解最短路徑', '');
  await step(tok); // not with negative edges
  GR.edges.forEach((e) => { if (e.w < 0) edgeColor(e, C.back, 1.8); });
  board('有負邊：Dijkstra 可能對、可能錯'); b.mood('wow');
  say('但有負邊時 Dijkstra 不一定正確', '沒辦法確認答案');
  await step(tok); // BF confirms correct answers
  board('Bellman-Ford：保證答案正確'); b.mood('happy');
  say('要一個能保證答案正確的演算法', '→ Bellman-Ford');
  await step(tok); // DP
  board('Bellman-Ford 用 dynamic programming');
  say('它用 dynamic programming', '');
  await step(tok); // try out all possible solutions
  GR.edges.forEach((e) => edgeColor(e, C.hot, 1.4)); await kanim(tok, 900, () => {});
  GR.edges.forEach((e) => edgeColor(e, e.w < 0 ? C.back : C.edge, e.w < 0 ? 1.8 : 1));
  board('DP：試遍所有可能，挑最好的');
  say('DP：試遍所有可能的解', '再挑最好的那個');
}]);

// 01:12 所有邊 relax n − 1 = 6 次；relax 的定義（以 2、5 為例）
FRAG.push(['spbari-bf-relax', 'Bellman-Ford：所有邊 relax n − 1 次', async (tok) => {
  fresh();
  buildGraph(GRAPHS.bari7);
  const b = sbBuddy(-5.6, 3.6, 0.5);
  const bd = tag('', 'note', 1.6, 0.3, 4.2); bd.element.style.display = 'none';
  const board = (t) => { bd.element.style.display = ''; txt(bd, t); };
  let pk = null;
  await step(tok); // relax all edges n − 1 times
  GR.edges.forEach((e) => edgeColor(e, C.hot, 1.4)); await kanim(tok, 800, () => {});
  GR.edges.forEach((e) => edgeColor(e, C.edge, 1));
  board('所有的邊，反覆 relax n − 1 次');
  say('把所有邊反覆 relax', '共 n − 1 次');
  await step(tok); // 7 vertices → 6
  board('n = 7 個頂點 → relax 7 − 1 = 6 次'); b.talk('6 次！');
  say('n = 頂點數 = 7', 'relax 7 − 1 = 6 次');
  await step(tok); // longest path has 6 edges
  const lp = [0, 3, 2, 1, 4, 6];
  sbPath(lp, C.hot, 2);
  pk = await sbWalk(tok, '最多 6 條邊', lp, 380);
  say('從 1 到 7 的路徑，最多 6 條邊', '');
  await step(tok); // covers all paths
  kill(pk); sbPath(lp, C.edge, 1);
  board('relax 6 次 → 連最長的路徑也涵蓋');
  say('relax 6 次就能涵蓋所有可能的路徑', '');
  await step(tok); // take 2 and 5
  edgeColor(sbE(1, 4), C.hot, 2); nodeColor(1, C.pq, 0.3); nodeColor(4, C.pq, 0.3);
  say('relaxation 是什麼？拿 2、5 當例子', '');
  await step(tok); // path to this plus this < this → change
  nodeTag(1, '到 2 的距離', 'ptr'); nodeTag(4, '到 5 的距離', 'ptr alt');
  pk = await sbPkt(tok, '+ 這條邊', 1, 4, 900);
  say('到 2 的距離 + 這條邊，比到 5 的距離短？', '是 → 改掉到 5 的距離');
  await step(tok); // call them u and v
  kill(pk); nodeNote(1, 'u'); nodeNote(4, 'v'); nodeTag(1, 'd[u]', 'ptr'); nodeTag(4, 'd[v]', 'ptr alt');
  say('把它們叫 u 和 v', '');
  await step(tok); // condition
  board('if d[u] + c(u, v) < d[v]');
  say('邊 (u, v)：if d[u] + c(u, v) < d[v]', '');
  await step(tok); // update
  board('then d[v] = d[u] + c(u, v)'); nodeTag(4, 'd[u] + c(u,v)', 'ptr alt'); b.mood('happy');
  say('成立就改：d[v] = d[u] + c(u, v)', '解題時再示範');
}]);

// 02:56 7 頂點例子（cued 版 bf-bari7）
FRAG.push(['spbari-bf-bari7', 'Bellman-Ford：7 頂點逐輪 relax', async (tok) => {
  fresh();
  buildGraph(GRAPHS.bari7);
  const ev = sbBFEv(0, { stable: true });
  const show = sbBFShow(tok, 0, { endCap: '1～7：0、1、3、5、0、4、3', endF: '再做兩輪也一樣' });
  const fn6 = async () => { show.b.talk('10 條邊 × 6 次'); say('照頂點順序列，共 10 條邊', '全部 relax 6 次'); await show.b.hop(tok); };
  const fnHand = async () => { show.b.talk('程式會做滿 n − 1 輪'); say('手算可以停；程式照樣做滿 n − 1 輪', ''); };
  const fnSome = async () => { show.b.talk('有快有慢'); say('有的圖第 1 輪就好', '有的要到最後一輪才收斂'); };
  await sbRun(tok, ev, [1, fn6, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    3, 1, 1, 2, 1, 1, 1,
    3, 1, 1, 1, 1, 2, 1,
    3, 2, 2, 3,
    1, 1, fnHand, fnSome], show);
}]);

// 09:04 複雜度：(V − 1) × E = O(VE)；一般 n²，完全圖 n³（2raV0H9KqY8 用 params.sp：少最後一句）
FRAG.push(['spbari-bf-complexity', 'Bellman-Ford 複雜度：O(VE)，完全圖 O(n³)', async (tok) => {
  const p = ctx.params || {};
  fresh([0, 11, 9], [0, 0, 0]);
  const b = sbBuddy(5.6, -3.4, 0.5);
  const bd = tag('', 'note', 2.4, 0.3, 4.0); bd.element.style.display = 'none';
  const board = (t) => { bd.element.style.display = ''; txt(bd, t); };
  await step(tok); // E edges
  cube('E 條邊', '#efe3c8', [4.2, 0.35, 0.6], -3.4, 0.18, -3.0, 2);
  say('relax 全部的邊：E 條', '');
  await step(tok); // V − 1 times
  for (let r = 0; r < 6; r++) {
    if (r) cube('E 條邊', '#efe3c8', [4.2, 0.35, 0.6], -3.4, 0.18, -3.0 + r * 0.8, 2);
    tag('第 ' + (r + 1) + ' 輪', 'idx', -6.1, 0.3, -3.0 + r * 0.8);
    await kanim(tok, 300, () => {});
  }
  say('做幾次？V − 1 次', '');
  await step(tok); // O(VE)
  board('時間 = O(V · E)');
  say('時間 = O(V · E)', '');
  await step(tok); // n²
  board('V、E 都看成 n → O(n²)');
  say('V、E 都看成 n', '→ O(n²)');
  await step(tok); // complete graph
  buildGraph({ title: 'K5', directed: false, names: ['1', '2', '3', '4', '5'],
    pos: [[3.4, -2.6], [5.6, -1.0], [4.8, 1.6], [2.0, 1.6], [1.2, -1.0]],
    edges: [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]] });
  b.mood('wow');
  say('完全圖：每一對頂點之間都有邊', '');
  await step(tok); // n(n−1)/2
  GR.edges.forEach((e) => edgeColor(e, C.hot, 1.4));
  board('完全圖：E = n(n − 1) / 2 ≈ n²');
  say('邊數 E = n(n − 1) / 2', '');
  await step(tok); // × (n − 1)
  board('n(n − 1)/2 × (n − 1)');
  say('時間 = n(n − 1)/2 × (n − 1)', 'E 乘上輪數');
  await step(tok); // n³
  board('= O(n³)'); b.talk('n³！'); await b.hop(tok);
  say('化簡 → O(n³)', '完全圖時 Bellman-Ford 要 n³');
  if (!p.sp) {
    await step(tok); // min n², max n³
    board('最少約 O(n²)，完全圖最多 O(n³)');
    say('最少約 n²', '完全圖時最多 n³');
  }
}]);

// 10:21 4 頂點、邊倒序（cued 版 bf-bari4）
FRAG.push(['spbari-bf-bari4', 'Bellman-Ford：倒序的邊要到第 3 輪才收斂', async (tok) => {
  fresh();
  buildGraph(GRAPHS.bari4);
  const ev = sbBFEv(0, { extra: 1 });
  const show = sbBFShow(tok, 0, { endCap: '多 relax 一次也沒有變化', endF: '→ 答案正確' });
  const fnRev = async () => { show.b.talk('故意倒過來'); say('邊的順序故意倒過來', '讓你看出 relax 順序的影響'); await show.b.hop(tok); };
  const fn3 = async () => { show.b.talk('4 個頂點 → 3 輪'); say('4 個頂點 → relax 4 − 1 = 3 輪', ''); };
  const fnRes = async () => { show.b.mood('happy'); show.b.talk('0、−2、8、5'); say('結果：1 = 0、2 = −2、3 = 8、4 = 5', ''); };
  const fnNeg = async () => { show.b.talk('負邊也沒問題'); say('有負邊，Bellman-Ford 也求得出來', ''); await show.b.hop(tok); };
  await sbRun(tok, ev, [1, fnRev, 1, fn3, 1, 1, 1, 1, 1, 1, 2, 1, 3, fnRes, fnNeg, 1, 4, 1], show);
}]);

// 13:19 加 2→4 = 5：負 cycle（cued 版 bf-detect-cycle）
FRAG.push(['spbari-bf-cycle4', 'Bellman-Ford 偵測負 cycle：多做一輪還在變', async (tok) => {
  fresh();
  buildGraph(GRAPHS.bari4c);
  const ev = sbBFEv(0, { extra: 2, stopOnDetect: 2 });
  const show = sbBFShow(tok, 0, { endCap: '還在一直變小', endF: '答案定不下來' });
  const sum = tag('', 'note', 3.6, 0.3, 4.4); sum.element.style.display = 'none';
  const cyc = [1, 3, 2];
  const P = cyc.map((v) => GR.nodes[v].home);
  const fnAdd = async () => { edgeColor(sbE(1, 3), C.hot, 2); await kanim(tok, 800, () => {}); edgeColor(sbE(1, 3), C.edge, 1); say('同一張圖，加一條 2 → 4 = 5', ''); };
  const fnShould = async () => { show.b.talk('不應該再變！'); say('做完 n − 1 輪後', '再 relax 一次不應該有任何改變'); };
  const fnCyc = async () => { sbPath([1, 3, 2, 1], C.back, 2.2); show.b.talk('2 → 4 → 3 → 2'); say('原因：2、4、3 形成一個 cycle', ''); };
  const fnSum = async () => { sum.element.style.display = ''; await sbLoop(tok, P, [5, 3, -10], sum); txt(sum, '5 + 3 − 10 = −2'); say('cycle 總權重：5 + 3 − 10 = −2', '是負的'); };
  const fnMore = async () => { await sbLoop(tok, P, [5, 3, -10], sum, -2); txt(sum, '每繞一圈再少 2'); say('每繞一圈，路徑就更短', '答案永遠定不下來'); };
  const fnFail = async () => { show.b.mood('sad'); show.b.talk('解不了'); say('有負權重 cycle 的圖：無解', 'Bellman-Ford 也解不了'); };
  const fnDetect = async () => { show.b.mood('happy'); show.b.talk('但我偵測得到！'); await show.b.hop(tok); say('但 Bellman-Ford 偵測得到', 'n − 1 輪後再 relax 一次，還會變 → 有負 cycle'); };
  await sbRun(tok, ev, [fnAdd, 2, 2, 2, 1, 1, 1, 3, 1, 3, 1, 1, 1, 1, 3, fnShould, 2, 1, fnCyc, fnSum, fnMore, fnFail, fnDetect], show);
}]);

// ══════════ Abdul Bari 4.2 Floyd-Warshall（oNI0rf2P9gE）══════════
const FW4 = { title: 'Bari 4 頂點', directed: true, names: ['1', '2', '3', '4'],
  pos: [[-5.6, -2.2], [-1.8, -2.2], [-1.8, 1.6], [-5.6, 1.6]],
  edges: [[0, 1, 3], [0, 3, 7], [1, 0, 8], [1, 2, 2], [2, 0, 5], [2, 3, 1], [3, 0, 2]] };
const SUP = ['⁰', '¹', '²', '³', '⁴'];
function fwA0() { const D = [...Array(4)].map((_, i) => [...Array(4)].map((_, j) => (i === j ? 0 : INF))); FW4.edges.forEach(([u, v, w]) => { D[u][v] = w; }); return D; }
function fwStep(D, k) { const N = D.map((r) => r.slice()); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) N[i][j] = Math.min(D[i][j], D[i][k] + D[k][j]); return N; }
function fwAt(k) { let D = fwA0(); for (let t = 0; t < k; t++) D = fwStep(D, t); return D; }
const FWBASE = '#efe6d2', FWROW = '#f3dfa8';
function fwMat(D, k) {
  const mx = (j) => 1.4 + j * 1.15, mz = (i) => -2.3 + i * 1.0;
  for (let i = 0; i < 4; i++) { tag(String(i + 1), 'idx', 0.55, 0.3, mz(i)); tag(String(i + 1), 'idx', mx(i), 0.3, -3.2); }
  const kl = tag('A' + SUP[k], 'ptr alt', 0.5, 0.3, -3.3);
  const cells = D.map((row, i) => row.map((v, j) => {
    const m = lab.box(FWBASE, [1.0, 0.2, 0.85]); m.position.set(mx(j), 0.1, mz(i));
    m.userData.l = lab.label(fmt(v), 'val'); m.add(m.userData.l); lab.world.add(m); return m;
  }));
  return {
    cells, kl,
    set(i, j, v, c) { txt(cells[i][j].userData.l, fmt(v)); if (c) cells[i][j].material.color.set(c); },
    paint(kk) { cells.forEach((row, i) => row.forEach((m, j) => { m.material.color.set(kk >= 0 && (i === kk || j === kk) ? FWROW : FWBASE); glow(m, null); })); },
    title(t) { txt(kl, t); },
  };
}
function fwScene(k) { fresh([0, 12.5, 8], [0, 0, -0.3]); buildGraph(FW4, { scale: 0.85, dx: -0.4 }); const D = fwAt(k); return { D, M: fwMat(D, k) }; }
const fwGlow = (M, cs, c) => cs.forEach(([i, j]) => glow(M.cells[i][j], c));
// 換到 A^(k+1)：標題、第 k+1 列與行
function fwHead(M, k) { M.title('A' + SUP[k + 1]); M.paint(k); for (let v = 0; v < 4; v++) nodeColor(v, v === k ? C.hot : C.white, v === k ? 0.5 : 0); }
// 這一階段其他變小的格子（講者「同樣算」）快速填上
async function fwRest(tok, M, old, N, skip) {
  const rest = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (N[i][j] < old[i][j] && !skip.some(([a, b]) => a === i && b === j)) rest.push([i, j]);
  for (const [i, j] of rest) { M.set(i, j, N[i][j], C.ok); await kanim(tok, 400, () => {}); }
  return rest.map(([i, j]) => (i + 1) + '→' + (j + 1) + ' = ' + fmt(N[i][j])).join('、');
}
function fwNote() { const l = tag('', 'note', -2.6, 0.3, 3.9); l.element.style.display = 'none'; return (t) => { l.element.style.display = t ? '' : 'none'; txt(l, t || ''); }; }

// 00:00 所有點對最短路徑；Dijkstra 跑 n 次 = O(n³)
FRAG.push(['spbari-fw-problem', 'All pairs shortest path', async (tok) => {
  fresh();
  buildGraph(FW4, { scale: 1.1, dx: 3.6, dz: 0.3 });
  const b = sbBuddy(-4.8, 3.2, 0.55);
  const bd = tag('', 'note', -3.6, 0.3, 0.2); bd.element.style.display = 'none';
  const board = (t) => { bd.element.style.display = ''; txt(bd, t); };
  let ps = [];
  const fan = async (s) => { ps.forEach(kill); for (let v = 0; v < 4; v++) nodeColor(v, v === s ? C.ok : C.white, v === s ? 0.4 : 0); ps = await sbFan(tok, s, [0, 1, 2, 3].filter((v) => v !== s), 900); };
  await step(tok); // every pair
  board('每一對頂點之間的最短路徑'); await b.hop(tok);
  say('All pairs shortest path', '找每一對頂點之間的最短路徑');
  await step(tok); // from 1
  await fan(0);
  say('起點 1：1→2、1→3、1→4', '');
  await step(tok); // from 2
  await fan(1);
  say('起點 2：到 1、3、4', '');
  await step(tok); // from 3 and 4
  await fan(2); await fan(3);
  say('起點 3、起點 4 也一樣', '');
  await step(tok); // looks like Dijkstra
  ps.forEach(kill); ps = []; nodeColor(3, C.white, 0);
  board('很像 single source shortest path（Dijkstra）'); b.talk('Dijkstra？');
  say('看起來像 single source：Dijkstra', '');
  await step(tok); // Dijkstra n²
  board('Dijkstra：一個起點，O(n²)');
  say('Dijkstra 只處理一個起點', '一次 O(n²)');
  await step(tok); // n times → n³
  for (let v = 0; v < 4; v++) { nodeColor(v, C.ok, 0.3); await kanim(tok, 300, () => {}); }
  board('每個頂點各跑一次：n × O(n²) = O(n³)');
  say('對 n 個頂點各跑一次 Dijkstra', 'n × O(n²) = O(n³)');
  await step(tok); // DP
  for (let v = 0; v < 4; v++) nodeColor(v, C.white, 0);
  board('這裡改用 dynamic programming'); b.mood('happy'); b.talk('換 DP！');
  say('也能用 greedy 解；這裡看 DP 怎麼做', '');
}]);

// 01:34 DP：一連串決策——要不要經過中間頂點 k
FRAG.push(['spbari-fw-idea', 'Floyd-Warshall 的決策：經過哪個中間頂點', async (tok) => {
  fresh();
  buildGraph(FW4, { scale: 1.1, dx: 3.6, dz: 0.3 });
  const b = sbBuddy(-4.8, 3.2, 0.55);
  const bd = tag('', 'note', -3.6, 0.3, 0.2); bd.element.style.display = 'none';
  const board = (t) => { bd.element.style.display = ''; txt(bd, t); };
  let pk = null;
  await step(tok); // sequence of decisions
  board('DP：一連串的決策，每階段做一個'); await b.hop(tok);
  say('DP：每個階段做一個決策', 'sequence of decisions');
  await step(tok); // 1 → 2 direct
  edgeColor(sbE(0, 1), C.hot, 2);
  pk = await sbPkt(tok, '直接：3', 0, 1, 800);
  say('1 → 2：可能直接邊就最短', '');
  await step(tok); // via 3
  kill(pk); nodeColor(2, C.pq, 0.4); nodeTag(2, '經過 3？', 'ptr alt');
  say('也可能經過頂點 3 比較短', '');
  await step(tok); // via 4
  nodeColor(2, C.white, 0); nodeTag(2, '', ''); nodeColor(3, C.pq, 0.4); nodeTag(3, '經過 4？', 'ptr alt');
  say('或經過頂點 4', '');
  await step(tok); // middle vertex 1 first
  nodeColor(3, C.white, 0); nodeTag(3, '', ''); edgeColor(sbE(0, 1), C.edge, 1);
  nodeColor(0, C.hot, 0.5); nodeTag(0, '中間點', 'ptr alt');
  board('第 1 階段：所有點對，經過 1 會更短嗎？');
  say('先選中間頂點 = 1', '所有點對都檢查：經過 1 會不會更短');
  await step(tok); // then 2, 3, 4
  for (let k = 1; k < 4; k++) {
    nodeColor(k - 1, C.white, 0); nodeTag(k - 1, '', '');
    nodeColor(k, C.hot, 0.5); nodeTag(k, '中間點', 'ptr alt');
    await kanim(tok, 600, () => {});
  }
  board('再經過 2、3、4 → 一連串的決策');
  say('再經過 2、經過 3…', '這就是 sequence of decisions');
}]);

// 02:32 A⁰：鄰接矩陣（對角線 0，沒有邊 ∞）
FRAG.push(['spbari-fw-a0', 'Floyd-Warshall：A⁰ 鄰接矩陣', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(FW4, { scale: 0.85, dx: -0.4 });
  const D = fwA0();
  const M = fwMat(D.map((r) => r.map(() => null)), 0);
  M.cells.forEach((row) => row.forEach((m) => txt(m.userData.l, '')));
  const note = fwNote();
  await step(tok); // matrices; adjacency matrix
  note('A⁰ = 原圖的鄰接矩陣');
  say('用矩陣來做：A⁰ 是鄰接矩陣', '');
  await step(tok); // diagonal 0
  for (let i = 0; i < 4; i++) { M.set(i, i, 0, '#d8cfc0'); await kanim(tok, 250, () => {}); }
  say('對角線 = 0', '自己到自己；沒有 self loop');
  for (const [i, j, t] of [[0, 1, '有邊：1 → 2 = 3'], [1, 2, '有邊：2 → 3 = 2']]) {
    await step(tok);
    if (i === 1) { edgeColor(sbE(0, 1), C.edge, 1); glow(M.cells[0][1], null); }
    edgeColor(sbE(i, j), C.hot, 2); glow(M.cells[i][j], GOLD); M.set(i, j, D[i][j]);
    say(t, '填權重');
  }
  await step(tok); // 3 → 2 none → ∞
  edgeColor(sbE(1, 2), C.edge, 1); glow(M.cells[1][2], null);
  glow(M.cells[2][1], RED); M.set(2, 1, INF);
  say('3 → 2 沒有邊', '記成 ∞');
  await step(tok); // fill all
  glow(M.cells[2][1], null);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) M.set(i, j, D[i][j]);
  note('有邊 = 權重；沒邊 = ∞；對角線 = 0');
  say('A⁰ 填好了', '有邊 = 權重，沒邊 = ∞');
}]);

// 03:25 A¹：經過頂點 1（2→3 不變、2→4 = 15、3→2 = 8）
FRAG.push(['spbari-fw-a1', 'Floyd-Warshall：A¹（經過頂點 1）', async (tok) => {
  const { D, M } = fwScene(0);
  const note = fwNote();
  const N = fwStep(D, 0);
  let pk = null;
  await step(tok); // A¹ from A⁰ via 1
  fwHead(M, 0); M.paint(-1);
  say('A¹：中間頂點 = 1', '由 A⁰ 算出來');
  await step(tok); // row 1, col 1 unchanged
  M.paint(0);
  say('第 1 列、第 1 行照抄', '0 3 ∞ 7；8、5、2');
  await step(tok); // diagonals
  fwGlow(M, [[0, 0], [1, 1], [2, 2], [3, 3]], GOLD); await kanim(tok, 700, () => {}); fwGlow(M, [[0, 0], [1, 1], [2, 2], [3, 3]], null);
  say('對角線也照抄：0', '');
  await step(tok); // A⁰[2,3] = 2
  glow(M.cells[1][2], GOLD); note('A⁰[2,3] = 2');
  say('2 → 3：A⁰[2,3] = 2', '');
  await step(tok); // 8 + ∞
  fwGlow(M, [[1, 0], [0, 2]], RED); note('A⁰[2,1] + A⁰[1,3] = 8 + ∞ = ∞');
  say('經過 1：A⁰[2,1] + A⁰[1,3]', '8 + ∞ = ∞');
  await step(tok); // keep 2
  fwGlow(M, [[1, 0], [0, 2], [1, 2]], null); M.set(1, 2, 2); note('min(2, ∞) = 2 → 維持');
  say('經過 1 沒有更短', 'A¹[2,3] = 2');
  await step(tok); // A⁰[2,4] = ∞
  glow(M.cells[1][3], GOLD); note('A⁰[2,4] = ∞');
  say('2 → 4：A⁰[2,4] = ∞', '');
  await step(tok); // 8 + 7 = 15
  fwGlow(M, [[1, 0], [0, 3]], RED); note('A⁰[2,1] + A⁰[1,4] = 8 + 7 = 15');
  pk = await sbWalk(tok, '8 + 7', [1, 0, 3], 600);
  say('經過 1：A⁰[2,1] + A⁰[1,4]', '8 + 7 = 15');
  await step(tok); // update 15
  fwGlow(M, [[1, 0], [0, 3], [1, 3]], null); M.set(1, 3, 15, C.ok); note('15 < ∞ → 更新成 15');
  say('15 < ∞ → 更新成 15', '');
  await step(tok); // 2 → 1 → 4
  kill(pk); sbPath([1, 0, 3], C.tree);
  say('意思是：2 → 1 → 4，8 + 7 = 15', '沒有直接邊，但經過 1 有路');
  await step(tok); // 3 → 2
  sbPath([1, 0, 3], C.edge, 1);
  glow(M.cells[2][1], GOLD); fwGlow(M, [[2, 0], [0, 1]], RED);
  note('A⁰[3,2] = ∞ 對比 A⁰[3,1] + A⁰[1,2] = 5 + 3');
  say('3 → 2：∞ 對比 5 + 3', '');
  await step(tok); // 8
  fwGlow(M, [[2, 1], [2, 0], [0, 1]], null); M.set(2, 1, 8, C.ok); note('5 + 3 = 8 < ∞ → 8');
  say('得到比較小的 8', 'A¹[3,2] = 8');
  await step(tok); // rest
  const r = await fwRest(tok, M, D, N, [[1, 2], [1, 3], [2, 1]]);
  note('A¹ 完成：經過頂點 1');
  say('其他格子同樣算', r);
}]);

// 06:43 A²、A³、A⁴：最後的矩陣就是答案
FRAG.push(['spbari-fw-a2a4', 'Floyd-Warshall：A² → A³ → A⁴', async (tok) => {
  const { D, M } = fwScene(1);
  const note = fwNote();
  let pk = null;
  let N = fwStep(D, 1);
  await step(tok); // A² via 2
  fwHead(M, 1); M.paint(-1);
  say('A²：中間頂點 = 2', '由 A¹ 算出來');
  await step(tok); // row 2, col 2
  M.paint(1);
  say('第 2 列、第 2 行照抄', '8 0 2 15；3 0 8 5');
  await step(tok); // A¹[1,3] = ∞
  glow(M.cells[0][2], GOLD); note('A¹[1,3] = ∞');
  say('1 → 3：A¹[1,3] = ∞', '');
  await step(tok); // 3 + 2 = 5
  fwGlow(M, [[0, 1], [1, 2]], RED); note('A¹[1,2] + A¹[2,3] = 3 + 2 = 5');
  pk = await sbWalk(tok, '3 + 2', [0, 1, 2], 600);
  say('經過 2：A¹[1,2] + A¹[2,3]', '3 + 2 = 5');
  await step(tok); // update 5
  kill(pk); fwGlow(M, [[0, 1], [1, 2], [0, 2]], null); M.set(0, 2, 5, C.ok); note('5 < ∞ → 更新成 5');
  say('5 比較小 → 更新成 5', '1 → 2 → 3');
  await step(tok); // A¹[1,4] = 7
  glow(M.cells[0][3], GOLD); note('A¹[1,4] = 7');
  say('1 → 4：A¹[1,4] = 7', '');
  await step(tok); // 3 + 15 = 18
  fwGlow(M, [[0, 1], [1, 3]], RED); note('A¹[1,2] + A¹[2,4] = 3 + 15 = 18');
  say('經過 2：3 + 15 = 18', '');
  await step(tok); // keep 7
  fwGlow(M, [[0, 1], [1, 3], [0, 3]], null); note('min(7, 18) = 7 → 維持');
  say('原本的 7 比較好', 'A²[1,4] = 7');
  await step(tok); // rest of A²
  let r = await fwRest(tok, M, D, N, [[0, 2], [0, 3]]);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) D[i][j] = N[i][j];
  note('A² 完成：經過頂點 2');
  say('其他格子同樣算', r);
  await step(tok); // A³ via 3
  N = fwStep(D, 2); fwHead(M, 2); M.cells.forEach((row) => row.forEach((m) => { if (m.material.color.getHexString() === '2fc092') m.material.color.set(FWBASE); }));
  M.paint(2);
  say('A³：中間頂點 = 3', '第 3 列 5 8 0 1、第 3 行 5 2 0 7 照抄');
  await step(tok); // 1 → 2 via 3: 5 + 8 = 13
  glow(M.cells[0][1], GOLD); fwGlow(M, [[0, 2], [2, 1]], RED);
  note('A²[1,2] = 3 對比 A²[1,3] + A²[3,2] = 5 + 8 = 13');
  say('1 → 2：3 對比 5 + 8 = 13', '');
  await step(tok); // keep 3
  fwGlow(M, [[0, 1], [0, 2], [2, 1]], null); note('min(3, 13) = 3 → 維持');
  say('3 本身就比較小', 'A³[1,2] = 3');
  await step(tok); // rest of A³
  r = await fwRest(tok, M, D, N, [[0, 1]]);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) D[i][j] = N[i][j];
  note('A³ 完成：經過頂點 3');
  say('其他格子同樣算', r);
  await step(tok); // A⁴
  N = fwStep(D, 3); fwHead(M, 3);
  r = await fwRest(tok, M, D, N, []);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) D[i][j] = N[i][j];
  note('A⁴：經過頂點 4');
  say('最後做到頂點 4：A⁴', r);
  await step(tok); // all pairs shortest
  M.paint(-1); nodeColor(3, C.white, 0);
  note('A⁴ = 每一對頂點的最短距離');
  say('A⁴ 就是每一對頂點的最短距離', '');
  await step(tok); // sequence of decisions
  note('A⁰ → A¹ → A² → A³ → A⁴：每階段一個決策');
  say('每個階段做一個決策', '得到一個矩陣');
}]);

// 10:18 公式：A^k[i,j] = min(A^(k−1)[i,j], A^(k−1)[i,k] + A^(k−1)[k,j])
FRAG.push(['spbari-fw-formula', 'Floyd-Warshall 公式', async (tok) => {
  const { M } = fwScene(2);
  const note = fwNote();
  M.title('A²');
  await step(tok); // any matrix from previous
  note('每個矩陣都由前一個算出來');
  say('任何一個矩陣的值', '都從前一個矩陣來');
  await step(tok); // A³ from A²
  fwHead(M, 2);
  note('A⁴ ← A³，A³ ← A²：A^k ← A^(k−1)');
  say('A⁴ 由 A³、A³ 由 A² 算出', 'A^k 由 A^(k−1) 來');
  await step(tok); // formula of A^k[i,j]
  note('A^k[i, j] = min( ?, ? )');
  say('寫成公式：A^k[i, j] = min(…)', '');
  await step(tok); // A^(k−1)[i,j]
  glow(M.cells[1][3], GOLD); note('第一項：A^(k−1)[i, j]　例：A²[2,4] = 15');
  say('第一項：前一個矩陣的 A^(k−1)[i, j]', '例：A²[2,4] = 15');
  await step(tok); // A^(k−1)[i,k] + A^(k−1)[k,j]
  fwGlow(M, [[1, 2], [2, 3]], RED); note('第二項：A^(k−1)[i, k] + A^(k−1)[k, j]　例：2 + 1 = 3');
  say('第二項：A^(k−1)[i, k] + A^(k−1)[k, j]', '例：A²[2,3] + A²[3,4] = 2 + 1 = 3');
  await step(tok); // smaller one
  M.set(1, 3, 3, C.ok); fwGlow(M, [[1, 2], [2, 3], [1, 3]], null);
  note('k 插在中間相加，取較小的：min(15, 3) = 3');
  say('k 插在 i、j 中間相加', '兩個取較小的：min(15, 3) = 3');
  await step(tok); // same formula for all
  note('A^k[i, j] = min(A^(k−1)[i, j], A^(k−1)[i, k] + A^(k−1)[k, j])');
  say('所有矩陣都用同一個公式', '先看做法，再推出公式');
}]);

// 11:55 程式：三層迴圈、一個 2D 陣列就地更新 → Θ(n³)
FRAG.push(['spbari-fw-code', 'Floyd-Warshall 程式：Θ(n³)', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const D = fwA0();
  const M = fwMat(D, 0);
  const cd = code([
    'for (k = 1; k <= n; k++)',
    '  for (i = 1; i <= n; i++)',
    '    for (j = 1; j <= n; j++)',
    '      A[i][j] = min(A[i][j],',
    '                A[i][k] + A[k][j]);',
  ], -3.4, -2.4, 0.7);
  const note = fwNote();
  let A = D;
  const runK = async (k) => {
    M.title('A' + SUP[k + 1]); M.paint(k);
    const N = fwStep(A, k);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (N[i][j] < A[i][j]) M.set(i, j, N[i][j], C.ok);
    A = N; await kanim(tok, 900, () => {});
  };
  await step(tok); // four matrices
  note('要產生 4 個矩陣：A¹、A²、A³、A⁴');
  say('一共產生 4 個矩陣', '');
  await step(tok); // n × n terms
  for (let i = 0; i < 4; i++) { M.cells[i].forEach((m) => glow(m, GOLD)); await kanim(tok, 300, () => {}); M.cells[i].forEach((m) => glow(m, null)); }
  note('每個矩陣有 n × n 個值');
  say('每個矩陣有 n × n 個值', '要一格一格算');
  await step(tok); // two for loops
  cd.hl(1); await kanim(tok, 700, () => {}); cd.hl(2);
  say('兩層迴圈 i、j', '走過每一格');
  await step(tok); // A[i][j] = min(A[i][j],
  cd.hl(3);
  say('A[i][j] = min(A[i][j], …)', '');
  await step(tok); // single 2D array
  note('只用一個 2D 陣列，就地更新');
  say('只用一個 2D 陣列', '在同一個陣列裡更新');
  await step(tok); // A[i][k] + A[k][j]
  cd.hl(4);
  say('另一項：A[i][k] + A[k][j]', '兩個取較小的');
  await step(tok); // k changes the intermediate
  note('兩層迴圈只產生一個矩陣；k = 中間頂點');
  say('k 是中間頂點', '兩層迴圈只產生一個矩陣');
  await step(tok); // for k
  cd.hl(0);
  say('最外層：for k = 1 到 n', '');
  await step(tok); // k = 1, 2
  await runK(0); await runK(1);
  say('k = 1 → 第 1 個矩陣；k = 2 → 第 2 個', '');
  await step(tok); // k = 3, 4
  await runK(2); await runK(3);
  M.paint(-1);
  say('k = 3、k = 4', '每個 k 產生一個矩陣');
  await step(tok); // Θ(n³)
  cd.hl(-1); note('三層巢狀迴圈 → Θ(n³)');
  say('三層巢狀迴圈', 'Θ(n³)');
}]);

// ══════════ Abdul Bari：Shortest Path Algorithms（2raV0H9KqY8）══════════
// 00:00 t → u → v：單邊路徑與 relaxation（5 + 3 = 8）
FRAG.push(['spbari-sp-tuv', '最短路徑與 relax：t → u → v', async (tok) => {
  fresh();
  const dj = sbBuddy(-2.2, -3.8, 0.45, '#4b9ee2', 'Dijkstra');
  const bf = sbBuddy(2.2, -3.8, 0.45, '#dd8238', 'Bellman-Ford');
  const bd = tag('', 'note', 0, 0.3, 3.6); bd.element.style.display = 'none';
  const board = (t) => { bd.element.style.display = ''; txt(bd, t); };
  let b = null, pk = null;
  await step(tok); // two algorithms
  await dj.hop(tok); await bf.hop(tok);
  say('兩個最短路徑演算法', 'Dijkstra 與 Bellman-Ford');
  await step(tok); // problem
  board('問題：從一個頂點，到其他所有頂點的最短路徑');
  say('從一個頂點到其他所有頂點的最短路徑', '');
  await step(tok); // t, u, v
  buildGraph(SB.tuv);
  say('簡單的圖：三個頂點 t、u、v', '');
  await step(tok); // t is the start
  nodeColor(0, C.ok, 0.3); nodeTag(0, '起點', 'ptr');
  b = sbBuddy(sbAt(0).x, sbAt(0).z, 0.45); await b.hop(tok);
  say('起點選 t', '找 t → u、t → v');
  await step(tok); // direct t → u = 5
  edgeColor(sbE(0, 1), C.hot, 1.8);
  pk = await sbPkt(tok, '5', 0, 1, 800);
  say('t → u 有直接邊：5', '');
  await step(tok); // no direct t → v
  kill(pk); nodeTag(2, '∞', 'ptr alt');
  board('t → v 沒有直接邊 → ∞');
  say('t → v 沒有直接邊 → ∞', '');
  await step(tok); // more than one edge
  board('路徑可以不只一條邊');
  say('路徑可以是一條邊，也可以不只一條', '');
  await step(tok); // via u: 8
  sbPath([0, 1, 2], C.tree);
  pk = await sbWalk(tok, '5 + 3 = 8', [0, 1, 2], 650);
  say('到了 u 還能走到 v', 't → u → v 總共 8');
  await step(tok); // relaxation condition
  kill(pk); sbPath([0, 1, 2], C.edge, 1);
  board('做法：靠 relaxation 條件');
  say('怎麼找？靠 relaxation 條件', '');
  await step(tok); // label distances 0, 5, ∞
  sbD([0, 5, INF]); edgeColor(sbE(0, 1), C.pq, 1.6);
  say('標距離：t = 0、u = 5、v = ∞', '');
  await step(tok); // stop here? no
  b.talk('停在這裡就好？不行'); b.mood('wow');
  say('停在這裡：t → v 就是 ∞？', '不行，還要看多條邊的路');
  await step(tok); // select u
  b.mood('calm'); b.talk('選 u'); await sbGo(tok, b, sbAt(1), 800);
  nodeColor(1, C.ok, 0.3); edgeColor(sbE(0, 1), C.tree, 2.2);
  say('t → u = 5，選定 u', '');
  await step(tok); // condition 5 + 3 = 8 < ∞
  edgeColor(sbE(1, 2), C.hot, 1.8);
  pk = await sbPkt(tok, '5 + 3 = 8 < ∞', 1, 2, 900);
  board('d[u] + c(u, v) < d[v]？');
  say('檢查 d[u] + c(u, v) < d[v]', '5 + 3 = 8 < ∞');
  await step(tok); // d[v] = 8
  kill(pk); nodeTag(2, '8', 'ptr alt'); edgeColor(sbE(1, 2), C.tree, 2.2);
  board('d[v] = 8：v 被 relax 了'); b.mood('happy'); b.talk('改成 8！');
  say('條件成立 → d[v] = 8', '這就是 v 被 relax');
}]);

// 02:57 P～U：Q1、R2、U3、S4、T7
FRAG.push(['spbari-sp-dij-pq', 'Dijkstra：P、Q、R、S、T、U', async (tok) => {
  fresh();
  buildGraph(SB.pq);
  const ev = sbDijEv(0, { direct: true });
  const show = sbDijShow(tok, 0, { endCap: 'Q 1、R 2、U 3、S 4、T 7', endF: '每個頂點都標上最短距離' });
  let pk = null;
  const fnPaths = async () => { pk = await sbWalk(tok, 'P→Q→R→S = 4', [0, 1, 2, 3], 550); say('R 經過 Q；U 經過 Q、R', 'S 走 P→Q→R→S；T 是直接邊 7'); };
  await sbRun(tok, ev, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, fnPaths], show);
}]);

// 06:41 A～F：B 1、C 2、D 3、E 3、F 6
FRAG.push(['spbari-sp-dij-af', 'Dijkstra：A～F', async (tok) => {
  fresh();
  buildGraph(SB.af);
  const ev = sbDijEv(0, { direct: true });
  const show = sbDijShow(tok, 0, { endCap: 'B 1、C 2、D 3、E 3、F 6', endF: 'A 到每個頂點的最短距離' });
  await sbRun(tok, ev, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], show);
}]);

// 10:41 有負邊，但這張圖 Dijkstra 剛好對
FRAG.push(['spbari-sp-neg-ok', '負邊：Dijkstra 剛好正確的例子', async (tok) => {
  fresh();
  buildGraph(sbNeg2(8));
  const ev = sbDijEv(0, { direct: true });
  const show = sbDijShow(tok, 0, { endCap: '4 = −1：答案正確', endF: '這張圖有負邊也正確' });
  const fnNeg = async () => { edgeColor(sbE(2, 3), C.back, 1.8); show.b.talk('有負邊？'); say('圖裡有負權重的邊（3 → 4 = −6）', 'Dijkstra 會怎樣？'); };
  await sbRun(tok, ev, [fnNeg, 1, 1, 1, 1, 1, 1, 1], show);
}]);

// 12:10 1 → 4 改成 1：4 先被選，之後又被改 → 出錯
FRAG.push(['spbari-sp-neg-fail', '負邊：Dijkstra 出錯的例子', async (tok) => {
  fresh();
  buildGraph(sbNeg2(1));
  edgeColor(sbE(2, 3), C.back, 1.8);
  const ev = sbDijEv(0, { direct: true });
  const show = sbDijShow(tok, 0, { endCap: '已經定案的 4 又被改小', endF: 'Dijkstra 之前給的結果是錯的', endTalk: '我錯了…', endSad: true });
  const fnFix = async () => { nodeTag(3, '1（定案）', 'ptr'); show.b.talk('1 → 4 = 1，定案'); say('1 → 4 的最短路徑定為 1', '選定 = 定案'); };
  const fnRule = async () => { show.b.talk('定案的不能再改'); say('Dijkstra 規定：已選定的頂點不再 relax', '可是這裡還是被改了'); };
  const fnMay = async () => { say('有負邊時', 'Dijkstra 不一定每次都正確'); };
  const fnBoth = async () => { show.b.talk('可能對，可能錯'); say('上一張圖對、這張圖錯', '有負邊：可能對、也可能錯'); };
  await sbRun(tok, ev, [1, 1, fnFix, 1, 1, 1, 1, 1, fnRule, fnMay, fnBoth], show);
}]);

// 14:28 Bellman-Ford：列出所有邊、全部設 ∞（即使有直接邊）
FRAG.push(['spbari-sp-bf-list', 'Bellman-Ford：列出邊、其他全部 ∞', async (tok) => {
  fresh();
  buildGraph(sbAbcd(false));
  edgeColor(sbE(3, 1), C.back, 1.8);
  const bf = sbBuddy(-5.4, 3.6, 0.55, '#dd8238', 'Bellman-Ford');
  const bd = tag('', 'note', 1.6, 0.3, 4.3); bd.element.style.display = 'none';
  const board = (t) => { bd.element.style.display = ''; txt(bd, t); };
  const L = [[3, 1, -6], [2, 3, 3], [0, 2, 2], [0, 1, 1]];
  const gap = 1.15, bl = [];
  const card = async (i) => {
    const [u, v, w] = L[i];
    const m = lab.box(C.q, [gap * 0.9, 0.45, 0.7]); m.add(lab.label(fmt(w), 'val'));
    const l = lab.label('(' + nm(u) + ',' + nm(v) + ')', 'idx'); l.position.set(0, 0, 0.62); m.add(l);
    const x = -5.7 + gap / 2 + i * gap; m.position.set(x, 2.6, -4.5); lab.world.add(m); bl.push(m);
    edgeColor(sbE(u, v), C.hot, 1.8);
    await kanim(tok, 600, (t) => { m.position.y = 2.6 + (0.23 - 2.6) * t; });
    edgeColor(sbE(u, v), w < 0 ? C.back : C.edge, w < 0 ? 1.8 : 1);
  };
  await step(tok); // another algorithm
  await bf.hop(tok); bf.talk('有負邊也一定對');
  say('另一個演算法：Bellman-Ford', '有負邊時也一定正確');
  await step(tok); // has its drawback
  bf.mood('wow'); bf.talk('不過我也有缺點');
  say('但它也有自己的缺點', '最後會看到');
  await step(tok); // relax once vs repeatedly
  bf.mood('calm'); board('Dijkstra：每個頂點只 relax 一次 ／ Bellman-Ford：一直重複 relax');
  say('Dijkstra 每個頂點只 relax 一次', 'Bellman-Ford 反覆 relax，直到全部正確');
  await step(tok); // list of edges
  board('第一步：列出所有邊');
  say('第一步：列出所有的邊', '');
  await step(tok); await card(0);
  say('第一條：D → B', '');
  await step(tok); await card(1);
  say('第二條：C → D', '');
  await step(tok); await card(2); await card(3);
  say('再來 A → C、A → B', '只有 4 條邊');
  await step(tok); // deliberately D → B first
  glow(bl[0], GOLD); bf.talk('故意從 D → B 開始');
  say('故意從 D → B 開始，不是 A → B', '之後就知道為什麼');
  await step(tok); // source 0, others ∞
  glow(bl[0], null); sbD([0, INF, INF, INF]); nodeColor(0, C.ok, 0.3);
  say('起點 A = 0，其他全部 ∞', '');
  await step(tok); // even with direct edges
  edgeColor(sbE(0, 1), C.hot, 1.8); edgeColor(sbE(0, 2), C.hot, 1.8);
  board('A → B、A → C 有直接邊，也先記 ∞');
  say('即使有直接邊，也先不管', '全部記 ∞');
  await step(tok); // V − 1 = 3
  edgeColor(sbE(0, 1), C.edge, 1); edgeColor(sbE(0, 2), C.edge, 1);
  board('4 個頂點 → relax V − 1 = 3 次'); bf.talk('3 輪！'); await bf.hop(tok);
  say('4 個頂點 → relax V − 1 = 3 次', '');
}]);

// 16:54 逐輪 relax：B −1、C 2、D 5
FRAG.push(['spbari-sp-bf-abcd', 'Bellman-Ford：A～D 三輪 relax', async (tok) => {
  fresh();
  buildGraph(sbAbcd(false));
  const ev = sbBFEv(0, {});
  const show = sbBFShow(tok, 0, { endCap: '3 輪做完：B −1、C 2、D 5', endF: '有負邊也正確' });
  const fnIdea = async () => { show.b.talk('重複 V − 1 次就對'); say('反覆 relax V − 1 次', '所有頂點都會得到正確的最短路徑'); };
  await sbRun(tok, ev, [3, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, fnIdea], show);
}]);

// 20:39 加 B → C = 1：B→C→D→B = 1 + 3 − 6 = −2，第 4 輪還在變
FRAG.push(['spbari-sp-bf-cycle', 'Bellman-Ford：加 B → C 形成負 cycle', async (tok) => {
  fresh();
  buildGraph(sbAbcd(true));
  const ev = sbBFEv(0, { extra: 2 });
  const show = sbBFShow(tok, 0, { endCap: '頂點的距離一直在變', endF: '答案定不下來' });
  const sum = tag('', 'note', 3.6, 0.3, 4.4); sum.element.style.display = 'none';
  const P = [1, 2, 3].map((v) => GR.nodes[v].home);
  const fnAdd = async () => { edgeColor(sbE(1, 2), C.hot, 2); await kanim(tok, 800, () => {}); edgeColor(sbE(1, 2), C.edge, 1); say('同一張圖，加一條 B → C = 1', ''); };
  const fnOne = async () => { show.b.talk('D 從 5 變成 3'); say('做滿 3 輪後還有頂點被 relax', 'D：5 → 3'); };
  const fnCyc = async () => { sbPath([1, 2, 3, 1], C.back, 2.2); show.b.talk('B、C、D 繞成一圈'); say('問題：B、C、D 形成一個 cycle', '權重 1、3、−6'); };
  const fnSum = async () => { sum.element.style.display = ''; await sbLoop(tok, P, [1, 3, -6], sum); txt(sum, '1 + 3 − 6 = −2 < 0'); say('cycle 總和：1 + 3 − 6 = −2', '是負的（講者口誤說 −3）'); };
  const fnFail = async () => { show.b.mood('sad'); show.b.talk('負 cycle 我也不行'); say('有負邊沒問題', '但有負權重 cycle，Bellman-Ford 也無法求解'); };
  const fnDetect = async () => { show.b.mood('happy'); show.b.talk('但我抓得到！'); await show.b.hop(tok); say('V − 1 輪後再 relax 一次', '還有頂點更新 → 偵測出負 cycle'); };
  await sbRun(tok, ev, [fnAdd, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 3, 1, 1, 1, 1, 3, fnOne, 2, 3, 1, 1, fnCyc, fnSum, fnFail, fnDetect], show);
}]);
  }

  // ═══ spmit1.js ═══
  {
const { V3, cube, glow, kill, arrow, GOLD, GREEN, RED } = K;
// ─── MIT 6.006 L15／L16／L18（Aa2sqUhIn-E、2E7MmKv0Y24、CHvQ3q_gJ7E）補上的場景 ───
// 用本章模組的畫圖工具（buildGraph、nodeTag、edgeColor…）；fresh / tag / code / anim 是模組自己的版本。
const SM = {
  // L15 δ 定義的小例子（示意）
  delta: { title: 'δ(u, v)', directed: true, names: ['u', 'x', 'v', 'z'], pos: [[-4.4, 0.6], [0, -2.2], [4.0, 0.6], [1.6, 3.0]], edges: [[0, 1, 2], [1, 2, 3], [0, 2, 7]] },
  // L15 負權重的動機（示意）：a → t 是「倒貼的收費站」
  toll: { title: '倒貼收費', directed: true, names: ['s', 'a', 't'], pos: [[-4.6, 0.8], [0, -2.4], [4.4, 0.8]], edges: [[0, 1, 3], [1, 2, -2], [0, 2, 2]] },
  // L16 relaxation 安全性：s、u、v 三角形（標籤是符號）
  tri: { title: 's, u, v', directed: true, names: ['s', 'u', 'v'], pos: [[-4.4, 1.2], [0, -2.0], [4.2, 1.2]], edges: [[0, 1, 'δ(s,u)'], [1, 2, 'w(u,v)'], [0, 2, 'δ(s,v)', 0.25]] },
  // L16 DAG：A、B 在 S 的左邊（走不到）
  dagL: { title: 'A, B, S', directed: true, names: ['A', 'B', 'S'], pos: [[-4.6, 0], [-1.2, 0], [2.2, 0]], edges: [[0, 1, 1], [1, 2, 1], [0, 2, 4, 0.3]] },
  // L18 雙向搜尋的示意圖（沒有權重）
  bi: { title: 's … t', directed: true, names: ['s', 'v1', 'v3', 'v2', 't', 'x'], pos: [[-5.2, 0], [-2.6, -2.2], [0.4, -2.2], [2.8, 0], [5.4, 0], [-1.0, 2.2]], edges: [[0, 1], [0, 5], [1, 2], [2, 3], [5, 3], [3, 4]] },
  // L18 位能：s 出去兩條 5（t1→t、t2→t 的權重是示意）
  pot: { title: 'potential', directed: true, names: ['s', 't1', 't2', 't'], pos: [[-5, 0], [-0.6, -2.4], [-0.6, 2.4], [4.4, 0]], edges: [[0, 1, 5], [0, 2, 5], [1, 3, 4], [2, 3, 8]] },
  land: { title: 'landmark', directed: true, names: ['s', 't1', 't2', 't', 'L'], pos: [[-5.6, 0], [-2, -2.4], [-2, 2.4], [2.4, 0], [5.6, 0]], edges: [[0, 1, 5], [0, 2, 5], [1, 3, 4], [2, 3, 8], [3, 4, 2]] },
};
const smE = (u, v) => findEdge(u, v);
const smPath = (vs, color, k = 2.2) => { for (let i = 0; i + 1 < vs.length; i++) edgeColor(smE(vs[i], vs[i + 1]), color, k); };

// ══════════ L15 ══════════
// 00:19 / 03:59 加權圖 G = (V, E, W)；Dijkstra vs Bellman-Ford
FRAG.push(['spmit1-two-algos', 'L15：加權圖與兩個演算法', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(GRAPHS.tri, { scale: 0.75, dx: -2.6, dz: -0.2 });
  say('邊上多了權重', 'G = (V, E, W)，W：E → ℝ');
  await beat(tok, 3000);
  setW(smE(0, 2), 0.5); edgeColor(smE(0, 2), C.hot, 1.8);
  say('權重可以是整數、實數', '也可以是負的');
  await beat(tok, 2200);
  setW(smE(1, 2), -1); edgeColor(smE(1, 2), C.back, 1.8);
  await beat(tok, 1600);
  setW(smE(0, 2), 3); setW(smE(1, 2), 1); edgeColor(smE(0, 2), C.edge, 1); edgeColor(smE(1, 2), C.edge, 1);
  const dj = cube('Dijkstra', '#4b9ee2', [3.0, 0.5, 1.0], 3.4, 0.25, -1.8, 4);
  tag('權重 ≥ 0', 'ptr', 3.4, 0.3, -0.9);
  say('Dijkstra：權重必須非負', 'O(V log V + E)：幾乎線性');
  await beat(tok, 3200);
  const eL = tag('簡單圖：E = O(V²)', 'idx', 3.4, 0.3, 0.1);
  say('簡單圖每對頂點最多一條邊', '完全圖 E = Θ(V²)；通常 E 主導');
  await beat(tok, 3000);
  const bf = cube('Bellman-Ford', '#dd8238', [3.0, 0.5, 1.0], 3.4, 0.25, 1.6, 4);
  tag('可有負權重', 'ptr', 3.4, 0.3, 2.5);
  say('Bellman-Ford：正負權重都行', 'O(VE)，E = V² 時是 O(V³)');
  await beat(tok, 3200);
  glow(dj, GOLD);
  say('能用 Dijkstra 就用 Dijkstra', '有負邊才換 Bellman-Ford');
  await beat(tok, 2600);
  glow(dj, null); glow(bf, RED);
  say('負邊麻煩在負 cycle', 'Bellman-Ford 要多做事');
  await beat(tok, 2800);
  kill(eL);
}]);

// 11:23 複雜度裡沒有權重 W
FRAG.push(['spmit1-weight-range', 'L15：複雜度與權重大小無關', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(GRAPHS.tri, { scale: 0.8, dx: -2.4, dz: -0.6 });
  say('觀察：兩個複雜度都沒有 W', 'O(V log V + E)、O(VE)');
  await beat(tok, 3000);
  const ws = ['0.0001', '10⁹⁸', '2⁶⁴'];
  [smE(0, 1), smE(1, 2), smE(0, 2)].forEach((e, i) => { txt(e.lbl, ws[i]); edgeColor(e, C.hot, 1.8); });
  say('權重可以 0.0001，也可以 10⁹⁸', '最多 E 種值，但範圍可以指數大');
  await beat(tok, 3400);
  [smE(0, 1), smE(1, 2), smE(0, 2)].forEach((e) => edgeColor(e, C.edge, 1));
  const a = tag('Dijkstra：O(V log V + E)', 'ptr', 3.6, 0.3, -1.4);
  const b = tag('Bellman-Ford：O(VE)', 'ptr', 3.6, 0.3, -0.4);
  const n = tag('不含 W', 'ptr alt', 3.6, 0.3, 0.6);
  say('好演算法不受權重範圍影響', '只跟 V、E 有關');
  await beat(tok, 3200);
  say('BFS 只數邊數，不能直接用', '提示：權重的範圍太大');
  edgeColor(smE(0, 2), C.back, 2);
  await beat(tok, 3200);
  say('難處一：指數多條路徑', '難處二：權重範圍可以很大');
  edgeColor(smE(0, 2), C.edge, 1);
  await beat(tok, 3000);
  [a, b, n].forEach(kill);
}]);

// 14:19 δ(u, v) 的定義
FRAG.push(['spmit1-delta-def', 'L15：δ(u, v) 的定義', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(SM.delta);
  say('v₀ →ᵖ vₖ：一條從 v₀ 到 vₖ 的路徑', '單一頂點 v₀ 自己就是長度 0 的路徑');
  nodeColor(0, C.pq, 0.3); nodeTag(0, 'w = 0');
  await beat(tok, 3000);
  nodeColor(0, C.white, 0);
  smPath([0, 2], C.hot);
  say('u → v 直接走：7', '');
  await beat(tok, 2000);
  smPath([0, 2], C.dim, 1); smPath([0, 1, 2], C.tree);
  say('u → x → v：2 + 3 = 5', '');
  await beat(tok, 2200);
  nodeTag(2, 'δ = 5');
  say('δ(u, v) = 所有 u→v 路徑的最小 w(p)', 'min(7, 5) = 5');
  await beat(tok, 3000);
  nodeColor(3, C.dim, 0); nodeTag(3, 'δ = ∞');
  say('沒有路徑就是 ∞', '從這裡開車到東京：∞');
  await beat(tok, 2800);
  say('不只要 δ，也要那條路徑本身', '');
  await beat(tok, 2200);
  smPath([0, 1, 2], C.edge, 1);
  nodeTag(0, 'd 0'); nodeTag(1, 'd ∞'); nodeTag(2, 'd ∞'); nodeTag(3, 'd ∞');
  say('從起點出發：d(s) = 0，其他 ∞', '把 ∞ 一路降下來');
  await beat(tok, 2600);
  nodeTag(1, 'd 2'); await beat(tok, 700); nodeTag(2, 'd 7'); await beat(tok, 700); nodeTag(2, 'd 5');
  say('走得到的會降到 δ', '走不到的 z 永遠是 ∞');
  nodeColor(3, C.back, 0.3);
  await beat(tok, 3000);
}]);

// 23:46 predecessor π
FRAG.push(['spmit1-pred', 'L15：predecessor π 與回推路徑', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(GRAPHS.l15);
  const d = [0, 1, 2, 5, 3, 6, 8], par = [-1, 0, 0, 4, 2, 3, 4];
  for (let v = 0; v < 7; v++) { nodeTag(v, String(d[v])); nodeNote(v, par[v] >= 0 ? 'π = ' + nm(par[v]) : 'π = NIL'); if (par[v] >= 0) edgeColor(smE(par[v], v), C.tree, 2); }
  say('d(v)：圈裡的數字，目前最佳權重', 'π(v)：最佳路徑上的前一個頂點');
  await beat(tok, 3400);
  say('π(S) = NIL', '目前的最佳路徑沿 π 往回走就得到');
  nodeColor(0, C.pq, 0.3);
  await beat(tok, 2600);
  nodeColor(0, C.white, 0);
  say('現在 π(E) = C，π(C) = D …', 'E 目前 6');
  nodeColor(5, C.hot, 0.4);
  await beat(tok, 2800);
  const e = smE(1, 5);
  edgeColor(e, C.hot, 2);
  await beat(tok, 800);
  edgeColor(smE(3, 5), C.edge, 1); edgeColor(e, C.tree, 2);
  d[5] = 3; par[5] = 1; nodeTag(5, '3'); nodeNote(5, 'π = A');
  say('找到 A → E 更好：d 6 → 3', 'π 也跟著改：π(E) = A');
  await beat(tok, 3000);
  edgeColor(smE(4, 6), C.edge, 1); edgeColor(smE(5, 6), C.tree, 2);
  nodeTag(6, '6'); nodeNote(6, 'π = E');
  say('最後回推：E ← A ← S', 'π(E) = A，π(A) = S');
  nodeColor(1, C.hot, 0.4); await beat(tok, 900); nodeColor(0, C.hot, 0.4);
  await beat(tok, 2400);
  say('d 與 π 兩個資料結構一起更新', 'd 等於 δ 時，π 也正確');
  await beat(tok, 3000);
}]);

// 26:37 為什麼有負權重；能不能平移成非負
FRAG.push(['spmit1-neg-why', 'L15：負權重從哪來？能平移掉嗎？', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(SM.toll);
  say('負權重：開這段路反而有錢拿', '倒貼的收費站、社群網路的好惡');
  edgeColor(smE(1, 2), C.back, 2);
  await beat(tok, 3200);
  smPath([0, 1, 2], C.tree);
  say('s → a → t：3 + (−2) = 1', '比直接 s → t 的 2 還短');
  await beat(tok, 3000);
  say('想法：每條邊都加 2，變成非負？', '就能用 Dijkstra');
  await beat(tok, 2600);
  setW(smE(0, 1), 5); setW(smE(1, 2), 0); setW(smE(0, 2), 4);
  smPath([0, 1, 2], C.edge, 1);
  await beat(tok, 900);
  smPath([0, 1, 2], C.hot, 1.8);
  say('s → a → t 變 5 + 0 = 5', '');
  await beat(tok, 2200);
  smPath([0, 1, 2], C.dim, 1); edgeColor(smE(0, 2), C.tree, 2.2);
  say('s → t 變 4：最短路徑換人了！', '邊數多的路加得多');
  await beat(tok, 3200);
  say('要證明答案不變才能平移', '能做到：O(VE) → O(V log V + E)');
  await beat(tok, 3200);
}]);

// ══════════ L16 ══════════
// 08:00 relaxation 安全的證明（歸納 + 三角不等式）
FRAG.push(['spmit1-relax-lemma', 'L16：證明 relax 永遠 d(v) ≥ δ(s, v)', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(SM.tri, { dz: -1.2 });
  say('引理：只用 relax 改 d，就有 d(v) ≥ δ(s,v)', '不管 relax 的順序');
  await beat(tok, 3200);
  const L = [];
  const row = (s, z, cls) => { const l = tag(s, cls || 'ptr', 0, 0.3, z); L.push(l); return l; };
  nodeTag(1, 'd(u) ≥ δ(s,u)', 'ptr alt');
  say('歸納假設：d(u) ≥ δ(s, u)', '現在 relax 邊 (u, v)');
  edgeColor(smE(1, 2), C.hot, 2);
  await beat(tok, 3000);
  edgeColor(smE(0, 1), C.tree, 2); edgeColor(smE(0, 2), C.tree, 2);
  row('δ(s,v) ≤ δ(s,u) + δ(u,v)', 2.2);
  say('三角不等式（講的是路徑，不是邊）', '經過 u 不會比最短的更短');
  await beat(tok, 3400);
  row('≤ d(u) + δ(u,v)', 3.0);
  say('δ(s,u) 換成 d(u)：只會變大', '因為 d(u) ≥ δ(s,u)');
  nodeColor(1, C.pq, 0.3);
  await beat(tok, 3200);
  nodeColor(1, C.white, 0);
  row('≤ d(u) + w(u,v)', 3.8);
  say('δ(u,v) 換成 w(u,v)：單一條邊不會比最短短', '');
  await beat(tok, 3200);
  row('= relax 後的 d(v)', 4.6, 'ptr alt');
  nodeTag(2, 'd(v) ≥ δ(s,v)', 'ptr alt');
  nodeColor(2, C.ok, 0.3);
  say('所以 relax 之後仍有 d(v) ≥ δ(s,v)', '證畢：relaxation 是安全的');
  await beat(tok, 3200);
  say('s→b 邊 3 > s→a→b 的 2 不矛盾', 'δ(s,b) = 2：三角不等式講最短路徑');
  await beat(tok, 3000);
}]);

// 17:37 DAG：topological sort + 一次 relax；起點左邊都是 ∞
FRAG.push(['spmit1-dag-idea', 'L16：DAG 最短路徑的作法', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(SM.dagL, { dz: -2.2 });
  say('DAG：沒有 cycle → 不會有負 cycle', '負邊可以，只走一次就照減');
  await beat(tok, 3200);
  const cd = code(['1. topological sort（DFS，O(V + E)）', '   u → v 的路徑 ⇒ u 排在 v 前面', '2. 由左到右走一次', '   relax 這個頂點的每條出邊', '總共 O(V + E)'], -2.2, 0.6, 0.62);
  cd.hl(0);
  say('第一步：topological sort', '有 DAG 就先試 topo sort');
  await beat(tok, 3000);
  cd.hl(2);
  for (let v = 0; v < 3; v++) { nodeColor(v, C.hot, 0.35); await beat(tok, 600); nodeColor(v, C.white, 0); }
  say('第二步：由左到右，一個頂點處理一次', '每條邊只 relax 一次');
  await beat(tok, 2600);
  cd.hl(4);
  say('時間 O(V + E)', '');
  await beat(tok, 2000);
  cd.hl(-1);
  nodeColor(2, C.ok, 0.3); nodeTag(2, '0'); nodeTag(0, '∞'); nodeTag(1, '∞');
  say('起點是 S：A、B 在它左邊', 'δ(S, A) = δ(S, B) = ∞');
  await beat(tok, 3200);
  nodeColor(0, C.dim, 0); nodeColor(1, C.dim, 0);
  say('先排好，再決定起點', '起點左邊的全部 ∞');
  await beat(tok, 3000);
}]);

// 33:29 Dijkstra pseudocode（L16 的 5 頂點例子）；params.target：L18 的「取出 t 就停」
FRAG.push(['spmit1-dij-pseudo', 'Dijkstra pseudocode（Extract-Min、S、Q）', async (tok) => {
  const P = ctx.params || {};
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(GRAPHS.clrs5, { scale: 0.62, dx: 3.2, dz: -0.6 });
  const T = P.target ? GRAPHS.clrs5.names.indexOf(P.target) : -1;
  const lines = ['Dijkstra(G, w, s):', '  Initialize：d(s)=0，其他 ∞', '  S = ∅ ;  Q = V', '  while Q ≠ ∅:', '    u = Extract-Min(Q)'];
  if (T >= 0) lines.push('    if u == t: stop');
  lines.push('    S = S ∪ {u}', '    for v in Adj[u]:', '      Relax(u, v, w)');
  const I = (s) => lines.findIndex((l) => l.includes(s));
  const cd = code(lines, -4.0, -2.8, 0.6);
  const n = GR.n, d = Array(n).fill(INF), inS = Array(n).fill(false), Sl = [];
  d[0] = 0;
  const sT = tag('S = { }', 'ptr alt', -4.4, 0.3, 3.0), qT = tag('', 'ptr', -4.4, 0.3, 3.8);
  const showQ = () => txt(qT, 'Q：' + [...Array(n).keys()].filter((v) => !inS[v]).map((v) => nm(v) + ' ' + fmt(d[v])).join('  '));
  for (let v = 0; v < n; v++) nodeTag(v, fmt(d[v]));
  if (T >= 0) { nodeNote(T, '目標 t'); nodeColor(T, C.purple, 0); }
  cd.hl(1); showQ();
  say(T >= 0 ? '同一份 Dijkstra，只多一行' : 'Initialize：起點 A 的 d = 0', T >= 0 ? '單一目標 t = ' + nm(T) : '其他頂點 ∞');
  await beat(tok, 2600);
  cd.hl(2);
  say('S：已知最短路徑的頂點', 'Q：priority queue，key = d');
  await beat(tok, 2600);
  for (;;) {
    let u = -1;
    for (let v = 0; v < n; v++) if (!inS[v] && (u < 0 || d[v] < d[u])) u = v;
    if (u < 0) break;
    cd.hl(I('Extract-Min'));
    nodeColor(u, C.hot, 0.4);
    say('Extract-Min：' + nm(u) + '（d = ' + fmt(d[u]) + '）', 'greedy：Q 裡最小的就是確定的');
    await beat(tok, 1500);
    if (T >= 0) {
      cd.hl(I('stop'));
      if (u === T) {
        nodeColor(u, C.ok, 0.4);
        say('u == t：停！', 'δ(A, ' + nm(u) + ') = ' + fmt(d[u]) + '；剩下的不用做');
        await beat(tok, 3200);
        return;
      }
      await beat(tok, 500);
    }
    cd.hl(I('S = S'));
    inS[u] = true; Sl.push(u); nodeColor(u, C.ok, 0.3); txt(sT, 'S = { ' + Sl.map(nm).join(', ') + ' }'); showQ();
    await beat(tok, 800);
    for (const { e, to: v } of adjOf(u)) {
      cd.hl(I('Relax'));
      edgeColor(e, C.hot, 1.8);
      const nd = d[u] + e.w;
      if (nd < d[v]) {
        const old = d[v]; d[v] = nd; nodeTag(v, fmt(nd)); showQ();
        say('Relax ' + nm(u) + '→' + nm(v) + '：' + fmt(old) + ' → ' + nd, 'Decrease-Key');
        await beat(tok, 1100);
        edgeColor(e, C.tree, 1.6);
      } else {
        say(nm(u) + '→' + nm(v) + '：' + nd + ' ≥ ' + fmt(d[v]) + '，不變', '');
        await beat(tok, 800);
        edgeColor(e, C.edge, 1);
      }
    }
    nodeColor(u, C.ok, 0);
  }
  cd.hl(3);
  say('Q 空了：' + [...Array(n).keys()].map((v) => nm(v) + ' ' + fmt(d[v])).join('、'), '每個頂點只取出一次');
  await beat(tok, 3000);
}]);

// ══════════ L18 ══════════
// 00:41 三種最短路徑問題
FRAG.push(['spmit1-three-problems', 'L18：三種最短路徑問題', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(GRAPHS.l15);
  say('今天：不改最壞複雜度', '但實際跑得更快');
  await beat(tok, 2600);
  nodeColor(0, C.ok, 0.3); nodeColor(3, C.purple, 0.3);
  smPath([0, 2, 4, 3], C.tree);
  say('① single source、single target', '只要 S 到 C');
  await beat(tok, 3000);
  nodeColor(3, C.white, 0);
  smPath([0, 2, 4, 3], C.edge, 1);
  for (const [u, v] of [[0, 1], [0, 2], [2, 4], [4, 3], [1, 5], [5, 6]]) { edgeColor(smE(u, v), C.tree, 2); await beat(tok, 350); }
  say('② single source、所有目的地', '原本的 Dijkstra、Bellman-Ford');
  await beat(tok, 2800);
  for (const [u, v] of [[0, 1], [0, 2], [2, 4], [4, 3], [1, 5], [5, 6]]) edgeColor(smE(u, v), C.edge, 1);
  nodeColor(0, C.white, 0);
  say('③ all pairs：任兩點都要', '起點也在變，工作更多（6.046）');
  for (const [a, b] of [[1, 6], [2, 5], [4, 6]]) {
    nodeColor(a, C.ok, 0.3); nodeColor(b, C.purple, 0.3);
    await beat(tok, 1000);
    nodeColor(a, C.white, 0); nodeColor(b, C.white, 0);
  }
  say('今天專攻 ①：提早停、雙向搜尋、位能', '');
  nodeColor(0, C.ok, 0.3); nodeColor(3, C.purple, 0.3);
  await beat(tok, 3000);
}]);

// 07:18 雙向搜尋：forward + backward、資料結構加倍
FRAG.push(['spmit1-bidir-setup', 'L18：雙向搜尋的設定', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(SM.bi, { dz: -0.6 });
  say('從 s 往前、從 t 往回', '兩個 frontier 相遇就能找到路徑');
  await beat(tok, 3000);
  nodeTag(0, 'd_f 0'); nodeNote(4, 'd_b 0');
  const t1 = tag('d_f(s) = 0、d_b(t) = 0，其他 ∞', 'ptr alt', 0, 0.3, 3.6);
  say('兩套 priority：d_f、d_b', '兩個 queue：Q_f、Q_b');
  await beat(tok, 3000);
  nodeColor(0, '#bfe8d6', 0.3);
  edgeColor(smE(0, 1), C.ok, 2); edgeColor(smE(0, 5), C.ok, 2);
  say('forward 一步：取出 s', '處理 s 的兩條出邊');
  await beat(tok, 2800);
  nodeColor(4, '#cfe0f5', 0.3);
  edgeColor(smE(3, 4), C.tree, 2);
  const ar = arrow(V3(5.0, 0.9, -1.1), V3(3.2, 0.9, -1.1), 0x2f7fd0);
  say('backward 一步：取出 t', '沿著邊「反方向」走到 v2');
  await beat(tok, 3200);
  say('圖要能反向走訪邊', '權重不變，只是方向倒過來');
  await beat(tok, 2800);
  kill(ar);
  say('forward、backward 交替', '什麼時候停？');
  await beat(tok, 2600);
  kill(t1);
}]);

// 12:22 終止條件；用 π_f、π_b 從 w 組路徑
FRAG.push(['spmit1-bidir-stop', 'L18：雙向搜尋何時停、怎麼組路徑', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(SM.bi, { dz: -0.6 });
  for (const v of [0, 1, 5]) nodeColor(v, '#bfe8d6', 0.3);
  for (const v of [4, 3]) nodeColor(v, '#cfe0f5', 0.3);
  edgeColor(smE(0, 1), C.ok, 2); edgeColor(smE(0, 5), C.ok, 2); edgeColor(smE(3, 4), C.tree, 2);
  say('frontier「相遇」寫不成程式', '要更具體的條件');
  await beat(tok, 2800);
  edgeColor(smE(1, 2), C.ok, 2); edgeColor(smE(2, 3), C.tree, 2);
  nodeColor(2, C.back, 0.5); nodeTag(2, 'w');
  say('停：某個 w 同時被 Q_f、Q_b 取出', '這裡 w = v3');
  await beat(tok, 3200);
  nodeNote(1, 'π_f = s'); nodeNote(2, 'π_f = v1');
  say('從 w 套 π_f：v3 → v1 → s', 'π_f(v3) = v1，π_f(v1) = s');
  smPath([0, 1, 2], C.hot, 2.4);
  await beat(tok, 3200);
  nodeNote(3, 'π_b = t');
  say('老師先寫 π_b(t) = v2，學生糾正', '反向搜尋時 t 是 v2 的前一個：π_b(v2) = t');
  await beat(tok, 3400);
  nodeNote(2, 'π_b = v2');
  smPath([2, 3, 4], C.hot, 2.4);
  say('從 w 套 π_b：v3 → v2 → t', '兩段接起來就是 s → t');
  await beat(tok, 3000);
  say('聽起來對…但 w 不一定在最短路徑上', '終止條件沒錯，錯在用 w 組路徑');
  await beat(tok, 3200);
}]);

// 28:05 反例 s、u、u′、w、t：part 1 = 前四步，part 2 = 後兩步與 10 ≠ 9
FRAG.push(['spmit1-bidir-trace', 'L18：雙向搜尋反例逐步執行', async (tok) => {
  const part = (ctx.params || {}).part === 2 ? 2 : 1;
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(GRAPHS.bidir);
  tag('上 = d_f、下 = d_b', 'idx', 0, 0.3, 4.2);
  const df = [0, INF, INF, INF, INF], db = [INF, INF, INF, 0, INF];
  const doneF = new Set(), doneB = new Set();
  const sh = () => { for (let v = 0; v < 5; v++) { nodeTag(v, 'f ' + fmt(df[v])); nodeNote(v, 'b ' + fmt(db[v])); } };
  const S = [
    [0, 'f', [[0, 1], [0, 4]], 'forward 取 s：d_f(u)=3、d_f(w)=5', 'Q_f 只有 s 是 0'],
    [3, 'b', [[2, 3], [4, 3]], 'backward 取 t：d_b(u′)=3、d_b(w)=5', '沿反向邊走'],
    [1, 'f', [[1, 2]], 'forward 取 u（3 < 5）', 'd_f(u′) = 3 + 3 = 6'],
    [2, 'b', [[1, 2]], 'backward 取 u′（3 < 5）', 'd_b(u) = 3 + 3 = 6'],
    [4, 'f', [[4, 3]], 'forward 取 w（5 < 6）', 'd_f(t) = 5 + 5 = 10'],
    [4, 'b', [[0, 4]], 'backward 取 w（5 < 6）', 'd_b(s) = 10；w 兩邊都取出 → 停'],
  ];
  const doStep = (st, quiet) => {
    const [u, dir, es2] = st;
    (dir === 'f' ? doneF : doneB).add(u);
    nodeColor(u, doneF.has(u) && doneB.has(u) ? C.back : dir === 'f' ? '#bfe8d6' : '#cfe0f5', 0.3);
    for (const [a, b] of es2) {
      const e = smE(a, b); edgeColor(e, dir === 'f' ? C.ok : C.tree, 2);
      if (dir === 'f') df[b] = Math.min(df[b], df[a] + e.w); else db[a] = Math.min(db[a], db[b] + e.w);
    }
    if (!quiet) sh();
  };
  if (part === 1) {
    sh();
    say('上面 3 + 3 + 3 = 9 是最短', '下面 5 + 5 = 10');
    await beat(tok, 3200);
    for (let i = 0; i < 4; i++) { doStep(S[i]); say(S[i][3], S[i][4]); await beat(tok, 2600); }
    say('綠 = 已從 Q_f 取出，藍 = 已從 Q_b 取出', '下一步輪到 forward');
    await beat(tok, 3000);
    return;
  }
  for (let i = 0; i < 4; i++) doStep(S[i], true);
  sh();
  say('接著做：前四步之後的狀態', 'Q_f：w 5、u′ 6；Q_b：w 5、u 6');
  await beat(tok, 3200);
  for (let i = 4; i < 6; i++) { doStep(S[i]); say(S[i][3], S[i][4]); await beat(tok, 2800); }
  say('用 w 組路徑：d_f(w) + d_b(w) = 10', '<span class="no">但最短是 9！</span>');
  await beat(tok, 3200);
  [[0, 1], [1, 2], [2, 3]].forEach(([a, b]) => edgeColor(smE(a, b), C.hot, 2.4));
  say('交替搜尋在「邊數最少」的路徑相遇', '邊數最少 ≠ 權重最小');
  await beat(tok, 3200);
}]);

// 45:38 位能 λ：w̄(u,v) = w(u,v) − λ(u) + λ(v)
FRAG.push(['spmit1-potential', 'L18：位能改權重，讓搜尋往下坡走', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(SM.pot);
  say('s 出去兩條邊都是 5', 'Dijkstra 不知道該先往哪');
  edgeColor(smE(0, 1), C.hot, 1.8); edgeColor(smE(0, 2), C.hot, 1.8);
  await beat(tok, 3000);
  edgeColor(smE(0, 1), C.edge, 1); edgeColor(smE(0, 2), C.edge, 1);
  const lam = [9, 4, 8, 0];
  say('給每個頂點一個位能 λ（紫柱高度）', 'w̄(u,v) = w(u,v) − λ(u) + λ(v)');
  const bars = [];
  for (let v = 0; v < 4; v++) { nodeNote(v, 'λ = ' + lam[v]); const h = Math.max(0.05, lam[v] * 0.32); const p = GR.nodes[v].home; bars.push(cube('', '#c9b6f2', [0.22, h, 0.22], p.x + 0.75, h / 2, p.z)); }
  await beat(tok, 3400);
  say('t2 的位能拉高：往 t2 變上坡', '往 t1 是下坡（λ 是示意的數字）');
  glow(bars[2], GOLD); nodeColor(2, C.pq, 0.3);
  await beat(tok, 3000);
  glow(bars[2], null); nodeColor(2, C.white, 0);
  for (const e of GR.edges) {
    const nw = e.w - lam[e.u] + lam[e.v];
    edgeColor(e, C.hot, 1.8);
    say(nm(e.u) + '→' + nm(e.v) + '：' + e.w + ' − ' + lam[e.u] + ' + ' + lam[e.v] + ' = ' + nw, '');
    await beat(tok, 1300);
    setW(e, nw); edgeColor(e, nw === 0 ? C.ok : C.edge, nw === 0 ? 2 : 1);
  }
  say('任一條 s→t 路徑：w̄(p) = w(p) − λ(s) + λ(t)', '全部平移同一個量 → 最短路徑不變');
  await beat(tok, 3400);
  smPath([0, 1, 3], C.tree, 2.4);
  say('s→t1→t：9 → 0；s→t2→t：13 → 4', 'Dijkstra 先往下坡的 t1 走，更快到 t');
  await beat(tok, 3400);
}]);

// 50:59 landmark：λ_t(u) = δ(u, L) − δ(t, L)
FRAG.push(['spmit1-landmark', 'L18：用 landmark 算位能', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(SM.land);
  nodeColor(4, C.purple, 0.3);
  say('選一個 landmark L ∈ V', '例：Caltech → Boston 必經 Austin');
  await beat(tok, 3000);
  const dl = [11, 6, 10, 2, 0];
  for (let v = 0; v < 5; v++) { nodeTag(v, 'δ(·,L) ' + dl[v], 'ptr'); await beat(tok, 450); }
  say('預先算每個 u 到 L 的 δ(u, L)', '工作量大，但只做一次');
  await beat(tok, 2800);
  nodeColor(3, C.hot, 0.3);
  say('對目標 t 再算一次 δ(t, L) = 2', '只有一個 t，很便宜');
  await beat(tok, 2600);
  nodeColor(3, C.white, 0);
  const lam = dl.map((x) => x - dl[3]);
  for (let v = 0; v < 5; v++) nodeNote(v, 'λ = ' + fmt(lam[v]));
  say('λ_t(u) = δ(u, L) − δ(t, L)', 's 9、t1 4、t2 8、t 0（數字是示意）');
  await beat(tok, 3400);
  for (const e of GR.edges) { const nw = e.w - lam[e.u] + lam[e.v]; setW(e, nw); edgeColor(e, nw === 0 ? C.ok : C.edge, nw === 0 ? 2 : 1); }
  say('新權重全部 ≥ 0：三角不等式', 'δ(u, L) ≤ w(u, v) + δ(v, L)');
  await beat(tok, 3400);
  smPath([0, 1, 3], C.tree, 2.4);
  say('Dijkstra 照跑，答案一樣', '選對 landmark：實際快 20%～2 倍');
  await beat(tok, 3200);
}]);
  }

  // ═══ spmit2.js ═══
  {
const { V3, cube, glow, kill, arrow, move, fly, tint, relabel, GOLD, GREEN, RED } = K;
// ─── MIT 6.006 L17 Bellman-Ford（ozsuci5pIso）、R15 Shortest Paths（mQSp6VmfakA）、R18 Quiz 2 Review（sPuazUPiV1k）───
// 用本章模組的畫圖工具（buildGraph、nodeTag、edgeColor、addEdge、makeStrip…）；fresh / tag / code 是模組自己的版本。
// 白板上的圖只有部分權重出現在逐字稿：標「示意」的數字是依描述補上的。
const S2R = '#d64545', S2B = '#2f7fd0';
const S2G = {
  // L17 開場：u 起點、v0（δ = 2）、v1→v2→v3 負 cycle、z 走不到
  spec: { directed: true, names: ['u', 'v0', 'v1', 'v2', 'v3', 'z'], pos: [[-5, 0], [-1.5, -2.8], [-1.5, 1.4], [2.2, -0.4], [2.2, 3.2], [5, -2.8]],
    edges: [[0, 1, 2], [0, 2, 4], [2, 3, 2], [3, 4, 3], [4, 2, -6], [5, 1, 1]] },
  loop: { directed: true, names: ['s', 'a', 'b', 'c'], pos: [[-4.6, 0.6], [-1.2, 0.6], [2.6, -1.8], [2.6, 3.0]], edges: [[0, 1, 1], [1, 2, 1], [2, 3, 1], [3, 1, -3]] },
  // L17 歸納證明用的路徑（示意）：s = v0 → v1 → … → v4，外加三條較差的邊
  ind: { directed: true, names: ['v0', 'v1', 'v2', 'v3', 'v4'], pos: [[-5.2, 0], [-2.6, -1.2], [0, 0], [2.6, -1.2], [5.2, 0]],
    edges: [[0, 1, 2], [1, 2, 1], [2, 3, 3], [3, 4, 1], [0, 2, 5, -0.35], [1, 3, 6, 0.35], [2, 4, 5, -0.35]] },
  path5: { directed: true, names: ['v0', 'v1', 'v2', 'v3', 'vk'], pos: [[-5.2, 0], [-2.6, 0], [0, 0], [2.6, 0], [5.2, 0]], edges: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  // L17 學生提問的例子：邊的權重 2、3、−1；第 1 條 = A→B（−1）、第 2 條 = S→A（2）、第 3 條 = C→A（3）
  qa: { directed: true, names: ['S', 'A', 'B', 'C'], pos: [[-4.6, 0], [0, -1.6], [4.4, -1.6], [0, 2.8]], edges: [[1, 2, -1], [0, 1, 2], [3, 1, 3]] },
  unr: { directed: true, names: ['s', 'x', 'y', 'z'], pos: [[-4.8, 0], [0, -2.2], [4, -0.2], [0.6, 2.8]], edges: [[1, 2, 1], [2, 3, 1], [3, 1, -3]] },
  // L17 longest path：s→v1→v2→v3 = 6，s→v3 = 4（示意的權重）
  lng: { directed: true, names: ['s', 'v1', 'v2', 'v3'], pos: [[-5, 0.8], [-1.6, -2.2], [1.9, -2.2], [5, 0.8]], edges: [[0, 1, 1], [1, 2, 2], [2, 3, 3], [0, 3, 4]] },
  // L17 最短簡單路徑：水平 3 + 2 + 3 + 3 + 2 = 13，b 上掛一個 2、3、−6 的負 cycle
  np: { directed: true, names: ['s', 'a', 'b', 'c', 'd', 'v', 'x', 'y'], pos: [[-5.8, 0.6], [-3.4, 0.6], [-1, 0.6], [1.4, 0.6], [3.7, 0.6], [6, 0.6], [-2.4, -2.6], [0.6, -2.6]],
    edges: [[0, 1, 3], [1, 2, 2], [2, 3, 3], [3, 4, 3], [4, 5, 2], [2, 6, 2], [6, 7, 3], [7, 2, -6]] },
  // R15 白板的 A～E（BFS 順序 A,B,C,D,E；4、2、1 與 A,C,D,E 路徑來自逐字稿，其餘權重示意）
  r15: { directed: false, names: ['A', 'B', 'C', 'D', 'E'], pos: [[-5, 0], [-1.6, -2.4], [-1.6, 2.4], [2.2, 1.8], [5.2, -0.6]],
    edges: [[0, 1, 4], [0, 2, 2], [1, 2, 1], [1, 3, 2], [1, 4, 3], [2, 3, 1], [3, 4, 2]] },
  // R18 一個菱形，四條邊都是 1
  dia: { directed: true, names: ['s', 'a', 'b', 't'], pos: [[-4.6, 0], [0, -2.4], [0, 2.4], [4.6, 0]], edges: [[0, 1, 1], [1, 3, 1], [0, 2, 1], [2, 3, 1]] },
  // R18 紅藍邊（示意）：S→X 紅 3、X→A 紅 1、X→B 藍 1、A→T 藍 1、B→T 藍 4
  rb: { directed: true, names: ['S', 'X', 'A', 'B', 'T'], pos: [[-5, 0], [-2, 0], [1.2, -2.2], [1.2, 2.2], [4.6, 0]],
    edges: [[0, 1, 3], [1, 2, 1], [1, 3, 1], [2, 4, 1], [3, 4, 4]] },
  tri3: { directed: true, names: ['S', 'A', 'B'], pos: [[-4, 0], [0.6, -2.4], [2.8, 2]], edges: [[0, 1], [0, 2], [1, 2]] },
  // R18 DFS 邊的種類（依描述重建）：S→A、S→B、A→C、A→E、C→D、C→E、D→A、B→C
  dfs: { directed: true, names: ['S', 'A', 'B', 'C', 'D', 'E'], pos: [[-5.4, 0], [-2.2, -1.8], [-2.2, 2.6], [1.2, -1.2], [4.4, -3.2], [4.4, 1.2]],
    edges: [[0, 1], [0, 2], [1, 3], [1, 5, undefined, 0.2], [3, 4], [3, 5], [4, 1, undefined, -0.25], [2, 3]] },
};
const RB_COL = [S2R, S2R, S2B, S2B, S2B];
const s2E = (u, v) => findEdge(u, v);
const s2Path = (vs, color, k = 2.2) => { for (let i = 0; i + 1 < vs.length; i++) edgeColor(s2E(vs[i], vs[i + 1]), color, k); };
function s2Rod(x1, z1, x2, z2, color = C.edge, r = 0.05) {
  const a = V3(x1, 0.3, z1), b = V3(x2, 0.3, z2), d = b.clone().sub(a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Math.max(0.01, d.length()), 8), new THREE.MeshStandardMaterial({ color }));
  m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
  lab.world.add(m); return m;
}
function s2Dij(src) {
  const n = GR.n, d = Array(n).fill(INF), par = Array(n).fill(-1), done = Array(n).fill(false); d[src] = 0;
  for (;;) {
    let u = -1;
    for (let v = 0; v < n; v++) if (!done[v] && d[v] < INF && (u < 0 || d[v] < d[u])) u = v;
    if (u < 0) break;
    done[u] = true;
    for (const { e, to } of GR.adj[u]) if (d[u] + e.w < d[to]) { d[to] = d[u] + e.w; par[to] = u; }
  }
  return { d, par };
}
function s2Bfs(src) {
  const n = GR.n, lv = Array(n).fill(-1), par = Array(n).fill(-1), q = [src]; lv[src] = 0;
  for (let i = 0; i < q.length; i++) for (const { to } of GR.adj[q[i]]) if (lv[to] < 0) { lv[to] = lv[q[i]] + 1; par[to] = q[i]; q.push(to); }
  return { lv, par, order: q };
}
const s2Back = (par, t) => { const p = [t]; while (par[p[0]] >= 0) p.unshift(par[p[0]]); return p; };
// one Bellman-Ford pass over `order` (pairs [u, v]); updates d / par and the node tags
async function s2Pass(tok, d, par, order, ms) {
  let changed = false;
  for (const [u, v] of order) {
    const e = s2E(u, v);
    edgeColor(e, C.hot, 1.8);
    await beat(tok, ms);
    if (d[u] !== INF && d[u] + e.w < d[v]) { d[v] = d[u] + e.w; par[v] = u; nodeTag(v, fmt(d[v]), 'ptr alt'); changed = true; await beat(tok, ms); }
    edgeColor(e, C.edge, 1);
  }
  return changed;
}
function s2Bar(text, color, h, x, z, w = 0.9) { const m = cube('', color, [w, Math.max(0.05, h), w], x, Math.max(0.05, h) / 2, z); tag(text, 'idx', x, 0.3, z + 0.9); return m; }

// ══════════ L17 Bellman-Ford ══════════
// 01:52 規格：δ 可能有限、∞ 或 undefined
FRAG.push(['spmit2-bf-spec', 'L17：Bellman-Ford 要做到什麼', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(S2G.spec);
  say('今天的對手：負邊與負 cycle', '有負 cycle 也要正確回報');
  await beat(tok, 3000);
  nodeColor(0, C.pq, 0.3);
  for (let v = 0; v < 6; v++) nodeTag(v, v === 0 ? '0' : '∞');
  say('起點 u：d = 0，其他 ∞', '之後有的變有限、有的留 ∞、有的 undefined');
  await beat(tok, 3000);
  s2Path([0, 1], C.tree); nodeTag(1, 'δ = 2');
  say('v0：一條邊的簡單路徑', 'δ(u, v0) = 2，途中沒有負 cycle');
  await beat(tok, 2800);
  s2Path([2, 3, 4, 2], C.back, 2.2);
  say('v1→v2→v3→v1：2 + 3 − 6 = −1', '負 cycle（cycle 上的權重是示意）');
  await beat(tok, 2800);
  const base = [4, 6, 9];
  for (let lap = 0; lap < 4; lap++) { for (let i = 0; i < 3; i++) nodeTag(2 + i, String(base[i] - lap), 'ptr alt'); await beat(tok, 650); }
  for (let i = 0; i < 3; i++) nodeTag(2 + i, 'undefined', 'ptr alt');
  say('每繞一圈少 1，可以無限繞', 'δ(u, v1)、δ(u, v2)、δ(u, v3) undefined');
  await beat(tok, 3000);
  nodeColor(5, C.dim, 0); nodeTag(5, 'δ = ∞');
  say('z 從 u 走不到', 'δ(u, z) = ∞');
  await beat(tok, 2600);
  say('偵測負 cycle，其餘照算 δ', '這就是 Bellman-Ford 的規格');
  await beat(tok, 3000);
}]);

// 04:29 通用演算法與兩個問題：指數時間、負 cycle 永不停止
FRAG.push(['spmit2-generic-problems', 'L17：通用演算法的兩個問題', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const cd = code(['Initialize：d(v) = ∞，π(v) = NIL，d(s) = 0', 'repeat', '  選一條邊 (u, v)', '  Relax(u, v, w)：d(v) > d(u) + w 就更新', 'until 沒有邊能 relax'], 0, -4.2, 0.55);
  cd.hl(0);
  say('複習：通用最短路徑演算法', 'd(v) = ∞、π(v) = NIL、d(s) = 0');
  await beat(tok, 2800);
  cd.hl(2);
  say('怎麼選邊，決定是哪個演算法', 'Dijkstra：取 d 最小的');
  await beat(tok, 2600);
  cd.hl(3);
  say('Relax 時也設 π(v) = u', '一直做到不能再 relax');
  await beat(tok, 2600);
  cd.hl(4);
  buildGraph(GRAPHS.chain, { scale: 0.8, dz: 2.6, ns: 0.8 });
  say('問題 1：選錯邊 → 指數時間', '正權重也會：n 個點 O(2^(n/2)) 次 relax');
  for (const [u, v] of [[0, 2], [2, 4], [4, 6], [0, 1], [1, 2], [2, 3], [3, 4]]) { edgeColor(s2E(u, v), C.hot, 1.8); await beat(tok, 380); edgeColor(s2E(u, v), C.edge, 1); }
  await beat(tok, 1600);
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(S2G.loop);
  s2Path([1, 2, 3, 1], C.back, 2);
  const d = [0, INF, INF, INF];
  for (let v = 0; v < 4; v++) nodeTag(v, fmt(d[v]));
  const cnt = tag('relax 0 次', 'ptr alt', -4.6, 0.3, 3.4);
  say('問題 2：走得到負 cycle', '1 + 1 − 3 = −1');
  let c = 0;
  const ord = [[0, 1], [1, 2], [2, 3], [3, 1]];
  for (let k = 0; k < 11; k++) {
    const [u, v] = ord[k < 4 ? k : 1 + ((k - 4) % 3)];
    const e = s2E(u, v);
    edgeColor(e, C.hot, 2.2);
    if (d[u] + e.w < d[v]) { d[v] = d[u] + e.w; c++; nodeTag(v, fmt(d[v]), 'ptr alt'); txt(cnt, 'relax ' + c + ' 次'); }
    await beat(tok, 420);
    edgeColor(e, v === 1 && u === 0 ? C.edge : C.back, 2);
  }
  say('d 一直降，until 永遠不成立', '照原樣寫，演算法不會停');
  await beat(tok, 3200);
}]);

const BF_CODE = ['Bellman-Ford(G, W, s)', '  Initialize()', '  for i = 1 to |V| − 1:', '    for each edge (u, v) ∈ E:', '      Relax(u, v, w)', '  for each edge (u, v) ∈ E:', '    if d[v] > d[u] + w(u, v):', '      report 負 cycle 存在'];
// 11:29 四行程式：|V| − 1 輪 relax 每條邊，再一輪檢查
FRAG.push(['spmit2-bf-code', 'L17：Bellman-Ford 的程式', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const cd = code(BF_CODE, -2.8, -4.3, 0.5);
  const rl = code(['Relax(u, v, w):', '  if d[v] > d[u] + w(u, v):', '    d[v] = d[u] + w(u, v)', '    π[v] = u'], 3.6, -4.3, 0.5);
  cd.hl(0);
  say('輸入：圖、權重、起點 s', '用 adjacency list 表示');
  await beat(tok, 2600);
  cd.hl(1);
  say('初始化跟通用版一樣', 'd(s) = 0，其他 ∞，π = NIL');
  await beat(tok, 2400);
  const E = 5, rows = [];
  for (let p = 1; p <= 3; p++) {
    cd.hl(2);
    const z = -0.2 + (p - 1) * 1.15;
    tag('第 ' + p + ' 輪', 'idx', -5.4, 0.3, z);
    say('第 ' + p + ' 輪：每一條邊都 relax', 'i 只是計數器（例：|V| = 4 → 3 輪）');
    const row = [];
    for (let k = 0; k < E; k++) { cd.hl(k % 2 ? 4 : 3); rl.hl(1 + (k % 3)); row.push(cube('e' + (k + 1), '#efe3c8', [0.9, 0.4, 0.7], -3.6 + k * 1.3, 0.2, z, 2)); await beat(tok, 300); }
    rows.push(row);
    await beat(tok, 700);
  }
  rl.hl(-1);
  cd.hl(5);
  const z4 = -0.2 + 3 * 1.15;
  tag('第 |V| 輪', 'ptr alt', -5.4, 0.3, z4);
  for (let k = 0; k < E; k++) { cube('e' + (k + 1), C.pq, [0.9, 0.4, 0.7], -3.6 + k * 1.3, 0.2, z4, 2); await beat(tok, 260); }
  cd.hl(6);
  say('多做一輪：只檢查、不更新', '還能 relax → 有負 cycle');
  await beat(tok, 2800);
  cd.hl(7);
  say('沒有負 cycle：|V| − 1 輪後 d = δ', '前半是計算，後半是檢查');
  await beat(tok, 3000);
}]);

// 15:54 複雜度 O(VE)；E = O(V²) → O(V³)
FRAG.push(['spmit2-bf-cost', 'L17：Bellman-Ford 的複雜度', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  say('每輪看全部 E 條邊', '共 |V| − 1 輪');
  for (let p = 0; p < 4; p++) {
    for (let k = 0; k < 6; k++) cube('', '#efe3c8', [0.7, 0.35, 0.6], -5.2 + k * 0.85, 0.2, -2.8 + p * 0.9, 1.5);
    await beat(tok, 450);
  }
  tag('(V − 1) × E', 'ptr', -3.1, 0.3, 0.9);
  for (let k = 0; k < 6; k++) cube('', C.pq, [0.7, 0.35, 0.6], -5.2 + k * 0.85, 0.2, 1.8, 1.5);
  tag('檢查：E', 'ptr alt', -3.1, 0.3, 2.7);
  say('計算 O(VE) + 檢查 O(E)', '= O(VE)，用陣列或 adjacency list 都一樣');
  await beat(tok, 3400);
  const t1 = tag('簡單圖：E = O(V²)', 'idx', 3.6, 0.3, -3.4);
  say('簡單圖 E 可以到 O(V²)', 'Bellman-Ford → O(V³)');
  await beat(tok, 3000);
  const dj = s2Bar('Dijkstra O(V log V + E)', C.ok, 0.8, 2.2, 0.6, 1.0);
  await beat(tok, 900);
  const bf = s2Bar('Bellman-Ford O(VE)', '#dd8238', 4.5, 5.0, 0.6, 1.0);
  say('實務上 Bellman-Ford 慢很多', 'Dijkstra 接近線性；BF 可到 V³');
  await beat(tok, 3000);
  glow(dj, GOLD);
  say('能用 Dijkstra 就用 Dijkstra', '可能有負 cycle 時只好用 Bellman-Ford');
  await beat(tok, 3200);
  kill(t1); glow(bf, null);
}]);

// 18:03 定理與推論；k ≤ |V| − 1
FRAG.push(['spmit2-bf-theorem', 'L17：Bellman-Ford 的定理與推論', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const th = tag('定理：無負 cycle → 結束後 d(v) = δ(s, v)', 'ptr', 0, 0.3, -4.2);
  say('定理：沒有負 cycle', '結束後所有 v 的 d(v) = δ(s, v)');
  await beat(tok, 3200);
  const co = tag('推論：|V| − 1 輪後 d(v) 還在變 → 有負 cycle', 'ptr alt', 0, 0.3, -3.3);
  say('推論：|V| − 1 輪後還沒收斂', '→ 存在從 s 走得到的負 cycle');
  await beat(tok, 3200);
  buildGraph(S2G.path5, { dz: 0.6 });
  nodeNote(0, 's = v0'); nodeNote(4, 'v = vk');
  s2Path([0, 1, 2, 3, 4], C.tree, 2);
  say('最短路徑 p = v0, v1, …, vk', 's = v0，v = vk');
  await beat(tok, 3000);
  say('最壞情況 k 多大？', '');
  await beat(tok, 2200);
  const e = addEdge(GR, 4, 2, null, 0.45);
  edgeColor(e, C.back, 2.2); nodeColor(2, C.back, 0.4);
  say('k > |V| − 1 一定重複走到某個點', '重複頂點 = 有 cycle，不是簡單路徑');
  await beat(tok, 3200);
  edgeColor(e, C.dim, 1); nodeColor(2, C.white, 0);
  const kk = tag('k ≤ |V| − 1', 'ptr alt', 0, 0.3, 3.4);
  say('沒有負 cycle → 最短路徑是簡單的', '所以 k ≤ |V| − 1');
  await beat(tok, 3200);
  kill(th); kill(co); kill(kk);
}]);

// 23:28 歸納：第 i 輪結束時 d(v_i) = δ(s, v_i)
FRAG.push(['spmit2-bf-induction', 'L17：證明——每一輪前進一個頂點', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(S2G.ind);
  const d = [0, INF, INF, INF, INF], par = [-1, -1, -1, -1, -1];
  for (let v = 0; v < 5; v++) nodeTag(v, fmt(d[v]));
  nodeNote(0, 's');
  const dl = [0, 2, 3, 6, 7];
  say('取邊數最少的最短路徑 v0→…→v4', 'δ：0, 2, 3, 6, 7（權重是示意）');
  s2Path([0, 1, 2, 3, 4], C.tree, 1.6);
  await beat(tok, 3000);
  s2Path([0, 1, 2, 3, 4], C.edge, 1);
  const ord = [[3, 4], [2, 4], [2, 3], [1, 3], [1, 2], [0, 2], [0, 1]];
  const pt = tag('', 'ptr alt', 0, 0.3, 3.2);
  for (let p = 1; p <= 4; p++) {
    txt(pt, '第 ' + p + ' 輪');
    say('第 ' + p + ' 輪：每條邊都 relax', '故意用最差的順序：從尾巴往前');
    await s2Pass(tok, d, par, ord, 170);
    nodeColor(p, C.ok, 0.3);
    edgeColor(s2E(p - 1, p), C.tree, 2);
    say('第 ' + p + ' 輪後：d(v' + p + ') = δ = ' + dl[p], p === 1 ? '這輪一定 relax 到 (v0, v1)' : 'd(v' + (p - 1) + ') 已正確，這輪 relax (v' + (p - 1) + ', v' + p + ')');
    await beat(tok, 2000);
  }
  say('frontier 每輪前進一格', 'k ≤ |V| − 1 輪 → 所有走得到的點 d = δ');
  await beat(tok, 3200);
}]);

// 30:16 推論的證明：多一輪還能 relax → 路徑有重複頂點 → 負 cycle
FRAG.push(['spmit2-bf-corollary', 'L17：還能 relax 就有負 cycle', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(S2G.loop);
  const d = [0, INF, INF, INF], par = [-1, -1, -1, -1];
  for (let v = 0; v < 4; v++) nodeTag(v, fmt(d[v]));
  const ord = [[0, 1], [1, 2], [2, 3], [3, 1]];
  const pt = tag('', 'ptr alt', -4.6, 0.3, 3.4);
  say('先跑 |V| − 1 = 3 輪', '邊的順序：s→a、a→b、b→c、c→a');
  for (let p = 1; p <= 3; p++) { txt(pt, '第 ' + p + ' 輪'); await s2Pass(tok, d, par, ord, 160); await beat(tok, 500); }
  say('3 輪後：a −2、b 0、c 1', '照理應該已經收斂');
  await beat(tok, 2600);
  txt(pt, '檢查輪');
  const e = s2E(1, 2);
  edgeColor(e, C.back, 2.4); nodeColor(2, C.back, 0.4);
  say('a→b 還能 relax：0 > −2 + 1', '→ report 負 cycle');
  await beat(tok, 3000);
  for (const [v, p] of [[2, 1], [1, 3], [3, 2]]) { nodeNote(v, 'π = ' + nm(p)); await beat(tok, 700); }
  say('沿 π 往回：b ← a ← c ← b', '頂點 b 重複 → 不是簡單路徑');
  await beat(tok, 3000);
  s2Path([1, 2, 3, 1], C.back, 2.4);
  say('重複頂點 = cycle', '還能讓 d 變小 → 權重 1 + 1 − 3 < 0');
  await beat(tok, 3200);
}]);

// 33:48 學生提問：2、3、−1 的例子，每輪都照同樣順序 relax 全部的邊
FRAG.push(['spmit2-bf-qa-order', 'L17：2、3、−1 的例子逐輪執行', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(S2G.qa);
  const d = [0, INF, INF, INF], par = [-1, -1, -1, -1];
  for (let v = 0; v < 4; v++) nodeTag(v, fmt(d[v]));
  const ord = [[1, 2], [0, 1], [3, 1]];
  tag('順序：① A→B ② S→A ③ C→A', 'idx', 0, 0.3, 4.3);
  say('|V| = 4 → 3 輪，每輪順序相同', '① −1、② 2、③ 3');
  await beat(tok, 3000);
  const pt = tag('', 'ptr alt', -4.6, 0.3, 3.2);
  const caps = [['①：A 還是 ∞，沒變；② A = 2', '③：C 是 ∞，沒變'], ['① A→B：2 − 1 = 1', '② ③ 都沒變'], ['什麼都沒變', '']];
  for (let p = 1; p <= 3; p++) {
    txt(pt, '第 ' + p + ' 輪');
    say('第 ' + p + ' 輪', '');
    await s2Pass(tok, d, par, ord, 420);
    say(caps[p - 1][0], caps[p - 1][1]);
    await beat(tok, 2200);
  }
  nodeColor(3, C.dim, 0);
  say('結果：A = 2、B = 1、C = ∞', 'C 從 S 走不到，一直是 ∞');
  await beat(tok, 3000);
  say('每一輪 relax「所有」的邊', '順序不影響最後答案');
  await beat(tok, 2600);
}]);

// 36:38 只偵測從 s 走得到的負 cycle；權重範圍的演算法
FRAG.push(['spmit2-bf-unreachable', 'L17：走不到的負 cycle 偵測不到', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  say('一般情況沒有更好的演算法', '假設權重範圍 W 的演算法：複雜度含 W，不好比');
  await beat(tok, 3400);
  buildGraph(S2G.unr);
  const d = [0, INF, INF, INF];
  for (let v = 0; v < 4; v++) nodeTag(v, fmt(d[v]));
  nodeColor(0, C.pq, 0.3);
  s2Path([1, 2, 3, 1], C.back, 2);
  say('負 cycle x→y→z：1 + 1 − 3', '但 s 沒有出邊');
  await beat(tok, 3000);
  say('Initialize 由 s 決定', 'd(s) = 0，其他 ∞');
  await beat(tok, 2400);
  for (const [u, v] of [[1, 2], [2, 3], [3, 1]]) { const e = s2E(u, v); edgeColor(e, C.hot, 2.4); await beat(tok, 700); edgeColor(e, C.back, 2); }
  say('∞ + w 還是 ∞：什麼都沒變', '檢查輪也找不到能 relax 的邊');
  await beat(tok, 3000);
  say('只偵測得到 s 走得到的負 cycle', '其他 d 正確地留在 ∞');
  await beat(tok, 3000);
}]);

// 39:14 longest path：把權重變負再跑 Bellman-Ford？
FRAG.push(['spmit2-longest-negate', 'L17：取負號求 longest path 行不行', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(S2G.lng);
  say('s 到 v3：最長 6、最短 4', '1 + 2 + 3 = 6；直接 4（權重示意）');
  s2Path([0, 1, 2, 3], C.hot, 2.2);
  await beat(tok, 2400);
  s2Path([0, 3], C.tree, 2.2);
  await beat(tok, 2200);
  s2Path([0, 1, 2, 3], C.edge, 1); s2Path([0, 3], C.edge, 1);
  for (const e of GR.edges) setW(e, -e.w);
  say('全部取負號，跑 Bellman-Ford', '最短 −6 → 最長 6？');
  await beat(tok, 2800);
  s2Path([0, 1, 2, 3], C.ok, 2.2); nodeTag(3, 'd = −6');
  say('這張圖剛好可以', '沒有 cycle 就沒有負 cycle');
  await beat(tok, 2600);
  s2Path([0, 1, 2, 3], C.edge, 1); nodeTag(3, '');
  const e = addEdge(GR, 3, 1, -1, 0.3);
  say('學生指出：還有一條邊形成 cycle', 'v1→v2→v3→v1（示意）');
  edgeColor(e, C.hot, 2);
  await beat(tok, 3000);
  s2Path([1, 2, 3, 1], C.back, 2.4);
  say('取負後：−2 − 3 − 1 = −6 < 0', 'Bellman-Ford 回報負 cycle，abort');
  await beat(tok, 3400);
  say('正權重的 cycle 一取負就變負 cycle', '這招求 longest path 一般行不通');
  await beat(tok, 3000);
}]);

// 43:55 有負 cycle 時求「最短簡單路徑」是 NP-hard
FRAG.push(['spmit2-simple-path-np', 'L17：最短簡單路徑是 NP-hard', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(S2G.np, { ns: 0.85 });
  s2Path([2, 6, 7, 2], C.back, 2);
  say('另一張圖：b 上掛著負 cycle', '2 + 3 − 6 = −1');
  await beat(tok, 3000);
  const acc = [3, 5, 8, 11, 13];
  for (let i = 0; i < 5; i++) { edgeColor(s2E(i, i + 1), C.tree, 2.2); nodeTag(i + 1, String(acc[i])); await beat(tok, 600); }
  say('水平那條是最短的簡單路徑', '3 + 2 + 3 + 3 + 2 = 13');
  await beat(tok, 2800);
  nodeColor(5, C.back, 0.4); nodeTag(5, 'undefined', 'ptr alt');
  say('Bellman-Ford 不會告訴你 13', '到 v 之前會經過負 cycle → abort');
  await beat(tok, 3000);
  const a = tag('允許 abort：O(VE)', 'ptr', -3, 0.3, 3.6);
  const b = tag('要最短簡單路徑：NP-hard', 'ptr alt', 3, 0.3, 3.6);
  say('只多要一點點，就從多項式變難題', '目前只知道指數時間的演算法');
  await beat(tok, 3400);
  say('跟 longest path 一樣難', '會解一個就會解另一個');
  await beat(tok, 3000);
  kill(a); kill(b);
}]);

// ══════════ R15 Shortest Paths ══════════
// 02:16 從 BFS 出發：沒有權重時的 levels
FRAG.push(['spmit2-r15-bfs-levels', 'R15：沒有權重就用 BFS', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  say('邊權重：正整數、最大 W', '暴力法：列出所有路徑');
  await beat(tok, 2800);
  buildGraph({ directed: false, names: S2G.r15.names, pos: S2G.r15.pos, edges: S2G.r15.edges.map(([u, v]) => [u, v]) }, { dx: -0.4, dz: -0.8 });
  say('先簡化：所有邊一樣長', 'A 到 E 的最短路徑 → BFS');
  await beat(tok, 2600);
  const q = makeStrip(-4.4, 3.9, 'list');
  const { lv, par, order } = s2Bfs(0);
  const inQ = [0];
  q.set([{ key: 'A', text: 'A' }]);
  nodeTag(0, 'L0');
  for (let i = 0; i < order.length; i++) {
    const u = order[i];
    nodeColor(u, C.ok, 0.3);
    const nw = order.filter((v) => par[v] === u);
    for (const v of nw) { inQ.push(v); nodeTag(v, 'L' + lv[v]); edgeColor(s2E(u, v), C.tree, 2); }
    q.set(inQ.slice(i + 1).map((v) => ({ key: nm(v), text: nm(v) })));
    say('取出 ' + nm(u) + '，沒看過的鄰居放到尾巴', nw.length ? '加入 ' + nw.map(nm).join('、') : '鄰居都看過了');
    await beat(tok, 1700);
  }
  say('levels：0, 1, 1, 2, 2', '半徑 1 的圈、半徑 2 的圈');
  await beat(tok, 2800);
  const F = cube('F', C.white, [0.7, 0.5, 0.7], 3.8, 0.25, 3.6, 3);
  const r = s2Rod(1.8, 1.0, 3.8, 3.6, C.tree);
  tag('L3', 'ptr', 3.8, 1.2, 3.6);
  say('在 D 旁加 F：從 D 發現，level 3', 'parent 永遠指向上一層');
  await beat(tok, 3000);
  say('BFS = 邊數最少的最短路徑', '有權重就不能直接用');
  await beat(tok, 2600);
  kill(F); kill(r);
}]);

// 07:01 加權：直接把鄰居照權重排進 queue 會出錯
FRAG.push(['spmit2-r15-naive-queue', 'R15：鄰居照權重排序，為什麼不夠', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(S2G.r15, { dx: -0.4, dz: -0.8 });
  say('想讓 BFS 走短邊比長邊快', '');
  await beat(tok, 2400);
  const q = makeStrip(-4.4, 3.9, 'list');
  nodeColor(0, C.ok, 0.3);
  edgeColor(s2E(0, 2), C.hot, 2); edgeColor(s2E(0, 1), C.hot, 2);
  say('取出 A：鄰居 C 2、B 4', '學生：排序，C 先進');
  q.set([{ key: 'C', text: 'C 2' }, { key: 'B', text: 'B 4' }]);
  nodeNote(2, 'π = A'); nodeNote(1, 'π = A');
  await beat(tok, 3000);
  edgeColor(s2E(0, 1), C.back, 2.2);
  nodeTag(1, 'B：4');
  say('B 已經放進去，π(B) = A', '');
  await beat(tok, 2400);
  s2Path([0, 2, 1], C.tree, 2.4);
  say('但 A→C→B = 2 + 1 = 3 < 4', '放進去的那一刻就輸了');
  await beat(tok, 3200);
  say('要處理這個就是 Dijkstra', '今天先找更簡單的辦法');
  await beat(tok, 2800);
  s2Path([0, 2, 1], C.edge, 1); edgeColor(s2E(0, 1), C.edge, 1);
  say('BFS 本身改不動', '下一招：改圖');
  await beat(tok, 2200);
}]);

function s2SplitGraph() {
  const b = S2G.r15, names = [...b.names], pos = b.pos.map((p) => [...p]), edges = [];
  for (const [u, v, w] of b.edges) {
    let prev = u;
    for (let k = 1; k < w; k++) { const t = k / w; pos.push([b.pos[u][0] * (1 - t) + b.pos[v][0] * t, b.pos[u][1] * (1 - t) + b.pos[v][1] * t]); names.push(''); edges.push([prev, names.length - 1]); prev = names.length - 1; }
    edges.push([prev, v]);
  }
  return { directed: false, names, pos, edges };
}
// 10:30 拆邊：權重 c 的邊換成 c 條長度 1 的邊，再跑 BFS
FRAG.push(['spmit2-r15-dummy-nodes', 'R15：加假節點，把權重拆成單位邊', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(S2G.r15, { dx: -0.4, dz: -0.8 });
  say('提示：可以改圖', '權重 c 的邊 → c 條長度 1 的邊');
  await beat(tok, 2800);
  edgeColor(s2E(0, 1), C.hot, 2); edgeColor(s2E(0, 2), C.hot, 2);
  say('A–B 的 4 → 四段；A–C 的 2 → 兩段', '中間塞假節點');
  await beat(tok, 2600);
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(s2SplitGraph(), { dx: -0.4, dz: -0.8, ns: 0.8 });
  for (let i = 5; i < GR.n; i++) { GR.nodes[i].mesh.scale.set(0.45, 1, 0.45); GR.nodes[i].mesh.material.color.set(C.dim); }
  say('所有邊都一樣長了 → BFS', 'BFS 要走 c 步才通過原本的邊');
  await beat(tok, 2600);
  const { lv, par } = s2Bfs(0);
  const mx = Math.max(...lv);
  for (let L = 0; L <= mx; L++) {
    for (let v = 0; v < GR.n; v++) if (lv[v] === L) { if (v < 5) { nodeColor(v, C.ok, 0.3); nodeTag(v, nm(v) + '：' + L); } else GR.nodes[v].mesh.material.color.set(C.ok); if (par[v] >= 0) edgeColor(s2E(par[v], v), C.tree, 1.8); }
    say('BFS 第 ' + L + ' 層', L === 3 ? 'B 從 C 先到：距離 3，不是 4' : '');
    await beat(tok, L === 3 ? 2400 : 900);
  }
  const p = s2Back(par, 4);
  s2Path(p, C.hot, 2.4);
  say('A, 假, C, D, 假, E', '距離 2 + 1 + 2 = 5');
  await beat(tok, 3200);
}]);

// 13:09 reduction：transform → 已知演算法（黑盒）→ interpret
FRAG.push(['spmit2-r15-reduction', 'R15：轉換 → 黑盒 → 解讀', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const box = (t, col, x, z) => cube(t, col, [2.6, 0.6, 1.1], x, 0.3, z, 3);
  const b1 = box('原始輸入：加權圖', '#efe3c8', -4.2, -2.6);
  say('問題的原始輸入：白板上的圖', '');
  await beat(tok, 2000);
  const b2 = box('新輸入：單位邊', '#efe3c8', 0, -2.6);
  arrow(V3(-2.8, 0.4, -2.6), V3(-1.4, 0.4, -2.6));
  tag('transform：拆邊', 'idx', -2.1, 0.3, -1.6);
  say('transform：好寫的轉換', '拆邊、塞假節點');
  await beat(tok, 2600);
  const b3 = box('BFS（黑盒）', C.pq, 4.2, -2.6);
  arrow(V3(1.4, 0.4, -2.6), V3(2.8, 0.4, -2.6));
  say('已知演算法當黑盒', '正確性、時間都不用再證');
  await beat(tok, 2800);
  const b4 = box('A, 假, C, D, 假, E', '#efe3c8', 4.2, 1.2);
  arrow(V3(4.2, 0.4, -1.9), V3(4.2, 0.4, 0.5));
  say('原始輸出有假節點', '出題的人看不懂');
  await beat(tok, 2600);
  const b5 = box('A, C, D, E', C.ok, -1.6, 1.2);
  arrow(V3(2.8, 0.4, 1.2), V3(0, 0.4, 1.2));
  tag('interpret：拿掉假節點', 'idx', 1.4, 0.3, 2.2);
  say('interpret / read out', '得到原問題的答案');
  await beat(tok, 2800);
  say('6.006 最常用的方式', '難的是 transform，不是 read out');
  await beat(tok, 3000);
}]);

// 16:00 拆邊後的執行時間 vs Dijkstra
FRAG.push(['spmit2-r15-split-cost', 'R15：拆邊的代價', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  say("原圖：V′ 點、E′ 邊、權重 ≤ W′", '');
  await beat(tok, 2200);
  const a = tag("新圖邊數 ≤ W′E′", 'ptr', -3, 0.3, -3.6);
  say('每條邊最多拆成 W′ 段', "E ≤ W′E′");
  await beat(tok, 2600);
  const b = tag("新圖點數 ≤ V′ + W′E′", 'ptr', 3, 0.3, -3.6);
  say('別忘了原本的點', "V ≤ V′ + W′E′");
  await beat(tok, 2600);
  const c = tag("BFS：O(V′ + W′E′)", 'ptr alt', 0, 0.3, -2.6);
  say('BFS 是 O(V + E)', "→ O(V′ + W′E′)");
  await beat(tok, 2600);
  s2Bar('BFS 拆邊 W′E′', C.ok, 1.6, -2, 0.6, 1.1);
  s2Bar('Dijkstra E′ log V′', '#4b9ee2', 1.6, 2, 0.6, 1.1);
  say('Dijkstra：理論 O(V log V + E)', '實務（binary heap）O(E log V)');
  await beat(tok, 3000);
  say("W′ ≤ log V′ 時不比 Dijkstra 差", '權重小的圖，不用發明新演算法');
  await beat(tok, 3200);
  kill(a); kill(b); kill(c);
}]);

// 19:54 Tim 與 Jim：Tim 開第一段和最後一段 → 奇數條邊
FRAG.push(['spmit2-r15-tim-jim', 'R15：兄弟輪流開車 = 奇數條邊', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(S2G.r15, { dx: -0.4, dz: -0.8 });
  nodeNote(0, 's'); nodeNote(4, 't');
  say('去年小考題：兩兄弟輪流開', '每過一段路就換人');
  await beat(tok, 2800);
  say('出城、進城最難：都要 Tim 開', '第一段、最後一段都是 Tim');
  await beat(tok, 2800);
  const lbl = [];
  const path = [0, 2, 3, 4], who = ['Tim', 'Jim', 'Tim'];
  for (let i = 0; i < 3; i++) {
    edgeColor(s2E(path[i], path[i + 1]), C.tree, 2.2);
    const p = GR.nodes[path[i]].home, q2 = GR.nodes[path[i + 1]].home;
    lbl.push(tag(who[i], 'ptr alt', (p.x + q2.x) / 2, 0.9, (p.z + q2.z) / 2 + 0.5));
    await beat(tok, 800);
  }
  say('Tim, Jim, Tim：3 條邊', '要的是「邊數為奇數」的最短路徑');
  await beat(tok, 3000);
  s2Path(path, C.edge, 1); lbl.forEach(kill);
  edgeColor(s2E(0, 1), C.back, 2.2); edgeColor(s2E(1, 4), C.back, 2.2);
  const x1 = tag('Tim', 'ptr alt', -3.6, 0.9, -1.6), x2 = tag('Jim', 'ptr alt', 1.7, 0.9, -1.6);
  say('A→B→E 只有 2 條：Jim 收尾 ✗', 'Tim 不能連開兩段');
  await beat(tok, 3000);
  kill(x1); kill(x2);
  say('Tim 開 3 段、Jim 開 2 段也行', '只要總邊數是奇數');
  await beat(tok, 2600);
}]);

// 25:09 列舉路徑不可行：菱形串 → 指數多條
FRAG.push(['spmit2-r15-diamonds', 'R15：菱形串有指數多條路徑', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const nm3 = ['s', '', '', '', '', '', '', '', '', 't'];
  const pos = [[-5.4, 0], [-4, -1.6], [-4, 1.6], [-2.6, 0], [-1.2, -1.6], [-1.2, 1.6], [0.2, 0], [1.6, -1.6], [1.6, 1.6], [3, 0]];
  const edges = [];
  for (let k = 0; k < 3; k++) { const m = 3 * k; edges.push([m, m + 1], [m, m + 2], [m + 1, m + 3], [m + 2, m + 3]); }
  buildGraph({ directed: true, names: nm3, pos, edges }, { dx: 0.8, ns: 0.8 });
  say('想法：列出所有奇數長度的路徑', '每條邊都是 1');
  await beat(tok, 2800);
  const cnt = tag('0 條', 'ptr alt', 0.8, 0.3, 3.2);
  for (let m = 0; m < 8; m++) {
    const vs = [0];
    for (let k = 0; k < 3; k++) vs.push(3 * k + ((m >> k) & 1 ? 2 : 1), 3 * k + 3);
    s2Path(vs, C.hot, 2.2); txt(cnt, (m + 1) + ' 條');
    await beat(tok, 520);
    s2Path(vs, C.edge, 1);
  }
  say('每個菱形 2 種走法：2 × 2 × 2 = 8', '');
  await beat(tok, 2800);
  txt(cnt, '再加一個菱形 → 16 條');
  say('多一個菱形就翻倍', '路徑數 ≈ 2 的 (頂點數 / 3) 次方：指數');
  await beat(tok, 3200);
  say('列舉所有路徑一定太慢', '不管演算法多聰明');
  await beat(tok, 2600);
}]);

function s2ParityGraph() {
  const b = S2G.r15, names = [], pos = [], edges = [];
  b.names.forEach((n, i) => { names.push(n + 'ₑ'); pos.push([b.pos[i][0] * 0.9, b.pos[i][1] * 0.55 - 2.7]); });
  b.names.forEach((n, i) => { names.push(n + 'ₒ'); pos.push([b.pos[i][0] * 0.9, b.pos[i][1] * 0.55 + 2.7]); });
  for (const [u, v, w] of b.edges) edges.push([u, v + 5, w], [u + 5, v, w]);
  return { directed: false, names, pos, edges };
}
// 28:24 缺少的 state（奇偶）→ 每個點複製 even / odd 兩份；params.part = 2：接邊、起點 Aₑ、終點 Eₒ
FRAG.push(['spmit2-r15-parity', 'R15：用 even / odd 兩層記住奇偶', async (tok) => {
  const part = (ctx.params || {}).part === 2 ? 2 : 1;
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  if (part === 1) {
    buildGraph(S2G.r15, { dx: -0.4, dz: -0.8 });
    say('最短路徑只告訴你距離', '不知道用了奇數還是偶數條邊');
    await beat(tok, 2800);
    edgeColor(s2E(0, 1), C.hot, 2.2); nodeTag(1, '1 條邊');
    await beat(tok, 1400);
    edgeColor(s2E(0, 1), C.edge, 1); s2Path([0, 2, 1], C.hot, 2.2); nodeTag(1, '或 2 條邊');
    say('到 B 可以 1 條邊，也可以 2 條邊', '缺少的 state：路徑長度的奇偶');
    await beat(tok, 3200);
    say('像 Rubik 方塊：一個 state 一個點', '把 state 放進圖裡');
    await beat(tok, 2600);
    fresh([0, 12.5, 8], [0, 0, -0.3]);
    buildGraph({ ...s2ParityGraph(), edges: [] }, { ns: 0.85 });
    tag('even 層', 'ptr', -5.9, 0.3, -2.7); tag('odd 層', 'ptr alt', -5.9, 0.3, 2.7);
    say('每個點複製兩份', 'Aₑ / Aₒ、Bₑ / Bₒ … Eₑ / Eₒ');
    for (let i = 0; i < 5; i++) { nodeColor(i, '#cfe0f5', 0.2); nodeColor(i + 5, '#f6e2b8', 0.2); await beat(tok, 400); }
    say('ₑ：走偶數條邊到這裡', 'ₒ：走奇數條邊到這裡');
    await beat(tok, 3200);
    return;
  }
  buildGraph(s2ParityGraph(), { ns: 0.85 });
  tag('even 層', 'ptr', -5.9, 0.3, -2.7); tag('odd 層', 'ptr alt', -5.9, 0.3, 2.7);
  for (const e of GR.edges) edgeColor(e, C.dim, 1);
  say('原本的 A–B（4）變成兩條', 'Aₑ–Bₒ、Aₒ–Bₑ：走一條邊奇偶翻轉');
  edgeColor(s2E(0, 6), C.hot, 2); edgeColor(s2E(5, 1), C.hot, 2);
  await beat(tok, 3200);
  say('B–E 也一樣', 'Bₑ–Eₒ、Bₒ–Eₑ');
  edgeColor(s2E(1, 9), C.hot, 2); edgeColor(s2E(6, 4), C.hot, 2);
  await beat(tok, 2600);
  say('A–C：Aₑ–Cₒ、Aₒ–Cₑ', '所有邊都只在兩層之間跳');
  edgeColor(s2E(0, 7), C.hot, 2); edgeColor(s2E(5, 2), C.hot, 2);
  await beat(tok, 2600);
  for (const e of GR.edges) edgeColor(e, C.edge, 1);
  say('想像兩張紙疊起來：第三維是 state', '');
  await beat(tok, 2600);
  nodeColor(0, C.ok, 0.4); nodeColor(9, C.purple, 0.4);
  say('起點 Aₑ（長度 0 是偶數）', '終點 Eₒ（要奇數條邊）');
  await beat(tok, 3000);
  const { par, d } = s2Dij(0);
  const p = s2Back(par, 9);
  s2Path(p, C.tree, 2.4);
  say(p.map(nm).join(' → ') + '：' + d[9], '路徑自動在兩層之間交替');
  await beat(tok, 3400);
}]);

// 36:41 新圖大小與選哪個黑盒
FRAG.push(['spmit2-r15-parity-cost', 'R15：兩層圖的執行時間', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const v1 = s2Bar('V', '#cfe0f5', 1.0, -4.6, -1.6), v2 = s2Bar('2V', '#cfe0f5', 2.0, -3.2, -1.6);
  say('頂點：每個複製兩份', 'V → 2V');
  await beat(tok, 2400);
  s2Bar('E', '#f6e2b8', 1.2, -1.2, -1.6); s2Bar('2E', '#f6e2b8', 2.4, 0.2, -1.6);
  say('邊：每條剛好複製兩次', 'E → 2E');
  await beat(tok, 2400);
  const bf = cube('BFS ✗：有權重', '#e8d8d0', [2.6, 0.5, 0.9], 3.8, 0.25, -3.0, 3);
  say('有權重，BFS 不行', '');
  await beat(tok, 2200);
  const dj = cube('Dijkstra（較快）', C.ok, [2.6, 0.5, 0.9], 3.8, 0.25, -1.6, 3);
  const bm = cube('Bellman-Ford', '#dd8238', [2.6, 0.5, 0.9], 3.8, 0.25, -0.2, 3);
  say('兩個黑盒：哪個快？', 'Dijkstra 快；有負權重才換 Bellman-Ford');
  await beat(tok, 3000);
  glow(dj, GOLD);
  say('開車時間都是正的 → Dijkstra', 'O(V log V + E)，實務 O(E log V)');
  await beat(tok, 3000);
  tag('跟原圖同一個量級', 'ptr alt', -2.0, 0.3, 1.8);
  say('圖只變大常數倍', '執行時間跟原圖一樣');
  await beat(tok, 2800);
}]);

// 39:01 難題：油耗固定、通過時間跟出發時刻有關
FRAG.push(['spmit2-r15-traffic-setup', 'R15：塞車路網：時間優先，再省油', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const bo = cube('Boston', '#cfe0f5', [1.8, 0.6, 1.0], -4.4, 0.3, -2.8, 3), ny = cube('New York', '#f6e2b8', [1.8, 0.6, 1.0], 4.4, 0.3, -2.8, 3);
  arrow(V3(-3.4, 0.4, -2.8), V3(3.4, 0.4, -2.8));
  tag('fc：油耗固定', 'ptr', 0, 0.3, -3.7);
  say('每條（有向）邊兩個數', '油耗 fc 固定');
  await beat(tok, 2800);
  tag('tc(t)：何時出發決定花多久', 'ptr alt', 0, 0.3, -1.9);
  say('通過時間 tc(t) 看出發時刻', '凌晨 2 點 3 小時，尖峰 6 小時');
  const hrs = [3, 3, 4, 6, 4, 4, 6, 4];
  for (let i = 0; i < 8; i++) { s2Bar(String(i * 3) + '時', hrs[i] === 6 ? C.back : C.pq, hrs[i] * 0.35, -4.2 + i * 1.2, 0.8, 0.8); await beat(tok, 250); }
  await beat(tok, 1600);
  tag('m = 24 × 60 = 1440 分鐘', 'idx', 0, 0.3, 3.3);
  say('一天切成 m 分鐘', 'm = 3600 × 24 / 60 = 1440');
  await beat(tok, 2800);
  say('目標 1：最早到達', '目標 2：同樣最早，選最省油');
  await beat(tok, 3000);
  say('把油耗當 state？不行', 'fc 不一定是整數，複製不完');
  await beat(tok, 3000);
  glow(bo, null); glow(ny, null);
}]);

// 46:03 時間當 state：(u, t) 複製 m 份，路的邊與等待的邊
FRAG.push(['spmit2-r15-time-expanded', 'R15：時間展開圖', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const T = 6, tc = [3, 3, 2, 1, 1], fc = 4;
  const names = [], pos = [];
  for (let t = 0; t < T; t++) { names.push('u' + t); pos.push([-5 + 2 * t, -2]); }
  for (let t = 0; t < T; t++) { names.push('v' + t); pos.push([-5 + 2 * t, 2]); }
  buildGraph({ directed: true, names, pos, edges: [] }, { ns: 0.85 });
  tag('時間 t →', 'idx', 0, 0.3, 3.6);
  say('時間當 state：每個點複製 m 份', '(城市, 分鐘)：u0 … u5、v0 … v5');
  await beat(tok, 3000);
  const roads = [];
  for (let t = 0; t < 5; t++) if (t + tc[t] < T) { const e = addEdge(GR, t, T + t + tc[t], fc); roads.push(e); edgeColor(e, C.tree, 1.6); await beat(tok, 500); }
  say('路 u→v：(u, t) → (v, t + tc(t))', '油耗都是 fc = 4（tc 是示意）');
  await beat(tok, 3200);
  const waits = [];
  for (let t = 0; t + 1 < T; t++) { waits.push(addEdge(GR, t, t + 1, 0), addEdge(GR, T + t, T + t + 1, 0)); }
  for (const e of waits) edgeColor(e, C.ok, 1.6);
  say('等待邊：(u, t) → (u, t + 1)', '油耗 0：塞車時先去吃個東西');
  await beat(tok, 3200);
  for (const e of waits) edgeColor(e, C.edge, 1);
  edgeColor(roads[0], C.hot, 2.4);
  say('u0 出發：(u, 0) → (v, 3)', 'tc(0) = 3 分鐘');
  await beat(tok, 2600);
  edgeColor(roads[0], C.tree, 1.6);
  edgeColor(waits[0], C.hot, 2.4); edgeColor(waits[2], C.hot, 2.4); edgeColor(roads[2], C.hot, 2.4);
  say('等 2 分鐘再走：u0→u1→u2→v4', '還是一條普通的路徑');
  await beat(tok, 3200);
}]);

// 53:11 大小、用 Dijkstra、讀答案：目的地的 m 個副本
FRAG.push(['spmit2-r15-read-answer', 'R15：時間展開圖怎麼讀答案', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const a = tag('頂點：V · m', 'ptr', -3.4, 0.3, -3.8);
  const b = tag('邊：E · m（路）+ V · m（等待）', 'ptr', 2.4, 0.3, -3.8);
  say('頂點 V·m；邊 E·m + V·m', '等待邊：每個城市每分鐘一條');
  await beat(tok, 3200);
  const c = tag('油耗 ≥ 0 → Dijkstra', 'ptr alt', 0, 0.3, -2.9);
  say('權重是油耗，非負', '丟進 Dijkstra');
  await beat(tok, 2600);
  const vals = [INF, INF, INF, 12, 10, 10, 9];
  const cs = [];
  for (let t = 0; t < vals.length; t++) { cs.push(cube(fmt(vals[t]), C.white, [1.2, 0.5, 1.0], -4.8 + t * 1.6, 0.25, 0.4, 2)); tag('NY@' + (t + 1), 'idx', -4.8 + t * 1.6, 0.3, 1.4); await beat(tok, 300); }
  say('讀終點的 m 個副本', '太早的時刻：∞，到不了');
  for (let t = 0; t < 3; t++) tint(cs[t], C.dim);
  await beat(tok, 3000);
  tint(cs[3], C.ok); glow(cs[3], GOLD);
  say('第一個有限值 = 最早到達', '它的值 = 這個時刻最省的油（數字示意）');
  await beat(tok, 3400);
  for (let t = 4; t < 7; t++) tint(cs[t], '#bfe8d6');
  say('再晚一點到，油可能更省', '整條「等待 vs 省油」的取捨曲線');
  await beat(tok, 3200);
  kill(a); kill(b); kill(c);
}]);

// ══════════ R18 Quiz 2 Review ══════════
// 04:43 relax 的順序決定最後拿到哪一條路徑
FRAG.push(['spmit2-r18-relax-order', 'R18：relax 順序決定 parent', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(S2G.dia);
  const run = async (ord, label) => {
    const d = [0, INF, INF, INF], par = [-1, -1, -1, -1];
    for (let v = 0; v < 4; v++) { nodeTag(v, fmt(d[v])); nodeNote(v, ''); }
    for (const e of GR.edges) edgeColor(e, C.edge, 1);
    say(label, '四條邊都是 1');
    await beat(tok, 2000);
    for (const [u, v] of ord) {
      const e = s2E(u, v); edgeColor(e, C.hot, 2);
      await beat(tok, 700);
      if (d[u] + e.w < d[v]) { d[v] = d[u] + e.w; par[v] = u; nodeTag(v, String(d[v]), 'ptr alt'); nodeNote(v, 'π = ' + nm(u)); edgeColor(e, C.tree, 2); say('Relax ' + nm(u) + '→' + nm(v) + '：d = ' + d[v], 'π(' + nm(v) + ') = ' + nm(u)); }
      else { edgeColor(e, C.edge, 1); say(nm(u) + '→' + nm(v) + '：已經是 2，不變', ''); }
      await beat(tok, 1300);
    }
    return par;
  };
  await run([[0, 1], [1, 3], [0, 2], [2, 3]], '順序 1：s→a、a→t、s→b、b→t');
  say('沿 π 回推：t → a → s', 'π(t) = a');
  await beat(tok, 2600);
  await run([[0, 2], [2, 3], [0, 1], [1, 3]], '順序 2：下面兩條先');
  say('同樣長 2，π(t) = b', '路徑由 relax 順序決定');
  await beat(tok, 2800);
  say('Dijkstra、Bellman-Ford 都會這樣', 'Dijkstra：priority queue 怎麼破平手');
  await beat(tok, 3000);
}]);

// 08:54 Newton：∛6006，f(x) = x³ − 6006，x0 = 1
FRAG.push(['spmit2-r18-newton-6006', 'R18：Newton 法求 ∛6006', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const f = tag('x_{i+1} = x_i − f(x_i) / f′(x_i)', 'ptr', 0, 0.3, -4.0);
  say('Newton：x_{i+1} = x_i − f / f′', '這條要寫在小抄上（是減號）');
  await beat(tok, 3000);
  const good = tag('f(x) = x³ − 6006', 'ptr alt', -3, 0.3, -3.0);
  say('選 f(x) = x³ − 6006', '答案處 f = 0，而且 f / f′ 好算');
  await beat(tok, 3000);
  const bad = tag('f(x) = x − ∛6006 ✗', 'idx', 3, 0.3, -3.0);
  say('f(x) = x − ∛6006 也是 0 在答案', '但 f / f′ 要先知道 ∛6006 ✗');
  await beat(tok, 3200);
  kill(bad);
  const it = tag('x_{i+1} = 2x_i / 3 + 2002 / x_i²', 'ptr', 0, 0.3, -2.0);
  say('化簡：x − (x³ − 6006) / 3x²', '= 2x/3 + 2002/x²');
  await beat(tok, 3000);
  const xs = [1, 2002.67, 1335.11, 890.08];
  const hs = [0.15, 4.4, 3.0, 2.0];
  for (let i = 0; i < xs.length; i++) {
    s2Bar('x' + i + ' = ' + xs[i], i === 0 ? C.pq : '#cfe0f5', hs[i], -4.5 + i * 2.2, 0.8, 1.0);
    say('x' + i + ' = ' + xs[i], i === 1 ? '2/3 + 2002 = 2002.67：離答案很遠' : i === 0 ? '題目給的初始值' : '再代回去');
    await beat(tok, i === 1 ? 2800 : 1800);
  }
  tag('… x₁₆ ≈ 18.1773 = ∛6006', 'ptr alt', 2.4, 0.3, 3.2);
  say('一直代回去，越來越接近', '第 16 步左右才收斂到 18.1773');
  await beat(tok, 3200);
  kill(f); kill(good); kill(it);
}]);

// 15:06 初始值：x_i = x*(1 + ε_i)，ε 每步平方（quadratic convergence）
FRAG.push(['spmit2-r18-newton-guess', 'R18：quadratic convergence 與初始值', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  tag('x_i = x* (1 + ε_i)', 'ptr', -3, 0.3, -4.0);
  tag('ε_{i+1} ≈ ε_i²', 'ptr alt', 3, 0.3, -4.0);
  say('寫成 x_i = 真答案 × (1 + ε_i)', 'Newton 保證誤差每步平方');
  await beat(tok, 3200);
  const good = [0.5, 0.25, 0.0625, 0.0039];
  for (let i = 0; i < 4; i++) { s2Bar('ε' + i + ' = ' + good[i], C.ok, good[i] * 4, -5 + i * 1.5, -1.6, 0.8); await beat(tok, 700); }
  say('|ε0| < 1：越來越小', '正確位數每步加倍');
  await beat(tok, 2800);
  const bad = [1.5, 2.25, 5.06];
  for (let i = 0; i < 3; i++) { s2Bar('ε' + i + ' = ' + bad[i], C.back, Math.min(5, bad[i] * 0.9), 1.4 + i * 1.6, -1.6, 0.8); await beat(tok, 700); }
  say('|ε0| > 1：平方後越來越大', '不會收斂');
  await beat(tok, 3000);
  s2Rod(-5, 2.8, 5, 2.8, C.edge);
  tag('0', 'idx', -5, 0.3, 3.4); tag('x*', 'ptr', 0, 0.3, 3.4); tag('2x*', 'idx', 5, 0.3, 3.4);
  cube('', C.ok, [10, 0.12, 0.3], 0, 0.36, 2.8);
  say('需要 −1 < ε0 < 1', '0 < x0 < 2 × 真答案：粗糙但保證收斂');
  await beat(tok, 3400);
}]);

// 18:05 integer land：b = 10、d = 2，∛2 → ⌊∛(2 · 10⁶)⌋ = 125 → 1.25
FRAG.push(['spmit2-r18-integer-land', 'R18：只用整數算 ∛2 到小數 d 位', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  say('程式裡不想處理小數', '搬到整數的世界');
  await beat(tok, 2600);
  const dg = ['1', '.', '2', '5', '9', '9'];
  const cs = dg.map((c, i) => cube(c, c === '.' ? C.pq : C.white, [0.8, 0.5, 0.8], -2.5 + i * 1.0, 0.25, -2.2, 2));
  say('∛2 = 1.2599…', 'base b = 10，要 d = 2 位');
  await beat(tok, 2800);
  move(cs[1], -2.5 + 3 * 1.0, 0.25, -2.2); move(cs[2], -2.5 + 1 * 1.0, 0.25, -2.2); move(cs[3], -2.5 + 2 * 1.0, 0.25, -2.2);
  say('乘 b^d = 100：小數點右移兩格', '125.99…');
  await beat(tok, 2800);
  fly(cs[1]); fly(cs[4]); fly(cs[5]);
  say('整數演算法給的是 floor', '⌊∛2 · 100⌋ = 125');
  await beat(tok, 2800);
  tag('∛(2 · b^{3d}) = ∛2 · b^d', 'ptr alt', 0, 0.3, 0.4);
  say('b^d 要放進根號：變成 b^{3d}', '算 ⌊∛(2 · 10⁶)⌋ = 125');
  await beat(tok, 3200);
  const pt = cube('.', C.pq, [0.4, 0.5, 0.8], -1.95, 0.25, 2.4, 3);
  for (const [i, c] of [[0, '1'], [1, '2'], [2, '5']]) cube(c, '#bfe8d6', [0.8, 0.5, 0.8], i === 0 ? -2.5 : -1.4 + (i - 1) * 1.0, 0.25, 2.4, 3);
  say('最後右移 d 位', '1.25：兩位精度');
  await beat(tok, 3000);
  glow(pt, GOLD);
}]);

// 23:33 好的初始值：位數對、第一位用 binary search；何時停
FRAG.push(['spmit2-r18-first-digit', 'R18：好的初始值與停止條件', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  say('好的初始值：數量級要對', '= 位數要對');
  await beat(tok, 2600);
  tag('r 是一位數（0 ≤ r < b）', 'idx', -3, 0.3, -4.0);
  const g0 = tag('∛(r · b^{3d}) 約 d + 1 位 → 初值 1 後面 d 個 0', 'ptr', 0, 0.3, -3.2);
  say('答案大約 d + 1 位', '初值：1 後面接 d 個 0（d = 2 → 100）');
  await beat(tok, 3200);
  say('更好：第一位也猜對', 'binary search 在 0 到 r 之間');
  const cs = [0, 1, 2].map((g) => cube(String(g), C.white, [0.9, 0.5, 0.9], -2 + g * 2, 0.25, -0.8, 2));
  tag('r = 2', 'ptr alt', 4.4, 0.3, -0.8);
  await beat(tok, 2600);
  glow(cs[1], GOLD);
  say('猜 g = 1：不能直接算 ∛r', '改比 g³ = 1 ≤ 2');
  await beat(tok, 3000);
  glow(cs[1], null); glow(cs[2], GOLD); tint(cs[2], '#f3c9c0');
  say('猜 g = 2：g³ = 8 > 2', 'g³ 只要兩次乘法');
  await beat(tok, 2800);
  glow(cs[2], null); tint(cs[1], C.ok);
  say('第一位是 1', '');
  await beat(tok, 2000);
  for (let i = 0; i < 4; i++) cube('x' + i, '#cfe0f5', [0.9, 0.5, 0.9], -3 + i * 1.6, 0.25, 2.2, 2);
  tag('x_i = x_{i+1} 就停', 'ptr alt', 0, 0.3, 3.3);
  say('什麼時候停？', '兩個整數近似值一樣就停');
  await beat(tok, 3200);
  kill(g0);
}]);

// 28:37 Newton log d 次 vs binary search O(d) 次
FRAG.push(['spmit2-r18-newton-vs-bs', 'R18：Newton 比 binary search 快在哪', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  say('Newton：正確位數每步加倍', '1, 2, 4, 8, 16, 32 → log d 步');
  const dd = [1, 2, 4, 8, 16, 32];
  for (let i = 0; i < 6; i++) { s2Bar(dd[i] + ' 位', C.ok, dd[i] * 0.13, -5.2 + i * 1.0, -2.2, 0.7); await beat(tok, 450); }
  tag('d = 32：約 6 次', 'ptr', -2.7, 0.3, -0.6);
  await beat(tok, 2200);
  say('binary search 在 0 到 R 之間', 'R = r · b^{3d}');
  await beat(tok, 2600);
  s2Bar('約 320 次', '#dd8238', 4.6, 3.5, -2.2, 1.0);
  say('猜 log R = log r + 3d log b 次', 'b 是常數 → O(d)');
  await beat(tok, 3200);
  tag('Newton O(log d) vs O(d)', 'ptr alt', 0, 0.3, 1.6);
  say('位數多時 Newton 指數級地快', '代價：要好的 f、好的初值');
  await beat(tok, 3000);
  tag('上面是猜的次數，不是總時間', 'idx', 0, 0.3, 2.6);
  say('數字很大時乘法不是 O(1)', 'Newton 除法 ≈ 一次乘法的時間');
  await beat(tok, 3200);
}]);

// 34:46 紅藍邊 + 換色要付 5；只用紅、只用藍兩份圖不夠
FRAG.push(['spmit2-r18-redblue-setup', 'R18：紅藍邊，換色要付 5', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(S2G.rb);
  GR.edges.forEach((e, i) => edgeColor(e, RB_COL[i], 1.8));
  say('每條邊是紅或藍，有權重', '紅↔藍 換色一次付 5');
  await beat(tok, 3000);
  nodeTag(2, '3 + 1 = 4');
  say('S→X→A：都是紅', '3 + 1 = 4');
  await beat(tok, 2600);
  nodeTag(3, '3 + 1 + 5 = 9');
  say('S→X→B：紅轉藍', '3 + 1 + 5 = 9');
  await beat(tok, 2800);
  nodeTag(2, ''); nodeTag(3, '');
  const r = tag('只用紅：到不了 T', 'ptr', -3, 0.3, 3.6), b = tag('只用藍：S 沒有藍邊', 'ptr', 3, 0.3, 3.6);
  say('學生想法：只用紅、只用藍各算一次', '兩份圖各跑最短路徑');
  await beat(tok, 3200);
  say('這張圖兩邊都是 ∞', '沒表達「可以換色」（權重示意）');
  await beat(tok, 3000);
  kill(r); kill(b);
  s2Path([0, 1, 2], S2R, 2.6); edgeColor(s2E(2, 4), S2B, 2.6);
  nodeTag(4, '3 + 1 + 5 + 1 = 10');
  say('正解要能換色：S→X→A→T', '3 + 1 + 5 + 1 = 10');
  await beat(tok, 3200);
}]);

function s2Layers(cross) {
  const b = S2G.rb, names = [], pos = [], edges = [];
  const lay = (i, s) => [b.pos[i][0], b.pos[i][1] * 0.5 + s];
  b.names.forEach((n, i) => { names.push(n + 'ʀ'); pos.push(lay(i, -2.6)); });
  b.names.forEach((n, i) => { names.push(n + 'ʙ'); pos.push(lay(i, 2.6)); });
  b.edges.forEach(([u, v, w], i) => { if (RB_COL[i] === S2R) edges.push([u, v, w]); else edges.push([u + 5, v + 5, w]); });
  for (let i = 0; i < 5; i++) { if (cross >= 1) edges.push([i, i + 5, 5]); if (cross >= 2) edges.push([i + 5, i, 5]); }
  return { directed: true, names, pos, edges };
}
function s2LayerColors() {
  for (let i = 0; i < 5; i++) { nodeColor(i, '#f3c9c0', 0); nodeColor(i + 5, '#c9dcf3', 0); }
  for (const e of GR.edges) if (e.u < 5 && e.v < 5) edgeColor(e, S2R, 1.8); else if (e.u >= 5 && e.v >= 5 && e.v < 10) edgeColor(e, S2B, 1.8);
}
// 40:12 兩層：紅層、藍層，同一點的兩份之間連權重 5 的邊
FRAG.push(['spmit2-r18-redblue-layers', 'R18：紅層＋藍層，層間邊權重 5', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(s2Layers(0), { ns: 0.85 });
  s2LayerColors();
  tag('紅層', 'ptr', -6.3, 0.3, -2.6); tag('藍層', 'ptr', -6.3, 0.3, 2.6);
  say('紅邊放紅層，藍邊放藍層', '每個點兩份：在紅世界 / 在藍世界');
  await beat(tok, 3200);
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(s2Layers(2), { ns: 0.85 });
  s2LayerColors();
  tag('紅層', 'ptr', -6.3, 0.3, -2.6); tag('藍層', 'ptr', -6.3, 0.3, 2.6);
  for (const e of GR.edges) if (e.w === 5 && Math.abs(e.u - e.v) === 5) edgeColor(e, C.purple, 1.4);
  say('同一點的紅、藍副本互連', '權重 5：付錢就能換世界');
  await beat(tok, 3200);
  const { d, par } = s2Dij(0);
  const p = s2Back(par, 9);
  s2Path(p, C.hot, 2.6);
  say('Sʀ→Xʀ→Aʀ→Aʙ→Tʙ = ' + d[9], '3 + 1 + 5 + 1');
  await beat(tok, 3200);
  say('權重都是正的 → Dijkstra', '理論 O(V log V + E)；binary heap O(E log V)');
  await beat(tok, 3000);
  say('新圖：2V 個點、E + 2V 條邊', 'Bellman-Ford O(VE) 比較慢');
  await beat(tok, 3000);
}]);

// 45:14 layer 的直覺：2D 地圖疊成 3D；layer 可以很多
FRAG.push(['spmit2-r18-layers-idea', 'R18：layer = 把 state 疊成第三維', async (tok) => {
  fresh([0, 11.5, 9], [0, 1.2, -0.3]);
  say('原圖是一張 2D 地圖', '');
  const pl = [];
  pl.push(cube('紅層', '#f3c9c0', [7, 0.15, 3.4], 0, 0.1, 0, 3));
  await beat(tok, 2600);
  pl.push(cube('藍層', '#c9dcf3', [7, 0.15, 3.4], 0, 1.4, 0, 3));
  say('複製成兩層：每層一份原圖', '多出來的維度 = state');
  await beat(tok, 2800);
  for (let i = 0; i < 4; i++) cube('', C.purple, [0.08, 1.25, 0.08], -2.4 + i * 1.6, 0.75, 0.6 - (i % 2) * 1.2);
  say('science：做副本', 'art：選哪些 layer、怎麼連');
  await beat(tok, 3000);
  pl.forEach(kill);
  const t = [];
  for (let i = 0; i < 6; i++) t.push(cube(i === 4 ? '…' : i === 5 ? 't = 1439' : 't = ' + i, i % 2 ? '#efe3c8' : '#e6d8b8', [6, 0.12, 3], 0, 0.1 + i * 0.9, 0, 2));
  say('塞車路網：一分鐘一層', '約 1440 層；StarCraft 題更多層');
  await beat(tok, 3600);
  tag('層數合理就沒問題', 'ptr alt', 0, 0.3, 2.6);
  say('轉換通常 O(V + E) 線性時間', '要會算：新圖多大 → 代進演算法');
  await beat(tok, 3200);
}]);

// 48:06 只能紅 → 藍（有向）；想要 SR/SB 到 TR/TB 的最小 → 超級起點與終點
FRAG.push(['spmit2-r18-oneway-super', 'R18：單向換色與超級起點 / 終點', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const G = s2Layers(1);
  G.names.push('s*', 't*'); G.pos.push([-6.5, 0], [6.5, 0]);
  buildGraph({ ...G, edges: G.edges.slice() }, { ns: 0.85 });
  s2LayerColors();
  nodeColor(10, C.dim, 0); nodeColor(11, C.dim, 0);
  for (const e of GR.edges) if (e.w === 5) edgeColor(e, C.purple, 1.4);
  say('變形：只能紅 → 藍，不能回頭', '層間邊改成有向');
  await beat(tok, 3200);
  say('只是限制、不收錢：權重 0', '要收錢：權重 5');
  await beat(tok, 2800);
  nodeColor(0, C.ok, 0.3); nodeColor(5, C.ok, 0.3); nodeColor(4, C.purple, 0.3); nodeColor(9, C.purple, 0.3);
  say('起點 Sʀ 或 Sʙ，終點 Tʀ 或 Tʙ', '4 種組合；從兩個起點各跑一次');
  await beat(tok, 3200);
  const e1 = addEdge(GR, 10, 0, 0), e2 = addEdge(GR, 10, 5, 0), e3 = addEdge(GR, 4, 11, 0), e4 = addEdge(GR, 9, 11, 0);
  computeAdj(GR);
  [e1, e2, e3, e4].forEach((e) => edgeColor(e, C.ok, 1.6));
  nodeColor(10, C.pq, 0.3); nodeColor(11, C.pq, 0.3);
  say('只跑一次：加超級起點 s*、終點 t*', '權重 0 的有向邊');
  await beat(tok, 3200);
  const { d, par } = s2Dij(10);
  s2Path(s2Back(par, 11), C.hot, 2.6);
  say('s* → t* 的最短路徑 = ' + d[11], '一次 Dijkstra 涵蓋 4 種組合');
  await beat(tok, 3200);
}]);

// 51:21 BFS 給 levels，DFS 給邊的種類與結束時間；兩者都用 parent 指標建樹
FRAG.push(['spmit2-r18-bfs-dfs-trees', 'R18：BFS 樹與 DFS 樹不一樣', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(S2G.tri3);
  say('BFS：邊數最少的最短路徑', '頂點分成 levels');
  await beat(tok, 2800);
  say('DFS：邊的種類、結束時間', '結束時間 → topological sort');
  await beat(tok, 2800);
  nodeTag(0, 'L0'); nodeTag(1, 'L1'); nodeTag(2, 'L1');
  edgeColor(s2E(0, 1), C.tree, 2.2); edgeColor(s2E(0, 2), C.tree, 2.2);
  nodeNote(1, 'π = S'); nodeNote(2, 'π = S');
  say('BFS 樹：S→A、S→B', '用 parent 指標記下來');
  await beat(tok, 3000);
  for (const e of GR.edges) edgeColor(e, C.edge, 1);
  for (let v = 0; v < 3; v++) { nodeTag(v, ''); nodeNote(v, ''); }
  edgeColor(s2E(0, 1), C.ok, 2.2); nodeNote(1, 'π = S');
  await beat(tok, 900);
  edgeColor(s2E(1, 2), C.ok, 2.2); nodeNote(2, 'π = A');
  say('DFS 樹：S→A→B', '同一張圖，兩棵不同的樹');
  await beat(tok, 3200);
  edgeColor(s2E(0, 2), C.hot, 2.2);
  say('S→B 在 DFS 裡不是 tree edge', 'B 已經從 A 拜訪過了');
  await beat(tok, 2600);
}]);

// 54:11 DFS 四種邊：tree、back、forward、cross（params.part = 2：判斷條件與摘要）
FRAG.push(['spmit2-r18-dfs-edge-types', 'R18：DFS 的四種邊', async (tok) => {
  const part = (ctx.params || {}).part === 2 ? 2 : 1;
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(S2G.dfs);
  const tree = [[0, 1], [1, 3], [3, 4], [3, 5], [0, 2]];
  if (part === 1) {
    say('四種：tree、back、forward、cross', '照 adjacency list 的字母順序走');
    await beat(tok, 3000);
    const ev = [['d', 0], ['d', 1], ['d', 3], ['d', 4], ['f', 4], ['d', 5], ['f', 5], ['f', 3], ['f', 1], ['d', 2], ['f', 2], ['f', 0]];
    const dt = Array(6).fill(0), ft = Array(6).fill(0);
    for (let i = 0; i < ev.length; i++) {
      const [k, v] = ev[i];
      if (k === 'd') { dt[v] = i + 1; nodeColor(v, C.pq, 0.3); const te = tree.find(([a, b]) => b === v); if (te) edgeColor(s2E(te[0], te[1]), C.tree, 2.2); say('進入 ' + nm(v), te ? 'tree edge ' + nm(te[0]) + '→' + nm(v) : '從 S 開始'); }
      else { ft[v] = i + 1; nodeColor(v, C.ok, 0.3); say(nm(v) + ' 結束', '結束時間 ' + (i + 1)); }
      nodeNote(v, dt[v] + ' / ' + (ft[v] || ''));
      await beat(tok, 900);
    }
    say('tree edge：DFS 真的走過去的邊', 'SA、AC、CD、CE、SB');
    await beat(tok, 3000);
    return;
  }
  for (const [a, b] of tree) edgeColor(s2E(a, b), C.tree, 2.2);
  say('藍色是 tree edge', '在 u 看 (u, v)：v 沒拜訪過，v.parent = u');
  await beat(tok, 3200);
  edgeColor(s2E(1, 5), C.ok, 2.4);
  say('A→E：forward edge', '往下跳不只一層；沿 v 的 parent 往上會遇到 u');
  await beat(tok, 3400);
  edgeColor(s2E(4, 1), C.back, 2.4);
  say('D→A：back edge', 'v 是 u 的祖先；沿 u 的 parent 往上會遇到 v');
  await beat(tok, 3400);
  edgeColor(s2E(2, 3), C.purple, 2.4);
  say('B→C：cross edge', '誰都不是誰的祖先；共同祖先只有 S');
  await beat(tok, 3400);
  say('順 DFS 走 = tree；逆著走 = back', '一次跳好幾層 = forward；其他 = cross');
  await beat(tok, 3200);
  say('種類取決於 adjacency list 的順序', '換個順序，A→E 可能變 tree edge');
  await beat(tok, 3000);
}]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
    ].concat(FRAG.map((f) => f[0])),
    stop() { clearTimeout(timer); epoch++; },
  };
}
