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
  pk = await sbWalk(tok, '5 條邊（≤ 6）', lp, 380);
  say('7 個頂點：任何路徑最多 6 條邊', '這張圖最長的一條走了 5 條');
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
const { V3, cube, glow, kill, arrow, GOLD, buddy, travel, step } = K;
const kanim = K.anim;
// ─── MIT 6.006 L15／L16／L18（Aa2sqUhIn-E、2E7MmKv0Y24、CHvQ3q_gJ7E）── cued scenes ───
// 每個 await step(tok) 等講者說到那一句（行尾 // @秒數 = 那句話開始的時間）。
// 用本章模組的畫圖工具（buildGraph、nodeTag、edgeColor…）；fresh / tag / code 是模組自己的版本。
// 內建場景（sp-exp-paths、relax-safe、dij-clrs5…）的跟講版本也在這裡，id 前綴 spmit1-。
const SM = {
  map: { title: 's, a, b, t', directed: true, names: ['s', 'a', 'b', 't'], pos: [[-4.6, 0.4], [-0.8, -2.3], [-0.6, 2.4], [3.8, 0.2]], edges: [[0, 1, 3], [0, 2, 2], [1, 3, 4], [2, 3, 6], [1, 2, 1]] },
  k4: { title: 'K4', directed: false, names: ['a', 'b', 'c', 'd'], pos: [[-1.6, -1.6], [1.6, -1.6], [1.6, 1.6], [-1.6, 1.6]], edges: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3]] },
  path4: { title: 'v0 … v3', directed: true, names: ['v0', 'v1', 'v2', 'v3'], pos: [[-5, 0.6], [-1.7, -1.4], [1.7, -1.4], [5, 0.6]], edges: [[0, 1, 2], [1, 2, 1], [2, 3, 3]] },
  // L15 δ 定義的小例子（示意）
  delta: { title: 'δ(u, v)', directed: true, names: ['u', 'x', 'v', 'z'], pos: [[-4.4, 0.6], [0, -2.2], [4.0, 0.6], [1.6, 3.0]], edges: [[0, 1, 2], [1, 2, 3], [0, 2, 7]] },
  // L15 負權重的動機（示意）：a → t 是「倒貼的收費站」
  toll: { title: '倒貼收費', directed: true, names: ['s', 'a', 't'], pos: [[-4.6, 0.8], [0, -2.4], [4.4, 0.8]], edges: [[0, 1, 3], [1, 2, -2], [0, 2, 2]] },
  opt: { title: 'v0 → v3', directed: true, names: ['v0', 'v1', 'v2', 'v3'], pos: [[-5, 0.6], [-1.7, -1.4], [1.7, -1.4], [5, 0.6]], edges: [[0, 1, 4], [1, 2, 3], [2, 3, 2]] },
  tri3: { title: 'v0, v1, v2', directed: true, names: ['v0', 'v1', 'v2'], pos: [[-4.4, 1.4], [4.4, 1.4], [0, -2.2]], edges: [[0, 1, 'δ(v0,v1)'], [0, 2, 'δ(v0,v2)'], [2, 1, 'δ(v2,v1)']] },
  // L16 relaxation 安全性：s、u、v 三角形（標籤是符號）
  tri: { title: 's, u, v', directed: true, names: ['s', 'u', 'v'], pos: [[-4.4, 1.2], [0, -2.0], [4.2, 1.2]], edges: [[0, 1, 'δ(s,u)'], [1, 2, 'w(u,v)'], [0, 2, 'δ(s,v)', 0.25]] },
  // L16 DAG：A、B 在 S 的左邊（走不到）
  dagL: { title: 'A, B, S', directed: true, names: ['A', 'B', 'S'], pos: [[-4.6, 0], [-1.2, 0], [2.2, 0]], edges: [[0, 1, 1], [1, 2, 1], [0, 2, 4, 0.3]] },
  // L16 白板的 DAG（= CLRS 圖 24.5）；講者叫第三、四個頂點 a、b
  dagv: { title: 'DAG', directed: true, names: ['r', 'S', 'a', 'b', 'c', 'd'], pos: [[-5.5, 0], [-3.3, 0], [-1.1, 0], [1.1, 0], [3.3, 0], [5.5, 0]],
    edges: [[0, 1, 5], [0, 2, 3, 0.3], [1, 2, 2], [1, 3, 6, -0.3], [2, 3, 7], [2, 4, 4, 0.3], [2, 5, 2, -0.26], [3, 4, -1], [3, 5, 1, 0.42], [4, 5, -2]] },
  // L18 雙向搜尋的示意圖（沒有權重）
  bi: { title: 's … t', directed: true, names: ['s', 'v1', 'v3', 'v2', 't', 'x'], pos: [[-5.2, 0], [-2.6, -2.2], [0.4, -2.2], [2.8, 0], [5.4, 0], [-1.0, 2.2]], edges: [[0, 1], [0, 5], [1, 2], [2, 3], [5, 3], [3, 4]] },
  // L18 位能：s 出去兩條 5（t1→t、t2→t 的權重是示意）
  pot: { title: 'potential', directed: true, names: ['s', 't1', 't2', 't'], pos: [[-5, 0], [-0.6, -2.4], [-0.6, 2.4], [4.4, 0]], edges: [[0, 1, 5], [0, 2, 5], [1, 3, 4], [2, 3, 8]] },
  land: { title: 'landmark', directed: true, names: ['s', 't1', 't2', 't', 'L'], pos: [[-5.6, 0], [-2, -2.4], [-2, 2.4], [2.4, 0], [5.6, 0]], edges: [[0, 1, 5], [0, 2, 5], [1, 3, 4], [2, 3, 8], [3, 4, 2]] },
};
const smE = (u, v) => findEdge(u, v);
const smPath = (vs, color, k = 2.2) => { for (let i = 0; i + 1 < vs.length; i++) edgeColor(smE(vs[i], vs[i + 1]), color, k); };
// 小幫手：一個會跟著講者動的小角色
const guide = (x, z, name = '小路', color = '#f4a56a', s = 0.6) => buddy(name, '', color, x, 0, z, s);
const goTo = (tok, b, x, z, ms = 700) => travel(tok, b.g, b.g.position.clone(), V3(x, 0, z), ms);
const hp = (i, y = 1.0) => { const h = GR.nodes[i].home; return V3(h.x, y, h.z); };
function hideW(on = true) { GR.edges.forEach((e) => { if (e.lbl) e.lbl.element.style.visibility = on ? 'hidden' : ''; }); }
const showW = (e, on = true) => { if (e && e.lbl) e.lbl.element.style.visibility = on ? '' : 'hidden'; };
function dropEdge(e) { lab.world.remove(e.group); if (e.lbl) kill(e.lbl); const i = GR.edges.indexOf(e); if (i >= 0) GR.edges.splice(i, 1); }
// 一個小封包沿著一串頂點走，帶著它算的數字
async function walk(tok, text, path, ms = 600) {
  const a = hp(path[0]);
  const pk = tag(text, 'pkt', a.x, 1.0, a.z);
  for (let i = 1; i < path.length; i++) await travel(tok, pk, hp(path[i - 1]), hp(path[i]), ms);
  return pk;
}
// relax 一條邊：封包帶著 d(u) + w 走過去，比較後才改數字（一次一條）
function relaxer(d, par, o = {}) {
  let pk = null;
  const show = o.show || ((v) => nodeTag(v, (o.pre || '') + fmt(d[v])));
  const r = async (tok, u, v) => {
    if (pk) { kill(pk); pk = null; }
    const e = smE(u, v); edgeColor(e, C.hot, 1.8);
    const sum = fmt(d[u]) + (e.w < 0 ? ' − ' + Math.abs(e.w) : ' + ' + e.w);
    pk = await walk(tok, sum, [u, v], o.ms || 650);
    const nd = d[u] + e.w, old = d[v];
    if (nd < old) {
      if (par && par[v] >= 0) { const pe = smE(par[v], v); if (pe && pe !== e) edgeColor(pe, C.dim, 1); }
      d[v] = nd; if (par) par[v] = u;
      show(v); if (par && o.pi) nodeNote(v, 'π = ' + nm(u));
      txt(pk, sum + ' = ' + fmt(nd) + ' < ' + fmt(old)); edgeColor(e, C.tree, 2.2);
      if (o.after) o.after(v);
      return true;
    }
    txt(pk, sum + ' = ' + fmt(nd) + ' ≥ ' + fmt(old)); edgeColor(e, C.dim, 1);
    return false;
  };
  r.clear = () => { if (pk) { kill(pk); pk = null; } };
  return r;
}

// ══════════ L15（Aa2sqUhIn-E）══════════
// 00:19 加權圖：這個單元要做什麼
FRAG.push(['spmit1-weighted', 'L15：邊上有權重的圖', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const g = guide(-6.2, 3.4);
  await step(tok);                                   // @19.0 a series of lectures on shortest paths
  buildGraph(SM.map); hideW();
  const q = tag('最短的路怎麼走？', 'say', -6.2, 1.7, 3.4);
  say('新單元：最短路徑 shortest paths', '接在 BFS、DFS 之後');
  await step(tok);                                   // @39.0 graphs that have weights on their edges
  hideW(false); kill(q);
  GR.edges.forEach((e) => edgeColor(e, C.hot, 1.6));
  g.mood('wow');
  say('最大的不同：邊上有權重 weight', 'BFS、DFS 的邊上沒有數字');
  await step(tok);                                   // @67.6 these weights can be integers
  GR.edges.forEach((e) => edgeColor(e, C.edge, 1));
  g.mood('calm');
  say('權重可以是整數', '3、2、4、6、1');
  await step(tok);                                   // @70.5 real numbers, irrationals
  setW(smE(0, 1), 2.5); setW(smE(1, 3), '√2');
  edgeColor(smE(0, 1), C.hot, 1.8); edgeColor(smE(1, 3), C.hot, 1.8);
  say('也可以是實數、無理數', '2.5、√2');
  await step(tok);                                   // @75.0 they could be negative
  edgeColor(smE(0, 1), C.edge, 1); edgeColor(smE(1, 3), C.edge, 1);
  setW(smE(1, 2), -1); edgeColor(smE(1, 2), C.back, 2);
  say('還可以是負的', 'a → b：−1');
  await step(tok);                                   // @79.0 different classes → different algorithms
  const k1 = tag('圖的種類 ＋ 權重的限制 → 各有適合的演算法', 'say', 0.4, 1.6, -3.9);
  say('不同的圖、不同的權重限制', '各有最適合的演算法');
  await step(tok);                                   // @97.3 no specific algorithms today
  kill(k1);
  const plan = code(['今天：', '① 定義問題', '② 通用的作法', '③ optimal substructure'], 4.8, -3.8, 0.55);
  plan.hl(1);
  say('今天先不講具體演算法', '定義問題、通用結構、optimal substructure');
  await step(tok);                                   // @151.0 borrow a cannon from Caltech to MIT
  plan.hl(-1);
  setW(smE(0, 1), 3); setW(smE(1, 3), 4); setW(smE(1, 2), 1); edgeColor(smE(1, 2), C.edge, 1);
  nodeNote(0, 'Caltech'); nodeNote(3, 'MIT');
  const pk = await walk(tok, '大砲', [0, 1, 3], 700);
  g.mood('happy');
  say('經典動機：從 Caltech 把大砲運到 MIT', '要找最快的路');
  await step(tok);                                   // @178.0 Google Maps from A to B
  kill(pk); nodeNote(0, 'A'); nodeNote(3, 'B');
  smPath([0, 1, 3], C.tree);
  say('Google Maps：從 A 到 B', '權重就用距離');
  await step(tok);                                   // @199.3 graph G = (V, E, W)
  const G = tag('G = (V, E, W)', 'ptr alt', 0, 0.3, 3.9);
  say('整個單元的圖：G = (V, E, W)', 'V 頂點、E 邊、W 權重');
  await step(tok);                                   // @218.3 W maps edges to weights
  smPath([0, 1, 3], C.edge, 1);
  edgeColor(smE(0, 1), C.hot, 2);
  tag('W(s, a) = 3', 'note', -4.4, 0.3, -2.4);
  txt(G, 'W：E → ℝ（每條邊對應一個實數）');
  say('W 是函數：把每條邊對應到一個實數', 'W：E → ℝ');
}]);

// 04:03 Dijkstra vs Bellman-Ford
FRAG.push(['spmit1-two-algos', 'L15：Dijkstra 與 Bellman-Ford', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // @250.3 the simpler algorithm: Dijkstra
  const dj = buddy('Dijkstra', '', '#4b9ee2', -4.6, 0, -1.6, 0.9);
  say('第一個（比較簡單）：Dijkstra', '以 Edsger Dijkstra 命名');
  await step(tok);                                   // @268.3 assumes non-negative weight edges
  tag('條件：權重 ≥ 0', 'ptr', -1.6, 0.3, -2.2);
  say('Dijkstra 假設權重都不是負的', 'non-negative');
  await step(tok);                                   // @280.2 complexity O(V log V + E)
  const t2 = tag('O(V log V + E)', 'ptr alt', -1.6, 0.3, -1.4);
  dj.mood('happy');
  say('複雜度 O(V log V + E)', '');
  await step(tok);                                   // @292.2 practically linear time
  txt(t2, 'O(V log V + E)：幾乎線性');
  say('實際上幾乎是線性時間', '');
  await step(tok);                                   // @304.1 E vs V in a simple graph?
  buildGraph(SM.k4, { dx: 3.4, dz: -0.6, scale: 0.8 });
  const qq = tag('E 最多有多少條？', 'say', 3.4, 1.6, 1.8);
  say('簡單圖裡，E 和 V 有什麼關係？', '');
  await step(tok);                                   // @327.5 E is O(V^2)
  txt(qq, 'E = O(V²)');
  say('E = O(V²)', '');
  await step(tok);                                   // @340.0 complete graph
  GR.edges.forEach((e) => edgeColor(e, C.hot, 1.8));
  txt(qq, '完全圖：4 點、6 條邊 → E = Θ(V²)');
  say('完全圖：每一對頂點之間都有邊', 'E = Θ(V²)');
  await step(tok);                                   // @357.3 simple graph vs multigraph
  GR.edges.forEach((e) => edgeColor(e, C.edge, 1));
  txt(qq, '簡單圖：每對頂點最多一條邊');
  say('簡單圖：每對頂點最多一條邊', 'multigraph（多重邊）這裡不討論');
  await step(tok);                                   // @381.1 dominated by E; linear in edges
  t2.element.className = 'lab-label good';
  say('很多情況由 E 主導', 'Dijkstra 對邊數是線性的');
  await step(tok);                                   // @404.0 Bellman-Ford: positive and negative
  const bf = buddy('Bellman-Ford', '', '#dd8238', -4.6, 0, 1.9, 0.9);
  tag('正、負權重都可以', 'ptr', -1.6, 0.3, 1.4);
  say('Bellman-Ford：正負權重都能處理', '');
  await step(tok);                                   // @416.8 complexity O(VE)
  const t4 = tag('O(VE)', 'ptr alt', -1.6, 0.3, 2.2);
  say('複雜度 O(VE)', '');
  await step(tok);                                   // @426.0 V cubed
  txt(t4, 'O(VE)：E = V² 時是 O(V³)');
  bf.mood('sad');
  say('E 可以到 V²，所以是 O(V³)', '同樣的圖 Dijkstra 只要 O(V log V + E) = O(V²)');
  await step(tok);                                   // @437.0 when you have a chance, use Dijkstra
  dj.mood('happy'); await dj.hop(tok);
  say('有機會就用 Dijkstra', '');
  await step(tok);                                   // @442.2 stuck with negative edges → Bellman-Ford
  bf.mood('calm');
  say('被負權重的邊卡住時', '才用 Bellman-Ford');
  await step(tok);                                   // @451.3 negative weight cycles
  const cyc = tag('負權重 cycle：繞一圈總和 < 0', 'bad', -1.6, 0.3, 3.1);
  bf.mood('wow');
  say('麻煩在於：要找出權重為負的 cycle', '它會打亂最短路徑');
  await step(tok);                                   // @470.9 more edges, but smaller weight
  kill(cyc);
  tag('a → c：2', 'note', 3.4, 0.3, 2.8);
  tag('a → b → c：3 + (−4) = −1', 'note', 3.4, 0.3, 3.6);
  say('有負權重時：多走一步，總權重反而變小', '邊數較多，權重卻較小');
  await step(tok);                                   // @487.4 that's why the complexities differ
  bf.mood('calm');
  say('所以 Bellman-Ford 要多做事', '兩個複雜度才會差這麼多');
}]);

// 08:24 path、w(p) 與指數多條路徑（內建 sp-exp-paths 的跟講版）
FRAG.push(['spmit1-paths', 'L15：path、w(p) 與指數多條路徑', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(SM.path4); hideW();
  await step(tok);                                   // @514.5 a path is a sequence of vertices
  const pk0 = tag('p = v0, v1, v2, v3', 'say', 0, 1.6, 2.6);
  for (let i = 0; i < 4; i++) nodeColor(i, C.pq, 0.3);
  say('path p：一串頂點 v0, v1, …, vk', '');
  await step(tok);                                   // @529.8 each (vi, vi+1) must be in E
  for (let i = 0; i < 4; i++) nodeColor(i, C.white, 0);
  smPath([0, 1, 2, 3], C.hot, 2);
  txt(pk0, '每一段 (vᵢ, vᵢ₊₁) 都要是 E 裡的邊');
  say('相鄰兩點之間一定要有邊', '(vᵢ, vᵢ₊₁) ∈ E');
  await step(tok);                                   // @553.0 w(p), the weight of the path
  hideW(false); smPath([0, 1, 2, 3], C.edge, 1);
  txt(pk0, 'w(p)：這條路徑的權重');
  say('w(p)：路徑的權重', '');
  await step(tok);                                   // @564.8 the sum of the edge weights
  const pk = await walk(tok, '2 + 1 + 3', [0, 1, 2, 3], 500);
  txt(pk, '2 + 1 + 3 = 6');
  txt(pk0, 'w(p) = 路上每條邊的權重加起來');
  say('w(p) = 邊權重的總和', '2 + 1 + 3 = 6');
  await step(tok);                                   // @583.0 find a path p with minimum weight
  kill(pk);
  const alt = addEdge(GR, 0, 3, 7, 0.25); edgeColor(alt, C.back, 1.6);
  smPath([0, 1, 2, 3], C.tree, 2);
  txt(pk0, '最短路徑問題：找 w(p) 最小的 p');
  say('最短路徑問題：找權重最小的 path', '直走 7、繞路 6 → 選 6');
  await step(tok);                                   // @613.3 many, many possible paths
  txt(pk0, '可能的路徑非常多，甚至指數多條');
  say('可能的路徑非常多', '甚至是指數級');
  await step(tok);                                   // @623.0 a simple example with exponential paths
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(GRAPHS.chain); hideW();
  const cl = tag('一個簡單的例子', 'say', 0, 1.6, 3.6);
  say('一個會有指數多條路徑的例子', '');
  await step(tok);                                   // @638.4 directed, all go this way
  GR.edges.forEach((e) => edgeColor(e, C.hot, 1.6));
  txt(cl, '有向圖：箭頭都往右');
  say('所有邊都往同一個方向', '有向圖');
  await step(tok);                                   // @646.3 the path that goes all the way
  GR.edges.forEach((e) => edgeColor(e, C.edge, 1));
  smPath([0, 1, 2, 3, 4, 5, 6], C.tree, 2.2);
  txt(cl, '路徑 ①：沿著鋸齒一路走');
  say('可以沿著鋸齒一路走到底', '');
  await step(tok);                                   // @649.0 the path on top
  smPath([0, 1, 2, 3, 4, 5, 6], C.edge, 1);
  [[0, 2], [2, 4], [4, 6]].forEach(([a, b]) => edgeColor(smE(a, b), C.ok, 2.2));
  txt(cl, '路徑 ②：走直的捷徑');
  say('也可以走直的那幾段', '');
  await step(tok);                                   // @653.0 two choices to this vertex
  [[0, 2], [2, 4], [4, 6]].forEach(([a, b]) => edgeColor(smE(a, b), C.edge, 1));
  nodeColor(2, C.pq, 0.35); nodeTag(2, '2 條');
  txt(cl, '到 v2：2 種走法');
  say('到 v2 有兩種走法', '');
  await step(tok);                                   // @661.0 four ways of getting here
  nodeColor(2, C.white, 0); nodeColor(4, C.pq, 0.35); nodeTag(4, '4 條');
  txt(cl, '到 v4：2 × 2 = 4 種');
  say('每種再接兩種：到 v4 有 4 條', '');
  await step(tok);                                   // @663.2 eight ways… exponential
  nodeColor(4, C.white, 0); nodeColor(6, C.pq, 0.35); nodeTag(6, '8 條');
  txt(cl, '每多一段 ×2 → 指數多條');
  say('到 v6 有 8 條，越長越多', '指數多條路徑');
}]);

// 11:23 複雜度裡沒有權重 W
FRAG.push(['spmit1-weight-range', 'L15：複雜度與權重大小無關', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(GRAPHS.tri, { scale: 0.8, dx: -2.4, dz: -0.6 });
  tag('Dijkstra：O(V log V + E)', 'ptr', 3.4, 0.3, -1.6);
  tag('Bellman-Ford：O(VE)', 'ptr', 3.4, 0.3, -0.8);
  await step(tok);                                   // @683.0 anybody want to point that out?
  const q = tag('這兩個複雜度有什麼特別？', 'say', 3.4, 1.6, 0.4);
  say('看這兩個複雜度，發現什麼？', '');
  await step(tok);                                   // @701.7 it's not a function of weight
  txt(q, '學生：它不是權重的函數！');
  say('它們都不是權重的函數', '');
  await step(tok);                                   // @738.0 W doesn't exist in the complexity
  kill(q);
  const n = tag('式子裡沒有 W', 'good', 3.4, 0.3, 0.2);
  say('複雜度裡沒有 W', '這很重要');
  await step(tok);                                   // @743.0 W could be 2^64
  setW(smE(0, 2), '2⁶⁴'); edgeColor(smE(0, 2), C.hot, 1.8);
  say('W 可以很大，例如 2⁶⁴', '');
  await step(tok);                                   // @750.3 only ~E different values
  const c = tag('邊只有 E 條 → 權重最多 E 種值', 'note', -2.4, 0.3, 2.6);
  say('權重的「種類」最多 E 種', '');
  await step(tok);                                   // @769.5 0.0001 and 10^98
  setW(smE(0, 1), '0.0001'); setW(smE(1, 2), '10⁹⁸');
  [smE(0, 1), smE(1, 2)].forEach((e) => edgeColor(e, C.hot, 1.8));
  txt(c, '範圍卻可以指數大：0.0001 ～ 10⁹⁸');
  say('範圍卻可以指數大', '0.0001 和 10⁹⁸ 同時出現');
  await step(tok);                                   // @783.9 don't depend on the dynamic range
  GR.edges.forEach((e) => edgeColor(e, C.edge, 1));
  txt(n, '好演算法不受權重範圍影響');
  say('Dijkstra、Bellman-Ford 不受權重範圍影響', 'dynamic range（數值範圍）');
  await step(tok);                                   // @799.0 why BFS / DFS aren't directly applicable
  const bfs = buddy('BFS', '', '#9a9a9a', 3.4, 0, 2.4, 0.6);
  say('為什麼 BFS、DFS 不能直接用？', '明天 section 會講');
  await step(tok);                                   // @811.2 the hint: dynamic range of the weights
  const sp = tag('把 2⁶⁴ 拆成 2⁶⁴ 條單位邊？太多了！', 'bad', 3.4, 1.9, 2.4);
  bfs.mood('sad');
  say('提示：權重的範圍', 'BFS 只會數邊數');
  await step(tok);                                   // @817.7 exponential number of paths
  kill(sp); kill(c);
  tag('難處一：指數多條路徑', 'ptr alt', -2.4, 0.3, 2.4);
  say('這問題比排序、搜尋難：', '一、路徑有指數多條');
  await step(tok);                                   // @829.3 dynamic range can be very large
  tag('難處二：權重範圍可以非常大', 'ptr alt', -2.4, 0.3, 3.2);
  say('二、權重的範圍可以非常大', '');
  await step(tok);                                   // @839.0 optimal substructure → VE
  tag('解法：optimal substructure', 'good', -2.4, 0.3, 4.0);
  bfs.mood('calm');
  say('要靠 optimal substructure', '做到接近線性，或 O(VE)');
}]);

// 14:26 δ(u, v) 的定義
FRAG.push(['spmit1-delta-def', 'L15：δ(u, v) 的定義', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(SM.delta);
  const g = guide(-6.0, 3.0);
  const nt = tag('', 'say', 0, 1.6, 4.4); nt.element.style.visibility = 'hidden';
  const sayN = (s) => { nt.element.style.visibility = ''; txt(nt, s); };
  await step(tok);                                   // @866.2 v0 —p→ vk
  smPath([0, 1, 2], C.hot, 2);
  sayN('u ─p→ v：p 是一條從 u 到 v 的路徑');
  say('記號 v₀ ─p→ vₖ', 'p 是從 v₀ 到 vₖ 的一條路徑');
  await step(tok);                                   // @892.5 a single-vertex path, weight 0
  smPath([0, 1, 2], C.edge, 1);
  nodeColor(0, C.pq, 0.35); nodeTag(0, 'w = 0');
  sayN('只有 u 自己：長度 0 的路徑，權重 0');
  say('單一頂點也是路徑：u 到 u', '權重 0');
  await step(tok);                                   // @915.1 what if there isn't a path?
  nodeColor(0, C.white, 0); nodeTag(0, '');
  nodeColor(3, C.dim, 0); nodeTag(3, '？');
  sayN('另一個極端：根本沒有路徑');
  g.mood('wow');
  say('另一個極端：沒有路徑怎麼辦？', 'z 沒有任何邊連進來');
  await step(tok);                                   // @929.7 δ(u, v)
  nodeTag(3, ''); nodeColor(3, C.white, 0); g.mood('calm');
  nodeTag(2, 'δ(u,v) = ?');
  sayN('δ(u, v)：u 到 v 最短路徑的權重');
  say('δ(u, v)：u 到 v 最短路徑的權重', 'δ 讀作 delta');
  await step(tok);                                   // @943.1 also find the path
  sayN('不只要數字，也要知道路怎麼走');
  say('除了權重，也要找出路徑本身', '只知道 14 英里、不知道路也沒用');
  await step(tok);                                   // @966.1 the minimum over all paths
  const p1 = await walk(tok, '7', [0, 2], 650);
  smPath([0, 1, 2], C.tree, 2);
  const p2 = await walk(tok, '2 + 3 = 5', [0, 1, 2], 500);
  nodeTag(2, 'δ = min(7, 5) = 5');
  kill(p1);
  sayN('δ(u, v) = 所有 u→v 路徑 p 的 w(p) 最小值');
  say('δ(u, v) = 所有路徑權重的最小值', 'min(7, 5) = 5');
  await step(tok);                                   // @1000.3 infinity otherwise
  kill(p2);
  nodeColor(3, C.dim, 0); nodeTag(3, 'δ(u,z) = ∞');
  sayN('沒有路徑：δ = ∞（開車到東京）');
  say('沒有路徑時 δ = ∞', '從這裡開車到東京：中間隔著太平洋');
  await step(tok);                                   // @1031.0 from the source: 0, others ∞
  smPath([0, 1, 2], C.edge, 1); nodeColor(3, C.white, 0);
  nodeTag(0, 'd 0'); nodeTag(1, 'd ∞'); nodeTag(2, 'd ∞'); nodeTag(3, 'd ∞');
  await goTo(tok, g, -5.8, 1.8, 600);
  sayN('起點 0，其他一開始都是 ∞');
  say('從起點出發：起點是 0', '還沒找到路，其他都 ∞');
  await step(tok);                                   // @1044.7 reduce the infinities of reachable vertices
  const p3 = await walk(tok, '0 + 2', [0, 1], 500); nodeTag(1, 'd 2'); kill(p3);
  nodeTag(2, 'd 5'); smPath([0, 1, 2], C.tree, 2);
  sayN('走得到的頂點：∞ 一路降下來');
  say('把走得到的頂點從 ∞ 往下降', 'x → 2，v → 5');
  await step(tok);                                   // @1065.2 unreachable stays ∞
  nodeColor(3, C.back, 0.3);
  g.mood('sad');
  sayN('走不到的 z：永遠是 ∞');
  say('走不到的頂點會一直是 ∞', '');
}]);

// 17:56 S、A～F 手動降 d 值（內建 sp-relax-s-af 的跟講版）
FRAG.push(['spmit1-saf', 'L15：S、A～F 手動降 d 值', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const g = guide(-6.2, 3.4);
  await step(tok);                                   // @1076.5 let's look at an example
  const sb = tag('來看一個例子：一步一步把數字降下來', 'say', -6.2, 1.7, 3.4);
  say('看一個例子', '找最短路徑是一個反覆的過程');
  await step(tok);                                   // @1109.9 source vertex, a through f, edges
  kill(sb);
  buildGraph(GRAPHS.l15);
  nodeColor(0, C.ok, 0.3);
  say('起點 S，其他頂點 A～F', '還有一堆有權重的邊');
  await step(tok);                                   // @1151.6 want δ(S, ·) for every vertex
  for (let v = 1; v < 7; v++) nodeTag(v, 'δ(S,' + nm(v) + ')?');
  say('想求 δ(S, A)、δ(S, B)…', 'S 到每個頂點的最短距離');
  await step(tok);                                   // @1170.7 try it like BFS
  for (let v = 1; v < 7; v++) nodeTag(v, '');
  g.mood('wow');
  say('先手動試試，像 BFS 那樣', '沿著邊填數字');
  await step(tok);                                   // @1186.9 prove afterwards: the hard part
  const hp1 = tag('之後還要證明：這真的是最短', 'note', 0.8, 0.3, 4.2);
  say('填完還要證明它們真的最短', '這才是難的部分');
  await step(tok);                                   // @1198.6 d(u) inside the vertices
  kill(hp1); g.mood('calm');
  const d = [0, INF, INF, INF, INF, INF, INF], par = Array(7).fill(-1);
  const R = relaxer(d, par);
  for (let v = 0; v < 7; v++) nodeTag(v, 'd ?');
  say('圈上的數字 d(u)：目前找到的權重', 'current weight');
  await step(tok);                                   // @1214.0 d(S) = 0, the others ∞
  for (let v = 0; v < 7; v++) nodeTag(v, fmt(d[v]));
  say('起點 d(S) = 0', '其他 d 都是 ∞');
  await step(tok);                                   // @1231.2 decrease d until it equals δ
  const goal = tag('目標：d 一路降到 δ，就完成', 'note', 0.8, 0.3, 4.2);
  say('把 d 一路降，直到等於 δ', '全部等於 δ 時演算法結束');
  await step(tok);                                   // @1257.7 seat-of-the-pants: iteratively reduce
  kill(goal);
  say('憑直覺來試：一個一個降', '');
  await step(tok);                                   // @1264.0 from S: mark this as 1
  await R(tok, 0, 1);
  say('從 S 出發，A 可以標 1', '0 + 1 = 1');
  await step(tok);                                   // @1271.9 mark this as 2
  await R(tok, 0, 2);
  say('同樣，B 標 2', '0 + 2 = 2');
  await step(tok);                                   // @1275.4 pick A, look at the edges from A
  R.clear(); nodeColor(1, C.pq, 0.35);
  await goTo(tok, g, -3.6, -3.6, 600);
  say('隨便挑 A，看從 A 出去的邊', '');
  await step(tok);                                   // @1287.7 mark this as 6
  await R(tok, 1, 3);
  say('C 標 1 + 5 = 6', '');
  await step(tok);                                   // @1296.4 from B: mark this as 3
  nodeColor(1, C.white, 0);
  await R(tok, 2, 4);
  say('從 B 出發，D 標 2 + 1 = 3', '');
  await step(tok);                                   // @1302.3 is δ(S, C) really 6? No.
  R.clear(); nodeColor(3, C.hot, 0.4);
  const qc = tag('δ(S, C) = 6？', 'say', 0.8, 1.7, 0);
  g.mood('wow');
  say('δ(S, C) 真的是 6 嗎？', '不是！');
  await step(tok);                                   // @1316.0 a better way? through which vertex?
  txt(qc, '有更好的路嗎？要經過誰？');
  say('有沒有更好的路？', '要經過哪個頂點？');
  await step(tok);                                   // @1329.3 S → B → D → C
  kill(qc); nodeColor(3, C.white, 0);
  const pk = await walk(tok, '2 + 1 + 2', [0, 2, 4, 3], 450);
  say('走 S → B → D → C', '');
  await step(tok);                                   // @1339.1 that gives 5
  kill(pk);
  await R(tok, 4, 3);
  g.mood('happy');
  say('只要 5！比 6 小', 'C 從 6 降成 5');
  await step(tok);                                   // @1343.6 can I do better than 5? No.
  R.clear(); nodeColor(3, C.ok, 0.3);
  say('還能比 5 更好嗎？', '這張圖不行：δ(S, C) = 5');
  await step(tok);                                   // @1348.9 fewest edges ≠ smallest weight
  const tip = tag('邊數最少（S→A→C）≠ 權重最小（S→B→D→C）', 'note', 0.8, 0.3, 4.2);
  say('邊數最少的路，權重不一定最小', '');
  await step(tok);                                   // @1381.0 enumerate implicitly
  g.mood('calm');
  txt(tip, '路徑有指數多條：只能「隱式地」考慮所有走法');
  say('不能一條一條列出所有路徑', '要隱式地考慮所有走法');
  await step(tok);                                   // @1406.3 non-negative here; negative is harder
  txt(tip, '這張圖權重都非負；有負權重會更複雜');
  say('這張圖的權重都不是負的', '有負權重時更複雜');
}]);

// 23:46 predecessor π
FRAG.push(['spmit1-pred', 'L15：predecessor π 與回推路徑', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(GRAPHS.l15, { noDrop: true });
  const d = [0, 1, 2, 6, 3, INF, INF];
  for (let v = 0; v < 7; v++) nodeTag(v, fmt(d[v]));
  [[0, 1], [0, 2], [1, 3], [2, 4]].forEach(([a, b]) => edgeColor(smE(a, b), C.tree, 2));
  const g = guide(-6.2, 3.4);
  await step(tok);                                   // @1426.6 δ is the weight; we want the path itself
  const sb = tag('δ 只是數字；路要怎麼走？', 'say', -6.2, 1.7, 3.4);
  say('δ 只告訴我們權重', '還要能找出路徑本身');
  await step(tok);                                   // @1446.6 the predecessor relationship
  kill(sb);
  for (let v = 0; v < 7; v++) nodeNote(v, 'π ?');
  say('定義 predecessor（前一個頂點）關係', '');
  await step(tok);                                   // @1456.2 d(v) is the value inside the circle
  for (let v = 0; v < 7; v++) nodeTag(v, fmt(d[v]), 'ptr alt');
  say('d(v)：圈上的數字，目前的權重', '');
  await step(tok);                                   // @1472.6 eventually d goes to δ
  for (let v = 0; v < 7; v++) nodeTag(v, fmt(d[v]));
  const nd = tag('d(v) 最後要變成 δ(S, v)', 'note', 0.8, 0.3, 4.2);
  say('d 最後要變成 δ', '');
  await step(tok);                                   // @1490.8 π(v): predecessor on the best path
  [-1, 0, 0, 1, 2, -1, -1].forEach((p, v) => nodeNote(v, p >= 0 ? 'π = ' + nm(p) : ''));
  txt(nd, 'π(v)：到 v 目前最佳路徑上的前一個頂點');
  say('π(v)：目前最佳路徑上，v 的前一個頂點', '');
  await step(tok);                                   // @1506.7 π(S) = NIL
  nodeNote(0, 'π = NIL'); nodeColor(0, C.pq, 0.3);
  say('起點沒有前一個：π(S) = NIL', '');
  await step(tok);                                   // @1521.0 follow the predecessors → current best path
  nodeColor(0, C.white, 0);
  txt(nd, '目前的最佳路徑 = 沿著 π 一路往回走');
  say('沿著 π 往回走，就是目前的最佳路徑', 'π 也會一直被修改');
  await step(tok);                                   // @1534.0 at E: π(E) points to C
  d[5] = 7; nodeTag(5, '7'); nodeNote(5, 'π = C'); edgeColor(smE(3, 5), C.tree, 2);
  nodeColor(5, C.hot, 0.4);
  await goTo(tok, g, 3.0, -3.8, 700);
  const bk = tag('π(E) = C', 'pkt', hp(5).x, 1.0, hp(5).z);
  say('站在 E：π(E) 指向 C', '假設 E 這時是從 C 來的（6 + 1 = 7）');
  await step(tok);                                   // @1550.2 π(C) points to A
  await travel(tok, bk, hp(5), hp(3), 600); txt(bk, 'π(C) = A'); nodeColor(3, C.hot, 0.4);
  say('再看 π(C)：指向 A', '一路往回走…');
  await step(tok);                                   // @1554.0 finally π(E) = A, π(A) = S
  kill(bk); nodeColor(5, C.white, 0); nodeColor(3, C.white, 0);
  edgeColor(smE(3, 5), C.dim, 1);
  d[5] = 3; nodeTag(5, '3'); nodeNote(5, 'π = A');
  smPath([0, 1, 5], C.hot, 2.4);
  g.mood('happy');
  say('最後：π(E) = A、π(A) = S', '最佳路徑 S → A → E（1 + 2 = 3）');
  await step(tok);                                   // @1572.6 two data structures
  smPath([0, 1, 5], C.tree, 2);
  txt(nd, '兩個資料結構：d（目前距離）與 π（前一個）');
  say('d 和 π：兩個要一起反覆更新的資料結構', '');
  await step(tok);                                   // @1584.0 when d = δ you're done; π is correct
  txt(nd, 'd 全部等於 δ → 完成，π 也正確');
  say('d 等於 δ 時就完成', '這時 π 也是正確的');
}]);

