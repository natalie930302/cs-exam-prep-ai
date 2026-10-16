// 演算法 第6章：圖論演算法（BFS、DFS、邊分類、Topological sort、SCC、Articulation point）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
//
// 例子來源（跟著本章影片走）：
//  • WilliamFiset「Depth First Search」：0～11 的無向圖，0 → 9 → 8 → 7 → 10 → 11、回溯、7 → 3 → 2/4/5 → 6、8 → 1；
//    connected components：0、8、14、13、4 標 0；1、5、17、16 標 1（其他幾塊的分法影片沒有念出來，畫面上是示意）。
//  • MIT 6.006 L14：a～f 的有向圖（a→b, a→d, b→e, e→d, d→b, c→f, f→f, c→e；從 a、再從 c 開始），
//    即 CLRS 圖 22.4；topological sort 用課本「穿衣服」例子（CLRS 圖 22.7）。
//  • MIT 6.006 Rec13：A–B、A–C、B–D、B–E、C–D，F 獨立；handshaking lemma、adjacency list / matrix、BFS from A。
//  • MIT 6.006 Rec14：A→B, A→G, B→C, C→A, C→D, C→F, D→E, D→F, G→C（依字母順序）；拿掉 C→A 做修課順序。
// 課本（CLRS 第 22 章）補充：BFS 圖 22.3、Kahn、SCC（圖 22.9，Kosaraju 與 Tarjan）、articulation point（例子自訂）。
// 慣例：CLRS 的白／灰／黑；d[v]/f[v] 為 discovery／finishing time，時間從 1 開始。
import kit from './_kit.js';

export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const INF = Infinity;
  let timer = null, epoch = 0;
  const C = { white: '#f4efe4', gray: '#b9b2a6', black: '#55504a', edge: '#a8987c', hot: '#e8b02a', tree: '#2f7fd0', back: '#d64545', fwd: '#9b7ef4', cross: '#dd8238', dim: '#ddd2bd', ok: '#2fc092', q: '#efe3c8' };
  const SCC_COL = ['#2fc092', '#4b9ee2', '#9b7ef4', '#e55a9b', '#dd8238', '#31aab0', '#c08a1f'];
  const KIND = { tree: 'tree edge', back: 'back edge', fwd: 'forward edge', cross: 'cross edge' };
  const MONO = { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '11px', fontWeight: '600' };

  // ───────────────────────── 圖 ─────────────────────────
  // pos: [x, z]（地板座標）；edges: [u, v]；adj：指定鄰居順序（影片講的順序）
  const GRAPHS = {
    af: { title: 'L14：a～f（CLRS 圖 22.4）', directed: true, names: ['a', 'b', 'c', 'd', 'e', 'f'],
      pos: [[-4.2, -1.8], [-0.6, -1.8], [3.2, -1.8], [-4.2, 1.8], [-0.6, 1.8], [3.2, 1.8]],
      edges: [[0, 1], [0, 3], [1, 4], [4, 3], [3, 1], [2, 5], [5, 5], [2, 4]], adj: { 2: [5, 4] } },
    rec14: { title: 'Rec14：A～G（有向）', directed: true, names: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      pos: [[-5, 0.2], [-2.4, -2.4], [0.2, 0.2], [2.8, -2.4], [5.3, -1.0], [3.2, 2.6], [-2.4, 2.6]],
      edges: [[0, 1], [0, 6], [1, 2], [2, 0], [2, 3], [2, 5], [3, 4], [3, 5], [6, 2]] },
    rec14u: { title: 'Rec14：同一張圖當無向圖', directed: false, names: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      pos: [[-5, 0.2], [-2.4, -2.4], [0.2, 0.2], [2.8, -2.4], [5.3, -1.0], [3.2, 2.6], [-2.4, 2.6]],
      edges: [[0, 1], [0, 6], [1, 2], [2, 0], [2, 3], [2, 5], [3, 4], [3, 5], [6, 2]] },
    rec14dag: { title: 'Rec14：拿掉 C→A（修課 DAG）', directed: true, names: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      pos: [[-5, 0.2], [-2.4, -2.4], [0.2, 0.2], [2.8, -2.4], [5.3, -1.0], [3.2, 2.6], [-2.4, 2.6]],
      edges: [[0, 1], [0, 6], [1, 2], [2, 3], [2, 5], [3, 4], [3, 5], [6, 2]] },
    rec13: { title: 'Rec13：A～F（無向，F 獨立）', directed: false, names: ['A', 'B', 'C', 'D', 'E', 'F'],
      pos: [[-4.6, 0], [-1.6, -2.2], [-1.6, 2.2], [1.6, 0.8], [1.8, -2.6], [5, 1.8]],
      edges: [[0, 1], [0, 2], [1, 3], [1, 4], [2, 3]] },
    bfs22: { title: '課本 CLRS 圖 22.3（無向）', directed: false, names: ['r', 's', 't', 'u', 'v', 'w', 'x', 'y'],
      pos: [[-4.5, -1.6], [-1.5, -1.6], [1.5, -1.6], [4.5, -1.6], [-4.5, 1.6], [-1.5, 1.6], [1.5, 1.6], [4.5, 1.6]],
      edges: [[0, 1], [0, 4], [1, 5], [5, 2], [5, 6], [2, 6], [2, 3], [6, 3], [6, 7], [3, 7]] },
    fiset: { title: 'WilliamFiset：0～11（無向）', directed: false, names: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
      pos: [[-5.2, 2.0], [-2.6, 2.7], [5.2, 0.0], [2.6, 0.9], [5.0, 2.5], [2.4, 3.0], [0.0, 2.2], [0.2, -0.6], [-2.6, -0.2], [-5.0, -1.0], [0.6, -3.2], [2.8, -2.6]],
      edges: [[0, 9], [0, 1], [9, 8], [8, 7], [8, 1], [7, 10], [7, 11], [10, 11], [7, 3], [7, 6], [3, 2], [3, 4], [3, 5], [5, 6]],
      adj: { 0: [9, 1], 8: [9, 7, 1], 7: [8, 10, 11, 3, 6] } },
    comps: { title: 'WilliamFiset：connected components', directed: false, ns: 0.78,
      names: [...Array(18).keys()].map(String),
      pos: [[-5.4, -2.6], [-1.6, -2.8], [3.0, -2.8], [0.2, 1.4], [-5.7, -0.8], [0.0, -2.0], [-3.4, 2.4], [1.8, 2.6], [-3.6, -2.7], [4.6, -2.6], [3.4, -0.9], [3.6, 1.8], [2.0, 0.6], [-4.4, -0.2], [-3.0, -1.0], [5.4, -1.0], [0.8, -0.7], [1.2, -3.3]],
      edges: [[0, 8], [8, 14], [14, 13], [0, 4], [1, 5], [5, 17], [5, 16], [2, 9], [9, 15], [2, 10], [3, 7], [7, 11], [11, 12], [3, 12]],
      adj: { 0: [8, 4], 5: [1, 17, 16] } },
    dress: { title: '課本：穿衣服（CLRS 圖 22.7）', directed: true, names: ['襯衫', '領帶', '外套', '皮帶', '手錶', '內褲', '褲子', '鞋子', '襪子'],
      pos: [[1.4, -2.6], [4.4, -1.2], [2.4, 2.6], [-0.8, 1.0], [5.4, 2.4], [-5.0, -2.4], [-5.0, 0.4], [-2.6, -0.9], [-1.6, -2.9]],
      edges: [[5, 6], [5, 7], [6, 3], [6, 7], [3, 2], [0, 3], [0, 1], [1, 2], [8, 7]], adj: { 6: [7, 3] } },
    scc22: { title: '課本 CLRS 圖 22.9', directed: true, names: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
      pos: [[-4.8, -1.6], [-1.6, -1.6], [1.6, -1.6], [4.8, -1.6], [-4.8, 1.6], [-1.6, 1.6], [1.6, 1.6], [4.8, 1.6]],
      edges: [[0, 1], [1, 2], [1, 4], [1, 5], [2, 3], [2, 6], [3, 2], [3, 7], [4, 0], [4, 5], [5, 6], [6, 5], [6, 7], [7, 7]],
      adj: { 2: [6, 3], 1: [4, 2, 5] }, order: [2, 1, 0, 3, 4, 5, 6, 7] },
    ap: { title: '自訂：articulation point 例子', directed: false, names: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      pos: [[-5, -1.6], [-2.6, 0], [-5, 1.6], [0, 0], [2.6, 0], [1.3, 2.4], [5, -1.2]],
      edges: [[0, 1], [1, 2], [2, 0], [1, 3], [3, 4], [4, 5], [5, 3], [4, 6]] },
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
  function kill(o) { if (!o) return; lab.world.remove(o); o.traverse((c) => { if (c.element) c.element.remove(); }); }
  const txt = (l, t) => { l.element.textContent = t; };
  function code(lines, x, zTop, dz = 0.5) {
    const w = Math.max(...lines.map((s) => s.length));
    const ls = lines.map((s, i) => { const l = tag(s.padEnd(w, ' '), '', x, 0.3, zTop + i * dz); Object.assign(l.element.style, MONO); return l; });
    return { ls, hl(i) { ls.forEach((l, k) => { l.element.className = 'lab-label' + (k === i ? ' ptr alt' : ''); }); } };
  }
  function selectHtml(id, pairs, val) { return '<select id="' + id + '">' + pairs.map(([v, t]) => '<option value="' + v + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>'; }
  async function anim(tok, ms, fn) { const steps = 10; for (let k = 1; k <= steps; k++) { fn(k / steps); await wait(tok, ms / steps); } }

  // ───────────────────────── 畫圖 ─────────────────────────
  const NR = 0.42;
  let GR = null;
  const nm = (i) => GR.G.names[i];
  function buildGraph(G, o = {}) {
    const sc = o.scale || 1, dx = o.dx || 0, dz = o.dz || 0, ns = (o.ns || G.ns || 1);
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
    G.edges.forEach(([u, v, w]) => addEdge(gr, u, v, w));
    computeAdj(gr);
    return gr;
  }
  function addEdge(gr, u, v, w, bend) {
    const anti = gr.directed && u !== v && gr.G.edges.some(([x, y]) => x === v && y === u);
    const e = { u, v, w, bend: bend !== undefined ? bend : anti ? 0.12 : 0, color: C.edge, thick: 1, group: null, lbl: null, cls: null };
    if (w !== undefined && w !== null) e.lbl = tag(String(w), w < 0 ? 'ptr alt' : '', 0, 0.4, 0);
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
    let mid;
    if (e.u === e.v) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.3, r, 8, 24), mat);
      t.rotation.x = Math.PI / 2; t.position.set(a.x + 0.52, 0.3, a.z - 0.52); g.add(t);
      if (gr.directed) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 12), mat);
        cone.position.set(a.x + 0.52 - 0.3, 0.3, a.z - 0.52); cone.rotation.x = Math.PI / 2; g.add(cone);
      }
      mid = V(a.x + 0.9, 0.42, a.z - 0.9);
    } else {
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
      mid = curve.getPoint(0.5).addScaledVector(perp, e.bend >= 0 ? 0.3 : -0.3).setY(0.42);
    }
    e.group = g; e.mat = mat;
    lab.world.add(g);
    if (e.lbl) e.lbl.position.copy(mid);
  }
  function computeAdj(gr) {
    gr.adj = [...Array(gr.n)].map(() => []);
    for (const e of gr.edges) {
      gr.adj[e.u].push({ e, to: e.v });
      if (!gr.directed && e.u !== e.v) gr.adj[e.v].push({ e, to: e.u });
    }
    gr.adj.forEach((l, u) => {
      const pref = gr.G.adj && gr.G.adj[u];
      l.sort((p, q) => (pref ? pref.indexOf(p.to) - pref.indexOf(q.to) : p.to - q.to));
    });
  }
  const adjOf = (u) => GR.adj[u];
  function edgeColor(e, color, thick = 1) { e.color = color; if (e.thick !== thick) { e.thick = thick; drawEdge(GR, e); } else e.mat.color.set(color); }
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
  // 把頂點移到新位置，移動途中邊跟著重畫
  async function relayout(tok, pos, ms = 1000) {
    pos.forEach((p, i) => { GR.nodes[i].home = V(p[0], 0.25, p[1]); lab.springTo(GR.nodes[i].b, GR.nodes[i].home); });
    await anim(tok, ms, () => GR.edges.forEach((e) => drawEdge(GR, e)));
    GR.edges.forEach((e) => drawEdge(GR, e));
  }
  function lineLayout(order, z = 0.4) {
    const pos = [];
    const gap = Math.min(1.5, 12 / Math.max(1, order.length - 1));
    order.forEach((v, k) => { pos[v] = [-gap * (order.length - 1) / 2 + k * gap, z]; });
    GR.edges.forEach((e, k) => { e.bend = (k % 2 ? 1 : -1) * 0.2; });
    return pos;
  }

  // 一排方塊（queue、stack、輸出串列）：set() 時沒出現的方塊飛走，新方塊掉進來
  function makeStrip(x0, z, title, gap = 1.05) {
    const st = { items: new Map() };
    if (title) tag(title, 'idx', x0 - 0.9, 0.3, z);
    st.set = (list) => {
      const keep = new Set(list.map((it) => it.key));
      for (const [k, b] of st.items) if (!keep.has(k)) { lab.flyAway(b, V(0, 6, -2)); st.items.delete(k); }
      list.forEach((it, i) => {
        const pos = V(x0 + i * gap, 0.3, z);
        let b = st.items.get(it.key);
        if (!b) {
          const m = lab.box(it.color || C.q, [gap * 0.88, 0.5, 0.72]);
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
  function bars(entries, z0, tmax, x0 = -5.6, x1 = 5.6) {
    const X = (t) => x0 + (t - 0.5) / tmax * (x1 - x0);
    return entries.map((en, k) => {
      const z = z0 + k * 0.5, w = X(en.f + 0.5) - X(en.d - 0.5);
      const m = lab.box(en.color || '#4b9ee2', [w, 0.18, 0.32]);
      m.position.set((X(en.d - 0.5) + X(en.f + 0.5)) / 2, 0.1, z); lab.world.add(m);
      tag('(' + en.name, 'idx', X(en.d - 0.5) + 0.25, 0.4, z); tag(en.name + ')', 'idx', X(en.f + 0.5) - 0.25, 0.4, z);
      return m;
    });
  }

  // ───────────────────────── 步進框架（generator） ─────────────────────────
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
  async function playGen(tok, speed = 1) {
    for (;;) { const st = step(); if (!st) break; await wait(tok, (st.ms || 1000) * speed); }
  }
  function stepControls(extra, reset) {
    controls((extra || '') + '<button class="primary" id="gStep">下一步</button><button id="gAuto">自動播放</button><button id="gReset">重來</button>');
    on('gStep', () => { clearTimeout(timer); if (!step()) log('已經結束了，按「重來」再跑一次。', true); });
    on('gAuto', autoPlay);
    on('gReset', () => { clearLog(); reset(); });
  }

  // ───────────────────────── BFS ─────────────────────────
  function* bfsGen(s, o = {}) {
    const n = GR.n, k = o.k || 1;
    const d = Array(n).fill(INF), par = Array(n).fill(-1), col = Array(n).fill(0);
    const qs = makeStrip(-4.6, -4.4, 'Queue');
    const Q = [];
    const qset = () => qs.set(Q.map((v) => ({ key: 'q' + v, text: nm(v) + ' ' + d[v] })));
    const st = (extra) => ['BFS（起點 ' + nm(s) + '）', [...Array(n).keys()].map((v) => [nm(v), (d[v] === INF ? '∞' : d[v]) + (par[v] >= 0 ? '，π = ' + nm(par[v]) : '')]),
      (extra || '') + '白 = 沒看過、灰 = 在 queue 裡、黑 = 處理完<br>只有第一次看到時設 d = d[u] + 1'];
    col[s] = 1; d[s] = 0; nodeColor(s, C.gray, 0.25); nodeTag(s, 'd = 0'); Q.push(s); qset();
    yield { cap: '起點 ' + nm(s) + '：d = 0，放進 queue', f: 'Q = ⟨' + nm(s) + '⟩', ms: 1500 * k, state: st() };
    while (Q.length) {
      const u = Q.shift(); qset();
      nodeColor(u, C.hot, 0.5);
      yield { cap: '從 queue 前端取出 ' + nm(u) + '（d = ' + d[u] + '）', f: '掃 ' + nm(u) + ' 的鄰居', ms: 1100 * k, state: st() };
      for (const { e, to: v } of adjOf(u)) {
        if (col[v] === 0) {
          col[v] = 1; d[v] = d[u] + 1; par[v] = u;
          edgeColor(e, C.tree, 2.2); e.cls = 'tree';
          nodeColor(v, C.gray, 0.25); nodeTag(v, 'd = ' + d[v]);
          Q.push(v); qset();
          yield { cap: nm(v) + ' 第一次看到：d = ' + d[u] + ' + 1 = ' + d[v] + '，進 queue', f: 'π(' + nm(v) + ') = ' + nm(u), ms: 1200 * k, state: st() };
        } else {
          if (e.cls !== 'tree') { edgeColor(e, C.hot, 1.4); }
          yield { cap: nm(v) + ' 已經看過 → 不更新', f: 'd(' + nm(v) + ') 維持 ' + d[v], ms: 650 * k, state: st() };
          if (e.cls !== 'tree') edgeColor(e, C.dim, 0.8);
        }
      }
      col[u] = 2; nodeColor(u, C.black, 0);
      yield { cap: nm(u) + ' 的鄰居都看完 → 變黑', f: 'Q = ⟨' + Q.map(nm).join(', ') + '⟩', ms: 800 * k, state: st() };
    }
    const un = [...Array(n).keys()].filter((v) => d[v] === INF);
    un.forEach((v) => nodeTag(v, 'd = ∞', 'ptr alt'));
    yield { cap: un.length ? 'queue 空了：' + un.map(nm).join('、') + ' 走不到，d = ∞' : 'queue 空了：藍色邊就是 BFS tree', f: 'd 值 = 起點到該點的最少邊數；Θ(V + E)', ms: 3000, state: st('<span class="ok">完成</span><br>') };
  }

  // ───────────────────────── DFS（CLRS：白灰黑、d/f、邊分類） ─────────────────────────
  function* dfsGen(o = {}) {
    const n = GR.n, und = !GR.directed, k = o.k || 1;
    const col = Array(n).fill(0), d = Array(n).fill(0), f = Array(n).fill(0), par = Array(n).fill(-1);
    let time = 0;
    const order = o.order || GR.G.order || [...Array(n).keys()];
    const times = o.times !== false, classify = o.classify !== false;
    const counts = { tree: 0, back: 0, fwd: 0, cross: 0 };
    const stk = [], finished = [];
    const ss = o.stack !== false ? makeStrip(-4.6, -4.4, '遞迴堆疊') : null;
    const fs = o.topo ? makeStrip(-4.6, 4.1, o.topo === 'append' ? 'finished' : '輸出（插到最前）') : null;
    const sset = () => ss && ss.set(stk.map((v) => ({ key: 's' + v, text: nm(v), color: '#d9cfbd' })));
    const fset = () => fs && fs.set((o.topo === 'append' ? finished : [...finished].reverse()).map((v) => ({ key: 'f' + v, text: nm(v), color: '#cfe3f7' })));
    const lab1 = (u) => { if (times) nodeTag(u, d[u] + '/' + (f[u] || ''), f[u] ? 'ptr' : 'ptr alt'); };
    const st = (extra) => ['DFS' + (times ? '（d / f）' : ''), [...Array(n).keys()].map((v) => [nm(v), (d[v] ? (times ? d[v] + '/' + (f[v] || '…') : (col[v] === 2 ? '結束' : '拜訪中')) : '—') + (par[v] >= 0 ? '，π = ' + nm(par[v]) : '')]),
      (extra || '') + (classify ? 'tree ' + counts.tree + '・back ' + counts.back + (und ? '' : '・forward ' + counts.fwd + '・cross ' + counts.cross) + '<br>' : '') + '灰 = 在遞迴堆疊上、黑 = 結束'];
    function* visit(u) {
      time++; d[u] = time; col[u] = 1; nodeColor(u, C.gray, 0.3); lab1(u);
      stk.push(u); sset();
      o.onDiscover && o.onDiscover(u, d);
      yield { cap: '發現 ' + nm(u) + (times ? '：d = ' + time : '') + '，變灰', f: o.discoverF ? o.discoverF(u) : '掃 ' + nm(u) + ' 的鄰居：' + (adjOf(u).map((p) => nm(p.to)).join(', ') || '（沒有）'), ms: 1000 * k, state: st() };
      for (const { e, to: v } of adjOf(u)) {
        if (und && e.cls) continue;
        o.onScan && o.onScan(u, v, e);
        if (col[v] === 0) {
          e.cls = 'tree'; counts.tree++; par[v] = u; edgeColor(e, C.tree, 2.2);
          yield { cap: nm(u) + ' → ' + nm(v) + '：' + nm(v) + ' 是白的 → ' + (classify ? 'tree edge' : '走過去'), f: 'π(' + nm(v) + ') = ' + nm(u), ms: 900 * k, state: st() };
          yield* visit(v);
          continue;
        }
        if (!classify) {
          e.cls = 'seen'; edgeColor(e, C.hot, 1.4);
          yield { cap: nm(u) + ' → ' + nm(v) + '：' + nm(v) + (col[v] === 1 ? ' 正在拜訪中' : ' 已拜訪過') + '，不再進入', f: '', ms: 800 * k, state: st() };
          edgeColor(e, C.dim, 0.9);
          continue;
        }
        const kd = col[v] === 1 ? 'back' : d[u] < d[v] ? 'fwd' : 'cross';
        e.cls = kd; counts[kd]++; edgeColor(e, C[kd], 1.6);
        const why = kd === 'back' ? nm(v) + ' 是灰的（祖先，還在堆疊上）' : kd === 'fwd' ? nm(v) + ' 是黑的、d[' + nm(u) + '] = ' + d[u] + ' < d[' + nm(v) + '] = ' + d[v] + '（後代）' : nm(v) + ' 是黑的、d[' + nm(v) + '] = ' + d[v] + ' < d[' + nm(u) + '] = ' + d[u] + '（沒有祖先關係）';
        yield { cap: nm(u) + ' → ' + nm(v) + '：' + KIND[kd], f: why, ms: 1400 * k, state: st() };
      }
      col[u] = 2; time++; f[u] = time; nodeColor(u, C.black, 0); lab1(u);
      stk.pop(); sset(); finished.push(u); fset();
      o.onFinish && o.onFinish(u, f);
      yield { cap: nm(u) + ' 的鄰居都看完 → finish' + (times ? '（f = ' + time + '）' : '，回溯'), f: o.topo ? (o.topo === 'append' ? '加到 finished 串列尾端' : '插到輸出串列最前面') : '', ms: 900 * k, state: st() };
    }
    let tree = 0;
    for (const s of order) {
      if (col[s] !== 0) continue;
      tree++;
      o.onRoot && o.onRoot(s, tree);
      yield { cap: '外層迴圈：' + nm(s) + ' 還沒拜訪 → 第 ' + tree + ' 棵樹從 ' + nm(s) + ' 開始', f: 's' + tree + ' = ' + nm(s), ms: 1200 * k, state: st() };
      yield* visit(s);
    }
    run.result = { d, f, par, finished, counts };
    yield { cap: o.endCap || ('DFS 完成：' + tree + ' 棵樹' + (classify ? '；tree ' + counts.tree + '、back ' + counts.back + (und ? '' : '、forward ' + counts.fwd + '、cross ' + counts.cross) : '')), f: o.endF || 'Θ(V + E)', ms: 2600, state: st('<span class="ok">完成</span><br>') };
  }

  // ───────────────────────── Kahn ─────────────────────────
  function* kahnGen(o = {}) {
    const n = GR.n, k = o.k || 1;
    const indeg = Array(n).fill(0);
    GR.edges.forEach((e) => indeg[e.v]++);
    const qs = makeStrip(-4.6, -4.4, 'Queue'), os = makeStrip(-4.6, 4.1, '輸出');
    const Q = [], out = [];
    const upd = () => { qs.set(Q.map((v) => ({ key: 'q' + v, text: nm(v) }))); os.set(out.map((v) => ({ key: 'o' + v, text: nm(v), color: '#cfe3f7' }))); };
    const st = (extra) => ['Kahn（in-degree）', [...Array(n).keys()].map((v) => [nm(v), out.includes(v) ? '已輸出' : 'in-degree ' + indeg[v]]), (extra || '') + 'in-degree = 0 的頂點沒有前置工作，可以先做'];
    for (let v = 0; v < n; v++) nodeTag(v, 'in ' + indeg[v], indeg[v] ? 'ptr' : 'ptr alt');
    yield { cap: '算每個頂點的 in-degree', f: '進來的邊有幾條', ms: 1800 * k, state: st() };
    for (let v = 0; v < n; v++) if (!indeg[v]) Q.push(v);
    Q.forEach((v) => nodeColor(v, C.gray, 0.3)); upd();
    yield { cap: 'in-degree = 0 的放進 queue：' + Q.map(nm).join('、'), f: '', ms: 1500 * k, state: st() };
    while (Q.length) {
      const u = Q.shift(); out.push(u); upd();
      nodeColor(u, C.black, 0); nodeTag(u, '第 ' + out.length, 'ptr');
      yield { cap: '取出 ' + nm(u) + ' → 輸出第 ' + out.length + ' 個', f: '刪掉 ' + nm(u) + ' 的出邊', ms: 1100 * k, state: st() };
      for (const { e, to: v } of adjOf(u)) {
        indeg[v]--; edgeColor(e, C.dim, 0.7);
        nodeTag(v, 'in ' + indeg[v], indeg[v] ? 'ptr' : 'ptr alt');
        if (!indeg[v]) { Q.push(v); nodeColor(v, C.gray, 0.3); upd(); yield { cap: nm(v) + ' 的 in-degree 降到 0 → 進 queue', f: '', ms: 900 * k, state: st() }; }
      }
    }
    if (out.length < n) {
      const left = [...Array(n).keys()].filter((v) => !out.includes(v));
      left.forEach((v) => nodeColor(v, C.back, 0));
      yield { cap: 'queue 空了但還剩 ' + left.map(nm).join('、') + '：有 cycle，沒有 topological order', f: '<span class="no">in-degree 永遠降不到 0</span>', ms: 3000, warn: true, state: st('<span class="no">有 cycle</span><br>') };
      return;
    }
    run.result = { order: out };
    yield { cap: 'Kahn 完成：' + out.map(nm).join(' → '), f: 'Θ(V + E)；順序不唯一', ms: 2600, state: st('<span class="ok">完成</span><br>') };
  }

  // ───────────────────────── SCC：Kosaraju（CLRS 22.5） ─────────────────────────
  function transposeEdges() {
    for (const e of GR.edges) { [e.u, e.v] = [e.v, e.u]; drawEdge(GR, e); }
    computeAdj(GR);
  }
  function* kosarajuGen(o = {}) {
    const n = GR.n, k = o.k || 1;
    yield { cap: '第 1 步：對 G 做 DFS，記下 finishing time', f: 'Kosaraju（CLRS 22.5）', ms: 1800 * k };
    const inner = dfsGen({ classify: false, stack: false, k: 0.55 * k, endCap: '第 1 步完成：每個頂點都有 f', endF: '' });
    for (const s of inner) yield s;
    const f = run.result.f;
    const order = [...Array(n).keys()].sort((a, b) => f[b] - f[a]);
    for (let v = 0; v < n; v++) { nodeColor(v, C.white, 0); nodeTag(v, 'f = ' + f[v], 'ptr'); }
    GR.edges.forEach((e) => { e.cls = null; e.color = C.edge; e.thick = 1; });
    transposeEdges();
    yield { cap: '第 2 步：把所有邊反向，得到 Gᵀ', f: 'Gᵀ 和 G 的 SCC 完全一樣', ms: 2200 * k };
    yield { cap: '第 3 步：在 Gᵀ 上依 f 由大到小當起點做 DFS', f: '順序：' + order.map(nm).join(', '), ms: 2200 * k };
    const comp = Array(n).fill(-1);
    let c = 0;
    for (const s of order) {
      if (comp[s] >= 0) continue;
      const col = SCC_COL[c % SCC_COL.length];
      const stack = [s]; comp[s] = c; const mem = [];
      nodeColor(s, col, 0.3);
      yield { cap: '還沒歸類、f 最大的是 ' + nm(s) + '（f = ' + f[s] + '）→ 從它開始', f: '在 Gᵀ 上走得到的就是同一個 SCC', ms: 1300 * k };
      while (stack.length) {
        const u = stack.pop(); mem.push(u);
        for (const { e, to: v } of adjOf(u)) {
          if (comp[v] < 0) { comp[v] = c; stack.push(v); edgeColor(e, col, 2); nodeColor(v, col, 0.3); yield { cap: nm(u) + ' → ' + nm(v) + '（Gᵀ）：加入這個 SCC', f: '', ms: 800 * k }; }
        }
      }
      mem.forEach((v) => nodeColor(v, col, 0));
      yield { cap: 'SCC ' + (c + 1) + ' = {' + mem.map(nm).sort().join(', ') + '}', f: '走到的都已歸類或是別的 SCC → 停', ms: 1500 * k };
      c++;
    }
    run.result = { comp, count: c };
    yield { cap: '共 ' + c + ' 個 strongly connected components', f: '兩次 DFS + 轉置：Θ(V + E)', ms: 3000 };
  }

  // ───────────────────────── SCC：Tarjan ─────────────────────────
  function* tarjanGen(o = {}) {
    const n = GR.n, k = o.k || 1;
    const idx = Array(n).fill(-1), low = Array(n).fill(0), on = Array(n).fill(false), S = [];
    let index = 0, c = 0;
    const ss = makeStrip(-4.6, -4.4, '堆疊 S');
    const sset = () => ss.set(S.map((v) => ({ key: 's' + v, text: nm(v), color: '#d9cfbd' })));
    const t = (v) => nodeTag(v, 'i ' + idx[v] + '・low ' + low[v], 'ptr alt');
    const st = () => ['Tarjan SCC', [...Array(n).keys()].map((v) => [nm(v), idx[v] < 0 ? '—' : 'index ' + idx[v] + '，low ' + low[v]]), 'low[v] = v 的子樹經由（最多一條）back/cross 邊能碰到、還在堆疊上的最小 index<br>low = index → v 是 SCC 的根'];
    function* sc(v) {
      idx[v] = low[v] = index++; S.push(v); on[v] = true; sset(); t(v); nodeColor(v, C.gray, 0.3);
      yield { cap: '拜訪 ' + nm(v) + '：index = low = ' + idx[v] + '，推進堆疊', f: '', ms: 1000 * k, state: st() };
      for (const { e, to: w } of adjOf(v)) {
        if (idx[w] < 0) {
          edgeColor(e, C.tree, 2);
          yield* sc(w);
          const old = low[v]; low[v] = Math.min(low[v], low[w]); t(v);
          yield { cap: '從 ' + nm(w) + ' 回到 ' + nm(v) + '：low = min(' + old + ', ' + low[w] + ') = ' + low[v], f: '', ms: 1000 * k, state: st() };
        } else if (on[w]) {
          edgeColor(e, C.back, 1.6);
          const old = low[v]; low[v] = Math.min(low[v], idx[w]); t(v);
          yield { cap: nm(v) + ' → ' + nm(w) + '：' + nm(w) + ' 還在堆疊上', f: 'low = min(' + old + ', index ' + idx[w] + ') = ' + low[v], ms: 1200 * k, state: st() };
        } else {
          edgeColor(e, C.dim, 0.8);
          yield { cap: nm(v) + ' → ' + nm(w) + '：' + nm(w) + ' 已屬於別的 SCC，忽略', f: '', ms: 800 * k, state: st() };
        }
      }
      if (low[v] === idx[v]) {
        const col = SCC_COL[c % SCC_COL.length], mem = [];
        let w;
        do { w = S.pop(); on[w] = false; mem.push(w); nodeColor(w, col, 0); } while (w !== v);
        sset(); c++;
        yield { cap: 'low[' + nm(v) + '] = index：彈出 {' + mem.map(nm).sort().join(', ') + '} 成為一個 SCC', f: '', ms: 1600 * k, state: st() };
      }
    }
    for (let v = 0; v < n; v++) if (idx[v] < 0) yield* sc(v);
    yield { cap: 'Tarjan 完成：' + c + ' 個 SCC，只做一次 DFS', f: 'Θ(V + E)', ms: 3000, state: st() };
  }

  // ───────────────────────── Articulation point（無向） ─────────────────────────
  function* apGen(o = {}) {
    const n = GR.n, k = o.k || 1;
    const disc = Array(n).fill(0), low = Array(n).fill(0), par = Array(n).fill(-1), kids = Array(n).fill(0), isAP = Array(n).fill(false);
    let time = 0;
    const bridges = [];
    const t = (v) => nodeTag(v, 'd ' + disc[v] + '・low ' + low[v], isAP[v] ? 'ptr alt' : 'ptr');
    const st = () => ['Articulation point', [...Array(n).keys()].map((v) => [nm(v), disc[v] ? 'd ' + disc[v] + '，low ' + low[v] + (isAP[v] ? '，AP' : '') : '—']), '非根 u：有 child v 使 low[v] ≥ d[u] → u 是 AP<br>根：DFS tree 中 ≥ 2 個 child → AP<br>low[v] > d[u] → (u, v) 是 bridge'];
    function* vis(u) {
      disc[u] = low[u] = ++time; nodeColor(u, C.gray, 0.3); t(u);
      yield { cap: '拜訪 ' + nm(u) + '：d = low = ' + time, f: '', ms: 950 * k, state: st() };
      for (const { e, to: v } of adjOf(u)) {
        if (!disc[v]) {
          par[v] = u; kids[u]++; edgeColor(e, C.tree, 2.2); e.cls = 'tree';
          yield* vis(v);
          low[u] = Math.min(low[u], low[v]); t(u);
          let msg = 'low[' + nm(v) + '] = ' + low[v];
          if (par[u] >= 0 && low[v] >= disc[u]) { isAP[u] = true; nodeColor(u, C.back, 0.3); msg += ' ≥ d[' + nm(u) + '] = ' + disc[u] + ' → ' + nm(u) + ' 是 articulation point'; }
          if (low[v] > disc[u]) { bridges.push(e); edgeColor(e, C.cross, 2.6); msg += '；low > d → (' + nm(u) + ', ' + nm(v) + ') 是 bridge'; }
          t(u);
          yield { cap: '回到 ' + nm(u) + '：low = ' + low[u], f: msg, ms: 1500 * k, state: st() };
        } else if (v !== par[u] && disc[v] < disc[u]) {
          edgeColor(e, C.back, 1.6); e.cls = 'back';
          low[u] = Math.min(low[u], disc[v]); t(u);
          yield { cap: nm(u) + ' – ' + nm(v) + '：back edge，' + nm(u) + ' 繞得回祖先 ' + nm(v), f: 'low[' + nm(u) + '] = min(low, d[' + nm(v) + '] = ' + disc[v] + ') = ' + low[u], ms: 1300 * k, state: st() };
        }
      }
      nodeColor(u, isAP[u] ? C.back : C.black, 0);
    }
    for (let r = 0; r < n; r++) {
      if (disc[r]) continue;
      yield* vis(r);
      if (kids[r] >= 2) { isAP[r] = true; nodeColor(r, C.back, 0); t(r); }
      yield { cap: '根 ' + nm(r) + ' 在 DFS tree 中有 ' + kids[r] + ' 個 child', f: kids[r] >= 2 ? '≥ 2 → 根是 AP' : '只有 1 個 → 根不是 AP', ms: 1600 * k, state: st() };
    }
    const aps = [...Array(n).keys()].filter((v) => isAP[v]);
    yield { cap: 'Articulation points：' + (aps.map(nm).join('、') || '沒有'), f: 'bridges：' + (bridges.map((e) => nm(e.u) + '–' + nm(e.v)).join('、') || '沒有'), ms: 3000, state: st() };
  }

  // ───────────────────────── 互動模式 ─────────────────────────
  const M = { bfsKey: 'bfs22', bfsSrc: 1, dfsKey: 'af', topoKey: 'dress', topoHow: 'dfs', sccKey: 'scc22', sccHow: 'kosaraju', apKey: 'ap' };
  function enterBFS() {
    fresh();
    const G = GRAPHS[M.bfsKey];
    if (M.bfsSrc >= G.names.length) M.bfsSrc = 0;
    buildGraph(G);
    run.gen = bfsGen(M.bfsSrc); run.done = false;
    stepControls(selectHtml('bG', [['bfs22', '課本 CLRS 22.3'], ['rec13', 'Rec13 A～F'], ['fiset', 'Fiset 0～11']], M.bfsKey)
      + '起點 ' + selectHtml('bS', G.names.map((x, i) => [i, x]), M.bfsSrc), enterBFS);
    $('bG').onchange = (e) => { M.bfsKey = e.target.value; M.bfsSrc = 0; clearLog(); enterBFS(); };
    $('bS').onchange = (e) => { M.bfsSrc = Number(e.target.value); clearLog(); enterBFS(); };
    log('BFS：queue 前端取出一個頂點，把「還沒看過」的鄰居設 d + 1 後放到 queue 尾端。');
    setState('BFS', [['圖', G.title], ['起點', G.names[M.bfsSrc]]], '按「下一步」開始');
  }
  function enterDFS() {
    fresh();
    const G = GRAPHS[M.dfsKey];
    buildGraph(G);
    run.gen = dfsGen({}); run.done = false;
    stepControls(selectHtml('dG', [['af', 'L14 a～f'], ['rec14', 'Rec14 A～G'], ['rec14u', 'Rec14 無向'], ['scc22', 'CLRS 22.9'], ['fiset', 'Fiset 0～11（無向）']], M.dfsKey), enterDFS);
    $('dG').onchange = (e) => { M.dfsKey = e.target.value; clearLog(); enterDFS(); };
    log('DFS（CLRS）：發現時記 d、結束時記 f。邊的分類：');
    log('白 → tree；灰（祖先）→ back；黑且 d[u] < d[v] → forward；黑且 d[u] > d[v] → cross。無向圖只會有 tree 與 back。');
    setState('DFS', [['圖', G.title], ['方向', G.directed ? '有向' : '無向']], '按「下一步」開始');
  }
  function enterTopo() {
    fresh();
    const G = GRAPHS[M.topoKey];
    buildGraph(G);
    run.gen = M.topoHow === 'kahn' ? kahnGen() : (function* () {
      const inner = dfsGen({ topo: 'front', classify: true });
      for (const s of inner) {
        if (/back edge/.test(s.cap)) { s.warn = true; s.f += '<br><span class="no">有 back edge = 有 cycle → 不是 DAG</span>'; }
        yield s;
      }
      if (run.result.counts.back) { yield { cap: '出現 back edge：這張圖有 cycle，輸出的順序不合法', f: '<span class="no">topological sort 只適用 DAG</span>', ms: 3000, warn: true }; return; }
      const ord = [...run.result.finished].reverse();
      yield { cap: 'finishing time 由大到小：' + ord.map(nm).join(' → '), f: '把頂點排成一列：所有邊都朝右', ms: 1800 };
      relayout(undefined, lineLayout(ord)).catch(() => {});
      yield { cap: '每條邊 (u, v) 都有 f[u] > f[v]', f: 'Θ(V + E)', ms: 3000 };
    })();
    run.done = false;
    stepControls(selectHtml('tH', [['dfs', 'DFS（f 反序）'], ['kahn', 'Kahn（in-degree）']], M.topoHow)
      + selectHtml('tG', [['dress', '課本：穿衣服'], ['rec14dag', 'Rec14 修課（無 C→A）'], ['rec14', 'Rec14 原圖（有 cycle）']], M.topoKey), enterTopo);
    $('tH').onchange = (e) => { M.topoHow = e.target.value; clearLog(); enterTopo(); };
    $('tG').onchange = (e) => { M.topoKey = e.target.value; clearLog(); enterTopo(); };
    log('Topological sort：把 DAG 排成一列，讓每條邊都從前面指向後面。');
    if (M.topoKey === 'rec14') log('注意：這張圖有 C → A → B → C 的 cycle，看看兩種方法怎麼發現它。', true);
    setState('Topological sort', [['圖', G.title], ['方法', M.topoHow === 'kahn' ? 'Kahn' : 'DFS']], '按「下一步」開始');
  }
  function enterSCC() {
    fresh();
    const G = GRAPHS[M.sccKey];
    buildGraph(G);
    run.gen = M.sccHow === 'tarjan' ? tarjanGen() : kosarajuGen(); run.done = false;
    stepControls(selectHtml('sH', [['kosaraju', 'Kosaraju（CLRS）'], ['tarjan', 'Tarjan']], M.sccHow)
      + selectHtml('sG', [['scc22', 'CLRS 22.9'], ['rec14', 'Rec14 A～G'], ['af', 'L14 a～f']], M.sccKey), enterSCC);
    $('sH').onchange = (e) => { M.sccHow = e.target.value; clearLog(); enterSCC(); };
    $('sG').onchange = (e) => { M.sccKey = e.target.value; clearLog(); enterSCC(); };
    log('Strongly connected component：互相走得到的極大頂點集合。');
    setState('SCC', [['圖', G.title], ['方法', M.sccHow === 'tarjan' ? 'Tarjan' : 'Kosaraju']], '按「下一步」開始');
  }
  function enterAP() {
    fresh();
    const G = GRAPHS[M.apKey];
    buildGraph(G);
    run.gen = apGen(); run.done = false;
    stepControls(selectHtml('aG', [['ap', '自訂例子'], ['fiset', 'Fiset 0～11'], ['bfs22', 'CLRS 22.3']], M.apKey), enterAP);
    $('aG').onchange = (e) => { M.apKey = e.target.value; clearLog(); enterAP(); };
    log('Articulation point：拿掉它（和它的邊）圖就斷成兩塊以上。用 DFS 的 d 與 low 判斷。');
    setState('Articulation point', [['圖', G.title]], '按「下一步」開始');
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  let qs = { score: 0, total: 0 };
  const rnd = (n) => Math.floor(Math.random() * n);
  const LET = 'ABCDEFG';
  function randDigraph(n, m, dag) {
    const E = [];
    let guard = 0;
    while (E.length < m && guard++ < 200) {
      let u = rnd(n), v = rnd(n);
      if (u === v) continue;
      if (dag && u > v) [u, v] = [v, u];
      if (!E.some(([a, b]) => a === u && b === v)) E.push([u, v]);
    }
    return E.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }
  function dfsClassify(n, E) {
    const adj = [...Array(n)].map(() => []);
    E.forEach(([u, v], i) => adj[u].push([v, i]));
    adj.forEach((l) => l.sort((a, b) => a[0] - b[0]));
    const col = Array(n).fill(0), d = Array(n).fill(0), f = Array(n).fill(0), cls = Array(E.length);
    let t = 0;
    const vis = (u) => { d[u] = ++t; col[u] = 1; for (const [v, i] of adj[u]) { if (!col[v]) { cls[i] = 'tree'; vis(v); } else cls[i] = col[v] === 1 ? 'back' : d[u] < d[v] ? 'fwd' : 'cross'; } col[u] = 2; f[u] = ++t; };
    for (let s = 0; s < n; s++) if (!col[s]) vis(s);
    return { cls, d, f };
  }
  function sccCount(n, E) {
    const reach = [...Array(n)].map((_, s) => { const seen = new Set([s]); const st = [s]; while (st.length) { const u = st.pop(); E.forEach(([a, b]) => { if (a === u && !seen.has(b)) { seen.add(b); st.push(b); } }); } return seen; });
    const comp = Array(n).fill(-1); let c = 0;
    for (let v = 0; v < n; v++) if (comp[v] < 0) { for (let w = 0; w < n; w++) if (reach[v].has(w) && reach[w].has(v)) comp[w] = c; c++; }
    return c;
  }
  const es = (E) => E.map(([u, v]) => LET[u] + '→' + LET[v]).join('、');
  function genQ() {
    const t = rnd(6);
    if (t === 0) {
      const n = 5, E = randDigraph(n, 6, false);
      const { cls, d, f } = dfsClassify(n, E);
      const cand = E.map((e, i) => i).filter((i) => cls[i] !== 'tree');
      if (!cand.length) return genQ();
      const i = cand[rnd(cand.length)], [u, v] = E[i];
      return { q: '有向圖：' + es(E) + '\n從 A 開始依字母順序做 DFS（鄰居也依字母順序），邊 ' + LET[u] + '→' + LET[v] + ' 是哪一種？', opts: ['back edge', 'forward edge', 'cross edge', 'tree edge'], ans: KIND[cls[i]],
        why: 'd/f：' + [...Array(n).keys()].map((x) => LET[x] + ' ' + d[x] + '/' + f[x]).join('、') + '。' + (cls[i] === 'back' ? LET[v] + ' 是 ' + LET[u] + ' 的祖先。' : cls[i] === 'fwd' ? LET[v] + ' 是 ' + LET[u] + ' 的後代但不是經由這條邊發現的。' : LET[v] + ' 早已結束、和 ' + LET[u] + ' 沒有祖先關係。') };
    }
    if (t === 1) {
      const n = 5, E = randDigraph(n, 6, true);
      const indeg = Array(n).fill(0); E.forEach(([, v]) => indeg[v]++);
      const order = []; const Q = [...Array(n).keys()].filter((v) => !indeg[v]);
      while (Q.length) { Q.sort((a, b) => a - b); const u = Q.shift(); order.push(u); E.forEach(([a, b]) => { if (a === u && !--indeg[b]) Q.push(b); }); }
      const valid = (ord) => E.every(([a, b]) => ord.indexOf(a) < ord.indexOf(b));
      const ans = order.map((x) => LET[x]).join(' ');
      const opts = [ans];
      let guard = 0;
      while (opts.length < 4 && guard++ < 300) {
        const p = [...Array(n).keys()].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
        const s = p.map((x) => LET[x]).join(' ');
        if (!valid(p) && !opts.includes(s)) opts.push(s);
      }
      if (opts.length < 4) return genQ();
      return { q: 'DAG：' + es(E) + '\n下列何者是合法的 topological order？', opts, ans, why: '每條邊 u→v 都要 u 在前；其他選項至少違反一條邊。（合法順序不唯一，這裡只有一個選項合法。）' };
    }
    if (t === 2) {
      const n = 5, E = randDigraph(n, 6, false);
      const c = sccCount(n, E);
      const opts = [...new Set([c, c + 1, Math.max(1, c - 1), n, 1, 2, 3])].slice(0, 4).map(String);
      if (!opts.includes(String(c))) opts[0] = String(c);
      return { q: '有向圖（頂點 A～E）：' + es(E) + '\n共有幾個 strongly connected components？', opts, ans: String(c), why: '互相走得到的放同一組；單獨一個頂點也算一個 SCC。共 ' + c + ' 個。' };
    }
    if (t === 3) {
      const n = 6, E = [];
      for (let v = 1; v < n; v++) E.push([rnd(v), v]);
      for (let k = 0; k < 2; k++) { const u = rnd(n), v = rnd(n); if (u !== v && !E.some(([a, b]) => (a === u && b === v) || (a === v && b === u))) E.push([u, v]); }
      const d = Array(n).fill(-1); d[0] = 0; const Q = [0];
      while (Q.length) { const u = Q.shift(); E.forEach(([a, b]) => { [[a, b], [b, a]].forEach(([x, y]) => { if (x === u && d[y] < 0) { d[y] = d[u] + 1; Q.push(y); } }); }); }
      const tg = 1 + rnd(n - 1);
      const opts = [...new Set([d[tg], d[tg] + 1, Math.max(1, d[tg] - 1), d[tg] + 2, d[tg] + 3])].slice(0, 4).map(String);
      return { q: '無向圖：' + E.map(([u, v]) => LET[u] + '–' + LET[v]).join('、') + '\n從 A 做 BFS，d(' + LET[tg] + ') = ？', opts, ans: String(d[tg]), why: 'BFS 的 d 是最少邊數：' + d.map((x, i) => LET[i] + '=' + x).join('、') + '。' };
    }
    const bank = [
      { q: '無向圖的 DFS 可能出現哪些邊？', a: '只有 tree edge 和 back edge', d: ['四種都有', 'tree、forward、cross', '只有 tree edge'] },
      { q: '有向圖 G 有 cycle 的充要條件是？', a: 'DFS 出現 back edge', d: ['DFS 出現 cross edge', 'DFS 出現 forward edge', 'BFS 出現已拜訪的頂點'] },
      { q: 'DFS 版 topological sort 的輸出順序？', a: '依 finishing time 由大到小', d: ['依 discovery time 由小到大', '依 finishing time 由小到大', '依 in-degree 由小到大'] },
      { q: 'Kahn 演算法結束時還有頂點沒輸出，代表？', a: '圖有 cycle', d: ['圖不連通', '起點選錯', '需要再跑一次'] },
      { q: 'Kosaraju 第二次 DFS 是在哪張圖、依什麼順序？', a: '在 Gᵀ 上，依第一次 DFS 的 f 由大到小', d: ['在 G 上，依 f 由小到大', '在 Gᵀ 上，依 d 由小到大', '在 G 上，依字母順序'] },
      { q: '用 adjacency list 時，BFS／DFS 的時間？', a: 'Θ(V + E)', d: ['Θ(V²)', 'Θ(E log V)', 'Θ(VE)'] },
      { q: '非根頂點 u 是 articulation point 的條件？', a: 'u 有某個 child v 使 low[v] ≥ d[u]', d: ['u 的 degree ≥ 2', 'low[u] = d[u]', 'u 有 back edge'] },
      { q: 'DFS 中 u → v 是 forward edge，則 d/f 的關係？', a: 'd[u] < d[v] < f[v] < f[u]', d: ['d[v] < d[u] < f[u] < f[v]', 'd[v] < f[v] < d[u] < f[u]', 'd[u] < f[u] < d[v] < f[v]'] },
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
  // ─── 7fujbpJ0LB4：WilliamFiset DFS ───
  async function scFisetWalk(tok) {
    fresh();
    buildGraph(GRAPHS.fiset);
    say('DFS：一路往深處走，走不下去才回頭', '時間 O(V + E)');
    await wait(tok, 2600);
    run.gen = dfsGen({ order: [0], times: false, classify: false, k: 0.75, endCap: '回到 0：走訪完成', endF: '挑邊順序不同，就會走出不同路線' });
    await playGen(tok);
    say('灰 = 還在遞迴中、黑 = 回溯結束（CLRS 慣例）', '藍色邊 = 實際走過的路');
    await wait(tok, 2600);
  }
  async function scFisetCode(tok) {
    fresh([0, 12.5, 8], [0.6, 0, -0.3]);
    buildGraph(GRAPHS.fiset, { scale: 0.62, dx: 2.9, dz: -0.6 });
    const cd = code(['n = 12；g = adjacency list', 'visited = [false, …, false]', 'function dfs(at):', '  if visited[at]: return', '  visited[at] = true', '  for next in g[at]:', '    dfs(next)', 'start = 0；dfs(start)'], -3.7, -3.2, 0.62);
    const ss = makeStrip(-0.6, 4.1, 'dfs 呼叫', 0.95);
    const stk = [];
    const sset = () => ss.set(stk.slice(-7).map((x) => ({ key: x.key, text: 'dfs(' + nm(x.v) + ')', color: '#d9cfbd' })));
    const vis = Array(GR.n).fill(false);
    let calls = 0;
    run.gen = (function* () {
      cd.hl(1); yield { cap: '準備：n、adjacency list g、全為 false 的 visited', f: '', ms: 1800 };
      cd.hl(7); yield { cap: '從 0 開始呼叫 dfs(0)', f: '', ms: 1200 };
      function* dfs(at, e) {
        calls++; stk.push({ key: 'c' + calls, v: at }); sset();
        cd.hl(3);
        if (vis[at]) { yield { cap: 'dfs(' + nm(at) + ')：visited[' + nm(at) + '] 已是 true → return', f: 'base case', ms: 420 }; stk.pop(); sset(); return; }
        cd.hl(4); vis[at] = true; nodeColor(at, C.gray, 0.3); if (e) edgeColor(e, C.tree, 2.2);
        yield { cap: 'visited[' + nm(at) + '] = true', f: 'g[' + nm(at) + '] = [' + adjOf(at).map((p) => nm(p.to)).join(', ') + ']', ms: 750 };
        for (const { e: e2, to } of adjOf(at)) {
          cd.hl(6);
          if (e2.color !== C.tree) edgeColor(e2, C.hot, 1.4);
          yield* dfs(to, vis[to] ? null : e2);
          if (e2.color !== C.tree) edgeColor(e2, C.dim, 0.9);
        }
        nodeColor(at, C.black, 0); stk.pop(); sset();
        yield { cap: 'dfs(' + nm(at) + ') 的鄰居都呼叫過 → 返回', f: '', ms: 420 };
      }
      yield* dfs(0, null);
      cd.hl(-1);
      yield { cap: '每個頂點只會真正拜訪一次', f: '多出來的呼叫碰到 base case 立刻 return', ms: 3000 };
    })();
    run.done = false;
    await playGen(tok, 0.9);
  }
  async function scFisetComponents(tok) {
    fresh();
    buildGraph(GRAPHS.comps);
    const cnt = tag('count = 0', 'ptr alt', -5.6, 0.3, 4.1);
    say('圖分成好幾塊：給同一塊的節點同一個 id', '對每個還沒拜訪的節點啟動一次 DFS');
    await wait(tok, 2600);
    const n = GR.n, comp = Array(n).fill(-1);
    let count = 0;
    for (let s = 0; s < n; s++) {
      if (comp[s] >= 0) { if (s < 6) { nodeColor(s, C.hot, 0.4); say('節點 ' + s + '：已經有 id，跳過', ''); await wait(tok, 700); nodeColor(s, SCC_COL[comp[s] % SCC_COL.length], 0); } continue; }
      const col = SCC_COL[count % SCC_COL.length];
      txt(cnt, 'count = ' + count);
      say('節點 ' + s + ' 還沒拜訪 → 新的 DFS，id = ' + count, 'components[at] = count');
      const st = [s]; comp[s] = count;
      const seq = [];
      while (st.length) {
        const u = st.pop(); seq.push(u);
        nodeColor(u, col, 0.3); nodeTag(u, 'id ' + count, 'ptr');
        await wait(tok, s < 3 ? 650 : 300);
        for (const { e, to } of [...adjOf(u)].reverse()) if (comp[to] < 0) { comp[to] = count; st.push(to); edgeColor(e, col, 2); }
      }
      seq.forEach((u) => nodeColor(u, col, 0));
      if (s <= 1) { say('這一塊：' + seq.join('、') + ' 都標 ' + count, ''); await wait(tok, 1800); }
      count++;
      txt(cnt, 'count = ' + count);
    }
    say('共 ' + count + ' 個 connected components', '每個節點只拜訪一次：O(V + E)');
    await wait(tok, 3200);
  }

  // ─── AfSk24UTFS8：MIT L14 DFS、邊分類、topological sort ───
  async function scDfsVisitCode(tok) {
    fresh([0, 12.5, 8], [0.6, 0, -0.3]);
    buildGraph(GRAPHS.af, { scale: 0.72, dx: 2.6, dz: -0.9 });
    const cd = code(['DFS-visit(Adj, s):', '  for v in Adj[s]:', '    if v not in parent:', '      parent[v] = s', '      DFS-visit(Adj, v)', 'DFS(V, Adj):', '  parent = {}', '  for s in V:', '    if s not in parent:', '      parent[s] = None', '      DFS-visit(Adj, s)'], -3.9, -3.3, 0.6);
    say('DFS 像走迷宮：留麵包屑，死路就回頭', '用遞迴就能做到');
    await wait(tok, 2600);
    const par = {};
    run.gen = (function* () {
      cd.hl(6); yield { cap: 'parent = {}：同時用來記「看過了沒」', f: '', ms: 1500 };
      let r = 0;
      function* visit(s) {
        for (const { e, to: v } of adjOf(s)) {
          cd.hl(1); edgeColor(e, C.hot, 1.4);
          yield { cap: '看 ' + nm(s) + ' 的出邊 → ' + nm(v), f: '', ms: 650 };
          cd.hl(2);
          if (nm(v) in par) { edgeColor(e, C.dim, 0.9); yield { cap: nm(v) + ' 已經在 parent 裡 → 跳過', f: '', ms: 800 }; continue; }
          cd.hl(3); par[nm(v)] = nm(s); edgeColor(e, C.tree, 2.2); nodeColor(v, C.gray, 0.3); nodeNote(v, 'parent = ' + nm(s));
          yield { cap: 'parent[' + nm(v) + '] = ' + nm(s), f: '', ms: 900 };
          cd.hl(4); yield { cap: '遞迴 DFS-visit(' + nm(v) + ')', f: '', ms: 500 };
          yield* visit(v);
          nodeColor(v, C.black, 0);
        }
      }
      for (let s = 0; s < GR.n; s++) {
        cd.hl(7); yield { cap: '外層：s = ' + nm(s), f: '', ms: 500 };
        cd.hl(8);
        if (nm(s) in par) { yield { cap: nm(s) + ' 已經看過 → 跳過', f: '', ms: 550 }; continue; }
        r++; cd.hl(9); par[nm(s)] = null; nodeColor(s, C.gray, 0.3); nodeNote(s, 'parent = None'); nodeTag(s, 's' + r, 'ptr alt');
        yield { cap: nm(s) + ' 沒看過：parent[' + nm(s) + '] = None，第 ' + r + ' 次搜尋', f: 's' + r + ' = ' + nm(s), ms: 1300 };
        cd.hl(10);
        yield* visit(s);
        nodeColor(s, C.black, 0);
      }
      cd.hl(-1);
      yield { cap: 'DFS-visit 只走得到從 s 可達的點；外層確保全部都拜訪', f: '粗藍線 = parent 指標', ms: 3200 };
    })();
    run.done = false;
    await playGen(tok, 0.85);
  }
  async function scDfsClrsRun(tok) {
    fresh();
    buildGraph(GRAPHS.af);
    say('依字母順序：先從 a 開始，再從 c 開始', '標上 discovery / finishing time（CLRS）');
    await wait(tok, 2600);
    run.gen = dfsGen({ classify: false, k: 0.85, onRoot: (s, r) => nodeNote(s, 's' + r) });
    await playGen(tok);
    say('a 到 d 走了 a → b → e → d：長度 3', '其實有 a → d 直達：DFS 不保證最短路徑');
    await wait(tok, 3200);
  }
  async function scDfsRuntime(tok) {
    fresh([0, 12.5, 8], [0.4, 0, -0.3]);
    buildGraph(GRAPHS.af, { scale: 0.62, dx: 3.2, dz: -0.6 });
    const rows = {};
    GR.adj.forEach((l, u) => {
      const z = -3.3 + u * 0.95;
      const h = lab.box('#d9cfbd', [0.8, 0.45, 0.7]); h.add(lab.label(nm(u), 'val')); h.position.set(-5.8, 0.23, z); lab.world.add(h);
      rows[u] = l.map((p, j) => { const m = lab.box(C.q, [0.7, 0.4, 0.6]); m.add(lab.label(nm(p.to), 'val')); m.position.set(-4.8 + j * 0.85, 0.2, z); lab.world.add(m); return m; });
    });
    tag('Adj', 'idx', -5.8, 0.4, -4.2);
    const cnt = tag('呼叫 0 次 + 掃描 0 條邊', 'ptr alt', -3.6, 0.3, 2.6);
    say('輸入：每個頂點一條 adjacency list', 'list 總長 = E（有向）／2E（無向）');
    await wait(tok, 2800);
    let calls = 0, scans = 0;
    const seen = Array(GR.n).fill(false);
    async function visit(u) {
      seen[u] = true; calls++; nodeColor(u, C.gray, 0.3); txt(cnt, '呼叫 ' + calls + ' 次 + 掃描 ' + scans + ' 條邊');
      say('DFS-visit(' + nm(u) + ')：每個頂點最多呼叫一次', '掃 |Adj[' + nm(u) + ']| = ' + adjOf(u).length + ' 條');
      await wait(tok, 900);
      for (let j = 0; j < adjOf(u).length; j++) {
        const { e, to } = adjOf(u)[j];
        scans++; rows[u][j].material.color.set(C.hot); txt(cnt, '呼叫 ' + calls + ' 次 + 掃描 ' + scans + ' 條邊');
        edgeColor(e, seen[to] ? C.dim : C.tree, seen[to] ? 0.9 : 2.2);
        await wait(tok, 600);
        if (!seen[to]) await visit(to);
      }
      nodeColor(u, C.black, 0);
    }
    for (let s = 0; s < GR.n; s++) if (!seen[s]) await visit(s);
    say('呼叫 V = 6 次、掃描 E = 8 條：總共 Θ(V + E)', '線性時間，跟 BFS 一樣');
    await wait(tok, 3400);
  }
  async function scEdgeClassify(tok) {
    fresh();
    buildGraph(GRAPHS.af);
    tag('藍 tree・紅 back・紫 forward・橘 cross', 'idx', 0, 0.3, 4.2);
    say('每條邊被 DFS 看到時，分成四類', '靠白／灰／黑與 d、f 判斷');
    await wait(tok, 2600);
    run.gen = dfsGen({ k: 0.85 });
    await playGen(tok);
    const show1 = async (kd, cap, f) => {
      GR.edges.forEach((e) => { if (e.cls === kd) edgeColor(e, C[kd], 2.6); else edgeColor(e, C.dim, 0.8); });
      say(cap, f); await wait(tok, 2800);
    };
    await show1('tree', 'Tree edge：發現新頂點的邊，構成 DFS forest', 'a→b→e→d、c→f');
    await show1('fwd', 'Forward edge：指向後代的非樹邊', 'a → d：d[a] = 1 < d[d] = 4，d 已黑');
    await show1('back', 'Back edge：指向祖先（含自迴圈）', 'd → b（b 還是灰的）、f → f');
    await show1('cross', 'Cross edge：其他所有邊，沒有祖先關係', 'c → e：e 在另一棵樹，早已結束');
  }
  async function scEdgeUndirected(tok) {
    fresh();
    buildGraph({ directed: false, names: ['s', 'a', 'b', 'c'], pos: [[-4, 0], [-0.8, -2.2], [3, -1.6], [1.8, 2.2]], edges: [[0, 1], [1, 2], [2, 0], [1, 3], [3, 0], [2, 3]] });
    say('無向圖：每條邊會從兩端各被看到一次', '能不能有 forward / cross edge？');
    await wait(tok, 2800);
    run.gen = dfsGen({ k: 0.9 });
    await playGen(tok);
    say('s–b 若是有向圖可能是 forward；無向圖在 b 就先看到它', '→ 被分成 back edge');
    await wait(tok, 3000);
    say('b、c 想當「兩個子樹」？b 一看到 b–c 就走過去', '→ 變成 tree edge，不會有 cross edge');
    await wait(tok, 3000);
    say('無向圖的 DFS：只有 tree edge 和 back edge', '');
    await wait(tok, 2400);
  }
  async function scCycleBackEdge(tok) {
    fresh();
    buildGraph({ directed: true, names: ['r', 'v0', 'v1', 'v2', 'vk'], pos: [[-5.2, -2.4], [-2.4, -2.4], [0.8, -3.4], [3.8, -1.6], [0.6, -0.2]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 1], [1, 3]] });
    say('定理：G 有 cycle ⇔ DFS 出現 back edge', '⇐：back edge + 樹上的路徑 = cycle');
    await wait(tok, 3000);
    say('⇒：令 v0 是 cycle 上第一個被拜訪的頂點', 'cycle：v0 → v1 → v2 → vk → v0');
    await wait(tok, 2800);
    run.gen = dfsGen({ k: 0.8, stack: true });
    await playGen(tok);
    const { d, f } = run.result;
    say('看時間軸：v0 的區間包住 vk 的區間', 'start v0 … start vk … finish vk … finish v0');
    bars([0, 1, 4].map((v) => ({ name: nm(v), d: d[v], f: f[v], color: v === 1 ? '#9b7ef4' : v === 4 ? '#e55a9b' : '#4b9ee2' })), 1.9, 10);
    await wait(tok, 3200);
    say('看到 vk → v0 時 v0 還在堆疊上 → back edge', '線性時間就能判斷有沒有 cycle');
    await wait(tok, 3200);
  }
  async function scTopoDressing(tok) {
    fresh();
    buildGraph(GRAPHS.dress);
    say('Job scheduling：先穿襪子才能穿鞋子', 'DAG：所有邊都要從前面指向後面');
    await wait(tok, 2800);
    run.gen = dfsGen({ topo: 'front', classify: false, k: 0.62, endCap: '全部 finish：輸出串列就是 topological order', endF: '依 f 由大到小' });
    await playGen(tok);
    const ord = [...run.result.finished].reverse();
    say('排成一列：每條邊都朝右', ord.map(nm).join(' → '));
    await relayout(tok, lineLayout(ord));
    await wait(tok, 3400);
  }
  async function scTopoProof(tok) {
    fresh();
    buildGraph({ directed: true, names: ['u', 'v'], pos: [[-2.2, -2.6], [2.2, -2.6]], edges: [[0, 1]] });
    say('要證：每條邊 (u, v) 都有 f[v] < f[u]', '反序後 u 就排在 v 前面');
    await wait(tok, 2800);
    tag('情況 1：u 先開始', 'ptr', -2.8, 0.3, 0.5);
    bars([{ name: 'u', d: 1, f: 4, color: '#4b9ee2' }, { name: 'v', d: 2, f: 3, color: '#9b7ef4' }], 1.2, 4, -5.6, 0);
    say('u 先開始：v 走得到，會在 u 的遞迴裡完整拜訪', '( u ( v v ) u ) → v 先 finish');
    await wait(tok, 3400);
    tag('情況 2：v 先開始', 'ptr', 3.2, 0.3, 0.5);
    bars([{ name: 'v', d: 1, f: 2, color: '#9b7ef4' }, { name: 'u', d: 3, f: 4, color: '#4b9ee2' }], 1.2, 4, 0.6, 5.8);
    say('v 先開始：若 v 走得到 u，加上 (u, v) 就是 cycle', 'DAG 沒有 cycle → v 結束時還沒碰到 u');
    const ghost = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.04, 6, 40, Math.PI), new THREE.MeshBasicMaterial({ color: C.back }));
    ghost.rotation.x = Math.PI / 2; ghost.position.set(0, 0.3, -2.6); lab.world.add(ghost);
    tag('v ⇢ u ✗', 'ptr alt', 0, 0.4, -0.75);
    await wait(tok, 3600);
    say('兩種情況都是 v 先 finish', 'finishing time 反序 = 合法的 topological order');
    await wait(tok, 3000);
  }

  // ─── 5JxShDZ_ylo：MIT Rec13 圖的基礎、BFS ───
  async function scHandshake(tok) {
    fresh();
    buildGraph(GRAPHS.rec13);
    const deg = Array(GR.n).fill(0);
    for (let v = 0; v < GR.n; v++) nodeTag(v, 'deg 0');
    const sum = tag('Σ deg = 0', 'ptr alt', 0, 0.3, 4.1);
    say('degree：一個頂點連了幾條邊', '每條邊給兩端各加 1');
    await wait(tok, 2400);
    for (const e of GR.edges) {
      edgeColor(e, C.hot, 2);
      for (const x of [e.u, e.v]) { deg[x]++; nodeTag(x, 'deg ' + deg[x]); }
      txt(sum, 'Σ deg = ' + deg.reduce((a, b) => a + b, 0));
      say('邊 ' + nm(e.u) + '–' + nm(e.v) + '：' + nm(e.u) + ' 和 ' + nm(e.v) + ' 各 +1', 'Σ deg = ' + deg.reduce((a, b) => a + b, 0));
      await wait(tok, 1000);
      edgeColor(e, C.edge, 1);
    }
    say('Handshaking lemma：Σ deg = 2|E|', '5 條邊 → 10；F 不連任何邊，deg 0');
    await wait(tok, 3000);
    fresh();
    buildGraph({ ...GRAPHS.rec13, directed: true }, { noDrop: true });
    const io = [...Array(GR.n)].map(() => [0, 0]);
    for (let v = 0; v < GR.n; v++) nodeTag(v, 'out 0・in 0');
    say('有向圖：沒有 degree，只有 out-degree 與 in-degree', '');
    await wait(tok, 2200);
    for (const e of GR.edges) {
      io[e.u][0]++; io[e.v][1]++;
      edgeColor(e, C.hot, 2);
      [e.u, e.v].forEach((x) => nodeTag(x, 'out ' + io[x][0] + '・in ' + io[x][1]));
      await wait(tok, 800);
      edgeColor(e, C.edge, 1);
    }
    say('每條邊給起點 out +1、終點 in +1', 'Σ out-degree = Σ in-degree = |E| = 5');
    await wait(tok, 3200);
  }
  async function scRepresentation(tok) {
    fresh([0, 12.5, 8], [0.4, 0, -0.3]);
    const G5 = { ...GRAPHS.rec13, names: GRAPHS.rec13.names.slice(0, 5), pos: GRAPHS.rec13.pos.slice(0, 5) };
    buildGraph(G5, { scale: 0.62, dx: -3.6, dz: -0.6 });
    say('Adjacency list：每個頂點一條鄰居串列', 'Python 用 dictionary');
    await wait(tok, 2200);
    let words = 0;
    const wl = tag('空間：0 個 word', 'ptr alt', 2.4, 0.3, 4.0);
    for (let u = 0; u < 5; u++) {
      const z = -3.4 + u * 1.0;
      const h = lab.box('#d9cfbd', [0.8, 0.45, 0.7]); h.add(lab.label(nm(u), 'val')); h.position.set(0.4, 0.23, z); lab.world.add(h);
      words++;
      for (let j = 0; j < adjOf(u).length; j++) {
        const m = lab.box(C.q, [0.7, 0.4, 0.6]); m.add(lab.label(nm(adjOf(u)[j].to), 'val'));
        m.position.set(1.4 + j * 0.85, 2.5, z); const b = lab.addBody(m); lab.dropTo(b, V(1.4 + j * 0.85, 0.2, z));
        words++;
      }
      txt(wl, '空間：' + words + ' 個 word');
      say(nm(u) + ': [' + adjOf(u).map((p) => nm(p.to)).join(', ') + ']', '串列長度 = deg(' + nm(u) + ')');
      await wait(tok, 1100);
    }
    say('串列總長 = Σdeg = 2E = 10；再加 V 個串列頭', 'O(V + E) 個 word');
    await wait(tok, 3000);
    fresh([0, 12.5, 8], [0.4, 0, -0.3]);
    buildGraph(G5, { scale: 0.62, dx: -3.6, dz: -0.6, noDrop: true });
    say('Adjacency matrix：V × V 的 0/1 表', '有邊就填 1');
    const mx = (j) => 0.9 + j * 0.95, mz = (i) => -2.8 + i * 0.95;
    for (let i = 0; i < 5; i++) { tag(nm(i), 'idx', 0.1, 0.3, mz(i)); tag(nm(i), 'idx', mx(i), 0.3, -3.7); }
    const cells = [];
    for (let i = 0; i < 5; i++) { cells.push([]); for (let j = 0; j < 5; j++) { const m = lab.box('#efe6d2', [0.82, 0.12, 0.82]); m.position.set(mx(j), 0.06, mz(i)); m.userData.l = lab.label('0', 'idx'); m.add(m.userData.l); lab.world.add(m); cells[i].push(m); } }
    await wait(tok, 2000);
    for (const e of GR.edges) {
      edgeColor(e, C.hot, 2);
      for (const [i, j] of [[e.u, e.v], [e.v, e.u]]) { const m = cells[i][j]; m.material.color.set('#4b9ee2'); m.scale.y = 3; m.position.y = 0.18; txt(m.userData.l, '1'); }
      say('邊 ' + nm(e.u) + '–' + nm(e.v) + '：兩格填 1（對稱）', '');
      await wait(tok, 900);
      edgeColor(e, C.edge, 1);
    }
    say('需要 V² 個 bit；list 是 V + E 個 word', '很稠密的圖用 matrix 可能更省');
    await wait(tok, 3400);
  }
  async function scBfsQueue(tok) {
    fresh();
    buildGraph(GRAPHS.rec13);
    say('BFS 從 A 出發：用 queue 一層一層走', '「看過了沒」用 hash table');
    await wait(tok, 2600);
    run.gen = bfsGen(0, { k: 0.9 });
    await playGen(tok);
    say('已看過的頂點不能再更新距離', '否則 A 會被改成 2');
    await wait(tok, 2600);
  }
  async function scBfsRuntime(tok) {
    fresh([0, 12.5, 8], [0.4, 0, -0.3]);
    const G5 = { ...GRAPHS.rec13, names: GRAPHS.rec13.names.slice(0, 5), pos: GRAPHS.rec13.pos.slice(0, 5) };
    buildGraph(G5, { scale: 0.55, dx: -4.2, dz: -1.6 });
    tag('Matrix：列鄰居要掃整列', 'ptr', 0.4, 0.3, -4.2);
    tag('List：只看自己的串列', 'ptr', 0.4, 0.3, 0.9);
    const cm = tag('掃了 0 格', 'ptr alt', 5.4, 0.3, -4.2), cl = tag('掃了 0 個', 'ptr alt', 5.4, 0.3, 0.9);
    const mat = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
      const m = lab.box('#efe6d2', [0.5, 0.1, 0.5]); m.position.set(-1.2 + j * 0.58, 0.05, -3.4 + i * 0.58); lab.world.add(m); mat.push(m);
    }
    const lst = [];
    for (let u = 0; u < 5; u++) adjOf(u).forEach((p, j) => { const m = lab.box(C.q, [0.5, 0.3, 0.45]); m.add(lab.label(nm(p.to), 'val')); m.position.set(-1.2 + j * 0.62, 0.15, 1.6 + u * 0.55); lab.world.add(m); lst.push([u, m]); });
    for (let u = 0; u < 5; u++) tag(nm(u), 'idx', -1.9, 0.3, 1.6 + u * 0.55);
    say('BFS 拜訪每個頂點時，要列出它的鄰居', '同一張圖，兩種表示法');
    await wait(tok, 2400);
    let a = 0, b = 0;
    for (let u = 0; u < 5; u++) {
      for (let j = 0; j < 5; j++) { mat[u * 5 + j].material.color.set(C.hot); a++; }
      lst.filter(([x]) => x === u).forEach(([, m]) => { m.material.color.set(C.hot); b++; });
      txt(cm, '掃了 ' + a + ' 格'); txt(cl, '掃了 ' + b + ' 個');
      say('拜訪 ' + nm(u) + '：matrix 掃 V = 5 格；list 掃 deg = ' + adjOf(u).length + ' 個', '');
      await wait(tok, 1100);
    }
    say('Matrix：V × V = 25 → O(V²)', 'List：V + Σdeg = 5 + 10 → O(V + E)');
    await wait(tok, 3600);
  }

  // ─── C5SPsY72_CM：MIT Rec14 DFS、邊分類、修課順序 ───
  async function scRec14Parent(tok) {
    fresh();
    buildGraph(GRAPHS.rec14);
    say('adjacency list：A 的串列是 [B, G]', 'B 只有 [C]：邊有方向，B 走不回 A');
    await wait(tok, 2800);
    const ds = makeStrip(-4.6, 4.1, 'parent', 1.25);
    const P = [];
    run.gen = dfsGen({ times: false, classify: false, k: 0.85,
      onRoot: (s) => { P.push({ key: 'p' + s, text: nm(s) + ': None' }); ds.set(P); nodeNote(s, 'parent = None'); },
      onScan: (u, v) => { if (!P.some((x) => x.key === 'p' + v)) { P.push({ key: 'p' + v, text: nm(v) + ': ' + nm(u) }); ds.set(P); nodeNote(v, 'parent = ' + nm(u)); } },
      endCap: 'parent 指標畫出的就是 DFS tree', endF: 'A → B → C → D → {E, F}，A → G' });
    await playGen(tok);
    await wait(tok, 1500);
  }
  async function scRec14Classify(tok) {
    fresh();
    buildGraph(GRAPHS.rec14);
    tag('藍 tree・紅 back・紫 forward・橘 cross', 'idx', 0, 0.3, 4.2);
    say('同一個 DFS，把每條邊分類', 'DFS 有走過 → tree edge，其他不用再判斷');
    await wait(tok, 2600);
    run.gen = dfsGen({ k: 0.85 });
    await playGen(tok);
    say('C → F：forward（F 是 C 的後代）', 'G → C：cross；C → A：back');
    await wait(tok, 3000);
    say('判斷：有走 → tree；u 是祖先 → forward', 'v 是祖先 → back；其他 → cross');
    await wait(tok, 3000);
  }
  async function scRec14Undirected(tok) {
    fresh();
    buildGraph(GRAPHS.rec14u);
    say('同一張圖拿掉箭頭：變成無向圖', '還是依字母順序做 DFS');
    await wait(tok, 2600);
    run.gen = dfsGen({ k: 0.85 });
    await playGen(tok);
    say('C–A、F–C、G–A 都是 back edge', '無向圖沒有 forward、也沒有 cross');
    await wait(tok, 3200);
  }
  async function scRec14Courses(tok) {
    fresh();
    buildGraph(GRAPHS.rec14);
    say('頂點是課、邊是先修：A → B 表示先修 A', 'A → B → C → A 有 cycle：無解');
    const ce = GR.edges.find((e) => e.u === 2 && e.v === 0);
    edgeColor(ce, C.back, 2.4);
    await wait(tok, 3000);
    fresh();
    buildGraph(GRAPHS.rec14dag, { noDrop: true });
    say('拿掉 C → A：變成 DAG', '跑 DFS，結束時把頂點加到 finished');
    await wait(tok, 2400);
    run.gen = dfsGen({ topo: 'append', classify: false, times: false, k: 0.7, endCap: 'finished = E, F, D, C, B, G, A', endF: '第一個結束的 E 沒有課依賴它 → 最後修' });
    await playGen(tok);
    const ord = [...run.result.finished].reverse();
    say('r.finished.reverse()：' + ord.map(nm).join(', '), '這就是修課順序');
    await relayout(tok, lineLayout(ord));
    await wait(tok, 3400);
  }
  async function scBackEdgeBreaks(tok) {
    fresh();
    buildGraph(GRAPHS.rec14);
    say('如果留著 C → A 呢？', 'C → A 是 back edge');
    await wait(tok, 2400);
    run.gen = dfsGen({ topo: 'front', k: 0.6 });
    await playGen(tok);
    const ord = [...run.result.finished].reverse();
    await relayout(tok, lineLayout(ord));
    const ce = GR.edges.find((e) => e.u === 2 && e.v === 0);
    edgeColor(ce, C.back, 2.8);
    say('C → A 指向左邊：要求 A 排在 C 後面', '但 DFS 一定先離開 C、再離開 A');
    await wait(tok, 3400);
    say('back edge = cycle → 沒有合法順序', '只有 DAG 才能 topological sort');
    await wait(tok, 3000);
  }

  // ─── 課本補充（CLRS 第 22 章） ───
  async function scBfsClrs(tok) {
    fresh();
    buildGraph(GRAPHS.bfs22);
    say('例子：從 s 做 BFS', 'd[v] = 最少邊數，π 畫出 BFS tree');
    await wait(tok, 2400);
    run.gen = bfsGen(1, { k: 0.75 });
    await playGen(tok);
    say('BFS tree 上 s 到 v 的路徑就是一條最短路徑', '第 k 層 = 距離 k 的頂點');
    await wait(tok, 3000);
  }
  async function scKahn(tok) {
    fresh();
    buildGraph(GRAPHS.dress);
    say('另一種 topological sort：Kahn 演算法', '不斷拿走 in-degree = 0 的頂點');
    await wait(tok, 2600);
    run.gen = kahnGen({ k: 0.75 });
    await playGen(tok);
    const ord = run.result ? run.result.order : [];
    if (ord.length) { await relayout(tok, lineLayout(ord)); }
    say('和 DFS 版答案不同，但同樣合法', '結束時有頂點沒輸出 → 有 cycle');
    await wait(tok, 3200);
  }
  async function scKosaraju(tok) {
    fresh();
    buildGraph(GRAPHS.scc22);
    say('SCC：互相走得到的極大頂點集合', '例子（CLRS 圖 22.9）');
    await wait(tok, 2600);
    run.gen = kosarajuGen({ k: 0.8 });
    await playGen(tok);
  }
  async function scTarjan(tok) {
    fresh();
    buildGraph(GRAPHS.scc22);
    say('Tarjan：只做一次 DFS，用 index 與 low', '同一張圖（CLRS 圖 22.9）');
    await wait(tok, 2600);
    run.gen = tarjanGen({ k: 0.7 });
    await playGen(tok);
  }
  async function scAP(tok) {
    fresh();
    buildGraph(GRAPHS.ap);
    say('Articulation point：拿掉就讓圖斷開的頂點', 'DFS + low 值（例子自訂）');
    await wait(tok, 2600);
    run.gen = apGen({ k: 0.85 });
    await playGen(tok);
  }

  const scenes = {
    'dfs-fiset-walk': { title: 'DFS 走訪：0 → 9 → 8 → 7 … 回溯', play: scFisetWalk },
    'dfs-fiset-code': { title: '遞迴 dfs(at) 與 visited 陣列', play: scFisetCode },
    'dfs-fiset-components': { title: '用 DFS 標記 connected components', play: scFisetComponents },
    'dfs-visit-code': { title: 'DFS-visit 與外層 DFS：parent 字典', play: scDfsVisitCode },
    'dfs-clrs-run': { title: 'a～f 的 DFS：discovery / finishing time', play: scDfsClrsRun },
    'dfs-runtime': { title: 'DFS 為什麼是 Θ(V + E)', play: scDfsRuntime },
    'edge-classify': { title: '邊的分類：tree / forward / back / cross', play: scEdgeClassify },
    'edge-undirected': { title: '無向圖只有 tree edge 與 back edge', play: scEdgeUndirected },
    'cycle-back-edge': { title: '有 cycle ⇔ 有 back edge', play: scCycleBackEdge },
    'topo-dressing': { title: 'Topological sort：穿衣服（f 反序）', play: scTopoDressing },
    'topo-proof': { title: '為什麼 finishing time 反序是對的', play: scTopoProof },
    'graph-handshake': { title: 'Handshaking lemma：Σ deg = 2|E|', play: scHandshake },
    'graph-representation': { title: 'Adjacency list vs adjacency matrix', play: scRepresentation },
    'bfs-queue': { title: 'BFS from A：queue 與 d 值', play: scBfsQueue },
    'bfs-runtime': { title: 'BFS 時間：matrix O(V²) vs list O(V + E)', play: scBfsRuntime },
    'dfs-rec14-parent': { title: 'Rec14：用 parent 字典記錄 DFS', play: scRec14Parent },
    'edge-rec14-classify': { title: 'Rec14：C→F forward、G→C cross、C→A back', play: scRec14Classify },
    'edge-rec14-undirected': { title: 'Rec14：無向版只剩 tree 與 back', play: scRec14Undirected },
    'topo-rec14-courses': { title: '修課順序：finished 反轉 = A G B C D F E', play: scRec14Courses },
    'topo-back-edge-breaks': { title: 'Back edge 讓 topological sort 失敗', play: scBackEdgeBreaks },
    'bfs-clrs-tree': { title: '課本：BFS tree 與最短距離（CLRS 22.3）', play: scBfsClrs },
    'topo-kahn': { title: '課本：Kahn 演算法（in-degree）', play: scKahn },
    'scc-kosaraju': { title: '課本：SCC（Kosaraju：DFS、轉置、再 DFS）', play: scKosaraju },
    'scc-tarjan': { title: '課本：SCC（Tarjan 的 low-link）', play: scTarjan },
    'articulation-points': { title: '課本：Articulation point 與 bridge', play: scAP },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ graphbari.js ═══
  {
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, line, GOLD, step, travel, remove, anim, buddy } = K;
// ds-7 module helpers this fragment relies on (copied so it also runs in alg-6)
const colorFor = ctx.colorFor;
  const COL = { idle: '#cdbfa6', visit: '#2fc092', edge: '#9c8b70', tree: '#c08a1f', dim: '#e6ddcf', hot: '#d64545', one: '#4b9ee2', neg: '#e55a9b', zero: '#efe5d3', diag: '#e2d6c2' };
const UP = V3(0, 1, 0);
const ek = (u, v) => Math.min(u, v) + '-' + Math.max(u, v);
// remove a static object together with every CSS2D label inside it
const drop = (o) => { lab.world.remove(o); o.traverse((c) => { if (c.element) c.element.remove(); }); };

// ───────────────────────── 共用：頂點、邊、圖 ─────────────────────────
function vertexMesh(name, pos, color, size = [0.8, 0.6, 0.8]) {
  const m = lab.box(color, size);
  m.add(lab.label(String(name), 'val'));
  m.position.copy(pos);
  lab.world.add(m);
  return m;
}
// an edge = a thin rod between two vertex blocks (plus a cone when directed)
function edgeMesh(a, b, o = {}) {
  const gap = o.gap ?? 0.5, r = o.r ?? 0.05, off = o.off || 0;
  const n = b.clone().sub(a).normalize();
  const side = V3(-n.z, 0, n.x).multiplyScalar(off);
  const s = a.clone().addScaledVector(n, gap).add(side);
  const e = b.clone().addScaledVector(n, -gap).add(side);
  const L = Math.max(0.05, s.distanceTo(e) - (o.directed ? 0.3 : 0));
  const mat = new THREE.MeshStandardMaterial({ color: o.color || COL.edge, roughness: 0.6 });
  const g = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 8), mat);
  cyl.position.copy(s).addScaledVector(n, L / 2);
  cyl.quaternion.setFromUnitVectors(UP, n);
  cyl.castShadow = true;
  g.add(cyl);
  if (o.directed) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.32, 12), mat);
    cone.position.copy(e).addScaledVector(n, -0.16);
    cone.quaternion.setFromUnitVectors(UP, n);
    g.add(cone);
  }
  g.userData = { mat, cyl };
  lab.world.add(g);
  return g;
}
function paintEdge(g, color, thick) {
  if (!g) return;
  g.userData.mat.color.set(color);
  const k = thick ? 1.9 : 1;
  g.userData.cyl.scale.set(k, 1, k);
}
function ringXY(V, R) {
  return Array.from({ length: V }, (_, i) => { const a = Math.PI / 2 - i * 2 * Math.PI / V; return [Math.cos(a) * R, -Math.sin(a) * R]; });
}
function adjOf(V, edges) {
  const A = Array.from({ length: V }, () => []);
  edges.forEach(([u, v]) => { A[u].push(v); A[v].push(u); });
  A.forEach((l) => l.sort((x, y) => x - y));
  return A;
}

// ─── pcKY4hjDrxk：Abdul Bari〈Graph Traversals - BFS & DFS〉— cued: every step(tok) waits for the sentence it shows ───
// 老師的例子：小樹 1–{2,4,5}、2–{3,6,7}；binary tree 1..7；大圖 10 個頂點、13 條邊：
// 1-2 1-4 2-3 2-5 2-7 2-8 3-4 3-9 3-10 5-6 5-7 5-8 7-8（由逐字稿的鄰接關係重建）。
// 鄰居順序照老師口述（pref），其餘依編號小到大。圖畫在地板左半；右半是 queue／stack、結果列與直立的生成樹。
// gbRun 的 o.at = { 事件編號: [null | fn, …] }：在那個事件前，每一項都先 await step(tok)（fn 在該步執行），
// 沒列在 at 的事件只等 o.gap 毫秒（一小段動作），所以畫面只在老師說到時才前進。
const GB_SMALL = { pos: { 1: [-3.6, -2.6], 2: [-5.6, -0.1], 4: [-3.6, -0.1], 5: [-1.6, -0.1], 3: [-6.5, 2.5], 6: [-5.4, 2.5], 7: [-4.3, 2.5] },
  edges: [[1, 2], [1, 4], [1, 5], [2, 3], [2, 6], [2, 7]] };
const GB_BIN = { pos: { 1: [-3.6, -2.6], 2: [-5.4, 0], 3: [-1.8, 0], 4: [-6.3, 2.6], 5: [-4.5, 2.6], 6: [-2.7, 2.6], 7: [-0.9, 2.6] },
  edges: [[1, 2], [1, 3], [2, 4], [2, 5], [3, 6], [3, 7]] };
const GB_BIG = { pos: { 1: [-5.2, -2.6], 4: [-2.8, -2.6], 2: [-5.2, 0.2], 3: [-2.8, 0.2], 10: [-0.8, -1.2], 9: [-0.8, 1.6], 7: [-5.2, 2.6], 5: [-6.6, 3.8], 8: [-3.8, 3.8], 6: [-5.2, 4.9] },
  edges: [[1, 2], [1, 4], [2, 3], [2, 5], [2, 7], [2, 8], [3, 4], [3, 9], [3, 10], [5, 6], [5, 7], [5, 8], [7, 8]] };
const GB_CAM = [0, 8.5, 11], GB_LOOK = [0, 1.6, 0.6], GB_TZ = -2.4, GB_DONE = '#1d8a68';
const GB_BFS1 = { 1: [4, 2], 2: [3, 5, 8, 7], 3: [10, 9], 5: [8, 7, 6] };
const GB_DFS1 = { 1: [4, 2], 3: [10, 9, 2], 2: [8], 8: [7], 7: [5], 5: [6] };

function gbGraph(spec) {
  const vs = {}, es = {}, adj = {};
  for (const k in spec.pos) { const [x, z] = spec.pos[k]; vs[k] = vertexMesh(k, V3(x, 0.3, z), COL.idle, [0.7, 0.6, 0.7]); adj[k] = []; }
  for (const [u, v] of spec.edges) { es[ek(u, v)] = edgeMesh(vs[u].position, vs[v].position, { gap: 0.42 }); adj[u].push(v); adj[v].push(u); }
  const G = { vs, es, adj, edges: spec.edges, cur: null };
  G.reset = () => { for (const k in vs) { tint(vs[k], COL.idle); glow(vs[k], null); } for (const k in es) paintEdge(es[k], COL.edge, false); G.cur = null; };
  return G;
}
// a little note floating over a vertex (removed by the caller)
const gbNote = (G, v, text, cls = 'note') => { const p = G.vs[v].position; return tag(text, cls, p.x, 1.25, p.z); };
// neighbour order: the lecturer's preferred ones first, the rest ascending
function gbOrd(A, pref = {}) {
  const O = {};
  for (const k in A) { const p = (pref[k] || []).filter((x) => A[k].includes(x)); O[k] = p.concat(A[k].filter((x) => !p.includes(x)).sort((a, b) => a - b)); }
  return O;
}
function gbBfsEv(O, s) {
  const ev = [{ t: 'visit', v: s, p: null }], vis = { [s]: 1 }, q = [s];
  while (q.length) {
    const u = q.shift(); ev.push({ t: 'explore', v: u });
    for (const w of O[u]) if (!vis[w]) { vis[w] = 1; q.push(w); ev.push({ t: 'visit', v: w, p: u }); }
    ev.push({ t: 'done', v: u });
  }
  return ev;
}
function gbDfsEv(O, s) {
  const ev = [], vis = {};
  (function rec(v, p) {
    vis[v] = 1; ev.push({ t: 'visit', v, p });
    for (const w of O[v]) if (!vis[w]) { rec(w, v); ev.push({ t: 'back', v, from: w }); }
    ev.push({ t: 'done', v });
  })(s, null);
  return ev;
}
// a floor row of small cubes (queue / stack / result), x = 1.0 + 0.62 i
function gbRow(z, label) {
  tag(label, 'idx', 2.2, 0.05, z - 0.62);
  const R = { items: [], vals: [] };
  const X = (i) => 1.0 + i * 0.62;
  R.push = (v, color) => { R.items.push(cube(v, color, [0.5, 0.5, 0.5], X(R.items.length), 0.25, z, 1.6)); R.vals.push(v); };
  R.shift = () => { fly(R.items.shift(), V3(0, 6, -3)); R.vals.shift(); R.items.forEach((m, i) => move(m, X(i), 0.25, z)); };
  R.pop = () => { fly(R.items.pop(), V3(0, 6, -3)); R.vals.pop(); };
  R.top = () => R.items[R.items.length - 1];
  R.head = () => R.items[0];
  return R;
}
// spanning-tree layout (upright, plane z = GB_TZ): leaves get slots left to right, parents sit over their children
function gbLayout(order, par) {
  const kids = {}; order.forEach((v) => { kids[v] = []; });
  order.forEach((v) => { if (par[v] !== null) kids[par[v]].push(v); });
  const depth = {}, x = {}; let leaf = 0, maxD = 0;
  (function walk(v, d) {
    depth[v] = d; maxD = Math.max(maxD, d);
    if (!kids[v].length) { x[v] = leaf++; return; }
    kids[v].forEach((c) => walk(c, d + 1));
    x[v] = (x[kids[v][0]] + x[kids[v][kids[v].length - 1]]) / 2;
  })(order[0], 0);
  const sx = Math.min(1.1, 5.4 / Math.max(1, leaf - 1)), dy = Math.min(1.3, 5.2 / Math.max(1, maxD));
  const pos = {}; for (const v of order) pos[v] = [3.7 + (x[v] - (leaf - 1) / 2) * sx, 6.0 - depth[v] * dy];
  return pos;
}
// a dashed arc between two tree nodes (non-tree edge)
function gbArc(a, b, color = '#d64545') {
  const T = ctx.THREE, p = V3(a[0], a[1], GB_TZ), q = V3(b[0], b[1], GB_TZ);
  const mid = p.clone().add(q).multiplyScalar(0.5), d = q.clone().sub(p);
  mid.add(V3(-d.y, d.x, 0).normalize().multiplyScalar(0.45));
  const geo = new T.BufferGeometry().setFromPoints(new T.QuadraticBezierCurve3(p, mid, q).getPoints(16));
  const l = new T.Line(geo, new T.LineDashedMaterial({ color, dashSize: 0.14, gapSize: 0.1 }));
  l.computeLineDistances(); lab.world.add(l); return l;
}
// run BFS / DFS on graph G and animate it; returns { order, par, pos }
async function gbRun(tok, G, o) {
  const O = gbOrd(G.adj, o.pref), ev = o.kind === 'bfs' ? gbBfsEv(O, o.s) : gbDfsEv(O, o.s);
  const bfs = o.kind === 'bfs', order = [], par = {}, all = [];
  ev.forEach((e) => { if (e.t === 'visit') { par[e.v] = e.p; all.push(e.v); } });
  const pos = o.tree ? gbLayout(all, par) : null;
  if (o.state) Object.assign(o.state, { par, pos });
  const gap = o.gap ?? 450, at = o.at || {}, hand = gap >= 300;
  let res = null, box = null;
  const cont = [];
  const fm = () => (box ? (bfs ? 'queue：' : 'stack：') + (cont.join(' ') || '空') + '　' : '') + '結果：' + order.join(' ');
  for (let k = 0; k < ev.length; k++) {
    const e = ev[k], m = G.vs[e.v];
    const last = k === ev.length - 1;
    const shows = e.t !== 'done' || (!bfs && last);
    if (at[k]) { for (const f of at[k]) { await step(tok); if (f) f(); } }
    else if (shows && gap) await beat(tok, gap);
    if (!res) {
      res = gbRow(o.rowZ ?? 3.4, o.rowLabel || (bfs ? 'BFS 結果' : 'DFS 結果'));
      box = o.contZ === null ? null : gbRow(o.contZ ?? 1.4, bfs ? 'queue（左邊是前端）' : 'stack（右邊是頂端）');
    }
    if (e.t === 'visit') {
      if (hand && e.p !== null) {
        const a = G.vs[e.p].position, b = m.position;
        const h = tag('→', 'pkt', a.x, 1.0, a.z);
        await travel(tok, h, V3(a.x, 1.0, a.z), V3(b.x, 1.0, b.z), 320);
        remove(h);
      }
      order.push(e.v); tint(m, COL.visit);
      if (e.p !== null) paintEdge(G.es[ek(e.p, e.v)], COL.tree, true);
      res.push(e.v, COL.visit);
      if (box) { cont.push(e.v); box.push(e.v, '#4b9ee2'); }
      if (pos) {
        const [x, y] = pos[e.v];
        cube(e.v, COL.visit, [0.5, 0.5, 0.5], x, y, GB_TZ, 0.8);
        if (e.p !== null) { const [px, py] = pos[e.p]; line(px, py - 0.25, x, y + 0.25, GB_TZ, '#c08a1f'); }
      }
      if (!bfs) { if (G.cur) glow(G.cur, null); glow(m, GOLD); G.cur = m; }
      say(e.p === null ? '從 ' + e.v + ' 開始：拜訪 ' + e.v : bfs ? '拜訪 ' + e.v + '，放進 queue' : e.p + ' 暫停，拜訪 ' + e.v, fm());
    } else if (e.t === 'explore') {
      cont.shift(); if (box) box.shift();
      if (G.cur) glow(G.cur, null);
      glow(m, GOLD); G.cur = m;
      const none = ev[k + 1].t === 'done';
      say(none ? '探索 ' + e.v + '：沒有新的鄰居' : '取出 ' + e.v + '，開始探索', fm());
    } else if (e.t === 'done') {
      glow(m, null); tint(m, GB_DONE);
      if (G.cur === m) G.cur = null;
      if (!bfs) {
        cont.pop(); if (box) box.pop();
        if (last) say(e.v + ' 探索完，全部結束', fm());
      }
    } else if (e.t === 'back') {
      if (G.cur) glow(G.cur, null);
      glow(m, GOLD); G.cur = m;
      say(e.from + ' 探索完 → 回到 ' + e.v, fm());
    }
  }
  if (G.cur) glow(G.cur, null); G.cur = null;
  return { order, par, pos };
}
// paint the edges that are not tree edges (cross / back edges); with a tree, draw them dashed there too
function gbNonTree(G, r) {
  const out = [];
  for (const [u, v] of G.edges) {
    if (r.par[u] === v || r.par[v] === u) continue;
    paintEdge(G.es[ek(u, v)], '#d64545', false); out.push(u + '-' + v);
    if (r.pos) gbArc(r.pos[u], r.pos[v]);
  }
  return out;
}

// 00:00 visit 與 explore
FRAG.push(['graphbari-terms', 'visit 與 explore：走訪的兩個動作', async (tok) => {
  fresh(GB_CAM, GB_LOOK);
  await step(tok);                                   // 0:00 BFS and DFS: two graph traversals
  tag('BFS = breadth first search（廣度優先）', 'say', 2.6, 1.6, -2.4);
  tag('DFS = depth first search（深度優先）', 'say', 2.6, 1.6, -1.2);
  say('BFS、DFS：兩種 graph traversal', 'traversal = 把每個頂點都走過一遍');
  await step(tok);                                   // 0:27 a small example — a tree, and a tree is a graph
  const G = gbGraph(GB_SMALL);
  say('先看小例子：其實是一棵樹', 'tree 也是一種 graph');
  await step(tok);                                   // 0:43 visiting = going onto a vertex
  const me = buddy('', '', '#f4a56a', 1.0, 0, -2.6, 0.55);
  await anim(tok, 700, (u) => me.g.position.set(1.0 - u * 3.9, 0, -2.6 + u * 0.0));
  tint(G.vs[1], COL.visit); me.mood('happy');
  tag('visit：走到頂點上', 'ptr', -3.6, 1.3, -3.4);
  say('visit（拜訪）：走到某一個頂點上', '拜訪 1');
  await step(tok);                                   // 0:48 exploring a vertex
  glow(G.vs[1], GOLD);
  tag('explore：拜訪它所有鄰居', 'ptr alt', 0.6, 1.0, -1.4);
  say('explore（探索）：站在頂點上，拜訪它所有相鄰頂點');
  await step(tok);                                   // 0:53 visit all adjacent vertices = exploration
  for (const w of [2, 4, 5]) {
    const a = G.vs[1].position, b = G.vs[w].position, h = tag('→', 'pkt', a.x, 1.0, a.z);
    await travel(tok, h, V3(a.x, 1.0, a.z), V3(b.x, 1.0, b.z), 400);
    remove(h); paintEdge(G.es[ek(1, w)], COL.tree, true); tint(G.vs[w], COL.visit);
  }
  me.mood('wow');
  say('1 的鄰居 2、4、5 都拜訪了 → 1 探索完', 'visit 一個點　explore = visit 它全部鄰居');
}]);

// 00:59 小例子 BFS：1 → 2 4 5 → 7 3 6
FRAG.push(['graphbari-small-bfs', '小例子 BFS：1 2 4 5 7 3 6', async (tok) => {
  fresh(GB_CAM, GB_LOOK);
  const G = gbGraph(GB_SMALL);
  let n1 = null, n2 = null;
  const r = await gbRun(tok, G, { kind: 'bfs', s: 1, pref: { 1: [2, 4, 5], 2: [7, 3, 6] }, gap: 450, at: {
    0: [() => { glow(G.vs[1], GOLD); n1 = gbNote(G, 1, '起點：任選，這裡選 1'); say('BFS：起點可以任選', '這裡選 1'); }, () => { remove(n1); glow(G.vs[1], null); }],
    1: [null],
    2: [() => { n2 = tag('2、4、5 誰先？順序任意', 'note', -3.6, 1.6, 1.2); say('1 的鄰居：5、4、2', '拜訪的順序可以任意'); }, () => remove(n2)],
    6: [() => { n2 = tag('下一個要探索的點？已拜訪：1 2 4 5', 'note', 2.6, 1.6, -1.4); say('1 探索完，挑下一個要探索的點'); }, () => remove(n2)],
    7: [null],
    11: [null],
  } });
  say('全部拜訪完、沒有點可探索 → BFS 完成', 'BFS = ' + r.order.join(' '));
}]);

// 02:06 小例子 DFS：1 2 3 6 7 4 5
FRAG.push(['graphbari-small-dfs', '小例子 DFS：1 2 3 6 7 4 5', async (tok) => {
  fresh(GB_CAM, GB_LOOK);
  const G = gbGraph(GB_SMALL);
  let n = null;
  const r = await gbRun(tok, G, { kind: 'dfs', s: 1, pref: { 1: [2, 4, 5], 2: [3, 6, 7] }, gap: 500, at: {
    0: [() => say('DFS：一樣從 1 開始'), null],
    1: [null],
    2: [() => { n = tag('4、5 先不要拜訪！', 'bad', -2.6, 1.4, -0.1); say('到了新頂點 2 → 改成探索 2', '4、5 等一下再回來'); }, () => remove(n)],
    3: [() => { n = gbNote(G, 3, '3 沒有其他鄰居'); say('探索 3：沒有東西連著 3'); }],
    4: [() => remove(n)],
    5: [null], 8: [null], 10: [null], 13: [null], 15: [null], 16: [null], 18: [null],
  } });
  await step(tok);                                   // 3:32 BFS vs DFS: different results
  tag('BFS = 1 2 4 5 7 3 6', 'say', 3.0, 1.8, -1.6); tag('DFS = ' + r.order.join(' '), 'good', 3.0, 1.8, -0.6);
  say('兩種走法，結果不一樣', 'BFS 探索完一個點才換下一個');
  await step(tok);                                   // 3:39 DFS suspends the current vertex for a new one
  const s = tag('拜訪到新點 → 暫停目前的點', 'note', 3.0, 1.8, 0.6);
  say('DFS：一拜訪到新點，就暫停（suspend）目前的點', '先去探索新點');
  await step(tok);                                   // 3:50 from 1 got 2 → explore 2; from 2 to 3 → explore 3
  for (const [a, b] of [[1, 2], [2, 3]]) {
    glow(G.vs[a], GOLD);
    const pa = G.vs[a].position, pb = G.vs[b].position, h = tag('暫停 ' + a, 'pkt', pa.x, 1.1, pa.z);
    await travel(tok, h, V3(pa.x, 1.1, pa.z), V3(pb.x, 1.1, pb.z), 700);
    remove(h); glow(G.vs[a], null);
  }
  glow(G.vs[3], GOLD);
  say('1 → 2：開始探索 2；2 → 3：開始探索 3', '一路往深處走');
}]);

// 04:06 binary tree：BFS = level order，DFS = pre-order
FRAG.push(['graphbari-tree-level-pre', 'Binary tree：BFS 像 level order，DFS 像 pre-order', async (tok) => {
  fresh(GB_CAM, GB_LOOK);
  const G = gbGraph(GB_BIN);
  await gbRun(tok, G, { kind: 'bfs', s: 1, contZ: null, rowZ: 1.4, rowLabel: 'BFS = level order', gap: 260, at: {
    0: [() => say('再一個例子：binary tree', 'tree 也是 graph'), () => say('照 binary tree 的 level order 走', '一層一層、由左到右'), null],
    1: [null],
    5: [null],
  } });
  await step(tok);                                   // 4:36 BFS is just like level order
  say('BFS = 1 2 3 4 5 6 7', '<span class="ok">BFS 就像 binary tree 的 level order</span>');
  await gbRun(tok, G, { kind: 'dfs', s: 1, contZ: null, rowZ: 3.4, rowLabel: 'DFS = pre-order', gap: 450, at: {
    0: [() => G.reset()],
    1: [null], 2: [null], 4: [null], 7: [null], 10: [null],
  } });
  await step(tok);                                   // 5:08 DFS is like pre-order
  say('DFS = 1 2 4 5 3 6 7', '<span class="ok">根 → 左 → 右：DFS 就像 pre-order</span>');
}]);

// 05:17 大例子 BFS（queue）：1 4 2 3 5 8 7 10 9 6
FRAG.push(['graphbari-bfs-queue', 'BFS 用 queue：1 4 2 3 5 8 7 10 9 6', async (tok) => {
  fresh(GB_CAM, GB_LOOK);
  const st = {};
  let n = null, G = null;
  const r = await gbRun(tok, G = gbGraph(GB_BIG), { kind: 'bfs', s: 1, pref: GB_BFS1, tree: true, gap: 500, state: st, at: {
    0: [() => say('換一張較大的圖：10 個頂點', '詳細講 BFS'),
      () => { n = tag('BFS 要用的資料結構：queue', 'note', 3.0, 1.2, 0.4); say('BFS 要用一個 queue', '先進先出：先排隊的先出來'); },
      () => { remove(n); n = tag('初始：選一個起點', 'note', -5.2, 1.3, -3.4); say('初始步驟：起點任選'); },
      () => remove(n)],
    1: [() => { n = tag('重複：從 queue 取一點來探索', 'note', 3.0, 1.2, 0.4); say('重複的步驟：從 queue 取出一點，探索它'); }, () => remove(n)],
    2: [null], 3: [null], 5: [null], 6: [null], 8: [null],
    9: [() => { n = gbNote(G, 3, '3 已拜訪 → 跳過', 'bad'); say('2 的鄰居：3、5、7、8', '3 已經拜訪過了'); }, () => remove(n)],
    10: [null], 11: [null], 13: [null], 14: [null], 15: [null], 17: [null], 18: [null], 20: [null],
    22: [() => { gbNonTree(G, st); say('連到已拜訪頂點的邊 → 畫虛線'); }, null],
    24: [null], 26: [null],
  } });
  await step(tok);                                   // 8:59 BFS completed
  say('BFS 完成', 'BFS = ' + r.order.join(' '));
}]);

// 09:06 BFS spanning tree、cross edge、兩個規則
FRAG.push(['graphbari-bfs-rules', 'BFS spanning tree、cross edge 與規則', async (tok) => {
  fresh(GB_CAM, GB_LOOK);
  const G = gbGraph(GB_BIG);
  const r = await gbRun(tok, G, { kind: 'bfs', s: 1, pref: GB_BFS1, tree: true, contZ: null, gap: 0 });
  say('BFS = ' + r.order.join(' '));
  await step(tok);                                   // 9:07 BFS spanning tree
  tag('BFS spanning tree', 'ptr alt', 3.7, 7.0, GB_TZ);
  say('畫出來的樹：BFS spanning tree', '樹邊 = V − 1 = 9 條');
  await step(tok);                                   // 9:17 dotted edges are cross edges
  const ne = gbNonTree(G, r);
  tag('cross edge', 'ptr', 6.2, 3.6, GB_TZ);
  say('虛線的邊叫 cross edge', ne.join('、'));
  await step(tok);                                   // 9:26 freedom 1: start from any vertex
  const f1 = tag('自由 1：起點任選', 'good', -3.0, 1.6, -3.6);
  say('學到的第一點：起點任選');
  await step(tok);                                   // 9:32 freedom 2: neighbours in any order
  const f2 = tag('自由 2：鄰居拜訪順序任選', 'good', -3.0, 1.6, -2.9);
  say('第二點：探索時，鄰居的拜訪順序任選');
  await step(tok);                                   // 9:49 rule 1: visit all neighbours before moving on
  remove(f1); remove(f2);
  tag('規則 1：鄰居全部拜訪完，才換下一個點', 'note', -3.0, 1.6, -3.6);
  say('規則 1：選一個點探索，要拜訪完它所有鄰居', '才能換下一個點');
  await step(tok);                                   // 10:02 exploring 1 → visit 4 and 2, only then explore 4
  glow(G.vs[1], GOLD); glow(G.vs[4], GOLD); glow(G.vs[2], GOLD);
  say('探索 1：4 和 2 都要先拜訪', '然後才能探索 4');
  await step(tok);                                   // 10:15 rule 2: next vertex to explore comes from the queue
  for (const k of [1, 4, 2]) glow(G.vs[k], null);
  tag('規則 2：下一個探索點只能從 queue 取', 'note', -3.0, 1.6, -2.9);
  say('規則 2：下一個要探索的點，只能從 queue 取', 'queue 先進先出 → 一層一層');
}]);

// 10:26 其他合法的 BFS
FRAG.push(['graphbari-bfs-more', '同一張圖，很多種合法的 BFS', async (tok) => {
  fresh(GB_CAM, GB_LOOK);
  const G = gbGraph(GB_BIG);
  const a = await gbRun(tok, G, { kind: 'bfs', s: 1, pref: { 1: [2, 4], 2: [8, 5, 7, 3], 3: [10, 9] }, contZ: null, rowZ: 1.4, rowLabel: '從 1 出發', gap: 400, at: {
    0: [() => say('照這兩條規則，可以寫出很多答案', '再寫幾個合法的 BFS'), null],
    1: [null], 2: [null], 5: [null], 6: [null], 11: [null], 13: [null], 15: [null], 18: [null],
  } });
  await step(tok);                                   // 11:17 this one is also valid
  say('這也是合法的 BFS', a.order.join(' '));
  const b = await gbRun(tok, G, { kind: 'bfs', s: 5, pref: { 5: [2, 8, 7, 6], 2: [3, 1], 3: [9, 10, 4] }, contZ: null, rowZ: 3.4, rowLabel: '從 5 出發', gap: 400, at: {
    0: [() => G.reset()],
    1: [null], 7: [null], 11: [null], 17: [null], 22: [null],
  } });
  await step(tok);                                   // 11:56 this is also valid
  say('從 5 出發也合法', b.order.join(' '));
  await step(tok);                                   // 12:01 any start, any order → numerous answers
  tag('起點任選＋鄰居順序任選 → 答案很多', 'note', 3.0, 1.6, -1.6);
  say('起點、鄰居順序都能變', 'BFS 的答案不唯一');
}]);

// 12:11 大例子 DFS（stack）：1 4 3 10 9 2 8 7 5 6
FRAG.push(['graphbari-dfs-stack', 'DFS 用 stack：1 4 3 10 9 2 8 7 5 6', async (tok) => {
  fresh(GB_CAM, GB_LOOK);
  const G = gbGraph(GB_BIG);
  let n = null, stk = null;
  const r = await gbRun(tok, G, { kind: 'dfs', s: 1, pref: GB_DFS1, gap: 600, at: {
    0: [() => { n = tag('DFS 用的資料結構：stack', 'note', 3.0, 1.2, 0.4); say('DFS 要用一個 stack', '後進先出：最後放的先拿'); }, () => remove(n)],
    1: [() => { glow(G.vs[4], '#3a2a10'); glow(G.vs[2], '#3a2a10'); say('1 的鄰居：4 和 2', '先拜訪 4'); }, () => glow(G.vs[2], null)],
    2: [() => { n = gbNote(G, 2, '2 先不管，之後再看'); say('規則：還有鄰居沒拜訪？先放著'); },
      () => { remove(n); n = tag('暫停 1，放在 stack 裡', 'note', 3.0, 1.2, 0.4); say('到了新點 4 → 暫停 1，留在 stack', '先探索 4'); },
      () => remove(n)],
    3: [null],
    5: [null],
    6: [() => { n = tag('要回到哪？看 stack 頂端', 'note', 3.0, 1.2, 0.4); say('怎麼知道要回到哪裡？', 'stack 會告訴我們'); }, () => remove(n)],
    8: [null], 9: [null], 10: [null], 11: [null], 12: [null], 13: [null], 15: [null],
    17: [() => { n = gbNote(G, 5, '2、8 都拜訪過了'); say('5 還能去哪？2、8 都已拜訪', '5 沒有新的鄰居'); },
      () => { remove(n); n = tag('一路往深處：幾乎全部拜訪了，才陸續探索完', 'note', 3.0, 1.2, 0.4); say('DFS 一路往深處走'); },
      () => remove(n)],
    19: [null], 21: [null], 23: [null],
  } });
  say('DFS 完成', 'DFS = ' + r.order.join(' '));
}]);

// 15:44 DFS spanning tree、back edge、pre-order
FRAG.push(['graphbari-dfs-tree', 'DFS spanning tree、back edge 與 pre-order', async (tok) => {
  fresh(GB_CAM, GB_LOOK);
  const G = gbGraph(GB_BIG);
  const r = await gbRun(tok, G, { kind: 'dfs', s: 1, pref: GB_DFS1, tree: true, contZ: null, gap: 0 });
  await step(tok);                                   // 15:44 DFS result and DFS spanning tree
  tag('DFS spanning tree', 'ptr alt', 3.7, 7.0, GB_TZ);
  say('DFS 結果：' + r.order.join(' '), '走過的邊 = DFS spanning tree');
  await step(tok);                                   // 15:58 these edges are back edges
  const ne = gbNonTree(G, r);
  tag('back edge', 'ptr', 6.2, 4.4, GB_TZ);
  say('虛線的邊叫 back edge', ne.join('、') + '（都連回祖先）');
  await step(tok);                                   // 16:03 make it a tree and do pre-order
  const cur = tag('▼', 'ptr alt', r.pos[r.order[0]][0], r.pos[r.order[0]][1] + 0.6, GB_TZ);
  say('對這棵樹做 pre-order', '根 → 左子樹 → 右子樹');
  await step(tok);                                   // 16:09 1 4 3 10 9 2 8 7 5 6
  const seen = [];
  for (const v of r.order) {
    const [x, y] = r.pos[v];
    await travel(tok, cur, cur.position.clone(), V3(x, y + 0.6, GB_TZ), 220);
    seen.push(v);
    say('pre-order', seen.join(' '));
  }
  say('pre-order = DFS 的結果', '<span class="ok">' + r.order.join(' ') + '</span>');
}]);

// 16:24 其他合法的 DFS
FRAG.push(['graphbari-dfs-more', '同一張圖，很多種合法的 DFS', async (tok) => {
  fresh(GB_CAM, GB_LOOK);
  const G = gbGraph(GB_BIG);
  const a = await gbRun(tok, G, { kind: 'dfs', s: 1, pref: { 1: [2, 4], 2: [8, 3], 8: [7], 7: [5], 5: [6], 3: [9, 10] }, contZ: null, rowZ: 1.4, rowLabel: '從 1 出發', gap: 450, at: {
    0: [() => say('直接看圖，再寫幾個合法的 DFS'), null],
    1: [null], 2: [null], 4: [null], 7: [null], 9: [null], 14: [null], 17: [null], 20: [null], 23: [null],
  } });
  await step(tok);                                   // 17:21 this is one answer
  say('這是一個合法的 DFS', a.order.join(' '));
  const b = await gbRun(tok, G, { kind: 'dfs', s: 3, pref: { 3: [4, 10, 9], 4: [1], 1: [2], 2: [5], 5: [6, 7], 7: [8] }, contZ: null, rowZ: 3.4, rowLabel: '從 3 出發', gap: 450, at: {
    0: [() => G.reset()],
    1: [null], 2: [null], 7: [null], 8: [null], 11: [null], 17: [null], 22: [null],
  } });
  await step(tok);                                   // 18:04 this is also valid
  say('從 3 出發也合法', b.order.join(' '));
  await step(tok);                                   // 18:12 the only rule: suspend and explore the new vertex
  tag('唯一規則：拜訪到新點 → 暫停目前的點，先探索新點', 'note', 3.0, 1.6, -1.6);
  say('起點、鄰居都能任選', '唯一規則：遇到新點就先探索它');
}]);

// 18:22 時間複雜度
FRAG.push(['graphbari-complexity', 'BFS、DFS 的時間複雜度', async (tok) => {
  fresh(GB_CAM, GB_LOOK);
  const G = gbGraph(GB_BIG);
  await step(tok);                                   // 18:23 time complexity of both is O(n)
  for (const k of Object.keys(G.vs)) { tint(G.vs[k], COL.visit); await anim(tok, 180, () => {}); }
  tag('BFS、DFS：O(n)', 'ptr alt', 3.0, 1.6, -1.4);
  say('BFS、DFS 的時間：O(n)', '每個頂點都只拜訪一次');
  await step(tok);                                   // 18:28 n = number of vertices
  tag('n = 頂點的個數', 'note', 3.0, 1.6, -0.4);
  say('n = 頂點的個數');
}]);
  }

  // ═══ graphjiang1.js ═══
  {
// ─── 24akv3pVt28 / FvUs-OlAy18（交大江蕙如 Lec06–07 Graphs 1/4、2/4） ───
// Cued scenes: every `await step(tok)` waits for the sentence it shows (cues in the notes; the number in each
// step comment is about where the lecturer says it, the words after it are the transcript words that start it).
// Motion between steps is short; nothing loops or replays. Little buddies walk the graph one vertex per sentence.
// 老師的例子（Kleinberg–Tardos 第 3 章）：13 個點的圖 1–2、1–3、2–3、2–4、2–5、3–5、3–7、3–8、4–5、5–6、7–8、9–10、
// 11–12、12–13（1..8、9 10、11 12 13 三塊；11–13 這塊的邊影片沒唸，畫面是示意）；tree 1–{2,5,7}、2–{3,4}、5–6、7–{8,9}；
// 七橋：島 5 座橋、其他三塊各 3 座。DFS 從 1 出發、編號小的先走：1 2 3 5 4 6 7 8。
const { V3, fresh, tag, cube, kill, fly, move, glow, tint, txt, relabel, code, anim, line, arrow, step, buddy, prop, bob, travel, remove, icon, GOLD } = K;
const JC = { idle: '#d9ccb4', seen: '#4b9ee2', red: '#d64545', hot: '#e8b02a', edge: '#a8987c', dim: '#e3d9c8', teal: '#2fc092', blue: '#4b9ee2', green: '#9bd34a', purple: '#9b7ef4', orange: '#dd8238', pink: '#e55a9b', gold: '#c08a1f', paper: '#efe6d2', ink: '#6e5f49', sand: '#c9b48e', water: '#7fb8e6', land: '#cdb98f', bridge: '#8a5a2b', gray: '#bdb3a2' };
const LAYC = ['#e8b02a', '#4b9ee2', '#2fc092', '#9b7ef4'];
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const hdr = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const CAM = [0, 3.8, 14], LOOK = [0, 3.4, 0];
const pal = (name, x, y, color, size = 0.6, z = 0.9) => buddy(name, '', color, x, y, z, size);
// move a buddy (no hop afterwards: its hop remembers the starting height)
async function goTo(tok, b, x, y, ms = 650) { const p0 = b.g.position.clone(), p1 = V3(x, y, p0.z); await anim(tok, ms, (u) => b.g.position.lerpVectors(p0, p1, u)); }
const UPV = V3(0, 1, 0);
const ek = (a, b) => Math.min(a, b) + '-' + Math.max(a, b);
// an edge: a thin rod between two points (cone tip when directed)
function rod(a, b, color = JC.edge, o = {}) {
  const gap = o.gap ?? 0.4, r = o.r ?? 0.05;
  const n = b.clone().sub(a).normalize();
  const s = a.clone().addScaledVector(n, gap), e = b.clone().addScaledVector(n, -gap);
  const L = Math.max(0.05, s.distanceTo(e) - (o.dir ? 0.28 : 0));
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, transparent: true, opacity: 1 });
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 8), mat);
  c.position.copy(s).addScaledVector(n, L / 2); c.quaternion.setFromUnitVectors(UPV, n); g.add(c);
  if (o.dir) { const cone = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 12), mat); cone.position.copy(e).addScaledVector(n, -0.15); cone.quaternion.setFromUnitVectors(UPV, n); g.add(cone); }
  g.userData = { mat, c }; lab.world.add(g); return g;
}
function paintE(g, color, mode) {
  if (!g) return; g.userData.mat.color.set(color);
  g.userData.mat.opacity = mode === 'dash' ? 0.28 : 1;
  const k = mode === 'thick' ? 1.9 : 1; g.userData.c.scale.set(k, 1, k);
}
// the lecturer's 13-vertex graph (XY plane, left part of the stage)
const P13 = { 1: [-5.6, 3.6], 2: [-4.2, 5.3], 3: [-4.2, 2.0], 4: [-2.4, 6.3], 5: [-2.4, 4.3], 6: [-0.8, 5.2], 7: [-2.3, 2.4], 8: [-3.1, 0.6], 9: [0.7, 6.2], 10: [0.7, 4.3], 11: [-0.4, 1.2], 12: [1.1, 2.4], 13: [1.3, 0.6] };
const E13 = [[1, 2], [1, 3], [2, 3], [2, 4], [2, 5], [3, 5], [3, 7], [3, 8], [4, 5], [5, 6], [7, 8], [9, 10], [11, 12], [12, 13]];
const K8 = [1, 2, 3, 4, 5, 6, 7, 8];
const adjOf = (edges) => { const A = {}; edges.forEach(([a, b]) => { (A[a] = A[a] || []).push(b); (A[b] = A[b] || []).push(a); }); for (const k in A) A[k].sort((x, y) => x - y); return A; };
const A13 = adjOf(E13);
// build a graph: keys, edges, positions {k:[x,y]}; o.dir for arrows, o.dx/dy offset, o.size
function gGraph(keys, edges, pos, o = {}) {
  const dx = o.dx || 0, dy = o.dy || 0, sz = o.size || 0.62;
  const v = {}, e = {}, p = {};
  keys.forEach((k) => { const [x, y] = pos[k]; p[k] = V3(x + dx, y + dy, 0); v[k] = cube(o.names ? o.names[k] : k, o.color || JC.idle, [sz, sz, sz], x + dx, y + dy, 0); });
  edges.forEach(([a, b]) => { if (p[a] && p[b]) e[ek(a, b)] = rod(p[a], p[b], o.ecol || JC.edge, { dir: o.dir, gap: sz * 0.62 }); });
  const G = { v, e, p, keys, edges };
  G.col = (k, c) => tint(v[k], c);
  G.ed = (a, b) => e[ek(a, b)];
  G.all = (c) => keys.forEach((k) => tint(v[k], c));
  G.allE = (c, m) => { for (const k in e) paintE(e[k], c, m); };
  return G;
}
// a ripple ring (BFS wave) around a point
async function ripple(tok, c, r, color = JC.blue, ms = 900) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 6, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }));
  m.position.copy(c); m.scale.setScalar(0.2); lab.world.add(m);
  await anim(tok, ms, (u) => { m.scale.setScalar(0.2 + (r - 0.2) * u); m.material.opacity = 0.8 - 0.55 * u; });
  return m;
}
// a walker that stands on a vertex
const onV = (G, k) => [G.p[k].x, G.p[k].y + 0.32];
async function walkPath(tok, b, G, ks, ms = 450) { for (const k of ks) { const [x, y] = onV(G, k); await goTo(tok, b, x, y, ms); } }
// draw a tree from explicit positions (used for BFS / DFS trees on the right)
function gTree(pos, treeE, nonE = [], o = {}) {
  const keys = Object.keys(pos).map(Number);
  const T = gGraph(keys, treeE, pos, { size: 0.5, ecol: o.ecol || JC.red });
  T.non = nonE.map(([a, b]) => { const l = line(T.p[a].x, T.p[a].y, T.p[b].x, T.p[b].y, -0.05, '#9c8b70'); return l; });
  return T;
}

// ════════ 24akv3pVt28（Lec06 Graphs 1/4） ════════
// 03:10 CAR theory：criticality、abstraction、restriction
FRAG.push(['graphjiang1-car', '解決問題三件事：criticality、abstraction、restriction', async (tok) => {
  fresh(CAM, LOOK);
  const LX = [-3.4, 0, 3.4], lt = [];
  const me = pal('我', -6.2, 0, JC.orange, 0.8, 1.4);
  await step(tok); // 190 提出一個Card
  ['C', 'A', 'R'].forEach((s, i) => lt.push(cube(s, [JC.pink, JC.blue, JC.teal][i], [1.0, 1.0, 1.0], LX[i], 6.0, 0, 1.5)));
  me.look(0.5);
  say('解決問題最重要的三件事：CAR', '台大張老師提出的 CAR theory');
  await step(tok); // 203 縮寫就是Card
  ['criticality', 'abstraction', 'restriction'].forEach((s, i) => hdr(s, LX[i], 5.0));
  say('C、A、R 各代表一件事', 'criticality、abstraction、restriction');
  await step(tok); // 229 勤賊先勤王
  glow(lt[0], GOLD); await goTo(tok, me, -5.4, 0, 500);
  const junk = [[-4.6, 1.0], [-2.2, 1.0], [-4.6, 2.6], [-2.2, 2.6]].map(([x, y]) => cube('detail', JC.gray, [1.1, 0.5, 0.5], x, y, 0, 1));
  const core = cube('本質', JC.gold, [1.0, 0.8, 0.8], -3.4, 1.8, 0, 1);
  const b1 = bub('擒賊先擒王', -5.4, 2.0, 1.4);
  say('Criticality：先找出問題的本質', '擒賊先擒王');
  await step(tok); // 252 剩下有的沒的
  remove(b1);
  junk.forEach((j) => fly(j)); glow(core, GOLD);
  say('不重要的 detail 先不理它', '問題越乾淨，想得越清楚');
  await step(tok); // 266 那第二個的話是abstraction
  glow(lt[0], null); glow(lt[1], GOLD); kill(core);
  await goTo(tok, me, -1.6, 0, 700);
  say('第二件事：abstraction（抽象化）', 'graph 就是 abstraction 最好的例子');
  await step(tok); // 314 他去看就是男生和女生
  const ppl = [];
  for (let i = 0; i < 3; i++) { ppl.push(icon('👦', '', -1.2 + i * 1.2, 3.6, 0, 'sm')); ppl.push(icon('👧', '', -1.2 + i * 1.2, 1.6, 0, 'sm')); }
  say('Stable matching：一群男生、一群女生', '每個人都有一堆細節');
  await step(tok); // 326 男生就直接編號
  ppl.forEach(remove);
  const nums = [];
  for (let i = 0; i < 3; i++) { nums.push(cube(i + 1, JC.blue, [0.7, 0.7, 0.7], -1.2 + i * 1.2, 3.6, 0, 1)); nums.push(cube(i + 1, JC.pink, [0.7, 0.7, 0.7], -1.2 + i * 1.2, 1.6, 0, 1)); }
  say('男生編號 1..n、女生編號 1..n', '只剩數字，很乾淨');
  await step(tok); // 348 從highlevel開始出發
  nums.forEach((n) => kill(n));
  const hi = pkt('high level：先想清楚、設計演算法', 0, 3.6);
  say('先從 high level 想問題、設計演算法', '從比較高的層次出發');
  await step(tok); // 373 降到比較low level
  const ar = arrow(V3(0, 3.1, 0), V3(0, 1.9, 0));
  const lo = note('low level：implementation', 0, 1.4);
  say('解決了才降到 low level 做 implementation', '順序不會反過來');
  await step(tok); // 397 第三件事情的話是rextraction
  glow(lt[1], null); glow(lt[2], GOLD);
  await goTo(tok, me, 1.8, 0, 700);
  say('第三件事：restriction（限制）', '卡住的瑣碎條件怎麼辦？');
  await step(tok); // 435 其實你一開始可以先簡化它
  const pad = prop('note', 3.4, 2.6, 0.3, 1.6);
  const lim = note('先簡化，記下：限制 ①、限制 ②', 3.4, 3.2);
  say('一開始先簡化，把限制記下來', '先考慮比較簡單的形式');
  await step(tok); // 450 你簡化的東西把它記下來
  me.mood('happy');
  const ok = good('基本版解完 → 延伸處理限制', 3.4, 1.4);
  say('基本的解完，再回頭處理這些限制', '常常小小延伸就能處理');
  await step(tok); // 487 這就是Coffering
  lt.forEach((l) => glow(l, GOLD));
  say('C、A、R：解決問題的三件事', '要不斷反覆實踐');
}]);

// 08:58 Graph 的起源：Euler
FRAG.push(['graphjiang1-euler', 'Graph 的起源：Euler', async (tok) => {
  fresh(CAM, LOOK);
  await step(tok); // 538 Graph其實歷史不是很久
  line(-6, 0.6, 6, 0.6, 0, '#a99470');
  const yrs = [['1600', -4.5], ['1700', -1.5], ['1800', 1.5], ['1900', 4.5]].map(([t, x]) => tag(t, 'idx', x, 0.2));
  const mk = cube('18 世紀', JC.gold, [1.6, 0.5, 0.5], 0, 1.2, 0, 1.5);
  say('Graph 歷史不長：18 世紀才發展出來', '');
  await step(tok); // 538 跟另外一個領域Topology
  const g1 = hdr('Graph theory', -1.8, 6.2), g2 = hdr('Topology（拓樸學）', 2.2, 6.2);
  say('Graph 和 Topology 的起源是同一件事', '');
  await step(tok); // 550 Euler是一個瑞士的數學家
  const eu = pal('Euler', 0, 2.2, JC.blue, 1.0, 0.6);
  say('Euler：瑞士的數學家、物理學家', '');
  await step(tok); // 589 那他其實是Graph之父
  const cr = pkt('Graph 之父 👑', 0, 4.6, 0.6);
  eu.mood('happy');
  say('Euler 開啟了 graph 和 topology', '這兩大領域的第一人');
  await step(tok); // 601 13歲的時候上大學
  const age = note('13 歲上大學、16 歲拿到學位', 3.8, 3.4);
  say('13 歲上大學，16 歲取得學位', '天才等級');
  await step(tok); // 641 但是他眼睛不好
  remove(age); remove(cr); eu.mood('sad');
  say('工作過度，眼睛變得很不好', '後來幾乎失明');
  await step(tok); // 651 後來他就有一次去度假
  const town = prop('warehouse', 4.6, 0.6, 0, 1.1);
  await goTo(tok, eu, 2.6, 0.6, 1100);
  say('他去一個小鎮度假休息', '');
  await step(tok); // 666 這個小鎮基本上
  eu.mood('wow');
  hdr('Königsberg', 4.6, 3.0);
  say('小鎮叫 Königsberg', '這裡有一個有趣的問題');
}]);

// 11:20 七橋問題
const BR = { N: [-2.3, 5.8], I: [-2.3, 3.2], S: [-2.3, 0.6], E: [3.6, 3.2] };
// the seven bridges as edges between land centres; off = sideways shift of parallel bridges
const BR7 = [['N', 'I', -0.5], ['N', 'I', 0.5], ['I', 'S', -0.5], ['I', 'S', 0.5], ['I', 'E', 0], ['N', 'E', 0], ['S', 'E', 0]];
function brEnds(a, b, off) { const p = V3(...BR[a], 0), q = V3(...BR[b], 0); const d = q.clone().sub(p).normalize(); const s = V3(-d.y, d.x, 0).multiplyScalar(off); return [p.add(s), q.add(s)]; }
function brMap() {
  const box = (c, w, h, x, y, z) => { const m = lab.box(c, [w, h, 0.3]); m.position.set(x, y, z); lab.world.add(m); return m; };
  const water = [box(JC.water, 13, 0.9, 0, 4.5, -0.2), box(JC.water, 13, 0.9, 0, 1.9, -0.2), box(JC.water, 2.2, 1.7, 1.0, 3.2, -0.2), box(JC.water, 1.6, 1.7, -6.2, 3.2, -0.2)];
  const land = { N: box(JC.land, 13, 1.3, 0, 5.8, 0), S: box(JC.land, 13, 1.3, 0, 0.6, 0), I: box(JC.land, 3.4, 1.7, -3.7, 3.2, 0), E: box(JC.land, 4.2, 1.7, 4.2, 3.2, 0) };
  return { water, land };
}
FRAG.push(['graphjiang1-bridges', '七橋問題：四塊地、七座橋', async (tok) => {
  fresh(CAM, LOOK);
  let M = null; const brs = [], es = [], dots = {};
  await step(tok); // 680 7-Bridge Problem
  M = brMap();
  say('七橋問題（Seven Bridges of Königsberg）', '');
  await step(tok); // 703 他們大概這個小鎮有四個
  const nm = { N: '北岸', I: '島', S: '南岸', E: '東邊' };
  const lt = Object.keys(nm).map((k) => tag(nm[k], 'idx', BR[k][0] + (k === 'N' || k === 'S' ? 3.2 : 0), BR[k][1] - 0.1, 0.4));
  say('河流把小鎮切成四塊陸地', '藍色是河道');
  await step(tok); // 718 一共有七座橋
  for (const [a, b, off] of BR7) { const [p, q] = brEnds(a, b, off); brs.push(rod(p, q, JC.bridge, { r: 0.12, gap: 0.55 })); await anim(tok, 160, () => {}); }
  say('陸地之間有橋：一共七座', '');
  await step(tok); // 743 有一種就是在這個城鎮散步
  const w = pal('散步', -0.6, 5.3, JC.orange, 0.5, 0.8);
  await goTo(tok, w, -2.8, 3.4, 600); await goTo(tok, w, -0.2, 3.4, 600); await goTo(tok, w, 3.6, 3.4, 600);
  say('能不能散步一圈，回到出發的陸地', '');
  await step(tok); // 757 經過每一座橋剛好一次
  const rule = pkt('每座橋剛好走一次，最後回到起點', 0, 7.0);
  say('每座橋都要剛好走一次', '不能重複，也不能漏掉');
  await step(tok); // 787 沒有方法沒有人成功
  w.mood('sad'); bub('走不出來…', 3.6, 4.6, 0.8);
  say('沒有人成功過', '但「做不到」不等於「不存在」');
  await step(tok); // 812 土地的大小其實不重要
  kill(w.g);
  await anim(tok, 900, (u) => { for (const k in M.land) M.land[k].scale.set(1 - 0.8 * u, 1 - 0.5 * u, 1); });
  say('Euler：土地的大小不重要', '重點是四塊地、七座橋');
  await step(tok); // 839 四塊地呢就是分別用小紅點表示
  for (const k in BR) dots[k] = cube('', JC.red, [0.55, 0.55, 0.55], BR[k][0], BR[k][1], 0.3, 1);
  say('每塊陸地畫成一個點', '');
  await step(tok); // 851 所以我們就簡單用線條去表示它
  for (const [a, b, off] of BR7) { const [p, q] = brEnds(a, b, off); es.push(rod(p, q, '#3d3328', { r: 0.045, gap: 0.3 })); }
  say('每座橋畫成一條線', '橋連接兩塊陸地');
  await step(tok); // 851 那接下來我就把地圖抽掉
  M.water.forEach((m) => kill(m)); for (const k in M.land) kill(M.land[k]); brs.forEach((b) => kill(b)); lt.forEach(remove);
  say('把地圖拿掉：只剩點和線', '這就是一個 graph');
  await step(tok); // 881 拿一支筆
  remove(rule);
  const pen = pkt('✎', BR.N[0], BR.N[1] + 0.5, 0.5);
  await travel(tok, pen, pen.position.clone(), V3(BR.I[0] - 0.5, BR.I[1] + 0.5, 0.5), 600);
  await travel(tok, pen, pen.position.clone(), V3(BR.E[0], BR.E[1] + 0.5, 0.5), 700);
  say('問題變成：能不能一筆畫完七條線', '筆不離開紙、不重複、回到起點');
  await step(tok); // 908 Euler最大的貢獻
  remove(pen);
  const no = bad('impossible！', 0.7, 6.9);
  say('Euler 證明：這是不可能的', '');
  await step(tok); // 921 他就寫了一篇論文
  const pap = prop('file', 5.6, 4.6, 0, 1.1, 'graph theory 的開端');
  say('這篇論文被視為 graph theory 的始祖', '');
  await step(tok); // 967 我可能從某一座橋走過來
  remove(no); kill(pap);
  glow(dots.E, GOLD);
  const wi = pal('', 0.6, 3.5, JC.orange, 0.45, 0.8);
  await goTo(tok, wi, 3.0, 3.5, 600);
  const tin = pkt('走進來', 1.6, 2.6, 0.6);
  await goTo(tok, wi, 2.6, 5.0, 600);
  const tout = pkt('從另一座橋出去', 1.6, 5.6, 0.6);
  say('走進一塊陸地，一定要從另一座橋離開', '同一座橋不能走第二次');
  await step(tok); // 1008 所以它是沉對的
  kill(wi.g); remove(tin); remove(tout);
  const pr = note('進、出成對 → 橋數要是偶數', 4.4, 6.6);
  say('每次經過：一進一出，橋是成對用掉的', '');
  await step(tok); // 1022 如果一塊陸地跟他身上連的橋
  bub('奇數座橋 → 有一座進得去出不來', 4.6, 1.2, 0.5);
  say('如果連著奇數座橋，就沒辦法自由進出', '');
  await step(tok); // 1050 我只要簡單去數一下
  remove(pr);
  const deg = { N: 3, I: 5, S: 3, E: 3 };
  for (const k in deg) { tag(String(deg[k]), 'pkt', BR[k][0] + 0.7, BR[k][1] + 0.6, 0.4); await anim(tok, 250, () => {}); }
  say('數每個點連了幾座橋', '3、5、3、3');
  await step(tok); // 1064 那所以當然就不可能
  for (const k in dots) tint(dots[k], JC.red), glow(dots[k], '#3a0a0a');
  bad('四個點都是奇數 → 不可能', 0.7, 6.9);
  say('都是奇數，所以不可能', '證明的 basic idea 就是這樣');
}]);

// 18:14 Graph 的定義
FRAG.push(['graphjiang1-def', 'Graph 的定義：vertex、edge、directed 與 neighbor', async (tok) => {
  fresh(CAM, LOOK);
  const dots = {}, es = [];
  const sh = (k) => [BR[k][0] * 0.7 - 2.6, BR[k][1] * 0.75 + 1.0];
  await step(tok); // 1094 他的這種表示方法非常的有意思
  for (const k in BR) { const [x, y] = sh(k); dots[k] = cube('', JC.red, [0.5, 0.5, 0.5], x, y, 0, 1); }
  for (const [a, b, off] of BR7) { const p = V3(...sh(a), 0), q = V3(...sh(b), 0), d = q.clone().sub(p).normalize(), s = V3(-d.y, d.x, 0).multiplyScalar(off * 0.6); es.push(rod(p.add(s), q.add(s), '#3d3328', { r: 0.04, gap: 0.3 })); }
  say('後人發現 Euler 的表示法很有意思', '');
  await step(tok); // 1108 你只看到了點和線
  say('看不到地圖了：只剩點和線', '');
  await step(tok); // 1108 兩座陸地之間的關係
  es.forEach((e) => paintE(e, JC.orange, 'thick'));
  bub('線 = 兩塊陸地有沒有關係', -2.6, 6.6);
  say('一條線代表兩塊陸地之間的關係', '能不能彼此到達');
  await step(tok); // 1120 探討一些object
  hdr('Graph：object 之間相連的關係', 3.6, 6.6);
  say('Graph 探討 object 之間相連的關係', '');
  await step(tok); // 1172 記錄Object之間的relationship
  note('用來記錄 relationship', 3.6, 5.8);
  say('Graph 用來記錄 object 之間的 relationship', '我們處理的多半是 discrete 的東西');
  await step(tok); // 1223 所以Graph組成其實很簡單
  for (const k in dots) glow(dots[k], GOLD);
  say('Graph 由兩大類東西組成：點和線', '');
  await step(tok); // 1240 你可能會看到是vertex
  for (const k in dots) glow(dots[k], null);
  const vtag = pkt('點：node ＝ vertex（複數 vertices）', 3.6, 4.9);
  say('點叫 node，也叫 vertex', '兩種叫法通用');
  await step(tok); // 1258 線通常我們就叫它edge
  es.forEach((e) => paintE(e, JC.blue, 'thick'));
  pkt('線：edge', 3.6, 4.2);
  say('線叫 edge', '');
  await step(tok); // 1296 Age其實他就是在表達兩個object
  note('七橋：vertex = 陸地、edge = 橋', 3.6, 3.5);
  say('有關係就建一條 edge', '七橋問題：陸地是點、橋是邊');
  await step(tok); // 1335 常用是g
  es.forEach((e) => paintE(e, '#3d3328'));
  const gd = hdr('G = (V, E)', 3.6, 2.6);
  say('一個 graph 常叫 G', '');
  await step(tok); // 1348 第一個的話就是點集合
  note('V：vertex 的集合　E：edge 的集合', 3.6, 1.9);
  say('G 包含兩個 set：V 和 E', 'V 是點集合、E 是邊集合');
  await step(tok); // 1401 比如說這個UV之間有A矩
  for (const k in dots) kill(dots[k]); es.forEach((e) => kill(e));
  const u = cube('u', JC.blue, [0.7, 0.7, 0.7], -5.0, 4.6, 0, 1), v = cube('v', JC.pink, [0.7, 0.7, 0.7], -1.6, 4.6, 0, 1);
  let e1 = rod(V3(-5.0, 4.6, 0), V3(-1.6, 4.6, 0), '#3d3328');
  say('一條 edge 要寫出它連的兩個點', 'u 和 v');
  await step(tok); // 1440 它的age是沒有方向性
  const sym = bub('u ↔ v：關係對稱', -3.3, 5.6);
  say('如果關係是對稱的：edge 沒有方向', 'undirected');
  await step(tok); // 1467 會用大掛號
  const t1 = pkt('undirected edge：{u, v}', -3.3, 3.5);
  say('沒有方向的 edge 用大括號 {u, v}', '集合的元素沒有順序');
  await step(tok); // 1494 但是在有一型別的圖裡面
  remove(sym);
  const u2 = cube('u', JC.blue, [0.7, 0.7, 0.7], -5.0, 1.8, 0, 1), v2 = cube('v', JC.pink, [0.7, 0.7, 0.7], -1.6, 1.8, 0, 1);
  rod(V3(-5.0, 1.8, 0), V3(-1.6, 1.8, 0), JC.red, { dir: true });
  say('有些 graph 的 edge 有方向', 'u 跟 v 有關係，v 跟 u 不一定');
  await step(tok); // 1507 用小掛號
  pkt('directed edge：(u, v)', -3.3, 0.7);
  say('有方向的 edge 用小括號 (u, v)', '小括號是有順序的');
  await step(tok); // 1534 UV如果有age的話並不等同於VU
  bad('(u, v) ≠ (v, u)', 0.2, 1.8);
  say('(u, v) 是 u 到 v，(v, u) 是 v 到 u', '是兩條不一樣的 edge');
  await step(tok); // 1560 是一個celebrity
  const fan = pal('我', -5.0, 1.0, JC.orange, 0.45, 0.8), star = pal('明星', -1.6, 1.0, JC.purple, 0.45, 0.8);
  star.mood('happy');
  say('例子：v 是名人', '很多人都認識他');
  await step(tok); // 1577 李敏浩不認識我
  fan.mood('happy'); star.look(1);
  bub('我認識他，他不認識我', -3.3, 2.9, 0.6);
  say('我認識明星，明星不認識我', '所以這條 edge 是單向的');
  await step(tok); // 1619 他叫Arc
  note('有些書：directed 的線叫 arc', 3.6, 1.1);
  say('有些書把 directed edge 叫 arc', '用名字區分兩種圖');
  await step(tok); // 1640 我們叫這個neighbor
  glow(u, GOLD); glow(v, GOLD);
  bub('有 edge 相連 → 鄰居', -3.3, 5.6);
  say('有 edge 相連，就互為 neighbor', '住在附近，所以叫鄰居');
  await step(tok); // 1671 所以叫adjacency
  pkt('adjacent（相鄰）', 3.6, 0.3);
  say('「有 edge 相連」也叫 adjacent', '這是 adjacency 的概念');
  await step(tok); // 1698 回顧到一下剛剛那個7-bridgedproblem
  glow(u, null); glow(v, null);
  say('回到七橋：graph 探討的是陸地之間的關聯', '也就是橋的 connection');
}]);

// 28:52 Graph 的例子
const MINI = { pos: [[-3.6, 5.4], [-0.6, 6.0], [2.2, 5.0], [-2.6, 2.2], [1.2, 2.0]], edges: [[0, 1], [1, 2], [0, 3], [3, 4], [1, 4], [2, 4]] };
FRAG.push(['graphjiang1-examples', '用 graph 表示各種問題', async (tok) => {
  fresh(CAM, LOOK);
  let cur = [];
  const clear = () => { cur.forEach((o) => (o.element ? remove(o) : kill(o))); cur = []; };
  // show one example: glyphs on the vertices, edge colours / directions, a title
  function show(title, glyphs, o = {}) {
    clear();
    const P = MINI.pos.map(([x, y]) => V3(x, y, 0));
    P.forEach((p, i) => { cur.push(cube('', o.vcol || JC.paper, [0.55, 0.55, 0.55], p.x, p.y, 0)); cur.push(icon(glyphs[i], o.names ? o.names[i] : '', p.x, p.y + 0.65, 0.3, 'sm')); });
    MINI.edges.forEach(([a, b], k) => { const d = o.flip && o.flip[k] ? [b, a] : [a, b]; cur.push(rod(P[d[0]], P[d[1]], o.ecol ? o.ecol[k] : JC.edge, { dir: !!o.dir, gap: 0.45, r: o.ecol ? 0.08 : 0.05 })); });
    cur.push(hdr(title, -0.6, 7.2));
  }
  await step(tok); // 1732 那接下來的話我們看一些例子
  const tip = note('例子不用背：看 graph 能表示什麼', 4.6, 0.6);
  say('看一些例子：graph 可以表示什麼', '不用背');
  await step(tok); // 1758 Transportation Network
  show('交通網路：航線', ['🏙', '🏙', '🏙', '🏙', '🏙'], { names: ['台北', '東京', '首爾', '香港', '曼谷'] });
  say('Transportation network：航空公司的航線圖', '直飛就連一條線');
  await step(tok); // 1789 英國倫敦的地鐵
  show('倫敦地鐵圖', ['🚇', '🚇', '🚇', '🚇', '🚇'], { ecol: [JC.red, JC.red, JC.blue, JC.blue, JC.green, JC.red] });
  say('倫敦地鐵圖：經典的抽象化設計', '');
  await step(tok); // 1853 就是station
  pkt('點 = 車站　邊 = 相鄰兩站　顏色 = 路線', 4.6, 3.6);
  say('點是車站，相鄰兩站之間建 edge', '不同路線用不同顏色');
  await step(tok); // 1880 這個age的長度並不代表
  bad('邊的長度 ≠ 實際距離', 4.6, 2.8);
  say('edge 的長度不代表兩站的實際距離', '只代表是不是相鄰的站');
  await step(tok); // 1945 因為其實在我們在搭乘
  good('搭車只在乎：到不到得了', 4.6, 2.0);
  say('好的 abstraction：只留我們在乎的', '搭車只在乎到不到得了目的地');
  await step(tok); // 1968 sensor wireless
  show('無線感測網路', ['📡', '📡', '📶', '📶', '📶']);
  say('Communication network：無線感測網路', '訊號 cover 得到就建 edge');
  await step(tok); // 1994 那這個畫呢就是World Wide Web
  show('World Wide Web', ['📄', '📄', '📄', '📄', '📄'], { dir: true, flip: [0, 1, 0, 1, 0, 0] });
  say('WWW：每個網頁一個點', '有 hyperlink 連過去就建 edge');
  await step(tok); // 2034 這是那個Facebook
  show('Social network', ['🙂', '😀', '😎', '🙂', '😊']);
  say('Facebook：點是人，edge 是 friendship', '是好友就有 edge');
  await step(tok); // 2069 這是食物網跟食物鏈
  show('食物網', ['🌿', '🐛', '🐦', '🐇', '🦊'], { dir: true, flip: [0, 0, 0, 0, 1, 1] });
  say('食物網：每個物種一個點', '誰吃誰，就建一條 edge');
  await step(tok); // 2095 他的Edge通常都是有方向性
  bub('吃 → 有方向', 2.2, 6.4, 0.4);
  say('這種 edge 通常有方向', '除非可以互相吃對方');
  await step(tok); // 2128 這是StateMachine
  show('State machine', ['S0', 'S1', 'S2', 'S3', 'S4'], { dir: true, flip: [0, 0, 1, 0, 0, 1] });
  say('Logic design 的 state machine 也是 graph', '點是 state');
  await step(tok); // 2152 我跳的過去並不代表
  pkt('edge = state transition（有方向）', 4.6, 4.4);
  say('edge 是 state transition，有方向', '跳得過去不代表跳得回來');
  await step(tok); // 2176 我們在A矩上面可以attach
  cur.push(tag('in=1', 'idx', -2.1, 6.1, 0.3), tag('in=0', 'idx', 0.8, 5.9, 0.3));
  say('edge 和 node 上都可以 attach information', '例如什麼 input 才會跳過去');
  await step(tok); // 2240 它是不是存在一些objects
  clear(); remove(tip);
  show('discrete objects ＋ relationship → graph', ['❓', '❓', '❓', '❓', '❓']);
  say('只要有一些 discrete objects，討論它們的關係', '就能表達成 graph');
  await step(tok); // 2279 model成一個graph的形式
  good('model 成 graph → 很多現成演算法', 4.6, 1.6);
  say('把問題 model 成 graph', '通常就有現成的演算法可以用');
}]);

// 39:07 複習：graph、directed、neighbor
FRAG.push(['graphjiang1-review', '複習：relationship、directed 與 neighbor', async (tok) => {
  fresh(CAM, LOOK);
  await step(tok); // 2347 那上次跟大家介紹基本的graph的定義
  const P = { a: [-4.6, 5.0], b: [-1.4, 5.6], c: [-2.8, 2.6] };
  const G = gGraph(['a', 'b', 'c'], [['a', 'b'], ['a', 'c'], ['b', 'c']], P, { size: 0.7 });
  say('Graph：探討 object 之間的 relationship', '');
  await step(tok); // 2374 會在一個圖裡麵包含其實是有兩個集合
  hdr('G = (V, E)', 3.6, 6.4);
  note('V = {a, b, c}　E = 三條 edge', 3.6, 5.6);
  say('一個 graph 有兩個集合：點和線', '點是我們處理的物件');
  await step(tok); // 2387 relationship呢這其實才是graph的重點
  G.allE(JC.orange, 'thick');
  say('重點是 relationship：靠 edge 呈現', '');
  await step(tok); // 2414 根據這個relationship的一些特性
  G.allE(JC.edge);
  say('依 relationship 的特性，分成兩大類', '');
  await step(tok); // 2426 一個的話就是如果這個relationship
  pkt('對稱 → undirected，{u, v}', 3.6, 4.4);
  say('關係對稱：A 跟 B 有關係，B 跟 A 也有', 'edge 沒有方向');
  await step(tok); // 2464 有方向性的話呢這樣的graph我們叫做directed
  const u = cube('u', JC.blue, [0.7, 0.7, 0.7], -4.6, 0.8, 0, 1), v = cube('v', JC.pink, [0.7, 0.7, 0.7], -1.2, 0.8, 0, 1);
  rod(V3(-4.6, 0.8, 0), V3(-1.2, 0.8, 0), JC.red, { dir: true });
  pkt('不對稱 → directed，(u, v)', 3.6, 3.6);
  say('關係不對稱：directed graph，畫箭頭', '從 u 出發到 v，寫成 (u, v)');
  await step(tok); // 2516 這邊的話呢就請不要用大掛號
  bad('directed edge 別用大括號', 3.6, 2.8);
  say('directed edge 不要用大括號', '大括號表示沒有先後順序');
  await step(tok); // 2529 adjacent 和那個neighbor
  glow(G.v.a, GOLD); glow(G.v.b, GOLD);
  note('有 edge 相連 → neighbor、adjacent', 3.6, 2.0);
  say('有 edge 相連：互為 neighbor', '也叫 adjacent');
  await step(tok); // 2560 我們就會說u的鄰居是v
  glow(G.v.a, null); glow(G.v.b, null);
  glow(u, GOLD); tag('u 的鄰居：v', 'pkt', -4.6, 1.8); tag('v 的鄰居：沒有 u', 'bad', -0.6, 1.8);
  say('directed：u 的鄰居是 v，v 的鄰居不是 u', 'v 沒有 edge 到 u');
}]);

// 43:05 Path、simple path、cycle、connected、distance
FRAG.push(['graphjiang1-path', 'Path、cycle、connected 與 distance', async (tok) => {
  fresh(CAM, LOOK);
  const G = gGraph(K8, E13, P13);
  const R = 3.8;
  await step(tok); // 2585 第一個想要探討的主題就是
  hdr('connectivity（相連性）', R, 6.8);
  say('第一個主題：connectivity', '沿著 edge 走，看看誰跟誰連得到');
  await step(tok); // 2623 正式給一個定義是pathpath
  hdr('path（路徑）', R, 6.0);
  say('先定義 path（路徑）', '先從 undirected graph 開始');
  await step(tok); // 2678 一些點組成的一個sequence
  pkt('P = v₁, v₂, …, v_k', R, 5.2);
  say('一條 path 是一串點的 sequence', '從 v₁ 出發，經過 v₂…，到 v_k');
  await step(tok); // 2732 這兩兩之間的兩兩之間
  note('連續兩點 vᵢ、vᵢ₊₁ 之間一定有 edge', R, 4.4);
  say('連續的兩個點之間，一定要有 edge', '');
  await step(tok); // 2815 如果在這條path的上面所經過的點是不重複的
  note('點都不重複 → simple path', R, 3.6);
  say('經過的點都不重複：simple path', '');
  await step(tok); // 2838 的話就叫cycle
  note('終點 v_k = 起點 v₁ → cycle', R, 2.8);
  say('終點回到起點：cycle', '頭尾連在一起，形成一個圈');
  await step(tok); // 2862 如果它是一個connected的話
  good('connected：任兩點之間都有 path', R, 2.0);
  say('Connected graph：任兩點之間都有 path', '');
  await step(tok); // 2888 不一定要直接有age相連
  G.col(1, JC.hot); G.col(6, JC.hot);
  bub('1 和 6 沒有直接相連，但走得到', -3.4, 7.2);
  say('不一定直接有 edge，有 path 就算連通', '也叫 reachable（到得了）');
  await step(tok); // 2921 這兩點之間的距離distance
  G.all(JC.idle);
  note('distance = 最少經過幾條 edge', R, 1.2);
  say('Distance：所有走法中，最少經過的 edge 數', '');
  await step(tok); // 2946 如果這兩點之間完全沒有路徑
  bad('到不了 → distance = ∞', R, 0.4);
  say('完全到不了：距離是無限大', '');
  await step(tok); // 2970 從1出發經過2到達4
  const w = pal('', ...onV(G, 1), JC.orange, 0.42, 0.6);
  const way = [1, 2, 4, 5, 3, 7, 8];
  G.col(1, JC.blue);
  for (let i = 1; i < way.length; i++) { await walkPath(tok, w, G, [way[i]], 280); G.col(way[i], JC.blue); paintE(G.ed(way[i - 1], way[i]), JC.blue, 'thick'); }
  say('例子：1, 2, 4, 5, 3, 7, 8', '一條從 1 到 8 的 path');
  await step(tok); // 2983 屬於simple的path
  bub('沒有重複的點 → simple', -3.4, 7.2);
  say('點都沒有重複，所以是 simple path', '');
  await step(tok); // 2996 假設是1,2,4,5,3,1
  G.all(JC.idle); G.allE(JC.edge);
  await goTo(tok, w, ...onV(G, 1), 300);
  const cyc = [1, 2, 4, 5, 3, 1];
  for (let i = 1; i < cyc.length; i++) { await walkPath(tok, w, G, [cyc[i]], 300); paintE(G.ed(cyc[i - 1], cyc[i]), JC.red, 'thick'); G.col(cyc[i], JC.pink); }
  say('1, 2, 4, 5, 3, 1：繞一圈回來', '頭尾相連，是一個 cycle');
  await step(tok); // 3007 兩點之間只要有path相連
  G.allE(JC.edge); G.all(JC.teal);
  say('兩點之間有 path，就是 connected', '或說 reachable');
  await step(tok); // 3031 只有順著這個age的方向
  kill(w.g); G.all(JC.idle);
  cube('a', JC.blue, [0.6, 0.6, 0.6], 2.4, 0.6, 1.2); cube('b', JC.pink, [0.6, 0.6, 0.6], 5.6, 0.6, 1.2);
  rod(V3(2.4, 0.6, 1.2), V3(5.6, 0.6, 1.2), JC.red, { dir: true });
  say('Directed graph：只能順著 edge 的方向走', '不能倒著走');
  await step(tok); // 3080 雙向道
  pkt('undirected edge = 雙向道', R, -0.3, 1.2);
  say('Undirected edge 像雙向道', '過得去也回得來');
  await step(tok); // 3093 單向道
  bub('directed edge = 單向道', 4.0, 1.6, 1.2);
  say('Directed edge 像單向道', '過得去，不一定回得來');
  await step(tok); // 3105 你就把每條edge呢把它產生兩個相對方向
  rod(V3(5.6, 0.85, 1.2), V3(2.4, 0.85, 1.2), JC.blue, { dir: true });
  say('Undirected 變 directed：每條 edge 拆成兩條', '兩個相反方向的 directed edge');
}]);

// 52:12 Tree 與 rooted tree
const TU = { 1: [-3.8, 3.6], 2: [-5.4, 4.8], 3: [-6.4, 6.2], 4: [-6.3, 3.3], 5: [-2.3, 5.2], 6: [-0.9, 6.4], 7: [-3.0, 1.7], 8: [-4.6, 0.6], 9: [-1.4, 0.8] };
const TR = { 1: [-3.6, 6.6], 2: [-5.6, 4.7], 5: [-3.6, 4.7], 7: [-1.6, 4.7], 3: [-6.4, 2.8], 4: [-4.8, 2.8], 6: [-3.6, 2.8], 8: [-2.4, 2.8], 9: [-0.8, 2.8] };
const TE = [[1, 2], [1, 5], [1, 7], [2, 3], [2, 4], [5, 6], [7, 8], [7, 9]];
// edges that follow moving vertices (unit cylinder stretched between two points)
function link(color = JC.edge) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.6, transparent: true }));
  lab.world.add(m);
  m.userData.fit = (p, q) => { const d = q.clone().sub(p), L = Math.max(0.05, d.length() - 0.7); m.position.copy(p).add(q).multiplyScalar(0.5); m.scale.set(1, L, 1); m.quaternion.setFromUnitVectors(UPV, d.normalize()); };
  return m;
}
FRAG.push(['graphjiang1-tree', 'Tree：connected 而且沒有 cycle', async (tok) => {
  fresh(CAM, LOOK);
  const R = 3.8, v = {}, L = {};
  const fit = () => TE.forEach(([a, b]) => L[ek(a, b)].userData.fit(v[a].position, v[b].position));
  await step(tok); // 3132 我們不會特別探討tree
  for (const k in TU) v[k] = cube(k, JC.idle, [0.6, 0.6, 0.6], TU[k][0], TU[k][1], 0);
  TE.forEach(([a, b]) => { L[ek(a, b)] = link(); }); fit();
  hdr('Tree 也是一種 graph', R, 6.8);
  say('Tree 也是 graph，只是多了一些限制', '比較簡單');
  await step(tok); // 3160 那connected大家知道就是
  note('① connected：任兩點都有 path', R, 6.0);
  say('Tree：一個 connected 的 undirected graph', '');
  await step(tok); // 3172 Tree裡面是沒有cycle
  note('② 沒有 cycle', R, 5.2);
  say('而且沒有 cycle', '');
  await step(tok); // 3197 這樣一個graph是不是一顆tree
  const q = bub('長得不像 tree？', -3.6, 7.4);
  say('左邊這張圖是不是一棵 tree？', '它不像以前看到的 tree');
  await step(tok); // 3242 你可以任選一點把它吊起來
  remove(q); glow(v[1], GOLD);
  const p0 = v[1].position.clone();
  await anim(tok, 800, (u) => { v[1].position.lerpVectors(p0, V3(...TR[1], 0), u); fit(); });
  say('任選一點（例如 1）把它吊起來', '');
  await step(tok); // 3256 剩下的點就會往下垂下來
  const st = {}; for (const k in v) st[k] = v[k].position.clone();
  await anim(tok, 1400, (u) => { for (const k in v) v[k].position.lerpVectors(st[k], V3(...TR[k], 0), u); fit(); });
  say('剩下的點就往下垂', '變成熟悉的 tree 樣子');
  await step(tok); // 3269 一模一樣只是畫起來形式不一樣
  good('同一張圖，只是畫法不同', R, 4.4);
  say('兩張圖一模一樣，只是畫法不同', 'connected 又沒有 cycle，就是 tree');
  await step(tok); // 3285 tree大概就是最簡單形式
  say('Tree 是最簡單的 connected graph', 'edge 很少');
  await step(tok); // 3296 任意的打斷任何一條edge
  const cut = L[ek(7, 8)]; cut.material.color.set(JC.red);
  await anim(tok, 600, (u) => { cut.material.opacity = 1 - 0.85 * u; });
  tint(v[8], JC.dim);
  const bk = bad('剪掉一條 edge → disconnected', R, 3.6);
  say('剪掉任何一條 edge，就斷成兩塊', '');
  await step(tok); // 3320 下面有三個statement
  cut.material.opacity = 1; cut.material.color.set(JC.edge); tint(v[8], JC.idle); remove(bk);
  hdr('三個條件，任兩個 → 第三個', R, 3.6);
  say('Tree 的 property：三個條件', '符合任兩個，就推得第三個');
  await step(tok); // 3333 它有n-1條h
  pkt('connected ／ 沒有 cycle ／ n−1 條 edge', R, 2.8);
  tag('9 個點、8 條 edge', 'idx', -3.6, 7.5);
  say('connected、沒有 cycle、n − 1 條 edge', '這裡 9 個點、8 條 edge');
  await step(tok); // 3372 只存在唯一一條path
  [[9, 7], [7, 1], [1, 2], [2, 3]].forEach(([a, b]) => L[ek(a, b)].material.color.set(JC.blue));
  note('任兩點之間只有唯一一條 path', R, 2.0);
  say('Tree 裡，任兩點之間只有唯一一條 path', '例如 9 到 3');
  await step(tok); // 3388 rooted tree的話呢顧名思義
  TE.forEach(([a, b]) => L[ek(a, b)].material.color.set(JC.edge));
  glow(v[1], GOLD);
  hdr('rooted tree：root = 1', R, 1.2);
  say('指定了 root 的 tree：rooted tree', '這裡 root 是 1');
  await step(tok); // 3423 主要原因是因為它有hierarchy
  say('Rooted tree 有 hierarchy（層級）', '上面輩分高，下面輩分低');
  await step(tok); // 3450 最尾巴的那些就叫leaf
  [3, 4, 6, 8, 9].forEach((k) => tint(v[k], JC.green));
  tint(v[1], JC.gold);
  tag('leaf（葉子）', 'idx', -3.6, 1.9);
  say('最上面是 root（樹根），最下層是 leaf', '');
  await step(tok); // 3464 假設抓node7這個點
  glow(v[1], null); glow(v[7], GOLD);
  const pa = pkt('7 的 parent：1', R, 0.4);
  say('看 node 7：往上那個是 parent', '7 的 parent 是 1');
  await step(tok); // 3477 Node 8和9的話
  tint(v[8], JC.blue); tint(v[9], JC.blue);
  txt(pa, '7 的 parent：1　children：8、9');
  say('往下的是 children', '8 和 9 是 7 的小孩');
  await step(tok); // 3490 下面這些人都會是他什麼子孫
  glow(v[7], null);
  [2, 3, 4, 5, 6, 7, 8, 9].forEach((k) => glow(v[k], '#2a2a10'));
  txt(pa, '1 下面的人都是 1 的子孫');
  say('1 下面所有的人，都是 1 的子孫', 'descendant');
  await step(tok); // 3531 他們是兄弟姐妹
  [2, 3, 4, 5, 6, 7, 8, 9].forEach((k) => glow(v[k], null));
  [2, 5, 7].forEach((k) => glow(v[k], GOLD));
  txt(pa, '7、5、2：sibling（兄弟姐妹）');
  say('7、5、2 同一個 parent：sibling', '');
  await step(tok); // 3544 就Uncle
  [2, 7].forEach((k) => glow(v[k], null));
  glow(v[8], GOLD);
  txt(pa, '5 是 8 的 uncle，8 是 5 的 nephew');
  say('8 的 parent 是 7，5 是 8 的 uncle', '反過來 8 是 5 的 nephew');
  await step(tok); // 3574 grandfather
  glow(v[5], null); glow(v[8], null); glow(v[9], GOLD); glow(v[1], GOLD);
  txt(pa, '1 是 9 的 grandfather（祖父）');
  say('9 的 parent 是 7，7 的 parent 是 1', '1 是 9 的 grandfather');
  await step(tok); // 3604 side map
  glow(v[9], null); glow(v[1], null);
  txt(pa, '網站 site map：home page = root');
  say('例子：網站的 site map 也是 hierarchy', 'home page 是 root，subpage 是小孩');
}]);

// 60:58 s-t connectivity、connected component、迷宮
const MZ = { cols: [-4.6, -3.4, -2.2, -1.0], rows: [2.6, 3.8, 5.0] };
// open passages between maze cells [c,r]-[c,r]
const MZE = [[[0, 0], [1, 0]], [[1, 0], [1, 1]], [[0, 1], [0, 2]], [[0, 1], [1, 1]], [[1, 1], [2, 1]], [[2, 1], [2, 0]], [[2, 0], [3, 0]], [[2, 1], [2, 2]], [[2, 2], [3, 2]], [[1, 2], [2, 2]], [[3, 1], [3, 2]]];
FRAG.push(['graphjiang1-stconn', 's-t connectivity 與 connected component', async (tok) => {
  fresh(CAM, LOOK);
  const R = 4.6;
  await step(tok); // 3658 我們就進到這一個章節的重點
  hdr('Connectivity ＆ Traversal', R, 6.8);
  say('本章重點：graph 的 connectivity 和 traversal', '');
  await step(tok); // 3669 兩個非常有名的Traversal方法
  pkt('BFS：Breadth-First Search', R, 6.0); pkt('DFS：Depth-First Search', R, 5.3);
  say('兩個有名的 traversal：BFS 和 DFS', '還有它們背後的 property');
  await step(tok); // 3693 graph traversal跟
  say('Traversal 和 connectivity 息息相關', '');
  await step(tok); // 3718 我在Identify特別兩個點
  const G = gGraph(Object.keys(P13).map(Number), E13, P13);
  G.col(1, JC.blue); G.col(6, JC.pink);
  const ts = tag('s', 'ptr', P13[1][0], P13[1][1] + 0.7), tt = tag('t', 'ptr', P13[6][0], P13[6][1] + 0.7);
  say('給一個 graph，指定兩個點 s 和 t', '');
  await step(tok); // 3730 S通常都對應就是一個Source點
  note('s = source（起點）　t = target（終點）', R, 4.5);
  say('s 是 source（起點），t 是 target（終點）', '');
  await step(tok); // 3743 s到t之間是否存在一條path
  hdr('s-t connectivity：s 到 t 有沒有 path？', R, 3.7);
  say('問題：s 到 t 之間有沒有 path', '有 → s 和 t 是 connected');
  await step(tok); // 3767 13個點在這裡面
  remove(ts); remove(tt); G.all(JC.idle);
  say('例子：13 個點的 graph', 'edge 都畫好了');
  await step(tok); // 3793 如果我要判定1和6
  G.col(1, JC.blue); G.col(6, JC.blue);
  [[1, 2], [2, 5], [5, 6]].forEach(([a, b]) => paintE(G.ed(a, b), JC.blue, 'thick'));
  good('1 和 6：connected', R, 2.9);
  say('1 和 6 是不是 connected？是', '找得到一條 path');
  await step(tok); // 3803 那7和13呢
  G.col(7, JC.red); G.col(13, JC.red);
  bad('7 和 13：disconnected', R, 2.2);
  say('7 和 13：找不到 path', 'disconnected');
  await step(tok); // 3833 這邊其實可以分成三區塊
  G.allE(JC.edge);
  K8.forEach((k) => G.col(k, JC.teal)); [9, 10].forEach((k) => G.col(k, JC.purple)); [11, 12, 13].forEach((k) => G.col(k, JC.orange));
  say('這張圖分成三個區塊', '');
  await step(tok); // 3845 這樣其實會形成一個叫做connected component
  const cl = [tag('component ①', 'idx', -3.4, 7.2), tag('②', 'idx', 0.7, 7.0), tag('③', 'idx', 0.4, -0.2)];
  say('每一塊叫 connected component', '1..8、9 10、11 12 13');
  await step(tok); // 3870 小小的connected graph
  note('一個 component = 一個小小的 connected graph', R, 1.4);
  say('塊內任兩點一定互相連得到', '一個 component 就是小小的 connected graph');
  await step(tok); // 3881 關於迷宮上面的problem
  for (const k in G.v) kill(G.v[k]); for (const k in G.e) kill(G.e[k]); cl.forEach(remove);
  const cell = {};
  MZ.cols.forEach((x, c) => MZ.rows.forEach((y, r) => { cell[c + ',' + r] = cube('', JC.paper, [1.0, 1.0, 0.12], x, y, -0.2); }));
  hdr('迷宮', -2.8, 6.4);
  say('這種問題常出現在迷宮', '');
  await step(tok); // 3905 把老鼠放在某一個點上面
  const mouse = pal('老鼠', MZ.cols[0], MZ.rows[0] - 0.3, JC.gray, 0.4, 0.4);
  icon('🧀', '', MZ.cols[3], MZ.rows[2], 0.4);
  say('老鼠放在某一格，cheese 放在另一格', '要找一條路吃到 cheese');
  await step(tok); // 3930 每一個小格子
  const P = (c, r) => V3(MZ.cols[c], MZ.rows[r], 0.05);
  MZE.forEach(([a, b]) => rod(P(...a), P(...b), JC.edge, { gap: 0.25 }));
  say('每一格是一個 node', '中間沒有牆，就建一條 edge');
  await step(tok); // 3967 讓這個老鼠呢找到一條路徑
  const route = [[1, 0], [1, 1], [2, 1], [2, 2], [3, 2]];
  for (const [c, r] of route) { tint(cell[c + ',' + r], JC.green); await goTo(tok, mouse, MZ.cols[c], MZ.rows[r] - 0.3, 380); }
  mouse.mood('happy');
  say('用演算法找到一條到 cheese 的路徑', '迷宮就解完了');
}]);

// 66:24 Breadth-first search：一圈一圈往外擴散
const LAY = { 1: 0, 2: 1, 3: 1, 4: 2, 5: 2, 7: 2, 8: 2, 6: 3 };
FRAG.push(['graphjiang1-bfs', 'BFS：像水波一圈一圈往外擴散', async (tok) => {
  fresh(CAM, LOOK);
  const G = gGraph(Object.keys(P13).map(Number), E13, P13);
  const R = 4.6, c1 = V3(P13[1][0], P13[1][1], -0.1), lt = {};
  const layerTag = (k) => { if (lt[k]) remove(lt[k]); lt[k] = tag('L' + LAY[k], 'pkt', G.p[k].x + 0.55, G.p[k].y + 0.5, 0.3); };
  const rings = [];
  await step(tok); // 3984 第一個我們要介紹的是BreferSearch
  hdr('Breadth-First Search（BFS）', R, 6.8);
  say('第一個 traversal：Breadth-First Search', '把整張圖走一遍');
  await step(tok); // 3995 Brefer Search它是一個寬度優先
  note('寬度優先', R, 6.0);
  say('BFS：寬度優先', '');
  await step(tok); // 4006 你先選定一個點當作起點
  G.col(1, LAYC[0]);
  const st = tag('起點', 'ptr', P13[1][0], P13[1][1] + 0.8);
  say('先選一個點當起點', '這裡選 1');
  await step(tok); // 4019 滴下一滴水滴
  const drop = icon('💧', '', P13[1][0], 7.4, 0.5);
  await travel(tok, drop, drop.position.clone(), V3(P13[1][0], P13[1][1] + 1.5, 0.5), 600); // the drop vanishes just above '起點' (never on the node's number)
  remove(drop);
  say('想像在起點滴下一滴水', '');
  await step(tok); // 4035 一圈一圈的漣漪
  rings.push(await ripple(tok, c1, 1.0, JC.blue, 700));
  say('水波一圈一圈往外擴散', '靠擴散就能把圖走完');
  await step(tok); // 4052 那它第一圈就往外擴散
  rings.push(await ripple(tok, c1, 2.6, LAYC[1]));
  [2, 3].forEach((k) => G.col(k, LAYC[1]));
  say('第一圈：走到 2 和 3', '');
  await step(tok); // 4061 再往外擴散一圈就走到了四五七八
  rings.push(await ripple(tok, c1, 4.0, LAYC[2]));
  [4, 5, 7, 8].forEach((k) => G.col(k, LAYC[2]));
  say('再一圈：走到 4、5、7、8', '');
  await step(tok); // 4063 然後再往外擴散一圈就走到六
  rings.push(await ripple(tok, c1, 5.0, LAYC[3]));
  G.col(6, LAYC[3]);
  say('再一圈：走到 6', '');
  await step(tok); // 4080 我們就叫它Layer 0
  layerTag(1);
  say('照圈數幫點標 layer：起點是 L0', '');
  await step(tok); // 4094 往外擴散的第一圈Wave
  [2, 3, 4, 5, 7, 8, 6].forEach(layerTag);
  say('第一圈 L1、第二圈 L2、第三圈 L3', '依此類推');
  await step(tok); // 4118 這個水波可不可以擴散出去
  G.all(JC.idle); for (const k in lt) { remove(lt[k]); delete lt[k]; } rings.forEach((m) => kill(m)); remove(st);
  note('水波只能沿著 edge 擴散', R, 5.2);
  say('水波能不能擴散出去，要看 edge', '');
  await step(tok); // 4129 往外有兩條A局分別連到2和3
  G.col(1, LAYC[0]); layerTag(1);
  [2, 3].forEach((k) => { paintE(G.ed(1, k), LAYC[1], 'thick'); G.col(k, LAYC[1]); layerTag(k); });
  say('1 有兩條 edge，連到 2 和 3', '第一圈 reach 到 2、3 → L1');
  await step(tok); // 4141 再把L1這2和3的鄰居
  [[2, 4], [2, 5], [3, 7], [3, 8]].forEach(([a, b]) => { paintE(G.ed(a, b), LAYC[2], 'thick'); G.col(b, LAYC[2]); layerTag(b); });
  say('再找 L1（2、3）的鄰居：4、5、7、8', '它們是 L2');
  await step(tok); // 4156 只剩下5往外還有一條A局
  paintE(G.ed(5, 6), LAYC[3], 'thick'); G.col(6, LAYC[3]); layerTag(6);
  say('只剩 5 還有一條 edge 沒走：走到 6', '6 是 L3');
  await step(tok); // 4167 右邊這些人怎麼辦
  [9, 10, 11, 12, 13].forEach((k) => G.col(k, JC.dim));
  bad('9～13：從 1 永遠走不到', R, 4.4);
  say('右邊這些人：從 1 出發永遠走不到', '它們本來就跟 1 disconnected');
  await step(tok); // 4190 breferred search用來做什麼
  good('BFS 找出起點 reach 得到的所有人', R, 3.6);
  say('BFS 的用途：找出起點到得了的所有點', '做一次 BFS 就知道誰跟它 connected');
  await step(tok); // 4241 L1其實就是L0的鄰居們
  note('L1 = L0 的鄰居', R, 2.8);
  say('L0 是起點；L1 是 L0 的鄰居', '');
  await step(tok); // 4251 L2就是L1的鄰居們扣掉
  note('L2 = L1 的鄰居 − 已經走過的', R, 2.1);
  say('L2 是 L1 的鄰居，扣掉走過的', '');
  await step(tok); // 4265 比如說3這條3或2好了
  glow(G.v[3], GOLD);
  paintE(G.ed(2, 3), JC.red, 'thick');
  const why = bub('1→3 或 1→2→3？', P13[3][0] + 0.2, P13[3][1] - 1.0, 0.6);
  say('3 可以 1→3，也可以 1→2→3', '最早 reach 到時就 label，之後再看到就 skip');
  await step(tok); // 4279 對於3來說它會labor成L1
  paintE(G.ed(2, 3), JC.edge); remove(why);
  say('3 在 L1 就最早被看到 → label 成 L1', '');
  await step(tok); // 4304 其實就代表從source端
  glow(G.v[3], null);
  hdr('layer 編號 = 最少經過的 edge 數', R, 1.2);
  say('Layer 數字 = 起點到它最少經過的 edge 數', 'BFS 幫你找到最短距離');
  await step(tok); // 4355 這個Layer這個Number呢其實它代表
  pkt('也就是 distance', R, 0.4);
  say('也就是前面定義的 distance', '');
}]);

// 73:03 BFS tree
const BT = { 1: [4.6, 6.4], 2: [3.4, 4.8], 3: [5.8, 4.8], 4: [2.6, 3.2], 5: [3.9, 3.2], 7: [5.3, 3.2], 8: [6.6, 3.2], 6: [3.9, 1.6] };
const BTE = [[1, 2], [1, 3], [2, 4], [2, 5], [3, 7], [3, 8], [5, 6]];
const BNT = [[2, 3], [3, 5], [4, 5], [7, 8]];
FRAG.push(['graphjiang1-bfstree', 'BFS tree：tree edge 與 non-tree edge', async (tok) => {
  fresh(CAM, LOOK);
  const G = gGraph(Object.keys(P13).map(Number), E13, P13);
  await step(tok); // 4383 BFS其實呢它還有另外一個好處
  G.col(1, LAYC[0]);
  say('BFS 還有另一個好處', '');
  await step(tok); // 4397 他順便會送你一顆tree
  hdr('BFS tree', 4.6, 7.3);
  say('做完 BFS，順便送你一棵 tree：BFS tree', '');
  await step(tok); // 4410 1往外出發接下來其實他會reach到
  [2, 3].forEach((k) => { G.col(k, LAYC[1]); paintE(G.ed(1, k), JC.red, 'thick'); });
  say('1 往外 reach 到 2 和 3', '經過 1–2、1–3：標成紅色');
  await step(tok); // 4422 紅色的然後接下來第二圈
  for (const [a, b] of [[2, 4], [2, 5], [3, 7], [3, 8]]) { G.col(b, LAYC[2]); paintE(G.ed(a, b), JC.red, 'thick'); await anim(tok, 250, () => {}); }
  say('第二圈：2、3 擴散到 4、5、7、8', '照 index 順序，這 4 條 edge 也變紅');
  await step(tok); // 4441 我們再往外會reach到就是6
  G.col(6, LAYC[3]); paintE(G.ed(5, 6), JC.red, 'thick');
  say('再往外 reach 到 6', '');
  await step(tok); // 4451 中間這些其他的這些多餘的age
  BNT.forEach(([a, b]) => paintE(G.ed(a, b), JC.edge, 'dash'));
  const sk = bub('對方已經 visit 過 → skip', -2.6, 7.3);
  say('其他多餘的 edge：檢查時對方已被 visit', '所以 skip，畫成虛線');
  await step(tok); // 4463 真正是這些age真正被利用來
  remove(sk);
  say('真正用來完成 BFS 的紅色 edge', '會形成一棵 tree');
  await step(tok); // 4488 我轉成tree的形式
  const T = gTree(BT, BTE, []);
  [[1], [2, 3], [4, 5, 7, 8], [6]].forEach((ks, i) => { tag('L' + i, 'idx', 1.7, BT[ks[0]][1]); ks.forEach((k) => tint(T.v[k], LAYC[i])); });
  say('畫成 tree：root 是起點 1', 'L1 掛在下一層，L2、L3 再往下');
  await step(tok); // 4500 虛線的這些edge
  BNT.forEach(([a, b]) => line(BT[a][0], BT[a][1], BT[b][0], BT[b][1], -0.05, '#9c8b70'));
  pkt('細線 = non-tree edge', 4.6, 0.5);
  say('虛線的 edge：non-tree edge', '不是用來組成這棵 tree 的');
}]);

// 75:26 BFS 的 property：edge 兩端 layer 最多差 1
const LP = { 1: [-3.2, 6.2], 2: [-4.8, 4.6], 3: [-1.6, 4.6], 4: [-6.2, 3.0], 5: [-4.2, 3.0], 7: [-2.2, 3.0], 8: [-0.4, 3.0], 6: [-4.2, 1.4] };
FRAG.push(['graphjiang1-bfsprop', 'BFS property：edge 兩端的 layer 最多差 1', async (tok) => {
  fresh(CAM, LOOK);
  const R = 4.0;
  const G = gGraph(K8, E13, LP);
  K8.forEach((k) => G.col(k, LAYC[LAY[k]]));
  [0, 1, 2, 3].forEach((i) => tag('L' + i, 'idx', -7.0, [6.2, 4.6, 3.0, 1.4][i]));
  BTE.forEach(([a, b]) => paintE(G.ed(a, b), JC.red));
  await step(tok); // 4526 就很重要的property是這個
  hdr('T 是一棵 BFS tree', R, 7.0);
  say('BFS 很重要的 property', 'T 是一棵 BFS tree');
  await step(tok); // 4553 identify兩點出來
  glow(G.v[3], GOLD); glow(G.v[5], GOLD);
  const xl = tag('x ∈ Lᵢ', 'ptr', LP[3][0] + 0.9, LP[3][1] + 0.6), yl = tag('y ∈ Lⱼ', 'ptr', LP[5][0] + 0.9, LP[5][1] + 0.6);
  say('挑兩個點 x、y：x 在 Lᵢ，y 在 Lⱼ', '');
  await step(tok); // 4565 如果XY這兩點之間存在一條AGG
  paintE(G.ed(3, 5), JC.purple, 'thick');
  note('x、y 之間有一條 G 的 edge（不一定是 tree edge）', R, 6.2);
  say('x、y 之間有一條 edge', '是 G 的 edge，不一定是 tree edge');
  await step(tok); // 4591 最多不會差到
  pkt('|i − j| ≤ 1', R, 5.4);
  say('結論：兩端的 layer 最多差 1', '相等，或剛好差 1');
  await step(tok); // 4643 如果是treeage當然是連線的是上下差
  glow(G.v[3], null); glow(G.v[5], null); remove(xl); remove(yl); paintE(G.ed(3, 5), JC.edge);
  BTE.forEach(([a, b]) => paintE(G.ed(a, b), JC.red, 'thick'));
  say('Tree edge：連上下相鄰兩層，差 1', '');
  await step(tok); // 4654 如果是Non-TreeEdge呢
  BTE.forEach(([a, b]) => paintE(G.ed(a, b), JC.red));
  [[2, 3], [4, 5], [7, 8]].forEach(([a, b]) => paintE(G.ed(a, b), JC.purple, 'thick'));
  paintE(G.ed(3, 5), JC.orange, 'thick');
  note('non-tree edge：同一層（紫）或相鄰兩層（橘）', R, 4.6);
  say('Non-tree edge：連同一層，或跨相鄰兩層', '');
  await step(tok); // 4666 當然大家一定想為什麼
  hdr('為什麼？證明它', R, 3.8);
  say('為什麼？要證明它', '不空口說白話');
  await step(tok); // 4736 我們為了讓證明方便我們就先assume
  [[2, 3], [4, 5], [7, 8], [3, 5]].forEach(([a, b]) => paintE(G.ed(a, b), JC.edge));
  glow(G.v[3], GOLD);
  note('先假設 j ≥ i（y 的 layer 比較大）', R, 3.1);
  say('先假設 y 的 layer 比較大：j ≥ i', '另一個方向是對稱的');
  await step(tok); // 4753 這個證明一樣是用反正法
  say('用反證法（proof by contradiction）', '先假設相反，推出矛盾');
  await step(tok); // 4837 先suppose呢追減i
  bad('假設：j − i > 1', R, 2.4);
  glow(G.v[6], GOLD);
  const yl2 = tag('y？', 'ptr', LP[6][0] + 0.8, LP[6][1] + 0.5);
  say('假設 j − i > 1', 'y 比 x 深兩層以上');
  await step(tok); // 4875 是是屬於Li
  const xl2 = tag('x ∈ Lᵢ', 'ptr', LP[3][0] + 0.9, LP[3][1] + 0.6);
  say('x 在 Lᵢ', '');
  await step(tok); // 4891 X的neighbor有兩種
  [[3, 7], [3, 8]].forEach(([a, b]) => paintE(G.ed(a, b), JC.blue, 'thick'));
  note('x 的鄰居：在 Lᵢ₊₁ 被 reach，或更早就看過', R, 1.7);
  say('x 的鄰居：下一層 Lᵢ₊₁ 會 reach 到', '不然就是更早已經看過');
  await step(tok); // 4948 所以Y當然是屬於X的鄰居
  pkt('y 是 x 的鄰居 → j ≤ i + 1', R, 1.0);
  say('y 是 x 的鄰居，所以 j ≤ i + 1', '');
  await step(tok); // 4988 j-i會小於等於1的條件
  pkt('j − i ≤ 1', R, 0.3);
  say('移項：j − i ≤ 1', '');
  await step(tok); // 5001 就矛盾了
  bad('跟 j − i > 1 矛盾！', 0.4, 7.2);
  say('跟假設矛盾，所以 j − i ≤ 1', '證完');
  await step(tok); // 5030 之後每個點呢身上
  remove(yl2); remove(xl2); glow(G.v[3], null); glow(G.v[6], null);
  G.allE(JC.edge); BTE.forEach(([a, b]) => paintE(G.ed(a, b), JC.red));
  good('有 edge → 同層或相鄰兩層', 0.4, 6.5);
  say('BFS 後每個點都有 layer label', '有 edge 的兩點：同層或相鄰兩層');
}]);

// 84:20 用 BFS 找 connected component
FRAG.push(['graphjiang1-cc', '用 BFS 找 connected component', async (tok) => {
  fresh(CAM, LOOK);
  const G = gGraph(Object.keys(P13).map(Number), E13, P13);
  const R = 4.6, c1 = V3(P13[1][0], P13[1][1], -0.1);
  await step(tok); // 5060 其實BFS來講的話
  G.col(1, LAYC[0]);
  tag('s', 'ptr', P13[1][0], P13[1][1] + 0.8);
  say('BFS 很好用：給一個起點 s', '');
  await step(tok); // 5073 第一層的話就從s這個起點開始
  await ripple(tok, c1, 2.6, LAYC[1], 700); [2, 3].forEach((k) => G.col(k, LAYC[1]));
  await ripple(tok, c1, 4.0, LAYC[2], 700); [4, 5, 7, 8].forEach((k) => G.col(k, LAYC[2]));
  say('先找 s 的鄰居，再找鄰居的鄰居', '一圈一圈往外');
  await step(tok); // 5085 直到走不下去而止
  await ripple(tok, c1, 5.0, LAYC[3], 700); G.col(6, LAYC[3]);
  say('直到走不下去才停', '');
  await step(tok); // 5099 就一定會reach到這些人
  K8.forEach((k) => G.col(k, JC.teal));
  good('s 到得了的，BFS 一定 reach 到', R, 6.4);
  say('s 到得了的點，BFS 一定都抓得到', '');
  await step(tok); // 5112 剛剛一開始的話有跟大家提到connected
  hdr('connected component', R, 7.2);
  say('這就是 connected component', '');
  await step(tok); // 5125 我可以拆成一些的
  note('undirected graph → 拆成幾個 component', R, 5.6);
  say('Undirected graph 可以拆成幾個 component', '塊內的點彼此 reachable');
  await step(tok); // 5152 Node1 它所屬的
  K8.forEach((k) => glow(G.v[k], '#14382a'));
  say('Node 1 所在的 component：跟它相連的人', 'BFS 就找得到');
  await step(tok); // 5166 但是9和10跟1
  K8.forEach((k) => glow(G.v[k], null));
  [9, 10].forEach((k) => G.col(k, JC.purple));
  say('9 和 10 跟 1 屬於不同的 component', '');
  await step(tok); // 5178 我們可以區分成有三個
  [11, 12, 13].forEach((k) => G.col(k, JC.orange));
  pkt('三個 connected component', R, 4.8);
  say('這張圖有三個 connected component', '');
  await step(tok); // 5190 我可以找小一點
  K8.forEach((k) => G.col(k, JC.idle)); [1, 2, 3, 4, 5].forEach((k) => G.col(k, JC.teal));
  const ask = bub('1～5 也都互相連通？', -3.4, 7.3);
  say('有人說：1、2、3、4、5 也互相連通', '這樣算一個 component 嗎？');
  await step(tok); // 5202 我們connected component會取到最大
  remove(ask);
  bad('還能加點 → 不是 component', R, 4.0);
  say('Component 要取到最大', '加不進任何新點、還保持 connected 為止');
  await step(tok); // 5216 包含這八個點
  K8.forEach((k) => G.col(k, JC.teal));
  good('1～8 這八個點才是一個 component', R, 3.2);
  say('要包含這八個點，才是一個 component', '');
}]);

// 87:21 應用：小畫家的油漆桶（flood fill）
const PIX = ['WWWBBWWW', 'WWBGGBWW', 'WWBGGBWW', 'WWWGGGWW', 'WWWGGWWW', 'WWWBBWWW'];
FRAG.push(['graphjiang1-fill', '應用：小畫家的油漆桶就是 BFS', async (tok) => {
  fresh(CAM, LOOK);
  const C = { W: '#f6f1e6', B: '#3a3530', G: '#c6e84a' }, px = {};
  const X = (c) => -3.6 + c * 0.86, Y = (r) => 5.9 - r * 0.86;
  await step(tok); // 5241 就是做小畫家
  hdr('小畫家', 0, 7.3);
  say('簡單應用：小畫家', '');
  await step(tok); // 5253 那假設這邊畫一隻雞
  PIX.forEach((row, r) => [...row].forEach((ch, c) => { px[r + ',' + c] = cube('', C[ch], [0.8, 0.8, 0.2], X(c), Y(r), 0); px[r + ',' + c].userData.ch = ch; }));
  icon('🐔', '', -5.6, 5.0, 0.3, 'lg');
  say('畫一隻雞，脖子是檸檬綠', '');
  await step(tok); // 5266 一個點之後呢選擇另外一個顏色
  const bucket = icon('🪣', '倒水桶', 5.2, 5.0, 0.3);
  say('油漆桶：點一下、倒下新顏色', '相連的同色區域全部換色');
  await step(tok); // 5279 我想要換成藍色
  pkt('想把綠色脖子換成藍色', 5.0, 3.4);
  say('想把綠色的脖子換成藍色', '');
  await step(tok); // 5292 我們可以利用我們目前所學的BFS
  say('怎麼做？用剛學的 BFS', '');
  await step(tok); // 5311 一張圖片其實你可以分成很多的Pixel
  for (const k in px) px[k].scale.set(0.8, 0.8, 1);
  note('每個 pixel 有 RGB 顏色', 5.0, 2.6);
  say('一張圖分成很多 pixel', '每個 pixel 有 RGB 三種顏色');
  await step(tok); // 5326 一個Node去代表它如果這個Node跟它隔壁
  const same = (a, b) => px[a] && px[b] && px[a].userData.ch === px[b].userData.ch;
  const linkAll = (ch, col) => { for (let r = 0; r < PIX.length; r++) for (let c = 0; c < 8; c++) { const k = r + ',' + c; if (px[k].userData.ch !== ch) continue; [[r, c + 1], [r + 1, c]].forEach(([r2, c2]) => { if (same(k, r2 + ',' + c2)) line(X(c), Y(r), X(c2), Y(r2), 0.2, col); }); } };
  linkAll('G', '#2b6a10');
  say('每個 pixel 是一個 node', '跟隔壁顏色一樣，就建一條 edge');
  await step(tok); // 5340 這幾個可能是黑色
  linkAll('B', '#d64545');
  say('黑色的相鄰 pixel 也連起來', '');
  await step(tok); // 5353 一樣的相鄰兩點我就不建立edge
  bad('顏色不同 → 不建 edge', 5.0, 1.8);
  say('顏色不一樣的相鄰兩點：不建 edge', '');
  await step(tok); // 5365 就這樣做就點一個點
  const seed = '2,3';
  glow(px[seed], GOLD);
  await travel(tok, bucket, bucket.position.clone(), V3(X(3), Y(2) + 0.6, 0.4), 800);
  say('點一個 pixel，倒入藍色', '從這裡做一次 BFS');
  await step(tok); // 5377 那跟他相只要跟他就到達透過BFS
  const dist = { [seed]: 0 }, q = [seed], wave = [[seed]];
  while (q.length) { const k = q.shift(); const [r, c] = k.split(',').map(Number); for (const [r2, c2] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) { const k2 = r2 + ',' + c2; if (same(k, k2) && dist[k2] === undefined) { dist[k2] = dist[k] + 1; (wave[dist[k2]] = wave[dist[k2]] || []).push(k2); q.push(k2); } } }
  for (const ks of wave) { ks.forEach((k) => glow(px[k], '#3a3000')); await anim(tok, 260, () => {}); }
  say('BFS 走得到的，都是靠 edge 相連的', '一定是同一個顏色');
  await step(tok); // 5390 所以就可以把他染掉
  for (const ks of wave) { ks.forEach((k) => { glow(px[k], null); tint(px[k], JC.blue); }); await anim(tok, 200, () => {}); }
  remove(bucket);
  good('一次 BFS → 染色完成', 5.0, 1.0);
  say('把它們全部換成藍色', '一個簡單的 BFS 就做到');
}]);

// ════════ FvUs-OlAy18（Lec07 Graphs 2/4） ════════
// DFS tree of the lecturer's run from 1 (smaller index first): 1 2 3 5 4 6 7 8
const DT = { 1: [3.6, 6.6], 2: [3.6, 5.4], 3: [3.6, 4.2], 5: [2.6, 3.0], 4: [2.0, 1.8], 6: [3.2, 1.8], 7: [4.8, 3.0], 8: [4.8, 1.8] };
const DTE = [[1, 2], [2, 3], [3, 5], [5, 4], [5, 6], [3, 7], [7, 8]];
const DNT = [[1, 3], [2, 4], [2, 5], [3, 8]];
// a little call stack / container column: push(label) / pop()
function column(x, y0, title, dy = 0.62, col = JC.paper) {
  const S = { items: [], x, y0 };
  tag(title, 'idx', x, y0 - 0.55);
  S.push = (t, c) => { S.items.push(cube(t, c || col, [1.5, 0.5, 0.5], x, y0 + S.items.length * dy, 0, 1.2)); return S.items[S.items.length - 1]; };
  S.pop = () => { const m = S.items.pop(); if (m) fly(m); };
  S.top = () => S.items[S.items.length - 1];
  return S;
}

// 00:16 複習 BFS、connected component
FRAG.push(['graphjiang1-ccintro', 'Connected component：一坨一坨連在一起', async (tok) => {
  fresh(CAM, LOOK);
  const G = gGraph(Object.keys(P13).map(Number), E13, P13);
  const R = 4.6, c1 = V3(P13[1][0], P13[1][1], -0.1);
  await step(tok); // 16 在上次的課程當中的話
  G.col(1, LAYC[0]);
  for (const [r, ks, i] of [[2.6, [2, 3], 1], [4.0, [4, 5, 7, 8], 2], [5.0, [6], 3]]) { await ripple(tok, c1, r, LAYC[i], 600); ks.forEach((k) => G.col(k, LAYC[i])); }
  say('複習 BFS：從起點一圈一圈往外 visit 鄰居', '');
  await step(tok); // 43 進入deferencesearch之前
  G.all(JC.idle);
  hdr('connected component', R, 6.8);
  say('講 DFS 之前，先講一個重要問題', 'connected component');
  await step(tok); // 55 這邊請注意一下我們討論是undirected
  note('只討論 undirected graph', R, 6.0);
  say('注意：這裡討論 undirected graph', '');
  await step(tok); // 92 Cognetic顧名思義它是連結在一起的
  say('Component：連在一起的一坨一團', '');
  await step(tok); // 105 其實有三個Cognetic Component
  K8.forEach((k) => G.col(k, JC.teal)); [9, 10].forEach((k) => G.col(k, JC.purple)); [11, 12, 13].forEach((k) => G.col(k, JC.orange));
  pkt('三坨 → 三個 component', R, 5.2);
  say('這張圖有三個 connected component', '眼睛一看就是三坨');
  await step(tok); // 117 1的這個點呢它所在的
  K8.forEach((k) => glow(G.v[k], '#14382a'));
  const w1 = pal('', ...onV(G, 1), JC.orange, 0.42, 0.6);
  say('1 所在的 component 是誰？', '這一群：1 到 8');
  await step(tok); // 129 如果是包含11Node11
  K8.forEach((k) => glow(G.v[k], null)); [11, 12, 13].forEach((k) => glow(G.v[k], '#3a2008'));
  await goTo(tok, w1, ...onV(G, 11), 800);
  say('包含 11 的 component', '11、12、13');
  await step(tok); // 152 connectivity講的基本上就是給定兩個點
  [11, 12, 13].forEach((k) => glow(G.v[k], null));
  note('connectivity：兩點之間有沒有 path', R, 4.4);
  say('Connectivity：兩個點之間有沒有 path', '能不能沿著 edge 到達對方');
  await step(tok); // 164 顧名思義其實就想要找到一群人
  good('component：一群彼此有路徑到達的人', R, 3.6);
  say('Component：找出一群人', '彼此之間都有路徑到達對方');
}]);

// 03:07 找 s 所在 component 的 procedure：R 一直長大
FRAG.push(['graphjiang1-rproc', '找 component：R 從 s 開始一直長大', async (tok) => {
  fresh(CAM, LOOK);
  const G = gGraph(Object.keys(P13).map(Number), E13, P13);
  const R = 4.6, inR = new Set();
  const rt = pkt('R = { }', R, 4.0);
  const show = () => txt(rt, 'R = { ' + [...inR].sort((a, b) => a - b).join(', ') + ' }');
  const add = (k) => { inR.add(k); G.col(k, JC.teal); show(); };
  const code0 = code(['R = {s}', 'while 有 edge (u,v)，u ∈ R、v ∉ R：', '    把 v 加進 R', 'return R'], R, 6.6, 0.55);
  code0.ls.forEach((l) => (l.element.style.visibility = 'hidden'));
  const showL = (i) => { code0.ls[i].element.style.visibility = ''; code0.hl(i); };
  await step(tok); // 200 假設我給定一個點然後基本上我想要請你幫我找一下
  G.col(1, JC.blue); tag('s', 'ptr', P13[1][0], P13[1][1] + 0.8);
  say('給定一個點 s，找出它所在的 component', '');
  await step(tok); // 223 從這個點給定的s點這個點出發
  const w = pal('', ...onV(G, 1), JC.orange, 0.42, 0.6);
  say('從 s 出發，沿著 edge 一直拜訪鄰居', '有 path 相連的都抓出來');
  await step(tok); // 250 假設叫r這個set
  say('輸出的 component 叫 R，是一個 set', '');
  await step(tok); // 277 我們就先把S先抓出來
  showL(0); add(1);
  say('第一步：先把 s 放進 R', '');
  await step(tok); // 302 我就開始呢去找那些age
  showL(1);
  say('接著反覆找 edge，找到更多鄰居', 'path 是由 edge 組成的');
  await step(tok); // 328 那其中一個點是在我目前含有的這個R
  paintE(G.ed(1, 2), JC.hot, 'thick');
  tag('u', 'ptr', P13[1][0] - 0.6, P13[1][1]); tag('v', 'ptr', P13[2][0] - 0.6, P13[2][1]);
  say('找一條 edge (u, v)：u 在 R 裡、v 不在', '');
  await step(tok); // 343 那如果有這樣的A句存在的話呢
  showL(2);
  await walkPath(tok, w, G, [2], 500); add(2); paintE(G.ed(1, 2), JC.teal, 'thick');
  say('找到了，就把 v 放進 R', '');
  await step(tok); // 355 直到呢我再也找不到任何的A句
  for (const [u, v] of [[1, 3], [2, 4], [2, 5], [5, 6], [3, 7], [3, 8]]) { await walkPath(tok, w, G, [u, v], 180); add(v); paintE(G.ed(u, v), JC.teal, 'thick'); }
  showL(3);
  say('一直做，直到再也找不到跨出 R 的 edge', '');
  await step(tok); // 367 這個r這個set吐出來
  kill(w.g);
  good('R 就是 s 的 connected component', R, 3.2);
  say('這時候的 R，就是 connected component', '');
  await step(tok); // 380 大家可以想一下就假設呢在某一個中間的過程當中
  inR.clear(); K8.forEach((k) => G.col(k, JC.idle)); G.allE(JC.edge);
  [1, 2, 3].forEach(add);
  say('為什麼對？看中間某一刻的 R', '例如 R = {1, 2, 3}');
  await step(tok); // 394 任何一個人跟S之間都存在path
  [[1, 2], [1, 3]].forEach(([a, b]) => paintE(G.ed(a, b), JC.blue, 'thick'));
  say('假設目前 R 裡每個人都跟 s 有 path', '');
  await step(tok); // 420 每一個Iteration找的那個
  paintE(G.ed(3, 5), JC.hot, 'thick'); glow(G.v[3], GOLD); glow(G.v[5], GOLD);
  say('這一輪找到的 edge：u = 3 在 R 裡', 'v = 5 在 R 外面');
  await step(tok); // 445 把這條pass在往後延伸
  paintE(G.ed(3, 5), JC.blue, 'thick');
  const pe = bub('s → 3 的 path ＋ 一條 edge = s → 5 的 path', -2.6, 7.4);
  say('s 到 u 的 path，再多走一條 edge', '就是一條 s 到 v 的 path');
  await step(tok); // 471 所以我這樣把它加起來是非常安全的
  remove(pe); glow(G.v[3], null); glow(G.v[5], null); add(5);
  say('所以把 v 加進 R 是安全的', 'v 一定在 s 的 component 裡');
}]);

// 08:14 證明：R 正好是 s 的 component
FRAG.push(['graphjiang1-rproof', '證明：R 裡都連得到、R 外都連不到', async (tok) => {
  fresh(CAM, LOOK);
  const RX = -3.2, RY = 3.4;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.06, 8, 64), new THREE.MeshStandardMaterial({ color: JC.teal }));
  ring.position.set(RX, RY, 0); ring.scale.set(1, 1.15, 1);
  const s = cube('s', JC.blue, [0.6, 0.6, 0.6], RX - 1.4, RY, 0);
  const R = 4.4;
  await step(tok); // 508 接下來其實我們就要去證明它的正確性
  lab.world.add(ring); tag('R', 'ptr', RX, RY + 3.4);
  say('證明 procedure 正確：結束時 R 就是 component', '');
  await step(tok); // 533 分兩種case來去
  hdr('分兩個 case', R, 6.8);
  say('分兩個 case 討論', '');
  await step(tok); // 544 R裡面放的人
  [[RX, RY + 1.4], [RX + 1.0, RY - 0.8]].forEach(([x, y]) => { cube('', JC.teal, [0.45, 0.45, 0.45], x, y, 0); rod(s.position.clone(), V3(x, y, 0), JC.blue); });
  note('① R 裡的人都跟 s 有 path', R, 6.0);
  say('Case 1：R 裡的人真的都跟 s 有 path', '剛剛已經說明了');
  await step(tok); // 558 它可能有漏網之餘
  note('② R 外沒有漏網之魚', R, 5.2);
  say('Case 2：不能有漏網之魚', '跟 s 有 path，卻沒被放進 R');
  await step(tok); // 608 課本使用的證法很簡單
  say('Case 2 用反證法', '');
  await step(tok); // 637 外面有一個W
  const w = cube('w', JC.pink, [0.6, 0.6, 0.6], 4.0, 1.4, 0, 1);
  say('外面有一個 w，沒有在 R 裡', '');
  await step(tok); // 651 W跟S有pass相連
  bad('假設：w 跟 s 有 path', R, 4.4);
  say('假設 w 跟 s 有 path', '想辦法推出矛盾');
  await step(tok); // 691 理論上應該會一開始會沿著
  const P = [[RX - 1.4, RY], [RX - 0.4, RY - 1.2], [RX + 1.4, RY - 1.6], [RX + 3.4, RY - 1.8], [4.0, 1.4]];
  const dots = [s];
  for (let i = 1; i < P.length - 1; i++) dots.push(cube('', i < 3 ? JC.teal : JC.idle, [0.42, 0.42, 0.42], P[i][0], P[i][1], 0));
  dots.push(w);
  const segs = [];
  for (let i = 1; i < P.length; i++) { segs.push(rod(V3(...P[i - 1], 0), V3(...P[i], 0), JC.edge, { gap: 0.3 })); await anim(tok, 200, () => {}); }
  say('這條 path 從 s 出發，先走在 R 裡', '走著走著，某一刻跑出 R');
  await step(tok); // 727 假設這個跑出去的點叫b好了
  glow(dots[3], GOLD); tag('b', 'ptr', P[3][0], P[3][1] + 0.6);
  say('第一個跑出 R 的點，叫它 b', '');
  await step(tok); // 739 B的前面這一個人他是在R這個
  glow(dots[2], GOLD); tag('a', 'ptr', P[2][0], P[2][1] + 0.6);
  paintE(segs[2], JC.hot, 'thick');
  say('b 前面的 a 在 R 裡，a–b 之間有 edge', 'b 卻不在 R 裡');
  await step(tok); // 776 這件事情可能發生嗎
  const q = bub('可能嗎？', P[2][0] + 1.0, P[2][1] + 1.4);
  say('依照 procedure，這可能發生嗎？', '');
  await step(tok); // 802 會把會把這條H挑出來
  remove(q);
  say('不可能：某一輪一定會挑出 (a, b)', 'a 在 R、b 不在 R → 把 b 放進 R');
  await step(tok); // 815 就contradiction了
  tint(dots[3], JC.teal);
  bad('b 會在 R 裡 → 矛盾！', 0.4, 7.3);
  say('b 應該在 R 裡，矛盾', '');
  await step(tok); // 838 不在R裡面的那些人絕對
  good('R 裡都有 path；R 外都沒有 → 證完', R, 3.4);
  say('R 裡都跟 s 相連，R 外都不相連', '證完');
}]);

// 14:11 怎麼實作：BFS、DFS 都能找 component
FRAG.push(['graphjiang1-rimpl', '實作：用 BFS 或 DFS 找 component', async (tok) => {
  fresh(CAM, LOOK);
  const G = gGraph(Object.keys(P13).map(Number), E13, P13);
  const R = 4.6, c1 = V3(P13[1][0], P13[1][1], -0.1);
  await step(tok); // 865 但是接下來如果你要做implementation的話
  K8.forEach((k) => G.col(k, JC.teal));
  hdr('實作的問題', R, 6.8);
  say('Procedure 是概念上的；實作時要想', '每次怎麼 explore 出新的 edge？');
  await step(tok); // 877 s呢到達r裡面的其他人
  G.col(1, JC.blue); G.col(6, JC.pink);
  tag('s', 'ptr', P13[1][0], P13[1][1] + 0.8); tag('t', 'ptr', P13[6][0], P13[6][1] + 0.8);
  say('另一個問題：s 到 R 裡的某個 t', '');
  await step(tok); // 893 他對應這個path
  [[1, 2], [2, 5], [5, 6]].forEach(([a, b]) => paintE(G.ed(a, b), JC.blue, 'thick'));
  note('s 到 t 的 path 怎麼找？', R, 6.0);
  say('對應的 path 要怎麼找出來？', '');
  await step(tok); // 906 brefer search來去做這件事情
  G.allE(JC.edge); K8.forEach((k) => G.col(k, JC.idle)); G.col(1, LAYC[0]);
  for (const [r, ks, i] of [[2.6, [2, 3], 1], [4.0, [4, 5, 7, 8], 2], [5.0, [6], 3]]) { await ripple(tok, c1, r, LAYC[i], 500); ks.forEach((k) => G.col(k, LAYC[i])); }
  say('方法一：用 BFS 來做', '');
  await step(tok); // 941 想要找到屬於它的
  pkt('找 component 方法一：BFS', R, 5.2);
  say('給一個點找它的 component：BFS', '');
  await step(tok); // 953 可以找到所有它可以reach
  good('BFS：找出起點 reach 得到的所有點', R, 4.4);
  say('BFS 最大的功能：找出所有 reach 得到的點', '那些點就是 connected component');
  await step(tok); // 977 接下來我們就會介紹defer search
  pkt('方法二：DFS', R, 3.6);
  say('還有別的方法：DFS', '也能找出跟起點有 path 的人');
}]);

// 16:32 DFS 的想法：一路走到底，死路再回頭
FRAG.push(['graphjiang1-dfsidea', 'DFS：有路就走，死路就回頭', async (tok) => {
  fresh(CAM, LOOK);
  const R = 3.8;
  const cell = {};
  await step(tok); // 992 第二個方法就是brefer
  hdr('Depth-First Search（DFS）', R, 6.9);
  say('第二個方法：Depth-First Search', '');
  await step(tok); // 1003 Data Structure的時候就已經認識他了
  note('資料結構課就學過 → 這裡多看它的 property', R, 6.1);
  say('資料結構課應該學過', '這裡會多探討它的 property');
  await step(tok); // 1026 顧名思義他是深度優先
  MZ.cols.forEach((x, c) => MZ.rows.forEach((y, r) => { cell[c + ',' + r] = cube('', JC.paper, [1.0, 1.0, 0.12], x, y, -0.2); }));
  const P = (c, r) => V3(MZ.cols[c], MZ.rows[r], 0.05);
  MZE.forEach(([a, b]) => rod(P(...a), P(...b), JC.edge, { gap: 0.25 }));
  say('DFS：深度優先', '給一個起點開始 explore');
  await step(tok); // 1040 只要有路可以走有edge
  const m = pal('老鼠', MZ.cols[0], MZ.rows[0] - 0.3, JC.gray, 0.4, 0.4);
  for (const [c, r] of [[0, 0], [1, 0], [1, 1], [0, 1], [0, 2]]) { tint(cell[c + ',' + r], JC.pink); await goTo(tok, m, MZ.cols[c], MZ.rows[r] - 0.3, 350); }
  say('有 edge 可以走就走出去', '一路往深處');
  await step(tok); // 1040 直到走到dead end
  m.mood('sad'); const de = bub('dead end！', MZ.cols[0], MZ.rows[2] + 0.9, 0.5);
  say('走到 dead end（死路）', '');
  await step(tok); // 1051 所以它就有路可以走就一路走到底
  remove(de); m.mood('calm');
  for (const [c, r] of [[0, 1], [1, 1]]) await goTo(tok, m, MZ.cols[c], MZ.rows[r] - 0.3, 350);
  say('死路就回頭（retreat）', '看看有沒有別的路');
  await step(tok); // 1064 就跟老鼠走迷宮那隻老鼠是很像的
  say('像沒有地圖的老鼠走迷宮', '');
  await step(tok); // 1078 先一路走到底
  for (const [c, r] of [[2, 1], [2, 0], [3, 0]]) { tint(cell[c + ',' + r], JC.pink); await goTo(tok, m, MZ.cols[c], MZ.rows[r] - 0.3, 350); }
  await goTo(tok, m, MZ.cols[2], MZ.rows[0] - 0.3, 300); await goTo(tok, m, MZ.cols[2], MZ.rows[1] - 0.3, 300);
  for (const [c, r] of [[2, 2], [3, 2]]) { tint(cell[c + ',' + r], JC.pink); await goTo(tok, m, MZ.cols[c], MZ.rows[r] - 0.3, 350); }
  say('一路走到底，撞牆就回到前一個岔路', '再試別條路');
  await step(tok); // 1091 跑到一個dungeon
  m.mood('happy');
  say('就像玩遊戲時探索 dungeon 的地圖', '');
  await step(tok); // 1140 這邊有一個很簡單的這個Procedure
  const C = code(['DFS(u):', '  mark u explored', '  add u to R', '  for each edge (u, v):', '    if v not explored:', '      DFS(v)'], R, 5.2, 0.55);
  say('用 DFS 找 component 的 procedure', '途中經過的人都放進 R');
  await step(tok); // 1153 我就先把這個人先mark變成說explorer
  C.hl(1);
  say('從 u 出發：先把 u 標成 explored', '表示走過了');
  await step(tok); // 1166 我就把這個點先放到R這個set裡面
  C.hl(2);
  say('把 u 放進 R', '');
  await step(tok); // 1176 從U這個點呢往外看看它是不是有A局可以連出去
  C.hl(3);
  say('看 u 有沒有 edge 可以連出去', 'for each edge 都試試看');
  await step(tok); // 1189 對方呢是目前還沒有被看過的
  C.hl(4);
  say('對方 v 還沒被看過，就走上去', '');
  await step(tok); // 1203 recursivecore DFS
  C.hl(5);
  say('走上去 = recursive call DFS(v)', '從 v 再往下 explore');
  await step(tok); // 1218 如果呢所有的點都再也走不下去
  C.hl(-1);
  say('鄰居都 explore 完，這個 call 就結束', 'return');
  await step(tok); // 1231 back到上面一層
  C.hl(3);
  say('return 回到上一層', '也就是前一個分岔點，繼續試下一條 edge');
}]);

// 20:43 DFS 從 1 開始，一句一個點
FRAG.push(['graphjiang1-dfsrun', 'DFS 實際走一次：1 2 3 5 4 6 7 8', async (tok) => {
  fresh(CAM, LOOK);
  const G = gGraph(K8, E13, P13);
  const S = column(5.6, 0.6, 'call stack');
  const RX = 3.0, ord = [];
  const res = pkt('順序：', RX, 7.2);
  const w = pal('', ...onV(G, 1), JC.orange, 0.42, 0.6);
  let nb = null;
  const visit = async (k, from) => {
    if (from) { paintE(G.ed(from, k), JC.red, 'thick'); await walkPath(tok, w, G, [k], 550); }
    G.col(k, JC.red); S.push('DFS(' + k + ')', JC.pink); ord.push(k); txt(res, '順序：' + ord.join(' '));
  };
  const skip = async (a, b) => { const e = G.ed(a, b), isTree = DTE.some(([x, y]) => ek(x, y) === ek(a, b)); paintE(e, JC.hot, 'thick'); await anim(tok, 350, () => {}); paintE(e, isTree ? JC.red : JC.edge, isTree ? 'thick' : 'dash'); }; // a tree edge seen again from the child stays a tree edge
  const done = async (k, back) => { G.col(k, '#7a4040'); S.pop(); if (back) await walkPath(tok, w, G, [back], 550); };
  const neigh = (k) => { if (nb) remove(nb); nb = bub(k + ' 的鄰居：' + A13[k].join('、'), RX, 6.3); };
  await step(tok); // 1250 我就從1這個點開始出發
  await visit(1);
  say('從 1 開始 DFS', '1 標成紅色（explored）');
  await step(tok); // 1260 我都先從這個index
  note('鄰居很多時：編號小的先走', RX, 5.5);
  say('鄰居很多時，先走編號小的', '');
  await step(tok); // 1274 所以我就先挑一條叫1
  neigh(1); paintE(G.ed(1, 2), JC.hot, 'thick');
  say('1 先試 1–2 這條 edge', '');
  await step(tok); // 1286 而這個2呢是還沒有explore
  glow(G.v[2], GOLD);
  say('2 還沒 explore', '');
  await step(tok); // 1288 所以接下來我當然就往下走走到2
  glow(G.v[2], null); await visit(2, 1);
  say('走到 2：call DFS(2)', '');
  await step(tok); // 1294 接下來2馬上就會mark成explore
  say('2 馬上標成 explored', '');
  await step(tok); // 1302 2的話現在有鄰居1、3、4、5
  neigh(2);
  say('2 的鄰居：1、3、4、5', '從編號小的試');
  await step(tok); // 1318 會繼續走所以2的index最小的鄰居
  await skip(2, 1);
  say('最小的是 1：已經 explored，跳過', '');
  await step(tok); // 1325 之後接下來其實我會嘗試走3
  await visit(3, 2);
  say('接下來試 3：走過去', '');
  await step(tok); // 1334 到了3就DFS3了
  say('DFS(3)：3 變紅色', '');
  await step(tok); // 1342 3再往下看他有多少鄰居
  neigh(3);
  say('3 的鄰居：1、2、5、7、8', '');
  await step(tok); // 1348 然後一樣的1走過了
  await skip(3, 1); await skip(3, 2);
  say('1、2 都走過了，跳過', '');
  await step(tok); // 1352 就去試5對不對
  await visit(5, 3);
  say('試 5：走過去', '');
  await step(tok); // 1360 那這個5走過去了之後接下來5有鄰居
  neigh(5);
  say('5 的鄰居：2、3、4、6', '');
  await step(tok); // 1365 然後一樣就是2走過了
  await skip(5, 2); await skip(5, 3);
  say('2、3 都走過了，跳過', '');
  await step(tok); // 1370 那接下去就走4
  await visit(4, 5);
  say('走 4', '');
  await step(tok); // 1373 然後到了4了之後接下來4有多少
  neigh(4);
  await skip(4, 2);
  say('4 的鄰居 2、5：都走過了', '');
  await step(tok); // 1393 4這個人就做完了
  await done(4);
  say('4 做完了：return', '');
  await step(tok); // 1400 前面一個分岔點是誰
  await walkPath(tok, w, G, [5], 550);
  say('回到前一個分岔點：5', '');
  await step(tok); // 1421 接下來剩下6可以走
  neigh(5);
  await visit(6, 5);
  say('5 試過 2、3、4，剩下 6：走 6', '');
  await step(tok); // 1429 接下來大家發現6只有一個鄰居是5
  neigh(6);
  say('6 只有一個鄰居 5，已經 explored', '');
  await step(tok); // 1435 他就會return回去
  await done(6, 5);
  say('6 結束，return 回 5', '');
  await step(tok); // 1440 那5這時候當然所有鄰居也都試完
  await done(5, 3);
  say('5 的鄰居都試完了，return 到 3', '');
  await step(tok); // 1446 return到3身上
  neigh(3);
  say('回到 3：1、2、5 都處理過了', '');
  await step(tok); // 1454 接下來剩7和8對不對然後走比較小
  await visit(7, 3);
  say('剩 7 和 8，走比較小的 7', '');
  await step(tok); // 1462 7試試看他的鄰居3跟8
  neigh(7);
  await skip(7, 3);
  say('7 的鄰居 3、8：3 走過了，跳過', '');
  await step(tok); // 1467 走走8對不對走8
  await visit(8, 7);
  say('走 8', '');
  await step(tok); // 1471 8的鄰居是3和7
  neigh(8);
  await skip(8, 3);
  say('8 的鄰居 3、7：都走過了', '');
  await step(tok); // 1479 然後這時候8就結束
  await done(8, 7);
  say('8 結束，return 回 7', '');
  await step(tok); // 1488 以7來講這一刻所有的
  await done(7, 3);
  say('7 的鄰居都 explored 了：return 到 3', '');
  await step(tok); // 1497 return回去到達3
  remove(nb); nb = null;
  await done(3, 2);
  say('3 的 for each 也結束了：return', '');
  await step(tok); // 1508 然後就到2再到1就結束了
  await done(2, 1); await done(1);
  say('再回到 2、再回到 1，整個結束', 'DFS 順序：1 2 3 5 4 6 7 8');
}]);

// 25:23 每條 edge 被 check 兩次
FRAG.push(['graphjiang1-dfscheck', '每條 edge 會被 check 兩次', async (tok) => {
  fresh(CAM, LOOK);
  const G = gGraph(K8, E13, P13);
  K8.forEach((k) => G.col(k, JC.red));
  DTE.forEach(([a, b]) => paintE(G.ed(a, b), JC.red, 'thick'));
  DNT.forEach(([a, b]) => paintE(G.ed(a, b), JC.edge, 'dash'));
  const R = 3.8, cnt = {};
  const mark = (a, b, t) => { const k = ek(a, b); const p = G.p[a].clone().add(G.p[b]).multiplyScalar(0.5); if (cnt[k]) remove(cnt[k]); cnt[k] = tag(t, 'pkt', p.x, p.y + 0.3, 0.4); };
  await step(tok); // 1523 其實在這個Explore的過程因為它
  hdr('recursive call 的幾個重點', R, 6.8);
  say('DFS 是 recursive call：看幾個重點', '');
  await step(tok); // 1533 每個age會被check幾次
  const qq = bub('每條 edge 會被 check 幾次？', R, 6.0);
  say('問題：整個 procedure 做完', '每條 edge 被 check 幾次？');
  await step(tok); // 1547 它會被踩過兩次
  remove(qq);
  pkt('答案：兩次', R, 6.0);
  say('答案：每條 edge 被踩過兩次', '');
  await step(tok); // 1573 第一次我嘗試要走到2
  glow(G.v[1], GOLD);
  mark(1, 2, '1 次');
  say('1–2：第一次是 1 想走到 2 的時候', '');
  await step(tok); // 1585 2這個人不是要去check他的鄰居嗎
  glow(G.v[1], null); glow(G.v[2], GOLD);
  mark(1, 2, '2 次');
  say('第二次：2 檢查鄰居時回頭看 1', '發現 1 已 explored，skip');
  await step(tok); // 1611 如果像這種虛線的話呢
  glow(G.v[2], null);
  paintE(G.ed(1, 3), JC.purple, 'thick');
  say('虛線的 non-tree edge 也一樣 check 兩次', '');
  await step(tok); // 1622 3回到1要看一次
  glow(G.v[3], GOLD); mark(1, 3, '1 次');
  say('3 檢查鄰居時看到 1：已經紅色，skip', '');
  await step(tok); // 1633 1會還會去check一下3
  glow(G.v[3], null); glow(G.v[1], GOLD); mark(1, 3, '2 次');
  say('最後回到 1 時，1 也會 check 一下 3', '也是紅色，skip');
  await step(tok); // 1633 會被check兩次會被check兩次
  glow(G.v[1], null);
  E13.filter(([a, b]) => a <= 8 && b <= 8).forEach(([a, b]) => mark(a, b, '2 次'));
  good('每條 edge：check 兩次（兩端各一次）', R, 5.2);
  say('每條 edge 都被 check 兩次', '兩個端點各看一次');
  await step(tok); // 1646 隨便挑一個簡單的graph
  note('自己在紙上畫一個 graph 跑跑看', R, 4.4);
  say('自己在紙上畫個 graph，跑一次 DFS', '了解運作過程，才懂它的性質');
}]);

// 28:04 DFS tree：non-tree edge 連祖先與子孫
FRAG.push(['graphjiang1-dfstree', 'DFS tree：non-tree edge 連祖先與子孫', async (tok) => {
  fresh(CAM, LOOK);
  const G = gGraph(K8, E13, P13);
  K8.forEach((k) => G.col(k, JC.red));
  let T = null;
  await step(tok); // 1684 很類似的一件事情就是當我DFS做完
  hdr('DFS tree', 3.6, 7.5);
  say('DFS 做完，也會產生一棵 tree：DFS tree', 'BFS 做完的叫 BFS tree');
  await step(tok); // 1695 什麼叫做tree age
  say('DFS tree 裡，什麼是 tree edge？', '');
  await step(tok); // 1707 我在check這個age的時候發現對方不是explore
  DTE.forEach(([a, b]) => paintE(G.ed(a, b), JC.red, 'thick'));
  say('check 時對方還沒 explore → 真的走過去', '這條 edge 是 tree edge（紅色）');
  await step(tok); // 1720 如果我在check它的時候是虛線
  DNT.forEach(([a, b]) => paintE(G.ed(a, b), JC.edge, 'dash'));
  say('check 時對方已經著色 → skip', '這條是 non-tree edge（虛線）');
  await step(tok); // 1757 我們拉一下
  T = gTree(DT, DTE, []);
  K8.forEach((k) => tint(T.v[k], JC.red));
  say('拉開來：以 1 為 root 的 DFS tree', '');
  await step(tok); // 1782 這個Tree age一定是連線
  DTE.forEach(([a, b]) => paintE(T.ed(a, b), JC.red, 'thick'));
  note('tree edge：parent ↔ child', 0.4, 0.2);
  say('Tree edge：連 parent 和 child', '');
  await step(tok); // 1794 NongTree age連線誰呢
  DTE.forEach(([a, b]) => paintE(T.ed(a, b), JC.red));
  DNT.forEach(([a, b]) => { const p = V3(...DT[a], 0), q = V3(...DT[b], 0); rod(p, q, JC.purple, { gap: 0.35, r: 0.035 }); });
  say('Non-tree edge：連祖先和子孫', '會跨層，不是直接 parent–child');
  await step(tok); // 1820 有一個人一定會是另外一個人的ancestor
  glow(T.v[3], GOLD); glow(T.v[8], GOLD);
  pkt('x、y：一個是另一個的 ancestor', 3.6, 0.9, 0.5);
  say('Non-tree edge (x, y)：其中一個是另一個的 ancestor', '例如 3 是 8 的祖先');
  await step(tok); // 1833 相對另外一個人就會是他的descendant
  tag('descendant', 'ptr', DT[8][0] + 1.1, DT[8][1]); tag('ancestor', 'ptr', DT[3][0] + 1.1, DT[3][1]);
  say('另一個就是它的 descendant（子孫）', '輩分大連到輩分小');
}]);

// 30:59 證明：DFS 的 non-tree edge 連祖先與子孫
FRAG.push(['graphjiang1-dfsproof', '證明：y 在 x 的 call 裡被看到', async (tok) => {
  fresh(CAM, LOOK);
  const T = gTree(DT, DTE, DNT);
  K8.forEach((k) => tint(T.v[k], JC.idle));
  const R = -2.6;
  // time line of the calls: x = 3 enters at time 3 … returns after 7, 8
  const X = (t) => -6.4 + t * 0.62;
  await step(tok); // 1859 去證明其實這個在DFS tree
  hdr('證明：non-tree edge 連祖先與子孫', R, 7.4);
  say('證明：non-tree edge 一定連祖先與子孫', '');
  await step(tok); // 1883 第一件事情我們先suppose x
  glow(T.v[3], GOLD); glow(T.v[8], GOLD);
  rod(V3(...DT[3], 0), V3(...DT[8], 0), JC.purple, { gap: 0.3, r: 0.04 });
  tag('x', 'ptr', DT[3][0] - 0.6, DT[3][1] + 0.3); tag('y', 'ptr', DT[8][0] + 0.6, DT[8][1] + 0.3);
  say('non-tree edge (x, y)：假設 x 比較早被 explore', '另一個方向對稱');
  await step(tok); // 1908 要說其實就是X是祖先
  note('目標：x 是祖先，y 是 descendant', R, 6.6);
  say('目標：證明 x 是祖先、y 是子孫', '');
  await step(tok); // 1932 是比較早explore的那個人DFS
  line(X(0), 0.8, X(9), 0.8, 0, '#a99470'); tag('時間 →', 'idx', X(9) + 0.3, 0.4);
  const xin = tag('x explored', 'pkt', X(3), 1.4);
  say('線索一：x 比 y 早被 explore', '');
  await step(tok); // 1946 就是當我check這條age的時候
  note('線索二：(x, y) 是 non-tree edge', R, 5.8);
  say('線索二：(x, y) 是 non-tree edge', 'x check 它時，y 已經 explored');
  await step(tok); // 1971 xreach到那一刻y並沒有被看到
  tint(T.v[3], JC.red);
  bub('x 剛到時：y 還是白色', R, 4.9);
  say('x 被 reach 的那一刻，y 還沒被看到', 'y 還是白色');
  await step(tok); // 2051 它去偷看XY這條age的時候發現Y是已經explore了
  tag('check (x, y)：y 已 explored', 'bad', X(8.2), 2.6);
  say('x 偷看 (x, y) 時，y 已經 explored', '所以 skip，變成 non-tree edge');
  await step(tok); // 2095 可以推得那Y到底是什麼時候被看到的
  say('y 到底是什麼時候被看到的？', '一定在 x 之後');
  await step(tok); // 2108 call結束之前被看到
  const bar = cube('DFS(x) 這個 call', JC.pink, [X(9) - X(3), 0.4, 0.3], (X(3) + X(9)) / 2, 2.0, 0, 1);
  say('而且在 x 這個 call 結束（return）之前', '');
  await step(tok); // 2217 Y到底是什麼時候被explored的呢
  tint(T.v[5], JC.red); tint(T.v[4], JC.red); tint(T.v[6], JC.red); tint(T.v[7], JC.red); tint(T.v[8], JC.red);
  tag('y explored', 'pkt', X(7), 1.4);
  say('y 在進入 DFS(x) 之後、x return 之前被 explore', '');
  await step(tok); // 2231 會是在X往下的那顆tree裡面
  [5, 4, 6, 7, 8].forEach((k) => glow(T.v[k], '#3a1020'));
  say('那段時間 explore 的點，都在 x 底下的子樹裡', '');
  await step(tok); // 2244 所以它y就會是x的descendant
  glow(T.v[8], GOLD);
  good('y 是 x 的 descendant', R, 4.0);
  say('所以 y 是 x 的 descendant', '');
  await step(tok); // 2256 就證完了
  say('證完：x、y 是祖先與子孫', '');
}]);

// 37:36 BFS 和 DFS 比一比
FRAG.push(['graphjiang1-bfsdfs', 'BFS 矮胖、DFS 瘦長', async (tok) => {
  fresh(CAM, LOOK);
  const bt = {}; for (const k in BT) bt[k] = [BT[k][0] - 8.2, BT[k][1]];
  const dt = {}; for (const k in DT) dt[k] = [DT[k][0] + 1.0, DT[k][1]];
  let B = null, D = null;
  await step(tok); // 2256 這邊我們很快summary一下BFS跟DFS
  hdr('BFS', -3.6, 7.4); hdr('DFS', 4.6, 7.4);
  say('Summary：兩種 explore graph 的技術', 'BFS 和 DFS');
  await step(tok); // 2285 都可以用來去找到
  note('都能找 connected component', 0.6, 0.0);
  say('相同：都能找 connected component', '從一點出發，找到 reach 得到的人');
  await step(tok); // 2315 這個preferencesearch它顧名思義
  B = gTree(bt, BTE, []); K8.forEach((k) => tint(B.v[k], LAYC[LAY[k]]));
  say('BFS：先找鄰居，再找鄰居的鄰居', '一層一層往外擴');
  await step(tok); // 2327 所以大家會發現BFStree的長相會比較寬
  pkt('矮矮胖胖：寬、淺', -3.6, 0.9);
  say('BFS tree 比較寬、比較淺', '矮矮胖胖');
  await step(tok); // 2341 DFS通常都是瘦瘦長長的
  D = gTree(dt, DTE, []); K8.forEach((k) => tint(D.v[k], JC.red));
  pkt('瘦瘦長長：細、深', 4.6, 0.9);
  say('DFS tree 通常瘦瘦長長', '');
  await step(tok); // 2349 因為它的特性就是只要有路可以走
  say('因為 DFS 有路就一直走', '沒路才回頭，所以 tree 細長');
  await step(tok); // 2375 那在DFS的non-tree age
  DNT.forEach(([a, b]) => rod(V3(...dt[a], 0), V3(...dt[b], 0), JC.purple, { gap: 0.3, r: 0.035 }));
  say('DFS 的 non-tree edge：連祖先和子孫', '');
  await step(tok); // 2389 在BFS當中它的non-tree
  const q = bub('BFS 的 non-tree edge 連誰？', -3.6, 6.6);
  say('那 BFS 的 non-tree edge 連誰？', '兩端的 layer 差多少？');
  await step(tok); // 2420 不一定差1
  remove(q);
  bub('最多差 1，也可以差 0', -3.6, 6.6);
  say('最多差 1，也可以差 0', '');
  await step(tok); // 2429 第一個的話就是兄弟姐妹
  rod(V3(...bt[2], 0), V3(...bt[3], 0), JC.purple, { gap: 0.3, r: 0.035 }); rod(V3(...bt[7], 0), V3(...bt[8], 0), JC.purple, { gap: 0.3, r: 0.035 }); rod(V3(...bt[4], 0), V3(...bt[5], 0), JC.purple, { gap: 0.3, r: 0.035 });
  say('第一種：同一層，像兄弟姐妹', '');
  await step(tok); // 2435 Uncle對不對
  rod(V3(...bt[3], 0), V3(...bt[5], 0), JC.orange, { gap: 0.3, r: 0.035 });
  say('第二種：連到 uncle（3–5）', '不會連到自己的父母');
}]);

// 40:55 找出所有 component
FRAG.push(['graphjiang1-allcc', '找出所有的 connected component', async (tok) => {
  fresh(CAM, LOOK);
  const G = gGraph(Object.keys(P13).map(Number), E13, P13);
  const R = 4.6;
  const run = async (s, ks, col, ms = 160) => { const w = pal('', ...onV(G, s), JC.orange, 0.4, 0.6); for (const k of ks) { await walkPath(tok, w, G, [k], ms); G.col(k, col); } kill(w.g); };
  await step(tok); // 2465 所存在的所有的
  hdr('找出所有的 component', R, 6.8);
  say('更大的問題：整張圖所有的 component', '');
  await step(tok); // 2485 你就Randomly先Pick一個點
  await run(1, [1, 2, 3, 4, 5, 7, 8, 6], JC.teal);
  pkt('BFS(1) → component ①', R, 6.0);
  say('隨便挑一點（1）做一次 BFS', '找到第一坨');
  await step(tok); // 2496 還有一些人你還沒有走
  K8.forEach((k) => G.col(k, JC.dim)); for (const k in G.e) if (G.e[k] && Number(k.split('-')[0]) <= 8) paintE(G.e[k], JC.edge, 'dash');
  say('把它挖掉；還有人沒走到', '再隨便選一個沒走過的點');
  await step(tok); // 2508 基本上你就會把90這個找到了
  await run(9, [9, 10], JC.purple, 400);
  pkt('BFS(9) → component ②', R, 5.2);
  say('選 9 再做一次：找到 9、10', '');
  await step(tok); // 2519 再繼續走BFS
  await run(11, [11, 12, 13], JC.orange, 400);
  pkt('BFS(11) → component ③', R, 4.4);
  say('再選一個繼續 BFS：第三個 component', '反覆做，就找出所有 component');
  await step(tok); // 2532 一樣的方法你也可以用DFS來去找它
  good('換成 DFS 也可以', R, 3.6);
  say('一樣的方法，用 DFS 也行', '');
}]);

// 42:23 n、m、dense / sparse、O(m + n)
FRAG.push(['graphjiang1-size', 'n 個點、m 條邊：O(m + n) 叫 linear', async (tok) => {
  fresh(CAM, LOOK);
  const R = 3.8;
  const ring = [0, 1, 2, 3, 4].map((i) => { const a = Math.PI / 2 + i * 2 * Math.PI / 5; return [-3.6 + Math.cos(a) * 2.2, 3.6 + Math.sin(a) * 2.2]; });
  const pos = {}; ring.forEach((p, i) => { pos[i + 1] = p; });
  let es = [];
  const setE = (list, col) => { es.forEach((e) => kill(e)); es = list.map(([a, b]) => rod(V3(...pos[a], 0), V3(...pos[b], 0), col || JC.edge)); };
  await step(tok); // 2543 BFS跟DFS要怎麼做Implementation
  hdr('怎麼表示一張 graph？', R, 6.9);
  say('接下來：BFS、DFS 的實作', '先看 graph 怎麼表示');
  await step(tok); // 2573 假設一張圖這個G是裡面的點集合是V
  const G = gGraph([1, 2, 3, 4, 5], [], pos);
  pkt('G = (V, E)', R, 6.1);
  say('G 的點集合 V、edge 集合 E', '');
  await step(tok); // 2590 常用一個符號是管線
  note('|V|：集合裡有幾個元素（cardinality）', R, 5.4);
  say('|集合|：數集合裡有幾個元素', '叫 cardinality');
  await step(tok); // 2616 這個點的數目我們就用n去代表它
  pkt('n = |V|　m = |E|', R, 4.6);
  say('點的數目叫 n，edge 的數目叫 m', '');
  await step(tok); // 2648 什麼叫做一個圖呢是叫很dance很密集的
  say('Dense（很密）和 sparse（很鬆）', '說的是 edge 多還是少');
  await step(tok); // 2673 最小的Connected Graph
  say('Connected graph 最少要幾條 edge？', '');
  await step(tok); // 2683 它應該會是什麼是一顆Tree
  setE([[1, 2], [1, 3], [1, 4], [1, 5]], JC.green);
  note('最少：tree，n − 1 條', R, 3.8);
  say('最少就是一棵 tree：n − 1 條 edge', '');
  await step(tok); // 2709 那Upper Bound呢
  say('最多有幾條？', '');
  await step(tok); // 2726 CN取二這麼多
  const all = []; for (let a = 1; a <= 5; a++) for (let b = a + 1; b <= 5; b++) all.push([a, b]);
  setE(all, JC.orange);
  note('最多：任兩點都相連，C(n, 2) < n²', R, 3.0);
  say('最多：任兩點都有 edge，C(n, 2) 條', '一定小於 n²');
  await step(tok); // 2742 至少會是ONBIG
  pkt('n − 1 ≤ m ≤ C(n, 2)：O(n) ～ O(n²)', R, 2.2);
  say('m 介於 O(n) 和 O(n²) 之間', '');
  await step(tok); // 2794 我當然希望表達它represent它的時間
  say('希望表示、走訪 graph 的時間', '跟 graph 的大小成正比');
  await step(tok); // 2821 放得在big of m加n
  good('O(m + n)：linear time', R, 1.4);
  say('O(m + n)：叫 linear', '');
  await step(tok); // 2857 其實你就不用太在意說
  setE([[1, 2], [2, 3], [3, 4], [4, 5]], JC.edge);
  say('圖簡單就快、圖複雜就慢', 'dense、sparse 都適用');
}]);

// 47:50 Adjacency matrix
FRAG.push(['graphjiang1-matrix', 'Adjacency matrix：n × n 的 0/1 表', async (tok) => {
  fresh(CAM, LOOK);
  const G = gGraph(K8, E13, P13);
  const has = (a, b) => A13[a] && A13[a].includes(b);
  const MX = (c) => 1.9 + c * 0.6, MY = (r) => 6.0 - r * 0.6;
  const cell = {};
  await step(tok); // 2870 兩種非常常用的這個表達
  hdr('adjacency matrix', 1.0, 7.5); hdr('adjacency list', 5.0, 7.5);
  say('兩種最常用的表示法', 'adjacency matrix、adjacency list');
  await step(tok); // 2883 請大家忘記它們好不好
  const oth = note('其他表示法：看過就好', 4.0, 0.4);
  say('其他表示法看過就好，只記這兩種', '');
  await step(tok); // 2912 那第一種我們就先介紹adjacencymatrix
  remove(oth); K8.forEach((k) => glow(G.v[k], '#2a2a10'));
  say('先看 adjacency matrix', '點編號 1 到 n');
  await step(tok); // 2937 Graph最重要的概念就是去探討Object之間的relationship
  K8.forEach((k) => glow(G.v[k], null));
  G.allE(JC.orange, 'thick');
  say('Graph 最重要的是 relationship', '也就是 edge');
  await step(tok); // 2961 前面灌的很多形容詞
  pkt('undirected、weighted… 都在形容 edge', -2.8, 7.4);
  say('Graph 的形容詞，大多在描述 edge', 'directed、cyclic、weighted…');
  await step(tok); // 3008 大家會知道這個adgencymatrix用來做什麼
  G.allE(JC.edge);
  say('Adjacency matrix：表示點和點之間的關係', '');
  await step(tok); // 3030 它會開出一個N
  for (let i = 0; i < 8; i++) { tag(String(i + 1), 'idx', MX(i), MY(-1) - 0.1); tag(String(i + 1), 'idx', MX(-1) + 0.1, MY(i)); }
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) cell[r + ',' + c] = cube('', JC.paper, [0.5, 0.5, 0.12], MX(c), MY(r), 0);
  say('n 個點 → 開一個 n × n 的矩陣', '每個 row、column 對應一個點');
  await step(tok); // 3051 隨便一個entry
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const m = cell[r + ',' + c]; m.userData.lbl = lab.label(has(r + 1, c + 1) ? '1' : '0', 'val'); m.add(m.userData.lbl); if (has(r + 1, c + 1)) tint(m, JC.green); }
  glow(cell['2,3'], GOLD);
  say('第 i row、第 j column：1 = 有 edge，0 = 沒有', '例如 (3, 4) 是 0');
  await step(tok); // 3094 這個matrix它自然就會是
  glow(cell['2,3'], null);
  for (let i = 0; i < 8; i++) glow(cell[i + ',' + i], '#3a2a10');
  say('Undirected：(u, v) 有就 (v, u) 有', '矩陣對角線兩邊對稱');
  await step(tok); // 3123 我們探討的是simple
  note('simple graph：沒有 self-loop、沒有 parallel edge', -2.8, -0.2);
  say('Simple graph：沒有 self-loop、parallel edge', '所以對角線都是 0');
  await step(tok); // 3185 想要檢查兩個點之間有沒有age的話
  for (let i = 0; i < 8; i++) glow(cell[i + ',' + i], null);
  glow(cell['1,3'], GOLD); paintE(G.ed(2, 4), JC.hot, 'thick');
  pkt('查一條 edge：O(1)', 2.6, 1.0);
  say('查兩點之間有沒有 edge：直接看那一格', 'O(1)');
  await step(tok); // 3213 比如說4這個點
  glow(cell['1,3'], null); paintE(G.ed(2, 4), JC.edge);
  for (let c = 0; c < 8; c++) { glow(cell['3,' + c], '#3a3000'); await anim(tok, 140, () => {}); }
  say('4 有幾個鄰居？掃第 4 個 row', '');
  await step(tok); // 3242 我一定要掃完這完整的一個column
  say('不管鄰居多少，都要掃完一整行', 'Θ(n)');
  await step(tok); // 3269 假設這個圖裡面age很少很疏鬆
  for (let c = 0; c < 8; c++) glow(cell['3,' + c], null);
  for (const k in cell) if (cell[k].userData.lbl.element.textContent === '0') tint(cell[k], JC.dim);
  say('Sparse graph：矩陣裡滿滿都是 0', '掃很多沒意義的 0');
  await step(tok); // 3333 不能省n square
  bad('空間：Θ(n²)', 5.4, 1.0);
  say('空間要 Θ(n²) 格', 'edge 很少時很浪費');
}]);

// 55:47 Adjacency list
FRAG.push(['graphjiang1-list', 'Adjacency list：每個點掛一串鄰居', async (tok) => {
  fresh(CAM, LOOK);
  const G = gGraph(K8, E13, P13);
  const AX = 1.6, AY = (i) => 6.4 - i * 0.78, NX = (j) => 2.6 + j * 0.72;
  const arr = {}, nbs = {};
  await step(tok); // 3359 顧名思義當然它也是用來表達
  hdr('adjacency list', 3.6, 7.4);
  say('第二種：adjacency list', '一樣用來表示鄰居關係');
  await step(tok); // 3374 它是linklist的形式
  say('用 linked list 來存', '');
  await step(tok); // 3387 這個array呢是存vertex用的
  K8.forEach((k, i) => { arr[k] = cube(k, JC.sand, [0.6, 0.6, 0.3], AX, AY(i), 0, 1); });
  say('先開一個 array：每個 vertex 一格', '');
  await step(tok); // 3400 會有一個list會有一個linked list
  nbs[1] = A13[1].map((v, j) => cube(v, JC.blue, [0.5, 0.5, 0.3], NX(j), AY(0), 0, 1));
  line(AX + 0.3, AY(0), NX(A13[1].length - 1), AY(0), -0.1, '#6e5f49');
  say('每格後面掛一條 linked list', '存這個點的鄰居們');
  await step(tok); // 3425 這邊是一個八個點的Vertex Array
  K8.slice(1).forEach((k, i) => { nbs[k] = A13[k].map((v, j) => cube(v, JC.blue, [0.5, 0.5, 0.3], NX(j), AY(i + 1), 0)); line(AX + 0.3, AY(i + 1), NX(A13[k].length - 1), AY(i + 1), -0.1, '#6e5f49'); });
  say('8 個點的 vertex array', '每個點後面掛它的鄰居');
  await step(tok); // 3452 我想要找一下2跟4這條A矩是否存在
  paintE(G.ed(2, 4), JC.hot, 'thick');
  say('想確認 edge (2, 4) 存不存在', '');
  await step(tok); // 3466 找4這一個人
  glow(arr[4], GOLD);
  for (const m of nbs[4]) { glow(m, '#3a3000'); await anim(tok, 250, () => {}); }
  say('方法一：在 4 的 list 裡找 2', '');
  await step(tok); // 3466 或者是我在2這一個人後面去check
  glow(arr[4], null); nbs[4].forEach((m) => glow(m, null));
  glow(arr[2], GOLD);
  for (const m of nbs[2]) { glow(m, '#3a3000'); await anim(tok, 250, () => {}); if (m.userData.lbl.element.textContent === '4') break; }
  say('方法二：在 2 的 list 裡找 4', '');
  await step(tok); // 3486 big of 討論的是worst case
  glow(arr[2], null); nbs[2].forEach((m) => glow(m, null));
  const wc = bad('查一條 edge：worst case O(n)', 3.6, -0.4);
  say('Worst case：list 最長 n − 1，要找到最後', '查一條 edge 要 O(n)');
  await step(tok); // 3533 比如說2和4的這條H
  say('Edge (2, 4) 在 list 裡存了幾次？', '');
  await step(tok); // 3557 我會去記錄2的鄰居是有4
  nbs[2].forEach((m) => { if (m.userData.lbl.element.textContent === '4') glow(m, GOLD); });
  nbs[4].forEach((m) => { if (m.userData.lbl.element.textContent === '2') glow(m, GOLD); });
  say('兩次：2 的鄰居有 4，4 的鄰居有 2', 'undirected 是雙向關係');
  await step(tok); // 3579 那如果是directed graph
  say('Directed graph：每條 edge 只出現一次', '');
  await step(tok); // 3608 就是他的鄰居們那他是掛在
  for (const k in nbs) nbs[k].forEach((m) => glow(m, null));
  glow(arr[3], GOLD); nbs[3].forEach((m) => glow(m, '#14382a'));
  pkt('adj(3) = {1, 2, 5, 7, 8}', -2.6, 7.4);
  say('u 後面掛的就是 adj(u)', '也就是 u 的 neighbors');
  await step(tok); // 3648 就用degree來去代表他
  pkt('degree(3) = |adj(3)| = 5', -2.6, -0.4);
  say('鄰居有幾個：degree', 'degree(u) = |adj(u)|');
  await step(tok); // 3674 它要開出一個vertex array
  glow(arr[3], null); nbs[3].forEach((m) => glow(m, null));
  K8.forEach((k) => glow(arr[k], '#3a2a10'));
  say('空間：vertex array 要 n 格', '');
  await step(tok); // 3688 每一條A矩都要花兩個格子
  K8.forEach((k) => glow(arr[k], null));
  for (const k in nbs) nbs[k].forEach((m) => glow(m, '#14382a'));
  say('每條 edge 佔兩格：共 2m 格', '');
  await step(tok); // 3702 big ofn加m
  remove(wc); good('空間：n + 2m = O(n + m)', 3.6, -0.4);
  say('總共 n + 2m：O(n + m)', '係數不重要');
  await step(tok); // 3719 就會變成只有n加上m
  for (const k in nbs) nbs[k].forEach((m) => glow(m, null));
  say('Directed graph：n + m', 'edge 是單向的，只存一次');
  await step(tok); // 3744 第一個叫做in degree
  for (const k in G.v) kill(G.v[k]); for (const k in G.e) kill(G.e[k]);
  const U = V3(-3.4, 3.8, 0); cube('u', JC.blue, [0.7, 0.7, 0.7], U.x, U.y, 0);
  [[-6.0, 5.4], [-6.0, 2.2]].forEach(([x, y]) => rod(V3(x, y, 0), U, JC.purple, { dir: true }));
  [[-0.8, 5.6], [-0.6, 3.8], [-0.8, 2.0]].forEach(([x, y]) => rod(U, V3(x, y, 0), JC.orange, { dir: true }));
  tag('in-degree = 2', 'pkt', -5.6, 6.3); tag('out-degree = 3', 'pkt', -1.0, 6.5);
  say('Directed：分 in-degree 和 out-degree', 'out：射出去的 edge 數；in：射進來的');
  await step(tok); // 3812 對於一個directedgraph的話呢那實際上
  note('最簡單：list 只記 outgoing', -2.6, 0.6, 1.5);
  say('最簡單的 adjacency list 只記 outgoing', '');
  await step(tok); // 3838 分成兩個list
  note('需要時：outgoing、incoming 各一條 list', -2.6, -0.1, 1.5);
  say('有些應用要兩條 list', '分別記 outgoing 和 incoming');
}]);

// 64:26 Queue：先進先出
FRAG.push(['graphjiang1-queue', 'Queue：兩端開口的水管，FIFO', async (tok) => {
  fresh(CAM, LOOK);
  const QX = (i) => -2.6 + i * 1.1, QY = 3.2;
  const items = [];
  let fr = null, re = null;
  const ptr = () => { if (fr) remove(fr); if (re) remove(re); if (!items.length) return; fr = tag('front', 'ptr', items[0].position.x, QY + 1.0); re = tag('rear', 'ptr alt', items[items.length - 1].position.x, QY - 0.9); };
  await step(tok); // 3866 概念上我要怎麼去表示一張圖
  pkt('matrix → array　list → linked list', 0, 6.6);
  say('兩種表示法，用 array 和 linked list 配合', '');
  await step(tok); // 3892 要介紹一下BFS跟DFS要怎麼做implementation
  say('實作 BFS、DFS 要選適當的 data structure', '');
  await step(tok); // 3920 對應會使用的Data Structure是Q跟Langlist
  hdr('queue', -3.0, 7.4); hdr('stack', 3.0, 7.4);
  say('會用到 queue 和 stack', '');
  await step(tok); // 3932 它就是一個兩端開口的
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 6.4, 24, 1, true), new THREE.MeshStandardMaterial({ color: JC.green, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
  pipe.rotation.z = Math.PI / 2; pipe.position.set(-0.4, QY, 0); lab.world.add(pipe);
  say('Queue：兩端開口的容器，像一根水管', '');
  await step(tok); // 3957 在queue裡面呢它是先進去的人要先出來
  say('先進去的人先出來', '');
  await step(tok); // 3986 所以這一端push
  tag('pop 出口 ←', 'pkt', -4.6, QY + 1.2); tag('← push 入口', 'pkt', 3.8, QY + 1.2);
  say('一端只負責 push 進去', '另一端只負責 pop 出來');
  await step(tok); // 3999 first in first out
  good('FIFO：first in, first out', 0, 1.0);
  say('FIFO：先進先出', '');
  await step(tok); // 4033 額外兩個Pointer一個叫做前面
  note('兩個 pointer：front（拿）、rear（放）', 0, 0.2);
  say('要兩個 pointer：front 和 rear', '從 rear 放進去，從 front 拿出來');
  await step(tok); // 4058 是一開始的時候我maintain兩個point
  say('一開始 queue 是空的', '');
  for (const [i, v] of [[0, 'A'], [1, 'B'], [2, 'C'], [3, 'D']]) {
    await step(tok); // 4071 我就push 第一筆資料假設叫做A | 4086 再pushB進去之後 | 4115 接下來假設PushC | 4128 接下來假設我再放第四筆資料
    const m = cube(v, ctx.colorFor(i), [0.8, 0.8, 0.8], 5.4, QY, 0);
    items.push(m);
    const x0 = 5.4; await anim(tok, 700, (u) => { m.position.x = x0 + (QX(i) - x0) * u; });
    ptr();
    say('push ' + v, i === 0 ? 'front、rear 都指向 A' : 'rear 往後移一格');
  }
  await step(tok); // 4139 假設到這一刻我想要pop資料
  const a = items.shift(); fly(a, V3(-6, 4, 0)); ptr();
  bub('pop → A', -4.6, QY - 1.2);
  say('pop：從 front 拿出 A', '先進去的先出來');
  await step(tok); // 4166 所以這時候front就往後移一個格子
  items.forEach((m, i) => move(m, QX(i), QY, 0)); await anim(tok, 400, () => {}); ptr();
  say('front 往後移，指到 B', '再 push 就從 rear 繼續放');
  await step(tok); // 4179 依此類推所以基本上大家總結來看
  say('資料只往一個方向移動', '先進去的人一定先出來');
}]);

// 70:07 Stack：只有一個開口的瓶子，LIFO
FRAG.push(['graphjiang1-stack', 'Stack：只有一端開口的瓶子，LIFO', async (tok) => {
  fresh(CAM, LOOK);
  const SX = -2.6, SY = (i) => 0.7 + i * 0.95;
  const items = [];
  let top = null;
  const ptr = () => { if (top) remove(top); if (items.length) top = tag('top →', 'ptr', SX - 1.5, items[items.length - 1].position.y); };
  await step(tok); // 4207 跟Q常被就一起相提並論
  hdr('stack', SX, 7.4);
  say('常跟 queue 一起講的：stack', '');
  await step(tok); // 4219 它是一個瓶子
  const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 5.2, 24, 1, true), new THREE.MeshStandardMaterial({ color: JC.blue, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
  jar.position.set(SX, 2.8, 0); lab.world.add(jar);
  const bottom = lab.box(JC.ink, [1.6, 0.15, 1.6]); bottom.position.set(SX, 0.15, 0); lab.world.add(bottom);
  say('Stack 像一個瓶子：只有上面開口', '底部封死');
  await step(tok); // 4244 東西如果先丟進去的話它會沉到底部
  say('先丟進去的沉到底部', '要拿下面的，得先拿掉上面的');
  await step(tok); // 4258 它是Less Inversal
  good('LIFO：last in, first out', 3.4, 5.6);
  say('LIFO：最後進去的先出來', '');
  await step(tok); // 4295 只需要maintain一個pointer就好
  note('只要一個 pointer：top', 3.4, 4.8);
  say('只要一個 pointer：top', '指向最上面那筆');
  for (const [i, v] of [[0, 'A'], [1, 'B'], [2, 'C'], [3, 'D'], [4, 'E']]) {
    await step(tok); // 4320 所以一開始pushA | 4322 然後接下來再pushB | 4325 再pushC | 4328 pushD | 4333 那pushE
    items.push(cube(v, ctx.colorFor(i), [0.9, 0.8, 0.9], SX, SY(i), 0, 2.4)); await anim(tok, 300, () => {});
    ptr();
    say('push ' + v, 'top 指向 ' + v);
  }
  await step(tok); // 4340 現在要pop了那pop
  fly(items.pop(), V3(0, 8, 0)); ptr();
  bub('pop → E', 0.2, 5.4);
  say('pop：拿出最上面的 E', '');
  await step(tok); // 4345 所以這時候top就往下移
  say('top 往下移，指到 D', '最先進去的 A 最後才出來');
  await step(tok); // 4387 Link的Stake或者是Link的Queue
  pkt('實作：linked stack、linked queue', 3.4, 3.8);
  say('實作：可以用 linked list', '');
  await step(tok); // 4398 Circular的Queue
  note('也可以用 array：circular queue', 3.4, 3.1);
  say('也可以用 array，例如 circular queue', '');
  await step(tok); // 4434 這個是Stack的形式Link的Stack
  const LS = ['E', 'D', 'C'].map((v, i) => lnodeAt(v, 1.6 + i * 1.6, 1.6));
  tag('top', 'ptr', 1.6, 2.4);
  say('Linked stack：每筆指向下一筆', '另外記一個 top pointer');
  await step(tok); // 4458 如果是queue的形式的話呢
  ['A', 'B', 'C'].map((v, i) => lnodeAt(v, 1.6 + i * 1.6, 0.2));
  tag('front', 'ptr', 1.6, -0.5); tag('rear', 'ptr alt', 4.8, -0.5);
  say('Linked queue：記 front 和 rear', '因為兩端都開口');
  await step(tok); // 4497 為什麼要用link list來去imprimate
  say('為什麼用 linked list？', '');
  await step(tok); // 4511 list的長度是可以改變的
  good('長度可以動態變大變小', 4.6, 2.5);
  say('長度可以動態增加或縮減', '不知道會有多少資料時很好用');
}]);
// a tiny linked-list node (data + pointer box) used above
function lnodeAt(v, x, y) { const g = K.lnode(v, x, y, 0, JC.sand); g.scale.setScalar(0.7); return g; }

// 75:36 實作 BFS：L[i]、discovered、T
FRAG.push(['graphjiang1-bfsimpl', '實作 BFS：L[i]、discovered 與 T', async (tok) => {
  fresh(CAM, LOOK);
  const G = gGraph(K8, E13, P13);
  const C = code(['BFS(s):', '  discovered[s]=true；其他 false', '  L[0]={s}；i=0；T=∅', '  while L[i] 不空:', '    L[i+1]=∅', '    for each u ∈ L[i]:', '      for each edge (u,v):', '        if not discovered[v]:', '          discovered[v]=true', '          T = T + (u,v)', '          L[i+1] = L[i+1] + v', '    i = i+1'], 3.9, 6.9, 0.52);
  const Lt = tag('', 'pkt', -3.2, 7.5), Tt = tag('', 'pkt', -3.2, -0.3);
  const L = [[]], T = [];
  const show = () => { txt(Lt, L.map((l, i) => 'L' + i + '={' + l.join(',') + '}').join('  ')); txt(Tt, 'T = {' + T.map(([a, b]) => a + b).join(' ') + '}'); };
  await step(tok); // 4536 我們就看一下怎麼去implementBFS
  say('來實作 BFS', '');
  await step(tok); // 4550 在這邊的話我們使用adgenesis list
  note('用 adjacency list', 3.9, 7.6);
  say('Graph 用 adjacency list 表示', '');
  await step(tok); // 4561 它儲存的方式跟我BFS的作用呢是可以完全match
  say('它的存法跟 BFS 的動作完全 match', '用 matrix 的話 complexity 會變高');
  await step(tok); // 4588 從這個點開始Iteractively往外擴散
  C.hl(0);
  say('給起點 s，一層一層往外找', '');
  await step(tok); // 4601 每個點呢都做labeling
  say('每個點都要 label 它在第幾層', 'L[i] = 第 i 層的成員');
  await step(tok); // 4638 我都maintain一個discover這個變數
  K8.forEach((k) => { G.v[k].userData.d = tag('F', 'idx', P13[k][0] + 0.5, P13[k][1] - 0.45, 0.3); });
  say('每個點一個 discovered 變數', '記錄看過它沒有');
  await step(tok); // 4665 e這個人我就先labor他是l0
  C.hl(1);
  G.col(1, LAYC[0]); txt(G.v[1].userData.d, 'T');
  say('從 1 開始：discovered[1] = true', '');
  await step(tok); // 4678 其他人呢都還沒有看到
  say('其他人一開始都是 false', '');
  await step(tok); // 4703 就是我的I呢
  C.hl(2); L[0] = [1]; show();
  say('i = 0，L[0] = {1}', '');
  await step(tok); // 4713 我另外maintain一個set是T
  show();
  say('另外用 set T 存 tree edge', '之後常用到 BFS tree');
  await step(tok); // 4737 然後接下來就進入hy loop
  C.hl(3);
  say('進入 while loop：L[i] 不空就繼續', '');
  await step(tok); // 4762 我就先開出下一個L1
  C.hl(4); L[1] = []; show();
  say('先開一個空的 L[1]', '');
  await step(tok); // 4789 那1的鄰居們把他抓進來
  C.hl(6); glow(G.v[1], GOLD);
  [2, 3].forEach((k) => paintE(G.ed(1, k), JC.hot, 'thick'));
  say('拿出 L[0] 的 u = 1，看它的鄰居 2、3', '');
  await step(tok); // 4805 如果這個鄰居呢目前是沒有看過它的話呢
  C.hl(8); txt(G.v[2].userData.d, 'T');
  say('2 沒看過：discovered[2] = true', '');
  await step(tok); // 4817 所以這個點就會是放在tree
  C.hl(9); T.push([1, 2]); paintE(G.ed(1, 2), JC.red, 'thick'); show();
  say('經過 (1, 2) 看到 2：放進 T', '');
  await step(tok); // 4836 就會是在下一層li加1
  C.hl(10); L[1].push(2); G.col(2, LAYC[1]); show();
  await anim(tok, 500, () => {});
  txt(G.v[3].userData.d, 'T'); T.push([1, 3]); paintE(G.ed(1, 3), JC.red, 'thick'); L[1].push(3); G.col(3, LAYC[1]); show();
  say('2 放進 L[1]；3 也一樣', '');
  await step(tok); // 4842 set一個set加新的element
  note('+ = union（加進集合）、\\ = 扣掉', 3.9, 0.4);
  say('集合「+」新元素就是 union', '扣掉元素可以用反斜線');
  await step(tok); // 4895 這兩個forloop處理完了之後
  glow(G.v[1], null); C.hl(11);
  say('兩個 for loop 做完，L[1] 就完成了', '');
  await step(tok); // 4907 所以我就往前再進一步i就變成i加1
  for (const [i, ks, src] of [[2, [4, 5, 7, 8], [2, 2, 3, 3]], [3, [6], [5]]]) {
    L[i] = [];
    ks.forEach((k, j) => { txt(G.v[k].userData.d, 'T'); T.push([src[j], k]); paintE(G.ed(src[j], k), JC.red, 'thick'); L[i].push(k); G.col(k, LAYC[i]); });
    show(); await anim(tok, 600, () => {});
  }
  C.hl(3);
  say('i + 1，處理下一層，直到走不下去', 'L[2] = {4,5,7,8}，L[3] = {6}');
}]);

// 82:13 L[i] 用 queue 還是 stack？running time
FRAG.push(['graphjiang1-bfsds', 'L[i] 用 queue 或 stack 都行；O(n + m)', async (tok) => {
  fresh(CAM, LOOK);
  const rows = [[1], [2, 3], [4, 5, 7, 8], [6]];
  const LX = (j) => -4.8 + j * 0.9, LY = (i) => 6.2 - i * 1.3;
  const box = [];
  await step(tok); // 4933 其實每個layer我都分別開一個L出來
  rows.forEach((ks, i) => { tag('L' + i, 'idx', -6.0, LY(i)); box[i] = ks.map((k, j) => cube(k, LAYC[i], [0.7, 0.7, 0.7], LX(j), LY(i), 0, 1)); });
  say('每一層各開一個 list：L0、L1、L2、L3', '');
  await step(tok); // 4964 其實根據上面介紹的Stack和Q來說
  const q = bub('用 stack 還是 queue？', 2.6, 6.6);
  say('每層的 list 用什麼 data structure？', 'stack 還是 queue？');
  await step(tok); // 4973 Data Structure上面說BFS要用Q
  remove(q);
  say('資料結構課說：BFS 要用 queue', '');
  await step(tok); // 4982 其實這裡的話兩個都可以啦
  good('這裡兩個都可以：每層獨立存', 2.6, 6.6);
  say('其實這裡兩個都可以', '因為每一層是分開存的');
  await step(tok); // 5005 其實沒有啊其實也是可以的
  const r2 = box[2];
  await anim(tok, 800, (u) => r2.forEach((m, j) => { m.position.x = LX(j) + (LX(3 - j) - LX(j)) * u; }));
  say('用 stack，同一層的順序會反過來', '但還是對的');
  await step(tok); // 5017 但是有一個Case會不行
  say('但有一種情況不行', '');
  await step(tok); // 5030 我只想要用一條list
  const flat = [1, 2, 3, 4, 5, 7, 8, 6];
  box.flat().forEach((m) => kill(m));
  tag('一條 queue：', 'idx', -5.6, 0.6);
  flat.forEach((k, j) => cube(k, LAYC[LAY[k]], [0.6, 0.6, 0.6], -4.4 + j * 0.75, 0.6, 0, 1));
  bad('只用一條 list → 必須用 queue', 2.6, 5.8);
  say('不分層、只用一條 list：就要用 queue', '');
  await step(tok); // 5046 不是always一定要用哪一種
  note('看 procedure 決定，不是一定用哪一種', 2.6, 5.0);
  say('不要被騙：不是永遠只能用哪一種', '看 procedure 的需求');
  await step(tok); // 5054 RunningTie的話呢
  hdr('running time', 2.6, 4.0);
  say('Running time', '');
  await step(tok); // 5066 對於每個點其實我都要去Check它的鄰居們
  say('重點：每個點都要 check 它的鄰居', '');
  await step(tok); // 5093 壓在big o
  good('adjacency list：O(n + m)', 2.6, 3.2);
  say('Adjacency list：只看真正的鄰居', '總共 O(n + m)');
  await step(tok); // 5106 adgency matrix呢就不行
  bad('adjacency matrix：O(n²)', 2.6, 2.4);
  say('Adjacency matrix 不行', '');
  await step(tok); // 5119 會把他整條都抓出來
  say('每個點都要掃整個 row', '不管是不是鄰居 → n²');
  await step(tok); // 5145 但是我如果是用adgencylist的話呢
  say('List：edge 少就接近 O(n)', 'edge 多才接近 O(n²)');
  await step(tok); // 5159 它是一個彈性的
  note('圖複雜才做得久，圖簡單就快', 2.6, 1.6);
  say('有彈性：BFS 偏好用 adjacency list', '');
}]);

// 86:25 實作 DFS：recursive 與 stack
FRAG.push(['graphjiang1-dfsimpl', '實作 DFS：recursive 或明著用 stack', async (tok) => {
  fresh(CAM, LOOK);
  const G = gGraph(K8, E13, P13);
  const rec = code(['DFS(u):  （recursive）', '  mark u explored', '  for each edge (u,v):', '    if v not explored: DFS(v)'], 3.6, 7.1, 0.5);
  let it = null;
  const S = []; let st = null;
  const showS = () => { if (st) remove(st); st = tag('stack S：[' + S.join(', ') + ']  ← top', 'pkt', -2.6, -0.3); };
  await step(tok); // 5185 接下來的話呢就是implement DFS
  rec.hl(0);
  say('實作 DFS：前面的 procedure 是 recursive call', '');
  await step(tok); // 5196 給定一個起點Iterative往下看
  rec.hl(3);
  say('走 edge、explore，無路可走就 return', '再試下一個 branch');
  await step(tok); // 5209 如果你用Recursive去做它的話呢
  rec.hl(-1);
  say('Recursive 寫法：幾行就結束', '');
  await step(tok); // 5224 Recursive code其實你都可以翻譯成Iterative
  it = code(['DFS(s):  （while loop）', '  S = stack，放入 s', '  while S 不空:', '    u = pop(S)', '    if u not explored:', '      mark u explored', '      for each edge (u,v): push(S, v)'], 3.6, 4.6, 0.5);
  say('Recursive 都能翻成 iterative（while loop）', '只是行數多一點');
  await step(tok); // 5253 我們還是用AdgentsList的Representation
  say('一樣用 adjacency list', '這個版本要配什麼 data structure？');
  await step(tok); // 5266 我們先來看一下這邊的話有一個setS
  it.hl(1);
  say('有一個 set S', '存鄰居還沒完全看完的人');
  await step(tok); // 5278 這個s這個set我們用stack去implement它
  showS();
  say('S 用 stack 實作', '');
  await step(tok); // 5293 一開始的話呢這個stack就s這個人
  S.push(1); showS(); it.hl(3);
  await anim(tok, 400, () => {});
  S.pop(); showS();
  say('一開始 stack 只有 s = 1；每次 pop 一個', '');
  await step(tok); // 5304 如果這個人呢就還沒有還沒有看過
  it.hl(5); G.col(1, JC.red);
  say('還沒 explore，就 explore 它', '');
  await step(tok); // 5316 有往外漲的Edge它要再往下去
  it.hl(6);
  [3, 2].forEach((k) => paintE(G.ed(1, k), JC.hot, 'thick'));
  say('看它往外的 edge', '');
  await step(tok); // 5329 我就把它放到Stack裡面
  S.push(3, 2); showS();
  say('把鄰居放進 stack', '');
  await step(tok); // 5341 Stack 並非Q所以大家會發現
  it.hl(3);
  S.pop(); showS(); G.col(2, JC.red); paintE(G.ed(1, 2), JC.red, 'thick'); paintE(G.ed(1, 3), JC.edge);
  say('用 stack 不是 queue：剛放的 2 先被拿出來', '所以會繼續往下走');
  await step(tok); // 5352 這些人會先被拿出來處理
  S.push(5, 4, 3, 1); showS();
  await anim(tok, 500, () => {});
  S.pop(); showS(); S.pop(); showS(); G.col(3, JC.red); paintE(G.ed(2, 3), JC.red, 'thick');
  say('後放進去的先處理：一路往深處', '1 已 explore 就跳過，接著走 3');
  await step(tok); // 5382 其實它也是有一個stack
  rec.hl(0);
  say('Recursive 版也有一個 stack', '');
  await step(tok); // 5395 它直接是用assistant的stack
  pkt('recursive：系統的 call stack（implicit）', -3.0, 7.6);
  say('它用的是系統的 call stack', '隱含在 recursive call 裡');
  await step(tok); // 5408 在下面whide loop的形式我們要非常explicitly
  it.hl(1);
  pkt('while 版：自己宣告 stack（explicit）', -3.0, 6.95);
  say('While 版要明確宣告一個 stack', '');
  await step(tok); // 5422 找一個example然後紙筆上面直接試試看
  note('拿個例子，紙筆跑一次', 0.2, 0.6, 1.2);
  say('拿到 procedure：找個例子紙筆跑跑看', '跑成功才算懂');
  await step(tok); // 5434 wrong timeat the gs list的話是n加m
  good('adjacency list：O(n + m)', 3.6, 0.6);
  bad('adjacency matrix：O(n²)', 3.6, -0.1);
  say('Running time：list 是 O(n + m)', 'matrix 是 O(n²)');
}]);
  }

  // ═══ graphjiang2.js ═══
  {
const { V3, fresh, tag, cube, kill, glow, tint, txt, relabel, code, anim, line, arrow, ghostBox, GOLD, step, buddy, icon, travel, remove } = K;
// ─── 交大江蕙如 Lec08（r5CTlHdo9Oo）Graphs (3/4)：matrix vs list、BFS／DFS 的 data structure、Testing bipartiteness
//     （定義、2-coloring、BFS 著色、正確性證明）、coloring 延伸（mask 多次曝光）、directed graph 的 strong connectivity、
//     strongly connected 的 linear-time 測試
// ─── 交大江蕙如 Lec09（OQDaruIDCjY）Graphs (4/4)：strong connectivity 回顧、strong component（maximal、縮點成 DAG、
//     同或互斥）、DAG 與 topological ordering（定義、應用、source lemma 證明、例子、歸納法證明、O(n + m) 實作）
// Cued scenes: every act in seq() waits for one step(tok) = the sentence that shows it (cues live in the notes; the
// number in each act comment is the transcript time where the lecturer starts saying it). Motion inside an act is short;
// nothing loops or replays. Graphs live in the x-y plane, camera from the front.
const JC = { node: '#cbbd9f', edge: '#a8987c', red: '#e8695e', blue: '#5aa6ea', hot: '#e8b02a', ok: '#2fc092', dim: '#e8e0d0', gray: '#cfc6b4', purple: '#9b7ef4', pink: '#e55a9b', orange: '#e59a52', green: '#5cc98a', yellow: '#f1d04b', cell: '#ece4d2' };
const jT = (cls) => (t, x, y, z = 0) => tag(t, cls, x, y, z);
const bub = jT('say'), note = jT('note'), pkt = jT('pkt'), good = jT('good'), bad = jT('bad'), ptr = jT('ptr'), head = jT('ptr alt'), idx = jT('idx');
const CAM = [[0, 3.6, 14], [0, 3.2, 0]];
const jFresh = () => fresh(CAM[0], CAM[1]);
// one lecture step per act
async function seq(tok, acts) { for (const a of acts) { await step(tok); await a(); } }
async function walk(tok, b, x, y, ms = 700) {
  const a = b.g.position.clone();
  await anim(tok, ms, (u) => b.g.position.set(a.x + (x - a.x) * u, a.y + (y - a.y) * u, a.z));
}
async function pulse(tok, m, ms = 320) { await anim(tok, ms, (u) => m.scale.setScalar(1 + 0.3 * Math.sin(Math.PI * u))); }
// a graph in the x-y plane: P = {k: [x, y]}, E = [[u, v, off]]; directed arrows unless o.undirected
function jgGraph(P0, E, o = {}) {
  const r = o.r ?? 0.5, sz = o.size ?? 0.75;
  const G = { P: { ...P0 }, N: {}, E: [], r, directed: !o.undirected };
  for (const k of Object.keys(G.P)) { const [x, y] = G.P[k]; G.N[k] = cube(o.names ? o.names[k] : k, o.color || JC.node, [sz, sz, sz * 0.8], x, y, 0, o.drop || 0); }
  // edges are drawn to where the vertices land (G.P): a dropped vertex is still up in the air when its edges are made;
  // only while morphing do they follow the moving meshes
  const at = (k) => (G.live ? G.N[k].position : V3(G.P[k][0], G.P[k][1], 0));
  const geo = (ed) => {
    const a = at(ed.u), b = at(ed.v);
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, px = -uy * ed.off, py = ux * ed.off;
    return [V3(a.x + ux * r + px, a.y + uy * r + py, 0), V3(b.x - ux * r + px, b.y - uy * r + py, 0)];
  };
  G.add = (u, v, off = 0, c = JC.edge) => {
    const ed = { u, v, off, c }; const [a, b] = geo(ed);
    ed.obj = G.directed ? arrow(a, b, c) : line(a.x, a.y, b.x, b.y, 0, c);
    ed.set = (col) => { ed.c = col; if (G.directed) ed.obj.setColor(col); else ed.obj.material.color.set(col); };
    G.E.push(ed); return ed;
  };
  for (const [u, v, off] of E) G.add(u, v, off || 0);
  G.e = (u, v) => G.E.find((x) => (x.u === u && x.v === v) || (!G.directed && x.u === v && x.v === u));
  G.fix = () => {
    for (const ed of G.E) {
      const [a, b] = geo(ed);
      if (G.directed) { const d = b.clone().sub(a); const len = Math.max(0.05, d.length()); ed.obj.position.copy(a); ed.obj.setDirection(d.normalize()); ed.obj.setLength(len, Math.min(0.35, len * 0.4), 0.22); }
      else ed.obj.geometry.setFromPoints([a, b]);
    }
  };
  G.morph = async (tok, Q, ms = 1200) => {
    // a vertex still falling into place would be pulled back to its old spot: stop its body first
    for (const b of lab.bodies) for (const k in Q) if (b.obj === G.N[k]) { b.mode = 'rest'; b.vel.set(0, 0, 0); b.target.set(Q[k][0], Q[k][1], 0); }
    const from = {}; for (const k in Q) from[k] = G.N[k].position.clone();
    G.live = true;
    await anim(tok, ms, (u) => { for (const k in Q) G.N[k].position.set(from[k].x + (Q[k][0] - from[k].x) * u, from[k].y + (Q[k][1] - from[k].y) * u, 0); G.fix(); });
    for (const k in Q) G.P[k] = Q[k];
    G.live = false; G.fix();
  };
  G.flip = () => { for (const ed of G.E) [ed.u, ed.v] = [ed.v, ed.u]; G.fix(); };
  G.paint = (k, c) => tint(G.N[k], c);
  G.out = (k) => G.E.filter((x) => x.u === k).map((x) => x.v);
  G.inn = (k) => G.E.filter((x) => x.v === k).map((x) => x.u);
  G.pos = (k) => G.N[k].position.clone();
  G.all = (c) => { for (const ed of G.E) ed.set(c); };
  G.addNode = (k, x, y, drop = 0) => { G.P[k] = [x, y]; G.N[k] = cube(k, o.color || JC.node, [sz, sz, sz * 0.8], x, y, 0, drop); return G.N[k]; };
  G.kill = () => { for (const k in G.N) kill(G.N[k]); for (const ed of G.E) kill(ed.obj); };
  return G;
}
// a little dot running along an edge
async function zip(tok, G, u, v, t = '●', ms = 450) { const p = pkt(t, G.P[u][0], G.P[u][1] + 0.1, 0.5); await travel(tok, p, G.pos(u).setZ(0.5), G.pos(v).setZ(0.5), ms); remove(p); }
// BFS wave on G from s (following ed.u → ed.v); paints visited nodes / tree edges; returns the visit order
async function wave(tok, G, s, color, ms = 300) {
  const seen = new Set([s]); let fr = [s]; G.paint(s, color);
  while (fr.length) {
    const nx = [];
    for (const u of fr) for (const v of (G.directed ? G.out(u) : G.E.filter((x) => x.u === u || x.v === u).map((x) => (x.u === u ? x.v : x.u)))) if (!seen.has(v)) { seen.add(v); nx.push(v); G.e(u, v).set(color); }
    if (nx.length) { await beat(tok, ms); nx.forEach((v) => G.paint(v, color)); }
    fr = nx;
  }
  return [...seen];
}
// an arc edge above a row of nodes (x1 → x2 at height y), with an arrowhead at the end
function arcEdge(x1, x2, y, color = JC.edge, up = 1) {
  const h = (0.45 + Math.abs(x2 - x1) * 0.16) * up, pts = [];
  for (let i = 0; i <= 24; i++) { const u = i / 24; pts.push(V3(x1 + (x2 - x1) * u, y + up * 0.45 + Math.sin(Math.PI * u) * h, 0)); }
  const g = new THREE.Group();
  const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color })); g.add(ln);
  const a = pts[21], b = pts[24].clone().add(V3(0, -0.08 * up, 0)); const d = b.clone().sub(a);
  g.add(new THREE.ArrowHelper(d.clone().normalize(), a, d.length(), color, 0.3, 0.2));
  lab.world.add(g); return g;
}
// a domino: thin tall block that can tip over to the right
function domino(x, y, color) { const m = cube('', color, [0.28, 1.5, 0.7], x, y + 0.75, 0); m.userData.x0 = x; m.userData.y0 = y + 0.75; return m; }
function tipTo(m, u) { m.rotation.z = -1.05 * u; m.position.x = m.userData.x0 + 0.62 * u; m.position.y = m.userData.y0 - 0.32 * u; }

// ── shared example graphs ──
// Lec08 bipartite example (reconstructed): start at 6 → {2, 7} → {1, 3, 4} → {5}
const BIP_E = [['6', '2'], ['6', '7'], ['1', '2'], ['1', '5'], ['3', '5'], ['3', '7'], ['4', '2'], ['4', '7']];
const BIP_NICE = { 2: [-5.0, 5.0], 5: [-3.2, 5.0], 7: [-1.4, 5.0], 3: [-6.0, 1.8], 1: [-4.2, 1.8], 6: [-2.4, 1.8], 4: [-0.6, 1.8] };
const BIP_MESSY = { 1: [-4.8, 4.6], 2: [-2.3, 5.6], 3: [-5.8, 1.6], 4: [-0.5, 3.6], 5: [-6.0, 3.6], 6: [-1.2, 1.2], 7: [-3.6, 2.4] };
// Lec08 directed example: 1 → … never reaches 2, 3
const D7_P = { 1: [-3.2, 3.8], 2: [-6.2, 5.4], 3: [-6.2, 2.2], 4: [-0.6, 5.8], 5: [-0.6, 1.6], 6: [1.8, 3.8], 7: [3.6, 1.2] };
const D7_E = [['2', '3'], ['2', '1'], ['3', '1'], ['1', '4'], ['1', '5'], ['4', '6'], ['5', '6'], ['6', '7'], ['7', '1']];
// strongly connected test graph: s→a→b→s, a→c→d→a
const SC_P = { s: [-5.0, 3.6], a: [-2.8, 5.4], b: [-2.8, 1.8], c: [-0.4, 5.4], d: [-0.4, 1.8] };
const SC_E = [['s', 'a'], ['a', 'b'], ['b', 's'], ['a', 'c'], ['c', 'd'], ['d', 'a']];
// Lec09 topological-ordering example (7 vertices, sources A bottom-right and B top-left; order A B C D E F G = 1..7)
const TP = { A: [0.98, 0.6], B: [-6.2, 5.6], C: [0.98, 5.6], D: [-3.2, 4.4], E: [-2.55, 2.6], F: [2.75, 3.1], G: [-6.2, 0.4] };
const TE = [['A', 'D'], ['A', 'E'], ['A', 'G'], ['B', 'C'], ['B', 'D'], ['B', 'E'], ['C', 'D'], ['C', 'F'], ['D', 'E'], ['E', 'F'], ['E', 'G'], ['F', 'G']];
const TORD = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
function topoGraph(o = {}) { return jgGraph(TP, TE, o); }

// ═════════════ Lec08（r5CTlHdo9Oo） ═════════════

// 00:29 Adjacency matrix vs adjacency list：六個問題
FRAG.push(['graphjiang2-rep-compare', 'Adjacency matrix vs list：六個問題比一比', async (tok) => {
  jFresh();
  const ADJ = { 1: [2, 3], 2: [1, 3], 3: [1, 2, 4], 4: [3] };
  const mx = (c) => -5.8 + c * 0.72, my = (r) => 5.0 - r * 0.72;
  const lx = (k) => 2.9 + k * 0.92, ly = (r) => 5.1 - r * 0.85;
  let G = null, q = null, marks = [];
  const cell = [], ln = {};
  const mat = buddy('matrix', 0, '#9fb8ff', -4.7, -0.6, 0.6, 0.6);
  const lst = buddy('list', 0, '#f4a56a', 4.2, -0.6, 0.6, 0.6);
  const sc = [0, 0];
  const mark = (l) => { marks.push(l); return l; };
  const unglow = () => { for (const row of cell) for (const c of row) glow(c, null); for (const k in ln) ln[k].forEach((c) => glow(c, null)); if (G) for (const k in G.N) glow(G.N[k], null); };
  const ask = (t) => { if (q) remove(q); marks.forEach(remove); marks = []; q = head(t, 0, 6.75); mat.mood('calm'); lst.mood('calm'); unglow(); };
  const win = async (w) => { const b = w ? lst : mat; sc[w]++; b.set(sc[w]); b.mood('happy'); (w ? mat : lst).mood('sad'); await b.hop(tok); };
  await seq(tok, [
    async () => {                                     // 29.0 很快 summarize 兩種表示法
      G = jgGraph({ 1: [-1.1, 5.0], 2: [1.1, 5.0], 3: [-1.1, 2.8], 4: [1.1, 2.8] }, [['1', '2'], ['1', '3'], ['2', '3'], ['3', '4']], { undirected: true, drop: 2 });
      for (let r = 0; r < 4; r++) {
        cell.push([]); idx(String(r + 1), mx(-1) + 0.25, my(r)); idx(String(r + 1), mx(r), my(-1) - 0.15);
        for (let c = 0; c < 4; c++) { const on = ADJ[r + 1].includes(c + 1); cell[r].push(cube(on ? 1 : 0, on ? JC.blue : JC.cell, [0.6, 0.6, 0.2], mx(c), my(r), 0)); }
      }
      for (let r = 0; r < 4; r++) {
        ln[r + 1] = [cube(r + 1, JC.node, [0.6, 0.6, 0.3], lx(0), ly(r), 0)];
        ADJ[r + 1].forEach((v, k) => { ln[r + 1].push(cube(v, JC.orange, [0.6, 0.55, 0.3], lx(k + 1), ly(r), 0)); line(lx(k) + 0.32, ly(r), lx(k + 1) - 0.32, ly(r), 0); });
      }
      ptr('adjacency matrix', mx(1.5), 6.05); ptr('adjacency list', lx(1.5), 6.05);
      say('兩種最常用的表示法，比一比', '同一張小圖：1-2、1-3、2-3、3-4');
    },
    async () => { ask('Q1：edge (2, 3) 存在嗎？'); glow(G.N[2], GOLD); glow(G.N[3], GOLD); say('Q1：查一條給定的 edge', '哪一種比較快？'); },   // 54.4
    async () => {                                     // 65.5 matrix：直接 access entry，O(1)
      glow(cell[1][2], GOLD); mark(pkt('看 A[2][3]', mx(2), my(1) + 0.55, 0.3)); mark(good('matrix：O(1)', mx(1.5), 1.5));
      say('Matrix：直接看那一格 entry', 'O(1) 就知道 edge 在不在'); await win(0);
    },
    async () => {                                     // 81.0 list：要掃完一條 list
      for (const c of ln[2].slice(1)) { glow(c, GOLD); await beat(tok, 300); }
      mark(note('list：掃完 2 的 list', lx(1.5), 1.5)); say('List：要把那條 list 掃完', '才知道 3 在不在');
    },
    async () => { ask('Q2：node 3 的 degree？'); glow(G.N[3], GOLD); say('Q2：一個 node 的 degree', 'degree = 連出去的 edge 數'); },   // 94.1
    async () => {                                     // 112.5 matrix：掃完整個 row
      for (let c = 0; c < 4; c++) { glow(cell[2][c], GOLD); await beat(tok, 250); }
      mark(note('matrix：掃整個 row，O(n)', mx(1.5), 1.5)); say('Matrix：掃完一整個 row', '把 1 加起來，O(n)');
    },
    async () => {                                     // 138.5 list：flexible 長度，掃自己的 list
      for (const c of ln[3].slice(1)) { glow(c, GOLD); await beat(tok, 250); }
      mark(good('list：掃 3 的 list → 3', lx(1.5), 1.5)); say('List：掃 3 後面掛的 list 就好', 'degree = 3，花的時間比 n 少'); await win(1);
    },
    async () => { ask('Q3：把整張圖畫出來（traverse）'); say('Q3：traverse、畫出整張圖', '哪一種比較快？'); },   // 163.0
    async () => {                                     // 192.0 list：vertex array + 每條 list，O(n + m)
      for (let r = 1; r <= 4; r++) { for (const c of ln[r]) glow(c, GOLD); await beat(tok, 220); }
      G.all(JC.ok); mark(good('list：O(n + m)', lx(1.5), 1.5)); say('List：掃 vertex array 和每條 list', 'O(n + m)，m 是 edge 數'); await win(1);
    },
    async () => {                                     // 218.7 matrix：每一格都要確認，O(n²)
      for (let r = 0; r < 4; r++) { for (let c = 0; c < 4; c++) glow(cell[r][c], GOLD); await beat(tok, 220); }
      mark(note('matrix：每格都要看，O(n²)', mx(1.5), 1.5)); say('Matrix：每個 entry 都要確認', '至少半個 matrix，O(n²)');
    },
    async () => { ask('Q4：存一個 sparse graph'); G.all(JC.edge); say('Q4：sparse（edge 很少）的 graph', '用哪一種存比較好？'); },   // 251.6
    async () => {                                     // 262.0 list：storage ∝ edge 數
      for (let r = 1; r <= 4; r++) for (const c of ln[r]) glow(c, GOLD);
      mark(good('list：空間 ∝ edge 數', lx(1.5), 1.5)); say('List：空間跟 edge 數成正比', '越 sparse 越省'); await win(1);
    },
    async () => {                                     // 280.8 matrix：永遠 n²
      for (const row of cell) for (const c of row) glow(c, GOLD);
      mark(note('matrix：永遠 n² 格', mx(1.5), 1.5)); say('Matrix：不管 sparse 或 dense', '一定開 n² 那麼大');
    },
    async () => {                                     // 298.3 dense：matrix 小贏
      mark(note('dense 時 matrix 小贏（list 要 n + 2m 格）', 0, 0.8)); mat.mood('happy');
      say('Dense 時 matrix 小贏一點點', 'order 差不多：list 總長是 edge 數的兩倍');
    },
    async () => { ask('Q5：加一條 edge (2, 4)／刪一條 edge'); say('Q5：insert 或 delete 一條 edge', '哪一種比較容易？'); },   // 339.4
    async () => {                                     // 351.8 matrix：0/1 翻轉
      for (const [r, c] of [[1, 3], [3, 1]]) { relabel(cell[r][c], 1); tint(cell[r][c], JC.blue); glow(cell[r][c], GOLD); }
      G.add('2', '4').set(JC.hot); mark(good('matrix：翻轉 0 / 1', mx(1.5), 1.5));
      say('Matrix：直接把那格 0 / 1 翻過來', 'insert、delete 都很快'); await win(0);
    },
    async () => {                                     // 362.4 list：insert 簡單，delete 要先找
      ln[2].push(cube(4, JC.hot, [0.6, 0.55, 0.3], lx(3), ly(1), 0, 1.5));
      mark(note('list：insert 接上去；delete 要先找到', lx(1.5), 1.5)); say('List：insert 接上去就好', 'delete 要先找到它，比較久');
    },
    async () => { ask('Q6：大部分 application 用哪一種？'); say('Q6：對大部分的 application', '比較喜歡用哪一種？'); },   // 386.7
    async () => { mark(good('多數時候：adjacency list', lx(1.5), 1.5)); say('通常是 adjacency list 贏', '課本裡的 algorithm 也常用它'); await win(1); },   // 399.8
    async () => {                                     // 414.0 不是全部：依 application 決定
      mark(note('但不是全部！依 application 選 data structure', 0, 0.8)); mat.mood('calm'); lst.mood('calm');
      say('不要以為只用 list 就好', '依 application 的 procedure 選，影響 performance');
    },
  ]);
}]);

// 07:28 BFS／DFS 用的 data structure 與時間
FRAG.push(['graphjiang2-bfs-dfs-ds', 'BFS 用 queue、DFS 用 stack，都是 O(n + m)', async (tok) => {
  jFresh();
  const bfs = buddy('BFS', '', '#7cd1a8', -4.6, -0.5, 0.6, 0.65);
  const dfs = buddy('DFS', '', '#9fb8ff', 4.6, -0.5, 0.6, 0.65);
  let qs = [], qlab = [];
  await seq(tok, [
    async () => {                                     // 448.1 BFS：queue
      qlab.push(ptr('queue：先進先出', -4.4, 4.7), idx('出 ←', -6.6, 3.3), idx('← 進', -2.3, 3.3));
      ['s', 'a', 'b', 'c'].forEach((v, k) => qs.push(cube(v, JC.ok, [0.75, 0.75, 0.5], -5.75 + k * 0.95, 3.3, 0, 2 + k * 0.4)));
      bfs.mood('happy'); say('BFS 常用的 data structure：queue', '一層一層往外');
    },
    async () => {                                     // 459.7 每層 list 分開存 → stack 也可以
      qs.forEach(kill); qlab.forEach(remove);
      const L = [['s'], ['a', 'b'], ['c', 'd', 'e']];
      L.forEach((row, i) => { idx('L' + i, -6.6, 4.4 - i * 0.95); row.forEach((v, k) => cube(v, JC.ok, [0.7, 0.7, 0.5], -5.6 + k * 0.9, 4.4 - i * 0.95, 0, 1.5)); });
      note('每一層的 list 分開存 → 用 stack 也可以', -3.6, 1.2); bfs.look(0.5);
      say('如果每一層的 list 分開存', '這時候用 stack 也可以');
    },
    async () => {                                     // 471.0 DFS：stack
      ptr('stack：後進先出', 4.6, 5.3);
      ['s', 'a', 'c', 'f'].forEach((v, k) => cube(v, JC.blue, [0.95, 0.6, 0.5], 4.6, 1.4 + k * 0.8, 0, 2.5 + k * 0.5));
      dfs.mood('happy'); say('DFS：對應的是 stack', '這個無庸置疑');
    },
    async () => {                                     // 484.0 兩者都用 adjacency list
      head('representation：adjacency list', 0, 6.4);
      cube('1', JC.node, [0.6, 0.6, 0.3], -0.9, 5.3, 0); cube('2', JC.orange, [0.6, 0.55, 0.3], 0, 5.3, 0); cube('3', JC.orange, [0.6, 0.55, 0.3], 0.9, 5.3, 0);
      say('上次的 BFS、DFS 實作', '都用 adjacency list 表示 graph');
    },
    async () => {                                     // 497.0 時間都是 O(n + m)
      good('BFS、DFS：O(n + m)', 0, 2.6); bfs.mood('happy'); dfs.mood('happy');
      say('兩者時間一樣：O(n + m)', 'n 是點數、m 是 edge 數'); await bfs.hop(tok);
    },
  ]);
}]);

// 08:43 Testing bipartiteness：bipartite graph 的定義與 matching
FRAG.push(['graphjiang2-bip-def', 'Bipartite graph：點分兩組，edge 只跨組', async (tok) => {
  jFresh();
  const XP = { x1: [-5, 5.0], x2: [-3, 5.0], x3: [-1, 5.0], y1: [-5, 1.6], y2: [-3, 1.6], y3: [-1, 1.6] };
  const XE = [['x1', 'y1'], ['x1', 'y2'], ['x2', 'y2'], ['x3', 'y2'], ['x3', 'y3']];
  let G = null;
  await seq(tok, [
    () => { head('應用一：Testing bipartiteness', 0, 6.7); say('BFS／DFS 的第一個 application', 'Testing bipartiteness'); },   // 527.8
    () => {                                           // 537.8 特別的 graph；判定給定的圖是不是
      G = jgGraph(XP, [], { undirected: true, drop: 2.5 });
      note('給一張圖：它是 bipartite graph 嗎？', 3.4, 4.6); say('Bipartite graph：一種特別的 graph', '任務：判定給定的圖是不是');
    },
    () => {                                           // 571.8 點分成兩個 set X、Y
      const hx = ghostBox('#4b9ee2', 5.6, 1.3, 0.5); hx.position.set(-3, 5.0, -0.3);
      const hy = ghostBox('#e8695e', 5.6, 1.3, 0.5); hy.position.set(-3, 1.6, -0.3);
      ptr('X', -6.4, 5.0); ptr('Y', -6.4, 1.6);
      ['x1', 'x2', 'x3'].forEach((k) => G.paint(k, '#8fb8ef')); ['y1', 'y2', 'y3'].forEach((k) => G.paint(k, '#f2a7a0'));
      say('點可以很明顯地分成兩個 set', 'X 和 Y');
    },
    async () => { for (const [u, v] of XE) { G.add(u, v); await beat(tok, 220); } say('Edge 只存在跨越兩組之間', '每條 edge 的兩端落在不同組'); },   // 581.8
    () => { bad('✗', -4, 5.55); bad('✗', -2, 2.15); note('同一組裡面沒有 edge', -3, 3.3); say('同一個 group 裡的點', '彼此之間沒有 edge'); },   // 587.8
    () => { head('G = (X, Y, E)', 3.6, 3.3); say('用三個集合表示 bipartite graph', '兩組點集合 X、Y，加上 edge 集合 E'); },   // 603.8
    () => {                                           // 626.8 小例子：五個點的形式
      const mini = (P, E) => jgGraph(P, E, { undirected: true, size: 0.4, r: 0.24, color: JC.gray });
      mini({ a: [2.3, 6.0], b: [3.3, 6.0], c: [1.9, 5.0], d: [2.8, 5.0], e: [3.7, 5.0] }, [['a', 'c'], ['a', 'd'], ['a', 'e'], ['b', 'c'], ['b', 'd'], ['b', 'e']]);
      mini({ a: [5.5, 6.0], c: [4.6, 5.0], d: [5.2, 5.0], e: [5.8, 5.0], f: [6.4, 5.0] }, [['a', 'c'], ['a', 'd'], ['a', 'e'], ['a', 'f']]);
      say('五個點的 bipartite graph', '可能長成好幾種形式');
    },
    () => { ptr('常用在 matching 問題', 3.6, 2.4); say('Bipartite graph 常用在 matching', ''); },   // 657.8
    () => {                                           // 664.8 X 男生、Y 女生；edge = 可能配對
      ['x1', 'x2', 'x3'].forEach((k) => icon('👦', '', G.P[k][0], 6.05, 0, 'sm')); ['y1', 'y2', 'y3'].forEach((k) => icon('👧', '', G.P[k][0], 0.55, 0, 'sm'));
      say('X 當男生、Y 當女生', 'edge：這一對有機會配成一對');
    },
    () => {                                           // 688.8 選越多條 edge 配對 → maximum cardinality bipartite matching
      for (const ed of G.E) ed.set(JC.dim);
      for (const [u, v] of [['x1', 'y1'], ['x2', 'y2'], ['x3', 'y3']]) G.add(u, v).set(JC.hot);
      good('maximum cardinality bipartite matching', 3.4, 1.2);
      say('選最多條 edge 讓大家配對', 'maximum cardinality bipartite matching');
    },
  ]);
}]);

// 11:50 Bipartite ⇔ two-coloring；三角形、odd cycle 塗不成
FRAG.push(['graphjiang2-bip-color', 'Bipartite = two coloring；odd cycle 塗不成', async (tok) => {
  jFresh();
  let G = null, hs = [], tri = null, pen = null, qq = null;
  const A = ['1', '3', '4', '6'], B = ['2', '5', '7'];
  await seq(tok, [
    () => {                                           // 709.8 已知是 bipartite：畫得很美
      G = jgGraph(BIP_NICE, BIP_E, { undirected: true, drop: 2 });
      const h1 = ghostBox('#4b9ee2', 5.4, 1.2, 0.5); h1.position.set(-3.2, 5.0, -0.3);
      const h2 = ghostBox('#e8695e', 7.0, 1.2, 0.5); h2.position.set(-3.3, 1.8, -0.3); hs = [h1, h2];
      say('已知是 bipartite：畫得很美', '兩組分得很清楚，edge 都跨組');
    },
    async () => {                                     // 743.0 隨便給一張圖
      hs.forEach(kill); await G.morph(tok, BIP_MESSY, 1300);
      qq = note('長這樣，還是 bipartite 嗎？', -3.2, 6.6); say('但如果隨便畫成這樣', '第一眼看不出來是不是 bipartite');
    },
    () => { icon('🖌️', '塗色', 1.8, 5.4, 0); say('等同於幫這些點做塗色', ''); },   // 776.0
    async () => {                                     // 786.4 每條 edge 兩端不同色
      for (const k of B) { G.paint(k, JC.blue); await beat(tok, 180); }
      for (const k of A) { G.paint(k, JC.red); await beat(tok, 180); }
      G.all(JC.ok); say('男生藍、女生紅', '每條 edge 的兩端：一藍一紅');
    },
    () => { good('塗得成 → bipartite', 1.2, 2.9); say('著色過程順利完成', '這張圖就是 bipartite graph'); },   // 817.5
    () => { remove(qq); head('two coloring：two colorable', -3.2, 6.6); say('變成 two coloring 問題', '塗得成就叫 two colorable'); },   // 829.2
    async () => { await G.morph(tok, BIP_NICE, 1500); say('轉一下：2、5、7 一排，6、4 翻過來', '看起來不像，其實一模一樣'); },   // 847.8
    async () => {                                     // 881.3 三角形：塗不成
      tri = jgGraph({ a: [4.4, 5.4], b: [3.2, 3.5], c: [5.6, 3.5] }, [['a', 'b'], ['b', 'c'], ['c', 'a']], { undirected: true, drop: 2 });
      await beat(tok, 300); tri.paint('a', JC.red); await beat(tok, 250); tri.paint('b', JC.blue); await beat(tok, 250); tri.paint('c', JC.red);
      tri.e('c', 'a').set(JC.pink); bad('✗ 一定有 edge 同色', 4.4, 2.6);
      say('三個點兩兩相連：不管怎麼塗', '一定有一條 edge 兩端同色');
    },
    () => { ptr('bipartite ⇒ 沒有 odd cycle', 4.4, 6.55); say('三條 edge 連成 cycle：最簡單的例子', '可以證明：bipartite 裡不會有 odd cycle'); },   // 911.8
    async () => {                                     // 927.6 odd cycle：3、5、7 條 edge
      const P = {}; for (let i = 0; i < 5; i++) { const a = Math.PI / 2 + i * 2 * Math.PI / 5; P['p' + i] = [4.4 + Math.cos(a) * 1.05, 1.0 + Math.sin(a) * 0.95]; }
      pen = jgGraph(P, [['p0', 'p1'], ['p1', 'p2'], ['p2', 'p3'], ['p3', 'p4'], ['p4', 'p0']], { undirected: true, size: 0.5, r: 0.3 });
      for (let i = 0; i < 5; i++) { pen.paint('p' + i, i % 2 ? JC.blue : JC.red); await beat(tok, 200); }
      pen.e('p4', 'p0').set(JC.pink); note('odd cycle：3、5、7…條 edge', 1.2, 0.0);
      say('odd cycle：cycle 上的 edge 數是奇數', '這種圈沒辦法塗兩種顏色');
    },
  ]);
}]);

// 15:52 BFS 著色 procedure
FRAG.push(['graphjiang2-bip-procedure', 'BFS 著色：L0 紅、L1 藍、L2 紅…', async (tok) => {
  jFresh();
  const LP = { s: [-2.6, 5.6], a: [-4.6, 4.0], b: [-2.6, 4.0], c: [-0.6, 4.0], d: [-5.4, 2.4], e: [-3.6, 2.4], f: [-1.8, 2.4], g: [-0.2, 2.4] };
  const LE = [['s', 'a'], ['s', 'b'], ['s', 'c'], ['a', 'd'], ['a', 'e'], ['b', 'e'], ['b', 'f'], ['c', 'g']];
  let G = null, H = null, ef = null, Ls = [];
  await seq(tok, [
    () => { G = jgGraph(LP, LE, { undirected: true, drop: 2 }); head('給一張 graph：塗紅、藍兩色', 0, 6.75); say('想一個機制，讓塗色成功', '用藍色跟紅色'); },   // 952.0
    () => { note('規則：每條 edge 兩端不同色', 3.6, 5.6); say('重點：每條 edge 的兩端顏色不同', '塗得成 → bipartite'); },   // 981.0
    () => { note('做法：BFS ＋ 塗色', 3.6, 4.9); say('這個 procedure 其實就是 BFS', '只是 BFS 過程中配上塗色'); },   // 997.0
    () => { const h = ghostBox('#8fb8ef', 6.6, 4.6, 0.4); h.position.set(-2.8, 4.0, -0.4); ptr('假設 G 是 connected', -2.8, 1.4); say('先假設這張 graph 是 connected', '讓 procedure 好處理'); },   // 1009.2
    () => {                                           // 1020.8 不是 connected：每個 component 分開塗
      H = jgGraph({ h: [3.4, 3.2], i: [5.2, 3.2], j: [4.3, 1.8] }, [['h', 'i'], ['i', 'j']], { undirected: true, drop: 2 });
      note('不同 component 之間沒有 edge → 分開塗', 3.6, 0.8); say('不是 connected 也沒關係', '每個 connected component 分開著色');
    },
    async () => { const p = pkt('起點？', -6.2, 6.4, 0.5); await travel(tok, p, V3(-6.2, 6.4, 0.5), V3(-2.6, 6.3, 0.5), 900); say('反正每個點都要塗', '隨便選一個點當起點'); },   // 1055.8
    async () => { G.paint('s', JC.red); Ls.push(idx('L0', -6.5, 5.6)); await pulse(tok, G.N.s); say('起點 = BFS 的 source', '先塗成紅色（L0）'); },   // 1068.5
    async () => { for (const k of ['a', 'b', 'c']) { G.paint(k, JC.blue); await beat(tok, 220); } Ls.push(idx('L1', -6.5, 4.0)); say('跟它有 edge 相連的鄰居', '塗成藍色（L1）'); },   // 1083.8
    async () => { for (const k of ['d', 'e', 'f', 'g']) { G.paint(k, JC.red); await beat(tok, 200); } Ls.push(idx('L2', -6.5, 2.4)); say('藍色的鄰居再塗紅色', '反覆這樣做'); },   // 1088.8
    () => { bad('check edge 時塗不成 → 失敗', 3.6, 6.2); say('如果 check edge 時發現塗色不成功', '就失敗'); },   // 1091.8
    () => { good('順利全部塗完 → 成功', 3.6, 6.75); say('如果都順利塗完', '就沒有問題，做完了'); },   // 1097.8
    () => { Ls.forEach((l, i) => txt(l, ['L0 紅', 'L1 藍', 'L2 紅'][i])); say('L0 紅色、L1 藍色、L2 紅色', '依此類推'); },   // 1112.8
    () => {                                           // 1124.0 edge 兩種 case：上下層、同層
      G.all(JC.ok); ef = G.add('e', 'f'); ef.set(JC.orange);
      ptr('同層的 edge', -2.7, 2.95); say('BFS 的 edge 只有兩種', '連接上下兩層，或連接同一層');
    },
    async () => { ef.set(JC.pink); glow(G.N.e, '#7a1010'); glow(G.N.f, '#7a1010'); await pulse(tok, G.N.f); say('另一端已塗色，而且跟我要塗的同色', '就不是 bipartite，結束'); },   // 1144.8
    () => { kill(ef.obj); G.E.pop(); glow(G.N.e, null); glow(G.N.f, null); good('所有 edge 都處理完、都順利 → bipartite', -2.8, 0.6); say('一直 repeat，直到所有 edge 處理完', '都很順利 → bipartite graph'); },   // 1161.5
    async () => {                                     // 1178.8 依著色結果轉成 bipartite 形式
      Ls.forEach(remove);
      await G.morph(tok, { s: [-5.6, 5.2], d: [-4.0, 5.2], e: [-2.4, 5.2], f: [-0.8, 5.2], g: [0.8, 5.2], a: [-4.8, 2.6], b: [-2.4, 2.6], c: [0, 2.6] }, 1400);
      say('根據著色結果', '可以把圖轉成 bipartite graph 的形式');
    },
  ]);
}]);

// 19:47 例子：從 6 開始塗色；實作 = BFS 每層順便著色
FRAG.push(['graphjiang2-bip-example', '例子：從 6 開始，紅藍交替塗色', async (tok) => {
  jFresh();
  let G = null, cp = null;
  await seq(tok, [
    async () => { G = jgGraph(BIP_MESSY, BIP_E, { undirected: true, drop: 2 }); await beat(tok, 300); const p = pkt('random pick', 1.6, 6.4, 0.5); await travel(tok, p, V3(1.6, 6.4, 0.5), V3(-1.2, 2.1, 0.5), 800); say('Random pick 一個點', '就選 6 這個人'); },   // 1189.7
    async () => { G.paint('6', JC.red); await pulse(tok, G.N['6']); say('先把 6 塗成紅色', 'L0'); },   // 1196.8
    async () => { for (const k of ['2', '7']) { G.e('6', k).set(JC.ok); G.paint(k, JC.blue); await beat(tok, 300); } say('6 的鄰居 2、7 塗藍色', 'L1'); },   // 1200.5
    async () => { for (const [u, k] of [['2', '1'], ['2', '4'], ['7', '3']]) { G.e(u, k).set(JC.ok); G.paint(k, JC.red); await beat(tok, 260); } say('藍色的鄰居 1、4、3 塗紅色', 'L2'); },   // 1203.4
    () => { G.e('4', '7').set(JC.hot); note('4 也連回 7：已經塗過了', 1.6, 3.6); say('注意：這些人也有鄰居', '反過來連到已經塗過的人'); },   // 1208.5
    () => { G.e('4', '7').set(JC.ok); good('一紅一藍：safe edge ✓', 1.6, 2.9); say('做 check：另一端已塗、而且顏色相反', '就是 safe 的 edge'); },   // 1221.8
    async () => { G.paint('5', JC.blue); G.all(JC.ok); await pulse(tok, G.N['5']); say('繼續塗：5 塗藍色', '這樣就塗完了'); },   // 1233.4
    () => { good('塗色都很順利 → bipartite', 1.6, 2.2); say('塗的過程都很順利', '所以它是 bipartite graph'); },   // 1238.8
    async () => { await G.morph(tok, BIP_NICE, 1400); say('根據著色結果', '畫成 bipartite graph 的形式'); },   // 1245.8
    () => {                                           // 1268.3 實作：配合 BFS procedure
      cp = code(['BFS(G, s):', '  L0 = {s}；s 塗紅', '  for i = 0, 1, 2, …', '    for u in Li, edge (u, v)：', '      v 沒塗 → 放進 Li+1，塗相反色', '      v 同色 → 不是 bipartite'], 3.4, 6.0, 0.6);
      cp.hl(0); say('怎麼 implement？', '配合 BFS 的 procedure 來完成');
    },
    () => { cp.hl(4); say('原來的 BFS 每一層 label 時', '順便給它著色，就結束了'); },   // 1292.8
  ]);
}]);

// 21:53 正確性證明：Case 1 trivial；Case 2 同層 edge ⇒ odd cycle
FRAG.push(['graphjiang2-bip-proof', '正確性：同層 edge ⇒ odd cycle', async (tok) => {
  jFresh();
  const LA = { s: [-4.4, 5.6], a: [-5.4, 4.1], b: [-3.4, 4.1], c: [-6.0, 2.6], d: [-4.4, 2.6], e: [-2.8, 2.6] };
  const EA = [['s', 'a'], ['s', 'b'], ['a', 'c'], ['a', 'd'], ['b', 'd'], ['b', 'e']];
  const RA = { s: [3.4, 5.6], a: [2.4, 4.1], b: [4.4, 4.1], c: [1.8, 2.6], d: [3.4, 2.6], e: [5.0, 2.6] };
  const ER = [['s', 'a'], ['s', 'b'], ['a', 'c'], ['b', 'd'], ['b', 'e']];
  let L = null, R = null, rr = null, h = null, nt = null, P = null, objs = [];
  const keep = (o) => { objs.push(o); return o; };
  await seq(tok, [
    () => { h = head('這樣塗，所有 case 都會成功嗎？', 0, 6.75); say('例子很小，眼睛看好像會成功', '是不是所有的 case 都會成功？'); },   // 1313.0
    () => { txt(h, 'Proof：紅藍交替著色是對的'); say('要證明這個 procedure 的正確性', ''); },   // 1340.1
    () => {                                           // 1346.8 G connected，BFS 產生 L0、L1…
      L = jgGraph(LA, EA, { undirected: true, drop: 2 });
      for (const [t, y] of [['L0', 5.6], ['L1', 4.1], ['L2', 2.6]]) keep(idx(t, -6.75, y));
      say('G 是 connected graph，做 BFS', '順便產生 L0、L1、L2… 的 labeling');
    },
    () => { nt = note('下面兩件事，一定有一件成立', 0, 0.4); say('要證明：下面兩件事一定有一件成立', ''); },   // 1370.2
    () => { L.all(JC.ok); keep(ptr('(i) 沒有 edge 連同一層 → bipartite', -4.2, 1.5)); say('(i) 沒有 edge 連接同一層的兩個點', '→ 這張 graph 是 bipartite'); },   // 1381.8
    () => {                                           // 1403.6 (ii) 有同層 edge → odd cycle
      R = jgGraph(RA, ER, { undirected: true, drop: 2 }); rr = R.add('d', 'e'); rr.set(JC.pink);
      keep(ptr('(ii) 有同層 edge → 有 odd cycle → 不是', 3.4, 1.5)); say('(ii) 有 edge 連接同一層的兩個點', '→ G 有 odd cycle，不是 bipartite');
    },
    async () => { glow(R.N.d, '#7a1010'); glow(R.N.e, '#7a1010'); await pulse(tok, R.N.e); say('左邊：edge 只連相鄰兩層', '右邊：有一條紅色 edge 連同一層'); },   // 1438.4
    () => { txt(nt, 'BFS property：edge 兩端的 layer 最多差 1'); say('以前證過 BFS 的 property', '任何 edge 兩端的 layer 最多差 1'); },   // 1483.7
    () => { txt(nt, '所以只有兩種：同一層，或相鄰層'); say('要嘛同一層、要嘛相鄰層', '所以分成兩個 case'); },   // 1505.6
    async () => {                                     // 1537.8 Case 1 trivial
      for (const [k, c] of [['s', JC.red], ['a', JC.blue], ['b', JC.blue], ['c', JC.red], ['d', JC.red], ['e', JC.red]]) { L.paint(k, c); await beat(tok, 150); }
      txt(nt, 'Case 1：相鄰層本來就給不同色 → 一定成功'); say('Case 1 很 trivial', '每條 edge 連相鄰層，顏色本來就不同');
    },
    () => {                                           // 1570.5 Case 2：重點
      L.kill(); R.kill(); objs.forEach(remove); objs = [];
      P = jgGraph({ s: [0, 6.1] }, [], { undirected: true }); keep(idx('L0', -5.6, 6.1));
      txt(h, 'Case 2：有同層的 edge'); txt(nt, '要證明：塗不成 two coloring');
      say('重點是 Case 2', '有這種 edge，就塗不成 two coloring');
    },
    () => {                                           // 1591.8 edge (x, y) 在 Lj
      P.addNode('x', -2.6, 2.0, 1.5); P.addNode('y', 2.6, 2.0, 1.5); P.add('x', 'y').set(JC.pink); keep(idx('Lj', -5.6, 2.0));
      say('假設有一條 edge 連 x、y', '兩個點都在同一層 Lj');
    },
    async () => {                                     // 1628.0 沿 BFS tree 往回推到 source
      P.addNode('p', -1.5, 3.4); P.add('p', 'x'); P.addNode('q', 1.5, 3.4); P.add('q', 'y');
      await zip(tok, P, 'x', 'p', '●', 400); await zip(tok, P, 'y', 'q', '●', 400);
      P.addNode('z', 0, 4.7); P.add('z', 'p'); P.add('z', 'q'); P.add('s', 'z').set(JC.gray);
      await zip(tok, P, 'p', 'z', '●', 400);
      say('沿著 BFS tree 往回推到 source', '兩條路會在某處匯集');
    },
    async () => { glow(P.N.z, GOLD); keep(ptr('z：lowest common ancestor', 2.9, 4.9)); await pulse(tok, P.N.z); say('最早遇到的共同祖先叫 z', 'lowest common ancestor'); },   // 1648.5
    () => { txt(nt, '每一段其實是一條 path（一條或數條 edge）'); say('x 回到 z、y 回到 z', '可能是一條 edge，也可能是數條'); },   // 1697.8
    () => { keep(idx('Li', -5.6, 4.7)); say('假設 z 所在的 layer 是 Li', ''); },   // 1712.8
    () => { for (const [u, v] of [['x', 'y'], ['y', 'q'], ['q', 'z'], ['z', 'p'], ['p', 'x']]) P.e(u, v).set(JC.hot); txt(nt, 'cycle：x → y → z → x'); say('找到一個 cycle', 'x 到 y、y 到 z、z 再回到 x'); },   // 1718.8
    () => { keep(idx('1 條', 0, 1.55)); say('數一數 edge：x–y 是 1 條', ''); },   // 1735.8
    () => { keep(idx('j − i 條', 1.9, 2.9)); keep(idx('j − i 條', -1.9, 2.9)); say('y 到 z、z 到 x：layer 相減', '各是 j − i 條'); },   // 1738.8
    () => { txt(nt, '1 + 2(j − i) = 奇數'); say('同樣的數字有兩份 → 偶數', '偶數再加 1 → 奇數'); },   // 1748.8
    () => { keep(bad('odd cycle → 不是 bipartite', 3.6, 6.1)); say('Case 2 一定存在 odd cycle', '所以不是 bipartite graph'); },   // 1766.8
  ]);
}]);

// 29:39 延伸：k-coloring、NP-complete、先進製程 mask 的多次曝光
FRAG.push(['graphjiang2-coloring-mask', 'Coloring 延伸：mask 拆成兩、三、四次曝光', async (tok) => {
  jFresh();
  let K0 = null, nt = null, pal = [], PG = null;
  const PP = { P1: [-5.4, 4.8], P2: [-4.0, 3.5], P3: [-2.5, 4.8], P4: [-1.0, 3.5], P5: [-2.5, 2.2] };
  const PE = [['P1', 'P2'], ['P2', 'P3'], ['P3', 'P4'], ['P4', 'P5'], ['P5', 'P3']];
  const PC = { red: JC.red, blue: JC.blue, green: JC.green, yellow: JC.yellow };
  await seq(tok, [
    () => {                                           // 1778.8 bipartite test = two coloring
      K0 = jgGraph({ a: [-4.6, 5.0], b: [-2.6, 5.0], c: [-3.6, 3.4], d: [-1.6, 3.4] }, [['a', 'b'], ['a', 'c'], ['b', 'c'], ['b', 'd'], ['c', 'd']], { undirected: true, drop: 2 });
      pal.push(cube('', PC.red, [0.5, 0.5, 0.3], 1.6, 6.3, 0), cube('', PC.blue, [0.5, 0.5, 0.3], 2.3, 6.3, 0));
      nt = note('測 bipartite = two coloring', 4.6, 6.3); say('BFS 的 application：測 bipartite', '等同於做 two coloring');
    },
    () => { pal.push(cube('', PC.green, [0.5, 0.5, 0.3], 3.0, 6.3, 0, 1)); txt(nt, '3、4、5 種顏色？'); say('延伸：塗三種、四種、五種顏色', '難度瞬間變很高'); },   // 1799.8
    () => { bad('3-coloring 能不能成功：NP-complete', 3.2, 5.2); say('一張圖能不能塗成三色', '是 NP-complete 的困難問題'); },   // 1815.6
    async () => {                                     // 1827.8 coloring problem：edge 兩端不同色
      for (const [k, c] of [['a', PC.red], ['b', PC.blue], ['c', PC.green], ['d', PC.red]]) { K0.paint(k, c); await beat(tok, 220); }
      K0.all(JC.ok); note('coloring problem：每條 edge 兩端不同色', -3.1, 2.2);
      say('每個點塗三色之一', '所有 edge 的兩端都要不同色');
    },
    () => { ptr('4-coloring：planar graph 上做得到', 3.2, 4.3); idx('planar：攤在平面上，edge 不交錯', 3.2, 3.7); say('Planar graph：攤平後 edge 都不交錯', '在它上面 four coloring 做得到'); },   // 1851.8
    () => { bad('3-coloring 在 general graph 很難', 3.2, 2.9); say('但 three coloring 在 general graph', '是很難做到的'); },   // 1872.8
    () => {                                           // 1881.8 VLSI：foundry 做 mask
      jFresh(); icon('🏭', 'foundry（TSMC、UMC…）', 4.6, 4.8); nt = head('應用：先進製程的 mask', 0, 6.75);
      say('應用：先進製程', 'foundry 生產 mask 的時候');
    },
    async () => {                                     // 1910.8 polygon 太小
      for (const k in PP) { cube('', '#8a94a6', [1.25, 0.5, 0.12], PP[k][0], PP[k][1], -0.35, 1.5); await beat(tok, 120); }
      note('圖形（polygon）太小、太靠近', -3.2, 1.0); say('Mask 上的 polygon 尺寸太小', '很難單次曝光就曝完一整層');
    },
    () => { icon('💡', '單次曝光', 4.6, 2.2, 0, 'sm'); for (const [u, v] of PE) bad('↔', (PP[u][0] + PP[v][0]) / 2, (PP[u][1] + PP[v][1]) / 2); say('光的能力有限', '距離小於極限的 polygon 曝不出來'); },   // 1956.8
    () => { ptr('一層 mask 拆成兩次曝光（再來三次、四次）', 0, 6.15); say('比較貴的辦法：一層拆成兩次曝光', '或三次、四次'); },   // 1974.8
    () => { icon('💰', '每多一次，錢就 double', 4.6, 0.2, 0, 'sm'); say('每多曝一次，錢就 double', 'mask 很貴'); },   // 1991.8
    () => { PG = jgGraph(PP, [], { undirected: true, size: 0.55, r: 0.35, drop: 1.2 }); say('Model 成 graph', '每個小圖形 = 一個 node'); },   // 2016.8
    async () => { for (const [u, v] of PE) { PG.add(u, v).set(JC.hot); await beat(tok, 150); } say('兩個圖形太靠近', '就畫一條 edge'); },   // 2023.8
    async () => { for (const [k, c] of [['P1', PC.red], ['P2', PC.blue], ['P3', PC.red]]) { PG.paint(k, c); await beat(tok, 250); } good('two colorable → 兩次曝光', -3.2, 0.3); say('做 two coloring 測試', '塗得成 → 拆成兩組，兩次曝光'); },   // 2042.4
    async () => { PG.paint('P4', PC.blue); await beat(tok, 300); PG.paint('P5', '#7a1010'); await beat(tok, 400); PG.paint('P5', PC.green); bad('常有 odd cycle → 改塗三色', -0.2, 1.3); say('兩種顏色常常失敗：odd cycle', '多花點錢：塗三種顏色'); },   // 2059.8
    () => { cube('', PC.yellow, [0.5, 0.5, 0.3], 1.2, 5.0, 0, 1.5); note('最近：四種顏色（四次曝光）', 2.6, 4.3); say('最近 paper：可以塗四種顏色', '口袋夠深就繼續掏錢'); },   // 2074.8
    () => { good('graph 形式單純，應用很廣', 0, 6.15); say('看起來簡單的 graph 問題', '能處理完全不相干的實際問題'); },   // 2089.6
  ]);
}]);

// 35:21 Directed graph 的 connectivity
FRAG.push(['graphjiang2-dir-connect', 'Directed graph：從 1 出發永遠到不了 2、3', async (tok) => {
  jFresh();
  let G = null, h = null, nb = null, nt = null, hz = null;
  await seq(tok, [
    () => { G = jgGraph(D7_P, D7_E, { drop: 2 }); h = head('Directed graph 的 connectivity', 0, 6.75); say('接下來探討 directed graph', '上面的 connectivity'); },   // 2120.8
    () => { jgGraph({ u: [4.4, 6.0], v: [6.2, 6.0] }, [['u', 'v']], { undirected: true, size: 0.5, r: 0.3 }); note('undirected：edge 雙向', 5.3, 5.3); say('Undirected：edge 是雙向的', '只要看 connected component'); },   // 2125.8
    () => { note('directed：有方向，要求更嚴', 5.3, 4.6); say('Directed graph 比較困難', 'edge 有方向性'); },   // 2157.8
    async () => { G.e('2', '3').set(JC.ok); await zip(tok, G, '2', '3'); nb = good('2 → 3 ✓', -4.6, 6.3); say('2 到 3 有一條 edge', '2 可以 reach 到 3'); },   // 2174.8
    async () => {                                     // 2192.0 3 可以 reach 到 2 嗎？
      const p = pkt('?', -6.2, 2.6, 0.5); await travel(tok, p, V3(-6.2, 2.6, 0.5), V3(-6.2, 4.0, 0.5), 500); await travel(tok, p, V3(-6.2, 4.0, 0.5), V3(-6.2, 2.6, 0.5), 400); remove(p);
      nt = bad('3 → 2？要有一條 path', -4.6, 0.6); say('但 3 可不可以 reach 到 2？', '要找一條從 3 到 2 的 path');
    },
    () => { txt(nt, '兩個方向都有 path → 才算 connected'); say('Directed graph 要判定兩種方向', '都有 path 才算 connected'); },   // 2204.7
    () => { glow(G.N['1'], GOLD); ptr('1 的兩條 list', 5.3, 3.7); idx('out → 4, 5', 5.3, 3.1); idx('in ← 2, 3, 7', 5.3, 2.5); say('常同時需要射出、射進的 edge', '每個 vertex maintain 兩條 list'); },   // 2255.8
    () => { glow(G.N['1'], null); note('BFS／DFS 只能順著 edge 方向走', 5.0, 1.7); say('做 BFS、DFS 要講究方向', '順著 edge 的方向才看得到對方'); },   // 2285.7
    async () => { G.paint('1', JC.ok); await pulse(tok, G.N['1']); txt(h, 'BFS from 1'); say('例子：從 1 開始 traversal', ''); },   // 2309.7
    async () => { for (const k of ['4', '5']) { G.e('1', k).set(JC.ok); await zip(tok, G, '1', k, '●', 350); G.paint(k, JC.ok); } say('第一層 reach 到 4、5', ''); },   // 2321.8
    async () => { G.e('4', '6').set(JC.ok); await zip(tok, G, '4', '6', '●', 400); G.paint('6', JC.ok); say('接下來 reach 到 6', ''); },   // 2327.8
    async () => { G.e('6', '7').set(JC.ok); await zip(tok, G, '6', '7', '●', 400); G.paint('7', JC.ok); say('再做：reach 到 7', ''); },   // 2330.9
    () => { hz = ghostBox('#8fb8ef', 10.0, 5.6, 0.4); hz.position.set(-1.3, 3.6, -0.4); txt(h, '猛然一看：7 個點連在一起？'); say('猛然一看', '這七個點好像是 connected'); },   // 2339.8
    () => { kill(hz); for (const k of ['2', '3']) glow(G.N[k], '#7a1010'); txt(nt, '從 1 出發永遠看不到 2、3'); say('講究方向：從 1 出發不管怎麼走', '永遠看不到 2 和 3'); },   // 2349.8
    () => { txt(h, 'edge 的方向對 connectivity 影響很大'); say('Edge 的方向', '對 connectivity 的影響很大'); },   // 2359.3
  ]);
}]);

// 39:26 Strong connectivity：mutually reachable、strongly connected、SCC
FRAG.push(['graphjiang2-strong-def', 'Strong connectivity：可去可回', async (tok) => {
  jFresh();
  let u = null, v = null, h = null, g1 = null, R = null, b1 = null;
  const T = [V3(-5.3, 3.3, 0.3), V3(-4.3, 4.6, 0.3), V3(-3.1, 4.6, 0.3), V3(-2.1, 3.3, 0.3)];
  const B = [V3(-2.1, 2.0, 0.3), V3(-3.1, 0.7, 0.3), V3(-4.3, 0.7, 0.3), V3(-5.3, 2.0, 0.3)];
  const path = (pts, c) => { for (let i = 0; i + 1 < pts.length; i++) arrow(pts[i], pts[i + 1], c); for (const p of pts.slice(1, -1)) cube('', c, [0.28, 0.28, 0.28], p.x, p.y, 0.3); };
  const ride = async (pts, t) => { const p = pkt(t, pts[0].x, pts[0].y, 0.6); for (let i = 0; i + 1 < pts.length; i++) await travel(tok, p, pts[i], pts[i + 1], 330); remove(p); };
  await seq(tok, [
    () => { h = head('Strong connectivity', 0, 6.75); u = buddy('u', '', '#9fb8ff', -5.8, 2.1, 0.4, 0.55); v = buddy('v', '', '#f4a56a', -1.6, 2.1, 0.4, 0.55); say('Directed graph 考慮的 connectivity', '叫 strong connectivity'); },   // 2365.8
    () => { note('雙向：mutually reachable', -3.7, 5.6); say('要求雙向', '互相都到得了：mutually reachable'); },   // 2383.8
    async () => { path(T, JC.blue); u.look(1); await ride(T, 'u'); v.mood('happy'); say('u 有一條 path 可以到達 v', ''); },   // 2397.8
    async () => { path(B, JC.orange); v.look(-1); await ride(B, 'v'); u.mood('happy'); say('同時 v 也有一條 path 回到 u', '走過去又走得回來'); },   // 2414.8
    async () => { g1 = good('u、v：strongly connected', -3.7, -0.2); await u.hop(tok); say('可去可回', '這兩點才是 strongly connected'); },   // 2431.8
    () => {                                           // 2437.8 graph strongly connected：任兩點 mutually reachable
      R = jgGraph({ a: [2.2, 5.0], b: [4.6, 5.0], c: [4.6, 2.6], d: [2.2, 2.6] }, [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'a'], ['a', 'c']], { drop: 2 });
      b1 = good('任兩點都 mutually reachable → strongly connected', 3.4, 6.1); say('整張 directed graph strongly connected：', '任兩點之間都 mutually reachable');
    },
    () => { R.addNode('e', 6.2, 1.0, 1.5); R.add('c', 'e').set(JC.pink); glow(R.N.e, '#7a1010'); remove(b1); b1 = bad('e 回不去 → 整張不是 strongly connected', 3.4, 6.1); say('如果有些點沒辦法互相到達', '整張圖就不是 strongly connected'); },   // 2458.8
    () => { txt(h, '大部分 directed graph 都是這樣'); say('一般來說大部分 directed graph', '都是這種狀況'); },   // 2489.8
    () => {                                           // 2498.8 拆成幾部分，每部分自己 strongly connected
      const g = ghostBox('#2fc092', 3.6, 3.6, 0.4); g.position.set(3.4, 3.8, -0.4);
      const g2 = ghostBox('#e55a9b', 1.3, 1.3, 0.4); g2.position.set(6.2, 1.0, -0.4);
      R.paint('a', JC.ok); R.paint('b', JC.ok); R.paint('c', JC.ok); R.paint('d', JC.ok); R.paint('e', JC.pink);
      say('可以把 directed graph 拆成幾部分', '每部分自己是 strongly connected');
    },
    () => { txt(h, 'Strongly connected component（SCC）'); ptr('SCC', 3.4, 1.6); ptr('SCC', 6.2, 0.1); say('這些部分叫', 'strongly connected component'); },   // 2514.8
  ]);
}]);

// 42:15 Lemma：mutually reachable 是 transitive；SCC 要 maximal
FRAG.push(['graphjiang2-transitive', 'Lemma：可去可回會傳遞；SCC 要最大', async (tok) => {
  jFresh();
  const X = { u: -5.4, v: -1.0, w: 3.4 }, Y = 2.0;
  let B = {}, nt = null, halo = null, msg = null;
  const ring = (x0, x1) => { if (halo) kill(halo); halo = ghostBox('#2fc092', x1 - x0, 2.6, 0.5); halo.position.set((x0 + x1) / 2, 2.4, -0.5); };
  const go = async (xs, up) => { const p = pkt('●', xs[0], Y + 0.6, 0.6); for (let i = 0; i + 1 < xs.length; i++) { const m = V3((xs[i] + xs[i + 1]) / 2, Y + 0.6 + up * 1.4, 0.6); await travel(tok, p, V3(xs[i], Y + 0.6, 0.6), m, 280); await travel(tok, p, m, V3(xs[i + 1], Y + 0.6, 0.6), 280); } remove(p); };
  await seq(tok, [
    () => { head('Lemma：很簡單，但很重要', 0, 6.75); for (const k in X) B[k] = buddy(k, '', { u: '#9fb8ff', v: '#f4a56a', w: '#7cd1a8' }[k], X[k], Y - 0.3, 0.3, 0.55); say('一個很容易想像、也很容易證明的 lemma', '雖然簡單，但很重要'); },   // 2535.0
    () => { nt = note('transitive（遞移）', 0, 6.1); say('它講的是 transitive 的概念', ''); },   // 2546.0
    () => { ptr('u ⇄ v', -3.2, 5.4); say('u 和 v 是 mutually reachable', ''); },   // 2548.8
    () => { ptr('v ⇄ w', 1.2, 5.4); say('v 和 w 也是 mutually reachable', ''); },   // 2551.0
    () => { ptr('⇒ u ⇄ w ?', 5.2, 5.4); say('那 u 和 w 就是 mutually reachable', ''); },   // 2554.8
    () => { arcEdge(X.u + 0.5, X.v - 0.5, Y + 0.3, JC.blue, 1); arcEdge(X.v - 0.5, X.u + 0.5, Y + 0.2, JC.blue, -1); say('畫圖：u、v 之間有 path 過去', '也有 path 回來'); },   // 2562.8
    () => { arcEdge(X.v + 0.5, X.w - 0.5, Y + 0.3, JC.green, 1); arcEdge(X.w - 0.5, X.v + 0.5, Y + 0.2, JC.green, -1); say('v、w 之間也一樣', '有 path 過去、有 path 回來'); },   // 2569.8
    async () => { await go([X.u, X.v, X.w], 1); await go([X.w, X.v, X.u], -1); msg = good('u ⇄ w ✓（經過 v）', -1.0, 0.0); B.u.mood('happy'); B.w.mood('happy'); say('併在一起：u 經過 v 到 w', 'w 也經過 v 回到 u'); },   // 2577.0
    () => { ring(-6.4, 4.4); txt(nt, '用 transitive 找出 strongly connected component'); say('它是 transitive 的', '透過它可以找 strongly connected component'); },   // 2589.4
    () => { txt(nt, '跟 connected component 一樣：要最大（maximal）'); say('跟 connected component 很類似', '考慮的是最大的形式'); },   // 2602.0
    () => { ring(-6.4, 0.0); remove(msg); msg = note('不是只看一小撮人', -3.2, 0.0); say('不是只看一小撮人', '彼此是不是 mutually reachable'); },   // 2622.4
    () => {                                           // 2628.8 maximal：再加一點就破壞
      cube('x', JC.gray, [0.7, 0.7, 0.6], 6.2, 4.6, 0, 1.5); arrow(V3(X.w + 0.5, Y + 0.9, 0), V3(5.8, 4.3, 0), JC.pink);
      ring(-6.4, 4.4); remove(msg); msg = good('{u, v, w}：再加 x 就破壞 → maximal', -1.0, 0.0);
      say('Maximal：不管再多加哪一個點', '都會破壞「任兩點 mutually reachable」');
    },
    () => { ring(-6.4, 0.0); remove(msg); msg = bad('{u, v}：還能加 w → 不是 SCC', -3.2, 0.0); say('如果還能再加一個點', '還維持 mutually reachable，就不是 SCC'); },   // 2648.2
  ]);
}]);

// 44:20 Linear time 判定 strongly connected：G 上 BFS ＋ G^rev 上 BFS
FRAG.push(['graphjiang2-sc-test', '判定 strongly connected：G 與 G^rev 各做一次 BFS', async (tok) => {
  jFresh();
  let G = null, h = null, n1 = null, n2 = null, bfs = null;
  const reset = () => { for (const k in G.N) { G.paint(k, JC.node); glow(G.N[k], null); } };
  await seq(tok, [
    () => { G = jgGraph(SC_P, SC_E, { drop: 2 }); h = head('這張 directed graph 是 strongly connected 嗎？', 0, 6.75); bfs = buddy('BFS', '', '#7cd1a8', 5.6, -0.6, 0.4, 0.5); say('給定一個 directed graph', '判定它本身是不是 strongly connected'); },   // 2660.4
    () => { note('希望 linear time', 4.3, 6.05); say('而且希望在 linear time 判定', '其實是可以的'); },   // 2683.8
    () => { note('做法：run 兩次 BFS', 4.3, 5.45); say('Run 兩次 BFS 就可以確定', ''); },   // 2692.8
    async () => { glow(G.N.s, GOLD); n1 = note('若是 strongly connected：任選 s，BFS 一定走到所有人', -2.6, 0.5); await zip(tok, G, 's', 'a'); say('如果是 strongly connected', '任選一點 s 做 BFS，一定 reach 到所有人'); },   // 2724.8
    () => { ptr('R：s 走得到誰', 4.3, 4.6); say('做完就知道', '從 s 出發可以 reach 到哪些人'); },   // 2764.0
    () => { txt(n1, '還差一個方向：大家走得回 s 嗎？'); say('還差一個方向', '對方也要走得回來'); },   // 2769.8
    () => { n2 = bad('笨方法：每個人都做一次 BFS', -2.6, -0.1); bfs.mood('sad'); say('笨方法：到達的每個人都做一次 BFS', '這樣有點太笨了'); },   // 2781.8
    async () => {                                     // 2796.8 Run 1：G 上從 s 做 BFS → R
      remove(n2); bfs.mood('happy'); txt(h, 'Run 1：在 G 上從 s 做 BFS');
      const R = await wave(tok, G, 's', JC.ok, 320); idx('R = {' + R.join(', ') + '}', 4.3, 3.7);
      say('第一步：從 s 出發對 G 做 BFS', 'reach 到的人存在 set R');
    },
    async () => {                                     // 2816.6 產生 G^rev：點一樣，edge 全翻轉
      reset(); G.all(JC.edge); await anim(tok, 600, () => {}); G.flip(); G.all(JC.purple);
      txt(h, 'G^rev：點一模一樣，edge 箭頭全部翻轉'); say('誰走得回來？產生 G 的 reverse', '點都一樣，edge 箭頭全部翻轉');
    },
    async () => {                                     // 2845.8 原來 d → s 的 path，翻轉後變 s → d
      for (const [a, b] of [['s', 'b'], ['b', 'a'], ['a', 'd']]) { G.e(a, b).set(JC.hot); await zip(tok, G, a, b, '●', 330); }
      txt(n1, '原本 d → a → b → s，翻轉後是 s → b → a → d'); say('原本走回 s 的路', '在翻轉的圖上變成從 s 走過去');
    },
    async () => {                                     // 2875.8 Run 2：G^rev 上從 s 做 BFS → R^rev
      G.all(JC.purple); txt(h, 'Run 2：在 G^rev 上從 s 做 BFS');
      const R = await wave(tok, G, 's', JC.purple, 320); idx('R^rev = {' + R.join(', ') + '}', 4.3, 3.1);
      say('在翻轉的 graph 上一樣從 s 做 BFS', 'R^rev = 哪些人可以走回 s');
    },
    () => { idx('V = {s, a, b, c, d}', 4.3, 2.5); txt(n1, '檢查：R = R^rev = V ？'); say('確認 R、R^rev 兩個 set', '是不是都剛好等於 vertex set V'); },   // 2893.8
    async () => { good('三個一模一樣 → strongly connected ✓', -2.6, -0.1); await bfs.hop(tok); say('三個完全一樣', '這張 graph 就是 strongly connected'); },   // 2911.8
    () => { idx('① BFS：O(n + m)', 4.3, 1.7); say('這個判定是 linear time', 'BFS 是 linear time'); },   // 2919.4
    () => { idx('② 產生 G^rev：O(n + m)', 4.3, 1.15); say('產生翻轉的 graph', '也是 linear time'); },   // 2924.0
    () => { idx('③ G^rev 上 BFS：O(n + m)', 4.3, 0.6); say('在翻轉的 graph 上做 BFS', 'linear time'); },   // 2929.8
    () => { idx('④ 比對 set：scan 一次', 4.3, 0.05); say('判定是不是一樣：一個一個數人頭', 'scan 一次，也是 linear time'); },   // 2933.4
    () => { txt(h, '總時間 O(n + m)'); say('所以時間複雜度', '在 O(n + m)'); },   // 2941.8
    () => {                                           // 2953.6 正確性：第一次 BFS 的紅色 path
      G.flip(); reset(); G.all(JC.edge); txt(h, '為什麼對？（回到原來的 G）');
      for (const [a, b] of [['s', 'a'], ['a', 'c'], ['c', 'd']]) G.e(a, b).set(JC.red);
      txt(n1, '第一次 BFS：紅色 path，s 走得到 d'); say('第一次 BFS：從 s 出發', '紅色 path 可以到達的人');
    },
    async () => { for (const [a, b] of [['d', 'a'], ['a', 'b'], ['b', 's']]) { G.e(a, b).set(JC.blue); await zip(tok, G, a, b, '●', 300); } txt(n1, '第二次要找：誰走得回 s（藍色 d → a → b → s）'); say('第二次要找的是', '有哪些人可以走回 s'); },   // 2972.8
    async () => { await anim(tok, 300, () => {}); G.flip(); txt(n1, '翻轉後：藍色 path 變成 s → b → a → d'); say('把 edge 全部翻轉', '這條 path 就變成從 s 走到 d'); },   // 2986.8
    () => { txt(n1, '所以在 G^rev 上做 BFS，再比對兩個 set'); say('所以在翻轉的 graph 上做 BFS', '再測試兩個 set 是不是一樣'); },   // 3008.1
    () => { txt(h, '相關問題：拆成 strongly connected components'); say('相關問題：給一個 directed graph', '拆成一些 strongly connected component'); },   // 3014.8
    () => { txt(n1, '這門課沒教 procedure；記得要拆成最大的'); say('這門課沒有探討怎麼做', '記得要拆成最大的形式'); },   // 3027.1
    async () => { good('複雜度一樣：O(n + m)（標準做法：Kosaraju 兩次 DFS）', -2.6, -0.7); await bfs.hop(tok); say('複雜度跟這個一樣', '老師：兩次 DFS 或兩次 BFS；標準是 Kosaraju 的兩次 DFS'); },   // 3046.8
  ]);
}]);

// ═════════════ Lec09（OQDaruIDCjY） ═════════════
const ordTag = (G, k, n) => head(String(n), G.P[k][0], G.P[k][1] + 0.78);
const indeg = (G) => { const d = {}; for (const k in G.N) d[k] = 0; for (const ed of G.E) d[ed.v]++; return d; };
function inTags(G, d) { const T = {}; for (const k in G.N) T[k] = idx(d ? 'in ' + d[k] : '', G.P[k][0] + 0.7, G.P[k][1] + 0.48); return T; }
// put the nodes on a row in `ord` order and redraw every edge as an arc above the row
async function lineUp(tok, G, ord, o = {}) {
  const y = o.y ?? 1.0, x0 = o.x0 ?? -6.0, dx = o.dx ?? 1.9;
  const E = G.E.map((e) => [e.u, e.v]); G.E.forEach((e) => kill(e.obj)); G.E = [];
  const Q = {}; ord.forEach((k, i) => { Q[k] = [x0 + i * dx, y]; });
  await G.morph(tok, Q, o.ms ?? 1300);
  const at = (k) => x0 + ord.indexOf(k) * dx;
  return E.map(([u, v]) => arcEdge(at(u) + 0.2, at(v) - 0.2, y + 0.1, o.color || JC.ok, 1));
}
// the container S (a queue or a stack) on the right
function sBox(x = 5.7) {
  const g = ghostBox('#9fb8ff', 1.3, 4.6, 0.6); g.position.set(x, 2.9, -0.5); ptr('S', x, 5.55);
  const S = { list: [], c: {} };
  const put = (k, i, drop) => cube(k, JC.hot, [0.8, 0.6, 0.5], x, 1.0 + i * 0.75, 0, drop);
  S.push = (k) => { S.c[k] = put(k, S.list.length, 1.5); S.list.push(k); };
  S.pop = (k) => { kill(S.c[k]); delete S.c[k]; S.list.splice(S.list.indexOf(k), 1); S.list.forEach((q, i) => { kill(S.c[q]); S.c[q] = put(q, i, 0); }); };
  return S;
}
// remove v from the picture (conceptually): dim it and its out-edges
const dimNode = (G, k) => { G.paint(k, JC.dim); for (const ed of G.E) if (ed.u === k) ed.set(JC.dim); };

// 00:44 回顧：strong connectivity 與 transitive lemma
FRAG.push(['graphjiang2-l9-review', '回顧：mutually reachable、strong connectivity', async (tok) => {
  jFresh();
  let u = null, v = null, w = null, nt = null, h = null;
  await seq(tok, [
    () => { jgGraph({ a: [-6.0, 5.6], b: [-4.0, 5.6] }, [['a', 'b']], { undirected: true, size: 0.55, r: 0.35, drop: 1.5 }); good('undirected：有 path 就 connected', -5.0, 4.7); say('Undirected graph：有 edge 相連', '兩點之間有 path 就是 connected'); },   // 44.0
    () => { u = buddy('u', '', '#9fb8ff', -4.6, 1.3, 0.4, 0.55); v = buddy('v', '', '#f4a56a', 0, 1.3, 0.4, 0.55); arcEdge(-4.1, -0.5, 1.9, JC.blue, 1); nt = note('directed：path 有方向', -2.3, 4.6); say('Directed graph：edge 有方向性', '要討論 path 的方向'); },   // 61.5
    async () => {                                     // 73.8 u→v 與 v→u 都要存在
      arcEdge(-0.5, -4.1, 1.8, JC.orange, -1);
      const p = pkt('●', -4.1, 2.6, 0.6); await travel(tok, p, V3(-4.1, 2.6, 0.6), V3(-2.3, 3.6, 0.6), 300); await travel(tok, p, V3(-2.3, 3.6, 0.6), V3(-0.5, 2.6, 0.6), 300);
      await travel(tok, p, V3(-0.5, 1.5, 0.6), V3(-2.3, 0.3, 0.6), 300); await travel(tok, p, V3(-2.3, 0.3, 0.6), V3(-4.1, 1.5, 0.6), 300); remove(p);
      say('要 u 到 v 的 path', '也要 v 回到 u 的 path');
    },
    () => { txt(nt, 'mutually reachable（可去可回）'); u.mood('happy'); v.mood('happy'); say('兩條都存在', '才說 u、v 是 mutually reachable'); },   // 85.8
    () => { h = head('Strong connectivity', 0, 6.75); say('這種可去可回的 connectivity', '叫 strong connectivity'); },   // 97.5
    () => { jgGraph({ a: [2.6, 5.8], b: [4.6, 5.8], c: [4.6, 4.1], d: [2.6, 4.1] }, [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'a']], { size: 0.55, r: 0.35, drop: 1.5, color: JC.green }); ptr('strongly connected：任兩點都可去可回', 3.6, 3.25); say('Directed graph 是 strongly connected：', '任何兩點之間都 mutually reachable'); },   // 119.8
    () => { w = buddy('w', '', '#7cd1a8', 4.6, 1.3, 0.4, 0.55); txt(h, 'Lemma：strong connectivity 是 transitive'); say('這個性質是 transitive 的效應', ''); },   // 132.3
    async () => { arcEdge(0.5, 4.1, 1.9, JC.green, 1); arcEdge(4.1, 0.5, 1.8, JC.green, -1); txt(nt, 'u ⇄ v，v ⇄ w ⇒ u ⇄ w'); w.mood('happy'); await w.hop(tok); say('u、v 可去可回，v、w 也可去可回', '推得 u、w 也 mutually reachable'); },   // 156.8
  ]);
}]);

// 03:00 Linear time 判定 strongly connected（回顧）
FRAG.push(['graphjiang2-l9-sctest', '判定 strongly connected：BFS on G 與 G^rev', async (tok) => {
  jFresh();
  let G = null, h = null, n1 = null, bfs = null;
  const reset = () => { for (const k in G.N) { G.paint(k, JC.node); glow(G.N[k], null); } };
  await seq(tok, [
    () => { G = jgGraph(SC_P, SC_E, { drop: 2 }); h = head('給一個 directed graph：是 strongly connected 嗎？', 0, 6.75); bfs = buddy('BFS', '', '#7cd1a8', 5.6, -0.6, 0.4, 0.5); say('給定一個 directed graph', '很快判定它是不是 strongly connected'); },   // 180.0
    () => { note('linear time：掃過 graph 少數幾次', 4.0, 6.05); say('多快？希望是 linear time', '掃過這個 graph 一兩次就判定'); },   // 200.0
    () => { note('用 BFS（換 DFS 也一樣）', 4.0, 5.45); say('Procedure 利用 BFS 的特性', '用 DFS 其實也一樣'); },   // 217.2
    () => { n1 = note('若是 strongly connected：任兩點都 mutually reachable', -2.6, 0.5); say('概念：如果它是 strongly connected', '任兩點之間都 mutually reachable'); },   // 234.0
    async () => { glow(G.N.s, GOLD); await zip(tok, G, 's', 'a'); txt(n1, '任選一點 s 當起點做 BFS → 一定 reach 到所有人'); say('任選一點當起點做 BFS', '一定 reach 到剩下所有的人'); },   // 263.8
    async () => { const R = await wave(tok, G, 's', JC.ok, 300); idx('R = {' + R.join(', ') + '}', 4.3, 3.7); say('s 可以 reach 到的人', '收集在一個 set R 裡'); },   // 281.8
    () => { idx('V = {s, a, b, c, d}', 4.3, 2.5); txt(n1, '第一個要求：R 要包含所有的點（= V）'); say('第一個要求', '收集到的點一定要包含所有的點'); },   // 295.8
    () => { txt(n1, '還不夠：大家也要走得回 s'); say('這樣還不夠：要 mutually reachable', '剩下的人也要走得回來'); },   // 302.8
    () => { for (const [a, b] of [['s', 'a'], ['a', 'b'], ['a', 'c'], ['c', 'd']]) G.e(a, b).set(JC.red); say('第一次 BFS：透過紅色 path', 's 到達剩下所有的點'); },   // 319.8
    () => { txt(n1, '剩下的點，有路可以回 s 嗎？'); say('接下來要測：剩下的點', '是不是有路可以走回 s'); },   // 334.8
    () => { bad('每個點都再做一次 BFS：太多次，不是 linear', -2.6, -0.1); bfs.mood('sad'); say('從每個點出發都做一次 BFS？', '太多次了，到不了 linear time'); },   // 342.8
    () => { bfs.mood('calm'); txt(n1, '小 trick：把所有 edge 都反向'); say('反過來想，做個小小的 trick', '把所有 edge 都做反向'); },   // 360.3
    async () => { G.all(JC.edge); for (const [a, b] of [['d', 'a'], ['a', 'b'], ['b', 's']]) { G.e(a, b).set(JC.blue); await zip(tok, G, a, b, '●', 300); } txt(n1, '假設 d 有藍色 path 走回 s：d → a → b → s'); say('假設某個點 u（這裡是 d）', '有一條藍色 path 可以走回 s'); },   // 379.8
    async () => { await anim(tok, 300, () => {}); G.flip(); txt(n1, 'edge 全反向後：藍色 path 變成 s → b → a → d'); say('把所有 edge 反向之後', '這條藍色 path 變成從 s 走到 d'); },   // 394.8
    () => { txt(n1, '所以在反向圖上做一次 BFS，就收集到所有走得回 s 的人'); say('在反向圖上做一次 BFS', '就能收集所有走得回 s 的人'); },   // 416.8
    () => { reset(); G.all(JC.purple); txt(h, 'G^rev：所有 edge 反向的 reverse graph'); say('第二次先把 G 的 edge 全部反向', '叫 reverse graph'); },   // 442.8
    async () => { const R = await wave(tok, G, 's', JC.purple, 300); idx('R^rev = {' + R.join(', ') + '}', 4.3, 3.1); say('在反向圖上再 run 一次 BFS', '走得回來的人收集到另一個 set'); },   // 455.7
    () => { txt(n1, 'R^rev 也一定要等於 V'); say('如果是 strongly connected', '走得回來的人也一定要等於 V'); },   // 466.8
    async () => { good('R = R^rev = V → strongly connected ✓', -2.6, -0.1); bfs.mood('happy'); await bfs.hop(tok); say('走出去的、走回來的都跟 V 一樣', '三者相等 → strongly connected'); },   // 484.8
    () => { txt(h, 'BFS 的作用：把到得了的人收集起來（DFS 也行）'); say('BFS 只是用來收集到得了的人', '換成 DFS 也可以'); },   // 517.8
  ]);
}]);

// 09:01 Strong component：一定要 maximal
FRAG.push(['graphjiang2-l9-scc-def', 'Strong component：長到最大（maximal）', async (tok) => {
  jFresh();
  const P = { s: [-4.4, 4.8], b: [-2.0, 4.8], c: [-3.2, 2.6], d: [0.4, 3.0], e: [3.2, 4.8] };
  const E = [['s', 'b'], ['b', 'c'], ['c', 's'], ['b', 'd'], ['d', 'c'], ['d', 'e']];
  let G = null, h = null, nt = null, me = null, rin = null, rout = null;
  const ringIn = () => { if (rin) kill(rin); rin = ghostBox('#ffffff', 3.8, 3.4, 0.4); rin.position.set(-3.2, 3.8, -0.4); };
  const ringOut = () => { if (rout) kill(rout); rout = ghostBox('#2fc092', 6.4, 4.0, 0.5); rout.position.set(-2.0, 3.7, -0.6); };
  await seq(tok, [
    () => { G = jgGraph(P, E, { drop: 2 }); h = head('測試失敗：不是單一個 strongly connected', 0, 6.75); say('如果 directed graph 沒通過測試', '它就不是單一個 strongly connected'); },   // 541.0
    () => { nt = note('可以拆成一個到數個 strongly connected component', 0, 0.3); say('任何 directed graph 都可以拆成', '一個到數個 strongly connected component'); },   // 557.0
    () => { me = buddy('', '', '#f4a56a', 5.4, -0.6, 0.4, 0.55); me.mood('wow'); bub('猜得出 SCC 嗎？', 5.4, 1.4); say('隨便畫一個 directed graph', '你猜得出它的 SCC 嗎？'); },   // 572.0
    () => { me.mood('happy'); txt(nt, '答案：做兩次 DFS 就可以拆出來'); say('先告訴大家答案', '做兩次 DFS 就可以'); },   // 595.0
    () => { txt(h, '課本：strong component（= strongly connected component）'); say('這本書的名詞比較簡單', '叫 strong component'); },   // 628.2
    async () => { glow(G.N.s, GOLD); await pulse(tok, G.N.s); txt(nt, '一個包含 s 的 strong component'); say('假設 strong component', '一定要包含某個點 s'); },   // 647.0
    async () => { for (const k of ['s', 'b', 'c']) { G.paint(k, JC.ok); await beat(tok, 250); } txt(nt, '從 s 的鄰居開始找：跟 s mutually reachable 的人'); say('從 s 開始找附近的鄰居', '跟它 mutually reachable 的那些人'); },   // 666.1
    async () => { G.paint('d', JC.ok); await beat(tok, 250); ringOut(); txt(nt, '這些人形成 strong component：一個 maximal set'); say('這些人形成一個 strong component', '它是一個 maximal set'); },   // 681.0
    () => { txt(nt, 'set 裡任兩點都 mutually reachable → 一個 strongly connected 的小 graph'); say('這個 set 特別挖出來', '就是一個 strongly connected 的小 graph'); },   // 706.0
    () => { txt(h, 'Strong component 一定要 maximal'); say('要符合 strong component', '一定要是 maximal'); },   // 722.0
    () => { txt(nt, 'maximal ≠ maximum：在當下沒辦法再長大'); say('Maximal 跟 maximum 不一樣', '意思是當下沒辦法再長得更大'); },   // 731.8
    () => { kill(rout); rout = null; for (const k in G.N) { G.paint(k, JC.node); glow(G.N[k], null); } for (const [a, b] of [['s', 'b'], ['b', 'c'], ['c', 's']]) G.e(a, b).set(JC.ok); txt(nt, '小例子：一個 cycle 就是 strongly connected'); say('小例子：這是 strongly connected 嗎？', 'Cycle 是最簡單的'); },   // 746.0
    () => { G.e('b', 'd').set(JC.ok); G.e('d', 'c').set(JC.ok); txt(nt, '再長大一點：加上 d，還是 strongly connected'); say('再繼續長下去', '還是互相 strongly connected'); },   // 767.7
    () => { ringIn(); txt(h, '白色這一包 {s, b, c} 是 strong component 嗎？'); say('白色包的這一包', '是 strong component 嗎？'); },   // 841.1
    () => { bad('不是：還能加 d', -3.2, 1.6); say('不是', '我還可以加更多人，仍然 strongly connected'); },   // 849.0
    () => { ringOut(); txt(nt, '長到最大：外圈 {s, b, c, d}'); say('什麼叫長到最大？', '看外圈這一圈'); },   // 873.0
    async () => { for (const k of ['s', 'b', 'c', 'd']) { G.paint(k, JC.ok); await beat(tok, 150); } txt(nt, '外圈裡兩兩都可去可回'); say('外圈包的人，兩兩之間', '都 mutually reachable'); },   // 884.0
    () => { G.e('d', 'e').set(JC.pink); glow(G.N.e, '#7a1010'); txt(nt, '再加 e 就破壞（e 回不去）→ maximal'); say('再增加一個點進去就破壞', '表示它是 maximal，再也長不大'); },   // 900.7
    () => { good('外圈：strong component ✓', 1.6, 1.4); say('外圈這一圈抱著的人', '就是 strong component'); },   // 911.8
    () => { txt(h, '內圈：還不夠大，不是 maximal → 不是'); say('內圈還不夠大，還能再加人', '不是 maximal，所以不算'); },   // 923.5
    () => { txt(nt, 'undirected 的 connected component 也一定要 maximal'); say('Undirected graph 的 connected component', '一樣要 maximal'); },   // 948.1
  ]);
}]);

// 16:25 每個 directed graph 縮點後是 DAG
FRAG.push(['graphjiang2-l9-condense', '把每個 strong component 縮成一點 → DAG', async (tok) => {
  jFresh();
  const P = { x: [-6.0, 5.0], y: [-6.0, 2.2], a: [-2.4, 5.4], b: [1.6, 5.4], c: [1.6, 1.8], d: [-2.4, 1.8] };
  const E = [['x', 'y', 0.18], ['y', 'x', 0.18], ['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'a'], ['a', 'c'], ['x', 'a'], ['y', 'd']];
  let G = null, h = null, nt = null, hs = [], S1 = null, S2 = null, X = null;
  await seq(tok, [
    () => { G = jgGraph(P, E, { drop: 2 }); h = head('任何 directed graph 都能找出 strong component', 0, 6.75); say('任何一個 directed graph', '都可以找出一些 strong component'); },   // 985.0
    () => {                                           // 1003.0 兩個：外圈、左邊小圈
      const g1 = ghostBox('#2fc092', 5.6, 5.2, 0.5); g1.position.set(-0.4, 3.6, -0.6);
      const g2 = ghostBox('#e55a9b', 1.6, 4.4, 0.5); g2.position.set(-6.0, 3.6, -0.6); hs = [g1, g2];
      for (const k of ['a', 'b', 'c', 'd']) G.paint(k, JC.ok); for (const k of ['x', 'y']) G.paint(k, JC.pink);
      nt = note('兩個 strong component：外圈、左邊小圈', 0, 0.3); say('這張圖拆完有兩個 strong component', '外圈這個、左邊小的這個');
    },
    () => { txt(nt, 'strong component：一群緊密結合的點'); say('看起來就是一群緊密結合的點', '彼此都 mutually reachable'); },   // 1031.4
    async () => { await G.morph(tok, { a: [-0.4, 3.6], b: [-0.4, 3.6], c: [-0.4, 3.6], d: [-0.4, 3.6], x: [-6.0, 3.6], y: [-6.0, 3.6] }, 1400); txt(nt, '把每個 strong component 縮成一個點'); say('把 strong component 縮成一個點', '縮起來變成一包'); },   // 1049.0
    () => {                                           // 1061.3 內部 edge 消失
      for (const ed of G.E) kill(ed.obj); G.E = []; for (const k in G.N) kill(G.N[k]); hs.forEach(kill);
      S1 = cube('SCC₂', JC.ok, [1.6, 1.2, 1.0], -0.4, 3.6, 0); S2 = cube('SCC₁', JC.pink, [1.4, 1.2, 1.0], -6.0, 3.6, 0);
      txt(nt, '內部的 edge 都縮進包裡，消失了'); say('內部兩兩之間的 edge', '縮在包裡面，消失了');
    },
    () => { X = arrow(V3(-5.2, 3.6, 0), V3(-1.3, 3.6, 0), JC.hot); txt(nt, '只露出跨 strong component 的 edge'); say('只露出跨越 strong component', '之間的 edge'); },   // 1070.0
    () => { good('縮起來的圖：directed acyclic graph（DAG）', 0, 1.3); say('任意 directed graph 縮完', '都是沒有 cycle 的 directed graph'); },   // 1073.8
    () => {                                           // 1098.0 若縮完有 cycle → 猜錯
      jFresh(); h = head('如果縮完之後，group 之間有 cycle？', 0, 6.75);
      G = jgGraph({ A: [-4.6, 4.8], B: [0.4, 4.8], C: [-2.1, 1.6] }, [['A', 'B'], ['B', 'C'], ['C', 'A']], { size: 1.2, r: 0.8, drop: 2 });
      nt = bad('那就是猜錯了：還找得不夠大', 3.8, 0.6); say('如果拆完的 strong component 之間', '居然有 cycle，那就是你猜錯了');
    },
    async () => { for (const k of ['A', 'B', 'C']) { G.paint(k, JC.ok); await pulse(tok, G.N[k], 260); } note('A、B、C 各自內部可去可回', 3.8, 5.6); say('A 這群可去可回、B 也是', 'C 也是'); },   // 1124.0
    () => { G.all(JC.hot); note('A → B → C → A：外圈的 edge 形成 cycle', 3.8, 4.8); say('A、B、C 三個 group 之間', '透過外圈的 edge 有一個 cycle'); },   // 1135.0
    async () => { await zip(tok, G, 'A', 'B', '●', 400); await zip(tok, G, 'B', 'C', '●', 350); await zip(tok, G, 'C', 'A', '●', 350); note('A 到得了 B，B 也繞得回 A', 3.8, 4.0); say('A 透過這條 edge 到 B', '再繞回來：A、B 仍然可去可回'); },   // 1148.0
    () => { note('C 也一樣 → 三群應該併成一個', 3.8, 3.2); say('同樣的道理 C 也成立', '是因為你猜錯，才會有 cycle'); },   // 1163.0
    async () => { await G.morph(tok, { A: [-2.4, 3.6], B: [-1.6, 3.6], C: [-2.0, 3.0] }, 1200); const g = ghostBox('#2fc092', 3.8, 3.4, 0.5); g.position.set(-2.0, 3.4, -0.6); txt(nt, '拆對了：縮起來一定是 DAG'); say('正常拆完、縮起來之後', '留下的一定是 directed acyclic graph'); },   // 1173.0
    () => { txt(h, '重點：strong component 要 maximal（長到最大）'); say('重點就是 maximal', '要長到最大'); },   // 1207.0
  ]);
}]);

// 20:12 Theorem：s、t 的 strong component 要嘛相同、要嘛 disjoint
FRAG.push(['graphjiang2-l9-scc-thm', 'Theorem：兩個 strong component 不是相同就是 disjoint', async (tok) => {
  jFresh();
  const P = { x: [-6.0, 5.0], y: [-6.0, 2.2], a: [-2.4, 5.4], b: [1.6, 5.4], c: [1.6, 1.8], d: [-2.4, 1.8] };
  const E = [['x', 'y', 0.18], ['y', 'x', 0.18], ['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'a'], ['a', 'c'], ['x', 'a'], ['y', 'd']];
  let G = null, h = null, nt = null, ts = [];
  const clr = () => { ts.forEach(remove); ts = []; for (const k in G.N) glow(G.N[k], null); };
  await seq(tok, [
    () => {                                           // 1212.0 Theorem
      G = jgGraph(P, E, { drop: 2 }); for (const k of ['a', 'b', 'c', 'd']) G.paint(k, JC.ok); for (const k of ['x', 'y']) G.paint(k, JC.pink);
      const g1 = ghostBox('#2fc092', 5.6, 5.2, 0.5); g1.position.set(-0.4, 3.6, -0.6); const g2 = ghostBox('#e55a9b', 1.6, 4.4, 0.5); g2.position.set(-6.0, 3.6, -0.6);
      h = head('Theorem：directed graph 裡任挑兩點 s、t', 0, 6.75); say('這邊有一個 theorem', '在 directed graph 當中');
    },
    () => { glow(G.N.a, GOLD); glow(G.N.c, GOLD); ts.push(ptr('s', -2.4, 6.2), ptr('t', 1.6, 1.0)); say('隨便挑兩個點出來', '一個叫 s、一個叫 t'); },   // 1220.0
    () => { nt = note('s 的 strong component 和 t 的：要嘛同一個，要嘛 disjoint', 0, 0.2); say('s 所在、t 所在的 strong component', '要嘛同一個，不然一定 disjoint'); },   // 1226.8
    () => { clr(); glow(G.N.a, GOLD); glow(G.N.x, GOLD); ts.push(ptr('s', -2.4, 6.2), ptr('t', -6.0, 5.9)); say('例子：拆出 strong component 後任選兩點', '要嘛同一個 component，要嘛不同'); },   // 1247.3
    () => { txt(h, '證明：分 case 討論'); say('怎麼證明？', '分 case 去討論就行了'); },   // 1267.2
    () => { clr(); glow(G.N.a, GOLD); glow(G.N.c, GOLD); ts.push(ptr('s', -2.4, 6.2), ptr('t', 1.6, 1.0)); txt(nt, 'Case 1：s、t mutually reachable → 同一個 strong component'); say('S 和 T 本身 mutually reachable', '就一定在同一個 strong component'); },   // 1273.9
    async () => { for (const k of ['b', 'd']) { glow(G.N[k], '#0f5a3a'); await pulse(tok, G.N[k], 260); } txt(nt, '跟 s 可去可回的人，也跟 t 可去可回（transitive）'); say('跟 s mutually reachable 的人', '也一定跟 t mutually reachable'); },   // 1283.0
    () => { clr(); glow(G.N.a, GOLD); glow(G.N.x, GOLD); ts.push(ptr('s', -2.4, 6.2), ptr('t', -6.0, 5.9)); txt(nt, 'Case 2：s、t 不是 mutually reachable（a 回不去 x）'); say('什麼時候 disjoint？', '兩點之間不是 mutually reachable'); },   // 1303.0
    () => { txt(nt, '那它們所在的 strong component 一定不一樣（disjoint）'); say('這時候它們所在的', 'strongly connected component 一定不一樣'); },   // 1317.0
    () => { txt(h, '證明細節：反證法（參考課本）'); say('可以參考課本', '用反證法很容易推到矛盾'); },   // 1323.0
  ]);
}]);

// 22:22 Topological ordering 只對 DAG 討論；undirected 沒 cycle = tree／forest
FRAG.push(['graphjiang2-l9-dag-intro', 'Topological ordering 與 DAG；沒 cycle 的 undirected graph', async (tok) => {
  jFresh();
  let D = null, h = null, nt = null, T = null;
  await seq(tok, [
    () => { h = head('Topological ordering（topological sorting）', 0, 6.75); say('最後一個 application', 'topological ordering，也叫 topological sorting'); },   // 1342.0
    () => { D = jgGraph({ p: [-5.6, 5.0], q: [-3.6, 5.0], r: [-5.6, 3.0], s: [-3.6, 3.0] }, [['p', 'q'], ['p', 'r'], ['q', 's'], ['r', 's']], { drop: 2 }); nt = note('只對 directed acyclic graph 討論', -4.6, 1.7); say('只針對有方向、而且沒有 cycle 的圖', 'directed acyclic graph'); },   // 1355.0
    () => { const C = jgGraph({ i: [-0.2, 5.4], j: [0.9, 3.4], k: [-1.3, 3.4] }, [['i', 'j'], ['j', 'k'], ['k', 'i']], { size: 0.6, r: 0.4, drop: 2 }); C.all(JC.pink); bad('有 cycle：做不到', -0.2, 2.2); say('有 cycle 的圖', '沒辦法做 topological ordering'); },   // 1377.0
    () => { ptr('directed acyclic graph', -4.6, 6.0); say('Directed acyclic graph', '蠻常出現、也常被拿出來討論'); },   // 1384.3
    () => { txt(h, 'DAG = Directed Acyclic Graph'); say('太常用了，很多書直接叫它 DAG', '把字頭挑出來'); },   // 1403.0
    () => { D.all(JC.ok); txt(nt, 'edge 有方向，而且找不到任何 cycle'); say('Edge 一定有方向性', '而且裡面找不到任何 cycle'); },   // 1413.5
    () => { ptr('undirected：什麼樣子沒有 cycle？', 4.2, 6.0); say('回過頭看 undirected graph', '什麼樣的 undirected graph 沒有 cycle？'); },   // 1436.2
    () => { T = jgGraph({ r: [4.2, 5.2], a: [3.0, 3.8], b: [5.4, 3.8], c: [2.4, 2.4], d: [3.6, 2.4] }, [['r', 'a'], ['r', 'b'], ['a', 'c'], ['a', 'd']], { undirected: true, size: 0.55, r: 0.33, drop: 2, color: JC.green }); say('要嘛就是一棵 tree', ''); },   // 1451.1
    () => { jgGraph({ e: [5.6, 2.4], f: [6.4, 1.2] }, [['e', 'f']], { undirected: true, size: 0.5, r: 0.3, drop: 2, color: JC.green }); ptr('forest = 好幾棵 tree', 4.4, 0.6); say('不是 connected 的話', '拆成好幾棵 tree：forest（森林）'); },   // 1457.0
    () => { T.all(JC.hot); idx('5 個點、4 條 edge', 4.2, 1.6); say('n 個點的 tree', '只包含 n − 1 條 edge'); },   // 1474.0
    () => { T.all(JC.edge); for (const [u, v] of [['c', 'a'], ['a', 'r'], ['r', 'b']]) T.e(u, v).set(JC.blue); say('沒有 cycle', '任兩點之間只有唯一一條 path'); },   // 1495.0
    () => { txt(nt, '沒 cycle 的 undirected graph：最多 n − 1 條 edge'); say('沒有 cycle 的 undirected graph', '最多只能包含 n − 1 條 edge'); },   // 1502.4
    () => { txt(nt, '剛好 n − 1 → tree；少於 n − 1 → forest'); say('剛好 n − 1 條：一棵樹', '少於 n − 1：disconnected，變 forest'); },   // 1516.0
  ]);
}]);

// 25:31 DAG 可以很 dense；為什麼探討 DAG：dependency／precedence
FRAG.push(['graphjiang2-l9-dag-why', 'DAG 可以很 dense；edge = 先後順序', async (tok) => {
  jFresh();
  let D = null, h = null, nt = null;
  const P = {}; for (let i = 0; i < 6; i++) { const a = Math.PI * (0.95 - i * 0.38); P['n' + (i + 1)] = [-2.6 + Math.cos(a) * 3.0, 3.4 + Math.sin(a) * 2.3]; }
  await seq(tok, [
    () => { h = head('DAG：directed graph，但裡面沒有 cycle', 0, 6.75); say('DAG 其實很容易看', '就是 directed graph，但沒有 cycle'); },   // 1531.0
    async () => { D = jgGraph(P, [], { drop: 2, size: 0.6, r: 0.42 }); for (let i = 1; i <= 6; i++) for (let j = i + 1; j <= 6; j++) { D.add('n' + i, 'n' + j); await beat(tok, 90); } say('就算沒有 cycle', '它也可以很 dense'); },   // 1547.8
    () => { D.all(JC.ok); nt = note('15 條 edge，還是找不到 cycle', -2.6, 0.2); say('故意畫很多 edge', '不管怎麼檢查，裡面都沒有 cycle'); },   // 1566.0
    () => { ptr('undirected 沒 cycle → 最多 n − 1 條（tree）', 4.2, 5.4); say('跟 undirected graph 不一樣', '它沒 cycle 時 edge 最少，就是 tree'); },   // 1576.0
    () => { txt(h, '為什麼要特別探討 DAG？'); say('為什麼要特別探討', '這種形式的 graph？'); },   // 1590.4
    () => { icon('📘', '先', 3.2, 3.6, 0, 'sm'); arrow(V3(3.7, 3.6, 0), V3(5.0, 3.6, 0), JC.hot); icon('📗', '後', 5.5, 3.6, 0, 'sm'); note('edge = dependency／precedence（先後順序）', 4.2, 2.5); say('Edge 代表的是一種依存關係', 'dependency 或 precedence'); },   // 1606.0
    () => { txt(nt, '有先後關係的東西，畫出來常是 DAG'); say('有先後順序的特性', '畫出來很多時候是 DAG'); },   // 1631.3
    async () => {                                     // 1645.0 依存又有 cycle → deadlock
      const C = jgGraph({ i: [4.2, 1.6], j: [5.4, 0.2], k: [3.0, 0.2] }, [['i', 'j'], ['j', 'k'], ['k', 'i']], { size: 0.55, r: 0.36, drop: 1.5 }); C.all(JC.pink);
      await beat(tok, 300); bad('依存關係有 cycle → deadlock 🔒', 0.6, 0.9); say('如果有 dependency', '中間又出現 cycle，就形成 deadlock');
    },
  ]);
}]);

// 27:43 例子：修課先修、CPU 指令的 data dependency
FRAG.push(['graphjiang2-l9-dag-apps', '先後順序的例子：修課、CPU 指令', async (tok) => {
  jFresh();
  let C = null, h = null, nt = null, st = null, cl = null;
  await seq(tok, [
    () => {                                           // 1663.0 修課的先修課程
      h = head('例子一：修課的先修課程', 0, 6.75);
      C = jgGraph({ 計概: [-5.4, 5.0], 離散: [-5.4, 2.6], 資結: [-2.8, 5.0], 演算法: [-0.4, 3.8] }, [['計概', '資結'], ['資結', '演算法'], ['離散', '演算法']], { drop: 2, size: 0.95, r: 0.62 });
      st = buddy('我', '', '#f4a56a', -2.8, -0.6, 0.6, 0.55); say('修課時，很多課開學第一堂', '就會講先修課程是什麼');
    },
    () => { C.e('計概', '資結').set(JC.gray); nt = note('一般選修：先修只是參考', -3.0, 1.6); say('一般選修課的先修放比較鬆', '只是擺出來參考'); },   // 1672.0
    () => { C.e('資結', '演算法').set(JC.hot); C.e('離散', '演算法').set(JC.hot); txt(nt, '有些課強制：一定要先修過'); say('有些課非常嚴格', '一定要先修過前面的課才能修'); },   // 1694.0
    () => { st.mood('sad'); bad('順序沒排好 → 擋修！', -0.4, 2.4); say('這兩門課要排順序', '沒排好就會被擋修'); },   // 1708.0
    () => { st.mood('happy'); txt(nt, '用先修限制規劃四年：每學期修什麼'); say('把想修的課抓出來', '規劃大學四年每學期該修什麼'); },   // 1720.1
    () => {                                           // 1747.0 CPU 執行 instruction
      ptr('例子二：CPU 執行 instruction', 3.6, 6.0);
      cl = code(['① a = 1', '② b = 2', '③ c = a + b', '④ d = c * 2'], 3.6, 5.2, 0.7); cl.hl(-1);
      say('修過計算機組織的話', 'CPU 要去執行一堆 instruction');
    },
    () => { note('instruction 之間有 data dependency', 3.6, 1.8); say('這些 instruction 常常出現', 'data dependency'); },   // 1777.0
    () => { cl.hl(0); say('寫程式通常按 sequential order', '一行一行照順序算'); },   // 1783.0
    async () => { cl.hl(1); await beat(tok, 400); txt(cl.ls[0], '② b = 2    '); txt(cl.ls[1], '① a = 1    '); good('①② 互換沒差', 3.6, 1.1); say('有些行彼此沒關係', '哪一行先寫、後寫都沒差'); },   // 1792.0
    () => { cl.hl(2); arrow(V3(1.4, 4.5, 0), V3(1.4, 3.9, 0), JC.hot); arrow(V3(1.4, 3.8, 0), V3(1.4, 3.2, 0), JC.hot); bad('③ 要等 ①②、④ 要等 ③', 3.6, 0.4); say('有些換個順序', '算出來就不一樣：dependency'); },   // 1800.0
    () => { cl.hl(3); txt(h, 'CPU 要 follow instruction 之間的 precedence'); say('CPU 執行時要 follow 原始的順序', '照 precedence：誰先誰後'); },   // 1811.0
  ]);
}]);

// 33:24 四台車同時到：依存關係形成 cycle → deadlock
FRAG.push(['graphjiang2-l9-deadlock', 'Stop sign：讓右手邊先走，四車 deadlock', async (tok) => {
  jFresh();
  const CAR = { 下: [0.7, 0.2, '#7cd1a8'], 右: [4.2, 2.6, '#9fb8ff'], 上: [-0.7, 5.2, '#f4a56a'], 左: [-4.2, 2.6, '#f4a6c8'] };
  const ctr = (k) => V3(CAR[k][0], CAR[k][1] + 0.35, 0.4);
  let B = {}, ws = {}, h = null, nt = null;
  const wait = (a, b) => { const p = ctr(a), q = ctr(b), d = q.clone().sub(p).normalize(); ws[a] = arrow(p.clone().addScaledVector(d, 0.7), q.clone().addScaledVector(d, -0.7), JC.hot); };
  await seq(tok, [
    () => {                                           // 2004.0 讓右手邊的車先走
      cube('', '#bdb6a8', [13.0, 1.8, 0.1], 0, 2.9, -0.6); cube('', '#bdb6a8', [1.8, 7.0, 0.1], 0, 2.9, -0.55);
      B.下 = buddy('', '', CAR.下[2], CAR.下[0], CAR.下[1], 0, 0.55);
      h = head('有些地方：先讓右手邊（逆時針方向）的車走', 0, 6.75); say('有些地方的規定：看右手邊', '右手邊有車先到，就讓它先走');
    },
    () => { for (const k of ['右', '上', '左']) B[k] = buddy('', '', CAR[k][2], CAR[k][0], CAR[k][1], 0, 0.55); txt(h, '四台車幾乎同時到'); say('假設四台車幾乎同時到', ''); },   // 2019.0
    () => { nt = note('每台都要讓右邊的人先走', 4.4, 6.0); for (const k in B) B[k].mood('wow'); say('每個人都要讓右邊的人先走', '形成先後順序關係'); },   // 2028.0
    () => { wait('下', '右'); B.下.look(1); say('下面這台要等右邊這台先走', ''); },   // 2035.0
    () => { wait('右', '上'); wait('上', '左'); B.右.look(-1); B.上.look(-1); say('右邊要等上面', '上面又要等左邊'); },   // 2042.0
    () => { wait('左', '下'); B.左.look(1); say('左邊又要等下面', ''); },   // 2045.3
    () => { for (const k in B) B[k].mood('sad'); bad('deadlock：大家都在等', 0, -0.1); say('大家都在等', '沒有人可以真的先走'); },   // 2048.0
    () => { txt(nt, '關係 = dependency／precedence constraint'); say('這個關係就是 dependency', 'precedence constraint'); },   // 2053.0
    () => { for (const k in ws) ws[k].setColor(JC.pink); txt(nt, 'constraint 形成 cycle → deadlock'); say('這些 constraint 形成一個 cycle', '形成 cycle 就是 deadlock'); },   // 2062.0
    () => { kill(ws.左); for (const k of ['下', '右', '上']) ws[k].setColor(JC.hot); for (const k in B) B[k].mood('happy'); txt(nt, '沒有 cycle：先後順序很容易決定'); say('只要沒有 cycle 的關係', '誰先走、誰後走就很容易決定'); },   // 2090.5
    () => { [['左', 1], ['上', 2], ['右', 3], ['下', 4]].forEach(([k, n]) => head(String(n), CAR[k][0], CAR[k][1] + 1.35)); txt(h, '這個 order 叫 topological order'); say('決定先後順序就是決定一個 order', '叫 topological order'); },   // 2099.3
  ]);
}]);

// 35:09 Topological ordering 的定義；有 ordering ⇒ DAG
FRAG.push(['graphjiang2-l9-topo-def', '定義：edge vi → vj ⇒ vi 排在 vj 前面', async (tok) => {
  jFresh();
  const P = { a: [-4.8, 5.2], b: [-1.6, 5.4], c: [-3.2, 3.4], d: [-0.4, 2.6], e: [1.6, 4.4] };
  const E = [['a', 'c'], ['b', 'c'], ['c', 'd'], ['b', 'e'], ['e', 'd']];
  const ORD = ['a', 'b', 'c', 'e', 'd'];
  let G = null, h = null, nt = null, arcs = [];
  await seq(tok, [
    () => { G = jgGraph(P, E, { drop: 2 }); h = head('正式定義：給一個 directed graph G', 0, 6.8); say('正式定義：給定一個 directed graph G', ''); },   // 2109.0
    () => { nt = note('topological ordering：把所有點排成一個順序', 0, 6.1); say('Topological ordering', '把 graph 裡所有的點拿出來排序'); },   // 2119.0
    async () => { arcs = await lineUp(tok, G, ORD, { x0: -4.8, dx: 2.4, color: JC.edge }); ORD.forEach((k, i) => idx('v' + (i + 1), -4.8 + i * 2.4, 0.35)); say('G 有 n 個點', '排成 v1、v2、…、vn 一個順序'); },   // 2129.3
    () => { for (const g of arcs) g.traverse((o) => { if (o.material) o.material.color.set(JC.ok); if (o.setColor) o.setColor(JC.ok); }); txt(nt, '嚴格要求：vi → vj 有 edge ⇒ vi 排在 vj 前面'); say('非常嚴格的要求：vi 到 vj 有 edge', 'vi 一定要排在前面、vj 在後面'); },   // 2138.3
    () => { txt(h, '適用時機：dependency／precedence'); say('適用時機：dependency 或 precedence', '表達先後順序的關係'); },   // 2175.0
    () => { txt(nt, '給你很多兩兩的條件 → 排出一個總順序'); say('給你很多兩兩之間的條件', '要想辦法排出一個總順序'); },   // 2194.0
    () => { txt(nt, 'edge (vi, vj)：vi 先發生，vj 才能發生 = precedence constraint'); say('vi 到 vj 有 edge：vi 先發生', 'vj 才可以發生：precedence constraint'); },   // 2210.2
    () => { txt(h, 'Lemma：G 有 topological ordering ⇒ G 是 DAG'); say('Lemma：如果能幫 G 找到', 'topological ordering，G 一定是 DAG'); },   // 2240.9
    () => { txt(nt, '換句話說：有 cycle → 一定找不到 topological ordering'); say('同義：如果 graph 裡有 cycle', '一定找不到 topological ordering'); },   // 2266.8
    () => { txt(nt, '例如剛剛的 deadlock：有 cycle，排不出順序'); say('像剛剛的 deadlock', '有 cycle 在裡面就排不出來'); },   // 2275.0
    () => { arcs.push(arcEdge(4.6, 0.2, 0.9, JC.pink, -1)); txt(nt, '反證：假設有 cycle（c → d → … → c）'); say('證明用反證法', '假設這裡有一個 cycle'); },   // 2283.5
    () => { bad('cycle 上一定有一條 edge 往左 → 矛盾', 0, 5.4); say('cycle 繞回去，一定有 edge 往左指', '違反 ordering 的要求，推得矛盾'); },   // 2296.8
  ]);
}]);

// 38:30 例子：7 個點的 DAG 排成一條線
FRAG.push(['graphjiang2-l9-topo-example', '例子：排好之後所有 edge 都由左往右', async (tok) => {
  jFresh();
  let G = null, h = null, ts = [], arcs = [];
  await seq(tok, [
    () => { G = topoGraph({ drop: 2 }); h = head('例子：一個 directed graph', 0, 6.75); say('這是一個 directed graph', '怎麼產生它的 topological order？'); },   // 2310.8
    () => { note('小心確認：沒有 cycle → DAG', 4.6, 6.0); say('它沒有 cycle，是一個 DAG', '大家可以小心確認一下'); },   // 2320.0
    async () => { for (const [i, k] of TORD.entries()) { ts.push(ordTag(G, k, i + 1)); await beat(tok, 160); } say('這是其中一種解法', '把點編號 1～7'); },   // 2332.4
    () => { txt(h, 'Topological order'); say('這個 order', '叫 topological order'); },   // 2340.0
    async () => { ts.forEach(remove); TORD.forEach((k, i) => relabel(G.N[k], i + 1)); arcs = await lineUp(tok, G, TORD, { color: JC.edge }); say('為什麼叫 topological order？', '按照這個順序把點排好'); },   // 2353.2
    () => { for (const g of arcs) g.traverse((o) => { if (o.material) o.material.color.set(JC.ok); if (o.setColor) o.setColor(JC.ok); }); note('edge：小編號出發 → 大編號到達', 0, 5.6); say('兩點之間有 edge', '出發的編號小、到達的編號大'); },   // 2365.0
    () => { good('排成一條線：所有 edge 都由左往右', 0, -0.3); say('小的放左、大的放右', '所有 edge 都從左邊出發到右邊'); },   // 2381.0
  ]);
}]);

// 40:03 反過來：DAG 一定有 topological ordering？誰當 1 號
FRAG.push(['graphjiang2-l9-source-idea', '誰可以當 1 號？沒有 incoming edge 的點', async (tok) => {
  jFresh();
  let G = null, h = null, nt = null, me = null, q = null;
  await seq(tok, [
    () => { G = topoGraph({ drop: 2 }); h = head('怎麼做到這件事？', 0, 6.75); me = buddy('', '', '#f4a56a', 5.4, -0.6, 0.4, 0.55); say('現在問題是', '怎麼做到這件事？'); },   // 2403.4
    () => { nt = note('Lemma：有 topological ordering ⇒ DAG（這方向對）', 0, -0.3); say('剛剛的 lemma：有 topological ordering', '這個 G 就是 DAG'); },   // 2412.0
    () => { txt(nt, '反過來也對嗎？'); me.mood('wow'); say('接下來反過來問', '這個方向對嗎？'); },   // 2419.0
    () => { txt(h, 'G 是 DAG ⇒ 一定找得到 topological ordering？'); say('如果 G 是 DAG', '一定能幫它找到 topological ordering 嗎？'); },   // 2429.0
    async () => { txt(nt, '可以！'); me.mood('happy'); await me.hop(tok); say('先跟大家講', '可以的'); },   // 2439.6
    () => { txt(nt, '那要怎麼找？'); me.mood('calm'); say('如果可以的話', '要怎麼找？'); },   // 2443.0
    async () => { q = pkt('1 號？', -4.0, 6.3, 0.6); await travel(tok, q, V3(-4.0, 6.3, 0.6), V3(0.0, 6.3, 0.6), 900); txt(h, '第一件事：先從哪個點開始，叫它 1 號？'); say('把點從小編到大', '第一件事：誰可以叫 1 號？'); },   // 2464.0
    () => { txt(nt, '第一個 idea：先觀察'); say('第一個 idea', '先透過觀察'); },   // 2503.0
    () => { G.e('C', 'F').set(JC.hot); glow(G.N.C, GOLD); glow(G.N.F, GOLD); txt(nt, 'ordering 只限制有 edge 相連的兩點（C 要在 F 前）'); say('Topological order 只說', '有 edge 相連的兩點要有大小關係'); },   // 2510.0
    () => { G.e('C', 'F').set(JC.edge); glow(G.N.F, null); glow(G.N.G, GOLD); txt(nt, '沒有 edge 相連（C、G）：誰先誰後都可以'); say('沒有 edge 相連的人', '沒有人要求誰先誰後'); },   // 2529.1
    () => { for (const k in G.N) glow(G.N[k], null); glow(G.N.A, GOLD); for (const v of G.out('A')) G.e('A', v).set(JC.hot); txt(nt, 'A 只有 outgoing edge，沒有人指到它'); say('如果有一個點只有 outgoing edge', '沒有從別人到達它的 edge'); },   // 2545.0
    () => { txt(nt, 'A 不 depend on 任何人：沒有誰一定要先發生'); say('它並不 depend on 任何人', '不用等誰先發生'); },   // 2562.0
    () => { G.paint('A', JC.ok); txt(nt, 'A 是一個 free 的點'); say('前面沒有人壓住它', '它是一個 free 的點'); },   // 2573.0
    () => { txt(nt, '什麼時候幫它編號都安全：它指到的人排在後面就好'); say('什麼時候幫它編號都安全', '只要它到達的人都擺在它後面'); },   // 2582.0
    () => { glow(G.N.B, GOLD); G.paint('B', JC.ok); for (const v of G.out('B')) G.e('B', v).set(JC.hot); txt(nt, '先處理 unconstrained 的人：沒有 incoming edge（A、B）'); say('先處理 unconstraint 的那些人', '沒有 incoming edge 的點'); },   // 2594.6
    () => { kill(q); ordTag(G, 'A', '1?'); ordTag(G, 'B', '1?'); say('沒人壓住它們', '一定可以抓出來編成 1 號'); },   // 2611.1
    () => { txt(h, 'Lemma：任何 DAG 一定存在沒有 incoming edge 的點'); say('前提是這個 lemma 要成立', '任何 DAG 一定有沒有 incoming edge 的點'); },   // 2619.0
    () => { txt(nt, '「存在」：可以一個，也可以很多個（這裡 A、B 兩個）'); say('存在：可以有一個點', '也可以很多點，而且一定存在'); },   // 2656.0
    () => { txt(nt, '證明：反證法（倒過來證）'); say('怎麼證？', '也是用反證法'); },   // 2664.6
    () => { txt(nt, 'suppose 所有人都有 incoming edge → 推出不是 DAG → 矛盾'); say('假設所有人都有 incoming edge', '推出來不符合 DAG，就矛盾'); },   // 2686.2
  ]);
}]);

// 44:58 證明：DAG 一定有沒有 incoming edge 的點（往回走 n + 1 次）
FRAG.push(['graphjiang2-l9-source-proof', '證明：一直往回走 n + 1 次，一定撞到同一點', async (tok) => {
  jFresh();
  const P = { v: [4.8, 3.0], u: [2.6, 4.8], x: [0.2, 4.8], w: [-2.0, 3.0], y: [-4.4, 4.8], z: [-4.4, 1.2] };
  const E = [['u', 'v'], ['x', 'u'], ['w', 'x'], ['y', 'w'], ['z', 'y'], ['w', 'z']];
  let G = null, h = null, nt = null, me = null, seqT = [], k = 0;
  const visit = (n) => { seqT.push(idx(n, -5.4 + k * 0.85, -0.25)); k++; };
  const back = async (a, b) => { G.e(b, a).set(JC.hot); await walk(tok, me, G.P[b][0], G.P[b][1] + 0.4, 450); visit(b); };
  await seq(tok, [
    () => { h = head('證明：反證法', 0, 6.75); say('用反證法證明這個 lemma', ''); },   // 2698.9
    () => { G = jgGraph(P, E, { drop: 2 }); nt = note('suppose：G 是 DAG，但每個點都有 incoming edge', 0, 6.05); say('Suppose G 是一個 DAG', '但所有的人都有 incoming edge'); },   // 2707.0
    async () => { for (const n in G.N) { glow(G.N[n], '#0f5a3a'); await beat(tok, 120); } txt(nt, '每個點至少一條 incoming edge'); say('說得明確一點', '每個點至少有一條 incoming edge'); },   // 2719.0
    () => { for (const n in G.N) glow(G.N[n], null); txt(nt, '目標：在 G 裡找到一個 cycle'); say('透過推導', '想辦法在 G 上找到一個 cycle'); },   // 2731.0
    () => { txt(nt, '找到 cycle → 跟「acyclic」矛盾'); say('一開始說 G 是 DAG', '找到 cycle 就跟 acyclic 矛盾'); },   // 2737.0
    () => { txt(nt, '→ 假設錯誤：DAG 一定有沒 incoming edge 的點'); say('那一定是一開始的假設錯誤', '這是證明的 basic idea'); },   // 2754.0
    async () => { me = buddy('', '', '#f4a56a', G.P.v[0], G.P.v[1] + 0.4, 0.6, 0.45); await me.hop(tok); visit('v'); txt(nt, '順著做：隨便挑一個點 v'); say('接下來順著做就好', '隨便挑一個點 v'); },   // 2786.1
    () => { G.e('u', 'v').set(JC.hot); me.look(-1); txt(nt, 'v 至少有一條 incoming edge：沿著它往回走（backtrack）'); say('它至少有一條 incoming edge', '沿著它 backtrack 往回走'); },   // 2797.0
    async () => { await walk(tok, me, G.P.u[0], G.P.u[1] + 0.4, 600); visit('u'); say('往回走到它前面那個人', '叫 u'); },   // 2815.3
    () => { G.e('x', 'u').set(JC.hot); txt(nt, 'u 也至少有一條 incoming edge：再往回'); say('u 一樣至少有一條 incoming edge', '還可以再 backtrack 回去'); },   // 2828.7
    async () => { await walk(tok, me, G.P.x[0], G.P.x[1] + 0.4, 600); visit('x'); say('v 往回到 u、u 往回到 x', '再繼續挑、繼續往回走'); },   // 2845.0
    async () => { txt(nt, '固定往回走：共收集 n + 1 個點（n = 6）'); for (const [a, b] of [['x', 'w'], ['w', 'y'], ['y', 'z'], ['z', 'w']]) await back(a, b); say('固定往回走 n + 1 次', '收集 n + 1 個點，包含一開始的 v'); },   // 2869.9
    () => { txt(nt, 'G 只有 n 個點，收集 n + 1 個 → 一定有重複（鴿籠原理）'); say('Graph 裡只有 n 個點', '收集 n + 1 個，一定有重複'); },   // 2899.0
    () => { glow(G.N.w, GOLD); txt(seqT[3], '[w]'); txt(seqT[6], '[w]'); txt(nt, '至少找得到兩個是同一個點'); say('頂多 n 個不一樣的人', '至少找得到兩個人是相同的'); },   // 2928.8
    () => { ptr('出現兩次的點叫 w', -2.0, 1.9); say('總有一個人會出現兩次', '姑且叫它 w'); },   // 2945.0
    () => { txt(nt, 'backtrack 到 w，繼續往回…某一刻又回到 w'); say('Backtrack 走到 w', '繼續往回，某一刻它又回來了'); },   // 2963.0
    () => { G.all(JC.edge); for (const [a, b] of [['w', 'z'], ['z', 'y'], ['y', 'w']]) G.e(a, b).set(JC.pink); txt(nt, '兩個 w 之間這一段：w → z → y → w 是一個 cycle'); say('把重複出現 w 的那一段抓出來看', '就有一個 cycle'); },   // 2976.0
    () => { txt(nt, 'cycle：頭尾是同一點的 path'); say('Cycle 是一個 path', '而且頭尾是同一個點'); },   // 2998.0
    () => { bad('跟「G 是 DAG」矛盾 → 證完', 2.4, 1.6); me.mood('wow'); say('找到 cycle', '跟 G 是 DAG 矛盾，證完了'); },   // 3006.6
    () => { txt(nt, 'trick：想辦法把 cycle 找出來'); say('證明不難', '但 trick 是要想辦法找出這個 cycle'); },   // 3023.0
    () => { txt(h, 'Lemma：任何 DAG 一定至少有一個沒有 incoming edge 的點'); me.mood('happy'); say('得到一個非常重要的 lemma', 'DAG 一定至少有一個點沒有 incoming edge'); },   // 3035.2
    () => { txt(nt, '接下來用它做 topological order'); say('接下來就用這個 lemma', '做 topological order'); },   // 3048.3
    async () => { txt(nt, '沒有 incoming edge → 不 depend on 誰 → 直接編 1 號'); await me.hop(tok); say('沒有 incoming edge 就不 depend on 任何人', '可以直接抓出來編成 1 號'); },   // 3053.9
  ]);
}]);

// 51:14 例子：一直抓沒有 incoming edge 的點編號
FRAG.push(['graphjiang2-l9-topo-run', '例子：抓出沒有 incoming 的點、編號、挖掉', async (tok) => {
  jFresh();
  let G = null, h = null, nt = null, ts = [], arcs = [];
  const num = (k, n) => { ts.push(ordTag(G, k, n)); G.paint(k, JC.ok); };
  const ung = () => { for (const k in G.N) glow(G.N[k], null); };
  await seq(tok, [
    () => { G = topoGraph({ drop: 2 }); h = head('同一個例子：怎麼得到剛剛的結果？', 0, 6.75); say('剛剛的例子', '同樣一個 graph'); },   // 3074.9
    () => { glow(G.N.A, GOLD); glow(G.N.B, GOLD); nt = note('沒有 incoming edge 的點：A、B 兩個', 0, -0.3); say('先把沒有 incoming edge 的點抓出來', '一開始找到這兩個'); },   // 3082.5
    () => { txt(nt, '這兩個誰當 1 號都沒關係'); say('不管怎樣，兩個人都可以編 1 號', '誰當 1 號都沒關係'); },   // 3090.9
    async () => { ung(); num('A', 1); await pulse(tok, G.N.A); say('就挑右下角這個人', '叫它 1 號'); },   // 3103.0
    () => { txt(nt, '1 號對剩下的人的限制，已經消失了'); say('1 號對剩下的人的限制', '已經消失了'); },   // 3114.0
    () => { txt(nt, '其他所有人的編號一定在 1 號之後'); say('為什麼？', '其他所有人編號一定在 1 號之後'); },   // 3124.8
    () => { for (const v of G.out('A')) G.e('A', v).set(JC.ok); txt(nt, 'A 的 outgoing edge：不用再在乎'); say('它壓出去的那些 edge', '我不用再在乎它'); },   // 3134.0
    () => { for (const k of ['D', 'E', 'G']) glow(G.N[k], GOLD); txt(nt, 'A 指出去的三個人（D、E、G）編號一定 > 1'); say('1 號 outgoing 出去的這三個人', '不管怎麼編，編號一定大於 1'); },   // 3160.0
    () => { ung(); dimNode(G, 'A'); txt(nt, '限制消失：想像中把 A 挖掉（淡掉）'); say('這個限制消失了', '想像中把它挖掉，不要看'); },   // 3173.0
    () => { txt(nt, '剩下的還是 DAG：只拔 edge，沒加 edge，更不會有 cycle'); say('剩下的人還是 DAG 嗎？', '只拔 edge 沒加 edge，還是 DAG'); },   // 3186.0
    () => { glow(G.N.B, GOLD); txt(nt, '既然是 DAG，一定還有沒 incoming 的點：B'); say('既然還是 DAG', '一定還有一個沒有 incoming edge 的點'); },   // 3215.0
    async () => { ung(); num('B', 2); await pulse(tok, G.N.B); say('把它編成 2 號', ''); },   // 3227.0
    () => { dimNode(G, 'B'); txt(nt, 'B 指出去的人一定排在 2 號之後 → 把 B 拔掉'); say('它 outgoing 出去的人就安全了', '想像中把 2 拔掉'); },   // 3230.9
    () => { glow(G.N.C, GOLD); txt(nt, '右上角的 C：現在沒有 incoming edge 了'); say('2 拔掉之後，右上角這個點', '再也沒有人壓住它'); },   // 3258.0
    async () => { ung(); num('C', 3); await pulse(tok, G.N.C); say('抓出來', '編成 3 號'); },   // 3275.0
    () => { dimNode(G, 'C'); num('D', 4); txt(nt, '一樣把 edge 拔掉：D 變成 4 號'); say('一樣再把 edge 拔掉', ''); },   // 3281.0
    () => { dimNode(G, 'D'); num('E', 5); say('Iteratively 這樣做', ''); },   // 3283.2
    async () => { dimNode(G, 'E'); num('F', 6); await beat(tok, 350); dimNode(G, 'F'); num('G', 7); dimNode(G, 'G'); say('全部編完了', '確認一次'); },   // 3285.2
    async () => { ts.forEach(remove); TORD.forEach((k, i) => { relabel(G.N[k], i + 1); G.paint(k, JC.node); }); arcs = await lineUp(tok, G, TORD, { color: JC.edge }); say('把點從小排到大', 'edge 還給它'); },   // 3296.8
    () => { for (const g of arcs) g.traverse((o) => { if (o.material) o.material.color.set(JC.ok); if (o.setColor) o.setColor(JC.ok); }); txt(nt, '1 2 3 4 5 6 7：edge 都由左往右，沒有反過來的'); say('1234567 排完之後', '所有 edge 都從左到右，沒有反過來'); },   // 3301.8
    () => { good('合法的 topological order ✓', 0, 5.6); say('所以這個 order 是合法的', '它是一個 topological order'); },   // 3312.8
  ]);
}]);

// 1:01:50 DAG ⇒ 有 topological order：用 induction 證明，證明就是 algorithm
FRAG.push(['graphjiang2-l9-induct-idea', 'Lemma：DAG ⇒ 有 topological order（用 induction）', async (tok) => {
  jFresh();
  let G = null, h = null, nt = null;
  await seq(tok, [
    () => { G = topoGraph({ drop: 2 }); h = head('回到方法：怎麼決定 topological order？', 0, 6.75); say('看過例子之後', '接下來看這個方法到底怎麼做'); },   // 3710.3
    () => { glow(G.N.A, GOLD); glow(G.N.B, GOLD); nt = note('只要是 DAG：一定有沒 incoming edge 的點', 0, -0.3); say('根據：只要是 DAG', '一定存在至少一個沒有 incoming edge 的點'); },   // 3722.0
    () => { ordTag(G, 'A', 1); G.paint('A', JC.ok); txt(nt, '沒有 dependency → 一定可以排在前面，編 1 號'); say('它沒有 dependency on 任何人', '可以排在前面，排在 1 號'); },   // 3735.7
    async () => { for (const [i, k] of TORD.slice(1).entries()) { ordTag(G, k, i + 2); G.paint(k, JC.ok); await beat(tok, 180); } txt(nt, '照這樣就能把所有點排序'); say('根據這樣的方式', '就可以把所有的點做排序'); },   // 3747.0
    () => { txt(h, 'Lemma：G 是 DAG ⇒ G 有 topological order'); say('Lemma：如果 G 是一個 DAG', 'G 就一定有 topological order'); },   // 3749.9
    () => { txt(nt, '前面的 lemma 是反方向：有 topological order ⇒ DAG'); say('前面有一個 lemma', '是反過來的方向'); },   // 3763.4
    () => { txt(nt, '這個方向：用數學歸納法（induction）證明'); say('這個證明', '可以用數學歸納法'); },   // 3776.0
    () => { icon('⚙️', 'algorithm', 5.2, 5.4); txt(nt, '證完之後，就得到一個 algorithm'); say('證完之後', '就得到了一個 algorithm'); },   // 3788.0
    () => { txt(nt, '數學歸納法是 constructive proof'); say('因為數學歸納法', '是一個 constructive 的 proof'); },   // 3801.0
    () => { txt(nt, '靠「怎麼建構 solution」完成證明 → 附帶產生對應的演算法'); say('它透過建構 solution 的過程完成證明', '通常也就伴隨產生對應的演算法'); },   // 3810.0
  ]);
}]);

// 1:03:55 複習數學歸納法
FRAG.push(['graphjiang2-l9-induction', '複習：數學歸納法（base case ＋ inductive step）', async (tok) => {
  jFresh();
  let D = [], h = null, nt = null;
  const COLS = ['#e8b02a', '#9fb8ff', '#9fb8ff', '#9fb8ff', '#9fb8ff', '#9fb8ff', '#9fb8ff'];
  await seq(tok, [
    () => { h = head('複習：數學歸納法', 0, 6.75); for (let i = 0; i < 7; i++) D.push(domino(-4.8 + i * 1.3, 0.4, COLS[i])); for (let i = 0; i < 7; i++) idx('n = ' + (i + 1), -4.8 + i * 1.3, 0.0); say('既然是數學歸納法', '很快複習一下'); },   // 3835.7
    () => { nt = note('兩大步驟', 0, 5.6); say('數學歸納法', '包含兩大步驟'); },   // 3842.0
    () => { glow(D[0], GOLD); ptr('① base case：最簡單（n = 1、2）', -3.4, 3.0); say('第一步：base case', '通常是 problem size 很小的時候'); },   // 3847.3
    () => { ptr('② inductive step：核心', 2.4, 3.8); txt(nt, '第二步最困難，也是核心'); say('第二步：inductive step', '最困難，也是數學歸納法的核心'); },   // 3864.8
    () => { txt(nt, 'hypothesis：k < n 成立 ⇒ 推出 k = n 成立'); say('透過 hypothesis', 'k < n 成立時，推 k = n 成立'); },   // 3871.0
    () => { txt(nt, 'inductive step 常用兩種：weak、strong'); say('Inductive step', '常用兩種：weak 和 strong'); },   // 3884.0
    async () => { await anim(tok, 700, (u) => tipTo(D[0], u)); glow(D[1], '#0f5a3a'); txt(nt, 'weak：n − 1 成立 ⇒ n 成立（一次前進一格）'); say('Weak：n − 1 成立推 n 成立', '只前進一步'); },   // 3895.7
    () => { for (let i = 1; i < 4; i++) glow(D[i], '#0f5a3a'); glow(D[4], GOLD); txt(nt, 'strong：所有 k < n 成立 ⇒ n 成立（步伐比較大）'); say('Strong：所有 k < n 都成立', '推 n 成立，前進的步伐可以比較大'); },   // 3906.0
    () => { txt(nt, 'weak 和 strong 可以互換：equivalent'); say('不管 weak 或 strong', '兩者可以互換，是 equivalent'); },   // 3919.0
    () => { txt(nt, '依遇到的 case，決定一次跳多大'); say('使用時依你遇到的 case', '決定跳躍的幅度'); },   // 3929.8
    () => { txt(nt, '兩大步驟，缺一不可'); say('兩大步驟', '缺一不可'); },   // 3941.0
    () => { glow(D[0], '#7a1010'); bad('不要跳過 base case：它是所有證明的基石', 0, 4.6); say('不要以為 base case 簡單就跳過', '第一個不發生，後面都不會發生'); },   // 3976.3
  ]);
}]);

// 1:06:41 Base case 與 inductive hypothesis
FRAG.push(['graphjiang2-l9-induct-base', 'Base case：一個點；hypothesis：點數 < n 都成立', async (tok) => {
  jFresh();
  let h = null, nt = null;
  await seq(tok, [
    () => { h = head('先 check base case', 0, 6.75); say('先 check 一下', 'base case 要考慮什麼'); },   // 4001.3
    () => { ptr('Claim：n 個點的 DAG 一定有 topological order', 0, 6.05); say('G 有 n 個點，而且是 DAG', 'G 一定存在一個 topological order'); },   // 4013.1
    () => { nt = note('對 n（點數）做 induction', 0, 5.35); say('最簡單的 case 是什麼？', '我們 induction 在 n 身上'); },   // 4027.0
    () => { cube('v', JC.node, [0.8, 0.8, 0.64], -3.4, 3.0, 0, 2); txt(nt, '最簡單：graph 只有一個點'); say('最簡單的 case', 'graph 裡只有一個點'); },   // 4032.8
    () => { head('1', -3.4, 3.8); good('沒有 edge → 直接編 1 號：trivially true', -3.4, 1.8); say('只有一個點，不存在任何 edge', '直接編 1 號就結束：一定是 true'); },   // 4041.0
    () => { txt(h, 'Inductive step'); say('接下來是', 'inductive step'); },   // 4064.4
    () => {                                           // 4070.0 assume < n 都成立
      const g = ghostBox('#2fc092', 4.6, 3.4, 0.4); g.position.set(3.2, 3.0, -0.4);
      jgGraph({ p: [2.0, 4.0], q: [4.2, 4.0], r: [2.6, 2.2], s: [4.0, 2.2] }, [['p', 'q'], ['p', 'r'], ['q', 's'], ['r', 's']], { size: 0.55, r: 0.35, drop: 1.5, color: JC.green });
      ptr('假設：點數 < n 的 DAG 都有 topological order', 2.4, 0.9); say('先 assume：點數小於 n 的 DAG', '都存在 topological order');
    },
    () => { txt(nt, '要推：n 個點的 DAG 也找得到'); say('想要推得：有 n 個點的時候', '也可以找到 topological order'); },   // 4091.0
    () => { txt(nt, '（index 調整一下：≤ n 成立 ⇒ n + 1 成立）'); say('Index 有點調整過', '最多 n 個點成立，推 n + 1 成立'); },   // 4104.2
  ]);
}]);

// 1:08:58 Inductive step：挑沒有 incoming 的 v，剩下的 G − v 用 hypothesis，v 放最前面
FRAG.push(['graphjiang2-l9-induct-step', '從 n 到 n + 1：v 放最前面，剩下的靠 hypothesis', async (tok) => {
  jFresh();
  const Q = {}; for (const k of TORD.slice(1)) Q[k] = [TP[k][0] * 0.72 + 2.2, TP[k][1] * 0.95 + 0.2];
  let G = null, h = null, nt = null, halo = null, ts = [], arcs = [];
  await seq(tok, [
    () => { G = topoGraph({ drop: 2 }); h = head('從 n 推到 n + 1：多出來的點挑誰？', 0, 6.75); say('怎麼從 n 進步到 n + 1？', '多出來的那個點要怎麼挑？'); },   // 4138.8
    () => { glow(G.N.A, GOLD); glow(G.N.B, GOLD); nt = note('前面的 lemma：DAG 一定有沒 incoming edge 的點', 0, -0.3); say('根據前面的 lemma', '只要是 DAG 就一定有沒有 incoming edge 的點'); },   // 4147.1
    () => { glow(G.N.B, null); relabel(G.N.A, 'v'); txt(nt, '有好多個？隨便挑一個，叫它 v'); say('有好多個怎麼辦？', '沒關係，隨便挑一個'); },   // 4160.9
    () => { txt(nt, 'G：n + 1 個點的 DAG'); say('現在討論的 G', '是有 n + 1 個點的 DAG'); },   // 4168.0
    () => { txt(nt, '把它分成：1 個點 ＋ n 個點'); say('想辦法把它分成 n 個點', '和一個點'); },   // 4175.4
    async () => { await G.morph(tok, { A: [-5.6, 3.0] }, 1000); txt(nt, '挑出來的是沒有 incoming edge 的 v'); say('把那一個點挑出來', '挑沒有 incoming edge 的那個 v'); },   // 4182.0
    async () => { await G.morph(tok, Q, 1200); halo = ghostBox('#2fc092', 7.6, 6.0, 0.4); halo.position.set(1.0, 3.0, -0.6); txt(nt, '剩下的人放在右邊'); say('v 挑出來之後', '剩下的人放在右邊'); },   // 4199.7
    () => { for (const v of G.out('A')) G.e('A', v).set(JC.hot); txt(nt, 'v 沒有 incoming edge：只剩 outgoing edge'); say('v 沒有 incoming edge', '身上只剩下 outgoing edge'); },   // 4210.0
    () => { txt(nt, 'outgoing edge 只能連到剩下的人（綠色這一塊）'); say('這些 outgoing edge 連到誰？', '只能連到剩下的人'); },   // 4223.0
    () => { ptr('G − v', 5.2, 1.2); txt(nt, '綠色這一塊 = G 扣掉 v'); say('綠色這一塊是誰？', '就是 G 扣掉 v 這一個點'); },   // 4236.0
    () => { txt(nt, '右邊這一塊是 DAG 嗎？'); say('答案其實已經出來了', '右邊這一塊是不是 DAG？'); },   // 4246.8
    () => { txt(nt, '整包是 DAG，現在把 v 拿掉'); say('為什麼？整包是一個 DAG', '我把 v 拉掉'); },   // 4256.1
    () => { txt(nt, '剩下：還是 directed；拔掉 edge 不會產生 cycle'); say('剩下的一定是 directed graph', '原來就沒 cycle，拔掉更不會有'); },   // 4272.0
    () => { good('綠色這一塊是 DAG ✓', 5.2, 0.5); say('所以右邊綠色這一塊', '是一個 DAG'); },   // 4298.0
    () => { txt(nt, 'induction hypothesis：≤ n 個點的 DAG 有 topological order'); say('Induction hypothesis 告訴我們', '≤ n 個點的 DAG 一定有 topological order'); },   // 4305.0
    async () => { for (const [i, k] of TORD.slice(1).entries()) { ts.push(ordTag(G, k, i + 2)); await beat(tok, 160); } say('所以右邊綠色這一塊', '可以幫它找到一個 topological order'); },   // 4324.2
    async () => { ts.push(ordTag(G, 'A', 1)); await pulse(tok, G.N.A); txt(nt, 'v 擺在這些人的前面就行了'); say('V 擺在這些人前面', '就行了'); },   // 4335.8
    () => { txt(nt, 'v 前面沒人壓住它，edge 只往後 → 符合限制'); say('它前面沒有人壓住它', '只有 edge 連到後面的人'); },   // 4355.0
    () => { txt(nt, '回顧：G 沒 cycle → 挖掉 v 更不會有 cycle'); say('原來的 G 沒有 cycle', '挖掉一個點之後更不會有 cycle'); },   // 4365.0
    () => { txt(nt, 'hypothesis → 右邊有一個 sequence'); say('根據 induction 的 hypothesis', '右邊這些人可以找到一個 sequence'); },   // 4391.8
    async () => { ts.forEach(remove); kill(halo); TORD.forEach((k, i) => relabel(G.N[k], i === 0 ? 'v' : i + 1)); arcs = await lineUp(tok, G, TORD); txt(nt, '把 v 擺在最前面：安全'); say('把 V 擺在這些人前方', '擺在這裡當然是安全的'); },   // 4410.5
    () => { txt(nt, 'final order = v ＋ 剩下 n 個點的 order'); say('最後的 topological order', '沒 incoming 的人放前面，剩下的擺後面'); },   // 4436.8
    () => { good('n 個點成立 ⇒ n + 1 個點也成立：推完', 0, 5.6); say('n 個點的 DAG 有 topological order', 'n + 1 個點的也有，推完了'); },   // 4461.7
  ]);
}]);

// 1:14:40 骨牌效應；proof 倒過來就是 algorithm
FRAG.push(['graphjiang2-l9-induct-domino', '骨牌效應；把證明倒過來就是 algorithm', async (tok) => {
  jFresh();
  const MP = {}; for (const k in TP) MP[k] = [TP[k][0] * 0.6 + 3.0, TP[k][1] * 0.55 + 3.0];
  let D = [], h = null, nt = null, pb = null, G = null;
  await seq(tok, [
    () => { h = head('數學歸納法 = 骨牌效應', -3.0, 6.75); for (let i = 0; i < 7; i++) D.push(domino(-5.6 + i * 1.1, 0.3, i ? '#9fb8ff' : '#e8b02a')); say('數學歸納法', '就是一個骨牌效應'); },   // 4480.0
    () => { nt = note('疊好之後，推倒第一張 → 連鎖效應', -3.6, 4.4); say('骨牌疊好之後', '推倒第一張，後面就會連鎖倒下'); },   // 4487.7
    () => { glow(D[0], GOLD); pb = ptr('base case = 推倒第一張', -5.2, 2.5); say('第一張骨牌推倒', '就是 base case'); },   // 4499.6
    async () => { await anim(tok, 700, (u) => tipTo(D[0], u)); txt(nt, 'inductive step：前一張倒 → 後一張也倒'); say('前一張倒的時候，後一張就會倒', '就是 inductive step'); },   // 4507.8
    async () => { remove(pb); for (let i = 1; i < 7; i++) await anim(tok, 260, (u) => tipTo(D[i], u)); good('所有骨牌都倒下來', -2.4, 2.5); say('只要證明這兩大步驟', '所有的骨牌都會倒下來'); },   // 4520.8
    () => { G = jgGraph(MP, TE, { size: 0.5, r: 0.32, drop: 2 }); txt(h, '證明很漂亮：證完 algorithm 就出來了'); say('這個證明很漂亮', '證完之後 algorithm 就出來了'); },   // 4537.9
    () => { txt(nt, 'proof 由 n 往上兜 n + 1；algorithm 倒過來做'); say('證明是從 n 個點兜 n + 1 個點', '發展 algorithm 時倒過來做'); },   // 4544.0
    async () => { glow(G.N.A, GOLD); ordTag(G, 'A', 1); G.paint('A', JC.ok); await pulse(tok, G.N.A); txt(nt, '先抓出一定擺前面的人，幫它編號'); say('先把這個人抓出來', '知道它一定擺前面，幫它編號'); },   // 4562.0
    () => { glow(G.N.A, null); dimNode(G, 'A'); txt(nt, '再處理剩下的人'); say('接下來', '再處理剩下的人'); },   // 4568.0
    async () => { for (const [i, k] of TORD.slice(1).entries()) { ordTag(G, k, i + 2); G.paint(k, JC.ok); await beat(tok, 200); dimNode(G, k); } txt(nt, 'iteratively：找沒 incoming 的點 → 編號 → 拿掉'); say('剩下的一樣是 DAG', '找沒有 incoming edge 的點編號，反覆做'); },   // 4576.0
  ]);
}]);

// 1:16:36 Algorithm procedure 與 naive 的 O(n²)
FRAG.push(['graphjiang2-l9-topo-algo', 'TopologicalOrder(G)：naive 要 O(n²)', async (tok) => {
  jFresh();
  const MP = {}; for (const k in TP) MP[k] = [TP[k][0] * 0.55 + 3.6, TP[k][1] * 0.6 + 2.4];
  let G = null, h = null, nt = null, cp = null;
  const num = (k, n) => { ordTag(G, k, n); G.paint(k, JC.ok); };
  await seq(tok, [
    () => { h = head('Algorithm procedure', 0, 6.75); cp = code(['TopologicalOrder(G)：// G 是 DAG', '  找一個沒有 incoming edge 的點 v', '  給 v 一個 order（編號）', '  從 G 刪掉 v', '  TopologicalOrder(G − v)', '  直到 G 空了為止'], -3.4, 5.6, 0.62); cp.hl(-1); say('我們來寫下', '這個 algorithm procedure'); },   // 4596.0
    () => { cp.hl(0); G = jgGraph(MP, TE, { size: 0.5, r: 0.32, drop: 2 }); say('Input：一個 directed acyclic graph G', ''); },   // 4607.3
    () => { nt = note('每一次都做同樣的事', 2.6, 1.2); say('它每一次', '都做同樣的事情'); },   // 4612.0
    () => { cp.hl(1); glow(G.N.A, GOLD); say('先找到一個點', '沒有 incoming edge'); },   // 4620.0
    () => { cp.hl(2); num('A', 1); say('找出來之後', '給它一個 order，編號它'); },   // 4627.0
    () => { cp.hl(3); glow(G.N.A, null); dimNode(G, 'A'); say('把 v 從 graph 拿掉', '概念上就是 delete 它'); },   // 4632.2
    () => { txt(nt, '剩下 n − 1 個點：一定還是 DAG'); say('原來 n 個點，剩 n − 1 個點', '一定也是一個 DAG'); },   // 4649.2
    () => { cp.hl(4); txt(nt, 'recursive call 自己'); say('Recursive call 自己', '在剩下的圖裡繼續做'); },   // 4661.0
    async () => { cp.hl(1); num('B', 2); await beat(tok, 300); dimNode(G, 'B'); num('C', 3); await beat(tok, 300); dimNode(G, 'C'); say('找沒有 incoming edge 的點', 'order 它、拿掉它，反覆做'); },   // 4668.0
    async () => { cp.hl(5); for (const [i, k] of ['D', 'E', 'F', 'G'].entries()) { num(k, i + 4); await beat(tok, 220); dimNode(G, k); } say('直到這張圖空了為止', 'order 就結束了'); },   // 4673.3
    () => { cp.hl(-1); txt(h, '要花多少時間？'); txt(nt, '一共 n 個點：要 order n 次'); say('需要花多少時間？', '一共 n 個點，要 order n 次'); },   // 4687.0
    () => { txt(nt, '每次都要在目前的 graph 找沒 incoming edge 的點'); say('每次 order 時', '都要在現有的 graph 找沒 incoming 的點'); },   // 4702.0
    () => { txt(nt, '→ 一共 n 個 iteration'); say('所以一共要做', 'n 個 iteration'); },   // 4712.9
    () => { txt(nt, 'naive：每次都掃過整張圖，才知道誰沒 incoming'); say('Naive 的分析：一定要掃過整張圖', '才知道哪個點沒有 incoming edge'); },   // 4717.0
    async () => { for (let i = 0; i < 7; i++) { const hgt = (7 - i) * 0.25; cube('', JC.orange, [0.42, hgt, 0.3], -6.2 + i * 0.55, hgt / 2, 0); await beat(tok, 150); } idx('n、n − 1、n − 2、…', -4.5, 2.1); say('第一次掃 n 個點', '第二次 n − 1、n − 2，一直到最後'); },   // 4732.0
    () => { bad('總共 O(n²)', -1.2, 0.4); say('加起來是一個級數', '總共 O(n²)'); },   // 4740.0
    () => { good('可以更快：linear time O(n + m)', 2.6, 0.4); say('其實可以快一點', '只要 linear time O(n + m)'); },   // 4763.0
  ]);
}]);

// 1:19:42 Linear time 的 data structure：in-degree 欄位與 set S
FRAG.push(['graphjiang2-l9-ds-setup', 'Data structure：in-degree 欄位 ＋ set S', async (tok) => {
  jFresh();
  let G = null, h = null, nt = null, T = null, S = null;
  await seq(tok, [
    () => { G = topoGraph({ drop: 2 }); h = head('linear time：要配合 data structure', 0, 6.75); say('怎麼做到 linear time？', 'data structure 要配合'); },   // 4782.0
    () => { nt = note('基本 representation：adjacency list', 0, -0.3); say('用 adjacency list', '當作基本的 representation'); },   // 4788.0
    () => { glow(G.N.D, GOLD); txt(nt, 'incoming、outgoing 都 maintain（D：in ← A B C，out → E）'); say('要很容易看到 incoming edge 有誰', '和 outgoing edge 到誰，兩塊都 maintain'); },   // 4803.0
    () => { glow(G.N.D, null); T = inTags(G, indeg(G)); txt(nt, '每個點多一個欄位：in-degree（幾條 incoming edge）'); say('另外對每個點多 maintain 一個欄位', '記錄它有多少條 incoming edge'); },   // 4819.0
    () => { glow(G.N.A, GOLD); glow(G.N.B, GOLD); txt(nt, '查欄位：in 0 → 沒有 incoming edge'); say('透過這個欄位', '很快知道哪些點沒有 incoming edge'); },   // 4836.0
    () => { S = sBox(); txt(nt, '第二：另外 maintain 一個 set S'); say('這樣還不夠', '還需要一個 set S'); },   // 4859.7
    () => { txt(nt, 'S：queue 或 stack 都可以，放沒有 incoming 的點'); say('像簡單的 queue 或 stack 都可以', '記錄目前沒有 incoming edge 的點'); },   // 4868.0
    async () => { const p = pkt('掃…', -6.2, 6.3, 0.5); await travel(tok, p, V3(-6.2, 6.3, 0.5), V3(3.0, 6.3, 0.5), 1200); remove(p); txt(nt, '沒有 S：每次都要掃 in-degree 欄位，很慢'); say('沒有 S 的話', '每次都還要去掃 in-degree 欄位，很慢'); },   // 4878.5
    () => { S.push('A'); S.push('B'); txt(nt, '有 S：每次從裡面 pop 一個點出來處理'); say('另外 maintain 一個 queue 或 stack', '每次從裡面 pop 一個點出來處理'); },   // 4889.5
  ]);
}]);

// 1:21:49 Initialization：掃一次 outgoing edge 算 in-degree
FRAG.push(['graphjiang2-l9-ds-init', 'Initialization：掃一次 edge，算出 in-degree', async (tok) => {
  jFresh();
  let G = null, h = null, nt = null, T = null;
  const d = {};
  await seq(tok, [
    () => { G = topoGraph({ drop: 2 }); for (const k in G.N) d[k] = 0; T = inTags(G, d); h = head('Initialization 要花多少時間？', 0, 6.75); say('這樣做的話', 'initialization 需要花多少時間？'); },   // 4909.0
    () => { nt = note('要先準備 in-degree 欄位', 0, -0.3); say('因為需要準備', '這個 in-degree 欄位'); },   // 4917.2
    () => { txt(nt, '每個點：數一下有幾條 incoming edge'); say('每個點都要 check', 'incoming edge 有多少條'); },   // 4922.0
    () => { txt(nt, '做法：掃過整個 graph 一次'); say('基本上掃過整個 graph', '就可以得到這個資訊'); },   // 4935.0
    () => { txt(nt, '只有 outgoing list 也行：掃每個點的 outgoing edge'); say('如果只 maintain outgoing edge', '一樣掃一下每個點的 outgoing edge'); },   // 4949.7
    async () => { for (const ed of G.E) { ed.set(JC.hot); d[ed.v]++; txt(T[ed.v], 'in ' + d[ed.v]); await beat(tok, 150); } txt(nt, '掃到一條 edge，就在對方身上 in-degree + 1'); say('每掃到一個對方', '就在對方的 in-degree 加 1'); },   // 4974.0
    () => { G.all(JC.edge); txt(nt, '掃完：每個點都收集到自己的 in-degree'); say('掃完的話', '每個點身上就收集到 in-degree'); },   // 4993.0
    () => { txt(nt, '只需要這個數字：不用真的查 incoming edge 有誰'); say('其實只需要這個數字', '不需要 check incoming edge 有誰'); },   // 5001.4
    () => { txt(nt, '刪除點：不真的拔掉，靠扣 in-degree 達到效果'); say('概念上要做 deletion', '透過控制 in-degree 的數字來做到'); },   // 5015.0
    () => { good('initialization：linear time O(n + m)', 0, 6.1); say('所以 initialization', '是 linear time'); },   // 5036.6
  ]);
}]);

// 1:24:06 拔掉一個點：pop、outgoing 對到的人 in-degree − 1、降到 0 就進 S
FRAG.push(['graphjiang2-l9-ds-delete', '拔掉 v：outgoing 對到的人 in-degree − 1', async (tok) => {
  jFresh();
  let G = null, h = null, nt = null, T = null, S = null, d = null;
  const dec = (u) => { const z = []; for (const v of G.out(u)) { d[v]--; txt(T[v], 'in ' + d[v]); G.e(u, v).set(JC.hot); if (d[v] === 0) z.push(v); } return z; };
  await seq(tok, [
    () => { G = topoGraph({ drop: 2 }); d = indeg(G); T = inTags(G, d); S = sBox(); S.push('A'); S.push('B'); h = head('第三行：概念上把點從圖中拔掉', 0, 6.75); say('重點是第三行要怎麼做', '把這個點從圖當中拔掉'); },   // 5046.3
    () => { nt = note('拔掉的時候，有幾件事要做', 0, -0.3); say('從圖當中拔掉', '有幾件事情要去做'); },   // 5055.6
    async () => { S.pop('A'); ordTag(G, 'A', 1); G.paint('A', JC.ok); await pulse(tok, G.N.A); txt(nt, '① order 它：它也從 S pop 出來'); say('Order 它的時候', '它也從 S 裡面 pop 出來'); },   // 5064.0
    () => { txt(nt, '② 影響它 outgoing 到達的人：in-degree 要扣 1'); say('拔掉會影響它 outgoing 到達的人', '他們的 in-degree 要扣 1'); },   // 5080.0
    async () => { for (const v of G.out('A')) await zip(tok, G, 'A', v, '●', 320); txt(nt, '掃一下 A 的 outgoing list：D、E、G'); say('掃一下它的 outgoing edge', '那個 list 上有誰'); },   // 5095.0
    () => { dec('A'); txt(nt, '每個到達的點：in-degree − 1'); say('到達的每個點身上', 'in-degree 欄位扣 1'); },   // 5106.2
    async () => { dimNode(G, 'A'); S.pop('B'); ordTag(G, 'B', 2); G.paint('B', JC.ok); const z = dec('B'); await beat(tok, 300); for (const v of z) { glow(G.N[v], GOLD); S.push(v); } txt(nt, '有人扣到 0（C）→ 沒有 incoming 了 → 放進 S'); say('如果某個點扣到 0', '表示它沒有 incoming edge，放進 S'); },   // 5116.4
    () => { dimNode(G, 'B'); glow(G.N.C, null); txt(nt, '每次 delete：outgoing 對到的人 in-degree − 1'); say('每次做 delete', '就是把 outgoing 對到的人 in-degree 減 1'); },   // 5145.4
    () => { good('時間 ∝ outgoing list 長度，順便 update S', 0, 6.1); say('掃 outgoing edge list 的時間', '就能 update in-degree 和 S'); },   // 5157.0
  ]);
}]);

// 1:26:16 總時間 O(n + m)
FRAG.push(['graphjiang2-l9-ds-time', '總時間：n 次 order ＋ m 次 update = O(n + m)', async (tok) => {
  jFresh();
  let G = null, h = null, me = null;
  await seq(tok, [
    async () => { G = topoGraph({ drop: 2 }); h = head('Overall 要花多少時間？', 0, 6.75); await beat(tok, 300); for (const k of TORD) { glow(G.N[k], GOLD); await beat(tok, 120); } idx('每個點最多 order 一次：n', 5.0, 5.4); say('每個點', '最多 order 一次'); },   // 5176.8
    async () => { for (const k in G.N) glow(G.N[k], null); for (const ed of G.E) { ed.set(JC.hot); await beat(tok, 90); } idx('update in-degree：剛好 m 次', 5.0, 4.8); say('重點是 update in-degree 的時間', '有 m 條 edge，就 update 剛好 m 次'); },   // 5187.0
    () => { G.all(JC.edge); idx('每個點放進 S 一次：共 n 次', 5.0, 4.2); say('每個點剛好放進 S 一次', '一開始就是 0，或 in-degree 降到 0 時'); },   // 5199.0
    () => { idx('每個點進、出 S 各一次', 5.0, 3.6); say('每個點最多進出 S 一次', '進去一次、pop 一次'); },   // 5214.4
    () => { good('Overall：O(n + m)', 5.0, 2.8); say('Overall 來說', 'complexity 在 O(n + m)'); },   // 5224.4
    () => { cube('', JC.pink, [0.7, 2.4, 0.4], 4.2, 0.9, 0); cube('', JC.ok, [0.7, 0.7, 0.4], 5.8, 0.05, 0); idx('naive n²', 4.2, -0.5); idx('n + m', 5.8, -0.5); say('想得不清楚：寫出來是 n²', '想清楚一點：馬上變 n + m'); },   // 5233.4
    async () => { me = buddy('同學', '', '#9fb8ff', -3.6, -0.6, 0.4, 0.45); me.mood('happy'); await me.hop(tok); say('為什麼有同學寫得特別快？', '他的 data structure 厲害一點'); },   // 5256.0
  ]);
}]);

// 1:28:00 實際跑一次：in-degree ＋ S
FRAG.push(['graphjiang2-l9-ds-run', '實際跑一次：pop、編號、in-degree 減 1、歸零進 S', async (tok) => {
  jFresh();
  let G = null, h = null, nt = null, T = null, S = null, d = null;
  const num = (k, n) => { ordTag(G, k, n); G.paint(k, JC.ok); };
  const dec = (u) => { const z = []; for (const v of G.out(u)) { d[v]--; txt(T[v], 'in ' + d[v]); G.e(u, v).set(JC.hot); if (d[v] === 0) z.push(v); } return z; };
  const step2 = (k, n) => { S.pop(k); num(k, n); const z = dec(k); z.forEach((v) => S.push(v)); dimNode(G, k); };
  await seq(tok, [
    () => { G = topoGraph({ drop: 2 }); d = indeg(G); T = inTags(G); S = sBox(); h = head('Implementation：實際跑一次', 0, 6.75); say('根據剛剛的 implementation', '一開始做什麼？'); },   // 5278.0
    async () => { for (const k of TORD) { txt(T[k], 'in ' + d[k]); await beat(tok, 140); } nt = note('先掃一次 graph，算出每個點的 in-degree：O(n + m)', 0, -0.3); say('掃過一次 graph', '算出每個點的 in-degree：O(n + m)'); },   // 5285.0
    () => { txt(nt, '看起來很多，但只花這一次，不會再長大'); say('看起來好像很多時間', '但只會花在這裡，不會再長大'); },   // 5294.0
    () => { txt(nt, '每個點身上都有 in-degree 欄位'); say('掃完一次之後', '每個點身上有一個 in-degree 欄位'); },   // 5302.0
    () => { S.push('A'); S.push('B'); txt(nt, 'in-degree 為 0 的點 push 進 S'); say('一開始 in-degree 為 0 的點', 'push 到 S 這個 set 裡'); },   // 5311.0
    () => { txt(nt, '從 S pop 一個人出來：現在 S 裡有兩個'); say('接下來從 S 裡 pop 一個人出來', '現在 S 存了這兩個點'); },   // 5330.1
    () => { glow(G.N.A, GOLD); txt(nt, 'pop 右下角這個人（A）'); say('假設現在 pop 的', '是右下角這個人'); },   // 5337.0
    async () => { S.pop('A'); num('A', 1); glow(G.N.A, null); await pulse(tok, G.N.A); say('Order 它', '它就編號成 1 號'); },   // 5346.8
    () => { txt(nt, 'S 只剩左上角的 B'); say('它也從 S 離開', '目前 S 只剩左上角這個點'); },   // 5353.0
    () => { txt(nt, '想像把 1 從 graph 拔掉，但不真的拔 edge'); say('想像中把 1 從 graph 拔掉', '但其實沒有真的把 edge 拔掉'); },   // 5361.0
    async () => { for (const v of G.out('A')) { G.e('A', v).set(JC.hot); await zip(tok, G, 'A', v, '●', 300); } txt(nt, '看 1 的 outgoing：到達 D、E、G 三個鄰居'); say('看 1 的 outgoing edge 到達誰', 'list 上記錄了這三個鄰居'); },   // 5371.0
    () => { dec('A'); txt(nt, '三個鄰居的 in-degree 欄位 − 1'); say('把這三個鄰居的', 'in-degree 欄位減 1'); },   // 5384.0
    () => { dimNode(G, 'A'); txt(nt, '只減 1：還沒有人降到 0'); say('只做減 1 的動作', '還沒有人降到 incoming edge 為 0'); },   // 5390.1
    () => { glow(G.N.B, GOLD); txt(nt, '下一個 iteration：pop 左上角的 B'); say('下一個 iteration 再 pop 一個人', '一定是左上角這個人'); },   // 5402.7
    async () => { S.pop('B'); num('B', 2); glow(G.N.B, null); await pulse(tok, G.N.B); say('Order 它', '編號它'); },   // 5415.0
    () => { dec('B'); txt(nt, 'B 的三個 outgoing：in-degree 各減 1'); say('它 outgoing 出去的這三個人', 'in-degree 要減 1'); },   // 5418.5
    async () => { glow(G.N.C, GOLD); await pulse(tok, G.N.C); txt(nt, 'C 原本 in-degree 是 1，減 1 瞬間變 0'); say('右上角這個人原來 in-degree 是 1', '減 1 的瞬間到達 0'); },   // 5426.9
    () => { S.push('C'); glow(G.N.C, null); dimNode(G, 'B'); txt(nt, '把 C push 進 S'); say('一發生扣到 0', '就把右上角這個點 push 到 S 裡'); },   // 5441.0
    () => { S.pop('C'); num('C', 3); txt(nt, '下一輪：pop C，編成 3 號'); say('進入下一個 iteration', 'pop 右上角的點，order 成 3 號'); },   // 5448.0
    () => { dec('C'); txt(nt, 'C 往下兩條 outgoing：D、F 的 in-degree 減 1'); say('這兩條往下的 outgoing edge', '對應兩個點的 in-degree 減 1'); },   // 5456.0
    () => { S.push('D'); dimNode(G, 'C'); txt(nt, '產生新的 in-degree 0（D）→ push 進 S'); say('一樣產生一個新的 in-degree 為 0 的點', 'push 到 S 裡面去'); },   // 5460.5
    () => { step2('D', 4); txt(nt, 'Iteratively：D 編 4 號，E 降到 0 進 S'); say('依此類推', 'iteratively 這樣做'); },   // 5467.4
    () => { step2('E', 5); txt(nt, 'E 編 5 號，F 降到 0 進 S'); say('直到最後一刻', ''); },   // 5471.4
    async () => { step2('F', 6); await beat(tok, 400); step2('G', 7); txt(nt, 'F 編 6 號、G 編 7 號'); say('S pop 掉之後完成 order', 'in-degree 都扣光了'); },   // 5477.6
    () => { txt(nt, '再去 check S：空了'); say('這時候再去 check S', '發現 S 是空的'); },   // 5479.6
    () => { good('沒有人能再 order：做完了，每個點都有編號', 0, 6.1); say('沒有人可以再 order 下去', '每個人都完成 labeling，結束'); },   // 5485.0
    () => { txt(nt, '每條 edge 只被檢查兩次：算 in-degree 一次、減 1 一次'); say('每條 edge 真正 check 的次數：', '算 in-degree 一次、減 1 時一次'); },   // 5501.3
  ]);
}]);

// 1:32:17 小結：這個版本最自然；另一種做法是 DFS
FRAG.push(['graphjiang2-l9-topo-wrap', '小結：一層一層削掉的做法 vs DFS 做法', async (tok) => {
  jFresh();
  let G = null, h = null, nt = null;
  await seq(tok, [
    () => { G = topoGraph({ drop: 2 }); TORD.forEach((k, i) => ordTag(G, k, i + 1)); h = head('Topological ordering 小結', 0, 6.75); say('以上就是 topological ordering', '回去應該能自己寫一個'); },   // 5536.9
    () => { nt = note('這個版本：最自然、最直覺、最好寫', 0, -0.3); say('這個版本的 topological order', '最自然、最直覺、最好寫'); },   // 5547.4
    () => { txt(nt, '另一種做法：用 DFS'); say('Topological order 也有另一種做法', '用 DFS 來做'); },   // 5559.0
    () => { txt(nt, 'DFS 版：需要另一個 property 來 support'); say('但它的條件是', '需要另外一個 property 來 support 它'); },   // 5570.1
    async () => { for (const L of [['A', 'B'], ['C'], ['D'], ['E'], ['F'], ['G']]) { L.forEach((k) => dimNode(G, k)); await beat(tok, 300); } txt(nt, '這個做法像 BFS：一層一層把圖從外圍削小'); say('這個做法很像 BFS 的感覺', '一層一層把圖從外圍削小'); },   // 5585.0
    () => { txt(nt, 'DFS 版：配合 labeling 的特性（finishing time）'); say('另一個做法用 DFS', '要配合一些 labeling 的特性'); },   // 5600.0
    () => { icon('📕', 'CLRS（Cormen）用 DFS 的做法', 4.8, 5.0); say('Cormen 那本白色的 bible', '用的就是 DFS 的做法'); },   // 5614.0
    () => { good('這個方法最自然、最容易接受', 0, 6.1); say('但這個方法最自然', '而且最容易接受'); },   // 5622.0
  ]);
}]);
  }

  // ═══ graphmisc.js ═══
  {
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, line, GOLD, step, travel, remove, anim, buddy, prop, bob, code, txt, arrow } = K;
// ═══ graphmisc：Abdul Bari AP／BFS-DFS、Tushar Roy 拓撲排序／SCC、MIT 6.006 Rec16 ═══
// 每個場景都是 gmSeq(tok, [f1, f2, …])：每一項前面 await step(tok)，所以 fi 只在老師說到那句話時才執行。
const GM = { idle: '#cdbfa6', vis: '#2fc092', done: '#1d8a68', edge: '#9c8b70', tree: '#c08a1f', hot: '#d64545', blue: '#4b9ee2', pink: '#e55a9b', purple: '#9b7fd1', amber: '#e0a030', gray: '#d8cfc0' };
const GM_UP = V3(0, 1, 0);
const GM_CAM = [0, 8.5, 11], GM_LOOK = [0, 1.4, 0.6];
async function gmSeq(tok, fns) { for (const f of fns) { await step(tok); if (f) await f(); } }
const gmWait = (tok, ms) => anim(tok, ms, () => {});
function gmRod(a, b, o = {}) {
  const gap = o.gap ?? 0.45, r = o.r ?? 0.05;
  const n = b.clone().sub(a).normalize();
  const s = a.clone().addScaledVector(n, gap), e = b.clone().addScaledVector(n, -gap);
  const L = Math.max(0.05, s.distanceTo(e) - (o.directed ? 0.3 : 0));
  const mat = new THREE.MeshStandardMaterial({ color: o.color || GM.edge, roughness: 0.6 });
  const g = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 8), mat);
  cyl.position.copy(s).addScaledVector(n, L / 2); cyl.quaternion.setFromUnitVectors(GM_UP, n); g.add(cyl);
  if (o.directed) { const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 12), mat); cone.position.copy(e).addScaledVector(n, -0.17); cone.quaternion.setFromUnitVectors(GM_UP, n); g.add(cone); }
  g.userData = { mat, cyl }; lab.world.add(g); return g;
}
function gmPaint(g, color, thick) { if (!g) return; g.userData.mat.color.set(color); const k = thick ? 1.9 : 1; g.userData.cyl.scale.set(k, 1, k); }
const gmKill = (o) => { if (!o) return; lab.world.remove(o); o.traverse((c) => { if (c.element) c.element.remove(); }); };
// a dashed arc between two points (bulging up, or sideways in an upright plane when side is given)
function gmArc(p, q, color = GM.hot, side = null) {
  const mid = p.clone().add(q).multiplyScalar(0.5);
  if (side === null) mid.y += 1.0; else { const d = q.clone().sub(p); mid.add(V3(-d.y, d.x, 0).normalize().multiplyScalar(side)); }
  const geo = new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(p, mid, q).getPoints(18));
  const l = new THREE.Line(geo, new THREE.LineDashedMaterial({ color, dashSize: 0.14, gapSize: 0.1 }));
  l.computeLineDistances(); lab.world.add(l); return l;
}
// graph on the floor: spec = { pos: {name: [x, z]}, edges: [[u, v]], directed }
function gmGraph(spec) {
  const dir = !!spec.directed, vs = {}, es = {}, adj = {};
  for (const k in spec.pos) {
    const [x, z] = spec.pos[k]; const m = lab.box(GM.idle, [0.7, 0.6, 0.7]);
    m.add(lab.label(String(k), 'val')); m.position.set(x, 0.3, z); lab.world.add(m); vs[k] = m; adj[k] = [];
  }
  const key = (u, v) => (dir ? u + '>' + v : [String(u), String(v)].sort().join('-'));
  const G = { vs, es, adj, dir, key, spec, walker: null };
  const mk = (u, v) => { es[key(u, v)] = gmRod(vs[u].position, vs[v].position, { directed: dir }); };
  for (const [u, v] of spec.edges) { mk(u, v); adj[u].push(v); if (!dir) adj[v].push(u); }
  G.e = (u, v) => es[key(u, v)] || es[key(v, u)];
  G.paint = (u, v, c, thick) => gmPaint(G.e(u, v), c, thick);
  G.color = (v, c) => tint(vs[v], c);
  G.colors = (list, c) => list.forEach((v) => tint(vs[v], c));
  G.glow = (v, c) => glow(vs[v], c === undefined ? GOLD : c);
  G.at = (v, y = 1.1) => { const p = vs[v].position; return V3(p.x, y, p.z); };
  G.note = (v, text, cls = 'note', y = 1.35) => { const p = vs[v].position; return tag(text, cls, p.x, y, p.z); };
  G.hop = async (tok, u, v, text = '→', ms = 450) => { const h = tag(text, 'pkt', 0, 0, 0); await travel(tok, h, G.at(u), G.at(v), ms); remove(h); };
  G.reset = () => { for (const k in vs) { tint(vs[k], GM.idle); glow(vs[k], null); } for (const k in es) gmPaint(es[k], GM.edge, false); };
  // a little buddy who walks from vertex to vertex
  G.go = async (tok, v, ms = 550) => {
    const p = vs[v].position;
    if (!G.walker) { G.walker = buddy('', '', '#f4a56a', p.x, 0.6, p.z, 0.42); return; }
    const g = G.walker.g, a = g.position.clone();
    await anim(tok, ms, (u) => g.position.set(a.x + (p.x - a.x) * u, 0.6, a.z + (p.z - a.z) * u));
  };
  G.mood = (m) => { if (G.walker) G.walker.mood(m); };
  // flip every edge (reverse graph)
  G.reverse = () => {
    const old = Object.keys(es).map((k) => k.split('>'));
    for (const k in es) { gmKill(es[k]); delete es[k]; }
    for (const k in adj) adj[k] = [];
    for (const [u, v] of old) { mk(v, u); adj[v].push(u); }
  };
  return G;
}
// a floor row of small cubes, x = x0 + i dx
function gmRow(x0, z, label, dx = 0.62) {
  const R = { items: [], vals: [], lbl: label ? tag(label, 'idx', x0 - 0.2, 0.05, z - 0.62) : null };
  if (R.lbl) R.lbl.center.set(0, 0.5);
  const X = (i) => x0 + i * dx;
  R.push = (v, color = GM.vis) => { R.items.push(cube(v, color, [0.5, 0.5, 0.5], X(R.items.length), 0.25, z, 1.4)); R.vals.push(v); };
  R.shift = () => { const m = R.items.shift(); R.vals.shift(); if (m) fly(m, V3(0, 6, -3)); R.items.forEach((o, i) => move(o, X(i), 0.25, z)); };
  R.clear = () => { R.items.forEach((m) => kill(m)); R.items = []; R.vals = []; };
  R.tintAll = (c) => R.items.forEach((m) => tint(m, c));
  return R;
}
// a vertical stack of cubes (top = last pushed)
function gmStack(x, z, label) {
  const S = { items: [], vals: [] };
  tag(label, 'idx', x, 0.05, z + 0.75);
  S.push = (v, color = GM.blue) => { S.items.push(cube(v, color, [0.55, 0.5, 0.55], x, 0.28 + S.items.length * 0.54, z, 1.6)); S.vals.push(v); };
  S.pop = () => { const m = S.items.pop(); S.vals.pop(); if (m) fly(m, V3(2, 6, -3)); };
  S.top = () => S.items[S.items.length - 1];
  return S;
}

// ─────────── jFZsDDB0-vo：Abdul Bari〈Articulation Point and Biconnected Components〉 ───────────
// 圖（逐字稿重建）：1-4、4-3、3-2、2-1、3-5、5-6、6-3。DFS 從 1：1→4→3→5→6（6-3 back edge）→ 回 3 → 2（2-1 back edge）。
// d：1=1、4=2、3=3、5=4、6=5、2=6；L：1、4、3、2 = 1；5、6 = 3。L[5]=3 ≥ d[3]=3 → 3 是 articulation point。
const AP = { pos: { 1: [-6.0, -2.2], 4: [-3.6, -2.2], 3: [-3.6, 0.6], 2: [-6.0, 0.6], 5: [-1.4, -0.6], 6: [-1.4, 1.9] },
  edges: [[1, 4], [4, 3], [3, 2], [2, 1], [3, 5], [5, 6], [6, 3]] };
const AP_T = { 1: [3.6, 6.6], 4: [3.6, 5.2], 3: [3.6, 3.8], 5: [2.0, 2.4], 6: [2.0, 1.0], 2: [5.2, 2.4] }, AP_TZ = 0.4;
const AP_PAR = { 4: 1, 3: 4, 5: 3, 6: 5, 2: 3 }, AP_D = { 1: 1, 4: 2, 3: 3, 5: 4, 6: 5, 2: 6 }, AP_L = { 1: 1, 4: 1, 3: 1, 5: 3, 6: 3, 2: 1 };
const AP_ORD = [1, 4, 3, 5, 6, 2];
function apTree(T, v) {
  const [x, y] = AP_T[v]; T.n[v] = cube(v, GM.vis, [0.5, 0.5, 0.5], x, y, AP_TZ);
  if (AP_PAR[v]) { const [px, py] = AP_T[AP_PAR[v]]; T.l[v] = line(px, py - 0.25, x, y + 0.25, AP_TZ, '#c08a1f'); }
}
const apTP = (v, dx = 0, dy = 0) => V3(AP_T[v][0] + dx, AP_T[v][1] + dy, AP_TZ);
function apBack(T, u, v) { T.b.push(gmArc(apTP(u), apTP(v), GM.hot, u === 6 ? 0.55 : -0.7)); }
// one label per tree node (d, later d and L), on the outer side of its column so the labels never crowd
const apX = (v) => AP_T[v][0] + (AP_T[v][0] < 3 ? -1.4 : 1.4);
const apD = (T, v) => { T.d[v] = tag('d=' + AP_D[v], 'idx', apX(v), AP_T[v][1], AP_TZ); };
const apL = (T, v) => { const l = T.d[v] || tag('', 'idx', apX(v), AP_T[v][1], AP_TZ); l.element.textContent = 'd=' + AP_D[v] + '  L=' + AP_L[v]; l.element.className = 'lab-label good'; T.d[v] = T.L[v] = l; };
// the whole picture up to a stage: 'tree' | 'd' | 'L'
function apBase(stage) {
  fresh(GM_CAM, GM_LOOK);
  const G = gmGraph(AP), T = { n: {}, l: {}, b: [], d: {}, L: {} };
  if (!stage) return { G, T };
  AP_ORD.forEach((v) => { apTree(T, v); G.color(v, GM.vis); if (AP_PAR[v]) G.paint(AP_PAR[v], v, GM.tree, true); });
  apBack(T, 6, 3); apBack(T, 2, 1); G.paint(6, 3, GM.hot); G.paint(2, 1, GM.hot);
  tag('DFS spanning tree', 'ptr alt', 3.6, 7.6, AP_TZ);
  if (stage === 'd' || stage === 'L') AP_ORD.forEach((v) => apD(T, v));
  if (stage === 'L') AP_ORD.forEach((v) => apL(T, v));
  return { G, T };
}
async function apLift(tok, G, v, up) {
  const m = G.vs[v], y0 = m.position.y, y1 = up ? 2.4 : 0.3;
  await anim(tok, 600, (u) => { m.position.y = y0 + (y1 - y0) * u; });
}

// 0:00 什麼是 articulation point；加一條邊就沒有了
FRAG.push(['graphmisc-ap-what', 'Articulation point：拿掉就斷開的頂點', async (tok) => {
  fresh(GM_CAM, GM_LOOK);
  let G = null, n = null, mon = null;
  await gmSeq(tok, [
    () => { tag('Articulation Point（關節點）', 'say', 2.6, 2.2, -1.6); tag('Biconnected Components', 'say', 2.6, 1.5, -1.6); say('主題：articulation point', '和 biconnected components'); },
    () => { G = gmGraph(AP); n = tag('拿掉它 → 圖斷成好幾塊', 'note', 2.6, 1.0, 0.2); say('articulation point：拿掉它，圖就斷成好幾塊', '先看例子'); },
    async () => { G.glow(3); await G.go(tok, 3); say('這張圖裡的關鍵：頂點 3'); },
    async () => { G.walker.g.visible = false; await apLift(tok, G, 3, true); for (const [u, v] of [[3, 4], [3, 2], [3, 5], [3, 6]]) G.paint(u, v, GM.gray); G.colors([1, 4, 2], GM.blue); say('拿掉 3：1、4、2 變成一塊', 'component 1'); },
    () => { G.colors([5, 6], GM.pink); say('5、6 變成另一塊', '所以 3 是 articulation point'); },
    () => { remove(n); mon = prop('monitor', 3.6, 0, 1.4, 0.8, '網路'); n = tag('一個點壞掉，整個網路就斷成兩塊', 'bad', 2.6, 1.0, -0.6); say('道路網、電腦網路：不希望有 articulation point', '它一出問題，網路就裂開'); },
    async () => { remove(n); await apLift(tok, G, 3, false); G.reset(); G.glow(3); n = tag('解法：先找出兩邊的 component', 'note', 2.6, 1.0, -0.6); say('想移除 articulation point', '先看出兩邊各是哪些點'); },
    async () => { await G.hop(tok, 4, 5, '＋', 500); gmRod(G.vs[4].position, G.vs[5].position, { color: GM.tree, r: 0.08 }); remove(n); n = tag('在兩塊之間加一條邊 4–5', 'good', 2.6, 1.0, -0.6); say('在兩個 component 之間加一條邊', '4 — 5'); },
    async () => { await apLift(tok, G, 3, true); for (const [u, v] of [[3, 4], [3, 2], [3, 5], [3, 6]]) G.paint(u, v, GM.gray); G.colors([1, 4, 2, 5, 6], GM.blue); say('現在再拿掉 3：5、6 透過 4 還連著', '圖沒有斷'); },
    async () => { await apLift(tok, G, 3, false); G.reset(); remove(n); tag('沒有 articulation point 了', 'good', 2.6, 1.0, -0.6); if (mon) gmKill(mon); say('沒有 articulation point', '方法：用一條邊把 component 連起來'); },
  ]);
}]);

// 1:55 步驟 1：DFS spanning tree
FRAG.push(['graphmisc-ap-dfs', '步驟 1：畫出 DFS spanning tree', async (tok) => {
  const { G, T } = apBase(null);
  let n = null, mon = null;
  const visit = async (u, v) => { if (u) await G.hop(tok, u, v); await G.go(tok, v, 350); G.color(v, GM.vis); if (u) G.paint(u, v, GM.tree, true); apTree(T, v); };
  await gmSeq(tok, [
    () => { mon = prop('monitor', 3.4, 0, 0.6, 0.9); n = tag('電腦看不出來 → 需要一套 algorithm', 'note', 3.4, 2.6, 0.6); say('人一眼看得出來', '電腦要靠一套步驟（algorithm）'); },
    () => { gmKill(mon); remove(n); tag('步驟 1：DFS spanning tree', 'ptr alt', 3.6, 7.6, AP_TZ); say('步驟 1：做 DFS，畫出 DFS spanning tree', '要的是樹，不是走訪結果'); },
    async () => { await G.go(tok, 1); G.color(1, GM.vis); apTree(T, 1); say('從 1 開始'); },
    () => visit(1, 4).then(() => say('1 → 4')),
    () => visit(4, 3).then(() => say('4 → 3')),
    () => visit(3, 5).then(() => say('3 → 5')),
    () => visit(5, 6).then(() => say('5 → 6')),
    () => { G.paint(6, 3, GM.hot); apBack(T, 6, 3); say('6 有一條邊連回 3', '紅色虛線：back edge'); },
    async () => { await G.go(tok, 5, 350); await G.go(tok, 3, 350); say('6 沒有別的鄰居 → 回到 5，再回到 3'); },
    () => visit(3, 2).then(() => say('3 還有鄰居 2 → 走到 2')),
    () => { G.paint(2, 1, GM.hot); apBack(T, 2, 1); say('2 有一條邊連回 1', '又是一條 back edge'); },
    async () => { await G.go(tok, 3, 300); await G.go(tok, 4, 300); await G.go(tok, 1, 300); G.colors(AP_ORD, GM.done); say('2、3、4、1 都沒有新鄰居', '全部探索完'); },
    () => { tag('DFS spanning tree', 'good', 3.6, 7.6, AP_TZ - 0.3); say('這就是 DFS spanning tree', '虛線 = back edge'); },
  ]);
}]);

// 3:05 步驟 2：discovery time
FRAG.push(['graphmisc-ap-d', '步驟 2：每個頂點的 discovery time', async (tok) => {
  const { G, T } = apBase('tree');
  const one = async (v) => { G.glow(v); await G.go(tok, v, 400); apD(T, v); say('d[' + v + '] = ' + AP_D[v], '第 ' + AP_D[v] + ' 個被拜訪'); G.glow(v, null); };
  await gmSeq(tok, [
    () => { tag('d = discovery time（被拜訪的順序）', 'note', -3.8, 0.9, -3.4); say('步驟 2：寫下 discovery time d', '照被拜訪的順序編號'); },
    () => one(1), () => one(4), () => one(3), () => one(5), () => one(6), () => one(2),
    () => {
      const xs = [1, 2, 3, 4, 5, 6];
      tag('v', 'idx', -6.6, 0.1, 3.2); tag('d', 'idx', -6.6, 0.1, 4.0);
      xs.forEach((v, i) => { tag(String(v), 'val', -5.6 + i * 1.0, 0.1, 3.2); tag(String(AP_D[v]), 'say', -5.6 + i * 1.0, 0.1, 4.0); });
      say('整理成表：頂點 1–6 的 d', '1→1、2→6、3→3、4→2、5→4、6→5');
    },
  ]);
}]);

// 4:01 步驟 3：low number
FRAG.push(['graphmisc-ap-low', '步驟 3：lowest number L', async (tok) => {
  const { G, T } = apBase('d');
  const lw = async (v, path) => {
    G.glow(v); for (let i = 0; i + 1 < path.length; i++) await G.hop(tok, path[i], path[i + 1], '→', 380);
    apL(T, v); say('L[' + v + '] = ' + AP_L[v], '路線：' + path.join(' → ')); G.glow(v, null);
  };
  await gmSeq(tok, [
    () => { tag('L[v]：往下走樹邊，再走「一條」back edge，能到的最小 d', 'note', 0, 1.0, 3.4); say('步驟 3：找 lowest number L', '可以走一條 back edge'); },
    async () => { for (const b of T.b) b.material.color.set('#ff2a2a'); await gmWait(tok, 300); say('這兩條虛線就是 back edge', '6 → 3、2 → 1'); },
    () => lw(1, [1]),
    () => lw(2, [2, 1]),
    () => lw(3, [3, 2, 1]),
    () => lw(4, [4, 3, 2, 1]),
    () => lw(5, [5, 6, 3]),
    () => lw(6, [6, 3]),
  ]);
}]);

// 5:14 步驟 4：L[v] ≥ d[u]
FRAG.push(['graphmisc-ap-cond', '步驟 4：L[v] ≥ d[u] → u 是 articulation point', async (tok) => {
  const { G, T } = apBase('L');
  let n = null, a = null, b = null;
  const pair = (u, v) => { glow(T.n[u], GOLD); glow(T.n[v], '#1a4a8a'); };
  const unpair = () => AP_ORD.forEach((k) => glow(T.n[k], null));
  await gmSeq(tok, [
    () => { n = tag('步驟 4：找出 articulation point', 'ptr alt', 0, 1.0, 3.2); say('步驟 4：找 articulation point', '看條件'); },
    async () => { for (const [u, v] of [[1, 4], [4, 3], [3, 5], [5, 6], [3, 2]]) { pair(u, v); await gmWait(tok, 380); unpair(); } a = tag('u = parent　v = child', 'note', 4.4, 0.6, 3.0); say('u 是 parent、v 是 child', '在 DFS spanning tree 裡相鄰'); },
    () => { b = tag('L[v] ≥ d[u]', 'say', 4.4, 0.6, 2.2); remove(a); say('條件：L[v] ≥ d[u]', 'child 的 L 不小於 parent 的 d'); },
    () => { a = tag('成立 → u 是 articulation point', 'good', 4.4, 0.6, 3.0); say('條件成立 → u 是 articulation point'); },
    () => { glow(T.n[1], '#555555'); a.element.textContent = '根（root）除外'; say('這個條件不能用在 root', '先跳過 root'); },
    () => { glow(T.n[1], null); pair(4, 3); say('看 u = 4、v = 3'); },
    () => { a.element.textContent = 'L[3] = 1　d[4] = 2'; say('L[3] = 1，d[4] = 2'); },
    () => { a.element.textContent = '1 ≥ 2？不成立'; a.element.className = 'lab-label bad'; say('1 ≥ 2？不成立', '4 不是 articulation point'); },
    () => { unpair(); pair(3, 5); a.element.className = 'lab-label note'; a.element.textContent = 'u = 3　v = 5'; say('下一對：u = 3、v = 5'); },
    () => { a.element.textContent = 'L[5] = 3 ≥ d[3] = 3 ✔'; a.element.className = 'lab-label good'; say('d[3] = 3，L[5] = 3', '3 ≥ 3 成立！'); },
    async () => { G.color(3, GM.hot); G.glow(3); await G.go(tok, 3); G.mood('wow'); tag('3 是 articulation point', 'bad', AP.pos[3][0], 1.6, AP.pos[3][1]); say('所以 3 是 articulation point'); },
  ]);
}]);

// 7:04 寫成程式，找到就加邊
FRAG.push(['graphmisc-ap-algo', '寫成程式：兩個陣列＋一個比較，找到就加邊', async (tok) => {
  const { G } = apBase('L');
  let C = null;
  await gmSeq(tok, [
    () => { C = code(['1. DFS，記下每個點的 d', '2. 遇到 back edge，更新 L', '3. 比較 L[v] ≥ d[u]', '4. 找到 → 兩邊之間加一條邊'], -3.6, 2.2, 0.5, 3.0); say('這就是找 articulation point 的 algorithm'); },
    () => { C.hl(0); say('程式：做 DFS，同時記下 DFS number d'); },
    () => { C.hl(1); say('每遇到一條 back edge', '就更新 lowest number L'); },
    () => { C.hl(2); G.color(3, GM.hot); say('有了 d、L 兩個陣列，逐一比較', '條件成立的點就是 articulation point'); },
    async () => { C.hl(3); G.colors([1, 4, 2], GM.blue); G.colors([5, 6], GM.pink); gmRod(G.vs[4].position, G.vs[5].position, { color: GM.tree, r: 0.08 }); await G.hop(tok, 4, 5, '＋'); say('找到 → 一邊一個 component', '在它們之間加一條邊'); },
    () => { G.colors([1, 4, 2, 5, 6], GM.vis); G.color(3, GM.vis); tag('圖變得更「強壯」', 'good', -3.6, 2.4, -3.4); say('這樣圖就更強壯', '沒有 articulation point'); },
  ]);
}]);

// 8:05 root 的特例
FRAG.push(['graphmisc-ap-root', 'Root 的條件：有兩個以上的 child', async (tok) => {
  const { T } = apBase('L');
  let n = null, extra = null, el = null;
  await gmSeq(tok, [
    () => { glow(T.n[1], GOLD); n = tag('root：上面的條件不能用', 'note', 0, 1.0, 3.4); say('最後：root 怎麼判斷？', '上面的條件對 root 永遠成立，不能用'); },
    () => { n.element.textContent = 'root 只有一個 child（4）→ 不是'; say('這裡 root 只有一個 child'); },
    async () => { extra = cube('?', GM.amber, [0.5, 0.5, 0.5], 2.0, 5.2, AP_TZ, 1.2); el = line(3.6, 6.35, 2.0, 5.45, AP_TZ, '#c08a1f'); await gmWait(tok, 300); say('假設 root 多了一個 child'); },
    () => { n.element.textContent = 'root 有 ≥ 2 個 child → root 是 articulation point'; n.element.className = 'lab-label good'; say('root 有好幾個 child', '→ root 就是 articulation point'); },
  ]);
}]);

// ─────────── ddTC4Zovtbc：Tushar Roy〈Topological Sort〉 ───────────
// 講解圖：A→C、B→C、B→D、C→E、D→F、E→F、E→H、F→G（定義段沒有 H）；程式碼段的圖 D、E 對調、沒有 H。
const TP = { directed: true, pos: { A: [-6.0, -2.2], B: [-6.0, 1.0], C: [-3.6, -2.2], D: [-3.6, 1.0], E: [-1.2, -2.2], F: [-1.2, 1.0], G: [1.2, 1.0], H: [1.2, -2.2] },
  edges: [['A', 'C'], ['B', 'C'], ['B', 'D'], ['C', 'E'], ['D', 'F'], ['E', 'F'], ['E', 'H'], ['F', 'G']] };
const TP7 = { directed: true, pos: Object.fromEntries(Object.entries(TP.pos).filter(([k]) => k !== 'H')), edges: TP.edges.filter((e) => e[1] !== 'H') };
const TP2 = { directed: true, pos: { A: [-6.2, -2.0], B: [-6.2, 1.0], C: [-4.2, -2.0], E: [-4.2, 1.0], D: [-2.2, -2.0], F: [-2.2, 1.0], G: [-0.2, 1.0] },
  edges: [['A', 'C'], ['B', 'C'], ['B', 'E'], ['C', 'D'], ['D', 'F'], ['E', 'F'], ['F', 'G']] };

// 0:00 定義
FRAG.push(['graphmisc-topo-def', 'Topological sort：每條邊 u→v，u 排在 v 前面', async (tok) => {
  fresh(GM_CAM, GM_LOOK);
  let G = null, n = null, r1 = null, r2 = null;
  await gmSeq(tok, [
    () => { tag('Topological sort（拓撲排序）', 'say', 3.6, 2.0, -1.6); say('主題：topological sort'); },
    () => { G = gmGraph(TP7); n = tag('DAG：有方向、沒有環', 'note', 3.6, 1.2, -0.6); say('給一張 directed acyclic graph（DAG）'); },
    async () => { G.paint('A', 'C', GM.tree, true); G.note('A', 'u', 'ptr'); G.note('C', 'v', 'ptr alt'); await G.hop(tok, 'A', 'C'); remove(n); n = tag('每條邊 u → v：u 一定排在 v 前面', 'note', 3.6, 1.2, -0.6); say('排出頂點的順序：', '每條邊 u→v，u 都要在 v 前面'); },
    async () => { r1 = gmRow(-6.0, 2.8, '一種排法'); for (const v of 'ABCEDFG') { r1.push(v); await gmWait(tok, 160); } say('一種排法：A B C E D F G'); },
    async () => { r2 = gmRow(-6.0, 4.0, '另一種'); for (const v of 'BDACEFG') { r2.push(v, GM.blue); await gmWait(tok, 160); } say('另一種：B D A C E F G', '答案不只一個'); },
    async () => { for (const [u, v] of [['A', 'C'], ['B', 'C'], ['B', 'D'], ['C', 'E']]) { G.paint(u, v, GM.hot, true); await gmWait(tok, 250); } say('重點：C 不能在 A、B 前面', 'D 不能在 B 前面、E 不能在 C 前面……'); },
  ]);
}]);

// 0:53 應用：build system
FRAG.push(['graphmisc-topo-build', '應用：build system 決定建置順序', async (tok) => {
  fresh(GM_CAM, GM_LOOK);
  const G = gmGraph(TP7);
  let n = null, bx = null;
  await gmSeq(tok, [
    () => { bx = prop('parcel', 4.0, 0, -1.2, 1.0, 'package'); bob(bx); say('應用：build system（建置系統）'); },
    async () => { for (const u of ['A', 'B']) { G.paint(u, 'C', GM.tree, true); await G.hop(tok, u, 'C'); } n = G.note('C', 'C 依賴 A、B'); say('每個頂點是一個 package', 'C 依賴 A 和 B'); },
    async () => { remove(n); G.paint('B', 'D', GM.tree, true); G.paint('C', 'E', GM.tree, true); await G.hop(tok, 'B', 'D'); n = tag('D 依賴 B、E 依賴 C', 'note', 3.6, 1.6, 0.6); say('D 依賴 B，E 依賴 C……'); },
    () => { remove(n); n = tag('要先 build 哪一個？', 'bad', 3.6, 1.6, 0.6); say('build system 怎麼知道先 build 誰？'); },
    async () => { remove(n); const r = gmRow(-6.0, 3.0, 'topological sort'); for (const v of 'ABCEDFG') { r.push(v); await gmWait(tok, 150); } say('建出 package 的圖，做 topological sort', '得到一種順序'); },
    async () => { for (const v of 'ABCEDFG') { G.color(v, GM.vis); await gmWait(tok, 280); } say('照這個順序 build：A、B 先', '然後 C，再來 E、D、F、G'); },
  ]);
}]);

// 1:37 用 DFS 做：visited set + stack
FRAG.push(['graphmisc-topo-walk', '用 DFS 做：visited set 與 stack', async (tok) => {
  fresh(GM_CAM, GM_LOOK);
  const G = gmGraph(TP);
  let n = null, setR = null, S = null, res = null;
  const vis = (v) => { G.color(v, GM.vis); setR.push(v, GM.vis); };
  const go = async (u, v) => { await G.hop(tok, u, v); await G.go(tok, v, 380); };
  const fin = (v) => { G.color(v, GM.done); S.push(v); };
  const nt = (text, cls = 'note') => { remove(n); n = tag(text, cls, 3.4, 1.8, 2.4); };
  await gmSeq(tok, [
    () => { nt('怎麼做 topological sort？'); say('接下來看怎麼做'); },
    () => { setR = gmRow(-6.0, 3.0, 'visited set'); S = gmStack(4.6, -0.8, 'stack'); say('兩個資料結構：一個 set、一個 stack'); },
    () => { nt('set：拜訪過的點　stack：排好的順序'); say('set 放拜訪過的點', 'stack 放排好的順序'); },
    () => { nt('從任意一點開始'); say('從任何一點開始都可以'); },
    async () => { await G.go(tok, 'E'); G.glow('E'); say('假設從 E 開始'); },
    () => { vis('E'); say('E 不在 visited → 放進 visited'); },
    () => go('E', 'H').then(() => say('探索 E 的 children：往 H 走')),
    () => { vis('H'); say('H 沒拜訪過 → 放進 visited'); },
    () => { G.glow('H'); say('H 沒有 children', 'H 完全探索完了'); },
    () => { G.glow('H', null); fin('H'); say('這時才把 H 放進 stack'); },
    () => { nt('全部 children 探索完，才放進 stack', 'good'); say('規則：一個點的 children 都探索完', '才把它放進 stack'); },
    () => go('H', 'E').then(() => go('E', 'F')).then(() => say('回到 E；E 還有 child F')),
    () => { vis('F'); say('F 不在 visited → 放進 visited'); },
    () => go('F', 'G').then(() => say('F 有 child G')),
    () => { vis('G'); say('G 沒拜訪過 → 放進 visited'); },
    () => { G.glow('G'); say('G 沒有 children'); },
    () => { G.glow('G', null); fin('G'); say('G 探索完 → 放進 stack'); },
    () => go('G', 'F').then(() => say('回到 F：沒有別的 child 了')),
    () => { fin('F'); say('F 放進 stack'); },
    async () => { await go('F', 'E'); fin('E'); G.glow('E', null); say('回到 E：children 都探索完', 'E 放進 stack'); },
    () => { nt('再挑一個還沒拜訪的點'); say('再挑任何一個還沒拜訪的點'); },
    async () => { await G.go(tok, 'B', 700); G.glow('B'); say('假設挑 B'); },
    () => { vis('B'); say('B 放進 visited'); },
    () => go('B', 'C').then(() => say('探索 B 的 child：挑 C')),
    () => { vis('C'); say('C 不在 visited → 放進 visited'); },
    async () => { await G.hop(tok, 'C', 'E', '✗'); say('C 的 child E 已經拜訪過', '什麼都不做'); },
    () => { fin('C'); say('C 沒有別的 child → C 放進 stack'); },
    async () => { await go('C', 'B'); await go('B', 'D'); vis('D'); say('回到 B；B 還有 child D', 'D 放進 visited'); },
    async () => { await G.hop(tok, 'D', 'F', '✗'); say('D 的 child F 已經拜訪過', '不走過去'); },
    () => { fin('D'); say('D 沒有 child 可探索 → D 放進 stack'); },
    async () => { await go('D', 'B'); fin('B'); G.glow('B', null); say('回到 B：兩個 children 都探索完', 'B 放進 stack'); },
    async () => { await G.go(tok, 'A', 700); G.glow('A'); say('還沒拜訪的只剩 A'); },
    () => { vis('A'); say('A 放進 visited'); },
    async () => { await G.hop(tok, 'A', 'C', '✗'); say('A 的 child C 已經拜訪過'); },
    () => { fin('A'); G.glow('A', null); say('A 沒有 child 可探索 → A 放進 stack'); },
    () => { nt('stack 裡就是 topological 順序', 'good'); say('這時 stack 裡就是拓撲排序'); },
    async () => { res = gmRow(-6.0, 4.2, 'pop 出來的順序'); for (const v of [...S.vals].reverse()) { S.pop(); res.push(v, GM.amber); await gmWait(tok, 200); } say('一個一個 pop：A B D C E F G H'); },
    () => { nt('答案不唯一；但每條邊 u→v，u 都在 v 前', 'good'); say('拓撲順序有很多種', '都滿足：u→v 時 u 在 v 前面'); },
  ]);
}]);

// 5:44 程式碼
FRAG.push(['graphmisc-topo-code', '程式碼：topSort 與 topSortUtil', async (tok) => {
  fresh(GM_CAM, GM_LOOK);
  const G = gmGraph(TP2);
  const C = code(['topSort(G):', '  stack, visited = [], set()', '  for v in G.vertices:', '    if v not in visited: util(v)', '  return stack', 'util(v):', '  visited.add(v)', '  for w in v.children:', '    if w in visited: continue', '    util(w)', '  stack.push(v)'], 4.6, 5.6, 0.48, -2.4);
  C.ls.forEach((l) => { l.element.style.visibility = 'hidden'; });
  let setR = null, S = null, res = null, depth = null;
  const rec = (list) => { if (!depth) depth = tag('', 'ptr', 1.6, 2.6, 2.6); depth.element.textContent = '呼叫：' + list; };
  const vis = (v) => { G.color(v, GM.vis); setR.push(v); };
  const fin = (v) => { G.color(v, GM.done); S.push(v); };
  await gmSeq(tok, [
    () => { C.ls.forEach((l) => { l.element.style.visibility = ''; }); say('來看程式碼'); },
    () => { C.hl(0); say('主函式 topSort'); },
    () => { C.hl(1); setR = gmRow(-6.2, 3.0, 'visited'); S = gmStack(1.6, -0.8, 'stack'); say('準備一個 stack、一個 set', '然後走過每個頂點'); },
    async () => { C.hl(3); await G.go(tok, 'D'); rec('util(D)'); say('第一個遇到 D：不在 visited', '呼叫 util(D)'); },
    () => { C.hl(6); vis('D'); say('util：先把 D 加進 visited'); },
    async () => { C.hl(7); await G.hop(tok, 'D', 'F'); say('探索 D 的鄰居：只有 F'); },
    async () => { C.hl(9); await G.go(tok, 'F'); rec('util(D) → util(F)'); say('F 不在 visited → 遞迴呼叫 util(F)'); },
    () => { C.hl(6); vis('F'); say('F 加進 visited'); },
    async () => { C.hl(7); await G.hop(tok, 'F', 'G'); say('F 只有一個鄰居 G'); },
    async () => { C.hl(6); await G.go(tok, 'G'); rec('util(D) → util(F) → util(G)'); vis('G'); say('再遞迴：util(G)，G 加進 visited'); },
    () => { C.hl(7); G.glow('G'); say('G 沒有鄰居'); },
    () => { C.hl(10); G.glow('G', null); fin('G'); say('G 全部探索完 → G 放進 stack'); },
    async () => { await G.go(tok, 'F'); rec('util(D) → util(F)'); fin('F'); say('遞迴退回 F：F 探索完', 'F 放進 stack'); },
    async () => { await G.go(tok, 'D'); rec('util(D)'); fin('D'); say('再退回 D：D 放進 stack'); },
    async () => { C.hl(2); rec('—'); await G.go(tok, 'B', 700); say('回到 topSort 的 for 迴圈', '挑下一個點 B'); },
    () => { C.hl(6); rec('util(B)'); vis('B'); say('B 不在 visited → util(B)', 'B 加進 visited'); },
    async () => { C.hl(9); await G.hop(tok, 'B', 'C'); await G.go(tok, 'C'); rec('util(B) → util(C)'); vis('C'); say('先探索 C：呼叫 util(C)', 'C 加進 visited'); },
    async () => { C.hl(8); await G.hop(tok, 'C', 'D', '✗'); say('C 的鄰居 D 已經在 visited', 'continue'); },
    () => { C.hl(10); fin('C'); say('C 沒有其他鄰居 → C 放進 stack'); },
    async () => { C.hl(9); await G.go(tok, 'B'); await G.hop(tok, 'B', 'E'); await G.go(tok, 'E'); rec('util(B) → util(E)'); say('退回 B：還有 child E', '呼叫 util(E)'); },
    () => { C.hl(6); vis('E'); say('E 加進 visited'); },
    async () => { C.hl(8); await G.hop(tok, 'E', 'F', '✗'); say('E 的鄰居 F 已在 visited → continue'); },
    () => { C.hl(10); fin('E'); say('E 沒有鄰居可探索 → E 放進 stack'); },
    async () => { await G.go(tok, 'B'); rec('util(B)'); fin('B'); say('退回 B：兩個鄰居都探索完', 'B 放進 stack'); },
    () => { C.hl(3); rec('—'); say('回到 for 迴圈', '其他點都拜訪過 → 跳過'); },
    async () => { await G.go(tok, 'A', 700); rec('util(A)'); say('碰到 A：不在 visited', '呼叫 util(A)'); },
    async () => { C.hl(8); vis('A'); await G.hop(tok, 'A', 'C', '✗'); say('A 加進 visited；鄰居 C 已拜訪過'); },
    () => { C.hl(10); fin('A'); say('A 沒有其他鄰居 → A 放進 stack'); },
    () => { C.hl(4); rec('—'); say('沒有點要探索了 → 回傳 stack'); },
    () => { res = gmRow(-6.2, 4.2, 'pop 出來的順序'); say('把元素一個一個 pop 出來', '就是拓撲順序'); },
    async () => { for (const v of [...S.vals].reverse()) { S.pop(); res.push(v, GM.amber); await gmWait(tok, 220); } say('A B E C D F G'); },
  ]);
}]);

// ─────────── kyUpc_5705s：Abdul Bari〈BFS DFS - Simplified〉 ───────────
// 圖（逐字稿重建）：1-2、1-4、2-3、3-4、4-5、3-8、3-9、5-6、5-7。BFS 從 1：1 2 4 3 5 8 9 6 7；DFS 從 1：1 2 3 4 5 6 7 8 9。
const BD = { pos: { 1: [-5.8, -2.4], 2: [-3.4, -2.4], 3: [-3.4, 0.0], 4: [-5.8, 0.0], 5: [-5.8, 2.2], 6: [-6.8, 3.8], 7: [-4.8, 3.8], 8: [-1.3, -0.9], 9: [-1.3, 0.9] },
  edges: [[1, 2], [1, 4], [2, 3], [3, 4], [4, 5], [3, 8], [3, 9], [5, 6], [5, 7]] };
const BD_TZ = -2.6;
const BD_BT = { 1: [3.6, 6.2], 2: [2.4, 4.9], 4: [4.8, 4.9], 3: [2.4, 3.6], 5: [4.8, 3.6], 8: [1.6, 2.3], 9: [3.0, 2.3], 6: [4.2, 2.3], 7: [5.4, 2.3] };
const BD_BP = { 2: 1, 4: 1, 3: 2, 5: 4, 8: 3, 9: 3, 6: 5, 7: 5 };
const BD_DT = { 1: [3.0, 6.4], 2: [3.0, 5.4], 3: [3.0, 4.4], 4: [2.0, 3.4], 5: [2.0, 2.4], 6: [1.2, 1.4], 7: [2.8, 1.4], 8: [3.8, 3.4], 9: [4.8, 3.4] };
const BD_DP = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 5, 8: 3, 9: 3 };
function bdTree(P, par, v) {
  const [x, y] = P[v]; cube(v, GM.vis, [0.5, 0.5, 0.5], x, y, BD_TZ, 0.8);
  if (par[v]) { const [px, py] = P[par[v]]; line(px, py - 0.25, x, y + 0.25, BD_TZ, '#c08a1f'); }
}
// BFS / DFS helpers on graph G with a result row and a queue row (or stack)
function bdKit(G, res, box) {
  const K2 = { cur: null };
  K2.visit = async (tok, u, v, toBox = true) => { if (u) { await G.hop(tok, u, v, '→', 320); G.paint(u, v, GM.tree, true); } G.color(v, GM.vis); res.push(v); if (toBox && box) box.push(v, GM.blue); };
  K2.explore = (v) => { if (K2.cur !== null) G.glow(K2.cur, null); G.glow(v); K2.cur = v; };
  K2.done = (v) => { G.glow(v, null); G.color(v, GM.done); if (K2.cur === v) K2.cur = null; };
  return K2;
}

// 0:00 traversal、visit、explore
FRAG.push(['graphmisc-bd-terms', 'Traversal：visit 與 explore', async (tok) => {
  fresh(GM_CAM, GM_LOOK);
  let G = null, n = null;
  await gmSeq(tok, [
    () => { tag('BFS：breadth first search', 'say', 2.6, 2.0, -1.8); tag('DFS：depth first search', 'say', 2.6, 1.3, -1.8); say('兩種 graph traversal：BFS 與 DFS'); },
    async () => { G = gmGraph(BD); for (const v of [1, 2, 3, 4, 5, 6, 7, 8, 9]) { G.color(v, GM.vis); await gmWait(tok, 120); } G.reset(); say('traversal = 每個頂點都拜訪一次'); },
    () => { n = tag('兩個名詞：visit、explore', 'note', 2.6, 1.6, 0.4); say('先講兩個名詞'); },
    async () => { await G.go(tok, 1); G.color(1, GM.vis); remove(n); n = tag('visit：走到某個頂點上', 'note', 2.6, 1.6, 0.4); say('visit（拜訪）：走到某一個頂點'); },
    () => { remove(n); n = tag('explore：拜訪它所有相鄰的頂點', 'note', 2.6, 1.6, 0.4); say('explore（探索）：拜訪一個點所有相鄰頂點'); },
    async () => { G.reset(); G.glow(4); await G.go(tok, 4); for (const w of [1, 3, 5]) { await G.hop(tok, 4, w, '→', 350); G.color(w, GM.vis); } say('4 的相鄰頂點：1、3、5'); },
    async () => { G.reset(); G.glow(5); await G.go(tok, 5); for (const w of [6, 7, 4]) { await G.hop(tok, 5, w, '→', 350); G.color(w, GM.vis); } say('5 的相鄰頂點：6、7、4'); },
    () => { G.reset(); remove(n); n = tag('用這兩個動作來學 BFS 和 DFS', 'good', 2.6, 1.6, 0.4); say('用 visit、explore 來學 BFS、DFS'); },
  ]);
}]);

// 1:10 BFS：一步一步（queue）
FRAG.push(['graphmisc-bd-bfs', 'BFS：新拜訪的點進 queue，從 queue 取下一個探索', async (tok) => {
  fresh(GM_CAM, GM_LOOK);
  const G = gmGraph(BD);
  let res = null, q = null, X = null, n = null, qn = null;
  const nt = (t, cls = 'note') => { remove(n); n = tag(t, cls, 3.0, 1.6, -1.4); };
  await gmSeq(tok, [
    () => { nt('BFS：breadth first search'); say('先講 BFS'); },
    () => { res = gmRow(0.6, 1.2, '拜訪順序'); q = gmRow(0.6, 2.8, ''); qn = tag('資料結構', 'idx', 0.4, 0.05, 2.2); qn.center.set(0, 0.5); X = bdKit(G, res, q); say('左邊寫拜訪順序', '另外需要一個資料結構'); },
    async () => { for (const v of [1, 2, 3, 4, 5, 6, 7, 8, 9]) G.glow(v); await gmWait(tok, 500); for (const v of [1, 2, 3, 4, 5, 6, 7, 8, 9]) G.glow(v, null); nt('起點可以任選'); say('任何頂點都可以當起點'); },
    async () => { await G.go(tok, 1); nt('選 1 當起點'); say('這裡選 1'); },
    () => X.visit(tok, null, 1).then(() => say('拜訪 1，放進資料結構')),
    () => { q.shift(); X.explore(1); say('從資料結構取出 1，開始探索 1'); },
    () => { nt('1 的鄰居：2、4（順序任意）'); say('相鄰的是 2 和 4', '先 2 先 4 都可以'); },
    () => X.visit(tok, 1, 2).then(() => say('選 2：拜訪 2')),
    () => X.visit(tok, 1, 4).then(() => say('再拜訪 4')),
    () => { X.done(1); nt('1 完全探索完'); say('1 完全探索完了'); },
    async () => { q.shift(); X.explore(2); await G.go(tok, 2); nt('從資料結構取下一個：2'); say('從資料結構取下一個：2', '2 的鄰居：1、3'); },
    () => X.visit(tok, 2, 3).then(() => say('1 拜訪過了 → 新的是 3')),
    () => { X.done(2); say('2 完全探索完'); },
    async () => { q.shift(); X.explore(4); await G.go(tok, 4); say('下一個從資料結構取：4'); },
    () => X.visit(tok, 4, 5).then(() => say('4 的鄰居 5、3：3 拜訪過', '新拜訪 5')),
    async () => { X.done(4); q.shift(); X.explore(3); await G.go(tok, 3); say('4 探索完；下一個探索 3'); },
    () => X.visit(tok, 3, 8).then(() => say('3 的鄰居 8、9：先拜訪 8')),
    () => X.visit(tok, 3, 9).then(() => say('再拜訪 9')),
    () => { X.done(3); nt('先進來的先出去：FIFO'); say('觀察：新拜訪的點加到後面', '從前面取：FIFO'); },
    () => { qn.element.textContent = 'queue（左邊是前端）'; nt('這個資料結構是 queue', 'good'); say('所以這個資料結構是 queue'); },
    async () => { q.shift(); X.explore(5); await G.go(tok, 5); say('下一個探索 5'); },
    () => X.visit(tok, 5, 6).then(() => say('5 的鄰居：拜訪 6')),
    () => X.visit(tok, 5, 7).then(() => say('再拜訪 7')),
    async () => { X.done(5); q.shift(); X.explore(8); await G.go(tok, 8); say('下一個探索 8：沒有新的鄰居'); },
    async () => { X.done(8); for (const v of [9, 6, 7]) { q.shift(); X.explore(v); await gmWait(tok, 350); X.done(v); } say('9、6、7 也沒有新的鄰居'); },
    () => { nt('BFS = 1 2 4 3 5 8 9 6 7', 'good'); say('從 1 開始的 BFS', '1 2 4 3 5 8 9 6 7'); },
    () => { nt('程序：起點進 queue → 開始探索'); say('程序：任選起點，放進 queue', '然後探索它'); },
    () => { nt('新點 → 進 queue；下一個探索點 → 從 queue 取', 'good'); say('每個新拜訪的點都進 queue', '下一個探索的點一定從 queue 取'); },
  ]);
}]);

// 4:50 BFS spanning tree
FRAG.push(['graphmisc-bd-bfstree', 'BFS spanning tree', async (tok) => {
  fresh(GM_CAM, GM_LOOK);
  const G = gmGraph(BD);
  const add = (u, v) => { G.color(v, GM.vis); if (u) G.paint(u, v, GM.tree, true); bdTree(BD_BT, BD_BP, v); };
  await gmSeq(tok, [
    () => { tag('畫出 BFS 走過的邊', 'note', 3.6, 7.0, BD_TZ); say('再做一次 BFS，這次把邊畫出來'); },
    async () => { add(null, 1); await gmWait(tok, 250); add(1, 2); add(1, 4); say('先拜訪 1，然後 2、4'); },
    () => { add(2, 3); say('探索 2：得到 3'); },
    () => { add(4, 5); say('探索 4：得到 5'); },
    () => { add(3, 8); add(3, 9); say('探索 3：得到 8、9'); },
    () => { add(5, 6); add(5, 7); say('探索 5：得到 6、7'); },
    () => { tag('BFS spanning tree', 'good', 3.6, 7.0, BD_TZ + 0.3); say('像一棵樹：BFS spanning tree'); },
    () => { G.paint(3, 4, GM.hot); gmArc(V3(BD_BT[3][0], BD_BT[3][1], BD_TZ), V3(BD_BT[4][0], BD_BT[4][1], BD_TZ), GM.hot, 0.5); say('3–4 這條會「關起環」的邊不算', '虛線：不在樹裡'); },
  ]);
}]);

// 5:50 哪些 BFS 合法、哪些不合法
FRAG.push(['graphmisc-bd-bfscheck', '判斷 BFS 是否合法', async (tok) => {
  fresh(GM_CAM, GM_LOOK);
  const G = gmGraph(BD);
  let row = null, n = null, hist = 0;
  const cand = (label) => { if (row) { row.clear(); remove(row.lbl); } G.reset(); row = gmRow(0.6, 1.0, label); };
  const add = async (list, from) => { for (const v of list) { if (from) await G.hop(tok, from, v, '→', 260); G.color(v, GM.vis); row.push(v); } };
  const verdict = (ok, text) => { tag((ok ? '✔ ' : '✘ ') + text, ok ? 'good' : 'bad', 3.2, 0.1, -3.0 + hist * 0.55); hist++; };
  const nt = (t, cls = 'note') => { remove(n); n = tag(t, cls, 3.2, 2.6, 2.4); }; // above the row's name, not on it
  await gmSeq(tok, [
    () => { nt('練習：寫出別的 BFS'); say('練習：再寫幾個 BFS'); },
    async () => { cand('從 1 開始'); await add([1]); await add([4, 2], 1); say('從 1 開始：這次先 4，再 2'); },
    async () => { await add([5, 3], 4); say('探索 4：5 和 3'); },
    () => { nt('探索 2：3 已經拜訪過'); say('探索 2：3 已經拜訪過了'); },
    async () => { await add([6, 7], 5); say('探索 5：6、7'); },
    async () => { await add([8, 9], 3); say('探索 3：8、9'); },
    () => { verdict(true, '1 4 2 5 3 6 7 8 9'); nt('鄰居的拜訪順序可以任意 → 合法', 'good'); say('這也是合法的 BFS', '鄰居先後可以任意'); },
    async () => { cand('從 4 開始'); await add([4]); await add([1, 3, 5], 4); say('從 4 開始：1、3、5'); },
    async () => { await add([2], 1); say('探索 1：得到 2'); },
    async () => { await add([9, 8], 3); say('探索 3：9、8'); },
    async () => { await add([6, 7], 5); verdict(true, '4 1 3 5 2 9 8 6 7'); say('探索 5：6、7', '這也合法'); },
    async () => { cand('從 3 開始'); await add([3]); await add([2, 4, 8, 9], 3); say('從 3 開始：2、4、8、9'); },
    async () => { await add([1], 2); say('探索 2：得到 1'); },
    async () => { await add([5], 4); say('探索 4：得到 5'); },
    async () => { await add([6, 7], 5); verdict(true, '3 2 4 8 9 1 5 6 7'); say('8、9、1 沒有新鄰居；探索 5：6、7', '合法'); },
    async () => { cand('檢查這個'); await add([1, 2, 4, 3, 5, 6]); nt('1 2 4 3 5 6 …？'); say('這個呢？1 2 4 3 5 6'); },
    () => { G.color(6, GM.hot); nt('錯！', 'bad'); say('這裡錯了'); },
    () => { G.glow(3); nt('下一個該探索 3（先進 queue），不是 5', 'bad'); verdict(false, '1 2 4 3 5 6…'); say('3 比 5 先進 queue', '應該先探索 3，6 不能在這裡出現'); },
    async () => { G.glow(3, null); cand('再檢查'); await add([1, 4, 2, 3, 8, 9, 6, 7]); nt('1 4 2 3 8 9 6 7？'); say('再一個：1 4 2 3 8 9 6 7'); },
    () => { G.color(5, GM.hot); G.glow(5); nt('探索 4 時漏了 5！', 'bad'); verdict(false, '1 4 2 3 8 9 6 7'); say('探索 4：3 有了，5 卻漏掉了', '不合法'); },
    async () => { G.glow(5, null); cand('從 3 開始？'); await add([3, 2, 4, 8, 5, 6, 7, 9]); G.color(9, GM.hot); nt('3 2 4 8 5 6 7 9？'); say('從 3 開始：2 4 8，然後 5 6 7、9', '錯了'); },
    () => { G.glow(9); nt('3 的鄰居 9 要在 5、6、7 之前拜訪', 'bad'); verdict(false, '3 2 4 8 5 6 7 9'); say('9 應該在 5、6、7 之前拜訪'); },
    () => { G.glow(9, null); nt('下一個探索點一定從 queue 取', 'good'); say('記住：BFS 用 queue', '新點進 queue，下一個從 queue 取'); },
  ]);
}]);

// 10:19 DFS：一步一步（stack）
FRAG.push(['graphmisc-bd-dfs', 'DFS：遇到新點就暫停，把目前的點放進 stack', async (tok) => {
  fresh(GM_CAM, GM_LOOK);
  const G = gmGraph(BD);
  let res = null, S = null, X = null, n = null;
  const nt = (t, cls = 'note') => { remove(n); n = tag(t, cls, 3.2, 1.8, -1.6); };
  const vis = async (u, v) => { await X.visit(tok, u, v, false); X.explore(v); await G.go(tok, v, 350); };
  await gmSeq(tok, [
    () => { nt('DFS：depth first search'); say('接下來是 DFS'); },
    () => { res = gmRow(0.6, 3.2, '拜訪順序'); S = gmStack(2.4, 0.0, 'stack'); X = bdKit(G, res, null); say('一樣：寫拜訪順序，加一個資料結構'); },
    async () => { await G.go(tok, 1); await X.visit(tok, null, 1, false); say('從 1 開始：拜訪 1'); },
    () => { S.push(1); say('1 放進 stack'); },
    () => { S.pop(); X.explore(1); say('取出 1，開始探索 1'); },
    async () => { S.push(1); await vis(1, 2); say('拜訪到新點 2', '1 又放回 stack（暫停）'); },
    () => { nt('開始探索 2'); say('開始探索 2'); },
    () => { nt('2 的鄰居：3'); say('2 的相鄰頂點是 3'); },
    async () => { S.push(2); await vis(2, 3); say('2 放進 stack，開始探索 3'); },
    async () => { await X.visit(tok, 3, 4, false); say('探索 3：得到 4'); },
    async () => { X.explore(4); await G.go(tok, 4, 350); nt('停止探索 3，改探索 4'); say('開始探索 4，3 的探索先停下'); },
    () => { S.push(3); nt('3 暫停 → 放進 stack', 'good'); say('3 被暫停，放進 stack'); },
    async () => { S.push(4); await vis(4, 5); say('4 的新鄰居 5', '4 放進 stack'); },
    async () => { S.push(5); await vis(5, 6); say('5 → 6', '5 放進 stack'); },
    () => { nt('6：dead end（走不下去）', 'bad'); say('探索 6：沒有相鄰的新點', '死路'); },
    async () => { X.done(6); S.pop(); X.explore(5); await G.go(tok, 5, 350); nt('回頭：從 stack 取出 5'); say('怎麼回去？從 stack 取出 5', '繼續探索 5'); },
    async () => { S.push(5); await vis(5, 7); say('5 的下一個鄰居 7', '5 再放回 stack，探索 7'); },
    async () => { X.done(7); S.pop(); X.explore(5); await G.go(tok, 5, 350); say('7 也是死路 → 取出 5'); },
    async () => { X.done(5); S.pop(); X.explore(4); await G.go(tok, 4, 350); say('5 的 6、7 都拜訪了 → 5 探索完', '回到 4'); },
    async () => { X.done(4); S.pop(); X.explore(3); await G.go(tok, 3, 350); say('4 的 1、5、3 都拜訪過 → 回到 3'); },
    async () => { S.push(3); await vis(3, 8); say('3 的鄰居 8：暫停 3（放進 stack）', '探索 8'); },
    () => { nt('8：dead end', 'bad'); say('8 是死路'); },
    async () => { X.done(8); S.pop(); X.explore(3); await G.go(tok, 3, 300); await X.visit(tok, 3, 9, false); say('回到 3，拜訪下一個 9'); },
    async () => { S.push(3); X.explore(9); await G.go(tok, 9, 300); nt('9：dead end', 'bad'); say('3 放進 stack，探索 9', '9 也是死路'); },
    async () => { X.done(9); S.pop(); X.explore(3); await G.go(tok, 3, 300); say('取出 3：沒有其他鄰居了'); },
    async () => { X.done(3); S.pop(); X.explore(2); await G.go(tok, 2, 300); X.done(2); S.pop(); X.explore(1); await G.go(tok, 1, 300); X.done(1); say('取出 2、取出 1：都沒有新鄰居', 'stack 空了 → 結束'); },
    () => { nt('DFS = 1 2 3 4 5 6 7 8 9', 'good'); say('DFS 的結果', '1 2 3 4 5 6 7 8 9'); },
    () => { nt('拜訪到 2 就暫停 1，等 2 探索完再回到 1'); say('重點：一拜訪到新點 2，就暫停 1', '2 探索完才回來繼續 1'); },
  ]);
}]);

// 14:13 DFS spanning tree
FRAG.push(['graphmisc-bd-dfstree', 'DFS spanning tree', async (tok) => {
  fresh(GM_CAM, GM_LOOK);
  const G = gmGraph(BD);
  const add = async (u, v) => { if (u) { await G.hop(tok, u, v, '→', 320); G.paint(u, v, GM.tree, true); } G.color(v, GM.vis); bdTree(BD_DT, BD_DP, v); await G.go(tok, v, 300); };
  await gmSeq(tok, [
    async () => { await add(null, 1); await add(1, 2); say('圖解：先 1，再 2'); },
    () => { G.note(4, '先不去 4', 'bad'); say('1 也能去 4', '但 2 是新點 → 先探索 2'); },
    () => add(2, 3).then(() => say('從 2 得到 3')),
    () => add(3, 4).then(() => say('3 是新點 → 探索 3，得到 4')),
    () => add(4, 5).then(() => say('從 4 到 5')),
    () => add(5, 6).then(() => say('從 5 到 6')),
    async () => { await G.go(tok, 5, 300); await add(5, 7); say('6 走不下去 → 回 5，再到 7'); },
    async () => { await G.go(tok, 5, 300); await G.go(tok, 4, 300); G.paint(1, 4, GM.hot); gmArc(V3(BD_DT[4][0], BD_DT[4][1], BD_TZ), V3(BD_DT[1][0], BD_DT[1][1], BD_TZ), GM.hot, 0.6); say('回到 5、再回到 4', '4 的鄰居都拜訪過（1–4 是虛線）'); },
    async () => { await G.go(tok, 3, 300); await add(3, 8); await G.go(tok, 3, 250); await add(3, 9); say('回到 3：再到 8、9'); },
    async () => { await G.go(tok, 2, 300); await G.go(tok, 1, 300); say('2、1 都沒有新鄰居'); },
    () => { tag('DFS spanning tree', 'good', 3.0, 7.2, BD_TZ); say('這就是 DFS spanning tree'); },
  ]);
}]);

// 15:22 哪些 DFS 合法、哪些不合法
FRAG.push(['graphmisc-bd-dfscheck', '判斷 DFS 是否合法', async (tok) => {
  fresh(GM_CAM, GM_LOOK);
  const G = gmGraph(BD);
  let row = null, n = null, hist = 0;
  const cand = (label) => { if (row) { row.clear(); remove(row.lbl); } G.reset(); row = gmRow(0.6, 1.0, label); };
  const add = async (list) => { for (const v of list) { const prev = row.vals[row.vals.length - 1]; if (prev !== undefined && G.e(prev, v)) await G.hop(tok, prev, v, '→', 240); else await gmWait(tok, 200); G.color(v, GM.vis); row.push(v); } };
  const verdict = (ok, text) => { tag((ok ? '✔ ' : '✘ ') + text, ok ? 'good' : 'bad', 3.2, 0.1, -3.0 + hist * 0.55); hist++; };
  const nt = (t, cls = 'note') => { remove(n); n = tag(t, cls, 3.2, 1.6, 2.4); };
  await gmSeq(tok, [
    () => { nt('找找看不同的 DFS'); say('來找不同的 DFS'); },
    async () => { cand('第 1 個'); await add([1, 2, 3, 4, 5, 6, 7]); say('1 → 2 → 3 → 4 → 5 → 6 → 7'); },
    async () => { await add([8, 9]); verdict(true, '1 2 3 4 5 6 7 8 9'); say('回到 3，繼續 8、9', '合法'); },
    async () => { cand('第 2 個'); await add([1, 2, 3, 8]); say('1 → 2 → 3 → 8'); },
    async () => { await add([9]); say('8 走不下去，回 3 → 9'); },
    async () => { await add([4, 5, 6]); say('回 3 → 4 → 5 → 6'); },
    async () => { await add([7]); say('回 5 → 7'); },
    () => { verdict(true, '1 2 3 8 9 4 5 6 7'); say('一路退回 1：合法'); },
    async () => { cand('第 3 個'); await add([1, 2, 3, 8, 4]); say('1 2 3 8，然後 4'); },
    async () => { await add([5, 7]); say('4 → 5 → 7'); },
    async () => { await add([6]); say('回 5 → 6'); },
    async () => { await add([9]); verdict(true, '1 2 3 8 4 5 7 6 9'); say('退回 3：還剩 9', '合法'); },
    async () => { cand('第 4 個'); await add([1, 4, 5, 6]); say('第四個：1 4 5 6'); },
    async () => { await add([7, 3, 9]); say('回 5 → 7，退回 4 → 3 → 9'); },
    async () => { await add([8, 2]); say('回 3 → 8，再 → 2'); },
    () => { verdict(true, '1 4 5 6 7 3 9 8 2'); say('這也合法'); },
    async () => { cand('檢查'); await add([1, 2, 3, 5]); G.color(5, GM.hot); nt('1 2 3 5？', 'bad'); say('1 2 3 然後 5？不合法'); },
    () => { G.glow(3); nt('3 只能到 8、9、4，不能直接到 5', 'bad'); verdict(false, '1 2 3 5'); say('3 能去 8、9、4', '沒有邊通到 5'); },
    async () => { G.glow(3, null); cand('檢查'); await add([1, 2, 3, 4, 9]); G.color(9, GM.hot); nt('1 2 3 4 9？', 'bad'); say('1 2 3 4 然後 9？'); },
    () => { G.glow(4); G.glow(5); nt('在 4 上就要先去 5，探索 5', 'bad'); verdict(false, '1 2 3 4 9'); say('不行：在 4 上，能去 5 就要先去 5', '不可以跳去 9'); },
  ]);
}]);

// ─────────── RpgcYiky7uw：Tushar Roy〈Strongly Connected Components（Kosaraju）〉 ───────────
// 圖（逐字稿重建）：A→B→C→A、B→D、D→E→F→D、G→F、G→H→I→J→G、J→K。
// 第一遍（從 B、再從 I）stack 由底到頂：A C F E D B K H G J I。第二遍在反向圖上：{I H G J}、{K}、{B A C}、{D F E}。
const SC = { directed: true, pos: { A: [-6.6, -1.0], B: [-4.8, -2.4], C: [-4.8, 0.4], D: [-2.6, -2.4], E: [-1.6, 0.6], F: [-0.6, -2.4], G: [1.4, -2.4], H: [1.4, 0.6], I: [3.4, 0.6], J: [3.4, -2.4], K: [5.4, -2.4] },
  edges: [['A', 'B'], ['B', 'C'], ['C', 'A'], ['B', 'D'], ['D', 'E'], ['E', 'F'], ['F', 'D'], ['G', 'F'], ['G', 'H'], ['H', 'I'], ['I', 'J'], ['J', 'G'], ['J', 'K']] };
const SC_COMP = [['A', 'B', 'C'], ['D', 'E', 'F'], ['G', 'H', 'I', 'J'], ['K']];
const SC_CC = [GM.blue, GM.pink, GM.purple, GM.amber];
const SC_STACK = ['A', 'C', 'F', 'E', 'D', 'B', 'K', 'H', 'G', 'J', 'I'];
// 程式碼段的數字圖：2→3→1→2、3→5、5→6→4→5、7→6
const SN = { directed: true, pos: { 1: [-6.4, -2.2], 2: [-6.4, 0.8], 3: [-4.6, -0.7], 5: [-2.8, -0.7], 6: [-1.0, 0.8], 4: [-1.0, -2.2], 7: [0.8, 2.0] },
  edges: [[2, 3], [3, 1], [1, 2], [3, 5], [5, 6], [6, 4], [4, 5], [7, 6]] };
function scBase(G0) {
  fresh(GM_CAM, GM_LOOK);
  const G = gmGraph(G0 || SC);
  const D = { G, n: null };
  D.nt = (t, cls = 'note') => { remove(D.n); D.n = tag(t, cls, 0, 2.2, -3.6); };
  return D;
}

// 0:00 什麼是 SCC
FRAG.push(['graphmisc-scc-def', 'Strongly connected component：彼此都走得到', async (tok) => {
  const { G, nt } = scBase();
  const zones = [];
  await gmSeq(tok, [
    () => { nt('Strongly Connected Components（Kosaraju）', 'say'); say('主題：strongly connected component', '用 Kosaraju 演算法找'); },
    () => { nt('一張 directed graph'); say('這是一張有方向的圖'); },
    () => { nt('SCC：裡面每個點，都能走到其他每個點'); say('SCC：component 裡任兩點', '互相都走得到'); },
    () => { nt('這張圖有 4 個 SCC'); say('這張圖有 4 個 SCC'); },
    async () => { for (const [u, v] of [['A', 'B'], ['B', 'C'], ['C', 'A']]) { G.paint(u, v, SC_CC[0], true); await G.hop(tok, u, v, '→', 350); } G.colors(SC_COMP[0], SC_CC[0]); say('A、B、C：彼此都走得到'); },
    async () => { for (const [u, v] of [['D', 'E'], ['E', 'F'], ['F', 'D']]) { G.paint(u, v, SC_CC[1], true); await G.hop(tok, u, v, '→', 300); } G.colors(SC_COMP[1], SC_CC[1]); say('D、E、F 也是一個 SCC'); },
    async () => { for (const [u, v] of [['G', 'H'], ['H', 'I'], ['I', 'J'], ['J', 'G']]) { G.paint(u, v, SC_CC[2], true); await G.hop(tok, u, v, '→', 250); } G.colors(SC_COMP[2], SC_CC[2]); say('G、H、I、J 是一個 SCC'); },
    () => { G.colors(['K'], SC_CC[3]); G.note('K', '只有自己'); say('K 自己也是一個 SCC'); },
    () => { nt('應用：社群網站找出互相連結的一群人'); [-2, 0, 2].forEach((x, i) => { const b = buddy('', '', ['#f4a56a', '#8fd18a', '#9fc3f0'][i], x, 0, 3.6, 0.45); b.mood('happy'); }); say('應用：像 Facebook', '找出彼此相連的一群人'); },
    () => { nt('找 SCC 的演算法：Kosaraju'); say('找 SCC 有好幾種演算法', '今天講 Kosaraju'); },
    () => { nt('two pass：把圖走兩遍', 'good'); say('它是 two-pass：把圖走兩遍'); },
  ]);
}]);

// 1:24 第一遍：DFS，依完成時間放進 stack
FRAG.push(['graphmisc-scc-pass1', '第一遍：DFS，完成的點放進 stack', async (tok) => {
  const { G, nt } = scBase();
  let setR = null, S = null;
  const vis = async (u, v) => { if (u) await G.hop(tok, u, v, '→', 330); await G.go(tok, v, 330); G.color(v, GM.vis); setR.push(v); };
  const fin = async (v, back) => { if (back) await G.go(tok, v, 330); G.color(v, GM.done); S.push(v); };
  await gmSeq(tok, [
    () => { nt('第一遍：DFS，依「完成時間」由晚到早排'); say('第一遍：做 DFS', '依完成時間（finish time）排序'); },
    () => { setR = gmRow(-6.4, 2.4, 'visited set'); S = gmStack(6.6, 1.2, 'stack'); say('需要一個 visited set、一個 stack'); },
    async () => { await G.go(tok, 'B'); G.glow('B'); nt('從任一點開始：B'); say('從任一點開始，例如 B'); },
    () => { G.color('B', GM.vis); setR.push('B'); say('B 放進 visited'); },
    () => vis('B', 'C').then(() => say('B 的 child C：放進 visited')),
    () => vis('C', 'A').then(() => say('C 只有一個 child A：放進 visited')),
    async () => { await G.hop(tok, 'A', 'B', '✗'); say('A 的 child 是 B：已經拜訪過'); },
    () => { nt('A 的 children 都走完 → A 完成（第一個）'); say('A 完成了', '它是第一個完成的點'); },
    () => { fin('A'); say('A 放進 stack'); },
    () => fin('C', true).then(() => say('回到 C：沒有別的 child → C 放進 stack')),
    async () => { await G.go(tok, 'B', 330); await vis('B', 'D'); say('回到 B：還有 child D', 'D 放進 visited'); },
    () => vis('D', 'E').then(() => say('D → E：放進 visited')),
    () => vis('E', 'F').then(() => say('E → F：放進 visited')),
    async () => { await G.hop(tok, 'F', 'D', '✗'); say('F 的 child D 已經拜訪過'); },
    () => { fin('F'); say('F 沒有 child 可探索 → F 放進 stack'); },
    () => fin('E', true).then(() => say('回到 E → E 放進 stack')),
    () => fin('D', true).then(() => say('回到 D → D 放進 stack')),
    () => { G.glow('B', null); return fin('B', true).then(() => say('回到 B：children 都探索完', 'B 放進 stack')); },
    async () => { await G.go(tok, 'I', 700); G.glow('I'); nt('再挑一個沒拜訪的點：I'); say('再挑一個還沒拜訪的點：I'); },
    () => { G.color('I', GM.vis); setR.push('I'); say('I 放進 visited'); },
    () => vis('I', 'J').then(() => say('I 只有一個 child J')),
    () => vis('J', 'K').then(() => say('J → K')),
    () => { fin('K'); say('K 沒有 children → K 放進 stack'); },
    async () => { await G.go(tok, 'J', 330); await vis('J', 'G'); say('回到 J：另一個 child G'); },
    async () => { await G.hop(tok, 'G', 'F', '✗'); say('G 的 child F 已經拜訪過'); },
    () => vis('G', 'H').then(() => say('G 的 child H')),
    async () => { await G.hop(tok, 'H', 'I', '✗'); say('H 的 child I 已經拜訪過'); },
    () => { fin('H'); say('H 完成 → 放進 stack'); },
    () => fin('G', true).then(() => say('回到 G → G 放進 stack')),
    () => fin('J', true).then(() => say('回到 J → J 放進 stack')),
    () => { G.glow('I', null); return fin('I', true).then(() => say('最後 I 放進 stack')); },
    () => { nt('第一遍完成', 'good'); say('第一遍完成'); },
    () => { tag('最後完成：I（頂端）', 'good', 5.0, 6.6, 1.2); tag('最先完成：A（底部）', 'note', 5.0, 0.0, 2.6); say('最後完成的 I 在頂端', '最先完成的 A 在底部'); },
  ]);
}]);

// 5:54 第二遍：反向圖，照 stack 順序 DFS
FRAG.push(['graphmisc-scc-pass2', '第二遍：反向圖上，照 stack 的順序做 DFS', async (tok) => {
  const { G, nt } = scBase();
  const S = gmStack(6.6, 1.2, 'stack');
  SC_STACK.forEach((v) => S.push(v));
  let setR = null, ci = -1;
  const pop = async () => { S.pop(); await gmWait(tok, 250); };
  const comps = [], cl = [];
  const showC = () => { cl.forEach(remove); cl.length = 0; comps.forEach((c, i) => cl.push(tag('SCC ' + (i + 1) + '：' + c.join(' '), 'say', -5.0 + i * 3.2, 0.1, 4.0))); };
  const add = async (u, v) => { await G.hop(tok, u, v, '→', 330); await G.go(tok, v, 330); G.color(v, SC_CC[[2, 3, 0, 1][ci]]); setR.push(v, GM.vis); comps[ci].push(v); showC(); };
  await gmSeq(tok, [
    () => { nt('第二遍'); say('第二遍'); },
    async () => { G.reverse(); await gmWait(tok, 300); nt('先把圖反過來（每條邊換方向）'); say('先把圖反向：每條邊方向顛倒'); },
    () => { nt('從 stack pop 出點，在反向圖上做 DFS'); setR = gmRow(-6.4, 2.4, 'visited set'); say('從 stack 一個一個 pop', '在反向圖上做 DFS'); },
    async () => { await pop('I'); cl.forEach(remove); ci = 0; comps[0] = ['I']; await G.go(tok, 'I', 600); G.color('I', SC_CC[2]); setR.push('I'); showC(); say('pop 出 I：沒拜訪過', '第一個 SCC 從 I 開始'); },
    () => add('I', 'H').then(() => say('I → H')),
    () => add('H', 'G').then(() => say('H → G')),
    () => add('G', 'J').then(() => say('G → J')),
    async () => { await G.hop(tok, 'J', 'I', '✗'); say('J → I：已經拜訪過', 'J、G、H、I 都沒有新的路'); },
    () => { nt('第一個 SCC：I H G J', 'good'); say('從 I 能走到的都走完了', '第一個 SCC 完成'); },
    () => pop('J').then(() => say('pop 出 J：已拜訪 → 不做事')),
    () => pop('G').then(() => say('pop 出 G：已拜訪')),
    () => pop('H').then(() => say('pop 出 H：已拜訪')),
    async () => { await pop('K'); ci = 1; comps[1] = ['K']; await G.go(tok, 'K', 600); G.color('K', SC_CC[3]); setR.push('K'); showC(); say('pop 出 K：沒拜訪過', '第二個 SCC 開始'); },
    async () => { await G.hop(tok, 'K', 'J', '✗'); say('K → J：J 已經拜訪過'); },
    () => { nt('第二個 SCC：只有 K', 'good'); say('第二個 SCC 只有一個點 K'); },
    async () => { await pop('B'); ci = 2; comps[2] = ['B']; await G.go(tok, 'B', 700); G.color('B', SC_CC[0]); setR.push('B'); showC(); say('pop 出 B：第三個 SCC 開始'); },
    () => add('B', 'A').then(() => say('B → A')),
    () => add('A', 'C').then(() => say('A → C')),
    async () => { await G.hop(tok, 'C', 'B', '✗'); nt('第三個 SCC：B A C', 'good'); say('C → B 已拜訪', '第三個 SCC 完成'); },
    async () => { await pop('D'); ci = 3; comps[3] = ['D']; await G.go(tok, 'D', 600); G.color('D', SC_CC[1]); setR.push('D'); showC(); say('pop 出 D：新的 SCC'); },
    () => add('D', 'F').then(() => say('D → F')),
    () => add('F', 'E').then(() => say('F → E')),
    async () => { await G.hop(tok, 'E', 'D', '✗'); await G.hop(tok, 'D', 'B', '✗'); say('E → D 已拜訪', 'D → B 也已拜訪：不過去'); },
    () => { nt('第四個 SCC：D F E', 'good'); say('第四個 SCC：D F E'); },
    async () => { for (let i = 0; i < 4; i++) { S.pop(); await gmWait(tok, 220); } say('pop 出 E、F、C、A：都拜訪過'); },
    () => { nt('4 個 SCC：{I H G J} {K} {B A C} {D F E}', 'good'); say('找到 4 個 SCC'); },
  ]);
}]);

// 10:17 複雜度
FRAG.push(['graphmisc-scc-cost', '時間 O(V+E)、空間 O(V)', async (tok) => {
  const { G, nt } = scBase();
  const t = [];
  const row = (s, cls = 'say') => { t.push(tag(s, cls, 0, 0.1, 2.0 + t.length * 0.62)); };
  await gmSeq(tok, [
    () => { nt('時間與空間複雜度'); say('來分析時間、空間複雜度'); },
    async () => { for (const v of 'BCADEFIJKGH') { G.color(v, GM.vis); await gmWait(tok, 90); } row('第一遍 DFS：O(V + E)'); say('第一遍 DFS：O(V + E)', 'V = 頂點數、E = 邊數'); },
    async () => { G.reverse(); await gmWait(tok, 200); row('反向圖：O(V + E)'); say('把圖反向：大約也是 O(V + E)', '看圖怎麼存'); },
    async () => { G.reset(); for (const v of 'IHGJKBACDFE') { G.color(v, GM.done); await gmWait(tok, 90); } row('第二遍 DFS：O(V + E)'); say('第二遍 DFS：再一次 O(V + E)'); },
    () => { row('總時間：O(V + E)', 'good'); say('總時間 O(V + E)'); },
    () => { row('空間：stack、visited 各 V 個 → O(V)', 'good'); say('stack、visited 最多各 V 個', '空間 O(V)'); },
  ]);
}]);

// 11:08 為什麼可行：縮點後是 DAG
FRAG.push(['graphmisc-scc-why', '為什麼可行：把每個 SCC 縮成一點，得到 DAG', async (tok) => {
  const { G, nt } = scBase();
  const SP = [[-5.2, 0.0], [-1.6, 0.0], [2.4, 0.0], [5.6, 0.0]], NM = ['ABC', 'DEF', 'GHIJ', 'K'];
  const big = [], es = {};
  let bad = null, stk = null;
  // the letters of the points being merged go quiet while they slide together (the big block names them after)
  const mute = (vs) => vs.forEach((v) => G.vs[v].children.forEach((c) => { if (c.isCSS2DObject) c.visible = false; }));
  const bigE = (a, b, c = GM.edge) => { const p = V3(SP[a][0], 0.45, SP[a][1]), q = V3(SP[b][0], 0.45, SP[b][1]); es[a + '' + b] = gmRod(p, q, { directed: true, gap: 0.85, color: c, r: 0.07 }); };
  await gmSeq(tok, [
    () => { nt('為什麼可行？（嚴格證明在 CLRS）'); say('為什麼這樣做是對的？', '看直覺'); },
    () => { SC_COMP.forEach((c, i) => G.colors(c, SC_CC[i])); nt('把每個 SCC 合成一個點'); say('把同一個 SCC 的點合成一個點'); },
    async () => {
      const from = {}; for (const k in G.vs) from[k] = G.vs[k].position.clone();
      for (const k in G.es) gmKill(G.es[k]);
      mute(SC_COMP[0].concat(SC_COMP[1]));
      await anim(tok, 900, (u) => SC_COMP.forEach((c, i) => c.forEach((v) => { if (i < 2) G.vs[v].position.lerpVectors(from[v], V3(SP[i][0], 0.3, SP[i][1]), u); })));
      [0, 1].forEach((i) => { SC_COMP[i].forEach((v) => { G.vs[v].visible = false; }); big[i] = cube(NM[i], SC_CC[i], [1.3, 0.9, 1.3], SP[i][0], 0.45, SP[i][1]); });
      say('ABC 變成一個點，DEF 變成一個點');
    },
    async () => {
      const from = {}; for (const k in G.vs) from[k] = G.vs[k].position.clone();
      mute(SC_COMP[2].concat(SC_COMP[3]));
      await anim(tok, 900, (u) => SC_COMP.forEach((c, i) => c.forEach((v) => { if (i >= 2) G.vs[v].position.lerpVectors(from[v], V3(SP[i][0], 0.3, SP[i][1]), u); })));
      [2, 3].forEach((i) => { SC_COMP[i].forEach((v) => { G.vs[v].visible = false; }); big[i] = cube(NM[i], SC_CC[i], [1.3, 0.9, 1.3], SP[i][0], 0.45, SP[i][1]); });
      say('GHIJ 一個點，K 一個點');
    },
    () => { bigE(0, 1); say('B → D 跨過兩個 SCC：畫成 ABC → DEF'); },
    () => { bigE(2, 1); bigE(2, 3); say('GHIJ → DEF、GHIJ → K'); },
    () => { nt('縮完的圖一定是 DAG（沒有環）', 'good'); say('這張新圖保證是 DAG', '沒有環'); },
    () => { const p = V3(SP[1][0], 0.6, SP[1][1]), q = V3(SP[0][0], 0.6, SP[0][1]); bad = gmArc(p, q, GM.hot); nt('如果有一條 DEF → ABC 的邊…', 'bad'); say('為什麼？假設有一條邊走回去'); },
    async () => { await anim(tok, 500, (u) => { big[0].scale.setScalar(1 + 0.15 * Math.sin(u * Math.PI)); big[1].scale.setScalar(1 + 0.15 * Math.sin(u * Math.PI)); }); nt('那 ABC、DEF 互相走得到 → 應該合成同一個 SCC', 'bad'); say('那 ABC 和 DEF 就互相走得到', '應該是同一個 SCC'); },
    () => { gmKill(bad); nt('既然是兩個點 → 不可能有環', 'good'); say('既然它們是兩個不同的點', '就不可能有環'); },
    () => { stk = gmStack(6.6, 2.6, 'stack（完成時間）'); nt('第一遍：依完成時間排序'); say('第一遍：依完成時間排序', 'children 都探索完才進 stack'); },
    () => { nt('ABC → DEF：ABC 裡至少一點比 DEF 全部都晚完成'); say('ABC → DEF 有邊', 'ABC 裡至少有一點比 DEF 晚完成'); },
    async () => { for (const v of ['A', 'C', 'F', 'E', 'D', 'B']) { stk.push(v, ['B'].includes(v) ? SC_CC[0] : (['A', 'C'].includes(v) ? SC_CC[0] : SC_CC[1])); await gmWait(tok, 150); } nt('例如 B：疊在 D、E、F 上面'); say('例如 B：A、C 在下面', 'D、E、F 疊上去，B 在更上面'); },
    () => { nt('GHIJ → DEF：GHIJ 裡有一點比 DEF 晚完成（G）'); say('同樣地，GHIJ 裡有一點', '比 DEF 都晚完成：G'); },
    async () => { for (const v of ['K', 'H', 'G']) { stk.push(v, v === 'K' ? SC_CC[3] : SC_CC[2]); await gmWait(tok, 150); } nt('GHIJ → K：G 也比 K 晚完成'); say('G 也比 K 晚完成'); },
    async () => { for (const k in es) gmKill(es[k]); bigE(1, 0); bigE(1, 2); bigE(3, 2); await gmWait(tok, 300); nt('把圖反過來'); say('接著把圖反向'); },
    async () => { for (const i of [0, 1, 2, 3]) { glow(big[i], GOLD); await gmWait(tok, 200); glow(big[i], null); } say('SCC 裡面反向後還是互相走得到'); },
    () => { nt('只有 SCC 之間的邊換了方向', 'good'); say('只有 SCC 之間的邊換了方向'); },
    () => { glow(big[0], GOLD); glow(big[2], GOLD); nt('照完成時間：B 比 DEF 先 pop；GHIJ 比 DEF、K 先 pop'); say('第二遍照完成時間 pop', 'B 比 DEF 先；GHIJ 比 DEF、K 先被挑到'); },
    async () => { glow(big[2], null); const h = tag('B', 'pkt', SP[0][0], 1.4, SP[0][1]); await travel(tok, h, V3(SP[0][0], 1.4, SP[0][1]), V3(SP[0][0] + 1.4, 1.4, SP[0][1]), 500); h.element.textContent = '✗'; nt('B 探索完 ABC，走不到 DEF（邊反向了）'); say('B 被挑到：探索完 ABC', '走不到 DEF：邊是反的'); },
    () => { glow(big[0], null); glow(big[2], GOLD); nt('GHIJ 被挑到（stack 頂端是 I）：探索完 G H I J'); say('GHIJ 被挑到：探索完 GHIJ', '走不到 DEF、K；ABC、GHIJ 誰先都可以'); },
    () => { glow(big[2], null); glow(big[1], GOLD); glow(big[3], GOLD); nt('輪到 DEF、K 時，鄰居都已經拜訪過'); say('輪到 DEF 或 K 時', '能去的地方早就被拜訪過了'); },
    () => { glow(big[1], null); glow(big[3], null); nt('所以剛好分出 4 個 SCC', 'good'); say('所以剛好得到 4 個 SCC'); },
  ]);
}]);

// 16:15 程式碼：數字例子
FRAG.push(['graphmisc-scc-code', '程式碼：兩遍 DFS（數字例子）', async (tok) => {
  const { G } = scBase(SN);
  const C = code(['SCC(G):', '  stack, visited', '  for v in G: if v ∉ visited: dfs(v)', '  R = reverse(G); visited.clear()', '  while stack: v = stack.pop()', '    if v ∉ visited:', '      comp = {}; dfsR(v, comp)', '      result.add(comp)', 'dfs(v): visited.add(v)', '  for w in out(v): dfs(w) if new', '  stack.push(v)', 'dfsR(v, comp): visited.add(v)', '  comp.add(v)', '  for w in R.out(v): dfsR if new'], 4.8, 6.4, 0.44, -2.4);
  let setR = null, S = null, comp = null, res = [], ci = -1;
  const CC = [GM.amber, GM.blue, GM.pink];
  const vis = async (u, v) => { if (u) await G.hop(tok, u, v, '→', 330); await G.go(tok, v, 330); G.color(v, GM.vis); setR.push(v); };
  const fin = async (v, back) => { if (back) await G.go(tok, v, 300); G.color(v, GM.done); S.push(v); };
  const startC = async (v) => { ci++; comp = [v]; await G.go(tok, v, 500); G.color(v, CC[ci]); setR.push(v); res[ci] = tag('{' + v + '}', 'say', -5.6 + ci * 2.6, 0.1, 4.0); };
  const addC = async (u, v) => { await G.hop(tok, u, v, '→', 330); await G.go(tok, v, 330); G.color(v, CC[ci]); setR.push(v); comp.push(v); txt(res[ci], '{' + comp.join(',') + '}'); };
  await gmSeq(tok, [
    () => { C.hl(0); say('主函式 SCC：回傳一串 set', '每個 set 是一個 SCC'); },
    () => { C.hl(1); setR = gmRow(-6.4, 2.6, 'visited'); S = gmStack(2.6, -0.6, 'stack'); say('準備 stack 和 visited', '第一遍：每個點做 DFS'); },
    async () => { C.hl(2); await G.go(tok, 2); say('從 2 開始：不在 visited → dfs(2)'); },
    () => { C.hl(8); say('dfs：做 DFS', '鄰居都探索完，才放進 stack'); },
    () => { G.color(2, GM.vis); setR.push(2); say('2 加進 visited'); },
    () => { C.hl(9); return vis(2, 3).then(() => say('2 的鄰居 3：dfs(3)，加進 visited')); },
    () => vis(3, 1).then(() => say('3 的鄰居 1：dfs(1)')),
    async () => { await G.hop(tok, 1, 2, '✗'); C.hl(10); await fin(1); say('1 的鄰居 2 已拜訪', '1 放進 stack'); },
    async () => { C.hl(9); await G.go(tok, 3, 300); await vis(3, 5); say('退回 3：另一個鄰居 5'); },
    () => vis(5, 6).then(() => say('5 的鄰居 6')),
    () => vis(6, 4).then(() => say('6 的鄰居 4')),
    async () => { await G.hop(tok, 4, 5, '✗'); C.hl(10); await fin(4); say('4 的鄰居 5 已拜訪', '4 放進 stack'); },
    () => fin(6, true).then(() => say('退回 6 → 6 放進 stack')),
    () => fin(5, true).then(() => say('退回 5 → 5 放進 stack')),
    () => fin(3, true).then(() => say('退回 3 → 3 放進 stack')),
    () => fin(2, true).then(() => say('退回 2 → 2 放進 stack')),
    async () => { C.hl(2); await vis(null, 7); say('回到主函式：還沒拜訪的 7', 'dfs(7)'); },
    async () => { await G.hop(tok, 7, 6, '✗'); C.hl(10); await fin(7); say('7 的鄰居 6 已拜訪', '7 放進 stack'); },
    () => { C.hl(2); say('stack 填好了', '依完成時間由晚到早'); },
    async () => { C.hl(3); G.reverse(); G.reset(); await gmWait(tok, 300); say('把圖反向，開始第二遍'); },
    () => { setR.clear(); res.forEach(remove); say('清空 visited', '準備放結果的 list'); },
    () => { C.hl(4); S.pop(); say('stack 不是空的 → pop 出 7', '開新的 set'); },
    async () => { C.hl(11); await startC(7); say('dfsR(7)：7 加進 visited 和 set', '反向圖裡 7 沒有鄰居'); },
    () => { C.hl(7); say('{7} 加進結果：第一個 SCC'); },
    async () => { C.hl(4); S.pop(); await startC(2); say('pop 出 2：開新的 set'); },
    () => { C.hl(13); return G.hop(tok, 2, 1, '→', 330).then(() => say('2 加進 set；第一個鄰居 1')); },
    async () => { C.hl(12); await G.go(tok, 1, 330); G.color(1, CC[ci]); setR.push(1); comp.push(1); txt(res[ci], '{' + comp.join(',') + '}'); await addC(1, 3); say('1 加進同一個 set', '1 的鄰居 3 也加進來'); },
    async () => { await G.hop(tok, 3, 2, '✗'); say('3 的鄰居 2 已拜訪 → 退回'); },
    () => { C.hl(7); say('{2, 1, 3} 加進結果'); },
    () => { C.hl(4); S.pop(); say('pop 出 3：已拜訪 → 不做事'); },
    async () => { S.pop(); await startC(5); say('pop 出 5：開新的 set'); },
    async () => { await G.hop(tok, 5, 3, '✗'); say('5 的第一個鄰居 3：已拜訪'); },
    () => addC(5, 4).then(() => say('下一個鄰居 4：加進 set')),
    () => addC(4, 6).then(() => say('4 的鄰居 6：加進 set')),
    async () => { await G.hop(tok, 6, 5, '✗'); await G.hop(tok, 6, 7, '✗'); say('6 的鄰居 5、7 都拜訪過'); },
    () => { C.hl(7); say('退回 4、5：{5, 4, 6} 加進結果'); },
    async () => { C.hl(4); for (let i = 0; i < 3; i++) { S.pop(); await gmWait(tok, 200); } say('pop 出 6、4、1：都拜訪過'); },
    () => { tag('SCC：{7} {2,1,3} {5,4,6}', 'good', -3.2, 0.1, 4.8); say('SCC：7｜2 1 3｜5 4 6'); },
    () => { tag('時間 O(V+E)　空間 O(V)', 'note', -3.2, 1.4, -3.4); say('時間 O(V + E)，空間 O(V)'); },
  ]);
}]);

// ─────────── oRpERQA4Vik：MIT 6.006 Recitation 16〈Rubik's Cube, StarCraft Zero〉 ───────────
// 2×2×2 魔術方塊：8 個 cubelet、每個 3 張外露的 plastic face → 24 張；configuration = 24 格的陣列（一個 permutation）。
// 前 +z 黃、後 白、上 +y 藍、下 綠、右 +x 橘、左 紅：右上前的 cubelet 就是 yellow-orange-blue（yob）。
const RB_COL = { px: '#f08a24', nx: '#d64545', py: '#3d7be0', ny: '#2fa35a', pz: '#f2d23c', nz: '#f4f4f4' };
function rbCubelet(sx, sy, sz, gap = 0.5) {
  const g = new THREE.Group(); g.position.set(sx * gap, sy * gap, sz * gap);
  g.add(lab.box('#2b2622', [0.94, 0.94, 0.94]));
  const st = [];
  const add = (key, ax) => {
    const sz3 = ax === 'x' ? [0.05, 0.78, 0.78] : ax === 'y' ? [0.78, 0.05, 0.78] : [0.78, 0.78, 0.05];
    const m = lab.box(RB_COL[key], sz3); const s = key[0] === 'p' ? 1 : -1;
    m.position[ax] = s * 0.48; g.add(m); st.push(m); m.userData.key = key; return m;
  };
  g.userData.st = { x: add(sx > 0 ? 'px' : 'nx', 'x'), y: add(sy > 0 ? 'py' : 'ny', 'y'), z: add(sz > 0 ? 'pz' : 'nz', 'z') };
  g.userData.s = [sx, sy, sz];
  return g;
}
function rbCube(x, y, z, s = 1) {
  const G = new THREE.Group(); G.position.set(x, y, z); G.scale.setScalar(s);
  const cs = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { const c = rbCubelet(sx, sy, sz); G.add(c); cs.push(c); }
  lab.world.add(G);
  G.userData.cs = cs; G.userData.find = (sx, sy, sz) => cs.find((c) => c.userData.s[0] === sx && c.userData.s[1] === sy && c.userData.s[2] === sz);
  return G;
}
function rbWire(x, y, z, s = 1) {
  const G = new THREE.Group(); G.position.set(x, y, z); G.scale.setScalar(s);
  const mat = new THREE.LineBasicMaterial({ color: '#8a7a60' });
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.94, 0.94, 0.94)), mat); l.position.set(sx * 0.5, sy * 0.5, sz * 0.5); G.add(l);
  }
  lab.world.add(G); return G;
}
// a world-space sticker that flies from one place to another
async function rbFly(tok, color, a, b, ms = 600) {
  const m = lab.box(color, [0.6, 0.6, 0.05]); m.position.copy(a); lab.world.add(m);
  await anim(tok, ms, (u) => { m.position.lerpVectors(a, b, u); m.position.y += Math.sin(u * Math.PI) * 0.8; });
  return m;
}
const RB_CAM = [0, 6.5, 10], RB_LOOK = [0, 1.4, 0];

// 1:20 plastic faces、wireframe cube、命名
FRAG.push(['graphmisc-rub-faces', '2×2×2 魔術方塊：24 張 plastic face', async (tok) => {
  fresh(RB_CAM, RB_LOOK);
  let P = null, W = null, n = null, c0 = null, nm = null;
  const nt = (t, cls = 'note') => { remove(n); n = tag(t, cls, 0, 4.2, 0); };
  await gmSeq(tok, [
    async () => { P = rbCube(-3.0, 1.4, 0, 1); await anim(tok, 900, (u) => { P.rotation.y = -0.5 * u; P.rotation.x = 0.35 * u; }); nt("2×2×2 Rubik's cube"); say("2×2×2 的 Rubik's cube"); },
    async () => { await anim(tok, 700, (u) => P.userData.cs.forEach((c) => { const [sx, sy, sz] = c.userData.s; c.position.set(sx * (0.5 + 0.3 * u), sy * (0.5 + 0.3 * u), sz * (0.5 + 0.3 * u)); })); nt('由 8 個小方塊（cubelet）組成'); say('大方塊由幾個小方塊組成？', '8 個 cubelet'); },
    () => { c0 = P.userData.find(1, 1, 1); glow(c0.children[0], '#553300'); nt('每個 cubelet 有 6 面：3 面朝內'); say('每個 cubelet 有 6 面', '其中 3 面永遠朝向中心'); },
    () => { Object.values(c0.userData.st).forEach((m) => glow(m, '#444400')); nt('我們只在意朝外的 3 面'); say('朝內的不管', '只在意朝外有顏色的 3 面'); },
    async () => { await anim(tok, 600, (u) => P.userData.cs.forEach((c) => { const [sx, sy, sz] = c.userData.s; c.position.set(sx * (0.8 - 0.3 * u), sy * (0.8 - 0.3 * u), sz * (0.8 - 0.3 * u)); })); nt('plastic cube：8 個 cubelet × 3 張有色面'); say('一顆塑膠方塊：8 個 cubelet', '每個有 3 張彩色的面'); },
    () => { nt('8 × 3 = 24 張 plastic face', 'good'); say('總共 8 × 3 = 24 張 plastic face'); },
    () => { W = rbWire(3.2, 1.4, 0, 1); W.rotation.set(0.35, -0.5, 0); nt('wireframe cube：只有骨架、沒有顏色'); say('想像一個只有骨架的 wireframe cube', '形狀對，但沒有顏色'); },
    async () => {
      const keys = [[1, 1, 1, 'z'], [1, 1, 1, 'y'], [1, 1, 1, 'x']];
      for (const [sx, sy, sz, ax] of keys) {
        const st = P.userData.find(sx, sy, sz).userData.st[ax]; const a = new THREE.Vector3(); st.getWorldPosition(a);
        const b = a.clone().add(V3(6.2, 0, 0)); await rbFly(tok, st.material.color.getStyle(), a, b, 500);
      }
      nt('把 24 張 plastic face 一張一張貼到骨架上'); say('把 24 張 plastic face', '一張一張貼到骨架上');
    },
    () => { nt('任何轉過的樣子都能這樣「貼」出來'); say('任何 configuration 都能這樣貼出來'); },
    () => { nt('wireframe 也有 24 個面', 'good'); say('wireframe 有幾個面？也是 24'); },
    () => { nt('有些貼法轉不出來（後面再說）'); say('有些貼法是不可能轉出來的', '這其實是好消息'); },
    () => { nm = tag('yob', 'ptr alt', -2.1, 2.8, 0.9); nt('黃色那面 = yob（黃－橘－藍 cubelet 的黃面）'); say('程式怎麼叫這一面？', 'y = yellow：yob 的黃色那面'); },
    () => { nt('沒有兩個 cubelet 顏色組合相同 → 名字不會重複'); say('沒有兩個 cubelet 顏色一樣', '所以名字可以區分每一面'); },
    () => { txt(nm, 'yob　oby　byo'); nt('第一個字母 = 你指的那一面', 'good'); say('原則：第一個字母', '就是你指著的那一面'); },
  ]);
}]);

// 5:49 wireframe 面的名字、configuration 陣列
FRAG.push(['graphmisc-rub-config', 'Configuration：24 格的陣列', async (tok) => {
  fresh(RB_CAM, RB_LOOK);
  const W = rbWire(0, 1.6, -0.6, 1.1); W.rotation.set(0.35, -0.6, 0);
  let n = null, F = null, cells = [];
  const nt = (t, cls = 'note') => { remove(n); n = tag(t, cls, 0, 4.4, -0.6); };
  const CX = (i) => -3.3 + (i % 12) * 0.6, CZ = (i) => 2.4 + Math.floor(i / 12) * 0.7;
  await gmSeq(tok, [
    () => { nt('plastic face 有 24 個名字（yob、oby…）'); say('plastic face 有 24 個名字'); },
    () => { nt('wireframe 的面沒有顏色 → 用位置取名'); say('wireframe 的面都一樣', '只好用「位置」來取名'); },
    () => { tag('F 前', 'ptr', 1.1, 1.4, 1.2); tag('U 上', 'ptr', 0, 3.4, -0.6); tag('R 右', 'ptr', 2.0, 1.6, -0.2); nt('front / back、up / down、left / right'); say('前後、上下、左右'); },
    () => { F = lab.box('#ffe9a8', [0.8, 0.8, 0.05]); F.position.set(0.45, 0.55, 0.5); W.add(F); tag('FUR', 'ptr alt', -2.4, 2.8, 0.4); say('前、上、右的那個 cubelet', '它的前面叫 FUR'); },
    () => { nt('configuration：把 plastic face 貼到 wireframe face'); say('一個 configuration', '= plastic face 貼在 wireframe 哪裡'); },
    async () => { for (let i = 0; i < 24; i++) { cells.push(cube('', GM.gray, [0.5, 0.4, 0.5], CX(i), 0.2, CZ(i), 0.6)); if (i % 4 === 3) await gmWait(tok, 60); } nt('configuration = 24 個元素的陣列'); say('它是 24 個元素的陣列'); },
    () => { tint(cells[0], GM.amber); tag('FUR', 'idx', CX(0), 0.1, CZ(0) - 0.55); say('第一格：哪張 plastic face 貼在 FUR'); },
    () => { cells.forEach((c, i) => { c.add(lab.label(String(i), 'idx')); }); nt('每張面編號 0 到 23（Python 從 0 開始）'); say('編號 0 到 23', 'Python 從 0 開始數'); },
    async () => { const a = V3(-4.5, 1.2, 0.5), b = V3(CX(0), 0.6, CZ(0)); const m = await rbFly(tok, RB_COL.pz, a, b, 700); m.add(lab.label('yob', 'val')); say('yob 那張貼在 FUR', '所以陣列第一格是 yob'); },
    () => { nt('名字的第一個字母 = 指的是哪一面（FUR ≠ RUF）'); say('字母順序：第一個字母', '說明指的是哪一面'); },
    () => { tag('RUF', 'idx', CX(1), 0.1, CZ(1) - 0.55); tag('URF', 'idx', CX(2) + 0.1, 0.1, CZ(2) - 0.85); nt('假設 FUR = 0、RUF = 1、URF = 2', 'good'); say('假設 FUR 是 0 號、RUF 是 1 號……', '程式裡有真正的對照'); },
  ]);
}]);

// 10:30 有幾種 configuration？implicit graph
FRAG.push(['graphmisc-rub-implicit', 'Configuration 有 24! 種 → implicit graph', async (tok) => {
  fresh(GM_CAM, GM_LOOK);
  let n = null, P = null, nodes = [], piv = null;
  const nt = (t, cls = 'note') => { remove(n); n = tag(t, cls, 0, 3.6, -2.6); };
  const L = [], R = [];
  await gmSeq(tok, [
    () => { nt('一共有幾種 configuration？'); say('一共有幾種 configuration？'); },
    async () => { for (let i = 0; i < 6; i++) { L.push(cube(i, RB_COL[['px', 'nx', 'py', 'ny', 'pz', 'nz'][i]], [0.45, 0.45, 0.45], -4.5, 0.3, -1.8 + i * 0.7)); R.push(cube('', GM.gray, [0.45, 0.45, 0.45], -1.5, 0.3, -1.8 + i * 0.7)); } tag('plastic face（24）', 'idx', -4.5, 0.1, 2.6); tag('位置（24）', 'idx', -1.5, 0.1, 2.6); say('24 張 plastic face', '要放到 24 個位置'); },
    () => { tag('有些轉不出來（不能拆開方塊）', 'bad', 3.2, 1.6, -1.2); say('有些貼法到不了', '因為不能把方塊拆開'); },
    async () => { const perm = [3, 0, 5, 1, 4, 2]; for (let i = 0; i < 6; i++) { line(-4.2, 0.35, -1.8 + i * 0.7, -1.8, 0.35, -1.8 + perm[i] * 0.7, 0, '#c08a1f'); await gmWait(tok, 120); } nt('一對一的對應：bijection'); say('一對一的對應：bijection'); },
    () => { nt('一對一排好 = permutation（排列）', 'good'); say('這種對應就是 permutation'); },
    () => { tag('24! ≈ 6.2 × 10²³', 'say', 3.2, 1.6, 0.0); say('24 個元素的排列：24! 種', '非常多'); },
    async () => { const pos = [[1.8, 2.0], [3.4, 2.6], [5.0, 2.0], [3.4, 1.0]]; pos.forEach(([x, z], i) => nodes.push(cube('', GM.idle, [0.5, 0.5, 0.5], x, 0.3, z))); [[0, 1], [1, 2], [0, 3], [3, 2]].forEach(([a, b]) => line(pos[a][0], 0.3, pos[a][1], pos[b][0], 0.3, pos[b][1])); tag('頂點 = configuration　邊 = 一步轉動', 'note', 3.4, 1.4, 3.4); say('圖：頂點是 configuration', '邊是一步轉動'); },
    () => { tag('先建好整張圖？記憶體不夠！', 'bad', 3.2, 2.2, -0.6); say('能不能先把整張圖建好再跑 BFS？', '不行：RAM 不夠'); },
    () => { nt('implicit graph：BFS 只需要「拿到鄰居」'); say('改用 implicit graph', 'BFS 只需要：拜訪時拿到它的鄰居'); },
    async () => { tint(nodes[0], GM.vis); glow(nodes[0], GOLD); await gmWait(tok, 250); [1, 3].forEach((i) => tint(nodes[i], GM.blue)); say('只要知道起點', '和「給一個點，算出它的鄰居」'); },
    async () => {
      P = rbCube(-3.0, 1.2, 0.6, 0.8); P.rotation.set(0.35, -0.5, 0);
      piv = new THREE.Group(); P.add(piv); P.userData.cs.filter((c) => c.userData.s[2] > 0).forEach((c) => piv.attach(c));
      await anim(tok, 900, (u) => { piv.rotation.z = -Math.PI / 2 * u; });
      nt('一步：把一面轉 90°（順時針或逆時針）'); say('一步 = 把某一面轉 90 度', '順時針或逆時針');
    },
    async () => { await anim(tok, 700, (u) => { piv.rotation.z = -Math.PI / 2 + Math.PI / 2 * u; }); nt('前面順時針 = 後面逆時針（考慮對稱）'); say('前面順時針，和後面逆時針', '轉完其實一樣（對稱）'); },
    () => { const c = P.userData.find(-1, -1, -1); glow(c.children[0], '#663300'); nt('固定（anchor）一個 cubelet → 沒有對稱問題'); say('固定一個 cubelet 不動', '就消除了對稱'); },
    () => { tag('L+ L−　U+ U−　B+ B−：共 6 種', 'good', 3.2, 2.8, 0.6); say('剩下 6 種 move', '例如左面順、逆時針，上面順、逆時針'); },
  ]);
}]);

// 17:32 move 也是 permutation
FRAG.push(['graphmisc-rub-move', 'Move 也是一個 permutation', async (tok) => {
  fresh(GM_CAM, GM_LOOK);
  let n = null; const A = [], B = [], arr = [];
  const nt = (t, cls = 'note') => { remove(n); n = tag(t, cls, 0, 3.4, -2.6); };
  const X = (i) => -4.2 + i * 1.2;
  const before = ['yob', 'gwr', 'oby', 'rgw', 'bri', 'wog', 'ybr', 'ryg'], perm = [2, 0, 3, 1, 4, 5, 6, 7];
  await gmSeq(tok, [
    () => { nt('一步 move 長什麼樣子？'); say('一步 move 長什麼樣子？'); },
    () => { before.forEach((s, i) => A.push(cube(s, GM.amber, [0.9, 0.5, 0.7], X(i), 0.25, -1.2))); tag('configuration（24 格裡的 8 格）', 'idx', 0, 0.05, -2.0); nt('move 不會新增或銷毀 plastic face，只換位置'); say('move 不製造、也不毀掉 plastic face', '只改變它們貼在哪'); },
    async () => { for (let i = 0; i < 4; i++) { arr.push(line(X(perm[i]), 0.3, -0.8, X(i), 0.3, 1.0, 0, '#d64545')); await gmWait(tok, 180); } nt('前面順時針轉：這格的面跑到那格'); say('前面順時針轉一下', '這一格的面跑到那一格'); },
    () => { for (let i = 4; i < 8; i++) arr.push(line(X(i), 0.3, -0.8, X(i), 0.3, 1.0, 0, '#c9bba4')); nt('同一種 move，箭頭永遠一樣'); say('同一種 move', '箭頭的樣子永遠相同'); },
    async () => { for (let i = 0; i < 8; i++) { B.push(cube(before[perm[i]], GM.vis, [0.9, 0.5, 0.7], X(i), 0.25, 1.4, 1.0)); } await gmWait(tok, 300); nt('變的只有陣列裡的內容'); say('變的只有陣列裡裝的東西'); },
    () => { nt('這些箭頭在做什麼？洗牌（shuffle）'); say('這些箭頭在做什麼？', '把元素洗牌'); },
    () => { nt('數學名字：move 也是一個 permutation', 'good'); say('所以 move 也是一個 permutation'); },
    () => { tag('configuration：permutation', 'say', -3.0, 1.6, 3.2); tag('move：permutation', 'say', 3.0, 1.6, 3.2); say('兩個東西都用 permutation 表示', 'configuration 和 move'); },
    () => { nt('鄰居：6 種 move，每種 24 個數字'); say('要算鄰居：6 種 move', '每種寫成 24 個數字'); },
    async () => { for (const m of B) { glow(m, GOLD); } await gmWait(tok, 300); for (const m of B) glow(m, null); nt('configuration 套上 move 的 permutation → 鄰居', 'good'); say('把 configuration 套上 move 的 permutation', '得到的新 configuration 就是鄰居'); },
    () => { nt('要打很多數字…想少打一點'); say('但這要打很多字', '想辦法少打一點'); },
    () => { nt('左面順時針 = 左面逆時針的 inverse', 'good'); say('左面順時針，就是左面逆時針的 inverse', '會算 inverse 就少打一半'); },
  ]);
}]);

// 22:15 permutation 的 inverse
FRAG.push(['graphmisc-rub-inverse', 'Permutation 的 inverse：把 index 和值對調', async (tok) => {
  fresh(GM_CAM, GM_LOOK);
  let n = null; const X = (i) => -2.4 + (i - 1) * 1.2;
  const P = [], IN = [], OUT = [], AR = [], BK = [];
  let pi = [3, 5, 1, 2, 4];
  const nt = (t, cls = 'note') => { remove(n); n = tag(t, cls, 0, 3.0, -3.4); };
  const arrow1 = (i) => { AR.push(line(X(pi[i - 1]), 0.3, 0.9, X(i), 0.3, 2.3, 0, '#d64545')); };
  const out = (i) => { OUT[i] = cube('ABCDE'[pi[i - 1] - 1], GM.vis, [0.6, 0.5, 0.6], X(i), 0.25, 2.8, 1.0); };
  await gmSeq(tok, [
    () => { nt('好消息：有些 move 是多餘的，而且程式都寫好了'); say('兩個好消息', '有些 move 多餘；程式也都寫好了'); },
    () => { for (let i = 1; i <= 5; i++) P.push(cube(pi[i - 1], GM.amber, [0.6, 0.5, 0.6], X(i), 0.25, -1.2)); tag('π', 'ptr', -3.8, 0.4, -1.2); nt('5 個元素的 permutation：3 5 1 2 4'); say('拿 5 個元素的 permutation 來看'); },
    () => { for (let i = 1; i <= 5; i++) tag(String(i), 'idx', X(i), 0.1, -2.0); nt('上面加一列位置 1 2 3 4 5'); say('上面再加一列位置編號', '比較清楚'); },
    () => { for (let i = 1; i <= 5; i++) IN.push(cube('ABCDE'[i - 1], GM.blue, [0.6, 0.5, 0.6], X(i), 0.25, 0.5)); tag('輸入', 'idx', -3.8, 0.1, 0.5); tag('輸出', 'idx', -3.8, 0.1, 2.8); say('permutation 把輸入 A B C D E', '照規則變成輸出'); },
    () => { arrow1(1); out(1); say('輸出第 1 個 = 輸入第 3 個：C'); },
    () => { arrow1(2); out(2); say('輸出第 2 個 = 輸入第 5 個'); },
    () => { AR.forEach(gmKill); AR.length = 0; OUT.forEach((m) => m && kill(m)); pi = [3, 4, 1, 5, 2]; P.forEach((m, i) => { m.children.forEach((c) => { if (c.element) c.element.textContent = String(pi[i]); }); }); arrow1(1); out(1); arrow1(2); out(2); nt('換一個 permutation：π = 3 4 1 5 2'); say('換一個好看一點的：3 4 1 5 2', '第 2 個 = 輸入第 4 個：D'); },
    () => { arrow1(3); out(3); say('輸出第 3 個 = 輸入第 1 個：A'); },
    () => { arrow1(4); out(4); say('輸出第 4 個是哪個字母？E'); },
    () => { arrow1(5); out(5); say('第 5 個呢？B'); },
    () => { nt('π 作用在 A B C D E → C D A E B', 'good'); say('套用 π 的結果：C D A E B'); },
    () => { nt('inverse π⁻¹：把 π 的效果還原'); say('inverse π⁻¹ 是另一組箭頭', '要把 π 的效果還原'); },
    async () => { for (let i = 1; i <= 5; i++) { BK.push(cube('ABCDE'[i - 1], GM.pink, [0.6, 0.5, 0.6], X(i), 0.25, 4.2, 1.0)); await gmWait(tok, 120); } tag('π⁻¹ 之後', 'idx', -3.8, 0.1, 4.2); say('把 C D A E B 再丟進 π⁻¹', '要拿回 A B C D E'); },
    () => { nt('作法：把兩列上下翻過來'); tag('翻轉：(3,1) (4,2) (1,3) (5,4) (2,5)', 'say', 3.6, 1.2, -1.2); say('把這兩列上下翻過來'); },
    () => { tag('排好：π⁻¹ = 3 5 1 2 4', 'good', 3.6, 1.2, -0.4); say('再照上面那列排好', 'π⁻¹ = 3 5 1 2 4'); },
    () => { glow(IN[1], GOLD); nt('看 B：一開始在位置 2'); say('為什麼？看 B', 'B 一開始在位置 2'); },
    () => { glow(OUT[5], GOLD); nt('π(5) = 2 → 套用 π 之後，B 跑到位置 5'); say('π(5) = 2', '所以 B 跑到位置 5'); },
    () => { glow(BK[1], GOLD); nt('π⁻¹ 要把 B 放回位置 2 → π⁻¹(2) = 5'); say('π⁻¹ 要把 B 放回 2', '所以 π⁻¹(2) = 5'); },
    () => { nt('把「位置」和「值」對調 → 就是 inverse', 'good'); say('把位置和值對調', '就得到 inverse permutation'); },
    () => { nt('有了 inverse，只要打一半的 move'); say('這樣就不用打全部的 permutation'); },
  ]);
}]);

// 28:50 玩具 StarCraft：規則
FRAG.push(['graphmisc-sc-rules', '玩具 StarCraft：Zerg 的規則', async (tok) => {
  fresh(GM_CAM, GM_LOOK);
  let n = null, H = null, d = null, z = null, o = null;
  const nt = (t, cls = 'note') => { remove(n); n = tag(t, cls, 0, 3.4, -3.2); };
  await gmSeq(tok, [
    () => { nt('問題：解一個簡化版的 StarCraft'); say('來解一個簡化版的 StarCraft'); },
    () => { nt('扮演 Zerg：先組軍隊，再打倒對手'); say('扮演 Zerg 種族', '組一支軍隊打倒對手'); },
    () => { nt('build order：開局要依序建造什麼'); say('看 build order', '開局什麼時候建什麼'); },
    () => { H = prop('warehouse', -4.6, 0, -0.6, 1.0, 'hatchery'); tag('$ minerals', 'pkt', -2.4, 1.0, -1.4); say('一開始有一座 hatchery', '貨幣是 minerals（$）'); },
    async () => { d = buddy('drone', '$50', '#c8925a', -1.6, 0, 1.0, 0.7); o = buddy('overlord', '$100', '#9b7fd1', 0.6, 1.2, 1.0, 0.7); z = buddy('zergling', '$50', '#6cc46a', 2.8, 0, 1.0, 0.7); await d.hop(tok); say('hatchery 可以生：drone $50', 'overlord $100、zergling $50'); },
    async () => { d.mood('happy'); const h = tag('+8 $/秒', 'good', -1.6, 1.8, 1.0); await travel(tok, h, V3(-1.6, 1.8, 1.0), V3(-2.4, 2.4, -1.4), 700); say('drone 是工人：每秒採 8 minerals'); },
    async () => { z.mood('wow'); await z.hop(tok); tag('攻擊單位', 'say', 2.8, 2.2, 1.0); say('zergling 是攻擊單位', '最後想要的就是它'); },
    () => { tag('每 8 個單位需要 1 隻 overlord', 'note', 0.6, 2.9, 1.0); say('overlord：每 8 個單位', '需要 1 隻 overlord 來控制'); },
    () => { prop('note', 4.4, 0, -1.0, 1.4); tag('spawning pool', 'say', 4.4, 1.0, -1.0); say('要生 zergling', '還需要一座 spawning pool'); },
    () => { tag('drone 變建築：pool $200、hatchery $450、evolution chamber $400', 'note', 0, 0.2, 3.2); d.mood('wow'); say('drone 可以變成建築（變了就不採礦）', 'pool 200、hatchery 450、evo chamber 400'); },
    () => { tag('1 座 hatchery：每秒最多生 1 隻', 'bad', -4.6, 2.4, -0.6); say('一座 hatchery 每秒只能生一隻', '錢多就要多蓋 hatchery'); },
    () => { tag('evolution chamber：攻擊／防禦升級各 $1000（拿到就有）', 'note', 3.0, 0.2, -2.4); say('evolution chamber：研究攻擊、防禦升級', '各 1000，像徽章，拿到就永遠有'); },
    () => { tag('zergling 戰力：無 1、攻 1.33、防 1.2、都有 2', 'say', 0, 0.2, 4.2); say('zergling 戰力：沒升級 1', '只有攻擊 1.33、只有防禦 1.2、都有 2'); },
    () => { nt('最多只能控制 200 個單位'); say('最多只能控制 200 個單位'); },
    () => { nt('目標：最快湊滿 200 個單位，至少 150 隻 zergling', 'good'); say('目標：最快湊到 200 個單位', '其中至少 150 隻 zergling'); },
  ]);
}]);

// 35:13 貪心策略與騷擾規則
FRAG.push(['graphmisc-sc-harass', '貪心開局、每 2 分鐘的騷擾', async (tok) => {
  fresh(GM_CAM, GM_LOOK);
  let n = null; const ds = [];
  const nt = (t, cls = 'note') => { remove(n); n = tag(t, cls, 0, 3.4, -3.2); };
  await gmSeq(tok, [
    async () => { for (let i = 0; i < 5; i++) { ds.push(buddy('', '', '#c8925a', -5 + i * 1.0, 0, -0.5, 0.55)); await gmWait(tok, 120); } nt('貪心：先蓋經濟（drone、hatchery）'); say('簡單的策略：先把經濟做起來', 'greedy'); },
    async () => { for (let i = 0; i < 5; i++) { const b = buddy('', '', '#6cc46a', 0.6 + i * 1.0, 0, 1.2, 0.55); b.mood('happy'); await gmWait(tok, 120); } nt('50 隻 drone 之後，全力生 zergling'); say('有了 50 隻 drone', '就全力生 zergling'); },
    () => { tag('每 120 秒', 'ptr alt', 3.6, 2.0, -1.2); nt('加一條規則：每 2 分鐘派一群 zergling 去騷擾'); say('讓問題有趣：每 2 分鐘', '要派一群 zergling 去騷擾對手'); },
    () => { tag('第 n 波的戰力 ≥ 6 · log₂(1 + n)', 'say', 0, 1.6, 3.2); say('第 n 波要的總戰力', '6 · log₂(1 + n)'); },
    () => { tag('第 1 波：沒升級 6 隻、一種升級 5 隻、兩種都有 3 隻', 'note', 0, 0.4, 4.2); say('第一波（2 分鐘）：沒升級要 6 隻', '兩種升級 3 隻、一種升級 5 隻'); },
  ]);
}]);

// 38:37 建圖：狀態要記什麼
FRAG.push(['graphmisc-sc-state', '建圖：一個狀態要記哪些東西', async (tok) => {
  fresh(GM_CAM, GM_LOOK);
  let n = null; const rows = [];
  const nt = (t, cls = 'note') => { remove(n); n = tag(t, cls, 0, 3.4, -3.2); };
  const card = (t, cls = 'say') => { rows.push(tag(t, cls, 2.6, 0.1, -1.6 + rows.length * 0.65)); say(t); };
  let A = null, B = null;
  await gmSeq(tok, [
    () => { nt('老方法：建一張圖'); say('跟之前的遊戲題一樣：建一張圖'); },
    () => { A = cube('狀態', GM.idle, [1.2, 0.6, 0.8], -4.4, 0.3, 0); B = cube('狀態', GM.idle, [1.2, 0.6, 0.8], -1.4, 0.3, 0); arrow(V3(-3.7, 0.3, 0), V3(-2.1, 0.3, 0)); tag('move', 'pkt', -2.9, 0.9, 0); say('頂點 = 遊戲的狀態', '邊 = 可以做的動作'); },
    () => { glow(A, GOLD); nt('一個頂點要記哪些東西？'); say('一個狀態要記什麼？'); },
    () => { tag('單位、建築、升級', 'note', -2.9, 1.6, 1.4); say('分三類：單位、建築、升級'); },
    () => card('單位：drone 數、overlord 數、zergling 數'),
    () => card('建築：hatchery 的數量（決定生產速度）'),
    () => card('spawning pool：有／沒有（Boolean）'),
    () => card('evolution chamber：有／沒有'),
    () => { card('升級：AU、DU 兩個旗標', 'good'); say('升級：攻擊 AU、防禦 DU 兩個 flag'); },
  ]);
}]);

// 41:26 不記錢、不記時間：邊的權重
FRAG.push(['graphmisc-sc-edges', '不記錢與時間：邊的權重 = 等待的秒數', async (tok) => {
  fresh(GM_CAM, GM_LOOK);
  let n = null, bar = null, money = 0;
  const nt = (t, cls = 'note') => { remove(n); n = tag(t, cls, 0, 3.4, -3.2); };
  const setBar = (v) => { money = v; bar.scale.y = Math.max(0.02, v); bar.position.y = v * 0.6; };
  await gmSeq(tok, [
    () => { nt('麻煩的是：錢和時間'); say('棘手的兩件事：錢和時間'); },
    () => { bar = lab.box('#e0b030', [0.8, 1.2, 0.8]); lab.world.add(bar); bar.position.set(-4.5, 0, 0); setBar(1.8); tag('$', 'pkt', -4.5, 2.6, 0); nt('錢可以有很多種數值 → 狀態爆炸'); say('錢的數值很多', '全部記下來，狀態會爆炸'); },
    async () => { for (let k = 0; k < 3; k++) { await anim(tok, 500, (u) => setBar(0.2 + 1.2 * u)); setBar(0.02); } nt('近似：每下一次建造指令，錢就歸零'); say('近似：錢一夠就花掉', '每下一次 build order，錢歸零'); },
    () => { nt('狀態設計好，就不用記錢', 'good'); say('狀態設計得好', '就不必記錢'); },
    () => { tag('收入 = drone 數 × 8 / 秒', 'say', -1.6, 1.6, 0.8); say('採礦速度：drone 數 × 8 每秒'); },
    async () => { for (let i = 0; i < 3; i++) { const t = lab.box('#d8c29b', [3.2, 0.06, 2.0]); t.position.set(2.6, 0.2 + i * 1.0, 0); lab.world.add(t); tag('t = ' + i, 'idx', 4.5, 0.3 + i * 1.0, 1.0); await gmWait(tok, 200); } nt('記時間：一層一個時間點（像上次的公路題）'); say('要記時間的話：加一個時間維度', '一層代表一秒'); },
    () => { nt('時間、錢都記 → 每條邊 1 秒 → BFS'); say('時間和錢都記在狀態裡', '每條邊都是 1 秒：用 BFS'); },
    () => { nt('兩個都不記呢？'); say('那如果時間、錢都不記呢？'); },
    () => { arrow(V3(-3.2, 0.5, 2.6), V3(0.2, 0.5, 2.6)); tag('邊的權重 = 存錢要等的秒數', 'good', -1.5, 1.2, 2.6); say('邊上寫：要等幾秒才存夠錢'); },
    () => { nt('邊權重不同 → 用 Dijkstra', 'good'); say('邊的權重不一樣', '所以用 Dijkstra'); },
  ]);
}]);

// 46:40 用 Dijkstra 的距離處理騷擾
FRAG.push(['graphmisc-sc-dijkstra', 'Dijkstra 已知時間：跨過 120 秒的邊要檢查', async (tok) => {
  fresh(GM_CAM, GM_LOOK);
  let n = null;
  const nt = (t, cls = 'note') => { remove(n); n = tag(t, cls, 0, 3.4, -3.2); };
  const st = (t, x, z, c = GM.idle) => cube(t, c, [1.9, 0.5, 0.8], x, 0.25, z, 1.0);
  const ed = (a, b, w, z = 0) => { arrow(V3(a[0] + 1.0, 0.3, a[1]), V3(b[0] - 1.0, 0.3, b[1])); return tag(w, 'pkt', (a[0] + b[0]) / 2, 0.8, (a[1] + b[1]) / 2 + z); };
  let s0 = null, line120 = null;
  await gmSeq(tok, [
    () => { nt('問題：怎麼確保騷擾準時？'); say('還有一個問題', '怎麼確保每 2 分鐘的攻擊準時？'); },
    () => { s0 = st('1H 6D 1O', -4.6, -0.6, GM.vis); say('起始狀態：1 hatchery、6 drone、1 overlord'); },
    () => { tag('drone $50；6 × 8 = 48/秒 → 1 秒不夠，等 2 秒', 'note', -1.4, 1.6, -1.6); say('想生一隻 drone：50', '每秒 48：1 秒只有 48，要等 2 秒'); },
    () => { st('1H 7D 1O', 0.6, -1.4); ed([-4.6, -0.6], [0.6, -1.4], '2 秒', -0.3); say('到達：1H 7D 1O'); },
    () => { tag('hatchery $450 → 450 ÷ 48 ≈ 9.4，助教取 9 秒', 'note', -1.4, 1.6, 1.6); say('改蓋 hatchery：要 450', '450 ÷ 48 ≈ 9.4：助教說大約 9 秒'); },
    () => { st('2H 5D 1O', 0.6, 1.4); ed([-4.6, -0.6], [0.6, 1.4], '9 秒', 0.3); say('drone 變成 hatchery', '到達：2H 5D 1O'); },
    () => { nt('邊的權重各不相同', 'good'); say('所以每條邊的權重不同'); },
    () => { nt('一種作法：每一波騷擾當一層'); say('一種作法：每波騷擾當成一層'); },
    () => { nt('更好：完全不記時間'); say('能不能完全不記時間？'); },
    () => { tag('Dijkstra：priority queue', 'say', 4.4, 1.6, -1.6); say('用 Dijkstra', '它用 priority queue'); },
    () => { tag('取出一個點時，最短距離已確定', 'good', 4.4, 1.0, -0.8); say('點一被取出', '最短距離就確定了：我們知道「現在幾秒」'); },
    () => { s0 = st('2H 6D 5Z', -4.6, 3.2, GM.vis); tag('t = 119 秒', 'ptr', -4.6, 1.0, 3.2); say('例如在 2H 6D 5Z', '已經知道時間是 119 秒'); },
    () => { st('3H 5D 5Z', 1.2, 3.2, GM.hot); ed([-4.6, 3.2], [1.2, 3.2], '9 秒'); line120 = tag('│ 120 秒', 'bad', -1.8, 1.4, 3.2); say('蓋 hatchery 要等 9 秒', '會跨過 120 秒'); },
    () => { tag('zergling 不夠 → 這條邊不合法', 'bad', 1.2, 1.6, 4.2); say('跨過時要有足夠的 zergling', '不夠 → 這條邊不存在'); },
    () => { nt('產生鄰居時，檢查邊有沒有跨過 120 秒', 'good'); say('取出點時已知時間', '產生鄰居時檢查有沒有跨過 120 秒'); },
    () => { st('2H 6D 8Z', -4.6, 4.4, GM.vis); say('換成 2H 6D 8Z，一樣蓋 hatchery'); },
    () => { st('3H 5D 2Z', 1.2, 4.4, GM.done); ed([-4.6, 4.4], [1.2, 4.4], '9 秒'); tag('派出 6 隻 → 剩 2', 'good', 4.4, 0.8, 4.4); say('跨過 120 秒：派 6 隻去騷擾', '到達 3H 5D 2Z'); },
    () => { nt('靠 Dijkstra 的距離，邊在執行中才產生（implicit）'); say('邊是跑 Dijkstra 時才產生的', '只能用 implicit 的表示法'); },
    () => { nt('圖一邊長大、一邊砍掉不合法的路', 'good'); say('圖一邊長大', '一邊砍掉不合法的路'); },
  ]);
}]);
  }

  // ═══ graphmit.js ═══
  {
// graphmit.js — cued scenes for WilliamFiset DFS (7fujbpJ0LB4), MIT 6.006 L13 BFS (s-CYnVz-uh4),
// Rec13 (5JxShDZ_ylo), L14 DFS / topological sort (AfSk24UTFS8) and Rec14 (C5SPsY72_CM).
// Every `await step(tok)` waits for the lecturer's sentence (notes cues); motion between steps is short.
// Uses the module's graph helpers (buildGraph, nodeColor, edgeColor, makeStrip, code, bars …) plus kit helpers.
const { step, buddy, travel, remove, prop, bob } = K;
const kan = K.anim;
const GM_CAM = [0, 12.5, 8], GM_LOOK = [0, 0, -0.3];
const GM = { on: '#f2b53a', done: '#9a948a', vis: '#2fc092', hot: '#e8b02a', src: '#4b9ee2' };
const gmFresh = (cam, look) => fresh(cam || GM_CAM, look || GM_LOOK);
const T = (text, cls, x, z, y = 0.35) => tag(text, cls, x, y, z);
const setT = (l, t) => { l.element.textContent = t; };
const clsT = (l, c) => { l.element.className = 'lab-label ' + c; };

// build a graph and return name-based helpers (GR is the module's current graph)
function gmG(def, o = {}) {
  buildGraph(def, o);
  const g = GR;
  const I = (n) => g.G.names.indexOf(String(n));
  const H = (n) => g.nodes[I(n)].home;
  const E = (u, v) => g.edges.find((e) => (e.u === I(u) && e.v === I(v)) || (!g.directed && e.u === I(v) && e.v === I(u)));
  return {
    g, I, H, E,
    col: (n, c, lift = 0) => nodeColor(I(n), c, lift),
    ec: (u, v, c, th = 1) => { const e = E(u, v); if (e) edgeColor(e, c, th); return e; },
    top: (n, t, cls) => nodeTag(I(n), t, cls),
    note: (n, t) => nodeNote(I(n), t),
  };
}
// a little explorer that walks along the edges
function gmWalker(A, n, color = '#f4a56a') { const p = A.H(n); return buddy('', '', color, p.x + 0.55, 0, p.z - 0.55, 0.45); }
async function gmGo(tok, A, w, v, ms = 420) {
  const p = A.H(v), s = w.g.position.clone(), d = V(p.x + 0.55, 0, p.z - 0.55);
  await kan(tok, ms, (u) => w.g.position.lerpVectors(s, d, u));
}
// try an edge u → v that must not be taken: the walker goes part way, sees ✗, comes back
async function gmBlock(tok, A, w, u, v, why) {
  const a = A.H(u), b = A.H(v), s = V(a.x + 0.55, 0, a.z - 0.55), m = s.clone().lerp(V(b.x + 0.55, 0, b.z - 0.55), 0.5);
  const e = A.E(u, v), oc = e ? e.color : null, ot = e ? e.thick : 1;
  if (e) edgeColor(e, C.back, 1.6);
  if (w) { w.mood('wow'); await kan(tok, 380, (k) => w.g.position.lerpVectors(s, m, k)); }
  const x = T('✗ ' + (why || ''), 'note', (a.x + b.x) / 2, (a.z + b.z) / 2, 1.1);
  if (w) { await kan(tok, 380, (k) => w.g.position.lerpVectors(m, s, k)); w.mood('calm'); }
  if (e) edgeColor(e, oc, ot);
  return x;
}
// a packet travelling along an edge
async function gmHop(tok, A, u, v, ms = 420, text = '→') {
  const a = A.H(u), b = A.H(v), h = tag(text, 'pkt', a.x, 0.9, a.z);
  await travel(tok, h, V(a.x, 0.9, a.z), V(b.x, 0.9, b.z), ms);
  remove(h);
}
// a dictionary / table drawn as a column of labels
function gmDict(x, z, title, dz = 0.5, cls = 'ptr') {
  if (title) T(title, 'idx', x, z - 0.6);
  const rows = new Map();
  return {
    rows,
    set(k, v, c) { let l = rows.get(k); if (!l) { l = T('', c || cls, x, z + rows.size * dz); rows.set(k, l); } setT(l, k + (v === undefined ? '' : ': ' + v)); if (c) clsT(l, c); return l; },
    hl(k, on) { const l = rows.get(k); if (l) clsT(l, on ? 'ptr alt' : cls); },
  };
}
// move the vertices to new floor positions (edges follow)
async function gmMove(tok, pos, ms = 1200) {
  const from = GR.nodes.map((nd) => nd.mesh.position.clone());
  pos.forEach((p, i) => { if (!p) return; GR.nodes[i].home = V(p[0], 0.25, p[1]); lab.springTo(GR.nodes[i].b, GR.nodes[i].home); });
  await kan(tok, ms, (u) => { GR.nodes.forEach((nd, i) => { if (pos[i]) nd.mesh.position.lerpVectors(from[i], nd.home, u); }); GR.edges.forEach((e) => drawEdge(GR, e)); });
  GR.nodes.forEach((nd, i) => { if (pos[i]) nd.mesh.position.copy(nd.home); });
  GR.edges.forEach((e) => drawEdge(GR, e));
}
const gmPos = (A, m) => A.g.G.names.map((n) => (m[n] ? m[n] : null));
// a narrator buddy in a corner
const gmHost = (x = -6.0, z = 3.6, color = '#7cc6a4') => buddy('', '', color, x, 0, z, 0.6);

// ═════════════════ 7fujbpJ0LB4：WilliamFiset — Depth First Search ═════════════════
// 0:12 DFS 是什麼
FRAG.push(['graphmit-fiset-intro', 'DFS 是什麼：往深處走，走不下去才回頭', async (tok) => {
  gmFresh();
  await step(tok);                                   // 12.3 what is a DFS
  const A = gmG(GRAPHS.fiset);
  const me = gmHost(-6.2, 3.8);
  say('Depth first search（DFS）', '探索一張圖的頂點與邊');
  await step(tok);                                   // 22.1 a form of traversal
  const w = gmWalker(A, 0);
  T('traversal：把每個頂點都走過一遍', 'say', 0, -4.3);
  me.mood('happy');
  say('DFS 是一種 traversal（走訪）演算法', '');
  await step(tok);                                   // 25.4 easy to code, O(V + E)
  T('好寫　時間 O(V + E)', 'note', 3.6, 4.1);
  T('V = 12 個頂點　E = 14 條邊', 'idx', 3.6, 4.7);
  say('好寫，時間 O(V + E)', 'V = 頂點數、E = 邊數：跟圖的大小成正比');
  await step(tok);                                   // 43.8 by itself not that useful … augmented
  T('數 connected components', 'say', -3.2, 4.0);
  T('判斷兩點連不連通', 'say', -3.2, 4.6);
  T('找 bridges、articulation points', 'say', 0.6, 4.6);
  me.mood('wow');
  say('單獨用不太有用，加一點修改就很強', '');
  await step(tok);                                   // 66.5 plunges depth first … backtracks
  A.col('0', GM.on, 0.2);
  for (const [u, v] of [['0', '9'], ['9', '8'], ['8', '7']]) { A.ec(u, v, C.tree, 2.2); await gmGo(tok, A, w, v, 380); A.col(v, GM.on, 0.2); }
  T('一路往深處走 → 走不下去才 backtrack（回頭）', 'note', 0, -3.7);
  say('depth first：一直往下走，走不下去才回頭', '');
}]);

// 1:23 從節點 0 出發走一遍
FRAG.push(['graphmit-fiset-walk', '例子：從 0 出發 0 → 9 → 8 → 7 …', async (tok) => {
  gmFresh();
  const A = gmG(GRAPHS.fiset);
  T('橘 = 正在拜訪　灰 = 已回溯', 'idx', 0, -4.1);
  const path = gmDict(-6.3, 3.6, '', 0.5, 'idx');
  const trail = [];
  const lab1 = path.set('路線', '');
  const add = (v) => { trail.push(v); setT(lab1, '走過：' + trail.join(' → ')); };
  let w = null, note = null;
  const go = async (u, v) => { A.ec(u, v, C.tree, 2.2); await gmGo(tok, A, w, v, 400); A.col(v, GM.on, 0.25); add(v); };
  const back = (vs) => vs.forEach((v) => { A.col(v, GM.done, 0); });
  const clr = () => { if (note) { kill(note); note = null; } };
  await step(tok);                                   // 83.9 start on node zero
  A.col('0', GM.on, 0.25); w = gmWalker(A, '0'); add('0');
  say('DFS 要從某個頂點開始：從 0 開始', '');
  await step(tok);                                   // 90.7 arbitrarily pick … node nine
  await go('0', '9');
  say('任選一條邊：0 → 9', '');
  await step(tok);                                   // 100.5 only one choice: eight
  await go('9', '8');
  say('9 只有一條路：→ 8', '');
  await step(tok);                                   // 105.1 at eight pick an edge: seven
  await go('8', '7');
  say('8 任選一條：→ 7', '');
  await step(tok);                                   // 111.6 seven → 10 → 11
  await go('7', '10'); await go('10', '11');
  say('7 → 10 → 11', '');
  await step(tok);                                   // 119.2 11 to seven? already being visited
  note = await gmBlock(tok, A, w, '11', '7', '7 正在拜訪中');
  say('11 → 7？7 正在拜訪中，不能再進去', '已拜訪或拜訪中的頂點都不再走');
  await step(tok);                                   // 127.3 backtrack, label gray, back to seven
  clr(); back(['11']); await gmGo(tok, A, w, '10', 300); back(['10']); await gmGo(tok, A, w, '7', 300);
  say('backtrack：11、10 標成灰色，回到 7', '');
  await step(tok);                                   // 137.6 not finished exploring seven
  note = T('7 還有邊沒走', 'note', A.H('7').x, A.H('7').z - 0.9, 1.1);
  say('7 還沒探索完：還有邊可以選', '');
  await step(tok);                                   // 147.4 node three, node two
  clr(); await go('7', '3'); await go('3', '2');
  say('7 → 3 → 2', '');
  await step(tok);                                   // 153.4 two is a dead end, backtrack
  back(['2']); await gmGo(tok, A, w, '3', 320);
  say('2 是死路 → 回到 3', '');
  await step(tok);                                   // 157.7 node four, also a dead end
  await go('3', '4'); back(['4']); await gmGo(tok, A, w, '3', 320);
  say('3 → 4，4 也是死路 → 回到 3', '');
  await step(tok);                                   // 164.3 three's last edge: five, five to six
  await go('3', '5'); await go('5', '6');
  say('3 的最後一條邊：→ 5 → 6', '');
  await step(tok);                                   // 170.0 six to seven? visiting seven currently
  note = await gmBlock(tok, A, w, '6', '7', '7 正在拜訪中');
  say('6 → 7？7 還在拜訪中，不行', '');
  await step(tok);                                   // 175.7 backtrack all the way to eight
  clr();
  for (const [v, to] of [['6', '5'], ['5', '3'], ['3', '7'], ['7', '8']]) { back([v]); await gmGo(tok, A, w, to, 260); }
  say('一路回溯到 8', '6、5、3、7 都標灰');
  await step(tok);                                   // 179.2 eight's last edge: one, one back to zero
  await go('8', '1');
  say('8 的最後一條邊：→ 1', '');
  await step(tok);                                   // 187.4 can't go to zero, currently exploring it
  note = await gmBlock(tok, A, w, '1', '0', '0 正在拜訪中');
  say('1 → 0？0 正在拜訪中，不能去', '');
  await step(tok);                                   // 193.0 backtrack all the way to zero
  clr();
  for (const [v, to] of [['1', '8'], ['8', '9'], ['9', '0']]) { back([v]); await gmGo(tok, A, w, to, 260); }
  back(['0']); w.mood('happy');
  say('全部回溯到 0：走訪完成', '每個頂點都走過了');
  await step(tok);                                   // 199.8 one particular traversal … many ways
  T('任選的邊不同 → 走法就不同', 'note', 0, 4.3);
  say('這只是其中一種走法', '每次「任選一條邊」不同，順序就不同');
}]);

// 3:28 遞迴版 pseudocode
const GM_FCODE = ['n = 節點數', 'g = adjacency list', 'visited = [false, …, false]', '', 'function dfs(at):', '  if visited[at]: return', '  visited[at] = true', '  neighbours = g[at]', '  for next in neighbours:', '    dfs(next)', '', 'start = 0', 'dfs(start)'];
FRAG.push(['graphmit-fiset-code', '遞迴 dfs(at) 與 visited 陣列', async (tok) => {
  gmFresh(GM_CAM, [0.6, 0, -0.3]);
  await step(tok);                                   // 208.4 pseudocode
  const cd = code(GM_FCODE, -3.9, -3.6, 0.52);
  const A = gmG(GRAPHS.fiset, { scale: 0.55, dx: 3.4, dz: -1.4 });
  say('來看遞迴版的 pseudocode', '');
  await step(tok);                                   // 218.0 n the number of nodes
  cd.hl(0); T('n = 12', 'note', 3.4, 1.4);
  say('第一個變數：n = 節點數', '');
  await step(tok);                                   // 230.0 g the adjacency list
  cd.hl(1);
  const gl = T('g[0] = [9, 1]　g[7] = [8, 10, 11, 3, 6] …', 'say', 3.4, 2.0);
  say('g：adjacency list（每個節點的鄰居串列）', '');
  await step(tok);                                   // 233.5 visited boolean array, all false
  cd.hl(2);
  const vis = [];
  for (let i = 0; i < 12; i++) { vis.push(K.cube('F', '#e8ddc8', [0.42, 0.3, 0.42], -0.1 + i * 0.5, 0.15, 3.9, 1.2)); T(String(i), 'idx', -0.1 + i * 0.5, 4.45, 0.1); }
  T('visited', 'idx', -0.9, 3.9);
  say('visited：一開始全部是 false', '還沒拜訪任何節點');
  await step(tok);                                   // 252.1 start = 0, call dfs
  cd.hl(12);
  const ss = makeStrip(-4.2, 2.9, '呼叫', 1.15);
  const stk = [];
  const sset = () => ss.set(stk.map((v, k) => ({ key: 'c' + k + v, text: 'dfs(' + v + ')', color: '#d9cfbd' })));
  stk.push('0'); sset();
  say('起點 start = 0，呼叫 dfs(0)', '');
  await step(tok);                                   // 262.3 one argument: at; recursive
  cd.hl(4);
  say('dfs 只有一個參數 at：目前所在的節點', '而且它是遞迴的');
  await step(tok);                                   // 272.0 base case: already visited → return
  cd.hl(5);
  say('base case：visited[at] 已是 true 就 return', '已經來過的地方沒事做');
  const mark = (v) => { vis[Number(v)].material.color.set(GM.vis); K.relabel(vis[Number(v)], 'T'); A.col(v, GM.on, 0.2); };
  await step(tok);                                   // 281.4 otherwise mark true
  cd.hl(6); mark('0');
  say('否則標記 visited[0] = true', '');
  await step(tok);                                   // 287.7 neighbours from adjacency list, recurse
  cd.hl(8);
  for (const [u, v] of [['0', '9'], ['9', '8']]) {
    A.ec(u, v, C.tree, 2.2); await gmHop(tok, A, u, v, 380);
    cd.hl(9); stk.push(v); sset(); mark(v); cd.hl(8);
  }
  say('拿出鄰居，逐一遞迴呼叫 dfs', 'dfs(0) → dfs(9) → dfs(8) …');
  await step(tok);                                   // 303.8 that's all a DFS is
  cd.hl(-1); remove(gl);
  T('全部就這幾行', 'note', 3.4, 2.0);
  say('DFS 的核心就這幾行', '');
}]);


// 5:08 用 DFS 找 connected components
const GM_COMPS = [['0', '8', '14', '13', '4'], ['1', '5', '17', '16'], ['2', '9', '15', '10'], ['3', '7', '11', '12'], ['6']];
FRAG.push(['graphmit-fiset-comp', '用 DFS 標記 connected components', async (tok) => {
  gmFresh();
  await step(tok);                                   // 308.7 finding connected components
  const A = gmG(GRAPHS.comps);
  const me = gmHost(-6.3, 3.9);
  say('另一個用途：找 connected components', '');
  await step(tok);                                   // 316.1 what is a connected component
  const def = T('connected component：彼此走得到的一整塊', 'say', 0, -4.2);
  say('圖可能分成好幾塊互不相連的部分', '每一塊叫一個 connected component');
  await step(tok);                                   // 331.7 color them to tell them apart
  GM_COMPS.forEach((cs, k) => cs.forEach((v) => A.col(v, SCC_COL[k], 0)));
  me.mood('happy');
  say('一種辨識法：每一塊塗不同顏色', '');
  await step(tok);                                   // 340.9 coloring = same ID value
  GM_COMPS.forEach((cs, k) => cs.forEach((v) => A.note(v, 'id ' + k)));
  say('對電腦來說，「上色」= 同一塊給同一個 id', '');
  await step(tok);                                   // 346.8 e.g. purple id 1, green id 3
  for (const k of [1, 3]) GM_COMPS[k].forEach((v) => A.col(v, SCC_COL[k], 0.4));
  say('例如這一塊全部 id 1、那一塊全部 id 3', '');
  await step(tok);                                   // 361.6 label nodes 0 … n−1
  GM_COMPS.flat().forEach((v) => { A.col(v, C.white, 0); A.note(v, ''); });
  remove(def); T('節點編號 0 … n−1（n = 18）', 'say', 0, -4.2);
  say('用 DFS 來做：先把節點編號 0 到 n−1', '');
  await step(tok);                                   // 369.2 start a DFS at every unvisited node
  T('每個還沒拜訪的節點：開一次 DFS，走到的都標同一個 id', 'note', 0, 4.3);
  say('對每個還沒拜訪的節點啟動一次 DFS', '走得到的全標同一個 id');
  const cnt = T('id = 0', 'ptr alt', 5.6, 4.0);
  let w = null;
  const lab1 = async (vs, k, from) => { for (const v of vs) { if (from && w) { A.ec(from, v, SCC_COL[k], 2); await gmGo(tok, A, w, v, 300); } A.col(v, SCC_COL[k], 0.2); A.note(v, 'id ' + k); from = v; } };
  await step(tok);                                   // 382.3 start at 0: 8, 14, 13 get zero
  w = gmWalker(A, '0');
  A.col('0', SCC_COL[0], 0.2); A.note('0', 'id 0');
  await lab1(['8', '14', '13'], 0, '0');
  say('從 0 開始 DFS：0、8、14、13 都標 0', '');
  await step(tok);                                   // 397.9 backtrack, explore 4, finish
  await gmGo(tok, A, w, '14', 250); await gmGo(tok, A, w, '8', 250); await gmGo(tok, A, w, '0', 250);
  await lab1(['4'], 0, '0');
  say('回溯，再走到 4，也標 0：這一塊結束', '');
  await step(tok);                                   // 413.3 move on to node one
  GM_COMPS[0].forEach((v) => A.col(v, SCC_COL[0], 0));
  await gmGo(tok, A, w, '1', 500); setT(cnt, 'id = 1');
  say('依編號往下：輪到節點 1，還沒拜訪', '開新的 DFS，id = 1');
  await step(tok);                                   // 418.1 five, 17, backtrack, 16
  A.col('1', SCC_COL[1], 0.2); A.note('1', 'id 1');
  await lab1(['5', '17'], 1, '1'); await gmGo(tok, A, w, '5', 250); await lab1(['16'], 1, '5');
  say('1 → 5 → 17，回溯再到 16：都標 1', '');
  await step(tok);                                   // 432.1 then node two, node three …
  GM_COMPS[1].forEach((v) => A.col(v, SCC_COL[1], 0));
  setT(cnt, 'id = 2'); await gmGo(tok, A, w, '2', 350);
  for (const v of GM_COMPS[2]) { A.col(v, SCC_COL[2]); A.note(v, 'id 2'); }
  setT(cnt, 'id = 3'); await gmGo(tok, A, w, '3', 350);
  for (const v of GM_COMPS[3]) { A.col(v, SCC_COL[3]); A.note(v, 'id 3'); }
  say('接著節點 2、節點 3 各自開一次 DFS', '已經拜訪過的節點就跳過');
  await step(tok);                                   // 443.8 every component labeled
  setT(cnt, '共 5 塊'); A.col('6', SCC_COL[4], 0.2); A.note('6', 'id 4');
  w.mood('happy'); me.mood('happy');
  say('每一塊都標好了：共 5 個 connected components', '');
}]);

// 7:36 找 components 的 pseudocode
const GM_CCODE = ['n, g, visited（同前）', 'count = 0', 'components = 整數陣列（長度 n）', '', 'function findComponents():', '  for i in [0, n):', '    if !visited[i]:', '      count++', '      dfs(i)', '  return (count, components)', '', 'function dfs(at):', '  visited[at] = true', '  components[at] = count', '  for next in g[at]:', '    if !visited[next]: dfs(next)'];
FRAG.push(['graphmit-fiset-compcode', 'findComponents：count 與 components 陣列', async (tok) => {
  gmFresh(GM_CAM, [0.4, 0, -0.3]);
  await step(tok);                                   // 456.2 pseudocode
  const cd = code(GM_CCODE, -3.6, -3.9, 0.42);
  const A = gmG(GRAPHS.comps, { scale: 0.5, dx: 3.5, dz: -1.2 });
  say('找 components 的 pseudocode', '');
  await step(tok);                                   // 459.2 everything from before: n, g, visited
  cd.hl(0);
  say('沿用前面的 n、g、visited', '');
  await step(tok);                                   // 472.5 count and components array
  cd.hl(1);
  const cnt = T('count = 0', 'ptr alt', 5.4, 1.6);
  const X = (i) => -4.6 + i * 0.56;
  const comp = [];
  for (let i = 0; i < 18; i++) { comp.push(K.cube('·', '#e8ddc8', [0.42, 0.28, 0.42], X(i), 0.14, 3.7, 1.0)); T(String(i), 'idx', X(i), 4.25, 0.1); }
  T('components', 'idx', -5.6, 3.2);
  say('多一個計數器 count 和整數陣列 components', 'components[i] = 節點 i 屬於第幾塊');
  await step(tok);                                   // 487.0 loop over every node, visited?
  cd.hl(5);
  const ptr = T('i', 'pkt', X(0), 3.1, 0.6);
  say('findComponents：迴圈掃過每個節點', '檢查它有沒有被拜訪過');
  await step(tok);                                   // 497.1 a DFS for every unvisited node
  cd.hl(6);
  say('和前一版不同：每個「沒拜訪過」的節點都開一次 DFS', '');
  await step(tok);                                   // 508.1 DFS marks visited → never revisit
  cd.hl(12);
  say('DFS 會把走到的節點標成 visited', '同一個節點不會被拜訪第二次');
  await step(tok);                                   // 517.5 either skip or start a DFS
  cd.hl(6);
  say('迴圈裡：要嘛跳過，要嘛從它開一次 DFS', '');
  const fill = (k, c) => { for (const v of GM_COMPS[k]) { const i = Number(v); comp[i].material.color.set(SCC_COL[k]); K.relabel(comp[i], String(c)); A.col(v, SCC_COL[k], 0); } };
  await step(tok);                                   // 526.0 new DFS → count++
  cd.hl(7); setT(cnt, 'count = 1');
  say('開新的 DFS 前：count++', 'count = 目前做了幾次 DFS');
  await step(tok);                                   // 534.4 inside dfs: visited, components[at] = count
  cd.hl(13);
  for (const v of GM_COMPS[0]) { const i = Number(v); comp[i].material.color.set(SCC_COL[0]); K.relabel(comp[i], '1'); A.col(v, SCC_COL[0], 0.2); await kan(tok, 200, () => {}); }
  say('dfs 裡：標 visited，components[at] = count', '0、8、14、13、4 都記成 1');
  await step(tok);                                   // 545.2 recurse on unvisited neighbours
  cd.hl(15);
  for (let k = 1; k < GM_COMPS.length; k++) {
    const from = ptr.position.x, to = X(Number(GM_COMPS[k][0]));
    await kan(tok, 300, (u) => ptr.position.set(from + (to - from) * u, 0.6, 3.1));
    setT(cnt, 'count = ' + (k + 1)); fill(k, k + 1);
  }
  say('對還沒拜訪的鄰居遞迴；其他塊也一樣', '');
  await step(tok);                                   // 554.1 return count and components
  cd.hl(9); remove(ptr);
  T('回傳 (count = 5, components)', 'note', 3.5, 2.4);
  say('最後回傳 count 和 components 陣列', '共 5 塊；每個節點只拜訪一次');
}]);

// 9:26 DFS 的其他用途
FRAG.push(['graphmit-fiset-uses', 'DFS 還能做什麼', async (tok) => {
  gmFresh([0, 9, 9], [0, 0.6, 0]);
  const me = buddy('DFS', '', '#f4a56a', 0, 0, 0, 1.0);
  await step(tok);                                   // 566.2 two things covered
  T('✓ 走訪（traversal）', 'say', -3.6, -2.6, 1.0);
  T('✓ connected components', 'say', 3.6, -2.6, 1.0);
  me.mood('happy');
  say('已經看過兩個用途：走訪、找 components', '');
  await step(tok);                                   // 575.0 MST, cycles, bipartite
  T('minimum spanning tree', 'note', -4.4, -0.6, 0.8);
  T('偵測並找出 cycle', 'note', 4.4, -0.6, 0.8);
  T('檢查 bipartite', 'note', -4.4, 0.8, 0.8);
  say('加以擴充：MST、找 cycle、檢查 bipartite', '');
  await step(tok);                                   // 588.0 SCC, topological sort, bridges/APs
  T('strongly connected components', 'note', 4.4, 0.8, 0.8);
  T('topological sort', 'note', -4.4, 2.2, 0.8);
  T('bridges、articulation points', 'note', 4.4, 2.2, 0.8);
  me.mood('wow');
  say('還有 SCC、topological sort、bridges', '');
  await step(tok);                                   // 593.3 augmenting paths, mazes
  T('flow network 的 augmenting path', 'note', -3.0, 3.6, 0.8);
  T('產生迷宮', 'note', 3.4, 3.6, 0.8);
  me.mood('happy');
  say('DFS 非常多才多藝', '');
}]);

// ═════════════════ 5JxShDZ_ylo：MIT 6.006 Rec13 — graphs, degrees, representations, BFS ═════════════════
// The board graph: A–B, A–C, B–D, B–E, C–D, D–E plus the triangle F–G–H (9 edges, Σdeg = 18).
const GM_R13 = { title: 'Rec13 黑板圖', directed: false, names: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  pos: [[-5.0, -0.6], [-2.4, -2.6], [-2.4, 1.4], [0.2, -0.4], [0.6, -3.3], [3.4, -2.0], [5.6, -2.8], [5.0, 0.4]],
  edges: [[0, 1], [0, 2], [1, 3], [1, 4], [2, 3], [3, 4], [5, 6], [6, 7], [7, 5]] };
const GM_R13A = { ...GM_R13, names: GM_R13.names.slice(0, 5), pos: GM_R13.pos.slice(0, 5), edges: GM_R13.edges.slice(0, 6) };
const GM_R13D = { title: 'Rec13 有向圖', directed: true, names: ['A', 'B', 'C', 'D', 'E', 'F'],
  pos: [[-5.0, -0.6], [-2.4, -2.6], [-2.4, 1.4], [0.2, -0.4], [2.8, -2.4], [2.8, 1.6]],
  edges: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5]] };
// hide / show vertices (a vertex that "appears later")
function gmHide(A, names) { for (const n of names) { const m = A.g.nodes[A.I(n)].mesh; m.scale.setScalar(0.001); m.children[0].element.style.visibility = 'hidden'; } }
async function gmShow(tok, A, names, ms = 500) {
  const ms2 = names.map((n) => A.g.nodes[A.I(n)].mesh);
  ms2.forEach((m) => { m.children[0].element.style.visibility = ''; });
  await kan(tok, ms, (u) => ms2.forEach((m) => m.scale.setScalar(Math.max(0.001, u))));
}

// 18:10 圖、connected component、degree
FRAG.push(['graphmit-r13-graph', '圖、connected component 與 handshaking lemma', async (tok) => {
  gmFresh();
  await step(tok);                                   // 1090.3 what's a graph? vertices and edges
  const me = gmHost(-6.2, 3.8);
  T('Graph = vertices（頂點）+ edges（邊）', 'say', 0, -4.2);
  say('什麼是 graph？vertices 和 edges', '');
  await step(tok);                                   // 1101.0 draw vertices: circles
  const A = gmG({ ...GM_R13, edges: [] });
  gmHide(A, ['F', 'G', 'H']);
  say('頂點畫成圓圈', '');
  await step(tok);                                   // 1104.7 edges: lines (or arrows)
  for (const [u, v] of GM_R13A.edges) { addEdge(A.g, u, v); await kan(tok, 150, () => {}); }
  computeAdj(A.g);
  say('邊畫成線（有時候是箭頭）', '');
  await step(tok);                                   // 1116.5 line vs arrow: directed
  T('線 = undirected（無向）　箭頭 = directed（有向）', 'note', 0, 3.9);
  say('什麼時候畫箭頭？有方向的邊', '箭頭 = directed、線 = undirected');
  await step(tok);                                   // 1149.0 is this graph connected?
  me.mood('wow');
  say('這張圖是 connected 的嗎？', '');
  await step(tok);                                   // 1158.9 path from any node to any other
  for (const [u, v] of [['E', 'B'], ['B', 'A'], ['A', 'C']]) { A.ec(u, v, GM.hot, 2); await gmHop(tok, A, u, v, 380); }
  say('connected：任兩點之間都有路徑', '例如 E → B → A → C');
  await step(tok);                                   // 1193.5 just add a node
  for (const [u, v] of [['E', 'B'], ['B', 'A'], ['A', 'C']]) A.ec(u, v, C.edge, 1);
  await gmShow(tok, A, ['F', 'G', 'H']);
  for (const [u, v] of GM_R13.edges.slice(6)) addEdge(A.g, u, v);
  computeAdj(A.g);
  me.mood('happy');
  say('最省力讓它不連通：多加一塊', '老師的黑板上另一塊是 F、G、H');
  await step(tok);                                   // 1201.9 how many connected components? two
  ['A', 'B', 'C', 'D', 'E'].forEach((v) => A.col(v, SCC_COL[0]));
  ['F', 'G', 'H'].forEach((v) => A.col(v, SCC_COL[1]));
  say('現在有幾個 connected components？2 個', '');
  await step(tok);                                   // 1235.4 definition: reach all others, maximal
  T('component：互相走得到、而且不能再擴大（maximal）', 'say', 0, -4.2, 0.9);
  say('component：彼此走得到的頂點集合，取最大的', '');
  await step(tok);                                   // 1266.3 world: bike between cities
  const bk = T('🚲 城市 = 頂點、騎腳踏車的路 = 邊', 'note', 0, 4.6);
  say('全世界的城市，只能騎腳踏車：幾個 components？', '');
  await step(tok);                                   // 1361.0 between 7 and the number of islands
  setT(bk, '大陸（約 7）＋ 無數小島 = components');
  me.mood('happy');
  say('答案介於 7 和「小島的數量」之間', '');
  await step(tok);                                   // 1377.7 degree of A? 2
  remove(bk);
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach((v) => A.col(v, C.white));
  A.top('A', 'deg 2');
  say('degree：一個頂點連了幾條邊', 'deg(A) = 2');
  await step(tok);                                   // 1383.9 degree of D?
  A.top('D', 'deg 3');
  say('deg(D) = 3', '');
  await step(tok);                                   // 1388.5 F G H 2 2 2, C 2, B, E
  for (const [v, d] of [['F', 2], ['G', 2], ['H', 2], ['C', 2], ['B', 3], ['E', 2]]) { A.top(v, 'deg ' + d); await kan(tok, 120, () => {}); }
  say('F、G、H 都是 2，C 是 2，B 是 3，E 是 2', '');
  await step(tok);                                   // 1416.0 add them up: 18
  const sum = T('Σ deg = 2+3+2+3+2+2+2+2 = 18', 'ptr alt', 0, 4.1);
  say('全部 degree 加起來：18', '');
  await step(tok);                                   // 1440.5 how many edges? 9
  let k = 0;
  for (const e of A.g.edges) { k++; edgeColor(e, GM.hot, 2); await kan(tok, 140, () => {}); }
  T('E = 9 條邊', 'ptr', 4.2, 3.3);
  say('數一數邊：1, 2, …, 9', '');
  await step(tok);                                   // 1453.9 handshaking lemma
  A.g.edges.forEach((e) => edgeColor(e, C.edge, 1));
  setT(sum, 'Σ deg = 18 = 2 × 9 = 2|E|');
  me.mood('wow');
  say('這就是 handshaking lemma：Σ deg = 2|E|', '');
  await step(tok);                                   // 1461.2 each edge adds 1 to two degrees (C–D)
  A.ec('C', 'D', GM.hot, 2.4);
  const mid = A.H('C').clone().lerp(A.H('D'), 0.5);
  for (const v of ['C', 'D']) { const h = T('+1', 'pkt', mid.x, mid.z, 0.9); await travel(tok, h, V(mid.x, 0.9, mid.z), V(A.H(v).x, 0.9, A.H(v).z), 450); remove(h); }
  say('每條邊給兩個端點的 degree 各加 1', '例如 C–D：C +1、D +1');
  await step(tok);                                   // 1485.0 each edge contributes to two → 2E
  A.ec('C', 'D', C.edge, 1);
  T('每條邊被數兩次 → 總和 = 2|E|', 'note', 0, 4.7);
  me.mood('happy');
  say('每條邊貢獻 2：加總一定是 2 × 邊數', '');
}]);

// 24:58 有向圖：in-degree 與 out-degree
FRAG.push(['graphmit-r13-directed', '有向圖：in-degree 與 out-degree', async (tok) => {
  gmFresh();
  await step(tok);                                   // 1498.4 directed graphs: draw this
  const A = gmG(GM_R13D);
  const me = gmHost(-6.2, 3.8);
  say('如果是有向圖呢？', '');
  await step(tok);                                   // 1532.0 A doesn't have a degree
  A.col('A', GM.hot, 0.3);
  const q = T('deg(A) = ？', 'note', A.H('A').x, A.H('A').z - 1.0, 1.0);
  me.mood('wow');
  say('A 的 degree 是多少？陷阱題：沒有 degree', '');
  await step(tok);                                   // 1534.6 in-degree and out-degree
  setT(q, '有向圖：out-degree 與 in-degree');
  say('有向圖只有 out-degree 和 in-degree', 'out = 出去的邊，in = 進來的邊');
  await step(tok);                                   // 1543.6 out-degree of A: 2
  for (const v of ['B', 'C']) { A.ec('A', v, GM.hot, 2); await gmHop(tok, A, 'A', v, 380); }
  A.top('A', 'out 2');
  say('A 的 out-degree = 2', '');
  await step(tok);                                   // 1564.1 A: two out, zero in
  A.top('A', 'out 2・in 0');
  say('A 有 2 條出去、0 條進來', 'in-degree(A) = 0');
  await step(tok);                                   // 1569.1 D: in-degree 2
  A.col('A', C.white); for (const v of ['B', 'C']) A.ec('A', v, C.edge, 1);
  A.col('D', GM.hot, 0.3);
  for (const v of ['B', 'C']) { A.ec(v, 'D', GM.hot, 2); await gmHop(tok, A, v, 'D', 380); }
  A.top('D', 'out 2・in 2');
  say('D：in-degree = 2', '');
  await step(tok);                                   // 1583.3 handshaking lemma for directed?
  A.col('D', C.white); for (const v of ['B', 'C']) A.ec(v, 'D', C.edge, 1);
  const s = T('有向版的 handshaking lemma？', 'say', 0, -4.2);
  say('有向圖的 handshaking lemma 是什麼？', '');
  await step(tok);                                   // 1611.9 sum of in-degrees, sum of out-degrees
  const io = { A: [2, 0], B: [1, 1], C: [1, 1], D: [2, 2], E: [0, 1], F: [0, 1] };
  for (const v in io) A.top(v, 'out ' + io[v][0] + '・in ' + io[v][1]);
  setT(s, 'Σ out = 6　Σ in = 6　合起來 = 2|E|');
  say('把 out 加總、把 in 加總', '兩個加起來是 2|E|，但還有更好的');
  await step(tok);                                   // 1653.6 each edge: 1 to b's out, 1 to d's in
  A.ec('B', 'D', GM.hot, 2.4);
  const hb = T('out +1', 'pkt', A.H('B').x, A.H('B').z, 1.1), hd = T('in +1', 'pkt', A.H('D').x, A.H('D').z, 1.1);
  await gmHop(tok, A, 'B', 'D', 600);
  say('每條邊 B → D：B 的 out +1、D 的 in +1', '');
  await step(tok);                                   // 1668.0 Σ out = Σ in = E
  remove(hb); remove(hd); A.ec('B', 'D', C.edge, 1);
  setT(s, 'Σ out-degree = Σ in-degree = |E| = 6');
  me.mood('happy');
  say('所以 Σ out = Σ in = |E|', '');
  await step(tok);                                   // 1688.5 intuition: black hole
  T('如果 Σ out 比較大 → 某處像黑洞，進去出不來', 'note', 0, 4.4);
  say('直覺：每條出去的邊都會進到某個點', '');
}]);

// 28:24 表示法：adjacency list vs adjacency matrix
FRAG.push(['graphmit-r13-repr', 'Adjacency list（dict）vs adjacency matrix', async (tok) => {
  gmFresh(GM_CAM, [0.4, 0, -0.3]);
  await step(tok);                                   // 1704.8 how do we represent graphs?
  const A = gmG(GM_R13A, { scale: 0.62, dx: -3.6, dz: -0.8 });
  const me = gmHost(-6.3, 3.9);
  say('在 Python 裡要怎麼存一張圖？', '');
  const row = (u) => -3.4 + A.I(u) * 1.0;
  const lists = {};
  await step(tok);                                   // 1775.2 dictionary: vertex → list
  for (const u of ['A', 'B', 'C', 'D', 'E']) { K.cube(u, '#d9cfbd', [0.8, 0.45, 0.7], 0.4, 0.23, row(u), 1.2); lists[u] = []; }
  T('dict', 'idx', 0.4, -4.2);
  say('用 dictionary：每個頂點對應一串鄰居', '');
  const fillL = async (u) => { const ns = adjOf(A.I(u)).map((p) => nm(p.to)); ns.forEach((n, j) => lists[u].push(K.cube(n, C.q, [0.7, 0.4, 0.6], 1.4 + j * 0.85, 0.2, row(u), 2.0))); await kan(tok, 300, () => {}); return ns; };
  await step(tok);                                   // 1792.5 list for A
  await fillL('A');
  say('A 的串列：[B, C]', '');
  await step(tok);                                   // 1800.3 list for B
  await fillL('B');
  say('B 的串列：[A, D, E]', '');
  await step(tok);                                   // 1819.5 in Python: a dictionary
  for (const u of ['C', 'D', 'E']) await fillL(u);
  say('其他也一樣；Python 裡就是一個 dict', '');
  await step(tok);                                   // 1845.8 V slots (if an array)
  const sp = T('串列頭：V 格 → O(V)', 'ptr alt', 0.4, 2.4);
  say('如果用陣列：每個頂點一格，O(V)', '');
  await step(tok);                                   // 1851.4 Python dicts grow as needed
  setT(sp, 'dict 只存有邊的頂點 → 沒有邊時 O(1)');
  say('Python 的 dict 用多少長多少', '一條邊都沒有時只要 O(1)');
  await step(tok);                                   // 1868.0 don't store empty lists (stray node)
  const ghost = K.cube('F', '#ece4d4', [0.8, 0.45, 0.7], 0.4, 0.23, 1.6, 1.2);
  T('[ ]？', 'note', 1.6, 1.6, 0.6);
  say('孤立的頂點：存不存空串列？', '存空串列就要付 O(V)；不存就不用');
  await step(tok);                                   // 1932.1 total size of the lists?
  kill(ghost);
  Object.values(lists).flat().forEach((m) => m.material.color.set(GM.hot));
  say('那串列裡的東西，總共有多少個？', '');
  await step(tok);                                   // 1971.2 A lists its neighbours = degree of A
  const dg = {};
  for (const u of ['A', 'B', 'C', 'D', 'E']) dg[u] = T('= deg ' + lists[u].length, 'idx', 1.4 + lists[u].length * 0.85, row(u));
  say('A 的串列長度 = deg(A)，B 的 = deg(B) …', '');
  await step(tok);                                   // 1997.2 sum of degrees = 2e
  setT(sp, '串列總長 = Σ deg = 2E = 12');
  say('加總 = Σ deg = 2E（handshaking lemma）', '');
  await step(tok);                                   // 2016.5 total: V + E
  setT(sp, '總空間 O(V + E)');
  Object.values(lists).flat().forEach((m) => m.material.color.set(C.q));
  me.mood('happy');
  say('adjacency list 總共：O(V + E)', '');
  await step(tok);                                   // 2018.3 another: a matrix
  gmFresh(GM_CAM, [0.4, 0, -0.3]);
  gmG(GM_R13A, { scale: 0.62, dx: -3.6, dz: -0.8, noDrop: true });
  const me2 = gmHost(-6.3, 3.9);
  const mx = (j) => 0.9 + j * 0.95, mz = (i) => -2.8 + i * 0.95;
  const L = 'ABCDE';
  for (let i = 0; i < 5; i++) { T(L[i], 'idx', 0.1, mz(i)); T(L[i], 'idx', mx(i), -3.7); }
  const cells = [];
  for (let i = 0; i < 5; i++) { cells.push([]); for (let j = 0; j < 5; j++) { const m = lab.box('#efe6d2', [0.82, 0.12, 0.82]); m.position.set(mx(j), 0.06, mz(i)); m.userData.l = lab.label('', 'idx'); m.add(m.userData.l); lab.world.add(m); cells[i].push(m); } }
  const one = (i, j, c = '#4b9ee2') => { const m = cells[i][j]; m.material.color.set(c); m.scale.y = 3; m.position.y = 0.18; m.userData.l.element.textContent = '1'; };
  say('換一種：用矩陣，上面和左邊都是 A～E', '');
  await step(tok);                                   // 2075.3 adjacency matrix
  T('adjacency matrix', 'say', 2.8, -4.4);
  say('它叫 adjacency matrix（相鄰矩陣）', '');
  await step(tok);                                   // 2088.4 (B, A): adjacent ⇔ edge
  one(1, 0); one(0, 1);
  say('B 列、A 欄：B 和 A 之間有邊就填 1', '無向圖會對稱：(A, B) 也是 1');
  await step(tok);                                   // 2108.3 A and A? usually 1
  for (let i = 0; i < 5; i++) one(i, i, '#a9c9ea');
  say('A 和 A 呢？老師習慣填 1（也可以填 0）', '看演算法哪個方便');
  await step(tok);                                   // 2138.1 dictate the rest
  for (const [u, v] of GM_R13A.edges) { one(u, v); one(v, u); await kan(tok, 150, () => {}); }
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if (!cells[i][j].userData.l.element.textContent) cells[i][j].userData.l.element.textContent = '0';
  say('其餘照邊填：有邊 1、沒邊 0', '');
  await step(tok);                                   // 2221.5 each edge gives two 1s
  const ct = T('6 條邊 × 2 = 12 個 1（＋對角線 5 個）', 'ptr alt', 3.0, 2.2);
  say('幾個 1？每條邊貢獻兩個 1', '');
  await step(tok);                                   // 2254.4 V columns, V rows: V² elements
  setT(ct, '總格數 = V × V = 25');
  say('總共幾格？V 列 × V 欄 = V²', '');
  await step(tok);                                   // 2292.8 V² bits vs V + E words
  T('matrix：V² 個 bit　list：V + E 個 word', 'note', 3.0, 3.0);
  say('matrix 每格只要 1 bit：V² bits', 'list 要存指標：V + E 個 word');
  await step(tok);                                   // 2308.3 dense graph → matrix
  me2.mood('happy');
  say('圖很稠密（邊很多）時，matrix 可能更省', '');
}]);

// 38:44 BFS from A
FRAG.push(['graphmit-r13-bfs', 'BFS from A：queue 與「看過了」', async (tok) => {
  gmFresh();
  await step(tok);                                   // 2324.0 who remembers BFS?
  const A = gmG(GM_R13);
  const me = gmHost(-6.3, 3.9);
  say('BFS：從一個點出發，先看所有鄰居，再看鄰居的鄰居', '');
  const qs = makeStrip(-3.6, 3.7, 'list', 1.0);
  const Q = [];
  const qset = () => qs.set(Q.map((v) => ({ key: 'q' + v, text: v })));
  const seen = (v) => { A.top(v, '☺'); A.col(v, GM.on, 0.2); };
  await step(tok);                                   // 2363.0 BFS starting at A
  A.col('A', GM.src, 0.3); A.note('A', '起點');
  say('從 A 開始做 BFS', '');
  await step(tok);                                   // 2369.1 list initialised with A
  Q.push('A'); qset(); seen('A');
  say('待拜訪的 list 一開始只有 A', 'A 是唯一知道的頂點');
  await step(tok);                                   // 2390.4 take out first: current node A
  Q.shift(); qset(); A.col('A', GM.hot, 0.5);
  say('從 list 前面取出 A：目前的頂點', '');
  await step(tok);                                   // 2395.8 visit B and C (neighbours)
  for (const v of ['B', 'C']) { A.ec('A', v, C.tree, 2.2); await gmHop(tok, A, 'A', v, 380); Q.push(v); qset(); }
  say('看 A 的鄰居 B、C，放進 list', '');
  await step(tok);                                   // 2417.6 discovered: know of their existence
  seen('B'); seen('C'); A.col('A', GM.done);
  say('B、C 是「發現」了（笑臉）', '等一下才真正拜訪它們');
  await step(tok);                                   // 2428.9 B gets out
  Q.shift(); qset(); A.col('B', GM.hot, 0.5);
  say('取出 B，看它的鄰居 A、D、E', '');
  await step(tok);                                   // 2445.8 A visited, D E not
  const x = await gmBlock(tok, A, null, 'B', 'A', 'A 已有笑臉');
  for (const v of ['D', 'E']) { A.ec('B', v, C.tree, 2.2); await gmHop(tok, A, 'B', v, 350); Q.push(v); qset(); seen(v); }
  A.col('B', GM.done);
  say('A 已經看過；D、E 是新的 → 放進 list', '');
  await step(tok);                                   // 2462.1 C: nothing new; then D, E
  kill(x);
  Q.shift(); qset(); A.col('C', GM.hot, 0.5); await kan(tok, 500, () => {}); A.col('C', GM.done);
  Q.shift(); qset(); A.col('D', GM.done); Q.shift(); qset(); A.col('E', GM.done);
  say('C 沒有新鄰居；再取出 D、E', 'list 空了');
  await step(tok);                                   // 2471.8 A is the source
  A.col('A', GM.src, 0.3);
  say('BFS 一定有起點（source）：這裡是 A', '');
  await step(tok);                                   // 2494.9 do I ever see F? no
  for (const v of ['F', 'G', 'H']) { A.col(v, '#e3dccd', 0); A.top(v, '沒看到', 'ptr alt'); }
  me.mood('wow');
  say('會看到 F 嗎？不會', '');
  await step(tok);                                   // 2506.7 A's connected component
  T('BFS 只拜訪起點所在的 connected component', 'note', -1.6, -4.3);
  say('拜訪到的是 A 所在的 connected component', '圖不連通時，BFS 不會走完整張圖');
  await step(tok);                                   // 2532.0 how keep track: data structure?
  say('要用什麼資料結構記錄？', '');
  await step(tok);                                   // 2550.9 a queue for the list
  T('queue（先進先出）', 'ptr alt', -1.4, 3.1);
  say('待拜訪的 list：用 queue', '');
  await step(tok);                                   // 2575.1 smileys: check fast → hash table, dict
  const d = gmDict(3.8, 1.8, 'seen（dict / set）', 0.45);
  for (const v of ['A', 'B', 'C', 'D', 'E']) d.set(v, 'True');
  me.mood('happy');
  say('笑臉要能很快查：用 hash table', 'Python：dict（或 set），O(1) 查詢');
}]);

// 43:40 BFS 的時間：matrix O(V²)、list O(V + E)
FRAG.push(['graphmit-r13-runtime', 'BFS 的時間：matrix O(V²) vs list O(V + E)', async (tok) => {
  gmFresh(GM_CAM, [0.4, 0, -0.3]);
  await step(tok);                                   // 2620.1 running time of BFS?
  const A = gmG(GM_R13, { scale: 0.5, dx: -3.6, dz: -1.6 });
  const me = gmHost(-6.3, 3.9);
  T('Matrix：列鄰居要掃整列', 'ptr', 1.6, -4.2);
  T('List：只看自己的串列', 'ptr', 1.6, 0.9);
  const mat = [];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { const m = lab.box('#efe6d2', [0.5, 0.1, 0.5]); m.position.set(0.2 + j * 0.58, 0.05, -3.4 + i * 0.58); lab.world.add(m); mat.push(m); }
  const lst = [];
  const NB = { A: ['B', 'C'], B: ['A', 'D', 'E'], C: ['A', 'D'], D: ['B', 'C', 'E'], E: ['B', 'D'] };
  ['A', 'B', 'C', 'D', 'E'].forEach((u, r) => { T(u, 'idx', -0.5, 1.6 + r * 0.55); NB[u].forEach((n, j) => { const m = lab.box(C.q, [0.5, 0.3, 0.45]); m.add(lab.label(n, 'val')); m.position.set(0.2 + j * 0.62, 0.15, 1.6 + r * 0.55); lab.world.add(m); lst.push([u, m]); }); });
  const cm = T('掃了 0 格', 'ptr alt', 5.0, -3.4), cl = T('掃了 0 個', 'ptr alt', 5.0, 1.6);
  say('queue 進出都是 O(1)：BFS 要花多少時間？', '');
  await step(tok);                                   // 2632.9 assume connected (drop F G H)
  for (const v of ['F', 'G', 'H']) A.col(v, '#e3dccd');
  say('先假設圖是連通的：不管 F、G、H', '');
  await step(tok);                                   // 2649.3 visit every node once: at least V
  const vt = T('拜訪 5 個頂點 → 至少 V', 'note', 5.0, -1.2);
  for (const v of ['A', 'B', 'C', 'D', 'E']) { A.col(v, GM.on, 0.2); await kan(tok, 120, () => {}); }
  say('每個頂點拜訪一次：至少 V', '');
  await step(tok);                                   // 2657.6 visiting: list its neighbours
  say('拜訪一個頂點時要做什麼？列出它的鄰居', '');
  await step(tok);                                   // 2674.2 list: order of the degree
  lst.filter(([u]) => u === 'C').forEach(([, m]) => m.material.color.set(GM.hot));
  say('用 adjacency list：O(degree)', '例如 C 只看 2 個');
  await step(tok);                                   // 2690.8 matrix: the whole row, order V
  for (let j = 0; j < 5; j++) mat[2 * 5 + j].material.color.set(GM.hot);
  say('用 matrix：整列 V 格都要看', 'C 只有 2 條邊，還是要掃 5 格');
  await step(tok);                                   // 2715.0 matrix total: V²
  let a = 0;
  for (let u = 0; u < 5; u++) { for (let j = 0; j < 5; j++) { mat[u * 5 + j].material.color.set(GM.hot); a++; } setT(cm, '掃了 ' + a + ' 格'); await kan(tok, 200, () => {}); }
  say('matrix：每個頂點 O(V) → 總共 O(V²)', '');
  await step(tok);                                   // 2756.2 lists? amortized analysis
  say('用 list 呢？要用 amortized analysis', '不能每個頂點各自估');
  await step(tok);                                   // 2775.5 per node: neighbours, seen check O(1), enqueue O(1)
  say('每個頂點：看鄰居、查 seen O(1)、進 queue O(1)', '所以每個頂點的工作 = O(deg)');
  await step(tok);                                   // 2821.8 total = Σ deg = 2e
  let b = 0;
  for (const u of ['A', 'B', 'C', 'D', 'E']) { lst.filter(([x]) => x === u).forEach(([, m]) => { m.material.color.set(GM.hot); b++; }); setT(cl, '掃了 ' + b + ' 個'); await kan(tok, 200, () => {}); }
  say('整張圖加總：Σ deg = 2E = 12', 'handshaking lemma');
  await step(tok);                                   // 2846.6 total V + E
  setT(vt, 'list：O(V + E)　matrix：O(V²)');
  me.mood('happy');
  say('list 版 BFS：O(V + E)', '');
  await step(tok);                                   // 2906.2 O(E)? depends on implementation
  T('CLRS 用陣列初始化 → V + E；Python dict 只碰走到的點 → 可到 O(E)', 'note', 0.6, 4.6);
  say('能不能說 O(E)？看實作', 'CLRS 的陣列是 V + E；Python dict 可做到 O(E)');
}]);

// 49:04 BFS 給出最短路徑
FRAG.push(['graphmit-r13-dist', 'BFS 算出最短距離（邊數）', async (tok) => {
  gmFresh();
  await step(tok);                                   // 2944.8 what's the point of BFS?
  const A = gmG(GM_R13);
  const me = gmHost(-6.3, 3.9);
  say('BFS 到底給我們什麼？', '');
  await step(tok);                                   // 2958.0 shortest path from the start node
  A.col('A', GM.src, 0.3); A.note('A', '起點');
  say('從起點出發的最短路徑', '只限從這個起點');
  await step(tok);                                   // 2972.0 from A to all reachable nodes
  for (const v of ['B', 'C', 'D', 'E']) A.col(v, '#f6e7c3');
  say('A 到「每一個走得到的點」的最短長度', '');
  await step(tok);                                   // 2994.0 distance A to A: 0
  A.top('A', 'd = 0');
  say('怎麼算？A 到 A：0', '');
  await step(tok);                                   // 3000.7 neighbours B, C: 1
  for (const v of ['B', 'C']) { A.ec('A', v, C.tree, 2.2); await gmHop(tok, A, 'A', v, 350); A.top(v, 'd = 1'); }
  say('A 的鄰居 B、C：距離 1', '');
  await step(tok);                                   // 3011.8 look at B: neighbours A, D, E
  A.col('B', GM.hot, 0.4);
  for (const v of ['A', 'D', 'E']) A.ec('B', v, GM.hot, 1.6);
  say('看 B：鄰居 A、D、E', '');
  await step(tok);                                   // 3039.9 A is 0; D, E are 2
  for (const v of ['D', 'E']) { A.ec('B', v, C.tree, 2.2); A.top(v, 'd = 2'); }
  A.ec('B', 'A', C.tree, 2.2); A.col('B', '#f6e7c3');
  say('A 還是 0；D、E 是 2', '');
  await step(tok);                                   // 3052.9 rule: no smiley → distance + 1
  T('規則：沒笑臉的鄰居 → d = 目前的 d + 1', 'note', 0, -4.2);
  say('發現鄰居時：還沒看過的才設成 d + 1', '');
  await step(tok);                                   // 3072.6 don't update smileys: else A would be 2
  const bad = T('d(A) = 2 ？✗', 'note', A.H('A').x, A.H('A').z - 1.0, 1.2);
  A.col('A', C.back, 0.3);
  me.mood('sad');
  say('已經有笑臉的不能改，不然 A 會變成 2', '');
  await step(tok);                                   // 3111.0 smileys = already seen: don't update
  remove(bad); A.col('A', GM.src, 0.3); me.mood('happy');
  say('笑臉 = 已經算過距離，不要再更新', '這就是 BFS 的精髓');
}]);

// 52:03 應用：社群網路——好友（無向）、追蹤／訂閱（有向）、BFS 找「朋友的朋友的朋友」
const GM_FB = { title: '好友關係', directed: false, names: ['我', '小明', '小華', '阿美', '大雄', '靜香'],
  pos: [[-5.0, 0.0], [-2.5, -2.2], [-2.5, 2.0], [0.3, 0.2], [3.0, -1.8], [5.2, 0.8]],
  edges: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [4, 5]] };
const GM_TW = { ...GM_FB, title: '追蹤關係', directed: true,
  edges: [[0, 1], [1, 0], [2, 0], [3, 2], [4, 3], [0, 4], [5, 4]] };
FRAG.push(['graphmit-r13-social', '社群網路：好友是無向圖、追蹤是有向圖、BFS 找人脈', async (tok) => {
  gmFresh();
  let A = null;
  await step(tok);                                   // 3126.3 Facebook vs Twitter: which is directed?
  A = gmG(GM_FB);
  T('人 = 頂點', 'say', 0, -4.2);
  say('Facebook 和 Twitter：哪個是有向圖？', '');
  await step(tok);                                   // 3134.9 Facebook friendship: undirected
  A.ec('我', '小明', GM.hot, 2);
  A.top('我', '好友'); A.top('小明', '好友');
  T('Facebook 好友：你是我的朋友 ⇔ 我是你的朋友 → 無向（線）', 'note', 0, 3.9);
  say('Facebook 好友是雙向的', '→ undirected graph');
  await step(tok);                                   // 3162.7 Twitter: directed because of follows
  gmFresh();
  A = gmG(GM_TW, { noDrop: true });
  A.ec('小華', '我', GM.hot, 2);
  T('Twitter 追蹤：小華追蹤我，我不一定追蹤小華 → 有向（箭頭）', 'note', 0, 3.9);
  say('Twitter 的 follow 是單向的', '→ directed graph');
  await step(tok);                                   // 3210.3 Facebook has two graphs on the same vertices
  gmFresh();
  gmG(GM_FB, { noDrop: true, scale: 0.55, dx: -3.4, ns: 0.8 });
  A = gmG(GM_TW, { noDrop: true, scale: 0.55, dx: 3.4, ns: 0.8 });
  T('好友 → 無向圖', 'say', -3.4, -2.6);
  T('訂閱（subscribe）→ 有向圖', 'say', 3.4, -2.6);
  T('頂點一樣（都是人），邊完全不同 → 是兩張圖', 'note', 0, 2.8);
  say('Facebook 裡其實有兩張圖', '同一群頂點，好友是無向、訂閱是有向');
  await step(tok);                                   // 3237.0 BFS on Facebook: 1st degree, 2nd degree …
  gmFresh();
  A = gmG(GM_FB, { noDrop: true });
  const LV = { 我: 0, 小明: 1, 小華: 1, 阿美: 2, 大雄: 3, 靜香: 4 };
  const LC = ['#4b9ee2', '#2fc092', '#e8b02a', '#e55a9b', '#9b7ef4'];
  for (let d = 0; d <= 4; d++) {
    for (const v in LV) if (LV[v] === d) { A.col(v, LC[d], 0.2); A.top(v, d === 0 ? '起點' : d + ' 度'); }
    await kan(tok, 380, () => {});
  }
  say('從自己跑 BFS：一層一層往外', '1 度 = 朋友、2 度 = 朋友的朋友 …');
  await step(tok);                                   // 3257.4 reach someone you don't know with minimum effort
  for (const [u, v] of [['我', '小明'], ['小明', '阿美'], ['阿美', '大雄']]) { A.ec(u, v, C.tree, 2.4); await gmHop(tok, A, u, v, 380); }
  T('想聯絡大雄：他是「朋友的朋友的朋友」→ 最少 3 步', 'note', 0, 3.9);
  say('BFS 給的就是最短的人脈鏈', '我 → 小明 → 阿美 → 大雄');
}]);

// ═════════════════ AfSk24UTFS8：MIT 6.006 L14 — DFS, edge classification, cycles, topological sort ═════════════════
const GM_L13G = { title: 'L13 例子', directed: false, names: ['s', 'a', 'x', 'z', 'd', 'c', 'f', 'v'],
  pos: [[-1.5, -1.6], [-4.5, -1.6], [-1.5, 1.6], [-4.5, 1.6], [1.5, -1.6], [1.5, 1.6], [4.5, -1.6], [4.5, 1.6]],
  edges: [[0, 1], [1, 3], [0, 2], [2, 4], [2, 5], [4, 5], [4, 6], [5, 6], [5, 7], [6, 7]],
  adj: { 0: [1, 2], 1: [0, 3], 2: [0, 4, 5], 3: [1], 4: [2, 5, 6], 5: [2, 4, 6, 7], 6: [4, 5, 7], 7: [5, 6] } };
const GM_LV = { s: 0, a: 1, x: 1, z: 2, d: 2, c: 2, f: 3, v: 3 };
const GM_LVC = ['#4b9ee2', '#2fc092', '#e8b02a', '#e55a9b'];
const GM_MAZE = { title: '迷宮', directed: false, names: ['入口', 'J1', '死路', 'J2', '死路 ', 'J3', '出口'],
  pos: [[-5.4, 0.6], [-2.8, 0.6], [-2.8, -2.4], [0, 0.6], [0, 3.2], [2.8, 0.6], [5.4, 0.6]],
  edges: [[0, 1], [1, 2], [1, 3], [3, 4], [3, 5], [5, 6]] };
// 0:22 DFS 像走迷宮
FRAG.push(['graphmit-l14-intro', 'DFS 像走迷宮：遞迴探索、必要時回頭', async (tok) => {
  gmFresh();
  await step(tok);                                   // 22.3 last time BFS, today DFS
  const me = gmHost(-6.2, 3.9);
  T('上次：BFS（breadth-first）', 'say', -2.6, -4.3);
  T('今天：DFS（depth-first）', 'say', 2.6, -4.3);
  say('上次 BFS，今天 depth-first search', '');
  await step(tok);                                   // 36.0 cycles and topological sort
  T('判斷有沒有 cycle', 'note', -2.6, 4.2); T('topological sort', 'note', 2.6, 4.2);
  me.mood('happy');
  say('用 DFS 判斷 cycle、做 topological sort', '');
  await step(tok);                                   // 42.6 input: adjacency lists
  const A = gmG(GM_L13G);
  const al = T('Adj[x] = [s, d, c]：一步走得到的頂點', 'ptr alt', 0, -3.2);
  A.col('x', GM.hot, 0.3);
  for (const v of ['s', 'd', 'c']) A.ec('x', v, GM.hot, 1.8);
  say('輸入：adjacency list', '每個頂點一串「一步走得到」的鄰居');
  await step(tok);                                   // 64.2 explore: visit every vertex once
  remove(al); A.col('x', C.white); for (const v of ['s', 'd', 'c']) A.ec('x', v, C.edge, 1);
  say('目標：探索整張圖，每個頂點恰好拜訪一次', '');
  await step(tok);                                   // 77.4 BFS layer by layer, shortest paths from s
  for (const v of A.g.G.names) { A.col(v, GM_LVC[GM_LV[v]], 0.1); A.top(v, 'L' + GM_LV[v]); await kan(tok, 100, () => {}); }
  say('BFS 一層一層走：給出從 s 出發的最短路徑', '');
  await step(tok);                                   // 88.3 unreachable: infinity
  T('走不到 → 距離 ∞（BFS 也能偵測）', 'note', 0, -3.2);
  say('從 s 走不到的點：最短距離是 ∞', '');
  await step(tok);                                   // 106.3 DFS: explore the whole graph
  say('DFS 也能做到，但更常用來探索整張圖', '不只從 s 走得到的部分');
  await step(tok);                                   // 141.0 DFS ≈ solving a maze
  gmFresh();
  const M = gmG(GM_MAZE);
  const w = gmWalker(M, '入口', '#f4a56a');
  T('🌽 玉米迷宮', 'say', 0, -4.2);
  say('DFS 像在走迷宮', '每到一個路口，就要選下一條路');
  await step(tok);                                   // 172.0 leave breadcrumbs
  const crumb = (n) => { const p = M.H(n); K.cube('', '#e8b02a', [0.22, 0.12, 0.22], p.x - 0.5, 0.06, p.z + 0.5, 0.8); };
  crumb('入口'); M.ec('入口', 'J1', C.tree, 2.2); await gmGo(tok, M, w, 'J1', 450); crumb('J1');
  M.ec('J1', '死路', C.tree, 2.2); await gmGo(tok, M, w, '死路', 450);
  say('沿路留麵包屑：記住「上次走哪條」', '');
  await step(tok);                                   // 178.0 dead end → turn around, backtrack
  w.mood('sad'); M.col('死路', GM.done);
  await gmGo(tok, M, w, 'J1', 450); w.mood('calm');
  M.ec('J1', 'J2', C.tree, 2.2); await gmGo(tok, M, w, 'J2', 400); crumb('J2');
  say('走到死路就回頭（backtrack），換下一條沒走過的', '');
  await step(tok);                                   // 194.8 easy on a computer: recursion
  M.ec('J2', '死路 ', C.tree, 2.2); await gmGo(tok, M, w, '死路 ', 350); M.col('死路 ', GM.done); await gmGo(tok, M, w, 'J2', 350);
  T('電腦上：用遞迴（recursion）就能做到', 'note', 0, 4.4);
  say('在電腦上用遞迴很容易做到', '');
  await step(tok);                                   // 210.5 recursively explore, backtrack as necessary
  M.ec('J2', 'J3', C.tree, 2.2); await gmGo(tok, M, w, 'J3', 350); M.ec('J3', '出口', C.tree, 2.2); await gmGo(tok, M, w, '出口', 350);
  w.mood('happy');
  say('遞迴探索整張圖，必要時回頭', '');
}]);

// 4:15 DFS-visit 與外層 DFS 的程式碼
FRAG.push(['graphmit-l14-code', 'DFS-visit 與外層 DFS：parent 字典', async (tok) => {
  gmFresh(GM_CAM, [0.6, 0, -0.3]);
  await step(tok);                                   // 255.4 super simple code
  const cv = code(['DFS-visit(V, Adj, s):', '  for v in Adj[s]:', '    if v not in parent:', '      parent[v] = s', '      DFS-visit(V, Adj, v)'], -3.6, -3.8, 0.55);
  const A = gmG(GRAPHS.af, { scale: 0.62, dx: 3.0, dz: -1.4 });
  say('DFS 的程式超簡單：四行', '');
  await step(tok);                                   // 309.4 visits everything reachable from s
  A.col('a', GM.src, 0.3); A.note('a', 's');
  say('DFS-visit：拜訪從 s 走得到的所有頂點', '這裡 s = a');
  await step(tok);                                   // 316.4 given adjacency list (V unnecessary)
  cv.hl(0);
  say('輸入 adjacency list 和起點 s', '參數 V 其實用不到');
  await step(tok);                                   // 323.9 outgoing edges from s, each called v
  cv.hl(1);
  for (const v of ['b', 'd']) A.ec('a', v, GM.hot, 1.8);
  say('看 s 的每一條出邊，另一端叫 v', '');
  await step(tok);                                   // 339.3 have I visited v already?
  cv.hl(2);
  say('檢查：v 拜訪過了嗎？', '不能重複拜訪');
  await step(tok);                                   // 352.5 parent structure; parent[s] = None
  const P = gmDict(-3.0, 0.4, 'parent', 0.48);
  P.set('a', 'None');
  say('用 parent 字典記錄「看過了沒」', '一開始 parent = {s: None}');
  await step(tok);                                   // 374.0 not in dict: parent[v] = s, recurse
  cv.hl(3); A.ec('a', 'd', C.edge, 1); A.ec('a', 'b', C.tree, 2.2);
  await gmHop(tok, A, 'a', 'b', 380); P.set('b', 'a'); A.col('b', GM.on, 0.2);
  cv.hl(4);
  say('v 不在字典裡：parent[v] = s，再遞迴拜訪 v', 'parent[b] = a → DFS-visit(b)');
  await step(tok);                                   // 389.0 magic: never repeat, skip seen
  A.ec('b', 'e', C.tree, 2.2); await gmHop(tok, A, 'b', 'e', 300); P.set('e', 'b'); A.col('e', GM.on, 0.2);
  A.ec('e', 'd', C.tree, 2.2); await gmHop(tok, A, 'e', 'd', 300); P.set('d', 'e'); A.col('d', GM.on, 0.2);
  cv.hl(2);
  const x = await gmBlock(tok, A, null, 'd', 'b', 'b 已在 parent');
  say('看過的直接跳過：不會重複', '');
  await step(tok);                                   // 399.8 at most once; only reachable from s
  kill(x);
  T('c、f 從 a 走不到', 'note', A.H('c').x, A.H('c').z + 0.9, 0.9);
  say('每個頂點最多拜訪一次', '但只會走到從 s 走得到的點');
  await step(tok);                                   // 410.7 visiting all vertices: DFS
  const co = code(['DFS(V, Adj):', '  parent = {}', '  for s in V:', '    if s not in parent:', '      parent[s] = None', '      DFS-visit(V, Adj, s)'], -3.6, 2.6, 0.48);
  cv.hl(-1);
  say('再加外層：拜訪全部頂點', '課本叫它 DFS；上面那段叫 DFS-visit');
  await step(tok);                                   // 428.3 iterate over the s's
  co.hl(2);
  const row = makeStrip(1.2, 3.9, 's =', 0.8);
  row.set(['a', 'b', 'c', 'd', 'e', 'f'].map((v) => ({ key: v, text: v })));
  say('外層：對每個頂點 s', '');
  await step(tok);                                   // 467.9 looks the same, iterating over something else
  cv.hl(1);
  say('長得很像，但迴圈跑的東西不同', '內層跑 s 的出邊，外層跑「起點 s 的選擇」');
  await step(tok);                                   // 480.1 don't know where to start; multiple searches
  cv.hl(-1); co.hl(3);
  say('不知道從哪開始：圖可能不連通', '所以可能要開好幾次搜尋');
  const ptr = T('▼', 'pkt', 1.2, 3.25, 0.6);
  const at = async (i) => { const f = ptr.position.x, t = 1.2 + i * 0.8; await kan(tok, 300, (u) => ptr.position.set(f + (t - f) * u, 0.6, 3.25)); };
  await step(tok);                                   // 499.1 first vertex … skip … next unvisited
  await at(1); await kan(tok, 200, () => {}); await at(2);
  co.hl(4); A.col('c', GM.src, 0.3); A.note('c', 's'); P.set('c', 'None');
  say('a 做完；b 看過了跳過；c 沒看過 → 從 c 開始', '');
  await step(tok);                                   // 525.3 finds all the clusters
  co.hl(5);
  A.ec('c', 'f', C.tree, 2.2); await gmHop(tok, A, 'c', 'f', 350); P.set('f', 'c'); A.col('f', GM.on, 0.2);
  say('這樣能找到所有「群」，每個頂點都會被拜訪', '');
}]);

// 8:59 例子：a～f 的有向圖
FRAG.push(['graphmit-l14-trace', 'a～f 的 DFS：parent 指標與粗線', async (tok) => {
  gmFresh();
  await step(tok);                                   // 539.0 little example
  const me = gmHost(-6.3, 3.9);
  say('來跑一個小例子', '順便看邊的分類');
  await step(tok);                                   // 560.8 here's a graph
  const A = gmG(GRAPHS.af);
  say('一張有向圖：a～f', '');
  await step(tok);                                   // 585.5 not strongly connected; from c everywhere
  A.col('c', GM.hot, 0.3);
  T('從 c 幾乎哪都到得了，但別人到不了 c', 'note', 0, -3.4);
  say('不是 strongly connected：其他點走不到 c', '');
  await step(tok);                                   // 600.0 alphabetical order
  A.col('c', C.white);
  const row = makeStrip(-1.6, 3.9, '外層順序', 0.8);
  row.set(['a', 'b', 'c', 'd', 'e', 'f'].map((v) => ({ key: v, text: v })));
  say('照字母順序跑 DFS', '外層依字母；鄰居照講義（c 先看 f）');
  const P = gmDict(4.6, -3.6, 'parent', 0.45);
  const tree = (u, v) => { A.ec(u, v, C.tree, 2.4); P.set(v, u); A.col(v, C.gray, 0.3); A.note(v, 'π = ' + u); };
  let w = null;
  await step(tok);                                   // 622.7 start with a: s1
  A.col('a', C.gray, 0.3); A.top('a', 's1', 'ptr alt'); P.set('a', 'None'); w = gmWalker(A, 'a');
  say('從 a 開始：s1 = a，parent[a] = None', '');
  await step(tok);                                   // 642.3 first edge: look at b
  A.ec('a', 'b', GM.hot, 1.8);
  say('a 有兩條出邊，先看 a → b', '');
  await step(tok);                                   // 653.6 b not visited: parent pointer a
  tree('a', 'b'); await gmGo(tok, A, w, 'b');
  say('b 還沒拜訪：parent[b] = a', '粗線 = tree edge');
  await step(tok);                                   // 667.2 from b: only edge to e
  A.ec('b', 'e', GM.hot, 1.8);
  say('遞迴拜訪 b：b 只有一條出邊 → e', '');
  await step(tok);                                   // 674.0 e: parent b; e's edge to d
  tree('b', 'e'); await gmGo(tok, A, w, 'e');
  A.ec('e', 'd', GM.hot, 1.8);
  say('parent[e] = b；e 只有一條出邊 → d', '');
  await step(tok);                                   // 686.0 d: parent e; d's edge to b
  tree('e', 'd'); await gmGo(tok, A, w, 'd');
  say('parent[d] = e；d 的出邊指向 b', '');
  await step(tok);                                   // 693.1 b already visited: skip
  const x1 = await gmBlock(tok, A, w, 'd', 'b', 'b 已看過');
  say('b 已經拜訪過 → 跳過（else 什麼都不做）', '');
  await step(tok);                                   // 708.4 d done → back to e; e finishes
  kill(x1);
  A.col('d', C.black); await gmGo(tok, A, w, 'e', 350); A.col('e', C.black);
  say('d 沒有下一條邊：結束，回到 e；e 也結束', '');
  await step(tok);                                   // 719.8 backtrack to b … back to a
  await gmGo(tok, A, w, 'b', 350); A.col('b', C.black); await gmGo(tok, A, w, 'a', 350);
  say('沿 parent 指標回到 b，b 也結束，回到 a', '');
  await step(tok);                                   // 736.1 other edge a → d: visited, skip
  const x2 = await gmBlock(tok, A, w, 'a', 'd', 'd 已看過');
  say('a 的另一條出邊 a → d：d 已拜訪 → 跳過', '');
  const ptr = T('▼', 'pkt', -1.6, 3.25, 0.6);
  const at = async (i) => { const f = ptr.position.x, t = -1.6 + i * 0.8; await kan(tok, 260, (u) => ptr.position.set(f + (t - f) * u, 0.6, 3.25)); };
  await step(tok);                                   // 754.1 outer loop: b visited
  kill(x2); A.col('a', C.black);
  await at(1);
  say('a 做完，回到外層：b 已拜訪', '');
  await step(tok);                                   // 760.0 c not visited: s2
  await at(2);
  A.col('c', C.gray, 0.3); A.top('c', 's2', 'ptr alt'); P.set('c', 'None'); await gmGo(tok, A, w, 'c', 500);
  say('c 還沒拜訪：s2 = c，第二次搜尋', '');
  await step(tok);                                   // 779.0 first go to f
  tree('c', 'f'); await gmGo(tok, A, w, 'f');
  say('先走 c → f：parent[f] = c', '');
  await step(tok);                                   // 805.0 f → f: already visited
  const x3 = T('✗ f 自己已看過', 'note', A.H('f').x + 0.9, A.H('f').z - 0.9, 1.1);
  A.ec('f', 'f', C.back, 1.6);
  say('f 唯一的出邊是 f → f：f 已拜訪', '');
  await step(tok);                                   // 813.5 done with f; c's other edge to e: visited
  kill(x3); A.ec('f', 'f', C.edge, 1); A.col('f', C.black); await gmGo(tok, A, w, 'c', 350);
  const x4 = await gmBlock(tok, A, w, 'c', 'e', 'e 已看過');
  say('回到 c：另一條出邊 c → e，e 早就拜訪過', '');
  await step(tok);                                   // 828.7 outer loop: d, e, f visited
  kill(x4); A.col('c', C.black);
  for (const i of [3, 4, 5]) await at(i);
  say('外層繼續：d、e、f 都拜訪過了', '');
  await step(tok);                                   // 842.4 every vertex (and edge) visited
  w.mood('happy'); me.mood('happy');
  say('全部頂點都拜訪了，每條邊也都看過', '');
}]);

// 14:09 時間 Θ(V + E)
FRAG.push(['graphmit-l14-runtime', 'DFS 為什麼是 Θ(V + E)', async (tok) => {
  gmFresh(GM_CAM, [0.4, 0, -0.3]);
  await step(tok);                                   // 849.2 running time?
  const A = gmG(GRAPHS.af, { scale: 0.62, dx: 3.2, dz: -0.6 });
  const me = gmHost(-6.3, 4.0);
  const rows = {};
  A.g.adj.forEach((l, u) => {
    const z = -3.3 + u * 0.95;
    K.cube(nm(u), '#d9cfbd', [0.8, 0.45, 0.7], -5.8, 0.23, z);
    rows[u] = l.map((p, j) => K.cube(nm(p.to), C.q, [0.7, 0.4, 0.6], -4.8 + j * 0.85, 0.2, z, 1.5));
  });
  T('Adj', 'idx', -5.8, -4.2);
  say('DFS 的執行時間是多少？', '');
  await step(tok);                                   // 888.6 V + E
  const tt = T('Θ(V + E)', 'ptr alt', -3.6, 2.6);
  say('V + E：線性時間，跟 BFS 一樣', '');
  await step(tok);                                   // 910.3 input size: V slots + E items
  T('輸入大小：V 格陣列 + E 個串列元素', 'note', -3.0, 3.4);
  say('「線性」= 跟輸入大小 V + E 成正比', '');
  await step(tok);                                   // 946.5 outer loop: every vertex once → O(V)
  const cnt = T('外層 0 次', 'ptr', 0.6, 2.6);
  for (let i = 0; i < 6; i++) { A.col(nm(i), GM.on, 0.2); setT(cnt, '外層 ' + (i + 1) + ' 次'); await kan(tok, 150, () => {}); }
  say('外層迴圈每個頂點看一次：O(V)', '');
  await step(tok);                                   // 948.4 the recursion: called only without parent
  for (let i = 0; i < 6; i++) A.col(nm(i), C.white);
  say('遞迴呢？呼叫 DFS-visit(v) 之前，v 才剛第一次設 parent', '');
  await step(tok);                                   // 969.8 DFS-visit(v) at most once per v
  setT(cnt, 'DFS-visit：每個頂點最多 1 次');
  for (let i = 0; i < 6; i++) { A.col(nm(i), C.gray, 0.2); await kan(tok, 120, () => {}); }
  say('所以每個頂點最多呼叫一次 DFS-visit', '');
  await step(tok);                                   // 992.6 for loop pays |Adj[v]|
  rows[0].forEach((m) => m.material.color.set(GM.hot));
  say('但每次呼叫不是常數：for 迴圈要付 |Adj[v]|', 'a 要掃 2 條');
  await step(tok);                                   // 1020.4 total: Σ |Adj[v]| = E
  let s = 0;
  for (let u = 0; u < 6; u++) { rows[u].forEach((m) => { m.material.color.set(GM.hot); s++; }); await kan(tok, 150, () => {}); }
  setT(cnt, 'Σ |Adj[v]| = ' + s + ' = E');
  say('全部加起來：Σ |Adj[v]| = E = 8', '');
  await step(tok);                                   // 1041.2 handshaking: 2E undirected, E directed
  T('無向圖 2E、有向圖 E（handshaking lemma）', 'say', 0.6, 3.4);
  say('handshaking lemma：無向 2E、有向 E', '');
  await step(tok);                                   // 1053.8 linear like BFS: who cares?
  me.mood('wow');
  say('跟 BFS 一樣線性，那差在哪？性質不同', '');
  await step(tok);                                   // 1064.5 BFS: shortest paths (Rubik's cube)
  setT(tt, 'BFS：最短路徑　DFS：不保證');
  say('BFS 擅長最短路徑（例如魔術方塊最少步數）', 'DFS 找不到最短的');
  await step(tok);                                   // 1076.0 a to d: path of length 3, direct edge exists
  for (let i = 0; i < 6; i++) A.col(nm(i), C.white);
  for (const [u, v] of [['a', 'b'], ['b', 'e'], ['e', 'd']]) A.ec(u, v, C.tree, 2.4);
  A.ec('a', 'd', GM.vis, 2.4);
  say('a 到 d：DFS 走 a → b → e → d（長度 3）', '其實 a → d 一步就到');
}]);

// 18:13 邊的分類
FRAG.push(['graphmit-l14-classify', '邊的分類：tree / forward / back / cross', async (tok) => {
  gmFresh();
  await step(tok);                                   // 1093.1 edge classification
  const G7 = { ...GRAPHS.af, names: [...GRAPHS.af.names, 'g'], pos: [...GRAPHS.af.pos, [-2.4, 3.8]] };
  const A = gmG(G7);
  gmHide(A, ['g']);
  const me = gmHost(-6.3, 3.9);
  const D = { a: '1/8', b: '2/7', e: '3/6', d: '4/5', c: '9/12', f: '10/11' };
  say('邊的分類（edge classification）', '');
  await step(tok);                                   // 1107.6 directed once, undirected twice
  say('每條邊都會被 DFS 看到', '有向圖看一次；無向圖兩端各看一次');
  await step(tok);                                   // 1125.6 to something unvisited → tree edge
  for (const [u, v] of [['a', 'b'], ['b', 'e'], ['e', 'd'], ['c', 'f']]) { A.ec(u, v, C.tree, 2.4); await kan(tok, 150, () => {}); }
  T('tree edge', 'ptr', 4.6, -3.6);
  say('走到新頂點的邊：tree edge（粗藍線）', '也就是 parent 指標');
  await step(tok);                                   // 1182.0 a forest: path a b e d, edge c f
  A.top('a', '樹 1', 'ptr alt'); A.top('c', '樹 2', 'ptr alt');
  say('tree edges 組成一個 forest（森林）', 'a → b → e → d 和 c → f');
  await step(tok);                                   // 1191.0 if another edge from e … an actual tree
  await gmShow(tok, A, ['g']);
  const eg = addEdge(A.g, A.I('e'), A.I('g')); edgeColor(eg, C.tree, 2.4);
  say('如果 e 還有一條邊到 g，就會分岔成真正的樹', '');
  await step(tok);                                   // 1222.4 three other types
  T('其他邊：forward・backward・cross', 'say', 0, -4.3);
  say('非粗線的邊再分三種', 'forward、backward、cross');
  await step(tok);                                   // 1251.4 forward edge a → d
  A.ec('a', 'd', C.fwd, 2);
  T('F', 'note', -4.8, 0, 0.8);
  say('a → d：forward edge', '從祖先指向後代（樹上 a 走得到 d）');
  await step(tok);                                   // 1275.3 backward edge d → b
  A.ec('d', 'b', C.back, 2);
  T('B', 'note', -2.0, 0, 0.8);
  say('d → b：backward edge', '從後代指回祖先（d 的爺爺是 b）');
  await step(tok);                                   // 1326.1 all others: cross edges (c → e)
  A.ec('c', 'e', C.cross, 2);
  T('C', 'note', 1.6, 0, 0.8);
  say('其他的都是 cross edge：c → e', '從一棵樹跨到另一棵樹');
  await step(tok);                                   // 1343.7 also within one tree: g → d (siblings)
  const gd = addEdge(A.g, A.I('g'), A.I('d')); edgeColor(gd, C.cross, 2);
  say('也可以在同一棵樹裡：g → d', 'g 和 d 是兄弟，沒有祖先關係');
  await step(tok);                                   // 1366.3 between two subtrees, non-ancestor related
  A.col('d', '#f6d7b0', 0.3); A.col('g', '#f6d7b0', 0.3);
  say('cross edge：連接兩個「沒有祖先關係」的節點', '');
  await step(tok);                                   // 1409.0 how do you compute which is which?
  A.col('d', C.white); A.col('g', C.white);
  me.mood('wow');
  say('怎麼用程式算出每條邊是哪一種？', '');
  await step(tok);                                   // 1422.2 parent structure → tree edges
  say('parent 決定 tree edge：每個 parent 指標就是一條', '');
  const ss = makeStrip(-3.6, 3.9, '遞迴堆疊', 0.9);
  await step(tok);                                   // 1453.5 mark nodes currently exploring (in process)
  ss.set(['a', 'b', 'e', 'd'].map((v) => ({ key: v, text: v, color: '#d9cfbd' })));
  for (const v of ['a', 'b', 'e', 'd']) A.col(v, C.gray, 0.3);
  say('backward：記住哪些點「正在處理中」', '開始時 in_process = true，結束時改回 false');
  await step(tok);                                   // 1495.3 edge into the stack → backward edge
  await gmHop(tok, A, 'd', 'b', 500);
  A.ec('d', 'b', C.back, 2.6);
  say('d 看 b 時，b 還在堆疊上 → backward edge', '堆疊上的都是祖先');
  await step(tok);                                   // 1510.6 forward vs cross: trickier
  ss.set([]); for (const v of ['a', 'b', 'e', 'd']) A.col(v, C.white);
  say('forward 和 cross 比較難分', '');
  await step(tok);                                   // 1533.3 textbook: record start / finish times
  for (const v in D) A.top(v, D[v]);
  say('課本：記錄每個點的開始時間和結束時間', '一個計數器，每做一步就 +1');
  await step(tok);                                   // 1566.0 times tell forward vs cross
  T('d[u] < d[v] 且 v 已結束 → forward；否則 cross', 'note', 0, 4.6);
  me.mood('happy');
  say('用這些時間就能分辨 forward 和 cross', '細節看課本');
}]);

// 26:22 無向圖有哪些邊？
const GM_UND = { title: '無向', directed: false, names: ['s', 'a', 'b', 'r', 'x', 'y'],
  pos: [[-4.8, -1.8], [-2.2, -0.2], [-4.8, 1.6], [2.8, -1.8], [1.4, 1.4], [4.4, 1.4]],
  edges: [[0, 1], [1, 2], [2, 0], [3, 4], [3, 5], [4, 5]] };
FRAG.push(['graphmit-l14-undirected', '無向圖只有 tree edge 與 back edge', async (tok) => {
  gmFresh();
  await step(tok);                                   // 1582.3 puzzle: which can exist undirected?
  const me = gmHost(-6.3, 3.9);
  const tg = {};
  [['tree', 'tree ?'], ['fwd', 'forward ?'], ['back', 'backward ?'], ['cross', 'cross ?']].forEach(([k, t], i) => { tg[k] = T(t, 'say', -4.5 + i * 3.0, -4.2); });
  say('小謎題：無向圖的 DFS 會有哪幾種邊？', '');
  await step(tok);                                   // 1598.7 vote
  me.mood('wow');
  say('全班投票：tree？forward？backward？cross？', '');
  await step(tok);                                   // 1626.8 they all exist — no, that's not true
  say('「全部都有」？老師：不對', '很容易搞混');
  await step(tok);                                   // 1658.1 tree edges better exist
  setT(tg.tree, 'tree ✓'); clsT(tg.tree, 'ptr');
  const A = gmG(GM_UND);
  say('tree edge 一定有：用來走到新頂點', '');
  await step(tok);                                   // 1665.7 forward: visit, visit, backtrack, follow edge
  A.ec('s', 'a', C.tree, 2.4); A.ec('a', 'b', C.tree, 2.4); A.ec('b', 's', C.fwd, 2);
  T('有向圖：s → a → b 後回到 s 再走 s → b = forward', 'note', -3.4, 3.4);
  say('forward edge：走完 s → a → b 回來，才看到 s → b', '');
  await step(tok);                                   // 1707.0 undirected: at b we follow b–s first
  A.ec('b', 's', C.edge, 1);
  const w = gmWalker(A, 's');
  await gmGo(tok, A, w, 'a', 350); await gmGo(tok, A, w, 'b', 350);
  await gmHop(tok, A, 'b', 's', 400);
  A.ec('b', 's', C.back, 2.4);
  say('無向圖：在 b 時就會先看到 b–s', 's 還在處理中 → 變成 back edge');
  await step(tok);                                   // 1729.8 never forward edges
  setT(tg.fwd, 'forward ✗'); clsT(tg.fwd, 'ptr alt');
  say('所以無向圖不會有 forward edge', '');
  await step(tok);                                   // 1759.3 cross: go here, backtrack, another edge to a visited subtree
  A.ec('r', 'x', C.tree, 2.4); A.ec('r', 'y', C.tree, 2.4); A.ec('x', 'y', C.cross, 2);
  T('有向圖：r → x，回來，r → y，再看到 y → x = cross', 'note', 3.0, 3.4);
  say('cross edge 的樣子：兩個子樹之間有邊', '');
  await step(tok);                                   // 1779.0 undirected: from x we'd go down x–y → tree
  A.ec('r', 'y', C.edge, 1); A.ec('x', 'y', C.edge, 1);
  await gmGo(tok, A, w, 'r', 500); await gmGo(tok, A, w, 'x', 350);
  A.ec('x', 'y', C.tree, 2.4); await gmGo(tok, A, w, 'y', 350);
  say('無向圖：在 x 就會沿 x–y 走下去', '它變成 tree edge，不是 cross');
  await step(tok);                                   // 1788.5 notes were correct
  setT(tg.cross, 'cross ✗'); clsT(tg.cross, 'ptr alt');
  setT(tg.back, 'backward ✓'); clsT(tg.back, 'ptr');
  me.mood('happy');
  say('無向圖的 DFS：只有 tree edge 和 back edge', '');
}]);

// 30:05 Cycle detection：有 cycle ⇔ 有 back edge
const GM_BK = { title: 'back edge → cycle', directed: true, names: ['r', 'p', 'q', 'u'],
  pos: [[-4.6, -2.6], [-1.6, -2.6], [1.4, -2.6], [4.4, -2.6]], edges: [[0, 1], [1, 2], [2, 3], [3, 1]] };
const GM_CYC = { title: 'cycle', directed: true, names: ['v0', 'v1', 'v2', 'v3', 'vk'],
  pos: [[-3.6, -2.4], [0.0, -3.4], [3.6, -2.4], [3.0, 0.8], [-3.0, 0.8]],
  edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]] };
FRAG.push(['graphmit-l14-cycle', '有 cycle ⇔ DFS 有 back edge', async (tok) => {
  gmFresh();
  await step(tok);                                   // 1805.4 why care? two problems
  const me = gmHost(-6.3, 3.9);
  T('cycle detection', 'say', -2.4, -4.3); T('topological sort', 'say', 2.4, -4.3);
  say('邊的分類有什麼用？兩個問題', '');
  await step(tok);                                   // 1841.5 cycle detection first
  say('先做 cycle detection：圖裡有沒有 cycle？', '有向圖要看方向');
  await step(tok);                                   // 1857.0 G has a cycle ⇔ DFS has a back edge
  const th = T('G 有 cycle ⇔ DFS 出現 back edge', 'ptr alt', 0, -3.6);
  say('定理：G 有 cycle ⇔ DFS 有 back edge', '跑「外層版」DFS，看整張圖');
  await step(tok);                                   // 1895.0 directed and undirected
  say('有向圖、無向圖都成立', '');
  await step(tok);                                   // 1941.0 ⇐ easy: back edge → cycle
  const A = gmG(GM_BK);
  A.ec('u', 'p', C.back, 2.4);
  say('⇐：有 back edge 就有 cycle', 'back edge u → p 指向祖先');
  await step(tok);                                   // 1959.5 tree path connects them
  for (const [u, v] of [['r', 'p'], ['p', 'q'], ['q', 'u']]) A.ec(u, v, C.tree, 2.4);
  say('祖先 p 沿 tree edges 走得到 u', '');
  await step(tok);                                   // 1988.7 do you see a cycle?
  for (const v of ['p', 'q', 'u']) A.col(v, GM.hot, 0.3);
  await gmHop(tok, A, 'p', 'q', 300); await gmHop(tok, A, 'q', 'u', 300); await gmHop(tok, A, 'u', 'p', 300);
  me.mood('happy');
  say('p → q → u → p：一個 cycle', '');
  await step(tok);                                   // 2014.3 other direction: cycle → back edge
  say('⇒：有 cycle，一定有 back edge 嗎？', '這個方向比較難');
  await step(tok);                                   // 2051.6 a length-k cycle
  gmFresh(); const me2 = gmHost(-6.3, 3.9);
  T('G 有 cycle ⇔ DFS 出現 back edge', 'ptr alt', 0, -4.4);
  const B = gmG(GM_CYC);
  say('畫一個長度 k 的 cycle', 'v0 → v1 → … → vk → v0');
  await step(tok);                                   // 2065.3 vk → v0 maybe the back edge
  B.ec('vk', 'v0', GM.hot, 2.2);
  say('猜：vk → v0 會是 back edge', '但要先說清楚怎麼標號');
  await step(tok);                                   // 2124.6 v0 = first vertex of the cycle visited
  B.col('v0', C.gray, 0.3); B.top('v0', '第一個被拜訪', 'ptr alt');
  say('令 v0 = cycle 上「第一個」被 DFS 碰到的點', '其他依序叫 v1 … vk');
  await step(tok);                                   // 2180.1 claim: vk v0 is a back edge
  say('主張：vk → v0 是 back edge', '');
  await step(tok);                                   // 2210.5 exploit the depth-first nature
  say('關鍵：DFS 會「一路走到底」才回頭', '');
  const ss = makeStrip(-3.6, 3.9, '遞迴堆疊', 0.9);
  const S = ['v0'];
  const sset = () => ss.set(S.map((v) => ({ key: v, text: v, color: '#d9cfbd' })));
  sset();
  await step(tok);                                   // 2251.9 v1 visited before finishing v0
  B.ec('v0', 'v1', C.tree, 2.4); await gmHop(tok, B, 'v0', 'v1', 400); B.col('v1', C.gray, 0.3); S.push('v1'); sset();
  say('v0 結束之前，一定會拜訪到 v1', '可能直接走，也可能繞別的路');
  await step(tok);                                   // 2298.3 same for all vi (induction)
  for (const [u, v] of [['v1', 'v2'], ['v2', 'v3'], ['v3', 'vk']]) { B.ec(u, v, C.tree, 2.4); await gmHop(tok, B, u, v, 320); B.col(v, C.gray, 0.3); S.push(v); sset(); }
  say('所有 vi 都從 v0 走得到：都會在 v0 結束前被拜訪', '');
  await step(tok);                                   // 2352.2 start v0, start vk, finish vk, finish v0
  bars([{ name: 'v0', d: 1, f: 10, color: '#9b7ef4' }, { name: 'vk', d: 5, f: 6, color: '#e55a9b' }], 2.0, 10, 0.4, 5.8);
  say('v0 開始 → vk 開始 → vk 結束 → v0 結束', '');
  await step(tok);                                   // 2367.8 balanced parentheses
  T('( v0  ( vk  vk )  v0 )', 'note', 3.1, 3.2);
  say('像括號一樣配對：balanced parentheses', '');
  await step(tok);                                   // 2427.9 consider vk → v0: v0 on the stack → back edge
  B.ec('vk', 'v0', C.back, 2.6); await gmHop(tok, B, 'vk', 'v0', 450);
  me2.mood('wow');
  say('看 vk → v0 時，v0 還在遞迴堆疊上', '→ back edge');
  await step(tok);                                   // 2476.0 linear time; find the cycle via tree edges
  for (const v of ['v0', 'v1', 'v2', 'v3', 'vk']) B.col(v, GM.hot, 0.2);
  say('線性時間就能判斷有沒有 cycle', '還能沿 tree edges 把 cycle 找出來');
  await step(tok);                                   // 2489.9 "no, here's a cycle" / "agree: no back edges"
  me2.mood('happy');
  T('沒有 back edge → 只有 tree、forward、cross → 無 cycle', 'say', 0, -3.6);
  say('有人說「這張圖沒有 cycle」？跑一次 DFS 就知道', '');
}]);

// 41:51 Topological sort：job scheduling
const GM_DAG = { title: '工作排程 DAG', directed: true, names: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'],
  pos: [[-5.2, 0.0], [-0.4, 0.9], [3.4, 2.0], [-5.2, 2.6], [1.6, -0.9], [4.6, -0.6], [-5.2, -2.6], [-2.6, -1.4], [5.6, 2.4]],
  edges: [[6, 7], [0, 7], [7, 1], [3, 1], [1, 4], [4, 2], [2, 5], [5, 8], [4, 8]] };
FRAG.push(['graphmit-l14-topo', 'Topological sort：DFS 結束時間反序', async (tok) => {
  gmFresh();
  await step(tok);                                   // 2511.9 application two: topological sort
  const me = gmHost(-6.3, 3.9);
  say('應用二：topological sort', '背景問題：job scheduling（工作排程）');
  await step(tok);                                   // 2530.4 given a DAG
  const A = gmG(GM_DAG);
  say('給一張 directed acyclic graph', '');
  await step(tok);                                   // 2541.9 order vertices: edges point low → high
  T('排成一列：每條邊都從前面指向後面', 'note', 0, -4.2);
  say('要把頂點排成一個順序', '所有邊都從順序小的指向順序大的');
  await step(tok);                                   // 2572.4 called a DAG
  T('DAG = Directed Acyclic Graph', 'ptr alt', 0, 4.4);
  say('directed acyclic graph 簡稱 DAG', '');
  await step(tok);                                   // 2611.8 drawn left to right: no cycles
  say('畫成邊都往右，看得出沒有 cycle', '一般情況就跑 DFS 檢查');
  await step(tok);                                   // 2625.4 vertices = things to do; getting dressed
  const k = buddy('', '', '#9fd3f0', -3.0, 0, 3.8, 0.55);
  T('襪子 → 鞋子', 'say', -3.0, 3.0, 1.0);
  say('頂點 = 要做的事；課本例子：穿衣服', '先穿襪子才能穿鞋子');
  await step(tok);                                   // 2645.0 watch any time: unconstrained parts
  T('手錶：什麼時候戴都行', 'say', 0.6, 3.0, 1.0);
  k.mood('happy');
  say('有些事沒有限制：手錶什麼時候戴都可以', '');
  await step(tok);                                   // 2668.7 choose an actual order: one thing at a time
  say('一次只能做一件事：要排出完整的順序', '');
  await step(tok);                                   // 2677.0 g, a, h, (not b: d first) d, b, e, c, f, i
  const ord = ['g', 'a', 'h', 'd', 'b', 'e', 'c', 'f', 'i'];
  for (let i = 0; i < ord.length; i++) { A.col(ord[i], GM.vis, 0.2); A.top(ord[i], '#' + (i + 1), 'ptr alt'); await kan(tok, 160, () => {}); }
  say('老師的順序：g, a, h, d, b, e, c, f, i', 'h 要等 g、a；b 要等 d');
  await step(tok);                                   // 2690.0 valid: every edge earlier → later
  await gmMove(tok, gmPos(A, Object.fromEntries(ord.map((v, i) => [v, [-5.6 + i * 1.4, 0.2]]))), 1400);
  A.g.edges.forEach((e, i) => { e.bend = (i % 2 ? 1 : -1) * 0.25; drawEdge(GR, e); });
  say('排成一列：每條邊都朝右 → 合法', '');
  await step(tok);                                   // 2711.8 how? DFS = topological sort
  me.mood('wow');
  say('怎麼算？用 DFS', '這個演算法就叫 topological sort');
  await step(tok);                                   // 2734.0 run DFS, output reverse of finishing times
  T('跑 DFS，依 finishing time 反序輸出', 'ptr alt', 0, -3.4);
  say('跑 DFS，把頂點依「結束時間」反過來輸出', '');
  await step(tok);                                   // 2765.0 every time a vertex finishes, add to a list
  const fin = ['i', 'f', 'c', 'e', 'b', 'h', 'a', 'd', 'g'];
  const fs = makeStrip(-4.4, 3.2, 'finished', 0.9);
  const L = [];
  for (const v of fin) { L.push(v); fs.set(L.map((x) => ({ key: x, text: x, color: '#cfe3f7' }))); A.col(v, C.black); await kan(tok, 180, () => {}); }
  say('每結束一個點就加進 list（字母順序 DFS）', 'i, f, c, e, b, h, a, d, g');
  await step(tok);                                   // 2775.7 reverse it: a topological order
  fs.set([...fin].reverse().map((x) => ({ key: x, text: x, color: '#cfe3f7' })));
  me.mood('happy');
  say('反過來：g, d, a, h, b, e, c, f, i', '也是合法順序（答案不唯一）');
}]);

// 46:23 為什麼 finishing time 反序是對的
FRAG.push(['graphmit-l14-proof', '為什麼結束時間反序是對的', async (tok) => {
  gmFresh();
  await step(tok);                                   // 2783.2 let's prove it
  const me = gmHost(-6.3, 3.9);
  say('來證明它', '');
  await step(tok);                                   // 2802.4 no cycles → no back edges
  T('DAG：沒有 cycle → 沒有 back edge', 'say', 0, -4.3);
  say('圖沒有 cycle → DFS 沒有 back edge', '剛剛的定理');
  await step(tok);                                   // 2811.0 only tree, forward, cross
  T('只剩 tree、forward、cross edge', 'say', 0, -3.6);
  say('只剩 tree、forward、cross edge', '');
  await step(tok);                                   // 2832.7 edge (u, v): v finishes before u
  const A = gmG({ directed: true, names: ['u', 'v'], pos: [[-2.2, -1.8], [2.2, -1.8]], edges: [[0, 1]] });
  T('要證：f[v] < f[u]', 'ptr alt', 0, -0.6);
  say('對每條邊 u → v：要證 v 比 u 先結束', '');
  await step(tok);                                   // 2852.1 reverse → u ordered first
  say('反序之後，u 就會排在 v 前面', '');
  await step(tok);                                   // 2866.1 two cases
  T('情況 1：u 先開始', 'ptr', -2.8, 0.6); T('情況 2：v 先開始', 'ptr', 3.2, 0.6);
  say('兩種情況：u 先開始，或 v 先開始', '');
  await step(tok);                                   // 2907.3 case 1: v reachable, visited in u's recursion
  bars([{ name: 'u', d: 1, f: 4, color: '#4b9ee2' }, { name: 'v', d: 2, f: 3, color: '#9b7ef4' }], 1.4, 4, -5.6, 0);
  A.col('u', C.gray, 0.3); await gmHop(tok, A, 'u', 'v', 500); A.col('v', C.gray, 0.3);
  say('情況 1：u 先開始，v 走得到', '在 u 的遞迴裡一定會拜訪 v');
  await step(tok);                                   // 2944.4 finish v before u
  A.col('v', C.black); await kan(tok, 300, () => {}); A.col('u', C.black);
  T('( u ( v v ) u ) → v 先結束 ✓', 'note', -2.8, 2.6);
  say('v 完整拜訪完才回到 u：v 先結束', '');
  await step(tok);                                   // 2954.4 case 2: v starts before u
  A.col('u', C.white); A.col('v', C.gray, 0.3);
  bars([{ name: 'v', d: 1, f: 2, color: '#9b7ef4' }, { name: 'u', d: 3, f: 4, color: '#4b9ee2' }], 1.4, 4, 0.6, 5.8);
  say('情況 2：v 先開始，u 還沒被拜訪', '會不會出問題？');
  await step(tok);                                   // 2981.9 visiting u from v would need a cycle
  const ghost = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.04, 6, 40, Math.PI), new THREE.MeshBasicMaterial({ color: C.back }));
  ghost.rotation.x = Math.PI / 2; ghost.position.set(0, 0.3, -1.8); lab.world.add(ghost);
  T('v ⇢ u ？✗ 會形成 cycle', 'note', 0, 0.0, 0.9);
  me.mood('wow');
  say('如果 v 走得到 u，加上 u → v 就是 cycle', 'DAG 不可能 → 矛盾');
  await step(tok);                                   // 2994.3 v finishes before we even visit u
  A.col('v', C.black);
  T('v 結束時還沒碰到 u → v 先結束 ✓', 'note', 3.2, 2.6);
  say('所以 v 結束時根本還沒碰到 u', 'v 一樣先結束');
  await step(tok);                                   // 3009.9 that's the proof
  me.mood('happy');
  say('證完：topological sort 給出合法的工作順序', 'DFS 簡單、線性時間、用途很多');
}]);

// ═════════════════ C5SPsY72_CM：MIT 6.006 Rec14 — DFS code, edge types, topological sort ═════════════════
// Graph: A→B, A→G, B→C, C→A, C→D, C→F, D→E, D→F, G→C (alphabetical adjacency lists).
const GM_R14TREE = { A: [-1.4, -3.6], B: [-3.0, -1.8], G: [1.4, -1.8], C: [-3.0, 0.0], D: [-3.0, 1.8], E: [-4.4, 3.5], F: [-1.6, 3.5] };
const GM_R14UTREE = { A: [-1.2, -3.6], B: [-1.2, -2.0], C: [-1.2, -0.4], D: [-2.8, 1.3], G: [1.4, 1.3], E: [-4.0, 3.2], F: [-1.6, 3.2] };
const GM_R14LINE = ['A', 'G', 'B', 'C', 'D', 'F', 'E'];
// 1:42 adjacency list as a dict
FRAG.push(['graphmit-r14-adj', 'Adjacency list：用 dict 存有向圖', async (tok) => {
  gmFresh();
  await step(tok);                                   // 102.3 what's a graph? edges and vertices
  const me = gmHost(-6.3, 3.9);
  T('graph = vertices + edges', 'say', 0, -4.3);
  say('什麼是 graph？一堆頂點和邊', '');
  await step(tok);                                   // 130.7 looks like a graph
  const A = gmG(GRAPHS.rec14);
  say('黑板上的圖：A～G', '');
  await step(tok);                                   // 162.9 directed: arrows
  for (const e of A.g.edges) { edgeColor(e, GM.hot, 1.6); }
  await kan(tok, 500, () => {});
  for (const e of A.g.edges) { edgeColor(e, C.edge, 1); }
  say('有箭頭 → directed graph（有向圖）', '');
  await step(tok);                                   // 180.4 store it: adjacency list
  me.mood('wow');
  say('Python 裡怎麼存？adjacency list', '');
  const AL = gmDict(4.6, -3.6, 'AL（dict）', 0.48);
  await step(tok);                                   // 196.9 a dictionary: keys = vertices, values = lists
  for (const v of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) AL.set(v, '[ … ]');
  say('就是一個 dict：key 是頂點，value 是一串頂點', '');
  await step(tok);                                   // 247.6 A's list: B and G
  AL.set('A', '[B, G]'); AL.hl('A', true);
  for (const v of ['B', 'G']) { A.ec('A', v, GM.hot, 2); await gmHop(tok, A, 'A', v, 350); }
  say('A 的串列：[B, G]', '');
  await step(tok);                                   // 257.7 B's list: why not A? directed
  AL.hl('A', false); for (const v of ['B', 'G']) A.ec('A', v, C.edge, 1);
  AL.set('B', '[C]'); AL.hl('B', true);
  A.ec('B', 'C', GM.hot, 2);
  const x = await gmBlock(tok, A, null, 'B', 'A', '沒有 B → A');
  for (const [v, l] of [['C', '[A, D, F]'], ['D', '[E, F]'], ['E', '[ ]'], ['F', '[ ]'], ['G', '[C]']]) AL.set(v, l);
  say('B 的串列只有 [C]：邊有方向，B 走不回 A', '');
  await step(tok);                                   // 292.0 pseudo-python: class G with dict AL
  kill(x); AL.hl('B', false); A.ec('B', 'C', C.edge, 1);
  const cd = code(['class G:', '  AL = { … }', '  def vertices(self):', '    return AL.keys()', '  def neighbors(self, v):', '    return AL[v]'], -3.6, 2.4, 0.42);
  cd.hl(1);
  say('寫一點「差不多是 Python」：class G 裡有 dict AL', '');
  await step(tok);                                   // 309.3 all vertices: AL.keys()
  cd.hl(3);
  say('所有頂點：AL.keys()', '');
  await step(tok);                                   // 330.9 neighbours of v: AL[v]
  cd.hl(5); AL.hl('C', true); A.col('C', GM.hot, 0.3);
  me.mood('happy');
  say('頂點 v 的鄰居：AL[v]', '例如 AL[C] = [A, D, F]');
}]);

// 6:12 遞迴 DFS：visited → parent
const GM_R14V = [
  ['def DFS(G, s):', '  DFS_visit(G, s)', '', '', '', 'def DFS_visit(G, v):', '  for n in G.neighbors(v):', '    DFS_visit(G, n)', '', ''],
  ['def DFS(G, s):', '  r = DFSResult()', '  DFS_visit(G, s, r)', '', '', 'def DFS_visit(G, v, r):', '  for n in G.neighbors(v):', '    if n not in r.visited:', '      r.visited[n] = True', '      DFS_visit(G, n, r)'],
  ['def DFS(G, s):', '  r = DFSResult()', '  DFS_visit(G, s, r)', '', '', 'def DFS_visit(G, v, r):', '  r.visited[v] = True', '  for n in G.neighbors(v):', '    if n not in r.visited:', '      DFS_visit(G, n, r)'],
  ['def DFS(G, s):', '  r = DFSResult()', '  DFS_visit(G, s, r)', '', '', 'def DFS_visit(G, v, r):', '  for n in G.neighbors(v):', '    if n not in r.parent:', '      r.parent[n] = v', '      DFS_visit(G, n, r)'],
  ['def DFS(G, s):', '  r = DFSResult()', '  r.parent[s] = None', '  DFS_visit(G, s, r)', '  return r', 'def DFS_visit(G, v, r):', '  for n in G.neighbors(v):', '    if n not in r.parent:', '      r.parent[n] = v', '      DFS_visit(G, n, r)'],
];
FRAG.push(['graphmit-r14-code', '遞迴 DFS：從 visited 到 parent', async (tok) => {
  gmFresh(GM_CAM, [0.6, 0, -0.3]);
  await step(tok);                                   // 372.0 let's write DFS
  const cd = code(GM_R14V[0].map((s) => s.padEnd(28, ' ')), -3.5, -3.8, 0.5);
  const ver = (k) => GM_R14V[k].forEach((s, i) => setT(cd.ls[i], s.padEnd(28, ' ')));
  const A = gmG(GRAPHS.rec14, { scale: 0.58, dx: 3.2, dz: -1.2 });
  const me = gmHost(-6.3, 3.9);
  say('來寫 DFS：需要一張圖和起點 s', '');
  await step(tok);                                   // 399.2 keep following a path: first vertex in each list
  const w = gmWalker(A, 'A');
  for (const [u, v] of [['A', 'B'], ['B', 'C']]) { A.ec(u, v, C.tree, 2.2); await gmGo(tok, A, w, v, 380); }
  say('一直沿著路往下：每次挑串列裡第一個', 'A → B → C …');
  await step(tok);                                   // 425.3 recursive: for every neighbour DFS
  cd.hl(5);
  say('寫成遞迴：DFS 呼叫 DFS_visit(G, s)', '');
  await step(tok);                                   // 480.8 iterate neighbours, recurse
  cd.hl(6); await kan(tok, 300, () => {}); cd.hl(7);
  say('DFS_visit：對每個鄰居 n，遞迴 DFS_visit(G, n)', '');
  await step(tok);                                   // 506.0 holes: recurse forever
  A.ec('C', 'A', C.back, 2.2);
  for (const v of ['A', 'B', 'C', 'A']) await gmGo(tok, A, w, v, 250);
  const inf = T('A → B → C → A → … 永遠停不下來', 'note', 3.2, 2.2);
  me.mood('sad');
  say('問題：A → B → C → A → … 無限遞迴', '');
  await step(tok);                                   // 521.6 check if already visited
  say('解法：記住去過哪裡，去過就不要再去', '');
  await step(tok);                                   // 548.0 dfsResult: the junk drawer
  remove(inf); A.ec('C', 'A', C.edge, 1);
  const box = prop('parcel', -5.6, 0, 2.6, 0.9, 'r = DFSResult()');
  bob(box, 0.06, 2);
  ver(1); cd.hl(1);
  me.mood('happy');
  say('建一個 DFSResult 物件 r：雜物抽屜', '需要記的東西都往裡面丟');
  await step(tok);                                   // 610.6 visited: a list? slow → dictionary
  const vl = T('visited 用 list？查詢很慢 → 用 dict', 'note', 3.2, 2.2);
  say('visited 用 list？DFS 很常查，太慢', '改用 dict');
  await step(tok);                                   // 638.5 visited dict: key node, value True
  remove(vl);
  const VD = gmDict(1.4, 1.4, 'r.visited', 0.42);
  VD.set('B', 'True');
  say('r.visited：key 是頂點，value 是 True', '只放去過的頂點，不用初始化');
  await step(tok);                                   // 712.7 if n not in r.visited
  cd.hl(7); await kan(tok, 250, () => {}); cd.hl(8);
  VD.set('C', 'True');
  say('if n not in r.visited：才標記並遞迴', '');
  await step(tok);                                   // 810.9 never mark the start node
  w.mood('wow'); await gmGo(tok, A, w, 'A', 450);
  A.col('A', C.back, 0.3);
  say('可是：起點 A 從來沒被標記！', 'C 還是會走回 A');
  await step(tok);                                   // 833.2 r.visited[v] = True at the beginning
  ver(2); cd.hl(6); A.col('A', C.white); VD.set('A', 'True');
  w.mood('happy');
  say('改成一進 DFS_visit 就標記 r.visited[v] = True', '');
  await step(tok);                                   // 894.0 instead of visited, keep parent
  for (const l of VD.rows.values()) remove(l);
  say('再改：不記 visited，改記 parent', 'parent = 從哪個頂點走過來的');
  const PD = gmDict(1.4, 1.4, 'r.parent', 0.42);
  await step(tok);                                   // 917.9 parent of B = A, C = B; A = None
  PD.set('B', 'A'); PD.set('C', 'B'); PD.set('A', 'None');
  A.note('B', 'parent A'); A.note('C', 'parent B');
  say('parent[B] = A、parent[C] = B', 'A 沒有 parent：None');
  await step(tok);                                   // 963.5 r.parent[n] = v
  ver(3); cd.hl(8);
  say('程式改成 r.parent[n] = v', '');
  await step(tok);                                   // 988.0 in the dict? (not "is None")
  cd.hl(7);
  T('判斷「在不在 dict」，不能判斷是不是 None', 'note', 1.4, 3.4);
  say('沒有 parent = 沒去過；但要判斷「在不在 dict」', '起點的 parent 就是 None');
  await step(tok);                                   // 1029.1 missing: r.parent[s] = None in DFS
  ver(4); cd.hl(2);
  me.mood('happy');
  say('最後補上：DFS 裡 r.parent[s] = None', '這樣就能正常運作');
}]);

// 18:12 例子：依字母順序 trace
FRAG.push(['graphmit-r14-trace', 'A～G 依字母順序 trace：parent 指標', async (tok) => {
  gmFresh();
  await step(tok);                                   // 1092.5 trace this graph: parents dict + call structure
  const A = gmG(GRAPHS.rec14);
  const PD = gmDict(5.0, -3.8, 'parent', 0.45);
  const cs = makeStrip(-4.6, 4.1, '呼叫', 1.1);
  const calls = [];
  const cset = () => cs.set(calls.map((v, k) => ({ key: 'c' + v, text: v === 'A0' ? 'DFS(A)' : 'visit(' + v + ')', color: '#d9cfbd' })));
  say('在這張圖上 trace：記 parent 和呼叫順序', '');
  let w = null;
  const tree = async (u, v) => { A.ec(u, v, C.tree, 2.4); await gmGo(tok, A, w, v, 380); A.col(v, C.gray, 0.3); PD.set(v, u); calls.push(v); cset(); };
  await step(tok);                                   // 1120.2 start: DFS(A) calls DFS_visit(A)
  w = gmWalker(A, 'A'); A.col('A', C.gray, 0.3); PD.set('A', 'None'); calls.push('A0', 'A'); cset();
  say('從 DFS(A) 開始，它呼叫 DFS_visit(A)', '');
  await step(tok);                                   // 1136.0 A's neighbours: is B in parents? no
  A.ec('A', 'B', GM.hot, 1.8);
  say('A 的鄰居 B：在 parents 裡嗎？不在', '加進去並拜訪');
  await step(tok);                                   // 1172.5 visit B: B's child C, not in parents
  await tree('A', 'B');
  A.ec('B', 'C', GM.hot, 1.8);
  say('parent[B] = A；B 的唯一鄰居 C 不在 parents', '');
  await step(tok);                                   // 1206.7 C gets parent B
  await tree('B', 'C');
  say('parent[C] = B，拜訪 C', '');
  await step(tok);                                   // 1212.6 C's children: alphabetical A, D, F
  for (const v of ['A', 'D', 'F']) A.ec('C', v, GM.hot, 1.6);
  say('C 的鄰居（字母順序）：A、D、F', '');
  await step(tok);                                   // 1234.3 A in parents? yes → skip
  for (const v of ['D', 'F']) A.ec('C', v, C.edge, 1);
  const x = await gmBlock(tok, A, w, 'C', 'A', 'A 已在 parents');
  say('A 在 parents 裡 → 跳過', '');
  await step(tok);                                   // 1239.0 D: not in parents
  kill(x);
  await tree('C', 'D');
  say('D 不在 → parent[D] = C，拜訪 D', '');
  await step(tok);                                   // 1254.3 D's neighbour E; E has no children
  await tree('D', 'E');
  await kan(tok, 300, () => {}); A.col('E', C.black); calls.pop(); cset(); await gmGo(tok, A, w, 'D', 300);
  say('D → E：parent[E] = D；E 沒有出邊，結束', '');
  await step(tok);                                   // 1287.2 F in parents? no: parent D
  await tree('D', 'F');
  say('F 不在 → parent[F] = D', '');
  await step(tok);                                   // 1303.4 F no children; back to D; D done; at C look at F
  A.col('F', C.black); calls.pop(); cset(); await gmGo(tok, A, w, 'D', 300);
  A.col('D', C.black); calls.pop(); cset(); await gmGo(tok, A, w, 'C', 300);
  say('F 結束 → 回 D；D 也結束 → 回到 C', '');
  await step(tok);                                   // 1315.6 F in parents? edge C → F?
  const y = await gmBlock(tok, A, w, 'C', 'F', 'F 已在 parents');
  say('C 看 F：F 已經在 parents 裡', 'C → F 是哪種邊？');
  await step(tok);                                   // 1336.0 A–B, B–C, C–D, D–E, D–F: tree edges
  kill(y);
  for (const [u, v] of [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['D', 'F']]) { A.ec(u, v, C.tree, 3); await kan(tok, 120, () => {}); }
  say('走過的 A→B、B→C、C→D、D→E、D→F：tree edges', '');
  await step(tok);                                   // 1352.5 why "tree": parent pointers define a tree
  for (const v of ['B', 'C', 'D', 'E', 'F']) A.note(v, 'π = ' + PD.rows.get(v).element.textContent.split(': ')[1]);
  say('為什麼叫 tree edge？parent 指標連起來是一棵樹', '');
  await step(tok);                                   // 1371.4 draw the DFS tree so far
  await gmMove(tok, gmPos(A, GM_R14TREE), 1300);
  say('把 DFS tree 畫出來：A → B → C → D → E、F', '');
  await step(tok);                                   // 1388.5 every parent pointer points the right way
  me_ok(A);
  say('每個點的 parent 指標都指向樹上的上一層', '');
}]);
function me_ok(A) { for (const v of ['A', 'B', 'C', 'D', 'E', 'F']) A.col(v, GM.vis, 0); }

// 23:24 四種邊（在 DFS tree 上）
FRAG.push(['graphmit-r14-classify', 'C→F forward、G→C cross、C→A back', async (tok) => {
  gmFresh();
  await step(tok);                                   // 1404.9 C to F: forward edge
  const A = gmG({ ...GRAPHS.rec14, pos: GRAPHS.rec14.names.map((n) => GM_R14TREE[n]) }, { noDrop: true });
  for (const [u, v] of [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['D', 'F']]) A.ec(u, v, C.tree, 3);
  gmHide(A, ['G']);
  for (const [u, v] of [['A', 'G'], ['G', 'C']]) A.E(u, v).group.visible = false;
  const me = gmHost(-6.3, 3.9);
  A.ec('C', 'F', C.fwd, 2.2);
  T('forward', 'note', -1.6, 1.6, 0.8);
  say('C → F：forward edge', '');
  await step(tok);                                   // 1416.2 node → descendant: a shortcut
  await gmHop(tok, A, 'C', 'F', 500);
  say('從節點指向它的後代（不只是 child）', '樹上的捷徑：往前跳');
  await step(tok);                                   // 1445.4 two types so far
  say('目前有兩種：tree edge 和 forward edge', '');
  await step(tok);                                   // 1461.9 why isn't D → … a forward edge? DFS took it
  A.ec('C', 'D', '#1d5fa8', 3.4);
  say('C → D 也通往後代，為什麼不算 forward？', '因為 DFS 走了它');
  await step(tok);                                   // 1488.1 DFS followed it → tree edge, done
  A.ec('C', 'D', C.tree, 3);
  T('DFS 有走 → tree edge，不用再看其他分類', 'say', 2.6, -4.2);
  say('DFS 走過的邊就是 tree edge，結束', '');
  await step(tok);                                   // 1525.7 at C: F already in parent → not followed
  say('在 C 看 C → F 時，F 已在 parent 裡', '所以 DFS 沒走它');
  await step(tok);                                   // 1568.3 back up to A; A → G
  await gmShow(tok, A, ['G']);
  const ag = A.E('A', 'G'); ag.group.visible = true; edgeColor(ag, C.tree, 3);
  await gmHop(tok, A, 'A', 'G', 400);
  say('C、B 結束，回到 A，看 A → G', 'G 不在 parent → tree edge');
  await step(tok);                                   // 1599.3 visit G: neighbours C
  const gc = A.E('G', 'C'); gc.group.visible = true; edgeColor(gc, GM.hot, 1.8);
  say('拜訪 G：G 的鄰居是 C', '');
  await step(tok);                                   // 1629.7 C is in parents: don't visit
  const x = await gmBlock(tok, A, null, 'G', 'C', 'C 已在 parents');
  say('C 已在 parents → 不拜訪', '樹現在長這樣');
  await step(tok);                                   // 1659.3 G → C: not a forward edge → cross
  kill(x); edgeColor(gc, C.cross, 2.2);
  T('cross', 'note', -0.6, -0.9, 0.8);
  say('G → C：C 不是 G 的後代 → cross edge', '');
  await step(tok);                                   // 1686.7 C → A: back edge
  A.ec('C', 'A', C.back, 2.2);
  T('back', 'note', -2.8, -2.4, 0.8);
  say('還有一條：C → A，指回祖先 → back edge', '在 C 時第一個就看到 A，已在 parent');
  await step(tok);                                   // 1760.1 tree; forward = shortcut; back = go back in time
  say('forward：樹上的捷徑；back：指回祖先', '');
  await step(tok);                                   // 1774.8 cross: a whole different world
  for (const v of ['B', 'C', 'D', 'E', 'F']) A.col(v, '#cfe3f7', 0.15);
  A.col('G', '#f6d7b0', 0.15);
  say('cross：從一個子樹跳到完全不同的子樹', 'A–G 這邊和 B 那邊是兩個小世界');
  await step(tok);                                   // 1800.1 decision: tree first (DFS followed)
  for (const v of ['B', 'C', 'D', 'E', 'F', 'G']) A.col(v, C.white);
  const fl = gmDict(3.0, 0.4, '判斷 u → v', 0.55, 'say');
  fl.set('1', 'DFS 有走 → tree');
  say('判斷流程：先問 DFS 有沒有走它', '有 → tree edge');
  await step(tok);                                   // 1847.8 u ancestor of v → forward
  fl.set('2', 'u 是 v 的祖先 → forward');
  say('沒走的話：u 是 v 的祖先 → forward', '');
  await step(tok);                                   // 1909.9 v ancestor of u → back; else cross
  fl.set('3', 'v 是 u 的祖先 → back'); fl.set('4', '其他 → cross');
  me.mood('happy');
  say('v 是 u 的祖先 → back；都不是 → cross', '');
}]);

// 32:13 無向版
FRAG.push(['graphmit-r14-undirected', '同一張圖改成無向：只剩 tree 與 back', async (tok) => {
  gmFresh();
  await step(tok);                                   // 1933.0 same DFS on an undirected graph
  const A = gmG(GRAPHS.rec14u);
  const me = gmHost(-6.3, 3.9);
  say('同一張圖，拿掉箭頭：無向圖', '會有哪幾種邊？');
  let w = null;
  const tree = async (u, v) => { A.ec(u, v, C.tree, 2.6); await gmGo(tok, A, w, v, 330); A.col(v, C.gray, 0.3); };
  await step(tok);                                   // 1984.0 DFS from A, write the tree
  w = gmWalker(A, 'A'); A.col('A', C.gray, 0.3);
  say('從 A 開始做 DFS，邊走邊畫樹', '');
  await step(tok);                                   // 2041.7 A–B, B–C; A first in C's list → back edge
  await tree('A', 'B'); await tree('B', 'C');
  await gmHop(tok, A, 'C', 'A', 350); A.ec('C', 'A', C.back, 2.2);
  say('A → B → C；C 的串列第一個是 A', 'A 還在處理中 → back edge');
  await step(tok);                                   // 2051.3 C–D, D–E, D–F, then F–C back edge
  await tree('C', 'D'); await tree('D', 'E'); A.col('E', C.black); await gmGo(tok, A, w, 'D', 250); await tree('D', 'F');
  await gmHop(tok, A, 'F', 'C', 350); A.ec('F', 'C', C.back, 2.2);
  say('C → D → E，D → F；F–C 是 back edge', '');
  await step(tok);                                   // 2063.8 not done: C → G; G–A back
  A.col('F', C.black); A.col('D', C.black); await gmGo(tok, A, w, 'C', 350);
  await tree('C', 'G');
  await gmHop(tok, A, 'G', 'A', 350); A.ec('G', 'A', C.back, 2.2);
  say('回到 C 還沒完：C → G；G–A 也是 back edge', '');
  await step(tok);                                   // 2097.3 count: 9 edges
  await gmMove(tok, gmPos(A, GM_R14UTREE), 1200);
  say('畫成樹：9 條邊都分好類', '');
  await step(tok);                                   // 2122.9 tree and backward; no forward, no cross
  T('tree ✓　back ✓　forward ✗　cross ✗', 'ptr alt', 2.6, -4.2);
  say('有 tree 和 back；沒有 forward、cross', '');
  await step(tok);                                   // 2152.0 DFS doesn't follow non-tree edges
  say('非 tree 的邊 DFS 都沒走', '只是其他演算法需要知道它們');
  await step(tok);                                   // 2169.3 why no forward: C, D, F then edge F–C
  await gmHop(tok, A, 'F', 'C', 450);
  say('為什麼沒有 forward？到 F 時就會先看到 F–C', '→ 被分成 back edge');
  await step(tok);                                   // 2218.0 forward shape: u … v; at v you'd see it
  T('u → … → v：在 v 就會看到 v–u，算 back', 'note', 2.8, 3.6);
  say('forward 要「到 v 時沒看到、晚點才從 u 看到」', '無向邊在 v 一定看得到');
  await step(tok);                                   // 2253.1 forward edges never happen
  me.mood('happy');
  say('所以無向圖不會有 forward edge', '');
  await step(tok);                                   // 2260.1 cross: at C you'd have taken the edge → tree
  say('cross 也不會：如果 C 連到別的子樹', '在 C 時就會走過去 → tree edge');
  await step(tok);                                   // 2304.4 purely DFS terms
  say('這些名詞全都只屬於 DFS', 'BFS 沒有 forward / back 的概念');
}]);

// 38:49 Topological sort：修課順序
FRAG.push(['graphmit-r14-courses', '修課順序：需要 DAG、finished 反轉', async (tok) => {
  gmFresh();
  await step(tok);                                   // 2329.0 topological sorting: really useful
  const A = gmG(GRAPHS.rec14);
  const me = gmHost(-6.3, 3.9);
  say('Topological sort：少數你以後真的會自己寫的演算法', '');
  await step(tok);                                   // 2343.0 vertices = classes, edges = prerequisites
  A.ec('A', 'B', GM.hot, 2.2);
  T('A → B：先修 A（6.01）才能修 B（6.006）', 'note', -3.0, -3.6);
  say('頂點 = 課，邊 = 先修：A → B 代表先修 A', '');
  await step(tok);                                   // 2361.7 an order: prerequisites first
  A.ec('A', 'B', C.edge, 1);
  say('要排一個修課順序：每門課的先修都先修完', '');
  await step(tok);                                   // 2389.0 acyclic? no
  for (const [u, v] of [['A', 'B'], ['B', 'C'], ['C', 'A']]) A.ec(u, v, C.back, 2.4);
  me.mood('wow');
  say('這張圖沒有 cycle 嗎？有：A → B → C → A', '');
  await step(tok);                                   // 2403.2 a cycle → no solution
  say('有 cycle 就無解', '');
  await step(tok);                                   // 2445.9 A, B, C: can't start with any
  for (const v of ['A', 'B', 'C']) { A.col(v, '#f3c4c4', 0.3); await kan(tok, 200, () => {}); }
  me.mood('sad');
  say('先修 A？要先 C；先修 B？要先 A；先修 C？要先 B', '哪一門都不能先');
  await step(tok);                                   // 2460.9 cycle: not a dependency graph
  say('有 cycle 就不是依賴關係圖', 'topological sort 只適用無環的圖');
  await step(tok);                                   // 2481.3 directed acyclic graph: DAG
  T('DAG = Directed + Acyclic + Graph', 'ptr alt', 2.6, -4.3);
  say('三個詞：directed、acyclic、graph → DAG', '');
  await step(tok);                                   // 2515.0 remove the edge; DFS, print reverse
  const ca = A.E('C', 'A');
  await kan(tok, 600, (u) => { ca.group.scale.setScalar(Math.max(0.001, 1 - u)); });
  ca.group.visible = false;
  for (const [u, v] of [['A', 'B'], ['B', 'C']]) A.ec(u, v, C.edge, 1);
  for (const v of ['A', 'B', 'C']) A.col(v, C.white);
  me.mood('happy');
  say('拿掉 C → A：跑 DFS，再把某個順序反過來', '');
  await step(tok);                                   // 2552.0 reverse of what? (visit order?)
  T('反過來的是「拜訪順序」嗎？', 'note', 3.0, 3.6);
  say('反過來的是什麼？拜訪順序嗎？', '');
  await step(tok);                                   // 2654.1 the order they finish the recursions
  T('不是：是遞迴「結束」的順序', 'note', 3.0, 4.3);
  say('不是：是每個頂點遞迴結束的順序', '');
  const cd = code(['def DFS_visit(G, v, r):', '  for n in G.neighbors(v):', '    if n not in r.parent:', '      r.parent[n] = v', '      DFS_visit(G, n, r)', '  r.finished.append(v)'], 0.2, -3.5, 0.42);
  cd.ls[5].element.style.visibility = 'hidden';
  await step(tok);                                   // 2707.2 a list finished, empty at first
  const fs = makeStrip(-4.6, 2.9, 'finished', 0.9);
  T('r.finished = [ ]', 'ptr', -4.6, 2.2);
  say('建一個 list：finished，一開始是空的', '');
  await step(tok);                                   // 2737.7 where? after the loop (line 4)
  cd.ls[5].element.style.visibility = ''; cd.hl(5);
  say('加在哪？for 迴圈之後', '頂點要完全離開時才加');
  await step(tok);                                   // 2777.3 append v; then r.finished.reverse()
  T('r.finished.reverse()', 'ptr alt', -4.6, 4.3);
  say('加的是 v；最後 r.finished.reverse()', '這就是 topological sort');
}]);

// 46:39 直覺：第一個結束的就是最後修的課
FRAG.push(['graphmit-r14-why', '第一個結束的，就是最後修的課', async (tok) => {
  gmFresh();
  await step(tok);                                   // 2799.5 why does it work? building the inverse
  const A = gmG(GRAPHS.rec14dag);
  const me = gmHost(-6.3, 3.9);
  const fs = makeStrip(-4.6, 4.1, 'finished', 0.9);
  const F = [];
  const fin = (v) => { F.push(v); fs.set(F.map((x) => ({ key: x, text: x, color: '#cfe3f7' }))); A.col(v, C.black); };
  say('為什麼這樣是對的？', 'finished 是最終答案的「反面」');
  await step(tok);                                   // 2814.4 first in the list = last class to take
  T('第一個放進 finished 的 = 最後修的課', 'note', 0, -4.2);
  say('第一個放進 list 的，就是最後才修的課', '');
  let w = null;
  await step(tok);                                   // 2822.0 DFS goes A, B, C, D, E: nothing after E
  w = gmWalker(A, 'A'); A.col('A', C.gray, 0.3);
  for (const [u, v] of [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E']]) { A.ec(u, v, C.tree, 2.4); await gmGo(tok, A, w, v, 300); A.col(v, C.gray, 0.3); }
  say('DFS 走 A → B → C → D → E；E 後面沒路了', '');
  await step(tok);                                   // 2831.9 no class depends on E: last, safe
  fin('E');
  say('沒有課依賴 E，否則 DFS 會繼續走', 'E 放最後修，一定安全');
  await step(tok);                                   // 2855.2 back to D; D → F; print F
  await gmGo(tok, A, w, 'D', 300); A.ec('D', 'F', C.tree, 2.4); await gmGo(tok, A, w, 'F', 300); fin('F');
  say('回到 D，走 D → F；F 結束', '');
  await step(tok);                                   // 2866.5 back to D: print D
  await gmGo(tok, A, w, 'D', 300); fin('D');
  say('回到 D：依賴 D 的課（E、F）都已經輸出', '所以現在輸出 D 是安全的');
  await step(tok);                                   // 2912.1 intuition → induction proof
  say('這就是直覺；可以寫成歸納法證明', '輸出一個點時，依賴它的都已經在 list 裡');
  await step(tok);                                   // 2951.3 out of D … print C
  await gmGo(tok, A, w, 'C', 300); fin('C');
  say('離開 C：輸出 C', '依賴 C 的 D、E、F 都已輸出');
  await step(tok);                                   // 2969.3 tree edge to D, forward edge to F
  A.ec('C', 'F', C.fwd, 2.2);
  say('C → D 是 tree edge，C → F 是 forward edge', 'F 早就結束、輸出了');
  await step(tok);                                   // 3005.6 out of C, out of B
  await gmGo(tok, A, w, 'B', 300); fin('B');
  say('離開 B：輸出 B', '');
  await step(tok);                                   // 3007.9 into G, out of G
  await gmGo(tok, A, w, 'A', 300); A.ec('A', 'G', C.tree, 2.4); await gmGo(tok, A, w, 'G', 300); A.col('G', C.gray, 0.3);
  A.ec('G', 'C', C.cross, 2.2); fin('G');
  say('回到 A，進入 G；G → C 的 C 早已輸出；輸出 G', '');
  await step(tok);                                   // 3017.8 out of A: print A; reverse
  await gmGo(tok, A, w, 'A', 300); fin('A');
  fs.set([...F].reverse().map((x) => ({ key: x, text: x, color: '#cfe3f7' })));
  await gmMove(tok, gmPos(A, Object.fromEntries(GM_R14LINE.map((v, i) => [v, [-5.4 + i * 1.8, 0.6]]))), 1300);
  A.g.edges.forEach((e, i) => { e.bend = (i % 2 ? 1 : -1) * 0.22; drawEdge(GR, e); });
  w.g.visible = false;
  me.mood('happy');
  say('最後輸出 A；反轉：A, G, B, C, D, F, E', '排成一列：所有邊都朝右');
  await step(tok);                                   // 3033.9 tree edges: DFS-visit returns first
  for (const [u, v] of [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['D', 'F'], ['A', 'G']]) A.ec(u, v, C.tree, 3);
  say('tree edge：遞迴回來時，底下的子樹都已輸出', '');
  await step(tok);                                   // 3053.6 forward edges: lower in the tree, already returned
  A.ec('C', 'F', C.fwd, 3);
  say('forward edge：指向樹的更下面，早就結束了', '');
  await step(tok);                                   // 3075.2 cross edge G → C: done with C already
  A.ec('G', 'C', C.cross, 3);
  say('cross edge G → C：C 早已結束、輸出', '所以這三種邊都不會出錯');
}]);

// 51:57 Back edge 會破壞 topological sort
FRAG.push(['graphmit-r14-back', 'Back edge 讓 topological sort 失敗', async (tok) => {
  gmFresh();
  await step(tok);                                   // 3117.1 what about a back edge C → A?
  const A = gmG({ ...GRAPHS.rec14, pos: GRAPHS.rec14.names.map((n) => [-5.4 + GM_R14LINE.indexOf(n) * 1.8, 0.6]) }, { noDrop: true });
  A.g.edges.forEach((e, i) => { e.bend = (i % 2 ? 1 : -1) * 0.22; drawEdge(GR, e); });
  A.E('C', 'A').bend = 0.45; A.ec('C', 'A', C.back, 2.6);
  const me = gmHost(-6.3, 3.9);
  say('如果有 back edge C → A 呢？', '');
  await step(tok);                                   // 3130.2 it would break topological sort
  await gmHop(tok, A, 'C', 'A', 600, '←');
  say('它會讓 topological sort 壞掉', 'C → A 指向左邊');
  await step(tok);                                   // 3141.9 says A before C, but we leave C before A
  T('要求 A 在 C 前面完成…', 'note', -1.6, -1.8);
  T('但 DFS 一定先離開 C、才離開 A', 'note', -1.6, -2.6);
  me.mood('sad');
  say('它要求 A 比 C 先放進 finished', '但 DFS 一定先離開 C，順序一定會被違反');
  await step(tok);                                   // 3150.4 when back edge? a cycle
  for (const v of ['A', 'B', 'C']) A.col(v, '#f3c4c4', 0.3);
  say('什麼時候有 back edge？有 cycle 的時候', 'A → B → C → A');
  await step(tok);                                   // 3161.3 path forward + path backward = cycle
  say('有路往前、又有路往回 → cycle', '所以只有 DAG 才能做 topological sort');
  await step(tok);                                   // 3191.0 remember the intuition
  for (const v of ['A', 'B', 'C']) A.col(v, C.white);
  me.mood('happy');
  T('第一個輸出的 = 最後修的課（沒有課依賴它）', 'say', 0, 3.4);
  say('記住直覺：第一個輸出的就是最後修的課', '');
}]);

// ═════════════════ s-CYnVz-uh4：MIT 6.006 L13 — graph search, representations, BFS ═════════════════
const GM_CUBEC = ['#e55a5a', '#f2b53a', '#4b9ee2', '#2fc092', '#f4efe4', '#f08a3c'];
function gmLine(x1, z1, x2, z2, color = '#a99470', y = 0.2) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(x1, y, z1), V(x2, y, z2)]), new THREE.LineBasicMaterial({ color })); lab.world.add(l); return l; }
// a little 2×2×2 cube made of 8 cubies at (x, y, z); returns the cubies
function gmPocket(x, y, z, s = 0.5, scramble = false) {
  const out = [];
  let k = 0;
  for (const dx of [-1, 1]) for (const dy of [-1, 1]) for (const dz of [-1, 1]) {
    const c = scramble ? GM_CUBEC[(k * 7 + 3) % 6] : GM_CUBEC[(dx > 0 ? 0 : 2) + (dz > 0 ? 1 : 0)];
    out.push(K.cube(null, c, [s * 0.94, s * 0.94, s * 0.94], x + dx * s / 2, y + dy * s / 2 + s, z + dz * s / 2));
    k++;
  }
  return out;
}
// 0:18 graph search
FRAG.push(['graphmit-l13-search', 'Graph search：在圖上找路、探索', async (tok) => {
  gmFresh([0, 9, 9], [0, 0.6, 0]);
  await step(tok);                                   // 18.0 graph search, BFS, Rubik's cube
  const me = buddy('', '', '#f4a56a', -4.6, 0, 1.6, 0.8);
  gmPocket(4.2, 0, 1.2, 0.6, true);
  T('graph search + breadth-first search', 'say', 0, -3.0, 1.0);
  say('今天：graph search 與 BFS', '原理上怎麼解魔術方塊');
  await step(tok);                                   // 45.3 graph search = exploring a graph
  const A = gmG(GM_L13G, { scale: 0.55, dz: -0.6 });
  say('graph search：探索一張圖', '');
  await step(tok);                                   // 58.9 given s and t: find a path
  A.col('s', GM.src, 0.3); A.top('s', 's'); A.col('v', C.back, 0.3); A.top('v', 't');
  for (const [u, v] of [['s', 'x'], ['x', 'c'], ['c', 'v']]) { A.ec(u, v, GM.hot, 2.2); await gmHop(tok, A, u, v, 300); }
  say('給起點 s、終點 t：找一條路', '');
  await step(tok);                                   // 68.0 Rubik's cube: state → solved state
  T('s = 現在的方塊狀態　t = 解好的狀態', 'note', 0, 2.6, 1.0);
  me.mood('wow');
  say('魔術方塊：從目前狀態走到「解好」的狀態', '');
  await step(tok);                                   // 94.4 initial state, target state: find the path
  say('知道起點、知道目標：找中間的路徑', '');
  await step(tok);                                   // 104.3 all paths / all reachable / all vertices / edges
  for (const v of A.g.G.names) { A.col(v, GM.on, 0.1); await kan(tok, 90, () => {}); }
  say('也可能想找所有路徑、所有走得到的點', '或整張圖的所有頂點、所有邊');
  await step(tok);                                   // 116.0 all solved by this class and next
  me.mood('happy');
  say('這些探索問題，這堂和下堂的演算法都能解', '');
}]);

// 2:01 圖的定義與例子
const GM_L13U = { title: 'undirected', directed: false, names: ['a', 'b', 'c', 'd'], pos: [[-5.4, -2.2], [-2.2, -2.2], [-3.8, 0.4], [-3.8, 2.8]], edges: [[0, 1], [0, 2], [1, 2], [2, 3]] };
const GM_L13D = { title: 'directed', directed: true, names: ['a', 'b', 'c'], pos: [[1.8, -2.2], [5.0, -2.2], [3.4, 0.6]], edges: [[0, 2], [1, 0], [1, 2], [2, 1]] };
FRAG.push(['graphmit-l13-def', '圖的定義：無向 vs 有向、怎麼表示', async (tok) => {
  gmFresh();
  await step(tok);                                   // 121.5 what a graph is
  const me = gmHost(-6.3, 3.9);
  say('先複習什麼是 graph', '6.042（離散數學）教過');
  await step(tok);                                   // 138.8 vertices V, edges E
  T('G = (V, E)：V = 頂點集合，E = 邊集合', 'say', 0, -4.3);
  say('一個頂點集合 V、一個邊集合 E', '');
  await step(tok);                                   // 141.0 unordered pairs or ordered pairs
  T('{u, v}：無序對', 'note', -3.6, -3.5); T('(u, v)：有序對', 'note', 3.4, -3.5);
  say('邊是「無序對」{u, v} 或「有序對」(u, v)', '');
  await step(tok);                                   // 178.2 undirected / directed
  T('→ undirected', 'ptr', -3.6, -2.9); T('→ directed', 'ptr', 3.4, -2.9);
  say('無序對 → undirected；有序對 → directed', '');
  await step(tok);                                   // 184.8 usually only one type
  say('通常一張圖只有一種邊', '全部有向，或全部無向');
  await step(tok);                                   // 196.7 an undirected graph
  const U = gmG(GM_L13U);
  say('例子：一張無向圖', '');
  await step(tok);                                   // 222.9 a directed graph
  buildGraph(GM_L13D);
  const Dg = GR;
  say('另一張：有向圖', '');
  await step(tok);                                   // 224.8 V = {a, b, c, d} / {a, b, c}
  T('V = {a, b, c, d}', 'ptr alt', -3.8, 3.7); T('V = {a, b, c}', 'ptr alt', 3.4, 3.7);
  say('頂點集合：左邊 {a, b, c, d}，右邊 {a, b, c}', '');
  await step(tok);                                   // 232.0 E: ab, bc, cd …
  T('E = {ab, ac, bc, cd}', 'ptr', -3.8, 4.4);
  say('邊集合：ab、bc、cd …', '');
  await step(tok);                                   // 257.4 how to represent for an algorithm?
  me.mood('wow');
  say('演算法要怎麼「存」一張圖？', '');
  await step(tok);                                   // 267.0 obvious: array of vertices, array of edges
  const el = makeStrip(-1.0, 1.9, 'edges', 0.85);
  el.set(['ab', 'ac', 'bc', 'cd'].map((t) => ({ key: t, text: t })));
  say('最直接：一個頂點陣列 + 一個邊陣列', '');
  await step(tok);                                   // 277.0 neighbours of a: scan whole edge list → horrible
  for (const t of ['ab', 'ac', 'bc', 'cd']) { const b = el.items.get(t); b.obj.material.color.set(GM.hot); await kan(tok, 250, () => {}); if (t !== 'ab' && t !== 'ac') b.obj.material.color.set('#e3dccd'); }
  me.mood('sad');
  say('想知道 a 的鄰居：整條邊陣列都要掃一遍', '線性時間，太慢 → 很糟的表示法');
  await step(tok);                                   // 290.7 use adjacency lists instead
  me.mood('happy');
  say('所以改用更好的：adjacency lists', '');
  await step(tok);                                   // 299.0 a→c, b→c, c→b both directions, b→a
  GR = Dg;
  for (const [u, v] of [['c', 'b'], ['b', 'c']]) { const e = Dg.edges.find((e) => Dg.G.names[e.u] === u && Dg.G.names[e.v] === v); edgeColor(e, GM.hot, 2.2); }
  say('有向圖的邊：ac、bc、cb、ba', 'b → c 和 c → b 兩個方向都有');
}]);

// 5:22 graph search 的應用
FRAG.push(['graphmit-l13-apps', 'Graph search 的應用', async (tok) => {
  gmFresh([0, 10, 9], [0, 0.4, 0]);
  await step(tok);                                   // 322.1 applications
  const me = buddy('', '', '#f4a56a', 0, 0, 0.4, 0.8);
  say('Graph search 的應用很多', '');
  await step(tok);                                   // 330.5 web crawling
  const mon = prop('monitor', -4.6, 0, -2.6, 0.9, 'web crawling'); bob(mon, 0.04, 1.5);
  say('Web crawling：Google 要找到網路上所有網頁', '只能一直跟著連結走');
  await step(tok);                                   // 361.6 Google goes breadth first
  T('大致 breadth first（有優先順序）', 'note', -4.6, -0.6, 0.5);
  say('Google 大致上是 breadth first', '時間用完就停');
  await step(tok);                                   // 378.8 social networking: friends of friends
  const f1 = buddy('', '', '#9fd3f0', 3.0, 0, -2.8, 0.45), f2 = buddy('', '', '#c9b6f2', 4.6, 0, -2.0, 0.45), f3 = buddy('', '', '#a6e3c4', 5.4, 0, -3.4, 0.45);
  T('社群網路：朋友的朋友 = 第二層', 'say', 4.2, -4.4, 1.0);
  say('Friend Finder：找朋友、朋友的朋友', '就是兩層、三層的搜尋');
  await step(tok);                                   // 405.0 network broadcast
  T('網路廣播：封包探索整張網路', 'note', -4.6, 1.4, 0.5);
  say('在網路上廣播訊息：封包會探索整張圖', '');
  await step(tok);                                   // 426.3 garbage collection: unreachable data
  const fl = prop('file', 4.2, 0, 1.0, 0.9, 'garbage collection');
  T('變數走不到的資料 → 回收', 'note', 4.2, 2.2, 0.5);
  say('Garbage collection：從變數走不到的資料就能丟', '做法就是 breadth-first search');
  await step(tok);                                   // 487.8 model checking
  prop('cpu', -4.6, 0, 3.2, 1.0, 'model checking');
  say('Model checking：電路／程式所有可能的狀態', '檢查走得到的狀態有沒有問題');
  await step(tok);                                   // 533.6 checking mathematical conjectures
  T('檢查數學猜想：搜尋所有情況找反例', 'note', 0, 3.4, 0.5);
  say('老師也用 BFS 檢查數學猜想', '找到反例就結束');
  await step(tok);                                   // 587.5 2×2×2 Rubik's cube optimally
  gmPocket(1.6, 0, 3.6, 0.45);
  me.mood('happy');
  say('2×2×2 魔術方塊的最佳解：用 BFS', '作業會做');
  await step(tok);                                   // 603.3 7×7×7: longer than the universe
  me.mood('wow');
  say('7×7×7 用 BFS 求最佳解：比宇宙壽命還久', '');
}]);

// 10:29 Pocket cube 的 configuration graph
FRAG.push(['graphmit-l13-cube', 'Pocket cube：configuration graph 與 diameter', async (tok) => {
  gmFresh([0, 10, 9], [0, 0.4, 0]);
  await step(tok);                                   // 629.0 pocket cube: 2×2×2
  const me = gmHost(-6.3, 3.9);
  const cub = gmPocket(-4.2, 0, -2.2, 0.7);
  say('Pocket cube：2×2×2 魔術方塊', '');
  await step(tok);                                   // 641.0 configuration graph: a vertex per state
  T('configuration graph：每個「狀態」是一個頂點', 'say', 1.6, -3.6, 1.0);
  say('configuration graph：每種狀態一個頂點', '');
  await step(tok);                                   // 689.6 lots of vertices: 264 million
  const nv = T('頂點數 ≈ 2 億 6400 萬', 'ptr alt', 1.6, -2.6, 0.6);
  say('頂點非常多：大約 2.64 億個', '');
  await step(tok);                                   // 701.5 8! × 3⁸
  setT(nv, '頂點數 = 8! × 3⁸ ≈ 2.64 億');
  say('算法：8! × 3⁸', '');
  await step(tok);                                   // 717.4 8 cubies, permute them: 8!
  const home = cub.map((c) => c.position.clone());
  const perm = [3, 7, 0, 5, 1, 6, 2, 4];
  await kan(tok, 1200, (u) => cub.forEach((c, i) => c.position.lerpVectors(home[i], home[perm[i]], u)));
  T('8 個小方塊（cubie）任意排列：8!', 'note', -4.2, -0.4, 0.6);
  say('8 個小方塊可以任意換位置：8!', '');
  await step(tok);                                   // 751.0 each has 3 twists: 3⁸
  await kan(tok, 900, (u) => cub.forEach((c, i) => { c.rotation.y = (i % 3) * u * Math.PI / 2; }));
  T('每個有 3 種轉向：3⁸', 'note', -4.2, 0.4, 0.6);
  say('每個小方塊有 3 種轉向：3⁸', '');
  await step(tok);                                   // 769.0 ≈ 264 million: feasible
  say('2.64 億對電腦來說還搜得完', '');
  await step(tok);                                   // 781.3 divide by 24 symmetries, by 3 reachable
  setT(nv, '÷ 24（對稱）÷ 3（轉得到的只有 1/3）');
  say('還能除以 24 種對稱、再除以 3', '只有三分之一的狀態轉得到');
  await step(tok);                                   // 808.6 edges: every move
  const C0 = V(2.0, 0.3, 0.9);
  const hub = K.cube('解', '#f4efe4', [0.7, 0.5, 0.7], C0.x, 0.25, C0.z);
  const ring = (r, n, col) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return K.cube('', col, [0.32, 0.32, 0.32], C0.x + Math.cos(a) * r, 0.16, C0.z + Math.sin(a) * r * 0.62); });
  const r1 = ring(1.3, 6, '#2fc092');
  r1.forEach((m) => gmLine(C0.x, C0.z, m.position.x, m.position.z));
  say('邊：每一個轉動，從一個狀態到另一個狀態', '');
  await step(tok);                                   // 829.8 every move undoable → undirected
  T('轉動可以轉回來 → 無向圖', 'note', C0.x, C0.z - 1.4, 0.6);
  say('每個轉動都能轉回去：所以是無向圖', '');
  await step(tok);                                   // 841.9 quarter twist (half twist?)
  say('一步 = quarter twist（轉 90°）', '要不要把 180° 算一步，有爭議，影響不大');
  await step(tok);                                   // 866.0 picture: the solved state
  hub.material.color.set('#e8b02a');
  say('畫出這張圖：中間是「解好」的狀態', '');
  await step(tok);                                   // 879.7 configurations reachable in one move
  r1.forEach((m) => m.material.color.set('#4b9ee2'));
  T('1 步', 'idx', C0.x + 1.5, C0.z, 0.4);
  say('一步能到的狀態', '');
  await step(tok);                                   // 892.9 two moves
  const r2 = ring(2.5, 12, '#9b7ef4');
  T('2 步', 'idx', C0.x + 2.7, C0.z, 0.4);
  say('再一步：兩步能到的狀態', '可能有多條路到同一個狀態');
  await step(tok);                                   // 916.9 … run out of graph: 11 moves
  const r3 = ring(3.6, 18, '#e55a9b');
  T('… 最外層：11 步', 'idx', C0.x + 3.6, C0.z + 0.6, 0.4);
  say('一層一層往外，直到沒有新狀態', '允許半圈轉時，最外層是 11 步');
  await step(tok);                                   // 946.7 diameter = God's number
  T('diameter（直徑）= God\'s number', 'ptr alt', C0.x, C0.z + 2.9, 0.6);
  me.mood('wow');
  say('最遠的距離：diameter，玩家叫 God\'s number', '');
  await step(tok);                                   // 966.0 worst case 11; 3×3×3: 20
  T('2×2×2：11　3×3×3：20', 'note', -4.2, 1.6, 0.6);
  say('2×2×2 是 11 步；3×3×3 是 20 步', '');
  await step(tok);                                   // 1006.7 computed layer by layer = BFS
  for (const m of [...r1, ...r2, ...r3]) { m.position.y = 0.16; }
  say('算法：一層一層建出這張圖', '這就是 breadth-first search');
  await step(tok);                                   // 1017.0 grows exponentially
  await kan(tok, 900, (u) => r3.forEach((m) => m.scale.setScalar(1 + u * 0.6)));
  say('中間層數量指數成長', '越過這個「駝峰」非常難');
  await step(tok);                                   // 1047.2 n×n×n: diameter?
  me.mood('calm');
  say('n×n×n 的 diameter 是多少（Θ）？', '');
  await step(tok);                                   // 1147.9 obvious answer: n²
  T('猜：n²（大約 n² 個小方塊）', 'note', -4.2, 2.4, 0.6);
  say('直覺答案：n²', '大約 n² 個小方塊，每個常數步');
  await step(tok);                                   // 1178.0 right answer n² / log n
  T('答案：Θ(n² / log n)', 'ptr alt', -4.2, 3.2, 0.6);
  me.mood('happy');
  say('正確答案：Θ(n² / log n)', '老師團隊當年的新結果');
}]);

// 20:24 adjacency lists
FRAG.push(['graphmit-l13-adj', 'Adjacency lists：Adj[u] 與 implicit graph', async (tok) => {
  gmFresh(GM_CAM, [0.4, 0, -0.3]);
  await step(tok);                                   // 1224.5 graph representation: the input
  const D = gmG(GM_L13D, { dx: -5.4, dz: -0.8, scale: 0.8 }); // left of the Adj column (b used to sit on Adj[a])
  const me = gmHost(-6.3, 3.9);
  say('要探索一張圖，先知道輸入長什麼樣', '');
  await step(tok);                                   // 1243.6 adjacency lists: array Adj of size V
  const X0 = 0.2, row = (i) => -2.4 + i * 1.3;
  ['a', 'b', 'c'].forEach((n, i) => { K.cube(n, '#d9cfbd', [0.8, 0.45, 0.7], X0, 0.23, row(i), 1.0); });
  T('Adj（大小 V 的陣列）', 'idx', X0, -3.4);
  say('adjacency lists：一個大小為 V 的陣列 Adj', '');
  await step(tok);                                   // 1260.5 each element: pointer to a linked list
  ['a', 'b', 'c'].forEach((n, i) => { K.arrow(V(X0 + 0.45, 0.3, row(i)), V(X0 + 1.3, 0.3, row(i))); });
  say('每一格是一個指標，指向一條 linked list', '');
  await step(tok);                                   // 1278.9 indexed by vertex: 0..V−1 or a hash table
  T('頂點編號 0…V−1 → 陣列；其他 → hash table', 'note', 2.6, -3.6);
  say('陣列用頂點當 index', '頂點不是數字的話，Adj 就是 hash table');
  const L = {};
  const put = async (n, vs) => { vs.forEach((v, j) => K.cube(v, C.q, [0.6, 0.4, 0.55], X0 + 1.75 + j * 0.8, 0.2, row(['a', 'b', 'c'].indexOf(n)), 1.6)); await kan(tok, 300, () => {}); };
  await step(tok);                                   // 1320.6 for every vertex: its neighbours (one step)
  say('每個頂點存它的鄰居：一步走得到的頂點', 'Adj[u] = { v : (u, v) ∈ E }');
  await step(tok);                                   // 1351.2 Adj[b] = {a, c}
  D.col('b', GM.hot, 0.3); for (const v of ['a', 'c']) D.ec('b', v, GM.hot, 2);
  await put('b', ['a', 'c']);
  say('Adj[b] = {a, c}', 'b 一步能到 a 和 c');
  await step(tok);                                   // 1375.8 Adj[a] = {c}; can't go a → b
  D.col('b', C.white); for (const v of ['a', 'c']) D.ec('b', v, C.edge, 1);
  D.col('a', GM.hot, 0.3); D.ec('a', 'c', GM.hot, 2);
  await put('a', ['c']);
  say('Adj[a] = {c}', 'a → b？方向不對，走不過去');
  await step(tok);                                   // 1387.8 Adj[c] = {b}
  D.col('a', C.white); D.ec('a', 'c', C.edge, 1); D.col('c', GM.hot, 0.3); D.ec('c', 'b', GM.hot, 2);
  await put('c', ['b']);
  say('Adj[c] = {b}', '');
  await step(tok);                                   // 1399.0 undirected: Adj[c] = {a, b, d}
  D.col('c', C.white); D.ec('c', 'b', C.edge, 1);
  T('無向圖：Adj[c] = {a, b, d}', 'say', 2.8, 2.6);
  say('無向圖也一樣：Adj[c] = {a, b, d}', '');
  await step(tok);                                   // 1417.5 at a vertex: where can I go next
  me.mood('happy');
  say('探索時最想知道：從這裡下一步能去哪', 'Adj[u] 直接告訴你');
  await step(tok);                                   // 1439.4 implementation 1: array of linked lists
  say('實作一：陣列，每格指向一條 linked list', '');
  await step(tok);                                   // 1485.0 object-oriented: v.neighbors
  T('物件導向：v.neighbors = Adj[v]', 'note', 2.8, 3.3);
  say('實作二：物件導向，v.neighbors', '');
  await step(tok);                                   // 1523.0 textbook's way: many graphs on the same vertices
  T('Adj₁、Adj₂ … 同一群頂點、好幾張圖', 'note', 2.8, 4.0);
  say('Adj 陣列的好處：同一群頂點可以有好幾張圖', '');
  await step(tok);                                   // 1560.4 implicit: Adj(u) is a function
  T('implicit：Adj(u) 是一個函式，需要時才算', 'ptr alt', 2.8, -2.8);
  say('implicit graph：Adj(u) 是函式，用到才計算', '幾乎不佔空間');
  await step(tok);                                   // 1647.3 where useful? Rubik's cube
  gmPocket(5.2, 0, -1.4, 0.45);
  me.mood('wow');
  say('什麼時候有用？魔術方塊！', '狀態比宇宙的粒子還多，不可能全部存');
  await step(tok);                                   // 1689.0 easy: try each move to list neighbours
  say('但給一個狀態，試每一種轉法就能列出鄰居', 'n×n×n：O(n) 時間列出 O(n) 個鄰居');
  await step(tok);                                   // 1741.2 space? V + E
  T('空間：Θ(V + E)', 'ptr alt', 0.2, 2.2);
  me.mood('happy');
  say('adjacency lists 的空間：Θ(V + E)', '這門課演算法的標準時間');
  await step(tok);                                   // 1795.4 V for the array + the lists (2E half-edges undirected)
  T('V（陣列）+ Σ|Adj| = E（有向）／2E（無向）', 'say', 0.2, 2.9);
  say('V 格陣列 + 串列：有向 E 個、無向 2E 個', '都是 Θ(V + E)');
}]);

// 31:06 BFS 的想法
FRAG.push(['graphmit-l13-idea', 'BFS 的想法：0 步、1 步、2 步…，避免重複', async (tok) => {
  gmFresh();
  await step(tok);                                   // 1866.7 an actual algorithm: BFS
  const A = gmG(GM_L13G);
  const me = gmHost(-6.3, 3.9);
  say('真正的演算法：breadth-first search', '圖上最簡單的演算法');
  const lv = (k) => A.g.G.names.filter((v) => GM_LV[v] === k);
  await step(tok);                                   // 1881.0 start, all reachable from there, again …
  for (let k = 0; k < 4; k++) { lv(k).forEach((v) => A.col(v, GM_LVC[k], 0.15)); await kan(tok, 350, () => {}); }
  say('從一個點出發，看所有一步能到的點', '再從它們出發……直到沒有新的點');
  await step(tok);                                   // 1895.9 the annoying part: edges going backwards
  for (const v of A.g.G.names) A.col(v, C.white);
  const arc = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.04, 6, 30, Math.PI), new THREE.MeshBasicMaterial({ color: C.back }));
  arc.rotation.x = Math.PI / 2; arc.position.set(-3.0, 0.3, 1.6); lab.world.add(arc);
  const atg = T('往回指到前面某層的邊？', 'note', -3.0, 3.6, 0.8);
  say('麻煩的地方：有些邊會指回前面的層', '');
  await step(tok);                                   // 1911.7 can't happen undirected; directed can
  setT(atg, '無向圖最多指回上一層；有向圖可能跨好幾層');
  say('老師想了一下：無向圖不會跨好幾層往回', '有向圖可能：要認得「這個點已經看過」');
  await step(tok);                                   // 1954.6 goal: all vertices reachable from s, O(V + E)
  kill(arc);
  A.col('s', GM.src, 0.3);
  T('目標：拜訪 s 走得到的所有頂點，O(V + E)', 'say', 0, -4.2);
  say('目標：拜訪從 s 走得到的所有頂點', '時間 O(V + E)');
  await step(tok);                                   // 1980.3 0 moves: s; 1 move: Adj[s]; 2 moves …
  for (let k = 0; k < 4; k++) { lv(k).forEach((v) => { A.col(v, GM_LVC[k], 0.15); A.top(v, k + ' 步'); }); await kan(tok, 450, () => {}); }
  say('0 步：s；1 步：Adj[s]；接著 2 步、3 步…', '');
  await step(tok);                                   // 2015.1 avoid duplicates: else forever around a cycle
  const w = gmWalker(A, 's');
  for (const v of ['x', 'd', 'c', 'x', 'd', 'c']) { A.ec('x', 'd', C.back, 2); A.ec('d', 'c', C.back, 2); A.ec('c', 'x', C.back, 2); await gmGo(tok, A, w, v, 250); }
  me.mood('wow');
  say('要避免重複拜訪', '不然沿著 cycle 繞圈，永遠不會結束');
  await step(tok);                                   // 2045.3 write the code
  for (const [u, v] of [['x', 'd'], ['d', 'c'], ['c', 'x']]) A.ec(u, v, C.edge, 1);
  w.g.visible = false;
  say('來寫程式', '');
  await step(tok);                                   // 2054.0 my favourite version (textbook differs)
  me.mood('happy');
  say('有好幾種寫法：老師最愛的「frontier」版本', '課本用 queue，是另一種寫法');
}]);

// 37:16 BFS 程式與例子
const GM_BFSCODE = ['BFS(s, Adj):', '  level = {s: 0}', '  parent = {s: None}', '  i = 1', '  frontier = [s]', '  while frontier:', '    next = []', '    for u in frontier:', '      for v in Adj[u]:', '        if v not in level:', '          level[v] = i', '          parent[v] = u', '          next.append(v)', '    frontier = next', '    i += 1'];
FRAG.push(['graphmit-l13-run', 'BFS 程式：frontier、next、level', async (tok) => {
  gmFresh(GM_CAM, [0.6, 0, -0.3]);
  const cd = code(GM_BFSCODE, -4.0, -3.9, 0.42);
  await step(tok);                                   // 2236.9 undirected example (works for directed too)
  const A = gmG(GM_L13G, { scale: 0.62, dx: 3.4, dz: -1.2 });
  say('在一張無向圖上跑', '有向圖也一樣能用');
  await step(tok);                                   // 2250.8 start vertex s; given Adj
  A.col('s', GM.src, 0.3);
  say('給起點 s 和 adjacency lists', '');
  const frS = makeStrip(-1.0, 3.0, 'frontier', 0.85), nxS = makeStrip(-1.0, 3.9, 'next', 0.85);
  const st = (S, list, c) => S.set(list.map((v) => ({ key: v, text: v, color: c })));
  const it = T('i = ?', 'ptr alt', 5.4, 1.6);
  await step(tok);                                   // 2267.2 initialisation; frontier = level i − 1
  cd.hl(4);
  say('frontier：上一層（第 i−1 層）的頂點', '用 i−1 步剛好走到的');
  await step(tok);                                   // 2288.8 next = level i
  cd.hl(6);
  say('next：這一層（第 i 層）', '用 i 步走到的');
  await step(tok);                                   // 2304.9 level[s] = 0
  cd.hl(1); A.top('s', 'L0');
  say('s 用 0 步就到：level[s] = 0', '第一行程式');
  await step(tok);                                   // 2312.9 parent: later
  cd.hl(2);
  say('parent 等一下再說（可有可無）', '');
  await step(tok);                                   // 2320.3 i = 1; frontier = [s]
  cd.hl(4); setT(it, 'i = 1'); st(frS, ['s'], '#cfe3f7');
  say('i = 1，frontier = [s]', '第 0 層只有 s');
  await step(tok);                                   // 2336.2 iterate; i increments; while frontier non-empty
  cd.hl(5);
  say('一直重複，每輪 i 加 1', 'frontier 不是空的就繼續');
  await step(tok);                                   // 2356.3 the bulk: computing next
  cd.hl(6);
  say('主要的工作：算出 next', '');
  await step(tok);                                   // 2366.0 frontier = next; i++
  cd.hl(13); await kan(tok, 300, () => {}); cd.hl(14);
  say('算完：frontier = next，i 加 1', '「frontier 是第 i−1 層」一直成立');
  await step(tok);                                   // 2380.2 every u in frontier, every v in Adj[u]
  cd.hl(7); await kan(tok, 300, () => {}); cd.hl(8);
  say('怎麼算 next？frontier 的每個 u、Adj[u] 的每個 v', '');
  await step(tok);                                   // 2399.8 check duplicates: v in level?
  cd.hl(9);
  say('關鍵：檢查重複——v 已經有 level 了嗎？', '');
  await step(tok);                                   // 2414.1 not there: set level, append to next
  cd.hl(10); await kan(tok, 250, () => {}); cd.hl(12);
  say('沒有的話：設 level，放進 next', '以後就不會再拜訪它');
  const vis = async (u, v, i) => { A.ec(u, v, C.tree, 2.4); await gmHop(tok, A, u, v, 260); A.col(v, GM_LVC[i], 0.2); A.top(v, 'L' + i); };
  const look = async (u, v) => { await gmHop(tok, A, u, v, 200, '?'); };
  await step(tok);                                   // 2442.9 frontier = [s]: edges to a and x
  cd.hl(8);
  await vis('s', 'a', 1); await vis('s', 'x', 1); st(nxS, ['a', 'x'], '#e9f6ee');
  say('frontier 只有 s：s 的邊通到 a、x', '');
  await step(tok);                                   // 2466.6 level one; frontier = a, x
  cd.hl(13); st(frS, ['a', 'x'], '#cfe3f7'); st(nxS, [], ''); setT(it, 'i = 2');
  say('a、x 是第 1 層；frontier 變成 [a, x]', '');
  await step(tok);                                   // 2486.0 from a: s (seen), z → level 2
  cd.hl(9); await look('a', 's'); await vis('a', 'z', 2); st(nxS, ['z'], '#e9f6ee');
  say('a 的鄰居：s 已有 level，跳過；z → 第 2 層', '');
  await step(tok);                                   // 2502.2 x: s again, d and c → level 2
  await look('x', 's'); await vis('x', 'd', 2); await vis('x', 'c', 2); st(nxS, ['z', 'd', 'c'], '#e9f6ee');
  say('x 的鄰居：s（又看一次）、d、c', '老師：連同一開始，s 被看了 3 次');
  await step(tok);                                   // 2521.6 frontier level 2; z's neighbour a: set
  cd.hl(13); st(frS, ['z', 'd', 'c'], '#cfe3f7'); st(nxS, [], ''); setT(it, 'i = 3');
  await look('z', 'a');
  say('第 2 層：z、d、c；z 只連到 a，已設過', '');
  await step(tok);                                   // 2529.0 d: x, c set; f added
  cd.hl(9); await look('d', 'x'); await look('d', 'c'); await vis('d', 'f', 3); st(nxS, ['f'], '#e9f6ee');
  say('d：x、c 都有了；f 是新的 → 第 3 層', '');
  await step(tok);                                   // 2534.4 c: x, d, f done; v → level 3
  await look('c', 'f'); await vis('c', 'v', 3); st(nxS, ['f', 'v'], '#e9f6ee');
  say('c：x、d、f 都有了；v 是新的 → 第 3 層', '');
  await step(tok);                                   // 2547.2 level 3: f, v — nothing new
  cd.hl(13); st(frS, ['f', 'v'], '#cfe3f7'); st(nxS, [], ''); setT(it, 'i = 4');
  await look('f', 'v'); await look('v', 'c');
  say('第 3 層 f、v：鄰居全都看過了', 'next 是空的');
  await step(tok);                                   // 2555.0 next empty → frontier empty → done
  cd.hl(5); st(frS, [], '');
  say('frontier 變空，while 結束', '所有走得到的頂點都拜訪了');
}]);

// 43:14 parent 指標與最短路徑
FRAG.push(['graphmit-l13-parent', 'Parent 指標：shortest path tree', async (tok) => {
  gmFresh();
  await step(tok);                                   // 2594.1 parent
  const A = gmG(GM_L13G);
  const me = gmHost(-6.3, 3.9);
  for (const v of A.g.G.names) { A.col(v, GM_LVC[GM_LV[v]], 0.1); A.top(v, 'L' + GM_LV[v]); }
  say('剛剛沒講的 parent', '');
  const P = gmDict(5.6, -3.8, 'parent', 0.44);
  const par = { a: 's', x: 's', z: 'a', d: 'x', c: 'x', f: 'd', v: 'c' };
  const ar = {};
  const ptr = (v) => { const a = A.H(v), b = A.H(par[v]); ar[v] = K.arrow(V(a.x, 0.75, a.z), V(b.x + (a.x - b.x) * 0.25, 0.75, b.z + (a.z - b.z) * 0.25), 0xa8730f); P.set(v, par[v]); };
  await step(tok);                                   // 2603.2 parent[s] = None; new v: parent = where we came from
  P.set('s', 'None');
  say('parent[s] = None', '拜訪新頂點 v 時：parent[v] = 從哪個 u 走來');
  await step(tok);                                   // 2633.7 parent of a = s
  ptr('a');
  say('拜訪 a 時是從 s 來的：parent[a] = s', '');
  await step(tok);                                   // 2639.9 z ← a, x ← s, d ← x, c ← x
  for (const v of ['z', 'x', 'd', 'c']) { ptr(v); await kan(tok, 250, () => {}); }
  say('parent[z] = a、parent[x] = s', 'parent[d] = x、parent[c] = x');
  await step(tok);                                   // 2650.0 f: either way, d went first; v ← c
  ptr('f'); ptr('v');
  say('f 可以從 d 或 c 來：d 先處理，所以是 d', 'parent[v] = c');
  await step(tok);                                   // 2665.4 pointers go back along edges: all roads lead to s
  const w = gmWalker(A, 'v');
  for (const v of ['c', 'x', 's']) await gmGo(tok, A, w, v, 350);
  say('parent 指標沿著邊「往回」指', '一路跟著走，所有路都通往 s');
  await step(tok);                                   // 2690.0 they form a tree rooted at s
  T('parent 指標 = 一棵以 s 為根的樹', 'note', 0, -4.2);
  say('這些指標組成一棵樹，根是 s', '');
  await step(tok);                                   // 2720.1 shortest path properties
  me.mood('wow');
  say('而且它們給出最短路徑', '');
  await step(tok);                                   // 2746.0 node → parent → … → s, read backwards = shortest path
  say('從 v 一路跟 parent 走到 s，再反過來讀', '就是 s 到 v 的一條最短路徑');
  await step(tok);                                   // 2773.3 s to v: parent(v) = c, c → x, x → s
  for (const [u, v] of [['s', 'x'], ['x', 'c'], ['c', 'v']]) A.ec(u, v, GM.hot, 3);
  say('s 到 v：v ← c ← x ← s', '反過來：s → x → c → v');
  await step(tok);                                   // 2793.5 not the only one: s to f two paths of length 3
  for (const [u, v] of [['s', 'x'], ['x', 'c'], ['c', 'v']]) A.ec(u, v, C.edge, 1);
  for (const [u, v] of [['s', 'x'], ['x', 'd'], ['d', 'f']]) A.ec(u, v, C.tree, 3);
  A.ec('x', 'c', C.fwd, 3); A.ec('c', 'f', C.fwd, 3);
  say('不一定唯一：s 到 f 有兩條長度 3 的路', 's-x-d-f 和 s-x-c-f');
  await step(tok);                                   // 2804.8 parent pointers keep only one
  A.ec('x', 'c', C.edge, 1); A.ec('c', 'f', C.edge, 1);
  say('parent 指標只能記其中一條', '路可能有指數多條');
  await step(tok);                                   // 2816.9 length = fewest edges = level[v]
  T('最短路徑長度 = level[v]（最少幾條邊）', 'ptr alt', 0, 4.4);
  say('路徑長度（最少邊數）就是 level[v]', '');
  await step(tok);                                   // 2856.0 Rubik's cube: BFS from start, look up level, follow parents
  gmPocket(-4.6, 0, 1.6, 0.4, true);
  say('魔術方塊：查 level 就知道幾步', '再跟著 parent 指標一步步轉回去');
  await step(tok);                                   // 2896.3 whole graph in memory → God's algorithm
  me.mood('happy');
  say('整張圖存得下的話：每個狀態的最佳解法', 'God\'s algorithm');
}]);

// 48:34 BFS 的時間
FRAG.push(['graphmit-l13-time', 'BFS 的時間：Σ|Adj[v]| = O(E)', async (tok) => {
  gmFresh(GM_CAM, [0.4, 0, -0.3]);
  await step(tok);                                   // 2914.5 running time: O(V + E)?
  const A = gmG(GM_L13G, { scale: 0.62, dx: 2.8, dz: -1.4 });
  const me = gmHost(-6.3, 3.9);
  const rows = {};
  A.g.G.names.forEach((u, r) => { const z = -3.6 + r * 0.82; K.cube(u, '#d9cfbd', [0.6, 0.4, 0.6], -5.4, 0.2, z); rows[u] = adjOf(r).map((p, j) => K.cube(nm(p.to), C.q, [0.5, 0.36, 0.5], -4.6 + j * 0.62, 0.18, z, 1.2)); });
  T('Adj', 'idx', -5.4, -4.3);
  say('時間是 O(V + E) 嗎？', '剛剛同一個點好像被檢查很多次');
  await step(tok);                                   // 2925.2 every edge checked once (twice undirected)
  say('其實每條邊只被檢查一次', '無向圖兩端各一次：兩次');
  await step(tok);                                   // 2939.4 a vertex enters the frontier only once
  T('每個頂點只會進 frontier 一次', 'note', 2.8, 2.2);
  say('每個頂點只進 frontier 一次', '一旦有 level，就不會再被加進 next');
  const cnt = T('掃了 0 個', 'ptr alt', -1.4, 3.6);
  let k = 0;
  await step(tok);                                   // 2954.4 s once → its neighbours; a once …
  for (const u of ['s', 'a', 'x']) { A.col(u, GM.on, 0.2); rows[u].forEach((m) => { m.material.color.set(GM.hot); k++; }); setT(cnt, '掃了 ' + k + ' 個'); await kan(tok, 300, () => {}); }
  say('s 進一次、掃它的鄰居；a 進一次、掃它的鄰居…', '');
  await step(tok);                                   // 2962.0 total = Σ |Adj[v]|
  for (const u of ['z', 'd', 'c', 'f', 'v']) { A.col(u, GM.on, 0.2); rows[u].forEach((m) => { m.material.color.set(GM.hot); k++; }); setT(cnt, '掃了 ' + k + ' 個'); await kan(tok, 200, () => {}); }
  setT(cnt, 'Σ |Adj[v]| = ' + k);
  say('總時間 = 所有頂點 |Adj[v]| 的總和', '');
  await step(tok);                                   // 2987.3 2E undirected, E directed (handshaking)
  setT(cnt, 'Σ |Adj[v]| = 20 = 2 × 10 條邊');
  say('無向圖 = 2E、有向圖 = E', 'handshaking lemma');
  await step(tok);                                   // 3012.3 + O(V): O(V + E)
  T('O(V + E)（其實可以說 O(E)）', 'ptr alt', 2.8, 3.0);
  me.mood('happy');
  say('再加上碰每個頂點的 O(V)：O(V + E)', '');
  await step(tok);                                   // 3024.8 visit every vertex: outer loop over s
  T('想拜訪整張圖：外層再對每個頂點當起點跑一次', 'say', 0.6, 4.4);
  say('想拜訪不連通的整張圖：外層迴圈試每個起點', '下一堂（DFS）會再談');
}]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '演算法・第 6 章',
    title: '圖論演算法：BFS、DFS、Topological sort、SCC',
    color: 'var(--alg)',
    modes: [
      { id: 'bfs', name: 'BFS', enter: enterBFS },
      { id: 'dfs', name: 'DFS 與邊分類', enter: enterDFS },
      { id: 'topo', name: 'Topological sort', enter: enterTopo },
      { id: 'scc', name: 'SCC', enter: enterSCC },
      { id: 'ap', name: 'Articulation point', enter: enterAP },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: [
      'graph-handshake', 'graph-representation', 'bfs-queue', 'bfs-runtime', 'bfs-clrs-tree',
      'dfs-fiset-walk', 'dfs-fiset-code', 'dfs-fiset-components',
      'dfs-visit-code', 'dfs-clrs-run', 'dfs-runtime', 'edge-classify', 'edge-undirected',
      'dfs-rec14-parent', 'edge-rec14-classify', 'edge-rec14-undirected',
      'cycle-back-edge', 'topo-dressing', 'topo-proof', 'topo-rec14-courses', 'topo-back-edge-breaks', 'topo-kahn',
      'scc-kosaraju', 'scc-tarjan', 'articulation-points',
    ].concat(FRAG.map((f) => f[0])),
    stop() { clearTimeout(timer); epoch++; },
  };
}
