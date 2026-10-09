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
        const p = [...Array(n).keys()].sort(() => Math.random() - 0.5);
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
  await travel(tok, drop, drop.position.clone(), V3(P13[1][0], P13[1][1] + 0.4, 0.5), 700);
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
  const skip = async (a, b) => { const e = G.ed(a, b); paintE(e, JC.hot, 'thick'); await anim(tok, 350, () => {}); paintE(e, JC.edge, 'dash'); };
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