// 26:41 為什麼有負權重；能不能平移成非負
FRAG.push(['spmit1-neg-why', 'L15：負權重從哪來？能平移掉嗎？', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(SM.toll);
  const g = guide(-6.0, 3.0);
  await step(tok);                                   // @1603.4 the last complication: negative weights
  edgeColor(smE(1, 2), C.back, 2);
  say('最後一個麻煩：負權重', 'a → t 是 −2');
  await step(tok);                                   // @1627.2 why do these things exist?
  const sb = tag('負的權重？現實中有這種事嗎？', 'say', -6.0, 1.7, 3.0);
  g.mood('wow');
  say('為什麼會有負權重？', '老師要大家舉例');
  await step(tok);                                   // @1682.6 getting paid to drive
  txt(sb, '開這段路反而有錢拿！');
  const pk = await walk(tok, '+ $', [1, 2], 700);
  g.mood('happy');
  say('開車反而有錢拿', '距離不會是負的，但「花費」可以');
  await step(tok);                                   // @1704.4 Monopoly: pay rent or get money
  kill(pk);
  txt(sb, '大富翁：踩到格子要付錢，也可能收錢');
  say('像大富翁：有時付租金，有時拿錢', '');
  await step(tok);                                   // @1782.9 shift the weights to make them all positive?
  kill(sb); g.mood('calm');
  const pq = tag('每條邊都 + 2，全部變成非負？', 'say', 0, 1.6, 4.0);
  setW(smE(0, 1), 5); setW(smE(1, 2), 0); setW(smE(0, 2), 4);
  GR.edges.forEach((e) => edgeColor(e, C.hot, 1.6));
  say('常考：能不能把權重平移成全部非負？', '例如每條邊都加 2');
  await step(tok);                                   // @1803.1 it may not be possible
  GR.edges.forEach((e) => edgeColor(e, C.edge, 1));
  smPath([0, 1, 2], C.dim, 1); edgeColor(smE(0, 2), C.tree, 2.2);
  txt(pq, '原本 s→a→t = 1 最短；加完變 5，輸給 s→t 的 4');
  g.mood('sad');
  say('不一定做得到：最短路徑可能換人', '邊數多的路加得比較多');
  await step(tok);                                   // @1810.0 if you can (and prove it): VE → V log V
  setW(smE(0, 1), 3); setW(smE(1, 2), -2); setW(smE(0, 2), 2);
  GR.edges.forEach((e) => edgeColor(e, C.edge, 1)); edgeColor(smE(1, 2), C.back, 2);
  txt(pq, '若能證明答案不變：O(VE) → O(V log V + E)');
  g.mood('calm');
  say('如果能平移、又能證明答案不變', '就能從 Bellman-Ford 換成 Dijkstra');
  await step(tok);                                   // @1828.2 get rid of negative edges without changing the problem
  txt(pq, '能去掉負邊就去掉，但問題的答案不能變');
  say('盡量去掉負權重的邊', '但不能改變原本的問題');
  await step(tok);                                   // @1852.2 reverse toll: ads
  txt(pq, '倒貼的收費站：一路看廣告，反而賺錢');
  const pk2 = await walk(tok, '看廣告 +$', [1, 2], 700);
  g.mood('happy');
  say('例子：看廣告的「倒貼收費」公路', '');
  await step(tok);                                   // @1874.0 social networks
  kill(pk2);
  txt(pq, '社群網路：喜歡（正）、討厭（負）');
  say('社群網路：喜歡和討厭', '有正有負');
  await step(tok);                                   // @1911.0 a whole lecture on Bellman-Ford
  txt(pq, '不管動機如何：會花一整堂講 Bellman-Ford');
  say('就算不買單這些例子', '也會花一整堂講 Bellman-Ford');
}]);

// 31:58 負權重 cycle（內建 sp-negative-cycle 的跟講版）
FRAG.push(['spmit1-negcyc', 'L15：負權重 cycle', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const g = guide(-6.0, 3.6);
  await step(tok);                                   // @1918.4 negative weight cycles
  const sb = tag('負權重 cycle 是什麼？', 'say', -6.0, 1.7, 3.6);
  say('負權重 cycle：值得花一分鐘', '');
  await step(tok);                                   // @1940.4 an even worse problem
  txt(sb, '比指數多條路徑還糟！');
  g.mood('wow');
  say('比指數多條路徑更糟的問題', '');
  await step(tok);                                   // @1964.6 what if you didn't even terminate?
  txt(sb, '演算法可能根本停不下來');
  say('如果演算法根本不會停呢？', '');
  await step(tok);                                   // @1967.0 a graph with some negative edges
  kill(sb); g.mood('calm');
  buildGraph(GRAPHS.l15neg);
  say('一張圖：有些邊是負的、有些是正的', '');
  await step(tok);                                   // @1985.5 this one is −6
  edgeColor(smE(2, 3), C.back, 2.2);
  say('這條是 −6', '');
  await step(tok);                                   // @1997.4 2, 4, −6, 3, 2, 1, −2
  GR.edges.forEach((e) => edgeColor(e, e.w < 0 ? C.back : C.hot, 1.6));
  say('權重：2、−6、3、2、1、−2…', '老師唸的數字有一個對不上，圖是示意');
  await step(tok);                                   // @2006.3 an annoying negative weight cycle
  GR.edges.forEach((e) => edgeColor(e, C.edge, 1));
  [[2, 3], [3, 4], [4, 2]].forEach(([a, b]) => edgeColor(smE(a, b), C.back, 2.2));
  say('討厭的地方：這裡有一個 cycle', 'B → C → D → B');
  await step(tok);                                   // @2017.6 −6 + 2 = −4
  const pk = await walk(tok, '−6 + 2 = −4', [2, 3, 4], 600);
  say('−6 + 2 = −4', '');
  await step(tok);                                   // @2019.0 −4 + 3 = −1
  await travel(tok, pk, hp(4), hp(2), 600); txt(pk, '−4 + 3 = −1');
  say('−4 + 3 = −1：負權重 cycle', '繞一圈總和小於 0');
  await step(tok);                                   // @2033.0 non-negative weights: bounded below by 0
  kill(pk);
  const nt = tag('權重非負：d 不會低於 0，總會停', 'note', 0, 0.3, 4.3);
  say('權重非負時，d 有下界 0', '降到某處一定會停');
  await step(tok);                                   // @2041.2 a negative cycle → infinite loop
  txt(nt, '有負 cycle：無窮迴圈的配方');
  const lp = await walk(tok, '繞圈中…', [2, 3, 4, 2], 420);
  g.mood('sad');
  say('有負 cycle：程式可能陷入無窮迴圈', '錯的是演算法的停止條件');
  await step(tok);                                   // @2059.3 get to B: δ(S, B) = 4?
  kill(lp); g.mood('calm');
  nodeTag(0, '0'); nodeTag(1, '2'); nodeTag(2, '4');
  smPath([0, 1, 2], C.tree, 2);
  txt(nt, '走到 B：以為 δ(S, B) = 4（2 + 2）');
  say('走到 B：以為 δ(S, B) = 4', '2 + 2 = 4');
  await step(tok);                                   // @2076.6 back to B with 3
  const lp2 = await walk(tok, '4 − 6 + 2 + 3', [2, 3, 4, 2], 380);
  txt(lp2, '= 3'); nodeTag(2, '3');
  txt(nt, '繞一圈回到 B：變成 3');
  say('再繞一圈回到 B：3', '');
  await step(tok);                                   // @2082.3 again 2, and so on
  kill(lp2);
  const lp3 = await walk(tok, '3 − 1', [2, 3, 4, 2], 330);
  txt(lp3, '= 2'); nodeTag(2, '2');
  g.mood('sad');
  txt(nt, '再一圈：2、1、0、…一直降下去');
  say('再一圈：2…一直降下去', '');
  await step(tok);                                   // @2106.7 δ(S, S) = 0
  kill(lp3); g.mood('calm');
  nodeColor(0, C.ok, 0.3); nodeTag(2, '?');
  txt(nt, '不是每個 δ 都沒定義');
  say('不是所有 δ 都沒定義', 'δ(S, S) = 0');
  await step(tok);                                   // @2114.5 δ(S, A) = 2
  nodeColor(1, C.ok, 0.3);
  say('δ(S, A) = 2', '到 A 不會碰到負 cycle');
  await step(tok);                                   // @2134.8 anything in here: −∞
  for (const v of [2, 3, 4, 5]) { nodeColor(v, C.back, 0.3); nodeTag(v, '−∞'); }
  txt(nt, 'cycle 裡、cycle 之後：可以繞無限圈 → −∞');
  say('cycle 裡（和它後面）的頂點', '可以繞任意多圈：δ = −∞');
  await step(tok);                                   // @2152.8 negative weights aren't the hard part
  nodeColor(6, C.ok, 0.3); nodeTag(6, '0'); edgeColor(smE(1, 6), C.tree, 2);
  txt(nt, 'A → F 是 −2，但 δ(S, F) = 0 照樣有定義');
  say('難的不是負邊，是負 cycle', 'A → F 的 −2 只走一次，沒問題');
  await step(tok);                                   // @2174.7 Bellman-Ford: O(VE), finite δ, others −∞
  const bf = buddy('Bellman-Ford', '', '#dd8238', 4.8, 0, 3.8, 0.6);
  txt(nt, 'O(VE) 內結束：有限的 δ 給值，其他標 −∞');
  say('Bellman-Ford：在 O(VE) 內結束', '能算的給 δ，其他標成 −∞');
  await step(tok);                                   // @2232.0 BF must detect negative cycles; Dijkstra doesn't
  bf.mood('wow');
  txt(nt, 'Bellman-Ford 必須偵測負 cycle；Dijkstra 不用');
  say('Bellman-Ford 一定要能偵測負 cycle', 'Dijkstra 不用處理，所以比較簡單');
}]);

// 37:30 通用結構：relaxation（內建 sp-generic-relax 的跟講版）
FRAG.push(['spmit1-generic', 'L15：通用結構——一直挑邊 relax', async (tok) => {
  fresh([0, 12.5, 8], [0.5, 0, -0.3]);
  buildGraph(GRAPHS.l15, { scale: 0.68, dx: 2.6, dz: -0.6 });
  const cd = code(['Initialize：for v ∈ V：', '  d(v) = ∞', '  π(v) = NIL', 'd(s) = 0', 'repeat', '  挑一條邊 (u, v)', '  Relax(u, v, w):', '    if d(v) > d(u) + w(u, v):', '      d(v) = d(u) + w(u, v)', '      π(v) = u', 'until 每條邊 d(v) ≤ d(u) + w(u, v)'], -3.8, -3.2, 0.6);
  const d = Array(7).fill(INF);
  await step(tok);                                   // @2250.7 the general structure
  say('最短路徑演算法的通用結構', '');
  await step(tok);                                   // @2262.1 relaxation (we already did it)
  cd.hl(6);
  say('核心概念：relaxation', '剛剛 C 從 6 變 5 就是');
  await step(tok);                                   // @2297.2 d(v) = ∞
  cd.hl(1); for (let v = 0; v < 7; v++) nodeTag(v, '∞');
  say('初始化：每個 v 的 d(v) = ∞', '');
  await step(tok);                                   // @2300.3 π(v) = NIL
  cd.hl(2); for (let v = 0; v < 7; v++) nodeNote(v, 'π NIL');
  say('π(v) = NIL', '還沒有前一個');
  await step(tok);                                   // @2306.2 d(s) = 0
  cd.hl(3); d[0] = 0; nodeTag(0, '0'); nodeColor(0, C.ok, 0.3);
  say('起點 d(s) = 0', 'single source：一個起點');
  await step(tok);                                   // @2325.2 repeat: select some edge (u, v)
  cd.hl(5); edgeColor(smE(0, 1), C.hot, 1.8);
  say('repeat：挑某一條邊 (u, v)', '這裡挑 S → A');
  await step(tok);                                   // @2328.9 not specifying how
  const how = tag('怎麼挑 → 決定是哪個演算法', 'note', -3.8, 0.3, 4.0);
  say('沒規定怎麼挑', '挑法不同 = 不同的演算法');
  await step(tok);                                   // @2338.6 relax edge (u, v)
  kill(how); cd.hl(6);
  say('對這條邊做 relax', '');
  await step(tok);                                   // @2355.5 if d(v) > d(u) + w(u, v)
  cd.hl(7);
  const pk = await walk(tok, '0 + 1', [0, 1], 600);
  txt(pk, '∞ > 0 + 1 ✓');
  say('如果 d(v) > d(u) + w(u, v)', '代表找到更好的走法');
  await step(tok);                                   // @2373.6 d(v) could be ∞
  txt(pk, 'd(A) = ∞：還沒找到路');
  say('d(v) 可能還是 ∞（還沒找到路）', 'd(u) 有限、邊又存在 → 可以更新');
  await step(tok);                                   // @2393.5 set d(v) = d(u) + w(u, v)
  cd.hl(8); d[1] = 1; nodeTag(1, '1'); edgeColor(smE(0, 1), C.tree, 2); txt(pk, '∞ → 1');
  say('就令 d(v) = d(u) + w(u, v)', 'd(A)：∞ → 1');
  await step(tok);                                   // @2405.7 update the predecessor
  cd.hl(9); nodeNote(1, 'π = S'); kill(pk);
  say('也更新 predecessor：π(v) = u', 'π(A) = S');
  await step(tok);                                   // @2431.0 repeat until all edges satisfy d(v) ≤ d(u) + w
  cd.hl(10);
  say('一直重複，直到每條邊都滿足', 'd(v) ≤ d(u) + w(u, v)');
  await step(tok);                                   // @2456.8 assumption: no negative cycles
  const nc = tag('前提：沒有負 cycle', 'bad', -3.8, 0.3, 4.0);
  say('前提：沒有負權重 cycle', 'Bellman-Ford 要用不同的結構');
  await step(tok);                                   // @2494.7 the 6 → 5 picture
  kill(nc); cd.hl(-1);
  const st = [0, 1, 2, 6, 3, INF, INF], pr = [-1, 0, 0, 1, 2, -1, -1];
  for (let v = 0; v < 7; v++) { d[v] = st[v]; nodeTag(v, fmt(d[v])); nodeNote(v, pr[v] >= 0 ? 'π = ' + nm(pr[v]) : ''); }
  [[0, 2], [1, 3], [2, 4]].forEach(([a, b]) => edgeColor(smE(a, b), C.tree, 2));
  say('用圖來看：剛剛 C 從 6 變 5 那一步', 'D 是 3，C 原本是 6');
  await step(tok);                                   // @2509.4 d(C) = 6 > d(D) + 2
  cd.hl(7); edgeColor(smE(4, 3), C.hot, 1.8);
  const pk2 = await walk(tok, '3 + 2 = 5', [4, 3], 600);
  txt(pk2, '6 > 3 + 2 = 5');
  say('d(C) = 6 > d(D) + 2 = 5', '');
  await step(tok);                                   // @2522.3 5 < 6: relax, 6 → 5
  cd.hl(8); d[3] = 5; nodeTag(3, '5'); edgeColor(smE(4, 3), C.tree, 2); edgeColor(smE(1, 3), C.dim, 1); txt(pk2, '6 → 5');
  say('5 < 6：relax，把 6 改成 5', '');
  await step(tok);                                   // @2529.0 π(C) = D
  cd.hl(9); nodeNote(3, 'π = D'); kill(pk2);
  say('再更新 π(C) = D', '這就是 relaxation');
  await step(tok);                                   // @2544.8 stop when no edge can be relaxed
  cd.hl(10);
  d[5] = 3; d[6] = 6; nodeTag(5, '3'); nodeNote(5, 'π = A'); nodeTag(6, '6'); nodeNote(6, 'π = E');
  edgeColor(smE(1, 5), C.tree, 2); edgeColor(smE(5, 6), C.tree, 2);
  say('什麼時候停？沒有邊能再 relax', '');
  await step(tok);                                   // @2567.0 the check is O(E)
  GR.edges.forEach((e) => edgeColor(e, C.hot, 1.4));
  const ck = tag('檢查一次 = 看過全部 E 條邊', 'note', -3.8, 0.3, 4.0);
  say('檢查停止條件本身就要 O(E)', '要看過每一條邊');
  await step(tok);                                   // @2596.6 brute force: works, but slow
  GR.edges.forEach((e) => edgeColor(e, C.edge, 1));
  txt(ck, '暴力法：會對，但很慢');
  say('這是暴力演算法', '會對，只是很慢');
  await step(tok);                                   // @2623.3 never implement this; do implement relax
  txt(ck, 'relax 要實作；「亂挑邊」不要');
  say('這種演算法你不會想實作', 'relax 要留著，亂挑邊的方式不要');
}]);

// 45:00 壞的 relax 順序（內建 sp-bad-order 的跟講版）
FRAG.push(['spmit1-badorder', 'L15：壞的 relax 順序 → 指數時間', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(GRAPHS.chain);
  const g = guide(-6.2, 3.6);
  const d = Array(7).fill(INF);
  const R = relaxer(d, null);
  const hist = []; let h6 = null;
  const upd6 = () => { hist.push(d[6]); if (!h6) h6 = tag('', 'ptr alt', 3.6, 0.3, 3.6); txt(h6, 'v6：' + hist.join(' → ')); };
  await step(tok);                                   // @2699.8 precisely this example
  say('不想實作暴力法的原因：就是這個例子', '');
  await step(tok);                                   // @2719.8 an exponential number of paths
  nodeTag(2, '2 條'); nodeTag(4, '4 條'); nodeTag(6, '8 條');
  say('它同時點出兩件事', '一、路徑有指數多條');
  await step(tok);                                   // @2730.0 issues with the weights of edges
  for (let v = 0; v < 7; v++) nodeTag(v, '');
  GR.edges.forEach((e) => edgeColor(e, C.hot, 1.6));
  say('二、邊的權重也會出問題', '');
  await step(tok);                                   // @2750.9 4 vs 1 or 2: exponentially related
  GR.edges.forEach((e) => edgeColor(e, e.w === 4 ? C.back : C.edge, e.w === 4 ? 2 : 1));
  say('權重 4、2、1：每段減半', '4 跟 1、2 是「指數」關係');
  await step(tok);                                   // @2759.9 n vertices → range 2^(n/2)
  GR.edges.forEach((e) => edgeColor(e, C.edge, 1));
  const rg = tag('n 個頂點 → 權重範圍約 2^(n/2)', 'note', 0, 0.3, 3.8);
  say('照這個結構延長：n 個頂點', '權重範圍約 2^(n/2)');
  await step(tok);                                   // @2797.3 n = 100 → 2^50
  txt(rg, 'n = 100 → 權重到 2⁵⁰');
  say('n 可以是 100，權重到 2⁵⁰', '');
  await step(tok);                                   // @2808.3 2^50 fits in 64 bits
  txt(rg, '2⁵⁰ 還在 64 位元以內：完全合理的輸入');
  say('2⁵⁰ 電腦存得下（小於 64 位元）', '完全合理的例子');
  await step(tok);                                   // @2848.0 what happens with this example?
  kill(rg); g.mood('wow');
  say('用暴力法跑這個例子會怎樣？', '');
  await step(tok);                                   // @2861.1 this starts with a 0
  d[0] = 0; for (let v = 0; v < 7; v++) nodeTag(v, fmt(d[v]));
  nodeColor(0, C.ok, 0.3); g.mood('calm');
  say('先沿著鏈走：起點 0', '');
  await step(tok);                                   // @2865.2 this is a 4
  await R(tok, 0, 1);
  say('這個是 4', '0 + 4');
  await step(tok);                                   // @2868.4 8, 10, 12, 13, 14
  R.clear();
  for (const [u, v] of [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6]]) { d[v] = d[u] + smE(u, v).w; nodeTag(v, fmt(d[v])); edgeColor(smE(u, v), C.tree, 2); await beat(tok, 260); }
  upd6();
  say('8、10、12、13、14', '第一輪沿著鏈走完');
  await step(tok);                                   // @2890.0 relax this edge: 14 → 13
  await R(tok, 4, 6); upd6();
  say('relax 捷徑 v4 → v6：14 → 13', '12 + 1 = 13');
  await step(tok);                                   // @2907.7 this 12 becomes 10
  await R(tok, 2, 4);
  say('v4 被捷徑更新：12 → 10', '8 + 2 = 10');
  await step(tok);                                   // @2915.3 this 13 becomes 11
  await R(tok, 4, 5);
  say('v5：13 → 11', '10 + 1 = 11');
  await step(tok);                                   // @2935.6 it might go to 12 first
  await R(tok, 5, 6); upd6();
  say('先 relax v5 → v6：13 → 12', '11 + 1 = 12');
  await step(tok);                                   // @2939.0 then 11
  await R(tok, 4, 6); upd6();
  say('再 relax v4 → v6：12 → 11', '10 + 1 = 11');
  await step(tok);                                   // @2947.0 14, 13, 12, 11 with a bad ordering
  R.clear(); nodeColor(6, C.hot, 0.4); g.mood('sad');
  say('最後一個頂點：14、13、12、11…', '壞的挑邊順序，一點一點降');
  await step(tok);                                   // @2956.8 weights ~2^(n/2): exponentially many relaxations
  const ex = tag('權重 ~ 2^(n/2) → relax 次數也 ~ 2^(n/2)', 'bad', 0, 0.3, 4.3);
  say('權重是 2^(n/2) 等級', 'relax 的次數也可能是指數級');
  await step(tok);                                   // @2976.3 relaxations ~ weights → exponential time
  say('relax 次數跟權重大小同一個數量級', '→ 指數時間演算法');
  await step(tok);                                   // @3001.0 an issue with the ordering
  txt(ex, '問題出在挑邊的順序（病態的順序）');
  g.mood('wow');
  say('學生：是挑邊順序的問題', '對！這是病態的順序');
  await step(tok);                                   // @3029.6 next week: select the edges properly
  txt(ex, '下週：怎麼正確地挑邊');
  g.mood('happy');
  say('下週的重點：怎麼正確地挑邊', '');
}]);

// 50:35 optimal substructure 與三角不等式（內建 sp-optimal-substructure 的跟講版）
FRAG.push(['spmit1-optsub', 'L15：optimal substructure 與三角不等式', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const g = guide(-6.2, 3.4);
  await step(tok);                                   // @3035.0 two very simple theorems
  const sb = tag('兩個一行就能證明的定理', 'say', -6.2, 1.7, 3.4);
  say('最後：兩個很簡單的定理', '一行就能證明');
  await step(tok);                                   // @3050.1 subpaths of a shortest path are shortest paths
  kill(sb);
  buildGraph(SM.opt);
  const th = tag('定理一：最短路徑的子路徑，也是最短路徑', 'ptr alt', 0, 0.3, 3.8);
  say('定理一：最短路徑的子路徑也是最短路徑', '');
  await step(tok);                                   // @3061.4 v0, v1, v2 … p01, p12, p23
  [[0, 1], [1, 2], [2, 3]].forEach(([a, b], i) => edgeColor(smE(a, b), [C.hot, C.ok, C.purple][i], 2.2));
  say('v0 → v1 → v2 → v3，每段中間可能還有很多頂點', '三段：p₀₁、p₁₂、p₂₃');
  await step(tok);                                   // @3086.2 if v0 → v3 is a shortest path
  smPath([0, 1, 2, 3], C.tree, 2.2);
  const pk = await walk(tok, '4 + 3 + 2 = 9', [0, 1, 2, 3], 450);
  say('如果整條 v0 → v3 是最短路徑（9）', '');
  await step(tok);                                   // @3102.9 then each of these is a shortest path too
  kill(pk);
  for (let v = 0; v < 4; v++) nodeColor(v, C.ok, 0.2);
  say('那每一段也都是最短路徑', '');
  await step(tok);                                   // @3109.7 a better way from v0 to v1? use it
  const alt = addEdge(GR, 0, 1, 2, 0.45); edgeColor(alt, C.back, 1.8);
  g.mood('wow');
  say('假設 v0 → v1 有更好的走法（2 < 4）', '換上去整條變 7 < 9：原本就不是最短，矛盾');
  await step(tok);                                   // @3123.0 the optimal substructure property
  dropEdge(alt);
  txt(th, 'optimal substructure：最佳解裡面也是最佳解');
  g.mood('happy');
  say('這就叫 optimal substructure 性質', '');
  await step(tok);                                   // @3126.7 the triangle inequality
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(SM.tri3, { noDrop: true });
  const g2 = guide(-6.2, 3.4);
  const tt = tag('定理二：三角不等式', 'ptr alt', 0, 0.3, 3.8);
  say('定理二：三角不等式', '和 optimal substructure 有關');
  await step(tok);                                   // @3141.6 δ(v0, v1) ≤ δ(v0, v2) + δ(v2, v1)
  edgeColor(smE(0, 1), C.tree, 2.2); edgeColor(smE(0, 2), C.hot, 2); edgeColor(smE(2, 1), C.hot, 2);
  txt(tt, 'δ(v0, v1) ≤ δ(v0, v2) + δ(v2, v1)');
  say('δ(v0, v1) ≤ δ(v0, v2) + δ(v2, v1)', '');
  await step(tok);                                   // @3168.3 if this plus this were smaller…
  const pk2 = await walk(tok, '繞 v2 比較短？', [0, 2, 1], 550);
  g2.mood('wow');
  say('如果經過 v2 比較短…', '那「最短」就該經過 v2：矛盾');
  await step(tok);                                   // @3175.5 paths, not edges
  kill(pk2); g2.mood('calm');
  txt(tt, '注意：δ 講的是最短「路徑」，不是單一條邊');
  say('記住：這裡講的是路徑，不是邊', '');
  await step(tok);                                   // @3185.5 these two → (almost) linear time next time
  g2.mood('happy');
  txt(tt, '這兩個性質 → 下堂課變成接近線性時間');
  say('只靠這兩個性質', '下堂課就能做到接近線性時間');
}]);

// ══════════ L16（2E7MmKv0Y24）══════════
// 01:42 複習：d、δ、π 與 relaxation（內建 relax-safe 的跟講版，前半）
FRAG.push(['spmit1-review', 'L16：複習 d、δ、π 與 relax', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const g = guide(-6.0, 3.0);
  const d = [0, INF, INF];
  const R = relaxer(d, null);
  await step(tok);                                   // @102.1 a trivial example
  buildGraph(GRAPHS.tri); hideW();
  say('複習：一個很簡單的圖', '');
  await step(tok);                                   // @109.9 numbers inside vertices: priority values
  for (let v = 0; v < 3; v++) nodeTag(v, '?');
  say('頂點上的數字：priority 值', '');
  await step(tok);                                   // @118.0 d(v): length of the current shortest path
  const nt = tag('d(v)：目前找到的 s → v 最短路徑長度', 'note', 0, 0.3, 3.8);
  say('d(v)：目前從 s 到 v 的最短路徑長度', 'current');
  await step(tok);                                   // @142.0 d(s) = 0
  nodeTag(0, '0'); nodeColor(0, C.ok, 0.3);
  say('d(s) = 0', '起點到自己是 0');
  await step(tok);                                   // @146.5 the others initialized to ∞
  nodeTag(1, '∞'); nodeTag(2, '∞');
  say('其他初始化成 ∞', '');
  await step(tok);                                   // @149.9 relaxation reduces d down to δ
  txt(nt, 'relaxation：把 d 一路降到 δ（真正的最短長度）');
  say('relaxation：不斷把 d 往下降', '降到 δ：最短路徑的長度');
  await step(tok);                                   // @174.6 may or may not be unique
  txt(nt, '最短路徑可能不只一條，但 δ（最小值）只有一個');
  say('最短路徑可能不唯一', '但要的是最小值');
  await step(tok);                                   // @182.2 all converge → done
  txt(nt, '所有頂點的 d 都收斂到 δ → 演算法結束');
  say('全部 d 都收斂到 δ', '演算法就結束');
  await step(tok);                                   // @194.0 the predecessor, to reconstruct the path
  txt(nt, '要重建路徑：還需要 predecessor');
  say('還有一件重要的事：predecessor', '用來重建路徑');
  await step(tok);                                   // @202.5 π(v)
  nodeNote(0, 'π NIL'); nodeNote(1, 'π ?'); nodeNote(2, 'π ?');
  txt(nt, 'π(v)：最短路徑上 v 的前一個頂點');
  say('π(v)：s 到 v 最短路徑上，v 的前一個', '');
  await step(tok);                                   // @216.6 follow the predecessor chain
  txt(nt, '收斂後，沿 π 一路往回走就是最短路徑');
  say('收斂之後，沿著 π 鏈往回走', '就能重建路徑');
  await step(tok);                                   // @244.4 put on a few weights
  hideW(false); GR.edges.forEach((e) => edgeColor(e, C.hot, 1.6));
  txt(nt, '放上權重：s→a 1、s→b 3、a→b 1');
  say('放上幾個權重', '');
  await step(tok);                                   // @261.8 follow this edge, update d(a): ∞ → 1
  GR.edges.forEach((e) => edgeColor(e, C.edge, 1));
  await R(tok, 0, 1); nodeNote(1, 'π = s');
  say('relax：沿著 s → a，更新 d(a)', '∞ → 0 + 1 = 1');
  await step(tok);                                   // @273.4 this infinity becomes 3
  await R(tok, 0, 2); nodeNote(2, 'π = s');
  say('同樣 b：∞ → 3', '');
  await step(tok);                                   // @285.8 found the shortest path to A
  R.clear(); nodeColor(1, C.ok, 0.3);
  say('這時已找到到 a 的最短路徑', '');
  await step(tok);                                   // @292.2 there's a path of length 2 to B
  nodeColor(2, C.hot, 0.4);
  const q = tag('b 目前 3，其實有長度 2 的路', 'say', 3.6, 1.7, 0.6);
  g.mood('wow');
  say('但到 b 其實有長度 2 的路', '目前 d(b) 還是 3');
  await step(tok);                                   // @306.0 go like so → 2; done
  kill(q);
  await R(tok, 1, 2); nodeNote(2, 'π = a'); nodeColor(2, C.ok, 0.3);
  g.mood('happy');
  say('走 s → a → b：3 → 2', '這樣就完成了');
  await step(tok);                                   // @315.6 prove convergence, termination, complexity
  R.clear(); g.mood('calm');
  txt(nt, '每個演算法都要證明：收斂到 δ、會停；再算複雜度');
  say('任何演算法都要證明：收斂到 δ、會停', '還要算複雜度');
  await step(tok);                                   // @331.0 two algorithms today: DAGs, non-negative edges
  txt(nt, '今天兩個特例：DAG、沒有負邊（Dijkstra）');
  say('今天兩個演算法（都是特例）', 'DAG、權重非負');
}]);

// 05:49 relaxation 是安全的（內建 relax-safe 的跟講版，後半）
FRAG.push(['spmit1-safe', 'L16：relaxation 是安全的', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(GRAPHS.tri, { scale: 0.7, dx: -2.6, dz: -1.0, noDrop: true });
  const g = guide(-6.2, 3.6);
  const d = [0, INF, INF], dl = [0, 1, 2];
  for (let v = 0; v < 3; v++) nodeTag(v, fmt(d[v]));
  // 每個頂點一根柱子：高度 = d；綠色薄板 = δ（柱子只能往下降到板子）
  const H = (x) => (x === INF ? 3.0 : 0.25 + x * 0.8);
  const bars = [], vt = [];
  for (let v = 0; v < 3; v++) {
    const x = 2.2 + v * 1.6;
    bars.push(cube('', '#e6c36a', [0.7, 1, 0.7], x, 0, 0.6));
    cube('', '#2fc092', [1.0, 0.06, 1.0], x, H(dl[v]), 0.6);
    tag(nm(v), 'idx', x, 0.05, 1.6);
    vt.push(tag('', 'ptr', x, 0, 0.6));
  }
  const cur = [0, INF, INF];
  const setBar = (v, x) => { const h = H(x); bars[v].scale.y = h; bars[v].position.y = h / 2; vt[v].position.y = h + 0.4; txt(vt[v], 'd ' + fmt(x)); };
  [0, 1, 2].forEach((v) => setBar(v, cur[v]));
  const lower = async (v) => { const a = cur[v], b = d[v], top = a === INF ? 3.75 : a; await kanim(tok, 700, (t) => { const h = H(top + (b - top) * t); bars[v].scale.y = h; bars[v].position.y = h / 2; vt[v].position.y = h + 0.4; }); setBar(v, b); cur[v] = b; };
  const R = relaxer(d, null);
  const nt = tag('柱子 = d；綠色薄板 = δ（真正最短）', 'note', 3.8, 0.3, 2.4);
  let cd = null;
  await step(tok);                                   // @349.5 relaxation is useful and safe
  say('relaxation 有用，而且「安全」', '');
  await step(tok);                                   // @383.6 if d(v) > d(u) + w(u, v)
  cd = code(['Relax(u, v, w):', '  if d(v) > d(u) + w(u, v):', '    d(v) = d(u) + w(u, v)', '    π(v) = u'], -3.4, 1.6, 0.55);
  cd.hl(1);
  say('Relax：如果 d(v) > d(u) + w(u, v)', '');
  await step(tok);                                   // @392.1 update d(v) = d(u) + w(u, v)
  cd.hl(2);
  await R(tok, 0, 1); await lower(1);
  say('就把 d(v) 改成 d(u) + w(u, v)', 'd(a)：∞ → 1');
  await step(tok);                                   // @400.0 a better way through u; also π
  cd.hl(3); nodeNote(1, 'π = s'); R.clear();
  say('找到經過 u 的更短走法', 'priority 和 predecessor 都要更新');
  await step(tok);                                   // @419.8 show that relaxation is safe
  cd.hl(-1);
  txt(nt, '安全 = relax 永遠不會做錯事');
  say('要證明 relaxation 是安全的', '');
  await step(tok);                                   // @432.5 never get a value less than δ
  txt(nt, '絕不能 relax 出比 δ 還小的值');
  g.mood('wow');
  say('永遠不會得到比 δ(s, v) 還小的值', '');
  await step(tok);                                   // @443.2 converge from the top
  await R(tok, 0, 2); await lower(2);
  txt(nt, '從上面收斂：∞ → … → δ');
  g.mood('calm');
  say('從上面收斂：從 ∞ 一路往下降', 'd(b)：∞ → 3');
  await step(tok);                                   // @459.0 don't go any further
  await R(tok, 1, 2); await lower(2);
  glow(bars[2], GOLD);
  txt(nt, '降到 δ 就停；絕不穿過綠色薄板');
  say('降到 δ 就好，不能再往下', 'd(b)：3 → 2 = δ');
  await step(tok);                                   // @476.7 a lemma by induction, any order
  R.clear(); glow(bars[2], null);
  txt(nt, '引理（歸納法）：不論 relax 的順序');
  say('引理：用歸納法證明', '不管用什麼順序 relax 都成立');
  await step(tok);                                   // @516.5 invariant d(v) ≥ δ(s, v) for all v
  bars.forEach((b) => b.material.color.set('#9fdcc4'));
  txt(nt, '不變量：所有 v 都有 d(v) ≥ δ(s, v)');
  say('relaxation 維持不變量：d(v) ≥ δ(s, v)', '對所有頂點都成立');
  await step(tok);                                   // @549.6 pick an edge, relax it, pick another
  txt(nt, '通用結構：挑邊 → relax → 再挑邊…');
  say('上週的通用結構：挑一條邊 relax', '再挑一條、再 relax');
  await step(tok);                                   // @565.2 never less in the middle; eventually terminate
  txt(nt, '中途也不會出現比最短還小的值');
  g.mood('happy');
  say('中途絕不會出現比 δ 小的值', '跑夠久就會停');
}]);

// 09:56 引理的證明：歸納 + 三角不等式
FRAG.push(['spmit1-relax-lemma', 'L16：證明 relax 永遠 d(v) ≥ δ(s, v)', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(SM.tri, { dz: -1.2 }); hideW();
  const g = guide(-6.2, 3.6);
  const row = (s, z, cls) => tag(s, cls || 'ptr', 0, 0.3, z);
  await step(tok);                                   // @596.2 by induction on the number of steps
  const hd = tag('證明方法：對 relax 的步數做歸納', 'say', 0, 1.6, 2.2);
  say('證明：對步數做歸納', '');
  await step(tok);                                   // @605.0 assume d(u) ≥ δ(s, u)
  kill(hd);
  nodeTag(1, 'd(u) ≥ δ(s,u)', 'ptr alt');
  say('假設 relax 之前 d(u) ≥ δ(s, u)', '');
  await step(tok);                                   // @618.5 do the relaxation operation
  showW(smE(1, 2)); edgeColor(smE(1, 2), C.hot, 2);
  say('現在 relax 邊 (u, v)', '');
  await step(tok);                                   // @636.8 relax doesn't make d(v) incorrect
  nodeTag(2, 'd(v) ≥ δ(s,v)？');
  say('要證明：relax 不會讓 d(v) 變錯', '這是歸納的那一步');
  await step(tok);                                   // @650.5 the triangle inequality
  row('δ(s,v) ≤ δ(s,u) + δ(u,v)', 2.2);
  say('三角不等式：δ(s,v) ≤ δ(s,u) + δ(u,v)', '');
  await step(tok);                                   // @677.7 a picture: s, u, v
  hideW(false); setW(smE(1, 2), 'δ(u,v)');
  GR.edges.forEach((e) => edgeColor(e, C.edge, 1));
  say('畫出來：s、u、v', '');
  await step(tok);                                   // @695.4 not an edge — a path
  GR.edges.forEach((e) => edgeColor(e, C.tree, 2.4));
  say('注意：這些不是邊，是路徑', '可能剛好只是一條邊');
  await step(tok);                                   // @710.8 s→u→v shorter than the best s→v: contradiction
  const pk = await walk(tok, '繞 u 更短？', [0, 1, 2], 550);
  g.mood('wow');
  say('如果 s → u → v 比最短的 s → v 還短', '那就矛盾了');
  await step(tok);                                   // @746.6 by definition: direct, or through u
  kill(pk); g.mood('calm');
  say('最短的 s → v 本來就考慮了所有走法', '直接走、或經過 u');
  await step(tok);                                   // @759.0 s → a → b shorter than s → b
  setW(smE(0, 1), 1); setW(smE(1, 2), 1); setW(smE(0, 2), 3);
  GR.edges.forEach((e) => edgeColor(e, C.edge, 1)); smPath([0, 1, 2], C.hot, 2);
  nodeNote(1, 'u = a'); nodeNote(2, 'v = b'); nodeTag(1, ''); nodeTag(2, '');
  say('例子：s → a → b 比 s → b 這條邊還短', '1 + 1 = 2 < 3');
  await step(tok);                                   // @777.8 no contradiction: δ(s, b) = 2
  nodeTag(2, 'δ(s,b) = 2');
  say('不矛盾：δ(s, b) = 2', '最短的路本來就經過 a');
  await step(tok);                                   // @801.0 shortest paths, not single edge weights
  const tn = tag('三角不等式講最短路徑，不是單一條邊的權重', 'note', 0, 0.3, 4.4);
  say('別被搞混：講的是最短路徑', '不是單一條邊的權重');
  await step(tok);                                   // @817.5 half the proof
  kill(tn);
  setW(smE(0, 1), 'δ(s,u)'); setW(smE(1, 2), 'δ(u,v)'); setW(smE(0, 2), 'δ(s,v)');
  GR.edges.forEach((e) => edgeColor(e, C.tree, 2.4));
  nodeNote(1, ''); nodeNote(2, ''); nodeTag(1, 'd(u) ≥ δ(s,u)', 'ptr alt'); nodeTag(2, '');
  say('這樣證了一半', '剩下的請同學接下去');
  await step(tok);                                   // @889.7 put d(u) here
  row('≤ d(u) + δ(u,v)', 3.0);
  nodeColor(1, C.pq, 0.3);
  say('學生：把 δ(s, u) 換成 d(u)', '右邊只會變大或不變');
  await step(tok);                                   // @904.1 because d(u) ≥ δ(s, u)
  nodeColor(1, C.white, 0);
  say('因為歸納假設 d(u) ≥ δ(s, u)', '');
  await step(tok);                                   // @923.8 replace δ(u, v) with w(u, v)
  row('≤ d(u) + w(u,v)', 3.8);
  setW(smE(1, 2), 'w(u,v)'); edgeColor(smE(1, 2), C.hot, 2.4);
  say('學生：把 δ(u, v) 換成 w(u, v)', '');
  await step(tok);                                   // @980.3 a single edge is never shorter than the shortest path
  say('單一條邊的權重 ≥ 最短路徑', '例子裡 3 ≥ 2');
  await step(tok);                                   // @1005.6 that is d(v) after the relaxation
  row('= relax 之後的 d(v)', 4.6, 'ptr alt');
  nodeTag(2, 'd(v) ≥ δ(s,v) ✓', 'ptr alt'); nodeColor(2, C.ok, 0.3);
  g.mood('happy');
  say('右邊正好是 relax 之後的 d(v)', '所以 d(v) ≥ δ(s, v)，證畢');
  await step(tok);                                   // @1029.3 relaxation is safe; algorithms = sequences of relaxations
  say('relaxation 是安全的', '之後每個演算法 = 某種順序的 relax');
}]);

