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
    say('課本例子：從 s 做 BFS', 'd[v] = 最少邊數，π 畫出 BFS tree');
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
    say('SCC：互相走得到的極大頂點集合', '課本例子（CLRS 圖 22.9）');
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
    ],
    stop() { clearTimeout(timer); epoch++; },
  };
}