// 17:40 DAG 最短路徑：topological sort + 一次 relax
FRAG.push(['spmit1-dag-idea', 'L16：DAG 最短路徑的作法', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(SM.dagL, { dz: -2.2 });
  const g = guide(-6.2, 3.6);
  await step(tok);                                   // @1060.8 DAGs first
  const tg = tag('DAG = directed acyclic graph（有向、沒有 cycle）', 'say', 0, 1.6, 0.4);
  say('先看 DAG', 'directed acyclic graph');
  await step(tok);                                   // @1078.3 no cycles → no negative cycles
  const back = addEdge(GR, 2, 0, null, -0.35); edgeColor(back, C.back, 1.6);
  txt(tg, '加一條 S → A 就有 cycle：DAG 不准！');
  say('沒有 cycle，自然沒有負 cycle', '');
  await step(tok);                                   // @1098.3 DAGs with negative edges are allowed
  dropEdge(back);
  setW(smE(0, 2), -2); edgeColor(smE(0, 2), C.back, 2);
  txt(tg, 'DAG 可以有負權重的邊');
  say('這裡允許負權重的邊', '');
  await step(tok);                                   // @1107.0 a negative edge used once: just subtract
  const pk = await walk(tok, '−2', [0, 2], 700);
  say('負邊只走一次：照減就好', '沒問題');
  await step(tok);                                   // @1116.0 only a negative cycle → −∞
  kill(pk);
  txt(tg, '問題只出在能一直繞的負 cycle（→ −∞）');
  say('只有能一直繞的負 cycle', '才會讓最短路徑變 −∞');
  await step(tok);                                   // @1129.5 with a DAG: first try a topological sort
  txt(tg, '遇到 DAG：先試 topological sort！');
  g.mood('happy');
  say('遇到 DAG，第一件事：試 topological sort', '作業也一樣');
  await step(tok);                                   // @1152.0 topological sort: path u → v ⇒ u before v
  kill(tg); g.mood('calm');
  const cd = code(['1. topological sort（DFS，O(V + E)）', '   u → v 有路徑 ⇒ u 排在 v 前面', '2. 由左到右走一遍', '   relax 這個頂點的每條出邊', '總共 O(V + E)'], -2.0, 0.9, 0.6);
  cd.hl(0);
  say('第一步：topological sort', 'u 到 v 有路徑 ⇒ u 排在 v 前面');
  await step(tok);                                   // @1177.9 a linear ordering; go left to right
  cd.hl(1);
  const ar = arrow(V3(-4.6, 0.3, -3.4), V3(2.2, 0.3, -3.4), 0x2f7fd0);
  say('排好之後是一條直線', '由左到右，依序 relax');
  await step(tok);                                   // @1195.0 one pass, relax each edge leaving the vertex
  cd.hl(3);
  for (let v = 0; v < 3; v++) { nodeColor(v, C.hot, 0.35); await beat(tok, 380); nodeColor(v, C.white, 0); }
  say('第二步：由左到右走一遍', 'relax 每個頂點的出邊');
  await step(tok);                                   // @1232.9 topological sort O(V + E); each edge once
  cd.hl(0);
  say('topological sort 是 O(V + E)（含 DFS）', '每條邊只碰一次');
  await step(tok);                                   // @1245.9 the first special case: O(V + E)
  cd.hl(4);
  say('第一個特例演算法：O(V + E)', '');
  await step(tok);                                   // @1256.9 why does it work? the starting vertex
  cd.hl(-1); kill(ar);
  say('為什麼可行？有個細節：', '跟起點在哪裡有關');
  await step(tok);                                   // @1280.3 a DAG like this; mark S
  setW(smE(0, 2), 4); GR.edges.forEach((e) => edgeColor(e, C.edge, 1));
  nodeColor(2, C.ok, 0.3); nodeTag(2, '0');
  say('例如這個 DAG，起點標成 S', '');
  await step(tok);                                   // @1286.6 paths from S to A, B don't exist
  nodeTag(0, '∞'); nodeTag(1, '∞'); nodeColor(0, C.dim, 0); nodeColor(1, C.dim, 0);
  g.mood('wow');
  say('S 到 A、B 的路徑不存在', 'δ(S, A) = δ(S, B) = ∞');
  await step(tok);                                   // @1306.0 general: any choice of starting vertex
  g.mood('calm');
  say('演算法沒有限定起點', '任何起點都要能用');
  await step(tok);                                   // @1315.2 topological sort first, then commit to the start
  tag('先排好，再決定起點；起點左邊全部 ∞', 'note', 0, 0.3, 4.0);
  g.mood('happy');
  say('可以先 topological sort', '再決定起點；只算走得到的');
}]);

// 22:16 白板的 DAG：5, 3, 2, 6, 7, 4, 2, −1, −2（後來補一條 1）（內建 dag-sp 的跟講版）
FRAG.push(['spmit1-dagrun', 'L16：DAG 例子逐步 relax', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const g = guide(-6.2, 3.6);
  const d = Array(6).fill(INF);
  const R = relaxer(d, null);
  await step(tok);                                   // @1336.0 a DAG like this
  buildGraph(SM.dagv); hideW();
  say('來看一個 DAG', '');
  await step(tok);                                   // @1343.7 topologically sorted → drawn in a line
  const ar = arrow(V3(-5.5, 0.3, 2.6), V3(5.5, 0.3, 2.6), 0x2f7fd0);
  const tl = tag('topological 順序：由左到右', 'idx', 0, 0.3, 3.1);
  say('topological sort 之後', 'DAG 一定能畫成一直線');
  await step(tok);                                   // @1372.0 5, 3, 2, 6, 7, 4, 2, −1, −2
  hideW(false); showW(smE(3, 5), false);
  say('權重：5, 3, 2, 6, 7, 4, 2, −1, −2', '');
  await step(tok);                                   // @1387.5 in topological order; go left to right
  say('已經依 topological 順序畫好', '由左到右處理');
  await step(tok);                                   // @1394.2 step two: what's my source?
  kill(tl); kill(ar);
  const q = tag('起點是誰？', 'say', -6.2, 1.7, 3.6);
  say('到第二步：起點是哪一個？', '');
  await step(tok);                                   // @1403.4 if this were the source: nothing to do
  nodeColor(5, C.purple, 0.3);
  txt(q, '如果起點是最右邊的 d…');
  nodeTag(5, '0'); for (let v = 0; v < 5; v++) nodeTag(v, '∞');
  say('如果起點是最右邊這個', '沒有出邊，什麼都不用做；左邊全部 ∞');
  await step(tok);                                   // @1426.0 this is the starting vertex
  nodeColor(5, C.white, 0); for (let v = 0; v < 6; v++) nodeTag(v, '');
  nodeColor(1, C.ok, 0.3);
  txt(q, '起點：S（第二個頂點）');
  say('起點選第二個：S', '粗體標起來');
  await step(tok);                                   // @1436.9 everything to the left gets ∞
  nodeTag(0, '∞'); nodeColor(0, C.dim, 0);
  say('起點左邊的全部是 ∞', '永遠走不到');
  await step(tok);                                   // @1446.9 not the shortest instantly; negative edges
  kill(q);
  const nt = tag('走到某頂點時，不一定已是最短（負邊會讓長路更短）', 'note', 0, 0.3, 4.1);
  say('走到一個頂點時，不一定馬上最短', '有負邊時，更長的路可能更短');
  await step(tok);                                   // @1470.5 relax the edges from S; all ∞ to start
  d[1] = 0; for (let v = 0; v < 6; v++) nodeTag(v, fmt(d[v]));
  nodeColor(1, C.hot, 0.45);
  await goTo(tok, g, -3.3, 1.8, 700);
  txt(nt, '處理 S：relax 它的出邊');
  say('從 S 開始，relax 它的出邊', 'S = 0，其他一開始都 ∞');
  await step(tok);                                   // @1484.2 this becomes 2
  await R(tok, 1, 2);
  say('這個變成 2', '0 + 2');
  await step(tok);                                   // @1491.1 this becomes 6
  await R(tok, 1, 3);
  say('這個變成 6', '0 + 6');
  await step(tok);                                   // @1494.3 done with S: 2 and 6
  R.clear(); nodeColor(1, C.ok, 0);
  say('S 處理完：2 和 6', '');
  await step(tok);                                   // @1502.1 the next vertex: call it a
  nodeColor(2, C.hot, 0.45);
  await goTo(tok, g, -1.1, 1.8, 600);
  txt(nt, '處理 a：relax 它的出邊');
  say('下一個頂點，叫它 a', 'relax a 的出邊');
  await step(tok);                                   // @1509.8 2 + 7 = 9 > 6
  await R(tok, 2, 3);
  say('2 + 7 = 9 > 6', '不用更新');
  await step(tok);                                   // @1519.0 2 + 4 = 6
  await R(tok, 2, 4);
  say('2 + 4 = 6 < ∞', '');
  await step(tok);                                   // @1523.8 2 + 2 = 4
  await R(tok, 2, 5);
  say('2 + 2 = 4', '');
  await step(tok);                                   // @1532.0 done with a; b is 6
  R.clear(); nodeColor(2, C.ok, 0); nodeColor(3, C.hot, 0.45);
  await goTo(tok, g, 1.1, 1.8, 600);
  txt(nt, '處理 b：relax 它的出邊');
  say('a 處理完。下一個是 b', 'd(b) = 6');
  await step(tok);                                   // @1538.9 6 − 1 = 5 < 6
  await R(tok, 3, 4);
  say('6 − 1 = 5 < 6', '更新成 5');
  await step(tok);                                   // @1547.0 oh, this is a 1: 6 + 1 = 7 > 4
  showW(smE(3, 5));
  await R(tok, 3, 5);
  say('喔，這條是 1：6 + 1 = 7 > 4', '不用動');
  await step(tok);                                   // @1558.8 the final value 3 for this one
  R.clear(); nodeColor(3, C.ok, 0); nodeColor(4, C.hot, 0.45);
  await R(tok, 4, 5);
  say('接著 5 − 2 = 3', '最右邊的最終值是 3');
  await step(tok);                                   // @1565.5 final values 5, 6, 2, 0, ∞
  R.clear(); nodeColor(4, C.ok, 0); nodeColor(5, C.ok, 0);
  txt(nt, '最終：∞、0、2、6、5、3');
  g.mood('happy');
  say('最終值：∞、0、2、6、5、3', '');
  await step(tok);                                   // @1580.3 topological sort, find the start, run to the right
  txt(nt, 'topological sort → 找起點 → 一路往右 relax');
  say('作法：topological sort、找起點', '一路往右');
  await step(tok);                                   // @1586.7 the simplest example of dynamic programming
  txt(nt, '其實是 dynamic programming 最簡單的例子');
  say('這是 dynamic programming 最簡單的例子', '11 月會詳細講');
  await step(tok);                                   // @1596.4 O(V + E) because there are no cycles
  txt(nt, '最簡單的特例：O(V + E)，因為沒有 cycle');
  say('最簡單的特例：O(V + E)', '原因：沒有 cycle');
  await step(tok);                                   // @1633.6 Dijkstra doesn't work for negative edges
  const dj = buddy('Dijkstra', '', '#4b9ee2', 4.6, 0, -3.4, 0.6);
  txt(nt, 'Dijkstra 不能有負邊 → 這個演算法沒被 Dijkstra 取代');
  say('Dijkstra 不能處理負邊', '所以 DAG 演算法沒有被 Dijkstra 包含');
  await step(tok);                                   // @1645.0 Dijkstra: cycles, ≥ 0; DAG: negatives, no cycles
  dj.mood('happy');
  txt(nt, 'Dijkstra：可有 cycle、權重 ≥ 0｜DAG：可有負邊、不能有 cycle');
  say('兩者各有用處', 'Dijkstra 可有 cycle；DAG 演算法可有負邊');
}]);

// 27:46 掛球示範（內建 dij-ball-demo 的跟講版）
FRAG.push(['spmit1-balls', 'L16：掛球示範——提起起點', async (tok) => {
  fresh([0, 4.2, 14], [0, 3.2, 0]);
  // 繩長：G–P 7、P–B 5、G–Y 19 出自影片；B–Y 4、Y–R 6、B–R 13 為示意
  const names = ['G', 'P', 'B', 'Y', 'R'], cols = ['#2fc092', '#9b7ef4', '#4b9ee2', '#e8c22a', '#d64545'];
  const xs = [-4.8, -2.4, 0, 2.4, 4.8];
  const ropes = [[0, 1, 7], [1, 2, 5], [0, 3, 19], [2, 3, 4], [3, 4, 6], [2, 4, 13]];
  const SC = 0.27;
  let balls = [], lines = [], dl = [], rl = [];
  const draw = (tight) => {
    lines.forEach((l) => lab.world.remove(l)); lines = [];
    for (const [a, b, len] of ropes) {
      const A = balls[a].position, B = balls[b].position;
      const isT = tight ? tight(a, b, len) : false;
      const gap = A.distanceTo(B), sag = Math.max(0, len * SC - gap) * 0.45;
      const mid = A.clone().add(B).multiplyScalar(0.5); mid.y -= sag;
      const curve = new THREE.QuadraticBezierCurve3(A.clone(), mid, B.clone());
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(16)), new THREE.LineBasicMaterial({ color: isT ? '#2f7fd0' : '#a8987c' }));
      lab.world.add(l); lines.push(l);
    }
    balls.forEach((b, i) => { dl[i].position.set(b.position.x, b.position.y + 0.9, 0); });
  };
  const lift = async (dist, ms) => {
    const top = 6.6;
    rl.forEach((l) => { l.element.style.visibility = 'hidden'; });
    await kanim(tok, ms, (t) => {
      const h = 0.42 + (top - 0.42) * t;
      balls.forEach((b, i) => { b.position.y = Math.max(0.42, h - dist[i] * SC); });
      draw((a, b, len) => Math.abs(Math.abs(dist[a] - dist[b]) - len) < 1e-9 && balls[a].position.y > 0.43 && balls[b].position.y > 0.43);
    });
  };
  const g = guide(-5.8, 3.4, '小路', '#f4a56a', 0.7);
  await step(tok);                                   // @1666.1 I have a demo
  const sb = tag('6.006 唯一的示範！', 'say', -5.8, 1.9, 3.4);
  say('看 Dijkstra 之前：一個示範', '6.006 唯一的一個');
  await step(tok);                                   // @1677.3 straightforward to code; not trivial to prove
  txt(sb, '程式很直接，正確性不好證');
  say('Dijkstra 寫起來很直接', '但證明正確不簡單');
  await step(tok);                                   // @1691.9 a greedy algorithm
  txt(sb, '因為它是 greedy（貪心）');
  g.mood('happy');
  say('原因：它是 greedy algorithm', '每一步都挑眼前最好的');
  await step(tok);                                   // @1697.2 incrementally, vertex by vertex
  txt(sb, '一個頂點、一個頂點建出最短路徑');
  say('一步一步、一個頂點一個頂點', '建出最短路徑');
  await step(tok);                                   // @1708.0 the demo gives intuition
  kill(sb); g.mood('calm');
  say('這個示範能給你直覺', '為什麼 Dijkstra 會對');
  await step(tok);                                   // @1731.0 an undirected graph: balls are the vertices
  balls = names.map((n2, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), new THREE.MeshStandardMaterial({ color: cols[i], roughness: 0.4 }));
    m.castShadow = true; m.add(lab.label(n2, 'val')); m.position.set(xs[i], 0.42, 0); lab.world.add(m); return m;
  });
  dl = names.map(() => tag('', 'ptr', 0, 0, 0));
  balls.forEach((b, i) => { dl[i].position.set(b.position.x, b.position.y + 0.9, 0); });
  say('無向圖：每顆球是一個頂點', '');
  await step(tok);                                   // @1743.0 G = green, Y = yellow
  balls.forEach((b, i) => txt(dl[i], ['green', 'purple', 'blue', 'yellow', 'red'][i]));
  say('G = green、Y = yellow…', '用顏色的第一個字母命名');
  await step(tok);                                   // @1749.3 strings = the weights
  balls.forEach((b, i) => txt(dl[i], ''));
  draw(null);
  rl = ropes.map(([a, b, len], i) => tag(String(len), 'idx', (xs[a] + xs[b]) / 2, 0.1, 0.9 + (i % 3) * 0.55));
  say('球之間用繩子連起來', '繩長 = 邊的權重');
  await step(tok);                                   // @1761.0 the green–yellow string is 19 cm
  rl[2].element.className = 'lab-label ptr alt';
  say('綠球到黃球的繩子：19 公分', '其他繩子也各有長度');
  await step(tok);                                   // @1777.7 what do I do, mechanically?
  rl[2].element.className = 'lab-label idx';
  g.mood('wow');
  say('要「機械地」算最短路徑', '該怎麼做？');
  await step(tok);                                   // @1791.1 pick up the ball and lift it
  glow(balls[0], GOLD);
  say('學生：把球提起來！', '對，提起起點那顆');
  await step(tok);                                   // @1810.0 from G: P is 7, the closest
  txt(dl[1], '7'); txt(dl[0], '0');
  say('起點 G：到紫球 P 是 7', 'P 離 G 最近');
  await step(tok);                                   // @1824.4 the next closest: B = 7 + 5 = 12
  txt(dl[2], '12');
  say('第二近：藍球 B', '7 + 5 = 12');
  await step(tok);                                   // @1851.1 lift it up
  glow(balls[0], null);
  const dG = [0, 7, 12, 16, 22];
  await lift(dG, 2400);
  dG.forEach((x, i) => txt(dl[i], String(x)));
  g.mood('happy');
  say('提起綠球 G', '其他球依序離開地面');
  await step(tok);                                   // @1861.3 green on top, then purple, blue, Y, R
  say('順序：G、P、B、Y、R', '離 G 越近，越早離地');
  await step(tok);                                   // @1871.0 taut strings = the predecessors
  const pi = tag('藍色（拉緊的）繩子 = predecessor π', 'note', 0, 0.3, 2.6);
  say('拉緊的繩子（藍）就是 predecessor π', '鬆的繩子不在最短路徑上');
  await step(tok);                                   // @1880.1 computed the shortest paths mechanically
  txt(pi, '機械地算出最短路徑，連 π 也有了');
  say('機械地算出了最短路徑', '量繩子的張力就知道 π');
  await step(tok);                                   // @1900.0 take R and lift it
  balls.forEach((b) => { b.position.y = 0.42; }); dl.forEach((l) => txt(l, ''));
  const dR = [22, 15, 10, 6, 0];
  await lift(dR, 2400);
  dR.forEach((x, i) => txt(dl[i], String(x)));
  txt(pi, '改提紅球 R');
  say('改提紅球 R', '');
  await step(tok);                                   // @1905.6 R, Y, B, P, G
  say('順序變成 R、Y、B、P、G', '換起點，順序就變');
  await step(tok);                                   // @1919.2 greedy: gravity is greedy
  txt(pi, 'gravity 也是 greedy');
  say('這裡有一個 greedy algorithm', '重力就是 greedy');
  await step(tok);                                   // @1951.0 a kinetic simulation would be slow
  txt(pi, '用物理模擬算？很酷，但慢得要命');
  g.mood('sad');
  say('可以寫物理模擬來算', '很酷，但會非常慢');
  await step(tok);                                   // @1971.3 Dijkstra computes the steady state
  txt(pi, 'Dijkstra：直接算出最後靜止的狀態');
  g.mood('calm');
  say('Dijkstra 直接算出穩定狀態', '');
  await step(tok);                                   // @1980.6 greedily: G, then purple, blue, yellow, red
  txt(pi, '從 G 開始：P、B、Y、R 依序確定');
  g.mood('happy');
  say('greedy 地建出最短路徑', '從 G 開始，依序 P、B、Y、R');
}]);

// 33:30 Dijkstra pseudocode（L16）
FRAG.push(['spmit1-dij-code', 'L16：Dijkstra pseudocode', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(GRAPHS.tri, { scale: 0.6, dx: 3.6, dz: -1.4, noDrop: true });
  const cd = code(['Dijkstra(G, w, s):', '  Initialize(G, s)', '  S = ∅', '  Q = V[G]', '  while Q ≠ ∅:', '    u = Extract-Min(Q)', '    S = S ∪ {u}', '    for v in Adj[u]:', '      Relax(u, v, w)'], -3.6, -3.0, 0.62);
  cd.ls.forEach((l) => { l.element.style.visibility = 'hidden'; });
  const d = [INF, INF, INF], inS = [false, false, false];
  const R = relaxer(d, null);
  const sT = tag('S = { }', 'ptr alt', 3.6, 0.3, 2.4), qT = tag('Q = { s, a, b }', 'ptr', 3.6, 0.3, 3.2);
  sT.element.style.visibility = 'hidden'; qT.element.style.visibility = 'hidden';
  const showQ = () => { txt(sT, 'S = { ' + [0, 1, 2].filter((v) => inS[v]).map(nm).join(', ') + ' }'); txt(qT, 'Q = { ' + [0, 1, 2].filter((v) => !inS[v]).map((v) => nm(v) + ' ' + fmt(d[v])).join(', ') + ' }'); };
  await step(tok);                                   // @2009.8 the pseudocode for Dijkstra
  cd.ls.forEach((l) => { l.element.style.visibility = ''; });
  say('Dijkstra 的 pseudocode', '');
  await step(tok);                                   // @2040.0 G graph, w weights, s start
  cd.hl(0);
  say('G 是圖、w 是權重、小寫 s 是起點', '');
  await step(tok);                                   // @2046.4 initialize: mark s as the start
  cd.hl(1); nodeColor(0, C.ok, 0.3);
  say('Initialize：標出起點 s', '');
  await step(tok);                                   // @2058.2 capital S = ∅
  cd.hl(2); sT.element.style.visibility = '';
  say('大寫 S 是一個集合', '一開始是空的');
  await step(tok);                                   // @2073.5 Q = all the vertices
  cd.hl(3); qT.element.style.visibility = ''; txt(qT, 'Q = { s, a, b }');
  say('Q：一開始是全部頂點', '');
  await step(tok);                                   // @2080.3 nothing processed yet; Q = to be processed
  say('還沒處理任何頂點', 'Q = 等著處理的頂點');
  await step(tok);                                   // @2096.0 move them from Q to S; invariant
  const inv = tag('不變量：S 裡都是「最短路徑已確定」的頂點', 'note', -3.6, 0.3, 3.4);
  say('處理完的頂點從 Q 搬到 S', 'S 裡都是已知最短路徑的頂點');
  await step(tok);                                   // @2117.3 while Q is not empty
  cd.hl(4);
  say('while 還有頂點要處理', '');
  await step(tok);                                   // @2128.6 u = Extract-Min(Q)
  cd.hl(5);
  say('u = Extract-Min(Q)', '取出 priority 最小的');
  await step(tok);                                   // @2146.2 this deletes u from Q
  say('Extract-Min 也會把 u 從 Q 刪掉', '');
  await step(tok);                                   // @2160.2 initialization sets d(s) = 0, others ∞
  cd.hl(1); d[0] = 0;
  for (let v = 0; v < 3; v++) nodeTag(v, fmt(d[v]));
  showQ();
  say('Initialize 其實就是 d(s) = 0', '其他頂點都是 ∞');
  await step(tok);                                   // @2179.6 the first Extract-Min pulls s out
  cd.hl(5); nodeColor(0, C.hot, 0.45);
  say('第一次 Extract-Min：取出 s', '只有它是 0');
  await step(tok);                                   // @2191.5 S = S ∪ {u}
  cd.hl(6); inS[0] = true; nodeColor(0, C.ok, 0.3); showQ();
  say('S = S ∪ {u}', 'S = { s }');
  await step(tok);                                   // @2202.4 relax the edges from the vertex just added
  cd.hl(8);
  await R(tok, 0, 1); showQ();
  say('relax 剛加入的頂點的出邊', 's → a：∞ → 1');
  await step(tok);                                   // @2210.7 for each v in Adj[u]: relax(u, v, w)
  await R(tok, 0, 2); showQ();
  say('for v in Adj[u]：Relax(u, v, w)', 's → b：∞ → 3');
  await step(tok);                                   // @2228.5 that's Dijkstra: greedy, iterative
  R.clear(); cd.hl(-1);
  say('這就是 Dijkstra', 'greedy、反覆做');
  await step(tok);                                   // @2238.9 greedy: pick the min and claim it's done
  cd.hl(5); nodeColor(1, C.hot, 0.45);
  say('greedy 在這一行：挑 Q 中最小的', '並宣稱它的最短路徑已確定');
  await step(tok);                                   // @2260.0 putting it into S: "I'm done"
  cd.hl(6); inS[1] = true; nodeColor(1, C.ok, 0.3); showQ();
  say('放進 S 就是說：這個做完了', 'S = { s, a }');
  await step(tok);                                   // @2268.1 relax its outgoing edges; priorities change
  cd.hl(8);
  await R(tok, 1, 2); showQ();
  say('處理它：relax 出邊、更新 priority', 'a → b：3 → 2');
  await step(tok);                                   // @2296.0 next time a different minimum, two reasons
  R.clear(); cd.hl(5);
  txt(inv, '下一輪的最小值會不同：① 剛取出的已刪掉 ② priority 改了');
  say('下一輪的最小值會不同', '取出的已刪掉；relax 改了 priority');
  await step(tok);                                   // @2318.4 in the demo: lifting green = choosing the start
  txt(inv, '掛球示範：提起綠球 = 選起點；最先拉緊的 = priority 最小');
  say('對照掛球示範', '提起綠球 = 選起點；最近的那顆 = 最小 priority');
  await step(tok);                                   // @2341.0 read the proof in CLRS
  txt(inv, '正確性證明：CLRS（約半頁～一頁）');
  say('證明不在課堂講', '請讀 CLRS 的證明');
  await step(tok);                                   // @2380.0 Q is a priority queue keyed by d
  cd.hl(3);
  txt(inv, 'Q 是 priority queue：priority = d 值');
  say('學生：頂點要怎麼比大小？', 'Q 是 priority queue，priority 就是 d');
  await step(tok);                                   // @2430.6 initially d(s) = 0: first u = s, relax from s
  cd.hl(5);
  say('一開始 d(s) = 0、其他 ∞', '第一個 u 一定是 s，接著 relax 它的出邊');
  await step(tok);                                   // @2451.8 change the priorities; select the min next time
  cd.hl(8);
  txt(inv, 'relax 改了 Q 裡的值 → 下一輪再選最小的');
  say('relax 改變 priority queue 裡的值', '下一輪再選最小的');
}]);

// 41:10 5 頂點例子（內建 dij-clrs5 的跟講版）
FRAG.push(['spmit1-clrs5', 'L16：Dijkstra 5 頂點例子', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const g = guide(-6.2, 3.6);
  const d = Array(5).fill(INF), inS = Array(5).fill(false);
  let sT = null, qT = null;
  const showQ = () => {
    if (!sT) { sT = tag('', 'ptr alt', -0.5, 0.3, 3.6); qT = tag('', 'ptr', -0.5, 0.3, 4.3); }
    txt(sT, 'S = { ' + [0, 1, 2, 3, 4].filter((v) => inS[v]).map(nm).join(', ') + ' }');
    txt(qT, 'Q：' + [0, 1, 2, 3, 4].filter((v) => !inS[v]).map((v) => nm(v) + ' ' + fmt(d[v])).join('  '));
  };
  const R = relaxer(d, null, { after: () => showQ() });
  const take = (u) => { inS[u] = true; nodeColor(u, C.ok, 0.3); showQ(); };
  await step(tok);                                   // @2470.2 a couple of steps of an example
  const sb = tag('跑前幾步就好', 'say', -6.2, 1.7, 3.6);
  say('來跑一個例子的前幾步', '完整的在講義');
  await step(tok);                                   // @2487.7 how the priority queue works
  txt(sb, '看 priority queue 怎麼運作');
  say('重點：看 priority queue 怎麼運作', '');
  await step(tok);                                   // @2502.2 a directed graph with five vertices
  kill(sb);
  buildGraph(GRAPHS.clrs5);
  say('5 個頂點的有向圖', '');
  await step(tok);                                   // @2534.0 A is the start, d(A) = 0
  d[0] = 0; nodeTag(0, '0'); nodeColor(0, C.purple, 0.2);
  say('起點 A：d(A) = 0', '');
  await step(tok);                                   // @2541.4 B..E are ∞; S is empty
  for (let v = 1; v < 5; v++) nodeTag(v, '∞');
  showQ(); qT.element.style.visibility = 'hidden';
  say('B～E 都是 ∞', 'S 一開始是空的');
  await step(tok);                                   // @2551.5 Q has all five vertices
  qT.element.style.visibility = '';
  say('Q 裡有全部 5 個頂點', '');
  await step(tok);                                   // @2559.7 Extract-Min selects A
  nodeColor(0, C.hot, 0.45);
  say('Extract-Min 選 A', '只有它是 0');
  await step(tok);                                   // @2571.4 S = {A}; relax the edges out of A
  take(0);
  say('S = { A }', '接著 relax A 的兩條出邊');
  await step(tok);                                   // @2577.3 relax A → B
  await R(tok, 0, 1);
  say('A → B：∞ → 10', '');
  await step(tok);                                   // @2581.4 0, 10, 3, ∞, ∞
  await R(tok, 0, 2);
  say('A → C：∞ → 3', '現在是 0, 10, 3, ∞, ∞');
  await step(tok);                                   // @2586.9 the next Extract-Min selects 3 (C)
  R.clear(); nodeColor(2, C.hot, 0.45);
  await goTo(tok, g, -3.0, 3.8, 600);
  take(2);
  say('下一次 Extract-Min 選 3（C）', 'S = { A, C }');
  await step(tok);                                   // @2592.7 kind of a BFS, but greedy
  const fr = tag('像 BFS：先看一個頂點的所有鄰居…', 'say', -3.0, 1.7, 3.8);
  say('有點像 BFS', '但它是 greedy 的');
  await step(tok);                                   // @2609.0 pick the vertex in the frontier with the lowest priority
  txt(fr, '…再 greedy 地挑 frontier 裡最近的：C（3 < 10）');
  g.mood('happy');
  say('frontier 裡挑 priority 最小的', 'C 是 3，B 是 10 → 選 C');
  await step(tok);                                   // @2628.5 process C: this edge
  kill(fr); g.mood('calm');
  await R(tok, 2, 1);
  say('處理 C：這條邊 C → B', '3 + 4 = 7 < 10');
  await step(tok);                                   // @2634.0 that edge
  await R(tok, 2, 3);
  say('那條邊 C → D', '3 + 8 = 11');
  await step(tok);                                   // @2638.0 0, 7, 3, 11, 5
  await R(tok, 2, 4);
  say('還有 C → E：3 + 2 = 5', '現在是 0, 7, 3, 11, 5');
  await step(tok);                                   // @2643.8 0 and 3 are gone: in S, never change
  R.clear();
  const nt = tag('S 裡的 0、3 不會再變', 'note', 3.4, 0.3, 3.6);
  say('0 和 3 已經在 S 裡', '它們的值不會再改變');
  await step(tok);                                   // @2659.7 Dijkstra guarantees it (the proof)
  txt(nt, 'Dijkstra 保證：S 裡的值不會再降');
  say('這是 Dijkstra 的保證', '正確性證明要花點功夫');
  await step(tok);                                   // @2673.0 what's remaining: 5, the E vertex
  nodeColor(4, C.hot, 0.45);
  await goTo(tok, g, 1.8, 3.8, 600);
  say('剩下最小的是 5', '對應 E');
  await step(tok);                                   // @2679.0 S becomes A, C, E
  take(4);
  g.mood('happy');
  say('S = { A, C, E }', '依此類推');
}]);

// 44:50 複雜度：priority queue 怎麼實作（內建 dij-complexity 的跟講版）
FRAG.push(['spmit1-cost', 'L16：Dijkstra 的複雜度', async (tok) => {
  fresh([0, 9, 11], [0, 0.6, -0.6]);
  const ops = [], imp = [];
  const cell = (x, z, s) => tag(s, 'idx', x, 0.3, z);
  await step(tok);                                   // @2690.1 now complexity: PQ as an ADT
  const sb = tag('priority queue（ADT）的操作要做幾次？', 'say', -3.6, 1.6, -3.4);
  say('來算複雜度', 'Dijkstra 用了 priority queue 這個 ADT');
  await step(tok);                                   // @2703.5 like early in the term: lists, arrays, heaps
  txt(sb, '像學期初：串列、陣列、Heap、樹，挑最好的');
  say('像學期初比較 linked list、array、heap', '看哪個做這組操作最好');
  await step(tok);                                   // @2725.0 what operations am I performing?
  kill(sb);
  say('看 pseudocode：做了哪些操作？', '');
  await step(tok);                                   // @2737.7 Θ(V) inserts
  ops.push(tag('Insert：Θ(V) 次', 'ptr', -4.2, 0.3, -2.8));
  say('Θ(V) 次 insert', '每個頂點放進 Q 一次');
  await step(tok);                                   // @2757.3 Θ(V) Extract-Min
  ops.push(tag('Extract-Min：Θ(V) 次', 'ptr', -4.2, 0.3, -2.0));
  say('Θ(V) 次 Extract-Min', '每個頂點只處理一次');
  await step(tok);                                   // @2775.7 Θ(E) Decrease-Key
  ops.push(tag('Decrease-Key：Θ(E) 次', 'ptr', -4.2, 0.3, -1.2));
  say('Θ(E) 次 Decrease-Key', '');
  await step(tok);                                   // @2786.8 relax = decrease the key
  ops[2].element.className = 'lab-label ptr alt';
  say('relax 就是在降低 key', '把 d 值變小');
  await step(tok);                                   // @2804.7 each edge processed once
  ops[2].element.className = 'lab-label ptr';
  say('每條邊只會被處理一次', '所以是 Θ(E)');
  await step(tok);                                   // @2826.3 you're the data structure designer
  say('現在你是資料結構設計師', '有幾種選擇');
  await step(tok);                                   // @2834.8 using an array
  imp.push(buddy('Array', '?', '#dd8238', -1.2, 0, 0.8, 0.8));
  say('如果用 array 做 priority queue', '');
  await step(tok);                                   // @2857.3 Extract-Min in an array: Θ(V)
  cell(-1.2, 2.2, 'Extract-Min Θ(V)');
  say('array 的 Extract-Min：Θ(V)', '要掃過整個陣列');
  await step(tok);                                   // @2862.5 Decrease-Key in an array: Θ(1)
  cell(-1.2, 2.8, 'Decrease-Key Θ(1)');
  say('Decrease-Key：Θ(1)', '直接改那一格');
  await step(tok);                                   // @2883.0 multiply: V·V + E·1
  imp[0].set('Θ(V²+E)');
  say('乘起來：V × V + E × 1', 'Θ(V² + E)');
  await step(tok);                                   // @2899.8 E = O(V²) → Θ(V²)
  imp[0].set('Θ(V²)');
  say('E 最多 V²，所以就是 Θ(V²)', '');
  await step(tok);                                   // @2922.0 which data structure? a min-heap
  imp[0].mood('sad');
  imp.push(buddy('Binary Heap', '?', '#4b9ee2', 1.6, 0, 0.8, 0.8));
  say('要用 array 嗎？', '學生：用 min-heap！');
  await step(tok);                                   // @2933.8 binary min-heap: find-min constant, delete Θ(log V)
  cell(1.6, 2.2, 'Extract-Min Θ(log V)');
  say('binary min-heap：看最小值 O(1)', '但刪掉再調整要 Θ(log V)');
  await step(tok);                                   // @2968.0 Decrease-Key Θ(log V)
  cell(1.6, 2.8, 'Decrease-Key Θ(log V)');
  say('Decrease-Key 也是 Θ(log V)', '比 array 的 Θ(1) 慢');
  await step(tok);                                   // @2977.8 V log V + E log V
  imp[1].set('Θ((V+E)log V)');
  say('乘起來：V log V + E log V', '');
  await step(tok);                                   // @2985.8 not optimal → Fibonacci heap
  imp.push(buddy('Fibonacci Heap', '?', '#2fc092', 4.4, 0, 0.8, 0.8));
  say('這還不是最好的', 'Fibonacci heap（6.046 才教）');
  await step(tok);                                   // @3022.7 amortized: Θ(log V) Extract-Min, Θ(1) Decrease-Key
  cell(4.4, 2.2, 'Extract-Min Θ(log V)'); cell(4.4, 2.8, 'Decrease-Key Θ(1) 攤銷');
  say('攤銷：Extract-Min Θ(log V)', 'Decrease-Key Θ(1)');
  await step(tok);                                   // @3043.0 Θ(V log V + E)
  imp[2].set('Θ(V log V+E)'); imp[2].mood('happy');
  say('結果：Θ(V log V + E)', '就是第一堂寫的那個複雜度');
  await step(tok);                                   // @3058.9 DAGs linear, Dijkstra almost linear
  tag('DAG：O(V + E)｜Dijkstra：幾乎線性', 'note', 1.6, 0.3, 4.0);
  say('兩個特例：DAG 線性', 'Dijkstra 配好的資料結構也幾乎線性');
  await step(tok);                                   // @3076.0 next time: possibly negative cycles
  say('下次：可能有負 cycle 的一般情況', '複雜度會更高');
}]);

// ══════════ L18（CHvQ3q_gJ7E）══════════
const FWD = '#bfe8d6', BWD = '#cfe0f5';
// 00:45 三種最短路徑問題
FRAG.push(['spmit1-three-problems', 'L18：三種最短路徑問題', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(GRAPHS.l15);
  const g = guide(-6.2, 3.6);
  const nt = tag('', 'note', 0.6, 0.3, 4.3); nt.element.style.visibility = 'hidden';
  const note = (s) => { nt.element.style.visibility = ''; txt(nt, s); };
  const tree = [[0, 1], [0, 2], [2, 4], [4, 3], [1, 5], [5, 6]];
  await step(tok);                                   // @48.6 optimizations that don't change the worst case
  note('今天：最壞複雜度不變的優化');
  say('最短路徑單元最後一講', '講不改變最壞複雜度的優化');
  await step(tok);                                   // @60.5 better real-life / average-case performance
  note('但實際（平均）跑得更快');
  g.mood('happy');
  say('實際上、平均情況下跑得更快', '這點沒辦法證明');
  await step(tok);                                   // @75.2 the first: Dijkstra for a single target
  nodeColor(0, C.ok, 0.3); nodeColor(3, C.purple, 0.3); nodeNote(3, '目標 t');
  note('優化一：只要一個目標 t 的 Dijkstra');
  say('第一個你已經做過了', '只找一個目標時優化 Dijkstra');
  await step(tok);                                   // @84.9 so far: single source, all destinations
  tree.forEach(([u, v]) => edgeColor(smE(u, v), C.tree, 2));
  note('之前：single source、所有目的地');
  say('之前其實都在解：一個起點、所有目的地', 'Dijkstra、Bellman-Ford 都是');
  await step(tok);                                   // @108.5 a source s, one specific destination t
  tree.forEach(([u, v]) => edgeColor(smE(u, v), C.edge, 1));
  smPath([0, 2, 4, 3], C.tree, 2.4);
  note('很多時候：起點 s、一個特定目的地 t');
  say('很多時候只要 s 到某個 t', '作業裡就在做');
  await step(tok);                                   // @117.8 reduces runtime, especially if t is close
  note('t 很近時，不用走遍整張圖');
  say('最壞情況不變，但能省時間', '尤其 t 很近時');
  await step(tok);                                   // @132.1 still must prove the path is shortest
  note('演算法還是要保證找到的是最短路徑');
  say('當然還是要證明找到的是最短的', '');
  await step(tok);                                   // @145.7 bidirectional search
  smPath([0, 2, 4, 3], C.edge, 1);
  note('優化二：雙向搜尋 bidirectional search');
  say('雙向搜尋', '');
  await step(tok);                                   // @161.6 a frontier from S going forward
  nodeColor(0, FWD, 0.3); nodeColor(1, FWD, 0.3); nodeColor(2, FWD, 0.3);
  edgeColor(smE(0, 1), C.ok, 2); edgeColor(smE(0, 2), C.ok, 2);
  say('從 S 往前長出一個 frontier', '');
  await step(tok);                                   // @170.6 a backward frontier from t, edges backward
  nodeColor(3, BWD, 0.3); nodeColor(4, BWD, 0.3);
  edgeColor(smE(4, 3), C.tree, 2);
  say('從目的地沿著邊「反方向」長出另一個', '');
  await step(tok);                                   // @178.1 when the frontiers meet → shortest paths
  edgeColor(smE(2, 4), C.hot, 2.4);
  note('兩個 frontier 相遇 → 找到最短路徑？');
  say('兩個 frontier 相遇時', '就能找到最短路徑');
  await step(tok);                                   // @184.0 not as simple as that
  g.mood('wow');
  note('沒有聽起來那麼簡單！');
  say('其實沒那麼簡單', '要仔細看');
  await step(tok);                                   // @199.2 all-pairs shortest paths
  for (let v = 0; v < 7; v++) { nodeColor(v, C.white, 0); nodeNote(v, ''); }
  GR.edges.forEach((e) => edgeColor(e, C.edge, 1)); g.mood('calm');
  note('還有 all-pairs shortest paths（6.046）');
  say('還有 all-pairs shortest paths', '6.006 不講，6.046 才講');
  await step(tok);                                   // @208.5 any pair of vertices
  for (const [a, b] of [[1, 6], [2, 5], [4, 6]]) { nodeColor(a, C.ok, 0.3); nodeColor(b, C.purple, 0.3); await beat(tok, 500); nodeColor(a, C.white, 0); nodeColor(b, C.white, 0); }
  say('起點、終點都不知道', '任兩個頂點都要');
  await step(tok);                                   // @222.1 more work: varying the source
  note('起點也在變 → 比 single source 更多工作');
  say('比 single source 還多工作', '因為起點也在變');
  await step(tok);                                   // @229.8 the three different problems
  note('三種問題：單一 s→t｜單一起點→全部｜任兩點');
  say('這就是三種最短路徑問題', '今天專攻第一種');
  await step(tok);                                   // @254.8 worst-case complexity unchanged
  nodeColor(0, C.ok, 0.3); nodeColor(3, C.purple, 0.3);
  note('今天所有版本：最壞複雜度都不變');
  say('強調：今天每個 Dijkstra 版本', '最壞複雜度都不變');
}]);

// 04:25 優化一：取出 t 就停
FRAG.push(['spmit1-dij-stop', 'L18：取出 t 就停的 Dijkstra', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(GRAPHS.clrs5, { scale: 0.62, dx: 3.2, dz: -0.6, noDrop: true });
  const lines = ['Dijkstra(G, w, s, t):', '  Initialize：d(s) = 0，其他 ∞', '  Q = V', '  while Q ≠ ∅:', '    u = Extract-Min(Q)', '                        ', '    for v in Adj[u]:', '      Relax(u, v, w)'];
  const cd = code(lines, -4.0, -2.8, 0.62);
  const d = Array(5).fill(INF), inS = Array(5).fill(false);
  const qT = tag('', 'ptr', -4.2, 0.3, 3.4);
  const showQ = () => txt(qT, 'Q：' + [0, 1, 2, 3, 4].filter((v) => !inS[v]).map((v) => nm(v) + ' ' + fmt(d[v])).join('  '));
  const R = relaxer(d, null, { pi: true, after: showQ });
  const par = null;
  await step(tok);                                   // @265.0 put up the Dijkstra pseudocode
  say('先把 Dijkstra pseudocode 放上來', '待會改它');
  await step(tok);                                   // @281.9 the vertices we don't know shortest paths to
  cd.hl(2); showQ();
  say('Q：還不知道最短路徑的頂點', '');
  await step(tok);                                   // @288.0 initialize d(s) = 0, the others ∞
  cd.hl(1); d[0] = 0;
  for (let v = 0; v < 5; v++) nodeTag(v, fmt(d[v]));
  showQ();
  say('Initialize：d(s) = 0', '其他 ∞');
  await step(tok);                                   // @299.1 keep extracting the minimum from Q
  cd.hl(4);
  say('不斷從 Q 取出 priority 最小的', 'Extract-Min');
  await step(tok);                                   // @313.9 once extracted, its shortest path is known
  nodeColor(0, C.ok, 0.3); inS[0] = true; showQ();
  say('取出 u 的那一刻', '它的最短路徑就確定了（invariant）');
  await step(tok);                                   // @324.4 relaxation updates the priorities
  cd.hl(7);
  await R(tok, 0, 1); await R(tok, 0, 2);
  say('接著 relax：更新 priority', 'B 10、C 3');
  await step(tok);                                   // @342.1 also π(v) = u, d(v) decremented
  R.clear();
  say('也設定 parent：π(v) = u', 'd(v) 跟著變小');
  await step(tok);                                   // @361.5 one line: if u == t, stop
  txt(cd.ls[5], '    if u == t: stop   ← 只多這一行'.padEnd(26, ' '));
  cd.hl(5);
  nodeColor(4, C.purple, 0.2); nodeNote(4, '目標 t');
  say('只多一行：如果 u == t 就停', '這裡讓目標 t = E');
  await step(tok);                                   // @376.2 no need to wait until Q is empty
  cd.hl(4); nodeColor(2, C.ok, 0.3); inS[2] = true; showQ();
  await R(tok, 2, 1); await R(tok, 2, 3); await R(tok, 2, 4);
  say('不用等 Q 變空', '繼續：取出 C，relax 它的邊');
  await step(tok);                                   // @388.0 stop when t is lifted off Q
  R.clear(); cd.hl(5);
  nodeColor(4, C.ok, 0.45); inS[4] = true; showQ();
  say('取出 E：u == t → 停！', 'δ(A, E) = 5');
  await step(tok);                                   // @395.9 runs faster; the check is ~free
  nodeColor(1, C.dim, 0); nodeColor(3, C.dim, 0);
  const nt = tag('B、D 沒被取出：省下來的工作', 'note', 3.2, 0.3, 3.4);
  say('一定更快', '多一個比較，幾乎不花時間');
  await step(tok);                                   // @410.3 faster for sure with a specific target
  txt(nt, '有特定目標時：只會更快');
  say('有特定目標時，一定比較快', '');
  await step(tok);                                   // @417.0 if t is the last vertex: no slower
  txt(nt, '最壞：t 是最後一個取出的 → 也不會更慢');
  say('t 剛好最後一個取出', '也不會比較慢');
}]);

// 07:18 雙向搜尋：forward + backward、資料結構加倍
FRAG.push(['spmit1-bidir-setup', 'L18：雙向搜尋的設定', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const g = guide(-6.2, 3.6);
  let t1 = null;
  await step(tok);                                   // @438.5 bidirectional search
  const sb = tag('雙向搜尋：兩頭一起找', 'say', -6.2, 1.7, 3.6);
  say('來看雙向搜尋', '比較有趣、不那麼顯然');
  await step(tok);                                   // @453.3 we have S and T
  kill(sb);
  buildGraph({ ...SM.bi, edges: [] });
  for (let v = 1; v < 6; v++) if (v !== 4) nodeColor(v, C.dim, 0);
  say('有起點 s 和終點 t', '');
  await step(tok);                                   // @457.9 a bunch of nodes in between
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(SM.bi, { noDrop: true });
  const g2 = guide(-6.2, 3.6);
  say('中間有一堆頂點', '');
  await step(tok);                                   // @471.2 alternate forward and backward
  const ar1 = arrow(V3(-5.2, 0.9, -3.4), V3(-1.2, 0.9, -3.4), 0x2fc092), ar2 = arrow(V3(5.4, 0.9, -3.4), V3(1.4, 0.9, -3.4), 0x2f7fd0);
  say('forward、backward 交替進行', '');
  await step(tok);                                   // @486.9 one step of standard Dijkstra, from s
  kill(ar1); kill(ar2);
  nodeColor(0, C.hot, 0.45);
  say('forward：做一步標準 Dijkstra', '從 s 出發');
  await step(tok);                                   // @507.2 pick s off Q; process its two edges
  nodeColor(0, FWD, 0.3);
  edgeColor(smE(0, 1), C.ok, 2.2); edgeColor(smE(0, 5), C.ok, 2.2);
  say('第一步：從 Q 取出 s', '處理 s 的兩條出邊');
  await step(tok);                                   // @523.4 stop forward; one step of backward search
  nodeColor(4, C.hot, 0.45);
  say('forward 先停', '換 backward 做一步');
  await step(tok);                                   // @537.7 backward from t, following edges backward
  nodeColor(4, BWD, 0.3);
  edgeColor(smE(3, 4), C.tree, 2.2);
  const back = arrow(V3(5.0, 0.9, -0.8), V3(3.2, 0.9, -0.8), 0x2f7fd0);
  say('backward 從 t 出發', '沿著邊「反方向」走');
  await step(tok);                                   // @543.1 the data structure must allow both directions
  t1 = tag('邊要能正著走、也能反著走', 'note', 0, 0.3, 4.0);
  say('資料結構要能反向走訪邊', '這點要記得');
  await step(tok);                                   // @557.0 in the backward search t has the min priority
  kill(back);
  say('backward 搜尋裡', 't 是 priority 最小的');
  await step(tok);                                   // @570.2 two priorities: d_f(s) = 0
  nodeTag(0, 'd_f 0', 'ptr alt');
  txt(t1, '兩套 priority：forward 用 d_f');
  say('要兩套 priority', 'forward：d_f(s) = 0');
  await step(tok);                                   // @584.1 d_b(t) = 0
  nodeNote(4, 'd_b 0');
  txt(t1, 'backward 用 d_b：d_b(t) = 0');
  say('backward：d_b(t) = 0', '下標 f、b 分開兩套');
  await step(tok);                                   // @596.3 complementary: everything else ∞
  for (const v of [1, 2, 3, 4, 5]) nodeTag(v, 'd_f ∞');
  for (const v of [0, 1, 2, 3, 5]) nodeNote(v, 'd_b ∞');
  txt(t1, '完全對稱：其他頂點兩邊都是 ∞');
  say('完全對稱', '其他頂點一開始都是 ∞');
  await step(tok);                                   // @617.5 forward, backward, … when do you stop?
  txt(t1, 'forward、backward、forward…什麼時候停？');
  g2.mood('wow');
  say('前、後、前、後…', '什麼時候停？待會再說');
  await step(tok);                                   // @647.4 a doubling of the data structures
  g2.mood('calm');
  txt(t1, '資料結構全部加倍');
  say('資料結構要加倍', '');
  await step(tok);                                   // @650.1 two min priority queues Q_f, Q_b
  const qf = tag('Q_f（forward 的 min priority queue）', 'ptr', -3.4, 0.3, 3.3), qb = tag('Q_b（backward）', 'ptr', 3.4, 0.3, 3.3);
  say('兩個 min priority queue', 'Q_f 和 Q_b');
  await step(tok);                                   // @664.0 this edge goes this way; we go backward
  edgeColor(smE(3, 4), C.hot, 2.6);
  const back2 = arrow(V3(5.0, 0.9, -0.8), V3(3.2, 0.9, -0.8), 0x2f7fd0);
  say('這條邊在圖裡是往 t', 'backward 卻是倒著走它');
  await step(tok);                                   // @682.6 d_f(u) forward distances, d_b(u) backward
  kill(back2); edgeColor(smE(3, 4), C.tree, 2.2);
  txt(t1, 'd_f(u)：forward 距離；d_b(u)：backward 距離');
  say('d_f(u)：forward 的距離', 'd_b(u)：backward 的距離');
  await step(tok);                                   // @728.2 initialize d_f(s) = 0, d_b(t) = 0, others ∞
  txt(t1, '初始化：d_f(s) = 0、d_b(t) = 0，其他都 ∞');
  kill(qf); kill(qb);
  g2.mood('happy');
  say('初始化：d_f(s) = 0、d_b(t) = 0', '其他全部 ∞');
}]);

// 12:24 何時停？怎麼組路徑？
FRAG.push(['spmit1-bidir-stop', 'L18：雙向搜尋何時停、怎麼組路徑', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(SM.bi, { dz: -0.6, noDrop: true });
  const g = guide(-6.2, 3.6);
  nodeColor(0, FWD, 0.3); nodeColor(4, BWD, 0.3);
  edgeColor(smE(0, 1), C.ok, 2); edgeColor(smE(0, 5), C.ok, 2); edgeColor(smE(3, 4), C.tree, 2);
  const nt = tag('', 'note', 0, 0.3, 4.0); nt.element.style.visibility = 'hidden';
  const note = (s) => { nt.element.style.visibility = ''; txt(nt, s); };
  await step(tok);                                   // @760.4 intuitively, stop when the frontiers meet
  note('直覺：兩個 frontier 相遇就停');
  say('直覺上：frontier 相遇就停', '');
  await step(tok);                                   // @771.0 can't stop when they look like this
  note('現在還沒碰到：不能停');
  say('像這樣分開時當然不能停', '');
  await step(tok);                                   // @785.0 a termination condition you can code
  note('「相遇」寫不成程式：要更具體的條件');
  g.mood('wow');
  say('看程式碼：停止條件該是什麼？', '「相遇」沒辦法寫成程式');
  await step(tok);                                   // @814.0 a student: some node in Q_f and Q_b…
  note('學生：某個頂點同時在 Q_f、Q_b…（還不夠具體）');
  say('學生：某個頂點在 Q_f 和 Q_b 裡…', '接近了，但還不能寫成程式');
  await step(tok);                                   // @846.7 a node extracted from both Q_f and Q_b
  edgeColor(smE(1, 2), C.ok, 2); nodeColor(1, FWD, 0.3);
  edgeColor(smE(2, 3), C.tree, 2); nodeColor(3, BWD, 0.3);
  nodeColor(2, C.back, 0.5); nodeTag(2, 'w');
  note('另一位學生：被 Q_f 和 Q_b 都取出過的頂點');
  g.mood('happy');
  say('同時從 Q_f 和 Q_b 都被取出的頂點！', '');
  await step(tok);                                   // @865.0 like u == t: extract from both, then stop
  note('就像 u == t 就停：兩邊都取出某頂點 → 停');
  say('就像單一目標時 u == t 就停', '這次是兩邊都取出了某個頂點');
  await step(tok);                                   // @895.9 the termination condition
  note('終止條件：某個頂點在 forward 和 backward 都處理過');
  g.mood('calm');
  say('終止條件：某個頂點 u', '在 forward、backward 都被處理過');
  await step(tok);                                   // @923.8 = the frontiers meeting
  note('這就是「frontier 相遇」：從 Q_f、Q_b 都被刪掉');
  say('這就是 frontier 相遇', '精確地說：從 Q_f、Q_b 都被取出');
  await step(tok);                                   // @946.0 the harder question: the path after stopping
  note('較難的問題：停下來之後，s 到 t 的路怎麼找？');
  say('較難的問題', '停下後怎麼找出 s 到 t 的最短路徑？');
  await step(tok);                                   // @973.0 we need π_f and π_b
  note('需要 π_f、π_b；π_b 是沿著反向邊的 predecessor');
  say('需要 π_f 和 π_b', 'π_b 沿著反向的邊');
  await step(tok);                                   // @995.0 v2: (wrongly) π_b(t) = v2
  nodeNote(4, 'π_b(t) = v2 ?');
  say('老師先寫 π_b(t) = v2', '（待會學生會糾正）');
  await step(tok);                                   // @1027.6 π_f(v1) = s
  nodeNote(1, 'π_f = s');
  say('這邊 π_f(v1) = s', '');
  await step(tok);                                   // @1047.0 how do we find the path? where to switch?
  note('問題：從 π_f 換成 π_b 的那一點在哪？');
  say('停下後怎麼組出 s 到 t？', '在哪裡從 π_f 換成 π_b？');
  await step(tok);                                   // @1105.2 use π_f from w back to s
  note('從造成終止的 w 開始：用 π_f 回到 s');
  nodeNote(2, 'π_f = v1');
  say('w 是第一個兩邊都被取出的頂點', '從 w 用 π_f 回到 s');
  await step(tok);                                   // @1145.0 apply π_f to w until you get to s
  const pk = await walk(tok, 'π_f', [2, 1, 0], 550);
  smPath([0, 1, 2], C.hot, 2.4);
  say('對 w 一直套 π_f', '直到回到 s');
  await step(tok);                                   // @1159.8 use π_b: the backward path t to w
  kill(pk);
  note('再用 π_b：從 w 一路走到 t');
  say('再用 π_b', '這是從 t 到 w 的反向路徑');
  await step(tok);                                   // @1199.0 a student: shouldn't it be π_b(v2) = t?
  g.mood('wow');
  say('學生：不是應該 π_b(v2) 嗎？', '好問題：老師可能寫錯了');
  await step(tok);                                   // @1230.9 the forward path s → v1 → v3 → … → t
  smPath([0, 1, 2, 3, 4], C.hot, 2.2);
  say('先看一般的 forward 路徑', 's → v1 → v3 → … → t');
  await step(tok);                                   // @1265.0 π_f(v3) = v1
  nodeNote(2, 'π_f = v1');
  say('π_f(v1) = s、π_f(v3) = v1', '');
  await step(tok);                                   // @1272.4 the backward path: pretend the edges are flipped
  smPath([0, 1, 2, 3, 4], C.tree, 2);
  const flip = arrow(V3(5.0, 0.9, -1.4), V3(3.2, 0.9, -1.4), 0x2f7fd0);
  note('反向路徑：假裝每條邊都翻過來');
  say('看 backward 路徑', '假裝邊全部翻轉');
  await step(tok);                                   // @1304.8 t is the predecessor of v2: π_b(v2) = t
  kill(flip);
  nodeNote(4, ''); nodeNote(3, 'π_b = t');
  g.mood('happy');
  note('翻過來後 t 是 v2 的前一個：π_b(v2) = t');
  say('t 是 v2 的 predecessor', '正確寫法：π_b(v2) = t');
  await step(tok);                                   // @1374.2 forward: apply π_f to w over and over
  nodeNote(2, 'π_f v1 / π_b v2');
  smPath([0, 1, 2], C.hot, 2.4);
  note('forward：從 w 一直套 π_f，回到 s');
  say('forward：從 w 套 π_f、再套 π_f…', '直到 s');
  await step(tok);                                   // @1398.7 apply π_b to w until t; both start at w
  smPath([2, 3, 4], C.hot, 2.4);
  note('backward：從 w 一直套 π_b，到 t；兩邊都從 w 出發');
  say('backward：從 w 套 π_b，直到 t', 'π_f、π_b 都從造成終止的 w 開始');
}]);

// 24:11 w 不一定在最短路徑上（內建 bidir-wrong-w 的跟講版）
FRAG.push(['spmit1-wrongw', 'L18：w 不一定在最短路徑上', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(SM.bi, { dz: -0.6, noDrop: true });
  const g = guide(-6.2, 3.6);
  for (const v of [0, 1]) nodeColor(v, FWD, 0.3);
  for (const v of [3, 4]) nodeColor(v, BWD, 0.3);
  nodeColor(2, C.back, 0.5); nodeTag(2, 'w');
  const nt = tag('', 'note', 0, 0.3, 4.0); nt.element.style.visibility = 'hidden';
  const note = (s) => { nt.element.style.visibility = ''; txt(nt, s); };
  await step(tok);                                   // @1451.7 this is not quite correct
  g.mood('wow');
  note('剛剛的作法：還不完全正確');
  say('剛剛講的不完全正確', '');
  await step(tok);                                   // @1464.3 recap: w caused the termination
  g.mood('calm');
  note('複習：造成終止的頂點叫 w');
  say('複習：造成終止的頂點叫 w', '');
  await step(tok);                                   // @1476.4 w is on the intersection of the frontiers
  say('w 在兩個 frontier 的交會處', '');
  await step(tok);                                   // @1482.3 build two sub-paths from w
  smPath([0, 1, 2], C.ok, 2.4); smPath([2, 3, 4], C.tree, 2.4);
  note('用 π_f、π_b 從 w 組出兩段路');
  say('從 w 用 π_f、π_b 組兩段子路徑', '');
  await step(tok);                                   // @1495.0 w may not be on the shortest path
  smPath([0, 5, 3], C.hot, 2.6);
  note('問題：w 不一定在最短路徑上！（也許最短的是 s→x→v2→t）');
  g.mood('sad');
  say('問題：w 可能不在最短路徑上', '');
  await step(tok);                                   // @1506.5 an example later; a subtle condition
  say('等一下會看例子', '這是很微妙的情況');
  await step(tok);                                   // @1525.0 the termination condition is correct
  smPath([0, 5, 3], C.edge, 1);
  note('終止條件沒錯：交替做，w 兩邊都取出就停');
  g.mood('calm');
  say('終止條件是對的', '剛才同學答的條件沒錯');
  await step(tok);                                   // @1552.0 what's wrong: using w to build the path
  note('錯的是：直接拿 w 來組路徑');
  say('錯的是用 w 來組最短路徑', '停下後要再多做一點事');
  await step(tok);                                   // @1569.5 any ideas how to fix?
  g.mood('wow');
  say('怎麼修？', '如果 w 不在最短路徑上，那誰在？');
  await step(tok);                                   // @1591.8 we must use both π_f and π_b
  g.mood('calm');
  note('一定要同時用 π_f 和 π_b：兩邊才剛碰到就停了');
  say('一定要同時用 π_f 和 π_b', '兩個 frontier 才剛碰到');
  await step(tok);                                   // @1604.0 can't use π_f all the way, nor π_b
  note('π_f 走不到 t，π_b 也走不到 s');
  say('不能只用 π_f 從 s 走到 t', '也不能只用 π_b 從 t 走到 s');
  await step(tok);                                   // @1618.3 a student: are the weights identical?
  note('學生問：邊的權重一樣嗎？→ 權重不變，只是能反著走');
  say('學生：每條邊權重一樣嗎？', '權重不變，也沒有新增邊');
  await step(tok);                                   // @1653.3 Dijkstra's requirement: non-negative
  note('權重可以是任意實數、無理數，但都 ≥ 0');
  say('權重可以任意', '但要非負：Dijkstra 的要求');
  await step(tok);                                   // @1671.4 the backward search uses the same weight
  edgeColor(smE(3, 4), C.hot, 2.6);
  note('backward 走同一條邊：權重一樣');
  say('backward 反著走這條邊', '權重還是一樣');
}]);

// 28:05 反例 s、u、u′、w、t：前四步（內建 bidir-wrong-w 前半的跟講版）
FRAG.push(['spmit1-trace1', 'L18：反例逐步執行（前四步）', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const g = guide(-6.2, 3.8);
  const df = [INF, INF, INF, INF, INF], db = [INF, INF, INF, INF, INF];
  const doneF = new Set(), doneB = new Set();
  const sh = (v) => { nodeTag(v, 'f ' + fmt(df[v])); nodeNote(v, 'b ' + fmt(db[v])); };
  const shAll = () => { for (let v = 0; v < 5; v++) sh(v); };
  const paint = (u) => nodeColor(u, doneF.has(u) && doneB.has(u) ? C.back : doneF.has(u) ? FWD : BWD, 0.3);
  // forward relax a → b, or backward relax b ← a (the edge a → b walked in reverse)
  const fR = async (a, b) => { const e = smE(a, b); edgeColor(e, C.ok, 2.2); const pk = await walk(tok, fmt(df[a]) + ' + ' + e.w, [a, b], 600); df[b] = Math.min(df[b], df[a] + e.w); sh(b); kill(pk); };
  const bR = async (a, b) => { const e = smE(a, b); edgeColor(e, C.tree, 2.2); const pk = await walk(tok, fmt(db[b]) + ' + ' + e.w, [b, a], 600); db[a] = Math.min(db[a], db[b] + e.w); sh(a); kill(pk); };
  await step(tok);                                   // @1685.0 let me show you an example
  const sb = tag('來看反例', 'say', -6.2, 1.7, 3.8);
  say('來看一個例子', '');
  await step(tok);                                   // @1694.1 a five-node example that took a while
  txt(sb, '老師花了好一陣子設計的 5 頂點反例');
  say('5 個頂點的例子', '想了好一陣子才設計出來');
  await step(tok);                                   // @1702.3 the termination condition in a specific case
  txt(sb, '照規則交替 forward／backward，看它在哪裡停');
  say('照規則交替做', '看它停在哪、該怎麼組路徑');
  await step(tok);                                   // @1720.3 the termination condition is correct
  txt(sb, '終止條件是對的：不是停太早');
  say('再說一次：終止條件是對的', '不是太早停');
  await step(tok);                                   // @1730.7 s over here; a straightforward graph
  kill(sb);
  buildGraph(GRAPHS.bidir); hideW();
  tag('上 = d_f（forward）、下 = d_b（backward）', 'idx', 0, 0.3, 4.3);
  say('s 在這裡，一張簡單的圖', '');
  await step(tok);                                   // @1740.5 5, 5, 3, 3, 3
  hideW(false);
  say('權重：5, 5, 3, 3, 3', '');
  await step(tok);                                   // @1746.7 the shortest path: three edges on top, 9
  smPath([0, 1, 2, 3], C.hot, 2.4);
  say('不用電腦也看得出來：最短是上面三條邊', '3 + 3 + 3 = 9');
  await step(tok);                                   // @1757.9 the forward search; names u, u′, t
  smPath([0, 1, 2, 3], C.edge, 1);
  say('這是 forward 搜尋', '頂點叫 u、u′、t…');
  await step(tok);                                   // @1769.6 the first step of the forward search
  df[0] = 0; shAll(); doneF.add(0); paint(0);
  say('forward 第一步：取出 s', 'd_f(s) = 0');
  await step(tok);                                   // @1780.8 this one is w: d_f(w) = 5
  await fR(0, 4);
  say('這個叫 w：d_f(w) = 5', '');
  await step(tok);                                   // @1787.0 d_f(u) = 3
  await fR(0, 1);
  say('d_f(u) = 3', 'd_f(s) 當然是 0');
  await step(tok);                                   // @1795.9 not bothering to write the infinities
  say('∞ 就不寫了', '免得黑板太亂');
  await step(tok);                                   // @1808.6 the first step of the backward search
  say('換 backward 第一步', '記得要交替');
  await step(tok);                                   // @1836.4 hash t vertically (backward); d_b(t) = 0
  db[3] = 0; sh(3); doneB.add(3); paint(3);
  say('t 用直線畫掉 = backward 取出', 'd_b(t) = 0');
  await step(tok);                                   // @1843.0 follow this and this backwards; same weights
  edgeColor(smE(2, 3), C.hot, 2); edgeColor(smE(4, 3), C.hot, 2);
  say('沿這兩條邊反著走', '權重不變，同一張圖');
  await step(tok);                                   // @1855.5 d_b(u′) = 3
  await bR(2, 3);
  say('d_b(u′) = 3', '');
  await step(tok);                                   // @1860.1 d_b(w) = 5
  await bR(4, 3);
  say('d_b(w) = 5', '');
  await step(tok);                                   // @1867.7 haven't seen u or s yet
  say('backward 還沒看到 u 和 s', '只標了這兩個');
  await step(tok);                                   // @1895.2 forward search again
  g.mood('wow');
  say('再做 forward', '');
  await step(tok);                                   // @1928.0 a choice: w or u — 5 vs 3
  nodeColor(1, C.hot, 0.45); nodeColor(4, C.hot, 0.45);
  say('Q_f 裡要選 w 還是 u？', 'd_f(w) = 5，d_f(u) = 3');
  await step(tok);                                   // @1940.6 Extract-Min picks u
  nodeColor(4, C.white, 0); doneF.add(1); paint(1);
  g.mood('calm');
  say('Extract-Min 當然選 u', '3 < 5');
  await step(tok);                                   // @1948.3 d_f(u′) = 6
  await fR(1, 2);
  say('處理這條邊：d_f(u′) = 6', '3 + 3');
  await step(tok);                                   // @1961.0 now the backward search
  say('換 backward', '');
  await step(tok);                                   // @1983.7 horizontal = out of Q_f, vertical = out of Q_b
  tag('綠 = 已從 Q_f 取出（橫線）｜藍 = 已從 Q_b 取出（直線）', 'note', 0, 0.3, 3.6);
  say('橫線 = 已從 Q_f 取出', '直線 = 已從 Q_b 取出');
  await step(tok);                                   // @2023.0 d_b(w) = 5 vs d_b(u′) = 3 → pick u′
  doneB.add(2); paint(2);
  say('Q_b 裡：d_b(u′) = 3、d_b(w) = 5', '選小的 u′');
  await step(tok);                                   // @2035.9 process it: d_b(u) = 6
  await bR(1, 2);
  say('處理它：d_b(u) = 6', '3 + 3');
  await step(tok);                                   // @2044.4 picked off Q_b; relaxed the edge backwards
  g.mood('happy');
  say('剛剛：從 Q_b 取出 u′', '把這條邊「反著」relax');
}]);

// 34:46 反例：後兩步與 10 ≠ 9
FRAG.push(['spmit1-trace2', 'L18：反例的後兩步與 10 ≠ 9', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(GRAPHS.bidir, { noDrop: true });
  const g = guide(-6.2, 3.8);
  tag('上 = d_f（forward）、下 = d_b（backward）', 'idx', 0, 0.3, 4.3);
  const df = [0, 3, 6, INF, 5], db = [INF, 6, 3, 0, 5];
  const doneF = new Set([0, 1]), doneB = new Set([3, 2]);
  const sh = (v) => { nodeTag(v, 'f ' + fmt(df[v])); nodeNote(v, 'b ' + fmt(db[v])); };
  for (let v = 0; v < 5; v++) sh(v);
  const paint = (u) => nodeColor(u, doneF.has(u) && doneB.has(u) ? C.back : doneF.has(u) ? FWD : doneB.has(u) ? BWD : C.white, 0.3);
  [0, 1, 2, 3, 4].forEach(paint);
  edgeColor(smE(0, 1), C.ok, 2); edgeColor(smE(0, 4), C.ok, 2); edgeColor(smE(1, 2), C.ok, 2);
  edgeColor(smE(2, 3), C.tree, 2); edgeColor(smE(4, 3), C.tree, 2);
  const nt = tag('', 'note', 0, 0.3, 3.6); nt.element.style.visibility = 'hidden';
  const note = (s) => { nt.element.style.visibility = ''; txt(nt, s); };
  await step(tok);                                   // @2087.4 getting pretty close
  say('快結束了', '前四步之後的狀態');
  await step(tok);                                   // @2134.7 forward again
  say('再做一次 forward', '');
  await step(tok);                                   // @2137.6 the only choice: w (d_f = 5); u is done; u′ is 6
  nodeColor(4, C.hot, 0.45); nodeColor(2, C.hot, 0.45);
  say('Q_f 裡：w 是 5', 'u 已經取出過；u′ 是 6');
  await step(tok);                                   // @2163.9 compare u′ and w → pick w
  doneF.add(4); paint(4); paint(2);
  say('比較 u′ 和 w：選 w', '5 < 6');
  await step(tok);                                   // @2188.6 d_f(t) = 10
  const e = smE(4, 3); edgeColor(e, C.ok, 2.2);
  const pk = await walk(tok, '5 + 5', [4, 3], 600); df[3] = 10; sh(3); kill(pk);
  say('處理 w：d_f(t) = 10', '5 + 5');
  await step(tok);                                   // @2197.0 you start to see a problem
  g.mood('wow');
  say('開始看出問題了…', '');
  await step(tok);                                   // @2210.5 w removed from Q_f
  note('w 已從 Q_f 取出（綠）');
  say('w 已經從 Q_f 移除', '');
  await step(tok);                                   // @2218.2 the last step: backward search
  g.mood('calm');
  say('最後一步：backward', '');
  await step(tok);                                   // @2244.4 d_b(u′) = 3, d_f(u′) = 6, d_f(w) = 5, d_b(w) = 5
  note('Q_b 裡：w 是 5、u 是 6');
  nodeColor(4, C.hot, 0.45); nodeColor(1, C.hot, 0.45);
  say('看一下各個值', 'd_b(w) = 5，d_b(u) = 6');
  await step(tok);                                   // @2266.0 compare → pick w and remove it
  doneB.add(4); paint(4); paint(1);
  note('w 兩邊都取出了 → 終止！');
  say('選 w，從 Q_b 取出', '（老師口誤說成 Q_f）w 兩邊都取出 → 停');
  await step(tok);                                   // @2290.0 d_b(s) = 10
  const e2 = smE(0, 4); edgeColor(e2, C.tree, 2.2);
  const pk2 = await walk(tok, '5 + 5', [4, 0], 600); db[0] = 10; sh(0); kill(pk2);
  say('d_b(s) = 10', '5 + 5');
  await step(tok);                                   // @2306.2 see the problem?
  g.mood('wow');
  say('看出問題了嗎？', '');
  await step(tok);                                   // @2313.4 terminated; forward weight of t is 10
  nodeColor(3, C.hot, 0.45);
  note('forward 看 t：10');
  say('停下來了：forward 給 t 的是 10', '');
  await step(tok);                                   // @2334.8 backward weight of s is 10
  nodeColor(0, C.hot, 0.45);
  note('forward 看 t：10｜backward 看 s：10');
  say('backward 給 s 的也是 10', '');
  await step(tok);                                   // @2336.0 the shortest path should be 9
  [[0, 1], [1, 2], [2, 3]].forEach(([a, b]) => edgeColor(smE(a, b), C.hot, 2.6));
  note('但最短路徑是 9（上面三條邊）！');
  g.mood('sad');
  say('可是最短路徑是 9', '');
  await step(tok);                                   // @2342.6 we stopped when w came off Q_f and Q_b
  [[0, 1], [1, 2], [2, 3]].forEach(([a, b]) => edgeColor(smE(a, b), C.edge, 1));
  edgeColor(smE(0, 4), C.back, 2.6); edgeColor(smE(4, 3), C.back, 2.6);
  note('照條件停在 w');
  g.mood('calm');
  say('照終止條件，在 w 停了', 'w 從 Q_f、Q_b 都被取出');
  await step(tok);                                   // @2350.6 the short path in number of edges (2)
  note('s → w → t：只有 2 條邊（邊數最少）');
  say('因為 s → w → t 是「短」的路', '以邊數來算：只有 2 條');
  await step(tok);                                   // @2362.5 the frontiers collide regardless of weights
  note('交替搜尋：frontier 在邊數最少的路徑上相撞，與權重無關');
  say('frontier 相撞的地方跟權重無關', '交替做 → 會在邊數最少的路徑上相遇');
  await step(tok);                                   // @2380.9 shortest-length path ≠ shortest-weight path
  note('這個例子：邊數最少的路 ≠ 權重最小的路');
  say('這個例子刻意設計成', '邊數最少的路，不是權重最小的路');
}]);

// 39:49 修正：找 d_f(x) + d_b(x) 最小的 x（內建 bidir-fix-x 的跟講版）
FRAG.push(['spmit1-fixx', 'L18：修正——找 d_f(x) + d_b(x) 最小的 x', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(GRAPHS.bidir, { noDrop: true });
  const g = guide(-6.2, 3.8);
  tag('上 = d_f、下 = d_b', 'idx', 0, 0.3, 4.3);
  const df = [0, 3, 6, 10, 5], db = [10, 6, 3, 0, 5];
  for (let v = 0; v < 5; v++) { nodeTag(v, 'f ' + fmt(df[v])); nodeNote(v, 'b ' + fmt(db[v])); }
  [[0, FWD], [1, FWD], [2, BWD], [3, BWD], [4, C.back]].forEach(([v, c]) => nodeColor(v, c, 0.3));
  const nt = tag('', 'note', 0, 0.3, 3.6); nt.element.style.visibility = 'hidden';
  const note = (s) => { nt.element.style.visibility = ''; txt(nt, s); };
  await step(tok);                                   // @2389.2 can't use w with π_f and π_b
  edgeColor(smE(0, 4), C.back, 2.4); edgeColor(smE(4, 3), C.back, 2.4);
  note('不能直接用 w 接 π_f、π_b');
  say('不能拿 w 來接 π_f、π_b', '');
  await step(tok);                                   // @2407.0 we'd get a path of length 10
  note('那樣會得到長度 10 的路（錯）');
  say('那樣會得到長度 10 的路', '');
  await step(tok);                                   // @2412.3 how do we fix it? termination unchanged
  edgeColor(smE(0, 4), C.edge, 1); edgeColor(smE(4, 3), C.edge, 1);
  note('怎麼修？終止條件不變');
  g.mood('wow');
  say('怎麼修？', '終止條件不用改');
  await step(tok);                                   // @2423.8 a student: alternate based on the weights
  note('學生：依權重決定要做 forward 還是 backward');
  say('學生：依權重來決定交替', '總成本低的那邊多做幾步');
  await step(tok);                                   // @2462.8 weighted alternation: a nice idea
  note('老師：好點子，可能是對的，但要證明');
  g.mood('calm');
  say('老師喜歡這個點子', '「加權交替」可能是對的');
  await step(tok);                                   // @2494.0 worried: irrational weights, hard to implement
  note('但權重是 √2、π 之類時，加權交替不好實作');
  say('擔心：權重是 √2、π 這種數', '加權交替會很難實作');
  await step(tok);                                   // @2533.1 another answer: almost exactly correct
  note('另一位學生的答案：幾乎完全正確！');
  g.mood('happy');
  say('另一位同學的答案', '幾乎完全正確');
  await step(tok);                                   // @2575.2 the answer was correct; write it up
  say('答案是對的', '寫下來');
  await step(tok);                                   // @2584.0 a little more work: same termination, strict alternation
  note('照樣嚴格交替、照樣終止；停下後多做一點事');
  g.mood('calm');
  say('照樣嚴格交替、照樣終止', '停下後多做一點事');
  await step(tok);                                   // @2599.9 find x (maybe ≠ w) minimizing d_f(x) + d_b(x)
  note('找一個 x（不一定是 w），讓 d_f(x) + d_b(x) 最小');
  say('找一個 x，可能不是 w', '讓 d_f(x) + d_b(x) 最小');
  await step(tok);                                   // @2640.0 look at Q_f and Q_b
  say('去掃 Q_f 和 Q_b', '');
  await step(tok);                                   // @2645.2 maybe w is the minimum — not here
  nodeColor(4, C.hot, 0.5);
  const pk = await walk(tok, '5 + 5 = 10', [4], 300);
  note('w：5 + 5 = 10');
  say('有可能 w 就是最小的', '但這個例子不是：5 + 5 = 10');
  await step(tok);                                   // @2656.6 scan: u and u′
  kill(pk); nodeColor(4, C.back, 0.3);
  note('還有兩個有意思的頂點：u、u′');
  say('w 造成終止，但要再掃一遍', '有意思的還有 u 和 u′');
  await step(tok);                                   // @2664.7 d_f(u) + d_b(u) = 3 + 6 = 9
  nodeColor(1, C.hot, 0.5);
  note('u：3 + 6 = 9');
  say('d_f(u) + d_b(u)', '3 + 6 = 9');
  await step(tok);                                   // @2672.7 d_f(u′) + d_b(u′) = 6 + 3 = 9
  nodeColor(2, C.hot, 0.5);
  note('u′：6 + 3 = 9');
  say('d_f(u′) + d_b(u′)', '6 + 3 = 9');
  await step(tok);                                   // @2688.3 both less than 10: pick one as x
  nodeColor(1, C.ok, 0.5); nodeTag(1, 'x：3 + 6 = 9', 'ptr alt');
  note('9 < 10：選其中一個當 x（這裡選 u）');
  say('兩個都比 10 小', '挑一個當 x');
  await step(tok);                                   // @2695.3 use x instead of w
  [[0, 1], [1, 2], [2, 3]].forEach(([a, b]) => edgeColor(smE(a, b), C.tree, 2.6));
  note('用 x 取代 w：π_f 接回 s、π_b 接到 t → 9 ✓');
  g.mood('happy');
  say('用 x 取代 w', 'π_f 接回 s、π_b 接到 t：最短路徑 9');
  await step(tok);                                   // @2716.3 the small tweak, summarized
  note('交替 → 終止 → 找 d_f(x) + d_b(x) 最小的 x');
  say('小修正：交替、終止', '再找 d_f(x) + d_b(x) 最小的 x');
}]);

// 45:31 位能 λ：w̄(u,v) = w(u,v) − λ(u) + λ(v)
FRAG.push(['spmit1-potential', 'L18：位能改權重，讓搜尋往下坡走', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const g = guide(-6.2, 3.6);
  const nt = tag('', 'note', 0.4, 0.3, 4.3); nt.element.style.visibility = 'hidden';
  const note = (s) => { nt.element.style.visibility = ''; txt(nt, s); };
  const lam = [9, 4, 4, 0];
  let bars = null;
  const H = (x) => Math.max(0.05, x * 0.3);
  const setBar = (v, x) => { const h = H(x), p = GR.nodes[v].home; bars[v].scale.y = h; bars[v].position.set(p.x + 0.8, h / 2, p.z); };
  await step(tok);                                   // @2742.0 heuristics that modify the graph
  note('啟發式：改一下圖，讓實際跑得更快');
  say('最後：用啟發式改圖', '讓實際跑得更快');
  await step(tok);                                   // @2756.6 goal-directed search, A*
  note('goal-directed search（和 A* 有共通點）');
  say('goal-directed search', '修過 6.034 的話：和 A* 很像');
  await step(tok);                                   // @2772.1 modify the weights: go downhill toward the shortest path
  note('改邊的權重：讓搜尋「往下坡」朝最短路徑走');
  say('修改邊的權重', '讓搜尋像往下坡走，朝著最短路徑');
  await step(tok);                                   // @2796.7 heuristic priorities; prune the search
  note('priority 被啟發式地改過 → 修剪搜尋範圍');
  say('priority 被啟發式地調整', '修剪搜尋範圍');
  await step(tok);                                   // @2810.0 careful: nothing incorrect
  note('要小心：不能讓答案變錯');
  g.mood('wow');
  say('要小心改', '不能做出錯的事');
  await step(tok);                                   // @2818.0 a potential function λ
  g.mood('calm');
  buildGraph(SM.pot);
  bars = [0, 1, 2, 3].map(() => cube('', '#c9b6f2', [0.24, 1, 0.24], 0, 0, 0));
  for (let v = 0; v < 4; v++) { setBar(v, lam[v]); nodeNote(v, 'λ = ' + lam[v]); }
  note('位能函數 λ：每個頂點一個高度（紫柱）');
  say('用一個位能函數 λ', '每個頂點一個「高度」');
  await step(tok);                                   // @2830.7 w̄(u, v) = w(u, v) − λ(u) + λ(v)
  note('新權重：w̄(u, v) = w(u, v) − λ(u) + λ(v)');
  say('邊 (u, v) 的新權重', 'w̄(u, v) = w(u, v) − λ(u) + λ(v)');
  await step(tok);                                   // @2845.3 careful with the choice of λ
  say('λ 要小心選', '');
  await step(tok);                                   // @2865.5 a source s, a single target t
  nodeColor(0, C.ok, 0.3); nodeColor(3, C.purple, 0.3);
  say('起點 s', '一樣是單一目標 t');
  await step(tok);                                   // @2874.1 an edge of 5 and an edge of 5
  edgeColor(smE(0, 1), C.hot, 2); edgeColor(smE(0, 2), C.hot, 2);
  say('s 出去兩條邊，都是 5', '');
  await step(tok);                                   // @2879.1 guess which is more likely on the shortest path?
  g.mood('wow');
  say('能不能猜哪條比較可能在最短路徑上？', '');
  await step(tok);                                   // @2896.8 increase the potential of this node (t2)
  g.mood('calm');
  edgeColor(smE(0, 1), C.edge, 1); edgeColor(smE(0, 2), C.edge, 1);
  glow(bars[2], GOLD);
  say('提高這個頂點的位能', '這個叫 t2，那個叫 t1');
  await step(tok);                                   // @2910.6 t2 goes uphill, t1 downhill
  await kanim(tok, 900, (k) => setBar(2, 4 + 4 * k));
  lam[2] = 8; nodeNote(2, 'λ = 8'); glow(bars[2], null);
  note('t2 墊高：往 t2 是上坡；往 t1 是下坡');
  say('t2 墊高：往 t2 變上坡', '往 t1 是下坡');
  await step(tok);                                   // @2920.0 the weights steer Dijkstra downhill
  for (const e of GR.edges) { const nw = e.w - lam[e.u] + lam[e.v]; setW(e, nw); edgeColor(e, nw === 0 ? C.ok : C.edge, nw === 0 ? 2 : 1); }
  note('新權重：s→t1 0、s→t2 4 → Dijkstra 先往下坡');
  say('新權重讓 Dijkstra 往下坡走', '早一點結束');
  await step(tok);                                   // @2931.9 same asymptotic complexity, faster in practice
  note('漸近複雜度不變；選對位能，實際快一點');
  say('漸近複雜度不變', '選對位能，實際會快一點');
  await step(tok);                                   // @2940.3 feels like magic: how to choose?
  g.mood('wow');
  note('像變魔術：哪些點該墊高？哪些該壓低？');
  say('像魔術：怎麼知道要墊高誰？', '');
  await step(tok);                                   // @2961.3 a correct example: landmarks
  g.mood('calm');
  note('等一下：一種正確的作法——landmark');
  say('等一下給一個正確的例子', '用 landmark 來定位能');
  await step(tok);                                   // @2980.1 any path weight changes based on its source and destination
  smPath([0, 1, 3], C.hot, 2.2);
  note('任一條路徑 p 的權重：只跟起點、終點有關地改變');
  say('任一條路徑的權重', '依它的起點和終點而改變');
  await step(tok);                                   // @3005.7 the shortest paths must not change
  note('原本的最短路徑，改完還要是最短路徑');
  say('不能改變任何最短路徑', '原本最短的要繼續最短');
  await step(tok);                                   // @3026.0 subtract a function of s and of t
  note('w̄(p) = w(p) − λ(s) + λ(t)：中間的 λ 全部互相抵消');
  say('一條 s→t 路徑：w̄(p) = w(p) − λ(s) + λ(t)', '中間頂點的 λ 一加一減抵消了');
  await step(tok);                                   // @3042.2 every s → t path shifts by the same amount
  smPath([0, 1, 3], C.tree, 2.2); smPath([0, 2, 3], C.purple, 2);
  note('s→t1→t：9 → 0｜s→t2→t：13 → 4：都減了 9');
  say('每條 s→t 路徑都平移同一個量', '都減了 λ(s) − λ(t) = 9');
  await step(tok);                                   // @3051.2 the final shortest path is correct
  smPath([0, 2, 3], C.edge, 1);
  g.mood('happy');
  note('最短路徑不變，只是可能更快找到');
  say('找到的最短路徑一定正確', '只是可能更快找到');
}]);

// 51:08 landmark：λ_t(u) = δ(u, L) − δ(t, L)
FRAG.push(['spmit1-landmark', 'L18：用 landmark 算位能', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(SM.land);
  const g = guide(-6.2, 3.6);
  const nt = tag('', 'note', 0, 0.3, 4.2); nt.element.style.visibility = 'hidden';
  const note = (s) => { nt.element.style.visibility = ''; txt(nt, s); };
  const dl = [11, 6, 10, 2, 0];
  await step(tok);                                   // @3068.2 one way of getting potentials: a landmark
  note('一種得到位能的方法：landmark');
  say('得到位能的一種方法', '叫 landmark（地標）');
  await step(tok);                                   // @3079.7 a landmark L ∈ V
  nodeColor(4, C.purple, 0.35);
  say('選一個 landmark L', 'L 是圖裡的一個頂點');
  await step(tok);                                   // @3087.7 precompute δ(u, L)
  note('預先算好 δ(u, L)');
  say('預先算 δ(u, L)', '');
  await step(tok);                                   // @3097.8 every vertex to the landmark: change the source, same destination
  note('每個頂點到 L 的最短距離：起點換來換去，終點固定 L');
  say('每個頂點到 landmark 的最短路徑', '等於起點在變、終點固定');
  await step(tok);                                   // @3108.7 λ_t(u) = δ(u, L) − δ(t, L)
  note('λ_t(u) = δ(u, L) − δ(t, L)');
  say('位能：λ_t(u) = δ(u, L) − δ(t, L)', '');
  await step(tok);                                   // @3120.7 source S, destination T, landmark L
  nodeColor(0, C.ok, 0.3); nodeColor(3, C.hot, 0.3);
  say('起點 s、終點 t、landmark L', '');
  await step(tok);                                   // @3128.1 precompute δ(u, L) for all u
  for (let v = 0; v < 5; v++) { nodeTag(v, 'δ(·,L) ' + dl[v]); await beat(tok, 300); }
  say('對所有 u 預先算 δ(u, L)', '');
  await step(tok);                                   // @3136.7 for the given t: δ(t, L), just once
  const pk = await walk(tok, 'δ(t, L) = 2', [3, 4], 600);
  kill(pk);
  note('給定 t：δ(t, L) = 2，只算一次');
  say('對給定的 t 算 δ(t, L)', '只有一個 t，算一次就好');
  await step(tok);                                   // @3145.4 the other one is much more computation
  note('δ(u, L) 那一大批才是主要的工作量（但只做一次）');
  say('δ(u, L) 那一批工作量大得多', '');
  await step(tok);                                   // @3148.3 correct, by the triangle inequality
  const lam = dl.map((x) => x - dl[3]);
  for (let v = 0; v < 5; v++) nodeNote(v, 'λ = ' + fmt(lam[v]));
  for (const e of GR.edges) { const nw = e.w - lam[e.u] + lam[e.v]; setW(e, nw); edgeColor(e, nw === 0 ? C.ok : C.edge, nw === 0 ? 2 : 1); }
  note('三角不等式 δ(u, L) ≤ w(u, v) + δ(v, L) → 新權重都 ≥ 0');
  say('用三角不等式可以證明它是對的', '新權重全部 ≥ 0');
  await step(tok);                                   // @3155.6 a heuristic: a good landmark → faster
  note('這是 heuristic：選對 landmark，Dijkstra 實際跑更快');
  say('這是 heuristic', '選對 landmark，Dijkstra 跑得更快');
  await step(tok);                                   // @3165.8 Caltech to Boston via middle America
  nodeNote(0, 'Caltech'); nodeNote(3, 'Boston');
  smPath([0, 1, 3], C.tree, 2.2);
  say('例如 Caltech 到 Boston', '一定會經過美國中部');
  await step(tok);                                   // @3178.0 pick Austin, Texas
  nodeNote(4, 'Austin');
  g.mood('happy');
  say('選德州 Austin 當 landmark', '');
  await step(tok);                                   // @3182.8 maybe 2x faster, 20% faster
  note('Dijkstra 可能快 20%～2 倍');
  say('Dijkstra 也許快 2 倍、或快 20%', '');
  await step(tok);                                   // @3187.4 the correctness argument is in the notes
  note('正確性的論證：放在講義裡');
  say('正確性的細節', '放在講義裡');
}]);
  }

  // ═══ spmit2.js ═══
  {
const { V3, cube, glow, kill, arrow, move, fly, tint, relabel, GOLD, GREEN, RED, step, buddy, travel } = K;
// ─── MIT 6.006 L17 Bellman-Ford（ozsuci5pIso）、R15 Shortest Paths（mQSp6VmfakA）、R18 Quiz 2 Review（sPuazUPiV1k）───
// 用本章模組的畫圖工具（buildGraph、nodeTag、edgeColor、addEdge、makeStrip…）；fresh / tag / code 是模組自己的版本。
// cued：每個 await step(tok) 等講者說到那一句（時間寫在註解）；step 之間只有短短的動作。
// 白板上的圖只有部分權重出現在逐字稿：標「示意」的數字是依描述補上的。
const S2R = '#d64545', S2B = '#2f7fd0', S2PAL = '#f4a56a';
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
// 小探：會說話、會走路的小幫手（talk 顯示對話泡泡、go 走到別處）
function s2Pal(x, z, s = 0.6, name = '小探', col = S2PAL) {
  const b = buddy(name, '', col, x, 0, z, s);
  const bub = ctx.lab.label('', 'say'); bub.position.set(0, s + (name ? 1.0 : 0.6), 0); bub.element.style.display = 'none'; b.g.add(bub);
  b.talk = (t) => { bub.element.style.display = t ? '' : 'none'; bub.element.textContent = t || ''; };
  b.go = (tok, x2, z2, ms = 700) => travel(tok, b.g, b.g.position.clone(), V3(x2, 0, z2), ms);
  return b;
}
const s2At = (i, y = 1.0) => { const h = GR.nodes[i].home; return V3(h.x, y, h.z); };
// 一個小封包沿著一串頂點走，帶著它算的數字
async function s2Walk(tok, text, path, ms = 450) {
  const p0 = s2At(path[0]);
  const pk = tag(text, 'pkt', p0.x, p0.y, p0.z);
  for (let i = 1; i < path.length; i++) await travel(tok, pk, s2At(path[i - 1]), s2At(path[i]), ms);
  return pk;
}
const s2Show = (l, on) => { l.element.style.display = on ? '' : 'none'; };

// ══════════ L17 Bellman-Ford ══════════
// 00:31 規格：δ 可能有限、∞ 或 undefined
FRAG.push(['spmit2-bf-spec', 'L17：Bellman-Ford 要做到什麼', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // 0:31 今天的對手
  const g = s2Pal(-5.4, 3.4, 0.7);
  g.mood('wow'); g.talk('負邊、負 cycle！');
  const foe = tag('今天的對手：負權重邊、負權重 cycle', 'note', 0, 0.3, -3.6);
  say('今天的對手：負邊與負 cycle', '最短路徑單元第 3 講');
  await step(tok);                                   // 0:46 Bellman 和 Ford
  const who = tag('Bellman ＋ Ford（兩人各自想出來）', 'ptr', 0, 0.3, -2.6);
  g.mood('calm'); g.talk('兩個人的名字');
  say('Bellman-Ford 演算法', '能處理有負邊的圖');
  await step(tok);                                   // 0:58 有負 cycle 也正確
  txt(foe, '有負 cycle：回報它存在，不硬算');
  g.talk('會老實說「算不了」');
  say('就算有負 cycle 也正確', '回報負 cycle；其他頂點照樣給對的答案');
  await step(tok);                                   // 1:25 多項式時間；描述、分析、證明
  const plan = ['① 描述', '② 複雜度', '③ 正式證明'].map((t, i) => tag(t, 'idx', -3 + i * 3, 0.3, -1.4));
  g.mood('happy'); g.talk('今天三件事'); await g.hop(tok);
  say('多項式時間，而且好描述', '今天：描述 → 分析 → 證明');
  await step(tok);                                   // 1:52 一般情況：起點 u
  kill(foe); kill(who); plan.forEach(kill);
  buildGraph(S2G.spec);
  nodeColor(0, C.pq, 0.3); nodeNote(0, 'source');
  g.mood('calm'); g.talk('從 u 出發');
  await g.go(tok, -5.6, 1.9, 600);
  say('一般情況：起點 u', '有向、有權重的圖');
  await step(tok);                                   // 2:13 一個負權重 cycle
  s2Path([2, 3, 4, 2], C.back, 2.2);
  g.mood('wow'); g.talk('2 + 3 − 6 = −1');
  say('v1 → v2 → v3 → v1 是負 cycle', '2 + 3 − 6 = −1（權重示意）');
  await step(tok);                                   // 2:46 δ(u, v1) undefined
  nodeTag(2, 'undefined', 'ptr alt');
  say('δ(u, v1)：undefined', '要能偵測出這個負 cycle');
  await step(tok);                                   // 2:58 v2、v3 也一樣
  nodeTag(3, 'undefined', 'ptr alt'); nodeTag(4, 'undefined', 'ptr alt');
  say('v2、v3 也是 undefined', 'cycle 上每個點都一樣');
  await step(tok);                                   // 3:07 可以一直繞
  const pk = tag('4', 'pkt', s2At(2).x, 1, s2At(2).z);
  const ring = [2, 3, 4, 2, 3, 4, 2], vals = [6, 9, 3, 5, 8, 2];
  for (let i = 1; i < ring.length; i++) { await travel(tok, pk, s2At(ring[i - 1]), s2At(ring[i]), 330); txt(pk, String(vals[i - 1])); }
  g.mood('sad'); g.talk('越繞越小…');
  say('每繞一圈少 1，可以無限繞', '要多短有多短 → 沒有最短');
  await step(tok);                                   // 3:16 v0：δ = 2
  kill(pk);
  s2Path([0, 1], C.tree, 2.2); nodeTag(1, 'δ = 2'); nodeColor(1, C.ok, 0.3);
  g.mood('happy'); g.talk('v0 沒問題');
  say('v0：δ(u, v0) = 2', '一條邊的簡單路徑，途中沒有負 cycle');
  await step(tok);                                   // 3:39 z 走不到
  nodeColor(5, C.dim, 0); nodeTag(5, 'δ = ∞');
  g.mood('calm'); g.talk('z 走不到');
  say('z 從 u 走不到', 'δ(u, z) = ∞');
  await step(tok);                                   // 3:51 一開始：u = 0，其他 ∞
  for (let v = 0; v < 6; v++) nodeTag(v, v === 0 ? 'd = 0' : 'd = ∞', v === 0 ? 'ptr' : 'idx');
  g.talk('先全部設 ∞');
  say('開始時：d(u) = 0，其他 ∞', '這是初始化');
  await step(tok);                                   // 4:06 有的留 ∞、有的變有限、有的 undefined
  nodeTag(1, '2'); nodeTag(5, '∞'); for (let v = 2; v <= 4; v++) nodeTag(v, 'undefined', 'ptr alt');
  say('結束時三種結果', '有限（v0）、∞（z）、undefined（cycle 上）');
  await step(tok);                                   // 4:17 這就是規格
  g.mood('happy'); g.talk('這就是規格！'); await g.hop(tok);
  say('這就是 Bellman-Ford 的規格', '偵測負 cycle，其餘照算 δ');
}]);

// 04:29 通用演算法與兩個問題：指數時間、負 cycle 永不停止
FRAG.push(['spmit2-generic-problems', 'L17：通用演算法的兩個問題', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // 4:29 複習通用演算法
  const cd = code(['Initialize：d(v) = ∞，π(v) = NIL', '          d(s) = 0', 'repeat', '  選一條邊 (u, v)', '  Relax(u, v, w)', 'until 沒有邊能 relax'], -3.4, -4.2, 0.55);
  cd.hl(-1);
  const g = s2Pal(4.6, -2.6, 0.6);
  g.talk('複習一下！');
  say('複習：通用最短路徑演算法', '順便複習符號');
  await step(tok);                                   // 5:01 全部 d = ∞、π = NIL
  cd.hl(0);
  say('所有頂點 d(v) = ∞', '前一個頂點 π(v) = NIL（還沒有）');
  await step(tok);                                   // 5:13 d(s) = 0
  cd.hl(1);
  g.talk('起點到自己 = 0');
  say('起點：d(s) = 0', 's 是 source');
  await step(tok);                                   // 5:20 repeat：選一條邊
  cd.hl(3);
  g.talk('挑哪條邊？');
  say('主迴圈：選一條邊', '怎麼選，決定是哪個演算法');
  await step(tok);                                   // 5:37 Dijkstra 選優先度最小的
  const dj = tag('Dijkstra：選 d 最小的頂點出發', 'note', 3.2, 0.3, 0.4);
  say('Dijkstra 就是一種選法', '每次取 d 最小的（min priority）');
  await step(tok);                                   // 5:50 Relax
  kill(dj); cd.hl(4);
  g.talk('Relax！');
  say('然後 relax 那條邊', 'Relax(u, v, w)');
  await step(tok);                                   // 6:08 d(v) > d(u) + w 就更新
  const rx = tag('d(v) > d(u) + w(u, v) → d(v) = d(u) + w', 'note', 0, 0.3, 0.6);
  say('d(v) > d(u) + w 就更新', '找到更短的路就改成它');
  await step(tok);                                   // 6:17 同時設 π(v) = u
  const pi = tag('π(v) = u：記住「從誰過來」', 'note', 0, 0.3, 1.5);
  say('relax 時也設 π(v) = u', '記下最短路徑的前一個頂點');
  await step(tok);                                   // 6:25 做到不能再 relax
  cd.hl(5);
  say('一直做到不能再 relax', '這就是通用演算法');
  await step(tok);                                   // 6:40 兩個問題
  kill(rx); kill(pi); cd.hl(-1);
  g.mood('wow'); g.talk('有兩個問題');
  say('這個演算法有兩個問題', '都跟執行時間有關');
  await step(tok);                                   // 6:51 問題 1：可能指數時間
  const p1 = tag('問題 1：指數時間', 'ptr alt', -3.6, 0.3, -0.2);
  say('問題 1：可能要指數時間', '就算權重全是正的也會');
  await step(tok);                                   // 7:16 這種圖：選錯邊
  buildGraph(GRAPHS.chain, { scale: 0.8, dz: 2.6, ns: 0.8 });
  for (const [u, v] of [[0, 2], [2, 4], [4, 6], [0, 1], [1, 2], [2, 3], [3, 4]]) { edgeColor(s2E(u, v), C.hot, 1.8); await beat(tok, 300); edgeColor(s2E(u, v), C.edge, 1); }
  g.mood('sad'); g.talk('同一條邊一直被改');
  say('像這種圖，選邊選得很差', '同一條邊會被 relax 很多次');
  await step(tok);                                   // 7:32 n 個點 → 2^(n/2)
  tag('n 個點 → O(2^(n/2)) 次 relax', 'note', 0, 0.3, 4.6);
  say('n 個點：O(2^(n/2))', '每多兩個點，次數翻倍');
  await step(tok);                                   // 7:44 問題 2：負 cycle → 不會停
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(S2G.loop);
  s2Path([1, 2, 3, 1], C.back, 2);
  for (let v = 0; v < 4; v++) nodeTag(v, v ? '∞' : '0');
  const g2 = s2Pal(-4.6, 3.2, 0.6);
  g2.talk('負 cycle…');
  tag('問題 2：不會結束', 'ptr alt', -1, 0.3, -3.6);
  say('問題 2：可能根本不會結束', 'a → b → c → a：1 + 1 − 3 = −1');
  await step(tok);                                   // 8:04 走得到負 cycle 就永遠停不下來
  const d = [0, INF, INF, INF];
  const cnt = tag('relax 0 次', 'pkt', 0.4, 0.3, 4.2);
  let c = 0;
  const ord = [[0, 1], [1, 2], [2, 3], [3, 1]];
  for (let k = 0; k < 10; k++) {
    const [u, v] = ord[k < 4 ? k : 1 + ((k - 4) % 3)];
    const e = s2E(u, v);
    edgeColor(e, C.hot, 2.2);
    if (d[u] + e.w < d[v]) { d[v] = d[u] + e.w; c++; nodeTag(v, fmt(d[v]), 'ptr alt'); txt(cnt, 'relax ' + c + ' 次'); }
    await beat(tok, 250);
    edgeColor(e, v === 1 && u === 0 ? C.edge : C.back, 2);
  }
  txt(cnt, 'relax ' + c + ' 次… 還沒完');
  g2.mood('sad'); g2.talk('停不下來！');
  say('從 s 走得到負 cycle', 'd 一直降，until 永遠不成立');
  await step(tok);                                   // 8:29 問題 1 已經用 Dijkstra 修好
  tag('問題 1 ✓ Dijkstra（非負權重）', 'note', 3.4, 0.3, -2.6);
  g2.mood('calm'); g2.talk('問題 1 修好了');
  say('問題 1 已經修好', '非負權重：Dijkstra');
  await step(tok);                                   // 8:51 DAG 可以；一般圖的負 cycle 還不會
  tag('負邊 + DAG ✓；一般圖 → 今天', 'note', 3.4, 0.3, -1.7);
  g2.talk('今天的主題！');
  say('DAG 能處理負邊', '一般圖的負 cycle：今天解決');
}]);

// 09:01 Five-Minute University：6.006 的 10 秒版本，對回今天的兩個問題
FRAG.push(['spmit2-five-minute', 'L17：6.006 的 10 秒版本（多項式／指數／無限）', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const g = s2Pal(5.6, 3.0, 0.6, '畢業生');
  await step(tok);                                   // 9:02 SNL: Five-Minute University
  tag('五分鐘大學：畢業 5 年後，你只記得 5 分鐘份量的東西', 'say', 0, 0.3, -4.0);
  g.talk('都忘光了…'); g.mood('sad');
  say('小品「五分鐘大學」', '畢業五年後，大概什麼都不記得');
  await step(tok);                                   // 10:18 the 10-second version of 6.006
  const cards = [['多項式時間', '很棒 ✓', C.ok, -4.0], ['指數時間', '很糟 ✗', C.hot, 0], ['無限時間', '會被開除！', C.back, 4.0]];
  for (const [a, b, col, x] of cards) { cube(a, col, [3.0, 0.6, 1.0], x, 0.3, -2.2, 2); tag(b, 'note', x, 0.3, -1.1); await beat(tok, 450); }
  g.mood('happy'); g.talk('記住這三句！');
  say('6.006 的 10 秒版本', '多項式很棒、指數很糟、無限會被開除');
  await step(tok);                                   // 10:44 wrong edge choices: polynomial → exponential
  buildGraph(GRAPHS.chain, { scale: 0.62, dx: -2.4, dz: 2.4, ns: 0.7, noDrop: true });
  for (const [u, v] of [[0, 2], [2, 4], [0, 1], [1, 2], [2, 4]]) { edgeColor(s2E(u, v), C.hot, 1.8); await beat(tok, 260); edgeColor(s2E(u, v), C.edge, 1); }
  tag('問題 1：選錯邊 → 指數時間', 'ptr alt', 0, 0.3, 0.2);
  g.mood('wow'); g.talk('本來是多項式…');
  say('通用演算法選錯邊', '本來多項式（像 Dijkstra）變成指數時間');
  await step(tok);                                   // 11:09 unexpected negative cycle: never completes
  tag('問題 2：遇到負 cycle → 永遠跑不完', 'ptr alt', 4.0, 0.3, 1.0);
  g.mood('sad'); g.talk('停不下來！');
  say('圖裡有預期之外的負 cycle', '終止條件永遠不成立 → 永遠跑不完');
}]);

const BF_CODE = ['Bellman-Ford(G, W, s)', '  Initialize()', '  for i = 1 to |V| − 1:', '    for each edge (u, v) ∈ E:', '      Relax(u, v, w)', '  for each edge (u, v) ∈ E:', '    if d[v] > d[u] + w(u, v):', '      report 負 cycle 存在'];
// 11:29 四行程式：|V| − 1 輪 relax 每條邊，再一輪檢查
FRAG.push(['spmit2-bf-code', 'L17：Bellman-Ford 的程式', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // 11:29 Bellman-Ford：四行程式
  const cd = code(BF_CODE, -2.8, -4.3, 0.5);
  cd.hl(-1);
  const g = s2Pal(5.6, 3.4, 0.55);
  g.mood('happy'); g.talk('只有四行！');
  say('今天用 Bellman-Ford 修好問題 2', '描述起來只有四行');
  await step(tok);                                   // 11:54 輸入：圖、權重、起點 s
  cd.hl(0);
  g.mood('calm'); g.talk('圖、權重、起點');
  say('輸入：圖 G、權重 W、起點 s', '圖用 adjacency list 表示');
  await step(tok);                                   // 12:14 初始化跟通用版一樣
  cd.hl(1);
  say('初始化跟通用版一樣', 'd(s) = 0，其他 ∞，π = NIL');
  await step(tok);                                   // 12:28 i = 1 到 |V| − 1
  cd.hl(2);
  g.talk('|V| − 1 輪');
  say('做很多輪：i = 1 到 |V| − 1', '|V| = 頂點數');
  await step(tok);                                   // 12:48 每一輪：每條邊都 relax
  const E = 5, zOf = (p) => -0.2 + (p - 1) * 1.15;
  cd.hl(3);
  tag('第 1 輪', 'idx', -5.4, 0.3, zOf(1));
  for (let k = 0; k < E; k++) { cd.hl(k % 2 ? 4 : 3); cube('e' + (k + 1), '#efe3c8', [0.9, 0.4, 0.7], -3.6 + k * 1.3, 0.2, zOf(1), 2); await beat(tok, 280); }
  say('每一輪：每一條邊都 relax', '例：5 條邊 e1～e5，一條都不漏');
  await step(tok);                                   // 13:02 Relax 的定義
  const rl = code(['Relax(u, v, w):', '  if d[v] > d[u] + w(u, v):', '    d[v] = d[u] + w(u, v)', '    π[v] = u'], 3.6, -4.3, 0.5);
  rl.hl(1);
  g.talk('relax 長這樣');
  say('Relax：d(v) > d(u) + w(u, v) 嗎？', '有更短的路才動手');
  await step(tok);                                   // 13:19 設 d(v)、π(v) = u
  rl.hl(2); await beat(tok, 600); rl.hl(3);
  say('是的話：更新 d(v)', '也設 π(v) = u');
  await step(tok);                                   // 13:48 沒有負 cycle → |V| − 1 輪後正確
  rl.hl(-1); cd.hl(2);
  for (let p = 2; p <= 3; p++) { tag('第 ' + p + ' 輪', 'idx', -5.4, 0.3, zOf(p)); for (let k = 0; k < E; k++) { cube('e' + (k + 1), '#efe3c8', [0.9, 0.4, 0.7], -3.6 + k * 1.3, 0.2, zOf(p), 2); await beat(tok, 110); } }
  g.mood('happy'); g.talk('沒負 cycle 就對了');
  say('沒有負 cycle：|V| − 1 輪後 d = δ', '例：|V| = 4 → 3 輪（之後證明）');
  await step(tok);                                   // 14:23 多做一輪檢查
  cd.hl(5);
  tag('第 |V| 輪', 'ptr alt', -5.4, 0.3, zOf(4));
  for (let k = 0; k < E; k++) { cube('e' + (k + 1), C.pq, [0.9, 0.4, 0.7], -3.6 + k * 1.3, 0.2, zOf(4), 2); await beat(tok, 200); }
  g.mood('calm'); g.talk('再看一輪');
  say('再多做一輪：第 |V| 輪', '對每條邊再看一次');
  await step(tok);                                   // 14:45 只檢查能不能 relax
  cd.hl(6);
  say('只檢查、不更新', 'd(v) > d(u) + w 還成立嗎？');
  await step(tok);                                   // 15:02 report 負 cycle
  cd.hl(7);
  g.mood('wow'); g.talk('有負 cycle！');
  say('還能 relax → 回報負 cycle 存在', 'report 然後停下來');
  await step(tok);                                   // 15:11 前半計算、後半檢查
  cd.hl(-1);
  tag('計算', 'note', 2.2, 0.3, -2.8); tag('檢查', 'note', 2.2, 0.3, -1.0);
  g.mood('happy'); g.talk('放得進一塊黑板');
  say('前半是計算，後半是檢查', '程式短到一塊黑板寫得下');
  await step(tok);                                   // 15:42 i 用在哪？
  cd.hl(2);
  g.mood('calm'); g.talk('i 只是計數器');
  say('學生問：i 用在哪？', '只是計數器：確保做 |V| − 1 輪');
}]);

// 15:54 複雜度 O(VE)；E = O(V²) → O(V³)
FRAG.push(['spmit2-bf-cost', 'L17：Bellman-Ford 的複雜度', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // 15:54 複雜度多少？
  const g = s2Pal(5.4, 3.4, 0.6);
  g.mood('wow'); g.talk('要花多久？');
  say('複雜度是多少？', '用最好的資料結構');
  await step(tok);                                   // 16:10 學生：V·E + E
  const ans = tag('學生：V · E + E', 'say', -2.6, 0.3, -3.8);
  say('學生答：V·E + E', '老師：對，這就是複雜度');
  await step(tok);                                   // 16:34 主迴圈 V × E
  for (let p = 0; p < 4; p++) { for (let k = 0; k < 6; k++) cube('', '#efe3c8', [0.7, 0.35, 0.6], -5.2 + k * 0.85, 0.2, -2.6 + p * 0.9, 1.5); await beat(tok, 200); }
  tag('(V − 1) 輪 × E 條邊', 'ptr', -3.1, 0.3, 1.1);
  g.mood('calm'); g.talk('每格 = 一次 relax');
  say('主迴圈：(V − 1) 輪 × E 條邊', '= O(VE)');
  await step(tok);                                   // 16:44 用什麼結構都一樣
  const nb = tag('陣列、adjacency list 都行；不需要 priority queue', 'note', 2.2, 0.3, -3.8);
  kill(ans);
  say('用什麼結構都一樣', '不像 Dijkstra 需要 priority queue');
  await step(tok);                                   // 17:05 檢查輪：O(E)
  kill(nb);
  for (let k = 0; k < 6; k++) cube('', C.pq, [0.7, 0.35, 0.6], -5.2 + k * 0.85, 0.2, 2.2, 1.5);
  tag('檢查：E', 'ptr alt', -3.1, 0.3, 3.1);
  say('檢查輪只掃一次所有邊', 'O(E)');
  await step(tok);                                   // 17:09 總共 O(VE)
  const tot = tag('總共：O(VE)', 'note', 2.6, 0.3, -3.8);
  g.mood('happy'); g.talk('O(VE)');
  say('總共 O(VE)', '計算 O(VE) + 檢查 O(E)');
  await step(tok);                                   // 17:15 E = O(V²) → O(V³)
  txt(tot, '簡單圖：E = O(V²) → O(V³)');
  g.mood('wow'); g.talk('V³！');
  say('簡單圖的 E 可以到 O(V²)', 'Bellman-Ford → O(V³)');
  await step(tok);                                   // 17:30 實務上比 Dijkstra 慢很多
  const dj = s2Bar('Dijkstra ≈ 線性', C.ok, 0.8, 2.6, 0.8, 1.0);
  s2Bar('Bellman-Ford O(VE)', '#dd8238', 4.5, 5.0, 0.8, 1.0);
  say('實務上 Bellman-Ford 慢很多', 'Dijkstra 可以接近線性');
  await step(tok);                                   // 17:52 能用 Dijkstra 就用
  glow(dj, GOLD);
  g.mood('calm'); g.talk('能用 Dijkstra 就用');
  say('能用 Dijkstra 就用 Dijkstra', '可能有負 cycle 時，只好用 Bellman-Ford');
}]);

// 18:02 定理與推論；k ≤ |V| − 1
FRAG.push(['spmit2-bf-theorem', 'L17：Bellman-Ford 的定理與推論', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // 18:03 為什麼會對？要證兩件事
  const g = s2Pal(-5.4, 3.4, 0.6);
  g.mood('wow'); g.talk('像魔術？');
  const two = tag('要證：① 沒負 cycle → 算對　② 有負 cycle → 抓得到', 'note', 0, 0.3, -4.2);
  say('為什麼會對？要證兩件事', '算得對，也偵測得到');
  await step(tok);                                   // 18:39 定理
  kill(two);
  const th = tag('定理：沒有負 cycle → 結束後 d(v) = δ(s, v)', 'ptr', 0, 0.3, -4.2);
  g.mood('calm'); g.talk('定理');
  say('定理：G 沒有負權重 cycle', '結束後所有 v：d(v) = δ(s, v)');
  await step(tok);                                   // 19:38 推論
  const co = tag('推論：|V| − 1 輪後 d(v) 還在變 → 有負 cycle', 'ptr alt', 0, 0.3, -3.3);
  g.talk('推論');
  say('推論：|V| − 1 輪後還沒收斂', '→ 存在從 s 走得到的負 cycle');
  await step(tok);                                   // 20:53 要記住的圖：s 到 v 的路徑
  buildGraph(S2G.path5, { dz: 0.6 });
  s2Path([0, 1, 2, 3, 4], C.tree, 2);
  say('證明要記住這張圖', '從 s 到 v 的一條最短路徑');
  await step(tok);                                   // 21:21 s = v0、v = vk
  nodeNote(0, 's = v0'); nodeNote(4, 'v = vk');
  g.talk('v0 … vk');
  say('路徑 p = v0, v1, …, vk', 's = v0，v = vk');
  await step(tok);                                   // 21:35 k 最大多少？
  g.mood('wow'); g.talk('k 最大多少？');
  say('最壞情況 k 多大？', 'k = 路徑上的邊數');
  await step(tok);                                   // 21:58 |V| − 1
  const kk = tag('k ≤ |V| − 1', 'pkt', 0, 0.3, 2.4);
  g.mood('calm'); g.talk('|V| − 1');
  say('答案：|V| − 1', 'k 條邊的路徑有 k + 1 個頂點');
  await step(tok);                                   // 22:03 k 更大 → 重複頂點 → cycle
  const e = addEdge(GR, 4, 2, null, 0.45);
  edgeColor(e, C.back, 2.2); nodeColor(2, C.back, 0.4);
  g.mood('wow'); g.talk('又回到 v2？');
  say('k > |V| − 1 一定重複走到某個點', '重複頂點 = 有 cycle，不是簡單路徑');
  await step(tok);                                   // 22:28 有負 cycle 時最短路徑不一定簡單
  say('有負 cycle 就麻煩了', '可以繞 cycle 很多次，最短路徑不再是簡單路徑');
  await step(tok);                                   // 22:58 證定理時假設沒有負 cycle
  edgeColor(e, C.dim, 1); nodeColor(2, C.white, 0);
  txt(kk, '沒負 cycle → 簡單路徑 → k ≤ |V| − 1');
  g.mood('happy'); g.talk('記住這張圖');
  say('證定理時：假設沒有負 cycle', '最短路徑是簡單的 → k ≤ |V| − 1');
  void th; void co;
}]);

// 23:28 歸納：第 i 輪結束時 d(v_i) = δ(s, v_i)
FRAG.push(['spmit2-bf-induction', 'L17：證明——每一輪前進一個頂點', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // 23:28 用歸納法
  const g = s2Pal(-5.6, 3.2, 0.6);
  g.talk('用歸納法！');
  const top = tag('證明方法：歸納法（induction）', 'note', 0, 0.3, -3.8);
  say('用歸納法證明定理', '一步一步推進');
  await step(tok);                                   // 23:51 任取 v；路徑 v0 … vk
  buildGraph(S2G.ind);
  const d = [0, INF, INF, INF, INF], par = [-1, -1, -1, -1, -1];
  nodeNote(0, 's'); nodeNote(4, 'v');
  s2Path([0, 1, 2, 3, 4], C.tree, 1.8);
  say('任取一個頂點 v', '看 s = v0 到 v = vk 的路徑（權重示意）');
  await step(tok);                                   // 24:12 邊數最少的最短路徑
  txt(top, 'p = 邊數最少的那條最短路徑');
  say('p：最短路徑中「邊數最少」的那條', 'δ：0, 2, 3, 6, 7');
  await step(tok);                                   // 24:38 可能不唯一：選邊少的
  g.talk('4 條邊 vs 3 條邊？');
  say('最短路徑可能不只一條', '一樣短時，選邊數少的（例：3 條勝過 4 條）');
  await step(tok);                                   // 24:59 沒負 cycle → 簡單 → k ≤ |V| − 1
  txt(top, '沒負 cycle → p 簡單 → k ≤ |V| − 1');
  g.talk('k ≤ 4');
  say('沒有負 cycle → p 是簡單路徑', '所以 k ≤ |V| − 1');
  await step(tok);                                   // 25:30 每一輪都 relax 所有的邊
  s2Path([0, 1, 2, 3, 4], C.edge, 1);
  for (let v = 0; v < 5; v++) nodeTag(v, fmt(d[v]));
  const ord = [[3, 4], [2, 4], [2, 3], [1, 3], [1, 2], [0, 2], [0, 1]];
  tag('故意用最差的順序：從尾巴往前', 'idx', 0, 0.3, 3.4);
  for (const e of GR.edges) edgeColor(e, C.hot, 1.6);
  await beat(tok, 700);
  for (const e of GR.edges) edgeColor(e, C.edge, 1);
  g.talk('沒得選：全部 relax');
  say('每一輪都 relax 每一條邊', '沒有任何選擇');
  await step(tok);                                   // 25:59 第一輪一定 relax 到 (v0, v1)
  edgeColor(s2E(0, 1), C.hot, 2.4);
  await g.go(tok, -5.6, 1.4, 600);
  g.talk('一定會碰到 v0→v1');
  say('第一輪裡，某個時刻一定 relax (v0, v1)', '因為每條邊都會 relax');
  await step(tok);                                   // 26:10 optimal substructure
  edgeColor(s2E(0, 1), C.tree, 2.2);
  say('optimal substructure', '最短路徑的一段，也是最短路徑');
  await step(tok);                                   // 26:35 frontier 每輪前進一格
  const pk = tag('第 1 輪', 'pkt', s2At(0).x, 1, s2At(0).z);
  for (let i = 1; i < 5; i++) { await travel(tok, pk, s2At(i - 1), s2At(i), 420); txt(pk, '第 ' + (i + 1) + ' 輪'); }
  kill(pk); edgeColor(s2E(0, 1), C.edge, 1);
  g.mood('happy'); g.talk('一輪前進一格');
  say('第 1 輪到 v1、第 2 輪到 v2 …', 'frontier 每輪前進一個頂點');
  await step(tok);                                   // 26:55 第 1 輪後 d(v1) = δ(s, v1)
  const pt = tag('第 1 輪', 'ptr alt', 0, 0.3, 2.6);
  g.mood('calm'); g.talk('真的跑一次');
  await s2Pass(tok, d, par, ord, 120);
  nodeColor(1, C.ok, 0.3); edgeColor(s2E(0, 1), C.tree, 2);
  say('第 1 輪後：d(v1) = δ(s, v1) = 2', 'v2 暫時是 5，還不是最短，沒關係');
  await step(tok);                                   // 27:25 理由：一定 relax (v0, v1)，不可能更短
  edgeColor(s2E(0, 1), C.hot, 2.4);
  say('理由：這輪一定 relax 過 (v0, v1)', '若還有更短的，就跟 p 是最短路徑矛盾');
  await step(tok);                                   // 28:18 第 2 輪後 d(v2)
  edgeColor(s2E(0, 1), C.tree, 2);
  txt(pt, '第 2 輪');
  await s2Pass(tok, d, par, ord, 120);
  nodeColor(2, C.ok, 0.3); edgeColor(s2E(1, 2), C.tree, 2);
  say('第 2 輪 relax (v1, v2)', 'd(v2) = δ(s, v2) = 3');
  await step(tok);                                   // 29:00 k 輪後 d(vk)
  for (let p = 3; p <= 4; p++) { txt(pt, '第 ' + p + ' 輪'); await s2Pass(tok, d, par, ord, 70); nodeColor(p, C.ok, 0.3); edgeColor(s2E(p - 1, p), C.tree, 2); }
  say('以此類推：k 輪後 d(vk) = δ(s, vk)', 'd(v3) = 6、d(v4) = 7');
  await step(tok);                                   // 29:16 |V| − 1 輪 → 全部正確
  g.mood('happy'); g.talk('全部到齊！'); await g.hop(tok);
  say('做滿 |V| − 1 輪', '所有走得到的頂點都有正確的 δ');
  await step(tok);                                   // 29:51 比 Dijkstra 的證明簡單
  txt(top, '兩塊黑板就寫完：比 Dijkstra 的證明簡單');
  say('證明到此結束', '比 Dijkstra 的證明簡單多了');
}]);

// 30:21 推論的證明：多一輪還能 relax → 路徑有重複頂點 → 負 cycle
FRAG.push(['spmit2-bf-corollary', 'L17：還能 relax 就有負 cycle', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // 30:21 推論：沿用定理的論證
  buildGraph(S2G.loop);
  const d = [0, INF, INF, INF], par = [-1, -1, -1, -1];
  for (let v = 0; v < 4; v++) nodeTag(v, fmt(d[v]));
  const g = s2Pal(-5.4, 3.2, 0.6);
  g.talk('換證推論');
  const pt = tag('邊的順序：s→a、a→b、b→c、c→a', 'idx', 0.4, 0.3, 4.5);
  say('接著證推論：負 cycle 抓得到', '沿用定理的論證（圖是示意）');
  await step(tok);                                   // 30:52 先做完 |V| − 1 輪
  const ord = [[0, 1], [1, 2], [2, 3], [3, 1]];
  for (let p = 1; p <= 3; p++) { txt(pt, '第 ' + p + ' 輪'); await s2Pass(tok, d, par, ord, 75); }
  say('先做完 |V| − 1 = 3 輪', '3 輪後：a −2、b 0、c 1');
  await step(tok);                                   // 31:11 還找得到能 relax 的邊
  txt(pt, '檢查輪');
  edgeColor(s2E(1, 2), C.back, 2.4); nodeColor(2, C.back, 0.4);
  g.mood('wow'); g.talk('還能變小？！');
  say('檢查輪：a→b 還能 relax', 'd(b) = 0 > d(a) + 1 = −1');
  await step(tok);                                   // 31:23 最佳路徑不是簡單路徑
  for (const [v, p] of [[2, 1], [1, 3], [3, 2]]) { nodeNote(v, 'π = ' + nm(p)); await beat(tok, 450); }
  say('沿 π 往回：b ← a ← c ← b', '頂點 b 重複 → 不是簡單路徑');
  await step(tok);                                   // 32:07 重複頂點 = cycle
  s2Path([1, 2, 3, 1], C.back, 2.4);
  g.talk('繞了一圈');
  say('重複的頂點 = 找到一個 cycle', 'a → b → c → a');
  await step(tok);                                   // 32:14 而且是負的
  const pk = await s2Walk(tok, '1 + 1 − 3 = −1', [1, 2, 3, 1], 380);
  g.mood('sad'); g.talk('負 cycle！');
  say('加上它反而更短 → 這個 cycle 一定是負的', '1 + 1 − 3 = −1 < 0');
  await step(tok);                                   // 32:43 演算法並不聰明
  kill(pk);
  g.mood('calm'); g.talk('其實很笨');
  say('Bellman-Ford 並不聰明', '只是固定次數地 relax 所有邊');
  await step(tok);                                   // 33:10 = 通用演算法 + 終止條件
  txt(pt, '做了 |V| − 1 輪還沒完 → 有負 cycle，可以停');
  g.mood('happy'); g.talk('會停下來了');
  say('像通用演算法加上終止條件', '做了一定輪數還沒結束 → 有負 cycle，停');
}]);

// 33:50 學生提問：2、3、−1 的例子，每輪都照同樣順序 relax 全部的邊
FRAG.push(['spmit2-bf-qa-order', 'L17：2、3、−1 的例子逐輪執行', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // 33:50 學生：樹上有負邊會不會誤判？
  const g = s2Pal(5.2, 3.2, 0.6, '同學', '#8fc7e8');
  g.mood('wow'); g.talk('樹上有負邊呢？');
  say('學生問：樹上有一條負邊', '多 relax 一次會不會被當成 cycle？');
  await step(tok);                                   // 34:28 2、3、−1 的例子
  buildGraph(S2G.qa);
  say('老師畫一個例子', '三條邊：2、3、−1（接法是重建的）');
  await step(tok);                                   // 34:54 每輪同樣順序 ①②③
  const lab1 = [tag('①', 'pkt', 2.2, 0.6, -2.3), tag('②', 'pkt', -2.3, 0.6, -1.5), tag('③', 'pkt', 0.5, 0.6, 0.6)];
  g.mood('calm'); g.talk('每輪同一個順序');
  say('relax 順序：①、②、③', '每一輪都用同樣的順序');
  await step(tok);                                   // 35:11 初始：S 0，其他 ∞
  const d = [0, INF, INF, INF];
  for (let v = 0; v < 4; v++) nodeTag(v, fmt(d[v]));
  const pt = tag('第 1 輪', 'ptr alt', -4.6, 0.3, 3.2);
  say('一開始：S = 0，其他都是 ∞', '');
  await step(tok);                                   // 35:19 ① 什麼都沒發生
  edgeColor(s2E(1, 2), C.hot, 2.2);
  say('① A→B：A 還是 ∞', '∞ − 1 還是 ∞ → 不變');
  await step(tok);                                   // 35:22 ② A = 2
  edgeColor(s2E(1, 2), C.edge, 1); edgeColor(s2E(0, 1), C.tree, 2.2);
  d[1] = 2; nodeTag(1, '2', 'ptr alt');
  say('② S→A：0 + 2 = 2', 'A 變成 2');
  await step(tok);                                   // 35:27 ③ 起點是 ∞，沒變
  edgeColor(s2E(3, 1), C.hot, 2.2);
  say('③ C→A：C 是 ∞', '不變（A 已經是 2 了）');
  await step(tok);                                   // 35:34 第 1 輪結束：0、2、∞、∞
  edgeColor(s2E(3, 1), C.edge, 1);
  nodeColor(3, C.dim, 0);
  say('第 1 輪結束：S 0、A 2、B ∞、C ∞', 'C 從 S 走不到，會一直是 ∞');
  await step(tok);                                   // 35:47 第 2 輪：又從 ① 開始
  txt(pt, '第 2 輪');
  edgeColor(s2E(1, 2), C.hot, 2.2);
  say('第 2 輪：照順序，又從 ① 開始', '');
  await step(tok);                                   // 35:55 2 − 1 = 1
  const pk = await s2Walk(tok, '2 − 1 = 1', [1, 2], 600);
  d[2] = 1; nodeTag(2, '1', 'ptr alt'); edgeColor(s2E(1, 2), C.tree, 2.2);
  say('① A→B：2 − 1 = 1', 'B 變成 1');
  await step(tok);                                   // 36:01 ② ③ 都沒變
  kill(pk);
  for (const [u, v] of [[0, 1], [3, 1]]) { edgeColor(s2E(u, v), C.hot, 2.2); await beat(tok, 500); edgeColor(s2E(u, v), u === 0 ? C.tree : C.edge, u === 0 ? 2.2 : 1); }
  say('② ③：什麼都沒變', '');
  await step(tok);                                   // 36:08 第 3 輪：沒變
  txt(pt, '第 3 輪');
  for (const [u, v] of [[1, 2], [0, 1], [3, 1]]) { edgeColor(s2E(u, v), C.hot, 2.2); await beat(tok, 300); edgeColor(s2E(u, v), u === 3 ? C.edge : C.tree, u === 3 ? 1 : 2.2); }
  say('4 個頂點 → 還有第 3 輪', '這一輪什麼都沒變');
  await step(tok);                                   // 36:17 結果：A 2、B 1
  g.mood('happy'); g.talk('A = 2、B = 1');
  say('結果：A = 2、B = 1', '樹上的負邊不會被誤當成 cycle');
  await step(tok);                                   // 36:25 每一輪 relax「所有」的邊
  lab1.forEach(kill);
  say('重點：每一輪都 relax 所有的邊', '講義有更複雜的例子');
}]);

// 36:49 只偵測從 s 走得到的負 cycle；權重範圍的演算法
FRAG.push(['spmit2-bf-unreachable', 'L17：走不到的負 cycle 偵測不到', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // 36:49 一般情況沒有更好的演算法
  const g = s2Pal(5.4, 3.4, 0.6);
  g.talk('沒有更快的了');
  const t1 = tag('一般情況（可能有負 cycle）：沒有已知更好的演算法', 'note', 0, 0.3, -3.8);
  say('有沒有更快的？', '一般情況：沒有已知更好的演算法');
  await step(tok);                                   // 36:53 假設權重範圍的演算法
  const t2 = tag('假設權重範圍 W：複雜度含 V、E、W，不好比', 'idx', 0, 0.3, -3.0);
  say('有些演算法假設權重在某個範圍', '複雜度多了 W，跟 O(VE) 不好直接比');
  await step(tok);                                   // 37:19 DAG 等特例可以更快
  const t3 = tag('特例（例如 DAG）可以更快', 'idx', 0, 0.3, -2.2);
  say('特殊情況可以更快', '例如 DAG');
  await step(tok);                                   // 37:36 學生：負 cycle 在不相連的地方？
  kill(t1); kill(t2); kill(t3);
  buildGraph(S2G.unr);
  nodeColor(0, C.pq, 0.3);
  s2Path([1, 2, 3, 1], C.back, 2);
  const q = s2Pal(-5.4, 3.0, 0.55, '同學', '#8fc7e8');
  q.mood('wow'); q.talk('那這個 cycle 呢？');
  say('學生：負 cycle 在另一塊、不相連呢？', 'x → y → z：1 + 1 − 3 = −1');
  await step(tok);                                   // 38:02 只有 Initialize 跟 s 有關
  const d = [0, INF, INF, INF];
  for (let v = 0; v < 4; v++) nodeTag(v, fmt(d[v]));
  say('只有 Initialize 跟 s 有關', 'd(s) = 0，其他 ∞');
  await step(tok);                                   // 38:12 其餘只是 relax 邊
  for (const [u, v] of [[1, 2], [2, 3], [3, 1]]) { const e = s2E(u, v); edgeColor(e, C.hot, 2.4); await beat(tok, 550); edgeColor(e, C.back, 2); }
  g.talk('∞ + w 還是 ∞');
  say('其餘步驟只是 relax 邊', '∞ + w 還是 ∞：cycle 上什麼都沒變');
  await step(tok);                                   // 38:39 s 沒有出邊 → 偵測不到
  q.mood('calm'); q.talk('原來如此');
  tag('只偵測得到「s 走得到」的負 cycle', 'note', 0, 0.3, -3.8);
  say('s 沒有出邊：演算法很 trivial', '走不到的負 cycle 偵測不到');
}]);

// 39:14 longest path：把權重變負再跑 Bellman-Ford？
FRAG.push(['spmit2-longest-negate', 'L17：取負號求 longest path 行不行', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // 39:14 shortest vs longest（複雜度預告）
  const g = s2Pal(-5.4, 3.4, 0.6);
  const pv = tag('預告：多項式時間 vs 指數時間', 'note', 0, 0.3, -3.8);
  g.talk('最長路徑呢？');
  say('shortest path 和 longest path', '一個月後複雜度課的預告');
  await step(tok);                                   // 39:53 想找 longest path，權重都是正的
  txt(pv, '問題：所有邊權重 > 0，找最長路徑');
  say('想找圖上的最長路徑', '假設所有邊權重都是正的');
  await step(tok);                                   // 40:12 全部取負號，跑 Bellman-Ford？
  g.mood('wow'); g.talk('取負號？');
  say('全部權重取負號，再跑 Bellman-Ford？', '會得到最長路徑嗎？');
  await step(tok);                                   // 40:57 例子 s、v1、v2、v3
  kill(pv);
  buildGraph(S2G.lng);
  g.mood('calm'); g.talk('先看一個例子');
  say('例子：s、v1、v2、v3', '權重都是正的（示意）');
  await step(tok);                                   // 41:08 最長 6
  s2Path([0, 1, 2, 3], C.hot, 2.2); nodeTag(3, '最長 6');
  say('到 v3 最長：1 + 2 + 3 = 6', '走三段');
  await step(tok);                                   // 41:18 最短 4
  s2Path([0, 1, 2, 3], C.edge, 1); s2Path([0, 3], C.tree, 2.2); nodeTag(3, '最短 4');
  say('到 v3 最短：直接走，4', '');
  await step(tok);                                   // 41:23 看起來有對偶性
  s2Path([0, 1, 2, 3], C.hot, 2.2); nodeTag(3, '最長 6／最短 4');
  say('最短和最長好像是一體兩面', '有種對偶性');
  await step(tok);                                   // 41:37 取負號後跑 Bellman-Ford
  s2Path([0, 1, 2, 3], C.edge, 1); s2Path([0, 3], C.edge, 1); nodeTag(3, '');
  for (const e of GR.edges) setW(e, -e.w);
  g.talk('全部變負的');
  say('每條邊取負號', '再跑 Bellman-Ford');
  await step(tok);                                   // 42:05 學生覺得可以
  s2Path([0, 1, 2, 3], C.ok, 2.2); nodeTag(3, 'd = −6 → 最長 6');
  say('這張圖跑出 −6', '取負回來 = 6，好像可以？');
  await step(tok);                                   // 42:33 老師：undefined？
  g.mood('wow'); g.talk('undefined？');
  say('老師先說：會回 undefined', '因為有負 cycle…？');
  await step(tok);                                   // 42:43 補一條邊
  s2Path([0, 1, 2, 3], C.edge, 1); nodeTag(3, '');
  const e = addEdge(GR, 3, 1, -1, 0.3);
  edgeColor(e, C.hot, 2);
  g.talk('少畫一條邊');
  say('老師發現自己的圖沒有 cycle', '補一條 v3 → v1（示意）');
  await step(tok);                                   // 43:10 重來：這是一個 cycle
  s2Path([1, 2, 3, 1], C.back, 2.4);
  g.mood('calm'); g.talk('這下有 cycle 了');
  say('重來：v1 → v2 → v3 → v1', '現在真的是 cycle');
  await step(tok);                                   // 43:27 取負號後是負 cycle
  const pk = await s2Walk(tok, '−2 − 3 − 1 = −6', [1, 2, 3, 1], 380);
  say('取負號後：−2 − 3 − 1 = −6 < 0', '負權重 cycle！');
  await step(tok);                                   // 43:37 這招一般行不通
  kill(pk);
  g.mood('sad'); g.talk('只會 abort');
  say('Bellman-Ford 只會 abort', '正 cycle 一取負就變負 cycle：這招一般不行');
}]);

// 43:55 有負 cycle 時求「最短簡單路徑」是 NP-hard
FRAG.push(['spmit2-simple-path-np', 'L17：最短簡單路徑是 NP-hard', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // 43:55 沒負 cycle 時給的是最短簡單路徑
  const g = s2Pal(-5.4, 3.6, 0.55);
  const t = tag('沒有負 cycle：Bellman-Ford 給「最短簡單路徑」（≤ |V| − 1 條邊）', 'note', 0, 0.3, -4.2);
  g.talk('更細的觀察');
  say('更細一點看', '沒負 cycle 時，它給的是最短「簡單」路徑');
  await step(tok);                                   // 44:49 另一張有負 cycle 的圖
  kill(t);
  buildGraph(S2G.np, { ns: 0.85 });
  say('換一張圖：裡面有負 cycle', '求 s 到 v 的最短簡單路徑');
  await step(tok);                                   // 45:01 2、3、−6
  s2Path([2, 6, 7, 2], C.back, 2);
  g.mood('wow'); g.talk('2 + 3 − 6 = −1');
  say('b 上掛著 cycle：2、3、−6', '2 + 3 − 6 = −1 → 負 cycle');
  await step(tok);                                   // 45:11 要 s 到 v 的最短簡單路徑
  nodeColor(0, C.pq, 0.3); nodeColor(5, C.purple, 0.3);
  g.mood('calm'); g.talk('s → v，不繞圈');
  say('想要 s 到 v 的最短簡單路徑', '簡單 = 不重複頂點、不繞圈');
  await step(tok);                                   // 45:27 水平那條：13
  const acc = [3, 5, 8, 11, 13];
  for (let i = 0; i < 5; i++) { edgeColor(s2E(i, i + 1), C.tree, 2.2); nodeTag(i + 1, String(acc[i])); await beat(tok, 420); }
  say('水平那條：3 + 2 + 3 + 3 + 2 = 13', '最短簡單路徑 = 13');
  await step(tok);                                   // 45:48 Bellman-Ford 給不出來：abort
  nodeTag(5, 'undefined', 'ptr alt');
  g.mood('sad'); g.talk('它只會 abort');
  say('Bellman-Ford 會告訴你 13 嗎？', '不會：它會 abort');
  await step(tok);                                   // 45:57 到 v 之前可能經過負 cycle
  const pk = await s2Walk(tok, '繞一圈 −1', [2, 6, 7, 2], 350);
  say('v 走得到，但途中可以繞負 cycle', '所以 δ(s, v) 是 undefined');
  await step(tok);                                   // 46:14 NP-hard
  kill(pk);
  const a = tag('要最短簡單路徑：NP-hard', 'ptr alt', 2.6, 0.3, 3.4);
  g.mood('wow'); g.talk('NP-hard！');
  say('有負 cycle 時求最短簡單路徑：NP-hard', '目前只知道指數時間的演算法');
  await step(tok);                                   // 47:00 只改一點點，就從多項式變難題
  say('只把問題改一點點', '就離開多項式時間的世界了');
  await step(tok);                                   // 47:15 跟 longest path 一樣難
  tag('= longest path 一樣難', 'idx', 2.6, 0.3, 4.3);
  say('跟 longest path 一樣難', '會解一個就會解另一個');
  await step(tok);                                   // 47:29 允許 abort → O(VE)
  tag('允許 abort：O(VE)', 'ptr', -2.6, 0.3, 3.4);
  g.mood('calm'); g.talk('允許 abort 就簡單');
  say('原本的問題允許遇到負 cycle 就 abort', 'Bellman-Ford：O(VE)');
  await step(tok);                                   // 48:07 多要一點點 → 指數
  glow(GR.nodes[5].mesh, GOLD);
  void a;
  say('多要求一點點', 'O(VE) → 指數時間（就目前所知）');
}]);

// ══════════ R15 Shortest Paths ══════════
// 02:16 從 BFS 出發：沒有權重時的 levels
FRAG.push(['spmit2-r15-bfs-levels', 'R15：沒有權重就用 BFS', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // 2:16 題目：V、E，權重正整數 ≤ W
  const g = s2Pal(5.6, 3.0, 0.6);
  g.talk('自己造一個！');
  const t = tag('V 個點、E 條邊；權重是正整數、≤ W', 'note', 0, 0.3, -4.2);
  say('題目：一張圖，邊上有權重', '權重是正整數，而且不超過 W');
  await step(tok);                                   // 2:44 暴力法：列舉所有路徑
  const bf = tag('暴力法：列出所有路徑 → 太慢', 'idx', 0, 0.3, -3.4);
  g.mood('sad'); g.talk('全部列出來？');
  say('暴力法：列出所有路徑', '來找好一點的方法');
  await step(tok);                                   // 3:02 課堂提過 Dijkstra、Bellman-Ford，但先假裝不會
  const k1 = tag('Dijkstra ✗', 'ptr alt', -2, 0.3, -2.6), k2 = tag('Bellman-Ford ✗', 'ptr alt', 2, 0.3, -2.6);
  g.mood('calm'); g.talk('先假裝不會');
  say('課堂提過 Dijkstra、Bellman-Ford', '但還沒教內容：先當作不會');
  await step(tok);                                   // 3:29 簡化：沒有權重
  kill(t); kill(bf); kill(k1); kill(k2);
  buildGraph({ directed: false, names: S2G.r15.names, pos: S2G.r15.pos, edges: S2G.r15.edges.map(([u, v]) => [u, v]) }, { dx: -0.4, dz: -0.8 });
  say('先簡化：所有邊一樣長', '沒有權重的圖');
  await step(tok);                                   // 3:58 A 到 E → BFS
  nodeColor(0, C.pq, 0.3); nodeColor(4, C.purple, 0.3);
  g.mood('happy'); g.talk('BFS！');
  say('A 到 E 的最短路徑？', '用 BFS（廣度優先搜尋）');
  await step(tok);                                   // 4:39 BFS 跟 DFS 的差別
  nodeColor(0, C.white, 0); nodeColor(4, C.white, 0);
  g.mood('calm'); g.talk('先走完所有鄰居');
  say('BFS 跟 DFS 差在哪？', 'BFS 先走完 A 的所有鄰居，才走鄰居的鄰居');
  await step(tok);                                   // 4:55 用 list 記下要拜訪的點；從 A 開始
  const q = makeStrip(-4.4, 3.9, 'list');
  const { lv, par, order } = s2Bfs(0);
  q.set([{ key: 'A', text: 'A' }]);
  nodeTag(0, 'L0'); nodeColor(0, C.pq, 0.3);
  say('用一個 list 記下要拜訪的點', '從 A 開始');
  const inQ = [0];
  const visit = (i) => {
    const u = order[i];
    nodeColor(u, C.ok, 0.3);
    const nw = order.filter((v) => par[v] === u);
    for (const v of nw) { inQ.push(v); nodeTag(v, 'L' + lv[v]); edgeColor(s2E(u, v), C.tree, 2); }
    q.set(inQ.slice(i + 1).map((v) => ({ key: nm(v), text: nm(v) })));
    return nw;
  };
  await step(tok);                                   // 5:02 取出 A：B、C 放到尾巴
  visit(0);
  say('取出 A：沒看過的鄰居放到尾巴', '加入 B、C');
  await step(tok);                                   // 5:13 取出 B：D、E
  visit(1);
  say('取出 B：鄰居 A、C、D、E', '沒看過的只有 D、E → 放進去');
  await step(tok);                                   // 5:32 C、D、E 的鄰居都看過了
  for (let i = 2; i < order.length; i++) { visit(i); await beat(tok, 450); }
  say('取出 C、D、E', '鄰居都看過了 → list 空了');
  await step(tok);                                   // 5:43 levels：半徑 1 的圈
  for (const v of [1, 2]) nodeColor(v, '#bfe3f5', 0.5);
  g.talk('一條邊就到');
  say('BFS 有 levels 的概念', '以 A 為圓心、半徑 1：一條邊就到的點');
  await step(tok);                                   // 5:57 半徑 2 的圈
  for (const v of [3, 4]) nodeColor(v, '#f6e2b8', 0.5);
  g.talk('兩條邊才到');
  say('半徑 2：兩條邊才到的點', '');
  await step(tok);                                   // 6:10 0, 1, 1, 2, 2
  q.set(order.map((v) => ({ key: nm(v), text: nm(v) + ' ' + lv[v] })));
  say('levels：0, 1, 1, 2, 2', 'A 是 level 0');
  await step(tok);                                   // 6:21 加一個 F：從 D 發現，level 3
  const F = cube('F', C.white, [0.7, 0.5, 0.7], 4.0, 0.25, 3.0, 3);
  const r = s2Rod(1.8, 1.0, 4.0, 3.0, C.tree);
  const fl = tag('L3', 'ptr', 4.0, 1.2, 3.0);
  g.mood('wow'); g.talk('F 從 D 來');
  say('在 D 旁加一個 F', '處理 D 時發現它：level 3');
  await step(tok);                                   // 6:34 level 只會遞增；parent 指向上一層
  for (const v of [1, 2, 3, 4]) nodeNote(v, 'π = ' + nm(par[v]));
  g.mood('calm'); g.talk('parent 在上一層');
  say('level 只會越來越大', 'parent 指標一定指向上一層的點');
  await step(tok);                                   // 6:47 BFS = 邊數最少的最短路徑
  kill(F); kill(r); kill(fl);
  s2Path(s2Back(par, 4), C.hot, 2.4);
  g.mood('happy'); g.talk('A → B → E');
  say('BFS 給的是「邊數最少」的最短路徑', '例：A → B → E，2 條邊');
}]);

// 07:01 加權：直接把鄰居照權重排進 queue 會出錯
FRAG.push(['spmit2-r15-naive-queue', 'R15：鄰居照權重排序，為什麼不夠', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // 7:01 沒有權重 → BFS；有權重怎麼辦？
  buildGraph(S2G.r15, { dx: -0.4, dz: -0.8 });
  const g = s2Pal(5.6, 3.0, 0.6);
  g.mood('wow'); g.talk('有權重了…');
  say('沒有權重：BFS 就能算', '可是現在有權重，怎麼辦？');
  await step(tok);                                   // 7:12 希望 BFS 走短邊比較快
  edgeColor(s2E(0, 2), C.ok, 2.2); edgeColor(s2E(0, 1), C.back, 2.2);
  g.mood('calm'); g.talk('短的先過');
  say('直覺：讓 BFS 走短邊比長邊快', 'A–C（2）應該比 A–B（4）先');
  await step(tok);                                   // 7:36 學生：排序 → 這就是 Dijkstra
  edgeColor(s2E(0, 2), C.edge, 1); edgeColor(s2E(0, 1), C.edge, 1);
  const s = s2Pal(-5.6, 3.0, 0.55, '同學', '#8fc7e8');
  s.talk('排序！'); s.mood('happy');
  say('學生：照距離排序', '老師：恭喜，你發現了 Dijkstra（講課再談）');
  await step(tok);                                   // 8:12 取出 A：C 2、B 4
  const q = makeStrip(-4.4, 3.9, 'list');
  nodeColor(0, C.ok, 0.3);
  edgeColor(s2E(0, 2), C.hot, 2); edgeColor(s2E(0, 1), C.hot, 2);
  nodeTag(2, '2'); nodeTag(1, '4');
  say('先看看這樣會怎樣：取出 A', '鄰居 C 距離 2、B 距離 4');
  await step(tok);                                   // 9:09 C 先進 list
  q.set([{ key: 'C', text: 'C 2' }, { key: 'B', text: 'B 4' }]);
  nodeNote(2, 'π = A'); nodeNote(1, 'π = A');
  say('照距離排：C 先、B 後', '兩個都放進 list');
  await step(tok);                                   // 9:26 放進去那一刻就輸了：A→C→B = 3
  s2Path([0, 2, 1], C.tree, 2.4);
  const pk = await s2Walk(tok, '2 + 1 = 3', [0, 2, 1], 500);
  g.mood('sad'); g.talk('B 其實是 3');
  say('一放進去就輸了', 'A → C → B = 2 + 1 = 3 < 4');
  await step(tok);                                   // 9:38 parent 指標已經是壞的
  kill(pk);
  edgeColor(s2E(0, 1), C.back, 2.4);
  nodeNote(1, 'π = A ✗');
  say('B 的 parent 已經設成 A', '記下一條壞的路徑');
  await step(tok);                                   // 9:58 要修好就是 Dijkstra；今天找更簡單的
  s.mood('calm'); s.talk('');
  g.mood('calm'); g.talk('找更簡單的');
  say('要修好它，就會變成 Dijkstra', '今天想要更簡單的辦法');
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
  await step(tok);                                   // 10:30 提示一
  buildGraph(S2G.r15, { dx: -0.4, dz: -0.8 });
  edgeColor(s2E(0, 2), C.ok, 2.2); edgeColor(s2E(0, 1), C.back, 2.2);
  const g = s2Pal(5.6, 3.0, 0.6);
  g.talk('提示一');
  say('提示一：想讓 BFS 走這條比那條快', 'A–C 快、A–B 慢');
  await step(tok);                                   // 10:36 提示二：可以改圖
  g.mood('wow'); g.talk('可以改圖！');
  say('提示二：可以改圖', '演算法不動，動輸入');
  await step(tok);                                   // 11:27 BFS 要邊沒有權重；BFS 改不動
  g.mood('calm'); g.talk('BFS 不能改');
  say('BFS 要所有邊一樣長', 'BFS 本身改不動');
  await step(tok);                                   // 11:41 學生：建假節點
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  buildGraph(s2SplitGraph(), { dx: -0.4, dz: -0.8, ns: 0.8 });
  for (let i = 5; i < GR.n; i++) { GR.nodes[i].mesh.scale.set(0.45, 1, 0.45); GR.nodes[i].mesh.material.color.set(C.dim); }
  const s = s2Pal(-5.6, 3.2, 0.55, '同學', '#8fc7e8');
  s.mood('happy'); s.talk('加假節點？');
  const g2 = s2Pal(5.6, 3.0, 0.6);
  g2.mood('happy'); g2.talk('好主意');
  say('學生：建立假節點（dummy nodes）', '把長的邊切成很多小段');
  await step(tok);                                   // 12:07 4 → 四段 1，2 → 兩段
  s2Path([0, 5, 6, 7, 1], C.hot, 2); s2Path([0, 8, 2], C.ok, 2);
  say('原本 4 的邊 → 四條長度 1 的邊', '原本 2 的邊 → 兩條');
  await step(tok);                                   // 12:20 權重 c → c 條邊；BFS 走 c 步
  s2Path([0, 5, 6, 7, 1], C.edge, 1); s2Path([0, 8, 2], C.edge, 1);
  const pk = await s2Walk(tok, '1 步', [0, 5, 6, 7, 1], 280);
  kill(pk);
  say('權重 c 的邊 → c 條邊', 'BFS 要走 c 步才通過');
  await step(tok);                                   // 12:30 所有邊一樣長 → BFS 能解
  const { lv, par } = s2Bfs(0);
  const mx = Math.max(...lv);
  for (let L = 0; L <= mx; L++) {
    for (let v = 0; v < GR.n; v++) if (lv[v] === L) { if (v < 5) { nodeColor(v, C.ok, 0.3); nodeTag(v, nm(v) + '：' + L); } else GR.nodes[v].mesh.material.color.set(C.ok); if (par[v] >= 0) edgeColor(s2E(par[v], v), C.tree, 1.8); }
    await beat(tok, 330);
  }
  g2.talk('交給 BFS');
  say('所有邊一樣長 → BFS 會解', '一層一層往外擴');
  await step(tok);                                   // 12:49 B 從 C 那邊先到：3
  s2Path(s2Back(par, 1), C.hot, 2.4);
  g2.mood('wow'); g2.talk('B 是 3！');
  say('B 會先從 C 那邊到', '距離 3，比直接走的 4 早');
}]);

// 13:09 reduction：transform → 已知演算法（黑盒）→ interpret
FRAG.push(['spmit2-r15-reduction', 'R15：轉換 → 黑盒 → 解讀', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const box = (t, col, x, z) => cube(t, col, [2.6, 0.6, 1.1], x, 0.3, z, 3);
  await step(tok);                                   // 13:11 真實生活會做的事
  const g = s2Pal(-5.4, 3.6, 0.6);
  g.talk('超重要！');
  say('這一步很重要', '真實生活裡你會這樣做');
  await step(tok);                                   // 13:21 自己改 Dijkstra：要重證，容易錯
  const w = tag('自己改 Dijkstra → 正確性、時間都要重證 ✗', 'note', 0, 0.3, 3.0);
  g.mood('sad'); g.talk('改演算法好累');
  say('發明新演算法？機會很小', '改 Dijkstra 要重證，費時又容易錯');
  await step(tok);                                   // 13:39 原問題的原始輸入
  kill(w);
  box('原始輸入：加權圖', '#efe3c8', -4.2, -2.6);
  g.mood('calm'); g.talk('原始輸入');
  say('原問題的原始輸入', '白板上那張加權圖');
  await step(tok);                                   // 13:48 transform
  box('新輸入：單位邊', '#efe3c8', 0, -2.6);
  arrow(V3(-2.8, 0.4, -2.6), V3(-1.4, 0.4, -2.6));
  tag('transform', 'idx', -2.1, 0.3, -1.6);
  say('做一個 transform（轉換）', '得到已知演算法吃得下的輸入');
  await step(tok);                                   // 14:19 轉換很好寫：拆邊、塞假節點
  tag('拆邊、塞假節點', 'note', -2.1, 0.3, -0.9);
  say('這裡的 transform 很好寫', '把邊拆開，塞假節點');
  await step(tok);                                   // 14:24 已知演算法當黑盒
  box('BFS（黑盒）', C.pq, 4.2, -2.6);
  arrow(V3(1.4, 0.4, -2.6), V3(2.8, 0.4, -2.6));
  g.mood('happy'); g.talk('不用再證！');
  say('已知演算法當黑盒', '正確性、執行時間直接拿課本的');
  await step(tok);                                   // 14:54 BFS 回傳 A, 假, C, D, 假, E
  box('A, 假, C, D, 假, E', '#efe3c8', 4.2, 1.2);
  arrow(V3(4.2, 0.4, -1.9), V3(4.2, 0.4, 0.5));
  g.mood('calm'); g.talk('有假節點…');
  say('BFS 給出一條路徑', 'A, 假, C, D, 假, E');
  await step(tok);                                   // 15:11 出題的人看不懂假節點
  const who = s2Pal(5.6, 3.6, 0.55, '出題者', '#b9d98c');
  who.mood('wow'); who.talk('「假」是什麼？');
  say('交回去給出題的人', '他看不懂這些假節點');
  await step(tok);                                   // 15:19 interpret / read out
  box('A, C, D, E', C.ok, -1.6, 1.2);
  arrow(V3(2.8, 0.4, 1.2), V3(0, 0.4, 1.2));
  tag('interpret：拿掉假節點', 'idx', 1.4, 0.3, 2.2);
  who.mood('happy'); who.talk('看得懂了');
  say('interpret / read out', '拿掉假節點 → 原問題的答案');
  await step(tok);                                   // 15:43 最常用到 6.006 的方式
  g.mood('happy'); g.talk('轉換 → 黑盒 → 解讀'); await g.hop(tok);
  say('這是你最可能用到 6.006 的方式', '黑盒換成任何學過的演算法都行');
}]);

// 16:00 拆邊後的執行時間 vs Dijkstra
FRAG.push(['spmit2-r15-split-cost', 'R15：拆邊的代價', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // 16:00 少一步：整體的執行時間
  const g = s2Pal(5.6, 3.4, 0.6);
  g.talk('總共多快？');
  say('還少一步：整體的執行時間', '新圖有幾個點、幾條邊？');
  await step(tok);                                   // 16:33 原圖：V′、E′、W′
  tag("原圖：V′ 點、E′ 邊、權重 ≤ W′", 'note', 0, 0.3, -4.4);
  say("原圖：V′ 個點、E′ 條邊", "權重最大 W′");
  await step(tok);                                   // 16:52 邊數 ≤ W′E′
  const a = tag("新圖邊數 ≤ W′E′", 'ptr', -3, 0.3, -3.5);
  say('每條邊權重 ≤ W′ → 最多拆成 W′ 段', "邊數 ≤ W′E′");
  await step(tok);                                   // 17:16 點數 ≤ V′ + W′E′
  const b = tag("新圖點數 ≤ V′ + W′E′", 'ptr', 3, 0.3, -3.5);
  g.talk('別忘了原本的點');
  say("點數 ≤ W′E′ + V′", '別忘了原本的點還在');
  await step(tok);                                   // 17:25 BFS：O(V′ + W′E′)
  const c = tag("BFS：O(V′ + W′E′)", 'ptr alt', 0, 0.3, -2.6);
  say('BFS 是 O(V + E)', "代進去 → O(V′ + W′E′)");
  await step(tok);                                   // 17:50 Dijkstra 的時間？
  g.mood('wow'); g.talk('Dijkstra 呢？');
  say('跟 Dijkstra 比比看', 'Dijkstra 的執行時間是？');
  await step(tok);                                   // 18:10 V log V + E，要很花俏的 Heap
  const t1 = tag('理論：O(V log V + E)（要花俏的 Heap）', 'idx', 0, 0.3, -1.8);
  say('理論上 O(V log V + E)', '要用很花俏的 Heap 資料結構');
  await step(tok);                                   // 18:30 實務 E log V
  txt(t1, '實務：O(E log V)（binary Heap）');
  s2Bar('BFS 拆邊：W′E′', C.ok, 1.6, -2, 0.6, 1.1);
  s2Bar('Dijkstra：E′ log V′', '#4b9ee2', 1.6, 2, 0.6, 1.1);
  g.mood('calm'); g.talk('實務版');
  say('實務上比較像 O(E log V)', '拿這個來比');
  await step(tok);                                   // 19:02 W′ ≤ log V′ 就不輸
  g.mood('happy'); g.talk('W′ 小就不輸');
  say("比較 W′E′ 和 E′ log V′", "W′ ≤ log V′ 時不比 Dijkstra 差");
  await step(tok);                                   // 19:25 沒發明新東西
  void a; void b; void c;
  await g.hop(tok);
  say('權重小的圖：有了自己的最短路徑演算法', '沒發明新東西，也不用證明');
}]);

// 20:09 Tim 與 Jim：Tim 開第一段和最後一段 → 奇數條邊
FRAG.push(['spmit2-r15-tim-jim', 'R15：兄弟輪流開車 = 奇數條邊', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // 20:09 現在 Dijkstra、BF 可以當黑盒
  const k = tag('現在可以用：Dijkstra、Bellman-Ford（黑盒）', 'note', 0, 0.3, -4.4);
  say('第二題：任意圖', '現在可以把 Dijkstra、Bellman-Ford 當黑盒');
  await step(tok);                                   // 20:43 抄權重 4, 2, 1, 2
  buildGraph(S2G.r15, { dx: -0.4, dz: -0.8 });
  say('同一張圖，抄上權重', '4、2、1、2 …（部分是示意）');
  await step(tok);                                   // 20:55 公路網、兩兄弟
  kill(k);
  const tim = s2Pal(-5.6, 2.6, 0.55, 'Tim', '#f4a56a'), jim = s2Pal(-4.2, 3.4, 0.55, 'Jim', '#8fc7e8');
  tim.mood('happy'); jim.mood('happy');
  say('像 Google Maps 的公路網', '兩兄弟一起開車出遊');
  await step(tok);                                   // 21:10 每過一段就換人
  tim.talk('換你開'); jim.talk('好');
  say('為了公平：每過一段路就換人開', '');
  await step(tok);                                   // 21:16 Tim 和 Jim；去年的小考題
  tim.talk(''); jim.talk('');
  const quiz = tag('去年小考題', 'note', 0, 0.3, -4.4);
  say('兄弟叫 Tim 和 Jim', '這是去年的真實小考題');
  await step(tok);                                   // 21:40 Tim 方向感比較好
  tim.mood('happy'); tim.talk('交給我'); jim.mood('sad');
  say('Tim 的方向感比 Jim 好很多', '');
  await step(tok);                                   // 21:50 出城、進城最難
  tim.talk('');
  nodeNote(0, '出城 😵'); nodeNote(4, '進城 😵');
  say('長途開車最難的：出城上公路、下公路進城', '中間的路很輕鬆');
  await step(tok);                                   // 22:07 第一段、最後一段都要 Tim
  tim.talk('頭尾都我開');
  say('所以第一段、最後一段都要 Tim 開', '不然會出車禍');
  await step(tok);                                   // 22:56 圖的語言：s 到 t
  nodeNote(0, 's'); nodeNote(4, 't'); tim.talk('');
  nodeColor(0, C.pq, 0.3); nodeColor(4, C.purple, 0.3);
  say('換成圖的語言', '從 s 走到 t');
  await step(tok);                                   // 23:20 邊數為奇數的最短路徑
  kill(quiz);
  tag('要的是：邊數為奇數的最短路徑', 'note', 0, 0.3, -4.4);
  say('要找「邊數是奇數」的最短路徑', '為什麼是奇數？');
  await step(tok);                                   // 23:30 Tim, Jim, Tim…
  const lbl = [];
  const path = [0, 2, 3, 4], who = ['Tim', 'Jim', 'Tim'];
  for (let i = 0; i < 3; i++) {
    edgeColor(s2E(path[i], path[i + 1]), C.tree, 2.2);
    const p = GR.nodes[path[i]].home, q2 = GR.nodes[path[i + 1]].home;
    lbl.push(tag(who[i], i === 1 ? 'idx' : 'ptr alt', (p.x + q2.x) / 2, 0.9, (p.z + q2.z) / 2 + 0.5));
    await beat(tok, 600);
  }
  say('Tim、Jim、Tim …一定以 Tim 結尾', '名字個數是奇數 → 邊數是奇數');
  await step(tok);                                   // 24:11 Tim 開 3 段、Jim 開 2 段沒關係
  jim.mood('calm');
  say('Tim 多開一段沒關係', 'Tim 3 段、Jim 2 段也行');
  await step(tok);                                   // 24:44 長度 2？Tim 不能連開兩段
  s2Path(path, C.edge, 1); lbl.forEach(kill);
  edgeColor(s2E(0, 1), C.back, 2.2); edgeColor(s2E(1, 4), C.back, 2.2);
  tag('Tim', 'ptr alt', -3.6, 0.9, -1.6); tag('Jim ✗', 'idx', 1.7, 0.9, -1.6);
  tim.mood('wow'); tim.talk('要換人！');
  say('A → B → E 只有 2 條：Jim 收尾 ✗', '每段都要換人，Tim 不能連開兩段');
}]);

// 25:09 列舉路徑不可行：菱形串 → 指數多條
FRAG.push(['spmit2-r15-diamonds', 'R15：菱形串有指數多條路徑', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const g = s2Pal(-5.6, 3.6, 0.55, '同學', '#8fc7e8');
  await step(tok);                                   // 25:09 學生：列出所有路徑，去掉偶數的
  g.mood('happy'); g.talk('全部列出來？');
  say('學生想法：列出所有路徑', '留下奇數條邊的，再挑最便宜的');
  await step(tok);                                   // 25:37 也有人說列出所有最短路徑
  g.talk('列出所有最短路徑？');
  say('也有人說：列出所有最短路徑', '兩種想法一起檢查');
  await step(tok);                                   // 25:53 菱形串，邊長都是 1
  const nm3 = ['s', '', '', '', '', '', '', '', '', 't'];
  const pos = [[-5.4, 0], [-4, -1.6], [-4, 1.6], [-2.6, 0], [-1.2, -1.6], [-1.2, 1.6], [0.2, 0], [1.6, -1.6], [1.6, 1.6], [3, 0]];
  const edges = [];
  for (let k = 0; k < 3; k++) { const m = 3 * k; edges.push([m, m + 1], [m, m + 2], [m + 1, m + 3], [m + 2, m + 3]); }
  buildGraph({ directed: true, names: nm3, pos, edges }, { dx: 0.8, ns: 0.8 });
  g.talk('');
  say('看這張圖：s 到 t 一串菱形', '每條邊都是 1');
  await step(tok);                                   // 25:57 有幾種走法？
  const cnt = tag('0 條', 'pkt', 0.8, 0.3, 3.0);
  for (let m = 0; m < 8; m++) {
    const vs = [0];
    for (let k = 0; k < 3; k++) vs.push(3 * k + ((m >> k) & 1 ? 2 : 1), 3 * k + 3);
    s2Path(vs, C.hot, 2.2); txt(cnt, (m + 1) + ' 條');
    await beat(tok, 270);
    s2Path(vs, C.edge, 1);
  }
  say('s 到 t 有幾種走法？', '一條一條數');
  await step(tok);                                   // 26:08 2 × 2 × 2 = 8
  txt(cnt, '2 × 2 × 2 = 8 條');
  say('每個菱形 2 種走法', '2 × 2 × 2 = 8');
  await step(tok);                                   // 26:17 再加一個菱形
  txt(cnt, '再加一個菱形 → 16 條');
  g.mood('wow'); g.talk('翻倍了！');
  say('再加一個菱形？', '路徑數翻倍：16');
  await step(tok);                                   // 26:49 ≈ 2 的頂點數次方
  txt(cnt, '≈ 2^(頂點數 / 3)：指數');
  say('路徑數大約是 2 的（頂點數）次方', '對頂點數是指數');
  await step(tok);                                   // 27:00 列不完
  g.mood('sad'); g.talk('列不完…');
  say('不可能全部列出來', '在小考上自己才發現就太晚了');
  await step(tok);                                   // 27:21 跟講課的「亂序 relax」不同
  g.mood('calm'); g.talk('圖本身就太多');
  say('跟講課「亂序 relax」不一樣', '這是圖本身就有指數多條路徑，演算法再好也列不完');
}]);

function s2ParityGraph() {
  const b = S2G.r15, names = [], pos = [], edges = [];
  b.names.forEach((n, i) => { names.push(n + 'ₑ'); pos.push([b.pos[i][0] * 0.9, b.pos[i][1] * 0.55 - 2.7]); });
  b.names.forEach((n, i) => { names.push(n + 'ₒ'); pos.push([b.pos[i][0] * 0.9, b.pos[i][1] * 0.55 + 2.7]); });
  for (const [u, v, w] of b.edges) edges.push([u, v + 5, w], [u + 5, v, w]);
  return { directed: false, names, pos, edges };
}
// 28:04 缺少的 state（奇偶）→ 每個點複製 even / odd 兩份；params.part = 2：接邊、起點 Aₑ、終點 Eₒ
FRAG.push(['spmit2-r15-parity', 'R15：用 even / odd 兩層記住奇偶', async (tok) => {
  const part = (ctx.params || {}).part === 2 ? 2 : 1;
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  if (part === 1) {
    await step(tok);                                 // 28:06 先轉換再跑；難的是 transform
    const g = s2Pal(5.6, 3.4, 0.6);
    g.talk('難在轉換');
    const t = tag('transform → 跑演算法 → read off（難的是 transform）', 'note', 0, 0.3, -4.4);
    say('要先把圖轉換，再跑演算法', '難的是 transform，不是讀答案');
    await step(tok);                                 // 28:33 記住 state：像 Rubik 方塊
    txt(t, 'Rubik 方塊：一個 state = 一個頂點');
    g.mood('wow'); g.talk('記住 state！');
    say('提示：要記住 state', '像 Rubik 方塊：一個狀態一個點');
    await step(tok);                                 // 28:49 不知道是奇數還是偶數
    kill(t);
    buildGraph(S2G.r15, { dx: -0.4, dz: -0.8 });
    g.mood('calm'); g.talk('奇？偶？');
    say('演算法告訴你最短距離', '卻不知道用了奇數還是偶數條邊');
    await step(tok);                                 // 29:03 缺少的 state：奇偶
    tag('缺少的 state：走到這裡的邊數是奇是偶', 'note', 0, 0.3, -4.4);
    say('缺少的 state', '走到這裡的路徑，長度是奇數還是偶數');
    await step(tok);                                 // 29:31 B 可能 1 條、也可能 2 條
    edgeColor(s2E(0, 1), C.hot, 2.2); nodeTag(1, '1 條邊');
    await beat(tok, 1000);
    edgeColor(s2E(0, 1), C.edge, 1); s2Path([0, 2, 1], C.hot, 2.2); nodeTag(1, '或 2 條邊');
    say('例：到 B 可以 1 條邊', '也可以走 A → C → B，2 條邊');
    await step(tok);                                 // 31:00 每個點複製一份來記 state
    fresh([0, 12.5, 8], [0, 0, -0.3]);
    buildGraph({ ...s2ParityGraph(), edges: [] }, { ns: 0.85 });
    const g2 = s2Pal(5.9, 0, 0.55);
    g2.talk('每點兩份');
    say('每個點複製一份，用來記 state', '一個點變兩個點');
    await step(tok);                                 // 31:10 奇數路徑 / 偶數路徑
    tag('even 層', 'ptr', -5.9, 0.3, -2.7); tag('odd 層', 'ptr alt', -5.9, 0.3, 2.7);
    say('兩份分別代表', '「偶數條邊到這」和「奇數條邊到這」');
    await step(tok);                                 // 31:27 A even、A odd … E
    for (let i = 0; i < 5; i++) { nodeColor(i, '#cfe0f5', 0.2); nodeColor(i + 5, '#f6e2b8', 0.2); await beat(tok, 300); }
    say('A → Aₑ、Aₒ；B → Bₑ、Bₒ …', 'ₑ = even（偶），ₒ = odd（奇）');
    return;
  }
  await step(tok);                                   // 32:08 偶數到 A，走 A–B → 奇數到 B
  buildGraph(s2ParityGraph(), { ns: 0.85 });
  tag('even 層', 'ptr', -5.9, 0.3, -2.7); tag('odd 層', 'ptr alt', -5.9, 0.3, 2.7);
  for (const e of GR.edges) edgeColor(e, C.dim, 1);
  for (let i = 0; i < 5; i++) { nodeColor(i, '#cfe0f5', 0); nodeColor(i + 5, '#f6e2b8', 0); }
  edgeColor(s2E(0, 6), C.hot, 2.2);
  const g = s2Pal(5.9, 0, 0.55);
  g.talk('偶 + 1 = 奇');
  say('用偶數條邊到 A，再走 A–B（4）', '就是奇數條邊到 B：Aₑ – Bₒ');
  await step(tok);                                   // 32:41 奇數到 A → 偶數到 B
  edgeColor(s2E(5, 1), C.hot, 2.2);
  g.talk('奇 + 1 = 偶');
  say('用奇數條邊到 A，到 B 就是偶數', 'Aₒ – Bₑ，權重一樣是 4');
  await step(tok);                                   // 32:58 B–E 也一樣
  edgeColor(s2E(1, 9), C.hot, 2.2); edgeColor(s2E(6, 4), C.hot, 2.2);
  say('B–E 也一樣', 'Bₑ – Eₒ、Bₒ – Eₑ');
  await step(tok);                                   // 33:33 A–C
  edgeColor(s2E(0, 7), C.hot, 2.2); edgeColor(s2E(5, 2), C.hot, 2.2);
  say('A–C：Aₑ – Cₒ、Aₒ – Cₑ', '權重照抄原本的 2');
  await step(tok);                                   // 33:49 所有邊都這樣接
  for (const e of GR.edges) edgeColor(e, C.edge, 1);
  g.mood('wow'); g.talk('好亂…');
  say('所有邊都這樣接', '每條原邊 → 兩條跨層的邊');
  await step(tok);                                   // 34:05 2D 看 3D：兩張紙疊起來
  [cube('', '#cfe0f5', [11.5, 0.05, 2.6], 0, 0.02, -2.7), cube('', '#f6e2b8', [11.5, 0.05, 2.6], 0, 0.02, 2.7)];
  g.mood('calm'); g.talk('其實是 3D');
  say('看起來亂，是因為把 3D 壓成 2D', 'even 一張紙、odd 一張紙，第三維 = state');
  await step(tok);                                   // 35:17 走一條公路 = 切換 even / odd
  const pk = tag('切換', 'pkt', s2At(0).x, 1, s2At(0).z);
  await travel(tok, pk, s2At(0), s2At(6), 800); await travel(tok, pk, s2At(6), s2At(4), 800);
  kill(pk);
  say('每走一條公路', '就在 even 與 odd 之間切換一次');
  await step(tok);                                   // 35:37 從哪裡開始、到哪裡結束？
  g.mood('wow'); g.talk('起點？終點？');
  say('從哪個點出發？到哪個點結束？', '');
  await step(tok);                                   // 36:07 Aₑ → Eₒ
  nodeColor(0, C.ok, 0.4); nodeColor(9, C.purple, 0.4);
  g.mood('happy'); g.talk('Aₑ → Eₒ');
  say('起點 Aₑ：長度 0 是偶數', '終點 Eₒ：要奇數條邊');
  await step(tok);                                   // 36:24 路徑自動交替
  const { par, d } = s2Dij(0);
  const p = s2Back(par, 9);
  s2Path(p, C.tree, 2.4);
  say(p.map(nm).join(' → ') + '：' + d[9], '路徑自動在兩層之間交替，記住了奇偶');
}]);

// 36:41 新圖大小與選哪個黑盒
FRAG.push(['spmit2-r15-parity-cost', 'R15：兩層圖的執行時間', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // 36:41 頂點：2V
  const g = s2Pal(5.6, 3.4, 0.6);
  s2Bar('V', '#cfe0f5', 1.0, -4.6, -1.6); s2Bar('2V', '#cfe0f5', 2.0, -3.2, -1.6);
  g.talk('多大？');
  say('新圖有幾個頂點？', '每個複製兩份：V → 2V');
  await step(tok);                                   // 36:55 邊：2E
  s2Bar('E', '#f6e2b8', 1.2, -1.2, -1.6); s2Bar('2E', '#f6e2b8', 2.4, 0.2, -1.6);
  say('邊：每條剛好複製兩次', 'E → 2E');
  await step(tok);                                   // 37:18 有權重，BFS 不行
  cube('BFS ✗：有權重', '#e8d8d0', [2.6, 0.5, 0.9], 3.8, 0.25, -3.0, 3);
  say('用哪個演算法？BFS 不行', '邊有權重');
  await step(tok);                                   // 37:42 哪個黑盒快？Dijkstra
  const dj = cube('Dijkstra（較快）', C.ok, [2.6, 0.5, 0.9], 3.8, 0.25, -1.6, 3);
  cube('Bellman-Ford', '#dd8238', [2.6, 0.5, 0.9], 3.8, 0.25, -0.2, 3);
  g.mood('happy'); g.talk('Dijkstra 快');
  say('兩個黑盒，哪個快？', 'Dijkstra 比較快');
  await step(tok);                                   // 37:56 有負權重才換 Bellman-Ford
  g.mood('calm'); g.talk('有負的才用 BF');
  say('什麼時候不能用 Dijkstra？', '有負權重：換成較慢的 Bellman-Ford');
  await step(tok);                                   // 38:25 開車時間都是正的 → Dijkstra
  glow(dj, GOLD);
  say('開車時間都是正的 → Dijkstra', 'O(V log V + E)，實務 O(E log V)');
  await step(tok);                                   // 38:47 跟原圖同一個量級
  tag('跟原圖同一個量級', 'ptr alt', -2.0, 0.3, 1.8);
  g.mood('happy'); await g.hop(tok);
  say('圖只變大常數倍', '執行時間跟原圖一樣');
}]);

// 39:27 難題：油耗固定、通過時間跟出發時刻有關
FRAG.push(['spmit2-r15-traffic-setup', 'R15：塞車路網：時間優先，再省油', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // 39:27 兩個目的：state 技巧 + 錯誤解法的直覺
  const g = s2Pal(-5.6, 3.6, 0.6);
  g.talk('先錯也沒關係');
  const t = tag('第一個想法通常是錯的：練習察覺、退回來', 'note', 0, 0.3, 3.2);
  say('這題想示範兩件事', '用複製頂點記 state；從錯誤解法培養直覺');
  await step(tok);                                   // 40:32 公路網，每條邊兩個數
  kill(t);
  const bo = cube('Boston', '#cfe0f5', [1.8, 0.6, 1.0], -4.4, 0.3, -2.8, 3), ny = cube('New York', '#f6e2b8', [1.8, 0.6, 1.0], 4.4, 0.3, -2.8, 3);
  arrow(V3(-3.4, 0.4, -2.8), V3(3.4, 0.4, -2.8));
  say('又是公路網，但更複雜', '每條邊有兩個數');
  await step(tok);                                   // 40:46 油耗固定
  tag('fc：油耗（固定，看路長）', 'ptr', 0, 0.3, -3.7);
  say('一個是油耗 fc', '由路的長度決定，固定不變');
  await step(tok);                                   // 40:57 會塞車：2am 3 小時、尖峰 6 小時
  const hrs = [3, 3, 4, 6, 4, 4, 6, 4];
  for (let i = 0; i < 8; i++) { s2Bar(String(i * 3) + '時', hrs[i] === 6 ? C.back : C.pq, hrs[i] * 0.35, -4.2 + i * 1.2, 0.8, 0.8); await beat(tok, 200); }
  g.mood('sad'); g.talk('塞車…');
  say('但會塞車', '凌晨 2 點 3 小時，尖峰 6 小時');
  await step(tok);                                   // 41:07 一天切成 m 分鐘
  tag('m = 3600 × 24 / 60 = 1440 分鐘', 'idx', 0, 0.3, 3.3);
  g.mood('calm'); g.talk('m = 1440');
  say('一天切成 m 分鐘', 'm = 3600 × 24 / 60 = 1440');
  await step(tok);                                   // 41:38 tc(t)：幾點出發就花多久
  tag('tc(t)：t 時出發，要開幾分鐘', 'ptr alt', 0, 0.3, -1.9);
  say('每條邊有時間函數 tc(t)', 't 時出發，要花幾分鐘才通過');
  await step(tok);                                   // 42:04 邊是有向的
  say('邊改成有向的', '進城、出城塞車程度不同');
  await step(tok);                                   // 43:07 目標 1：最快到達
  glow(ny, GOLD);
  g.talk('越早到越好');
  say('目標 1：最早到達目的地', '能 5 點到，就不要 5 點 01 分');
  await step(tok);                                   // 43:23 目標 2：同樣快，選最省油
  g.mood('happy'); g.talk('再來才省油');
  say('目標 2：同樣最早的走法中', '選最省油（最環保）的');
  await step(tok);                                   // 44:05 直接跑 Dijkstra？缺 state
  g.mood('wow'); g.talk('直接 Dijkstra？');
  say('直接跑 Dijkstra 不夠', '缺了重要的 state；路徑又可能指數多');
  await step(tok);                                   // 45:38 油耗當 state？不行
  g.mood('sad'); g.talk('油耗不是整數');
  say('把油耗當 state？不行', 'fc 不一定是整數，不知道要複製幾份');
  glow(bo, null);
}]);

// 46:10 時間當 state：(u, t) 複製 m 份，路的邊與等待的邊
FRAG.push(['spmit2-r15-time-expanded', 'R15：時間展開圖', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const T = 6, tc = [3, 3, 2, 1, 1], fc = 4;
  await step(tok);                                   // 46:15 學生：記下到達時間
  const s = s2Pal(-5.8, 3.6, 0.55, '同學', '#8fc7e8');
  s.mood('happy'); s.talk('記到達時間？');
  say('學生：在頂點記下「最快幾點到」', '時間會是好的 state 嗎？');
  await step(tok);                                   // 47:07 用時間當 state
  const g = s2Pal(5.8, 3.6, 0.6);
  g.mood('happy'); g.talk('時間當 state！');
  say('好主意：用時間當 state', '每個原頂點要複製幾份？');
  await step(tok);                                   // 47:32 每個頂點 m 份
  const names = [], pos = [];
  for (let t = 0; t < T; t++) { names.push('u' + t); pos.push([-5 + 2 * t, -2]); }
  for (let t = 0; t < T; t++) { names.push('v' + t); pos.push([-5 + 2 * t, 2]); }
  buildGraph({ directed: true, names, pos, edges: [] }, { ns: 0.85 });
  tag('時間 t →', 'idx', 0, 0.3, 3.4);
  say('「我在這個城市，現在幾分」= 一個點', '每個城市 m 份：(u, 0) … (u, m − 1)');
  await step(tok);                                   // 48:41 邊 u→v：(u, t) → (v, t + tc(t))
  const roads = [];
  for (let t = 0; t < 5; t++) if (t + tc[t] < T) { const e = addEdge(GR, t, T + t + tc[t], fc); roads.push(e); edgeColor(e, C.tree, 1.6); await beat(tok, 350); }
  say('一條路 u→v 變成 m 條邊', '(u, t) → (v, t + tc(t))（tc 是示意）');
  await step(tok);                                   // 49:47 還要一種邊：等待
  g.talk('先去吃個東西');
  say('還差一種邊', '塞車時可以先去吃點東西，晚點再開');
  await step(tok);                                   // 50:13 (u, t) → (u, t + 1)
  const waits = [];
  for (let t = 0; t + 1 < T; t++) waits.push(addEdge(GR, t, t + 1, 0), addEdge(GR, T + t, T + t + 1, 0));
  for (const e of waits) edgeColor(e, C.ok, 1.6);
  say('等待邊：(u, t) → (u, t + 1)', '在同一個城市多待一分鐘');
  await step(tok);                                   // 50:33 油耗：路 fc，等待 0
  for (const e of waits) edgeColor(e, C.edge, 1);
  say('權重 = 油耗', '公路邊都是 fc = 4（跟何時出發無關），等待邊 0');
  await step(tok);                                   // 51:02 m 張紙；Boston 8 點 → Amherst 一條邊
  edgeColor(roads[0], C.hot, 2.4);
  const pk = tag('出發', 'pkt', s2At(0).x, 1, s2At(0).z);
  await travel(tok, pk, s2At(0), s2At(T + 3), 900);
  txt(pk, '到了');
  say('想成 m 張紙疊起來', '例：8 點從 Boston 上 I-90，9 點多到 Amherst = 一條邊');
  await step(tok);                                   // 52:41 沒有等待邊就只能一直開
  kill(pk);
  edgeColor(roads[0], C.tree, 1.6);
  edgeColor(waits[0], C.hot, 2.4); edgeColor(waits[2], C.hot, 2.4); edgeColor(roads[2], C.hot, 2.4);
  g.mood('happy'); g.talk('等一下也行');
  say('沒有等待邊，就被迫一直開', '有了它：u0 → u1 → u2 等兩分鐘，再走到 v4');
}]);

// 53:16 大小、用 Dijkstra、讀答案：目的地的 m 個副本
FRAG.push(['spmit2-r15-read-answer', 'R15：時間展開圖怎麼讀答案', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // 53:16 邊數：E·m
  const g = s2Pal(5.8, 3.6, 0.6);
  const a = tag('頂點：V · m', 'ptr', -3.4, 0.3, -3.8);
  const b = tag('邊：E · m（路）', 'ptr', 2.4, 0.3, -3.8);
  say('算大小：頂點 V · m', '公路邊 E · m');
  await step(tok);                                   // 53:29 還有等待邊
  txt(b, '邊：E · m（路）+ 等待邊');
  say('別忘了等待邊', '');
  await step(tok);                                   // 53:48 丟進 Dijkstra
  const c = tag('油耗 ≥ 0 → Dijkstra', 'ptr alt', 0, 0.3, -2.9);
  g.mood('happy'); g.talk('Dijkstra！');
  say('權重是油耗、不是負的', '丟進 Dijkstra');
  await step(tok);                                   // 54:02 怎麼讀答案？終點的 m 個副本
  const vals = [INF, INF, INF, 12, 10, 10, 9];
  const cs = [];
  for (let t = 0; t < vals.length; t++) { cs.push(cube('?', C.white, [1.2, 0.5, 1.0], -4.8 + t * 1.6, 0.25, 0.4, 2)); tag('NY@' + (t + 1), 'idx', -4.8 + t * 1.6, 0.3, 1.4); await beat(tok, 200); }
  g.mood('calm'); g.talk('看終點');
  say('怎麼讀答案？', '看終點（New York）的 m 個副本');
  await step(tok);                                   // 54:14 太早：+∞
  for (let t = 0; t < 3; t++) { relabel(cs[t], '∞'); tint(cs[t], C.dim); }
  say('太早的時刻：+∞', '8 點出發，8:01 到不了 New York');
  await step(tok);                                   // 54:30 第一個有限值 = 最早到達、最少油
  relabel(cs[3], '12'); tint(cs[3], C.ok); glow(cs[3], GOLD);
  g.mood('happy'); g.talk('這就是答案');
  say('某個時刻開始變成有限值', '那就是最早到達；它的值 = 最少的油（數字示意）');
  await step(tok);                                   // 54:56 ∞, ∞, ∞ … 然後是答案
  say('所以看起來像：∞、∞、∞ … 答案', '第一個不是 ∞ 的格子');
  await step(tok);                                   // 55:14 晚一點到，油更省：取捨曲線
  for (let t = 4; t < 7; t++) { relabel(cs[t], String(vals[t])); tint(cs[t], '#bfe8d6'); }
  g.talk('晚點到更省油');
  say('願意晚 1 分鐘、1 小時到', '各能省多少油：整條取捨曲線');
  await step(tok);                                   // 55:50 等待邊為什麼是 V·m
  txt(b, '邊：E · m（路）+ V · m（等待）');
  g.mood('calm'); g.talk('每城每分一條');
  say('等待邊為什麼是 V · m？', '每個城市、每一分鐘都可以多待一分鐘');
  void a; void c;
}]);

// ══════════ R18 Quiz 2 Review ══════════
// 05:02 relax 的順序決定最後拿到哪一條路徑
FRAG.push(['spmit2-r18-relax-order', 'R18：relax 順序決定 parent', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const relax = (u, v, d, par) => {
    const e = s2E(u, v);
    if (d[u] + e.w < d[v]) { d[v] = d[u] + e.w; par[v] = u; nodeTag(v, String(d[v]), 'ptr alt'); nodeNote(v, 'π = ' + nm(u)); edgeColor(e, C.tree, 2.2); return true; }
    edgeColor(e, C.hot, 2.2); return false;
  };
  await step(tok);                                   // 5:02 都是正邊：選 Dijkstra
  const g = s2Pal(5.6, 3.4, 0.6);
  g.talk('選快的！');
  const t = tag('正權重：Dijkstra、Bellman-Ford 都能用 → 選較快的 Dijkstra', 'note', 0, 0.3, -4.2);
  say('邊都是正的：兩個都能用', '要選就選比較快的 Dijkstra');
  await step(tok);                                   // 5:25 兩者 relax 的順序不同
  txt(t, '兩者 relax 邊的順序不同');
  say('兩個演算法 relax 邊的順序不同', '這會有什麼影響？');
  await step(tok);                                   // 5:36 一個菱形，四條邊都是 1
  kill(t);
  buildGraph(S2G.dia);
  g.talk('記得菱形嗎？');
  say('還記得菱形串嗎？取一個菱形', 's、a、b、t，四條邊都是 1');
  await step(tok);                                   // 5:57 d(s) = 0，其他 ∞
  const d = [0, INF, INF, INF], par = [-1, -1, -1, -1];
  for (let v = 0; v < 4; v++) nodeTag(v, fmt(d[v]));
  say('從 s 出發：d(s) = 0', '其他一開始都是 ∞');
  await step(tok);                                   // 6:12 順序 1：s→a
  const lbl = tag('順序：s→a、a→t、s→b、b→t', 'idx', 0, 0.3, 3.8);
  relax(0, 1, d, par);
  g.talk('relax s→a');
  say('照 1、2、3、4 的順序：先 s→a', 'd(a) = 0 + 1 = 1，π(a) = s');
  await step(tok);                                   // 6:32 a→t
  relax(1, 3, d, par);
  say('再 relax a→t', 'd(t) = 2，π(t) = a');
  await step(tok);                                   // 6:44 s→b
  relax(0, 2, d, par);
  say('再 relax s→b', 'd(b) = 1，π(b) = s');
  await step(tok);                                   // 6:55 b→t：不變
  relax(2, 3, d, par);
  g.mood('calm'); g.talk('已經是 2 了');
  say('最後 b→t：1 + 1 = 2', 't 已經是 2 → 什麼都沒發生');
  await step(tok);                                   // 7:00 換個順序：下面兩條先
  edgeColor(s2E(2, 3), C.edge, 1);
  txt(lbl, '換順序：s→b、b→t、s→a、a→t ?');
  g.mood('wow'); g.talk('換個順序呢？');
  say('如果先做下面兩條？', '會拿到不同的路徑');
  await step(tok);                                   // 7:19 路徑怎麼算？沿 parent 往回
  const pk = await s2Walk(tok, 'π', [3, 1, 0], 600);
  say('路徑怎麼找？從 t 沿 parent 往回走', '這次：t → a → s');
  await step(tok);                                   // 7:35 另一個順序：π(t) = b
  kill(pk);
  const d2 = [0, INF, INF, INF], p2 = [-1, -1, -1, -1];
  for (let v = 0; v < 4; v++) { nodeTag(v, fmt(d2[v])); nodeNote(v, ''); }
  for (const e of GR.edges) edgeColor(e, C.edge, 1);
  for (const [u, v] of [[0, 2], [2, 3], [0, 1], [1, 3]]) { relax(u, v, d2, p2); await beat(tok, 450); }
  edgeColor(s2E(1, 3), C.edge, 1);
  say('換成另一個順序', 'π(t) = b：同樣長 2，另一條路徑');
  await step(tok);                                   // 7:40 Dijkstra、BF 都會；Dijkstra 看平手怎麼破
  g.mood('calm'); g.talk('看怎麼破平手');
  say('Dijkstra、Bellman-Ford 都會這樣', 'Dijkstra：priority queue 怎麼破平手');
  await step(tok);                                   // 7:52 relax 順序決定路徑
  g.mood('happy'); g.talk('順序決定路徑'); await g.hop(tok);
  say('relax 的順序決定你拿到哪條路徑', '距離一樣，parent 可能不同');
}]);

// 08:57 Newton：∛6006，f(x) = x³ − 6006，x0 = 1
FRAG.push(['spmit2-r18-newton-6006', 'R18：Newton 法求 ∛6006', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // 8:57 求 ∛6006
  const g = s2Pal(5.8, 3.6, 0.6);
  g.mood('sad'); g.talk('又是 numerics');
  const q = tag('求 ∛6006', 'note', 0, 0.3, -4.4);
  say('大家最愛的 numerics', '題目：求 ∛6006');
  await step(tok);                                   // 9:10 初始值 1，要之後兩個近似值
  txt(q, '求 ∛6006：x0 = 1，求 x1、x2');
  g.mood('calm');
  say('題目給初始近似值 1', '要接下來的兩個近似值');
  await step(tok);                                   // 9:45 f(x) = x³ − 6006
  const good = tag('f(x) = x³ − 6006', 'ptr alt', -3, 0.3, -3.4);
  g.talk('用哪個函數？');
  say('選 f(x) = x³ − 6006', '為什麼選它？');
  await step(tok);                                   // 9:52 理由一：答案處 f = 0
  tag('答案處 f = 0', 'idx', -3, 0.3, -2.7);
  say('理由一：在答案處 f = 0', 'Newton 法就是在找 f = 0 的地方');
  await step(tok);                                   // 10:08 理由二：Newton 要算的東西好算
  say('理由二：Newton 要算的東西好算', '要算什麼？看公式');
  await step(tok);                                   // 10:23 公式
  const f = tag('xᵢ₊₁ = xᵢ ＋ f(xᵢ) / f′(xᵢ) ?', 'ptr', 2.6, 0.3, -1.8);
  g.talk('抄在小抄上！');
  say('Newton 公式：從 xᵢ 算 xᵢ₊₁', '這條一定要寫在小抄上');
  await step(tok);                                   // 11:06 是減號
  txt(f, 'xᵢ₊₁ = xᵢ − f(xᵢ) / f′(xᵢ)');
  g.mood('wow'); g.talk('是減號！');
  say('是減號，不是加號', '公式抄錯，答案就錯');
  await step(tok);                                   // 11:29 換成 f(x) = x − ∛6006？
  const bad = tag('f(x) = x − ∛6006', 'idx', 3, 0.3, -3.4);
  g.mood('calm'); g.talk('這個也是 0？');
  say('換成 f(x) = x − ∛6006 呢？', '在答案處也是 0');
  await step(tok);                                   // 11:50 f / f′ 要先知道 ∛6006
  txt(bad, 'f / f′ = x − ∛6006 ✗');
  say('f / f′ = (x − ∛6006) / 1', '要先知道 ∛6006 才算得出來 → 沒用');
  await step(tok);                                   // 12:14 要好算的是 f / f′
  say('重點：f / f′ 要好算', '不只 f 好算（像除法那個怪函數，除完就變簡單）');
  await step(tok);                                   // 13:35 化簡：2x/3 + 2002/x²
  kill(bad);
  tag('x − (x³ − 6006) / 3x² = 2x/3 + 2002/x²', 'pkt', 0, 0.3, -0.8);
  say('代進公式、化簡', 'x − (x³ − 6006) / (3x²) = 2x/3 + 2002/x²');
  await step(tok);                                   // 14:01 x1 = 2002.67
  s2Bar('x0 = 1', C.pq, 0.15, -4.5, 1.0, 1.0);
  await beat(tok, 500);
  s2Bar('x1 = 2002.67', '#cfe0f5', 4.4, -2.3, 1.0, 1.0);
  g.mood('sad'); g.talk('離答案好遠');
  say('x1 = 2/3 + 2002 ≈ 2002.67', '離答案很遠（小數先別管）');
  await step(tok);                                   // 14:38 x2：把 x1 代回去
  s2Bar('x2 = 1335.11', '#cfe0f5', 3.0, -0.1, 1.0, 1.0);
  await beat(tok, 500);
  s2Bar('x3 = 890.08', '#cfe0f5', 2.0, 2.1, 1.0, 1.0);
  tag('… x₁₆ ≈ 18.18', 'ptr alt', 4.6, 0.3, 1.0);
  g.mood('calm'); g.talk('慢慢靠近');
  say('x2：把 x1 代回同一個式子', '一直代回去，越來越接近 18.18');
  void good;
}]);

// 15:06 初始值：x_i = x*(1 + ε_i)，ε 每步平方（quadratic convergence）
FRAG.push(['spmit2-r18-newton-guess', 'R18：quadratic convergence 與初始值', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // 15:06 初始值
  const g = s2Pal(5.8, 3.6, 0.6);
  g.talk('從 1 開始');
  say('來看初始值', '這題直接給了 x0 = 1');
  await step(tok);                                   // 15:10 1 是好的猜測嗎？
  g.mood('wow'); g.talk('1 好嗎？');
  say('1 是好的初始值嗎？', '學生：11.5 比較好');
  await step(tok);                                   // 15:31 Newton 保證什麼？
  g.mood('calm'); g.talk('爛初值也會到？');
  say('Newton 到底保證什麼？', '初值很爛時，也一定會得到答案嗎？');
  await step(tok);                                   // 15:46 不一定
  g.mood('sad'); g.talk('不一定！');
  say('不一定', '初值太差可能不收斂');
  await step(tok);                                   // 15:59 quadratic convergence
  tag('Newton 保證：quadratic convergence', 'note', 0, 0.3, -4.4);
  g.mood('calm'); g.talk('二次收斂');
  say('Newton 保證的是 quadratic convergence', '中文叫二次收斂');
  await step(tok);                                   // 16:15 x_i = x*(1 + ε_i)，誤差每步平方
  tag('x_i = x*(1 + ε_i)', 'ptr', -3, 0.3, -3.5);
  tag('εᵢ₊₁ ≈ εᵢ²', 'ptr alt', 3, 0.3, -3.5);
  const good = [0.5, 0.25, 0.0625, 0.0039];
  for (let i = 0; i < 4; i++) { s2Bar('ε' + i + ' = ' + good[i], C.ok, good[i] * 4, -5 + i * 1.5, -1.4, 0.8); await beat(tok, 400); }
  say('寫成 x_i = 真答案 × (1 + ε_i)', 'ε = 相對誤差，每一步平方：0.5 → 0.25 → 0.06…');
  await step(tok);                                   // 16:35 ε0 > 1 呢？
  const bad = [1.5, 2.25, 5.06];
  for (let i = 0; i < 3; i++) { s2Bar('ε' + i + ' = ' + bad[i], C.back, Math.min(5, bad[i] * 0.9), 1.4 + i * 1.6, -1.4, 0.8); await beat(tok, 400); }
  g.mood('sad'); g.talk('越來越大');
  say('如果 ε0 > 1？', '平方後越來越大，不會收斂');
  await step(tok);                                   // 16:53 需要 −1 < ε0 < 1
  tag('需要 −1 < ε0 < 1', 'pkt', 0, 0.3, 1.6);
  g.mood('calm'); g.talk('|ε0| < 1');
  say('最少需要：−1 < ε0 < 1', '誤差比答案本身小');
  await step(tok);                                   // 17:16 換成 x0：0 到 2 倍真答案
  s2Rod(-5, 3.0, 5, 3.0, C.edge);
  tag('0', 'idx', -5, 0.3, 3.6); tag('x*', 'ptr', 0, 0.3, 3.6); tag('2x*', 'idx', 5, 0.3, 3.6);
  cube('', C.ok, [10, 0.12, 0.3], 0, 0.36, 3.0);
  say('換成 x0 來說', 'x0 要在 0 和「2 倍真答案」之間');
  await step(tok);                                   // 17:42 粗糙但保證收斂
  g.mood('happy'); g.talk('至少會收斂'); await g.hop(tok);
  say('這是很粗糙的猜法', '能更好，但至少保證收斂');
}]);

// 18:08 integer land：b = 10、d = 2，∛2 → ⌊∛(2 · 10⁶)⌋ = 125 → 1.25
FRAG.push(['spmit2-r18-integer-land', 'R18：只用整數算 ∛2 到小數 d 位', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // 18:08 一般化：∛r
  const g = s2Pal(5.8, 3.6, 0.6);
  const q = tag('求 ∛r（r 是一個數）', 'note', 0, 0.3, -4.4);
  g.talk('計算機按一下？');
  say('一般化：求 ∛r', '∛6006 用計算機就有了，太簡單');
  await step(tok);                                   // 18:21 例如 ∛2，要寫成程式
  txt(q, '例：∛2，寫成程式');
  say('例如 ∛2', '而且要寫成程式');
  await step(tok);                                   // 18:39 需要初始值，還有呢？
  g.talk('還需要什麼？');
  say('第一件事？需要初始值', '還有呢？');
  await step(tok);                                   // 19:06 不喜歡小數
  const dg = ['1', '.', '2', '5', '9', '9'];
  const cs = dg.map((c, i) => cube(c, c === '.' ? C.pq : C.white, [0.8, 0.5, 0.8], -2.5 + i * 1.0, 0.25, -2.4, 2));
  g.mood('sad'); g.talk('小數點好麻煩');
  say('∛2 = 1.2599…，有小數', '要處理小數點，程式難寫');
  await step(tok);                                   // 19:32 只要某個精度
  g.mood('calm'); g.talk('搬到整數世界');
  say('我們只要某個精度就好', '把計算全部搬到整數的世界');
  await step(tok);                                   // 19:51 base b，d 位精度
  tag('base b = 10，d = 2 位', 'idx', 0, 0.3, -3.5);
  say('假設 base 是 b、要 d 位精度', '該算什麼？');
  await step(tok);                                   // 20:08 算 ∛2 × b^d
  tag('想要：∛2 × b^d', 'ptr', 0, 0.3, -1.4);
  say('學生：算 ∛2 × b^d', '');
  await step(tok);                                   // 20:28 b = 10、d = 2
  say('用熟悉的數字：b = 10、d = 2', '就是 ∛2 × 100');
  await step(tok);                                   // 21:10 乘 100：小數點右移兩格，還不是整數
  move(cs[1], -2.5 + 3 * 1.0, 0.25, -2.4); move(cs[2], -2.5 + 1 * 1.0, 0.25, -2.4); move(cs[3], -2.5 + 2 * 1.0, 0.25, -2.4);
  say('乘 100 = 小數點右移兩格', '125.99… 還不是整數');
  await step(tok);                                   // 21:37 希望得到 125，右移回來 = 1.25
  fly(cs[1]); fly(cs[4]); fly(cs[5]);
  const pt = cube('.', C.pq, [0.4, 0.5, 0.8], -1.95, 0.25, 1.0, 3);
  for (const [i, c] of [[0, '1'], [1, '2'], [2, '5']]) cube(c, '#bfe8d6', [0.8, 0.5, 0.8], i === 0 ? -2.5 : -1.4 + (i - 1) * 1.0, 0.25, 1.0, 3);
  g.mood('happy'); g.talk('1.25！');
  say('希望演算法回傳整數 125', '再除以 100（小數點左移兩格）→ 1.25：兩位精度');
  await step(tok);                                   // 22:28 整數演算法給的是 floor
  glow(pt, GOLD);
  tag('⌊∛2 · 100⌋ = 125', 'pkt', 0, 0.3, 2.3);
  g.mood('calm'); g.talk('取 floor');
  say('整數演算法給的不是精確值', '是 floor（無條件捨去）：⌊125.99…⌋ = 125');
  await step(tok);                                   // 22:50 每步取 floor 也會收斂
  say('每一步都取 floor', '有個漂亮的證明：Newton 還是會收斂');
  await step(tok);                                   // 23:06 b^d 放進根號 → b^{3d}
  tag('∛(2 · b³ᵈ) = ∛2 · bᵈ', 'ptr alt', 0, 0.3, 3.4);
  g.mood('wow'); g.talk('根號裡要 3d');
  say('b^d 要放進立方根裡', '要變成 b³ᵈ：算 ⌊∛(2 · 10⁶)⌋ = 125');
  await step(tok);                                   // 23:25 最後右移 d 位
  g.mood('happy'); g.talk('兩位精度');
  say('算完把小數點左移 d 位', '就得到 d 位精度的答案');
}]);

// 23:38 好的初始值：位數對、第一位用 binary search；何時停
FRAG.push(['spmit2-r18-first-digit', 'R18：好的初始值與停止條件', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // 23:38 初始值；還有執行時間
  const g = s2Pal(5.8, 3.6, 0.6);
  g.talk('先談初始值');
  say('還剩兩件事：初始值、執行時間', '先談初始值');
  await step(tok);                                   // 24:21 數量級要對
  const t = tag('好的初始值：數量級要對', 'note', 0, 0.3, -4.4);
  say('好的初始值：order of magnitude 要對', '');
  await step(tok);                                   // 24:36 = 位數要對
  txt(t, '數量級對 = 位數對');
  say('數量級對 = 位數對', '花俏一點的說法');
  await step(tok);                                   // 24:49 r 是一位數；答案約 d + 1 位
  tag('r 是 base b 的一位數（0 ≤ r < b）', 'idx', 0, 0.3, -3.6);
  say('假設 r 是 base b 的一位數', '∛(r · b³ᵈ) 大約 d + 1 位');
  await step(tok);                                   // 25:28 1 後面接 d 個 0
  const g0 = tag('初值：1 後面 d 個 0（d = 2 → 100）', 'ptr', 0, 0.3, -2.8);
  g.mood('happy'); g.talk('100');
  say('不錯的初值：1 後面接 d 個 0', 'd = 2 → 100');
  await step(tok);                                   // 25:33 更好：第一位也猜對
  g.mood('calm'); g.talk('第一位也對？');
  say('更好：連第一位數字也猜對', '怎麼做？');
  await step(tok);                                   // 26:17 binary search 0 到 r
  const cs = [0, 1, 2].map((v) => cube(String(v), C.white, [0.9, 0.5, 0.9], -2 + v * 2, 0.25, -0.8, 2));
  tag('r = 2', 'ptr alt', 4.4, 0.3, -0.8);
  say('在 0 到 r 之間 binary search', '例：r = 2');
  await step(tok);                                   // 26:31 比較 g 和 ∛r ⇔ 比較 g³ 和 r
  glow(cs[1], GOLD);
  const cmp = tag('g = 1：g³ = 1 ≤ 2', 'pkt', -0, 0.3, 0.6);
  say('猜 g：不能直接算 ∛r 來比', '改比 g³ 和 r：1³ = 1 ≤ 2');
  await step(tok);                                   // 26:49 g³ 只要兩次乘法
  glow(cs[1], null); glow(cs[2], GOLD); tint(cs[2], '#f3c9c0');
  txt(cmp, 'g = 2：g³ = 8 > 2 → 第一位是 1');
  tint(cs[1], C.ok);
  say('g³ 只要兩次乘法', '2³ = 8 > 2 → 第一位是 1');
  await step(tok);                                   // 27:54 x0, x1, x2 … 何時停？
  kill(g0);
  for (let i = 0; i < 4; i++) cube('x' + i, '#cfe0f5', [0.9, 0.5, 0.9], -3 + i * 1.6, 0.25, 2.4, 2);
  g.mood('wow'); g.talk('什麼時候停？');
  say('依序算 x0、x1、x2 …', '什麼時候停？');
  await step(tok);                                   // 28:10 相鄰兩個一樣就停
  tag('xᵢ = xᵢ₊₁ 就停', 'ptr alt', 0, 0.3, 3.4);
  g.mood('calm'); g.talk('一樣就停');
  say('某一個近似值和下一個一樣', '就停');
  await step(tok);                                   // 28:19 都是整數，之後永遠一樣
  g.mood('happy'); g.talk('收斂了');
  say('都是整數：一樣了之後永遠一樣', '代表 Newton 已經收斂到這個整數');
}]);

// 28:37 Newton log d 次 vs binary search O(d) 次
FRAG.push(['spmit2-r18-newton-vs-bs', 'R18：Newton 比 binary search 快在哪', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // 28:37 要做幾次近似？
  const g = s2Pal(5.8, 3.6, 0.6);
  g.talk('要猜幾次？');
  say('有多快？', '要做幾次近似？');
  await step(tok);                                   // 28:59 正確位數每次加倍 → log d
  const dd = [1, 2, 4, 8, 16, 32];
  for (let i = 0; i < 6; i++) { s2Bar(dd[i] + ' 位', C.ok, dd[i] * 0.13, -5.2 + i * 1.0, -2.2, 0.7); await beat(tok, 300); }
  tag('Newton：log d 次', 'ptr', -2.7, 0.3, -0.6);
  say('正確的位數每次加倍', '1, 2, 4, 8 … → log d 步就到 d 位');
  await step(tok);                                   // 29:05 改用 binary search？
  g.mood('wow'); g.talk('binary search 呢？');
  say('不用 Newton，改用 binary search？', '也可以：猜一個數，用 g³ 比大小');
  await step(tok);                                   // 29:32 大 R = r · b^{3d}
  tag('R = r · b³ᵈ', 'note', 3.4, 0.3, -4.2);
  g.mood('calm');
  say('在 0 到 R 之間猜', '大 R = 小 r · b³ᵈ');
  await step(tok);                                   // 30:02 猜 log R 次
  say('binary search 要猜 log R 次', '每猜一次，範圍砍半');
  await step(tok);                                   // 30:50 log r + 3d log b → O(d)
  s2Bar('binary search：O(d)', '#dd8238', 4.6, 3.5, -2.2, 1.0);
  say('log R = log r + 3d log b', 'b 是常數 → O(d)');
  await step(tok);                                   // 31:10 Newton 指數級地快
  tag('Newton O(log d) vs binary search O(d)', 'ptr alt', 0, 0.3, 1.4);
  g.mood('happy'); g.talk('Newton 快很多');
  say('位數越多，Newton 越划算', '在位數上指數級地快');
  await step(tok);                                   // 31:55 binary search：區間每次砍半
  say('再講一次 binary search', '從一個區間開始，每猜一次砍一半');
  await step(tok);                                   // 32:53 d 位數 → O(d)；Newton log d
  say('猜 d 位數：binary search 約 O(d) 次', 'Newton 二次收斂：log d 次');
  await step(tok);                                   // 33:22 Newton 需要很多條件
  g.mood('calm'); g.talk('但要條件');
  say('代價：Newton 要很多東西', '好的函數、好的初始值…');
  await step(tok);                                   // 33:36 這是猜的次數，不是總時間
  tag('上面是猜的次數，不是總時間', 'idx', 0, 0.3, 2.4);
  say('這是「猜幾次」，不是總時間', '數字很大時，乘法不是 O(1)');
  await step(tok);                                   // 34:02 Newton 除法 ≈ 一次乘法的時間
  g.mood('happy'); g.talk('最後一次最貴');
  say('Newton 除法的時間 = 所用乘法的時間', '數字每步變兩倍長，只有最後一次乘法算數');
}]);

// 34:46 紅藍邊 + 換色要付 5；只用紅、只用藍兩份圖不夠
FRAG.push(['spmit2-r18-redblue-setup', 'R18：紅藍邊，換色要付 5', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // 34:46 圖的題目：先做 transformation
  const g = s2Pal(-5.6, 3.6, 0.6);
  g.mood('happy'); g.talk('來玩圖！');
  say('進入圖的題目', '先做 graph transformation');
  await step(tok);                                   // 35:25 每條邊紅或藍，有權重
  buildGraph(S2G.rb);
  GR.edges.forEach((e, i) => edgeColor(e, RB_COL[i], 1.8));
  g.mood('calm'); g.talk('紅的、藍的');
  say('每條邊是紅色或藍色', '還有權重（權重是示意）');
  await step(tok);                                   // 35:52 紅換藍要付 5
  const fee = tag('紅 ↔ 藍 換色一次：+5', 'note', 0, 0.3, -3.8);
  say('權重像油錢', '從紅邊換到藍邊，要多付 5');
  await step(tok);                                   // 36:06 S 到 A：3 + 1 = 4
  const p1 = await s2Walk(tok, '3 + 1 = 4', [0, 1, 2], 500);
  nodeTag(2, '4');
  say('S → X → A：都是紅', '3 + 1 = 4');
  await step(tok);                                   // 36:23 S 到 B：3 + 1 + 5 = 9
  kill(p1);
  const p2 = await s2Walk(tok, '3 + 1 + 5 = 9', [0, 1, 3], 500);
  nodeTag(3, '9');
  g.mood('wow'); g.talk('換色 +5');
  say('S → X → B：紅轉藍', '3 + 1 + 5 = 9');
  await step(tok);                                   // 36:35 藍換紅也是 5
  kill(p2);
  txt(fee, '紅 → 藍：+5；藍 → 紅：+5');
  g.mood('calm');
  say('藍換紅也一樣付 5', '');
  await step(tok);                                   // 37:13 求 s 到 t 最便宜的路
  nodeTag(2, ''); nodeTag(3, '');
  nodeColor(0, C.pq, 0.3); nodeColor(4, C.purple, 0.3);
  say('求 S 到 T 總成本最小的路徑', '');
  await step(tok);                                   // 37:28 學生：紅一份、藍一份
  const s = s2Pal(5.6, 3.6, 0.55, '同學', '#8fc7e8');
  s.mood('happy'); s.talk('分成兩份圖？');
  say('學生：只用紅邊做一份圖', '只用藍邊再做一份，各跑最短路徑');
  await step(tok);                                   // 38:04 只用紅
  GR.edges.forEach((e, i) => edgeColor(e, RB_COL[i] === S2R ? S2R : C.dim, RB_COL[i] === S2R ? 2.2 : 0.7));
  const r = tag('只用紅：S → X → A，到不了 T', 'ptr', -2.6, 0.3, 3.6);
  say('只用紅邊：S → X → A', '到不了 T');
  await step(tok);                                   // 38:36 只用藍
  GR.edges.forEach((e, i) => edgeColor(e, RB_COL[i] === S2B ? S2B : C.dim, RB_COL[i] === S2B ? 2.2 : 0.7));
  const b = tag('只用藍：S 沒有藍邊', 'ptr', 2.6, 0.3, 3.6);
  say('只用藍邊再做一份', 'S 根本沒有藍邊');
  await step(tok);                                   // 39:31 這張圖對，一般不對
  GR.edges.forEach((e, i) => edgeColor(e, RB_COL[i], 1.8));
  s.mood('sad'); s.talk('一般不行…');
  say('白板那張剛好可以，一般不行', '換成這張（示意）：兩份都是 ∞');
  await step(tok);                                   // 40:06 沒表達「可以換色」
  kill(r); kill(b);
  s2Path([0, 1, 2], S2R, 2.6); edgeColor(s2E(2, 4), S2B, 2.6);
  nodeTag(4, '3 + 1 + 5 + 1 = 10');
  g.mood('happy'); g.talk('要能換色');
  say('問題：沒表達「可以紅藍交替」', '正解要換色：S → X → A → T = 10');
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
// 40:17 兩層：紅層、藍層，同一點的兩份之間連權重 5 的邊
FRAG.push(['spmit2-r18-redblue-layers', 'R18：紅層＋藍層，層間邊權重 5', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // 40:17 兩層
  buildGraph(s2Layers(2), { ns: 0.85 });
  s2LayerColors();
  const cross = GR.edges.filter((e) => e.w === 5 && Math.abs(e.u - e.v) === 5);
  for (const e of cross) edgeColor(e, C.dim, 0.5);
  tag('紅層', 'ptr', -6.3, 0.3, -2.6); tag('藍層', 'ptr', -6.3, 0.3, 2.6);
  const g = s2Pal(6.2, 0, 0.5);
  g.talk('兩層！');
  say('答案：兩層', '紅層放紅邊，藍層放藍邊');
  await step(tok);                                   // 40:24 怎麼連？
  for (const e of cross) edgeColor(e, C.purple, 1.4);
  g.talk('權重 5 的邊');
  say('兩層怎麼連？', '同一個點的紅、藍副本，用權重 5 的邊相連');
  await step(tok);                                   // 40:46 付 5 就能換世界、也能回來
  const pk = tag('+5', 'pkt', s2At(1).x, 1, s2At(1).z);
  await travel(tok, pk, s2At(1), s2At(6), 700); await travel(tok, pk, s2At(6), s2At(1), 700);
  kill(pk);
  say('付 5 就能從紅世界到藍世界', '也能付 5 回來');
  await step(tok);                                   // 41:10 全是正的 → Dijkstra
  const { d, par } = s2Dij(0);
  const p = s2Back(par, 9);
  s2Path(p, C.hot, 2.6);
  g.mood('happy'); g.talk('Dijkstra！');
  say('所有邊都是正的 → Dijkstra', p.map(nm).join('→') + ' = ' + d[9] + '（3 + 1 + 5 + 1）');
  await step(tok);                                   // 41:36 理論 V log V + E（Fibonacci Heap）
  const t = tag('理論：O(V log V + E)（Fibonacci Heap，常數大）', 'note', 0, 0.3, -4.6);
  g.mood('calm'); g.talk('理論版');
  say('理論上 O(V log V + E)', 'Fibonacci Heap：常數很大，實務上不用');
  await step(tok);                                   // 42:01 binary Heap：E log V；比 BF 快
  txt(t, '實務：O(E log V)（binary Heap）　Bellman-Ford：O(VE)');
  say('實務上用 binary Heap：O(E log V)', '比 Bellman-Ford 的 O(VE) 快');
  await step(tok);                                   // 42:45 很多頂點、很少邊？先 BFS
  g.mood('wow'); g.talk('點多邊少？');
  say('學生：頂點很多、邊很少怎麼辦？', '先從起點 BFS，只留走得到的部分');
  await step(tok);                                   // 44:13 要知道圖變多大
  g.mood('calm'); g.talk('圖變多大？');
  say('小考會要你知道', '轉換後圖變多大、代進去是什麼時間');
  await step(tok);                                   // 44:29 轉換通常線性時間
  say('轉換本身通常線性時間', '比跑 Dijkstra、Bellman-Ford 小得多');
  await step(tok);                                   // 44:45 新圖：2V 點；E + 層間邊
  tag('新圖：2V 個點；E 條原邊 + 層間邊', 'pkt', 0, 0.3, 4.6);
  g.mood('happy'); g.talk('2V');
  say('這題的新圖', '頂點 2V；原本 E 條邊，加上連接兩層的邊');
}]);

// 45:20 layer 的直覺：2D 地圖疊成 3D；layer 可以很多
FRAG.push(['spmit2-r18-layers-idea', 'R18：layer = 把 state 疊成第三維', async (tok) => {
  fresh([0, 11.5, 9], [0, 1.2, -0.3]);
  await step(tok);                                   // 45:20 同一個老問題：2D 圖
  const g = s2Pal(5.8, 3.4, 0.6);
  const pl = [cube('原圖（2D 地圖）', '#efe3c8', [7, 0.15, 3.4], 0, 0.1, 0, 3)];
  g.talk('老問題');
  say('一再出現的老問題：一張 2D 的圖', '想算 Dijkstra 自己算不了的東西');
  await step(tok);                                   // 45:32 加 state：複製成 layers
  relabel(pl[0], '紅層');
  tint(pl[0], '#f3c9c0');
  g.talk('加 state');
  say('就要加 state', '做法：把圖複製，叫做 layers');
  await step(tok);                                   // 45:41 每層一份原圖 → 3D
  pl.push(cube('藍層', '#c9dcf3', [7, 0.15, 3.4], 0, 1.4, 0, 3));
  say('每層都是一份原圖', '疊起來像 3D 的圖');
  await step(tok);                                   // 45:50 science：做副本；art：怎麼連
  for (let i = 0; i < 4; i++) cube('', C.purple, [0.08, 1.25, 0.08], -2.4 + i * 1.6, 0.75, 0.6 - (i % 2) * 1.2);
  g.mood('happy'); g.talk('藝術在連法');
  say('science：做副本', 'art：決定有哪些 layer、怎麼連');
  await step(tok);                                   // 46:17 有沒有 layer 很多的題目？
  g.mood('wow'); g.talk('很多層的呢？');
  say('有 layer 很多的題目嗎？', '有兩題');
  await step(tok);                                   // 46:33 時刻表 ~1440 層；StarCraft 更多
  pl.forEach(kill);
  for (let i = 0; i < 6; i++) cube(i === 4 ? '…' : i === 5 ? 't = 1439' : 't = ' + i, i % 2 ? '#efe3c8' : '#e6d8b8', [6, 0.12, 3], 0, 0.1 + i * 0.9, 0, 2);
  g.mood('calm'); g.talk('一分鐘一層');
  say('塞車時刻表：一天的分鐘數，約 1440 層', 'StarCraft 那題：層數超級多');
  await step(tok);                                   // 46:50 層數合理就沒問題
  tag('層數合理就沒問題', 'ptr alt', 0, 0.3, 2.6);
  say('只要層數符合題目要算的', '多一點也 OK');
  await step(tok);                                   // 47:07 O(V + E) 做出新圖
  say('建新圖應該能在 O(V + E) 完成', '就是把圖的描述輸出一遍');
  await step(tok);                                   // 47:24 紅副本、藍副本、V 條連接邊
  tag('每點 2 份；原邊留在各層；+ V 條連接邊', 'note', 0, 0.3, 3.5);
  say('紅藍題：每個點一份紅、一份藍', '紅邊、藍邊留在原層，再加 V 條連接邊');
  await step(tok);                                   // 47:51 要知道圖是加倍還是爆炸
  g.mood('happy'); g.talk('加倍？爆炸？');
  say('不會考轉換花多久', '但要知道圖是加倍、還是指數地變大');
}]);

// 48:06 只能紅 → 藍（有向）；想要 SR/SB 到 TR/TB 的最小 → 超級起點與終點
FRAG.push(['spmit2-r18-oneway-super', 'R18：單向換色與超級起點 / 終點', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const G = s2Layers(1);
  G.names.push('s*', 't*'); G.pos.push([-6.5, 0], [6.5, 0]);
  await step(tok);                                   // 48:06 變形：只能紅 → 藍
  buildGraph({ ...G, edges: G.edges.slice() }, { ns: 0.85 });
  s2LayerColors();
  nodeColor(10, C.dim, 0); nodeColor(11, C.dim, 0);
  for (const e of GR.edges) if (e.w === 5) edgeColor(e, C.dim, 0.5);
  const g = s2Pal(-5.4, 4.2, 0.5);
  g.talk('單行道');
  say('變形：可以紅 → 藍，但不能回頭', '一開始可以是紅或藍');
  await step(tok);                                   // 48:32 用有向的層間邊表達限制
  for (const e of GR.edges) if (e.w === 5) edgeColor(e, C.purple, 1.4);
  say('層之間的限制，用有向邊表達', '只有紅 → 藍的邊');
  await step(tok);                                   // 48:53 只限制不收錢：0；要錢：5
  tag('不收錢：權重 0；收錢：權重 5', 'note', 0, 0.3, -4.4);
  say('只是限制、不收錢：權重 0', '這題要付錢：權重 5');
  await step(tok);                                   // 49:10 layers 能表達成本或限制
  g.mood('happy'); g.talk('成本或限制');
  say('layers 可以表達額外成本', '也可以只表達限制');
  await step(tok);                                   // 49:26 要算哪些最短路徑？
  nodeColor(0, C.ok, 0.3); nodeColor(5, C.ok, 0.3); nodeColor(4, C.purple, 0.3); nodeColor(9, C.purple, 0.3);
  g.mood('wow'); g.talk('4 種組合！');
  say('要算哪些最短路徑？', 'Sʀ 或 Sʙ 出發，到 Tʀ 或 Tʙ：4 種');
  await step(tok);                                   // 49:46 單源 → 兩個起點各跑一次
  g.mood('calm'); g.talk('跑兩次');
  say('演算法給「一個起點到所有點」', '從兩個起點各跑一次就好');
  await step(tok);                                   // 49:54 只跑一次：超級起點與終點
  const e1 = addEdge(GR, 10, 0, 0), e2 = addEdge(GR, 10, 5, 0), e3 = addEdge(GR, 4, 11, 0), e4 = addEdge(GR, 9, 11, 0);
  computeAdj(GR);
  [e1, e2, e3, e4].forEach((e) => edgeColor(e, C.ok, 1.6));
  nodeColor(10, C.pq, 0.3); nodeColor(11, C.pq, 0.3);
  g.mood('happy'); g.talk('超級點！');
  say('只想跑一次？加超級起點 s*、超級終點 t*', '用權重 0 的邊接上');
  await step(tok);                                   // 50:15 從 s* 哪裡都能去，t* 哪裡都能回
  const { d, par } = s2Dij(10);
  s2Path(s2Back(par, 11), C.hot, 2.6);
  say('s* 可以去任一個起點，任一個終點都能到 t*', 's* → t* 最短 = ' + d[11] + '：一次涵蓋 4 種');
  await step(tok);                                   // 50:32 有向比較保險
  g.mood('calm'); g.talk('做成有向');
  say('這些 0 邊要有向嗎？', '小考上做成有向的最保險');
}]);

// 51:31 BFS 給 levels，DFS 給邊的種類與結束時間；兩者都用 parent 指標建樹
FRAG.push(['spmit2-r18-bfs-dfs-trees', 'R18：BFS 樹與 DFS 樹不一樣', async (tok) => {
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  await step(tok);                                   // 51:31 BFS 給什麼？
  const g = s2Pal(5.6, 3.6, 0.6);
  const b = tag('BFS：邊數最少的最短路徑（邊沒權重）', 'note', -1, 0.3, -4.4);
  g.talk('BFS 有什麼用？');
  say('BFS 給我們什麼？', '用邊數算的最短路徑（邊沒有權重）');
  await step(tok);                                   // 51:52 DFS 給什麼？
  g.talk('DFS 呢？');
  say('那 DFS 給我們什麼？', '先看 BFS 怎麼看一張圖');
  await step(tok);                                   // 52:07 BFS 分 levels
  txt(b, 'BFS：分成 levels（一條邊 = level 1，兩條邊 = level 2）');
  say('BFS 把頂點分成 levels', '一條邊遠 = level 1，兩條邊遠 = level 2');
  await step(tok);                                   // 52:36 DFS：邊的種類、結束時間
  tag('DFS：邊的種類、結束時間 → topological sort', 'note', -1, 0.3, -3.5);
  say('DFS：邊的種類、結束時間', '結束時間可以拿來做 topological sort');
  await step(tok);                                   // 52:56 兩個都給一棵樹
  g.mood('happy'); g.talk('都給樹');
  say('它們都會給一棵樹嗎？', '都會');
  await step(tok);                                   // 53:11 每個點從某個 parent 被發現
  say('每個點都是從某個 parent 走一條邊發現的', '那條邊就屬於這棵樹');
  await step(tok);                                   // 53:29 用 parent 指標記錄
  g.mood('calm'); g.talk('parent 指標');
  say('怎麼記下這棵樹？', '用 parent 指標');
  await step(tok);                                   // 53:47 一樣的樹嗎？S、A、B
  buildGraph(S2G.tri3);
  g.mood('wow'); g.talk('一樣嗎？');
  say('BFS 樹和 DFS 樹一樣嗎？', '看 S、A、B 這張小圖');
  await step(tok);                                   // 54:02 BFS 樹：S→A、S→B
  nodeTag(0, 'L0'); nodeTag(1, 'L1'); nodeTag(2, 'L1');
  edgeColor(s2E(0, 1), C.tree, 2.2); edgeColor(s2E(0, 2), C.tree, 2.2);
  nodeNote(1, 'π = S'); nodeNote(2, 'π = S');
  say('BFS 樹：S→A、S→B', 'A、B 都在 level 1');
  await step(tok);                                   // 54:04 DFS 樹：S→A→B
  for (const e of GR.edges) edgeColor(e, C.edge, 1);
  for (let v = 0; v < 3; v++) { nodeTag(v, ''); nodeNote(v, ''); }
  edgeColor(s2E(0, 1), C.ok, 2.2); nodeNote(1, 'π = S');
  await beat(tok, 500);
  edgeColor(s2E(1, 2), C.ok, 2.2); nodeNote(2, 'π = A');
  g.mood('happy'); g.talk('不一樣！');
  say('DFS 樹：S→A→B', '同一張圖，兩棵不同的樹');
}]);

// 54:16 DFS 四種邊：tree、back、forward、cross（params.part = 2：判斷條件與摘要）
FRAG.push(['spmit2-r18-dfs-edge-types', 'R18：DFS 的四種邊', async (tok) => {
  const part = (ctx.params || {}).part === 2 ? 2 : 1;
  fresh([0, 12.5, 8], [0, 0, -0.3]);
  const tree = [[0, 1], [1, 3], [3, 4], [3, 5], [0, 2]];
  if (part === 1) {
    await step(tok);                                 // 54:16 DFS 有四種邊
    const g = s2Pal(5.8, 3.8, 0.55);
    g.talk('四種！');
    say('DFS 的邊有幾種？', '四種');
    await step(tok);                                 // 54:37 tree、back、cross、forward
    const ty = [['tree', C.tree], ['back', C.back], ['forward', C.ok], ['cross', C.purple]].map(([t, c], i) => tag(t + ' edge', 'note', -4.5 + i * 3, 0.3, -4.4));
    g.talk('寫在小抄上');
    say('tree、back、cross、forward', '要寫在小抄上');
    await step(tok);                                 // 54:53 無向圖少哪幾種？
    g.mood('wow'); g.talk('無向圖呢？');
    say('無向圖會少哪幾種？', '講義上有（只剩 tree 和 back）');
    await step(tok);                                 // 55:39 BFS → levels；DFS → 邊的種類
    g.mood('calm'); g.talk('');
    say('BFS 給 levels', 'DFS 給邊的種類');
    await step(tok);                                 // 55:54 用在證明（topological sort）
    say('邊的種類主要用在證明', '例：topological sort 的證明');
    await step(tok);                                 // 56:14 DFS 分得出來嗎？
    g.mood('wow'); g.talk('DFS 分得出來？');
    say('學生：DFS 分得出這幾種嗎？', '一定有辦法，不然不會教');
    await step(tok);                                 // 56:38 現場編一棵 DFS 樹
    ty.forEach(kill);
    buildGraph(S2G.dfs);
    g.mood('calm'); g.talk('現場編一個');
    say('現場畫一棵 DFS 樹當例子', '學生幫忙加一條邊');
    await step(tok);                                 // 57:42 S、A、B、C、D、E
    say('頂點 S、A、B、C、D、E', '');
    await step(tok);                                 // 57:52 adjacency list 照字母順序 → 跑 DFS
    const ev = [['d', 0], ['d', 1], ['d', 3], ['d', 4], ['f', 4], ['d', 5], ['f', 5], ['f', 3], ['f', 1], ['d', 2], ['f', 2], ['f', 0]];
    const dt = Array(6).fill(0), ft = Array(6).fill(0);
    for (let i = 0; i < ev.length; i++) {
      const [k, v] = ev[i];
      if (k === 'd') { dt[v] = i + 1; nodeColor(v, C.pq, 0.3); } else { ft[v] = i + 1; nodeColor(v, C.ok, 0.3); }
      nodeNote(v, dt[v] + ' / ' + (ft[v] || ''));
      await beat(tok, 180);
    }
    say('假設 adjacency list 照字母順序', 'DFS 依序走：S, A, C, D, E, B');
    await step(tok);                                 // 57:56 SA、SB、AC、CD、CE
    for (const [a, b] of tree) edgeColor(s2E(a, b), C.tree, 2.2);
    say('先標 tree edge', 'SA、SB、AC、CD、CE');
    await step(tok);                                 // 58:28 AE 跳過一代
    edgeColor(s2E(1, 5), C.hot, 2.4);
    g.mood('wow'); g.talk('跳過一代！');
    say('A→E 呢？', '它跳過一代（A → C → E）：不是 tree edge');
    await step(tok);                                 // 58:31 tree edge = DFS 往前走、一次遞迴呼叫
    edgeColor(s2E(1, 5), C.edge, 1);
    g.mood('calm'); g.talk('一次遞迴一條');
    say('tree edge：DFS 往前走用到的邊', '每條對應一次遞迴呼叫');
    return;
  }
  buildGraph(S2G.dfs);
  for (const [a, b] of tree) edgeColor(s2E(a, b), C.tree, 2.2);
  const g = s2Pal(5.8, 3.8, 0.55);
  await step(tok);                                   // 58:46 tree edge：v 沒拜訪過，v.parent = u
  const at = tag('在 u，看邊 (u, v)', 'note', -1, 0.3, -4.4);
  const pk = tag('u', 'pkt', s2At(3).x, 1, s2At(3).z);
  edgeColor(s2E(3, 4), C.hot, 2.4);
  g.talk('v 還沒去過');
  say('tree edge：在 u 看邊 (u, v)', 'v 還沒拜訪過 → 走過去，v.parent = u');
  await step(tok);                                   // 59:23 來比 forward edge
  edgeColor(s2E(3, 4), C.tree, 2.2);
  txt(pk, 'u'); await travel(tok, pk, s2At(3), s2At(1), 600);
  edgeColor(s2E(1, 5), C.ok, 2.4);
  say('來比較 forward edge', '例：A→E');
  await step(tok);                                   // 59:47 往下指；沿 v 的 parent 往上會遇到 u
  const up = tag('E', 'pkt', s2At(5).x, 1.4, s2At(5).z);
  await travel(tok, up, s2At(5, 1.4), s2At(3, 1.4), 500); txt(up, 'C');
  await travel(tok, up, s2At(3, 1.4), s2At(1, 1.4), 500); txt(up, 'A = u ✓');
  say('(u, v) 往下指', '沿 v 的 parent 一直往上，會遇到 u');
  await step(tok);                                   // 60:14 要不只一層
  g.mood('wow'); g.talk('跳了兩層');
  say('而且不只一層', '只差一層的話就是 tree edge 了');
  await step(tok);                                   // 61:10 還有 back、cross
  kill(up);
  edgeColor(s2E(4, 1), C.back, 2.4);
  g.mood('calm'); g.talk('往回指');
  say('還剩 back edge 和 cross edge', '找一條 back edge：D→A');
  await step(tok);                                   // 61:40 指向祖先：沿 u 的 parent 往上遇到 v
  txt(pk, 'u = D'); await travel(tok, pk, s2At(1), s2At(4), 500);
  const up2 = tag('D', 'pkt', s2At(4).x, 1.4, s2At(4).z);
  await travel(tok, up2, s2At(4, 1.4), s2At(3, 1.4), 450); txt(up2, 'C');
  await travel(tok, up2, s2At(3, 1.4), s2At(1, 1.4), 450); txt(up2, 'A = v ✓');
  say('back edge：指向自己的祖先', '沿 u 的 parent 往上，會遇到 v');
  await step(tok);                                   // 62:32 A 是 D 的祖先
  say('A 是 D 的祖先', '到 D 時，C、D 的 parent 都設好了；u = D、v = A');
  await step(tok);                                   // 62:55 cross edge：B→C
  kill(up2);
  edgeColor(s2E(2, 3), C.purple, 2.4);
  txt(pk, 'u = B'); await travel(tok, pk, s2At(4), s2At(2), 600);
  g.mood('wow'); g.talk('橫著跑');
  say('有 cross edge 嗎？', 'B→C 就是');
  await step(tok);                                   // 63:22 像 forward，但 u 不是 v 的祖先
  say('cross edge 很像 forward', '但 u 不是 v 的祖先；兩者共同祖先只有起點 S');
  await step(tok);                                   // 64:07 摘要
  kill(pk);
  txt(at, '順著 DFS = tree；逆著 = back；跳很多層 = forward；其他 = cross');
  g.mood('happy'); g.talk('整理一下');
  say('摘要：DFS 用到的邊 = tree；逆著走 = back', '一次跳好幾層 = forward；其他怪的 = cross');
  await step(tok);                                   // 64:32 取決於 adjacency list 的順序
  g.mood('calm'); g.talk('看順序');
  say('種類取決於 adjacency list 的順序', '換個順序，A→E 可能變成 tree edge');
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
